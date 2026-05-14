// characters/skills.js
// RPG Hub — Skill management: formula builder, skill CRUD
// Includes: SK_FB formula builder, abrirModalSkill(), salvarSkill(), removerSkill()
// Character creation moved to: js/characters/characters.js
// Lore CRUD moved to: js/systems/lore.js
// Map creation moved to: js/maps/maps.js

// ── SKILL FORMULA BUILDER ────────────────────────────────────
let SK_FB = [];

function skFBAdicionarDado(faces) {
  const ex = SK_FB.find(g => g.tipo === 'dado' && g.faces === faces);
  if (ex) ex.qtd++;
  else SK_FB.push({ tipo: 'dado', faces, qtd: 1 });
  skFBAtualizarUI();
}
function skFBRemoverDado(faces) {
  const idx = SK_FB.findIndex(g => g.tipo === 'dado' && g.faces === faces);
  if (idx < 0) return;
  SK_FB[idx].qtd--;
  if (SK_FB[idx].qtd <= 0) SK_FB.splice(idx, 1);
  skFBAtualizarUI();
}
function skFBMostrarInputBonus() {
  const wrap = document.getElementById('sk-bonus-input-wrap');
  const toggle = document.getElementById('sk-bonus-toggle');
  const inp = document.getElementById('sk-bonus-input');
  if (wrap) { wrap.style.display = 'inline-flex'; }
  if (toggle) toggle.style.display = 'none';
  if (inp) { inp.value = ''; inp.focus(); }
}
function skFBConfirmarBonus() {
  const inp = document.getElementById('sk-bonus-input');
  const val = parseInt(inp?.value || '0');
  if (val) {
    const ex = SK_FB.find(g => g.tipo === 'bonus');
    if (ex) ex.valor += val;
    else SK_FB.push({ tipo: 'bonus', valor: val });
    skFBAtualizarUI();
  }
  skFBCancelarBonus();
}
function skFBCancelarBonus() {
  const wrap = document.getElementById('sk-bonus-input-wrap');
  const toggle = document.getElementById('sk-bonus-toggle');
  if (wrap) wrap.style.display = 'none';
  if (toggle) toggle.style.display = '';
}
function skFBAdicionarBonus() { skFBMostrarInputBonus(); }
function skFBLimpar() { SK_FB = []; skFBAtualizarUI(); }
function skFBAtualizarUI() {
  const chips = document.getElementById('sk-fb-chips');
  const prev  = document.getElementById('sk-fb-preview');
  const hid   = document.getElementById('sk-formula');
  const range = document.getElementById('sk-fb-range');
  const formula = typeof formulaDeGrupos === 'function'
    ? formulaDeGrupos(SK_FB)
    : SK_FB.map(g => g.tipo === 'dado' ? g.qtd+'d'+g.faces : (g.valor>=0?'+':'')+g.valor).join('');
  if (hid)  hid.value = formula;
  if (prev) prev.textContent = formula || '—';
  if (range) {
    if (SK_FB.length) {
      let mn = 0, mx = 0, med = 0;
      SK_FB.forEach(g => {
        if (g.tipo === 'dado') {
          mn  += g.qtd * 1;
          mx  += g.qtd * g.faces;
          med += g.qtd * (g.faces + 1) / 2;
        } else {
          mn += g.valor; mx += g.valor; med += g.valor;
        }
      });
      range.textContent = 'min ' + mn + ' · média ' + med.toFixed(1) + ' · max ' + mx;
    } else {
      range.textContent = '';
    }
  }
  if (!chips) return;
  chips.innerHTML = SK_FB.map(g => {
    if (g.tipo === 'dado') return '<div style="display:flex;align-items:center;gap:3px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:20px;padding:2px 9px 2px 7px">'
      +'<span style="font-family:var(--fonte-d);font-size:0.82rem;color:#f0cc6a">'+g.qtd+'d'+g.faces+'</span>'
      +'<button type="button" onclick="skFBRemoverDado('+g.faces+')" style="background:none;border:none;color:#f0cc6a88;cursor:pointer;font-size:1rem;padding:0 0 0 2px;line-height:1">−</button></div>';
    return '<div style="display:flex;align-items:center;gap:3px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:20px;padding:2px 9px">'
      +'<span style="font-family:var(--fonte-d);font-size:0.82rem;color:#7ec8f0">'+(g.valor>=0?'+':'')+g.valor+'</span>'
      +'<button type="button" onclick="SK_FB=SK_FB.filter(function(x){return x.tipo!==\'bonus\';});skFBAtualizarUI()" style="background:none;border:none;color:#7ec8f088;cursor:pointer;font-size:1rem;padding:0 0 0 2px;line-height:1">−</button></div>';
  }).join('');
}
function skFBCarregarFormula(formula) {
  SK_FB = [];
  if (!formula) { skFBAtualizarUI(); return; }
  const partes = formula.replace(/ /g,'').split(/(?=[+\-])/);
  for (const p of partes) {
    const dado = p.match(/([+-]?\d+)d(\d+)/i);
    if (dado) SK_FB.push({ tipo:'dado', faces:parseInt(dado[2]), qtd:Math.abs(parseInt(dado[1]))||1 });
    else { const b=parseInt(p); if(!isNaN(b)&&b!==0) SK_FB.push({tipo:'bonus',valor:b}); }
  }
  skFBAtualizarUI();
}
function skPopularAtributos() {
  const sel = document.getElementById('sk-atributo-base');
  if (!sel) return;
  const atual = sel.value;
  const defs = RPG_DATA?.attrDefs || [];
  const catLabel = {basico:'🔷',especial:'✨',status:'📊',resistencia:'🛡'};
  sel.innerHTML = '<option value="">— Nenhum —</option>'
    + defs.filter(a=>a.tipo==='number').map(a=>`<option value="${a.nome}"${a.nome===atual?' selected':''}>${catLabel[a.categoria]||'🔷'} ${a.nome}</option>`).join('');
}

// ── 14C: SKILLS ───────────────────────────────────────────────
function abrirModalSkill(skillId, personagemNome) {
  const overlay = document.getElementById('modal-skill-overlay');
  document.getElementById('modal-skill-id').value = skillId || '';
  if (skillId) {
    const s = RPG_DATA.skills.find(x => x.id === skillId);
    if (!s) return;
    _skModalCharId = s.character_id || _skCharId(s.personagem);
    document.getElementById('modal-skill-titulo').textContent = 'Editar Habilidade';
    document.getElementById('modal-skill-personagem').value = s.personagem;
    document.getElementById('sk-habilidade').value = s.habilidade || '';
    document.getElementById('sk-custo').value = s.custo_rsv || '';
    document.getElementById('sk-efeito').value = s.efeito || '';
    skFBCarregarFormula(s.formula_dano || ''); skPopularAtributos();
    document.getElementById('sk-cooldown').value        = s.cooldown_turnos || 0;
    document.getElementById('sk-tipo-dano').value       = s.tipo_dano || 'fisico';
    document.getElementById('sk-alcance').value         = s.alcance_celulas != null ? s.alcance_celulas : '';
    document.getElementById('sk-atributo-base').value   = s.atributo_base || '';
    document.getElementById('sk-mod-atributo-pct').value = s.mod_atributo_pct != null ? s.mod_atributo_pct : '';
    document.getElementById('sk-alvo-tipo').value       = s.alvo_tipo || 'inimigo';
    skAlvoTipoChange();
    document.getElementById('sk-crit-pos').value        = s.critico_positivo || '';
    document.getElementById('sk-crit-neg').value        = s.critico_negativo || '';
    SK_EFEITOS_TEMP = Array.isArray(s.efeitos_bonus) ? JSON.parse(JSON.stringify(s.efeitos_bonus)) : [];
    skRenderEfeitosLista();
    // Tipo dano + campos de invocação
    skTipoDanoChange();
    const invNome = s.invocar_nome || (SK_EFEITOS_TEMP.find(e=>e.tipo==='invocacao')?.invocar_nome || '');
    const invDur  = s.invocar_duracao_turnos ?? (SK_EFEITOS_TEMP.find(e=>e.tipo==='invocacao')?.invocar_duracao_turnos ?? 0);
    const invNomeEl = document.getElementById('sk-invocar-nome');
    const invDurEl  = document.getElementById('sk-invocar-duracao');
    if (invNomeEl) invNomeEl.value = invNome;
    if (invDurEl)  invDurEl.value  = invDur;
    skRenderEfeitosLista();
    // Animação
    const anim = s.animacao || {};
    document.getElementById('sk-anim-tipo').value   = anim.tipo  || 'nenhuma';
    document.getElementById('sk-anim-cor').value    = anim.cor   || '#e74c3c';
    document.getElementById('sk-anim-icone').value  = anim.icone || '';
    document.getElementById('sk-anim-trilha').checked = !!anim.trilha;
    document.getElementById('sk-anim-url').value      = anim.url  || '';
    document.getElementById('sk-anim-svg-code').value = anim.svg  || '';
    document.getElementById('sk-anim-tamanho').value  = anim.tamanho  || 120;
    document.getElementById('sk-anim-duracao').value  = anim.duracao  || 1500;
    document.getElementById('sk-anim-repeticao').value = anim.repeticao || 1;
    document.getElementById('sk-anim-duracao-canvas').value = anim.duracao || 600;
    document.getElementById('sk-anim-repeticao-canvas').value = anim.repeticao || 1;
    document.getElementById('sk-anim-posicao').value  = anim.posicao  || 'alvo';
    skAnimTipoChange();
    // Habilidade reativa
    _skCarregarCamposReativos(s);
  } else {
    _skModalCharId = _skCharId(personagemNome || CHAR_VIEW);
    document.getElementById('modal-skill-titulo').textContent = 'Nova Habilidade';
    document.getElementById('modal-skill-personagem').value = personagemNome || CHAR_VIEW || '';
    document.getElementById('sk-habilidade').value       = '';
    document.getElementById('sk-custo').value            = '';
    document.getElementById('sk-efeito').value           = '';
    skFBLimpar(); skPopularAtributos();
    document.getElementById('sk-cooldown').value         = 0;
    document.getElementById('sk-tipo-dano').value        = 'fisico';
    document.getElementById('sk-alcance').value          = '';
    document.getElementById('sk-atributo-base').value    = '';
    document.getElementById('sk-mod-atributo-pct').value = '';
    document.getElementById('sk-alvo-tipo').value        = 'inimigo';
    skAlvoTipoChange();
    document.getElementById('sk-crit-pos').value         = '';
    document.getElementById('sk-crit-neg').value         = '';
    SK_EFEITOS_TEMP = [];
    skRenderEfeitosLista();
    // Tipo dano + campos de invocação
    skTipoDanoChange();
    const invNomeElN = document.getElementById('sk-invocar-nome');
    const invDurElN  = document.getElementById('sk-invocar-duracao');
    if (invNomeElN) invNomeElN.value = '';
    if (invDurElN)  invDurElN.value  = '0';
    // Habilidade reativa (nova habilidade — limpar)
    _skCarregarCamposReativos(null);
    // Animação
    document.getElementById('sk-anim-tipo').value    = 'nenhuma';
    document.getElementById('sk-anim-cor').value     = '#e74c3c';
    document.getElementById('sk-anim-icone').value   = '';
    document.getElementById('sk-anim-trilha').checked = false;
    document.getElementById('sk-anim-url').value      = '';
    document.getElementById('sk-anim-svg-code').value = '';
    document.getElementById('sk-anim-tamanho').value  = 120;
    document.getElementById('sk-anim-duracao').value  = 1500;
    document.getElementById('sk-anim-repeticao').value = 1;
    document.getElementById('sk-anim-duracao-canvas').value = 600;
    document.getElementById('sk-anim-repeticao-canvas').value = 1;
    document.getElementById('sk-anim-posicao').value  = 'alvo';
    skAnimTipoChange();
    // Habilidade reativa — limpar
    _skCarregarCamposReativos(null);
  }
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalSkill(); };
  // Aplicar limites de duração conforme papel
  const _isMestre = RPG_DATA?.myRole === 'mestre';
  const _maxDur = _isMestre ? 10000 : 3000;
  ['sk-anim-duracao','sk-anim-duracao-canvas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.max = _maxDur; if (parseInt(el.value) > _maxDur) el.value = _maxDur; }
  });
  skAnimValidarDuracao();
}
function fecharModalSkill() {
  document.getElementById('modal-skill-overlay').style.display = 'none';
}

function skTipoHabilidadeChange() {
  const tipo = document.getElementById('sk-tipo-habilidade')?.value || 'acao';
  const ehReativo = tipo !== 'acao';
  const ehInterrupt = tipo === 'interrupt' || tipo === 'reaction' || tipo === 'free_action';
  const ehPassiva = tipo === 'passive';
  const gatilhoWrap = document.getElementById('sk-gatilho-wrap');
  const momentoWrap = document.getElementById('sk-momento-wrap');
  const autoWrap    = document.getElementById('sk-auto-trigger-wrap');
  if (gatilhoWrap) gatilhoWrap.style.display = ehReativo ? '' : 'none';
  if (momentoWrap) momentoWrap.style.display = ehInterrupt ? '' : 'none';
  if (autoWrap)    autoWrap.style.display    = ehPassiva   ? '' : 'none';
}

async function salvarSkill() {
  const skillId = document.getElementById('modal-skill-id').value;
  const personagem = document.getElementById('modal-skill-personagem').value;
  if (!podeEditarPersonagem(personagem)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
  const habilidade = document.getElementById('sk-habilidade').value.trim();
  if (!habilidade) { mostrarToast('Nome da habilidade obrigatório', 'erro'); return; }
  const body = {
    rpg_id: RPG_DATA.rpgId,
    personagem,
    character_id: _skModalCharId || _skCharId(personagem),
    habilidade,
    custo_rsv:        document.getElementById('sk-custo').value.trim() || null,
    efeito:           document.getElementById('sk-efeito').value.trim(),
    formula_dano:     document.getElementById('sk-formula').value.trim() || null,
    cooldown_turnos:  parseInt(document.getElementById('sk-cooldown').value) || 0,
    tipo_dano:        document.getElementById('sk-tipo-dano').value || 'fisico',
    alcance_celulas:  document.getElementById('sk-alcance').value !== '' ? parseInt(document.getElementById('sk-alcance').value) : null,
    atributo_base:    document.getElementById('sk-atributo-base').value.trim() || null,
    mod_atributo_pct: document.getElementById('sk-mod-atributo-pct').value !== ''
                        ? parseFloat(document.getElementById('sk-mod-atributo-pct').value) : null,
    alvo_tipo:        document.getElementById('sk-alvo-tipo').value || 'inimigo',
    efeitos_bonus:    SK_EFEITOS_TEMP.length ? SK_EFEITOS_TEMP : null,
    critico_positivo: document.getElementById('sk-crit-pos').value.trim() || null,
    critico_negativo: document.getElementById('sk-crit-neg').value.trim() || null,
    // Invocação
    invocar_nome:          document.getElementById('sk-invocar-nome')?.value.trim() || null,
    invocar_duracao_turnos: parseInt(document.getElementById('sk-invocar-duracao')?.value) || 0,
    // Habilidade reativa / passiva (UI: sk-tipo-reativa; DB: tipo_habilidade)
    tipo_habilidade:   document.getElementById('sk-tipo-reativa')?.value || 'acao',
    gatilho_tipo:      document.getElementById('sk-gatilho-tipo')?.value || null,
    gatilho_descricao: document.getElementById('sk-gatilho-condicoes')?.value.trim() || null,
    custo_reativa:     document.getElementById('sk-custo-reativa')?.value || null,
    momento:           document.getElementById('sk-momento-reativa')?.value || 'after',
    auto_trigger:             !!(document.getElementById('sk-auto-reativa')?.checked),
    movimento_bonus_cancelar: parseInt(document.getElementById('sk-mov-bonus-cancelar')?.value) || 0,
  };
  // Animação (omite se tipo=nenhuma)
  const animTipo = document.getElementById('sk-anim-tipo').value;
  if (animTipo && animTipo !== 'nenhuma') {
    const _isMidia = ['gif','imagem','svg','iframe'].includes(animTipo);
    const _isCanvas = ['projetil','onda','explosao','raio','aura'].includes(animTipo);
    const _isMestre = RPG_DATA?.myRole === 'mestre';
    const _maxTotal = _isMestre ? 10000 : 3000;

    if (_isMidia) {
      const dur = parseInt(document.getElementById('sk-anim-duracao').value) || 1500;
      const rep = parseInt(document.getElementById('sk-anim-repeticao').value) || 1;
      const total = dur * rep;
      if (total > _maxTotal) {
        mostrarToast(`Duração total (${total}ms) excede o limite de ${_maxTotal}ms`, 'erro'); return;
      }
    }
    if (_isCanvas) {
      const dur = parseInt(document.getElementById('sk-anim-duracao-canvas').value) || 600;
      const rep = parseInt(document.getElementById('sk-anim-repeticao-canvas').value) || 1;
      const total = dur * rep;
      if (total > _maxTotal) {
        mostrarToast(`Duração total (${total}ms) excede o limite de ${_maxTotal}ms`, 'erro'); return;
      }
    }

    body.animacao = {
      tipo:      animTipo,
      cor:       !_isMidia ? (document.getElementById('sk-anim-cor').value  || '#e74c3c') : undefined,
      icone:     !_isMidia ? (document.getElementById('sk-anim-icone').value.trim() || '') : undefined,
      trilha:    _isCanvas ? document.getElementById('sk-anim-trilha').checked : undefined,
      duracao:   _isMidia ? (parseInt(document.getElementById('sk-anim-duracao').value) || 1500)
               : _isCanvas ? (parseInt(document.getElementById('sk-anim-duracao-canvas').value) || 600) : undefined,
      repeticao: _isMidia ? (parseInt(document.getElementById('sk-anim-repeticao').value) || 1)
               : _isCanvas ? (parseInt(document.getElementById('sk-anim-repeticao-canvas').value) || 1) : undefined,
      url:       _isMidia && animTipo !== 'svg' ? document.getElementById('sk-anim-url').value.trim() : undefined,
      svg:       animTipo === 'svg' ? document.getElementById('sk-anim-svg-code').value.trim() : undefined,
      tamanho:   _isMidia ? (parseInt(document.getElementById('sk-anim-tamanho').value) || 120) : undefined,
      posicao:   _isMidia ? (document.getElementById('sk-anim-posicao').value || 'alvo') : undefined,
    };
    // Limpar campos undefined
    Object.keys(body.animacao).forEach(k => body.animacao[k] === undefined && delete body.animacao[k]);
  } else {
    body.animacao = null;
  }
  try {
    if (skillId) {
      await sb(`skills?id=eq.${encodeURIComponent(skillId)}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = RPG_DATA.skills.findIndex(s => s.id == skillId);
      if (idx >= 0) RPG_DATA.skills[idx] = { ...RPG_DATA.skills[idx], ...body };
    } else {
      const [nova] = await sb('skills', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
      RPG_DATA.skills.push(nova || body);
    }
    fecharModalSkill();
    if (CHAR_VIEW === personagem) renderCharView(personagem);
    mostrarToast('Habilidade salva!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar habilidade', 'erro'); }
}
async function removerSkill(skillId, nome, personagem) {
  if (!podeEditarPersonagem(personagem)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
  if (!confirm(`Remover habilidade "${nome}"?`)) return;
  try {
    await sb(`skills?id=eq.${encodeURIComponent(skillId)}`, { method: 'DELETE' });
    RPG_DATA.skills = RPG_DATA.skills.filter(s => s.id != skillId);
    if (CHAR_VIEW === personagem) renderCharView(personagem);
    mostrarToast('Habilidade removida', 'sucesso');
  } catch(e) { mostrarToast('Erro ao remover', 'erro'); }
}

// ─── CAMPOS DE HABILIDADE REATIVA ────────────────────────────────────────────

function _skCarregarCamposReativos(s) {
  const tipoEl    = document.getElementById('sk-tipo-reativa');
  const extra     = document.getElementById('sk-reativa-extra');
  const gatilhoEl = document.getElementById('sk-gatilho-tipo');
  const condEl    = document.getElementById('sk-gatilho-condicoes');
  const custoEl   = document.getElementById('sk-custo-reativa');
  const momentoEl = document.getElementById('sk-momento-reativa');
  const autoEl    = document.getElementById('sk-auto-reativa');

  if (!tipoEl) return;

  const tipo    = s?.tipo_habilidade || '';
  tipoEl.value  = tipo;
  if (gatilhoEl) gatilhoEl.value  = s?.gatilho_tipo || 'ser_atacado';
  if (condEl)    condEl.value     = s?.gatilho_descricao || '';
  if (custoEl)   custoEl.value    = s?.custo_reativa || 'reaction';
  if (momentoEl) momentoEl.value  = s?.momento || 'after';
  if (autoEl)    autoEl.checked   = s?.auto_trigger ?? (tipo === 'passive');
  const movBonusEl = document.getElementById('sk-mov-bonus-cancelar');
  if (movBonusEl) movBonusEl.value = s?.movimento_bonus_cancelar ?? 0;

  if (extra) extra.style.display = tipo ? 'block' : 'none';

  // Fechar seção ao limpar
  const fields = document.getElementById('sk-reativa-fields');
  if (fields && !tipo) fields.style.display = 'none';
  const chevron = document.getElementById('sk-reativa-chevron');
  if (chevron) chevron.textContent = fields?.style.display !== 'none' ? '▼' : '▶';
}

function skTipoReativaChange() {
  const tipo  = document.getElementById('sk-tipo-reativa')?.value || '';
  const extra = document.getElementById('sk-reativa-extra');
  if (extra) extra.style.display = tipo ? 'block' : 'none';

  // Se passiva → marcar auto automaticamente
  const autoEl = document.getElementById('sk-auto-reativa');
  if (autoEl && tipo === 'passive') autoEl.checked = true;

  // Se interrupt → forçar momento "before"
  const momentoEl = document.getElementById('sk-momento-reativa');
  if (momentoEl && tipo === 'interrupt') momentoEl.value = 'before';
}

function skToggleReativaSection() {
  const fields  = document.getElementById('sk-reativa-fields');
  const chevron = document.getElementById('sk-reativa-chevron');
  if (!fields) return;
  const aberto = fields.style.display !== 'none';
  fields.style.display = aberto ? 'none' : 'block';
  if (chevron) chevron.textContent = aberto ? '▶' : '▼';
}
