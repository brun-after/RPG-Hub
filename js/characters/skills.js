// characters/skills.js
// RPG Hub — Skill and data management: skill CRUD, formula builder, lore CRUD, map creation
// Includes: abrirModalSkill(), SK_FB formula builder, abrirModalLore(), abrirModalNovoMapa()

// ══════════════════════════════════════════════════════════════
// GERENCIAMENTO DE DADOS — Edição inline de personagens, habilidades, lore e mapas
// ══════════════════════════════════════════════════════════════

// ── 14B: NOVO PERSONAGEM ──────────────────────────────────────
function abrirModalNovoChar() {
  document.getElementById('nc-nome').value = '';
  document.getElementById('nc-tipo').value = 'jogador';
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  document.getElementById('nc-nivel').value = 1;
  document.getElementById('nc-hp').value = hp_base;
  document.getElementById('nc-classe').value = '';
  document.getElementById('nc-raca').value = '';
  document.getElementById('nc-cor').value = '#4fa3d1';
  const overlay = document.getElementById('modal-novo-char-overlay');
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalNovoChar(); };
}
function fecharModalNovoChar() {
  document.getElementById('modal-novo-char-overlay').style.display = 'none';
}
async function criarNovoPersonagem() {
  const nome = document.getElementById('nc-nome').value.trim();
  if (!nome) { mostrarToast('Nome obrigatório', 'erro'); return; }
  if (RPG_DATA.characters.find(c => c.nome === nome)) { mostrarToast('Já existe um personagem com esse nome', 'erro'); return; }
  const tipo = document.getElementById('nc-tipo').value;
  const nivel = parseInt(document.getElementById('nc-nivel')?.value)||1;
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  const hp_por_nivel=lc.hp_por_nivel||0;
  const hp_max=hp_base+(nivel-1)*hp_por_nivel;
  const hp_max_override=+(document.getElementById('nc-hp').value)||hp_max;
  const cor = document.getElementById('nc-cor').value || '#4fa3d1';
  const classe = document.getElementById('nc-classe').value.trim();
  const raca = document.getElementById('nc-raca').value.trim();
  const ca = { tipo, cor, nivel, hp_max:hp_max_override, xp:0, pontos_attr:0 };
  if (classe) ca.classe = classe;
  if (raca) ca.raca = raca;
  if (tipo === 'npc') ca.tipo_personagem = 'npc';
  if (tipo === 'npc' || tipo === 'criatura') {
    const factionNew = document.getElementById('nc-faction')?.value || 'inimigo';
    ca.npc_faction = factionNew;
  }
  try {
    const [novo] = await sb('characters', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        rpg_id: RPG_DATA.rpgId, nome, hp_atual: hp_max_override, custom_attrs: ca,
        nivel: nivel, hp_max: hp_max_override, xp: 0, pontos_attr: 0
      })
    });
    RPG_DATA.characters.push(novo || { nome, hp_atual: hp_max_override, custom_attrs: ca });
    fecharModalNovoChar();
    renderCharButtons();
    renderAttrButtons();
    renderConfig();
    mostrarToast(`${nome} criado!`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao criar personagem', 'erro'); }
}

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
function skFBAdicionarBonus() {
  const val = parseInt(prompt('Bônus fixo (ex: 3):') || '0');
  if (!val) return;
  const ex = SK_FB.find(g => g.tipo === 'bonus');
  if (ex) ex.valor += val;
  else SK_FB.push({ tipo: 'bonus', valor: val });
  skFBAtualizarUI();
}
function skFBLimpar() { SK_FB = []; skFBAtualizarUI(); }
function skFBAtualizarUI() {
  const chips = document.getElementById('sk-fb-chips');
  const prev  = document.getElementById('sk-fb-preview');
  const hid   = document.getElementById('sk-formula');
  const formula = typeof formulaDeGrupos === 'function'
    ? formulaDeGrupos(SK_FB)
    : SK_FB.map(g => g.tipo === 'dado' ? g.qtd+'d'+g.faces : (g.valor>=0?'+':'')+g.valor).join('');
  if (hid)  hid.value = formula;
  if (prev) prev.textContent = formula || '—';
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

// ── 14D: LORE ────────────────────────────────────────────────
function abrirModalLore(loreId) {
  const overlay = document.getElementById('modal-lore-overlay');
  document.getElementById('modal-lore-id').value = loreId || '';
  if (loreId) {
    const l = RPG_DATA.lore.find(x => x.id === loreId);
    if (!l) return;
    document.getElementById('modal-lore-titulo').textContent = 'Editar Lore';
    document.getElementById('lore-titulo-input').value = l.titulo || '';
    document.getElementById('lore-secao-input').value = l.secao || '';
    document.getElementById('lore-conteudo-input').value = l.conteudo || '';
  } else {
    document.getElementById('modal-lore-titulo').textContent = 'Nova Entrada de Lore';
    document.getElementById('lore-titulo-input').value = '';
    document.getElementById('lore-secao-input').value = '';
    document.getElementById('lore-conteudo-input').value = '';
  }
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalLore(); };
}
function fecharModalLore() {
  document.getElementById('modal-lore-overlay').style.display = 'none';
}
async function salvarLore() {
  if (!temPermissao('editar_lore')) { mostrarToast('Sem permissão para editar Lore', 'erro'); return; }
  const loreId = document.getElementById('modal-lore-id').value;
  const titulo = document.getElementById('lore-titulo-input').value.trim();
  const secao = document.getElementById('lore-secao-input').value.trim() || 'mundo';
  const conteudo = document.getElementById('lore-conteudo-input').value.trim();
  if (!titulo) { mostrarToast('Título obrigatório', 'erro'); return; }
  const body = { rpg_id: RPG_DATA.rpgId, titulo, secao, conteudo };
  try {
    if (loreId) {
      await sb(`lore?id=eq.${encodeURIComponent(loreId)}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = RPG_DATA.lore.findIndex(l => l.id == loreId);
      if (idx >= 0) RPG_DATA.lore[idx] = { ...RPG_DATA.lore[idx], ...body };
    } else {
      const [novo] = await sb('lore', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
      RPG_DATA.lore.push(novo || body);
    }
    fecharModalLore();
    renderLore();
    mostrarToast('Lore salvo!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar lore', 'erro'); }
}
async function removerLore(loreId, titulo) {
  if (!temPermissao('editar_lore')) { mostrarToast('Sem permissão para editar Lore', 'erro'); return; }
  if (!confirm(`Remover "${titulo}"?`)) return;
  try {
    await sb(`lore?id=eq.${encodeURIComponent(loreId)}`, { method: 'DELETE' });
    RPG_DATA.lore = RPG_DATA.lore.filter(l => l.id != loreId);
    renderLore();
    mostrarToast('Entrada removida', 'sucesso');
  } catch(e) { mostrarToast('Erro ao remover lore', 'erro'); }
}

// ── 14F: MAPAS — Criar novo ───────────────────────────────────
function abrirModalNovoMapa() {
  document.getElementById('nm-id').value = '';
  document.getElementById('nm-nome').value = '';
  document.getElementById('nm-img').value = '';
  document.getElementById('nm-img-preview').style.display = 'none';
  document.getElementById('nm-escala-val').value = 1;
  document.getElementById('nm-escala-unit').value = 'm';
  document.getElementById('nm-grid').value = 20;
  document.getElementById('nm-larg-real').value = '';
  document.getElementById('nm-alt-real').value = '';
  document.getElementById('nm-repr-pct').value = 100;
  document.getElementById('nm-preview-calc').style.display = 'none';
  document.getElementById('nm-fallback-pct').style.display = 'none';
  // Resetar aba de fundo
  nmBgTab('url');
  nmBgClearUpload();
  const svgInput = document.getElementById('nm-svg-input');
  if (svgInput) svgInput.value = '';
  const svgCtxInput = document.getElementById('nm-svg-ctx-input');
  if (svgCtxInput) svgCtxInput.value = '';
  const svgPrev = document.getElementById('nm-svg-preview-wrap');
  if (svgPrev) svgPrev.style.display = 'none';
  const svgWarn = document.getElementById('nm-svg-warn');
  if (svgWarn) svgWarn.style.display = 'none';
  // Canvas: limpar
  nmCE._uploadDataUrl = null;
  setTimeout(() => { const c = document.getElementById('nmce-canvas'); if(c) { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); nmCE.history=[]; nmCE.drawing=false; nmceBgRender(); } }, 50);

  // Se já estamos dentro de um mapa, pré-selecionar tipo tático
  const mapaAtualEntry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
  const tipoDefault = mapaAtualEntry ? 'tatico' : 'geral';
  document.getElementById('nm-tipo').value = tipoDefault;

  // Atualizar labels de unidade
  const unit = mapaAtualEntry?.mapa?.escala_unit || 'm';
  const lbl1 = document.getElementById('nm-unit-lbl1');
  const lbl2 = document.getElementById('nm-unit-lbl2');
  if (lbl1) lbl1.textContent = `(${unit})`;
  if (lbl2) lbl2.textContent = `(${unit})`;

  // Popula seletor de pai filtrado por tipo e controla visibilidade
  nmTipoChange(tipoDefault);

  // Pré-selecionar mapa atual no seletor de pai (se disponível para o tipo)
  if (MAPA_STATE.mapaAtualId) {
    const sel = document.getElementById('nm-parent');
    if (sel && [...sel.options].some(o => o.value === MAPA_STATE.mapaAtualId)) {
      sel.value = MAPA_STATE.mapaAtualId;
      nmParentChange(MAPA_STATE.mapaAtualId);
    }
  }

  const overlay = document.getElementById('modal-novo-mapa-overlay');
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalNovoMapa(); };
  // Fechar com Escape
  overlay._escHandler = (e) => { if (e.key === 'Escape') { fecharModalNovoMapa(); document.removeEventListener('keydown', overlay._escHandler); } };
  document.addEventListener('keydown', overlay._escHandler);
}

function nmTipoChange(tipo) {
  const todosMaps = (RPG_DATA?.mapas || []);
  // Geral pode estar dentro de outro geral; local pode estar dentro de qualquer mapa
  const parentOpts = tipo === 'geral'
    ? todosMaps.filter(l => l.mapa.tipo === 'geral')
    : todosMaps;
  const sel = document.getElementById('nm-parent');
  if (sel) {
    sel.innerHTML = parentOpts.length
      ? parentOpts.map(l => {
          const icon = l.mapa.tipo === 'geral' ? '🌍' : '🏰';
          return `<option value="${l.mapa.map_id}">${icon} ${l.mapa.nome}</option>`;
        }).join('')
      : '<option value="">— Nenhum mapa disponível —</option>';
  }
  // Exibir seção pai se houver mapas válidos para o tipo selecionado
  const parentEl = document.getElementById('nm-local-opts');
  if (parentEl) parentEl.style.display = parentOpts.length ? 'block' : 'none';
  if (parentOpts.length && sel?.value) nmParentChange(sel.value);
  // Atualiza grade guia ISO e nota no canvas editor
  nmceUpdateIsoGuide();
}

// Chamado quando o usuário muda o mapa pai no modal de criação
function nmParentChange(paiId) {
  const paiEntry = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===paiId);
  const temDims  = paiEntry?.mapa?.largura_total && paiEntry?.mapa?.altura_total;
  document.getElementById('nm-fallback-pct').style.display = temDims ? 'none' : 'block';
  // Atualizar unidade no label
  const unit = paiEntry?.mapa?.escala_unit || 'm';
  const lbl1 = document.getElementById('nm-unit-lbl1');
  const lbl2 = document.getElementById('nm-unit-lbl2');
  if (lbl1) lbl1.textContent = `(${unit})`;
  if (lbl2) lbl2.textContent = `(${unit})`;
  nmAtualizarPreview();
}

// Preview de cálculo no modal de criação
function nmAtualizarPreview() {
  const largReal = parseFloat(document.getElementById('nm-larg-real')?.value);
  const altReal  = parseFloat(document.getElementById('nm-alt-real')?.value);
  const reprPct  = parseFloat(document.getElementById('nm-repr-pct')?.value) || 100;
  const paiId    = document.getElementById('nm-parent')?.value;
  const paiEntry = paiId ? (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===paiId) : null;
  const paiLarg  = paiEntry?.mapa?.largura_total;
  const paiAlt   = paiEntry?.mapa?.altura_total;
  const unit     = paiEntry?.mapa?.escala_unit || 'm';
  const preview  = document.getElementById('nm-preview-calc');
  if (!preview) return;
  if (largReal && paiLarg) {
    const dispW = (largReal * reprPct / 100).toFixed(1);
    const pctW  = (dispW / paiLarg * 100).toFixed(1);
    const dispH = altReal ? (altReal * reprPct / 100).toFixed(1) : '—';
    const pctH  = (altReal && paiAlt) ? (dispH / paiAlt * 100).toFixed(1) + '%' : '—';
    preview.style.display = 'block';
    preview.innerHTML = `📐 Exibido como <strong>${dispW}${unit} × ${dispH}${unit}</strong> — ocupa ~<strong>${pctW}%</strong> × ${pctH} do mapa pai.`;
  } else if (largReal) {
    const dispW = (largReal * reprPct / 100).toFixed(1);
    preview.style.display = 'block';
    preview.innerHTML = `📐 Exibido como <strong>${dispW}${unit}</strong> de largura. Defina as dimensões do mapa pai para calcular % automaticamente.`;
  } else {
    preview.style.display = 'none';
  }
}
function fecharModalNovoMapa() {
  document.getElementById('modal-novo-mapa-overlay').style.display = 'none';
  const overlay = document.getElementById('modal-novo-mapa-overlay');
  if (overlay._escHandler) { document.removeEventListener('keydown', overlay._escHandler); overlay._escHandler = null; }
}
async function criarNovoMapa() {
  if (!RPG_DATA?.rpgId) { mostrarToast('Nenhuma campanha ativa', 'erro'); return; }

  const map_id = (document.getElementById('nm-id')?.value || '').trim().replace(/\s+/g,'_');
  const nome   = (document.getElementById('nm-nome')?.value || '').trim();
  const tipo   = document.getElementById('nm-tipo')?.value || 'geral';
  if (!map_id || !nome) { mostrarToast('ID e nome são obrigatórios', 'erro'); return; }
  if ((RPG_DATA.mapas||[]).find(l => l.mapa.map_id === map_id)) { mostrarToast('Já existe um mapa com esse ID', 'erro'); return; }

  const _parentOptsVisible = document.getElementById('nm-local-opts')?.style.display !== 'none';
  const parentId = _parentOptsVisible ? (document.getElementById('nm-parent')?.value || null) : null;

  let zonaW = 15, zonaH = 15;
  let largReal = null, altReal = null, reprPct = 100;

  if (parentId) {
    largReal = parseFloat(document.getElementById('nm-larg-real')?.value) || null;
    altReal  = parseFloat(document.getElementById('nm-alt-real')?.value)  || null;
    reprPct  = parseFloat(document.getElementById('nm-repr-pct')?.value)  || 100;
    const paiEntry = (RPG_DATA.mapas||[]).find(l=>l.mapa.map_id===parentId);
    const paiLarg  = paiEntry?.mapa?.largura_total;
    const paiAlt   = paiEntry?.mapa?.altura_total;
    if (largReal && paiLarg) {
      zonaW = parseFloat(((largReal * reprPct / 100) / paiLarg * 100).toFixed(2));
    } else {
      zonaW = parseFloat(document.getElementById('nm-zona-w')?.value) || 15;
    }
    if (altReal && paiAlt) {
      zonaH = parseFloat(((altReal * reprPct / 100) / paiAlt * 100).toFixed(2));
    } else {
      zonaH = parseFloat(document.getElementById('nm-zona-h')?.value) || zonaW * 0.75;
    }
  }

  // Obter imagem de fundo — proteger contra erros no canvas
  let img_url = '';
  try { img_url = nmBgGetFinal() || ''; } catch(e) { img_url = ''; }

  const escala_val  = parseFloat(document.getElementById('nm-escala-val')?.value) || 1;
  const escala_unit = (document.getElementById('nm-escala-unit')?.value || 'm').trim();
  const grid        = parseInt(document.getElementById('nm-grid')?.value) || 20;

  const mapaObj = {
    map_id, nome, tipo, img_url, escala_val, escala_unit, grid,
    locais: [],
    parent_map_id:   parentId,
    zona_w_percent:  zonaW,
    zona_h_percent:  zonaH,
    largura_real:    largReal,
    altura_real:     altReal,
    representar_pct: reprPct,
  };

  // Desabilitar botão durante envio
  const btnCriar = document.querySelector('#modal-novo-mapa-overlay .btn-primario');
  if (btnCriar) { btnCriar.disabled = true; btnCriar.textContent = 'Criando…'; }

  try {
    const payload = {
      rpg_id:          RPG_DATA.rpgId,
      map_id, nome, tipo,
      img_url,
      escala_val,
      escala_unit,
      grid,
      parent_map_id:   parentId || null,
      zona_w_percent:  zonaW,
      zona_h_percent:  zonaH,
      largura_real:    largReal || null,
      altura_real:     altReal  || null,
      representar_pct: reprPct  || null,
      locais:          [],
      render_data:     { paredes: [], portas: [], objetos: [] },
    };

    const resultado = await sb('mapas', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify(payload)
    });

    // sb retorna array ou null
    const row = Array.isArray(resultado) ? resultado[0] : resultado;
    const entry = { id: row?.id || null, rpg_id: RPG_DATA.rpgId, mapa: mapaObj };
    if (!RPG_DATA.mapas) RPG_DATA.mapas = [];
    // Evitar duplicata se realtime já inseriu
    if (!RPG_DATA.mapas.find(l => l.mapa.map_id === map_id)) {
      RPG_DATA.mapas.push(entry);
    }
    fecharModalNovoMapa();
    renderMapasTab();
    mostrarToast(`Mapa "${nome}" criado!`, 'sucesso');


    if (parentId) {
      selecionarMapa(parentId);
      ativarModoPlacement(map_id, nome, zonaW, zonaH);
    } else {
      selecionarMapa(map_id);
    }
  } catch(e) {
    console.error('criarNovoMapa erro:', e);
    mostrarToast('Erro ao criar mapa: ' + (e?.message || e), 'erro');
  } finally {
    if (btnCriar) { btnCriar.disabled = false; btnCriar.textContent = 'Criar Mapa'; }
  }
}

// ── PLACEMENT MODE: posicionar mapa local no geral ───────────
let PLACEMENT_STATE = null;
