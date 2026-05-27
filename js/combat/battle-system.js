// js/combat/battle-system.js
// RPG Hub — Advanced Battle System: reactions, passive abilities, active defense, event queue
// Implements: CampaignBattleConfig, EventQueue, TriggerDetection, ActiveDefense, DegreesOfSuccess
// VERSÃO CORRIGIDA: Adiciona validação de contexto e debugging para habilidades reativas

// ─── DEFAULTS POR SISTEMA ────────────────────────────────────────────────────
// Prefixed to avoid collision with _BS_DEFAULTS declared in maps.js
const _BS_DEFAULTS = {
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
  'efeito_atrasado_expirou', // Disparado internamente quando um efeito atrasado expira
];

// ─── CONFIGURAÇÃO DE DEBUG ────────────────────────────────────────────────────
const DEBUG_MODE = false; // Mude para true para ativar logs detalhados

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
    const defaults = _BS_DEFAULTS[sistema] || _BS_DEFAULTS.custom;
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
    if (typeof salvarEstadoBatalha === 'function' && BATALHA_ATUAL_ID) {
      salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
    }
    return true;
  },

  // Aplica cooldown de uma habilidade reativa na batalha atual
  _aplicarCooldownReativa(hab) {
    if (!BATALHA_ATUAL_ID) return;
    const cdKey = hab?.id || hab?.nome || hab?.habilidade;
    if (!cdKey) return;
    const cd = parseInt(hab.cooldown_turnos) || 0;
    if (cd <= 0) return;
    const bs = MAPA_STATE.batalhas?.[BATALHA_ATUAL_ID];
    if (!bs) return;
    if (!bs.cooldowns) bs.cooldowns = {};
    bs.cooldowns[cdKey] = cd;
    if (typeof salvarEstadoBatalha === 'function') {
      salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
    }
  },

  _estaEmCooldown(hab) {
    if (!BATALHA_ATUAL_ID) return false;
    const cdKey = hab?.id || hab?.nome || hab?.habilidade;
    if (!cdKey) return false;
    const bs = MAPA_STATE.batalhas?.[BATALHA_ATUAL_ID];
    return !!(bs?.cooldowns && bs.cooldowns[cdKey] > 0);
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

    // VALIDAÇÃO: Para eventos de ataque/dano, garantir que dados críticos existem
    const eventosDeAtaque = ['ser_atacado', 'ser_atingido', 'sofrer_dano', 'sofrer_dano_tipo'];
    if (eventosDeAtaque.includes(tipoEvento)) {
      if (!dados.alvo) {
        console.error(`[BattleSystem] ⚠️ ERRO: Evento "${tipoEvento}" disparado sem alvo definido!`, dados);
        if (typeof mostrarToast === 'function') mostrarToast('Erro interno: reação/passiva sem alvo definido', 'erro', 3000);
        return;
      }
      if (DEBUG_MODE) {
        console.log(`[BattleSystem DEBUG] Evento: ${tipoEvento}`);
        console.log(`[BattleSystem DEBUG]   └─ Alvo (quem sofre): ${dados.alvo}`);
        console.log(`[BattleSystem DEBUG]   └─ Atacante: ${dados.atacante || 'não especificado'}`);
      }
    }

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

    const _tipo = h => h.tipo_habilidade || h.tipo_reativa || '';
    const _momento = h => h.momento || h.momento_reativa || 'after';
    const _auto = h => h.auto_trigger ?? h.auto_reativa ?? false;
    const passivas    = habs.filter(h => _tipo(h) === 'passive' || _auto(h));
    const manuais     = habs.filter(h => _tipo(h) !== 'passive' && !_auto(h));
    const interrupcoes = manuais.filter(h => _momento(h) === 'before' && _tipo(h) === 'interrupt');
    const posEvento    = manuais.filter(h => !(_momento(h) === 'before' && _tipo(h) === 'interrupt'));

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
    let contexto = null;
    
    switch (evento.tipo) {
      // Eventos onde o ALVO é quem sofre (defender/receber dano)
      case 'sofrer_dano':
      case 'sofrer_dano_tipo':
      case 'ser_atacado':
      case 'ser_atingido':
      case 'ser_reduzido_zero':
        contexto = d.alvo ?? null;
        break;
        
      // Eventos onde o ATACANTE é quem age
      case 'matar_inimigo':
      case 'acertar_critico':
      case 'causar_dano':
        contexto = d.atacante ?? null;
        break;
        
      // Eventos de movimento/posicionamento
      case 'inimigo_sai_alcance':
      case 'inimigo_move_adjacente':
        contexto = d.jogador ?? null;
        break;
        
      // Eventos de turno
      case 'inicio_turno_proprio':
      case 'fim_turno_proprio':
        contexto = d.personagem ?? null;
        break;
        
      // Eventos que afetam aliados - não tem contexto específico
      case 'aliado_atacado':
      case 'aliado_danificado':
        contexto = null; // Permite verificar todos os participantes
        break;
        
      default:
        contexto = null;
    }
    
    if (DEBUG_MODE && contexto) {
      console.log(`[BattleSystem DEBUG] Contexto identificado para "${evento.tipo}": ${contexto}`);
    }
    
    return contexto;
  },

  // ── Detecção de gatilhos ─────────────────────────────────────────────────
  _detectarGatilhos(evento) {
    const participantes = this._getParticipantes();
    const contextChar = this._getContextoPersonagem(evento);
    const skills = RPG_DATA?.skills || [];
    const chars  = RPG_DATA?.characters || [];
    const resultado = [];

    if (DEBUG_MODE) {
      console.log(`[BattleSystem DEBUG] ═══ Detectando gatilhos para evento "${evento.tipo}" ═══`);
      console.log(`[BattleSystem DEBUG] Participantes da batalha:`, participantes);
      console.log(`[BattleSystem DEBUG] Contexto do evento:`, contextChar || 'NENHUM (todos os participantes)');
    }

    for (const nome of participantes) {
      // CORREÇÃO: Apenas processar habilidades se:
      // 1. O personagem é o contexto relevante para este evento, OU
      // 2. O evento não tem contexto específico (ex: aliado_atacado)
      if (contextChar !== null && contextChar !== nome) {
        if (DEBUG_MODE) {
          console.log(`[BattleSystem DEBUG]   └─ Pulando ${nome} (não é o contexto ${contextChar})`);
        }
        continue;
      }

      if (DEBUG_MODE) {
        console.log(`[BattleSystem DEBUG]   └─ Verificando habilidades de ${nome}...`);
      }

      // Skills da tabela (campanha) — aceita tipo_habilidade (DB migration) ou tipo_reativa (legado)
      const skReativas = skills.filter(sk =>
        sk.personagem === nome &&
        (sk.tipo_habilidade || sk.tipo_reativa) &&
        (sk.tipo_habilidade !== 'acao') &&
        sk.gatilho_tipo === evento.tipo
      );
      
      for (const sk of skReativas) {
        // SEGURANÇA: Garantir que o dono está correto
        const candidata = { ...sk, _dono: sk.personagem || nome };
        
        // BUG-FIX: ignorar habilidades em cooldown
        if (this._estaEmCooldown(candidata)) {
          if (DEBUG_MODE) {
            console.log(`[BattleSystem DEBUG]      └─ ⏱️ ${candidata.habilidade || candidata.nome} (cooldown ativo)`);
          }
          continue;
        }
        
        if (DEBUG_MODE) {
          console.log(`[BattleSystem DEBUG]      └─ ✓ ${candidata.habilidade || candidata.nome} (dono: ${candidata._dono})`);
        }
        
        resultado.push(candidata);
      }

      // Habilidades inline no custom_attrs (arena/legado)
      const char = chars.find(c => c.nome === nome);
      const habs = char?.custom_attrs?.habilidades || [];
      for (const h of habs) {
        if ((h.tipo_habilidade || h.tipo_reativa) && h.gatilho_tipo === evento.tipo) {
          // SEGURANÇA: Garantir que o dono está correto
          const candidata = { ...h, _dono: nome };
          
          if (this._estaEmCooldown(candidata)) {
            if (DEBUG_MODE) {
              console.log(`[BattleSystem DEBUG]      └─ ⏱️ ${candidata.habilidade || candidata.nome} (cooldown ativo)`);
            }
            continue;
          }
          
          if (DEBUG_MODE) {
            console.log(`[BattleSystem DEBUG]      └─ ✓ ${candidata.habilidade || candidata.nome} (inline, dono: ${candidata._dono})`);
          }
          
          resultado.push(candidata);
        }
      }
    }
    
    if (DEBUG_MODE) {
      console.log(`[BattleSystem DEBUG] Total de habilidades detectadas: ${resultado.length}`);
      if (resultado.length === 0) {
        console.log(`[BattleSystem DEBUG] ⚠️ Nenhuma habilidade reativa encontrada para este evento!`);
        console.log(`[BattleSystem DEBUG]    Verifique se:`);
        console.log(`[BattleSystem DEBUG]    - As habilidades têm gatilho_tipo = "${evento.tipo}"`);
        console.log(`[BattleSystem DEBUG]    - O personagem "${contextChar || 'correto'}" possui essas habilidades`);
        console.log(`[BattleSystem DEBUG]    - As habilidades não estão em cooldown`);
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
    
    // VALIDAÇÃO: Verificar se o dono está correto antes de solicitar
    if (DEBUG_MODE) {
      console.log(`[BattleSystem DEBUG] Solicitando reação "${hab.habilidade || hab.nome}" para ${dono}`);
    }
    
    // BUG-FIX: bloquear se a habilidade está em cooldown
    if (this._estaEmCooldown(hab)) return false;
    const custo = hab.custo_reativa || 'reaction';

    if (custo === 'reaction') {
      const rec = this.getRecursos(dono);
      if (!rec?.reacao_disponivel) {
        if (DEBUG_MODE) {
          console.log(`[BattleSystem DEBUG]   └─ ❌ ${dono} não tem reação disponível`);
        }
        return false;
      }
    }

    const reacaoId = `reac_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const timeout_ms = 15000;

    if (typeof combateBroadcast === 'function') {
      const _ed = evento.dados || {};
      const _ctxParts = [
        _ed.atacante ? _ed.atacante + ' atacou' : null,
        _ed.dano != null ? _ed.dano + ' de dano' : null,
        _ed.dano != null && _ed.dano_reduzido != null ? '→ ' + _ed.dano_reduzido + ' com reação' : null,
      ].filter(Boolean);
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
        contexto: _ctxParts.join(' — ') || null,
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
      // BUG-FIX: aplicar cooldown da skill reativa e persistir
      this._aplicarCooldownReativa(pending.hab);
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

// ─── HANDLERS REALTIME ──────────────────────────────────────────────────────

window.batalhaReceberSolicitacaoReacao = function(payload) {
  const { reacaoId, habilidade, gatilho, dono, timeout_ms, contexto } = payload;
  const meuChar = RPG_DATA?.linked;
  if (meuChar !== dono && RPG_DATA?.myRole !== 'mestre') return;
  if (typeof mostrarPainelReacao === 'function') {
    mostrarPainelReacao(reacaoId, habilidade, gatilho, dono, timeout_ms, contexto || null);
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

// ─── IMPLEMENTAÇÃO DE EFEITOS PASSIVOS COM ANIMAÇÃO ──────────────────────────
// Sobrescreve o stub padrão com uma implementação completa que roda animações
if (typeof window.atkAplicarEfeitoPassiva === 'undefined') {
  window.atkAplicarEfeitoPassiva = async function(hab, dono, evento) {
    const animacao = hab.animacao;
    
    // Se a habilidade tem animação configurada, rodar a animação
    if (animacao && animacao.tipo && animacao.tipo !== 'nenhuma') {
      try {
        // Determinar atacante e alvo baseado no tipo de gatilho
        let atacanteNome = dono;
        let alvoNome = null;
        
        // Para gatilhos "sofrer_dano" ou "ser_atacado", o alvo é quem disparou a reação
        if (evento.tipo === 'sofrer_dano' || evento.tipo === 'ser_atacado' || evento.tipo === 'ser_atingido') {
          alvoNome = evento.dados?.alvo || dono;
          atacanteNome = dono;
        } else if (evento.tipo === 'acertar_critico' || evento.tipo === 'causar_dano' || evento.tipo === 'matar_inimigo') {
          atacanteNome = dono;
          alvoNome = evento.dados?.alvo || evento.dados?.target || null;
        } else if (evento.tipo === 'inimigo_move_adjacente' || evento.tipo === 'inimigo_sai_alcance') {
          atacanteNome = dono;
          alvoNome = evento.dados?.inimigo || evento.dados?.personagem || null;
        } else {
          alvoNome = dono;
        }

        // Se não temos alvo válido, não rodar animação
        if (!alvoNome) {
          console.log('[BattleSystem] Sem alvo definido para animação reativa de', hab.habilidade || hab.nome);
        } else {
          // Resolver tokens do mapa/arena
          const ctx = COMBATE?.contexto || (BATALHA_ATUAL_ID ? 'campanha' : 'arena');
          
          // Função auxiliar para resolver token (similar a resolverTokenEl)
          const _resolverToken = (nome, contexto) => {
            if (!nome) return null;
            const esc = CSS.escape(nome);
            if (contexto === 'arena') {
              return document.querySelector(`.ar-mesa-token[data-nome="${esc}"]`);
            } else {
              return document.querySelector(`.mapa-token[data-nome="${esc}"]`);
            }
          };

          const atacEl = _resolverToken(atacanteNome, ctx);
          const alvoEl = _resolverToken(alvoNome, ctx);

          // Se encontrou os elementos, disparar animação
          if (atacEl && alvoEl && typeof animarAtaque === 'function') {
            try {
              const repeticoes = Math.max(1, parseInt(animacao.repeticao) || 1);
              
              // Broadcast da animação para todos os clientes
              if (typeof animBroadcast === 'function') {
                animBroadcast({
                  sid: _ANIM_SID || 'local',
                  atacanteNome,
                  alvoNome,
                  contexto: ctx,
                  animacao,
                  dano: null,
                });
              }

              // Executar animação localmente
              for (let i = 0; i < repeticoes; i++) {
                await animarAtaque({ atacEl, alvoEl, animacao, dano: null });
                if (i < repeticoes - 1) await new Promise(r => setTimeout(r, 120));
              }
            } catch(e) {
              console.warn('[BattleSystem] Erro ao executar animação da reação:', e);
            }
          }
        }
      } catch(e) {
        console.warn('[BattleSystem] Erro ao processar animação passiva:', e);
      }
    }

    // Log de execução
    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('efeito', {
        nome: hab.habilidade || hab.nome || 'Passiva',
        alvo: dono,
        ehPositivo: true,
        gatilho: evento.tipo,
      });
    }
  };
}

console.log('[BattleSystem] Sistema de batalha avançado carregado ✓ (versão corrigida com validações)');
