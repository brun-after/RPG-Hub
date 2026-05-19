// maps/fase-renderer.js
// Fase Map Renderer: PixiJS v7 — full-screen game camera, chunk loading, entities
// Mirrors the pattern from characters/anim-renderer.js

// ── Constantes da câmera ──────────────────────────────────────────────────
const FASE_CAM_LERP     = 0.07;  // velocidade de interpolação da câmera
const FASE_CAM_MARGIN   = 120;   // margem em pixels ao redor dos jogadores
const FASE_MIN_ZOOM     = 0.25;
const FASE_MAX_ZOOM     = 3.0;
const FASE_CHUNK_SIZE   = 512;   // pixels por chunk

// ── Lazy load PixiJS (reusa o já carregado pelo anim-renderer) ────────────
function _fasePixiEnsureLoaded() {
  if (window.PIXI) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Destruir instância atual de fase ─────────────────────────────────────
function faseDesmontarAtual() {
  if (FASE_STATE.app) {
    try { FASE_STATE.app.destroy(true, { children: true, texture: false }); } catch(e) {}
    FASE_STATE.app = null;
    FASE_STATE.worldContainer = null;
  }
  if (FASE_STATE.loopRafId) {
    cancelAnimationFrame(FASE_STATE.loopRafId);
    FASE_STATE.loopRafId = null;
  }
  FASE_STATE.chunks     = {};
  FASE_STATE.entidades  = {};
  FASE_STATE.jogadoresPos = {};
  FASE_STATE._cameraLerp = { x: 0, y: 0, zoom: 1 };
}

// ════════════════════════════════════════════════════════════════════════════
// MONTAGEM PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
async function faseRendererMount(container, mapaData) {
  faseDesmontarAtual();
  await _fasePixiEnsureLoaded();

  FASE_STATE.faseAtualId = mapaData.map_id;
  const rd = mapaData.render_data || {};

  // ── PixiJS Application (full-screen) ─────────────────────────────────────
  const screenW = container.offsetWidth  || window.innerWidth;
  const screenH = container.offsetHeight || window.innerHeight;

  const app = new PIXI.Application({
    width:           screenW,
    height:          screenH,
    backgroundAlpha: 1,
    backgroundColor: 0x050810,
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });
  app.view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  container.appendChild(app.view);
  FASE_STATE.app = app;

  // ── Container do mundo (a câmera move este container) ────────────────────
  const world = new PIXI.Container();
  app.stage.addChild(world);
  FASE_STATE.worldContainer = world;

  // Perspectiva: tilt em Y no container de chão (não nos personagens)
  const tiltY = rd.perspective?.tilt_y ?? 0.72;

  // ── Calcular dimensões do mundo em pixels ─────────────────────────────────
  const mapaW = (mapaData.largura_total || 20) * (mapaData.grid || 64);
  const mapaH = (mapaData.altura_total  || 15) * (mapaData.grid || 64);

  // ── Layer: imagem de fundo (aplicar tilt) ────────────────────────────────
  const bgLayer = new PIXI.Container();
  bgLayer.scale.y = tiltY;
  world.addChild(bgLayer);

  if (mapaData.img_url) {
    try {
      const tex = await PIXI.Texture.fromURL(normalizeImgUrl(mapaData.img_url));
      const bg  = new PIXI.Sprite(tex);
      bg.width  = mapaW;
      bg.height = mapaH / tiltY; // compensar tilt para preencher mapaH
      bgLayer.addChild(bg);
    } catch(e) {
      console.warn('[fase-renderer] background image failed:', e);
      const g = new PIXI.Graphics();
      g.beginFill(0x0a1424).drawRect(0, 0, mapaW, mapaH).endFill();
      bgLayer.addChild(g);
    }
  }

  // ── Layer: elementos interativos ──────────────────────────────────────────
  const elemLayer = new PIXI.Container();
  elemLayer.scale.y = tiltY;
  world.addChild(elemLayer);

  _faseRenderParedes(elemLayer, rd, mapaW, mapaH);
  _faseRenderPortas(elemLayer, rd, mapaW, mapaH);
  _faseRenderBaus(elemLayer, rd, mapaW, mapaH);
  _faseRenderSpawnPoints(elemLayer, rd, mapaW, mapaH);

  // ── Layer: entidades (NÃO aplicar tilt — personagens ficam "de pé") ──────
  const entLayer = new PIXI.Container();
  world.addChild(entLayer);
  _faseRenderEntidades(entLayer, rd, mapaW, mapaH, tiltY);

  // ── Layer: tokens de jogadores ────────────────────────────────────────────
  const tokenLayer = new PIXI.Container();
  world.addChild(tokenLayer);
  FASE_STATE._tokenLayer = tokenLayer;

  // ── Posicionar câmera inicial nos spawn points ────────────────────────────
  const spawn = rd.spawn_jogadores?.[0];
  const iniX  = spawn ? spawn.x * mapaW : mapaW / 2;
  const iniY  = spawn ? spawn.y * mapaH : mapaH / 2;
  const iniZ  = Math.max(FASE_MIN_ZOOM, Math.min(FASE_MAX_ZOOM, Math.min(screenW / 600, screenH / 450)));
  FASE_STATE._cameraLerp = { x: screenW/2 - iniX * iniZ, y: screenH/2 - iniY * iniZ, zoom: iniZ };
  world.x = FASE_STATE._cameraLerp.x;
  world.y = FASE_STATE._cameraLerp.y;
  world.scale.set(iniZ, iniZ);

  // Inicializar posições de jogadores nos spawn points
  _faseInicializarJogadores(rd, mapaW, mapaH);

  // ── Loop principal ────────────────────────────────────────────────────────
  let lastTime = performance.now();
  app.ticker.add(() => {
    const now  = performance.now();
    const dt   = Math.min((now - lastTime) / 1000, 0.1); // segundos, cap 100ms
    lastTime   = now;

    _faseCameraUpdate(app, world, dt);
    _faseEntidadesLoop(entLayer, rd, mapaW, mapaH, tiltY, dt);
    _faseChunksUpdate(bgLayer, elemLayer, world, mapaW, mapaH, rd);
  });

  // ── Resize handling ───────────────────────────────────────────────────────
  const _onResize = () => {
    const w = container.offsetWidth  || window.innerWidth;
    const h = container.offsetHeight || window.innerHeight;
    app.renderer.resize(w, h);
  };
  window.addEventListener('resize', _onResize);
  app._faseResizeHandler = _onResize;

  // ── HUD de controle (mestre) ──────────────────────────────────────────────
  _faseMontarHUD(container, rd);

  // ── Input de movimento (teclado/touch para debug) ─────────────────────────
  _faseMontarInputMovimento(app, world, mapaW, mapaH, rd);

  return app;
}

// ════════════════════════════════════════════════════════════════════════════
// CÂMERA
// ════════════════════════════════════════════════════════════════════════════
function _faseCameraUpdate(app, world, dt) {
  const screenW = app.renderer.width;
  const screenH = app.renderer.height;

  // Coletar posições dos jogadores no mundo
  const positions = Object.values(FASE_STATE.jogadoresPos).filter(p => p && p.worldX != null);

  if (FASE_STATE.modoMestre) {
    // Modo mestre: mostra o mapa inteiro com pan manual
    return;
  }

  if (!positions.length) return;

  // Bounding box de todos os jogadores
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of positions) {
    minX = Math.min(minX, p.worldX); maxX = Math.max(maxX, p.worldX);
    minY = Math.min(minY, p.worldY); maxY = Math.max(maxY, p.worldY);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const spanX = Math.max(200, maxX - minX) + FASE_CAM_MARGIN * 2;
  const spanY = Math.max(150, maxY - minY) + FASE_CAM_MARGIN * 2;

  const targetZoom = Math.max(FASE_MIN_ZOOM, Math.min(FASE_MAX_ZOOM,
    Math.min(screenW / spanX, screenH / spanY)));
  const targetX = screenW / 2 - cx * targetZoom;
  const targetY = screenH / 2 - cy * targetZoom;

  const lerp = Math.min(1, FASE_CAM_LERP * (dt * 60));
  FASE_STATE._cameraLerp.x    += (targetX    - FASE_STATE._cameraLerp.x)    * lerp;
  FASE_STATE._cameraLerp.y    += (targetY    - FASE_STATE._cameraLerp.y)    * lerp;
  FASE_STATE._cameraLerp.zoom += (targetZoom - FASE_STATE._cameraLerp.zoom) * lerp;

  world.x = FASE_STATE._cameraLerp.x;
  world.y = FASE_STATE._cameraLerp.y;
  world.scale.set(FASE_STATE._cameraLerp.zoom, FASE_STATE._cameraLerp.zoom);
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO DE ELEMENTOS
// ════════════════════════════════════════════════════════════════════════════
function _faseRenderParedes(layer, rd, mapaW, mapaH) {
  if (!rd.paredes?.length) return;
  const g = new PIXI.Graphics();
  for (const p of rd.paredes) {
    g.lineStyle(3, p.tipo === 'transparente' ? 0x4477aa : 0x7ec8f0, 0.9);
    g.moveTo(p.x1 * mapaW, p.y1 * mapaH);
    g.lineTo(p.x2 * mapaW, p.y2 * mapaH);
  }
  layer.addChild(g);
  layer._paredesGraphics = g;
}

function _faseRenderPortas(layer, rd, mapaW, mapaH) {
  if (!rd.portas?.length) return;
  for (const porta of rd.portas) {
    const c = _faseCriarPortaSprite(porta, mapaW, mapaH);
    c._portaId = porta.id;
    layer.addChild(c);
  }
}

function _faseCriarPortaSprite(porta, mapaW, mapaH) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const cor = porta.aberta ? 0x5ee09a : (porta.trancada ? 0xe05050 : 0xf0cc6a);
  g.beginFill(cor, 0.85);
  g.drawRoundedRect(-16, -10, 32, 20, 4);
  g.endFill();
  g.lineStyle(2, 0x050810, 0.6);
  g.drawRoundedRect(-16, -10, 32, 20, 4);

  const txt = new PIXI.Text(porta.nome || '🚪', {
    fontSize: 9, fill: 0x050810, fontFamily: 'sans-serif', fontWeight: 'bold'
  });
  txt.anchor.set(0.5);
  txt.y = -18;

  c.addChild(g);
  c.addChild(txt);
  c.x = porta.x * mapaW;
  c.y = porta.y * mapaH;
  c.interactive = true;
  c.buttonMode  = true;
  c.cursor = 'pointer';
  c.on('pointerup', () => _faseClicarPorta(porta));
  return c;
}

function _faseClicarPorta(porta) {
  const charNome = RPG_DATA?.linked || TOKEN_CTRL?.nomeSelecionado;
  usarPorta?.(MAPA_STATE.mapaAtualId, porta.id, charNome);
  // Re-render da porta
  const layer = FASE_STATE.worldContainer?.children?.find(c => c._portaId);
  if (layer) {
    const mapaW = (RPG_DATA?.mapas?.find(l => l.mapa.map_id === FASE_STATE.faseAtualId)?.mapa?.largura_total || 20) * 64;
    const mapaH = (RPG_DATA?.mapas?.find(l => l.mapa.map_id === FASE_STATE.faseAtualId)?.mapa?.altura_total  || 15) * 64;
    const sprite = FASE_STATE.worldContainer.children[1]; // elemLayer
    if (sprite) {
      const portaSprite = sprite.children.find(c => c._portaId === porta.id);
      if (portaSprite) {
        portaSprite.destroy();
        sprite.addChild(_faseCriarPortaSprite(porta, mapaW, mapaH));
      }
    }
  }
}

function _faseRenderBaus(layer, rd, mapaW, mapaH) {
  if (!rd.baus?.length) return;
  for (const bau of rd.baus) {
    const c = _faseCriarBauSprite(bau, mapaW, mapaH);
    layer.addChild(c);
    FASE_STATE.chunks['bau_' + bau.id] = { sprite: c };
  }
}

function _faseCriarBauSprite(bau, mapaW, mapaH) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  const cor = bau.aberto ? 0x7a5230 : (bau.trancado ? 0xe05050 : 0xc8a84b);
  g.beginFill(cor, 0.9);
  g.drawRoundedRect(-14, -10, 28, 20, 3);
  g.endFill();
  g.lineStyle(2, 0x050810, 0.7);
  g.drawRoundedRect(-14, -10, 28, 20, 3);
  if (!bau.aberto) {
    g.lineStyle(1, 0x050810, 0.5);
    g.moveTo(-14, 0); g.lineTo(14, 0);
  }

  const icon = new PIXI.Text(bau.aberto ? '📭' : (bau.trancado ? '🔒' : '📦'), {
    fontSize: 12, fill: 0xffffff
  });
  icon.anchor.set(0.5);
  icon.y = -24;

  c.addChild(g);
  c.addChild(icon);
  c.x = bau.x * mapaW;
  c.y = bau.y * mapaH;
  c.interactive = true;
  c.buttonMode  = true;
  c.on('pointerup', () => _faseAbrirBau(bau, c, mapaW, mapaH));
  return c;
}

function _faseAbrirBau(bau, sprite, mapaW, mapaH) {
  if (bau.aberto) { mostrarToast('Baú já aberto', ''); return; }
  if (bau.trancado) {
    const charNome = RPG_DATA?.linked || TOKEN_CTRL?.nomeSelecionado;
    const temChave = charNome && _charTemChave?.(charNome, FASE_STATE.faseAtualId, bau.chave_palavra);
    if (!temChave) { mostrarToast('🔐 Baú trancado. Precisa de: ' + bau.chave_palavra, 'aviso'); return; }
  }
  bau.aberto = true;
  sprite.destroy();

  const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === FASE_STATE.faseAtualId);
  if (entry) {
    salvarRenderData?.(entry.id, entry.mapa.render_data);
    const newSprite = _faseCriarBauSprite(bau, mapaW, mapaH);
    FASE_STATE.worldContainer?.children?.[1]?.addChild(newSprite);
  }

  mostrarToast('📭 Baú aberto!', 'ok');
  realtimeBroadcast?.('fase_bau_aberto', { mapa_id: FASE_STATE.faseAtualId, bau_id: bau.id });
}

function _faseRenderSpawnPoints(layer, rd, mapaW, mapaH) {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (!isMestre || !rd.spawn_jogadores?.length) return;
  for (const sp of rd.spawn_jogadores) {
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0x5ee09a, 0.6);
    g.drawCircle(0, 0, 16);
    const arr = new PIXI.Text(sp.tipo === 'saida' ? '↑' : '↓', {
      fontSize: 14, fill: 0x5ee09a
    });
    arr.anchor.set(0.5);
    const c = new PIXI.Container();
    c.addChild(g); c.addChild(arr);
    c.x = sp.x * mapaW;
    c.y = sp.y * mapaH;
    c.alpha = 0.7;
    layer.addChild(c);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ENTIDADES
// ════════════════════════════════════════════════════════════════════════════
function _faseRenderEntidades(layer, rd, mapaW, mapaH, tiltY) {
  if (!rd.entidades?.length) return;

  for (const ent of rd.entidades) {
    const runtime = {
      ...ent,
      worldX: ent.x * mapaW,
      worldY:  ent.y * mapaH,
      estado:  ent.estado || 'dormindo',
      _patrolIdx:    0,
      _patrolT:      0,
      _aggroAlvo:    null,
      _combateTimer: null,
    };

    // Sprite simples (círculo colorido com nome) — substituir por animado no futuro
    const sprite = _faseCriarEntidadeSprite(ent, tiltY);
    sprite.x = runtime.worldX;
    sprite.y = runtime.worldY;
    layer.addChild(sprite);
    runtime.sprite = sprite;

    FASE_STATE.entidades[ent.id] = runtime;
  }
}

function _faseCriarEntidadeSprite(ent, tiltY) {
  const c = new PIXI.Container();
  const cor = ent.tipo === 'boss' ? 0xdd3333 : (ent.tipo === 'npc' ? 0x5ee09a : 0xee7700);

  // Sombra no chão (aplica tilt para mesclar com o mapa)
  const sombra = new PIXI.Graphics();
  sombra.beginFill(0x000000, 0.3);
  sombra.drawEllipse(0, 0, 18, 8 * tiltY);
  sombra.endFill();
  sombra.y = 28;

  // Corpo (sem tilt — personagem "de pé")
  const corpo = new PIXI.Graphics();
  corpo.beginFill(cor, 0.9);
  corpo.drawCircle(0, 0, 18);
  corpo.endFill();
  corpo.lineStyle(2, 0x050810, 0.7);
  corpo.drawCircle(0, 0, 18);

  // Ícone de estado
  const iconMap = { dormindo: 'z', desperto: '!', patrulhando: '→', perseguindo: '!!' };
  const icone = new PIXI.Text(iconMap[ent.estado] || '?', {
    fontSize: 10, fill: 0xffffff, fontWeight: 'bold'
  });
  icone.anchor.set(0.5);

  // Nome
  const nome = new PIXI.Text(ent.nome.length > 10 ? ent.nome.slice(0, 9) + '…' : ent.nome, {
    fontSize: 9, fill: 0xffffff, dropShadow: true, dropShadowDistance: 1,
    dropShadowColor: 0x000000, dropShadowAlpha: 0.8
  });
  nome.anchor.set(0.5);
  nome.y = -32;

  c.addChild(sombra);
  c.addChild(corpo);
  c.addChild(icone);
  c.addChild(nome);
  c.interactive = true;
  c.buttonMode  = true;
  c.on('pointerup', () => _faseClicarEntidade(ent.id));
  c._entId = ent.id;
  return c;
}

function _faseClicarEntidade(entId) {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const ent = FASE_STATE.entidades[entId];
  if (!ent) return;
  const opcoes = ['dormindo', 'patrulhando', 'perseguindo', 'morto'];
  const atual  = opcoes.indexOf(ent.estado);
  const novo   = prompt(`Estado de "${ent.nome}" (dormindo/patrulhando/perseguindo/morto):`, ent.estado);
  if (novo && opcoes.includes(novo)) {
    ent.estado = novo;
    _faseAtualizarEntidadeSprite(ent);
    realtimeBroadcast?.('fase_entidade_estado', { ent_id: entId, estado: novo, mapa_id: FASE_STATE.faseAtualId });
  }
}

function _faseAtualizarEntidadeSprite(ent) {
  if (!ent.sprite) return;
  const iconMap = { dormindo: 'z', desperto: '!', patrulhando: '→', perseguindo: '!!', morto: '✕' };
  const iconText = ent.sprite.children?.[2]; // icone é o 3º filho
  if (iconText && iconText instanceof PIXI.Text) {
    iconText.text = iconMap[ent.estado] || '?';
  }
  // Opacidade: morto = 30%
  if (ent.sprite) ent.sprite.alpha = ent.estado === 'morto' ? 0.3 : 1.0;
}

// ── Loop de IA das entidades ──────────────────────────────────────────────
function _faseEntidadesLoop(layer, rd, mapaW, mapaH, tiltY, dt) {
  if (!FASE_STATE.iaAtiva) return;

  const jogadores = Object.values(FASE_STATE.jogadoresPos).filter(p => p?.worldX != null);

  for (const [id, ent] of Object.entries(FASE_STATE.entidades)) {
    if (ent.estado === 'morto') continue;

    const enDef = rd.entidades?.find(e => e.id === id);
    if (!enDef) continue;

    const aggroR = (enDef.aggro_radius  || 0.08) * mapaW;
    const sleepR = (enDef.sleep_radius  || 0.04) * mapaW;
    const speed  = 60; // px/s

    // Distância ao jogador mais próximo
    let minDist = Infinity, alvoProx = null;
    for (const jp of jogadores) {
      const d = Math.hypot(jp.worldX - ent.worldX, jp.worldY - ent.worldY);
      if (d < minDist) { minDist = d; alvoProx = jp; }
    }

    // Transições de estado
    if (ent.estado === 'dormindo') {
      if (alvoProx && minDist < sleepR) ent.estado = 'desperto';
    } else if (ent.estado === 'desperto' || ent.estado === 'patrulhando') {
      if (alvoProx && minDist < aggroR) {
        ent.estado = 'perseguindo';
        ent._aggroAlvo = alvoProx;
      } else if (enDef.patrol_path?.length > 1) {
        ent.estado = 'patrulhando';
        _fasePatrularStep(ent, enDef, mapaW, mapaH, speed, dt);
      }
    } else if (ent.estado === 'perseguindo') {
      if (!alvoProx || minDist > aggroR * 2) {
        ent.estado = 'patrulhando';
        ent._aggroAlvo = null;
      } else {
        _fasePerseguirStep(ent, alvoProx, speed, dt);
        // Quando alcança: dispara combate
        if (minDist < 32) {
          _faseTriggerCombate(ent, enDef);
        }
      }
    }

    // Atualizar sprite posição
    if (ent.sprite) {
      ent.sprite.x = ent.worldX;
      ent.sprite.y = ent.worldY;
    }
    _faseAtualizarEntidadeSprite(ent);
  }
}

function _fasePatrularStep(ent, enDef, mapaW, mapaH, speed, dt) {
  const path = enDef.patrol_path;
  if (!path?.length) return;
  const alvo = path[ent._patrolIdx % path.length];
  const ax = alvo.x * mapaW, ay = alvo.y * mapaH;
  const dx = ax - ent.worldX, dy = ay - ent.worldY;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    ent._patrolIdx = (ent._patrolIdx + 1) % path.length;
    return;
  }
  const move = speed * dt;
  ent.worldX += (dx / dist) * move;
  ent.worldY += (dy / dist) * move;
}

function _fasePerseguirStep(ent, alvo, speed, dt) {
  const dx = alvo.worldX - ent.worldX;
  const dy = alvo.worldY - ent.worldY;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return;
  const move = speed * 1.4 * dt; // mais rápido ao perseguir
  ent.worldX += (dx / dist) * move;
  ent.worldY += (dy / dist) * move;
}

let _faseCombateTimerAtivo = {};
function _faseTriggerCombate(ent, enDef) {
  if (_faseCombateTimerAtivo[ent.id]) return;
  _faseCombateTimerAtivo[ent.id] = true;
  ent.estado = 'timer_tatico';

  const timerS = enDef.combate_timer_s || 10;
  mostrarToast(`⚔ ${ent.nome} quer combate! ${timerS}s para aceitar...`, 'aviso');

  // Broadcast para todos os jogadores
  realtimeBroadcast?.('fase_combate_inicio', {
    mapa_id:   FASE_STATE.faseAtualId,
    ent_id:    ent.id,
    ent_nome:  ent.nome,
    timer_s:   timerS,
    combate_tipo: enDef.combate_tipo || 'tatico'
  });

  // Mostrar HUD de countdown
  _faseMostrarCombateTimer(ent, enDef, timerS);
}

function _faseMostrarCombateTimer(ent, enDef, timerS) {
  const hud = document.getElementById('fase-combate-hud');
  if (!hud) return;
  hud.style.display = 'flex';
  const nomEl = document.getElementById('fase-combate-nome');
  const cntEl = document.getElementById('fase-combate-countdown');
  if (nomEl) nomEl.textContent = ent.nome;

  let remaining = timerS;
  const iv = setInterval(() => {
    remaining--;
    if (cntEl) cntEl.textContent = remaining + 's';
    if (remaining <= 0) {
      clearInterval(iv);
      hud.style.display = 'none';
      delete _faseCombateTimerAtivo[ent.id];
      // Timeout: iniciar combate automaticamente
      if (ent.estado === 'timer_tatico') {
        ent.estado = 'combate_tatico';
        _faseIniciarCombateTatico(ent, enDef);
      }
    }
  }, 1000);
  ent._combateTimer = iv;
}

function _faseAceitarCombate(entId) {
  const ent    = FASE_STATE.entidades[entId];
  const entry  = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === FASE_STATE.faseAtualId);
  const enDef  = entry?.mapa?.render_data?.entidades?.find(e => e.id === entId);
  if (!ent || !enDef) return;
  if (ent._combateTimer) { clearInterval(ent._combateTimer); ent._combateTimer = null; }
  delete _faseCombateTimerAtivo[entId];
  document.getElementById('fase-combate-hud').style.display = 'none';
  ent.estado = 'combate_tatico';
  _faseIniciarCombateTatico(ent, enDef);
}

function _faseRecusarCombate(entId) {
  const ent = FASE_STATE.entidades[entId];
  if (!ent) return;
  if (ent._combateTimer) { clearInterval(ent._combateTimer); ent._combateTimer = null; }
  delete _faseCombateTimerAtivo[entId];
  document.getElementById('fase-combate-hud').style.display = 'none';
  ent.estado = 'patrulhando';
  mostrarToast('Recuou! Mantenha distância do inimigo.', '');
}

function _faseIniciarCombateTatico(ent, enDef) {
  // Integrar com o sistema tático existente
  if (typeof iniciarBatalha === 'function') {
    const participantes = [
      ...(Object.keys(FASE_STATE.jogadoresPos)),
      ent.nome
    ];
    mostrarToast(`⚔ Combate tático iniciado contra ${ent.nome}!`, 'aviso');
    // Chamar sistema existente — o mapa tático será usado para o combate
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CHUNK LOADING
// ════════════════════════════════════════════════════════════════════════════
function _faseChunksUpdate(bgLayer, elemLayer, world, mapaW, mapaH, rd) {
  // Determinar viewport em coordenadas do mundo
  if (!FASE_STATE.app) return;
  const app = FASE_STATE.app;
  const sw = app.renderer.width, sh = app.renderer.height;
  const wx = -world.x / world.scale.x;
  const wy = -world.y / world.scale.y;
  const ww = sw / world.scale.x;
  const wh = sh / world.scale.y;

  // Apenas marcar chunks como visíveis/invisíveis (a imagem de fundo já cobre tudo)
  // Chunks seriam usados para mapas procedurais muito grandes — stub para extensão futura
  const chunkSize = rd.chunk_size || FASE_CHUNK_SIZE;
  const colStart  = Math.max(0, Math.floor((wx - chunkSize) / chunkSize));
  const rowStart  = Math.max(0, Math.floor((wy - chunkSize) / chunkSize));
  const colEnd    = Math.min(Math.ceil(mapaW / chunkSize), Math.ceil((wx + ww + chunkSize) / chunkSize));
  const rowEnd    = Math.min(Math.ceil(mapaH / chunkSize), Math.ceil((wy + wh + chunkSize) / chunkSize));

  // Limpar chunks muito distantes (futuro: lazy-load de tiles procedurais)
  for (const [key, chunk] of Object.entries(FASE_STATE.chunks)) {
    if (key.startsWith('bau_')) continue; // não destruir sprites de baús
    if (!chunk.col && !chunk.row) continue;
    const isNear = chunk.col >= colStart - 1 && chunk.col <= colEnd + 1 &&
                   chunk.row >= rowStart - 1 && chunk.row <= rowEnd + 1;
    if (!isNear && chunk.container) {
      chunk.container.visible = false;
    } else if (chunk.container) {
      chunk.container.visible = true;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// JOGADORES
// ════════════════════════════════════════════════════════════════════════════
function _faseInicializarJogadores(rd, mapaW, mapaH) {
  const chars = (RPG_DATA?.characters || []).filter(c => {
    const ca = c.custom_attrs || {};
    return !['npc', 'criatura'].includes(ca.tipo_personagem) &&
           c.active_map_id === FASE_STATE.faseAtualId;
  });

  const spawn = rd.spawn_jogadores?.[0];
  const sx = spawn ? spawn.x * mapaW : mapaW * 0.5;
  const sy = spawn ? spawn.y * mapaH : mapaH * 0.9;

  chars.forEach((c, i) => {
    FASE_STATE.jogadoresPos[c.nome] = {
      worldX: sx + i * 32,
      worldY: sy
    };
  });

  // Se nenhum jogador no mapa, usar posição central
  if (!chars.length && RPG_DATA?.linked) {
    FASE_STATE.jogadoresPos[RPG_DATA.linked] = { worldX: sx, worldY: sy };
  }
}

// Atualizar posição de jogador (chamado do sistema de tokens/realtime)
function faseAtualizarPosJogador(charNome, worldX, worldY) {
  FASE_STATE.jogadoresPos[charNome] = { worldX, worldY };

  // Atualizar sprite do token se existir
  const tokenLayer = FASE_STATE._tokenLayer;
  if (!tokenLayer) return;
  let tokenSprite = tokenLayer.children.find(c => c._charNome === charNome);
  if (!tokenSprite) {
    tokenSprite = _faseCriarTokenSprite(charNome);
    tokenLayer.addChild(tokenSprite);
  }
  tokenSprite.x = worldX;
  tokenSprite.y = worldY;
}

function _faseCriarTokenSprite(charNome) {
  const char = (RPG_DATA?.characters || []).find(c => c.nome === charNome);
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.beginFill(0x4fa3d1, 0.9);
  g.drawCircle(0, 0, 16);
  g.endFill();
  g.lineStyle(2, 0xffffff, 0.8);
  g.drawCircle(0, 0, 16);

  const nome = new PIXI.Text(charNome.slice(0, 6), {
    fontSize: 8, fill: 0xffffff, fontWeight: 'bold'
  });
  nome.anchor.set(0.5);
  nome.y = -28;

  c.addChild(g); c.addChild(nome);
  c._charNome = charNome;
  return c;
}

// ════════════════════════════════════════════════════════════════════════════
// INPUT DE MOVIMENTO
// ════════════════════════════════════════════════════════════════════════════
function _faseMontarInputMovimento(app, world, mapaW, mapaH, rd) {
  // Pan manual para o mestre (drag)
  let _isPanning = false, _panStart = {x:0, y:0}, _panOrigin = {x:0, y:0};

  app.view.addEventListener('pointerdown', e => {
    if (!FASE_STATE.modoMestre) return;
    _isPanning = true;
    _panStart  = { x: e.clientX, y: e.clientY };
    _panOrigin = { x: world.x, y: world.y };
  });
  app.view.addEventListener('pointermove', e => {
    if (!_isPanning) return;
    world.x = _panOrigin.x + (e.clientX - _panStart.x);
    world.y = _panOrigin.y + (e.clientY - _panStart.y);
    FASE_STATE._cameraLerp.x = world.x;
    FASE_STATE._cameraLerp.y = world.y;
  });
  const _endPan = () => { _isPanning = false; };
  app.view.addEventListener('pointerup',     _endPan);
  app.view.addEventListener('pointercancel', _endPan);

  // Scroll zoom para mestre
  app.view.addEventListener('wheel', e => {
    if (!FASE_STATE.modoMestre) return;
    e.preventDefault();
    const delta  = e.deltaY < 0 ? 1.1 : 0.91;
    const newZ   = Math.max(FASE_MIN_ZOOM, Math.min(FASE_MAX_ZOOM, world.scale.x * delta));
    const rect   = app.view.getBoundingClientRect();
    const px     = e.clientX - rect.left;
    const py     = e.clientY - rect.top;
    world.x      = px - (px - world.x) * (newZ / world.scale.x);
    world.y      = py - (py - world.y) * (newZ / world.scale.y);
    world.scale.set(newZ, newZ);
    FASE_STATE._cameraLerp = { x: world.x, y: world.y, zoom: newZ };
  }, { passive: false });

  // Click no mapa para mover jogador vinculado (modo jogador)
  app.view.addEventListener('pointerup', e => {
    if (FASE_STATE.modoMestre) return;
    const myChar = RPG_DATA?.linked;
    if (!myChar) return;
    const rect = app.view.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - world.x) / world.scale.x;
    const worldY = (screenY - world.y) / world.scale.y;

    // Verificar colisão com paredes antes de mover (simples AABB)
    if (_faseColisaoParede(rd, worldX, worldY, mapaW, mapaH)) return;

    faseAtualizarPosJogador(myChar, worldX, worldY);
    realtimeBroadcast?.('fase_jogador_pos', {
      mapa_id: FASE_STATE.faseAtualId,
      char: myChar,
      worldX, worldY
    });
  });
}

function _faseColisaoParede(rd, wx, wy, mapaW, mapaH, radius = 12) {
  if (!rd.paredes?.length) return false;
  for (const p of rd.paredes) {
    if (p.tipo === 'transparente') continue;
    const x1 = p.x1 * mapaW, y1 = p.y1 * mapaH;
    const x2 = p.x2 * mapaW, y2 = p.y2 * mapaH;
    // Distância ponto à linha
    const len2 = (x2-x1)**2 + (y2-y1)**2;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((wx-x1)*(x2-x1) + (wy-y1)*(y2-y1)) / len2));
    const px = x1 + t*(x2-x1), py = y1 + t*(y2-y1);
    if (Math.hypot(wx-px, wy-py) < radius) return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════════════════════════
function _faseMontarHUD(container, rd) {
  // Remover HUD anterior se existir
  document.getElementById('fase-hud')?.remove();

  const isMestre = RPG_DATA?.myRole === 'mestre';

  const hud = document.createElement('div');
  hud.id = 'fase-hud';
  hud.style.cssText = `position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:6px;z-index:100;pointer-events:none`;

  if (isMestre) {
    hud.innerHTML = `
      <div style="pointer-events:auto;display:flex;flex-direction:column;gap:5px">
        <button onclick="faseModoMestreToggle()" id="fase-btn-modo"
          style="padding:7px 12px;background:rgba(5,8,16,0.88);border:1px solid rgba(200,168,75,0.4);border-radius:8px;color:#c8a84b;font-family:var(--fonte-d,monospace);font-size:0.62rem;cursor:pointer;backdrop-filter:blur(4px)">
          🗺 Visão Completa
        </button>
        <button onclick="faseIAToggle()" id="fase-btn-ia"
          style="padding:7px 12px;background:rgba(5,8,16,0.88);border:1px solid rgba(79,163,209,0.4);border-radius:8px;color:#4fa3d1;font-family:var(--fonte-d,monospace);font-size:0.62rem;cursor:pointer;backdrop-filter:blur(4px)">
          🤖 IA Ativa
        </button>
        <button onclick="abrirModalFaseConfig('${FASE_STATE.faseAtualId}')"
          style="padding:7px 12px;background:rgba(5,8,16,0.88);border:1px solid rgba(200,168,75,0.3);border-radius:8px;color:var(--suave,#7a92aa);font-family:var(--fonte-d,monospace);font-size:0.62rem;cursor:pointer;backdrop-filter:blur(4px)">
          ⚙ Configurar Fase
        </button>
      </div>`;
  }

  container.appendChild(hud);

  // HUD de combate (separado, aparece quando entidade aciona combate)
  document.getElementById('fase-combate-hud')?.remove();
  const combateHud = document.createElement('div');
  combateHud.id = 'fase-combate-hud';
  combateHud.style.cssText = `display:none;position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(5,8,16,0.95);border:2px solid #e05050;border-radius:12px;padding:16px 24px;text-align:center;z-index:200;flex-direction:column;gap:10px;min-width:240px;backdrop-filter:blur(6px)`;
  combateHud.innerHTML = `
    <div style="font-family:var(--fonte-d,monospace);color:#e05050;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em">⚔ Combate Iminente</div>
    <div id="fase-combate-nome" style="font-family:var(--fonte-d,monospace);color:#fff;font-size:0.9rem;font-weight:bold"></div>
    <div id="fase-combate-countdown" style="font-family:var(--fonte-d,monospace);color:#f0cc6a;font-size:1.4rem;font-weight:bold"></div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button onclick="faseAceitarCombate()" style="padding:8px 18px;background:rgba(224,80,80,0.2);border:1px solid #e05050;border-radius:6px;color:#e05050;font-family:var(--fonte-d,monospace);font-size:0.65rem;cursor:pointer">⚔ Lutar</button>
      <button onclick="faseRecusarCombate()" style="padding:8px 18px;background:rgba(94,224,154,0.1);border:1px solid #5ee09a;border-radius:6px;color:#5ee09a;font-family:var(--fonte-d,monospace);font-size:0.65rem;cursor:pointer">🏃 Recuar</button>
    </div>`;
  container.appendChild(combateHud);
}

// ── Funções globais do HUD ─────────────────────────────────────────────────
function faseModoMestreToggle() {
  FASE_STATE.modoMestre = !FASE_STATE.modoMestre;
  const btn = document.getElementById('fase-btn-modo');
  if (btn) {
    btn.textContent = FASE_STATE.modoMestre ? '📍 Seguir Jogadores' : '🗺 Visão Completa';
    btn.style.borderColor = FASE_STATE.modoMestre ? 'rgba(94,224,154,0.5)' : 'rgba(200,168,75,0.4)';
    btn.style.color = FASE_STATE.modoMestre ? '#5ee09a' : '#c8a84b';
  }
  mostrarToast(FASE_STATE.modoMestre ? '🗺 Visão completa (pan manual)' : '📍 Câmera segue jogadores', '');
}

function faseIAToggle() {
  FASE_STATE.iaAtiva = !FASE_STATE.iaAtiva;
  const btn = document.getElementById('fase-btn-ia');
  if (btn) {
    btn.textContent = FASE_STATE.iaAtiva ? '🤖 IA Ativa' : '🎮 IA Desligada';
    btn.style.borderColor = FASE_STATE.iaAtiva ? 'rgba(79,163,209,0.4)' : 'rgba(200,168,75,0.3)';
    btn.style.color = FASE_STATE.iaAtiva ? '#4fa3d1' : '#c8a84b';
  }
  mostrarToast(FASE_STATE.iaAtiva ? '🤖 IA das entidades ativada' : '🎮 IA desligada — controle manual', '');
}

// Wrapper para aceitar/recusar combate sem precisar do entId explícito no HTML
function faseAceitarCombate() {
  const entId = Object.keys(_faseCombateTimerAtivo)[0];
  if (entId) _faseAceitarCombate(entId);
}
function faseRecusarCombate() {
  const entId = Object.keys(_faseCombateTimerAtivo)[0];
  if (entId) _faseRecusarCombate(entId);
}
