// ════════════════════════════════════════════════════════════════════════════
// MODIFICAÇÕES - INTEGRAÇÃO INLINE DO MODAL DE ATAQUE NO PAINEL DE AÇÕES
// ════════════════════════════════════════════════════════════════════════════

// ── Nova função: Renderizar ataque inline no painel ─────────────────────
function _mesaRenderAtaqueInline(atacanteNome, habilidades) {
  // Estado local do ataque inline
  if (!window._MESA_ATK_STATE) {
    window._MESA_ATK_STATE = {
      step: 1,
      habilidadeSel: null,
      alvoNome: null,
      dadosRolados: null,
      formulaBuilder: []
    };
  }
  
  const state = window._MESA_ATK_STATE;
  const cooldowns = getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);
  
  // STEP 1: Seleção de habilidade
  if (state.step === 1) {
    return '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">⚔ Escolha a habilidade</div>' +
      habilidades.slice(0, 6).map((h, idx) => {
        const cd = cooldowns[h.id] || 0;
        const bloqueio = atkVerificarBloqueioAtaque(atacanteNome, h.tipo_dano);
        const disabled = cd > 0 || !!bloqueio;
        
        const bgC = disabled ? 'rgba(60,40,20,0.4)' : 'rgba(192,57,43,0.08)';
        const bdC = disabled ? 'rgba(60,40,20,0.4)' : 'rgba(192,57,43,0.3)';
        const colr = disabled ? '#5a4030' : '#e8604c';
        
        // Preview de dano com range
        let badge = '';
        if (cd > 0) {
          badge = `<span style="font-size:0.55rem;color:#a07040">⏳ ${cd}t</span>`;
        } else if (bloqueio) {
          badge = `<span style="font-size:0.55rem;color:#c0392b">🚫</span>`;
        } else if (h.formula_dano && h.formula_dano !== '—') {
          const range = calcularRangeDano(h.formula_dano);
          const modAttr = calcModAtributo(h, atacanteNome, 'campanha');
          const minFinal = range.min + modAttr;
          const maxFinal = range.max + modAttr;
          const modLabel = modAttr !== 0 ? ` +${modAttr}` : '';
          badge = `<span style="font-size:0.55rem;color:#f0cc6a">${h.formula_dano}${modLabel} (${minFinal}-${maxFinal})</span>`;
        }
        
        return `<button ${disabled ? 'disabled' : ''} 
          onclick="_mesaAtaqueInlineSelecionarHab(${idx}, ${JSON.stringify(h).replace(/"/g, '&quot;')})"
          style="padding:7px 10px;background:${bgC};border:1px solid ${bdC};border-radius:8px;color:${colr};font-family:var(--fonte-d);font-size:0.62rem;cursor:${disabled ? 'default' : 'pointer'};text-align:left;width:100%;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s"
          ${disabled ? '' : `onmouseover="this.style.borderColor='rgba(232,96,76,0.5)'" onmouseout="this.style.borderColor='${bdC}'"`}>
          <span>${h.nome}</span>
          ${badge}
        </button>`;
      }).join('') +
      '</div>';
  }
  
  // STEP 2: Seleção de alvo
  if (state.step === 2 && state.habilidadeSel) {
    const h = state.habilidadeSel;
    const alvosDisponiveis = _mesaAtaqueInlineGetAlvos(atacanteNome, h);
    
    return '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<button onclick="_mesaAtaqueInlineVoltar()" style="padding:4px 8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-size:0.6rem;cursor:pointer">← Voltar</button>' +
        '<span style="font-family:var(--fonte-d);font-size:0.65rem;color:#e8604c">' + h.nome + '</span>' +
      '</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">🎯 Escolha o alvo</div>' +
      alvosDisponiveis.map(alvo => {
        const cor = alvo.cor || '#7ec8f0';
        const distancia = alvo.distancia != null ? ` · ${alvo.distancia}c` : '';
        const foraAlcance = h.alcance_celulas != null && alvo.distancia > h.alcance_celulas;
        const bgC = foraAlcance ? 'rgba(60,40,20,0.3)' : 'rgba(79,163,209,0.08)';
        const bdC = foraAlcance ? 'rgba(60,40,20,0.4)' : `${cor}44`;
        
        return `<button ${foraAlcance ? 'disabled' : ''} 
          onclick="_mesaAtaqueInlineSelecionarAlvo('${alvo.nome.replace(/'/g, "\\'")}')"
          style="padding:7px 10px;background:${bgC};border:1px solid ${bdC};border-radius:8px;color:${foraAlcance ? '#6a5840' : cor};font-family:var(--fonte-d);font-size:0.62rem;cursor:${foraAlcance ? 'default' : 'pointer'};text-align:left;width:100%;display:flex;align-items:center;gap:6px;transition:all 0.2s"
          ${foraAlcance ? '' : `onmouseover="this.style.borderColor='${cor}88'" onmouseout="this.style.borderColor='${cor}44'"`}>
          <div style="width:8px;height:8px;border-radius:50%;background:${cor};flex-shrink:0"></div>
          <span style="flex:1">${alvo.nome}${distancia}</span>
          ${foraAlcance ? '<span style="font-size:0.55rem;color:#a07040">⚠ Fora de alcance</span>' : ''}
        </button>`;
      }).join('') +
      '</div>';
  }
  
  // STEP 3: Rolagem e confirmação
  if (state.step === 3 && state.habilidadeSel && state.alvoNome) {
    const h = state.habilidadeSel;
    const jaRolou = state.dadosRolados != null;
    
    let conteudo = '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
        '<button onclick="_mesaAtaqueInlineVoltar()" style="padding:4px 8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-size:0.6rem;cursor:pointer">← Voltar</button>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:1px">' +
          '<span style="font-family:var(--fonte-d);font-size:0.65rem;color:#e8604c">' + h.nome + '</span>' +
          '<span style="font-size:0.58rem;color:var(--suave)">→ ' + state.alvoNome + '</span>' +
        '</div>' +
      '</div>';
    
    if (!jaRolou) {
      // Botão de rolar
      conteudo += '<button onclick="_mesaAtaqueInlineRolar()" ' +
        'style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(200,168,75,0.15),rgba(200,168,75,0.08));border:1px solid rgba(200,168,75,0.35);border-radius:8px;color:#f0cc6a;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;transition:all 0.2s" ' +
        'onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
        '🎲 Rolar ' + (h.formula_dano || 'Dados') +
        '</button>';
    } else {
      // Mostrar resultado
      const resultado = state.dadosRolados;
      conteudo += '<div style="padding:12px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.25);border-radius:8px;text-align:center">' +
        '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);margin-bottom:4px">Resultado</div>' +
        '<div style="font-family:\'Cinzel\',serif;font-size:1.8rem;color:#f0cc6a;margin-bottom:8px">' + resultado.total + '</div>' +
        '<div style="font-size:0.62rem;color:#9a8888">' + resultado.detalhes + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<button onclick="_mesaAtaqueInlineRolar()" style="flex:1;padding:8px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:7px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">🔄 Re-rolar</button>' +
        '<button onclick="_mesaAtaqueInlineConfirmar()" style="flex:2;padding:8px;background:linear-gradient(135deg,rgba(192,57,43,0.15),rgba(192,57,43,0.08));border:1px solid rgba(192,57,43,0.35);border-radius:7px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:.08em">⚔ Confirmar Ataque</button>' +
      '</div>';
    }
    
    conteudo += '</div>';
    return conteudo;
  }
  
  return '';
}

// ── Funções auxiliares do ataque inline ──────────────────────────────────
window._mesaAtaqueInlineSelecionarHab = function(idx, habilidade) {
  const state = window._MESA_ATK_STATE;
  state.step = 2;
  state.habilidadeSel = habilidade;
  state.alvoNome = null;
  state.dadosRolados = null;
  _mesaRenderAcoes();
};

window._mesaAtaqueInlineSelecionarAlvo = function(alvoNome) {
  const state = window._MESA_ATK_STATE;
  state.step = 3;
  state.alvoNome = alvoNome;
  state.dadosRolados = null;
  _mesaRenderAcoes();
};

window._mesaAtaqueInlineVoltar = function() {
  const state = window._MESA_ATK_STATE;
  if (state.step > 1) {
    state.step--;
    if (state.step === 1) {
      state.habilidadeSel = null;
      state.alvoNome = null;
    } else if (state.step === 2) {
      state.alvoNome = null;
      state.dadosRolados = null;
    }
    _mesaRenderAcoes();
  }
};

window._mesaAtaqueInlineRolar = function() {
  const state = window._MESA_ATK_STATE;
  const h = state.habilidadeSel;
  if (!h) return;
  
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.[bs.ordemAtual];
  const atacanteNome = atacante?.nome;
  
  if (h.formula_dano && h.formula_dano !== '—') {
    // Rolar fórmula de dano
    const resultado = rolarFormulaDano(h.formula_dano, h, atacanteNome, 'campanha');
    state.dadosRolados = resultado;
  } else {
    // Construtor de dados manual (simplificado)
    state.dadosRolados = { total: 0, detalhes: 'Sem dano definido' };
  }
  
  _mesaRenderAcoes();
};

window._mesaAtaqueInlineConfirmar = function() {
  const state = window._MESA_ATK_STATE;
  const h = state.habilidadeSel;
  const alvo = state.alvoNome;
  const resultado = state.dadosRolados;
  
  if (!h || !alvo || !resultado) return;
  
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.[bs.ordemAtual];
  const atacanteNome = atacante?.nome;
  
  // Aplicar dano
  if (typeof aplicarDanoBatalha === 'function') {
    aplicarDanoBatalha(BATALHA_ATUAL_ID, alvo, resultado.total, h.tipo_dano || 'fisico');
  }
  
  // Aplicar cooldown
  if (h.cooldown_turnos > 0 && typeof setCooldownBatalha === 'function') {
    setCooldownBatalha(BATALHA_ATUAL_ID, h.id, h.cooldown_turnos);
  }
  
  // Emitir evento
  HUB_EVENTS.emit('dano_aplicado', {
    atacante: atacanteNome,
    alvo: alvo,
    valor: resultado.total,
    tipo: h.tipo_dano || 'fisico'
  });
  
  HUB_EVENTS.emit('habilidade_usada', {
    personagem: atacanteNome,
    habilidade: h.nome,
    alvo: alvo
  });
  
  // Resetar state
  state.step = 1;
  state.habilidadeSel = null;
  state.alvoNome = null;
  state.dadosRolados = null;
  
  mostrarToast(`⚔ ${atacanteNome} atacou ${alvo} causando ${resultado.total} de dano!`, 'sucesso');
  _mesaRenderAcoes();
};

function _mesaAtaqueInlineGetAlvos(atacanteNome, habilidade) {
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs) return [];
  
  const atacante = bs.participantes.find(p => p.nome === atacanteNome);
  if (!atacante) return [];
  
  // Filtrar inimigos (lado oposto)
  const alvos = bs.participantes
    .filter(p => p.nome !== atacanteNome && p.lado !== atacante.lado)
    .map(p => {
      const distancia = _calcularDistanciaTokens(atacante, p);
      return {
        nome: p.nome,
        cor: p.cor,
        distancia: distancia
      };
    });
  
  return alvos;
}

function _calcularDistanciaTokens(token1, token2) {
  if (!token1.posicao || !token2.posicao) return null;
  const dx = Math.abs(token1.posicao.col - token2.posicao.col);
  const dy = Math.abs(token1.posicao.row - token2.posicao.row);
  return Math.max(dx, dy); // Distância Chebyshev (tabuleiro quadrado)
}

// ── Funções auxiliares de dano ────────────────────────────────────────────
function calcularRangeDano(formula) {
  if (!formula || formula === '—') return { min: 0, max: 0 };
  
  const match = formula.match(/(\d+)d(\d+)/);
  if (!match) return { min: 0, max: 0 };
  
  const qtd = parseInt(match[1]);
  const faces = parseInt(match[2]);
  
  return {
    min: qtd,
    max: qtd * faces
  };
}

function calcModAtributo(habilidade, charNome, contexto) {
  if (!habilidade.atributo_base) return 0;
  
  const char = contexto === 'arena' 
    ? AR.personagens?.find(p => p.nome === charNome)
    : RPG_DATA?.characters?.find(c => c.nome === charNome);
  
  if (!char) return 0;
  
  const attrValue = char.custom_attrs?.[habilidade.atributo_base] || 0;
  return Math.floor((attrValue - 10) / 2); // Modificador D&D padrão
}

function rolarFormulaDano(formula, habilidade, charNome, contexto) {
  const match = formula.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { total: 0, detalhes: 'Fórmula inválida' };
  
  const qtd = parseInt(match[1]);
  const faces = parseInt(match[2]);
  const bonus = match[3] ? parseInt(match[3]) : 0;
  
  const modAttr = calcModAtributo(habilidade, charNome, contexto);
  
  const rolls = [];
  let soma = 0;
  
  for (let i = 0; i < qtd; i++) {
    const valor = Math.floor(Math.random() * faces) + 1;
    rolls.push(valor);
    soma += valor;
  }
  
  const total = soma + bonus + modAttr;
  const detalhes = `${rolls.join(' + ')}${bonus !== 0 ? ` ${bonus > 0 ? '+' : ''}${bonus}` : ''}${modAttr !== 0 ? ` ${modAttr > 0 ? '+' : ''}${modAttr}` : ''}`;
  
  return { total, detalhes, rolls };
}

function getCooldownsBatalhaSeguro(batalhaId) {
  if (typeof getCooldownsBatalha === 'function') {
    return getCooldownsBatalha(batalhaId) || {};
  }
  return {};
}

// ══════════════════════════════════════════════════════════════════════════
// INSTRUÇÕES DE INTEGRAÇÃO
// ══════════════════════════════════════════════════════════════════════════
/*
1. Adicione este arquivo após hub.js no HTML
2. A função _mesaRenderAcoes no hub.js já está preparada para usar _mesaRenderAtaqueInline
3. Certifique-se de que as seguintes funções existem globalmente:
   - atkGetHabilidadesCampanha(charNome)
   - atkVerificarBloqueioAtaque(charNome, tipoDano)
   - aplicarDanoBatalha(batalhaId, alvo, valor, tipo)
   - setCooldownBatalha(batalhaId, habId, turnos)
   - getCooldownsBatalha(batalhaId)
   
4. Variáveis globais necessárias:
   - BATALHA_ATUAL_ID
   - MAPA_STATE
   - RPG_DATA
   - HUB_EVENTS
*/
