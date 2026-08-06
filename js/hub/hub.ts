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
        // Tab-mapas: fullscreen, mapa ocupa tudo, painéis são overlays
        '#tab-mapas.mesa-ativo.active{display:grid!important;grid-template-columns:1fr;grid-template-rows:1fr;height:100dvh;overflow:hidden;position:relative}' +
        // Coluna centro: ocupa o grid inteiro, mapa-wrap cresce para preencher
        '#mesa-col-centro{grid-column:1;grid-row:1;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:1;height:100dvh}' +
        '#mesa-col-centro #mapa-wrap{flex:1;min-height:0;display:flex!important;align-items:center;justify-content:center;background:#060810;border-radius:0!important;border:none!important;position:relative}' +
        '#mesa-col-centro #mapa-img{position:relative!important;inset:auto!important;padding-bottom:0!important;flex-shrink:0}' +
        // Painel esquerdo: overlay flutuante, oculto por padrão
        '#mesa-col-esq{grid-column:1;grid-row:1;position:absolute;left:0;top:0;bottom:0;width:270px;z-index:45;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(79,163,209,0.2) transparent;background:rgba(8,12,20,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-right:1px solid rgba(79,163,209,0.18);transform:translateX(calc(-100% - 1px));transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);pointer-events:all}' +
        '#mesa-col-esq.panel-aberto{transform:translateX(0);box-shadow:6px 0 32px rgba(0,0,0,0.65)}' +
        // Painel direito: overlay flutuante, oculto por padrão
        '#mesa-col-dir{grid-column:1;grid-row:1;position:absolute;right:0;top:0;bottom:0;width:310px;z-index:45;display:flex;flex-direction:column;overflow:hidden;background:rgba(8,12,20,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-left:1px solid rgba(79,163,209,0.18);transform:translateX(calc(100% + 1px));transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);pointer-events:all}' +
        '#mesa-col-dir.panel-aberto{transform:translateX(0);box-shadow:-6px 0 32px rgba(0,0,0,0.65)}' +
        '#mesa-barra-acoes{display:none}' +
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

  // ── Painel esquerdo: Personagens + Iniciativa ──────────────────────────
  const colEsq = document.createElement('div');
  colEsq.id = 'mesa-col-esq';
  colEsq.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 10px 8px;border-bottom:1px solid rgba(79,163,209,0.12);flex-shrink:0">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em">👥 Personagens</div>' +
      '<div style="display:flex;gap:2px">' +
        '<button id="mesa-pin-esq" onclick="mesaPinToggle(\'esq\')" style="background:none;border:none;color:var(--suave);font-size:0.75rem;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1;opacity:0.6" title="Fixar painel">📌</button>' +
        '<button onclick="mesaTogglePainel(\'esq\')" style="background:none;border:none;color:var(--suave);font-size:0.85rem;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1" title="Fechar painel">✕</button>' +
      '</div>' +
    '</div>' +
    '<div id="mesa-chars-lista" style="padding:0 8px;flex-shrink:0"></div>' +
    '<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(79,163,209,0.5);text-transform:uppercase;letter-spacing:.08em;padding:8px 10px 4px;border-top:1px solid var(--borda);margin-top:4px;flex-shrink:0">⚔ Iniciativa</div>' +
    '<div id="mesa-iniciativa-lista" style="padding:0 8px 8px;flex-shrink:0"></div>';

  const mapaStatus = document.getElementById('mapa-status');
  if (mapaStatus) {
    mapaStatus.style!.marginTop = '0';
    mapaStatus.style!.padding = '0 8px 8px';
    colEsq.appendChild(mapaStatus);
  }

  // ── Coluna central: Mapa (ocupa tudo) ─────────────────────────────────
  const colCentro = document.createElement('div');
  colCentro.id = 'mesa-col-centro';

  // ── Painel direito: Feed + Ações ────────────────────────────────────────
  const colDir = document.createElement('div');
  colDir.id = 'mesa-col-dir';
  colDir.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 10px 8px;border-bottom:1px solid rgba(79,163,209,0.12);flex-shrink:0">' +
      '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);text-transform:uppercase;letter-spacing:.08em">📋 Mesa</div>' +
      '<button onclick="mesaTogglePainel(\'dir\')" style="background:none;border:none;color:var(--suave);font-size:0.85rem;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1" title="Fechar painel">✕</button>' +
    '</div>' +
    '<div style="flex-shrink:0;padding:6px 8px 4px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:rgba(79,163,209,0.45);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Feed</div>' +
      '<div id="mesa-feed-lista" style="display:flex;flex-direction:column;gap:3px;font-size:0.62rem;max-height:110px;overflow:hidden"></div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;overflow-x:hidden;border-top:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column" id="mesa-acao-col">' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:rgba(79,163,209,0.45);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px;flex-shrink:0">Ações</div>' +
      '<div id="mesa-acao-painel" style="flex:1;overflow-y:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:6px"></div>' +
    '</div>';

  const barraAcoes = document.createElement('div');
  barraAcoes.id = 'mesa-barra-acoes';
  barraAcoes.style!.display = 'none';
  barraAcoes.innerHTML = '<div id="mesa-barra-skills"></div>';

  // Mover breadcrumb, lista e mapa-wrap para o centro (toolbar vai para mapa-wrap depois)
  const elementosParaMover = ['mapa-breadcrumb','mapa-lista','mapa-wrap'];
  elementosParaMover.forEach(id => {
    const el = document.getElementById(id);
    if (el && mapaEl.contains(el) && !el.closest('#mesa-col-centro')) colCentro.appendChild(el);
  });

  // Painel direito: batalha, ações, etc. (sem mapa-batalha-btn que vai para toolbar)
  const idsParaDir = [
    'batalhas-selector','mapa-batalha-bar','btn-confirmar-posicionamento-wrap',
    'mapa-batalha-outro','criativos-mestre-wrap','sessao-painel','criativo-mapa-bar',
    'atk-criativo-aprovado-mapa','atk-painel-campanha-anchor','rpg-load-status'
  ];
  idsParaDir.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style!.marginTop = '0';
      const acaoPainel = colDir.querySelector('#mesa-acao-painel');
      if (acaoPainel) acaoPainel.appendChild(el);
    }
  });

  mapaEl.insertBefore(barraAcoes, mapaEl.firstChild);
  mapaEl.insertBefore(colDir, mapaEl.firstChild);
  mapaEl.insertBefore(colCentro, mapaEl.firstChild);
  mapaEl.insertBefore(colEsq, mapaEl.firstChild);

  // ── Toolbar → move para dentro de mapa-wrap (bottom) ─────────────────
  const mapaWrap = document.getElementById('mapa-wrap');
  const toolbar  = document.getElementById('mapa-toolbar');
  // _mesaToolbarSetup sempre chamado — garante listener mesmo sem mover toolbar
  if (mapaWrap) _mesaToolbarSetup(mapaWrap);

  if (mapaWrap && toolbar && !mapaWrap.contains(toolbar)) {
    // Adicionar toggle buttons à toolbar antes de mover
    if (!document.getElementById('mesa-toggle-esq')) {
      const btnEsq = document.createElement('button');
      btnEsq.id = 'mesa-toggle-esq';
      btnEsq.className = 'mapa-tool-btn mesa-panel-toggle';
      btnEsq.title = 'Personagens / Iniciativa';
      btnEsq.onclick = () => mesaTogglePainel('esq');
      btnEsq.innerHTML = '👥';
      toolbar.insertBefore(btnEsq, toolbar.firstChild);

      const sep = document.createElement('div');
      sep.style!.cssText = 'width:1px;height:16px;background:rgba(255,255,255,0.1);flex-shrink:0';
      toolbar.insertBefore(sep, toolbar.children[1]);
    }
    if (!document.getElementById('mesa-toggle-dir')) {
      const btnDir = document.createElement('button');
      btnDir.id = 'mesa-toggle-dir';
      btnDir.className = 'mapa-tool-btn mesa-panel-toggle';
      btnDir.title = 'Ações / Feed';
      btnDir.onclick = () => mesaTogglePainel('dir');
      btnDir.innerHTML = '📋';
      toolbar.appendChild(btnDir);
    }
    // Adicionar botão Iniciar Batalha à toolbar (visibilidade controlada pelo battle system)
    const _btnBatalhaOrig = document.getElementById('mapa-batalha-btn');
    if (_btnBatalhaOrig) toolbar.appendChild(_btnBatalhaOrig);

    mapaWrap.appendChild(toolbar);
    _mesaToolbarSetup(mapaWrap);
  }

  // ── HUD de combate ─────────────────────────────────────────────────────
  if (mapaWrap && !document.getElementById('mesa-combat-hud')) {
    const hud = document.createElement('div');
    hud.id = 'mesa-combat-hud';
    mapaWrap.appendChild(hud);
    _mesaHudDraggableInit(hud);
  }

  // ── ResizeObserver: reajustar mapa ao redimensionar ──────────────────
  if (mapaWrap && !mapaWrap._resizeObserver) {
    mapaWrap._resizeObserver = new ResizeObserver(() => _mesaAjustarMapa());
    mapaWrap._resizeObserver.observe(mapaWrap);
  }
  if (!window._mesaWinResizeSetup) {
    window._mesaWinResizeSetup = true;
    window.addEventListener('resize', () => { if (window.innerWidth > 1100) _mesaAjustarMapa(); });
  }
}

function _mesaRenderizarColunas() { _mesaRenderChars(); _mesaRenderIniciativa(); _mesaRenderAcoes(); _mesaRenderCombatHud(); setTimeout(_mesaAjustarMapa, 50); }

// ── Ajuste de tamanho do mapa (contain sem crop) ───────────────────────
function _mesaAjustarMapa() {
  if (window.innerWidth <= 1100) return;
  const mapaWrap = document.getElementById('mapa-wrap');
  const mapaImg  = document.getElementById('mapa-img');
  if (!mapaWrap || !mapaImg) return;

  const ratio = mapaImg._aspectRatio || (4 / 3);
  const wW = mapaWrap.clientWidth;
  const wH = mapaWrap.clientHeight;
  if (!wW || !wH) return;

  let w = wW, h = wW / ratio;
  if (h > wH) { h = wH; w = h * ratio; }

  mapaImg.style!.width         = Math.floor(w) + 'px';
  mapaImg.style!.height        = Math.floor(h) + 'px';
  mapaImg.style!.paddingBottom = '0';
  mapaImg.style!.position      = 'relative';
  mapaImg.style!.inset         = 'auto';
}
window._mesaAjustarMapa = _mesaAjustarMapa;

// ── Toolbar bottom: revelar por proximidade; painel esq via documento ──
function _mesaToolbarSetup(mapaWrap: any) {
  if (mapaWrap._toolbarSetup) return;
  mapaWrap._toolbarSetup = true;

  const LIMIAR_BTM = 80; // px do fundo → toolbar
  let _toolbarVisible = false;

  // Toolbar: listener restrito ao mapa-wrap (toolbar fica dentro dele)
  mapaWrap.addEventListener('mousemove', (e: any) => {
    const rect = mapaWrap.getBoundingClientRect();
    const fromBottom = rect.bottom - e.clientY;
    const toolbar = document.getElementById('mapa-toolbar');
    if (!toolbar) return;
    const show = fromBottom <= LIMIAR_BTM && fromBottom >= 0;
    if (show !== _toolbarVisible) {
      _toolbarVisible = show;
      toolbar.classList.toggle('toolbar-visivel', show);
    }
  });
  mapaWrap.addEventListener('mouseleave', () => {
    _toolbarVisible = false;
    document.getElementById('mapa-toolbar')?.classList.remove('toolbar-visivel');
  });

  // Painel esquerdo: listener no documento para não perder o mouse ao entrar no painel
  if (!(document as any)._mesaEsqProximidade) {
    (document as any)._mesaEsqProximidade = true;
    const LIMIAR_ABRIR  = 60;  // px da borda esquerda para abrir
    const LIMIAR_FECHAR_EXTRA = 16; // px de buffer além da largura do painel para fechar
    let _esqVisible = false;

    document.addEventListener('mousemove', e => {
      const mapaW  = document.getElementById('mapa-wrap');
      const colEsq = document.getElementById('mesa-col-esq');
      if (!mapaW || !colEsq || colEsq.classList.contains('panel-fixado')) return;

      const rect = mapaW.getBoundingClientRect();
      if (rect.width === 0) return; // tab invisível

      // posição do mouse relativa à borda esquerda do mapa
      const relX = e.clientX - rect.left;

      // Quando aberto: manter enquanto o mouse estiver dentro do painel + buffer
      // Quando fechado: abrir apenas na zona de proximidade (borda esquerda)
      const panelW   = colEsq.offsetWidth || 270;
      const limiar   = _esqVisible ? panelW + LIMIAR_FECHAR_EXTRA : LIMIAR_ABRIR;
      const show     = relX >= 0 && relX <= limiar;

      if (show !== _esqVisible) {
        _esqVisible = show;
        colEsq.classList.toggle('panel-aberto', show);
        const btn = document.getElementById('mesa-toggle-esq');
        if (btn) btn.classList.toggle('ativo', show);
      }
    });
  }
}

// ── Pin / unpin de painéis ────────────────────────────────────────────────
function mesaPinToggle(lado: any) {
  const panelId = lado === 'esq' ? 'mesa-col-esq' : 'mesa-col-dir';
  const pinBtnId = 'mesa-pin-' + lado;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const fixado = panel.classList.toggle('panel-fixado');
  if (fixado) panel.classList.add('panel-aberto');
  const btn = document.getElementById(pinBtnId);
  if (btn) {
    btn.style!.opacity  = fixado ? '1' : '0.6';
    btn.style!.color    = fixado ? 'var(--destaque)' : 'var(--suave)';
    btn.title = fixado ? 'Desafixar painel' : 'Fixar painel';
  }
}

// ── HUD draggable ─────────────────────────────────────────────────────────
function _mesaHudDraggableInit(hud: any) {
  let dragging = false, startX: any, startY: any, origLeft: any, origTop: any;

  hud.addEventListener('mousedown', (e: any) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    dragging = true;
    hud.classList.add('dragging');
    const rect = hud.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    origLeft = rect.left; origTop = rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    hud.style.left   = (origLeft + dx) + 'px';
    hud.style.top    = (origTop  + dy) + 'px';
    hud.style.bottom = 'auto';
    hud.style.transform = 'none';
    hud.classList.add('posicionado-manual');
    hud._manuallyPositioned = true;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    hud.classList.remove('dragging');
  });
}

// ── HUD auto-posicionar perto do quadrante do token ativo ────────────────
function _mesaHudAutoPositionar() {
  const hud = document.getElementById('mesa-combat-hud');
  if (!hud || hud._manuallyPositioned) return;

  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atual = bs?.participantes?.[bs.ordemAtual];
  if (!atual) return;

  const mapaWrap = document.getElementById('mapa-wrap');
  const mapaImg  = document.getElementById('mapa-img');
  if (!mapaWrap || !mapaImg) return;

  // Encontrar token do personagem ativo
  const token = (MAPA_STATE.tokens || []).find((t: any) => t.nome === atual.nome);
  if (!token || token.cx == null) return;

  const wrapRect = mapaWrap.getBoundingClientRect();
  const midX = wrapRect.width  / 2;
  const midY = wrapRect.height / 2;

  const imgRect = mapaImg.getBoundingClientRect();
  const tokenAbsX = imgRect.left - wrapRect.left + (token.cx / 100) * imgRect.width;
  const tokenAbsY = imgRect.top  - wrapRect.top  + (token.cy / 100) * imgRect.height;

  const lados = tokenAbsX < midX ? 'left:12px' : 'right:12px';
  const tops  = tokenAbsY < midY ? 'bottom:12px' : 'top:12px';

  hud.style!.cssText += ';' + lados + ';' + tops + ';left:auto;right:auto;bottom:auto;top:auto;transform:none';
  // Sobrescrever com o quadrante correto
  hud.style!.left   = tokenAbsX < midX ? '12px' : 'auto';
  hud.style!.right  = tokenAbsX < midX ? 'auto' : '12px';
  hud.style!.bottom = tokenAbsY < midY ? '12px' : 'auto';
  hud.style!.top    = tokenAbsY < midY ? 'auto' : '12px';
  hud.style!.transform = 'none';
}

// ── Nav-peek: mostrar nav-tabs ao aproximar do topo ──────────────────────
(function _navPeekInit() {
  const LIMIAR = 50; // px do topo
  let _navPeekAtivo = false;

  document.addEventListener('mousemove', e => {
    if (!document.body.classList.contains('mesa-ativa')) return;
    const show = e.clientY <= LIMIAR;
    if (show !== _navPeekAtivo) {
      _navPeekAtivo = show;
      document.body.classList.toggle('nav-peek', show);
    }
  });
}());

// ── Toggle de painéis flutuantes ──────────────────────────────────────────
function mesaTogglePainel(lado: any) {
  const id    = lado === 'esq' ? 'mesa-col-esq' : 'mesa-col-dir';
  const btnId = lado === 'esq' ? 'mesa-toggle-esq' : 'mesa-toggle-dir';
  const el    = document.getElementById(id);
  if (!el) return;
  const aberto = el.classList.toggle('panel-aberto');
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('ativo', aberto);
}

// ── HUD de combate: overlay no mapa, auto-exibido durante batalha ────────
function _mesaRenderCombatHud() {
  const hud = document.getElementById('mesa-combat-hud');
  if (!hud) return;

  const bs       = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const meuChar  = RPG_DATA?.linked || null;

  if (!bs) {
    hud.style!.display = 'none';
    hud.innerHTML = '';
    return;
  }

  hud.style!.display = 'flex';

  if (bs.fase === 'posicionamento') {
    hud.innerHTML =
      '<div class="mhud-round">🗺 Posicionamento</div>' +
      '<div class="mhud-sep"></div>' +
      '<div class="mhud-turno">Posicione os tokens no mapa</div>' +
      (isMestre
        ? '<button onclick="batalhaConfirmarPosicionamento()" class="mhud-btn mhud-btn-ok">✓ Confirmar → Iniciativa</button>'
        : '<span class="mhud-aguarda">Aguardando mestre…</span>');
    return;
  }

  if (bs.fase === 'iniciativa' || bs.fase === 'empate') {
    const jaRolei  = meuChar && bs.iniciativasRoladas?.[meuChar] != null;
    const pendentes = bs.participantes?.filter((p: any) => bs.iniciativasRoladas?.[p.nome] == null) || [];
    hud.innerHTML =
      '<div class="mhud-round">🎲 Iniciativa' + (bs.fase === 'empate' ? ' — Desempate' : '') + '</div>' +
      '<div class="mhud-sep"></div>' +
      (!jaRolei || bs.fase === 'empate'
        ? '<button onclick="abrirModalIniciativa()" class="mhud-btn mhud-btn-atk">🎲 Rolar (d20)</button>'
        : '<span class="mhud-aguarda">✓ Rolado — aguardando outros…</span>') +
      (isMestre && pendentes.length
        ? '<button onclick="abrirModalIniciativa()" class="mhud-btn mhud-btn-sec">Pendentes (' + pendentes.length + ')</button>'
        : '');
    return;
  }

  if (bs.fase === 'combate') {
    const atual      = bs.participantes?.[bs.ordemAtual];
    const nomeAtual  = atual?.nome || '—';
    const cor        = atual?.cor || 'var(--destaque)';
    // Pets don't have their own turns — owner controls pet during owner's turn
    const isMinhaVez  = (isMestre && nomeAtual !== meuChar) || (nomeAtual === meuChar);
    const round      = bs.turno || 0;
    const _nomeEsc   = nomeAtual.replace(/\\/g,'\\\\').replace(/'/g,"\\'");

    const _movRest = (isMinhaVez && typeof movGetRestante === 'function' && BATALHA_ATUAL_ID)
      ? movGetRestante(BATALHA_ATUAL_ID, nomeAtual)
      : null;
    const _movHtml = _movRest != null
      ? '<div class="mhud-mov" style="font-family:var(--fonte-d);font-size:0.6rem;color:' + (_movRest > 0 ? '#7ec8f0' : 'rgba(192,57,43,0.7)') + ';margin-left:4px">🦶' + _movRest + '</div>'
      : '';
    hud.innerHTML =
      '<div class="mhud-round" style="color:#e74c3c">⚔ R' + round + '</div>' +
      '<div class="mhud-sep"></div>' +
      '<div class="mhud-turno" style="color:' + cor + '">' + nomeAtual + '</div>' +
      _movHtml +
      '<div class="mhud-acoes">' +
        (isMinhaVez
          ? '<button onclick="abrirModalAtaque(\'' + _nomeEsc + '\',\'campanha\')" class="mhud-btn mhud-btn-atk">⚔ Atacar</button>' +
            '<button onclick="abrirModalAcao(\'' + (nomeAtual).replace(/"/g,'&quot;') + '\')" class="mhud-btn mhud-btn-sec">✨ Criativa</button>' +
            '<button onclick="batalhaPassarVez()" class="mhud-btn mhud-btn-skip">→</button>'
          : isMestre
          ? '<button onclick="batalhaJogarPorOffline()" class="mhud-btn mhud-btn-sec">🎮 Por ele</button>' +
            '<button onclick="batalhaPassarVez()" class="mhud-btn mhud-btn-skip">→ Pular</button>'
          : '<span class="mhud-aguarda">Vez de ' + nomeAtual + '…</span>')  +
        (isMestre
          ? '<button onclick="mesaTogglePainel(\'dir\')" id="mesa-hud-toggle-dir" class="mhud-btn mhud-btn-menu" title="Painel de ações">☰</button>'
          : '') +
      '</div>';

    // Sincroniza estado do toggle-dir com o botão do HUD
    const dirAberto = document.getElementById('mesa-col-dir')?.classList.contains('panel-aberto');
    const hudToggle = document.getElementById('mesa-hud-toggle-dir');
    if (hudToggle) hudToggle.classList.toggle('ativo', !!dirAberto);
  }
}

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
  el.innerHTML = bs.participantes.map((p: any,i: any) => {
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
    const pendentes = bs.participantes?.filter((p: any) => bs.iniciativasRoladas?.[p.nome] == null) || [];
    sections.push(
      '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--destaque);margin-bottom:6px">' +
      (bs.fase === 'empate' ? '⚠ Empate — re-role' : '🎲 Iniciativa') + '</div>' +
      bs.participantes.map((p: any) => {
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
    const isMinhaVez  = (isMestre && nomeAtual !== meuChar) || (nomeAtual === meuChar);
    const charAtivo   = nomeAtual || window.TOKEN_CTRL?.nomeSelecionado || meuChar;

    sections.push('<div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Vez de</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.85rem;color:' + (atual?.cor||'var(--destaque)') + ';margin-bottom:8px">' + (nomeAtual||'—') + '</div>');

  if (isMinhaVez) {
      const _nomeEsc = (nomeAtual||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      sections.push(
        '<button onclick="abrirModalAtaque(\'' + _nomeEsc + '\',\'campanha\')" ' +
        'style="width:100%;padding:10px 8px;background:linear-gradient(135deg,rgba(192,57,43,0.25),rgba(192,57,43,0.12));' +
        'border:1px solid rgba(192,57,43,0.45);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);' +
        'font-size:0.7rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">⚔ Atacar / Usar Skill</button>'
      );
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
      const _nomeEscM = (nomeAtual||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      sections.push(
        '<button onclick="abrirModalAtaque(\'' + _nomeEscM + '\',\'campanha\')" ' +
        'style="width:100%;padding:10px 8px;background:linear-gradient(135deg,rgba(192,57,43,0.25),rgba(192,57,43,0.12));' +
        'border:1px solid rgba(192,57,43,0.45);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);' +
        'font-size:0.7rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">⚔ Atacar por ' + (nomeAtual||'') + '</button>'
      );
    }

    if (charAtivo && mapId && typeof ctxGerarBotoes === 'function') {
      const botoes = ctxGerarBotoes(charAtivo, mapId);
      if (botoes.length) {
        const { visiveis, ocultos } = typeof ctxPriorizar === 'function' ? ctxPriorizar(botoes) : { visiveis: botoes, ocultos: [] };
        sections.push('<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">⚡ Ações posicionais</div>' +
          '<div style="display:flex;flex-direction:column;gap:3px">' +
          visiveis.map((b: any) =>
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
      const botoes = ctxGerarBotoes(charAtivo, mapId).filter((b: any) => b.acao !== 'usar_skill');
      if (botoes.length) {
        const { visiveis, ocultos } = typeof ctxPriorizar === 'function' ? ctxPriorizar(botoes) : { visiveis: botoes, ocultos: [] };
        sections.push('<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;margin-bottom:3px">⚡ Interações</div>' +
          visiveis.map((b: any) =>
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
      .filter(c => ['pendente','dc_rolado_sucesso','aprovado_dc','aprovado_aguardando_rolagem'].includes(c.status!));
    aprovacoesPendentes = pendentes.length > 0;
    if (pendentes.length) {
      sections.push('<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(200,168,75,0.8);text-transform:uppercase;margin-bottom:4px">📋 Pendentes (' + pendentes.length + ')</div>' +
        '<button onclick="scrollToPendingApprovals()" style="width:100%;padding:7px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.25);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background=\'rgba(200,168,75,0.15)\'" onmouseout="this.style.background=\'rgba(200,168,75,0.08)\'">Ver aprovações pendentes</button>');
      sections.push('<div id="criativos-mestre-wrap"></div>');
    }
    if (bs) {
      const _cfg = typeof getBattleConfig === 'function' ? getBattleConfig() : { sistema_reacao: 'dnd5e', usa_reacoes: false };
      const _sysLabel: Record<string, any> = { dnd5e: 'D&D 5e', pf2e: 'PF2e', pf1e: 'PF1e', narrativo: 'Narrativo', custom: 'Custom', desativado: 'Desativado' };
      const _defLabel: Record<string, string> = { passiva: 'Passiva', ativa: 'Ativa', mista: 'Mista' };
      let _recHtml = '';
      if (_cfg.usa_reacoes && bs.recursos_participantes && Object.keys(bs.recursos_participantes).length) {
        _recHtml = '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">' +
          Object.entries<any>(bs.recursos_participantes).map(([nome, rec]) =>
            '<div style="display:flex;align-items:center;gap:5px">' +
            '<div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + ((rec as any).reacao_disponivel !== false ? '#5ee09a' : '#7a6060') + '"></div>' +
            '<span style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);flex:1">' + nome + '</span>' +
            '<span style="font-family:var(--fonte-d);font-size:0.55rem;color:' + ((rec as any).reacao_disponivel !== false ? '#5ee09a' : '#7a6060') + '">' +
            ((rec as any).reacao_disponivel !== false ? '⚡' : '—') + '</span>' +
            '</div>'
          ).join('') +
          '</div>';
      }
      sections.push(
        '<div style="font-family:var(--fonte-d);font-size:0.55rem;color:rgba(192,57,43,0.7);text-transform:uppercase;margin-bottom:4px;margin-top:8px">⚔ Controles de Batalha</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:5px">' +
        '<button onclick="pausarOuRetomarBatalha()" style="flex:1;padding:7px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">⏸ Pausar</button>' +
        '<button onclick="encerrarBatalha()" style="flex:1;padding:7px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.2);border-radius:6px;color:#c0392b;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">✕ Encerrar</button>' +
        '</div>' +
        '<div style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);margin-top:4px">⚔ Sistema: <span style="color:var(--destaque)">' + (_sysLabel[_cfg.sistema_reacao] || _cfg.sistema_reacao || '—') + '</span>' +
        ' &nbsp;🛡 Defesa: <span style="color:var(--destaque)">' + (_defLabel[_cfg.tipo_defesa] || _cfg.tipo_defesa || 'Passiva') + '</span></div>' +
        _recHtml
      );
    }
  }

  // Resgatar modal-ataque se tiver sido movido para dentro do painel (modo campanha inline)
  const _modalAtk = document.getElementById('modal-ataque');
  if (_modalAtk && painel.contains(_modalAtk)) document.body.appendChild(_modalAtk);

  // Não sobrescrever enquanto o card de confirmação de ataque estiver ativo
  if (window._atkTriggerSidebarAtivo) return;

  painel.innerHTML = sections.length
    ? sections.join('<div style="height:1px;background:rgba(255,255,255,0.06);margin:6px 0"></div>')
    : '<div style="font-size:0.65rem;color:var(--suave);font-style:italic;text-align:center;padding:12px 0">Selecione um personagem ou inicie uma batalha</div>';

  if (aprovacoesPendentes) {
    setTimeout(() => {
      if (typeof criativoRenderMestre === 'function') criativoRenderMestre();
    }, 50);
  }
}


function _mesaAtacarHab(btn: any) {
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

HUB_EVENTS.on('turno_avancou', () => { _mesaRenderIniciativa(); _mesaRenderAcoes?.(); _mesaRenderCombatHud?.(); if(typeof _atualizarZonaDireita === 'function' && MOBILE_CTRL?.ativo) _atualizarZonaDireita(); });
HUB_EVENTS.on('dano_aplicado', () => { _mesaRenderChars(); if (typeof mapaRenderStatus === 'function') mapaRenderStatus(); });
HUB_EVENTS.on('cura_aplicada', () => { _mesaRenderChars(); if (typeof mapaRenderStatus === 'function') mapaRenderStatus(); });
HUB_EVENTS.on('token_selecionado', () => { _mesaRenderAcoes?.(); _mesaRenderCombatHud?.(); });
HUB_EVENTS.on('batalha_atualizada', () => { _mesaRenderAcoes?.(); _mesaRenderCombatHud?.(); _mesaRenderIniciativa?.(); });

// ── 5.2 Feed da mesa ──────────────────────────────────────────────────────
const FEED_MESA = { entradas: [] as any[], maxEntradas: 200 };

function feedAdicionarEntrada(texto: any, tipo: any, personagem?: any) {
  FEED_MESA.entradas.unshift({ ts: Date.now(), texto, tipo: tipo||'info', personagem: personagem||null });
  if (FEED_MESA.entradas.length > FEED_MESA.maxEntradas) FEED_MESA.entradas = FEED_MESA.entradas.slice(0, FEED_MESA.maxEntradas);
  feedRenderizar();
}

function feedRenderizar() {
  const el = document.getElementById('mesa-feed-lista');
  if (!el) return;
  const corTipo: Record<string, any> = { dano:'#e74c3c', cura:'#5ee09a', turno:'#f0cc6a', movimento:'#7ec8f0', item:'#b07ef0', cena:'#c8a84b', info:'rgba(255,255,255,0.4)' };
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
  return; // barra suprimida — contexto exibido no HUD de combate
  const barra = document.createElement('div');
  barra.id = 'barra-contexto-mestre';
  barra.style!.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:7500;height:32px;padding:0 16px;background:rgba(5,8,16,0.95);border-bottom:1px solid var(--borda);align-items:center;justify-content:space-between;gap:12px;font-family:var(--fonte-d);font-size:0.65rem;backdrop-filter:blur(6px)';
  barra.innerHTML = '<span id="ctx-papel" style="color:var(--texto)">🎭 Modo Mestre</span><div style="display:flex;gap:8px"><button id="ctx-btn-avancar" onclick="_barraContextoAvancar()" style="padding:3px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-size:0.58rem;cursor:pointer">→</button><button id="mapa-camera-btn" onclick="mapaToggleModoCamera()" style="padding:3px 10px;background:transparent;border:1px solid var(--borda);border-radius:5px;color:var(--suave);font-size:0.58rem;cursor:pointer">📷 Auto</button></div>';
  document.body.appendChild(barra);
}

function barraContextoAtualizar(personagem: any) {
  const barra = document.getElementById('barra-contexto-mestre');
  if (!barra || RPG_DATA?.myRole !== 'mestre') return;
  barra.style!.display = 'flex';
  const papelEl = document.getElementById('ctx-papel');
  const btnAv   = document.getElementById('ctx-btn-avancar');
  if (!papelEl) return;
  const vinculado = RPG_DATA?.linked;
  const ehMeu = personagem && personagem === vinculado;
  papelEl.textContent = ehMeu ? '⚔ Atuando como '+personagem : personagem ? '🎭 Mestre — vez de '+personagem : '🎭 Modo Mestre';
  papelEl.style!.color = ehMeu ? (RPG_DATA?.characters?.find(c=>c.nome===personagem)?.custom_attrs?.cor||'var(--destaque)') : 'var(--suave)';
  if (btnAv) btnAv.textContent = ehMeu ? 'Passar NPC →' : (vinculado ? '← '+vinculado : '—');
  if (!document.body.classList.contains('mesa-ativa')) {
    const appEl = document.getElementById('app');
    if (appEl) appEl.style!.paddingTop = '32px';
  }
}

window._barraContextoAvancar = function() { if (typeof batalhaPassarVez === 'function') batalhaPassarVez(); };
HUB_EVENTS.on('turno_avancou', ({ personagem }) => {
  barraContextoAtualizar(personagem);
  _mesaHudAutoPositionar();
});

// ── 5.4 Painel de notificações ────────────────────────────────────────────
const NOTIFICACOES = { fila: [] as any[] };

function notifAdicionar(_notif: any) { const { tipo, prioridade, titulo, descricao, acao, dados } = _notif;
  const notif: any = { id:'notif_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), tipo:tipo||'info', prioridade:prioridade||'media', titulo:titulo||'', descricao:descricao||'', acao:acao||null, dados:dados||{}, ts:Date.now() };
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
    painel.style!.cssText = 'position:fixed;bottom:70px;right:12px;z-index:9200;display:flex;flex-direction:column;gap:6px;max-width:280px;pointer-events:auto';
    document.body.appendChild(painel);
  }
  const visiveis = NOTIFICACOES.fila.filter(n => !n._adiada && !n._resolvida);
  if (!visiveis.length) { painel.innerHTML = ''; return; }
  const corP: Record<string, any> = { alta:'#e74c3c', media:'#f0cc6a', baixa:'rgba(122,146,170,0.7)' };
  painel.innerHTML = visiveis.slice(0,5).map(n => {
    const cor = corP[n.prioridade]||'var(--borda)';
    const pulso = n.prioridade==='alta'?'animation:notifPulso 1.2s ease-in-out infinite;':'';
    return '<div id="'+n.id+'" style="'+pulso+'background:var(--painel,#141d2b);border:1px solid '+cor+';border-left:3px solid '+cor+';border-radius:9px;padding:8px 10px;cursor:pointer" onclick="notifExpandir(\'' + n.id + '\')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px"><div style="flex:1;min-width:0"><div style="font-family:var(--fonte-d);font-size:0.68rem;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+n.titulo+'</div>'+(n.descricao?'<div style="font-size:0.6rem;color:var(--suave);margin-top:2px">'+n.descricao+'</div>':'')+'</div><button onclick="event.stopPropagation();notifDismiss(\'' + n.id + '\')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.8rem;flex-shrink:0;padding:0;line-height:1">✕</button></div>'+(n.acao?'<div style="margin-top:6px"><button onclick="event.stopPropagation();notifExecutar(\'' + n.id + '\')" style="padding:4px 10px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:5px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer">'+(n.acao.label||'Resolver')+'</button></div>':'')+'</div>';
  }).join('');
}

window.notifDismiss  = (id: any) => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(n) n._resolvida=true; notifRenderizar(); };
window.notifExpandir = (id: any) => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(n?.acao) notifExecutar(id); };
window.notifExecutar = (id: any) => { const n=NOTIFICACOES.fila.find(x=>x.id===id); if(!n?.acao) return; if(typeof n.acao.fn==='function') n.acao.fn(n.dados); n._resolvida=true; notifRenderizar(); };

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

async function entrarRPG(rpgId: any){
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
         if(m[0].linked){ RPG_DATA.linked=m[0].linked; FICHAS_VIEW=m[0].linked; CHAR_VIEW=m[0].linked; ATTR_VIEW=CHAR_VIEW; CFG_CHAR=CHAR_VIEW; }
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
   document.querySelectorAll('[data-mestre-only]').forEach(el=>el.style!.display=isMestre?'':'none');
   renderHeader(); renderLore(); renderCharButtons(); renderAttrButtons(); if(typeof renderFichasBtns==='function') renderFichasBtns();
   if (typeof renderDados === 'function') renderDados();
   renderConfig();
   if (typeof renderMapasTab === 'function') renderMapasTab();
   try{mostrarApp(CURRENT_RPG);}catch(e2){}
   ocultarLoading();
   let savedTab=localStorage.getItem('rpghub_tab_'+rpgId);
   // Redirect old tab names to fichas
   if(savedTab==='personagem'||savedTab==='atributos') savedTab='fichas';
   if(savedTab){
     const btn=document.querySelector(`.tab-btn[onclick*="'${savedTab}'"]`);
     const el=document.getElementById('tab-'+savedTab);
     if(btn&&el){ document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); btn.classList.add('active');
       if(savedTab==='fichas'){ if(typeof renderFichasBtns==='function') renderFichasBtns(); if(FICHAS_VIEW&&typeof renderFichaView==='function') renderFichaView(FICHAS_VIEW); }
     }
   }
   iniciarRealtime(rpgId);
   chatMostrar(rpgId);
   _carregarProgressivo(rpgId);
 }catch (e: any){ocultarLoading();mostrarToast('Erro ao carregar RPG: '+(e?.message||e),'erro');console.error('[RPG Hub] entrarRPG erro:', e);}
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

function aplicarTema(rpg: any){
 const t=rpg.theme||{}, root=document.documentElement;
 const s=(k: any,v: any,d: any)=>root.style!.setProperty(k,t[v]||d);
 s('--preto','preto','#080c10');s('--escuro','escuro','#0f1520');s('--painel','painel','#141d2b');
 s('--borda','borda','#1e2d42');s('--cinza','cinza','#2a3a50');s('--texto','texto','#c8d8e8');
 s('--suave','suave','#7a92aa');s('--primario','primario','#4fa3d1');s('--primario-v','primario_v','#7ec8f0');
 s('--destaque','destaque','#c8a84b');s('--destaque-v','destaque_v','#f0cc6a');
 s('--perigo','perigo','#c0392b');s('--sucesso','sucesso','#27ae60');s('--especial','especial','#7b2fbe');
 const fd = t.font_display || t.fontTitulo;
 const ft = t.font_text   || t.fontCorpo;
 const fu = t.font_url;
 if(fd) root.style!.setProperty('--fonte-d',`'${fd}',serif`);
 if(ft) root.style!.setProperty('--fonte-t',`'${ft}',serif`);
 if(fu){let l=document.getElementById('rpg-fonts');if(!l){l=document.createElement('link');l.id='rpg-fonts';l.rel='stylesheet';document.head.appendChild(l);}l.href=fu;}
 document.body.style!.background='var(--preto)';
}

let LOADING_START=0;

function mostrarLoading(rpg: any){
 LOADING_START=Date.now();
 document.getElementById('hub')!.style!.display='none';
 if (rpg.theme && rpg.theme.animation_css) injectCustomCSS(rpg.id, rpg.theme.animation_css);
 const customLoading = (rpg.theme && rpg.theme.animation_loading_svg) || '';
 document.getElementById('loading-anim')!.innerHTML = getLoadingAnimSVG(rpg.theme?.animation||rpg.animation||'flame', customLoading);
 document.getElementById('loading-title')!.textContent=rpg.name;
 document.getElementById('loading')!.classList!.add!('visible')!;
 const el = document.getElementById('loading');
 let escBtn = document.getElementById('loading-esc-btn');
 if (!escBtn) {
   escBtn = document.createElement('button');
   escBtn.id = 'loading-esc-btn';
   escBtn.textContent = '← Voltar ao Hub';
   escBtn.style!.cssText = 'display:none;margin-top:8px;padding:8px 20px;background:transparent;border:1px solid rgba(200,168,75,0.3);border-radius:8px;color:rgba(200,168,75,0.6);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.2s';
   escBtn.onmouseenter = () => { escBtn!.style!.borderColor='rgba(200,168,75,0.7)'; escBtn!.style!.color='rgba(200,168,75,1)'; };
   escBtn.onmouseleave = () => { escBtn!.style!.borderColor='rgba(200,168,75,0.3)'; escBtn!.style!.color='rgba(200,168,75,0.6)'; };
   escBtn.onclick = loadingEscapar;
   el!.appendChild(escBtn);
 }
 escBtn.style!.display = 'none';
 clearTimeout(window._loadingEscTimer);
 clearTimeout(window._loadingMaxTimer);
 window._loadingEscTimer = setTimeout(() => { if (escBtn) escBtn.style!.display = 'block'; }, 3000);
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
 if (el) { el.classList.remove('visible'); el.style!.opacity='1'; el.style!.transition=''; }
 const criar = document.getElementById('criar-screen');
 if (criar) criar.classList.remove('visible');
 document.getElementById('hub')!.style!.display='';
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
   el.style!.opacity='0';el.style!.transition='opacity 0.5s';
   window._loadingHideTimer=setTimeout(()=>{
     el.classList.remove('visible');el.style!.opacity='1';el.style!.transition='';
     const app=document.getElementById('app');
     const criarAtivo = document.getElementById('criar-screen')?.classList.contains('visible');
     const importAtivo = document.getElementById('import-screen')?.style!.display==='block';
     if(app&&!app.classList.contains('visible')&&!importAtivo&&!criarAtivo){
       document.getElementById('hub')!.style!.display='';
     }
   },500);
 },delay);
}

function mostrarApp(rpg: any){
 document.getElementById('app-logo')!.textContent=rpg.name;
 document.getElementById('app')!.classList!.add!('visible')!;
 document.getElementById('btn-delete-rpg')!.style!.display=rpg.id==='dual'?'none':'block';
 document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
 document.querySelectorAll('.tab-content').forEach((c,i)=>c.classList.toggle('active',i===0));
 DADO_SEL=null;HISTORICO=[];
}

function voltarHub(){
 chatOcultar();
 localStorage.removeItem('rpghub_nav');
 fecharRealtime();
 document.getElementById('app')!.classList!.remove!('visible')!;
 document.getElementById('hub')!.style!.display='';
 document.querySelectorAll('[data-mestre-only]').forEach(el=>el.style!.display='');
 CURRENT_RPG=null;RPG_DATA=null;
 document.documentElement.removeAttribute('style');
 document.body.style!.background='';
}

window.selecionarAlvoLista = function(nomeEncodado: any) {
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
  if (badge) badge.style!.display = 'none';
};

console.log('[Hub] Função selecionarAlvoLista registrada ✓');

//banana

// ════════════════════════════════════════════════════════════════════════════
// MODIFICAÇÕES - INTEGRAÇÃO INLINE DO MODAL DE ATAQUE NO PAINEL DE AÇÕES
// Versão COMPLETA - 100% das funcionalidades do FASE 3 implementadas
// ════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// 1. ESTADO GLOBAL E VARIÁVEIS
// ══════════════════════════════════════════════════════════════════════════
// v2.2 - 16/04/2026: Removidas redeclarações de COMBATE, NPC_HABILIDADES_TEMP 
// e ATAQUE_MAPA_STATE - já declaradas em combat.js

// Estado do trigger flutuante
let _TRIGGER_CARD_STATE = {
  visible: false,
  countdown: null as any,
  timerInterval: null as any
};

// ══════════════════════════════════════════════════════════════════════════
// 2. RENDERIZAÇÃO INLINE NO PAINEL DE AÇÕES
// ══════════════════════════════════════════════════════════════════════════

// v2.5 - 16/04/2026: Sistema de animação instantânea para modal inline
async function _mesaDispararAnimacao(atacanteNome: any, alvoNome: any, animacao: any) {
  if (!animacao || animacao.tipo === 'nenhuma') return;
  
  // Obter posições dos tokens
  const tokenAtacante = document.querySelector(`.mapa-token[data-nome="${atacanteNome}"]`);
  const tokenAlvo = document.querySelector(`.mapa-token[data-nome="${alvoNome}"]`);
  
  if (!tokenAtacante || !tokenAlvo) {
    console.warn('[MESA ATK] Tokens não encontrados para animação');
    return;
  }
  
  const rectAtk = tokenAtacante.getBoundingClientRect();
  const rectAlvo = tokenAlvo.getBoundingClientRect();
  
  const origem = {
    x: rectAtk.left + rectAtk.width / 2,
    y: rectAtk.top + rectAtk.height / 2
  };
  
  const alvo: any = {
    x: rectAlvo.left + rectAlvo.width / 2,
    y: rectAlvo.top + rectAlvo.height / 2
  };
  
  // Disparar animação baseado no tipo
  const tipo = animacao.tipo;
  
  if (['gif', 'imagem', 'svg', 'iframe'].includes(tipo)) {
    // Animação de mídia (usa função do maps.js)
    if (typeof _animMedia === 'function') {
      return new Promise(resolve => {
        _animMedia(animacao, origem, alvo, resolve);
      });
    }
  } else if (['projetil', 'onda', 'explosao', 'raio', 'aura'].includes(tipo)) {
    if (typeof animarAtaque === 'function') {
      const repeticoes = Math.max(1, parseInt(animacao.repeticao) || 1);
      for (let i = 0; i < repeticoes; i++) {
        await animarAtaque({ atacEl: tokenAtacante, alvoEl: tokenAlvo, animacao, dano: null });
        if (i < repeticoes - 1) await new Promise(r => setTimeout(r, 120));
      }
      return;
    }
  }

  await new Promise(resolve => setTimeout(resolve, 300));
}

function _mesaRenderAtaqueInline(atacanteNome: any, habilidades: any) {
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
  const contexto = 'campanha';
  const cooldowns = getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);
  
  // STEP 1: Seleção de habilidade
  if (state.step === 1) {
    return '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">⚔ Escolha a habilidade</div>' +
      '<div style="font-size:0.68rem;color:#7a6060;margin-bottom:4px">💡 Use teclas 1-9 para selecionar rapidamente</div>' +
      habilidades
        .filter((h: any) => !h.tipo_habilidade || h.tipo_habilidade === 'acao')
        .slice(0, 9).map((h: any, idx: any) => {
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
          const modAttr = calcModAtributo(h, atacanteNome, contexto);
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
        
        return `<div onclick="${disabled ? `mostrarToast(${JSON.stringify(msgBloqueio)},'erro')` : `_mesaAtaqueInlineSelecionarHab(${idx}, ${JSON.stringify(h).replace(/"/g, '&quot;')})`}"
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
      
      // v2.6: Seção de Pets/Montarias
      (() => {
        const pets = _mesaPetGetPetsDoDono(atacanteNome);
        if (!pets.length) return '';
        
        const donoAtivo = _mesaPetDonoEstaAtivo(atacanteNome);
        const petSections = pets.map(pet => {
          const habilidades = _mesaPetGetHabilidades(pet.nome);
          if (!habilidades.length) return '';
          
          const cor = pet.custom_attrs?.cor || '#7ec8f0';
          const hpAtual = pet.hp_atual ?? (pet.custom_attrs?.hp_max ?? 100);
          const hpMax = pet.custom_attrs?.hp_max ?? 100;
          const incap = hpAtual <= 0;
          
          const habsHtml = habilidades.filter((h: any) => !h.tipo_habilidade || h.tipo_habilidade === 'acao').map((h: any, i: any) => {
            const bloqueio = typeof atkVerificarBloqueioAtaque === 'function' ? atkVerificarBloqueioAtaque(pet.nome, h.tipo_dano) : null;
            const donoAtivoParaTipo = _mesaPetDonoEstaAtivo(atacanteNome, h.tipo_dano);
            const desabilitado = incap || !donoAtivoParaTipo || !!bloqueio;
            const motivo = incap ? 'Pet incapacitado' : !donoAtivoParaTipo ? 'Dono incapacitado para este tipo de ataque' : bloqueio;
            
            const cooldowns = getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);
            const cd = h.id ? (cooldowns[h.id] || 0) : 0;
            const cdLabel = cd > 0 ? ` <span style="color:#c0392b;font-size:0.68rem">(CD: ${cd})</span>` : '';
            
            return `<div onclick="${desabilitado ? `mostrarToast('${motivo}','erro')` : `_mesaAtaquePet('${pet.nome.replace(/'/g, "\\'")}', ${i})`}"
              style="padding:8px 10px;background:rgba(20,12,12,0.6);border:1px solid ${desabilitado?'rgba(60,40,20,0.4)':'rgba(126,200,240,0.2)'};border-radius:6px;cursor:${desabilitado?'default':'pointer'};margin-bottom:4px;transition:all 0.15s"
              ${desabilitado?'':` onmouseenter="this.style.borderColor='rgba(126,200,240,0.45)'" onmouseleave="this.style.borderColor='rgba(126,200,240,0.2)'"`}>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-family:'Cinzel',serif;font-size:0.8rem;color:${desabilitado?'#6a5840':'#7ec8f0'}">${h.nome}${cdLabel}</span>
                ${h.formula_dano?`<span style="font-size:0.7rem;color:#f0cc6a">${h.formula_dano}</span>`:''}
              </div>
              ${h.efeito?`<div style="font-size:0.72rem;color:#7a8898;margin-top:2px">${h.efeito.slice(0,80)}${h.efeito.length>80?'…':''}</div>`:''}
            </div>`;
          }).join('');
          
          return `
            <div style="margin-bottom:8px;padding:10px;background:rgba(10,18,28,0.8);border:1px solid ${cor}22;border-left:2px solid ${cor};border-radius:8px;opacity:${incap||!donoAtivo?0.45:1}">
              <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:${cor};margin-bottom:6px">🐾 ${pet.nome}${incap?' <span style="color:#e74c3c;font-size:0.65rem">[INCAPACITADO]</span>':''}</div>
              ${habsHtml}
            </div>`;
        }).filter(Boolean).join('');
        
        if (!petSections) return '';
        
        return '<div style="border-top:1px solid rgba(126,200,240,0.15);margin-top:12px;padding-top:12px">' +
          '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:rgba(126,200,240,0.5);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Ataques do Pet / Montaria</div>' +
          petSections +
        '</div>';
      })() +
      
      '</div>';
  }
  
  // STEP 2: Seleção de alvo
  if (state.step === 2 && state.habilidadeSel) {
    const h = state.habilidadeSel;
    const alvosDisponiveis = _mesaAtaqueInlineGetAlvos(atacanteNome, h);
    
    // v2.6: Mostrar círculo de alcance a partir do pet se for ataque de pet
    if (h.alcance_celulas != null) {
      const nomeParaAlcance = state._ehAtaquePet ? state._petAtacante : atacanteNome;
      _mesaShowRangeCircle(nomeParaAlcance, h.alcance_celulas);
    }
    
    return '<div style="display:flex;flex-direction:column;gap:6px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
        '<button onclick="_mesaAtaqueInlineVoltar()" style="padding:5px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor=\'rgba(79,163,209,0.4)\'" onmouseleave="this.style.borderColor=\'rgba(79,163,209,0.2)\'">← Voltar</button>' +
        '<div style="flex:1">' +
          '<div style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</div>' +
          (h.alcance_celulas != null ? '<div style="font-size:0.68rem;color:#7a6060">Alcance: ' + h.alcance_celulas + ' células</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">🎯 Escolha o alvo</div>' +
      alvosDisponiveis.map(alvo => {
        const cor = alvo.cor || '#7ec8f0';
        const distCelulas = (alvo as any).distCelulas;
        const foraAlcance = (alvo as any).foraAlcance || (h.alcance_celulas != null && distCelulas != null && distCelulas > h.alcance_celulas);
        
        // v2.6: Warnings de fogo amigo
        const ffWarning = alvo.fogoAmigoForte 
          ? `<span style="color:#f0cc6a;font-size:0.65rem;margin-left:auto;background:rgba(240,204,106,0.15);border:1px solid rgba(240,204,106,0.4);border-radius:4px;padding:2px 6px;font-weight:600">⚠️ FOGO AMIGO</span>`
          : alvo.fogoAmigo 
          ? `<span style="color:#f0a840;font-size:0.62rem;margin-left:auto;background:rgba(240,168,64,0.1);border:1px solid rgba(240,168,64,0.3);border-radius:4px;padding:2px 5px">⚠ atingirá</span>`
          : '';
        
        const bgC = foraAlcance ? 'rgba(20,12,12,0.6)' : 'rgba(20,12,12,0.8)';
        const bdC = alvo.fogoAmigoForte ? 'rgba(240,204,106,0.3)' : foraAlcance ? 'rgba(60,40,20,0.4)' : `${cor}44`;
        const opacity = foraAlcance ? '0.5' : '1';
        
        // v2.6: Informação detalhada de HP e faction
        const hpInfo = `${alvo.hp ?? 0}/${alvo.hpMax ?? 100}`;
        const factionLabel = alvo.faction === 'jogador' ? 'Jogador' : alvo.faction === 'aliado' ? 'Aliado' : alvo.faction === 'neutro' ? 'Neutro' : 'Inimigo';
        
        return `<button ${foraAlcance ? 'disabled' : ''} 
          onclick="${foraAlcance ? `mostrarToast('⚠ Alvo fora do alcance (${distCelulas?.toFixed(1)} de ${h.alcance_celulas} células)','erro')` : `_mesaAtaqueInlineSelecionarAlvo('${alvo.nome.replace(/'/g, "\\'")}')`}"
          style="padding:12px;background:${bgC};border:1px solid ${bdC};border-left:3px solid ${foraAlcance?'#444':cor};border-radius:8px;color:${foraAlcance ? '#6a5840' : cor};font-family:var(--fonte-d);font-size:0.75rem;cursor:${foraAlcance ? 'default' : 'pointer'};text-align:left;width:100%;display:flex;flex-direction:column;gap:6px;transition:all 0.15s;opacity:${opacity}"
          ${foraAlcance ? '' : `onmouseenter="this.style.borderColor='${cor}88'" onmouseleave="this.style.borderColor='${bdC}'"`}>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="flex:1;font-family:'Cinzel',serif;font-size:0.85rem">${alvo.nome}</span>
            ${ffWarning}
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:0.68rem;color:#7a6060">
            <span>${factionLabel}</span>
            <span>·</span>
            <span>HP: ${hpInfo}</span>
            ${distCelulas != null ? `<span>·</span><span>${distCelulas.toFixed(1)}c</span>` : ''}
            ${foraAlcance ? '<span style="color:#c0392b;font-weight:600;margin-left:auto">⚠ FORA DO ALCANCE</span>' : ''}
          </div>
        </button>`;
      }).join('') +
      '</div>';
  }
  
  // STEP 3: Rolagem manual de dados
  if (state.step === 3 && state.habilidadeSel && state.alvoNome) {
    const h = state.habilidadeSel;
    
    // Se ainda não rolou, mostrar botão de rolar
    if (!state.dadosRolados) {
      return '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<button onclick="_mesaAtaqueInlineVoltar()" style="padding:5px 10px;background:rgba(79,163,209,0.08);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;transition:all 0.15s" onmouseenter="this.style.borderColor=\'rgba(79,163,209,0.4)\'" onmouseleave="this.style.borderColor=\'rgba(79,163,209,0.2)\'">← Voltar</button>' +
          '<div style="flex:1;display:flex;flex-direction:column;gap:2px">' +
            '<span style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</span>' +
            '<span style="font-size:0.72rem;color:var(--suave)">→ ' + state.alvoNome + '</span>' +
          '</div>' +
        '</div>' +
        
        // Preview da fórmula
        '<div style="padding:14px;background:rgba(126,200,240,0.05);border:1px solid rgba(126,200,240,0.15);border-radius:8px;text-align:center">' +
          '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Fórmula de dano</div>' +
          '<div style="font-family:\'Courier New\',monospace;font-size:1.1rem;color:#7ec8f0;margin-bottom:6px">' + (h.formula_dano || 'Sem fórmula') + '</div>' +
          (h.atributo_base ? '<div style="font-size:0.7rem;color:#9a8888">+ modificador de ' + h.atributo_base + '</div>' : '') +
        '</div>' +
        
        // Botão de rolar
        '<button onclick="_mesaAtaqueInlineRolar()" id="atk-btn-rolar-inline" ' +
          'style="width:100%;padding:16px;background:linear-gradient(135deg,rgba(240,204,106,0.2),rgba(240,204,106,0.1));border:1px solid rgba(240,204,106,0.4);border-radius:8px;color:#f0cc6a;font-family:var(--fonte-d);font-size:0.85rem;cursor:pointer;text-transform:uppercase;letter-spacing:.12em;transition:all 0.2s;font-weight:600" ' +
          'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(240,204,106,0.6)\'" ' +
          'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(240,204,106,0.4)\'">' +
          '🎲 Rolar Dados (R ou Enter)' +
        '</button>' +
        
        '</div>';
    }
    
    // Se já rolou, mostrar resultado SEM opções de voltar ou re-rolar
    // v2.3 - 16/04/2026: Após rolar dados, só permite confirmar (igual modal original)
    const resultado = state.dadosRolados;
    
    return '<div style="display:flex;flex-direction:column;gap:8px">' +
      // Header sem botão voltar
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:2px">' +
          '<span style="font-family:\'Cinzel\',serif;font-size:0.85rem;color:#e8604c">' + h.nome + '</span>' +
          '<span style="font-size:0.72rem;color:var(--suave)">→ ' + state.alvoNome + '</span>' +
        '</div>' +
      '</div>' +
      
      // v2.6: Resultado com visual diferenciado para Cura/Suporte
      (() => {
        const tipoDano = h.tipo_dano || 'fisico';
        const ehCura = tipoDano === 'cura';
        const ehSuporte = tipoDano === 'suporte' || tipoDano === 'buff';
        
        let label = 'Dano causado';
        let cor = '#f0cc6a';
        let corBorda = 'rgba(200,168,75,0.25)';
        let corFundo = 'rgba(200,168,75,0.1)';
        
        if (ehCura) {
          label = '💚 Cura aplicada';
          cor = '#5ee09a';
          corBorda = 'rgba(94,224,154,0.3)';
          corFundo = 'rgba(94,224,154,0.08)';
        } else if (ehSuporte) {
          label = '✨ Efeito aplicado';
          cor = '#7ec8f0';
          corBorda = 'rgba(126,200,240,0.3)';
          corFundo = 'rgba(126,200,240,0.08)';
        }
        
        return '<div style="padding:16px;background:' + corFundo + ';border:1px solid ' + corBorda + ';border-radius:8px;text-align:center">' +
          '<div style="font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">' + label + '</div>' +
          '<div style="font-family:\'Cinzel\',serif;font-size:2.2rem;color:' + cor + ';margin-bottom:8px;font-weight:600">' + resultado.total + '</div>' +
          '<div style="font-size:0.72rem;color:#9a8888;font-family:\'Courier New\',monospace">' + resultado.detalhes + '</div>' +
          (resultado.rolls ? '<div style="font-size:0.68rem;color:#7a6060;margin-top:6px">Dados: [' + resultado.rolls.join(', ') + ']</div>' : '') +
        '</div>';
      })() +
      
      // v2.6: Botão com visual diferenciado para Cura/Suporte
      (() => {
        const tipoDano = h.tipo_dano || 'fisico';
        const ehCura = tipoDano === 'cura';
        const ehSuporte = tipoDano === 'suporte' || tipoDano === 'buff';
        
        if (ehCura) {
          return '<button onclick="_mesaAtaqueInlineConfirmar()" id="atk-btn-confirmar-inline" ' +
            'style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(94,224,154,0.25),rgba(94,224,154,0.12));border:1px solid rgba(94,224,154,0.5);border-radius:8px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;transition:all 0.2s;font-weight:600;box-shadow:0 4px 12px rgba(94,224,154,0.2)" ' +
            'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(94,224,154,0.7)\';this.style.boxShadow=\'0 6px 16px rgba(94,224,154,0.3)\'" ' +
            'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(94,224,154,0.5)\';this.style.boxShadow=\'0 4px 12px rgba(94,224,154,0.2)\'">' +
            '💚 Aplicar Cura' +
          '</button>';
        } else if (ehSuporte) {
          return '<button onclick="_mesaAtaqueInlineConfirmar()" id="atk-btn-confirmar-inline" ' +
            'style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(126,200,240,0.25),rgba(126,200,240,0.12));border:1px solid rgba(126,200,240,0.5);border-radius:8px;color:#7ec8f0;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;transition:all 0.2s;font-weight:600;box-shadow:0 4px 12px rgba(126,200,240,0.2)" ' +
            'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(126,200,240,0.7)\';this.style.boxShadow=\'0 6px 16px rgba(126,200,240,0.3)\'" ' +
            'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(126,200,240,0.5)\';this.style.boxShadow=\'0 4px 12px rgba(126,200,240,0.2)\'">' +
            '✨ Aplicar Efeito' +
          '</button>';
        } else {
          return '<button onclick="_mesaAtaqueInlineConfirmar()" id="atk-btn-confirmar-inline" ' +
            'style="width:100%;padding:12px;background:linear-gradient(135deg,rgba(192,57,43,0.2),rgba(192,57,43,0.1));border:1px solid rgba(192,57,43,0.4);border-radius:8px;color:#e74c3c;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.1em;transition:all 0.2s;font-weight:600" ' +
            'onmouseenter="this.style.transform=\'scale(1.02)\';this.style.borderColor=\'rgba(192,57,43,0.6)\'" ' +
            'onmouseleave="this.style.transform=\'scale(1)\';this.style.borderColor=\'rgba(192,57,43,0.4)\'">' +
            '⚔ Confirmar Ataque' +
          '</button>';
        }
      })() +
      
      '</div>';
  }
  
  return '';
}

// ══════════════════════════════════════════════════════════════════════════
// 3. FUNÇÕES DE NAVEGAÇÃO DO ATAQUE INLINE
// ══════════════════════════════════════════════════════════════════════════

window._mesaAtaqueInlineSelecionarHab = function(idx: any, habilidade: any) {
  const state = window._MESA_ATK_STATE;
  state.step = 2;
  state.habilidadeSel = habilidade;
  state.alvoNome = null;
  state.dadosRolados = null;
  _mesaRenderAcoes();
  if (state._fromMobile && typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
};

window._mesaAtaqueInlineSelecionarAlvo = function(alvoNome: any) {
  const state = window._MESA_ATK_STATE;
  const h = state.habilidadeSel;

  // Resolver nome do atacante (pet ou personagem do turno)
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const turnoAtual = bs?.participantes?.[bs.ordemAtual];
  const atacanteNome = state._ehAtaquePet
    ? state._petAtacante
    : (turnoAtual?.nome || COMBATE.atacanteNome);

  mapaHideRangeCircle();

  // Resetar state inline — o fluxo passa para o modal de step 3
  state.step = 1;
  state.habilidadeSel = null;
  state.alvoNome = null;
  state.dadosRolados = null;
  state._petAtacante = null;
  state._donoAtacante = null;
  state._ehAtaquePet = false;
  state._fromMobile = false; // reset — o modal overlay assume

  // Cancelar trigger pendente e inicializar COMBATE igual ao fluxo do mapa
  _atkOcultarTrigger();
  COMBATE = {
    contexto: 'campanha',
    atacanteNome,
    habilidadeSel: h,
    alvoNome,
    dadosRolados: null,
    step: 1,
    _habilidades: (typeof atkGetHabilidadesCampanha === 'function' ? atkGetHabilidadesCampanha(atacanteNome) : []),
    _alvos: [],
    formulaBuilder: [],
    rolando: false,
    _jaAplicado: false,
    _pendingTrigger: false,
    _estadoAtk: COMBATE._estadoAtk || 'livre',
    _alvosAoE: null,
  };

  // Atualizar label do atacante no modal (usado em alguns elementos)
  const lblAtacante = document.getElementById('modal-atk-atacante');
  if (lblAtacante) lblAtacante.textContent = atacanteNome;

  // Abrir modal no step 3 (rolagem animada de dados + trigger card)
  _mapaAtaqueAbrirStep3Overlay();
};

window._mesaAtaqueInlineVoltar = function() {
  const state = window._MESA_ATK_STATE;
  
  // v2.3 - 16/04/2026: Bloquear voltar se já rolou dados
  if (state.dadosRolados) {
    mostrarToast('Dados já foram rolados. Confirme ou cancele o ataque.', 'erro');
    return;
  }
  
  if (state.step > 1) {
    state.step--;
    if (state.step === 1) {
      state.habilidadeSel = null;
      state.alvoNome = null;
      state.dadosRolados = null;
      mapaHideRangeCircle();
      if (typeof mapaHideAoECircle === 'function') mapaHideAoECircle();
    } else if (state.step === 2) {
      state.alvoNome = null;
      state.dadosRolados = null;
    }
    _mesaRenderAcoes();
    if (state._fromMobile && typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
  }
};

// v2.6 - 16/04/2026: Iniciar ataque usando pet/montaria
window._mesaAtaquePet = function(petNome: any, habilidadeIdx: any) {
  const state = window._MESA_ATK_STATE;
  const habilidades = _mesaPetGetHabilidades(petNome);
  const h = habilidades[habilidadeIdx];
  if (!h) return;
  
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.[bs.ordemAtual];
  const donoNome = atacante?.nome;
  
  // Guardar info do pet para restaurar depois
  state._petAtacante = petNome;
  state._donoAtacante = donoNome;
  state._ehAtaquePet = true;
  
  // Selecionar habilidade do pet
  state.habilidadeSel = h;
  state.step = 2;
  
  _mesaRenderAcoes();
};

// v2.6 - 16/04/2026: Animação melhorada com efeito visual sequencial de dados rolando
window._mesaAtaqueInlineRolar = async function() {
  const state = window._MESA_ATK_STATE;
  const h = state.habilidadeSel;
  if (!h) return;
  
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.[bs.ordemAtual];
  const atacanteNome = atacante?.nome;
  
  const btn = document.getElementById('atk-btn-rolar-inline');
  if (btn) {
    btn.textContent = '🎲 Rolando...';
    btn.disabled = true;
    btn.style!.opacity = '0.6';
  }
  
  // v2.6: Animação visual de dados rolando (se houver fórmula)
  const formula = h.formula_dano || state._formulaManual;
  if (formula && formula !== '—') {
    const matches = formula.match(/(\d+)d(\d+)/g) || [];
    if (matches.length > 0) {
      // Simular 5 frames de "rolagem" antes do resultado real
      for (let i = 0; i < 5; i++) {
        const valoresSimulados = matches.map((dice: any) => {
          const [qtd, faces] = dice.split('d').map(Number);
          const rolls = Array.from({length: qtd}, () => Math.floor(Math.random() * faces) + 1);
          return rolls.join('+');
        }).join(' | ');
        
        const resultEl = document.getElementById('atk-resultado-inline');
        if (resultEl) {
          resultEl.innerHTML = `
            <div style="text-align:center;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;animation:pulse 0.1s ease">
              <div style="font-size:1.4rem;color:var(--texto-destaque);margin-bottom:4px">
                🎲 ${valoresSimulados}
              </div>
              <div style="font-size:0.65rem;color:var(--texto-secundario)">${formula}</div>
            </div>
          `;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }
  
  // Rolar de verdade
  setTimeout(() => {
    if (formula && formula !== '—') {
      const resultado = rolarFormulaDano(formula, h, atacanteNome, 'campanha');
      state.dadosRolados = resultado;
    } else {
      state.dadosRolados = { total: 0, detalhes: 'Sem dano definido', rolls: [] };
    }
    
    // Vibração de feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    
    _mesaRenderAcoes();
  }, 150);
};

// v2.5 - 16/04/2026: Adicionado disparo de animação da habilidade ANTES de aplicar dano
// v2.6 - 16/04/2026: Suporte completo a ataques com pets
window._mesaAtaqueInlineConfirmar = async function() {
  const state = window._MESA_ATK_STATE;
  const h = state.habilidadeSel;
  const alvo = state.alvoNome;
  const resultado = state.dadosRolados;
  
  if (!h || !alvo || !resultado) return;
  
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.[bs.ordemAtual];
  let atacanteNome = atacante?.nome;
  
  // Verificar e configurar COMBATE para usar a função original
  if (COMBATE._jaAplicado) {
    mostrarToast('⚠ Ataque já foi aplicado!', 'erro');
    return;
  }
  
  // v2.6: Se é ataque de pet, trocar atacante temporariamente
  if (state._ehAtaquePet && state._petAtacante) {
    COMBATE._petAtacante = state._petAtacante;
    COMBATE._donoAtacante = atacanteNome;
    atacanteNome = state._petAtacante; // Pet ataca, mas dono paga custo
  }
  
  // Configurar objeto COMBATE como o modal original faz
  COMBATE.atacanteNome = atacanteNome;
  COMBATE.habilidadeSel = h;
  COMBATE.alvoNome = alvo;
  COMBATE.dadosRolados = resultado;
  COMBATE.contexto = 'campanha';
  COMBATE._alvosAoE = null;
  
  // v2.5: DISPARAR ANIMAÇÃO DA HABILIDADE ANTES DE APLICAR DANO
  // Modal inline dispara instantaneamente (sem delay)
  if (h.animacao && typeof _mesaDispararAnimacao === 'function') {
    try {
      await _mesaDispararAnimacao(atacanteNome, alvo, h.animacao);
    } catch (e) {
      console.warn('[MESA ATK] Erro ao disparar animação:', e);
      // Continua mesmo se animação falhar
    }
  }
  
  // Chamar a função completa que o modal original usa
  // Isso aplica dano, efeitos, cooldown, broadcast e timer de auto-avanço
  if (typeof _atkAplicarDanoFinal === 'function') {
    await _atkAplicarDanoFinal();
  } else {
    // Fallback caso a função não exista (não deveria acontecer)
    console.error('[MESA ATK] Função _atkAplicarDanoFinal não encontrada');
    mostrarToast('Erro ao aplicar ataque', 'erro');
    return;
  }
  
  // v2.6: Restaurar dono após ataque do pet
  if (COMBATE._donoAtacante) {
    COMBATE.atacanteNome = COMBATE._donoAtacante;
    COMBATE._petAtacante = null;
    COMBATE._donoAtacante = null;
  }
  
  // Resetar state do modal inline
  state.step = 1;
  state.habilidadeSel = null;
  state.alvoNome = null;
  state.dadosRolados = null;
  state._petAtacante = null;
  state._donoAtacante = null;
  state._ehAtaquePet = false;
  
  // Re-renderizar ações (já é feito por _finalizarAtaqueCampanha mas garantimos)
  if (typeof _mesaRenderAcoes === 'function') {
    _mesaRenderAcoes();
  }
};

// ══════════════════════════════════════════════════════════════════════════
// 4. BUSCA DE ALVOS
// ══════════════════════════════════════════════════════════════════════════

// v2.6 - 16/04/2026: Sistema completo de faction e fogo amigo
function _mesaAtaqueInlineGetAlvos(atacanteNome: any, habilidade: any) {
  const state = window._MESA_ATK_STATE;
  const h = habilidade;
  const alvoTipo = h?.alvo_tipo || 'inimigo';
  const ehBuff = alvoTipo === 'aliado' || alvoTipo === 'todos_aliados' || h?.tipo_dano === 'cura' || h?.tipo_dano === 'suporte';
  const pvpAtivo = CURRENT_RPG?.theme?.pvp_ativo === true;
  const ffAtivo = CURRENT_RPG?.theme?.fogo_amigo_ativo === true;
  
  // v2.6: Se atacando com pet, usar pet para calcular distância
  const nomeParaDistancia = state?._ehAtaquePet ? state._petAtacante : atacanteNome;
  
  // Helper: retorna a faction efetiva de um personagem
  const _getFaction = (c: any) => {
    const tipo = c.custom_attrs?.tipo_personagem || c.custom_attrs?.tipo || 'jogador';
    if (tipo === 'jogador') return 'jogador';
    return c.custom_attrs?.npc_faction || 'inimigo';
  };
  
  const atacanteChar = (RPG_DATA?.characters||[]).find(x => x.nome === atacanteNome);
  const atacanteFaction = _getFaction(atacanteChar || {});
  
  // Buscar participantes da batalha
  const _bidAtk = BATALHA_ATUAL_ID;
  const _bsAtk = _bidAtk ? MAPA_STATE?.batalhas?.[_bidAtk] : null;
  const _partBatalha = _bsAtk?.participantes?.map((p: any) => p.nome) || null;
  
  let lista = (RPG_DATA?.characters || [])
    .filter(c => {
      // Apenas participantes da batalha
      if (_partBatalha && !_partBatalha.includes(c.nome)) return false;
      
      // Buff em si mesmo é permitido
      if (c.nome === atacanteNome) return ehBuff;
      
      const faction = _getFaction(c);
      const hpOk = (c.hp_atual ?? 0) > 0;
      if (!hpOk) return false;
      
      // GM attacking as NPC (not as their linked PJ) → allow ally targeting with friendly fire
      const _linkedChar = RPG_DATA?.linked;
      const mestreAtacando = RPG_DATA?.myRole === 'mestre' && atacanteNome !== _linkedChar;

      if (ehBuff) {
        // Buff: jogadores e NPCs aliados
        const _isPetAliado = (chr: any) => {
          if (!chr.custom_attrs?.eh_pet) return false;
          const donoNome = chr.custom_attrs?.pet_dono;
          const dono = (RPG_DATA?.characters||[]).find(x => x.nome === donoNome);
          if (!dono) return false;
          const donoFaction = _getFaction(dono);
          return donoFaction === 'jogador' || donoFaction === 'aliado';
        };
        return faction === 'jogador' || faction === 'aliado' || _isPetAliado(c);
      } else {
        // Ataque: inimigos sempre; neutros sempre; aliados/jogadores só com fogo amigo ou mestre
        if (faction === 'inimigo' || faction === 'neutro') return true;
        if (faction === 'aliado') return ffAtivo || mestreAtacando;
        if (faction === 'jogador') return pvpAtivo || ffAtivo || mestreAtacando;
        return false;
      }
    })
    .map(c => {
      const faction = _getFaction(c);
      const ehFogoAmigo = !ehBuff && (faction === 'aliado' || faction === 'jogador' || faction === 'neutro');
      const ehFogoAmigoForte = !ehBuff && (faction === 'aliado' || faction === 'jogador');
      
      return {
        nome: c.nome,
        cor: ehFogoAmigoForte ? '#f0cc6a' : (c.custom_attrs?.cor || (ehBuff ? '#5ee09a' : '#7ec8f0')),
        tipo: c.custom_attrs?.tipo_personagem || c.custom_attrs?.tipo || 'jogador',
        faction,
        fogoAmigo: ehFogoAmigo,
        fogoAmigoForte: ehFogoAmigoForte,
        hp: c.hp_atual ?? (c.custom_attrs?.hp_max??100),
        hpMax: c.custom_attrs?.hp_max??100,
        distancia: null as any
      };
    });
  
  // Calcular distância e alcance
  const alcance = h?.alcance_celulas ?? null;
  if (_bsAtk?.participantes) {
    // v2.6: Usar pet para calcular distância se for ataque de pet
    const atacantePart = _bsAtk.participantes.find((p: any) => p.nome === nomeParaDistancia);
    lista = lista.map(a => {
      const alvoPart = _bsAtk.participantes.find((p: any) => p.nome === a.nome);
      const dist = _calcularDistanciaSegura(atacantePart, alvoPart);
      const foraAlcance = alcance != null && dist != null && dist > alcance;
      return { ...a, distCelulas: dist, foraAlcance };
    });
  }
  
  // Ordenar: alvos fora do alcance por último
  return lista.sort((a, b) => ((a as any).foraAlcance ? 1 : 0) - ((b as any).foraAlcance ? 1 : 0));
}

// ══════════════════════════════════════════════════════════════════════════
// 6. SISTEMA DE PETS
// ══════════════════════════════════════════════════════════════════════════
// v2.6 - 16/04/2026: Sistema completo de pets/montarias

function _mesaPetGetHabilidades(petNome: any) {
  const chars = RPG_DATA?.characters || [];
  const c = chars.find(x => x.nome === petNome);
  if (!c) return [];
  const ca = c.custom_attrs || {};
  if (ca.habilidades?.length) {
    return ca.habilidades.map((h: any) => ({ ...h, cooldown_turnos: h.cooldown_turnos || 0 }));
  }
  // Jogadores com ficha usam atkGetHabilidadesCampanha
  if (typeof atkGetHabilidadesCampanha === 'function') {
    return atkGetHabilidadesCampanha(petNome);
  }
  return [];
}

function _mesaPetGetPetsDoDono(donoNome: any) {
  const chars = RPG_DATA?.characters || [];
  return chars.filter(c => {
    const ca = c.custom_attrs || {};
    return ca.eh_pet === true && ca.pet_dono === donoNome;
  });
}

function _mesaPetDonoEstaAtivo(donoNome: any, tipoDanoHabilidade?: any) {
  const chars = RPG_DATA?.characters || [];
  const dono = chars.find(c => c.nome === donoNome);
  if (!dono) return false;
  const hp = dono.hp_atual ?? (dono.custom_attrs?.hp_max ?? 100);
  if (hp <= 0) return false;
  
  // Verificar debuff sem_ataque
  const buffs = dono.buffs || [];
  const bloqueado = buffs.some(b => b.sem_ataque && (b.sem_ataque_turnos_restantes ?? 0) > 0 && (b.sem_ataque_tipo || 'todos') === 'todos');
  if (bloqueado) return false;
  
  // Verificar bloqueio específico por tipo
  if (tipoDanoHabilidade && typeof atkVerificarBloqueioAtaque === 'function') {
    const bloqueio = atkVerificarBloqueioAtaque(donoNome, tipoDanoHabilidade);
    if (bloqueio) return false;
  }
  
  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// 5. CÁLCULOS E UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════

function _calcularDistanciaSegura(token1: any, token2: any) {
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

function calcularRangeDano(formula: any) {
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

function calcModAtributo(habilidade: any, nomeAtacante: any, contexto: any) {
  const pct = habilidade.mod_atributo_pct;
  const atributo = habilidade.atributo_base;
  if (!pct || !atributo) return 0;

  const chars = contexto === 'arena' ? AR.chars : (RPG_DATA?.characters || []);
  const char = chars.find((c: any) => c.nome === nomeAtacante);
  if (!char) return 0;

  const atrs = char.custom_attrs?.atributos || {};
  // Busca case-insensitive para tolerar variações na capitalização
  const chave = Object.keys(atrs).find(k => k.toLowerCase() === atributo.toLowerCase()) || atributo;
  const valor = parseFloat(atrs[chave] ?? 0);
  return Math.ceil(valor * pct / 100);
}

// v2.4 - 16/04/2026: Adicionada detecção e aplicação de críticos (d20: 1=erro, 18-19=menor, 20=maior)
function rolarFormulaDano(formula: any, habilidade: any, charNome: any, contexto: any) {
  const match = formula.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { total: 0, detalhes: 'Fórmula inválida', rolls: [] as any[], dados: [] as any[] };
  
  const qtd = parseInt(match[1]);
  const faces = parseInt(match[2]);
  const bonus = match[3] ? parseInt(match[3]) : 0;
  
  const modAttr = calcModAtributo(habilidade, charNome, contexto);
  
  const rolls = [];
  const dados = []; // v2.4: Estrutura completa para detecção de crítico
  let soma = 0;
  
  for (let i = 0; i < qtd; i++) {
    const valor = Math.floor(Math.random() * faces) + 1;
    rolls.push(valor);
    dados.push({ faces, valor }); // v2.4: Incluir faces para verificarCritico
    soma += valor;
  }
  
  let total = soma + bonus + modAttr;
  
  // v2.4: Verificar crítico se houver d20
  let criticoInfo = null;
  if (typeof verificarCritico === 'function') {
    criticoInfo = verificarCritico({ dados });
    
    if (criticoInfo.critico) {
      const danoBase = total;
      
      // Aplicar multiplicador de crítico
      if (criticoInfo.tipo === 'critico_menor') {
        total = Math.ceil(total * 1.2);
      } else if (criticoInfo.tipo === 'critico_maior') {
        total = Math.ceil(total * 1.3);
      } else if (criticoInfo.tipo === 'erro') {
        total = 0;
      }
      
      // Mostrar animação de crítico
      if (typeof mostrarAnimacaoCritico === 'function') {
        mostrarAnimacaoCritico(criticoInfo.tipo, charNome, danoBase, total);
      }
    }
  }
  
  const detalhes = `${rolls.join(' + ')}${bonus !== 0 ? ` ${bonus > 0 ? '+' : ''}${bonus}` : ''}${modAttr !== 0 ? ` ${modAttr > 0 ? '+' : ''}${modAttr}` : ''}`;
  
  return { 
    total, 
    detalhes, 
    rolls,
    dados, // v2.4: Incluir para compatibilidade com sistema de críticos
    criticoInfo // v2.4: Informação de crítico para uso posterior
  };
}

function getCooldownsBatalhaSeguro(batalhaId: any) {
  if (typeof getCooldownsBatalha === 'function') {
    return getCooldownsBatalha(batalhaId) || {};
  }
  return {};
}

// ══════════════════════════════════════════════════════════════════════════
// 6. VISUALIZAÇÃO DE ALCANCE NO MAPA
// ══════════════════════════════════════════════════════════════════════════

function _mesaShowRangeCircle(atacanteNome: any, alcance: any) {
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  const atacante = bs?.participantes?.find((p: any) => p.nome === atacanteNome);
  
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
  circle.style!.cssText = `
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

function mapaShowAoECircle(centerPos: any, radius: any) {
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
  circle.style!.cssText = `
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
  
  // Verificação defensiva: garantir que _AOE_STATE existe antes de modificar
  if (typeof _AOE_STATE !== 'undefined' && _AOE_STATE !== null) {
    _AOE_STATE.active = true;
    _AOE_STATE.center = centerPos;
    _AOE_STATE.radius = radius;
  }
  
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
  
  // Verificação defensiva: garantir que _AOE_STATE existe
  if (typeof _AOE_STATE !== 'undefined' && _AOE_STATE !== null) {
    _AOE_STATE.active = false;
    _AOE_STATE.center = null;
    _AOE_STATE.radius = 0;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 7. SISTEMA DE TRIGGER FLUTUANTE
// (implementado em maps.js — _atkMostrarTrigger, _atkOcultarTrigger)
// ══════════════════════════════════════════════════════════════════════════

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

function _estadoBatalhaJogador(nomePersonagem: any) {
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
  const indexPersonagem = bs.participantes.findIndex((p: any) => p.nome === nomePersonagem);
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
// 9. ABERTURA E FECHAMENTO DO MODAL
// ══════════════════════════════════════════════════════════════════════════

function abrirModalAtaque(atacanteNome: any, contexto = 'arena') {
  if (!atacanteNome) {
    mostrarToast('Nenhum personagem selecionado', 'erro');
    return;
  }

  // Verificar estado de batalha para jogadores
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

  // Cancelar qualquer trigger pendente
  _atkOcultarTrigger();

  // Resetar COMBATE
  COMBATE = {
    contexto,
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
    _estadoAtk: COMBATE._estadoAtk || 'livre'
  };

  document.getElementById('modal-atk-atacante')!.textContent = atacanteNome;

  const habilidades = contexto === 'arena'
    ? atkGetHabilidadesArena(atacanteNome)
    : atkGetHabilidadesCampanha(atacanteNome);

  COMBATE._habilidades = habilidades;
  const cooldownsAtivos = contexto === 'arena'
    ? (AR.estado?.cooldowns || {})
    : getCooldownsBatalhaSeguro(BATALHA_ATUAL_ID);

  const lista = document.getElementById('atk-habilidades-lista');
  lista!.innerHTML = habilidades.map((h: any, i: any) => {
    const cdRestante = cooldownsAtivos[h.id] || 0;
    const emCooldown = cdRestante > 0;
    const bloqueio = atkVerificarBloqueioAtaque(atacanteNome, h.tipo_dano);
    const disabled = emCooldown || !!bloqueio;
    const corBorda = disabled ? 'rgba(60,40,20,0.6)' : 'rgba(60,30,30,0.6)';
    const corNome = disabled ? '#6a5840' : '#e8604c';
    
    // Número da tecla (apenas primeiras 9)
    const teclaNum = i < 9 ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;background:rgba(126,200,240,0.1);border:1px solid rgba(126,200,240,0.3);color:#7ec8f0;font-size:0.7rem;font-weight:600;margin-right:8px">${i + 1}</span>` : '';
    
    let badge;
    if (emCooldown) {
      badge = `<span style="font-size:0.65rem;color:#a07040;background:rgba(100,60,0,0.2);border:1px solid rgba(100,60,0,0.3);border-radius:4px;padding:1px 6px">⏳ ${cdRestante}t</span>`;
    } else if (bloqueio) {
      badge = `<span style="font-size:0.65rem;color:#c0392b;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:4px;padding:1px 6px">🚫 Bloq.</span>`;
    } else if (h.formula_dano && h.formula_dano !== '—') {
      const range = calcularRangeDano(h.formula_dano);
      const modAttr = calcModAtributo(h, atacanteNome, contexto);
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
    const msgBloqueio = disabled ? (bloqueio || `Habilidade em recarga: ${cdRestante} turno(s)`) : null;
    
    return `<div onclick="${disabled ? `mostrarToast(${JSON.stringify(msgBloqueio)},'erro')` : `atkSelecionarHabilidade(${i})`}"
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
  }).join('') || '<div style="color:#7a6060;font-style:italic;padding:12px">Nenhuma habilidade disponível</div>';

  // Sistema de ações criativas
  const criatWrap = document.getElementById('atk-criativo-wrap');
  if (criatWrap && temPermissao('ataque_criativo')) {
    const bloqAtk = atkVerificarBloqueioAtaque(atacanteNome, 'fisico')
      || atkVerificarBloqueioAtaque(atacanteNome, 'magico');
    if (bloqAtk) {
      criatWrap.innerHTML = `<div style="padding:10px;color:#e8604c;
        font-size:0.75rem;text-align:center;border:1px solid rgba(232,96,76,0.25);
        border-radius:8px;background:rgba(232,96,76,0.06)">
        🚫 Ação criativa bloqueada — ${bloqAtk}</div>`;
      criatWrap.style!.display = 'block';
    } else {
      criatWrap.style!.display = 'block';
    }
  } else if (criatWrap) {
    criatWrap.style!.display = 'none';
  }
  
const criatDesc = document.getElementById('atk-criativo-desc');
if (criatDesc) criatDesc.value = '';
  
  // Resetar seleção de tipo criativo
  if (typeof criativoSetTipo === 'function') {
    setTimeout(() => {
      criativoSetTipo('ataque');
      criativoSetAlvo('unico');
    }, 50);
  }

  // Aviso fora de combate
  const avisoBanner = document.getElementById('atk-aviso-fora-combate');
  if (avisoBanner) {
    avisoBanner.style!.display = (COMBATE._estadoAtk === 'fora_combate') ? 'block' : 'none';
  }

  // Renderizar seção de pets
  if (typeof atkRenderizarSecaoPets === 'function') {
    atkRenderizarSecaoPets(atacanteNome, contexto);
  }

  // Ir para step 1
  if (typeof atkIrParaStep === 'function') {
    atkIrParaStep(1);
  }

  const modal = document.getElementById('modal-ataque');
  const inner = modal!.querySelector('div');

  modal!._atkModo = null;

  function _setModalModo(modo: any) {
    if (modal!._atkModo === modo) return;
    modal!._atkModo = modo;
    modal!.dataset!.atkModo = modo;
    if (modal!.parentElement !== document.body) document.body.appendChild(modal!);
  }

  // Desktop 3-col → painel de ações direita; mobile sidebar → atk-sidebar-painel
  const _acaoDesktop = document.getElementById('mesa-acao-painel');
  const _sidebarAtk = document.getElementById('atk-sidebar-painel');
  const _targetPanel = _acaoDesktop || _sidebarAtk;
  
  if (_targetPanel && contexto === 'campanha') {
    _setModalModo('painel');
    modal!.style!.cssText = 'display:block;position:static;background:none;z-index:auto;width:100%;';
    if (inner) {
      inner.style!.borderRadius = '10px';
      inner.style!.marginTop = '0';
      inner.style!.paddingBottom = '10px';
      inner.style!.maxHeight = 'none';
    }
    if (_acaoDesktop) {
      _acaoDesktop.innerHTML = '';
      _acaoDesktop.appendChild(modal!);
    } else {
      _sidebarAtk!.innerHTML = '';
      _sidebarAtk!.appendChild(modal!);
      _sidebarAtk!.style!.display = 'block';
    }
    setTimeout(() => _targetPanel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 60);
  } else if (contexto === 'campanha') {
    const anchor = document.getElementById('atk-painel-campanha-anchor');
    // Em mesa fullscreen o painel de ações é reconstruído por _mesaRenderAcoes,
    // então nunca embuta o modal nele — use sempre o overlay fixo
    const emMesa = !!document.getElementById('mesa-col-esq');
    const anchorVisivel = !emMesa && anchor && anchor.offsetParent !== null;
    if (anchorVisivel) {
      _setModalModo('inline');
      modal!.style!.cssText = 'display:block;position:static;background:none;z-index:auto;';
      if (inner) {
        inner.style!.borderRadius = '12px';
        inner.style!.marginTop = '0';
        inner.style!.paddingBottom = '16px';
        inner.style!.maxHeight = 'none';
      }
      let placeholder = document.getElementById('atk-placeholder-campanha');
      if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.id = 'atk-placeholder-campanha';
        anchor.appendChild(placeholder);
      }
      const rect = anchor.getBoundingClientRect();
      modal!.style!.position = 'absolute';
      modal!.style!.top = (rect.top + window.scrollY) + 'px';
      modal!.style!.left = (rect.left + window.scrollX) + 'px';
      modal!.style!.width = rect.width + 'px';
      modal!.style!.zIndex = '8000';
      setTimeout(() => modal!.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } else {
      _setModalModo('overlay');
      modal!.style!.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
      if (inner) {
        inner.style!.borderRadius = '16px 16px 0 0';
        inner.style!.marginTop = '';
        inner.style!.paddingBottom = '44px';
        inner.style!.maxHeight = '90vh';
      }
    }
  } else {
    _setModalModo('overlay');
    modal!.style!.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;align-items:flex-end;justify-content:center;';
    if (inner) {
      inner.style!.borderRadius = '16px 16px 0 0';
      inner.style!.marginTop = '';
      inner.style!.paddingBottom = '44px';
      inner.style!.maxHeight = '90vh';
    }
  }
}

function fecharModalAtaque() {
  const modal = document.getElementById('modal-ataque');
  const foiCancelado = !COMBATE._jaAplicado && !COMBATE._pendingTrigger;
  
  modal!.style!.display = 'none';
  
  // Devolver modal ao body
  const _acaoDesktop2 = document.getElementById('mesa-acao-painel');
  const sidebarAtk = document.getElementById('atk-sidebar-painel');
  
  if (_acaoDesktop2 && modal!.parentElement === _acaoDesktop2) {
    document.body.appendChild(modal!);
    setTimeout(() => _mesaRenderAcoes?.(), 50);
  } else if (sidebarAtk && modal!.parentElement === sidebarAtk) {
    sidebarAtk.style!.display = 'none';
    document.body.appendChild(modal!);
  }
  
  if (modal!.parentElement?.id === 'atk-painel-campanha-anchor') {
    document.body.appendChild(modal!);
  }
  
  // Limpar visualizações
  mapaHideRangeCircle();
  if (typeof mapaHideAoECircle === 'function') {
    mapaHideAoECircle();
  }
  
  // Limpar modo de ataque no mapa
  if (ATAQUE_MAPA_STATE.ativo) {
    ATAQUE_MAPA_STATE = { ativo: false, atacanteNome: null, fase: 'habilidades' };
    const floatPanel = document.getElementById('atk-mapa-float-panel');
    if (floatPanel) floatPanel.style!.display = 'none';
    document.querySelectorAll('.mapa-token').forEach(el => {
      el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
    });
  }
  
  // Se há ataque pendente, mostrar trigger
  if (COMBATE._pendingTrigger) {
    COMBATE._pendingTrigger = false;
    _atkMostrarTrigger();
    return;
  }
  
  // Se foi cancelado, re-renderizar UI
  if (foiCancelado && COMBATE.contexto === 'campanha') {
    if (typeof _aplicarEstadoBatalhaUI === 'function') {
      _aplicarEstadoBatalhaUI();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 10. ATALHOS DE TECLADO
// ══════════════════════════════════════════════════════════════════════════

function configurarAtalhosCombate() {
  document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('modal-ataque');
    if (!modal || modal.style!.display === 'none') return;
    
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
      const btnRolar = document.getElementById('atk-btn-rolar-inline');
      const btnConfirmar = document.getElementById('atk-btn-confirmar-inline');
      
      if (btnRolar && !btnRolar.disabled && btnRolar.style!.display !== 'none') {
        _mesaAtaqueInlineRolar();
      } else if (btnConfirmar && btnConfirmar.style!.display !== 'none') {
        _mesaAtaqueInlineConfirmar();
      }
    }
    // Escape: Fechar
    else if (e.key === 'Escape') {
      e.preventDefault();
      fecharModalAtaque();
    }
    // R: Rolar
    else if (e.key === 'r' || e.key === 'R') {
      const btnRolar = document.getElementById('atk-btn-rolar-inline');
      if (btnRolar && !btnRolar.disabled && btnRolar.style!.display !== 'none') {
        e.preventDefault();
        _mesaAtaqueInlineRolar();
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

function ativarModoAtaqueMapa(atacanteNome: any) {
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
    panel.style!.cssText = `
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
  
  panel.style!.display = 'block';
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
  if (panel) panel.style!.display = 'none';
  
  // Remover destaque dos tokens
  document.querySelectorAll('.mapa-token').forEach(el => {
    el.classList.remove('atk-target-disponivel', 'atk-target-fora-alcance', 'atk-target-buff');
  });
}

function _marcarAlvosDisponiveis(atacanteNome: any) {
  const bs = BATALHA_ATUAL_ID ? MAPA_STATE.batalhas[BATALHA_ATUAL_ID] : null;
  if (!bs || !bs.participantes) return;
  
  const atacante = bs.participantes.find((p: any) => p.nome === atacanteNome);
  if (!atacante) return;
  
  bs.participantes.forEach((p: any) => {
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

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaModoVerificar", { configurable: true, get: () => mesaModoVerificar, set: (__v) => { mesaModoVerificar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaInjetarColunas", { configurable: true, get: () => _mesaInjetarColunas, set: (__v) => { _mesaInjetarColunas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderizarColunas", { configurable: true, get: () => _mesaRenderizarColunas, set: (__v) => { _mesaRenderizarColunas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaAjustarMapa", { configurable: true, get: () => _mesaAjustarMapa, set: (__v) => { _mesaAjustarMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaToolbarSetup", { configurable: true, get: () => _mesaToolbarSetup, set: (__v) => { _mesaToolbarSetup = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaPinToggle", { configurable: true, get: () => mesaPinToggle, set: (__v) => { mesaPinToggle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaHudDraggableInit", { configurable: true, get: () => _mesaHudDraggableInit, set: (__v) => { _mesaHudDraggableInit = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaHudAutoPositionar", { configurable: true, get: () => _mesaHudAutoPositionar, set: (__v) => { _mesaHudAutoPositionar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mesaTogglePainel", { configurable: true, get: () => mesaTogglePainel, set: (__v) => { mesaTogglePainel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderCombatHud", { configurable: true, get: () => _mesaRenderCombatHud, set: (__v) => { _mesaRenderCombatHud = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderChars", { configurable: true, get: () => _mesaRenderChars, set: (__v) => { _mesaRenderChars = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderIniciativa", { configurable: true, get: () => _mesaRenderIniciativa, set: (__v) => { _mesaRenderIniciativa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderBarraSkills", { configurable: true, get: () => _mesaRenderBarraSkills, set: (__v) => { _mesaRenderBarraSkills = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderAcoes", { configurable: true, get: () => _mesaRenderAcoes, set: (__v) => { _mesaRenderAcoes = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaAtacarHab", { configurable: true, get: () => _mesaAtacarHab, set: (__v) => { _mesaAtacarHab = __v; } });
Object.defineProperty(globalThis, "FEED_MESA", { configurable: true, get: () => FEED_MESA });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "feedAdicionarEntrada", { configurable: true, get: () => feedAdicionarEntrada, set: (__v) => { feedAdicionarEntrada = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "feedRenderizar", { configurable: true, get: () => feedRenderizar, set: (__v) => { feedRenderizar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "barraContextoInicializar", { configurable: true, get: () => barraContextoInicializar, set: (__v) => { barraContextoInicializar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "barraContextoAtualizar", { configurable: true, get: () => barraContextoAtualizar, set: (__v) => { barraContextoAtualizar = __v; } });
Object.defineProperty(globalThis, "NOTIFICACOES", { configurable: true, get: () => NOTIFICACOES });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "notifAdicionar", { configurable: true, get: () => notifAdicionar, set: (__v) => { notifAdicionar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "notifRenderizar", { configurable: true, get: () => notifRenderizar, set: (__v) => { notifRenderizar = __v; } });
Object.defineProperty(globalThis, "_origCombateBroadcast5", { configurable: true, get: () => _origCombateBroadcast5 });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "entrarRPG", { configurable: true, get: () => entrarRPG, set: (__v) => { entrarRPG = __v; } });
Object.defineProperty(globalThis, "_origEntrarRPGF5", { configurable: true, get: () => _origEntrarRPGF5 });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "aplicarTema", { configurable: true, get: () => aplicarTema, set: (__v) => { aplicarTema = __v; } });
Object.defineProperty(globalThis, "LOADING_START", { configurable: true, get: () => LOADING_START, set: (__v) => { LOADING_START = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarLoading", { configurable: true, get: () => mostrarLoading, set: (__v) => { mostrarLoading = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "loadingEscapar", { configurable: true, get: () => loadingEscapar, set: (__v) => { loadingEscapar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "ocultarLoading", { configurable: true, get: () => ocultarLoading, set: (__v) => { ocultarLoading = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mostrarApp", { configurable: true, get: () => mostrarApp, set: (__v) => { mostrarApp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "voltarHub", { configurable: true, get: () => voltarHub, set: (__v) => { voltarHub = __v; } });
Object.defineProperty(globalThis, "_TRIGGER_CARD_STATE", { configurable: true, get: () => _TRIGGER_CARD_STATE, set: (__v) => { _TRIGGER_CARD_STATE = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaDispararAnimacao", { configurable: true, get: () => _mesaDispararAnimacao, set: (__v) => { _mesaDispararAnimacao = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaRenderAtaqueInline", { configurable: true, get: () => _mesaRenderAtaqueInline, set: (__v) => { _mesaRenderAtaqueInline = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaAtaqueInlineGetAlvos", { configurable: true, get: () => _mesaAtaqueInlineGetAlvos, set: (__v) => { _mesaAtaqueInlineGetAlvos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaPetGetHabilidades", { configurable: true, get: () => _mesaPetGetHabilidades, set: (__v) => { _mesaPetGetHabilidades = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaPetGetPetsDoDono", { configurable: true, get: () => _mesaPetGetPetsDoDono, set: (__v) => { _mesaPetGetPetsDoDono = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaPetDonoEstaAtivo", { configurable: true, get: () => _mesaPetDonoEstaAtivo, set: (__v) => { _mesaPetDonoEstaAtivo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_calcularDistanciaSegura", { configurable: true, get: () => _calcularDistanciaSegura, set: (__v) => { _calcularDistanciaSegura = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "calcularRangeDano", { configurable: true, get: () => calcularRangeDano, set: (__v) => { calcularRangeDano = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "calcModAtributo", { configurable: true, get: () => calcModAtributo, set: (__v) => { calcModAtributo = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "rolarFormulaDano", { configurable: true, get: () => rolarFormulaDano, set: (__v) => { rolarFormulaDano = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "getCooldownsBatalhaSeguro", { configurable: true, get: () => getCooldownsBatalhaSeguro, set: (__v) => { getCooldownsBatalhaSeguro = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_mesaShowRangeCircle", { configurable: true, get: () => _mesaShowRangeCircle, set: (__v) => { _mesaShowRangeCircle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mapaHideRangeCircle", { configurable: true, get: () => mapaHideRangeCircle, set: (__v) => { mapaHideRangeCircle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mapaShowAoECircle", { configurable: true, get: () => mapaShowAoECircle, set: (__v) => { mapaShowAoECircle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "mapaHideAoECircle", { configurable: true, get: () => mapaHideAoECircle, set: (__v) => { mapaHideAoECircle = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_estadoBatalhaJogador", { configurable: true, get: () => _estadoBatalhaJogador, set: (__v) => { _estadoBatalhaJogador = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalAtaque", { configurable: true, get: () => abrirModalAtaque, set: (__v) => { abrirModalAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalAtaque", { configurable: true, get: () => fecharModalAtaque, set: (__v) => { fecharModalAtaque = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "configurarAtalhosCombate", { configurable: true, get: () => configurarAtalhosCombate, set: (__v) => { configurarAtalhosCombate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "ativarModoAtaqueMapa", { configurable: true, get: () => ativarModoAtaqueMapa, set: (__v) => { ativarModoAtaqueMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "desativarModoAtaqueMapa", { configurable: true, get: () => desativarModoAtaqueMapa, set: (__v) => { desativarModoAtaqueMapa = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_marcarAlvosDisponiveis", { configurable: true, get: () => _marcarAlvosDisponiveis, set: (__v) => { _marcarAlvosDisponiveis = __v; } });
