// invocacoes.js — Sistema de Invocações (Summons)
// Módulo: CRUD de invocações, editor modal (mestre), accordion na ficha, item effect 'invocar'

// ── Estado ────────────────────────────────────────────────────
const INV_OCACOES = { catalogo: [], carregado: false };
let _invModalId = null;      // UUID sendo editado (null = nova)
let _invDarCharNome = null;  // char alvo do modal "Dar Invocação"

// ── Carregar dados do Supabase ─────────────────────────────────
async function invocacoesCarregarDados(rpgId) {
  if (!rpgId || typeof sb !== 'function') return;
  try {
    const rows = await sb(`invocacoes?rpg_id=eq.${encodeURIComponent(rpgId)}&order=nome`);
    INV_OCACOES.catalogo = Array.isArray(rows) ? rows : [];
    INV_OCACOES.carregado = true;
  } catch (e) {
    console.error('[INV_OCACOES] Erro ao carregar invocações:', e);
  }
}

// ── Patch em entrarRPG ─────────────────────────────────────────
(function () {
  const _orig = window.entrarRPG;
  window.entrarRPG = async function (rpgId) {
    await _orig(rpgId);
    await invocacoesCarregarDados(rpgId);
  };
})();

// ── Seção da ficha ─────────────────────────────────────────────
function renderSecaoInvocacoes(c, ca, isMestre, podEditar) {
  const invs = Array.isArray(ca.invocacoes) ? ca.invocacoes : [];
  const nomeSafe = (c.nome || '').replace(/'/g, "\\'");

  let html = '';

  if (!invs.length && !isMestre) {
    html = `<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Nenhuma invocação disponível.</div>`;
  }

  // Listar invocações do personagem
  invs.forEach(entry => {
    const def = INV_OCACOES.catalogo.find(i => i.id === entry.invocacao_id);
    if (!def) return;
    const comp = _invComportamentoBadge(def.comportamento);
    const durStr = def.duracao_base_turnos + (def.duracao_sabedoria_mult > 0
      ? `+Sab×${def.duracao_sabedoria_mult}` : '') + 't';
    const origemBadge = entry.origem === 'item'
      ? `<span style="font-size:0.7rem;color:var(--suave);margin-left:4px">📦 Item</span>` : '';

    const invocando = typeof AVT_STATE !== 'undefined' && AVT_STATE.rpgId;
    const btnInvocar = (podEditar && invocando)
      ? `<button class="btn-sm btn-roxo" onclick="avtInvocar('${nomeSafe}','${def.id}')" title="Invocar no mapa">✨ Invocar</button>`
      : `<button class="btn-sm" style="opacity:0.4;cursor:default" title="Só disponível no modo aventura" disabled>✨ Invocar</button>`;

    html += `<div class="skill-item">
      <div class="skill-header">
        <div class="skill-nome">🔮 ${def.nome}</div>
        <span class="badge badge-roxo">${comp}</span>
        <span style="font-size:0.75rem;color:var(--suave)">${durStr}</span>
        ${origemBadge}
        ${isMestre ? `<button class="icon-btn" onclick="abrirModalInvocacao('${def.id}','${nomeSafe}')" title="Editar">✏️</button>` : ''}
        ${isMestre ? `<button class="icon-btn" onclick="invocacaoRemoverDePersonagem('${def.id}','${nomeSafe}')" title="Remover">✕</button>` : ''}
        ${btnInvocar}
      </div>
      <div class="skill-efeito" style="font-size:0.82rem;color:var(--suave)">${def.descricao || ''}</div>
      <div style="font-size:0.72rem;color:var(--suave);margin-top:4px">HP: ${def.hp_base}${def.hp_atributo_scaling ? `+${def.hp_atributo_scaling}×${def.hp_atributo_pct}%` : ''} · ${def.dano_formula || '—'} dano · ${def.resistencia_base || 0} resist.</div>
    </div>`;
  });

  if (isMestre) {
    html += `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn-sm btn-roxo" onclick="abrirModalInvocacao(null,'${nomeSafe}')">＋ Criar Invocação</button>
      <button class="btn-sm" onclick="abrirModalDarInvocacao('${nomeSafe}')">🎁 Dar Invocação</button>
    </div>`;
  }

  return html || `<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Nenhuma invocação disponível.</div>`;
}
window.renderSecaoInvocacoes = renderSecaoInvocacoes;

function _invComportamentoBadge(c) {
  const map = { protetor: '🛡 Protetor', curador: '💚 Curador', agressivo: '⚔ Agressivo', assassino: '🗡 Assassino', dummy: '🎯 Isca' };
  return map[c] || c || '—';
}

// ── Editor Modal ──────────────────────────────────────────────
function abrirModalInvocacao(invId, charNomeHint) {
  const overlay = document.getElementById('modal-invocacao-overlay');
  if (!overlay) return;
  _invModalId = invId || null;

  _invPopularAtributosSelects();
  _invPopularComportamentoSelect();

  if (invId) {
    const inv = INV_OCACOES.catalogo.find(i => i.id === invId);
    if (!inv) return;
    document.getElementById('modal-invocacao-titulo').textContent = 'Editar Invocação';
    document.getElementById('inv-id').value = invId;
    document.getElementById('inv-nome').value = inv.nome || '';
    document.getElementById('inv-descricao').value = inv.descricao || '';
    document.getElementById('inv-visual-tipo').value = inv.visual_tipo || 'particles';
    _invVisualTipoChange();
    document.getElementById('inv-visual-config').value = inv.visual_config
      ? (inv.visual_tipo === 'token' ? (inv.visual_config.img_url || '') : JSON.stringify(inv.visual_config, null, 2))
      : '';
    document.getElementById('inv-comportamento').value = inv.comportamento || 'agressivo';
    _invComportamentoChange();
    document.getElementById('inv-dummy-explosivo').checked = !!inv.dummy_explosivo;
    document.getElementById('inv-dano-formula').value = inv.dano_formula || '';
    document.getElementById('inv-dano-attr').value = inv.dano_atributo_scaling || '';
    document.getElementById('inv-dano-pct').value = inv.dano_atributo_pct || 0;
    document.getElementById('inv-resist-base').value = inv.resistencia_base || 0;
    document.getElementById('inv-resist-attr').value = inv.resistencia_atributo_scaling || '';
    document.getElementById('inv-resist-pct').value = inv.resistencia_atributo_pct || 0;
    document.getElementById('inv-cura-formula').value = inv.cura_formula || '';
    document.getElementById('inv-cura-attr').value = inv.cura_atributo_scaling || '';
    document.getElementById('inv-cura-pct').value = inv.cura_atributo_pct || 0;
    document.getElementById('inv-hp-base').value = inv.hp_base || 20;
    document.getElementById('inv-hp-attr').value = inv.hp_atributo_scaling || '';
    document.getElementById('inv-hp-pct').value = inv.hp_atributo_pct || 0;
    document.getElementById('inv-duracao-base').value = inv.duracao_base_turnos || 3;
    document.getElementById('inv-sab-mult').value = inv.duracao_sabedoria_mult || 0;
    document.getElementById('inv-init-bonus').value = inv.iniciativa_bonus || 0;
    document.getElementById('inv-habilidades').value = Array.isArray(inv.habilidades) && inv.habilidades.length
      ? JSON.stringify(inv.habilidades, null, 2) : '';
  } else {
    document.getElementById('modal-invocacao-titulo').textContent = 'Nova Invocação';
    document.getElementById('inv-id').value = '';
    document.getElementById('inv-nome').value = '';
    document.getElementById('inv-descricao').value = '';
    document.getElementById('inv-visual-tipo').value = 'particles';
    _invVisualTipoChange();
    document.getElementById('inv-visual-config').value = '';
    document.getElementById('inv-comportamento').value = 'agressivo';
    _invComportamentoChange();
    document.getElementById('inv-dummy-explosivo').checked = false;
    document.getElementById('inv-dano-formula').value = '1d6';
    document.getElementById('inv-dano-attr').value = '';
    document.getElementById('inv-dano-pct').value = 0;
    document.getElementById('inv-resist-base').value = 0;
    document.getElementById('inv-resist-attr').value = '';
    document.getElementById('inv-resist-pct').value = 0;
    document.getElementById('inv-cura-formula').value = '';
    document.getElementById('inv-cura-attr').value = '';
    document.getElementById('inv-cura-pct').value = 0;
    document.getElementById('inv-hp-base').value = 20;
    document.getElementById('inv-hp-attr').value = '';
    document.getElementById('inv-hp-pct').value = 0;
    document.getElementById('inv-duracao-base').value = 3;
    document.getElementById('inv-sab-mult').value = 0;
    document.getElementById('inv-init-bonus').value = 0;
    document.getElementById('inv-habilidades').value = '';
  }

  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalInvocacao(); };
}
window.abrirModalInvocacao = abrirModalInvocacao;

function fecharModalInvocacao() {
  const overlay = document.getElementById('modal-invocacao-overlay');
  if (overlay) overlay.style.display = 'none';
  _invModalId = null;
}
window.fecharModalInvocacao = fecharModalInvocacao;

function _invVisualTipoChange() {
  const tipo = document.getElementById('inv-visual-tipo')?.value || 'particles';
  const lbl = document.getElementById('inv-visual-config-label');
  const hint = document.getElementById('inv-visual-config-hint');
  if (tipo === 'token') {
    if (lbl) lbl.textContent = 'URL da imagem do token';
    if (hint) hint.textContent = 'URL direta de imagem (PNG, JPG, GIF)';
  } else {
    if (lbl) lbl.textContent = 'Config. de partículas (JSON ou vazio para padrão)';
    if (hint) hint.textContent = 'Deixe vazio para usar o visual padrão de invocação';
  }
}
window._invVisualTipoChange = _invVisualTipoChange;

function _invComportamentoChange() {
  const comp = document.getElementById('inv-comportamento')?.value || 'agressivo';
  const dummyWrap = document.getElementById('inv-dummy-wrap');
  const curaWrap = document.getElementById('inv-cura-wrap');
  if (dummyWrap) dummyWrap.style.display = comp === 'dummy' ? '' : 'none';
  if (curaWrap) curaWrap.style.display = (comp === 'curador' || comp === 'protetor') ? 'grid' : 'none';
}
window._invComportamentoChange = _invComportamentoChange;

function _invPopularAtributosSelects() {
  const defs = RPG_DATA?.attrDefs || [];
  const nums = defs.filter(a => a.tipo === 'number');
  const opts = '<option value="">— Nenhum —</option>' + nums.map(a => `<option value="${a.nome}">${a.nome}</option>`).join('');
  ['inv-dano-attr', 'inv-resist-attr', 'inv-cura-attr', 'inv-hp-attr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { const cur = el.value; el.innerHTML = opts; el.value = cur; }
  });
}

function _invPopularComportamentoSelect() {
  const sel = document.getElementById('inv-comportamento');
  if (!sel || sel.options.length > 1) return;
  const opts = [
    ['protetor', '🛡 Protetor — segue o dono, ataca quem o ataca'],
    ['curador', '💚 Curador — cura/bufa o dono, ataca quando dono está bem'],
    ['agressivo', '⚔ Agressivo — vai ao inimigo mais próximo'],
    ['assassino', '🗡 Assassino — foca no inimigo com menor HP'],
    ['dummy', '🎯 Isca — fica parado, atrai inimigos'],
  ];
  sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}

async function salvarInvocacao() {
  if (RPG_DATA?.myRole !== 'mestre') { mostrarToast('Apenas o mestre pode criar invocações', 'erro'); return; }
  const nome = document.getElementById('inv-nome').value.trim();
  if (!nome) { mostrarToast('Nome da invocação obrigatório', 'erro'); return; }

  const visualTipo = document.getElementById('inv-visual-tipo').value;
  let visualConfig = {};
  const configRaw = document.getElementById('inv-visual-config').value.trim();
  if (configRaw) {
    if (visualTipo === 'token') {
      visualConfig = { img_url: configRaw };
    } else {
      try { visualConfig = JSON.parse(configRaw); } catch (_) { visualConfig = {}; }
    }
  }

  let habilidades = [];
  const habRaw = document.getElementById('inv-habilidades').value.trim();
  if (habRaw) {
    try { habilidades = JSON.parse(habRaw); } catch (_) { habilidades = []; }
  }

  const body = {
    rpg_id: RPG_DATA.rpgId,
    nome,
    descricao: document.getElementById('inv-descricao').value.trim() || null,
    visual_tipo: visualTipo,
    visual_config: visualConfig,
    comportamento: document.getElementById('inv-comportamento').value || 'agressivo',
    dummy_explosivo: document.getElementById('inv-dummy-explosivo').checked,
    dano_formula: document.getElementById('inv-dano-formula').value.trim() || null,
    dano_atributo_scaling: document.getElementById('inv-dano-attr').value || null,
    dano_atributo_pct: parseFloat(document.getElementById('inv-dano-pct').value) || 0,
    resistencia_base: parseInt(document.getElementById('inv-resist-base').value) || 0,
    resistencia_atributo_scaling: document.getElementById('inv-resist-attr').value || null,
    resistencia_atributo_pct: parseFloat(document.getElementById('inv-resist-pct').value) || 0,
    cura_formula: document.getElementById('inv-cura-formula').value.trim() || null,
    cura_atributo_scaling: document.getElementById('inv-cura-attr').value || null,
    cura_atributo_pct: parseFloat(document.getElementById('inv-cura-pct').value) || 0,
    hp_base: parseInt(document.getElementById('inv-hp-base').value) || 20,
    hp_atributo_scaling: document.getElementById('inv-hp-attr').value || null,
    hp_atributo_pct: parseFloat(document.getElementById('inv-hp-pct').value) || 0,
    duracao_base_turnos: parseInt(document.getElementById('inv-duracao-base').value) || 3,
    duracao_sabedoria_mult: parseFloat(document.getElementById('inv-sab-mult').value) || 0,
    iniciativa_bonus: parseInt(document.getElementById('inv-init-bonus').value) || 0,
    habilidades,
  };

  try {
    if (_invModalId) {
      const rows = await sb(`invocacoes?id=eq.${encodeURIComponent(_invModalId)}`,
        { method: 'PATCH', body: JSON.stringify(body) });
      const updated = Array.isArray(rows) ? rows[0] : rows;
      const idx = INV_OCACOES.catalogo.findIndex(i => i.id === _invModalId);
      if (idx >= 0 && updated) INV_OCACOES.catalogo[idx] = { ...INV_OCACOES.catalogo[idx], ...body, ...updated };
      mostrarToast('Invocação atualizada!', 'sucesso');
    } else {
      const rows = await sb('invocacoes', { method: 'POST', body: JSON.stringify(body) });
      const created = Array.isArray(rows) ? rows[0] : rows;
      if (created) INV_OCACOES.catalogo.push(created);
      mostrarToast('Invocação criada!', 'sucesso');
    }
    fecharModalInvocacao();
    if (typeof renderFichaView === 'function' && typeof FICHAS_VIEW !== 'undefined' && FICHAS_VIEW) {
      renderFichaView(FICHAS_VIEW);
    }
  } catch (e) {
    console.error('[INV_OCACOES] Erro ao salvar:', e);
    mostrarToast('Erro ao salvar invocação', 'erro');
  }
}
window.salvarInvocacao = salvarInvocacao;

async function removerInvocacaoGlobal(invId, nome) {
  if (!confirm(`Remover a invocação "${nome}"? Ela será removida de todos os personagens.`)) return;
  try {
    await sb(`invocacoes?id=eq.${encodeURIComponent(invId)}`, { method: 'DELETE' });
    INV_OCACOES.catalogo = INV_OCACOES.catalogo.filter(i => i.id !== invId);
    // Remove de todos os personagens
    const chars = RPG_DATA?.characters || [];
    for (const ch of chars) {
      const ca = ch.custom_attrs || {};
      if (!Array.isArray(ca.invocacoes)) continue;
      const antes = ca.invocacoes.length;
      ca.invocacoes = ca.invocacoes.filter(e => e.invocacao_id !== invId);
      if (ca.invocacoes.length !== antes) {
        await sb(`characters?id=eq.${encodeURIComponent(ch.id)}`,
          { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) }).catch(() => {});
      }
    }
    mostrarToast(`🗑 Invocação "${nome}" removida`, 'sucesso');
    if (typeof renderFichaView === 'function' && typeof FICHAS_VIEW !== 'undefined' && FICHAS_VIEW) {
      renderFichaView(FICHAS_VIEW);
    }
  } catch (e) {
    console.error('[INV_OCACOES] Erro ao remover:', e);
    mostrarToast('Erro ao remover invocação', 'erro');
  }
}
window.removerInvocacaoGlobal = removerInvocacaoGlobal;

// ── Dar/Remover invocação de personagem ────────────────────────
async function invocacaoDarAPersonagem(invId, charNome) {
  const char = RPG_DATA?.characters?.find(c => c.nome === charNome);
  if (!char) return;
  const ca = char.custom_attrs || {};
  ca.invocacoes = ca.invocacoes || [];
  if (ca.invocacoes.some(e => e.invocacao_id === invId)) {
    mostrarToast('Personagem já possui esta invocação', 'aviso'); return;
  }
  ca.invocacoes.push({ invocacao_id: invId, origem: 'direta' });
  char.custom_attrs = ca;
  try {
    await sb(`characters?id=eq.${encodeURIComponent(char.id)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) });
    mostrarToast(`🔮 Invocação concedida a ${charNome}!`, 'sucesso');
    if (typeof renderFichaView === 'function' && FICHAS_VIEW === charNome) renderFichaView(charNome);
  } catch (e) {
    mostrarToast('Erro ao dar invocação', 'erro');
  }
}
window.invocacaoDarAPersonagem = invocacaoDarAPersonagem;

async function invocacaoRemoverDePersonagem(invId, charNome) {
  const char = RPG_DATA?.characters?.find(c => c.nome === charNome);
  if (!char) return;
  const ca = char.custom_attrs || {};
  ca.invocacoes = (ca.invocacoes || []).filter(e => e.invocacao_id !== invId);
  char.custom_attrs = ca;
  try {
    await sb(`characters?id=eq.${encodeURIComponent(char.id)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) });
    mostrarToast('Invocação removida do personagem', 'sucesso');
    if (typeof renderFichaView === 'function' && FICHAS_VIEW === charNome) renderFichaView(charNome);
  } catch (e) {
    mostrarToast('Erro ao remover invocação', 'erro');
  }
}
window.invocacaoRemoverDePersonagem = invocacaoRemoverDePersonagem;

// ── Modal "Dar Invocação" ──────────────────────────────────────
function abrirModalDarInvocacao(charNome) {
  const overlay = document.getElementById('modal-dar-invocacao-overlay');
  if (!overlay) return;
  _invDarCharNome = charNome;
  document.getElementById('dar-inv-char-nome').textContent = charNome;
  _invRenderListaDarInvocacao();
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalDarInvocacao(); };
}
window.abrirModalDarInvocacao = abrirModalDarInvocacao;

function fecharModalDarInvocacao() {
  const overlay = document.getElementById('modal-dar-invocacao-overlay');
  if (overlay) overlay.style.display = 'none';
  _invDarCharNome = null;
}
window.fecharModalDarInvocacao = fecharModalDarInvocacao;

function _invRenderListaDarInvocacao() {
  const container = document.getElementById('dar-inv-lista');
  if (!container) return;
  const char = RPG_DATA?.characters?.find(c => c.nome === _invDarCharNome);
  const possuidas = new Set((char?.custom_attrs?.invocacoes || []).map(e => e.invocacao_id));
  if (!INV_OCACOES.catalogo.length) {
    container.innerHTML = `<div style="color:var(--suave);font-style:italic;font-size:0.82rem">Nenhuma invocação criada ainda.</div>`;
    return;
  }
  container.innerHTML = INV_OCACOES.catalogo.map(inv => {
    const tem = possuidas.has(inv.id);
    const nomeSafe = (_invDarCharNome || '').replace(/'/g, "\\'");
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--borda)">
      <div style="flex:1">
        <div style="font-size:0.85rem;color:var(--primario-v)">🔮 ${inv.nome}</div>
        <div style="font-size:0.72rem;color:var(--suave)">${_invComportamentoBadge(inv.comportamento)} · ${inv.duracao_base_turnos}t</div>
      </div>
      ${tem
        ? `<span style="font-size:0.75rem;color:var(--suave);padding:4px 8px">✓ Possui</span>`
        : `<button class="btn-sm btn-roxo" onclick="invocacaoDarAPersonagem('${inv.id}','${nomeSafe}');_invRenderListaDarInvocacao()">Dar</button>`
      }
    </div>`;
  }).join('');
}
window._invRenderListaDarInvocacao = _invRenderListaDarInvocacao;

// ── Helpers para o editor de itens ────────────────────────────
function invocacoesPopularSelectInvocacoes(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Selecione uma Invocação —</option>'
    + INV_OCACOES.catalogo.map(i => `<option value="${i.id}"${i.id === cur ? ' selected' : ''}>🔮 ${i.nome}</option>`).join('');
}
window.invocacoesPopularSelectInvocacoes = invocacoesPopularSelectInvocacoes;
