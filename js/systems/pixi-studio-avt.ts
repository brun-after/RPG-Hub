// ─── Studio Pixi — Adventure Mode Integration ────────────────────────────────
// Plays pixi_animations by ID during adventure mode combat/skill use.
// Depends on: aventura.js (_avtPixiParticleAnim, _avtEnsurePixiParticles,
//              _avtProcTextures, AVT_STATE), pixi-studio.js (PIXI_STUDIO_STATE)

var _PS_AVT_ACTIVE: any    = [];  // { timerId, cleanup } — efeitos ativos (follow + one-shots)
var _PS_PERSISTENT    = new Map();  // key -> { cleanup } for duration-bound persistent animations

// Reference positions matching pixi-studio.js PS_ATAC_REF / PS_ALVO_REF
const _PS_ATAC_REF = { x: -160, y: 0 };
const _PS_ALVO_REF = { x:  160, y: 0 };

// ── Aquisição de "app" para efeitos ──────────────────────────────────────────
// Caminho preferencial: host Pixi persistente do aventura.js (_avtVfxAcquireApp) —
// o efeito vira um Container no app único (sem novo contexto WebGL). Fallback:
// overlay <canvas> por efeito (comportamento antigo).
// Retorna { app, destroy() } ou null.
function _psAvtAcquireApp() {
  if (typeof _avtVfxAcquireApp === 'function') {
    const ad = _avtVfxAcquireApp();
    if (ad) return { app: ad, destroy: () => { try { ad.destroy(); } catch (_) {} } };
  }
  const canvas = AVT_STATE.canvas;
  if (!canvas || typeof PIXI === 'undefined') return null;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
  overlayCanvas.style!.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);
  let app;
  try {
    app = new PIXI.Application({
      view: overlayCanvas, width: overlayCanvas.width, height: overlayCanvas.height,
      backgroundAlpha: 0, antialias: false,
      resolution: (typeof _avtVfxOverlayResolution === 'function' ? _avtVfxOverlayResolution() : 1),
      autoDensity: true,
    });
  } catch (e) { overlayCanvas.remove(); return null; }
  return {
    app, overlayCanvas,
    destroy: () => {
      try { app.destroy(true, { children: true }); } catch (_) {}
      try { overlayCanvas.remove(); } catch (_) {}
    },
  };
}

// Registra um efeito one-shot no rastreio global, para que avtPixiCleanupAll consiga
// destruí-lo em teardown (troca de fase/saída) mesmo antes do timer de fim disparar.
function _psAvtTrack(cleanup: any, durMs: any) {
  const entry = { cleanup: null as any, timerId: null as any };
  let done = false;
  entry.cleanup = () => {
    if (done) return; done = true;
    clearTimeout(entry.timerId);
    try { cleanup(); } catch (_) {}
    _PS_AVT_ACTIVE = _PS_AVT_ACTIVE.filter((e: any) => e !== entry);
  };
  entry.timerId = setTimeout(entry.cleanup, durMs);
  _PS_AVT_ACTIVE.push(entry);
  return entry;
}

// Textura com tolerância a URL quebrada: nunca lança; em erro de carga, remove a
// entrada envenenada do cache global do PIXI (permite retry num uso futuro).
function _psAvtTexFrom(url: any) {
  try {
    const tex = PIXI.Texture.from(url);
    if (tex && tex.baseTexture && !tex.baseTexture.valid) {
      tex.baseTexture.once('error', () => {
        try { PIXI.Texture.removeFromCache(url); } catch (_) {}
        try { PIXI.BaseTexture.removeFromCache && PIXI.BaseTexture.removeFromCache(url); } catch (_) {}
      });
    }
    return tex || PIXI.Texture.WHITE;
  } catch (_) { return PIXI.Texture.WHITE; }
}

// Textura de vinheta radial (canvas 2D, cacheada): centro transparente → bordas pretas.
let _psVignetteTex: any = null;
function _psVignetteTexture() {
  if (_psVignetteTex && _psVignetteTex.baseTexture && _psVignetteTex.baseTexture.valid !== false) return _psVignetteTex;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.22, S / 2, S / 2, S * 0.52);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.65, 'rgba(0,0,0,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  _psVignetteTex = PIXI.Texture.from(c);
  return _psVignetteTex;
}

// Node de escurecimento de fundo. Usa renderer.screen (coordenadas do stage), NÃO
// renderer.width/height: este é o backing store (screen × resolution) e no overlay
// iso (resolution 1/1.8) o retângulo sairia parcial/deslocado — a "sombra retangular"
// sobre o mapa. radialDim ganha vinheta real; sem darken explícito assume 0.3 (legado).
function _psBuildBackgroundDim(app: any, bg: any) {
  if (!bg || (!bg.darken && !bg.radialDim)) return null;
  const W = app.renderer.screen.width, H = app.renderer.screen.height;
  const a = Math.min(1, bg.darken || 0.3);
  if (bg.radialDim) {
    const sp = new PIXI.Sprite(_psVignetteTexture());
    sp.width = W; sp.height = H; sp.alpha = a;
    return sp;
  }
  const dim = new PIXI.Graphics();
  dim.beginFill(0x000000, a).drawRect(0, 0, W, H).endFill();
  return dim;
}

// ── Transform studio-space coordinates to adventure screen-space ─────────────
function _psStudioToScreen(px: any, py: any, atacScr: any, alvoScr: any) {
  const dx_s = _PS_ALVO_REF.x - _PS_ATAC_REF.x;  // 320
  const dy_s = _PS_ALVO_REF.y - _PS_ATAC_REF.y;  // -60
  const dx_a = alvoScr.x - atacScr.x;
  const dy_a = alvoScr.y - atacScr.y;
  const lenS = Math.sqrt(dx_s * dx_s + dy_s * dy_s);
  const lenA = Math.sqrt(dx_a * dx_a + dy_a * dy_a);
  // Self-cast / tokens na mesma célula: lenA→0 colapsaria toda a geometria num
  // ponto (scale→0). Clampa o span a ~1 tile para o efeito continuar legível.
  const SZv = Math.round((typeof AVT_SZ !== 'undefined' ? AVT_SZ : 48) * (AVT_STATE.camera?.zoom || 1));
  const lenEff = Math.max(lenA, SZv);
  const scale = lenS > 0 ? lenEff / lenS : 1;
  const angle = Math.atan2(dy_a, dx_a) - Math.atan2(dy_s, dx_s);
  const relX  = px - _PS_ATAC_REF.x;
  const relY  = py - _PS_ATAC_REF.y;
  const rotX  = relX * Math.cos(angle) - relY * Math.sin(angle);
  const rotY  = relX * Math.sin(angle) + relY * Math.cos(angle);
  return { x: atacScr.x + rotX * scale, y: atacScr.y + rotY * scale };
}

// ─── Anchor model (config v3): per-layer origin / height / pose ──────────────
// Lets an effect (or a single layer) declare WHERE on the field it spawns and HOW
// it is oriented, so the same animation reads correctly in top-down and isometric.
//   source : 'caster' | 'target' | 'mid' | 'area'  (generalizes posicao_override)
//   cell   : { dx, dy }  offset in GRID CELLS from the source entity (e.g. the cell in front)
//   spot   : 'center' | 'nw' | 'ne' | 'sw' | 'se'  planar point inside the cell (ground plane)
//   z      : 'ground' | 'chest' | 'top' | 'float'  vertical height along the body
//   zFrac  : 0..1+  fraction of token height (feet=0, top=1); overrides z when set
//   pose   : 'upright' | 'floor' | 'leaning'  billboard up / lie on the floor / tilted
const _PS_CHEST_FRAC = 0.62;   // peitoral ≈ 62% da altura do token (pés=0, topo=1)
const _PS_Z_FRAC: Record<string, any> = { ground: 0, chest: _PS_CHEST_FRAC, top: 0.95, float: 0.5 };
const _PS_LEAN = 0.55;         // fração da contra-transformação aplicada na pose 'leaning'

// True when iso VFX projection is active (overlay lives inside the CSS-transformed wrap).
function _avtVfxIsoOn() {
  return !!(typeof AVT_GRAFICOS !== 'undefined' && AVT_GRAFICOS && AVT_GRAFICOS.isoAtivo
    && AVT_GRAFICOS.vfxProjecao && typeof _ISO_ANGLE_X !== 'undefined');
}
// True when effects should also be billboarded (appear "standing"/facing the camera).
function _avtVfxBillboardOn() {
  return _avtVfxIsoOn() && !!AVT_GRAFICOS.vfxBillboard;
}
// Token image height in screen px at the current zoom (mirrors aventura.js iso token draw).
function _avtVfxTokenPx() {
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera?.zoom || 1));
  return SZ * 0.95;
}
// Auto base scale for VFX adapted to the current graphics mode (iso shrinks vs top-down).
// Topdown → 1 (unchanged). Iso → smaller, lighter for higher "nivel"/2:1 depth.
function _avtVfxAutoScale() {
  if (!(typeof AVT_GRAFICOS !== 'undefined' && AVT_GRAFICOS && AVT_GRAFICOS.isoAtivo)) return 1;
  let s = 0.62;                                   // iso base: animations authored for top-down look big
  if (AVT_GRAFICOS.profundidade) s *= 0.92;       // 2:1 diamond squashes the ground plane
  return s;
}
// Combined VFX scale: auto base × per-animation override (cfg.iso_scale, default 1).
function _avtVfxScale(cfg: any) {
  const mult = (cfg && typeof cfg.iso_scale === 'number') ? cfg.iso_scale : 1;
  return _avtVfxAutoScale() * mult;
}

// Normalize a raw anchor config, falling back to a legacy source keyword.
function _psNormAnchor(anchorCfg: any, fallbackSource?: any) {
  const a = anchorCfg || {};
  return {
    source: a.source || fallbackSource || 'target',
    cell:   { dx: (a.cell && a.cell.dx) || 0, dy: (a.cell && a.cell.dy) || 0 },
    spot:   a.spot || 'center',
    z:      a.z || null,
    zFrac:  (typeof a.zFrac === 'number') ? a.zFrac : null,
    pose:   a.pose || 'upright',
  };
}
// Map a source keyword → entity (mid handled by the caller).
function _psSourceEnt(source: any, casterEnt: any, targetEnt: any) {
  if (source === 'caster') return casterEnt || targetEnt;
  return targetEnt || casterEnt;   // 'target'/'area'/default
}
// Canvas-space planar anchor: cell center + cell offset + corner spot (ground plane).
function _psPlanarAnchor(ent: any, a: any) {
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera?.zoom || 1));
  const live = (typeof _avtEntViva === 'function') ? _avtEntViva(ent) : ent;
  const gx = (live.renderX ?? live.x ?? 0) + (a.cell?.dx || 0);
  const gy = (live.renderY ?? live.y ?? 0) + (a.cell?.dy || 0);
  let x = Math.round(gx * SZ - AVT_STATE.camera.x + SZ / 2);
  let y = Math.round(gy * SZ - AVT_STATE.camera.y + SZ / 2);
  const h = SZ / 2;
  switch (a.spot) {
    case 'nw': x -= h; y -= h; break;
    case 'ne': x += h; y -= h; break;
    case 'sw': x -= h; y += h; break;
    case 'se': x += h; y += h; break;
  }
  return { x, y };
}
// Vertical lift in SCREEN px from z/zFrac. Only meaningful when billboard is on; 0 otherwise.
function _psAnchorLift(a: any) {
  if (!_avtVfxBillboardOn()) return 0;
  let frac;
  if (typeof a.zFrac === 'number') frac = a.zFrac;
  else if (a.z && _PS_Z_FRAC[a.z] != null) frac = _PS_Z_FRAC[a.z];
  else frac = _PS_CHEST_FRAC;        // iso default: launch from the chest
  return frac * _avtVfxTokenPx();
}
// Shared resolver: anchor config + entities → { x, y, lift, pose }.  x/y in canvas coords.
function _avtResolveAnchor(anchorCfg: any, casterEnt: any, targetEnt: any, fallbackSource: any) {
  const a = _psNormAnchor(anchorCfg, fallbackSource);
  let planar;
  if (a.source === 'mid') {
    const pc = _psPlanarAnchor(casterEnt || targetEnt, a);
    const pt = _psPlanarAnchor(targetEnt || casterEnt, a);
    planar = { x: (pc.x + pt.x) / 2, y: (pc.y + pt.y) / 2 };
  } else {
    planar = _psPlanarAnchor(_psSourceEnt(a.source, casterEnt, targetEnt), a);
  }
  return { x: planar.x, y: planar.y, lift: _psAnchorLift(a), pose: a.pose, norm: a };
}

// Span mapper: leva pontos de TRAJETO (espaço canvas) para o espaço local de um root
// billboardado ancorado em `pivot` — P → pivot + M·(P − pivot), M = projeção iso direta.
// Um billboard interpreta offsets como pixels de TELA (CSS∘billboard = identidade para
// vetores), então endpoints/lerps de voo precisam ser projetados para caírem sobre os
// tokens projetados. Identidade quando o root NÃO é billboardado (topdown, vfxBillboard
// off, pose 'floor') — nesses casos o CSS já projeta as coords cruas e projetar aqui
// dobraria a transformação. Offsets decorativos (keyframes, layer.offset, lift) NÃO
// passam por aqui: devem ler como pixels de tela.
function _avtVfxSpanFns(pose: any, pivot: any) {
  const bb = _avtVfxBillboardOn() && pose !== 'floor'
    && typeof _avtIsoDeltaToScreen === 'function';
  if (!bb) return { bb: false, pt: (p: any) => p, delta: (dx: any, dy: any) => ({ x: dx, y: dy }) };
  return {
    bb: true,
    pt: (p: any) => { const d = _avtIsoDeltaToScreen(p.x - pivot.x, p.y - pivot.y);
                 return { x: pivot.x + d.x, y: pivot.y + d.y }; },
    delta: (dx: any, dy: any) => _avtIsoDeltaToScreen(dx, dy),
  };
}

// Build a PIXI container wired for the current graphics mode and add it to `stage`.
// Returns the CONTENT container — add display objects to it using ABSOLUTE canvas
// coords (same coords as top-down). In iso+billboard the content is counter-transformed
// around `anchor` so it appears upright, and lifted by `lift` screen px (chest height).
// pose:'floor' skips the billboard so content lies in the (CSS-skewed) ground plane.
function _avtVfxRoot(stage: any, pose: any, anchor: any, lift: any) {
  const billboard = _avtVfxBillboardOn() && pose !== 'floor';
  if (!billboard) {
    // top-down, billboard off, or floor pose: content rendered in place. A non-floor
    // lift (rare: iso w/ billboard off) is applied directly in screen space.
    const c = new PIXI.Container();
    if (pose !== 'floor' && lift && !_avtVfxIsoOn()) c.position.set(0, 0); // top-down: no vertical
    stage.addChild(c);
    return c;
  }
  const k = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  const inv2k = 1 / (2 * k);
  const bb = new PIXI.Container();
  const ax = anchor ? anchor.x : 0, ay = anchor ? anchor.y : 0;
  bb.pivot.set(ax, ay);
  bb.position.set(ax, ay);
  if (pose === 'leaning') {
    bb.skew.set(Math.PI / 4 * _PS_LEAN, -Math.PI / 4 * _PS_LEAN);
    bb.scale.set(1 + (inv2k * Math.SQRT2 - 1) * _PS_LEAN, 1 + (inv2k * Math.SQRT2 / cosX - 1) * _PS_LEAN);
  } else {
    bb.skew.set(Math.PI / 4, -Math.PI / 4);
    bb.scale.set(inv2k * Math.SQRT2, inv2k * Math.SQRT2 / cosX);
  }
  // Lift is applied in billboard-local space; since CSS∘billboard = identity for vectors,
  // a local (0,-lift) appears as exactly (0,-lift) screen px (up the body).
  const content = new PIXI.Container();
  content.position.set(0, -(lift || 0));
  bb.addChild(content);
  stage.addChild(bb);
  return content;
}

// Tracked variant of _avtVfxRoot for follow/persistent effects: the pivot moves with the
// entity each frame. Returns { content, update(scr, lift) }. Add objects to `content` using
// absolute canvas coords; call update() per frame with the tracked screen position.
function _avtVfxTrackedRoot(stage: any, pose: any) {
  const billboard = _avtVfxBillboardOn() && pose !== 'floor';
  if (!billboard) {
    const c = new PIXI.Container();
    stage.addChild(c);
    return { content: c, update: () => {} };
  }
  const k = _ISO_SCALE / Math.SQRT2;
  const cosX = Math.cos(_ISO_ANGLE_X * Math.PI / 180);
  const inv2k = 1 / (2 * k);
  const bb = new PIXI.Container();
  bb.skew.set(Math.PI / 4, -Math.PI / 4);
  bb.scale.set(inv2k * Math.SQRT2, inv2k * Math.SQRT2 / cosX);
  const content = new PIXI.Container();
  bb.addChild(content);
  stage.addChild(bb);
  return {
    content,
    update: (scr: any, lift: any) => { bb.pivot.set(scr.x, scr.y); bb.position.set(scr.x, scr.y); content.position.set(0, -(lift || 0)); },
  };
}

// Draw a clawed-hand silhouette into a Graphics, sized ~r, reaching UP (fingertips at -y,
// wrist at +y), origin at the palm center. Issued between the caller's beginFill/endFill so it
// fills + strokes like other shapes. Shared by the runtime and the studio preview.
function _psHandPath(g: any, r: any) {
  const palmW = r * 1.1, palmH = r * 1.05;
  // palm
  g.drawRoundedRect(-palmW / 2, -palmH * 0.1, palmW, palmH, r * 0.32);
  // four fingers (tapered claws) fanning upward
  const fx = [-0.42, -0.16, 0.12, 0.4];
  const fl = [0.95, 1.18, 1.12, 0.86];   // relative lengths
  for (let i = 0; i < 4; i++) {
    const bx = fx[i] * palmW;
    const tipx = bx + fx[i] * r * 0.5;     // fan outward
    const topy = -palmH * 0.1 - fl[i] * r;
    const wb = r * 0.18;                    // base half-width
    g.drawPolygon([bx - wb, -palmH * 0.05, bx + wb, -palmH * 0.05, tipx + wb * 0.35, topy + r * 0.12, tipx, topy, tipx - wb * 0.35, topy + r * 0.12]);
  }
  // thumb (to the left, lower)
  g.drawPolygon([-palmW * 0.5, palmH * 0.5, -palmW * 0.5 - r * 0.1, palmH * 0.18, -palmW * 0.95, -r * 0.05, -palmW * 0.78, palmH * 0.2, -palmW * 0.5, palmH * 0.62]);
}

// Draw a beam (glow + bright core + tip flare) from A to B in the Graphics' local space.
// `len` (0..1) controls how far the beam currently extends from A toward B.
function _psBeamPath(g: any, A: any, B: any, thick: any, color: any, alpha: any, len: any, hexInt: any) {
  const bx = A.x + (B.x - A.x) * len, by = A.y + (B.y - A.y) * len;
  const col = hexInt(color || '#ffffff');
  g.lineStyle(thick * 2.4, col, alpha * 0.25); g.moveTo(A.x, A.y); g.lineTo(bx, by);   // outer glow
  g.lineStyle(thick, col, alpha * 0.8);         g.moveTo(A.x, A.y); g.lineTo(bx, by);   // mid
  g.lineStyle(Math.max(1, thick * 0.4), 0xffffff, alpha); g.moveTo(A.x, A.y); g.lineTo(bx, by); // white core
  g.beginFill(col, alpha * 0.9); g.drawCircle(bx, by, thick * 1.1); g.endFill();        // tip flare
}

// ── Convert Studio config_json layers → AVT particle config format ─────────
function _psToAvtConfig(cfg: any) {
  if (!cfg) return null;
  const low = cfg.quality === 'baixo';   // mobile/low quality: lighter particles, no bloom/trails
  const avt = {
    duration:   cfg.duracao_ms || cfg.duration || 1000,
    lighting:   low ? Object.assign({}, cfg.lighting, { bloom: null }) : (cfg.lighting || {}),
    camera:     cfg.camera       || {},
    background: cfg.background   || {},
    filters:    cfg.filters      || [],
    travel:     cfg.travel       || null,
    iso_scale:     (typeof cfg.iso_scale === 'number') ? cfg.iso_scale : undefined,
    iso_lift_frac: (typeof cfg.iso_lift_frac === 'number') ? cfg.iso_lift_frac : undefined,
    anchor:        cfg.anchor || undefined,
    layers: [] as any[],
  };
  const layers = cfg.layers || [];
  for (const l of layers) {
    if (!l.visivel) continue;
    if (l.tipo === 'emitter' && l.emitter) {
      let emitter = l.emitter;
      if (low) emitter = Object.assign({}, l.emitter, { maxParticles: Math.max(1, Math.ceil((l.emitter.maxParticles || 50) * 0.5)) });
      avt.layers.push({
        role:       l.nome || 'layer',
        texture:    l.texture_url ? null : (l.texture || 'spark'),
        textures:   l.texture_url ? [l.texture_url] : undefined,
        blendMode:  l.blendMode || 'add',
        z:          l.z ?? 3,
        glow:       l.glow || null,
        trail:      low ? null : (l.trail || l.trail_config || null),
        tint:       l.tint || null,
        parallax:   l.parallax || 0,
        lightCast:  l.lightCast || null,
        subEmitters: l.subEmitters || undefined,
        filters:    l.filters || undefined,
        offset:     l.offset || null,
        // Preserve per-layer origin so a layer that still falls through to the legacy
        // pipeline (e.g. combined with a global motion mode) keeps its anchor data.
        anchor:           l.anchor || null,
        posicao_override: l.posicao_override || null,
        pose:             l.pose || (l.anchor && l.anchor.pose) || undefined,
        emitter,
        spawn_path: l.spawn_path || null,
        start_t:    l.start_t    ?? 0,
        end_t:      l.end_t      ?? 1,
      });
    }
  }
  return avt;
}

// ── Load animation config (from cache or Supabase) ─────────────────────────
// Falhas/IDs inexistentes entram num cache negativo de 30s — sem ele, cada uso da
// skill re-batia na rede pelo mesmo ID quebrado.
const _PS_CFG_FAIL = new Map(); // animId -> ts da falha
async function _psAvtLoadCfg(animId: any) {
  if (!animId) return null;
  const failTs = _PS_CFG_FAIL.get(animId);
  if (failTs && Date.now() - failTs < 30000) return null;
  const cache = (typeof PIXI_STUDIO_STATE !== 'undefined') ? PIXI_STUDIO_STATE._animCache : null;
  if (cache && cache[animId]) return cache[animId];
  try {
    const rows = await _avtSb(`pixi_animations?id=eq.${encodeURIComponent(animId)}&select=config_json`);
    const cfg = rows && rows[0] && rows[0].config_json;
    if (cfg && cache) {
      cache[animId] = cfg;
      setTimeout(() => { delete cache[animId]; }, 30000);
    }
    if (!cfg) _PS_CFG_FAIL.set(animId, Date.now());
    else _PS_CFG_FAIL.delete(animId);
    return cfg || null;
  } catch (e) {
    console.warn('[pixi-studio-avt] Failed to load anim', animId, e);
    _PS_CFG_FAIL.set(animId, Date.now());
    return null;
  }
}

// ── Delay de viagem SÍNCRONO de uma animação do Studio ─────────────────────
// avtPixiPlayAnimation é async (o cfg pode vir da rede), mas _avtPlaySkillAnim
// e os callers que agendam animação de morte são síncronos. Quando o cfg já está
// no cache de 30s, devolve o mesmo delay que _psAvtProjectile retornaria; sem
// cache devolve null (desconhecido) e o caller usa 0 como hoje.
function avtPixiGetAnimDelaySync(animId: any) {
  const cache = (typeof PIXI_STUDIO_STATE !== 'undefined') ? PIXI_STUDIO_STATE._animCache : null;
  const cfg = cache && animId ? cache[animId] : null;
  if (!cfg) return null;
  if ((cfg.behavior || 'one-shot') !== 'projectile') return 0;
  const hasSpawnPath = (cfg.layers || []).some((l: any) => l.tipo === 'emitter' && l.spawn_path?.length);
  if (hasSpawnPath || (cfg.travel?.path && cfg.travel.path !== 'linear'))
    return cfg.duracao_ms || cfg.duration || 1000; // espelha _psAvtProjectile (spawn_path/curvo)
  return cfg.behavior_config?.projectile_speed_ms || 500; // espelha o caminho linear
}

// ── Build screen coordinates from entity (mirrors _avtPlaySkillAnim) ───────
function _psAvtToScreen(ent: any) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return { x: canvas ? canvas.width / 2 : 400, y: canvas ? canvas.height / 2 : 300 };
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const live = typeof _avtEntViva === 'function' ? _avtEntViva(ent) : ent;
  return {
    x: Math.round((live.renderX ?? live.x) * SZ - AVT_STATE.camera.x + SZ / 2),
    y: Math.round((live.renderY ?? live.y) * SZ - AVT_STATE.camera.y + SZ / 2),
  };
}

// ── Live travel endpoints (caster→target) re-read each frame ───────────────
// A projectile must always fly from the caster token's CURRENT position to the
// target token's CURRENT position — never to a stale point captured at fire time.
// Falls back to the frozen screen coords when no live entity is available.
function _psAvtLiveEnds(casterEnt: any, targetEnt: any, fbA: any, fbB: any) {
  return {
    atac: casterEnt ? _psAvtToScreen(casterEnt) : fbA,
    alvo: targetEnt ? _psAvtToScreen(targetEnt) : fbB,
  };
}

// ── Interpolate keyframes at time t ───────────────────────────────────────
function _psAvtInterpKf(kfs: any, t: any) {
  if (!kfs || !kfs.length) return null;
  if (t <= kfs[0].t) return Object.assign({}, kfs[0]);
  if (t >= kfs[kfs.length - 1].t) return Object.assign({}, kfs[kfs.length - 1]);
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].t && t <= kfs[i + 1].t) {
      const fRaw = (t - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      // Apply per-keyframe easing (owned by the outgoing keyframe). Default linear.
      const f = (typeof window !== 'undefined' && window._psEase)
        ? window._psEase(kfs[i].ease || 'linear', fRaw) : fRaw;
      const lerp = (a: any, b: any) => a + (b - a) * f;
      return {
        x:        lerp(kfs[i].x        ?? 0, kfs[i + 1].x        ?? 0),
        y:        lerp(kfs[i].y        ?? 0, kfs[i + 1].y        ?? 0),
        alpha:    lerp(kfs[i].alpha    ?? 1, kfs[i + 1].alpha    ?? 1),
        scale:    lerp(kfs[i].scale    ?? 1, kfs[i + 1].scale    ?? 1),
        rotation: lerp(kfs[i].rotation ?? 0, kfs[i + 1].rotation ?? 0),
      };
    }
  }
  return null;
}

// ── Render sprite layers (tipo:'sprite') as animated PIXI sprites ──────────
// behavior: 'projectile' → sprite travels startScr→endScr over durMs
//           other        → sprite anchors at the layer anchor + keyframe offsets
// In iso each layer is wrapped in a pose-aware root (upright/floor) and lifted to its
// configured height (chest by default); sizes are auto-scaled for the graphics mode.
async function _psAvtRenderSprites(cfg: any, startScr: any, endScr: any, behavior: any, casterEnt: any, targetEnt: any) {
  const spriteLayers = (cfg.layers || []).filter((l: any) => l.visivel && l.tipo === 'sprite' && l.texture_url);
  if (!spriteLayers.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const vfxScale = _avtVfxScale(cfg);
  const acq = _psAvtAcquireApp();
  if (!acq) return;
  const app = acq.app;

  const bmMap: Record<string, any> = {
    add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN,
    multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL,
  };

  const isProjectile = behavior === 'projectile';
  const midScr = { x: (startScr.x + endScr.x) / 2, y: (startScr.y + endScr.y) / 2 };

  const sprites: any = [];
  for (const l of spriteLayers) {
    try {
      // Anchor: trajectory pivots at the travel midpoint; otherwise the layer's own anchor.
      const anchor = _psAvtLayerAnchor(l, startScr, endScr, casterEnt, targetEnt);
      const pivot = isProjectile ? midScr : { x: anchor.x, y: anchor.y };
      const span = _avtVfxSpanFns(anchor.pose, pivot);
      const root = _avtVfxRoot(app.stage, anchor.pose, pivot, anchor.lift);
      const tex = _psAvtTexFrom(l.texture_url);
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.blendMode = bmMap[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      root.addChild(sp);
      sprites.push({ sp, layer: l, anchor, span });
    } catch (e) {
      console.warn('[pixi-studio-avt] Sprite texture error', l.texture_url, e);
    }
  }

  // Rotation offset is recomputed per frame for projectiles (the travel axis tracks
  // the live tokens); studio reference axis is constant.
  const dx_s = _PS_ALVO_REF.x - _PS_ATAC_REF.x;
  const dy_s = _PS_ALVO_REF.y - _PS_ATAC_REF.y;

  const startMs = performance.now();

  const tick = () => {
    const elapsed = performance.now() - startMs;
    const t = Math.min(elapsed / durMs, 1);
    // Projectiles re-acquire the live caster/target each frame so they always fly
    // between the tokens' current positions, never the ones captured at fire time.
    const ends = isProjectile ? _psAvtLiveEnds(casterEnt, targetEnt, startScr, endScr) : null;
    const sScr = ends ? ends.atac : startScr;
    const eScr = ends ? ends.alvo : endScr;
    // Duas variantes de rotação: layers billboardados leem offsets como pixels de TELA,
    // então o heading deve vir do delta PROJETADO; layers não-billboardados usam o delta
    // cru (o CSS projeta o desenho inteiro). A escolha é por layer (span.bb) — não
    // recolapsar num único rotOffset.
    const dxr = eScr.x - sScr.x, dyr = eScr.y - sScr.y;
    const rotRaw = isProjectile ? Math.atan2(dyr, dxr) - Math.atan2(dy_s, dx_s) : 0;
    const dpr = (isProjectile && typeof _avtIsoDeltaToScreen === 'function')
      ? _avtIsoDeltaToScreen(dxr, dyr) : null;
    const rotBB = dpr ? Math.atan2(dpr.y, dpr.x) - Math.atan2(dy_s, dx_s) : rotRaw;
    for (const { sp, layer, anchor, span } of sprites) {
      const st = layer.start_t ?? 0;
      const et = layer.end_t   ?? 1;
      sp.visible = (t >= st && t <= et);
      if (!sp.visible) continue;
      const tRel = et > st ? (t - st) / (et - st) : t;

      const bs = layer.base_scale ?? 1;
      const kf = _psAvtInterpKf(layer.keyframes, tRel);
      if (!kf) continue;

      if (isProjectile) {
        // Map studio-space keyframe position → screen-space via similarity transform.
        // Endpoints já mapeados pelo span (billboard: projetados; senão: crus) — a
        // similaridade passa a operar direto no espaço em que o layer desenha.
        const scrPos = _psStudioToScreen(kf.x ?? 0, kf.y ?? 0, span.pt(sScr), span.pt(eScr));
        sp.x = scrPos.x;
        sp.y = scrPos.y;
      } else {
        sp.x = anchor.x + (kf.x ?? 0) * vfxScale;
        sp.y = anchor.y + (kf.y ?? 0) * vfxScale;
      }

      const sv = (kf.scale ?? 1) * bs * vfxScale;
      sp.scale.x = sv * (layer.flip_x ? -1 : 1);
      sp.scale.y = sv * (layer.flip_y ? -1 : 1);
      sp.alpha    = kf.alpha    ?? 1;
      sp.rotation = ((kf.rotation ?? 0) * Math.PI) / 180 + (span.bb ? rotBB : rotRaw);
    }
  };

  app.ticker.add(tick);

  _psAvtTrack(() => {
    try { app.ticker.remove(tick); } catch (_) {}
    acq.destroy();
  }, durMs + 200);
}

// Generic keyframe interpolation (handles shape/light fields + easing)
function _psAvtInterpGeneric(kfs: any, t: any) {
  if (!kfs || !kfs.length) return null;
  const s = [...kfs].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return Object.assign({}, s[0]);
  if (t >= s[s.length - 1].t) return Object.assign({}, s[s.length - 1]);
  let lo = s[0], hi = s[1];
  for (let i = 0; i < s.length - 1; i++) { if (t >= s[i].t && t <= s[i + 1].t) { lo = s[i]; hi = s[i + 1]; break; } }
  let f = (hi.t - lo.t) ? (t - lo.t) / (hi.t - lo.t) : 0;
  if (typeof window !== 'undefined' && window._psEase) f = window._psEase(lo.ease || 'linear', f);
  const out: Record<string, any> = {};
  new Set([...Object.keys(lo), ...Object.keys(hi)]).forEach(k => {
    if (k === 't' || k === 'ease') return;
    const a = lo[k], b = hi[k];
    out[k] = (typeof a === 'number' && typeof b === 'number') ? a + (b - a) * f : a;
  });
  return out;
}

// ── Render shape + light layers in combat (parity with the studio preview) ────
async function _psAvtRenderShapes(cfg: any, startScr: any, endScr: any, behavior: any, casterEnt: any, targetEnt: any) {
  const layers = (cfg.layers || []).filter((l: any) => l.visivel && (l.tipo === 'shape' || l.tipo === 'light'));
  if (!layers.length) return;
  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const vfxScale = _avtVfxScale(cfg);
  const acq = _psAvtAcquireApp();
  if (!acq) return;
  const app = acq.app;

  const bm: Record<string, any> = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };
  const hexInt = (c: any) => { if (typeof c === 'number') return c; const n = parseInt(String(c).replace('#', ''), 16); return isNaN(n) ? 0xffffff : n; };
  const isProj = behavior === 'projectile';
  const midScr = { x: (startScr.x + endScr.x) / 2, y: (startScr.y + endScr.y) / 2 };
  const items: any = [];
  for (const l of layers) {
    const anchor = _psAvtLayerAnchor(l, startScr, endScr, casterEnt, targetEnt);
    const pivot = isProj ? midScr : { x: anchor.x, y: anchor.y };
    const span = _avtVfxSpanFns(anchor.pose, pivot);
    const root = _avtVfxRoot(app.stage, anchor.pose, pivot, anchor.lift);
    if (l.tipo === 'shape') {
      const g = new PIXI.Graphics();
      g.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      root.addChild(g); items.push({ g, layer: l, anchor, span });
    } else {
      const sp = new PIXI.Sprite(typeof _avtProcTextures === 'function' ? _avtProcTextures('glow') : PIXI.Texture.WHITE);
      sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
      root.addChild(sp); items.push({ sp, layer: l, anchor, span });
    }
  }

  const startMs = performance.now();
  const tick = () => {
    const t = Math.min((performance.now() - startMs) / durMs, 1);
    // Projectile shapes/beams track the live caster/target each frame (never stale).
    const ends = isProj ? _psAvtLiveEnds(casterEnt, targetEnt, startScr, endScr) : null;
    const sScr = ends ? ends.atac : startScr;
    const eScr = ends ? ends.alvo : endScr;
    for (const it of items) {
      const l = it.layer;
      // Lerp de voo mapeado pelo span (billboard: projetado p/ cair na tela sobre os
      // tokens; senão: identidade). Anchor estático = pivô do span → inalterado.
      let anchorX, anchorY;
      if (isProj) {
        const ap = it.span.pt({ x: sScr.x + (eScr.x - sScr.x) * t, y: sScr.y + (eScr.y - sScr.y) * t });
        anchorX = ap.x; anchorY = ap.y;
      } else {
        anchorX = it.anchor.x; anchorY = it.anchor.y;
      }
      const st = l.start_t ?? 0, et = l.end_t ?? 1;
      const vis = t >= st && t <= et;
      const tRel = et > st ? (t - st) / (et - st) : t;
      const kf = _psAvtInterpGeneric(l.keyframes, tRel);
      if (it.g) {
        const g = it.g; g.visible = vis; if (!vis || !kf) continue;
        g.clear();
        const sw = kf.stroke_width ?? 2, sa = kf.stroke_alpha ?? 1, fa = kf.fill_alpha ?? 0, r = (kf.radius ?? 20) * vfxScale;
        if (l.shape_type === 'beam') {
          // Beam spans caster→target (chest height via the root lift); `len` extends it.
          // Endpoints mapeados pelo span p/ o feixe ligar os tokens projetados na tela.
          g.position.set(0, 0);
          _psBeamPath(g, it.span.pt(sScr), it.span.pt(eScr), Math.max(2, r), kf.stroke_color || '#ffffff', sa, kf.len ?? 1, hexInt);
        } else {
          g.position.set(anchorX + (kf.x || 0) * vfxScale, anchorY + (kf.y || 0) * vfxScale);
          if (sa > 0) g.lineStyle(sw, hexInt(kf.stroke_color || '#ffffff'), sa);
          if (fa > 0) g.beginFill(hexInt(kf.fill_color || '#ffffff'), fa);
          if (l.shape_type === 'rect') g.drawRect(-r, -r, r * 2, r * 2);
          else if (l.shape_type === 'hand') { if (!(fa > 0)) g.beginFill(hexInt(kf.fill_color || kf.stroke_color || '#ffffff'), 0.9); _psHandPath(g, r); }
          else if (l.shape_type === 'polygon') {
            const sides = Math.max(3, l.sides || 6), pts = [];
            for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
            g.drawPolygon(pts);
          } else g.drawCircle(0, 0, r);
          if (fa > 0 || l.shape_type === 'hand') g.endFill();
        }
      } else {
        const sp = it.sp; sp.visible = vis; if (!vis || !kf) continue;
        const r = (kf.radius ?? 60) * vfxScale;
        sp.width = sp.height = r * 2;
        sp.position.set(anchorX + (kf.x || 0) * vfxScale, anchorY + (kf.y || 0) * vfxScale);
        sp.alpha = kf.alpha ?? 0.7;
        sp.tint = hexInt(kf.color || l.color || '#ffffff');
      }
    }
  };
  app.ticker.add(tick);
  _psAvtTrack(() => {
    try { app.ticker.remove(tick); } catch (_) {}
    acq.destroy();
  }, durMs + 200);
}

// Resolve a layer's effective anchor → { x, y, lift, pose }.
// Prefers the new per-layer `anchor` model; otherwise falls back to legacy
// `posicao_override` (screen point) plus the default chest lift in iso.
function _psAvtLayerAnchor(layer: any, atacScr: any, alvoScr: any, casterEnt: any, targetEnt: any) {
  if (layer && layer.anchor) {
    const fb = layer.posicao_override === 'atacante' ? 'caster'
             : layer.posicao_override === 'meio'     ? 'mid' : 'target';
    return _avtResolveAnchor(layer.anchor, casterEnt, targetEnt, fb);
  }
  const pos = layer && layer.posicao_override;
  let pt;
  if (pos === 'atacante')   pt = atacScr;
  else if (pos === 'meio')  pt = { x: (atacScr.x + alvoScr.x) / 2, y: (atacScr.y + alvoScr.y) / 2 };
  else                      pt = alvoScr;   // 'alvo' / default
  return { x: pt.x, y: pt.y, lift: _avtVfxBillboardOn() ? _PS_CHEST_FRAC * _avtVfxTokenPx() : 0, pose: 'upright' };
}

// Scale an emitter config (v2 list-style or v5 behaviors) by `s` in screen space.
function _avtScaleEmitterCfg(cfg: any, s: any) {
  if (!cfg || !(s > 0) || s === 1) return cfg;
  let c; try { c = JSON.parse(JSON.stringify(cfg)); } catch (_) { return cfg; }
  const scaleList = (o: any) => { if (o && Array.isArray(o.list)) o.list.forEach((p: any) => { if (typeof p.value === 'number') p.value *= s; }); };
  // v2 list-style
  if (c.scale) scaleList(c.scale);
  if (c.speed) { if (typeof c.speed.start === 'number') c.speed.start *= s; if (typeof c.speed.end === 'number') c.speed.end *= s; }
  if (c.acceleration) { if (typeof c.acceleration.x === 'number') c.acceleration.x *= s; if (typeof c.acceleration.y === 'number') c.acceleration.y *= s; }
  if (c.spawnCircle) { if (typeof c.spawnCircle.r === 'number') c.spawnCircle.r *= s; }
  if (c.spawnRect) { ['x','y','w','h'].forEach(k => { if (typeof c.spawnRect[k] === 'number') c.spawnRect[k] *= s; }); }
  // v5 behaviors
  if (Array.isArray(c.behaviors)) {
    for (const b of c.behaviors) {
      if (!b || !b.config) continue;
      if (b.type === 'scale' || b.type === 'scaleStatic') { scaleList(b.config.scale); ['min','max'].forEach(k => { if (typeof b.config[k] === 'number') b.config[k] *= s; }); }
      if (b.type === 'moveSpeed' || b.type === 'moveSpeedStatic') { scaleList(b.config.speed); ['min','max'].forEach(k => { if (typeof b.config[k] === 'number') b.config[k] *= s; }); }
      if (typeof b.type === 'string' && b.type.startsWith('spawnShape') && b.config.data) {
        const d = b.config.data; ['radius','w','h','x','y'].forEach(k => { if (typeof d[k] === 'number') d[k] *= s; });
      }
    }
  }
  return c;
}

// ── Render emitter layers following their recorded spawn_path ─────────────────
// Uses a similarity transform to map studio-space → screen-space. Each layer is wrapped
// in a pose-aware iso root (upright/floor) and lifted to its configured height.
async function _psAvtRenderWithSpawnPath(cfg: any, atacScr: any, alvoScr: any, casterEnt: any, targetEnt: any) {
  const layers = (cfg.layers || []).filter((l: any) => l.emitter);
  if (!layers.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  // Lazy-load any scene/layer filter classes before building (bloom, glow, user filters,
  // chromatic aberration) so the scene-level look matches the legacy pipeline.
  if (typeof _avtEnsurePixiFilter === 'function') {
    const filterTypes = new Set();
    const collectF = (o: any) => { if (Array.isArray(o && o.filters)) o.filters.forEach((f: any) => f && f.type && filterTypes.add(f.type)); };
    collectF(cfg); layers.forEach(collectF);
    layers.forEach((l: any) => { if (l.glow) filterTypes.add('glow'); });
    if (cfg.lighting && cfg.lighting.bloom) filterTypes.add('bloom');
    if (cfg.camera && cfg.camera.chromaticAberration) filterTypes.add('rgbsplit');
    try { await Promise.all([...filterTypes].map(t => _avtEnsurePixiFilter(t))); } catch (_) {}
  }

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const vfxScale = _avtVfxScale(cfg);
  const midScr = { x: (atacScr.x + alvoScr.x) / 2, y: (atacScr.y + alvoScr.y) / 2 };
  const acq = _psAvtAcquireApp();
  if (!acq) return;
  const app = acq.app;

  // Scene tree mirrors _avtPixiParticleAnim so routed animations keep their scene-level look:
  //   bgRoot (full-screen dim, behind) < sceneRoot (all layers; carries bloom/tone + shake)
  //   < uiRoot (camera flash / chromatic aberration).
  const bgRoot    = new PIXI.Container();
  const sceneRoot = new PIXI.Container();
  const uiRoot    = new PIXI.Container();
  app.stage.addChild(bgRoot, sceneRoot, uiRoot);

  // Background dim / vignette (full screen, behind the effects)
  const bgDim = _psBuildBackgroundDim(app, cfg.background);
  if (bgDim) bgRoot.addChild(bgDim);

  // Scene-level lighting (bloom + tone) + user filters, applied to the whole effect.
  const sceneFilters = [];
  if (cfg.lighting && cfg.lighting.bloom && PIXI.filters && PIXI.filters.AdvancedBloomFilter) {
    const b = cfg.lighting.bloom;
    sceneFilters.push(new PIXI.filters.AdvancedBloomFilter({
      threshold: b.threshold ?? 0.4, bloomScale: b.intensity ?? 1.5,
      brightness: 1.0, blur: 8, quality: b.quality ?? 6,
    }));
  }
  if (cfg.lighting && cfg.lighting.tone && cfg.lighting.tone !== 'none' && PIXI.ColorMatrixFilter) {
    const cm = new PIXI.ColorMatrixFilter();
    if (cfg.lighting.tone === 'filmic') { cm.contrast(0.15, true); cm.saturate(0.12, true); cm.brightness(1.04, true); }
    else if (cfg.lighting.tone === 'aces') { cm.contrast(0.22, true); cm.saturate(0.18, true); cm.brightness(1.06, true); cm.hue(-4, true); }
    sceneFilters.push(cm);
  }
  if (typeof _avtBuildPixiFilters === 'function') sceneFilters.push(..._avtBuildPixiFilters(cfg.filters, sceneRoot));
  if (sceneFilters.length) sceneRoot.filters = sceneFilters;

  const bm: Record<string, any> = {
    add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN,
    multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL,
  };

  const emitters: any = [];
  for (const l of layers) {
    const anchor = _psAvtLayerAnchor(l, atacScr, alvoScr, casterEnt, targetEnt);
    // spawn_path spans both tokens → pivot at the travel midpoint; static → the layer anchor.
    const pivot = l.spawn_path?.length ? midScr : { x: anchor.x, y: anchor.y };
    const span = _avtVfxSpanFns(anchor.pose, pivot);
    const root = _avtVfxRoot(sceneRoot, anchor.pose, pivot, anchor.lift);
    const container = new PIXI.Container();
    container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
    // Per-layer glow + tint + user filters (preserve the studio look)
    const layerFilters = (typeof _avtBuildPixiFilters === 'function') ? _avtBuildPixiFilters(l.filters, container) : [];
    if (l.glow && PIXI.filters && PIXI.filters.GlowFilter) {
      layerFilters.push(new PIXI.filters.GlowFilter({
        distance: l.glow.distance ?? 14, outerStrength: l.glow.outerStrength ?? 2,
        innerStrength: l.glow.innerStrength ?? 0,
        color: (typeof _avtHexToInt === 'function' ? _avtHexToInt(l.glow.color || '#ffffff') : 0xffffff),
        quality: l.glow.quality ?? 0.3,
      }));
    }
    if (l.tint && typeof _fxTintMatrix === 'function') { const tm = _fxTintMatrix(l.tint); if (tm) layerFilters.push(tm); }
    if (layerFilters.length) container.filters = layerFilters;
    root.addChild(container);

    let emitCfg = _avtScaleEmitterCfg(Object.assign({}, l.emitter), vfxScale);
    // We control emission timing manually; override auto-stop from emitterLifetime
    if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
    const tex = l.texture_url
      ? _psAvtTexFrom(l.texture_url)
      : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
    const texArr = [tex || PIXI.Texture.WHITE];
    if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) {
      try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {}
    }
    try {
      const em = new PIXI.particles.Emitter(container, emitCfg);
      // Initial position: start of spawn_path or the layer anchor
      const initPos = l.spawn_path?.length
        ? _psStudioToScreen(l.spawn_path[0].x ?? 0, l.spawn_path[0].y ?? 0, span.pt(atacScr), span.pt(alvoScr))
        : { x: anchor.x, y: anchor.y };
      em.updateSpawnPos(initPos.x, initPos.y);
      em.emit = false;
      emitters.push({ em, layer: l, anchor, span });
    } catch (_) {}
  }

  const startMs = performance.now();
  let lastTs = startMs;

  const tick = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000;
    lastTs = now;
    const t = Math.min((now - startMs) / durMs, 1);
    // Spawn-path emitters travel between the LIVE caster/target each frame: the
    // studio→screen similarity transform re-anchors on the tokens' current positions,
    // so the recorded path (origin offset preserved) always ends on the target token.
    const ends = _psAvtLiveEnds(casterEnt, targetEnt, atacScr, alvoScr);

    for (const { em, layer, anchor, span } of emitters) {
      if (em.destroyed) continue;
      const st = layer.start_t ?? 0, et = layer.end_t ?? 1;
      const inRange = t >= st && t <= et;
      em.emit = inRange;
      if (inRange && layer.spawn_path?.length) {
        const tRel = et > st ? (t - st) / (et - st) : 0;
        const sp = _psAvtInterpKf(layer.spawn_path, tRel);
        if (sp) {
          const pos = _psStudioToScreen(sp.x ?? 0, sp.y ?? 0, span.pt(ends.atac), span.pt(ends.alvo));
          em.updateSpawnPos(pos.x, pos.y);
        }
      } else if (inRange) {
        const ox = (layer.offset?.x || 0) * vfxScale, oy = (layer.offset?.y || 0) * vfxScale;
        em.updateSpawnPos(anchor.x + ox, anchor.y + oy);
      }
      em.update(delta);
    }
  };

  app.ticker.add(tick);

  // Camera FX (shake / flash / zoom punch / chromatic aberration) over the whole scene.
  let cleanupCam = null;
  if (typeof _avtCameraFX === 'function' && cfg.camera && Object.keys(cfg.camera).length) {
    try { cleanupCam = _avtCameraFX(app, sceneRoot, uiRoot, cfg.camera, durMs); } catch (_) {}
  }

  _psAvtTrack(() => {
    try { app.ticker.remove(tick); } catch (_) {}
    try { if (cleanupCam) cleanupCam(); } catch (_) {}
    for (const { em } of emitters) {
      try { if (!em.destroyed) em.destroy(); } catch (_) {}
    }
    acq.destroy();
  }, durMs + 300);
}

// ── Main public entry point ────────────────────────────────────────────────
// Returns: delay in ms (travel time for projectile behavior, else 0)
async function avtPixiPlayAnimation(animId: any, atacanteEnt: any, alvoEnt: any, isAreaMode: any) {
  const cfg = await _psAvtLoadCfg(animId);
  if (!cfg || !cfg.layers || !cfg.layers.length) return 0;

  const alvoScr   = _psAvtToScreen(alvoEnt || atacanteEnt);
  const atacScr   = atacanteEnt ? _psAvtToScreen(atacanteEnt) : alvoScr;
  const behavior  = cfg.behavior || 'one-shot';
  const durMs     = cfg.duracao_ms || cfg.duration || 1000;
  const posicao   = isAreaMode ? 'area' : (cfg.posicao || 'alvo');

  // Play audio if present
  if (typeof AudioManager !== 'undefined' && cfg.audio) {
    const vol = cfg.audio.volume ?? 0.75;
    if (cfg.audio.cast)   AudioManager.playSFX(cfg.audio.cast,   { volume: vol });
    if (cfg.audio.impact) {
      const delay = (behavior === 'projectile') ? (cfg.behavior_config?.projectile_speed_ms || 500) : 0;
      if (delay > 0) setTimeout(() => AudioManager.playSFX(cfg.audio.impact, { volume: vol }), delay);
      else           AudioManager.playSFX(cfg.audio.impact, { volume: vol });
    }
  }

  // Separate layers with per-layer behavior_override (follow-caster/follow-target) from the rest
  const FOLLOW_OVR = ['follow-caster', 'follow-target', 'channel'];
  const overrideLayers = (cfg.layers || []).filter((l: any) => l.visivel && l.behavior_override && FOLLOW_OVR.includes(l.behavior_override));
  const mainLayers     = (cfg.layers || []).filter((l: any) => !(l.behavior_override && FOLLOW_OVR.includes(l.behavior_override)));
  // Render per-layer follow overrides immediately
  for (const ol of overrideLayers) {
    const singleCfg = Object.assign({}, cfg, { layers: [ol] });
    const followEnt = ol.behavior_override === 'follow-target' ? (alvoEnt || atacanteEnt) : atacanteEnt;
    _psAvtFollow(singleCfg, followEnt, durMs);
  }
  // Use filtered config for main rendering when there are overrides
  const mainCfg = overrideLayers.length ? Object.assign({}, cfg, { layers: mainLayers }) : cfg;
  if (!mainLayers.filter((l: any) => l.visivel).length && behavior !== 'chain') return 0;

  switch (behavior) {
    case 'projectile':
      return _psAvtProjectile(mainCfg, atacScr, alvoScr, alvoEnt, atacanteEnt);
    case 'follow-caster':
    case 'channel':
      _psAvtFollow(mainCfg, atacanteEnt, durMs);
      return 0;
    case 'follow-target':
      _psAvtFollow(mainCfg, alvoEnt, durMs);
      return 0;
    case 'chain':
      _psAvtChain(cfg, atacanteEnt, alvoEnt, isAreaMode);
      return 0;
    default: {
      // one-shot, loop, aoe — route static-origin effects (per-layer anchor and/or
      // recorded spawn_path) through the anchor-aware renderer so the configured
      // "Origem da animação" is honored. The legacy pipeline is kept only for the global
      // MOTION modes (trajetoria/espiral/raio/area/retorno) and phase envelopes, which the
      // anchor renderer has no concept of; for those the motion overrides the static origin.
      const emitterLayers = (mainCfg.layers || []).filter((l: any) => l.visivel && l.tipo === 'emitter' && l.emitter);
      const hasPath    = emitterLayers.some((l: any) => l.spawn_path?.length);
      const anyAnchor  = emitterLayers.some((l: any) => l.anchor);
      const legacyMotion = isAreaMode || ['trajetoria', 'espiral', 'raio', 'retorno', 'area'].includes(posicao);
      const hasPhases  = !!(cfg.phases || cfg.cast || cfg.travel || cfg.impact);
      const useAnchorRenderer = hasPath || (anyAnchor && !legacyMotion && !hasPhases);
      if (useAnchorRenderer) {
        _psAvtRenderWithSpawnPath(mainCfg, atacScr, alvoScr, atacanteEnt, alvoEnt);
      } else {
        const avtCfg = _psToAvtConfig(mainCfg);
        if (avtCfg && typeof _avtPixiParticleAnim === 'function') {
          _avtPixiParticleAnim(avtCfg, atacScr, alvoScr, posicao);
        }
      }
      _psAvtRenderSprites(mainCfg, atacScr, alvoScr, behavior, atacanteEnt, alvoEnt);
      _psAvtRenderShapes(mainCfg, atacScr, alvoScr, behavior, atacanteEnt, alvoEnt);
      return 0;
    }
  }
}

// ── Compute a point along a travel path between two screen points ──────────
function _psAvtPathPos(path: any, atac: any, alvo: any, t: any) {
  const x = atac.x + (alvo.x - atac.x) * t;
  const y = atac.y + (alvo.y - atac.y) * t;
  if (path === 'arc' || path === 'spiral') {
    const dx = alvo.x - atac.x, dy = alvo.y - atac.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;            // unit perpendicular
    if (path === 'arc') {
      const off = Math.sin(Math.PI * t) * Math.min(160, len * 0.35);
      return { x: x + nx * off, y: y + ny * off };
    }
    // spiral: shrinking corkscrew around the straight line
    const r = Math.sin(Math.PI * t) * 26, ang = t * Math.PI * 6;
    return { x: x + nx * Math.cos(ang) * r, y: y + ny * Math.cos(ang) * r - Math.sin(ang) * r };
  }
  return { x, y };  // linear / homing → straight toward the (possibly live) target
}

// ── Emitter projectile that follows a travel path (arc/spiral/homing) ──────
async function _psAvtRenderTravel(cfg: any, atacScr: any, alvoScr: any, path: any, alvoEnt: any, atacanteEnt: any) {
  const layers = (cfg.layers || []).filter((l: any) => l.visivel && l.tipo === 'emitter' && l.emitter);
  if (!layers.length) return;
  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const vfxScale = _avtVfxScale(cfg);
  const midScr = { x: (atacScr.x + alvoScr.x) / 2, y: (atacScr.y + alvoScr.y) / 2 };
  const acq = _psAvtAcquireApp();
  if (!acq) return;
  const app = acq.app;

  const bm: Record<string, any> = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };
  const emitters: any = [];
  for (const l of layers) {
    const anchor = _psAvtLayerAnchor(l, atacScr, alvoScr, atacanteEnt, alvoEnt);
    // O root billboarda no midpoint do trajeto — o span do layer usa o MESMO pivô.
    const span = _avtVfxSpanFns(anchor.pose, midScr);
    const root = _avtVfxRoot(app.stage, anchor.pose, midScr, anchor.lift);
    const container = new PIXI.Container();
    container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
    root.addChild(container);
    let emitCfg = _avtScaleEmitterCfg(Object.assign({}, l.emitter), vfxScale);
    if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
    const tex = l.texture_url ? _psAvtTexFrom(l.texture_url) : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
    const texArr = [tex || PIXI.Texture.WHITE];
    if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) { try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {} }
    try {
      const em = new PIXI.particles.Emitter(container, emitCfg);
      const p0 = span.pt(atacScr);
      em.updateSpawnPos(p0.x, p0.y);
      em.emit = false;
      emitters.push({ em, layer: l, span });
    } catch (_) {}
  }

  const startMs = performance.now();
  let lastTs = startMs;
  const tick = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000; lastTs = now;
    const t = Math.min((now - startMs) / durMs, 1);
    // Every path (linear/arc/spiral/homing) re-acquires the live caster and target each
    // frame, so the projectile always flies between the tokens' current positions.
    // O path é computado entre endpoints mapeados pelo span do layer: em billboard o
    // arco/wobble age em espaço de tela (lob arqueia para CIMA na tela) e o projétil
    // segue a reta projetada entre os tokens; sem billboard é idêntico ao anterior.
    const ends = _psAvtLiveEnds(atacanteEnt, alvoEnt, atacScr, alvoScr);
    for (const { em, layer, span } of emitters) {
      if (em.destroyed) continue;
      const st = layer.start_t ?? 0, et = layer.end_t ?? 1;
      const inRange = t >= st && t <= et;
      em.emit = inRange;
      if (inRange) {
        const pos = _psAvtPathPos(path, span.pt(ends.atac), span.pt(ends.alvo), t);
        em.updateSpawnPos(pos.x, pos.y);
      }
      em.update(delta);
    }
  };
  app.ticker.add(tick);
  _psAvtTrack(() => {
    try { app.ticker.remove(tick); } catch (_) {}
    for (const { em } of emitters) { try { if (!em.destroyed) em.destroy(); } catch (_) {} }
    acq.destroy();
  }, durMs + 300);
}

// ── Projectile: emitter travels from caster to target ─────────────────────
function _psAvtProjectile(cfg: any, atacScr: any, alvoScr: any, alvoEnt: any, atacanteEnt: any) {
  const hasSpawnPath = (cfg.layers || []).some((l: any) => l.tipo === 'emitter' && l.spawn_path?.length);

  // If any emitter layer has a recorded spawn_path, respect it exactly
  if (hasSpawnPath) {
    _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr, atacanteEnt, alvoEnt);
    _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);
    _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);
    return cfg.duracao_ms || cfg.duration || 1000;
  }

  // Curved travel (arc/spiral/homing): emitters fly along the computed path
  const path = cfg.travel?.path;
  if (path && path !== 'linear') {
    _psAvtRenderTravel(cfg, atacScr, alvoScr, path, alvoEnt, atacanteEnt);
    _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);
    _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);
    return cfg.duracao_ms || cfg.duration || 1000;
  }

  const speedMs = cfg.behavior_config?.projectile_speed_ms || 500;
  const dur     = cfg.duracao_ms || cfg.duration || 1200;
  const avtCfg  = _psToAvtConfig(cfg);
  if (!avtCfg) return 0;

  // Phase 1: cast anim at the caster's live position. background:null — as janelas
  // cast+impact se sobrepõem e o dim de fundo empilharia (2× o escurecimento);
  // só a fase de impacto carrega o background.
  if (typeof _avtPixiParticleAnim === 'function') {
    const castAtac = atacanteEnt ? _psAvtToScreen(atacanteEnt) : atacScr;
    _avtPixiParticleAnim(Object.assign({}, avtCfg, { duration: Math.min(400, speedMs), background: null }),
      castAtac, castAtac, 'atacante');
  }

  // Phase 2: impact anim at the target's live position after travel time (re-acquired
  // so it lands on the target token's current spot, never the one captured at fire time)
  setTimeout(() => {
    if (typeof _avtPixiParticleAnim === 'function') {
      const ends = _psAvtLiveEnds(atacanteEnt, alvoEnt, atacScr, alvoScr);
      _avtPixiParticleAnim(avtCfg, ends.atac, ends.alvo, 'alvo');
    }
  }, speedMs);

  // Sprite layers travel from attacker to target over the full duration
  _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);
  _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile', atacanteEnt, alvoEnt);

  return speedMs;
}

// ── Follow: emitter tracks an entity's screen position each frame ──────────
function _psAvtFollow(cfg: any, targetEnt: any, durMs: any) {
  if (!targetEnt || typeof PIXI === 'undefined') {
    // Fallback: just play at current position
    const scr = _psAvtToScreen(targetEnt);
    const avtCfg = _psToAvtConfig(cfg);
    if (avtCfg && typeof _avtPixiParticleAnim === 'function') {
      _avtPixiParticleAnim(avtCfg, scr, scr, 'atacante');
    }
    return;
  }

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  _avtEnsurePixiParticles().then(() => {
    const acq = _psAvtAcquireApp();
    if (!acq) return;
    const app = acq.app;

    const vfxScale = _avtVfxScale(cfg);
    const _followPose = (cfg.anchor && cfg.anchor.pose) || 'upright';
    const _followLift = _psAnchorLift(_psNormAnchor(cfg.anchor));
    const tracked = _avtVfxTrackedRoot(app.stage, _followPose);
    const worldRoot = tracked.content;

    const emitters: any = [];
    const bm: Record<string, any> = {
      add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN,
      multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL,
    };

    const startScr = _psAvtToScreen(targetEnt);

    for (const l of (cfg.layers || [])) {
      if (!l.visivel) continue;
      if (l.tipo === 'emitter' && l.emitter) {
        const container = new PIXI.Container();
        container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
        worldRoot.addChild(container);

        let emitCfg = _avtScaleEmitterCfg(Object.assign({}, l.emitter), vfxScale);
        if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
        const tex = l.texture_url
          ? _psAvtTexFrom(l.texture_url)
          : _avtProcTextures(l.texture || 'spark');
        const texArr = [tex || PIXI.Texture.WHITE];
        if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) {
          try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {}
        }
        const em = new PIXI.particles.Emitter(container, emitCfg);
        em.updateSpawnPos(startScr.x, startScr.y);
        em.emit = true;
        emitters.push(em);
      } else if (l.tipo === 'sprite' && l.texture_url) {
        try {
          const tex = _psAvtTexFrom(l.texture_url);
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5);
          sp.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
          const bs = (l.base_scale ?? 1) * vfxScale;
          sp.scale.x = bs * (l.flip_x ? -1 : 1);
          sp.scale.y = bs * (l.flip_y ? -1 : 1);
          sp.x = startScr.x;
          sp.y = startScr.y;
          worldRoot.addChild(sp);
          emitters.push({ _isSprite: true, sp, layer: l, startMs: performance.now(), durMs });
        } catch (e) {
          console.warn('[pixi-studio-avt] Follow sprite texture error', l.texture_url, e);
        }
      }
    }

    let lastTs = performance.now();
    const trackFn = () => {
      const now = performance.now();
      const delta = (now - lastTs) / 1000;
      lastTs = now;
      const scr = _psAvtToScreen(targetEnt);
      tracked.update(scr, _followLift);
      for (const em of emitters) {
        if (em._isSprite) {
          const t = Math.min((now - em.startMs) / em.durMs, 1);
          const kf = _psAvtInterpKf(em.layer.keyframes, t);
          if (kf) {
            const bs = (em.layer.base_scale ?? 1) * vfxScale;
            em.sp.x = scr.x + (kf.x ?? 0) * vfxScale;
            em.sp.y = scr.y + (kf.y ?? 0) * vfxScale;
            const sv = (kf.scale ?? 1) * bs;
            em.sp.scale.x = sv * (em.layer.flip_x ? -1 : 1);
            em.sp.scale.y = sv * (em.layer.flip_y ? -1 : 1);
            em.sp.alpha    = kf.alpha    ?? 1;
            em.sp.rotation = ((kf.rotation ?? 0) * Math.PI) / 180;
          }
        } else {
          if (!em.destroyed) { em.updateSpawnPos(scr.x, scr.y); em.update(delta); }
        }
      }
    };

    app.ticker.add(trackFn);

    _psAvtTrack(() => {
      try { app.ticker.remove(trackFn); } catch (_) {}
      for (const em of emitters) {
        if (em._isSprite) continue;
        try { if (!em.destroyed) em.destroy(); } catch (_) {}
      }
      acq.destroy();
    }, durMs + 200);
  });
}

// ── Chain behavior: play sequence of animations ────────────────────────────
function _psAvtChain(cfg: any, atacanteEnt: any, alvoEnt: any, isAreaMode: any) {
  const seq = cfg.behavior_config?.sequence || [];
  let delay = 0;
  for (const step of seq) {
    const stepDelay = delay;
    setTimeout(() => {
      if (step.animId) avtPixiPlayAnimation(step.animId, atacanteEnt, alvoEnt, isAreaMode);
    }, stepDelay);
    delay += (step.delay_ms || 0);
  }
}

// ── Persistent animation: plays indefinitely until explicitly stopped ─────────
// Used for status effects that last multiple turns (HoT, DoT, Atravessar, etc.)
// key: unique string (e.g. "entId_efeitoNome") to identify this animation
// posicao: 'alvo' | 'atacante' | 'meio' — which entity to follow
async function avtPixiPlayPersistent(animId: any, alvoEnt: any, casterEnt: any, posicao: any, key: any) {
  avtPixiStopPersistent(key);  // stop any existing animation for this key

  const cfg = await _psAvtLoadCfg(animId);
  if (!cfg || !cfg.layers?.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const primaryEnt = (posicao === 'atacante') ? (casterEnt || alvoEnt) : (alvoEnt || casterEnt);
  if (!primaryEnt) return;

  const acq = _psAvtAcquireApp();
  if (!acq) return;
  const app = acq.app;

  const vfxScale = _avtVfxScale(cfg);
  const _persistPose = (cfg.anchor && cfg.anchor.pose) || 'upright';
  const _persistLift = _psAnchorLift(_psNormAnchor(cfg.anchor));
  const tracked = _avtVfxTrackedRoot(app.stage, _persistPose);
  const worldRoot = tracked.content;
  const bm: Record<string, any> = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };
  const hexInt = (c: any) => { if (typeof c === 'number') return c; const n = parseInt(String(c).replace('#',''),16); return isNaN(n)?0xffffff:n; };

  // Resolve which entity each layer should track
  const _resolveLayerEnt = (l: any) => {
    const ov = l.behavior_override;
    if (ov === 'follow-caster' || ov === 'channel') return casterEnt || alvoEnt;
    if (ov === 'follow-target') return alvoEnt || casterEnt;
    return primaryEnt;
  };

  const cycleDurMs = cfg.duracao_ms || cfg.duration || 1000;
  const startScr = _psAvtToScreen(primaryEnt);
  const emitters: any = [];

  for (const l of (cfg.layers || [])) {
    if (!l.visivel) continue;
    const trackEnt = _resolveLayerEnt(l);
    if (l.tipo === 'emitter' && l.emitter) {
      const container = new PIXI.Container();
      container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      worldRoot.addChild(container);
      let emitCfg = Object.assign(_avtScaleEmitterCfg(Object.assign({}, l.emitter), vfxScale), { emitterLifetime: -1 });
      const tex = l.texture_url ? _psAvtTexFrom(l.texture_url) : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
      const texArr = [tex || PIXI.Texture.WHITE];
      if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) { try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {} }
      try {
        const em = new PIXI.particles.Emitter(container, emitCfg);
        em.updateSpawnPos(startScr.x, startScr.y);
        em.emit = true;
        emitters.push({ em, layer: l, trackEnt });
      } catch (_) {}
    } else if (l.tipo === 'sprite' && l.texture_url) {
      try {
        const tex = _psAvtTexFrom(l.texture_url);
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
        const bs = (l.base_scale ?? 1) * vfxScale;
        sp.scale.x = bs * (l.flip_x ? -1 : 1);
        sp.scale.y = bs * (l.flip_y ? -1 : 1);
        sp.x = startScr.x; sp.y = startScr.y;
        worldRoot.addChild(sp);
        emitters.push({ _isSprite: true, sp, layer: l, trackEnt, cycleStart: performance.now() });
      } catch (e) {}
    } else if (l.tipo === 'shape') {
      const g = new PIXI.Graphics();
      g.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      worldRoot.addChild(g);
      emitters.push({ _isShape: true, g, layer: l, trackEnt, cycleStart: performance.now() });
    } else if (l.tipo === 'light') {
      const sp = new PIXI.Sprite(typeof _avtProcTextures === 'function' ? _avtProcTextures('glow') : PIXI.Texture.WHITE);
      sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
      worldRoot.addChild(sp);
      emitters.push({ _isLight: true, sp, layer: l, trackEnt, cycleStart: performance.now() });
    }
  }

  let lastTs = performance.now();
  const startedPerf = performance.now();
  const PERSIST_TTL_MS = 5 * 60 * 1000; // teto de segurança contra efeitos órfãos
  const trackFn = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000;
    lastTs = now;
    // Auto-stop: entidade âncora saiu do jogo (morte/troca de fase sem o broadcast
    // de stop) ou TTL estourado → encerra sozinho em vez de rodar para sempre.
    if (!(trackFn as any)._nextCheck || now > (trackFn as any)._nextCheck) {
      (trackFn as any)._nextCheck = now + 2000;
      const sumiu = (typeof _avtEntById === 'function' && primaryEnt && primaryEnt.id != null)
        ? !_avtEntById(primaryEnt.id) : false;
      if (sumiu || (now - startedPerf) > PERSIST_TTL_MS) {
        try { avtPixiStopPersistent(key); } catch (_) {}
        return;
      }
    }
    tracked.update(_psAvtToScreen(primaryEnt), _persistLift);
    for (const em of emitters) {
      const scr = _psAvtToScreen(em.trackEnt || primaryEnt);
      if (em._isSprite) {
        // Loop keyframes using cycleDurMs
        const t = ((now - em.cycleStart) % cycleDurMs) / cycleDurMs;
        const kf = _psAvtInterpKf(em.layer.keyframes, t);
        if (kf) {
          const bs = (em.layer.base_scale ?? 1) * vfxScale;
          em.sp.x = scr.x + (kf.x ?? 0) * vfxScale;
          em.sp.y = scr.y + (kf.y ?? 0) * vfxScale;
          const sv = (kf.scale ?? 1) * bs;
          em.sp.scale.x = sv * (em.layer.flip_x ? -1 : 1);
          em.sp.scale.y = sv * (em.layer.flip_y ? -1 : 1);
          em.sp.alpha    = kf.alpha    ?? 1;
          em.sp.rotation = ((kf.rotation ?? 0) * Math.PI) / 180;
        }
      } else if (em._isShape) {
        const l = em.layer;
        const t = ((now - em.cycleStart) % cycleDurMs) / cycleDurMs;
        const st = l.start_t ?? 0, et = l.end_t ?? 1;
        const vis = t >= st && t <= et;
        const tRel = et > st ? (t - st) / (et - st) : t;
        const kf = _psAvtInterpGeneric(l.keyframes, tRel);
        const g = em.g; g.visible = vis;
        if (vis && kf) {
          g.clear();
          g.position.set(scr.x + (kf.x || 0) * vfxScale, scr.y + (kf.y || 0) * vfxScale);
          const sw = kf.stroke_width ?? 2, sa = kf.stroke_alpha ?? 1, fa = kf.fill_alpha ?? 0, r = (kf.radius ?? 20) * vfxScale;
          if (sa > 0) g.lineStyle(sw, hexInt(kf.stroke_color || '#ffffff'), sa);
          if (fa > 0) g.beginFill(hexInt(kf.fill_color || '#ffffff'), fa);
          if (l.shape_type === 'rect') g.drawRect(-r, -r, r * 2, r * 2);
          else if (l.shape_type === 'polygon') {
            const sides = Math.max(3, l.sides || 6), pts = [];
            for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
            g.drawPolygon(pts);
          } else g.drawCircle(0, 0, r);
          if (fa > 0) g.endFill();
        }
      } else if (em._isLight) {
        const l = em.layer;
        const t = ((now - em.cycleStart) % cycleDurMs) / cycleDurMs;
        const st = l.start_t ?? 0, et = l.end_t ?? 1;
        const vis = t >= st && t <= et;
        const tRel = et > st ? (t - st) / (et - st) : t;
        const kf = _psAvtInterpGeneric(l.keyframes, tRel);
        const sp = em.sp; sp.visible = vis;
        if (vis && kf) {
          const r = (kf.radius ?? 60) * vfxScale;
          sp.width = sp.height = r * 2;
          sp.position.set(scr.x + (kf.x || 0) * vfxScale, scr.y + (kf.y || 0) * vfxScale);
          sp.alpha = kf.alpha ?? 0.7;
          sp.tint = hexInt(kf.color || l.color || '#ffffff');
        }
      } else {
        if (!em.em.destroyed) { em.em.updateSpawnPos(scr.x, scr.y); em.em.update(delta); }
      }
    }
  };

  app.ticker.add(trackFn);

  let _persistDone = false;
  const cleanup = () => {
    if (_persistDone) return;
    _persistDone = true;
    try { app.ticker.remove(trackFn); } catch (_) {}
    for (const em of emitters) {
      if (!em.em) continue;  // só emitters têm em.em; graphics/sprites são destruídos pelo destroy do app
      try { if (!em.em.destroyed) em.em.destroy(); } catch (_) {}
    }
    acq.destroy();
    _PS_PERSISTENT.delete(key);
  };

  _PS_PERSISTENT.set(key, { cleanup });
}

function avtPixiStopPersistent(key: any) {
  const entry = _PS_PERSISTENT.get(key);
  if (entry) { entry.cleanup(); }
}

// ── Cleanup all active animations (one-shots, follow/channel E persistentes) ──
function avtPixiCleanupAll() {
  const entries = _PS_AVT_ACTIVE.slice();
  _PS_AVT_ACTIVE = [];
  for (const entry of entries) {
    clearTimeout(entry.timerId);
    try { if (entry.cleanup) entry.cleanup(); } catch (_) {}
  }
  // Persistentes: antes ficavam de fora do teardown global e viravam órfãos
  for (const key of [..._PS_PERSISTENT.keys()]) {
    try { avtPixiStopPersistent(key); } catch (_) {}
  }
}

window.avtPixiPlayAnimation    = avtPixiPlayAnimation;
window.avtPixiCleanupAll       = avtPixiCleanupAll;
window.avtPixiPlayPersistent   = avtPixiPlayPersistent;
window.avtPixiStopPersistent   = avtPixiStopPersistent;

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "_PS_AVT_ACTIVE", { configurable: true, get: () => _PS_AVT_ACTIVE, set: (__v) => { _PS_AVT_ACTIVE = __v; } });
Object.defineProperty(globalThis, "_PS_PERSISTENT", { configurable: true, get: () => _PS_PERSISTENT, set: (__v) => { _PS_PERSISTENT = __v; } });
Object.defineProperty(globalThis, "_PS_ATAC_REF", { configurable: true, get: () => _PS_ATAC_REF });
Object.defineProperty(globalThis, "_PS_ALVO_REF", { configurable: true, get: () => _PS_ALVO_REF });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psStudioToScreen", { configurable: true, get: () => _psStudioToScreen, set: (__v) => { _psStudioToScreen = __v; } });
Object.defineProperty(globalThis, "_PS_CHEST_FRAC", { configurable: true, get: () => _PS_CHEST_FRAC });
Object.defineProperty(globalThis, "_PS_Z_FRAC", { configurable: true, get: () => _PS_Z_FRAC });
Object.defineProperty(globalThis, "_PS_LEAN", { configurable: true, get: () => _PS_LEAN });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxIsoOn", { configurable: true, get: () => _avtVfxIsoOn, set: (__v) => { _avtVfxIsoOn = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxBillboardOn", { configurable: true, get: () => _avtVfxBillboardOn, set: (__v) => { _avtVfxBillboardOn = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxTokenPx", { configurable: true, get: () => _avtVfxTokenPx, set: (__v) => { _avtVfxTokenPx = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxAutoScale", { configurable: true, get: () => _avtVfxAutoScale, set: (__v) => { _avtVfxAutoScale = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxScale", { configurable: true, get: () => _avtVfxScale, set: (__v) => { _avtVfxScale = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psNormAnchor", { configurable: true, get: () => _psNormAnchor, set: (__v) => { _psNormAnchor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psSourceEnt", { configurable: true, get: () => _psSourceEnt, set: (__v) => { _psSourceEnt = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psPlanarAnchor", { configurable: true, get: () => _psPlanarAnchor, set: (__v) => { _psPlanarAnchor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAnchorLift", { configurable: true, get: () => _psAnchorLift, set: (__v) => { _psAnchorLift = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtResolveAnchor", { configurable: true, get: () => _avtResolveAnchor, set: (__v) => { _avtResolveAnchor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxRoot", { configurable: true, get: () => _avtVfxRoot, set: (__v) => { _avtVfxRoot = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxSpanFns", { configurable: true, get: () => _avtVfxSpanFns, set: (__v) => { _avtVfxSpanFns = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtVfxTrackedRoot", { configurable: true, get: () => _avtVfxTrackedRoot, set: (__v) => { _avtVfxTrackedRoot = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psHandPath", { configurable: true, get: () => _psHandPath, set: (__v) => { _psHandPath = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psBeamPath", { configurable: true, get: () => _psBeamPath, set: (__v) => { _psBeamPath = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psToAvtConfig", { configurable: true, get: () => _psToAvtConfig, set: (__v) => { _psToAvtConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtLoadCfg", { configurable: true, get: () => _psAvtLoadCfg, set: (__v) => { _psAvtLoadCfg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtToScreen", { configurable: true, get: () => _psAvtToScreen, set: (__v) => { _psAvtToScreen = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtLiveEnds", { configurable: true, get: () => _psAvtLiveEnds, set: (__v) => { _psAvtLiveEnds = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtInterpKf", { configurable: true, get: () => _psAvtInterpKf, set: (__v) => { _psAvtInterpKf = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtRenderSprites", { configurable: true, get: () => _psAvtRenderSprites, set: (__v) => { _psAvtRenderSprites = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtInterpGeneric", { configurable: true, get: () => _psAvtInterpGeneric, set: (__v) => { _psAvtInterpGeneric = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtRenderShapes", { configurable: true, get: () => _psAvtRenderShapes, set: (__v) => { _psAvtRenderShapes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtLayerAnchor", { configurable: true, get: () => _psAvtLayerAnchor, set: (__v) => { _psAvtLayerAnchor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtScaleEmitterCfg", { configurable: true, get: () => _avtScaleEmitterCfg, set: (__v) => { _avtScaleEmitterCfg = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtRenderWithSpawnPath", { configurable: true, get: () => _psAvtRenderWithSpawnPath, set: (__v) => { _psAvtRenderWithSpawnPath = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtPixiPlayAnimation", { configurable: true, get: () => avtPixiPlayAnimation, set: (__v) => { avtPixiPlayAnimation = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtPixiGetAnimDelaySync", { configurable: true, get: () => avtPixiGetAnimDelaySync, set: (__v) => { avtPixiGetAnimDelaySync = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtPathPos", { configurable: true, get: () => _psAvtPathPos, set: (__v) => { _psAvtPathPos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtRenderTravel", { configurable: true, get: () => _psAvtRenderTravel, set: (__v) => { _psAvtRenderTravel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtProjectile", { configurable: true, get: () => _psAvtProjectile, set: (__v) => { _psAvtProjectile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtFollow", { configurable: true, get: () => _psAvtFollow, set: (__v) => { _psAvtFollow = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psAvtChain", { configurable: true, get: () => _psAvtChain, set: (__v) => { _psAvtChain = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtPixiPlayPersistent", { configurable: true, get: () => avtPixiPlayPersistent, set: (__v) => { avtPixiPlayPersistent = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtPixiStopPersistent", { configurable: true, get: () => avtPixiStopPersistent, set: (__v) => { avtPixiStopPersistent = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "avtPixiCleanupAll", { configurable: true, get: () => avtPixiCleanupAll, set: (__v) => { avtPixiCleanupAll = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psBuildBackgroundDim", { configurable: true, get: () => _psBuildBackgroundDim, set: (__v) => { _psBuildBackgroundDim = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_psVignetteTexture", { configurable: true, get: () => _psVignetteTexture, set: (__v) => { _psVignetteTexture = __v; } });
