// ─── Studio Pixi — Adventure Mode Integration ────────────────────────────────
// Plays pixi_animations by ID during adventure mode combat/skill use.
// Depends on: aventura.js (_avtPixiParticleAnim, _avtEnsurePixiParticles,
//              _avtProcTextures, AVT_STATE), pixi-studio.js (PIXI_STUDIO_STATE)

var _PS_AVT_ACTIVE = [];  // { app, overlayCanvas, emitters, trackFn, timerId }

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
        role:      l.nome || 'layer',
        texture:   l.texture_url ? null : (l.texture || 'spark'),
        textures:  l.texture_url ? [l.texture_url] : undefined,
        blendMode: l.blendMode || 'add',
        z:         l.z ?? 3,
        glow:      l.glow || null,
        trail:     l.trail_config || null,
        emitter:   l.emitter,
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
    default:
      // one-shot, loop, aoe — route through existing pipeline
      const avtCfg = _psToAvtConfig(cfg);
      if (avtCfg && typeof _avtPixiParticleAnim === 'function') {
        _avtPixiParticleAnim(avtCfg, atacScr, alvoScr, posicao);
      }
      return 0;
  }
}

// ── Projectile: emitter travels from caster to target ─────────────────────
function _psAvtProjectile(cfg, atacScr, alvoScr) {
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
      if (!l.visivel || l.tipo !== 'emitter' || !l.emitter) continue;
      const container = new PIXI.Container();
      container.blendMode = bm[l.blendMode] ?? PIXI.BLEND_MODES.ADD;
      worldRoot.addChild(container);

      let emitCfg = Object.assign({}, l.emitter);
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
    }

    let lastTs = performance.now();
    const trackFn = () => {
      const now = performance.now();
      const delta = (now - lastTs) / 1000;
      lastTs = now;
      const scr = _psAvtToScreen(targetEnt);
      for (const em of emitters) {
        if (!em.destroyed) { em.updateSpawnPos(scr.x, scr.y); em.update(delta); }
      }
    };

    app.ticker.add(trackFn);

    const cleanup = () => {
      app.ticker.remove(trackFn);
      for (const em of emitters) {
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
