// systems/catalog.js
// RPG Hub — Item catalog (I1): CRUD, rarities, effects, equip slots
// Includes: CATALOGO_STATE, catalogoCarregar(), catalogoRenderizar(), catalogoSalvarItem()
// Map background moved to: js/maps/background.js
// Character appearance (APMOD) moved to: js/characters/appearance.js
// Attribute mapping moved to: js/systems/attribute-mapping.js

// Guard: ATTR_MAPPING_CACHE referenced by supabase.js before attribute-mapping.js loads
var ATTR_MAPPING_CACHE: any = window.ATTR_MAPPING_CACHE || {};

// Guard: tintOverlayHtml used by maps.js — stub until appearance.js loads
if (typeof tintOverlayHtml === 'undefined') {
  window.tintOverlayHtml = function() { return ''; };
}
if (typeof _limparNotifCreativo === 'undefined') {
  window._limparNotifCreativo = function() {};
}

// ════════════════════════════════════════════════════════════════════════════
// I1 — CATÁLOGO DE ITENS (CRUD)
// ════════════════════════════════════════════════════════════════════════════
const CATALOGO_STATE = {
  itens: [] as any[],
  filtrados: [] as any[],
  itemEditando: null as any,
  bonusLinhas: [] as any[],    // [{ atributo, valor, modo }]
  efeitosLista: [] as any[],   // [{ tipo, gatilho, chance, efeito_aplicado }]
  visualConfig: { tipo_visual:'emoji', valor:'✨', cor_fundo:'#1a1a2e', cor_borda:'#888888', animacao:'none' }
};

const TIPO_DEFAULTS: Record<string, any> = {
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

const RARIDADE_CORES: Record<string, any> = {
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
  } catch (e: any) {
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
function abrirFormItem(id: any) {
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
    document.getElementById('fi-nivel').value = (1) as any;
    document.getElementById('fi-nivel-val').textContent = '1';
    document.getElementById('fi-nivel-min').value = (1) as any;
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
  CATALOGO_STATE.bonusLinhas = Object.entries<any>(bonus).map(([k,v])=>{
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
function abrirEditarItemCatalogo(id: any) {
  // Sincroniza todos os itens de INV para CATALOGO_STATE se necessário
  if (INV.itemDefs && INV.itemDefs.length) {
    INV.itemDefs.forEach((def: any) => {
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

function trocarAbaItem(aba: any) {
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

function setVisualTipo(tipo: any) {
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

async function fiUploadImagem(input: any) {
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

function setAnimacao(anim: any) {
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

function _descreverEfeito(ef: any) {
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

  const bonusObj: Record<string, any> = {};
  for (const l of CATALOGO_STATE.bonusLinhas) {
    if (!l.atributo) continue;
    bonusObj[l.atributo] = l.modo === 'pct' ? { modo:'pct', valor: parseFloat(l.valor)||0 } : parseFloat(l.valor)||0;
  }
  const tradeoffs: Record<string, any> = {};
  for (const [k,v] of Object.entries<any>(bonusObj)) {
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
      const idx = INV.itemDefs.findIndex((d: any) => d.id === savedRow.id);
      if (idx >= 0) INV.itemDefs[idx] = { ...INV.itemDefs[idx], ...savedRow };
      else INV.itemDefs.push(savedRow);
    }
    fecharFormItem();
    carregarCatalogo();
    renderTabelasTab();
  } catch (e: any) {
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
  } catch (e: any) { mostrarToast('Erro ao duplicar: ' + e.message, 'erro'); }
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
  } catch (e: any) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── DAR ITEM A PERSONAGEM ──
let _darItemId: any = null;
function abrirDarItem(itemId: any) {
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
  } catch (e: any) { mostrarToast('Erro: ' + e.message, 'erro'); }
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
async function calcularMediaGrupo(rpgId: any, grupoBase: any) {
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
    const vals = attrNomes.map((n: any) => parseFloat(atribs[n]) || 0);
    const media = vals.reduce((a: any,b: any)=>a+b, 0) / (vals.length || 1);
    return { nome: c.nome, media };
  });
  const mediaGeral = mediasChar.reduce((a,b)=>a+b.media, 0) / (mediasChar.length || 1);
  return { media: Math.round(mediaGeral * 100) / 100, atributos: attrNomes, personagens: mediasChar };
}

// ── ABRIR / FECHAR INVENTÁRIO ─────────────────────────────────────────────
async function abrirInventario(nomeChar: any) {
  // Support both RPG_DATA (main view) and AR.chars (arena view)
  let c = RPG_DATA?.characters?.find(x => x.nome === nomeChar);
  if (!c && typeof AR !== 'undefined' && AR?.chars) {
    c = AR.chars.find((x: any) => x.nome === nomeChar);
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
async function carregarInventarioChar(charId: any) {
  if (!charId) return;
  try {
    // JOIN: inventario → item_catalog
    const data = await sb(
      `inventario?character_id=eq.${charId}&rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&select=*,item:item_catalog_id(*)`
    );
    (INV.inventarios as any)[charId] = data || [];
    (INV.carregado as any)[charId] = true;
    renderInvCompleto();
  } catch(e) {
    console.warn('[I2] Erro ao carregar inventário:', e);
    (INV.inventarios as any)[charId] = [];
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
  const itens  = (INV.inventarios as any)[charId] || [];
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const c = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const charNivel = c?.custom_attrs?.nivel || 1;
  const podeEditar = podeEditarPersonagem(INV.charAtivo);

  let html = '';
  for (const slot of INV_SLOTS) {
    const equipado = itens.find((i: any) => i.equipado && i.slot_equipado === slot.id);
    const amuleto  = itens.find((i: any) => i.equipado && i.slot_equipado === slot.id + '_amuleto');
    html += renderSlotCard(slot, equipado, amuleto, podeEditar, charNivel);
  }
  document.getElementById('inv-slots-grid').innerHTML = html;
}

function renderSlotCard(slot: any, equipado: any, amuleto: any, podeEditar: any, charNivel: any) {
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

function invClicarSlotVazio(slotId: any) {
  // Se há item na mochila compatível, exibir popup para equipar
  const charId = INV.charId;
  const itens  = ((INV.inventarios as any)[charId] || []).filter((i: any) => !i.equipado);
  const compativeis = itens.filter((i: any) => {
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
  const itens    = ((INV.inventarios as any)[charId] || []).filter((i: any) => !i.equipado);
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podeEditar = podeEditarPersonagem(INV.charAtivo);
  const wrapper  = document.getElementById('inv-btn-adicionar-wrap');
  if (wrapper) wrapper.style.display = isMestre ? '' : 'none';

  const el = document.getElementById('inv-mochila-lista');
  if (!itens.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--suave);font-style:italic;font-size:0.85rem">Mochila vazia</div>';
    return;
  }
  el.innerHTML = itens.map((inv: any) => {
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
  const itens  = (INV.inventarios as any)[charId] || [];
  const c = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const ca = c?.custom_attrs || {};

  // Máximo: HP_max / 10 (padrão), ou valor fixo em ca.carga_maxima
  const hp_max = ca.hp_max || 100;
  const cargaMax = ca.carga_maxima || Math.floor(hp_max / 10) || 10;

  // Equipados não contam. Usa campo `peso` do item_catalog quando disponível,
  // senão soma unidades (1 por stack independente de quantidade).
  const naoEquipados = itens.filter((i: any) => !i.equipado);
  const cargaAtual   = naoEquipados.reduce((s: any, i: any) => {
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
  const itensEquipados = ((INV.inventarios as any)[charId] || []).filter((i: any) => i.equipado);

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
    const isAnimadoCat = aparencia.modo === 'animado' && aparencia.animado?.parts && Object.keys(aparencia.animado.parts).length > 0;
    if (composedImgInv && !isAnimadoCat) {
      previewHtml = `
        <div style="display:flex;justify-content:center;margin-bottom:16px">
          <div style="position:relative;width:${tw}px;height:${th}px;background:rgba(0,0,0,0.5);border:1px solid rgba(79,163,209,0.2);border-radius:8px;overflow:hidden">
            <img src="${composedImgInv}" style="width:${tw}px;height:${th}px;object-fit:contain;display:block" crossorigin="anonymous">
          </div>
        </div>`;
    } else {
      const tokenBase = apmodTokenSVG(c, 'local');
      const _eqHtml = (camada: any) => equipVisuais
        .filter((eq: any) => eq.visivel !== false && (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5))
          && (camada === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras'))
        .map((eq: any) => {
          const xP = eq.x != null ? eq.x : 50, yP = eq.y != null ? eq.y : 40;
          const esc = (eq.escala != null ? eq.escala : 100) / 100;
          // Mesma fórmula que _equipOverlayHtml: 35%×45% do container
          const eW = Math.round(0.35 * tw * esc);
          const eH = Math.round(0.45 * th * esc);
          const l = Math.round((xP / 100) * tw - eW / 2);
          const t = Math.round((yP / 100) * th - eH / 2);
          const rot = eq.rotacao || 0;
          const rotH = eq.rotacaoH || 0;
          const _warp = eq.warpCorners ? _aeqComputeMatrix3d(eW, eH, eq.warpCorners.map((c: any)=>({x:c.x*eW,y:c.y*eH}))) : null;
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
      ${itensEquipados.map((inv: any) => {
        const def = INV.itemDefs.find((d: any) => d.id === (inv.item_catalog_id || inv.item_def_id));
        const itData = def || inv.item || {};
        const nome    = itData.nome || inv.item?.nome || '?';
        const icone   = itData.icone || inv.item?.icone || '⚔';
        // Usa mesma lógica do _itemIcon: img_url direto ou visual_config.valor (sistema novo)
        const imgSrc  = _resolveItemImgSrc(def) || _resolveItemImgSrc(inv.item);
        const temVisual = !!imgSrc;
        const posData = equipVisuais.find((ev: any) => ev.item_inv_id === inv.id || ev.nome === nome);
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
  // Montar canvas animado para personagens com aparência animada
  requestAnimationFrame(() => { window._animScheduleTokenMount?.(true); });
}

// Extrai a URL de imagem de um item considerando AMBOS os sistemas de cadastro:
// - Sistema antigo: campo img_url direto
// - Sistema novo (salvarItem): visual_config.valor quando tipo_visual === 'url'
function _resolveItemImgSrc(it: any) {
  if (!it) return '';
  if (it.img_url) return it.img_url;
  const vc = it.visual_config || {};
  if (vc.tipo_visual === 'url' && vc.valor) return vc.valor;
  return '';
}

// Abre o posicionador simplificado (só posição/escala/rotação/camada — sem edição de aparência do item)
function _normalizarSlotParaTipo(slot: any) {
  // Mapear slots do inventário para tipos reconhecidos pelo sistema visual
  const mapa: Record<string, any> = {
    'mao_principal':'mao_principal','mao_secundaria':'mao_secundaria',
    'armadura':'armadura','capacete':'capacete','luvas':'luvas',
    'botas':'botas','amuleto':'amuleto','anel':'anel',
    'cinto':'cinto','capa':'capa','mascara':'mascara'
  };
  return mapa[slot] || 'geral';
}

function invAbrirPosicionarEquip(invId: any) {
  const charId = INV.charId;
  const nomeChar = INV.charAtivo;
  const invItem = ((INV.inventarios as any)[charId] || []).find((i: any) => i.id === invId);
  if (!invItem) return;

  // Resolve dados do item — tenta itemDefs primeiro, depois JOIN (i.item)
  const def = INV.itemDefs.find((d: any) => d.id === (invItem.item_catalog_id || invItem.item_def_id));
  const itData = def || invItem.item || {};
  const nome = itData.nome || invItem.item?.nome || '?';
  // Suporta ambos os sistemas: img_url direto (antigo) ou visual_config.valor (novo)
  const imgSrc = _resolveItemImgSrc(def) || _resolveItemImgSrc(invItem.item) || '';

  const c = RPG_DATA?.characters?.find(x => x.id === charId || x.nome === nomeChar);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const equipVisuais = JSON.parse(JSON.stringify(ca.aparencia?.equipamentos_visuais || []));

  // Localiza ou cria entrada de posicionamento
  let idx = equipVisuais.findIndex((ev: any) => ev.item_inv_id === invId || ev.nome === nome);
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
  const novaAparencia = { ...(ca.aparencia || {}), equipamentos_visuais: equipVisuais, composed_img: null as any };
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
function invClicarItem(invId: any) {
  const charId = INV.charId;
  const inv = ((INV.inventarios as any)[charId] || []).find((i: any) => i.id === invId);
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

  const bonusPositivos = Object.entries<any>(bonus).filter(([k,v])=>(typeof v==='object'?v.valor:v)>=0);
  const bonusNegativos = Object.entries<any>(bonus).filter(([k,v])=>(typeof v==='object'?v.valor:v)<0);

  const bonusHtml = [
    ...bonusPositivos.map(([k,v])=>{
      const n=typeof v==='object'?v.valor:v; const suf=typeof v==='object'&&v.modo==='pct'?'%':'';
      return `<div style="color:#4eca7e">↑ +${n}${suf} ${k}</div>`;
    }),
    ...bonusNegativos.map(([k,v])=>{
      const n=typeof v==='object'?v.valor:v; const suf=typeof v==='object'&&v.modo==='pct'?'%':'';
      return `<div style="color:#e05040">↓ ${n}${suf} ${k} ⚠️</div>`;
    }),
    ...efeitos.map((ef: any)=>`<div style="color:#a070d8;font-size:0.72rem">${_descreverEfeito(ef)}</div>`)
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
async function invEquipar(invId: any) {
  const charId = INV.charId;
  const inv = ((INV.inventarios as any)[charId] || []).find((i: any) => i.id === invId);
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
    const avisos = Object.entries<any>(tradeoffs).map(([k,v])=>{
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
    const slotPrincipalOcupado = ((INV.inventarios as any)[charId] || []).find((i: any) => i.equipado && i.slot_equipado === slotAlvo);
    if (slotPrincipalOcupado) {
      // Verificar se o item principal aceita amuleto aninhado
      const itemPrincipal = slotPrincipalOcupado.item || {};
      if (itemPrincipal.aceita_amuleto_aninhado !== false) {
        slotAlvo = slotAlvo + '_amuleto';
      }
    }
  }

  const slotOcupado = ((INV.inventarios as any)[charId] || []).find((i: any) => i.equipado && i.slot_equipado === slotAlvo);
  if (slotOcupado) {
    const nomeAtual = slotOcupado.item?.nome || 'item atual';
    if (!confirm(`O slot já contém "${nomeAtual}". Substituir?`)) return;
    await invDesequipar(slotOcupado.id, true); // silencioso
  }

  // [5] Aplicar atributos_bonus
  const ca = { ...(c.custom_attrs || {}) };
  ca.atributos = { ...(ca.atributos || {}) };
  const bonus = it.atributos_bonus || {};
  const snapshot: Record<string, any> = {};

  for (const [attr, val] of Object.entries<any>(bonus)) {
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
    const idx = (INV.inventarios as any)[charId].findIndex((i: any) => i.id === invId);
    if (idx >= 0) {
      (INV.inventarios as any)[charId][idx].equipado = true;
      (INV.inventarios as any)[charId][idx].slot_equipado = slotAlvo;
      (INV.inventarios as any)[charId][idx].bonus_snapshot = snapshot;
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
async function invDesequipar(invId: any, silencioso = false) {
  const charId = INV.charId;
  const inv = ((INV.inventarios as any)[charId] || []).find((i: any) => i.id === invId);
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
    for (const [attr, val] of Object.entries<any>(bonus)) {
      const n = typeof val === 'object' ? val.valor : parseFloat(val) || 0;
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - n;
    }
  } else {
    for (const [attr, delta] of Object.entries<any>(fonte)) {
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
    const idx = (INV.inventarios as any)[charId].findIndex((i: any) => i.id === invId);
    if (idx >= 0) {
      (INV.inventarios as any)[charId][idx].equipado = false;
      (INV.inventarios as any)[charId][idx].slot_equipado = null;
      (INV.inventarios as any)[charId][idx].bonus_snapshot = null;
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
async function invRemoverItem(invId: any) {
  const charId = INV.charId;
  const inv = ((INV.inventarios as any)[charId] || []).find((i: any) => i.id === invId);
  if (!inv) return;
  if (inv.equipado) { await invDesequipar(invId, true); }
  if (!confirm(`Remover "${inv.item?.nome}" do inventário?`)) return;
  try {
    await sb(`inventario?id=eq.${invId}`, { method: 'DELETE', headers:{'Prefer':'return=minimal'} });
    (INV.inventarios as any)[charId] = (INV.inventarios as any)[charId].filter((i: any) => i.id !== invId);
    document.getElementById('modal-inv-item-overlay').style.display = 'none';
    mostrarToast('Item removido', '');
    renderInvCompleto();
  } catch (e: any) { mostrarToast('Erro: ' + e.message, 'erro'); }
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
  } catch (e: any) {
    document.getElementById('add-inv-lista').innerHTML = `<div style="color:var(--perigo);padding:20px">${e.message}</div>`;
  }
}

function filtrarAddInv() {
  const busca = (document.getElementById('add-inv-busca')?.value||'').toLowerCase();
  const itens = INV.catalogo.filter((it: any) => !busca || it.nome.toLowerCase().includes(busca));
  const c = RPG_DATA?.characters?.find(x=>x.nome===INV.charAtivo);
  const charNivel = c?.custom_attrs?.nivel || 1;
  document.getElementById('add-inv-lista').innerHTML = itens.slice(0, 50).map((it: any) => {
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

async function addInvConfirmar(catalogId: any) {
  const charId  = INV.charId;
  const c       = RPG_DATA?.characters?.find(x=>x.id===charId||x.nome===INV.charAtivo);
  const it      = INV.catalogo.find((x: any)=>x.id===catalogId);
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
  } catch (e: any) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

// ── I4 — VERIFICAR DESBLOQUEIO DE ITENS AO SUBIR NÍVEL ──────────────────
async function verificarDesbloqueioItens(nomeChar: any, novoNivel: any) {
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
    ).catch((): any[] => []) || [];

    // Denominações configuradas ou padrão
    const denoms = CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;

    let html = `<div style="margin-bottom:10px;font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">💰 Bolsa de ${INV.charAtivo}</div>`;

    for (const denom of denoms) {
      const entrada = bolsa.find((b: any) => b.denominacao === denom.nome);
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
    ).catch((): any[] => []) || [];

    if (log.length) {
      html += `<div style="margin:14px 0 8px;font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em">📋 Histórico recente</div>`;
      html += log.map((tx: any)=>{
        const sinal = tx.dono_id === charId ? (tx.tipo==='receber'?'+':'-') : '+';
        const cor = sinal==='+' ? '#4eca7e' : '#e05040';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.75rem">
          <div style="color:var(--suave)">${tx.descricao||tx.tipo} · ${tx.denominacao}</div>
          <div style="color:${cor};font-family:var(--fonte-d)">${sinal}${tx.quantidade}</div>
        </div>`;
      }).join('');
    }

    el.innerHTML = html;
  } catch (e: any) {
    el.innerHTML = `<div style="color:var(--perigo);padding:20px">${e.message}</div>`;
  }
}

function invTrocarAba(aba: any) {
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

function abrirTxMoeda(tipo: any, denomDefault: any) {
  _criarModalMoedaTxSeNecessario();
  const overlay = document.getElementById('modal-moeda-tx-overlay');
  document.getElementById('moeda-tx-tipo').value  = tipo;
  const titulos: Record<string, any> = { dar:'＋ Adicionar Moedas', remover:'− Remover Moedas', transferir:'→ Transferir Moedas' };
  document.getElementById('moeda-tx-titulo').textContent = titulos[tipo] || tipo;
  const denoms = CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;
  const sel = document.getElementById('moeda-tx-denom');
  sel.innerHTML = denoms.map((d: any)=>`<option value="${d.nome}" ${d.nome===denomDefault?'selected':''}>${d.emoji} ${d.nome}</option>`).join('');
  document.getElementById('moeda-tx-qtd').value = (1) as any;
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
      ).catch((): any[] => []);
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
  } catch (e: any) { mostrarToast('Erro: ' + e.message, 'erro'); }
}

async function _moedaUpsert(charId: any, denominacao: any, delta: any) {
  // Buscar registro atual
  const atual = await sb(
    `moedas?rpg_id=eq.${encodeURIComponent(CURRENT_RPG.id)}&dono_id=eq.${charId}&denominacao=eq.${encodeURIComponent(denominacao)}&select=id,quantidade`
  ).catch((): any => null);
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

async function _moedaLog(donoId: any, destinoId: any, denominacao: any, quantidade: any, tipo: any, descricao: any) {
  try {
    await sb('log_transacoes', { method:'POST', body: JSON.stringify({
      rpg_id: CURRENT_RPG.id, dono_id: donoId, destino_id: destinoId||null,
      denominacao, quantidade, tipo, descricao: descricao||null
    }), headers:{'Prefer':'return=minimal'} });
  } catch(e) { console.warn('[I6] Log de transação falhou:', e); }
}

// ── CFG-MOEDAS — Configuração de denominações (Mestre) ───────
// Estado local para o editor de moedas
let _cfgMoedasTemp: any = [];

function cfgMoedasRender() {
  const el = document.getElementById('cfg-moedas-lista');
  if (!el) return;
  const denoms = _cfgMoedasTemp;
  if (!denoms.length) {
    el.innerHTML = '<div style="font-size:0.75rem;color:var(--suave);font-style:italic;padding:8px 0">Nenhuma denominação. Adicione uma abaixo.</div>';
    return;
  }
  el.innerHTML = denoms.map((d: any, i: any) => `
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

function _cfgMoedasRemover(i: any) {
  _cfgMoedasTemp.splice(i, 1);
  cfgMoedasRender();
}

function _cfgMoedasMover(i: any, dir: any) {
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
  const validas = _cfgMoedasTemp.filter((d: any) => d.nome?.trim());
  if (!validas.length) { mostrarToast('Adicione pelo menos uma moeda', 'aviso'); return; }
  // Garantir cor padrão
  validas.forEach((d: any) => { if (!d.cor) d.cor = '#c8a84b'; });
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
  } catch (e: any) { mostrarToast('Erro ao salvar: ' + (e.message||''), 'erro'); }
}

// ── BROADCAST HELPER ─────────────────────────────────────────────────────
function _invBroadcastDrop(it: any, personagemDestino: any, origem: any) {
  try {
    const ws = (window as any).ws;   // nunca foi definido — broadcast é no-op desde sempre (antes: ReferenceError engolido pelo try)
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
function _itemIcon(it: any) {
  if (!it) return '📦';
  const vc = it.visual_config || {};
  // Support img_url directly on item def (new field)
  if (it.img_url) return `<img src="${it.img_url}" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.style.display='none'">`;
  if (vc.tipo_visual === 'url' && vc.valor) return `<img src="${vc.valor}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">`;
  if (vc.tipo_visual === 'emoji' && vc.valor) return vc.valor;
  return TIPO_DEFAULTS?.[it.tipo_canonico]?.emoji || it.icone || '📦';
}

// Expor emitirEvento globalmente para Parte 1 (dar item broadcast)
window.emitirEvento = function(evento: any, dados: any) { _invBroadcastDrop(dados.item||{}, dados.personagem_destino, dados.origem||evento); };

// Realtime: receber item_dropado de outros jogadores
document.addEventListener('DOMContentLoaded', () => {
  // Patch no receptor de websocket para item_dropado
  const _origOnMsg = window._wsOnMsg;
  // Injetado via listener no ws após carregamento
});

// Hook no ws message handler para item_dropado
const _origWsHandler = window.wsHandler;
function _patchWsItemDropado(payload: any) {
  if (payload?.event !== 'item_dropado') return;
  const data = payload.payload || payload;
  const it = data.item || {};
  const rc = RARIDADE_CORES[it.raridade] || RARIDADE_CORES.comum;
  const dur = ({ comum:4000, incomum:4000, raro:6000, epico:8000, lendario:12000 } as any)[it.raridade] || 5000;
  const icon = _itemIcon(it);
  const corBorda = it.visual_config?.cor_borda || rc.borda;
  const corFundo = it.visual_config?.cor_fundo || rc.fundo;
  const animCls = it.raridade==='epico'?'anim-glow':it.raridade==='lendario'?'anim-shimmer':'';
  const bonusHtml = Object.entries<any>(it.atributos_bonus||{}).map(([k,v])=>{
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
  const ws = (window as any).ws;   // nunca foi global — o monkey-patch fica dormente (comportamento atual)
  if (ws) {
    const originalOnMessage = ws.onmessage;
    ws.onmessage = function(e: any) {
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
const VOCAB_FALLBACK: Record<string, any> = {
  prefixo_material: ['Ferro','Aço','Mithril','Obsidiana','Osso','Couro','Prata','Cristal','Rúnico','Bronze','Pedra','Seda'],
  adjetivo_qualidade: ['Afiado','Forjado','Sombrio','Encantado','Antigo','Corrompido','Sagrado','Maldito','Purificado','Bendito','Lendário','Esquecido','Eterno','Veloz','Pesado'],
  nome_origem: ['da Forja Esquecida','do Rei Traído','das Sombras Eternas','da Ordem Caída','do Dragão Ancestral','das Ruínas Antigas','do Abismo','da Luz Dourada','dos Guerreiros Perdidos','do Templo Proibido']
};

// Cache de vocabulário por rpgId
const _vocabCache: Record<string, any> = {};

async function carregarVocabulario(rpgId: any) {
  if (_vocabCache[rpgId]) return _vocabCache[rpgId];
  try {
    const rows = await sb(`vocabulario_tematico?rpg_id=eq.${encodeURIComponent(rpgId)}&select=tipo,valor`);
    const vocab: Record<string, any> = { prefixo_material: [], adjetivo_qualidade: [], nome_origem: [] };
    (rows||[]).forEach((r: any) => {
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
const NOMES_BASE_TIPO: Record<string, any> = {
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
async function _gerarPartesNome(rpgId: any, tipo: any, subtipo: any, raridade: any) {
  const vocab = await carregarVocabulario(rpgId||RPG_DATA?.rpgId||'');
  const rand = (arr: any) => arr[Math.floor(Math.random()*arr.length)];

  const nomeBase = NOMES_BASE_TIPO[tipo]?.[subtipo] || NOMES_BASE_TIPO[tipo]?.default || 'Item';
  const material = rand(vocab.prefixo_material);
  const adjetivo = rand(vocab.adjetivo_qualidade);
  // Raro+: 60% de chance de nome de origem
  const raresIds = ['raro','epico','lendario'];
  const temOrigem = raresIds.includes(raridade) && Math.random() < 0.60;
  const origem = temOrigem ? rand(vocab.nome_origem) : '';

  return { nomeBase, material, adjetivo, origem };
}

function _montarNomeGerado(nomeBase: any, material: any, adjetivo: any, origem: any) {
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
async function gerarNomeItem(rpgId: any, tipo: any, subtipo: any, raridade: any) {
  const partes = await _gerarPartesNome(rpgId, tipo, subtipo, raridade);
  return _montarNomeGerado(partes.nomeBase, partes.material, partes.adjetivo, partes.origem);
}


// ─────────────────────────────────────────────────────────────────
// I8 — GERAÇÃO AUTOMÁTICA DE STATUS DO ITEM
// ─────────────────────────────────────────────────────────────────

// Fatores de escala por tier e raridade
const _FATOR_ESCALA: Record<string, any> = {
  1: { comum:0.05 },
  2: { comum:0.08, incomum:0.12 },
  3: { comum:0.10, incomum:0.16, raro:0.22 },
  4: { comum:0.12, incomum:0.18, raro:0.25, epico:0.32 },
  5: { raro:0.28, epico:0.35, lendario:0.45 }
};

// Cor de borda por raridade
const _BORDA_RARIDADE: Record<string, any> = {
  comum:'#888888', incomum:'#2ecc71', raro:'#3498db', epico:'#9b59b6', lendario:'#f39c12'
};

// Animação automática por raridade
const _ANIMACAO_RARIDADE: Record<string, any> = {
  comum:'none', incomum:'none', raro:'none', epico:'glow', lendario:'shimmer'
};

// Efeitos compatíveis por tipo canônico
const _EFEITOS_TIPO: Record<string, any> = {
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
const _CHANCE_EFEITO: Record<string, any> = { comum:0.05, incomum:0.175, raro:0.50, epico:0.775, lendario:1.0 };

/*
  gerarStatusItem(rpgId, tipoCanônico, grupoAtributo, tierInimigo, raridade, slotFuncional, personagemAlvo?)
  Retorna: { atributos_bonus, trade_offs, efeitos, nivel, visual_config, params_geracao }
*/
async function gerarStatusItem(rpgId: any, tipoCanônico: any, grupoAtributo: any, tierInimigo: any, raridade: any, slotFuncional: any, personagemAlvo: any) {
  const tier = Math.min(5, Math.max(1, parseInt(tierInimigo)||1));
  const fatorObj = _FATOR_ESCALA[tier] || {};
  const fator = fatorObj[raridade];
  if (fator === undefined) {
    // Combinação inválida tier/raridade
    return { atributos_bonus:{}, trade_offs:{}, efeitos:[] as any[], nivel:tier, visual_config:{}, params_geracao:{aviso:'Combinação tier/raridade inválida'} };
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
          const bonusAtual = Object.values<any>(itemAtual[0].atributos_bonus||{}).reduce((s,v)=>s+Math.abs(typeof v==='object'?v.valor:v),0) || 0;
          const maxPermitido = Math.floor(bonusAtual * (1.10 + Math.random() * 0.15));
          if (maxPermitido > 0) bonusBase = Math.min(bonusBase, maxPermitido);
        }
      }
    } catch(e) {}
  }

  // PASSO 3: Bônus secundário misto (Incomum+)
  const atributosBonus: Record<string, any> = {};
  const raresIds = ['incomum','raro','epico','lendario'];
  let grupoAtributoNome = grupoAtributo;
  // Usar primeiro atributo do grupo como nome display
  try {
    const mapa = await carregarMapeamento(rpgId);
    const atrsDoGrupo = mapa.filter((m: any)=>m.grupo_base===grupoAtributo);
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
      const atrsGrupoSec = mapa.filter((m: any)=>m.grupo_base===grupoSec);
      if (atrsGrupoSec.length) grupoSecNome = atrsGrupoSec[Math.floor(Math.random()*atrsGrupoSec.length)].nome_customizado;
    } catch(e) {}
    atributosBonus[grupoSecNome] = bonusSec;
  }

  // PASSO 4: Trade-off (penalidade)
  const tradeOffs: Record<string, any> = {};
  const temTradeOff = ['raro','epico','lendario'].includes(raridade) && bonusBase > mediaGrupo * 0.25 && Math.random() < 0.30;
  if (temTradeOff) {
    const gruposAll = ['forca','destreza','constituicao','inteligencia'].filter(g=>g!==grupoAtributo);
    const grupoPen = gruposAll[Math.floor(Math.random()*gruposAll.length)];
    const penalidade = Math.max(1, Math.floor(bonusBase * (0.20 + Math.random() * 0.20)));
    let grupoPenNome = grupoPen;
    try {
      const mapa = await carregarMapeamento(rpgId);
      const atrsPen = mapa.filter((m: any)=>m.grupo_base===grupoPen);
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
  const EMOJI_TIPO: Record<string, any> = { arma:'⚔️', escudo:'🛡️', armadura:'🥋', calcas:'👖', amuleto:'💎', capacete:'⛑️', botas:'👢', capa:'🧣', consumivel:'🧪', customizado:'✨' };

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
const _DROP_QTDE: Record<string, any> = {
  1: { minItens:0, maxItens:0, chanceItem:0.15, raridadesPossiveis:['comum'] },
  2: { minItens:0, maxItens:1, chanceItem:0.35, raridadesPossiveis:['comum','incomum'] },
  3: { minItens:0, maxItens:1, chanceItem:0.55, raridadesPossiveis:['comum','incomum','raro'] },
  4: { minItens:1, maxItens:2, chanceItem:0.80, raridadesPossiveis:['incomum','raro','epico'] },
  5: { minItens:1, maxItens:3, chanceItem:1.00, raridadesPossiveis:['raro','epico','lendario'] }
};

const _PESO_RARIDADE_TIER: Record<string, any> = {
  2: { comum:0.80, incomum:0.20 },
  3: { comum:0.55, incomum:0.35, raro:0.10 },
  4: { incomum:0.50, raro:0.35, epico:0.15 },
  5: { raro:0.55, epico:0.35, lendario:0.10 }
};

function _sortearRaridade(tier: any) {
  const pesos = _PESO_RARIDADE_TIER[tier] || { comum:1 };
  const total = Object.values<any>(pesos).reduce((a,b)=>a+b,0);
  let rng = Math.random() * total;
  for (const [rar, peso] of Object.entries<any>(pesos)) {
    rng -= peso;
    if (rng <= 0) return rar;
  }
  return Object.keys(pesos)[0];
}

// Chance de drop acima do nível
const _CHANCE_NIVEL_ACIMA: Record<string, any> = { comum:0.03, incomum:0.06, raro:0.10, epico:0.15, lendario:0.25 };
const _MAX_NIVEL_ACIMA: Record<string, any> = { comum:1, incomum:2, raro:2, epico:3, lendario:3 };

function _calcularNivelItem(tier: any, raridade: any, npcNivel: any) {
  const nivelBase = npcNivel || tier;
  const chanceAcima = _CHANCE_NIVEL_ACIMA[raridade] || 0;
  if (Math.random() < chanceAcima) {
    const max = _MAX_NIVEL_ACIMA[raridade] || 1;
    return nivelBase + Math.floor(1 + Math.random() * max);
  }
  return nivelBase;
}

// calcularDrops: retorna lista de specs de itens a dropar
async function calcularDrops(rpgId: any, npcTier: any, npcNivel: any, npcGrupoAtributo: any) {
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
    const SLOT_TIPO: Record<string, any> = { arma:'arma_principal', escudo:'arma_secundaria', armadura:'corpo', calcas:'pernas', amuleto:'acessorio', capacete:'cabeca', botas:'pes', capa:'capa' };
    const slot = SLOT_TIPO[tipo] || 'acessorio';

    drops.push({ tipo, raridade, grupoAtributo, slot, nivel });
  }

  return drops;
}

// Executar drop: gera itens, insere no banco, cria loot_pendente, broadcast, atualiza token
async function _executarDropNPC(rpgId: any, npcNome: any, npcChar: any) {
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
        personagem_destino: null as any,
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
window._patchTokenLoot = function(c: any, tokenEl: any) {
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
      lootBadge.onclick = (e: any) => { e.stopPropagation(); abrirModalLootNPC(c.nome); };
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
function _renderItemCard(it: any, opts: any = {}) {
  // it: item_catalog ou instância com joins
  const rc = RARIDADE_CORES?.[it.raridade] || { borda:'#888', fundo:'#141d2b', badge:'cat-item-badge', label: it.raridade||'comum' };
  const vc = it.visual_config || {};
  const corBorda = vc.cor_borda || rc.borda;
  const corFundo = vc.cor_fundo || rc.fundo || '#141d2b';
  const icon = _itemIcon(it);
  const animCls = vc.animacao && vc.animacao !== 'none' ? `anim-${vc.animacao}` : '';

  // Bônus
  const bonus = Object.entries<any>(it.atributos_bonus || {});
  const tradeoffs = Object.entries<any>(it.trade_offs || {});
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
  const efeitos = (it.efeitos||[]).slice(0,2).map((ef: any)=>{
    if (ef.tipo==='proc') return `<div style="font-size:0.58rem;color:#7ec8f0">${Math.round((ef.chance||0)*100)}% ${ef.gatilho?.replace(/_/g,' ')||''}</div>`;
    if (ef.tipo==='aura') return `<div style="font-size:0.58rem;color:#a77fdb">Aura: +${ef.valor||''}</div>`;
    return '';
  }).join('');

  const bloqueado = it.bloqueado_por_nivel;
  const nivel = it.nivel || it.nivel_minimo_uso || 1;

  const selStyle = (opts as any).selecionado ? `box-shadow:0 0 0 2px #4eca7e;` : '';
  const clique = opts.onclick ? `onclick="${(opts as any).onclick}"` : '';
  const botaoAcao = opts.botaoLabel ? `<button onclick="${opts.botaoFn}" style="width:100%;margin-top:6px;padding:6px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;letter-spacing:0.06em">${(opts as any).botaoLabel}</button>` : '';

  return `
    <div class="${animCls}" ${clique} style="background:${corFundo};border:2px solid ${corBorda};border-radius:10px;padding:10px;cursor:${(opts as any).onclick?'pointer':'default'};transition:box-shadow 0.15s;${selStyle}position:relative">
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
const LOOT_STATE = { npcNome: null as any, itens: [] as any[], selecionados: new Set() };

window.abrirModalLootNPC = async function(npcNome: any) {
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
  const ids = loots.map((l: any)=>l.item_id).filter(Boolean);
  let itens = [];
  if (ids.length) {
    try { itens = await sb(`item_catalog?id=in.(${ids.join(',')})&select=*`); } catch(e) {}
  }

  LOOT_STATE.itens = itens.map((it: any, i: any) => ({ ...it, loot_id: loots[i]?.id }));

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

window.toggleLootSel = function(i: any) {
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
  const itens = [...LOOT_STATE.selecionados].map((i: any) => LOOT_STATE.itens[i]);

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
    delete (INV.carregado as any)[charId];
  }
  fecharModalLoot();
};

window.fecharModalLoot = function() {
  document.getElementById('modal-loot-overlay').style.display = 'none';
};


// ─────────────────────────────────────────────────────────────
// I11 — INVENTÁRIO COMPARTILHADO (Baú do Grupo)
// ─────────────────────────────────────────────────────────────
const BAU_STATE = { itens: [] as any[], carregado: false };

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

  } catch (e: any) {
    el.innerHTML = `<div style="color:var(--perigo);padding:16px">Erro ao carregar baú: ${e.message}</div>`;
  }
}

function renderBauDepositarLista() {
  const el = document.getElementById('bau-depositar-lista');
  if (!el) return;
  const charId = INV.charId;
  const mochila = ((INV.inventarios as any)[charId]||[]).filter((inst: any)=>!inst.equipado);
  if (!mochila.length) { el.innerHTML = `<div style="color:var(--suave);font-size:0.8rem;font-style:italic">Mochila vazia</div>`; return; }
  el.innerHTML = mochila.map((inst: any)=>{
    const it = inst.item_catalog || inst;
    return _renderItemCard(it, {
      botaoLabel: '⬆ Depositar',
      botaoFn: `bauDepositarItem('${inst.id}')`
    });
  }).join('');
}

window.bauDepositarItem = async function(instId: any) {
  const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
  try {
    // Transferir dono para "grupo"
    await sb(`inventario?id=eq.${instId}`, {
      method: 'PATCH',
      body: JSON.stringify({ personagem_nome: 'grupo', character_id: null, equipado: false, slot_equipado: null })
    });
    // Broadcast
    const inst = ((INV.inventarios as any)[INV.charId]||[]).find((i: any)=>i.id===instId);
    if (inst) {
      const it = inst.item_catalog || inst;
      try { _invBroadcastDrop(it, 'Baú do Grupo', 'deposito'); } catch(e) {}
      mostrarToast(`⬆ ${it.nome} depositado no baú`, 'ok');
    }
    // Atualizar caches
    if (INV.charId) { delete (INV.carregado as any)[INV.charId]; }
    BAU_STATE.carregado = false;
    await renderInvBau();
  } catch (e: any) { mostrarToast('Erro ao depositar: ' + e.message, 'erro'); }
};

window.bauRetirarItem = async function(instId: any) {
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
    if (charId) delete (INV.carregado as any)[charId];
    await renderInvBau();
  } catch (e: any) { mostrarToast('Erro ao retirar: ' + e.message, 'erro'); }
};


// ─────────────────────────────────────────────────────────────
// I12 — TRADE ENTRE JOGADORES
// ─────────────────────────────────────────────────────────────
const TRADE_STATE = {
  remetente: null as any, remetenteId: null as any,
  destinatario: null as any, destinatarioId: null as any,
  itens_selecionados: new Set(), // ids de inst. inventário
  proposta_pendente: null as any // proposta recebida
};

async function abrirModalTrade(charNome: any, charId: any) {
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
  let mochila = ((INV.inventarios as any)[charId]||[]).filter((i: any)=>!i.equipado);
  if (!mochila.length && charId) {
    try {
      const rows = await sb(`inventario?rpg_id=eq.${encodeURIComponent(RPG_DATA?.rpgId||CURRENT_RPG?.id)}&character_id=eq.${charId}&equipado=eq.false&select=*,item_catalog(*)`);
      mochila = rows || [];
    } catch(e) {}
  }

  const grid = document.getElementById('trade-oferta-grid');
  grid.innerHTML = mochila.map((inst: any)=>{
    const it = inst.item_catalog || inst;
    return _renderItemCard(it, { onclick:`toggleTradeSel('${inst.id}')`, selecionado: false });
  }).join('') || `<div style="color:var(--suave);font-size:0.82rem;font-style:italic">Mochila vazia</div>`;

  document.getElementById('trade-proposta-recebida').style.display = 'none';
  document.getElementById('modal-trade-overlay').style.display = 'flex';
}

window.toggleTradeSel = function(instId: any) {
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
  } catch (e: any) { mostrarToast('Erro ao enviar proposta: ' + e.message.replace(/^.*:\s*/, '') , 'erro'); }
};

window.responderTrade = async function(acao: any) {
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
      const rows = await sb(`inventario?id=eq.${instId}&select=*,item_catalog(*)`).catch((): any[] => []);
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

function _broadcastTradeEvento(evento: any, dados: any) {
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
function adicionarBotaoTrade(charNome: any, charId: any) {
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
const MOBILE_CTRL: any = {
  ativo: false,
  modoPet: false,     // 3.8: alternância personagem/pet
  petNome: null,      // nome do pet vinculado ao jogador
  modoTela: 'tv',    // 'tv' | 'dispositivo'
  _joystickEl: null,
  _joystickAtivo: false,
  _joystickOrigemX: 0,
  _joystickOrigemY: 0,
  _joystickMoveTimer: null,
  _tradeBadgeEl: null, // 3.9
  skillsRecolhidas: (() => { try { return localStorage.getItem('mc_skills_recolhidas') === '1'; } catch (_) { return false; } })(),
  modoCamara: (() => { try { return localStorage.getItem('mc_modo_camera') || 'deadzone'; } catch (_) { return 'deadzone'; } })(),
  autoAlvo: (() => { try { return localStorage.getItem('mc_auto_alvo') === '1'; } catch (_) { return false; } })(),
  autoAlvoPrefMenorHP: (() => { try { return localStorage.getItem('mc_auto_alvo_pref') === 'menor_hp'; } catch (_) { return false; } })(),
  skillRodaOffset: 0,   // índice de rotação atual do anel de skills
  _skillRodaTotal: 1,   // cache do total de skills para wrap correto
};

function _avtCtrlToggleSkills() {
  MOBILE_CTRL.skillsRecolhidas = !MOBILE_CTRL.skillsRecolhidas;
  try { localStorage.setItem('mc_skills_recolhidas', MOBILE_CTRL.skillsRecolhidas ? '1' : '0'); } catch (_) {}
  if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtCtrlToggleSkills = _avtCtrlToggleSkills;

// ── Anel de skills (modo recolhido) ─────────────────────────────────────────

function _mcSkillsOrdenados(skillItems: any) {
  // Skills sem cooldown primeiro (em ordem numérica), depois as em cooldown
  return [
    ...skillItems.filter((s: any) => s.cd === 0),
    ...skillItems.filter((s: any) => s.cd > 0),
  ];
}

function _avtCtrlRolarSkillDireita() {
  const total = MOBILE_CTRL._skillRodaTotal || 1;
  MOBILE_CTRL.skillRodaOffset = ((MOBILE_CTRL.skillRodaOffset + 1) % total + total) % total;
  if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtCtrlRolarSkillDireita = _avtCtrlRolarSkillDireita;

function _avtCtrlRolarSkillEsquerda() {
  const total = MOBILE_CTRL._skillRodaTotal || 1;
  MOBILE_CTRL.skillRodaOffset = ((MOBILE_CTRL.skillRodaOffset - 1 + total) % total);
  if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtCtrlRolarSkillEsquerda = _avtCtrlRolarSkillEsquerda;

// Posições absolutas pré-calculadas dos 5 slots do arco (270° → 180°, R=125, centro=(138,138))
// R aumentado para dar mais espaço entre botões; overflow visible acomoda valores negativos
const _ARC_SLOTS = [
  { top: -9,  left: 116 }, // slot 0: Norte
  { top: 1,   left: 68  }, // slot 1: Skill 1
  { top: 28,  left: 28  }, // slot 2: Skill 2
  { top: 68,  left: 1   }, // slot 3: Skill 3
  { top: 116, left: -9  }, // slot 4: Oeste
];

function _avtCtrlToggleAutoAlvo() {
  MOBILE_CTRL.autoAlvo = !MOBILE_CTRL.autoAlvo;
  try { localStorage.setItem('mc_auto_alvo', MOBILE_CTRL.autoAlvo ? '1' : '0'); } catch (_) {}
  if (MOBILE_CTRL.autoAlvo) _avtCtrlAplicarAutoAlvo();
  else if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtCtrlToggleAutoAlvo = _avtCtrlToggleAutoAlvo;

function _getUltSkillId(charKey: any) {
  try { return localStorage.getItem('mc_ult_' + charKey) || null; } catch (_) { return null; }
}
function _setUltSkillId(charKey: any, skillId: any) {
  try {
    const cur = localStorage.getItem('mc_ult_' + charKey);
    if (cur === skillId) localStorage.removeItem('mc_ult_' + charKey);
    else localStorage.setItem('mc_ult_' + charKey, skillId);
  } catch (_) {}
  if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._getUltSkillId = _getUltSkillId;
window._setUltSkillId = _setUltSkillId;

function _avtCtrlToggleAutoAlvoPref() {
  MOBILE_CTRL.autoAlvoPrefMenorHP = !MOBILE_CTRL.autoAlvoPrefMenorHP;
  try { localStorage.setItem('mc_auto_alvo_pref', MOBILE_CTRL.autoAlvoPrefMenorHP ? 'menor_hp' : 'proximo'); } catch (_) {}
  if (MOBILE_CTRL.autoAlvo) _avtCtrlAplicarAutoAlvo();
  else if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtCtrlToggleAutoAlvoPref = _avtCtrlToggleAutoAlvoPref;

function _avtCtrlAplicarAutoAlvo() {
  if (!MOBILE_CTRL.autoAlvo || typeof AVT_STATE === 'undefined') return;
  const skId = (AVT_STATE as any)._pendingSkillId;
  if (skId === undefined) return;
  const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
  if (!jogador) return;
  const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
  const sk = skId ? AVT_STATE.skills.find((s: any) => s.id === skId) : null;
  const alcanceSk = sk?.alcance_celulas ?? 1;
  let candidatos = [];
  if (bat) {
    candidatos = bat.iniciativa.filter((e: any) => {
      if (e.tipo !== 'inimigo' || e.hp <= 0) return false;
      const d = Math.max(Math.abs(Math.round(e.x) - Math.round(jogador.x)), Math.abs(Math.round(e.y) - Math.round(jogador.y)));
      return d <= alcanceSk;
    });
  } else {
    candidatos = AVT_STATE.entidades.filter((e: any) => {
      if (e.tipo !== 'inimigo' || e.hp <= 0) return false;
      if (typeof _avtBatalhaDeEnt === 'function' && _avtBatalhaDeEnt(e.id)) return false;
      const d = Math.max(Math.abs(Math.round(e.x) - Math.round(jogador.x)), Math.abs(Math.round(e.y) - Math.round(jogador.y)));
      return d <= alcanceSk;
    });
  }
  if (!candidatos.length) {
    if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
    if (typeof _atualizarZonaCentral === 'function') _atualizarZonaCentral();
    return;
  }
  const alvo = MOBILE_CTRL.autoAlvoPrefMenorHP
    ? candidatos.reduce((m: any, e: any) => e.hp < m.hp ? e : m, candidatos[0])
    : candidatos.reduce((m: any, e: any) => {
        const dm = Math.max(Math.abs(Math.round(m.x) - Math.round(jogador.x)), Math.abs(Math.round(m.y) - Math.round(jogador.y)));
        const de = Math.max(Math.abs(Math.round(e.x) - Math.round(jogador.x)), Math.abs(Math.round(e.y) - Math.round(jogador.y)));
        return de < dm ? e : m;
      }, candidatos[0]);
  _avtCtrlSelecionarAlvo(alvo.id);
}
window._avtCtrlAplicarAutoAlvo = _avtCtrlAplicarAutoAlvo;

// ── Detecção de landscape mobile ────────────────────────────────────────
function isMobileLandscape() {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // Exclui laptops/desktops com touchscreen: requer UA mobile OU tela pequena
  return hasTouch
      && (isMobileUA || window.innerWidth <= 900)
      && window.innerWidth > window.innerHeight
      && window.innerWidth <= 1200;
}

function _verificarModoMobile() {
  // Ativar automaticamente em landscape em dispositivos mobile reais
  const deveAtivar = isMobileLandscape();
  if (deveAtivar && !MOBILE_CTRL.ativo) {
    // Não ativar automaticamente em modo aventura (o jogador escolhe manualmente)
    if (!_emModoAventura()) _ativarControleMobile();
  } else if (!deveAtivar && MOBILE_CTRL.ativo && !(MOBILE_CTRL as any).ativadoManualmente) {
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
    if ((window.screen as any).unlockOrientation) {
      (window.screen as any).unlockOrientation();
    } else if ((window.screen as any).mozUnlockOrientation) {
      (window.screen as any).mozUnlockOrientation();
    } else if ((window.screen as any).msUnlockOrientation) {
      (window.screen as any).msUnlockOrientation();
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
  const temLinked = !!(RPG_DATA?.linked || (_emModoAventura() && AVT_STATE?.myCharNome));
  // Mostrar se: é touch device, está na aba mesa, tem personagem vinculado
  banner.style.display = (isMobile && naAbaMapas && temLinked) ? 'block' : 'none';
  _atualizarBotaoControleMobile();
}
window._atualizarBannerControleMobile = _atualizarBannerControleMobile;

// Permite ativar/desativar o modo controle manualmente
function toggleControleMobile() {
  if (MOBILE_CTRL.ativo) {
    (MOBILE_CTRL as any).ativadoManualmente = false;
    _desativarControleMobile();
    _atualizarBotaoControleMobile();
  } else {
    _mostrarSeletorModoControle();
  }
}
window.toggleControleMobile = toggleControleMobile;

function _mostrarSeletorModoControle() {
  document.getElementById('mc-modo-seletor')?.remove();
  const d = document.createElement('div');
  d.id = 'mc-modo-seletor';
  d.style.cssText = [
    'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.88)',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px',
    'font-family:var(--fonte-d)'
  ].join(';');
  const btnStyle = [
    'width:130px;padding:14px 10px;border-radius:12px;cursor:pointer',
    'display:flex;flex-direction:column;align-items:center;gap:6px',
    'background:rgba(79,163,209,0.1);border:1.5px solid rgba(79,163,209,0.35)',
    'color:#c8d8e8;font-family:var(--fonte-d);touch-action:manipulation'
  ].join(';');
  d.innerHTML = `
    <div style="color:#c8a84b;font-size:1rem;letter-spacing:.05em;margin-bottom:4px">🎮 Modo Controle</div>
    <div style="color:rgba(255,255,255,0.55);font-size:0.7rem;margin-bottom:8px">Como você está jogando?</div>
    <div style="display:flex;gap:14px">
      <button id="mc-modo-tv" style="${btnStyle}">
        <span style="font-size:2rem">📺</span>
        <span style="font-size:0.75rem;font-weight:600">Modo TV</span>
        <span style="font-size:0.58rem;color:rgba(255,255,255,0.45);text-align:center;line-height:1.3">Olhando para<br>a TV do mestre</span>
      </button>
      <button id="mc-modo-disp" style="${btnStyle}">
        <span style="font-size:2rem">📱</span>
        <span style="font-size:0.75rem;font-weight:600">Dispositivo</span>
        <span style="font-size:0.58rem;color:rgba(255,255,255,0.45);text-align:center;line-height:1.3">Vê o mapa<br>aqui no celular</span>
      </button>
    </div>
    <button id="mc-modo-cancel" style="margin-top:6px;padding:6px 18px;background:none;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.35);font-size:0.65rem;cursor:pointer;touch-action:manipulation">✕ Cancelar</button>
  `;
  const _ativar = (modo: any) => {
    d.remove();
    MOBILE_CTRL.modoTela = modo;
    (MOBILE_CTRL as any).ativadoManualmente = true;
    _ativarControleMobile();
  };
  const _mostrarSelecaoCamera = () => {
    d.remove();
    const d2 = document.createElement('div');
    d2.id = 'mc-modo-seletor';
    d2.style.cssText = [
      'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.88)',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px',
      'font-family:var(--fonte-d)'
    ].join(';');
    const btnStyle = [
      'width:140px;padding:14px 10px;border-radius:12px;cursor:pointer',
      'display:flex;flex-direction:column;align-items:center;gap:6px',
      'background:rgba(79,163,209,0.1);border:1.5px solid rgba(79,163,209,0.35)',
      'color:#c8d8e8;font-family:var(--fonte-d);touch-action:manipulation'
    ].join(';');
    const savedCam = MOBILE_CTRL.modoCamara || 'deadzone';
    d2.innerHTML = `
      <div style="color:#c8a84b;font-size:1rem;letter-spacing:.05em;margin-bottom:4px">📱 Dispositivo</div>
      <div style="color:rgba(255,255,255,0.55);font-size:0.7rem;margin-bottom:8px">Como a câmera deve se comportar?</div>
      <div style="display:flex;gap:14px">
        <button id="mc-cam-deadzone" style="${btnStyle}${savedCam==='deadzone'?';border-color:rgba(94,224,154,0.6);background:rgba(94,224,154,0.1)':''}">
          <span style="font-size:2rem">🎯</span>
          <span style="font-size:0.75rem;font-weight:600">Dead Zone</span>
          <span style="font-size:0.58rem;color:rgba(255,255,255,0.45);text-align:center;line-height:1.3">Câmera segue<br>pelas bordas</span>
        </button>
        <button id="mc-cam-central" style="${btnStyle}${savedCam==='centralizada'?';border-color:rgba(94,224,154,0.6);background:rgba(94,224,154,0.1)':''}">
          <span style="font-size:2rem">📺</span>
          <span style="font-size:0.75rem;font-weight:600">Centralizada</span>
          <span style="font-size:0.58rem;color:rgba(255,255,255,0.45);text-align:center;line-height:1.3">Personagem fixo<br>no centro</span>
        </button>
      </div>
      <button id="mc-cam-cancel" style="margin-top:6px;padding:6px 18px;background:none;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.35);font-size:0.65rem;cursor:pointer;touch-action:manipulation">✕ Cancelar</button>
    `;
    const _ativarCam = (cam: any) => {
      MOBILE_CTRL.modoCamara = cam;
      try { localStorage.setItem('mc_modo_camera', cam); } catch (_) {}
      d2.remove();
      _ativar('dispositivo');
    };
    d2.querySelector('#mc-cam-deadzone').addEventListener('click', () => _ativarCam('deadzone'));
    d2.querySelector('#mc-cam-deadzone').addEventListener('touchend', e => { e.preventDefault(); _ativarCam('deadzone'); });
    d2.querySelector('#mc-cam-central').addEventListener('click', () => _ativarCam('centralizada'));
    d2.querySelector('#mc-cam-central').addEventListener('touchend', e => { e.preventDefault(); _ativarCam('centralizada'); });
    d2.querySelector('#mc-cam-cancel').addEventListener('click', () => d2.remove());
    d2.querySelector('#mc-cam-cancel').addEventListener('touchend', e => { e.preventDefault(); d2.remove(); });
    document.body.appendChild(d2);
  };
  const tvBtn = d.querySelector('#mc-modo-tv');
  const dpBtn = d.querySelector('#mc-modo-disp');
  const caBtn = d.querySelector('#mc-modo-cancel');
  tvBtn.addEventListener('click', () => _ativar('tv'));
  tvBtn.addEventListener('touchend', e => { e.preventDefault(); _ativar('tv'); });
  dpBtn.addEventListener('click', () => _mostrarSelecaoCamera());
  dpBtn.addEventListener('touchend', e => { e.preventDefault(); _mostrarSelecaoCamera(); });
  caBtn.addEventListener('click', () => d.remove());
  caBtn.addEventListener('touchend', e => { e.preventDefault(); d.remove(); });
  document.body.appendChild(d);
}

function _atualizarBotaoControleMobile() {
  const ativo = MOBILE_CTRL.ativo;
  // Botão na aba de mapas de campanha
  const btn = document.getElementById('btn-modo-controle');
  if (btn) {
    btn.textContent = ativo ? '🎮 Sair do Controle' : '🎮 Modo Controle';
    btn.style.background  = ativo ? 'rgba(94,224,154,0.12)' : 'rgba(79,163,209,0.08)';
    btn.style.borderColor = ativo ? 'rgba(94,224,154,0.4)'  : 'rgba(79,163,209,0.25)';
    btn.style.color       = ativo ? '#5ee09a' : '#7ec8f0';
  }
  // Botão no header da tela de aventura
  const btnAvt = document.getElementById('avt-btn-controle');
  if (btnAvt) {
    btnAvt.textContent    = ativo ? '🎮 Sair' : '🎮 Controle';
    btnAvt.style.background  = ativo ? 'rgba(94,224,154,0.12)' : 'rgba(79,163,209,0.08)';
    btnAvt.style.borderColor = ativo ? 'rgba(94,224,154,0.4)'  : 'rgba(79,163,209,0.25)';
    btnAvt.style.color       = ativo ? '#5ee09a' : '#7ec8f0';
  }
}

window.addEventListener('resize', _verificarModoMobile);
window.addEventListener('orientationchange', () => setTimeout(_verificarModoMobile, 300));
document.addEventListener('DOMContentLoaded', () => setTimeout(_verificarModoMobile, 500));

// ── Detectar se está no modo aventura ───────────────────────────────────
function _emModoAventura() {
  return typeof AVT_STATE !== 'undefined'
    && document.getElementById('aventura-screen')?.style.display !== 'none'
    && !!AVT_STATE?.rpgId;
}

// ── Ativar/desativar controle mobile ────────────────────────────────────
function _ativarControleMobile() {
  MOBILE_CTRL.ativo = true;

  const emAventura = _emModoAventura();

  // Verificar se há mapa ativo e personagem vinculado
  if (!emAventura && !MAPA_STATE?.mapaAtualId) {
    mostrarToast('⚠ Selecione um mapa antes de usar o controle', 'aviso');
    MOBILE_CTRL.ativo = false;
    (MOBILE_CTRL as any).ativadoManualmente = false;
    return;
  }
  if (!RPG_DATA?.linked && !(_emModoAventura() && AVT_STATE?.myCharNome)) {
    mostrarToast('⚠ Nenhum personagem vinculado a você', 'aviso');
    MOBILE_CTRL.ativo = false;
    (MOBILE_CTRL as any).ativadoManualmente = false;
    return;
  }

  if (!isMobileLandscape() && (MOBILE_CTRL as any).ativadoManualmente) {
    mostrarToast('📱 Gire o celular para landscape para a melhor experiência', '', 3000);
  }
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function(){});
    }
  } catch(e) {}
  try {
    const _el = document.documentElement;
    const _req = _el.requestFullscreen || _el.webkitRequestFullscreen || _el.mozRequestFullScreen;
    if (_req && !document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      _req.call(_el).catch(function(){});
    }
  } catch(e) {}

  const isDispositivo = MOBILE_CTRL.modoTela === 'dispositivo';
  const emAventuraDisp = emAventura && isDispositivo;

  let overlay = document.getElementById('mobile-ctrl-overlay');
  if (overlay) {
    // Recriar se o modo de tela mudou
    overlay.remove();
    overlay = null;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-ctrl-overlay';
    overlay.setAttribute('data-modo', MOBILE_CTRL.modoTela);

    if (emAventuraDisp) {
      // Aventura + dispositivo: strip fixo na parte inferior, mapa totalmente visível acima
      overlay.style.cssText = [
        'position:fixed;bottom:0;left:0;right:0;z-index:8100;display:grid',
        'grid-template-columns:38% 24% 38%',
        'pointer-events:none;touch-action:none',
        'background:transparent'
      ].join(';');
    } else if (isDispositivo) {
      // Dispositivo (campanha): overlay transparente, controles nas bordas inferiores
      overlay.style.cssText = [
        'position:fixed;inset:0;z-index:8000;display:grid',
        'grid-template-columns:35% 30% 35%',
        'grid-template-rows:1fr',
        'pointer-events:none;touch-action:none',
        'background:transparent',
        'align-items:flex-end;padding-bottom:8px'
      ].join(';');
    } else {
      // Modo TV: fundo preto opaco (comportamento original)
      overlay.style.cssText = [
        'position:fixed;inset:0;z-index:8000;display:grid',
        'grid-template-columns:35% 30% 35%',
        'pointer-events:auto;touch-action:none',
        'background:#000'
      ].join(';');
    }
    const _adaptarOrientacao = () => {
      if (!MOBILE_CTRL.ativo) return;
      const isLand = window.innerWidth > window.innerHeight;
      if (emAventuraDisp) {
        overlay.style.gridTemplateColumns = isLand ? '38% 24% 38%' : '35% 30% 35%';
      } else if (isDispositivo) {
        overlay.style.gridTemplateColumns = isLand ? '35% 30% 35%' : '30% 40% 30%';
        overlay.style.gridTemplateRows = '1fr';
        overlay.style.alignItems = 'flex-end';
      } else {
        overlay.style.gridTemplateColumns = isLand ? '35% 30% 35%' : '20% 60% 20%';
        overlay.style.gridTemplateRows = isLand ? '1fr' : '1fr 1fr 1fr';
        overlay.style.alignItems = isLand ? 'center' : 'end';
      }
    };
    window.addEventListener('resize', _adaptarOrientacao);
    window.addEventListener('orientationchange', () => setTimeout(_adaptarOrientacao, 300));
    overlay.innerHTML = _htmlControleMobile();
    document.body.appendChild(overlay);
    _iniciarJoystick();
  }
  overlay.style.display = 'grid';

  // No modo dispositivo/aventura, habilitar pointer-events somente nas zonas de controle
  if (isDispositivo || emAventuraDisp) {
    overlay.querySelectorAll('#mc-zona-esq, #mc-zona-central, #mc-zona-dir').forEach(z => {
      z.style.pointerEvents = 'auto';
    });
  } else {
    overlay.style.background = '#000';
    // Bloquear interação com sidebar e resto da UI enquanto controle ativo
    const sidebar = document.getElementById('mapa-sidebar');
    if (sidebar) {
      sidebar._prevPointerEvents = sidebar.style.pointerEvents;
      sidebar.style.pointerEvents = 'none';
      sidebar.style.visibility = 'hidden';
    }
  }

  // Aventura + dispositivo: maximizar área do mapa escondendo header/hud
  if (emAventuraDisp) {
    const header = document.getElementById('avt-header');
    const hud    = document.getElementById('avt-hud');
    if (header && header.style.display !== 'none') {
      header._prevDisplay = header.style.display;
      header.style.display = 'none';
    }
    // HUD gerenciado por _avtHudMostrar; só esconder se estiver visível
    if (hud && hud.style.display !== 'none') {
      hud._prevDisplay = hud.style.display;
      hud.style.display = 'none';
    }
    // Bloquear scroll do body para evitar que o bounce do iOS Safari cause
    // jitter visual no canvas quando o jogador pressiona o d-pad
    const _b = document.body;
    _b._prevOverflow = _b.style.overflow;
    _b._prevPosition = _b.style.position;
    _b._prevWidth    = _b.style.width;
    _b._prevHeight   = _b.style.height;
    _b.style.overflow = 'hidden';
    _b.style.position = 'fixed';
    _b.style.width    = '100%';
    _b.style.height   = '100%';
    // Redimensionar canvas para preencher a tela toda
    if (typeof _avtCanvasResize === 'function') setTimeout(_avtCanvasResize, 50);
  }

  _atualizarZonaCentral();
  _atualizarZonaDireita();
  _atualizarBotaoControleMobile();
  _atualizarEstadoDpad();
  _iniciarDpadReposicionamento();

  // Reposicionar minimap acima do dpad no modo mobile dispositivo
  if (emAventuraDisp) _avtMinimapSetMobile(true);

  const tabMapas = document.getElementById('tab-mapas');
  if (tabMapas) tabMapas.style.overflow = 'hidden';
}

function _desativarControleMobile() {
  MOBILE_CTRL.ativo = false;
  (MOBILE_CTRL as any).ativadoManualmente = false;
  clearInterval(_DPAD_TIMER); _DPAD_TIMER = null; _DPAD_DC = 0; _DPAD_DR = 0;
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
  try {
    const _exit = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen;
    if (_exit && (document.fullscreenElement || (document as any).webkitFullscreenElement)) {
      _exit.call(document).catch(function(){});
    }
  } catch(e) {}
  const overlay = document.getElementById('mobile-ctrl-overlay');
  if (overlay) overlay.style.display = 'none';
  // Restaurar sidebar (modo TV campanha)
  const sidebar = document.getElementById('mapa-sidebar');
  if (sidebar) {
    sidebar.style.pointerEvents = sidebar._prevPointerEvents || '';
    sidebar.style.visibility = '';
  }
  // Restaurar header e HUD da aventura (modo dispositivo)
  const header = document.getElementById('avt-header');
  if (header && header._prevDisplay !== undefined) {
    header.style.display = header._prevDisplay || '';
    delete header._prevDisplay;
  } else if (header) {
    header.style.display = '';
  }
  const hud = document.getElementById('avt-hud');
  if (hud && hud._prevDisplay !== undefined) {
    hud.style.display = hud._prevDisplay || '';
    delete hud._prevDisplay;
  }
  // Restaurar scroll do body (bloqueado no modo aventura+dispositivo)
  const _b = document.body;
  if (_b._prevOverflow !== undefined) { _b.style.overflow  = _b._prevOverflow;  delete _b._prevOverflow; }
  if (_b._prevPosition !== undefined) { _b.style.position  = _b._prevPosition;  delete _b._prevPosition; }
  if (_b._prevWidth    !== undefined) { _b.style.width     = _b._prevWidth;     delete _b._prevWidth; }
  if (_b._prevHeight   !== undefined) { _b.style.height    = _b._prevHeight;    delete _b._prevHeight; }
  // Fechar ficha mobile e painel de log mobile se estiverem abertos
  document.getElementById('avt-ficha-mobile-modal')?.remove();
  document.getElementById('avt-log-mobile-panel')?.remove();
  // Redimensionar canvas para o estado normal
  if (_emModoAventura() && typeof _avtCanvasResize === 'function') setTimeout(_avtCanvasResize, 50);
  // Restaurar minimap para posição desktop
  _avtMinimapSetMobile(false);
  _atualizarBotaoControleMobile();
  _atualizarBannerControleMobile?.();
}

function _avtMinimapSetMobile(mobile: any) {
  const mm = document.getElementById('avt-minimap');
  if (!mm) return;
  if (mobile) {
    mm.width = 90; mm.height = 90;
    mm.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:200px',
      'width:90px',
      'height:90px',
      'opacity:0.55',
      'border-radius:7px',
      'z-index:9100',
      'pointer-events:none',
      'display:none',
      'image-rendering:pixelated'
    ].join(';');
  } else {
    mm.width = 120; mm.height = 120;
    mm.style.cssText = [
      'position:fixed',
      'left:12px',
      'top:50%',
      'transform:translateY(-50%)',
      'width:120px',
      'height:120px',
      'opacity:0.35',
      'border-radius:8px',
      'z-index:9100',
      'pointer-events:none',
      'display:none',
      'image-rendering:pixelated'
    ].join(';');
  }
}

// ── HTML das 3 zonas ────────────────────────────────────────────────────
function _htmlControleMobile() {
  const isDisp     = MOBILE_CTRL.modoTela === 'dispositivo';
  const emAvtDisp  = _emModoAventura() && isDisp;
  // No modo aventura+dispositivo os painéis são compactos e ficam na barra inferior
  // Fundo das zonas: transparente no modo dispositivo/aventura; sólido só no modo TV
  const zonaBg  = isDisp || emAvtDisp ? '' : '';
  const zonePad = emAvtDisp ? 'padding:6px 5px 8px;' : (isDisp ? 'padding:8px 6px;' : 'padding:6px;');
  const dpadSize = emAvtDisp ? '48px' : '53px';
  const dpadGap  = emAvtDisp ? '2px'  : '4px';
  const dpadW    = emAvtDisp ? '152px' : '167px';
  const _charClick = emAvtDisp ? '_avtAbrirFichaMobile()' : "typeof avtJogadorPainel==='function'&&avtJogadorPainel()";
  return `
    ${emAvtDisp ? `<div id="mc-hp-topleft" style="position:fixed;top:8px;left:8px;z-index:9201;pointer-events:none;width:130px;font-family:var(--fonte-d)"></div>` : ''}
    ${isDisp ? `<button id="mc-char-topright" ontouchend="event.preventDefault();${_charClick}" onclick="${_charClick}" style="position:fixed;top:8px;right:8px;z-index:9201;pointer-events:auto;padding:3px 8px;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:rgba(79,163,209,0.85);font-family:var(--fonte-d);font-size:0.5rem;cursor:pointer;touch-action:manipulation">👤</button>` : ''}
    ${emAvtDisp ? `<button id="mc-encerrar-btn" ontouchend="event.preventDefault();avtEncerrarMeuCombate()" onclick="avtEncerrarMeuCombate()" style="display:none;position:fixed;top:8px;right:46px;z-index:9201;pointer-events:auto;padding:3px 8px;background:rgba(232,96,76,0.12);border:1px solid rgba(232,96,76,0.3);border-radius:6px;color:rgba(232,96,76,0.85);font-family:var(--fonte-d);font-size:0.5rem;cursor:pointer;touch-action:manipulation">⚑</button>` : ''}
    ${emAvtDisp ? `<button id="mc-log-btn" ontouchend="event.preventDefault();_avtToggleLogMobile()" onclick="_avtToggleLogMobile()" style="position:fixed;top:8px;left:140px;z-index:9202;pointer-events:auto;padding:3px 8px;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:rgba(79,163,209,0.85);font-family:var(--fonte-d);font-size:0.5rem;cursor:pointer;touch-action:manipulation">📋 Log</button>` : ''}
    <!-- ZONA ESQUERDA: D-pad 8 direções -->
    <div id="mc-zona-esq" style="pointer-events:auto;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;${zonePad}gap:2px;${zonaBg}">
      <div id="mc-dpad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:${dpadGap};width:${dpadW};touch-action:none;user-select:none;-webkit-user-select:none">
        <!-- Linha 1: diagonal NW, N, diagonal NE -->
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(-1,-1)" ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:8px 16px 4px 4px">↖</button>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(0,-1)"  ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:16px 16px 4px 4px">↑</button>
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(1,-1)"  ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:16px 8px 4px 4px">↗</button>
        <!-- Linha 2: W, centro, E -->
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(-1,0)"  ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:16px 4px 4px 16px">←</button>
        <div id="mc-dpad-center" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:0.5rem;color:rgba(122,146,170,0.4);font-family:var(--fonte-d);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab">MOV</div>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(1,0)"   ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:4px 16px 16px 4px">→</button>
        <!-- Linha 3: diagonal SW, S, diagonal SE -->
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(-1,1)"  ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:4px 4px 4px 16px">↙</button>
        <button class="mc-dpad-btn mc-dpad-main" ontouchstart="event.preventDefault();_dpadPress(0,1)"   ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:4px 4px 16px 16px">↓</button>
        <button class="mc-dpad-btn mc-dpad-diag" ontouchstart="event.preventDefault();_dpadPress(1,1)"   ontouchend="event.preventDefault();_dpadRelease()" oncontextmenu="return false" style="width:${dpadSize};height:${dpadSize};border-radius:4px 4px 16px 4px">↘</button>
      </div>
      <div id="mc-mov-info" style="font-size:0.56rem;color:rgba(255,255,255,0.35);font-family:var(--fonte-d,monospace);text-align:center;margin-top:2px;width:${dpadW}"></div>
    </div>

    <!-- ZONA CENTRAL: status / stats (campanha) -->
    <div id="mc-zona-central" style="pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;${zonePad}${zonaBg}">
      <!-- Tab pet/personagem (somente campanha) -->
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

      <!-- Stats HP / Recurso / Movimento (modo campanha / não-aventura) -->
      ${!emAvtDisp ? `<div id="mc-stats" style="width:100%;font-size:0.62rem;font-family:var(--fonte-d)"></div>` : ''}
      <!-- Botão de saída do modo controle -->
      <button ontouchend="event.preventDefault();toggleControleMobile()" onclick="toggleControleMobile()"
        style="padding:3px 8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:rgba(192,57,43,0.7);font-family:var(--fonte-d);font-size:0.52rem;cursor:pointer;touch-action:manipulation;letter-spacing:.06em;text-transform:uppercase">✕ Sair</button>

      <!-- Skills alvo próprio (3.7) — segunda linha durante turno ativo -->
      <div id="mc-skills-proprias" style="width:100%;display:none;flex-wrap:wrap;gap:3px;justify-content:center"></div>

      <!-- Status do turno -->
      <div id="mc-turno-status" style="font-size:0.56rem;color:rgba(200,168,75,0.7);font-family:var(--fonte-d);text-align:center"></div>
    </div>

    <!-- ZONA DIREITA: alvos à esquerda | skills à direita, ancorados ao canto -->
    <div id="mc-zona-dir" style="pointer-events:auto;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;${zonePad}gap:2px;${zonaBg}">
      <div id="mc-dir-row" style="display:flex;gap:2px;align-items:flex-end;width:100%">
        ${emAvtDisp ? `<div id="mc-alvos-central" style="flex:4;min-width:0;height:142px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 1px"></div>` : ''}
        <div id="mc-ctx-botoes" style="flex:6;min-width:0;height:${emAvtDisp ? '142px' : '161px'};display:flex;flex-direction:column;overflow:hidden"></div>
      </div>
    </div>
    ${emAvtDisp ? `<div id="mc-aceitar-ignorar" style="position:fixed;bottom:12px;right:8px;display:flex;flex-direction:column;gap:4px;width:140px;z-index:8200;pointer-events:auto"></div>` : ''}
  `;
}


(function _injetarCssDpad() {
  if (document.getElementById('css-dpad')) return;
  const s = document.createElement('style');
  s.id = 'css-dpad';
  s.textContent = `
    .mc-dpad-btn {
      width:53px; height:53px;
      border:none; cursor:pointer;
      font-size:1.3rem; line-height:1;
      display:flex; align-items:center; justify-content:center;
      transition:background 0.08s, transform 0.08s, opacity 0.2s;
      touch-action:none; user-select:none; -webkit-user-select:none;
      -webkit-touch-callout:none;
      -webkit-tap-highlight-color:transparent;
    }
    #mc-dpad, #mc-zona-esq, #mc-zona-dir {
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    #mc-dpad-center {
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
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
    /* Aventura: canvas ocupa altura total quando header/hud estão escondidos */
    #aventura-screen:has(+ #mobile-ctrl-overlay[data-modo="dispositivo"]) #avt-mapa-wrap,
    .avt-mobile-ctrl-ativo #avt-mapa-wrap {
      height: 100%;
    }
    /* Modal da ficha mobile: scroll suave */
    #avt-ficha-mobile-content {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
    }
    /* Overlay de skill/alvo: z-index acima do ctrl overlay */
    #avt-skill-overlay, #avt-alvo-mobile-overlay {
      z-index: 9950 !important;
    }
  `;
  document.head.appendChild(s);
})();

// ── Reposicionamento do d-pad (hold 10s no centro + drag) ───────────────
function _iniciarDpadReposicionamento() {
  const center = document.getElementById('mc-dpad-center');
  const zonaEsq = document.getElementById('mc-zona-esq');
  if (!center || !zonaEsq) return;

  // Limpar qualquer position:fixed residual de versão anterior
  zonaEsq.style.position = '';
  zonaEsq.style.left = '';
  zonaEsq.style.bottom = '';
  zonaEsq.style.top = '';

  let holdTimer: any = null;
  let reposMode = false;
  let dragStart: any = null;

  const _dpadPosKey = () => {
    const rpgId = (typeof AVT_STATE !== 'undefined' && AVT_STATE?.rpgId) || 'default';
    const charNome = (typeof AVT_STATE !== 'undefined' && AVT_STATE?.myCharNome) || 'default';
    return `mc_dpad_pos2_${rpgId}_${charNome}`;
  };

  const _restaurarPos = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(_dpadPosKey()) || 'null');
      if (saved?.dx != null) {
        zonaEsq.style.transform = `translate(${saved.dx}px,${saved.dy}px)`;
      }
    } catch (_) {}
  };
  _restaurarPos();

  center.addEventListener('touchstart', (e) => {
    e.preventDefault();
    center.style.transition = 'background 10s linear';
    center.style.background = 'rgba(200,168,75,0.4)';
    holdTimer = setTimeout(() => {
      reposMode = true;
      center.style.background = 'rgba(200,168,75,0.7)';
      center.style.transition = '';
      center.style.cursor = 'grabbing';
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      // Ler translação atual acumulada
      const m = new DOMMatrix(getComputedStyle(zonaEsq).transform);
      dragStart = { x: null, y: null, baseDx: m.m41, baseDy: m.m42 };
    }, 10000);
  }, { passive: false });

  center.addEventListener('touchmove', (e) => {
    if (!reposMode) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (dragStart.x === null) {
      dragStart.x = touch.clientX;
      dragStart.y = touch.clientY;
    }
    const dx = touch.clientX - dragStart.x + dragStart.baseDx;
    const dy = touch.clientY - dragStart.y + dragStart.baseDy;
    zonaEsq.style.transform = `translate(${dx}px,${dy}px)`;
  }, { passive: false });

  const _finalizarHold = (e: any) => {
    if (e) e.preventDefault();
    clearTimeout(holdTimer);
    center.style.background = '';
    center.style.transition = '';
    center.style.cursor = 'grab';
    if (reposMode) {
      const m = new DOMMatrix(getComputedStyle(zonaEsq).transform);
      try {
        localStorage.setItem(_dpadPosKey(), JSON.stringify({ dx: m.m41, dy: m.m42 }));
      } catch (_) {}
      reposMode = false;
      dragStart = null;
    }
  };

  center.addEventListener('touchend', _finalizarHold, { passive: false });
  center.addEventListener('touchcancel', _finalizarHold, { passive: false });
}

// ── Zoom do mapa aventura via controle mobile ────────────────────────────
window._avtCtrlZoom = function(delta: any) {
  if (typeof AVT_STATE === 'undefined') return;
  const atual = AVT_STATE.camera?.zoom || 1;
  AVT_STATE.camera.zoom = Math.max(0.3, Math.min(3.0, atual + delta));
  const zEl = document.getElementById('mc-zoom-val');
  if (zEl) zEl.textContent = AVT_STATE.camera.zoom.toFixed(1) + '×';
  if (navigator.vibrate) navigator.vibrate(10);
};

// ── Abrir ficha no controle mobile — usa o editor de personagem padrão ───
window._avtAbrirFichaMobile = function() {
  if (typeof avtJogadorPainel === 'function') avtJogadorPainel();
  if (navigator.vibrate) navigator.vibrate(12);
};

// ── Log flutuante no modo mobile aventura ────────────────────────────────
window._avtToggleLogMobile = function() {
  const existing = document.getElementById('avt-log-mobile-panel');
  if (existing) { existing.remove(); return; }
  const panel = document.createElement('div');
  panel.id = 'avt-log-mobile-panel';
  panel.style.cssText = [
    'position:fixed;top:32px;left:8px',
    'width:min(168px,43vw);max-height:29vh',
    'background:rgba(5,8,16,0.96)',
    'border:1px solid rgba(79,163,209,0.22)',
    'border-radius:8px',
    'overflow-y:auto',
    '-webkit-overflow-scrolling:touch',
    'overscroll-behavior:contain',
    'z-index:9200',
    'padding:8px',
    'pointer-events:auto',
  ].join(';');
  const logSrc = document.getElementById('avt-log');
  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--fonte-d);font-size:0.52rem;color:rgba(79,163,209,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between';
  title.innerHTML = '<span>Registro de combate</span><span ontouchend="event.preventDefault();document.getElementById(\'avt-log-mobile-panel\')?.remove()" onclick="document.getElementById(\'avt-log-mobile-panel\')?.remove()" style="cursor:pointer;padding:0 4px;font-size:0.8rem;color:#7a92aa">×</span>';
  const content = document.createElement('div');
  content.id = 'avt-log-mobile-content';
  content.style.cssText = 'display:flex;flex-direction:column;gap:3px';
  content.innerHTML = logSrc?.innerHTML || '<div style="color:#6a5840;font-size:0.7rem;text-align:center;padding:8px">Nenhuma ação registrada</div>';
  panel.appendChild(title);
  panel.appendChild(content);
  document.body.appendChild(panel);
  if (navigator.vibrate) navigator.vibrate(10);
};

// ── D-pad 8 direções (substitui joystick) ───────────────────────────────
let _DPAD_TIMER: any = null;
let _DPAD_DC = 0, _DPAD_DR = 0;

window._dpadPress = function(dc: any, dr: any) {
  _DPAD_DC = dc; _DPAD_DR = dr;
  clearInterval(_DPAD_TIMER);
  _dpadMoverToken(dc, dr);
  if (navigator.vibrate) navigator.vibrate(18);
  _DPAD_TIMER = setInterval(function() {
    if (_DPAD_DC !== 0 || _DPAD_DR !== 0) _dpadMoverToken(_DPAD_DC, _DPAD_DR);
  }, 180);
};
window._dpadRelease = function() {
  _DPAD_DC = 0; _DPAD_DR = 0;
  clearInterval(_DPAD_TIMER);
  _DPAD_TIMER = null;
};

// ═══════════════════════════════════════════════════════════════════════════
// ── FUNÇÃO CORRIGIDA: _dpadMoverToken ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
function _dpadMoverToken(dc: any, dr: any) {
  // Se em modo aventura, rotear para o sistema de aventura
  if (_emModoAventura() && typeof _avtDpadControle === 'function') {
    _avtDpadControle(dc, dr);
    _atualizarEstadoDpad();
    return;
  }

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

function _podeMovimentarMobile(charNome: any) {
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
  let podeMover;

  if (_emModoAventura()) {
    // Modo aventura: verificar turno e movimento pela AVT_STATE
    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    if (!bat) {
      podeMover = true; // fora de combate: movimento livre
    } else {
      const ativo   = typeof _avtAtivo === 'function' ? _avtAtivo() : null;
      const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
      const movRest = bat.movimentoRestante?.[jogador?.id] ?? _avtGetMovimentoMax?.(jogador) ?? 0;
      podeMover = !!(ativo && jogador && ativo.id === jogador.id && movRest > 0);
    }
  } else {
    const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
      ? MOBILE_CTRL.petNome
      : RPG_DATA?.linked;
    if (!charNome) return;
    podeMover = _podeMovimentarMobile(charNome);
  }

  const dpad = document.getElementById('mc-dpad');
  if (dpad) {
    const btns = dpad.querySelectorAll('.mc-dpad-btn');
    btns.forEach(btn => {
      btn.style.opacity = podeMover ? '1' : '0.4';
      btn.style.pointerEvents = podeMover ? 'auto' : 'none';
    });
  }

  _atualizarMovInfo();
}

// ── Zona central no modo aventura ───────────────────────────────────────
function _atualizarZonaCentralAventura() {
  const hpEl    = document.getElementById('mc-hp-topleft');
  const turnoEl = document.getElementById('mc-turno-status');
  const skWrap  = document.getElementById('mc-skills-proprias');
  const alvosEl = document.getElementById('mc-alvos-central');

  const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
  if (!jogador) {
    if (hpEl) hpEl.innerHTML = '';
    if (alvosEl) alvosEl.innerHTML = '';
    return;
  }

  // HP / recurso no canto superior esquerdo
  if (hpEl) {
    const hp    = jogador.hp ?? 0;
    const hpMax = jogador.hpMax ?? 1;
    const hpPct = Math.round(Math.max(0, Math.min(100, (hp / hpMax) * 100)));
    const hpCor = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';

    const _dbChar = typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars.find((c: any) => c.id === jogador.dbId || c.nome === jogador.nome) : null;
    const atributos = _dbChar?.custom_attrs?.atributos || {};
    const statusAttrs = (typeof AVT_STATE !== 'undefined' ? (AVT_STATE.rpg?.attr_defs || []) : [])
      .filter((a: any) => a.categoria === 'status' && a.nome !== 'HP' && a.nome !== 'Nível');
    let recursoHtml = '';
    for (const attr of statusAttrs.slice(0, 1)) {
      const val = parseFloat(atributos[attr.nome] || 0);
      const max = parseFloat(atributos[attr.nome + '_max'] || atributos['Max_' + attr.nome] || 100);
      const pct = Math.min(100, Math.round((val / max) * 100));
      recursoHtml += `<div style="display:flex;justify-content:space-between;font-size:0.58rem;color:rgba(126,200,240,0.85);margin-top:2px"><span>${attr.nome}</span><span>${Math.round(val)}/${Math.round(max)}</span></div><div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:1px"><div style="height:100%;width:${pct}%;background:#7ec8f0;border-radius:2px"></div></div>`;
    }

    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    let movHtml = '';
    if (bat) {
      const movRest = bat.movimentoRestante?.[jogador.id] ?? (typeof _avtGetMovimentoMax === 'function' ? _avtGetMovimentoMax(jogador) : 3);
      const movMax  = typeof _avtGetMovimentoMax === 'function' ? _avtGetMovimentoMax(jogador) : 3;
      movHtml = `<div style="font-size:0.55rem;color:rgba(200,168,75,0.8);margin-top:2px">${movRest}/${movMax} mov</div>`;
    }

    hpEl.innerHTML = `<div style="background:rgba(5,8,16,0.75);border:1px solid rgba(79,163,209,0.2);border-radius:8px;padding:5px 7px">
      <div style="display:flex;justify-content:space-between;font-size:0.63rem;color:${hpCor};font-weight:600"><span>HP</span><span>${hp}/${hpMax}</span></div>
      <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin:2px 0"><div style="height:100%;width:${hpPct}%;background:${hpCor};border-radius:2px;transition:width 0.3s"></div></div>
      ${recursoHtml}${movHtml}</div>`;
  }

  if (skWrap) skWrap.style.display = 'none';

  // Turno status
  const bat2 = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
  if (turnoEl) {
    const ativo = typeof _avtAtivo === 'function' ? _avtAtivo() : null;
    const emMeuTurno = bat2 && ativo && ativo.id === jogador.id;
    turnoEl.textContent = bat2 ? (emMeuTurno ? '⚔ Seu turno' : '⏳ Aguardando') : '';
    turnoEl.style.color = emMeuTurno ? 'rgba(94,224,154,0.8)' : 'rgba(200,168,75,0.5)';
  }

  // Lista de alvos / botão dados na zona central
  _avtCtrlAtualizarAlvosCentral(alvosEl);
}

function _avtCtrlAtualizarAlvosCentral(alvosEl: any) {
  if (!alvosEl) return;
  const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
  if (!jogador || typeof AVT_STATE === 'undefined') { if (alvosEl) alvosEl.innerHTML = ''; return; }

  const bat     = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
  const ativo   = typeof _avtAtivo === 'function' ? _avtAtivo() : null;
  const emMeuTurno = bat && ativo && jogador && ativo.id === jogador.id;
  const primAtaque = AVT_STATE._primeiroAtaqueAberto || AVT_STATE._primeiroAtaqueModoAlvo;
  const algumPerseguindo = Object.values<any>(AVT_STATE.npcTimers || {}).some(t => t.isPursuing && t.targetId === jogador.id);

  if (!emMeuTurno && !primAtaque && !algumPerseguindo) { alvosEl.innerHTML = ''; return; }

  const skId   = (AVT_STATE as any)._pendingSkillId; // undefined=nenhuma selecionada, null=básico, string=skill
  const alvoId = AVT_STATE.alvoSelecionado;
  const sk = (skId != null) ? AVT_STATE.skills.find((s: any) => s.id === skId) : null;
  const alcanceSk = sk?.alcance_celulas ?? 1;
  const skSelecionada = skId !== undefined;

  // Se ambos selecionados e em alcance → executa automaticamente (sem botão intermediário)
  if (skSelecionada && alvoId) {
    let alvoEnt = null;
    if (bat) alvoEnt = bat.iniciativa.find((e: any) => e.id === alvoId && e.hp > 0);
    else     alvoEnt = AVT_STATE.entidades.find((e: any) => e.id === alvoId && e.hp > 0 && !_avtBatalhaDeEnt(e.id));
    if (alvoEnt) {
      const dist = Math.max(Math.abs(Math.round(alvoEnt.x) - Math.round(jogador.x)), Math.abs(Math.round(alvoEnt.y) - Math.round(jogador.y)));
      if (dist <= alcanceSk) {
        _avtCtrlRolarDados();
        return;
      }
    }
  }

  // Skill de aliado: mostrar lista de aliados (verde para outros, laranja para si mesmo)
  if (sk?.alvo_tipo === 'aliado' && skSelecionada) {
    const aliados = bat
      ? bat.iniciativa.filter((e: any) => e.tipo === 'jogador' && e.hp > 0)
      : AVT_STATE.entidades.filter((e: any) => e.tipo === 'jogador' && e.hp > 0);
    if (!aliados.length) {
      alvosEl.innerHTML = `<div style="font-size:0.58rem;color:rgba(255,255,255,0.3);text-align:center;padding:6px;font-family:var(--fonte-d)">Nenhum aliado disponível</div>`;
      return;
    }
    alvosEl.innerHTML =
      `<div style="font-size:0.46rem;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:1px;font-family:var(--fonte-d);letter-spacing:.06em">ALIADOS</div>` +
      aliados.map((e: any) => {
        const isMe = e.id === jogador.id;
        const rgb = isMe ? '232,150,30' : '39,174,96';
        const cor = isMe ? '#e89600' : '#27ae60';
        const sel = e.id === alvoId;
        return `<button ontouchend="event.preventDefault();_avtCtrlSelecionarAlvo('${e.id}')" onclick="_avtCtrlSelecionarAlvo('${e.id}')" style="${_iStyle(rgb, sel)}"><span style="color:${cor};font-size:0.6rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block">${e.nome}${sel?' ✓':''}</span><span style="font-size:0.5rem;color:rgba(255,255,255,0.4)">${e.hp}/${e.hpMax||e.hp}</span></button>`;
      }).join('');
    return;
  }

  // Montar listas vermelho/azul
  let vermelhos = [], azuis: any = [];
  if (bat && emMeuTurno) {
    vermelhos = bat.iniciativa.filter((e: any) => {
      if (e.tipo !== 'inimigo' || e.hp <= 0) return false;
      if (skSelecionada) {
        const d = Math.max(Math.abs(Math.round(e.x) - Math.round(jogador.x)), Math.abs(Math.round(e.y) - Math.round(jogador.y)));
        if (d > alcanceSk) return false;
      }
      return true;
    });
  }
  if (primAtaque || algumPerseguindo) {
    const maxAlc = typeof _avtMaxAlcanceJogador === 'function' ? _avtMaxAlcanceJogador(jogador) : 3;
    AVT_STATE.entidades.filter((e: any) => e.tipo === 'inimigo' && e.hp > 0 && !_avtBatalhaDeEnt(e.id)).forEach((e: any) => {
      if (Math.abs(e.x - jogador.x) + Math.abs(e.y - jogador.y) > maxAlc) return;
      if (skSelecionada) {
        const d = Math.max(Math.abs(Math.round(e.x) - Math.round(jogador.x)), Math.abs(Math.round(e.y) - Math.round(jogador.y)));
        if (d > alcanceSk) return;
      }
      const perseguindo = AVT_STATE.npcTimers[e.id]?.isPursuing && AVT_STATE.npcTimers[e.id]?.targetId === jogador.id;
      if (perseguindo) vermelhos.push(e); else azuis.push(e);
    });
  }

  const todos = [...vermelhos, ...azuis];
  if (!todos.length) {
    alvosEl.innerHTML = `<div style="font-size:0.58rem;color:rgba(255,255,255,0.3);text-align:center;padding:6px;font-family:var(--fonte-d)">Sem alvos no alcance</div>`;
    return;
  }

  const _iStyle = (rgb: any, sel: any) =>
    `width:100%;padding:3px 4px;border-radius:5px;background:rgba(${rgb},${sel?'0.25':'0.08'});border:1px solid rgba(${rgb},${sel?'0.7':'0.3'});cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;touch-action:manipulation;font-family:var(--fonte-d)`;

  alvosEl.innerHTML =
    `<div style="font-size:0.46rem;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:1px;font-family:var(--fonte-d);letter-spacing:.06em">ALVOS</div>` +
    vermelhos.map((e: any) => {
      const sel = e.id === alvoId;
      return `<button ontouchend="event.preventDefault();_avtCtrlSelecionarAlvo('${e.id}')" onclick="_avtCtrlSelecionarAlvo('${e.id}')" style="${_iStyle('232,96,76',sel)}"><span style="color:#e8604c;font-size:0.6rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block">${e.nome}${sel?' ✓':''}</span><span style="font-size:0.5rem;color:rgba(255,255,255,0.4)">${e.hp}/${e.hpMax||e.hp}</span></button>`;
    }).join('') +
    azuis.map((e: any) => {
      const sel = e.id === alvoId;
      return `<button ontouchend="event.preventDefault();_avtCtrlSelecionarAlvo('${e.id}')" onclick="_avtCtrlSelecionarAlvo('${e.id}')" style="${_iStyle('79,163,209',sel)}"><span style="color:#4fa3d1;font-size:0.6rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block">${e.nome}${sel?' ✓':''}</span><span style="font-size:0.5rem;color:rgba(255,255,255,0.4)">${e.hp}/${e.hpMax||e.hp}</span></button>`;
    }).join('');
}

// ── Atualizar zona central (stats + skills próprias + turno) ────────────
function _atualizarZonaCentral() {
  if (!MOBILE_CTRL.ativo) return;

  if (_emModoAventura()) {
    _atualizarZonaCentralAventura();
    return;
  }

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
  const statusAttrs = (RPG_DATA?.attr_defs || []).filter((a: any) => a.categoria === 'status' && a.nome !== 'HP' && a.nome !== 'Nível');
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
      const tabPet = document.getElementById('mc-tab-pet');
      tabPet.textContent = `🐾 ${petNome.split(' ')[0]}`;
      document.getElementById('mc-tab-char').style.background = MOBILE_CTRL.modoPet ? 'transparent'    : 'rgba(79,163,209,0.2)';
      document.getElementById('mc-tab-char').style.color      = MOBILE_CTRL.modoPet ? 'rgba(255,255,255,0.4)' : '#7ec8f0';
      tabPet.style.background  = MOBILE_CTRL.modoPet ? 'rgba(157,125,216,0.2)' : 'transparent';
      tabPet.style.color       = MOBILE_CTRL.modoPet ? '#b07ef0' : 'rgba(255,255,255,0.4)';
      // Pulse animation on first appearance to aid discoverability
      if (!(MOBILE_CTRL as any)._petTabShown) {
        (MOBILE_CTRL as any)._petTabShown = true;
        tabPet.style.animation = 'none';
        if (!document.getElementById('_mc-pet-pulse-style')) {
          const s = document.createElement('style');
          s.id = '_mc-pet-pulse-style';
          s.textContent = '@keyframes _mcPetPulse{0%,100%{box-shadow:0 0 0 0 rgba(176,126,240,0.6)}50%{box-shadow:0 0 0 6px rgba(176,126,240,0)}}';
          document.head.appendChild(s);
        }
        tabPet.style.animation = '_mcPetPulse 0.7s ease 3';
        tabPet.addEventListener('animationend', () => { tabPet.style.animation = ''; }, { once: true });
      }
    }
  }

  // ── Skills próprias — segunda linha no turno ativo (3.7) ─────────────
  const skWrap = document.getElementById('mc-skills-proprias');
  if (skWrap) {
    const emMeuTurno = _esMeuTurnoMobile(charNome);
    if (emMeuTurno) {
      const habilidades = atkGetHabilidadesCampanha(charNome);
      const skProprias  = habilidades.filter((h: any) => h.alvo_tipo === 'proprio');
      if (skProprias.length) {
        skWrap.style.display = 'flex';
        skWrap.innerHTML = skProprias.map((h: any) => `
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
    // Verificar zonas próximas
    let zonaHtml = '';
    if (charNome && MAPA_STATE?.mapaAtualId) {
      const meuChar = (RPG_DATA?.characters || []).find(c => c.nome === charNome);
      const minhaPos = meuChar?.map_positions?.[MAPA_STATE.mapaAtualId];
      const mapaEntry = (RPG_DATA?.mapas || []).find(m => m.mapa.map_id === MAPA_STATE.mapaAtualId);
      const zonas = mapaEntry?.mapa?.zonas || [];
      if (minhaPos && zonas.length) {
        const mc = minhaPos.col ?? minhaPos.x ?? 0;
        const mr = minhaPos.row ?? minhaPos.y ?? 0;
        const zonaProx = zonas.find((z: any) => {
          const dc = mc - (z.col ?? z.x ?? 0);
          const dr = mr - (z.row ?? z.y ?? 0);
          return Math.sqrt(dc*dc + dr*dr) <= (z.raio_celulas || 2);
        });
        if (zonaProx) zonaHtml = `<div style="font-size:0.5rem;color:rgba(200,168,75,0.9);margin-top:2px">📍 ${zonaProx.nome || 'Zona'}</div>`;
      }
    }
    turnoEl.innerHTML = (emTurno ? '⚔ Seu turno' : '⏳ Aguardando') + labelMestre + zonaHtml;
    turnoEl.style.color = emTurno ? 'rgba(94,224,154,0.8)' : 'rgba(200,168,75,0.5)';
  }
}

function _encontrarPetVinculado(donoNome: any) {
  if (!donoNome) return null;
  const pet = (RPG_DATA?.characters || []).find(c => {
    const ca = c.custom_attrs || {};
    return ca.eh_pet === true && ca.pet_dono === donoNome;
  });
  return pet?.nome || null;
}

function _esMeuTurnoMobile(charNome: any) {
  const batalhaId = BATALHA_ATUAL_ID;
  if (!batalhaId) return false;
  const bs = MAPA_STATE.batalhas[batalhaId];
  if (!bs || bs.fase !== 'combate' || bs.pausada) return false;
  const atual = bs.participantes?.[bs.ordemAtual];
  return atual?.nome === charNome;
}

// Alternar modo pet/personagem (3.8)
window.mobileCtrlSetModo = function(modoPet: any) {
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
window.mobileUsarSkillPropria = function(nomeSkill: any) {
  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome
    : RPG_DATA?.linked;
  if (!charNome) return;
  const h = atkGetHabilidadesCampanha(charNome).find((sk: any) => sk.nome === nomeSkill);
  if (!h) return;
  mapaAtaqueIniciar(charNome);
};

// ── Zona direita no modo aventura ───────────────────────────────────────
function _atualizarZonaDireitaAventura() {
  const ctxEl = document.getElementById('mc-ctx-botoes');
  if (!ctxEl) return;
  // ── FIX BUG #2 (scroll-snap): preservar scrollTop da lista de skills antes de rebuild
  const _prevScrollTop = document.getElementById('mc-skills-lista')?.scrollTop || 0;
  ctxEl.innerHTML = '';
  const aceitarIgnorarEl = document.getElementById('mc-aceitar-ignorar');
  if (aceitarIgnorarEl) aceitarIgnorarEl.innerHTML = '';

  // Remover círculos de aceitar/ignorar sempre (serão recriados abaixo se necessário)
  document.getElementById('avt-ctrl-aceitar-circulo')?.remove();
  document.getElementById('avt-ctrl-ignorar-circulo')?.remove();

  // ── FIX BUG #1 (skills atrás de aceitar/ignorar): reset do padding-bottom da zona direita.
  // Será re-aplicado abaixo somente quando aceitar/ignorar estiver visível.
  const _zonaDirEl = document.getElementById('mc-zona-dir');
  if (_zonaDirEl) _zonaDirEl.style.paddingBottom = '';



  const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
  const bat     = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
  const ativo   = typeof _avtAtivo === 'function' ? _avtAtivo() : null;
  const emMeuTurno = bat && ativo && jogador && ativo.id === jogador.id;
  const primAtaque = typeof AVT_STATE !== 'undefined' && (AVT_STATE._primeiroAtaqueAberto || AVT_STATE._primeiroAtaqueModoAlvo);
  const algumPerseguindo = jogador && typeof AVT_STATE !== 'undefined' && Object.values<any>(AVT_STATE.npcTimers || {}).some(t => t.isPursuing && t.targetId === jogador.id);

  const mostrarSkills = emMeuTurno || primAtaque || algumPerseguindo;

  if (!mostrarSkills) {
    if (bat && !emMeuTurno && ativo) {
      // Painel de observação
      const hpAtual = ativo.hp ?? '?';
      const hpMax   = ativo.hpMax ?? 1;
      const hpPct   = Math.round(Math.max(0, Math.min(100, (hpAtual / hpMax) * 100)));
      const hpCor   = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';
      const obs = document.createElement('div');
      obs.style.cssText = 'width:100%;font-family:var(--fonte-d);font-size:0.6rem;text-align:center;padding:6px 4px';
      obs.innerHTML = `
        <div style="color:rgba(200,168,75,0.6);font-size:0.55rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Rodada ${bat.turno_round||1}</div>
        <div style="color:rgba(255,255,255,0.7);margin-bottom:6px">⚔ <strong style="color:#f0cc6a">${ativo.nome}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:${hpCor}"><span>HP</span><span>${hpAtual}/${hpMax}</span></div>
        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin:2px 0"><div style="height:100%;width:${hpPct}%;background:${hpCor};border-radius:2px;transition:width 0.4s"></div></div>
        <div style="color:rgba(255,255,255,0.3);font-size:0.52rem;margin-top:6px">Aguardando seu turno…</div>`;
      ctxEl.appendChild(obs);
    }
    return;
  }

  if (typeof AVT_STATE === 'undefined' || !jogador) return;

  const skId   = (AVT_STATE as any)._pendingSkillId;
  const alvoId = AVT_STATE.alvoSelecionado;

  // Calcular distância ao alvo selecionado
  let alvoDistancia = null;
  if (alvoId) {
    let alvoEnt = bat ? bat.iniciativa.find((e: any) => e.id === alvoId) : AVT_STATE.entidades.find((e: any) => e.id === alvoId);
    if (alvoEnt) alvoDistancia = Math.max(Math.abs(Math.round(alvoEnt.x) - Math.round(jogador.x)), Math.abs(Math.round(alvoEnt.y) - Math.round(jogador.y)));
  }

  // Montar itens de skill (com número e dbChar para ordenação)
  const _dbCharCtrl = AVT_STATE.chars.find((c: any) => c.id === jogador.dbId || c.nome === jogador.nome);
  const _getNum = (skId2: any) => (typeof _avtGetSkillNumero === 'function' ? _avtGetSkillNumero(_dbCharCtrl, jogador, skId2) : null);

  // No modo controle aventura, o ataque básico é automático — não exibir como botão manual
  const _ctrlAventuraDisp = MOBILE_CTRL?.ativo && MOBILE_CTRL?.modoTela === 'dispositivo';

  const skillItems = [];
  if (bat && emMeuTurno) {
    const _charSkillIds = _dbCharCtrl?.custom_attrs?.skills_ids || [];
    let mySkills = AVT_STATE.skills.filter((sk: any) =>
      _charSkillIds.includes(sk.id) || sk.personagem === jogador.nome || (sk.character_id && sk.character_id === jogador.dbId)
    );
    if (typeof _avtSkillsOrdenadasPorNumero === 'function') mySkills = _avtSkillsOrdenadasPorNumero(mySkills, _dbCharCtrl, jogador);
    if (!_ctrlAventuraDisp) {
      skillItems.push({ id: null, nome: 'Ataque básico', formula: '1d8', alcance: 1, cd: 0, num: null, basico: true });
    }
    for (const sk of mySkills) {
      const cd = (bat._cooldowns || {})[jogador.id + '_' + sk.id] || 0;
      skillItems.push({ id: sk.id, nome: sk.habilidade, formula: sk.formula_dano || '1d6', alcance: sk.alcance_celulas ?? 1, cd, num: _getNum(sk.id) });
    }
  } else {
    if (!_ctrlAventuraDisp) {
      const _abCfg  = _dbCharCtrl?.custom_attrs?.ataque_basico;
      const _abKey  = (jogador.id || jogador.nome) + '_basico';
      const _abCdMs = (AVT_STATE._oocCooldowns[_abKey] || 0) - Date.now();
      skillItems.push({ id: null as any, nome: _abCfg?.nome || 'Ataque básico', formula: _abCfg?.formula_dano || '1d8', alcance: _abCfg?.alcance_celulas ?? 1, cd: _abCdMs > 0 ? Math.ceil(_abCdMs/1000) : 0, num: null as any, basico: true });
    }
    let minhas = AVT_STATE.skills.filter((sk: any) =>
      (sk.personagem === jogador.nome || (sk.character_id && sk.character_id === jogador.dbId)) &&
      sk.tipo_dano && sk.tipo_dano !== 'cura'
    );
    if (typeof _avtSkillsOrdenadasPorNumero === 'function') minhas = _avtSkillsOrdenadasPorNumero(minhas, _dbCharCtrl, jogador);
    for (const sk of minhas) {
      const cdMs = (AVT_STATE._oocCooldowns[(jogador.id||jogador.nome) + '_' + sk.id] || 0) - Date.now();
      skillItems.push({ id: sk.id, nome: sk.habilidade, formula: sk.formula_dano || '1d6', alcance: sk.alcance_celulas ?? 1, cd: cdMs > 0 ? Math.ceil(cdMs/1000) : 0, num: _getNum(sk.id) });
    }
  }

  const charKey = (jogador && (jogador.dbId || jogador.nome)) || '';
  const ultId = _dbCharCtrl?.custom_attrs?.arc_skill_id || null;
  const recolhido = !!MOBILE_CTRL.skillsRecolhidas;

  // Ajusta largura/layout da coluna ctxEl e dos alvos
  const _dirRow = document.getElementById('mc-dir-row');
  const _alvosEl = document.getElementById('mc-alvos-central');
  if (recolhido) {
    // Arco: container quadrado de 160px com posicionamento absoluto dos filhos
    ctxEl.style.flex = '0 0 auto';
    ctxEl.style.width = '160px';
    ctxEl.style.height = '160px';
    ctxEl.style.overflow = 'visible';
    ctxEl.style.position = 'relative';
    ctxEl.style.display = 'block';
  } else {
    ctxEl.style.flex = '6';
    ctxEl.style.width = '';
    ctxEl.style.height = '';
    ctxEl.style.overflow = '';
    ctxEl.style.position = '';
    ctxEl.style.display = '';
  }
  if (_alvosEl) {
    if (recolhido) {
      _alvosEl.style.flex = '0 0 auto';
      _alvosEl.style.width = 'calc(40% - 1px)';
      if (_dirRow) _dirRow.style.justifyContent = 'flex-end';
    } else {
      _alvosEl.style.flex = '4';
      _alvosEl.style.width = '';
      if (_dirRow) _dirRow.style.justifyContent = '';
    }
  }

  if (recolhido) {
    // ── Anel de skills em 1/4 de círculo (270° Norte → 180° Oeste) ──────────
    // Skills sem cooldown primeiro (em ordem numérica), em cooldown por último
    const ordenados = _mcSkillsOrdenados(skillItems);
    MOBILE_CTRL._skillRodaTotal = Math.max(1, ordenados.length);
    MOBILE_CTRL.skillRodaOffset = MOBILE_CTRL.skillRodaOffset % MOBILE_CTRL._skillRodaTotal;
    const totalAnelItems = ordenados.length;

    // Janela de 3 skills visíveis a partir do offset atual (circular)
    const visiveis = Array.from({ length: Math.min(3, totalAnelItems) }, (_, i) =>
      ordenados[(MOBILE_CTRL.skillRodaOffset + i) % totalAnelItems]
    );

    // Botão Ult: skill marcada como ultimate, no centro do arco (z-index inferior aos outros)
    const ultItem = ultId ? skillItems.find(sk => sk.id === ultId) : null;
    const isUltSel = skId === ultId && !!ultItem;
    const isUltDisabled = !ultItem || ultItem.cd > 0 || (alvoDistancia !== null && alvoDistancia > ultItem.alcance);
    const ultLabel = !ultItem ? '⚡' : (ultItem.cd > 0 ? '⏱' : (ultItem.num != null ? String(ultItem.num) : '⚡'));
    const btnUlt = document.createElement('button');
    btnUlt.style.cssText = `position:absolute;top:66px;left:66px;` +
      `width:54px;height:54px;padding:0;border-radius:50%;` +
      `background:rgba(${isUltSel?'200,168,75,0.45':ultItem?'150,80,220,0.28':'100,60,150,0.12'});` +
      `border:2px solid rgba(${isUltSel?'200,168,75,0.9':ultItem?'150,80,220,0.65':'130,80,180,0.3'});` +
      `font-family:var(--fonte-d);font-size:${ultItem?'0.78':'0.85'}rem;font-weight:600;` +
      `color:${isUltSel?'#c8a84b':ultItem?'#d8a8f8':'rgba(180,120,240,0.4)'};` +
      `cursor:${!isUltDisabled?'pointer':'default'};touch-action:manipulation;` +
      `display:flex;align-items:center;justify-content:center;z-index:1;` +
      `opacity:${isUltDisabled&&ultItem?'0.45':'1'};pointer-events:${!isUltDisabled?'auto':'none'}`;
    btnUlt.textContent = ultLabel;
    btnUlt.title = ultItem ? ultItem.nome + (ultItem.cd > 0 ? ` (⏱${ultItem.cd}s)` : '') : 'Nenhuma skill marcada como Ult';
    if (!isUltDisabled) {
      const ultIdCapture = ultId;
      btnUlt.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlSelecionarSkill(ultIdCapture); });
      btnUlt.addEventListener('click', () => _avtCtrlSelecionarSkill(ultIdCapture));
    }
    ctxEl.appendChild(btnUlt);

    // Botão Norte (slot 0): avança o anel; scroll direita = retrocede
    const btnNorte = document.createElement('button');
    const posN = _ARC_SLOTS[0];
    btnNorte.style.cssText = `position:absolute;top:${posN.top}px;left:${posN.left}px;` +
      `width:44px;height:44px;padding:0;border-radius:50%;` +
      `background:rgba(79,163,209,0.18);border:1.5px solid rgba(79,163,209,0.55);` +
      `color:#7ec8f0;font-size:0.85rem;line-height:1;cursor:pointer;touch-action:manipulation;` +
      `display:flex;align-items:center;justify-content:center;z-index:2`;
    btnNorte.innerHTML = '▲';
    btnNorte.title = 'Próxima skill →';
    btnNorte.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlRolarSkillDireita(); });
    btnNorte.addEventListener('click', () => _avtCtrlRolarSkillDireita());
    btnNorte.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.deltaX > 0 || e.deltaY > 0) _avtCtrlRolarSkillEsquerda();
      else _avtCtrlRolarSkillDireita();
    }, { passive: false });
    ctxEl.appendChild(btnNorte);

    // 3 botões de skill nos slots 1–3 do arco
    for (let i = 0; i < visiveis.length; i++) {
      const item = visiveis[i];
      const pos = _ARC_SLOTS[i + 1];
      const isSel = skId === item.id;
      const isDisabled = item.cd > 0 || (alvoDistancia !== null && alvoDistancia > item.alcance);
      const label = item.basico ? '⚔' : (item.num != null ? String(item.num) : '•');
      const btn = document.createElement('button');
      btn.style.cssText = `position:absolute;top:${pos.top}px;left:${pos.left}px;` +
        `width:44px;height:44px;padding:0;border-radius:50%;` +
        `background:rgba(${isSel?'200,168,75,0.45':'79,163,209,0.25'});` +
        `border:1.5px solid rgba(${isSel?'200,168,75,0.9':'79,163,209,0.5'});` +
        `font-family:var(--fonte-d);font-size:${item.basico?'0.85':'0.72'}rem;font-weight:600;` +
        `color:${isSel?'#c8a84b':'#c8d8e8'};cursor:pointer;touch-action:manipulation;` +
        `display:flex;align-items:center;justify-content:center;z-index:2;` +
        `opacity:${isDisabled?'0.4':'1'};pointer-events:${isDisabled?'none':'auto'}`;
      btn.textContent = item.cd > 0 ? '⏱' : label;
      btn.title = item.nome + (item.cd > 0 ? ` (⏱${item.cd}s)` : '');
      const itemId = item.id;
      btn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlSelecionarSkill(itemId); });
      btn.addEventListener('click', () => _avtCtrlSelecionarSkill(itemId));
      ctxEl.appendChild(btn);
    }

    // Botão Oeste (slot 4): retrocede o anel
    const btnOeste = document.createElement('button');
    const posO = _ARC_SLOTS[4];
    btnOeste.style.cssText = `position:absolute;top:${posO.top}px;left:${posO.left}px;` +
      `width:44px;height:44px;padding:0;border-radius:50%;` +
      `background:rgba(79,163,209,0.18);border:1.5px solid rgba(79,163,209,0.55);` +
      `color:#7ec8f0;font-size:0.85rem;line-height:1;cursor:pointer;touch-action:manipulation;` +
      `display:flex;align-items:center;justify-content:center;z-index:2`;
    btnOeste.innerHTML = '◀';
    btnOeste.title = '← Skill anterior';
    btnOeste.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlRolarSkillEsquerda(); });
    btnOeste.addEventListener('click', () => _avtCtrlRolarSkillEsquerda());
    ctxEl.appendChild(btnOeste);

    // Botão expandir (fora do arco, canto superior-direito)
    const expandBtn = document.createElement('button');
    expandBtn.style.cssText = `position:absolute;top:-28px;left:138px;` +
      `width:40px;height:18px;padding:0;` +
      `background:rgba(79,163,209,0.18);border:1px solid rgba(79,163,209,0.45);border-radius:4px;` +
      `color:#7ec8f0;font-size:0.7rem;line-height:1;cursor:pointer;touch-action:manipulation`;
    expandBtn.innerHTML = '▶';
    expandBtn.title = 'Expandir skills';
    expandBtn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlToggleSkills(); });
    expandBtn.addEventListener('click', () => _avtCtrlToggleSkills());
    ctxEl.appendChild(expandBtn);

    // Auto-alvo compacto (fora do arco, abaixo do botão Norte)
    const autoAtivoArc = MOBILE_CTRL.autoAlvo;
    const autoBtnArc = document.createElement('button');
    autoBtnArc.style.cssText = `position:absolute;top:${posN.top + 46}px;left:${posN.left}px;` +
      `width:44px;height:20px;padding:0;border-radius:4px;font-size:0.6rem;cursor:pointer;touch-action:manipulation;` +
      `background:rgba(${autoAtivoArc?'94,224,154,0.3':'255,255,255,0.07'});` +
      `border:1px solid rgba(${autoAtivoArc?'94,224,154,0.6':'255,255,255,0.2'})`;
    autoBtnArc.textContent = '🎯';
    autoBtnArc.title = autoAtivoArc ? 'Auto-alvo ativo' : 'Auto-alvo inativo';
    autoBtnArc.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlToggleAutoAlvo(); });
    autoBtnArc.addEventListener('click', () => _avtCtrlToggleAutoAlvo());
    ctxEl.appendChild(autoBtnArc);

  } else {
    // ── Modo expandido: lista vertical original ──────────────────────────────

    // Botão toggle collapse
    const toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = `align-self:flex-end;width:22px;height:18px;padding:0;margin-bottom:3px;` +
      `background:rgba(79,163,209,0.18);border:1px solid rgba(79,163,209,0.45);border-radius:4px;` +
      `color:#7ec8f0;font-size:0.7rem;line-height:1;cursor:pointer;touch-action:manipulation;flex-shrink:0`;
    toggleBtn.innerHTML = '▶';
    toggleBtn.title = 'Recolher skills';
    toggleBtn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlToggleSkills(); });
    toggleBtn.addEventListener('click', () => _avtCtrlToggleSkills());
    ctxEl.appendChild(toggleBtn);

    // Lista de skills
    const listEl = document.createElement('div');
    listEl.id = 'mc-skills-lista';
    listEl.style.cssText = 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:3px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;width:100%';

    for (const item of skillItems) {
      const isSel = skId === item.id;
      const isDisabled = item.cd > 0 || (alvoDistancia !== null && alvoDistancia > item.alcance);
      const btn = document.createElement('button');
      btn.style.cssText = `flex:1;min-width:0;padding:5px 6px;border-radius:6px;` +
        `background:rgba(${isSel?'200,168,75,0.38':'79,163,209,0.22'});` +
        `border:1px solid rgba(${isSel?'200,168,75,0.8':'79,163,209,0.45'});` +
        `font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;touch-action:manipulation;` +
        `display:flex;flex-direction:column;align-items:flex-start;text-align:left;` +
        `opacity:${isDisabled?'0.35':'1'};pointer-events:${isDisabled?'none':'auto'}`;
      const numTag = (item.num != null && !item.basico) ? `<span style="color:#c8a84b;margin-right:4px">#${item.num}</span>` : '';
      btn.innerHTML = `<span style="color:${isSel?'#c8a84b':'#c8d8e8'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;width:100%">${numTag}${item.nome}${item.cd>0?` ⏱${item.cd}s`:''}</span><span style="font-size:0.5rem;color:#7a92aa">⟷${item.alcance}</span>`;
      const itemId = item.id;
      btn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlSelecionarSkill(itemId); });
      btn.addEventListener('click', () => _avtCtrlSelecionarSkill(itemId));
      if (item.id) {
        const rowEl = document.createElement('div');
        rowEl.style.cssText = 'display:flex;gap:3px;align-items:stretch;width:100%';
        const isUltThis = ultId === item.id;
        const ultToggle = document.createElement('button');
        ultToggle.style.cssText = `width:22px;flex-shrink:0;padding:0;border-radius:6px;font-size:0.7rem;cursor:pointer;touch-action:manipulation;` +
          `background:rgba(${isUltThis?'150,80,220,0.45':'255,255,255,0.05'});` +
          `border:1px solid rgba(${isUltThis?'150,80,220,0.8':'255,255,255,0.15'});` +
          `color:${isUltThis?'#d8a8f8':'rgba(200,180,220,0.35)'}`;
        ultToggle.textContent = '⚡';
        ultToggle.title = isUltThis ? 'Desmarcar como Arc' : 'Marcar como Arc';
        const capEntId = jogador.id, capId = item.id;
        ultToggle.addEventListener('touchend', e => { e.preventDefault(); if (typeof _avtSetArcSkill === 'function') _avtSetArcSkill(capEntId, capId); });
        ultToggle.addEventListener('click', () => { if (typeof _avtSetArcSkill === 'function') _avtSetArcSkill(capEntId, capId); });
        rowEl.appendChild(btn);
        rowEl.appendChild(ultToggle);
        listEl.appendChild(rowEl);
      } else {
        listEl.appendChild(btn);
      }
    }
    ctxEl.appendChild(listEl);
    // ── FIX BUG #2 (scroll-snap): restaurar scrollTop após rebuild da lista de skills
    if (_prevScrollTop > 0) {
      requestAnimationFrame(() => { listEl.scrollTop = _prevScrollTop; });
    }

    // Toggle auto-alvo (modo expandido)
    const autoRow = document.createElement('div');
    autoRow.style.cssText = 'display:flex;gap:3px;margin-top:4px;width:100%;flex-shrink:0';
    const autoAtivo = MOBILE_CTRL.autoAlvo;
    const autoBtn = document.createElement('button');
    autoBtn.style.cssText = `flex:1;padding:4px 5px;border-radius:4px;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;touch-action:manipulation;text-align:left;` +
      `background:rgba(${autoAtivo?'94,224,154,0.25':'255,255,255,0.07'});border:1px solid rgba(${autoAtivo?'94,224,154,0.55':'255,255,255,0.18'});` +
      `color:${autoAtivo?'#5ee09a':'rgba(255,255,255,0.45)'}`;
    autoBtn.textContent = autoAtivo ? '🎯 Auto' : '🎯 Manual';
    if (autoAtivo) {
      const prefBtn = document.createElement('button');
      prefBtn.style.cssText = `padding:4px 5px;border-radius:4px;font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer;touch-action:manipulation;` +
        `background:rgba(200,168,75,0.2);border:1px solid rgba(200,168,75,0.45);color:#c8a84b`;
      prefBtn.textContent = MOBILE_CTRL.autoAlvoPrefMenorHP ? '❤️↓HP' : '📍Próx';
      prefBtn.title = MOBILE_CTRL.autoAlvoPrefMenorHP ? 'Preferência: menor HP' : 'Preferência: mais próximo';
      prefBtn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlToggleAutoAlvoPref(); });
      prefBtn.addEventListener('click', () => _avtCtrlToggleAutoAlvoPref());
      autoRow.appendChild(prefBtn);
    }
    autoBtn.addEventListener('touchend', e => { e.preventDefault(); _avtCtrlToggleAutoAlvo(); });
    autoBtn.addEventListener('click', () => _avtCtrlToggleAutoAlvo());
    autoRow.appendChild(autoBtn);
    ctxEl.appendChild(autoRow);
  }

  // Botões compactos mover/passar (somente em combate)
  if (emMeuTurno && bat) {
    const moverAtivo = bat.moverModo;
    const movRest = bat.movimentoRestante?.[jogador?.id] ?? (typeof _avtGetMovimentoMax === 'function' ? _avtGetMovimentoMax(jogador) : '?');
    const btnsRow = document.createElement('div');
    btnsRow.style.cssText = 'display:flex;gap:3px;margin-top:3px;width:100%;flex-shrink:0';
    const btnMov = document.createElement('button');
    btnMov.style.cssText = `flex:1;padding:4px 3px;background:rgba(${moverAtivo?'94,224,154':'79,163,209'},0.22);border:1px solid rgba(${moverAtivo?'94,224,154':'79,163,209'},0.55);border-radius:6px;font-family:var(--fonte-d);font-size:0.55rem;color:${moverAtivo?'#5ee09a':'#7ec8f0'};cursor:pointer;touch-action:manipulation;min-height:32px`;
    btnMov.textContent = `🚶 ${movRest}`;
    btnMov.addEventListener('touchend', e => { e.preventDefault(); if (typeof avtHudMover === 'function') { avtHudMover(); _atualizarZonaDireita(); } });
    btnMov.addEventListener('click', () => { if (typeof avtHudMover === 'function') { avtHudMover(); _atualizarZonaDireita(); } });
    const btnPass = document.createElement('button');
    btnPass.style.cssText = 'flex:1;padding:4px 3px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.3);border-radius:6px;font-family:var(--fonte-d);font-size:0.55rem;color:#c0392b;cursor:pointer;touch-action:manipulation;min-height:32px';
    btnPass.textContent = '→ Passar';
    btnPass.addEventListener('touchend', e => { e.preventDefault(); if (typeof avtHudPassar === 'function') avtHudPassar(); });
    btnPass.addEventListener('click', () => { if (typeof avtHudPassar === 'function') avtHudPassar(); });
    btnsRow.appendChild(btnMov);
    btnsRow.appendChild(btnPass);
    ctxEl.appendChild(btnsRow);
  }

  // Botões de primeiro ataque (aceitar combate / ignorar)
  // No modo controle aventura: círculos fixed acima dos skills (canto direito)
  // Fora do modo controle: botões tradicionais no #mc-aceitar-ignorar
  const algPersegNaoIgnorado = primAtaque && Object.entries<any>(AVT_STATE.npcTimers || {}).some(([id, t]) =>
    t.isPursuing && t.targetId === jogador?.id &&
    !(AVT_STATE._inimigosIgnorados || []).includes(id)
  );

  if (primAtaque && aceitarIgnorarEl) {
    if (_ctrlAventuraDisp) {
      // Modo controle: círculos fixed acima da zona de controle (canto direito)
      const _overlayEl = document.getElementById('mobile-ctrl-overlay');
      const _overlayH = _overlayEl ? _overlayEl.getBoundingClientRect().height : 160;
      const _btnBase = `position:fixed;right:10px;width:38px;height:38px;border-radius:50%;` +
        `z-index:9210;color:#fff;font-size:0.9rem;cursor:pointer;touch-action:manipulation;` +
        `display:flex;align-items:center;justify-content:center;font-family:var(--fonte-d);border:2px solid;`;

      if (algPersegNaoIgnorado) {
        const btnAc = document.createElement('button');
        btnAc.id = 'avt-ctrl-aceitar-circulo';
        btnAc.style.cssText = _btnBase +
          `bottom:${_overlayH + 52}px;background:rgba(232,96,76,0.92);border-color:rgba(232,96,76,1)`;
        btnAc.title = 'Aceitar Combate';
        btnAc.innerHTML = '⚔';
        btnAc.addEventListener('touchend', e => { e.preventDefault(); if (typeof _avtAceitarCombate === 'function') _avtAceitarCombate(); });
        btnAc.addEventListener('click', () => { if (typeof _avtAceitarCombate === 'function') _avtAceitarCombate(); });
        document.body.appendChild(btnAc);
      }

      const btnIgn = document.createElement('button');
      btnIgn.id = 'avt-ctrl-ignorar-circulo';
      btnIgn.style.cssText = _btnBase +
        `bottom:${_overlayH + 8}px;background:rgba(200,168,75,0.92);border-color:rgba(200,168,75,1)`;
      btnIgn.title = 'Ignorar';
      btnIgn.innerHTML = '✕';
      btnIgn.addEventListener('touchend', e => { e.preventDefault(); if (typeof _avtFecharPrimeiroAtaqueModal === 'function') { _avtFecharPrimeiroAtaqueModal(); _atualizarZonaDireita(); _atualizarZonaCentral(); } });
      btnIgn.addEventListener('click', () => { if (typeof _avtFecharPrimeiroAtaqueModal === 'function') { _avtFecharPrimeiroAtaqueModal(); _atualizarZonaDireita(); _atualizarZonaCentral(); } });
      document.body.appendChild(btnIgn);
    } else {
      // Fora do modo controle: botões tradicionais
      if (_zonaDirEl) _zonaDirEl.style.paddingBottom = '96px';
      if (algPersegNaoIgnorado) {
        const btnAc = document.createElement('button');
        btnAc.style.cssText = 'width:100%;padding:5px 4px;background:rgba(232,96,76,0.88);border:1px solid rgba(232,96,76,1);border-radius:5px;color:#fff;cursor:pointer;font-size:0.58rem;font-family:var(--fonte-d);touch-action:manipulation;font-weight:600';
        btnAc.textContent = '⚔ Aceitar Combate';
        btnAc.addEventListener('touchend', e => { e.preventDefault(); if (typeof _avtAceitarCombate === 'function') _avtAceitarCombate(); });
        btnAc.addEventListener('click', () => { if (typeof _avtAceitarCombate === 'function') _avtAceitarCombate(); });
        aceitarIgnorarEl.appendChild(btnAc);
      }
      const btnIgn = document.createElement('button');
      btnIgn.style.cssText = 'width:100%;padding:4px;background:rgba(80,30,20,0.9);border:1px solid rgba(192,57,43,0.8);border-radius:5px;color:rgba(255,160,140,1);cursor:pointer;font-size:0.55rem;font-family:var(--fonte-d);touch-action:manipulation;font-weight:600';
      btnIgn.textContent = '✕ Ignorar';
      btnIgn.addEventListener('touchend', e => { e.preventDefault(); if (typeof _avtFecharPrimeiroAtaqueModal === 'function') { _avtFecharPrimeiroAtaqueModal(); _atualizarZonaDireita(); _atualizarZonaCentral(); } });
      btnIgn.addEventListener('click', () => { if (typeof _avtFecharPrimeiroAtaqueModal === 'function') { _avtFecharPrimeiroAtaqueModal(); _atualizarZonaDireita(); _atualizarZonaCentral(); } });
      aceitarIgnorarEl.appendChild(btnIgn);
    }
  }
}


// ── Funções de controle adventure device ────────────────────────────────
window._avtCtrlSelecionarSkill = function(skId: any) {
  if (typeof AVT_STATE === 'undefined') return;
  (AVT_STATE as any)._pendingSkillId = skId;
  // Se alvo selecionado mas fora do alcance da nova skill, limpar alvo
  if (AVT_STATE.alvoSelecionado && skId != null) {
    const sk = skId ? AVT_STATE.skills.find((s: any) => s.id === skId) : null;
    const alcance = sk?.alcance_celulas ?? 1;
    const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    let alvoEnt = bat ? bat.iniciativa.find((e: any) => e.id === AVT_STATE.alvoSelecionado) : AVT_STATE.entidades.find((e: any) => e.id === AVT_STATE.alvoSelecionado);
    if (jogador && alvoEnt) {
      const d = Math.max(Math.abs(Math.round(alvoEnt.x) - Math.round(jogador.x)), Math.abs(Math.round(alvoEnt.y) - Math.round(jogador.y)));
      if (d > alcance) AVT_STATE.alvoSelecionado = null;
    }
  }
  // Ativar grade de alcance no canvas para primeiro ataque
  if (AVT_STATE._primeiroAtaqueAberto || AVT_STATE._primeiroAtaqueModoAlvo) {
    const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
    if (jogador && typeof _avtAtivarModoAlvoPrimeiroAtaque === 'function') {
      _avtAtivarModoAlvoPrimeiroAtaque(skId ?? null, jogador);
    }
  } else if (typeof _avtMinhaBatalha === 'function' && _avtMinhaBatalha()) {
    // Combate normal: ativar modo alvo no canvas
    const ativo = typeof _avtAtivo === 'function' ? _avtAtivo() : null;
    if (ativo && typeof _avtAtivarModoAlvo === 'function') _avtAtivarModoAlvo(skId ?? null, ativo);
  }
  // Auto-alvo: seleciona melhor alvo automaticamente (e executa via _avtCtrlSelecionarAlvo)
  if (MOBILE_CTRL.autoAlvo) { _avtCtrlAplicarAutoAlvo(); return; }
  // Alvo já selecionado e em alcance → auto-executar
  if (AVT_STATE.alvoSelecionado && skId !== undefined) { _avtCtrlSelecionarAlvo(AVT_STATE.alvoSelecionado); return; }
  _atualizarZonaDireita();
  _atualizarZonaCentral();
};

window._avtCtrlSelecionarAlvo = function(entId: any) {
  if (typeof AVT_STATE === 'undefined') return;
  // Skill de aliado: executar diretamente sem passar por lógica de inimigo
  const _skIdAlv = (AVT_STATE as any)._pendingSkillId;
  const _skAlv = _skIdAlv ? AVT_STATE.skills.find((s: any) => s.id === _skIdAlv) : null;
  if (_skAlv?.alvo_tipo === 'aliado') {
    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    (AVT_STATE as any)._pendingSkillId = undefined;
    AVT_STATE.alvoSelecionado = null;
    if (bat && typeof _avtExecutarSkillEmAliado === 'function') {
      _avtExecutarSkillEmAliado(_skIdAlv, entId);
    } else if (typeof _avtAplicarSkillAliadoOoc === 'function') {
      _avtAplicarSkillAliadoOoc(_skIdAlv, entId);
    }
    _atualizarZonaDireita();
    _atualizarZonaCentral();
    return;
  }
  AVT_STATE.alvoSelecionado = entId;
  const skId = (AVT_STATE as any)._pendingSkillId;
  if (skId !== undefined) {
    const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    const sk = skId ? AVT_STATE.skills.find((s: any) => s.id === skId) : null;
    const alcanceSk = sk?.alcance_celulas ?? 1;
    let alvoEnt = bat
      ? bat.iniciativa.find((e: any) => e.id === entId && e.hp > 0)
      : AVT_STATE.entidades.find((e: any) => e.id === entId && e.hp > 0 && (typeof _avtBatalhaDeEnt !== 'function' || !_avtBatalhaDeEnt(e.id)));
    if (jogador && alvoEnt) {
      const dist = Math.max(Math.abs(Math.round(alvoEnt.x) - Math.round(jogador.x)), Math.abs(Math.round(alvoEnt.y) - Math.round(jogador.y)));
      if (dist <= alcanceSk) { _avtCtrlRolarDados(); return; }
    }
  }
  _atualizarZonaDireita();
  _atualizarZonaCentral();
};

window._avtCtrlRolarDados = function() {
  if (typeof AVT_STATE === 'undefined') return;
  const primAtaque = AVT_STATE._primeiroAtaqueAberto || AVT_STATE._primeiroAtaqueModoAlvo;
  if (primAtaque) {
    const skId   = (AVT_STATE as any)._pendingSkillId ?? null;
    const alvoId = AVT_STATE.alvoSelecionado;
    if (!alvoId) return;
    AVT_STATE._primeiroAtaqueAberto = false;
    AVT_STATE._primeiroAtaqueModoAlvo = null;
    (AVT_STATE as any)._habilidadeRange = null;
    (AVT_STATE as any)._primeiroAtaqueAlvoSelecionadoMobile = null;
    (AVT_STATE as any)._pendingSkillId = undefined;
    AVT_STATE.alvoSelecionado = null;
    _atualizarZonaDireita();
    _atualizarZonaCentral();
    document.getElementById('avt-btn-rolar')?.remove();
    if (typeof _avtExecutarPrimeiroAtaque === 'function') _avtExecutarPrimeiroAtaque(skId, alvoId);
  } else {
    if (typeof _avtRolarDados === 'function') _avtRolarDados();
  }
};

// ── Zona direita: botões contextuais (3.10 — máx 3 + "...") ────────────
function _atualizarZonaDireita() {
  if (!MOBILE_CTRL.ativo) return;
  const ctxEl = document.getElementById('mc-ctx-botoes');
  if (!ctxEl) return;

  if (_emModoAventura()) {
    _atualizarZonaDireitaAventura();
    return;
  }

  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome : RPG_DATA?.linked;
  const mapId = MAPA_STATE?.mapaAtualId;
  ctxEl.innerHTML = '';

  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const isMestre = RPG_DATA?.myRole === 'mestre';

  // ── Trigger de confirmação de ataque pendente ─────────────────────
  if (window._CTRL_TRIGGER_ATIVO) {
    const t = window._CTRL_TRIGGER_ATIVO;
    const labelDano = t.danoTotal != null
      ? (t.ehCura ? `${t.danoTotal} cura` : `${t.danoTotal} dano`)
      : '';
    const btnConf = document.createElement('button');
    btnConf.style.cssText = 'width:100%;min-height:56px;padding:10px;background:linear-gradient(135deg,rgba(192,57,43,0.35),rgba(192,57,43,0.18));border:2px solid rgba(192,57,43,0.7);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;touch-action:manipulation;margin-bottom:5px;animation:pulse 1s infinite';
    btnConf.innerHTML = `<div>${t.ehCritico ? '🎯 CRÍTICO! ' : '⚔ '}${t.nomeAtaque}</div><div style="font-size:0.9rem;font-weight:700;margin-top:2px">${labelDano}</div><div style="font-size:0.55rem;opacity:0.7;margin-top:2px">toque para confirmar</div>`;
    btnConf.addEventListener('touchend', e => {
      e.preventDefault();
      if (typeof _atkTriggerAnimacao === 'function') _atkTriggerAnimacao();
    });
    ctxEl.appendChild(btnConf);
    return;
  }

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
    const atacanteNomeTurno = atual?.nome;
    const isMinhaVez = atual && (isMestre || atacanteNomeTurno === RPG_DATA?.linked);

    if (!isMinhaVez && atual) {
      // Painel de observação: mostra quem está agindo e HP do combatente atual
      const charAtual = (RPG_DATA?.characters || []).find(c => c.nome === atacanteNomeTurno);
      const hpAtual = charAtual?.hp_atual ?? '?';
      const hpMax   = charAtual?.hp_max ?? charAtual?.custom_attrs?.hp_max ?? '?';
      const hpPct   = (charAtual && hpMax !== '?') ? Math.round(((hpAtual as any) / (hpMax as any)) * 100) : 50;
      const hpCor   = hpPct > 60 ? '#5ee09a' : hpPct > 30 ? '#f0cc6a' : '#e74c3c';
      const rodada  = bs.turno_round || 1;
      const obs = document.createElement('div');
      obs.style.cssText = 'width:100%;font-family:var(--fonte-d);font-size:0.6rem;text-align:center;padding:6px 4px';
      obs.innerHTML = `
        <div style="color:rgba(200,168,75,0.6);margin-bottom:4px;font-size:0.55rem;text-transform:uppercase;letter-spacing:.06em">Rodada ${rodada}</div>
        <div style="color:rgba(255,255,255,0.7);margin-bottom:6px">⚔ <strong style="color:#f0cc6a">${atacanteNomeTurno}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:${hpCor}">
          <span>HP</span><span>${hpAtual}/${hpMax}</span>
        </div>
        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px;margin:2px 0">
          <div style="height:100%;width:${hpPct}%;background:${hpCor};border-radius:2px;transition:width 0.4s"></div>
        </div>
        <div style="color:rgba(255,255,255,0.3);font-size:0.52rem;margin-top:6px">Aguardando seu turno…</div>
      `;
      ctxEl.appendChild(obs);
    }

    if (isMinhaVez) {
      // Se há fluxo de ataque ativo neste modo mobile, mostrar inline
      const mAtk = window._MESA_ATK_STATE;
      if (mAtk?._fromMobile && mAtk.step >= 1) {
        const habilidades = atacanteNomeTurno
          ? (typeof atkGetHabilidadesCampanha === 'function' ? atkGetHabilidadesCampanha(atacanteNomeTurno) : [])
          : [];
        const html = typeof _mesaRenderAtaqueInline === 'function'
          ? _mesaRenderAtaqueInline(atacanteNomeTurno, habilidades)
          : '';
        if (html) {
          const wrap = document.createElement('div');
          wrap.innerHTML = html;
          ctxEl.appendChild(wrap);
          // botão de cancelar/voltar ao início
          const btnCancel = document.createElement('button');
          btnCancel.style.cssText = 'width:100%;min-height:36px;margin-top:6px;padding:6px;background:none;border:1px solid rgba(192,57,43,0.2);border-radius:8px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;touch-action:manipulation';
          btnCancel.textContent = '✕ Cancelar ataque';
          btnCancel.addEventListener('touchend', e => {
            e.preventDefault();
            if (window._MESA_ATK_STATE) window._MESA_ATK_STATE._fromMobile = false;
            _atualizarZonaDireita();
          });
          ctxEl.appendChild(btnCancel);
          // Re-renderizar zona após step change via onclick handlers do inline
          const _origMesaRender = window._mesaAtaqueInlineSelecionarHabOrig;
          return;
        }
      }

      const btnAtk = document.createElement('button');
      btnAtk.style.cssText = 'width:100%;min-height:48px;padding:8px;background:linear-gradient(135deg,rgba(192,57,43,0.3),rgba(192,57,43,0.15));border:1px solid rgba(192,57,43,0.5);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;touch-action:manipulation;margin-bottom:5px';
      btnAtk.textContent = '⚔ Atacar';
      btnAtk.addEventListener('touchend', e => {
        e.preventDefault();
        if (typeof abrirModalAtaque === 'function') {
          abrirModalAtaque(atacanteNomeTurno, 'campanha');
        }
      });
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

  visiveis.forEach((b: any) => {
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
    const itensDisp = (INV?.inventario || []).filter((i: any) => {
      const def = (INV?.itemDefs || []).find((d: any) => d.id === (i.item_catalog_id || i.item_def_id));
      return def && (def.tipo === 'consumivel' || def.tipo === 'misc') && (i.quantidade > 0);
    }).filter((i: any) => {
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
      itensDisp.slice(0, 6).forEach((invItem: any) => {
        const def = (INV?.itemDefs || []).find((d: any) => d.id === (invItem.item_catalog_id || invItem.item_def_id));
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

  // Modo aventura: usar dados do AVT_STATE
  if (_emModoAventura()) {
    const bat = typeof _avtMinhaBatalha === 'function' ? _avtMinhaBatalha() : null;
    const jog = typeof _avtMeuJogador   === 'function' ? _avtMeuJogador()   : null;
    if (!bat || !jog) { el.innerHTML = ''; return; }
    const movRest = bat.movimentoRestante?.[jog.id] ?? (typeof _avtGetMovimentoMax === 'function' ? _avtGetMovimentoMax(jog) : 3);
    const movMax  = typeof _avtGetMovimentoMax === 'function' ? _avtGetMovimentoMax(jog) : 3;
    const pct = Math.round(Math.max(0, Math.min(100, (movRest / movMax) * 100)));
    const cor = pct > 50 ? '#5ee09a' : pct > 20 ? '#f0cc6a' : '#e74c3c';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;justify-content:center">
        <div style="width:40px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px;transition:width 0.3s"></div>
        </div>
        <span style="color:${cor};font-weight:500">${movRest}/${movMax}</span>
      </div>
    `;
    return;
  }

  const charNome = MOBILE_CTRL.modoPet && MOBILE_CTRL.petNome
    ? MOBILE_CTRL.petNome
    : RPG_DATA?.linked;

  if (!charNome) return;

  const batalhaId = BATALHA_ATUAL_ID;
  const movRest = batalhaId ? movGetRestante(batalhaId, charNome) : null;
  const movMax  = movCalcVelocidade(charNome);
  
  let distHtml = '';
  if (charNome && MAPA_STATE?.mapaAtualId) {
    const meuChar = (RPG_DATA?.characters || []).find(c => c.nome === charNome);
    const minhaPos = meuChar?.map_positions?.[MAPA_STATE.mapaAtualId];
    if (minhaPos) {
      const mapaEntry = (RPG_DATA?.mapas || []).find(m => m.mapa.map_id === MAPA_STATE.mapaAtualId);
      const escala = mapaEntry?.mapa?.escala_val || 1.5;
      const grid   = mapaEntry?.mapa?.grid || 20;
      let minDist: any = Infinity, minNome: any = null;
      (RPG_DATA?.characters || []).forEach(c => {
        if (c.nome === charNome) return;
        const pos = c.map_positions?.[MAPA_STATE.mapaAtualId];
        if (!pos) return;
        const dx = (minhaPos.col ?? minhaPos.x ?? 0) - (pos.col ?? pos.x ?? 0);
        const dy = (minhaPos.row ?? minhaPos.y ?? 0) - (pos.row ?? pos.y ?? 0);
        const dist = Math.sqrt(dx*dx + dy*dy) * (escala / grid) * grid;
        if (dist < minDist) { minDist = dist; minNome = c.nome; }
      });
      if (minNome && minDist < Infinity) {
        distHtml = `<div style="font-size:0.52rem;color:rgba(200,168,75,0.7);text-align:center;margin-top:2px">${minNome.length > 8 ? minNome.slice(0,8)+'…' : minNome} ${minDist.toFixed(1)}m</div>`;
      }
    }
  }

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
      ${distHtml}
    `;
  } else {
    el.innerHTML = distHtml || '';
  }
}

// ── 3.9 — Badge de trade não-intrusivo ──────────────────────────────────
function tradeMostrarBadgeMobile(proposta: any) {
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
  (MOBILE_CTRL as any)._tradeProposta = proposta;
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
      const rows = await Promise.all(ids.map((id: any) =>
        sb(`inventario?id=eq.${id}&select=item_catalog(nome)`).catch((): any[] => [])
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
  const p = (MOBILE_CTRL as any)._tradeProposta;
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
    realtimeWS.onmessage = function(e: any) {
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
              const rows = await Promise.all(ids.map((id: any) => sb(`inventario?id=eq.${id}&select=item_catalog(nome)`).catch((): any[] => [])));
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

async function _mostrarPropostaRecebida(p: any) {
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
  mercadoId: null as any, titulo: '', itens: [] as any[], todos: [] as any[],
  aba: 'comprar', modoGerenciar: false, gerTab: 'adicionar',
  modoCustom: false, config: { taxaRevenda: 50 }, _catalogo: [] as any[],
};

function _mercRpgId()    { return RPG_DATA?.rpgId || CURRENT_RPG?.id; }
function _mercCharNome() { return INV?.charAtivo || null; }
function _mercCharId()   { return INV?.charId || null; }
function _mercDenoms()   {
  return CURRENT_RPG?.theme?.denominacoes_moeda || MOEDAS_DEFAULTS;
}
function _mercRarCor(r: any) {
  return ({comum:'#9aa8b8',incomum:'#5ee09a',raro:'#7ec8f0',epico:'#b07ef0',lendario:'#f0cc6a'} as any)[(r||'').toLowerCase()] || '#9aa8b8';
}
function _mercRarEmoji(r: any) {
  return ({comum:'⬜',incomum:'🟩',raro:'🟦',epico:'🟪',lendario:'🟨'} as any)[(r||'').toLowerCase()] || '⬜';
}

// ── Abrir ────────────────────────────────────────────────────
async function abrirModalMercado(mercadoId: any, titulo: any) {
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
  sel.innerHTML = _mercDenoms().map((d: any) => `<option value="${d.nome}">${d.emoji} ${d.nome}</option>`).join('');
}
function _mercPreencherTaxaRevenda() {
  const sl = document.getElementById('mercado-taxa-revenda');
  const vl = document.getElementById('mercado-taxa-val');
  if (sl) sl.value = (MERCADO_STATE.config.taxaRevenda) as any;
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
    const partes = _mercDenoms().map((d: any) => {
      const e = (rows||[]).find((r: any) => r.denominacao === d.nome);
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

function mercadoGerTabAtivar(tab: any) {
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
      (rows||[]).map((it: any) => `<option value="${it.id}">${it.nome}${it.raridade?' ('+it.raridade+')':''}</option>`).join('');
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
  } catch (e: any) { mostrarToast('Erro ao adicionar: ' + (e.message||'falha'), 'erro'); }
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

async function mercadoEditarPreco(rowId: any, novoPreco: any, denom: any) {
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

async function mercadoRemoverItem(rowId: any) {
  if (!confirm('Remover este item do mercado?')) return;
  try {
    await sb(`mercado?id=eq.${rowId}&rpg_id=eq.${encodeURIComponent(_mercRpgId())}`, { method:'DELETE', headers:{Prefer:'return=minimal'} });
    MERCADO_STATE.todos  = MERCADO_STATE.todos.filter(r => r.id !== rowId);
    MERCADO_STATE.itens  = MERCADO_STATE.itens.filter(r => r.id !== rowId);
    _mercadoRenderListaGerenciar();
    renderMercadoItens();
    mostrarToast('Item removido', '');
  } catch (e: any) { mostrarToast('Erro ao remover: ' + (e.message||''), 'erro'); }
}

function mercadoSalvarConfig() {
  const taxa = parseInt(document.getElementById('mercado-taxa-revenda')?.value) || 50;
  MERCADO_STATE.config.taxaRevenda = taxa;
  mostrarToast(`✓ Taxa de revenda: ${taxa}%`, 'ok');
}

// ── Carregar e renderizar (aba Comprar) ──────────────────────
async function carregarMercadoItens(mercadoId: any) {
  const el = document.getElementById('mercado-itens-grid');
  if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#7a92aa">Carregando…</div>';
  try {
    const rows = await sb(`mercado?rpg_id=eq.${encodeURIComponent(_mercRpgId())}&ativo=eq.true&select=*,item_catalog(*)`);
    MERCADO_STATE.todos = rows || [];
    MERCADO_STATE.itens = [...MERCADO_STATE.todos];
    renderMercadoItens();
  } catch (e: any) {
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

function _mercRenderCard(row: any) {
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
  const tipoEmoji = ({arma:'⚔️',armadura:'🛡️',amuleto:'💎',consumivel:'🧪',ferramenta:'🔧',misc:'📦',custom:'✏️'} as any)[tipo]||'📦';
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
window.confirmarCompraMercado = function(rowId: any, preco: any, denom: any, nomeItem: any, ev: any) {
  if (ev) ev.stopPropagation();
  const charNome = _mercCharNome();
  if (!charNome) { mostrarToast('Abra o inventário de um personagem antes de comprar', 'aviso'); return; }
  const precoNum = parseFloat(preco) || 0;
  const msg = precoNum > 0 ? `Comprar "${nomeItem}" por ${precoNum} ${denom}?` : `Adquirir "${nomeItem}" gratuitamente?`;
  if (!confirm(msg)) return;
  comprarItemMercado(rowId, preco, denom);
};

window.comprarItemMercado = async function(rowId: any, preco: any, denom: any) {
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
    ).catch((): any[] => []);
    const saldo = atual?.[0]?.quantidade || 0;
    if (saldo < precoNum) { mostrarToast(`❌ Saldo insuficiente — você tem ${saldo} ${denom}`, 'erro'); return; }

    // Debitar usando _moedaUpsert do I6 (fonte única de verdade)
    try {
      await _moedaUpsert(charId, denom, -precoNum);
    } catch (e: any) { mostrarToast('Erro ao debitar moedas: ' + (e.message||''), 'erro'); return; }
  }

  // 2. Adicionar ao inventário
  if (rowData.item_catalog_id && charId) {
    try {
      await sb('inventario', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify({
        rpg_id:rpgId, character_id:charId, item_catalog_id:rowData.item_catalog_id,
        quantidade:1, equipado:false, origem:'compra', bloqueado_por_nivel:false
      })});
      if (typeof _invBroadcastDrop === 'function') _invBroadcastDrop(it, charNome, 'compra');
      if (typeof INV !== 'undefined' && charId) delete (INV.carregado as any)[charId];
    } catch(e: any) {
      // Estornar débito se inventário falhou
      if (precoNum > 0) {
        try { await _moedaUpsert(charId, denom, +precoNum); } catch (_: any) {}
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
    const precosMercado: Record<string, any> = {};
    MERCADO_STATE.todos.forEach(r => { if (r.item_catalog_id) precosMercado[r.item_catalog_id] = { preco:r.preco, denom:r.denominacao }; });
    listaEl.innerHTML = rows.map((row: any) => {
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
  } catch (e: any) { if (listaEl) listaEl.innerHTML = `<div style="color:#e74c3c;padding:16px">Erro: ${e.message}</div>`; }
}

window.mercadoVenderItem = async function(invRowId: any, itemCatalogId: any, nomeItem: any, preco: any, denom: any, ev: any) {
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
  } catch (e: any) { mostrarToast('Erro ao vender: ' + (e.message||''), 'erro'); }
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
    const idParaNome: Record<string, any> = {};
    chars.forEach(c => { idParaNome[c.id] = c.nome; });
    el.innerHTML = rows.map((t: any) => {
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
  } catch (e: any) { el.innerHTML = `<div style="color:#e74c3c;padding:16px">Erro: ${e.message}</div>`; }
}

// ── Controle de abas ─────────────────────────────────────────
function mercadoMudarAba(aba: any) {
  MERCADO_STATE.aba = aba;
  const paineis: Record<string, any> = { comprar:'mercado-painel-comprar', vender:'mercado-painel-vender', historico:'mercado-painel-historico' };
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
window._verificarMercadoToken = function(c: any) {
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
  mapRows.forEach((m: any)=>mapeados.add(m.nome_customizado?.toLowerCase()));

  const semMapeamento = attrDefsNumericos.filter(a=>!mapeados.has(a.nome?.toLowerCase()));

  // Calcular médias de todos os grupos em paralelo
  const resultados = await Promise.all(_GRUPOS_INFO.map(async g=>{
    let mediaRes = { media:0, atributos:[] as any[], personagens:[] as any[] };
    try { mediaRes = await calcularMediaGrupo(rpgId, g.id); } catch(e) {}
    // Buscar itens do catálogo que usam esse grupo
    let itensGrupo = [];
    try {
      const atrsGrupo = mapRows.filter((m: any)=>m.grupo_base===g.id).map((m: any)=>m.nome_customizado);
      if (atrsGrupo.length) {
        const allItens = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=nome,raridade,nivel,atributos_bonus`);
        itensGrupo = (allItens||[]).filter((it: any)=>{
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
                ${g.itens.slice(0,5).map((it: any)=>`<div style="font-size:0.65rem;color:var(--texto);display:flex;justify-content:space-between;gap:6px"><span>${it.nome}</span><span style="color:var(--suave)">Nv.${it.nivel||1} ${it.raridade}</span></div>`).join('')}
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
const _origAbrirInventario: any = window.abrirInventario;
if (typeof _origAbrirInventario === 'function') {
  (window as any).abrirInventario = async function(charNome: any, charId: any) {
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

async function _trocarFaseModalComTransicao(containerEl: any, novoConteudoHTML: any) {
  if (!containerEl) return;
  containerEl.classList.add('fase-saindo');
  await new Promise(r => setTimeout(r, 300));
  containerEl.innerHTML = novoConteudoHTML;
  containerEl.classList.remove('fase-saindo');
  containerEl.classList.add('fase-entrando');
  setTimeout(() => containerEl.classList.remove('fase-entrando'), 300);
}

// ── UX-05: Preservar Quebras de Linha em Mensagens do Mestre ─────────────────
function _formatarMensagemMestre(mensagem: any) {
  if (!mensagem) return '';
  return mensagem
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── AC-02-B3: Sincronizar Animação para Jogadores Offline ────────────────────
function _sincronizarAnimacaoCriativo(criativoId: any) {
  const c = CRIATIVOS_CAMP.find(x => x.id === criativoId);
  if (!c || !c.animacao) return;
  combateBroadcast('criativo_animacao', {
    criativoId,
    atacante: c.atacante,
    alvo: c.alvo || c._alvos_area,
    animacao: c.animacao
  });
}

function _onReceberAnimacaoCriativo(data: any) {
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
  const _fixLog = (id: any, desc: any) => console.log(`[FIXES] ✓ ${id}: ${desc}`);

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
    const resistDefs = (attrDefs || []).filter((a: any) => a.categoria === 'resistencia');

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
      let cfg: any = {};
      try { cfg = JSON.parse(def.opcoes || '{}'); } catch (e) { continue; }
      if ((cfg as any).tipo !== 'armadura') continue;
      const valorArmadura = parseFloat(atribs[def.nome]) || 0;
      if (!valorArmadura) continue;

      // Redução geral
      if ((cfg as any).pct_geral) {
        const reducaoGeral = Math.ceil(valorArmadura * (cfg as any).pct_geral / 100);
        danoAtual = Math.max(0, danoAtual - reducaoGeral);
      }
      // Redução adicional para dano físico
      if ((cfg as any).pct_fisico && tipoDano === 'fisico') {
        const reducaoFisica = Math.ceil(valorArmadura * (cfg as any).pct_fisico / 100);
        danoAtual = Math.max(0, danoAtual - reducaoFisica);
      }
      // Redução adicional para dano mágico
      if ((cfg as any).pct_magico && tipoDano === 'magico') {
        const reducaoMagica = Math.ceil(valorArmadura * (cfg as any).pct_magico / 100);
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
      let cfg: any = {};
      try { cfg = JSON.parse(def.opcoes || '{}'); } catch (e) { continue; }
      if ((cfg as any).tipo !== 'resistencia') continue;
      const dmgTypes = Array.isArray(cfg.damage_type) ? (cfg as any).damage_type : [cfg.damage_type];
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
        const body: any = { buffs: c.buffs };
        if (hpMudou) (body as any).hp_atual = c.hp_atual;
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
    const c = chars.find((x: any) => x.nome === petNome);
    if (!c) return [];
    const ca = c.custom_attrs || {};

    // Criaturas e NPCs com habilidades inline
    if (ca.habilidades?.length) {
      return ca.habilidades.map((h: any, i: any) => ({
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

    const ehCura = criativoTipo === 'suporte' && efeitosExtras.some((e: any) => e.tipo === 'cura_imediata' || e.hot_formula);

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
      return _criativoMestreConcluirFase1_original.apply(this, arguments as any);
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

    const grupos: Record<string, any> = {};
    bs.participantes.forEach(p => {
      const v = bs.iniciativasRoladas[p.nome];
      if (!grupos[v]) grupos[v] = [];
      grupos[v].push(p);
    });
    const empatados: any = [];
    Object.values<any>(grupos).forEach(grp => {
      if (grp.length > 1) grp.forEach((p: any) => empatados.push(p.nome));
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
        empatados.forEach((n: any) => {
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
    const c = chars.find((x: any) => x.nome === nomeAlvo);
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
      const attrDef = attrDefs.find((a: any) => a.nome === atributo);
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
      const partes = s.split('+').map((p: any) => p.trim());
      const custos = partes.map((p: any) => {
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
    const c = chars.find((x: any) => x.nome === atacanteNome);
    const atribs = c?.custom_attrs?.atributos || {};

    // Helper: match case-insensitive do nome do atributo
    const findAtrib = (nome: any) => {
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
      const c = chars.find((x: any) => x.nome === atacanteNome);
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
  window._normalizarTipoPersonagem = function(ca: any) {
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
  window._getTipoPersonagem = function(c: any) {
    const ca = c?.custom_attrs || {};
    return ca.tipo || ca.tipo_personagem || 'jogador';
  };

  _fixLog('I01', 'Helper de normalização tipo/tipo_personagem');


  // ═══════════════════════════════════════════════════════════════
  // INCOERÊNCIA #2 — HABILIDADES: unificar tabela skills + inline
  // ═══════════════════════════════════════════════════════════════

  window.getTodasHabilidades = function(nome: any, contexto: any) {
    const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find((x: any) => x.nome === nome);
    if (!c) return [];
    const ca = c.custom_attrs || {};

    // Inline habilidades (criaturas/genéricos)
    const inline = (ca.habilidades || []).map((h: any, i: any) => ({
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
    dbSkills = dbSkills.map((s: any) => ({ ...s, _source: 'db' }));

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
  window._personagemPodeAtacar = function(nome: any, contexto: any) {
    const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
    const c = chars.find((x: any) => x.nome === nome);
    if (!c) return false;
    const buffs = c.buffs || [];

    // Verificar se tem bloqueio total de ataques
    const bloqueioTotal = buffs.some((b: any) =>
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
      return _batalhaAtacarVez_original.apply(this, arguments as any);
    }
  };

  _fixLog('I04', 'sem_ataque verificado antes de exibir modal de ataque');


  // ═══════════════════════════════════════════════════════════════
  // BUG #13 — HP MÁXIMO NÃO RECALCULA AO ALTERAR ATRIBUTO
  // Severidade: MÉDIA
  // Se Constituição muda, hp_max deveria ser recalculado
  // ═══════════════════════════════════════════════════════════════

  window.recalcularHpMax = function(c: any) {
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

    const rows = pets.map((pet: any) => {
      const habilidades = petGetHabilidadesPet(pet.nome, contexto);
      if (!habilidades.length) return '';
      const cor = pet.custom_attrs?.cor || '#7ec8f0';
      const hpAtual = pet.hp_atual ?? (pet.custom_attrs?.hp_max ?? 100);
      const hpMax = pet.custom_attrs?.hp_max ?? 100;

      const habRows = habilidades.map((h: any) => {
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
  window._verificarAtributosEspeciais = function(personagemNome: any, tipo: any, atribs: any, attrDefs: any) {
    if (tipo !== 'criatura' && tipo !== 'objeto') return;
    const especiais = (attrDefs || []).filter((a: any) => a.categoria === 'especial');
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
  window._verificarAlcanceSkill = function(tipoDano: any, alcance: any) {
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
  function _distanciaEntreTokens(nomeA: any, nomeB: any) {
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
    if (_atkSelecionarAlvo_original) return _atkSelecionarAlvo_original.apply(this, arguments as any);
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
      const result = await _iniciarApp_orig.apply(this, arguments as any);
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
function _nmceSnapPonto(xPx: any, yPx: any, canvas: any) {
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
function _nmceSnapCelula(xPx: any, yPx: any, canvas: any) {
  const { cols, rows } = _nmceGridDims();
  const cW = canvas.width  / cols;
  const cH = canvas.height / rows;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(xPx / cW)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(yPx / cH)));
  return { col, row };
}

// ── Show snap indicator dot ──────────────────────────────────────────────
function _nmceShowSnapIndicator(snap: any, canvas: any) {
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
function _nmceGerarSegmentos(p1: any, p2: any) {
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
function _nmceSceneClick(xPx: any, yPx: any, canvas: any) {
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
function _nmceRenderWalls(canvas: any) {
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
    line.setAttribute('x1', x1 as any); line.setAttribute('y1', y1 as any);
    line.setAttribute('x2', x2 as any); line.setAttribute('y2', y2 as any);
    line.setAttribute('stroke', p.cor || '#7ec8f0');
    line.setAttribute('stroke-width', p.largura || 3);
    line.setAttribute('stroke-linecap', 'round');
    // Click to remove
    line.style.cursor = 'pointer'; line.style.pointerEvents = 'stroke';
    line.addEventListener('click', (e) => { e.stopPropagation(); nmCE.renderData.paredes.splice(i, 1); _nmceRenderWalls(canvas); _nmceAtualizarLista(); });
    svg.appendChild(line);
    // Wider hit area
    const hit: any = line.cloneNode();
    hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', '12');
    hit.style.cursor = 'pointer'; hit.style.pointerEvents = 'stroke';
    hit.addEventListener('click', (e: any) => { e.stopPropagation(); nmCE.renderData.paredes.splice(i, 1); _nmceRenderWalls(canvas); _nmceAtualizarLista(); });
    svg.appendChild(hit);
  });

  // Portas e objetos
  const renderToken = (cx: any, cy: any, emoji: any, cor: any, onClick: any) => {
    const r = Math.min(cW, cH) * 0.35;
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', (cx) as any); circ.setAttribute('cy', (cy) as any); circ.setAttribute('r', (r) as any);
    circ.setAttribute('fill', cor); circ.setAttribute('stroke', 'rgba(255,255,255,0.3)'); circ.setAttribute('stroke-width', '1.5');
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', cx as any); txt.setAttribute('y', cy + r * 0.38);
    txt.setAttribute('text-anchor', ('middle') as any); txt.setAttribute('font-size', (Math.round(r * 1.3) as any));
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
      (e: any) => {
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
    const icons: Record<string, any> = { obstaculo: '🪨', bau: '📦', chave: '🗝' };
    const cors: Record<string, string>  = { obstaculo: 'rgba(100,80,60,0.35)', bau: 'rgba(200,168,75,0.2)', chave: 'rgba(200,168,75,0.2)' };
    renderToken((o.col + 0.5) * cW, (o.row + 0.5) * cH, icons[o.tipo] || '📦', cors[o.tipo] || 'rgba(80,60,100,0.3)',
      (e: any) => {
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
function nmceCarregarRenderData(renderData: any) {
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
/* [migração-esm] window.nmCE já exposto pelo rodapé de background.js */
window.nmceCoords = nmceCoords;
window._nmceSnapCelula = _nmceSnapCelula;
window._nmceRenderWalls = _nmceRenderWalls;
window._nmceAtualizarLista = _nmceAtualizarLista;

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "ATTR_MAPPING_CACHE", { configurable: true, get: () => ATTR_MAPPING_CACHE, set: (__v) => { ATTR_MAPPING_CACHE = __v; } });
Object.defineProperty(globalThis, "CATALOGO_STATE", { configurable: true, get: () => CATALOGO_STATE });
Object.defineProperty(globalThis, "TIPO_DEFAULTS", { configurable: true, get: () => TIPO_DEFAULTS });
Object.defineProperty(globalThis, "RARIDADE_CORES", { configurable: true, get: () => RARIDADE_CORES });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirCatalogo", { configurable: true, get: () => abrirCatalogo, set: (__v) => { abrirCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharCatalogo", { configurable: true, get: () => fecharCatalogo, set: (__v) => { fecharCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "carregarCatalogo", { configurable: true, get: () => carregarCatalogo, set: (__v) => { carregarCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "filtrarCatalogo", { configurable: true, get: () => filtrarCatalogo, set: (__v) => { filtrarCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderListaCatalogo", { configurable: true, get: () => renderListaCatalogo, set: (__v) => { renderListaCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirFormItem", { configurable: true, get: () => abrirFormItem, set: (__v) => { abrirFormItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharFormItem", { configurable: true, get: () => fecharFormItem, set: (__v) => { fecharFormItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirEditarItemCatalogo", { configurable: true, get: () => abrirEditarItemCatalogo, set: (__v) => { abrirEditarItemCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "trocarAbaItem", { configurable: true, get: () => trocarAbaItem, set: (__v) => { trocarAbaItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "itemTipoChange", { configurable: true, get: () => itemTipoChange, set: (__v) => { itemTipoChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "itemRaridadeChange", { configurable: true, get: () => itemRaridadeChange, set: (__v) => { itemRaridadeChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "setVisualTipo", { configurable: true, get: () => setVisualTipo, set: (__v) => { setVisualTipo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fiImgurlChange", { configurable: true, get: () => fiImgurlChange, set: (__v) => { fiImgurlChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fiUploadImagem", { configurable: true, get: () => fiUploadImagem, set: (__v) => { fiUploadImagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "setAnimacao", { configurable: true, get: () => setAnimacao, set: (__v) => { setAnimacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "restaurarAparenciaPadrao", { configurable: true, get: () => restaurarAparenciaPadrao, set: (__v) => { restaurarAparenciaPadrao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_aplicarVisualConfig", { configurable: true, get: () => _aplicarVisualConfig, set: (__v) => { _aplicarVisualConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "atualizarPreviewCard", { configurable: true, get: () => atualizarPreviewCard, set: (__v) => { atualizarPreviewCard = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "adicionarLinhaBonus", { configurable: true, get: () => adicionarLinhaBonus, set: (__v) => { adicionarLinhaBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderLinhasBonus", { configurable: true, get: () => renderLinhasBonus, set: (__v) => { renderLinhasBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "adicionarEfeito", { configurable: true, get: () => adicionarEfeito, set: (__v) => { adicionarEfeito = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderEfeitosLista", { configurable: true, get: () => renderEfeitosLista, set: (__v) => { renderEfeitosLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_descreverEfeito", { configurable: true, get: () => _descreverEfeito, set: (__v) => { _descreverEfeito = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleDropConfig", { configurable: true, get: () => toggleDropConfig, set: (__v) => { toggleDropConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarItem", { configurable: true, get: () => salvarItem, set: (__v) => { salvarItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "duplicarItemAtual", { configurable: true, get: () => duplicarItemAtual, set: (__v) => { duplicarItemAtual = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "deletarItemAtual", { configurable: true, get: () => deletarItemAtual, set: (__v) => { deletarItemAtual = __v; } });
Object.defineProperty(globalThis, "_darItemId", { configurable: true, get: () => _darItemId, set: (__v) => { _darItemId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirDarItem", { configurable: true, get: () => abrirDarItem, set: (__v) => { abrirDarItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "confirmarDarItem", { configurable: true, get: () => confirmarDarItem, set: (__v) => { confirmarDarItem = __v; } });
Object.defineProperty(globalThis, "INV_SLOTS", { configurable: true, get: () => INV_SLOTS });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "calcularMediaGrupo", { configurable: true, get: () => calcularMediaGrupo, set: (__v) => { calcularMediaGrupo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirInventario", { configurable: true, get: () => abrirInventario, set: (__v) => { abrirInventario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharInventario", { configurable: true, get: () => fecharInventario, set: (__v) => { fecharInventario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "carregarInventarioChar", { configurable: true, get: () => carregarInventarioChar, set: (__v) => { carregarInventarioChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvCompleto", { configurable: true, get: () => renderInvCompleto, set: (__v) => { renderInvCompleto = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvSlots", { configurable: true, get: () => renderInvSlots, set: (__v) => { renderInvSlots = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderSlotCard", { configurable: true, get: () => renderSlotCard, set: (__v) => { renderSlotCard = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invClicarSlotVazio", { configurable: true, get: () => invClicarSlotVazio, set: (__v) => { invClicarSlotVazio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvMochila", { configurable: true, get: () => renderInvMochila, set: (__v) => { renderInvMochila = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvCarga", { configurable: true, get: () => renderInvCarga, set: (__v) => { renderInvCarga = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvVisual", { configurable: true, get: () => renderInvVisual, set: (__v) => { renderInvVisual = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_resolveItemImgSrc", { configurable: true, get: () => _resolveItemImgSrc, set: (__v) => { _resolveItemImgSrc = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_normalizarSlotParaTipo", { configurable: true, get: () => _normalizarSlotParaTipo, set: (__v) => { _normalizarSlotParaTipo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invAbrirPosicionarEquip", { configurable: true, get: () => invAbrirPosicionarEquip, set: (__v) => { invAbrirPosicionarEquip = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invConfirmarPosicionarEquip", { configurable: true, get: () => invConfirmarPosicionarEquip, set: (__v) => { invConfirmarPosicionarEquip = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invClicarItem", { configurable: true, get: () => invClicarItem, set: (__v) => { invClicarItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invEquipar", { configurable: true, get: () => invEquipar, set: (__v) => { invEquipar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invDesequipar", { configurable: true, get: () => invDesequipar, set: (__v) => { invDesequipar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invRemoverItem", { configurable: true, get: () => invRemoverItem, set: (__v) => { invRemoverItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirAdicionarItemInv", { configurable: true, get: () => abrirAdicionarItemInv, set: (__v) => { abrirAdicionarItemInv = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "filtrarAddInv", { configurable: true, get: () => filtrarAddInv, set: (__v) => { filtrarAddInv = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "addInvConfirmar", { configurable: true, get: () => addInvConfirmar, set: (__v) => { addInvConfirmar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "verificarDesbloqueioItens", { configurable: true, get: () => verificarDesbloqueioItens, set: (__v) => { verificarDesbloqueioItens = __v; } });
Object.defineProperty(globalThis, "_origExecutarLevelUp", { configurable: true, get: () => _origExecutarLevelUp });
Object.defineProperty(globalThis, "MOEDAS_DEFAULTS", { configurable: true, get: () => MOEDAS_DEFAULTS });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvMoedas", { configurable: true, get: () => renderInvMoedas, set: (__v) => { renderInvMoedas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invTrocarAba", { configurable: true, get: () => invTrocarAba, set: (__v) => { invTrocarAba = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_criarModalMoedaTxSeNecessario", { configurable: true, get: () => _criarModalMoedaTxSeNecessario, set: (__v) => { _criarModalMoedaTxSeNecessario = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirTxMoeda", { configurable: true, get: () => abrirTxMoeda, set: (__v) => { abrirTxMoeda = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "confirmarTransacaoMoeda", { configurable: true, get: () => confirmarTransacaoMoeda, set: (__v) => { confirmarTransacaoMoeda = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_moedaUpsert", { configurable: true, get: () => _moedaUpsert, set: (__v) => { _moedaUpsert = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_moedaLog", { configurable: true, get: () => _moedaLog, set: (__v) => { _moedaLog = __v; } });
Object.defineProperty(globalThis, "_cfgMoedasTemp", { configurable: true, get: () => _cfgMoedasTemp, set: (__v) => { _cfgMoedasTemp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "cfgMoedasRender", { configurable: true, get: () => cfgMoedasRender, set: (__v) => { cfgMoedasRender = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "cfgMoedasInit", { configurable: true, get: () => cfgMoedasInit, set: (__v) => { cfgMoedasInit = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_cfgMoedasRemover", { configurable: true, get: () => _cfgMoedasRemover, set: (__v) => { _cfgMoedasRemover = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_cfgMoedasMover", { configurable: true, get: () => _cfgMoedasMover, set: (__v) => { _cfgMoedasMover = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "cfgMoedasAdicionar", { configurable: true, get: () => cfgMoedasAdicionar, set: (__v) => { cfgMoedasAdicionar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "cfgMoedasSalvar", { configurable: true, get: () => cfgMoedasSalvar, set: (__v) => { cfgMoedasSalvar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invBroadcastDrop", { configurable: true, get: () => _invBroadcastDrop, set: (__v) => { _invBroadcastDrop = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_itemIcon", { configurable: true, get: () => _itemIcon, set: (__v) => { _itemIcon = __v; } });
Object.defineProperty(globalThis, "_origWsHandler", { configurable: true, get: () => _origWsHandler });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_patchWsItemDropado", { configurable: true, get: () => _patchWsItemDropado, set: (__v) => { _patchWsItemDropado = __v; } });
Object.defineProperty(globalThis, "_wsCheckInterval", { configurable: true, get: () => _wsCheckInterval });
Object.defineProperty(globalThis, "VOCAB_FALLBACK", { configurable: true, get: () => VOCAB_FALLBACK });
Object.defineProperty(globalThis, "_vocabCache", { configurable: true, get: () => _vocabCache });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "carregarVocabulario", { configurable: true, get: () => carregarVocabulario, set: (__v) => { carregarVocabulario = __v; } });
Object.defineProperty(globalThis, "NOMES_BASE_TIPO", { configurable: true, get: () => NOMES_BASE_TIPO });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_gerarPartesNome", { configurable: true, get: () => _gerarPartesNome, set: (__v) => { _gerarPartesNome = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_montarNomeGerado", { configurable: true, get: () => _montarNomeGerado, set: (__v) => { _montarNomeGerado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "itemGerarNome", { configurable: true, get: () => itemGerarNome, set: (__v) => { itemGerarNome = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "itemAtualizarNomeGerado", { configurable: true, get: () => itemAtualizarNomeGerado, set: (__v) => { itemAtualizarNomeGerado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "itemAplicarNomeGerado", { configurable: true, get: () => itemAplicarNomeGerado, set: (__v) => { itemAplicarNomeGerado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarNomeItem", { configurable: true, get: () => gerarNomeItem, set: (__v) => { gerarNomeItem = __v; } });
Object.defineProperty(globalThis, "_FATOR_ESCALA", { configurable: true, get: () => _FATOR_ESCALA });
Object.defineProperty(globalThis, "_BORDA_RARIDADE", { configurable: true, get: () => _BORDA_RARIDADE });
Object.defineProperty(globalThis, "_ANIMACAO_RARIDADE", { configurable: true, get: () => _ANIMACAO_RARIDADE });
Object.defineProperty(globalThis, "_EFEITOS_TIPO", { configurable: true, get: () => _EFEITOS_TIPO });
Object.defineProperty(globalThis, "_CHANCE_EFEITO", { configurable: true, get: () => _CHANCE_EFEITO });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "gerarStatusItem", { configurable: true, get: () => gerarStatusItem, set: (__v) => { gerarStatusItem = __v; } });
Object.defineProperty(globalThis, "_DROP_QTDE", { configurable: true, get: () => _DROP_QTDE });
Object.defineProperty(globalThis, "_PESO_RARIDADE_TIER", { configurable: true, get: () => _PESO_RARIDADE_TIER });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_sortearRaridade", { configurable: true, get: () => _sortearRaridade, set: (__v) => { _sortearRaridade = __v; } });
Object.defineProperty(globalThis, "_CHANCE_NIVEL_ACIMA", { configurable: true, get: () => _CHANCE_NIVEL_ACIMA });
Object.defineProperty(globalThis, "_MAX_NIVEL_ACIMA", { configurable: true, get: () => _MAX_NIVEL_ACIMA });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_calcularNivelItem", { configurable: true, get: () => _calcularNivelItem, set: (__v) => { _calcularNivelItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "calcularDrops", { configurable: true, get: () => calcularDrops, set: (__v) => { calcularDrops = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_executarDropNPC", { configurable: true, get: () => _executarDropNPC, set: (__v) => { _executarDropNPC = __v; } });
Object.defineProperty(globalThis, "_origRenderTokenStyle", { configurable: true, get: () => _origRenderTokenStyle });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_renderItemCard", { configurable: true, get: () => _renderItemCard, set: (__v) => { _renderItemCard = __v; } });
Object.defineProperty(globalThis, "LOOT_STATE", { configurable: true, get: () => LOOT_STATE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderLootCards", { configurable: true, get: () => renderLootCards, set: (__v) => { renderLootCards = __v; } });
Object.defineProperty(globalThis, "BAU_STATE", { configurable: true, get: () => BAU_STATE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderInvBau", { configurable: true, get: () => renderInvBau, set: (__v) => { renderInvBau = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderBauDepositarLista", { configurable: true, get: () => renderBauDepositarLista, set: (__v) => { renderBauDepositarLista = __v; } });
Object.defineProperty(globalThis, "TRADE_STATE", { configurable: true, get: () => TRADE_STATE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalTrade", { configurable: true, get: () => abrirModalTrade, set: (__v) => { abrirModalTrade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_broadcastTradeEvento", { configurable: true, get: () => _broadcastTradeEvento, set: (__v) => { _broadcastTradeEvento = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "adicionarBotaoTrade", { configurable: true, get: () => adicionarBotaoTrade, set: (__v) => { adicionarBotaoTrade = __v; } });
Object.defineProperty(globalThis, "MOBILE_CTRL", { configurable: true, get: () => MOBILE_CTRL });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlToggleSkills", { configurable: true, get: () => _avtCtrlToggleSkills, set: (__v) => { _avtCtrlToggleSkills = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mcSkillsOrdenados", { configurable: true, get: () => _mcSkillsOrdenados, set: (__v) => { _mcSkillsOrdenados = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlRolarSkillDireita", { configurable: true, get: () => _avtCtrlRolarSkillDireita, set: (__v) => { _avtCtrlRolarSkillDireita = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlRolarSkillEsquerda", { configurable: true, get: () => _avtCtrlRolarSkillEsquerda, set: (__v) => { _avtCtrlRolarSkillEsquerda = __v; } });
Object.defineProperty(globalThis, "_ARC_SLOTS", { configurable: true, get: () => _ARC_SLOTS });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlToggleAutoAlvo", { configurable: true, get: () => _avtCtrlToggleAutoAlvo, set: (__v) => { _avtCtrlToggleAutoAlvo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_getUltSkillId", { configurable: true, get: () => _getUltSkillId, set: (__v) => { _getUltSkillId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_setUltSkillId", { configurable: true, get: () => _setUltSkillId, set: (__v) => { _setUltSkillId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlToggleAutoAlvoPref", { configurable: true, get: () => _avtCtrlToggleAutoAlvoPref, set: (__v) => { _avtCtrlToggleAutoAlvoPref = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlAplicarAutoAlvo", { configurable: true, get: () => _avtCtrlAplicarAutoAlvo, set: (__v) => { _avtCtrlAplicarAutoAlvo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "isMobileLandscape", { configurable: true, get: () => isMobileLandscape, set: (__v) => { isMobileLandscape = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_verificarModoMobile", { configurable: true, get: () => _verificarModoMobile, set: (__v) => { _verificarModoMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "desbloquearOrientacaoPWA", { configurable: true, get: () => desbloquearOrientacaoPWA, set: (__v) => { desbloquearOrientacaoPWA = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarBannerControleMobile", { configurable: true, get: () => _atualizarBannerControleMobile, set: (__v) => { _atualizarBannerControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleControleMobile", { configurable: true, get: () => toggleControleMobile, set: (__v) => { toggleControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mostrarSeletorModoControle", { configurable: true, get: () => _mostrarSeletorModoControle, set: (__v) => { _mostrarSeletorModoControle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarBotaoControleMobile", { configurable: true, get: () => _atualizarBotaoControleMobile, set: (__v) => { _atualizarBotaoControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_emModoAventura", { configurable: true, get: () => _emModoAventura, set: (__v) => { _emModoAventura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_ativarControleMobile", { configurable: true, get: () => _ativarControleMobile, set: (__v) => { _ativarControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_desativarControleMobile", { configurable: true, get: () => _desativarControleMobile, set: (__v) => { _desativarControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtMinimapSetMobile", { configurable: true, get: () => _avtMinimapSetMobile, set: (__v) => { _avtMinimapSetMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_htmlControleMobile", { configurable: true, get: () => _htmlControleMobile, set: (__v) => { _htmlControleMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_iniciarDpadReposicionamento", { configurable: true, get: () => _iniciarDpadReposicionamento, set: (__v) => { _iniciarDpadReposicionamento = __v; } });
Object.defineProperty(globalThis, "_DPAD_TIMER", { configurable: true, get: () => _DPAD_TIMER, set: (__v) => { _DPAD_TIMER = __v; } });
Object.defineProperty(globalThis, "_DPAD_DC", { configurable: true, get: () => _DPAD_DC, set: (__v) => { _DPAD_DC = __v; } });
Object.defineProperty(globalThis, "_DPAD_DR", { configurable: true, get: () => _DPAD_DR, set: (__v) => { _DPAD_DR = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_dpadMoverToken", { configurable: true, get: () => _dpadMoverToken, set: (__v) => { _dpadMoverToken = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_iniciarJoystick", { configurable: true, get: () => _iniciarJoystick, set: (__v) => { _iniciarJoystick = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_podeMovimentarMobile", { configurable: true, get: () => _podeMovimentarMobile, set: (__v) => { _podeMovimentarMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarEstadoDpad", { configurable: true, get: () => _atualizarEstadoDpad, set: (__v) => { _atualizarEstadoDpad = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarZonaCentralAventura", { configurable: true, get: () => _atualizarZonaCentralAventura, set: (__v) => { _atualizarZonaCentralAventura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_avtCtrlAtualizarAlvosCentral", { configurable: true, get: () => _avtCtrlAtualizarAlvosCentral, set: (__v) => { _avtCtrlAtualizarAlvosCentral = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarZonaCentral", { configurable: true, get: () => _atualizarZonaCentral, set: (__v) => { _atualizarZonaCentral = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_encontrarPetVinculado", { configurable: true, get: () => _encontrarPetVinculado, set: (__v) => { _encontrarPetVinculado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_esMeuTurnoMobile", { configurable: true, get: () => _esMeuTurnoMobile, set: (__v) => { _esMeuTurnoMobile = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarZonaDireitaAventura", { configurable: true, get: () => _atualizarZonaDireitaAventura, set: (__v) => { _atualizarZonaDireitaAventura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarZonaDireita", { configurable: true, get: () => _atualizarZonaDireita, set: (__v) => { _atualizarZonaDireita = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atualizarMovInfo", { configurable: true, get: () => _atualizarMovInfo, set: (__v) => { _atualizarMovInfo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "tradeMostrarBadgeMobile", { configurable: true, get: () => tradeMostrarBadgeMobile, set: (__v) => { tradeMostrarBadgeMobile = __v; } });
Object.defineProperty(globalThis, "_origMostrarPropostaRecebida", { configurable: true, get: () => _origMostrarPropostaRecebida });
Object.defineProperty(globalThis, "_origWsCheckTrade", { configurable: true, get: () => _origWsCheckTrade });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mostrarPropostaRecebida", { configurable: true, get: () => _mostrarPropostaRecebida, set: (__v) => { _mostrarPropostaRecebida = __v; } });
Object.defineProperty(globalThis, "MERCADO_STATE", { configurable: true, get: () => MERCADO_STATE });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercRpgId", { configurable: true, get: () => _mercRpgId, set: (__v) => { _mercRpgId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercCharNome", { configurable: true, get: () => _mercCharNome, set: (__v) => { _mercCharNome = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercCharId", { configurable: true, get: () => _mercCharId, set: (__v) => { _mercCharId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercDenoms", { configurable: true, get: () => _mercDenoms, set: (__v) => { _mercDenoms = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercRarCor", { configurable: true, get: () => _mercRarCor, set: (__v) => { _mercRarCor = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercRarEmoji", { configurable: true, get: () => _mercRarEmoji, set: (__v) => { _mercRarEmoji = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalMercado", { configurable: true, get: () => abrirModalMercado, set: (__v) => { abrirModalMercado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercPreencherDenomSelect", { configurable: true, get: () => _mercPreencherDenomSelect, set: (__v) => { _mercPreencherDenomSelect = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercPreencherTaxaRevenda", { configurable: true, get: () => _mercPreencherTaxaRevenda, set: (__v) => { _mercPreencherTaxaRevenda = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercAtualizarSaldo", { configurable: true, get: () => _mercAtualizarSaldo, set: (__v) => { _mercAtualizarSaldo = __v; } });
Object.defineProperty(globalThis, "atualizarSaldoMercado", { configurable: true, get: () => atualizarSaldoMercado });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoToggleModo", { configurable: true, get: () => mercadoToggleModo, set: (__v) => { mercadoToggleModo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoToggleGerenciar", { configurable: true, get: () => mercadoToggleGerenciar, set: (__v) => { mercadoToggleGerenciar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoGerTabAtivar", { configurable: true, get: () => mercadoGerTabAtivar, set: (__v) => { mercadoGerTabAtivar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercadoCarregarCatalogo", { configurable: true, get: () => _mercadoCarregarCatalogo, set: (__v) => { _mercadoCarregarCatalogo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoToggleItemCustom", { configurable: true, get: () => mercadoToggleItemCustom, set: (__v) => { mercadoToggleItemCustom = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoAdicionarItem", { configurable: true, get: () => mercadoAdicionarItem, set: (__v) => { mercadoAdicionarItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercadoRenderListaGerenciar", { configurable: true, get: () => _mercadoRenderListaGerenciar, set: (__v) => { _mercadoRenderListaGerenciar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoEditarPreco", { configurable: true, get: () => mercadoEditarPreco, set: (__v) => { mercadoEditarPreco = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoRemoverItem", { configurable: true, get: () => mercadoRemoverItem, set: (__v) => { mercadoRemoverItem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoSalvarConfig", { configurable: true, get: () => mercadoSalvarConfig, set: (__v) => { mercadoSalvarConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "carregarMercadoItens", { configurable: true, get: () => carregarMercadoItens, set: (__v) => { carregarMercadoItens = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderMercadoItens", { configurable: true, get: () => renderMercadoItens, set: (__v) => { renderMercadoItens = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercRenderCard", { configurable: true, get: () => _mercRenderCard, set: (__v) => { _mercRenderCard = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mercCarregarAbaVender", { configurable: true, get: () => _mercCarregarAbaVender, set: (__v) => { _mercCarregarAbaVender = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoCarregarHistorico", { configurable: true, get: () => mercadoCarregarHistorico, set: (__v) => { mercadoCarregarHistorico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mercadoMudarAba", { configurable: true, get: () => mercadoMudarAba, set: (__v) => { mercadoMudarAba = __v; } });
Object.defineProperty(globalThis, "_GRUPOS_INFO", { configurable: true, get: () => _GRUPOS_INFO });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "a5RecalcularPainel", { configurable: true, get: () => a5RecalcularPainel, set: (__v) => { a5RecalcularPainel = __v; } });
Object.defineProperty(globalThis, "_origAbrirInventario", { configurable: true, get: () => _origAbrirInventario });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_getAlvosDisponiveisParaSuporte", { configurable: true, get: () => _getAlvosDisponiveisParaSuporte, set: (__v) => { _getAlvosDisponiveisParaSuporte = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_notificarNovoCreativoPendente", { configurable: true, get: () => _notificarNovoCreativoPendente, set: (__v) => { _notificarNovoCreativoPendente = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_limparNotifCreativo", { configurable: true, get: () => _limparNotifCreativo, set: (__v) => { _limparNotifCreativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_aplicarTransicaoFaseModal", { configurable: true, get: () => _aplicarTransicaoFaseModal, set: (__v) => { _aplicarTransicaoFaseModal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_trocarFaseModalComTransicao", { configurable: true, get: () => _trocarFaseModalComTransicao, set: (__v) => { _trocarFaseModalComTransicao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_formatarMensagemMestre", { configurable: true, get: () => _formatarMensagemMestre, set: (__v) => { _formatarMensagemMestre = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_sincronizarAnimacaoCriativo", { configurable: true, get: () => _sincronizarAnimacaoCriativo, set: (__v) => { _sincronizarAnimacaoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_onReceberAnimacaoCriativo", { configurable: true, get: () => _onReceberAnimacaoCriativo, set: (__v) => { _onReceberAnimacaoCriativo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceGridDims", { configurable: true, get: () => _nmceGridDims, set: (__v) => { _nmceGridDims = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceSnapPonto", { configurable: true, get: () => _nmceSnapPonto, set: (__v) => { _nmceSnapPonto = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceSnapCelula", { configurable: true, get: () => _nmceSnapCelula, set: (__v) => { _nmceSnapCelula = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceShowSnapIndicator", { configurable: true, get: () => _nmceShowSnapIndicator, set: (__v) => { _nmceShowSnapIndicator = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceGerarSegmentos", { configurable: true, get: () => _nmceGerarSegmentos, set: (__v) => { _nmceGerarSegmentos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceSceneClick", { configurable: true, get: () => _nmceSceneClick, set: (__v) => { _nmceSceneClick = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceRenderWalls", { configurable: true, get: () => _nmceRenderWalls, set: (__v) => { _nmceRenderWalls = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceAtualizarLista", { configurable: true, get: () => _nmceAtualizarLista, set: (__v) => { _nmceAtualizarLista = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceLimparParedes", { configurable: true, get: () => nmceLimparParedes, set: (__v) => { nmceLimparParedes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "nmceCarregarRenderData", { configurable: true, get: () => nmceCarregarRenderData, set: (__v) => { nmceCarregarRenderData = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_nmceSalvarRenderData", { configurable: true, get: () => _nmceSalvarRenderData, set: (__v) => { _nmceSalvarRenderData = __v; } });
