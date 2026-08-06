// characters/skills.js
// RPG Hub — Skill management: formula builder, skill CRUD
// Includes: SK_FB formula builder, abrirModalSkill(), salvarSkill(), removerSkill()
// Character creation moved to: js/characters/characters.js
// Lore CRUD moved to: js/systems/lore.js
// Map creation moved to: js/maps/maps.js

// ── SKILL FORMULA BUILDER ────────────────────────────────────
let SK_FB: any = [];

function skFBAdicionarDado(faces: any) {
  const ex = SK_FB.find((g: any) => g.tipo === 'dado' && g.faces === faces);
  if (ex) ex.qtd++;
  else SK_FB.push({ tipo: 'dado', faces, qtd: 1 });
  skFBAtualizarUI();
}
function skFBRemoverDado(faces: any) {
  const idx = SK_FB.findIndex((g: any) => g.tipo === 'dado' && g.faces === faces);
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
    const ex = SK_FB.find((g: any) => g.tipo === 'bonus');
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
    : SK_FB.map((g: any) => g.tipo === 'dado' ? g.qtd+'d'+g.faces : (g.valor>=0?'+':'')+g.valor).join('');
  if (hid)  hid.value = formula;
  if (prev) prev.textContent = formula || '—';
  if (range) {
    if (SK_FB.length) {
      let mn = 0, mx = 0, med = 0;
      SK_FB.forEach((g: any) => {
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
  chips.innerHTML = SK_FB.map((g: any) => {
    if (g.tipo === 'dado') return '<div style="display:flex;align-items:center;gap:3px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:20px;padding:2px 9px 2px 7px">'
      +'<span style="font-family:var(--fonte-d);font-size:0.82rem;color:#f0cc6a">'+g.qtd+'d'+g.faces+'</span>'
      +'<button type="button" onclick="skFBRemoverDado('+g.faces+')" style="background:none;border:none;color:#f0cc6a88;cursor:pointer;font-size:1rem;padding:0 0 0 2px;line-height:1">−</button></div>';
    return '<div style="display:flex;align-items:center;gap:3px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.25);border-radius:20px;padding:2px 9px">'
      +'<span style="font-family:var(--fonte-d);font-size:0.82rem;color:#7ec8f0">'+(g.valor>=0?'+':'')+g.valor+'</span>'
      +'<button type="button" onclick="SK_FB=SK_FB.filter(function(x){return x.tipo!==\'bonus\';});skFBAtualizarUI()" style="background:none;border:none;color:#7ec8f088;cursor:pointer;font-size:1rem;padding:0 0 0 2px;line-height:1">−</button></div>';
  }).join('');
}
function skFBCarregarFormula(formula: any) {
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
  const catLabel: Record<string, any> = {basico:'🔷',especial:'✨',status:'📊',resistencia:'🛡'};
  // Atributos liberados pelo mestre para escala de skills (padrão: só Inteligência).
  // Configurável no painel Balanceamento → level_config.skill_scaling_attrs.
  const _lc = (typeof AVT_STATE !== 'undefined' && AVT_STATE?.rpg?.theme_json?.level_config)
            || RPG_DATA?.rpg?.theme_json?.level_config || {};
  const liberados = _lc.skill_scaling_attrs;
  const _norm = (s: any) => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const permitidos = (Array.isArray(liberados) && liberados.length) ? liberados : ['Inteligência'];
  const permitidosNorm = new Set(permitidos.map(_norm));
  // Filtra atributos numéricos pelos liberados; sempre preserva o valor já salvo (atual),
  // mesmo que fora da lista — evita derrubar o scaling de skills antigas antes da migração.
  let opts = defs.filter(a => a.tipo === 'number' && (permitidosNorm.has(_norm(a.nome)) || a.nome === atual));
  if (atual && !opts.some(a => a.nome === atual) && !defs.some(a => a.nome === atual)) {
    opts = opts.concat([{ nome: atual, categoria: 'basico' } as any]);
  }
  sel.innerHTML = '<option value="">— Nenhum —</option>'
    + opts.map(a=>`<option value="${a.nome}"${a.nome===atual?' selected':''}>${catLabel[a.categoria]||'🔷'} ${a.nome}</option>`).join('');
}

// ── 14C: SKILLS ───────────────────────────────────────────────
function abrirModalSkill(skillId: any, personagemNome: any) {
  const overlay = document.getElementById('modal-skill-overlay');
  document.getElementById('modal-skill-id').value = skillId || '';
  if (skillId) {
    const s = RPG_DATA.skills.find(x => x.id === skillId);
    if (!s) return;
    _skModalCharId = s.character_id || _skCharId(s.personagem);
    document.getElementById('modal-skill-titulo').textContent = 'Editar Habilidade';
    document.getElementById('modal-skill-personagem').value = s.personagem;
    document.getElementById('sk-habilidade').value = s.habilidade || '';
    document.getElementById('sk-custo').value = (s.custo_rsv || '') as any;
    document.getElementById('sk-efeito').value = s.efeito || '';
    skFBCarregarFormula(s.formula_dano || ''); skPopularAtributos();
    document.getElementById('sk-cooldown').value        = (s.cooldown_turnos || 0) as any;
    document.getElementById('sk-tipo-dano').value       = s.tipo_dano || 'fisico';
    document.getElementById('sk-alcance').value         = (s.alcance_celulas != null ? s.alcance_celulas : '') as any;
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
    const invNome = s.invocar_nome || (SK_EFEITOS_TEMP.find((e: any)=>e.tipo==='invocacao')?.invocar_nome || '');
    const invDur  = s.invocar_duracao_turnos ?? (SK_EFEITOS_TEMP.find((e: any)=>e.tipo==='invocacao')?.invocar_duracao_turnos ?? 0);
    const invNomeEl = document.getElementById('sk-invocar-nome');
    const invDurEl  = document.getElementById('sk-invocar-duracao');
    if (invNomeEl) invNomeEl.value = invNome;
    if (invDurEl)  invDurEl.value  = invDur > 0 ? invDur : 3;
    // Campos expandidos de invocação (tipo_entidade e descricao são UI-only, não persistidos no DB)
    const invIlimEl = document.getElementById('sk-invocar-ilimitado');
    const ilimitado = invDur === 0;
    if (invIlimEl) invIlimEl.checked = ilimitado;
    if (typeof skInvocacaoIlimitadoChange === 'function') skInvocacaoIlimitadoChange();
    skRenderEfeitosLista();
    // Animação — Studio Pixi
    const psId = document.getElementById('sk-pixi-studio-id');
    const psNome = document.getElementById('sk-pixi-studio-nome');
    if (psId) psId.value = s.animacao?.pixi_studio_id || '';
    if (psNome) psNome.textContent = s.animacao?.pixi_studio_nome || 'Nenhuma selecionada';
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
    // GSAP
    const gc = anim.gsap_config || {};
    const gcPreset = document.getElementById('sk-anim-gsap-preset');
    if (gcPreset) gcPreset.value = gc.preset || 'impacto_shake';
    const gcCor = document.getElementById('sk-anim-gsap-cor');
    if (gcCor) gcCor.value = gc.cor || '#e74c3c';
    const gcDur = document.getElementById('sk-anim-gsap-duracao');
    if (gcDur) gcDur.value = gc.duracao || 800;
    const gcInt = document.getElementById('sk-anim-gsap-intensidade');
    if (gcInt) gcInt.value = gc.intensidade || 1.0;
    const gcAlvo = document.getElementById('sk-anim-gsap-alvo');
    if (gcAlvo) gcAlvo.value = gc.alvo_efeito || 'alvo';
    // Spine
    const scEl = document.getElementById('sk-anim-spine-json-config');
    if (scEl) scEl.value = anim.spine_config ? JSON.stringify(anim.spine_config, null, 2) : '';
    const scPos = document.getElementById('sk-anim-spine-posicao');
    if (scPos) scPos.value = anim.spine_config?.posicao || 'alvo';
    skAnimTipoChange();
    // Áudio
    _skPopularSelectSfx();
    _skAtualizarAutoSfx();
    const _audCfg = anim.audio || {};
    const _castSel = document.getElementById('sk-audio-cast-sel');
    const _impSel  = document.getElementById('sk-audio-impact-sel');
    const _castUrl = document.getElementById('sk-audio-cast-url');
    const _impUrl  = document.getElementById('sk-audio-impact-url');
    const _volEl   = document.getElementById('sk-audio-volume');
    const _volVal  = document.getElementById('sk-audio-volume-val');
    if (_castSel)  _castSel.value  = (!_audCfg.cast || _audCfg.cast.startsWith('http')) ? '' : (_audCfg.cast || '');
    if (_castUrl)  _castUrl.value  = (_audCfg.cast?.startsWith?.('http') ? _audCfg.cast : '');
    if (_impSel)   _impSel.value   = (!_audCfg.impact || _audCfg.impact.startsWith('http')) ? '' : (_audCfg.impact || '');
    if (_impUrl)   _impUrl.value   = (_audCfg.impact?.startsWith?.('http') ? _audCfg.impact : '');
    if (_volEl)  { _volEl.value = _audCfg.volume ?? 0.75; if (_volVal) _volVal.textContent = parseFloat(_volEl.value).toFixed(2); }
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
    document.getElementById('sk-cooldown').value         = (0) as any;
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
    const invTipoElN = document.getElementById('sk-invocar-tipo-entidade');
    const invIlimElN = document.getElementById('sk-invocar-ilimitado');
    const invDescElN = document.getElementById('sk-invocar-descricao');
    if (invNomeElN) invNomeElN.value = '';
    if (invDurElN)  invDurElN.value  = '3';
    if (invTipoElN) invTipoElN.value = 'criatura';
    if (invIlimElN) invIlimElN.checked = false;
    if (invDescElN) invDescElN.value = '';
    if (typeof skInvocacaoIlimitadoChange === 'function') skInvocacaoIlimitadoChange();
    // Habilidade reativa (nova habilidade — limpar)
    _skCarregarCamposReativos(null);
    // Animação — limpar Studio Pixi
    const _psIdEl = document.getElementById('sk-pixi-studio-id');
    const _psNmEl = document.getElementById('sk-pixi-studio-nome');
    if (_psIdEl) _psIdEl.value = '';
    if (_psNmEl) _psNmEl.textContent = 'Nenhuma selecionada';
    // Animação
    document.getElementById('sk-anim-tipo').value    = 'nenhuma';
    document.getElementById('sk-anim-cor').value     = '#e74c3c';
    document.getElementById('sk-anim-icone').value   = '';
    document.getElementById('sk-anim-trilha').checked = false;
    document.getElementById('sk-anim-url').value      = '';
    document.getElementById('sk-anim-svg-code').value = '';
    document.getElementById('sk-anim-tamanho').value  = (120) as any;
    document.getElementById('sk-anim-duracao').value  = (1500) as any;
    document.getElementById('sk-anim-repeticao').value = (1) as any;
    document.getElementById('sk-anim-duracao-canvas').value = (600) as any;
    document.getElementById('sk-anim-repeticao-canvas').value = (1) as any;
    document.getElementById('sk-anim-posicao').value  = 'alvo';
    // GSAP (nova skill — valores padrão)
    const _gcPre = document.getElementById('sk-anim-gsap-preset');
    if (_gcPre) _gcPre.value = 'impacto_shake';
    const _gcCor = document.getElementById('sk-anim-gsap-cor');
    if (_gcCor) _gcCor.value = '#e74c3c';
    const _gcDur = document.getElementById('sk-anim-gsap-duracao');
    if (_gcDur) _gcDur.value = (800) as any;
    const _gcInt = document.getElementById('sk-anim-gsap-intensidade');
    if (_gcInt) _gcInt.value = (1.0) as any;
    const _gcAlvo = document.getElementById('sk-anim-gsap-alvo');
    if (_gcAlvo) _gcAlvo.value = 'alvo';
    // Spine (nova skill — limpar)
    const _scEl = document.getElementById('sk-anim-spine-json-config');
    if (_scEl) _scEl.value = '';
    skAnimTipoChange();
    // Áudio (nova skill — limpar)
    _skPopularSelectSfx();
    _skAtualizarAutoSfx();
    const _nCastSel = document.getElementById('sk-audio-cast-sel');
    const _nImpSel  = document.getElementById('sk-audio-impact-sel');
    const _nCastUrl = document.getElementById('sk-audio-cast-url');
    const _nImpUrl  = document.getElementById('sk-audio-impact-url');
    const _nVolEl   = document.getElementById('sk-audio-volume');
    const _nVolVal  = document.getElementById('sk-audio-volume-val');
    if (_nCastSel)  _nCastSel.value  = '';
    if (_nImpSel)   _nImpSel.value   = '';
    if (_nCastUrl)  _nCastUrl.value  = '';
    if (_nImpUrl)   _nImpUrl.value   = '';
    if (_nVolEl)  { _nVolEl.value = '0.75'; if (_nVolVal) _nVolVal.textContent = '0.75'; }
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
    if (el) { el.max = _maxDur; if (parseInt(el.value) > _maxDur) el.value = (_maxDur) as any; }
  });
  skAnimValidarDuracao();
}
function fecharModalSkill() {
  document.getElementById('modal-skill-overlay').style.display = 'none';
  if (window._skAtaqueBasicoMode) { _skAplicarModoAtaqueBasico(false); window._skAtaqueBasicoMode = null; }
}

// ── Modo "Ataque Básico" do modal de skill ───────────────────
// Reaproveita o modal completo de habilidade (animação rica, áudio, efeitos)
// para configurar o ataque básico, salvando em custom_attrs.ataque_basico.
function _skAplicarModoAtaqueBasico(on: any) {
  document.querySelectorAll('#modal-skill-overlay .sk-only-section').forEach(el => {
    if (on) { if (el.dataset._abPrev === undefined) el.dataset._abPrev = el.style.display || ''; el.style.display = 'none'; }
    else if (el.dataset._abPrev !== undefined) { el.style.display = el.dataset._abPrev; delete el.dataset._abPrev; }
  });
  const _relabel = (id: any, txt: any) => {
    const el = document.getElementById(id); if (!el) return;
    if (on) { if (el.dataset._abPrev === undefined) el.dataset._abPrev = el.textContent; el.textContent = txt; }
    else if (el.dataset._abPrev !== undefined) { el.textContent = el.dataset._abPrev; delete el.dataset._abPrev; }
  };
  _relabel('sk-mod-atributo-pct-label', 'Mult. de atributo (× aditivo)');
  _relabel('sk-cooldown-label', 'Cooldown (t) — vazio=global');
  const _multEl = document.getElementById('sk-mod-atributo-pct');
  if (_multEl) _multEl.step = on ? '0.1' : '';
}

function abrirModalSkillAtaqueBasico(entId: any) {
  if (typeof AVT_STATE === 'undefined') return;
  const ent = AVT_STATE.entidades.find((e: any) => e.id === entId);
  const dbChar = ent ? AVT_STATE.chars.find((c: any) => c.id === ent.dbId || c.nome === ent.nome) : null;
  if (!dbChar) { if (typeof mostrarToast === 'function') mostrarToast('Personagem não encontrado', 'erro'); return; }
  window._skAtaqueBasicoMode = { entId, dbCharId: dbChar.id, nome: ent.nome };
  const ab = dbChar.custom_attrs?.ataque_basico || {};
  const overlay = document.getElementById('modal-skill-overlay');
  document.getElementById('modal-skill-titulo').textContent = '⚔ Ataque Básico — ' + ent.nome;
  document.getElementById('modal-skill-id').value = '';
  document.getElementById('modal-skill-personagem').value = ent.nome;
  document.getElementById('sk-habilidade').value = ab.nome || 'Ataque básico';
  document.getElementById('sk-custo').value = '';
  document.getElementById('sk-efeito').value = ab.descricao || '';
  skFBCarregarFormula(ab.formula_dano || '1d8');
  skPopularAtributos();
  document.getElementById('sk-cooldown').value  = ab.cooldown_turnos != null ? ab.cooldown_turnos : '';
  document.getElementById('sk-tipo-dano').value = ab.tipo_dano || 'fisico';
  document.getElementById('sk-alcance').value   = ab.alcance_celulas != null ? ab.alcance_celulas : '';
  document.getElementById('sk-atributo-base').value = ab.atributo_base || '';
  document.getElementById('sk-mod-atributo-pct').value = ab.mod_atributo_mult != null ? ab.mod_atributo_mult : '';
  document.getElementById('sk-alvo-tipo').value = 'inimigo';
  if (typeof skAlvoTipoChange === 'function') skAlvoTipoChange();
  document.getElementById('sk-crit-pos').value = ab.critico_positivo || '';
  document.getElementById('sk-crit-neg').value = ab.critico_negativo || '';
  SK_EFEITOS_TEMP = Array.isArray(ab.efeitos_bonus) ? JSON.parse(JSON.stringify(ab.efeitos_bonus)) : [];
  skRenderEfeitosLista();
  skTipoDanoChange();
  skPreencherAnimacaoNoForm(ab.animacao || {});
  if (typeof _skCarregarCamposReativos === 'function') _skCarregarCamposReativos(null);
  _skAplicarModoAtaqueBasico(true);
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalSkill(); };
  const _isMestre = RPG_DATA?.myRole === 'mestre';
  const _maxDur = _isMestre ? 10000 : 3000;
  ['sk-anim-duracao','sk-anim-duracao-canvas'].forEach(id => { const el = document.getElementById(id); if (el) { el.max = _maxDur; if (parseInt(el.value) > _maxDur) el.value = (_maxDur) as any; } });
  if (typeof skAnimValidarDuracao === 'function') skAnimValidarDuracao();
}
window.abrirModalSkillAtaqueBasico = abrirModalSkillAtaqueBasico;

async function _skSalvarAtaqueBasicoRico() {
  const mode = window._skAtaqueBasicoMode;
  if (!mode) return;
  const dbChar = AVT_STATE.chars.find((c: any) => c.id === mode.dbCharId);
  if (!dbChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  const nome = document.getElementById('sk-habilidade').value.trim() || 'Ataque básico';
  const _animRes = skLerAnimacaoDoForm();
  if (_animRes.erro) return;
  const _multRaw = document.getElementById('sk-mod-atributo-pct').value;
  const _cdRaw   = document.getElementById('sk-cooldown').value;
  const _alcRaw  = document.getElementById('sk-alcance').value;
  const ab: Record<string, any> = {
    nome,
    descricao:        document.getElementById('sk-efeito').value.trim() || undefined,
    formula_dano:     document.getElementById('sk-formula').value.trim() || '1d8',
    tipo_dano:        document.getElementById('sk-tipo-dano').value || 'fisico',
    alcance_celulas:  _alcRaw !== '' ? parseInt(_alcRaw) : 1,
    atributo_base:    document.getElementById('sk-atributo-base').value.trim() || undefined,
    critico_positivo: document.getElementById('sk-crit-pos').value.trim() || undefined,
    critico_negativo: document.getElementById('sk-crit-neg').value.trim() || undefined,
    animacao:         _animRes.animacao,
    efeitos_bonus:    SK_EFEITOS_TEMP.length ? JSON.parse(JSON.stringify(SK_EFEITOS_TEMP)) : undefined,
    ...(_multRaw !== '' && !isNaN(parseFloat(_multRaw)) ? { mod_atributo_mult: parseFloat(_multRaw) } : {}),
    ...(_cdRaw   !== '' && !isNaN(parseInt(_cdRaw))     ? { cooldown_turnos: Math.max(0, parseInt(_cdRaw)) } : {}),
  };
  Object.keys(ab).forEach(k => ab[k] === undefined && delete ab[k]);
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  dbChar.custom_attrs.ataque_basico = ab;
  dbChar.custom_attrs.ataque_basico_animacao = ab.animacao || null; // mirror legado
  fecharModalSkill();
  if (dbChar.id && typeof _avtSb === 'function') {
    await _avtSb(`characters?id=eq.${encodeURIComponent(dbChar.id)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: dbChar.custom_attrs }) }).catch(() => {});
  }
  mostrarToast('Ataque básico salvo!', 'ok');
  if (typeof _avtCharEditorRender === 'function') _avtCharEditorRender();
}

// Popula os campos de animação + áudio do modal a partir de um objeto `anim`.
function skPreencherAnimacaoNoForm(anim: any) {
  anim = anim || {};
  const psId = document.getElementById('sk-pixi-studio-id');
  const psNome = document.getElementById('sk-pixi-studio-nome');
  if (psId) psId.value = anim.pixi_studio_id || '';
  if (psNome) psNome.textContent = anim.pixi_studio_nome || 'Nenhuma selecionada';
  document.getElementById('sk-anim-tipo').value    = anim.tipo  || 'nenhuma';
  document.getElementById('sk-anim-cor').value     = anim.cor   || '#e74c3c';
  document.getElementById('sk-anim-icone').value   = anim.icone || '';
  document.getElementById('sk-anim-trilha').checked = !!anim.trilha;
  document.getElementById('sk-anim-url').value      = anim.url  || '';
  document.getElementById('sk-anim-svg-code').value = anim.svg  || '';
  document.getElementById('sk-anim-tamanho').value  = anim.tamanho  || 120;
  document.getElementById('sk-anim-duracao').value  = anim.duracao  || 1500;
  document.getElementById('sk-anim-repeticao').value = anim.repeticao || 1;
  document.getElementById('sk-anim-duracao-canvas').value = anim.duracao || 600;
  document.getElementById('sk-anim-repeticao-canvas').value = anim.repeticao || 1;
  document.getElementById('sk-anim-posicao').value  = anim.posicao  || 'alvo';
  const gc = anim.gsap_config || {};
  const gcPreset = document.getElementById('sk-anim-gsap-preset'); if (gcPreset) gcPreset.value = gc.preset || 'impacto_shake';
  const gcCor = document.getElementById('sk-anim-gsap-cor'); if (gcCor) gcCor.value = gc.cor || '#e74c3c';
  const gcDur = document.getElementById('sk-anim-gsap-duracao'); if (gcDur) gcDur.value = gc.duracao || 800;
  const gcInt = document.getElementById('sk-anim-gsap-intensidade'); if (gcInt) gcInt.value = gc.intensidade || 1.0;
  const gcAlvo = document.getElementById('sk-anim-gsap-alvo'); if (gcAlvo) gcAlvo.value = gc.alvo_efeito || 'alvo';
  const scEl = document.getElementById('sk-anim-spine-json-config'); if (scEl) scEl.value = anim.spine_config ? JSON.stringify(anim.spine_config, null, 2) : '';
  const scPos = document.getElementById('sk-anim-spine-posicao'); if (scPos) scPos.value = anim.spine_config?.posicao || 'alvo';
  skAnimTipoChange();
  _skPopularSelectSfx();
  _skAtualizarAutoSfx();
  const _audCfg = anim.audio || {};
  const _castSel = document.getElementById('sk-audio-cast-sel');
  const _impSel  = document.getElementById('sk-audio-impact-sel');
  const _castUrl = document.getElementById('sk-audio-cast-url');
  const _impUrl  = document.getElementById('sk-audio-impact-url');
  const _volEl   = document.getElementById('sk-audio-volume');
  const _volVal  = document.getElementById('sk-audio-volume-val');
  if (_castSel)  _castSel.value  = (!_audCfg.cast || _audCfg.cast.startsWith('http')) ? '' : (_audCfg.cast || '');
  if (_castUrl)  _castUrl.value  = (_audCfg.cast?.startsWith?.('http') ? _audCfg.cast : '');
  if (_impSel)   _impSel.value   = (!_audCfg.impact || _audCfg.impact.startsWith('http')) ? '' : (_audCfg.impact || '');
  if (_impUrl)   _impUrl.value   = (_audCfg.impact?.startsWith?.('http') ? _audCfg.impact : '');
  if (_volEl)  { _volEl.value = _audCfg.volume ?? 0.75; if (_volVal) _volVal.textContent = parseFloat(_volEl.value).toFixed(2); }
}

// Lê os campos de animação + áudio do modal → { animacao } ou { erro:true }.
function skLerAnimacaoDoForm() {
  const animTipo = document.getElementById('sk-anim-tipo').value;
  if (!animTipo || animTipo === 'nenhuma') return { animacao: null };
  const _isMidia  = ['gif','imagem','svg','iframe'].includes(animTipo);
  const _isCanvas = ['projetil','onda','explosao','raio','aura'].includes(animTipo);
  const _isGSAP   = animTipo === 'gsap' || animTipo === 'gsap_pixi_spine';
  const _isSpine  = animTipo === 'pixi_spine' || animTipo === 'gsap_pixi_spine';
  const _isMestre = RPG_DATA?.myRole === 'mestre';
  const _maxTotal = _isMestre ? 10000 : 3000;
  if (_isMidia) {
    const dur = parseInt(document.getElementById('sk-anim-duracao').value) || 1500;
    const rep = parseInt(document.getElementById('sk-anim-repeticao').value) || 1;
    if (dur * rep > _maxTotal) { mostrarToast(`Duração total (${dur*rep}ms) excede o limite de ${_maxTotal}ms`, 'erro'); return { erro: true }; }
  }
  if (_isCanvas) {
    const dur = parseInt(document.getElementById('sk-anim-duracao-canvas').value) || 600;
    const rep = parseInt(document.getElementById('sk-anim-repeticao-canvas').value) || 1;
    if (dur * rep > _maxTotal) { mostrarToast(`Duração total (${dur*rep}ms) excede o limite de ${_maxTotal}ms`, 'erro'); return { erro: true }; }
  }
  const animacao: any = {
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
    gsap_config: _isGSAP ? {
      preset:      document.getElementById('sk-anim-gsap-preset')?.value       || 'impacto_shake',
      cor:         document.getElementById('sk-anim-gsap-cor')?.value          || '#e74c3c',
      duracao:     parseInt(document.getElementById('sk-anim-gsap-duracao')?.value)      || 800,
      intensidade: parseFloat(document.getElementById('sk-anim-gsap-intensidade')?.value) || 1.0,
      alvo_efeito: document.getElementById('sk-anim-gsap-alvo')?.value         || 'alvo',
    } : undefined,
    spine_config: _isSpine ? (() => {
      const raw = document.getElementById('sk-anim-spine-json-config')?.value.trim() || '';
      try {
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        const spinePos = document.getElementById('sk-anim-spine-posicao')?.value || 'alvo';
        return { posicao: spinePos, ...parsed };
      } catch(_) { return undefined; }
    })() : undefined,
    pixi_studio_id:   animTipo === 'pixi_studio' ? (document.getElementById('sk-pixi-studio-id')?.value || null) : undefined,
    pixi_studio_nome: animTipo === 'pixi_studio' ? (document.getElementById('sk-pixi-studio-nome')?.textContent || null) : undefined,
  };
  Object.keys(animacao).forEach(k => animacao[k] === undefined && delete animacao[k]);
  const _skAudCast   = document.getElementById('sk-audio-cast-url')?.value.trim()
                     || document.getElementById('sk-audio-cast-sel')?.value || '';
  const _skAudImpact = document.getElementById('sk-audio-impact-url')?.value.trim()
                     || document.getElementById('sk-audio-impact-sel')?.value || '';
  const _skAudVol    = parseFloat(document.getElementById('sk-audio-volume')?.value) || 0.75;
  if (_skAudCast || _skAudImpact) {
    (animacao as any).audio = {};
    if (_skAudCast)   (animacao as any).audio.cast   = _skAudCast;
    if (_skAudImpact) (animacao as any).audio.impact = _skAudImpact;
    animacao.audio.volume = _skAudVol;
  }
  return { animacao };
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
  if (window._skAtaqueBasicoMode) { return _skSalvarAtaqueBasicoRico(); }
  const skillId = document.getElementById('modal-skill-id').value;
  const personagem = document.getElementById('modal-skill-personagem').value;
  if (!podeEditarPersonagem(personagem)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
  const habilidade = document.getElementById('sk-habilidade').value.trim();
  if (!habilidade) { mostrarToast('Nome da habilidade obrigatório', 'erro'); return; }
  const body: any = {
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
    invocar_duracao_turnos: document.getElementById('sk-invocar-ilimitado')?.checked
      ? 0
      : (parseInt(document.getElementById('sk-invocar-duracao')?.value) || 3),
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
    const _isMidia  = ['gif','imagem','svg','iframe'].includes(animTipo);
    const _isCanvas = ['projetil','onda','explosao','raio','aura'].includes(animTipo);
    const _isGSAP   = animTipo === 'gsap' || animTipo === 'gsap_pixi_spine';
    const _isSpine  = animTipo === 'pixi_spine' || animTipo === 'gsap_pixi_spine';
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

    (body as any).animacao = {
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
      gsap_config: _isGSAP ? {
        preset:      document.getElementById('sk-anim-gsap-preset')?.value       || 'impacto_shake',
        cor:         document.getElementById('sk-anim-gsap-cor')?.value          || '#e74c3c',
        duracao:     parseInt(document.getElementById('sk-anim-gsap-duracao')?.value)      || 800,
        intensidade: parseFloat(document.getElementById('sk-anim-gsap-intensidade')?.value) || 1.0,
        alvo_efeito: document.getElementById('sk-anim-gsap-alvo')?.value         || 'alvo',
      } : undefined,
      spine_config: _isSpine ? (() => {
        const raw = document.getElementById('sk-anim-spine-json-config')?.value.trim() || '';
        try {
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          const spinePos = document.getElementById('sk-anim-spine-posicao')?.value || 'alvo';
          return { posicao: spinePos, ...parsed };
        } catch(_) { return undefined; }
      })() : undefined,
      // Studio Pixi
      pixi_studio_id:   animTipo === 'pixi_studio' ? (document.getElementById('sk-pixi-studio-id')?.value || null) : undefined,
      pixi_studio_nome: animTipo === 'pixi_studio' ? (document.getElementById('sk-pixi-studio-nome')?.textContent || null) : undefined,
    };
    // Limpar campos undefined
    Object.keys(body.animacao).forEach(k => body.animacao[k] === undefined && delete (body as any).animacao[k]);
    // Áudio da skill
    const _skAudCast   = document.getElementById('sk-audio-cast-url')?.value.trim()
                       || document.getElementById('sk-audio-cast-sel')?.value || '';
    const _skAudImpact = document.getElementById('sk-audio-impact-url')?.value.trim()
                       || document.getElementById('sk-audio-impact-sel')?.value || '';
    const _skAudVol    = parseFloat(document.getElementById('sk-audio-volume')?.value) || 0.75;
    if (_skAudCast || _skAudImpact) {
      (body as any).animacao.audio = {};
      if (_skAudCast)   (body as any).animacao.audio.cast   = _skAudCast;
      if (_skAudImpact) (body as any).animacao.audio.impact  = _skAudImpact;
      (body as any).animacao.audio.volume = _skAudVol;
    }
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
    if (FICHAS_VIEW === personagem && typeof renderFichaView === 'function') renderFichaView(personagem); else if (CHAR_VIEW === personagem) renderCharView(personagem);
    mostrarToast('Habilidade salva!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar habilidade', 'erro'); }
}
async function removerSkill(skillId: any, nome: any, personagem: any) {
  if (!podeEditarPersonagem(personagem)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
  if (!confirm(`Remover habilidade "${nome}"?`)) return;
  try {
    await sb(`skills?id=eq.${encodeURIComponent(skillId)}`, { method: 'DELETE' });
    RPG_DATA.skills = RPG_DATA.skills.filter(s => s.id != skillId);
    if (FICHAS_VIEW === personagem && typeof renderFichaView === 'function') renderFichaView(personagem); else if (CHAR_VIEW === personagem) renderCharView(personagem);
    mostrarToast('Habilidade removida', 'sucesso');
  } catch(e) { mostrarToast('Erro ao remover', 'erro'); }
}

// ─── ÁUDIO DA HABILIDADE ─────────────────────────────────────────────────────

function skToggleAudioSection() {
  const fields  = document.getElementById('sk-audio-fields');
  const chevron = document.getElementById('sk-audio-chevron');
  if (!fields) return;
  const open = fields.style.display !== 'none';
  fields.style.display  = open ? 'none' : '';
  if (chevron) chevron.textContent = open ? '▶' : '▼';
}

function _skPopularSelectSfx() {
  if (typeof AudioManager === 'undefined') return;
  const categorias = ['ataque','impacto','magia','elemento','cura','ambiente'];
  const rotulosCat: Record<string, any> = { ataque:'Ataques', impacto:'Impactos', magia:'Magia', elemento:'Elementais', cura:'Cura/Suporte', ambiente:'Ambiente' };
  const buildOptions = (sel: any) => {
    if (!sel) return;
    const atual = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    categorias.forEach(cat => {
      const items = AudioManager.getSfxList(cat);
      if (!items.length) return;
      const grp = document.createElement('optgroup');
      grp.label = rotulosCat[cat] || cat;
      items.forEach(({ id, label }: any) => {
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = label;
        grp.appendChild(opt);
      });
      sel.appendChild(grp);
    });
    sel.value = atual;
  };
  buildOptions(document.getElementById('sk-audio-cast-sel'));
  buildOptions(document.getElementById('sk-audio-impact-sel'));
}

function _skAtualizarAutoSfx() {
  if (typeof AudioManager === 'undefined') return;
  const tipo     = document.getElementById('sk-anim-tipo')?.value || '';
  const posicao  = document.getElementById('sk-anim-posicao')?.value || '';
  const tipoDano = document.getElementById('sk-tipo-dano')?.value || '';
  const preset   = document.getElementById('sk-anim-gsap-preset')?.value || '';
  const sfx = AudioManager.getSkillSfx(tipo, posicao, tipoDano, preset);
  const castAutoEl   = document.getElementById('sk-audio-cast-auto');
  const impactAutoEl = document.getElementById('sk-audio-impact-auto');
  if (castAutoEl)   castAutoEl.textContent   = sfx.cast   ? `Auto: ${AudioManager.getSfxLabel(sfx.cast)}`   : '';
  if (impactAutoEl) impactAutoEl.textContent = sfx.impact ? `Auto: ${AudioManager.getSfxLabel(sfx.impact)}` : '';
}

function skTestarSfx(tipo: any) {
  if (typeof AudioManager === 'undefined') { mostrarToast('AudioManager não disponível', 'aviso'); return; }
  const urlEl = document.getElementById(`sk-audio-${tipo}-url`);
  const selEl = document.getElementById(`sk-audio-${tipo}-sel`);
  const vol   = parseFloat(document.getElementById('sk-audio-volume')?.value) || 0.75;
  const sfxId = urlEl?.value.trim() || selEl?.value || '';
  if (!sfxId) {
    // Usa o auto-detectado
    const tipo_anim = document.getElementById('sk-anim-tipo')?.value || '';
    const posicao   = document.getElementById('sk-anim-posicao')?.value || '';
    const tipoDano  = document.getElementById('sk-tipo-dano')?.value || '';
    const preset    = document.getElementById('sk-anim-gsap-preset')?.value || '';
    const sfx = AudioManager.getSkillSfx(tipo_anim, posicao, tipoDano, preset);
    const key = tipo === 'cast' ? sfx.cast : sfx.impact;
    if (key) AudioManager.playSFX(key, { volume: vol });
    return;
  }
  AudioManager.playSFX(sfxId, { volume: vol });
}

// ─── CAMPOS DE HABILIDADE REATIVA ────────────────────────────────────────────

function _skCarregarCamposReativos(s: any) {
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
  const concEl = document.getElementById('sk-concentracao');
  if (concEl) concEl.checked = s?.concentracao || false;
  const nivelEl = document.getElementById('sk-nivel-magia');
  if (nivelEl) nivelEl.value = s?.nivel_magia ?? 0;

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

function skInvocacaoIlimitadoChange() {
  const ilimitado = document.getElementById('sk-invocar-ilimitado')?.checked;
  const duracaoWrap = document.getElementById('sk-invocar-duracao-wrap');
  const infoIlim    = document.getElementById('sk-invocar-ilimitado-info');
  if (duracaoWrap) duracaoWrap.style.display = ilimitado ? 'none' : 'flex';
  if (infoIlim)    infoIlim.style.display    = ilimitado ? 'block' : 'none';
}

// ─── STUDIO PIXI — skill picker helpers ──────────────────────────────────────
async function skEscolherPixiStudio() {
  if (typeof psPickerAbrir !== 'function') {
    mostrarToast('Studio Pixi não está carregado.', 'erro');
    return;
  }
  // Garante o escopo de RPG atual (aventura ou campanha) para que a query inclua as
  // animações do RPG (rpg_id), que de outra forma ficariam de fora — lista vazia.
  if (typeof PIXI_STUDIO_STATE !== 'undefined' && PIXI_STUDIO_STATE) {
    const _rpgId = (typeof AVT_STATE !== 'undefined' && AVT_STATE?.rpgId) || RPG_DATA?.rpg?.id || null;
    PIXI_STUDIO_STATE.rpgId = _rpgId;
  }
  // Recarrega sempre (o rpgId pode ter mudado desde o último carregamento).
  if (typeof psCarregarLista === 'function') {
    try { await psCarregarLista(); } catch (_) {}
  }
  psPickerAbrir((id: any, nome: any) => {
    const idEl   = document.getElementById('sk-pixi-studio-id');
    const nomeEl = document.getElementById('sk-pixi-studio-nome');
    if (idEl)   idEl.value = id;
    if (nomeEl) nomeEl.textContent = nome || id;
  });
}

function skLimparPixiStudio() {
  const idEl   = document.getElementById('sk-pixi-studio-id');
  const nomeEl = document.getElementById('sk-pixi-studio-nome');
  if (idEl)   idEl.value = '';
  if (nomeEl) nomeEl.textContent = 'Nenhuma selecionada';
}

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "SK_FB", { configurable: true, get: () => SK_FB, set: (__v) => { SK_FB = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBAdicionarDado", { configurable: true, get: () => skFBAdicionarDado, set: (__v) => { skFBAdicionarDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBRemoverDado", { configurable: true, get: () => skFBRemoverDado, set: (__v) => { skFBRemoverDado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBMostrarInputBonus", { configurable: true, get: () => skFBMostrarInputBonus, set: (__v) => { skFBMostrarInputBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBConfirmarBonus", { configurable: true, get: () => skFBConfirmarBonus, set: (__v) => { skFBConfirmarBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBCancelarBonus", { configurable: true, get: () => skFBCancelarBonus, set: (__v) => { skFBCancelarBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBAdicionarBonus", { configurable: true, get: () => skFBAdicionarBonus, set: (__v) => { skFBAdicionarBonus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBLimpar", { configurable: true, get: () => skFBLimpar, set: (__v) => { skFBLimpar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBAtualizarUI", { configurable: true, get: () => skFBAtualizarUI, set: (__v) => { skFBAtualizarUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skFBCarregarFormula", { configurable: true, get: () => skFBCarregarFormula, set: (__v) => { skFBCarregarFormula = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skPopularAtributos", { configurable: true, get: () => skPopularAtributos, set: (__v) => { skPopularAtributos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalSkill", { configurable: true, get: () => abrirModalSkill, set: (__v) => { abrirModalSkill = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalSkill", { configurable: true, get: () => fecharModalSkill, set: (__v) => { fecharModalSkill = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_skAplicarModoAtaqueBasico", { configurable: true, get: () => _skAplicarModoAtaqueBasico, set: (__v) => { _skAplicarModoAtaqueBasico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalSkillAtaqueBasico", { configurable: true, get: () => abrirModalSkillAtaqueBasico, set: (__v) => { abrirModalSkillAtaqueBasico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_skSalvarAtaqueBasicoRico", { configurable: true, get: () => _skSalvarAtaqueBasicoRico, set: (__v) => { _skSalvarAtaqueBasicoRico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skPreencherAnimacaoNoForm", { configurable: true, get: () => skPreencherAnimacaoNoForm, set: (__v) => { skPreencherAnimacaoNoForm = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skLerAnimacaoDoForm", { configurable: true, get: () => skLerAnimacaoDoForm, set: (__v) => { skLerAnimacaoDoForm = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skTipoHabilidadeChange", { configurable: true, get: () => skTipoHabilidadeChange, set: (__v) => { skTipoHabilidadeChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarSkill", { configurable: true, get: () => salvarSkill, set: (__v) => { salvarSkill = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "removerSkill", { configurable: true, get: () => removerSkill, set: (__v) => { removerSkill = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skToggleAudioSection", { configurable: true, get: () => skToggleAudioSection, set: (__v) => { skToggleAudioSection = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_skPopularSelectSfx", { configurable: true, get: () => _skPopularSelectSfx, set: (__v) => { _skPopularSelectSfx = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_skAtualizarAutoSfx", { configurable: true, get: () => _skAtualizarAutoSfx, set: (__v) => { _skAtualizarAutoSfx = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skTestarSfx", { configurable: true, get: () => skTestarSfx, set: (__v) => { skTestarSfx = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_skCarregarCamposReativos", { configurable: true, get: () => _skCarregarCamposReativos, set: (__v) => { _skCarregarCamposReativos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skTipoReativaChange", { configurable: true, get: () => skTipoReativaChange, set: (__v) => { skTipoReativaChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skToggleReativaSection", { configurable: true, get: () => skToggleReativaSection, set: (__v) => { skToggleReativaSection = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skInvocacaoIlimitadoChange", { configurable: true, get: () => skInvocacaoIlimitadoChange, set: (__v) => { skInvocacaoIlimitadoChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skEscolherPixiStudio", { configurable: true, get: () => skEscolherPixiStudio, set: (__v) => { skEscolherPixiStudio = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "skLimparPixiStudio", { configurable: true, get: () => skLimparPixiStudio, set: (__v) => { skLimparPixiStudio = __v; } });
