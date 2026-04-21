/* =====================================================================
 *  maps-grid-core.js  —  Núcleo de Grid Tático (drop-in)
 *  ---------------------------------------------------------------------
 *  Inclua DEPOIS de  js/state.js  e  js/maps/cenario.js
 *  Inclua ANTES (ou depois) de  js/maps/maps.js  — é defensivo.
 *
 *  Objetivo:
 *    - Tornar a grid tática visualmente dominante (linhas sutis sempre
 *      visíveis, hover, snap, range de movimento BFS, range de ataque,
 *      pintura de células de terreno, medição Chebyshev, paredes/portas)
 *    - SEM quebrar nenhuma API pública listada em mapeamento.md:
 *        MAPA_STATE, MAPA_ZOOM, BATALHA_ATUAL_ID, RPG_DATA,
 *        _getMapaById, getPosicaoNoMapa, pctParaCelula, setCharActiveMap,
 *        tokenMoveReceber, mapaRenderTokens, mapaRenderStatus,
 *        mapaRenderCanvas, mapaDesenharGrade, mapaHideRangeCircle,
 *        mapaHideAoECircle, selecionarMapa, renderMapaViewer,
 *        renderMapasTab, _mapaInicializarLayout, mapaIsTatico
 *
 *  Estratégia: ESTENDER por monkey-patch (padrão já usado pelo
 *  combat-overlays — ver _origMRTokens7 / _origMapaRenderCanvas7),
 *  nunca substituir.
 * ===================================================================== */
(function () {
  'use strict';

  // ───────────────────────────────────────────────────────────────────
  // 0) Guarda contra dupla inclusão
  // ───────────────────────────────────────────────────────────────────
  if (window.__MAPS_GRID_CORE_LOADED__) return;
  window.__MAPS_GRID_CORE_LOADED__ = true;

  // ───────────────────────────────────────────────────────────────────
  // 1) Estado interno do núcleo (não polui MAPA_STATE)
  //    Tudo é re-derivado a cada render — nada de cache desatualizado.
  // ───────────────────────────────────────────────────────────────────
  const GRID = window.__GRID_TACTICAL__ = {
    hover:     null,            // {col,row}
    selectedToken: null,        // nome do char selecionado p/ ranges
    moveCells: [],              // [{col,row,custo}]
    attackCells: [],            // [{col,row}]
    measure:   { from:null, to:null },
    paint: {
      ativo: false,
      brush: 'dificil',         // 'dificil'|'fogo'|'gelo'|'agua'|'sagrado'|'obstaculo'|'limpar'
    },
    flags: {
      showGrid:        true,
      showSuperficies: true,
      showRanges:      true,
      showNomes:       true,
    },
    BRUSHES: {
      dificil:   { cor:'#a07a3c', icon:'🟫', label:'Terreno difícil', custoMov:1, dano:0 },
      fogo:      { cor:'#e8604c', icon:'🔥', label:'Fogo',           custoMov:0, dano:5 },
      gelo:      { cor:'#7ec8f0', icon:'🟦', label:'Gelo',           custoMov:1, dano:0 },
      agua:      { cor:'#4f9fd1', icon:'💧', label:'Água',           custoMov:1, dano:0 },
      sagrado:   { cor:'#f0d97e', icon:'✨', label:'Solo sagrado',    custoMov:0, dano:0 },
      obstaculo: { cor:'#3a3a3a', icon:'⬛', label:'Obstáculo',       custoMov:99, dano:0 },
    },
  };

  // ───────────────────────────────────────────────────────────────────
  // 2) Helpers geométricos (cell ↔ pixel) e Chebyshev
  // ───────────────────────────────────────────────────────────────────
  function _mapaAtual() {
    const id = window.MAPA_STATE && window.MAPA_STATE.mapaAtualId;
    if (!id || !window.RPG_DATA || !window.RPG_DATA.mapas) return null;
    const entry = window.RPG_DATA.mapas.find(l => l.mapa.map_id === id);
    return entry ? entry.mapa : null;
  }

  function _gridDims(m, w, h) {
    const cols = m.largura_total || 20;
    const rows = m.altura_total  || 20;
    return { cols, rows, cW: w / cols, cH: h / rows };
  }

  function _pixelToCell(m, xPx, yPx, wPx, hPx) {
    const { cols, rows, cW, cH } = _gridDims(m, wPx, hPx);
    const col = Math.max(0, Math.min(cols - 1, Math.floor(xPx / cW)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(yPx / cH)));
    return { col, row };
  }

  function _cellCenterPx(m, col, row, wPx, hPx) {
    const { cW, cH } = _gridDims(m, wPx, hPx);
    return { x: (col + 0.5) * cW, y: (row + 0.5) * cH };
  }

  function _chebyshev(a, b) {
    return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
  }

  // ───────────────────────────────────────────────────────────────────
  // 3) Acesso a paredes/portas/superfícies (compatível com cenario.js)
  //    cenario.js armazena paredes em m.paredes  (linhas/segmentos)
  //    Mantemos formato genérico:  {cx1,cy1,cx2,cy2,tipo,aberta?}
  //    Marcações nativas vivem em m.superficies = [{col,row,tipo,...}]
  // ───────────────────────────────────────────────────────────────────
  function _paredes(m)     { return Array.isArray(m && m.paredes)     ? m.paredes     : []; }
  function _superficies(m) { return Array.isArray(m && m.superficies) ? m.superficies : []; }

  // Bloqueio de movimento entre duas células ortogonalmente adjacentes
  function _arestaBloqueada(m, a, b) {
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    const horizontal = (a.row === b.row); // movimento → atravessa aresta vertical
    for (const p of _paredes(m)) {
      if (p.tipo === 'porta' && p.aberta) continue;
      // aresta entre (col,row)-(col+1,row) é "horizontal", entre (col,row)-(col,row+1) é "vertical"
      if (horizontal) {
        // aresta vertical em x = maxC, entre y=minR e y=minR+1
        const ex = maxC;
        if (
          (p.cx1 === ex && p.cx2 === ex) &&
          ((p.cy1 === minR && p.cy2 === minR + 1) || (p.cy1 === minR + 1 && p.cy2 === minR))
        ) return true;
      } else {
        const ey = maxR;
        if (
          (p.cy1 === ey && p.cy2 === ey) &&
          ((p.cx1 === minC && p.cx2 === minC + 1) || (p.cx1 === minC + 1 && p.cx2 === minC))
        ) return true;
      }
    }
    return false;
  }

  function _custoEntrar(m, col, row) {
    const sup = _superficies(m).find(s => s.col === col && s.row === row);
    if (!sup) return 1;
    if (sup.custoMov >= 99) return Infinity;
    return 1 + (sup.custoMov || 0);
  }

  // ───────────────────────────────────────────────────────────────────
  // 4) BFS / Dijkstra para range de movimento
  // ───────────────────────────────────────────────────────────────────
  function _calcularMoveRange(m, origem, velocidade, opts) {
    opts = opts || {};
    const { cols, rows } = _gridDims(m, 1, 1);
    const visit = new Map();
    const key = (c,r) => c + ',' + r;
    visit.set(key(origem.col, origem.row), 0);
    // priority queue simples (velocidade pequena, ok)
    const heap = [{ col: origem.col, row: origem.row, g: 0 }];
    const out  = [];
    const dirs = [
      {dc:1,dr:0},{dc:-1,dr:0},{dc:0,dr:1},{dc:0,dr:-1},
      {dc:1,dr:1},{dc:1,dr:-1},{dc:-1,dr:1},{dc:-1,dr:-1},
    ];
    while (heap.length) {
      heap.sort((a,b) => a.g - b.g);
      const cur = heap.shift();
      out.push({ col: cur.col, row: cur.row, custo: cur.g });
      for (const d of dirs) {
        const nc = cur.col + d.dc, nr = cur.row + d.dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        // diagonal: bloqueia se ambos os lados ortogonais estiverem bloqueados
        if (d.dc !== 0 && d.dr !== 0) {
          const lateral1 = _arestaBloqueada(m, {col:cur.col,row:cur.row}, {col:nc,row:cur.row});
          const lateral2 = _arestaBloqueada(m, {col:cur.col,row:cur.row}, {col:cur.col,row:nr});
          if (lateral1 && lateral2) continue;
        } else {
          if (_arestaBloqueada(m, {col:cur.col,row:cur.row}, {col:nc,row:nr})) continue;
        }
        const c = _custoEntrar(m, nc, nr);
        if (!isFinite(c)) continue;
        const ng = cur.g + c;
        if (ng > velocidade) continue;
        const k = key(nc, nr);
        if (visit.has(k) && visit.get(k) <= ng) continue;
        visit.set(k, ng);
        heap.push({ col: nc, row: nr, g: ng });
      }
    }
    return out.filter(c => !(c.col === origem.col && c.row === origem.row));
  }

  function _calcularAttackRange(m, origem, alcance) {
    const { cols, rows } = _gridDims(m, 1, 1);
    const out = [];
    for (let r = Math.max(0, origem.row - alcance); r <= Math.min(rows - 1, origem.row + alcance); r++) {
      for (let c = Math.max(0, origem.col - alcance); c <= Math.min(cols - 1, origem.col + alcance); c++) {
        if (c === origem.col && r === origem.row) continue;
        if (_chebyshev({col:c,row:r}, origem) <= alcance) out.push({ col:c, row:r });
      }
    }
    return out;
  }

  // ───────────────────────────────────────────────────────────────────
  // 5) Camada SVG sobreposta (.grid-tactical-svg)
  //    Inserida dentro de #mapa-wrap, acima do canvas e abaixo dos tokens
  // ───────────────────────────────────────────────────────────────────
  function _ensureSvgLayer() {
    const wrap = document.getElementById('mapa-wrap');
    if (!wrap) return null;
    let svg = wrap.querySelector('svg.grid-tactical-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'grid-tactical-svg');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      // Inserir logo após o canvas, antes de #mapa-tokens
      const tokensEl = document.getElementById('mapa-tokens');
      if (tokensEl && tokensEl.parentElement === wrap) {
        wrap.insertBefore(svg, tokensEl);
      } else {
        wrap.appendChild(svg);
      }
    }
    return svg;
  }

  function _renderSvgLayer() {
    const m = _mapaAtual();
    const wrap = document.getElementById('mapa-wrap');
    const svg  = _ensureSvgLayer();
    if (!m || !wrap || !svg) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    const { cols, rows, cW, cH } = _gridDims(m, w, h);
    const ns = 'http://www.w3.org/2000/svg';
    let html = '';

    // 5.1 — Linhas sutis sempre visíveis
    if (GRID.flags.showGrid) {
      let lines = '';
      for (let c = 0; c <= cols; c++) {
        const x = c * cW;
        lines += '<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+h+'" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>';
      }
      for (let r = 0; r <= rows; r++) {
        const y = r * cH;
        lines += '<line x1="0" y1="'+y+'" x2="'+w+'" y2="'+y+'" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>';
      }
      html += '<g class="gt-grid">' + lines + '</g>';
    }

    // 5.2 — Superfícies pintadas (terreno difícil, fogo, gelo...)
    if (GRID.flags.showSuperficies) {
      let g = '';
      for (const s of _superficies(m)) {
        const x = s.col * cW, y = s.row * cH;
        const def = GRID.BRUSHES[s.tipo] || { cor: s.cor || '#888', icon: s.icon || '', label: s.label || s.tipo };
        const cor = s.cor || def.cor;
        g += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" fill="'+cor+'" fill-opacity="0.32" stroke="'+cor+'" stroke-opacity="0.55" stroke-width="1"/>';
        g += '<text x="'+(x+cW/2)+'" y="'+(y+cH/2+cH*0.18)+'" text-anchor="middle" font-size="'+(cH*0.55)+'" opacity="0.85">'+(s.icon||def.icon||'')+'</text>';
      }
      html += '<g class="gt-sup">' + g + '</g>';
    }

    // 5.3 — Range de movimento (azul) e ataque (laranja)
    if (GRID.flags.showRanges) {
      if (GRID.moveCells.length) {
        let g = '';
        for (const c of GRID.moveCells) {
          const x = c.col * cW, y = c.row * cH;
          g += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" fill="#4fa3d1" fill-opacity="0.22" stroke="#4fa3d1" stroke-opacity="0.55" stroke-width="1"/>';
        }
        html += '<g class="gt-move">' + g + '</g>';
      }
      if (GRID.attackCells.length) {
        let g = '';
        for (const c of GRID.attackCells) {
          const x = c.col * cW, y = c.row * cH;
          g += '<rect x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" fill="#e8604c" fill-opacity="0.18" stroke="#e8604c" stroke-opacity="0.5" stroke-width="1"/>';
        }
        html += '<g class="gt-atk">' + g + '</g>';
      }
    }

    // 5.4 — Paredes (linhas grossas) e portas (clicáveis via overlay HTML em 5.7)
    let pg = '';
    for (const p of _paredes(m)) {
      const x1 = p.cx1 * cW, y1 = p.cy1 * cH, x2 = p.cx2 * cW, y2 = p.cy2 * cH;
      if (p.tipo === 'porta') {
        const cor = p.aberta ? '#7ec8f0' : '#c8a84b';
        pg += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+cor+'" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+(p.aberta?'4 4':'')+'"/>';
      } else {
        pg += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"/>';
        pg += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#000" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>';
      }
    }
    html += '<g class="gt-walls">' + pg + '</g>';

    // 5.5 — Hover de célula
    if (GRID.hover) {
      const x = GRID.hover.col * cW, y = GRID.hover.row * cH;
      html += '<rect class="gt-hover" x="'+x+'" y="'+y+'" width="'+cW+'" height="'+cH+'" fill="rgba(126,200,240,0.18)" stroke="#7ec8f0" stroke-width="1.5"/>';
    }

    // 5.6 — Medição
    if (GRID.measure.from && GRID.measure.to) {
      const a = _cellCenterPx(m, GRID.measure.from.col, GRID.measure.from.row, w, h);
      const b = _cellCenterPx(m, GRID.measure.to.col,   GRID.measure.to.row,   w, h);
      const dist = _chebyshev(GRID.measure.from, GRID.measure.to);
      const escala = m.escala_val ? (' = ' + (dist * m.escala_val) + (m.escala_unit||'m')) : '';
      html += '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#f0d97e" stroke-width="2" stroke-dasharray="6 4"/>';
      html += '<circle cx="'+a.x+'" cy="'+a.y+'" r="5" fill="#f0d97e"/>';
      html += '<circle cx="'+b.x+'" cy="'+b.y+'" r="5" fill="#f0d97e"/>';
      html += '<rect x="'+(b.x+10)+'" y="'+(b.y-22)+'" width="'+(escala?140:70)+'" height="22" rx="4" fill="rgba(0,0,0,0.75)"/>';
      html += '<text x="'+(b.x+18)+'" y="'+(b.y-7)+'" fill="#f0d97e" font-size="13" font-weight="600">'+dist+' cél.'+escala+'</text>';
    }

    svg.innerHTML = html;
  }

  // 5.7 — Overlay HTML para portas clicáveis (porque SVG está com pointer-events:none)
  function _renderPortasClicaveis() {
    const m = _mapaAtual();
    const wrap = document.getElementById('mapa-wrap');
    if (!m || !wrap) return;
    let layer = wrap.querySelector('.gt-portas-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'gt-portas-layer';
      layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
      wrap.appendChild(layer);
    }
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const { cW, cH } = _gridDims(m, w, h);
    let html = '';
    for (const p of _paredes(m)) {
      if (p.tipo !== 'porta') continue;
      const x = Math.min(p.cx1, p.cx2) * cW, y = Math.min(p.cy1, p.cy2) * cH;
      const ww = Math.max(8, Math.abs(p.cx2 - p.cx1) * cW), hh = Math.max(8, Math.abs(p.cy2 - p.cy1) * cH);
      html += '<button data-porta-id="'+(p.id||'')+'" title="'+(p.aberta?'Fechar porta':'Abrir porta')+'" '+
              'style="position:absolute;left:'+(x-6)+'px;top:'+(y-6)+'px;width:'+(ww+12)+'px;height:'+(hh+12)+'px;'+
              'background:transparent;border:0;cursor:pointer;pointer-events:auto;"></button>';
    }
    layer.innerHTML = html;
    layer.querySelectorAll('button[data-porta-id]').forEach(btn => {
      btn.onclick = function () {
        const id = btn.getAttribute('data-porta-id');
        const porta = _paredes(m).find(p => String(p.id||'') === String(id));
        if (!porta) return;
        porta.aberta = !porta.aberta;
        // Recalcular ranges se houver token selecionado
        if (GRID.selectedToken) gridTacticalShowMoveRange(GRID.selectedToken);
        _renderSvgLayer();
        _renderPortasClicaveis();
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // 6) Interação: hover, clique p/ pintar, clique p/ medir
  // ───────────────────────────────────────────────────────────────────
  function _bindWrapInteractions() {
    const wrap = document.getElementById('mapa-wrap');
    if (!wrap || wrap.__gtBound) return;
    wrap.__gtBound = true;

    wrap.addEventListener('mousemove', function (e) {
      const m = _mapaAtual();
      if (!m) return;
      const r = wrap.getBoundingClientRect();
      const cell = _pixelToCell(m, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      if (!GRID.hover || GRID.hover.col !== cell.col || GRID.hover.row !== cell.row) {
        GRID.hover = cell;
        _renderSvgLayer();
      }
      // Drag-paint
      if (GRID.paint.ativo && e.buttons === 1) {
        _aplicarBrush(m, cell);
      }
    });
    wrap.addEventListener('mouseleave', function () { GRID.hover = null; _renderSvgLayer(); });

    wrap.addEventListener('click', function (e) {
      // só processa clique no fundo / no canvas / no svg
      const tgt = e.target;
      const okFundo = (tgt === wrap) || tgt.id === 'mapa-img' || tgt.id === 'mapa-canvas' || (tgt.classList && tgt.classList.contains('grid-tactical-svg'));
      if (!okFundo) return;
      const m = _mapaAtual();
      if (!m) return;
      const r = wrap.getBoundingClientRect();
      const cell = _pixelToCell(m, e.clientX - r.left, e.clientY - r.top, r.width, r.height);

      if (GRID.paint.ativo) { _aplicarBrush(m, cell); return; }

      if (window.MAPA_STATE && window.MAPA_STATE.toolMode === 'medicao') {
        if (!GRID.measure.from) GRID.measure.from = cell;
        else if (!GRID.measure.to) GRID.measure.to = cell;
        else { GRID.measure.from = cell; GRID.measure.to = null; }
        _renderSvgLayer();
        return;
      }

      // Clique fora limpa seleção / medição
      GRID.selectedToken = null;
      GRID.moveCells = [];
      GRID.attackCells = [];
      GRID.measure = { from:null, to:null };
      _renderSvgLayer();
    });

    wrap.addEventListener('contextmenu', function (e) {
      if (!GRID.paint.ativo) return;
      e.preventDefault();
      const m = _mapaAtual();
      if (!m) return;
      const r = wrap.getBoundingClientRect();
      const cell = _pixelToCell(m, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      _removerSuperficie(m, cell);
    });

    if (window.ResizeObserver && !wrap.__gtResize) {
      wrap.__gtResize = new ResizeObserver(() => { _renderSvgLayer(); _renderPortasClicaveis(); });
      wrap.__gtResize.observe(wrap);
    }
  }

  function _aplicarBrush(m, cell) {
    if (!Array.isArray(m.superficies)) m.superficies = [];
    if (GRID.paint.brush === 'limpar') { _removerSuperficie(m, cell); return; }
    const def = GRID.BRUSHES[GRID.paint.brush];
    if (!def) return;
    const i = m.superficies.findIndex(s => s.col === cell.col && s.row === cell.row);
    const novo = {
      id: (i >= 0 ? m.superficies[i].id : ('sup-' + Date.now() + '-' + Math.random().toString(36).slice(2,7))),
      col: cell.col, row: cell.row,
      tipo: GRID.paint.brush,
      cor: def.cor, icon: def.icon, label: def.label,
      custoMov: def.custoMov, dano: def.dano,
    };
    if (i >= 0) m.superficies[i] = novo; else m.superficies.push(novo);
    _renderSvgLayer();
  }
  function _removerSuperficie(m, cell) {
    if (!Array.isArray(m.superficies)) return;
    m.superficies = m.superficies.filter(s => !(s.col === cell.col && s.row === cell.row));
    _renderSvgLayer();
  }

  // ───────────────────────────────────────────────────────────────────
  // 7) API pública nova (não-conflitante)
  // ───────────────────────────────────────────────────────────────────
  window.gridTacticalShowMoveRange = function (charNome, velocidadeOverride) {
    const m = _mapaAtual();
    const char = (window.RPG_DATA && window.RPG_DATA.characters || []).find(c => c.nome === charNome);
    if (!m || !char) return;
    const pos = (typeof window.getPosicaoNoMapa === 'function')
      ? window.getPosicaoNoMapa(char, m.map_id)
      : (char.map_positions && char.map_positions[m.map_id]) || null;
    if (!pos) return;
    const cell = (typeof pos.col === 'number')
      ? { col: pos.col, row: pos.row }
      : (typeof window.pctParaCelula === 'function' ? window.pctParaCelula(pos.x, pos.y, m.map_id) : null);
    if (!cell) return;
    const vel = (velocidadeOverride != null) ? velocidadeOverride
      : (char.velocidade_restante != null ? char.velocidade_restante
         : (char.velocidade != null ? char.velocidade : 6));
    GRID.selectedToken = charNome;
    GRID.moveCells = _calcularMoveRange(m, cell, vel);
    _renderSvgLayer();
  };

  window.gridTacticalShowAttackRange = function (charNome, alcance) {
    const m = _mapaAtual();
    const char = (window.RPG_DATA && window.RPG_DATA.characters || []).find(c => c.nome === charNome);
    if (!m || !char) return;
    const pos = (typeof window.getPosicaoNoMapa === 'function')
      ? window.getPosicaoNoMapa(char, m.map_id) : null;
    if (!pos) return;
    const cell = (typeof pos.col === 'number')
      ? { col: pos.col, row: pos.row }
      : (typeof window.pctParaCelula === 'function' ? window.pctParaCelula(pos.x, pos.y, m.map_id) : null);
    if (!cell) return;
    const alc = (alcance != null) ? alcance : (char.alcance_ataque || 1);
    GRID.attackCells = _calcularAttackRange(m, cell, alc);
    _renderSvgLayer();
  };

  window.gridTacticalHide = function () {
    GRID.selectedToken = null;
    GRID.moveCells = [];
    GRID.attackCells = [];
    _renderSvgLayer();
  };

  window.gridTacticalSetPaintBrush = function (brushKey, ativo) {
    GRID.paint.brush = brushKey || 'dificil';
    GRID.paint.ativo = (ativo !== false);
  };

  window.gridTacticalMeasure = function (from, to) {
    GRID.measure.from = from || null;
    GRID.measure.to   = to   || null;
    _renderSvgLayer();
  };

  window.gridTacticalToggleFlag = function (key) {
    if (!(key in GRID.flags)) return;
    GRID.flags[key] = !GRID.flags[key];
    _renderSvgLayer();
  };

  window.gridTacticalSnapToken = function (charNome) {
    // Force-snap a posição do token ao centro da célula mais próxima.
    const m = _mapaAtual();
    const char = (window.RPG_DATA && window.RPG_DATA.characters || []).find(c => c.nome === charNome);
    if (!m || !char) return;
    const wrap = document.getElementById('mapa-wrap');
    if (!wrap) return;
    if (!char.map_positions) char.map_positions = {};
    const pos = char.map_positions[m.map_id];
    if (!pos) return;
    if (typeof pos.col !== 'number') {
      const cel = (typeof window.pctParaCelula === 'function')
        ? window.pctParaCelula(pos.x || 50, pos.y || 50, m.map_id)
        : { col:0, row:0 };
      char.map_positions[m.map_id] = { col: cel.col, row: cel.row };
    }
    if (typeof window.mapaRenderTokens === 'function') window.mapaRenderTokens(m);
  };

  // ───────────────────────────────────────────────────────────────────
  // 8) Monkey-patch defensivo:
  //    a) Estende mapaDesenharGrade → renderiza nossa SVG por cima
  //    b) Estende mapaRenderTokens  → snap visual (left/top em px de centro de célula)
  //                                  e clique no token mostra ranges
  //    c) Estende renderMapaViewer  → garante bind das interações
  // ───────────────────────────────────────────────────────────────────
  function _patchWhenReady() {
    // a) mapaDesenharGrade
    if (typeof window.mapaDesenharGrade === 'function' && !window.mapaDesenharGrade.__gtPatched) {
      const _orig = window.mapaDesenharGrade;
      window.mapaDesenharGrade = function (m) {
        try { _orig.apply(this, arguments); } catch (e) { console.warn('[grid] orig mapaDesenharGrade erro:', e); }
        try { _renderSvgLayer(); _renderPortasClicaveis(); } catch (e) { console.warn('[grid] svg layer erro:', e); }
      };
      window.mapaDesenharGrade.__gtPatched = true;
    }

    // b) mapaRenderTokens
    if (typeof window.mapaRenderTokens === 'function' && !window.mapaRenderTokens.__gtPatched) {
      const _orig = window.mapaRenderTokens;
      window.mapaRenderTokens = function (m) {
        const r = _orig.apply(this, arguments);
        try {
          // snap de posição visual + bind clique → range
          const wrap = document.getElementById('mapa-wrap');
          const tokensEl = document.getElementById('mapa-tokens');
          if (m && wrap && tokensEl) {
            const w = wrap.clientWidth, h = wrap.clientHeight;
            const { cW, cH } = _gridDims(m, w, h);
            tokensEl.querySelectorAll('.mapa-token[data-char]').forEach(el => {
              const nome = el.getAttribute('data-char');
              const char = (window.RPG_DATA && window.RPG_DATA.characters || []).find(c => c.nome === nome);
              if (!char) return;
              const pos = char.map_positions && char.map_positions[m.map_id];
              if (pos && typeof pos.col === 'number') {
                const cx = (pos.col + 0.5) * cW;
                const cy = (pos.row + 0.5) * cH;
                el.style.left = (cx / w * 100) + '%';
                el.style.top  = (cy / h * 100) + '%';
                // Tamanho proporcional à célula (1×1 padrão; respeita data-tamanho-cells)
                const tCells = parseFloat(el.getAttribute('data-tamanho-cells') || '1') || 1;
                el.style.width  = (cW * tCells * 0.86) + 'px';
                el.style.height = (cH * tCells * 0.86) + 'px';
              }
              if (!el.__gtClick) {
                el.__gtClick = true;
                el.addEventListener('click', function (ev) {
                  ev.stopPropagation();
                  window.gridTacticalShowMoveRange(nome);
                  window.gridTacticalShowAttackRange(nome);
                });
              }
            });
          }
          _renderSvgLayer();
          _renderPortasClicaveis();
          _bindWrapInteractions();
        } catch (e) { console.warn('[grid] tokens patch erro:', e); }
        return r;
      };
      window.mapaRenderTokens.__gtPatched = true;
    }

    // c) renderMapaViewer
    if (typeof window.renderMapaViewer === 'function' && !window.renderMapaViewer.__gtPatched) {
      const _orig = window.renderMapaViewer;
      window.renderMapaViewer = function () {
        const r = _orig.apply(this, arguments);
        try { _bindWrapInteractions(); _renderSvgLayer(); _renderPortasClicaveis(); } catch (e) {}
        return r;
      };
      window.renderMapaViewer.__gtPatched = true;
    }
  }

  // Tenta patchar agora; se as funções ainda não existem, observa.
  function _waitAndPatch() {
    _patchWhenReady();
    const need = !window.mapaDesenharGrade || !window.mapaRenderTokens || !window.renderMapaViewer
              || !window.mapaDesenharGrade.__gtPatched
              || !window.mapaRenderTokens.__gtPatched
              || !window.renderMapaViewer.__gtPatched;
    if (need) setTimeout(_waitAndPatch, 250);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitAndPatch);
  } else {
    _waitAndPatch();
  }

  // ───────────────────────────────────────────────────────────────────
  // 9) CSS mínimo (apenas o que precisa para a camada não competir)
  // ───────────────────────────────────────────────────────────────────
  (function injectCss(){
    if (document.getElementById('grid-tactical-css')) return;
    const css = `
      #mapa-wrap { position: relative; }
      svg.grid-tactical-svg { user-select: none; }
      .mapa-token { transition: left .12s linear, top .12s linear, width .12s, height .12s; }
      .gt-portas-layer button:hover { background: rgba(126,200,240,0.18) !important; }
    `;
    const s = document.createElement('style');
    s.id = 'grid-tactical-css';
    s.textContent = css;
    document.head.appendChild(s);
  })();

  console.log('[maps-grid-core] núcleo de grid tático carregado.');
})();
