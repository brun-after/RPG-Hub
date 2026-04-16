// hub/hub.js
// RPG Hub — Campaign hub: RPG list, table 3-column mode, feed, notifications, iniciarApp()
// Includes: renderRPGList(), mesaModoVerificar(), iniciarApp(), voltarHub()




// ════════════════════════════════════════════════════════════════════════════
// FASE 5 — INTERFACE DA MESA
// ════════════════════════════════════════════════════════════════════════════

// ── 5.1 Modo Mesa 3 colunas ───────────────────────────────────────────────
function mesaModoVerificar() {
  const mapaEl = document.getElementById('tab-mapas');
  if (!mapaEl) return;
  if (window.innerWidth > 1100) {
    if (!document.getElementById('mesa-layout-css')) {
      const style = document.createElement('style');
      style.id = 'mesa-layout-css';
      style.textContent = '@media (min-width:1101px){' +
        '#tab-mapas.mesa-ativo.active{display:grid!important;grid-template-columns:250px 1fr 300px;grid-template-rows:1fr;height:calc(100dvh - 108px);overflow:hidden}' +
        '#mesa-col-esq{grid-column:1;grid-row:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:0;border-right:1px solid var(--borda);background:var(--painel)}' +
        '#mesa-col-centro{grid-column:2;grid-row:1;display:flex;flex-direction:column;overflow:hidden}' +
        '#mesa-col-dir{grid-column:3;grid-row:1;display:flex;flex-direction:column;overflow:hidden;border-left:1px solid var(--borda);background:var(--painel)}' +
        '#mesa-barra-acoes{display:none}' +
        '#barra-contexto-mestre{display:flex!important}' +
        '}';
      document.head.appendChild(style);
    }
    mapaEl.classList.add('mesa-ativo');
    mapaEl.classList.remove('layout-2col');
    _mesaInjetarColunas();
    _mesaRenderizarColunas();
  } else {
    mapaEl.classList.remove('mesa-ativo');
  }
}

function _mesaInjetarColunas() {
  if (document.getElementById('mesa-col-esq')) return;
  const mapaEl = document.getElementById('tab-mapas');
  if (!mapaEl) return;

  const colEsq = document.createElement('div');
  colEsq.id = 'mesa-col-esq';
  const hdrEsq = '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px">Personagens</div>';
  const hdrIni = '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:4px 8px 4px;border-top:1px solid var(--borda);margin-top:4px">Iniciativa</div>';
  colEsq.innerHTML = hdrEsq + '<div id="mesa-chars-lista" style="padding:0 8px"></div>' + hdrIni + '<div id="mesa-iniciativa-lista" style="padding:0 8px 8px"></div>';

  const mapaStatus = document.getElementById('mapa-status');
  if (mapaStatus) {
    mapaStatus.style.marginTop = '0';
    mapaStatus.style.padding = '0 8px 8px';
    colEsq.appendChild(mapaStatus);
  }

  const colCentro = document.createElement('div');
  colCentro.id = 'mesa-col-centro';

  const colDir = document.createElement('div');
  colDir.id = 'mesa-col-dir';
  colDir.innerHTML =
    '<div style="flex-shrink:0;padding:8px 8px 4px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Feed</div>' +
      '<div id="mesa-feed-lista" style="display:flex;flex-direction:column;gap:3px;font-size:0.62rem;max-height:110px;overflow:hidden"></div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;overflow-x:hidden;border-top:1px solid var(--borda);display:flex;flex-direction:column" id="mesa-acao-col">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px;flex-shrink:0">Ações</div>' +
      '<div id="mesa-acao-painel" style="flex:1;overflow-y:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:6px"></div>' +
    '</div>';

  const barraAcoes = document.createElement('div');
  barraAcoes.id = 'mesa-barra-acoes';
  barraAcoes.style.display = 'none';
  barraAcoes.innerHTML = '<div id="mesa-barra-skills"></div>';

  const elementosParaMover = ['mapa-breadcrumb','mapa-lista','mapa-toolbar','mapa-wrap'];
  elementosParaMover.forEach(id => {
    const el = document.getElementById(id);
    if (el && mapaEl.contains(el) && !el.closest('#mesa-col-centro')) colCentro.appendChild(el);
  });

  const idsParaDir = [
    'batalhas-selector','mapa-batalha-bar','mapa-batalha-btn','mapa-batalha-outro',
    'criativos-mestre-wrap','sessao-painel','criativo-mapa-bar','atk-criativo-aprovado-mapa',
    'atk-painel-campanha-anchor','rpg-load-status'
  ];
  idsParaDir.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.marginTop = '0';
      const acaoPainel = colDir.querySelector('#mesa-acao-painel');
      if (acaoPainel) acaoPainel.appendChild(el);
    }
  });

  mapaEl.insertBefore(barraAcoes, mapaEl.firstChild);
  mapaEl.insertBefore(colDir, mapaEl.firstChild);
  mapaEl.insertBefore(colCentro, mapaEl.firstChild);
  mapaEl.insertBefore(colEsq, mapaEl.firstChild);
}

function _mesaRenderizarColunas() { _mesaRenderChars(); _mesaRenderIniciativa(); _mesaRenderAcoes(); }

function _mesaRenderChars() {
  const el = document.getElementById('mesa-chars-lista');
  if (el) el.innerHTML = '';
  if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
}

function _mesaRenderIniciativa() {
  const el = document.getElementById('mesa-iniciativa-lista');
  if (!el) return;
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs?.participantes?.length) { el.innerHTML = '<div style="font-size:0.62rem;color:var(--suave);font-style:italic;padding:4px 0">Sem batalha ativa</div>'; return; }
  el.innerHTML = bs.participantes.map((p,i) => {
    const isAtual = i === bs.ordemAtual;
    const nomeEnc = encodeURIComponent(p.nome);
    return '<div onclick="selecionarAlvoLista(\'' + nomeEnc + '\')" style="padding:4px 7px;border-radius:6px;border:1px solid '+(isAtual?p.cor+'88':'var(--borda)')+';background:'+(isAtual?p.cor+'18':'transparent')+';display:flex;align-items:center;gap:6px;margin-bottom:3px;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\''+(p.cor||'#7ec8f0')+'22\'" onmouseout="this.style.background=\''+(isAtual?p.cor+'18':'transparent')+'\'"><div style="width:7px;height:7px;border-radius:50%;background:'+p.cor+';flex-shrink:0"></div><span style="font-size:0.65rem;font-family:var(--fonte-d);color:'+(isAtual?p.cor:'var(--suave)')+';flex:1">'+p.nome+'</span>'+(isAtual?'<span style="font-size:0.6rem;color:var(--destaque)">▶</span>':'')+'</div>';
  }).join('');
}

function _mesaRenderBarraSkills() { _mesaRenderAcoes(); }

function _mesaRenderAcoes() {
  const painel = document.getElementById('mesa-acao-painel');
  if (!painel) return;

  const bs       = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const mapId    = MAPA_STATE?.mapaAtualId;
  const meuChar  = RPG_DATA?.linked || null;
  const sections = [];

  if (bs && (bs.fase === 'iniciativa' || bs.fase === 'empate')) {
    const jaRolei = meuChar && bs.iniciativasRoladas?.[meuChar] != null;
    const pendentes = bs.participantes?.filter(p => bs.iniciativasRoladas?.[p.nome] == null) || [];
    sections.push(
      '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--destaque);margin-bottom:6px">' +
      (bs.fase === 'empate' ? '⚠ Empate — re-role' : '🎲 Iniciativa') + '</div>' +
      bs.participantes.map(p => {
        const val = bs.iniciativasRoladas?.[p.nome];
        return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + (p.cor||'#7ec8f0') + ';flex-shrink:0"></div>' +
          '<span style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--texto);flex:1">' + p.nome + '</span>' +
          (val != null ? '<span style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--destaque)">' + val + '</span>' : '<span style="font-size:0.6rem;color:var(--suave)">aguardando…</span>') +
          '</div>';
      }).join('') +
      (!jaRolei || bs.fase === 'empate' ?
        '<button onclick="abrirModalIniciativa()" style="width:100%;margin-top:8px;padding:11px;background:rgba(79,163,209,0.12);border:1px solid rgba(79,163,209,0.35);border-radius:8px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em">🎲 Rolar Iniciativa (d20)</button>' :
        '<div style="text-align:center;font-size:0.65rem;color:var(--suave);margin-top:6px;font-style:italic">✓ Aguardando outros jogadores…</div>') +
      (isMestre && pendentes.length ?
        '<button onclick="abrirModalIniciativa()" style="width:100%;margin-top:5px;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer">Rolar por pendentes (' + pendentes.length + ')</button>' : '')
    );
  }

  if (bs?.fase === 'combate') {
    const atual       = bs.participantes?.[bs.ordemAtual];
    const nomeAtual   = atual?.nome || null;
    const isMinhaVez  = nomeAtual && (isMestre || nomeAtual === meuChar);
    const charAtivo   = nomeAtual || window.TOKEN_CTRL?.nomeSelecionado || meuChar;

    sections.push('<div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Vez de</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.85rem;color:' + (atual?.cor||'var(--destaque)') + ';margin-bottom:8px">' + (nomeAtual||'—') + '</div>');

  if (isMinhaVez) {
    const habs = typeof atkGetHabilidadesCampanha === 'function' ? atkGetHabilidadesCampanha(nomeAtual) : [];
    if (habs.length) {
      // Abrir modal de ataque (será renderizado inline pelo wrapper)
      const modal = document.getElementById('modal-ataque');
      
      // Verificar se modal já está aberto para este atacante
      if (!modal || modal.style.display === 'none' || COMBATE.atacanteNome !== nomeAtual) {
        // Abre o modal que será automaticamente movido para o painel pelo wrapper
        abrirModalAtaque(nomeAtual, 'campanha');
      }
      // Modal já está renderizado no painel - não adiciona sections aqui
    }
    
    // Botões de ação criativa e pular (sempre mostrar quando é minha vez)
    sections.push(
      '<div style="display:flex;gap:5px;margin-top:4px">' +
      '<button onclick="abrirModalAcao(&quot;' + (nomeAtual||'').replace(/"/g,'&quot;') + '&quot;)" style="flex:1;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:7px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✨ Criativa</button>' +
      '<button onclick="batalhaPassarVez()" style="padding:8px 12px;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-radius:7px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">→ Pular</button>' +
      '</div>');
  } else if (isMestre) {
      sections.push(
        '<div style="display:flex;gap:5px;margin-top:4px">' +
        '<button onclick="batalhaJogarPorOffline()" style="flex:1;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:7px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">🎮 Jogar por ele</button>' +
        '<button onclick="batalhaPassarVez()" style="padding:8px 12px;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-radius:7px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">→ Pular</button>' +
        '</div>');
      const habsM = typeof atkGetHabilidadesCampanha === 'function' ? atkGetHabilidadesCampanha(nomeAtual) : [];
      if (habsM.length) {
        sections.push(
          '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;margin-bottom:3px">Atacar por ' + nomeAtual + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:3px">' +
          habsM.slice(0,4).map(h =>
            '<button onclick="_mesaAtacarHab(this)" data-char="' + encodeURIComponent(nomeAtual||'') + '" data-hab="' + encodeURIComponent(JSON.stringify(h)) + '" style="padding:6px 9px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.2);border-radius:7px;color:#e8604c;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-align:left">' + h.nome + '</button>'
          ).join('') + '</div>');
      }
    }

    if (charAtivo && mapId && typeof ctxGerarBotoes === 'function') {
      const botoes = ctxGerarBotoes(charAtivo, mapId);
      if (botoes.length) {
        const { visiveis, ocultos } = typeof ctxPriorizar === 'function' ? ctxPriorizar(botoes) : { visiveis: botoes, ocultos: [] };
        sections.push('<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">⚡ Ações posicionais</div>' +
          '<div style="display:flex;flex-direction:column;gap:3px">' +
          visiveis.map(b =>
            '<button onclick="ctxExecutarAcao(' + JSON.stringify(b).replace(/"/g,"'") + ')" style="padding:6px 9px;background:rgba(79,163,209,0.07);border:1px solid rgba(79,163,209,0.2);border-radius:7px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-align:left">' +
            b.label + '</button>'
          ).join('') +
          (ocultos.length ? '<button onclick="ctxMostrarOcultos(' + JSON.stringify(ocultos).replace(/"/g,"'") + ')" style="padding:4px;background:none;border:1px dashed rgba(79,163,209,0.2);border-radius:7px;color:rgba(79,163,209,0.5);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer">+' + ocultos.length + '</button>' : '') +
          '</div>');
      }
    }
  }

  if (!bs) {
    if (isMestre && mapId) {
      sections.push('<button onclick="abrirModalIniciarBatalha()" style="width:100%;padding:10px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.22);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer;text-transform:uppercase;letter-spacing:.08em">⚔ Iniciar Batalha</button>');
    }
    const charAtivo = window.TOKEN_CTRL?.nomeSelecionado || meuChar;
    if (charAtivo && mapId && typeof ctxGerarBotoes === 'function') {
      const botoes = ctxGerarBotoes(charAtivo, mapId).filter(b => b.acao !== 'usar_skill');
      if (botoes.length) {
        const { visiveis, ocultos } = typeof ctxPriorizar === 'function' ? ctxPriorizar(botoes) : { visiveis: botoes, ocultos: [] };
        sections.push('<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;margin-bottom:3px">⚡ Interações</div>' +
          visiveis.map(b =>
            '<button onclick="ctxExecutarAcao(' + JSON.stringify(b).replace(/"/g,"'") + ')" style="width:100%;padding:7px 10px;background:rgba(79,163,209,0.07);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-align:left;margin-bottom:3px">' +
            b.label + '</button>'
          ).join('') +
          (ocultos.length ? '<button onclick="ctxMostrarOcultos(' + JSON.stringify(ocultos).replace(/"/g,"'") + ')" style="width:100%;padding:4px;background:none;border:1px dashed rgba(79,163,209,0.2);border-radius:7px;color:rgba(79,163,209,0.5);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer">+' + ocultos.length + ' mais</button>' : ''));
      }
    }
  }

  let aprovacoesPendentes = false;
  if (isMestre) {
    const pendentes = (typeof CRIATIVOS_CAMP !== 'undefined' ? CRIATIVOS_CAMP : [])
      .filter(c => ['pendente','dc_rolado_sucesso','aprovado_dc','aprovado_aguardando_rolagem'].includes(c.status));
    aprovacoesPendentes = pendentes.length > 0;
    if (pendentes.length) {
      sections.push('<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(200,168,75,0.8);text-transform:uppercase;margin-bottom:4px">📋 Pendentes (' + pendentes.length + ')</div>' +
        '<button onclick="scrollToPendingApprovals()" style="width:100%;padding:7px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\'rgba(200,168,75,0.15)\'" onmouseout="this.style.background=\'rgba(200,168,75,0.08)\'">Ver aprovações pendentes</button>');
      sections.push('<div id="criativos-mestre-wrap"></div>');
    }
    if (bs) {
      sections.push('<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(192,57,43,0.7);text-transform:uppercase;margin-bottom:4px;margin-top:8px">⚔ Controles de Batalha</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button onclick="pausarOuRetomarBatalha()" style="flex:1;padding:7px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">⏸ Pausar</button>' +
        '<button onclick="encerrarBatalha()" style="flex:1;padding:7px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.2);border-radius:6px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✕ Encerrar</button>' +
        '</div>');
    }
  }

  painel.innerHTML = sections.length
    ? sections.join('<div style="height:1px;background:rgba(255,255,255,0.06);margin:6px 0"></div>')
    : '<div style="font-size:0.65rem;color:var(--suave);font-style:italic;text-align:center;padding:12px 0">Selecione um personagem ou inicie uma batalha</div>';

  if (aprovacoesPendentes) {
    setTimeout(() => {
      if (typeof criativoRenderMestre === 'function') criativoRenderMestre();
    }, 50);
  }
}

function _mesaAtacarHab(btn) {
  const charNome = decodeURIComponent(btn.dataset.char || '');
  const h = JSON.parse(decodeURIComponent(btn.dataset.hab || '{}'));
  if (!charNome || !h.id) return;
  COMBATE.atacanteNome = charNome;
  COMBATE.habilidadeSel = h;
  mapaAtaqueIniciar(charNome);
}

window.addEventListener('resize', () => {
  if (document.getElementById('tab-mapas')?.classList.contains('active')) {
    mesaModoVerificar(); _mesaRenderizarColunas();
  }
  if (MAPA_STATE?.mapaAtualId) {
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
    if (entry && typeof mapaIsTatico === 'function' && mapaIsTatico(entry.mapa)) {
      setTimeout(() => mapaRenderCanvas(entry.mapa), 50);
    }
  }
});

HUB_EVENTS.on('turno_avancou', () => { _mesaRenderIniciativa(); _mesaRenderAcoes?.(); if(typeof _atualizarZonaDireita === 'function' && MOBILE_CTRL?.ativo) _atualizarZonaDireita(); });
HUB_EVENTS.on('dano_aplicado', () => { _mesaRenderChars(); if (typeof mapaRenderStatus === 'function') mapaRenderStatus(); });
HUB_EVENTS.on('cura_aplicada', () => { _mesaRenderChars(); if (typeof mapaRenderStatus === 'function') mapaRenderStatus(); });
HUB_EVENTS.on('token_selecionado', () => _mesaRenderAcoes?.());

// ── 5.2 Feed da mesa ──────────────────────────────────────────────────────
const FEED_MESA = { entradas: [], maxEntradas: 200 };

function feedAdicionarEntrada(texto, tipo, personagem) {
  FEED_MESA.entradas.unshift({ ts: Date.now(), texto, tipo: tipo||'info', personagem: personagem||null });
  if (FEED_MESA.entradas.length > FEED_MESA.maxEntradas) FEED_MESA.entradas = FEED_MESA.entradas.slice(0, FEED_MESA.maxEntradas);
  feedRenderizar();
}

function feedRenderizar() {
  const el = document.getElementById('mesa-feed-lista');
  if (!el) return;
  const corTipo = { dano:'#e74c3c', cura:'#5ee09a', turno:'#f0cc6a', movimento:'#7ec8f0', item:'#b07ef0', cena:'#c8a84b', info:'rgba(255,255,255,0.4)' };
  el.innerHTML = FEED_MESA.entradas.slice(0,40).map(e => {
    const cor  = corTipo[e.tipo]||corTipo.info;
    const hora = new Date(e.ts).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    return '<div style="padding:3px 6px;border-left:2px solid '+cor+';border-radius:0 5px 5px 0;background:rgba(255,255,255,0.02);line-height:1.4"><span style="color:'+cor+';font-size:0.58rem">'+hora+'</span><span style="color:rgba(255,255,255,0.7);font-size:0.62rem;margin-left:4px">'+e.texto+'</span></div>';
  }).join('');
}

HUB_EVENTS.on('dano_aplicado', ({ atacante, alvo, valor, tipo }) => feedAdicionarEntrada(atacante+' → '+alvo+': '+valor+' de dano', 'dano', atacante));
HUB_EVENTS.on('cura_aplicada', ({ origem, alvo, valor })          => feedAdicionarEntrada(origem+' curou '+alvo+': +'+valor+' HP', 'cura', origem));
HUB_EVENTS.on('turno_avancou', ({ personagem, rodada })           => feedAdicionarEntrada('Vez de '+personagem+' (rodada '+(rodada||1)+')', 'turno'));
HUB_EVENTS.on('token_moveu',   ({ nome, paraCelula })             => { if (!paraCelula) return; const col=String.fromCharCode(65+(paraCelula.col||0)),row=(paraCelula.row||0)+1; feedAdicionarEntrada(nome+' moveu para '+col+row, 'movimento', nome); });
HUB_EVENTS.on('habilidade_usada', ({ personagem, habilidade, alvo }) => feedAdicionarEntrada(personagem+' usou '+habilidade+(alvo?' em '+alvo:''), 'info', personagem));
HUB_EVENTS.on('zona_ativada',  ({ zona, personagem })             => feedAdicionarEntrada((personagem||'Grupo')+' ativou zona: '+zona, 'cena'));
HUB_EVENTS.on('cena_carregada',({ nome, narracao })               => feedAdicionarEntrada('📖 Cena: '+nome+(narracao?' — "'+narracao.slice(0,50)+(narracao.length>50?'…':'"'):''), 'cena'));
HUB_EVENTS.on('item_usado',    ({ personagem, item, efeito, aprovacao }) => feedAdicionarEntrada(personagem+' usou '+item+(efeito?' — '+efeito:'')+(aprovacao==='auto'?'':' (aprovação pendente)'), 'item', personagem));

// ── 5.3 Barra de contexto mestre/narrador ────────────────────────────────
function barraContextoInicializar() {
  if (document.getElementById('barra-contexto-mestre')) return;
  if (RPG_DATA?.myRole !== 'mestre') return;
  const barra = document.createElement('div');
  barra.id = 'barra-contexto-mestre';
  barra.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:7500;height:32px;padding:0 16px;background:rgba(5,8,16,0.95);border-bottom:1px solid var(--borda);align-items:center;justify-content:space-between;gap:12px;font-family:var(--fonte-d);font-size:0.65rem;backdrop-filter:blur(6px)';
  barra.innerHTML = '<span id="ctx-papel" style="color:var(--texto)">🎭 Modo Mestre</span><div style="display:flex;gap:8px"><button id="ctx-btn-avancar" onclick="_barraContextoAvancar()" style="padding:3px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-size:0.58rem;cursor:pointer">→</button><button id="mapa-camera-btn" onclick="mapaToggleModoCamera()" style="padding:3px 10px;background:transparent;border:1px solid var(--borda);border-radius:5px;color:var(--suave);font-size:0.58rem;cursor:pointer">📷 Auto</button></div>';
  document.body.appendChild(barra);
}

function barraContextoAtualizar(personagem) {
  const barra = document.getElementById('barra-contexto-mestre');
  if (!barra || RPG_DATA?.myRole !== 'mestre') return;
  barra.style.display = 'flex';
  const papelEl = document.getElementById('ctx-papel');
  const btnAv   = document.getElementById('ctx-btn-avancar');
  if (!papelEl) return;
  const vinculado = RPG_DATA?.linked;
  const ehMeu = personagem && personagem === vinculado;
  papelEl.textContent = ehMeu ? '⚔ Atuando como '+personagem : personagem ? '🎭 Mestre — vez de '+personagem : '🎭 Modo Mestre';
  papelEl.style.color = ehMeu ? (RPG_DATA?.characters?.find(c=>c.nome===personagem)?.custom_attrs?.cor||'var(--destaque)') : 'var(--suave)';
  if (btnAv) btnAv.textContent = ehMeu ? 'Passar NPC →' : (vinculado ? '← '+vinculado : '—');
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.paddingTop = '32px';
}

window._barraContextoAvancar = function() { if (typeof batalhaPassarVez === 'function') batalhaPassarVez(); };
HUB_EVENTS.on('turno_avancou', ({ personagem }) => barraContextoAtualizar(personagem));

// ── 5.4 Painel de notificações ────────────────────────────────────────────
const NOTIFICACOES = { fila: [] };

function notifAdicionar({ tipo, prioridade, titulo, descricao, acao, dados }) {
  const notif = { id:'notif_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), tipo:tipo||'info', prioridade:prioridade||'media', titulo:titulo||'', descricao:descricao||'', acao:acao||null, dados:dados||{}, ts:Date.now() };
  if (notif.prioridade === 'baixa') {
    const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
    if (bs?.fase === 'combate' && !bs?.pausada) notif._adiada = true;
  }
  NOTIFICACOES.fila.unshift(notif); notifRenderizar();
}

function notifRenderizar() {
  let painel = document.getElementById('notif-painel');
  if (!painel) {
    painel = document.createElement('div');
    painel.id = 'notif-painel';
    painel.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:9200;display:flex;flex-direction:column;gap:6px;max-width:280px;pointer-events:auto';
    document.body.appendChild(painel);
  }
  const visiveis = NOTIFICACOES.fila.filter(n => !n._adiada && !n._resolvida);
  if (!visiveis.length) { painel.innerHTML = ''; return; }
  const corP = { alta:'#e74c3c', media:'#f0cc6a', baixa:'rgba(122,146,170,0.7)' };
  painel.innerHTML = visiveis.slice(0,5).map(n => {
    const cor = corP[n.prioridade]||'var(--borda)';
    const pulso = n.prioridade==='alta'?'animation:notifPulso 1.2s ease-in-out infinite;':'';
    return '<div id="'+n.id+'" style="'+pulso+'background:var(--painel,#141d2b);border:1px solid '+cor+';border-left:3px solid '+cor+';border-radius:9px;padding:8px 10px;cursor:pointer" onclick="notifExpandir(\'' + n.id + '\')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px"><div style="flex:1;min-width:0"><div style="font-family:var(--fonte-d);font-size:0.68rem;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+n.titulo+'</div>'+(n.descricao?'<div style="font-size:0.6rem;color:var(--suave);margin-top:2px">'+n.descricao+'</div>':'')+'</div><button onclick="event.stopPropagation();notifDismiss(\'' + n.id + '\')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.8rem;flex-shrink:0;padding:0;line-height:1">✕</button></div>'+(n.acao?'<div style="margin-top:6px"><button onclick="event.stopPropagation();notifExecutar(\'' + n.id + '\')" style="padding:4px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer">'+(n.acao.label||'Resolver')+'</button></div>':'')+'</div>';
  }).join('');
}

window.notifDismiss  = id => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(n) n._resolvida=true; notifRenderizar(); };
window.notifExpandir = id => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(n?.acao) notifExecutar(id); };
window.notifExecutar = id => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(!n?.acao) return; if(typeof n.acao.fn==='function') n.acao.fn(n.dados); n._resolvida=true; notifRenderizar(); };

HUB_EVENTS.on('turno_avancou', () => { NOTIFICACOES.fila.forEach(n => { if(n._adiada) n._adiada=false; }); notifRenderizar(); });
(function(){ const s=document.createElement('style'); s.textContent='@keyframes notifPulso{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.4)}50%{box-shadow:0 0 0 6px rgba(231,76,60,0)}}'; document.head.appendChild(s); })();

// ── 5.5 Wrap combateBroadcast → HUB_EVENTS ───────────────────────────────
const _origCombateBroadcast5 = combateBroadcast;
window.combateBroadcast = function(tipo, dados) {
  _origCombateBroadcast5(tipo, dados);
  switch(tipo) {
    case 'ataque_executado':
      HUB_EVENTS.emit('dano_aplicado', { atacante: dados.atacante||'?', alvo: dados.alvo||'?', valor: dados.dano||0, tipo: dados.tipo_dano||'fisico' });
      if (dados.habilidade) HUB_EVENTS.emit('habilidade_usada', { personagem: dados.atacante, habilidade: dados.habilidade, alvo: dados.alvo });
      break;
    case 'batalha_criada':   HUB_EVENTS.emit('batalha_iniciada',  { mapa_id: dados.batalhaId }); break;
    case 'batalha_encerrada':HUB_EVENTS.emit('batalha_encerrada', { mapa_id: dados.batalhaId, resultado: dados.resultado }); break;
  }
};

async function entrarRPG(rpgId){
 salvarNav('rpg', rpgId);
 MAPA_STATE.mapaAtualId = null;
 MAPA_STATE.mapaGeralId = null;
 MAPA_STATE.toolMode = null;
 MAPA_STATE.medicaoAtiva = null;
 const meta=HUB_DATA.rpgs.find(r=>r.rpg_id===rpgId); if(!meta)return;
 const theme = meta.theme_json || {};
 CURRENT_RPG={...meta,id:rpgId,theme};
 aplicarTema(CURRENT_RPG); mostrarLoading(CURRENT_RPG);
 try{
   RPG_DATA=await getRPGData(rpgId);
   if(SESSION?.user?.id){
     try{
       const m=await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&player_id=eq.${SESSION.user.id}&select=role,linked,permissoes&limit=1`);
       if(m&&m[0]){
         RPG_DATA.myRole=m[0].role;
         RPG_DATA.myPermissoes=m[0].permissoes||{};
         if(m[0].linked){ RPG_DATA.linked=m[0].linked; CHAR_VIEW=m[0].linked; ATTR_VIEW=CHAR_VIEW; CFG_CHAR=CHAR_VIEW; }
       } else {
         const isOwner=CURRENT_RPG?.owner_id===SESSION.user.id;
         if(isOwner){
           try{ await sb('rpg_members',{method:'POST',body:JSON.stringify({rpg_id:rpgId,player_id:SESSION.user.id,nickname:SESSION.nickname||SESSION.user.email,role:'mestre',permissoes:{}})}); }catch(e){}
           RPG_DATA.myRole='mestre'; RPG_DATA.myPermissoes={};
         } else { RPG_DATA.myRole='jogador'; RPG_DATA.myPermissoes={}; }
       }
     }catch(err){ console.error('[RPG] role:',err); RPG_DATA.myRole='jogador'; RPG_DATA.myPermissoes={}; }
   } else { RPG_DATA.myRole='mestre'; RPG_DATA.myPermissoes={}; }
   const isMestre=RPG_DATA.myRole==='mestre';
   document.querySelectorAll('[data-mestre-only]').forEach(el=>el.style.display=isMestre?'':'none');
   renderHeader(); renderLore(); renderCharButtons(); renderAttrButtons();
   if (typeof renderDados === 'function') renderDados();
   renderConfig();
   if (typeof renderMapasTab === 'function') renderMapasTab();
   try{mostrarApp(CURRENT_RPG);}catch(e2){}
   ocultarLoading();
   const savedTab=localStorage.getItem('rpghub_tab_'+rpgId);
   if(savedTab){
     const btn=document.querySelector(`.tab-btn[onclick*="'${savedTab}'"]`);
     const el=document.getElementById('tab-'+savedTab);
     if(btn&&el){ document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); btn.classList.add('active'); }
   }
   iniciarRealtime(rpgId);
   chatMostrar(rpgId);
   _carregarProgressivo(rpgId);
 }catch(e){ocultarLoading();mostrarToast('Erro ao carregar RPG: '+(e?.message||e),'erro');console.error('[RPG Hub] entrarRPG erro:', e);}
}

// ── Inicializar sistemas das fases ao entrar na campanha ────────────────
const _origEntrarRPGF5 = entrarRPG;
window.entrarRPG = async function(rpgId) {
  await _origEntrarRPGF5(rpgId);
  setTimeout(() => {
    mesaModoVerificar();
    barraContextoInicializar();
    if (typeof bibliotecaCarregarDoLore   === 'function') bibliotecaCarregarDoLore();
    if (typeof sessionRenderPainel        === 'function') sessionRenderPainel();
    if (typeof _atualizarBannerControleMobile === 'function') _atualizarBannerControleMobile();
    if (typeof desbloquearOrientacaoPWA   === 'function') desbloquearOrientacaoPWA();
    if (typeof inicializarSistemaAprovacoes === 'function') inicializarSistemaAprovacoes();
  }, 800);
};

function aplicarTema(rpg){
 const t=rpg.theme||{}, root=document.documentElement;
 const s=(k,v,d)=>root.style.setProperty(k,t[v]||d);
 s('--preto','preto','#080c10');s('--escuro','escuro','#0f1520');s('--painel','painel','#141d2b');
 s('--borda','borda','#1e2d42');s('--cinza','cinza','#2a3a50');s('--texto','texto','#c8d8e8');
 s('--suave','suave','#7a92aa');s('--primario','primario','#4fa3d1');s('--primario-v','primario_v','#7ec8f0');
 s('--destaque','destaque','#c8a84b');s('--destaque-v','destaque_v','#f0cc6a');
 s('--perigo','perigo','#c0392b');s('--sucesso','sucesso','#27ae60');s('--especial','especial','#7b2fbe');
 const fd = t.font_display || t.fontTitulo;
 const ft = t.font_text   || t.fontCorpo;
 const fu = t.font_url;
 if(fd) root.style.setProperty('--fonte-d',`'${fd}',serif`);
 if(ft) root.style.setProperty('--fonte-t',`'${ft}',serif`);
 if(fu){let l=document.getElementById('rpg-fonts');if(!l){l=document.createElement('link');l.id='rpg-fonts';l.rel='stylesheet';document.head.appendChild(l);}l.href=fu;}
 document.body.style.background='var(--preto)';
}

let LOADING_START=0;

function mostrarLoading(rpg){
 LOADING_START=Date.now();
 document.getElementById('hub').style.display='none';
 if (rpg.theme && rpg.theme.animation_css) injectCustomCSS(rpg.id, rpg.theme.animation_css);
 const customLoading = (rpg.theme && rpg.theme.animation_loading_svg) || '';
 document.getElementById('loading-anim').innerHTML = getLoadingAnimSVG(rpg.theme?.animation||rpg.animation||'flame', customLoading);
 document.getElementById('loading-title').textContent=rpg.name;
 document.getElementById('loading').classList.add('visible');
 const el = document.getElementById('loading');
 let escBtn = document.getElementById('loading-esc-btn');
 if (!escBtn) {
   escBtn = document.createElement('button');
   escBtn.id = 'loading-esc-btn';
   escBtn.textContent = '← Voltar ao Hub';
   escBtn.style.cssText = 'display:none;margin-top:8px;padding:8px 20px;background:transparent;border:1px solid rgba(200,168,75,0.3);border-radius:8px;color:rgba(200,168,75,0.6);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s';
   escBtn.onmouseenter = () => { escBtn.style.borderColor='rgba(200,168,75,0.7)'; escBtn.style.color='rgba(200,168,75,1)'; };
   escBtn.onmouseleave = () => { escBtn.style.borderColor='rgba(200,168,75,0.3)'; escBtn.style.color='rgba(200,168,75,0.6)'; };
   escBtn.onclick = loadingEscapar;
   el.appendChild(escBtn);
 }
 escBtn.style.display = 'none';
 clearTimeout(window._loadingEscTimer);
 clearTimeout(window._loadingMaxTimer);
 window._loadingEscTimer = setTimeout(() => { if (escBtn) escBtn.style.display = 'block'; }, 3000);
 window._loadingMaxTimer = setTimeout(() => {
   mostrarToast('Tempo limite excedido. Verifique sua conexão.', 'erro');
   loadingEscapar();
 }, 20000);
}

function loadingEscapar() {
 clearTimeout(window._loadingEscTimer);
 clearTimeout(window._loadingMaxTimer);
 clearTimeout(window._loadingFadeTimer);
 clearTimeout(window._loadingHideTimer);
 const el = document.getElementById('loading');
 if (el) { el.classList.remove('visible'); el.style.opacity='1'; el.style.transition=''; }
 const criar = document.getElementById('criar-screen');
 if (criar) criar.classList.remove('visible');
 document.getElementById('hub').style.display='';
 document.getElementById('app')?.classList.remove('visible');
 typeof fecharRealtime === 'function' && fecharRealtime();
}

function ocultarLoading(){
 clearTimeout(window._loadingEscTimer);
 clearTimeout(window._loadingMaxTimer);
 clearTimeout(window._loadingFadeTimer);
 clearTimeout(window._loadingHideTimer);
 const elapsed=Date.now()-LOADING_START;
 const delay=Math.max(0,2500-elapsed);
 window._loadingFadeTimer=setTimeout(()=>{
   const el=document.getElementById('loading');
   if(!el)return;
   el.style.opacity='0';el.style.transition='opacity 0.5s';
   window._loadingHideTimer=setTimeout(()=>{
     el.classList.remove('visible');el.style.opacity='1';el.style.transition='';
     const app=document.getElementById('app');
     const criarAtivo = document.getElementById('criar-screen')?.classList.contains('visible');
     const importAtivo = document.getElementById('import-screen')?.style.display==='block';
     if(app&&!app.classList.contains('visible')&&!importAtivo&&!criarAtivo){
       document.getElementById('hub').style.display='';
     }
   },500);
 },delay);
}

function mostrarApp(rpg){
 document.getElementById('app-logo').textContent=rpg.name;
 document.getElementById('app').classList.add('visible');
 document.getElementById('btn-delete-rpg').style.display=rpg.id==='dual'?'none':'block';
 document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
 document.querySelectorAll('.tab-content').forEach((c,i)=>c.classList.toggle('active',i===0));
 DADO_SEL=null;HISTORICO=[];
}

function voltarHub(){
 chatOcultar();
 localStorage.removeItem('rpghub_nav');
 fecharRealtime();
 document.getElementById('app').classList.remove('visible');
 document.getElementById('hub').style.display='';
 document.querySelectorAll('[data-mestre-only]').forEach(el=>el.style.display='');
 CURRENT_RPG=null;RPG_DATA=null;
 document.documentElement.removeAttribute('style');
 document.body.style.background='';
}

window.selecionarAlvoLista = function(nomeEncodado) {
  const nome = decodeURIComponent(nomeEncodado);
  if (!window.TOKEN_CTRL) window.TOKEN_CTRL = {};
  window.TOKEN_CTRL.nomeSelecionado = nome;
  if (typeof mostrarToast === 'function') mostrarToast(`🎯 Alvo: ${nome}`, 'info');
  if (typeof _mesaRenderAcoes === 'function') _mesaRenderAcoes();
  if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
};

// ── Badge mesa para chat ──────────────────────────────────────────────────
window._atualizarBadgeMesa = function() {
  // Implementação vazia — badge do chat na mesa
  const badge = document.getElementById('chat-badge-mesa');
  if (badge) badge.style.display = 'none';
};

console.log('[Hub] Função selecionarAlvoLista registrada ✓');

//banana

// ════════════════════════════════════════════════════════════════════════════
// MODIFICAÇÕES - INTEGRAÇÃO INLINE DO MODAL DE ATAQUE NO PAINEL DE AÇÕES
// Versão COMPLETA - 100% das funcionalidades do FASE 3 implementadas
// ════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// NOTA: Variáveis globais COMBATE, ATAQUE_MAPA_STATE são declaradas no 
// combat.js e reutilizadas aqui. NÃO redeclarar.
//
// _TRIGGER_CARD_STATE e _AOE_STATE são específicas do hub.js.
// Declaramos aqui apenas se não existirem no combat.js.
// ══════════════════════════════════════════════════════════════════════════

// Declarar _TRIGGER_CARD_STATE apenas se não existir
if (typeof window._TRIGGER_CARD_STATE === 'undefined') {
  window._TRIGGER_CARD_STATE = {
    visible: false,
    countdown: null,
    timerInterval: null
  };
}

// Declarar _AOE_STATE apenas se não existir
if (typeof window._AOE_STATE === 'undefined') {
  window._AOE_STATE = {
    active: false,
    center: null,
    radius: 0
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 2. RENDERIZAÇÃO INLINE NO PAINEL DE AÇÕES
// ══════════════════════════════════════════════════════════════════════════

function _mesaRenderAtaqueInline(atacanteNome, habilidades) {
  // ✅ USA O COMBATE GLOBAL - não cria state separado
  // Se COMBATE não está inicializado para este atacante, inicializa
  if (COMBATE.atacanteNome !== atacanteNome || !COMBATE.contexto) {
    COMBATE.contexto = 'campanha';
    COMBATE.atacanteNome = atacanteNome;
    COMBATE.step = 1;
    COMBATE.habilidadeSel = null;
    COMBATE.alvoNome = null;
    COMBATE.dadosRolados = null;
    COMBATE._habilidades = habilidades;
    COMBATE._jaAplicado = false;
  }
  
  const cooldowns = getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);
  
  // STEP 1: Seleção de habilidade
  if (COMBATE.step === 1) {
    return '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">⚔ Escolha a habilidade</div>' +
      '<div style="font-size:0.68rem;color:#7a6060;margin-bottom:4px">💡 Use teclas 1-9 para selecionar rapidamente</div>' +
      COMBATE._habilidades.slice(0, 9).map((h, idx) => {
        const cd = cooldowns[h.id] || 0;
        const bloqueio = atkVerificarBloqueioAtaque(atacanteNome, h.tipo_dano);
        const disabled = cd > 0 || !!bloqueio;
        
        const corBorda = disabled ? 'rgba(60,40,20,0.6)' : 'rgba(60,30,30,0.6)';
        const corNome = disabled ? '#6a5840' : '#e8604c';
        
        // Número da tecla
        const teclaNum = `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:rgba(126,200,240,0.1);border:1px solid rgba(126,200,240,0.3);color:#7ec8f0;font-size:0.7rem;font-weight:600;margin-right:8px">${idx + 1}</span>`;
        
        // Badge de status/preview
        let badge;
        if (cd > 0) {
          badge = `<span style="font-size:0.65rem;color:#a07040;background:rgba(100,60,0,0.2);border:1px solid rgba(100,60,0,0.3);border-radius:4px;padding:1px 6px">⏳ ${cd}t</span>`;
        } else if (bloqueio) {
          badge = `<span style="font-size:0.65rem;color:#c0392b;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;padding:1px 6px">🚫 Bloq.</span>`;
        } else if (h.formula_dano && h.formula_dano !== '—') {
          const range = calcularRangeDano(h.formula_dano);
          const modAttr = calcModAtributo(h, atacanteNome, 'campanha');
          const minFinal = range.min + modAttr;
          const maxFinal = range.max + modAttr;
          
          const modLabel = modAttr !== 0 
            ? ` <span style="color:#7ec8f0;font-size:0.7rem">${modAttr > 0 ? '+' : ''}${modAttr}(${h.atributo_base})</span>` 
            : '';
          
          badge = `<span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#f0cc6a;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.2);border-radius:4px;padding:1px 7px">
            ${h.formula_dano}${modLabel}
            <span style="font-size:0.65rem;color:#9a8888;margin-left:4px">(${minFinal}-${maxFinal})</span>
          </span>`;
        } else {
          badge = `<span style="font-size:0.7rem;color:#7a6060">Montar dados</span>`;
        }
        
        const cdLabel = h.cooldown_turnos > 0 ? `<span style="font-size:0.68rem;color:#7a6060"> · CD ${h.cooldown_turnos}t</span>` : '';
        const alcanceLabel = h.alcance_celulas != null ? `<span style="font-size:0.68rem;color:#7a6060"> · ⟷ ${h.alcance_celulas}c</span>` : '';
        
        const msgBloqueio = disabled ? (bloqueio || `Habilidade em recarga: ${cd} turno(s)`) : null;
        
        return `<div onclick="${disabled ? `mostrarToast(${JSON.stringify(msgBloqueio)},'erro')` : `atkSelecionarHabilidade(${idx})`}"
          style="padding:12px;background:rgba(20,12,12,0.8);border:1px solid ${corBorda};border-radius:8px;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '0.55' : '1'};transition:all 0.15s"
          ${disabled ? '' : `onmouseenter="this.style.borderColor='rgba(232,80,60,0.4)'" onmouseleave="this.style.borderColor='${corBorda}'"`}>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="display:flex;align-items:center">
              ${teclaNum}
              <span style="font-family:'Cinzel',serif;font-size:0.85rem;color:${corNome}">${h.nome}${cdLabel}${alcanceLabel}</span>
            </div>
            ${badge}
          </div>
          <div style="font-size:0.82rem;color:#9a8888;line-height:1.4">${(h.efeito || '').slice(0, 100)}${(h.efeito || '').length > 100 ? '…' : ''}</div>
        </div>`;
      }).join('') +
      '</div>';
  }
  
  // STEP 2: Seleção de alvo
  if (COMBATE.step === 2 && COMBATE.habilidadeSel) {
    const h = COMBATE.habilidadeSel;
    const alvosDisponiveis = _mesaAtaqueInlineGetAlvos(atacanteNome, h);
    
    // Mostrar círculo de alcance se houver
    if (h.alcance_celulas != null) {
      _mesaShowRangeCircle(atacanteNome, h.alcance_celulas);
    }
    
    return '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<button onclick="_mesaAtaqueInlineVoltarStep()" style="padding:5px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor=\'rgba(79,163,209,0.4)\'" onmouseleave="this.style.borderColor=\'rgba(79,163,209,0.2)\'">← Voltar</button>' +
        '<div style="flex:1">' +
          '<div style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</div>' +
          (h.alcance_celulas != null ? '<div style="font-size:0.68rem;color:#7a6060">Alcance: ' + h.alcance_celulas + ' células</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">🎯 Escolha o alvo</div>' +
      alvosDisponiveis.map(alvo => {
        const cor = alvo.cor || '#7ec8f0';
        const distancia = alvo.distancia != null ? ` · ${alvo.distancia}c` : '';
        const foraAlcance = h.alcance_celulas != null && alvo.distancia != null && alvo.distancia > h.alcance_celulas;
        
        const bgC = foraAlcance ? 'rgba(20,12,12,0.6)' : 'rgba(20,12,12,0.8)';
        const bdC = foraAlcance ? 'rgba(60,40,20,0.4)' : `${cor}44`;
        const opacity = foraAlcance ? '0.5' : '1';
        
        return `<button ${foraAlcance ? 'disabled' : ''} 
          onclick="_mesaAtaqueInlineSelecionarAlvo('${alvo.nome.replace(/'/g, "\\'")}')"
          style="padding:10px 12px;background:${bgC};border:1px solid ${bdC};border-radius:8px;color:${foraAlcance ? '#6a5840' : cor};font-family:var(--fonte-d);font-size:0.75rem;cursor:${foraAlcance ? 'default' : 'pointer'};text-align:left;width:100%;display:flex;align-items:center;gap:8px;transition:all 0.15s;opacity:${opacity}"
          ${foraAlcance ? '' : `onmouseenter="this.style.borderColor='${cor}88'" onmouseleave="this.style.borderColor='${cor}44'"`}>
          <div style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></div>
          <span style="flex:1;font-family:'Cinzel',serif;font-size:0.82rem">${alvo.nome}</span>
          ${distancia ? `<span style="font-size:0.68rem;color:#7a6060">${distancia}</span>` : ''}
          ${foraAlcance ? '<span style="font-size:0.65rem;color:#c0392b;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;padding:1px 5px">⚠ Fora de alcance</span>' : ''}
        </button>`;
      }).join('') +
      '</div>';
  }
  
  // STEP 3: Rolagem manual de dados
  if (COMBATE.step === 3 && COMBATE.habilidadeSel && COMBATE.alvoNome) {
    const h = COMBATE.habilidadeSel;
    
    // Se ainda não rolou, mostrar botão de rolar
    if (!COMBATE.dadosRolados) {
      return '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<button onclick="_mesaAtaqueInlineVoltarStep()" style="padding:5px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor=\'rgba(79,163,209,0.4)\'" onmouseleave="this.style.borderColor=\'rgba(79,163,209,0.2)\'">← Voltar</button>' +
          '<div style="flex:1;display:flex;flex-direction:column;gap:2px">' +
            '<span style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</span>' +
            '<span style="font-size:0.72rem;color:var(--suave)">→ ' + COMBATE.alvoNome + '</span>' +
          '</div>' +
        '</div>' +
        
        // Preview da fórmula
        '<div style="padding:14px;background:rgba(126,200,240,0.05);border:1px solid rgba(126,200,240,0.15);border-radius:8px;text-align:center">' +
          '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Fórmula de dano</div>' +
          '<div style="font-family:\'Courier New\',monospace;font-size:1.1rem;color:#7ec8f0;margin-bottom:6px">' + (h.formula_dano || 'Sem fórmula') + '</div>' +
          (h.atributo_base ? '<div style="font-size:0.7rem;color:#9a8888">+ modificador de ' + h.atributo_base + '</div>' : '') +
        '</div>' +
        
        // Botão de rolar
        '<button onclick="atkRolarDados()" id="atk-btn-rolar" ' +
          'style="width:100%;padding:16px;background:linear-gradient(135deg,rgba(240,204,106,0.2),rgba(240,204,106,0.1));border:1px solid rgba(240,204,106,0.4);border-radius:8px;color:#f0cc6a;font-family:var(--fonte-d);font-size:0.85rem;cursor:pointer;text-transform:uppercase;letter-spacing:.12em;transition:all 0.2s;font-weight:600" ' +
          'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(240,204,106,0.6)\'" ' +
          'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(240,204,106,0.4)\'">' +
          '🎲 Rolar Dados (R ou Enter)' +
        '</button>' +
        
        '</div>';
    }
    
    // Se já rolou, mostrar resultado com opção de re-roll
    const resultado = COMBATE.dadosRolados;
    
    return '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
        '<button onclick="_mesaAtaqueInlineVoltar()" style="padding:5px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor=\'rgba(79,163,209,0.4)\'" onmouseleave="this.style.borderColor=\'rgba(79,163,209,0.2)\'">← Voltar</button>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:2px">' +
          '<span style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</span>' +
          '<span style="font-size:0.72rem;color:var(--suave)">→ ' + COMBATE.alvoNome + '</span>' +
        '</div>' +
      '</div>' +
      
      // Resultado do dano
      '<div style="padding:16px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.25);border-radius:8px;text-align:center">' +
        '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Dano causado</div>' +
        '<div style="font-family:\'Cinzel\',serif;font-size:2.2rem;color:#f0cc6a;margin-bottom:8px;font-weight:600">' + resultado.total + '</div>' +
        '<div style="font-size:0.72rem;color:#9a8888;font-family:\'Courier New\',monospace">' + resultado.detalhes + '</div>' +
        (resultado.rolls ? '<div style="font-size:0.68rem;color:#7a6060;margin-top:6px">Dados: [' + resultado.rolls.join(', ') + ']</div>' : '') +
      '</div>' +
      
      // Botões de ação
      '<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">' +
        '<button onclick="COMBATE.dadosRolados=null;_mesaRenderAcoes();setTimeout(atkRolarDados,100)" ' +
          'style="padding:12px;background:rgba(126,200,240,0.08);border:1px solid rgba(126,200,240,0.3);border-radius:8px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;transition:all 0.15s" ' +
          'onmouseenter="this.style.borderColor=\'rgba(126,200,240,0.5)\'" ' +
          'onmouseleave="this.style.borderColor=\'rgba(126,200,240,0.3)\'">' +
          '🔄 Rolar Novamente' +
        '</button>' +
        '<button onclick="atkConfirmarAtaque()" id="atk-btn-confirmar" ' +
          'style="padding:12px;background:linear-gradient(135deg,rgba(192,57,43,0.2),rgba(192,57,43,0.1));border:1px solid rgba(192,57,43,0.4);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;transition:all 0.2s;font-weight:600" ' +
          'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(192,57,43,0.6)\'" ' +
          'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(192,57,43,0.4)\'">' +
          '⚔ Confirmar (Enter)' +
        '</button>' +
      '</div>' +
      
      '</div>';
  }
  
  return '';
}

// ══════════════════════════════════════════════════════════════════════════
// 3. FUNÇÕES WRAPPER PARA NAVEGAÇÃO INLINE (usam COMBATE global)
// ══════════════════════════════════════════════════════════════════════════

// Hook para re-renderizar painel inline após ações do modal
function _mesaAtualizarPainelAposAcao() {
  // Verifica se o painel de ações está visível (contexto inline)
  const painelAcoes = document.getElementById('mesa-acao-painel');
  const modalAtaque = document.getElementById('modal-ataque');
  
  // Se modal está no painel de ações ou sidebar, re-renderiza
  if (painelAcoes && (modalAtaque?.parentElement === painelAcoes || 
      modalAtaque?.parentElement?.id === 'atk-sidebar-painel')) {
    setTimeout(() => _mesaRenderAcoes(), 50);
  }
}

// Interceptar atkSelecionarHabilidade original
if (typeof window._atkSelecionarHabilidadeOriginal === 'undefined') {
  window._atkSelecionarHabilidadeOriginal = window.atkSelecionarHabilidade;
  window.atkSelecionarHabilidade = function(idx) {
    console.log('[INTERCEPTOR] atkSelecionarHabilidade chamado, idx:', idx);
    console.log('[INTERCEPTOR] COMBATE.step antes:', COMBATE.step);
    
    // Chamar função original
    window._atkSelecionarHabilidadeOriginal(idx);
    
    console.log('[INTERCEPTOR] COMBATE.step depois:', COMBATE.step);
    console.log('[INTERCEPTOR] COMBATE.habilidadeSel:', COMBATE.habilidadeSel);
    
    // Verificar se modal está no painel
    const modal = document.getElementById('modal-ataque');
    const painelDesktop = document.getElementById('mesa-acao-painel');
    const sidebarMobile = document.getElementById('atk-sidebar-painel');
    
    console.log('[INTERCEPTOR] Modal parent:', modal?.parentElement?.id);
    console.log('[INTERCEPTOR] Modal display:', modal?.style.display);
    
    // Se modal está no painel, garantir que continua visível e no lugar certo
    if (modal && painelDesktop && modal.parentElement === painelDesktop) {
      console.log('[INTERCEPTOR] Modal no painel desktop - garantindo visibilidade');
      modal.style.display = 'block';
      modal.style.position = 'static';
    } else if (modal && sidebarMobile && modal.parentElement === sidebarMobile) {
      console.log('[INTERCEPTOR] Modal na sidebar mobile - garantindo visibilidade');
      modal.style.display = 'block';
      sidebarMobile.style.display = 'block';
    }
    
    // Forçar chamada de atkIrParaStep se existir
    if (typeof window.atkIrParaStep === 'function' && COMBATE.step === 2) {
      console.log('[INTERCEPTOR] Forçando atkIrParaStep(2)');
      setTimeout(() => window.atkIrParaStep(2), 10);
    }
  };
}

// Interceptar atkRolarDados original
if (typeof window._atkRolarDadosOriginal === 'undefined') {
  window._atkRolarDadosOriginal = window.atkRolarDados;
  window.atkRolarDados = function() {
    window._atkRolarDadosOriginal();
    _mesaAtualizarPainelAposAcao();
  };
}

// Interceptar atkConfirmarAtaque original para animação instantânea no inline
if (typeof window._atkConfirmarAtaqueOriginal === 'undefined') {
  window._atkConfirmarAtaqueOriginal = window.atkConfirmarAtaque;
  window.atkConfirmarAtaque = function() {
    // Detectar se está em modo inline
    const modalAtaque = document.getElementById('modal-ataque');
    const painelAcoes = document.getElementById('mesa-acao-painel');
    const isInline = painelAcoes && (modalAtaque?.parentElement === painelAcoes || 
                     modalAtaque?.parentElement?.id === 'atk-sidebar-painel');
    
    if (isInline) {
      // Modo inline: animação instantânea
      // Chamar função de animação diretamente antes de aplicar dano
      const h = COMBATE.habilidadeSel;
      const alvo = COMBATE.alvoNome;
      const resultado = COMBATE.dadosRolados;
      
      if (h && alvo && resultado && !COMBATE._jaAplicado) {
        const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
        const atacante = bs?.participantes?.[bs.ordemAtual];
        const atacanteNome = atacante?.nome || COMBATE.atacanteNome;
        
        // ✅ ANIMAÇÃO INSTANTÂNEA - sem delay
        const tokenAtacante = document.querySelector(`.mapa-token[data-nome="${atacanteNome}"]`);
        const tokenAlvo = document.querySelector(`.mapa-token[data-nome="${alvo}"]`);
        
        if (tokenAtacante && tokenAlvo) {
          // Chamar animação se existir
          if (typeof _mesaAnimarAtaque === 'function') {
            _mesaAnimarAtaque(tokenAtacante, tokenAlvo, h.tipo_dano || 'fisico');
          } else if (typeof mapaAnimarAtaque === 'function') {
            mapaAnimarAtaque(tokenAtacante, tokenAlvo, h.tipo_dano || 'fisico');
          }
        }
      }
    }
    
    // Executar função original
    window._atkConfirmarAtaqueOriginal();
    
    // Re-renderizar painel se inline
    if (isInline) {
      setTimeout(() => _mesaRenderAcoes(), 100);
    }
  };
}

// Função para selecionar alvo - wrapper simples que delega para a lógica do modal
window._mesaAtaqueInlineSelecionarAlvo = function(alvoNome) {
  COMBATE.alvoNome = alvoNome;
  COMBATE.step = 3;
  mapaHideRangeCircle();
  _mesaRenderAcoes();
};

// Função para voltar no step - usa COMBATE global
window._mesaAtaqueInlineVoltarStep = function() {
  if (COMBATE.step > 1) {
    COMBATE.step--;
    if (COMBATE.step === 1) {
      COMBATE.habilidadeSel = null;
      COMBATE.alvoNome = null;
      COMBATE.dadosRolados = null;
      mapaHideRangeCircle();
      if (typeof mapaHideAoECircle === 'function') mapaHideAoECircle();
    } else if (COMBATE.step === 2) {
      COMBATE.alvoNome = null;
      COMBATE.dadosRolados = null;
    }
    _mesaRenderAcoes();
  }
};

// ══════════════════════════════════════════════════════════════════════════
// FUNÇÕES PARA SIDEBAR MOBILE
// ══════════════════════════════════════════════════════════════════════════

window.abrirSidebarAtaque = function() {
  const sidebar = document.getElementById('atk-sidebar-painel');
  const content = document.getElementById('atk-sidebar-content');
  
  if (!sidebar || !content) {
    console.warn('[SIDEBAR] Elementos não encontrados');
    return;
  }
  
  // Obter dados da batalha atual
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs) {
    mostrarToast('Nenhuma batalha ativa', 'erro');
    return;
  }
  
  const atual = bs.participantes?.[bs.ordemAtual];
  if (!atual) {
    mostrarToast('Nenhum personagem no turno', 'erro');
    return;
  }
  
  // Obter habilidades
  const habs = atkGetHabilidadesCampanha(atual.nome);
  if (!habs || habs.length === 0) {
    mostrarToast('Nenhuma habilidade disponível', 'aviso');
    return;
  }
  
  // Renderizar conteúdo
  content.innerHTML = _mesaRenderAtaqueInline(atual.nome, habs);
  sidebar.style.display = 'block';
  
  console.log('[SIDEBAR] Aberta para:', atual.nome);
};

window.fecharSidebarAtaque = function() {
  const sidebar = document.getElementById('atk-sidebar-painel');
  if (sidebar) {
    sidebar.style.display = 'none';
  }
  
  // Resetar COMBATE se necessário
  if (COMBATE && !COMBATE._jaAplicado) {
    COMBATE.step = 1;
    COMBATE.habilidadeSel = null;
    COMBATE.alvoNome = null;
    COMBATE.dadosRolados = null;
  }
  
  console.log('[SIDEBAR] Fechada');
};

// ══════════════════════════════════════════════════════════════════════════
// 4. BUSCA DE ALVOS
// ══════════════════════════════════════════════════════════════════════════

function _mesaAtaqueInlineGetAlvos(atacanteNome, habilidade) {
  console.log('[MESA ATK] Buscando alvos para:', atacanteNome);
  
  const alvos = [];
  let metodo = 'nenhum';
  
  // MÉTODO 1: Participantes da batalha ativa
  try {
    if (BATALHA_ATUAL_ID && MAPA_STATE?.batalhas?.[BATALHA_ATUAL_ID]) {
      const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
      console.log('[MESA ATK] Batalha encontrada:', bs);
      
      if (bs.participantes && Array.isArray(bs.participantes)) {
        const atacante = bs.participantes.find(p => p.nome === atacanteNome);
        console.log('[MESA ATK] Atacante na batalha:', atacante);
        
        bs.participantes.forEach(p => {
          // Não atacar a si mesmo
          if (p.nome === atacanteNome) return;
          
          // Se há sistema de lados, só atacar inimigos
          if (atacante?.lado != null && p.lado != null && p.lado === atacante.lado) {
            return;
          }
          
          alvos.push({
            nome: p.nome,
            cor: p.cor || '#7ec8f0',
            distancia: _calcularDistanciaSegura(atacante, p)
          });
        });
        
        if (alvos.length > 0) metodo = 'batalha_participantes';
      }
    }
  } catch (e) {
    console.error('[MESA ATK] Erro no método 1:', e);
  }
  
  // MÉTODO 2: Todos os characters do RPG (se método 1 falhou)
  if (alvos.length === 0) {
    try {
      if (RPG_DATA?.characters && Array.isArray(RPG_DATA.characters)) {
        RPG_DATA.characters.forEach(c => {
          if (c.nome && c.nome !== atacanteNome) {
            alvos.push({
              nome: c.nome,
              cor: c.custom_attrs?.cor || c.cor || '#7ec8f0',
              distancia: null
            });
          }
        });
        
        if (alvos.length > 0) metodo = 'rpg_characters';
      }
    } catch (e) {
      console.error('[MESA ATK] Erro no método 2:', e);
    }
  }
  
  // MÉTODO 3: Tokens visíveis no mapa (último recurso)
  if (alvos.length === 0) {
    try {
      const tokens = document.querySelectorAll('.mapa-token[data-nome]');
      tokens.forEach(token => {
        const nome = token.getAttribute('data-nome');
        if (nome && nome !== atacanteNome) {
          alvos.push({
            nome: nome,
            cor: token.style.borderColor || '#7ec8f0',
            distancia: null
          });
        }
      });
      
      if (alvos.length > 0) metodo = 'tokens_mapa';
    } catch (e) {
      console.error('[MESA ATK] Erro no método 3:', e);
    }
  }
  
  console.log('[MESA ATK] Alvos encontrados:', alvos.length, 'Método:', metodo);
  console.log('[MESA ATK] Lista de alvos:', alvos);
  
  return alvos;
}

// ══════════════════════════════════════════════════════════════════════════
// 5. CÁLCULOS E UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════

function _calcularDistanciaSegura(token1, token2) {
  if (!token1 || !token2) return null;
  
  const pos1 = token1.posicao || token1.pos || token1.position || token1.celula;
  const pos2 = token2.posicao || token2.pos || token2.position || token2.celula;
  
  if (!pos1 || !pos2) return null;
  
  const x1 = pos1.col ?? pos1.x ?? pos1.column ?? 0;
  const y1 = pos1.row ?? pos1.y ?? pos1.linha ?? pos1.line ?? 0;
  const x2 = pos2.col ?? pos2.x ?? pos2.column ?? 0;
  const y2 = pos2.row ?? pos2.y ?? pos2.linha ?? pos2.line ?? 0;
  
  // Distância Chebyshev (movimento xadrez - conta diagonal)
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return Math.max(dx, dy);
}

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
  return Math.floor((attrValue - 10) / 2);
}

function rolarFormulaDano(formula, habilidade, charNome, contexto) {
  const match = formula.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { total: 0, detalhes: 'Fórmula inválida', rolls: [] };
  
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
// 6. VISUALIZAÇÃO DE ALCANCE NO MAPA
// ══════════════════════════════════════════════════════════════════════════

function _mesaShowRangeCircle(atacanteNome, alcance) {
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.find(p => p.nome === atacanteNome);
  
  if (!atacante) return;
  
  const pos = atacante.posicao || atacante.pos;
  if (!pos) return;
  
  const grid = document.getElementById('mapa-grid');
  if (!grid) return;
  
  // Remover círculo anterior
  mapaHideRangeCircle();
  
  const cellSize = 40; // Tamanho da célula do grid
  const col = pos.col ?? pos.x ?? pos.column ?? 0;
  const row = pos.row ?? pos.y ?? pos.linha ?? 0;
  
  const centerX = col * cellSize + cellSize / 2;
  const centerY = row * cellSize + cellSize / 2;
  const radius = alcance * cellSize;
  
  const circle = document.createElement('div');
  circle.id = 'mapa-range-circle';
  circle.style.cssText = `
    position: absolute;
    left: ${centerX - radius}px;
    top: ${centerY - radius}px;
    width: ${radius * 2}px;
    height: ${radius * 2}px;
    border: 2px dashed rgba(240, 204, 106, 0.6);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(240, 204, 106, 0.1) 0%, transparent 70%);
    pointer-events: none;
    z-index: 5;
    animation: pulseRange 2s ease-in-out infinite;
  `;
  
  grid.appendChild(circle);
  
  // Adicionar animação se não existir
  if (!document.getElementById('range-circle-style')) {
    const style = document.createElement('style');
    style.id = 'range-circle-style';
    style.textContent = `
      @keyframes pulseRange {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);
  }
}

function mapaHideRangeCircle() {
  const circle = document.getElementById('mapa-range-circle');
  if (circle) circle.remove();
}

function mapaShowAoECircle(centerPos, radius) {
  const grid = document.getElementById('mapa-grid');
  if (!grid) return;
  
  mapaHideAoECircle();
  
  const cellSize = 40;
  const col = centerPos.col ?? centerPos.x ?? 0;
  const row = centerPos.row ?? centerPos.y ?? 0;
  
  const centerX = col * cellSize + cellSize / 2;
  const centerY = row * cellSize + cellSize / 2;
  const radiusPx = radius * cellSize;
  
  const circle = document.createElement('div');
  circle.id = 'mapa-aoe-circle';
  circle.style.cssText = `
    position: absolute;
    left: ${centerX - radiusPx}px;
    top: ${centerY - radiusPx}px;
    width: ${radiusPx * 2}px;
    height: ${radiusPx * 2}px;
    border: 2px solid rgba(231, 76, 60, 0.7);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(231, 76, 60, 0.2) 0%, transparent 70%);
    pointer-events: none;
    z-index: 6;
    animation: pulseAoE 1.5s ease-in-out infinite;
  `;
  
  grid.appendChild(circle);
  
  _AOE_STATE.active = true;
  _AOE_STATE.center = centerPos;
  _AOE_STATE.radius = radius;
  
  if (!document.getElementById('aoe-circle-style')) {
    const style = document.createElement('style');
    style.id = 'aoe-circle-style';
    style.textContent = `
      @keyframes pulseAoE {
        0%, 100% { opacity: 0.7; transform: scale(1); }
        50% { opacity: 0.9; transform: scale(1.03); }
      }
    `;
    document.head.appendChild(style);
  }
}

function mapaHideAoECircle() {
  const circle = document.getElementById('mapa-aoe-circle');
  if (circle) circle.remove();
  
  _AOE_STATE.active = false;
  _AOE_STATE.center = null;
  _AOE_STATE.radius = 0;
}

// ══════════════════════════════════════════════════════════════════════════
// 7. SISTEMA DE TRIGGER FLUTUANTE
// ══════════════════════════════════════════════════════════════════════════

function _atkMostrarTrigger() {
  if (!COMBATE.habilidadeSel || !COMBATE.alvoNome || !COMBATE.dadosRolados) return;
  
  // Criar card flutuante
  let card = document.getElementById('atk-trigger-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'atk-trigger-card';
    card.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 280px;
      background: linear-gradient(135deg, rgba(20, 12, 12, 0.95), rgba(30, 18, 18, 0.95));
      border: 1px solid rgba(192, 57, 43, 0.5);
      border-radius: 12px;
      padding: 16px;
      z-index: 10000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      animation: slideInRight 0.3s ease-out;
    `;
    document.body.appendChild(card);
    
    // Adicionar animação
    if (!document.getElementById('trigger-card-style')) {
      const style = document.createElement('style');
      style.id = 'trigger-card-style';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(320px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(320px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  const h = COMBATE.habilidadeSel;
  const resultado = COMBATE.dadosRolados;
  
  card.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: 'Cinzel', serif; font-size: 0.9rem; color: #e8604c;">${h.nome}</span>
        <button onclick="_atkOcultarTrigger()" style="background: none; border: none; color: #7a6060; cursor: pointer; font-size: 1.2rem; padding: 0; line-height: 1;">×</button>
      </div>
      
      <div style="font-size: 0.75rem; color: var(--suave);">
        ${COMBATE.atacanteNome} → ${COMBATE.alvoNome}
      </div>
      
      <div style="text-align: center; padding: 12px; background: rgba(240, 204, 106, 0.1); border: 1px solid rgba(240, 204, 106, 0.3); border-radius: 8px;">
        <div style="font-size: 0.65rem; color: var(--suave); text-transform: uppercase; margin-bottom: 4px;">Dano</div>
        <div style="font-family: 'Cinzel', serif; font-size: 1.8rem; color: #f0cc6a; font-weight: 600;">${resultado.total}</div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button onclick="_atkTriggerCancelar()" style="padding: 10px; background: rgba(126, 200, 240, 0.08); border: 1px solid rgba(126, 200, 240, 0.3); border-radius: 6px; color: #7ec8f0; font-size: 0.75rem; cursor: pointer; transition: all 0.15s;" onmouseenter="this.style.borderColor='rgba(126,200,240,0.5)'" onmouseleave="this.style.borderColor='rgba(126,200,240,0.3)'">
          Cancelar
        </button>
        <button onclick="_atkTriggerAplicar()" style="padding: 10px; background: linear-gradient(135deg, rgba(192, 57, 43, 0.2), rgba(192, 57, 43, 0.1)); border: 1px solid rgba(192, 57, 43, 0.4); border-radius: 6px; color: #e74c3c; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.15s;" onmouseenter="this.style.borderColor='rgba(192,57,43,0.6)'" onmouseleave="this.style.borderColor='rgba(192,57,43,0.4)'">
          Aplicar
        </button>
      </div>
      
      <div id="atk-trigger-countdown" style="text-align: center; font-size: 0.7rem; color: #7a6060;"></div>
    </div>
  `;
  
  _TRIGGER_CARD_STATE.visible = true;
  _TRIGGER_CARD_STATE.countdown = 15; // 15 segundos para aplicar
  
  // Countdown
  _atkTriggerStartCountdown();
}

function _atkTriggerStartCountdown() {
  if (_TRIGGER_CARD_STATE.timerInterval) {
    clearInterval(_TRIGGER_CARD_STATE.timerInterval);
  }
  
  _TRIGGER_CARD_STATE.timerInterval = setInterval(() => {
    if (_TRIGGER_CARD_STATE.countdown <= 0) {
      _atkTriggerCancelar();
      return;
    }
    
    const countdownEl = document.getElementById('atk-trigger-countdown');
    if (countdownEl) {
      countdownEl.textContent = `Auto-cancelamento em ${_TRIGGER_CARD_STATE.countdown}s`;
    }
    
    _TRIGGER_CARD_STATE.countdown--;
  }, 1000);
}

function _atkOcultarTrigger() {
  const card = document.getElementById('atk-trigger-card');
  if (card) {
    card.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => card.remove(), 300);
  }
  
  if (_TRIGGER_CARD_STATE.timerInterval) {
    clearInterval(_TRIGGER_CARD_STATE.timerInterval);
  }
  
  _TRIGGER_CARD_STATE.visible = false;
  _TRIGGER_CARD_STATE.countdown = null;
  _TRIGGER_CARD_STATE.timerInterval = null;
}

window._atkTriggerAplicar = function() {
  if (COMBATE._jaAplicado) {
    mostrarToast('⚠ Ataque já foi aplicado!', 'erro');
    _atkOcultarTrigger();
    return;
  }
  
  const h = COMBATE.habilidadeSel;
  const alvo = COMBATE.alvoNome;
  const resultado = COMBATE.dadosRolados;
  
  if (!h || !alvo || !resultado) {
    _atkOcultarTrigger();
    return;
  }
  
  COMBATE._jaAplicado = true;
  
  // Aplicar dano
  if (typeof aplicarDanoBatalha === 'function') {
    aplicarDanoBatalha(BATALHA_ATUAL_ID, alvo, resultado.total, h.tipo_dano || 'fisico');
  }
  
  // Aplicar cooldown
  if (h.cooldown_turnos > 0 && typeof setCooldownBatalha === 'function') {
    setCooldownBatalha(BATALHA_ATUAL_ID, h.id, h.cooldown_turnos);
  }
  
  // Emitir eventos
  if (typeof HUB_EVENTS !== 'undefined') {
    HUB_EVENTS.emit('dano_aplicado', {
      atacante: COMBATE.atacanteNome,
      alvo: alvo,
      valor: resultado.total,
      tipo: h.tipo_dano || 'fisico'
    });
    
    HUB_EVENTS.emit('habilidade_usada', {
      personagem: COMBATE.atacanteNome,
      habilidade: h.nome,
      alvo: alvo
    });
  }
  
  mostrarToast(`⚔ ${COMBATE.atacanteNome} atacou ${alvo} causando ${resultado.total} de dano!`, 'sucesso');
  _atkOcultarTrigger();
};

window._atkTriggerCancelar = function() {
  _atkOcultarTrigger();
  COMBATE._jaAplicado = false;
  COMBATE._pendingTrigger = false;
  
  // Re-renderizar UI para mostrar botão de atacar novamente
  if (COMBATE.contexto === 'campanha' && typeof _aplicarEstadoBatalhaUI === 'function') {
    _aplicarEstadoBatalhaUI();
  }
};

// ══════════════════════════════════════════════════════════════════════════
// 8. VERIFICAÇÃO DE ESTADO DE BATALHA PARA JOGADORES
// ══════════════════════════════════════════════════════════════════════════

function _estadoBatalhaJogador(nomePersonagem) {
  // Se não há batalha ativa, está fora de combate
  if (!BATALHA_ATUAL_ID || !MAPA_STATE?.batalhas?.[BATALHA_ATUAL_ID]) {
    return 'fora_combate';
  }
  
  const bs = MAPA_STATE.batalhas[BATALHA_ATUAL_ID];
  
  // Se não tem participantes, está fora de combate
  if (!bs.participantes || bs.participantes.length === 0) {
    return 'fora_combate';
  }
  
  // Verificar se o personagem está na batalha
  const indexPersonagem = bs.participantes.findIndex(p => p.nome === nomePersonagem);
  if (indexPersonagem === -1) {
    return 'fora_combate';
  }
  
  // Verificar se é o turno do personagem
  const turnoAtual = bs.ordemAtual ?? 0;
  if (turnoAtual === indexPersonagem) {
    return 'livre'; // É o turno dele
  }
  
  return 'outro_turno'; // Está na batalha mas não é seu turno
}

// ══════════════════════════════════════════════════════════════════════════
// 9. EXTENSÃO DAS FUNÇÕES DO MODAL PARA CONTEXTO HUB
// ══════════════════════════════════════════════════════════════════════════
// NOTA: Usamos wrappers não-destrutivos que chamam as funções originais
// do combat.js e depois adicionam comportamento específico do hub
// (renderização inline no painel de ações, sidebar mobile, etc.)

// Salvar referências às funções originais do combat.js
const _abrirModalAtaqueOriginal = window.abrirModalAtaque;
const _fecharModalAtaqueOriginal = window.fecharModalAtaque;

// Wrapper para abrirModalAtaque - adiciona suporte a painéis inline
window.abrirModalAtaque = function(atacanteNome, contexto = 'arena') {
  // ✅ Chamar função original do combat.js primeiro
  // Ela faz toda a configuração básica (COMBATE, habilidades, etc.)
  if (typeof _abrirModalAtaqueOriginal === 'function') {
    _abrirModalAtaqueOriginal(atacanteNome, contexto);
  }
  
  // ✅ Adicionar lógica específica do hub: renderização inline
  const modal = document.getElementById('modal-ataque');
  if (!modal) return;
  
  const inner = modal.querySelector('div');
  
  // Resetar modo do modal
  modal._atkModo = null;
  
  function _setModalModo(modo) {
    if (modal._atkModo === modo) return;
    modal._atkModo = modo;
    modal.dataset.atkModo = modo;
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
  }
  
  // DETECÇÃO DE PAINÉIS INLINE (específico do hub)
  const _acaoDesktop = document.getElementById('mesa-acao-painel');
  const _sidebarAtk = document.getElementById('atk-sidebar-painel');
  const _targetPanel = _acaoDesktop || _sidebarAtk;
  
  if (_targetPanel && contexto === 'campanha') {
    // MODO PAINEL: Renderiza inline no fluxo da página
    _setModalModo('painel');
    modal.style.cssText = 'display:block;position:static;background:none;z-index:auto;width:100%;';
    if (inner) {
      inner.style.borderRadius = '10px';
      inner.style.marginTop = '0';
      inner.style.paddingBottom = '10px';
      inner.style.maxHeight = 'none';
    }
    if (_acaoDesktop) {
      _acaoDesktop.innerHTML = '';
      _acaoDesktop.appendChild(modal);
    } else {
      _sidebarAtk.innerHTML = '';
      _sidebarAtk.appendChild(modal);
      _sidebarAtk.style.display = 'block';
    }
    setTimeout(() => _targetPanel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 60);
  } else if (contexto === 'campanha') {
    // Verificar se existe anchor para modo inline alternativo
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
      modal.style.top = (rect.top + window.scrollY) + 'px';
      modal.style.left = (rect.left + window.scrollX) + 'px';
      modal.style.width = rect.width + 'px';
      modal.style.zIndex = '8000';
      setTimeout(() => modal.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    }
    // Se não tem anchor, a função original já configurou como overlay
  }
  // Para arena, a função original já configurou corretamente
};

// Wrapper para fecharModalAtaque - adiciona limpeza de painéis inline
window.fecharModalAtaque = function() {
  const modal = document.getElementById('modal-ataque');
  
  // Limpar painéis inline antes de chamar função original
  const _acaoDesktop = document.getElementById('mesa-acao-painel');
  const sidebarAtk = document.getElementById('atk-sidebar-painel');
  
  if (_acaoDesktop && modal?.parentElement === _acaoDesktop) {
    document.body.appendChild(modal);
    setTimeout(() => _mesaRenderAcoes?.(), 50);
  } else if (sidebarAtk && modal?.parentElement === sidebarAtk) {
    sidebarAtk.style.display = 'none';
    document.body.appendChild(modal);
  }
  
  if (modal?.parentElement?.id === 'atk-painel-campanha-anchor') {
    document.body.appendChild(modal);
  }
  
  // ✅ Chamar função original do combat.js
  if (typeof _fecharModalAtaqueOriginal === 'function') {
    _fecharModalAtaqueOriginal();
  } else {
    // Fallback se a função original não existir
    if (modal) modal.style.display = 'none';
  }
};

// ══════════════════════════════════════════════════════════════════════════
// 10. ATALHOS DE TECLADO
// ══════════════════════════════════════════════════════════════════════════

function configurarAtalhosCombate() {
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('modal-ataque');
    if (!modal || modal.style.display === 'none') return;
    
    // 1-9: Selecionar habilidade
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      if (COMBATE._habilidades && COMBATE._habilidades[idx]) {
        e.preventDefault();
        if (typeof atkSelecionarHabilidade === 'function') {
          atkSelecionarHabilidade(idx);
        }
      }
    }
    // Enter: Rolar ou confirmar
    else if (e.key === 'Enter') {
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

// ══════════════════════════════════════════════════════════════════════════
// 11. DEBUG HELPER
// ══════════════════════════════════════════════════════════════════════════

window._debugEstadoBatalha = function() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🐛 DEBUG COMPLETO DO SISTEMA DE COMBATE');
  console.log('═══════════════════════════════════════════════════════════');
  
  console.log('\n📍 VARIÁVEIS GLOBAIS:');
  console.log('BATALHA_ATUAL_ID:', BATALHA_ATUAL_ID);
  console.log('MAPA_STATE:', MAPA_STATE);
  console.log('RPG_DATA:', RPG_DATA);
  console.log('COMBATE:', COMBATE);
  console.log('ATAQUE_MAPA_STATE:', ATAQUE_MAPA_STATE);
  console.log('_TRIGGER_CARD_STATE:', _TRIGGER_CARD_STATE);
  console.log('_AOE_STATE:', _AOE_STATE);
  
  console.log('\n⚔️ BATALHAS:');
  if (MAPA_STATE?.batalhas) {
    Object.keys(MAPA_STATE.batalhas).forEach(id => {
      const b = MAPA_STATE.batalhas[id];
      console.log(`Batalha ${id}:`, b);
      if (b.participantes) {
        console.log('  Participantes:', b.participantes.length);
        b.participantes.forEach((p, i) => {
          console.log(`  [${i}] ${p.nome} - Lado: ${p.lado} - Pos:`, p.posicao || p.pos);
        });
      }
    });
  } else {
    console.log('Nenhuma batalha encontrada');
  }
  
  console.log('\n👥 PERSONAGENS (RPG_DATA.characters):');
  if (RPG_DATA?.characters) {
    console.log('Total:', RPG_DATA.characters.length);
    RPG_DATA.characters.forEach(c => {
      console.log(`  - ${c.nome} (cor: ${c.custom_attrs?.cor || c.cor})`);
    });
  } else {
    console.log('Nenhum personagem encontrado');
  }
  
  console.log('\n🎯 ESTADO DO ATAQUE INLINE:');
  console.log('_MESA_ATK_STATE:', window._MESA_ATK_STATE);
  
  console.log('\n🗺️ TOKENS NO MAPA:');
  const tokens = document.querySelectorAll('.mapa-token');
  console.log('Total de tokens:', tokens.length);
  tokens.forEach(t => {
    console.log(`  - ${t.getAttribute('data-nome') || 'sem nome'}`);
  });
  
  console.log('\n🧪 TESTE DE FUNÇÃO:');
  const bs = MAPA_STATE?.batalhas?.[BATALHA_ATUAL_ID];
  const atual = bs?.participantes?.[bs?.ordemAtual];
  if (atual) {
    console.log('Atacante atual:', atual.nome);
    const alvos = _mesaAtaqueInlineGetAlvos(atual.nome, {});
    console.log('Alvos encontrados:', alvos.length);
    console.log('Lista:', alvos);
  } else {
    console.log('Nenhum atacante ativo');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
};

// ══════════════════════════════════════════════════════════════════════════
// 12. MODO DE ATAQUE DINÂMICO NO MAPA
// ══════════════════════════════════════════════════════════════════════════

function ativarModoAtaqueMapa(atacanteNome) {
  ATAQUE_MAPA_STATE = {
    ativo: true,
    atacanteNome: atacanteNome,
    fase: 'habilidades'
  };
  
  // Criar/mostrar painel flutuante
  let panel = document.getElementById('atk-mapa-float-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'atk-mapa-float-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 300px;
      background: linear-gradient(135deg, rgba(20, 12, 12, 0.95), rgba(30, 18, 18, 0.95));
      border: 1px solid rgba(126, 200, 240, 0.4);
      border-radius: 12px;
      padding: 16px;
      z-index: 9000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    `;
    document.body.appendChild(panel);
  }
  
  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-family: 'Cinzel', serif; font-size: 0.9rem; color: #7ec8f0;">Modo Ataque</span>
      <button onclick="desativarModoAtaqueMapa()" style="background: none; border: none; color: #7a6060; cursor: pointer; font-size: 1.2rem; padding: 0; line-height: 1;">×</button>
    </div>
    <div style="font-size: 0.75rem; color: var(--suave); margin-bottom: 12px;">
      Atacante: ${atacanteNome}
    </div>
    <div style="font-size: 0.7rem; color: #7a6060; line-height: 1.4;">
      Clique em um alvo no mapa para atacar
    </div>
  `;
  
  // Destacar alvos disponíveis
  _marcarAlvosDisponiveis(atacanteNome);
}

function desativarModoAtaqueMapa() {
  ATAQUE_MAPA_STATE = { ativo: false, atacanteNome: null, fase: 'habilidades' };
  
  const panel = document.getElementById('atk-mapa-float-panel');
  if (panel) panel.style.display = 'none';
  
  // Remover destaque dos tokens
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });
}

function _marcarAlvosDisponiveis(atacanteNome) {
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs || !bs.participantes) return;
  
  const atacante = bs.participantes.find(p => p.nome === atacanteNome);
  if (!atacante) return;
  
  bs.participantes.forEach(p => {
    if (p.nome === atacanteNome) return;
    
    const token = document.querySelector(`.mapa-token[data-nome="${p.nome}"]`);
    if (!token) return;
    
    // Verificar se é aliado ou inimigo
    const isInimigo = atacante.lado != null && p.lado != null && p.lado !== atacante.lado;
    
    if (isInimigo) {
      token.classList.add('atk-target-disponivel');
    } else {
      token.classList.add('atk-target-buff'); // Aliado (pode ser buff no futuro)
    }
  });
  
  // Adicionar estilos se não existirem
  if (!document.getElementById('atk-mapa-styles')) {
    const style = document.createElement('style');
    style.id = 'atk-mapa-styles';
    style.textContent = `
      .mapa-token.atk-target-disponivel {
        box-shadow: 0 0 12px rgba(231, 76, 60, 0.8), 0 0 24px rgba(231, 76, 60, 0.4);
        cursor: crosshair !important;
        animation: pulseTarget 1.5s ease-in-out infinite;
      }
      .mapa-token.atk-target-fora-alcance {
        opacity: 0.4;
        cursor: not-allowed !important;
      }
      .mapa-token.atk-target-buff {
        box-shadow: 0 0 8px rgba(126, 200, 240, 0.6);
      }
      @keyframes pulseTarget {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FIM DO ARQUIVO - TODAS AS 20 FUNCIONALIDADES IMPLEMENTADAS
// ══════════════════════════════════════════════════════════════════════════
