// characters/anim-renderer.js
// PixiJS Particle Renderer — personagem e equipamentos como nuvens de partículas

window._animCtrlMap = window._animCtrlMap || {};

// ── Bone definitions ─────────────────────────────────────────────────────────
const _ANIM_BONE_CFG = {
  torso:        { parentOffset: [0, -22],   imgW: 30, imgH: 46, pivot: [0.5, 0.47], children: ['head','arm_upper_l','arm_upper_r','leg_upper_l','leg_upper_r'] },
  head:         { parentOffset: [0, -38],   imgW: 30, imgH: 30, pivot: [0.5, 0.87], children: [] },
  arm_upper_l:  { parentOffset: [-20, -22], imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: ['arm_lower_l'] },
  arm_lower_l:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: [] },
  arm_upper_r:  { parentOffset: [20, -22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: ['arm_lower_r'] },
  arm_lower_r:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: [] },
  leg_upper_l:  { parentOffset: [-11, 22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: ['leg_lower_l'] },
  leg_lower_l:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: [] },
  leg_upper_r:  { parentOffset: [11,  22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: ['leg_lower_r'] },
  leg_lower_r:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], children: [] }
};

// Draw order (painter's algorithm)
const _ANIM_DRAW_ORDER = [
  'arm_lower_l', 'arm_upper_l',
  'leg_lower_l', 'leg_upper_l',
  'leg_lower_r', 'leg_upper_r',
  'torso',
  'arm_upper_r', 'arm_lower_r',
  'head'
];

// Bone → equipment slot
const _EQUIP_ATTACH = {
  arm_lower_r: 'weapon_r',
  arm_lower_l: 'shield',
  head:        'helmet',
  torso:       'chest_armor'
};

// ── PixiJS Lazy Loader ───────────────────────────────────────────────────────
let _pixiLoadPromise = null;
function _pixiEnsureLoaded() {
  if (_pixiLoadPromise) return _pixiLoadPromise;
  if (window.PIXI) { _pixiLoadPromise = Promise.resolve(); return _pixiLoadPromise; }
  _pixiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('[AnimRenderer] Falha ao carregar PixiJS'));
    document.head.appendChild(s);
  });
  return _pixiLoadPromise;
}

// ── Color Helpers ────────────────────────────────────────────────────────────
function _hexToPixi(hex) {
  if (!hex || typeof hex !== 'string') return 0xffffff;
  return parseInt(hex.replace('#', ''), 16);
}

function _boneColors(boneId, palette) {
  const p = palette || {};
  const primary   = _hexToPixi(p.primary   || '#4488cc');
  const secondary = _hexToPixi(p.secondary || '#226699');
  const skin      = _hexToPixi(p.skin      || '#e8c090');
  const hair      = _hexToPixi(p.hair      || '#664422');
  const accent    = _hexToPixi(p.accent    || '#ffcc44');
  const outline   = _hexToPixi(p.outline   || '#112244');

  switch (boneId) {
    case 'head':              return [skin, skin, hair, outline];
    case 'torso':             return [primary, primary, secondary, outline];
    case 'arm_upper_l':
    case 'arm_upper_r':       return [primary, secondary];
    case 'arm_lower_l':
    case 'arm_lower_r':       return [secondary, skin];
    case 'leg_upper_l':
    case 'leg_upper_r':       return [secondary, primary];
    case 'leg_lower_l':
    case 'leg_lower_r':       return [secondary, outline];
    case 'equip_weapon_r':    return [accent, 0xffffff, accent, 0xffffaa];
    case 'equip_shield':      return [accent, secondary, accent];
    case 'equip_helmet':      return [accent, primary, 0xffffff];
    case 'equip_chest_armor': return [accent, primary, secondary];
    default:                  return [primary];
  }
}

function _boneParticleCount(boneId) {
  const counts = {
    head: 28, torso: 45,
    arm_upper_l: 16, arm_lower_l: 13,
    arm_upper_r: 16, arm_lower_r: 13,
    leg_upper_l: 16, leg_lower_l: 11,
    leg_upper_r: 16, leg_lower_r: 11,
    equip_weapon_r: 22, equip_shield: 16,
    equip_helmet: 14, equip_chest_armor: 12
  };
  return counts[boneId] || 10;
}

// ── Keyframe Interpolation ───────────────────────────────────────────────────
function _animLerp(track, t, duration) {
  if (!track || !track.length) return {};
  const tMod = t % duration;
  let before = track[0];
  let after = track[track.length - 1];
  for (let i = 0; i < track.length - 1; i++) {
    if (tMod >= track[i].t && tMod <= track[i + 1].t) {
      before = track[i]; after = track[i + 1]; break;
    }
  }
  const span = after.t - before.t;
  const alpha = span > 0 ? (tMod - before.t) / span : 0;
  const lerp = (a, b) => a + (b - a) * alpha;
  return {
    rotation:  lerp(before.rotation  ?? 0, after.rotation  ?? 0),
    x_offset:  lerp(before.x_offset  ?? 0, after.x_offset  ?? 0),
    y_offset:  lerp(before.y_offset  ?? 0, after.y_offset  ?? 0),
    scale:     lerp(before.scale     ?? 1, after.scale     ?? 1)
  };
}

// ── Forward Kinematics ───────────────────────────────────────────────────────
function _animComputeTransforms(rootX, rootY, animTf, boneTransforms) {
  function walk(boneId, parentX, parentY, parentRot) {
    const bc = _ANIM_BONE_CFG[boneId];
    if (!bc) return;
    const anim = animTf[boneId] || {};
    const dx = bc.parentOffset[0] + (anim.x_offset || 0);
    const dy = bc.parentOffset[1] + (anim.y_offset || 0);
    const cos = Math.cos(parentRot), sin = Math.sin(parentRot);
    const worldX = parentX + cos * dx - sin * dy;
    const worldY = parentY + sin * dx + cos * dy;
    const worldRot = parentRot + (anim.rotation || 0) * Math.PI / 180;
    boneTransforms.set(boneId, { x: worldX, y: worldY, rot: worldRot });
    (bc.children || []).forEach(childId => walk(childId, worldX, worldY, worldRot));
  }
  walk('torso', rootX, rootY - 22, 0);
}

// ── Particle System ──────────────────────────────────────────────────────────

function _makeCircleTex(app, radius) {
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff);
  g.drawCircle(0, 0, radius);
  g.endFill();
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function _spawnParticle(p, halfW, halfH, colors) {
  p.x  = (Math.random() - 0.5) * halfW * 2;
  p.y  = (Math.random() - 0.5) * halfH * 2;
  p.vx = (Math.random() - 0.5) * 0.4;
  p.vy = (Math.random() - 0.5) * 0.4;
  p.color = colors[Math.floor(Math.random() * colors.length)];
  p.sprite.tint = p.color;
  p.maxLife = 50 + Math.random() * 110;
  p.life    = Math.random() * p.maxLife;
  p.sprite.alpha = 0;
}

function _createEmitter(app, boneId, imgW, imgH, colors, pivotX, pivotY, tex) {
  const count  = _boneParticleCount(boneId);
  // Center of bone body in joint-local space
  const cx = (0.5 - pivotX) * imgW;
  const cy = (0.5 - pivotY) * imgH;
  const halfW = imgW * 0.5;
  const halfH = imgH * 0.5;

  const container = new PIXI.Container();
  const particles = [];

  for (let i = 0; i < count; i++) {
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    // Offset sprites by bone center so cluster is centered on the body part
    const p = { sprite, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: colors[0], cx, cy, halfW, halfH };
    _spawnParticle(p, halfW, halfH, colors);
    sprite.x = cx + p.x;
    sprite.y = cy + p.y;
    container.addChild(sprite);
    particles.push(p);
  }

  return { container, particles, colors, boneId, cx, cy, halfW, halfH };
}

function _tickEmitter(emitter, tf, animState, delta, elapsed) {
  const { container, particles, colors, boneId, cx, cy, halfW, halfH } = emitter;

  container.x        = tf.x;
  container.y        = tf.y;
  container.rotation = tf.rot;

  const isLeg    = boneId.startsWith('leg');
  const isTorso  = boneId === 'torso';
  const isWeapon = boneId === 'equip_weapon_r';
  const isEquip  = boneId.startsWith('equip_');
  const isHead   = boneId === 'head';

  const walkMult   = animState === 'walk'   ? 2.5 : 1;
  const attackMult = animState === 'attack' ? 3.5 : 1;

  for (const p of particles) {
    p.life += delta;

    // Velocity modulation by state
    let vx = p.vx, vy = p.vy;
    if (isLeg && animState === 'walk') vy += 0.04 * delta;
    if (isWeapon && animState === 'attack') {
      vx *= 1.08;
      vy *= 1.08;
    }
    p.x += vx * delta * (isEquip ? 1.4 : 1);
    p.y += vy * delta * (isEquip ? 1.4 : 1);

    // Alpha lifecycle: fade in → hold → fade out
    const ratio = p.life / p.maxLife;
    let alpha;
    if (ratio < 0.12)      alpha = ratio / 0.12;
    else if (ratio > 0.72) alpha = (1 - ratio) / 0.28;
    else                   alpha = 1;

    // Breathing pulse on torso
    if (isTorso) alpha *= 0.55 + 0.45 * Math.sin(elapsed * 0.0018 + p.life * 0.008);
    // Glow flicker on equipment
    if (isEquip) alpha *= 0.7 + 0.3 * Math.sin(elapsed * 0.006 + p.life * 0.05);
    // Subtle shimmer on head
    if (isHead)  alpha *= 0.8 + 0.2 * Math.sin(elapsed * 0.002 + p.life * 0.015);

    p.sprite.alpha = Math.max(0, Math.min(1, alpha * (isEquip ? 0.95 : 0.82)));
    p.sprite.x = cx + p.x;
    p.sprite.y = cy + p.y;

    // Respawn if dead or out of bounds
    if (p.life >= p.maxLife || Math.abs(p.x) > halfW * 1.1 || Math.abs(p.y) > halfH * 1.1) {
      _spawnParticle(p, halfW, halfH, colors);
    }
  }
}

// ── Mount / Controller ───────────────────────────────────────────────────────

function animRendererMount(container, animadoData, opts = {}) {
  const W = opts.width  || 120;
  const H = opts.height || 180;

  container.innerHTML = '';

  // Synchronous placeholder so callers can access .canvas immediately
  const placeholder = document.createElement('canvas');
  placeholder.width  = W * 2;
  placeholder.height = H * 2;
  placeholder.style.cssText = `width:${W}px;height:${H}px;display:block`;
  container.appendChild(placeholder);

  let _app        = null;
  let _paused     = false;
  let _destroyed  = false;
  let _animState  = opts.animName || 'idle';
  let _currentAnim = _animState;
  let _startTime  = performance.now();
  let _emitters   = new Map();
  let _equipEmitters = new Map();
  let _smallTex   = null;
  let _equipTex   = null;

  function _addEquipEmitter(slot) {
    if (!_app || _equipEmitters.has(slot)) return;
    const emitterId  = 'equip_' + slot;
    const colors     = _boneColors(emitterId, animadoData.palette || {});
    const emitter    = _createEmitter(_app, emitterId, 20, 36, colors, 0.5, 0.1, _equipTex);
    _app.stage.addChild(emitter.container);
    _equipEmitters.set(slot, emitter);
  }

  function _removeEquipEmitter(slot) {
    const em = _equipEmitters.get(slot);
    if (em) em.container.visible = false;
  }

  const ctrl = {
    play() {
      _paused = false;
      if (_app) _app.ticker.start();
    },
    pause() {
      _paused = true;
      if (_app) _app.ticker.stop();
    },
    setAnimation(name) {
      const animDef = animadoData.animations?.[name];
      if (!animDef) return;
      _currentAnim = name;
      _animState   = name;
      _startTime   = performance.now();
      if (animDef.loop === false) {
        setTimeout(() => { _currentAnim = 'idle'; _animState = 'idle'; }, animDef.duration || 600);
      }
    },
    setEquipment(slot, equipData) {
      if (!animadoData.equipment_slots) animadoData.equipment_slots = {};
      animadoData.equipment_slots[slot] = equipData;
      if (_app) {
        if (equipData) { _addEquipEmitter(slot); if (_equipEmitters.has(slot)) _equipEmitters.get(slot).container.visible = true; }
        else _removeEquipEmitter(slot);
      }
    },
    destroy() {
      _paused   = true;
      _destroyed = true;
      if (_app) { _app.destroy(true, { children: true }); _app = null; }
      else placeholder.remove();
    },
    canvas: placeholder
  };

  // Async PixiJS init
  _pixiEnsureLoaded().then(() => {
    if (_destroyed) return;

    // Capture CSS applied to placeholder by callers (e.g. token size)
    const placeholderStyle = placeholder.style.cssText;
    container.innerHTML = '';

    _app = new PIXI.Application({
      width:           W,
      height:          H,
      backgroundAlpha: 0,
      antialias:       false,
      resolution:      1
    });
    container.appendChild(_app.view);
    _app.view.style.cssText = placeholderStyle || `width:${W}px;height:${H}px;display:block`;
    ctrl.canvas = _app.view;

    const palette = animadoData.palette || {};

    // Shared textures
    _smallTex = _makeCircleTex(_app, 1.2);
    _equipTex = _makeCircleTex(_app, 1.8);

    // Bone emitters in draw order
    for (const boneId of _ANIM_DRAW_ORDER) {
      const bc     = _ANIM_BONE_CFG[boneId];
      const colors = _boneColors(boneId, palette);
      const emitter = _createEmitter(_app, boneId, bc.imgW, bc.imgH, colors, bc.pivot[0], bc.pivot[1], _smallTex);
      _app.stage.addChild(emitter.container);
      _emitters.set(boneId, emitter);
    }

    // Equipment emitters for already-equipped slots
    const equipSlots = animadoData.equipment_slots || {};
    for (const [slot, equipData] of Object.entries(equipSlots)) {
      if (equipData) _addEquipEmitter(slot);
    }

    _startTime = performance.now();

    _app.ticker.add((delta) => {
      if (_paused) return;

      const elapsed  = performance.now() - _startTime;
      const animDef  = animadoData.animations?.[_currentAnim];
      if (!animDef) return;

      const duration = animDef.duration || 2000;
      const t = animDef.loop !== false ? elapsed % duration : Math.min(elapsed, duration);

      // Interpolate keyframes
      const animTf = {};
      for (const [boneId, track] of Object.entries(animDef.tracks || {})) {
        animTf[boneId] = _animLerp(track, t, duration);
      }

      // Forward kinematics
      const boneTransforms = new Map();
      _animComputeTransforms(W / 2, H / 2 + 5, animTf, boneTransforms);

      // Tick bone emitters
      for (const boneId of _ANIM_DRAW_ORDER) {
        const tf = boneTransforms.get(boneId);
        if (!tf) continue;
        const em = _emitters.get(boneId);
        if (em) _tickEmitter(em, tf, _animState, delta, elapsed);

        // Equipment emitter attached to this bone
        const eSlot = _EQUIP_ATTACH[boneId];
        if (eSlot) {
          const eEm = _equipEmitters.get(eSlot);
          if (eEm && eEm.container.visible) {
            const eData = animadoData.equipment_slots?.[eSlot];
            const fakeTf = {
              x:   tf.x + (eData?.offset?.[0] || 0),
              y:   tf.y + (eData?.offset?.[1] || 0) - 8,
              rot: tf.rot + (eData?.rotation  || 0) * Math.PI / 180
            };
            _tickEmitter(eEm, fakeTf, _animState, delta, elapsed);
          }
        }
      }
    });

    if (_paused) _app.ticker.stop();
  }).catch(err => {
    console.error('[AnimRenderer] Falha ao inicializar PixiJS:', err);
  });

  return ctrl;
}

// ── Static Frame ─────────────────────────────────────────────────────────────

async function animRendererStaticFrame(animadoData, width, height, animName, t) {
  await _pixiEnsureLoaded();

  const W = width  || 120;
  const H = height || 180;

  const app = new PIXI.Application({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1 });
  const palette = animadoData.palette || {};
  const animDef = animadoData.animations?.[animName || 'idle'];
  const duration = animDef?.duration || 2000;
  const tVal = t ?? 500;

  const animTf = {};
  for (const [boneId, track] of Object.entries(animDef?.tracks || {})) {
    animTf[boneId] = _animLerp(track, tVal, duration);
  }

  const boneTransforms = new Map();
  _animComputeTransforms(W / 2, H / 2 + 5, animTf, boneTransforms);

  const smallTex = _makeCircleTex(app, 1.2);
  const equipTex = _makeCircleTex(app, 1.8);

  for (const boneId of _ANIM_DRAW_ORDER) {
    const bc  = _ANIM_BONE_CFG[boneId];
    const tf  = boneTransforms.get(boneId);
    if (!tf) continue;
    const colors  = _boneColors(boneId, palette);
    const emitter = _createEmitter(app, boneId, bc.imgW, bc.imgH, colors, bc.pivot[0], bc.pivot[1], smallTex);
    // Age particles to middle of lifecycle for filled appearance
    for (const p of emitter.particles) {
      p.life = p.maxLife * 0.4;
      p.sprite.x = emitter.cx + p.x;
      p.sprite.y = emitter.cy + p.y;
      p.sprite.alpha = 0.75;
    }
    emitter.container.x        = tf.x;
    emitter.container.y        = tf.y;
    emitter.container.rotation = tf.rot;
    app.stage.addChild(emitter.container);
  }

  // Equipment
  const equipSlots = animadoData.equipment_slots || {};
  for (const [slot, eData] of Object.entries(equipSlots)) {
    if (!eData) continue;
    const boneId = Object.keys(_EQUIP_ATTACH).find(k => _EQUIP_ATTACH[k] === slot);
    const tf = boneId ? boneTransforms.get(boneId) : null;
    if (!tf) continue;
    const emitterId = 'equip_' + slot;
    const colors    = _boneColors(emitterId, palette);
    const emitter   = _createEmitter(app, emitterId, 20, 36, colors, 0.5, 0.1, equipTex);
    for (const p of emitter.particles) {
      p.life = p.maxLife * 0.4;
      p.sprite.x = emitter.cx + p.x;
      p.sprite.y = emitter.cy + p.y;
      p.sprite.alpha = 0.85;
    }
    emitter.container.x        = tf.x + (eData.offset?.[0] || 0);
    emitter.container.y        = tf.y + (eData.offset?.[1] || 0) - 8;
    emitter.container.rotation = tf.rot + (eData.rotation || 0) * Math.PI / 180;
    app.stage.addChild(emitter.container);
  }

  app.renderer.render(app.stage);
  let dataUrl;
  try {
    dataUrl = app.renderer.extract.base64(app.stage);
  } catch (e) {
    dataUrl = app.view.toDataURL('image/png');
  }
  app.destroy(true, { children: true });
  return dataUrl;
}

// ── Update Equipment Live ─────────────────────────────────────────────────────

function animRendererUpdateEquipment(ctrl, slot, equipData) {
  if (!ctrl) return;
  ctrl.setEquipment(slot, equipData);
}

// ── Map Token Animation Integration ──────────────────────────────────────────

function _animMontarTokensNoMapa() {
  document.querySelectorAll('.animado-token-mount').forEach(mount => {
    const charNome = mount.dataset.char;
    if (!charNome) return;

    const prevCtrl = window._animMapCtrlMap?.[charNome];
    if (prevCtrl) { try { prevCtrl.destroy(); } catch(e) {} }

    const char   = (window.RPG_DATA?.characters || []).find(c => c.nome === charNome);
    const animado = char?.custom_attrs?.aparencia?.animado;
    if (!animado?.parts || !Object.keys(animado.parts).length) return;

    const displayW = mount.offsetWidth  || parseInt(mount.style.width)  || 40;
    const displayH = mount.offsetHeight || parseInt(mount.style.height) || 60;

    const ctrl = animRendererMount(mount, animado, { width: 120, height: 180, animName: 'idle' });

    if (ctrl.canvas) {
      ctrl.canvas.style.width  = displayW + 'px';
      ctrl.canvas.style.height = displayH + 'px';
    }
    mount.style.overflow = 'hidden';
    mount.style.display  = 'block';

    if (!window._animMapCtrlMap) window._animMapCtrlMap = {};
    window._animMapCtrlMap[charNome] = ctrl;
    window._animCtrlMap[charNome]    = ctrl;
  });
}

// Patch mapaRenderTokens
(function _patchMapaRenderTokens() {
  function _tryPatch() {
    if (typeof window.mapaRenderTokens !== 'function') return;
    if (window.mapaRenderTokens.__animPatchado) return;
    const _orig = window.mapaRenderTokens;
    window.mapaRenderTokens = function(m) {
      if (window._animMapCtrlMap) {
        Object.values(window._animMapCtrlMap).forEach(c => { try { c.destroy(); } catch(e) {} });
        window._animMapCtrlMap = {};
      }
      const result = _orig.apply(this, arguments);
      setTimeout(_animMontarTokensNoMapa, 0);
      return result;
    };
    window.mapaRenderTokens.__animPatchado = true;
    if (_orig.__gtPatched) window.mapaRenderTokens.__gtPatched = true;
  }
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      _tryPatch();
      if (window.mapaRenderTokens?.__animPatchado || ++_attempts > 60) clearInterval(_iv);
    }, 500);
  }
})();

// Patch mapaIniciarDrag / mapaFimDrag
(function _patchDragAnimations() {
  function _tryPatch() {
    if (typeof window.mapaIniciarDrag !== 'function') return false;
    if (window.mapaIniciarDrag.__animPatchado) return true;
    const _origDrag = window.mapaIniciarDrag;
    window.mapaIniciarDrag = function(nome, el, e) {
      const ctrl = window._animMapCtrlMap?.[nome];
      if (ctrl) ctrl.setAnimation('walk');
      return _origDrag.apply(this, arguments);
    };
    window.mapaIniciarDrag.__animPatchado = true;
    const _origFim = window.mapaFimDrag;
    if (typeof _origFim === 'function' && !_origFim.__animPatchado) {
      window.mapaFimDrag = async function(e) {
        const nome   = window.MAPA_STATE?.dragging;
        const result = await _origFim.apply(this, arguments);
        if (nome) { const ctrl = window._animMapCtrlMap?.[nome]; if (ctrl) ctrl.setAnimation('idle'); }
        return result;
      };
      window.mapaFimDrag.__animPatchado = true;
    }
    return true;
  }
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      if (_tryPatch() || ++_attempts > 60) clearInterval(_iv);
    }, 500);
  }
})();

// Patch tokenMoveReceber
(function _patchTokenMoveReceber() {
  function _tryPatch() {
    if (typeof window.tokenMoveReceber !== 'function') return false;
    if (window.tokenMoveReceber.__animPatchado) return true;
    const _orig = window.tokenMoveReceber;
    window.tokenMoveReceber = function(payload) {
      const result = _orig.apply(this, arguments);
      if (payload?.nome) {
        const ctrl = window._animMapCtrlMap?.[payload.nome];
        if (ctrl) { ctrl.setAnimation('walk'); setTimeout(() => ctrl.setAnimation('idle'), 800); }
      }
      return result;
    };
    window.tokenMoveReceber.__animPatchado = true;
    return true;
  }
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      if (_tryPatch() || ++_attempts > 120) clearInterval(_iv);
    }, 500);
  }
})();

// Patch animarAtaque
(function _patchAnimarAtaque() {
  function _tryPatch() {
    if (typeof window.animarAtaque !== 'function') return false;
    if (window.animarAtaque.__animSkeletalPatchado) return true;
    setTimeout(() => {
      if (window.animarAtaque.__animSkeletalPatchado) return;
      const _orig = window.animarAtaque;
      window.animarAtaque = function({ atacEl, alvoEl, animacao, dano }) {
        const atacNome = atacEl?.dataset?.nome;
        const alvoNome = alvoEl?.dataset?.nome;
        const atacCtrl = atacNome ? (window._animMapCtrlMap?.[atacNome] || window._animCtrlMap?.[atacNome]) : null;
        if (atacCtrl) atacCtrl.setAnimation('attack');
        const alvoCtrl = alvoNome ? (window._animMapCtrlMap?.[alvoNome] || window._animCtrlMap?.[alvoNome]) : null;
        if (alvoCtrl) {
          setTimeout(() => { alvoCtrl.setAnimation('walk'); setTimeout(() => alvoCtrl.setAnimation('idle'), 300); }, 200);
        }
        return typeof _orig === 'function'
          ? _orig.call(this, { atacEl, alvoEl, animacao, dano })
          : Promise.resolve();
      };
      window.animarAtaque.__animSkeletalPatchado = true;
    }, 200);
    return true;
  }
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      if (_tryPatch() || ++_attempts > 120) clearInterval(_iv);
    }, 500);
  }
})();
