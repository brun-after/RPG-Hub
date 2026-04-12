// systems/catalog.js
// RPG Hub — Map background modes, character appearance system (APMOD), attribute mapping, item catalog
// Includes: nmBgTab(), canvas editor, APMOD parts/templates, A1/A2 attribute mapping, I1 catalog CRUD

// ── Declarações antecipadas — usadas por supabase.js antes deste arquivo carregar por completo ──
// ATTR_MAPPING_CACHE é referenciado em _carregarProgressivo (supabase.js) na fase0
var ATTR_MAPPING_CACHE = window.ATTR_MAPPING_CACHE || {};

// tintOverlayHtml e _limparNotifCreativo são usadas por maps.js — declarar stub
// para evitar ReferenceError enquanto catalog.js ainda não inicializou por completo
if (typeof tintOverlayHtml === 'undefined') {
  window.tintOverlayHtml = function() { return ''; };
}
if (typeof _limparNotifCreativo === 'undefined') {
  window._limparNotifCreativo = function() {};
}

// ══════════════════════════════════════════════════════════════
// MAPA BG: 4 MODOS DE FUNDO (URL / UPLOAD / SVG / CANVAS)
// Autocontido — não altera nenhuma lógica existente de mapa.
// Integração: criarNovoMapa() chama nmBgGetFinal() para obter img_url.
// ══════════════════════════════════════════════════════════════

let _nmBgTab = 'url';
let _nmUploadDataUrl = null;
let _nmSvgDataUrl   = null;

function nmBgTab(tab) {
  _nmBgTab = tab;
  const tabs   = ['url','upload','svg','canvas'];
  const labels = { url:'🔗 URL', upload:'📂 Arquivo', svg:'✨ SVG/IA', canvas:'🎨 Pintar' };
  tabs.forEach(t => {
    const btn   = document.getElementById('nm-tab-' + t);
    const panel = document.getElementById('nm-panel-' + t);
    if (!btn || !panel) return;
    const active = t === tab;
    btn.style.background = active ? 'var(--primario)' : 'transparent';
    btn.style.color      = active ? '#fff' : 'var(--suave)';
    panel.style.display  = active ? 'block' : 'none';
  });
  // Inicializar canvas ao entrar na aba — abre fullscreen
  if (tab === 'canvas') setTimeout(() => {
    nmceInit();
    nmceUpdateIsoGuide();
    // Load existing render_data for the current map (if editing)
    const mapId = MAPA_STATE?.mapaAtualId;
    if (mapId) {
      const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === mapId);
      if (entry?.mapa?.render_data) nmceCarregarRenderData(entry.mapa.render_data);
    }
    nmceFullscreenAbrir();
  }, 30);
}

function nmBgGetFinal() {
  if (_nmBgTab === 'url')    return (document.getElementById('nm-img')?.value || '').trim();
  if (_nmBgTab === 'upload') return _nmUploadDataUrl || '';
  if (_nmBgTab === 'svg')    return _nmSvgDataUrl || '';
  if (_nmBgTab === 'canvas') return nmceExport();
  return '';
}

// ── FULLSCREEN CANVAS EDITOR ─────────────────────────────────
function nmceFullscreenAbrir() {
  const overlay = document.getElementById('nmce-fullscreen-overlay');
  const wrap    = document.getElementById('nmce-fs-canvas-wrap');
  const canvas  = document.getElementById('nmce-canvas');
  if (!overlay || !wrap || !canvas) return;

  // Mover canvas para dentro do wrap fullscreen
  wrap.appendChild(canvas);
  // Canvas ocupa todo o espaço visual via CSS (dimensões internas mantidas)
  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  // Sincronizar valores dos controles
  const cor  = document.getElementById('nmce-cor');
  const corFs = document.getElementById('nmce-cor-fs');
  if (cor && corFs) corFs.value = cor.value;
  const sz   = document.getElementById('nmce-size');
  const szFs = document.getElementById('nmce-size-fs');
  if (sz && szFs) szFs.value = sz.value;

  overlay.style.display = 'flex';
  nmceUpdateIsoGuide();

  // Move SVG wall overlay to fullscreen wrap
  const wallsSvg = document.getElementById('nmce-walls-svg');
  const snapDot  = document.getElementById('nmce-wall-snap');
  if (wallsSvg) { wallsSvg.style.zIndex = '10'; wrap.appendChild(wallsSvg); }
  if (snapDot)  { snapDot.style.zIndex  = '11'; wrap.appendChild(snapDot);  }
}

function nmceFullscreenFechar() {
  // Devolver canvas ao painel normal sem salvar nada
  _nmceRestaurarCanvas();
  document.getElementById('nmce-fullscreen-overlay').style.display = 'none';
  if (typeof _nmceContext !== 'undefined') _nmceContext = 'nm';
}

function nmceFullscreenConcluir() {
  // Suporte ao contexto arena cenário
  if (typeof _nmceContext !== 'undefined' && _nmceContext === 'ar-cen') {
    const dataUrl = nmceExport();
    if (typeof _arCenCanvasDataUrl !== 'undefined') _arCenCanvasDataUrl = dataUrl;
    const prev = document.getElementById('ar-cen-canvas-preview');
    const wrap = document.getElementById('ar-cen-canvas-preview-wrap');
    if (prev) prev.src = dataUrl;
    if (wrap) wrap.style.display = 'block';
    _nmceRestaurarCanvas();
    document.getElementById('nmce-fullscreen-overlay').style.display = 'none';
    _nmceContext = 'nm';
    return;
  }

  // Sincronizar controles de volta para o modal
  const corFs = document.getElementById('nmce-cor-fs');
  const cor   = document.getElementById('nmce-cor');
  if (corFs && cor) cor.value = corFs.value;
  const szFs  = document.getElementById('nmce-size-fs');
  const sz    = document.getElementById('nmce-size');
  if (szFs && sz) sz.value = szFs.value;

  // Save render_data into the current map being edited
  _nmceSalvarRenderData();

  _nmceRestaurarCanvas();
  document.getElementById('nmce-fullscreen-overlay').style.display = 'none';
}

function _nmceRestaurarCanvas() {
  // Mover canvas de volta ao painel original dentro do modal
  const canvas    = document.getElementById('nmce-canvas');
  const wallsSvg  = document.getElementById('nmce-walls-svg');
  const snapDot   = document.getElementById('nmce-wall-snap');
  const panelWrap = document.getElementById('nmce-canvas-wrap');
  if (!panelWrap || !canvas) return;
  panelWrap.appendChild(canvas);
  if (wallsSvg) { wallsSvg.style.zIndex = ''; panelWrap.appendChild(wallsSvg); }
  if (snapDot)  { snapDot.style.zIndex  = ''; panelWrap.appendChild(snapDot);  }
  canvas.style.width  = '100%';
  canvas.style.height = '';
}



// — URL preview —
function nmBgUrlPreview(val) {
  const img = document.getElementById('nm-img-preview');
  if (!img) return;
  const url = normalizeImgUrl(val);
  img.src = url || '';
  img.style.display = url ? 'block' : 'none';
}

// — Upload —
async function nmBgUpload(input) {
  const file = input?.files?.[0]; if (!file) return;
  try {
    mostrarToast('Enviando mapa…', 'info');
    _nmUploadDataUrl = await uploadToStorage(file, 'maps');
    const prev = document.getElementById('nm-upload-preview');
    const wrap = document.getElementById('nm-upload-preview-wrap');
    const warn = document.getElementById('nm-upload-size-warn');
    if (prev) prev.src = _nmUploadDataUrl;
    if (wrap) wrap.style.display = 'block';
    if (warn) warn.style.display = 'none'; // sem aviso de tamanho com Storage
    const lbl = document.getElementById('nm-upload-label');
    if (lbl) { const span = lbl.querySelector('div div:first-child'); if(span) span.textContent = file.name; }
  } catch(e) {
    mostrarToast('Erro no upload do mapa', 'erro');
    console.error(e);
  }
}
function nmBgClearUpload() {
  _nmUploadDataUrl = null;
  const prev = document.getElementById('nm-upload-preview-wrap');
  if (prev) prev.style.display = 'none';
  const input = document.getElementById('nm-upload-input');
  if (input) input.value = '';
  const lbl = document.getElementById('nm-upload-label');
  if (lbl) { const span = lbl.querySelector('div div:first-child'); if(span) span.textContent = 'Escolher PNG / JPG / WebP'; }
}

// — SVG —
const _NM_SVG_PROMPT = `━━━ ESCOLHA O TIPO DE MAPA ━━━

🌍 MAPA GERAL — visão ortogonal top-down (câmera perfeitamente de cima)
   Para: regiões, reinos, continentes, cidades com bairros/distritos, qualquer área
   que contenha outros mapas dentro (inclusive outros mapas gerais ou mapas locais).
   Perspectiva: projeção ortogonal 2D pura — sem inclinação, sem profundidade isométrica.
   Biomas, rios, rotas, cidades como pontos marcados, relevo achatado com sombra.

🏰 MAPA LOCAL — perspectiva dimétrica estilo Diablo 3
   Para: bairros, ruas, construções, dungeons, partes de floresta, qualquer local
   específico cujas subdivisões são apenas cômodos/corredores/ruas (sem mais subdivisões).
   Exceção: entradas de dungeons/cavernas podem aparecer em mapas locais mesmo que
   tenham subdivisões internas.
   Perspectiva: câmera ortográfica, rotação Z 45°, inclinação X ~60° — pisos em losangos
   largos (~2:1), paredes com 3 faces, sombras paralelas, objetos com volume visível.

━━━ ESPECIFIQUE O MAPA ━━━
Tipo: [GERAL ou LOCAL]
[DESCREVA: nome do local, ambiente/bioma, elementos presentes, pontos de referência,
 o que deve ser destacado visualmente, tom narrativo]

━━━ REQUISITOS TÉCNICOS OBRIGATÓRIOS ━━━
• Formato: SVG único — viewBox="0 0 800 500" — sem dependências externas
• Sem <script> — sem <image> com src externo
• Elementos permitidos: <path> <polygon> <rect> <circle> <ellipse> <line> <text>
  <g> <defs> <linearGradient> <radialGradient> <pattern> <filter> <use> <symbol>
• Repetições: use <symbol> + <use> para elementos repetidos (árvores, tochas, pedras)
• Tamanho máximo: 150KB — use densidade inteligente, não repetição bruta
• Texto/labels: font-family="serif" ou font-family="sans-serif" apenas

Para MAPA LOCAL (dimétrico estilo Diablo 3):
• Câmera ortográfica — sem ponto de fuga, paralelas nunca convergem
• Rotação Z 45°: o grid visto na diagonal — quadrados viram losangos largos (~2:1 H:V)
• Inclinação X ~60°: câmera alta, levemente sobre o ombro do personagem
• Paredes com 3 faces visíveis: topo plano, face-esquerda (cima-direita), face-direita (cima-esquerda)
• Iluminação: fonte superior-esquerda — topo claro, face-esq médio, face-dir escura (contraste ≥15%)
• Oclusão: elementos ao fundo desenhados antes, frente por cima
• Sombras paralelas projetadas no chão (não radiais) para tudo com altura
• Objetos no fundo podem ser sutilmente menores para reforçar a sensação 3D do Diablo

Para MAPA GERAL (top-down):
• Sem perspectiva lateral — câmera perfeitamente perpendicular ao plano
• Biomas com texturas de preenchimento via <pattern> ou <linearGradient>
• Rios com gradiente direcional e largura variável (<path> com curvas)
• Montanhas como silhuetas achatadas com sombra direcional
• Cidades/vilas: ícone geométrico + label. Rotas: <path> com stroke-dasharray opcional

━━━ QUALIDADE MÁXIMA ━━━
• Maximize: gradientes multicamada, filtros feDropShadow e feTurbulence para texturas,
  <pattern> para pisos repetidos, micro-detalhes de vegetação e decoração
• Sem áreas grandes com cor sólida — toda superfície deve ter profundidade visual
• Formas orgânicas com <path> curvilíneo (rivers, coastlines, clearings)
• Não influencie o estilo artístico — apenas execute os requisitos técnicos acima
  com máxima capacidade gráfica disponível

Retorne APENAS o código SVG, começando com <svg e terminando com </svg>,
sem markdown, sem explicação, sem texto antes ou depois.`;

function nmBgSvgPreview(val) {
  const warn = document.getElementById('nm-svg-warn');
  const prevWrap = document.getElementById('nm-svg-preview-wrap');
  const prev = document.getElementById('nm-svg-preview');
  _nmSvgDataUrl = null;
  if (!val || !val.trim()) {
    if (warn) warn.style.display = 'none';
    if (prevWrap) prevWrap.style.display = 'none';
    return;
  }
  const trimmed = val.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.includes('<svg')) {
    if (warn) { warn.style.display = 'block'; warn.style.background = 'rgba(192,57,43,0.1)'; warn.style.border = '1px solid rgba(192,57,43,0.3)'; warn.style.color = '#e74c3c'; warn.textContent = '⚠️ Não parece ser um SVG válido. Certifique-se que começa com <svg…'; }
    if (prevWrap) prevWrap.style.display = 'none';
    return;
  }
  // Verificar tamanho
  const kb = Math.round(new Blob([trimmed]).size / 1024);
  if (warn) {
    if (kb > 300) {
      warn.style.display = 'block';
      warn.style.background = 'rgba(200,168,75,0.08)';
      warn.style.border = '1px solid rgba(200,168,75,0.3)';
      warn.style.color = 'var(--destaque-v)';
      warn.textContent = `⚠️ SVG grande (${kb}KB) — pode demorar ao carregar. Se a IA gerou muita repetição, peça uma versão mais enxuta.`;
    } else {
      warn.style.display = 'block';
      warn.style.background = 'rgba(39,174,96,0.08)';
      warn.style.border = '1px solid rgba(39,174,96,0.2)';
      warn.style.color = '#5ee09a';
      warn.textContent = `✓ SVG válido · ${kb}KB`;
    }
  }
  // Preview inline (seguro: sem scripts externos)
  const safe = trimmed.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/on\w+="[^"]*"/gi,'');
  if (prev) prev.innerHTML = safe;
  if (prevWrap) prevWrap.style.display = 'block';
  // Converter para data URL para salvar
  const b64 = btoa(unescape(encodeURIComponent(safe)));
  _nmSvgDataUrl = 'data:image/svg+xml;base64,' + b64;
}

function nmCopiarPromptSVG() {
  const btn = document.getElementById('nm-svg-copy-btn');
  const lbl = document.getElementById('nm-svg-copy-lbl');
  const done = () => {
    if (lbl) lbl.textContent = '✓ Copiado!';
    if (btn) btn.style.color = '#5ee09a';
    setTimeout(() => { if(lbl) lbl.textContent='Copiar prompt SVG (genérico)'; if(btn) btn.style.color='var(--destaque-v)'; }, 2500);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(_NM_SVG_PROMPT).then(done).catch(() => { const t=document.createElement('textarea'); t.value=_NM_SVG_PROMPT; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); });
  else { const t=document.createElement('textarea'); t.value=_NM_SVG_PROMPT; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); }
}

function nmCopiarPromptContextual() {
  const desc = (document.getElementById('nm-svg-ctx-input')?.value || '').trim();
  if (!desc) { mostrarToast('Descreva o que criar antes de copiar o prompt', 'erro'); return; }
  const tipoMapa = document.getElementById('nm-tipo')?.value || 'local';
  const mapasExistentes = (RPG_DATA?.mapas || []);
  const nomeCampanha = CURRENT_RPG?.nome || 'campanha';

  const isLocal = tipoMapa === 'local';
  const tipoLabel = isLocal ? '🏰 MAPA LOCAL — perspectiva dimétrica estilo Diablo 3' : '🌍 MAPA GERAL — visão ortogonal top-down (câmera perfeitamente de cima)';
  const perspDetalhes = isLocal
    ? `Câmera ortográfica estilo Diablo 3: rotação Z 45° + inclinação X ~60°.
Pisos em losangos largos (~2:1 H:V), paredes com 3 faces (topo/esq/dir).
Iluminação: fonte superior-esquerda — topo claro, face-esq médio, face-dir escura (contraste ≥15%).
Sombras paralelas projetadas no chão (não radiais). Oclusão: fundo antes, frente por cima.
Objetos no fundo sutilmente menores para reforçar o 3D sem quebrar a projeção paralela.`
    : `Sem perspectiva lateral — câmera perpendicular ao plano. Biomas com textura <pattern>/<linearGradient>.
Rios com gradiente direcional e largura variável. Montanhas como silhuetas com sombra direcional.
Cidades com ícone + label. Rotas como <path>.`;

  const listaMapas = mapasExistentes.length
    ? mapasExistentes.map(l => {
        const t = l.mapa.tipo === 'geral' ? '🌍 GERAL' : '🏰 LOCAL';
        return `  • ${t} "${l.mapa.nome}" [${l.mapa.map_id}]`;
      }).join('\n')
    : '  (nenhum ainda)';

  const prompt = `Campanha: "${nomeCampanha}"
Tipo de mapa: ${tipoLabel}

━━━ PERSPECTIVA OBRIGATÓRIA ━━━
${perspDetalhes}

━━━ O QUE CRIAR ━━━
${desc}

━━━ CONTEXTO — MAPAS JÁ EXISTENTES NA CAMPANHA ━━━
${listaMapas}

━━━ REQUISITOS TÉCNICOS OBRIGATÓRIOS ━━━
• Formato: SVG único — viewBox="0 0 800 500" — sem dependências externas
• Sem <script> — sem <image> com src externo
• Elementos permitidos: <path> <polygon> <rect> <circle> <ellipse> <line> <text>
  <g> <defs> <linearGradient> <radialGradient> <pattern> <filter> <use> <symbol>
• Repetições: <symbol> + <use> para elementos repetidos
• Tamanho máximo: 150KB
• Texto/labels: font-family="serif" ou font-family="sans-serif" apenas

━━━ QUALIDADE MÁXIMA ━━━
• Gradientes multicamada, filtros feDropShadow/feTurbulence para texturas,
  <pattern> para pisos repetidos, micro-detalhes de vegetação e decoração
• Sem áreas grandes com cor sólida — toda superfície deve ter profundidade visual
• Formas orgânicas com <path> curvilíneo
• Não influencie o estilo artístico — execute os requisitos técnicos com máxima
  capacidade gráfica disponível

Retorne APENAS o código SVG, começando com <svg e terminando com </svg>,
sem markdown, sem explicação, sem texto antes ou depois.`;

  const btn = document.getElementById('nm-svg-ctx-btn');
  const lbl = document.getElementById('nm-svg-ctx-lbl');
  const done = () => {
    if (lbl) lbl.textContent = '✓ Copiado!';
    if (btn) btn.style.color = '#5ee09a';
    setTimeout(() => { if(lbl) lbl.textContent='Copiar prompt com contexto da campanha'; if(btn) btn.style.color='var(--primario-v)'; }, 2500);
  };
  if (navigator.clipboard) navigator.clipboard.writeText(prompt).then(done).catch(() => { const t=document.createElement('textarea'); t.value=prompt; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); });
  else { const t=document.createElement('textarea'); t.value=prompt; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); done(); }
}

// ══════════════════════════════════════════════════════════════
// CANVAS EDITOR (nmce)
// Estado autocontido em nmCE. Não interfere com nenhum outro canvas.
// ══════════════════════════════════════════════════════════════

const nmCE = {
  tool: 'pincel', drawing: false,
  lastX: 0, lastY: 0,
  startX: 0, startY: 0,
  history: [],          // snapshots ImageData para undo
  _snapshot: null,      // snapshot no início do shape
  _uploadDataUrl: null, // imagem de referência de fundo
  // ── Cenário (paredes/portas/objetos) ──
  wallFirstSnap: null,  // primeiro ponto de snap de parede
  renderData: { paredes: [], portas: [], objetos: [] }, // dados do cenário
};

function nmceInit() {
  const c = document.getElementById('nmce-canvas');
  if (!c || c._nmceInited) return;
  c._nmceInited = true;
  nmceBgRender();
}

function nmceBgRender() {
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  // Salvar desenho atual
  const snap = ctx.getImageData(0, 0, c.width, c.height);
  ctx.clearRect(0, 0, c.width, c.height);
  // Fundo base
  if (nmCE._uploadDataUrl) {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, c.width, c.height); ctx.putImageData(snap, 0, 0); };
    img.src = nmCE._uploadDataUrl;
  } else {
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.putImageData(snap, 0, 0);
  }
}

function nmceBgLoad(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    nmCE._uploadDataUrl = e.target.result;
    const c = document.getElementById('nmce-canvas');
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    // Preservar desenho atual, renderizar sobre novo fundo
    const snap = ctx.getImageData(0, 0, c.width, c.height);
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.putImageData(snap, 0, 0);
    };
    img.src = nmCE._uploadDataUrl;
  };
  reader.readAsDataURL(file);
}

function nmceSetTool(t) {
  nmCE.tool = t;
  nmCE.wallFirstSnap = null; // reset wall first point on tool change
  const drawTools = ['pincel','borracha','fill','linha','rect','circulo'];
  const sceneTools = ['parede','porta','objeto','bau'];
  const allTools = [...drawTools, ...sceneTools];

  allTools.forEach(name => {
    const btn   = document.getElementById('nmce-btn-'   + name);
    const btnFs = document.getElementById('nmcefs-btn-' + name);
    const isActive = name === t;
    const isScene  = sceneTools.includes(name);
    const activeBg = isScene ? (name==='parede'?'rgba(126,200,240,0.25)':name==='porta'?'rgba(200,168,75,0.25)':name==='bau'?'rgba(200,168,75,0.2)':'rgba(176,126,240,0.25)') : 'var(--primario)';
    const activeCl = isScene ? (name==='parede'?'#7ec8f0':name==='porta'?'#c8a84b':name==='bau'?'#c8a84b':'#b07ef0') : '#fff';
    [btn, btnFs].forEach(b => {
      if (!b) return;
      b.style.background = isActive ? activeBg : 'transparent';
      b.style.color = isActive ? activeCl : (isScene ? (name==='parede'?'#7ec8f088':name==='porta'?'#c8a84b88':'#b07ef088') : 'var(--texto)');
    });
  });

  const c = document.getElementById('nmce-canvas');
  if (c) c.style.cursor = t === 'fill' ? 'cell' : t === 'parede' ? 'crosshair' : 'pointer';

  // Show/hide scenario panel
  const panel = document.getElementById('nmce-cenario-panel');
  const fsBar = document.getElementById('nmce-fs-cenario-bar');
  const isScene = sceneTools.includes(t);
  if (panel) panel.style.display = isScene ? 'block' : 'none';
  ['parede','porta','objeto','bau'].forEach(name => {
    const el = document.getElementById('nmce-cenario-panel-' + name);
    if (el) el.style.display = name === t ? 'block' : 'none';
  });

  // Fullscreen hint
  const hints = { parede: '🧱 Parede — clique em 2 bordas do grid', porta: '🚪 Porta — clique numa célula', objeto: '🪨 Obstáculo — clique numa célula', bau: '📦 Baú — clique numa célula' };
  if (fsBar) {
    fsBar.style.display = isScene ? 'flex' : 'none';
    const hintEl = document.getElementById('nmce-fs-cenario-hint');
    if (hintEl) hintEl.textContent = hints[t] || '';
  }

  // Show snap indicator only in wall mode
  const snap = document.getElementById('nmce-wall-snap');
  if (snap) snap.style.display = 'none';
}

function nmcePickColor(hex) {
  const inp = document.getElementById('nmce-cor');
  if (inp) inp.value = hex;
  const inpFs = document.getElementById('nmce-cor-fs');
  if (inpFs) inpFs.value = hex;
}

function nmcePushHistory() {
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  const snap = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  nmCE.history.push(snap);
  if (nmCE.history.length > 20) nmCE.history.shift();
}

function nmceUndo() {
  if (!nmCE.history.length) return;
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  c.getContext('2d', { willReadFrequently: true }).putImageData(nmCE.history.pop(), 0, 0);
}

function nmceClear() {
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  nmcePushHistory();
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, c.width, c.height);
  nmceBgRender();
}

function nmceExport() {
  const c = document.getElementById('nmce-canvas');
  if (!c) return '';
  return c.toDataURL('image/png');
}

// Coordenadas relativas ao canvas
function nmceCoords(e, c) {
  const r = c.getBoundingClientRect();
  const scaleX = c.width  / r.width;
  const scaleY = c.height / r.height;
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
}

function nmceDown(e) {
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  const { x, y } = nmceCoords(e, c);

  // ── Ferramentas de cenário ──────────────────────────────────────────
  if (nmCE.tool === 'parede' || nmCE.tool === 'porta' || nmCE.tool === 'objeto') {
    _nmceSceneClick(x, y, c);
    return;
  }

  nmCE.drawing = true;
  nmCE.startX = x; nmCE.startY = y;
  nmCE.lastX  = x; nmCE.lastY  = y;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const cor   = document.getElementById('nmce-cor')?.value  || '#4fa3d1';
  const size  = parseInt(document.getElementById('nmce-size')?.value) || 8;
  if (nmCE.tool === 'fill') {
    nmcePushHistory();
    nmceFill(ctx, Math.round(x), Math.round(y), cor);
    nmCE.drawing = false;
    return;
  }
  if (['linha','rect','circulo'].includes(nmCE.tool)) {
    nmCE._snapshot = ctx.getImageData(0, 0, c.width, c.height);
    return;
  }
  nmcePushHistory();
  // Ponto inicial
  ctx.beginPath();
  ctx.arc(x, y, size/2, 0, Math.PI*2);
  ctx.fillStyle = nmCE.tool === 'borracha' ? 'rgba(0,0,0,1)' : cor;
  if (nmCE.tool === 'borracha') ctx.globalCompositeOperation = 'destination-out';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function nmceMove(e) {
  // Show wall snap indicator even when not drawing
  if (nmCE.tool === 'parede') {
    const c = document.getElementById('nmce-canvas');
    if (c) {
      const { x, y } = nmceCoords(e, c);
      const snap = _nmceSnapPonto(x, y, c);
      _nmceShowSnapIndicator(snap, c);
    }
  }
  if (!nmCE.drawing) return;
  e.preventDefault();
  const c = document.getElementById('nmce-canvas');
  if (!c) return;
  const { x, y } = nmceCoords(e, c);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const cor   = document.getElementById('nmce-cor')?.value  || '#4fa3d1';
  const size  = parseInt(document.getElementById('nmce-size')?.value) || 8;
  if (nmCE.tool === 'pincel' || nmCE.tool === 'borracha') {
    ctx.beginPath();
    ctx.moveTo(nmCE.lastX, nmCE.lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = nmCE.tool === 'borracha' ? 'rgba(0,0,0,1)' : cor;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (nmCE.tool === 'borracha') ctx.globalCompositeOperation = 'destination-out';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } else if (nmCE._snapshot) {
    // Preview do shape
    ctx.putImageData(nmCE._snapshot, 0, 0);
    ctx.beginPath();
    ctx.strokeStyle = cor;
    ctx.fillStyle   = cor + '44';
    ctx.lineWidth   = size / 2 + 1;
    if (nmCE.tool === 'linha') {
      ctx.moveTo(nmCE.startX, nmCE.startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (nmCE.tool === 'rect') {
      const w = x - nmCE.startX, h = y - nmCE.startY;
      ctx.rect(nmCE.startX, nmCE.startY, w, h);
      ctx.fill(); ctx.stroke();
    } else if (nmCE.tool === 'circulo') {
      const rx = Math.abs(x - nmCE.startX)/2, ry = Math.abs(y - nmCE.startY)/2;
      const cx = Math.min(nmCE.startX, x) + rx;
      const cy = Math.min(nmCE.startY, y) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    }
  }
  nmCE.lastX = x; nmCE.lastY = y;
}

function nmceUp(e) {
  if (!nmCE.drawing) return;
  nmCE.drawing = false;
  const c = document.getElementById('nmce-canvas');
  if (!c || !nmCE._snapshot) { nmCE._snapshot = null; return; }
  // Commit do shape
  nmcePushHistory();
  const { x, y } = nmceCoords(e.changedTouches ? { clientX:e.changedTouches[0]?.clientX||nmCE.lastX, clientY:e.changedTouches[0]?.clientY||nmCE.lastY } : e, c);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const cor  = document.getElementById('nmce-cor')?.value || '#4fa3d1';
  const size = parseInt(document.getElementById('nmce-size')?.value) || 8;
  ctx.putImageData(nmCE._snapshot, 0, 0);
  ctx.beginPath();
  ctx.strokeStyle = cor; ctx.fillStyle = cor + '44';
  ctx.lineWidth = size / 2 + 1;
  if (nmCE.tool === 'linha') {
    ctx.moveTo(nmCE.startX, nmCE.startY); ctx.lineTo(x, y); ctx.stroke();
  } else if (nmCE.tool === 'rect') {
    ctx.rect(nmCE.startX, nmCE.startY, x-nmCE.startX, y-nmCE.startY); ctx.fill(); ctx.stroke();
  } else if (nmCE.tool === 'circulo') {
    const rx=Math.abs(x-nmCE.startX)/2, ry=Math.abs(y-nmCE.startY)/2;
    ctx.ellipse(Math.min(nmCE.startX,x)+rx, Math.min(nmCE.startY,y)+ry, rx, ry, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
  }
  nmCE._snapshot = null;
}

// Touch
function nmceTDown(e) { e.preventDefault(); nmceDown(e); }
function nmceTMove(e) { e.preventDefault(); nmceMove(e); }

// Flood fill (BFS, pixel a pixel)
function nmceFill(ctx, startX, startY, hexColor) {
  const c = ctx.canvas;
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const data = imgData.data;
  const idx = (startY * c.width + startX) * 4;
  const tR = data[idx], tG = data[idx+1], tB = data[idx+2], tA = data[idx+3];
  const fill = _nmceHex2rgb(hexColor);
  if (tR===fill[0] && tG===fill[1] && tB===fill[2] && tA===255) return;
  const queue = [[startX, startY]];
  const visited = new Uint8Array(c.width * c.height);
  const match = (i) => data[i]===tR && data[i+1]===tG && data[i+2]===tB && data[i+3]===tA;
  const set = (i) => { data[i]=fill[0]; data[i+1]=fill[1]; data[i+2]=fill[2]; data[i+3]=255; };
  let iter = 0;
  while (queue.length && iter++ < 200000) {
    const [cx, cy] = queue.pop();
    if (cx<0||cy<0||cx>=c.width||cy>=c.height) continue;
    const pi = cy*c.width+cx;
    if (visited[pi]) continue;
    visited[pi]=1;
    const di = pi*4;
    if (!match(di)) continue;
    set(di);
    queue.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(imgData, 0, 0);
}
function _nmceHex2rgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [0,0,0];
}


// ══════════════════════════════════════════════════════════════
// ISO GRID HELPER
// Shared between mapaDesenharGrade, mapaRenderCanvas e canvas editor
// Desenha grade de losangos isométricos 2:1 (ratio padrão)
// ══════════════════════════════════════════════════════════════

function _drawIsoGrid(ctx, W, H, grid, color) {
  const ch = grid;
  ctx.save();
  ctx.strokeStyle = color || 'rgba(126,200,240,0.13)';
  ctx.lineWidth = 0.5;

  // Linhas NE: y = -x/2 + c  (inclinação -0.5 → a cada 2px para direita, 1px para cima)
  // Para cada c = k * ch cobrindo o canvas inteiro:
  for (let c = -ch; c <= H + Math.ceil(W / 2) + ch; c += ch) {
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(W, c - W / 2);
    ctx.stroke();
  }

  // Linhas NW: y = x/2 + c  (inclinação +0.5 → a cada 2px para direita, 1px para baixo)
  for (let c = -Math.ceil(W / 2) - ch; c <= H + ch; c += ch) {
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(W, c + W / 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ── CANVAS EDITOR: grade guia ISO removida (sistema não existe mais) ──
function nmceUpdateIsoGuide() {
  // ISO grid removido — função mantida como stub para evitar erros de chamada
}

console.log('ISO Grid + NM BG Tabs loaded ✓');

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
const tintTabBtn=`<button class="apmod-tab-btn" data-tab="tint" onclick="apmodSwitchTab('tint',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🖌 Tint</button>`;
const tabsHtml=tipoChar==='criatura'?`<button class="apmod-tab-btn apmod-tab-ativo" data-tab="criatura" onclick="apmodSwitchTab('criatura',this)" style="flex:1;padding:10px 6px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid var(--destaque);background:none;color:var(--destaque);text-transform:uppercase">🐉 Modelo</button><button class="apmod-tab-btn" data-tab="svg" onclick="apmodSwitchTab('svg',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🖼 Imagem/SVG</button>${equipTabBtn}${tintTabBtn}`:`<button class="apmod-tab-btn apmod-tab-ativo" data-tab="json" onclick="apmodSwitchTab('json',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid var(--destaque);background:none;color:var(--destaque);text-transform:uppercase">📋 Templates</button><button class="apmod-tab-btn" data-tab="builder" onclick="apmodSwitchTab('builder',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">🎨 Criar</button><button class="apmod-tab-btn" data-tab="svg" onclick="apmodSwitchTab('svg',this)" style="flex:1;padding:10px 4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;color:var(--suave);text-transform:uppercase">✍ SVG</button>${equipTabBtn}${tintTabBtn}`;
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
<div style="flex:1;overflow-y:auto;padding:16px" id="apmod-tab-area">${tipoChar==='criatura'?_apmodTabCriatura(aparencia,cor)+_apmodTabSvg(aparencia)+_apmodTabEquip(aparencia,nome)+_apmodTabTint(aparencia):_apmodTabJson()+_apmodTabBuilder(aparencia)+_apmodTabSvg(aparencia)+_apmodTabEquip(aparencia,nome)+_apmodTabTint(aparencia)}</div>
<div style="background:var(--escuro);border-top:1px solid var(--borda);padding:12px 16px;flex-shrink:0"><button onclick="apmodSalvar('${nome.replace(/'/g,"\\'")}') " style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primario),var(--primario-v));border:none;border-radius:8px;color:#050810;font-family:var(--fonte-d);font-size:0.78rem;letter-spacing:0.12em;cursor:pointer;text-transform:uppercase;font-weight:700">💾 Salvar Aparência</button></div>`;
modal.style.display='flex';window._apmodNome=nome;window._apmodOriginal=JSON.parse(JSON.stringify(aparencia));window._apmodOriginalStale=false;window._apmodLastBaseTab=null;window._apmodTints=JSON.parse(JSON.stringify(aparencia.tints||[]));window._apmodEquipsVisuais=JSON.parse(JSON.stringify(aparencia.equipamentos_visuais||[]));window._apmodCriaturaModelo=aparencia.modelo_criatura||'npc_generico';if(aparencia.modo==='builder'||aparencia.modo==='json')setTimeout(()=>apmodPreencherBuilder(aparencia),60);
// Inicializar na aba correta, priorizando última aba memorizada
if(tipoChar==='criatura'){
  const ultimaAbaCria = window._apmodLastTab && ['criatura','svg','equip','tint'].includes(window._apmodLastTab) ? window._apmodLastTab : null;
  const abaInicial = ultimaAbaCria || (aparencia.modo==='imagem'||aparencia.modo==='svg' ? 'svg' : 'criatura');
  apmodSwitchTab(abaInicial, modal.querySelector(`[data-tab="${abaInicial}"]`));
}else{
  const ultimaAba = window._apmodLastTab && ['builder','svg','json','equip','tint'].includes(window._apmodLastTab) ? window._apmodLastTab : null;
  const abaInicial = ultimaAba || (aparencia.modo==='svg'||aparencia.modo==='imagem' ? 'svg' : 'builder');
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

    // Gerar imagem composta em background e salvar
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

// ════════════════════════════════════════════════════════════════════════════
// A1 — SERVIÇO DE MAPEAMENTO DE ATRIBUTOS
// ════════════════════════════════════════════════════════════════════════════
// ATTR_MAPPING_CACHE já declarado no topo do arquivo como var global

const GRUPOS_VALIDOS = ['forca','destreza','constituicao','inteligencia'];

function _normalizarAttr(nome){ return (nome||'').toLowerCase().trim(); }

async function carregarMapeamento(rpgId) {
  if (ATTR_MAPPING_CACHE[rpgId]) return ATTR_MAPPING_CACHE[rpgId];
  try {
    const data = await sb(`atributos_grupos?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=nome_customizado`);
    ATTR_MAPPING_CACHE[rpgId] = data || [];
    return ATTR_MAPPING_CACHE[rpgId];
  } catch(e) {
    console.warn('[A1] Erro ao carregar mapeamento:', e);
    return [];
  }
}

async function salvarMapeamento(rpgId, nomeCustomizado, grupoBase) {
  if (!nomeCustomizado || !/^[\w\s\-áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/u.test(nomeCustomizado))
    throw new Error('Nome de atributo inválido.');
  if (!GRUPOS_VALIDOS.includes(grupoBase))
    throw new Error('Grupo base inválido. Use: ' + GRUPOS_VALIDOS.join(', '));
  const nomeNorm = _normalizarAttr(nomeCustomizado);
  // Verificar duplicidade em outro grupo
  const atual = await carregarMapeamento(rpgId);
  const existente = atual.find(x => _normalizarAttr(x.nome_customizado) === nomeNorm);
  if (existente && existente.grupo_base !== grupoBase) {
    // Está em outro grupo, precisará atualizar
  }
  await sb(`atributos_grupos?rpg_id=eq.${encodeURIComponent(rpgId)}&nome_customizado_norm=eq.${encodeURIComponent(nomeNorm)}`,
    { method:'DELETE', prefer:'return=minimal', headers:{'Prefer':'return=minimal'} }
  ).catch(()=>{});
  await sb('atributos_grupos', {
    method: 'POST',
    body: JSON.stringify({ rpg_id: rpgId, nome_customizado: nomeCustomizado, nome_customizado_norm: nomeNorm, grupo_base: grupoBase }),
    headers:{ 'Prefer':'return=minimal' }
  });
  // Atualizar cache local imediatamente — evita nova ida à rede
  if (!ATTR_MAPPING_CACHE[rpgId]) ATTR_MAPPING_CACHE[rpgId] = [];
  ATTR_MAPPING_CACHE[rpgId] = ATTR_MAPPING_CACHE[rpgId].filter(x => _normalizarAttr(x.nome_customizado) !== nomeNorm);
  ATTR_MAPPING_CACHE[rpgId].push({ rpg_id: rpgId, nome_customizado: nomeCustomizado, nome_customizado_norm: nomeNorm, grupo_base: grupoBase });
}

async function removerMapeamento(rpgId, nomeCustomizado) {
  const nomeNorm = _normalizarAttr(nomeCustomizado);
  // Verificar se algum item usa este atributo
  try {
    const itens = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=nome,atributos_bonus`);
    const usando = (itens||[]).filter(it => {
      const b = it.atributos_bonus || {};
      return Object.keys(b).some(k => _normalizarAttr(k) === nomeNorm);
    });
    if (usando.length > 0) {
      const nomes = usando.slice(0,3).map(x=>x.nome).join(', ');
      throw new Error(`Atributo usado por ${usando.length} item(ns): ${nomes}. Remova-o dos itens antes.`);
    }
  } catch(e) {
    if (e.message.includes('usado por')) throw e;
    // tabela item_catalog pode não existir ainda, ok
  }
  await sb(`atributos_grupos?rpg_id=eq.${encodeURIComponent(rpgId)}&nome_customizado_norm=eq.${encodeURIComponent(nomeNorm)}`,
    { method:'DELETE', headers:{'Prefer':'return=minimal'} }
  );
  // Atualizar cache local imediatamente
  if (ATTR_MAPPING_CACHE[rpgId]) {
    ATTR_MAPPING_CACHE[rpgId] = ATTR_MAPPING_CACHE[rpgId].filter(x => _normalizarAttr(x.nome_customizado) !== nomeNorm);
  }
}

function getGrupoDeAtributo(rpgId, nomeCustomizado) {
  const nomeNorm = _normalizarAttr(nomeCustomizado);
  const lista = ATTR_MAPPING_CACHE[rpgId] || [];
  return lista.find(x => _normalizarAttr(x.nome_customizado) === nomeNorm)?.grupo_base || null;
}

function getAtributosPorGrupo(rpgId, grupoBase) {
  return (ATTR_MAPPING_CACHE[rpgId] || []).filter(x => x.grupo_base === grupoBase).map(x => x.nome_customizado);
}

// ════════════════════════════════════════════════════════════════════════════
// A2 — INTERFACE DE MAPEAMENTO
// ════════════════════════════════════════════════════════════════════════════
const GRUPO_INFO = {
  forca:         { label:'💪 Força',         desc:'Potência de ataques físicos' },
  destreza:      { label:'🏃 Destreza',       desc:'Velocidade e habilidade física' },
  constituicao:  { label:'🛡️ Constituição',   desc:'Resistência e HP' },
  inteligencia:  { label:'🧠 Inteligência',   desc:'Magia, percepção, carisma' }
};

async function renderAttrMappingUI() {
  const card = document.getElementById('cfg-atrmapping-card');
  if (!card || RPG_DATA?.myRole !== 'mestre') return;
  card.style.display = '';
  const rpgId = CURRENT_RPG?.id;
  const grid = document.getElementById('cfg-atrmapping-grid');
  if (!rpgId) { grid.innerHTML='<div style="color:var(--suave);font-size:0.8rem;text-align:center">Nenhuma campanha carregada.</div>'; return; }

  const attrDefs = RPG_DATA?.attrDefs || [];
  const attrNumericos = attrDefs.filter(a => a.tipo === 'number' || a.tipo === 'status' || !a.tipo);

  // Se cache já populado (pré-carregado na Fase 0), renderizar instantaneamente
  if (ATTR_MAPPING_CACHE[rpgId]) {
    _renderMappingGrid(rpgId, attrNumericos);
    return;
  }

  // Caso contrário (primeiro acesso antes da Fase 0 terminar), buscar e renderizar
  grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);font-style:italic;font-size:0.8rem">Carregando...</div>';
  try {
    await carregarMapeamento(rpgId);
    _renderMappingGrid(rpgId, attrNumericos);
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--perigo);font-size:0.8rem">${e.message}</div>`;
  }
}

function _renderMappingGrid(rpgId, attrDefs) {
  const grid = document.getElementById('cfg-atrmapping-grid');
  const mapeados = new Set((ATTR_MAPPING_CACHE[rpgId]||[]).map(x=>_normalizarAttr(x.nome_customizado)));
  let html = '';
  for (const [grupo, info] of Object.entries(GRUPO_INFO)) {
    const chips = getAtributosPorGrupo(rpgId, grupo);
    const naoMapeados = attrDefs.filter(a => !mapeados.has(_normalizarAttr(a.nome)) || chips.some(c=>_normalizarAttr(c)===_normalizarAttr(a.nome)));
    const opcoes = attrDefs.filter(a => !mapeados.has(_normalizarAttr(a.nome)) || chips.some(c=>_normalizarAttr(c)===_normalizarAttr(a.nome)));

    html += `<div class="atr-mapping-painel">
      <div style="font-family:var(--fonte-d);font-size:0.78rem;margin-bottom:2px">${info.label}</div>
      <div style="font-size:0.7rem;color:var(--suave);margin-bottom:8px">${info.desc}</div>
      <div id="chips-${grupo}" style="min-height:28px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:2px">`;
    if (!chips.length) html += `<span style="font-size:0.7rem;color:var(--suave);font-style:italic;padding:3px">Nenhum atributo</span>`;
    for (const c of chips) {
      html += `<span class="atr-chip">${c}<button onclick="atrMappingRemover('${rpgId}','${c.replace(/'/g,"\\'")}','${grupo}')" title="Remover">×</button></span>`;
    }
    html += `</div>
      <div style="display:flex;gap:6px">
        <select id="sel-atr-${grupo}" style="flex:1;padding:6px 8px;background:var(--painel);border:1px solid var(--borda);border-radius:5px;color:var(--texto);font-size:0.75rem">
          <option value="">＋ Adicionar atributo...</option>`;
    for (const a of attrDefs) {
      if (!chips.some(c=>_normalizarAttr(c)===_normalizarAttr(a.nome))) {
        html += `<option value="${a.nome}">${a.nome}</option>`;
      }
    }
    html += `</select>
        <button onclick="atrMappingAdicionar('${rpgId}','${grupo}')" style="padding:6px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:var(--primario);font-size:0.7rem;cursor:pointer;font-family:var(--fonte-d)">OK</button>
      </div>
    </div>`;
  }
  grid.innerHTML = html || '<div style="color:var(--suave);font-size:0.8rem;text-align:center;padding:10px">Configure os atributos da campanha primeiro (seção acima).</div>';
}

async function atrMappingAdicionar(rpgId, grupo) {
  const sel = document.getElementById(`sel-atr-${grupo}`);
  const nome = sel?.value?.trim();
  if (!nome) return;
  try {
    await salvarMapeamento(rpgId, nome, grupo);
    mostrarToast(`✓ "${nome}" mapeado para ${GRUPO_INFO[grupo].label}`, 'ok');
    renderAttrMappingUI();
  } catch(e) { mostrarToast(e.message, 'erro'); }
}

async function atrMappingRemover(rpgId, nome, grupo) {
  if (!confirm(`Remover "${nome}" do grupo ${GRUPO_INFO[grupo].label}?`)) return;
  try {
    await removerMapeamento(rpgId, nome);
    mostrarToast(`✓ "${nome}" removido`, '');
    renderAttrMappingUI();
  } catch(e) { mostrarToast(e.message, 'erro'); }
}

// Hook: renderizar mapping ao entrar na aba config
const _origAbrirTab = window.abrirTab;
if (typeof _origAbrirTab === 'function') {
  window.abrirTab = function(tab, ...args) {
    const r = _origAbrirTab(tab, ...args);
    if (tab === 'config') setTimeout(renderAttrMappingUI, 100);
    return r;
  };
} else {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[onclick*="config"]') || e.target.closest('[data-tab="config"]');
    if (btn) setTimeout(renderAttrMappingUI, 200);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// I1 — CATÁLOGO DE ITENS (CRUD)
// ════════════════════════════════════════════════════════════════════════════
const CATALOGO_STATE = {
  itens: [],
  filtrados: [],
  itemEditando: null,
  bonusLinhas: [],    // [{ atributo, valor, modo }]
  efeitosLista: [],   // [{ tipo, gatilho, chance, efeito_aplicado }]
  visualConfig: { tipo_visual:'emoji', valor:'✨', cor_fundo:'#1a1a2e', cor_borda:'#888888', animacao:'none' }
};

const TIPO_DEFAULTS = {
  arma:        { slot:'arma_principal', grupo:'forca',        emoji:'⚔️' },
  escudo:      { slot:'arma_secundaria',grupo:'constituicao', emoji:'🛡️' },
  armadura:    { slot:'corpo',          grupo:'constituicao', emoji:'🥋' },
  calcas:      { slot:'pernas',         grupo:'constituicao', emoji:'👖' },
  amuleto:     { slot:'acessorio',      grupo:'',             emoji:'💎' },
  capacete:    { slot:'cabeca',         grupo:'constituicao', emoji:'⛑️' },
  botas:       { slot:'pes',            grupo:'destreza',     emoji:'👢' },
  capa:        { slot:'capa',           grupo:'',             emoji:'🧣' },
  consumivel:  { slot:'',               grupo:'',             emoji:'🧪' },
  material:    { slot:'',               grupo:'',             emoji:'🪨' },
  chave:       { slot:'',               grupo:'',             emoji:'🗝️' },
  customizado: { slot:'',               grupo:'',             emoji:'✨' }
};

const RARIDADE_CORES = {
  comum:    { borda:'#888888', fundo:'#1a1a2e', label:'COMUM',    badge:'badge-comum' },
  incomum:  { borda:'#2ecc71', fundo:'#0e1f14', label:'INCOMUM',  badge:'badge-incomum' },
  raro:     { borda:'#3498db', fundo:'#0e1620', label:'RARO',     badge:'badge-raro' },
  epico:    { borda:'#9b59b6', fundo:'#160e20', label:'ÉPICO',    badge:'badge-epico' },
  lendario: { borda:'#f39c12', fundo:'#1e150a', label:'LENDÁRIO', badge:'badge-lendario' }
};

function abrirCatalogo() {
  document.getElementById('modal-catalogo-overlay').style.display = 'flex';
  carregarCatalogo();
}
function fecharCatalogo() {
  document.getElementById('modal-catalogo-overlay').style.display = 'none';
}

async function carregarCatalogo() {
  const rpgId = CURRENT_RPG?.id; if (!rpgId) return;
  document.getElementById('cat-lista').innerHTML = '<div style="text-align:center;padding:40px;color:var(--suave);font-style:italic">Carregando...</div>';
  try {
    const data = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&order=nome`);
    CATALOGO_STATE.itens = data || [];
    filtrarCatalogo();
  } catch(e) {
    document.getElementById('cat-lista').innerHTML = `<div style="color:var(--perigo);padding:20px;text-align:center">${e.message}</div>`;
  }
}

function filtrarCatalogo() {
  const busca = (document.getElementById('cat-busca')?.value||'').toLowerCase();
  const tipo = document.getElementById('cat-filtro-tipo')?.value||'';
  const raridade = document.getElementById('cat-filtro-raridade')?.value||'';
  CATALOGO_STATE.filtrados = CATALOGO_STATE.itens.filter(it => {
    if (busca && !it.nome.toLowerCase().includes(busca)) return false;
    if (tipo && it.tipo_canonico !== tipo) return false;
    if (raridade && it.raridade !== raridade) return false;
    return true;
  });
  renderListaCatalogo();
}

function renderListaCatalogo() {
  const lista = CATALOGO_STATE.filtrados;
  const el = document.getElementById('cat-lista');
  document.getElementById('cat-subtitle').textContent = `${lista.length} item(ns) encontrado(s)`;
  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--suave);font-style:italic;font-size:0.85rem">Nenhum item. Crie o primeiro!</div>';
    return;
  }
  el.innerHTML = lista.map(it => {
    const rc = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
    const vc = it.visual_config || {};
    const emoji = (vc.tipo_visual==='emoji'||!vc.tipo_visual) ? (vc.valor||TIPO_DEFAULTS[it.tipo_canonico]?.emoji||'📦') : '📦';
    const corBorda = vc.cor_borda || rc.borda;
    const corFundo = vc.cor_fundo || rc.fundo;
    const bonus = it.atributos_bonus || {};
    const bKeys = Object.keys(bonus);
    const bonusText = bKeys.slice(0,3).map(k=>{
      const v=bonus[k]; const n=typeof v==='object'?v.valor:v;
      return `<span style="color:${n>0?'#4eca7e':'#e05040'}">${n>0?'+':''}${n} ${k}</span>`;
    }).join(' · ');
    return `<div class="cat-item-card" onclick="abrirFormItem('${it.id}')">
      <div class="cat-item-icon" style="background:${corFundo};border:2px solid ${corBorda}">${emoji}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto)">${it.nome}</span>
          <span class="cat-item-badge ${rc.badge}">${rc.label}</span>
        </div>
        <div style="font-size:0.7rem;color:var(--suave)">${it.tipo_canonico||''} ${it.subtipo?'· '+it.subtipo:''} ${it.nivel?'· Nv.'+it.nivel:''}</div>
        <div style="font-size:0.68rem;margin-top:2px">${bonusText}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button onclick="event.stopPropagation();abrirDarItem('${it.id}')" title="Dar a personagem" style="padding:5px 8px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.2);border-radius:5px;color:#4eca7e;font-size:0.7rem;cursor:pointer">🎁</button>
      </div>
    </div>`;
  }).join('');
}

// ── FORMULÁRIO DE ITEM ──
function abrirFormItem(id) {
  const overlay = document.getElementById('modal-item-overlay');
  CATALOGO_STATE.bonusLinhas = [];
  CATALOGO_STATE.efeitosLista = [];
  overlay.style.display = 'flex';
  trocarAbaItem('identidade');
  document.getElementById('fi-btn-duplicar').style.display = 'none';
  document.getElementById('fi-btn-deletar').style.display = 'none';
  if (!id) {
    // Novo item
    document.getElementById('form-item-titulo').textContent = 'Novo Item';
    document.getElementById('fi-id').value = '';
    document.getElementById('fi-nome').value = '';
    document.getElementById('fi-tipo').value = '';
    document.getElementById('fi-raridade').value = 'comum';
    document.getElementById('fi-subtipo').value = '';
    document.getElementById('fi-slot').value = '';
    document.getElementById('fi-grupo').value = '';
    document.getElementById('fi-descricao').value = '';
    document.getElementById('fi-aceita-amuleto').checked = true;
    document.getElementById('fi-nivel').value = 1;
    document.getElementById('fi-nivel-val').textContent = '1';
    document.getElementById('fi-nivel-min').value = 1;
    document.getElementById('fi-nivel-min-val').textContent = '1';
    document.getElementById('fi-unico').checked = false;
    document.getElementById('fi-droppable').checked = false;
    document.getElementById('fi-drop-config').style.display = 'none';
    CATALOGO_STATE.visualConfig = { tipo_visual:'emoji', valor:'✨', cor_fundo:'#1a1a2e', cor_borda:'#888888', animacao:'none' };
    _aplicarVisualConfig();
    renderLinhasBonus();
    renderEfeitosLista();
    atualizarPreviewCard();
    return;
  }
  // Editar existente
  const it = CATALOGO_STATE.itens.find(x=>x.id==id);
  if (!it) return;
  CATALOGO_STATE.itemEditando = it;
  document.getElementById('form-item-titulo').textContent = 'Editar: ' + it.nome;
  document.getElementById('fi-id').value = it.id;
  document.getElementById('fi-nome').value = it.nome || '';
  document.getElementById('fi-tipo').value = it.tipo_canonico || '';
  document.getElementById('fi-raridade').value = it.raridade || 'comum';
  document.getElementById('fi-subtipo').value = it.subtipo || '';
  document.getElementById('fi-slot').value = it.slot_padrao || '';
  document.getElementById('fi-grupo').value = it.grupo_atributo_base || '';
  document.getElementById('fi-descricao').value = it.descricao || '';
  document.getElementById('fi-aceita-amuleto').checked = it.aceita_amuleto_aninhado !== false;
  document.getElementById('fi-nivel').value = it.nivel || 1;
  document.getElementById('fi-nivel-val').textContent = it.nivel || 1;
  document.getElementById('fi-nivel-min').value = it.nivel_minimo_uso || 1;
  document.getElementById('fi-nivel-min-val').textContent = it.nivel_minimo_uso || 1;
  document.getElementById('fi-unico').checked = !!it.unico_no_mundo;
  document.getElementById('fi-droppable').checked = !!it.droppable;
  toggleDropConfig();
  if (it.droppable) {
    document.getElementById('fi-drop-rate').value = it.drop_rate || 5;
    document.getElementById('fi-tier-min').value = it.tier_min || 1;
    document.getElementById('fi-tier-max').value = it.tier_max || 5;
  }
  CATALOGO_STATE.visualConfig = it.visual_config || { tipo_visual:'emoji', valor:'✨', cor_fundo:'#1a1a2e', cor_borda:'#888888', animacao:'none' };
  _aplicarVisualConfig();
  // Carregar bônus
  const bonus = it.atributos_bonus || {};
  CATALOGO_STATE.bonusLinhas = Object.entries(bonus).map(([k,v])=>{
    if (typeof v === 'object') return {atributo:k, valor:v.valor, modo:'pct'};
    return {atributo:k, valor:v, modo:'abs'};
  });
  renderLinhasBonus();
  CATALOGO_STATE.efeitosLista = it.efeitos || [];
  renderEfeitosLista();
  document.getElementById('fi-btn-duplicar').style.display = '';
  document.getElementById('fi-btn-deletar').style.display = '';
  atualizarPreviewCard();
}

function fecharFormItem() {
  document.getElementById('modal-item-overlay').style.display = 'none';
  CATALOGO_STATE.itemEditando = null;
}

// Abre o modal avançado de edição a partir do catálogo das tabelas (sincroniza INV.itemDefs → CATALOGO_STATE)
function abrirEditarItemCatalogo(id) {
  // Sincroniza todos os itens de INV para CATALOGO_STATE se necessário
  if (INV.itemDefs && INV.itemDefs.length) {
    INV.itemDefs.forEach(def => {
      if (!CATALOGO_STATE.itens.find(x => x.id === def.id)) {
        CATALOGO_STATE.itens.push(def);
      } else {
        // Atualiza a entrada existente com os dados mais recentes
        const idx = CATALOGO_STATE.itens.findIndex(x => x.id === def.id);
        if (idx >= 0) CATALOGO_STATE.itens[idx] = { ...CATALOGO_STATE.itens[idx], ...def };
      }
    });
  }
  abrirFormItem(id);
}

function trocarAbaItem(aba) {
  document.querySelectorAll('.item-form-tab').forEach(b => {
    const ativo = b.dataset.tab === aba;
    b.classList.toggle('active', ativo);
    b.style.color = ativo ? 'var(--primario)' : 'var(--suave)';
    b.style.borderBottomColor = ativo ? 'var(--primario)' : 'transparent';
  });
  document.querySelectorAll('.item-form-aba').forEach(d => {
    d.style.display = d.id === 'aba-' + aba ? 'block' : 'none';
  });
}

function itemTipoChange() {
  const tipo = document.getElementById('fi-tipo').value;
  const def = TIPO_DEFAULTS[tipo] || {};
  if (def.slot_padrao || def.slot) document.getElementById('fi-slot').value = def.slot_padrao || def.slot;
  if (def.grupo) document.getElementById('fi-grupo').value = def.grupo;
  if (def.emoji && !document.getElementById('fi-emoji').value) {
    CATALOGO_STATE.visualConfig.valor = def.emoji;
    document.getElementById('fi-emoji').value = def.emoji;
  }
  atualizarPreviewCard();
}

function itemRaridadeChange() {
  const rar = document.getElementById('fi-raridade').value;
  const rc = RARIDADE_CORES[rar] || RARIDADE_CORES.comum;
  CATALOGO_STATE.visualConfig.cor_borda = rc.borda;
  CATALOGO_STATE.visualConfig.cor_fundo = rc.fundo;
  document.getElementById('fi-cor-borda').value = rc.borda;
  document.getElementById('fi-cor-fundo').value = rc.fundo;
  document.getElementById('fi-cor-borda-txt').textContent = rc.borda;
  document.getElementById('fi-cor-fundo-txt').textContent = rc.fundo;
  atualizarPreviewCard();
}

function setVisualTipo(tipo) {
  CATALOGO_STATE.visualConfig.tipo_visual = tipo;
  document.querySelectorAll('.vis-tipo-btn').forEach(b=>{
    const ativo = b.dataset.tipo === tipo;
    b.style.background = ativo ? 'rgba(200,168,75,0.15)' : 'rgba(30,45,66,0.4)';
    b.style.borderColor = ativo ? 'rgba(200,168,75,0.4)' : 'var(--borda)';
    b.style.color = ativo ? 'var(--destaque)' : 'var(--suave)';
  });
  document.getElementById('vis-campo-emoji').style.display = tipo==='emoji' ? '' : 'none';
  document.getElementById('vis-campo-url').style.display = tipo==='url' ? '' : 'none';
  atualizarPreviewCard();
}

function fiImgurlChange() {
  const val = document.getElementById('fi-imgurl').value.trim();
  const wrap = document.getElementById('fi-img-preview-wrap');
  const img = document.getElementById('fi-img-preview');
  if (val) { img.src = val; wrap.style.display = ''; }
  else { wrap.style.display = 'none'; }
  atualizarPreviewCard();
}

async function fiUploadImagem(input) {
  const file = input.files[0]; if (!file) return;
  try {
    mostrarToast('Enviando imagem…', 'info');
    const url = await uploadToStorage(file, 'items');
    document.getElementById('fi-imgurl').value = url;
    const wrap = document.getElementById('fi-img-preview-wrap');
    const img = document.getElementById('fi-img-preview');
    img.src = url; wrap.style.display = '';
    atualizarPreviewCard();
    mostrarToast('Imagem enviada!', 'ok');
  } catch(e) {
    mostrarToast('Erro no upload da imagem', 'erro');
    console.error(e);
  }
}

function setAnimacao(anim) {
  CATALOGO_STATE.visualConfig.animacao = anim;
  document.querySelectorAll('.anim-btn').forEach(b=>{
    const ativo = b.dataset.anim === anim;
    b.style.background = ativo ? 'rgba(200,168,75,0.15)' : 'rgba(30,45,66,0.4)';
    b.style.borderColor = ativo ? 'rgba(200,168,75,0.4)' : 'var(--borda)';
    b.style.color = ativo ? 'var(--destaque)' : 'var(--suave)';
  });
  atualizarPreviewCard();
}

function restaurarAparenciaPadrao() {
  const tipo = document.getElementById('fi-tipo').value;
  const def = TIPO_DEFAULTS[tipo] || TIPO_DEFAULTS.customizado;
  const rar = document.getElementById('fi-raridade').value;
  const rc = RARIDADE_CORES[rar] || RARIDADE_CORES.comum;
  CATALOGO_STATE.visualConfig = { tipo_visual:'emoji', valor:def.emoji, cor_fundo:rc.fundo, cor_borda:rc.borda, animacao:'none' };
  document.getElementById('fi-emoji').value = def.emoji;
  document.getElementById('fi-cor-borda').value = rc.borda;
  document.getElementById('fi-cor-fundo').value = rc.fundo;
  document.getElementById('fi-cor-borda-txt').textContent = rc.borda;
  document.getElementById('fi-cor-fundo-txt').textContent = rc.fundo;
  setAnimacao('none');
  atualizarPreviewCard();
}

function _aplicarVisualConfig() {
  const vc = CATALOGO_STATE.visualConfig;
  setVisualTipo(vc.tipo_visual || 'emoji');
  document.getElementById('fi-emoji').value = vc.tipo_visual==='emoji' ? (vc.valor||'✨') : '✨';
  const imgUrl = vc.tipo_visual==='url' ? (vc.valor||'') : '';
  document.getElementById('fi-imgurl').value = imgUrl;
  // Mostrar preview se houver imagem
  const wrap = document.getElementById('fi-img-preview-wrap');
  const previewImg = document.getElementById('fi-img-preview');
  if (imgUrl) { previewImg.src = imgUrl; wrap.style.display = ''; }
  else { wrap.style.display = 'none'; }
  document.getElementById('fi-cor-borda').value = vc.cor_borda || '#888888';
  document.getElementById('fi-cor-fundo').value = vc.cor_fundo || '#1a1a2e';
  document.getElementById('fi-cor-borda-txt').textContent = vc.cor_borda || '#888888';
  document.getElementById('fi-cor-fundo-txt').textContent = vc.cor_fundo || '#1a1a2e';
  // animação
  document.querySelectorAll('.anim-btn').forEach(b=>{
    const ativo = b.dataset.anim === (vc.animacao||'none');
    b.style.background = ativo ? 'rgba(200,168,75,0.15)' : 'rgba(30,45,66,0.4)';
    b.style.borderColor = ativo ? 'rgba(200,168,75,0.4)' : 'var(--borda)';
    b.style.color = ativo ? 'var(--destaque)' : 'var(--suave)';
  });
}

function atualizarPreviewCard() {
  const vc = CATALOGO_STATE.visualConfig;
  const rar = document.getElementById('fi-raridade')?.value || 'comum';
  const rc = RARIDADE_CORES[rar] || RARIDADE_CORES.comum;
  const nivel = document.getElementById('fi-nivel')?.value || 1;
  const nome = document.getElementById('fi-nome')?.value || 'Nome do Item';

  // Cor de borda e fundo (live do seletor)
  const borda = document.getElementById('fi-cor-borda')?.value || rc.borda;
  const fundo = document.getElementById('fi-cor-fundo')?.value || rc.fundo;
  document.getElementById('fi-cor-borda-txt').textContent = borda;
  document.getElementById('fi-cor-fundo-txt').textContent = fundo;
  CATALOGO_STATE.visualConfig.cor_borda = borda;
  CATALOGO_STATE.visualConfig.cor_fundo = fundo;

  // Visual
  let iconHtml = '';
  const tipo = vc.tipo_visual;
  if (tipo === 'url') {
    const url = document.getElementById('fi-imgurl')?.value;
    iconHtml = url ? `<img src="${url}" style="width:48px;height:48px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'">` : '📦';
    CATALOGO_STATE.visualConfig.valor = url;
  } else {
    const em = document.getElementById('fi-emoji')?.value || '✨';
    CATALOGO_STATE.visualConfig.valor = em;
    iconHtml = em;
  }

  const card = document.getElementById('fi-preview-card');
  card.style.borderColor = borda;
  card.style.background = fundo;
  const anim = vc.animacao || 'none';
  card.className = anim !== 'none' ? `anim-${anim}` : '';

  document.getElementById('fi-preview-badge').textContent = rc.label;
  document.getElementById('fi-preview-badge').className = `cat-item-badge ${rc.badge}`;
  document.getElementById('fi-preview-icon').innerHTML = iconHtml;
  document.getElementById('fi-preview-nome').textContent = nome;
  document.getElementById('fi-preview-nivel').textContent = `Nível ${nivel}`;

  // Stats no preview
  const statsEl = document.getElementById('fi-preview-stats');
  statsEl.innerHTML = CATALOGO_STATE.bonusLinhas.map(l=>{
    const n = parseFloat(l.valor)||0;
    const suf = l.modo==='pct' ? '%' : '';
    const cor = n >= 0 ? '#4eca7e' : '#e05040';
    return `<div style="color:${cor}">${n>=0?'↑':'↓'} ${n>=0?'+':''}${n}${suf} ${l.atributo}</div>`;
  }).join('') || '';

  // Painel stats na aba mecânica
  const prev = document.getElementById('fi-stats-preview-mecanica');
  if (prev) {
    prev.innerHTML = CATALOGO_STATE.bonusLinhas.length
      ? CATALOGO_STATE.bonusLinhas.map(l=>{
          const n = parseFloat(l.valor)||0;
          const suf = l.modo==='pct' ? '%' : '';
          const cor = n >= 0 ? '#4eca7e' : '#e05040';
          return `<span style="color:${cor}">${n>=0?'↑':'↓'} ${n>=0?'+':''}${n}${suf} ${l.atributo}</span>`;
        }).join('  ')
      : '<span style="color:var(--suave);font-style:italic">Sem bônus definidos</span>';
  }
}

// ── BÔNUS DE ATRIBUTOS ──
function adicionarLinhaBonus() {
  CATALOGO_STATE.bonusLinhas.push({ atributo:'', valor:0, modo:'abs' });
  renderLinhasBonus();
}

function renderLinhasBonus() {
  const el = document.getElementById('fi-bonus-lista');
  const temPenalidade = CATALOGO_STATE.bonusLinhas.some(l => parseFloat(l.valor) < 0);
  document.getElementById('fi-tradeoff-aviso').style.display = temPenalidade ? '' : 'none';

  if (!CATALOGO_STATE.bonusLinhas.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Nenhum bônus definido</div>';
    return;
  }
  // Atributos numéricos disponíveis no jogo
  const attrsDef = (RPG_DATA?.attrDefs || []).filter(a => a.tipo === 'number' || a.tipo === 'status' || !a.tipo);
  el.innerHTML = CATALOGO_STATE.bonusLinhas.map((l,i)=>{
    const n = parseFloat(l.valor)||0;
    const cor = n < 0 ? '#e05040' : '#4eca7e';
    const optsAttr = attrsDef.map(a =>
      `<option value="${a.nome}" ${l.atributo===a.nome?'selected':''}>${a.nome}</option>`
    ).join('');
    return `<div class="bonus-linha">
      <select onchange="CATALOGO_STATE.bonusLinhas[${i}].atributo=this.value;atualizarPreviewCard()" style="flex:2;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;padding:5px 7px;color:var(--texto);font-size:0.8rem">
        <option value="">— Atributo —</option>
        ${optsAttr}
      </select>
      <input type="number" value="${l.valor}" oninput="CATALOGO_STATE.bonusLinhas[${i}].valor=parseFloat(this.value)||0;renderLinhasBonus();atualizarPreviewCard()" style="flex:1;background:var(--escuro);border:1px solid ${cor};border-radius:4px;padding:5px 7px;color:${cor};font-size:0.85rem;text-align:center;min-width:60px">
      <select onchange="CATALOGO_STATE.bonusLinhas[${i}].modo=this.value" style="padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-size:0.72rem">
        <option value="abs" ${l.modo==='abs'?'selected':''}>Fixo</option>
        <option value="pct" ${l.modo==='pct'?'selected':''}>%</option>
      </select>
      <button onclick="CATALOGO_STATE.bonusLinhas.splice(${i},1);renderLinhasBonus();atualizarPreviewCard()" style="background:none;border:none;color:#e05040;cursor:pointer;font-size:1rem;padding:2px 4px">×</button>
    </div>`;
  }).join('');
}

// ── EFEITOS ──
function adicionarEfeito() {
  CATALOGO_STATE.efeitosLista.push({ tipo:'proc', gatilho:'ao_atacar', chance:0.30, efeito_aplicado:{ tipo:'debuff', debuff:'Atordoado', duracao_turnos:1, alvo:'alvo_do_ataque' } });
  renderEfeitosLista();
}

function renderEfeitosLista() {
  const el = document.getElementById('fi-efeitos-lista');
  if (!CATALOGO_STATE.efeitosLista.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;text-align:center;padding:16px">Nenhum efeito. Clique em "＋ Efeito" para adicionar.</div>';
    return;
  }
  el.innerHTML = CATALOGO_STATE.efeitosLista.map((ef,i)=>{
    const desc = _descreverEfeito(ef);
    return `<div style="padding:10px;background:rgba(123,47,190,0.08);border:1px solid rgba(123,47,190,0.25);border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="font-size:0.72rem;color:#a070d8;line-height:1.4">${desc}</div>
        <button onclick="CATALOGO_STATE.efeitosLista.splice(${i},1);renderEfeitosLista()" style="background:none;border:none;color:#e05040;cursor:pointer;font-size:0.9rem;padding:0 0 0 6px;flex-shrink:0">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div>
          <label style="display:block;font-size:0.58rem;color:var(--suave);margin-bottom:2px">Tipo</label>
          <select onchange="CATALOGO_STATE.efeitosLista[${i}].tipo=this.value;renderEfeitosLista()" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
            <option value="proc" ${ef.tipo==='proc'?'selected':''}>Proc (chance)</option>
            <option value="aura" ${ef.tipo==='aura'?'selected':''}>Aura passiva</option>
            <option value="condicional" ${ef.tipo==='condicional'?'selected':''}>Condicional</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:0.58rem;color:var(--suave);margin-bottom:2px">Gatilho</label>
          <select onchange="CATALOGO_STATE.efeitosLista[${i}].gatilho=this.value;renderEfeitosLista()" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
            <option value="ao_atacar" ${ef.gatilho==='ao_atacar'?'selected':''}>Ao atacar</option>
            <option value="ao_ser_atacado" ${ef.gatilho==='ao_ser_atacado'?'selected':''}>Ao ser atacado</option>
            <option value="ao_curar" ${ef.gatilho==='ao_curar'?'selected':''}>Ao curar</option>
            <option value="ao_matar" ${ef.gatilho==='ao_matar'?'selected':''}>Ao matar</option>
            <option value="ao_usar_habilidade" ${ef.gatilho==='ao_usar_habilidade'?'selected':''}>Ao usar habilidade</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-size:0.58rem;color:var(--suave);margin-bottom:2px">Chance (%)</label>
          <input type="number" min="1" max="100" value="${Math.round((ef.chance||0.3)*100)}" onchange="CATALOGO_STATE.efeitosLista[${i}].chance=this.value/100;renderEfeitosLista()" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center">
        </div>
        <div>
          <label style="display:block;font-size:0.58rem;color:var(--suave);margin-bottom:2px">Efeito aplicado</label>
          <select onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.tipo=this.value;renderEfeitosLista()" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem">
            <option value="debuff"         ${ef.efeito_aplicado?.tipo==='debuff'?'selected':''}>☠ Debuff</option>
            <option value="buff"           ${ef.efeito_aplicado?.tipo==='buff'?'selected':''}>✨ Buff</option>
            <option value="dano"           ${ef.efeito_aplicado?.tipo==='dano'?'selected':''}>💥 Dano</option>
            <option value="cura"           ${ef.efeito_aplicado?.tipo==='cura'?'selected':''}>❤ Cura (HP)</option>
            <option value="hp"             ${ef.efeito_aplicado?.tipo==='hp'?'selected':''}>❤ Alterar HP</option>
            <option value="recurso"        ${ef.efeito_aplicado?.tipo==='recurso'?'selected':''}>✨ Alterar Recurso</option>
            <option value="atributo"       ${ef.efeito_aplicado?.tipo==='atributo'?'selected':''}>⬆ Modificar Atributo</option>
            <option value="remover_debuff" ${ef.efeito_aplicado?.tipo==='remover_debuff'?'selected':''}>🌟 Remover Debuff</option>
          </select>
        </div>
      </div>
      ${(()=>{
        const ea = ef.efeito_aplicado || {};
        const attrsDef = (RPG_DATA?.attrDefs||[]).filter(a=>a.tipo==='number'||a.tipo==='status'||!a.tipo);
        const attrOpts = attrsDef.map(a=>`<option value="${a.nome}" ${ea.atributo===a.nome||ea.debuff===a.nome?'selected':''}>${a.nome}</option>`).join('');
        if (ea.tipo==='debuff') return `<div style="margin-top:6px"><label style="display:block;font-size:0.58rem;color:var(--suave);margin-bottom:2px">Nome do debuff & duração (turnos)</label><div style="display:flex;gap:4px"><input type="text" value="${ea.debuff||''}" placeholder="Ex: Atordoado" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.debuff=this.value" style="flex:2;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem"><input type="number" min="1" value="${ea.duracao_turnos||1}" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.duracao_turnos=parseInt(this.value)" style="flex:1;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center"></div></div>`;
        if (ea.tipo==='atributo') return `<div style="margin-top:6px;display:flex;gap:4px"><select onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.atributo=this.value" style="flex:2;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.75rem"><option value="">— Atributo —</option>${attrOpts}</select><input type="number" value="${ea.valor||0}" placeholder="Valor" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.valor=parseFloat(this.value)||0" style="flex:1;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center"><input type="number" min="1" value="${ea.duracao_turnos||1}" placeholder="Turnos" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.duracao_turnos=parseInt(this.value)" style="flex:1;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center"></div>`;
        if (ea.tipo==='recurso') return `<div style="margin-top:6px;display:flex;gap:4px"><input type="text" value="${ea.recurso||''}" placeholder="Ex: Mana" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.recurso=this.value" style="flex:2;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem"><input type="number" value="${ea.valor||0}" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.valor=parseFloat(this.value)||0" style="flex:1;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center"></div>`;
        if (ea.tipo==='dano'||ea.tipo==='cura'||ea.tipo==='hp') return `<div style="margin-top:6px"><input type="number" value="${ea.valor||0}" placeholder="Valor" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.valor=parseFloat(this.value)||0" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;text-align:center"></div>`;
        if (ea.tipo==='remover_debuff') return `<div style="margin-top:6px"><input type="text" value="${ea.debuff||''}" placeholder="Nome do debuff a remover" onchange="CATALOGO_STATE.efeitosLista[${i}].efeito_aplicado.debuff=this.value" style="width:100%;padding:5px;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem"></div>`;
        return '';
      })()}
    </div>`;
  }).join('');
}

function _descreverEfeito(ef) {
  const ch = Math.round((ef.chance||0)*100);
  const ea = ef.efeito_aplicado || {};
  const gatilho = (ef.gatilho||'').replace(/_/g,' ');
  if (ef.tipo === 'proc') {
    if (ea.tipo==='debuff') return `${ch}% de chance de ${ea.debuff||'debuff'} ${ea.duracao_turnos?`por ${ea.duracao_turnos}t`:''} ${gatilho}`;
    if (ea.tipo==='dano') return `${ch}% de chance de causar ${ea.valor||'?'} dano ${gatilho}`;
    if (ea.tipo==='cura') return `${ch}% de chance de curar ${ea.valor||'?'} HP ${gatilho}`;
    return `${ch}% de chance de efeito ${gatilho}`;
  }
  if (ef.tipo === 'aura') return `Aura passiva: ${ea.efeito||'boost'} em ${ea.atributo||'atributo'}`;
  if (ef.tipo === 'condicional') return `Condicional: ${ef.condicao||'condição'}`;
  return 'Efeito';
}

function toggleDropConfig() {
  const ativo = document.getElementById('fi-droppable')?.checked;
  document.getElementById('fi-drop-config').style.display = ativo ? '' : 'none';
}

// ── SALVAR ITEM ──
async function salvarItem() {
  const id = document.getElementById('fi-id').value;
  const nome = document.getElementById('fi-nome').value.trim();
  const tipo = document.getElementById('fi-tipo').value;
  if (!nome) { mostrarToast('Nome obrigatório', 'erro'); trocarAbaItem('identidade'); return; }
  if (!tipo) { mostrarToast('Tipo canônico obrigatório', 'erro'); trocarAbaItem('identidade'); return; }

  // Verificar trade-off severo
  const severo = CATALOGO_STATE.bonusLinhas.some(l => parseFloat(l.valor) < 0 && Math.abs(parseFloat(l.valor)) > 10);
  if (severo && !confirm('⚠️ Trade-off severo detectado. Confirmar salvar?')) return;

  const bonusObj = {};
  for (const l of CATALOGO_STATE.bonusLinhas) {
    if (!l.atributo) continue;
    bonusObj[l.atributo] = l.modo === 'pct' ? { modo:'pct', valor: parseFloat(l.valor)||0 } : parseFloat(l.valor)||0;
  }
  const tradeoffs = {};
  for (const [k,v] of Object.entries(bonusObj)) {
    const n = typeof v==='object' ? v.valor : v;
    if (n < 0) tradeoffs[k] = v;
  }

  const vc = { ...CATALOGO_STATE.visualConfig };
  if (vc.tipo_visual === 'emoji') vc.valor = document.getElementById('fi-emoji').value || '✨';
  if (vc.tipo_visual === 'url') vc.valor = document.getElementById('fi-imgurl').value || '';

  const iconeEmoji = vc.tipo_visual === 'emoji' ? (vc.valor || '✨') : (TIPO_DEFAULTS[tipo]?.emoji || '📦');

  const payload = {
    rpg_id: CURRENT_RPG.id,
    nome,
    icone: iconeEmoji,
    tipo_canonico: tipo,
    subtipo: document.getElementById('fi-subtipo').value.trim() || null,
    raridade: document.getElementById('fi-raridade').value,
    descricao: document.getElementById('fi-descricao').value.trim() || null,
    slot_padrao: document.getElementById('fi-slot').value || null,
    grupo_atributo_base: document.getElementById('fi-grupo').value || null,
    aceita_amuleto_aninhado: document.getElementById('fi-aceita-amuleto').checked,
    atributos_bonus: Object.keys(bonusObj).length ? bonusObj : null,
    trade_offs: Object.keys(tradeoffs).length ? tradeoffs : null,
    efeitos: CATALOGO_STATE.efeitosLista.length ? CATALOGO_STATE.efeitosLista : null,
    visual_config: vc,
    nivel: parseInt(document.getElementById('fi-nivel').value) || 1,
    nivel_minimo_uso: parseInt(document.getElementById('fi-nivel-min').value) || 1,
    unico_no_mundo: document.getElementById('fi-unico').checked,
    droppable: document.getElementById('fi-droppable').checked,
    drop_rate: document.getElementById('fi-droppable').checked ? (parseFloat(document.getElementById('fi-drop-rate').value)||5) : null,
    tier_min: document.getElementById('fi-droppable').checked ? (parseInt(document.getElementById('fi-tier-min').value)||1) : null,
    tier_max: document.getElementById('fi-droppable').checked ? (parseInt(document.getElementById('fi-tier-max').value)||5) : null
  };

  const btn = document.getElementById('fi-btn-salvar');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    let savedRow = null;
    if (id) {
      const rows = await sb(`item_catalog?id=eq.${id}`, { method:'PATCH', prefer:'return=representation', body: JSON.stringify(payload) });
      savedRow = rows?.[0] || { ...payload, id: parseInt(id) };
      mostrarToast('✓ Item atualizado', 'ok');
    } else {
      const rows = await sb('item_catalog', { method:'POST', prefer:'return=representation', body: JSON.stringify(payload) });
      savedRow = rows?.[0] || payload;
      mostrarToast('✓ Item criado', 'ok');
    }
    // Sincronizar com INV.itemDefs para que renderTabelasTab reflita a mudança
    if (savedRow && INV.itemDefs) {
      const idx = INV.itemDefs.findIndex(d => d.id === savedRow.id);
      if (idx >= 0) INV.itemDefs[idx] = { ...INV.itemDefs[idx], ...savedRow };
      else INV.itemDefs.push(savedRow);
    }
    fecharFormItem();
    carregarCatalogo();
    renderTabelasTab();
  } catch(e) {
    mostrarToast('Erro: ' + (e.message || 'Falha ao salvar'), 'erro');
  } finally {
    btn.disabled = false; btn.textContent = '💾 SALVAR ITEM';
  }
}

async function duplicarItemAtual() {
  const it = CATALOGO_STATE.itemEditando; if (!it) return;
  if (!confirm(`Duplicar "${it.nome}"?`)) return;
  const copy = { ...it };
  delete copy.id;
  copy.nome = it.nome + ' (cópia)';
  try {
    await sb('item_catalog', { method:'POST', body: JSON.stringify(copy) });
    mostrarToast('✓ Item duplicado', 'ok');
    fecharFormItem();
    carregarCatalogo();
  } catch(e) { mostrarToast('Erro ao duplicar: ' + e.message, 'erro'); }
}

async function deletarItemAtual() {
  const id = document.getElementById('fi-id').value;
  const nome = document.getElementById('fi-nome').value;
  if (!id) return;
  if (!confirm(`Deletar "${nome}" permanentemente?`)) return;
  try {
    await sb(`item_catalog?id=eq.${id}`, { method:'DELETE', headers:{'Prefer':'return=minimal'} });
    mostrarToast('✓ Item deletado', '');
    fecharFormItem();
    carregarCatalogo();
  } catch(e) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── DAR ITEM A PERSONAGEM ──
let _darItemId = null;
function abrirDarItem(itemId) {
  _darItemId = itemId;
  const it = CATALOGO_STATE.itens.find(x=>x.id==itemId);
  document.getElementById('dar-item-nome').textContent = it?.nome || 'item';
  const sel = document.getElementById('dar-item-personagem');
  const chars = RPG_DATA?.characters || [];
  sel.innerHTML = '<option value="">Selecione...</option>' + chars.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
  document.getElementById('modal-dar-item-overlay').style.display = 'flex';
}

async function confirmarDarItem() {
  const personagem = document.getElementById('dar-item-personagem').value;
  if (!personagem) { mostrarToast('Selecione um personagem', 'erro'); return; }
  const it = CATALOGO_STATE.itens.find(x=>x.id==_darItemId);
  if (!it) return;
  try {
    const char = (RPG_DATA?.characters||[]).find(c=>c.nome===personagem);
    if (!char) throw new Error('Personagem não encontrado');
    await sb('inventario', {
      method:'POST',
      body: JSON.stringify({
        rpg_id: CURRENT_RPG.id,
        character_id: char.id,
        item_catalog_id: it.id,
        quantidade: 1,
        equipado: false,
        bloqueado_por_nivel: char.nivel ? (char.nivel < (it.nivel_minimo_uso||1)) : false,
        origem: 'doacao_mestre'
      }),
      headers:{'Prefer':'return=minimal'}
    });
    mostrarToast(`✓ ${it.nome} dado a ${personagem}`, 'ok');
    document.getElementById('modal-dar-item-overlay').style.display = 'none';
    // Broadcast
    if (typeof emitirEvento === 'function') {
      emitirEvento('item_dropado', {
        rpg_id: CURRENT_RPG.id,
        personagem_destino: personagem,
        item: { nome:it.nome, tipo_canonico:it.tipo_canonico, raridade:it.raridade, nivel:it.nivel, visual_config:it.visual_config, atributos_bonus:it.atributos_bonus, trade_offs:it.trade_offs, efeitos:it.efeitos },
        origem: 'doacao_mestre'
      });
    }
  } catch(e) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── BOTÃO DE ACESSO AO CATÁLOGO ──
// Adicionar botão nas configurações mestre
document.addEventListener('DOMContentLoaded', ()=>{
  // Injetar botão de acesso ao catálogo na barra de tabs ou aba de dados
  const tabBtns = document.querySelector('#tabelas-mestre-btns');
  if (tabBtns) {
    const btn = document.createElement('button');
    btn.style.cssText='padding:7px 10px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:6px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;letter-spacing:0.06em';
    btn.textContent = '📦 Itens';
    btn.setAttribute('data-mestre-only','');
    btn.onclick = abrirCatalogo;
    tabBtns.appendChild(btn);
  }
});

console.log('[RPGHUB] ✓ Parte 1 carregada — A1 Mapeamento · A2 UI Mapping · I1 Catálogo de Itens');

// ════════════════════════════════════════════════════════════════════════════
// PARTE 2 — INVENTÁRIO INDIVIDUAL, EQUIP/DESEQUIP, CARGA, MOEDAS
// ════════════════════════════════════════════════════════════════════════════

// ── ESTADO GLOBAL DO INVENTÁRIO (campos já declarados no bloco de tabelas) ──────────────────────
// INV.catalogo, INV.inventarios, INV.carregado, INV.charAtivo, INV.charId já existem em INV global

// Slots canônicos e config visual
const INV_SLOTS = [
  { id:'arma_principal',   label:'Arma',        emoji:'⚔️', col:1 },
  { id:'arma_secundaria',  label:'Escudo/Aux',  emoji:'🛡️', col:2 },
  { id:'cabeca',           label:'Cabeça',      emoji:'⛑️', col:1 },
  { id:'corpo',            label:'Corpo',       emoji:'🥋', col:2 },
  { id:'pernas',           label:'Pernas',      emoji:'👖', col:1 },
  { id:'pes',              label:'Pés',         emoji:'👢', col:2 },
  { id:'capa',             label:'Capa',        emoji:'🧣', col:1 },
  { id:'acessorio',        label:'Acessório',   emoji:'💎', col:2 },
];

// ── A3 — CÁLCULO DE MÉDIA DE GRUPO ───────────────────────────────────────
async function calcularMediaGrupo(rpgId, grupoBase) {
  await carregarMapeamento(rpgId);
  const attrNomes = getAtributosPorGrupo(rpgId, grupoBase);
  if (!attrNomes.length) return { media: 0, atributos: [], personagens: [] };
  const chars = (RPG_DATA?.characters || []).filter(c => {
    const ca = c.custom_attrs || {};
    const tipo = ca.tipo || 'jogador';
    return tipo === 'jogador' && (c.hp_atual ?? (ca.hp_max||100)) > 0;
  });
  if (!chars.length) return { media: 0, atributos: attrNomes, personagens: [] };
  const mediasChar = chars.map(c => {
    const atribs = c.custom_attrs?.atributos || {};
    const vals = attrNomes.map(n => parseFloat(atribs[n]) || 0);
    const media = vals.reduce((a,b)=>a+b, 0) / (vals.length || 1);
    return { nome: c.nome, media };
  });
  const mediaGeral = mediasChar.reduce((a,b)=>a+b.media, 0) / (mediasChar.length || 1);
  return { media: Math.round(mediaGeral * 100) / 100, atributos: attrNomes, personagens: mediasChar };
}

// ── ABRIR / FECHAR INVENTÁRIO ─────────────────────────────────────────────
async function abrirInventario(nomeChar) {
  // Support both RPG_DATA (main view) and AR.chars (arena view)
  let c = RPG_DATA?.characters?.find(x => x.nome === nomeChar);
  if (!c && typeof AR !== 'undefined' && AR?.chars) {
    c = AR.chars.find(x => x.nome === nomeChar);
  }
  if (!c) return;
  INV.charAtivo = nomeChar;
  INV.charId    = c.id;
  // Ensure item defs are loaded
  if (!INV.itemDefs.length && (RPG_DATA?.rpgId || CURRENT_RPG?.id)) {
    await invCarregarDados(RPG_DATA?.rpgId || CURRENT_RPG?.id);
  }
  document.getElementById('inv-titulo').textContent = `🎒 ${nomeChar}`;
  document.getElementById('modal-inv-overlay').style.display = 'flex';
  invTrocarAba('equipamentos');
  await carregarInventarioChar(c.id);
}

function fecharInventario() {
  document.getElementById('modal-inv-overlay').style.display = 'none';
}

// ── I2 — CARREGAR INVENTÁRIO ──────────────────────────────────────────────
async function carregarInventarioChar(charId) {
  if (!charId) return;
  try {
    // JOIN: inventario → item_catalog
    const data = await sb(
      `inventario?character_id=eq.${charId}&rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&select=*,item:item_catalog_id(*)`
    );
    INV.inventarios[charId] = data || [];
    INV.carregado[charId] = true;
    renderInvCompleto();
  } catch(e) {
    console.warn('[I2] Erro ao carregar inventário:', e);
    INV.inventarios[charId] = [];
    renderInvCompleto();
  }
}

function renderInvCompleto() {
  renderInvSlots();
  renderInvMochila();
  renderInvCarga();
  renderInvVisual();
}

// ── SLOTS DE EQUIPAMENTOS ─────────────────────────────────────────────────
function renderInvSlots() {
  const charId = INV.charId;
  const itens  = INV.inventarios[charId] || [];
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const c = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const charNivel = c?.custom_attrs?.nivel || 1;
  const podeEditar = podeEditarPersonagem(INV.charAtivo);

  let html = '';
  for (const slot of INV_SLOTS) {
    const equipado = itens.find(i => i.equipado && i.slot_equipado === slot.id);
    const amuleto  = itens.find(i => i.equipado && i.slot_equipado === slot.id + '_amuleto');
    html += renderSlotCard(slot, equipado, amuleto, podeEditar, charNivel);
  }
  document.getElementById('inv-slots-grid').innerHTML = html;
}

function renderSlotCard(slot, equipado, amuleto, podeEditar, charNivel) {
  if (!equipado) {
    return `<div class="inv-slot vazio" onclick="invClicarSlotVazio('${slot.id}')">
      <div class="slot-icon" style="opacity:0.3">${slot.emoji}</div>
      <div class="slot-label">${slot.label}</div>
      ${amuleto ? `<div class="slot-amuleto" onclick="event.stopPropagation();invClicarItem(${amuleto.id})">${_itemIcon(amuleto.item)}</div>` : ''}
    </div>`;
  }
  const it   = equipado.item || {};
  const vc   = it.visual_config || {};
  const icon = _itemIcon(it);
  const corBorda = vc.cor_borda || (RARIDADE_CORES[it.raridade]?.borda || '#4fa3d1');
  const corFundo = vc.cor_fundo || '#1a1a2e';
  const temTO    = it.trade_offs && Object.keys(it.trade_offs).length > 0;
  const bloqueado = equipado.bloqueado_por_nivel;

  return `<div class="inv-slot" style="border-color:${corBorda};background:${corFundo}" onclick="invClicarItem(${equipado.id})">
    ${temTO ? `<div class="slot-warning">⚠️</div>` : ''}
    <div class="slot-icon">${icon}</div>
    <div class="slot-nome">${it.nome || '?'}</div>
    <div class="slot-label">${slot.label}</div>
    ${amuleto ? `<div class="slot-amuleto" onclick="event.stopPropagation();invClicarItem(${amuleto.id})">${_itemIcon(amuleto.item)}</div>` : ''}
    ${bloqueado ? `<div class="slot-lock">🔒</div>` : ''}
  </div>`;
}

function invClicarSlotVazio(slotId) {
  // Se há item na mochila compatível, exibir popup para equipar
  const charId = INV.charId;
  const itens  = (INV.inventarios[charId] || []).filter(i => !i.equipado);
  const compativeis = itens.filter(i => {
    const slot = i.item?.slot_padrao;
    if (!slot) return false;
    if (slot === slotId) return true;
    // amuleto pode ir em qualquer _amuleto
    if (i.item?.tipo_canonico === 'amuleto' && slotId.includes('amuleto')) return true;
    return false;
  });
  if (!compativeis.length) {
    mostrarToast('Nenhum item compatível na mochila', '');
    return;
  }
  invClicarItem(compativeis[0].id);
}

// ── MOCHILA ───────────────────────────────────────────────────────────────
function renderInvMochila() {
  const charId   = INV.charId;
  const itens    = (INV.inventarios[charId] || []).filter(i => !i.equipado);
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podeEditar = podeEditarPersonagem(INV.charAtivo);
  const wrapper  = document.getElementById('inv-btn-adicionar-wrap');
  if (wrapper) wrapper.style.display = isMestre ? '' : 'none';

  const el = document.getElementById('inv-mochila-lista');
  if (!itens.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--suave);font-style:italic;font-size:0.85rem">Mochila vazia</div>';
    return;
  }
  el.innerHTML = itens.map(inv => {
    const it  = inv.item || {};
    const vc  = it.visual_config || {};
    const icon = _itemIcon(it);
    const rc  = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
    const corBorda = vc.cor_borda || rc.borda;
    const corFundo = vc.cor_fundo || rc.fundo;
    const bloq = inv.bloqueado_por_nivel;
    const temTO = it.trade_offs && Object.keys(it.trade_offs).length;
    return `<div class="inv-mochila-item" onclick="invClicarItem(${inv.id})">
      <div style="width:44px;height:44px;border-radius:8px;background:${corFundo};border:2px solid ${corBorda};display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fonte-d);font-size:0.8rem;color:${bloq?'var(--suave)':'var(--texto)'}">${it.nome||'?'} ${bloq?'🔒':''} ${temTO?'⚠️':''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
          <span class="cat-item-badge ${rc.badge}">${rc.label}</span>
          ${it.nivel?`<span style="font-size:0.62rem;color:var(--suave)">Nv.${it.nivel}</span>`:''}
          ${bloq?`<span style="font-size:0.62rem;color:var(--destaque)">Requer Nv.${it.nivel_minimo_uso}</span>`:''}
        </div>
      </div>
      <div style="font-size:0.72rem;color:var(--suave)">${inv.quantidade>1?'×'+inv.quantidade:''}</div>
    </div>`;
  }).join('');
}

// ── I5 — ENCUMBRANCE ─────────────────────────────────────────────────────
function renderInvCarga() {
  const charId = INV.charId;
  const itens  = INV.inventarios[charId] || [];
  const c = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const ca = c?.custom_attrs || {};

  // Máximo: HP_max / 10 (padrão), ou valor fixo em ca.carga_maxima
  const hp_max = ca.hp_max || 100;
  const cargaMax = ca.carga_maxima || Math.floor(hp_max / 10) || 10;

  // Equipados não contam. Usa campo `peso` do item_catalog quando disponível,
  // senão soma unidades (1 por stack independente de quantidade).
  const naoEquipados = itens.filter(i => !i.equipado);
  const cargaAtual   = naoEquipados.reduce((s, i) => {
    const pesoUnit = (i.item?.peso) || 1;
    return s + pesoUnit * (i.quantidade || 1);
  }, 0);

  const pct = cargaAtual / cargaMax;
  let cor = 'var(--sucesso)';
  if (pct >= 1.0) cor = 'var(--perigo)';
  else if (pct >= 0.8) cor = 'var(--destaque)';

  const el = document.getElementById('inv-carga-info');
  if (el) {
    el.textContent = `Mochila: ${cargaAtual}/${cargaMax}`;
    el.style.color = pct >= 0.8 ? cor : 'var(--suave)';
  }
  if (pct >= 1.0) mostrarToast('⚠️ Mochila cheia! Não é possível carregar mais.', 'erro');
}

// ── ABA VISUAL — Posicionamento visual dos equipamentos equipados ──────────
function renderInvVisual() {
  const el = document.getElementById('inv-visual-conteudo');
  if (!el) return;
  const charId = INV.charId;
  const nomeChar = INV.charAtivo;
  const c = RPG_DATA?.characters?.find(x => x.id === charId || x.nome === nomeChar);
  if (!c) { el.innerHTML = ''; return; }
  const ca = c.custom_attrs || {};
  const podeEditar = podeEditarPersonagem(nomeChar);

  // Todos os itens equipados (de qualquer tipo)
  const itensEquipados = (INV.inventarios[charId] || []).filter(i => i.equipado);

  // equipamentos_visuais salvos na aparência do personagem
  const equipVisuais = ca.aparencia?.equipamentos_visuais || [];

  if (!itensEquipados.length && !equipVisuais.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px 16px;color:var(--suave);font-style:italic;font-size:0.85rem">
      Nenhum item equipado.<br>
      <span style="font-size:0.75rem">Equipe itens na aba ⚔️ Equipados para posicioná-los aqui.</span>
    </div>`;
    return;
  }

  // Preview do personagem com equipamentos posicionados
  const aparencia = ca.aparencia || {};
  let previewHtml = '';
  if (typeof apmodTokenSVG === 'function') {
    const tw = 120, th = 200;
    const composedImgInv = aparencia.composed_img;
    if (composedImgInv) {
      previewHtml = `
        <div style="display:flex;justify-content:center;margin-bottom:16px">
          <div style="position:relative;width:${tw}px;height:${th}px;background:rgba(0,0,0,0.5);border:1px solid rgba(79,163,209,0.2);border-radius:8px;overflow:hidden">
            <img src="${composedImgInv}" style="width:${tw}px;height:${th}px;object-fit:contain;display:block" crossorigin="anonymous">
          </div>
        </div>`;
    } else {
      const tokenBase = apmodTokenSVG(c, 'local');
      const _eqHtml = (camada) => equipVisuais
        .filter(eq => eq.visivel !== false && (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5))
          && (camada === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras'))
        .map(eq => {
          const xP = eq.x != null ? eq.x : 50, yP = eq.y != null ? eq.y : 40;
          const esc = (eq.escala != null ? eq.escala : 100) / 100;
          // Mesma fórmula que _equipOverlayHtml: 35%×45% do container
          const eW = Math.round(0.35 * tw * esc);
          const eH = Math.round(0.45 * th * esc);
          const l = Math.round((xP / 100) * tw - eW / 2);
          const t = Math.round((yP / 100) * th - eH / 2);
          const rot = eq.rotacao || 0;
          const rotH = eq.rotacaoH || 0;
          const _warp = eq.warpCorners ? _aeqComputeMatrix3d(eW, eH, eq.warpCorners.map(c=>({x:c.x*eW,y:c.y*eH}))) : null;
          const _tfParts = _warp && _warp !== 'none' ? [_warp] : [
            rotH ? `perspective(400px) rotateY(${rotH}deg)` : '',
            rot  ? `rotate(${rot}deg)` : '',
            eq.skewX ? `skewX(${eq.skewX}deg)` : '',
            eq.skewY ? `skewY(${eq.skewY}deg)` : ''
          ].filter(Boolean);
          const _tfOrigin = (_warp && _warp !== 'none') ? '0 0' : 'center center';
          const _tf = _tfParts.length ? `transform:${_tfParts.join(' ')};transform-origin:${_tfOrigin};` : '';
          const inn = (eq.img || eq.img_url)
            ? `<img src="${eq.img || eq.img_url}" loading="lazy" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none">`
            : `<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
          return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${camada==='atras'?0:5};pointer-events:none;${_tf}">${inn}</div>`;
        }).join('');
      previewHtml = `
        <div style="display:flex;justify-content:center;margin-bottom:16px">
          <div style="position:relative;width:${tw}px;height:${th}px;background:rgba(0,0,0,0.5);border:1px solid rgba(79,163,209,0.2);border-radius:8px;overflow:hidden">
            ${_eqHtml('atras')}
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none">
              ${tokenBase || `<div style="width:60px;height:100px;background:${ca.cor||'#4fa3d1'}22;border-radius:4px"></div>`}
            </div>
            ${_eqHtml('frente')}
          </div>
        </div>`;
    }
  }

  // Lista de TODOS os itens equipados
  const listaHtml = `
    <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">Itens equipados</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
      ${itensEquipados.map(inv => {
        const def = INV.itemDefs.find(d => d.id === (inv.item_catalog_id || inv.item_def_id));
        const itData = def || inv.item || {};
        const nome    = itData.nome || inv.item?.nome || '?';
        const icone   = itData.icone || inv.item?.icone || '⚔';
        // Usa mesma lógica do _itemIcon: img_url direto ou visual_config.valor (sistema novo)
        const imgSrc  = _resolveItemImgSrc(def) || _resolveItemImgSrc(inv.item);
        const temVisual = !!imgSrc;
        const posData = equipVisuais.find(ev => ev.item_inv_id === inv.id || ev.nome === nome);
        const posicionado = !!posData;
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(20,29,43,0.6);border:1px solid ${posicionado?'rgba(79,163,209,0.4)':'var(--borda)'};border-radius:8px">
          <div style="width:44px;height:50px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
            ${imgSrc ? `<img src="${imgSrc}" loading="lazy" style="width:100%;height:100%;object-fit:contain">` : `<span style="font-size:1.4rem">${icone}</span>`}
          </div>
          <div style="flex:1">
            <div style="font-family:var(--fonte-d);font-size:0.78rem;color:var(--texto)">${nome}</div>
            <div style="font-size:0.65rem;color:${posicionado?'var(--primario-v)':temVisual?'var(--suave)':'rgba(200,168,75,0.5)'};margin-top:2px">
              ${posicionado ? '✓ Posicionado' : temVisual ? 'Não posicionado' : '⚠ Sem imagem no catálogo'}
            </div>
          </div>
          ${podeEditar && temVisual ? `<button onclick="invAbrirPosicionarEquip(${inv.id})" style="padding:6px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;white-space:nowrap">⟲ Posicionar</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;

  el.innerHTML = previewHtml + listaHtml;
}

// Extrai a URL de imagem de um item considerando AMBOS os sistemas de cadastro:
// - Sistema antigo: campo img_url direto
// - Sistema novo (salvarItem): visual_config.valor quando tipo_visual === 'url'
function _resolveItemImgSrc(it) {
  if (!it) return '';
  if (it.img_url) return it.img_url;
  const vc = it.visual_config || {};
  if (vc.tipo_visual === 'url' && vc.valor) return vc.valor;
  return '';
}

// Abre o posicionador simplificado (só posição/escala/rotação/camada — sem edição de aparência do item)
function _normalizarSlotParaTipo(slot) {
  // Mapear slots do inventário para tipos reconhecidos pelo sistema visual
  const mapa = {
    'mao_principal':'mao_principal','mao_secundaria':'mao_secundaria',
    'armadura':'armadura','capacete':'capacete','luvas':'luvas',
    'botas':'botas','amuleto':'amuleto','anel':'anel',
    'cinto':'cinto','capa':'capa','mascara':'mascara'
  };
  return mapa[slot] || 'geral';
}

function invAbrirPosicionarEquip(invId) {
  const charId = INV.charId;
  const nomeChar = INV.charAtivo;
  const invItem = (INV.inventarios[charId] || []).find(i => i.id === invId);
  if (!invItem) return;

  // Resolve dados do item — tenta itemDefs primeiro, depois JOIN (i.item)
  const def = INV.itemDefs.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
  const itData = def || invItem.item || {};
  const nome = itData.nome || invItem.item?.nome || '?';
  // Suporta ambos os sistemas: img_url direto (antigo) ou visual_config.valor (novo)
  const imgSrc = _resolveItemImgSrc(def) || _resolveItemImgSrc(invItem.item) || '';

  const c = RPG_DATA?.characters?.find(x => x.id === charId || x.nome === nomeChar);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const equipVisuais = JSON.parse(JSON.stringify(ca.aparencia?.equipamentos_visuais || []));

  // Localiza ou cria entrada de posicionamento
  let idx = equipVisuais.findIndex(ev => ev.item_inv_id === invId || ev.nome === nome);
  let eq;
  if (idx >= 0) {
    eq = equipVisuais[idx];
  } else {
    eq = {
      nome, tipo: _normalizarSlotParaTipo(itData.slot_padrao), visivel: true, camada: 'frente',
      img: imgSrc, img_url: imgSrc, svg: '',
      x: 50, y: 40, escala: 80, rotacao: 0, rotacaoH: 0, skewX: 0, skewY: 0,
      bonus_attrs: {}, item_inv_id: invId
    };
    equipVisuais.push(eq);
    idx = equipVisuais.length - 1;
  }

  // Contexto global para o posicionador
  window._invPosContext = { invId, nomeChar, charId, equipVisuais, idx };
  window._apmodNome = nomeChar;
  window._apmodOriginal = ca.aparencia || {};
  window._apmodEquipsVisuais = equipVisuais;
  window._aeqEditIdx = idx;
  window._aeqWorking = JSON.parse(JSON.stringify(eq));
  const w = window._aeqWorking;

  // Remove overlay anterior se existir
  document.getElementById('inv-pos-overlay')?.remove();
  document.getElementById('aeq-overlay')?.remove();

  // Cria overlay simplificado — apenas posicionamento, sem edição de aparência
  const ov = document.createElement('div');
  ov.id = 'aeq-overlay'; // reutiliza o mesmo id para as funções de canvas funcionarem
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9400;display:flex;flex-direction:column;overflow:hidden';
  ov.innerHTML = `
  <div style="background:var(--escuro);border-bottom:1px solid var(--borda);padding:9px 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
    <div>
      <span style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--primario)">⟲ Posicionar: ${nome}</span>
      <div style="font-size:0.62rem;color:var(--suave);margin-top:1px">Arraste para posicionar · alça ↻ para girar · quadrado azul para redimensionar</div>
    </div>
    <button onclick="document.getElementById('aeq-overlay').remove();document.removeEventListener('pointermove',_aeqOnMove);document.removeEventListener('pointerup',_aeqOnUp);" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:20px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      <!-- Canvas de posicionamento -->
      <div id="aeq-canvas" style="position:relative;width:200px;height:280px;background:rgba(0,0,0,0.7);border:1px solid rgba(79,163,209,0.2);border-radius:8px;overflow:visible;touch-action:none;flex-shrink:0">
        <div id="aeq-char-layer" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0.8;z-index:1"></div>
        <div id="aeq-drag" style="position:absolute;cursor:grab;touch-action:none;z-index:2">
          <div id="aeq-rot-handle" style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;background:rgba(200,168,75,0.92);border:2px solid rgba(255,255,255,0.8);cursor:grab;display:flex;align-items:center;justify-content:center;font-size:0.55rem;touch-action:none;z-index:2" title="Girar">↻</div>
          <div id="aeq-item-el" style="pointer-events:none;display:flex;align-items:center;justify-content:center;transform-origin:center center"></div>
          <div id="aeq-scale-handle" style="position:absolute;bottom:-8px;right:-8px;width:14px;height:14px;background:rgba(79,163,209,0.92);border:2px solid rgba(255,255,255,0.8);border-radius:3px;cursor:se-resize;touch-action:none;z-index:2" title="Redimensionar"></div>
        </div>
      </div>
      <!-- Controles numéricos -->
      <div style="width:220px;display:grid;grid-template-columns:1fr 1fr;gap:4px">
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">X%</div><input id="aeq-x" type="number" min="0" max="100" value="${Math.round(w.x)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Y%</div><input id="aeq-y" type="number" min="0" max="100" value="${Math.round(w.y)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Escala%</div><input id="aeq-escala" type="number" min="10" max="400" value="${Math.round(w.escala)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div><div style="font-size:0.4rem;color:var(--suave);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Rotação°</div><input id="aeq-rot-num" type="number" min="-180" max="180" value="${Math.round(w.rotacao)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()"></div>
        <div style="grid-column:1/-1">
          <div style="font-size:0.4rem;color:rgba(200,168,75,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Giro Horiz.° <span style="opacity:0.6">(profundidade)</span></div>
          <div style="display:flex;gap:4px;align-items:center">
            <input type="range" id="aeq-roth-range" min="-80" max="80" value="${Math.round(w.rotacaoH||0)}" style="flex:1;accent-color:rgba(200,168,75,0.9)" oninput="document.getElementById('aeq-roth-num').value=this.value;_aeqFromInputs()">
            <input id="aeq-roth-num" type="number" min="-180" max="180" value="${Math.round(w.rotacaoH||0)}" style="width:44px;box-sizing:border-box;background:var(--painel);border:1px solid rgba(200,168,75,0.35);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="document.getElementById('aeq-roth-range').value=this.value;_aeqFromInputs()">
          </div>
        </div>
        <div id="aeq-skew-section" style="display:contents">
        <div><div style="font-size:0.4rem;color:rgba(130,220,170,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Distorção X°</div><input id="aeq-skewx-num" type="number" min="-60" max="60" value="${Math.round(w.skewX||0)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid rgba(130,220,170,0.3);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()" title="Inclinar horizontalmente"></div>
        <div><div style="font-size:0.4rem;color:rgba(130,220,170,0.85);text-align:center;text-transform:uppercase;font-family:var(--fonte-d)">Distorção Y°</div><input id="aeq-skewy-num" type="number" min="-60" max="60" value="${Math.round(w.skewY||0)}" style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid rgba(130,220,170,0.3);border-radius:4px;padding:3px;color:var(--texto);font-size:0.75rem;text-align:center" oninput="_aeqFromInputs()" title="Inclinar verticalmente"></div>
        </div>
      </div>
      <!-- Warp por pontos de controle -->
      <div style="width:220px;margin-top:4px;display:flex;gap:3px;align-items:center">
        <button id="aeq-warp-btn" onclick="_aeqToggleWarpMode()" style="flex:1;padding:6px 4px;border-radius:5px;font-family:var(--fonte-d);font-size:0.48rem;cursor:pointer;border:1px solid var(--borda);background:rgba(20,29,43,0.6);color:var(--suave);transition:all 0.15s">${w._warpMode ? '🔲 Saindo de Warp' : '🔲 Distorcer Forma'}</button>
        <button id="aeq-warp-reset" onclick="_aeqResetWarp()" style="display:${w._warpMode?'inline-flex':'none'};align-items:center;padding:6px 8px;border-radius:5px;font-family:var(--fonte-d);font-size:0.48rem;cursor:pointer;border:1px solid rgba(220,120,80,0.5);background:rgba(220,120,80,0.1);color:rgba(255,160,120,0.95)" title="Resetar">↺</button>
        <button onclick="_aeqClearWarp()" style="padding:6px 8px;border-radius:5px;font-family:var(--fonte-d);font-size:0.48rem;cursor:pointer;border:1px solid rgba(180,60,60,0.4);background:rgba(180,60,60,0.08);color:rgba(255,120,100,0.85)" title="Remover warp">✕</button>
      </div>
      <!-- Camada -->
      <div style="width:220px;display:flex;gap:4px">
        <button id="aeq-btn-frente" onclick="_aeqSetCamada('frente')" style="flex:1;padding:5px 2px;border-radius:5px;font-family:var(--fonte-d);font-size:0.5rem;cursor:pointer;border:1px solid rgba(79,163,209,0.5);background:rgba(79,163,209,0.18);color:#7ec8f0">⬆ Frente</button>
        <button id="aeq-btn-atras" onclick="_aeqSetCamada('atras')" style="flex:1;padding:5px 2px;border-radius:5px;font-family:var(--fonte-d);font-size:0.5rem;cursor:pointer;border:1px solid var(--borda);background:rgba(20,29,43,0.5);color:var(--suave)">⬇ Atrás</button>
      </div>
    </div>
  </div>
  <div style="background:var(--escuro);border-top:1px solid var(--borda);padding:10px 14px;display:flex;gap:8px;flex-shrink:0">
    <button onclick="invConfirmarPosicionarEquip()" style="flex:1;padding:12px;background:linear-gradient(135deg,var(--primario),var(--primario-v));border:none;border-radius:8px;color:#050810;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;font-weight:700">💾 Salvar Posição</button>
    <button onclick="document.getElementById('aeq-overlay').remove();document.removeEventListener('pointermove',_aeqOnMove);document.removeEventListener('pointerup',_aeqOnUp);" style="flex:1;padding:12px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer">Cancelar</button>
  </div>`;

  document.body.appendChild(ov);

  // Inicializa canvas (reutiliza funções existentes)
  _aeqRenderChar();
  _aeqSetCamada(w.camada);
  _aeqUpdateVisual();
  _aeqPositionDrag();
  _aeqAttachHandlers();
}

async function invConfirmarPosicionarEquip() {
  const ctx = window._invPosContext;
  if (!ctx) return;

  // Feedback imediato no botão
  const saveBtn = document.querySelector('#aeq-overlay button[onclick="invConfirmarPosicionarEquip()"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Salvando...';
    saveBtn.style.opacity = '0.7';
  }

  // Lê posição atual do working state + inputs
  const w = window._aeqWorking || {};
  const x       = parseFloat(document.getElementById('aeq-x')?.value)      ?? w.x      ?? 50;
  const y       = parseFloat(document.getElementById('aeq-y')?.value)      ?? w.y      ?? 45;
  const escala  = parseFloat(document.getElementById('aeq-escala')?.value) ?? w.escala ?? 90;
  const rotacao = parseFloat(document.getElementById('aeq-rot-num')?.value)?? w.rotacao?? 0;
  const rotacaoH = parseFloat(document.getElementById('aeq-roth-num')?.value) || w.rotacaoH || 0;
  const skewX   = parseFloat(document.getElementById('aeq-skewx-num')?.value) || w.skewX || 0;
  const skewY   = parseFloat(document.getElementById('aeq-skewy-num')?.value) || w.skewY || 0;
  const camada  = w.camada || 'frente';

  // Atualiza apenas posição/escala/rotação/camada — preserva img, svg, bonus_attrs e resto
  const equipVisuais = ctx.equipVisuais;
  const eq = equipVisuais[ctx.idx];
  Object.assign(eq, { x, y, escala, rotacao, rotacaoH, skewX, skewY, warpCorners: (w.warpCorners || null), camada });

  // Resolve personagem e monta novos custom_attrs
  const c = RPG_DATA?.characters?.find(xc => xc.id === ctx.charId || xc.nome === ctx.nomeChar);
  if (!c) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  const ca = c.custom_attrs || {};
  // Limpa composed_img stale para que a visualização imediata use o render dinâmico
  // (com as novas posições) em vez da imagem antiga gerada anteriormente
  const novaAparencia = { ...(ca.aparencia || {}), equipamentos_visuais: equipVisuais, composed_img: null };
  const novoCa = { ...ca, aparencia: novaAparencia };

  try {
    await sb(
      `characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(ctx.nomeChar)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: novoCa }) }
    );
    c.custom_attrs = novoCa;

    // Sincroniza _apmodEquipsVisuais para que o modal de aparência (se aberto) reflita as novas posições
    if (window._apmodNome === ctx.nomeChar) {
      window._apmodEquipsVisuais = JSON.parse(JSON.stringify(equipVisuais));
      if (typeof apmodAtualizarPreview === 'function') apmodAtualizarPreview();
    }

    // Limpa e fecha overlay
    document.getElementById('aeq-overlay')?.remove();
    document.removeEventListener('pointermove', _aeqOnMove);
    document.removeEventListener('pointerup', _aeqOnUp);
    window._invPosContext = null;

    mostrarToast('✓ Posição salva!', 'ok');
    renderInvVisual();

    // Atualiza aba de personagem e mapa imediatamente (sem esperar composed_img)
    if (typeof renderCharView === 'function' && typeof CHAR_VIEW !== 'undefined' && CHAR_VIEW === ctx.nomeChar) {
      renderCharView(ctx.nomeChar);
    }
    if (typeof renderAttrView === 'function') renderAttrView?.(ctx.nomeChar);
    if (MAPA_STATE?.mapaAtualId) {
      const entry = (RPG_DATA.mapas || []).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry) mapaRenderTokens(entry.mapa);
    }

    // Gerar imagem composta em background e atualizar novamente ao concluir
    _aeqGenerateComposedImg(novaAparencia, equipVisuais, ctx.nomeChar).then(composedUrl => {
      if (!composedUrl) return;
      novaAparencia.composed_img = composedUrl;
      c.custom_attrs = { ...c.custom_attrs, aparencia: novaAparencia };
      sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(ctx.nomeChar)}`,
        { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) }
      ).then(() => {
        if (MAPA_STATE?.mapaAtualId) { const entry = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE.mapaAtualId); if(entry) mapaRenderTokens(entry.mapa); }
        if (typeof renderCharView === 'function' && typeof CHAR_VIEW !== 'undefined' && CHAR_VIEW === ctx.nomeChar) renderCharView(ctx.nomeChar);
        renderInvVisual();
        if (window._apmodNome === ctx.nomeChar && typeof apmodAtualizarPreview === 'function') apmodAtualizarPreview();
      }).catch(() => {});
    });

  } catch(err) {
    mostrarToast('Erro ao salvar posição', 'erro');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Salvar Posição'; saveBtn.style.opacity = '1'; }
  }
}
function invClicarItem(invId) {
  const charId = INV.charId;
  const inv = (INV.inventarios[charId] || []).find(i => i.id === invId);
  if (!inv) return;
  const it = inv.item || {};
  const vc = it.visual_config || {};
  const rc = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
  const icon = _itemIcon(it);
  const corBorda = vc.cor_borda || rc.borda;
  const corFundo = vc.cor_fundo || rc.fundo;
  const podeEditar = podeEditarPersonagem(INV.charAtivo);
  const c = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const charNivel = c?.custom_attrs?.nivel || 1;

  // Bônus
  const bonus = it.atributos_bonus || {};
  const tradeoffs = it.trade_offs || {};
  const efeitos = it.efeitos || [];

  const bonusPositivos = Object.entries(bonus).filter(([k,v])=>(typeof v==='object'?v.valor:v)>=0);
  const bonusNegativos = Object.entries(bonus).filter(([k,v])=>(typeof v==='object'?v.valor:v)<0);

  const bonusHtml = [
    ...bonusPositivos.map(([k,v])=>{
      const n=typeof v==='object'?v.valor:v; const suf=typeof v==='object'&&v.modo==='pct'?'%':'';
      return `<div style="color:#4eca7e">↑ +${n}${suf} ${k}</div>`;
    }),
    ...bonusNegativos.map(([k,v])=>{
      const n=typeof v==='object'?v.valor:v; const suf=typeof v==='object'&&v.modo==='pct'?'%':'';
      return `<div style="color:#e05040">↓ ${n}${suf} ${k} ⚠️</div>`;
    }),
    ...efeitos.map(ef=>`<div style="color:#a070d8;font-size:0.72rem">${_descreverEfeito(ef)}</div>`)
  ].join('') || '<div style="color:var(--suave);font-style:italic;font-size:0.78rem">Sem bônus</div>';

  document.getElementById('inv-detail-titulo').textContent = it.nome || 'Item';
  document.getElementById('inv-detail-corpo').innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
      <div style="width:64px;height:64px;border-radius:10px;background:${corFundo};border:2px solid ${corBorda};display:flex;align-items:center;justify-content:center;font-size:2.2rem;flex-shrink:0">${icon}</div>
      <div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          <span class="cat-item-badge ${rc.badge}">${rc.label}</span>
          ${it.nivel?`<span style="font-size:0.65rem;color:var(--suave);padding:2px 6px;border:1px solid var(--borda);border-radius:4px">Nv.${it.nivel}</span>`:''}
          ${inv.bloqueado_por_nivel?`<span style="font-size:0.65rem;color:var(--destaque);padding:2px 6px;border:1px solid rgba(200,168,75,0.3);border-radius:4px">🔒 Requer Nv.${it.nivel_minimo_uso}</span>`:''}
        </div>
        <div style="font-size:0.72rem;color:var(--suave)">${it.tipo_canonico||''} ${it.subtipo?'· '+it.subtipo:''}</div>
        ${it.descricao?`<div style="font-size:0.78rem;color:var(--texto);margin-top:6px;line-height:1.4;font-style:italic">${it.descricao}</div>`:''}
      </div>
    </div>
    <div style="padding:10px 12px;background:var(--painel);border:1px solid var(--borda);border-radius:8px;font-size:0.8rem;line-height:1.9">
      ${bonusHtml}
    </div>`;

  // Botões de ação
  const btns = document.getElementById('inv-detail-btns');
  btns.innerHTML = '';

  if (podeEditar) {
    if (inv.equipado) {
      const b = document.createElement('button');
      b.textContent = '🔽 Desequipar';
      b.style.cssText = 'width:100%;padding:12px;background:rgba(192,57,43,0.12);border:1px solid rgba(192,57,43,0.35);border-radius:8px;color:#e05040;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;letter-spacing:0.06em';
      b.onclick = () => invDesequipar(invId);
      btns.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.textContent = inv.bloqueado_por_nivel ? `🔒 Bloqueado (Nv.${it.nivel_minimo_uso} necessário)` : '⬆ Equipar';
      b.disabled = !!inv.bloqueado_por_nivel;
      b.style.cssText = `width:100%;padding:12px;background:${inv.bloqueado_por_nivel?'rgba(200,168,75,0.05)':'rgba(79,163,209,0.12)'};border:1px solid ${inv.bloqueado_por_nivel?'rgba(200,168,75,0.2)':'rgba(79,163,209,0.35)'};border-radius:8px;color:${inv.bloqueado_por_nivel?'var(--suave)':'var(--primario-v)'};font-family:var(--fonte-d);font-size:0.72rem;cursor:${inv.bloqueado_por_nivel?'not-allowed':'pointer'};letter-spacing:0.06em`;
      if (!inv.bloqueado_por_nivel) b.onclick = () => invEquipar(invId);
      btns.appendChild(b);
    }

    // Botão remover
    const bRem = document.createElement('button');
    bRem.textContent = '🗑 Remover do inventário';
    bRem.style.cssText = 'width:100%;padding:10px;background:none;border:1px solid rgba(192,57,43,0.2);border-radius:8px;color:#e05040;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;opacity:0.7';
    bRem.onclick = () => invRemoverItem(invId);
    btns.appendChild(bRem);
  }

  // Fechar
  const bFechar = document.createElement('button');
  bFechar.textContent = 'Fechar';
  bFechar.style.cssText = 'width:100%;padding:10px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer';
  bFechar.onclick = () => document.getElementById('modal-inv-item-overlay').style.display='none';
  btns.appendChild(bFechar);

  document.getElementById('modal-inv-item-overlay').style.display = 'flex';
}

// ── I3 — EQUIPAR ─────────────────────────────────────────────────────────
async function invEquipar(invId) {
  const charId = INV.charId;
  const inv = (INV.inventarios[charId] || []).find(i => i.id === invId);
  if (!inv) return;
  const it = inv.item || {};
  const c  = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  if (!c) return;
  const charNivel = c.custom_attrs?.nivel || 1;

  // [A] Bloqueio por nível
  if (inv.bloqueado_por_nivel || charNivel < (it.nivel_minimo_uso || 1)) {
    mostrarToast(`🔒 Requer Nível ${it.nivel_minimo_uso}. Você está no Nível ${charNivel}.`, 'erro');
    return;
  }

  // [B] Trade-offs aviso
  const tradeoffs = it.trade_offs || {};
  const temTO = Object.keys(tradeoffs).length > 0;
  if (temTO) {
    const avisos = Object.entries(tradeoffs).map(([k,v])=>{
      const n=typeof v==='object'?v.valor:v; const suf=typeof v==='object'&&v.modo==='pct'?'%':'';
      return `${k} ${n}${suf}`;
    }).join(', ');
    if (!confirm(`⚠️ Este item reduz: ${avisos}\n\nEquipar mesmo assim?`)) return;
  }

  // [C] Slot ocupado
  let slotAlvo = it.slot_padrao;
  if (!slotAlvo) { mostrarToast('Item sem slot definido', 'erro'); return; }

  // Amuleto aninhado: se o slot principal estiver ocupado e o item for amuleto,
  // redirecionar automaticamente para o sub-slot _amuleto correspondente.
  if (it.tipo_canonico === 'amuleto' && !slotAlvo.endsWith('_amuleto')) {
    const slotPrincipalOcupado = (INV.inventarios[charId] || []).find(i => i.equipado && i.slot_equipado === slotAlvo);
    if (slotPrincipalOcupado) {
      // Verificar se o item principal aceita amuleto aninhado
      const itemPrincipal = slotPrincipalOcupado.item || {};
      if (itemPrincipal.aceita_amuleto_aninhado !== false) {
        slotAlvo = slotAlvo + '_amuleto';
      }
    }
  }

  const slotOcupado = (INV.inventarios[charId] || []).find(i => i.equipado && i.slot_equipado === slotAlvo);
  if (slotOcupado) {
    const nomeAtual = slotOcupado.item?.nome || 'item atual';
    if (!confirm(`O slot já contém "${nomeAtual}". Substituir?`)) return;
    await invDesequipar(slotOcupado.id, true); // silencioso
  }

  // [5] Aplicar atributos_bonus
  const ca = { ...(c.custom_attrs || {}) };
  ca.atributos = { ...(ca.atributos || {}) };
  const bonus = it.atributos_bonus || {};
  const snapshot = {};

  for (const [attr, val] of Object.entries(bonus)) {
    const atual = parseFloat(ca.atributos[attr]) || 0;
    let delta;
    if (typeof val === 'object' && val.modo === 'pct') {
      delta = Math.round(atual * Math.abs(val.valor) / 100) * Math.sign(val.valor);
    } else {
      delta = parseFloat(val) || 0;
    }
    snapshot[attr] = delta;
    ca.atributos[attr] = atual + delta;
  }

  // Atualizar character
  c.custom_attrs = ca;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&nome=eq.${encodeURIComponent(INV.charAtivo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_attrs: ca })
    });
    // Atualizar instância de inventário
    await sb(`inventario?id=eq.${invId}`, {
      method: 'PATCH',
      body: JSON.stringify({ equipado: true, slot_equipado: slotAlvo, bonus_snapshot: snapshot })
    });
    // Atualizar estado local
    const idx = INV.inventarios[charId].findIndex(i => i.id === invId);
    if (idx >= 0) {
      INV.inventarios[charId][idx].equipado = true;
      INV.inventarios[charId][idx].slot_equipado = slotAlvo;
      INV.inventarios[charId][idx].bonus_snapshot = snapshot;
    }
    document.getElementById('modal-inv-item-overlay').style.display = 'none';
    mostrarToast(`✓ ${it.nome} equipado!`, 'ok');
    renderInvCompleto();
    if (typeof renderCharView === 'function') renderCharView(INV.charAtivo);
    if (typeof renderAttrView === 'function') renderAttrView(INV.charAtivo);
  } catch(e) {
    mostrarToast('Erro ao equipar. Verifique sua conexão e tente novamente.', 'erro');
    // Reverter local
    c.custom_attrs = c.custom_attrs;
  }
}

// ── I3 — DESEQUIPAR ───────────────────────────────────────────────────────
async function invDesequipar(invId, silencioso = false) {
  const charId = INV.charId;
  const inv = (INV.inventarios[charId] || []).find(i => i.id === invId);
  if (!inv || !inv.equipado) return;
  const it = inv.item || {};
  const c  = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  if (!c) return;

  // Reverter atributos usando bonus_snapshot (não recalcular)
  const ca = { ...(c.custom_attrs || {}) };
  ca.atributos = { ...(ca.atributos || {}) };
  const snapshot = inv.bonus_snapshot || {};

  // Se não há snapshot, usar item_catalog como fallback (apenas absolutos)
  const bonus = it.atributos_bonus || {};
  const fonte = Object.keys(snapshot).length ? snapshot : {};
  if (!Object.keys(fonte).length) {
    // fallback: reverter pelo atributos_bonus como abs
    for (const [attr, val] of Object.entries(bonus)) {
      const n = typeof val === 'object' ? val.valor : parseFloat(val) || 0;
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - n;
    }
  } else {
    for (const [attr, delta] of Object.entries(fonte)) {
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - delta;
    }
  }

  c.custom_attrs = ca;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&nome=eq.${encodeURIComponent(INV.charAtivo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_attrs: ca })
    });
    await sb(`inventario?id=eq.${invId}`, {
      method: 'PATCH',
      body: JSON.stringify({ equipado: false, slot_equipado: null, bonus_snapshot: null })
    });
    const idx = INV.inventarios[charId].findIndex(i => i.id === invId);
    if (idx >= 0) {
      INV.inventarios[charId][idx].equipado = false;
      INV.inventarios[charId][idx].slot_equipado = null;
      INV.inventarios[charId][idx].bonus_snapshot = null;
    }
    if (!silencioso) {
      document.getElementById('modal-inv-item-overlay').style.display = 'none';
      mostrarToast(`✓ ${it.nome} desequipado`, '');
      renderInvCompleto();
      if (typeof renderCharView === 'function') renderCharView(INV.charAtivo);
      if (typeof renderAttrView === 'function') renderAttrView(INV.charAtivo);
    }
  } catch(e) {
    if (!silencioso) mostrarToast('Erro ao desequipar. Verifique sua conexão e tente novamente.', 'erro');
  }
}

// ── REMOVER ITEM DO INVENTÁRIO ────────────────────────────────────────────
async function invRemoverItem(invId) {
  const charId = INV.charId;
  const inv = (INV.inventarios[charId] || []).find(i => i.id === invId);
  if (!inv) return;
  if (inv.equipado) { await invDesequipar(invId, true); }
  if (!confirm(`Remover "${inv.item?.nome}" do inventário?`)) return;
  try {
    await sb(`inventario?id=eq.${invId}`, { method: 'DELETE', headers:{'Prefer':'return=minimal'} });
    INV.inventarios[charId] = INV.inventarios[charId].filter(i => i.id !== invId);
    document.getElementById('modal-inv-item-overlay').style.display = 'none';
    mostrarToast('Item removido', '');
    renderInvCompleto();
  } catch(e) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── ADICIONAR ITEM (MESTRE) ───────────────────────────────────────────────
async function abrirAdicionarItemInv() {
  const rpgId = CURRENT_RPG?.id; if (!rpgId) return;
  document.getElementById('modal-add-inv-overlay').style.display = 'flex';
  document.getElementById('add-inv-busca').value = '';
  // Carregar catálogo
  try {
    const data = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&order=nome`);
    INV.catalogo = data || [];
    filtrarAddInv();
  } catch(e) {
    document.getElementById('add-inv-lista').innerHTML = `<div style="color:var(--perigo);padding:20px">${e.message}</div>`;
  }
}

function filtrarAddInv() {
  const busca = (document.getElementById('add-inv-busca')?.value||'').toLowerCase();
  const itens = INV.catalogo.filter(it => !busca || it.nome.toLowerCase().includes(busca));
  const c = RPG_DATA?.characters?.find(x=>x.nome===INV.charAtivo);
  const charNivel = c?.custom_attrs?.nivel || 1;
  document.getElementById('add-inv-lista').innerHTML = itens.slice(0, 50).map(it => {
    const rc = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
    const icon = _itemIcon(it);
    const bloq = charNivel < (it.nivel_minimo_uso || 1);
    return `<div class="inv-mochila-item" onclick="addInvConfirmar(${it.id})">
      <div style="width:38px;height:38px;border-radius:7px;background:${it.visual_config?.cor_fundo||rc.fundo};border:1.5px solid ${it.visual_config?.cor_borda||rc.borda};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fonte-d);font-size:0.78rem">${it.nome}</div>
        <div style="display:flex;gap:5px;margin-top:2px">
          <span class="cat-item-badge ${rc.badge}">${rc.label}</span>
          ${bloq?`<span style="font-size:0.6rem;color:var(--destaque)">🔒 Nv.${it.nivel_minimo_uso}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;padding:20px;color:var(--suave);font-style:italic">Nenhum item encontrado</div>';
}

async function addInvConfirmar(catalogId) {
  const charId  = INV.charId;
  const c       = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const it      = INV.catalogo.find(x=>x.id===catalogId);
  if (!c || !it) return;
  const charNivel = c.custom_attrs?.nivel || 1;
  const bloq = charNivel < (it.nivel_minimo_uso || 1);
  try {
    const payload = {
      rpg_id: CURRENT_RPG.id,
      character_id: charId,
      item_catalog_id: catalogId,
      quantidade: 1,
      equipado: false,
      bloqueado_por_nivel: bloq,
      origem: 'doacao_mestre'
    };
    const res = await sb('inventario', { method:'POST', body: JSON.stringify(payload) });
    mostrarToast(`✓ ${it.nome} adicionado${bloq?' (bloqueado, Nv.'+it.nivel_minimo_uso+')':''}`, 'ok');
    document.getElementById('modal-add-inv-overlay').style.display = 'none';
    await carregarInventarioChar(charId);
    // Broadcast
    _invBroadcastDrop(it, INV.charAtivo, 'doacao_mestre');
  } catch(e) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── I4 — VERIFICAR DESBLOQUEIO DE ITENS AO SUBIR NÍVEL ──────────────────
async function verificarDesbloqueioItens(nomeChar, novoNivel) {
  const c = RPG_DATA?.characters?.find(x=>x.nome===nomeChar);
  if (!c) return;
  const charId = c.id;
  // Buscar itens bloqueados do personagem
  try {
    const bloqueados = await sb(
      `inventario?character_id=eq.${charId}&bloqueado_por_nivel=eq.true&select=*,item:item_catalog_id(*)`
    );
    for (const inv of (bloqueados || [])) {
      const it = inv.item || {};
      if (novoNivel >= (it.nivel_minimo_uso || 1)) {
        await sb(`inventario?id=eq.${inv.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ bloqueado_por_nivel: false })
        });
        mostrarToast(`🔓 ${it.nome} desbloqueado!`, 'ok');
        // Broadcast de desbloqueio
        _invBroadcastDrop(it, nomeChar, 'desbloqueio');
      }
    }
    // Recarregar se inventário aberto
    if (INV.charId === charId || INV.charAtivo === nomeChar) {
      await carregarInventarioChar(charId);
    }
  } catch(e) {
    console.warn('[I4] Erro ao verificar desbloqueio:', e);
  }
}

// Hook no executarLevelUp existente
const _origExecutarLevelUp = window.executarLevelUp;
if (typeof executarLevelUp === 'function') {
  window.executarLevelUp = async function(nome) {
    const c = RPG_DATA?.characters?.find(x=>x.nome===nome);
    const nivelAntes = c?.custom_attrs?.nivel || 1;
    await executarLevelUp(nome);
    const cDepois = RPG_DATA?.characters?.find(x=>x.nome===nome);
    const nivelDepois = cDepois?.custom_attrs?.nivel || nivelAntes;
    if (nivelDepois > nivelAntes) {
      await verificarDesbloqueioItens(nome, nivelDepois);
    }
  };
}

// ── I6 — SISTEMA DE MOEDAS ────────────────────────────────────────────────
const MOEDAS_DEFAULTS = [
  { nome: 'Ouro',   emoji: '🟡', cor: '#f0c030', valor_base: 100 },
  { nome: 'Prata',  emoji: '⚪', cor: '#c0c0c0', valor_base: 10  },
  { nome: 'Cobre',  emoji: '🟤', cor: '#b87333', valor_base: 1   }
];

async function renderInvMoedas() {
  const el = document.getElementById('inv-moedas-conteudo');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);font-style:italic;font-size:0.8rem">Carregando...</div>';
  const charId = INV.charId;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podeEditar = podeEditarPersonagem(INV.charAtivo);

  try {
    // Bolsa individual
    const bolsa = await sb(
      `moedas?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&dono_id=eq.${charId}&select=*`
    ).catch(()=>[]) || [];

    // Denominações configuradas ou padrão
    const denoms = CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;

    let html = `<div style="margin-bottom:10px;font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">💰 Bolsa de ${INV.charAtivo}</div>`;

    for (const denom of denoms) {
      const entrada = bolsa.find(b => b.denominacao === denom.nome);
      const qtd     = entrada?.quantidade || 0;
      html += `<div class="inv-moeda-card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:1.4rem">${denom.emoji}</span>
            <div>
              <div style="font-family:var(--fonte-d);font-size:0.82rem;color:${denom.cor}">${denom.nome}</div>
              <div style="font-size:0.7rem;color:var(--suave)">Base: ${denom.valor_base}</div>
            </div>
          </div>
          <div style="font-family:var(--fonte-d);font-size:1.4rem;color:${denom.cor}">${qtd}</div>
        </div>
        ${podeEditar||isMestre?`
        <div style="display:flex;gap:6px;margin-top:10px">
          <button onclick="abrirTxMoeda('dar','${denom.nome}')" style="flex:1;padding:7px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.25);border-radius:6px;color:#4eca7e;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">＋ Adicionar</button>
          <button onclick="abrirTxMoeda('remover','${denom.nome}')" style="flex:1;padding:7px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:#e05040;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">− Remover</button>
          <button onclick="abrirTxMoeda('transferir','${denom.nome}')" style="flex:1;padding:7px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:6px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">→ Transferir</button>
        </div>`:''}
      </div>`;
    }

    // Histórico de transações recentes
    const log = await sb(
      `log_transacoes?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&or=(dono_id.eq.${charId},destino_id.eq.${charId})&order=created_at.desc&limit=10&select=*`
    ).catch(()=>[]) || [];

    if (log.length) {
      html += `<div style="margin:14px 0 8px;font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">📋 Histórico recente</div>`;
      html += log.map(tx=>{
        const sinal = tx.dono_id === charId ? (tx.tipo==='receber'?'+':'-') : '+';
        const cor = sinal==='+' ? '#4eca7e' : '#e05040';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.75rem">
          <div style="color:var(--suave)">${tx.descricao||tx.tipo} · ${tx.denominacao}</div>
          <div style="color:${cor};font-family:var(--fonte-d)">${sinal}${tx.quantidade}</div>
        </div>`;
      }).join('');
    }

    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--perigo);padding:20px">${e.message}</div>`;
  }
}

function invTrocarAba(aba) {
  document.querySelectorAll('.inv-tab').forEach(b=>{
    const ativo = b.dataset.tab === aba;
    b.classList.toggle('active', ativo);
    b.style.color = ativo ? 'var(--primario)' : 'var(--suave)';
    b.style.borderBottomColor = ativo ? 'var(--primario)' : 'transparent';
  });
  document.querySelectorAll('.inv-aba').forEach(d=>{
    d.style.display = d.id === 'inv-aba-' + aba ? 'block' : 'none';
  });
  if (aba === 'moedas') renderInvMoedas();
  if (aba === 'bau') renderInvBau();
  if (aba === 'visual') renderInvVisual();
}

// ── TRANSAÇÕES DE MOEDA ───────────────────────────────────────────────────
function _criarModalMoedaTxSeNecessario() {
  if (document.getElementById('modal-moeda-tx-overlay')) return;
  const el = document.createElement('div');
  el.id = 'modal-moeda-tx-overlay';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9500;align-items:center;justify-content:center;padding:16px';
  el.innerHTML = `
    <div style="background:var(--escuro,#0d1520);border:1px solid var(--borda,rgba(79,163,209,0.2));border-radius:14px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.7)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div id="moeda-tx-titulo" style="font-family:var(--fonte-d,'Cinzel',serif);font-size:1rem;color:var(--texto,#c8d8e8)"></div>
        <button onclick="document.getElementById('modal-moeda-tx-overlay').style.display='none'" style="background:none;border:none;color:var(--suave,#7a92aa);font-size:1.4rem;cursor:pointer;padding:4px 8px">✕</button>
      </div>
      <input type="hidden" id="moeda-tx-tipo">

      <div style="margin-bottom:14px">
        <label style="font-family:var(--fonte-d,'Cinzel',serif);font-size:0.6rem;color:var(--suave,#7a92aa);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:5px">Denominação</label>
        <select id="moeda-tx-denom" style="width:100%;padding:9px 12px;background:rgba(10,15,25,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:var(--texto,#c8d8e8);font-family:var(--fonte-d,'Cinzel',serif);font-size:0.82rem"></select>
      </div>

      <div style="margin-bottom:14px">
        <label style="font-family:var(--fonte-d,'Cinzel',serif);font-size:0.6rem;color:var(--suave,#7a92aa);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:5px">Quantidade</label>
        <input id="moeda-tx-qtd" type="number" min="1" value="1" style="width:100%;padding:9px 12px;background:rgba(10,15,25,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:var(--texto,#c8d8e8);font-size:0.9rem;box-sizing:border-box">
      </div>

      <div id="moeda-tx-destino-wrap" style="display:none;margin-bottom:14px">
        <label style="font-family:var(--fonte-d,'Cinzel',serif);font-size:0.6rem;color:var(--suave,#7a92aa);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:5px">Destino</label>
        <select id="moeda-tx-destino" style="width:100%;padding:9px 12px;background:rgba(10,15,25,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:var(--texto,#c8d8e8);font-family:var(--fonte-d,'Cinzel',serif);font-size:0.82rem"></select>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-family:var(--fonte-d,'Cinzel',serif);font-size:0.6rem;color:var(--suave,#7a92aa);text-transform:uppercase;letter-spacing:0.08em;display:block;margin-bottom:5px">Descrição (opcional)</label>
        <input id="moeda-tx-desc" type="text" placeholder="Ex: recompensa da missão..." style="width:100%;padding:9px 12px;background:rgba(10,15,25,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:var(--texto,#c8d8e8);font-size:0.82rem;box-sizing:border-box">
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('modal-moeda-tx-overlay').style.display='none'" style="flex:1;padding:11px;background:rgba(30,45,66,0.6);border:1px solid rgba(79,163,209,0.15);border-radius:8px;color:var(--suave,#7a92aa);font-family:var(--fonte-d,'Cinzel',serif);font-size:0.72rem;cursor:pointer;text-transform:uppercase">Cancelar</button>
        <button onclick="confirmarTransacaoMoeda()" style="flex:2;padding:11px;background:linear-gradient(135deg,rgba(79,163,209,0.25),rgba(79,163,209,0.1));border:1px solid rgba(79,163,209,0.45);border-radius:8px;color:var(--primario-v,#6fc8ee);font-family:var(--fonte-d,'Cinzel',serif);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em">✓ Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}

function abrirTxMoeda(tipo, denomDefault) {
  _criarModalMoedaTxSeNecessario();
  const overlay = document.getElementById('modal-moeda-tx-overlay');
  document.getElementById('moeda-tx-tipo').value  = tipo;
  const titulos = { dar:'＋ Adicionar Moedas', remover:'− Remover Moedas', transferir:'→ Transferir Moedas' };
  document.getElementById('moeda-tx-titulo').textContent = titulos[tipo] || tipo;
  const denoms = CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;
  const sel = document.getElementById('moeda-tx-denom');
  sel.innerHTML = denoms.map(d=>`<option value="${d.nome}" ${d.nome===denomDefault?'selected':''}>${d.emoji} ${d.nome}</option>`).join('');
  document.getElementById('moeda-tx-qtd').value = 1;
  document.getElementById('moeda-tx-desc').value = '';
  const destWrap = document.getElementById('moeda-tx-destino-wrap');
  destWrap.style.display = tipo === 'transferir' ? '' : 'none';
  if (tipo === 'transferir') {
    const chars = (RPG_DATA?.characters||[]).filter(c=>c.nome!==INV.charAtivo);
    document.getElementById('moeda-tx-destino').innerHTML = chars.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  }
  overlay.style.display = 'flex';
}

async function confirmarTransacaoMoeda() {
  const tipo    = document.getElementById('moeda-tx-tipo').value;
  const denom   = document.getElementById('moeda-tx-denom').value;
  const qtd     = parseInt(document.getElementById('moeda-tx-qtd').value) || 0;
  const desc    = document.getElementById('moeda-tx-desc').value.trim();
  const charId  = INV.charId;
  if (!qtd || qtd <= 0) { mostrarToast('Quantidade inválida', 'erro'); return; }

  try {
    if (tipo === 'dar' || tipo === 'remover') {
      await _moedaUpsert(charId, denom, tipo === 'dar' ? qtd : -qtd);
      await _moedaLog(charId, null, denom, qtd, tipo==='dar'?'receber':'remover', desc);
      mostrarToast(`✓ ${tipo==='dar'?'Adicionado':'Removido'}: ${qtd} ${denom}`, 'ok');
    } else if (tipo === 'transferir') {
      const destId = document.getElementById('moeda-tx-destino').value;
      if (!destId) { mostrarToast('Selecione um destino', 'erro'); return; }
      // Verificar saldo antes de debitar
      const saldoAtual = await sb(
        `moedas?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&dono_id=eq.${charId}&denominacao=eq.${encodeURIComponent(denom)}&select=quantidade`
      ).catch(()=>[]);
      const saldo = saldoAtual?.[0]?.quantidade || 0;
      if (saldo < qtd) { mostrarToast(`❌ Saldo insuficiente — você tem ${saldo} ${denom}`, 'erro'); return; }
      await _moedaUpsert(charId, denom, -qtd);
      await _moedaUpsert(destId,  denom, +qtd);
      await _moedaLog(charId, destId, denom, qtd, 'transferir', desc);
      const destChar = RPG_DATA?.characters?.find(x=>x.id==destId);
      mostrarToast(`✓ ${qtd} ${denom} transferido(s) para ${destChar?.nome||'destino'}`, 'ok');
    }
    document.getElementById('modal-moeda-tx-overlay').style.display = 'none';
    renderInvMoedas();
  } catch(e) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

async function _moedaUpsert(charId, denominacao, delta) {
  // Buscar registro atual
  const atual = await sb(
    `moedas?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&dono_id=eq.${charId}&denominacao=eq.${encodeURIComponent(denominacao)}&select=id,quantidade`
  ).catch(()=>null);
  const reg = atual?.[0];
  if (reg) {
    const novo = Math.max(0, (reg.quantidade||0) + delta);
    await sb(`moedas?id=eq.${reg.id}`, { method:'PATCH', body: JSON.stringify({ quantidade: novo }) });
  } else {
    await sb('moedas', { method:'POST', body: JSON.stringify({
      rpg_id: CURRENT_RPG.id, dono_id: charId, denominacao, quantidade: Math.max(0, delta)
    }), headers:{'Prefer':'return=minimal'} });
  }
}

async function _moedaLog(donoId, destinoId, denominacao, quantidade, tipo, descricao) {
  try {
    await sb('log_transacoes', { method:'POST', body: JSON.stringify({
      rpg_id: CURRENT_RPG.id, dono_id: donoId, destino_id: destinoId||null,
      denominacao, quantidade, tipo, descricao: descricao||null
    }), headers:{'Prefer':'return=minimal'} });
  } catch(e) { console.warn('[I6] Log de transação falhou:', e); }
}

// ── CFG-MOEDAS — Configuração de denominações (Mestre) ───────
// Estado local para o editor de moedas
let _cfgMoedasTemp = [];

function cfgMoedasRender() {
  const el = document.getElementById('cfg-moedas-lista');
  if (!el) return;
  const denoms = _cfgMoedasTemp;
  if (!denoms.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;padding:8px 0">Nenhuma denominação. Adicione uma abaixo.</div>';
    return;
  }
  el.innerHTML = denoms.map((d, i) => `
    <div style="display:flex;gap:6px;align-items:center;padding:8px 10px;background:rgba(10,14,22,0.6);border:1px solid rgba(30,45,66,0.7);border-radius:8px;margin-bottom:6px">
      <input value="${d.emoji||''}" maxlength="4" placeholder="🪙" oninput="_cfgMoedasTemp[${i}].emoji=this.value"
        style="width:40px;text-align:center;padding:5px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8a84b;font-size:1rem">
      <input value="${d.nome||''}" placeholder="Nome (ex: Ouro)" oninput="_cfgMoedasTemp[${i}].nome=this.value"
        style="flex:1;padding:5px 8px;background:rgba(10,14,22,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:6px;color:var(--texto);font-size:0.82rem">
      <input type="number" value="${d.valor_base||1}" min="1" placeholder="Base" title="Valor base em relação à menor moeda"
        oninput="_cfgMoedasTemp[${i}].valor_base=parseInt(this.value)||1"
        style="width:60px;text-align:center;padding:5px;background:rgba(10,14,22,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:6px;color:var(--texto);font-size:0.8rem">
      <div style="display:flex;flex-direction:column;gap:2px">
        ${i > 0 ? `<button onclick="_cfgMoedasMover(${i},-1)" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.7rem;padding:0;line-height:1">▲</button>` : '<span style="height:14px;display:block"></span>'}
        ${i < denoms.length-1 ? `<button onclick="_cfgMoedasMover(${i},+1)" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.7rem;padding:0;line-height:1">▼</button>` : '<span style="height:14px;display:block"></span>'}
      </div>
      <button onclick="_cfgMoedasRemover(${i})"
        style="background:none;border:none;color:#e74c3c55;cursor:pointer;font-size:0.9rem;padding:2px 4px;transition:color 0.2s"
        onmouseover="this.style.color='#e74c3c'" onmouseout="this.style.color='#e74c3c55'">🗑</button>
    </div>`).join('');
}

function cfgMoedasInit() {
  // Inicializar com denominações atuais
  _cfgMoedasTemp = JSON.parse(JSON.stringify(
    CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS
  ));
  cfgMoedasRender();
}

function _cfgMoedasRemover(i) {
  _cfgMoedasTemp.splice(i, 1);
  cfgMoedasRender();
}

function _cfgMoedasMover(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _cfgMoedasTemp.length) return;
  [_cfgMoedasTemp[i], _cfgMoedasTemp[j]] = [_cfgMoedasTemp[j], _cfgMoedasTemp[i]];
  cfgMoedasRender();
}

function cfgMoedasAdicionar() {
  const nome  = document.getElementById('cfg-moeda-nova-nome')?.value?.trim();
  const emoji = document.getElementById('cfg-moeda-nova-emoji')?.value?.trim() || '🪙';
  const base  = parseInt(document.getElementById('cfg-moeda-nova-base')?.value) || 1;
  if (!nome) { mostrarToast('Digite o nome da moeda', 'aviso'); return; }
  _cfgMoedasTemp.push({ nome, emoji, cor: '#c8a84b', valor_base: base });
  document.getElementById('cfg-moeda-nova-nome').value  = '';
  document.getElementById('cfg-moeda-nova-emoji').value = '';
  document.getElementById('cfg-moeda-nova-base').value  = '';
  cfgMoedasRender();
}

async function cfgMoedasSalvar() {
  // Validar: pelo menos 1 denominação com nome não vazio
  const validas = _cfgMoedasTemp.filter(d => d.nome?.trim());
  if (!validas.length) { mostrarToast('Adicione pelo menos uma moeda', 'aviso'); return; }
  // Garantir cor padrão
  validas.forEach(d => { if (!d.cor) d.cor = '#c8a84b'; });
  try {
    const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
    // Ler theme_json atual
    const reg = await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=theme_json`);
    const theme = reg?.[0]?.theme_json || {};
    theme.denominacoes_moeda = validas;
    await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}`, {
      method:'PATCH', body:JSON.stringify({ theme_json: theme })
    });
    // Atualizar estado local
    if (!CURRENT_RPG) window.CURRENT_RPG = {};
    if (!CURRENT_RPG.theme) CURRENT_RPG.theme = {};
    CURRENT_RPG.theme.denominacoes_moeda = validas;
    mostrarToast('✓ Moedas salvas! Recarregue o inventário para ver as mudanças.', 'ok');
  } catch(e) { mostrarToast('Erro ao salvar: ' + (e.message||''), 'erro'); }
}

// ── BROADCAST HELPER ─────────────────────────────────────────────────────
function _invBroadcastDrop(it, personagemDestino, origem) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      tipo_evento: 'item_dropado',
      rpg_id: CURRENT_RPG.id,
      personagem_destino: personagemDestino,
      item: {
        nome: it.nome, tipo_canonico: it.tipo_canonico, raridade: it.raridade,
        nivel: it.nivel, visual_config: it.visual_config,
        atributos_bonus: it.atributos_bonus, trade_offs: it.trade_offs, efeitos: it.efeitos
      },
      origem
    };
    ws.send(JSON.stringify({
      topic: `realtime:rpg:${CURRENT_RPG.id}`,
      event: 'broadcast',
      payload: { type:'broadcast', event:'item_dropado', payload }
    }));
  } catch(e) { /* broadcast opcional */ }
}

// ── HELPER: ícone de item ─────────────────────────────────────────────────
function _itemIcon(it) {
  if (!it) return '📦';
  const vc = it.visual_config || {};
  // Support img_url directly on item def (new field)
  if (it.img_url) return `<img src="${it.img_url}" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.style.display='none'">`;
  if (vc.tipo_visual === 'url' && vc.valor) return `<img src="${vc.valor}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">`;
  if (vc.tipo_visual === 'emoji' && vc.valor) return vc.valor;
  return TIPO_DEFAULTS?.[it.tipo_canonico]?.emoji || it.icone || '📦';
}

// Expor emitirEvento globalmente para Parte 1 (dar item broadcast)
window.emitirEvento = function(evento, dados) { _invBroadcastDrop(dados.item||{}, dados.personagem_destino, dados.origem||evento); };

// Realtime: receber item_dropado de outros jogadores
document.addEventListener('DOMContentLoaded', () => {
  // Patch no receptor de websocket para item_dropado
  const _origOnMsg = window._wsOnMsg;
  // Injetado via listener no ws após carregamento
});

// Hook no ws message handler para item_dropado
const _origWsHandler = window.wsHandler;
function _patchWsItemDropado(payload) {
  if (payload?.event !== 'item_dropado') return;
  const data = payload.payload || payload;
  const it = data.item || {};
  const rc = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
  const dur = { comum:4000, incomum:4000, raro:6000, epico:8000, lendario:12000 }[it.raridade] || 5000;
  const icon = _itemIcon(it);
  const corBorda = it.visual_config?.cor_borda || rc.borda;
  const corFundo = it.visual_config?.cor_fundo || rc.fundo;
  const animCls = it.raridade==='epico'?'anim-glow':it.raridade==='lendario'?'anim-shimmer':'';
  const bonusHtml = Object.entries(it.atributos_bonus||{}).map(([k,v])=>{
    const n=typeof v==='object'?v.valor:v;
    return `<div style="font-size:0.68rem;color:${n>=0?'#4eca7e':'#e05040'}">${n>=0?'↑ +':'↓ '}${n} ${k}</div>`;
  }).join('');
  const card = document.createElement('div');
  card.style.cssText = `position:fixed;top:80px;right:12px;z-index:9999;width:160px;border-radius:10px;padding:12px;text-align:center;border:2px solid ${corBorda};background:${corFundo};box-shadow:0 8px 32px rgba(0,0,0,0.6);animation:slideDown 0.25s ease-out;opacity:0;transition:opacity 0.2s`;
  card.className = animCls;
  card.innerHTML = `
    <div class="cat-item-badge ${rc.badge}" style="margin-bottom:6px">${rc.label}</div>
    <div style="font-size:2rem;margin-bottom:4px">${icon}</div>
    <div style="font-family:var(--fonte-d);font-size:0.72rem;color:#fff;margin-bottom:2px">${it.nome||'Item'}</div>
    <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:6px">${it.nivel?'Nível '+it.nivel:''}</div>
    ${bonusHtml}
    ${data.personagem_destino?`<div style="font-size:0.65rem;color:#4eca7e;margin-top:6px;border-top:1px solid rgba(255,255,255,0.08);padding-top:4px">→ ${data.personagem_destino}</div>`:''}`;
  document.body.appendChild(card);
  requestAnimationFrame(() => { card.style.opacity = '1'; });
  setTimeout(() => {
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 300);
  }, dur);
}

// Integrar com o ws existente via monkey-patch do onmessage
const _wsCheckInterval = setInterval(() => {
  if (typeof ws !== 'undefined' && ws) {
    const originalOnMessage = ws.onmessage;
    ws.onmessage = function(e) {
      if (originalOnMessage) originalOnMessage.call(this, e);
      try {
        const msg = JSON.parse(e.data);
        if (msg.payload?.event === 'item_dropado') _patchWsItemDropado(msg.payload);
      } catch {}
    };
    clearInterval(_wsCheckInterval);
  }
}, 500);

console.log('[RPGHUB] ✓ Parte 2 carregada — I2 Inventário · I3 Equip/Desequip · A3 Média Grupo · I4 Nivelamento · I5 Carga · I6 Moedas');

// ─────────────────────────────────────────────────────────────────
// I7 — VOCABULÁRIO TEMÁTICO E GERAÇÃO DE NOMES
// ─────────────────────────────────────────────────────────────────

// Vocabulário genérico de fantasia (fallback quando campanha sem vocab)
const VOCAB_FALLBACK = {
  prefixo_material: ['Ferro','Aço','Mithril','Obsidiana','Osso','Couro','Prata','Cristal','Rúnico','Bronze','Pedra','Seda'],
  adjetivo_qualidade: ['Afiado','Forjado','Sombrio','Encantado','Antigo','Corrompido','Sagrado','Maldito','Purificado','Bendito','Lendário','Esquecido','Eterno','Veloz','Pesado'],
  nome_origem: ['da Forja Esquecida','do Rei Traído','das Sombras Eternas','da Ordem Caída','do Dragão Ancestral','das Ruínas Antigas','do Abismo','da Luz Dourada','dos Guerreiros Perdidos','do Templo Proibido']
};

// Cache de vocabulário por rpgId
const _vocabCache = {};

async function carregarVocabulario(rpgId) {
  if (_vocabCache[rpgId]) return _vocabCache[rpgId];
  try {
    const rows = await sb(`vocabulario_tematico?rpg_id=eq.${encodeURIComponent(rpgId)}&select=tipo,valor`);
    const vocab = { prefixo_material: [], adjetivo_qualidade: [], nome_origem: [] };
    (rows||[]).forEach(r => {
      if (vocab[r.tipo]) vocab[r.tipo].push(r.valor);
    });
    // Completar com fallback se categoria vazia
    Object.keys(VOCAB_FALLBACK).forEach(k => {
      if (!vocab[k].length) vocab[k] = [...VOCAB_FALLBACK[k]];
    });
    _vocabCache[rpgId] = vocab;
    return vocab;
  } catch(e) {
    return { ...VOCAB_FALLBACK };
  }
}

// Nome base por tipo canônico + subtipo
const NOMES_BASE_TIPO = {
  arma: { default:'Arma', espada:'Espada', machado:'Machado', cajado:'Cajado', arco:'Arco', adaga:'Adaga', lança:'Lança', martelo:'Martelo' },
  escudo: { default:'Escudo', broquel:'Broquel' },
  armadura: { default:'Armadura', cota_malha:'Cota de Malha', peitoral:'Peitoral', manto:'Manto', túnica:'Túnica' },
  calcas: { default:'Grevas', calças_couro:'Calças de Couro', kilt:'Kilt' },
  amuleto: { default:'Amuleto', anel:'Anel', bracelete:'Bracelete', cordão:'Cordão', colar:'Colar', pedra:'Pedra Rúnica', coroa:'Coroa', brinco:'Brinco' },
  capacete: { default:'Elmo' },
  botas: { default:'Botas', sandálias:'Sandálias', sapatilhas:'Sapatilhas' },
  capa: { default:'Capa', manto:'Manto', véu:'Véu' },
  consumivel: { default:'Poção', frasco:'Frasco', pergaminho:'Pergaminho', runa:'Runa' },
  customizado: { default:'Artefato' }
};

// Função principal: gerarNomeItem(tipoCanônico, subtipo, raridade) → String
// Returns um objeto com as 3 partes para a UI de 3 colunas
async function _gerarPartesNome(rpgId, tipo, subtipo, raridade) {
  const vocab = await carregarVocabulario(rpgId||RPG_DATA?.rpgId||'');
  const rand = arr => arr[Math.floor(Math.random()*arr.length)];

  const nomeBase = NOMES_BASE_TIPO[tipo]?.[subtipo] || NOMES_BASE_TIPO[tipo]?.default || 'Item';
  const material = rand(vocab.prefixo_material);
  const adjetivo = rand(vocab.adjetivo_qualidade);
  // Raro+: 60% de chance de nome de origem
  const raresIds = ['raro','epico','lendario'];
  const temOrigem = raresIds.includes(raridade) && Math.random() < 0.60;
  const origem = temOrigem ? rand(vocab.nome_origem) : '';

  return { nomeBase, material, adjetivo, origem };
}

function _montarNomeGerado(nomeBase, material, adjetivo, origem) {
  let nome = `${nomeBase} ${material} ${adjetivo}`.trim();
  if (origem) nome += ` ${origem}`;
  return nome;
}

// === Funções UI do catálogo ===
async function itemGerarNome() {
  const tipo = document.getElementById('fi-tipo')?.value || 'customizado';
  const subtipo = document.getElementById('fi-subtipo')?.value || '';
  const rar = document.getElementById('fi-raridade')?.value || 'comum';
  const partes = await _gerarPartesNome(RPG_DATA?.rpgId, tipo, subtipo, rar);
  const painelPartes = document.getElementById('fi-nome-partes');
  if (painelPartes) painelPartes.style.display = 'block';
  const matEl = document.getElementById('fi-nome-material');
  const adjEl = document.getElementById('fi-nome-adjetivo');
  const oriEl = document.getElementById('fi-nome-origem');
  if (matEl) matEl.value = partes.material;
  if (adjEl) adjEl.value = partes.adjetivo;
  if (oriEl) oriEl.value = partes.origem;
  // Atualizar preview
  const preview = document.getElementById('fi-nome-preview');
  if (preview) preview.textContent = _montarNomeGerado(partes.nomeBase, partes.material, partes.adjetivo, partes.origem);
}

function itemAtualizarNomeGerado() {
  const tipo = document.getElementById('fi-tipo')?.value || 'customizado';
  const subtipo = document.getElementById('fi-subtipo')?.value || '';
  const nomeBase = NOMES_BASE_TIPO[tipo]?.[subtipo] || NOMES_BASE_TIPO[tipo]?.default || 'Item';
  const mat = document.getElementById('fi-nome-material')?.value || '';
  const adj = document.getElementById('fi-nome-adjetivo')?.value || '';
  const ori = document.getElementById('fi-nome-origem')?.value || '';
  const preview = document.getElementById('fi-nome-preview');
  if (preview) preview.textContent = _montarNomeGerado(nomeBase, mat, adj, ori);
}

function itemAplicarNomeGerado() {
  const tipo = document.getElementById('fi-tipo')?.value || 'customizado';
  const subtipo = document.getElementById('fi-subtipo')?.value || '';
  const nomeBase = NOMES_BASE_TIPO[tipo]?.[subtipo] || NOMES_BASE_TIPO[tipo]?.default || 'Item';
  const mat = document.getElementById('fi-nome-material')?.value || '';
  const adj = document.getElementById('fi-nome-adjetivo')?.value || '';
  const ori = document.getElementById('fi-nome-origem')?.value || '';
  const nome = _montarNomeGerado(nomeBase, mat, adj, ori);
  const input = document.getElementById('fi-nome');
  if (input) input.value = nome;
  // Trigger preview update se existir
  if (typeof itemAtualizarPreview === 'function') itemAtualizarPreview();
  // Fechar painel de partes
  const painel = document.getElementById('fi-nome-partes');
  if (painel) painel.style.display = 'none';
}

// Exportar função pública de geração de nome
async function gerarNomeItem(rpgId, tipo, subtipo, raridade) {
  const partes = await _gerarPartesNome(rpgId, tipo, subtipo, raridade);
  return _montarNomeGerado(partes.nomeBase, partes.material, partes.adjetivo, partes.origem);
}


// ─────────────────────────────────────────────────────────────────
// I8 — GERAÇÃO AUTOMÁTICA DE STATUS DO ITEM
// ─────────────────────────────────────────────────────────────────

// Fatores de escala por tier e raridade
const _FATOR_ESCALA = {
  1: { comum:0.05 },
  2: { comum:0.08, incomum:0.12 },
  3: { comum:0.10, incomum:0.16, raro:0.22 },
  4: { comum:0.12, incomum:0.18, raro:0.25, epico:0.32 },
  5: { raro:0.28, epico:0.35, lendario:0.45 }
};

// Cor de borda por raridade
const _BORDA_RARIDADE = {
  comum:'#888888', incomum:'#2ecc71', raro:'#3498db', epico:'#9b59b6', lendario:'#f39c12'
};

// Animação automática por raridade
const _ANIMACAO_RARIDADE = {
  comum:'none', incomum:'none', raro:'none', epico:'glow', lendario:'shimmer'
};

// Efeitos compatíveis por tipo canônico
const _EFEITOS_TIPO = {
  arma: ['ao_atacar','ao_matar'],
  escudo: ['ao_ser_atacado','ao_receber_dano_critico'],
  armadura: ['hp_abaixo_30pct','aura_resistencia'],
  calcas: ['hp_abaixo_30pct','aura_resistencia'],
  amuleto: ['ao_atacar','ao_ser_atacado','ao_curar','ao_usar_habilidade','ao_matar','ao_receber_dano_critico'],
  capacete: ['aura_inteligencia','condicional'],
  botas: ['ao_usar_habilidade','aura_destreza'],
  capa: ['condicional','aura_resistencia'],
  consumivel: [],
  customizado: ['ao_atacar','ao_ser_atacado','ao_usar_habilidade']
};

// Chance de efeito por raridade
const _CHANCE_EFEITO = { comum:0.05, incomum:0.175, raro:0.50, epico:0.775, lendario:1.0 };

/*
  gerarStatusItem(rpgId, tipoCanônico, grupoAtributo, tierInimigo, raridade, slotFuncional, personagemAlvo?)
  Retorna: { atributos_bonus, trade_offs, efeitos, nivel, visual_config, params_geracao }
*/
async function gerarStatusItem(rpgId, tipoCanônico, grupoAtributo, tierInimigo, raridade, slotFuncional, personagemAlvo) {
  const tier = Math.min(5, Math.max(1, parseInt(tierInimigo)||1));
  const fatorObj = _FATOR_ESCALA[tier] || {};
  const fator = fatorObj[raridade];
  if (fator === undefined) {
    // Combinação inválida tier/raridade
    return { atributos_bonus:{}, trade_offs:{}, efeitos:[], nivel:tier, visual_config:{}, params_geracao:{aviso:'Combinação tier/raridade inválida'} };
  }

  // PASSO 1: Bônus base
  let mediaGrupo = 10; // fallback
  try {
    const res = await calcularMediaGrupo(rpgId, grupoAtributo);
    mediaGrupo = res?.media || 10;
  } catch(e) {}

  const variancia = 0.8 + Math.random() * 0.4;
  let bonusBase = Math.max(1, Math.floor(mediaGrupo * fator * variancia));

  // PASSO 2: Progressão controlada (clamp +10-25% acima do equipado atual)
  if (personagemAlvo) {
    try {
      const charInv = await sb(`inventario?rpg_id=eq.${encodeURIComponent(rpgId)}&personagem_nome=eq.${encodeURIComponent(personagemAlvo)}&slot_equipado=eq.${slotFuncional}&equipado=eq.true&select=item_catalog_id`);
      if (charInv && charInv.length) {
        const itemAtual = await sb(`item_catalog?id=eq.${charInv[0].item_catalog_id}&select=atributos_bonus`);
        if (itemAtual && itemAtual.length) {
          const bonusAtual = Object.values(itemAtual[0].atributos_bonus||{}).reduce((s,v)=>s+Math.abs(typeof v==='object'?v.valor:v),0) || 0;
          const maxPermitido = Math.floor(bonusAtual * (1.10 + Math.random() * 0.15));
          if (maxPermitido > 0) bonusBase = Math.min(bonusBase, maxPermitido);
        }
      }
    } catch(e) {}
  }

  // PASSO 3: Bônus secundário misto (Incomum+)
  const atributosBonus = {};
  const raresIds = ['incomum','raro','epico','lendario'];
  let grupoAtributoNome = grupoAtributo;
  // Usar primeiro atributo do grupo como nome display
  try {
    const mapa = await carregarMapeamento(rpgId);
    const atrsDoGrupo = mapa.filter(m=>m.grupo_base===grupoAtributo);
    if (atrsDoGrupo.length) grupoAtributoNome = atrsDoGrupo[0].nome_customizado;
  } catch(e) {}

  atributosBonus[grupoAtributoNome] = bonusBase;

  if (raresIds.includes(raridade) && Math.random() < 0.40) {
    const outros = ['forca','destreza','constituicao','inteligencia'].filter(g=>g!==grupoAtributo);
    const grupoSec = outros[Math.floor(Math.random()*outros.length)];
    const bonusSec = Math.max(1, Math.floor(bonusBase * (0.30 + Math.random() * 0.20)));
    let grupoSecNome = grupoSec;
    try {
      const mapa = await carregarMapeamento(rpgId);
      const atrsGrupoSec = mapa.filter(m=>m.grupo_base===grupoSec);
      if (atrsGrupoSec.length) grupoSecNome = atrsGrupoSec[Math.floor(Math.random()*atrsGrupoSec.length)].nome_customizado;
    } catch(e) {}
    atributosBonus[grupoSecNome] = bonusSec;
  }

  // PASSO 4: Trade-off (penalidade)
  const tradeOffs = {};
  const temTradeOff = ['raro','epico','lendario'].includes(raridade) && bonusBase > mediaGrupo * 0.25 && Math.random() < 0.30;
  if (temTradeOff) {
    const gruposAll = ['forca','destreza','constituicao','inteligencia'].filter(g=>g!==grupoAtributo);
    const grupoPen = gruposAll[Math.floor(Math.random()*gruposAll.length)];
    const penalidade = Math.max(1, Math.floor(bonusBase * (0.20 + Math.random() * 0.20)));
    let grupoPenNome = grupoPen;
    try {
      const mapa = await carregarMapeamento(rpgId);
      const atrsPen = mapa.filter(m=>m.grupo_base===grupoPen);
      if (atrsPen.length) grupoPenNome = atrsPen[Math.floor(Math.random()*atrsPen.length)].nome_customizado;
    } catch(e) {}
    tradeOffs[grupoPenNome] = -penalidade;
    atributosBonus[grupoPenNome] = -penalidade;
  }

  // PASSO 5: Efeitos passivos/procs
  const efeitos = [];
  const chanceEfeito = _CHANCE_EFEITO[raridade] || 0;
  const gatilhosCompativeis = _EFEITOS_TIPO[tipoCanônico] || [];
  let qtdEfeitos = raridade==='lendario'?Math.floor(2+Math.random()*3) : raridade==='epico'?Math.floor(2+Math.random()*2) : raridade==='raro'?Math.floor(1+Math.random()*1) : 1;

  for (let ei = 0; ei < qtdEfeitos; ei++) {
    if (Math.random() > chanceEfeito) continue;
    if (!gatilhosCompativeis.length) break;
    const g = gatilhosCompativeis[Math.floor(Math.random()*gatilhosCompativeis.length)];

    if (g.startsWith('aura_')) {
      efeitos.push({ tipo:'aura', efeito:'boost_atributo', valor:Math.max(1,Math.floor(bonusBase*0.3)), escopo:'self' });
    } else if (g === 'condicional' || g === 'hp_abaixo_30pct') {
      efeitos.push({ tipo:'condicional', condicao:'hp_abaixo_30pct', efeito_aplicado:{ tipo:'buff', valor:Math.max(1,Math.floor(bonusBase*0.25)) }});
    } else {
      const tiposEfeito = ['debuff','dano','buff'];
      const te = tiposEfeito[Math.floor(Math.random()*tiposEfeito.length)];
      const debuffs = ['Atordoado','Envenenado','Lentidão','Fraqueza','Cegueira'];
      efeitos.push({
        tipo:'proc',
        gatilho: g,
        chance: parseFloat((0.15 + Math.random()*0.25).toFixed(2)),
        efeito_aplicado:{
          tipo: te,
          debuff: te==='debuff' ? debuffs[Math.floor(Math.random()*debuffs.length)] : undefined,
          duracao_turnos: te==='debuff' ? Math.floor(1+Math.random()*2) : undefined,
          valor: te!=='debuff' ? Math.max(1,Math.floor(bonusBase*0.5)) : undefined,
          alvo: g.includes('ser_atacado')||g.includes('dano_critico') ? 'self' : 'alvo_do_ataque'
        }
      });
    }
  }

  // PASSO 6: Visual automático
  const nivel = tier + (raridade==='incomum'?1:raridade==='raro'?2:raridade==='epico'?3:raridade==='lendario'?4:0);
  const nivelMaxCamp = RPG_DATA?.theme?.nivel_maximo || 20;
  const nivelPct = Math.min(1, nivel / nivelMaxCamp);
  const lightness = Math.floor(10 + nivelPct * 12);
  const saturation = Math.floor(30 + nivelPct * 20);
  const EMOJI_TIPO = { arma:'⚔️', escudo:'🛡️', armadura:'🥋', calcas:'👖', amuleto:'💎', capacete:'⛑️', botas:'👢', capa:'🧣', consumivel:'🧪', customizado:'✨' };

  const visual_config = {
    tipo_visual: 'emoji',
    valor: EMOJI_TIPO[tipoCanônico] || '✨',
    cor_fundo: `hsl(220,${saturation}%,${lightness}%)`,
    cor_borda: _BORDA_RARIDADE[raridade] || '#888888',
    animacao: _ANIMACAO_RARIDADE[raridade] || 'none'
  };

  // PASSO 7: Params de geração
  const params_geracao = {
    gerado_automaticamente: true,
    tier, raridade, grupoAtributo, slotFuncional, personagemAlvo: personagemAlvo||null,
    mediaGrupo, fator, variancia: parseFloat(variancia.toFixed(2)),
    gerado_em: new Date().toISOString()
  };

  return { atributos_bonus: atributosBonus, trade_offs: tradeOffs, efeitos, nivel, visual_config, params_geracao };
}


// ─────────────────────────────────────────────────────────────────
// I9 — DROP AUTOMÁTICO POR TIER (MORTE DE NPC)
// ─────────────────────────────────────────────────────────────────

// Tabelas de drop por tier
const _DROP_QTDE = {
  1: { minItens:0, maxItens:0, chanceItem:0.15, raridadesPossiveis:['comum'] },
  2: { minItens:0, maxItens:1, chanceItem:0.35, raridadesPossiveis:['comum','incomum'] },
  3: { minItens:0, maxItens:1, chanceItem:0.55, raridadesPossiveis:['comum','incomum','raro'] },
  4: { minItens:1, maxItens:2, chanceItem:0.80, raridadesPossiveis:['incomum','raro','epico'] },
  5: { minItens:1, maxItens:3, chanceItem:1.00, raridadesPossiveis:['raro','epico','lendario'] }
};

const _PESO_RARIDADE_TIER = {
  2: { comum:0.80, incomum:0.20 },
  3: { comum:0.55, incomum:0.35, raro:0.10 },
  4: { incomum:0.50, raro:0.35, epico:0.15 },
  5: { raro:0.55, epico:0.35, lendario:0.10 }
};

function _sortearRaridade(tier) {
  const pesos = _PESO_RARIDADE_TIER[tier] || { comum:1 };
  const total = Object.values(pesos).reduce((a,b)=>a+b,0);
  let rng = Math.random() * total;
  for (const [rar, peso] of Object.entries(pesos)) {
    rng -= peso;
    if (rng <= 0) return rar;
  }
  return Object.keys(pesos)[0];
}

// Chance de drop acima do nível
const _CHANCE_NIVEL_ACIMA = { comum:0.03, incomum:0.06, raro:0.10, epico:0.15, lendario:0.25 };
const _MAX_NIVEL_ACIMA = { comum:1, incomum:2, raro:2, epico:3, lendario:3 };

function _calcularNivelItem(tier, raridade, npcNivel) {
  const nivelBase = npcNivel || tier;
  const chanceAcima = _CHANCE_NIVEL_ACIMA[raridade] || 0;
  if (Math.random() < chanceAcima) {
    const max = _MAX_NIVEL_ACIMA[raridade] || 1;
    return nivelBase + Math.floor(1 + Math.random() * max);
  }
  return nivelBase;
}

// calcularDrops: retorna lista de specs de itens a dropar
async function calcularDrops(rpgId, npcTier, npcNivel, npcGrupoAtributo) {
  const tier = Math.min(5, Math.max(1, parseInt(npcTier)||1));
  const config = _DROP_QTDE[tier] || _DROP_QTDE[1];

  if (Math.random() > config.chanceItem) return []; // sem drops

  const qtdItens = config.minItens + Math.floor(Math.random() * (config.maxItens - config.minItens + 1));
  if (!qtdItens) return [];

  const drops = [];
  const tipos = ['arma','armadura','amuleto','botas','capacete','calcas','escudo','capa'];

  for (let i = 0; i < qtdItens; i++) {
    const raridade = _sortearRaridade(tier);
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const grupoAtributo = npcGrupoAtributo || ['forca','destreza','constituicao','inteligencia'][Math.floor(Math.random()*4)];
    const nivel = _calcularNivelItem(tier, raridade, npcNivel);

    // Slot funcional pelo tipo
    const SLOT_TIPO = { arma:'arma_principal', escudo:'arma_secundaria', armadura:'corpo', calcas:'pernas', amuleto:'acessorio', capacete:'cabeca', botas:'pes', capa:'capa' };
    const slot = SLOT_TIPO[tipo] || 'acessorio';

    drops.push({ tipo, raridade, grupoAtributo, slot, nivel });
  }

  return drops;
}

// Executar drop: gera itens, insere no banco, cria loot_pendente, broadcast, atualiza token
async function _executarDropNPC(rpgId, npcNome, npcChar) {
  const tier = parseInt(npcChar.custom_attrs?.tier) || 1;
  const nivel = npcChar.nivel || tier;
  const grupoAtributo = npcChar.custom_attrs?.grupo_atributo || null;

  let drops;
  try {
    drops = await calcularDrops(rpgId, tier, nivel, grupoAtributo);
  } catch(e) { return; }

  if (!drops || !drops.length) return;

  for (const dropSpec of drops) {
    try {
      // Gerar status completo do item
      const status = await gerarStatusItem(rpgId, dropSpec.tipo, dropSpec.grupoAtributo, tier, dropSpec.raridade, dropSpec.slot, null);

      // Gerar nome temático
      const nome = await gerarNomeItem(rpgId, dropSpec.tipo, '', dropSpec.raridade);

      // Inserir em item_catalog
      const itemBody = {
        rpg_id: rpgId,
        nome,
        tipo_canonico: dropSpec.tipo,
        raridade: dropSpec.raridade,
        nivel: status.nivel,
        slot_equipado: dropSpec.slot,
        atributos_bonus: status.atributos_bonus,
        trade_offs: status.trade_offs,
        efeitos: status.efeitos,
        visual_config: status.visual_config,
        params_geracao: status.params_geracao,
        gerado_automaticamente: true,
        aceita_amuleto_aninhado: true
      };

      let itemId = null;
      try {
        const inserted = await sb('item_catalog', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(itemBody)
        });
        itemId = inserted?.[0]?.id || null;
      } catch(e) { continue; }

      // Criar registro em loot_pendente
      if (itemId) {
        try {
          await sb('loot_pendente', {
            method: 'POST',
            body: JSON.stringify({
              rpg_id: rpgId,
              item_id: itemId,
              origem_npc: npcNome,
              saqueado: false,
              criado_em: new Date().toISOString()
            })
          });
        } catch(e) {}
      }

      // Broadcast item_dropado para todos
      const payload = {
        tipo_evento: 'item_dropado',
        rpg_id: rpgId,
        personagem_destino: null,
        item: {
          id: itemId,
          nome,
          tipo_canonico: dropSpec.tipo,
          raridade: dropSpec.raridade,
          nivel: status.nivel,
          visual_config: status.visual_config,
          atributos_bonus: status.atributos_bonus,
          trade_offs: status.trade_offs,
          efeitos: status.efeitos,
          bloqueado_por_nivel: false,
          nivel_minimo_uso: status.nivel
        },
        origem: 'drop_npc',
        npc_nome: npcNome
      };

      // Usar função emitirEvento se disponível, senão broadcast direto
      if (typeof emitirEvento === 'function') {
        emitirEvento('item_dropado', payload);
      } else if (typeof combateBroadcast === 'function') {
        combateBroadcast('item_dropado', payload);
      }

      // Exibir card de drop na tela local imediatamente
      _patchWsItemDropado({ event:'item_dropado', payload });

      // Delay entre cards (500ms para múltiplos drops)
      await new Promise(r=>setTimeout(r,500));

    } catch(e) { /* continuar próximo drop */ }
  }

  // Atualizar token do NPC com ✝💰 (marca de morto com loot)
  try {
    const c = RPG_DATA?.characters?.find(x=>x.nome===npcNome);
    if (c) {
      c.custom_attrs = c.custom_attrs || {};
      c.custom_attrs.morto = true;
      c.custom_attrs.tem_loot = true;
      await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(npcNome)}`,
        { method:'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
      // Re-renderizar token no mapa
      const entry = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===MAPA_STATE?.mapaAtualId);
      if (entry) mapaRenderTokens(entry.mapa);
    }
  } catch(e) {}
}

// Exibir indicador de loot no token (chamado por mapaRenderTokens)
// O token morto com loot recebe ícone ✝💰 — injetado via patch de renderização
const _origRenderTokenStyle = window._renderTokenStyle;
window._patchTokenLoot = function(c, tokenEl) {
  if (!tokenEl) return;
  if (c?.custom_attrs?.morto && c?.custom_attrs?.tem_loot) {
    // Adicionar ícone de saque sobre o token
    let lootBadge = tokenEl.querySelector('.loot-badge');
    if (!lootBadge) {
      lootBadge = document.createElement('div');
      lootBadge.className = 'loot-badge';
      lootBadge.style.cssText = 'position:absolute;top:-10px;right:-6px;font-size:0.75rem;background:rgba(192,57,43,0.85);border-radius:8px;padding:1px 4px;cursor:pointer;z-index:15;animation:pulse 1.5s infinite;user-select:none';
      lootBadge.textContent = '✝💰';
      lootBadge.title = 'Clique para saquear';
      lootBadge.onclick = (e) => { e.stopPropagation(); abrirModalLootNPC(c.nome); };
      tokenEl.appendChild(lootBadge);
    }
  }
};

// abrirModalLootNPC é implementado na Parte 3B com modal completo


// ─────────────────────────────────────────────────────────────────
// ESTILOS DA PARTE 3A
// ─────────────────────────────────────────────────────────────────
(function injectStyles3A() {
  const css = `
/* I7: generator toggle */
#fi-nome-partes { animation: fadeIn 0.2s ease-out; }

/* I9: token loot badge pulse */
@keyframes loot-pulse {
  0%,100% { transform:scale(1);box-shadow:0 0 4px rgba(192,57,43,0.4); }
  50% { transform:scale(1.1);box-shadow:0 0 8px rgba(192,57,43,0.7); }
}
.loot-badge { animation: loot-pulse 1.5s infinite !important; }

/* Import: novos section markers */
#section-attr-grupos .import-section-title::before { content:'🗂 '; }
#section-vocab-tematico .import-section-title::before { content:'📖 '; }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

console.log('[RPGHUB] ✓ Parte 3A carregada — I7 Vocabulário Temático · A4 Importação IA · I8 Geração de Status · I9 Drop por Tier');

// ═══════════════════════════════════════════════════════════════
// PARTE 3B — INTERAÇÃO SOCIAL
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// HELPER: renderizar card de item completo (compartilhado)
// Usado por I10, I11, I12, I13
// ─────────────────────────────────────────────────────────────
function _renderItemCard(it, opts = {}) {
  // it: item_catalog ou instância com joins
  const rc = RARIDADE_CORES?.[it.raridade] || { borda:'#888', fundo:'#141d2b', badge:'cat-item-badge', label: it.raridade||'comum' };
  const vc = it.visual_config || {};
  const corBorda = vc.cor_borda || rc.borda;
  const corFundo = vc.cor_fundo || rc.fundo || '#141d2b';
  const icon = _itemIcon(it);
  const animCls = vc.animacao && vc.animacao !== 'none' ? `anim-${vc.animacao}` : '';

  // Bônus
  const bonus = Object.entries(it.atributos_bonus || {});
  const tradeoffs = Object.entries(it.trade_offs || {});
  const bonusHtml = bonus.filter(([,v])=>(typeof v==='object'?v.valor:v)>0).map(([k,v])=>{
    const n = typeof v==='object'?v.valor:v;
    return `<div style="font-size:0.62rem;color:#4eca7e">↑ +${n} ${k}</div>`;
  }).join('');
  const penHtml = (tradeoffs.length ? tradeoffs : bonus.filter(([,v])=>(typeof v==='object'?v.valor:v)<0)).map(([k,v])=>{
    const n = typeof v==='object'?v.valor:v;
    return `<div style="font-size:0.62rem;color:#e05040">↓ ${n} ${k}</div>`;
  }).join('');
  const hasSevere = tradeoffs.some(([,v])=>Math.abs(typeof v==='object'?v.valor:v) > 3);

  // Efeitos
  const efeitos = (it.efeitos||[]).slice(0,2).map(ef=>{
    if (ef.tipo==='proc') return `<div style="font-size:0.58rem;color:#7ec8f0">${Math.round((ef.chance||0)*100)}% ${ef.gatilho?.replace(/_/g,' ')||''}</div>`;
    if (ef.tipo==='aura') return `<div style="font-size:0.58rem;color:#a77fdb">Aura: +${ef.valor||''}</div>`;
    return '';
  }).join('');

  const bloqueado = it.bloqueado_por_nivel;
  const nivel = it.nivel || it.nivel_minimo_uso || 1;

  const selStyle = opts.selecionado ? `box-shadow:0 0 0 2px #4eca7e;` : '';
  const clique = opts.onclick ? `onclick="${opts.onclick}"` : '';
  const botaoAcao = opts.botaoLabel ? `<button onclick="${opts.botaoFn}" style="width:100%;margin-top:6px;padding:6px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;letter-spacing:0.06em">${opts.botaoLabel}</button>` : '';

  return `
    <div class="${animCls}" ${clique} style="background:${corFundo};border:2px solid ${corBorda};border-radius:10px;padding:10px;cursor:${opts.onclick?'pointer':'default'};transition:box-shadow 0.15s;${selStyle}position:relative">
      ${hasSevere ? `<div style="position:absolute;top:4px;right:6px;font-size:0.75rem">⚠️</div>` : ''}
      ${bloqueado ? `<div style="position:absolute;top:4px;left:6px;font-size:0.75rem">🔒</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="${rc.badge}" style="font-size:0.5rem;padding:1px 4px">${rc.label || it.raridade}</div>
        <div style="font-size:0.6rem;color:var(--suave)">Nv.${nivel}</div>
      </div>
      <div style="font-size:1.8rem;text-align:center;margin:4px 0">${icon}</div>
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:#fff;text-align:center;margin-bottom:4px;line-height:1.2">${it.nome||'?'}</div>
      <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:5px">
        ${bonusHtml}${penHtml}${efeitos}
      </div>
      ${bloqueado ? `<div style="font-size:0.58rem;color:#f1c40f;text-align:center;margin-top:4px">Disponível no nível ${it.nivel_minimo_uso}</div>` : ''}
      ${botaoAcao}
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// I10 — SAQUE NO MAPA (modal completo)
// ─────────────────────────────────────────────────────────────
const LOOT_STATE = { npcNome: null, itens: [], selecionados: new Set() };

window.abrirModalLootNPC = async function(npcNome) {
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  if (!rpgId) return;

  LOOT_STATE.npcNome = npcNome;
  LOOT_STATE.itens = [];
  LOOT_STATE.selecionados = new Set();

  // Buscar loot pendente
  let loots = [];
  try {
    loots = await sb(`loot_pendente?rpg_id=eq.${encodeURIComponent(rpgId)}&origem_npc=eq.${encodeURIComponent(npcNome)}&saqueado=eq.false&select=id,item_id`);
  } catch(e) {}

  if (!loots?.length) { mostrarToast('Nenhum loot disponível', 'info'); return; }

  // Buscar detalhes dos itens
  const ids = loots.map(l=>l.item_id).filter(Boolean);
  let itens = [];
  if (ids.length) {
    try { itens = await sb(`item_catalog?id=in.(${ids.join(',')})&select=*`); } catch(e) {}
  }

  LOOT_STATE.itens = itens.map((it, i) => ({ ...it, loot_id: loots[i]?.id }));

  // Popular destino
  const chars = (RPG_DATA?.characters||[]).filter(c=>(c.hp_atual??c.custom_attrs?.hp_max??100)>0 && (c.custom_attrs?.tipo==='jogador'||c.custom_attrs?.tipo==='personagem'));
  const sel = document.getElementById('loot-destino-sel');
  sel.innerHTML = `<option value="">Selecione o personagem...</option>` + chars.map(c=>`<option value="${c.id}|${c.nome}">${c.nome}</option>`).join('');

  document.getElementById('loot-titulo').textContent = `💰 Loot de ${npcNome}`;
  document.getElementById('loot-subtitulo').textContent = `${LOOT_STATE.itens.length} ite(ns) disponíve(is) — clique para selecionar`;
  renderLootCards();

  const overlay = document.getElementById('modal-loot-overlay');
  overlay.style.display = 'flex';
};

function renderLootCards() {
  const grid = document.getElementById('loot-cards-grid');
  if (!grid) return;
  grid.innerHTML = LOOT_STATE.itens.map((it, i) => {
    const sel = LOOT_STATE.selecionados.has(i);
    return _renderItemCard(it, {
      onclick: `toggleLootSel(${i})`,
      selecionado: sel
    });
  }).join('');
}

window.toggleLootSel = function(i) {
  if (LOOT_STATE.selecionados.has(i)) LOOT_STATE.selecionados.delete(i);
  else LOOT_STATE.selecionados.add(i);
  renderLootCards();
};

window.confirmarSaque = async function() {
  const destVal = document.getElementById('loot-destino-sel')?.value;
  if (!destVal) { mostrarToast('Selecione o personagem destino', 'erro'); return; }
  const [charId, charNome] = destVal.split('|');
  if (!LOOT_STATE.selecionados.size) { mostrarToast('Selecione ao menos um item', 'erro'); return; }

  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  const itens = [...LOOT_STATE.selecionados].map(i => LOOT_STATE.itens[i]);

  for (const it of itens) {
    try {
      // Inserir no inventário do personagem
      await sb('inventario', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: rpgId, character_id: charId, item_catalog_id: it.id,
          quantidade: 1, equipado: false,
          bloqueado_por_nivel: false,
          origem: 'saque'
        }),
        headers: { 'Prefer': 'return=minimal' }
      });

      // Marcar loot como saqueado
      if (it.loot_id) {
        await sb(`loot_pendente?id=eq.${it.loot_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ saqueado: true, personagem_destino: charNome, saqueado_em: new Date().toISOString() })
        });
      }

      // Broadcast item_saqueado
      _invBroadcastDrop(it, charNome, 'saque');
    } catch(e) {}
  }

  mostrarToast(`✓ ${itens.length} ite(ns) saqueado(s) por ${charNome}`, 'ok');
  // Atualizar inventário se for o char ativo
  if (INV?.charAtivo === charNome && INV.carregado?.[charId]) {
    delete INV.carregado[charId];
  }
  fecharModalLoot();
};

window.fecharModalLoot = function() {
  document.getElementById('modal-loot-overlay').style.display = 'none';
};


// ─────────────────────────────────────────────────────────────
// I11 — INVENTÁRIO COMPARTILHADO (Baú do Grupo)
// ─────────────────────────────────────────────────────────────
const BAU_STATE = { itens: [], carregado: false };

async function renderInvBau() {
  const el = document.getElementById('inv-bau-conteudo');
  if (!el) return;
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  if (!rpgId) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave)">RPG não carregado</div>'; return; }

  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);font-size:0.8rem">Carregando baú...</div>';

  try {
    // Buscar inventário do "grupo" (dono especial)
    const rows = await sb(`inventario?rpg_id=eq.${encodeURIComponent(rpgId)}&personagem_nome=eq.grupo&select=*,item_catalog(*)`);
    BAU_STATE.itens = rows || [];
    BAU_STATE.carregado = true;

    const isMestre = CURRENT_RPG?.role === 'mestre';

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:0.7rem;color:var(--destaque)">🗄️ Baú do Grupo</div>
        <div style="font-size:0.7rem;color:var(--suave)">${BAU_STATE.itens.length} ite(ns)</div>
      </div>`;

    if (!BAU_STATE.itens.length) {
      html += `<div style="text-align:center;padding:30px;color:var(--suave);font-style:italic;font-size:0.85rem">O baú está vazio</div>`;
    } else {
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
      for (const inst of BAU_STATE.itens) {
        const it = inst.item_catalog || inst;
        const canRetirar = isMestre || (INV.charAtivo && !it.bloqueado_por_nivel);
        html += _renderItemCard(it, {
          botaoLabel: canRetirar ? '⬇ Retirar' : '',
          botaoFn: canRetirar ? `bauRetirarItem('${inst.id}')` : ''
        });
      }
      html += `</div>`;
    }

    // Botão depositar (mestre ou personagem ativo)
    if (INV.charAtivo) {
      html += `
        <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px">
          <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;margin-bottom:8px">Depositar do inventário de ${INV.charAtivo}</div>
          <div id="bau-depositar-lista" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
        </div>`;
    }

    el.innerHTML = html;

    // Popular lista de depósito
    if (INV.charAtivo) renderBauDepositarLista();

  } catch(e) {
    el.innerHTML = `<div style="color:var(--perigo);padding:16px">Erro ao carregar baú: ${e.message}</div>`;
  }
}

function renderBauDepositarLista() {
  const el = document.getElementById('bau-depositar-lista');
  if (!el) return;
  const charId = INV.charId;
  const mochila = (INV.inventarios[charId]||[]).filter(inst=>!inst.equipado);
  if (!mochila.length) { el.innerHTML = `<div style="color:var(--suave);font-size:0.8rem;font-style:italic">Mochila vazia</div>`; return; }
  el.innerHTML = mochila.map(inst=>{
    const it = inst.item_catalog || inst;
    return _renderItemCard(it, {
      botaoLabel: '⬆ Depositar',
      botaoFn: `bauDepositarItem('${inst.id}')`
    });
  }).join('');
}

window.bauDepositarItem = async function(instId) {
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  try {
    // Transferir dono para "grupo"
    await sb(`inventario?id=eq.${instId}`, {
      method: 'PATCH',
      body: JSON.stringify({ personagem_nome: 'grupo', character_id: null, equipado: false, slot_equipado: null })
    });
    // Broadcast
    const inst = (INV.inventarios[INV.charId]||[]).find(i=>i.id===instId);
    if (inst) {
      const it = inst.item_catalog || inst;
      try { _invBroadcastDrop(it, 'Baú do Grupo', 'deposito'); } catch(e) {}
      mostrarToast(`⬆ ${it.nome} depositado no baú`, 'ok');
    }
    // Atualizar caches
    if (INV.charId) { delete INV.carregado[INV.charId]; }
    BAU_STATE.carregado = false;
    await renderInvBau();
  } catch(e) { mostrarToast('Erro ao depositar: ' + e.message, 'erro'); }
};

window.bauRetirarItem = async function(instId) {
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  const charNome = INV.charAtivo;
  const charId = INV.charId;
  if (!charNome) { mostrarToast('Abra o inventário de um personagem primeiro', 'erro'); return; }
  try {
    await sb(`inventario?id=eq.${instId}`, {
      method: 'PATCH',
      body: JSON.stringify({ personagem_nome: charNome, character_id: charId })
    });
    mostrarToast(`⬇ Item retirado para ${charNome}`, 'ok');
    BAU_STATE.carregado = false;
    if (charId) delete INV.carregado[charId];
    await renderInvBau();
  } catch(e) { mostrarToast('Erro ao retirar: ' + e.message, 'erro'); }
};


// ─────────────────────────────────────────────────────────────
// I12 — TRADE ENTRE JOGADORES
// ─────────────────────────────────────────────────────────────
const TRADE_STATE = {
  remetente: null, remetenteId: null,
  destinatario: null, destinatarioId: null,
  itens_selecionados: new Set(), // ids de inst. inventário
  proposta_pendente: null // proposta recebida
};

async function abrirModalTrade(charNome, charId) {
  TRADE_STATE.remetente = charNome;
  TRADE_STATE.remetenteId = charId;
  TRADE_STATE.itens_selecionados = new Set();
  TRADE_STATE.proposta_pendente = null;

  document.getElementById('trade-subtitulo').textContent = `De: ${charNome}`;

  // Popular destino (outros personagens)
  const chars = (RPG_DATA?.characters||[]).filter(c=>c.nome !== charNome && (c.hp_atual??100)>0 && (c.custom_attrs?.tipo==='jogador'||c.custom_attrs?.tipo==='personagem'));
  const sel = document.getElementById('trade-destino-sel');
  sel.innerHTML = `<option value="">Para quem...</option>` + chars.map(c=>`<option value="${c.id}|${c.nome}">${c.nome}</option>`).join('');

  // Carregar itens da mochila do remetente
  let mochila = (INV.inventarios[charId]||[]).filter(i=>!i.equipado);
  if (!mochila.length && charId) {
    try {
      const rows = await sb(`inventario?rpg_id=eq.${encodeURIComponent(RPG_DATA?.rpgId||CURRENT_RPG?.id)}&character_id=eq.${charId}&equipado=eq.false&select=*,item_catalog(*)`);
      mochila = rows || [];
    } catch(e) {}
  }

  const grid = document.getElementById('trade-oferta-grid');
  grid.innerHTML = mochila.map(inst=>{
    const it = inst.item_catalog || inst;
    return _renderItemCard(it, { onclick:`toggleTradeSel('${inst.id}')`, selecionado: false });
  }).join('') || `<div style="color:var(--suave);font-size:0.82rem;font-style:italic">Mochila vazia</div>`;

  document.getElementById('trade-proposta-recebida').style.display = 'none';
  document.getElementById('modal-trade-overlay').style.display = 'flex';
}

window.toggleTradeSel = function(instId) {
  if (TRADE_STATE.itens_selecionados.has(instId)) TRADE_STATE.itens_selecionados.delete(instId);
  else TRADE_STATE.itens_selecionados.add(instId);
  // Reatualizar visual
  document.querySelectorAll('#trade-oferta-grid [onclick]').forEach(el=>{
    const fn = el.getAttribute('onclick');
    const id = fn.match(/'([^']+)'/)?.[1];
    if (id) el.style.boxShadow = TRADE_STATE.itens_selecionados.has(id) ? '0 0 0 2px #4eca7e' : '';
  });
};

window.enviarProposta = async function() {
  const destVal = document.getElementById('trade-destino-sel')?.value;
  if (!destVal) { mostrarToast('Selecione o destinatário', 'erro'); return; }
  if (!TRADE_STATE.itens_selecionados.size) { mostrarToast('Selecione ao menos um item', 'erro'); return; }
  const [destId, destNome] = destVal.split('|');

  // Inserir proposta na tabela trades (Prefer: return=representation para obter o ID gerado)
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  const instIds = [...TRADE_STATE.itens_selecionados];
  try {
    const inserted = await sb('trades', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        rpg_id: rpgId,
        remetente: TRADE_STATE.remetente,
        remetente_id: TRADE_STATE.remetenteId,
        destinatario: destNome,
        destinatario_id: destId,
        itens: instIds,
        status: 'pendente',
        criado_em: new Date().toISOString()
      })
    });
    // Guardar o ID real do trade para poder fazer PATCH preciso ao responder
    const tradeId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    // Broadcast privado para o destinatário via WS — inclui tradeId
    _broadcastTradeEvento('trade_proposta', {
      de: TRADE_STATE.remetente, para: destNome,
      remetenteId: TRADE_STATE.remetenteId,
      instIds, rpg_id: rpgId, tradeId
    });
    mostrarToast(`📨 Proposta enviada para ${destNome}`, 'ok');
    fecharModalTrade();
  } catch(e) { mostrarToast('Erro ao enviar proposta: ' + e.message.replace(/^.*:\s*/, '') , 'erro'); }
};

window.responderTrade = async function(acao) {
  const proposta = TRADE_STATE.proposta_pendente;
  if (!proposta) return;
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;

  if (acao === 'aceitar') {
    // Transação atômica: mover cada item para o destinatário (quem está aceitando)
    const instIds = proposta.instIds || [];
    const destinatarioId = INV.charId;          // ID do personagem que está aceitando
    const destinatarioNome = INV.charAtivo;     // nome do personagem que está aceitando
    for (const instId of instIds) {
      try {
        await sb(`inventario?id=eq.${instId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            character_id: destinatarioId,
            personagem_nome: destinatarioNome,
            equipado: false, slot_equipado: null, bonus_snapshot: null
          })
        });
      } catch(e) {}
    }
    // Broadcast item_saqueado para todos
    for (const instId of instIds) {
      const rows = await sb(`inventario?id=eq.${instId}&select=*,item_catalog(*)`).catch(()=>[]);
      if (rows?.[0]) _invBroadcastDrop(rows[0].item_catalog || rows[0], destinatarioNome, 'trade');
    }
    _broadcastTradeEvento('trade_aceito', { de: proposta.de, para: proposta.para });
    // Atualizar trade no banco — filtrar por ID preciso para não afetar outros trades pendentes
    try {
      const filtro = proposta.tradeId
        ? `trades?id=eq.${proposta.tradeId}`
        : `trades?rpg_id=eq.${rpgId}&remetente=eq.${encodeURIComponent(proposta.de)}&destinatario=eq.${encodeURIComponent(proposta.para)}&status=eq.pendente`;
      await sb(filtro, { method:'PATCH', body: JSON.stringify({ status:'aceito' }) });
    } catch(e) {}
    mostrarToast('✓ Trade aceito!', 'ok');
  } else {
    _broadcastTradeEvento('trade_recusado', { de: proposta.de, para: proposta.para });
    try {
      const filtro = proposta.tradeId
        ? `trades?id=eq.${proposta.tradeId}`
        : `trades?rpg_id=eq.${rpgId}&remetente=eq.${encodeURIComponent(proposta.de)}&destinatario=eq.${encodeURIComponent(proposta.para)}&status=eq.pendente`;
      await sb(filtro, { method:'PATCH', body: JSON.stringify({ status:'recusado' }) });
    } catch(e) {}
    mostrarToast('Trade recusado', 'info');
  }

  TRADE_STATE.proposta_pendente = null;
  document.getElementById('trade-proposta-recebida').style.display = 'none';
  fecharModalTrade();
};

function _broadcastTradeEvento(evento, dados) {
  try {
    const ws = realtimeWS || AR?.ws;
    const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      topic: `realtime:rpg:${rpgId}`,
      event: 'broadcast',
      payload: { type:'broadcast', event: evento, payload: dados }
    }));
  } catch(e) {}
}

window.fecharModalTrade = function() {
  document.getElementById('modal-trade-overlay').style.display = 'none';
};

// Botão de Trade no inventário (injetado dinamicamente)
// Chamado por _abrirItemPopup existente — adicionamos opção de trade
function adicionarBotaoTrade(charNome, charId) {
  // Adicionar botão "🔄 Trade" no modal de inventário da mochila
  const wrap = document.getElementById('inv-mochila-lista');
  if (!wrap) return;
  const existing = document.getElementById('inv-btn-trade');
  if (!existing) {
    const btn = document.createElement('button');
    btn.id = 'inv-btn-trade';
    btn.textContent = '🔄 Propor Trade';
    btn.style.cssText = 'width:100%;margin-top:8px;padding:11px;background:rgba(79,163,209,0.08);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--primario);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;letter-spacing:0.06em';
    btn.onclick = () => abrirModalTrade(charNome, charId);
    wrap.after(btn);
  }
}


// ════════════════════════════════════════════════════════════════════════════
// FASE 3B — CONTROLES MOBILE (3.6-3.10)
// ════════════════════════════════════════════════════════════════════════════

// ── Estado global do controle mobile ────────────────────────────────────
const MOBILE_CTRL = {
  ativo: false,
  modoPet: false,     // 3.8: alternância personagem/pet
  petNome: null,      // nome do pet vinculado ao jogador
  _joystickEl: null,
  _joystickAtivo: false,
  _joystickOrigemX: 0,
  _joystickOrigemY: 0,
  _joystickMoveTimer: null,
  _tradeBadgeEl: null, // 3.9
};

// ── Detecção de landscape mobile ────────────────────────────────────────
function isMobileLandscape() {
  return window.innerWidth > window.innerHeight
      && window.innerWidth <= 1024
      && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}

function _verificarModoMobile() {
  // Ativar automaticamente em landscape — não desativar se foi ativado manualmente
  const deveAtivar = isMobileLandscape();
  if (deveAtivar && !MOBILE_CTRL.ativo) {
    _ativarControleMobile();
  } else if (!deveAtivar && MOBILE_CTRL.ativo && !MOBILE_CTRL.ativadoManualmente) {
    _desativarControleMobile();
  }
}



// ── Desbloquear rotação de tela para PWA ─────────────────────────────────
function desbloquearOrientacaoPWA() {
  try {
    // Screen Orientation API (suporte moderno)
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
    // API legada (iOS Safari / alguns Android)
    if (window.screen.unlockOrientation) {
      window.screen.unlockOrientation();
    } else if (window.screen.mozUnlockOrientation) {
      window.screen.mozUnlockOrientation();
    } else if (window.screen.msUnlockOrientation) {
      window.screen.msUnlockOrientation();
    }
  } catch(e) {
    // Silencioso — nem todos os contextos permitem unlock
  }
}

// ── Banner modo controle mobile ──────────────────────────────────────────
function _atualizarBannerControleMobile() {
  const banner = document.getElementById('mobile-controle-banner');
  if (!banner) return;
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const naAbaMapas = document.getElementById('tab-mapas')?.classList.contains('active');
  const temLinked = !!(RPG_DATA?.linked);
  // Mostrar se: é touch device, está na aba mesa, tem personagem vinculado
  banner.style.display = (isMobile && naAbaMapas && temLinked) ? 'block' : 'none';
  _atualizarBotaoControleMobile();
}
window._atualizarBannerControleMobile = _atualizarBannerControleMobile;

// Permite ativar/desativar o modo controle manualmente
function toggleControleMobile() {
  if (MOBILE_CTRL.ativo) {
    MOBILE_CTRL.ativadoManualmente = false;
    _desativarControleMobile();
  } else {
    MOBILE_CTRL.ativadoManualmente = true;
    _ativarControleMobile();
  }
  // Atualizar botão de toggle
  _atualizarBotaoControleMobile();
}
window.toggleControleMobile = toggleControleMobile;

function _atualizarBotaoControleMobile() {
  const btn = document.getElementById('btn-modo-controle');
  if (!btn) return;
  const ativo = MOBILE_CTRL.ativo;
  btn.textContent = ativo ? '🎮 Sair do Controle' : '🎮 Modo Controle';
  btn.style.background = ativo
    ? 'rgba(94,224,154,0.12)'
    : 'rgba(79,163,209,0.08)';
  btn.style.borderColor = ativo
    ? 'rgba(94,224,154,0.4)'
    : 'rgba(79,163,209,0.25)';
  btn.style.color = ativo ? '#5ee09a' : '#7ec8f0';
}

window.addEventListener('resize', _verificarModoMobile);
window.addEventListener('orientationchange', () => setTimeout(_verificarModoMobile, 300));
document.addEventListener('DOMContentLoaded', () => setTimeout(_verificarModoMobile, 500));

// ── Ativar/desativar controle mobile ────────────────────────────────────
function _ativarControleMobile() {
  MOBILE_CTRL.ativo = true;

  // Verificar se há mapa ativo e personagem vinculado
  if (!MAPA_STATE?.mapaAtualId) {
    mostrarToast('⚠ Selecione um mapa antes de usar o controle', 'aviso');
    MOBILE_CTRL.ativo = false;
    MOBILE_CTRL.ativadoManualmente = false;
    return;
  }
  if (!RPG_DATA?.linked) {
    mostrarToast('⚠ Nenhum personagem vinculado a você', 'aviso');
    MOBILE_CTRL.ativo = false;
    MOBILE_CTRL.ativadoManualmente = false;
    return;
  }

  if (!isMobileLandscape() && MOBILE_CTRL.ativadoManualmente) {
    mostrarToast('📱 Gire o celular para landscape para a melhor experiência', '', 3000);
  }

  let overlay = document.getElementById('mobile-ctrl-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-ctrl-overlay';
    // Fundo preto opaco — nada por baixo deve ser visível
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:8000;display:grid',
      'grid-template-columns:35% 30% 35%',
      'pointer-events:auto;touch-action:none',
      'background:#000'  // fundo preto sólido
    ].join(';');
    const _adaptarOrientacao = () => {
      if (!MOBILE_CTRL.ativo) return;
      const isLand = window.innerWidth > window.innerHeight;
      overlay.style.gridTemplateColumns = isLand ? '35% 30% 35%' : '20% 60% 20%';
      overlay.style.gridTemplateRows = isLand ? '1fr' : '1fr 1fr 1fr';
      overlay.style.alignItems = isLand ? 'center' : 'end';
    };
    window.addEventListener('resize', _adaptarOrientacao);
    window.addEventListener('orientationchange', () => setTimeout(_adaptarOrientacao, 300));
    overlay.innerHTML = _htmlControleMobile();
    document.body.appendChild(overlay);
    _iniciarJoystick();
  }
  overlay.style.display = 'grid';
  overlay.style.background = '#000'; // garantir sempre preto

  // Bloquear interação com sidebar e resto da UI enquanto controle ativo
  const sidebar = document.getElementById('mapa-sidebar');
  if (sidebar) {
    sidebar._prevPointerEvents = sidebar.style.pointerEvents;
    sidebar.style.pointerEvents = 'none';
    sidebar.style.visibility = 'hidden';
  }

  _atualizarZonaCentral();
  _atualizarZonaDireita();
  _atualizarBotaoControleMobile();
  _atualizarEstadoDpad(); // ← NOVA LINHA: atualizar estado inicial do D-pad

  const tabMapas = document.getElementById('tab-mapas');
  if (tabMapas) tabMapas.style.overflow = 'hidden';
}

function _desativarControleMobile() {
  MOBILE_CTRL.ativo = false;
  MOBILE_CTRL.ativadoManualmente = false;
  const overlay = document.getElementById('mobile-ctrl-overlay');
  if (overlay) overlay.style.display = 'none';
  // Restaurar sidebar
  const sidebar = document.getElementById('mapa-sidebar');
  if (sidebar) {
    sidebar.style.pointerEvents = sidebar._prevPointerEvents || '';
    sidebar.style.visibility = '';
  }
  _atualizarBotaoControleMobile();
  _atualizarBannerControleMobile?.();
}

// ── HTML das 3 zonas ────────────────────────────────────────────────────
function _htmlControleMobile() {
  return `
    <!-- ZONA ESQUERDA: D-pad 8 direções -->
    <div id="mc-zona-esq" style="pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;gap:2px">
      <div id="mc-dpad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:114px">
        <!-- Linha 1: diagonal NW, N, diagonal NE -->
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(-1,-1)" ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:8px 16px 4px 4px">↖</button>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(0,-1)"  ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:16px 16px 4px 4px">↑</button>
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(1,-1)"  ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:16px 8px 4px 4px">↗</button>
        <!-- Linha 2: W, centro, E -->
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(-1,0)"  ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:16px 4px 4px 16px">←</button>
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:rgba(122,146,170,0.4);font-family:var(--fonte-d)">MOV</div>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(1,0)"   ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:4px 16px 16px 4px">→</button>
        <!-- Linha 3: diagonal SW, S, diagonal SE -->
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(-1,1)"  ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:4px 4px 4px 16px">↙</button>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(0,1)"   ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:4px 4px 16px 16px">↓</button>
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(1,1)"   ontouchend="_dpadRelease()" oncontextmenu="return false" style="border-radius:4px 4px 16px 4px">↘</button>
      </div>
      <div id="mc-mov-info" style="font-size:0.58rem;color:rgba(255,255,255,0.35);font-family:var(--fonte-d,monospace);text-align:center;margin-top:3px"></div>
    </div>

    <!-- ZONA CENTRAL: Stats + skills próprias + tab pet -->
    <div id="mc-zona-central" style="pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:6px 4px">
      <!-- Tab pet/personagem (3.8) -->
      <div id="mc-tab-wrapper" style="display:none;width:100%">
        <div style="display:flex;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          <button id="mc-tab-char" onclick="mobileCtrlSetModo(false)"
            style="flex:1;padding:4px;font-size:0.6rem;font-family:var(--fonte-d);background:rgba(79,163,209,0.2);border:none;color:#7ec8f0;cursor:pointer">
            Personagem
          </button>
          <button id="mc-tab-pet" onclick="mobileCtrlSetModo(true)"
            style="flex:1;padding:4px;font-size:0.6rem;font-family:var(--fonte-d);background:transparent;border:none;color:rgba(255,255,255,0.4);cursor:pointer">
            Pet
          </button>
        </div>
      </div>

      <!-- Stats HP / Recurso / Movimento -->
      <div id="mc-stats" style="width:100%;font-size:0.65rem;font-family:var(--fonte-d)"></div>
      <!-- Botão de saída do modo controle -->
      <button ontouchend="event.preventDefault();toggleControleMobile()" onclick="toggleControleMobile()" style="margin-top:4px;padding:4px 10px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:rgba(192,57,43,0.7);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;touch-action:manipulation;letter-spacing:.06em;text-transform:uppercase">✕ Sair do controle</button>

      <!-- Skills alvo próprio (3.7) — segunda linha durante turno ativo -->
      <div id="mc-skills-proprias" style="width:100%;display:none;flex-wrap:wrap;gap:4px;justify-content:center"></div>

      <!-- Status do turno -->
      <div id="mc-turno-status" style="font-size:0.58rem;color:rgba(200,168,75,0.7);font-family:var(--fonte-d);text-align:center"></div>
    </div>

    <!-- ZONA DIREITA: Botões contextuais -->
    <div id="mc-zona-dir" style="pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px 6px">
      <div id="mc-ctx-botoes" style="width:100%;display:flex;flex-direction:column;gap:5px"></div>
    </div>
  `;
}


(function _injetarCssDpad() {
  if (document.getElementById('css-dpad')) return;
  const s = document.createElement('style');
  s.id = 'css-dpad';
  s.textContent = `
    .mc-dpad-btn {
      width:36px; height:36px;
      border:none; cursor:pointer;
      font-size:1.1rem; line-height:1;
      display:flex; align-items:center; justify-content:center;
      transition:background 0.08s, transform 0.08s, opacity 0.2s;
      touch-action:none; user-select:none; -webkit-user-select:none;
      -webkit-tap-highlight-color:transparent;
    }
    .mc-dpad-main {
      background:rgba(79,163,209,0.18);
      border:1.5px solid rgba(79,163,209,0.45);
      color:#7ec8f0;
    }
    .mc-dpad-diag {
      background:rgba(79,163,209,0.08);
      border:1px solid rgba(79,163,209,0.2);
      color:rgba(126,200,240,0.5);
      font-size:0.85rem;
    }
    .mc-dpad-btn:active, .mc-dpad-btn.pressionado {
      background:rgba(79,163,209,0.4) !important;
      transform:scale(0.88);
      color:#fff !important;
    }
  `;
  document.head.appendChild(s);
})();

// ── D-pad 8 direções (substitui joystick) ───────────────────────────────
let _DPAD_TIMER = null;
let _DPAD_DC = 0, _DPAD_DR = 0;

window._dpadPress = function(dc, dr) {
  _DPAD_DC = dc; _DPAD_DR = dr;
  // Mover imediatamente no toque
  _dpadMoverToken(dc, dr);
  // Vibração tátil (suporte nativo do dispositivo)
  if (navigator.vibrate) navigator.vibrate(18);
};
window._dpadRelease = function() {
  _DPAD_DC = 0; _DPAD_DR = 0;
  clearTimeout(_DPAD_TIMER);
};

// ═══════════════════════════════════════════════════════════════════════════
// ── FUNÇÃO CORRIGIDA: _dpadMoverToken ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function _dpadMoverToken(dc, dr) {
  const nome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome
    : RPG_DATA?.linked;
  if (!nome) return;

  // NOVO: Verificar se está em batalha
  const batalhaId = BATALHA_ATUAL_ID;
  if (batalhaId) {
    // NOVO: Verificar movimento restante
    const movRest = movGetRestante(batalhaId, nome);
    if (movRest <= 0) {
      mostrarToast('⚠ Sem movimento restante neste turno', 'aviso', 2000);
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]); // vibração de erro
      return;
    }

    // NOVO: Verificar se é o turno do personagem
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (bs && bs.fase === 'combate') {
      const atual = bs.participantes?.[bs.ordemAtual];
      if (atual?.nome !== nome) {
        mostrarToast('⏳ Aguarde seu turno para se mover', 'aviso', 2000);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        return;
      }
    }
  }

  // Executar movimento
  const movido = _moverTokenPorSeta(nome, dc, dr);
  
  // NOVO: Consumir movimento se estiver em batalha
  if (movido && batalhaId) {
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (!bs.movimentoRestante) bs.movimentoRestante = {};
    
    // Calcular custo do movimento (1 por casa, √2 para diagonais arredondado para cima)
    const custoDiag = (dc !== 0 && dr !== 0) ? Math.sqrt(2) : 1;
    const custoArredondado = Math.ceil(custoDiag);
    
    // Subtrair movimento
    const movAtual = movGetRestante(batalhaId, nome);
    bs.movimentoRestante[nome] = Math.max(0, movAtual - custoArredondado);
    
    // Atualizar UI mobile
    _atualizarMovInfo();
    _atualizarZonaCentral();
    _atualizarEstadoDpad();
    
    // Notificar movimento consumido
    const movRestante = bs.movimentoRestante[nome];
    if (movRestante === 0) {
      mostrarToast('🚫 Movimento esgotado', '', 2000);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    }
  }
}

// Manter compatibilidade com código que chama _iniciarJoystick
function _iniciarJoystick() {
  // D-pad já está funcional via ontouchstart — nada a inicializar aqui
}

// ═══════════════════════════════════════════════════════════════════════════
// ── NOVAS FUNÇÕES AUXILIARES ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function _podeMovimentarMobile(charNome) {
  const batalhaId = BATALHA_ATUAL_ID;
  if (!batalhaId) return true; // Fora de batalha pode mover livremente

  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs || bs.fase !== 'combate') return true;

  // Verificar se é o turno do personagem
  const atual = bs.participantes?.[bs.ordemAtual];
  if (atual?.nome !== charNome) return false;

  // Verificar se tem movimento restante
  const movRest = movGetRestante(batalhaId, charNome);
  return movRest > 0;
}

function _atualizarEstadoDpad() {
  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome
    : RPG_DATA?.linked;
  
  if (!charNome) return;

  const podeMover = _podeMovimentarMobile(charNome);
  const dpad = document.getElementById('mc-dpad');
  
  if (dpad) {
    // Aplicar estilo visual se não pode mover
    const btns = dpad.querySelectorAll('.mc-dpad-btn');
    btns.forEach(btn => {
      if (!podeMover) {
        btn.style.opacity = '0.4';
        btn.style.pointerEvents = 'none';
      } else {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
    });
  }

  // Atualizar indicador de movimento
  _atualizarMovInfo();
}

// ── Atualizar zona central (stats + skills próprias + turno) ────────────
function _atualizarZonaCentral() {
  if (!MOBILE_CTRL.ativo) return;
  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome : RPG_DATA?.linked;
  if (!charNome) {
    // Mestre sem personagem vinculado no mobile
    const statsEl = document.getElementById('mc-stats');
    if (statsEl) statsEl.innerHTML = '<div style="font-size:0.65rem;color:var(--suave);text-align:center;padding:8px">Vincule um personagem<br>para usar este modo</div>';
    return;
  }

  const c  = RPG_DATA?.characters?.find(ch => ch.nome === charNome);
  if (!c) return;
  const ca = c.custom_attrs || {};

  // ── Stats HP/Recurso/Movimento ───────────────────────────────────────
  const hp    = c.hp_atual ?? (ca.hp_max || 100);
  const hpMax = ca.hp_max || 100;
  const hpPct = Math.round((hp / hpMax) * 100);
  const hpCor = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';

  // Recurso principal (Mana, Stamina etc.)
  const atributos = ca.atributos || {};
  const statusAttrs = (RPG_DATA?.attr_defs || []).filter(a => a.categoria === 'status' && a.nome !== 'HP' && a.nome !== 'Nível');
  let recursoHtml = '';
  for (const attr of statusAttrs.slice(0, 2)) {
    const val = parseFloat(atributos[attr.nome] || 0);
    const max = parseFloat(atributos[attr.nome + '_max'] || atributos['Max_' + attr.nome] || 100);
    const pct = Math.min(100, Math.round((val / max) * 100));
    recursoHtml += `<div style="margin-top:3px">
      <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:rgba(126,200,240,0.8)">
        <span>${attr.nome}</span><span>${val}/${max}</span>
      </div>
      <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:1px">
        <div style="height:100%;width:${pct}%;background:#7ec8f0;border-radius:2px"></div>
      </div>
    </div>`;
  }

  // Movimento restante
  const batalhaId = BATALHA_ATUAL_ID;
  const movRest   = batalhaId ? movGetRestante(batalhaId, charNome) : null;
  const movMax    = movCalcVelocidade(charNome);
  const movHtml   = movRest !== null
    ? `<div style="font-size:0.6rem;color:rgba(200,168,75,0.8);margin-top:3px">${movRest}/${movMax} mov</div>`
    : '';

  document.getElementById('mc-stats').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:${hpCor};font-weight:500">
      <span>HP</span><span>${hp}/${hpMax}</span>
    </div>
    <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin:2px 0">
      <div style="height:100%;width:${hpPct}%;background:${hpCor};border-radius:2px;transition:width 0.3s"></div>
    </div>
    ${recursoHtml}
    ${movHtml}
  `;

  // ── Tab pet (3.8) ─────────────────────────────────────────────────────
  const petNome = _encontrarPetVinculado(RPG_DATA?.linked);
  MOBILE_CTRL.petNome = petNome;
  const tabWrap = document.getElementById('mc-tab-wrapper');
  if (tabWrap) {
    tabWrap.style.display = petNome ? 'block' : 'none';
    if (petNome) {
      document.getElementById('mc-tab-pet').textContent = `Pet: ${petNome.split(' ')[0]}`;
      document.getElementById('mc-tab-char').style.background = MOBILE_CTRL.modoPet ? 'transparent'    : 'rgba(79,163,209,0.2)';
      document.getElementById('mc-tab-char').style.color      = MOBILE_CTRL.modoPet ? 'rgba(255,255,255,0.4)' : '#7ec8f0';
      document.getElementById('mc-tab-pet').style.background  = MOBILE_CTRL.modoPet ? 'rgba(157,125,216,0.2)' : 'transparent';
      document.getElementById('mc-tab-pet').style.color       = MOBILE_CTRL.modoPet ? '#b07ef0' : 'rgba(255,255,255,0.4)';
    }
  }

  // ── Skills próprias — segunda linha no turno ativo (3.7) ─────────────
  const skWrap = document.getElementById('mc-skills-proprias');
  if (skWrap) {
    const emMeuTurno = _esMeuTurnoMobile(charNome);
    if (emMeuTurno) {
      const habilidades = atkGetHabilidadesCampanha(charNome);
      const skProprias  = habilidades.filter(h => h.alvo_tipo === 'proprio');
      if (skProprias.length) {
        skWrap.style.display = 'flex';
        skWrap.innerHTML = skProprias.map(h => `
          <button onclick="mobileUsarSkillPropria(${JSON.stringify(h.nome).replace(/'/g, "\'")})"
            style="padding:5px 8px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#f0cc6a;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;min-height:32px;touch-action:manipulation">
            ${h.nome}
          </button>`).join('');
      } else {
        skWrap.style.display = 'none';
      }
    } else {
      skWrap.style.display = 'none';
    }
  }

  // Turno status
  const turnoEl = document.getElementById('mc-turno-status');
  if (turnoEl) {
    const emTurno = _esMeuTurnoMobile(charNome);
    const isMestreMobile = RPG_DATA?.myRole === 'mestre';
    const labelMestre = isMestreMobile ? ' <span style="font-size:0.5rem;opacity:0.5">🎭</span>' : '';
    turnoEl.innerHTML = (emTurno ? '⚔ Seu turno' : '⏳ Aguardando') + labelMestre;
    turnoEl.style.color = emTurno ? 'rgba(94,224,154,0.8)' : 'rgba(200,168,75,0.5)';
  }
}

function _encontrarPetVinculado(donoNome) {
  if (!donoNome) return null;
  const pet = (RPG_DATA?.characters || []).find(c => {
    const ca = c.custom_attrs || {};
    return ca.eh_pet === true && ca.pet_dono === donoNome;
  });
  return pet?.nome || null;
}

function _esMeuTurnoMobile(charNome) {
  const batalhaId = BATALHA_ATUAL_ID;
  if (!batalhaId) return false;
  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs || bs.fase !== 'combate' || bs.pausada) return false;
  const atual = bs.participantes?.[bs.ordemAtual];
  return atual?.nome === charNome;
}

// Alternar modo pet/personagem (3.8)
window.mobileCtrlSetModo = function(modoPet) {
  MOBILE_CTRL.modoPet = modoPet;
  _atualizarZonaCentral();
  _atualizarZonaDireita();
  _atualizarEstadoDpad();
  if (modoPet && MOBILE_CTRL.petNome) {
    mostrarToast(`🐾 Controlando ${MOBILE_CTRL.petNome}`, '');
  } else {
    mostrarToast(`👤 Controlando ${RPG_DATA?.linked || 'personagem'}`, '');
  }
};

// Usar skill própria pelo mobile (3.7)
window.mobileUsarSkillPropria = function(nomeSkill) {
  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome
    : RPG_DATA?.linked;
  if (!charNome) return;
  const h = atkGetHabilidadesCampanha(charNome).find(sk => sk.nome === nomeSkill);
  if (!h) return;
  mapaAtaqueIniciar(charNome);
};

// ── Zona direita: botões contextuais (3.10 — máx 3 + "...") ────────────
function _atualizarZonaDireita() {
  if (!MOBILE_CTRL.ativo) return;
  const ctxEl = document.getElementById('mc-ctx-botoes');
  if (!ctxEl) return;

  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome : RPG_DATA?.linked;
  const mapId = MAPA_STATE?.mapaAtualId;
  ctxEl.innerHTML = '';

  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const isMestre = RPG_DATA?.myRole === 'mestre';

  // ── FASE INICIATIVA no mobile ─────────────────────────────────────
  if (bs && (bs.fase === 'iniciativa' || bs.fase === 'empate')) {
    const jaRolei = charNome && bs.iniciativasRoladas?.[charNome] != null;
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:var(--fonte-d);font-size:0.6rem;color:var(--destaque);text-align:center;margin-bottom:6px';
    lbl.textContent = bs.fase === 'empate' ? '⚠ Empate — re-role' : '🎲 Rolando iniciativas…';
    ctxEl.appendChild(lbl);
    if (!jaRolei || bs.fase === 'empate') {
      const btnIni = document.createElement('button');
      btnIni.style.cssText = 'width:100%;min-height:52px;padding:10px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.45);border-radius:8px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;touch-action:manipulation';
      btnIni.textContent = '🎲 Rolar Iniciativa';
      btnIni.addEventListener('touchend', e => { e.preventDefault(); abrirModalIniciativa(); });
      ctxEl.appendChild(btnIni);
    } else {
      const wait = document.createElement('div');
      wait.style.cssText = 'font-size:0.62rem;color:var(--suave);text-align:center;padding:8px;font-style:italic';
      wait.textContent = '✓ Aguardando outros jogadores…';
      ctxEl.appendChild(wait);
    }
    return;
  }

  // ── Botões de combate ─────────────────────────────────────────────
  if (bs?.fase === 'combate') {
    const atual = bs.participantes?.[bs.ordemAtual];
    const isMinhaVez = atual && (isMestre || atual.nome === RPG_DATA?.linked);
    if (isMinhaVez) {
      const btnAtk = document.createElement('button');
      btnAtk.style.cssText = 'width:100%;min-height:48px;padding:8px;background:linear-gradient(135deg,rgba(192,57,43,0.3),rgba(192,57,43,0.15));border:1px solid rgba(192,57,43,0.5);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;touch-action:manipulation;margin-bottom:5px';
      btnAtk.textContent = '⚔ Atacar';
      btnAtk.addEventListener('touchend', e => { e.preventDefault(); batalhaAtacarVez(); _atualizarZonaDireita(); });
      ctxEl.appendChild(btnAtk);

      const btnPass = document.createElement('button');
      btnPass.style.cssText = 'width:100%;min-height:38px;padding:6px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.2);border-radius:8px;color:#c0392b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;touch-action:manipulation;margin-bottom:5px';
      btnPass.textContent = '→ Pular vez';
      btnPass.addEventListener('touchend', e => { e.preventDefault(); batalhaPassarVez(); _atualizarZonaDireita(); });
      ctxEl.appendChild(btnPass);
    }
  } else if (!bs && isMestre && mapId) {
    const btnIni = document.createElement('button');
    btnIni.style.cssText = 'width:100%;min-height:44px;padding:8px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase;touch-action:manipulation;margin-bottom:5px';
    btnIni.textContent = '⚔ Iniciar Batalha';
    btnIni.addEventListener('touchend', e => { e.preventDefault(); abrirModalIniciarBatalha(); });
    ctxEl.appendChild(btnIni);
  }

  // ── Botões contextuais ────────────────────────────────────────────
  if (!charNome || !mapId) return;
  const botoes = ctxGerarBotoes(charNome, mapId);
  const { visiveis, ocultos } = ctxPriorizar(botoes);

  visiveis.forEach(b => {
    const btn = document.createElement('button');
    btn.style.cssText = [
      'width:100%;min-height:44px;padding:6px 8px',
      'background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.3)',
      'border-radius:8px;color:#c8d8e8;font-family:var(--fonte-d)',
      'font-size:0.62rem;cursor:pointer;text-align:left;touch-action:manipulation',
      'display:flex;flex-direction:column;gap:2px',
    ].join(';');
    btn.innerHTML = '<span style="font-weight:500">'+b.label+'</span>' +
      (b.sublabel ? '<span style="font-size:0.55rem;color:rgba(200,168,75,0.7)">'+b.sublabel+'</span>' : '');
    btn.disabled = b.desabilitado;
    btn.addEventListener('touchend', e => { e.preventDefault(); ctxExecutarAcao(b); _atualizarZonaDireita(); });
    ctxEl.appendChild(btn);
  });

  if (ocultos.length) {
    const maisBtn = document.createElement('button');
    maisBtn.style.cssText = 'width:100%;min-height:44px;padding:6px 8px;background:rgba(30,45,66,0.5);border:1px dashed rgba(79,163,209,0.2);border-radius:8px;color:rgba(79,163,209,0.6);font-size:0.62rem;cursor:pointer;touch-action:manipulation';
    maisBtn.textContent = '+'+ocultos.length+' ações';
    maisBtn.addEventListener('touchend', e => { e.preventDefault(); ctxMostrarOcultos(ocultos); });
    ctxEl.appendChild(maisBtn);
  }

  // ── Botão "Usar Item" ─────────────────────────────────────────────
  if (charNome) {
    const itensDisp = (INV?.inventario || []).filter(i => {
      const def = (INV?.itemDefs || []).find(d => d.id === (i.item_catalog_id || i.item_def_id));
      return def && (def.tipo === 'consumivel' || def.tipo === 'misc') && (i.quantidade > 0);
    }).filter(i => {
      const inv = i;
      // Pertence ao char ativo
      const chars = RPG_DATA?.characters || [];
      const c = chars.find(ch => ch.nome === charNome);
      return c && (i.char_id === c.id || i.personagem_nome === charNome || i.owner_id === c.id);
    });

    if (itensDisp.length) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.06);margin:4px 0';
      ctxEl.appendChild(sep);
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px';
      lbl.textContent = '🧪 Itens';
      ctxEl.appendChild(lbl);
      itensDisp.slice(0, 4).forEach(invItem => {
        const def = (INV?.itemDefs || []).find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
        if (!def) return;
        const btnItem = document.createElement('button');
        btnItem.style.cssText = 'width:100%;min-height:40px;padding:5px 8px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.25);border-radius:8px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-align:left;touch-action:manipulation;display:flex;align-items:center;gap:6px';
        btnItem.innerHTML = '<span style="font-size:1rem">'+(def.icone||'🧪')+'</span><span>'+def.nome+' ×'+invItem.quantidade+'</span>';
        btnItem.addEventListener('touchend', e => {
          e.preventDefault();
          abrirModalUsarItem(invItem.id, charNome);
        });
        ctxEl.appendChild(btnItem);
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── FUNÇÃO MELHORADA: _atualizarMovInfo ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function _atualizarMovInfo() {
  const el = document.getElementById('mc-mov-info');
  if (!el) return;
  
  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome 
    : RPG_DATA?.linked;
  
  if (!charNome) return;
  
  const batalhaId = BATALHA_ATUAL_ID;
  const movRest = batalhaId ? movGetRestante(batalhaId, charNome) : null;
  const movMax  = movCalcVelocidade(charNome);
  
  if (movRest !== null) {
    const pct = Math.round((movRest / movMax) * 100);
    const cor = pct > 50 ? '#5ee09a' : pct > 20 ? '#f0cc6a' : '#e74c3c';
    
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;justify-content:center">
        <div style="width:40px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px;transition:width 0.3s"></div>
        </div>
        <span style="color:${cor};font-weight:500">${movRest}/${movMax}</span>
      </div>
    `;
  } else {
    el.textContent = '';
  }
}

// ── 3.9 — Badge de trade não-intrusivo ──────────────────────────────────
function tradeMostrarBadgeMobile(proposta) {
  let badge = document.getElementById('trade-badge-mobile');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'trade-badge-mobile';
    badge.style.cssText = [
      'position:fixed;top:10px;left:50%;transform:translateX(-50%)',
      'z-index:9100;background:rgba(10,15,25,0.95)',
      'border:1px solid rgba(79,163,209,0.5);border-radius:10px',
      'padding:0;overflow:hidden;pointer-events:auto;touch-action:manipulation',
      'max-width:260px;width:90vw',
    ].join(';');
    document.body.appendChild(badge);
  }

  badge.innerHTML = `
    <div style="padding:8px 12px;display:flex;align-items:center;gap:8px;cursor:pointer"
         onclick="tradeBadgeExpandir()">
      <span style="font-size:1rem">🔄</span>
      <span style="font-size:0.7rem;font-family:var(--fonte-d);color:#7ec8f0;flex:1">
        Trade de <b>${proposta.de}</b>
      </span>
      <span style="font-size:0.6rem;color:rgba(200,168,75,0.7)" id="trade-badge-timer">—</span>
    </div>
    <div id="trade-badge-expandido" style="display:none;padding:8px 12px;border-top:1px solid rgba(79,163,209,0.2)">
      <div style="font-size:0.65rem;color:rgba(255,255,255,0.6);margin-bottom:8px" id="trade-badge-itens">Carregando...</div>
      <div style="display:flex;gap:6px">
        <button onclick="tradeAceitarBadge()" style="flex:1;padding:8px;background:rgba(39,174,96,0.15);border:1px solid rgba(39,174,96,0.4);border-radius:7px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;min-height:44px;touch-action:manipulation">✓ Aceitar</button>
        <button onclick="tradeRecusarBadge()" style="flex:1;padding:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:7px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;min-height:44px;touch-action:manipulation">✕ Recusar</button>
      </div>
    </div>
  `;

  MOBILE_CTRL._tradeBadgeEl = badge;
  MOBILE_CTRL._tradeProposta = proposta;
  badge.style.display = 'block';

  // Countdown de 30s
  let seg = 30;
  const timerEl = document.getElementById('trade-badge-timer');
  const countdown = setInterval(() => {
    seg--;
    if (timerEl) timerEl.textContent = `${seg}s`;
    if (seg <= 0) {
      clearInterval(countdown);
      badge.remove();
    }
  }, 1000);
  badge._countdown = countdown;

  // Buscar nomes dos itens
  (async () => {
    try {
      const itensEl = document.getElementById('trade-badge-itens');
      if (!itensEl) return;
      const ids = (proposta.instIds || []).slice(0, 3);
      const rows = await Promise.all(ids.map(id =>
        sb(`inventario?id=eq.${id}&select=item_catalog(nome)`).catch(() => [])
      ));
      const nomes = rows.map(r => r?.[0]?.item_catalog?.nome).filter(Boolean);
      if (itensEl) itensEl.textContent = nomes.length
        ? nomes.join(', ') + (proposta.instIds?.length > 3 ? ` +${proposta.instIds.length - 3}` : '')
        : 'Itens da proposta';
    } catch(e) {}
  })();
}

window.tradeBadgeExpandir = function() {
  const exp = document.getElementById('trade-badge-expandido');
  if (exp) exp.style.display = exp.style.display === 'none' ? 'block' : 'none';
};

window.tradeAceitarBadge = async function() {
  const p = MOBILE_CTRL._tradeProposta;
  if (!p) return;
  const badge = document.getElementById('trade-badge-mobile');
  if (badge) { clearInterval(badge._countdown); badge.remove(); }
  // Chamar aceitação existente
  if (typeof aceitarTrade === 'function') await aceitarTrade(p.tradeId);
  else mostrarToast('✓ Trade aceito', 'ok');
};

window.tradeRecusarBadge = async function() {
  const p = MOBILE_CTRL._tradeProposta;
  if (!p) return;
  const badge = document.getElementById('trade-badge-mobile');
  if (badge) { clearInterval(badge._countdown); badge.remove(); }
  if (typeof recusarTrade === 'function') await recusarTrade(p.tradeId);
  else mostrarToast('✕ Trade recusado', '');
};

// Interceptar recebimento de proposta de trade para mobile
const _origMostrarPropostaRecebida = window._mostrarPropostaRecebida || (() => {});
window._mostrarPropostaRecebidaOrig = _origMostrarPropostaRecebida;
window._mostrarPropostaRecebida = async function(p) {
  if (isMobileLandscape()) {
    // Mobile: usar badge não-intrusivo (3.9)
    tradeMostrarBadgeMobile(p);
  } else {
    // Desktop: comportamento original
    await _origMostrarPropostaRecebidaOrig(p);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ── LISTENERS DE HUB_EVENTS ATUALIZADOS ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
HUB_EVENTS.on('token_moveu', () => { 
  if (MOBILE_CTRL.ativo) {
    _atualizarZonaCentral(); 
    _atualizarZonaDireita(); 
    _atualizarMovInfo();
    _atualizarEstadoDpad(); // ← NOVO
  }
});

HUB_EVENTS.on('turno_avancou', () => { 
  if (MOBILE_CTRL.ativo) {
    _atualizarZonaCentral(); 
    _atualizarZonaDireita();
    _atualizarEstadoDpad(); // ← NOVO
  }
});

HUB_EVENTS.on('dano_aplicado', () => { 
  if (MOBILE_CTRL.ativo) {
    _atualizarZonaCentral(); 
  }
});

HUB_EVENTS.on('cura_aplicada', () => { 
  if (MOBILE_CTRL.ativo) {
    _atualizarZonaCentral(); 
  }
});

// Receber proposta de trade via WS
const _origWsCheckTrade = setInterval(()=>{
  if (typeof realtimeWS !== 'undefined' && realtimeWS) {
    const origOnMsg = realtimeWS.onmessage;
    realtimeWS.onmessage = function(e) {
      if (origOnMsg) origOnMsg.call(this, e);
      try {
        const msg = JSON.parse(e.data);
        const ev = msg.payload?.event;
        const p = msg.payload?.payload;
        if (ev === 'trade_proposta' && p?.para === INV.charAtivo) {
          // Mostrar proposta recebida
          TRADE_STATE.proposta_pendente = p;
          // Resolver nomes dos itens de forma assíncrona para o toast
          (async () => {
            let nomesItens = '';
            try {
              const ids = (p.instIds || []).slice(0, 3);
              const rows = await Promise.all(ids.map(id => sb(`inventario?id=eq.${id}&select=item_catalog(nome)`).catch(()=>[])));
              const nomes = rows.map(r => r?.[0]?.item_catalog?.nome).filter(Boolean);
              if (nomes.length) nomesItens = ': ' + nomes.join(', ') + (p.instIds?.length > 3 ? ` +${p.instIds.length - 3}` : '');
            } catch(e3) {}
            mostrarToast(`🔄 Proposta de trade de ${p.de}${nomesItens}`, 'info', 8000);
          })();
          _mostrarPropostaRecebida(p);
        }
        if (ev === 'trade_aceito' && p?.de === INV.charAtivo) mostrarToast('✓ Trade aceito por ' + p.para, 'ok');
        if (ev === 'trade_recusado' && p?.de === INV.charAtivo) mostrarToast('✕ Trade recusado por ' + p.para, 'erro');
      } catch(e2) {}
    };
    clearInterval(_origWsCheckTrade);
  }
}, 800);

async function _mostrarPropostaRecebida(p) {
  const wrap = document.getElementById('trade-proposta-recebida');
  if (!wrap) return;
  document.getElementById('trade-proposta-titulo').textContent = `Proposta de ${p.de}`;
  // Buscar itens da proposta
  const cardsEl = document.getElementById('trade-proposta-cards');
  let html = '';
  for (const instId of (p.instIds||[])) {
    try {
      const rows = await sb(`inventario?id=eq.${instId}&select=*,item_catalog(*)`);
      if (rows?.[0]) html += _renderItemCard(rows[0].item_catalog || rows[0], {});
    } catch(e) {}
  }
  cardsEl.innerHTML = html || '<div style="color:var(--suave)">Itens não encontrados</div>';
  wrap.style.display = 'block';
}


// ─────────────────────────────────────────────────────────────
// I13 — MERCADO (SISTEMA COMPLETO — INTEGRADO COM I6)
// ═══════════════════════════════════════════════════════════════

const MERCADO_STATE = {
  mercadoId: null, titulo: '', itens: [], todos: [],
  aba: 'comprar', modoGerenciar: false, gerTab: 'adicionar',
  modoCustom: false, config: { taxaRevenda: 50 }, _catalogo: [],
};

function _mercRpgId()    { return RPG_DATA?.rpgId || CURRENT_RPG?.id; }
function _mercCharNome() { return INV?.charAtivo || null; }
function _mercCharId()   { return INV?.charId || null; }
function _mercDenoms()   {
  return CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;
}
function _mercRarCor(r) {
  return ({comum:'#9aa8b8',incomum:'#5ee09a',raro:'#7ec8f0',epico:'#b07ef0',lendario:'#f0cc6a'})[(r||'').toLowerCase()] || '#9aa8b8';
}
function _mercRarEmoji(r) {
  return ({comum:'⬜',incomum:'🟩',raro:'🟦',epico:'🟪',lendario:'🟨'})[(r||'').toLowerCase()] || '⬜';
}

// ── Abrir ────────────────────────────────────────────────────
async function abrirModalMercado(mercadoId, titulo) {
  MERCADO_STATE.mercadoId = mercadoId;
  MERCADO_STATE.titulo = titulo || 'Mercado';
  MERCADO_STATE.aba = 'comprar';
  MERCADO_STATE.modoGerenciar = false;
  document.getElementById('modal-mercado-overlay').style.display = 'flex';
  document.getElementById('mercado-titulo').textContent = `🏪 ${MERCADO_STATE.titulo}`;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const btnModo = document.getElementById('mercado-btn-modo');
  if (btnModo) btnModo.style.display = isMestre ? '' : 'none';
  const abaHist = document.getElementById('merc-aba-historico');
  if (abaHist) abaHist.style.display = isMestre ? '' : 'none';
  _mercPreencherDenomSelect();
  _mercPreencherTaxaRevenda();
  await Promise.all([carregarMercadoItens(mercadoId), _mercAtualizarSaldo()]);
  mercadoMudarAba('comprar');
}

window.fecharModalMercado = function() {
  document.getElementById('modal-mercado-overlay').style.display = 'none';
  MERCADO_STATE.mercadoId = null;
};

function _mercPreencherDenomSelect() {
  const sel = document.getElementById('mercado-novo-denom');
  if (!sel) return;
  sel.innerHTML = _mercDenoms().map(d => `<option value="${d.nome}">${d.emoji} ${d.nome}</option>`).join('');
}
function _mercPreencherTaxaRevenda() {
  const sl = document.getElementById('mercado-taxa-revenda');
  const vl = document.getElementById('mercado-taxa-val');
  if (sl) sl.value = MERCADO_STATE.config.taxaRevenda;
  if (vl) vl.textContent = MERCADO_STATE.config.taxaRevenda + '%';
}

// ── Saldo — usa dono_id (alinhado com I6) ───────────────────
async function _mercAtualizarSaldo() {
  const el = document.getElementById('mercado-saldo');
  if (!el) return;
  const charId   = _mercCharId();
  const charNome = _mercCharNome();
  if (!charNome || !charId) { el.textContent = 'Abra um inventário para ver seu saldo'; return; }
  try {
    // CORRIGIDO: usa dono_id (igual ao I6), não personagem_nome
    const rows = await sb(
      `moedas?rpg_id=eq.${encodeURIComponent(_mercRpgId())}&dono_id=eq.${encodeURIComponent(charId)}&select=denominacao,quantidade`
    );
    const partes = _mercDenoms().map(d => {
      const e = (rows||[]).find(r => r.denominacao === d.nome);
      const q = e?.quantidade || 0;
      return q > 0 ? `${d.emoji} ${q} ${d.nome}` : null;
    }).filter(Boolean);
    el.textContent = partes.length ? `${charNome}: ${partes.join(' · ')}` : `${charNome}: sem moedas`;
  } catch(e) { el.textContent = 'Erro ao carregar saldo'; }
}
const atualizarSaldoMercado = _mercAtualizarSaldo;

// ── Modo Gerenciar (mestre) ──────────────────────────────────
function mercadoToggleModo() {
  MERCADO_STATE.modoGerenciar = !MERCADO_STATE.modoGerenciar;
  const painel = document.getElementById('mercado-painel-gerenciar');
  const btn    = document.getElementById('mercado-btn-modo');
  if (painel) painel.style.display = MERCADO_STATE.modoGerenciar ? 'block' : 'none';
  if (btn) {
    btn.textContent = MERCADO_STATE.modoGerenciar ? '✕ Fechar Gerenciar' : '⚙ Gerenciar';
    btn.style.background   = MERCADO_STATE.modoGerenciar ? 'rgba(200,168,75,0.18)' : 'rgba(200,168,75,0.08)';
    btn.style.borderColor  = MERCADO_STATE.modoGerenciar ? 'rgba(200,168,75,0.5)' : 'rgba(200,168,75,0.25)';
  }
  if (MERCADO_STATE.modoGerenciar) { mercadoGerTabAtivar('adicionar'); _mercadoCarregarCatalogo(); }
}
// Alias legado
function mercadoToggleGerenciar() { mercadoToggleModo(); }

function mercadoGerTabAtivar(tab) {
  MERCADO_STATE.gerTab = tab;
  ['adicionar','lista','config'].forEach(t => {
    const btn   = document.getElementById(`gertab-${t}`);
    const panel = document.getElementById(`gerpanel-${t}`);
    const ativa = t === tab;
    if (btn)   { btn.style.borderBottomColor = ativa ? '#c8a84b' : 'transparent'; btn.style.color = ativa ? '#c8a84b' : '#7a92aa'; }
    if (panel) panel.style.display = ativa ? 'block' : 'none';
  });
  if (tab === 'lista') _mercadoRenderListaGerenciar();
}

async function _mercadoCarregarCatalogo() {
  const sel = document.getElementById('mercado-sel-item');
  if (!sel) return;
  sel.innerHTML = '<option value="">Carregando…</option>';
  try {
    const rows = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(_mercRpgId())}&select=id,nome,raridade,tipo_canonico&order=nome`);
    MERCADO_STATE._catalogo = rows || [];
    sel.innerHTML = '<option value="">— Selecionar do catálogo —</option>' +
      (rows||[]).map(it => `<option value="${it.id}">${it.nome}${it.raridade?' ('+it.raridade+')':''}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

function mercadoToggleItemCustom() {
  MERCADO_STATE.modoCustom = !MERCADO_STATE.modoCustom;
  const fields  = document.getElementById('mercado-item-custom-fields');
  const selItem = document.getElementById('mercado-sel-item');
  const btn     = document.getElementById('mercado-btn-custom');
  if (!fields) return;
  if (MERCADO_STATE.modoCustom) {
    fields.style.display = 'flex';
    if (selItem) selItem.style.opacity = '0.35';
    if (btn) { btn.style.background='rgba(79,163,209,0.2)'; btn.style.borderColor='rgba(79,163,209,0.4)'; }
  } else {
    fields.style.display = 'none';
    if (selItem) selItem.style.opacity = '1';
    if (btn) { btn.style.background='rgba(79,163,209,0.08)'; btn.style.borderColor='rgba(79,163,209,0.2)'; }
  }
}

async function mercadoAdicionarItem() {
  const rpgId  = _mercRpgId();
  const mid    = MERCADO_STATE.mercadoId;
  const preco  = parseFloat(document.getElementById('mercado-novo-preco')?.value) || 0;
  const denom  = document.getElementById('mercado-novo-denom')?.value || 'Ouro';
  const estoqueInput = document.getElementById('mercado-novo-estoque')?.value;
  const estoque = (estoqueInput === '' || estoqueInput == null) ? null : parseInt(estoqueInput);
  let payload;
  if (MERCADO_STATE.modoCustom) {
    const nome = document.getElementById('mercado-custom-nome')?.value?.trim();
    const desc = document.getElementById('mercado-custom-desc')?.value?.trim();
    if (!nome) { mostrarToast('Digite o nome do item', 'aviso'); return; }
    payload = { rpg_id:rpgId, mercado_id:mid, preco, denominacao:denom, ativo:true, estoque, custom_nome:nome, custom_desc:desc||null };
  } else {
    const itemId = document.getElementById('mercado-sel-item')?.value;
    if (!itemId) { mostrarToast('Selecione um item do catálogo', 'aviso'); return; }
    payload = { rpg_id:rpgId, mercado_id:mid, item_catalog_id:parseInt(itemId), preco, denominacao:denom, ativo:true, estoque };
  }
  try {
    await sb('mercado', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify(payload) });
    mostrarToast('✓ Item adicionado ao mercado', 'ok');
    const selItem = document.getElementById('mercado-sel-item'); if (selItem) selItem.value = '';
    const nomeEl  = document.getElementById('mercado-custom-nome'); if (nomeEl) nomeEl.value = '';
    const descEl  = document.getElementById('mercado-custom-desc'); if (descEl) descEl.value = '';
    document.getElementById('mercado-novo-preco').value   = '10';
    document.getElementById('mercado-novo-estoque').value = '';
    await carregarMercadoItens(mid);
    if (MERCADO_STATE.gerTab === 'lista') _mercadoRenderListaGerenciar();
  } catch(e) { mostrarToast('Erro ao adicionar: ' + (e.message||'falha'), 'erro'); }
}

function _mercadoRenderListaGerenciar() {
  const el = document.getElementById('mercado-lista-gerenciar');
  if (!el) return;
  const todos = MERCADO_STATE.todos;
  if (!todos.length) {
    el.innerHTML = '<div style="font-size:0.72rem;color:#7a92aa;font-style:italic;text-align:center;padding:16px">Nenhum item no mercado ainda.</div>';
    return;
  }
  el.innerHTML = todos.map(row => {
    const it = row.item_catalog || {};
    const nome = row.custom_nome || it.nome || '?';
    const estoqueAtual = row.estoque_atual ?? row.estoque;
    const estoqueStr = row.estoque != null ? `${estoqueAtual ?? row.estoque}/${row.estoque}` : '∞';
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(30,45,66,0.7);border-radius:7px">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
        <div style="font-size:0.62rem;color:#7a92aa;margin-top:1px">Estoque: <span style="color:#c8a84b">${estoqueStr}</span></div>
      </div>
      <input type="number" value="${row.preco||0}" min="0"
        onchange="mercadoEditarPreco(${row.id},this.value,'${row.denominacao||'Ouro'}')"
        style="width:62px;padding:4px 6px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8a84b;font-size:0.78rem;text-align:center">
      <span style="font-size:0.65rem;color:#7a92aa">${row.denominacao||'Ouro'}</span>
      <button onclick="mercadoRemoverItem(${row.id})" style="background:none;border:none;color:#e74c3c55;cursor:pointer;font-size:0.9rem;padding:2px 4px;transition:color 0.2s"
        onmouseover="this.style.color='#e74c3c'" onmouseout="this.style.color='#e74c3c55'" title="Remover">🗑</button>
    </div>`;
  }).join('');
}

async function mercadoEditarPreco(rowId, novoPreco, denom) {
  try {
    await sb(`mercado?id=eq.${rowId}&rpg_id=eq.${encodeURIComponent(_mercRpgId())}`, {
      method:'PATCH', body:JSON.stringify({ preco: parseFloat(novoPreco)||0 })
    });
    const row = MERCADO_STATE.todos.find(r => r.id === rowId);
    if (row) row.preco = parseFloat(novoPreco)||0;
    mostrarToast('✓ Preço atualizado', 'ok');
    renderMercadoItens();
  } catch(e) { mostrarToast('Erro ao atualizar preço', 'erro'); }
}

async function mercadoRemoverItem(rowId) {
  if (!confirm('Remover este item do mercado?')) return;
  try {
    await sb(`mercado?id=eq.${rowId}&rpg_id=eq.${encodeURIComponent(_mercRpgId())}`, { method:'DELETE', headers:{Prefer:'return=minimal'} });
    MERCADO_STATE.todos  = MERCADO_STATE.todos.filter(r => r.id !== rowId);
    MERCADO_STATE.itens  = MERCADO_STATE.itens.filter(r => r.id !== rowId);
    _mercadoRenderListaGerenciar();
    renderMercadoItens();
    mostrarToast('Item removido', '');
  } catch(e) { mostrarToast('Erro ao remover: ' + (e.message||''), 'erro'); }
}

function mercadoSalvarConfig() {
  const taxa = parseInt(document.getElementById('mercado-taxa-revenda')?.value) || 50;
  MERCADO_STATE.config.taxaRevenda = taxa;
  mostrarToast(`✓ Taxa de revenda: ${taxa}%`, 'ok');
}

// ── Carregar e renderizar (aba Comprar) ──────────────────────
async function carregarMercadoItens(mercadoId) {
  const el = document.getElementById('mercado-itens-grid');
  if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#7a92aa">Carregando…</div>';
  try {
    const rows = await sb(`mercado?rpg_id=eq.${encodeURIComponent(_mercRpgId())}&ativo=eq.true&select=*,item_catalog(*)`);
    MERCADO_STATE.todos = rows || [];
    MERCADO_STATE.itens = [...MERCADO_STATE.todos];
    renderMercadoItens();
  } catch(e) {
    if (el) el.innerHTML = `<div style="color:#e74c3c;padding:16px;grid-column:1/-1">Erro: ${e.message}</div>`;
  }
}

window.filtrarMercado = function() {
  const busca = document.getElementById('mercado-busca')?.value?.toLowerCase() || '';
  const tipo  = document.getElementById('mercado-filtro-tipo')?.value || '';
  MERCADO_STATE.itens = MERCADO_STATE.todos.filter(row => {
    const it   = row.item_catalog || {};
    const nome = (row.custom_nome || it.nome || '').toLowerCase();
    const matchBusca = !busca || nome.includes(busca);
    const matchTipo  = !tipo || (tipo==='custom' && !!row.custom_nome) || it.tipo_canonico === tipo;
    return matchBusca && matchTipo;
  });
  renderMercadoItens();
};

function renderMercadoItens() {
  const el = document.getElementById('mercado-itens-grid');
  if (!el) return;
  if (!MERCADO_STATE.itens.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#7a92aa;font-style:italic">Nenhum item disponível</div>';
    return;
  }
  el.innerHTML = MERCADO_STATE.itens.map(row => _mercRenderCard(row)).join('');
}

function _mercRenderCard(row) {
  const it    = row.item_catalog || {};
  const nome  = row.custom_nome || it.nome || '?';
  const desc  = row.custom_desc || it.descricao || it.efeito || '';
  const rari  = it.raridade || '';
  const tipo  = it.tipo_canonico || (row.custom_nome ? 'custom' : 'misc');
  const preco = row.preco || 0;
  const denom = row.denominacao || 'Ouro';
  const estoque = row.estoque;
  const estoqueAtual = row.estoque_atual ?? estoque;
  const semEstoque = estoque != null && estoqueAtual <= 0;
  const cor  = _mercRarCor(rari);
  const emoji = _mercRarEmoji(rari);
  const tipoEmoji = {arma:'⚔️',armadura:'🛡️',amuleto:'💎',consumivel:'🧪',ferramenta:'🔧',misc:'📦',custom:'✏️'}[tipo]||'📦';
  const estoqueHtml = estoque != null
    ? `<span style="font-size:0.6rem;color:${semEstoque?'#e74c3c':'#7a92aa'};margin-top:2px;display:block">${semEstoque?'❌ Sem estoque':`📦 ${estoqueAtual}/${estoque} restantes`}</span>`
    : '';
  const precoHtml = preco > 0
    ? `<span style="font-family:'Cinzel',serif;font-size:0.78rem;color:#c8a84b;font-weight:600">${preco} ${denom}</span>`
    : `<span style="font-size:0.72rem;color:#5ee09a">Grátis</span>`;
  const btnHtml = semEstoque
    ? `<button disabled style="width:100%;margin-top:8px;padding:7px;background:rgba(30,45,66,0.4);border:1px solid rgba(30,45,66,0.6);border-radius:7px;color:#7a92aa;font-family:'Cinzel',serif;font-size:0.58rem;cursor:not-allowed">Esgotado</button>`
    : `<button onclick="confirmarCompraMercado('${row.id}','${preco}','${denom}','${(nome).replace(/'/g,"\\'")}',event)"
        style="width:100%;margin-top:8px;padding:7px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:7px;color:#c8a84b;font-family:'Cinzel',serif;font-size:0.6rem;cursor:pointer;letter-spacing:0.05em;transition:all 0.2s"
        onmouseover="this.style.background='rgba(200,168,75,0.2)'" onmouseout="this.style.background='rgba(200,168,75,0.1)'">💰 Comprar</button>`;
  return `<div style="background:rgba(15,21,32,0.9);border:1px solid rgba(30,45,66,0.7);border-top:2px solid ${cor}44;border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:4px;transition:border-color 0.2s"
       onmouseover="this.style.borderColor='${cor}88'" onmouseout="this.style.borderColor='rgba(30,45,66,0.7)'">
    <div style="display:flex;align-items:flex-start;gap:6px">
      <span style="font-size:1.1rem;flex-shrink:0">${tipoEmoji}</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:#c8d8e8;letter-spacing:0.03em;line-height:1.3">${nome}</div>
        ${rari?`<div style="font-size:0.58rem;color:${cor};margin-top:1px">${emoji} ${rari.charAt(0).toUpperCase()+rari.slice(1)}</div>`:''}
      </div>
    </div>
    ${desc?`<div style="font-size:0.68rem;color:#7a92aa;line-height:1.4;font-style:italic;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${desc}</div>`:''}
    <div style="margin-top:auto;padding-top:6px">${precoHtml}${estoqueHtml}${btnHtml}</div>
  </div>`;
}

// ── Compra — CORRIGIDO: usa _moedaUpsert (dono_id) ──────────
window.confirmarCompraMercado = function(rowId, preco, denom, nomeItem, ev) {
  if (ev) ev.stopPropagation();
  const charNome = _mercCharNome();
  if (!charNome) { mostrarToast('Abra o inventário de um personagem antes de comprar', 'aviso'); return; }
  const precoNum = parseFloat(preco) || 0;
  const msg = precoNum > 0 ? `Comprar "${nomeItem}" por ${precoNum} ${denom}?` : `Adquirir "${nomeItem}" gratuitamente?`;
  if (!confirm(msg)) return;
  comprarItemMercado(rowId, preco, denom);
};

window.comprarItemMercado = async function(rowId, preco, denom) {
  const charId   = _mercCharId();
  const charNome = _mercCharNome();
  const rpgId    = _mercRpgId();
  const precoNum = parseFloat(preco) || 0;
  if (!charId) { mostrarToast('Abra o inventário de um personagem antes de comprar', 'aviso'); return; }

  const rowData = MERCADO_STATE.todos.find(r => r.id == rowId);
  if (!rowData) { mostrarToast('Item não encontrado', 'erro'); return; }
  const it   = rowData.item_catalog || {};
  const nome = rowData.custom_nome || it.nome || 'Item';

  // 1. Verificar saldo — CORRIGIDO: usa dono_id (igual ao I6)
  if (precoNum > 0) {
    const atual = await sb(
      `moedas?rpg_id=eq.${encodeURIComponent(rpgId)}&dono_id=eq.${encodeURIComponent(charId)}&denominacao=eq.${encodeURIComponent(denom)}&select=id,quantidade`
    ).catch(()=>[]);
    const saldo = atual?.[0]?.quantidade || 0;
    if (saldo < precoNum) { mostrarToast(`❌ Saldo insuficiente — você tem ${saldo} ${denom}`, 'erro'); return; }

    // Debitar usando _moedaUpsert do I6 (fonte única de verdade)
    try {
      await _moedaUpsert(charId, denom, -precoNum);
    } catch(e) { mostrarToast('Erro ao debitar moedas: ' + (e.message||''), 'erro'); return; }
  }

  // 2. Adicionar ao inventário
  if (rowData.item_catalog_id && charId) {
    try {
      await sb('inventario', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({
        rpg_id:rpgId, character_id:charId, item_catalog_id:rowData.item_catalog_id,
        quantidade:1, equipado:false, origem:'compra', bloqueado_por_nivel:false
      })});
      if (typeof _invBroadcastDrop === 'function') _invBroadcastDrop(it, charNome, 'compra');
      if (typeof INV !== 'undefined' && charId) delete INV.carregado[charId];
    } catch(e) {
      // Estornar débito se inventário falhou
      if (precoNum > 0) {
        try { await _moedaUpsert(charId, denom, +precoNum); } catch(_) {}
        mostrarToast('Erro ao comprar — moedas estornadas.', 'erro');
      } else {
        mostrarToast('Erro ao adicionar ao inventário: ' + (e.message||''), 'erro');
      }
      return;
    }
  }

  // 3. Decrementar estoque
  if (rowData.estoque != null) {
    const ea   = rowData.estoque_atual ?? rowData.estoque;
    const novo = Math.max(0, ea - 1);
    try {
      await sb(`mercado?id=eq.${rowId}&rpg_id=eq.${encodeURIComponent(rpgId)}`, {
        method:'PATCH', body:JSON.stringify({ estoque_atual: novo })
      });
      rowData.estoque_atual = novo;
    } catch(_) {}
    renderMercadoItens();
  }

  // 4. Log — CORRIGIDO: usa dono_id (igual ao I6)
  await _moedaLog(charId, null, denom, precoNum, 'remover', `Compra no mercado: ${nome}`);

  mostrarToast(`✓ ${nome} comprado por ${charNome}!`, 'ok');
  await _mercAtualizarSaldo();
};

// ── Vender — CORRIGIDO: usa _moedaUpsert (dono_id) ──────────
async function _mercCarregarAbaVender() {
  const listaEl  = document.getElementById('mercado-vender-lista');
  const charEl   = document.getElementById('mercado-vender-char');
  const charNome = _mercCharNome();
  const charId   = _mercCharId();
  const rpgId    = _mercRpgId();
  if (charEl) charEl.textContent = charNome || '—';
  if (!charNome || !charId) {
    if (listaEl) listaEl.innerHTML = '<div style="text-align:center;padding:30px;color:#7a92aa;font-style:italic">Abra o inventário de um personagem para ver os itens vendáveis</div>';
    return;
  }
  if (listaEl) listaEl.innerHTML = '<div style="text-align:center;padding:20px;color:#7a92aa">Carregando…</div>';
  try {
    const rows = await sb(
      `inventario?rpg_id=eq.${encodeURIComponent(rpgId)}&character_id=eq.${encodeURIComponent(charId)}&equipado=eq.false&select=*,item_catalog(*)`
    );
    if (!rows?.length) { listaEl.innerHTML = '<div style="text-align:center;padding:30px;color:#7a92aa;font-style:italic">Nenhum item disponível para venda</div>'; return; }
    const taxa = MERCADO_STATE.config.taxaRevenda / 100;
    const precosMercado = {};
    MERCADO_STATE.todos.forEach(r => { if (r.item_catalog_id) precosMercado[r.item_catalog_id] = { preco:r.preco, denom:r.denominacao }; });
    listaEl.innerHTML = rows.map(row => {
      const it   = row.item_catalog || {};
      const nome = it.nome || 'Item';
      const desc = it.descricao || it.efeito || '';
      const ref  = precosMercado[row.item_catalog_id];
      const pv   = ref ? Math.floor(ref.preco * taxa) : null;
      const den  = ref?.denom || 'Ouro';
      const precoH = pv != null && pv > 0
        ? `<span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#5ee09a">${pv} ${den}</span>`
        : `<span style="font-size:0.68rem;color:#7a92aa">Sem cotação</span>`;
      const btnV = pv != null && pv > 0
        ? `<button onclick="mercadoVenderItem(${row.id},${row.item_catalog_id},'${nome.replace(/'/g,"\\'")}',${pv},'${den}',event)"
             style="padding:5px 12px;background:rgba(39,174,96,0.12);border:1px solid rgba(39,174,96,0.3);border-radius:7px;color:#5ee09a;font-family:'Cinzel',serif;font-size:0.58rem;cursor:pointer;transition:all 0.2s"
             onmouseover="this.style.background='rgba(39,174,96,0.22)'" onmouseout="this.style.background='rgba(39,174,96,0.12)'">Vender</button>`
        : `<button disabled style="padding:5px 12px;background:rgba(30,45,66,0.3);border:1px solid rgba(30,45,66,0.5);border-radius:7px;color:#7a92aa;font-family:'Cinzel',serif;font-size:0.58rem;cursor:not-allowed">Sem cotação</button>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(15,21,32,0.8);border:1px solid rgba(30,45,66,0.7);border-radius:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
          ${desc?`<div style="font-size:0.65rem;color:#7a92aa;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc}</div>`:''}
        </div>
        ${precoH}${btnV}
      </div>`;
    }).join('');
  } catch(e) { if (listaEl) listaEl.innerHTML = `<div style="color:#e74c3c;padding:16px">Erro: ${e.message}</div>`; }
}

window.mercadoVenderItem = async function(invRowId, itemCatalogId, nomeItem, preco, denom, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm(`Vender "${nomeItem}" por ${preco} ${denom}?`)) return;
  const charId   = _mercCharId();
  const rpgId    = _mercRpgId();
  if (!charId) { mostrarToast('Personagem não identificado', 'erro'); return; }
  try {
    // Remover do inventário
    await sb(`inventario?id=eq.${invRowId}&rpg_id=eq.${encodeURIComponent(rpgId)}`, { method:'DELETE', headers:{Prefer:'return=minimal'} });
    // Creditar — usa _moedaUpsert (dono_id, alinhado com I6)
    await _moedaUpsert(charId, denom, +preco);
    // Log unificado
    await _moedaLog(charId, null, denom, preco, 'receber', `Venda no mercado: ${nomeItem}`);
    mostrarToast(`✓ ${nomeItem} vendido por ${preco} ${denom}`, 'ok');
    await _mercAtualizarSaldo();
    await _mercCarregarAbaVender();
  } catch(e) { mostrarToast('Erro ao vender: ' + (e.message||''), 'erro'); }
};

// ── Histórico unificado (dono_id + personagem_nome) ──────────
async function mercadoCarregarHistorico() {
  const el = document.getElementById('mercado-historico-lista');
  if (!el) return;
  const charId = _mercCharId();
  const rpgId  = _mercRpgId();
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#7a92aa">Carregando…</div>';
  try {
    // Busca por dono_id (sistema I6) — últimas 60 transações de toda a campanha (mestre)
    const rows = await sb(
      `log_transacoes?rpg_id=eq.${encodeURIComponent(rpgId)}&tipo=in.(remover,receber)&order=created_at.desc&limit=60&select=*`
    );
    if (!rows?.length) { el.innerHTML = '<div style="text-align:center;padding:24px;color:#7a92aa;font-style:italic">Nenhuma transação registrada.</div>'; return; }
    // Mapear IDs para nomes de personagens
    const chars = RPG_DATA?.characters || [];
    const idParaNome = {};
    chars.forEach(c => { idParaNome[c.id] = c.nome; });
    el.innerHTML = rows.map(t => {
      const isCredito = t.tipo === 'receber';
      const cor   = isCredito ? '#5ee09a' : '#e74c3c';
      const sinal = isCredito ? '+' : '−';
      const donome = idParaNome[t.dono_id] || t.personagem_nome || '?';
      const data = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(15,21,32,0.7);border:1px solid rgba(30,45,66,0.6);border-left:2px solid ${cor};border-radius:7px">
        <span style="font-size:0.85rem">${isCredito?'💰':'🛒'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.descricao||t.tipo}</div>
          <div style="font-size:0.62rem;color:#7a92aa;margin-top:1px">${donome} · ${data}</div>
        </div>
        <span style="font-family:'Cinzel',serif;font-size:0.78rem;color:${cor};flex-shrink:0">${sinal}${Math.abs(t.quantidade||0)} ${t.denominacao||''}</span>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML = `<div style="color:#e74c3c;padding:16px">Erro: ${e.message}</div>`; }
}

// ── Controle de abas ─────────────────────────────────────────
function mercadoMudarAba(aba) {
  MERCADO_STATE.aba = aba;
  const paineis = { comprar:'mercado-painel-comprar', vender:'mercado-painel-vender', historico:'mercado-painel-historico' };
  ['comprar','vender','historico'].forEach(a => {
    const btn    = document.getElementById(`merc-aba-${a}`);
    const painel = document.getElementById(paineis[a]);
    const ativa  = a === aba;
    if (btn)   { btn.style.borderBottomColor = ativa ? '#c8a84b' : 'transparent'; btn.style.color = ativa ? '#f0cc6a' : '#7a92aa'; }
    if (painel) painel.style.display = ativa ? 'flex' : 'none';
  });
  if (aba === 'vender')    _mercCarregarAbaVender();
  if (aba === 'historico') mercadoCarregarHistorico();
  if (aba !== 'comprar') {
    MERCADO_STATE.modoGerenciar = false;
    const pg  = document.getElementById('mercado-painel-gerenciar');
    const btn = document.getElementById('mercado-btn-modo');
    if (pg)  pg.style.display = 'none';
    if (btn) btn.textContent = '⚙ Gerenciar';
  }
}

// ── Token do mapa ────────────────────────────────────────────
window._verificarMercadoToken = function(c) {
  if (!c?.custom_attrs?.mercado_id) return '';
  const mid    = c.custom_attrs.mercado_id;
  const titulo = c.custom_attrs.mercado_titulo || c.nome || 'Mercado';
  return `<button onclick="abrirModalMercado('${mid}','${titulo.replace(/'/g,"\\'")}')"
    style="width:100%;margin-top:8px;padding:9px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:7px;color:#c8a84b;font-family:'Cinzel',serif;font-size:0.65rem;cursor:pointer;transition:all 0.2s;letter-spacing:0.04em"
    onmouseover="this.style.background='rgba(200,168,75,0.2)'" onmouseout="this.style.background='rgba(200,168,75,0.1)'">
    🏪 Entrar no Mercado
  </button>`;
};




// ─────────────────────────────────────────────────────────────
// A5 — PAINEL DE STATUS DO BALANCEAMENTO
// ─────────────────────────────────────────────────────────────
const _GRUPOS_INFO = [
  { id:'forca',        label:'💪 Força',         desc:'Dano físico, intimidação' },
  { id:'destreza',     label:'🏃 Destreza',       desc:'Velocidade, precisão, esquiva' },
  { id:'constituicao', label:'🛡️ Constituição',   desc:'HP, resistência, defesa' },
  { id:'inteligencia', label:'🧠 Inteligência',   desc:'Magia, percepção, carisma' },
];

async function a5RecalcularPainel() {
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  const el = document.getElementById('a5-painel-grid');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);font-size:0.8rem">Calculando...</div>';

  // Verificar attr_defs sem mapeamento
  const attrDefsNumericos = (RPG_DATA?.attrDefs||[]).filter(a=>a.tipo==='numero'||a.tipo==='status');
  const mapeados = new Set();
  let mapRows = [];
  try { mapRows = await carregarMapeamento(rpgId); } catch(e) {}
  mapRows.forEach(m=>mapeados.add(m.nome_customizado?.toLowerCase()));

  const semMapeamento = attrDefsNumericos.filter(a=>!mapeados.has(a.nome?.toLowerCase()));

  // Calcular médias de todos os grupos em paralelo
  const resultados = await Promise.all(_GRUPOS_INFO.map(async g=>{
    let mediaRes = { media:0, atributos:[], personagens:[] };
    try { mediaRes = await calcularMediaGrupo(rpgId, g.id); } catch(e) {}
    // Buscar itens do catálogo que usam esse grupo
    let itensGrupo = [];
    try {
      const atrsGrupo = mapRows.filter(m=>m.grupo_base===g.id).map(m=>m.nome_customizado);
      if (atrsGrupo.length) {
        const allItens = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=nome,raridade,nivel,atributos_bonus`);
        itensGrupo = (allItens||[]).filter(it=>{
          return Object.keys(it.atributos_bonus||{}).some(k=>atrsGrupo.includes(k));
        });
      }
    } catch(e) {}
    return { ...g, media: mediaRes.media, atrs: mediaRes.atributos, personagens: mediaRes.personagens, itens: itensGrupo };
  }));

  // Renderizar
  let html = '';

  // Alerta de attr_defs sem mapeamento
  if (semMapeamento.length) {
    html += `<div style="background:rgba(192,57,43,0.07);border:1px solid rgba(192,57,43,0.25);border-radius:8px;padding:10px;margin-bottom:12px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#e74c3c;margin-bottom:4px">⚠️ Atributos sem mapeamento</div>
      <div style="font-size:0.72rem;color:var(--suave)">${semMapeamento.map(a=>a.nome).join(', ')}</div>
    </div>`;
  }

  for (const g of resultados) {
    const temAtrs = g.atrs.length > 0;
    html += `
      <details style="background:var(--painel);border:1px solid var(--borda);border-radius:10px;overflow:hidden;margin-bottom:6px">
        <summary style="padding:12px;cursor:pointer;display:flex;align-items:center;gap:10px;list-style:none">
          <div style="flex:1">
            <div style="font-family:var(--fonte-d);font-size:0.72rem;color:var(--texto)">${g.label}</div>
            <div style="font-size:0.65rem;color:var(--suave);margin-top:1px">${g.desc}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--fonte-d);font-size:0.9rem;color:${temAtrs?'var(--primario)':'var(--suave)'}">${temAtrs?g.media.toFixed(1):'—'}</div>
            <div style="font-size:0.6rem;color:var(--suave)">média</div>
          </div>
        </summary>
        <div style="padding:0 12px 12px">
          ${temAtrs
            ? `<div style="margin-bottom:8px">
                <div style="font-size:0.6rem;color:var(--suave);margin-bottom:4px;text-transform:uppercase;font-family:var(--fonte-d)">Atributos mapeados</div>
                ${g.atrs.map(a=>`<span style="display:inline-block;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.25);border-radius:4px;padding:2px 7px;font-size:0.65rem;color:var(--primario-v);margin:2px">${a}</span>`).join('')}
              </div>`
            : `<div style="color:var(--suave);font-size:0.75rem;font-style:italic;margin-bottom:8px">Nenhum atributo mapeado neste grupo.</div>`
          }
          ${g.personagens.length
            ? `<div style="margin-bottom:8px">
                <div style="font-size:0.6rem;color:var(--suave);margin-bottom:4px;text-transform:uppercase;font-family:var(--fonte-d)">Personagens (vivos)</div>
                ${g.personagens.map(p=>`<div style="font-size:0.68rem;color:var(--texto);display:flex;justify-content:space-between"><span>${p.nome}</span><span style="color:var(--primario)">${p.media?.toFixed?.(1)||'—'}</span></div>`).join('')}
              </div>` : ''
          }
          ${g.itens.length
            ? `<div>
                <div style="font-size:0.6rem;color:var(--suave);margin-bottom:4px;text-transform:uppercase;font-family:var(--fonte-d)">Itens no catálogo (${g.itens.length})</div>
                ${g.itens.slice(0,5).map(it=>`<div style="font-size:0.65rem;color:var(--texto);display:flex;justify-content:space-between;gap:6px"><span>${it.nome}</span><span style="color:var(--suave)">Nv.${it.nivel||1} ${it.raridade}</span></div>`).join('')}
                ${g.itens.length>5?`<div style="font-size:0.62rem;color:var(--suave);margin-top:2px">+${g.itens.length-5} itens...</div>`:''}
              </div>` : ''
          }
        </div>
      </details>`;
  }

  el.innerHTML = html || '<div style="color:var(--suave);text-align:center;padding:20px">Configure o mapeamento de atributos primeiro</div>';
}

// Exibir A5 na seção de configurações quando o Mestre abrir
document.addEventListener('DOMContentLoaded', ()=>{
  const a5Card = document.getElementById('cfg-status-inv-card');
  if (a5Card) {
    // Disparar imediatamente se o card já estiver visível (mestre já logado antes do DOMContentLoaded)
    if (a5Card.style.display !== 'none' && !a5Card.dataset.carregado) {
      a5Card.dataset.carregado = '1';
      a5RecalcularPainel();
    }
    // Observar mudanças futuras de visibilidade
    const obs = new MutationObserver(() => {
      if (a5Card.style.display !== 'none' && !a5Card.dataset.carregado) {
        a5Card.dataset.carregado = '1';
        a5RecalcularPainel();
      }
    });
    obs.observe(a5Card, { attributes: true, attributeFilter: ['style'] });
  }
});


// ─────────────────────────────────────────────────────────────
// INTEGRAR TRADE E MERCADO NO INVENTÁRIO EXISTENTE
// ─────────────────────────────────────────────────────────────
// Após abrir inventário, adicionar botões de trade/mercado na aba mochila
const _origAbrirInventario = window.abrirInventario;
if (typeof _origAbrirInventario === 'function') {
  window.abrirInventario = async function(charNome, charId) {
    await _origAbrirInventario(charNome, charId);
    // Injetar botão de trade assim que o elemento alvo aparecer no DOM
    // (MutationObserver em vez de setTimeout fixo — robusto em redes lentas)
    const _injectTradeBtn = () => {
      const wrap = document.getElementById('inv-btn-adicionar-wrap');
      if (wrap && !document.getElementById('inv-btn-trade')) {
        const btn = document.createElement('button');
        btn.id = 'inv-btn-trade';
        btn.innerHTML = '🔄 PROPOR TRADE';
        btn.style.cssText = 'width:100%;margin-top:6px;padding:10px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.25);border-radius:8px;color:var(--primario);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;letter-spacing:0.06em';
        btn.onclick = () => abrirModalTrade(charNome, charId);
        wrap.parentNode.insertBefore(btn, wrap.nextSibling);
        return true;
      }
      return false;
    };
    if (!_injectTradeBtn()) {
      const obs = new MutationObserver(() => { if (_injectTradeBtn()) obs.disconnect(); });
      obs.observe(document.body, { childList: true, subtree: true });
      // Desconectar após 5s para não vazar observers
      setTimeout(() => obs.disconnect(), 5000);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// EXPOR FUNÇÕES GLOBALMENTE
// ─────────────────────────────────────────────────────────────
// window.criativoReclassificar = criativoReclassificar; // COMENTADO: função não existe
window.abrirModalTrade = abrirModalTrade;
window.abrirModalMercado = abrirModalMercado;
window.a5RecalcularPainel = a5RecalcularPainel;
window.renderInvBau = renderInvBau;
window.mercadoToggleGerenciar = mercadoToggleGerenciar;
window.mercadoAdicionarItem = mercadoAdicionarItem;
window.mercadoRemoverItem = mercadoRemoverItem;

// ─────────────────────────────────────────────────────────────
// ESTILOS DA PARTE 3B
// ─────────────────────────────────────────────────────────────
(function injectStyles3B() {
  const css = `
/* I10, I12, I13: modais full-screen */
#modal-loot-overlay,
#modal-trade-overlay,
#modal-mercado-overlay { display:none; }

/* Animações de item card */
.anim-pulse { animation: item-pulse 2s ease-in-out infinite; }
.anim-glow  { animation: item-glow  2s ease-in-out infinite; }
.anim-shimmer { animation: item-shimmer 2.5s linear infinite; }
@keyframes item-pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.02)} }
@keyframes item-glow    { 0%,100%{box-shadow:0 0 6px rgba(155,89,182,0.4)} 50%{box-shadow:0 0 16px rgba(155,89,182,0.8)} }
@keyframes item-shimmer { 0%{filter:brightness(1)} 50%{filter:brightness(1.15)} 100%{filter:brightness(1)} }

/* Animações para modal de DC */
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

/* I11: baú tab */
#inv-aba-bau { animation: fadeIn 0.2s ease-out; }

/* A5: details expandíveis */
details summary::-webkit-details-marker { display:none; }
details[open] summary { border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:0; padding-bottom:8px; }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

console.log('[RPGHUB] ✓ Parte 3B carregada — I10 Saque · I11 Baú · I12 Trade · I13 Mercado · A5 Status');

// ═══════════════════════════════════════════════════════════════════════════════
// CORREÇÕES ADICIONAIS — Implementadas em 26/02/2025
// ═══════════════════════════════════════════════════════════════════════════════

// ── AC-07-G3: Pets de NPC na Lista de Alvos de Suporte ────────────────────────
function _getAlvosDisponiveisParaSuporte(contexto = 'campanha') {
  const chars = contexto === 'arena'
    ? (AR.session?.characters || [])
    : (RPG_DATA?.characters || []);
  const alvos = [];
  for (const c of chars) {
    const ca = c.custom_attrs || {};
    const ehNpc = ca.tipo_personagem === 'npc' || ca.tipo === 'npc';
    const ehPet = ca.eh_pet === true;
    if (!ehPet) {
      alvos.push({ nome: c.nome, tipo: ehNpc ? 'npc' : 'jogador', cor: ca.cor || (ehNpc ? '#e8604c' : '#7ec8f0') });
    }
    if (ehPet) {
      const dono = ca.pet_dono || '?';
      alvos.push({ nome: c.nome, tipo: 'pet', dono, cor: '#9d7dd8', label: `${c.nome} (pet de ${dono})` });
    }
  }
  return alvos;
}

// ── UX-02 (aprimorado): Badge Pulsante para Novo Criativo Pendente ─────────────
function _notificarNovoCreativoPendente() {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  const btnCriativos = document.getElementById('mapa-btn-criativos') ||
    document.getElementById('ar-criativos-mestre-wrap') ||
    document.getElementById('criativos-mestre-wrap');
  if (btnCriativos) {
    let badge = btnCriativos.querySelector('.badge-notif-criativo');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge-notif-criativo';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#e74c3c;border:2px solid var(--fundo,#1a1a2e);border-radius:50%;animation:pulseNotif 1.5s ease-in-out infinite;pointer-events:none;';
      btnCriativos.style.position = 'relative';
      btnCriativos.appendChild(badge);
    }
  }
  if (!document.getElementById('style-notif-criativo')) {
    const style = document.createElement('style');
    style.id = 'style-notif-criativo';
    style.textContent = '@keyframes pulseNotif{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.6}}';
    document.head.appendChild(style);
  }
}

function _limparNotifCreativo() {
  document.querySelectorAll('.badge-notif-criativo').forEach(b => b.remove());
}

// ── UX-03: Transição Suave entre Fases do Modal ───────────────────────────────
function _aplicarTransicaoFaseModal() {
  const styleId = 'style-transicao-fase-modal';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .modal-fase-content{transition:opacity 0.3s ease-in-out,transform 0.3s ease-in-out}
    .modal-fase-content.fase-saindo{opacity:0;transform:translateX(-20px)}
    .modal-fase-content.fase-entrando{opacity:0;transform:translateX(20px);animation:faseEntrar 0.3s ease-out forwards}
    @keyframes faseEntrar{to{opacity:1;transform:translateX(0)}}
  `;
  document.head.appendChild(style);
}

async function _trocarFaseModalComTransicao(containerEl, novoConteudoHTML) {
  if (!containerEl) return;
  containerEl.classList.add('fase-saindo');
  await new Promise(r => setTimeout(r, 300));
  containerEl.innerHTML = novoConteudoHTML;
  containerEl.classList.remove('fase-saindo');
  containerEl.classList.add('fase-entrando');
  setTimeout(() => containerEl.classList.remove('fase-entrando'), 300);
}

// ── UX-05: Preservar Quebras de Linha em Mensagens do Mestre ─────────────────
function _formatarMensagemMestre(mensagem) {
  if (!mensagem) return '';
  return mensagem
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── AC-02-B3: Sincronizar Animação para Jogadores Offline ────────────────────
function _sincronizarAnimacaoCriativo(criativoId) {
  const c = CRIATIVOS_CAMP.find(x => x.id === criativoId);
  if (!c || !c.animacao) return;
  combateBroadcast('criativo_animacao', {
    criativoId,
    atacante: c.atacante,
    alvo: c.alvo || c._alvos_area,
    animacao: c.animacao
  });
}

function _onReceberAnimacaoCriativo(data) {
  const { criativoId, atacante, alvo, animacao } = data;
  let c = CRIATIVOS_CAMP.find(x => x.id === criativoId);
  if (!c) {
    c = { id: criativoId, atacante, alvo, animacao };
    CRIATIVOS_CAMP.push(c);
  } else {
    c.animacao = animacao;
  }
  if (animacao && typeof _aplicarAnimacaoSkill === 'function') {
    _aplicarAnimacaoSkill(atacante, alvo, animacao);
  }
}

// ── Inicialização das Correções ───────────────────────────────────────────────
(function _initCorrecoesAdicionais() {
  // UX-03: Injetar CSS de transição ao carregar
  _aplicarTransicaoFaseModal();
  // UX-05: Aplicar white-space: pre-wrap nos campos de mensagem do mestre
  const patchMsgFields = () => {
    ['criativo-msg-fase1', 'criativo-msg-fase2'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._preWrapPatched) {
        el.style.whiteSpace = 'pre-wrap';
        el._preWrapPatched = true;
      }
    });
  };
  // Tentar imediatamente e depois observar DOM
  patchMsgFields();
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(patchMsgFields);
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    // Desconectar após 60s para não vazar memória
    setTimeout(() => obs.disconnect(), 60000);
  }
  console.log('[RPGHUB] ✓ Correções adicionais inicializadas (AC-07-G3, AC-08-B10, AC-12-B14, UX-02, UX-03, UX-05, AC-02-B3)');
})();

// ═══════════════════════════════════════════════════════════════════════════════
// FIXES.JS — Correções do Relatório de Bugs da Simulação de Batalha
// Data: 26/02/2026
// Escopo: 15 bugs, 4 incoerências, melhorias de segurança
// Carregado APÓS app.js — sobrescreve/patcha funções existentes
// ═══════════════════════════════════════════════════════════════════════════════

(function RPGHubFixes() {
  'use strict';

  // Helper para log de fixes aplicados
  const _fixLog = (id, desc) => console.log(`[FIXES] ✓ ${id}: ${desc}`);

  // ═══════════════════════════════════════════════════════════════
  // BUG #1 — RESISTÊNCIA NEGATIVA (FRAQUEZA) COM ARREDONDAMENTO INCORRETO
  // Severidade: ALTA
  // Math.ceil(-4.6) = -4 quando deveria amplificar para -5
  // + BUG #8 — tipo_dano "cura" não deveria ser reduzido por armadura
  // + BUG #2 — Documentar/ajustar ordem de aplicação
  // ═══════════════════════════════════════════════════════════════

  const _calcularDanoFinal_original = window.calcularDanoFinal || (typeof calcularDanoFinal !== 'undefined' ? calcularDanoFinal : null);

  window.calcularDanoFinal = function(danoBruto, tipoDano, char, attrDefs, atacanteChar) {
    // BUG #8: Cura NUNCA é reduzida por armadura ou resistência
    if (tipoDano === 'cura') return Math.max(0, danoBruto);

    if (!danoBruto || danoBruto <= 0) return 0;

    const atribs = char?.custom_attrs?.atributos || {};
    const resistDefs = (attrDefs || []).filter(a => a.categoria === 'resistencia');

    let danoAtual = danoBruto;

    // ── 0b. mod_dano de debuffs do ALVO (ex: fraqueza, maldição) ──
    {
      const buffsAlvo = char?.buffs || [];
      let modTotal = 0;
      for (const b of buffsAlvo) {
        if ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0) {
          modTotal += b.mod_dano;
        }
      }
      if (modTotal !== 0) {
        danoAtual = Math.max(0, danoAtual + modTotal);
      }
    }

    // ── 1. Processar armaduras ────────────────────────────────────
    for (const def of resistDefs) {
      let cfg = {};
      try { cfg = JSON.parse(def.opcoes || '{}'); } catch (e) { continue; }
      if (cfg.tipo !== 'armadura') continue;
      const valorArmadura = parseFloat(atribs[def.nome]) || 0;
      if (!valorArmadura) continue;

      // Redução geral
      if (cfg.pct_geral) {
        const reducaoGeral = Math.ceil(valorArmadura * cfg.pct_geral / 100);
        danoAtual = Math.max(0, danoAtual - reducaoGeral);
      }
      // Redução adicional para dano físico
      if (cfg.pct_fisico && tipoDano === 'fisico') {
        const reducaoFisica = Math.ceil(valorArmadura * cfg.pct_fisico / 100);
        danoAtual = Math.max(0, danoAtual - reducaoFisica);
      }
      // Redução adicional para dano mágico
      if (cfg.pct_magico && tipoDano === 'magico') {
        const reducaoMagica = Math.ceil(valorArmadura * cfg.pct_magico / 100);
        danoAtual = Math.max(0, danoAtual - reducaoMagica);
      }
    }

    // ── 0c. mod_defesa de buffs do ALVO (aplicado APÓS armadura) ──
    // BUG #2 FIX: mod_defesa agora é aplicado após armadura para consistência
    {
      const buffsAlvo = char?.buffs || [];
      for (const b of buffsAlvo) {
        if ((b.mod_defesa ?? 0) > 0 && (b.mod_defesa_turnos_restantes ?? 0) > 0) {
          danoAtual = Math.max(0, danoAtual - b.mod_defesa);
        }
      }
    }

    // ── 2. Processar resistências elementais/por tipo ─────────────
    for (const def of resistDefs) {
      let cfg = {};
      try { cfg = JSON.parse(def.opcoes || '{}'); } catch (e) { continue; }
      if (cfg.tipo !== 'resistencia') continue;
      const dmgTypes = Array.isArray(cfg.damage_type) ? cfg.damage_type : [cfg.damage_type];
      if (!dmgTypes.includes(tipoDano)) continue;
      const valorRes = parseFloat(atribs[def.nome]) || 0;
      if (!valorRes) continue; // FIX: valorRes === 0 => nenhum efeito

      if (cfg.modo === 'absoluto') {
        // BUG #1 FIX (absoluto): fraqueza negativa amplifica dano sem limite
        // Mas clampar o mínimo em 0 quando resistência é positiva
        if (valorRes > 0) {
          danoAtual = Math.max(0, danoAtual - valorRes);
        } else {
          // Fraqueza absoluta: amplifica o dano
          danoAtual = danoAtual - valorRes; // - (-20) = +20
        }
      } else {
        // BUG #1 FIX (percentual): usar arredondamento correto para fraqueza
        if (valorRes > 0) {
          // Resistência positiva: Math.ceil arredonda a FAVOR do defensor
          const reducao = Math.ceil(danoAtual * valorRes / 100);
          danoAtual = Math.max(0, danoAtual - reducao);
        } else {
          // Fraqueza (valorRes < 0): Math.floor arredonda CONTRA o defensor
          // Ex: ceil(23 * -20/100) = ceil(-4.6) = -4 (errado, perde 0.6 de amplificação)
          // Fix: floor(23 * -20/100) = floor(-4.6) = -5 (correto, amplifica mais)
          const aumento = Math.floor(danoAtual * valorRes / 100); // ex: -5
          danoAtual = danoAtual - aumento; // 23 - (-5) = 28
        }
      }
    }

    return Math.ceil(danoAtual);
  };

  _fixLog('B01+B02+B08', 'calcularDanoFinal — fraqueza arredondamento, ordem armadura/buff, cura bypass');


  // ═══════════════════════════════════════════════════════════════
  // BUG #3 — DOT/HOT NÃO PASSA POR CÁLCULO DE RESISTÊNCIA
  // Severidade: MÉDIA
  // DOT aplica dano direto sem considerar resistências/armadura
  // Fix: Passar DOT por calcularDanoFinal opcionalmente
  // ═══════════════════════════════════════════════════════════════

  const _processarEfeitosCampanha_original = window._processarEfeitosCampanha;

  window._processarEfeitosCampanha = async function() {
    if (!RPG_DATA?.rpgId || !RPG_DATA?.characters?.length) return;
    const attrDefs = RPG_DATA?.attrDefs || [];
    const logs = [];

    for (const c of RPG_DATA.characters) {
      const buffs = c.buffs || [];
      if (!buffs.length) continue;
      let mudou = false, hpMudou = false;
      const manter = [];

      for (const b of buffs) {
        // ── DOT (com resistência opcional) ──────────────────────
        if (b.dot_formula && (b.dot_turnos_restantes ?? 0) > 0) {
          const grupos = parsearFormulaDano(b.dot_formula);
          const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.dot_formula) || 0 };
          let dano = rolagem.total;

          // BUG #3 FIX: DOT pode passar por resistências (configurável por efeito)
          // Default: DOT ignora defesas (compatível com comportamento anterior)
          if (b.dot_ignora_resistencia !== true && b.dot_tipo_dano) {
            dano = calcularDanoFinal(dano, b.dot_tipo_dano, c, attrDefs, null);
          }

          const hpMax = c.custom_attrs?.hp_max ?? 100;
          c.hp_atual = Math.max(0, (c.hp_atual ?? hpMax) - dano);
          hpMudou = true;
          logs.push(`🩸 DOT "${b.nome}" causou ${dano} de dano em ${c.nome} (HP: ${c.hp_atual}/${hpMax})`);
          b.dot_turnos_restantes--;
          mudou = true;
        }

        // ── HOT ────────────────────────────────────────────────
        if (b.hot_formula && (b.hot_turnos_restantes ?? 0) > 0) {
          const grupos = parsearFormulaDano(b.hot_formula);
          const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.hot_formula) || 0 };
          const cura = rolagem.total;
          const hpMax = c.custom_attrs?.hp_max ?? 100;
          c.hp_atual = Math.min(hpMax, (c.hp_atual ?? hpMax) + cura);
          hpMudou = true;
          logs.push(`💚 HOT "${b.nome}" curou ${cura} HP de ${c.nome} (HP: ${c.hp_atual}/${hpMax}) — ${b.hot_turnos_restantes}t restante(s)`);
          b.hot_turnos_restantes--;
          mudou = true;
        }

        // ── Recuperação de atributo por turno ──────────────────
        if (b.rec_atributo && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0) {
          const grupos = parsearFormulaDano(b.rec_formula || '0');
          const rolagem = grupos ? rolarGrupos(grupos) : { total: parseInt(b.rec_formula) || 0 };
          if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
          const atual = parseFloat(c.custom_attrs.atributos[b.rec_atributo]) || 0;
          c.custom_attrs.atributos[b.rec_atributo] = atual + rolagem.total;
          logs.push(`🔷 "${b.nome}" recuperou ${rolagem.total} de ${b.rec_atributo} em ${c.nome}`);
          b.rec_turnos_restantes--;
          mudou = true;
        }

        // ── Decrementa outros contadores ───────────────────────
        ['sem_movimento_turnos_restantes', 'sem_ataque_turnos_restantes', 'mod_dano_turnos_restantes',
         'boost_dano_turnos_restantes', 'mod_defesa_turnos_restantes', 'turnos_restantes'].forEach(campo => {
          if ((b[campo] ?? 0) > 0) { b[campo]--; mudou = true; }
        });

        // Verificar se o buff ainda está ativo
        const aindaVivo = (b.dot_turnos_restantes ?? 0) > 0
          || (b.hot_turnos_restantes ?? 0) > 0
          || (b.sem_movimento && (b.sem_movimento_turnos_restantes ?? 0) > 0)
          || (b.sem_ataque && (b.sem_ataque_turnos_restantes ?? 0) > 0)
          || ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0)
          || ((b.boost_dano ?? 0) !== 0 && (b.boost_dano_turnos_restantes ?? 0) > 0)
          || ((b.mod_defesa ?? 0) !== 0 && (b.mod_defesa_turnos_restantes ?? 0) > 0)
          || (b.rec_atributo && b.rec_modo === 'turno' && (b.rec_turnos_restantes ?? 0) > 0)
          || (b.turnos_restantes ?? 0) > 0;

        if (!aindaVivo) {
          // ── Reverter modificador_attr temporário ao expirar ────
          if (b.modificador_attr && (b.modificador_delta ?? 0) !== 0) {
            if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
            c.custom_attrs.atributos[b.modificador_attr] =
              (parseFloat(c.custom_attrs.atributos[b.modificador_attr]) || 0) - b.modificador_delta;
            mudou = true;
          }
          logs.push(_logExpiracaoEfeito(b, c.nome)); }
        else manter.push(b);
      }

      // ═══════════════════════════════════════════════════════════
      // BUG #7 — INVOCAÇÃO TEMPORÁRIA NÃO EXPIRA (CAMPANHA)
      // Severidade: ALTA
      // turno_expira é setado mas nunca verificado na campanha
      // ═══════════════════════════════════════════════════════════
      const ca = c.custom_attrs || {};
      if (ca.invocado && ca.turno_expira != null) {
        // Na campanha, usamos turnoRound da batalha ativa como referência
        const bs = BATALHA_ATUAL_ID ? (MAPA_STATE.batalhas[BATALHA_ATUAL_ID] || null) : null;
        const turnoAtual = bs?.turnoRound || 0;
        if (turnoAtual >= ca.turno_expira) {
          c.hp_atual = 0;
          ca.invocado = false;
          ca.eh_pet = false;
          logs.push(`💨 ${c.nome} (invocação) desapareceu — duração expirada no turno ${turnoAtual}`);
          mudou = true;
          hpMudou = true;
        }
      }

      if (mudou) {
        c.buffs = manter;
        const body = { buffs: c.buffs };
        if (hpMudou) body.hp_atual = c.hp_atual;
        body.custom_attrs = c.custom_attrs;
        try {
          await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(c.nome)}`,
            { method: 'PATCH', body: JSON.stringify(body) });
        } catch (e) { }
      }
    }

    if (logs.length) {
      logs.forEach(l => mostrarToast(l, ''));
      renderCharView?.(CHAR_VIEW);
      renderAttrView?.(ATTR_VIEW);
      mapaRenderStatus?.();
    }
  };

  _fixLog('B03+B07', 'DOT com resistência opcional + invocação expira na campanha');


  // ═══════════════════════════════════════════════════════════════
  // BUG #6 — COOLDOWN DE SKILLS INLINE NÃO RASTREADO (SEM ID)
  // Severidade: MÉDIA
  // Habilidades inline de criaturas/genéricos não têm ID do banco
  // ═══════════════════════════════════════════════════════════════

  const _petGetHabilidadesPet_original = window.petGetHabilidadesPet || petGetHabilidadesPet;

  window.petGetHabilidadesPet = function(petNome, contexto) {
    const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === petNome);
    if (!c) return [];
    const ca = c.custom_attrs || {};

    // Criaturas e NPCs com habilidades inline
    if (ca.habilidades?.length) {
      return ca.habilidades.map((h, i) => ({
        ...h,
        // BUG #6 FIX: Gerar ID sintético para rastrear cooldowns
        id: h.id || `${petNome}_hab_${i}`,
        cooldown_turnos: h.cooldown_turnos || 0
      }));
    }
    // Jogadores / personagens com ficha usam a tabela skills
    if (contexto === 'arena') return atkGetHabilidadesArena(petNome);
    return atkGetHabilidadesCampanha(petNome);
  };

  _fixLog('B06', 'Cooldown de skills inline com ID sintético');


  // ═══════════════════════════════════════════════════════════════
  // BUG #11 — AÇÃO CRIATIVA: tipo_dano FIXO COMO "fisico"
  // Severidade: MÉDIA
  // O mestre pode escolher tipo_dano na fase 1 mas não é propagado
  // ═══════════════════════════════════════════════════════════════

  const _criativoJogadorRolarDano_original = window.criativoJogadorRolarDano;

  window.criativoJogadorRolarDano = function() {
    const c = CRIATIVOS_CAMP.find(x => x.id === CRIATIVO_ID_ATUAL);
    if (!c) return;

    let efeitosExtras = [];
    const custo = c.custo_cobrado;
    if (custo && typeof custo === 'object' && Array.isArray(custo._efeitos_extras)) {
      efeitosExtras = custo._efeitos_extras;
    }

    const criativoTipo = c.criativo_tipo || 'ataque';
    const alvoTipoFinal = criativoTipo === 'suporte'
      ? (c.criativo_alvo_tipo === 'proprio' ? 'proprio' : 'aliado')
      : 'inimigo';

    const ehCura = criativoTipo === 'suporte' && efeitosExtras.some(e => e.tipo === 'cura_imediata' || e.hot_formula);

    // BUG #11 FIX: Usar tipo_dano definido pelo mestre (salvo em c.tipo_dano ou c._skill_meta.tipo_dano)
    let tipoDanoFinal;
    if (criativoTipo === 'suporte') {
      tipoDanoFinal = ehCura ? 'cura' : 'suporte';
    } else {
      // Prioridade: tipo_dano explícito do mestre > _skill_meta > fallback 'fisico'
      tipoDanoFinal = c.tipo_dano || c._skill_meta?.tipo_dano || 'fisico';
    }

    // Suporte a múltiplos alvos
    if (c.criativo_alvo_tipo === 'area' && c._alvos_area && c._alvos_area.length > 1) {
      COMBATE._alvosAoE = c._alvos_area;
      COMBATE.alvoNome = c._alvos_area[0];
    } else {
      COMBATE._alvosAoE = null;
      COMBATE.alvoNome = c.alvo || null;
    }

    // BUG FIX: Restaurar atacanteNome e contexto do criativo, pois o COMBATE pode
    // ter sido resetado entre a aprovação e o clique em "Rolar" (ex: mestre abriu
    // outro modal de ataque no meio). Sem isso, o dano é aplicado sem atacante.
    if (!COMBATE.atacanteNome && c.atacante) {
      COMBATE.atacanteNome = c.atacante;
    }
    if (!COMBATE.contexto) {
      COMBATE.contexto = (typeof AR !== 'undefined' && AR?.session) ? 'arena' : 'campanha';
    }

    COMBATE.habilidadeSel = {
      criativo: true,
      nome: 'Ação Criativa',
      formula_dano: c.formula_aprovada || null,
      atributo_base: c.mod_atributo || null,
      mod_atributo_pct: c.mod_atributo_pct || null,
      cooldown_turnos: 0,
      alvo_tipo: alvoTipoFinal,
      tipo_dano: tipoDanoFinal,
      efeitos_bonus: efeitosExtras,
      animacao: c.animacao || null,
    };

    const alvoResumo = document.getElementById('atk-alvo-resumo');
    const alvoLabel = COMBATE._alvosAoE ? COMBATE._alvosAoE.join(', ') : (c.alvo || '?');
    if (alvoResumo) alvoResumo.textContent = `Alvo: ${alvoLabel}`;

    _criativoHideAllPendente();
    atkPrepararStep3();
    atkIrParaStep(3); // BUG FIX: navegar para o step de rolagem após preparar
  };

  // Patch: salvar tipo_dano do mestre na fase 1
  const _criativoMestreConcluirFase1_original = window.criativoMestreConcluirFase1;

  window.criativoMestreConcluirFase1 = async function() {
    // Antes de chamar o original, salvar tipo_dano no criativo
    const id = document.getElementById('criativo-mestre-id')?.value;
    if (id) {
      const c = CRIATIVOS_CAMP.find(x => x.id === id);
      if (c) {
        const tipoDanoEl = document.getElementById('criativo-skill-tipo-dano');
        if (tipoDanoEl) {
          c.tipo_dano = tipoDanoEl.value || 'fisico';
        }
      }
    }
    // Chamar original
    if (_criativoMestreConcluirFase1_original) {
      return _criativoMestreConcluirFase1_original.apply(this, arguments);
    }
  };

  _fixLog('B11', 'Ação criativa propaga tipo_dano do mestre');


  // ═══════════════════════════════════════════════════════════════
  // BUG #12 — EMPATE DE INICIATIVA PODE LOOPAR INFINITAMENTE
  // Severidade: ALTA
  // NPCs re-rolam via setTimeout sem limite de tentativas
  // ═══════════════════════════════════════════════════════════════

  window.batalhaVerificarIniciativasCompletas = function(bid) {
    const bs = MAPA_STATE.batalhas[bid];
    if (!bs) return;
    const todosRolaram = bs.participantes.every(p => bs.iniciativasRoladas[p.nome] != null);
    if (!todosRolaram) return;

    const grupos = {};
    bs.participantes.forEach(p => {
      const v = bs.iniciativasRoladas[p.nome];
      if (!grupos[v]) grupos[v] = [];
      grupos[v].push(p);
    });
    const empatados = [];
    Object.values(grupos).forEach(grp => {
      if (grp.length > 1) grp.forEach(p => empatados.push(p.nome));
    });

    if (empatados.length) {
      // BUG #12 FIX: Contador de tentativas com failsafe
      if (!bs._rerollCount) bs._rerollCount = 0;
      bs._rerollCount++;

      if (bs._rerollCount > 10) {
        // Failsafe: desempate por ordem alfabética com valores únicos
        mostrarToast('⚠ Empate persistente — desempate automático aplicado.', 'aviso');
        const sorted = [...empatados].sort();
        sorted.forEach((n, i) => {
          const baseVal = bs.iniciativasRoladas[n] ?? 10;
          bs.iniciativasRoladas[n] = baseVal + (sorted.length - i) * 0.01; // micro-diferença
          const p = bs.participantes.find(x => x.nome === n);
          if (p) p.iniciativa = bs.iniciativasRoladas[n];
        });
        bs._rerollCount = 0;
        bs.empatados = [];
        // Continuar para ordenação final (sem loop)
      } else {
        bs.empatados = empatados;
        empatados.forEach(n => {
          delete bs.iniciativasRoladas[n];
          const p = bs.participantes.find(x => x.nome === n);
          if (p) p.iniciativa = null;
          // NPCs re-rolam automaticamente
          if (p && p.tipo === 'npc') {
            const roll = Math.floor(Math.random() * 20) + 1;
            bs.iniciativasRoladas[n] = roll;
            p.iniciativa = roll;
            bs.empatados = bs.empatados.filter(e => e !== n);
          }
        });
        bs.fase = 'empate';
        batalhaRenderFaseIniciativa();
        salvarEstadoBatalha(bid);
        combateBroadcast('batalha_estado', {
          batalhaId: bid, fase: bs.fase,
          iniciativasRoladas: bs.iniciativasRoladas,
          empatados: bs.empatados, participantes: bs.participantes
        });

        const pendentesHumanos = bs.empatados.length > 0;
        if (pendentesHumanos) {
          mostrarToast('⚠ Empate! Os participantes marcados devem re-rolar.', '');
        } else {
          setTimeout(() => batalhaVerificarIniciativasCompletas(bid), 100);
        }
        return;
      }
    }

    // Limpar contador ao resolver
    bs._rerollCount = 0;

    bs.participantes.sort((a, b) => (bs.iniciativasRoladas[b.nome] || 0) - (bs.iniciativasRoladas[a.nome] || 0));
    bs.participantes.forEach(p => { p.iniciativa = bs.iniciativasRoladas[p.nome]; });
    bs.fase = 'combate';
    bs.ordemAtual = 0;
    bs.empatados = [];
    _aplicarEstadoBatalhaUI();
    salvarEstadoBatalha(bid);
    combateBroadcast('batalha_estado', {
      batalhaId: bid, fase: 'combate', participantes: bs.participantes,
      ordemAtual: 0, turnoRound: bs.turnoRound, iniciativasRoladas: bs.iniciativasRoladas, empatados: []
    });
    _atualizarBadgeMesa();
    _notificarVez(bs, bid);
  };

  _fixLog('B12', 'Empate iniciativa com failsafe anti-loop (max 10 tentativas)');


  // ═══════════════════════════════════════════════════════════════
  // BUG #14 — POOL MÁXIMO (Mana/Stamina) NÃO ENFORCED
  // Severidade: BAIXA
  // Recuperação pode ultrapassar o máximo do pool
  // ═══════════════════════════════════════════════════════════════

  window.atkAplicarRecuperacaoAtributo = async function(nomeAlvo, atributo, quantidade, contexto) {
    if (!atributo || !quantidade) return;
    const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === nomeAlvo);
    if (!c || !c.custom_attrs) return;
    if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};

    const atual = parseFloat(c.custom_attrs.atributos[atributo]) || 0;
    let novoValor;

    if (quantidade < 0) {
      novoValor = Math.max(0, atual + quantidade);
    } else {
      // BUG #14 FIX: Calcular pool máximo e clampar
      let maxPool = Infinity;
      const attrDefs = contexto === 'arena' ? (AR.attrDefs || RPG_DATA?.attrDefs || []) : (RPG_DATA?.attrDefs || []);
      const attrDef = attrDefs.find(a => a.nome === atributo);
      if (attrDef?.opcoes) {
        try {
          const cfg = JSON.parse(attrDef.opcoes);
          if (cfg.max_base != null) {
            const atribs = c.custom_attrs.atributos || {};
            const attrBonus = parseFloat(atribs[cfg.max_attr]) || 0;
            maxPool = cfg.max_base + attrBonus * (cfg.max_mult || 0);
          }
        } catch (e) { }
      }
      novoValor = Math.min(maxPool, atual + quantidade);
    }

    // Toast de aviso quando recurso zera
    if (novoValor === 0 && quantidade < 0 && atual > 0) {
      mostrarToast(`⚠ ${atributo} de ${nomeAlvo} chegou a zero!`, 'aviso');
    }
    // Toast quando atinge o máximo
    if (novoValor < atual + quantidade && quantidade > 0) {
      mostrarToast(`${atributo} de ${nomeAlvo} no máximo!`, '');
    }

    c.custom_attrs.atributos[atributo] = novoValor;

    if (contexto === 'arena') {
      await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
        { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    } else {
      await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
        { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    }
  };

  _fixLog('B14', 'Pool máximo (Mana/Stamina) agora enforced');


  // ═══════════════════════════════════════════════════════════════
  // INCOERÊNCIA #3 — custo_rsv COMO STRING NÃO NORMALIZADO
  // Suporte a custo duplo ("2 Mana + 5 Stamina") e match case-insensitive
  // ═══════════════════════════════════════════════════════════════

  window.parsearCustoRSV = function(custo_rsv) {
    if (!custo_rsv) return null;
    const s = custo_rsv.trim();
    if (!s || /^passiv/i.test(s)) return null;

    // Suporte a custo múltiplo: "2 Mana + 5 Stamina"
    if (s.includes('+')) {
      const partes = s.split('+').map(p => p.trim());
      const custos = partes.map(p => {
        const match = p.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
        if (!match) return null;
        return { quantidade: parseFloat(match[1]), atributo: match[2].trim() };
      }).filter(Boolean);
      if (custos.length === 0) return null;
      if (custos.length === 1) return custos[0];
      // Retornar array para custos múltiplos
      return custos;
    }

    const match = s.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!match) return null;
    return { quantidade: parseFloat(match[1]), atributo: match[2].trim() };
  };

  // Patch verificarCustoSkill para suportar custos múltiplos e case-insensitive
  window.verificarCustoSkill = function(atacanteNome, custo_rsv, contexto) {
    const parsed = parsearCustoRSV(custo_rsv);
    if (!parsed) return { ok: true };
    const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === atacanteNome);
    const atribs = c?.custom_attrs?.atributos || {};

    // Helper: match case-insensitive do nome do atributo
    const findAtrib = (nome) => {
      const exact = atribs[nome];
      if (exact != null) return { key: nome, val: parseFloat(exact) || 0 };
      const lc = nome.toLowerCase();
      const found = Object.keys(atribs).find(k => k.toLowerCase() === lc);
      return found ? { key: found, val: parseFloat(atribs[found]) || 0 } : { key: nome, val: 0 };
    };

    // Array de custos (pode ser único ou múltiplo)
    const custos = Array.isArray(parsed) ? parsed : [parsed];

    for (const custo of custos) {
      const { key, val } = findAtrib(custo.atributo);
      if (val < custo.quantidade) {
        return { ok: false, atributo: key, custo: custo.quantidade, atual: val };
      }
    }

    // Se apenas um custo, retornar formato original compatível
    if (custos.length === 1) {
      const { key } = findAtrib(custos[0].atributo);
      return { ok: true, atributo: key, quantidade: custos[0].quantidade };
    }
    return { ok: true, custos };
  };

  // Patch descontarCustoSkill para custos múltiplos
  window.descontarCustoSkill = async function(atacanteNome, custo_rsv, contexto) {
    const parsed = parsearCustoRSV(custo_rsv);
    if (!parsed) return;

    const custos = Array.isArray(parsed) ? parsed : [parsed];
    for (const custo of custos) {
      // Case-insensitive match
      const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
      const c = chars.find(x => x.nome === atacanteNome);
      const atribs = c?.custom_attrs?.atributos || {};
      let nomeAtrib = custo.atributo;
      if (atribs[nomeAtrib] == null) {
        const lc = nomeAtrib.toLowerCase();
        const found = Object.keys(atribs).find(k => k.toLowerCase() === lc);
        if (found) nomeAtrib = found;
      }
      await atkAplicarRecuperacaoAtributo(atacanteNome, nomeAtrib, -custo.quantidade, contexto);
      mostrarToast(`−${custo.quantidade} ${nomeAtrib}`, '');
    }
  };

  _fixLog('I03', 'custo_rsv suporta custo múltiplo e match case-insensitive');


  // ═══════════════════════════════════════════════════════════════
  // BUG #5 — TIPO "objeto" NÃO TEM FACÇÃO
  // Severidade: BAIXA
  // Objetos (Totem Venenoso) precisam de facção para targeting
  // ═══════════════════════════════════════════════════════════════

  // Patch: Observar o modal de criação de personagem para adicionar facção a objetos
  const _patchFactionParaObjetos = () => {
    // Observar mudanças no tipo de personagem para mostrar/ocultar faction
    const hookTipoChange = () => {
      const tipoSel = document.getElementById('nc-tipo') || document.getElementById('fc-tipo');
      if (!tipoSel || tipoSel._fixFactionPatched) return;
      tipoSel._fixFactionPatched = true;

      const originalOnChange = tipoSel.onchange;
      tipoSel.addEventListener('change', () => {
        const val = tipoSel.value;
        // Mostrar facção para npc, criatura E objeto
        const factionSel = document.getElementById('nc-faction') || document.getElementById('fc-faction');
        const factionWrap = factionSel?.closest('.form-group');
        if (factionWrap) {
          factionWrap.style.display = (val === 'npc' || val === 'criatura' || val === 'objeto') ? '' : 'none';
        }
      });
    };

    // Tentar patch imediato e via MutationObserver
    hookTipoChange();
    if (typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(hookTipoChange);
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
      setTimeout(() => obs.disconnect(), 120000);
    }
  };

  _patchFactionParaObjetos();
  _fixLog('B05', 'Facção disponível para tipo "objeto"');


  // ═══════════════════════════════════════════════════════════════
  // INCOERÊNCIA #1 — DUPLICIDADE tipo vs tipo_personagem
  // Garantir que ambos os campos sejam sempre consistentes
  // ═══════════════════════════════════════════════════════════════

  // Helper global: normalizar tipo de personagem
  window._normalizarTipoPersonagem = function(ca) {
    if (!ca) return;
    // Garantir que ambos os campos existam e sejam iguais
    const tipo = ca.tipo || ca.tipo_personagem || 'jogador';
    ca.tipo = tipo;
    if (tipo === 'npc' || tipo === 'criatura' || tipo === 'objeto') {
      ca.tipo_personagem = 'npc';
    } else {
      ca.tipo_personagem = tipo;
    }
  };

  // Helper global: obter tipo normalizado de um personagem
  window._getTipoPersonagem = function(c) {
    const ca = c?.custom_attrs || {};
    return ca.tipo || ca.tipo_personagem || 'jogador';
  };

  _fixLog('I01', 'Helper de normalização tipo/tipo_personagem');


  // ═══════════════════════════════════════════════════════════════
  // INCOERÊNCIA #2 — HABILIDADES: unificar tabela skills + inline
  // ═══════════════════════════════════════════════════════════════

  window.getTodasHabilidades = function(nome, contexto) {
    const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === nome);
    if (!c) return [];
    const ca = c.custom_attrs || {};

    // Inline habilidades (criaturas/genéricos)
    const inline = (ca.habilidades || []).map((h, i) => ({
      ...h,
      id: h.id || `${nome}_hab_${i}`,
      _source: 'inline',
      cooldown_turnos: h.cooldown_turnos || 0,
    }));

    // Skills do banco de dados
    let dbSkills = [];
    if (contexto === 'arena') {
      dbSkills = (typeof atkGetHabilidadesArena === 'function') ? atkGetHabilidadesArena(nome) : [];
    } else {
      dbSkills = (typeof atkGetHabilidadesCampanha === 'function') ? atkGetHabilidadesCampanha(nome) : [];
    }
    dbSkills = dbSkills.map(s => ({ ...s, _source: 'db' }));

    // Deduplicar por nome (prioridade: banco > inline)
    const nomesSeen = new Set();
    const result = [];
    for (const s of dbSkills) {
      if (!nomesSeen.has(s.nome || s.habilidade)) {
        nomesSeen.add(s.nome || s.habilidade);
        result.push(s);
      }
    }
    for (const s of inline) {
      if (!nomesSeen.has(s.nome || s.habilidade)) {
        nomesSeen.add(s.nome || s.habilidade);
        result.push(s);
      }
    }
    return result;
  };

  _fixLog('I02', 'getTodasHabilidades() unifica skills inline + banco');


  // ═══════════════════════════════════════════════════════════════
  // INCOERÊNCIA #4 — sem_ataque NÃO VERIFICADO ANTES DE EXIBIR BOTÃO
  // Severidade: MÉDIA
  // O jogador pode abrir o modal de ataque mesmo estando bloqueado
  // ═══════════════════════════════════════════════════════════════

  // Helper: verificar se personagem pode atacar (qualquer tipo)
  window._personagemPodeAtacar = function(nome, contexto) {
    const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find(x => x.nome === nome);
    if (!c) return false;
    const buffs = c.buffs || [];

    // Verificar se tem bloqueio total de ataques
    const bloqueioTotal = buffs.some(b =>
      b.sem_ataque &&
      (b.sem_ataque_turnos_restantes ?? 0) > 0 &&
      (b.sem_ataque_tipo || 'todos') === 'todos'
    );
    return !bloqueioTotal;
  };

  // Patch: interceptar batalhaAtacarVez para verificar sem_ataque
  const _batalhaAtacarVez_original = window.batalhaAtacarVez;

  window.batalhaAtacarVez = function() {
    const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
    if (!bs) return;
    const atual = bs.participantes[bs.ordemAtual];
    if (!atual) return;

    // INCOERÊNCIA #4 FIX: Verificar se pode atacar antes de abrir modal
    if (!_personagemPodeAtacar(atual.nome, 'campanha')) {
      mostrarToast(`🚫 ${atual.nome} está impedido de atacar neste turno!`, 'erro');
      return;
    }

    // Chamar original
    if (_batalhaAtacarVez_original) {
      return _batalhaAtacarVez_original.apply(this, arguments);
    }
  };

  _fixLog('I04', 'sem_ataque verificado antes de exibir modal de ataque');


  // ═══════════════════════════════════════════════════════════════
  // BUG #13 — HP MÁXIMO NÃO RECALCULA AO ALTERAR ATRIBUTO
  // Severidade: MÉDIA
  // Se Constituição muda, hp_max deveria ser recalculado
  // ═══════════════════════════════════════════════════════════════

  window.recalcularHpMax = function(c) {
    if (!c?.custom_attrs) return;
    const ca = c.custom_attrs;
    const lc = RPG_DATA?.level_config;
    if (!lc || !lc.hp_attr) return ca.hp_max; // sem derivação

    const nivel = ca.nivel || c.nivel || 1;
    const atribs = ca.atributos || {};
    const attrVal = parseFloat(atribs[lc.hp_attr]) || 0;
    const base = lc.hp_base || 100;
    const perLevel = lc.hp_por_nivel || 0;
    const mult = lc.hp_attr_mult || 0;
    // ESTRUTURAL-01: delegar ao calcularHpMaxComAtributos (fonte única de verdade)
    const novoMax = calcularHpMaxComAtributos(lc, atribs, null, nivel);

    const antigoMax = ca.hp_max || novoMax;
    if (novoMax !== antigoMax) {
      // Ajustar HP atual proporcionalmente
      const hpAtual = c.hp_atual ?? antigoMax;
      const proporcao = antigoMax > 0 ? hpAtual / antigoMax : 1;
      ca.hp_max = novoMax;
      c.hp_atual = Math.round(novoMax * proporcao);
      c.hp_max = novoMax;
    }
    return novoMax;
  };

  _fixLog('B13', 'recalcularHpMax() disponível para level up / atributo change');


  // ═══════════════════════════════════════════════════════════════
  // BUG #4 — PET DE NPC: sem_ataque DO DONO NÃO BLOQUEIA PET
  // Severidade: MÉDIA
  // petDonoEstaAtivo chamado sem tipoDanoHabilidade
  // Fix: Garantir que a chamada no render de pets passe o tipo
  // ═══════════════════════════════════════════════════════════════

  // A função petDonoEstaAtivo JÁ verifica sem_ataque_tipo=todos (linha 1906)
  // e tipoDanoHabilidade específico (linha 1909-1911).
  // O bug está na CHAMADA em atkRenderizarSecaoPets (linha 1924) que não
  // passa tipoDanoHabilidade. Patchamos para que cada habilidade do pet
  // seja verificada individualmente.

  const _atkRenderizarSecaoPets_original = window.atkRenderizarSecaoPets;

  window.atkRenderizarSecaoPets = function(donoNome, contexto) {
    const pets = petGetPetsDoDono(donoNome, contexto);
    const el = document.getElementById('atk-pets-section');
    if (!el) return;

    if (!pets.length) { el.style.display = 'none'; return; }

    // BUG #4 FIX: Verificar se o dono está ativo com bloqueio total
    const donoAtivo = petDonoEstaAtivo(donoNome, contexto);

    const rows = pets.map(pet => {
      const habilidades = petGetHabilidadesPet(pet.nome, contexto);
      if (!habilidades.length) return '';
      const cor = pet.custom_attrs?.cor || '#7ec8f0';
      const hpAtual = pet.hp_atual ?? (pet.custom_attrs?.hp_max ?? 100);
      const hpMax = pet.custom_attrs?.hp_max ?? 100;

      const habRows = habilidades.map(h => {
        // BUG #4 FIX: Verificar bloqueio por tipo para cada habilidade individual
        const bloqueioTipo = !petDonoEstaAtivo(donoNome, contexto, h.tipo_dano);
        const bloqueioSkill = typeof atkVerificarBloqueioAtaque === 'function' &&
          atkVerificarBloqueioAtaque(pet.nome, h.tipo_dano);
        const blocked = !donoAtivo || bloqueioTipo || bloqueioSkill;

        return `<div onclick="${blocked ? `mostrarToast('${blocked ? '🚫 Dono impedido de atacar' : '🚫 Bloqueado'}','erro')` : `atkSelecionarPetHabilidade('${pet.nome}','${h.nome || h.habilidade}')`}"
          style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(10,12,18,0.9);border:1px solid ${blocked ? '#444' : cor + '33'};border-radius:6px;cursor:${blocked ? 'default' : 'pointer'};opacity:${blocked ? '0.4' : '1'};margin-top:4px">
          <span style="color:${cor};font-size:0.8rem">${blocked ? '🔒' : '⚔'}</span>
          <div style="flex:1">
            <div style="font-family:'Cinzel',serif;font-size:0.75rem;color:${cor}">${h.nome || h.habilidade}</div>
            <div style="font-size:0.65rem;color:#7a6060">${h.formula_dano || ''} ${h.tipo_dano || ''}</div>
          </div>
        </div>`;
      }).join('');

      return `<div style="background:rgba(15,20,30,0.9);border:1px solid ${cor}33;border-radius:8px;padding:10px;margin-top:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="color:${cor};font-size:0.85rem">🐾</span>
          <span style="font-family:'Cinzel',serif;font-size:0.8rem;color:${cor}">${pet.nome}</span>
          <span style="font-size:0.65rem;color:#7a6060">HP: ${hpAtual}/${hpMax}</span>
        </div>
        ${habRows}
      </div>`;
    }).join('');

    el.innerHTML = rows;
    el.style.display = rows ? 'block' : 'none';
  };

  _fixLog('B04', 'Pet verifica bloqueio do dono por tipo de habilidade');


  // ═══════════════════════════════════════════════════════════════
  // BUG #10 — ATRIBUTO "especial" SILENCIOSAMENTE IGNORADO EM CRIATURAS
  // Severidade: BAIXA
  // Aviso quando atributo especial é definido para genérico
  // ═══════════════════════════════════════════════════════════════

  // Helper que pode ser chamado durante importação/criação
  window._verificarAtributosEspeciais = function(personagemNome, tipo, atribs, attrDefs) {
    if (tipo !== 'criatura' && tipo !== 'objeto') return;
    const especiais = (attrDefs || []).filter(a => a.categoria === 'especial');
    for (const def of especiais) {
      const val = atribs?.[def.nome];
      if (val != null && val !== 0 && val !== '') {
        mostrarToast(`⚠ Atributo especial "${def.nome}" definido para ${personagemNome} (${tipo}) — será invisível na ficha de genéricos.`, 'aviso');
      }
    }
  };

  _fixLog('B10', 'Warning para atributos especiais em criaturas/objetos');


  // ═══════════════════════════════════════════════════════════════
  // BUG #15 — SKILL COM alcance_celulas NULL SEM WARNING
  // Severidade: BAIXA/DESIGN
  // Sugestão de alcance ao criar skill melee
  // ═══════════════════════════════════════════════════════════════

  // Patch: ao salvar skill, avisar se alcance não definido para tipo físico
  window._verificarAlcanceSkill = function(tipoDano, alcance) {
    if ((tipoDano === 'fisico' || tipoDano === 'magico') && (alcance == null || alcance === '')) {
      mostrarToast('💡 Dica: habilidades sem alcance definido atingem qualquer distância. Para corpo-a-corpo, defina alcance 1-2.', '');
    }
  };

  _fixLog('B15', 'Aviso de alcance indefinido para skills melee');



  // ═══════════════════════════════════════════════════════════════
  // BUG-10 FIX — XP duplicado: garantir que todo PATCH inclua ambos os campos
  // ═══════════════════════════════════════════════════════════════

  const _xpSalvarChar_original = window.xpSalvarChar;
  window.xpSalvarChar = async function(c, ca) {
    // Garantir sincronia: c.xp = ca.xp sempre
    c.xp = ca.xp ?? c.xp ?? 0;
    // Chamar original que já inclui { custom_attrs: ca, xp: ca.xp }
    if (_xpSalvarChar_original) return _xpSalvarChar_original.call(this, c, ca);
    // Fallback caso original não exista
    try {
      await sb(
        `characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(c.nome)}`,
        { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca, xp: ca.xp }) }
      );
    } catch(e) { mostrarToast('Erro ao salvar XP', 'erro'); }
  };

  // Helper de diagnóstico — chame no console: assertXpConsistente()
  window.assertXpConsistente = function() {
    const chars = RPG_DATA?.characters || [];
    let divergencias = 0;
    chars.forEach(c => {
      const xpTop = c.xp ?? null;
      const xpCa  = c.custom_attrs?.xp ?? null;
      if (xpTop !== null && xpCa !== null && xpTop !== xpCa) {
        console.warn(`[XP DIVERGÊNCIA] ${c.nome}: c.xp=${xpTop}, custom_attrs.xp=${xpCa}`);
        divergencias++;
      }
    });
    if (!divergencias) console.log('[XP OK] Todos os personagens consistentes.');
    return divergencias;
  };

  _fixLog('B10-XP', 'xpSalvarChar sempre sincroniza c.xp = ca.xp');


  // ═══════════════════════════════════════════════════════════════
  // BUG-11 FIX — Verificar alcance de skill antes de confirmar alvo
  // ═══════════════════════════════════════════════════════════════

  // Helper: distância Manhattan entre dois tokens no mapa atual
  function _distanciaEntreTokens(nomeA, nomeB) {
    const mapaId = MAPA_STATE.mapaAtualId;
    if (!mapaId) return null;
    const chars = RPG_DATA?.characters || [];
    const cA = chars.find(x => x.nome === nomeA);
    const cB = chars.find(x => x.nome === nomeB);
    if (!cA || !cB) return null;
    const posA = cA.map_positions?.[mapaId];
    const posB = cB.map_positions?.[mapaId];
    if (!posA || !posB) return null;
    return Math.abs(posA.col - posB.col) + Math.abs(posA.row - posB.row);
  }

  // Patch em atkSelecionarAlvo para bloquear alvos fora de alcance
  const _atkSelecionarAlvo_original = window.atkSelecionarAlvo;
  window.atkSelecionarAlvo = function(nomeAlvo) {
    const h = COMBATE.habilidadeSel;
    if (h?.alcance_celulas != null && COMBATE.contexto === 'campanha') {
      const dist = _distanciaEntreTokens(COMBATE.atacanteNome, nomeAlvo);
      if (dist !== null && dist > h.alcance_celulas) {
        mostrarToast(
          `🚫 Fora de alcance! "${h.nome}" alcança ${h.alcance_celulas} célula(s) — ` +
          `${nomeAlvo} está a ${dist} célula(s).`,
          'erro'
        );
        return; // bloquear seleção
      }
    }
    if (_atkSelecionarAlvo_original) return _atkSelecionarAlvo_original.apply(this, arguments);
  };

  _fixLog('B11', 'alcance_celulas validado ao selecionar alvo em campanha');


  // ═══════════════════════════════════════════════════════════════
  // BUG-12 FIX — HP max duplicado: diagnóstico e sincronização
  // ═══════════════════════════════════════════════════════════════

  // Helper de diagnóstico — chame no console: assertHpConsistente()
  window.assertHpConsistente = function() {
    const chars = RPG_DATA?.characters || [];
    let divergencias = 0;
    chars.forEach(c => {
      const hpTop = c.hp_max ?? null;
      const hpCa  = c.custom_attrs?.hp_max ?? null;
      if (hpTop !== null && hpCa !== null && hpTop !== hpCa) {
        console.warn(`[HP MAX DIVERGÊNCIA] ${c.nome}: c.hp_max=${hpTop}, custom_attrs.hp_max=${hpCa}`);
        divergencias++;
        // Auto-corrigir: coluna top-level é fonte de verdade no load
        c.custom_attrs.hp_max = hpTop;
      }
    });
    if (!divergencias) console.log('[HP MAX OK] Todos os personagens consistentes.');
    return divergencias;
  };

  // Executar verificação após carregamento de dados (não-bloqueante)
  const _iniciarApp_orig = window.iniciarApp;
  if (_iniciarApp_orig) {
    window.iniciarApp = async function() {
      const result = await _iniciarApp_orig.apply(this, arguments);
      setTimeout(() => {
        if (RPG_DATA?.characters?.length) assertHpConsistente();
      }, 2000);
      return result;
    };
  }

  _fixLog('B12', 'assertHpConsistente() disponível + verificação automática no load');

})();

// ════════════════════════════════════════════════════════════════════════
// NMCE — FERRAMENTAS DE CENÁRIO (Paredes, Portas, Objetos)
// Integradas no editor canvas do modal de criar/editar mapa
// ════════════════════════════════════════════════════════════════════════

// ── Grid dimensions from the modal form ─────────────────────────────────
function _nmceGridDims() {
  const cols = parseInt(document.getElementById('nm-grid')?.value) || 20;
  // Canvas is always 800×500 internally; rows derived proportionally from cols
  const rows = Math.round(cols * (500 / 800));
  return { cols, rows };
}

// ── Snap pixel position to nearest grid border (h or v) ─────────────────
function _nmceSnapPonto(xPx, yPx, canvas) {
  const { cols, rows } = _nmceGridDims();
  const cW = canvas.width  / cols;
  const cH = canvas.height / rows;
  const gx = xPx / cW;
  const gy = yPx / cH;
  const nearCol = Math.round(gx);
  const nearRow = Math.round(gy);
  const distV = Math.abs(gx - nearCol);
  const distH = Math.abs(gy - nearRow);
  if (distV <= distH) {
    return { tipo: 'v', col: nearCol, row: Math.floor(gy), px: nearCol * cW, py: (Math.floor(gy) + 0.5) * cH };
  } else {
    return { tipo: 'h', col: Math.floor(gx), row: nearRow, px: (Math.floor(gx) + 0.5) * cW, py: nearRow * cH };
  }
}

// ── Snap pixel to cell center ────────────────────────────────────────────
function _nmceSnapCelula(xPx, yPx, canvas) {
  const { cols, rows } = _nmceGridDims();
  const cW = canvas.width  / cols;
  const cH = canvas.height / rows;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(xPx / cW)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(yPx / cH)));
  return { col, row };
}

// ── Show snap indicator dot ──────────────────────────────────────────────
function _nmceShowSnapIndicator(snap, canvas) {
  const dot = document.getElementById('nmce-wall-snap');
  if (!dot) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  // Use canvas visual rect for accurate pixel mapping
  const cRect = canvas.getBoundingClientRect();
  const wRect = wrap.getBoundingClientRect();
  const scaleX = cRect.width  / canvas.width;
  const scaleY = cRect.height / canvas.height;
  // Position relative to wrap (which is position:relative)
  const offsetLeft = cRect.left - wRect.left;
  const offsetTop  = cRect.top  - wRect.top;
  dot.style.display = 'block';
  dot.style.left = (offsetLeft + snap.px * scaleX) + 'px';
  dot.style.top  = (offsetTop  + snap.py * scaleY) + 'px';
}

// ── Generate wall segments between two snap points ───────────────────────
function _nmceGerarSegmentos(p1, p2) {
  const segs = [];

  // Case 1: both vertical borders on same column → vertical wall run
  if (p1.tipo === 'v' && p2.tipo === 'v' && p1.col === p2.col) {
    const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
    for (let r = r0; r <= r1; r++) segs.push({ tipo: 'v', col: p1.col, row: r });
    return segs;
  }

  // Case 2: both horizontal borders on same row → horizontal wall run
  if (p1.tipo === 'h' && p2.tipo === 'h' && p1.row === p2.row) {
    const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
    for (let c = c0; c <= c1; c++) segs.push({ tipo: 'h', col: c, row: p1.row });
    return segs;
  }

  // Case 3: mixed or distant → L-shaped path (h-run then v-run)
  // Find shared corner: go horizontally to p2's column, then vertically to p2's row
  const colStart = p1.tipo === 'v' ? p1.col : p1.col;
  const rowStart = p1.tipo === 'h' ? p1.row : p1.row;
  const colEnd   = p2.tipo === 'v' ? p2.col : p2.col;
  const rowEnd   = p2.tipo === 'h' ? p2.row : p2.row;

  // Horizontal leg: same row as p1, from p1.col to p2.col
  if (colStart !== colEnd) {
    const c0 = Math.min(colStart, colEnd), c1 = Math.max(colStart, colEnd);
    for (let c = c0; c < c1; c++) segs.push({ tipo: 'h', col: c, row: rowStart });
  }

  // Vertical leg: same col as p2, from p1.row to p2.row
  if (rowStart !== rowEnd) {
    const r0 = Math.min(rowStart, rowEnd), r1 = Math.max(rowStart, rowEnd);
    for (let r = r0; r < r1; r++) segs.push({ tipo: 'v', col: colEnd, row: r });
  }

  // If nothing generated (same point), add the first point as single segment
  if (segs.length === 0) segs.push(p1);

  return segs;
}

// ── Handle a click in scene mode ─────────────────────────────────────────
function _nmceSceneClick(xPx, yPx, canvas) {
  if (nmCE.tool === 'parede') {
    const snap = _nmceSnapPonto(xPx, yPx, canvas);
    if (!nmCE.wallFirstSnap) {
      nmCE.wallFirstSnap = snap;
      mostrarToast('📍 Borda marcada — clique na borda final', '');
      _nmceShowSnapIndicator(snap, canvas);
      return;
    }
    const p1 = nmCE.wallFirstSnap;
    nmCE.wallFirstSnap = null;
    const dot = document.getElementById('nmce-wall-snap');
    if (dot) dot.style.display = 'none';

    const cor     = document.getElementById('nmce-parede-cor')?.value || document.getElementById('nmce-fs-parede-cor')?.value || '#7ec8f0';
    const largura = parseInt(document.getElementById('nmce-parede-largura')?.value || document.getElementById('nmce-fs-parede-largura')?.value) || 3;

    const segs = _nmceGerarSegmentos(p1, snap);
    segs.forEach(s => {
      nmCE.renderData.paredes.push({
        id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        tipo: s.tipo, col: s.col, row: s.row, cor, largura,
      });
    });
    _nmceRenderWalls(canvas);
    _nmceAtualizarLista();

  } else if (nmCE.tool === 'porta') {
    const { col, row } = _nmceSnapCelula(xPx, yPx, canvas);
    const nome         = document.getElementById('nmce-porta-nome')?.value.trim() || 'Porta';
    const icone        = document.getElementById('nmce-porta-icone')?.value.trim() || '🚪';
    const trancada     = document.getElementById('nmce-porta-trancada')?.checked || false;
    const chave_palavra = trancada ? (document.getElementById('nmce-porta-chave')?.value.trim() || nome) : '';
    nmCE.renderData.portas.push({
      id: 'door_' + Date.now(), col, row, nome, aberta: false,
      trancada, chave_palavra,
      mapa_destino: null, destino_col: 0, destino_row: 0, cor: '#c8a84b', icone,
    });
    _nmceRenderWalls(canvas);
    _nmceAtualizarLista();

  } else if (nmCE.tool === 'objeto') {
    const { col, row } = _nmceSnapCelula(xPx, yPx, canvas);
    const nome  = document.getElementById('nmce-obj-nome')?.value.trim() || 'Obstáculo';
    const icone = document.getElementById('nmce-obj-icone')?.value.trim() || '🪨';
    nmCE.renderData.objetos.push({
      id: 'ob_' + Date.now(), tipo: 'obstaculo', col, row, nome, icone, aberto: false,
    });
    _nmceRenderWalls(canvas);
    _nmceAtualizarLista();
  } else if (nmCE.tool === 'bau') {
    const { col, row } = _nmceSnapCelula(xPx, yPx, canvas);
    const nome         = document.getElementById('nmce-bau-nome')?.value.trim() || 'Baú';
    const trancado     = document.getElementById('nmce-bau-trancado')?.checked || false;
    const chave_palavra = trancado ? (document.getElementById('nmce-bau-chave')?.value.trim() || '') : '';
    const lootTipo     = document.getElementById('nmce-bau-loot')?.value || 'nenhum';
    const loot_ouro    = lootTipo === 'ouro' ? (parseInt(document.getElementById('nmce-bau-ouro')?.value) || 50) : null;
    nmCE.renderData.objetos.push({
      id: 'bau_' + Date.now(), tipo: 'bau', col, row, nome, icone: '📦',
      aberto: false, trancado, chave_palavra,
      loot_tipo: lootTipo, loot_ouro,
    });
    _nmceRenderWalls(canvas);
    _nmceAtualizarLista();
  }
}

// ── Render walls/doors/objects as SVG overlay ────────────────────────────
function _nmceRenderWalls(canvas) {
  const svg = document.getElementById('nmce-walls-svg');
  if (!svg || !canvas) return;
  svg.innerHTML = '';

  // Match SVG coordinate space to canvas internal resolution (800x500)
  svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  const { cols, rows } = _nmceGridDims();
  const W = canvas.width, H = canvas.height;
  const cW = W / cols, cH = H / rows;

  // Paredes
  (nmCE.renderData.paredes || []).forEach((p, i) => {
    let x1, y1, x2, y2;
    if (p.tipo === 'v') { x1 = x2 = p.col * cW; y1 = p.row * cH; y2 = (p.row + 1) * cH; }
    else                { y1 = y2 = p.row * cH; x1 = p.col * cW; x2 = (p.col + 1) * cW; }
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', p.cor || '#7ec8f0');
    line.setAttribute('stroke-width', p.largura || 3);
    line.setAttribute('stroke-linecap', 'round');
    // Click to remove
    line.style.cursor = 'pointer'; line.style.pointerEvents = 'stroke';
    line.addEventListener('click', (e) => { e.stopPropagation(); nmCE.renderData.paredes.splice(i, 1); _nmceRenderWalls(canvas); _nmceAtualizarLista(); });
    svg.appendChild(line);
    // Wider hit area
    const hit = line.cloneNode();
    hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '12');
    hit.style.cursor = 'pointer'; hit.style.pointerEvents = 'stroke';
    hit.addEventListener('click', (e) => { e.stopPropagation(); nmCE.renderData.paredes.splice(i, 1); _nmceRenderWalls(canvas); _nmceAtualizarLista(); });
    svg.appendChild(hit);
  });

  // Portas e objetos
  const renderToken = (cx, cy, emoji, cor, onClick) => {
    const r = Math.min(cW, cH) * 0.35;
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', cx); circ.setAttribute('cy', cy); circ.setAttribute('r', r);
    circ.setAttribute('fill', cor); circ.setAttribute('stroke', 'rgba(255,255,255,0.3)'); circ.setAttribute('stroke-width', '1.5');
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', cx); txt.setAttribute('y', cy + r * 0.38);
    txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', Math.round(r * 1.3));
    txt.textContent = emoji;
    [circ, txt].forEach(el => { 
      el.style.cursor = 'pointer'; 
      el.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        onClick(e);
      }); 
    });
    svg.appendChild(circ); svg.appendChild(txt);
  };

  (nmCE.renderData.portas || []).forEach((p, i) => {
    renderToken((p.col + 0.5) * cW, (p.row + 0.5) * cH, p.icone || '🚪', 'rgba(200,168,75,0.25)',
      (e) => {
        if (e.shiftKey) {
          // Shift+Click = Remover
          nmCE.renderData.portas.splice(i, 1); 
          _nmceRenderWalls(canvas); 
          _nmceAtualizarLista();
        } else {
          // Click normal = Editar
          if (typeof window.editarObjetoCanvas === 'function') {
            window.editarObjetoCanvas('porta', i);
          }
        }
      });
  });

  (nmCE.renderData.objetos || []).forEach((o, i) => {
    const icons = { obstaculo: '🪨', bau: '📦', chave: '🗝' };
    const cors  = { obstaculo: 'rgba(100,80,60,0.35)', bau: 'rgba(200,168,75,0.2)', chave: 'rgba(200,168,75,0.2)' };
    renderToken((o.col + 0.5) * cW, (o.row + 0.5) * cH, icons[o.tipo] || '📦', cors[o.tipo] || 'rgba(80,60,100,0.3)',
      (e) => {
        if (e.shiftKey) {
          // Shift+Click = Remover
          nmCE.renderData.objetos.splice(i, 1); 
          _nmceRenderWalls(canvas); 
          _nmceAtualizarLista();
        } else {
          // Click normal = Editar
          if (typeof window.editarObjetoCanvas === 'function') {
            window.editarObjetoCanvas('objeto', i);
          }
        }
      });
  });
}

// ── Update the scenario list panel ──────────────────────────────────────
function _nmceAtualizarLista() {
  const lista = document.getElementById('nmce-cenario-lista');
  if (!lista) return;
  const rd = nmCE.renderData;
  const total = (rd.paredes?.length || 0) + (rd.portas?.length || 0) + (rd.objetos?.length || 0);
  if (!total) { lista.innerHTML = ''; return; }
  lista.innerHTML = [
    ...(rd.paredes || []).map((p, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 7px;background:rgba(126,200,240,0.06);border:1px solid rgba(126,200,240,0.15);border-radius:5px;font-size:0.65rem;color:var(--suave)">🧱 Parede ${p.tipo} (${p.col},${p.row}) <button onclick="nmCE.renderData.paredes.splice(${i},1);_nmceRenderWalls(document.getElementById('nmce-canvas'));_nmceAtualizarLista()" style="margin-left:auto;background:none;border:none;color:#e74c3c66;cursor:pointer">✕</button></div>`),
    ...(rd.portas  || []).map((p, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 7px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.15);border-radius:5px;font-size:0.65rem;color:var(--suave)">🚪 ${p.nome} (${p.col},${p.row}) <button onclick="nmCE.renderData.portas.splice(${i},1);_nmceRenderWalls(document.getElementById('nmce-canvas'));_nmceAtualizarLista()" style="margin-left:auto;background:none;border:none;color:#e74c3c66;cursor:pointer">✕</button></div>`),
    ...(rd.objetos || []).map((o, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 7px;background:rgba(176,126,240,0.06);border:1px solid rgba(176,126,240,0.15);border-radius:5px;font-size:0.65rem;color:var(--suave)">📦 ${o.nome} (${o.col},${o.row}) <button onclick="nmCE.renderData.objetos.splice(${i},1);_nmceRenderWalls(document.getElementById('nmce-canvas'));_nmceAtualizarLista()" style="margin-left:auto;background:none;border:none;color:#e74c3c66;cursor:pointer">✕</button></div>`),
  ].join('');
}

// ── Clear all walls ──────────────────────────────────────────────────────
function nmceLimparParedes() {
  nmCE.renderData = { paredes: [], portas: [], objetos: [] };
  nmCE.wallFirstSnap = null;
  const dot = document.getElementById('nmce-wall-snap');
  if (dot) dot.style.display = 'none';
  _nmceRenderWalls(document.getElementById('nmce-canvas'));
  _nmceAtualizarLista();
}

// ── Load existing render_data when opening the editor for an existing map ─
function nmceCarregarRenderData(renderData) {
  if (!renderData) return;
  nmCE.renderData = {
    paredes: Array.isArray(renderData.paredes) ? renderData.paredes : [],
    portas:  Array.isArray(renderData.portas)  ? renderData.portas  : [],
    objetos: Array.isArray(renderData.objetos) ? renderData.objetos : [],
  };
  setTimeout(() => {
    _nmceRenderWalls(document.getElementById('nmce-canvas'));
    _nmceAtualizarLista();
  }, 100);
}

// ── Save render_data to the current map being edited ─────────────────────
async function _nmceSalvarRenderData() {
  const mapId = MAPA_STATE?.mapaAtualId;
  if (!mapId) return;
  const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === mapId);
  if (!entry) return;
  if (!entry.mapa.render_data) entry.mapa.render_data = {};
  entry.mapa.render_data.paredes = nmCE.renderData.paredes || [];
  entry.mapa.render_data.portas  = nmCE.renderData.portas  || [];
  entry.mapa.render_data.objetos = nmCE.renderData.objetos || [];
  await salvarRenderData(entry.id, entry.mapa.render_data);
}

window.nmceLimparParedes      = nmceLimparParedes;
window.nmceCarregarRenderData = nmceCarregarRenderData;
// ── Exposição de funções privadas para integração com modal externo ──
window.nmCE = nmCE;
window.nmceCoords = nmceCoords;
window._nmceSnapCelula = _nmceSnapCelula;
window._nmceRenderWalls = _nmceRenderWalls;
window._nmceAtualizarLista = _nmceAtualizarLista;
