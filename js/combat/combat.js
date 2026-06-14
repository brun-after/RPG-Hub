// combat/combat.js
// RPG Hub — Combat system: dice formula parser, attack modals, skill system, creative actions
// Includes: parsearFormulaDano(), rolarFormula(), atkModal*, COMBATE state, skill handling

// ═══════════════════════════════════════════════════════════════
// ⚔ SISTEMA DE COMBATE — Parser de fórmulas, rolagem, turnos, ataques e efeitos
// ═══════════════════════════════════════════════════════════════

// ── 18A: Parser de fórmula de dados ──────────────────────────
// Suporta fórmulas multi-grupo: "2d6+1d8+3", "d20", "1d6+2", etc.
// Retorna array de grupos: [{tipo:'dado',qtd,faces} | {tipo:'fixo',valor}]
function parsearFormulaDano(formula) {
  if (!formula || formula === '—') return null;
  const f = formula.toString().toLowerCase().replace(/\s/g, '');
  const grupos = [];
  // Quebra em tokens: "2d6", "+1d8", "-1", "+3", etc.
  const re = /([+-]?\d*d\d+|[+-]?\d+)/g;
  let m;
  while ((m = re.exec(f)) !== null) {
    const tok = m[1];
    const dado = tok.match(/^([+-]?\d*)d(\d+)$/);
    if (dado) {
      let qtdRaw = dado[1].replace(/^\+/, '') || '1';
      if (qtdRaw === '-') qtdRaw = '-1';
      // BUG-06 FIX: preservar sinal — dados negativos viram bônus fixo negativo
      const qtdSinal = parseInt(qtdRaw) || 1;
      const faces = parseInt(dado[2]);
      if (faces > 0) {
        if (qtdSinal > 0) {
          grupos.push({ tipo: 'dado', qtd: qtdSinal, faces });
        } else {
          // "-2d6" → marcar como subtrativo para rolarGrupos processar corretamente
          grupos.push({ tipo: 'dado_negativo', qtd: Math.abs(qtdSinal), faces });
        }
      }
    } else {
      const val = parseInt(tok);
      if (!isNaN(val) && val !== 0) grupos.push({ tipo: 'fixo', valor: val });
    }
  }
  return grupos.length ? grupos : null;
}

// Constrói string da fórmula a partir de grupos de builder
function formulaDeGrupos(grupos) {
  if (!grupos || !grupos.length) return '—';
  const agrupado = {};
  let bonus = 0;
  for (const g of grupos) {
    if (g.tipo === 'dado') {
      const k = g.faces;
      agrupado[k] = (agrupado[k] || 0) + g.qtd;
    } else {
      bonus += g.valor;
    }
  }
  const partes = Object.keys(agrupado).sort((a,b)=>b-a).map(f => `${agrupado[f]}d${f}`);
  if (bonus !== 0) partes.push(bonus > 0 ? '+'+bonus : String(bonus));
  return partes.join('+').replace(/\+\-/g, '-') || '—';
}

// Rola todos os dados dos grupos, retorna lista de {faces, valor} para animação
function rolarGrupos(grupos) {
  if (!grupos) return { total: 0, dados: [], bonus: 0 };
  const dados = [];
  let bonus = 0;
  for (const g of grupos) {
    if (g.tipo === 'dado') {
      for (let i = 0; i < g.qtd; i++) {
        dados.push({ faces: g.faces, valor: Math.floor(Math.random() * g.faces) + 1 });
      }
    } else if (g.tipo === 'dado_negativo') {
      // BUG-06 FIX: rolar dados e subtrair do bônus
      for (let i = 0; i < g.qtd; i++) {
        const v = Math.floor(Math.random() * g.faces) + 1;
        bonus -= v;
      }
    } else {
      bonus += g.valor;
    }
  }
  const dadosTotal = dados.reduce((s, d) => s + d.valor, 0);
  const total = Math.max(0, dadosTotal + bonus);
  // Ajustar bônus exibido para ser consistente com o total capado (impede display "3 - 5 = 0")
  const effectiveBonus = total - dadosTotal;
  return { total, dados, bonus: effectiveBonus };
}

// Wrapper de compatibilidade — aceita fórmula como array de grupos (novo) ou objeto simples (formato antigo)
function rolarFormula(parsed) {
  if (!parsed) return { total: 0, rolls: [], formula: '?' };
  // Formato novo: array [{tipo,qtd,faces}]; formato antigo: objeto simples {tipo,qtd,faces}
  if (Array.isArray(parsed)) {
    const r = rolarGrupos(parsed);
    return { total: r.total, rolls: r.dados.map(d=>d.valor), formula: formulaDeGrupos(parsed) };
  }
  if (parsed.tipo === 'fixo') return { total: parsed.fixo, rolls: [parsed.fixo], formula: String(parsed.fixo) };
  const rolls = [];
  for (let i = 0; i < parsed.qtd; i++) rolls.push(Math.floor(Math.random() * parsed.faces) + 1);
  const total = rolls.reduce((a, b) => a + b, 0) + (parsed.bonus||0);
  return { total: Math.max(0, total), rolls, formula: `${parsed.qtd}d${parsed.faces}` };
}

// ── Calcula o bônus fixo de atributo para uma habilidade ─────
// Retorna inteiro (ceil de pct% do valor do atributo do atacante)
function calcModAtributo(habilidade, nomeAtacante, contexto) {
  const pct = habilidade.mod_atributo_pct;
  const atributo = habilidade.atributo_base;
  if (!pct || !atributo) return 0;

  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const char = chars.find(c => c.nome === nomeAtacante);
  if (!char) return 0;

  const atrs = char.custom_attrs?.atributos || {};
  // Busca case-insensitive para tolerar variações na capitalização
  const chave = Object.keys(atrs).find(k => k.toLowerCase() === atributo.toLowerCase()) || atributo;
  const valor = parseFloat(atrs[chave] ?? 0);
  return Math.ceil(valor * pct / 100);
}

// ═══════════════════════════════════════════════════════════════
// 🐛 BUG-02 FIX: Sistema de Decremento de Cooldowns
// ═══════════════════════════════════════════════════════════════

/**
 * Decrementa todos os cooldowns ativos em 1 turno
 * @param {string} contexto - 'arena' ou 'campanha'
 */
function decrementarCooldowns(contexto) {
  if (contexto === 'arena') {
    if (!AR.estado?.cooldowns) return;
    
    const cooldowns = AR.estado.cooldowns;
    for (const habilidadeId in cooldowns) {
      if (cooldowns[habilidadeId] > 0) {
        cooldowns[habilidadeId]--;
        
        if (cooldowns[habilidadeId] === 0) {
          arLog(`⚡ Habilidade ${habilidadeId} disponível novamente!`);
        }
      }
    }
    
    arSalvarEstado().catch(err => console.error('Erro ao salvar cooldowns:', err));
    
  } else if (contexto === 'campanha' && BATALHA_ATUAL_ID) {
    const batalha = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
    if (!batalha?.cooldowns) return;
    
    const cooldowns = batalha.cooldowns;
    for (const habilidadeId in cooldowns) {
      if (cooldowns[habilidadeId] > 0) {
        cooldowns[habilidadeId]--;
        
        if (cooldowns[habilidadeId] === 0) {
          mostrarToast(`⚡ Habilidade disponível!`, 'sucesso');
        }
      }
    }
    
    salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(err => 
      console.error('Erro ao salvar cooldowns da batalha:', err)
    );
  }
}

/**
 * Avança o turno e decrementa cooldowns automaticamente
 */
function avancarTurnoComCooldowns(contexto) {
  if (contexto === 'arena') {
    if (!AR.estado) AR.estado = {};
    AR.estado.turno = (AR.estado.turno || 0) + 1;
  } else if (BATALHA_ATUAL_ID) {
    const batalha = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
    if (batalha) {
      batalha.turno_atual = (batalha.turno_atual || 0) + 1;
    }
  }
  
  decrementarCooldowns(contexto);
  
  const turnoAtual = contexto === 'arena' 
    ? AR.estado?.turno 
    : MAPA_STATE.batalhas[BATALHA_ATUAL_ID]?.turno_atual;
  
  mostrarToast(`🔄 Turno ${turnoAtual}`, '');
}

// ═══════════════════════════════════════════════════════════════
// 💡 REC-05: Preview de Dano (Fase 1 - Quick Win)
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula o range de dano de uma fórmula (min, max, média)
 * @param {string} formula - Fórmula de dano (ex: "2d6+3")
 * @returns {{min: number, max: number, media: number}}
 */
function calcularRangeDano(formula) {
  const grupos = parsearFormulaDano(formula);
  if (!grupos) return { min: 0, max: 0, media: 0 };
  
  let min = 0, max = 0;
  
  for (const g of grupos) {
    if (g.tipo === 'dado') {
      min += g.qtd * 1;
      max += g.qtd * g.faces;
    } else if (g.tipo === 'dado_negativo') {
      min -= g.qtd * g.faces;
      max -= g.qtd * 1;
    } else if (g.tipo === 'fixo') {
      min += g.valor;
      max += g.valor;
    }
  }
  
  min = Math.max(0, min);
  max = Math.max(0, max);
  
  const media = Math.floor((min + max) / 2);
  
  return { min, max, media };
}

// ═══════════════════════════════════════════════════════════════
// 💡 REC-06: Log de Combate Persistente
// ═══════════════════════════════════════════════════════════════

const COMBATE_LOG = {
  eventos: [],
  maxEventos: 50,
  
  adicionar(tipo, dados) {
    const evento = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      tipo,
      ...dados
    };
    
    this.eventos.push(evento);
    
    if (this.eventos.length > this.maxEventos) {
      this.eventos.shift();
    }
    
    this.renderizar();
    
    if (typeof combateBroadcast === 'function') {
      combateBroadcast('log_evento', evento);
    }
  },
  
  renderizar() {
    const container = document.getElementById('combate-log-container');
    if (!container) return;
    
    if (this.eventos.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#6a5840;font-size:0.75rem">Nenhuma ação de combate ainda</div>';
      return;
    }
    
    container.innerHTML = this.eventos.slice().reverse().map(e => {
      const tempo = new Date(e.timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', minute: '2-digit' 
      });
      
      let icone = '⚔️';
      let cor = '#c8d8e8';
      let texto = '';
      
      switch (e.tipo) {
        case 'ataque':
          icone = '⚔️';
          cor = '#e8604c';
          texto = `${e.atacante} atacou ${e.alvo} com ${e.habilidade} (${e.dano} dano)`;
          break;
        case 'dano':
          icone = '💥';
          cor = '#e8604c';
          texto = `${e.alvo} recebeu ${e.valor} de dano`;
          break;
        case 'cura':
          icone = '💚';
          cor = '#5ee09a';
          texto = `${e.alvo} recuperou ${e.valor} HP`;
          break;
        case 'efeito':
          icone = e.ehPositivo ? '✨' : '🔥';
          cor = e.ehPositivo ? '#7ec8f0' : '#c0392b';
          texto = `${e.nome} aplicado em ${e.alvo}`;
          break;
        case 'turno':
          icone = '🔄';
          cor = '#f0cc6a';
          texto = `Turno ${e.numero} iniciado`;
          break;
        case 'morte':
          icone = '💀';
          cor = '#c0392b';
          texto = `${e.nome} foi derrotado!`;
          break;
        case 'critico':
          icone = '🎯';
          cor = '#f0cc6a';
          texto = e.mensagem;
          break;
      }
      
      return `
        <div style="padding:6px 10px;border-bottom:1px solid rgba(60,40,20,0.3);
          display:flex;gap:8px;align-items:flex-start">
          <span style="font-size:0.9rem;flex-shrink:0">${icone}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.75rem;color:${cor};line-height:1.3;
              overflow:hidden;text-overflow:ellipsis">${texto}</div>
            <div style="font-size:0.6rem;color:#6a5840;margin-top:2px">${tempo}</div>
          </div>
        </div>
      `;
    }).join('');
    
    container.scrollTop = 0;
  },
  
  limpar() {
    this.eventos = [];
    this.renderizar();
  }
};

// ═══════════════════════════════════════════════════════════════
// 🐛 BUG-05 FIX: getCooldownsBatalha Seguro
// ═══════════════════════════════════════════════════════════════

function getCooldownsBatalhaSeguro(batalhaId) {
  if (!batalhaId) return {};
  
  const batalha = MAPA_STATE.batalhas?.[batalhaId];
  if (!batalha) return {};
  
  if (!batalha.cooldowns) {
    batalha.cooldowns = {};
  }
  
  return batalha.cooldowns;
}

// ═══════════════════════════════════════════════════════════════
// 🐛 BUG-07 FIX (FASE 2): Sistema Determinístico de Targeting de Efeitos
// PROBLEMA: Heurística decide incorretamente onde aplicar efeito
// SOLUÇÃO: Sistema mais claro e explícito de targeting
// ═══════════════════════════════════════════════════════════════

/**
 * Determina corretamente onde aplicar um efeito
 * @param {object} efeito - Efeito a ser aplicado
 * @param {object} habilidade - Habilidade que gerou o efeito
 * @param {string} atacanteNome - Nome do atacante
 * @param {string[]} alvosAtaque - Lista de alvos do ataque
 * @returns {{aplicarEm: 'atacante'|'alvos', alvos: string[]}}
 */
function determinarAlvoEfeito(efeito, habilidade, atacanteNome, alvosAtaque) {
  // 1. PRIORIDADE MÁXIMA: Campo explícito alvo_override
  if (efeito.alvo_override === 'usuario' || efeito.alvo === 'usuario') {
    return { aplicarEm: 'atacante', alvos: [atacanteNome] };
  }
  
  if (efeito.alvo_override === 'alvo') {
    return { aplicarEm: 'alvos', alvos: alvosAtaque };
  }
  
  // 2. Se habilidade é de suporte/buff E alvo é aliado → efeito vai pro alvo
  const ehHabilidadeAliada = ['aliado', 'todos_aliados', 'proprio'].includes(
    habilidade.alvo_tipo
  );
  
  if (ehHabilidadeAliada) {
    // Habilidade usada em aliado: efeitos vão pro alvo
    return { aplicarEm: 'alvos', alvos: alvosAtaque };
  }
  
  // 3. Analisar natureza do efeito
  const ehEfeitoPositivo = !!(
    efeito.hot_formula ||
    efeito.boost_dano ||
    efeito.rec_atributo ||
    efeito.tipo === 'buff' ||
    efeito.tipo === 'cura_imediata' ||
    efeito.tipo === 'mover_usuario'
  );
  
  const ehEfeitoNegativo = !!(
    efeito.dot_formula ||
    efeito.mod_dano < 0 ||
    efeito.sem_movimento ||
    efeito.sem_ataque ||
    efeito.tipo === 'debuff'
  );
  
  // 4. Lógica padrão:
  // - Efeito positivo em habilidade ofensiva → vai pro atacante (self-buff)
  // - Efeito negativo → vai pro alvo (debuff no inimigo)
  // - Efeito positivo em habilidade de suporte → vai pro alvo (buff no aliado)
  
  if (ehEfeitoPositivo && !ehHabilidadeAliada) {
    // Self-buff em habilidade de ataque
    return { aplicarEm: 'atacante', alvos: [atacanteNome] };
  }
  
  // Caso padrão: efeito vai pro alvo
  return { aplicarEm: 'alvos', alvos: alvosAtaque };
}

// ═══════════════════════════════════════════════════════════════
// 💡 SISTEMA DE VALIDAÇÃO DE ESTADO (FASE 2)
// Previne bugs de estado inconsistente
// ═══════════════════════════════════════════════════════════════

/**
 * Valida o estado do COMBATE antes de executar ações críticas
 * @returns {boolean} - true se estado é válido
 */
function validarEstadoCombate() {
  const erros = [];
  
  if (!COMBATE.atacanteNome) erros.push('atacanteNome não definido');
  if (!COMBATE.contexto) erros.push('contexto não definido');
  if (!COMBATE.habilidadeSel) erros.push('habilidade não selecionada');
  
  // Validar alvo para habilidades que exigem alvo
  if (COMBATE.habilidadeSel && 
      !['proprio', 'todos_inimigos', 'todos_aliados'].includes(COMBATE.habilidadeSel.alvo_tipo)) {
    if (!COMBATE.alvoNome && !COMBATE._alvosAoE?.length) {
      erros.push('alvo não selecionado');
    }
  }
  
  // Validar dados rolados (se na etapa de confirmação)
  if (COMBATE._pendingTrigger && !COMBATE.dadosRolados) {
    erros.push('dados não rolados mas trigger pendente');
  }
  
  if (erros.length > 0) {
    console.warn('⚠️ Estado de COMBATE inválido:', erros);
    return false;
  }
  
  return true;
}

/**
 * Reseta o estado do COMBATE de forma segura
 */
function resetarEstadoCombate() {
  COMBATE.contexto = null;
  COMBATE.atacanteNome = null;
  COMBATE.habilidadeSel = null;
  COMBATE.alvoNome = null;
  COMBATE.dadosRolados = null;
  COMBATE.step = 1;
  COMBATE._habilidades = [];
  COMBATE._alvos = [];
  COMBATE.formulaBuilder = [];
  COMBATE.rolando = false;
  COMBATE._jaAplicado = false;
  COMBATE._pendingTrigger = false;
  COMBATE._estadoAtk = 'livre';
}

// ═══════════════════════════════════════════════════════════════
// 💡 FASE 3 - OPT-03: Críticos com Impacto Mecânico
// ═══════════════════════════════════════════════════════════════
// 💥 SISTEMA DE CRÍTICOS - VERSÃO 2.0
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica e aplica crítico baseado em d20
 * - d20 = 1-3  = Sem dano (0x)
 * - d20 = 4-12 = Normal (1x)
 * - d20 = 13-15 = Crítico Menor (+20%, 1.2x)
 * - d20 = 16-19 = Crítico (+50%, 1.5x)
 * - d20 = 20   = Crítico Total (+100%, 2x)
 */
function calcularDanoCritico(danoBase, d20) {
  if (!d20 || d20 < 1 || d20 > 20) {
    console.warn('[Crítico] d20 inválido:', d20);
    return { dano: danoBase, tipo: 'normal', multiplicador: 1, mensagem: null };
  }

  if (d20 <= 3) {
    return {
      dano: 0,
      tipo: 'erro',
      multiplicador: 0,
      mensagem: `💀 Sem dano! (d20: ${d20})`,
      cor: '#e74c3c'
    };
  }

  if (d20 <= 12) {
    return { dano: danoBase, tipo: 'normal', multiplicador: 1, mensagem: null, cor: null };
  }

  if (d20 <= 15) {
    const dano = Math.ceil(danoBase * 1.2);
    return {
      dano,
      tipo: 'critico_menor',
      multiplicador: 1.2,
      mensagem: `⭐ Crítico Menor! +20% (${danoBase} → ${dano})`,
      cor: '#f39c12'
    };
  }

  if (d20 <= 19) {
    const dano = Math.ceil(danoBase * 1.5);
    return {
      dano,
      tipo: 'critico',
      multiplicador: 1.5,
      mensagem: `✦ Crítico! +50% (${danoBase} → ${dano})`,
      cor: '#e67e22'
    };
  }

  // d20 = 20
  const dano = Math.ceil(danoBase * 2);
  return {
    dano,
    tipo: 'critico_total',
    multiplicador: 2,
    mensagem: `✦✦ CRÍTICO TOTAL! +100% (${danoBase} → ${dano})`,
    cor: '#f0cc6a'
  };
}

// Função legada para compatibilidade
function verificarCritico(resultado) {
  if (!resultado?.dados) return { critico: false, multiplicador: 1, tipo: null };
  
  const d20 = resultado.dados.find(d => d.faces === 20)?.valor;
  if (!d20) return { critico: false, multiplicador: 1, tipo: null };
  
  if (d20 < 2) return { critico: true, multiplicador: 0, tipo: 'erro' };
  if (d20 >= 18 && d20 <= 19) return { critico: true, multiplicador: 1.2, tipo: 'critico_menor' };
  if (d20 === 20) return { critico: true, multiplicador: 1.3, tipo: 'critico_maior' };
  
  return { critico: false, multiplicador: 1, tipo: null };
}

function aplicarCriticoAoDano(dano, criticoInfo) {
  if (!criticoInfo.critico) return dano;
  
  if (criticoInfo.tipo === 'critico_menor') return Math.ceil(dano * 1.2);
  if (criticoInfo.tipo === 'critico_maior') return Math.ceil(dano * 1.3);
  if (criticoInfo.tipo === 'erro') return 0;
  
  return dano;
}

console.log('[Combat] Sistema de críticos 2.0 carregado ✓');

// ═══════════════════════════════════════════════════════════════
// 💡 FASE 3 - OPT-04: Som e Vibração
// ═══════════════════════════════════════════════════════════════

function mostrarAnimacaoCritico(tipo, atacante, danoBase, danoFinal) {
  if (tipo === 'critico_maior') {
    // Crítico perfeito (20 natural)
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
    const bonus = danoFinal - danoBase;
    mostrarToast(`🌟 ${atacante} - CRÍTICO PERFEITO! ${danoBase} → ${danoFinal} (+${bonus})`, 'sucesso');

    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('critico', {
        mensagem: `${atacante} - CRÍTICO PERFEITO! ${danoBase} → ${danoFinal} (+30%)`
      });
    }
    // Disparar gatilho de crítico
    if (typeof battleDispatchEvento === 'function') {
      battleDispatchEvento('acertar_critico', { atacante, danoBase, danoFinal, tipoCritico: 'critico_maior' });
    }

  } else if (tipo === 'critico_menor') {
    // Crítico menor (18-19)
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    const bonus = danoFinal - danoBase;
    mostrarToast(`⭐ ${atacante} - Crítico Menor! ${danoBase} → ${danoFinal} (+${bonus})`, 'info');

    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('critico', {
        mensagem: `${atacante} - Crítico Menor! ${danoBase} → ${danoFinal} (+20%)`
      });
    }
    // Disparar gatilho de crítico
    if (typeof battleDispatchEvento === 'function') {
      battleDispatchEvento('acertar_critico', { atacante, danoBase, danoFinal, tipoCritico: 'critico_menor' });
    }

  } else if (tipo === 'erro') {
    // Erro crítico (1)
    if (navigator.vibrate) navigator.vibrate(300);
    mostrarToast(`💀 ${atacante} - ERRO CRÍTICO! Sem dano!`, 'erro');
    
    if (typeof COMBATE_LOG !== 'undefined') {
      COMBATE_LOG.adicionar('critico', {
        mensagem: `${atacante} - ERRO CRÍTICO (0 dano)`
      });
    }
  }
}

console.log('[Combat] Animações de crítico atualizadas ✓');

// ═══════════════════════════════════════════════════════════════
// 💡 FASE 3 - OPT-05: Atalhos de Teclado
// ═══════════════════════════════════════════════════════════════

function configurarAtalhosCombate() {
  document.addEventListener('keydown', function(e) {
    const modalAtk = document.getElementById('modal-ataque');
    if (!modalAtk || modalAtk.style.display === 'none') return;
    
    // 1-9: Selecionar habilidade
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      if (COMBATE._habilidades && COMBATE._habilidades[idx]) {
        e.preventDefault();
        atkSelecionarHabilidade(idx);
      }
    }
    // Enter ou NumpadAdd (+): Rolar ou confirmar
    else if (e.key === 'Enter' || e.code === 'NumpadAdd') {
      e.preventDefault();
      const btnRolar = document.getElementById('atk-btn-rolar');
      const btnConfirmar = document.getElementById('atk-btn-confirmar');

      if (btnRolar && !btnRolar.disabled && btnRolar.style.display !== 'none') {
        atkRolarDados();
      } else if (btnConfirmar && btnConfirmar.style.display !== 'none') {
        atkConfirmarAtaque();
      }
    }
    // Escape: Fechar
    else if (e.key === 'Escape') {
      e.preventDefault();
      fecharModalAtaque();
    }
    // R: Rolar
    else if (e.key === 'r' || e.key === 'R') {
      const btnRolar = document.getElementById('atk-btn-rolar');
      if (btnRolar && !btnRolar.disabled && btnRolar.style.display !== 'none') {
        e.preventDefault();
        atkRolarDados();
      }
    }
  });
}

// Inicializar atalhos
if (typeof document !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', configurarAtalhosCombate);
} else if (typeof document !== 'undefined') {
  configurarAtalhosCombate();
}

let COMBATE = {
  contexto: null, atacanteNome: null, habilidadeSel: null, alvoNome: null,
  dadosRolados: null, step: 1,
  _habilidades: [], _alvos: [],
  formulaBuilder: [], rolando: false,
};
let NPC_HABILIDADES_TEMP = [];

// ── Estado do modo de ataque dinâmico no mapa (campanha) ─────
let ATAQUE_MAPA_STATE = {
  ativo: false,
  atacanteNome: null,
  fase: 'habilidades', // 'habilidades' | 'alvos'
};

// ── 18D: Abrir / fechar modal ────────────────────────────────
function abrirModalAtaque(atacanteNome, contexto = 'arena') {
  if (!atacanteNome) { mostrarToast('Nenhum personagem selecionado', 'erro'); return; }

  // Verificar estado de batalha para jogadores
  if (RPG_DATA?.myRole !== 'mestre') {
    const estadoAtk = _estadoBatalhaJogador(atacanteNome);
    if (estadoAtk === 'outro_turno') {
      mostrarToast('⏳ Aguarde seu turno para atacar!', 'erro');
      return;
    }
    // Guardar estado no COMBATE para uso posterior no fluxo
    COMBATE._estadoAtk = estadoAtk; // 'livre' ou 'fora_combate'
  } else {
    COMBATE._estadoAtk = 'livre';
  }

  // Cancelar qualquer trigger card/countdown pendente de ataque anterior
  _atkOcultarTrigger();

  // ✅ BUG-09 FIX: Resetar COMBATE com _jaAplicado explicitamente false
  COMBATE = {
    contexto, atacanteNome, habilidadeSel: null, alvoNome: null,
    dadosRolados: null, step: 1, _habilidades: [], _alvos: [],
    formulaBuilder: [], rolando: false, 
    _jaAplicado: false,  // ✅ FIX: Resetar explicitamente
    _pendingTrigger: false,
    _estadoAtk: COMBATE._estadoAtk || 'livre',
  };
  document.getElementById('modal-atk-atacante').textContent = atacanteNome;

  const habilidadesAll = contexto === 'arena'
    ? atkGetHabilidadesArena(atacanteNome)
    : atkGetHabilidadesCampanha(atacanteNome);
  // BUG-FIX: ocultar habilidades reativas/passivas do modal de ataque ativo
  const habilidades = habilidadesAll.filter(h => !h.tipo_habilidade || h.tipo_habilidade === 'acao');

  COMBATE._habilidades = habilidades;
  // ✅ BUG-05 FIX: Usar função segura que sempre retorna objeto
  const cooldownsAtivos = contexto === 'arena'
    ? (AR.estado?.cooldowns || {})
    : getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);

  const lista = document.getElementById('atk-habilidades-lista');
  lista.innerHTML = habilidades.map((h, i) => {
    const cdRestante = cooldownsAtivos[h.id || h.habilidade || h.nome] || 0;
    const emCooldown = cdRestante > 0;
    const bloqueio   = atkVerificarBloqueioAtaque(atacanteNome, h.tipo_dano);
    const disabled   = emCooldown || !!bloqueio;
    const corBorda   = disabled ? 'rgba(60,40,20,0.6)' : 'rgba(60,30,30,0.6)';
    const corNome    = disabled ? '#6a5840' : '#e8604c';
    let badge;
    if (emCooldown) {
      badge = `<span style="font-size:0.65rem;color:#a07040;background:rgba(100,60,0,0.2);border:1px solid rgba(100,60,0,0.3);border-radius:4px;padding:1px 6px">⏳ ${cdRestante}t</span>`;
    } else if (bloqueio) {
      badge = `<span style="font-size:0.65rem;color:#c0392b;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;padding:1px 6px">🚫 Bloq.</span>`;
    } else if (h.formula_dano && h.formula_dano !== '—') {
      // ✅ REC-05: Preview de dano com range min-max (inclui buffs ativos)
      const range = calcularRangeDano(h.formula_dano);
      const modAttr = calcModAtributo(h, atacanteNome, contexto);
      const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
      const atacanteChar = chars.find(c => c.nome === atacanteNome);
      const boostAtivo = (atacanteChar?.buffs || []).reduce((s, b) => {
        if ((b.boost_dano_turnos_restantes ?? 0) > 0) return s + (b.boost_dano || 0);
        return s;
      }, 0);
      const totalMod = modAttr + boostAtivo;
      const minFinal = range.min + totalMod;
      const maxFinal = range.max + totalMod;

      const modLabel = modAttr !== 0
        ? ` <span style="color:#7ec8f0;font-size:0.7rem">${modAttr > 0 ? '+' : ''}${modAttr}(${h.atributo_base})</span>`
        : '';
      const buffLabel = boostAtivo !== 0
        ? ` <span style="color:#5ee09a;font-size:0.7rem">${boostAtivo > 0 ? '+' : ''}${boostAtivo}⚡</span>`
        : '';

      badge = `<span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#f0cc6a;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.2);border-radius:4px;padding:1px 7px">
        ${h.formula_dano}${modLabel}${buffLabel}
        <span style="font-size:0.65rem;color:#9a8888;margin-left:4px">(${minFinal}-${maxFinal})</span>
      </span>`;
    } else {
      badge = `<span style="font-size:0.7rem;color:#7a6060">Montar dados</span>`;
    }
    const cdLabel     = h.cooldown_turnos > 0 ? `<span style="font-size:0.68rem;color:#7a6060"> · CD ${h.cooldown_turnos}t</span>` : '';
    const alcanceLabel= h.alcance_celulas != null ? `<span style="font-size:0.68rem;color:#7a6060"> · ⟷ ${h.alcance_celulas}c</span>` : '';
    const msgBloqueio = disabled ? (bloqueio || `Habilidade em recarga: ${cdRestante} turno(s)`) : null;
    return `<div onclick="${disabled ? `mostrarToast(${JSON.stringify(msgBloqueio)},'erro')` : `atkSelecionarHabilidade(${i})`}"
      style="padding:12px;background:rgba(20,12,12,0.8);border:1px solid ${corBorda};border-radius:8px;cursor:${disabled?'default':'pointer'};opacity:${disabled?'0.55':'1'};transition:all 0.15s"
      ${disabled ? '' : `onmouseenter="this.style.borderColor='rgba(232,80,60,0.4)'" onmouseleave="this.style.borderColor='${corBorda}'"`}>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-family:'Cinzel',serif;font-size:0.85rem;color:${corNome}">${h.nome}${cdLabel}${alcanceLabel}</span>
        ${badge}
      </div>
      <div style="font-size:0.82rem;color:#9a8888;line-height:1.4">${(h.efeito||'').slice(0,100)}${(h.efeito||'').length>100?'…':''}</div>
    </div>`;
  }).join('') || '<div style="color:#7a6060;font-style:italic;padding:12px">Nenhuma habilidade disponível</div>';

  const criatWrap = document.getElementById('atk-criativo-wrap');
  if (criatWrap && temPermissao('ataque_criativo')) {
    const bloqAtk = atkVerificarBloqueioAtaque(atacanteNome, 'fisico')
      || atkVerificarBloqueioAtaque(atacanteNome, 'magico');
    if (bloqAtk) {
      criatWrap.innerHTML = `<div style="padding:10px;color:#e8604c;
        font-size:0.75rem;text-align:center;border:1px solid rgba(232,96,76,0.25);
        border-radius:8px;background:rgba(232,96,76,0.06)">
        🚫 Ação criativa bloqueada — ${bloqAtk}</div>`;
      criatWrap.style.display = 'block';
    } else {
      criatWrap.style.display = 'block';
    }
  } else if (criatWrap) {
    criatWrap.style.display = 'none';
  }
  document.getElementById('atk-criativo-desc').value = '';
  
  // Resetar e inicializar seleção de tipo de ação criativa
  CRIATIVO_TIPO = 'ataque';
  CRIATIVO_ALVO_TIPO = 'unico';
  setTimeout(() => {
    criativoSetTipo('ataque');
    criativoSetAlvo('unico');
  }, 50);
  // Mostrar/ocultar aviso fora de combate
  const avisoBanner = document.getElementById('atk-aviso-fora-combate');
  if (avisoBanner) avisoBanner.style.display = (COMBATE._estadoAtk === 'fora_combate') ? 'block' : 'none';
  // Renderizar seção de pets vinculados ao atacante
  atkRenderizarSecaoPets(atacanteNome, contexto);
  atkIrParaStep(1);

  const modal = document.getElementById('modal-ataque');
  const inner = modal.querySelector('div');

  // ESTRUTURAL-02 FIX: Usar data-attribute em vez de mover o DOM.
  // O modal permanece no body. O CSS em .modal-ataque-inline / .modal-ataque-overlay
  // controla a aparência conforme o modo. Evita ghost nodes e listeners perdidos.
  modal._atkModo = null; // limpar modo anterior

  function _setModalModo(modo) {
    if (modal._atkModo === modo) return;
    modal._atkModo = modo;
    modal.dataset.atkModo = modo;
    // Garantir que o modal sempre está no body (não em âncora)
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
  }

  // Desktop 3-col → painel de ações direita; mobile sidebar → atk-sidebar-painel
  const _acaoDesktop = document.getElementById('mesa-acao-painel');
  const _sidebarAtk = document.getElementById('atk-sidebar-painel');
  const _targetPanel = _acaoDesktop || _sidebarAtk;
  if (_targetPanel && contexto === 'campanha') {
    _setModalModo('painel');
    modal.style.cssText = 'display:block;position:static;background:none;z-index:auto;width:100%;';
    if (inner) {
      inner.style.borderRadius = '10px';
      inner.style.marginTop = '0';
      inner.style.paddingBottom = '10px';
      inner.style.maxHeight = 'none';
    }
    if (_acaoDesktop) {
      // Desktop: substituir conteúdo do painel de ações pelo modal de ataque
      _acaoDesktop.innerHTML = '';
      _acaoDesktop.appendChild(modal);
    } else {
      _sidebarAtk.innerHTML = '';
      _sidebarAtk.appendChild(modal);
      _sidebarAtk.style.display = 'block';
    }
    setTimeout(() => _targetPanel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 60);
  } else if (contexto === 'campanha') {
    const anchor = document.getElementById('atk-painel-campanha-anchor');
    const anchorVisivel = anchor && anchor.offsetParent !== null;
    if (anchorVisivel) {
      _setModalModo('inline');
      modal.style.cssText = 'display:block;position:static;background:none;z-index:auto;';
      if (inner) {
        inner.style.borderRadius = '12px';
        inner.style.marginTop = '0';
        inner.style.paddingBottom = '16px';
        inner.style.maxHeight = 'none';
      }
      let placeholder = document.getElementById('atk-placeholder-campanha');
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.id = 'atk-placeholder-campanha';
        anchor.appendChild(placeholder);
      }
      const rect = anchor.getBoundingClientRect();
      modal.style.position = 'absolute';
      modal.style.top  = (rect.top  + window.scrollY) + 'px';
      modal.style.left = (rect.left + window.scrollX) + 'px';
      modal.style.width = rect.width + 'px';
      modal.style.zIndex = '8000';
      setTimeout(() => modal.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } else {
      _setModalModo('overlay');
      modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
      if (inner) {
        inner.style.borderRadius = '16px 16px 0 0';
        inner.style.marginTop = '';
        inner.style.paddingBottom = '44px';
        inner.style.maxHeight = '90vh';
      }
    }
  } else {
    _setModalModo('overlay');
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
    if (inner) {
      inner.style.borderRadius = '16px 16px 0 0';
      inner.style.marginTop = '';
      inner.style.paddingBottom = '44px';
      inner.style.maxHeight = '90vh';
    }
  }

  // Compatibilidade com modo controle: pausar pointer-events das zonas para o modal ser acessível
  const _ctrlOverlay = document.getElementById('mobile-ctrl-overlay');
  if (_ctrlOverlay) {
    _ctrlOverlay.querySelectorAll('#mc-zona-esq,#mc-zona-central,#mc-zona-dir').forEach(z => {
      z.dataset.prevPe = z.style.pointerEvents;
      z.style.pointerEvents = 'none';
    });
  }
}

// ── Painel persistente de salvaguarda de morte ──────────────────
function _mostrarPainelSalvaguarda(nome, resultado, d20, sucessos, falhas) {
  const idPainel = 'death-save-painel-' + nome.replace(/\s+/g, '_');
  let el = document.getElementById(idPainel);
  if (!el) {
    el = document.createElement('div');
    el.id = idPainel;
    el.style.cssText = 'position:fixed;bottom:70px;right:10px;z-index:9500;background:rgba(10,10,20,0.92);border:1px solid rgba(192,57,43,0.5);border-radius:10px;padding:10px 14px;min-width:200px;pointer-events:none;transition:opacity 0.3s';
    document.body.appendChild(el);
  }
  const iconesSuc = Array.from({length: 2}, (_, i) => `<span style="color:${i < sucessos ? '#5ee09a' : '#333'};font-size:1rem">♥</span>`).join('');
  const iconesFal = Array.from({length: 3}, (_, i) => `<span style="color:${i < falhas ? '#e74c3c' : '#333'};font-size:1rem">✖</span>`).join('');
  const corD20 = resultado === 'sucesso' || resultado === 'critico' ? '#5ee09a' : '#e74c3c';
  el.innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:0.58rem;color:#c0392b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">💀 ${nome} — Salvaguarda</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-family:'Cinzel',serif;font-size:1.1rem;color:${corD20};font-weight:bold">${d20}</span>
      <span style="font-size:0.65rem;color:#8a9ab0">${resultado === 'critico' ? '🌟 Crítico!' : resultado === 'sucesso' ? '✔ Sucesso' : '✘ Falha'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;gap:3px">${iconesSuc}</div>
      <div style="display:flex;gap:3px">${iconesFal}</div>
    </div>`;
  clearTimeout(el._timeout);
  if (resultado === 'critico' || sucessos >= 2 || falhas >= 3) {
    el._timeout = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
  }
}

// ── GM: Estabilizar/Reviver/Matar personagem moribundo ──────────
async function gmEstabilizarPersonagem(nome) {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const c = (RPG_DATA?.characters || []).find(x => x.nome === nome);
  if (!c) return;
  c.custom_attrs = c.custom_attrs || {};
  c.custom_attrs.moribundo = false;
  c.custom_attrs.estabilizado = true;
  delete c.custom_attrs.salvaguardas;
  mostrarToast(`🩹 ${nome} estabilizado pelo Mestre.`, 'sucesso');
  combateBroadcast('personagem_estabilizou', { nome });
  await saveCharacterStats(RPG_DATA.rpgId, nome, { hp_atual: c.hp_atual, custom_attrs: c.custom_attrs });
  if (typeof abrirFichaNoMapa === 'function') abrirFichaNoMapa(nome);
}

async function gmReviverPersonagem(nome) {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const c = (RPG_DATA?.characters || []).find(x => x.nome === nome);
  if (!c) return;
  c.custom_attrs = c.custom_attrs || {};
  c.hp_atual = 1;
  c.custom_attrs.moribundo = false;
  c.custom_attrs.morto = false;
  c.custom_attrs.estabilizado = false;
  delete c.custom_attrs.salvaguardas;
  mostrarToast(`✨ ${nome} revivido com 1 HP pelo Mestre.`, 'sucesso');
  combateBroadcast('personagem_estabilizou', { nome });
  await saveCharacterStats(RPG_DATA.rpgId, nome, { hp_atual: 1, custom_attrs: c.custom_attrs });
  if (typeof abrirFichaNoMapa === 'function') abrirFichaNoMapa(nome);
}

async function gmMatarPersonagem(nome) {
  if (RPG_DATA?.myRole !== 'mestre') return;
  const c = (RPG_DATA?.characters || []).find(x => x.nome === nome);
  if (!c) return;
  c.custom_attrs = c.custom_attrs || {};
  c.custom_attrs.moribundo = false;
  c.custom_attrs.morto = true;
  delete c.custom_attrs.salvaguardas;
  mostrarToast(`💀 ${nome} declarado morto pelo Mestre.`, 'erro');
  combateBroadcast('personagem_morto', { nome });
  await saveCharacterStats(RPG_DATA.rpgId, nome, { hp_atual: 0, custom_attrs: c.custom_attrs });
  if (typeof abrirFichaNoMapa === 'function') abrirFichaNoMapa(nome);
}

function fecharModalAtaque() {
  const modal = document.getElementById('modal-ataque');
  const foiCancelado = !COMBATE._jaAplicado && !COMBATE._pendingTrigger;
  modal.style.display = 'none';

  // Restaurar pointer-events das zonas do controle mobile
  const _ctrlOverlay2 = document.getElementById('mobile-ctrl-overlay');
  if (_ctrlOverlay2) {
    _ctrlOverlay2.querySelectorAll('#mc-zona-esq,#mc-zona-central,#mc-zona-dir').forEach(z => {
      z.style.pointerEvents = z.dataset.prevPe ?? 'auto';
    });
  }
  // Devolver modal ao body (estava no painel de ações desktop ou sidebar)
  const _acaoDesktop2 = document.getElementById('mesa-acao-painel');
  const sidebarAtk = document.getElementById('atk-sidebar-painel');
  if (_acaoDesktop2 && modal.parentElement === _acaoDesktop2) {
    document.body.appendChild(modal);
    // Re-renderizar painel de ações após fechar
    setTimeout(() => _mesaRenderAcoes?.(), 50);
  } else if (sidebarAtk && modal.parentElement === sidebarAtk) {
    sidebarAtk.style.display = 'none';
    document.body.appendChild(modal);
  }
  // Se estava no painel inline da campanha, devolve ao body para próximo uso
  if (modal.parentElement?.id === 'atk-painel-campanha-anchor') {
    document.body.appendChild(modal);
  }
  mapaHideRangeCircle();
  if (typeof mapaHideAoECircle === 'function') mapaHideAoECircle();
  // Limpar modo de ataque no mapa se estiver ativo
  if (ATAQUE_MAPA_STATE.ativo) {
    ATAQUE_MAPA_STATE = { ativo: false, atacanteNome: null, fase: 'habilidades' };
    const floatPanel = document.getElementById('atk-mapa-float-panel');
    if (floatPanel) floatPanel.style.display = 'none';
    document.querySelectorAll('.mapa-token').forEach(el => {
      el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
    });
  }
  // Se há ataque pendente (dados rolados), dispara animação imediatamente sem trigger card
  console.log('[ATK] fecharModalAtaque: pendingTrigger=', COMBATE._pendingTrigger, '| jaAplicado=', COMBATE._jaAplicado, '| foiCancelado=', foiCancelado);
  if (COMBATE._pendingTrigger) {
    COMBATE._pendingTrigger = false;
    console.log('[ATK] fecharModalAtaque: disparando _atkTriggerAnimacao');
    if (typeof _atkTriggerAnimacao === 'function') _atkTriggerAnimacao();
    else console.error('[ATK] fecharModalAtaque: _atkTriggerAnimacao NÃO ENCONTRADA');
    return;
  }
  // Se foi cancelado sem completar o ataque, reapresenta o botão atacar via re-render da UI
  if (foiCancelado && COMBATE.contexto === 'campanha') {
    _aplicarEstadoBatalhaUI();
  }
}

// ══════════════════════════════════════════════════════════════
// ⚡ MODAL DE EFEITO CRÍTICO (mestre)
// ══════════════════════════════════════════════════════════════
let _criticoCtx = { alvos: [], ehPositivo: false, texto: '', contexto: 'campanha' };

function abrirModalCriticoMestre(alvos, ehPositivo, criticoTexto, contexto) {
  _criticoCtx = { alvos: alvos || [], ehPositivo: !!ehPositivo, texto: criticoTexto || '', contexto: contexto || 'campanha' };
  const modal = document.getElementById('modal-critico-mestre');
  if (!modal) return;

  // Preencher header
  document.getElementById('critico-modal-icone').textContent = ehPositivo ? '✨' : '⚡';
  document.getElementById('critico-modal-titulo').textContent = ehPositivo ? 'CRÍTICO POSITIVO!' : 'CRÍTICO!';
  document.getElementById('critico-modal-titulo').style.color = ehPositivo ? '#5ee09a' : '#f0cc6a';
  const sub = ehPositivo
    ? `${alvos.join(', ')} foi(ram) afetado(s) pelo crítico positivo`
    : `${alvos.join(', ')} foi(ram) atingido(s) criticamente`;
  document.getElementById('critico-modal-sub').textContent = sub;

  // Texto do efeito
  const textoEl = document.getElementById('critico-modal-efeito-texto');
  if (criticoTexto) {
    textoEl.textContent = criticoTexto;
    textoEl.style.display = 'block';
    textoEl.style.background = ehPositivo ? 'rgba(94,224,154,0.08)' : 'rgba(240,180,20,0.08)';
    textoEl.style.borderColor = ehPositivo ? 'rgba(94,224,154,0.25)' : 'rgba(240,180,20,0.25)';
    textoEl.style.color = ehPositivo ? '#9af0c0' : '#e8d090';
  } else {
    textoEl.style.display = 'none';
  }

  // Listar apenas os alvos do ataque (já chegam pré-selecionados)
  // Não faz sentido mostrar todos os personagens — o efeito crítico é sobre quem foi atingido
  const todosChars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const charsAlvo  = alvos.length
    ? todosChars.filter(c => alvos.includes(c.nome))
    : todosChars; // fallback: se alvos vier vazio, mostra todos (não deve acontecer normalmente)
  const charsEl = document.getElementById('critico-modal-chars');
  // Se houver apenas 1 alvo, esconde a lista — não precisa de seleção, o efeito vai para ele
  // Se houver múltiplos (área), mostra para mestre poder excluir algum se quiser
  if (charsAlvo.length <= 1) {
    charsEl.style.display = 'none';
    // Injetar checkbox oculto para que criticoMestreAplicar encontre via querySelectorAll
    charsEl.innerHTML = charsAlvo.map(c =>
      `<input type="checkbox" value="${c.nome}" checked style="display:none">`
    ).join('');
  } else {
    charsEl.style.display = '';
    // Todos pré-selecionados; mestre pode desmarcar se quiser excluir algum (ex: área parcial)
    charsEl.innerHTML = charsAlvo.map(c => {
      const isNpc = c.custom_attrs?.tipo_personagem === 'npc';
      const cor = c.custom_attrs?.cor || c.cor || '#4fa3d1';
      return `<label style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(10,6,2,0.5);border:1px solid rgba(40,25,5,0.6);border-radius:7px;cursor:pointer">
        <input type="checkbox" value="${c.nome}" checked style="accent-color:${ehPositivo?'#5ee09a':'#f0cc6a'};width:15px;height:15px;flex-shrink:0">
        <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></div>
        <span style="font-size:0.82rem;color:#c8d8e8;flex:1">${c.nome}</span>
        ${isNpc ? `<span style="font-size:0.58rem;color:#7a92aa;background:rgba(30,20,10,0.6);border-radius:3px;padding:1px 5px">NPC</span>` : ''}
      </label>`;
    }).join('');
  }

  // Reset tipo de efeito
  const tipoEl = document.getElementById('critico-ef-tipo');
  if (tipoEl) tipoEl.value = '';
  criticoEfTipoChange();

  modal.style.display = 'flex';
}

function fecharModalCriticoMestre() {
  const modal = document.getElementById('modal-critico-mestre');
  if (modal) modal.style.display = 'none';
}

function criticoEfTipoChange() {
  const tipo = document.getElementById('critico-ef-tipo')?.value || '';
  const campos = ['dot','hot','dano','boost','cura','livre'];
  campos.forEach(c => {
    const el = document.getElementById(`critico-ef-campos-${c}`);
    if (el) el.style.display = 'none';
  });
  const mapa = { dot: 'dot', hot: 'hot', debuff_dano: 'dano', boost: 'boost', cura_imediata: 'cura', livre: 'livre' };
  const campo = mapa[tipo];
  if (campo) {
    const el = document.getElementById(`critico-ef-campos-${campo}`);
    if (el) el.style.display = 'block';
  }
  // Turnos visível exceto para cura imediata
  const turnosEl = document.getElementById('critico-ef-turnos');
  if (turnosEl) turnosEl.closest('div')?.parentElement && (turnosEl.parentElement.parentElement.style.display = tipo === 'cura_imediata' || tipo === 'livre' || tipo === '' ? 'none' : '');
}

async function criticoMestreAplicar() {
  const { alvos, ehPositivo, texto, contexto } = _criticoCtx;
  const checks = document.querySelectorAll('#critico-modal-chars input[type=checkbox]:checked');
  const selecionados = Array.from(checks).map(c => c.value);
  if (!selecionados.length) { mostrarToast('Selecione ao menos um personagem', 'erro'); return; }

  const tipo = document.getElementById('critico-ef-tipo')?.value || '';
  const turnos = parseInt(document.getElementById('critico-ef-turnos')?.value) || 2;

  for (const nomeAlvo of selecionados) {
    if (tipo === 'dot') {
      const formula = document.getElementById('critico-ef-dot-formula')?.value.trim() || '1d6';
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico — ${texto || 'DOT'}`,
        tipo: 'debuff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        dot_formula: formula,
        dot_turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'hot') {
      const formula = document.getElementById('critico-ef-hot-formula')?.value.trim() || '1d6';
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico+ — ${texto || 'HOT'}`,
        tipo: 'buff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        hot_formula: formula,
        hot_turnos_restantes: turnos,
        hot_turnos: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'debuff_mov') {
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico — ${texto || 'Imobilizado'}`,
        tipo: 'debuff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        sem_movimento: true,
        sem_movimento_turnos: turnos,
        sem_movimento_turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'debuff_atk') {
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico — ${texto || 'Sem ataque'}`,
        tipo: 'debuff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        sem_ataque: true,
        sem_ataque_tipo: 'todos',
        sem_ataque_turnos: turnos,
        sem_ataque_turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'debuff_dano') {
      const mod = parseInt(document.getElementById('critico-ef-mod-dano')?.value) || -3;
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico — ${texto || 'Dano reduzido'}`,
        tipo: 'debuff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        mod_dano: mod < 0 ? mod : -mod,
        mod_dano_turnos: turnos,
        mod_dano_turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'boost') {
      const boost = parseInt(document.getElementById('critico-ef-boost')?.value) || 5;
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: `Crítico+ — ${texto || 'Dano aumentado'}`,
        tipo: 'buff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        boost_dano: boost,
        boost_dano_turnos: turnos,
        boost_dano_turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);

    } else if (tipo === 'cura_imediata') {
      const qtd = parseInt(document.getElementById('critico-ef-cura-qtd')?.value) || 0;
      if (qtd > 0) await atkAplicarCura(nomeAlvo, qtd, contexto);

    } else if (tipo === 'debuff_stun') {
      for (const nomeAlvo of selecionados) {
        await atkAplicarEfeito(nomeAlvo, {
          sem_movimento: true,
          sem_movimento_turnos: turnos,
          sem_ataque: true,
          sem_ataque_tipo: 'todos',
          sem_ataque_turnos: turnos,
          nome: `Crítico — ${texto || 'Atordoado'}`,
          tipo: 'debuff',
        }, contexto);
      }

    } else if (tipo === 'livre') {
      const nomeEf = document.getElementById('critico-ef-livre-nome')?.value.trim() || 'Efeito crítico';
      const ef = {
        id: 'crit_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        nome: nomeEf,
        tipo: ehPositivo ? 'buff' : 'debuff',
        turno_inicio: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
        turnos_restantes: turnos,
      };
      await atkAplicarEfeito(nomeAlvo, ef, contexto);
    }
    // Sem tipo: apenas fecha (efeito foi apenas narrativo)
  }

  if (tipo) {
    if (contexto === 'arena') {
      await arSalvarEstado();
      renderArenaPersonagens(); renderArenaEntidades(); renderArenaEfeitos();
    } else {
      renderCharView?.(selecionados[0]);
      mapaRenderStatus?.();
    }
    mostrarToast(`⚡ Efeito crítico aplicado em ${selecionados.join(', ')}!`, 'sucesso');
  }

  fecharModalCriticoMestre();
}
// ── fim modal crítico ──────────────────────────────────────────



// ── Círculo de alcance visual no mapa ────────────────────────
function mapaShowRangeCircle(atacanteNome, alcanceCelulas) {
  if (COMBATE.contexto !== 'campanha') return;
  const tokensEl = document.getElementById('mapa-tokens');
  if (!tokensEl) return;

  // Armazenar estado do círculo para atualizações em tempo real
  MAPA_STATE._rangeCircle = { atacanteNome, alcanceCelulas };

  let el = document.getElementById('atk-range-circle');
  if (!el) {
    el = document.createElement('div');
    el.id = 'atk-range-circle';
    tokensEl.appendChild(el);
  }

  const mapId = MAPA_STATE?.mapaAtualId || null;
  const char  = (RPG_DATA?.characters || []).find(c => c.nome === atacanteNome);
  const pos   = (char && mapId) ? getPosicaoNoMapa(char, mapId) : null;

  // normalizarPosicao retorna {col,row}; converter para % do mapa
  const mapa = _getMapaById(mapId);
  const larguraGrid = mapa?.largura_total || 20;
  const alturaGrid  = mapa?.altura_total  || 20;
  const px = pos ? ((pos.col + 0.5) / larguraGrid * 100) : 50;
  const py = pos ? ((pos.row + 0.5) / alturaGrid  * 100) : 50;

  // Raio em % do mapa (cada célula = 100/larguraGrid %)
  const celulaPct = 100 / larguraGrid;
  const radiusPct = alcanceCelulas * celulaPct;
  
  // Cor do personagem
  const ca  = char?.custom_attrs || {};
  const cor = ca.cor || char?.cor || '#7ec8f0';
  let r = 126, g = 200, b = 240;
  const hexMatch = cor.replace('#','');
  if (/^[0-9a-f]{6}$/i.test(hexMatch)) {
    r = parseInt(hexMatch.slice(0,2),16);
    g = parseInt(hexMatch.slice(2,4),16);
    b = parseInt(hexMatch.slice(4,6),16);
  }
  
  // ✅ CORREÇÃO: Usar % ao invés de px
  el.style.cssText = `
    position:absolute;
    left:${px}%;
    top:${py}%;
    width:${radiusPct*2}%;
    height:${radiusPct*2}%;
    border-radius:50%;
    pointer-events:none;
    transform:translate(-50%,-50%);
    z-index:6;
    background:rgba(${r},${g},${b},0.12);
    border:3px solid rgba(${r},${g},${b},0.8);
    box-shadow:
      0 0 0 1px rgba(${r},${g},${b},0.25),
      0 0 20px rgba(${r},${g},${b},0.35),
      inset 0 0 40px rgba(${r},${g},${b},0.12);
    display:block;
    animation:rangeCirclePulse 1.8s ease-in-out infinite alternate;
  `;
}
function mapaHideRangeCircle() {
  const el = document.getElementById('atk-range-circle');
  if (el) el.remove();
  if (MAPA_STATE) MAPA_STATE._rangeCircle = null;
}

// ══════════════════════════════════════════════════════════════
// ⚔ MODO DE ATAQUE DINÂMICO NO MAPA (campanha)
// Permite selecionar habilidade e alvo sem sair do mapa.
// O jogador pode mover o personagem a qualquer momento antes de confirmar.
// ══════════════════════════════════════════════════════════════

function mapaAtaqueIniciar(atacanteNome) {
  if (!atacanteNome) return;

  // Verificar turno (jogadores)
  if (RPG_DATA?.myRole !== 'mestre') {
    const estadoAtk = _estadoBatalhaJogador(atacanteNome);
    if (estadoAtk === 'outro_turno') {
      mostrarToast('⏳ Aguarde seu turno para atacar!', 'erro');
      return;
    }
    COMBATE._estadoAtk = estadoAtk;
  } else {
    COMBATE._estadoAtk = 'livre';
  }

  _atkOcultarTrigger();

  COMBATE = {
    contexto: 'campanha',
    atacanteNome,
    habilidadeSel: null,
    alvoNome: null,
    dadosRolados: null,
    step: 1,
    _habilidades: [],
    _alvos: [],
    formulaBuilder: [],
    rolando: false,
    _jaAplicado: false,
    _pendingTrigger: false,
    _estadoAtk: COMBATE._estadoAtk || 'livre',
  };

  document.getElementById('modal-atk-atacante').textContent = atacanteNome;

  const habilidades = atkGetHabilidadesCampanha(atacanteNome)
    .filter(h => !h.tipo_habilidade || h.tipo_habilidade === 'acao');
  COMBATE._habilidades = habilidades;

  ATAQUE_MAPA_STATE = { ativo: true, atacanteNome, fase: 'habilidades' };

  // Esconder botão padrão enquanto modo mapa está ativo
  const btnAtacar = document.getElementById('batalha-btn-atacar');
  if (btnAtacar) btnAtacar.style.display = 'none';

  _mapaAtaqueRenderHabilidades();
  document.getElementById('atk-mapa-fase1').style.display = 'block';
  document.getElementById('atk-mapa-fase2').style.display = 'none';
  document.getElementById('atk-mapa-titulo').textContent = '⚔ Selecionar Habilidade';
  document.getElementById('atk-mapa-atacante-label').textContent = atacanteNome;
  // Mostrar botão encerrar batalha no painel inferior (apenas mestre em combate)
  const _encBtnMapa = document.getElementById('atk-mapa-encerrar-batalha-btn');
  if (_encBtnMapa) _encBtnMapa.style.display = (RPG_DATA?.myRole === 'mestre' && BATALHA_ATUAL_ID) ? 'block' : 'none';
  // Float panel legado: só mostrar se sidebar indisponível
  const _atkSidebarP = document.getElementById('atk-sidebar-painel');
  if (!_atkSidebarP) {
    document.getElementById('atk-mapa-float-panel').style.display = 'block';
    setTimeout(() => {
      const panel = document.getElementById('atk-mapa-float-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
  } else {
    // Sidebar encontrada — o modal de ataque já foi movido para lá em mostrarModalAtaque()
    _atkSidebarP.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
}

function _mapaAtaqueRenderHabilidades() {
  const habilidades = COMBATE._habilidades;
  const atacanteNome = COMBATE.atacanteNome;
  const cooldownsAtivos = getCooldownsBatalha(BATALHA_ATUAL_ID);

  const lista = document.getElementById('atk-mapa-habilidades-lista');
  if (!lista) return;

  lista.innerHTML = habilidades.map((h, i) => {
    const cdRestante = cooldownsAtivos[h.id || h.habilidade || h.nome] || 0;
    const emCooldown = cdRestante > 0;
    const bloqueio = atkVerificarBloqueioAtaque(atacanteNome, h.tipo_dano);
    const disabled = emCooldown || !!bloqueio;
    const corBorda = disabled ? 'rgba(60,40,20,0.6)' : 'rgba(60,30,30,0.6)';
    const corNome = disabled ? '#6a5840' : '#e8604c';
    const msgBloqueio = disabled ? (bloqueio || `Habilidade em recarga: ${cdRestante} turno(s)`) : null;

    let badge;
    if (emCooldown) {
      badge = `<span style="font-size:0.65rem;color:#a07040;background:rgba(100,60,0,0.2);border:1px solid rgba(100,60,0,0.3);border-radius:4px;padding:1px 6px">⏳ ${cdRestante}t</span>`;
    } else if (bloqueio) {
      badge = `<span style="font-size:0.65rem;color:#c0392b;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;padding:1px 6px">🚫 Bloq.</span>`;
    } else if (h.formula_dano && h.formula_dano !== '—') {
      const modAttr = calcModAtributo(h, atacanteNome, 'campanha');
      const modLabel = modAttr !== 0 ? ` <span style="color:#7ec8f0;font-size:0.7rem">${modAttr > 0 ? '+' : ''}${modAttr}(${h.atributo_base})</span>` : '';
      badge = `<span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#f0cc6a;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.2);border-radius:4px;padding:1px 7px">${h.formula_dano}${modLabel}</span>`;
    } else {
      badge = `<span style="font-size:0.7rem;color:#7a6060">Sem fórmula</span>`;
    }

    const cdLabel = h.cooldown_turnos > 0 ? `<span style="font-size:0.68rem;color:#7a6060"> · CD ${h.cooldown_turnos}t</span>` : '';
    const alcanceLabel = h.alcance_celulas != null ? `<span style="font-size:0.68rem;color:#7ec8f0"> · ⟷ ${h.alcance_celulas}c</span>` : '';

    return `<div onclick="${disabled ? `mostrarToast(${JSON.stringify(msgBloqueio)},'erro')` : `mapaAtaqueSelecionarHabilidade(${i})`}"
      style="padding:10px 12px;background:rgba(20,12,12,0.8);border:1px solid ${corBorda};border-radius:8px;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '0.55' : '1'};transition:all 0.15s"
      ${disabled ? '' : `onmouseenter="this.style.borderColor='rgba(232,80,60,0.4)'" onmouseleave="this.style.borderColor='${corBorda}'"`}>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:${corNome}">${h.nome}${cdLabel}${alcanceLabel}</span>
        ${badge}
      </div>
      <div style="font-size:0.78rem;color:#9a8888;line-height:1.4">${(h.efeito || '').slice(0, 90)}${(h.efeito || '').length > 90 ? '…' : ''}</div>
    </div>`;
  }).join('') || '<div style="color:#7a6060;font-style:italic;padding:12px">Nenhuma habilidade disponível</div>';

  // Pets section (reutilizar atkRenderizarSecaoPets)
  const petsWrap = document.getElementById('atk-mapa-pets-wrap');
  if (petsWrap) {
    const petsContainer = document.createElement('div');
    petsContainer.id = '_temp_atk_pets';
    document.body.appendChild(petsContainer);
    atkRenderizarSecaoPets(atacanteNome, 'campanha');
    // Clone to float panel
    const petsEl = document.getElementById('atk-pets-secao');
    if (petsEl) {
      petsWrap.innerHTML = petsEl.outerHTML;
    }
    petsContainer.remove();
  }

  // ── Seção de Ação Criativa no painel flutuante ───────────────────────────
  let criatMapaWrap = document.getElementById('atk-mapa-criativo-wrap');
  if (!criatMapaWrap) {
    // Criar e injetar após a lista de habilidades se ainda não existir
    criatMapaWrap = document.createElement('div');
    criatMapaWrap.id = 'atk-mapa-criativo-wrap';
    criatMapaWrap.style.cssText = 'margin-top:10px;';
    if (lista.parentElement) lista.parentElement.appendChild(criatMapaWrap);
  }

  if (temPermissao('ataque_criativo')) {
    const bloqAtk = atkVerificarBloqueioAtaque(atacanteNome, 'fisico')
      || atkVerificarBloqueioAtaque(atacanteNome, 'magico');
    if (bloqAtk) {
      criatMapaWrap.innerHTML = `<div style="padding:10px;color:#e8604c;font-size:0.75rem;text-align:center;border:1px solid rgba(232,96,76,0.25);border-radius:8px;background:rgba(232,96,76,0.06)">🚫 Ação criativa bloqueada — ${bloqAtk}</div>`;
    } else {
      criatMapaWrap.innerHTML = `
        <div style="border-top:1px solid rgba(60,30,30,0.5);padding-top:10px;margin-top:4px">
          <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:#e8604c;margin-bottom:6px;letter-spacing:0.05em">✨ AÇÃO CRIATIVA</div>
          <textarea id="atk-mapa-criativo-desc" placeholder="Descreva sua ação criativa..." rows="2"
            style="width:100%;background:rgba(10,6,2,0.8);border:1px solid rgba(60,30,30,0.6);border-radius:6px;color:#c8d8e8;font-size:0.8rem;padding:8px;resize:none;font-family:inherit;margin-bottom:6px"></textarea>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <button onclick="mapaAtaqueCriativoSetTipo('ataque',this)" id="atk-mapa-criativo-btn-ataque"
              style="flex:1;padding:5px 4px;border:1px solid rgba(232,80,60,0.5);border-radius:5px;background:rgba(232,80,60,0.12);color:#e8604c;font-size:0.7rem;cursor:pointer">⚔ Ataque</button>
            <button onclick="mapaAtaqueCriativoSetTipo('suporte',this)" id="atk-mapa-criativo-btn-suporte"
              style="flex:1;padding:5px 4px;border:1px solid rgba(60,30,30,0.5);border-radius:5px;background:rgba(20,12,12,0.8);color:#c8d8e8;font-size:0.7rem;cursor:pointer">✨ Suporte</button>
            <button onclick="mapaAtaqueCriativoSetTipo('narrativo',this)" id="atk-mapa-criativo-btn-narrativo"
              style="flex:1;padding:5px 4px;border:1px solid rgba(60,30,30,0.5);border-radius:5px;background:rgba(20,12,12,0.8);color:#c8d8e8;font-size:0.7rem;cursor:pointer">📜 Narrativo</button>
          </div>
          <button onclick="mapaAtaqueSelecionarCriativo()"
            style="width:100%;padding:8px;background:rgba(232,80,60,0.12);border:1px solid rgba(232,80,60,0.35);border-radius:7px;color:#e8604c;font-family:'Cinzel',serif;font-size:0.75rem;cursor:pointer">
            ✨ Enviar Ação Criativa
          </button>
        </div>`;
    }
    criatMapaWrap.style.display = 'block';
    // Inicializar tipo padrão
    CRIATIVO_TIPO = 'ataque';
    CRIATIVO_ALVO_TIPO = 'unico';
  } else {
    criatMapaWrap.style.display = 'none';
  }
}

function mapaAtaqueCriativoSetTipo(tipo, btn) {
  CRIATIVO_TIPO = tipo;
  // Resetar estilos de todos os botões
  ['atk-mapa-criativo-btn-ataque','atk-mapa-criativo-btn-suporte','atk-mapa-criativo-btn-narrativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.borderColor = 'rgba(60,30,30,0.5)';
      el.style.background = 'rgba(20,12,12,0.8)';
      el.style.color = '#c8d8e8';
    }
  });
  // Destacar selecionado
  if (btn) {
    const cor = tipo === 'ataque' ? 'rgba(232,80,60,0.5)' : tipo === 'suporte' ? 'rgba(94,224,154,0.5)' : 'rgba(126,200,240,0.5)';
    const bg  = tipo === 'ataque' ? 'rgba(232,80,60,0.12)' : tipo === 'suporte' ? 'rgba(94,224,154,0.1)' : 'rgba(126,200,240,0.1)';
    const txtCor = tipo === 'ataque' ? '#e8604c' : tipo === 'suporte' ? '#5ee09a' : '#7ec8f0';
    btn.style.borderColor = cor;
    btn.style.background = bg;
    btn.style.color = txtCor;
  }
}

function mapaAtaqueSelecionarCriativo() {
  const descEl = document.getElementById('atk-mapa-criativo-desc');
  const desc = descEl ? descEl.value.trim() : '';
  if (!desc) { mostrarToast('Descreva a ação criativa', 'erro'); return; }

  COMBATE.habilidadeSel = {
    criativo: true,
    descricao: desc,
    nome: 'Ação Criativa',
    criativo_tipo: CRIATIVO_TIPO,
    criativo_alvo_tipo: CRIATIVO_ALVO_TIPO,
    formula_dano: null,
    cooldown_turnos: 0,
    alvo_tipo: CRIATIVO_TIPO === 'suporte'
      ? (CRIATIVO_ALVO_TIPO === 'proprio' ? 'proprio' : 'aliado')
      : 'inimigo',
  };

  // Narrativo, próprio ou área → enviar diretamente sem selecionar alvo
  if (CRIATIVO_TIPO === 'narrativo' || CRIATIVO_ALVO_TIPO === 'proprio' || CRIATIVO_ALVO_TIPO === 'area') {
    COMBATE.alvoNome = CRIATIVO_ALVO_TIPO === 'proprio'
      ? COMBATE.atacanteNome
      : COMBATE.atacanteNome; // área: sem alvo fixo
    mapaAtaqueFechar();
    atkEnviarAtaqueCriativo();
    return;
  }

  // Ataque único ou suporte com alvo → ir para fase 2 de seleção de alvo no painel
  ATAQUE_MAPA_STATE.fase = 'alvos';
  atkMontarSelecaoAlvo();
  _mapaAtaqueRenderAlvos();

  const corAcao = '#e8604c';
  document.getElementById('atk-mapa-hab-resumo').innerHTML = `
    <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:${corAcao}">✨ ${desc.slice(0, 60)}${desc.length > 60 ? '…' : ''}</div>
    <div style="font-size:0.72rem;color:#9a8888;margin-top:3px">Ação Criativa — selecione o alvo</div>
  `;
  document.getElementById('atk-mapa-fase1').style.display = 'none';
  document.getElementById('atk-mapa-fase2').style.display = 'block';
  document.getElementById('atk-mapa-titulo').textContent = CRIATIVO_TIPO === 'suporte' ? '✨ Selecionar Aliado' : '🎯 Selecionar Alvo';
  _mapaAtaqueDestacarAlvos();
}

function mapaAtaqueSelecionarHabilidade(idx) {
  const h = COMBATE._habilidades[idx];
  if (!h) return;
  COMBATE.habilidadeSel = h;
  ATAQUE_MAPA_STATE.fase = 'alvos';

  // Mostrar círculo de alcance no mapa
  if (h.alcance_celulas != null) {
    mapaShowRangeCircle(COMBATE.atacanteNome, h.alcance_celulas);
  } else {
    mapaHideRangeCircle();
  }

  const alvoTipo = h.alvo_tipo || 'inimigo';

  // Habilidades que afetam apenas o próprio: aplicar imediatamente
  if (alvoTipo === 'proprio') {
    COMBATE.alvoNome = COMBATE.atacanteNome;
    if (!h.criativo && h.custo_rsv) {
      const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, 'campanha');
      if (!check.ok) {
        mostrarToast(`❌ Sem ${check.atributo} suficiente!`, 'erro');
        return;
      }
    }
    atkMontarSelecaoAlvo();
    atkAplicarSkillSuporte([COMBATE.atacanteNome]);
    mapaAtaqueFechar();
    return;
  }

  // Todos os aliados: aplicar imediatamente
  if (alvoTipo === 'todos_aliados') {
    if (!h.criativo && h.custo_rsv) {
      const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, 'campanha');
      if (!check.ok) {
        mostrarToast(`❌ Sem ${check.atributo} suficiente!`, 'erro');
        return;
      }
    }
    atkMontarSelecaoAlvo();
    const aliados = atkListarAlvos().filter(a => !a.foraAlcance).map(a => a.nome);
    aliados.push(COMBATE.atacanteNome);
    atkAplicarSkillSuporte(aliados);
    mapaAtaqueFechar();
    return;
  }

  // Área: iniciar modo de área (reutilizar existente)
  if (alvoTipo === 'area') {
    atkMontarSelecaoAlvo();
    mapaAtaqueFechar(); // fechar painel e usar modal normal para área
    abrirModalAtaque(COMBATE.atacanteNome, 'campanha');
    // Selecionar a habilidade no modal recém-aberto
    setTimeout(() => atkSelecionarHabilidade(idx), 100);
    return;
  }

  // Alvo único ou todos_inimigos: mostrar fase 2 com lista + destaque tokens
  atkMontarSelecaoAlvo(); // preenche COMBATE._alvos com distâncias

  // Preencher lista de alvos no painel
  _mapaAtaqueRenderAlvos();

  // Atualizar UI para fase 2
  const ehBuff = alvoTipo === 'aliado';
  const corAcao = ehBuff ? '#5ee09a' : '#e8604c';
  const iconAcao = ehBuff ? '✨' : '⚔';
  document.getElementById('atk-mapa-hab-resumo').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:'Cinzel',serif;font-size:0.85rem;color:${corAcao}">${iconAcao} ${h.nome}</span>
      ${h.alcance_celulas != null ? `<span style="font-size:0.7rem;color:#7ec8f0;background:rgba(126,200,240,0.1);border:1px solid rgba(126,200,240,0.25);border-radius:4px;padding:1px 7px">⟷ ${h.alcance_celulas}c</span>` : ''}
    </div>
    ${h.formula_dano ? `<div style="font-size:0.72rem;color:#f0cc6a;margin-top:3px">🎲 ${h.formula_dano}</div>` : ''}
    ${h.efeito ? `<div style="font-size:0.75rem;color:#9a8888;margin-top:3px">${h.efeito.slice(0, 80)}${h.efeito.length > 80 ? '…' : ''}</div>` : ''}
  `;

  document.getElementById('atk-mapa-fase1').style.display = 'none';
  document.getElementById('atk-mapa-fase2').style.display = 'block';
  document.getElementById('atk-mapa-titulo').textContent = ehBuff ? '✨ Selecionar Aliado' : '🎯 Selecionar Alvo';

  // Destacar tokens no mapa
  _mapaAtaqueDestacarAlvos();
}

function _mapaAtaqueRenderAlvos() {
  const alvos = COMBATE._alvos;
  const h = COMBATE.habilidadeSel;
  const alvoTipo = h?.alvo_tipo || 'inimigo';
  const ehBuff = alvoTipo === 'aliado';

  const lista = document.getElementById('atk-mapa-alvos-lista');
  if (!lista) return;

  lista.innerHTML = alvos.map((a, i) => {
    const cor = a.cor || (ehBuff ? '#5ee09a' : '#7ec8f0');
    const foraAlcance = a.foraAlcance;
    const distLabel = a.distCelulas != null ? ` · ${a.distCelulas.toFixed(1)}c` : '';
    return `<div onclick="${foraAlcance
      ? `mostrarToast('Alvo fora do alcance (${a.distCelulas?.toFixed(1)} de ${h.alcance_celulas} células)','erro')`
      : `mapaAtaqueClicarAlvo(${JSON.stringify(a.nome)})`}"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(20,12,12,0.8);border:1px solid ${cor}22;border-left:2px solid ${foraAlcance ? '#444' : cor};border-radius:8px;cursor:${foraAlcance ? 'default' : 'pointer'};opacity:${foraAlcance ? '0.4' : '1'}">
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:${foraAlcance ? '#556' : cor}">${a.nome}</div>
        <div style="font-size:0.68rem;color:#7a6060">HP: ${a.hp}/${a.hpMax || a.hp}${distLabel}${foraAlcance ? ' · 🚫 fora do alcance' : ''}</div>
      </div>
      <span style="color:${foraAlcance ? '#444' : cor};font-size:0.8rem">›</span>
    </div>`;
  }).join('') || '<div style="color:#7a6060;font-style:italic;padding:8px">Sem alvos disponíveis</div>';
}

function _mapaAtaqueDestacarAlvos() {
  // Remove highlights anteriores
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });

  if (!ATAQUE_MAPA_STATE.ativo || ATAQUE_MAPA_STATE.fase !== 'alvos') return;

  const alvoTipo = COMBATE.habilidadeSel?.alvo_tipo || 'inimigo';
  const ehBuff = alvoTipo === 'aliado';

  COMBATE._alvos.forEach(a => {
    const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(a.nome)}"]`);
    if (!tokenEl) return;
    if (a.foraAlcance) {
      tokenEl.classList.add('atk-target-fora-alcance');
    } else if (ehBuff) {
      tokenEl.classList.add('atk-target-buff');
    } else {
      tokenEl.classList.add('atk-target-disponivel');
    }
  });
}

function mapaAtaqueClicarAlvo(nomeAlvo) {
  const alvos = COMBATE._alvos;
  const idx = alvos.findIndex(a => a.nome === nomeAlvo);
  if (idx < 0) return;
  const a = alvos[idx];

  if (a.foraAlcance) {
    mostrarToast(`🚫 Alvo fora do alcance (${a.distCelulas?.toFixed(1)} de ${COMBATE.habilidadeSel?.alcance_celulas} células). Mova seu personagem!`, 'erro');
    return;
  }

  // Limpar destaques e fechar painel flutuante
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });
  document.getElementById('atk-mapa-float-panel').style.display = 'none';
  // Manter ATAQUE_MAPA_STATE.ativo=true para limpeza no fecharModalAtaque

  const h = COMBATE.habilidadeSel;

  // Verificar custo
  if (!h.criativo && h.custo_rsv) {
    const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, 'campanha');
    if (!check.ok) {
      mostrarToast(`❌ Sem ${check.atributo} suficiente! (precisa ${check.custo}, tem ${check.atual})`, 'erro');
      ATAQUE_MAPA_STATE = { ativo: false };
      _aplicarEstadoBatalhaUI();
      return;
    }
  }

  COMBATE.alvoNome = a.nome;

  // Atualizar resumos no modal existente
  const resumoEl = document.getElementById('atk-habilidade-resumo');
  if (resumoEl) resumoEl.innerHTML = `<strong style="color:#e8604c">${h.nome}</strong>`;
  const alvoResEl = document.getElementById('atk-alvo-resumo');
  if (alvoResEl) alvoResEl.textContent = `Alvo: ${a.nome}`;

  const ehBuff = (h.alvo_tipo === 'aliado' || h.alvo_tipo === 'proprio');

  if (h.criativo) {
    atkEnviarAtaqueCriativo();
    ATAQUE_MAPA_STATE = { ativo: false };
    return;
  }

  if (!ehBuff && COMBATE._estadoAtk === 'fora_combate' && RPG_DATA?.myRole !== 'mestre') {
    atkEnviarSolicitacaoSkill();
    ATAQUE_MAPA_STATE = { ativo: false };
    return;
  }

  if (ehBuff) {
    atkAplicarSkillSuporte([a.nome]);
    ATAQUE_MAPA_STATE = { ativo: false };
    _aplicarEstadoBatalhaUI();
    return;
  }

  if (h.alvo_tipo === 'todos_inimigos' || h.alvo_tipo === 'aoe') {
    const todos = COMBATE._alvos.filter(x => !x.foraAlcance).map(x => x.nome);
    if (COMBATE._estadoAtk === 'fora_combate' && RPG_DATA?.myRole !== 'mestre') {
      atkEnviarSolicitacaoSkill();
      ATAQUE_MAPA_STATE = { ativo: false };
      return;
    }
    COMBATE._alvosAoE = todos;
    _mapaAtaqueAbrirStep3Overlay();
    return;
  }

  // Ataque normal: abrir step 3 como overlay
  _mapaAtaqueAbrirStep3Overlay();
}

function _mapaAtaqueAbrirStep3Overlay() {
  // Garantir que o modal está no body (não em âncora)
  const modal = document.getElementById('modal-ataque');
  if (!modal) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal._atkModo = 'overlay';

  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
  const inner = modal.querySelector(':scope > div');
  if (inner) {
    inner.style.borderRadius = '16px 16px 0 0';
    inner.style.marginTop = '';
    inner.style.paddingBottom = '44px';
    inner.style.maxHeight = '90vh';
  }

  atkPrepararStep3();
  atkIrParaStep(3);
}

function mapaAtaqueVoltarFase1() {
  ATAQUE_MAPA_STATE.fase = 'habilidades';
  COMBATE.habilidadeSel = null;
  mapaHideRangeCircle();
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });
  _mapaAtaqueRenderHabilidades();
  document.getElementById('atk-mapa-fase1').style.display = 'block';
  document.getElementById('atk-mapa-fase2').style.display = 'none';
  document.getElementById('atk-mapa-titulo').textContent = '⚔ Selecionar Habilidade';
}

function mapaAtaqueFechar() {
  ATAQUE_MAPA_STATE = { ativo: false, atacanteNome: null, fase: 'habilidades' };
  // Ocultar sidebar panel se estava ativo
  const _sp = document.getElementById('atk-sidebar-painel');
  if (_sp) _sp.style.display = 'none';
  const panel = document.getElementById('atk-mapa-float-panel');
  if (panel) panel.style.display = 'none';
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });
  mapaHideRangeCircle();
  if (typeof mapaHideAoECircle === 'function') mapaHideAoECircle();
  // Restaurar botão atacar
  _aplicarEstadoBatalhaUI();
}

// ── Atualizar alvos disponíveis após mover personagem ─────────
function _mapaAtaqueAtualizarAposMovimento(nomeMovido) {
  if (!ATAQUE_MAPA_STATE.ativo || ATAQUE_MAPA_STATE.fase !== 'alvos') return;
  if (nomeMovido !== ATAQUE_MAPA_STATE.atacanteNome) return;
  // Recalcular distâncias
  atkMontarSelecaoAlvo();
  // Atualizar lista de alvos no painel
  _mapaAtaqueRenderAlvos();
  // Atualizar destaques no mapa
  _mapaAtaqueDestacarAlvos();
}

// ── Botão ⚔ acima do token do personagem cuja vez é ──────────
function _mapaAdicionarBotaoAtaqueTurno() {
  document.querySelectorAll('.atk-turno-badge').forEach(b => b.remove());

  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs || bs.fase !== 'combate' || bs.pausada) return;

  const atual = bs.participantes?.[bs.ordemAtual];
  if (!atual) return;

  const meuNome = RPG_DATA?.linked || '';
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const ehMinhaVez = atual.nome === meuNome;
  const mestreJogaPor = isMestre && mestreDeveJogarPor(atual);
  const ehMinhaVezMestre = isMestre && ehMinhaVez;

  if (!ehMinhaVez && !mestreJogaPor && !ehMinhaVezMestre) return;

  // Não mostrar se painel já aberto
  if (ATAQUE_MAPA_STATE.ativo) return;

  const tokenEl = document.querySelector(`.mapa-token[data-nome="${CSS.escape(atual.nome)}"]`);
  if (!tokenEl) return;

  const badge = document.createElement('button');
  badge.className = 'atk-turno-badge';
  badge.textContent = '⚔';
  badge.title = 'Atacar — selecionar habilidade';
  badge.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    mapaAtaqueIniciar(atual.nome);
  };
  tokenEl.appendChild(badge);
}


// ── Sistema de Pet ────────────────────────────────────────────
// Retorna habilidades do pet independente de como estão armazenadas
// (criaturas usam custom_attrs.habilidades; jogadores/NPCs usam skills)
function petGetHabilidadesPet(petNome, contexto) {
  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const c = chars.find(x => x.nome === petNome);
  if (!c) return [];
  const ca = c.custom_attrs || {};
  // Criaturas e NPCs podem ter habilidades em custom_attrs.habilidades
  if (ca.habilidades?.length) {
    return ca.habilidades.map(h => ({ ...h, cooldown_turnos: h.cooldown_turnos || 0 }));
  }
  // Jogadores / personagens com ficha usam a tabela skills
  if (contexto === 'arena') return atkGetHabilidadesArena(petNome);
  return atkGetHabilidadesCampanha(petNome);
}

// Retorna pets vinculados ao dono que possuem habilidades
function petGetPetsDoDono(donoNome, contexto) {
  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  return chars.filter(c => {
    const ca = c.custom_attrs || {};
    return ca.eh_pet === true && ca.pet_dono === donoNome;
  });
}

// Verifica se o dono está incapacitado (pet não pode agir)
function petDonoEstaAtivo(donoNome, contexto, tipoDanoHabilidade) {
  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const dono = chars.find(c => c.nome === donoNome);
  if (!dono) return false;
  const hp = dono.hp_atual ?? (dono.custom_attrs?.hp_max ?? 100);
  if (hp <= 0) return false;
  // Verificar debuff sem_ataque
  const buffs = dono.buffs || [];
  const bloqueado = buffs.some(b => b.sem_ataque && (b.sem_ataque_turnos_restantes ?? 0) > 0 && (b.sem_ataque_tipo || 'todos') === 'todos');
  if (bloqueado) return false;
  // Verificar bloqueio de ataque específico por tipo
  if (tipoDanoHabilidade) {
    const bloqueio = atkVerificarBloqueioAtaque(donoNome, tipoDanoHabilidade);
    if (bloqueio) return false;
  }
  return true;
}

// Renderiza seção de pets no modal de ataque (step 1)
function atkRenderizarSecaoPets(donoNome, contexto) {
  const pets = petGetPetsDoDono(donoNome, contexto);
  const el = document.getElementById('atk-pets-section');
  if (!el) return;

  if (!pets.length) { el.style.display = 'none'; return; }

  const donoAtivo = petDonoEstaAtivo(donoNome, contexto);
  const rows = pets.map(pet => {
    const habilidades = petGetHabilidadesPet(pet.nome, contexto)
      .filter(h => !h.tipo_habilidade || h.tipo_habilidade === 'acao');
    if (!habilidades.length) return '';
    const cor = pet.custom_attrs?.cor || '#7ec8f0';
    const hpAtual = pet.hp_atual ?? (pet.custom_attrs?.hp_max ?? 100);
    const hpMax = pet.custom_attrs?.hp_max ?? 100;
    const incap = hpAtual <= 0;
    return `
      <div style="margin-bottom:8px;padding:10px;background:rgba(10,18,28,0.8);border:1px solid ${cor}22;border-left:2px solid ${cor};border-radius:8px;opacity:${incap||!donoAtivo?0.45:1}">
        <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:${cor};margin-bottom:6px">🐾 ${pet.nome}${incap?' <span style="color:#e74c3c;font-size:0.65rem">[INCAPACITADO]</span>':''}</div>
        ${habilidades.map((h, i) => {
          const bloqueio = atkVerificarBloqueioAtaque(pet.nome, h.tipo_dano);
          const donoAtivoParaTipo = petDonoEstaAtivo(donoNome, contexto, h.tipo_dano);
          const desabilitado = incap || !donoAtivoParaTipo || !!bloqueio;
          const motivo = incap ? 'Pet incapacitado' : !donoAtivoParaTipo ? 'Dono incapacitado para este tipo de ataque' : bloqueio;
          return `<div onclick="${desabilitado ? `mostrarToast(${JSON.stringify(motivo)},'erro')` : `atkUsarAtaquePet('${pet.nome.replace(/'/g,"\\'")}',${i})`}"
            style="padding:8px 10px;background:rgba(20,12,12,0.6);border:1px solid ${desabilitado?'rgba(60,40,20,0.4)':'rgba(126,200,240,0.2)'};border-radius:6px;cursor:${desabilitado?'default':'pointer'};margin-bottom:4px;transition:all 0.15s"
            ${desabilitado?'':` onmouseenter="this.style.borderColor='rgba(126,200,240,0.45)'" onmouseleave="this.style.borderColor='rgba(126,200,240,0.2)'"`}>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-family:'Cinzel',serif;font-size:0.8rem;color:${desabilitado?'#6a5840':'#7ec8f0'}">${h.nome}</span>
              ${h.formula_dano?`<span style="font-size:0.7rem;color:#f0cc6a">${h.formula_dano}</span>`:''}
            </div>
            ${h.efeito?`<div style="font-size:0.75rem;color:#7a8898;margin-top:2px">${h.efeito.slice(0,80)}${h.efeito.length>80?'…':''}</div>`:''}
          </div>`;
        }).join('')}
      </div>`;
  }).join('');

  if (!rows.trim()) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="border-top:1px solid rgba(126,200,240,0.15);margin-top:12px;padding-top:12px">
      <div style="font-family:'Cinzel',serif;font-size:0.6rem;color:rgba(126,200,240,0.5);text-transform:uppercase;margin-bottom:8px">Ataques do Pet / Montaria</div>
      ${rows}
    </div>`;
}

// Inicia ataque do pet: injeta pet como atacante e vai para seleção de alvo
function atkUsarAtaquePet(petNome, habilidadeIdx) {
  const contexto = COMBATE.contexto;
  const habilidades = petGetHabilidadesPet(petNome, contexto);
  const h = habilidades[habilidadeIdx];
  if (!h) return;

  // Guarda o dono real para logs e custos de recurso
  COMBATE._petAtacante = petNome;
  COMBATE._donoAtacante = COMBATE.atacanteNome;

  // Temporariamente troca o atacante para o pet (posição correta para cálculo de alcance)
  COMBATE.atacanteNome = petNome;
  COMBATE.habilidadeSel = h;

  atkMontarSelecaoAlvo();
  atkIrParaStep(2);
}

// Após confirmar ataque do pet, restaura o dono no atacante
const _atkConfirmarOriginal = window.atkConfirmarAtaque;
async function atkConfirmarAtaque() {
  await _atkConfirmarOriginal?.();
  // Restaurar dono após ataque do pet
  if (COMBATE._donoAtacante) {
    COMBATE.atacanteNome = COMBATE._donoAtacante;
    COMBATE._petAtacante = null;
    COMBATE._donoAtacante = null;
  }
}

function atkGetHabilidadesArena(nome) {
  const c = AR.chars.find(x => x.nome === nome);
  const skills = (c?.custom_attrs?.habilidades || []).map(h => ({ ...h, cooldown_turnos: h.cooldown_turnos || 0, efeitos_bonus: Array.isArray(h.efeitos_bonus) ? h.efeitos_bonus : [] }));

  // ── Injetar efeitos desbloqueados por equipamentos visuais (igual à campanha) ──
  const equipVisuais = c?.custom_attrs?.aparencia?.equipamentos_visuais || [];
  const comUnlock = equipVisuais.filter(eq => eq.unlock_efeitos && Array.isArray(eq.unlock_efeitos.efeitos) && eq.unlock_efeitos.efeitos.length);
  if (!comUnlock.length) return skills;

  return skills.map(sk => {
    const extras = [];
    for (const eq of comUnlock) {
      const habs = eq.unlock_efeitos.habilidades || ['*'];
      if (habs.includes('*') || habs.includes(sk.nome) || habs.includes(sk.habilidade)) {
        extras.push(...eq.unlock_efeitos.efeitos);
      }
    }
    if (!extras.length) return sk;
    return { ...sk, efeitos_bonus: [...sk.efeitos_bonus, ...extras] };
  });
}

function atkGetHabilidadesCampanha(nome) {
  const skills = _skFiltrarPorChar(RPG_DATA?.skills || [], nome).map(s => {
    let anim = s.animacao;
    if (typeof anim === 'string') { try { anim = JSON.parse(anim); } catch(e) { anim = null; } }
    if (anim && typeof anim !== 'object') anim = null;
    return {
      id: s.id,
      nome: s.habilidade,
      habilidade: s.habilidade,
      formula_dano:    s.formula_dano || null,
      efeito:          s.efeito,
      custo_rsv:       s.custo_rsv,
      custo_tipo:      s.custo_tipo || 'acao',
      cooldown_turnos: s.cooldown_turnos || 0,
      tipo_dano:       s.tipo_dano || 'fisico',
      alcance_celulas: s.alcance_celulas ?? null,
      atributo_base:   s.atributo_base || null,
      mod_atributo_pct: s.mod_atributo_pct ?? null,
      alvo_tipo:       s.alvo_tipo || 'inimigo',
      efeitos_bonus:   Array.isArray(s.efeitos_bonus) ? s.efeitos_bonus : [],
      animacao:        anim,
      critico_positivo: s.critico_positivo || null,
      critico_negativo: s.critico_negativo || null,
      // Invocação (config extraída de efeitos_bonus ou campos diretos)
      invocar_nome:          s.invocar_nome || null,
      invocar_duracao_turnos: s.invocar_duracao_turnos ?? 0,
    };
  });

  // ── Injetar efeitos desbloqueados por equipamentos visuais ────────────────
  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  const equipVisuais = c?.custom_attrs?.aparencia?.equipamentos_visuais || [];
  const comUnlock = equipVisuais.filter(eq => eq.unlock_efeitos && Array.isArray(eq.unlock_efeitos.efeitos) && eq.unlock_efeitos.efeitos.length);
  if (!comUnlock.length) return skills;

  return skills.map(sk => {
    const extras = [];
    for (const eq of comUnlock) {
      const habs = eq.unlock_efeitos.habilidades || ['*'];
      if (habs.includes('*') || habs.includes(sk.nome) || habs.includes(sk.habilidade)) {
        extras.push(...eq.unlock_efeitos.efeitos);
      }
    }
    if (!extras.length) return sk;
    return { ...sk, efeitos_bonus: [...sk.efeitos_bonus, ...extras] };
  });
}

// ── Builder de efeitos bônus (modal de habilidade) ───────────
let SK_EFEITOS_TEMP = [];

function skToggleDotFields()   { document.getElementById('sef-dot-fields').style.display   = document.getElementById('sef-dot-on').checked   ? 'block' : 'none'; }
function skToggleHotFields()   { document.getElementById('sef-hot-fields').style.display   = document.getElementById('sef-hot-on').checked   ? 'block' : 'none'; }
function skToggleBoostFields() { document.getElementById('sef-boost-fields').style.display = document.getElementById('sef-boost-on').checked ? 'block' : 'none'; }
function skToggleRecFields()   { document.getElementById('sef-rec-fields').style.display   = document.getElementById('sef-rec-on').checked   ? 'block' : 'none'; }
function skToggleStunFields()  { document.getElementById('sef-stun-fields').style.display  = document.getElementById('sef-stun-on').checked  ? 'block' : 'none'; }
function skToggleMovFields()   { document.getElementById('sef-mov-fields').style.display   = document.getElementById('sef-mov-on').checked   ? 'block' : 'none'; }
function skToggleAtkFields()   { document.getElementById('sef-atk-fields').style.display   = document.getElementById('sef-atk-on').checked   ? 'block' : 'none'; }
function skToggleDebFields()   { document.getElementById('sef-deb-fields').style.display   = document.getElementById('sef-deb-on').checked   ? 'block' : 'none'; }
function skToggleSefFields(tipo) { const el = document.getElementById('sef-' + tipo + '-fields'); const cb = document.getElementById('sef-' + tipo + '-on'); if (el && cb) el.style.display = cb.checked ? 'block' : 'none'; }
function skToggleNecroFields() { const el = document.getElementById('sef-necro-fields'); if (el) el.style.display = document.getElementById('sef-necro-on').checked ? 'block' : 'none'; }
function skToggleRastroFields() {
  const p = document.getElementById('sef-rastro-persona-fields'); if (p) p.style.display = document.getElementById('sef-rastro-persona-on')?.checked ? 'block' : 'none';
  const a = document.getElementById('sef-rastro-anima-fields');   if (a) a.style.display = document.getElementById('sef-rastro-anima-on')?.checked   ? 'block' : 'none';
}

function skAlvoTipoChange() {
  const v = document.getElementById('sk-alvo-tipo').value;
  const dicas = {
    inimigo:        'Ataca um inimigo — usa fórmula de dano e efeitos negativos.',
    proprio:        'Afeta apenas o próprio personagem — ideal para buffs pessoais.',
    aliado:         'Afeta um aliado dentro do alcance — usa efeitos positivos.',
    todos_aliados:  'Afeta todos os aliados dentro do alcance simultaneamente.',
    todos_inimigos: 'Ataca todos os inimigos dentro do alcance — AoE.',
    area:           'Área posicionável: o jogador arrasta o círculo no mapa. Atinge todos dentro — com Fogo Amigo ativo, inclui aliados.',
  };
  document.getElementById('sk-alvo-dica').textContent = dicas[v] || '';
}

// Handler para mostrar/ocultar campos de invocação
function skTipoDanoChange() {
  const tipo = document.getElementById('sk-tipo-dano')?.value || '';
  const wrapInv = document.getElementById('sk-invocacao-wrap');
  if (wrapInv) wrapInv.style.display = tipo === 'invocacao' ? 'block' : 'none';
  const alvoSel = document.getElementById('sk-alvo-tipo');
  if (alvoSel) {
    if (tipo === 'cura' || tipo === 'buff' || tipo === 'escudo') {
      // Positivo: redirecionar de inimigo → aliado
      if (alvoSel.value === 'inimigo' || alvoSel.value === 'todos_inimigos') {
        alvoSel.value = 'aliado';
        if (typeof skAlvoTipoChange === 'function') skAlvoTipoChange();
      }
    } else if (tipo === 'fisico' || tipo === 'magico' || tipo === 'puro') {
      // Destrutivo: redirecionar de aliado → inimigo
      if (alvoSel.value === 'aliado' || alvoSel.value === 'todos_aliados' || alvoSel.value === 'proprio') {
        alvoSel.value = 'inimigo';
        if (typeof skAlvoTipoChange === 'function') skAlvoTipoChange();
      }
    }
  }
}

// Handler para mostrar/ocultar campos do efeito atrasado por tipo
function skDelayedTipoEfeitoChange() {
  const tipo = document.getElementById('sef-delayed-tipo-efeito')?.value || 'dano_aoe';
  const show = id => { const el = document.getElementById(id); if(el) el.style.display = ''; };
  const hide = id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; };
  hide('sef-delayed-dano-fields'); hide('sef-delayed-cura-fields');
  hide('sef-delayed-buff-fields'); hide('sef-delayed-mov-fields'); hide('sef-delayed-attr-fields');
  if (tipo === 'dano_aoe')  show('sef-delayed-dano-fields');
  if (tipo === 'cura_aoe')  show('sef-delayed-cura-fields');
  if (tipo === 'buff_aoe')  show('sef-delayed-buff-fields');
  if (tipo === 'movimento') show('sef-delayed-mov-fields');
  if (tipo === 'atributo')  show('sef-delayed-attr-fields');
}

// Handler para mostrar/ocultar facção no modal de novo personagem
function ncTipoChange() {
  const tipo = document.getElementById('nc-tipo')?.value || '';
  const wrap = document.getElementById('nc-faction-wrap');
  if (wrap) wrap.style.display = (tipo === 'npc' || tipo === 'criatura') ? 'block' : 'none';
}

function skAbrirFormEfeito() {
  // Injetar campo "Aplica ao usuário" no form se ainda não existir
  const form = document.getElementById('sk-efeito-form');
  if (form && !document.getElementById('sef-alvo-usuario')) {
    const divU = document.createElement('div');
    divU.style.cssText = 'margin-bottom:10px;padding:8px 10px;background:rgba(126,200,240,0.06);border:1px solid rgba(126,200,240,0.2);border-radius:6px';
    divU.innerHTML = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-family:var(--fonte-d);font-size:0.65rem;color:var(--primario-v);text-transform:uppercase;letter-spacing:0.06em">
      <input type="checkbox" id="sef-alvo-usuario" style="accent-color:#7ec8f0">
      👤 Efeito colateral no usuário (aplica-se ao atacante, não ao alvo)
    </label>`;
    // Inserir antes do último botão do form (ou no final)
    const lastBtn = form.querySelector('button[onclick*="Confirmar"], button[onclick*="confirmar"]');
    if (lastBtn && lastBtn.parentNode) lastBtn.parentNode.insertBefore(divU, lastBtn);
    else form.appendChild(divU);
  }
  const fields = ['sef-stun-fields','sef-dot-fields','sef-hot-fields','sef-boost-fields','sef-rec-fields','sef-mov-fields','sef-atk-fields','sef-deb-fields','sef-imune-fields','sef-delayed-fields','sef-necro-fields','sef-rastro-persona-fields','sef-rastro-anima-fields'];
  const checks = ['sef-stun-on','sef-dot-on','sef-hot-on','sef-boost-on','sef-rec-on','sef-mov-on','sef-atk-on','sef-deb-on','sef-imune-on','sef-delayed-on','sef-alvo-usuario','sef-necro-on','sef-rastro-persona-on','sef-rastro-anima-on'];
  const inputs = ['sef-nome','sef-dot-formula','sef-hot-formula','sef-rec-atributo','sef-rec-formula'];
  fields.forEach(id => { const el = document.getElementById(id); if(el) el.style.display='none'; });
  checks.forEach(id => { const el = document.getElementById(id); if(el) el.checked=false; });
  inputs.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const _sefStunTurnos = document.getElementById('sef-stun-turnos'); if (_sefStunTurnos) _sefStunTurnos.value = 1;
  document.getElementById('sef-dot-turnos').value  = 3;
  document.getElementById('sef-hot-turnos').value  = 3;
  document.getElementById('sef-boost-mod').value   = 3;
  document.getElementById('sef-boost-turnos').value= 2;
  document.getElementById('sef-rec-modo').value    = 'imediato';
  document.getElementById('sef-rec-turnos').value  = 3;
  document.getElementById('sef-mov-turnos').value  = 1;
  document.getElementById('sef-atk-turnos').value  = 1;
  document.getElementById('sef-atk-tipo').value    = 'todos';
  document.getElementById('sef-deb-mod').value     = -3;
  document.getElementById('sef-deb-turnos').value  = 2;
  const _sefNecroTurnos = document.getElementById('sef-necro-turnos'); if (_sefNecroTurnos) _sefNecroTurnos.value = 3;
  const _sefNecroCor = document.getElementById('sef-necro-cor'); if (_sefNecroCor) _sefNecroCor.value = '#8e44ad';
  const _sefRpForm = document.getElementById('sef-rastro-persona-formula'); if (_sefRpForm) _sefRpForm.value = '';
  const _sefRpTurnos = document.getElementById('sef-rastro-persona-turnos'); if (_sefRpTurnos) _sefRpTurnos.value = 3;
  const _sefRaForm = document.getElementById('sef-rastro-anima-formula'); if (_sefRaForm) _sefRaForm.value = '';
  const _sefRaTurnos = document.getElementById('sef-rastro-anima-turnos'); if (_sefRaTurnos) _sefRaTurnos.value = 3;
  document.getElementById('sk-efeito-form').style.display = 'block';
}

function skCancelarEfeito() {
  document.getElementById('sk-efeito-form').style.display = 'none';
}

function skConfirmarEfeito() {
  const nome = document.getElementById('sef-nome').value.trim();
  if (!nome) { mostrarToast('Dê um nome ao efeito', 'erro'); return; }
  const efeito = { nome };
  // Negativos
  if (document.getElementById('sef-dot-on').checked) {
    efeito.dot_formula = document.getElementById('sef-dot-formula').value.trim() || '1d6';
    efeito.dot_turnos  = parseInt(document.getElementById('sef-dot-turnos').value) || 3;
  }
  if (document.getElementById('sef-stun-on')?.checked) {
    efeito.tipo            = 'stun';
    efeito.duracao_turnos  = parseInt(document.getElementById('sef-stun-turnos')?.value) || 1;
  }
  if (document.getElementById('sef-mov-on').checked) {
    efeito.sem_movimento        = true;
    efeito.sem_movimento_turnos = parseInt(document.getElementById('sef-mov-turnos').value) || 1;
  }
  if (document.getElementById('sef-atk-on').checked) {
    efeito.sem_ataque        = true;
    efeito.sem_ataque_tipo   = document.getElementById('sef-atk-tipo').value || 'todos';
    efeito.sem_ataque_turnos = parseInt(document.getElementById('sef-atk-turnos').value) || 1;
  }
  if (document.getElementById('sef-deb-on').checked) {
    efeito.mod_dano        = parseInt(document.getElementById('sef-deb-mod').value) || -3;
    efeito.mod_dano_turnos = parseInt(document.getElementById('sef-deb-turnos').value) || 2;
  }
  // Positivos
  if (document.getElementById('sef-hot-on').checked) {
    efeito.hot_formula = document.getElementById('sef-hot-formula').value.trim() || '1d6';
    efeito.hot_turnos  = parseInt(document.getElementById('sef-hot-turnos').value) || 3;
  }
  if (document.getElementById('sef-boost-on').checked) {
    efeito.boost_dano        = parseInt(document.getElementById('sef-boost-mod').value) || 3;
    efeito.boost_dano_turnos = parseInt(document.getElementById('sef-boost-turnos').value) || 2;
  }
  if (document.getElementById('sef-rec-on').checked) {
    efeito.rec_atributo = document.getElementById('sef-rec-atributo').value.trim();
    efeito.rec_formula  = document.getElementById('sef-rec-formula').value.trim() || '10';
    efeito.rec_modo     = document.getElementById('sef-rec-modo').value;
    efeito.rec_turnos   = parseInt(document.getElementById('sef-rec-turnos').value) || 3;
  }
  // Imunidade a dano
  if (document.getElementById('sef-imune-on')?.checked) {
    efeito.imune_dano        = true;
    efeito.imune_dano_turnos = parseInt(document.getElementById('sef-imune-turnos')?.value) || 1;
  }
  // Efeito Atrasado (generalizado)
  if (document.getElementById('sef-delayed-on')?.checked) {
    efeito.efeito_atrasado  = true;
    efeito.delay_turnos     = parseInt(document.getElementById('sef-delayed-turnos')?.value) || 2;
    efeito.alcance_celulas  = parseInt(document.getElementById('sef-delayed-alcance')?.value) || 2;
    const tipoEfeito = document.getElementById('sef-delayed-tipo-efeito')?.value || 'dano_aoe';
    efeito.tipo_efeito_atrasado = tipoEfeito;
    if (tipoEfeito === 'dano_aoe') {
      efeito.formula_dano   = document.getElementById('sef-delayed-formula')?.value.trim() || '';
      efeito.tipo_dano      = document.getElementById('sef-delayed-tipo')?.value.trim() || 'magico';
      efeito.stun_turnos    = parseInt(document.getElementById('sef-delayed-stun')?.value) || 0;
    } else if (tipoEfeito === 'cura_aoe') {
      efeito.formula_cura   = document.getElementById('sef-delayed-formula-cura')?.value.trim() || '';
    } else if (tipoEfeito === 'buff_aoe') {
      efeito.efeito_bonus_atrasado = {
        nome:             document.getElementById('sef-delayed-buff-nome')?.value.trim() || 'Efeito',
        tipo:             document.getElementById('sef-delayed-buff-tipo')?.value || 'buff',
        turnos:           parseInt(document.getElementById('sef-delayed-buff-turnos')?.value) || 2,
        turnos_restantes: parseInt(document.getElementById('sef-delayed-buff-turnos')?.value) || 2,
      };
    } else if (tipoEfeito === 'movimento') {
      efeito.movimento_atrasado = parseInt(document.getElementById('sef-delayed-mov-valor')?.value) || 3;
    } else if (tipoEfeito === 'atributo') {
      efeito.atributo_atrasado = {
        attr:  document.getElementById('sef-delayed-attr-nome')?.value.trim() || '',
        valor: parseInt(document.getElementById('sef-delayed-attr-valor')?.value) || 0,
        aoe:   document.getElementById('sef-delayed-attr-aoe')?.checked || false,
      };
    }
  }
  // Mover Usuário (Teleporte / Dash)
  if (document.getElementById('sef-mover-on')?.checked) {
    efeito.tipo          = 'mover_usuario';
    efeito.mover_destino  = document.getElementById('sef-mover-destino')?.value || 'escolha_livre';
    efeito.mover_distancia = parseInt(document.getElementById('sef-mover-distancia')?.value) || 9;
  }
  // Empurrão / Puxão
  if (document.getElementById('sef-empurrao-on')?.checked) {
    efeito.tipo             = 'empurrao';
    efeito.empurrao_direcao  = document.getElementById('sef-empurrao-dir')?.value || 'longe';
    efeito.empurrao_distancia = parseInt(document.getElementById('sef-empurrao-dist')?.value) || 3;
  }
  // Efeito colateral no próprio usuário (ex: +5 Corrupção Vegetal ao usar Raiz Contida)
  if (document.getElementById('sef-alvo-usuario')?.checked) {
    efeito.alvo = 'usuario';
  }
  // Necromante (domina o inimigo ao matar)
  if (document.getElementById('sef-necro-on')?.checked) {
    efeito.tipo          = 'necromante';
    efeito.duracao_turnos = parseInt(document.getElementById('sef-necro-turnos')?.value) || 3;
    efeito.cor_dominado  = document.getElementById('sef-necro-cor')?.value || '#8e44ad';
  }
  // Rastro Persona — células por onde o personagem anda ficam contaminadas
  if (document.getElementById('sef-rastro-persona-on')?.checked) {
    efeito.tipo           = 'rastro_persona';
    efeito.rastro_formula = document.getElementById('sef-rastro-persona-formula')?.value.trim() || '1d6';
    efeito.duracao_turnos = parseInt(document.getElementById('sef-rastro-persona-turnos')?.value) || 3;
  }
  // Rastro Anima — células por onde a animação de ataque passa ficam contaminadas
  if (document.getElementById('sef-rastro-anima-on')?.checked) {
    efeito.tipo           = 'rastro_anima';
    efeito.rastro_formula = document.getElementById('sef-rastro-anima-formula')?.value.trim() || '1d6';
    efeito.duracao_turnos = parseInt(document.getElementById('sef-rastro-anima-turnos')?.value) || 3;
  }
  SK_EFEITOS_TEMP.push(efeito);
  skRenderEfeitosLista();
  document.getElementById('sk-efeito-form').style.display = 'none';
}

function skRemoverEfeito(idx) {
  SK_EFEITOS_TEMP.splice(idx, 1);
  skRenderEfeitosLista();
}

function skRenderEfeitosLista() {
  const el = document.getElementById('sk-efeitos-lista');
  if (!el) return;
  el.innerHTML = SK_EFEITOS_TEMP.map((ef, i) => {
    const tags = [];
    // Identificador de self-efeito
    if (ef.alvo === 'usuario') tags.push({ txt: '👤 Usuário', cor: '#7ec8f0' });
    // Negativos
    if (ef.tipo === 'stun')    tags.push({ txt: `🌀 Stun ${ef.duracao_turnos ?? 1}t`,               cor: '#b07ef0' });
    if (ef.dot_formula)       tags.push({ txt: `🩸 DOT ${ef.dot_formula}×${ef.dot_turnos}t`,      cor: '#e8604c' });
    if (ef.sem_movimento)     tags.push({ txt: `🚫 Mov. ${ef.sem_movimento_turnos}t`,               cor: '#e8604c' });
    if (ef.sem_ataque)        tags.push({ txt: `⚔🚫 Atk(${ef.sem_ataque_tipo}) ${ef.sem_ataque_turnos}t`, cor: '#e8604c' });
    if (ef.mod_dano != null && ef.mod_dano !== undefined && ef.mod_dano !== 0) {
      const ehProtecao = ef.mod_dano < 0;
      const ehVulnerabilidade = ef.mod_dano > 0;
      const corModDano = ehProtecao ? '#5ee09a' : '#e8604c';
      const labelModDano = ehProtecao ? `🛡 Resist. ${ef.mod_dano}×${ef.mod_dano_turnos}t` : `☠ Vuln. +${ef.mod_dano}×${ef.mod_dano_turnos}t`;
      tags.push({ txt: labelModDano, cor: corModDano });
    }
    // Positivos
    if (ef.hot_formula)       tags.push({ txt: `💚 HOT ${ef.hot_formula}×${ef.hot_turnos}t`,       cor: '#5ee09a' });
    if (ef.boost_dano)        tags.push({ txt: `⚡ Dano +${ef.boost_dano}×${ef.boost_dano_turnos}t`,cor: '#f0cc6a' });
    if (ef.rec_atributo)      tags.push({ txt: `🔷 ${ef.rec_atributo} ${ef.rec_formula}${ef.rec_modo==='turno'?'×'+ef.rec_turnos+'t':' (imediato)'}`, cor: '#b07ef0' });
    if (ef.imune_dano)        tags.push({ txt: `🛡 Imune ${ef.imune_dano_turnos}t`, cor: '#f0cc6a' });
    if (ef.tipo === 'necromante') tags.push({ txt: `☠ Necromante ${ef.duracao_turnos}t`, cor: ef.cor_dominado || '#8e44ad' });
    if (ef.tipo === 'rastro_persona') tags.push({ txt: `🐾 Rastro Persona ${ef.rastro_formula}×${ef.duracao_turnos}t`, cor: '#5ee09a' });
    if (ef.tipo === 'rastro_anima')   tags.push({ txt: `✨ Rastro Anima ${ef.rastro_formula}×${ef.duracao_turnos}t`, cor: '#5ee09a' });
    if (ef.tipo === 'mover_usuario') {
      const destLbl = { escolha_livre:'clique no mapa', adjacente_alvo:'adj. ao alvo', trocar_com_alvo:'troca c/ alvo' }[ef.mover_destino] || ef.mover_destino;
      tags.push({ txt: `🌀 Move usuário: ${destLbl}${ef.mover_destino === 'escolha_livre' ? ' ('+ef.mover_distancia+'cel)' : ''}`, cor: '#7ec8f0' });
    }
    if (ef.tipo === 'empurrao') {
      const dirLbl = ef.empurrao_direcao === 'perto' ? 'Puxão' : 'Empurrão';
      tags.push({ txt: `💨 ${dirLbl} ${ef.empurrao_distancia} células`, cor: '#f0a84b' });
    }
    if (ef.efeito_atrasado) {
      const tipoLbl = { dano_aoe:'💥 Dano AoE', cura_aoe:'💚 Cura AoE', buff_aoe:'✨ Buff AoE', movimento:'🏃 Mov', atributo:'⬆ Attr' }[ef.tipo_efeito_atrasado||'dano_aoe'] || '💥 Explosão';
      const descLbl = ef.formula_dano || ef.formula_cura || (ef.efeito_bonus_atrasado?.nome) || (ef.movimento_atrasado ? `+${ef.movimento_atrasado}cel` : '') || (ef.atributo_atrasado?.attr) || '?';
      tags.push({ txt: `${tipoLbl} em ${ef.delay_turnos}t (${descLbl} r${ef.alcance_celulas})`, cor: '#b07ef0' });
    }
    const ehBuff = !!(ef.hot_formula || ef.boost_dano || ef.rec_atributo || ef.imune_dano || ef.efeito_atrasado
      || ef.tipo === 'cura_imediata' || ef.tipo === 'buff');
    const corBorda = ehBuff ? 'rgba(94,224,154,0.25)' : 'rgba(232,96,76,0.2)';
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;background:rgba(10,15,25,0.5);border:1px solid ${corBorda};border-radius:6px;padding:7px 10px">
      <div>
        <span style="font-family:var(--fonte-d);font-size:0.78rem;color:${ehBuff?'#5ee09a':'#e87060'}">${ef.nome}</span>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${tags.map(t=>`<span style="font-size:0.64rem;background:${t.cor}18;border:1px solid ${t.cor}33;border-radius:4px;padding:1px 5px;color:${t.cor}">${t.txt}</span>`).join('')}
        </div>
      </div>
      <button onclick="skRemoverEfeito(${i})" style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.9rem;padding:0 0 0 8px;flex-shrink:0">✕</button>
    </div>`;
  }).join('') || '<div style="font-size:0.78rem;color:var(--suave);font-style:italic">Nenhum efeito bônus</div>';
}

// ── Distância entre personagens no mapa atual ─────────────────
function atkDistanciaCelulas(nomeA, nomeB, contexto) {
  // 1.2 — distância em células (Chebyshev: diagonal = 1 célula)
  const ctx = contexto || COMBATE?.contexto || 'campanha';
  const chars = ctx === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const charA = chars.find(c => c.nome === nomeA);
  const charB = chars.find(c => c.nome === nomeB);
  if (!charA || !charB) return null;
  
  const mapId = ctx === 'arena'
    ? (AR?.session?.mapa_id || null)
    : (MAPA_STATE?.mapaAtualId || null);
  if (!mapId) return null;
  
  const posA = getPosicaoNoMapa(charA, mapId);
  const posB = getPosicaoNoMapa(charB, mapId);
  if (!posA || !posB) return null;
  
  // ✅ CORREÇÃO: Obter dimensões do grid para converter % → células
  const mapa = ctx === 'arena' 
    ? (AR?.session?.mapa || null)
    : _getMapaById(mapId);
  
  const larguraGrid = mapa?.largura_total || 20;
  const alturaGrid  = mapa?.altura_total  || 20;
  
  // Se posA/posB já têm col/row, usar diretamente
  // Senão, converter x/y (%) para células
  let colA, rowA, colB, rowB;
  
  if (posA.col != null && posA.row != null) {
    colA = posA.col;
    rowA = posA.row;
  } else {
    // Converter % para células
    colA = Math.floor((posA.x || 0) / 100 * larguraGrid);
    rowA = Math.floor((posA.y || 0) / 100 * alturaGrid);
  }
  
  if (posB.col != null && posB.row != null) {
    colB = posB.col;
    rowB = posB.row;
  } else {
    // Converter % para células
    colB = Math.floor((posB.x || 0) / 100 * larguraGrid);
    rowB = Math.floor((posB.y || 0) / 100 * alturaGrid);
  }
  
  // ✅ Agora sim: distância em células (Chebyshev)
  const dx = Math.abs(colB - colA);
  const dy = Math.abs(rowB - rowA);
  return Math.max(dx, dy); // Chebyshev — diagonal conta como 1
}

// ── Verifica se atacante está bloqueado de atacar ─────────────
function atkVerificarBloqueioAtaque(nomeAtacante, tipoDanoHabilidade) {
  const chars = COMBATE.contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const c = chars.find(x => x.nome === nomeAtacante);
  if (!c) return null;
  const buffs = c.buffs || [];
  for (const b of buffs) {
    if (!b.sem_ataque || (b.sem_ataque_turnos_restantes ?? 0) <= 0) continue;
    const tipo = b.sem_ataque_tipo || 'todos';
    if (tipo === 'todos') return `${nomeAtacante} está impedido de atacar (${b.nome})`;
    // Classifica a habilidade: físico ou mágico
    const ehFisico = ['fisico','outro'].includes(tipoDanoHabilidade);
    const ehMagico = ['magico','fogo','gelo','veneno','psiquico','cura'].includes(tipoDanoHabilidade);
    if (tipo === 'fisico' && ehFisico) return `${nomeAtacante} está impedido de ataques físicos (${b.nome})`;
    if (tipo === 'magico' && ehMagico) return `${nomeAtacante} está impedido de ataques mágicos (${b.nome})`;
  }
  return null;
}

// ── 18E: Fluxo de combate ────────────────────────────────────
function atkIrParaStep(n) {
  COMBATE.step = n;
  ['atk-step-1','atk-step-2','atk-step-3','atk-step-pendente'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const stepId = n === 'pendente' ? 'atk-step-pendente' : `atk-step-${n}`;
  const el = document.getElementById(stepId);
  if (el) el.style.display = 'block';
}

function atkVoltarStep(n) {
  if (n === 1) {
    mapaHideRangeCircle();
    if (_AOE_STATE) mapaHideAoECircle();
  }
  atkIrParaStep(n);
}

// Jogador clica "Ir para o mapa" após rolar com animação pendente
function atkIrParaMapa() {
  fecharModalAtaque(); // fecharModalAtaque detecta _pendingTrigger e mostra o card flutuante
}

function atkSelecionarHabilidade(idx) {
  const h = COMBATE._habilidades[idx];
  COMBATE.habilidadeSel = h;
  const alvoTipo = h.alvo_tipo || 'inimigo';

  // Mostrar círculo de alcance no mapa (campanha)
  if (h.alcance_celulas != null && COMBATE.contexto === 'campanha') {
    mapaShowRangeCircle(COMBATE.atacanteNome, h.alcance_celulas);
  } else {
    mapaHideRangeCircle();
  }

  // Skill que afeta apenas o próprio: aplica imediatamente
  if (alvoTipo === 'proprio') {
    COMBATE.alvoNome = COMBATE.atacanteNome;
    // ✅ Verificar custo antes de aplicar
    if (!h.criativo && h.custo_rsv) {
      const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, COMBATE.contexto);
      if (!check.ok) {
        mostrarToast(`❌ Sem ${check.atributo} suficiente! (precisa ${check.custo}, tem ${check.atual})`, 'erro');
        return;
      }
    }
    atkMontarSelecaoAlvo(); // preenche resumo
    atkAplicarSkillSuporte([COMBATE.atacanteNome]);
    return;
  }
  // Skill AoE aliados: aplica a todos sem perguntar
  if (alvoTipo === 'todos_aliados') {
    // ✅ Verificar custo antes de aplicar
    if (!h.criativo && h.custo_rsv) {
      const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, COMBATE.contexto);
      if (!check.ok) {
        mostrarToast(`❌ Sem ${check.atributo} suficiente! (precisa ${check.custo}, tem ${check.atual})`, 'erro');
        return;
      }
    }
    atkMontarSelecaoAlvo();
    const aliados = atkListarAlvos().filter(a => !a.foraAlcance).map(a => a.nome);
    aliados.push(COMBATE.atacanteNome); // inclui o próprio
    atkAplicarSkillSuporte(aliados);
    return;
  }
  // Skill AoE inimigos: vai para step 2 (lista tudo, aplica a todos)
  if (alvoTipo === 'todos_inimigos' || alvoTipo === 'aoe') {
    atkMontarSelecaoAlvo();
    atkIrParaStep(2);
    return;
  }
  // Skill de área livre: mostra círculo arrastável no mapa
  if (alvoTipo === 'area') {
    atkMontarSelecaoAlvo();
    atkIniciarModoArea(h);
    return;
  }
  // aliado ou inimigo: vai para step 2 de seleção normal
  atkMontarSelecaoAlvo();
  atkIrParaStep(2);
}

// Aplica buff/suporte imediatamente a uma lista de alvos (sem dano)
async function atkAplicarSkillSuporte(alvos) {
  const h = COMBATE.habilidadeSel;
  const { atacanteNome, contexto } = COMBATE;

  // ── Habilidade de cura COM fórmula → passa pelo trigger card (permite crítico) ─
  if (h.formula_dano && h.tipo_dano === 'cura') {
    COMBATE.alvoNome  = alvos[0];
    COMBATE._alvosAoE = alvos.length > 1 ? alvos : null;
    atkPrepararStep3();
    atkIrParaStep(3);
    return;
  }

  const efeitos = Array.isArray(h.efeitos_bonus) ? h.efeitos_bonus : [];

  // Descontar custo de recurso
  if (h.custo_rsv) await descontarCustoSkill(atacanteNome, h.custo_rsv, contexto);

  // ── Invocação ─────────────────────────────────────────────────
  if (_skEhInvocacao(h)) {
    await _atkInvocarPersonagem(h, atacanteNome, contexto, null);
    // Cooldown
    const _cdKeyInv = h.id || h.habilidade || h.nome;
    if (_cdKeyInv && (h.cooldown_turnos || 0) > 0) {
      if (contexto === 'arena') {
        if (!AR.estado.cooldowns) AR.estado.cooldowns = {};
        AR.estado.cooldowns[_cdKeyInv] = h.cooldown_turnos;
      } else if (contexto === 'campanha' && BATALHA_ATUAL_ID) {
        const _bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
        if (_bs) {
          if (!_bs.cooldowns) _bs.cooldowns = {};
          _bs.cooldowns[_cdKeyInv] = h.cooldown_turnos;
          salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
        }
      }
    }
    const logMsgInv = `✨ ${atacanteNome} usou "${h.nome}"`;
    if (contexto === 'arena') {
      arAddLog(logMsgInv); await arSalvarEstado();
      renderArenaPersonagens(); renderArenaEntidades(); renderArenaEfeitos();
    } else { mostrarToast(logMsgInv, ''); }
    fecharModalAtaque();
    if (contexto === 'campanha') await _finalizarAtaqueCampanha();
    // Mostrar modal de crítico para o mestre ajustar invocação (HP dobrado, colapso, etc.)
    const ehMestreInv = (contexto === 'arena' ? AR?.myRole : RPG_DATA?.myRole) === 'mestre';
    if (ehMestreInv && (h.critico_positivo || h.critico_negativo)) {
      const nomeInv = h.invocar_nome || (Array.isArray(h.efeitos_bonus)?h.efeitos_bonus:[]).find(e=>e.tipo==='invocacao')?.invocar_nome;
      const alvosInv = nomeInv ? [nomeInv] : [atacanteNome];
      setTimeout(() => {
        if (h.critico_positivo) abrirModalCriticoMestre(alvosInv, true,  `[Invocação] ${h.critico_positivo}`, contexto);
        else                    abrirModalCriticoMestre(alvosInv, false, `[Invocação] ${h.critico_negativo}`, contexto);
      }, 400);
    }
    return;
  }

  // Efeitos bônus — respeita alvo:usuario para efeitos colaterais no próprio usuário
  const _ehAlvoAliadoB = ['aliado','todos_aliados','area'].includes(h.alvo_tipo);
  for (const ef of efeitos) {
    if (ef.alvo === 'usuario') {
      // Self-efeito explícito
      await atkAplicarEfeito(atacanteNome, ef, contexto);
    } else {
      const ehPositivoB = !!(ef.hot_formula || ef.boost_dano || ef.rec_atributo
        || ef.tipo === 'cura_imediata' || ef.tipo === 'buff');
      if (ehPositivoB && !_ehAlvoAliadoB) {
        // Self-buff (próprio): apenas no atacante
        await atkAplicarEfeito(atacanteNome, ef, contexto);
      } else {
        // Buff de aliado/área ou debuff: aplica em CADA alvo
        for (const nomeAlvo of alvos) {
          await atkAplicarEfeito(nomeAlvo, ef, contexto);
        }
      }
    }
  }

  // Cooldown — usa h.id quando disponível, senão h.habilidade/h.nome como chave
  const _cdKey = h.id || h.habilidade || h.nome;
  if (_cdKey && (h.cooldown_turnos || 0) > 0) {
    if (contexto === 'arena') {
      if (!AR.estado.cooldowns) AR.estado.cooldowns = {};
      AR.estado.cooldowns[_cdKey] = h.cooldown_turnos;
    } else if (contexto === 'campanha' && BATALHA_ATUAL_ID) {
      const _bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
      if (_bs) {
        if (!_bs.cooldowns) _bs.cooldowns = {};
        _bs.cooldowns[_cdKey] = h.cooldown_turnos;
        salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
      }
    }
  }

  const logMsg = `✨ ${atacanteNome} usou "${h.nome}" em ${alvos.join(', ')}`;
  if (contexto === 'arena') {
    arAddLog(logMsg); await arSalvarEstado();
    renderArenaPersonagens(); renderArenaEntidades(); renderArenaEfeitos();
  } else {
    mostrarToast(logMsg, '');
  }
  fecharModalAtaque();
  mostrarToast(`"${h.nome}" aplicado em ${alvos.join(', ')}!`, 'sucesso');
  if (contexto === 'campanha') await _finalizarAtaqueCampanha();

  // ── Efeito crítico para buff sem fórmula (baseado em critico_positivo) ─
  const ehMestre = (contexto === 'arena' ? AR?.myRole : RPG_DATA?.myRole) === 'mestre';
  if (ehMestre && h.critico_positivo) {
    setTimeout(() => abrirModalCriticoMestre(alvos, true, h.critico_positivo, contexto), 300);
  }
}

async function atkAplicarCura(nomeAlvo, cura, contexto) {
  if (!cura) return;
  if (contexto === 'arena') {
    const c = AR.chars.find(x => x.nome === nomeAlvo);
    if (!c) return;
    const hpMax = c.custom_attrs?.hp_max ?? 100;
    c.hp_atual = Math.min(hpMax, (c.hp_atual ?? hpMax) + cura);
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ hp_atual: c.hp_atual }) });
  } else {
    const c = RPG_DATA?.characters.find(x => x.nome === nomeAlvo);
    if (!c) return;
    const hpMax = c.custom_attrs?.hp_max ?? 100;
    c.hp_atual = Math.min(hpMax, (c.hp_atual ?? hpMax) + cura);
    await saveCharacterStats(RPG_DATA.rpgId, nomeAlvo, { hp_atual: c.hp_atual });
  }
}

async function atkAplicarRecuperacaoAtributo(nomeAlvo, atributo, quantidade, contexto) {
  if (!atributo || !quantidade) return;
  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const c = chars.find(x => x.nome === nomeAlvo);
  if (!c || !c.custom_attrs) return;
  if (!c.custom_attrs.atributos) c.custom_attrs.atributos = {};
  const atual = parseFloat(c.custom_attrs.atributos[atributo]) || 0;
  const novoValor = quantidade < 0
    ? Math.max(0, atual + quantidade)  // clamp no zero para débitos
    : atual + quantidade;
  // Toast de aviso quando recurso zera
  if (novoValor === 0 && quantidade < 0 && atual > 0) {
    mostrarToast(`⚠ ${atributo} de ${nomeAlvo} chegou a zero!`, 'aviso');
  }
  c.custom_attrs.atributos[atributo] = novoValor;
  if (contexto === 'arena') {
    await arSb(`characters?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
  } else {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nomeAlvo)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
  }
}

// ── SISTEMA DE CUSTO DE RECURSO (Mana, Stamina, Ki, etc.) ────
function parsearCustoRSV(custo_rsv) {
  if (!custo_rsv) return null;
  const s = custo_rsv.trim();
  if (!s || /^passiv/i.test(s)) return null;
  const match = s.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return null;
  return { quantidade: parseFloat(match[1]), atributo: match[2].trim() };
}

function verificarCustoSkill(atacanteNome, custo_rsv, contexto) {
  const parsed = parsearCustoRSV(custo_rsv);
  if (!parsed) return { ok: true };
  const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const c = chars.find(x => x.nome === atacanteNome);
  const atual = parseFloat(c?.custom_attrs?.atributos?.[parsed.atributo]) || 0;
  if (atual < parsed.quantidade) {
    return { ok: false, atributo: parsed.atributo, custo: parsed.quantidade, atual };
  }
  return { ok: true, atributo: parsed.atributo, quantidade: parsed.quantidade };
}

async function descontarCustoSkill(atacanteNome, custo_rsv, contexto) {
  const parsed = parsearCustoRSV(custo_rsv);
  if (!parsed) return;
  await atkAplicarRecuperacaoAtributo(atacanteNome, parsed.atributo, -parsed.quantidade, contexto);
  mostrarToast(`−${parsed.quantidade} ${parsed.atributo}`, '');
}

// ═══════════════════════════════════════════════════════════════
// 🎨 FUNÇÕES DE SELEÇÃO DE TIPO DE AÇÃO CRIATIVA
// ═══════════════════════════════════════════════════════════════

function criativoSetTipo(tipo) {
  CRIATIVO_TIPO = tipo;
  
  // Atualizar botões visuais
  const btnAtaque = document.getElementById('criativo-tipo-ataque');
  const btnSuporte = document.getElementById('criativo-tipo-suporte');
  const btnNarrativo = document.getElementById('criativo-tipo-narrativo');
  
  // Reset todos
  [btnAtaque, btnSuporte, btnNarrativo].forEach(btn => {
    if (btn) {
      btn.style.borderWidth = '1px';
      btn.style.boxShadow = 'none';
    }
  });
  
  // Destacar selecionado
  const btnMap = { ataque: btnAtaque, suporte: btnSuporte, narrativo: btnNarrativo };
  const btn = btnMap[tipo];
  if (btn) {
    btn.style.borderWidth = '2px';
    btn.style.boxShadow = '0 0 12px ' + (tipo === 'ataque' ? 'rgba(232,80,60,0.4)' : tipo === 'suporte' ? 'rgba(94,224,154,0.3)' : 'rgba(126,200,240,0.3)');
  }
  
  // Mostrar/ocultar seleção de alvo
  const alvoWrap = document.getElementById('criativo-alvo-wrap');
  if (alvoWrap) {
    alvoWrap.style.display = tipo === 'narrativo' ? 'none' : 'block';
  }
  
  // Respeita a escolha atual do jogador — não força alvo
  criativoSetAlvo(CRIATIVO_ALVO_TIPO);
}

function criativoSetAlvo(tipoAlvo) {
  CRIATIVO_ALVO_TIPO = tipoAlvo;
  
  // Atualizar botões visuais
  const btnUnico = document.getElementById('criativo-alvo-unico');
  const btnArea = document.getElementById('criativo-alvo-area');
  const btnProprio = document.getElementById('criativo-alvo-proprio');
  
  // Reset todos
  [btnUnico, btnArea, btnProprio].forEach(btn => {
    if (btn) {
      btn.style.borderColor = 'rgba(60,30,30,0.6)';
      btn.style.background = 'rgba(20,12,12,0.8)';
      btn.style.color = '#c8d8e8';
    }
  });
  
  // Destacar selecionado
  const btnMap = { unico: btnUnico, area: btnArea, proprio: btnProprio };
  const btn = btnMap[tipoAlvo];
  if (btn) {
    const cor = CRIATIVO_TIPO === 'ataque' ? 'rgba(232,80,60,0.5)' : 'rgba(94,224,154,0.5)';
    btn.style.borderColor = cor;
    btn.style.background = CRIATIVO_TIPO === 'ataque' ? 'rgba(232,80,60,0.12)' : 'rgba(94,224,154,0.1)';
    btn.style.color = CRIATIVO_TIPO === 'ataque' ? '#e8604c' : '#5ee09a';
  }
}

function atkSelecionarCriativo() {
  const desc = document.getElementById('atk-criativo-desc').value.trim();
  if (!desc) { mostrarToast('Descreva a ação criativa', 'erro'); return; }
  
  // Montar habilidade com informações completas
  COMBATE.habilidadeSel = { 
    criativo: true, 
    descricao: desc, 
    nome: 'Ação Criativa',
    criativo_tipo: CRIATIVO_TIPO, // 'ataque', 'suporte', 'narrativo'
    criativo_alvo_tipo: CRIATIVO_ALVO_TIPO, // 'unico', 'area', 'proprio'
    formula_dano: null, 
    cooldown_turnos: 0,
    // Definir alvo_tipo baseado nas escolhas
    alvo_tipo: CRIATIVO_TIPO === 'suporte' ? (CRIATIVO_ALVO_TIPO === 'proprio' ? 'proprio' : 'aliado') : 'inimigo'
  };
  
  // Se for narrativo, próprio, OU área → pular seleção de alvo
  if (CRIATIVO_TIPO === 'narrativo' || CRIATIVO_ALVO_TIPO === 'proprio' || CRIATIVO_ALVO_TIPO === 'area') {
    COMBATE.alvoNome = CRIATIVO_ALVO_TIPO === 'proprio' ? COMBATE.atacanteNome : null;
    // Mestre: não mostrar step "Aguardando Mestre" — vai direto para aprovação
    const _ehMestreLocal = (COMBATE.contexto === 'campanha' && RPG_DATA?.myRole === 'mestre')
                        || (COMBATE.contexto === 'arena'    && AR?.myRole       === 'mestre');
    if (!_ehMestreLocal) {
      // Jogador: mostrar step pendente imediatamente, aguardar aprovação
      atkIrParaStep('pendente');
    }
    _criativoEnviarParaMestre();
  } else {
    // Continuar para seleção de alvo
    atkMontarSelecaoAlvo();
    atkIrParaStep(2);
  }
}

// Helper para enviar criativo para o mestre
// Usado para tipos narrativo / área / próprio (sem seleção de alvo individual)
async function _criativoEnviarParaMestre() {
  const { atacanteNome, alvoNome, habilidadeSel: h, contexto } = COMBATE;
  const id = 'ac_' + Date.now();
  const pendente = {
    id,
    atacante: atacanteNome,
    alvo: alvoNome || '—',
    descricao: h.descricao,
    criativo_tipo: h.criativo_tipo || 'ataque',
    criativo_alvo_tipo: h.criativo_alvo_tipo || 'unico',
    turno: contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
    status: 'pendente',
  };

  const ehMestre = (contexto === 'campanha' && RPG_DATA?.myRole === 'mestre')
                || (contexto === 'arena'    && AR?.myRole       === 'mestre');

  if (contexto === 'arena') {
    CRIATIVOS_CAMP.push(pendente);
    CRIATIVO_ID_ATUAL = id;
    try {
      await arSb('criativos', { method: 'POST', body: JSON.stringify({
        rpg_id:            AR.session.rpg_id,
        id:                pendente.id,
        atacante:          pendente.atacante,
        alvo:              pendente.alvo,
        descricao:         pendente.descricao,
        criativo_tipo:     pendente.criativo_tipo,
        criativo_alvo_tipo:pendente.criativo_alvo_tipo,
        turno:             pendente.turno || 0,
        status:            'pendente',
      })});
    } catch(e) {}
    if (ehMestre) {
      fecharModalAtaque();
      mostrarToast('Defina a fórmula da ação criativa', '');
      abrirModalCriativoMestre(id);
      return;
    }
    // Jogador — mostrar step pendente e iniciar polling de fallback
    const divAguardando = document.getElementById('atk-pendente-aguardando');
    const divAprovado   = document.getElementById('atk-pendente-aprovado');
    const divRejeitado  = document.getElementById('atk-pendente-rejeitado');
    if (divAguardando) divAguardando.style.display = '';
    if (divAprovado)   divAprovado.style.display   = 'none';
    if (divRejeitado)  divRejeitado.style.display  = 'none';
    criativoIniciarPolling(id);
    return; // step 'pendente' já foi ativado em atkSelecionarCriativo
  }

  // Campanha
  CRIATIVOS_CAMP.push(pendente);
  CRIATIVO_ID_ATUAL = id;
  try {
    await sb('criativos', {
      method: 'POST',
      body: JSON.stringify({
        rpg_id:            RPG_DATA.rpgId,
        id:                pendente.id,
        atacante:          pendente.atacante,
        alvo:              pendente.alvo,
        descricao:         pendente.descricao,
        criativo_tipo:     pendente.criativo_tipo,
        criativo_alvo_tipo:pendente.criativo_alvo_tipo,
        turno:             pendente.turno || 0,
        status:            'pendente',
      })
    });
  } catch(e) {
    // Remover do array local para não ficar como card "fantasma"
    const _idx = CRIATIVOS_CAMP.findIndex(x => x.id === id);
    if (_idx >= 0) CRIATIVOS_CAMP.splice(_idx, 1);
    mostrarToast('Erro ao enviar ação. Tente novamente.', 'erro');
    return;
  }

  criativoRenderMestre();

  if (ehMestre) {
    // Mestre jogando como personagem: abrir modal de aprovação diretamente
    fecharModalAtaque();
    mostrarToast('Defina a fórmula da ação criativa', '');
    abrirModalCriativoMestre(id);
    return;
  }

  // Jogador: permanecer no step pendente (já ativado em atkSelecionarCriativo)
  // Garantir sub-estado correto dentro do step pendente
  const divAguardando = document.getElementById('atk-pendente-aguardando');
  const divAprovado   = document.getElementById('atk-pendente-aprovado');
  const divRejeitado  = document.getElementById('atk-pendente-rejeitado');
  if (divAguardando) divAguardando.style.display = '';
  if (divAprovado)   divAprovado.style.display   = 'none';
  if (divRejeitado)  divRejeitado.style.display  = 'none';
  // Iniciar polling de fallback caso o realtime não dispare
  criativoIniciarPolling(id);
  mostrarToast('✓ Ação enviada ao Mestre', 'ok');
}

function atkMontarSelecaoAlvo() {
  const h = COMBATE.habilidadeSel;
  const alvoTipo = h.alvo_tipo || 'inimigo';
  const ehBuff = alvoTipo === 'aliado' || alvoTipo === 'proprio' || alvoTipo === 'todos_aliados';
  const corAcao = ehBuff ? '#5ee09a' : '#e8604c';
  const labelAcao = ehBuff ? '✨ Suporte / Buff' : '⚔ Ataque';
  document.getElementById('atk-habilidade-resumo').innerHTML = `
    <strong style="color:${corAcao}">${h.nome}</strong>
    <span style="font-size:0.7rem;color:${corAcao};margin-left:6px;background:${corAcao}15;border:1px solid ${corAcao}33;border-radius:4px;padding:1px 6px">${labelAcao}</span><br>
    ${h.formula_dano ? `<span style="color:#f0cc6a">🎲 ${h.formula_dano}</span> · ` : ''}
    ${h.alcance_celulas != null ? `<span style="color:#7ec8f0">⟷ ${h.alcance_celulas} células</span> · ` : ''}
    <span style="color:#9a8888">${h.efeito || h.descricao || ''}</span>
  `;

  // Título do step 2
  const tituloEl = document.getElementById('atk-step2-titulo');
  if (tituloEl) tituloEl.textContent = ehBuff ? 'Selecionar Aliado' : 'Selecionar Alvo';

  const alvos = atkListarAlvos();
  COMBATE._alvos = alvos;
  document.getElementById('atk-alvos-lista').innerHTML = alvos.map((a, i) => {
    const cor = a.cor || (ehBuff ? '#5ee09a' : '#7ec8f0');
    const foraAlcance = a.foraAlcance;
    const distLabel = a.distCelulas != null ? ` · ${a.distCelulas.toFixed(1)}c` : '';
    const ffWarning = a.fogoAmigoForte ? `<span style="color:#f0cc6a;font-size:0.68rem;margin-left:4px">⚠️ FOGO AMIGO</span>` :
                      a.fogoAmigo ? `<span style="color:#f0a840;font-size:0.65rem;margin-left:4px">⚠ atingido</span>` : '';
    return `<div onclick="${foraAlcance
      ? `mostrarToast('Alvo fora do alcance (${a.distCelulas?.toFixed(1)} de ${h.alcance_celulas} células)','erro')`
      : `atkSelecionarAlvo(${i})`}"
      style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(20,12,12,0.8);border:1px solid ${a.fogoAmigoForte?'rgba(240,204,106,0.3)':cor+'22'};border-left:2px solid ${foraAlcance?'#444':cor};border-radius:8px;cursor:${foraAlcance?'default':'pointer'};opacity:${foraAlcance?'0.4':'1'};transition:all 0.15s"
      ${foraAlcance ? '' : `onmouseenter="this.style.borderColor='${cor}55'" onmouseleave="this.style.borderColor='${a.fogoAmigoForte?'rgba(240,204,106,0.3)':cor+'22'}'"`}>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.85rem;color:${foraAlcance?'#556':cor}">${a.nome}${ffWarning}</div>
        <div style="font-size:0.72rem;color:#7a6060">${a.tipo||'personagem'} · ${a.faction||''} · HP: ${a.hp}/${a.hpMax||a.hp}${distLabel}${foraAlcance ? ' · 🚫 fora do alcance' : ''}</div>
      </div>
      <span style="color:${foraAlcance?'#444':cor};font-size:0.8rem">›</span>
    </div>`;
  }).join('') || '<div style="color:#7a6060;font-style:italic;padding:10px">Sem alvos disponíveis</div>';
}

function atkListarAlvos() {
  const meuNome  = COMBATE.atacanteNome;
  const h        = COMBATE.habilidadeSel;
  const alvoTipo = h?.alvo_tipo || 'inimigo';
  const ehBuff   = alvoTipo === 'aliado' || alvoTipo === 'todos_aliados';

  const pvpAtivo = COMBATE.contexto === 'arena' || (CURRENT_RPG?.theme?.pvp_ativo === true);
  const ffAtivo  = COMBATE.contexto === 'arena' || (CURRENT_RPG?.theme?.fogo_amigo_ativo === true);

  // Helper: retorna a faction efetiva de um personagem
  const _getFaction = (c) => {
    const tipo = c.custom_attrs?.tipo_personagem || c.custom_attrs?.tipo || 'jogador';
    if (tipo === 'jogador') return 'jogador';
    return c.custom_attrs?.npc_faction || 'inimigo'; // padrão: inimigo
  };
  const atacanteChar = COMBATE.contexto === 'arena'
    ? AR.chars.find(x => x.nome === meuNome)
    : (RPG_DATA?.characters||[]).find(x => x.nome === meuNome);
  const atacanteFaction = _getFaction(atacanteChar || {});

  let lista = [];

  if (COMBATE.contexto === 'arena') {
    lista = (AR.chars || [])
      .filter(c => {
        if (c.nome === meuNome) return ehBuff;
        const faction = _getFaction(c);
        const hpOk = (c.hp_atual ?? 100) > 0;
        if (!hpOk) return false;
        if (ehBuff) {
          // Buff: aliados (mesmo jogador) ou NPCs aliados
          return faction === 'jogador' || faction === 'aliado';
        } else {
          // Ataque: inimigos; neutros e jogadores dependem de pvp/ff
          if (faction === 'inimigo') return true;
          if (faction === 'aliado') return ffAtivo; // fogo amigo
          if (faction === 'neutro') return true; // neutro é sempre atacável
          if (faction === 'jogador') return pvpAtivo || ffAtivo;
          return false;
        }
      })
      .map(c => {
        const faction = _getFaction(c);
        const ehFogoAmigo = !ehBuff && (faction === 'aliado' || faction === 'jogador');
        return {
          nome: c.nome,
          cor: ehFogoAmigo ? '#f0cc6a' : (c.custom_attrs?.cor || '#e8604c'),
          tipo: c.custom_attrs?.tipo || 'jogador',
          faction,
          fogoAmigo: ehFogoAmigo,
          hp: c.hp_atual ?? (c.custom_attrs?.hp_max??100),
          hpMax: c.custom_attrs?.hp_max??100,
        };
      });
  } else {
    const atacanteChar2 = (RPG_DATA?.characters||[]).find(x => x.nome === meuNome);
    const atacanteMapId = atacanteChar2?.active_map_id || null;
    const _bidAtk = batalhaIdMinha() || BATALHA_ATUAL_ID;
    const _bsAtk  = _bidAtk ? MAPA_STATE?.batalhas?.[_bidAtk] : null;
    const _partBatalha = _bsAtk?.participantes?.map(p => p.nome) || null;
    lista = (RPG_DATA?.characters || [])
      .filter(c => {
        if (_partBatalha && !_partBatalha.includes(c.nome)) return false;
        if (c.nome === meuNome) return ehBuff;
        if (atacanteMapId && c.active_map_id && c.active_map_id !== atacanteMapId) return false;
        const faction = _getFaction(c);
        const hpOk = (c.hp_atual ?? 0) > 0;
        if (!hpOk) return false;
        const mestreAtacando = RPG_DATA?.myRole === 'mestre';
        if (ehBuff) {
          // Buff: jogadores e NPCs aliados
          // AC-07-G3: Incluir pets cujo dono é aliado/jogador
          const _isPetAliado = (chr) => {
            if (!chr.custom_attrs?.eh_pet) return false;
            const donoNome = chr.custom_attrs?.pet_dono;
            const dono = (RPG_DATA?.characters||[]).find(x => x.nome === donoNome);
            if (!dono) return false;
            const donoFaction = _getFaction(dono);
            return donoFaction === 'jogador' || donoFaction === 'aliado';
          };
          return faction === 'jogador' || faction === 'aliado' || _isPetAliado(c);
        } else {
          if (faction === 'inimigo' || faction === 'neutro') return true;
          if (faction === 'aliado') return ffAtivo || mestreAtacando;
          if (faction === 'jogador') return pvpAtivo || ffAtivo || mestreAtacando;
          return false;
        }
      })
      .map(c => {
        const faction = _getFaction(c);
        const ehFogoAmigo = !ehBuff && (faction === 'aliado' || faction === 'jogador' || faction === 'neutro');
        // neutro recebe aviso leve, aliado/jogador recebe aviso forte
        const ehFogoAmigoForte = !ehBuff && (faction === 'aliado' || faction === 'jogador');
        return {
          nome: c.nome,
          cor: ehFogoAmigoForte ? '#f0cc6a' : (c.custom_attrs?.cor || (ehBuff ? '#5ee09a' : '#7ec8f0')),
          tipo: c.custom_attrs?.tipo_personagem || c.custom_attrs?.tipo || 'jogador',
          faction,
          fogoAmigo: ehFogoAmigo,
          fogoAmigoForte: ehFogoAmigoForte,
          hp:    c.hp_atual ?? (c.custom_attrs?.hp_max??100),
          hpMax: c.custom_attrs?.hp_max??100,
        };
      });
  }

  // Calcular distância e flag de alcance
  const alcance = h?.alcance_celulas ?? null;
  const mapaId  = MAPA_STATE?.mapaAtualId || null;
  return lista
    .map(a => {
      const dist = atkDistanciaCelulas(meuNome, a.nome);
      if (alcance != null && mapaId && COMBATE.contexto !== 'arena') {
        const charA = (RPG_DATA?.characters||[]).find(x => x.nome === meuNome);
        const charB = (RPG_DATA?.characters||[]).find(x => x.nome === a.nome);
        const semPosA = !getPosicaoNoMapa(charA, mapaId);
        const semPosB = !getPosicaoNoMapa(charB, mapaId);
        if (semPosA || semPosB) return { ...a, distCelulas: null, foraAlcance: false };
      }
      const foraAlcance = alcance != null && dist != null && dist > alcance;
      return { ...a, distCelulas: dist, foraAlcance };
    })
    .sort((a, b) => (a.foraAlcance ? 1 : 0) - (b.foraAlcance ? 1 : 0));
}

// ── Seleção de alvo → prepara step 3 ────────────────────────
async function atkSelecionarAlvo(idx) {
  const a = COMBATE._alvos[idx];
  COMBATE.alvoNome = a.nome;
  const h = COMBATE.habilidadeSel;
  document.getElementById('atk-alvo-resumo').textContent = `Alvo: ${a.nome}`;
  // ── Verificar custo de recurso ────────────────────────────
  if (!h.criativo && h.custo_rsv) {
    const check = verificarCustoSkill(COMBATE.atacanteNome, h.custo_rsv, COMBATE.contexto);
    if (!check.ok) {
      mostrarToast(`❌ Sem ${check.atributo} suficiente! (precisa ${check.custo}, tem ${check.atual})`, 'erro');
      return;
    }
  }

  if (h.criativo) { atkEnviarAtaqueCriativo(); return; }
  const alvoTipo = h.alvo_tipo || 'inimigo';
  const ehBuff = alvoTipo === 'aliado' || alvoTipo === 'proprio';
  // Skill ofensiva fora de combate → solicitar aprovação do mestre
  if (!ehBuff && COMBATE._estadoAtk === 'fora_combate' && RPG_DATA?.myRole !== 'mestre') {
    atkEnviarSolicitacaoSkill(); return;
  }
  if (ehBuff) {
    atkAplicarSkillSuporte([a.nome]);
    return;
  }
  if (alvoTipo === 'todos_inimigos' || alvoTipo === 'aoe') {
    const todos = COMBATE._alvos.filter(x => !x.foraAlcance).map(x => x.nome);
    // Fora de combate: ainda enviar para aprovação (AoE)
    if (COMBATE._estadoAtk === 'fora_combate' && RPG_DATA?.myRole !== 'mestre') {
      atkEnviarSolicitacaoSkill(); return;
    }
    atkAplicarAoEInimigos(todos);
    return;
  }
  // Disparar scanner de reações "ser_atacado" (interrupções antes de rolar)
  if (typeof _batalhaProcessarEventoReativo === 'function') {
    const reacaoRes = await _batalhaProcessarEventoReativo('ser_atacado', { atacanteNome: COMBATE.atacanteNome, alvoNome: a.nome, habilidade: h, contexto: COMBATE.contexto });
    if (reacaoRes?.cancelado) {
      mostrarToast(`🛡 Ataque cancelado por reação de ${a.nome}!`, 'sucesso');
      if ((reacaoRes.movimento_bonus ?? 0) > 0 && BATALHA_ATUAL_ID && typeof movAdicionarMovimento === 'function') {
        movAdicionarMovimento(BATALHA_ATUAL_ID, a.nome, reacaoRes.movimento_bonus);
      }
      fecharModalAtaque();
      return;
    }
  }
  atkPrepararStep3();
  atkIrParaStep(3);
}

async function atkAplicarAoEInimigos(alvos) {
  const { atacanteNome, habilidadeSel: h, contexto } = COMBATE;
  // Aguarda o jogador rolar os dados (abre step 3 com multi-alvo pendente)
  COMBATE._alvosAoE = alvos;
  atkPrepararStep3();
  atkIrParaStep(3);
}

function atkPrepararStep3() {
  const h = COMBATE.habilidadeSel;
  const { atacanteNome, contexto } = COMBATE;
  COMBATE.formulaBuilder = [];
  COMBATE.dadosRolados   = null;
  COMBATE.rolando        = false;

  const grupos = parsearFormulaDano(h.formula_dano);

  // Calcular bônus de atributo e injetar como grupo fixo
  const modAttr = calcModAtributo(h, atacanteNome, contexto);
  if (modAttr !== 0 && grupos) {
    grupos.push({ tipo: 'fixo', valor: modAttr });
  }

  // ── Calcular boost_dano e mod_dano ativos do atacante ────────────────
  const chars = contexto === 'arena' ? (AR?.chars || []) : (RPG_DATA?.characters || []);
  const atacanteChar = chars.find(x => x.nome === atacanteNome);
  let boostAtacante = 0, modDanoAtacante = 0;
  for (const b of (atacanteChar?.buffs || [])) {
    if ((b.boost_dano ?? 0) !== 0 && (b.boost_dano_turnos_restantes ?? 0) > 0) {
      boostAtacante += b.boost_dano;
    }
    if ((b.mod_dano ?? 0) !== 0 && (b.mod_dano_turnos_restantes ?? 0) > 0) {
      modDanoAtacante += b.mod_dano;
    }
  }
  if (boostAtacante !== 0 && grupos) {
    grupos.push({ tipo: 'fixo', valor: boostAtacante });
  }
  if (modDanoAtacante !== 0 && grupos) {
    grupos.push({ tipo: 'fixo', valor: modDanoAtacante });
  }

  const temFormula = grupos && grupos.length > 0;

  const secFormula   = document.getElementById('atk-sec-formula');
  const secBuilder   = document.getElementById('atk-sec-builder');
  const formulaEl    = document.getElementById('atk-formula-exibida');
  const dadosEl      = document.getElementById('atk-dados-individuais');
  const totalEl      = document.getElementById('atk-total-dano');
  const btnRolar     = document.getElementById('atk-btn-rolar');
  const btnConfirmar = document.getElementById('atk-btn-confirmar');
  const btnDelegar   = document.getElementById('atk-btn-delegar');

  dadosEl.innerHTML = '';
  totalEl.textContent = '—';
  btnConfirmar.style.display = 'none';
  // Resetar botão rolar e esconder botão ir-para-mapa
  btnRolar.disabled = false;
  btnRolar.textContent = '🎲 Rolar Dados';
  btnRolar.style.cssText = 'width:100%;padding:12px;background:linear-gradient(135deg,#9b2020,#c0392b);border:none;border-radius:8px;color:#fff;font-family:\'Cinzel\',serif;font-size:0.78rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px';
  const _btnMapa = document.getElementById('atk-btn-ir-mapa');
  if (_btnMapa) _btnMapa.style.display = 'none';

  if (temFormula) {
    secFormula.style.display = 'block';
    secBuilder.style.display = 'none';
    // Mostrar fórmula base + modificador de atributo se houver
    let formulaLabel = h.formula_dano || '';
    if (modAttr !== 0 && h.atributo_base && h.mod_atributo_pct) {
      const sinal = modAttr >= 0 ? '+' : '';
      formulaLabel += ` ${sinal}${modAttr} (${h.mod_atributo_pct}% ${h.atributo_base})`;
    }
    if (boostAtacante !== 0) {
      const sinalB = boostAtacante >= 0 ? '+' : '';
      formulaLabel += ` ${sinalB}${boostAtacante} ⚡buff`;
    }
    if (modDanoAtacante !== 0) {
      const sinalM = modDanoAtacante >= 0 ? '+' : '';
      formulaLabel += ` ${sinalM}${modDanoAtacante} ${modDanoAtacante < 0 ? '📉debuff' : '📈buff'}`;
    }
    formulaEl.textContent    = formulaLabel;
    document.getElementById('atk-formula-db-label').textContent = formulaLabel;
    // Mostrar aviso de penalidade ativa
    const _avisoEl = document.getElementById('atk-step3-debuff-aviso');
    if (_avisoEl) {
      const partes = [];
      if (modAttr < 0 && h.atributo_base) partes.push(`Atributo fraco (${h.atributo_base}): ${modAttr}`);
      if (modDanoAtacante < 0) partes.push(`Debuff de status: ${modDanoAtacante}`);
      if (partes.length) { _avisoEl.textContent = '⚠ ' + partes.join(' · '); _avisoEl.style.display = 'block'; }
      else _avisoEl.style.display = 'none';
    }
    btnRolar.style.display   = 'block';
    btnRolar.textContent     = '🎲 Rolar Dados';
    btnRolar.disabled        = false;
    btnRolar.onclick         = atkRolarDados;
    btnDelegar.style.display = 'none';
    COMBATE._gruposFormula   = grupos;
  } else {
    secFormula.style.display = 'none';
    secBuilder.style.display = 'block';
    formulaEl.textContent    = '—';
    btnRolar.style.display   = 'none';
    btnRolar.onclick         = atkRolarDados;
    btnDelegar.style.display = 'block';
    COMBATE._gruposFormula   = null;
    atkAtualizarBuilder();
  }
}

// ── Builder de dados (sem fórmula no DB) ────────────────────
function atkAdicionarDado(faces) {
  const existente = COMBATE.formulaBuilder.find(g => g.tipo === 'dado' && g.faces === faces);
  if (existente) existente.qtd++;
  else COMBATE.formulaBuilder.push({ tipo: 'dado', qtd: 1, faces });
  atkAtualizarBuilder();
}

function atkRemoverDado(faces) {
  const idx = COMBATE.formulaBuilder.findIndex(g => g.tipo === 'dado' && g.faces === faces);
  if (idx < 0) return;
  COMBATE.formulaBuilder[idx].qtd--;
  if (COMBATE.formulaBuilder[idx].qtd <= 0) COMBATE.formulaBuilder.splice(idx, 1);
  atkAtualizarBuilder();
}

function atkLimparBuilder() {
  COMBATE.formulaBuilder = [];
  atkAtualizarBuilder();
}

function atkAtualizarBuilder() {
  const formula = formulaDeGrupos(COMBATE.formulaBuilder);
  document.getElementById('atk-formula-exibida').textContent = formula;
  const btnRolar = document.getElementById('atk-btn-rolar');
  const temDados = COMBATE.formulaBuilder.length > 0;
  btnRolar.style.display = temDados ? 'block' : 'none';
  btnRolar.textContent   = '🎲 Rolar Dados';
  // Chips dos dados selecionados
  const chipsEl = document.getElementById('atk-builder-chips');
  if (chipsEl) {
    chipsEl.innerHTML = COMBATE.formulaBuilder.map(g => {
      if (g.tipo !== 'dado') return '';
      return `<div style="display:flex;align-items:center;gap:4px;background:rgba(232,80,60,0.12);border:1px solid rgba(232,80,60,0.3);border-radius:20px;padding:3px 10px 3px 6px">
        <span style="font-family:'Cinzel',serif;font-size:0.85rem;color:#e8604c">${g.qtd}d${g.faces}</span>
        <button onclick="atkRemoverDado(${g.faces})" style="background:none;border:none;color:#e8604c88;cursor:pointer;font-size:1rem;padding:0 0 0 3px;line-height:1">−</button>
      </div>`;
    }).join('');
  }
}

// ── Animação de rolar dados (sequencial) ────────────────────
async function atkRolarDados() {
  if (COMBATE.rolando) return;
  const grupos = COMBATE._gruposFormula || COMBATE.formulaBuilder;
  if (!grupos || !grupos.length) return;

  // ═══════════════════════════════════════════════════════════════
  // 🐛 BUG-01 FIX (FASE 2): Capturar snapshot imutável COMPLETO
  // PROBLEMA: COMBATE pode ser resetado durante awaits de animação
  // SOLUÇÃO: Capturar TODOS os valores necessários em snapshot imutável
  // ═══════════════════════════════════════════════════════════════
  const snapshot = {
    habilidade: COMBATE.habilidadeSel,
    contexto: COMBATE.contexto,
    atacante: COMBATE.atacanteNome,
    alvo: COMBATE.alvoNome,
    alvosAoE: COMBATE._alvosAoE ? [...COMBATE._alvosAoE] : null,
    role: COMBATE.contexto === 'arena' ? AR?.myRole : RPG_DATA?.myRole,
    grupos: [...grupos] // Cópia profunda dos grupos
  };

  // Validar snapshot antes de prosseguir
  if (!snapshot.habilidade) {
    mostrarToast('Erro: Habilidade não selecionada', 'erro');
    return;
  }

  COMBATE.rolando = true;
  const btnRolar     = document.getElementById('atk-btn-rolar');
  const dadosEl      = document.getElementById('atk-dados-individuais');
  const totalEl      = document.getElementById('atk-total-dano');
  const btnConfirmar = document.getElementById('atk-btn-confirmar');

  btnRolar.disabled = true;
  btnConfirmar.style.display = 'none';
  dadosEl.innerHTML = '';
  totalEl.textContent = '—';

  // Rolar dados usando snapshot (não COMBATE que pode mudar)
  const resultado = rolarGrupos(snapshot.grupos);
  let totalAcumulado = 0;

  for (const dado of resultado.dados) {
    const chip = document.createElement('div');
    chip.style.cssText = `width:44px;height:44px;border-radius:8px;background:rgba(232,80,60,0.1);border:2px solid rgba(232,80,60,0.5);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:1rem;color:#f0cc6a;flex-shrink:0`;
    chip.title = `d${dado.faces}`;
    dadosEl.appendChild(chip);

    // Animação de embaralhamento ~320ms
    await new Promise(resolve => {
      let elapsed = 0;
      const iv = setInterval(() => {
        chip.textContent = Math.floor(Math.random() * dado.faces) + 1;
        elapsed += 60;
        if (elapsed >= 320) {
          clearInterval(iv);
          chip.textContent    = dado.valor;
          const isCrit        = dado.valor === dado.faces;
          chip.style.borderColor = isCrit ? '#f0cc6a' : 'rgba(232,80,60,0.4)';
          chip.style.background  = isCrit ? 'rgba(240,204,106,0.15)' : 'rgba(232,80,60,0.08)';
          chip.style.color       = isCrit ? '#f0cc6a' : '#e8604c';
          resolve();
        }
      }, 60);
    });

    totalAcumulado += dado.valor;
    totalEl.textContent = totalAcumulado;
    await new Promise(r => setTimeout(r, 100));
  }

  if (resultado.bonus !== 0) {
    const bonusChip = document.createElement('div');
    const isPos = resultado.bonus > 0;
    bonusChip.style.cssText = `width:44px;height:44px;border-radius:8px;background:${isPos ? 'rgba(52,152,219,0.12)' : 'rgba(192,57,43,0.12)'};border:2px solid ${isPos ? 'rgba(52,152,219,0.5)' : 'rgba(192,57,43,0.5)'};display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:0.85rem;color:${isPos ? '#5dade2' : '#e74c3c'};flex-shrink:0`;
    bonusChip.title = 'Bônus/Modificador';
    bonusChip.textContent = (isPos ? '+' : '') + resultado.bonus;
    dadosEl.appendChild(bonusChip);
    await new Promise(r => setTimeout(r, 150));
  }
  // Always show the clamped total (Math.max(0, ...) already applied in rolarGrupos)
  totalEl.textContent = resultado.total;

  // ✅ FIX: Restaurar estado do snapshot no COMBATE
  // Mesmo que COMBATE tenha sido resetado, restauramos os valores capturados
  COMBATE.dadosRolados = resultado;
  COMBATE.habilidadeSel = snapshot.habilidade;
  COMBATE.contexto = snapshot.contexto;
  COMBATE.atacanteNome = snapshot.atacante;
  COMBATE.alvoNome = snapshot.alvo;
  COMBATE._alvosAoE = snapshot.alvosAoE;

  // Broadcast usando dados do snapshot (não do COMBATE atual que pode estar desatualizado)
  const _hNome = snapshot.habilidade?.nome || 'Ataque';
  const _criticoLabel = resultado.dados?.some(d => d.faces === 20 && d.valor === 20) ? '🎯 Crítico Perfeito!' :
                        resultado.dados?.some(d => d.faces === 20 && d.valor === 1)  ? '💀 Falha Crítica'    : null;
  combateBroadcast('dados_rolados', {
    atacante: snapshot.atacante,
    habilidade: _hNome,
    total: resultado.total,
    critico: _criticoLabel,
  });

  // ✅ REC-06: Adicionar ao log de combate
  if (_criticoLabel) {
    COMBATE_LOG.adicionar('critico', {
      mensagem: `${snapshot.atacante} - ${_criticoLabel}`
    });
  }
  
  COMBATE_LOG.adicionar('ataque', {
    atacante: snapshot.atacante,
    alvo: snapshot.alvo || 'a definir',
    habilidade: _hNome,
    dano: resultado.total
  });

  COMBATE._pendingTrigger = true;
  COMBATE.rolando = false;
  btnRolar.disabled = true;
  console.log('[ATK] atkRolarDados: dados prontos', { total: resultado.total, bonus: resultado.bonus, dados: resultado.dados?.length, pendingTrigger: COMBATE._pendingTrigger });
  // Mostrar resultado por 3s para o jogador contemplar, depois prosseguir
  btnConfirmar.textContent = '→ Continuar';
  btnConfirmar.style.display = 'block';
  const _autoTimer = setTimeout(() => {
    console.log('[ATK] atkRolarDados: auto-proceed após 3s');
    fecharModalAtaque();
  }, 3000);
  btnConfirmar.onclick = () => {
    console.log('[ATK] atkRolarDados: jogador clicou Continuar');
    clearTimeout(_autoTimer);
    fecharModalAtaque();
  };
}

// ── Delegar ao mestre ────────────────────────────────────────
async function atkDelegarAoMestre() {
  const { atacanteNome, alvoNome, habilidadeSel: h, contexto } = COMBATE;
  const formulaStr = formulaDeGrupos(COMBATE.formulaBuilder) || '(sem fórmula)';
  const pendente = {
    id: 'ap_' + Date.now(),
    atacante: atacanteNome,
    alvo:     alvoNome,
    descricao: `[Delegado] ${h.nome} — fórmula sugerida: ${formulaStr}`,
    turno:  contexto === 'arena' ? (AR.estado?.turno || 0) : 0,
    status: 'pendente',
  };
  if (contexto === 'arena') {
    CRIATIVOS_CAMP.push(pendente);
    CRIATIVO_ID_ATUAL = pendente.id;
    try {
      await arSb('criativos', {method:'POST', body:JSON.stringify({
        rpg_id:   AR.session.rpg_id,
        id:       pendente.id,
        atacante: pendente.atacante,
        alvo:     pendente.alvo,
        descricao:pendente.descricao,
        turno:    pendente.turno || 0,
        status:   'pendente',
      })});
    } catch(e) {}
    if (AR.myRole === 'mestre') {
      fecharModalAtaque();
      abrirModalCriativoMestre(pendente.id);
      return;
    }
    criativoIniciarPolling(pendente.id);
  }
  atkIrParaStep('pendente');
  mostrarToast('Dano delegado ao Mestre', '');
  combateBroadcast('aguardando_aprovacao', {
    atacante: atacanteNome,
    alvo:     alvoNome,
    habilidade: h.nome || 'Ação Criativa',
  });
}

// ── Helper: aplica dano e efeitos sem fechar o modal ────────
async function _atkAplicarDanoFinal() {
  if (COMBATE._jaAplicado) return;
  COMBATE._jaAplicado = true;

  const { atacanteNome, habilidadeSel: h, dadosRolados, contexto } = COMBATE;
  const dano = dadosRolados?.total ?? 0;
  const alvosAtaque = COMBATE._alvosAoE?.length ? COMBATE._alvosAoE : [COMBATE.alvoNome];
  COMBATE._alvosAoE = null;

  // Disparar scanner de reações "ser_atingido" (antes do dano, mas depois da confirmação)
  if (typeof _batalhaProcessarEventoReativo === 'function' && h.tipo_dano !== 'cura') {
    for (const nomeAlvo of alvosAtaque) {
      await _batalhaProcessarEventoReativo('ser_atingido', { atacanteNome, alvoNome: nomeAlvo, dano, habilidade: h, contexto });
    }
  }

  if (h.custo_rsv) await descontarCustoSkill(atacanteNome, h.custo_rsv, contexto);

  // ── Disparar gatilho: atacante usou habilidade ────────────────
  if (contexto === 'campanha' && typeof battleDispatchEvento === 'function') {
    const _alvosDispatch = COMBATE._alvosAoE?.length ? COMBATE._alvosAoE : [COMBATE.alvoNome];
    for (const _alvo of _alvosDispatch) {
      if (_alvo) battleDispatchEvento('ser_atacado', { atacante: atacanteNome, alvo: _alvo, habilidade: h.nome });
    }
  }

  // ── Aplicar dano ou cura dependendo do tipo ──────────────────
  const ehCura = h.tipo_dano === 'cura';
  // AC-03-B7: Não aplicar dano para suporte/buff puro (sem workaround 1d1)
  const ehSuportePuro = h.tipo_dano === 'suporte' || h.tipo_dano === 'buff';
  
  if (ehCura) {
    for (const nomeAlvo of alvosAtaque) await atkAplicarCura(nomeAlvo, dano, contexto);
    if (typeof AudioManager !== 'undefined') {
      const _sfxCura = h.animacao?.audio?.impact || 'heal_chime';
      AudioManager.playSFX(_sfxCura, { volume: h.animacao?.audio?.volume ?? 0.75 });
    }
  } else if (!ehSuportePuro) {
    // Só aplica dano se não for suporte puro
    for (const nomeAlvo of alvosAtaque) {
      // ── D&D 5e: rolagem de ataque d20 vs CA ──────────────────
      const _cfg = typeof getBattleConfig === 'function' ? getBattleConfig() : null;
      if (_cfg?.sistema_reacao === 'dnd5e') {
        const alvoChar = (RPG_DATA?.characters || []).find(x => x.nome === nomeAlvo);
        const atacanteChar = (RPG_DATA?.characters || []).find(x => x.nome === atacanteNome);
        if (alvoChar) {
          const atrs = alvoChar.custom_attrs?.atributos || {};
          const caKey = Object.keys(atrs).find(k => k.toLowerCase() === 'classe_armadura' || k.toLowerCase() === 'ca') || null;
          const ca = caKey ? parseFloat(atrs[caKey] ?? 0) : 0;
          if (ca > 0) {
            // Bonus de ataque do atacante
            const atrsAtk = atacanteChar?.custom_attrs?.atributos || {};
            const bonusAtkKey = Object.keys(atrsAtk).find(k => k.toLowerCase() === 'bonus_ataque' || k.toLowerCase() === 'bônus_de_ataque') || null;
            let bonusAtk = bonusAtkKey ? parseFloat(atrsAtk[bonusAtkKey] ?? 0) : 0;
            // Esquiva: desvantagem (rola d20 duas vezes, menor)
            const temEsquiva = (alvoChar.buffs || []).some(b => b.esquiva_ativa && (b.esquiva_turnos_restantes ?? 0) > 0);
            let d20a = Math.ceil(Math.random() * 20);
            let d20b = temEsquiva ? Math.ceil(Math.random() * 20) : d20a;
            const d20 = temEsquiva ? Math.min(d20a, d20b) : d20a;
            const totalAtk = d20 + bonusAtk;
            const acertou = totalAtk >= ca;
            const esquivaStr = temEsquiva ? ` (desvantagem: ${d20a},${d20b})` : '';
            mostrarToast(
              `🎲 Ataque vs CA ${ca}: d20(${d20})${bonusAtk ? `+${bonusAtk}` : ''}=${totalAtk}${esquivaStr} — ${acertou ? '✅ Acertou!' : '❌ Errou!'}`,
              acertou ? 'sucesso' : 'erro'
            );
            if (!acertou) continue;
            // Consumir turno de esquiva
            if (temEsquiva) {
              for (const b of (alvoChar.buffs || [])) {
                if (b.esquiva_ativa && (b.esquiva_turnos_restantes ?? 0) > 0) {
                  b.esquiva_turnos_restantes--;
                  if (b.esquiva_turnos_restantes <= 0) b.esquiva_ativa = false;
                }
              }
            }
          }
        }
      }
      await atkAplicarDano(nomeAlvo, dano, contexto, h.tipo_dano);
      if (typeof AudioManager !== 'undefined') {
        const _sfxImp = h.animacao?.audio?.impact
          ? h.animacao.audio
          : AudioManager.getSkillSfx(h.animacao?.tipo||'', h.animacao?.posicao||'', h.tipo_dano||'', h.animacao?.gsap_config?.preset||'');
        if (_sfxImp.impact) AudioManager.playSFX(_sfxImp.impact, { volume: h.animacao?.audio?.volume ?? 0.75, pitchVariance: 0.08 });
      }
      // Disparar scanner de habilidades reativas após dano
      if (typeof _batalhaProcessarEventoReativo === 'function') {
        await _batalhaProcessarEventoReativo('sofrer_dano', { atacanteNome, alvoNome: nomeAlvo, dano, habilidade: h, contexto });
        const cAlvo = (RPG_DATA?.characters||[]).find(x => x.nome === nomeAlvo);
        if (cAlvo && (cAlvo.hp_atual || 0) <= 0) {
          await _batalhaProcessarEventoReativo('ser_reduzido_zero', { atacanteNome, alvoNome: nomeAlvo, dano, habilidade: h, contexto });
        }
      }
    }
  }
  // Se for suporte puro, apenas os efeitos extras serão aplicados abaixo

  const efeitos = Array.isArray(h.efeitos_bonus) ? h.efeitos_bonus : (h.efeito_auto ? [h.efeito_auto] : []);
  
  // ✅ BUG-07 FIX (FASE 2): Usar sistema determinístico de targeting
  for (const ef of efeitos) {
    const { aplicarEm, alvos } = determinarAlvoEfeito(
      ef, 
      h, 
      atacanteNome, 
      alvosAtaque
    );
    
    // Aplicar efeito nos alvos corretos
    for (const nomeAlvo of alvos) {
      await atkAplicarEfeitoComRecuperacao(nomeAlvo, ef, contexto);
      
      // Adicionar ao log
      if (typeof COMBATE_LOG !== 'undefined') {
        COMBATE_LOG.adicionar('efeito', {
          alvo: nomeAlvo,
          nome: ef.nome || 'Efeito',
          ehPositivo: ef.tipo === 'buff' || ef.tipo === 'cura_imediata'
        });
      }
    }
  }

  const _cdKeyDano = h.id || h.habilidade || h.nome;
  if (_cdKeyDano && (h.cooldown_turnos || 0) > 0) {
    if (contexto === 'arena') {
      if (!AR.estado.cooldowns) AR.estado.cooldowns = {};
      AR.estado.cooldowns[_cdKeyDano] = h.cooldown_turnos;
    } else if (contexto === 'campanha' && BATALHA_ATUAL_ID) {
      const _bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
      if (_bs) {
        if (!_bs.cooldowns) _bs.cooldowns = {};
        _bs.cooldowns[_cdKeyDano] = h.cooldown_turnos;
        salvarEstadoBatalha(BATALHA_ATUAL_ID).catch(() => {});
      }
    }
  }
  const formulaUsada = h.formula_dano || formulaDeGrupos(COMBATE.formulaBuilder) || '';
  const efeitosStr = efeitos.map(e => e.nome).join(', ');
  const icone = ehCura ? '💚' : (h.tipo_dano === 'suporte' || h.tipo_dano === 'buff') ? '✨' : '⚔';
  const labelAcao = ehCura ? 'cura' : (h.tipo_dano === 'buff' || h.tipo_dano === 'suporte') ? 'buff' : 'dano';
  const logVerbo = ehCura ? 'curou' : (h.tipo_dano === 'buff' || h.tipo_dano === 'suporte') ? 'aplicou' : 'causou';
  
  // AC-03-B7: Log diferenciado para suporte puro vs dano/cura
  const logMsg = ehSuportePuro && !dano
    ? `${icone} ${atacanteNome} usou "${h.nome}" em ${alvosAtaque.join(', ')}${efeitosStr ? ` — Efeitos: ${efeitosStr}` : ''}`
    : `${icone} ${atacanteNome} usou "${h.nome}" em ${alvosAtaque.join(', ')} — ${dano} de ${labelAcao}${formulaUsada ? ` (${formulaUsada})` : ''}${efeitosStr ? ` · Efeitos: ${efeitosStr}` : ''}`;
  
  if (contexto === 'arena') {
    arAddLog(logMsg); await arSalvarEstado();
    renderArenaPersonagens(); renderArenaEntidades(); renderMesa(); renderArenaEfeitos();
  } else {
    mostrarToast(logMsg, '');
  }
  
  // AC-03-B7: Toast diferenciado para suporte puro
  const toastMsg = ehSuportePuro && !dano
    ? `Efeito aplicado em ${alvosAtaque.join(', ')}!${efeitosStr ? ` ${efeitosStr}` : ''}`
    : `${dano} de ${labelAcao} em ${alvosAtaque.join(', ')}!${efeitosStr ? ` +${efeitosStr}` : ''}`;
  mostrarToast(toastMsg, 'sucesso');
  // Broadcast: todos veem o resultado do ataque em tempo real
  combateBroadcast('ataque_executado', {
    atacante: atacanteNome,
    alvo: alvosAtaque.join(', '),
    dano,
    habilidade: h.nome || '',
    efeitos: efeitosStr || null,
  });

  // ── Modal de efeito crítico (apenas mestre) ──────────────────
  const ehCritico = COMBATE._ehCritico;
  const criticoTexto = COMBATE._criticoTexto;
  const criticoEhPositivo = COMBATE._criticoEhPositivo;
  COMBATE._ehCritico = false;
  COMBATE._criticoTexto = null;
  COMBATE._criticoEhPositivo = false;

  if (contexto === 'campanha') await _finalizarAtaqueCampanha();

  if (CRIATIVO_ID_ATUAL) {
    const idCriativo = CRIATIVO_ID_ATUAL;
    const c = CRIATIVOS_CAMP.find(x => x.id === idCriativo);
    if (c) {
      // AC-ESTADO: Transicionar para 'concluido' em vez de deletar imediatamente
      c.status = 'concluido';
      try {
        const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
        if (rpgId) {
          const sbFn = AR.session ? arSb : sb;
          await sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(idCriativo)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ status: 'concluido' })
          });
        }
      } catch(e) { console.warn('Erro ao marcar criativo como concluido:', e); }
      
      // Limpar após 30 segundos
      setTimeout(() => {
        const idx = CRIATIVOS_CAMP.findIndex(x => x.id === idCriativo);
        if (idx >= 0) CRIATIVOS_CAMP.splice(idx, 1);
        if (typeof criativoRenderMestre === 'function') criativoRenderMestre();
        // Deletar do banco
        try {
          const rpgId = AR.session?.rpg_id || RPG_DATA?.rpgId;
          if (rpgId) {
            const sbFn = AR.session ? arSb : sb;
            sbFn(`criativos?rpg_id=eq.${encodeURIComponent(rpgId)}&id=eq.${encodeURIComponent(idCriativo)}`, { method: 'DELETE' }).catch(()=>{});
          }
        } catch(e) {}
      }, 30000);
      
      if (typeof criativoRenderMestre === 'function') criativoRenderMestre();
    }
    criativoStopPolling();
    CRIATIVO_ID_ATUAL = null;
  }

  // Avancar turno automaticamente na arena apos o dano ser aplicado
  if (contexto === 'arena' && typeof AR !== 'undefined' && AR.iniciativa && AR.iniciativa.fase === 'combate') {
    if (AR.myRole === 'mestre') {
      await arProximoTurnoIniciativa();
    } else {
      // Jogador avanca o proprio turno (mesmo mecanismo do arAcaoPassar)
      const ini = AR.iniciativa;
      const meuChar = arMeuChar();
      const atual = ini.ordem[ini.ordemAtual];
      if (atual && atual.nome === meuChar) {
        let prox = (ini.ordemAtual + 1);
        while (prox < ini.ordem.length && ini.ordem[prox]?.vinculado_a) prox++;
        if (prox >= ini.ordem.length) {
          ini.round = (ini.round||1) + 1;
          prox = 0;
          if (typeof avancarTurno === 'function') await avancarTurno();
          arAddLog(`🔄 Round ${ini.round} iniciado`);
        }
        ini.ordemAtual = prox;
        const proximo = ini.ordem[prox];
        arAddLog(`🎯 Vez de: ${proximo?.nome}`);
        await arSalvarEstado();
        if (typeof renderArenaIniciativaUI === 'function') renderArenaIniciativaUI();
        if (typeof renderArenaCenario === 'function') renderArenaCenario();
        arToast(`Vez de ${proximo?.nome || '?'}!`, 'sucesso');
      }
    }
  }

  // ── Abrir modal de efeito crítico para o mestre ──────────────
  const ehMestre = (contexto === 'arena' ? AR?.myRole : RPG_DATA?.myRole) === 'mestre';
  if (ehCritico && ehMestre) {
    setTimeout(() => abrirModalCriticoMestre(alvosAtaque, criticoEhPositivo, criticoTexto, contexto), 400);
  }
}

// ── Confirmar ataque (builder manual / AoE) ──────────────────
// ════════════════════════════════════════════════════════════════════════════
// VOL II v2.1 — EMPURRAR / ARREMESSAR
// ════════════════════════════════════════════════════════════════════════════
async function acaoEmpurrar(atacanteNome, alvoNome, batalhaId) {
  const atk  = (RPG_DATA?.characters||[]).find(c => c.nome === atacanteNome);
  const alvo = (RPG_DATA?.characters||[]).find(c => c.nome === alvoNome);
  if (!atk || !alvo) return;

  const fAtk  = parseFloat(atk.custom_attrs?.atributos?.Forca  || 0);
  const fAlvo = parseFloat(alvo.custom_attrs?.atributos?.Forca || 0);
  const rAtk  = Math.floor(Math.random()*20) + 1 + fAtk;
  const rAlvo = Math.floor(Math.random()*20) + 1 + fAlvo;

  mostrarToast(atacanteNome + ' empurra ' + alvoNome + ' [' + Math.round(rAtk) + ' vs ' + Math.round(rAlvo) + ']', '');

  if (rAtk <= rAlvo) {
    mostrarToast(alvoNome + ' resistiu ao empurrão.', '');
    return;
  }

  const mapId  = MAPA_STATE.mapaAtualId;
  const posAtk = getPosicaoNoMapa(atk,  mapId);
  const posAlv = getPosicaoNoMapa(alvo, mapId);
  if (!posAtk || !posAlv) return;

  const dc = Math.sign(posAlv.col - posAtk.col);
  const dr = Math.sign(posAlv.row - posAtk.row);
  let col = posAlv.col, row = posAlv.row;
  const passos = 2;

  for (let i = 0; i < passos; i++) {
    const nc = col + dc, nr = row + dr;
    if (typeof paredeBloqueiaMovimento === 'function' &&
        paredeBloqueiaMovimento(mapId, col, row, dc, dr)) {
      const danoImpacto = Math.floor(Math.random()*6) + 1;
      await atkAplicarDano(alvoNome, danoImpacto, 'campanha', 'fisico');
      mostrarToast(alvoNome + ' bateu na parede! ' + danoImpacto + ' de dano.', 'erro');
      break;
    }
    col = nc; row = nr;
  }

  if (!alvo.map_positions) alvo.map_positions = {};
  alvo.map_positions[mapId] = { col, row };

  await sb(
    'characters?rpg_id=eq.' + encodeURIComponent(RPG_DATA.rpgId) +
    '&nome=eq.' + encodeURIComponent(alvoNome),
    { method: 'PATCH', body: JSON.stringify({ map_positions: alvo.map_positions }) }
  );

  combateBroadcast('empurrao_executado', { atacante: atacanteNome, alvo: alvoNome, col, row, mapId });

  const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) mapaRenderTokens(entry.mapa);

  if (typeof superficieVerificarEntrada === 'function') {
    superficieVerificarEntrada(mapId, alvoNome, col, row);
  }
}

// ═══════════════════════════════════════════════════════════════
// REALTIME: Receber atualizações de batalhas
// ═══════════════════════════════════════════════════════════════

window.batalhaReceberLinhaRemota = function(rec) {
  if (!rec || !rec.batalha_id) return;
  
  console.log('[Realtime Batalha] Recebendo atualização:', rec.batalha_id);
  
  // Parsear estado se for string
  let estado = rec.estado;
  if (typeof estado === 'string') {
    try {
      estado = JSON.parse(estado);
    } catch(e) {
      console.error('[Realtime Batalha] Erro ao parsear estado:', e);
      return;
    }
  }
  
  if (!MAPA_STATE.batalhas) MAPA_STATE.batalhas = {};
  
  // Atualizar estado da batalha
  MAPA_STATE.batalhas[rec.batalha_id] = estado;
  
  // Se é a batalha atual, atualizar UI
  if (BATALHA_ATUAL_ID === rec.batalha_id) {
    console.log('[Realtime Batalha] Atualizando UI da batalha atual');

    // Re-renderizar strip de ordem e label de vez (fix P11 — estavam faltando)
    if (typeof batalhaRenderOrdemStrip === 'function') batalhaRenderOrdemStrip();
    if (typeof batalhaRenderVezLabel === 'function') batalhaRenderVezLabel();

    // Re-renderizar painel de ações
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }

    // Re-renderizar lista de iniciativa
    if (typeof _mesaRenderIniciativa === 'function') {
      _mesaRenderIniciativa();
    }

    // Re-renderizar status dos personagens
    if (typeof mapaRenderStatus === 'function') {
      mapaRenderStatus();
    }
  }
};

window.criativoReceberLinhaRemota = function(rec) {
  if (!rec || !rec.id) return;
  
  console.log('[Realtime Criativo] Recebendo atualização:', rec.id, rec.status);
  
  if (!window.CRIATIVOS_CAMP) window.CRIATIVOS_CAMP = [];
  
  // Encontrar criativo existente
  const idx = CRIATIVOS_CAMP.findIndex(c => c.id === rec.id);
  
  if (idx >= 0) {
    // Atualizar existente
    CRIATIVOS_CAMP[idx] = rec;
  } else {
    // Adicionar novo
    CRIATIVOS_CAMP.push(rec);
  }
  
  // Re-renderizar painel de aprovações se for mestre
  if (RPG_DATA?.myRole === 'mestre') {
    if (typeof criativoRenderMestre === 'function') {
      criativoRenderMestre();
    }
    
    // Re-renderizar painel de ações para atualizar contador
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
  }
};

console.log('[Combat] Funções de realtime registradas ✓');

// ═══════════════════════════════════════════════════════════════
// REALTIME: Funções adicionais de broadcast
// ═══════════════════════════════════════════════════════════════

window.batalhaReceberEstadoRemoto = function(estadoBatalha) {
  console.log('[Realtime] Recebendo estado de batalha via rpg_registry');
  
  // O estado de batalha pode vir via rpg_registry também
  // Esta função garante compatibilidade com ambas as fontes
  if (!estadoBatalha || typeof estadoBatalha !== 'object') return;
  
  // Atualizar estado local se necessário
  // (batalhaReceberLinhaRemota já faz isso, esta é redundância para compatibilidade)
};

window.animReceberBroadcast = function(payload) {
  console.log('[Realtime] Animação de ataque recebida:', payload);
  
  // Executar animação de ataque se a função existir
  if (typeof executarAnimacaoAtaque === 'function') {
    executarAnimacaoAtaque(payload);
  }
};

window.tokenMoveReceber = function(payload) {
  console.log('[Realtime] Movimento de token recebido:', payload);
  
  // Atualizar posição do token e re-renderizar
  if (payload?.charNome && payload?.col !== undefined && payload?.row !== undefined) {
    const char = (RPG_DATA?.characters || []).find(c => c.nome === payload.charNome);
    if (char && payload.mapId) {
      if (!char.map_positions) char.map_positions = {};
      char.map_positions[payload.mapId] = { col: payload.col, row: payload.row };
      
      // Re-renderizar tokens se estamos no mapa certo
      if (MAPA_STATE?.mapaAtualId === payload.mapId) {
        const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === payload.mapId);
        if (entry && typeof mapaRenderTokens === 'function') {
          mapaRenderTokens(entry.mapa);
        }
      }
    }
  }
};

window.combateReceberBroadcast = function(payload) {
  console.log('[Realtime] Evento de combate recebido:', payload);
  
  // ═══════════════════════════════════════════════════════════════
  // FASE 1: HANDLERS CRÍTICOS
  // ═══════════════════════════════════════════════════════════════
  
  // ── Mudança de fase (iniciativa → combate)
  if (payload?.tipo === 'fase_mudou') {
    console.log('[Realtime] Fase mudou:', payload);
    
    const bid = payload?.batalhaId;
    const fase = payload?.fase;
    
    if (bid && fase && window.MAPA_STATE?.batalhas?.[bid]) {
      const bs = window.MAPA_STATE.batalhas[bid];
      bs.fase = fase;
      
      console.log(`[Realtime] Batalha ${bid} agora está em fase: ${fase}`);
      
      // Re-renderizar UI
      if (typeof _aplicarEstadoBatalhaUI === 'function') {
        _aplicarEstadoBatalhaUI();
      }
      
      if (typeof batalhaRenderFaseIniciativa === 'function') {
        batalhaRenderFaseIniciativa();
      }
      
      if (typeof _mesaRenderAcoes === 'function') {
        _mesaRenderAcoes();
      }
      
      if (typeof _mesaRenderIniciativa === 'function') {
        _mesaRenderIniciativa();
      }
    }
  }
  
  // ── Personagem caiu a 0 HP
  if (payload?.tipo === 'personagem_caiu') {
    console.log('[Realtime] Personagem caiu:', payload);
    
    const nome = payload?.nome;
    if (nome && window.RPG_DATA?.characters) {
      const char = window.RPG_DATA.characters.find(c => c.nome === nome);
      if (char) {
        char.hp_atual = 0;
        if (!char.custom_attrs) char.custom_attrs = {};
        char.custom_attrs.moribundo = true;
        
        console.log(`[Realtime] ${nome} está moribundo`);
        
        // Re-renderizar
        if (typeof mapaRenderStatus === 'function') {
          mapaRenderStatus();
        }
        
        if (typeof renderPersonagens === 'function') {
          renderPersonagens();
        }
      }
    }
  }
  
  // ── Personagem morreu
  if (payload?.tipo === 'personagem_morto') {
    console.log('[Realtime] Personagem morreu:', payload);
    
    const nome = payload?.nome;
    if (nome && window.RPG_DATA?.characters) {
      const char = window.RPG_DATA.characters.find(c => c.nome === nome);
      if (char) {
        if (!char.custom_attrs) char.custom_attrs = {};
        char.custom_attrs.morto = true;
        char.custom_attrs.moribundo = false;
        
        console.log(`[Realtime] ${nome} morreu`);
        
        // Re-renderizar
        if (typeof mapaRenderStatus === 'function') {
          mapaRenderStatus();
        }
        
        if (typeof renderPersonagens === 'function') {
          renderPersonagens();
        }
        
        if (typeof batalhaRenderOrdemStrip === 'function') {
          batalhaRenderOrdemStrip();
        }
      }
    }
  }
  
  // ── Personagem estabilizou
  if (payload?.tipo === 'personagem_estabilizou') {
    console.log('[Realtime] Personagem estabilizou:', payload);
    
    const nome = payload?.nome;
    if (nome && window.RPG_DATA?.characters) {
      const char = window.RPG_DATA.characters.find(c => c.nome === nome);
      if (char) {
        if (!char.custom_attrs) char.custom_attrs = {};
        char.custom_attrs.moribundo = false;
        char.custom_attrs.estabilizado = true;
        if (char.custom_attrs.salvaguardas) {
          delete char.custom_attrs.salvaguardas;
        }
        
        console.log(`[Realtime] ${nome} estabilizou`);
        
        // Re-renderizar
        if (typeof mapaRenderStatus === 'function') {
          mapaRenderStatus();
        }
        
        if (typeof renderPersonagens === 'function') {
          renderPersonagens();
        }
      }
    }
  }
  
  // ── Salvaguarda de morte (broadcast para todos)
  if (payload?.tipo === 'death_save_rolou') {
    const { nome, d20, resultado, sucessos, falhas } = payload;
    if (nome) {
      let msg = '', tipo = '';
      if (resultado === 'critico') {
        msg = `💛 ${nome} rolou 20! Acordou com 1 HP!`;
        tipo = 'sucesso';
      } else if (resultado === 'sucesso') {
        msg = `💛 ${nome} — Salvaguarda ${d20} ✔ (${sucessos}/2 sucessos)`;
        tipo = 'sucesso';
      } else {
        msg = `💀 ${nome} — Salvaguarda ${d20} ✘ (${falhas}/3 falhas)`;
        tipo = 'erro';
      }
      mostrarToast(msg, tipo);
      _mostrarPainelSalvaguarda(nome, resultado, d20, sucessos, falhas);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: HANDLERS IMPORTANTES
  // ═══════════════════════════════════════════════════════════════

  // ── Batalha pausada/retomada
  if (payload?.tipo === 'batalha_pausada') {
    console.log('[Realtime] Batalha pausada:', payload);
    
    const bid = payload?.batalhaId;
    const pausada = payload?.pausada;
    
    if (bid && typeof pausada === 'boolean' && window.MAPA_STATE?.batalhas?.[bid]) {
      const bs = window.MAPA_STATE.batalhas[bid];
      bs.pausada = pausada;
      
      console.log(`[Realtime] Batalha ${bid} ${pausada ? 'pausada' : 'retomada'}`);
      
      // Re-renderizar
      if (typeof _mesaRenderAcoes === 'function') {
        _mesaRenderAcoes();
      }
    }
  }
  
  // ── Batalha terminou com vitória
  if (payload?.tipo === 'batalha_vitoria') {
    console.log('[Realtime] Batalha vitória:', payload);
    
    // Mostrar tela de vitória se função existir
    if (typeof mostrarTelaVitoria === 'function') {
      mostrarTelaVitoria(payload?.stats, payload?.rounds);
    }
    
    // Toast de vitória
    if (typeof mostrarToast === 'function') {
      mostrarToast('🎉 Vitória! Batalha concluída!', 'sucesso');
    }
  }
  
  // ── Ataque de oportunidade
  if (payload?.tipo === 'ataque_oportunidade') {
    console.log('[Realtime] Ataque de oportunidade:', payload);
    
    // Re-renderizar para mostrar reações
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FASE 3: HANDLERS DE MELHORIAS (visuais/UX)
  // ═══════════════════════════════════════════════════════════════
  
  // ── Dados rolados (animação)
  if (payload?.tipo === 'dados_rolados') {
    console.log('[Realtime] Dados rolados:', payload);
    
    // Executar animação de dados se existir
    if (typeof executarAnimacaoDados === 'function') {
      executarAnimacaoDados(payload);
    }
  }
  
  // ── Efeito aplicado (visual)
  if (payload?.tipo === 'efeito_aplicado') {
    console.log('[Realtime] Efeito aplicado:', payload);
    
    // Mostrar feedback visual
    if (typeof mostrarToast === 'function' && payload?.descricao) {
      mostrarToast(payload.descricao, 'info');
    }
  }
  
  // ── Mostrar trigger visual
  if (payload?.tipo === 'trigger_mostrar') {
    console.log('[Realtime] Trigger mostrar:', payload);
    
    // Executar trigger se função existir
    if (typeof mostrarTriggerVisual === 'function') {
      mostrarTriggerVisual(payload);
    }
  }
  
  // ── Ocultar trigger visual
  if (payload?.tipo === 'trigger_ocultar') {
    console.log('[Realtime] Trigger ocultar:', payload);
    
    // Ocultar trigger se função existir
    if (typeof ocultarTriggerVisual === 'function') {
      ocultarTriggerVisual();
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HANDLERS EXISTENTES (mantidos)
  // ═══════════════════════════════════════════════════════════════
  
  if (payload?.tipo === 'dano_aplicado') {
    // Re-renderizar status se necessário
    if (typeof mapaRenderStatus === 'function') {
      mapaRenderStatus();
    }
  }
  
  if (payload?.tipo === 'turno_mudado') {
    // Re-renderizar painel de ações
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
    if (typeof _mesaRenderIniciativa === 'function') {
      _mesaRenderIniciativa();
    }
  }
  
  if (payload?.tipo === 'habilidade_usada') {
    // Re-renderizar cooldowns se necessário
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
  }
  
  if (payload?.tipo === 'iniciativa_rolada') {
    console.log('[Realtime] Iniciativa rolada:', payload);
    
    // Atualizar estado local da batalha
    const bid = payload?.batalhaId;
    const nome = payload?.nome;
    const valor = payload?.valor;
    
    if (bid && nome && typeof valor === 'number') {
      const bs = window.MAPA_STATE?.batalhas?.[bid];
      if (bs) {
        // Atualizar iniciativa rolada
        if (!bs.iniciativasRoladas) bs.iniciativasRoladas = {};
        bs.iniciativasRoladas[nome] = valor;
        
        // Atualizar participante
        const p = bs.participantes?.find(x => x.nome === nome);
        if (p) p.iniciativa = valor;
        
        console.log(`[Realtime] Iniciativa de ${nome} atualizada: ${valor}`);
        
        // Re-renderizar UI de iniciativa
        if (typeof batalhaRenderFaseIniciativa === 'function') {
          batalhaRenderFaseIniciativa();
        }
        
        // Re-renderizar lista se existir
        if (typeof _mesaRenderIniciativa === 'function') {
          _mesaRenderIniciativa();
        }
      }
    }
  }
  
  if (payload?.tipo === 'batalha_criada') {
    console.log('[Realtime] Batalha criada:', payload);
    
    const bid = payload?.batalhaId;
    const estado = payload?.estado;
    
    if (bid && estado && window.MAPA_STATE) {
      if (!window.MAPA_STATE.batalhas) window.MAPA_STATE.batalhas = {};
      window.MAPA_STATE.batalhas[bid] = estado;
      
      console.log(`[Realtime] Batalha ${bid} adicionada ao estado local`);
      
      // Re-renderizar UI
      if (typeof _aplicarEstadoBatalhaUI === 'function') {
        _aplicarEstadoBatalhaUI();
      }
      
      if (typeof _atualizarBadgeMesa === 'function') {
        _atualizarBadgeMesa();
      }
      
      if (typeof _atualizarSeletorBatalhas === 'function') {
        _atualizarSeletorBatalhas();
      }
    }
  }
  
  if (payload?.tipo === 'batalha_estado') {
    console.log('[Realtime] Estado da batalha atualizado:', payload);
    
    const bid = payload?.batalhaId;
    if (bid && window.MAPA_STATE?.batalhas?.[bid]) {
      const bs = window.MAPA_STATE.batalhas[bid];
      
      // Atualizar campos
      if (payload?.fase) bs.fase = payload.fase;
      if (payload?.participantes) bs.participantes = payload.participantes;
      if (payload?.iniciativasRoladas) bs.iniciativasRoladas = payload.iniciativasRoladas;
      if (payload?.empatados) bs.empatados = payload.empatados;
      if (typeof payload?.ordemAtual === 'number') bs.ordemAtual = payload.ordemAtual;
      if (typeof payload?.turnoRound === 'number') bs.turnoRound = payload.turnoRound;
      
      // Re-renderizar
      if (typeof batalhaRenderFaseIniciativa === 'function') {
        batalhaRenderFaseIniciativa();
      }
      
      if (typeof _mesaRenderIniciativa === 'function') {
        _mesaRenderIniciativa();
      }
      
      if (typeof _mesaRenderAcoes === 'function') {
        _mesaRenderAcoes();
      }
    }
  }
  
  if (payload?.tipo === 'vez_passou') {
    console.log('[Realtime] Vez passou:', payload);
    
    const bid = payload?.batalhaId;
    if (bid && window.MAPA_STATE?.batalhas?.[bid]) {
      const bs = window.MAPA_STATE.batalhas[bid];

      if (typeof payload?.ordemAtual === 'number') bs.ordemAtual = payload.ordemAtual;
      if (typeof payload?.turnoRound === 'number') bs.turnoRound = payload.turnoRound;
      // Aplica campos extras do broadcast (fix P12)
      if (payload?.cooldowns && typeof payload.cooldowns === 'object') bs.cooldowns = payload.cooldowns;
      if (payload?.recursos_participantes && typeof payload.recursos_participantes === 'object') {
        bs.recursos_participantes = payload.recursos_participantes;
      }

      // Re-renderizar
      if (typeof batalhaRenderOrdemStrip === 'function') {
        batalhaRenderOrdemStrip();
      }

      if (typeof batalhaRenderVezLabel === 'function') {
        batalhaRenderVezLabel();
      }

      if (typeof _mesaRenderAcoes === 'function') {
        _mesaRenderAcoes();
      }

      if (typeof _mesaRenderIniciativa === 'function') {
        _mesaRenderIniciativa();
      }
    }
  }
  
  if (payload?.tipo === 'batalha_encerrada') {
    console.log('[Realtime] Batalha encerrada:', payload);
    
    const bid = payload?.batalhaId;
    if (bid && window.MAPA_STATE?.batalhas) {
      delete window.MAPA_STATE.batalhas[bid];
      
      // Se era a batalha atual, limpar
      if (window.BATALHA_ATUAL_ID === bid) {
        window.BATALHA_ATUAL_ID = null;
      }
      
      // Re-renderizar
      if (typeof _aplicarEstadoBatalhaUI === 'function') {
        _aplicarEstadoBatalhaUI();
      }
      
      if (typeof _atualizarBadgeMesa === 'function') {
        _atualizarBadgeMesa();
      }
      
      if (typeof _atualizarSeletorBatalhas === 'function') {
        _atualizarSeletorBatalhas();
      }
    }
  }

  // ── Handlers do sistema de batalha avançado (reações / defesa ativa) ──────
  if (payload?.tipo === 'solicitacao_reacao') {
    if (typeof window.batalhaReceberSolicitacaoReacao === 'function') {
      window.batalhaReceberSolicitacaoReacao(payload);
    }
  }
  if (payload?.tipo === 'reacao_confirmada') {
    if (typeof window.batalhaReceberConfirmacaoReacao === 'function') {
      window.batalhaReceberConfirmacaoReacao(payload);
    }
  }
  if (payload?.tipo === 'reacao_executada') {
    if (typeof window.batalhaReceberReacaoExecutada === 'function') {
      window.batalhaReceberReacaoExecutada(payload);
    }
  }
  if (payload?.tipo === 'solicitacao_defesa_ativa') {
    if (typeof window.batalhaReceberSolicitacaoDefesa === 'function') {
      window.batalhaReceberSolicitacaoDefesa(payload);
    }
  }
  if (payload?.tipo === 'defesa_resolvida') {
    if (typeof window.batalhaReceberDefesaResolvida === 'function') {
      window.batalhaReceberDefesaResolvida(payload);
    }
  }
  if (payload?.tipo === 'xp_distribuido') {
    const meuChar = RPG_DATA?.linked;
    if (meuChar && payload.destinatarios?.includes(meuChar)) {
      const c = (RPG_DATA?.characters || []).find(x => x.nome === meuChar);
      if (c) {
        if (!c.custom_attrs) c.custom_attrs = {};
        c.custom_attrs.xp = (c.custom_attrs.xp || 0) + (payload.quantidade || 0);
        mostrarToast(`✨ +${payload.quantidade} XP recebido!`, 'sucesso', 3000);
        if (typeof renderCharView === 'function' && CHAR_VIEW === meuChar) renderCharView(meuChar);
      }
    }
  }
};

console.log('[Combat] Todos os handlers de broadcast registrados ✓');

// ═══════════════════════════════════════════════════════════════
// REALTIME: Handlers para inventário, moedas e itens
// ═══════════════════════════════════════════════════════════════

window.inventarioReceberAtualização = function(rec, ev) {
  console.log('[Realtime Inventario] Atualização:', rec.id, ev);
  
  // Atualizar cache local se existir
  if (window.INVENTARIO_CACHE) {
    if (ev === 'DELETE') {
      INVENTARIO_CACHE = INVENTARIO_CACHE.filter(i => i.id !== rec.id);
    } else {
      const idx = INVENTARIO_CACHE.findIndex(i => i.id === rec.id);
      if (idx >= 0) INVENTARIO_CACHE[idx] = rec;
      else INVENTARIO_CACHE.push(rec);
    }
  }
  
  // Re-renderizar inventário se as funções existirem
  if (typeof renderInventario === 'function') {
    renderInventario();
  }
  
  if (typeof renderEquipamentos === 'function') {
    renderEquipamentos();
  }
  
  if (typeof atualizarInventarioUI === 'function') {
    atualizarInventarioUI();
  }
};

window.moedasReceberAtualização = function(rec, ev) {
  console.log('[Realtime Moedas] Atualização:', rec);
  
  // Atualizar cache local
  if (window.MOEDAS_CACHE) {
    if (ev === 'DELETE') {
      MOEDAS_CACHE = MOEDAS_CACHE.filter(m => m.id !== rec.id);
    } else {
      const idx = MOEDAS_CACHE.findIndex(m => m.id === rec.id);
      if (idx >= 0) MOEDAS_CACHE[idx] = rec;
      else MOEDAS_CACHE.push(rec);
    }
  }
  
  // Re-renderizar display de moedas
  if (typeof atualizarDisplayMoedas === 'function') {
    atualizarDisplayMoedas();
  }
  
  if (typeof renderMoedas === 'function') {
    renderMoedas();
  }
};

window.lootReceberAtualização = function(rec, ev) {
  console.log('[Realtime Loot] Atualização:', rec);
  
  // Atualizar cache de loot pendente
  if (window.LOOT_CACHE) {
    if (ev === 'DELETE' || rec.saqueado) {
      LOOT_CACHE = LOOT_CACHE.filter(l => l.id !== rec.id);
    } else {
      const idx = LOOT_CACHE.findIndex(l => l.id === rec.id);
      if (idx >= 0) LOOT_CACHE[idx] = rec;
      else LOOT_CACHE.push(rec);
    }
  }
  
  // Re-renderizar baús/loot no mapa
  if (typeof renderBaus === 'function') {
    renderBaus();
  }
  
  if (typeof atualizarMapaLoot === 'function') {
    atualizarMapaLoot();
  }
};

window.mercadoReceberAtualização = function(rec, ev) {
  console.log('[Realtime Mercado] Atualização:', rec);
  
  // Atualizar cache do mercado
  if (window.MERCADO_CACHE) {
    if (ev === 'DELETE') {
      MERCADO_CACHE = MERCADO_CACHE.filter(m => m.id !== rec.id);
    } else {
      const idx = MERCADO_CACHE.findIndex(m => m.id === rec.id);
      if (idx >= 0) MERCADO_CACHE[idx] = rec;
      else MERCADO_CACHE.push(rec);
    }
  }
  
  // Re-renderizar mercado se estiver aberto
  if (typeof renderMercado === 'function') {
    renderMercado();
  }
};

window.tradesReceberAtualização = function(rec, ev) {
  console.log('[Realtime Trades] Atualização:', rec);
  
  // Atualizar cache de trades
  if (window.TRADES_CACHE) {
    if (ev === 'DELETE') {
      TRADES_CACHE = TRADES_CACHE.filter(t => t.id !== rec.id);
    } else {
      const idx = TRADES_CACHE.findIndex(t => t.id === rec.id);
      if (idx >= 0) TRADES_CACHE[idx] = rec;
      else TRADES_CACHE.push(rec);
    }
  }
  
  // Re-renderizar interface de trades
  if (typeof renderTrades === 'function') {
    renderTrades();
  }
  
  if (typeof atualizarTradesUI === 'function') {
    atualizarTradesUI();
  }
};

window.itemCatalogReceberAtualização = function(rec, ev) {
  console.log('[Realtime Item Catalog] Atualização:', rec);
  
  // Atualizar cache global de itens
  if (window.ITEMS_CATALOG) {
    if (ev === 'DELETE') {
      ITEMS_CATALOG = ITEMS_CATALOG.filter(i => i.id !== rec.id);
    } else {
      const idx = ITEMS_CATALOG.findIndex(i => i.id === rec.id);
      if (idx >= 0) ITEMS_CATALOG[idx] = rec;
      else ITEMS_CATALOG.push(rec);
    }
  }
  
  // Re-renderizar catálogo se estiver aberto
  if (typeof renderCatalogo === 'function') {
    renderCatalogo();
  }
  
  if (typeof renderItemCatalog === 'function') {
    renderItemCatalog();
  }
};

console.log('[Combat] Handlers de inventário, moedas e itens registrados ✓');

// ═══════════════════════════════════════════════════════════════
// BATALHA CAMPANHA: batalhaPassarVez
// ═══════════════════════════════════════════════════════════════
// NOTA: Função implementada em maps.js (versão mais completa)
// Não duplicar aqui para evitar sobrescrever

// ═══════════════════════════════════════════════════════════════
// BATALHA CAMPANHA: Pausar/Retomar
// ═══════════════════════════════════════════════════════════════

window.pausarOuRetomarBatalha = async function() {
  if (!BATALHA_ATUAL_ID) {
    console.error('[Pausar Batalha] Nenhuma batalha ativa');
    return;
  }
  
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs) {
    console.error('[Pausar Batalha] Batalha não encontrada:', BATALHA_ATUAL_ID);
    return;
  }
  
  // Toggle pausado
  const estaPausado = bs.pausado || false;
  bs.pausado = !estaPausado;
  
  console.log('[Pausar Batalha] Pausado:', bs.pausado);
  
  try {
    if (typeof sb === 'function') {
      await sb(`batalhas?batalha_id=eq.${encodeURIComponent(BATALHA_ATUAL_ID)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          estado: bs
        })
      });
    }
    
    if (typeof mostrarToast === 'function') {
      mostrarToast(
        bs.pausado ? '⏸ Batalha pausada' : '▶ Batalha retomada',
        bs.pausado ? 'info' : 'sucesso'
      );
    }
    
    // Re-renderizar UI
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
    
    if (typeof mapaRenderStatus === 'function') {
      mapaRenderStatus();
    }
    
  } catch (error) {
    console.error('[Pausar Batalha] Erro:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro ao pausar batalha', 'erro');
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// BATALHA CAMPANHA: Encerrar
// ═══════════════════════════════════════════════════════════════

window.encerrarBatalha = async function() {
  if (!BATALHA_ATUAL_ID) {
    console.error('[Encerrar Batalha] Nenhuma batalha ativa');
    return;
  }
  
  // Confirmar com o mestre
  if (!confirm('Tem certeza que deseja encerrar esta batalha?')) {
    return;
  }
  
  console.log('[Encerrar Batalha] Encerrando:', BATALHA_ATUAL_ID);
  
  try {
    // Deletar batalha do banco
    if (typeof sb === 'function') {
      await sb(`batalhas?batalha_id=eq.${encodeURIComponent(BATALHA_ATUAL_ID)}`, {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' }
      });
    }
    
    // Limpar estado local
    if (MAPA_STATE.batalhas) {
      delete MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
    }
    
    const batalhaAnterior = BATALHA_ATUAL_ID;
    BATALHA_ATUAL_ID = null;
    
    if (typeof mostrarToast === 'function') {
      mostrarToast('✓ Batalha encerrada', 'sucesso');
    }
    
    // Re-renderizar UI
    if (typeof _mesaRenderAcoes === 'function') {
      _mesaRenderAcoes();
    }
    
    if (typeof _mesaRenderIniciativa === 'function') {
      _mesaRenderIniciativa();
    }
    
    if (typeof mapaRenderStatus === 'function') {
      mapaRenderStatus();
    }
    
    // Broadcast para outros jogadores
    if (typeof combateBroadcast === 'function') {
      combateBroadcast('batalha_encerrada', {
        batalha_id: batalhaAnterior
      });
    }
    
  } catch (error) {
    console.error('[Encerrar Batalha] Erro:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('Erro ao encerrar batalha', 'erro');
    }
  }
};

console.log('[Combat] Funções de controle de batalha registradas ✓');

// ═══════════════════════════════════════════════════════════════
// BATALHA CAMPANHA: Jogar por Offline
// ═══════════════════════════════════════════════════════════════

window.batalhaJogarPorOffline = function() {
  if (!BATALHA_ATUAL_ID) {
    console.error('[Jogar por Offline] Nenhuma batalha ativa');
    return;
  }
  
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  if (!bs || bs.fase !== 'combate') {
    if (typeof mostrarToast === 'function') {
      mostrarToast('Não é fase de combate', 'erro');
    }
    return;
  }
  
  const atual = bs.participantes?.[bs.ordemAtual];
  if (!atual) {
    console.error('[Jogar por Offline] Participante atual não encontrado');
    return;
  }
  
  console.log('[Jogar por Offline] Jogando por:', atual.nome);
  
  // Informar ao mestre
  if (typeof mostrarToast === 'function') {
    mostrarToast(`🎮 Jogando por ${atual.nome}`, 'info');
  }
  
  // O mestre pode agora usar as habilidades desse personagem
  // O TOKEN_CTRL.nomeSelecionado será usado para identificar qual personagem está atacando
  if (!window.TOKEN_CTRL) {
    window.TOKEN_CTRL = {};
  }
  
  TOKEN_CTRL.nomeSelecionado = atual.nome;
  
  // Re-renderizar ações para mostrar habilidades do personagem
  if (typeof _mesaRenderAcoes === 'function') {
    _mesaRenderAcoes();
  }
};

console.log('[Combat] Função batalhaJogarPorOffline registrada ✓');

// ═══════════════════════════════════════════════════════════════
// BATALHA CAMPANHA: Finalizar Ataque
// ═══════════════════════════════════════════════════════════════

// Timer global para auto-avanço de turno
let _timerAutoAvanco = null;

async function _finalizarAtaqueCampanha() {
  console.log('[Finalizar Ataque] Ataque finalizado em campanha');
  
  // Re-renderizar UI para mostrar HP atualizado
  if (typeof _mesaRenderAcoes === 'function') {
    _mesaRenderAcoes();
  }
  
  if (typeof mapaRenderStatus === 'function') {
    mapaRenderStatus();
  }
  
  // Iniciar timer de 5 segundos para auto-avanço
  iniciarTimerAutoAvanco();
}

function iniciarTimerAutoAvanco() {
  // Cancelar timer anterior se existir
  cancelarTimerAutoAvanco();
  
  console.log('[Auto-Avanço] Timer de 5 segundos iniciado');
  
  // Toast de aviso
  if (typeof mostrarToast === 'function') {
    mostrarToast('Turno avançará em 5s... (clique Pular para cancelar)', 'info');
  }
  
  _timerAutoAvanco = setTimeout(async () => {
    console.log('[Auto-Avanço] 5 segundos passaram, avançando turno automaticamente');
    
    if (typeof mostrarToast === 'function') {
      mostrarToast('⏰ Turno avançado automaticamente', 'info');
    }
    
    // Avançar turno automaticamente
    if (typeof batalhaPassarVez === 'function') {
      await batalhaPassarVez();
    }
    
    _timerAutoAvanco = null;
  }, 5000);
}

function cancelarTimerAutoAvanco() {
  if (_timerAutoAvanco) {
    console.log('[Auto-Avanço] Timer cancelado');
    clearTimeout(_timerAutoAvanco);
    _timerAutoAvanco = null;
  }
}

// Exportar função de cancelamento para ser usada quando jogador clicar em Pular
window.cancelarTimerAutoAvanco = cancelarTimerAutoAvanco;

console.log('[Combat] Função _finalizarAtaqueCampanha com auto-avanço registrada ✓');
