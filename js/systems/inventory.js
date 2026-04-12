// systems/inventory.js
// RPG Hub — Inventory/equipment system, item CRUD, tables, campaign creation wizard
// Includes: INV state, renderInventarioChar(), item modals, table modals, CRIAR_STATE wizard

// SISTEMA DE TABELAS, INVENTÁRIO & EQUIPAMENTOS
// ═══════════════════════════════════════════════════════════════

// ── Estado global ────────────────────────────────────────────
const INV = {
  itemDefs:   [],   // item_defs carregados do banco
  inventario: [],   // inventario carregado do banco (todos chars do rpg)
  tabelas:    [],   // tabelas do rpg
  usosPendentes: [], // item_usos status=pendente
  // Campos do sistema de inventário individual
  catalogo:    [],   // item_catalog da campanha
  inventarios: {},   // characterId → [instâncias com item_catalog join]
  carregado:   {},   // characterId → bool
  charAtivo:   null, // nome do personagem aberto
  charId:      null  // id do personagem aberto
};

// Mapa de slot → label amigável e emoji
const SLOTS_LABELS = {
  cabeca: { label:'Cabeça', icon:'🪖' },
  corpo:  { label:'Corpo',  icon:'🥋' },
  maos:   { label:'Mãos',   icon:'🧤' },
  pernas: { label:'Pernas', icon:'👖' },
  pes:    { label:'Pés',    icon:'👢' },
  arma_principal:  { label:'Arma',    icon:'⚔' },
  arma_secundaria: { label:'Escudo',  icon:'🗡' },
  anel:    { label:'Anel',    icon:'💍' },
  amuleto: { label:'Amuleto', icon:'📿' },
  capa:    { label:'Capa',    icon:'🧣' },
};

// ── Carregamento de dados ────────────────────────────────────
async function invCarregarDados(rpgId) {
  try {
    const e = encodeURIComponent(rpgId);
    const [defs, tabelas, usos] = await Promise.all([
      sb(`item_catalog?rpg_id=eq.${e}&select=id,rpg_id,nome,tipo,descricao,icone,raridade,img_url,valor_base,efeitos,alvo,alcance_m,requer_aprovacao,slot_padrao,atributos_bonus,nivel,nivel_minimo_uso,peso,trade_offs,visual_config,tipo_canonico&order=id`),
      sb(`tabelas?rpg_id=eq.${e}&order=id`),
      sb(`item_usos?rpg_id=eq.${e}&status=eq.pendente&order=id`),
    ]);
    INV.itemDefs = defs || [];
    INV.tabelas  = tabelas || [];
    INV.usosPendentes = usos || [];
    // inventario carregado sob demanda por personagem
    // Carregar imagens dos itens de forma assíncrona e lazy (última prioridade)
    requestIdleCallback ? requestIdleCallback(() => _invCarregarImagensItens(rpgId)) : setTimeout(() => _invCarregarImagensItens(rpgId), 2000);
  } catch(e) { console.warn('[INV] Erro ao carregar:', e); }
}

async function _invCarregarImagensItens(rpgId) {
  try {
    const e = encodeURIComponent(rpgId);
    const imgs = await sb(`item_catalog?rpg_id=eq.${e}&select=id,img_url&img_url=not.is.null`);
    if (imgs && imgs.length) {
      imgs.forEach(row => {
        const def = INV.itemDefs.find(d => d.id === row.id);
        if (def && row.img_url) def.img_url = row.img_url;
      });
    }
  } catch(e) { /* silently ignore */ }
}

async function invCarregarInventarioChar(charId) {
  try {
    const rows = await sb(`inventario?character_id=eq.${encodeURIComponent(charId)}&order=id`);
    // Mesclar com o cache global (remover entradas antigas deste char e adicionar novas)
    INV.inventario = INV.inventario.filter(i => i.character_id !== charId);
    INV.inventario.push(...(rows || []));
    return rows || [];
  } catch(e) { return []; }
}

// ─── Patch em entrarRPG para carregar dados de inv ─────────────
(function() {
  const _orig = window.entrarRPG;
  window.entrarRPG = async function(rpgId) {
    await _orig(rpgId);
    await invCarregarDados(rpgId);
    renderTabelasTab();
    renderMestreBtnsTabelas();
    renderItensPendentes();
  };
})();

// ─── Patch em renderCharView para adicionar inventário ─────────
(function() {
  const _orig = window.renderCharView;
  window.renderCharView = async function(nome) {
    _orig(nome);
    await renderInventarioChar(nome);
  };
})();

// ── Visibilidade dos botões de mestre ─────────────────────────
function renderMestreBtnsTabelas() {
  const el = document.getElementById('tabelas-mestre-btns');
  if (!el) return;
  el.style.display = RPG_DATA?.myRole === 'mestre' ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════════════
// ABA TABELAS
// ═══════════════════════════════════════════════════════════════

function renderTabelasTab() {
  const isMestre = RPG_DATA?.myRole === 'mestre';
  // Tabelas genéricas
  const tabelasDiv = document.getElementById('tabelas-lista');
  if (!tabelasDiv) return;

  const tabelas = INV.tabelas.filter(t => isMestre || t.visivel);
  if (!tabelas.length) {
    tabelasDiv.innerHTML = `<div style="text-align:center;padding:30px;color:var(--suave);font-style:italic;font-size:0.9rem">Nenhuma tabela${isMestre ? ' — crie a primeira com + Tabela' : ' disponível ainda.'}</div>`;
  } else {
    tabelasDiv.innerHTML = tabelas.map(t => {
      const colunas = Array.isArray(t.colunas) ? t.colunas : [];
      const linhas  = Array.isArray(t.linhas)  ? t.linhas  : [];
      const ocultaClass = !t.visivel ? ' tbl-oculta' : '';
      const mestreAcoes = isMestre ? `
        <div class="tbl-actions">
          <button class="tbl-icon-btn" onclick="abrirModalTabela(${t.id})" title="Editar">✏️</button>
          <button class="tbl-icon-btn" style="color:rgba(192,57,43,0.6)" onclick="deletarTabela(${t.id})" title="Excluir">🗑</button>
          ${!t.visivel ? `<button class="tbl-icon-btn" style="color:var(--destaque);font-size:0.58rem" onclick="toggleVisibilidadeTabela(${t.id},true)">👁 Mostrar</button>` : `<button class="tbl-icon-btn" style="font-size:0.58rem" onclick="toggleVisibilidadeTabela(${t.id},false)">🙈 Ocultar</button>`}
        </div>` : '';
      const tableHtml = colunas.length ? `
        <div style="overflow-x:auto">
          <table class="tbl-table">
            <thead><tr>${colunas.map(c => `<th>${c.label||c.key}</th>`).join('')}</tr></thead>
            <tbody>
              ${linhas.length ? linhas.map(l => `<tr>${colunas.map(c => `<td>${l[c.key] ?? ''}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${colunas.length}" style="color:var(--suave);font-style:italic;text-align:center">Sem dados</td></tr>`}
            </tbody>
          </table>
        </div>` : '<div style="color:var(--suave);font-style:italic;font-size:0.8rem">Tabela sem colunas definidas.</div>';
      return `<div class="tbl-card${ocultaClass}">
        <div class="tbl-card-header">
          <div class="tbl-card-nome">${t.nome}${!t.visivel ? ' <span style="font-size:0.6rem;color:var(--suave)">(oculta)</span>' : ''}</div>
          ${mestreAcoes}
        </div>
        ${t.descricao ? `<div class="tbl-card-desc">${t.descricao}</div>` : ''}
        ${tableHtml}
      </div>`;
    }).join('');
  }

  // Catálogo de itens
  const itemsDiv = document.getElementById('itens-defs-lista');
  if (!itemsDiv) return;
  const defs = INV.itemDefs;
  if (!defs.length) {
    itemsDiv.innerHTML = isMestre ? `<div style="text-align:center;padding:20px;color:var(--suave);font-style:italic;font-size:0.9rem">Nenhum item criado — use ⚗ Item para criar</div>` : '';
    return;
  }
  itemsDiv.innerHTML = `
    <div class="card-titulo" style="margin-bottom:10px">⚗ Catálogo de Itens</div>
    ${defs.map(d => {
      const efeitos = Array.isArray(d.efeitos) ? d.efeitos : [];
      const bonusSrc = (d.atributos_bonus && typeof d.atributos_bonus === 'object') ? d.atributos_bonus
                     : (d.bonus_attrs   && typeof d.bonus_attrs   === 'object') ? d.bonus_attrs : {};
      const rarCor = {comum:'var(--suave)',incomum:'#5ee09a',raro:'#7ec8f0',épico:'#b07ef0',lendário:'#f0cc6a'}[d.raridade] || 'var(--suave)';
      const efStr = efeitos.map(ef => _efeitoLabel(ef)).filter(Boolean).join(' · ');
      const bonStr = Object.entries(bonusSrc).map(([k,v]) => `${k} ${v>0?'+':''}${v}`).join(', ');
      const mestreAcoes = isMestre ? `
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="abrirEditarItemCatalogo(${d.id})" style="background:none;border:1px solid rgba(123,47,190,0.25);border-radius:5px;color:#b07ef0;font-size:0.65rem;padding:3px 7px;cursor:pointer">✏️</button>
          <button onclick="deletarItemDef(${d.id})" style="background:none;border:1px solid rgba(192,57,43,0.2);border-radius:5px;color:#e74c3c66;font-size:0.65rem;padding:3px 7px;cursor:pointer">🗑</button>
        </div>` : '';
      const tipoCanon = d.tipo_canonico || d.tipo || '';
      const slotKey   = d.slot_padrao || d.slot || '';
      const imgSrcTbl = _resolveItemImgSrc ? _resolveItemImgSrc(d) : (d.img_url || '');
      const iconHtml  = imgSrcTbl
        ? `<img src="${imgSrcTbl}" loading="lazy" style="width:100%;height:100%;object-fit:contain;border-radius:4px" onerror="this.style.display='none'">`
        : `<span style="font-size:1.3rem">${d.icone||'📦'}</span>`;
      return `<div style="background:var(--escuro);border:1px solid var(--borda);border-left:3px solid ${rarCor};border-radius:8px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:flex-start;gap:10px">
        <div style="width:36px;height:42px;border:1px solid rgba(255,255,255,0.08);border-radius:6px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${iconHtml}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fonte-d);font-size:0.82rem;color:var(--texto)">${d.nome} <span style="font-size:0.6rem;color:${rarCor}">${d.raridade||''}</span></div>
          ${d.descricao ? `<div style="font-size:0.75rem;color:var(--suave);font-style:italic">${d.descricao}</div>` : ''}
          ${efStr ? `<div style="font-size:0.72rem;color:#7ec8f0;margin-top:3px">✦ ${efStr}</div>` : ''}
          ${bonStr ? `<div style="font-size:0.72rem;color:#5ee09a;margin-top:2px">⬆ ${bonStr}</div>` : ''}
          ${tipoCanon==='consumivel'&&d.alvo ? `<div style="font-size:0.68rem;color:var(--suave)">Alvo: ${d.alvo}${d.alcance_m ? ` · ${d.alcance_m}m` : ''}</div>` : ''}
          ${slotKey ? `<div style="font-size:0.68rem;color:var(--suave)">${SLOTS_LABELS[slotKey]?.icon||''} ${SLOTS_LABELS[slotKey]?.label||slotKey}</div>` : ''}
        </div>
        ${mestreAcoes}
      </div>`;
    }).join('')}`;
}

function _efeitoLabel(ef) {
  if (!ef) return '';
  switch(ef.tipo) {
    case 'hp':       return `❤ HP ${ef.valor>0?'+':''}${ef.valor}`;
    case 'recurso':  return `✨ ${ef.recurso} ${ef.valor>0?'+':''}${ef.valor}`;
    case 'atributo': return `⬆ ${ef.attr} ${ef.valor>0?'+':''}${ef.valor}${ef.duracao_turnos?` (${ef.duracao_turnos}t)`:''}`;
    case 'remover_debuff': return `🌟 Remove ${ef.debuff||'debuff'}`;
    case 'dano':     return `💥 Dano ${ef.valor}`;
    case 'debuff':   return `☠ Aplica ${ef.debuff||'debuff'}${ef.duracao_turnos?` (${ef.duracao_turnos}t)`:''}`;
    // BUG FIX #6: tipos buff e dot não tinham label
    case 'buff':     return `✨ Buff "${ef.nome||'Buff'}"${ef.duracao_turnos?` (${ef.duracao_turnos}t)`:ef.hot_turnos?` (${ef.hot_turnos}t)`:''}`;
    case 'dot':      return `🩸 DOT "${ef.nome||'DOT'}" ${ef.dot_formula||ef.valor||'?'}/t${ef.duracao_turnos?` (${ef.duracao_turnos}t)`:''}`;
    default: return ef.tipo ? `⚙ ${ef.tipo}` : '';
  }
}

// ── Pendências de aprovação ────────────────────────────────────
function renderItensPendentes() {
  const wrap = document.getElementById('itens-aprovacoes-wrap');
  const lista = document.getElementById('itens-aprovacoes-lista');
  if (!wrap || !lista) return;
  if (RPG_DATA?.myRole !== 'mestre' || !INV.usosPendentes.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  lista.innerHTML = INV.usosPendentes.map(u => {
    const def = INV.itemDefs.find(d => d.id === u.item_def_id || d.id === u.item_catalog_id);
    const usadoPor = RPG_DATA?.characters?.find(c => c.id === u.usado_por_id);
    const alvo     = RPG_DATA?.characters?.find(c => c.id === u.alvo_id);
    return `<div class="item-uso-pendente">
      <div class="item-uso-pendente-info">
        <b>${usadoPor?.nome||'?'}</b> quer usar <b>${def?.icone||'📦'} ${def?.nome||'item'}</b>
        ${alvo ? ` em <b>${alvo.nome}</b>` : ''}
        ${u.efeitos_snap ? `<div style="font-size:0.72rem;color:#7ec8f0;margin-top:3px">${(u.efeitos_snap||[]).map(_efeitoLabel).join(' · ')}</div>` : ''}
      </div>
      <div class="item-uso-pendente-acoes">
        <button onclick="aprovarUsoItem(${u.id})" style="flex:1;padding:7px;background:rgba(39,174,96,0.1);border:1px solid rgba(39,174,96,0.35);border-radius:6px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">✓ Aprovar</button>
        <button onclick="rejeitarUsoItem(${u.id})" style="flex:1;padding:7px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:6px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">✕ Rejeitar</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════
// INVENTÁRIO NA FICHA DO PERSONAGEM
// ═══════════════════════════════════════════════════════════════

async function renderInventarioChar(nome) {
  const charView = document.getElementById('char-view');
  if (!charView) return;

  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  if (!c) return;

  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podEditar = isMestre || RPG_DATA?.linked === nome;

  // Carregar inventário deste personagem
  await invCarregarInventarioChar(c.id);
  const invChar = INV.inventario.filter(i => i.character_id === c.id);

  const equipamentos = invChar.filter(i => {
    const def = INV.itemDefs.find(d => d.id === (i.item_catalog_id || i.item_def_id));
    return def?.tipo === 'equipamento';
  });
  const consumiveis = invChar.filter(i => {
    const def = INV.itemDefs.find(d => d.id === (i.item_catalog_id || i.item_def_id));
    return def?.tipo === 'consumivel' || def?.tipo === 'misc';
  });

  // Verificar se há algum item definido na campanha
  const temItens = INV.itemDefs.length > 0;
  if (!temItens && !invChar.length) return; // sem sistema de itens: não renderizar

  const addBtn = podEditar ? `<button class="inv-add-btn" onclick="abrirModalAddInv('${nome.replace(/'/g,"\\'")}','${c.id}')">＋ Adicionar</button>` : '';

  // Montar seção de slots de equipamento
  const slotsHtml = Object.entries(SLOTS_LABELS).map(([slotKey, slotMeta]) => {
    const invItem = equipamentos.find(i => i.slot_equipado === slotKey && i.equipado);
    if (invItem) {
      const def = INV.itemDefs.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
      const bonusSrc = def?.atributos_bonus || def?.bonus_attrs || {};
      const bonus = Object.entries(bonusSrc).map(([k,v])=>`${k}${v>0?'+':''}${v}`).join(' ');
      return `<div class="inv-slot ocupado" onclick="invToggleEquip('${nome.replace(/'/g,"\\'")}',${invItem.id})" title="Clique para desequipar: ${def?.nome||'?'}">
        <div class="inv-slot-label">${slotMeta.label}</div>
        <div class="inv-slot-icon">${def?.icone||slotMeta.icon}</div>
        <div class="inv-slot-name">${def?.nome||'?'}</div>
        ${bonus ? `<div class="inv-slot-bonus">${bonus}</div>` : ''}
      </div>`;
    }
    // Verificar se tem o item no inventário mas não equipado
    const itemNaoEquipado = equipamentos.find(i => {
      const def2 = INV.itemDefs.find(d => d.id === (i.item_catalog_id || i.item_def_id));
      return !i.equipado && (def2?.slot_padrao === slotKey || def2?.slot === slotKey);
    });
    return `<div class="inv-slot" style="${itemNaoEquipado?'border-color:rgba(200,168,75,0.15);':''}opacity:${itemNaoEquipado?'0.7':'0.4'}" ${itemNaoEquipado ? `onclick="invToggleEquip('${nome.replace(/'/g,"\\'")}',${itemNaoEquipado.id})" title="Equipar: ${INV.itemDefs.find(d=>d.id===(itemNaoEquipado.item_catalog_id||itemNaoEquipado.item_def_id))?.nome||'?'}"` : ''}>
      <div class="inv-slot-label">${slotMeta.label}</div>
      <div class="inv-slot-icon" style="opacity:0.3">${slotMeta.icon}</div>
      ${itemNaoEquipado ? `<div style="font-size:0.58rem;color:var(--suave)">${INV.itemDefs.find(d=>d.id===(itemNaoEquipado.item_catalog_id||itemNaoEquipado.item_def_id))?.nome||''}</div>` : `<div style="font-size:0.5rem;color:rgba(255,255,255,0.15);margin-top:2px">vazio</div>`}
    </div>`;
  }).join('');

  // Montar seção de consumíveis
  const consHtml = consumiveis.length ? consumiveis.map(i => {
    const def = INV.itemDefs.find(d => d.id === (i.item_catalog_id || i.item_def_id));
    if (!def) return '';
    const efeitos = Array.isArray(def.efeitos) ? def.efeitos : [];
    // BUG FIX #1: efStr nunca estava definido neste escopo
    const efStr = efeitos.map(ef => _efeitoLabel(ef)).filter(Boolean).join(' · ');
    const nocivo = efeitos.some(e => e.tipo === 'dano' || e.tipo === 'debuff');
    const semQtd = i.quantidade <= 0;
    const qtdBaixa = !semQtd && i.quantidade === 1; // UX: destaque quando último
    const btnClass = `inv-usar-btn${nocivo ? ' inv-nocivo-btn' : ''}`;
    return `<div class="inv-consumivel">
      <div class="inv-consumivel-icon">${def.icone||'📦'}</div>
      <div class="inv-consumivel-info">
        <div class="inv-consumivel-nome">${def.nome}</div>
        ${efStr ? `<div class="inv-consumivel-desc">${efStr}</div>` : ''}
        <div class="inv-consumivel-qtd" style="color:${semQtd?'var(--perigo)':qtdBaixa?'#f0a050':'var(--suave)'}">×${i.quantidade}</div>
      </div>
      ${podEditar ? `<button class="${btnClass}" ${semQtd?'disabled':''} onclick="abrirModalUsarItem(${i.id},'${nome.replace(/'/g,"\\'")}')">
        ${semQtd ? 'Esgotado' : nocivo ? '🗡 Lançar' : '🧪 Usar'}
      </button>` : ''}
    </div>`;
  }).join('') : `<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Nenhum consumível</div>`;

  // Injetar ao final do char-view
  const existingInv = document.getElementById(`inv-section-${c.id}`);
  const invHtml = `<div id="inv-section-${c.id}" class="card" style="border-top:2px solid rgba(200,168,75,0.2)">
    <div class="inv-section-title" style="margin-top:0">🎒 Inventário ${addBtn}</div>
    ${equipamentos.length || isMestre ? `
      <div class="inv-section-title" style="font-size:0.58rem">⚔ Equipamentos</div>
      <div class="inv-slot-grid">${slotsHtml}</div>
    ` : ''}
    <div class="inv-section-title" style="font-size:0.58rem">🧪 Consumíveis</div>
    ${consHtml}
  </div>`;

  if (existingInv) {
    existingInv.outerHTML = invHtml;
  } else {
    charView.insertAdjacentHTML('beforeend', invHtml);
  }
}

// ── Equipar / Desequipar ─────────────────────────────────────
let _invEquipando = false; // guard against double-click freeze
async function invToggleEquip(nomeChar, invId) {
  if (_invEquipando) return;
  _invEquipando = true;
  try {
  const invItem = INV.inventario.find(i => i.id === invId);
  if (!invItem) { _invEquipando = false; return; }
  const def = INV.itemDefs.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
  if (!def || def.tipo !== 'equipamento') { _invEquipando = false; return; }
  const c = RPG_DATA?.characters?.find(x => x.nome === nomeChar);
  if (!c) { _invEquipando = false; return; }

  const estaEquipado = invItem.equipado;
  const slotDef = def.slot_padrao || def.slot;

  if (!estaEquipado) {
    // Verificar se o slot já está ocupado por outro item
    const slotOcupado = INV.inventario.find(i =>
      i.character_id === c.id && i.equipado && i.slot_equipado === slotDef && i.id !== invId
    );
    if (slotOcupado) {
      // Desequipar o anterior primeiro
      await _invDesequipar(nomeChar, slotOcupado, INV.itemDefs.find(d => d.id === (slotOcupado.item_catalog_id || slotOcupado.item_def_id)));
    }
    await _invEquipar(nomeChar, invItem, def);
  } else {
    await _invDesequipar(nomeChar, invItem, def);
  }

  await renderInventarioChar(nomeChar);
  } finally { _invEquipando = false; }
}

async function _invEquipar(nomeChar, invItem, def) {
  const c = RPG_DATA?.characters?.find(x => x.nome === nomeChar);
  if (!c) return;
  const ca = c.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};

  // Lê bônus do item: campo atual (atributos_bonus) ou campo antigo (bonus_attrs)
  const bonus = def.atributos_bonus || def.bonus_attrs || {};
  const slotDef = def.slot_padrao || def.slot;
  // BUG FIX #2: calcular snapshot do delta real (suporte a % e absoluto)
  const snapshot = {};
  Object.entries(bonus).forEach(([attr, val]) => {
    const atual = parseFloat(ca.atributos[attr]) || 0;
    let delta;
    if (typeof val === 'object' && val.modo === 'pct') {
      delta = Math.round(atual * Math.abs(val.valor) / 100) * Math.sign(val.valor);
    } else {
      delta = typeof val === 'object' ? val.valor : parseFloat(val) || 0;
    }
    snapshot[attr] = delta;
    ca.atributos[attr] = atual + delta;
  });

  invItem.equipado = true;
  invItem.slot_equipado = slotDef;
  invItem.bonus_snapshot = snapshot;
  c.custom_attrs = ca;

  try {
    await Promise.all([
      sb(`inventario?id=eq.${invItem.id}`, { method:'PATCH', body: JSON.stringify({ equipado:true, slot_equipado:slotDef, bonus_snapshot: snapshot }) }),
      sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeChar)}`, { method:'PATCH', body: JSON.stringify({ custom_attrs: ca }) }),
    ]);
    mostrarToast(`⚔ ${def.nome} equipado!`, 'sucesso');
    renderCharView(nomeChar);
    renderAttrView?.(nomeChar);
  } catch(e) { mostrarToast('Erro ao equipar', 'erro'); }
}

async function _invDesequipar(nomeChar, invItem, def) {
  const c = RPG_DATA?.characters?.find(x => x.nome === nomeChar);
  if (!c) return;
  const ca = c.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};

  // BUG FIX #2b: usar bonus_snapshot quando disponível (evita drift em bônus percentuais)
  const snapshot = invItem.bonus_snapshot;
  if (snapshot && Object.keys(snapshot).length) {
    Object.entries(snapshot).forEach(([attr, delta]) => {
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - delta;
    });
  } else {
    // Fallback: reverter pelo valor bruto do item
    const bonus = def?.atributos_bonus || def?.bonus_attrs || {};
    Object.entries(bonus).forEach(([attr, val]) => {
      const n = typeof val === 'object' ? val.valor : val;
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - n;
    });
  }

  invItem.equipado = false;
  invItem.slot_equipado = null;
  invItem.bonus_snapshot = null;
  c.custom_attrs = ca;

  try {
    await Promise.all([
      sb(`inventario?id=eq.${invItem.id}`, { method:'PATCH', body: JSON.stringify({ equipado:false, slot_equipado:null, bonus_snapshot:null }) }),
      sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeChar)}`, { method:'PATCH', body: JSON.stringify({ custom_attrs: ca }) }),
    ]);
    mostrarToast(`🔓 ${def?.nome||'Item'} desequipado`, '');
    renderCharView(nomeChar);
    renderAttrView?.(nomeChar);
  } catch(e) { mostrarToast('Erro ao desequipar', 'erro'); }
}

// ═══════════════════════════════════════════════════════════════
// USAR ITEM (CONSUMÍVEL)
// ═══════════════════════════════════════════════════════════════

let _usarItemCtx = null; // { invItem, def, nomeUsuario }

function abrirModalUsarItem(invId, nomeUsuario) {
  // Converter para número se vier como string
  const id = typeof invId === 'string' ? parseInt(invId) : invId;
  
  const invItem = INV.inventario.find(i => i.id === id);
  if (!invItem) return;
  
  const def = INV.itemDefs.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
  if (!def) return;

  _usarItemCtx = { invItem, def, nomeUsuario };

  document.getElementById('usar-item-nome').textContent = `${def.icone||'📦'} ${def.nome}`;
  document.getElementById('usar-item-desc').textContent = def.descricao || '';
  document.getElementById('usar-item-inv-id').value = invId;
  document.getElementById('usar-item-alvo-sel').value = '';

  const efeitos = Array.isArray(def.efeitos) ? def.efeitos : [];
  document.getElementById('usar-item-efeitos').innerHTML = efeitos.length
    ? efeitos.map(ef => `<div>• ${_efeitoLabel(ef)}</div>`).join('')
    : '<span style="color:var(--suave);font-style:italic">Nenhum efeito definido</span>';

  const precisaAprovacao = !def.alvo || def.requer_aprovacao;
  document.getElementById('usar-item-aprovacao-msg').style.display = (precisaAprovacao && RPG_DATA?.myRole !== 'mestre') ? 'block' : 'none';

  // Montar lista de alvos
  const alvoWrap = document.getElementById('usar-item-alvo-wrap');
  const alvoLista = document.getElementById('usar-item-alvos-lista');
  const usuarioChar = RPG_DATA?.characters?.find(c => c.nome === nomeUsuario);

  if (def.alvo === 'self') {
    alvoWrap.style.display = 'none';
    document.getElementById('usar-item-alvo-sel').value = usuarioChar?.id || '';
  } else {
    alvoWrap.style.display = 'block';
    const chars = RPG_DATA?.characters || [];
    const candidatos = chars.filter(c => {
  if (!c.id) return false;
  if (def.alvo === 'aliado') {
    // Aliados: inclui o próprio usuário + outros jogadores/aliados
    return c.custom_attrs?.tipo === 'jogador' || c.custom_attrs?.aliado === true;
  }
      if (def.alvo === 'inimigo') {
        return c.custom_attrs?.tipo === 'npc' || c.custom_attrs?.tipo === 'criatura';
      }
      return true; // alvo não definido: mostrar todos
    });

    if (!candidatos.length) {
      const tipoAlvo = def.alvo === 'aliado' ? 'aliados' : def.alvo === 'inimigo' ? 'inimigos' : 'alvos';
      alvoLista.innerHTML = `<div style="color:var(--suave);font-style:italic;font-size:0.82rem;text-align:center;padding:10px">
        Nenhum ${tipoAlvo} disponível no momento.${def.alvo === 'aliado' ? '<br><span style="font-size:0.72rem">Verifique se os aliados têm tipo "jogador" na ficha.</span>' : ''}
      </div>`;
    }
    alvoLista.innerHTML = candidatos.length ? candidatos.map(alvo => {
      // Verificar alcance (se ambos têm posição no mapa)
      let alcanceOk = true;
      let alcanceInfo = '';
      if (def.alcance_m && MAPA_STATE?.mapaAtualId) {
        const posU = usuarioChar?.map_positions?.[MAPA_STATE.mapaAtualId];
        const posA = alvo?.map_positions?.[MAPA_STATE.mapaAtualId];
        if (posU && posA) {
          const mapaEntry = RPG_DATA?.mapas?.find(m => m.mapa.map_id === MAPA_STATE.mapaAtualId);
          const escala = mapaEntry?.mapa?.escala_val || 1.5;
          const grid = mapaEntry?.mapa?.grid || 20;
          const dx = (posU.x - posA.x) * grid;
          const dy = (posU.y - posA.y) * grid;
          const dist = Math.sqrt(dx*dx + dy*dy) * (escala / grid);
          alcanceOk = dist <= def.alcance_m;
          alcanceInfo = ` (${dist.toFixed(1)}m)`;
        }
      }
      return `<button onclick="selecionarAlvoItem('${alvo.id}','${alvo.nome.replace(/'/g,"\\'")}', this)" style="width:100%;padding:9px 12px;background:${alcanceOk?'rgba(30,45,66,0.6)':'rgba(192,57,43,0.06)'};border:1px solid ${alcanceOk?'var(--borda)':'rgba(192,57,43,0.2)'};border-radius:7px;color:${alcanceOk?'var(--texto)':'rgba(192,57,43,0.6)'};font-family:var(--fonte-d);font-size:0.72rem;cursor:${alcanceOk?'pointer':'default'};text-align:left;transition:all 0.15s" ${!alcanceOk?'disabled':''}>
        ${alvo.custom_attrs?.cor?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${alvo.custom_attrs.cor};margin-right:6px"></span>`:''}
        ${alvo.nome}${alcanceInfo}${!alcanceOk ? ' <span style="font-size:0.6rem;color:rgba(192,57,43,0.5)">fora do alcance</span>' : ''}
      </button>`;
    }).join('') : `<div style="color:var(--suave);font-style:italic;font-size:0.82rem;text-align:center;padding:10px">Nenhum alvo disponível</div>`;
  }

  document.getElementById('modal-usar-item-overlay').style.display = 'flex';
}

function selecionarAlvoItem(alvoId, alvoNome, btn) {
  document.getElementById('usar-item-alvo-sel').value = alvoId;
  document.querySelectorAll('#usar-item-alvos-lista button').forEach(b => {
    b.style.background = 'rgba(30,45,66,0.6)';
    b.style.borderColor = 'var(--borda)';
  });
  btn.style.background = 'rgba(79,163,209,0.12)';
  btn.style.borderColor = 'rgba(79,163,209,0.4)';
}

function fecharModalUsarItem() {
  document.getElementById('modal-usar-item-overlay').style.display = 'none';
  _usarItemCtx = null;
}

async function confirmarUsarItem() {
  if (!_usarItemCtx) return;
  const { invItem, def, nomeUsuario } = _usarItemCtx;
  const alvoId = document.getElementById('usar-item-alvo-sel').value;
  const precisaAlvo = def.alvo && def.alvo !== 'self';

  if (precisaAlvo && !alvoId) { mostrarToast('Selecione um alvo', 'aviso'); return; }

  const precisaAprovacao = !def.alvo || def.requer_aprovacao;
  const usuarioChar = RPG_DATA?.characters?.find(c => c.nome === nomeUsuario);

  // BUG FIX #8: guard para usuarioChar não encontrado
  if (!usuarioChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }

  if (precisaAprovacao && RPG_DATA?.myRole !== 'mestre') {
    // Enviar para aprovação do mestre (apenas jogadores)
    try {
      const [row] = await sb('item_usos', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          rpg_id: RPG_DATA.rpgId,
          inventario_id: invItem.id,
          item_def_id: def.id,       // coluna original em item_usos (não renomeada)
          usado_por_id: usuarioChar.id,
          alvo_id: alvoId || null,
          status: 'pendente',
          efeitos_snap: def.efeitos,
        })
      });
      if (row) INV.usosPendentes.push(row);
      renderItensPendentes();
      mostrarToast('⏳ Uso enviado para aprovação do Mestre', 'aviso');
      fecharModalUsarItem();
    } catch(e) { mostrarToast('Erro ao enviar uso', 'erro'); }
    return;
  }

  // Aplicar efeitos imediatamente
  const alvoChar = RPG_DATA?.characters?.find(c => c.id === alvoId) || usuarioChar;
  if (!alvoChar) { mostrarToast('Alvo não encontrado', 'erro'); return; }

  await _aplicarEfeitosItem(def.efeitos || [], alvoChar.nome, nomeUsuario);
  await _consumirItem(invItem);
  fecharModalUsarItem();
}

async function _aplicarEfeitosItem(efeitos, alvoNome, usuarioNome) {
  const emArena = !!(typeof AR !== 'undefined' && AR?.session);
  const chars = emArena ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const alvo = chars.find(c => c.nome === alvoNome);
  if (!alvo) return;
  const ca = alvo.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};
  let hpChange = 0;
  const toastMsgs = [];

  for (const ef of efeitos) {
    switch(ef.tipo) {
      case 'hp': {
        const hpMax = ca.hp_max || 100;
        const novoHp = Math.min(hpMax, Math.max(0, (alvo.hp_atual || 0) + ef.valor));
        alvo.hp_atual = novoHp;
        if (emArena) {
          await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(alvoNome)}`, { method:'PATCH', body:JSON.stringify({ hp_atual: novoHp }) });
        } else {
          await saveCharacterStats(RPG_DATA.rpgId, alvoNome, { hp_atual: novoHp });
        }
        toastMsgs.push(`❤ HP ${ef.valor > 0 ? '+' : ''}${ef.valor}`);
      if (ef.valor > 0) HUB_EVENTS.emit('cura_aplicada', { origem: usuarioNome || '?', alvo: alvoNome, valor: ef.valor });
        break;
      }
      case 'recurso':
        if (ef.recurso) {
          // BUG FIX #5: clamp no zero para débitos; sem teto fixo (mestre configura)
          const atualRecurso = parseFloat(ca.atributos[ef.recurso]) || 0;
          const novoRecurso = ef.valor < 0
            ? Math.max(0, atualRecurso + ef.valor)
            : atualRecurso + ef.valor;
          ca.atributos[ef.recurso] = novoRecurso;
          if (novoRecurso === 0 && ef.valor < 0 && atualRecurso > 0) {
            toastMsgs.push(`⚠ ${ef.recurso} zerado!`);
          } else {
            toastMsgs.push(`✨ ${ef.recurso} ${ef.valor > 0 ? '+' : ''}${ef.valor}`);
          }
        }
        break;
      case 'atributo':
        if (ef.attr) {
          if (ef.duracao_turnos > 0) {
            // BUG FIX #3: efeito TEMPORÁRIO — NÃO modifica o atributo permanentemente.
            // O buff carrega o delta; ao expirar via sistema de turno deve ser revertido.
            if (!Array.isArray(alvo.buffs)) alvo.buffs = [];
            alvo.buffs.push({
              nome: `+${ef.valor} ${ef.attr}`,
              tipo: 'buff',
              turnos_restantes: ef.duracao_turnos,
              auto_aplicado: true,
              modificador_attr: ef.attr,
              modificador_delta: ef.valor,
            });
            // Aplica o delta temporariamente para a sessão
            ca.atributos[ef.attr] = (parseFloat(ca.atributos[ef.attr]) || 0) + ef.valor;
            toastMsgs.push(`⬆ ${ef.attr} ${ef.valor > 0 ? '+' : ''}${ef.valor} (${ef.duracao_turnos}t)`);
          } else {
            // Permanente: aplica direto
            ca.atributos[ef.attr] = (parseFloat(ca.atributos[ef.attr]) || 0) + ef.valor;
            toastMsgs.push(`⬆ ${ef.attr} ${ef.valor > 0 ? '+' : ''}${ef.valor}`);
          }
        }
        break;
      case 'remover_debuff':
        if (Array.isArray(alvo.buffs)) {
          alvo.buffs = alvo.buffs.filter(b => b.nome !== ef.debuff);
          toastMsgs.push(`🌟 ${ef.debuff || 'Debuff'} removido`);
        }
        break;
      case 'dano': {
        const dano = ef.valor || 0;
        const novoHpDano = Math.max(0, (alvo.hp_atual || 0) - dano);
        alvo.hp_atual = novoHpDano;
        if (emArena) {
          await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(alvoNome)}`, { method:'PATCH', body:JSON.stringify({ hp_atual: novoHpDano }) });
        } else {
          await saveCharacterStats(RPG_DATA.rpgId, alvoNome, { hp_atual: novoHpDano });
        }
        toastMsgs.push(`💥 ${alvoNome} sofreu ${dano} de dano`);
      HUB_EVENTS.emit('dano_aplicado', { atacante: usuarioNome || '?', alvo: alvoNome, valor: dano, tipo: 'item' });
        break;
      }
      case 'debuff':
        if (!Array.isArray(alvo.buffs)) alvo.buffs = [];
        alvo.buffs.push({ nome: ef.debuff || 'Debuff', tipo: 'debuff', turnos_restantes: ef.duracao_turnos || 3, negativo: true, auto_aplicado: true });
        toastMsgs.push(`☠ ${ef.debuff||'Debuff'} aplicado em ${alvoNome}`);
        break;
      case 'buff':
        // Buff genérico de item com HOT/boost completo
        if (!Array.isArray(alvo.buffs)) alvo.buffs = [];
        alvo.buffs.push({
          id: 'item_' + Date.now(),
          nome: ef.nome || 'Buff',
          tipo: 'buff',
          hot_formula: ef.hot_formula || null,
          hot_turnos_restantes: ef.hot_turnos || 0,
          boost_dano: ef.boost_dano || 0,
          boost_dano_turnos_restantes: ef.boost_dano_turnos || 0,
          turnos_restantes: ef.duracao_turnos || ef.hot_turnos || ef.boost_dano_turnos || 3,
          auto_aplicado: true,
        });
        toastMsgs.push(`✨ Buff "${ef.nome||'Buff'}" aplicado em ${alvoNome}`);
        break;
      case 'dot':
        // DOT de item
        if (!Array.isArray(alvo.buffs)) alvo.buffs = [];
        alvo.buffs.push({
          id: 'item_' + Date.now(),
          nome: ef.nome || 'DOT',
          tipo: 'debuff',
          dot_formula: ef.dot_formula || String(ef.valor || 1),
          dot_turnos_restantes: ef.duracao_turnos || ef.dot_turnos || 3,
          turnos_restantes: ef.duracao_turnos || ef.dot_turnos || 3,
          auto_aplicado: true,
        });
        toastMsgs.push(`🩸 DOT "${ef.nome||'DOT'}" aplicado em ${alvoNome}`);
        break;
    }
  }

  // Salvar custom_attrs e buffs
  alvo.custom_attrs = ca;
  const patchBody = { custom_attrs: ca, buffs: alvo.buffs || [] };
  if (emArena) {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(alvoNome)}`, { method:'PATCH', body: JSON.stringify(patchBody) });
  } else {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(alvoNome)}`, { method:'PATCH', body: JSON.stringify(patchBody) });
  }

  if (toastMsgs.length) mostrarToast(`${toastMsgs.join(' · ')}`, 'sucesso');
  if (!emArena) { renderCharView(CHAR_VIEW); renderAttrView?.(ATTR_VIEW); mapaRenderStatus?.(); }
  else { renderArenaPersonagens?.(); renderArenaEntidades?.(); }
}

async function _consumirItem(invItem) {
  const novaQtd = (invItem.quantidade || 1) - 1;
  invItem.quantidade = novaQtd;
  const charId = invItem.character_id;
  if (novaQtd <= 0) {
    // Remover do inventário
    try {
      await sb(`inventario?id=eq.${invItem.id}`, { method:'DELETE' });
      // BUG FIX #4: sincronizar AMBOS os caches
      INV.inventario = INV.inventario.filter(i => i.id !== invItem.id);
      if (charId && INV.inventarios[charId]) {
        INV.inventarios[charId] = INV.inventarios[charId].filter(i => i.id !== invItem.id);
      }
    } catch(e) {}
  } else {
    await sb(`inventario?id=eq.${invItem.id}`, { method:'PATCH', body: JSON.stringify({ quantidade: novaQtd }) });
    // BUG FIX #4: atualizar quantidade em INV.inventarios também
    if (charId && INV.inventarios[charId]) {
      const idx = INV.inventarios[charId].findIndex(i => i.id === invItem.id);
      if (idx >= 0) INV.inventarios[charId][idx].quantidade = novaQtd;
    }
  }
}

// ── Aprovações (mestre) ───────────────────────────────────────
async function aprovarUsoItem(usoId) {
  const uso = INV.usosPendentes.find(u => u.id === usoId);
  if (!uso) return;
  const def = INV.itemDefs.find(d => d.id === (uso.item_def_id || uso.item_catalog_id));
  const usuarioChar = RPG_DATA?.characters?.find(c => c.id === uso.usado_por_id);
  const alvoChar    = RPG_DATA?.characters?.find(c => c.id === uso.alvo_id);

  const alvoNome  = alvoChar?.nome || usuarioChar?.nome;
  const efeitos   = uso.efeitos_snap || def?.efeitos || [];

  await _aplicarEfeitosItem(efeitos, alvoNome, usuarioChar?.nome);

  // Consumir o item
  const invItem = INV.inventario.find(i => i.id === uso.inventario_id);
  if (invItem) await _consumirItem(invItem);

  await sb(`item_usos?id=eq.${usoId}`, { method:'PATCH', body: JSON.stringify({ status:'aplicado', resolvido_em: new Date().toISOString() }) });
  INV.usosPendentes = INV.usosPendentes.filter(u => u.id !== usoId);
  renderItensPendentes();
  mostrarToast(`✓ Uso de ${def?.nome||'item'} aprovado e aplicado`, 'sucesso');
}

async function rejeitarUsoItem(usoId) {
  await sb(`item_usos?id=eq.${usoId}`, { method:'PATCH', body: JSON.stringify({ status:'rejeitado', resolvido_em: new Date().toISOString() }) });
  INV.usosPendentes = INV.usosPendentes.filter(u => u.id !== usoId);
  renderItensPendentes();
  mostrarToast('✕ Uso rejeitado', '');
}

// ═══════════════════════════════════════════════════════════════
// MODAL: ADICIONAR AO INVENTÁRIO
// ═══════════════════════════════════════════════════════════════

let _addInvCharId = null;
let _addInvCharNome = null;

function abrirModalAddInv(nome, charId) {
  _addInvCharId = charId;
  _addInvCharNome = nome;
  document.getElementById('add-inv-char-nome').textContent = nome;
  document.getElementById('add-inv-char-id').value = charId;
  document.getElementById('add-inv-busca').value = '';
  renderAddInvLista();
  document.getElementById('modal-add-inv-overlay').style.display = 'flex';
}

function fecharModalAddInv() {
  document.getElementById('modal-add-inv-overlay').style.display = 'none';
}

function renderAddInvLista() {
  const busca = document.getElementById('add-inv-busca').value.toLowerCase();
  const lista = document.getElementById('add-inv-lista');
  const defs = INV.itemDefs.filter(d => !busca || d.nome.toLowerCase().includes(busca) || (d.descricao||'').toLowerCase().includes(busca));
  if (!defs.length) { lista.innerHTML = `<div style="color:var(--suave);font-style:italic;text-align:center;padding:10px">Nenhum item encontrado</div>`; return; }
  lista.innerHTML = defs.map(d => {
    const rarCor = {comum:'var(--suave)',incomum:'#5ee09a',raro:'#7ec8f0',épico:'#b07ef0',lendário:'#f0cc6a'}[d.raridade]||'var(--suave)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--escuro);border:1px solid var(--borda);border-radius:8px;cursor:pointer;transition:border-color 0.15s" onmouseenter="this.style.borderColor='rgba(200,168,75,0.3)'" onmouseleave="this.style.borderColor='var(--borda)'" onclick="adicionarAoInventario(${d.id})">
      <span style="font-size:1.4rem">${d.icone||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fonte-d);font-size:0.8rem;color:var(--texto)">${d.nome}</div>
        <div style="font-size:0.68rem;color:${rarCor}">${d.raridade||''} · ${d.tipo}</div>
      </div>
      <button style="background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:5px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.6rem;padding:4px 9px;cursor:pointer">＋</button>
    </div>`;
  }).join('');
}

async function adicionarAoInventario(itemDefId) {
  if (!_addInvCharId) return;
  const def = INV.itemDefs.find(d => d.id === itemDefId);
  try {
    // Verificar se já existe no inventário (consumíveis podem acumular, equipamentos não)
    const existing = INV.inventario.find(i => i.character_id === _addInvCharId && (i.item_catalog_id === itemDefId || i.item_def_id === itemDefId));
    if (existing && def?.tipo === 'consumivel') {
      // Incrementar quantidade
      existing.quantidade++;
      await sb(`inventario?id=eq.${existing.id}`, { method:'PATCH', body: JSON.stringify({ quantidade: existing.quantidade }) });
    } else {
      const [row] = await sb('inventario', {
        method:'POST', headers:{'Prefer':'return=representation'},
        body: JSON.stringify({
          rpg_id: RPG_DATA.rpgId,
          character_id: _addInvCharId,
          item_catalog_id: itemDefId,  // nome novo da coluna após migração
          quantidade: 1,
          equipado: false,
        })
      });
      if (row) INV.inventario.push(row);
    }
    mostrarToast(`✦ ${def?.nome||'Item'} adicionado`, 'sucesso');
    fecharModalAddInv();
    if (_addInvCharNome) renderInventarioChar(_addInvCharNome);
  } catch(e) { mostrarToast('Erro ao adicionar item', 'erro'); }
}

// ═══════════════════════════════════════════════════════════════
// MODAL: CRIAR/EDITAR ITEM (MESTRE)
// ═══════════════════════════════════════════════════════════════

let _itemDefEfeitos = [];
let _itemDefBonus = {};

function abrirModalItemDef(id) {
  _itemDefEfeitos = [];
  _itemDefBonus = {};
  document.getElementById('idef-id-edit').value = id || '';
  document.getElementById('idef-efeitos-lista').innerHTML = '';
  document.getElementById('idef-bonus-lista').innerHTML = '';
  // Image field: only masters can configure
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const imgGroup = document.getElementById('idef-img-group');
  if (imgGroup) imgGroup.style.display = isMestre ? '' : 'none';

  if (id) {
    const def = INV.itemDefs.find(d => d.id === id);
    if (!def) return;
    document.getElementById('modal-itemdef-titulo').textContent = '⚗ Editar Item';
    document.getElementById('idef-nome').value = def.nome || '';
    document.getElementById('idef-icone').value = def.icone || '';
    document.getElementById('idef-tipo').value = def.tipo || 'consumivel';
    document.getElementById('idef-desc').value = def.descricao || '';
    document.getElementById('idef-raridade').value = def.raridade || 'comum';
    document.getElementById('idef-valor').value = def.valor_base || '';
    document.getElementById('idef-alvo').value = def.alvo || '';
    document.getElementById('idef-alcance').value = def.alcance_m || '';
    document.getElementById('idef-requer-aprov').checked = !!def.requer_aprovacao;
    document.getElementById('idef-slot').value = def.slot_padrao || def.slot || 'corpo';
    const imgUrl = def.img_url || def.icone_img || '';
    if (document.getElementById('idef-img-url')) {
      document.getElementById('idef-img-url').value = imgUrl;
      _idefUpdateImgPreview(imgUrl);
    }
    _itemDefEfeitos = Array.isArray(def.efeitos) ? JSON.parse(JSON.stringify(def.efeitos)) : [];
    const bonusSrc = def.atributos_bonus || def.bonus_attrs;
    _itemDefBonus = (bonusSrc && typeof bonusSrc === 'object') ? JSON.parse(JSON.stringify(bonusSrc)) : {};
    _renderItemDefEfeitos();
    _renderItemDefBonus();
  } else {
    document.getElementById('modal-itemdef-titulo').textContent = '⚗ Novo Item';
    document.getElementById('idef-nome').value = '';
    document.getElementById('idef-icone').value = '📦';
    document.getElementById('idef-tipo').value = 'consumivel';
    document.getElementById('idef-desc').value = '';
    document.getElementById('idef-raridade').value = 'comum';
    document.getElementById('idef-valor').value = '';
    document.getElementById('idef-alvo').value = '';
    document.getElementById('idef-alcance').value = '';
    document.getElementById('idef-requer-aprov').checked = false;
    document.getElementById('idef-slot').value = 'corpo';
    if (document.getElementById('idef-img-url')) {
      document.getElementById('idef-img-url').value = '';
      _idefUpdateImgPreview('');
    }
  }
  itemDefTipoChange();
  // Inicializar formulário inteligente
  setTimeout(() => {
    if (typeof itemDefCatChange === 'function') {
      // Se tem efeitos já definidos, tentar mapear para categoria correta
      if (_itemDefEfeitos.length > 0 && document.getElementById('idef-cat-efeito')) {
        const primeiro = _itemDefEfeitos[0];
        let cat = 'multiplo';
        if (_itemDefEfeitos.length === 1) {
          if (primeiro.tipo === 'hp') cat = 'cura';
          else if (primeiro.tipo === 'recurso') cat = 'recurso';
          else if (primeiro.tipo === 'atributo') cat = 'buff';
          else if (primeiro.tipo === 'remover_debuff') cat = 'antidoto';
          else if (primeiro.tipo === 'dano' || primeiro.tipo === 'debuff') cat = 'debuff_inimigo';
        }
        document.getElementById('idef-cat-efeito').value = cat;
        // Preencher campos simples
        if (cat === 'cura' && primeiro.tipo === 'hp') {
          if (document.getElementById('idef-cura-valor')) document.getElementById('idef-cura-valor').value = primeiro.valor || '';
          if (document.getElementById('idef-cura-hot')) document.getElementById('idef-cura-hot').checked = !!primeiro.hot;
          if (document.getElementById('idef-cura-turnos')) document.getElementById('idef-cura-turnos').value = primeiro.duracao_turnos || 3;
        } else if (cat === 'recurso') {
          if (document.getElementById('idef-rec-nome')) document.getElementById('idef-rec-nome').value = primeiro.recurso || '';
          if (document.getElementById('idef-rec-valor')) document.getElementById('idef-rec-valor').value = primeiro.valor || '';
        } else if (cat === 'buff') {
          if (document.getElementById('idef-buff-attr')) document.getElementById('idef-buff-attr').value = primeiro.attr || '';
          if (document.getElementById('idef-buff-valor')) document.getElementById('idef-buff-valor').value = primeiro.valor || '';
          if (document.getElementById('idef-buff-turnos')) document.getElementById('idef-buff-turnos').value = primeiro.duracao_turnos || 3;
        } else if (cat === 'antidoto') {
          if (document.getElementById('idef-anti-debuff')) document.getElementById('idef-anti-debuff').value = primeiro.debuff || '';
        }
      }
      itemDefCatChange();
    }
  }, 50);
  document.getElementById('modal-itemdef-overlay').style.display = 'flex';
}

function _idefUpdateImgPreview(src) {
  const el = document.getElementById('idef-img-preview');
  if (!el) return;
  el.innerHTML = src ? `<img src="${src}" loading="lazy" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">` : '📦';
}

async function idefUploadImg(input) {
  const file = input.files[0]; if (!file) return;
  try {
    mostrarToast('Enviando imagem…', 'info');
    const url = await uploadToStorage(file, 'items');
    if (document.getElementById('idef-img-url')) {
      document.getElementById('idef-img-url').value = url;
      _idefUpdateImgPreview(url);
    }
  } catch(e) {
    mostrarToast('Erro no upload da imagem', 'erro');
    console.error(e);
  }
}

function fecharModalItemDef() { document.getElementById('modal-itemdef-overlay').style.display = 'none'; }

function itemDefTipoChange() {
  const t = document.getElementById('idef-tipo').value;
  document.getElementById('idef-sec-consumivel').style.display = t === 'consumivel' ? 'block' : 'none';
  document.getElementById('idef-sec-equipamento').style.display = t === 'equipamento' ? 'block' : 'none';
}

function itemDefCatChange() {
  const cat = document.getElementById('idef-cat-efeito')?.value || 'cura';
  const cats = ['cura','recurso','buff','debuff_inimigo','antidoto','multiplo'];
  cats.forEach(c => {
    const el = document.getElementById('idef-cat-' + c);
    if (el) el.style.display = c === cat ? 'block' : 'none';
  });
  // HOT toggle
  const hotEl = document.getElementById('idef-cura-hot');
  if (hotEl) {
    const wrap = document.getElementById('idef-cura-hot-wrap');
    if (wrap) wrap.style.display = hotEl.checked ? 'block' : 'none';
    hotEl.onchange = () => { if(wrap) wrap.style.display = hotEl.checked ? 'block' : 'none'; };
  }
}

// Converte os campos simples da nova UI para o formato efeitos[] antes de salvar
function _idefColetarEfeitosSimples() {
  const cat = document.getElementById('idef-cat-efeito')?.value || 'multiplo';
  const efeitos = [];
  let alvo = '';
  let alcance = null;
  let requerAprov = false;

  if (cat === 'cura') {
    const val = parseInt(document.getElementById('idef-cura-valor')?.value) || 0;
    const hot = document.getElementById('idef-cura-hot')?.checked;
    const turnos = parseInt(document.getElementById('idef-cura-turnos')?.value) || 3;
    alvo = document.getElementById('idef-cura-alvo')?.value || 'self';
    if (alvo === 'todos_aliados') alvo = 'aliado'; // compatibilidade
    efeitos.push({ tipo: 'hp', valor: val, duracao_turnos: hot ? turnos : 0, hot: !!hot });
    if (alvo === 'aliado' && document.getElementById('idef-cura-alvo')?.value === 'todos_aliados') {
      efeitos[0].area = true;
    }
  } else if (cat === 'recurso') {
    const nome = document.getElementById('idef-rec-nome')?.value?.trim() || 'Mana';
    const val = parseInt(document.getElementById('idef-rec-valor')?.value) || 0;
    alvo = document.getElementById('idef-rec-alvo')?.value || 'self';
    efeitos.push({ tipo: 'recurso', recurso: nome, valor: val });
  } else if (cat === 'buff') {
    const attr = document.getElementById('idef-buff-attr')?.value?.trim() || '';
    const val = parseInt(document.getElementById('idef-buff-valor')?.value) || 0;
    const turnos = parseInt(document.getElementById('idef-buff-turnos')?.value) || 3;
    alvo = document.getElementById('idef-buff-alvo')?.value || 'self';
    efeitos.push({ tipo: 'atributo', attr, valor: val, duracao_turnos: turnos });
  } else if (cat === 'debuff_inimigo') {
    alvo = 'inimigo';
    alcance = parseInt(document.getElementById('idef-dbi-alcance')?.value) || null;
    requerAprov = document.getElementById('idef-dbi-aprovacao')?.checked || false;
    if (document.getElementById('idef-dbi-tem-dano')?.checked) {
      const dano = parseInt(document.getElementById('idef-dbi-dano')?.value) || 0;
      efeitos.push({ tipo: 'dano', valor: dano });
    }
    if (document.getElementById('idef-dbi-tem-debuff')?.checked) {
      const nome = document.getElementById('idef-dbi-debuff-nome')?.value?.trim() || 'Debuff';
      const turnos = parseInt(document.getElementById('idef-dbi-debuff-turnos')?.value) || 2;
      efeitos.push({ tipo: 'debuff', debuff: nome, duracao_turnos: turnos });
    }
  } else if (cat === 'antidoto') {
    const debuff = document.getElementById('idef-anti-debuff')?.value?.trim() || '';
    alvo = document.getElementById('idef-anti-alvo')?.value || 'aliado';
    efeitos.push({ tipo: 'remover_debuff', debuff });
  } else {
    // multiplo: usa _itemDefEfeitos diretamente
    return {
      efeitos: _itemDefEfeitos,
      alvo: document.getElementById('idef-alvo')?.value || '',
      alcance_m: parseInt(document.getElementById('idef-alcance')?.value) || null,
      requer_aprovacao: document.getElementById('idef-requer-aprov')?.checked || false,
    };
  }
  return { efeitos, alvo, alcance_m: alcance, requer_aprovacao: requerAprov };
}

function itemDefAddEfeito() {
  _itemDefEfeitos.push({ tipo:'hp', valor:10, duracao_turnos:0 });
  _renderItemDefEfeitos();
}

function _renderItemDefEfeitos() {
  document.getElementById('idef-efeitos-lista').innerHTML = _itemDefEfeitos.map((ef, i) => `
    <div style="display:flex;gap:5px;align-items:center;background:rgba(123,47,190,0.06);border:1px solid rgba(123,47,190,0.15);border-radius:6px;padding:6px 8px">
      <select onchange="_itemDefEfeitoChange(${i},'tipo',this.value)" style="background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;padding:3px 5px">
        <option value="hp"${ef.tipo==='hp'?' selected':''}>❤ HP</option>
        <option value="recurso"${ef.tipo==='recurso'?' selected':''}>✨ Recurso</option>
        <option value="atributo"${ef.tipo==='atributo'?' selected':''}>⬆ Atributo</option>
        <option value="remover_debuff"${ef.tipo==='remover_debuff'?' selected':''}>🌟 Remove Debuff</option>
        <option value="dano"${ef.tipo==='dano'?' selected':''}>💥 Dano</option>
        <option value="debuff"${ef.tipo==='debuff'?' selected':''}>☠ Debuff</option>
      </select>
      ${ef.tipo==='recurso'||ef.tipo==='atributo'||ef.tipo==='remover_debuff'||ef.tipo==='debuff'
        ? `<input type="text" value="${ef.recurso||ef.attr||ef.debuff||''}" placeholder="${ef.tipo==='recurso'?'Mana':'nome'}" onchange="_itemDefEfeitoChange(${i},'${ef.tipo==='recurso'?'recurso':ef.tipo==='atributo'?'attr':'debuff'}',this.value)" style="width:80px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;padding:3px 5px">` : ''}
      ${ef.tipo!=='remover_debuff'
        ? `<input type="number" value="${ef.valor||0}" placeholder="valor" onchange="_itemDefEfeitoChange(${i},'valor',+this.value)" style="width:60px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.72rem;padding:3px 5px">` : ''}
      ${(ef.tipo==='atributo'||ef.tipo==='debuff')
        ? `<input type="number" value="${ef.duracao_turnos||0}" placeholder="turnos" onchange="_itemDefEfeitoChange(${i},'duracao_turnos',+this.value)" style="width:55px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-size:0.72rem;padding:3px 5px" title="Duração em turnos (0=permanente)">` : ''}
      <button onclick="_itemDefEfeitoRemover(${i})" style="background:none;border:none;color:rgba(192,57,43,0.5);cursor:pointer;font-size:0.9rem;padding:1px 4px">✕</button>
    </div>`).join('');
}

function _itemDefEfeitoChange(idx, key, val) { _itemDefEfeitos[idx][key] = val; }
function _itemDefEfeitoRemover(idx) { _itemDefEfeitos.splice(idx,1); _renderItemDefEfeitos(); }

function itemDefAddBonus() {
  const attrs = RPG_DATA?.attrDefs || [];
  const primeiroAttr = attrs.length ? attrs[0].nome : 'Força';
  _itemDefBonus[primeiroAttr + '_' + Date.now()] = 1;
  _renderItemDefBonus();
}

function _renderItemDefBonus() {
  const entries = Object.entries(_itemDefBonus);
  document.getElementById('idef-bonus-lista').innerHTML = entries.map(([k, v], i) => `
    <div style="display:flex;gap:5px;align-items:center">
      <input type="text" value="${k.replace(/_\d+$/,'')}" placeholder="Nome do atributo" onchange="_itemDefBonusChaveChange(${i},this.value)" style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;padding:5px 7px">
      <input type="number" value="${v}" onchange="_itemDefBonusValChange(${i},+this.value)" style="width:60px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.78rem;padding:5px 7px;text-align:center">
      <button onclick="_itemDefBonusRemover(${i})" style="background:none;border:none;color:rgba(192,57,43,0.5);cursor:pointer;font-size:0.9rem">✕</button>
    </div>`).join('');
}

function _itemDefBonusChaveChange(idx, novaChave) {
  const entries = Object.entries(_itemDefBonus);
  const oldKey = entries[idx][0];
  const val = _itemDefBonus[oldKey];
  delete _itemDefBonus[oldKey];
  _itemDefBonus[novaChave] = val;
}
function _itemDefBonusValChange(idx, val) {
  const key = Object.keys(_itemDefBonus)[idx];
  _itemDefBonus[key] = val;
}
function _itemDefBonusRemover(idx) {
  const key = Object.keys(_itemDefBonus)[idx];
  delete _itemDefBonus[key];
  _renderItemDefBonus();
}

async function salvarItemDef() {
  const nome = document.getElementById('idef-nome').value.trim();
  if (!nome) { mostrarToast('Dê um nome ao item', 'aviso'); return; }
  const tipo = document.getElementById('idef-tipo').value;

  // Coletar efeitos do formulário inteligente (consumíveis)
  if (tipo === 'consumivel') {
    const col = _idefColetarEfeitosSimples();
    _itemDefEfeitos = col.efeitos;
    // Temporariamente escrever alvo/alcance nos campos legados para salvarItemDef lê-los
    const alvEl = document.getElementById('idef-alvo');
    if (alvEl && col.alvo) alvEl.value = col.alvo;
    const alcEl = document.getElementById('idef-alcance');
    if (alcEl && col.alcance_m != null) alcEl.value = col.alcance_m;
    const apEl = document.getElementById('idef-requer-aprov');
    if (apEl) apEl.checked = !!col.requer_aprovacao;
  }

  const bonusClean = {};
  Object.entries(_itemDefBonus).forEach(([k, v]) => {
    const chave = k.replace(/_\d+$/, '');
    if (chave) bonusClean[chave] = v;
  });
  const body = {
    rpg_id: RPG_DATA.rpgId,
    nome,
    tipo,
    descricao: document.getElementById('idef-desc').value.trim() || null,
    icone: document.getElementById('idef-icone').value.trim() || '📦',
    img_url: (document.getElementById('idef-img-url')?.value || '').trim() || null,
    raridade: document.getElementById('idef-raridade').value,
    valor_base: parseFloat(document.getElementById('idef-valor').value) || null,
    efeitos: tipo === 'consumivel' ? _itemDefEfeitos : null,
    alvo: tipo === 'consumivel' ? (document.getElementById('idef-alvo').value || null) : null,
    alcance_m: tipo === 'consumivel' ? (parseFloat(document.getElementById('idef-alcance').value) || null) : null,
    requer_aprovacao: tipo === 'consumivel' ? document.getElementById('idef-requer-aprov').checked : false,
    slot_padrao: tipo === 'equipamento' ? document.getElementById('idef-slot').value : null,
    atributos_bonus: tipo === 'equipamento' && Object.keys(bonusClean).length ? bonusClean : null,
    // BUG FIX #7: derivar tipo_canonico para suporte a amuleto aninhado
    tipo_canonico: tipo === 'equipamento'
      ? (document.getElementById('idef-slot').value || null)
      : tipo,
  };
  const id = document.getElementById('idef-id-edit').value;
  try {
    if (id) {
      await sb(`item_catalog?id=eq.${id}`, { method:'PATCH', body: JSON.stringify(body) });
      const idx = INV.itemDefs.findIndex(d => d.id === +id);
      if (idx >= 0) INV.itemDefs[idx] = { ...INV.itemDefs[idx], ...body, id:+id };
    } else {
      const [row] = await sb('item_catalog', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify(body) });
      if (row) INV.itemDefs.push(row);
    }
    fecharModalItemDef();
    renderTabelasTab();
    mostrarToast(`✦ ${nome} salvo`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar item', 'erro'); }
}

async function deletarItemDef(id) {
  if (!confirm('Excluir este item do catálogo? Isso também remove do inventário de todos.')) return;
  try {
    await sb(`item_catalog?id=eq.${id}`, { method:'DELETE' });
    INV.itemDefs = INV.itemDefs.filter(d => d.id !== id);
    INV.inventario = INV.inventario.filter(i => i.item_catalog_id !== id && i.item_def_id !== id);
    renderTabelasTab();
    mostrarToast('Item excluído', '');
  } catch(e) { mostrarToast('Erro ao excluir', 'erro'); }
}

// ═══════════════════════════════════════════════════════════════
// MODAL: CRIAR/EDITAR TABELA
// ═══════════════════════════════════════════════════════════════

let _tabelaColunasEdit = [];
let _tabelaLinhasEdit  = [];

function abrirModalTabela(id) {
  _tabelaColunasEdit = [];
  _tabelaLinhasEdit  = [];
  document.getElementById('tab-id-edit').value = id || '';

  if (id) {
    const t = INV.tabelas.find(x => x.id === id);
    if (!t) return;
    document.getElementById('modal-tabela-titulo').textContent = '📋 Editar Tabela';
    document.getElementById('tab-nome').value = t.nome || '';
    document.getElementById('tab-desc').value = t.descricao || '';
    document.getElementById('tab-visivel').checked = t.visivel !== false;
    _tabelaColunasEdit = Array.isArray(t.colunas) ? JSON.parse(JSON.stringify(t.colunas)) : [];
    _tabelaLinhasEdit  = Array.isArray(t.linhas)  ? JSON.parse(JSON.stringify(t.linhas))  : [];
    // MELHORIA: garantir que arrays não estão congelados
    if (Object.isFrozen(_tabelaColunasEdit)) _tabelaColunasEdit = [..._tabelaColunasEdit];
    if (Object.isFrozen(_tabelaLinhasEdit))  _tabelaLinhasEdit  = [..._tabelaLinhasEdit];
  } else {
    document.getElementById('modal-tabela-titulo').textContent = '📋 Nova Tabela';
    document.getElementById('tab-nome').value = '';
    document.getElementById('tab-desc').value = '';
    document.getElementById('tab-visivel').checked = true;
  }
  _renderTabelaColunas();
  _renderTabelaLinhas();
  document.getElementById('modal-tabela-overlay').style.display = 'flex';
}

function fecharModalTabela() { document.getElementById('modal-tabela-overlay').style.display = 'none'; }

function tabelaAdicionarColuna() {
  _tabelaColunasEdit.push({ key: 'col' + (_tabelaColunasEdit.length+1), label: 'Coluna ' + (_tabelaColunasEdit.length+1) });
  _renderTabelaColunas();
  _renderTabelaLinhas();
}

function _renderTabelaColunas() {
  document.getElementById('tab-colunas-lista').innerHTML = _tabelaColunasEdit.map((c, i) => `
    <div style="display:flex;gap:5px;align-items:center">
      <input type="text" value="${c.label}" placeholder="Nome da coluna" onchange="_tabelaColunaLabel(${i},this.value)" style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.8rem;padding:5px 7px">
      <button onclick="_tabelaRemoverColuna(${i})" style="background:none;border:none;color:rgba(192,57,43,0.5);cursor:pointer;font-size:0.9rem">✕</button>
    </div>`).join('');
}

function _tabelaColunaLabel(idx, val) {
  _tabelaColunasEdit[idx].label = val;
  _tabelaColunasEdit[idx].key   = val.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') || 'col'+idx;
}
function _tabelaRemoverColuna(idx) { _tabelaColunasEdit.splice(idx,1); _renderTabelaColunas(); _renderTabelaLinhas(); }

function tabelaAdicionarLinha() {
  const linha = {};
  _tabelaColunasEdit.forEach(c => linha[c.key] = '');
  _tabelaLinhasEdit.push(linha);
  _renderTabelaLinhas();
}

function _renderTabelaLinhas() {
  document.getElementById('tab-linhas-lista').innerHTML = _tabelaLinhasEdit.length
    ? _tabelaLinhasEdit.map((l, li) => `
      <div style="display:flex;gap:4px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(30,45,66,0.4)">
        ${_tabelaColunasEdit.map(c => `<input type="text" value="${(l[c.key]||'').replace(/"/g,'&quot;')}" placeholder="${c.label}" onchange="_tabelaLinhaVal(${li},'${c.key}',this.value)" style="flex:1;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:0.75rem;padding:4px 6px;min-width:40px">`).join('')}
        <button onclick="_tabelaRemoverLinha(${li})" style="background:none;border:none;color:rgba(192,57,43,0.4);cursor:pointer;font-size:0.85rem;flex-shrink:0">✕</button>
      </div>`).join('')
    : `<div style="color:var(--suave);font-style:italic;font-size:0.78rem;text-align:center;padding:8px">${_tabelaColunasEdit.length ? 'Adicione linhas com + Linha' : 'Crie colunas primeiro'}</div>`;
}

function _tabelaLinhaVal(li, key, val) { _tabelaLinhasEdit[li][key] = val; }
function _tabelaRemoverLinha(li)       { _tabelaLinhasEdit.splice(li,1); _renderTabelaLinhas(); }

async function salvarTabela() {
  const nome = document.getElementById('tab-nome').value.trim();
  if (!nome) { mostrarToast('Dê um nome à tabela', 'aviso'); return; }
  const body = {
    rpg_id: RPG_DATA.rpgId,
    nome,
    descricao: document.getElementById('tab-desc').value.trim() || null,
    colunas: _tabelaColunasEdit,
    linhas:  _tabelaLinhasEdit,
    visivel: document.getElementById('tab-visivel').checked,
    atualizado_em: new Date().toISOString(),
  };
  const id = document.getElementById('tab-id-edit').value;
  try {
    if (id) {
      await sb(`tabelas?id=eq.${id}`, { method:'PATCH', body: JSON.stringify(body) });
      const idx = INV.tabelas.findIndex(t => t.id === +id);
      if (idx >= 0) INV.tabelas[idx] = { ...INV.tabelas[idx], ...body, id:+id };
    } else {
      const [row] = await sb('tabelas', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify(body) });
      if (row) INV.tabelas.push(row);
    }
    fecharModalTabela();
    renderTabelasTab();
    mostrarToast(`📋 ${nome} salva`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar tabela', 'erro'); }
}

async function deletarTabela(id) {
  if (!confirm('Excluir esta tabela?')) return;
  try {
    await sb(`tabelas?id=eq.${id}`, { method:'DELETE' });
    INV.tabelas = INV.tabelas.filter(t => t.id !== id);
    renderTabelasTab();
    mostrarToast('Tabela excluída', '');
  } catch(e) { mostrarToast('Erro ao excluir tabela', 'erro'); }
}

async function toggleVisibilidadeTabela(id, visivel) {
  try {
    await sb(`tabelas?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ visivel }) });
    const t = INV.tabelas.find(x => x.id === id);
    if (t) t.visivel = visivel;
    renderTabelasTab();
  } catch(e) { mostrarToast('Erro', 'erro'); }
}

// ── Hook abrirAba para carregar dados se necessário ─────────────
(function() {
  const _origAba = window.abrirAba;
  if (!_origAba) return;
  window.abrirAba = function(aba, btn) {
    _origAba(aba, btn);
    if (aba === 'tabelas') {
      const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
      if (!INV.itemDefs.length && rpgId) {
        // Dados ainda não carregados — carrega e então renderiza
        invCarregarDados(rpgId).then(() => {
          renderTabelasTab();
          renderMestreBtnsTabelas();
          renderItensPendentes();
        });
      } else {
        renderTabelasTab();
        renderMestreBtnsTabelas();
        renderItensPendentes();
      }
    }
  };
})();


// ══════════════════════════════════════════════════════════════
// ██████╗ ██████╗ ██╗ █████╗ ██████╗     ██████╗ ██████╗ 
// ██╔════╝██╔══██╗██║██╔══██╗██╔══██╗   ██╔════╝ ╚════██╗
// ██║     ██████╔╝██║███████║██████╔╝   ██║  ███╗ █████╔╝
// ██║     ██╔══██╗██║██╔══██║██╔══██╗   ██║   ██║ ╚═══██╗
// ╚██████╗██║  ██║██║██║  ██║██║  ██║   ╚██████╔╝██████╔╝
//  ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚═════╝ ╚═════╝ 
// SISTEMA DE CRIAÇÃO MANUAL DE CAMPANHA  +  TUTORIAL
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// ESTADO DO WIZARD DE CRIAÇÃO
// ─────────────────────────────────────────────────────────────
let CRIAR_STATE = {
  nivel: null,
  etapaIdx: 0,
  etapas: [],
  dados: {
    nome: '', rpg_id: '', descricao: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'flame',
    attrDefs: [],
    personagens: [],
    habilidades: [],
    lore: [],
  }
};

const CRIAR_NIVEIS = {
  basico:       { etapas: ['nivel','identidade','atributos','personagens','habilidades','mecanicas','revisar'], label:'Básico', cor:'#7ec8f0' },
  intermediario:{ etapas: ['nivel','identidade','atributos','personagens','habilidades','lore','mecanicas','revisar'], label:'Intermediário', cor:'#f0cc6a' },
  detalhado:    { etapas: ['nivel','identidade','atributos','personagens','habilidades','lore','mecanicas','revisar'], label:'Detalhado', cor:'#b07ef0' },
};

const ATTR_PRESETS = [
  { nome:'⚔ D&D Clássico',    attrs:[{n:'Força',c:'basico'},{n:'Destreza',c:'basico'},{n:'Constituição',c:'basico'},{n:'Inteligência',c:'basico'},{n:'Sabedoria',c:'basico'},{n:'Carisma',c:'basico'}] },
  { nome:'🌊 Narrativo',      attrs:[{n:'Corpo',c:'basico'},{n:'Mente',c:'basico'},{n:'Alma',c:'basico'},{n:'Reputação',c:'basico'},{n:'Vínculos',c:'basico'}] },
  { nome:'🔮 Horror',         attrs:[{n:'Força',c:'basico'},{n:'Destreza',c:'basico'},{n:'Constituição',c:'basico'},{n:'Inteligência',c:'basico'},{n:'Sanidade',c:'basico'},{n:'Sorte',c:'basico'}] },
  { nome:'🤖 Cyberpunk',      attrs:[{n:'Corpo',c:'basico'},{n:'Reflexos',c:'basico'},{n:'Tech',c:'basico'},{n:'Cool',c:'basico'},{n:'Empatia',c:'basico'},{n:'Sorte',c:'basico'}] },
];

const ICONES_OPCOES = [
  { key:'flame',   icon:'🔥', label:'Chama'   },
  { key:'rune',    icon:'✦',  label:'Runa'    },
  { key:'crystal', icon:'💎', label:'Cristal' },
  { key:'gear',    icon:'⚙',  label:'Engrenagem' },
  { key:'spirit',  icon:'👁',  label:'Espírito'},
  { key:'sigil',   icon:'⚜',  label:'Brasão'  },
  { key:'skull',   icon:'💀', label:'Caveira' },
  { key:'star',    icon:'⭐', label:'Estrela' },
];

const COR_PRESETS = [
  '#c8a84b','#4fa3d1','#7b2fbe','#e74c3c','#27ae60','#e67e22','#f39c12','#1abc9c',
  '#e91e63','#00bcd4','#8bc34a','#ff5722'
];

// ─────────────────────────────────────────────────────────────
// ABRIR / FECHAR WIZARD
// ─────────────────────────────────────────────────────────────
function abrirCriarCampanha() {
  CRIAR_STATE = {
    nivel: null, etapaIdx: 0, etapas: ['nivel'],
    dados: { nome:'', rpg_id:'', descricao:'', cor:'#c8a84b', cor2:'#4fa3d1', icone:'flame', attrDefs:[], personagens:[], habilidades:[], lore:[] }
  };
  document.getElementById('hub').style.display = 'none';
  document.getElementById('criar-screen').classList.add('visible');
  criarRenderEtapa();
}

function fecharCriarCampanha() {
  document.getElementById('criar-screen').classList.remove('visible');
  document.getElementById('hub').style.display = '';
}

// ─────────────────────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────────────────────
function criarNavegar(dir) {
  if (dir > 0) {
    if (!criarValidarEtapa()) return;
    criarSalvarEtapa();
  }
  const nova = CRIAR_STATE.etapaIdx + dir;
  if (nova < 0 || nova >= CRIAR_STATE.etapas.length) return;
  CRIAR_STATE.etapaIdx = nova;
  criarRenderEtapa();
}

function criarValidarEtapa() {
  const etapa = CRIAR_STATE.etapas[CRIAR_STATE.etapaIdx];
  if (etapa === 'nivel') {
    if (!CRIAR_STATE.nivel) { mostrarToast('Escolha um nível para continuar', 'aviso'); return false; }
  }
  if (etapa === 'identidade') {
    const nome = document.getElementById('criar-nome')?.value?.trim();
    if (!nome) { mostrarToast('O nome da campanha é obrigatório', 'aviso'); return false; }
    CRIAR_STATE.dados.nome = nome;
    CRIAR_STATE.dados.descricao = document.getElementById('criar-desc')?.value?.trim() || '';
    const idEl = document.getElementById('criar-id');
    CRIAR_STATE.dados.rpg_id = idEl?.value?.trim() || gerarRpgId(nome);
  }
  if (etapa === 'personagens') {
    const cards = document.querySelectorAll('[data-char-idx]');
    if (!cards.length) { mostrarToast('Adicione pelo menos 1 personagem', 'aviso'); return false; }
  }
  return true;
}

function criarSalvarEtapa() {
  const etapa = CRIAR_STATE.etapas[CRIAR_STATE.etapaIdx];
  if (etapa === 'identidade') {
    CRIAR_STATE.dados.nome = document.getElementById('criar-nome')?.value?.trim() || '';
    CRIAR_STATE.dados.descricao = document.getElementById('criar-desc')?.value?.trim() || '';
    const idEl = document.getElementById('criar-id');
    CRIAR_STATE.dados.rpg_id = idEl?.value?.trim() || gerarRpgId(CRIAR_STATE.dados.nome);
  }
  if (etapa === 'atributos') criarSalvarAtributos();
  if (etapa === 'personagens') criarSalvarPersonagens();
  if (etapa === 'habilidades') criarSalvarHabilidades();
  if (etapa === 'lore') criarSalvarLore();
  if (etapa === 'mecanicas') criarSalvarMecanicas();
}

function gerarRpgId(nome) {
  return nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,32) + '_' + Date.now().toString(36);
}

// ─────────────────────────────────────────────────────────────
// RENDER ETAPAS
// ─────────────────────────────────────────────────────────────
function criarRenderEtapa() {
  const etapa = CRIAR_STATE.etapas[CRIAR_STATE.etapaIdx];
  const body = document.getElementById('criar-body');
  const total = CRIAR_STATE.etapas.length;
  const atual = CRIAR_STATE.etapaIdx;

  // Dots
  document.getElementById('criar-steps-dots').innerHTML = CRIAR_STATE.etapas.map((e,i) =>
    `<div class="criar-step-dot ${i===atual?'ativo':i<atual?'feito':''}"></div>`
  ).join('');

  // Botões nav
  const btnPrev = document.getElementById('criar-btn-prev');
  const btnNext = document.getElementById('criar-btn-next');
  btnPrev.style.display = atual > 0 ? '' : 'none';
  const isLast = etapa === 'revisar';
  btnNext.textContent  = isLast ? '✦ Criar Campanha!' : 'Próximo →';
  btnNext.onclick = isLast ? criarSubmit : () => criarNavegar(1);

  // Render por etapa
  const fns = {
    nivel: criarRenderNivel,
    identidade: criarRenderIdentidade,
    atributos: criarRenderAtributos,
    personagens: criarRenderPersonagens,
    habilidades: criarRenderHabilidades,
    lore: criarRenderLore,
    mecanicas: criarRenderMecanicas,
    revisar: criarRenderRevisar,
  };
  body.scrollTop = 0;
  (fns[etapa] || (() => body.innerHTML = ''))(body);
}

// ── ETAPA: NÍVEL ──────────────────────────────────────────────
function criarRenderNivel(body) {
  document.getElementById('criar-titulo-header').textContent = 'Nova Campanha';
  body.innerHTML = `
    <div class="etapa-titulo">Escolha o nível de criação</div>
    <div class="etapa-desc">O nível define a complexidade da campanha. Você pode expandir depois adicionando mais elementos.</div>

    <div class="nivel-card nivel-basico${CRIAR_STATE.nivel==='basico'?' selecionado':''}" onclick="criarSelecionarNivel('basico')">
      <div class="nivel-nome">📘 Básico</div>
      <div class="nivel-desc">Rápido e direto. Perfeito para quem está começando ou quer testar uma ideia. Configure o essencial e entre logo em jogo.</div>
      <div class="nivel-tags">
        <span class="nivel-tag">Personagens</span>
        <span class="nivel-tag">Atributos essenciais</span>
        <span class="nivel-tag">Habilidades simples</span>
        <span class="nivel-tag">Sem resistências</span>
      </div>
    </div>

    <div class="nivel-card nivel-inter${CRIAR_STATE.nivel==='intermediario'?' selecionado':''}" onclick="criarSelecionarNivel('intermediario')">
      <div class="nivel-nome">📗 Intermediário</div>
      <div class="nivel-desc">Mais elementos sem sobrecarregar. Adiciona recursos como Mana, lore do mundo e habilidades com custo.</div>
      <div class="nivel-tags">
        <span class="nivel-tag">Tudo do Básico</span>
        <span class="nivel-tag">Status (Mana/Stamina)</span>
        <span class="nivel-tag">Lore do mundo</span>
        <span class="nivel-tag">Habilidades com custo</span>
      </div>
    </div>

    <div class="nivel-card nivel-det${CRIAR_STATE.nivel==='detalhado'?' selecionado':''}" onclick="criarSelecionarNivel('detalhado')">
      <div class="nivel-nome">📕 Detalhado</div>
      <div class="nivel-desc">Controle total sobre todos os sistemas. Para campanhas ricas com mecânicas elaboradas de combate e narrativa.</div>
      <div class="nivel-tags">
        <span class="nivel-tag">Tudo do Intermediário</span>
        <span class="nivel-tag">Resistências e Armadura</span>
        <span class="nivel-tag">Atributos especiais</span>
        <span class="nivel-tag">Fórmulas de dano</span>
      </div>
    </div>
  `;
}

function criarSelecionarNivel(nivel) {
  CRIAR_STATE.nivel = nivel;
  CRIAR_STATE.etapas = [...CRIAR_NIVEIS[nivel].etapas];
  // Inicializar attrDefs com preset básico se ainda vazio
  if (!CRIAR_STATE.dados.attrDefs.length) {
    CRIAR_STATE.dados.attrDefs = ATTR_PRESETS[0].attrs.map((a,i) => ({nome:a.n, categoria:a.c, tipo:'number', ordem:i+1}));
  }
  criarRenderEtapa();
}

// ── ETAPA: IDENTIDADE ─────────────────────────────────────────
function criarRenderIdentidade(body) {
  document.getElementById('criar-titulo-header').textContent = 'Identidade';
  const d = CRIAR_STATE.dados;
  body.innerHTML = `
    <div class="etapa-titulo">Identidade da Campanha</div>
    <div class="etapa-desc">Nome, visual e personalidade da sua campanha.</div>

    <div class="criar-field">
      <label>Nome da campanha *</label>
      <input type="text" class="criar-input" id="criar-nome" value="${d.nome}" placeholder="Ex: A Queda de Valdrimor" oninput="criarAutoId(this.value)" maxlength="60">
    </div>

    <div class="criar-field">
      <label>ID único (gerado automaticamente)</label>
      <input type="text" class="criar-input" id="criar-id" value="${d.rpg_id}" placeholder="Será gerado ao digitar o nome" style="font-family:monospace;font-size:0.82rem" oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,40)">
      <div style="font-size:0.62rem;color:rgba(122,146,170,0.6);margin-top:3px">Apenas letras minúsculas, números e _. Não pode ser alterado depois.</div>
    </div>

    <div class="criar-field">
      <label>Descrição breve (opcional)</label>
      <textarea class="criar-input" id="criar-desc" rows="2" placeholder="Uma frase que descreve o tom ou tema..." style="resize:none">${d.descricao}</textarea>
    </div>

    <div class="criar-field">
      <label>Cor de destaque</label>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <input type="color" id="criar-cor" value="${d.cor}" onchange="criarSetCor(this.value)" style="width:44px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;cursor:pointer;padding:2px">
        <span style="font-size:0.8rem;color:#7a92aa">Cor principal do tema</span>
      </div>
      <div class="cor-presets" id="cor-presets">
        ${COR_PRESETS.map(c => `<div class="cor-preset${d.cor===c?' ativo':''}" style="background:${c}" onclick="criarSetCor('${c}')" title="${c}"></div>`).join('')}
      </div>
    </div>

    <div class="criar-field">
      <label>Ícone da campanha</label>
      <div class="icone-grid">
        ${ICONES_OPCOES.map(o => `<div class="icone-btn${d.icone===o.key?' ativo':''}" onclick="criarSetIcone('${o.key}',this)">
          <span>${o.icon}</span><small>${o.label}</small>
        </div>`).join('')}
      </div>
    </div>
  `;
}

function criarAutoId(nome) {
  const el = document.getElementById('criar-id');
  if (el) el.value = nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,32);
}

function criarSetCor(cor) {
  CRIAR_STATE.dados.cor = cor;
  document.getElementById('criar-cor').value = cor;
  document.querySelectorAll('.cor-preset').forEach(el => {
    el.classList.toggle('ativo', el.style.background === cor || el.title === cor);
  });
}

function criarSetIcone(key, el) {
  CRIAR_STATE.dados.icone = key;
  document.querySelectorAll('.icone-btn').forEach(b => b.classList.remove('ativo'));
  el.classList.add('ativo');
}

// ── ETAPA: ATRIBUTOS ──────────────────────────────────────────
function criarRenderAtributos(body) {
  document.getElementById('criar-titulo-header').textContent = 'Atributos';
  const nivel = CRIAR_STATE.nivel;
  const d = CRIAR_STATE.dados;

  const mostrarStatus = nivel === 'intermediario' || nivel === 'detalhado';
  const mostrarEspecial = nivel === 'detalhado';
  const mostrarResistencia = nivel === 'detalhado';

  body.innerHTML = `
    <div class="etapa-titulo">Atributos da campanha</div>
    <div class="etapa-desc">Defina quais atributos os personagens possuem. Use um preset ou customize à vontade.</div>

    <div style="margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:0.6rem;color:#7a92aa;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">Presets rápidos</div>
      ${ATTR_PRESETS.map((p,i) => `<button class="attr-preset-btn" onclick="criarAplicarPreset(${i})">${p.nome}</button>`).join('')}
    </div>

    <div style="font-family:'Cinzel',serif;font-size:0.6rem;color:#c8a84b;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">🔷 Atributos Básicos <span style="color:#7a92aa;font-weight:400">(todos os personagens)</span></div>
    <div id="criar-attrs-basico" style="margin-bottom:16px">${_renderAttrsList('basico')}</div>
    <button class="add-item-btn" onclick="criarAddAttr('basico')">＋ Atributo Básico</button>

    ${mostrarStatus ? `
    <div style="margin-top:20px;font-family:'Cinzel',serif;font-size:0.6rem;color:#4fa3d1;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">📊 Status <span style="color:#7a92aa;font-weight:400">(recursos: Mana, Stamina, Ki…)</span></div>
    <div id="criar-attrs-status" style="margin-bottom:10px">${_renderAttrsList('status')}</div>
    <button class="add-item-btn" onclick="criarAddAttr('status')" style="border-color:rgba(79,163,209,0.25);color:#4fa3d1">＋ Atributo de Status</button>
    ` : ''}

    ${mostrarEspecial ? `
    <div style="margin-top:20px;font-family:'Cinzel',serif;font-size:0.6rem;color:#b07ef0;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">✨ Especial <span style="color:#7a92aa;font-weight:400">(só protagonistas: Sanidade, Karma…)</span></div>
    <div id="criar-attrs-especial" style="margin-bottom:10px">${_renderAttrsList('especial')}</div>
    <button class="add-item-btn" onclick="criarAddAttr('especial')" style="border-color:rgba(176,126,240,0.25);color:#b07ef0">＋ Atributo Especial</button>
    ` : ''}

    ${mostrarResistencia ? `
    <div style="margin-top:20px;font-family:'Cinzel',serif;font-size:0.6rem;color:#e8a020;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.08em">🛡 Resistências <span style="color:#7a92aa;font-weight:400">(Armadura, Resistência a fogo…)</span></div>
    <div id="criar-attrs-resistencia" style="margin-bottom:10px">${_renderAttrsList('resistencia')}</div>
    <button class="add-item-btn" onclick="criarAddResistencia()" style="border-color:rgba(232,160,32,0.25);color:#e8a020">＋ Sistema de Resistência</button>
    ` : ''}

    <div style="margin-top:20px;padding:12px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.12);border-radius:8px;font-size:0.78rem;color:#7a92aa;line-height:1.5">
      💡 Você pode ajustar os atributos depois, nas Configurações da campanha.
    </div>
  `;
}

function _renderAttrsList(cat) {
  const attrs = CRIAR_STATE.dados.attrDefs.filter(a => a.categoria === cat);
  if (!attrs.length) return `<div style="color:rgba(122,146,170,0.5);font-size:0.78rem;font-style:italic;padding:6px 0">Nenhum atributo nesta categoria.</div>`;
  return attrs.map((a, gi) => {
    const idx = CRIAR_STATE.dados.attrDefs.indexOf(a);
    return `<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px">
      <input type="text" value="${a.nome}" placeholder="Nome do atributo" onchange="CRIAR_STATE.dados.attrDefs[${idx}].nome=this.value" style="flex:1;background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:6px;padding:7px 10px;color:#c8d8e8;font-size:0.88rem">
      <button onclick="criarRemoverAttr(${idx})" style="background:none;border:none;color:rgba(192,57,43,0.45);cursor:pointer;font-size:1rem;padding:3px 6px">✕</button>
    </div>`;
  }).join('');
}

function criarAplicarPreset(idx) {
  const preset = ATTR_PRESETS[idx];
  // Remove atributos básicos anteriores
  CRIAR_STATE.dados.attrDefs = CRIAR_STATE.dados.attrDefs.filter(a => a.categoria !== 'basico');
  const novos = preset.attrs.map((a, i) => ({ nome: a.n, categoria: a.c, tipo: 'number', ordem: i + 1 }));
  CRIAR_STATE.dados.attrDefs = [...novos, ...CRIAR_STATE.dados.attrDefs];
  criarRenderAtributos(document.getElementById('criar-body'));
  mostrarToast(`Preset "${preset.nome}" aplicado`, 'sucesso');
}

function criarAddAttr(cat) {
  const maxOrdem = CRIAR_STATE.dados.attrDefs.filter(a=>a.categoria===cat).length;
  CRIAR_STATE.dados.attrDefs.push({ nome: '', categoria: cat, tipo: 'number', ordem: maxOrdem + 1 });
  criarRenderAtributos(document.getElementById('criar-body'));
  // Focar último input adicionado
  setTimeout(() => {
    const inputs = document.querySelectorAll(`#criar-attrs-${cat} input`);
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 50);
}

function criarAddResistencia() {
  CRIAR_STATE.dados.attrDefs.push({ nome: 'Armadura', categoria: 'resistencia', tipo: 'number', ordem: 1, opcoes: '{"tipo":"armadura","pct_geral":10,"pct_fisico":50}' });
  criarRenderAtributos(document.getElementById('criar-body'));
  mostrarToast('Armadura básica adicionada. Você pode editar depois nas configurações.', '');
}

function criarRemoverAttr(idx) {
  CRIAR_STATE.dados.attrDefs.splice(idx, 1);
  criarRenderAtributos(document.getElementById('criar-body'));
}

function criarSalvarAtributos() {
  // Atributos já salvos via onchange em tempo real, nada a fazer
  // Remover entradas sem nome
  CRIAR_STATE.dados.attrDefs = CRIAR_STATE.dados.attrDefs.filter(a => a.nome.trim());
}

// ── ETAPA: PERSONAGENS ────────────────────────────────────────
function criarRenderPersonagens(body) {
  document.getElementById('criar-titulo-header').textContent = 'Personagens';
  const d = CRIAR_STATE.dados;
  const attrs = d.attrDefs.filter(a => a.categoria === 'basico' || a.categoria === 'status');

  body.innerHTML = `
    <div class="etapa-titulo">Personagens</div>
    <div class="etapa-desc">Adicione os personagens jogadores e NPCs importantes. Você pode incluir mais personagens depois.</div>
    <div id="criar-chars-lista">
      ${d.personagens.map((p,i) => _renderCharCard(p, i, attrs)).join('')}
    </div>
    <button class="add-item-btn" onclick="criarAddPersonagem()">＋ Adicionar Personagem</button>
    ${!d.personagens.length ? `<div style="text-align:center;padding:20px;color:#7a92aa;font-size:0.82rem;font-style:italic">Nenhum personagem ainda.<br>Clique em + para adicionar.</div>` : ''}
  `;
}

function _renderCharCard(p, i, attrs) {
  const cor = p.cor || '#4fa3d1';
  const atribsCampos = (attrs || []).map(a => `
    <div class="criar-attr-item">
      <label>${a.nome}</label>
      <input type="number" value="${(p.atributos||{})[a.nome]||''}" placeholder="0" onchange="CRIAR_STATE.dados.personagens[${i}].atributos=CRIAR_STATE.dados.personagens[${i}].atributos||{};CRIAR_STATE.dados.personagens[${i}].atributos['${a.nome}']=+this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.9rem;text-align:center;width:100%">
    </div>`).join('');

  return `<div class="criar-char-card" data-char-idx="${i}">
    <div class="criar-char-header">
      <div class="criar-char-color-dot" style="background:${cor}"></div>
      <div class="criar-char-nome-label">${p.nome || 'Novo personagem'}</div>
      <button class="criar-char-remove" onclick="criarRemoverPersonagem(${i})">✕</button>
    </div>
    <div class="criar-attr-grid" style="margin-bottom:10px">
      <div class="criar-attr-item">
        <label>Nome *</label>
        <input type="text" value="${p.nome}" placeholder="Nome do personagem" onchange="CRIAR_STATE.dados.personagens[${i}].nome=this.value;this.closest('.criar-char-card').querySelector('.criar-char-nome-label').textContent=this.value||'Novo personagem'" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.88rem;width:100%">
      </div>
      <div class="criar-attr-item">
        <label>Tipo</label>
        <select onchange="CRIAR_STATE.dados.personagens[${i}].tipo=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.85rem;width:100%">
          <option value="jogador" ${p.tipo==='jogador'?'selected':''}>Jogador</option>
          <option value="npc" ${p.tipo==='npc'?'selected':''}>NPC</option>
          <option value="criatura" ${p.tipo==='criatura'?'selected':''}>Criatura</option>
        </select>
      </div>
      <div class="criar-attr-item">
        <label>HP máximo</label>
        <input type="number" value="${p.hp_max||100}" min="1" onchange="CRIAR_STATE.dados.personagens[${i}].hp_max=+this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#e74c3c;font-size:0.9rem;text-align:center;width:100%">
      </div>
      <div class="criar-attr-item">
        <label>Cor</label>
        <input type="color" value="${cor}" onchange="CRIAR_STATE.dados.personagens[${i}].cor=this.value;this.closest('.criar-char-card').querySelector('.criar-char-color-dot').style.background=this.value" style="width:100%;height:34px;border-radius:5px;border:1px solid rgba(30,45,66,0.8);background:transparent;cursor:pointer;padding:2px">
      </div>
    </div>
    ${attrs.length ? `<div style="font-family:'Cinzel',serif;font-size:0.55rem;color:#7a92aa;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.06em">Atributos</div>
    <div class="criar-attr-grid">${atribsCampos}</div>` : ''}
  </div>`;
}

function criarAddPersonagem() {
  CRIAR_STATE.dados.personagens.push({ nome:'', tipo:'jogador', cor:'#4fa3d1', hp_max:100, atributos:{} });
  criarRenderPersonagens(document.getElementById('criar-body'));
  setTimeout(() => {
    const cards = document.querySelectorAll('[data-char-idx]');
    if (cards.length) { cards[cards.length-1].scrollIntoView({behavior:'smooth',block:'start'}); }
    const inputs = document.querySelectorAll('[data-char-idx] input[type=text]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 80);
}

function criarRemoverPersonagem(i) {
  CRIAR_STATE.dados.personagens.splice(i, 1);
  criarRenderPersonagens(document.getElementById('criar-body'));
}

function criarSalvarPersonagens() {
  // Dados já atualizados via onchange
}

// ── ETAPA: HABILIDADES ────────────────────────────────────────
function criarRenderHabilidades(body) {
  document.getElementById('criar-titulo-header').textContent = 'Habilidades';
  const nivel = CRIAR_STATE.nivel;
  const d = CRIAR_STATE.dados;
  const chars = d.personagens.filter(p => p.nome);
  const mostrarAvancado = nivel === 'intermediario' || nivel === 'detalhado';
  const mostrarFormula = nivel === 'detalhado';

  body.innerHTML = `
    <div class="etapa-titulo">Habilidades</div>
    <div class="etapa-desc">Adicione habilidades e poderes dos personagens. Você pode adicionar mais depois dentro da campanha.</div>
    ${!chars.length ? `<div style="padding:16px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:8px;font-size:0.82rem;color:#c8a84b;margin-bottom:12px">⚠ Adicione personagens na etapa anterior para poder vincular habilidades.</div>` : ''}
    <div id="criar-skills-lista">
      ${d.habilidades.map((h,i) => _renderSkillCard(h, i, chars, mostrarAvancado, mostrarFormula)).join('')}
    </div>
    <button class="add-item-btn" onclick="criarAddHabilidade()">＋ Adicionar Habilidade</button>
    <div style="margin-top:16px;padding:12px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.1);border-radius:8px;font-size:0.78rem;color:#7a92aa;line-height:1.5">
      💡 Esta etapa é opcional. Você pode criar habilidades depois na aba Habilidades da campanha.
    </div>
  `;
}

function _renderSkillCard(h, i, chars, mostrarAvancado, mostrarFormula) {
  return `<div class="criar-skill-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:#7ec8f0">${h.habilidade||'Nova habilidade'}</div>
      <button onclick="criarRemoverHabilidade(${i})" style="background:none;border:none;color:rgba(192,57,43,0.45);cursor:pointer;font-size:0.9rem">✕</button>
    </div>
    <div class="criar-attr-grid" style="margin-bottom:8px">
      <div class="criar-attr-item">
        <label>Nome da habilidade *</label>
        <input type="text" value="${h.habilidade}" placeholder="Ex: Bola de Fogo" onchange="CRIAR_STATE.dados.habilidades[${i}].habilidade=this.value;this.closest('.criar-skill-card').querySelector('[style*=Cinzel]').textContent=this.value||'Nova habilidade'" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.85rem;width:100%">
      </div>
      <div class="criar-attr-item">
        <label>Personagem</label>
        <select onchange="CRIAR_STATE.dados.habilidades[${i}].personagem=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.82rem;width:100%">
          <option value="">Todos</option>
          ${chars.map(c=>`<option value="${c.nome}" ${h.personagem===c.nome?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="criar-attr-item" style="margin-bottom:8px">
      <label>Efeito / Descrição</label>
      <textarea onchange="CRIAR_STATE.dados.habilidades[${i}].efeito=this.value" rows="2" placeholder="O que a habilidade faz…" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.82rem;width:100%;resize:none">${h.efeito}</textarea>
    </div>
    ${mostrarAvancado ? `
    <div class="criar-attr-grid">
      <div class="criar-attr-item">
        <label>Custo (Mana/Stamina…)</label>
        <input type="number" value="${h.custo_rsv||''}" min="0" placeholder="0" onchange="CRIAR_STATE.dados.habilidades[${i}].custo_rsv=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#4fa3d1;font-size:0.88rem;text-align:center;width:100%">
      </div>
      <div class="criar-attr-item">
        <label>Cooldown (turnos)</label>
        <input type="number" value="${h.cooldown_turnos||0}" min="0" onchange="CRIAR_STATE.dados.habilidades[${i}].cooldown_turnos=+this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.88rem;text-align:center;width:100%">
      </div>
    </div>` : ''}
    ${mostrarFormula ? `
    <div class="criar-attr-grid" style="margin-top:8px">
      <div class="criar-attr-item">
        <label>Fórmula de dano</label>
        <input type="text" value="${h.formula_dano||''}" placeholder="Ex: 2d6" onchange="CRIAR_STATE.dados.habilidades[${i}].formula_dano=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#e74c3c;font-size:0.85rem;width:100%;font-family:monospace">
      </div>
      <div class="criar-attr-item">
        <label>Tipo de dano</label>
        <select onchange="CRIAR_STATE.dados.habilidades[${i}].tipo_dano=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.82rem;width:100%">
          <option value="fisico" ${h.tipo_dano==='fisico'?'selected':''}>Físico</option>
          <option value="magico" ${h.tipo_dano==='magico'?'selected':''}>Mágico</option>
          <option value="fogo" ${h.tipo_dano==='fogo'?'selected':''}>Fogo</option>
          <option value="gelo" ${h.tipo_dano==='gelo'?'selected':''}>Gelo</option>
          <option value="veneno" ${h.tipo_dano==='veneno'?'selected':''}>Veneno</option>
          <option value="psiquico" ${h.tipo_dano==='psiquico'?'selected':''}>Psíquico</option>
        </select>
      </div>
    </div>` : ''}
  </div>`;
}

function criarAddHabilidade() {
  const chars = CRIAR_STATE.dados.personagens.filter(p => p.nome);
  CRIAR_STATE.dados.habilidades.push({ habilidade:'', personagem: chars[0]?.nome||'', efeito:'', custo_rsv:'', cooldown_turnos:0, formula_dano:'', tipo_dano:'fisico' });
  criarRenderHabilidades(document.getElementById('criar-body'));
  setTimeout(() => {
    const cards = document.querySelectorAll('.criar-skill-card');
    if (cards.length) cards[cards.length-1].scrollIntoView({behavior:'smooth'});
  }, 60);
}

function criarRemoverHabilidade(i) {
  CRIAR_STATE.dados.habilidades.splice(i, 1);
  criarRenderHabilidades(document.getElementById('criar-body'));
}

function criarSalvarHabilidades() { /* atualizado via onchange */ }

// ── ETAPA: LORE ───────────────────────────────────────────────
function criarRenderLore(body) {
  document.getElementById('criar-titulo-header').textContent = 'Lore';
  const d = CRIAR_STATE.dados;
  const loreCategs = ['mundo','magia','sociedade','história','facções','regras'];
  body.innerHTML = `
    <div class="etapa-titulo">Lore do Mundo</div>
    <div class="etapa-desc">Registre informações sobre o mundo da campanha: lugares, facções, história, magia. Isso fica disponível para todos os jogadores.</div>
    <div id="criar-lore-lista">
      ${d.lore.map((l,i) => _renderLoreCard(l, i, loreCategs)).join('')}
    </div>
    <button class="add-item-btn" onclick="criarAddLore()">＋ Adicionar entrada de Lore</button>
    <div style="margin-top:16px;padding:12px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.1);border-radius:8px;font-size:0.78rem;color:#7a92aa;line-height:1.5">
      💡 Esta etapa também é opcional. Você pode adicionar lore durante a campanha na aba Lore.
    </div>
  `;
}

function _renderLoreCard(l, i, categs) {
  return `<div class="criar-lore-card">
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input type="text" value="${l.titulo}" placeholder="Título" onchange="CRIAR_STATE.dados.lore[${i}].titulo=this.value" style="flex:1;background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#f0cc6a;font-size:0.88rem">
      <select onchange="CRIAR_STATE.dados.lore[${i}].secao=this.value" style="background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:6px 8px;color:#c8d8e8;font-size:0.8rem">
        ${categs.map(c=>`<option value="${c}" ${l.secao===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
      </select>
      <button onclick="criarRemoverLore(${i})" style="background:none;border:none;color:rgba(192,57,43,0.45);cursor:pointer;font-size:1rem">✕</button>
    </div>
    <textarea rows="3" placeholder="Texto sobre este tópico…" onchange="CRIAR_STATE.dados.lore[${i}].conteudo=this.value" style="width:100%;background:rgba(10,15,25,0.8);border:1px solid rgba(30,45,66,0.8);border-radius:5px;padding:7px 9px;color:#c8d8e8;font-size:0.82rem;resize:none">${l.conteudo}</textarea>
  </div>`;
}

function criarAddLore() {
  CRIAR_STATE.dados.lore.push({ titulo:'', secao:'mundo', conteudo:'' });
  criarRenderLore(document.getElementById('criar-body'));
  setTimeout(() => {
    const cards = document.querySelectorAll('.criar-lore-card');
    if (cards.length) cards[cards.length-1].scrollIntoView({behavior:'smooth'});
  }, 60);
}

function criarRemoverLore(i) {
  CRIAR_STATE.dados.lore.splice(i, 1);
  criarRenderLore(document.getElementById('criar-body'));
}

function criarSalvarLore() { /* atualizado via onchange */ }


// ── ETAPA: MECÂNICAS ──────────────────────────────────────────
function criarRenderMecanicas(body) {
  document.getElementById('criar-titulo-header').textContent = 'Mecânicas';
  const d = CRIAR_STATE.dados;
  const m = d.mecanicas || {};
  const attrDefs = d.attrDefs || [];
  const attrNumericos = attrDefs.filter(a => a.tipo === 'number' || !a.tipo);

  body.innerHTML = `
    <div class="etapa-titulo">Mecânicas de Jogo</div>
    <div class="etapa-desc">Configure como funciona o sistema de combate, progressão e movimentação desta campanha.</div>

    <div style="background:rgba(94,224,154,0.06);border:1px solid rgba(94,224,154,0.2);border-radius:10px;padding:12px 14px;margin-bottom:18px;font-size:0.75rem;color:rgba(200,210,220,0.8);line-height:1.5">
      💡 Todos os campos têm valores padrão funcionais. Preencha apenas o que quiser personalizar.
    </div>

    <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">⚔ Combate e Movimento</div>

    <div class="criar-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="criar-field" style="margin:0">
        <label>Velocidade base <span style="color:var(--suave);font-size:0.7em">(células/turno)</span></label>
        <input type="number" class="criar-input" id="mec-vel-base" min="1" max="20" value="${m.velocidade_base ?? 4}" placeholder="4">
        <div style="font-size:0.6rem;color:var(--suave);margin-top:2px">Movimento padrão sem bônus</div>
      </div>
      <div class="criar-field" style="margin:0">
        <label>Fator de velocidade <span style="color:var(--suave);font-size:0.7em">(÷ Destreza)</span></label>
        <input type="number" class="criar-input" id="mec-vel-fator" min="1" max="20" value="${m.velocidade_fator ?? 4}" placeholder="4">
        <div style="font-size:0.6rem;color:var(--suave);margin-top:2px">vel. final = base + floor(Dex ÷ fator)</div>
      </div>
    </div>

    <div class="criar-field" style="margin-bottom:16px">
      <label>Modo de turno</label>
      <div style="display:flex;gap:8px;margin-top:6px">
        <div class="nivel-card${!m.turno_modo_exclusivo ? ' selecionado' : ''}" onclick="criarSetModoTurno(false)"
          style="flex:1;padding:10px 12px;cursor:pointer;border-radius:9px;border:1px solid var(--borda)">
          <div style="font-family:var(--fonte-d);font-size:0.72rem;color:var(--texto);margin-bottom:3px">⚡ Livre</div>
          <div style="font-size:0.65rem;color:var(--suave)">Pode mover E atacar no mesmo turno <span style="color:#5ee09a">(padrão)</span></div>
        </div>
        <div class="nivel-card${m.turno_modo_exclusivo ? ' selecionado' : ''}" onclick="criarSetModoTurno(true)"
          style="flex:1;padding:10px 12px;cursor:pointer;border-radius:9px;border:1px solid var(--borda)">
          <div style="font-family:var(--fonte-d);font-size:0.72rem;color:var(--texto);margin-bottom:3px">🎯 Exclusivo</div>
          <div style="font-size:0.65rem;color:var(--suave)">Mover OU atacar — não ambos (D&D clássico)</div>
        </div>
      </div>
    </div>

    <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">❤ HP e Progressão</div>

    <div class="criar-field-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="criar-field" style="margin:0">
        <label>HP inicial</label>
        <input type="number" class="criar-input" id="mec-hp-base" min="1" max="9999" value="${m.hp_base ?? 100}" placeholder="100">
      </div>
      <div class="criar-field" style="margin:0">
        <label>+HP por nível</label>
        <input type="number" class="criar-input" id="mec-hp-nivel" min="0" max="999" value="${m.hp_por_nivel ?? ''}" placeholder="0">
      </div>
      <div class="criar-field" style="margin:0">
        <label>Nível máximo</label>
        <input type="number" class="criar-input" id="mec-nivel-max" min="1" max="100" value="${m.nivel_maximo ?? ''}" placeholder="20">
      </div>
    </div>

    ${attrNumericos.length ? `
    <div class="criar-field" style="margin-bottom:12px">
      <label>Atributo que contribui com HP <span style="color:var(--suave);font-size:0.7em">(opcional)</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
        <select class="criar-input" id="mec-hp-attr" style="font-size:0.8rem">
          <option value="">— nenhum —</option>
          ${attrNumericos.map(a => `<option value="${a.nome}" ${m.hp_attr===a.nome?'selected':''}>${a.nome}</option>`).join('')}
        </select>
        <div>
          <input type="number" class="criar-input" id="mec-hp-mult" min="0" max="20" step="0.5" value="${m.hp_attr_mult ?? ''}" placeholder="Multiplicador (ex: 3)">
          <div style="font-size:0.6rem;color:var(--suave);margin-top:2px">HP = base + Atributo × mult</div>
        </div>
      </div>
    </div>` : ''}

    <div class="criar-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="criar-field" style="margin:0">
        <label>Pontos de atributo por nível</label>
        <input type="number" class="criar-input" id="mec-pts-attr" min="0" max="20" value="${m.pontos_attr_por_nivel ?? ''}" placeholder="0">
        <div style="font-size:0.6rem;color:var(--suave);margin-top:2px">Distribuição livre ao subir nível</div>
      </div>
    </div>
  `;

  // Marcar botão do modo turno selecionado
  window.criarSetModoTurno = function(exclusivo) {
    if (!CRIAR_STATE.dados.mecanicas) CRIAR_STATE.dados.mecanicas = {};
    CRIAR_STATE.dados.mecanicas.turno_modo_exclusivo = exclusivo;
    document.querySelectorAll('#criar-body .nivel-card').forEach((c, i) => {
      c.classList.toggle('selecionado', (i === 0 && !exclusivo) || (i === 1 && exclusivo));
    });
  };
}

function criarSalvarMecanicas() {
  if (!CRIAR_STATE.dados.mecanicas) CRIAR_STATE.dados.mecanicas = {};
  const m = CRIAR_STATE.dados.mecanicas;
  const _n = (id, def) => { const v = parseInt(document.getElementById(id)?.value); return isNaN(v) ? def : v; };
  const _f = (id, def) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? def : v; };
  m.velocidade_base       = _n('mec-vel-base', 4);
  m.velocidade_fator      = _n('mec-vel-fator', 4);
  m.hp_base               = _n('mec-hp-base', 100);
  m.hp_por_nivel          = _n('mec-hp-nivel', 0);
  m.nivel_maximo          = _n('mec-nivel-max', 20);
  m.pontos_attr_por_nivel = _n('mec-pts-attr', 0);
  const attrEl = document.getElementById('mec-hp-attr');
  m.hp_attr     = attrEl?.value || '';
  m.hp_attr_mult = _f('mec-hp-mult', 0);
  // turno_modo_exclusivo já salvo pelo onclick
}

// ── ETAPA: REVISAR ────────────────────────────────────────────
function criarRenderRevisar(body) {
  document.getElementById('criar-titulo-header').textContent = 'Revisar';
  const d = CRIAR_STATE.dados;
  const nivel = CRIAR_STATE.nivel;
  const nivelLabel = { basico:'📘 Básico', intermediario:'📗 Intermediário', detalhado:'📕 Detalhado' }[nivel];
  const cor = d.cor || '#c8a84b';

  body.innerHTML = `
    <div class="etapa-titulo">Tudo pronto!</div>
    <div class="etapa-desc">Confira as informações antes de criar sua campanha.</div>

    <div class="revisar-section">
      <div class="revisar-title">Campanha</div>
      <div class="revisar-item"><span class="revisar-item-icon">✦</span><strong style="color:${cor}">${d.nome||'Sem nome'}</strong></div>
      <div class="revisar-item"><span class="revisar-item-icon">🎯</span>Nível: ${nivelLabel}</div>
      ${d.descricao ? `<div class="revisar-item"><span class="revisar-item-icon">📝</span>${d.descricao}</div>` : ''}
      <div class="revisar-item"><span class="revisar-item-icon">🆔</span><span style="font-family:monospace;font-size:0.8rem">${d.rpg_id||gerarRpgId(d.nome)}</span></div>
    </div>

    <div class="revisar-section">
      <div class="revisar-title">Atributos (${d.attrDefs.filter(a=>a.nome).length})</div>
      ${d.attrDefs.filter(a=>a.nome).slice(0,8).map(a=>`<div class="revisar-item"><span class="revisar-item-icon" style="font-size:0.75rem">${a.categoria==='status'?'📊':a.categoria==='resistencia'?'🛡':a.categoria==='especial'?'✨':'🔷'}</span>${a.nome}</div>`).join('')}
      ${d.attrDefs.filter(a=>a.nome).length > 8 ? `<div style="font-size:0.72rem;color:#7a92aa;padding:4px 0">…e mais ${d.attrDefs.length-8}</div>` : ''}
    </div>

    <div class="revisar-section">
      <div class="revisar-title">Personagens (${d.personagens.filter(p=>p.nome).length})</div>
      ${d.personagens.filter(p=>p.nome).map(p=>`<div class="revisar-item"><span class="revisar-item-icon">⚔</span><span style="color:${p.cor||'#4fa3d1'}">${p.nome}</span> <span style="color:#7a92aa;font-size:0.78rem">${p.tipo}</span></div>`).join('') || '<div class="revisar-item"><span class="revisar-item-icon" style="color:#e74c3c">!</span><span style="color:#e74c3c">Nenhum personagem</span></div>'}
    </div>

    ${d.habilidades.filter(h=>h.habilidade).length ? `
    <div class="revisar-section">
      <div class="revisar-title">Habilidades (${d.habilidades.filter(h=>h.habilidade).length})</div>
      ${d.habilidades.filter(h=>h.habilidade).slice(0,6).map(h=>`<div class="revisar-item"><span class="revisar-item-icon">✧</span>${h.habilidade} ${h.personagem?`<span style="color:#7a92aa;font-size:0.78rem">(${h.personagem})</span>`:''}</div>`).join('')}
    </div>` : ''}

    ${d.lore.filter(l=>l.titulo).length ? `
    <div class="revisar-section">
      <div class="revisar-title">Lore (${d.lore.filter(l=>l.titulo).length} entradas)</div>
      ${d.lore.filter(l=>l.titulo).slice(0,4).map(l=>`<div class="revisar-item"><span class="revisar-item-icon">📖</span>${l.titulo}</div>`).join('')}
    </div>` : ''}

    <div style="margin-top:8px;padding:14px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:10px;font-size:0.82rem;color:#c8d8e8;line-height:1.6">
      🔮 O tutorial de navegação estará <strong>ativado</strong> por padrão. Você pode desligá-lo nas Configurações da campanha a qualquer momento.
    </div>
    <div id="criar-status-final" class="import-status" style="margin-top:12px"></div>
  `;
}

// ── SUBMIT: CRIAR CAMPANHA ────────────────────────────────────
async function criarSubmit() {
  const d = CRIAR_STATE.dados;
  if (!d.nome.trim()) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  if (!d.personagens.filter(p=>p.nome).length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }

  const btn = document.getElementById('criar-btn-next');
  btn.disabled = true; btn.textContent = '⏳ Criando…';

  const st = document.getElementById('criar-status-final');
  if (st) { st.style.display='block'; st.className='import-status ok'; st.textContent='Criando campanha…'; }

  try {
    const rpgId = d.rpg_id || gerarRpgId(d.nome);
    const nivel = CRIAR_STATE.nivel;

    // Construir payload tipo importRPG
    const payload = {
      config: [{
        rpg_id: rpgId,
        name: d.nome,
        description: d.descricao,
        theme_destaque: d.cor,
        theme_primario: d.cor2,
        animation: d.icone,
        creation_level: nivel,
        // Mecânicas de movimento e progressão
        nivel_maximo:          d.mecanicas?.nivel_maximo ?? '',
        hp_base:               d.mecanicas?.hp_base ?? '',
        hp_por_nivel:          d.mecanicas?.hp_por_nivel ?? '',
        hp_attr:               d.mecanicas?.hp_attr ?? '',
        velocidade_base:       d.mecanicas?.velocidade_base ?? '',
        velocidade_fator:      d.mecanicas?.velocidade_fator ?? '',
        turno_modo_exclusivo:  d.mecanicas?.turno_modo_exclusivo ? 'true' : '',
        pontos_attr_por_nivel: d.mecanicas?.pontos_attr_por_nivel ?? '',
      }],
      characters: d.personagens.filter(p => p.nome).map((p,i) => ({
        nome: p.nome,
        tipo: p.tipo || 'jogador',
        cor: p.cor || '#4fa3d1',
        hp_max: p.hp_max || 100,
        atributos_json: JSON.stringify(p.atributos || {}),
        nivel: 1, xp: 0,
      })),
      skills: d.habilidades.filter(h => h.habilidade).map(h => ({
        personagem: h.personagem || '',
        habilidade: h.habilidade,
        efeito: h.efeito || '',
        formula_dano: h.formula_dano || null,
        custo_rsv: h.custo_rsv || null,
        cooldown_turnos: h.cooldown_turnos || 0,
        tipo_dano: h.tipo_dano || 'fisico',
        alvo_tipo: 'inimigo',
      })),
      lore: d.lore.filter(l => l.titulo).map(l => ({
        secao: l.secao || 'mundo',
        titulo: l.titulo,
        conteudo: l.conteudo || '',
      })),
      attr_defs: d.attrDefs.filter(a => a.nome).map((a,i) => ({
        nome: a.nome,
        tipo: a.tipo || 'number',
        categoria: a.categoria || 'basico',
        ordem: a.ordem || (i + 1),
        opcoes: a.opcoes || null,
      })),
    };

    // Salvar creation_level no theme
    payload.config[0]['creation_level'] = nivel;

    await importRPG(payload);

    // Ativar tutorial para esta campanha por padrão
    const tutState = { ativo: true, passos_vistos: {} };
    try { localStorage.setItem('rpghub_tutorial_' + rpgId, JSON.stringify(tutState)); } catch(e) {}

    // Atualizar lista e entrar na campanha
    HUB_DATA.rpgs = await getAllRPGs() || [];
    renderRPGList(HUB_DATA.rpgs);

    if (st) { st.textContent = '✓ Campanha criada! Entrando…'; }
    mostrarToast(`✦ "${d.nome}" criada com sucesso!`, 'sucesso');

    setTimeout(async () => {
      fecharCriarCampanha();
      await entrarRPG(rpgId);
    }, 1200);

  } catch(e) {
    btn.disabled = false; btn.textContent = '✦ Criar Campanha!';
    const msg = e.message || 'Erro desconhecido';
    if (st) { st.className='import-status err'; st.textContent = '✗ ' + msg; }
    mostrarToast('Erro: ' + msg, 'erro');
  }
}


