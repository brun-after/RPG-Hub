// js/combat/reactions.js
// RPG Hub — Reaction panel, active defense UI, and campaign battle config modal
// Depends on: battle-system.js (BATTLE_SYSTEM, BATTLE_CONFIG_DEFAULTS)

// ─── PAINEL DE REAÇÃO ────────────────────────────────────────────────────────

function mostrarPainelReacao(reacaoId: any, habilidade: any, gatilho: any, dono: any, timeout_ms: any, contexto: any) {
  const panel = document.getElementById('reacao-notif-panel');
  if (!panel) return;

  if (panel._timerInterval) clearInterval(panel._timerInterval);

  const ctxHtml = contexto
    ? `<div class="bs-notif-sub" style="color:rgba(200,168,75,0.8);margin-top:3px">📋 ${_escHtml(contexto)}</div>`
    : '';

  panel.style!.display = 'flex';
  panel.innerHTML = `
    <div class="bs-notif-card bs-notif-reacao">
      <div class="bs-notif-header">
        <span class="bs-notif-badge">⚡ Reação Disponível</span>
        <span id="reacao-timer" class="bs-notif-timer"></span>
      </div>
      <div class="bs-notif-title">${_escHtml(habilidade)}</div>
      <div class="bs-notif-sub">Gatilho: ${_escHtml(gatilho)}</div>
      ${ctxHtml}
      <div class="bs-notif-char">Personagem: <strong>${_escHtml(dono)}</strong></div>
      <div class="bs-notif-actions">
        <button class="bs-btn bs-btn-gold" onclick="reacaoAceitar('${reacaoId}')">⚡ Usar Reação</button>
        <button class="bs-btn bs-btn-muted" onclick="reacaoRecusar('${reacaoId}')">Passar</button>
      </div>
    </div>
  `;

  _iniciarTimer('reacao-timer', timeout_ms, panel, fecharPainelReacao);
}

function reacaoAceitar(reacaoId: any) {
  BATTLE_SYSTEM.confirmarReacao(reacaoId, true);
  if (typeof combateBroadcast === 'function') {
    combateBroadcast('reacao_confirmada', { reacaoId, aceita: true });
  }
  fecharPainelReacao();
}

function reacaoRecusar(reacaoId: any) {
  BATTLE_SYSTEM.confirmarReacao(reacaoId, false);
  if (typeof combateBroadcast === 'function') {
    combateBroadcast('reacao_confirmada', { reacaoId, aceita: false });
  }
  fecharPainelReacao();
}

function fecharPainelReacao() {
  const panel = document.getElementById('reacao-notif-panel');
  if (!panel) return;
  if (panel._timerInterval) clearInterval(panel._timerInterval);
  panel.style!.display = 'none';
  panel.innerHTML = '';
}

// ─── PAINEL DE DEFESA ATIVA ───────────────────────────────────────────────────

function mostrarPainelDefesaAtiva(defesaId: any, alvo: any, resultadoAtacante: any, tipoAtaque: any, penalidade: any, slotsRestantes: any, timeout_ms: any) {
  const panel = document.getElementById('defesa-ativa-panel');
  if (!panel) return;

  if (panel._timerInterval) clearInterval(panel._timerInterval);

  panel.style!.display = 'flex';
  panel.dataset!.defesaId  = defesaId;
  panel.dataset!.alvo      = alvo;
  panel.dataset!.penalidade = penalidade;

  const penalidadeHtml = penalidade > 0
    ? `<div class="bs-notif-sub" style="color:#e8604c">Penalidade acumulada: -${penalidade}</div>`
    : '';
  const slotsHtml = slotsRestantes < 99
    ? `<div class="bs-notif-sub">${slotsRestantes} uso(s) restante(s)</div>`
    : '';

  panel.innerHTML = `
    <div class="bs-notif-card bs-notif-defesa">
      <div class="bs-notif-header">
        <span class="bs-notif-badge" style="color:#5ee09a;border-color:rgba(94,224,154,0.4)">🛡️ Defesa Ativa</span>
        <span id="defesa-timer" class="bs-notif-timer"></span>
      </div>
      <div class="bs-notif-title">Ataque de ${_escHtml(tipoAtaque || 'físico')}</div>
      <div class="bs-notif-sub">Resultado do atacante: <strong>${resultadoAtacante}</strong></div>
      ${slotsHtml}${penalidadeHtml}
      <div class="bs-notif-actions" style="margin-bottom:6px">
        <button class="bs-btn bs-btn-green" onclick="defesaRolar('esquivar')">🏃 Esquivar</button>
        <button class="bs-btn bs-btn-blue" onclick="defesaRolar('aparar')">🗡️ Aparar</button>
      </div>
      <button class="bs-btn bs-btn-muted" style="width:100%" onclick="defesaRecusar()">Defesa Passiva (CA)</button>
    </div>
  `;

  _iniciarTimer('defesa-timer', timeout_ms, panel, fecharPainelDefesaAtiva);
}

function defesaRolar(tipoDefesa: any) {
  const panel = document.getElementById('defesa-ativa-panel');
  if (!panel) return;

  const defesaId = panel.dataset!.defesaId;
  const alvo     = panel.dataset!.alvo;
  const penalidade = parseInt(panel.dataset!.penalidade!) || 0;

  const char = (RPG_DATA?.characters || []).find(c => c.nome === alvo);
  const attrKey = tipoDefesa === 'aparar' ? 'forca' : 'destreza';
  const valorAttr = parseFloat(char?.custom_attrs?.atributos?.[attrKey] ?? 0);
  // Modificador clássico D&D (opcional — se atributos forem 0-20 usa floor((v-10)/2), caso contrário usa o valor direto)
  const modAttr = valorAttr > 20 ? Math.floor(valorAttr) : Math.floor((valorAttr - 10) / 2);

  const d20 = Math.floor(Math.random() * 20) + 1;
  const resultado = Math.max(0, d20 + modAttr - penalidade);

  const partes = [`d20=${d20}`, modAttr !== 0 ? `${modAttr > 0 ? '+' : ''}${modAttr}(${attrKey})` : null, penalidade > 0 ? `-${penalidade}(pen)` : null]
    .filter(Boolean).join(' ');

  if (typeof mostrarToast === 'function') {
    mostrarToast(`${alvo} ${tipoDefesa === 'esquivar' ? 'Esquiva' : 'Para'}: ${partes} = ${resultado}`, 'ok');
  }
  if (typeof COMBATE_LOG !== 'undefined') {
    COMBATE_LOG.adicionar('efeito', {
      nome: tipoDefesa === 'esquivar' ? '🏃 Esquiva' : '🗡️ Aparar',
      alvo,
      ehPositivo: true,
      gatilho: 'defesa_ativa',
    });
  }

  BATTLE_SYSTEM.confirmarDefesa(defesaId, true, { tipo: tipoDefesa, resultado, d20, modAttr, penalidade });

  if (typeof combateBroadcast === 'function') {
    combateBroadcast('defesa_resolvida', { defesaId, alvo, tipoDefesa, resultado, d20 });
  }
  fecharPainelDefesaAtiva();
}

function defesaRecusar() {
  const panel = document.getElementById('defesa-ativa-panel');
  if (!panel) return;
  BATTLE_SYSTEM.confirmarDefesa(panel.dataset!.defesaId, false, null);
  fecharPainelDefesaAtiva();
}

function fecharPainelDefesaAtiva() {
  const panel = document.getElementById('defesa-ativa-panel');
  if (!panel) return;
  if (panel._timerInterval) clearInterval(panel._timerInterval);
  panel.style!.display = 'none';
  panel.innerHTML = '';
}

// ─── MODAL DE CONFIGURAÇÃO DE BATALHA ────────────────────────────────────────

function abrirModalConfigBatalha() {
  const modal = document.getElementById('modal-config-batalha');
  if (!modal) return;

  const cfg = BATTLE_SYSTEM.getConfig();

  _setVal('bcfg-sistema',           cfg.sistema_reacao || 'custom');
  _setChk('bcfg-usa-reacoes',       cfg.usa_reacoes);
  _setVal('bcfg-max-reacoes',       cfg.max_reacoes_por_rodada === 'unlimited' ? '' : cfg.max_reacoes_por_rodada);
  _setChk('bcfg-pode-interromper',  cfg.reacoes_podem_interromper);
  _setChk('bcfg-passivas-auto',     cfg.passivas_automaticas);
  _setChk('bcfg-notif-passivas',    cfg.notificar_passivas);
  _setVal('bcfg-tipo-defesa',       cfg.tipo_defesa || 'passiva');
  _setChk('bcfg-defesa-reacao',     cfg.defesa_consome_reacao);
  _setChk('bcfg-graus-sucesso',     cfg.graus_de_sucesso);
  _setVal('bcfg-max-defesas',       cfg.max_defesas_por_rodada === 'unlimited' ? '' : cfg.max_defesas_por_rodada);
  _setVal('bcfg-penalidade-extra',  cfg.penalidade_defesa_extra ?? '');

  modal.style!.display = 'flex';
}

function fecharModalConfigBatalha() {
  const el = document.getElementById('modal-config-batalha');
  if (el) el.style!.display = 'none';
}

async function salvarConfigBatalha() {
  const sistema   = _getVal('bcfg-sistema') || 'custom';
  const defaults  = BATTLE_CONFIG_DEFAULTS[sistema] || BATTLE_CONFIG_DEFAULTS.custom;
  const numOuUnlim = (id: any) => {
    const v = _getVal(id);
    return v === '' ? 'unlimited' : (parseInt(v) || 1);
  };

  const cfg = {
    ...defaults,
    sistema_reacao:            sistema,
    usa_reacoes:               _getChk('bcfg-usa-reacoes'),
    max_reacoes_por_rodada:    numOuUnlim('bcfg-max-reacoes'),
    reacoes_podem_interromper: _getChk('bcfg-pode-interromper'),
    passivas_automaticas:      _getChk('bcfg-passivas-auto'),
    notificar_passivas:        _getChk('bcfg-notif-passivas'),
    tipo_defesa:               _getVal('bcfg-tipo-defesa') || 'passiva',
    defesa_consome_reacao:     _getChk('bcfg-defesa-reacao'),
    graus_de_sucesso:          _getChk('bcfg-graus-sucesso'),
    max_defesas_por_rodada:    numOuUnlim('bcfg-max-defesas'),
    penalidade_defesa_extra:   _getVal('bcfg-penalidade-extra') !== ''
                                 ? parseFloat(_getVal('bcfg-penalidade-extra'))
                                 : null,
  };

  await BATTLE_SYSTEM.setConfig(cfg);
  fecharModalConfigBatalha();
  if (typeof mostrarToast === 'function') mostrarToast('✓ Configuração de batalha salva', 'sucesso');
}

function bcfgSistemaChange() {
  const sistema  = _getVal('bcfg-sistema') || 'custom';
  const defaults = BATTLE_CONFIG_DEFAULTS[sistema] || BATTLE_CONFIG_DEFAULTS.custom;

  _setVal('bcfg-max-reacoes',      defaults.max_reacoes_por_rodada === 'unlimited' ? '' : defaults.max_reacoes_por_rodada);
  _setChk('bcfg-usa-reacoes',      defaults.usa_reacoes);
  _setChk('bcfg-pode-interromper', defaults.reacoes_podem_interromper);
  _setChk('bcfg-passivas-auto',    defaults.passivas_automaticas);
  _setChk('bcfg-notif-passivas',   defaults.notificar_passivas);
  _setVal('bcfg-tipo-defesa',      defaults.tipo_defesa || 'passiva');
  _setChk('bcfg-defesa-reacao',    defaults.defesa_consome_reacao);
  _setChk('bcfg-graus-sucesso',    defaults.graus_de_sucesso);
  _setVal('bcfg-max-defesas',      defaults.max_defesas_por_rodada === 'unlimited' ? '' : defaults.max_defesas_por_rodada);
  _setVal('bcfg-penalidade-extra', defaults.penalidade_defesa_extra ?? '');
}

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────

function _escHtml(str: any) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _setVal(id: any, val: any) {
  const el = document.getElementById(id);
  if (el) el.value = (val === null || val === undefined) ? '' : val;
}

function _setChk(id: any, val: any) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function _getVal(id: any) {
  return document.getElementById(id)?.value ?? '';
}

function _getChk(id: any) {
  return document.getElementById(id)?.checked ?? false;
}

function _iniciarTimer(timerId: any, timeout_ms: any, panel: any, fecharFn: any) {
  let ms = timeout_ms;
  const timerEl = document.getElementById(timerId);
  if (timerEl) timerEl.textContent = Math.ceil(ms / 1000) + 's';
  const interval = setInterval(() => {
    ms -= 250;
    if (timerEl) timerEl.textContent = Math.max(0, Math.ceil(ms / 1000)) + 's';
    if (ms <= 0) { clearInterval(interval); fecharFn(); }
  }, 250);
  panel._timerInterval = interval;
}

// ─── HANDLER REALTIME: mostrar indicador de reação executada ─────────────────

window.batalhaReceberReacaoExecutada = function(payload: any) {
  if (typeof mostrarToast === 'function') {
    mostrarToast(`⚡ ${payload.personagem}: ${payload.habilidade}`, 'ok');
  }
};

console.log('[Reactions] UI de reações e defesa ativa carregado ✓');

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarPainelReacao", { configurable: true, get: () => mostrarPainelReacao, set: (__v) => { mostrarPainelReacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "reacaoAceitar", { configurable: true, get: () => reacaoAceitar, set: (__v) => { reacaoAceitar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "reacaoRecusar", { configurable: true, get: () => reacaoRecusar, set: (__v) => { reacaoRecusar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharPainelReacao", { configurable: true, get: () => fecharPainelReacao, set: (__v) => { fecharPainelReacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarPainelDefesaAtiva", { configurable: true, get: () => mostrarPainelDefesaAtiva, set: (__v) => { mostrarPainelDefesaAtiva = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "defesaRolar", { configurable: true, get: () => defesaRolar, set: (__v) => { defesaRolar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "defesaRecusar", { configurable: true, get: () => defesaRecusar, set: (__v) => { defesaRecusar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharPainelDefesaAtiva", { configurable: true, get: () => fecharPainelDefesaAtiva, set: (__v) => { fecharPainelDefesaAtiva = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalConfigBatalha", { configurable: true, get: () => abrirModalConfigBatalha, set: (__v) => { abrirModalConfigBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalConfigBatalha", { configurable: true, get: () => fecharModalConfigBatalha, set: (__v) => { fecharModalConfigBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarConfigBatalha", { configurable: true, get: () => salvarConfigBatalha, set: (__v) => { salvarConfigBatalha = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "bcfgSistemaChange", { configurable: true, get: () => bcfgSistemaChange, set: (__v) => { bcfgSistemaChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_escHtml", { configurable: true, get: () => _escHtml, set: (__v) => { _escHtml = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_setVal", { configurable: true, get: () => _setVal, set: (__v) => { _setVal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_setChk", { configurable: true, get: () => _setChk, set: (__v) => { _setChk = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_getVal", { configurable: true, get: () => _getVal, set: (__v) => { _getVal = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_getChk", { configurable: true, get: () => _getChk, set: (__v) => { _getChk = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_iniciarTimer", { configurable: true, get: () => _iniciarTimer, set: (__v) => { _iniciarTimer = __v; } });
