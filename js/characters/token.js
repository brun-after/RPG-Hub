// characters/token.js
// Sistema centralizado de tokens — todos os modos: animado (PixiJS), imagem, SVG, letra.
// Carregado após anim-renderer.js; depende de animRendererMount() exposto no window.

// ── Registro global de controllers ───────────────────────────────────────────
// Compartilhado com patches de drag/combat em anim-renderer.js
window._animCtrlMap = window._animCtrlMap || {};

// ── Resolução de URL de imagem ────────────────────────────────────────────────
function tokenImgUrl(char) {
  const ca = char.custom_attrs || {};
  return ca.img_retrato
    || ca.aparencia?.img_frente
    || ca.aparencia?.composed_img
    || ca.img
    || ca.img_url
    || '';
}

// ── Overlays de tint (cor/blend sobre imagem) ─────────────────────────────────
function tokenTintOverlayHtml(tints) {
  if (!tints || !tints.length) return '';
  return tints
    .filter(t => t && t.cor && (t.opacidade ?? 0) > 0)
    .map(t => {
      const modo = t.modo || 'multiply';
      const op   = Math.min(1, Math.max(0, t.opacidade ?? 0.4));
      return `<div style="position:absolute;inset:0;background:${t.cor};opacity:${op};mix-blend-mode:${modo};pointer-events:none;border-radius:inherit"></div>`;
    })
    .join('');
}

function _scaleTintsOpacity(tints, factor) {
  if (!tints || !tints.length || factor === 1) return tints;
  return tints.map(t => t ? { ...t, opacidade: (t.opacidade ?? 0.4) * factor } : t);
}

// ── Overlays de equipamento visual sobre o token ──────────────────────────────
function tokenEquipOverlayHtml(equips, tw, th, camadaFiltro) {
  if (!equips || !equips.length) return '';
  return equips
    .filter(eq =>
      eq.visivel !== false
      && (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5))
      && (!camadaFiltro || (camadaFiltro === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras'))
    )
    .map(eq => {
      const xPct    = eq.x     != null ? eq.x     : 50;
      const yPct    = eq.y     != null ? eq.y     : 30;
      const escala  = (eq.escala != null ? eq.escala : 100) / 100;
      const rotacao  = eq.rotacao  || 0;
      const rotacaoH = eq.rotacaoH || 0;
      const eqW = Math.round(0.35 * tw * escala);
      const eqH = Math.round(0.45 * th * escala);
      const left = Math.round((xPct / 100) * tw - eqW / 2);
      const top  = Math.round((yPct / 100) * th - eqH / 2);
      const zIdx = eq.camada === 'atras' ? 0 : 5;
      const _warp = eq.warpCorners && typeof _aeqComputeMatrix3d === 'function'
        ? _aeqComputeMatrix3d(eqW, eqH, eq.warpCorners.map(c => ({ x: c.x * eqW, y: c.y * eqH })))
        : null;
      const _tfParts = (_warp && _warp !== 'none')
        ? [_warp]
        : [
            rotacaoH ? `perspective(400px) rotateY(${rotacaoH}deg)` : '',
            rotacao  ? `rotate(${rotacao}deg)`  : '',
            eq.skewX ? `skewX(${eq.skewX}deg)` : '',
            eq.skewY ? `skewY(${eq.skewY}deg)` : '',
          ].filter(Boolean);
      const _tfOrigin = (_warp && _warp !== 'none') ? '0 0' : 'center center';
      const _tf = _tfParts.length
        ? `transform:${_tfParts.join(' ')};transform-origin:${_tfOrigin};`
        : '';
      const inner = (eq.img || eq.img_url)
        ? `<img src="${eq.img || eq.img_url}" style="width:${eqW}px;height:${eqH}px;object-fit:contain;pointer-events:none">`
        : `<div style="width:${eqW}px;height:${eqH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
      return `<div style="position:absolute;left:${left}px;top:${top}px;z-index:${zIdx};${_tf}pointer-events:none">${inner}</div>`;
    })
    .join('');
}

// ── Parse de cor para {r,g,b} ─────────────────────────────────────────────────
function _tokParseCorRgb(cor) {
  const hex = (cor || '').replace(/^var\([^)]+\)$/, '#4fa3d1').replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 79, g: 163, b: 209 };
}

// ── Div de glow (radial-gradient) ─────────────────────────────────────────────
function _tokGlowDiv(rgb, w, h, shape) {
  const { r, g, b } = rgb;
  const s = shape || 'ellipse';
  return `<div class="mapa-token-glow" style="width:${w};height:${h};left:50%;top:50%;background:radial-gradient(${s},rgba(${r},${g},${b},0.55) 0%,rgba(${r},${g},${b},0.2) 50%,transparent 75%);box-shadow:0 0 14px 4px rgba(${r},${g},${b},0.4)"></div>`;
}

// ── Estado de HP — overlay e classe CSS ──────────────────────────────────────
// Para tokens animados: usa overlay mix-blend-mode (não quebra WebGL).
// Para tokens estáticos: retorna filterValue para aplicar no elemento pai.
function _tokHpState(char, isAnimado) {
  const ca        = char.custom_attrs || {};
  const morto     = !!ca.morto;
  const moribundo = !!ca.moribundo;
  const hp        = char.hp_atual ?? (ca.hp_max || 100);
  const hpMax     = ca.hp_max || 100;
  const hpPct     = hp / hpMax;

  if (morto) return { cssClass: '', filterValue: '', overlayHtml: '' };

  if (moribundo) {
    return {
      cssClass:    'token-moribundo',
      filterValue: isAnimado ? '' : 'saturate(0) brightness(0.5)',
      overlayHtml: isAnimado
        ? `<div class="token-hp-overlay" style="position:absolute;inset:0;background:rgba(10,5,5,0.55);mix-blend-mode:multiply;pointer-events:none;border-radius:inherit;z-index:20"></div>`
        : '',
    };
  }
  if (hpPct <= 0.10) {
    return {
      cssClass:    'token-critico',
      filterValue: isAnimado ? '' : 'saturate(0) brightness(0.55)',
      overlayHtml: isAnimado
        ? `<div class="token-hp-overlay" style="position:absolute;inset:0;background:rgba(20,10,10,0.55);mix-blend-mode:multiply;pointer-events:none;border-radius:inherit;z-index:20"></div>`
        : '',
    };
  }
  if (hpPct <= 0.30) {
    return {
      cssClass:    '',
      filterValue: isAnimado ? '' : 'saturate(0.3) brightness(0.75)',
      overlayHtml: isAnimado
        ? `<div class="token-hp-overlay" style="position:absolute;inset:0;background:rgba(30,15,15,0.35);mix-blend-mode:multiply;pointer-events:none;border-radius:inherit;z-index:20"></div>`
        : '',
    };
  }
  if (hpPct <= 0.60) {
    return {
      cssClass:    '',
      filterValue: isAnimado ? '' : 'saturate(0.7) brightness(0.9)',
      overlayHtml: isAnimado
        ? `<div class="token-hp-overlay" style="position:absolute;inset:0;background:rgba(50,30,20,0.18);mix-blend-mode:multiply;pointer-events:none;border-radius:inherit;z-index:20"></div>`
        : '',
    };
  }
  return { cssClass: '', filterValue: '', overlayHtml: '' };
}

// ── Ícone de morte ────────────────────────────────────────────────────────────
function _tokMortoHtml() {
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10"><span style="font-size:1.3rem;color:#e74c3c;text-shadow:0 0 6px #000,0 0 12px rgba(231,76,60,0.8);font-weight:900;line-height:1">✕</span></div>`;
}

// ── Badges (NPC, projetado, vinculado) ────────────────────────────────────────
function _tokBadges(char, isNpc, isProjected) {
  const ca = char.custom_attrs || {};
  const npcFaction   = ca.npc_faction || 'inimigo';
  const factionColor = { inimigo: '#e8604c', neutro: '#c8a84b', aliado: '#5ee09a' }[npcFaction] || '#e8604c';
  const npcBadge = isNpc
    ? `<div title="NPC ${npcFaction}" style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:${factionColor};border:1px solid rgba(5,2,8,0.9);pointer-events:none"></div>`
    : '';
  const isVinculado    = char.nome === _tokRPGData()?.linked && _tokRPGData()?.myRole === 'mestre';
  const vinculadoBadge = isVinculado
    ? `<div title="Seu personagem" style="position:absolute;bottom:-3px;left:-3px;width:9px;height:9px;border-radius:50%;background:#f0cc6a;border:1px solid rgba(0,0,0,0.8);pointer-events:none;z-index:15"></div>`
    : '';
  const projBadge = isProjected
    ? `<div title="Em mapa filho" style="position:absolute;bottom:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:rgba(200,168,75,0.9);border:1px solid rgba(0,0,0,0.7);pointer-events:none;font-size:6px;display:flex;align-items:center;justify-content:center">📍</div>`
    : '';
  return npcBadge + projBadge + vinculadoBadge;
}

// ── Sentinel HTML — inner HTML do token animado/imagem ────────────────────────
// Retorna string HTML ou null. Equivale ao antigo apmodTokenSVG().
function tokenBuildSentinel(char) {
  const ca = char.custom_attrs || {};
  const ap = ca.aparencia;
  if (!ap) return null;

  const fator = Math.max(0.4, ap.tamanho || 1.0);

  if (ap.modo === 'animado') {
    const w = Math.round(37 * fator);
    const h = Math.round(56 * fator);
    if (ap.animado?.parts && Object.keys(ap.animado.parts).length) {
      const fb = ap.composed_img
        ? `<img src="${ap.composed_img}" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:pixelated;display:block">`
        : '';
      return `<div class="animado-token-mount" data-char="${char.nome}" data-w="${w}" data-h="${h}" style="width:${w}px;height:${h}px;display:block">${fb}</div>`;
    }
    const src = ap.composed_img || ap.img_frente;
    if (src) return `<img src="${src}" class="apmod-img-token" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:pixelated">`;
    return null;
  }

  if (ap.modo === 'imagem') {
    const src = ap.img_iso || ap.img_frente;
    if (!src) return null;
    const w = Math.round(40 * fator);
    const h = Math.round(60 * fator);
    return `<img src="${src}" class="apmod-img-token" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:high-quality" onload="if(typeof apmodSharpenImg==='function')apmodSharpenImg(this)">`;
  }

  return null;
}

// ── Construção do HTML interno completo do token ──────────────────────────────
// opts: { isNpc, isProjected, tamanhoFator }
// Retorna { html, isAnimado, cssClass }
function tokenBuildHtml(char, opts) {
  const isNpc       = !!(opts && opts.isNpc);
  const isProjected = !!(opts && opts.isProjected);
  const fator       = (opts && opts.tamanhoFator) ? opts.tamanhoFator : 1.0;

  const ca  = char.custom_attrs || {};
  const cor = ca.cor || char.cor || (isNpc ? '#e8604c' : 'var(--primario)');
  const rgb = _tokParseCorRgb(cor);

  const npcFaction    = isNpc ? (ca.npc_faction || 'inimigo') : null;
  const tintImgFactor = (isNpc && npcFaction === 'inimigo') ? 0.5 : 1;

  const isAnimado     = ca.aparencia?.modo === 'animado';
  const apSvg         = tokenBuildSentinel(char);
  const hasCanvas     = isAnimado && apSvg && apSvg.includes('animado-token-mount');

  const _aparenciaImg = ca.aparencia?.modo === 'imagem'
    ? (ca.aparencia.img_iso || ca.aparencia.img_frente)
    : null;
  const rawImgUrl     = _aparenciaImg || tokenImgUrl(char) || char.img_url || char.img || '';
  const _tImgUrl      = typeof normalizeImgUrl === 'function' ? normalizeImgUrl(rawImgUrl) : rawImgUrl;

  const isTransparentUrl = !!_tImgUrl && /\.(png|gif)(\?|$)/i.test(_tImgUrl);
  const semCirculo       = isAnimado || isTransparentUrl;

  const useCanvas        = isAnimado && hasCanvas;

  const { cssClass, filterValue, overlayHtml } = _tokHpState(char, isAnimado);
  const mortoHtml      = ca.morto ? _tokMortoHtml() : '';
  const badges         = _tokBadges(char, isNpc, isProjected);
  const labelCor       = isNpc ? '#e8a09a' : '#fff';
  const labelOpacity   = isProjected ? '0.7' : '1';
  const labelHtml      = `<div class="mapa-token-label" style="color:${labelCor};opacity:${labelOpacity}">${char.nome}${ca.morto ? ' 💀' : ''}</div>`;
  const contentOpacity = isProjected ? '0.55' : '1';

  // ── Ramo 1: ANIMADO (PixiJS canvas) ──────────────────────────────────────
  if (semCirculo && useCanvas) {
    const glowW = Math.round(54 * fator) + 'px';
    const glowH = Math.round(68 * fator) + 'px';
    const glowHtml = isProjected ? '' : _tokGlowDiv(rgb, glowW, glowH, 'ellipse');
    return {
      isAnimado: true,
      cssClass,
      html: `
        <div style="position:relative">
          ${glowHtml}
          <div style="opacity:${contentOpacity};position:relative;display:inline-block">
            ${apSvg}
            ${overlayHtml}
            ${badges}
          </div>
          ${mortoHtml}
        </div>
        ${labelHtml}`,
    };
  }

  // ── Ramo 2: PNG/GIF transparente (sem círculo, com drop-shadow) ───────────
  if (semCirculo && (_tImgUrl || apSvg)) {
    const { r, g, b } = rgb;
    const dsFilter  = `drop-shadow(0 0 2px rgba(${r},${g},${b},0.95)) drop-shadow(0 0 5px rgba(${r},${g},${b},0.65)) drop-shadow(0 0 10px rgba(${r},${g},${b},0.3))`;
    const imgH      = Math.round(60 * fator) + 'px';
    const _tints    = ca.aparencia?.tints || [];
    const _tOvls    = _tImgUrl
      ? tokenTintOverlayHtml(_scaleTintsOpacity(_tints, tintImgFactor))
      : tokenTintOverlayHtml(_tints);
    const innerContent = _tImgUrl
      ? `<div style="position:relative;display:inline-block"><img src="${_tImgUrl}" style="height:${imgH};width:auto;display:block;object-fit:contain">${_tOvls}</div>`
      : apSvg;
    return {
      isAnimado: false,
      cssClass,
      html: `
        <div style="position:relative">
          <div style="filter:${dsFilter};opacity:${contentOpacity};position:relative;display:inline-block">
            ${innerContent}
            ${overlayHtml}
            ${badges}
          </div>
          ${mortoHtml}
        </div>
        ${labelHtml}`,
    };
  }

  // ── Ramo 3: IMAGEM com círculo ────────────────────────────────────────────
  if (_tImgUrl) {
    const baseSize    = isNpc ? 24 : 32;
    const tamanhoBase = baseSize * 1.5;
    const tamanho     = Math.round(tamanhoBase * fator) + 'px';
    const bordaEstilo = isNpc ? `border:2px dashed ${cor}` : `border:2px solid ${cor}`;
    const _tints      = ca.aparencia?.tints || [];
    const _tOvls      = tokenTintOverlayHtml(_scaleTintsOpacity(_tints, tintImgFactor));
    const glowSize    = Math.round((tamanhoBase + 4) * fator) + 'px';
    const glowHtml    = isProjected ? '' : _tokGlowDiv(rgb, glowSize, glowSize, 'circle');
    return {
      isAnimado: false,
      cssClass,
      html: `
        <div style="position:relative">
          ${glowHtml}
          <div class="mapa-token-circle" style="width:${tamanho};height:${tamanho};${bordaEstilo};background:rgba(0,0,0,0.6);position:relative;opacity:${contentOpacity};border-radius:8px">
            <div style="position:relative;width:100%;height:100%;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center">
              <img src="${_tImgUrl}" style="width:100%;height:100%;object-fit:contain;background:rgba(0,0,0,0.3)">
              ${_tOvls}
            </div>
            ${overlayHtml}
            ${badges}
          </div>
          ${mortoHtml}
        </div>
        ${labelHtml}`,
    };
  }

  // ── Ramo 4: SVG retrato/criatura ──────────────────────────────────────────
  if (apSvg) {
    const baseW    = isNpc ? 24 : 32;
    const baseH    = isNpc ? 42 : 56;
    const tokenW   = Math.round(baseW * fator) + 'px';
    const tokenH   = Math.round(baseH * fator) + 'px';
    const bordaEstilo = isNpc ? `border:2px dashed ${cor}` : `border:2px solid ${cor}`;
    const opacidade   = isNpc ? '0.85' : '1';
    const glowW    = Math.round((baseW + 8) * fator) + 'px';
    const glowH    = Math.round((baseH + 8) * fator) + 'px';
    const glowHtml = isProjected ? '' : _tokGlowDiv(rgb, glowW, glowH, 'ellipse');
    return {
      isAnimado: false,
      cssClass,
      html: `
        <div style="position:relative">
          ${glowHtml}
          <div class="mapa-token-circle" style="width:${tokenW};height:${tokenH};${bordaEstilo};background:rgba(0,0,0,0.6);position:relative;opacity:${isProjected ? '0.55' : opacidade};border-radius:4px">
            <div class="apmod-token-wrap" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative">${apSvg}</div>
            ${overlayHtml}
            ${badges}
          </div>
          ${mortoHtml}
        </div>
        ${labelHtml}`,
    };
  }

  // ── Ramo 5: Fallback — círculo com letra inicial ──────────────────────────
  {
    const baseSize    = isNpc ? 24 : 32;
    const tamanho     = Math.round(baseSize * fator) + 'px';
    const bordaEstilo = isNpc ? `border:2px dashed ${cor}` : `border:2px solid ${cor}`;
    const opacidade   = isNpc ? '0.85' : '1';
    const glowBase    = isNpc ? 28 : 36;
    const glowSize    = Math.round(glowBase * fator) + 'px';
    const glowHtml    = isProjected ? '' : _tokGlowDiv(rgb, glowSize, glowSize, 'circle');
    return {
      isAnimado: false,
      cssClass,
      html: `
        <div style="position:relative">
          ${glowHtml}
          <div class="mapa-token-circle" style="width:${tamanho};height:${tamanho};${bordaEstilo};background:rgba(0,0,0,0.6);position:relative;opacity:${isProjected ? '0.55' : opacidade}">
            ${char.nome[0] || '?'}
            ${overlayHtml}
            ${badges}
          </div>
          ${mortoHtml}
        </div>
        ${labelHtml}`,
    };
  }
}

// RPG_DATA é declarado com `let` em state.js — não é propriedade de window.
// Acesso direto à variável global (com fallback para window.RPG_DATA em caso de
// outros contextos de carregamento, ex: arena.js que faz window.RPG_DATA = {}).
function _tokRPGData() {
  try { return (typeof RPG_DATA !== 'undefined' && RPG_DATA) ? RPG_DATA : (window.RPG_DATA || null); }
  catch(e) { return window.RPG_DATA || null; }
}
function tokenFindChar(charNome) {
  if (!charNome) return null;
  return (_tokRPGData()?.characters || [])
    .find(c => c.nome === charNome || c.name === charNome) || null;
}

// ── Resolver nome do personagem a partir de nó DOM ────────────────────────────
function tokenCharNameFromNode(node) {
  return node?.dataset?.char
    || node?.dataset?.nome
    || node?.getAttribute?.('data-char')
    || node?.getAttribute?.('data-nome')
    || node?.closest?.('[data-char]')?.dataset?.char
    || node?.closest?.('[data-nome]')?.dataset?.nome
    || '';
}

// ── Preparar nó de montagem para canvas animado ───────────────────────────────
// Retorna o elemento .animado-token-mount existente ou recém-criado.
// Retorna null se o personagem não tem dados animados.
function tokenPrepareMountNode(node) {
  if (!node || node.nodeType !== 1) return null;
  if (node.matches?.('.animado-token-mount')) return node;

  const existing = node.querySelector?.('.animado-token-mount');
  if (existing) return existing;

  const charNome = tokenCharNameFromNode(node);
  const char     = tokenFindChar(charNome);
  const ap       = char?.custom_attrs?.aparencia;
  const animado  = ap?.animado;
  if (ap?.modo !== 'animado' || !animado?.parts || !Object.keys(animado.parts).length) return null;

  const fator    = Math.max(0.4, ap.tamanho || 1.0);
  const displayW = Math.round(37 * fator);
  const displayH = Math.round(56 * fator);

  const mount = document.createElement('div');
  mount.className    = 'animado-token-mount';
  mount.dataset.char = char.nome || charNome;
  mount.dataset.w    = String(displayW);
  mount.dataset.h    = String(displayH);
  mount.style.cssText = `width:${displayW}px;height:${displayH}px;display:block;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;pointer-events:none`;

  const fallbackSrc = ap.composed_img || animado.parts?._full?.texture || '';
  if (fallbackSrc) {
    const img = document.createElement('img');
    img.src = fallbackSrc;
    img.style.cssText = `width:${displayW}px;height:${displayH}px;object-fit:contain;image-rendering:pixelated;display:block`;
    mount.appendChild(img);
  }

  const host = node.querySelector?.('.apmod-token-wrap')
    || node.querySelector?.('.mapa-token-circle')
    || node.querySelector?.('div[style*="display:inline-block"]')
    || node.querySelector?.('div[style*="position:relative"]')
    || node;
  if (host !== node && host.classList?.contains('mapa-token-circle')) host.innerHTML = '';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.appendChild(mount);
  return mount;
}

// ── Montar PixiJS em um elemento mount específico ────────────────────────────
function tokenMountAnimado(mountEl, charOrName) {
  const char   = typeof charOrName === 'object' ? charOrName : tokenFindChar(charOrName);
  const animado = char?.custom_attrs?.aparencia?.animado;
  if (!animado?.parts || !Object.keys(animado.parts).length) return null;
  if (typeof window.animRendererMount !== 'function') return null;

  const displayW    = parseInt(mountEl.dataset.w || mountEl.dataset.width, 10) || mountEl.offsetWidth  || 40;
  const displayH    = parseInt(mountEl.dataset.h || mountEl.dataset.height, 10) || mountEl.offsetHeight || 60;
  const composedImg = char?.custom_attrs?.aparencia?.composed_img
    || char?.custom_attrs?.aparencia?.animado?.parts?._full?.texture
    || null;

  return window.animRendererMount(mountEl, animado, {
    displayWidth:  displayW,
    displayHeight: displayH,
    animName:      'idle',
    fallbackSrc:   composedImg,
  });
}

// ── Destruir todos os controllers ativos ──────────────────────────────────────
function tokenDestroyAll() {
  Object.values(window._animCtrlMap).forEach(c => { try { c.destroy(); } catch(e) {} });
  window._animCtrlMap = {};
}

// ── Agendar montagem com debounce (requestAnimationFrame) ────────────────────
let _tokMountScheduled = false;
let _tokMountForceNext = false;
function _tokScheduleMount(force) {
  _tokMountForceNext = _tokMountForceNext || !!force;
  if (_tokMountScheduled) return;
  _tokMountScheduled = true;
  requestAnimationFrame(() => {
    _tokMountScheduled = false;
    const shouldForce  = _tokMountForceNext;
    _tokMountForceNext = false;
    tokenMountAll({ force: shouldForce });
  });
}

// ── Montar todos os tokens animados não-montados no DOM ───────────────────────
function tokenMountAll(opts) {
  const force = !!(opts && opts.force);
  const seen  = new WeakSet();

  document.querySelectorAll('.animado-token-mount, .mapa-token[data-nome]').forEach((node, idx) => {
    const mount = tokenPrepareMountNode(node);

    if (!mount || seen.has(mount)) return;
    seen.add(mount);

    const charNome = tokenCharNameFromNode(mount);
    if (!charNome) return;

    const char    = tokenFindChar(charNome);
    const animado = char?.custom_attrs?.aparencia?.animado;
    if (!animado?.parts || !Object.keys(animado.parts).length) return;

    const displayW  = parseInt(mount.dataset.w || mount.dataset.width, 10) || mount.offsetWidth  || 40;
    const displayH  = parseInt(mount.dataset.h || mount.dataset.height, 10) || mount.offsetHeight || 60;
    const textureId = animado.parts?._full?.texture
      ? String(animado.parts._full.texture).slice(0, 80) + ':' + String(animado.parts._full.texture).length
      : Object.keys(animado.parts).join(',');
    const mountKey  = `${charNome}|${displayW}x${displayH}|${textureId}|${idx}`;
    const hasCanvas = !!mount.querySelector('canvas');

    if (!force && mount.dataset.tokenRendererKey === mountKey && hasCanvas) return;

    const ctrlKey = mount.dataset.tokenRendererCtrlKey || `${charNome}::${idx}`;
    mount.dataset.tokenRendererCtrlKey = ctrlKey;
    if (window._animCtrlMap?.[ctrlKey]) {
      try { window._animCtrlMap[ctrlKey].destroy(); } catch(e) {}
    }

    mount.dataset.tokenRendererKey = mountKey;
    const ctrl = tokenMountAnimado(mount, char);
    if (ctrl) {
      window._animCtrlMap[ctrlKey] = ctrl;
      window._animCtrlMap[charNome] = ctrl;
    }
  });
}

// ── Renderizar tokens de personagens no mapa ──────────────────────────────────
// Substitui o loop chars.forEach dentro de mapaRenderTokens() em maps.js.
function tokenRenderizarNoMapa(tokensEl, chars, mapId, mapaObj) {
  const _gridW = mapaObj?.largura_total || 20;
  const _gridH = mapaObj?.altura_total  || 20;
  const mapasTipo = (_tokRPGData()?.mapas || [])
    .find(l => l.mapa.map_id === mapId)?.mapa?.tipo || 'geral';

  (chars || []).forEach(c => {
    const pos = typeof getPosicaoNoMapa === 'function' ? getPosicaoNoMapa(c, mapId) : null;
    if (!pos) return;

    const isProjected = c.active_map_id !== mapId;
    const ca    = c.custom_attrs || {};
    const isNpc = ca.tipo_personagem === 'npc';

    if (isNpc && mapasTipo === 'geral' && ca.visivel_geral === false) return;

    const el = document.createElement('div');
    el.className    = 'mapa-token';
    el.dataset.nome = c.nome;
    el.title        = c.nome;

    const _col     = pos.col ?? pos.x ?? 0;
    const _row     = pos.row ?? pos.y ?? 0;
    const _leftPct = ((_col + 0.5) / _gridW) * 100;
    const _topPct  = ((_row + 0.5) / _gridH) * 100;
    el.style.cssText = `left:${_leftPct.toFixed(2)}%;top:${_topPct.toFixed(2)}%;transform:translate(-50%,-50%)`;

    if (isProjected) el.dataset.projected = '1';

    const fator = Math.max(0.4, ca.aparencia?.tamanho || 1.0);
    el.dataset.baseTamanho = fator;

    const { html, isAnimado, cssClass } = tokenBuildHtml(c, { isNpc, isProjected, tamanhoFator: fator });

    // CSS filter só é seguro em tokens não-animados (não há canvas WebGL como descendente)
    if (!isAnimado) {
      const { filterValue } = _tokHpState(c, false);
      if (filterValue) el.style.filter = filterValue;
    }
    if (cssClass) el.classList.add(cssClass);

    el.innerHTML = html;

    if (!isProjected) {
      el.addEventListener('pointerdown', e => {
        if (typeof mapaIniciarDrag === 'function') mapaIniciarDrag(c.nome, el, e);
      });
    }
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (window.MAPA_STATE?.tokenMoveu) return;
      if (typeof _tokenCliqueSimples === 'function') _tokenCliqueSimples(c.nome);
    });
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (typeof _tokenDuploClique === 'function') _tokenDuploClique(c.nome);
    });

    tokensEl.appendChild(el);
  });
}

// ── Patches de animação para drag e combate ───────────────────────────────────
// Aplicados uma vez, envelopam as funções de drag/combat para disparar animações.
function _tokAplicarPatches() {
  const _tokFacingDir = window._tokFacingDir || (window._tokFacingDir = {});
  const _tokDragStartX = {};
  const _tokLastPos    = window._tokLastPos  || (window._tokLastPos  = {});

  function _tokSetFacing(nome, dir) {
    if (!dir || _tokFacingDir[nome] === dir) return;
    _tokFacingDir[nome] = dir;
    window._animCtrlMap?.[nome]?.setFacing?.(dir);
  }

  if (typeof window.mapaIniciarDrag === 'function' && !window.mapaIniciarDrag.__tokPatchado) {
    const _orig = window.mapaIniciarDrag;
    window.mapaIniciarDrag = function(nome, el, e) {
      _tokDragStartX[nome] = e?.clientX;
      window._animCtrlMap?.[nome]?.setAnimation('walk');
      return _orig.apply(this, arguments);
    };
    window.mapaIniciarDrag.__tokPatchado = true;
  }

  if (typeof window.mapaFimDrag === 'function' && !window.mapaFimDrag.__tokPatchado) {
    const _orig = window.mapaFimDrag;
    window.mapaFimDrag = async function(e) {
      const nome = window.MAPA_STATE?.dragging;
      if (nome && _tokDragStartX[nome] != null && e?.clientX != null) {
        const dx = e.clientX - _tokDragStartX[nome];
        if (Math.abs(dx) > 5) _tokSetFacing(nome, dx > 0 ? 'right' : 'left');
        delete _tokDragStartX[nome];
      }
      const result = await _orig.apply(this, arguments);
      if (nome) window._animCtrlMap?.[nome]?.setAnimation('idle');
      return result;
    };
    window.mapaFimDrag.__tokPatchado = true;
  }

  if (typeof window.tokenMoveReceber === 'function' && !window.tokenMoveReceber.__tokPatchado) {
    const _orig = window.tokenMoveReceber;
    window.tokenMoveReceber = function(payload) {
      const result = _orig.apply(this, arguments);
      if (payload?.nome) {
        const ctrl = window._animCtrlMap?.[payload.nome];
        if (ctrl) { ctrl.setAnimation('walk'); setTimeout(() => ctrl.setAnimation('idle'), 800); }
        const prev = _tokLastPos[payload.nome];
        const cx   = payload.x ?? payload.col;
        if (prev != null && cx != null) {
          const dx = cx - prev;
          if (Math.abs(dx) > 0.001) _tokSetFacing(payload.nome, dx > 0 ? 'right' : 'left');
        }
        if (cx != null) _tokLastPos[payload.nome] = cx;
      }
      return result;
    };
    window.tokenMoveReceber.__tokPatchado = true;
  }

  if (typeof window.animarAtaque === 'function' && !window.animarAtaque.__tokPatchado) {
    const _orig = window.animarAtaque;
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
      return typeof _orig === 'function'
        ? _orig.call(this, { atacEl, alvoEl, animacao, dano })
        : Promise.resolve();
    };
    window.animarAtaque.__tokPatchado = true;
  }
}

// ── Iniciar watchers e event listeners do sistema ─────────────────────────────
function tokenStartWatchers() {
  _tokAplicarPatches();

  // Evento disparado por mapaRenderTokens() ao concluir
  document.addEventListener('mapa:tokens-renderizados', () => {
    tokenDestroyAll();
    _tokScheduleMount(true);
  });

  // Fallbacks iniciais para mapas já renderizados quando este script carrega
  setTimeout(() => _tokScheduleMount(false), 250);
  setTimeout(() => _tokScheduleMount(false), 1000);

  // MutationObserver global — detecta tokens animados em QUALQUER contexto do DOM
  // (mapa, ficha, sidebar, catálogo, arena, etc.)
  if (window.MutationObserver && document.body && !window.__tokenMountObserver) {
    window.__tokenMountObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (
            n.matches?.('.animado-token-mount,.mapa-token[data-nome]')
            || n.querySelector?.('.animado-token-mount,.mapa-token[data-nome]')
          ) {
            _tokScheduleMount(false);
            return;
          }
        }
      }
    });
    window.__tokenMountObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Poll de segurança — cobre casos em que o observer pode ter perdido eventos
  if (!window.__tokenMountPoll) {
    window.__tokenMountPoll = setInterval(() => {
      const nodes = document.querySelectorAll('.animado-token-mount, .mapa-token[data-nome]');
      for (const node of nodes) {
        const mount = tokenPrepareMountNode(node);
        if (mount && (!mount.dataset.tokenRendererKey || !mount.querySelector('canvas'))) {
          _tokScheduleMount(false);
          break;
        }
      }
    }, 1200);
  }
}

// ── Expor API pública no window ───────────────────────────────────────────────
window.tokenImgUrl           = tokenImgUrl;
window.tokenTintOverlayHtml  = tokenTintOverlayHtml;
window.tokenEquipOverlayHtml = tokenEquipOverlayHtml;
window.tokenBuildSentinel    = tokenBuildSentinel;
window.tokenBuildHtml        = tokenBuildHtml;
window.tokenFindChar         = tokenFindChar;
window.tokenCharNameFromNode = tokenCharNameFromNode;
window.tokenPrepareMountNode = tokenPrepareMountNode;
window.tokenMountAnimado     = tokenMountAnimado;
window.tokenMountAll         = tokenMountAll;
window.tokenDestroyAll       = tokenDestroyAll;
window.tokenStartWatchers    = tokenStartWatchers;
window.tokenRenderizarNoMapa = tokenRenderizarNoMapa;

// Aliases de compatibilidade para código legado que referencia as funções antigas
window._animScheduleTokenMount  = _tokScheduleMount;
window._animMontarTokensNoMapa  = tokenMountAll;

// Iniciar o sistema
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tokenStartWatchers);
} else {
  tokenStartWatchers();
}
