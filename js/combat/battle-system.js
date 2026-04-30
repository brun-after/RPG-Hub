// js/combat/battle-system.js
// RPG Hub — Advanced Battle System: reactions, passive abilities, active defense, event queue
// Implements: CampaignBattleConfig, EventQueue, TriggerDetection, ActiveDefense, DegreesOfSuccess

// ─── DEFAULTS POR SISTEMA ────────────────────────────────────────────────────
const BATTLE_CONFIG_DEFAULTS = {
  dnd5e: {
    usa_reacoes: true,
    sistema_reacao: 'dnd5e',
    max_reacoes_por_rodada: 1,
    reacoes_podem_interromper: true,
    passivas_automaticas: true,
    notificar_passivas: false,
    tipo_defesa: 'passiva',
    defesa_consome_reacao: false,
    graus_de_sucesso: false,
    max_defesas_por_rodada: 'unlimited',
    penalidade_defesa_extra: null,
  },
  pf2e: {
    usa_reacoes: true,
    sistema_reacao: 'pf2e',
    max_reacoes_por_rodada: 1,
    reacoes_podem_interromper: true,
    passivas_automaticas: true,
    notificar_passivas: false,
    tipo_defesa: 'passiva',
    defesa_consome_reacao: false,
    graus_de_sucesso: true,
    max_defesas_por_rodada: 'unlimited',
    penalidade_defesa_extra: null,
  },
  pf1e: {
    usa_reacoes: true,
    sistema_reacao: 'pf1e',
    max_reacoes_por_rodada: 'unlimited',
    reacoes_podem_interromper: false,
    passivas_automaticas: true,
    notificar_passivas: false,
    tipo_defesa: 'passiva',
    defesa_consome_reacao: false,
    graus_de_sucesso: false,
    max_defesas_por_rodada: 'unlimited',
    penalidade_defesa_extra: null,
  },
  narrativo: {
    usa_reacoes: true,
    sistema_reacao: 'narrativo',
    max_reacoes_por_rodada: 1,
    reacoes_podem_interromper: false,
    passivas_automaticas: false,
    notificar_passivas: true,
    tipo_defesa: 'ativa',
    defesa_consome_reacao: true,
    graus_de_sucesso: false,
    max_defesas_por_rodada: 2,
    penalidade_defesa_extra: -2,
  },
  custom: {
    usa_reacoes: false,
    sistema_reacao: 'custom',
    max_reacoes_por_rodada: 1,
    reacoes_podem_interromper: false,
    passivas_automaticas: true,
    notificar_passivas: false,
    tipo_defesa: 'passiva',
    defesa_consome_reacao: false,
    graus_de_sucesso: false,
    max_defesas_por_rodada: 'unlimited',
    penalidade_defesa_extra: null,
  },
};

// ─── TIPOS DE GATILHO VÁLIDOS ─────────────────────────────────────────────────
const TRIGGER_TYPES = [
  'ser_atacado',
  'ser_atingido',
  'sofrer_dano',
  'sofrer_dano_tipo',
  'aliado_atacado',
  'aliado_danificado',
  'inimigo_move_adjacente',
  'inimigo_sai_alcance',
  'inimigo_conjura',
  'inicio_turno_proprio',
  'fim_turno_proprio',
  'inicio_turno_alheio',
  'ser_reduzido_zero',
  'acertar_critico',
  'matar_inimigo',
  'custom',
];

// ─── CONTROLADOR PRINCIPAL ────────────────────────────────────────────────────
const BATTLE_SYSTEM = {
  _fila: [],
  _processando: false,
  _pendingReactions: {},

  // ── Config da campanha ───────────────────────────────────────────────────
  getConfig() {
    const theme = window.CURRENT_RPG?.theme || {};
    const cfg = theme.battle_config || {};
    const sistema = cfg.sistema_reacao || 'custom';
    const defaults = BATTLE_CONFIG_DEFAULTS[sistema] || BATTLE_CONFIG_DEFAULTS.custom;
    return { ...defaults, ...cfg };
  },

  async setConfig(cfg) {
    if (!window.CURRENT_RPG) return;
    if (!CURRENT_RPG.theme) CURRENT_RPG.theme = {};
    CURRENT_RPG.theme.battle_config = cfg;
    const novoTheme = { ...CURRENT_RPG.theme };
    try {
      const rpgId = RPG_DATA?.rpgId || CURRENT_RPG?.id;
      if (!rpgId) return;
      await sb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ theme_json: novoTheme }),
      });
    } catch (e) {
      console.error('[BattleSystem] Erro ao salvar config:', e);
    }
  },

  // ── Recursos do participante ─────────────────────────────────────────────
  getRecursos(nomeChar) {
    if (!BATALHA_ATUAL_ID) return null;
    const bs = MAPA_STATE.batalhas?.[BATALHA_ATUAL_ID];
    if (!bs) return null;
    if (!bs.recursos_participantes) bs.recursos_participantes = {};
    if (!bs.recursos_participantes[nomeChar]) {
      const cfg = this.getConfig();
      const maxDef = cfg.max_defesas_por_rodada === 'unlimited' ? 99 : (cfg.max_defesas_por_rodada || 1);
      bs.recursos_participantes[nomeChar] = {
        reacao_disponivel: true,
        slots_defesa_restantes: maxDef,
        penalidade_defesa_atual: 0,
      };
    }
    return bs.recursos_participantes[nomeChar];
  },

  consumirReacao(nomeChar) {
    const rec = this.getRecursos(nomeChar);
    if (!rec?.reacao_disponivel) return false;
    rec.reacao_disponivel = false;
    return true;
  },

  recuperarRecursosTurno(nomeChar) {
    const rec = this.getRecursos(nomeChar);
    if (!rec) return;
    const cfg = this.getConfig();
    rec.reacao_disponivel = true;
    rec.slots_defesa_restantes = cfg.max_defesas_por_rodada === 'unlimited' ? 99 : (cfg.max_defesas_por_rodada || 1);
    rec.penalidade_defesa_atual = 0;
    if (typeof salvarEstadoBatalha === 'function') {
      salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
    }
  },

  // ── Dispatch de evento ───────────────────────────────────────────────────
  async dispatchEvento(tipoEvento, dados = {}) {
    if (!BATALHA_ATUAL_ID) return;
    const cfg = this.getConfig();
    if (!cfg.usa_reacoes) return;

    const evento = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipo: tipoEvento,
      dados,
      timestamp: Date.now(),
      _cancelado: false,
    };

    this._fila.push(evento);
    if (!this._processando) await this._processarFila();
  },

  async _processarFila() {
    this._processando = true;
    while (this._fila.length > 0) {
      const evento = this._fila.shift();
      await this._resolverEvento(evento);
    }
    this._processando = false;
  },

  async _resolverEvento(evento) {
    const cfg = this.getConfig();
    const habs = this._detectarGatilhos(evento);

    const passivas    = habs.filter(h => h.tipo_reativa === 'passive' || h.auto_reativa);
    const manuais     = habs.filter(h => h.tipo_reativa !== 'passive' && !h.auto_reativa);
    const interrupcoes = manuais.filter(h => h.momento_reativa === 'before' && h.tipo_reativa === 'interrupt');
    const posEvento    = manuais.filter(h => !(h.momento_reativa === 'before' && h.tipo_reativa === 'interrupt'));

    // Passivas automáticas
    if (cfg.passivas_automaticas) {
      for (const h of passivas) {
        await this._executarPassiva(h, evento);
      }
    }

    // Interrupções (antes do evento)
    if (cfg.reacoes_podem_interromper) {
      for (const h of interrupcoes) {
        const aceita = await this._solicitarReacao(h, evento);
        if (aceita) {
          await this._executarReacao(h, evento);
          if (evento._cancelado) return;
        }
      }
    }

    // Registrar no log
    this._logEvento(evento);

    // Reações pós-evento
    for (const h of posEvento) {
      const aceita = await this._solicitarReacao(h, evento);
      if (aceita) await this._executarReacao(h, evento);
    }
  },

  // ── Contexto de personagem por tipo de evento ───────────────────────────
  _getContextoPersonagem(evento) {
    const d = evento.dados || {};
    switch (evento.tipo) {
      case 'sofrer_dano':
      case 'ser_atacado':
      case 'ser_reduzido_zero':
        return d.alvo ?? null;
      case 'matar_inimigo':
      case 'acertar_critico':
      case 'causar_dano':
        return d.atacante ?? null;
      case 'inimigo_sai_alcance':
      case 'inimigo_move_adjacente':
        return d.jogador ?? null;
      case 'inicio_turno_proprio':
        return d.personagem ?? null;
      default:
        return null;
    }
  },

  // ── Detecção de gatilhos ─────────────────────────────────────────────────
  _detectarGatilhos(evento) {
    const participantes = this._getParticipantes();
    const contextChar = this._getContextoPersonagem(evento);
    const skills = RPG_DATA?.skills || [];
    const chars  = RPG_DATA?.characters || [];
    const resultado = [];

    for (const nome of participantes) {
      if (contextChar !== null && contextChar !== nome) continue;

      // Skills da tabela (campanha)
      const skReativas = skills.filter(sk =>
        sk.personagem === nome &&
        sk.tipo_reativa &&
        sk.gatilho_tipo === evento.tipo
      );
      for (const sk of skReativas) resultado.push({ ...sk, _dono: nome });

      // Habilidades inline no custom_attrs (arena/legado)
      const char = chars.find(c => c.nome === nome);
      const habs = char?.custom_attrs?.habilidades || [];
      for (const h of habs) {
        if (h.tipo_reativa && h.gatilho_tipo === evento.tipo) {
          resultado.push({ ...h, _dono: nome });
        }
      }
    }
    return resultado;
  },

  _getParticipantes() {
    const bs = MAPA_STATE.batalhas?.[BATALHA_ATUAL_ID];
    return (bs?.participantes || [])
      .map(p => (typeof p === 'string' ? p : p?.nome))
      .filter(Boolean);
  },

  // ── Executar passiva ─────────────────────────────────────────────────────
  async _executarPassiva(hab, evento) {
    const dono = hab._dono;
    if (!dono) return;
    if (typeof window.atkAplicarEfeitoPassiva === 'function') {
      await window.atkAplicarEfeitoPassiva(hab, dono, evento);
    }
    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('efeito', {
        nome: hab.habilidade || hab.nome || 'Passiva',
        alvo: dono,
        ehPositivo: true,
        gatilho: evento.tipo,
      });
    }
    if (typeof mostrarToast === 'function') {
      mostrarToast(`⚡ ${hab.habilidade || hab.nome || 'Passiva'} ativado (${dono})`, 'ok');
    }
  },

  // ── Solicitar reação manual ──────────────────────────────────────────────
  async _solicitarReacao(hab, evento) {
    const dono = hab._dono;
    if (!dono) return false;
    const custo = hab.custo_reativa || 'reaction';

    if (custo === 'reaction') {
      const rec = this.getRecursos(dono);
      if (!rec?.reacao_disponivel) return false;
    }

    const reacaoId = `reac_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const timeout_ms = 15000;

    if (typeof combateBroadcast === 'function') {
      combateBroadcast('solicitacao_reacao', {
        reacaoId,
        habilidade: hab.habilidade || hab.nome,
        gatilho: hab.gatilho_descricao || evento.tipo,
        gatilho_tipo: hab.gatilho_tipo,
        dono,
        custo,
        momento: hab.momento_reativa || 'after',
        eventoTipo: evento.tipo,
        eventoDados: evento.dados,
        timeout_ms,
      });
    }

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        delete this._pendingReactions[reacaoId];
        resolve(false);
      }, timeout_ms);
      this._pendingReactions[reacaoId] = { resolve, timer, hab, dono };
    });
  },

  confirmarReacao(reacaoId, aceita) {
    const pending = this._pendingReactions[reacaoId];
    if (!pending) return;
    clearTimeout(pending.timer);
    delete this._pendingReactions[reacaoId];
    if (aceita) {
      const custo = pending.hab?.custo_reativa || 'reaction';
      if (custo === 'reaction') this.consumirReacao(pending.dono);
    }
    pending.resolve(aceita);
  },

  // ── Executar reação ──────────────────────────────────────────────────────
  async _executarReacao(hab, evento) {
    const dono = hab._dono;
    if (typeof window.atkAplicarEfeitoPassiva === 'function') {
      await window.atkAplicarEfeitoPassiva(hab, dono, evento);
    }
    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('efeito', {
        nome: hab.habilidade || hab.nome || 'Reação',
        alvo: dono,
        ehPositivo: true,
        gatilho: evento.tipo,
      });
    }
    if (typeof combateBroadcast === 'function') {
      combateBroadcast('reacao_executada', {
        personagem: dono,
        habilidade: hab.habilidade || hab.nome,
        eventoTipo: evento.tipo,
      });
    }
  },

  _logEvento(evento) {
    const labels = {
      ser_atacado: '🎯 Ser Atacado',
      ser_atingido: '⚔️ Atingido',
      sofrer_dano: '💥 Dano Recebido',
      acertar_critico: '🎯 Crítico',
      matar_inimigo: '💀 Inimigo Derrotado',
      inimigo_move_adjacente: '↗️ Inimigo Adjacente',
      inimigo_sai_alcance: '↩️ Saiu do Alcance',
      ser_reduzido_zero: '💀 Reduzido a 0',
    };
    if (typeof COMBATE_LOG !== 'undefined' && labels[evento.tipo]) {
      COMBATE_LOG.adicionar('efeito', {
        nome: labels[evento.tipo],
        alvo: evento.dados?.alvo || '',
        ehPositivo: false,
        gatilho: evento.tipo,
      });
    }
  },

  // ─── DEFESA ATIVA ────────────────────────────────────────────────────────
  async resolverDefesaAtiva(nomeAlvo, resultadoAtacante, tipoAtaque) {
    const cfg = this.getConfig();
    if (cfg.tipo_defesa === 'passiva') return null;

    const rec = this.getRecursos(nomeAlvo);
    if (!rec) return null;

    const temSlot    = rec.slots_defesa_restantes > 0;
    const temReacao  = !cfg.defesa_consome_reacao || rec.reacao_disponivel;
    if (!temSlot || !temReacao) return null;

    const defesaId  = `def_${Date.now()}`;
    const timeout_ms = 12000;

    if (typeof combateBroadcast === 'function') {
      combateBroadcast('solicitacao_defesa_ativa', {
        defesaId,
        alvo: nomeAlvo,
        resultadoAtacante,
        tipoAtaque,
        penalidade: rec.penalidade_defesa_atual,
        slotsRestantes: rec.slots_defesa_restantes,
        consome_reacao: cfg.defesa_consome_reacao,
        timeout_ms,
      });
    }

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        delete this._pendingReactions[defesaId];
        resolve(null);
      }, timeout_ms);
      this._pendingReactions[defesaId] = {
        resolve, timer,
        tipo: 'defesa', alvo: nomeAlvo, cfg, rec,
      };
    });
  },

  confirmarDefesa(defesaId, aceita, resultadoDefesa) {
    const pending = this._pendingReactions[defesaId];
    if (!pending || pending.tipo !== 'defesa') return;
    clearTimeout(pending.timer);
    delete this._pendingReactions[defesaId];

    if (!aceita) { pending.resolve(null); return; }

    const { cfg, rec, alvo } = pending;
    if (cfg.defesa_consome_reacao) this.consumirReacao(alvo);
    rec.slots_defesa_restantes = Math.max(0, rec.slots_defesa_restantes - 1);
    if (cfg.penalidade_defesa_extra !== null && rec.slots_defesa_restantes === 0) {
      rec.penalidade_defesa_atual += Math.abs(cfg.penalidade_defesa_extra || 0);
    }
    pending.resolve(resultadoDefesa);
  },

  // ─── GRAUS DE SUCESSO ────────────────────────────────────────────────────
  calcularGrauSucesso(resultado, limiar, natural = null) {
    const cfg = this.getConfig();
    if (!cfg.graus_de_sucesso) return null;

    if (natural === 20 || resultado >= limiar + 10) {
      return { grau: 'sucesso_critico', label: 'Sucesso Crítico', cor: '#f0cc6a', multiplicadorDano: 0 };
    }
    if (natural === 1 || resultado <= limiar - 10) {
      return { grau: 'falha_critica', label: 'Falha Crítica', cor: '#c0392b', multiplicadorDano: 2 };
    }
    if (resultado >= limiar) {
      return { grau: 'sucesso', label: 'Sucesso', cor: '#5ee09a', multiplicadorDano: 0.5 };
    }
    return { grau: 'falha', label: 'Falha', cor: '#e8604c', multiplicadorDano: 1 };
  },
};

// ─── FUNÇÕES GLOBAIS DE INTEGRAÇÃO ───────────────────────────────────────────

function battleDispatchEvento(tipo, dados = {}) {
  BATTLE_SYSTEM.dispatchEvento(tipo, dados).catch(e =>
    console.error('[BattleSystem] Erro no evento', tipo, e)
  );
}

function battleRecuperarRecursosTurno(nomeChar) {
  BATTLE_SYSTEM.recuperarRecursosTurno(nomeChar);
  battleDispatchEvento('inicio_turno_proprio', { personagem: nomeChar });
}

// ─── HANDLERS REALTIME ────────────────────────────────────────────────────────

window.batalhaReceberSolicitacaoReacao = function(payload) {
  const { reacaoId, habilidade, gatilho, dono, timeout_ms } = payload;
  const meuChar = RPG_DATA?.linked;
  if (meuChar !== dono && RPG_DATA?.myRole !== 'mestre') return;
  if (typeof mostrarPainelReacao === 'function') {
    mostrarPainelReacao(reacaoId, habilidade, gatilho, dono, timeout_ms);
  }
};

window.batalhaReceberSolicitacaoDefesa = function(payload) {
  const { defesaId, alvo, resultadoAtacante, tipoAtaque, penalidade, slotsRestantes, timeout_ms } = payload;
  const meuChar = RPG_DATA?.linked;
  if (meuChar !== alvo && RPG_DATA?.myRole !== 'mestre') return;
  if (typeof mostrarPainelDefesaAtiva === 'function') {
    mostrarPainelDefesaAtiva(defesaId, alvo, resultadoAtacante, tipoAtaque, penalidade, slotsRestantes, timeout_ms);
  }
};

window.batalhaReceberConfirmacaoReacao = function(payload) {
  const { reacaoId, aceita } = payload;
  BATTLE_SYSTEM.confirmarReacao(reacaoId, aceita);
};

window.batalhaReceberReacaoExecutada = function(payload) {
  if (typeof mostrarToast === 'function') {
    mostrarToast(`⚡ ${payload.personagem}: ${payload.habilidade}`, 'ok');
  }
};

window.batalhaReceberDefesaResolvida = function(payload) {
  const { defesaId, tipoDefesa, resultado, d20 } = payload;
  const pending = BATTLE_SYSTEM._pendingReactions[defesaId];
  if (pending) {
    BATTLE_SYSTEM.confirmarDefesa(defesaId, true, { tipo: tipoDefesa, resultado, d20 });
  }
};

// ─── STUB PARA EFEITOS PASSIVOS (pode ser sobrescrito por combat.js) ──────────
if (typeof window.atkAplicarEfeitoPassiva === 'undefined') {
  window.atkAplicarEfeitoPassiva = async function(hab, dono, evento) {
    console.log('[BattleSystem] Passiva:', hab.habilidade || hab.nome, '|', dono, '|', evento.tipo);
    if (typeof mostrarToast === 'function') {
      mostrarToast(`⚡ ${hab.habilidade || hab.nome || 'Passiva'} ativado!`, 'ok');
    }
  };
}

console.log('[BattleSystem] Sistema de batalha avançado carregado ✓');
