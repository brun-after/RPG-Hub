// characters/anim-renderer.js
// PixiJS Sprite Renderer — personagem 2D animado com SVGs como texturas PixiJS

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

// Draw order (painter's algorithm): back limbs first, head last
const _ANIM_DRAW_ORDER = [
  'arm_lower_l', 'arm_upper_l',
  'leg_lower_l', 'leg_upper_l',
  'leg_lower_r', 'leg_upper_r',
  'torso',
  'arm_upper_r', 'arm_lower_r',
  'head'
];

// Maps bone → equipment slot rendered on top of it
const _EQUIP_ATTACH = {
  arm_lower_r: 'weapon_r',
  arm_lower_l: 'shield',
  head:        'helmet',
  torso:       'chest_armor'
};

// Textures are pre-rendered at 2× for crispness; displayed at 0.5× in world space
const _TEX_SCALE = 0.5;

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

// ── SVG → PIXI.Texture ───────────────────────────────────────────────────────
// Rasterizes SVG to a canvas at the given pixel size, then converts to PIXI.Texture.
// Using PNG data URL as intermediate guarantees compatibility across WebGL/Canvas renderers.
function _svgToTexture(svgStr, w, h) {
  return new Promise((resolve) => {
    if (!svgStr) { resolve(null); return; }

    let svg = svgStr;
    svg = svg.replace(/\bwidth="[^"]*"/, '').replace(/\bheight="[^"]*"/, '');
    svg = svg.replace('<svg', `<svg width="${w}" height="${h}"`);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const pngUrl = canvas.toDataURL('image/png');
        resolve(PIXI.Texture.from(pngUrl));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Preload all textures ─────────────────────────────────────────────────────
async function _preloadTextures(animadoData) {
  const cache    = new Map();
  const parts    = animadoData.parts || {};
  const equips   = animadoData.equipment_slots || {};
  const promises = [];

  for (const [boneId, bc] of Object.entries(_ANIM_BONE_CFG)) {
    const partData = parts[boneId];
    const svgStr   = typeof partData === 'string' ? partData : (partData?.svg || '');
    if (!svgStr) continue;
    promises.push(
      _svgToTexture(svgStr, bc.imgW * 2, bc.imgH * 2)
        .then(tex => { if (tex) cache.set(boneId, tex); })
    );
  }

  for (const [slot, eData] of Object.entries(equips)) {
    if (!eData?.svg) continue;
    promises.push(
      _svgToTexture(eData.svg, 40, 72)
        .then(tex => { if (tex) cache.set('equip_' + slot, tex); })
    );
  }

  await Promise.all(promises);
  return cache;
}

// ── Keyframe Interpolation ───────────────────────────────────────────────────
function _animLerp(track, t, duration) {
  if (!track || !track.length) return {};
  const tMod = t % duration;
  let before = track[0], after = track[track.length - 1];
  for (let i = 0; i < track.length - 1; i++) {
    if (tMod >= track[i].t && tMod <= track[i + 1].t) {
      before = track[i]; after = track[i + 1]; break;
    }
  }
  const span  = after.t - before.t;
  const alpha = span > 0 ? (tMod - before.t) / span : 0;
  const lerp  = (a, b) => a + (b - a) * alpha;
  return {
    rotation: lerp(before.rotation ?? 0, after.rotation ?? 0),
    x_offset: lerp(before.x_offset ?? 0, after.x_offset ?? 0),
    y_offset: lerp(before.y_offset ?? 0, after.y_offset ?? 0),
    scale:    lerp(before.scale    ?? 1, after.scale    ?? 1)
  };
}

// ── Forward Kinematics ───────────────────────────────────────────────────────
function _animComputeTransforms(rootX, rootY, animTf, boneTransforms) {
  function walk(boneId, parentX, parentY, parentRot) {
    const bc = _ANIM_BONE_CFG[boneId];
    if (!bc) return;
    const anim = animTf[boneId] || {};
    const dx   = bc.parentOffset[0] + (anim.x_offset || 0);
    const dy   = bc.parentOffset[1] + (anim.y_offset || 0);
    const cos  = Math.cos(parentRot), sin = Math.sin(parentRot);
    const worldX   = parentX + cos * dx - sin * dy;
    const worldY   = parentY + sin * dx + cos * dy;
    const worldRot = parentRot + (anim.rotation || 0) * Math.PI / 180;
    boneTransforms.set(boneId, { x: worldX, y: worldY, rot: worldRot });
    (bc.children || []).forEach(childId => walk(childId, worldX, worldY, worldRot));
  }
  walk('torso', rootX, rootY - 22, 0);
}

// ── Build PixiJS scene ───────────────────────────────────────────────────────
// Creates one Sprite per bone (and one per equipment slot) added to stage in draw order.
function _buildScene(app, texCache) {
  const sprites     = new Map();
  const equipSprites = new Map();

  for (const boneId of _ANIM_DRAW_ORDER) {
    const tex    = texCache.get(boneId);
    const sprite = tex ? new PIXI.Sprite(tex) : null;
    if (sprite) app.stage.addChild(sprite);
    sprites.set(boneId, sprite);

    // Equipment sprite added right after its bone so it renders on top
    const eSlot = _EQUIP_ATTACH[boneId];
    if (eSlot) {
      const eTex    = texCache.get('equip_' + eSlot);
      const eSprite = eTex ? new PIXI.Sprite(eTex) : null;
      if (eSprite) { eSprite.visible = true; app.stage.addChild(eSprite); }
      equipSprites.set(eSlot, eSprite);
    }
  }

  return { sprites, equipSprites };
}

// ── Position sprites for one frame ──────────────────────────────────────────
function _updateSprites(sprites, equipSprites, boneTransforms, animadoData) {
  for (const boneId of _ANIM_DRAW_ORDER) {
    const tf     = boneTransforms.get(boneId);
    const sprite = sprites.get(boneId);
    if (!tf || !sprite) continue;

    const bc = _ANIM_BONE_CFG[boneId];
    // Texture is 2× the CSS bone size; pivot is in texture-pixel space
    sprite.position.set(tf.x, tf.y);
    sprite.rotation = tf.rot;
    sprite.pivot.set(bc.pivot[0] * bc.imgW * 2, bc.pivot[1] * bc.imgH * 2);
    sprite.scale.set(_TEX_SCALE);

    // Equipment
    const eSlot  = _EQUIP_ATTACH[boneId];
    const eSprite = eSlot ? equipSprites.get(eSlot) : null;
    if (!eSprite) continue;

    const eData = animadoData.equipment_slots?.[eSlot];
    if (eData?.svg) {
      const offX = eData.offset?.[0] || 0;
      const offY = eData.offset?.[1] || 0;
      const eRot = (eData.rotation || 0) * Math.PI / 180;
      eSprite.visible = true;
      eSprite.position.set(tf.x + offX, tf.y + offY);
      eSprite.rotation = tf.rot + eRot;
      // Equipment texture: 40×72 (2× of 20×36). Pivot: center-x, 10% from top
      eSprite.pivot.set(20, 7.2);
      eSprite.scale.set(_TEX_SCALE);
    } else {
      eSprite.visible = false;
    }
  }
}

// ── Mount / Controller ───────────────────────────────────────────────────────
function animRendererMount(container, animadoData, opts = {}) {
  const W = opts.width  || 120;
  const H = opts.height || 180;

  container.innerHTML = '';

  // Synchronous placeholder — callers can read .canvas immediately
  const placeholder = document.createElement('canvas');
  placeholder.width  = W * 2;
  placeholder.height = H * 2;
  placeholder.style.cssText = `width:${W}px;height:${H}px;display:block;image-rendering:pixelated`;
  container.appendChild(placeholder);

  let _app          = null;
  let _sprites      = new Map();
  let _eSprites     = new Map();
  let _paused       = false;
  let _destroyed    = false;
  let _currentAnim  = opts.animName || 'idle';
  let _startTime    = performance.now();
  let _oneShot      = false;

  const ctrl = {
    play()  { _paused = false; if (_app) _app.ticker.start(); },
    pause() { _paused = true;  if (_app) _app.ticker.stop();  },

    setAnimation(name) {
      const animDef = animadoData.animations?.[name];
      if (!animDef) return;
      _currentAnim = name;
      _startTime   = performance.now();
      _oneShot     = animDef.loop === false;
      if (_oneShot) {
        setTimeout(() => {
          _currentAnim = 'idle';
          _startTime   = performance.now();
          _oneShot     = false;
        }, animDef.duration || 600);
      }
    },

    setEquipment(slot, equipData) {
      if (!animadoData.equipment_slots) animadoData.equipment_slots = {};
      animadoData.equipment_slots[slot] = equipData;
      if (!_app) return;

      const existing = _eSprites.get(slot);
      if (equipData?.svg) {
        _svgToTexture(equipData.svg, 40, 72).then(tex => {
          if (!tex || _destroyed) return;
          if (existing) {
            existing.texture  = tex;
            existing.visible  = true;
          } else {
            const ns = new PIXI.Sprite(tex);
            ns.visible = true;
            _app.stage.addChild(ns);
            _eSprites.set(slot, ns);
          }
        });
      } else if (existing) {
        existing.visible = false;
      }
    },

    destroy() {
      _paused    = true;
      _destroyed = true;
      if (_app) { _app.destroy(true, { children: true }); _app = null; }
      else placeholder.remove();
    },

    canvas: placeholder
  };

  _pixiEnsureLoaded().then(() => {
    if (_destroyed) return;

    // Capture any CSS applied to placeholder by callers (e.g. token resize)
    const savedStyle = placeholder.style.cssText;
    container.innerHTML = '';

    _app = new PIXI.Application({
      width:           W,
      height:          H,
      backgroundAlpha: 0,
      antialias:       false,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true
    });
    container.appendChild(_app.view);
    _app.view.style.cssText = savedStyle;
    ctrl.canvas = _app.view;

    return _preloadTextures(animadoData).then(texCache => {
      if (_destroyed) return;

      const { sprites, equipSprites } = _buildScene(_app, texCache);
      _sprites  = sprites;
      _eSprites = equipSprites;
      _startTime = performance.now();

      _app.ticker.add(() => {
        if (_paused) return;

        const elapsed  = performance.now() - _startTime;
        const animDef  = animadoData.animations?.[_currentAnim];

        const animTf = {};
        if (animDef) {
          const duration = animDef.duration || 2000;
          const t = _oneShot ? Math.min(elapsed, duration) : elapsed % duration;
          for (const [boneId, track] of Object.entries(animDef.tracks || {})) {
            animTf[boneId] = _animLerp(track, t, duration);
          }
        }

        const boneTransforms = new Map();
        _animComputeTransforms(W / 2, H / 2 + 44, animTf, boneTransforms);
        _updateSprites(_sprites, _eSprites, boneTransforms, animadoData);
      });

      if (_paused) _app.ticker.stop();
    });
  }).catch(err => console.error('[AnimRenderer] Falha ao inicializar PixiJS:', err));

  return ctrl;
}

// ── Static Frame ─────────────────────────────────────────────────────────────
async function animRendererStaticFrame(animadoData, width, height, animName, t) {
  await _pixiEnsureLoaded();

  const W = width  || 120;
  const H = height || 180;

  const app = new PIXI.Application({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1 });

  const texCache = await _preloadTextures(animadoData);
  const { sprites, equipSprites } = _buildScene(app, texCache);

  const animDef  = animadoData.animations?.[animName || 'idle'];
  const duration = animDef?.duration || 2000;
  const tVal     = t ?? 500;

  const animTf = {};
  for (const [boneId, track] of Object.entries(animDef?.tracks || {})) {
    animTf[boneId] = _animLerp(track, tVal, duration);
  }

  const boneTransforms = new Map();
  _animComputeTransforms(W / 2, H / 2 + 44, animTf, boneTransforms);
  _updateSprites(sprites, equipSprites, boneTransforms, animadoData);

  app.renderer.render(app.stage);

  let dataUrl;
  try { dataUrl = app.renderer.extract.base64(app.stage); }
  catch (e) { dataUrl = app.view.toDataURL('image/png'); }

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

    const char    = (window.RPG_DATA?.characters || []).find(c => c.nome === charNome);
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
