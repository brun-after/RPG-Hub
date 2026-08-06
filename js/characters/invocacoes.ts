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
    const catalogo = Array.isArray(rows) ? rows : [];

    // Invocações globais: disponíveis em todas as campanhas do MESMO mestre.
    // Busca os rpg_ids do mestre dono desta campanha e mescla as invocações
    // marcadas como global=true (deduplicando por id com as da campanha atual).
    try {
      const ownerId = (typeof CURRENT_RPG !== 'undefined' && CURRENT_RPG && CURRENT_RPG.owner_id) || null;
      if (ownerId) {
        const rpgsDoMestre = await sb(`rpg_registry?owner_id=eq.${encodeURIComponent(ownerId)}&select=rpg_id`);
        const ids = Array.isArray(rpgsDoMestre) ? rpgsDoMestre.map(r => r.rpg_id).filter(Boolean) : [];
        if (ids.length) {
          const globais = await sb(`invocacoes?rpg_id=in.(${ids.map(encodeURIComponent).join(',')})&global=is.true&order=nome`);
          const existentes = new Set(catalogo.map(i => i.id));
          (Array.isArray(globais) ? globais : []).forEach(g => {
            if (!existentes.has(g.id)) { catalogo.push(g); existentes.add(g.id); }
          });
        }
      }
    } catch (e2) {
      console.warn('[INV_OCACOES] Falha ao carregar invocações globais:', e2);
    }

    INV_OCACOES.catalogo = catalogo;
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

    // Token preview
    const imgToken = def.visual_config?.img_url || '';
    const tokenHtml = imgToken
      ? `<img src="${imgToken}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1.5px solid #b07ef0;flex-shrink:0">`
      : `<div style="width:32px;height:32px;border-radius:50%;border:1.5px solid #b07ef0;background:rgba(176,126,240,0.15);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🔮</div>`;

    // Skills vinculadas
    const skillIds = Array.isArray(def.habilidades) ? def.habilidades.filter(h => typeof h === 'string') : [];
    const skills = typeof RPG_DATA !== 'undefined' && Array.isArray(RPG_DATA.skills)
      ? RPG_DATA.skills.filter(s => skillIds.includes(s.id))
      : (typeof AVT_STATE !== 'undefined' && Array.isArray(AVT_STATE.skills)
          ? AVT_STATE.skills.filter(s => skillIds.includes(s.id)) : []);
    const skillsStr = skills.length ? skills.map(s => s.habilidade).join(', ') : '';

    html += `<div class="skill-item">
      <div class="skill-header">
        ${tokenHtml}
        <div class="skill-nome">🔮 ${def.nome}</div>
        <span class="badge badge-roxo">${comp}</span>
        <span style="font-size:0.75rem;color:var(--suave)">${durStr}</span>
        ${origemBadge}
        ${isMestre ? `<button class="icon-btn" onclick="abrirModalInvocacao('${def.id}','${nomeSafe}')" title="Editar">✏️</button>` : ''}
        ${isMestre ? `<button class="icon-btn" onclick="invocacaoRemoverDePersonagem('${def.id}','${nomeSafe}')" title="Remover">✕</button>` : ''}
        ${btnInvocar}
      </div>
      <div class="skill-efeito" style="font-size:0.82rem;color:var(--suave)">${def.descricao || ''}</div>
      <div style="font-size:0.72rem;color:var(--suave);margin-top:4px">HP: ${def.hp_base}${def.hp_atributo_scaling ? `+${def.hp_atributo_scaling}×${def.hp_atributo_pct}%` : ''} · ${def.dano_formula || '—'} dano · ${def.resistencia_base || 0} resist.${skillsStr ? ` · ⚡ ${skillsStr}` : ''}</div>
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

// ── Upload de imagem ──────────────────────────────────────────
async function _invFileUpload(input, targetId, isToken) {
  const file = input.files?.[0]; if (!file) return;
  mostrarToast('Enviando imagem…', 'info');
  try {
    const url = await uploadToStorage(file, 'invocacoes');
    const el = document.getElementById(targetId);
    if (el) {
      el.value = url;
      if (isToken) _invAtualizarTokenPreview();
      else _invAtualizarPerfilPreview();
    }
    mostrarToast('Imagem enviada!', 'sucesso');
  } catch(e) {
    mostrarToast('Erro no upload da imagem', 'erro');
    console.error(e);
  }
}
window._invFileUpload = _invFileUpload;

function _invAtualizarTokenPreview() {
  const url = document.getElementById('inv-img-token')?.value.trim() || '';
  const prev = document.getElementById('inv-token-preview');
  if (!prev) return;
  if (url) {
    prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    prev.innerHTML = '🔮';
  }
}
window._invAtualizarTokenPreview = _invAtualizarTokenPreview;

function _invAtualizarPerfilPreview() {
  const url = document.getElementById('inv-img-perfil')?.value.trim() || '';
  const prev = document.getElementById('inv-perfil-preview');
  if (!prev) return;
  if (url) {
    prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    prev.innerHTML = '🎨';
  }
}
window._invAtualizarPerfilPreview = _invAtualizarPerfilPreview;

// ── Checklist de skills ───────────────────────────────────────
function _invRenderSkillsChecklist(selectedIds) {
  const container = document.getElementById('inv-skills-lista');
  if (!container) return;

  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds.filter(h => typeof h === 'string') : []);
  const allSkills = (typeof RPG_DATA !== 'undefined' && Array.isArray(RPG_DATA.skills) ? RPG_DATA.skills : [])
    .concat(typeof AVT_STATE !== 'undefined' && Array.isArray(AVT_STATE.skills) ? AVT_STATE.skills.filter(s =>
      !(typeof RPG_DATA !== 'undefined' && Array.isArray(RPG_DATA.skills) && RPG_DATA.skills.some(r => r.id === s.id))
    ) : []);

  if (!allSkills.length) {
    container.innerHTML = `<div style="color:var(--suave);font-size:0.75rem;font-style:italic;padding:6px 0">Nenhuma skill disponível neste RPG. Crie skills na ficha dos personagens primeiro.</div>`;
    return;
  }

  container.innerHTML = allSkills.map(sk => {
    const checked = selectedSet.has(sk.id) ? 'checked' : '';
    const formula = sk.formula_dano || sk.custo_rsv || '';
    const personagem = sk.personagem ? ` · ${sk.personagem}` : '';
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-radius:5px;transition:background 0.1s" onmouseover="this.style.background='rgba(176,126,240,0.08)'" onmouseout="this.style.background=''">
      <input type="checkbox" value="${sk.id}" ${checked} style="accent-color:#b07ef0;width:15px;height:15px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.8rem;color:var(--texto)">${sk.habilidade}</div>
        <div style="font-size:0.68rem;color:var(--suave)">${formula}${personagem}</div>
      </div>
    </label>`;
  }).join('');
}
window._invRenderSkillsChecklist = _invRenderSkillsChecklist;

// ── Editor Modal ──────────────────────────────────────────────
function abrirModalInvocacao(invId, charNomeHint) {
  const overlay = document.getElementById('modal-invocacao-overlay');
  if (!overlay) return;
  _invModalId = invId || null;

  _invPopularAtributosSelects();

  if (invId) {
    const inv = INV_OCACOES.catalogo.find(i => i.id === invId);
    if (!inv) return;
    document.getElementById('modal-invocacao-titulo').textContent = 'Editar Invocação';
    document.getElementById('inv-id').value = invId;
    document.getElementById('inv-nome').value = inv.nome || '';
    document.getElementById('inv-descricao').value = inv.descricao || '';

    // Imagens
    const imgToken = inv.visual_config?.img_url || '';
    const imgPerfil = inv.visual_config?.img_perfil || inv.img_perfil || '';
    document.getElementById('inv-img-token').value = imgToken;
    document.getElementById('inv-img-perfil').value = imgPerfil;
    _invAtualizarTokenPreview();
    _invAtualizarPerfilPreview();

    // Partículas
    const particleConfig = inv.visual_tipo === 'particles' && inv.visual_config
      ? JSON.stringify(inv.visual_config, null, 2) : '';
    document.getElementById('inv-visual-config').value = particleConfig;

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
    { const _gEl = document.getElementById('inv-global'); if (_gEl) _gEl.checked = !!inv.global; }

    // Skills (carregar apenas UUIDs — ignora formato antigo de objetos)
    const skillIds = Array.isArray(inv.habilidades) ? inv.habilidades.filter(h => typeof h === 'string') : [];
    _invRenderSkillsChecklist(skillIds);
  } else {
    document.getElementById('modal-invocacao-titulo').textContent = 'Nova Invocação';
    document.getElementById('inv-id').value = '';
    document.getElementById('inv-nome').value = '';
    document.getElementById('inv-descricao').value = '';
    document.getElementById('inv-img-token').value = '';
    document.getElementById('inv-img-perfil').value = '';
    _invAtualizarTokenPreview();
    _invAtualizarPerfilPreview();
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
    { const _gEl = document.getElementById('inv-global'); if (_gEl) _gEl.checked = false; }
    _invRenderSkillsChecklist([]);
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

async function salvarInvocacao() {
  if (RPG_DATA?.myRole !== 'mestre') { mostrarToast('Apenas o mestre pode criar invocações', 'erro'); return; }
  const nome = document.getElementById('inv-nome').value.trim();
  if (!nome) { mostrarToast('Nome da invocação obrigatório', 'erro'); return; }

  // Imagens
  const imgToken  = document.getElementById('inv-img-token')?.value.trim() || '';
  const imgPerfil = document.getElementById('inv-img-perfil')?.value.trim() || '';

  // Visual config
  const visualTipo = imgToken ? 'token' : 'particles';
  let visualConfig = {};
  if (imgToken) {
    visualConfig = { img_url: imgToken, img_perfil: imgPerfil || null };
  } else {
    const particleRaw = document.getElementById('inv-visual-config')?.value.trim() || '';
    if (particleRaw) { try { visualConfig = JSON.parse(particleRaw); } catch(_) { visualConfig = {}; } }
  }

  // Habilidades: coleta UUIDs dos checkboxes marcados
  const habilidades = Array.from(
    document.querySelectorAll('#inv-skills-lista input[type=checkbox]:checked')
  ).map(cb => cb.value);

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
    global: document.getElementById('inv-global')?.checked || false,
    habilidades,
  };

  try {
    if (_invModalId) {
      const rows = await sb(`invocacoes?id=eq.${encodeURIComponent(_invModalId)}`,
        { method: 'PATCH', body: JSON.stringify(body) });
      const updated = Array.isArray(rows) ? rows[0] : rows;
      const idx = INV_OCACOES.catalogo.findIndex(i => i.id === _invModalId);
      if (idx >= 0) INV_OCACOES.catalogo[idx] = { ...INV_OCACOES.catalogo[idx], ...body, ...(updated || {}) };
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
    const imgToken = inv.visual_config?.img_url || '';
    const tokenHtml = imgToken
      ? `<img src="${imgToken}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid #b07ef0">`
      : `<div style="width:28px;height:28px;border-radius:50%;border:1px solid #b07ef0;background:rgba(176,126,240,0.15);display:flex;align-items:center;justify-content:center;font-size:0.85rem">🔮</div>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--borda)">
      ${tokenHtml}
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

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "INV_OCACOES", { configurable: true, get: () => INV_OCACOES });
Object.defineProperty(globalThis, "_invModalId", { configurable: true, get: () => _invModalId, set: (__v) => { _invModalId = __v; } });
Object.defineProperty(globalThis, "_invDarCharNome", { configurable: true, get: () => _invDarCharNome, set: (__v) => { _invDarCharNome = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invocacoesCarregarDados", { configurable: true, get: () => invocacoesCarregarDados, set: (__v) => { invocacoesCarregarDados = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderSecaoInvocacoes", { configurable: true, get: () => renderSecaoInvocacoes, set: (__v) => { renderSecaoInvocacoes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invComportamentoBadge", { configurable: true, get: () => _invComportamentoBadge, set: (__v) => { _invComportamentoBadge = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invFileUpload", { configurable: true, get: () => _invFileUpload, set: (__v) => { _invFileUpload = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invAtualizarTokenPreview", { configurable: true, get: () => _invAtualizarTokenPreview, set: (__v) => { _invAtualizarTokenPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invAtualizarPerfilPreview", { configurable: true, get: () => _invAtualizarPerfilPreview, set: (__v) => { _invAtualizarPerfilPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invRenderSkillsChecklist", { configurable: true, get: () => _invRenderSkillsChecklist, set: (__v) => { _invRenderSkillsChecklist = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalInvocacao", { configurable: true, get: () => abrirModalInvocacao, set: (__v) => { abrirModalInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalInvocacao", { configurable: true, get: () => fecharModalInvocacao, set: (__v) => { fecharModalInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invComportamentoChange", { configurable: true, get: () => _invComportamentoChange, set: (__v) => { _invComportamentoChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invPopularAtributosSelects", { configurable: true, get: () => _invPopularAtributosSelects, set: (__v) => { _invPopularAtributosSelects = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarInvocacao", { configurable: true, get: () => salvarInvocacao, set: (__v) => { salvarInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "removerInvocacaoGlobal", { configurable: true, get: () => removerInvocacaoGlobal, set: (__v) => { removerInvocacaoGlobal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invocacaoDarAPersonagem", { configurable: true, get: () => invocacaoDarAPersonagem, set: (__v) => { invocacaoDarAPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invocacaoRemoverDePersonagem", { configurable: true, get: () => invocacaoRemoverDePersonagem, set: (__v) => { invocacaoRemoverDePersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalDarInvocacao", { configurable: true, get: () => abrirModalDarInvocacao, set: (__v) => { abrirModalDarInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalDarInvocacao", { configurable: true, get: () => fecharModalDarInvocacao, set: (__v) => { fecharModalDarInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_invRenderListaDarInvocacao", { configurable: true, get: () => _invRenderListaDarInvocacao, set: (__v) => { _invRenderListaDarInvocacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "invocacoesPopularSelectInvocacoes", { configurable: true, get: () => invocacoesPopularSelectInvocacoes, set: (__v) => { invocacoesPopularSelectInvocacoes = __v; } });
