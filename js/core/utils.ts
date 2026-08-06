// core/utils.js
// RPG Hub — Animation icons system, dice configuration utilities
// Includes: injectCustomCSS, processCustomSVG, getCardIconSVG, getLoadingAnimSVG


// ══════════════════════════════════════════════════════════════
// SISTEMA DE ANIMAÇÕES E ÍCONES CUSTOMIZADOS VIA CSV
// ══════════════════════════════════════════════════════════════


function injectCustomCSS(rpgId: any, css: any) {
  if (!css) return;
  const styleId = `custom-anim-${rpgId}`;
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = css;
}


function processCustomSVG(svg: any, color1: any, color2: any) {
  if (!svg) return null;
  return svg.replace(/#COLOR1/g, color1).replace(/#COLOR2/g, color2);
}


function getCardIconSVG(tipo: any, c1: any, c2: any, customSVG: any) {
  // Se tem SVG customizado, usa ele
  if (customSVG) {
    const processed = processCustomSVG(customSVG, c1, c2);
    if (processed) return processed;
  }
  
  // Senão, usa ícones padrão
  if(tipo==='flame') return`<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 34 C4 28 2 18 10 12 C10 20 14 22 14 22 C14 22 18 16 16 8 C22 12 26 22 14 34Z" fill="none" stroke="${c2}" stroke-width="1.5"/></svg>`;
  if(tipo==='rune')  return`<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="${c2}" stroke-width="1.2"/><path d="M16 4 L16 28 M4 16 L28 16 M7 7 L25 25 M25 7 L7 25" stroke="${c1}" stroke-width="0.8" opacity="0.6"/></svg>`;
  if(tipo==='gear')  return`<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="none" stroke="${c2}" stroke-width="1.5"/><path d="M16 2 L16 6 M16 26 L16 30 M2 16 L6 16 M26 16 L30 16" stroke="${c2}" stroke-width="1.5"/></svg>`;
  if(tipo==='crystal') return`<svg width="32" height="32" viewBox="0 0 32 32"><polygon points="16,3 28,10 26,28 6,28 4,10" fill="none" stroke="${c2}" stroke-width="1.2"/><polygon points="16,8 24,13 22,24 10,24 8,13" fill="none" stroke="${c1}" stroke-width="1" opacity="0.6"/></svg>`;
  if(tipo==='spirit') return`<svg width="32" height="36" viewBox="0 0 32 36"><path d="M16 4 C8 4 4 12 4 20 C4 30 8 34 10 30 C12 28 12 30 16 34 C20 30 20 28 22 30 C24 34 28 30 28 20 C28 12 24 4 16 4Z" fill="none" stroke="${c2}" stroke-width="1.2"/><circle cx="12" cy="18" r="2" fill="${c1}" opacity="0.7"/><circle cx="20" cy="18" r="2" fill="${c1}" opacity="0.7"/></svg>`;
  if(tipo==='sigil')  return`<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="${c2}" stroke-width="1.2"/><polygon points="16,4 28,24 4,24" fill="none" stroke="${c1}" stroke-width="1.2"/><circle cx="16" cy="16" r="3" fill="none" stroke="${c2}" stroke-width="1"/></svg>`;
  return`<svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="${c2}" stroke-width="1.2"/><polygon points="16,5 28,23 4,23" fill="none" stroke="${c1}" stroke-width="1.2"/></svg>`;
}


function getLoadingAnimSVG(tipo: any, customSVG: any) {
  // Se tem SVG customizado, usa ele
  if (customSVG) {
    return `<div class="anim-${tipo}">${customSVG}</div>`;
  }
  
  // Senão, usa animações padrão
  if(tipo==='flame') return'<div class="anim-flame"></div>';
  if(tipo==='rune')  return`<div class="anim-rune"><svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="var(--destaque)" stroke-width="1.5"/><circle cx="26" cy="26" r="16" fill="none" stroke="var(--primario)" stroke-width="1"/><path d="M26 4 L26 48 M4 26 L48 26 M10 10 L42 42 M42 10 L10 42" stroke="var(--primario)" stroke-width="0.8" opacity="0.5"/></svg></div>`;
  if(tipo==='crystal') return`<div class="anim-crystal"><svg width="44" height="56" viewBox="0 0 44 56"><polygon points="22,2 40,14 34,54 10,54 4,14" fill="none" stroke="var(--destaque)" stroke-width="1.5"/><polygon points="22,10 34,18 28,46 16,46 10,18" fill="none" stroke="var(--primario)" stroke-width="1" opacity="0.6"/><line x1="22" y1="2" x2="22" y2="54" stroke="var(--primario-v)" stroke-width="0.6" opacity="0.4"/></svg></div>`;
  if(tipo==='gear')  return`<div class="anim-gear"><svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="8" fill="none" stroke="var(--destaque)" stroke-width="2"/><path d="M25 4 L25 10 M25 40 L25 46 M4 25 L10 25 M40 25 L46 25 M9.4 9.4 L13.5 13.5 M36.5 36.5 L40.6 40.6 M40.6 9.4 L36.5 13.5 M13.5 36.5 L9.4 40.6 M16.2 4.8 L18 10.3 M32 39.7 L33.8 45.2 M4.8 33.8 L10.3 32 M39.7 18 L45.2 16.2 M45.2 33.8 L39.7 32 M10.3 18 L4.8 16.2 M33.8 4.8 L32 10.3 M18 45.2 L16.2 39.7" stroke="var(--primario)" stroke-width="1.5"/></svg></div>`;
  if(tipo==='spirit') return`<div class="anim-spirit"><svg width="46" height="56" viewBox="0 0 46 56"><path d="M23 6 C8 6 4 18 4 30 C4 46 10 54 14 48 C17 42 17 46 23 52 C29 46 29 42 32 48 C36 54 42 46 42 30 C42 18 38 6 23 6Z" fill="none" stroke="var(--destaque)" stroke-width="1.5"/><circle cx="17" cy="26" r="3" fill="var(--primario-v)" opacity="0.8"/><circle cx="29" cy="26" r="3" fill="var(--primario-v)" opacity="0.8"/></svg></div>`;
  if(tipo==='sigil')  return`<div class="anim-sigil"><svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="var(--destaque)" stroke-width="1.5"/><polygon points="26,6 46,38 6,38" fill="none" stroke="var(--primario)" stroke-width="1.2"/><circle cx="26" cy="26" r="5" fill="none" stroke="var(--destaque-v)" stroke-width="1"/></svg></div>`;
  return`<div class="anim-rune"><svg width="48" height="48" viewBox="0 0 48 48"><polygon points="24,2 46,13 46,35 24,46 2,35 2,13" fill="none" stroke="var(--destaque)" stroke-width="1.5"/></svg></div>`;
}



/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "injectCustomCSS", { configurable: true, writable: true, value: injectCustomCSS });
Object.defineProperty(globalThis, "processCustomSVG", { configurable: true, writable: true, value: processCustomSVG });
Object.defineProperty(globalThis, "getCardIconSVG", { configurable: true, writable: true, value: getCardIconSVG });
Object.defineProperty(globalThis, "getLoadingAnimSVG", { configurable: true, writable: true, value: getLoadingAnimSVG });
