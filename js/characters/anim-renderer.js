// characters/anim-renderer.js
// Canvas 2D skeletal animation renderer for pixel-art characters

window._animCtrlMap = window._animCtrlMap || {};

// Bone definitions: parentOffset is from parent's joint, in CSS pixels (for 120x180 canvas)
// Root is at canvas center (60, 95)
const _ANIM_BONE_CFG = {
  torso:        { parentOffset: [0, -22],   imgW: 30, imgH: 46, pivot: [0.5, 0.47], svgVB: '0 0 16 24', children: ['head','arm_upper_l','arm_upper_r','leg_upper_l','leg_upper_r'] },
  head:         { parentOffset: [0, -38],   imgW: 30, imgH: 30, pivot: [0.5, 0.87], svgVB: '0 0 16 16', children: [] },
  arm_upper_l:  { parentOffset: [-20, -22], imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: ['arm_lower_l'] },
  arm_lower_l:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: [] },
  arm_upper_r:  { parentOffset: [20, -22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: ['arm_lower_r'] },
  arm_lower_r:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: [] },
  leg_upper_l:  { parentOffset: [-11, 22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: ['leg_lower_l'] },
  leg_lower_l:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: [] },
  leg_upper_r:  { parentOffset: [11,  22],  imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: ['leg_lower_r'] },
  leg_lower_r:  { parentOffset: [0,  20],   imgW: 14, imgH: 22, pivot: [0.5, 0.09], svgVB: '0 0 8 12',  children: [] }
};

// Draw order (painter's algorithm): back bones first
const _ANIM_DRAW_ORDER = [
  'arm_lower_l', 'arm_upper_l',
  'leg_lower_l', 'leg_upper_l',
  'leg_lower_r', 'leg_upper_r',
  'torso',
  'arm_upper_r', 'arm_lower_r',
  'head'
];

// Maps bone → equipment slot drawn on top of it
const _EQUIP_ATTACH = {
  arm_lower_r: 'weapon_r',
  arm_lower_l: 'shield',
  head:        'helmet',
  torso:       'chest_armor'
};

// ── SVG → HTMLImageElement ───────────────────────────────────────────────────

function _animSvgToImg(svgStr, w, h) {
  return new Promise((resolve, reject) => {
    let svg = svgStr || '';
    // Ensure explicit width/height for crisp canvas rendering
    svg = svg.replace(/\bwidth="[^"]*"/, '').replace(/\bheight="[^"]*"/, '');
    svg = svg.replace('<svg', `<svg width="${w}" height="${h}"`);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG falhou: ' + svgStr.slice(0, 60)));
    img.src = url;
  });
}

async function _animPreloadImages(animadoData) {
  const cache = new Map();
  const parts = animadoData.parts || {};
  const equipSlots = animadoData.equipment_slots || {};

  const promises = [];

  // Load body part SVGs
  for (const [boneId, bc] of Object.entries(_ANIM_BONE_CFG)) {
    const partData = parts[boneId];
    if (!partData) continue;
    const svgStr = typeof partData === 'string' ? partData : (partData.svg || '');
    if (!svgStr) continue;
    promises.push(
      _animSvgToImg(svgStr, bc.imgW * 2, bc.imgH * 2)
        .then(img => cache.set(boneId, img))
        .catch(() => {}) // Skip failed SVGs silently
    );
  }

  // Load equipment SVGs
  for (const [slot, equipData] of Object.entries(equipSlots)) {
    if (!equipData || !equipData.svg) continue;
    promises.push(
      _animSvgToImg(equipData.svg, 32, 64)
        .then(img => cache.set('equip_' + slot, img))
        .catch(() => {})
    );
  }

  await Promise.all(promises);
  return cache;
}

// ── Keyframe Interpolation ───────────────────────────────────────────────────

function _animLerp(track, t, duration) {
  if (!track || !track.length) return {};
  const tMod = t % duration;

  // Find surrounding keyframes
  let before = track[0];
  let after = track[track.length - 1];
  for (let i = 0; i < track.length - 1; i++) {
    if (tMod >= track[i].t && tMod <= track[i + 1].t) {
      before = track[i];
      after = track[i + 1];
      break;
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

    // Rotate local offset by parent rotation
    const cos = Math.cos(parentRot);
    const sin = Math.sin(parentRot);
    const worldX = parentX + cos * dx - sin * dy;
    const worldY = parentY + sin * dx + cos * dy;
    const worldRot = parentRot + (anim.rotation || 0) * Math.PI / 180;

    boneTransforms.set(boneId, { x: worldX, y: worldY, rot: worldRot });

    (bc.children || []).forEach(childId => walk(childId, worldX, worldY, worldRot));
  }

  // Root's children start at root position
  const rootBone = { parentOffset: [0, 0], children: ['torso'] };
  walk('torso', rootX, rootY - 22, 0);
}

// ── Render One Frame ─────────────────────────────────────────────────────────

function _animRenderFrame(ctx, W, H, animadoData, imgCache, animTf) {
  ctx.clearRect(0, 0, W * 2, H * 2);

  const boneTransforms = new Map();
  _animComputeTransforms(W / 2, H / 2 + 5, animTf, boneTransforms);

  ctx.imageSmoothingEnabled = false;

  for (const boneId of _ANIM_DRAW_ORDER) {
    const tf = boneTransforms.get(boneId);
    if (!tf) continue;

    const bc = _ANIM_BONE_CFG[boneId];
    const img = imgCache.get(boneId);

    // Scale factor: canvas is 2× for sharpness
    const scale = 2;
    const wx = tf.x * scale;
    const wy = tf.y * scale;
    const imgW = bc.imgW * scale;
    const imgH = bc.imgH * scale;

    if (img) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(tf.rot);
      ctx.translate(-bc.pivot[0] * imgW, -bc.pivot[1] * imgH);
      ctx.drawImage(img, 0, 0, imgW, imgH);
      ctx.restore();
    }

    // Draw attached equipment
    const equipSlot = _EQUIP_ATTACH[boneId];
    if (equipSlot) {
      const eImg = imgCache.get('equip_' + equipSlot);
      const eData = animadoData.equipment_slots?.[equipSlot];
      if (eImg && eData) {
        const eW = 20 * scale;
        const eH = 36 * scale;
        const eRot = (eData.rotation || 0) * Math.PI / 180;
        const offX = (eData.offset?.[0] || 0) * scale;
        const offY = (eData.offset?.[1] || 0) * scale;
        ctx.save();
        ctx.translate(wx + offX, wy + offY);
        ctx.rotate(tf.rot + eRot);
        ctx.translate(-eW / 2, -eH * 0.1);
        ctx.drawImage(eImg, 0, 0, eW, eH);
        ctx.restore();
      }
    }
  }
}

// ── Mount / Controller ───────────────────────────────────────────────────────

function animRendererMount(container, animadoData, opts = {}) {
  const W = opts.width || 120;
  const H = opts.height || 180;
  const initialAnim = opts.animName || 'idle';

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width  = W * 2;
  canvas.height = H * 2;
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block;image-rendering:pixelated`;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  let currentAnimName = initialAnim;
  let startTime = null;
  let rafId = null;
  let paused = false;
  let imgCache = new Map();
  let animOneShot = false;
  let oneShotCb = null;

  const ctrl = {
    play() { paused = false; if (!rafId) _loop(performance.now()); },
    pause() { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } },
    setAnimation(name) {
      const animDef = animadoData.animations?.[name];
      if (!animDef) return;
      currentAnimName = name;
      animOneShot = !(animDef.loop !== false);
      startTime = null;
    },
    setEquipment(slot, equipData) {
      if (!animadoData.equipment_slots) animadoData.equipment_slots = {};
      animadoData.equipment_slots[slot] = equipData;
      // Reload equipment image
      if (equipData && equipData.svg) {
        _animSvgToImg(equipData.svg, 40, 72)
          .then(img => imgCache.set('equip_' + slot, img))
          .catch(() => {});
      } else {
        imgCache.delete('equip_' + slot);
      }
    },
    destroy() {
      paused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      canvas.remove();
    },
    canvas
  };

  let lastFrameTime = 0;

  function _loop(timestamp) {
    if (paused) return;

    // Cap at ~30fps
    if (timestamp - lastFrameTime < 33) {
      rafId = requestAnimationFrame(_loop);
      return;
    }
    lastFrameTime = timestamp;

    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;

    const animDef = animadoData.animations?.[currentAnimName];
    if (!animDef) { rafId = requestAnimationFrame(_loop); return; }

    const duration = animDef.duration || 1000;
    const t = animDef.loop !== false ? elapsed % duration : Math.min(elapsed, duration);

    // Compute interpolated transforms for all bones
    const animTf = {};
    for (const [boneId, track] of Object.entries(animDef.tracks || {})) {
      animTf[boneId] = _animLerp(track, t, duration);
    }

    _animRenderFrame(ctx, W, H, animadoData, imgCache, animTf);

    // Handle one-shot animations
    if (animDef.loop === false && elapsed >= duration) {
      if (oneShotCb) { oneShotCb(); oneShotCb = null; }
      ctrl.setAnimation('idle');
      startTime = null;
    }

    rafId = requestAnimationFrame(_loop);
  }

  // Preload images then start loop
  _animPreloadImages(animadoData).then(cache => {
    imgCache = cache;
    ctrl.setAnimation(currentAnimName);
    rafId = requestAnimationFrame(_loop);
  });

  return ctrl;
}

// ── Static Frame ─────────────────────────────────────────────────────────────

async function animRendererStaticFrame(animadoData, width, height, animName, t) {
  const W = width || 120;
  const H = height || 180;
  const canvas = document.createElement('canvas');
  canvas.width  = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');

  const imgCache = await _animPreloadImages(animadoData);
  const animDef = animadoData.animations?.[animName || 'idle'];
  const duration = animDef?.duration || 2000;
  const tVal = t ?? 0;

  const animTf = {};
  for (const [boneId, track] of Object.entries(animDef?.tracks || {})) {
    animTf[boneId] = _animLerp(track, tVal, duration);
  }

  _animRenderFrame(ctx, W, H, animadoData, imgCache, animTf);
  return canvas.toDataURL('image/png');
}

// ── Update Equipment Live ─────────────────────────────────────────────────────

function animRendererUpdateEquipment(ctrl, slot, equipData) {
  if (!ctrl) return;
  ctrl.setEquipment(slot, equipData);
}

// ── Utility: dataURL → Blob ──────────────────────────────────────────────────

function _dataUrlToBlob(dataUrl) {
  try {
    const [header, b64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch { return null; }
}

// ── Map Token Animation Integration ──────────────────────────────────────────
// Mounts canvas renderers on .animado-token-mount sentinels after mapaRenderTokens

function _animMontarTokensNoMapa() {
  document.querySelectorAll('.animado-token-mount').forEach(mount => {
    const charNome = mount.dataset.char;
    if (!charNome) return;

    // Destroy previous controller for this token if it exists in the map ctrl registry
    const prevCtrl = window._animMapCtrlMap?.[charNome];
    if (prevCtrl) { try { prevCtrl.destroy(); } catch(e) {} }

    const char = (window.RPG_DATA?.characters || []).find(c => c.nome === charNome);
    const animado = char?.custom_attrs?.aparencia?.animado;
    if (!animado?.parts || !Object.keys(animado.parts).length) return;

    const displayW = mount.offsetWidth || parseInt(mount.style.width) || 40;
    const displayH = mount.offsetHeight || parseInt(mount.style.height) || 60;

    // Renderizar sempre em 120×180 (dimensão para a qual os offsets dos ossos
    // foram calibrados) e depois escalar via CSS para o tamanho do token.
    const RENDER_W = 120;
    const RENDER_H = 180;

    const ctrl = animRendererMount(mount, animado, { width: RENDER_W, height: RENDER_H, animName: 'idle' });

    // Escalar o canvas para caber no espaço do token sem distorcer proporções
    if (ctrl.canvas) {
      ctrl.canvas.style.width  = displayW + 'px';
      ctrl.canvas.style.height = displayH + 'px';
    }
    // Evitar que o sentinel crescido transborde o wrapper pai
    mount.style.overflow = 'hidden';
    mount.style.display  = 'block';

    if (!window._animMapCtrlMap) window._animMapCtrlMap = {};
    window._animMapCtrlMap[charNome] = ctrl;
    // Also register in global map (used by inventory.js)
    window._animCtrlMap[charNome] = ctrl;
  });
}

// Patch mapaRenderTokens to mount animado renderers after each render
(function _patchMapaRenderTokens() {
  function _tryPatch() {
    if (typeof window.mapaRenderTokens !== 'function') return;
    if (window.mapaRenderTokens.__animPatchado) return;
    const _orig = window.mapaRenderTokens;
    window.mapaRenderTokens = function(m) {
      // Destroy existing map token controllers before re-render
      if (window._animMapCtrlMap) {
        Object.values(window._animMapCtrlMap).forEach(c => { try { c.destroy(); } catch(e) {} });
        window._animMapCtrlMap = {};
      }
      const result = _orig.apply(this, arguments);
      // Mount new controllers after DOM is updated
      setTimeout(_animMontarTokensNoMapa, 0);
      return result;
    };
    window.mapaRenderTokens.__animPatchado = true;
    // Copy any existing patches (e.g. grid throttle patch)
    if (_orig.__gtPatched) window.mapaRenderTokens.__gtPatched = true;
  }
  // Try immediately and retry until mapaRenderTokens exists
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      _tryPatch();
      if (window.mapaRenderTokens?.__animPatchado || ++_attempts > 60) clearInterval(_iv);
    }, 500);
  }
})();

// Patch mapaIniciarDrag to play walk animation and return to idle on drag end
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
        const nome = window.MAPA_STATE?.dragging;
        const result = await _origFim.apply(this, arguments);
        if (nome) {
          const ctrl = window._animMapCtrlMap?.[nome];
          if (ctrl) ctrl.setAnimation('idle');
        }
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

// Patch tokenMoveReceber to briefly play walk animation for remote movement
(function _patchTokenMoveReceber() {
  function _tryPatch() {
    if (typeof window.tokenMoveReceber !== 'function') return false;
    if (window.tokenMoveReceber.__animPatchado) return true;
    const _orig = window.tokenMoveReceber;
    window.tokenMoveReceber = function(payload) {
      const result = _orig.apply(this, arguments);
      if (payload?.nome) {
        const ctrl = window._animMapCtrlMap?.[payload.nome];
        if (ctrl) {
          ctrl.setAnimation('walk');
          setTimeout(() => ctrl.setAnimation('idle'), 800);
        }
      }
      return result;
    };
    window.tokenMoveReceber.__animPatchado = true;
    return true;
  }
  if (!_tryPatch()) {
    let _attempts = 0;
    const _iv = setInterval(() => {
      if (_tryPatch() || ++_attempts > 60) clearInterval(_iv);
    }, 500);
  }
})();

// Patch animarAtaque to play skeletal attack animation on animado tokens
// This runs after anim-gsap-spine.js has patched, so the chain is:
//   animarAtaque (this) → anim-gsap-spine patch → original
(function _patchAnimarAtaque() {
  function _tryPatch() {
    if (typeof window.animarAtaque !== 'function') return false;
    if (window.animarAtaque.__animSkeletalPatchado) return true;

    // Wait for anim-gsap-spine.js to apply its patch first
    // It sets its patch in a setTimeout(0), so we use a small delay
    setTimeout(() => {
      if (window.animarAtaque.__animSkeletalPatchado) return;
      const _orig = window.animarAtaque;

      window.animarAtaque = function({ atacEl, alvoEl, animacao, dano }) {
        // Find character names from token elements
        const atacNome = atacEl?.dataset?.nome;
        const alvoNome = alvoEl?.dataset?.nome;

        // Play attack animation on attacker's skeletal renderer
        const atacCtrl = atacNome ? (window._animMapCtrlMap?.[atacNome] || window._animCtrlMap?.[atacNome]) : null;
        if (atacCtrl) {
          atacCtrl.setAnimation('attack');
        }

        // Play hit reaction (brief walk→idle) on target
        const alvoCtrl = alvoNome ? (window._animMapCtrlMap?.[alvoNome] || window._animCtrlMap?.[alvoNome]) : null;
        if (alvoCtrl) {
          setTimeout(() => {
            alvoCtrl.setAnimation('walk');
            setTimeout(() => alvoCtrl.setAnimation('idle'), 300);
          }, 200);
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
