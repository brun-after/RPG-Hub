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
    mapaEl.classList.remove('layout-2col'); // garante sem conflito com 2-col
    _mesaInjetarColunas();
    _mesaRenderizarColunas();
    // câmera auto apenas se mapa já estiver visível
  } else {
    mapaEl.classList.remove('mesa-ativo');
  }
}

function _mesaInjetarColunas() {
  if (document.getElementById('mesa-col-esq')) return;
  const mapaEl = document.getElementById('tab-mapas');
  if (!mapaEl) return;

  // ── Coluna Esquerda: status completo dos personagens ──────────────
  const colEsq = document.createElement('div');
  colEsq.id = 'mesa-col-esq';
  const hdrEsq = '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px">Personagens</div>';
  const hdrIni = '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:4px 8px 4px;border-top:1px solid var(--borda);margin-top:4px">Iniciativa</div>';
  colEsq.innerHTML = hdrEsq + '<div id="mesa-chars-lista" style="padding:0 8px"></div>' + hdrIni + '<div id="mesa-iniciativa-lista" style="padding:0 8px 8px"></div>';

  // Mover #mapa-status para dentro da coluna esquerda
  const mapaStatus = document.getElementById('mapa-status');
  if (mapaStatus) {
    mapaStatus.style.marginTop = '0';
    mapaStatus.style.padding = '0 8px 8px';
    colEsq.appendChild(mapaStatus);
  }

  // ── Coluna Central: mapa ──────────────────────────────────────────
  const colCentro = document.createElement('div');
  colCentro.id = 'mesa-col-centro';

  // ── Coluna Direita: feed + painel de ações ────────────────────────
  const colDir = document.createElement('div');
  colDir.id = 'mesa-col-dir';
  colDir.innerHTML =
    '<div style="flex-shrink:0;padding:8px 8px 4px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Feed</div>' +
      '<div id="mesa-feed-lista" style="display:flex;flex-direction:column;gap:3px;font-size:0.62rem;max-height:110px;overflow:hidden"></div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;overflow-x:hidden;border-top:1px solid var(--borda);display:flex;flex-direction:column" id="mesa-acao-col">' +
      // Painel de ações unificado
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px;flex-shrink:0">Ações</div>' +
      '<div id="mesa-acao-painel" style="flex:1;overflow-y:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:6px"></div>' +
    '</div>';

  // Placeholder para barra de ações legada (hidden)
  const barraAcoes = document.createElement('div');
  barraAcoes.id = 'mesa-barra-acoes';
  barraAcoes.style.display = 'none';
  barraAcoes.innerHTML = '<div id="mesa-barra-skills"></div>';

  // Mover elementos do mapa para coluna central
  const elementosParaMover = ['mapa-breadcrumb','mapa-lista','mapa-toolbar','mapa-wrap'];
  elementosParaMover.forEach(id => {
    const el = document.getElementById(id);
    if (el && mapaEl.contains(el) && !el.closest('#mesa-col-centro')) colCentro.appendChild(el);
  });

  // Mover conteúdo da sidebar (se existir) para coluna direita
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
  // Coluna esquerda: render simplificado de iniciativa apenas
  // O mapa-status (fichas completas) já está movido para a coluna esquerda
  const el = document.getElementById('mesa-chars-lista');
  if (el) el.innerHTML = ''; // limpar — mapa-status faz o render real
  mapaRenderStatus?.(); // atualizar fichas completas
}

function _mesaRenderIniciativa() {
  const el = document.getElementById('mesa-iniciativa-lista');
  if (!el) return;
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs?.participantes?.length) { el.innerHTML = '<div style="font-size:0.62rem;color:var(--suave);font-style:italic;padding:4px 0">Sem batalha ativa</div>'; return; }
  el.innerHTML = bs.participantes.map((p,i) => {
    const isAtual = i === bs.ordemAtual;
    return '<div style="padding:4px 7px;border-radius:6px;border:1px solid '+(isAtual?p.cor+'88':'var(--borda)')+';background:'+(isAtual?p.cor+'18':'transparent')+';display:flex;align-items:center;gap:6px;margin-bottom:3px"><div style="width:7px;height:7px;border-radius:50%;background:'+p.cor+';flex-shrink:0"></div><span style="font-size:0.65rem;font-family:var(--fonte-d);color:'+(isAtual?p.cor:'var(--suave)')+';flex:1">'+p.nome+'</span>'+(isAtual?'<span style="font-size:0.6rem;color:var(--destaque)">▶</span>':'')+'</div>';
  }).join('');
}

function _mesaRenderBarraSkills() { _mesaRenderAcoes(); } // alias legado

function _mesaRenderAcoes() {
  const painel = document.getElementById('mesa-acao-painel');
  if (!painel) return;

  const bs       = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const mapId    = MAPA_STATE?.mapaAtualId;
  const meuChar  = RPG_DATA?.linked || null;
  const sections = [];

  // ── FASE INICIATIVA ────────────────────────────────────────────────────
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

  // ── FASE COMBATE ───────────────────────────────────────────────────────
  if (bs?.fase === 'combate') {
    const atual       = bs.participantes?.[bs.ordemAtual];
    const nomeAtual   = atual?.nome || null;
    const isMinhaVez  = nomeAtual && (isMestre || nomeAtual === meuChar);
    const charAtivo   = nomeAtual || TOKEN_CTRL?.nomeSelecionado || meuChar;

    // Quem está na vez
    sections.push('<div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Vez de</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.85rem;color:' + (atual?.cor||'var(--destaque)') + ';margin-bottom:8px">' + (nomeAtual||'—') + '</div>');

    if (isMinhaVez) {
      // Habilidades do personagem da vez
      const habs = atkGetHabilidadesCampanha(nomeAtual);
      if (habs.length) {
        sections.push('<div style="display:flex;flex-direction:column;gap:4px">' +
          habs.slice(0,6).map(h => {
            const cd = getCooldownsBatalha(BATALHA_ATUAL_ID)[h.id] || 0;
            const dis = cd > 0;
            const bgC = dis ? 'rgba(60,40,20,0.4)' : 'rgba(192,57,43,0.08)';
            const bdC = dis ? 'rgba(60,40,20,0.4)' : 'rgba(192,57,43,0.3)';
            const colr = dis ? '#5a4030' : '#e8604c';
            const encH = encodeURIComponent(JSON.stringify(h));
            const encN = encodeURIComponent(nomeAtual||'');
            const formula = (h.formula_dano && h.formula_dano !== String.fromCharCode(8212))
              ? '<span style="float:right;color:#f0cc6a;font-size:0.55rem">' + h.formula_dano + '</span>' : '';
            const cdBadge = dis ? '<span style="float:right;font-size:0.55rem;color:#a07040">' + cd + 't</span>' : '';
            return '<button ' + (dis ? 'disabled ' : '') +
              'onclick="_mesaAtacarHab(this)" data-hab="' + encH + '" data-char="' + encN + '" ' +
              'style="padding:7px 10px;background:' + bgC + ';border:1px solid ' + bdC + ';border-radius:8px;color:' + colr + ';font-family:var(--fonte-d);font-size:0.62rem;cursor:' + (dis?'default':'pointer') + ';text-align:left;width:100%">' +
              h.nome + formula + cdBadge + '</button>';
          }).join('') +
          '</div>');
      }
      // Ação criativa + pular vez
      sections.push(
        '<div style="display:flex;gap:5px;margin-top:4px">' +
        '<button onclick="abrirModalAcao(&quot;' + (nomeAtual||'').replace(/"/g,'&quot;') + '&quot;)" style="flex:1;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:7px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✨ Criativa</button>' +
        '<button onclick="batalhaPassarVez()" style="padding:8px 12px;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-radius:7px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">→ Pular</button>' +
        '</div>');
    } else if (isMestre) {
      // Mestre pode pular e jogar por offline
      sections.push(
        '<div style="display:flex;gap:5px;margin-top:4px">' +
        '<button onclick="batalhaJogarPorOffline()" style="flex:1;padding:8px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:7px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">🎮 Jogar por ele</button>' +
        '<button onclick="batalhaPassarVez()" style="padding:8px 12px;background:rgba(192,57,43,0.05);border:1px solid rgba(192,57,43,0.18);border-radius:7px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">→ Pular</button>' +
        '</div>');
      // Habilidades do char ativo (mestre pode atacar por eles)
      const habsM = atkGetHabilidadesCampanha(nomeAtual);
      if (habsM.length) {
        sections.push(
          '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;margin-bottom:3px">Atacar por ' + nomeAtual + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:3px">' +
          habsM.slice(0,4).map(h =>
            '<button onclick="_mesaAtacarHab(this)" data-char="' + encodeURIComponent(nomeAtual||'') + '" data-hab="' + encodeURIComponent(JSON.stringify(h)) + '" style="padding:6px 9px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.2);border-radius:7px;color:#e8604c;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-align:left">' + h.nome + '</button>'
          ).join('') + '</div>');
      }
    }

    // Botões contextuais (posicionais) — sempre úteis em combate
    if (charAtivo && mapId) {
      const botoes = ctxGerarBotoes(charAtivo, mapId);
      if (botoes.length) {
        const { visiveis, ocultos } = ctxPriorizar(botoes);
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

  // ── SEM BATALHA ────────────────────────────────────────────────────────
  if (!bs) {
    if (isMestre && mapId) {
      sections.push('<button onclick="abrirModalIniciarBatalha()" style="width:100%;padding:10px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.22);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer;text-transform:uppercase;letter-spacing:.08em">⚔ Iniciar Batalha</button>');
    }
    // Fora de batalha: só botões de interação (não de skill)
    const charAtivo = TOKEN_CTRL?.nomeSelecionado || meuChar;
    if (charAtivo && mapId) {
      const botoes = ctxGerarBotoes(charAtivo, mapId).filter(b => b.acao !== 'usar_skill');
      if (botoes.length) {
        const { visiveis, ocultos } = ctxPriorizar(botoes);
        sections.push('<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;margin-bottom:3px">⚡ Interações</div>' +
          visiveis.map(b =>
            '<button onclick="ctxExecutarAcao(' + JSON.stringify(b).replace(/"/g,"'") + ')" style="width:100%;padding:7px 10px;background:rgba(79,163,209,0.07);border:1px solid rgba(79,163,209,0.2);border-radius:8px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-align:left;margin-bottom:3px">' +
            b.label + '</button>'
          ).join('') +
          (ocultos.length ? '<button onclick="ctxMostrarOcultos(' + JSON.stringify(ocultos).replace(/"/g,"'") + ')" style="width:100%;padding:4px;background:none;border:1px dashed rgba(79,163,209,0.2);border-radius:7px;color:rgba(79,163,209,0.5);font-family:var(--fonte-d);font-size:0.55rem;cursor:pointer">+' + ocultos.length + ' mais</button>' : ''));
      }
    }
  }

  // ── APROVAÇÕES PENDENTES (mestre) ─────────────────────────────────────
  if (isMestre) {
    const pendentes = (typeof CRIATIVOS_CAMP !== 'undefined' ? CRIATIVOS_CAMP : [])
      .filter(c => ['pendente','dc_rolado_sucesso','aprovado_dc','aprovado_aguardando_rolagem'].includes(c.status));
    if (pendentes.length) {
      sections.push('<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(200,168,75,0.8);text-transform:uppercase;margin-bottom:4px">📋 Pendentes (' + pendentes.length + ')</div>' +
        '<button onclick="var el=document.getElementById(&quot;criativos-mestre-wrap&quot;);if(el)el.scrollIntoView({behavior:&quot;smooth&quot;})" style="width:100%;padding:7px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer">Ver aprovações pendentes</button>');
    }
  }

  painel.innerHTML = sections.length
    ? sections.join('<div style="height:1px;background:rgba(255,255,255,0.06);margin:6px 0"></div>')
    : '<div style="font-size:0.65rem;color:var(--suave);font-style:italic;text-align:center;padding:12px 0">Selecione um personagem ou inicie uma batalha</div>';
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
  // Redesenhar grade se houver mapa tático ativo (garante alinhamento após resize)
  if (MAPA_STATE?.mapaAtualId) {
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
    if (entry && mapaIsTatico(entry.mapa)) {
      setTimeout(() => mapaRenderCanvas(entry.mapa), 50);
    }
  }
});

HUB_EVENTS.on('turno_avancou', () => { _mesaRenderIniciativa(); _mesaRenderAcoes?.(); if(MOBILE_CTRL.ativo) _atualizarZonaDireita(); });
HUB_EVENTS.on('dano_aplicado', () => { _mesaRenderChars(); mapaRenderStatus?.(); });
HUB_EVENTS.on('cura_aplicada', () => { _mesaRenderChars(); mapaRenderStatus?.(); });
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

window._barraContextoAvancar = function() { batalhaPassarVez?.(); };
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
 // Resetar estado de mapa para este RPG
 MAPA_STATE.mapaAtualId = null;
 MAPA_STATE.mapaGeralId = null;
 MAPA_STATE.toolMode = null;
 MAPA_STATE.medicaoAtiva = null;
 const meta=HUB_DATA.rpgs.find(r=>r.rpg_id===rpgId); if(!meta)return;
 const theme = meta.theme_json || {};
 CURRENT_RPG={...meta,id:rpgId,theme};
 aplicarTema(CURRENT_RPG); mostrarLoading(CURRENT_RPG);
 try{
   RPG_DATA=await getRPGData(rpgId); // instantâneo — retorna esqueleto vazio
   // Detectar role e linked ANTES de qualquer renderização
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
   // Renderizar shell com dados mínimos e mostrar app
   renderHeader(); renderLore(); renderCharButtons(); renderAttrButtons();
   renderDados(); renderConfig(); renderMapasTab();
   try{mostrarApp(CURRENT_RPG);}catch(e2){}
   ocultarLoading();
   // Restaurar aba navegada anteriormente
   const savedTab=localStorage.getItem('rpghub_tab_'+rpgId);
   if(savedTab){
     const btn=document.querySelector(`.tab-btn[onclick*="'${savedTab}'"]`);
     const el=document.getElementById('tab-'+savedTab);
     if(btn&&el){ document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); btn.classList.add('active'); }
   }
   iniciarRealtime(rpgId);
   chatMostrar(rpgId);
   // Carregar tudo progressivamente em background
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
    bibliotecaCarregarDoLore();
    sessionRenderPainel();
    _atualizarBannerControleMobile();
    desbloquearOrientacaoPWA();
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
 // Fontes agora ficam em theme_json
 const fd = t.font_display || t.fontTitulo;
 const ft = t.font_text   || t.fontCorpo;
 const fu = t.font_url;
 if(fd) root.style.setProperty('--fonte-d',`'${fd}',serif`);
 if(ft) root.style.setProperty('--fonte-t',`'${ft}',serif`);
 if(fu){let l=document.getElementById('rpg-fonts');if(!l){l=document.createElement('link');l.id='rpg-fonts';l.rel='stylesheet';document.head.appendChild(l);}l.href=fu;}
 document.body.style.background=t.preto||'#080c10';
}


let LOADING_START=0;


function mostrarLoading(rpg){
 LOADING_START=Date.now();
 document.getElementById('hub').style.display='none';
 
 // Injeta CSS customizado se existir
 if (rpg.theme && rpg.theme.animation_css) {
   injectCustomCSS(rpg.id, rpg.theme.animation_css);
 }
 
 const customLoading = (rpg.theme && rpg.theme.animation_loading_svg) || '';
 document.getElementById('loading-anim').innerHTML = getLoadingAnimSVG(rpg.theme?.animation||rpg.animation||'flame', customLoading);
 document.getElementById('loading-title').textContent=rpg.name;
 document.getElementById('loading').classList.add('visible');

 // Botão de escape: aparece após 3s
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
 // Mostrar botão de escape após 3s
 window._loadingEscTimer = setTimeout(() => { if (escBtn) escBtn.style.display = 'block'; }, 3000);
 // Forçar saída após 20s (failsafe absoluto)
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
 // Esconder criar-screen se estava visível
 const criar = document.getElementById('criar-screen');
 if (criar) criar.classList.remove('visible');
 document.getElementById('hub').style.display='';
 document.getElementById('app')?.classList.remove('visible');
 fecharRealtime && fecharRealtime();
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
     // Se app não ficou visível (erro silencioso), voltar ao hub
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
 // Restaurar elementos mestre-only (podem ter sido ocultados dentro da campanha)
 document.querySelectorAll('[data-mestre-only]').forEach(el=>el.style.display='');
 CURRENT_RPG=null;RPG_DATA=null;
 document.documentElement.removeAttribute('style');
 document.body.style.background='#050810';
}
