// ─── Studio Pixi — Adventure Mode Integration ────────────────────────────────
// Plays pixi_animations by ID during adventure mode combat/skill use.
// Depends on: aventura.js (_avtPixiParticleAnim, _avtEnsurePixiParticles,
//              _avtProcTextures, AVT_STATE), pixi-studio.js (PIXI_STUDIO_STATE)

var _PS_AVT_ACTIVE    = [];  // { app, overlayCanvas, emitters, trackFn, timerId }
var _PS_PERSISTENT    = new Map();  // key -> { cleanup } for duration-bound persistent animations

// Reference positions matching pixi-studio.js PS_ATAC_REF / PS_ALVO_REF
const _PS_ATAC_REF = { x: -160, y: 0 };
const _PS_ALVO_REF = { x:  160, y: 0 };

// ── Transform studio-space coordinates to adventure screen-space ─────────────
function _psStudioToScreen(px, py, atacScr, alvoScr) {
  const dx_s = _PS_ALVO_REF.x - _PS_ATAC_REF.x;  // 320
  const dy_s = _PS_ALVO_REF.y - _PS_ATAC_REF.y;  // -60
  const dx_a = alvoScr.x - atacScr.x;
  const dy_a = alvoScr.y - atacScr.y;
  const lenS = Math.sqrt(dx_s * dx_s + dy_s * dy_s);
  const lenA = Math.sqrt(dx_a * dx_a + dy_a * dy_a);
  const scale = lenS > 0 ? lenA / lenS : 1;
  const angle = Math.atan2(dy_a, dx_a) - Math.atan2(dy_s, dx_s);
  const relX  = px - _PS_ATAC_REF.x;
  const relY  = py - _PS_ATAC_REF.y;
  const rotX  = relX * Math.cos(angle) - relY * Math.sin(angle);
  const rotY  = relX * Math.sin(angle) + relY * Math.cos(angle);
  return { x: atacScr.x + rotX * scale, y: atacScr.y + rotY * scale };
}

// ── Convert Studio config_json layers → AVT particle config format ─────────
function _psToAvtConfig(cfg) {
  if (!cfg) return null;
  const low = cfg.quality === 'baixo';   // mobile/low quality: lighter particles, no bloom/trails
  const avt = {
    duration:   cfg.duracao_ms || cfg.duration || 1000,
    lighting:   low ? Object.assign({}, cfg.lighting, { bloom: null }) : (cfg.lighting || {}),
    camera:     cfg.camera       || {},
    background: cfg.background   || {},
    filters:    cfg.filters      || [],
    travel:     cfg.travel       || null,
    layers: [],
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
async function _psAvtLoadCfg(animId) {
  if (!animId) return null;
  const cache = (typeof PIXI_STUDIO_STATE !== 'undefined') ? PIXI_STUDIO_STATE._animCache : null;
  if (cache && cache[animId]) return cache[animId];
  try {
    const rows = await _avtSb(`pixi_animations?id=eq.${encodeURIComponent(animId)}&select=config_json`);
    const cfg = rows && rows[0] && rows[0].config_json;
    if (cfg && cache) {
      cache[animId] = cfg;
      setTimeout(() => { delete cache[animId]; }, 30000);
    }
    return cfg || null;
  } catch (e) {
    console.warn('[pixi-studio-avt] Failed to load anim', animId, e);
    return null;
  }
}

// ── Build screen coordinates from entity (mirrors _avtPlaySkillAnim) ───────
function _psAvtToScreen(ent) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return { x: canvas ? canvas.width / 2 : 400, y: canvas ? canvas.height / 2 : 300 };
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const live = typeof _avtEntViva === 'function' ? _avtEntViva(ent) : ent;
  return {
    x: Math.round((live.renderX ?? live.x) * SZ - AVT_STATE.camera.x + SZ / 2),
    y: Math.round((live.renderY ?? live.y) * SZ - AVT_STATE.camera.y + SZ / 2),
  };
}

// ── Interpolate keyframes at time t ───────────────────────────────────────
function _psAvtInterpKf(kfs, t) {
  if (!kfs || !kfs.length) return null;
  if (t <= kfs[0].t) return Object.assign({}, kfs[0]);
  if (t >= kfs[kfs.length - 1].t) return Object.assign({}, kfs[kfs.length - 1]);
  for (let i = 0; i < kfs.length - 1; i++) {
    if (t >= kfs[i].t && t <= kfs[i + 1].t) {
      const fRaw = (t - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      // Apply per-keyframe easing (owned by the outgoing keyframe). Default linear.
      const f = (typeof window !== 'undefined' && window._psEase)
        ? window._psEase(kfs[i].ease || 'linear', fRaw) : fRaw;
      const lerp = (a, b) => a + (b - a) * f;
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
//           other        → sprite anchors at startScr + keyframe offsets
async function _psAvtRenderSprites(cfg, startScr, endScr, behavior) {
  const spriteLayers = (cfg.layers || []).filter(l => l.visivel && l.tipo === 'sprite' && l.texture_url);
  if (!spriteLayers.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width  = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);

  let app;
  try {
    app = new PIXI.Application({
      view: overlayCanvas,
      width: overlayCanvas.width,
      height: overlayCanvas.height,
      backgroundAlpha: 0,
      antialias: false,
    });
  } catch (e) {
    overlayCanvas.remove();
    return;
  }

  const bmMap = {
    add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN,
    multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL,
  };

  const sprites = [];
  for (const l of spriteLayers) {
    try {
      const tex = PIXI.Texture.from(l.texture_url);
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.blendMode = bmMap[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      app.stage.addChild(sp);
      sprites.push({ sp, layer: l });
    } catch (e) {
      console.warn('[pixi-studio-avt] Sprite texture error', l.texture_url, e);
    }
  }

  const isProjectile = behavior === 'projectile';

  // Precompute rotation offset: angle of adventure travel minus angle of studio reference axis
  const dx_s = _PS_ALVO_REF.x - _PS_ATAC_REF.x;
  const dy_s = _PS_ALVO_REF.y - _PS_ATAC_REF.y;
  const dx_a = endScr.x - startScr.x;
  const dy_a = endScr.y - startScr.y;
  const rotOffset = isProjectile
    ? Math.atan2(dy_a, dx_a) - Math.atan2(dy_s, dx_s)
    : 0;

  const startMs = performance.now();

  const tick = () => {
    const elapsed = performance.now() - startMs;
    const t = Math.min(elapsed / durMs, 1);
    for (const { sp, layer } of sprites) {
      const st = layer.start_t ?? 0;
      const et = layer.end_t   ?? 1;
      sp.visible = (t >= st && t <= et);
      if (!sp.visible) continue;
      const tRel = et > st ? (t - st) / (et - st) : t;

      const bs = layer.base_scale ?? 1;
      const kf = _psAvtInterpKf(layer.keyframes, tRel);
      if (!kf) continue;

      if (isProjectile) {
        // Map studio-space keyframe position → screen-space via similarity transform
        const scrPos = _psStudioToScreen(kf.x ?? 0, kf.y ?? 0, startScr, endScr);
        sp.x = scrPos.x;
        sp.y = scrPos.y;
      } else {
        const anchor = _psAvtLayerAnchor(layer, startScr, endScr);
        sp.x = anchor.x + (kf.x ?? 0);
        sp.y = anchor.y + (kf.y ?? 0);
      }

      const sv = (kf.scale ?? 1) * bs;
      sp.scale.x = sv * (layer.flip_x ? -1 : 1);
      sp.scale.y = sv * (layer.flip_y ? -1 : 1);
      sp.alpha    = kf.alpha    ?? 1;
      sp.rotation = ((kf.rotation ?? 0) * Math.PI) / 180 + rotOffset;
    }
  };

  app.ticker.add(tick);

  setTimeout(() => {
    app.ticker.remove(tick);
    try { app.destroy(true, { children: true }); } catch (_) {}
    overlayCanvas.remove();
  }, durMs + 200);
}

// Generic keyframe interpolation (handles shape/light fields + easing)
function _psAvtInterpGeneric(kfs, t) {
  if (!kfs || !kfs.length) return null;
  const s = [...kfs].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return Object.assign({}, s[0]);
  if (t >= s[s.length - 1].t) return Object.assign({}, s[s.length - 1]);
  let lo = s[0], hi = s[1];
  for (let i = 0; i < s.length - 1; i++) { if (t >= s[i].t && t <= s[i + 1].t) { lo = s[i]; hi = s[i + 1]; break; } }
  let f = (hi.t - lo.t) ? (t - lo.t) / (hi.t - lo.t) : 0;
  if (typeof window !== 'undefined' && window._psEase) f = window._psEase(lo.ease || 'linear', f);
  const out = {};
  new Set([...Object.keys(lo), ...Object.keys(hi)]).forEach(k => {
    if (k === 't' || k === 'ease') return;
    const a = lo[k], b = hi[k];
    out[k] = (typeof a === 'number' && typeof b === 'number') ? a + (b - a) * f : a;
  });
  return out;
}

// ── Render shape + light layers in combat (parity with the studio preview) ────
async function _psAvtRenderShapes(cfg, startScr, endScr, behavior) {
  const layers = (cfg.layers || []).filter(l => l.visivel && (l.tipo === 'shape' || l.tipo === 'light'));
  if (!layers.length) return;
  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);

  let app;
  try {
    app = new PIXI.Application({ view: overlayCanvas, width: overlayCanvas.width, height: overlayCanvas.height, backgroundAlpha: 0, antialias: false });
  } catch (e) { overlayCanvas.remove(); return; }

  const bm = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };
  const hexInt = (c) => { if (typeof c === 'number') return c; const n = parseInt(String(c).replace('#', ''), 16); return isNaN(n) ? 0xffffff : n; };
  const isProj = behavior === 'projectile';
  const items = [];
  for (const l of layers) {
    if (l.tipo === 'shape') {
      const g = new PIXI.Graphics();
      g.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      app.stage.addChild(g); items.push({ g, layer: l });
    } else {
      const sp = new PIXI.Sprite(typeof _avtProcTextures === 'function' ? _avtProcTextures('glow') : PIXI.Texture.WHITE);
      sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
      app.stage.addChild(sp); items.push({ sp, layer: l });
    }
  }

  const startMs = performance.now();
  const tick = () => {
    const t = Math.min((performance.now() - startMs) / durMs, 1);
    for (const it of items) {
      const l = it.layer;
      const layerAnchor = _psAvtLayerAnchor(l, startScr, endScr);
      const anchorX = isProj ? startScr.x + (endScr.x - startScr.x) * t : layerAnchor.x;
      const anchorY = isProj ? startScr.y + (endScr.y - startScr.y) * t : layerAnchor.y;
      const st = l.start_t ?? 0, et = l.end_t ?? 1;
      const vis = t >= st && t <= et;
      const tRel = et > st ? (t - st) / (et - st) : t;
      const kf = _psAvtInterpGeneric(l.keyframes, tRel);
      if (it.g) {
        const g = it.g; g.visible = vis; if (!vis || !kf) continue;
        g.clear();
        g.position.set(anchorX + (kf.x || 0), anchorY + (kf.y || 0));
        const sw = kf.stroke_width ?? 2, sa = kf.stroke_alpha ?? 1, fa = kf.fill_alpha ?? 0, r = kf.radius ?? 20;
        if (sa > 0) g.lineStyle(sw, hexInt(kf.stroke_color || '#ffffff'), sa);
        if (fa > 0) g.beginFill(hexInt(kf.fill_color || '#ffffff'), fa);
        if (l.shape_type === 'rect') g.drawRect(-r, -r, r * 2, r * 2);
        else if (l.shape_type === 'polygon') {
          const sides = Math.max(3, l.sides || 6), pts = [];
          for (let i = 0; i < sides; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / sides; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
          g.drawPolygon(pts);
        } else g.drawCircle(0, 0, r);
        if (fa > 0) g.endFill();
      } else {
        const sp = it.sp; sp.visible = vis; if (!vis || !kf) continue;
        const r = kf.radius ?? 60;
        sp.width = sp.height = r * 2;
        sp.position.set(anchorX + (kf.x || 0), anchorY + (kf.y || 0));
        sp.alpha = kf.alpha ?? 0.7;
        sp.tint = hexInt(kf.color || l.color || '#ffffff');
      }
    }
  };
  app.ticker.add(tick);
  setTimeout(() => {
    app.ticker.remove(tick);
    try { app.destroy(true, { children: true }); } catch (_) {}
    overlayCanvas.remove();
  }, durMs + 200);
}

// Helper: resolve effective anchor screen pos for a layer given posicao_override
function _psAvtLayerAnchor(layer, atacScr, alvoScr) {
  const pos = layer.posicao_override;
  if (!pos || pos === 'alvo') return alvoScr;
  if (pos === 'atacante') return atacScr;
  if (pos === 'meio') return { x: (atacScr.x + alvoScr.x) / 2, y: (atacScr.y + alvoScr.y) / 2 };
  return alvoScr;
}

// ── Render emitter layers following their recorded spawn_path ─────────────────
// Uses a similarity transform to map studio-space → screen-space.
async function _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr) {
  const layers = (cfg.layers || []).filter(l => l.emitter);
  if (!layers.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width  = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);

  let app;
  try {
    app = new PIXI.Application({
      view: overlayCanvas,
      width: overlayCanvas.width, height: overlayCanvas.height,
      backgroundAlpha: 0, antialias: false,
    });
  } catch (e) { overlayCanvas.remove(); return; }

  const bm = {
    add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN,
    multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL,
  };

  const emitters = [];
  for (const l of layers) {
    const container = new PIXI.Container();
    container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
    app.stage.addChild(container);

    let emitCfg = Object.assign({}, l.emitter);
    // We control emission timing manually; override auto-stop from emitterLifetime
    if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
    const tex = l.texture_url
      ? PIXI.Texture.from(l.texture_url)
      : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
    const texArr = [tex || PIXI.Texture.WHITE];
    if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) {
      try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {}
    }
    try {
      const em = new PIXI.particles.Emitter(container, emitCfg);
      // Initial position: start of spawn_path or attacker
      const initPos = l.spawn_path?.length
        ? _psStudioToScreen(l.spawn_path[0].x ?? 0, l.spawn_path[0].y ?? 0, atacScr, alvoScr)
        : alvoScr;
      em.updateSpawnPos(initPos.x, initPos.y);
      em.emit = false;
      emitters.push({ em, layer: l });
    } catch (_) {}
  }

  const startMs = performance.now();
  let lastTs = startMs;

  const tick = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000;
    lastTs = now;
    const t = Math.min((now - startMs) / durMs, 1);

    for (const { em, layer } of emitters) {
      if (em.destroyed) continue;
      const st = layer.start_t ?? 0, et = layer.end_t ?? 1;
      const inRange = t >= st && t <= et;
      em.emit = inRange;
      if (inRange && layer.spawn_path?.length) {
        const tRel = et > st ? (t - st) / (et - st) : 0;
        const sp = _psAvtInterpKf(layer.spawn_path, tRel);
        if (sp) {
          const pos = _psStudioToScreen(sp.x ?? 0, sp.y ?? 0, atacScr, alvoScr);
          em.updateSpawnPos(pos.x, pos.y);
        }
      } else if (inRange) {
        const anchor = _psAvtLayerAnchor(layer, atacScr, alvoScr);
        const ox = layer.offset?.x || 0, oy = layer.offset?.y || 0;
        em.updateSpawnPos(anchor.x + ox, anchor.y + oy);
      }
      em.update(delta);
    }
  };

  app.ticker.add(tick);

  setTimeout(() => {
    app.ticker.remove(tick);
    for (const { em } of emitters) {
      try { if (!em.destroyed) em.destroy(); } catch (_) {}
    }
    try { app.destroy(true, { children: true }); } catch (_) {}
    overlayCanvas.remove();
  }, durMs + 300);
}

// ── Main public entry point ────────────────────────────────────────────────
// Returns: delay in ms (travel time for projectile behavior, else 0)
async function avtPixiPlayAnimation(animId, atacanteEnt, alvoEnt, isAreaMode) {
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
  const overrideLayers = (cfg.layers || []).filter(l => l.visivel && l.behavior_override && FOLLOW_OVR.includes(l.behavior_override));
  const mainLayers     = (cfg.layers || []).filter(l => !(l.behavior_override && FOLLOW_OVR.includes(l.behavior_override)));
  // Render per-layer follow overrides immediately
  for (const ol of overrideLayers) {
    const singleCfg = Object.assign({}, cfg, { layers: [ol] });
    const followEnt = ol.behavior_override === 'follow-target' ? (alvoEnt || atacanteEnt) : atacanteEnt;
    _psAvtFollow(singleCfg, followEnt, durMs);
  }
  // Use filtered config for main rendering when there are overrides
  const mainCfg = overrideLayers.length ? Object.assign({}, cfg, { layers: mainLayers }) : cfg;
  if (!mainLayers.filter(l => l.visivel).length && behavior !== 'chain') return 0;

  switch (behavior) {
    case 'projectile':
      return _psAvtProjectile(mainCfg, atacScr, alvoScr, alvoEnt);
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
      // one-shot, loop, aoe — prefer spawn_path if present, else existing pipeline
      const hasPath = (mainCfg.layers || []).some(l => l.tipo === 'emitter' && l.spawn_path?.length);
      if (hasPath) {
        _psAvtRenderWithSpawnPath(mainCfg, atacScr, alvoScr);
      } else {
        const avtCfg = _psToAvtConfig(mainCfg);
        if (avtCfg && typeof _avtPixiParticleAnim === 'function') {
          _avtPixiParticleAnim(avtCfg, atacScr, alvoScr, posicao);
        }
      }
      _psAvtRenderSprites(mainCfg, atacScr, alvoScr, behavior);
      _psAvtRenderShapes(mainCfg, atacScr, alvoScr, behavior);
      return 0;
    }
  }
}

// ── Compute a point along a travel path between two screen points ──────────
function _psAvtPathPos(path, atac, alvo, t) {
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
async function _psAvtRenderTravel(cfg, atacScr, alvoScr, path, alvoEnt) {
  const layers = (cfg.layers || []).filter(l => l.visivel && l.tipo === 'emitter' && l.emitter);
  if (!layers.length) return;
  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || cfg.duration || 1000;
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);

  let app;
  try { app = new PIXI.Application({ view: overlayCanvas, width: overlayCanvas.width, height: overlayCanvas.height, backgroundAlpha: 0, antialias: false }); }
  catch (e) { overlayCanvas.remove(); return; }

  const bm = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };
  const emitters = [];
  for (const l of layers) {
    const container = new PIXI.Container();
    container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
    app.stage.addChild(container);
    let emitCfg = Object.assign({}, l.emitter);
    if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
    const tex = l.texture_url ? PIXI.Texture.from(l.texture_url) : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
    const texArr = [tex || PIXI.Texture.WHITE];
    if (PIXI.particles?.upgradeConfig && !Array.isArray(emitCfg.behaviors)) { try { emitCfg = PIXI.particles.upgradeConfig(emitCfg, texArr); } catch (_) {} }
    try {
      const em = new PIXI.particles.Emitter(container, emitCfg);
      em.updateSpawnPos(atacScr.x, atacScr.y);
      em.emit = false;
      emitters.push({ em, layer: l });
    } catch (_) {}
  }

  const startMs = performance.now();
  let lastTs = startMs;
  const tick = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000; lastTs = now;
    const t = Math.min((now - startMs) / durMs, 1);
    // Homing re-acquires the (possibly moving) target each frame
    const alvo = (path === 'homing' && alvoEnt) ? _psAvtToScreen(alvoEnt) : alvoScr;
    const pos = _psAvtPathPos(path, atacScr, alvo, t);
    for (const { em, layer } of emitters) {
      if (em.destroyed) continue;
      const st = layer.start_t ?? 0, et = layer.end_t ?? 1;
      const inRange = t >= st && t <= et;
      em.emit = inRange;
      if (inRange) em.updateSpawnPos(pos.x, pos.y);
      em.update(delta);
    }
  };
  app.ticker.add(tick);
  setTimeout(() => {
    app.ticker.remove(tick);
    for (const { em } of emitters) { try { if (!em.destroyed) em.destroy(); } catch (_) {} }
    try { app.destroy(true, { children: true }); } catch (_) {}
    overlayCanvas.remove();
  }, durMs + 300);
}

// ── Projectile: emitter travels from caster to target ─────────────────────
function _psAvtProjectile(cfg, atacScr, alvoScr, alvoEnt) {
  const hasSpawnPath = (cfg.layers || []).some(l => l.tipo === 'emitter' && l.spawn_path?.length);

  // If any emitter layer has a recorded spawn_path, respect it exactly
  if (hasSpawnPath) {
    _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr);
    _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile');
    _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile');
    return cfg.duracao_ms || cfg.duration || 1000;
  }

  // Curved travel (arc/spiral/homing): emitters fly along the computed path
  const path = cfg.travel?.path;
  if (path && path !== 'linear') {
    _psAvtRenderTravel(cfg, atacScr, alvoScr, path, alvoEnt);
    _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile');
    _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile');
    return cfg.duracao_ms || cfg.duration || 1000;
  }

  const speedMs = cfg.behavior_config?.projectile_speed_ms || 500;
  const dur     = cfg.duracao_ms || cfg.duration || 1200;
  const avtCfg  = _psToAvtConfig(cfg);
  if (!avtCfg) return 0;

  // Phase 1: cast anim at attacker
  if (typeof _avtPixiParticleAnim === 'function') {
    _avtPixiParticleAnim(Object.assign({}, avtCfg, { duration: Math.min(400, speedMs) }),
      atacScr, atacScr, 'atacante');
  }

  // Phase 2: impact anim at target after travel time
  setTimeout(() => {
    if (typeof _avtPixiParticleAnim === 'function') {
      _avtPixiParticleAnim(avtCfg, atacScr, alvoScr, 'alvo');
    }
  }, speedMs);

  // Sprite layers travel from attacker to target over the full duration
  _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile');
  _psAvtRenderShapes(cfg, atacScr, alvoScr, 'projectile');

  return speedMs;
}

// ── Follow: emitter tracks an entity's screen position each frame ──────────
function _psAvtFollow(cfg, targetEnt, durMs) {
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
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width  = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
    canvas.parentElement?.appendChild(overlayCanvas);

    let app;
    try {
      app = new PIXI.Application({
        view: overlayCanvas,
        width: overlayCanvas.width,
        height: overlayCanvas.height,
        backgroundAlpha: 0,
        antialias: false,
      });
    } catch (e) {
      overlayCanvas.remove();
      return;
    }

    const worldRoot = new PIXI.Container();
    app.stage.addChild(worldRoot);

    const emitters = [];
    const bm = {
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

        let emitCfg = Object.assign({}, l.emitter);
        if (!Array.isArray(emitCfg.behaviors)) emitCfg.emitterLifetime = -1;
        const tex = l.texture_url
          ? PIXI.Texture.from(l.texture_url)
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
          const tex = PIXI.Texture.from(l.texture_url);
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5);
          sp.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
          const bs = l.base_scale ?? 1;
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
      for (const em of emitters) {
        if (em._isSprite) {
          const t = Math.min((now - em.startMs) / em.durMs, 1);
          const kf = _psAvtInterpKf(em.layer.keyframes, t);
          if (kf) {
            const bs = em.layer.base_scale ?? 1;
            em.sp.x = scr.x + (kf.x ?? 0);
            em.sp.y = scr.y + (kf.y ?? 0);
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

    const cleanup = () => {
      app.ticker.remove(trackFn);
      for (const em of emitters) {
        if (em._isSprite) continue;
        try { if (!em.destroyed) em.destroy(); } catch (_) {}
      }
      try { app.destroy(true, { children: true }); } catch (_) {}
      overlayCanvas.remove();
      _PS_AVT_ACTIVE = _PS_AVT_ACTIVE.filter(e => e.app !== app);
    };

    const timerId = setTimeout(cleanup, durMs + 200);
    _PS_AVT_ACTIVE.push({ app, overlayCanvas, emitters, trackFn, timerId });
  });
}

// ── Chain behavior: play sequence of animations ────────────────────────────
function _psAvtChain(cfg, atacanteEnt, alvoEnt, isAreaMode) {
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
async function avtPixiPlayPersistent(animId, alvoEnt, casterEnt, posicao, key) {
  avtPixiStopPersistent(key);  // stop any existing animation for this key

  const cfg = await _psAvtLoadCfg(animId);
  if (!cfg || !cfg.layers?.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const primaryEnt = (posicao === 'atacante') ? (casterEnt || alvoEnt) : (alvoEnt || casterEnt);
  if (!primaryEnt) return;

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width  = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
  canvas.parentElement?.appendChild(overlayCanvas);

  let app;
  try {
    app = new PIXI.Application({ view: overlayCanvas, width: overlayCanvas.width, height: overlayCanvas.height, backgroundAlpha: 0, antialias: false });
  } catch (e) { overlayCanvas.remove(); return; }

  const worldRoot = new PIXI.Container();
  app.stage.addChild(worldRoot);
  const bm = { add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY, normal: PIXI.BLEND_MODES.NORMAL };

  // Resolve which entity each layer should track
  const _resolveLayerEnt = (l) => {
    const ov = l.behavior_override;
    if (ov === 'follow-caster' || ov === 'channel') return casterEnt || alvoEnt;
    if (ov === 'follow-target') return alvoEnt || casterEnt;
    return primaryEnt;
  };

  const cycleDurMs = cfg.duracao_ms || cfg.duration || 1000;
  const startScr = _psAvtToScreen(primaryEnt);
  const emitters = [];

  for (const l of (cfg.layers || [])) {
    if (!l.visivel) continue;
    const trackEnt = _resolveLayerEnt(l);
    if (l.tipo === 'emitter' && l.emitter) {
      const container = new PIXI.Container();
      container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      worldRoot.addChild(container);
      let emitCfg = Object.assign({}, l.emitter, { emitterLifetime: -1 });
      const tex = l.texture_url ? PIXI.Texture.from(l.texture_url) : (typeof _avtProcTextures === 'function' ? _avtProcTextures(l.texture || 'spark') : null);
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
        const tex = PIXI.Texture.from(l.texture_url);
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
        const bs = l.base_scale ?? 1;
        sp.scale.x = bs * (l.flip_x ? -1 : 1);
        sp.scale.y = bs * (l.flip_y ? -1 : 1);
        sp.x = startScr.x; sp.y = startScr.y;
        worldRoot.addChild(sp);
        emitters.push({ _isSprite: true, sp, layer: l, trackEnt, cycleStart: performance.now() });
      } catch (e) {}
    }
  }

  let lastTs = performance.now();
  const trackFn = () => {
    const now = performance.now();
    const delta = (now - lastTs) / 1000;
    lastTs = now;
    for (const em of emitters) {
      const scr = _psAvtToScreen(em.trackEnt || primaryEnt);
      if (em._isSprite) {
        // Loop keyframes using cycleDurMs
        const t = ((now - em.cycleStart) % cycleDurMs) / cycleDurMs;
        const kf = _psAvtInterpKf(em.layer.keyframes, t);
        if (kf) {
          const bs = em.layer.base_scale ?? 1;
          em.sp.x = scr.x + (kf.x ?? 0);
          em.sp.y = scr.y + (kf.y ?? 0);
          const sv = (kf.scale ?? 1) * bs;
          em.sp.scale.x = sv * (em.layer.flip_x ? -1 : 1);
          em.sp.scale.y = sv * (em.layer.flip_y ? -1 : 1);
          em.sp.alpha    = kf.alpha    ?? 1;
          em.sp.rotation = ((kf.rotation ?? 0) * Math.PI) / 180;
        }
      } else {
        if (!em.em.destroyed) { em.em.updateSpawnPos(scr.x, scr.y); em.em.update(delta); }
      }
    }
  };

  app.ticker.add(trackFn);

  const cleanup = () => {
    app.ticker.remove(trackFn);
    for (const em of emitters) {
      if (em._isSprite) continue;
      try { if (!em.em.destroyed) em.em.destroy(); } catch (_) {}
    }
    try { app.destroy(true, { children: true }); } catch (_) {}
    overlayCanvas.remove();
    _PS_PERSISTENT.delete(key);
  };

  _PS_PERSISTENT.set(key, { cleanup });
}

function avtPixiStopPersistent(key) {
  const entry = _PS_PERSISTENT.get(key);
  if (entry) { entry.cleanup(); }
}

// ── Cleanup all active follow/channel animations ───────────────────────────
function avtPixiCleanupAll() {
  for (const entry of _PS_AVT_ACTIVE) {
    clearTimeout(entry.timerId);
    if (entry.app) {
      if (entry.trackFn && entry.app.ticker) entry.app.ticker.remove(entry.trackFn);
      for (const em of (entry.emitters || [])) {
        if (em._isSprite) continue;
        try { if (!em.destroyed) em.destroy(); } catch (_) {}
      }
      try { entry.app.destroy(true, { children: true }); } catch (_) {}
    }
    if (entry.overlayCanvas) entry.overlayCanvas.remove();
  }
  _PS_AVT_ACTIVE = [];
}

window.avtPixiPlayAnimation    = avtPixiPlayAnimation;
window.avtPixiCleanupAll       = avtPixiCleanupAll;
window.avtPixiPlayPersistent   = avtPixiPlayPersistent;
window.avtPixiStopPersistent   = avtPixiStopPersistent;
