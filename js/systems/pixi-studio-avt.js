// ─── Studio Pixi — Adventure Mode Integration ────────────────────────────────
// Plays pixi_animations by ID during adventure mode combat/skill use.
// Depends on: aventura.js (_avtPixiParticleAnim, _avtEnsurePixiParticles,
//              _avtProcTextures, AVT_STATE), pixi-studio.js (PIXI_STUDIO_STATE)

var _PS_AVT_ACTIVE = [];  // { app, overlayCanvas, emitters, trackFn, timerId }

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
  const avt = {
    duration:   cfg.duracao_ms   || 1000,
    lighting:   cfg.lighting     || {},
    camera:     cfg.camera       || {},
    background: cfg.background   || {},
    layers: [],
  };
  const layers = cfg.layers || [];
  for (const l of layers) {
    if (!l.visivel) continue;
    if (l.tipo === 'emitter' && l.emitter) {
      avt.layers.push({
        role:       l.nome || 'layer',
        texture:    l.texture_url ? null : (l.texture || 'spark'),
        textures:   l.texture_url ? [l.texture_url] : undefined,
        blendMode:  l.blendMode || 'add',
        z:          l.z ?? 3,
        glow:       l.glow || null,
        trail:      l.trail_config || null,
        emitter:    l.emitter,
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
      const f = (t - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
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

  const durMs = cfg.duracao_ms || 1000;
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
        sp.x = startScr.x + (kf.x ?? 0);
        sp.y = startScr.y + (kf.y ?? 0);
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

// ── Render emitter layers following their recorded spawn_path ─────────────────
// Uses a similarity transform to map studio-space → screen-space.
async function _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr) {
  const layers = (cfg.layers || []).filter(l => l.emitter);
  if (!layers.length) return;

  await _avtEnsurePixiParticles();
  if (typeof PIXI === 'undefined') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;

  const durMs = cfg.duracao_ms || 1000;
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
        em.updateSpawnPos(alvoScr.x, alvoScr.y);
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
  const durMs     = cfg.duracao_ms || 1000;
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

  switch (behavior) {
    case 'projectile':
      return _psAvtProjectile(cfg, atacScr, alvoScr);
    case 'follow-caster':
    case 'channel':
      _psAvtFollow(cfg, atacanteEnt, durMs);
      return 0;
    case 'follow-target':
      _psAvtFollow(cfg, alvoEnt, durMs);
      return 0;
    case 'chain':
      _psAvtChain(cfg, atacanteEnt, alvoEnt, isAreaMode);
      return 0;
    default: {
      // one-shot, loop, aoe — prefer spawn_path if present, else existing pipeline
      const hasPath = (cfg.layers || []).some(l => l.tipo === 'emitter' && l.spawn_path?.length);
      if (hasPath) {
        _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr);
      } else {
        const avtCfg = _psToAvtConfig(cfg);
        if (avtCfg && typeof _avtPixiParticleAnim === 'function') {
          _avtPixiParticleAnim(avtCfg, atacScr, alvoScr, posicao);
        }
      }
      _psAvtRenderSprites(cfg, atacScr, alvoScr, behavior);
      return 0;
    }
  }
}

// ── Projectile: emitter travels from caster to target ─────────────────────
function _psAvtProjectile(cfg, atacScr, alvoScr) {
  const hasSpawnPath = (cfg.layers || []).some(l => l.tipo === 'emitter' && l.spawn_path?.length);

  // If any emitter layer has a recorded spawn_path, respect it exactly
  if (hasSpawnPath) {
    _psAvtRenderWithSpawnPath(cfg, atacScr, alvoScr);
    _psAvtRenderSprites(cfg, atacScr, alvoScr, 'projectile');
    return cfg.duracao_ms || 1000;
  }

  const speedMs = cfg.behavior_config?.projectile_speed_ms || 500;
  const dur     = cfg.duracao_ms || 1200;
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

window.avtPixiPlayAnimation  = avtPixiPlayAnimation;
window.avtPixiCleanupAll     = avtPixiCleanupAll;
