// core/pixi-lazy.js
// RPG Hub — Carregamento sob demanda do PixiJS e extensões via bundle (antes: CDN).
// Mantém o contrato dos loaders antigos: tudo fica disponível em window.PIXI
// (core espalhado, .filters, .particles, .spine), carregado só quando necessário.
// O Vite separa cada import() em chunk próprio, preservando o lazy-load.

let _corePromise = null;
function pixiEnsureCore() {
  if (window.PIXI) return Promise.resolve();
  if (!_corePromise) {
    _corePromise = import('pixi.js').then((ns) => {
      // Namespace de módulo é imutável — copia para permitir anexar extensões
      const PIXI: any = { ...ns };
      PIXI.filters = { ...(ns.filters || {}) };
      window.PIXI = PIXI;
    }).catch((e) => { _corePromise = null; throw e; });
  }
  return _corePromise;
}

function pixiEnsureParticles() {
  return pixiEnsureCore().then(() => {
    if (window.PIXI.particles && window.PIXI.particles.Emitter) return;
    return import('@pixi/particle-emitter').then((ns) => {
      window.PIXI.particles = { ...ns };
    });
  });
}

const _filterSpecs = {
  glow:      { key: 'GlowFilter',          load: () => import('@pixi/filter-glow') },
  bloom:     { key: 'AdvancedBloomFilter', load: () => import('@pixi/filter-advanced-bloom') },
  shockwave: { key: 'ShockwaveFilter',     load: () => import('@pixi/filter-shockwave') },
  godray:    { key: 'GodrayFilter',        load: () => import('@pixi/filter-godray') },
  rgbsplit:  { key: 'RGBSplitFilter',      load: () => import('@pixi/filter-rgb-split') },
  outline:   { key: 'OutlineFilter',       load: () => import('@pixi/filter-outline') },
  crt:       { key: 'CRTFilter',           load: () => import('@pixi/filter-crt') },
};

function pixiEnsureFilter(name) {
  return pixiEnsureCore().then(() => {
    const spec = _filterSpecs[name];
    if (!spec) return;
    if (window.PIXI.filters[spec.key]) return;
    return spec.load().then((ns) => {
      window.PIXI.filters[spec.key] = ns[spec.key];
    }).catch(() => { /* filtro indisponível não bloqueia a animação (paridade com loader antigo) */ });
  });
}

function pixiEnsureSpine() {
  return pixiEnsureCore().then(() => {
    if (window.PIXI.spine) return;
    return import('pixi-spine').then((ns) => {
      window.PIXI.spine = { ...ns };
    });
  });
}

Object.assign(window, { pixiEnsureCore, pixiEnsureParticles, pixiEnsureFilter, pixiEnsureSpine });
