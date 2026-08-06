// combat/animations.js
// RPG Hub — Combat broadcast and attack animation engine (Canvas 2D)
// Includes: combateBroadcast(), animBroadcast(), runAttackAnim(), _animExec()

// ═══════════════════════════════════════════════════════════════════════════
// ██  BROADCAST DE COMBATE — eventos em tempo real para todos
// ═══════════════════════════════════════════════════════════════════════════

function combateBroadcast(tipo: CombateEventoTipo, dados: any) {
  try {
    const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
    const ws = AR.ws || realtimeWS;
    if (!rpgId || !ws || ws.readyState !== WebSocket.OPEN) return;
    // Usa o canal characters que todos os clientes têm subscrito garantidamente
    // (evita depender do canal chat que pode não estar ativo)
    ws.send(JSON.stringify({
      topic:   `realtime:public:characters:rpg_id=eq.${rpgId}`,
      event:   'broadcast',
      payload: { type: 'broadcast', event: 'combate_evento', payload: { tipo, ...dados, _sid: _ANIM_SID } },
      ref:     'cbt_' + Date.now()
    }));
  } catch(e) {}
}

function combateReceberBroadcast(payload: any) {
  if (!payload || payload._sid === _ANIM_SID) return; // ignorar eco do próprio emissor

  const { tipo } = payload;

  if (tipo === 'dados_rolados') {
    const criticoStr = payload.critico ? ` — ${payload.critico}` : '';
    mostrarToast(`🎲 ${payload.atacante} rolou ${payload.total} com "${payload.habilidade}"${criticoStr}`, '');
  }

  if (tipo === 'vez_passou') {
    const bid = payload.batalhaId;
    if (bid && MAPA_STATE.batalhas[bid]) {
      const bs = MAPA_STATE.batalhas[bid];
      const anteriorIdx = bs.ordemAtual;
      bs.ordemAtual = payload.ordemAtual;
      if (payload.turnoRound) bs.turnoRound = payload.turnoRound;
      const meuNome = RPG_DATA?.linked;
      const isMestre = RPG_DATA?.myRole === 'mestre';
      const souParticipante = isMestre || bs.participantes?.some(p => p.nome === meuNome);
      if (souParticipante && bs.mapa_id && MAPA_STATE.mapaAtualId !== bs.mapa_id) {
        const tabMapas = document.getElementById('tab-mapas');
        const btnMesa  = document.getElementById('tab-btn-mapas');
        if (tabMapas && !tabMapas.classList.contains('active')) {
          document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
          document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
          tabMapas.classList.add('active');
          if (btnMesa) btnMesa.classList.add('active');
        }
        if (typeof selecionarMapa === 'function') selecionarMapa(bs.mapa_id);
      } else {
        _aplicarEstadoBatalhaUI();
      }
      if (bs.ordemAtual !== anteriorIdx) _notificarVez(bs, bid);
      _atualizarBadgeMesa();
    }
  }

  if (tipo === 'ataque_executado') {
    const efStr = payload.efeitos ? ` + ${payload.efeitos}` : '';
    mostrarToast(`⚔ ${payload.atacante} → ${payload.alvo}: ${payload.dano} de dano${efStr}`, 'sucesso');
  }

  if (tipo === 'aguardando_aprovacao') {
    if (RPG_DATA?.myRole === 'mestre' || AR?.myRole === 'mestre') {
      mostrarToast(`📩 Ação criativa de ${payload.atacante}: "${payload.habilidade}" — aguarda aprovação`, '');
    }
  }

  // ── BATALHA CRIADA ────────────────────────────────────────────────────────
  if (tipo === 'batalha_criada') {
    const { batalhaId, estado } = payload;
    if (!MAPA_STATE.batalhas[batalhaId] && estado) {
      MAPA_STATE.batalhas[batalhaId] = estado;
      if (typeof AudioManager !== 'undefined') {
        const hasBoss = estado.participantes?.some((p: any) => p.isBoss || p.classe_aventura === 'boss');
        AudioManager.onCombatStart(hasBoss);
      }
      _atualizarBadgeMesa();
      if (typeof _atualizarSeletorBatalhas === 'function') _atualizarSeletorBatalhas();
      const meuNome = RPG_DATA?.linked;
      const isMestre = RPG_DATA?.myRole === 'mestre';
      const souParticipante = isMestre || estado.participantes?.some((p: any) => p.nome === meuNome);
      if (souParticipante && estado.mapa_id && MAPA_STATE.mapaAtualId !== estado.mapa_id) {
        const tabMapas = document.getElementById('tab-mapas');
        const btnMesa  = document.getElementById('tab-btn-mapas');
        if (tabMapas && !tabMapas.classList.contains('active')) {
          document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
          document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
          tabMapas.classList.add('active');
          if (btnMesa) btnMesa.classList.add('active');
        }
        if (typeof selecionarMapa === 'function') selecionarMapa(estado.mapa_id);
      } else {
        _aplicarEstadoBatalhaUI();
      }
      mostrarToast(`⚔ Batalha iniciada! Role sua iniciativa.`, '');
    }
  }

  // ── INICIATIVA ROLADA POR UM JOGADOR ──────────────────────────────────────
  if (tipo === 'iniciativa_rolada') {
    const { batalhaId, nome, valor } = payload;
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (bs) {
      bs.iniciativasRoladas[nome] = valor;
      const p = bs.participantes.find(x => x.nome === nome);
      if (p) p.iniciativa = valor;
      bs.empatados = (bs.empatados || []).filter(n => n !== nome);
      if (BATALHA_ATUAL_ID === batalhaId) batalhaRenderFaseIniciativa();
      // Mestre verifica se todos já rolaram para iniciar o combate
      if (RPG_DATA?.myRole === 'mestre') batalhaVerificarIniciativasCompletas(batalhaId);
      _atualizarBadgeMesa();
      mostrarToast(`🎲 ${nome} rolou iniciativa: ${valor}`, '');
    }
  }

  // ── ESTADO GERAL DA BATALHA (fase, empate, combate) ───────────────────────
  if (tipo === 'batalha_estado') {
    const { batalhaId } = payload;
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (bs) {
      if (payload.fase) bs.fase = payload.fase;
      if (payload.participantes) bs.participantes = payload.participantes;
      if (payload.iniciativasRoladas) bs.iniciativasRoladas = payload.iniciativasRoladas;
      if (payload.empatados != null) bs.empatados = payload.empatados;
      if (payload.ordemAtual != null) bs.ordemAtual = payload.ordemAtual;
      if (payload.turnoRound != null) bs.turnoRound = payload.turnoRound;
      _atualizarBadgeMesa();
      const meuNome = RPG_DATA?.linked;
      const isMestre = RPG_DATA?.myRole === 'mestre';
      const souParticipante = isMestre || bs.participantes?.some(p => p.nome === meuNome);
      if (souParticipante && bs.mapa_id && MAPA_STATE.mapaAtualId !== bs.mapa_id) {
        const tabMapas = document.getElementById('tab-mapas');
        const btnMesa  = document.getElementById('tab-btn-mapas');
        if (tabMapas && !tabMapas.classList.contains('active')) {
          document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
          document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
          tabMapas.classList.add('active');
          if (btnMesa) btnMesa.classList.add('active');
        }
        if (typeof selecionarMapa === 'function') selecionarMapa(bs.mapa_id);
      } else {
        _aplicarEstadoBatalhaUI();
      }
      if (payload.fase === 'combate') mostrarToast('⚔ Combate iniciado! Confira a ordem de turnos.', 'sucesso');
      if (payload.fase === 'empate') mostrarToast('⚠ Empate na iniciativa! Re-role seu dado.', '');
      setTimeout(() => { _mesaRenderAcoes?.(); _mesaRenderIniciativa?.(); if(MOBILE_CTRL?.ativo) _atualizarZonaDireita?.(); }, 80);
    }
  }

  // ── BATALHA PAUSADA / RETOMADA ────────────────────────────────────────────
  if (tipo === 'batalha_pausada') {
    const { batalhaId, pausada } = payload;
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (bs) {
      bs.pausada = pausada;
      if (BATALHA_ATUAL_ID === batalhaId) batalhaRenderVezLabel();
      _atualizarBadgeMesa();
      mostrarToast(pausada ? '⏸ Batalha pausada pelo mestre' : '▶ Batalha retomada pelo mestre', '');
    }
  }

  // ── BATALHA ENCERRADA ─────────────────────────────────────────────────────
  if (tipo === 'batalha_encerrada') {
    const { batalhaId } = payload;
    if (MAPA_STATE.batalhas[batalhaId]) {
      delete MAPA_STATE.batalhas[batalhaId];
      if (typeof AudioManager !== 'undefined') AudioManager.onCombatEnd();
      if (BATALHA_ATUAL_ID === batalhaId) BATALHA_ATUAL_ID = null;
      _aplicarEstadoBatalhaUI();
      _atualizarBadgeMesa();
      if (typeof _atualizarSeletorBatalhas === 'function') _atualizarSeletorBatalhas();
      mostrarToast('⚔ Batalha encerrada pelo mestre', '');
    }
  }

  // ── CARD DE TRIGGER (visível para todos) ──────────────────────────────────
  if (tipo === 'trigger_mostrar') {
    _atkMostrarTriggerRemoto(payload);
  }
  if (tipo === 'trigger_ocultar') {
    const el = document.getElementById('atk-anim-trigger');
    if (el) el.style.display = 'none';
    const box = document.getElementById('atk-anim-trigger-box');
    if (box) box.style.pointerEvents = ''; // restaurar clicabilidade para próximo uso
  }

  // ── PERSONAGEM MORTO (marcador X no mapa) ────────────────────────────────
  if (tipo === 'personagem_morto') {
    const { nome } = payload;
    const c = (RPG_DATA?.characters || []).find(x => x.nome === nome);
    if (c) {
      if (!c.custom_attrs) c.custom_attrs = {};
      c.custom_attrs.morto = true;
    }
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mostrarToast(`💀 ${nome} foi derrotado!`, 'erro');
  }

  // ── Vol II v2.1: PERSONAGEM CAIU (estado moribundo) ─────────────────────
  if (tipo === 'personagem_caiu') {
    const { nome } = payload;
    const c = (RPG_DATA?.characters||[]).find(x => x.nome === nome);
    if (c?.custom_attrs) c.custom_attrs.moribundo = true;
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mostrarToast('☠ ' + nome + ' caiu! Salvaguardas de morte ativas.', 'erro');
  }

  // ── Vol II v2.1: PERSONAGEM ESTABILIZOU ────────────────────────────────
  if (tipo === 'personagem_estabilizou') {
    const { nome } = payload;
    const c = (RPG_DATA?.characters||[]).find(x => x.nome === nome);
    if (c?.custom_attrs) {
      c.custom_attrs.moribundo    = false;
      c.custom_attrs.estabilizado = true;
    }
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mostrarToast(nome + ' estabilizou.', 'sucesso');
  }

  // ── Vol II v2.1: FASE MUDOU (pré-combate → iniciativa) ─────────────────
  if (tipo === 'fase_mudou') {
    const { batalhaId, fase } = payload;
    const bs = MAPA_STATE.batalhas[batalhaId];
    if (bs) {
      bs.fase = fase;
      if (typeof _aplicarEstadoBatalhaUI === 'function') _aplicarEstadoBatalhaUI();
    }
  }

  // ── Vol II v2.1: EMPURRÃO EXECUTADO ────────────────────────────────────
  if (tipo === 'empurrao_executado') {
    const { alvo, col, row, mapId } = payload;
    const c = (RPG_DATA?.characters||[]).find(x => x.nome === alvo);
    if (c) {
      if (!c.map_positions) c.map_positions = {};
      c.map_positions[mapId] = { col, row };
    }
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mostrarToast('💥 ' + payload.atacante + ' empurrou ' + alvo + '!', '');
  }

  // ── Vol II v2.1: ATAQUE DE OPORTUNIDADE ────────────────────────────────
  if (tipo === 'ataque_oportunidade') {
    const { atacante, alvo, d20, acertou } = payload;
    const msg = '⚡ ' + atacante + ' ataque de oportunidade em ' + alvo +
      ' [' + d20 + ']' + (acertou ? ' — acertou!' : ' — errou.');
    mostrarToast(msg, acertou ? 'sucesso' : '');
  }

  // ── VITÓRIA DE BATALHA (exibir tela para todos) ──────────────────────────
  if (tipo === 'batalha_vitoria') {
    const { batalhaId, stats, rounds } = payload;
    // Apenas clientes que NÃO são o mestre veem — mestre já exibiu localmente
    if (RPG_DATA?.myRole !== 'mestre') {
      const bs = MAPA_STATE.batalhas[batalhaId] || { stats, turnoRound: rounds, participantes: [] as any[] };
      if (stats) bs.stats = stats;
      setTimeout(() => _mostrarTelaVitoria(bs), 600);
    }
  }

  // ── AC-02-B3: ANIMAÇÃO DE CRIATIVO (sync para jogadores offline) ──────────
  if (tipo === 'criativo_animacao') {
    _onReceberAnimacaoCriativo(payload);
  }

  // ── UX-02: Limpar badge de notificação quando mestre abre criativos ───────
  if (tipo === 'aguardando_aprovacao') {
    if (RPG_DATA?.myRole === 'mestre' || AR?.myRole === 'mestre') {
      _notificarNovoCreativoPendente();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ██  MOTOR DE ANIMAÇÃO DE ATAQUE  (Canvas 2D, zero dependências externas)
// ═══════════════════════════════════════════════════════════════════════════

// ── ID de sessão por aba — evita dupla execução no emissor ─────────────────
const _ANIM_SID = Math.random().toString(36).slice(2);

// ── Emite evento de animação para todos via canal characters ─────────────
function animBroadcast(payload: any) {
  try {
    const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
    const ws    = AR.ws || realtimeWS;
    if (!rpgId || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      topic:   `realtime:public:characters:rpg_id=eq.${rpgId}`,
      event:   'broadcast',
      payload: { type: 'broadcast', event: 'anim_ataque', payload },
      ref:     'anim_' + Date.now()
    }));
  } catch(e) { console.warn('[ANIM] Broadcast falhou:', e); }
}

// ── Recebe e executa animação vinda de outro cliente ───────────────
async function animReceberBroadcast(payload: any) {
  if (!payload?.animacao?.tipo || payload.animacao.tipo === 'nenhuma') return;
  if (payload.sid === _ANIM_SID) return; // ignorar eco do proprio emissor
  try {
    const ctx = payload.contexto;
    const atacEl = resolverTokenEl(payload.atacanteNome, ctx);
    const alvoEl = resolverTokenEl(payload.alvoNome,     ctx);
    if (atacEl && alvoEl) {
      const repeticoes = Math.max(1, parseInt(payload.animacao.repeticao) || 1);
      for (let i = 0; i < repeticoes; i++) {
        await animarAtaque({ atacEl, alvoEl, animacao: payload.animacao, dano: payload.dano });
        if (i < repeticoes - 1) await new Promise(r => setTimeout(r, 120));
      }
    }
  } catch(e) { console.warn('[ANIM] Erro ao receber animacao remota:', e); }
}

// ── Helper compartilhado: roda animacao localmente E emite para os outros ─
async function _atkRodarAnimacao() {
  const h = COMBATE.habilidadeSel;
  if (!h?.animacao?.tipo || h.animacao.tipo === 'nenhuma') return;

  const payload = {
    sid:           _ANIM_SID,
    atacanteNome:  COMBATE.atacanteNome,
    alvoNome:      COMBATE.alvoNome,
    contexto:      COMBATE.contexto,
    animacao:      h.animacao,
    dano:          COMBATE.dadosRolados?.total ?? null,
  };

  // Emite para os outros ANTES de rodar localmente (nao bloqueia)
  animBroadcast(payload);

  // Roda localmente (com repetições)
  try {
    const atacEl = resolverTokenEl(COMBATE.atacanteNome, COMBATE.contexto);
    const alvoEl = resolverTokenEl(COMBATE.alvoNome,    COMBATE.contexto);
    if (atacEl && alvoEl) {
      const repeticoes = Math.max(1, parseInt(h.animacao.repeticao) || 1);
      for (let i = 0; i < repeticoes; i++) {
        await animarAtaque({ atacEl, alvoEl, animacao: h.animacao, dano: payload.dano });
        if (i < repeticoes - 1) await new Promise(r => setTimeout(r, 120)); // pausa breve entre ciclos
      }
    }
  } catch(e) { console.warn('[ANIM] Erro na animacao local:', e); }
}

// ── Resolve elemento DOM do token pelo nome + contexto ─────────────────────
function resolverTokenEl(nome: any, contexto: any) {
  if (!nome) return null;
  const esc = CSS.escape(nome);
  if (contexto === 'arena') {
    return document.querySelector(`.ar-mesa-token[data-nome="${esc}"]`);
  } else {
    return document.querySelector(`.mapa-token[data-nome="${esc}"]`);
  }
}

function _animCriarCanvas() {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10100';
  c.width  = window.innerWidth;
  c.height = window.innerHeight;
  document.body.appendChild(c);
  return c;
}

function _animCentro(el: any) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function _animHexToRgb(hex: any) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map((c: any)=>c+c).join('');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  return `${r},${g},${b}`;
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "combateBroadcast", { configurable: true, get: () => combateBroadcast, set: (__v) => { combateBroadcast = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "combateReceberBroadcast", { configurable: true, get: () => combateReceberBroadcast, set: (__v) => { combateReceberBroadcast = __v; } });
Object.defineProperty(globalThis, "_ANIM_SID", { configurable: true, get: () => _ANIM_SID });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animBroadcast", { configurable: true, get: () => animBroadcast, set: (__v) => { animBroadcast = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animReceberBroadcast", { configurable: true, get: () => animReceberBroadcast, set: (__v) => { animReceberBroadcast = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_atkRodarAnimacao", { configurable: true, get: () => _atkRodarAnimacao, set: (__v) => { _atkRodarAnimacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "resolverTokenEl", { configurable: true, get: () => resolverTokenEl, set: (__v) => { resolverTokenEl = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animCriarCanvas", { configurable: true, get: () => _animCriarCanvas, set: (__v) => { _animCriarCanvas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animCentro", { configurable: true, get: () => _animCentro, set: (__v) => { _animCentro = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animHexToRgb", { configurable: true, get: () => _animHexToRgb, set: (__v) => { _animHexToRgb = __v; } });
