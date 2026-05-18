// characters/anim-renderer.js
// PixiJS Sprite Renderer — personagem 2D animado com SVGs como texturas PixiJS

// Único mapa de controllers ativos: chave = nome do personagem
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

// Ordem de desenho: membros traseiros → torso/cabeça/membros dianteiros
const _DRAW_BACK  = ['arm_lower_l', 'arm_upper_l', 'leg_lower_l', 'leg_upper_l'];
const _DRAW_FRONT = ['leg_lower_r', 'leg_upper_r', 'torso', 'arm_upper_r', 'arm_lower_r', 'head'];
const _ANIM_DRAW_ORDER = [..._DRAW_BACK, ..._DRAW_FRONT];

// Slot de equipamento para cada bone
const _EQUIP_ATTACH = {
  arm_lower_r: 'weapon_r',
  arm_lower_l: 'shield',
  head:        'helmet',
  torso:       'chest_armor'
};

// Espaço de coordenadas nativo dos bones — o stage é escalado para caber no display
const _NATIVE_W = 120;
const _NATIVE_H = 180;

// Texturas pré-renderizadas em 2× para nitidez; exibidas em 0.5× no espaço nativo
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
function _svgToTexture(svgStr, w, h) {
  return new Promise((resolve) => {
    if (!svgStr) { resolve(null); return; }

    let svg = svgStr
      .replace(/\bwidth="[^"]*"/, '')
      .replace(/\bheight="[^"]*"/, '')
      .replace('<svg', `<svg width="${w}" height="${h}"`);
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
        resolve(PIXI.Texture.from(canvas.toDataURL('image/png')));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Safe texture loader (handles stale cache after destroy) ─────────────────
// PIXI v7 mantém BaseTextures no cache global por URL. Quando outro renderer
// destrói o Application com {baseTexture:true}, o GL resource é liberado, mas
// o objeto pode permanecer no cache com .valid===true (sem GLTexture). A
// próxima Texture.from() devolve esse objeto morto → sprite invisível.
// Esta função detecta o estado degradado e força recriação. Resolve sempre
// (com timeout) para impedir hang da pipeline de mount.
function _safeTextureFrom(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return; }
    let done = false;
    const finish = (tex) => { if (done) return; done = true; resolve(tex || null); };

    try {
      // Data URLs são gratuitas de recriar. Como destroy() de outras
      // instâncias pode deixar o BaseTexture no cache com .valid===true mas
      // sem GL resource (sprite invisível, só glow visível), sempre evictamos.
      if (window.PIXI?.utils && url.startsWith('data:')) {
        const cachedBase = PIXI.utils.BaseTextureCache[url];
        try { PIXI.Texture.removeFromCache(url); } catch(e) {}
        try { PIXI.BaseTexture.removeFromCache(url); } catch(e) {}
        if (cachedBase && !cachedBase.destroyed) { try { cachedBase.destroy(); } catch(e) {} }
      }

      const tex = PIXI.Texture.from(url);
      if (tex.baseTexture.valid && !tex.baseTexture.destroyed) {
        finish(tex);
        return;
      }
      tex.baseTexture.once('loaded', () => finish(tex));
      tex.baseTexture.once('error',  () => {
        // Recriação forçada: limpa cache e tenta uma única vez mais
        try { PIXI.Texture.removeFromCache(url); } catch(e) {}
        try { PIXI.BaseTexture.removeFromCache(url); } catch(e) {}
        try {
          const tex2 = PIXI.Texture.from(url);
          if (tex2.baseTexture.valid) finish(tex2);
          else {
            tex2.baseTexture.once('loaded', () => finish(tex2));
            tex2.baseTexture.once('error',  () => finish(null));
          }
        } catch(e) { finish(null); }
      });
    } catch(e) { finish(null); }

    // Failsafe: nunca pendurar > 2.5s
    setTimeout(() => finish(null), 2500);
  });
}

// ── Preload all textures ─────────────────────────────────────────────────────
async function _preloadTextures(animadoData) {
  const cache    = new Map();
  const parts    = animadoData.parts || {};
  const equips   = animadoData.equipment_slots || {};
  const promises = [];

  if (parts._full?.texture) {
    // v2 full-image: textura compartilhada única
    const tex = await _safeTextureFrom(parts._full.texture);
    if (tex) cache.set('_full', tex);
  } else {
    // v1 / v2-crop: texturas por bone
    for (const [boneId, bc] of Object.entries(_ANIM_BONE_CFG)) {
      const partData = parts[boneId];
      if (!partData) continue;

      if (partData?.texture) {
        promises.push(
          _safeTextureFrom(partData.texture)
            .then(tex => { if (tex) cache.set(boneId, tex); })
        );
        continue;
      }

      const svgStr = typeof partData === 'string' ? partData : (partData?.svg || '');
      if (!svgStr) continue;
      promises.push(
        _svgToTexture(svgStr, bc.imgW * 2, bc.imgH * 2)
          .then(tex => { if (tex) cache.set(boneId, tex); })
      );
    }
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

// ── Build PixiJS scene (v1 / v2-crop) ───────────────────────────────────────
function _buildScene(app, texCache) {
  const sprites      = new Map();
  const equipSprites = new Map();

  function addBone(boneId) {
    const tex    = texCache.get(boneId);
    const sprite = tex ? new PIXI.Sprite(tex) : null;
    if (sprite) app.stage.addChild(sprite);
    sprites.set(boneId, sprite);
    const eSlot = _EQUIP_ATTACH[boneId];
    if (eSlot) {
      const eTex    = texCache.get('equip_' + eSlot);
      const eSprite = eTex ? new PIXI.Sprite(eTex) : null;
      if (eSprite) { eSprite.visible = true; app.stage.addChild(eSprite); }
      equipSprites.set(eSlot, eSprite);
    }
  }

  for (const boneId of _DRAW_BACK)  addBone(boneId);

  const baseTex    = texCache.get('base');
  const baseSprite = baseTex ? new PIXI.Sprite(baseTex) : null;
  if (baseSprite) app.stage.addChild(baseSprite);

  for (const boneId of _DRAW_FRONT) addBone(boneId);

  return { sprites, equipSprites, baseSprite };
}

// ── Position sprites for one frame (v1 / v2-crop) ───────────────────────────
function _updateSprites(sprites, equipSprites, boneTransforms, animadoData) {
  for (const boneId of _ANIM_DRAW_ORDER) {
    const tf     = boneTransforms.get(boneId);
    const sprite = sprites.get(boneId);
    if (!tf || !sprite) continue;

    const bc        = _ANIM_BONE_CFG[boneId];
    const partData  = animadoData.parts?.[boneId];
    const partPivot = partData?.pivot;
    const partW     = partData?.width  || bc.imgW;
    const partH     = partData?.height || bc.imgH;

    sprite.position.set(tf.x, tf.y);
    sprite.rotation = tf.rot;
    if (partPivot) {
      sprite.pivot.set(partPivot.x * partW * 2, partPivot.y * partH * 2);
    } else {
      sprite.pivot.set(bc.pivot[0] * bc.imgW * 2, bc.pivot[1] * bc.imgH * 2);
    }
    sprite.scale.set(_TEX_SCALE);

    const eSlot   = _EQUIP_ATTACH[boneId];
    const eSprite = eSlot ? equipSprites.get(eSlot) : null;
    if (!eSprite) continue;

    const eData = animadoData.equipment_slots?.[eSlot];
    if (eData?.svg) {
      eSprite.visible = true;
      eSprite.position.set(tf.x + (eData.offset?.[0] || 0), tf.y + (eData.offset?.[1] || 0));
      eSprite.rotation = tf.rot + (eData.rotation || 0) * Math.PI / 180;
      eSprite.pivot.set(20, 7.2);
      eSprite.scale.set(_TEX_SCALE);
    } else {
      eSprite.visible = false;
    }
  }
}

// ── Build PixiJS scene (v2 full-image) ──────────────────────────────────────
function _buildSceneV2(app, texCache, animadoData) {
  const fullTex        = texCache.get('_full');
  const boneContainers = new Map();
  const equipSprites   = new Map();

  // Posições de repouso para posicionar as máscaras corretamente
  const restTf = new Map();
  _animComputeTransforms(_NATIVE_W / 2, _NATIVE_H / 2 + 44, {}, restTf);

  function addBone(boneId) {
    const partData = animadoData.parts?.[boneId];
    const rest     = restTf.get(boneId);
    if (!partData?.bbox || !rest) return;

    const container = new PIXI.Container();
    app.stage.addChild(container);

    if (fullTex && fullTex.baseTexture && fullTex.baseTexture.valid && !fullTex.baseTexture.destroyed) {
      const sprite = new PIXI.Sprite(fullTex);
      // FIX: a textura _full já vem em tamanho nativo (CANVAS_W × CANVAS_H = 120×180),
      // mesmo tamanho do PIXI Application. Aplicar _TEX_SCALE (0.5) reduzia o sprite
      // para 60×90 e a máscara (calculada em coords NATIVE) caía fora do sprite,
      // deixando o token invisível (só o glow CSS aparecia como "aura colorida").
      // Forçamos o tamanho de display ao nativo para tolerar texturas legadas
      // que tenham sido geradas em resolução diferente.
      sprite.width  = _NATIVE_W;
      sprite.height = _NATIVE_H;
      sprite.position.set(-rest.x, -rest.y);
      container.addChild(sprite);

      const bx = partData.bbox.x * _NATIVE_W - rest.x;
      const by = partData.bbox.y * _NATIVE_H - rest.y;
      const bw = partData.bbox.w * _NATIVE_W;
      const bh = partData.bbox.h * _NATIVE_H;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xFFFFFF);
      mask.drawRect(bx, by, bw, bh);
      mask.endFill();
      container.addChild(mask);
      sprite.mask = mask;
    }

    container.position.set(rest.x, rest.y);
    boneContainers.set(boneId, container);

    const eSlot = _EQUIP_ATTACH[boneId];
    if (eSlot) {
      const eTex    = texCache.get('equip_' + eSlot);
      const eSprite = eTex ? new PIXI.Sprite(eTex) : null;
      if (eSprite) { eSprite.visible = true; app.stage.addChild(eSprite); }
      equipSprites.set(eSlot, eSprite);
    }
  }

  for (const boneId of _DRAW_BACK)  addBone(boneId);
  for (const boneId of _DRAW_FRONT) addBone(boneId);

  return { boneContainers, equipSprites };
}

function _updateContainersV2(boneContainers, equipSprites, boneTransforms, animadoData) {
  for (const boneId of _ANIM_DRAW_ORDER) {
    const container = boneContainers.get(boneId);
    const tf        = boneTransforms.get(boneId);
    if (!container || !tf) continue;
    container.position.set(tf.x, tf.y);
    container.rotation = tf.rot;

    const eSlot   = _EQUIP_ATTACH[boneId];
    const eSprite = eSlot ? equipSprites.get(eSlot) : null;
    if (!eSprite) continue;
    const eData = animadoData.equipment_slots?.[eSlot];
    if (eData?.svg) {
      eSprite.visible = true;
      eSprite.position.set(tf.x + (eData.offset?.[0] || 0), tf.y + (eData.offset?.[1] || 0));
      eSprite.rotation = tf.rot + ((eData.rotation || 0) * Math.PI / 180);
      eSprite.pivot.set(20, 7.2);
      eSprite.scale.set(_TEX_SCALE);
    } else {
      eSprite.visible = false;
    }
  }
}

// ── Mount / Controller ───────────────────────────────────────────────────────
// opts: { displayWidth, displayHeight, fallbackSrc, animName }
//
// O PIXI app é criado no tamanho nativo de bones (120×180). O canvas é
// CSS-escalado para o tamanho de exibição (displayWidth × displayHeight).
function animRendererMount(container, animadoData, opts = {}) {
  const cssW = opts.displayWidth  || opts.width  || _NATIVE_W;
  const cssH = opts.displayHeight || opts.height || _NATIVE_H;

  container.innerHTML = '';

  // Placeholder com tamanho de display correto — visível imediatamente enquanto PIXI carrega
  const placeholder = document.createElement('canvas');
  placeholder.width  = cssW;
  placeholder.height = cssH;
  placeholder.style.cssText = `width:${cssW}px;height:${cssH}px;display:block`;
  container.appendChild(placeholder);

  // Desenhar fallback no placeholder enquanto aguarda PIXI
  if (opts.fallbackSrc) {
    const img = new Image();
    img.onload = () => {
      if (!placeholder.isConnected) return;
      const ctx = placeholder.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, cssW, cssH);
    };
    img.src = opts.fallbackSrc;
  }

  let _app          = null;
  let _sprites      = new Map();
  let _eSprites     = new Map();
  let _baseSprite   = null;
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
          if (_destroyed) return;
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
            existing.texture = tex;
            existing.visible = true;
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
      if (_app) { _app.destroy({ removeView: true }, { children: true, texture: false, baseTexture: false }); _app = null; }
      else if (placeholder.isConnected) placeholder.remove();
    }
  };

  _pixiEnsureLoaded().then(() => {
    if (_destroyed) return;

    // NÃO limpar o placeholder/fallback aqui — manter visível enquanto PIXI carrega.
    // Será removido somente após _preloadTextures resolver, evitando "flash vazio".

    _app = new PIXI.Application({
      width:           _NATIVE_W,
      height:          _NATIVE_H,
      backgroundAlpha: 0,
      antialias:       false,
      resolution:      1,
      autoDensity:     false,
    });

    // Canvas renderizado em tamanho nativo (120×180), CSS-escalado para o display.
    // Mantemos fluxo normal (sem absolute) para respeitar o alinhamento do container pai.
    _app.view.style.cssText = `width:${cssW}px;height:${cssH}px;display:block;image-rendering:pixelated`;

    return _preloadTextures(animadoData).then(async texCache => {
      if (_destroyed) return;
      // Substituir o placeholder pelo canvas atomicamente — preserva o
      // posicionamento (flex centering etc) do container pai e evita flash.
      if (placeholder && placeholder.isConnected) placeholder.replaceWith(_app.view);
      else container.appendChild(_app.view);

      const isV2Full    = !!(animadoData.parts?._full?.texture);
      const fullTex     = isV2Full ? texCache.get('_full') : null;
      const isV2BoneOnly = !isV2Full && Object.values(animadoData.parts || {})
        .some(p => p && typeof p === 'object' && p.bbox && !p.svg && !p.texture);
      const needsFallback = (isV2Full && !fullTex) || isV2BoneOnly;

      if (needsFallback) {
        if (opts.fallbackSrc) {
          await new Promise(resolve => {
            const tex = PIXI.Texture.from(opts.fallbackSrc);
            const done = () => {
              if (_destroyed) { resolve(); return; }
              const spr = new PIXI.Sprite(tex);
              spr.width  = _NATIVE_W;
              spr.height = _NATIVE_H;
              _app.stage.addChild(spr);
              _app.render();
              resolve();
            };
            if (tex.baseTexture.valid) done();
            else { tex.baseTexture.once('loaded', done); tex.baseTexture.once('error', resolve); }
          });
        }
        return;
      }

      let updateFn;

      if (isV2Full) {
        const { boneContainers, equipSprites } = _buildSceneV2(_app, texCache, animadoData);
        _sprites  = boneContainers;
        _eSprites = equipSprites;
        updateFn  = _updateContainersV2;
      } else {
        const { sprites, equipSprites, baseSprite } = _buildScene(_app, texCache);
        _sprites    = sprites;
        _eSprites   = equipSprites;
        _baseSprite = baseSprite;
        updateFn    = _updateSprites;
      }
      _startTime = performance.now();

      _app.ticker.add(() => {
        if (_paused) return;

        const elapsed = performance.now() - _startTime;
        const animDef = animadoData.animations?.[_currentAnim];
        const animTf  = {};

        if (animDef) {
          const duration = animDef.duration || 2000;
          const t = _oneShot ? Math.min(elapsed, duration) : elapsed % duration;
          for (const [boneId, track] of Object.entries(animDef.tracks || {})) {
            animTf[boneId] = _animLerp(track, t, duration);
          }
        }

        const boneTransforms = new Map();
        _animComputeTransforms(_NATIVE_W / 2, _NATIVE_H / 2 + 44, animTf, boneTransforms);
        updateFn(_sprites, _eSprites, boneTransforms, animadoData);

        if (_baseSprite) {
          _baseSprite.pivot.set(0, 0);
          _baseSprite.position.set(0, 0);
          _baseSprite.scale.set(_TEX_SCALE);
          _baseSprite.alpha = 0.35;
          _baseSprite.rotation = 0;
        }
      });

      if (_paused) _app.ticker.stop();
    });
  }).catch(err => {
    console.error('[AnimRenderer] Falha ao inicializar PixiJS:', err);
    if (!_destroyed && opts.fallbackSrc) {
      container.innerHTML = '';
      const img = document.createElement('img');
      img.src = opts.fallbackSrc;
      img.style.cssText = `width:${cssW}px;height:${cssH}px;object-fit:contain;display:block`;
      container.appendChild(img);
    }
  });

  return ctrl;
}

// ── Static Frame ─────────────────────────────────────────────────────────────
async function animRendererStaticFrame(animadoData, width, height, animName, t) {
  await _pixiEnsureLoaded();

  const W = width  || _NATIVE_W;
  const H = height || _NATIVE_H;

  const app = new PIXI.Application({ width: W, height: H, backgroundAlpha: 0, antialias: false, resolution: 1 });

  // Escalar stage para o tamanho solicitado
  const s = Math.min(W / _NATIVE_W, H / _NATIVE_H);
  app.stage.scale.set(s);
  app.stage.position.set((W - _NATIVE_W * s) / 2, (H - _NATIVE_H * s) / 2);

  const texCache  = await _preloadTextures(animadoData);
  const isV2Full  = !!(animadoData.parts?._full?.texture);

  let sprites, equipSprites, baseSprite, updateFn;
  if (isV2Full) {
    const scene = _buildSceneV2(app, texCache, animadoData);
    sprites      = scene.boneContainers;
    equipSprites = scene.equipSprites;
    updateFn     = _updateContainersV2;
  } else {
    const scene = _buildScene(app, texCache);
    sprites      = scene.sprites;
    equipSprites = scene.equipSprites;
    baseSprite   = scene.baseSprite;
    updateFn     = _updateSprites;
  }

  const animDef  = animadoData.animations?.[animName || 'idle'];
  const duration = animDef?.duration || 2000;
  const tVal     = t ?? 500;
  const animTf   = {};

  for (const [boneId, track] of Object.entries(animDef?.tracks || {})) {
    animTf[boneId] = _animLerp(track, tVal, duration);
  }

  const boneTransforms = new Map();
  _animComputeTransforms(_NATIVE_W / 2, _NATIVE_H / 2 + 44, animTf, boneTransforms);
  updateFn(sprites, equipSprites, boneTransforms, animadoData);

  if (baseSprite) {
    baseSprite.pivot.set(0, 0);
    baseSprite.position.set(0, 0);
    baseSprite.scale.set(_TEX_SCALE);
    baseSprite.alpha = 0.35;
    baseSprite.rotation = 0;
  }

  app.renderer.render(app.stage);

  let dataUrl;
  try { dataUrl = app.renderer.extract.base64(app.stage); }
  catch (e) { dataUrl = app.view.toDataURL('image/png'); }

  app.destroy({ removeView: true }, { children: true, texture: false, baseTexture: false });
  return dataUrl;
}

// ── Update Equipment Live ─────────────────────────────────────────────────────
function animRendererUpdateEquipment(ctrl, slot, equipData) {
  if (!ctrl) return;
  ctrl.setEquipment(slot, equipData);
}

// ── Montar tokens animados no mapa ───────────────────────────────────────────
// Chamado pelo listener do evento 'mapa:tokens-renderizados'
function _animMontarTokensNoMapa() {
  document.querySelectorAll('.animado-token-mount').forEach(mount => {
    const charNome = mount.dataset.char;
    if (!charNome) return;

    const char    = (window.RPG_DATA?.characters || []).find(c => c.nome === charNome);
    const animado = char?.custom_attrs?.aparencia?.animado;
    if (!animado?.parts || !Object.keys(animado.parts).length) return;

    // Dimensões de display propagadas via data-w/data-h pelo apmodTokenSVG
    const displayW = parseInt(mount.dataset.w) || mount.offsetWidth  || 40;
    const displayH = parseInt(mount.dataset.h) || mount.offsetHeight || 60;

    const composedImg = char?.custom_attrs?.aparencia?.composed_img
      || char?.custom_attrs?.aparencia?.animado?.parts?._full?.texture
      || null;
    const ctrl = animRendererMount(mount, animado, {
      displayWidth:  displayW,
      displayHeight: displayH,
      animName:      'idle',
      fallbackSrc:   composedImg
    });

    window._animCtrlMap[charNome] = ctrl;
  });
}

// ── Listener de tokens renderizados ──────────────────────────────────────────
// Substitui o antigo _patchMapaRenderTokens com setInterval.
// mapaRenderTokens (maps.js) despacha 'mapa:tokens-renderizados' ao terminar.
document.addEventListener('mapa:tokens-renderizados', () => {
  // Destruir todos os controllers do mapa anterior
  Object.values(window._animCtrlMap).forEach(c => { try { c.destroy(); } catch(e) {} });
  window._animCtrlMap = {};
  // Montar controllers para os novos tokens
  _animMontarTokensNoMapa();
});

// ── Patches de drag/combat ────────────────────────────────────────────────────
// Aplicados uma vez após o carregamento de todos os scripts (DOMContentLoaded ou imediatamente).
function _aplicarPatches() {
  // Drag: walk ao iniciar, idle ao soltar
  if (typeof window.mapaIniciarDrag === 'function' && !window.mapaIniciarDrag.__animPatchado) {
    const _origDrag = window.mapaIniciarDrag;
    window.mapaIniciarDrag = function(nome, el, e) {
      window._animCtrlMap?.[nome]?.setAnimation('walk');
      return _origDrag.apply(this, arguments);
    };
    window.mapaIniciarDrag.__animPatchado = true;
  }

  if (typeof window.mapaFimDrag === 'function' && !window.mapaFimDrag.__animPatchado) {
    const _origFim = window.mapaFimDrag;
    window.mapaFimDrag = async function(e) {
      const nome   = window.MAPA_STATE?.dragging;
      const result = await _origFim.apply(this, arguments);
      if (nome) window._animCtrlMap?.[nome]?.setAnimation('idle');
      return result;
    };
    window.mapaFimDrag.__animPatchado = true;
  }

  // Movimento remoto: walk breve → idle
  if (typeof window.tokenMoveReceber === 'function' && !window.tokenMoveReceber.__animPatchado) {
    const _origMove = window.tokenMoveReceber;
    window.tokenMoveReceber = function(payload) {
      const result = _origMove.apply(this, arguments);
      if (payload?.nome) {
        const ctrl = window._animCtrlMap?.[payload.nome];
        if (ctrl) { ctrl.setAnimation('walk'); setTimeout(() => ctrl.setAnimation('idle'), 800); }
      }
      return result;
    };
    window.tokenMoveReceber.__animPatchado = true;
  }

  // Ataque: atacante faz attack, alvo faz walk→idle (efeito de recuo)
  if (typeof window.animarAtaque === 'function' && !window.animarAtaque.__animSkeletalPatchado) {
    const _origAtaque = window.animarAtaque;
    window.animarAtaque = function({ atacEl, alvoEl, animacao, dano }) {
      const atacNome = atacEl?.dataset?.nome;
      const alvoNome = alvoEl?.dataset?.nome;
      if (atacNome) window._animCtrlMap?.[atacNome]?.setAnimation('attack');
      if (alvoNome) {
        setTimeout(() => {
          const ctrl = window._animCtrlMap?.[alvoNome];
          if (ctrl) { ctrl.setAnimation('walk'); setTimeout(() => ctrl.setAnimation('idle'), 300); }
        }, 200);
      }
      return typeof _origAtaque === 'function'
        ? _origAtaque.call(this, { atacEl, alvoEl, animacao, dano })
        : Promise.resolve();
    };
    window.animarAtaque.__animSkeletalPatchado = true;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _aplicarPatches);
} else {
  _aplicarPatches();
}
