// maps/background.js
// RPG Hub — Map background modes (URL/upload/SVG/canvas) and canvas editor
// Includes: nmBgTab(), nmBgGetFinal(), nmceInit(), nmceFullscreenAbrir()


// ── Declarações antecipadas — usadas por supabase.js antes deste arquivo carregar por completo ──
// ATTR_MAPPING_CACHE é referenciado em _carregarProgressivo (supabase.js) na fase0
var ATTR_MAPPING_CACHE__sombreado_19 = window.ATTR_MAPPING_CACHE || {};

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
let _nmUploadDataUrl: any = null;
let _nmSvgDataUrl: any   = null;

function nmBgTab(tab: any) {
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
function nmBgUrlPreview(val: any) {
  const img = document.getElementById('nm-img-preview');
  if (!img) return;
  const url = normalizeImgUrl(val);
  img.src = url || '';
  img.style.display = url ? 'block' : 'none';
}

// — Upload —
async function nmBgUpload(input: any) {
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

function nmBgSvgPreview(val: any) {
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
  history: [] as any[],          // snapshots ImageData para undo
  _snapshot: null as any,      // snapshot no início do shape
  _uploadDataUrl: null as any, // imagem de referência de fundo
  // ── Cenário (paredes/portas/objetos) ──
  wallFirstSnap: null as any,  // primeiro ponto de snap de parede
  renderData: { paredes: [] as any[], portas: [] as any[], objetos: [] as any[] }, // dados do cenário
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

function nmceBgLoad(input: any) {
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

function nmceSetTool(t: any) {
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
  const hints: Record<string, any> = { parede: '🧱 Parede — clique em 2 bordas do grid', porta: '🚪 Porta — clique numa célula', objeto: '🪨 Obstáculo — clique numa célula', bau: '📦 Baú — clique numa célula' };
  if (fsBar) {
    fsBar.style.display = isScene ? 'flex' : 'none';
    const hintEl = document.getElementById('nmce-fs-cenario-hint');
    if (hintEl) hintEl.textContent = hints[t] || '';
  }

  // Show snap indicator only in wall mode
  const snap = document.getElementById('nmce-wall-snap');
  if (snap) snap.style.display = 'none';
}

function nmcePickColor(hex: any) {
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
function nmceCoords(e: any, c: any) {
  const r = c.getBoundingClientRect();
  const scaleX = c.width  / r.width;
  const scaleY = c.height / r.height;
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
}

function nmceDown(e: any) {
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

function nmceMove(e: any) {
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

function nmceUp(e: any) {
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
function nmceTDown(e: any) { e.preventDefault(); nmceDown(e); }
function nmceTMove(e: any) { e.preventDefault(); nmceMove(e); }

// Flood fill (BFS, pixel a pixel)
function nmceFill(ctx: any, startX: any, startY: any, hexColor: any) {
  const c = ctx.canvas;
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const data = imgData.data;
  const idx = (startY * c.width + startX) * 4;
  const tR = data[idx], tG = data[idx+1], tB = data[idx+2], tA = data[idx+3];
  const fill = _nmceHex2rgb(hexColor);
  if (tR===fill[0] && tG===fill[1] && tB===fill[2] && tA===255) return;
  const queue = [[startX, startY]];
  const visited = new Uint8Array(c.width * c.height);
  const match = (i: any) => data[i]===tR && data[i+1]===tG && data[i+2]===tB && data[i+3]===tA;
  const set = (i: any) => { data[i]=fill[0]; data[i+1]=fill[1]; data[i+2]=fill[2]; data[i+3]=255; };
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
function _nmceHex2rgb(hex: any) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [0,0,0];
}


// ══════════════════════════════════════════════════════════════
// ISO GRID HELPER
// Shared between mapaDesenharGrade, mapaRenderCanvas e canvas editor
// Desenha grade de losangos isométricos 2:1 (ratio padrão)
// ══════════════════════════════════════════════════════════════

function _drawIsoGrid(ctx: any, W: any, H: any, grid: any, color: any) {
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

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "_nmBgTab", { configurable: true, get: () => _nmBgTab, set: (__v) => { _nmBgTab = __v; } });
Object.defineProperty(globalThis, "_nmUploadDataUrl", { configurable: true, get: () => _nmUploadDataUrl, set: (__v) => { _nmUploadDataUrl = __v; } });
Object.defineProperty(globalThis, "_nmSvgDataUrl", { configurable: true, get: () => _nmSvgDataUrl, set: (__v) => { _nmSvgDataUrl = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgTab", { configurable: true, get: () => nmBgTab, set: (__v) => { nmBgTab = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgGetFinal", { configurable: true, get: () => nmBgGetFinal, set: (__v) => { nmBgGetFinal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceFullscreenAbrir", { configurable: true, get: () => nmceFullscreenAbrir, set: (__v) => { nmceFullscreenAbrir = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceFullscreenFechar", { configurable: true, get: () => nmceFullscreenFechar, set: (__v) => { nmceFullscreenFechar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceFullscreenConcluir", { configurable: true, get: () => nmceFullscreenConcluir, set: (__v) => { nmceFullscreenConcluir = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceRestaurarCanvas", { configurable: true, get: () => _nmceRestaurarCanvas, set: (__v) => { _nmceRestaurarCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgUrlPreview", { configurable: true, get: () => nmBgUrlPreview, set: (__v) => { nmBgUrlPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgUpload", { configurable: true, get: () => nmBgUpload, set: (__v) => { nmBgUpload = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgClearUpload", { configurable: true, get: () => nmBgClearUpload, set: (__v) => { nmBgClearUpload = __v; } });
Object.defineProperty(globalThis, "_NM_SVG_PROMPT", { configurable: true, get: () => _NM_SVG_PROMPT });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmBgSvgPreview", { configurable: true, get: () => nmBgSvgPreview, set: (__v) => { nmBgSvgPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmCopiarPromptSVG", { configurable: true, get: () => nmCopiarPromptSVG, set: (__v) => { nmCopiarPromptSVG = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmCopiarPromptContextual", { configurable: true, get: () => nmCopiarPromptContextual, set: (__v) => { nmCopiarPromptContextual = __v; } });
Object.defineProperty(globalThis, "nmCE", { configurable: true, get: () => nmCE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceInit", { configurable: true, get: () => nmceInit, set: (__v) => { nmceInit = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceBgRender", { configurable: true, get: () => nmceBgRender, set: (__v) => { nmceBgRender = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceBgLoad", { configurable: true, get: () => nmceBgLoad, set: (__v) => { nmceBgLoad = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceSetTool", { configurable: true, get: () => nmceSetTool, set: (__v) => { nmceSetTool = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmcePickColor", { configurable: true, get: () => nmcePickColor, set: (__v) => { nmcePickColor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmcePushHistory", { configurable: true, get: () => nmcePushHistory, set: (__v) => { nmcePushHistory = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceUndo", { configurable: true, get: () => nmceUndo, set: (__v) => { nmceUndo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceClear", { configurable: true, get: () => nmceClear, set: (__v) => { nmceClear = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceExport", { configurable: true, get: () => nmceExport, set: (__v) => { nmceExport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceCoords", { configurable: true, get: () => nmceCoords, set: (__v) => { nmceCoords = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceDown", { configurable: true, get: () => nmceDown, set: (__v) => { nmceDown = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceMove", { configurable: true, get: () => nmceMove, set: (__v) => { nmceMove = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceUp", { configurable: true, get: () => nmceUp, set: (__v) => { nmceUp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceTDown", { configurable: true, get: () => nmceTDown, set: (__v) => { nmceTDown = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceTMove", { configurable: true, get: () => nmceTMove, set: (__v) => { nmceTMove = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceFill", { configurable: true, get: () => nmceFill, set: (__v) => { nmceFill = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceHex2rgb", { configurable: true, get: () => _nmceHex2rgb, set: (__v) => { _nmceHex2rgb = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_drawIsoGrid", { configurable: true, get: () => _drawIsoGrid, set: (__v) => { _drawIsoGrid = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceUpdateIsoGuide", { configurable: true, get: () => nmceUpdateIsoGuide, set: (__v) => { nmceUpdateIsoGuide = __v; } });
