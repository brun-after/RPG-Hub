// systems/attribute-mapping.js
// RPG Hub — Attribute group mapping service (A1/A2)
// Includes: ATTR_MAPPING_CACHE, carregarMapeamento(), renderAttrMappingUI()


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

