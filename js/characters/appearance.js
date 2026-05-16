// characters/appearance.js
// RPG Hub — Character appearance system (APMOD): parts, templates, avatar builder
// Includes: APMOD_PARTS, apmodTokenSVG(), abrirModalAparencia(), tintOverlayHtml()


// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// PERSONAGENS — Populados pelo script de personagens abaixo
// ═══════════════════════════════════════════════════════════════════════════
var APMOD_PARTS={
cabelo:[],
rosto:[],
camisa:[],
calca:[],
sapato:[]
};
var CHAR_JSON_TEMPLATES=[];
const EQUIP_SLOT_LIMITS={arma_1m:{maxW:30,maxH:60,label:'Arma 1 Mão'},arma_2m:{maxW:40,maxH:70,label:'Arma 2 Mãos'},escudo:{maxW:28,maxH:32,label:'Escudo'},elmo:{maxW:20,maxH:20,label:'Elmo'},capa:{maxW:28,maxH:44,label:'Capa'},amuleto:{maxW:12,maxH:14,label:'Amuleto'},anel:{maxW:8,maxH:8,label:'Anel'},arco:{maxW:10,maxH:60,label:'Arco'},lanca:{maxW:10,maxH:70,label:'Lança'},geral:{maxW:24,maxH:40,label:'Geral'}};

// ── Modelos visuais de criaturas/NPCs — Layered SVG Sprite System ─────────
// Técnica: compositing de camadas (shadow→back→base→shade→midtone→detail→highlight→specular→glow)
// Equivalente a PNG sprite layering, mas em SVG dinâmico para suportar cor como parâmetro em tempo real
// head(): inner content para viewBox "2 2 28 24" — mapa geral e grade de seleção
// iso():  inner content para viewBox "0 0 32 52" — token de combate, mapa local
const CREATURE_MODELS={

  // ─── GUARDA ARMADO ────────────────────────────────────────────
  npc_generico:{
    label:'NPC',
    head:c=>{const md=_hexDarken2(c,45),sh=_hexDarken2(c,22),dk=_hexDarken2(c,72);return `<ellipse cx="16" cy="23.5" rx="8" ry="2" fill="${dk}" opacity="0.3"/><path d="M13.5 19 Q16 21 18.5 19 L18.2 23 Q16 24.5 13.8 23 Z" fill="${md}"/><path d="M8 15 Q8 5 16 5 Q24 5 24 15 L24 20 Q16 22 8 20 Z" fill="${md}"/><path d="M8 14 Q8 5 16 5 Q24 5 24 14 L23 19 Q16 21 9 19 Z" fill="${c}"/><path d="M5 13.5 Q4.5 11 8 12 L8 20 Q5.5 21 5 18.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><path d="M27 13.5 Q27.5 11 24 12 L24 20 Q26.5 21 27 18.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><rect x="7" y="11.5" width="18" height="5.5" rx="1.5" fill="${dk}" opacity="0.88"/><rect x="7.5" y="13.5" width="17" height="1.8" rx="0.6" fill="${dk}" opacity="0.6"/><ellipse cx="11.5" cy="14.2" rx="3.2" ry="1.4" fill="#3377ff" opacity="0.85"/><ellipse cx="11.5" cy="13.8" rx="1.5" ry="0.7" fill="#88c8ff" opacity="0.7"/><ellipse cx="20.5" cy="14.2" rx="3.2" ry="1.4" fill="#3377ff" opacity="0.85"/><ellipse cx="20.5" cy="13.8" rx="1.5" ry="0.7" fill="#88c8ff" opacity="0.7"/><rect x="15.3" y="11" width="1.4" height="7" rx="0.5" fill="${md}" opacity="0.65"/><path d="M9 19.5 Q16 22 23 19.5 L22 24.5 Q16 26 10 24.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><ellipse cx="13.5" cy="7.5" rx="5" ry="2.5" fill="white" opacity="0.13" transform="rotate(-20 13.5 7.5)"/><circle cx="7" cy="17.5" r="0.75" fill="${md}"/><circle cx="25" cy="17.5" r="0.75" fill="${md}"/><circle cx="7.5" cy="12.5" r="0.7" fill="${md}"/><circle cx="24.5" cy="12.5" r="0.7" fill="${md}"/><path d="M8 14 Q8 5 16 5 Q24 5 24 14" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.5"/>`;},
    iso:c=>{const md=_hexDarken2(c,45),sh=_hexDarken2(c,22),dk=_hexDarken2(c,72);return `<ellipse cx="16" cy="50.5" rx="9" ry="2.5" fill="${dk}" opacity="0.42"/><path d="M9 43 L9 51.5 Q12.5 53.5 15 51.5 L15 43 Z" fill="${md}"/><path d="M17 43 L17 51.5 Q19.5 53.5 23 51.5 L23 43 Z" fill="${md}"/><path d="M9.5 43 L9.5 51.5 Q12.5 53 14.5 51.5 L14.5 43 Z" fill="${sh}" stroke="${md}" stroke-width="0.3"/><path d="M17.5 43 L17.5 51.5 Q19.5 53 22.5 51.5 L22.5 43 Z" fill="${sh}" stroke="${md}" stroke-width="0.3"/><rect x="9.5" y="35" width="5.5" height="9" rx="1.2" fill="${c}" stroke="${md}" stroke-width="0.4"/><rect x="17" y="35" width="5.5" height="9" rx="1.2" fill="${c}" stroke="${md}" stroke-width="0.4"/><rect x="10" y="38.5" width="4.5" height="5" rx="0.5" fill="${md}" opacity="0.3"/><rect x="17.5" y="38.5" width="4.5" height="5" rx="0.5" fill="${md}" opacity="0.3"/><rect x="11" y="35.5" width="2" height="3.5" rx="0.5" fill="white" opacity="0.1"/><rect x="18" y="35.5" width="2" height="3.5" rx="0.5" fill="white" opacity="0.1"/><path d="M8 44 Q6 28 7 18 Q16 16 25 18 Q26 28 24 44" fill="${md}" opacity="0.38"/><path d="M10 30 Q16 33.5 22 30 L21.5 37 Q16 39 10.5 37 Z" fill="${sh}"/><rect x="9.5" y="18" width="13" height="17" rx="2" fill="${md}"/><rect x="10" y="18" width="12" height="16" rx="1.5" fill="${c}" stroke="${md}" stroke-width="0.4"/><line x1="16" y1="19" x2="16" y2="33.5" stroke="${md}" stroke-width="0.7" opacity="0.5"/><path d="M10 22 Q16 24 22 22" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.4"/><path d="M10 26 Q16 28 22 26" fill="none" stroke="${md}" stroke-width="0.4" opacity="0.3"/><rect x="10" y="25.5" width="12" height="8.5" rx="1" fill="${md}" opacity="0.27"/><ellipse cx="12.5" cy="20.5" rx="2.5" ry="1.5" fill="white" opacity="0.1"/><path d="M3.5 19.5 Q4.5 15.5 9.5 17.5 L9.5 23.5 Q4 23 3.5 20.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><path d="M28.5 19.5 Q27.5 15.5 22.5 17.5 L22.5 23.5 Q28 23 28.5 20.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><path d="M3.5 21 L3.5 34 Q5.5 36 8 34 L9 21 Z" fill="${sh}" stroke="${md}" stroke-width="0.3"/><path d="M28.5 21 L28.5 34 Q26.5 36 24 34 L23 21 Z" fill="${sh}" stroke="${md}" stroke-width="0.3"/><rect x="26" y="30" width="2.2" height="18" rx="0.8" fill="#b8c0d0" stroke="${dk}" stroke-width="0.4"/><rect x="24" y="30" width="6" height="1.5" rx="0.5" fill="${c}" stroke="${md}" stroke-width="0.3"/><circle cx="16" cy="12" r="8.5" fill="${md}"/><path d="M8.5 13 Q8.5 5 16 5 Q23.5 5 23.5 13 L22.5 18 Q16 20 9.5 18 Z" fill="${c}"/><rect x="8.5" y="11" width="15" height="5" rx="1.2" fill="${dk}" opacity="0.9"/><ellipse cx="12" cy="13.2" rx="2.5" ry="1.2" fill="#3377ff" opacity="0.8"/><ellipse cx="12" cy="12.8" rx="1.1" ry="0.6" fill="#88c8ff" opacity="0.65"/><ellipse cx="20" cy="13.2" rx="2.5" ry="1.2" fill="#3377ff" opacity="0.8"/><ellipse cx="20" cy="12.8" rx="1.1" ry="0.6" fill="#88c8ff" opacity="0.65"/><rect x="15.2" y="11" width="1.6" height="5" rx="0.5" fill="${md}" opacity="0.6"/><ellipse cx="13" cy="7" rx="4" ry="2" fill="white" opacity="0.12" transform="rotate(-20 13 7)"/>`;
    }
  },

  // ─── GOBLIN TRIBAL ────────────────────────────────────────────
  goblin:{
    label:'Goblin',
    head:c=>{const md=_hexDarken2(c,40),sh=_hexDarken2(c,18),dk=_hexDarken2(c,68);return `<ellipse cx="16" cy="23" rx="7" ry="1.8" fill="${dk}" opacity="0.3"/><path d="M4.5 14.5 Q3.5 8 8.5 10 L9.5 16.5 Q6 16.5 4.5 14.5 Z" fill="${md}"/><path d="M27.5 14.5 Q28.5 8 23.5 10 L22.5 16.5 Q26 16.5 27.5 14.5 Z" fill="${md}"/><ellipse cx="8" cy="10.5" rx="2.8" ry="4" fill="#e87820" opacity="0.35"/><ellipse cx="24" cy="10.5" rx="2.8" ry="4" fill="#e87820" opacity="0.35"/><path d="M5 14.5 Q4 8.5 9 10.5 L10 16.5 Q6.5 16.5 5 14.5 Z" fill="${sh}"/><path d="M27 14.5 Q28 8.5 23 10.5 L22 16.5 Q25.5 16.5 27 14.5 Z" fill="${sh}"/><ellipse cx="16" cy="16" rx="9" ry="8.5" fill="${md}"/><ellipse cx="16" cy="15.5" rx="8.5" ry="8" fill="${c}"/><path d="M10 12 Q12 10 14 12" fill="none" stroke="${md}" stroke-width="0.8" opacity="0.6"/><path d="M18 12 Q20 10 22 12" fill="none" stroke="${md}" stroke-width="0.8" opacity="0.6"/><path d="M8 16 Q10 13.5 13.5 15" fill="none" stroke="${md}" stroke-width="0.55" opacity="0.5"/><path d="M24 16 Q22 13.5 18.5 15" fill="none" stroke="${md}" stroke-width="0.55" opacity="0.5"/><path d="M13 9 L13 13 M15.5 8.5 L15.5 13" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.4"/><ellipse cx="12.5" cy="13.5" rx="2.5" ry="2.8" fill="#d4d000" opacity="0.95"/><ellipse cx="19.5" cy="13.5" rx="2.5" ry="2.8" fill="#d4d000" opacity="0.95"/><ellipse cx="12.5" cy="13.5" rx="0.85" ry="1.8" fill="#0a0800"/><ellipse cx="19.5" cy="13.5" rx="0.85" ry="1.8" fill="#0a0800"/><ellipse cx="12.2" cy="12.3" rx="0.65" ry="0.45" fill="white" opacity="0.6"/><ellipse cx="19.2" cy="12.3" rx="0.65" ry="0.45" fill="white" opacity="0.6"/><ellipse cx="16" cy="20.5" rx="4.5" ry="2.5" fill="${sh}"/><circle cx="15" cy="20" r="0.9" fill="${dk}" opacity="0.7"/><circle cx="17" cy="20" r="0.9" fill="${dk}" opacity="0.7"/><path d="M11 21.5 L12.5 24.5 L14 22.5 L16 25 L18 22.5 L19.5 24.5 L21 21.5" fill="none" stroke="${dk}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 9.5 Q9 6.5 11.5 7.5" fill="none" stroke="${sh}" stroke-width="0.8" opacity="0.65"/><path d="M21.5 9.5 Q23 6.5 20.5 7.5" fill="none" stroke="${sh}" stroke-width="0.8" opacity="0.65"/><ellipse cx="13.5" cy="8.5" rx="3" ry="1.8" fill="white" opacity="0.1" transform="rotate(-10 13.5 8.5)"/>`;},
    iso:c=>{const md=_hexDarken2(c,40),sh=_hexDarken2(c,18),dk=_hexDarken2(c,68);return `<ellipse cx="16" cy="50.5" rx="8" ry="2" fill="${dk}" opacity="0.35"/><path d="M11.5 44 Q10.5 51.5 13.5 51.5 L14 44 Z" fill="${md}"/><path d="M20.5 44 Q21.5 51.5 18.5 51.5 L18 44 Z" fill="${md}"/><path d="M12 44 Q11 51.5 13.5 51.5 L14 44 Z" fill="${sh}"/><path d="M20 44 Q21 51.5 18.5 51.5 L18 44 Z" fill="${sh}"/><path d="M10.5 32 Q9.5 43 12.5 44.5 L13.5 32 Z" fill="${md}"/><path d="M21.5 32 Q22.5 43 19.5 44.5 L18.5 32 Z" fill="${md}"/><path d="M11 32 Q10 43 12.5 44.5 L13.5 32 Z" fill="${c}" opacity="0.8"/><path d="M21 32 Q22 43 19.5 44.5 L18.5 32 Z" fill="${c}" opacity="0.8"/><path d="M13.5 29 Q14.5 36 15.5 45 Q16.5 45 17 36 L18 29 Z" fill="${sh}" opacity="0.8"/><path d="M11.5 23 Q10.5 31 13 31 L13.5 23 Z" fill="${c}" opacity="0.7"/><path d="M20.5 23 Q21.5 31 19 31 L18.5 23 Z" fill="${c}" opacity="0.7"/><path d="M11.5 15 Q11 12.5 14 14 Q16 29 18 14 Q21 12.5 20.5 15 L20.5 28 Q16 32 11.5 28 Z" fill="${md}"/><path d="M12 15 Q11.5 13 14 14 Q16 29 18 14 Q20.5 13 20 15 L20 27.5 Q16 31.5 12 27.5 Z" fill="${c}"/><path d="M12 19.5 Q16 21.5 20 19.5" fill="none" stroke="${md}" stroke-width="0.6" opacity="0.5"/><path d="M12 23.5 Q16 25.5 20 23.5" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.4"/><path d="M12 9.5 L13 12 M14.5 9 L15 12" fill="none" stroke="${md}" stroke-width="0.6" opacity="0.4"/><path d="M5 20.5 L2 16.5" stroke="${sh}" stroke-width="2.5" stroke-linecap="round"/><path d="M5 24 L1 23" stroke="${sh}" stroke-width="2.5" stroke-linecap="round"/><path d="M27 20.5 L30 16.5" stroke="${sh}" stroke-width="2.5" stroke-linecap="round"/><path d="M27 24 L31 23" stroke="${sh}" stroke-width="2.5" stroke-linecap="round"/><path d="M5 18.5 L11.5 16.5 L11.5 27.5 L5 25 Z" fill="${sh}"/><path d="M27 18.5 L20.5 16.5 L20.5 27.5 L27 25 Z" fill="${sh}"/><rect x="3.5" y="14" width="2.5" height="20" rx="0.8" fill="#7a4010" stroke="${dk}" stroke-width="0.4"/><rect x="3" y="13" width="3.5" height="1.5" rx="0.5" fill="${md}"/><ellipse cx="16" cy="9.5" rx="9" ry="7" fill="${md}"/><ellipse cx="16" cy="9" rx="8.5" ry="6.5" fill="${c}"/><path d="M9.5 6.5 Q8.5 2.5 11.5 4.5 L12 8.5 Q10 8.5 9.5 6.5 Z" fill="${md}"/><path d="M22.5 6.5 Q23.5 2.5 20.5 4.5 L20 8.5 Q22 8.5 22.5 6.5 Z" fill="${md}"/><path d="M10 6.5 Q9 3 12 5 L12.5 8.5 Q10.5 8.5 10 6.5 Z" fill="${sh}"/><path d="M22 6.5 Q23 3 20 5 L19.5 8.5 Q21.5 8.5 22 6.5 Z" fill="${sh}"/><path d="M13.5 9 L14 12 M15.8 8.5 L15.8 12" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.4"/><ellipse cx="12.5" cy="9.5" rx="2.5" ry="2.8" fill="#d4d000" opacity="0.9"/><ellipse cx="19.5" cy="9.5" rx="2.5" ry="2.8" fill="#d4d000" opacity="0.9"/><ellipse cx="12.5" cy="9.5" rx="0.85" ry="1.8" fill="#0a0800"/><ellipse cx="19.5" cy="9.5" rx="0.85" ry="1.8" fill="#0a0800"/><ellipse cx="12.2" cy="8.3" rx="0.65" ry="0.45" fill="white" opacity="0.55"/><ellipse cx="19.2" cy="8.3" rx="0.65" ry="0.45" fill="white" opacity="0.55"/><path d="M11 13.5 L12.5 16 L14 14.5 L16 17 L18 14.5 L19.5 16 L21 13.5" fill="none" stroke="${dk}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  },

  // ─── ESQUELETO GUERREIRO ───────────────────────────────────────
  esqueleto:{
    label:'Esqueleto',
    head:c=>{const md=_hexDarken2(c,32),sh=_hexDarken2(c,14),dk=_hexDarken2(c,58);return `<ellipse cx="16" cy="23.5" rx="7.5" ry="2" fill="${dk}" opacity="0.3"/><ellipse cx="16" cy="14" rx="9.5" ry="9" fill="${md}" opacity="0.65"/><ellipse cx="16" cy="13.5" rx="9" ry="8.5" fill="${c}"/><ellipse cx="16" cy="20" rx="8" ry="4.5" fill="${sh}" opacity="0.75"/><path d="M7.5 14.5 Q8 6 16 6 Q24 6 24.5 14.5 L23.5 17.5 Q16 19.5 8.5 17.5 Z" fill="${sh}" opacity="0.35"/><ellipse cx="11.5" cy="12" rx="3.8" ry="4.2" fill="#040412" opacity="0.92"/><ellipse cx="20.5" cy="12" rx="3.8" ry="4.2" fill="#040412" opacity="0.92"/><ellipse cx="11.5" cy="12" rx="2.5" ry="3.2" fill="#10203a" opacity="0.8"/><ellipse cx="20.5" cy="12" rx="2.5" ry="3.2" fill="#10203a" opacity="0.8"/><ellipse cx="11.5" cy="11" rx="1.8" ry="1.6" fill="#0028a0" opacity="0.55"/><ellipse cx="20.5" cy="11" rx="1.8" ry="1.6" fill="#0028a0" opacity="0.55"/><ellipse cx="11.5" cy="11" rx="0.9" ry="0.8" fill="#3a80ff" opacity="0.85"/><ellipse cx="20.5" cy="11" rx="0.9" ry="0.8" fill="#3a80ff" opacity="0.85"/><ellipse cx="11.2" cy="10.4" rx="0.45" ry="0.35" fill="#a0d0ff" opacity="0.7"/><ellipse cx="20.2" cy="10.4" rx="0.45" ry="0.35" fill="#a0d0ff" opacity="0.7"/><ellipse cx="16" cy="19" rx="2" ry="1.2" fill="#040412" opacity="0.75"/><path d="M11.5 21 L12.5 24.5 M14.5 21.5 L14.8 24.5 M17.5 21.5 L17.2 24.5 M19.5 21 L18.5 24.5" stroke="${md}" stroke-width="1.3" stroke-linecap="round"/><path d="M13 21 Q16 22.5 19 21" fill="none" stroke="${md}" stroke-width="0.5"/><path d="M10 9 Q12 11.5 13.5 9.5" fill="none" stroke="${md}" stroke-width="0.6" opacity="0.45"/><path d="M19.5 10 Q21 12 23 10" fill="none" stroke="${md}" stroke-width="0.6" opacity="0.45"/><path d="M8.5 11.5 Q9.5 9.5 10 11" fill="none" stroke="${sh}" stroke-width="0.9" opacity="0.5"/><path d="M22.5 13.5 Q23.5 11 24 13" fill="none" stroke="${sh}" stroke-width="0.9" opacity="0.5"/><ellipse cx="13" cy="8" rx="4" ry="2.2" fill="white" opacity="0.07" transform="rotate(-15 13 8)"/>`;},
    iso:c=>{const md=_hexDarken2(c,32),sh=_hexDarken2(c,14),dk=_hexDarken2(c,58);return `<ellipse cx="16" cy="50.5" rx="7" ry="2" fill="${dk}" opacity="0.3"/><path d="M12 42.5 Q11.5 51.5 13.5 51.5 L14.5 42.5 Z" fill="${sh}" opacity="0.9"/><path d="M19.5 42.5 Q20 51.5 18 51.5 L17 42.5 Z" fill="${sh}" opacity="0.9"/><circle cx="13" cy="51.5" r="1.8" fill="${md}" opacity="0.7"/><circle cx="19" cy="51.5" r="1.8" fill="${md}" opacity="0.7"/><path d="M11.5 36 Q10.5 44 13.5 43.5 L14.5 36 Z" fill="${sh}" opacity="0.85"/><path d="M20.5 36 Q21.5 44 18.5 43.5 L17.5 36 Z" fill="${sh}" opacity="0.85"/><path d="M13.5 30 L15 43 L17 43 L18.5 30 Q16 32 13.5 30 Z" fill="${sh}" opacity="0.7"/><path d="M13.5 20 L12.5 31 Q16 33.5 19.5 31 L18.5 20 Z" fill="${md}" opacity="0.65"/><path d="M14 20 L13 30.5 Q16 33 19 30.5 L18 20 Z" fill="${c}" opacity="0.7"/><path d="M14 22 Q16 22.8 18 22" fill="none" stroke="${md}" stroke-width="1.1" opacity="0.65"/><path d="M14 24 Q16 24.8 18 24" fill="none" stroke="${md}" stroke-width="0.9" opacity="0.55"/><path d="M14 26 Q16 26.8 18 26" fill="none" stroke="${md}" stroke-width="0.8" opacity="0.5"/><path d="M14 28 Q16 28.8 18 28" fill="none" stroke="${md}" stroke-width="0.7" opacity="0.4"/><rect x="14.5" y="20" width="3" height="11" rx="0.5" fill="${md}" opacity="0.5"/><path d="M4.5 22.5 L11 20.5 L11 28.5 L4.5 26 Z" fill="${sh}" opacity="0.85"/><path d="M27.5 22.5 L21 20.5 L21 28.5 L27.5 26 Z" fill="${sh}" opacity="0.85"/><path d="M4.5 22.5 L11 20.5" fill="none" stroke="${md}" stroke-width="0.6"/><path d="M27.5 22.5 L21 20.5" fill="none" stroke="${md}" stroke-width="0.6"/><rect x="3.5" y="20" width="1.5" height="24" rx="0.5" fill="${sh}" stroke="${md}" stroke-width="0.3"/><circle cx="16" cy="12" r="9" fill="${md}" opacity="0.6"/><ellipse cx="16" cy="11.5" rx="8.5" ry="8" fill="${c}"/><ellipse cx="11" cy="10" rx="3.8" ry="4.2" fill="#040412" opacity="0.9"/><ellipse cx="21" cy="10" rx="3.8" ry="4.2" fill="#040412" opacity="0.9"/><ellipse cx="11" cy="10" rx="1.8" ry="1.6" fill="#0028a0" opacity="0.5"/><ellipse cx="21" cy="10" rx="1.8" ry="1.6" fill="#0028a0" opacity="0.5"/><ellipse cx="11" cy="10" rx="0.9" ry="0.8" fill="#3a80ff" opacity="0.8"/><ellipse cx="21" cy="10" rx="0.9" ry="0.8" fill="#3a80ff" opacity="0.8"/><ellipse cx="16" cy="16" rx="2" ry="1.2" fill="#040412" opacity="0.7"/><path d="M11.5 18.5 L12.5 21.5 M14.5 19 L14.8 21.5 M17.5 19 L17.2 21.5 M20.5 18.5 L19.5 21.5" stroke="${md}" stroke-width="1.1" stroke-linecap="round"/>`;
    }
  },

  // ─── LOBO SOMBRIO ─────────────────────────────────────────────
  lobo:{
    label:'Lobo',
    head:c=>{const md=_hexDarken2(c,38),sh=_hexDarken2(c,16),dk=_hexDarken2(c,62);return `<ellipse cx="16" cy="23" rx="9" ry="2" fill="${dk}" opacity="0.3"/><polygon points="9,9.5 6.5,2 12.5,8.5" fill="${md}" stroke="${dk}" stroke-width="0.4"/><polygon points="23,9.5 25.5,2 19.5,8.5" fill="${md}" stroke="${dk}" stroke-width="0.4"/><ellipse cx="9.5" cy="6.5" rx="1.8" ry="2.5" fill="#d07878" opacity="0.55"/><ellipse cx="22.5" cy="6.5" rx="1.8" ry="2.5" fill="#d07878" opacity="0.55"/><ellipse cx="16" cy="16" rx="11" ry="9" fill="${dk}" opacity="0.45"/><ellipse cx="16" cy="15.5" rx="10.5" ry="8.5" fill="${md}"/><ellipse cx="16" cy="14.5" rx="9.5" ry="7.5" fill="${c}"/><path d="M7 15.5 Q9 12 12 13.5 Q14 11.5 16 12.5 Q18 11.5 20 13.5 Q23 12 25 15.5" fill="${sh}" opacity="0.45"/><path d="M7.5 16.5 Q9.5 13 12.5 14.5 Q14.5 12 16 13 Q17.5 12 19.5 14.5 Q22.5 13 24.5 16.5" fill="${sh}" opacity="0.25"/><ellipse cx="16" cy="21.5" rx="7.5" ry="3.5" fill="${sh}"/><ellipse cx="16" cy="22" rx="6.5" ry="2.5" fill="${md}" opacity="0.5"/><ellipse cx="12.5" cy="13.5" rx="2.8" ry="2.5" fill="#f8b820" opacity="0.95"/><ellipse cx="19.5" cy="13.5" rx="2.8" ry="2.5" fill="#f8b820" opacity="0.95"/><ellipse cx="12.5" cy="13.5" rx="1" ry="2" fill="#100800"/><ellipse cx="19.5" cy="13.5" rx="1" ry="2" fill="#100800"/><ellipse cx="12.1" cy="12.3" rx="0.7" ry="0.5" fill="white" opacity="0.7"/><ellipse cx="19.1" cy="12.3" rx="0.7" ry="0.5" fill="white" opacity="0.7"/><path d="M10 19.5 Q12 17.5 13.5 18.5 Q14.5 17 16 17.5 Q17.5 17 18.5 18.5 Q20 17.5 22 19.5" fill="${md}" opacity="0.8"/><path d="M11 21 L12.5 24 M14 20.5 L14.5 23.5 M16 20.5 L16 24 M18 20.5 L17.5 23.5 M21 21 L19.5 24" stroke="${md}" stroke-width="1" stroke-linecap="round"/><path d="M12 21 Q16 24.5 20 21" fill="none" stroke="${dk}" stroke-width="0.55" opacity="0.5"/><circle cx="15.5" cy="20" r="0.85" fill="${dk}" opacity="0.6"/><circle cx="16.5" cy="20" r="0.85" fill="${dk}" opacity="0.6"/><path d="M8.5 14.5 Q9 12.5 10.5 13" fill="none" stroke="${sh}" stroke-width="0.7" opacity="0.55"/><path d="M23.5 14.5 Q23 12.5 21.5 13" fill="none" stroke="${sh}" stroke-width="0.7" opacity="0.55"/><ellipse cx="14" cy="8.5" rx="4.5" ry="2.5" fill="white" opacity="0.08" transform="rotate(-10 14 8.5)"/>`;},
    iso:c=>{const md=_hexDarken2(c,38),sh=_hexDarken2(c,16),dk=_hexDarken2(c,62);return `<ellipse cx="16" cy="50.5" rx="11" ry="3" fill="${dk}" opacity="0.4"/><path d="M6 40.5 Q5 50 8.5 50 L9.5 40.5 Z" fill="${md}" opacity="0.85"/><path d="M12 43.5 Q11.5 51 14 51 L14.5 43.5 Z" fill="${md}" opacity="0.85"/><path d="M20 43.5 Q20.5 51 18 51 L17.5 43.5 Z" fill="${md}" opacity="0.85"/><path d="M26 40.5 Q27 50 23.5 50 L22.5 40.5 Z" fill="${md}" opacity="0.85"/><path d="M6.5 40.5 Q5.5 50 8.5 50 L9.5 40.5 Z" fill="${sh}"/><path d="M12.5 43.5 Q12 51 14 51 L14.5 43.5 Z" fill="${sh}"/><path d="M19.5 43.5 Q20 51 18 51 L17.5 43.5 Z" fill="${sh}"/><path d="M25.5 40.5 Q26.5 50 23.5 50 L22.5 40.5 Z" fill="${sh}"/><ellipse cx="16" cy="37.5" rx="13.5" ry="8.5" fill="${md}"/><ellipse cx="16" cy="37" rx="12.5" ry="7.5" fill="${c}"/><path d="M4 34.5 Q7 31 11 34 Q14 30 16 31 Q18 30 21 34 Q25 31 28 34.5" fill="${sh}" opacity="0.45" stroke="none"/><path d="M3.5 36.5 Q5.5 33.5 8 35.5 Q10 32.5 12 35 Q14 32 16 33 Q18 32 20 35 Q22 32.5 24 35.5 Q26.5 33.5 28.5 36.5" fill="${md}" stroke="none" opacity="0.3"/><ellipse cx="16" cy="42.5" rx="11" ry="4.5" fill="${md}" opacity="0.4"/><path d="M28 26 Q31 22 30 29.5 Q29 35 25.5 34.5 Q22.5 30.5 28 26 Z" fill="${sh}" opacity="0.8"/><ellipse cx="16" cy="19" rx="10" ry="8" fill="${md}"/><ellipse cx="16" cy="18.5" rx="9.5" ry="7.5" fill="${c}"/><polygon points="9.5,14 7,7 13,13" fill="${md}"/><polygon points="22.5,14 25,7 19,13" fill="${md}"/><ellipse cx="10" cy="8.5" rx="1.8" ry="2.5" fill="#d07878" opacity="0.5"/><ellipse cx="22" cy="8.5" rx="1.8" ry="2.5" fill="#d07878" opacity="0.5"/><polygon points="10,14 7.5,7.5 13,13" fill="${sh}"/><polygon points="22,14 24.5,7.5 19,13" fill="${sh}"/><ellipse cx="12" cy="18.5" rx="3" ry="2.5" fill="#f8b820" opacity="0.9"/><ellipse cx="20" cy="18.5" rx="3" ry="2.5" fill="#f8b820" opacity="0.9"/><ellipse cx="12" cy="18.5" rx="1.1" ry="2" fill="#100800"/><ellipse cx="20" cy="18.5" rx="1.1" ry="2" fill="#100800"/><ellipse cx="11.6" cy="17.3" rx="0.7" ry="0.5" fill="white" opacity="0.65"/><ellipse cx="19.6" cy="17.3" rx="0.7" ry="0.5" fill="white" opacity="0.65"/><path d="M10.5 23.5 Q12.5 21.5 13.5 22.5 Q14.5 21 16 21.5 Q17.5 21 18.5 22.5 Q19.5 21.5 21.5 23.5" fill="${md}" opacity="0.75"/><path d="M11 25 L12.5 27.5 M14 24.5 L14.5 27.5 M16 24.5 L16 28 M18 24.5 L17.5 27.5 M21 25 L19.5 27.5" stroke="${md}" stroke-width="1" stroke-linecap="round"/>`;
    }
  },

  // ─── DRAGÃO ANCIÃO ────────────────────────────────────────────
  dragao:{
    label:'Dragão',
    head:c=>{const md=_hexDarken2(c,42),sh=_hexDarken2(c,18),dk=_hexDarken2(c,72),sc=_hexDarken2(c,28);return `<ellipse cx="16" cy="23.5" rx="9" ry="2.5" fill="${dk}" opacity="0.3"/><polygon points="16,3.5 14,0.5 18,0.5" fill="${dk}" stroke="${md}" stroke-width="0.4"/><polygon points="10,7 6.5,1.5 12.5,6.5" fill="${md}" stroke="${dk}" stroke-width="0.4"/><polygon points="22,7 25.5,1.5 19.5,6.5" fill="${md}" stroke="${dk}" stroke-width="0.4"/><ellipse cx="16" cy="15" rx="11" ry="9" fill="${md}"/><ellipse cx="16" cy="14.5" rx="10" ry="8.5" fill="${c}"/><circle cx="9" cy="12" r="1.9" fill="${sc}" opacity="0.5"/><circle cx="12.5" cy="9" r="1.9" fill="${sc}" opacity="0.5"/><circle cx="16" cy="7.5" r="1.9" fill="${sc}" opacity="0.5"/><circle cx="19.5" cy="9" r="1.9" fill="${sc}" opacity="0.5"/><circle cx="23" cy="12" r="1.9" fill="${sc}" opacity="0.5"/><circle cx="9" cy="16.5" r="1.9" fill="${sc}" opacity="0.45"/><circle cx="12.5" cy="14" r="1.9" fill="${sc}" opacity="0.45"/><circle cx="19.5" cy="14" r="1.9" fill="${sc}" opacity="0.45"/><circle cx="23" cy="16.5" r="1.9" fill="${sc}" opacity="0.45"/><circle cx="12" cy="19.5" r="1.9" fill="${sc}" opacity="0.4"/><circle cx="16" cy="20.5" r="1.9" fill="${sc}" opacity="0.4"/><circle cx="20" cy="19.5" r="1.9" fill="${sc}" opacity="0.4"/><path d="M7 17.5 Q8 20.5 11 22.5" fill="none" stroke="${sc}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/><path d="M25 17.5 Q24 20.5 21 22.5" fill="none" stroke="${sc}" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/><ellipse cx="16" cy="22.5" rx="5" ry="2" fill="${sh}"/><ellipse cx="11.5" cy="12.5" rx="3" ry="2.2" fill="#e85010" opacity="0.95"/><ellipse cx="20.5" cy="12.5" rx="3" ry="2.2" fill="#e85010" opacity="0.95"/><ellipse cx="11.5" cy="12.5" rx="1.2" ry="2.1" fill="#180400"/><ellipse cx="20.5" cy="12.5" rx="1.2" ry="2.1" fill="#180400"/><ellipse cx="11" cy="11.2" rx="0.9" ry="0.65" fill="#ff9848" opacity="0.8"/><ellipse cx="20" cy="11.2" rx="0.9" ry="0.65" fill="#ff9848" opacity="0.8"/><ellipse cx="16" cy="20.5" rx="3.5" ry="1.5" fill="${md}"/><path d="M11 22 L13 25" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M14 22.5 L15.5 25.5" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M21 22 L19 25" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M18 22.5 L16.5 25.5" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><circle cx="10" cy="21" r="0.65" fill="#ff6020" opacity="0.55"/><circle cx="22" cy="21" r="0.65" fill="#ff6020" opacity="0.55"/><ellipse cx="13" cy="7" rx="5" ry="2.5" fill="white" opacity="0.1" transform="rotate(-15 13 7)"/>`;},
    iso:c=>{const md=_hexDarken2(c,42),sh=_hexDarken2(c,18),dk=_hexDarken2(c,72),sc=_hexDarken2(c,28);return `<ellipse cx="16" cy="51" rx="12" ry="3" fill="${dk}" opacity="0.4"/><path d="M26 31 Q32.5 25 31.5 35 Q30.5 43 26.5 39 Z" fill="${md}" opacity="0.8"/><path d="M6 31 Q-0.5 25 0.5 35 Q1.5 43 5.5 39 Z" fill="${md}" opacity="0.8"/><path d="M26.5 32 Q32 27 31 35.5 Q30 42 26.5 39 Z" fill="${sh}" opacity="0.65"/><path d="M5.5 32 Q0 27 1 35.5 Q2 42 5.5 39 Z" fill="${sh}" opacity="0.65"/><path d="M16 43 Q28.5 41 30.5 48.5 Q28.5 52 16 52 Q3.5 52 1.5 48.5 Q3.5 41 16 43 Z" fill="${md}"/><path d="M16 43 Q28 41 30 48 Q28 51.5 16 51.5 Q4 51.5 2 48 Q4 41 16 43 Z" fill="${c}"/><circle cx="9" cy="45" r="1.7" fill="${sc}" opacity="0.5"/><circle cx="13.5" cy="43.5" r="1.7" fill="${sc}" opacity="0.5"/><circle cx="18" cy="43" r="1.7" fill="${sc}" opacity="0.5"/><circle cx="22" cy="43.5" r="1.7" fill="${sc}" opacity="0.5"/><circle cx="26" cy="45" r="1.7" fill="${sc}" opacity="0.5"/><circle cx="7.5" cy="48" r="1.7" fill="${sc}" opacity="0.45"/><circle cx="12" cy="47.5" r="1.7" fill="${sc}" opacity="0.45"/><circle cx="16" cy="47.5" r="1.7" fill="${sc}" opacity="0.45"/><circle cx="20" cy="47.5" r="1.7" fill="${sc}" opacity="0.45"/><circle cx="24.5" cy="48" r="1.7" fill="${sc}" opacity="0.45"/><path d="M6 41 L4.5 51" stroke="${sc}" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/><path d="M26 41 L27.5 51" stroke="${sc}" stroke-width="2.5" stroke-linecap="round" opacity="0.65"/><ellipse cx="16" cy="26.5" rx="11" ry="9" fill="${md}"/><ellipse cx="16" cy="26" rx="10" ry="8" fill="${c}"/><circle cx="9" cy="24" r="1.8" fill="${sc}" opacity="0.5"/><circle cx="12.5" cy="21" r="1.8" fill="${sc}" opacity="0.5"/><circle cx="16" cy="20" r="1.8" fill="${sc}" opacity="0.5"/><circle cx="19.5" cy="21" r="1.8" fill="${sc}" opacity="0.5"/><circle cx="23" cy="24" r="1.8" fill="${sc}" opacity="0.5"/><circle cx="10" cy="28" r="1.8" fill="${sc}" opacity="0.45"/><circle cx="14" cy="26" r="1.8" fill="${sc}" opacity="0.45"/><circle cx="18" cy="26" r="1.8" fill="${sc}" opacity="0.45"/><circle cx="22" cy="28" r="1.8" fill="${sc}" opacity="0.45"/><path d="M6.5 28.5 Q8 32 11 33" fill="none" stroke="${sc}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><path d="M25.5 28.5 Q24 32 21 33" fill="none" stroke="${sc}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><polygon points="10,17 7,12 12.5,16" fill="${md}" stroke="${dk}" stroke-width="0.4"/><polygon points="22,17 25,12 19.5,16" fill="${md}" stroke="${dk}" stroke-width="0.4"/><ellipse cx="11.5" cy="23.5" rx="3" ry="2.2" fill="#e85010" opacity="0.9"/><ellipse cx="20.5" cy="23.5" rx="3" ry="2.2" fill="#e85010" opacity="0.9"/><ellipse cx="11.5" cy="23.5" rx="1.2" ry="2.1" fill="#180400"/><ellipse cx="20.5" cy="23.5" rx="1.2" ry="2.1" fill="#180400"/><ellipse cx="11" cy="22.2" rx="0.9" ry="0.65" fill="#ff9848" opacity="0.75"/><ellipse cx="20" cy="22.2" rx="0.9" ry="0.65" fill="#ff9848" opacity="0.75"/><path d="M12 31.5 L14 34" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M15 32 L16.5 35" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M20 31.5 L18 34" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="13" cy="17.5" rx="5" ry="2.5" fill="white" opacity="0.09" transform="rotate(-15 13 17.5)"/>`;
    }
  },

  // ─── ARANHA FANTASMA ──────────────────────────────────────────
  aranha:{
    label:'Aranha',
    head:c=>{const md=_hexDarken2(c,45),sh=_hexDarken2(c,20),dk=_hexDarken2(c,72);return `<ellipse cx="16" cy="23" rx="9" ry="2.5" fill="${dk}" opacity="0.3"/><line x1="8" y1="13.5" x2="2.5" y2="9" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="16" x2="2.5" y2="16" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="8.5" y1="18.5" x2="3.5" y2="21.5" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="24" y1="13.5" x2="29.5" y2="9" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="24" y1="16" x2="29.5" y2="16" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="23.5" y1="18.5" x2="28.5" y2="21.5" stroke="${md}" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="13.5" x2="2.5" y2="9" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><line x1="8" y1="16" x2="2.5" y2="16" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><line x1="8.5" y1="18.5" x2="3.5" y2="21.5" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><line x1="24" y1="13.5" x2="29.5" y2="9" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><line x1="24" y1="16" x2="29.5" y2="16" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><line x1="23.5" y1="18.5" x2="28.5" y2="21.5" stroke="${sh}" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/><ellipse cx="16" cy="15" rx="11" ry="9.5" fill="${md}" opacity="0.7"/><ellipse cx="16" cy="14.5" rx="10" ry="9" fill="${c}"/><path d="M10 8 Q16 7 22 8" fill="none" stroke="${md}" stroke-width="2.6" stroke-linecap="round"/><path d="M10 8 Q16 7.5 22 8" fill="none" stroke="${sh}" stroke-width="1.2" stroke-linecap="round"/><circle cx="9.5" cy="9.5" r="1.6" fill="#cc1808" opacity="0.95"/><circle cx="12.5" cy="8" r="1.6" fill="#cc1808" opacity="0.95"/><circle cx="16" cy="7.5" r="1.6" fill="#cc1808" opacity="0.95"/><circle cx="19.5" cy="8" r="1.6" fill="#cc1808" opacity="0.95"/><circle cx="22.5" cy="9.5" r="1.6" fill="#cc1808" opacity="0.95"/><circle cx="9.5" cy="9.5" r="0.7" fill="#ff5040" opacity="0.7"/><circle cx="12.5" cy="8" r="0.7" fill="#ff5040" opacity="0.7"/><circle cx="16" cy="7.5" r="0.7" fill="#ff5040" opacity="0.7"/><circle cx="19.5" cy="8" r="0.7" fill="#ff5040" opacity="0.7"/><circle cx="22.5" cy="9.5" r="0.7" fill="#ff5040" opacity="0.7"/><path d="M13 18 L12 21.5 Q14 22.5 16 22 Q18 22.5 20 21.5 L19 18" fill="${md}" stroke="${md}" stroke-width="0.5"/><path d="M14 22 L14.5 25.5" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M18 22 L17.5 25.5" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><circle cx="14.5" cy="25.5" r="1.1" fill="#a8d800" opacity="0.75"/><circle cx="17.5" cy="25.5" r="1.1" fill="#a8d800" opacity="0.75"/><ellipse cx="14" cy="9.5" rx="5" ry="3" fill="white" opacity="0.07" transform="rotate(-10 14 9.5)"/>`;},
    iso:c=>{const md=_hexDarken2(c,45),sh=_hexDarken2(c,20),dk=_hexDarken2(c,72);return `<ellipse cx="16" cy="50.5" rx="13" ry="3.5" fill="${dk}" opacity="0.4"/><line x1="4" y1="29" x2="0" y2="22" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="5" y1="33" x2="0" y2="32" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="5.5" y1="37" x2="1" y2="40.5" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="6.5" y1="41.5" x2="2" y2="47.5" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="28" y1="29" x2="32" y2="22" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="27" y1="33" x2="32" y2="32" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="26.5" y1="37" x2="31" y2="40.5" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="25.5" y1="41.5" x2="30" y2="47.5" stroke="${md}" stroke-width="2.1" stroke-linecap="round"/><line x1="4.5" y1="29" x2="0" y2="22" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="5.5" y1="33" x2="0" y2="32" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="6" y1="37" x2="1" y2="40.5" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="7" y1="41.5" x2="2" y2="47.5" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="27.5" y1="29" x2="32" y2="22" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="26.5" y1="33" x2="32" y2="32" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="26" y1="37" x2="31" y2="40.5" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><line x1="25" y1="41.5" x2="30" y2="47.5" stroke="${sh}" stroke-width="1" stroke-linecap="round" opacity="0.55"/><ellipse cx="16" cy="38.5" rx="13" ry="9.5" fill="${md}"/><ellipse cx="16" cy="38" rx="12" ry="9" fill="${c}"/><ellipse cx="10" cy="34.5" rx="3.2" ry="2.5" fill="${sh}" opacity="0.5"/><ellipse cx="22" cy="34.5" rx="3.2" ry="2.5" fill="${sh}" opacity="0.5"/><ellipse cx="16" cy="35" rx="4.5" ry="3.2" fill="${sh}" opacity="0.4"/><circle cx="11" cy="38.5" r="2.2" fill="${md}" opacity="0.5"/><circle cx="16" cy="37.5" r="2.8" fill="${md}" opacity="0.38"/><circle cx="21" cy="38.5" r="2.2" fill="${md}" opacity="0.5"/><ellipse cx="16" cy="43.5" rx="9.5" ry="5.5" fill="${md}" opacity="0.42"/><path d="M13 44.5 L13.5 51.5" stroke="${dk}" stroke-width="1.6" stroke-linecap="round"/><path d="M19 44.5 L18.5 51.5" stroke="${dk}" stroke-width="1.6" stroke-linecap="round"/><circle cx="13.5" cy="51.5" r="1.3" fill="#a8d800" opacity="0.78"/><circle cx="18.5" cy="51.5" r="1.3" fill="#a8d800" opacity="0.78"/><ellipse cx="16" cy="20.5" rx="8.5" ry="7.5" fill="${md}"/><ellipse cx="16" cy="20" rx="8" ry="7" fill="${c}"/><path d="M10 15.5 Q16 14.5 22 15.5" fill="none" stroke="${md}" stroke-width="2.6" stroke-linecap="round"/><circle cx="10.5" cy="16" r="1.6" fill="#cc1808" opacity="0.9"/><circle cx="13.5" cy="14.5" r="1.6" fill="#cc1808" opacity="0.9"/><circle cx="16" cy="14" r="1.6" fill="#cc1808" opacity="0.9"/><circle cx="18.5" cy="14.5" r="1.6" fill="#cc1808" opacity="0.9"/><circle cx="21.5" cy="16" r="1.6" fill="#cc1808" opacity="0.9"/><circle cx="10.5" cy="16" r="0.7" fill="#ff5040" opacity="0.65"/><circle cx="16" cy="14" r="0.7" fill="#ff5040" opacity="0.65"/><circle cx="21.5" cy="16" r="0.7" fill="#ff5040" opacity="0.65"/><path d="M13 22.5 L12 26 Q14 27 16 26.5 Q18 27 20 26 L19 22.5" fill="${md}"/><path d="M14 26 L14.5 30" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><path d="M18 26 L17.5 30" stroke="${dk}" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="14" cy="17.5" rx="5" ry="3" fill="white" opacity="0.07" transform="rotate(-10 14 17.5)"/>`;
    }
  },

  // ─── SLIME ABISSAL ────────────────────────────────────────────
  slime:{
    label:'Slime',
    head:c=>{const md=_hexDarken2(c,42),sh=_hexDarken2(c,16),dk=_hexDarken2(c,70);return `<ellipse cx="16" cy="23.5" rx="10" ry="3" fill="${dk}" opacity="0.35"/><ellipse cx="16" cy="23" rx="9" ry="2.2" fill="${md}" opacity="0.5"/><ellipse cx="16" cy="22" rx="10.5" ry="4.5" fill="${md}" opacity="0.9"/><ellipse cx="16" cy="14.5" rx="11" ry="10" fill="${md}" opacity="0.5"/><ellipse cx="16" cy="14" rx="10.5" ry="9.5" fill="${c}" opacity="0.88"/><ellipse cx="16" cy="13" rx="9.5" ry="8.5" fill="${c}" opacity="0.78"/><ellipse cx="16" cy="11" rx="8.5" ry="7" fill="${sh}" opacity="0.38"/><ellipse cx="16" cy="9" rx="7" ry="5.5" fill="${sh}" opacity="0.28"/><ellipse cx="12" cy="14" rx="4" ry="3.2" fill="white" opacity="0.25"/><ellipse cx="20" cy="14" rx="4" ry="3.2" fill="white" opacity="0.25"/><ellipse cx="12" cy="14" rx="2.2" ry="2.8" fill="${md}" opacity="0.72"/><ellipse cx="20" cy="14" rx="2.2" ry="2.8" fill="${md}" opacity="0.72"/><circle cx="12" cy="14" r="1.1" fill="#0a0818"/><circle cx="20" cy="14" r="1.1" fill="#0a0818"/><circle cx="11.5" cy="13.1" r="0.55" fill="white" opacity="0.65"/><circle cx="19.5" cy="13.1" r="0.55" fill="white" opacity="0.65"/><ellipse cx="16" cy="20.5" rx="7.5" ry="2.2" fill="${dk}" opacity="0.38"/><circle cx="8" cy="17.5" r="1.3" fill="${sh}" opacity="0.6"/><circle cx="24.5" cy="15.5" r="1.6" fill="${sh}" opacity="0.5"/><path d="M8.5 11.5 Q7 8 9.5 10" stroke="${sh}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.5"/><path d="M23 10 Q25.5 7.5 24.5 12" stroke="${sh}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.5"/><circle cx="13.5" cy="18.5" r="0.85" fill="${dk}" opacity="0.5"/><circle cx="19" cy="19.5" r="0.65" fill="${dk}" opacity="0.5"/><ellipse cx="16" cy="22.5" rx="9.5" ry="2.5" fill="${sh}" opacity="0.38"/><circle cx="10.5" cy="10.5" r="0.9" fill="${md}" opacity="0.5"/><circle cx="21.5" cy="10" r="0.7" fill="${md}" opacity="0.42"/><ellipse cx="13" cy="8.5" rx="5.5" ry="3" fill="white" opacity="0.12" transform="rotate(-15 13 8.5)"/>`;},
    iso:c=>{const md=_hexDarken2(c,42),sh=_hexDarken2(c,16),dk=_hexDarken2(c,70);return `<ellipse cx="16" cy="50" rx="14" ry="5" fill="${dk}" opacity="0.45"/><ellipse cx="16" cy="49.5" rx="13" ry="4" fill="${md}" opacity="0.5"/><ellipse cx="5" cy="44.5" rx="3.8" ry="5" fill="${c}" opacity="0.55"/><ellipse cx="27.5" cy="42.5" rx="4.2" ry="5.5" fill="${c}" opacity="0.55"/><ellipse cx="4.5" cy="42.5" rx="3.2" ry="4" fill="${sh}" opacity="0.42"/><ellipse cx="28" cy="40.5" rx="3.5" ry="4.5" fill="${sh}" opacity="0.42"/><ellipse cx="16" cy="44.5" rx="14" ry="6.5" fill="${md}" opacity="0.85"/><ellipse cx="16" cy="38" rx="14.5" ry="10" fill="${md}" opacity="0.7"/><ellipse cx="16" cy="37" rx="14" ry="9.5" fill="${c}" opacity="0.9"/><ellipse cx="16" cy="35" rx="13" ry="8.5" fill="${c}" opacity="0.78"/><ellipse cx="16" cy="32" rx="12" ry="7.5" fill="${sh}" opacity="0.38"/><ellipse cx="16" cy="29" rx="10" ry="6.5" fill="${sh}" opacity="0.28"/><ellipse cx="11" cy="34.5" rx="2.8" ry="3.8" fill="white" opacity="0.22"/><ellipse cx="21" cy="34.5" rx="2.8" ry="3.8" fill="white" opacity="0.22"/><ellipse cx="11" cy="34.5" rx="2.8" ry="3.8" fill="${md}" opacity="0.62"/><ellipse cx="21" cy="34.5" rx="2.8" ry="3.8" fill="${md}" opacity="0.62"/><circle cx="11" cy="34.5" r="1.7" fill="#0a0818"/><circle cx="21" cy="34.5" r="1.7" fill="#0a0818"/><circle cx="10.4" cy="33.2" r="0.8" fill="white" opacity="0.7"/><circle cx="20.4" cy="33.2" r="0.8" fill="white" opacity="0.7"/><path d="M8 36.5 Q6.5 33.5 8.5 35.5" stroke="${sh}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.52"/><path d="M24.5 34.5 Q27 32 25.5 36.5" stroke="${sh}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.52"/><ellipse cx="16" cy="44.5" rx="12.5" ry="4.5" fill="${sh}" opacity="0.42"/><circle cx="10.5" cy="28.5" r="1.3" fill="${md}" opacity="0.5"/><circle cx="22.5" cy="29.5" r="1.1" fill="${md}" opacity="0.42"/><circle cx="16.5" cy="27" r="1.7" fill="${md}" opacity="0.45"/><ellipse cx="13" cy="26" rx="6" ry="3.5" fill="white" opacity="0.12" transform="rotate(-15 13 26)"/>`;
    }
  },

  // ─── DEMÔNIO SUPERIOR ─────────────────────────────────────────
  demonio:{
    label:'Demônio',
    head:c=>{const md=_hexDarken2(c,52),sh=_hexDarken2(c,26),dk=_hexDarken2(c,76);return `<ellipse cx="16" cy="23.5" rx="9" ry="2.5" fill="${dk}" opacity="0.35"/><path d="M8 9 Q5.5 0.5 10.5 4.5 L11 10 Z" fill="${md}" stroke="${dk}" stroke-width="0.5"/><path d="M24 9 Q26.5 0.5 21.5 4.5 L21 10 Z" fill="${md}" stroke="${dk}" stroke-width="0.5"/><path d="M8.5 9 Q6 1.5 11 5.5 L11.5 10 Z" fill="${sh}" opacity="0.9"/><path d="M23.5 9 Q26 1.5 21 5.5 L20.5 10 Z" fill="${sh}" opacity="0.9"/><path d="M13.5 7.5 Q14.5 3.5 16 4.5 Q17.5 3.5 18.5 7.5" fill="${md}" stroke="${dk}" stroke-width="0.4" opacity="0.85"/><ellipse cx="16" cy="16" rx="10" ry="9" fill="${md}"/><ellipse cx="16" cy="15.5" rx="9.5" ry="8.5" fill="${c}"/><path d="M9.5 12 Q11 9.5 12.5 11" fill="none" stroke="${md}" stroke-width="0.9" opacity="0.6"/><path d="M22.5 12 Q21 9.5 19.5 11" fill="none" stroke="${md}" stroke-width="0.9" opacity="0.6"/><path d="M10 16.5 Q13 13.5 16 14.5 Q19 13.5 22 16.5" fill="none" stroke="${md}" stroke-width="0.65" opacity="0.5"/><line x1="16" y1="8" x2="16" y2="23.5" stroke="${md}" stroke-width="0.5" opacity="0.38"/><line x1="8.5" y1="15.5" x2="23.5" y2="15.5" stroke="${md}" stroke-width="0.45" opacity="0.32"/><ellipse cx="12" cy="13.5" rx="3.2" ry="3.4" fill="#300000" opacity="0.9"/><ellipse cx="20" cy="13.5" rx="3.2" ry="3.4" fill="#300000" opacity="0.9"/><ellipse cx="12" cy="13.5" rx="2.1" ry="2.4" fill="#c82800" opacity="0.92"/><ellipse cx="20" cy="13.5" rx="2.1" ry="2.4" fill="#c82800" opacity="0.92"/><ellipse cx="12" cy="13.5" rx="0.85" ry="2.1" fill="#1c0000"/><ellipse cx="20" cy="13.5" rx="0.85" ry="2.1" fill="#1c0000"/><ellipse cx="12" cy="11.8" rx="1.3" ry="0.75" fill="#ff8840" opacity="0.72"/><ellipse cx="20" cy="11.8" rx="1.3" ry="0.75" fill="#ff8840" opacity="0.72"/><ellipse cx="16" cy="21.5" rx="5.5" ry="2" fill="${sh}"/><path d="M11 22 Q13.5 19.5 16 21 Q18.5 19.5 21 22" fill="${md}" opacity="0.82"/><path d="M11 22.5 L12.5 25.5" stroke="${dk}" stroke-width="1.5" stroke-linecap="round"/><path d="M14 22 L15 25.5" stroke="${dk}" stroke-width="1.5" stroke-linecap="round"/><path d="M21 22.5 L19.5 25.5" stroke="${dk}" stroke-width="1.5" stroke-linecap="round"/><path d="M18 22 L17 25.5" stroke="${dk}" stroke-width="1.5" stroke-linecap="round"/><path d="M16 4.5 L15 8 L17 8 Z" fill="#ff4020" opacity="0.5"/><path d="M11.5 7.5 L11 10 L12.5 9.5 Z" fill="#ff4020" opacity="0.4"/><path d="M20.5 7.5 L21 10 L19.5 9.5 Z" fill="#ff4020" opacity="0.4"/><ellipse cx="13" cy="8.5" rx="5" ry="3" fill="white" opacity="0.1" transform="rotate(-15 13 8.5)"/>`;},
    iso:c=>{const md=_hexDarken2(c,52),sh=_hexDarken2(c,26),dk=_hexDarken2(c,76);return `<ellipse cx="16" cy="51" rx="10" ry="3.5" fill="${dk}" opacity="0.4"/><path d="M3 24.5 Q0.5 15 6 22 Q5 30.5 8.5 26.5 Z" fill="${md}" opacity="0.75"/><path d="M29 24.5 Q31.5 15 26 22 Q27 30.5 23.5 26.5 Z" fill="${md}" opacity="0.75"/><path d="M3.5 24.5 Q1.5 16 6.5 23 Q5.5 30.5 8.5 26.5 Z" fill="${sh}" opacity="0.6"/><path d="M28.5 24.5 Q30.5 16 25.5 23 Q26.5 30.5 23.5 26.5 Z" fill="${sh}" opacity="0.6"/><path d="M11.5 45 Q10.5 51.5 13 51.5 L13.5 45 Z" fill="${md}"/><path d="M20.5 45 Q21.5 51.5 19 51.5 L18.5 45 Z" fill="${md}"/><path d="M12 45 Q11 51.5 13 51.5 L13.5 45 Z" fill="${sh}"/><path d="M20 45 Q21 51.5 19 51.5 L18.5 45 Z" fill="${sh}"/><path d="M12 49 Q13.5 51.5 15 50.5 L14.5 48.5 Z" fill="${dk}" opacity="0.5"/><path d="M20 49 Q18.5 51.5 17 50.5 L17.5 48.5 Z" fill="${dk}" opacity="0.5"/><path d="M10 38.5 L11.5 46.5 Q16 48 20.5 46.5 L22 38.5 Z" fill="${sh}"/><rect x="9.5" y="21" width="13" height="18" rx="2" fill="${md}"/><rect x="10" y="21" width="12" height="17" rx="1.5" fill="${c}"/><line x1="16" y1="22" x2="16" y2="37.5" stroke="${md}" stroke-width="0.7" opacity="0.5"/><path d="M10 25 Q16 27 22 25" fill="none" stroke="${md}" stroke-width="0.6" opacity="0.45"/><path d="M10 29 Q16 31 22 29" fill="none" stroke="${md}" stroke-width="0.5" opacity="0.35"/><ellipse cx="12" cy="25" rx="2.8" ry="1.7" fill="#ff4020" opacity="0.38"/><ellipse cx="20" cy="25" rx="2.8" ry="1.7" fill="#ff4020" opacity="0.38"/><ellipse cx="16" cy="23" rx="3.2" ry="2" fill="#ff4020" opacity="0.22"/><rect x="10" y="30.5" width="12" height="7.5" rx="1" fill="${md}" opacity="0.28"/><ellipse cx="12.5" cy="23.5" rx="2.5" ry="1.5" fill="white" opacity="0.08"/><path d="M3.5 23 L9.5 22 L9.5 33.5 L3.5 30.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><path d="M28.5 23 L22.5 22 L22.5 33.5 L28.5 30.5 Z" fill="${sh}" stroke="${md}" stroke-width="0.4"/><path d="M3.5 30.5 Q5 36 7.5 33.5 L8 36.5 Q5.5 38.5 3.5 34 Z" fill="${sh}" opacity="0.8"/><path d="M28.5 30.5 Q27 36 24.5 33.5 L24 36.5 Q26.5 38.5 28.5 34 Z" fill="${sh}" opacity="0.8"/><path d="M30.5 48.5 Q28.5 44.5 22.5 45.5 L22.5 47.5 Q27.5 46.5 29.5 51 Z" fill="${sh}" opacity="0.72"/><circle cx="16" cy="11" r="9" fill="${md}"/><ellipse cx="16" cy="10.5" rx="8.5" ry="8" fill="${c}"/><path d="M8.5 9.5 Q6.5 2 11.5 6 L12 10 Z" fill="${md}" stroke="${dk}" stroke-width="0.4"/><path d="M23.5 9.5 Q25.5 2 20.5 6 L20 10 Z" fill="${md}" stroke="${dk}" stroke-width="0.4"/><path d="M9 9.5 Q7 3 12 7 L12.5 10 Z" fill="${sh}" opacity="0.85"/><path d="M23 9.5 Q25 3 20 7 L19.5 10 Z" fill="${sh}" opacity="0.85"/><ellipse cx="12" cy="9.5" rx="3.2" ry="3.4" fill="#300000" opacity="0.9"/><ellipse cx="20" cy="9.5" rx="3.2" ry="3.4" fill="#300000" opacity="0.9"/><ellipse cx="12" cy="9.5" rx="2.1" ry="2.4" fill="#c82800" opacity="0.9"/><ellipse cx="20" cy="9.5" rx="2.1" ry="2.4" fill="#c82800" opacity="0.9"/><ellipse cx="12" cy="9.5" rx="0.85" ry="2.1" fill="#1c0000"/><ellipse cx="20" cy="9.5" rx="0.85" ry="2.1" fill="#1c0000"/><ellipse cx="12" cy="7.8" rx="1.3" ry="0.75" fill="#ff8840" opacity="0.68"/><ellipse cx="20" cy="7.8" rx="1.3" ry="0.75" fill="#ff8840" opacity="0.68"/><ellipse cx="16" cy="16.5" rx="5.5" ry="2" fill="${sh}"/><path d="M11 17 Q13.5 14.5 16 16 Q18.5 14.5 21 17" fill="${md}" opacity="0.78"/><path d="M11 17.5 L12.5 20.5" stroke="${dk}" stroke-width="1.4" stroke-linecap="round"/><path d="M21 17.5 L19.5 20.5" stroke="${dk}" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="13" cy="6" rx="4.5" ry="2.5" fill="white" opacity="0.1" transform="rotate(-15 13 6)"/>`;
    }
  }
};
// Helper local para CREATURE_MODELS (disponível antes de _hexDarken ser definido)
function _hexDarken2(hex,a){try{let c=hex.replace('#','');if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];const n=parseInt(c,16);return '#'+((1<<24)+(Math.max(0,(n>>16)-a)<<16)+(Math.max(0,((n>>8)&0xff)-a)<<8)+Math.max(0,(n&0xff)-a)).toString(16).slice(1);}catch(e){return hex;}}

// ── Helpers de renderização SVG ───────────────────────────────────────────
function _hexDarken(hex, amount) {
  try {
    let c = hex.replace('#','');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  } catch(e) { return hex; }
}
function _svgPart(template, c, c2) {
  if (!template) return '';
  return template.replace(/\{c2\}/g, c2||c).replace(/\{c\}/g, c);
}
// ─────────────────────────────────────────────────────────────────────────

// viewBox = espaço de coordenadas dos detalhes (IMUTÁVEL — todas as partes dependem disso)
// width/height = tamanho de exibição: 4× para preview rico no modal de criação
// O mapa sobrescreve width/height via apmodTokenSVG antes de inserir no DOM
function apmodRenderFront(aparencia,corBase='#d4a876'){const p=aparencia.partes||{};const cabPart=APMOD_PARTS.cabelo.find(x=>x.id===p.cabelo);const rostoP=APMOD_PARTS.rosto.find(x=>x.id===p.rosto);const camP=APMOD_PARTS.camisa.find(x=>x.id===p.camisa);const calP=APMOD_PARTS.calca.find(x=>x.id===p.calca);const sapP=APMOD_PARTS.sapato.find(x=>x.id===p.sapato);const corCab=p.cor_cabelo||'#4a2c0a',corCam=p.cor_camisa||'#4a7aaa';const corCal=p.cor_calca||'#2a3a5a',corSap=p.cor_sapato||'#1a1a1a';const corOlho=p.cor_olho||'#3a6aaa';let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 68" width="128" height="272">`;if(camP)s+=_svgPart(camP.front,corCam,_hexDarken(corCam,30));if(calP)s+=_svgPart(calP.front,corCal,_hexDarken(corCal,25));if(sapP)s+=_svgPart(sapP.front,corSap,_hexDarken(corSap,20));s+=`<rect x="13" y="19" width="6" height="5" rx="2" fill="${corBase}"/>`;s+=`<circle cx="16" cy="11" r="9" fill="${corBase}"/>`;if(rostoP)s+=_svgPart(rostoP.front,corOlho,_hexDarken(corOlho,40));if(cabPart)s+=_svgPart(cabPart.front,corCab,_hexDarken(corCab,30));return s+`</svg>`;}
function apmodRenderIso(aparencia,corBase='#d4a876'){const p=aparencia.partes||{};const cabPart=APMOD_PARTS.cabelo.find(x=>x.id===p.cabelo);const rostoP=APMOD_PARTS.rosto.find(x=>x.id===p.rosto);const camP=APMOD_PARTS.camisa.find(x=>x.id===p.camisa);const calP=APMOD_PARTS.calca.find(x=>x.id===p.calca);const sapP=APMOD_PARTS.sapato.find(x=>x.id===p.sapato);const corCab=p.cor_cabelo||'#4a2c0a',corCam=p.cor_camisa||'#4a7aaa';const corCal=p.cor_calca||'#2a3a5a',corSap=p.cor_sapato||'#1a1a1a';const corOlho=p.cor_olho||'#3a6aaa';let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 56" width="128" height="224">`;if(camP)s+=_svgPart(camP.iso,corCam,_hexDarken(corCam,30));if(calP)s+=_svgPart(calP.iso,corCal,_hexDarken(corCal,25));if(sapP)s+=_svgPart(sapP.iso,corSap,_hexDarken(corSap,20));s+=`<rect x="13" y="16" width="6" height="4" rx="1.5" fill="${corBase}"/>`;s+=`<ellipse cx="16" cy="10" rx="8" ry="7" fill="${corBase}"/>`;if(rostoP)s+=_svgPart(rostoP.iso,corOlho,_hexDarken(corOlho,40));if(cabPart)s+=_svgPart(cabPart.iso,corCab,_hexDarken(corCab,30));return s+`</svg>`;}
function apmodRenderHead(aparencia,corBase='#d4a876'){const p=aparencia.partes||{};const cabPart=APMOD_PARTS.cabelo.find(x=>x.id===p.cabelo);const rostoP=APMOD_PARTS.rosto.find(x=>x.id===p.rosto);const corCab=p.cor_cabelo||'#4a2c0a',corOlho=p.cor_olho||'#3a6aaa';let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 28 22" width="80" height="64">`;s+=`<circle cx="16" cy="11" r="9" fill="${corBase}"/>`;if(rostoP)s+=_svgPart(rostoP.front,corOlho,_hexDarken(corOlho,40));if(cabPart)s+=_svgPart(cabPart.front,corCab,_hexDarken(corCab,30));return s+`</svg>`;}

function apmodTokenSVG(char,tipoMapa){
  // 'tatico' é o alias moderno de 'local' — tratar igual em toda a função
  if(tipoMapa==='tatico') tipoMapa='local';
  const ca=char.custom_attrs||{};
  const ap=ca.aparencia;
  const cor=ca.cor||char.cor||'#4fa3d1';
  const corPele=(ap&&ap.partes&&ap.partes.cor_pele)||'#d4a876';
  const tamanhoFator=Math.max(0.4,ap?.tamanho||1.0);
  const tipoChar=ca.tipo_personagem||ca.tipo||'jogador';

  if(tipoChar==='criatura'){
    // Se criatura tem imagem/svg customizado, renderizar igual personagens
    if(ap&&ap.modo==='imagem'){
      const src=tipoMapa==='local'?(ap.img_iso||ap.img_frente):(ap.img_frente||ap.img_iso);
      if(src){const w=tipoMapa==='local'?Math.round(40*tamanhoFator):28;const h=tipoMapa==='local'?Math.round(60*tamanhoFator):28;return `<img src="${src}" class="apmod-img-token" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:high-quality" onload="apmodSharpenImg(this)">`;}
    }
    if(ap&&ap.modo==='svg'){
      const mapW=Math.round(32*tamanhoFator);const mapH=Math.round(56*tamanhoFator);
      let svgRaw=tipoMapa==='local'?(ap.svg_iso||ap.svg_frente):(ap.svg_frente||ap.svg_iso);
      if(svgRaw){
        svgRaw=tipoMapa==='local'?svgRaw.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="'+mapW+'"').replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="'+mapH+'"'):svgRaw.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="26"').replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="22"');
        return svgRaw;
      }
    }
    // Fallback: modelo geométrico padrão
    const modelo=ap?.modelo_criatura||'npc_generico';
    const corCria=ap?.cor_base||cor;
    const m=CREATURE_MODELS[modelo]||CREATURE_MODELS['npc_generico'];
    if(tipoMapa==='local') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 52" width="${Math.round(32*tamanhoFator)}" height="${Math.round(52*tamanhoFator)}">${m.iso(corCria)}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 28 24" width="26" height="22">${m.head(corCria)}</svg>`;
  }
  if((tipoChar==='npc'||ca.npc_generico)&&!ap){
    const m=CREATURE_MODELS['npc_generico'];
    if(tipoMapa==='local') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 52" width="${Math.round(32*tamanhoFator)}" height="${Math.round(52*tamanhoFator)}">${m.iso(cor)}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 28 24" width="26" height="22">${m.head(cor)}</svg>`;
  }
  if(!ap) return null;

  // ── Modo animado (pixel art esquelético gerado por IA) ───────────────
  if(ap.modo==='animado'){
    if(ap.animado?.parts&&Object.keys(ap.animado.parts).length){
      const w=tipoMapa==='local'?Math.round(40*tamanhoFator):Math.round(28*tamanhoFator);
      const h=tipoMapa==='local'?Math.round(60*tamanhoFator):Math.round(28*tamanhoFator);
      return `<div class="animado-token-mount" data-char="${char.nome}" style="width:${w}px;height:${h}px;display:block"></div>`;
    }
    const src=ap.composed_img||ap.img_frente;
    if(src){const w=tipoMapa==='local'?Math.round(40*tamanhoFator):28;const h=tipoMapa==='local'?Math.round(60*tamanhoFator):28;return `<img src="${src}" class="apmod-img-token" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:pixelated">`;}
    // Sem partes e sem imagem: silhueta placeholder para não cair na bolinha com letra
    const _sz=tipoMapa==='local'?Math.round(40*tamanhoFator):28;
    const _c=cor.replace(/^var\([^)]+\)$/,'#4fa3d1');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="${_sz}" height="${Math.round(_sz*1.4)}"><circle cx="14" cy="9" r="7" fill="${_c}55" stroke="${_c}" stroke-width="1.5"/><ellipse cx="14" cy="28" rx="9" ry="9" fill="${_c}55" stroke="${_c}" stroke-width="1.5"/></svg>`;
  }

  // ── Modo imagem (assets IA: Midjourney, DALL-E, etc.) ────────────────
  if(ap.modo==='imagem'){
    const src=tipoMapa==='local'?(ap.img_iso||ap.img_frente):(ap.img_frente||ap.img_iso);
    if(!src) return null;
    const w=tipoMapa==='local'?Math.round(40*tamanhoFator):28;
    const h=tipoMapa==='local'?Math.round(60*tamanhoFator):28;
    return `<img src="${src}" class="apmod-img-token" style="width:${w}px;height:${h}px;object-fit:contain;image-rendering:high-quality" onload="apmodSharpenImg(this)">`;
  }

  if(ap.modo==='svg'){
    const mapW=Math.round(32*tamanhoFator);
    const mapH=Math.round(56*tamanhoFator);
    let svgRaw=null;
    if(tipoMapa==='local') svgRaw=ap.svg_iso||ap.svg_frente;
    else svgRaw=ap.svg_frente||ap.svg_iso;
    if(!svgRaw) return null;
    if(tipoMapa==='local'){
      svgRaw=svgRaw.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="'+mapW+'"');
      svgRaw=svgRaw.replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="'+mapH+'"');
    } else {
      svgRaw=svgRaw.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="26"');
      svgRaw=svgRaw.replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="22"');
    }
    return svgRaw;
  }
  if(ap.modo==='builder'||ap.modo==='json'){
    if(tipoMapa==='local'){
      // Render gera 128×224 para qualidade de preview; aqui sobrescrevemos
      // width/height pelo tamanho proporcional do token no mapa (viewBox intacto)
      const mapW=Math.round(32*tamanhoFator);
      const mapH=Math.round(56*tamanhoFator);
      let s=apmodRenderIso(ap,corPele);
      s=s.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="'+mapW+'"');
      s=s.replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="'+mapH+'"');
      return s;
    }
    // Mapa geral: head pequeno dentro do círculo do token
    let h=apmodRenderHead(ap,corPele);
    h=h.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="26"');
    h=h.replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="22"');
    return h;
  }
  return null;
}

function abrirModalAparencia(nome){const c=RPG_DATA?.characters?.find(x=>x.nome===nome);if(!c)return;const ca=c.custom_attrs||{};const aparencia=ca.aparencia||{};const isMestre=RPG_DATA?.myRole==='mestre';const cor=ca.cor||'#4fa3d1';const tipoChar=ca.tipo_personagem||ca.tipo||'jogador';let modal=document.getElementById('modal-aparencia-overlay');if(!modal){modal=document.createElement('div');modal.id='modal-aparencia-overlay';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9200;display:flex;flex-direction:column;align-items:stretch;overflow:hidden';document.body.appendChild(modal);}const tamMin=tipoChar==='criatura'?'0.6':'0.78';const tamMax=tipoChar==='criatura'?'3':'1.22';const tamVal=aparencia.tamanho||1.0;const equipTabBtn=`<button class="apmod-tab-btn" data-tab="equip" onclick="apmodSwitchTab('equip',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">⚔ Equipamentos</button>`;
const animadoTabBtn=`<button class="apmod-tab-btn" data-tab="animado" onclick="apmodSwitchTab('animado',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🎬 Animado</button>`;
const tintTabBtn=`<button class="apmod-tab-btn" data-tab="tint" onclick="apmodSwitchTab('tint',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🖌 Tint</button>`;
const tabsHtml=tipoChar==='criatura'?`<button class="apmod-tab-btn apmod-tab-ativo" data-tab="criatura" onclick="apmodSwitchTab('criatura',this)" style="flex:1;padding:10px 6px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid var(--destaque);background:none;color:var(--destaque);text-transform:uppercase">🐉 Modelo</button><button class="apmod-tab-btn" data-tab="svg" onclick="apmodSwitchTab('svg',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🖼 Imagem/SVG</button>${equipTabBtn}${tintTabBtn}`:`<button class="apmod-tab-btn apmod-tab-ativo" data-tab="json" onclick="apmodSwitchTab('json',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid var(--destaque);background:none;color:var(--destaque);text-transform:uppercase">📋 Templates</button><button class="apmod-tab-btn" data-tab="builder" onclick="apmodSwitchTab('builder',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🎨 Criar</button><button class="apmod-tab-btn" data-tab="svg" onclick="apmodSwitchTab('svg',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">✍ SVG</button>${animadoTabBtn}${equipTabBtn}${tintTabBtn}`;
modal.innerHTML=`<div style="background:var(--escuro);border-bottom:1px solid var(--borda);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0"><div style="display:flex;align-items:center;gap:10px"><div><div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.1em">Aparência</div><div style="font-family:var(--fonte-d);font-size:0.95rem;color:var(--primario)">${nome}</div></div></div><button onclick="apmodFecharModal()" style="background:none;border:none;color:var(--suave);font-size:1.5rem;cursor:pointer;padding:4px 8px">✕</button></div>

<!-- Preview colapsível — toggle para liberar espaço de criação -->
<div id="apmod-preview-wrap" style="background:rgba(8,12,20,0.95);border-bottom:2px solid rgba(30,45,66,0.8);flex-shrink:0;overflow:hidden;transition:max-height 0.3s ease">
  <!-- Barra de toggle sempre visível -->
  <div onclick="apmodTogglePreviewPanel()" style="display:flex;align-items:center;justify-content:space-between;padding:6px 14px;cursor:pointer;user-select:none;border-bottom:1px solid rgba(255,255,255,0.04)">
    <div style="display:flex;align-items:center;gap:10px">
      <div id="apmod-prev-head-mini" style="width:28px;height:28px;border-radius:50%;border:1.5px solid ${cor};background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:0.7rem">${c.nome[0]||'?'}</div>
      <span style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">Preview</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span id="apmod-tamanho-val" style="display:none"></span>
      <span id="apmod-preview-arrow" style="color:var(--suave);font-size:0.8rem;transition:transform 0.3s;display:inline-block;transform:rotate(180deg)">▼</span>
    </div>
  </div>
  <!-- Conteúdo expandível -->
  <div id="apmod-preview-content" style="display:flex;padding:10px 16px;align-items:center;gap:12px">
    <!-- ISO preview -->
    <div style="flex-shrink:0;position:relative">
      <div style="font-family:var(--fonte-d);font-size:0.42rem;color:var(--primario);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;text-align:center">Arte</div>
      <div id="apmod-prev-iso" style="width:96px;height:160px;border:1px solid ${cor}55;border-radius:8px;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;box-shadow:0 0 14px rgba(0,0,0,0.6);cursor:pointer" title="Clique para ver em tamanho real" onclick="apmodTogglePreviewGrande(this)">${c.nome[0]||'?'}</div>
      <div style="font-size:0.36rem;color:var(--suave);margin-top:3px;opacity:0.5;text-align:center;font-style:italic">toque p/ ampliar</div>
    </div>
    <div style="width:1px;height:140px;background:rgba(255,255,255,0.06);flex-shrink:0"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex-shrink:0;text-align:center">
          <div style="font-family:var(--fonte-d);font-size:0.4rem;color:var(--suave);margin-bottom:3px;text-transform:uppercase">Token</div>
          <div id="apmod-prev-head" style="width:48px;height:48px;border-radius:50%;border:2px solid ${cor};background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;overflow:hidden">${c.nome[0]||'?'}</div>
          <div style="font-size:0.34rem;color:var(--suave);margin-top:2px;opacity:0.5">frente</div>
        </div>
        <div style="flex-shrink:0;text-align:center">
          <div style="font-family:var(--fonte-d);font-size:0.4rem;color:var(--suave);margin-bottom:3px;text-transform:uppercase">No mapa</div>
          <div id="apmod-prev-mini" style="min-width:24px;min-height:40px;border:1px dashed ${cor}44;border-radius:3px;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;margin:0 auto"></div>
        </div>
      </div>
      <div>
        <input type="hidden" id="apmod-tamanho" value="${tamVal}">
      </div>
    </div>
  </div>
</div>

<div style="display:flex;background:var(--escuro);border-bottom:1px solid var(--borda);flex-shrink:0">${tabsHtml}</div>
<div style="flex:1;overflow-y:auto;padding:16px" id="apmod-tab-area">${tipoChar==='criatura'?_apmodTabCriatura(aparencia,cor)+_apmodTabSvg(aparencia)+_apmodTabEquip(aparencia,nome)+_apmodTabTint(aparencia):_apmodTabJson()+_apmodTabBuilder(aparencia)+_apmodTabSvg(aparencia)+(typeof _apmodTabAnimado==='function'?_apmodTabAnimado(aparencia):'')+_apmodTabEquip(aparencia,nome)+_apmodTabTint(aparencia)}</div>
<div style="background:var(--escuro);border-top:1px solid var(--borda);padding:12px 16px;flex-shrink:0"><button onclick="apmodSalvar('${nome.replace(/'/g,"\\'")}') " style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primario),var(--primario-v));border:none;border-radius:8px;color:#050810;font-family:var(--fonte-d);font-size:0.78rem;letter-spacing:0.12em;cursor:pointer;text-transform:uppercase;font-weight:700">💾 Salvar Aparência</button></div>`;
modal.style.display='flex';window._apmodNome=nome;window._apmodOriginal=JSON.parse(JSON.stringify(aparencia));window._apmodOriginalStale=false;window._apmodLastBaseTab=null;window._apmodTints=JSON.parse(JSON.stringify(aparencia.tints||[]));window._apmodEquipsVisuais=JSON.parse(JSON.stringify(aparencia.equipamentos_visuais||[]));window._apmodCriaturaModelo=aparencia.modelo_criatura||'npc_generico';window._apmodAnimado=aparencia.animado?JSON.parse(JSON.stringify(aparencia.animado)):null;window._animGenSelectedFile=null;if(aparencia.modo==='builder'||aparencia.modo==='json')setTimeout(()=>apmodPreencherBuilder(aparencia),60);
// Inicializar na aba correta, priorizando última aba memorizada
if(tipoChar==='criatura'){
  const ultimaAbaCria = window._apmodLastTab && ['criatura','svg','equip','tint'].includes(window._apmodLastTab) ? window._apmodLastTab : null;
  const abaInicial = ultimaAbaCria || (aparencia.modo==='imagem'||aparencia.modo==='svg' ? 'svg' : 'criatura');
  apmodSwitchTab(abaInicial, modal.querySelector(`[data-tab="${abaInicial}"]`));
}else{
  const ultimaAba = window._apmodLastTab && ['builder','svg','json','animado','equip','tint'].includes(window._apmodLastTab) ? window._apmodLastTab : null;
  const abaInicial = ultimaAba || (aparencia.modo==='animado' ? 'animado' : aparencia.modo==='svg'||aparencia.modo==='imagem' ? 'svg' : 'builder');
  apmodSwitchTab(abaInicial, modal.querySelector(`[data-tab="${abaInicial}"]`));
}
apmodAtualizarPreview();}

function _apmodTabJson(){return `<div id="apmod-tab-json" class="apmod-tab-content" style="display:block"><div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Templates Prontos</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${CHAR_JSON_TEMPLATES.map(t=>`<button onclick="apmodCarregarTemplate('${t.id}')" style="background:rgba(20,29,43,0.8);border:1px solid var(--borda);border-radius:8px;padding:10px 8px;cursor:pointer;color:var(--texto);font-family:var(--fonte-d);font-size:0.62rem;text-align:center;transition:border-color 0.2s" onmouseover="this.style.borderColor='var(--primario)'" onmouseout="this.style.borderColor='var(--borda)'"><div style="font-size:1.2rem;margin-bottom:4px">${t.icon}</div>${t.label}<div style="font-size:0.55rem;color:var(--suave);margin-top:2px">${t.estilo}</div></button>`).join('')}</div></div>`;}
function _apmodTabBuilder(aparencia){const estilos=['fantasy','anime','medieval','3d'];const sec=(tipo,partes,label)=>`<div style="margin-bottom:16px"><div style="font-family:var(--fonte-d);font-size:0.62rem;color:var(--destaque);text-transform:uppercase;margin-bottom:5px">${label}</div><div style="display:flex;gap:4px;margin-bottom:5px;flex-wrap:wrap">${estilos.map(e=>`<button class="apmod-estilo-btn" data-tipo="${tipo}" data-estilo="${e}" onclick="apmodFiltrarEstilo('${tipo}','${e}',this)" style="background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:4px;padding:2px 7px;font-family:var(--fonte-d);font-size:0.52rem;cursor:pointer;color:var(--suave);text-transform:uppercase">${e}</button>`).join('')}</div><div id="apmod-grid-${tipo}" style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;max-height:110px;overflow-y:auto">${partes.map(p=>`<button class="apmod-part-btn" data-tipo="${tipo}" data-id="${p.id}" onclick="apmodSelecionarParte('${tipo}','${p.id}',this)" title="${p.nome}" style="background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:4px;padding:2px;cursor:pointer;font-size:0.48rem;color:var(--suave);font-family:var(--fonte-d);text-align:center;line-height:1.2;transition:all 0.15s">${p.nome}</button>`).join('')}</div><div style="display:flex;gap:6px;margin-top:5px;align-items:center"><label style="font-size:0.6rem;color:var(--suave);font-family:var(--fonte-d)">Cor:</label><input type="color" id="apmod-cor-${tipo}" value="#888888" style="width:30px;height:26px;border:1px solid var(--borda);border-radius:4px;background:none;cursor:pointer;padding:2px" oninput="apmodAtualizarPreview()"></div></div>`;return `<div id="apmod-tab-builder" class="apmod-tab-content" style="display:none"><div style="margin-bottom:10px"><label style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);display:block;margin-bottom:4px;text-transform:uppercase">Cor da Pele</label><input type="color" id="apmod-cor-pele" value="#d4a876" style="width:38px;height:28px;border:1px solid var(--borda);border-radius:4px;background:none;cursor:pointer;padding:2px" oninput="apmodAtualizarPreview()"></div>${sec('cabelo',APMOD_PARTS.cabelo,'💇 Cabelo')}${sec('rosto',APMOD_PARTS.rosto,'👁 Rosto')}${sec('camisa',APMOD_PARTS.camisa,'👕 Camisa')}${sec('calca',APMOD_PARTS.calca,'👖 Calça')}${sec('sapato',APMOD_PARTS.sapato,'👟 Sapato')}</div>`;}
function _apmodTabSvg(ap){
  const imgF=ap.img_frente||''; const imgI=ap.img_iso||'';
  return `<div id="apmod-tab-svg" class="apmod-tab-content" style="display:none">
  <div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);margin-bottom:10px;line-height:1.5">SVG customizado OU imagens reais geradas por IA (Midjourney, DALL-E, etc.). Use os prompts abaixo para gerar assets cinematográficos.</div>
  
  <!-- Prompt buttons -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">
    <button onclick="apmodCopiarPromptSvg('frente')" style="padding:8px 6px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.25);border-radius:6px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;text-align:left;line-height:1.3">
      <div style="font-size:0.75rem;margin-bottom:2px">🎬</div>
      <div style="font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Prompt Frente</div>
      <div style="color:var(--suave);font-size:0.52rem;margin-top:1px">PNG Layered · Alta Resolução</div>
    </button>
    <button onclick="apmodCopiarPromptSvg('iso')" style="padding:8px 6px;background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.25);border-radius:6px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;text-align:left;line-height:1.3">
      <div style="font-size:0.75rem;margin-bottom:2px">🎮</div>
      <div style="font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Prompt ISO</div>
      <div style="color:var(--suave);font-size:0.52rem;margin-top:1px">PNG Layered · Isométrico 45°</div>
    </button>
  </div>

  <!-- Image mode: URL/base64 -->
  <div style="background:rgba(200,168,75,0.04);border:1px solid rgba(200,168,75,0.15);border-radius:8px;padding:10px;margin-bottom:12px">
    <div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">🖼 Imagem Real (URL ou base64)</div>
    <div style="margin-bottom:6px">
      <label style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">Frente (mapa geral)</label>
      <div style="display:flex;gap:4px">
        <input type="text" id="apmod-img-frente" value="${imgF}" placeholder="https://... ou data:image/..." style="flex:1;min-width:0;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:6px 8px;color:var(--texto);font-family:monospace;font-size:0.68rem" oninput="apmodAtualizarPreview()">
        <label style="padding:6px 8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;white-space:nowrap" title="Upload imagem">
          📁<input type="file" accept="image/*" style="display:none" onchange="apmodFileToBase64(this,'apmod-img-frente')">
        </label>
      </div>
    </div>
    <div>
      <label style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">ISO (mapa local)</label>
      <div style="display:flex;gap:4px">
        <input type="text" id="apmod-img-iso" value="${imgI}" placeholder="https://... ou data:image/..." style="flex:1;min-width:0;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:6px 8px;color:var(--texto);font-family:monospace;font-size:0.68rem" oninput="apmodAtualizarPreview()">
        <label style="padding:6px 8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;white-space:nowrap" title="Upload imagem">
          📁<input type="file" accept="image/*" style="display:none" onchange="apmodFileToBase64(this,'apmod-img-iso')">
        </label>
      </div>
    </div>
  </div>

  <!-- SVG manual mode -->
  <details style="margin-bottom:10px">
    <summary style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);cursor:pointer;text-transform:uppercase;letter-spacing:0.06em;padding:6px 0">✍ SVG Manual (avançado)</summary>
    <div style="margin-top:8px">
      <div style="margin-bottom:8px">
        <label style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">SVG Frente</label>
        <textarea id="apmod-svg-frente" rows="3" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:8px;color:var(--texto);font-family:monospace;font-size:0.68rem;resize:vertical" oninput="apmodAtualizarPreview()">${ap.svg_frente||''}</textarea>
      </div>
      <div style="margin-bottom:8px">
        <label style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">SVG Isométrico</label>
        <textarea id="apmod-svg-iso" rows="3" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:8px;color:var(--texto);font-family:monospace;font-size:0.68rem;resize:vertical" oninput="apmodAtualizarPreview()">${ap.svg_iso||''}</textarea>
      </div>
      <div>
        <label style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">Cole JSON da IA</label>
        <textarea id="apmod-svg-json-paste" rows="2" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:8px;color:var(--texto);font-family:monospace;font-size:0.68rem;resize:vertical" placeholder='{"frente_svg":"<svg...>","iso_svg":"<svg...>"}'></textarea>
        <button onclick="apmodParseSvgJson()" style="width:100%;margin-top:4px;padding:7px;background:rgba(39,174,96,0.06);border:1px solid rgba(39,174,96,0.2);border-radius:6px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✓ Parsear JSON</button>
      </div>
    </div>
  </details>
</div>`;
}

function _apmodTabCriatura(aparencia,cor){const modelos=Object.entries(CREATURE_MODELS).map(([k,m])=>({key:k,label:m.label}));const atual=aparencia.modelo_criatura||'npc_generico';return `<div id="apmod-tab-criatura" class="apmod-tab-content" style="display:block"><div style="font-family:var(--fonte-d);font-size:0.62rem;color:var(--suave);margin-bottom:10px">Modelo visual da criatura.</div><div style="margin-bottom:12px"><label style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);display:block;margin-bottom:5px;text-transform:uppercase">Cor</label><input type="color" id="apmod-criatura-cor" value="${aparencia.cor_base||cor}" oninput="apmodAtualizarPreview()" style="width:42px;height:32px;border:1px solid var(--borda);border-radius:6px;background:none;cursor:pointer;padding:2px"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${modelos.map(m=>`<button id="apmod-criatura-btn-${m.key}" onclick="apmodSelecionarCriatura('${m.key}',this)" class="apmod-cria-btn" style="background:rgba(20,29,43,0.8);border:1px solid ${atual===m.key?'var(--destaque)':'var(--borda)'};border-radius:8px;padding:8px 4px;cursor:pointer;color:var(--texto);font-family:var(--fonte-d);font-size:0.58rem;text-align:center;transition:border-color 0.2s"><div style="height:34px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:3px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 28 24" width="30" height="24">${(CREATURE_MODELS[m.key]||CREATURE_MODELS.npc_generico).head(aparencia.cor_base||cor)}</svg></div>${m.label}</button>`).join('')}</div></div>`;}

function apmodTogglePreviewPanel(){
  const content=document.getElementById('apmod-preview-content');
  const arrow=document.getElementById('apmod-preview-arrow');
  const wrap=document.getElementById('apmod-preview-wrap');
  if(!content)return;
  
  const expanded=content.style.display!=='none'&&content.style.display!=='';
  
  if (expanded) {
    // Fechar: animar para 0
    wrap.style.maxHeight = wrap.scrollHeight + 'px'; // Definir altura atual primeiro
    setTimeout(() => {
      wrap.style.maxHeight = '48px'; // Altura apenas da barra de toggle
    }, 10);
    setTimeout(() => {
      content.style.display = 'none';
    }, 300); // Após transição
  } else {
    // Abrir: definir altura final para animação suave
    content.style.display = 'flex';
    const alturaFinal = wrap.scrollHeight + 'px';
    wrap.style.maxHeight = alturaFinal;
    setTimeout(() => {
      wrap.style.maxHeight = ''; // Remover após transição para permitir crescimento natural
    }, 300);
  }
  
  if(arrow)arrow.style.transform=expanded?'rotate(0deg)':'rotate(180deg)';
}
function apmodSwitchTab(tab,btn){
  window._apmodLastTab = tab; // UX-08: Memorizar última aba
  if(tab==='tint'){setTimeout(()=>{apmodTintIniciar({tints:window._apmodTints||[]});apmodTintAtualizarPreview();},30);}document.querySelectorAll('.apmod-tab-content').forEach(el=>el.style.display='none');document.querySelectorAll('.apmod-tab-btn').forEach(b=>{b.style.color='var(--suave)';b.style.borderBottomColor='transparent';b.classList.remove('apmod-tab-ativo');});const el=document.getElementById(`apmod-tab-${tab}`);if(el)el.style.display='block';if(btn){btn.style.color='var(--destaque)';btn.style.borderBottomColor='var(--destaque)';btn.classList.add('apmod-tab-ativo');}
}
function apmodFiltrarEstilo(tipo,estilo,btn){const grid=document.getElementById(`apmod-grid-${tipo}`);if(!grid)return;grid.querySelectorAll('.apmod-part-btn').forEach(b=>{const parte=(APMOD_PARTS[tipo]||[]).find(p=>p.id===b.dataset.id);b.style.display=!parte||parte.estilo===estilo?'':'none';});document.querySelectorAll(`[data-tipo="${tipo}"].apmod-estilo-btn`).forEach(b=>{b.style.borderColor='var(--borda)';b.style.color='var(--suave)';});if(btn){btn.style.borderColor='var(--primario)';btn.style.color='var(--primario-v)';}}
function apmodSelecionarParte(tipo,id,btn){document.querySelectorAll(`[data-tipo="${tipo}"].apmod-part-btn`).forEach(b=>{b.style.background='rgba(20,29,43,0.6)';b.style.borderColor='var(--borda)';b.style.color='var(--suave)';b.classList.remove('ativo');});if(btn){btn.style.background='rgba(79,163,209,0.12)';btn.style.borderColor='var(--primario)';btn.style.color='var(--primario-v)';btn.classList.add('ativo');}window._apmodOriginalStale=true;window._apmodLastBaseTab='builder';apmodAtualizarPreview();}
function apmodSelecionarCriatura(key,btn){document.querySelectorAll('.apmod-cria-btn').forEach(b=>b.style.borderColor='var(--borda)');if(btn)btn.style.borderColor='var(--destaque)';window._apmodCriaturaModelo=key;window._apmodOriginalStale=true;window._apmodLastBaseTab='criatura';apmodAtualizarPreview();}
function apmodCarregarTemplate(id){
  const t=CHAR_JSON_TEMPLATES.find(x=>x.id===id);
  if(!t){mostrarToast('Template não encontrado','erro');return;}
  if(!t.partes||typeof t.partes!=='object'){mostrarToast('Template inválido: estrutura incorreta','erro');return;}
  const tipos=['cabelo','rosto','camisa','calca','sapato'];
  let temParteFaltando=false;
  tipos.forEach(tipo=>{const pid=t.partes[tipo];if(pid&&!(APMOD_PARTS&&(APMOD_PARTS[tipo]||[]).find(p=>p.id===pid))){console.warn(`Template ${t.id}: parte ${tipo}="${pid}" não existe`);temParteFaltando=true;}});
  if(temParteFaltando){if(!confirm('Este template contém partes que podem não existir. Carregar mesmo assim?'))return;}
  apmodPreencherBuilder({modo:'json',partes:t.partes});apmodSwitchTab('builder',document.querySelector('[data-tab="builder"]'));apmodAtualizarPreview();mostrarToast(`Template "${t.label}" carregado`,'ok');
}
function apmodPreencherBuilder(aparencia){const p=aparencia.partes||{};const corPeleEl=document.getElementById('apmod-cor-pele');if(corPeleEl)corPeleEl.value=p.cor_pele||'#d4a876';const tipos=['cabelo','rosto','camisa','calca','sapato'];const corKeys=['cor_cabelo','cor_olho','cor_camisa','cor_calca','cor_sapato'];const defaults=['#4a2c0a','#3a6aaa','#4a7aaa','#2a3a5a','#1a1a1a'];tipos.forEach((tipo,i)=>{if(p[tipo]){const btn=document.querySelector(`[data-tipo="${tipo}"][data-id="${p[tipo]}"]`);if(btn)btn.click();}const corEl=document.getElementById(`apmod-cor-${tipo}`);if(corEl)corEl.value=p[corKeys[i]]||defaults[i];});}

function apmodGetBaseAparencia(tipoTab){
  // Extrai apenas o modo/visual base sem equips/tints
  const tamanho=parseFloat(document.getElementById('apmod-tamanho')?.value||'1.0');
  
  if(tipoTab==='svg'){
    const imgF=document.getElementById('apmod-img-frente')?.value?.trim()||'';
    const imgI=document.getElementById('apmod-img-iso')?.value?.trim()||'';
    const svgF=document.getElementById('apmod-svg-frente')?.value?.trim()||'';
    const svgI=document.getElementById('apmod-svg-iso')?.value?.trim()||'';
    if(imgF||imgI) return{modo:'imagem',img_frente:imgF,img_iso:imgI,svg_frente:svgF,svg_iso:svgI,tamanho};
    return{modo:'svg',svg_frente:svgF,svg_iso:svgI,tamanho};
  }
  
  if(tipoTab==='criatura'){
    return{modo:'criatura',modelo_criatura:window._apmodCriaturaModelo||'npc_generico',cor_base:document.getElementById('apmod-criatura-cor')?.value||'#e8604c',tamanho};
  }
  
  if(tipoTab==='builder'){
    const partes={};
    const tipos=['cabelo','rosto','camisa','calca','sapato'];
    tipos.forEach(tipo=>{
      const sel=document.querySelector(`[data-tipo="${tipo}"].apmod-part-btn.ativo`);
      if(sel) partes[tipo]=sel.dataset.id;
    });
    partes.cor_pele=document.getElementById('apmod-cor-pele')?.value||'#d4a876';
    partes.cor_cabelo=document.getElementById('apmod-cor-cabelo')?.value||'#4a2c0a';
    partes.cor_olho=document.getElementById('apmod-cor-rosto')?.value||'#3a6aaa';
    partes.cor_camisa=document.getElementById('apmod-cor-camisa')?.value||'#4a7aaa';
    partes.cor_calca=document.getElementById('apmod-cor-calca')?.value||'#2a3a5a';
    partes.cor_sapato=document.getElementById('apmod-cor-sapato')?.value||'#1a1a1a';
    return{modo:'builder',partes,tamanho};
  }
  
  if(tipoTab==='json'){
    return{modo:'json',partes:window._apmodJsonPartes||{},tamanho};
  }

  if(tipoTab==='animado'){
    return{modo:'animado',animado:window._apmodAnimado||{},tamanho};
  }

  // Fallback
  return window._apmodOriginal || {modo:'builder',partes:{},tamanho:1.0};
}

function apmodGetCurrentAparencia(){
  const tipoTab=document.querySelector('.apmod-tab-btn.apmod-tab-ativo')?.dataset?.tab;
  const tamanho=parseFloat(document.getElementById('apmod-tamanho')?.value||'1.0');
  const equipamentos_visuais=window._apmodEquipsVisuais||[];
  const tints=window._apmodTints||[];

  if(tipoTab==='svg'){
    const imgF=document.getElementById('apmod-img-frente')?.value?.trim()||'';
    const imgI=document.getElementById('apmod-img-iso')?.value?.trim()||'';
    const svgF=document.getElementById('apmod-svg-frente')?.value?.trim()||'';
    const svgI=document.getElementById('apmod-svg-iso')?.value?.trim()||'';
    if(imgF||imgI) return{modo:'imagem',img_frente:imgF,img_iso:imgI,svg_frente:svgF,svg_iso:svgI,tamanho,tints,equipamentos_visuais};
    return{modo:'svg',svg_frente:svgF,svg_iso:svgI,tamanho,tints,equipamentos_visuais};
  }
  if(tipoTab==='criatura') return{modo:'criatura',modelo_criatura:window._apmodCriaturaModelo||'npc_generico',cor_base:document.getElementById('apmod-criatura-cor')?.value||'#e8604c',tamanho,tints,equipamentos_visuais};
  if(tipoTab==='animado'){window._apmodLastBaseTab='animado';return{modo:'animado',animado:window._apmodAnimado||{},tamanho,tints,equipamentos_visuais};}

  // Abas equip e tint não editam o modo/visual base — preservar _apmodOriginal
  // CORREÇÃO: atualizar _apmodOriginal durante a sessão para evitar stale data
  if(tipoTab==='equip'||tipoTab==='tint'){
    // Se _apmodOriginal não foi definido ou a aba base foi editada, atualizar
    if (!window._apmodOriginal || window._apmodOriginalStale) {
      const baseTab = tipoTab === 'equip' || tipoTab === 'tint' ? window._apmodLastBaseTab : tipoTab;
      window._apmodOriginal = apmodGetBaseAparencia(baseTab);
      window._apmodOriginalStale = false;
    }
    const base=JSON.parse(JSON.stringify(window._apmodOriginal||{}));
    base.equipamentos_visuais=equipamentos_visuais;
    base.tints=tints;
    if(document.getElementById('apmod-tamanho')) base.tamanho=tamanho;
    return base;
  }

  const tipos=['cabelo','rosto','camisa','calca','sapato'];
  const corKeys=['cor_cabelo','cor_olho','cor_camisa','cor_calca','cor_sapato'];
  const partes={cor_pele:document.getElementById('apmod-cor-pele')?.value||'#d4a876'};
  tipos.forEach((tipo,i)=>{
    const btn=document.querySelector(`.apmod-part-btn.ativo[data-tipo="${tipo}"]`);
    if(btn)partes[tipo]=btn.dataset.id;
    const corEl=document.getElementById(`apmod-cor-${tipo}`);
    if(corEl)partes[corKeys[i]]=corEl.value;
  });
  return{modo:tipoTab==='json'?'json':'builder',partes,equipamentos_visuais,tamanho,tints};
}

function apmodFecharModal() {
  const apData = apmodGetCurrentAparencia();
  const original = window._apmodOriginal || {};
  const mudou = JSON.stringify(apData) !== JSON.stringify(original);

  if (mudou) {
    const confirmar = confirm('Você tem alterações não salvas. Deseja realmente fechar sem salvar?');
    if (!confirmar) return;
  }

  if (window._apmodAnimCtrl) { window._apmodAnimCtrl.destroy(); window._apmodAnimCtrl = null; }
  document.getElementById('modal-aparencia-overlay').style.display = 'none';
}

function apmodAtualizarPreview(){
  const ap=apmodGetCurrentAparencia();
  const tamanhoEl=document.getElementById('apmod-tamanho');
  const tamanhoVal=document.getElementById('apmod-tamanho-val');
  const fator=tamanhoEl?parseFloat(tamanhoEl.value):1.0;
  if(tamanhoEl&&tamanhoVal)tamanhoVal.textContent='×'+fator.toFixed(2);
  // Sincronizar valor exibido na barra de toggle
  const toggleVal=document.getElementById('apmod-tamanho-val');
  if(toggleVal)toggleVal.textContent='×'+fator.toFixed(2);
  const corPele=ap.partes?.cor_pele||ap.cor_base||'#d4a876';
  const prevHead=document.getElementById('apmod-prev-head');
  const prevIso=document.getElementById('apmod-prev-iso');
  const prevMini=document.getElementById('apmod-prev-mini');
  const c=RPG_DATA?.characters?.find(x=>x.nome===window._apmodNome);
  const cor=c?.custom_attrs?.cor||'#4fa3d1';
  let headSvg='',isoSvg='',miniSvg='';

  if(ap.modo==='animado'){
    // Mount live canvas renderer in the ISO preview container
    if(prevIso&&ap.animado&&ap.animado.parts&&Object.keys(ap.animado.parts).length){
      if(window._apmodAnimCtrl){window._apmodAnimCtrl.destroy();window._apmodAnimCtrl=null;}
      prevIso.innerHTML='';prevIso.style.display='flex';prevIso.style.alignItems='center';prevIso.style.justifyContent='center';
      window._apmodAnimCtrl=animRendererMount(prevIso,ap.animado,{width:96,height:160,animName:'idle'});
      if(window._animCtrlMap&&window._apmodNome)window._animCtrlMap[window._apmodNome]=window._apmodAnimCtrl;
    }
    // Head preview: use composed_img if available, or first frame
    if(prevHead&&ap.animado?.palette){
      const pal=ap.animado.palette;
      headSvg=`<div style="width:44px;height:44px;background:${pal.primary||'#4a7aaa'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.8rem">🎬</div>`;
      prevHead.innerHTML=headSvg;
    }
    const fallback2=c?.nome?.[0]||'?';
    if(prevMini)prevMini.innerHTML=fallback2;
    return;
  }

  if(ap.modo==='imagem'){
    const _pvTints=ap.tints||[];const _pvOvls=tintOverlayHtml(_pvTints);
    const equips=window._apmodEquipsVisuais||[];
    const _pvW2=240,_pvH2=362;
    const _pvEqLayer=(camada)=>equips.filter(eq=>eq.visivel!==false&&(eq.img||eq.img_url||(eq.svg&&eq.svg.length>5))&&(camada==='atras'?eq.camada==='atras':eq.camada!=='atras')).map(eq=>{
      const xP=eq.x!=null?eq.x:50,yP=eq.y!=null?eq.y:40;
      const esc=(eq.escala!=null?eq.escala:90)/100;
      const eW=Math.round(0.35*_pvW2*esc),eH=Math.round(0.45*_pvH2*esc);
      const l=Math.round((xP/100)*_pvW2-eW/2),t=Math.round((yP/100)*_pvH2-eH/2);
      const rot=eq.rotacao||0,rotH=eq.rotacaoH||0;
      const tf=[rotH?`perspective(600px) rotateY(${rotH}deg)`:'',rot?`rotate(${rot}deg)`:''].filter(Boolean);
      const tfS=tf.length?`transform:${tf.join(' ')};`:'';
      const inn=(eq.img||eq.img_url)?`<img src="${eq.img||eq.img_url}" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none" onerror="this.style.display='none'">`:`<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
      return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${camada==='atras'?1:3};pointer-events:none;${tfS}">${inn}</div>`;
    }).join('');
    if(ap.img_frente) headSvg=`<div style="position:relative;width:100%;height:100%"><img src="${ap.img_frente}" class="apmod-img-token" style="width:100%;height:100%;object-fit:contain" onload="apmodSharpenImg(this)">${_pvOvls}</div>`;
    if(ap.img_iso) isoSvg=`<div style="position:relative;width:${_pvW2}px;height:${_pvH2}px">${_pvEqLayer('atras')}<img src="${ap.img_iso}" class="apmod-img-token" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2" onload="apmodSharpenImg(this)">${_pvOvls}${_pvEqLayer('frente')}</div>`;
    else if(ap.img_frente) isoSvg=headSvg;
    miniSvg=isoSvg;
  } else if(ap.modo==='svg'){
    headSvg=ap.svg_frente||''; isoSvg=ap.svg_iso||''; miniSvg=isoSvg;
  } else if(ap.modo==='criatura'){
    const m=CREATURE_MODELS[ap.modelo_criatura]||CREATURE_MODELS['npc_generico'];
    const c2=document.getElementById('apmod-criatura-cor')?.value||ap.cor_base||cor;
    headSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 2 28 24" width="60" height="48">${m.head(c2)}</svg>`;
    isoSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 54" width="234" height="351">${m.iso(c2)}</svg>`;
    miniSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 54" width="${Math.round(32*fator)}" height="${Math.round(54*fator)}">${m.iso(c2)}</svg>`;
  } else {
    // Preview enorme para ver todos os detalhes (128×224 e 80×64)
    headSvg=apmodRenderHead(ap,corPele);
    isoSvg=apmodRenderIso(ap,corPele);
    // Mini: mesmo SVG com dimensões exatas do mapa (sobrescreve width/height via regex)
    const mW=Math.round(32*fator), mH=Math.round(56*fator);
    miniSvg=apmodRenderIso(ap,corPele)
      .replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/,'$1width="'+mW+'"')
      .replace(/(<svg\b[^>]*?)\bheight="[^"]*"/,'$1height="'+mH+'"');
  }
  const fallback=c?.nome?.[0]||'?';
  if(prevHead) prevHead.innerHTML=(headSvg&&headSvg.length>5)?headSvg:fallback;
  // Sincronizar mini-cabeça na barra de toggle
  const prevHeadMini=document.getElementById('apmod-prev-head-mini');
  if(prevHeadMini)prevHeadMini.innerHTML=(headSvg&&headSvg.length>5)?headSvg:fallback;
  if(prevIso){
    prevIso.style.position='relative';
    const _pvEquips=window._apmodEquipsVisuais||[];
    const _pvW=240,_pvH=362; // dimensões finais após resize HD
    const _pvEqOv=(camada)=>_pvEquips.filter(eq=>eq.visivel!==false&&(eq.img||eq.img_url||(eq.svg&&eq.svg.length>5))&&(camada==='atras'?eq.camada==='atras':eq.camada!=='atras')).map(eq=>{
      const xP=eq.x!=null?eq.x:50,yP=eq.y!=null?eq.y:40;
      const esc=(eq.escala!=null?eq.escala:90)/100;
      const eW=Math.round(0.35*_pvW*esc),eH=Math.round(0.45*_pvH*esc);
      const l=Math.round((xP/100)*_pvW-eW/2),t=Math.round((yP/100)*_pvH-eH/2);
      const rot=eq.rotacao||0,rotH=eq.rotacaoH||0;
      const _pvWarp=eq.warpCorners?_aeqComputeMatrix3d(eW,eH,eq.warpCorners.map(c=>({x:c.x*eW,y:c.y*eH}))):null;
      const _pvTfParts=_pvWarp&&_pvWarp!=='none'?[_pvWarp]:[rotH?`perspective(600px) rotateY(${rotH}deg)`:'',rot?`rotate(${rot}deg)`:'',eq.skewX?`skewX(${eq.skewX}deg)`:'',eq.skewY?`skewY(${eq.skewY}deg)`:''].filter(Boolean);
      const _pvTf=_pvTfParts.length?`transform:${_pvTfParts.join(' ')};transform-origin:${(_pvWarp&&_pvWarp!=='none')?'0 0':'center center'};`:'';
      const inn=(eq.img||eq.img_url)?`<img src="${eq.img||eq.img_url}" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none" onerror="this.style.display='none'">`:`<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
      return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${camada==='atras'?1:3};pointer-events:none;${_pvTf}">${inn}</div>`;
    }).join('');
    const _pvCharDiv=`<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;z-index:2">${(isoSvg&&isoSvg.length>5)?isoSvg:fallback}</div>`;
    prevIso.innerHTML=_pvEqOv('atras')+_pvCharDiv+_pvEqOv('frente');
  }
  // Sincronizar lightbox se estiver aberto (copia innerHTML do prevIso que já tem equipamentos)
  const lb = document.getElementById('apmod-lightbox');
  if (lb) {
    const lbBox = lb.querySelector('div[style*="360px"]');
    if (lbBox && prevIso) lbBox.innerHTML = prevIso.innerHTML;
  }
  // Mini-preview: tamanho exato de como vai aparecer no mapa, com equipamentos
  if(prevMini){
    const mW=Math.round(32*fator), mH=Math.round(56*fator);
    prevMini.style.width=mW+'px'; prevMini.style.height=mH+'px';
    prevMini.style.position='relative';
    const _mnEquips=window._apmodEquipsVisuais||[];
    const _mnEqOv=(camada)=>_mnEquips.filter(eq=>eq.visivel!==false&&(eq.img||eq.img_url||(eq.svg&&eq.svg.length>5))&&(camada==='atras'?eq.camada==='atras':eq.camada!=='atras')).map(eq=>{
      const xP=eq.x!=null?eq.x:50,yP=eq.y!=null?eq.y:40;
      const esc=(eq.escala!=null?eq.escala:90)/100;
      const eW=Math.round(0.35*mW*esc),eH=Math.round(0.45*mH*esc);
      const l=Math.round((xP/100)*mW-eW/2),t=Math.round((yP/100)*mH-eH/2);
      const rot=eq.rotacao||0,rotH=eq.rotacaoH||0;
      const _mnWarp=eq.warpCorners?_aeqComputeMatrix3d(eW,eH,eq.warpCorners.map(c=>({x:c.x*eW,y:c.y*eH}))):null;
      const _mnTfParts=_mnWarp&&_mnWarp!=='none'?[_mnWarp]:[rotH?`perspective(200px) rotateY(${rotH}deg)`:'',rot?`rotate(${rot}deg)`:'',eq.skewX?`skewX(${eq.skewX}deg)`:'',eq.skewY?`skewY(${eq.skewY}deg)`:''].filter(Boolean);
      const _mnTf=_mnTfParts.length?`transform:${_mnTfParts.join(' ')};transform-origin:${(_mnWarp&&_mnWarp!=='none')?'0 0':'center center'};`:'';
      const inn=(eq.img||eq.img_url)?`<img src="${eq.img||eq.img_url}" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none" onerror="this.style.display='none'">`:`<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
      return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${camada==='atras'?1:3};pointer-events:none;${_mnTf}">${inn}</div>`;
    }).join('');
    const _mnChar=`<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;z-index:2">${(miniSvg&&miniSvg.length>5)?miniSvg:fallback}</div>`;
    prevMini.innerHTML=_mnEqOv('atras')+_mnChar+_mnEqOv('frente');
  }
  // Marcar _apmodOriginal como stale se editando uma aba base
  const tipoTab=document.querySelector('.apmod-tab-btn.apmod-tab-ativo')?.dataset?.tab;
  if(tipoTab && tipoTab!=='equip' && tipoTab!=='tint'){
    window._apmodOriginalStale=true;
    window._apmodLastBaseTab=tipoTab;
  }
}

// ── Lightbox: expande o preview compacto para tamanho real ──────────────
function apmodTogglePreviewGrande(triggerEl) {
  const existing = document.getElementById('apmod-lightbox');
  if (existing) { existing.remove(); return; }

  const prevIso = document.getElementById('apmod-prev-iso');
  if (!prevIso) return;
  const content = prevIso.innerHTML;
  const c = RPG_DATA?.characters?.find(x => x.nome === window._apmodNome);
  const cor = c?.custom_attrs?.cor || '#4fa3d1';

  const lb = document.createElement('div');
  lb.id = 'apmod-lightbox';
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:zoom-out';
  lb.onclick = () => lb.remove();
  lb.innerHTML = `
    <style>#apmod-lightbox svg { transform: none !important; margin-bottom: 0 !important; }</style>
    <div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">🎨 Arte do Personagem — toque para fechar</div>
    <div style="width:240px;height:360px;border:1px solid ${cor}55;border-radius:12px;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;box-shadow:0 0 40px ${cor}33">${content}</div>
    <div style="font-size:0.38rem;color:var(--suave);margin-top:8px;opacity:0.5;font-style:italic">arte em tamanho real — reduzida ÷4 no mapa</div>
  `;
  document.body.appendChild(lb);
}


function apmodSharpenImg(imgEl){
  if(!imgEl||imgEl._sharpened) return;
  imgEl._sharpened=true;
  // Apenas CSS — sem processamento de canvas (FIX DISTORÇÃO)
  imgEl.style.imageRendering = 'high-quality';
  // Fallback para browsers mais antigos
  if (imgEl.style.imageRendering !== 'high-quality') {
    imgEl.style.imageRendering = '-webkit-optimize-contrast';
  }
}

// ── File to base64 helper ──────────────────────────────────────────────────
async function apmodFileToBase64(input, targetId) {
  const file = input.files?.[0]; if (!file) return;
  try {
    mostrarToast('Enviando imagem…', 'info');
    const url = await uploadToStorage(file, 'characters');
    const el = document.getElementById(targetId);
    if (el) { el.value = url; apmodAtualizarPreview(); }
  } catch(e) {
    mostrarToast('Erro no upload da imagem', 'erro');
    console.error(e);
  }
}

function apmodCopiarPromptSvg(tipo='frente'){
  const prompts={
    frente:`[DESCREVA O PERSONAGEM: classe, raça, aparência, equipamentos, personalidade visual]

━━━ REQUISITOS TÉCNICOS OBRIGATÓRIOS ━━━
• Formato de saída: Layered PNG sprite — fundo 100% transparente (canal alpha)
• Enquadramento: corpo completo, sem corte, personagem centralizado
• Orientação: vista frontal ortográfica (full body front-facing)
• Resolução mínima: 1024×1024px — quanto maior, melhor (o sistema aplica canvas sharpening)
• Múltiplas camadas exportadas como PNGs separados sempre que possível: corpo base, roupa, armadura, acessórios, efeitos — cada camada em arquivo individual
• Se apenas uma imagem: todos os elementos compostos em PNG único com alpha transparente

━━━ LIBERDADE CRIATIVA TOTAL ━━━
Escolha o estilo artístico que melhor expressa o personagem e o tom da campanha:
anime / ilustração 2D / pintura digital / pixel art / concept art / realismo / aquarela / flat design / etc.
Extraia o máximo da capacidade gráfica disponível — detalhes de textura, iluminação dramática, profundidade visual.

Para uso no RPG Hub: cole a URL pública ou base64 do PNG no campo "Imagem Frente".`,

    iso:`[DESCREVA O PERSONAGEM: classe, raça, aparência, equipamentos, personalidade visual]

━━━ REQUISITOS TÉCNICOS OBRIGATÓRIOS ━━━
• Formato de saída: Layered PNG sprite — fundo 100% transparente (canal alpha)
• Enquadramento: perspectiva isométrica 45° top-down, corpo completo visível
• Escala consistente: o personagem será usado como token no mapa — silhueta clara e leitura imediata são essenciais
• Resolução mínima: 512×512px — quanto maior, melhor (o sistema aplica canvas sharpening)
• Múltiplas camadas exportadas como PNGs separados sempre que possível: corpo base, roupa, armadura, acessórios, sombra projetada — cada camada em arquivo individual
• Se apenas uma imagem: todos os elementos compostos em PNG único com alpha transparente

━━━ LIBERDADE CRIATIVA TOTAL ━━━
Escolha o estilo artístico que melhor expressa o personagem e o tom da campanha:
pixel art de RPG / isométrico 3D / ilustração 2D / concept art / qualquer estilo visual
Extraia o máximo da capacidade gráfica disponível — sombras, oclusão ambiental, micro-detalhes de equipamento.

Para uso no RPG Hub: cole a URL pública ou base64 do PNG no campo "Imagem ISO".`
  };
  const prompt=prompts[tipo]||prompts.frente;
  const label=tipo==='frente'?'Frente':'Isométrico';
  const done=()=>mostrarToast(`Prompt ${label} copiado!`,'ok');
  if(navigator.clipboard) navigator.clipboard.writeText(prompt).then(done).catch(()=>fbCopy(prompt,done));
  else fbCopy(prompt,done);
}

function apmodParseSvgJson(){
  const ta=document.getElementById('apmod-svg-json-paste');
  if(!ta)return;
  const val=ta.value.trim();
  if(!val){mostrarToast('Cole o JSON primeiro','erro');return;}
  let obj;
  try{obj=JSON.parse(val);}catch(e){mostrarToast('JSON inválido: '+e.message,'erro');return;}
  const svgF=obj.frente_svg||obj.svg_frente||'';
  const svgI=obj.iso_svg||obj.svg_iso||'';
  const validarSvg=(svg,nome)=>{if(!svg)return true;const t=svg.trim();if(!t.startsWith('<svg')||!t.includes('</svg>')){mostrarToast(`${nome}: não parece ser SVG válido`,'erro');return false;}return true;};
  if(!validarSvg(svgF,'SVG Frente')||!validarSvg(svgI,'SVG ISO'))return;
  const fEl=document.getElementById('apmod-svg-frente');const iEl=document.getElementById('apmod-svg-iso');
  if(fEl&&svgF)fEl.value=svgF;if(iEl&&svgI)iEl.value=svgI;
  apmodAtualizarPreview();mostrarToast('SVG carregado com sucesso','ok');ta.value='';
}
// ── Gera imagem composta (personagem + equipamentos) e faz upload ──────────
async function _aeqGenerateComposedImg(aparencia, equipVisuais, charNome) {
  try {
    const W = 240, H = 360;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // ──────────────────────────────────────────────────────────────────────
    // Helper: Verifica se warpCorners representa transformação identidade
    // ──────────────────────────────────────────────────────────────────────
    function isIdentityWarp(corners) {
      if (!corners || corners.length !== 4) return true;
      const eps = 0.001; // Tolerância para flutuação
      return (
        Math.abs(corners[0].x - 0) < eps && Math.abs(corners[0].y - 0) < eps &&
        Math.abs(corners[1].x - 1) < eps && Math.abs(corners[1].y - 0) < eps &&
        Math.abs(corners[2].x - 1) < eps && Math.abs(corners[2].y - 1) < eps &&
        Math.abs(corners[3].x - 0) < eps && Math.abs(corners[3].y - 1) < eps
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helper: load image from URL or SVG string
    // ──────────────────────────────────────────────────────────────────────
    function loadImg(src, isSvg, w, h) {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const done = () => resolve(img);
        const fail = () => resolve(null);
        img.onload = done; img.onerror = fail;
        if (isSvg) {
          let s = src || '';
          // CORREÇÃO: Não modificar width/height do SVG aqui
          if (!s.includes('<svg')) { resolve(null); return; }
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
        } else {
          img.src = src;
        }
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // Warp perspectivo por subdivisão em triângulos
    // ──────────────────────────────────────────────────────────────────────
    function drawImageWarped(img, srcW, srcH, corners) {
      const N = 20;
      const lerp = (a, b, t) => a + (b - a) * t;
      const dp = (u, v) => ({
        x: lerp(lerp(corners[0].x, corners[1].x, u), lerp(corners[3].x, corners[2].x, u), v),
        y: lerp(lerp(corners[0].y, corners[1].y, u), lerp(corners[3].y, corners[2].y, u), v)
      });
      function tri(x0,y0,x1,y1,x2,y2, u0,v0,u1,v1,u2,v2) {
        const du1=u1-u0, du2=u2-u0, dv1=v1-v0, dv2=v2-v0;
        const det=du1*dv2-du2*dv1; if(Math.abs(det)<1e-8) return;
        const dx1=x1-x0,dx2=x2-x0,dy1=y1-y0,dy2=y2-y0;
        const ax=(dx1*dv2-dx2*dv1)/det, bx=(du1*dx2-du2*dx1)/det;
        const ay=(dy1*dv2-dy2*dv1)/det, by=(du1*dy2-du2*dy1)/det;
        const cx=x0-ax*u0-bx*v0, cy=y0-ay*u0-by*v0;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.closePath(); ctx.clip();
        ctx.setTransform(ax,ay,bx,by,cx,cy);
        ctx.drawImage(img,0,0,srcW,srcH);
        ctx.restore();
      }
      for(let j=0;j<N;j++) for(let i=0;i<N;i++) {
        const u0=i/N,u1=(i+1)/N,v0=j/N,v1=(j+1)/N;
        const su0=u0*srcW,su1=u1*srcW,sv0=v0*srcH,sv1=v1*srcH;
        const d00=dp(u0,v0),d10=dp(u1,v0),d11=dp(u1,v1),d01=dp(u0,v1);
        tri(d00.x,d00.y,d10.x,d10.y,d01.x,d01.y, su0,sv0,su1,sv0,su0,sv1);
        tri(d10.x,d10.y,d11.x,d11.y,d01.x,d01.y, su1,sv0,su1,sv1,su0,sv1);
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Draw one equipment layer
    // ──────────────────────────────────────────────────────────────────────
    async function drawEquipLayer(camada) {
      const equips = (equipVisuais || []).filter(eq =>
        eq.visivel !== false &&
        (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5)) &&
        (camada === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras')
      );
      
      for (const eq of equips) {
        const xP = eq.x ?? 50, yP = eq.y ?? 40;
        const esc = (eq.escala ?? 90) / 100;
        const eW = Math.round(0.35 * W * esc), eH = Math.round(0.45 * H * esc);
        const l = Math.round((xP / 100) * W - eW / 2);
        const t = Math.round((yP / 100) * H - eH / 2);
        const isSvg = !!(eq.svg && eq.svg.length > 5 && !eq.img && !eq.img_url);
        const src = isSvg ? eq.svg : (eq.img || eq.img_url);
        if (!src) continue;
        
        const img = await loadImg(src, isSvg, eW, eH);
        if (!img || !img.complete) continue;
        
        ctx.save();
        
        // CORREÇÃO CRÍTICA: Só usar warp se corners não for identidade
        const hasRealWarp = eq.warpCorners && !isIdentityWarp(eq.warpCorners);
        
        if (hasRealWarp) {
          // Warp perspectivo: corners normalizados → coords absolutas no canvas
          const c = eq.warpCorners;
          const absCorners = [
            {x: l + c[0].x * eW, y: t + c[0].y * eH},
            {x: l + c[1].x * eW, y: t + c[1].y * eH},
            {x: l + c[2].x * eW, y: t + c[2].y * eH},
            {x: l + c[3].x * eW, y: t + c[3].y * eH}
          ];
          drawImageWarped(img, eW, eH, absCorners);
        } else {
          // CAMINHO NORMAL: Aplicar transformações padrão
          ctx.translate(l + eW / 2, t + eH / 2);
          
          if (eq.rotacaoH) {
            ctx.transform(Math.cos(eq.rotacaoH * Math.PI / 180), 0, 0, 1, 0, 0);
          }
          
          if (eq.rotacao) {
            ctx.rotate(eq.rotacao * Math.PI / 180);
          }
          
          if (eq.skewX) {
            ctx.transform(1, 0, Math.tan(eq.skewX * Math.PI / 180), 1, 0, 0);
          }
          
          if (eq.skewY) {
            ctx.transform(1, Math.tan(eq.skewY * Math.PI / 180), 0, 1, 0, 0);
          }
          
          ctx.drawImage(img, -eW / 2, -eH / 2, eW, eH);
        }
        
        ctx.restore();
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Character source
    // ──────────────────────────────────────────────────────────────────────
    let charSrc = null, charIsSvg = false;
    if (aparencia.modo === 'imagem' && (aparencia.img_iso || aparencia.img_frente)) {
      charSrc = aparencia.img_iso || aparencia.img_frente;
    } else if (aparencia.modo === 'svg' && (aparencia.svg_iso || aparencia.svg_frente)) {
      charSrc = aparencia.svg_iso || aparencia.svg_frente; charIsSvg = true;
    } else if (aparencia.modo === 'criatura') {
      const model = window.CREATURE_MODELS?.[aparencia.modelo_criatura] || window.CREATURE_MODELS?.npc_generico;
      if (model) { 
        charSrc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 54" width="${W}" height="${H}">${model.iso(aparencia.cor_base || '#e8604c')}</svg>`; 
        charIsSvg = true; 
      }
    } else if (typeof apmodRenderIso === 'function') {
      charSrc = apmodRenderIso(aparencia, aparencia.partes?.cor_pele || '#d4a876') || ''; 
      charIsSvg = true;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Render layers in order
    // ──────────────────────────────────────────────────────────────────────
    // 1. atras layer
    await drawEquipLayer('atras');
    
    // 2. character
    if (charSrc) {
      const charImg = await loadImg(charSrc, charIsSvg, W, H);
      if (charImg) ctx.drawImage(charImg, 0, 0, W, H);
    }
    
    // 3. frente layer
    await drawEquipLayer('frente');

    // ──────────────────────────────────────────────────────────────────────
    // Upload to storage
    // ──────────────────────────────────────────────────────────────────────
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const slug = (charNome || 'char').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const file = new File([blob], `composed_${slug}_${Date.now()}.png`, { type: 'image/png' });
    return await uploadToStorage(file, 'characters');
    
  } catch (e) {
    console.warn('[composed] erro ao gerar imagem composta:', e);
    return null;
  }
}


async function apmodSalvar(nome){
  const ap=apmodGetCurrentAparencia();
  
  // Dirty check: comparar com _apmodOriginal
  const original = window._apmodOriginal || {};
  const mudou = JSON.stringify(ap) !== JSON.stringify(original);
  
  if (!mudou) {
    mostrarToast('Nenhuma alteração para salvar', 'info');
    document.getElementById('modal-aparencia-overlay').style.display='none';
    return;
  }
  
  const c=RPG_DATA?.characters?.find(x=>x.nome===nome);if(!c)return;
  const ca=c.custom_attrs||{};

  // ── Aplicar delta de bonus_attrs dos equipamentos visuais ────────────────
  const _somarEquipBonus=(equips)=>{const soma={};(equips||[]).forEach(eq=>{if(!eq.bonus_attrs)return;Object.entries(eq.bonus_attrs).forEach(([k,v])=>{soma[k]=(soma[k]||0)+v;});});return soma;};
  const bonusAntigo=_somarEquipBonus((ca.aparencia||{}).equipamentos_visuais||[]);
  const bonusNovo=_somarEquipBonus(ap.equipamentos_visuais||[]);
  // Reverter antigos e aplicar novos
  const atributos=ca.atributos||{};
  Object.entries(bonusAntigo).forEach(([k,v])=>{if(v)atributos[k]=(parseFloat(atributos[k])||0)-v;});
  Object.entries(bonusNovo).forEach(([k,v])=>{if(v)atributos[k]=(parseFloat(atributos[k])||0)+v;});
  ca.atributos=atributos;

  const novoCa={...ca,aparencia:{...ap, composed_img: null}};
  // Fase 1.3: espelhar imagens da aparência para campos diretos de leitura
  if (ap.img_frente) novoCa.img_retrato = ap.img_frente;
  if (ap.img_iso)    novoCa.img_full    = ap.img_iso;
  c.custom_attrs=novoCa;
  try{
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,{method:'PATCH',body:JSON.stringify({custom_attrs:novoCa})});
    mostrarToast('Aparência salva!','ok');
    document.getElementById('modal-aparencia-overlay').style.display='none';

    // UX-02: Mostrar toast de geração de imagem se necessário
    const temEquipsOuTints=(ap.equipamentos_visuais||[]).length>0||(ap.tints||[]).length>0;
    let _gerandoToastEl=null;
    if(temEquipsOuTints){
      setTimeout(()=>{
        const el=document.createElement('div');
        el.id='toast-gerando-composed';
        el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a2a3a;border:1px solid rgba(79,163,209,0.4);border-radius:8px;padding:9px 16px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.7rem;z-index:9999;pointer-events:none;white-space:nowrap';
        el.textContent='🎨 Gerando arte composta...';
        document.body.appendChild(el);
        _gerandoToastEl=el;
      },300);
    }

    // Atualizar todas as views imediatamente (sem esperar composed_img)
    if(MAPA_STATE?.mapaAtualId){const entry=(RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);if(entry)mapaRenderTokens(entry.mapa);}
    if(typeof CHAR_VIEW!=='undefined'&&CHAR_VIEW===nome&&typeof renderCharView==='function')renderCharView(nome);
    renderAttrView?.(nome);
    if(typeof renderInvVisual==='function'&&typeof INV!=='undefined'&&INV.charAtivo===nome)renderInvVisual();
    document.dispatchEvent(new CustomEvent('arAparenciaSalva',{detail:{nome}}));

    // Destruir renderer da modal após fechar
    if(window._apmodAnimCtrl){window._apmodAnimCtrl.destroy();window._apmodAnimCtrl=null;}

    // Para modo animado: gerar frame estático como composed_img
    if(ap.modo==='animado'&&ap.animado?.parts&&typeof animRendererStaticFrame==='function'){
      animRendererStaticFrame(ap.animado,240,360,'idle',500).then(dataUrl=>{
        const blob=_dataUrlToBlob(dataUrl);
        if(blob){uploadToStorage(new File([blob],'animado_frame.png',{type:'image/png'}),'characters').then(url=>{
          novoCa.aparencia.composed_img=url;c.custom_attrs=novoCa;
          sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,{method:'PATCH',body:JSON.stringify({custom_attrs:novoCa})}).catch(()=>{});
        }).catch(()=>{});}
      }).catch(()=>{});
    }

    // Gerar imagem composta em background e salvar
    // Modo animado já tem composed_img gerado por animRendererStaticFrame acima — pular
    if (ap.modo === 'animado') return;
    _aeqGenerateComposedImg(ap, ap.equipamentos_visuais || [], nome).then(composedUrl => {
      // Remover toast de geração
      const _toastGer=document.getElementById('toast-gerando-composed');if(_toastGer)_toastGer.remove();
      if (!composedUrl) return;
      ap.composed_img = composedUrl;
      c.custom_attrs = { ...c.custom_attrs, aparencia: ap };
      sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`, {
        method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs })
      }).then(() => {
        if(MAPA_STATE?.mapaAtualId){const entry=(RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId);if(entry)mapaRenderTokens(entry.mapa);}
        if(typeof CHAR_VIEW!=='undefined'&&CHAR_VIEW===nome&&typeof renderCharView==='function')renderCharView(nome);
        renderAttrView?.(nome);
        if(typeof renderInvVisual==='function'&&typeof INV!=='undefined'&&INV.charAtivo===nome)renderInvVisual();
      }).catch(() => {});
    });
  }catch(e){mostrarToast('Erro ao salvar aparência','erro');}
}

// ══════════════════════════════════════════════════════════════════════
// 🎨 SISTEMA DE CAMADAS DE TINT (color overlay sobre qualquer imagem)
// ══════════════════════════════════════════════════════════════════════

// Gera o HTML da div de overlay(s) de tint — é posta SOBRE a imagem, dentro de um container position:relative
function tintOverlayHtml(tints) {
  if (!tints || !tints.length) return '';
  return tints.filter(t => t && t.cor && (t.opacidade ?? 0) > 0).map(t => {
    const modo = t.modo || 'multiply';
    const op   = Math.min(1, Math.max(0, t.opacidade ?? 0.4));
    return `<div style="position:absolute;inset:0;background:${t.cor};opacity:${op};mix-blend-mode:${modo};pointer-events:none;border-radius:inherit"></div>`;
  }).join('');
}

// Gera CSS filter string para aplicar no elemento pai quando não há blend support
function tintFilterString(tints) {
  // fallback: não usamos — mix-blend-mode tem suporte universal em 2024+
  return '';
}

// Retorna <div style="position:relative;..."> com img e overlays
function tintWrapImg(imgUrl, containerStyle, imgStyle, tints) {
  const overlays = tintOverlayHtml(tints);
  return `<div style="position:relative;${containerStyle};overflow:hidden"><img src="${imgUrl}" style="${imgStyle}" onerror="this.style.display='none'">${overlays}</div>`;
}

// ── UI da aba Tint ────────────────────────────────────────────────────────
function _apmodTabTint(aparencia) {
  const tints = aparencia.tints || [];
  const modosHtml = ['multiply','screen','overlay','color','hue','soft-light','hard-light','luminosity'].map(m =>
    `<option value="${m}">${m}</option>`).join('');
  const linhasHtml = tints.length
    ? tints.map((t, i) => _apmodTintLinhaHtml(i, t, modosHtml)).join('')
    : '<div id="apmod-tint-empty" style="text-align:center;color:var(--suave);font-style:italic;font-size:0.78rem;padding:18px 0">Nenhuma camada — clique em ＋ para adicionar</div>';

  return `<div id="apmod-tab-tint" class="apmod-tab-content" style="display:none">
  <div style="font-family:var(--fonte-d);font-size:0.62rem;color:var(--suave);margin-bottom:10px;line-height:1.5">
    Sobreponha camadas de cor sobre a imagem. Funciona com qualquer formato — PNG, SVG, builder ou criatura.<br>
    <span style="color:rgba(126,200,240,0.5)">Use <strong>multiply</strong> para tingir, <strong>screen</strong> para clarear, <strong>overlay</strong> para contraste.</span>
  </div>
  <div id="apmod-tint-lista">${linhasHtml}</div>
  <button onclick="apmodTintAdicionar()" style="width:100%;margin-top:10px;padding:9px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:6px;color:var(--suave);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">＋ Nova Camada de Cor</button>

  <!-- Preview ao vivo do tint -->
  <div style="margin-top:14px;border-top:1px solid var(--borda);padding-top:12px">
    <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px">Preview</div>
    <div id="apmod-tint-preview" style="width:80px;height:80px;border-radius:50%;margin:0 auto;overflow:hidden;border:2px solid var(--borda);background:rgba(0,0,0,0.4)">
      <div style="position:relative;width:100%;height:100%">
        <div id="apmod-tint-prev-img" style="width:100%;height:100%"></div>
        <div id="apmod-tint-prev-overlays"></div>
      </div>
    </div>
  </div>
</div>`;
}

function _apmodTintLinhaHtml(i, t, modosHtml) {
  const cor = t.cor || '#ff0000';
  const op  = Math.round((t.opacidade ?? 0.4) * 100);
  const modo = t.modo || 'multiply';
  return `<div id="apmod-tint-linha-${i}" style="display:grid;grid-template-columns:32px 1fr auto auto;gap:6px;align-items:center;padding:7px 8px;background:rgba(10,15,24,0.7);border:1px solid var(--borda);border-radius:7px;margin-bottom:6px">
  <input type="color" value="${cor}" style="width:30px;height:30px;border:1px solid var(--borda);border-radius:6px;background:none;cursor:pointer;padding:2px"
    oninput="apmodTintAtualizar(${i},'cor',this.value)">
  <div style="display:flex;flex-direction:column;gap:3px">
    <div style="display:flex;align-items:center;gap:5px">
      <select style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px 5px;color:var(--texto);font-family:var(--fonte-d);font-size:0.6rem"
        onchange="apmodTintAtualizar(${i},'modo',this.value)">
        ${modosHtml.replace(`value="${modo}"`, `value="${modo}" selected`)}
      </select>
      <span id="apmod-tint-op-val-${i}" style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--primario-v);min-width:30px;text-align:right">${op}%</span>
    </div>
    <input type="range" min="0" max="100" value="${op}" style="width:100%;accent-color:var(--primario);cursor:pointer"
      oninput="apmodTintAtualizar(${i},'opacidade',this.value/100);document.getElementById('apmod-tint-op-val-${i}').textContent=this.value+'%'">
  </div>
  <div style="width:22px;height:22px;border-radius:50%;border:1px solid ${cor}88" id="apmod-tint-swatch-${i}" style="background:${cor}"></div>
  <button onclick="apmodTintRemover(${i})" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1rem;padding:0 2px;line-height:1">✕</button>
</div>`;
}

// Estado de tints em edição
window._apmodTints = [];

function apmodTintIniciar(aparencia) {
  window._apmodTints = JSON.parse(JSON.stringify(aparencia.tints || []));
  apmodTintRefresh();
}

function apmodTintAdicionar() {
  window._apmodTints.push({ cor: '#ff0000', opacidade: 0.35, modo: 'multiply' });
  apmodTintRefresh();
}

function apmodTintAtualizar(i, campo, valor) {
  if (!window._apmodTints[i]) return;
  window._apmodTints[i][campo] = campo === 'opacidade' ? parseFloat(valor) : valor;
  // Atualizar swatch
  if (campo === 'cor') {
    const sw = document.getElementById(`apmod-tint-swatch-${i}`);
    if (sw) { sw.style.background = valor; sw.style.borderColor = valor + '88'; }
  }
  apmodTintAtualizarPreview();
}

function apmodTintRemover(i) {
  window._apmodTints.splice(i, 1);
  apmodTintRefresh();
}

function apmodTintRefresh() {
  const lista = document.getElementById('apmod-tint-lista');
  if (!lista) return;
  const modosHtml = ['multiply','screen','overlay','color','hue','soft-light','hard-light','luminosity'].map(m =>
    `<option value="${m}">${m}</option>`).join('');
  lista.innerHTML = window._apmodTints.length
    ? window._apmodTints.map((t, i) => _apmodTintLinhaHtml(i, t, modosHtml)).join('')
    : '<div style="text-align:center;color:var(--suave);font-style:italic;font-size:0.78rem;padding:18px 0">Nenhuma camada — clique em ＋ para adicionar</div>';
  apmodTintAtualizarPreview();
}

function apmodTintAtualizarPreview() {
  // Garantir que preview principal está expandido
  const previewContent = document.getElementById('apmod-preview-content');
  if (previewContent && (previewContent.style.display === 'none' || previewContent.style.display === '')) {
    apmodTogglePreviewPanel();
  }
  const overlaysEl = document.getElementById('apmod-tint-prev-overlays');
  if (!overlaysEl) return;
  overlaysEl.innerHTML = tintOverlayHtml(window._apmodTints);
  // Atualizar imagem de preview
  const c = RPG_DATA?.characters?.find(x => x.nome === window._apmodNome);
  const ca = c?.custom_attrs || {};
  const ap = ca.aparencia || {};
  const imgEl = document.getElementById('apmod-tint-prev-img');
  if (imgEl) {
    const imgUrl = normalizeImgUrl(ap.img_frente || ap.img_iso || ca.img_retrato || ca.img || ca.img_url || '');
    if (imgUrl) {
      imgEl.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      // Usar preview do builder/criatura
      const prevHead = document.getElementById('apmod-prev-head');
      if (prevHead) imgEl.innerHTML = prevHead.innerHTML;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════

function apmodRemoverEquip(idx){if(idx<0)return;window._apmodEquipsVisuais.splice(idx,1);_apmodRefreshEquipLista();}

function _apmodTabEquip(aparencia,nome){
  const equips=aparencia.equipamentos_visuais||[];
  const _ri=(eq,i)=>{
    const bonusStr=eq.bonus_attrs&&Object.keys(eq.bonus_attrs).length?'📊 '+Object.entries(eq.bonus_attrs).map(([k,v])=>k+(v>0?'+':'')+v).join(' · '):'';
    const unlocksStr=eq.unlock_efeitos&&eq.unlock_efeitos.efeitos&&eq.unlock_efeitos.efeitos.length?'🔓 '+eq.unlock_efeitos.efeitos.map(e=>e.nome||e.tipo).join(', '):'';
    const temImg=!!(eq.img||eq.img_url);const temSvg=!!(eq.svg&&eq.svg.length>5);
    const isAtras=eq.camada==='atras';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:8px;margin-bottom:6px">'
      +'<div style="width:32px;height:36px;border:1px solid rgba(255,255,255,0.1);border-radius:5px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:1rem">'+(temImg?'<img src="'+(eq.img||eq.img_url)+'" style="width:100%;height:100%;object-fit:contain">':temSvg?eq.svg:'⚔')+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--texto)">'+eq.nome+' <span style="font-size:0.58rem;color:var(--suave)">('+((EQUIP_SLOT_LIMITS[eq.tipo]||{}).label||'Geral')+')</span></div>'
      +(bonusStr?'<div style="font-size:0.58rem;color:#7ec8f0;margin-top:1px">'+bonusStr+'</div>':'')
      +(unlocksStr?'<div style="font-size:0.58rem;color:#b07ef0;margin-top:1px">'+unlocksStr+'</div>':'')
      +'</div>'
      +'<button title="'+(isAtras?'Atrás do personagem — clique p/ trazer à frente':'Frente do personagem — clique p/ jogar atrás')+'" onclick="apmodToggleEquipCamada('+i+')" style="background:'+(isAtras?'rgba(200,168,75,0.15)':'rgba(79,163,209,0.08)')+';border:1px solid '+(isAtras?'rgba(200,168,75,0.4)':'rgba(79,163,209,0.25)')+';border-radius:4px;color:'+(isAtras?'#f0cc6a':'#7ec8f0')+';font-size:0.6rem;padding:3px 6px;cursor:pointer;font-family:var(--fonte-d);white-space:nowrap">'+(isAtras?'⬇ Atrás':'⬆ Frente')+'</button>'
      +'<button onclick="apmodAbrirAdicionarEquip('+i+')" style="background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:4px;color:#7ec8f0;font-size:0.55rem;padding:3px 7px;cursor:pointer;font-family:var(--fonte-d)">✏</button>'
      +'<button onclick="apmodRemoverEquip('+i+')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1rem;padding:2px 6px">✕</button>'
      +'</div>';
  };
  return '<div id="apmod-tab-equip" class="apmod-tab-content" style="display:none">'
    +'<div style="font-size:0.62rem;color:var(--suave);margin-bottom:10px;line-height:1.5">Equipamentos visuais aparecem sobre o token e podem alterar atributos e desbloquear efeitos em habilidades.<br><span style="color:var(--destaque-v)">⬆ Frente</span> = sobrepõe ao personagem · <span style="color:#f0cc6a">⬇ Atrás</span> = atrás do personagem</div>'
    +'<div id="apmod-equip-lista" style="margin-bottom:12px">'+(equips.length?equips.map((eq,i)=>_ri(eq,i)).join(''):'<div style="color:var(--suave);font-style:italic;font-size:0.82rem;text-align:center;padding:20px 0">Nenhum equipamento visual</div>')+'</div>'
    +'<button onclick="apmodAbrirAdicionarEquip()" style="width:100%;padding:10px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase">＋ Adicionar Equipamento Visual</button>'
    +'</div>';
}

function _apmodRefreshEquipLista(){
  const lista=document.getElementById('apmod-equip-lista');if(!lista)return;
  const equips=window._apmodEquipsVisuais||[];
  if(!equips.length){lista.innerHTML='<div style="color:var(--suave);font-style:italic;font-size:0.82rem;text-align:center;padding:20px 0">Nenhum equipamento visual</div>';return;}
  lista.innerHTML=equips.map((eq,i)=>{
    const bonusStr=eq.bonus_attrs&&Object.keys(eq.bonus_attrs).length?'📊 '+Object.entries(eq.bonus_attrs).map(([k,v])=>k+(v>0?'+':'')+v).join(' · '):'';
    const unlocksStr=eq.unlock_efeitos&&eq.unlock_efeitos.efeitos&&eq.unlock_efeitos.efeitos.length?'🔓 '+eq.unlock_efeitos.efeitos.map(e=>e.nome||e.tipo).join(', '):'';
    const temImg=!!(eq.img||eq.img_url);const temSvg=!!(eq.svg&&eq.svg.length>5);
    const isAtras=eq.camada==='atras';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:8px;margin-bottom:6px">'
      +'<div style="width:32px;height:36px;border:1px solid rgba(255,255,255,0.1);border-radius:5px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;font-size:1rem">'+(temImg?'<img src="'+(eq.img||eq.img_url)+'" style="width:100%;height:100%;object-fit:contain">':temSvg?eq.svg:'⚔')+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--texto)">'+eq.nome+' <span style="font-size:0.58rem;color:var(--suave)">('+((EQUIP_SLOT_LIMITS[eq.tipo]||{}).label||'Geral')+')</span></div>'
      +(bonusStr?'<div style="font-size:0.58rem;color:#7ec8f0;margin-top:1px">'+bonusStr+'</div>':'')
      +(unlocksStr?'<div style="font-size:0.58rem;color:#b07ef0;margin-top:1px">'+unlocksStr+'</div>':'')
      +'</div>'
      +'<button title="'+(isAtras?'Atrás do personagem — clique p/ trazer à frente':'Frente do personagem — clique p/ jogar atrás')+'" onclick="apmodToggleEquipCamada('+i+')" style="background:'+(isAtras?'rgba(200,168,75,0.15)':'rgba(79,163,209,0.08)')+';border:1px solid '+(isAtras?'rgba(200,168,75,0.4)':'rgba(79,163,209,0.25)')+';border-radius:4px;color:'+(isAtras?'#f0cc6a':'#7ec8f0')+';font-size:0.6rem;padding:3px 6px;cursor:pointer;font-family:var(--fonte-d);white-space:nowrap">'+(isAtras?'⬇ Atrás':'⬆ Frente')+'</button>'
      +'<button onclick="apmodAbrirAdicionarEquip('+i+')" style="background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:4px;color:#7ec8f0;font-size:0.55rem;padding:3px 7px;cursor:pointer;font-family:var(--fonte-d)">✏</button>'
      +'<button onclick="apmodRemoverEquip('+i+')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1rem;padding:2px 6px">✕</button>'
      +'</div>';
  }).join('');
}

function apmodToggleEquipCamada(idx){
  if(!window._apmodEquipsVisuais||idx<0||idx>=window._apmodEquipsVisuais.length)return;
  const eq=window._apmodEquipsVisuais[idx];
  eq.camada=(eq.camada==='atras')?'frente':'atras';
  _apmodRefreshEquipLista();
}

function _aeqSlots(){return Object.entries(EQUIP_SLOT_LIMITS).map(([k,v])=>'<option value="'+k+'">'+v.label+'</option>').join('');}

function apmodAbrirAdicionarEquip(editIdx) {
  // Remove overlay existente
  const prev = document.getElementById('aeq-overlay'); if (prev) prev.remove();

  window._aeqEditIdx = (editIdx != null && editIdx >= 0) ? editIdx : -1;
  const srcEq = window._aeqEditIdx >= 0 ? (window._apmodEquipsVisuais[window._aeqEditIdx] || {}) : {};
  // Clone para edição sem afetar o original até confirmar
  window._aeqWorking = {
    nome:     srcEq.nome    || '',
    tipo:     srcEq.tipo    || 'geral',
    visivel:  srcEq.visivel !== false,
    camada:   srcEq.camada  || 'frente',
    img:      srcEq.img     || srcEq.img_url || '',
    svg:      srcEq.svg     || '',
    x:        srcEq.x      != null ? srcEq.x      : 50,
    y:        srcEq.y      != null ? srcEq.y      : 40,
    escala:   srcEq.escala != null ? srcEq.escala : 90,
    rotacao:  srcEq.rotacao != null ? srcEq.rotacao : 0,
    rotacaoH: srcEq.rotacaoH != null ? srcEq.rotacaoH : 0,
    skewX:       srcEq.skewX != null ? srcEq.skewX : 0,
    skewY:       srcEq.skewY != null ? srcEq.skewY : 0,
    warpCorners: srcEq.warpCorners ? JSON.parse(JSON.stringify(srcEq.warpCorners)) : null,
    _warpMode:   !!(srcEq.warpCorners),
    bonus_attrs:    srcEq.bonus_attrs    ? JSON.parse(JSON.stringify(srcEq.bonus_attrs))    : {},
    unlock_efeitos: srcEq.unlock_efeitos ? JSON.parse(JSON.stringify(srcEq.unlock_efeitos)) : null,
  };
  const w = window._aeqWorking;
  const usaSvg = !!(w.svg && !w.img);
  const ue = w.unlock_efeitos || {};
  const uHabs = (ue.habilidades || ['*']).join(', ');
  const uEfeitos = Array.isArray(ue.efeitos) && ue.efeitos.length ? JSON.stringify(ue.efeitos, null, 2) : '';
  const bonusLinhas = Object.keys(w.bonus_attrs).length
    ? Object.entries(w.bonus_attrs).map(([k, v]) =>
        `<div class="aeq-bonus-row" style="display:flex;gap:6px;margin-bottom:5px">
          <input class="aeq-bonus-attr" placeholder="Atributo" value="${k}" style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:5px;padding:5px 7px;color:var(--texto);font-size:0.8rem">
          <input type="number" class="aeq-bonus-val" value="${v}" style="width:68px;background:var(--painel);border:1px solid var(--borda);border-radius:5px;padding:5px 7px;color:var(--texto);font-size:0.8rem;text-align:center">
          <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1rem">✕</button>
        </div>`).join('')
    : '<div id="aeq-bonus-empty" style="color:var(--suave);font-size:0.7rem;font-style:italic;padding:4px 0">Nenhum</div>';

  const ov = document.createElement('div');
  ov.id = 'aeq-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9400;display:flex;flex-direction:column;overflow:hidden';
  ov.innerHTML = `
  <div style="background:var(--escuro);border-bottom:1px solid var(--borda);padding:9px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
    <span style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--primario)">${window._aeqEditIdx>=0?'✏ Editar':'＋ Novo'} Equipamento Visual</span>
    <button onclick="document.getElementById('aeq-overlay').remove()" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>
  </div>
  <div style="flex:1;display:flex;overflow:hidden;min-height:0">
    <!-- ── Painel esquerdo: canvas de posicionamento ── -->
    <div style="flex:0 0 270px;display:flex;flex-direction:column;align-items:center;background:rgba(5,8,14,0.95);border-right:1px solid var(--borda);padding:10px 10px;overflow-y:auto">
      <div style="font-family:var(--fonte-d);font-size:0.44rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;text-align:center">Posição sobre o personagem</div>
      <div id="aeq-canvas" style="position:relative;width:220px;height:300px;background:rgba(0,0,0,0.7);border:1px solid rgba(79,163,209,0.2);border-radius:8px;overflow:visible;touch-action:none;flex-shrink:0">
        <!-- Personagem de fundo -->
        <div id="aeq-char-layer" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.8;z-index:1"></div>
        <!-- Item arrastável -->
        <div id="aeq-drag" style="position:absolute;cursor:grab;touch-action:none;z-index:2">
          <!-- Alça de rotação (topo) -->
          <div id="aeq-rot-handle" style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:rgba(200,168,75,0.92);border:2px solid rgba(255,255,255,0.8);cursor:grab;display:flex;align-items:center;justify-content:center;font-size:0.55rem;touch-action:none;z-index:2" title="Girar">↻</div>
          <!-- Visual do item -->
          <div id="aeq-item-el" style="pointer-events:none;display:flex;align-items:center;justify-content:center;transform-origin:center center"></div>
          <!-- Alça de escala (canto inferior direito) -->
          <div id="aeq-scale-handle" style="position:absolute;bottom:-10px;right:-10px;width:14px;height:14px;background:rgba(79,163,209,0.92);border:2px solid rgba(255,255,255,0.8);border-radius:3px;cursor:se-resize;touch-action:none;z-index:2" title="Redimensionar"></div>
        </div>
      </div>
      <!-- Controles numéricos -->
      <div style="width:100%;margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">X%</div><input id="aeq-x" type="number" min="0" max="100" value="${Math.round(w.x)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Y%</div><input id="aeq-y" type="number" min="0" max="100" value="${Math.round(w.y)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Escala%</div><input id="aeq-escala" type="number" min="10" max="400" value="${Math.round(w.escala)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Rotação°</div><input id="aeq-rot-num" type="number" min="-180" max="180" value="${Math.round(w.rotacao)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div style="grid-column:1/-1"><div style="font-size:0.4rem;color:rgba(200,168,75,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Giro Horiz.° <span style="opacity:0.6">(profundidade)</span></div>
          <div style="display:flex;gap:4px;align-items:center">
            <input type="range" id="aeq-roth-range" min="-80" max="80" value="${Math.round(w.rotacaoH)}" style="flex:1;accent-color:rgba(200,168,75,0.9)" oninput="document.getElementById('aeq-roth-num').value=this.value;_aeqFromInputs()">
            <input id="aeq-roth-num" type="number" min="-180" max="180" value="${Math.round(w.rotacaoH)}" style="width:44px;box-sizing:border-box;background:var(--painel);border:1px solid rgba(200,168,75,0.35);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="document.getElementById('aeq-roth-range').value=this.value;_aeqFromInputs()" title="Rotação no eixo Y — simula perspectiva 3D">
          </div>
        </div>
        <div id="aeq-skew-section" style="display:contents">
        <div><div style="font-size:0.4rem;color:rgba(130,220,170,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Distorção X°</div>
          <input id="aeq-skewx-num" type="number" min="-60" max="60" value="${Math.round(w.skewX||0)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid rgba(130,220,170,0.3);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()" title="Inclinar horizontalmente para encaixar no formato do personagem">
        </div>
        <div><div style="font-size:0.4rem;color:rgba(130,220,170,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Distorção Y°</div>
          <input id="aeq-skewy-num" type="number" min="-60" max="60" value="${Math.round(w.skewY||0)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid rgba(130,220,170,0.3);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()" title="Inclinar verticalmente para encaixar no formato do personagem">
        </div>
        </div>
      </div>
      <!-- Warp por pontos de controle -->
      <div style="width:100%;margin-top:6px;display:flex;gap:3px;align-items:center">
        <button id="aeq-warp-btn" onclick="_aeqToggleWarpMode()" style="flex:1;padding:5px 4px;border-radius:5px;font-family:var(--fonte-d);font-size:0.46rem;cursor:pointer;border:1px solid var(--borda);background:rgba(20,29,43,0.6);color:var(--suave);transition:all 0.15s">${w._warpMode ? '🔲 Saindo de Warp' : '🔲 Distorcer Forma'}</button>
        <button id="aeq-warp-reset" onclick="_aeqResetWarp()" style="display:${w._warpMode?'inline-flex':'none'};align-items:center;padding:5px 7px;border-radius:5px;font-family:var(--fonte-d);font-size:0.46rem;cursor:pointer;border:1px solid rgba(220,120,80,0.5);background:rgba(220,120,80,0.1);color:rgba(255,160,120,0.95)" title="Resetar pontos">↺</button>
        <button onclick="_aeqClearWarp()" style="padding:5px 7px;border-radius:5px;font-family:var(--fonte-d);font-size:0.46rem;cursor:pointer;border:1px solid rgba(180,60,60,0.4);background:rgba(180,60,60,0.08);color:rgba(255,120,100,0.85)" title="Remover warp">✕</button>
      </div>
      <!-- Camada -->
      <div style="width:100%;margin-top:6px;display:flex;gap:3px">
        <button id="aeq-btn-frente" onclick="_aeqSetCamada('frente')" style="flex:1;padding:4px 2px;border-radius:5px;font-family:var(--fonte-d);font-size:0.46rem;cursor:pointer;border:1px solid rgba(79,163,209,0.5);background:rgba(79,163,209,0.18);color:#7ec8f0">⬆ Frente</button>
        <button id="aeq-btn-atras" onclick="_aeqSetCamada('atras')" style="flex:1;padding:4px 2px;border-radius:5px;font-family:var(--fonte-d);font-size:0.46rem;cursor:pointer;border:1px solid var(--borda);background:rgba(20,29,43,0.5);color:var(--suave)">⬇ Atrás</button>
      </div>
    </div>
    <!-- ── Painel direito: formulário ── -->
    <div style="flex:1;overflow-y:auto;padding:14px;min-width:0">
      <div style="margin-bottom:10px">
        <label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">Nome</label>
        <input type="text" id="aeq-nome" value="${(w.nome).replace(/"/g,'&quot;')}" placeholder="Ex: Espada de Fogo" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:8px;color:var(--texto);font-size:0.88rem">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div><label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">Slot</label>
        <select id="aeq-tipo" style="width:100%;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:7px;color:var(--texto);font-size:0.78rem">${_aeqSlots()}</select></div>
        <div><label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:3px;text-transform:uppercase">Visível no Token</label>
        <select id="aeq-visivel" style="width:100%;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:7px;color:var(--texto);font-size:0.78rem">
          <option value="1"${w.visivel?' selected':''}>Sim</option><option value="0"${!w.visivel?' selected':''}>Não</option>
        </select></div>
      </div>
      <div style="margin-bottom:10px">
        <label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:6px;text-transform:uppercase">🎨 Visual do Item</label>
        <div style="display:flex;gap:4px;margin-bottom:8px">
          <button id="aeq-vbtn-url" onclick="aeqModoVisual('url')" style="flex:1;padding:5px 3px;background:${usaSvg?'rgba(20,29,43,0.6)':'rgba(79,163,209,0.15)'};border:1px solid ${usaSvg?'var(--borda)':'rgba(79,163,209,0.4)'};border-radius:5px;color:${usaSvg?'var(--suave)':'#7ec8f0'};font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">🔗 URL</button>
          <button id="aeq-vbtn-file" onclick="aeqModoVisual('file')" style="flex:1;padding:5px 3px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:5px;color:var(--suave);font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">📁 Arquivo</button>
          <button id="aeq-vbtn-svg" onclick="aeqModoVisual('svg')" style="flex:1;padding:5px 3px;background:${usaSvg?'rgba(79,163,209,0.15)':'rgba(20,29,43,0.6)'};border:1px solid ${usaSvg?'rgba(79,163,209,0.4)':'var(--borda)'};border-radius:5px;color:${usaSvg?'#7ec8f0':'var(--suave)'};font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">✍ SVG</button>
        </div>
        <div id="aeq-visual-url" style="display:${usaSvg?'none':'block'}">
          <input type="text" id="aeq-img-url" value="${(w.img).replace(/"/g,'&quot;')}" placeholder="https://... ou data:image/..." style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:7px;color:var(--texto);font-family:monospace;font-size:0.7rem" oninput="_aeqUpdateVisual()">
        </div>
        <div id="aeq-visual-file" style="display:none">
          <label style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:rgba(200,168,75,0.05);border:1px dashed rgba(200,168,75,0.3);border-radius:6px;cursor:pointer;color:var(--destaque);font-family:var(--fonte-d);font-size:0.65rem">📁 Selecionar imagem<input type="file" accept="image/*" style="display:none" onchange="aeqFileUpload(this)"></label>
        </div>
        <div id="aeq-visual-svg" style="display:${usaSvg?'block':'none'}">
          <textarea id="aeq-svg" rows="4" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:8px;color:var(--texto);font-family:monospace;font-size:0.68rem;resize:vertical" placeholder='<svg viewBox="0 0 16 40"><rect fill="#c00" x="7" y="0" width="2" height="40"/></svg>' oninput="_aeqUpdateVisual()">${(w.svg||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);text-transform:uppercase">📊 Bônus de Atributos</label>
          <button onclick="aeqAdicionarBonusRow()" style="background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:4px;color:#7ec8f0;font-size:0.6rem;padding:3px 9px;cursor:pointer;font-family:var(--fonte-d)">＋</button>
        </div>
        <div id="aeq-bonus-lista">${bonusLinhas}</div>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:5px;text-transform:uppercase">🔓 Desbloquear Efeitos</label>
        <input type="text" id="aeq-unlock-habs" value="${uHabs}" placeholder="* ou Ataque Físico, Magia" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:7px;color:var(--texto);font-size:0.78rem;margin-bottom:6px">
        <textarea id="aeq-unlock-efeitos" rows="2" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:6px;padding:7px;color:var(--texto);font-family:monospace;font-size:0.68rem;resize:vertical" placeholder='[{"tipo":"dot","dano_turno":5}]'>${uEfeitos}</textarea>
      </div>
    </div>
  </div>
  <div style="background:var(--escuro);border-top:1px solid var(--borda);padding:10px 14px;display:flex;gap:8px;flex-shrink:0">
    <button onclick="apmodConfirmarEquip()" style="flex:1;padding:12px;background:linear-gradient(135deg,var(--primario),var(--primario-v));border:none;border-radius:8px;color:#050810;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;font-weight:700">${window._aeqEditIdx>=0?'💾 Salvar':'＋ Adicionar'}</button>
    <button onclick="document.getElementById('aeq-overlay').remove()" style="flex:1;padding:12px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer">Cancelar</button>
  </div>`;

  document.body.appendChild(ov);

  // Setup slot select
  const slotSel = document.getElementById('aeq-tipo');
  if (slotSel && w.tipo) slotSel.value = w.tipo;

  // Render char background
  _aeqRenderChar();
  // Sync camada buttons
  _aeqSetCamada(w.camada);
  // Render item and position
  _aeqUpdateVisual();
  _aeqPositionDrag();
  // Attach drag/rotate/scale handlers
  _aeqAttachHandlers();
}

// Render character in the canvas background
function _aeqRenderChar() {
  const el = document.getElementById('aeq-char-layer'); if (!el) return;
  const c = RPG_DATA?.characters?.find(x => x.nome === window._apmodNome);
  // Use _apmodOriginal (dados reais salvos) em vez de apmodGetCurrentAparencia()
  // pois quando a aba 'equip' está ativa, apmodGetCurrentAparencia retorna modo 'builder' incorretamente
  const ap = window._apmodOriginal || c?.custom_attrs?.aparencia || apmodGetCurrentAparencia();
  const corPele = ap.partes?.cor_pele || ap.cor_base || '#d4a876';
  let html = '';
  if (ap.modo === 'imagem' && (ap.img_iso || ap.img_frente)) {
    const src = ap.img_iso || ap.img_frente;
    html = `<img src="${src}" style="max-width:155px;max-height:240px;object-fit:contain;image-rendering:-webkit-optimize-contrast;image-rendering:high-quality" crossorigin="anonymous">`;
  } else if (ap.modo === 'svg' && (ap.svg_iso || ap.svg_frente)) {
    let s = ap.svg_iso || ap.svg_frente;
    s = s.replace(/width="[^"]*"/, 'width="155"').replace(/height="[^"]*"/, 'height="240"');
    html = s;
  } else if (ap.modo === 'criatura') {
    const model = CREATURE_MODELS[ap.modelo_criatura] || CREATURE_MODELS.npc_generico;
    const cor2 = document.getElementById('apmod-criatura-cor')?.value || ap.cor_base || '#e8604c';
    html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 54" width="120" height="204">${model.iso(cor2)}</svg>`;
  } else {
    let s = apmodRenderIso(ap, corPele) || '';
    s = s.replace(/width="[^"]*"/, 'width="120"').replace(/height="[^"]*"/, 'height="204"');
    html = s;
  }
  el.innerHTML = html;
}

// Render item visual inside the draggable element
function _aeqUpdateVisual() {
  const w = window._aeqWorking; if (!w) return;
  const urlEl = document.getElementById('aeq-img-url');
  const svgEl = document.getElementById('aeq-svg');
  // Só sobrescreve w.img/w.svg se os campos existirem no DOM (posicionador completo)
  // No posicionador simplificado do inventário, preserva os valores já definidos em w
  if (urlEl !== null || svgEl !== null) {
    const svgShown = document.getElementById('aeq-visual-svg')?.style.display !== 'none';
    w.img = svgShown ? '' : (urlEl?.value.trim() || '');
    w.svg = svgShown ? (svgEl?.value.trim() || '') : '';
  }
  const itemEl = document.getElementById('aeq-item-el'); if (!itemEl) return;
  const canvasW = 220, canvasH = 300;
  const baseW = canvasW * 0.35, baseH = canvasH * 0.45;
  const iW = Math.round(baseW * w.escala / 100);
  const iH = Math.round(baseH * w.escala / 100);
  itemEl.style.width = iW + 'px'; itemEl.style.height = iH + 'px';
  if (w.img) {
    itemEl.innerHTML = `<img src="${w.img}" style="width:${iW}px;height:${iH}px;object-fit:contain;pointer-events:none">`;
  } else if (w.svg && w.svg.length > 5) {
    itemEl.innerHTML = `<div style="width:${iW}px;height:${iH}px;display:flex;align-items:center;justify-content:center">${w.svg}</div>`;
  } else {
    itemEl.innerHTML = `<div style="width:${iW}px;height:${iH}px;display:flex;align-items:center;justify-content:center;font-size:${Math.max(16,iW*0.6)}px;opacity:0.4">⚔</div>`;
  }
  _aeqPositionDrag();
}

// Position the draggable item div based on _aeqWorking x/y/rotacao
function _aeqPositionDrag() {
  const w = window._aeqWorking; if (!w) return;
  const drag = document.getElementById('aeq-drag'); if (!drag) return;
  const canvas = document.getElementById('aeq-canvas'); if (!canvas) return;
  const cw = canvas.offsetWidth || 180, ch = canvas.offsetHeight || 260;
  const itemEl = document.getElementById('aeq-item-el');
  const iW = itemEl ? (itemEl.offsetWidth || 40) : 40;
  const iH = itemEl ? (itemEl.offsetHeight || 60) : 60;
  const px = (w.x / 100) * cw;
  const py = (w.y / 100) * ch;
  drag.style.left = (px - iW / 2) + 'px';
  drag.style.top  = (py - iH / 2) + 'px';
  const inner = drag.querySelector('#aeq-item-el');
  if (inner) {
    if (w._warpMode && w.warpCorners) {
      const iW2 = inner.offsetWidth || 40, iH2 = inner.offsetHeight || 60;
      const pxC = w.warpCorners.map(c => ({x: c.x * iW2, y: c.y * iH2}));
      const m3d = _aeqComputeMatrix3d(iW2, iH2, pxC);
      if (m3d !== 'none') {
        inner.style.transformOrigin = '0 0';
        inner.style.transform = m3d;
        // Só reconstrói o layer se não há gesture ativo (para não destruir pointer capture)
        if (!window._aeqWarpGesture) _aeqBuildWarpLayer(w.warpCorners, iW2, iH2);
      } else {
        // Corners inválidos — mostrar sem warp (resetar para identidade automaticamente)
        w.warpCorners = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
        inner.style.transformOrigin = '0 0';
        inner.style.transform = 'none';
        if (!window._aeqWarpGesture) _aeqBuildWarpLayer(w.warpCorners, iW2, iH2);
      }
    } else {
      const tfParts = [];
      if (w.rotacaoH) tfParts.push(`perspective(400px) rotateY(${w.rotacaoH}deg)`);
      if (w.rotacao) tfParts.push(`rotate(${w.rotacao}deg)`);
      if (w.skewX) tfParts.push(`skewX(${w.skewX}deg)`);
      if (w.skewY) tfParts.push(`skewY(${w.skewY}deg)`);
      inner.style.transformOrigin = 'center center';
      inner.style.transform = tfParts.length ? tfParts.join(' ') : 'none';
    }
  }
  // Sync numeric inputs
  const xi = document.getElementById('aeq-x'); if (xi) xi.value = Math.round(w.x);
  const yi = document.getElementById('aeq-y'); if (yi) yi.value = Math.round(w.y);
  const ei = document.getElementById('aeq-escala'); if (ei) ei.value = Math.round(w.escala);
  const ri = document.getElementById('aeq-rot-num'); if (ri) ri.value = Math.round(w.rotacao);
  const rhi = document.getElementById('aeq-roth-num'); if (rhi) rhi.value = Math.round(w.rotacaoH || 0);
  const rhr = document.getElementById('aeq-roth-range'); if (rhr) rhr.value = Math.round(w.rotacaoH || 0);
  const sxi = document.getElementById('aeq-skewx-num'); if (sxi) sxi.value = Math.round(w.skewX || 0);
  const syi = document.getElementById('aeq-skewy-num'); if (syi) syi.value = Math.round(w.skewY || 0);
}

function _aeqFromInputs() {
  const w = window._aeqWorking; if (!w) return;
  w.x        = parseFloat(document.getElementById('aeq-x')?.value) || 50;
  w.y        = parseFloat(document.getElementById('aeq-y')?.value) || 45;
  w.escala   = parseFloat(document.getElementById('aeq-escala')?.value) || 90;
  w.rotacao  = parseFloat(document.getElementById('aeq-rot-num')?.value) || 0;
  w.rotacaoH = parseFloat(document.getElementById('aeq-roth-num')?.value) || 0;
  w.skewX    = parseFloat(document.getElementById('aeq-skewx-num')?.value) || 0;
  w.skewY    = parseFloat(document.getElementById('aeq-skewy-num')?.value) || 0;
  _aeqUpdateVisual();
}

function _aeqSetCamada(c) {
  if (window._aeqWorking) window._aeqWorking.camada = c;
  const bf = document.getElementById('aeq-btn-frente'), bb = document.getElementById('aeq-btn-atras');
  if (!bf || !bb) return;
  const isF = c === 'frente';
  bf.style.background = isF ? 'rgba(79,163,209,0.18)' : 'rgba(20,29,43,0.5)';
  bf.style.borderColor = isF ? 'rgba(79,163,209,0.5)' : 'var(--borda)';
  bf.style.color = isF ? '#7ec8f0' : 'var(--suave)';
  bb.style.background = !isF ? 'rgba(200,168,75,0.18)' : 'rgba(20,29,43,0.5)';
  bb.style.borderColor = !isF ? 'rgba(200,168,75,0.5)' : 'var(--borda)';
  bb.style.color = !isF ? '#f0cc6a' : 'var(--suave)';
  // Atualizar z-index do item no preview para mostrar frente/atrás do personagem
  const drag = document.getElementById('aeq-drag');
  if (drag) drag.style.zIndex = isF ? '2' : '0';
}

// Pointer-based drag/rotate/scale
window._aeqGesture = null;
function _aeqAttachHandlers() {
  const drag = document.getElementById('aeq-drag');
  const rotH = document.getElementById('aeq-rot-handle');
  const scaH = document.getElementById('aeq-scale-handle');
  const canvas = document.getElementById('aeq-canvas');
  if (!drag || !canvas) return;

  // Drag (move)
  drag.addEventListener('pointerdown', e => {
    if (e.target === rotH || e.target === scaH) return;
    e.stopPropagation(); e.preventDefault();
    const w = window._aeqWorking;
    const r = canvas.getBoundingClientRect();
    window._aeqGesture = { mode: 'move', ptr: e.pointerId, sx: e.clientX, sy: e.clientY, ox: w.x, oy: w.y, cw: r.width, ch: r.height };
    drag.style.cursor = 'grabbing';
    drag.setPointerCapture(e.pointerId);
  });

  // Rotate
  if (rotH) rotH.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    const itemEl = document.getElementById('aeq-item-el');
    const r = itemEl ? itemEl.getBoundingClientRect() : drag.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    window._aeqGesture = { mode: 'rotate', ptr: e.pointerId, cx, cy, startAngle, origRot: window._aeqWorking.rotacao };
    rotH.setPointerCapture(e.pointerId);
  });

  // Scale
  if (scaH) scaH.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    const itemEl = document.getElementById('aeq-item-el');
    const r = itemEl ? itemEl.getBoundingClientRect() : drag.getBoundingClientRect();
    const cx = r.left, cy = r.top;
    const origDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    window._aeqGesture = { mode: 'scale', ptr: e.pointerId, cx, cy, origDist, origScale: window._aeqWorking.escala };
    scaH.setPointerCapture(e.pointerId);
  });

  document.addEventListener('pointermove', _aeqOnMove);
  document.addEventListener('pointerup', _aeqOnUp);
}

function _aeqOnMove(e) {
  const g = window._aeqGesture; if (!g || g.ptr !== e.pointerId) return;
  const w = window._aeqWorking; if (!w) return;
  if (g.mode === 'move') {
    w.x = Math.max(0, Math.min(100, g.ox + (e.clientX - g.sx) / g.cw * 100));
    w.y = Math.max(0, Math.min(100, g.oy + (e.clientY - g.sy) / g.ch * 100));
    _aeqPositionDrag();
  } else if (g.mode === 'rotate') {
    const angle = Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180 / Math.PI;
    let r = g.origRot + (angle - g.startAngle);
    r = ((r % 360) + 360) % 360; if (r > 180) r -= 360;
    w.rotacao = r; _aeqPositionDrag();
  } else if (g.mode === 'scale') {
    const itemEl = document.getElementById('aeq-item-el');
    const ir = itemEl ? itemEl.getBoundingClientRect() : { left: g.cx, top: g.cy };
    const d = Math.hypot(e.clientX - ir.left, e.clientY - ir.top) || 1;
    w.escala = Math.max(10, Math.min(400, g.origScale * (d / g.origDist)));
    _aeqUpdateVisual();
  }
}
function _aeqOnUp(e) {
  if (!window._aeqGesture || window._aeqGesture.ptr !== e.pointerId) return;
  window._aeqGesture = null;
  const drag = document.getElementById('aeq-drag');
  if (drag) drag.style.cursor = 'grab';
}

// ─── Warp por pontos de controle (homografia CSS matrix3d) ──────────────────
function _aeqComputeMatrix3d(srcW, srcH, dst) {
  // Validar corners — se algum for inválido ou muito extremo, não aplica warp
  if (!dst || dst.length < 4 || dst.some(p => !isFinite(p.x) || !isFinite(p.y) || Math.abs(p.x) > srcW * 2.5 || Math.abs(p.y) > srcH * 2.5)) return 'none';
  function adj(m){return[m[4]*m[8]-m[5]*m[7],m[2]*m[7]-m[1]*m[8],m[1]*m[5]-m[2]*m[4],m[5]*m[6]-m[3]*m[8],m[0]*m[8]-m[2]*m[6],m[2]*m[3]-m[0]*m[5],m[3]*m[7]-m[4]*m[6],m[1]*m[6]-m[0]*m[7],m[0]*m[4]-m[1]*m[3]];}
  function mul(a,b){const c=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)c[3*i+j]+=a[3*i+k]*b[3*k+j];return c;}
  function mv(m,v){return[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];}
  function basis(pts){const m=[pts[0].x,pts[1].x,pts[2].x,pts[0].y,pts[1].y,pts[2].y,1,1,1];const v=mv(adj(m),[pts[3].x,pts[3].y,1]);return[m[0]*v[0],m[1]*v[1],m[2]*v[2],m[3]*v[0],m[4]*v[1],m[5]*v[2],m[6]*v[0],m[7]*v[1],m[8]*v[2]];}
  const src=[{x:0,y:0},{x:srcW,y:0},{x:srcW,y:srcH},{x:0,y:srcH}];
  const h=mul(basis(dst),adj(basis(src)));
  const s=h[8]; if(Math.abs(s)<1e-10) return 'none';
  for(let i=0;i<9;i++) h[i]/=s;
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
}

// Atualiza apenas posições dos handles e SVG SEM reconstruir o DOM (seguro durante drag)
function _aeqRepaintWarpLayer(corners, iW, iH) {
  const hSize = 18;
  // Atualizar posição dos handles diretamente
  for (let i = 0; i < 4; i++) {
    const h = document.getElementById('aeq-wh-' + i);
    if (h) {
      h.style.left = (corners[i].x * iW - hSize / 2) + 'px';
      h.style.top  = (corners[i].y * iH - hSize / 2) + 'px';
    }
  }
  // Atualizar SVG da grade
  const svg = document.getElementById('aeq-warp-svg');
  if (svg) svg.innerHTML = _aeqWarpGridInner(corners, iW, iH);
}

function _aeqWarpGridInner(corners, iW, iH) {
  const n = 7;
  const lp = (a, b, t) => a + (b - a) * t;
  const px = (u, v) => {
    const x = lp(lp(corners[0].x, corners[1].x, u), lp(corners[3].x, corners[2].x, u), v);
    const y = lp(lp(corners[0].y, corners[1].y, u), lp(corners[3].y, corners[2].y, u), v);
    return `${(x*iW).toFixed(1)},${(y*iH).toFixed(1)}`;
  };
  let s = '';
  const lSt = 'stroke="rgba(79,163,209,0.45)" stroke-width="0.7" fill="none"';
  for (let j = 0; j <= n; j++) { const v = j/n; s += `<polyline points="${Array.from({length:n+1},(_,i)=>px(i/n,v)).join(' ')}" ${lSt}/>`; }
  for (let i = 0; i <= n; i++) { const u = i/n; s += `<polyline points="${Array.from({length:n+1},(_,j)=>px(u,j/n)).join(' ')}" ${lSt}/>`; }
  s += `<polyline points="${px(0,0)} ${px(1,0)} ${px(1,1)} ${px(0,1)} ${px(0,0)}" stroke="rgba(79,163,209,0.9)" stroke-width="1.2" fill="none"/>`;
  return s;
}

// Constrói o layer de warp do zero (apenas chamado quando não há gesture ativo)
function _aeqBuildWarpLayer(corners, iW, iH) {
  const drag = document.getElementById('aeq-drag'); if (!drag) return;
  document.getElementById('aeq-warp-layer')?.remove();

  const layer = document.createElement('div');
  layer.id = 'aeq-warp-layer';
  layer.style.cssText = `position:absolute;left:0;top:0;width:${iW}px;height:${iH}px;pointer-events:none;z-index:10;overflow:visible`;

  // SVG da grade
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'aeq-warp-svg';
  svg.setAttribute('width', iW);
  svg.setAttribute('height', iH);
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:3';
  svg.innerHTML = _aeqWarpGridInner(corners, iW, iH);
  layer.appendChild(svg);

  // Handles nos cantos
  const labels = ['TL','TR','BR','BL'];
  const hSize = 18;
  corners.forEach((c, i) => {
    const h = document.createElement('div');
    h.id = 'aeq-wh-' + i;
    h.dataset.wi = i;
    h.style.cssText = `position:absolute;left:${c.x*iW - hSize/2}px;top:${c.y*iH - hSize/2}px;width:${hSize}px;height:${hSize}px;border-radius:4px;background:rgba(200,168,75,0.92);border:2px solid rgba(255,255,255,0.9);cursor:crosshair;pointer-events:all;z-index:11;display:flex;align-items:center;justify-content:center;font-size:0.38rem;color:rgba(0,0,0,0.8);font-weight:bold;font-family:monospace;box-shadow:0 1px 6px rgba(0,0,0,0.5);touch-action:none;user-select:none`;
    h.title = `Arraste para distorcer ${labels[i]}`;
    h.textContent = i + 1;

    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      if (window._aeqWarpGesture) return; // já há gesture ativa
      const w = window._aeqWorking; if (!w || !w.warpCorners) return;
      const inner = document.getElementById('aeq-item-el'); if (!inner) return;
      const iWc = inner.offsetWidth || 40, iHc = inner.offsetHeight || 60;
      window._aeqWarpGesture = {
        wi: i,
        ptr: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: w.warpCorners[i].x,
        origY: w.warpCorners[i].y,
        iW: iWc,
        iH: iHc
      };
      h.setPointerCapture(e.pointerId);
      // Listeners no documento para não perder eventos durante drag rápido
      document.addEventListener('pointermove', _aeqWarpMoveDoc);
      document.addEventListener('pointerup',   _aeqWarpUpDoc);
    });

    layer.appendChild(h);
  });

  drag.appendChild(layer);
}

window._aeqWarpGesture = null;

function _aeqWarpMoveDoc(e) {
  const g = window._aeqWarpGesture; if (!g || g.ptr !== e.pointerId) return;
  const w = window._aeqWorking; if (!w || !w.warpCorners) return;
  w.warpCorners[g.wi].x = g.origX + (e.clientX - g.startX) / g.iW;
  w.warpCorners[g.wi].y = g.origY + (e.clientY - g.startY) / g.iH;
  // Atualizar o transform do item
  const inner = document.getElementById('aeq-item-el'); if (!inner) return;
  const iW = g.iW, iH = g.iH;
  const pxC = w.warpCorners.map(c => ({x: c.x * iW, y: c.y * iH}));
  const m3d = _aeqComputeMatrix3d(iW, iH, pxC);
  inner.style.transformOrigin = '0 0';
  inner.style.transform = m3d !== 'none' ? m3d : 'none';
  // Atualizar visualmente os handles e grid SEM reconstruir DOM
  _aeqRepaintWarpLayer(w.warpCorners, iW, iH);
}

function _aeqWarpUpDoc(e) {
  if (!window._aeqWarpGesture || window._aeqWarpGesture.ptr !== e.pointerId) return;
  window._aeqWarpGesture = null;
  document.removeEventListener('pointermove', _aeqWarpMoveDoc);
  document.removeEventListener('pointerup',   _aeqWarpUpDoc);
}

function _aeqToggleWarpMode() {
  const w = window._aeqWorking; if (!w) return;
  w._warpMode = !w._warpMode;

  if (w._warpMode) {
    if (!w.warpCorners) {
      // Sempre inicia do quadrado perfeito (identidade)
      // Os transforms existentes (rotação/skew) ficam dormentes enquanto warp está ativo
      // e são restaurados ao desativar
      w.warpCorners = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    }
  }

  const btn = document.getElementById('aeq-warp-btn');
  if (btn) {
    btn.style.background  = w._warpMode ? 'rgba(200,168,75,0.18)' : 'rgba(20,29,43,0.6)';
    btn.style.borderColor = w._warpMode ? 'rgba(200,168,75,0.6)'  : 'var(--borda)';
    btn.style.color       = w._warpMode ? '#f0cc6a'               : 'var(--suave)';
    btn.textContent       = w._warpMode ? '🔲 Saindo de Warp'     : '🔲 Distorcer Forma';
  }
  const rst = document.getElementById('aeq-warp-reset');
  if (rst) rst.style.display = w._warpMode ? 'inline-flex' : 'none';

  const skewSection = document.getElementById('aeq-skew-section');
  if (skewSection) {
    skewSection.style.opacity      = w._warpMode ? '0.35' : '1';
    skewSection.style.pointerEvents = w._warpMode ? 'none' : '';
  }

  if (!w._warpMode) {
    document.getElementById('aeq-warp-layer')?.remove();
    // Garantir que listeners de warp estejam limpos
    document.removeEventListener('pointermove', _aeqWarpMoveDoc);
    document.removeEventListener('pointerup',   _aeqWarpUpDoc);
    window._aeqWarpGesture = null;
    _aeqPositionDrag();
  } else {
    _aeqPositionDrag();
  }
}

function _aeqResetWarp() {
  const w = window._aeqWorking; if (!w) return;
  w.warpCorners = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
  _aeqPositionDrag();
}

function _aeqClearWarp() {
  const w = window._aeqWorking; if (!w) return;
  w.warpCorners = null;
  w._warpMode = false;
  document.getElementById('aeq-warp-layer')?.remove();
  document.removeEventListener('pointermove', _aeqWarpMoveDoc);
  document.removeEventListener('pointerup',   _aeqWarpUpDoc);
  window._aeqWarpGesture = null;
  const btn = document.getElementById('aeq-warp-btn');
  if (btn) { btn.style.background='rgba(20,29,43,0.6)'; btn.style.borderColor='var(--borda)'; btn.style.color='var(--suave)'; btn.textContent='🔲 Distorcer Forma'; }
  const rst = document.getElementById('aeq-warp-reset'); if (rst) rst.style.display='none';
  const skewSection = document.getElementById('aeq-skew-section');
  if (skewSection) { skewSection.style.opacity='1'; skewSection.style.pointerEvents=''; }
  _aeqPositionDrag();
}
// ─── Fim Warp ──────────────────────────────────────────────────────────────

function aeqModoVisual(modo) {
  ['url','file','svg'].forEach(m => {
    const el = document.getElementById('aeq-visual-' + m); if (el) el.style.display = m === modo ? 'block' : 'none';
    const b = document.getElementById('aeq-vbtn-' + m); if (!b) return;
    const a = m === modo;
    b.style.background = a ? 'rgba(79,163,209,0.15)' : 'rgba(20,29,43,0.6)';
    b.style.borderColor = a ? 'rgba(79,163,209,0.4)' : 'var(--borda)';
    b.style.color = a ? '#7ec8f0' : 'var(--suave)';
  });
  _aeqUpdateVisual();
}
async function aeqFileUpload(inp) {
  const f = inp.files?.[0]; if (!f) return;
  try {
    mostrarToast('Enviando imagem…', 'info');
    const url = await uploadToStorage(f, 'characters');
    const urlEl = document.getElementById('aeq-img-url');
    if (urlEl) { urlEl.value = url; aeqModoVisual('url'); }
    _aeqUpdateVisual();
    mostrarToast('Imagem enviada!', 'ok');
  } catch(e) {
    mostrarToast('Erro no upload da imagem', 'erro');
    console.error(e);
  }
}

function aeqAdicionarBonusRow() {
  const lista = document.getElementById('aeq-bonus-lista'); if (!lista) return;
  const ph = document.getElementById('aeq-bonus-empty'); if (ph) ph.remove();
  const row = document.createElement('div');
  row.className = 'aeq-bonus-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:5px';
  row.innerHTML = '<input class="aeq-bonus-attr" placeholder="Atributo (ex: Força)" style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:5px;padding:5px 7px;color:var(--texto);font-size:0.8rem"><input type="number" class="aeq-bonus-val" value="0" style="width:68px;background:var(--painel);border:1px solid var(--borda);border-radius:5px;padding:5px 7px;color:var(--texto);font-size:0.8rem;text-align:center"><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1rem">✕</button>';
  lista.appendChild(row);
}

function apmodConfirmarEquip() {
  const nomeEl = document.getElementById('aeq-nome'); if (!nomeEl) return;
  const nome = nomeEl.value.trim(); if (!nome) { mostrarToast('Nome é obrigatório','erro'); return; }
  // Get working state (visual position set by drag, inputs already synced)
  const w = window._aeqWorking || {};
  // Refresh visual fields from inputs one last time
  const tipo     = document.getElementById('aeq-tipo')?.value || 'geral';
  const visivel  = document.getElementById('aeq-visivel')?.value !== '0';
  const svgShown = document.getElementById('aeq-visual-svg')?.style.display !== 'none';
  const imgUrl   = document.getElementById('aeq-img-url')?.value.trim() || '';
  const svg      = svgShown ? (document.getElementById('aeq-svg')?.value.trim() || '') : '';
  const x        = parseFloat(document.getElementById('aeq-x')?.value) || w.x || 50;
  const y        = parseFloat(document.getElementById('aeq-y')?.value) || w.y || 45;
  const escala   = parseFloat(document.getElementById('aeq-escala')?.value) || w.escala || 90;
  const rotacao  = parseFloat(document.getElementById('aeq-rot-num')?.value) || w.rotacao || 0;
  const rotacaoH = parseFloat(document.getElementById('aeq-roth-num')?.value) || w.rotacaoH || 0;
  const skewX    = parseFloat(document.getElementById('aeq-skewx-num')?.value) || w.skewX || 0;
  const skewY    = parseFloat(document.getElementById('aeq-skewy-num')?.value) || w.skewY || 0;
  const camada   = w.camada || 'frente';
  const limite   = EQUIP_SLOT_LIMITS[tipo] || EQUIP_SLOT_LIMITS.geral;
  const bonus_attrs = {};
  document.querySelectorAll('#aeq-bonus-lista .aeq-bonus-row').forEach(row => {
    const attr = row.querySelector('.aeq-bonus-attr')?.value.trim() || '';
    const val  = parseFloat(row.querySelector('.aeq-bonus-val')?.value) || 0;
    if (attr) bonus_attrs[attr] = val;
  });
  let unlock_efeitos = null;
  const habsRaw    = document.getElementById('aeq-unlock-habs')?.value.trim() || '';
  const efeitosRaw = document.getElementById('aeq-unlock-efeitos')?.value.trim() || '';
  if (efeitosRaw) {
    let arr = []; try { arr = JSON.parse(efeitosRaw); } catch(e) { mostrarToast('JSON inválido nos efeitos','erro'); return; }
    if (arr.length) { unlock_efeitos = { habilidades: habsRaw ? habsRaw.split(',').map(h=>h.trim()).filter(Boolean) : ['*'], efeitos: arr }; }
  }
  const eq = { nome, tipo, visivel, camada, img: imgUrl, img_url: imgUrl, svg, x, y, escala, rotacao, rotacaoH, skewX, skewY, warpCorners: (w.warpCorners || null), maxW: limite.maxW, maxH: limite.maxH };
  if (Object.keys(bonus_attrs).length) eq.bonus_attrs = bonus_attrs;
  if (unlock_efeitos) eq.unlock_efeitos = unlock_efeitos;
  const idx = window._aeqEditIdx != null ? window._aeqEditIdx : -1;
  if (idx >= 0) window._apmodEquipsVisuais[idx] = eq;
  else window._apmodEquipsVisuais.push(eq);
  // Cleanup global pointer listeners
  document.removeEventListener('pointermove', _aeqOnMove);
  document.removeEventListener('pointerup', _aeqOnUp);
  const ov = document.getElementById('aeq-overlay'); if (ov) ov.remove();
  _apmodRefreshEquipLista();
  mostrarToast(idx >= 0 ? 'Equipamento atualizado' : 'Equipamento adicionado', 'ok');
}

console.log('[APMOD] Sistema de Aparência carregado ✓ | Criaturas:',Object.keys(CREATURE_MODELS).length,'| Parts:',Object.values(APMOD_PARTS).flat().length,'| Templates:',CHAR_JSON_TEMPLATES.length);

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 SISTEMA HD — Viewport Expandida para Designs Épicos
// ═══════════════════════════════════════════════════════════════════════════
// Filosofia: Personagens desenhados em espaço MAIOR com overflow visível.
// ViewBox expandida: personagens podem ter cabelos acima do crânio, ombros
// além da largura do corpo, capas abaixo dos pés — sem corte.
//
// Coordenadas seguras para partes HD:
//   X: de -20 a 52  (corpo normal: 0-32, overflow: -20 e +20 p/ pauldrons)
//   Y: de -28 a 96  (corpo normal: 0-68, overflow: -28 top, +28 bottom)
//   Use estilo: 'ff_hd' para identificar partes HD
// ═══════════════════════════════════════════════════════════════════════════

(function() {
  // ── 1. Override dos renders: ViewBox expandida + overflow:visible ─────
  const _baseRenderFront = apmodRenderFront;
  apmodRenderFront = function(aparencia, corBase) {
    let svg = _baseRenderFront.call(this, aparencia, corBase);
    // Expande viewport: -20px esq/dir, -28px topo, +28px base
    svg = svg.replace(/viewBox="[^"]*"/, 'viewBox="-20 -28 72 124"');
    // Mantém display size (o navegador escala automaticamente)
    svg = svg.replace(/width="\d+"/, 'width="32"').replace(/height="\d+"/, 'height="68"');
    svg = svg.replace('<svg ', '<svg overflow="visible" ');
    // Injeta partes HD (estilo ff_hd) desenhadas no espaço expandido
    const p = aparencia?.partes || {};
    const corCab = p.cor_cabelo || '#4a2c0a';
    const corCam = p.cor_camisa || '#4a7aaa';
    const corCal = p.cor_calca  || '#2a3a5a';
    const corSap = p.cor_sapato || '#1a1a1a';
    const corOlho = p.cor_olho  || '#3a6aaa';
    const hdParts = ['cabelo','rosto','camisa','calca','sapato'];
    const hdColors = {cabelo: [corCab, _hexDarken(corCab,30)], rosto: [corOlho, _hexDarken(corOlho,40)],
      camisa: [corCam, _hexDarken(corCam,30)], calca: [corCal, _hexDarken(corCal,25)], sapato: [corSap, _hexDarken(corSap,20)]};
    let hdInject = '';
    for (const tipo of hdParts) {
      const id = p[tipo];
      if (!id) continue;
      const part = (APMOD_PARTS[tipo]||[]).find(x => x.id === id);
      if (part?.estilo === 'ff_hd' && part.front_hd) {
        hdInject += _svgPart(part.front_hd, hdColors[tipo][0], hdColors[tipo][1]);
      }
    }
    if (hdInject) svg = svg.replace('</svg>', hdInject + '</svg>');
    return svg;
  };

  const _baseRenderIso = apmodRenderIso;
  apmodRenderIso = function(aparencia, corBase) {
    let svg = _baseRenderIso.call(this, aparencia, corBase);
    svg = svg.replace(/viewBox="[^"]*"/, 'viewBox="-20 -28 72 108"');
    // Arte grande: SVG renderizado no tamanho real do personagem (reduzido ÷4 quando vai ao mapa)
    svg = svg.replace(/(<svg\b[^>]*?)\bwidth="[^"]*"/, '$1width="234"').replace(/(<svg\b[^>]*?)\bheight="[^"]*"/, '$1height="351"');
    svg = svg.replace('<svg ', '<svg overflow="visible" ');
    const p = aparencia?.partes || {};
    const corCab = p.cor_cabelo || '#4a2c0a';
    const corCam = p.cor_camisa || '#4a7aaa';
    const corCal = p.cor_calca  || '#2a3a5a';
    const corSap = p.cor_sapato || '#1a1a1a';
    const corOlho = p.cor_olho  || '#3a6aaa';
    const hdColors = {cabelo: [corCab, _hexDarken(corCab,30)], rosto: [corOlho, _hexDarken(corOlho,40)],
      camisa: [corCam, _hexDarken(corCam,30)], calca: [corCal, _hexDarken(corCal,25)], sapato: [corSap, _hexDarken(corSap,20)]};
    let hdInject = '';
    for (const tipo of ['cabelo','rosto','camisa','calca','sapato']) {
      const id = p[tipo];
      if (!id) continue;
      const part = (APMOD_PARTS[tipo]||[]).find(x => x.id === id);
      if (part?.estilo === 'ff_hd' && part.iso_hd) {
        hdInject += _svgPart(part.iso_hd, hdColors[tipo][0], hdColors[tipo][1]);
      }
    }
    if (hdInject) svg = svg.replace('</svg>', hdInject + '</svg>');
    return svg;
  };

  // ── 2. Preview maior e sem clipping ─────────────────────────────────────
  const _baseUpdatePreview = typeof apmodAtualizarPreview === 'function' ? apmodAtualizarPreview : null;
  apmodAtualizarPreview = function() {
    if (_baseUpdatePreview) _baseUpdatePreview();
    setTimeout(() => {
      // Preview grande — arte real do personagem (no mapa aparece ~4x menor)
      const prevIso = document.getElementById('apmod-prev-iso');
      if (prevIso) {
        prevIso.style.overflow = 'hidden';
        prevIso.style.width = '240px';
        prevIso.style.height = '362px';
      }
      const prevHead = document.getElementById('apmod-prev-head');
      if (prevHead) {
        prevHead.style.overflow = 'hidden';
        prevHead.style.width = '60px';
        prevHead.style.height = '60px';
      }
    }, 80);
  };

  // ── 3. Templates com modo:'svg' agora suportados em apmodCarregarTemplate ─
  const _baseCarregarTemplate = apmodCarregarTemplate;
  apmodCarregarTemplate = function(id) {
    const t = CHAR_JSON_TEMPLATES.find(x => x.id === id);
    if (!t) return;
    if (t.modo === 'svg' && (t.svg_frente || t.svg_iso)) {
      // Template SVG completo: atualiza aparência diretamente
      const ap = { modo: 'svg', svg_frente: t.svg_frente || '', svg_iso: t.svg_iso || '', tamanho: t.tamanho || 1.0 };
      apmodPreencherBuilder(ap);
      apmodSwitchTab('svg', document.querySelector('[data-tab="svg"]'));
      const fEl = document.getElementById('apmod-svg-frente');
      const iEl = document.getElementById('apmod-svg-iso');
      if (fEl && t.svg_frente) fEl.value = t.svg_frente;
      if (iEl && t.svg_iso) iEl.value = t.svg_iso;
      apmodAtualizarPreview();
      mostrarToast(`Template "${t.label}" carregado ✨`, 'ok');
      return;
    }
    _baseCarregarTemplate(id);
  };

  // ── 4. Badge FF HD na lista de templates ────────────────────────────────
  const _baseTabJson = _apmodTabJson;
  window._apmodTabJson = function() {
    return `<div id="apmod-tab-json" class="apmod-tab-content" style="display:block">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Templates Prontos</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${CHAR_JSON_TEMPLATES.map(t => {
          const isHD = t.estilo === 'ff_hd' || t.modo === 'svg';
          const badge = isHD ? `<div style="font-size:0.48rem;color:#c8a0f8;background:rgba(100,50,180,0.25);border:1px solid rgba(150,80,255,0.3);border-radius:3px;padding:1px 4px;margin-top:2px;display:inline-block">FF HD</div>` : '';
          return `<button onclick="apmodCarregarTemplate('${t.id}')"
            style="background:rgba(20,29,43,0.8);border:1px solid var(--borda);border-radius:8px;padding:10px 8px;cursor:pointer;color:var(--texto);font-family:var(--fonte-d);font-size:0.62rem;text-align:center;transition:border-color 0.2s"
            onmouseover="this.style.borderColor='var(--primario)'"
            onmouseout="this.style.borderColor='var(--borda)'">
            <div style="font-size:1.2rem;margin-bottom:4px">${t.icon}</div>
            ${t.label}
            <div style="font-size:0.55rem;color:var(--suave);margin-top:2px">${t.estilo}</div>
            ${badge}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  };

  console.log('[SISTEMA HD] ✓ Arte Grande (234×351px) | Reduzida ÷4 no mapa | Preview 240×360px | Suporte SVG templates');
})();

// ═══════════════════════════════════════════════════════════════════════════
// 🏰 ARQUÉTIPOS CLÁSSICOS DE RPG — 6 classes totalmente customizáveis
// Layered SVG sprites via APMOD_PARTS ff_hd — sem transparências no mapa
// Silhuetas distintas, cobrem 100% da área corporal, combinam entre si.
// ═══════════════════════════════════════════════════════════════════════════

// ═══ CABELOS / CAPACETES ════════════════════════════════════════════════════
APMOD_PARTS.cabelo.push(

{id:'h_gue',nome:'⚔ Elmo Fechado',estilo:'ff_hd',
front:`<path d="M7,19 Q7,3 16,1 Q25,3 25,19 Q22,22 16,23 Q10,22 7,19 Z" fill="{c}"/><path d="M9,18 L9,14 Q9,12 16,12 Q23,12 23,14 L23,18" fill="{c2}" opacity="0.8"/><line x1="9" y1="15.5" x2="23" y2="15.5" stroke="rgba(0,0,0,0.45)" stroke-width="0.9"/><ellipse cx="16" cy="5" rx="5" ry="2.2" fill="{c2}" opacity="0.35"/><line x1="10" y1="19" x2="22" y2="19" stroke="{c2}" stroke-width="0.8" opacity="0.5"/>`,
front_hd:`<path d="M12,-1 Q16,-6 20,-1" stroke="{c}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M13,-3 Q16,-9 19,-3 Q16,-6 13,-3 Z" fill="{c2}" opacity="0.92"/><path d="M16,-9 L16,-14" stroke="{c2}" stroke-width="1.2" opacity="0.7"/><circle cx="16" cy="-14" r="1.5" fill="{c2}" opacity="0.9"/>`,
iso:`<path d="M7,16 Q7,3 16,1 Q25,3 25,16 Q22,18 16,19 Q10,18 7,16 Z" fill="{c}"/><path d="M9,15 L9,12 Q9,10 16,10 Q23,10 23,12 L23,15" fill="{c2}" opacity="0.8"/><line x1="9" y1="13" x2="23" y2="13" stroke="rgba(0,0,0,0.4)" stroke-width="0.8"/><ellipse cx="16" cy="4" rx="5" ry="2" fill="{c2}" opacity="0.3"/>`,
iso_hd:`<path d="M12,-1 Q16,-6 20,-1" stroke="{c}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M13,-3 Q16,-9 19,-3 Q16,-6 13,-3 Z" fill="{c2}" opacity="0.92"/><path d="M16,-9 L16,-13" stroke="{c2}" stroke-width="1.2" opacity="0.7"/><circle cx="16" cy="-13" r="1.4" fill="{c2}" opacity="0.9"/>`},

{id:'h_mag',nome:'🎩 Chapéu Arcano',estilo:'ff_hd',
front:`<path d="M7,19 Q7,5 16,3 Q25,5 25,19 Q22,21 16,22 Q10,21 7,19 Z" fill="{c2}" opacity="0.65"/><path d="M4,14 Q16,17 28,14 Q22,19 16,20 Q10,19 4,14 Z" fill="{c}"/><path d="M10,14 Q12,10 16,8 Q20,10 22,14" fill="{c}"/><path d="M16,8 L14.5,-18 L16,-24 L17.5,-18 Z" fill="{c}"/><path d="M3.5,14 Q16,17.5 28.5,14" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.5"/>`,
front_hd:`<path d="M16,-24 L14.5,-18 Q16,-21 17.5,-18 L16,-24 Z" fill="{c2}" opacity="0.9"/><circle cx="16" cy="-24" r="1.8" fill="{c2}" opacity="0.95"/><path d="M15,-19 Q16,-23 17,-19" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.7"/><path d="M14,-13 Q16,-17 18,-13" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/>`,
iso:`<path d="M7,16 Q7,4 16,2 Q25,4 25,16 Q22,18 16,18 Q10,18 7,16 Z" fill="{c2}" opacity="0.65"/><path d="M4,12 Q16,15 28,12 Q22,17 16,17 Q10,17 4,12 Z" fill="{c}"/><path d="M10,12 Q12,8 16,6 Q20,8 22,12" fill="{c}"/><path d="M16,6 L14.5,-16 L16,-22 L17.5,-16 Z" fill="{c}"/>`,
iso_hd:`<circle cx="16" cy="-22" r="1.7" fill="{c2}" opacity="0.95"/><path d="M15,-17 Q16,-21 17,-17" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.7"/><path d="M14,-11 Q16,-15 18,-11" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/>`},

{id:'h_lad',nome:'🎭 Capuz Sombrio',estilo:'ff_hd',
front:`<path d="M5,21 Q5,2 16,0 Q27,2 27,21 Q23,23 16,24 Q9,23 5,21 Z" fill="{c}"/><path d="M8,17 Q8,10 16,8 Q24,10 24,17 Q24,21 16,22 Q8,21 8,17 Z" fill="{c}" opacity="0.88"/><path d="M10,15 Q16,13 22,15 Q22,20 16,21 Q10,20 10,15 Z" fill="rgba(0,0,0,0.38)"/>`,
front_hd:`<path d="M5,3 Q3,-4 5,-12 Q10,-5 10,2 Z" fill="{c}" opacity="0.85"/><path d="M27,3 Q29,-4 27,-12 Q22,-5 22,2 Z" fill="{c}" opacity="0.85"/><path d="M5,-8 Q4,-14 6,-18 Q9,-12 8,-6 Z" fill="{c}" opacity="0.7"/><path d="M27,-8 Q28,-14 26,-18 Q23,-12 24,-6 Z" fill="{c}" opacity="0.7"/>`,
iso:`<path d="M5,18 Q5,2 16,0 Q27,2 27,18 Q23,20 16,21 Q9,20 5,18 Z" fill="{c}"/><path d="M8,14 Q8,8 16,6 Q24,8 24,14 Q24,18 16,19 Q8,18 8,14 Z" fill="{c}" opacity="0.88"/><path d="M10,13 Q16,11 22,13 Q22,17 16,18 Q10,17 10,13 Z" fill="rgba(0,0,0,0.38)"/>`,
iso_hd:`<path d="M5,3 Q3,-4 5,-12 Q10,-5 10,2 Z" fill="{c}" opacity="0.85"/><path d="M27,3 Q29,-4 27,-12 Q22,-5 22,2 Z" fill="{c}" opacity="0.85"/>`},

{id:'h_bar',nome:'💪 Crista Bárbara',estilo:'ff_hd',
front:`<path d="M7,18 Q7,4 16,2 Q25,4 25,18 Q22,21 16,21 Q10,21 7,18 Z" fill="{c}"/><path d="M13,2 Q14,-1 15,-5 Q16,-7 17,-5 Q18,-1 19,2" stroke="{c2}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
front_hd:`<path d="M12,1 Q13,-5 14,-13 Q15,-17 16,-21 Q17,-17 18,-13 Q19,-5 20,1" stroke="{c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M13.5,-12 Q15,-18 16,-22 Q17,-18 18.5,-12" stroke="{c2}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"/><path d="M11,0 Q10,-4 10,-8" stroke="{c}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/><path d="M21,0 Q22,-4 22,-8" stroke="{c}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>`,
iso:`<path d="M7,16 Q7,4 16,2 Q25,4 25,16 Q22,18 16,19 Q10,18 7,16 Z" fill="{c}"/><path d="M13,2 Q14,-1 15,-4 Q16,-6 17,-4 Q18,-1 19,2" stroke="{c2}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
iso_hd:`<path d="M12,1 Q13,-5 14,-12 Q15,-16 16,-20 Q17,-16 18,-12 Q19,-5 20,1" stroke="{c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M13.5,-11 Q15,-17 16,-21 Q17,-17 18.5,-11" stroke="{c2}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"/>`},

{id:'h_dru',nome:'🌿 Coroa de Galhos',estilo:'ff_hd',
front:`<path d="M7,18 Q7,3 16,2 Q25,3 25,18 Q22,21 16,21 Q10,21 7,18 Z" fill="{c}"/><path d="M9,10 Q11,8 13,6" stroke="{c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M23,10 Q21,8 19,6" stroke="{c2}" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="16" cy="4" rx="4.5" ry="2" fill="{c}" stroke="{c2}" stroke-width="0.7"/>`,
front_hd:`<path d="M9,2 Q5,-5 3,-14 Q7,-8 10,-1 Z" fill="{c}"/><path d="M5,-10 Q3,-16 5,-21 Q8,-15 7,-8 Z" fill="{c}"/><path d="M23,2 Q27,-5 29,-14 Q25,-8 22,-1 Z" fill="{c}"/><path d="M27,-10 Q29,-16 27,-21 Q24,-15 25,-8 Z" fill="{c}"/><path d="M14,1 Q13,-7 12,-15 Q16,-10 14,1 Z" fill="{c}"/><path d="M18,1 Q19,-7 20,-15 Q16,-10 18,1 Z" fill="{c}"/><circle cx="3" cy="-14" r="1.1" fill="{c2}" opacity="0.92"/><circle cx="5" cy="-20" r="0.85" fill="{c2}" opacity="0.85"/><circle cx="29" cy="-14" r="1.1" fill="{c2}" opacity="0.92"/><circle cx="27" cy="-20" r="0.85" fill="{c2}" opacity="0.85"/>`,
iso:`<path d="M7,16 Q7,3 16,2 Q25,3 25,16 Q22,18 16,19 Q10,18 7,16 Z" fill="{c}"/><path d="M9,9 Q11,7 13,5" stroke="{c2}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M23,9 Q21,7 19,5" stroke="{c2}" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="16" cy="3" rx="4" ry="1.8" fill="{c}" stroke="{c2}" stroke-width="0.6"/>`,
iso_hd:`<path d="M9,2 Q5,-5 3,-14 Q7,-8 10,-1 Z" fill="{c}"/><path d="M5,-10 Q3,-16 5,-21 Q8,-15 7,-8 Z" fill="{c}"/><path d="M23,2 Q27,-5 29,-14 Q25,-8 22,-1 Z" fill="{c}"/><path d="M27,-10 Q29,-16 27,-21 Q24,-15 25,-8 Z" fill="{c}"/><path d="M14,0 Q13,-7 12,-15 Q16,-10 14,0 Z" fill="{c}"/><path d="M18,0 Q19,-7 20,-15 Q16,-10 18,0 Z" fill="{c}"/>`},

{id:'h_nec',nome:'💀 Capuz Espectral',estilo:'ff_hd',
front:`<path d="M4,22 Q4,1 16,-1 Q28,1 28,22 Q24,24 16,25 Q8,24 4,22 Z" fill="{c}"/><path d="M8,19 Q8,11 16,9 Q24,11 24,19 Q24,23 16,24 Q8,23 8,19 Z" fill="{c}" opacity="0.9"/><path d="M10,17 Q16,15 22,17 Q22,22 16,23 Q10,22 10,17 Z" fill="rgba(0,0,0,0.52)"/><ellipse cx="12.5" cy="18" rx="2.2" ry="1.9" fill="{c2}" opacity="0.7"/><ellipse cx="19.5" cy="18" rx="2.2" ry="1.9" fill="{c2}" opacity="0.7"/>`,
front_hd:`<path d="M4,5 Q2,-4 4,-13 Q5,-2 8,-3 Z" fill="{c}" opacity="0.88"/><path d="M28,5 Q30,-4 28,-13 Q27,-2 24,-3 Z" fill="{c}" opacity="0.88"/><path d="M4,-9 Q1,-16 3,-23 Q7,-15 6,-7 Z" fill="{c}" opacity="0.75"/><path d="M28,-9 Q31,-16 29,-23 Q25,-15 26,-7 Z" fill="{c}" opacity="0.75"/>`,
iso:`<path d="M4,19 Q4,1 16,-1 Q28,1 28,19 Q24,21 16,22 Q8,21 4,19 Z" fill="{c}"/><path d="M8,16 Q8,9 16,7 Q24,9 24,16 Q24,20 16,21 Q8,20 8,16 Z" fill="{c}" opacity="0.9"/><path d="M10,15 Q16,13 22,15 Q22,19 16,20 Q10,19 10,15 Z" fill="rgba(0,0,0,0.52)"/><ellipse cx="12.5" cy="16" rx="2" ry="1.7" fill="{c2}" opacity="0.7"/><ellipse cx="19.5" cy="16" rx="2" ry="1.7" fill="{c2}" opacity="0.7"/>`,
iso_hd:`<path d="M4,4 Q2,-4 4,-13 Q5,-2 8,-3 Z" fill="{c}" opacity="0.88"/><path d="M28,4 Q30,-4 28,-13 Q27,-2 24,-3 Z" fill="{c}" opacity="0.88"/>`}

);

// ═══ ROSTOS ════════════════════════════════════════════════════════════════
APMOD_PARTS.rosto.push(

{id:'f_gue',nome:'⚔ Olhos de Aço',estilo:'ff_hd',
front:`<path d="M10.5,8 Q12.5,7 14.5,8" stroke="{c2}" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M17.5,8 Q19.5,7 21.5,8" stroke="{c2}" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="12.5" cy="11" rx="2.5" ry="2" fill="{c}" opacity="0.95"/><ellipse cx="19.5" cy="11" rx="2.5" ry="2" fill="{c}" opacity="0.95"/><circle cx="12.5" cy="11" r="1.1" fill="{c2}"/><circle cx="19.5" cy="11" r="1.1" fill="{c2}"/><circle cx="12.1" cy="10.5" r="0.5" fill="white" opacity="0.9"/><circle cx="19.1" cy="10.5" r="0.5" fill="white" opacity="0.9"/><path d="M13.5,15.5 Q16,16.5 18.5,15.5" stroke="{c2}" stroke-width="0.9" fill="none" opacity="0.7"/>`,
iso:`<ellipse cx="12.5" cy="11" rx="2.3" ry="1.9" fill="{c}" opacity="0.95"/><ellipse cx="19.5" cy="11" rx="2.3" ry="1.9" fill="{c}" opacity="0.95"/><circle cx="12.5" cy="11" r="1" fill="{c2}"/><circle cx="19.5" cy="11" r="1" fill="{c2}"/><circle cx="12.1" cy="10.6" r="0.45" fill="white" opacity="0.9"/><circle cx="19.1" cy="10.6" r="0.45" fill="white" opacity="0.9"/><path d="M10.5,8 Q12.5,7 14.5,8" stroke="{c2}" stroke-width="1.2" fill="none"/><path d="M17.5,8 Q19.5,7 21.5,8" stroke="{c2}" stroke-width="1.2" fill="none"/>`},

{id:'f_mag',nome:'✨ Olhos Arcanos',estilo:'ff_hd',
front:`<path d="M10,9.5 Q12.5,8 15,9.5" stroke="{c2}" stroke-width="0.8" fill="none" stroke-linecap="round"/><path d="M17,9.5 Q19.5,8 22,9.5" stroke="{c2}" stroke-width="0.8" fill="none" stroke-linecap="round"/><ellipse cx="12.5" cy="11.5" rx="2.8" ry="2.2" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11.5" rx="2.8" ry="2.2" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11.5" r="1.4" fill="{c2}"/><circle cx="19.5" cy="11.5" r="1.4" fill="{c2}"/><circle cx="12" cy="11" r="0.6" fill="white" opacity="0.95"/><circle cx="19" cy="11" r="0.6" fill="white" opacity="0.95"/><path d="M13,15.5 Q16,16.8 19,15.5" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.65"/>`,
iso:`<ellipse cx="12.5" cy="11" rx="2.5" ry="2" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11" rx="2.5" ry="2" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11" r="1.2" fill="{c2}"/><circle cx="19.5" cy="11" r="1.2" fill="{c2}"/><circle cx="12" cy="10.5" r="0.55" fill="white" opacity="0.95"/><circle cx="19" cy="10.5" r="0.55" fill="white" opacity="0.95"/>`},

{id:'f_lad',nome:'👁 Olhos Solertes',estilo:'ff_hd',
front:`<path d="M10,10.5 Q12.5,9 15,10.5" stroke="{c2}" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M17,10.5 Q19.5,9 22,10.5" stroke="{c2}" stroke-width="1" fill="none" stroke-linecap="round"/><ellipse cx="12.5" cy="12" rx="2.2" ry="1.6" fill="{c}" opacity="0.95"/><ellipse cx="19.5" cy="12" rx="2.2" ry="1.6" fill="{c}" opacity="0.95"/><circle cx="12.5" cy="12" r="0.9" fill="{c2}"/><circle cx="19.5" cy="12" r="0.9" fill="{c2}"/><circle cx="12.1" cy="11.6" r="0.4" fill="white" opacity="0.9"/><circle cx="19.1" cy="11.6" r="0.4" fill="white" opacity="0.9"/>`,
iso:`<ellipse cx="12.5" cy="11" rx="2" ry="1.5" fill="{c}" opacity="0.95"/><ellipse cx="19.5" cy="11" rx="2" ry="1.5" fill="{c}" opacity="0.95"/><circle cx="12.5" cy="11" r="0.8" fill="{c2}"/><circle cx="19.5" cy="11" r="0.8" fill="{c2}"/><path d="M10,10 Q12.5,8.8 15,10" stroke="{c2}" stroke-width="0.9" fill="none"/><path d="M17,10 Q19.5,8.8 22,10" stroke="{c2}" stroke-width="0.9" fill="none"/>`},

{id:'f_bar',nome:'💢 Olhos Ferozes',estilo:'ff_hd',
front:`<path d="M10,8.5 Q12.5,7 15,8.5 L14,10 Q12.5,8.8 11,10 Z" fill="{c2}" opacity="0.95"/><path d="M17,8.5 Q19.5,7 22,8.5 L21,10 Q19.5,8.8 18,10 Z" fill="{c2}" opacity="0.95"/><ellipse cx="12.5" cy="11.5" rx="2.4" ry="2" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11.5" rx="2.4" ry="2" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11.5" r="1.2" fill="{c2}"/><circle cx="19.5" cy="11.5" r="1.2" fill="{c2}"/><circle cx="12" cy="11" r="0.55" fill="white" opacity="0.9"/><circle cx="19" cy="11" r="0.55" fill="white" opacity="0.9"/><path d="M17.5,7.5 L21.5,12.5" stroke="{c2}" stroke-width="0.85" fill="none" opacity="0.65"/>`,
iso:`<path d="M10,8.5 Q12.5,7 15,8.5 L14,10 Q12.5,8.8 11,10 Z" fill="{c2}" opacity="0.9"/><path d="M17,8.5 Q19.5,7 22,8.5 L21,10 Q19.5,8.8 18,10 Z" fill="{c2}" opacity="0.9"/><ellipse cx="12.5" cy="11" rx="2.2" ry="1.9" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11" rx="2.2" ry="1.9" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11" r="1.1" fill="{c2}"/><circle cx="19.5" cy="11" r="1.1" fill="{c2}"/>`},

{id:'f_dru',nome:'🌿 Olhos Calmos',estilo:'ff_hd',
front:`<path d="M10,9.5 Q12.5,8.2 15,9.5" stroke="{c2}" stroke-width="0.9" fill="none" stroke-linecap="round"/><path d="M17,9.5 Q19.5,8.2 22,9.5" stroke="{c2}" stroke-width="0.9" fill="none" stroke-linecap="round"/><ellipse cx="12.5" cy="11.8" rx="2.6" ry="2.1" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11.8" rx="2.6" ry="2.1" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11.8" r="1.3" fill="{c2}"/><circle cx="19.5" cy="11.8" r="1.3" fill="{c2}"/><circle cx="12" cy="11.3" r="0.6" fill="white" opacity="0.92"/><circle cx="19" cy="11.3" r="0.6" fill="white" opacity="0.92"/><path d="M13.5,15.5 Q16,16.5 18.5,15.5" stroke="{c2}" stroke-width="0.9" fill="none" opacity="0.7"/>`,
iso:`<ellipse cx="12.5" cy="11" rx="2.4" ry="2" fill="{c}" opacity="0.92"/><ellipse cx="19.5" cy="11" rx="2.4" ry="2" fill="{c}" opacity="0.92"/><circle cx="12.5" cy="11" r="1.2" fill="{c2}"/><circle cx="19.5" cy="11" r="1.2" fill="{c2}"/><circle cx="12" cy="10.5" r="0.55" fill="white" opacity="0.92"/><circle cx="19" cy="10.5" r="0.55" fill="white" opacity="0.92"/>`},

{id:'f_nec',nome:'💀 Olhos Espectrais',estilo:'ff_hd',
front:`<ellipse cx="12.5" cy="11.2" rx="3" ry="2.5" fill="rgba(0,0,0,0.82)"/><ellipse cx="19.5" cy="11.2" rx="3" ry="2.5" fill="rgba(0,0,0,0.82)"/><ellipse cx="12.5" cy="11.2" rx="2.1" ry="1.8" fill="{c}" opacity="0.72"/><ellipse cx="19.5" cy="11.2" rx="2.1" ry="1.8" fill="{c}" opacity="0.72"/><circle cx="12.5" cy="11.2" r="0.9" fill="{c2}" opacity="0.92"/><circle cx="19.5" cy="11.2" r="0.9" fill="{c2}" opacity="0.92"/><path d="M10,10 Q12.5,9.2 15,10" stroke="rgba(0,0,0,0.65)" stroke-width="1.3" fill="none"/><path d="M17,10 Q19.5,9.2 22,10" stroke="rgba(0,0,0,0.65)" stroke-width="1.3" fill="none"/>`,
iso:`<ellipse cx="12.5" cy="11" rx="2.8" ry="2.3" fill="rgba(0,0,0,0.82)"/><ellipse cx="19.5" cy="11" rx="2.8" ry="2.3" fill="rgba(0,0,0,0.82)"/><ellipse cx="12.5" cy="11" rx="1.9" ry="1.6" fill="{c}" opacity="0.72"/><ellipse cx="19.5" cy="11" rx="1.9" ry="1.6" fill="{c}" opacity="0.72"/><circle cx="12.5" cy="11" r="0.8" fill="{c2}" opacity="0.92"/><circle cx="19.5" cy="11" r="0.8" fill="{c2}" opacity="0.92"/>`}

);

// ═══ CAMISAS / TORSO ════════════════════════════════════════════════════════
APMOD_PARTS.camisa.push(

{id:'c_gue',nome:'⚔ Peitoral de Placa',estilo:'ff_hd',
front:`<path d="M5,21 Q0,23 0,35 Q0,43 4,46 Q8,47 11,44 Q12,40 12,34 Q11,25 5,21 Z" fill="{c}"/><path d="M27,21 Q32,23 32,35 Q32,43 28,46 Q24,47 21,44 Q20,40 20,34 Q21,25 27,21 Z" fill="{c}"/><path d="M5,21 Q4,22 4,40 Q4,46 16,47 Q28,46 28,40 Q28,22 27,21 Q20,17 16,18 Q12,17 5,21 Z" fill="{c}"/><line x1="16" y1="21" x2="16" y2="45" stroke="{c2}" stroke-width="0.7" opacity="0.48"/><ellipse cx="16" cy="27" rx="3.5" ry="3" fill="{c2}" opacity="0.88"/><ellipse cx="16" cy="27" rx="2.3" ry="2" fill="{c}"/>`,
front_hd:`<path d="M4,21 Q-4,18 -7,23 Q-11,29 -7,35 Q-3,38 2,36 Q6,32 5,25 Z" fill="{c}"/><path d="M-6,24 Q-8,29 -7,34" stroke="{c2}" stroke-width="1.2" fill="none" opacity="0.6"/><path d="M28,21 Q36,18 39,23 Q43,29 39,35 Q35,38 30,36 Q26,32 27,25 Z" fill="{c}"/><path d="M38,24 Q40,29 39,34" stroke="{c2}" stroke-width="1.2" fill="none" opacity="0.6"/>`,
iso:`<path d="M5,21 Q0,23 0,32 Q0,40 4,42 Q8,43 11,40 Q12,37 12,31 Q11,24 5,21 Z" fill="{c}"/><path d="M27,21 Q32,23 32,32 Q32,40 28,42 Q24,43 21,40 Q20,37 20,31 Q21,24 27,21 Z" fill="{c}"/><path d="M5,21 Q4,22 4,37 Q4,42 16,43 Q28,42 28,37 Q28,22 27,21 Q20,17 16,18 Q12,17 5,21 Z" fill="{c}"/><line x1="16" y1="21" x2="16" y2="41" stroke="{c2}" stroke-width="0.7" opacity="0.48"/><ellipse cx="16" cy="27" rx="3.2" ry="2.5" fill="{c2}" opacity="0.88"/><ellipse cx="16" cy="27" rx="2.1" ry="1.7" fill="{c}"/>`,
iso_hd:`<path d="M4,21 Q-4,18 -7,23 Q-11,28 -7,33 Q-3,36 2,34 Q6,30 5,24 Z" fill="{c}"/><path d="M28,21 Q36,18 39,23 Q43,28 39,33 Q35,36 30,34 Q26,30 27,24 Z" fill="{c}"/>`},

{id:'c_mag',nome:'🔮 Vestes Arcanas',estilo:'ff_hd',
front:`<path d="M3,19 Q-1,22 -1,37 Q-1,47 5,49 Q10,50 12,45 Q13,38 12,29 Q8,23 3,19 Z" fill="{c}"/><path d="M29,19 Q33,22 33,37 Q33,47 27,49 Q22,50 20,45 Q19,38 20,29 Q24,23 29,19 Z" fill="{c}"/><path d="M3,19 Q2,22 3,44 Q4,48 16,49 Q28,48 29,44 Q30,22 29,19 Q22,16 16,17 Q10,16 3,19 Z" fill="{c}"/><line x1="16" y1="20" x2="16" y2="47" stroke="{c2}" stroke-width="0.6" opacity="0.38"/><circle cx="16" cy="25" r="2.5" fill="{c2}" opacity="0.82"/><circle cx="16" cy="25" r="1.5" fill="{c}"/><circle cx="16" cy="25" r="0.7" fill="{c2}" opacity="0.9"/>`,
front_hd:`<path d="M-1,37 Q-4,39 -5,46 Q-4,50 -1,49 Q2,48 2,43 Q2,39 -1,37 Z" fill="{c}"/><path d="M33,37 Q36,39 37,46 Q36,50 33,49 Q30,48 30,43 Q30,39 33,37 Z" fill="{c}"/>`,
iso:`<path d="M3,19 Q-1,21 -1,34 Q-1,43 5,45 Q10,46 12,41 Q13,35 12,27 Q8,22 3,19 Z" fill="{c}"/><path d="M29,19 Q33,21 33,34 Q33,43 27,45 Q22,46 20,41 Q19,35 20,27 Q24,22 29,19 Z" fill="{c}"/><path d="M3,19 Q2,22 3,40 Q4,44 16,45 Q28,44 29,40 Q30,22 29,19 Q22,16 16,17 Q10,16 3,19 Z" fill="{c}"/><line x1="16" y1="20" x2="16" y2="43" stroke="{c2}" stroke-width="0.6" opacity="0.38"/><circle cx="16" cy="25" r="2.2" fill="{c2}" opacity="0.82"/><circle cx="16" cy="25" r="1.3" fill="{c}"/>`,
iso_hd:`<path d="M-1,34 Q-4,36 -5,42 Q-4,46 -1,45 Q2,44 2,39 Q2,35 -1,34 Z" fill="{c}"/><path d="M33,34 Q36,36 37,42 Q36,46 33,45 Q30,44 30,39 Q30,35 33,34 Z" fill="{c}"/>`},

{id:'c_lad',nome:'🗡 Couro Sombrio',estilo:'ff_hd',
front:`<path d="M7,21 Q3,24 2,33 Q2,41 5,44 Q8,46 10,43 Q12,40 12,33 Q11,26 7,21 Z" fill="{c}"/><path d="M25,21 Q29,24 30,33 Q30,41 27,44 Q24,46 22,43 Q20,40 20,33 Q21,26 25,21 Z" fill="{c}"/><path d="M7,21 Q5,23 5,41 Q6,46 16,47 Q26,46 27,41 Q27,23 25,21 Q20,18 16,18 Q12,18 7,21 Z" fill="{c}"/><path d="M12,23 Q16,22 20,23" stroke="{c2}" stroke-width="1" fill="none" opacity="0.5"/><path d="M12,23 Q13,26 13,44" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.44"/><path d="M20,23 Q19,26 19,44" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.44"/>`,
front_hd:`<path d="M36,25 Q38,27 39,36 Q38,42 36,44 Q34,42 34,36 Q34,29 36,25 Z" fill="{c}" opacity="0.92"/><path d="M36,25 L38,14 L36.5,17 L35,14 L37,25 Z" fill="{c2}" opacity="0.92"/>`,
iso:`<path d="M7,21 Q3,23 2,31 Q2,39 5,42 Q8,43 10,40 Q12,37 12,31 Q11,24 7,21 Z" fill="{c}"/><path d="M25,21 Q29,23 30,31 Q30,39 27,42 Q24,43 22,40 Q20,37 20,31 Q21,24 25,21 Z" fill="{c}"/><path d="M7,21 Q5,23 5,38 Q6,42 16,43 Q26,42 27,38 Q27,23 25,21 Q20,18 16,18 Q12,18 7,21 Z" fill="{c}"/><path d="M12,23 Q16,22 20,23" stroke="{c2}" stroke-width="1" fill="none" opacity="0.5"/>`,
iso_hd:`<path d="M36,23 Q38,25 39,34 Q38,40 36,42 Q34,40 34,34 Q34,27 36,23 Z" fill="{c}" opacity="0.92"/><path d="M36,23 L38,12 L36.5,15 L35,12 L37,23 Z" fill="{c2}" opacity="0.92"/>`},

{id:'c_bar',nome:'💪 Tronco Bárbaro',estilo:'ff_hd',
front:`<path d="M5,21 Q0,23 -1,33 Q-1,41 3,44 Q7,45 11,42 Q13,38 13,31 Q12,25 5,21 Z" fill="{c}"/><path d="M27,21 Q32,23 33,33 Q33,41 29,44 Q25,45 21,42 Q19,38 19,31 Q20,25 27,21 Z" fill="{c}"/><path d="M5,21 Q4,23 5,41 Q6,46 16,47 Q26,46 27,41 Q28,23 27,21 Q21,17 16,18 Q11,17 5,21 Z" fill="{c}"/><path d="M8,27 Q16,29 24,27" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.38"/><path d="M2,31 Q1,37 2,43" stroke="{c2}" stroke-width="1.3" fill="none" opacity="0.48"/><path d="M30,31 Q31,37 30,43" stroke="{c2}" stroke-width="1.3" fill="none" opacity="0.48"/>`,
front_hd:`<path d="M4,21 Q-4,19 -7,24 Q-11,30 -6,36 Q-2,39 3,36 Q7,32 6,25 Z" fill="{c}"/><path d="M-6,25 Q-8,30 -7,35" stroke="{c2}" stroke-width="1.2" fill="none" opacity="0.5"/><path d="M28,21 Q36,19 39,24 Q43,30 38,36 Q34,39 29,36 Q25,32 26,25 Z" fill="{c}"/><path d="M38,25 Q40,30 39,35" stroke="{c2}" stroke-width="1.2" fill="none" opacity="0.5"/>`,
iso:`<path d="M5,21 Q0,23 -1,31 Q-1,38 3,41 Q7,42 11,39 Q13,36 13,30 Q12,24 5,21 Z" fill="{c}"/><path d="M27,21 Q32,23 33,31 Q33,38 29,41 Q25,42 21,39 Q19,36 19,30 Q20,24 27,21 Z" fill="{c}"/><path d="M5,21 Q4,23 5,37 Q6,42 16,43 Q26,42 27,37 Q28,23 27,21 Q21,17 16,18 Q11,17 5,21 Z" fill="{c}"/><path d="M8,27 Q16,29 24,27" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.38"/>`,
iso_hd:`<path d="M4,21 Q-4,18 -7,23 Q-11,28 -6,34 Q-2,37 3,34 Q7,30 6,24 Z" fill="{c}"/><path d="M28,21 Q36,18 39,23 Q43,28 38,34 Q34,37 29,34 Q25,30 26,24 Z" fill="{c}"/>`},

{id:'c_dru',nome:'🌿 Manto Druídico',estilo:'ff_hd',
front:`<path d="M5,20 Q1,23 1,36 Q1,45 6,47 Q10,48 12,44 Q13,39 12,31 Q9,25 5,20 Z" fill="{c}"/><path d="M27,20 Q31,23 31,36 Q31,45 26,47 Q22,48 20,44 Q19,39 20,31 Q23,25 27,20 Z" fill="{c}"/><path d="M5,20 Q4,22 5,43 Q6,47 16,48 Q26,47 27,43 Q28,22 27,20 Q21,17 16,18 Q11,17 5,20 Z" fill="{c}"/><circle cx="8" cy="29" r="1.1" fill="{c2}" opacity="0.52"/><circle cx="24" cy="29" r="1.1" fill="{c2}" opacity="0.52"/>`,
front_hd:`<path d="M4,20 Q-2,20 -5,25 Q-8,31 -4,37 Q0,40 4,37 Q8,33 7,26 Z" fill="{c}"/><path d="M28,20 Q34,20 37,25 Q40,31 36,37 Q32,40 28,37 Q24,33 25,26 Z" fill="{c}"/>`,
iso:`<path d="M5,20 Q1,22 1,33 Q1,41 6,43 Q10,44 12,40 Q13,36 12,29 Q9,24 5,20 Z" fill="{c}"/><path d="M27,20 Q31,22 31,33 Q31,41 26,43 Q22,44 20,40 Q19,36 20,29 Q23,24 27,20 Z" fill="{c}"/><path d="M5,20 Q4,22 5,39 Q6,43 16,44 Q26,43 27,39 Q28,22 27,20 Q21,17 16,18 Q11,17 5,20 Z" fill="{c}"/><circle cx="8" cy="27" r="1" fill="{c2}" opacity="0.5"/><circle cx="24" cy="27" r="1" fill="{c2}" opacity="0.5"/>`,
iso_hd:`<path d="M4,20 Q-2,19 -5,24 Q-8,29 -4,35 Q0,38 4,35 Q8,31 7,25 Z" fill="{c}"/><path d="M28,20 Q34,19 37,24 Q40,29 36,35 Q32,38 28,35 Q24,31 25,25 Z" fill="{c}"/>`},

{id:'c_nec',nome:'💀 Mortalha Espectral',estilo:'ff_hd',
front:`<path d="M3,19 Q-2,23 -2,38 Q-2,47 5,49 Q10,50 12,45 Q13,39 12,29 Q8,23 3,19 Z" fill="{c}"/><path d="M29,19 Q34,23 34,38 Q34,47 27,49 Q22,50 20,45 Q19,39 20,29 Q24,23 29,19 Z" fill="{c}"/><path d="M3,19 Q2,22 3,44 Q4,48 16,49 Q28,48 29,44 Q30,22 29,19 Q22,16 16,17 Q10,16 3,19 Z" fill="{c}"/><line x1="16" y1="20" x2="16" y2="47" stroke="{c2}" stroke-width="0.6" opacity="0.38"/><ellipse cx="16" cy="26" rx="2.5" ry="2.1" fill="{c2}" opacity="0.72"/>`,
front_hd:`<path d="M2,19 Q-6,19 -10,25 Q-14,32 -9,39 Q-5,42 0,39 Q4,35 3,27 Z" fill="{c}"/><path d="M30,19 Q38,19 42,25 Q46,32 41,39 Q37,42 32,39 Q28,35 29,27 Z" fill="{c}"/>`,
iso:`<path d="M3,19 Q-2,22 -2,35 Q-2,43 5,45 Q10,46 12,41 Q13,36 12,28 Q8,22 3,19 Z" fill="{c}"/><path d="M29,19 Q34,22 34,35 Q34,43 27,45 Q22,46 20,41 Q19,36 20,28 Q24,22 29,19 Z" fill="{c}"/><path d="M3,19 Q2,22 3,41 Q4,44 16,45 Q28,44 29,41 Q30,22 29,19 Q22,16 16,17 Q10,16 3,19 Z" fill="{c}"/><ellipse cx="16" cy="26" rx="2.3" ry="2" fill="{c2}" opacity="0.72"/>`,
iso_hd:`<path d="M2,19 Q-6,18 -10,24 Q-14,30 -9,37 Q-5,40 0,37 Q4,33 3,26 Z" fill="{c}"/><path d="M30,19 Q38,18 42,24 Q46,30 41,37 Q37,40 32,37 Q28,33 29,26 Z" fill="{c}"/>`}

);

// ═══ CALÇAS ═════════════════════════════════════════════════════════════════
APMOD_PARTS.calca.push(

{id:'cl_gue',nome:'⚔ Grevas de Placa',estilo:'ff_hd',
front:`<path d="M4,44 Q3,55 3,63 Q3,67 7,68 Q11,68 14,67 Q16,64 15,55 Q15,48 16,44 Z" fill="{c}"/><path d="M28,44 Q29,55 29,63 Q29,67 25,68 Q21,68 18,67 Q16,64 17,55 Q17,48 16,44 Z" fill="{c}"/><path d="M4,50 Q8,52 14,50" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/><path d="M18,50 Q22,52 28,50" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/>`,
iso:`<path d="M4,38 Q3,47 3,53 Q3,56 7,57 Q11,57 14,56 Q16,53 15,46 Q15,41 16,38 Z" fill="{c}"/><path d="M28,38 Q29,47 29,53 Q29,56 25,57 Q21,57 18,56 Q16,53 17,46 Q17,41 16,38 Z" fill="{c}"/><path d="M4,44 Q8,45 14,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/><path d="M18,44 Q22,45 28,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/>`},

{id:'cl_mag',nome:'🔮 Veste Longa',estilo:'ff_hd',
front:`<path d="M1,44 Q0,55 1,63 Q2,68 7,68 Q13,68 15,60 Q16,52 16,44 Z" fill="{c}"/><path d="M31,44 Q32,55 31,63 Q30,68 25,68 Q19,68 17,60 Q16,52 16,44 Z" fill="{c}"/><path d="M3,49 Q8,51 14,49" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.38"/><path d="M18,49 Q23,51 29,49" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.38"/>`,
iso:`<path d="M1,38 Q0,47 1,53 Q2,57 7,57 Q13,57 15,51 Q16,44 16,38 Z" fill="{c}"/><path d="M31,38 Q32,47 31,53 Q30,57 25,57 Q19,57 17,51 Q16,44 16,38 Z" fill="{c}"/><path d="M3,43 Q9,45 14,43" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.35"/><path d="M18,43 Q23,45 29,43" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.35"/>`},

{id:'cl_lad',nome:'🗡 Calça Sombria',estilo:'ff_hd',
front:`<path d="M6,44 Q5,55 5,63 Q5,67 8,68 Q12,68 15,67 Q16,63 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M26,44 Q27,55 27,63 Q27,67 24,68 Q20,68 17,67 Q16,63 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M7,51 Q11,52 15,51" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.4"/><path d="M17,51 Q21,52 25,51" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.4"/>`,
iso:`<path d="M6,38 Q5,47 5,53 Q5,56 8,57 Q12,57 15,56 Q16,52 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M26,38 Q27,47 27,53 Q27,56 24,57 Q20,57 17,56 Q16,52 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M7,44 Q11,45 15,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/><path d="M17,44 Q21,45 25,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/>`},

{id:'cl_bar',nome:'💪 Calças Bárbaras',estilo:'ff_hd',
front:`<path d="M4,44 Q3,53 3,61 Q3,66 7,67 Q11,68 15,66 Q17,62 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M28,44 Q29,53 29,61 Q29,66 25,67 Q21,68 17,66 Q15,62 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M5,49 Q16,51 27,49" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.4"/><path d="M6,62 Q9,64 14,62" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.4"/><path d="M18,62 Q22,64 26,62" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.4"/>`,
iso:`<path d="M4,38 Q3,47 3,53 Q3,57 7,57 Q11,58 15,56 Q17,53 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M28,38 Q29,47 29,53 Q29,57 25,57 Q21,58 17,56 Q15,53 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M5,44 Q16,46 27,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.4"/>`},

{id:'cl_dru',nome:'🌿 Calça Natural',estilo:'ff_hd',
front:`<path d="M6,44 Q5,54 5,62 Q5,66 8,68 Q12,68 15,66 Q16,62 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M26,44 Q27,54 27,62 Q27,66 24,68 Q20,68 17,66 Q16,62 16,52 Q16,46 16,44 Z" fill="{c}"/><path d="M7,49 Q10,51 14,49" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.42"/><path d="M18,49 Q21,51 25,49" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.42"/><circle cx="8" cy="51" r="0.9" fill="{c2}" opacity="0.52"/><circle cx="24" cy="51" r="0.9" fill="{c2}" opacity="0.52"/>`,
iso:`<path d="M6,38 Q5,47 5,53 Q5,56 8,57 Q12,57 15,55 Q16,51 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M26,38 Q27,47 27,53 Q27,56 24,57 Q20,57 17,55 Q16,51 16,45 Q16,40 16,38 Z" fill="{c}"/><path d="M7,44 Q10,46 14,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/><path d="M18,44 Q21,46 25,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/>`},

{id:'cl_nec',nome:'💀 Mortalha Inferior',estilo:'ff_hd',
front:`<path d="M1,44 Q0,55 1,63 Q2,68 6,68 Q12,69 15,61 Q16,52 16,44 Z" fill="{c}"/><path d="M31,44 Q32,55 31,63 Q30,68 26,68 Q20,69 17,61 Q16,52 16,44 Z" fill="{c}"/><path d="M3,50 Q8,52 14,50" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.33"/><path d="M18,50 Q23,52 29,50" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.33"/><ellipse cx="7" cy="53" rx="1.3" ry="1.1" fill="{c2}" opacity="0.5"/><ellipse cx="25" cy="53" rx="1.3" ry="1.1" fill="{c2}" opacity="0.5"/>`,
iso:`<path d="M1,38 Q0,47 1,53 Q2,57 6,57 Q12,58 15,52 Q16,45 16,38 Z" fill="{c}"/><path d="M31,38 Q32,47 31,53 Q30,57 26,57 Q20,58 17,52 Q16,45 16,38 Z" fill="{c}"/><path d="M3,44 Q8,46 14,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.33"/><path d="M18,44 Q23,46 29,44" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.33"/>`}

);

// ═══ SAPATOS ════════════════════════════════════════════════════════════════
APMOD_PARTS.sapato.push(

{id:'sp_gue',nome:'⚔ Sabatons de Placa',estilo:'ff_hd',
front:`<path d="M3,63 Q2,65 2,67 Q2,68 8,68 Q14,68 15,67 Q16,65 15,63 Z" fill="{c}"/><path d="M29,63 Q30,65 30,67 Q30,68 24,68 Q18,68 17,67 Q16,65 17,63 Z" fill="{c}"/><path d="M2,66 Q8,68 15,67" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.52"/><path d="M30,66 Q24,68 17,67" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.52"/>`,
iso:`<path d="M3,53 Q2,55 2,57 Q2,57 8,57 Q14,57 15,56 Q16,54 15,53 Z" fill="{c}"/><path d="M29,53 Q30,55 30,57 Q30,57 24,57 Q18,57 17,56 Q16,54 17,53 Z" fill="{c}"/><path d="M2,56 Q8,57 15,56" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.52"/><path d="M30,56 Q24,57 17,56" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.52"/>`},

{id:'sp_mag',nome:'🔮 Botas Arcanas',estilo:'ff_hd',
front:`<path d="M1,63 Q0,65 1,68 Q2,68 7,68 Q13,68 15,67 Q16,64 15,63 Z" fill="{c}"/><path d="M31,63 Q32,65 31,68 Q30,68 25,68 Q19,68 17,67 Q16,64 17,63 Z" fill="{c}"/><path d="M0,66 Q6,68 15,67" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.5"/><path d="M32,66 Q26,68 17,67" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.5"/>`,
iso:`<path d="M1,53 Q0,55 1,57 Q2,57 7,57 Q13,57 15,56 Q16,53 15,53 Z" fill="{c}"/><path d="M31,53 Q32,55 31,57 Q30,57 25,57 Q19,57 17,56 Q16,53 17,53 Z" fill="{c}"/><path d="M0,56 Q6,57 15,56" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.5"/><path d="M32,56 Q26,57 17,56" stroke="{c2}" stroke-width="0.6" fill="none" opacity="0.5"/>`},

{id:'sp_lad',nome:'🗡 Botas Silenciosas',estilo:'ff_hd',
front:`<path d="M5,63 Q4,65 5,67 Q5,68 9,68 Q14,68 15,67 Q16,64 16,63 Z" fill="{c}"/><path d="M27,63 Q28,65 27,67 Q27,68 23,68 Q18,68 17,67 Q16,64 16,63 Z" fill="{c}"/><path d="M5,66 Q10,68 15,67" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/><path d="M27,66 Q22,68 17,67" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/>`,
iso:`<path d="M5,53 Q4,55 5,57 Q5,57 9,57 Q14,57 15,56 Q16,53 16,53 Z" fill="{c}"/><path d="M27,53 Q28,55 27,57 Q27,57 23,57 Q18,57 17,56 Q16,53 16,53 Z" fill="{c}"/><path d="M5,56 Q10,57 15,56" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/><path d="M27,56 Q22,57 17,56" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.45"/>`},

{id:'sp_bar',nome:'💪 Botas Bárbaras',estilo:'ff_hd',
front:`<path d="M4,63 Q3,65 4,67 Q5,68 9,68 Q14,68 15,67 Q16,64 16,63 Z" fill="{c}"/><path d="M28,63 Q29,65 28,67 Q27,68 23,68 Q18,68 17,67 Q16,64 16,63 Z" fill="{c}"/><path d="M4,65 Q9,68 15,67" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.45"/><path d="M28,65 Q23,68 17,67" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.45"/>`,
iso:`<path d="M4,53 Q3,55 4,57 Q5,57 9,57 Q14,57 15,56 Q16,53 16,53 Z" fill="{c}"/><path d="M28,53 Q29,55 28,57 Q27,57 23,57 Q18,57 17,56 Q16,53 16,53 Z" fill="{c}"/><path d="M4,56 Q9,57 15,56" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.45"/><path d="M28,56 Q23,57 17,56" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.45"/>`},

{id:'sp_dru',nome:'🌿 Sandálias Naturais',estilo:'ff_hd',
front:`<path d="M6,63 Q5,65 6,67 Q7,68 10,68 Q14,68 15,67 Q16,64 15,63 Z" fill="{c}"/><path d="M26,63 Q27,65 26,67 Q25,68 22,68 Q18,68 17,67 Q16,64 17,63 Z" fill="{c}"/><path d="M6,65 Q10,67 15,66" stroke="{c2}" stroke-width="0.9" fill="none" opacity="0.52"/><path d="M10,63 L10,67" stroke="{c2}" stroke-width="0.7" fill="none" opacity="0.42"/><path d="M26,65 Q22,67 17,66" stroke="{c2}" stroke-width="0.9" fill="none" opacity="0.52"/>`,
iso:`<path d="M6,53 Q5,55 6,57 Q7,57 10,57 Q14,57 15,56 Q16,53 15,53 Z" fill="{c}"/><path d="M26,53 Q27,55 26,57 Q25,57 22,57 Q18,57 17,56 Q16,53 17,53 Z" fill="{c}"/><path d="M6,55 Q10,57 15,56" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.52"/><path d="M26,55 Q22,57 17,56" stroke="{c2}" stroke-width="0.8" fill="none" opacity="0.52"/>`},

{id:'sp_nec',nome:'💀 Mortalha dos Pés',estilo:'ff_hd',
front:`<path d="M2,63 Q1,65 2,68 Q3,68 7,68 Q13,68 15,67 Q16,64 15,63 Z" fill="{c}"/><path d="M30,63 Q31,65 30,68 Q29,68 25,68 Q19,68 17,67 Q16,64 17,63 Z" fill="{c}"/><path d="M1,66 Q7,68 15,67" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/><path d="M31,66 Q25,68 17,67" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/>`,
iso:`<path d="M2,53 Q1,55 2,57 Q3,57 7,57 Q13,57 15,56 Q16,53 15,53 Z" fill="{c}"/><path d="M30,53 Q31,55 30,57 Q29,57 25,57 Q19,57 17,56 Q16,53 17,53 Z" fill="{c}"/><path d="M1,56 Q7,57 15,56" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/><path d="M31,56 Q25,57 17,56" stroke="{c2}" stroke-width="0.5" fill="none" opacity="0.42"/>`}

);

// ═══ TEMPLATES DOS 6 ARQUÉTIPOS ═════════════════════════════════════════════
CHAR_JSON_TEMPLATES.push(
{id:'tpl_guerreiro',label:'Guerreiro',icon:'⚔',estilo:'ff_hd',partes:{
  cabelo:'h_gue',rosto:'f_gue',camisa:'c_gue',calca:'cl_gue',sapato:'sp_gue',
  cor_pele:'#d4a876',cor_cabelo:'#3a3a3a',cor_olho:'#2a80c0',
  cor_camisa:'#607090',cor_calca:'#485060',cor_sapato:'#303848'}},
{id:'tpl_mago',label:'Mago',icon:'🔮',estilo:'ff_hd',partes:{
  cabelo:'h_mag',rosto:'f_mag',camisa:'c_mag',calca:'cl_mag',sapato:'sp_mag',
  cor_pele:'#c8b898',cor_cabelo:'#180a24',cor_olho:'#8040cc',
  cor_camisa:'#2a1848',cor_calca:'#1e1236',cor_sapato:'#14082a'}},
{id:'tpl_ladino',label:'Ladino',icon:'🗡',estilo:'ff_hd',partes:{
  cabelo:'h_lad',rosto:'f_lad',camisa:'c_lad',calca:'cl_lad',sapato:'sp_lad',
  cor_pele:'#c8a878',cor_cabelo:'#0a0a0a',cor_olho:'#306030',
  cor_camisa:'#1a1a1a',cor_calca:'#141414',cor_sapato:'#0e0e0e'}},
{id:'tpl_barbaro',label:'Bárbaro',icon:'💪',estilo:'ff_hd',partes:{
  cabelo:'h_bar',rosto:'f_bar',camisa:'c_bar',calca:'cl_bar',sapato:'sp_bar',
  cor_pele:'#c88050',cor_cabelo:'#8a3010',cor_olho:'#c03010',
  cor_camisa:'#6a3010',cor_calca:'#4a2008',cor_sapato:'#2a1004'}},
{id:'tpl_druida',label:'Druida',icon:'🌿',estilo:'ff_hd',partes:{
  cabelo:'h_dru',rosto:'f_dru',camisa:'c_dru',calca:'cl_dru',sapato:'sp_dru',
  cor_pele:'#c8b080',cor_cabelo:'#4a6020',cor_olho:'#206030',
  cor_camisa:'#2a4010',cor_calca:'#1e3010',cor_sapato:'#142208'}},
{id:'tpl_necromante',label:'Necromante',icon:'💀',estilo:'ff_hd',partes:{
  cabelo:'h_nec',rosto:'f_nec',camisa:'c_nec',calca:'cl_nec',sapato:'sp_nec',
  cor_pele:'#a8b8c8',cor_cabelo:'#08060c',cor_olho:'#6040b0',
  cor_camisa:'#0c080e',cor_calca:'#080608',cor_sapato:'#060408'}}
);

console.log('[ARQUÉTIPOS RPG] ✓ 6 classes — Guerreiro · Mago · Ladino · Bárbaro · Druida · Necromante | Combinações livres | Sem transparências');
