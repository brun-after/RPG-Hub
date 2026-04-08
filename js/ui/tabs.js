// ui/tabs.js
// RPG Hub — Scene editor system: walls, doors, keys, chests, obstacles
// Includes: CENARIO_STATE, CENA_ED, abrirEditorCena(), wall/door/chest management

// ════════════════════════════════════════════════════════════════════════════
// PAREDES & PORTAS — Sistema de obstáculos e passagens no mapa tático
// Estrutura em m.render_data.paredes[] e m.render_data.portas[]
// Parede: { id, col1, row1, col2, row2 }   (segmento entre 2 células do grid)
// Porta:  { id, col, row, nome, aberta }    (posição + estado)
// ════════════════════════════════════════════════════════════════════════════

// ── Estado do editor de paredes/portas ───────────────────────────────────
const WALLS_STATE = {
  primeroPonto: null,   // snap point – aguardando 2º clique no modo parede
  configAtual: { cor: '#7ec8f0', largura: 3 },  // config aplicada à próxima parede
};

// ── Verificar se existe parede bloqueando o caminho col/row → col+dc/row+dr
function paredeBloqueiaMovimento(mapId, colAtual, rowAtual, dc, dr) {
  const mapa = _getMapaById(mapId);
  if (!mapa?.render_data?.paredes?.length) return false;
  const colDest = colAtual + dc;
  const rowDest = rowAtual + dr;

  return mapa.render_data.paredes.some(p => {
    // Normalizar para formato canônico {tipo, col, row}
    let tipo = p.tipo, col = p.col, row = p.row;
    if (!tipo && p.col1 !== undefined) {
      if      (p.col1 === p.col2) { tipo = 'v'; col = p.col1; row = Math.min(p.row1, p.row2); }
      else if (p.row1 === p.row2) { tipo = 'h'; col = Math.min(p.col1, p.col2); row = p.row1; }
      else return false; // diagonal: ignorar
    }
    if (dc !== 0 && dr === 0) { // movimento horizontal
      if (tipo !== 'v') return false;
      const colBorda = dc > 0 ? colAtual + 1 : colAtual;
      return col === colBorda && row === rowAtual;
    }
    if (dr !== 0 && dc === 0) { // movimento vertical
      if (tipo !== 'h') return false;
      const rowBorda = dr > 0 ? rowAtual + 1 : rowAtual;
      return row === rowBorda && col === colAtual;
    }
    return false;
  });
}

// ── Verificar se há porta adjacente ao personagem ─────────────────────────
function portaAdjacenteAo(mapId, col, row) {
  const mapa = _getMapaById(mapId);
  if (!mapa?.render_data?.portas?.length) return null;
  return mapa.render_data.portas.find(p =>
    Math.abs((p.col ?? 0) - col) <= 1 && Math.abs((p.row ?? 0) - row) <= 1
  ) || null;
}

// ── Ação de usar porta (toggle aberta/fechada + transição de mapa) ────────
async function usarPorta(mapId, portaId, charNome) {
  const mapa = _getMapaById(mapId);
  if (!mapa?.render_data?.portas) return;
  const porta = mapa.render_data.portas.find(p => p.id === portaId);
  if (!porta) return;

  // Verificar tranca
  if (!porta.aberta && porta.trancada && porta.chave_palavra) {
    const nome = charNome || TOKEN_CTRL?.nomeSelecionado || RPG_DATA?.linked;
    const temChave = _charTemChave(nome, mapId, porta.chave_palavra);
    if (!temChave) {
      mostrarToast('🔐 Esta porta está trancada. Precisa de: ' + porta.chave_palavra, 'aviso');
      return;
    }
  }

  porta.aberta = !porta.aberta;
  mostrarToast(porta.aberta ? `🚪 ${porta.nome||'Porta'} aberta` : `🔒 ${porta.nome||'Porta'} fechada`, 'ok');

  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) {
    entry.mapa.render_data = mapa.render_data;
    await salvarRenderData(entry.id, mapa.render_data);
    mapaRenderTokens(mapa);
  }

  // Transição de mapa (só se porta aberta + destino definido + personagem identificado)
  if (porta.aberta && porta.mapa_destino && charNome) {
    await _portaTransportarChar(charNome, porta);
  }
}

async function _portaTransportarChar(charNome, porta) {
  const char = (RPG_DATA?.characters||[]).find(c => c.nome === charNome);
  if (!char) return;
  if (!char.map_positions) char.map_positions = {};
  char.map_positions[porta.mapa_destino] = { col: porta.destino_col || 0, row: porta.destino_row || 0 };
  char.active_map_id = porta.mapa_destino;

  const cEntry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === porta.mapa_destino);
  if (cEntry) {
    await sb('characters?id=eq.' + char.id, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ map_positions: char.map_positions, active_map_id: char.active_map_id })
    }).catch(() => {});

    // Navegar para o mapa destino
    if (typeof navegarParaMapa === 'function') navegarParaMapa(porta.mapa_destino);
    else if (typeof mapaCarregar === 'function') mapaCarregar(porta.mapa_destino);
    else if (typeof selecionarMapa === 'function') selecionarMapa(porta.mapa_destino);

    mostrarToast('✨ ' + charNome + ' entrou em ' + (cEntry.mapa.nome || 'novo mapa'), 'ok');
    // ── Vol II v2.1: Verificar superfícies na célula de chegada ──
    if (typeof superficieVerificarEntrada === 'function') {
      superficieVerificarEntrada(porta.mapa_destino, charNome, porta.destino_col || 0, porta.destino_row || 0);
    }

    // Broadcast para outros jogadores
    if (typeof realtimeBroadcast === 'function') {
      realtimeBroadcast('porta_transicao', {
        charNome, mapa_destino: porta.mapa_destino,
        destino_col: porta.destino_col || 0, destino_row: porta.destino_row || 0
      });
    }
  }
}

function _charTemChave(charNome, mapId, chavePalavra) {
  if (!charNome) return false;
  const char = (RPG_DATA?.characters||[]).find(c => c.nome === charNome);
  const chaves = char?.custom_attrs?.chaves_coletadas || char?.custom_attrs?.chaves || [];
  return chaves.some(k => (typeof k === 'string' ? k : k?.chave_palavra) === chavePalavra);
}

// ── Renderizar paredes e portas no SVG do mapa ───────────────────────────
function paredePorRenderizar(m) {
  const svg = document.getElementById('mapa-dist-svg');
  if (!svg) return;

  // Remover elementos anteriores de paredes/portas
  svg.querySelectorAll('.mapa-parede, .mapa-porta').forEach(el => el.remove());

  const rd = m.render_data;
  if (!rd) return;
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas) return;
  const W = canvas.offsetWidth  || 100;
  const H = canvas.offsetHeight || 100;
  const cols = m.largura_total || 20;
  const rows = m.altura_total  || 20;
  const cW = W / cols;
  const cH = H / rows;

  // Renderizar paredes
  (rd.paredes || []).forEach(p => {
    // Converter células para pixels
    let x1, y1, x2, y2;
    if (p.tipo === 'v') {
      // Parede vertical: borda direita de col, linha toda da row
      x1 = x2 = p.col * cW;
      y1 = p.row * cH;
      y2 = (p.row + 1) * cH;
    } else if (p.tipo === 'h') {
      // Parede horizontal: borda inferior de row
      y1 = y2 = p.row * cH;
      x1 = p.col * cW;
      x2 = (p.col + 1) * cW;
    } else {
      // Formato genérico: centro de célula a centro de célula
      x1 = ((p.col1 ?? 0) + 0.5) * cW;
      y1 = ((p.row1 ?? 0) + 0.5) * cH;
      x2 = ((p.col2 ?? 0) + 0.5) * cW;
      y2 = ((p.row2 ?? 0) + 0.5) * cH;
    }
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', p.cor || '#7ec8f0');
    line.setAttribute('stroke-width', String(p.largura || 3));
    line.setAttribute('stroke-linecap', 'round');
    line.classList.add('mapa-parede');
    // Em modo edição: clique remove
    if (MAPA_STATE.toolMode === 'paredes') {
      line.style.cursor = 'pointer';
      line.style.strokeOpacity = '0.8';
      line.addEventListener('click', (e) => {
        e.stopPropagation();
        paredRemover(m.map_id, p.id);
      });
    }
    svg.appendChild(line);
  });

  // Renderizar portas
  (rd.portas || []).forEach(porta => {
    const cx = ((porta.col ?? 0) + 0.5) * cW;
    const cy = ((porta.row ?? 0) + 0.5) * cH;
    const r = Math.min(cW, cH) * 0.35;

    // Círculo da porta
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', porta.aberta ? 'rgba(94,224,154,0.15)' : 'rgba(200,168,75,0.15)');
    circle.setAttribute('stroke', porta.aberta ? '#5ee09a' : '#c8a84b');
    circle.setAttribute('stroke-width', '2');
    circle.classList.add('mapa-porta');

    // Ícone
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx); text.setAttribute('y', cy + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', Math.min(cW, cH) * 0.45);
    text.setAttribute('fill', porta.aberta ? '#5ee09a' : '#c8a84b');
    text.textContent = porta.aberta ? '🚪' : '🔒';
    text.classList.add('mapa-porta');

    if (MAPA_STATE.toolMode === 'paredes') {
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        portaEditar(m.map_id, porta.id);
      });
    } else {
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        usarPorta(m.map_id, porta.id);
      });
    }
    svg.appendChild(circle);
    svg.appendChild(text);
  });
}

// ── Snap de clique para borda de célula ──────────────────────────────────
function _snapParede(xPx, yPx, canvas, mapa) {
  const cols = mapa.largura_total || 20;
  const rows = mapa.altura_total  || 20;
  const rect = canvas.getBoundingClientRect();
  const cW = (rect.width  || canvas.offsetWidth  || 100) / cols;
  const cH = (rect.height || canvas.offsetHeight || 100) / rows;

  const gx = xPx / cW;
  const gy = yPx / cH;

  const nearCol = Math.round(gx);
  const distV   = Math.abs(gx - nearCol);
  const nearRow = Math.round(gy);
  const distH   = Math.abs(gy - nearRow);

  if (distV <= distH) {
    return { tipo: 'v', col: nearCol, row: Math.floor(gy) };
  } else {
    return { tipo: 'h', col: Math.floor(gx), row: nearRow };
  }
}

// ── Gerar lista de segmentos entre dois pontos snap ───────────────────────
function _gerarSegmentos(p1, p2) {
  const segs = [];
  if (p1.tipo === 'v' && p2.tipo === 'v' && p1.col === p2.col) {
    const r0 = Math.min(p1.row, p2.row), r1 = Math.max(p1.row, p2.row);
    for (let r = r0; r <= r1; r++) segs.push({ tipo: 'v', col: p1.col, row: r });
  } else if (p1.tipo === 'h' && p2.tipo === 'h' && p1.row === p2.row) {
    const c0 = Math.min(p1.col, p2.col), c1 = Math.max(p1.col, p2.col);
    for (let c = c0; c <= c1; c++) segs.push({ tipo: 'h', col: c, row: p1.row });
  } else {
    segs.push(p1); // fallback: ponto único
  }
  return segs;
}

// ── Adicionar parede (click no mapa em modo paredes) ─────────────────────
function paredAdicionarPonto(xPx, yPx) {
  const mapId = MAPA_STATE?.mapaAtualId;
  const mapa  = _getMapaById(mapId);
  if (!mapa) return;
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas) return;

  const snap = _snapParede(xPx, yPx, canvas, mapa);

  if (!WALLS_STATE.primeroPonto) {
    WALLS_STATE.primeroPonto = snap;
    mostrarToast('📍 Borda marcada — clique na borda final', '');
    return;
  }

  const p1 = WALLS_STATE.primeroPonto;
  WALLS_STATE.primeroPonto = null;

  if (!mapa.render_data) mapa.render_data = {};
  if (!mapa.render_data.paredes) mapa.render_data.paredes = [];

  const segmentos = _gerarSegmentos(p1, snap);
  segmentos.forEach(s => mapa.render_data.paredes.push({
    id:      'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    tipo:    s.tipo,
    col:     s.col,
    row:     s.row,
    cor:     WALLS_STATE.configAtual?.cor     || '#7ec8f0',
    largura: WALLS_STATE.configAtual?.largura || 3,
  }));

  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  paredePorRenderizar(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
}

function paredRemover(mapId, paredId) {
  const mapa = _getMapaById(mapId);
  if (!mapa?.render_data?.paredes) return;
  mapa.render_data.paredes = mapa.render_data.paredes.filter(p => p.id !== paredId);
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  paredePorRenderizar(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
}

function portaAdicionar(col, row) {
  const mapId = MAPA_STATE?.mapaAtualId;
  const mapa = _getMapaById(mapId);
  if (!mapa) return;
  if (!mapa.render_data) mapa.render_data = {};
  if (!mapa.render_data.portas) mapa.render_data.portas = [];

  // Montar nova porta com campos expandidos
  const cfg = CENARIO_STATE?.placement?.tipo === 'porta' ? CENARIO_STATE.placement : null;
  const nome         = cfg?.nome          || 'Porta';
  const trancada     = cfg?.trancada      || false;
  const chave_palavra = cfg?.chave_palavra || '';
  const mapa_destino  = cfg?.mapa_destino  || null;
  const destino_col   = cfg?.destino_col   || 0;
  const destino_row   = cfg?.destino_row   || 0;
  const cor           = cfg?.cor           || '#c8a84b';
  const icone         = cfg?.icone         || '🚪';

  mapa.render_data.portas.push({
    id: 'door_' + Date.now(), col, row, nome, aberta: false,
    trancada, chave_palavra, mapa_destino, destino_col, destino_row,
    cor, icone,
  });

  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  paredePorRenderizar(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
}

function portaEditar(mapId, portaId) {
  const mapa = _getMapaById(mapId);
  const porta = mapa?.render_data?.portas?.find(p => p.id === portaId);
  if (!porta) return;
  const opcao = prompt('Porta: ' + porta.nome + '\nDigite novo nome ou deixe vazio para deletar:', porta.nome);
  if (opcao === null) return;
  if (opcao === '') {
    mapa.render_data.portas = mapa.render_data.portas.filter(p => p.id !== portaId);
  } else {
    porta.nome = opcao;
  }
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  paredePorRenderizar(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
}

async function salvarRenderData(entryId, renderData) {
  if (!entryId || !CURRENT_RPG) return;
  try {
    await sb('mapas?id=eq.' + entryId, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: JSON.stringify({ render_data: renderData }),
    });
  } catch(e) { console.warn('salvarRenderData falhou:', e); }
}

// ── Botões contextuais: porta adjacente → ação "Abrir/Fechar Porta" ───────
const _origCtxGerarWalls = window.ctxGerarBotoes;
window.ctxGerarBotoes = function(charNome, mapId) {
  const botoes = _origCtxGerarWalls ? _origCtxGerarWalls(charNome, mapId) : [];
  const c = (RPG_DATA?.characters || []).find(ch => ch.nome === charNome);
  const pos = c ? getPosicaoNoMapa(c, mapId) : null;
  if (pos) {
    const porta = portaAdjacenteAo(mapId, pos.col ?? 0, pos.row ?? 0);
    if (porta) {
      botoes.unshift({
        label: (porta.aberta ? '🔒 Fechar ' : '🚪 Abrir ') + (porta.nome || 'Porta'),
        acao: 'usar_porta',
        portaId: porta.id,
        mapId,
        prioridade: 10,
        desabilitado: false,
      });
    }
  }
  return botoes;
};

// Registrar ação de porta no executor
const _origCtxExecutar = window.ctxExecutarAcao;
window.ctxExecutarAcao = function(botao) {
  if (botao?.acao === 'usar_porta') {
    usarPorta(botao.mapId, botao.portaId);
    return;
  }
  return _origCtxExecutar?.(botao);
};
window.ctxExecutarAcao = window.ctxExecutarAcao; // ensure global

// ════════════════════════════════════════════════════════════════════════════
// SISTEMA DE CENÁRIO — Paredes aprimoradas, Portas, Chaves, Baús, Obstáculos
// render_data.objetos[] = {id, tipo, col, row, nome, icone, ...props}
// tipo: 'porta' | 'chave' | 'bau' | 'obstaculo'
// ════════════════════════════════════════════════════════════════════════════

const CENARIO_STATE = {
  placement: null,  // {tipo, config} — aguardando clique no mapa
  tabAtiva: 'porta',
};

// ── Abrir/fechar painel ───────────────────────────────────────────────────
function abrirPainelCenario() {
  if (!MAPA_STATE?.mapaAtualId) {
    mostrarToast('Selecione um mapa primeiro', 'aviso');
    return;
  }
  cenarioRenderObjetos();
  const modalOverlay = document.getElementById('modal-cenario-overlay');
  if (modalOverlay) modalOverlay.style.display = 'flex';
}
function fecharPainelCenario() {
  const modalOverlay = document.getElementById('modal-cenario-overlay');
  if (modalOverlay) modalOverlay.style.display = 'none';
  CENARIO_STATE.placement = null;
  MAPA_STATE.toolMode = null;
  document.querySelectorAll('.mapa-tool-btn').forEach(b => b.classList.remove('ativo'));
  // Atualizar resumo no modal de config se estiver aberto
  if (typeof atualizarResumoObjetosCenario === 'function') {
    atualizarResumoObjetosCenario();
  }
}

function cenarioTab(tipo, btn) {
  CENARIO_STATE.tabAtiva = tipo;
  document.querySelectorAll('.cenario-tab').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.cenario-tab-btn').forEach(b => {
    b.style.background = 'none';
    b.style.borderColor = 'var(--borda)';
    b.style.color = 'var(--suave)';
  });
  document.getElementById('cenario-tab-' + tipo).style.display = '';
  btn.style.background = 'rgba(176,126,240,0.15)';
  btn.style.borderColor = 'rgba(176,126,240,0.4)';
  btn.style.color = '#b07ef0';
}

function cenarioBauLootChange() {
  const tipo = document.getElementById('cen-bau-loot-tipo').value;
  document.getElementById('cen-bau-aleatorio-wrap').style.display = tipo === 'aleatorio' ? 'block' : 'none';
  document.getElementById('cen-bau-item-wrap').style.display = tipo === 'item_catalog' ? 'block' : 'none';
  document.getElementById('cen-bau-ouro-wrap').style.display = tipo === 'ouro' ? 'block' : 'none';
}

async function cenarioBuscarItem() {
  const q = document.getElementById('cen-bau-item-busca').value.trim().toLowerCase();
  const lista = document.getElementById('cen-bau-item-lista');
  if (!q) { lista.innerHTML = ''; return; }
  const defs = (INV?.itemDefs || []).filter(d => d.nome.toLowerCase().includes(q)).slice(0, 8);
  lista.innerHTML = defs.map(d =>
    `<div onclick="cenarioSelecionarItem('${d.id.toString().replace(/'/g,"\'")}','${d.nome.replace(/'/g,"\'")}','${d.icone||'📦'}')"
      style="padding:6px 10px;background:rgba(20,29,43,0.8);border:1px solid var(--borda);border-radius:6px;cursor:pointer;font-size:0.75rem;display:flex;align-items:center;gap:8px"
      onmouseover="this.style.borderColor='rgba(176,126,240,0.4)'" onmouseout="this.style.borderColor='var(--borda)'">
      <span>${d.icone||'📦'}</span><span>${d.nome}</span>
      <span style="margin-left:auto;font-size:0.6rem;color:var(--suave)">${d.raridade||''}</span>
    </div>`
  ).join('');
}

function cenarioSelecionarItem(id, nome, icone) {
  document.getElementById('cen-bau-item-id').value = id;
  document.getElementById('cen-bau-item-sel').textContent = icone + ' ' + nome + ' selecionado';
  document.getElementById('cen-bau-item-lista').innerHTML = '';
  document.getElementById('cen-bau-item-busca').value = '';
}

// ── Ativar modo placement: aguarda clique no mapa ─────────────────────────
function cenarioAtivarPlacement(tipo) {
  // Coletar config do formulário
  let config = { tipo };
  if (tipo === 'porta') {
    config.nome = document.getElementById('cen-porta-nome').value.trim() || 'Porta';
    config.trancada = document.getElementById('cen-porta-trancada').checked;
    config.chave_palavra = config.trancada ? (document.getElementById('cen-porta-chave').value.trim() || '') : '';
    config.aberta = false;
    // Campos novos: transição de mapa e aparência
    const transicao = document.getElementById('cen-porta-transicao')?.checked;
    config.mapa_destino  = transicao ? (document.getElementById('cen-porta-mapa-destino')?.value || null) : null;
    config.destino_col   = transicao ? (parseInt(document.getElementById('cen-porta-dest-col')?.value) || 0) : 0;
    config.destino_row   = transicao ? (parseInt(document.getElementById('cen-porta-dest-row')?.value) || 0) : 0;
    config.cor           = document.getElementById('cen-porta-cor')?.value   || '#c8a84b';
    config.icone         = document.getElementById('cen-porta-icone')?.value || '🚪';
  } else if (tipo === 'chave') {
    config.nome = document.getElementById('cen-chave-nome').value.trim() || 'Chave';
    config.chave_palavra = document.getElementById('cen-chave-palavra').value.trim() || '';
    config.icone = document.getElementById('cen-chave-icone').value.trim() || '🗝';
    config.coletada = false;
  } else if (tipo === 'bau') {
    config.nome = document.getElementById('cen-bau-nome').value.trim() || 'Baú';
    config.aberto = false;
    config.trancado = document.getElementById('cen-bau-trancado').checked;
    config.chave_palavra = config.trancado ? (document.getElementById('cen-bau-chave').value.trim() || '') : '';
    const lootTipo = document.getElementById('cen-bau-loot-tipo').value;
    if (lootTipo === 'aleatorio') {
      config.loot_tipo = 'aleatorio';
      config.loot_tier = parseInt(document.getElementById('cen-bau-tier').value) || 1;
    } else if (lootTipo === 'item_catalog') {
      config.loot_tipo = 'item';
      config.loot_item_id = document.getElementById('cen-bau-item-id').value;
      config.loot_qtd = parseInt(document.getElementById('cen-bau-item-qtd').value) || 1;
    } else if (lootTipo === 'ouro') {
      config.loot_tipo = 'ouro';
      config.loot_ouro = parseInt(document.getElementById('cen-bau-ouro-qtd').value) || 10;
    } else {
      config.loot_tipo = 'nenhum';
    }
  } else if (tipo === 'obstaculo') {
    config.nome = document.getElementById('cen-obs-nome').value.trim() || 'Obstáculo';
    config.icone = document.getElementById('cen-obs-icone').value.trim() || '🪨';
    config.tamanho = parseInt(document.getElementById('cen-obs-tamanho').value) || 1;
  }

  CENARIO_STATE.placement = config;
  MAPA_STATE.toolMode = 'cenario_placement';
  const modalOverlay = document.getElementById('modal-cenario-overlay');
  if (modalOverlay) modalOverlay.style.display = 'none';
  mostrarToast('📍 Clique no mapa para posicionar: ' + config.nome, '');
}

// ── Processar clique no mapa durante placement ────────────────────────────
function cenarioHandleMapaClick(e, wrap) {
  if (MAPA_STATE.toolMode !== 'cenario_placement') return false;
  const cfg = CENARIO_STATE.placement;
  if (!cfg) return false;

  const canvas = document.getElementById('mapa-canvas');
  const rect = wrap.getBoundingClientRect();
  const W = canvas?.offsetWidth || rect.width;
  const H = canvas?.offsetHeight || rect.height;
  const mapId = MAPA_STATE?.mapaAtualId;
  const mapa = _getMapaById(mapId);
  if (!mapa) { MAPA_STATE.toolMode = null; CENARIO_STATE.placement = null; return true; }

  const cols = mapa.largura_total || 20;
  const rows = mapa.altura_total  || 20;
  const col = Math.floor(((e.clientX - rect.left) / W) * cols);
  const row = Math.floor(((e.clientY - rect.top)  / H) * rows);

  if (!mapa.render_data) mapa.render_data = {};
  if (!mapa.render_data.objetos) mapa.render_data.objetos = [];

  const novoObj = { ...cfg, id: cfg.tipo + '_' + Date.now(), col, row };
  mapa.render_data.objetos.push(novoObj);

  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;

  mapaRenderTokens(mapa);
  salvarRenderData(entry?.id, mapa.render_data);

  mostrarToast('✓ ' + cfg.nome + ' posicionado', 'ok');
  MAPA_STATE.toolMode = null;
  CENARIO_STATE.placement = null;
  cenarioRenderObjetos();
  return true;
}

// ── Renderizar lista de objetos no modal ──────────────────────────────────
function cenarioRenderObjetos() {
  const lista = document.getElementById('cenario-objetos-lista');
  if (!lista) return;
  const mapa = _getMapaById(MAPA_STATE?.mapaAtualId);
  const objetos = mapa?.render_data?.objetos || [];
  const paredes = mapa?.render_data?.paredes || [];
  const total = objetos.length + paredes.length;

  if (!total) {
    lista.innerHTML = '<div style="font-size:0.7rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Nenhum objeto criado</div>';
    return;
  }
  lista.innerHTML = [
    ...paredes.map(p => `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(126,200,240,0.05);border:1px solid rgba(126,200,240,0.15);border-radius:6px">
      <span>🧱</span><span style="font-size:0.72rem;color:var(--texto);flex:1">Parede</span>
      <button onclick="paredRemover('${(mapa?.map_id||'').replace(/'/g,"\'")}','${p.id}')" style="background:none;border:none;color:rgba(192,57,43,0.6);cursor:pointer;font-size:0.85rem" title="Remover">✕</button>
    </div>`),
    ...objetos.map(o => {
      const icon = o.tipo==='porta'?(o.trancada?'🔒':'🚪'):o.tipo==='chave'?(o.icone||'🗝'):o.tipo==='bau'?(o.trancado?'🔒📦':'📦'):(o.icone||'🪨');
      const sub = o.chave_palavra ? ` <span style="font-size:0.55rem;color:var(--suave)">🗝 ${o.chave_palavra}</span>` : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.12);border-radius:6px">
        <span>${icon}</span>
        <span style="font-size:0.72rem;color:var(--texto);flex:1">${o.nome}${sub}</span>
        <span style="font-size:0.6rem;color:var(--suave)">(${o.col},${o.row})</span>
        ${o.tipo==='bau'?`<button onclick="cenarioAbrirBauEditor('${o.id}')" style="background:none;border:none;color:var(--destaque);cursor:pointer;font-size:0.75rem" title="Editar loot">🎁</button>`:''}
        <button onclick="cenarioRemoverObjeto('${o.id}')" style="background:none;border:none;color:rgba(192,57,43,0.6);cursor:pointer;font-size:0.85rem" title="Remover">✕</button>
      </div>`;
    })
  ].join('');
}

function cenarioRemoverObjeto(id) {
  const mapId = MAPA_STATE?.mapaAtualId;
  const mapa = _getMapaById(mapId);
  if (!mapa?.render_data?.objetos) return;
  mapa.render_data.objetos = mapa.render_data.objetos.filter(o => o.id !== id);
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  mapaRenderTokens(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
  cenarioRenderObjetos();
}

// ── Adicionar item a baú existente ────────────────────────────────────────
function cenarioAbrirBauEditor(bauId) {
  const mapa = _getMapaById(MAPA_STATE?.mapaAtualId);
  const bau = mapa?.render_data?.objetos?.find(o => o.id === bauId);
  if (!bau) return;
  const nome = prompt('Adicionar item ao bau: ' + bau.nome + ' (nome exato do catalogo):', '');
  if (!nome) return;
  const def = (INV?.itemDefs||[]).find(d => d.nome.toLowerCase() === nome.trim().toLowerCase());
  if (!def) { mostrarToast('Item não encontrado no catálogo', 'erro'); return; }
  if (!bau.loot_itens) bau.loot_itens = [];
  bau.loot_itens.push({ item_id: def.id, nome: def.nome, icone: def.icone||'📦', qtd: 1 });
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE?.mapaAtualId);
  if (entry) entry.mapa.render_data = mapa.render_data;
  salvarRenderData(entry?.id, mapa.render_data);
  mostrarToast('✓ ' + def.nome + ' adicionado ao ' + bau.nome, 'ok');
  cenarioRenderObjetos();
}

// ── Renderizar objetos do cenário no mapa ─────────────────────────────────
function cenarioRenderObjetos_mapa(m) {
  const tokensEl = document.getElementById('mapa-tokens');
  if (!tokensEl) return;
  // Remover elementos anteriores
  tokensEl.querySelectorAll('.cenario-obj').forEach(el => el.remove());

  const objetos = m.render_data?.objetos || [];
  const canvas = document.getElementById('mapa-canvas');
  const W = canvas?.offsetWidth || tokensEl.offsetWidth;
  const H = canvas?.offsetHeight || tokensEl.offsetHeight;
  const cols = m.largura_total || 20;
  const rows = m.altura_total  || 20;
  const cW = W / cols;
  const cH = H / rows;

  objetos.forEach(o => {
    if (o.coletada || o.aberto) return; // sumir após interação
    const el = document.createElement('div');
    el.className = 'cenario-obj mapa-token';
    el.dataset.objId = o.id;
    const leftPct = ((o.col + 0.5) / cols * 100).toFixed(2);
    const topPct  = ((o.row + 0.5) / rows * 100).toFixed(2);
    el.style.cssText = `left:${leftPct}%;top:${topPct}%;transform:translate(-50%,-50%);position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;cursor:pointer;z-index:12`;

    const size = Math.min(cW, cH) * 0.7;
    const icon = o.tipo==='porta'?(o.trancada&&!o.aberta?'🔒':'🚪'):
                 o.tipo==='chave'?(o.icone||'🗝'):
                 o.tipo==='bau'?(o.trancado&&!o.aberto?'🔒':o.aberto?'📭':'📦'):
                 (o.icone||'🪨');

    el.innerHTML = `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:${size*0.65}px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">${icon}</div>
      <div style="font-family:var(--fonte-d);font-size:0.45rem;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis">${o.nome}</div>`;

    // Clique: abrir ficha do objeto (interação)
    el.addEventListener('click', e => {
      e.stopPropagation();
      cenarioInteragirObjeto(o, m.map_id);
    });
    tokensEl.appendChild(el);
  });
}

// ── Interação com objeto de cenário ───────────────────────────────────────
function cenarioInteragirObjeto(obj, mapId) {
  const mapa = _getMapaById(mapId);
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const charNome = TOKEN_CTRL.nomeSelecionado || RPG_DATA?.linked;
  if (!charNome && !isMestre) { mostrarToast('Selecione seu personagem primeiro', 'aviso'); return; }

  switch (obj.tipo) {
    case 'porta':
      cenarioAbrirPorta(obj, mapId, charNome, mapa);
      break;
    case 'chave':
      cenarioPegarChave(obj, mapId, charNome, mapa);
      break;
    case 'bau':
      cenarioAbrirBau(obj, mapId, charNome, mapa);
      break;
    case 'obstaculo':
      mostrarToast('🪨 ' + obj.nome + ' — obstáculo intransponível', '');
      break;
  }
}

function _cenarioSalvarObj(mapa, entry) {
  if (entry) entry.mapa.render_data = mapa.render_data;
  mapaRenderTokens(mapa);
  salvarRenderData(entry?.id, mapa.render_data);
}

function cenarioAbrirPorta(porta, mapId, charNome, mapa) {
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (porta.trancada && !porta.aberta) {
    // Verificar se o personagem tem a chave
    const char = RPG_DATA?.characters?.find(c => c.nome === charNome);
    const chaves = char?.custom_attrs?.chaves_coletadas || [];
    if (!chaves.includes(porta.chave_palavra)) {
      mostrarToast('🔒 ' + porta.nome + ' está trancada. Você precisa da chave (' + porta.chave_palavra + ').', 'erro');
      return;
    }
    porta.aberta = true;
    mostrarToast('🚪 ' + porta.nome + ' destrancada e aberta!', 'ok');
  } else {
    porta.aberta = !porta.aberta;
    mostrarToast(porta.aberta ? '🚪 ' + porta.nome + ' aberta' : '🔒 ' + porta.nome + ' fechada', 'ok');
  }
  _cenarioSalvarObj(mapa, entry);
}

function cenarioPegarChave(chave, mapId, charNome, mapa) {
  if (chave.coletada) { mostrarToast('🗝 Esta chave já foi coletada', ''); return; }
  const char = RPG_DATA?.characters?.find(c => c.nome === charNome);
  if (!char) return;
  if (!char.custom_attrs) char.custom_attrs = {};
  if (!char.custom_attrs.chaves_coletadas) char.custom_attrs.chaves_coletadas = [];
  if (!char.custom_attrs.chaves_coletadas.includes(chave.chave_palavra)) {
    char.custom_attrs.chaves_coletadas.push(chave.chave_palavra);
  }
  chave.coletada = true;
  mostrarToast('🗝 ' + charNome + ' pegou ' + chave.nome + '!', 'ok');
  // Salvar no personagem
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  _cenarioSalvarObj(mapa, entry);
  // Salvar custom_attrs do char
  if (RPG_DATA?.rpgId) {
    sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(charNome)}`, {
      method: 'PATCH',
      body: JSON.stringify({ custom_attrs: char.custom_attrs })
    }).catch(() => {});
  }
}

async function cenarioAbrirBau(bau, mapId, charNome, mapa) {
  const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (bau.aberto) { mostrarToast('📭 ' + bau.nome + ' já foi aberto', ''); return; }
  if (bau.trancado) {
    const char = RPG_DATA?.characters?.find(c => c.nome === charNome);
    const chaves = char?.custom_attrs?.chaves_coletadas || [];
    if (!chaves.includes(bau.chave_palavra)) {
      mostrarToast('🔒 ' + bau.nome + ' está trancado. Você precisa da chave (' + bau.chave_palavra + ').', 'erro');
      return;
    }
  }
  bau.aberto = true;
  mostrarToast('📦 ' + (charNome||'') + ' abriu ' + bau.nome + '!', 'ok');

  // Distribuir loot
  const rpgId = RPG_DATA?.rpgId;
  const charObj = RPG_DATA?.characters?.find(c => c.nome === charNome);
  if (rpgId && charObj) {
    if (bau.loot_tipo === 'aleatorio' && bau.loot_tier) {
      // Usar sistema de drops existente
      try {
        const drops = await calcularDrops(rpgId, bau.loot_tier, bau.loot_tier, null);
        for (const dropSpec of (drops||[]).slice(0,3)) {
          const status = await gerarStatusItem(rpgId, dropSpec.tipo, null, bau.loot_tier, dropSpec.raridade, dropSpec.slot, null);
          const nome = await gerarNomeItem(rpgId, dropSpec.tipo, '', dropSpec.raridade);
          const itemBody = { rpg_id: rpgId, nome, tipo_canonico: dropSpec.tipo, raridade: dropSpec.raridade, slot_equipado: dropSpec.slot, atributos_bonus: status.atributos_bonus, efeitos: status.efeitos, gerado_automaticamente: true };
          const ins = await sb('item_catalog', { method:'POST', headers:{'Prefer':'return=representation'}, body:JSON.stringify(itemBody) });
          const itemId = ins?.[0]?.id;
          if (itemId) {
            await sb('loot_pendente', { method:'POST', body:JSON.stringify({ rpg_id: rpgId, item_id: itemId, origem_npc: bau.nome, saqueado: false, criado_em: new Date().toISOString() }) });
          }
        }
        mostrarToast('💰 Loot gerado! Abra o baú do personagem.', 'ok');
      } catch(e) { mostrarToast('Erro ao gerar loot', 'erro'); }
    } else if (bau.loot_tipo === 'item' && bau.loot_item_id) {
      // Item fixo
      try {
        await sb('inventario', { method:'POST', body:JSON.stringify({ rpg_id: rpgId, character_id: charObj.id, item_catalog_id: bau.loot_item_id, quantidade: bau.loot_qtd||1, equipado:false, origem:'bau' }), headers:{'Prefer':'return=minimal'} });
        mostrarToast('✓ Item adicionado ao inventário de ' + charNome, 'ok');
      } catch(e) {}
    } else if (bau.loot_tipo === 'ouro') {
      const ouro = bau.loot_ouro || 0;
      if (!charObj.custom_attrs) charObj.custom_attrs = {};
      charObj.custom_attrs.ouro = (charObj.custom_attrs.ouro || 0) + ouro;
      await sb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&nome=eq.${encodeURIComponent(charNome)}`, { method:'PATCH', body:JSON.stringify({ custom_attrs: charObj.custom_attrs }) }).catch(()=>{});
      mostrarToast('💰 ' + charNome + ' recebeu ' + ouro + ' de ouro!', 'ok');
    } else if (bau.loot_itens?.length) {
      // Itens pré-adicionados
      for (const li of bau.loot_itens) {
        try {
          await sb('inventario', { method:'POST', body:JSON.stringify({ rpg_id: rpgId, character_id: charObj.id, item_catalog_id: li.item_id, quantidade: li.qtd||1, equipado:false, origem:'bau' }), headers:{'Prefer':'return=minimal'} });
        } catch(e) {}
      }
      mostrarToast('✓ ' + bau.loot_itens.length + ' ite(ns) recebido(s) por ' + charNome, 'ok');
    }
  }
  _cenarioSalvarObj(mapa, entry);
}

// ── Hook: objetos bloqueiam movimento (obstáculos) ────────────────────────
function cenarioObstaculoBloqueiaMovimento(mapId, colDest, rowDest) {
  const mapa = _getMapaById(mapId);
  const objetos = mapa?.render_data?.objetos || [];
  return objetos.some(o => {
    if (o.coletada || o.aberto) return false;
    if (o.tipo === 'obstaculo') {
      const tam = o.tamanho || 1;
      return colDest >= o.col && colDest < o.col + tam && rowDest >= o.row && rowDest < o.row + tam;
    }
    if (o.tipo === 'porta' && !o.aberta) {
      return o.col === colDest && o.row === rowDest;
    }
    return false;
  });
}

// ── Contextual buttons: objetos adjacentes ────────────────────────────────
const _origCtxGerarCenario = window.ctxGerarBotoes;
window.ctxGerarBotoes = function(charNome, mapId) {
  const botoes = _origCtxGerarCenario ? _origCtxGerarCenario(charNome, mapId) : [];
  const c = (RPG_DATA?.characters||[]).find(ch => ch.nome === charNome);
  const pos = c ? getPosicaoNoMapa(c, mapId) : null;
  if (!pos) return botoes;
  const col = pos.col ?? 0, row = pos.row ?? 0;
  const mapa = _getMapaById(mapId);
  const objetos = mapa?.render_data?.objetos || [];
  objetos.forEach(o => {
    if (o.coletada || o.aberto) return;
    const dist = Math.max(Math.abs(o.col - col), Math.abs(o.row - row));
    if (dist > 1) return;
    if (o.tipo === 'porta') {
      botoes.unshift({ label: (o.aberta ? '🔒 Fechar ' : (o.trancada ? '🗝 Abrir ' : '🚪 Abrir ')) + o.nome, acao: 'cenario_obj', objId: o.id, mapId, prioridade: 10, desabilitado: false });
    } else if (o.tipo === 'chave') {
      botoes.unshift({ label: '🗝 Pegar ' + o.nome, acao: 'cenario_obj', objId: o.id, mapId, prioridade: 11, desabilitado: false });
    } else if (o.tipo === 'bau') {
      botoes.unshift({ label: (o.aberto ? '📭 ' : '📦 Abrir ') + o.nome, acao: 'cenario_obj', objId: o.id, mapId, prioridade: 9, desabilitado: o.aberto });
    }
  });
  return botoes;
};

// Executar ação cenário
const _origCtxExecutarCenario = window.ctxExecutarAcao;
window.ctxExecutarAcao = function(botao) {
  if (botao?.acao === 'cenario_obj') {
    const mapa = _getMapaById(botao.mapId);
    const obj = mapa?.render_data?.objetos?.find(o => o.id === botao.objId);
    if (obj) cenarioInteragirObjeto(obj, botao.mapId);
    return;
  }
  return _origCtxExecutarCenario?.(botao);
};


// ════════════════════════════════════════════════════════════════════════════
// EDITOR DE CENA — Paredes, Portas, Chaves, Obstáculos, Baús
// render_data.paredes[]  Parede: { id, col1,row1,col2,row2, tipo? }
// render_data.portas[]   Porta:  { id, col, row, nome, aberta, trancada, chave_palavra }
// render_data.objetos[]  Objeto: { id, col, row, tipo:'chave'|'blocker'|'bau', nome,
//                                  chave_palavra?, itens?, loot_aleatorio?, raridade?, qtd?,
//                                  aberto? }
// ════════════════════════════════════════════════════════════════════════════
const CENA_ED = {
  ferramenta: null,
  primeroPonto: null,
  mapa: null,
  undoStack: [],
  cfgBauItens: [],  // itens selecionados para o baú em configuração
};

function abrirEditorCena() {
  const mapId = MAPA_STATE?.mapaAtualId;
  const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId);
  if (!entry) { mostrarToast('Selecione um mapa tático primeiro', 'erro'); return; }
  CENA_ED.mapa = entry.mapa;
  if (!CENA_ED.mapa.render_data) CENA_ED.mapa.render_data = {};
  ['paredes','portas','objetos'].forEach(k => {
    if (!CENA_ED.mapa.render_data[k]) CENA_ED.mapa.render_data[k] = [];
  });
  CENA_ED.ferramenta = null;
  CENA_ED.primeroPonto = null;
  CENA_ED.undoStack = [];
  document.getElementById('modal-cena-overlay').style.display = 'flex';
  setTimeout(() => { cenaRenderizarCanvas(); cenaRenderizarObjetos(); }, 80);
  _cenaBotoesAtualizar();
}

function fecharEditorCena() {
  document.getElementById('modal-cena-overlay').style.display = 'none';
}

function cenaSetFerramenta(f) {
  CENA_ED.ferramenta = f;
  CENA_ED.primeroPonto = null;
  _cenaBotoesAtualizar();
  const instrucoes = {
    parede: '🧱 Clique no 1º ponto, depois no 2º para criar segmento de parede',
    porta: '🚪 Clique em uma célula para posicionar a porta',
    porta_trancada: '🔒 Clique em uma célula para posicionar a porta trancada',
    chave: '🗝 Clique em uma célula para posicionar a chave',
    objeto: '🪨 Clique em uma célula para posicionar um obstáculo',
    bau: '📦 Clique em uma célula para posicionar um baú',
    remover: '🗑 Clique em qualquer objeto/parede para remover',
  };
  document.getElementById('cena-ed-instrucao').textContent = instrucoes[f] || '';
}

function _cenaBotoesAtualizar() {
  document.querySelectorAll('.cena-tool-btn').forEach(b => b.classList.remove('ativo'));
  if (CENA_ED.ferramenta) {
    const btn = document.getElementById('cena-tool-' + CENA_ED.ferramenta);
    if (btn) btn.classList.add('ativo');
  }
}

// ── Renderizar grade de fundo ─────────────────────────────────────────────
function cenaRenderizarCanvas() {
  const m = CENA_ED.mapa;
  if (!m) return;
  const canvas = document.getElementById('cena-canvas');
  if (!canvas) return;
  const area = document.getElementById('cena-mapa-area');
  canvas.width  = area.offsetWidth;
  canvas.height = area.offsetHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Imagem de fundo
  if (m.img_url) {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); cenaGrade(ctx, m, canvas.width, canvas.height); cenaRenderizarSVG(); };
    img.src = m.img_url;
    return;
  }
  cenaGrade(ctx, m, canvas.width, canvas.height);
  cenaRenderizarSVG();
}

function cenaGrade(ctx, m, W, H) {
  const cols = m.largura_total || 20;
  const rows = m.altura_total  || 20;
  const cW = W/cols, cH = H/rows;
  ctx.strokeStyle = 'rgba(200,168,75,0.12)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= cols; c++) { const x = c*cW; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let r = 0; r <= rows; r++) { const y = r*cH; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

// ── Renderizar paredes/portas/objetos via SVG ─────────────────────────────
function cenaRenderizarSVG() {
  const m = CENA_ED.mapa;
  const svg = document.getElementById('cena-svg');
  if (!svg || !m) return;
  svg.innerHTML = '';
  const canvas = document.getElementById('cena-canvas');
  const W = canvas.width, H = canvas.height;
  const cols = m.largura_total || 20;
  const rows = m.altura_total  || 20;
  const cW = W/cols, cH = H/rows;
  const rd = m.render_data || {};

  // Paredes
  (rd.paredes||[]).forEach(p => {
    let x1,y1,x2,y2;
    if (p.tipo === 'v') { x1=x2=p.col*cW; y1=p.row*cH; y2=(p.row+1)*cH; }
    else if (p.tipo === 'h') { y1=y2=p.row*cH; x1=p.col*cW; x2=(p.col+1)*cW; }
    else { x1=(p.col1+.5)*cW; y1=(p.row1+.5)*cH; x2=(p.col2+.5)*cW; y2=(p.row2+.5)*cH; }
    const line = _cenaSvgEl('line',{x1,y1,x2,y2,stroke:'#7ec8f0','stroke-width':4,'stroke-linecap':'round',opacity:.9});
    line.style.cursor='pointer';
    line.addEventListener('click', e => { e.stopPropagation(); if(CENA_ED.ferramenta==='remover') cenaRemoverParede(p.id); });
    svg.appendChild(line);
    // Hit area mais larga
    const hit = _cenaSvgEl('line',{x1,y1,x2,y2,stroke:'transparent','stroke-width':12});
    hit.style.cursor='pointer';
    hit.addEventListener('click', e => { e.stopPropagation(); if(CENA_ED.ferramenta==='remover') cenaRemoverParede(p.id); });
    svg.appendChild(hit);
  });

  // Portas e objetos
  const renderObj = (cx,cy,emoji,cor,id,tipo) => {
    const r = Math.min(cW,cH)*0.38;
    const circ = _cenaSvgEl('circle',{cx,cy,r,fill:cor,'stroke':'rgba(255,255,255,0.2)','stroke-width':1.5});
    const txt = _cenaSvgEl('text',{x:cx,y:cy+5,'text-anchor':'middle','font-size':Math.round(r*1.4)});
    txt.textContent = emoji;
    circ.style.cursor='pointer'; txt.style.cursor='pointer';
    const handler = e => { e.stopPropagation(); if(CENA_ED.ferramenta==='remover') cenaRemoverObj(id,tipo); };
    circ.addEventListener('click',handler); txt.addEventListener('click',handler);
    svg.appendChild(circ); svg.appendChild(txt);
  };

  (rd.portas||[]).forEach(p => {
    const cx=(p.col+.5)*cW, cy=(p.row+.5)*cH;
    const emoji = p.trancada ? '🔒' : p.aberta ? '🚪' : '🚪';
    const cor = p.trancada ? 'rgba(192,57,43,0.35)' : 'rgba(200,168,75,0.25)';
    renderObj(cx,cy,emoji,cor,p.id,'porta');
    // Label
    const lbl = _cenaSvgEl('text',{x:cx,y:cy+cH*.42,'text-anchor':'middle','font-size':Math.max(8,cH*.18),fill:'rgba(255,255,255,.55)'});
    lbl.textContent = p.nome||'Porta';
    svg.appendChild(lbl);
  });

  (rd.objetos||[]).forEach(o => {
    const cx=(o.col+.5)*cW, cy=(o.row+.5)*cH;
    const emap = { chave:'🗝', blocker:'🪨', bau: o.aberto?'🪣':'📦' };
    const cmap = { chave:'rgba(200,168,75,0.25)', blocker:'rgba(50,50,70,0.6)', bau:'rgba(200,168,75,0.2)' };
    renderObj(cx,cy,emap[o.tipo]||'❓',cmap[o.tipo]||'rgba(50,50,70,.4)',o.id,'objeto');
    const lbl = _cenaSvgEl('text',{x:cx,y:cy+cH*.42,'text-anchor':'middle','font-size':Math.max(8,cH*.18),fill:'rgba(255,255,255,.45)'});
    lbl.textContent = o.nome||o.tipo;
    svg.appendChild(lbl);
    // Indicador de chave palavra
    if (o.chave_palavra && o.tipo==='chave') {
      const kl = _cenaSvgEl('text',{x:cx,y:cy+cH*.62,'text-anchor':'middle','font-size':Math.max(6,cH*.14),fill:'rgba(200,168,75,.7)'});
      kl.textContent = '🔑'+o.chave_palavra;
      svg.appendChild(kl);
    }
  });

  // Primeiro ponto de parede pendente
  if (CENA_ED.primeroPonto) {
    const {col,row}=CENA_ED.primeroPonto;
    const px=(col+.5)*cW, py=(row+.5)*cH;
    const pt = _cenaSvgEl('circle',{cx:px,cy:py,r:6,fill:'#f0cc6a',opacity:.9});
    svg.appendChild(pt);
  }
}

function _cenaSvgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

// ── Click no mapa do editor ──────────────────────────────────────────────
(function _cenaClickInit() {
  document.addEventListener('DOMContentLoaded', () => {
    const area = document.getElementById('cena-mapa-area');
    if (!area) return;
    area.addEventListener('click', e => {
      if (e.target.closest('#cena-svg [cursor=pointer]') || e.target.tagName.toLowerCase() === 'circle' || e.target.tagName.toLowerCase() === 'line') return;
      _cenaHandleClick(e);
    });
  });
})();

function _cenaHandleClick(e) {
  const f = CENA_ED.ferramenta;
  if (!f || !CENA_ED.mapa) return;
  const {col,row} = _cenaCoordsFromEvent(e);
  const rd = CENA_ED.mapa.render_data;

  if (f === 'parede') {
    if (!CENA_ED.primeroPonto) {
      CENA_ED.primeroPonto = {col,row};
      mostrarToast('📍 1º ponto marcado — clique no 2º ponto da parede','');
      cenaRenderizarSVG();
    } else {
      const p1 = CENA_ED.primeroPonto;
      CENA_ED.primeroPonto = null;
      const novaParede = {id:'w_'+Date.now(),col1:p1.col,row1:p1.row,col2:col,row2:row};
      if (p1.col===col) novaParede.tipo='v';
      else if (p1.row===row) novaParede.tipo='h';
      CENA_ED.undoStack.push({tipo:'add_parede',id:novaParede.id});
      rd.paredes.push(novaParede);
      cenaRenderizarSVG();
    }
  } else if (f === 'porta' || f === 'porta_trancada') {
    // Abrir modal de configuração
    document.getElementById('cfg-porta-col').value = col;
    document.getElementById('cfg-porta-row').value = row;
    document.getElementById('cfg-porta-tipo').value = f;
    document.getElementById('cfg-porta-nome').value = '';
    document.getElementById('cfg-porta-chave').value = '';
    document.getElementById('cfg-porta-titulo').textContent = f==='porta_trancada' ? '🔒 Porta Trancada' : '🚪 Configurar Porta';
    document.getElementById('cfg-porta-chave-wrap').style.display = f==='porta_trancada' ? 'block' : 'none';
    document.getElementById('modal-cfg-porta').style.display = 'flex';
  } else if (f === 'chave') {
    document.getElementById('cfg-chave-col').value = col;
    document.getElementById('cfg-chave-row').value = row;
    document.getElementById('cfg-chave-nome').value = '';
    document.getElementById('cfg-chave-palavra').value = '';
    document.getElementById('modal-cfg-chave').style.display = 'flex';
  } else if (f === 'objeto') {
    const id = 'ob_'+Date.now();
    rd.objetos.push({id,col,row,tipo:'blocker',nome:'Obstáculo'});
    CENA_ED.undoStack.push({tipo:'add_obj',id});
    cenaRenderizarSVG();
  } else if (f === 'bau') {
    document.getElementById('cfg-bau-col').value = col;
    document.getElementById('cfg-bau-row').value = row;
    document.getElementById('cfg-bau-id').value = '';
    document.getElementById('cfg-bau-nome').value = 'Baú';
    CENA_ED.cfgBauItens = [];
    cfgBauTab('itens');
    cfgBauRenderLista();
    cfgBauRenderSelecionados();
    document.getElementById('modal-cfg-bau').style.display = 'flex';
  }
}

function _cenaCoordsFromEvent(e) {
  const area = document.getElementById('cena-mapa-area');
  const canvas = document.getElementById('cena-canvas');
  const rect = area.getBoundingClientRect();
  const W = canvas.width, H = canvas.height;
  const m = CENA_ED.mapa;
  const cols = m.largura_total||20, rows = m.altura_total||20;
  const col = Math.floor(((e.clientX-rect.left)/rect.width)*cols);
  const row = Math.floor(((e.clientY-rect.top)/rect.height)*rows);
  return {col:Math.max(0,Math.min(cols-1,col)), row:Math.max(0,Math.min(rows-1,row))};
}

// ── Remover ────────────────────────────────────────────────────────────────
function cenaRemoverParede(id) {
  const rd = CENA_ED.mapa?.render_data;
  if (!rd) return;
  rd.paredes = rd.paredes.filter(p=>p.id!==id);
  cenaRenderizarSVG();
}
function cenaRemoverObj(id, tipo) {
  const rd = CENA_ED.mapa?.render_data;
  if (!rd) return;
  if (tipo==='porta') rd.portas = rd.portas.filter(p=>p.id!==id);
  else rd.objetos = rd.objetos.filter(o=>o.id!==id);
  cenaRenderizarSVG();
}

// ── Configurar Porta ──────────────────────────────────────────────────────
function cfgPortaConfirmar() {
  const col = +document.getElementById('cfg-porta-col').value;
  const row = +document.getElementById('cfg-porta-row').value;
  const tipo = document.getElementById('cfg-porta-tipo').value;
  const nome = document.getElementById('cfg-porta-nome').value.trim() || 'Porta';
  const chave_palavra = document.getElementById('cfg-porta-chave').value.trim();
  const id = 'door_'+Date.now();
  CENA_ED.mapa.render_data.portas.push({id,col,row,nome,aberta:false,trancada:tipo==='porta_trancada',chave_palavra:chave_palavra||null});
  CENA_ED.undoStack.push({tipo:'add_porta',id});
  document.getElementById('modal-cfg-porta').style.display = 'none';
  cenaRenderizarSVG();
}

// ── Configurar Chave ──────────────────────────────────────────────────────
function cfgChaveConfirmar() {
  const col = +document.getElementById('cfg-chave-col').value;
  const row = +document.getElementById('cfg-chave-row').value;
  const nome = document.getElementById('cfg-chave-nome').value.trim() || 'Chave';
  const chave_palavra = document.getElementById('cfg-chave-palavra').value.trim();
  const id = 'key_'+Date.now();
  CENA_ED.mapa.render_data.objetos.push({id,col,row,tipo:'chave',nome,chave_palavra:chave_palavra||null});
  CENA_ED.undoStack.push({tipo:'add_obj',id});
  document.getElementById('modal-cfg-chave').style.display = 'none';
  cenaRenderizarSVG();
}

// ── Configurar Baú ────────────────────────────────────────────────────────
function cfgBauTab(tab) {
  document.getElementById('cfg-bau-sec-itens').style.display = tab==='itens'?'block':'none';
  document.getElementById('cfg-bau-sec-loot').style.display  = tab==='loot' ?'block':'none';
  document.getElementById('cfg-bau-tab-itens').style.background = tab==='itens'?'rgba(200,168,75,0.15)':'transparent';
  document.getElementById('cfg-bau-tab-loot').style.background  = tab==='loot' ?'rgba(200,168,75,0.15)':'transparent';
  document.getElementById('cfg-bau-tab-itens').style.color = tab==='itens'?'var(--destaque)':'var(--suave)';
  document.getElementById('cfg-bau-tab-loot').style.color  = tab==='loot' ?'var(--destaque)':'var(--suave)';
}

function cfgBauRenderLista() {
  const busca = document.getElementById('cfg-bau-busca')?.value.toLowerCase()||'';
  const lista = document.getElementById('cfg-bau-lista-itens');
  if (!lista) return;
  const defs = (INV?.itemDefs||[]).filter(d => (d.tipo==='consumivel'||d.tipo==='misc'||d.tipo==='equipamento') &&
    d.nome.toLowerCase().includes(busca));
  lista.innerHTML = defs.slice(0,30).map(d => {
    const sel = CENA_ED.cfgBauItens.some(i=>i.defId===d.id);
    return `<div onclick="cfgBauToggleItem('${d.id}','${d.nome.replace(/'/g,"\\'")}','${d.icone||'📦'}')" style="display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:6px;border:1px solid ${sel?'rgba(200,168,75,0.5)':'var(--borda)'};background:${sel?'rgba(200,168,75,0.08)':'transparent'};cursor:pointer">
      <span style="font-size:1.1rem">${d.icone||'📦'}</span>
      <span style="font-family:var(--fonte-d);font-size:0.7rem;flex:1;color:${sel?'var(--destaque)':'var(--texto)'}">${d.nome}</span>
      ${sel?'<span style="color:var(--destaque)">✓</span>':''}
    </div>`;
  }).join('');
}

function cfgBauToggleItem(defId, nome, icone) {
  const idx = CENA_ED.cfgBauItens.findIndex(i=>i.defId===defId);
  if (idx>=0) CENA_ED.cfgBauItens.splice(idx,1);
  else CENA_ED.cfgBauItens.push({defId,nome,icone,quantidade:1});
  cfgBauRenderLista();
  cfgBauRenderSelecionados();
}

function cfgBauRenderSelecionados() {
  const el = document.getElementById('cfg-bau-selecionados');
  if (!el) return;
  if (!CENA_ED.cfgBauItens.length) { el.innerHTML='<div style="font-size:.65rem;color:var(--suave);font-style:italic">Nenhum item selecionado</div>'; return; }
  el.innerHTML = CENA_ED.cfgBauItens.map((it,i) =>
    `<div style="display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:5px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2)">
      <span>${it.icone}</span><span style="flex:1;font-family:var(--fonte-d);font-size:.65rem;color:var(--texto)">${it.nome}</span>
      <input type="number" value="${it.quantidade}" min="1" max="99" style="width:42px;text-align:center;background:var(--escuro);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-size:.68rem;padding:2px" onchange="CENA_ED.cfgBauItens[${i}].quantidade=Math.max(1,+this.value)">
      <button onclick="CENA_ED.cfgBauItens.splice(${i},1);cfgBauRenderSelecionados();cfgBauRenderLista()" style="background:none;border:none;color:rgba(192,57,43,.6);cursor:pointer;font-size:.85rem">✕</button>
    </div>`
  ).join('');
}

function cfgBauConfirmar() {
  const col = +document.getElementById('cfg-bau-col').value;
  const row = +document.getElementById('cfg-bau-row').value;
  const nome = document.getElementById('cfg-bau-nome').value.trim()||'Baú';
  const isLoot = document.getElementById('cfg-bau-sec-loot').style.display==='block';
  const id = document.getElementById('cfg-bau-id').value || 'bau_'+Date.now();
  const rd = CENA_ED.mapa.render_data;
  const existing = rd.objetos.findIndex(o=>o.id===id);
  const obj = {
    id, col, row, tipo:'bau', nome, aberto:false,
    itens: isLoot ? null : JSON.parse(JSON.stringify(CENA_ED.cfgBauItens)),
    loot_aleatorio: isLoot,
    raridade: isLoot ? (document.getElementById('cfg-bau-raridade')?.value||'comum') : null,
    loot_qtd: isLoot ? (+document.getElementById('cfg-bau-qtd')?.value||2) : null,
  };
  if (existing>=0) rd.objetos[existing]=obj;
  else { rd.objetos.push(obj); CENA_ED.undoStack.push({tipo:'add_obj',id}); }
  document.getElementById('modal-cfg-bau').style.display='none';
  cenaRenderizarSVG();
}

// ── Limpar e Salvar ──────────────────────────────────────────────────────
function cenaLimparTudo() {
  if (!confirm('Remover todas as paredes, portas e objetos deste mapa?')) return;
  const rd = CENA_ED.mapa?.render_data;
  if (rd) { rd.paredes=[]; rd.portas=[]; rd.objetos=[]; }
  cenaRenderizarSVG();
}

async function cenaSalvar() {
  const m = CENA_ED.mapa;
  const entry = (RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===m?.map_id);
  if (!entry) return;
  entry.mapa.render_data = m.render_data;
  await salvarRenderData(entry.id, m.render_data);
  // Atualizar mapa ao vivo
  if (MAPA_STATE?.mapaAtualId===m.map_id) { mapaRenderTokens(m); }
  mostrarToast('✓ Cena salva','ok');
}

// Ctrl+Z desfaz no editor
document.addEventListener('keydown', e => {
  if (!document.getElementById('modal-cena-overlay')?.style.display||document.getElementById('modal-cena-overlay').style.display==='none') return;
  if ((e.ctrlKey||e.metaKey) && e.key==='z') {
    e.preventDefault();
    const last = CENA_ED.undoStack.pop();
    if (!last) return;
    const rd = CENA_ED.mapa?.render_data;
    if (!rd) return;
    if (last.tipo==='add_parede') rd.paredes = rd.paredes.filter(p=>p.id!==last.id);
    else if (last.tipo==='add_porta') rd.portas = rd.portas.filter(p=>p.id!==last.id);
    else if (last.tipo==='add_obj') rd.objetos = rd.objetos.filter(o=>o.id!==last.id);
    cenaRenderizarSVG();
  }
});

// Também renderizar objetos no mapa ao vivo (hook em paredePorRenderizar já existente)
const _origParedePorRenderizar = paredePorRenderizar;
paredePorRenderizar = function(m) {
  _origParedePorRenderizar(m);
  _renderizarObjetosNoMapa(m);
};

function _renderizarObjetosNoMapa(m) {
  const svg = document.getElementById('mapa-dist-svg');
  if (!svg) return;
  svg.querySelectorAll('.mapa-objeto').forEach(el=>el.remove());
  const rd = m?.render_data;
  if (!rd?.objetos?.length) return;
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas) return;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  const cols = m.largura_total||20, rows = m.altura_total||20;
  const cW = W/cols, cH = H/rows;

  (rd.objetos||[]).forEach(o => {
    const cx = (o.col+.5)*cW, cy = (o.row+.5)*cH;
    const emap = {chave:'🗝',blocker:'🪨',bau:o.aberto?'🪣':'📦'};
    const cmap = {chave:'rgba(200,168,75,0.2)',blocker:'rgba(40,40,60,0.7)',bau:'rgba(200,168,75,0.15)'};
    const r = Math.min(cW,cH)*.38;
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('mapa-objeto');
    const circ = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circ.setAttribute('cx',cx); circ.setAttribute('cy',cy); circ.setAttribute('r',r);
    circ.setAttribute('fill',cmap[o.tipo]||'rgba(50,50,70,.5)');
    circ.setAttribute('stroke','rgba(255,255,255,0.15)'); circ.setAttribute('stroke-width',1.5);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',cx); txt.setAttribute('y',cy+5);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size',Math.round(r*1.3));
    txt.textContent = emap[o.tipo]||'❓';
    if (o.tipo!=='blocker') {
      g.style.cursor='pointer';
      g.addEventListener('click',e=>{e.stopPropagation();_objetoClicar(m.map_id,o.id);});
    }
    g.appendChild(circ); g.appendChild(txt);
    svg.appendChild(g);
  });
}

// ── Clicar num objeto durante sessão ─────────────────────────────────────
function _objetoClicar(mapId, objId) {
  const mapa = _getMapaById(mapId);
  const o = mapa?.render_data?.objetos?.find(x=>x.id===objId);
  if (!o) return;
  const charNome = TOKEN_CTRL.nomeSelecionado || RPG_DATA?.linked;
  if (!charNome) { mostrarToast('Selecione um personagem primeiro','aviso'); return; }
  if (o.tipo==='chave') {
    _coletarChave(mapId, objId, charNome);
  } else if (o.tipo==='bau') {
    _abrirBauModal(mapId, objId, charNome);
  }
}

// ── Chaves ──────────────────────────────────────────────────────────────
function _coletarChave(mapId, keyId, charNome) {
  const mapa = _getMapaById(mapId);
  const key = mapa?.render_data?.objetos?.find(o=>o.id===keyId);
  if (!key || key.tipo!=='chave') return;
  const char = RPG_DATA?.characters?.find(c=>c.nome===charNome);
  if (!char) return;
  // Adicionar chave ao inventário em memória
  if (!char.custom_attrs) char.custom_attrs={};
  if (!char.custom_attrs.chaves) char.custom_attrs.chaves=[];
  char.custom_attrs.chaves.push({id:key.id,nome:key.nome,chave_palavra:key.chave_palavra});
  // Remover chave do mapa
  mapa.render_data.objetos = mapa.render_data.objetos.filter(o=>o.id!==keyId);
  const entry=(RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if(entry){entry.mapa.render_data=mapa.render_data;}
  mostrarToast('🗝 '+charNome+' coletou '+key.nome,'ok');
  paredePorRenderizar(mapa);
  salvarRenderData(entry?.id,mapa.render_data);
  // Atualizar contextuais (agora tem chave)
  _mesaRenderAcoes?.();
}

// Verificar se personagem tem a chave para uma porta
function charTemChave(charNome, chave_palavra) {
  const char = RPG_DATA?.characters?.find(c=>c.nome===charNome);
  return (char?.custom_attrs?.chaves||[]).some(k=>k.chave_palavra===chave_palavra);
}

// ── Sobrescrever usarPorta para suporte a trancadas ───────────────────────
const _origUsarPorta = typeof usarPorta==='function' ? usarPorta : null;
usarPorta = async function(mapId, portaId, charNome) {
  const mapa = _getMapaById(mapId);
  const porta = mapa?.render_data?.portas?.find(p=>p.id===portaId);
  if (!porta) return;
  if (porta.trancada) {
    const nome = charNome || TOKEN_CTRL.nomeSelecionado || RPG_DATA?.linked;
    if (!charTemChave(nome, porta.chave_palavra)) {
      mostrarToast('🔒 Você precisa da chave para abrir esta porta!','erro'); return;
    }
    porta.trancada = false;
    mostrarToast('🗝 Porta destrancada com '+porta.chave_palavra,'ok');
  }
  porta.aberta = !porta.aberta;
  mostrarToast(porta.aberta?'🚪 '+porta.nome+' aberta':'🔒 '+porta.nome+' fechada','ok');
  const entry=(RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if(entry)entry.mapa.render_data=mapa.render_data;
  paredePorRenderizar(mapa);
  await salvarRenderData(entry?.id,mapa.render_data);
};

// Porta trancada bloqueia movimento mesmo sem parede
const _origParedeBloq = paredeBloqueiaMovimento;
paredeBloqueiaMovimento = function(mapId, colAtual, rowAtual, dc, dr) {
  if (_origParedeBloq(mapId,colAtual,rowAtual,dc,dr)) return true;
  const colDest=colAtual+dc, rowDest=rowAtual+dr;
  const mapa=_getMapaById(mapId);
  // Blocker ocupa célula inteira
  const blockers = mapa?.render_data?.objetos?.filter(o=>o.tipo==='blocker')||[];
  if (blockers.some(b=>b.col===colDest&&b.row===rowDest)) return true;
  return false;
};

// Contextuais: porta adjacente (incluindo trancada)
const _origCtxGerarPortas = window.ctxGerarBotoes;
window.ctxGerarBotoes = function(charNome, mapId) {
  const botoes = _origCtxGerarPortas ? _origCtxGerarPortas(charNome,mapId) : [];
  const c=(RPG_DATA?.characters||[]).find(ch=>ch.nome===charNome);
  const pos=c?getPosicaoNoMapa(c,mapId):null;
  if(!pos) return botoes;
  const col=pos.col??0, row=pos.row??0;
  const mapa=_getMapaById(mapId);

  // Chaves adjacentes
  (mapa?.render_data?.objetos||[]).filter(o=>o.tipo==='chave'&&Math.abs(o.col-col)<=1&&Math.abs(o.row-row)<=1).forEach(key=>{
    botoes.unshift({label:'🗝 Pegar '+key.nome,acao:'coletar_chave',keyId:key.id,mapId,prioridade:11,desabilitado:false});
  });
  // Baús adjacentes
  (mapa?.render_data?.objetos||[]).filter(o=>o.tipo==='bau'&&!o.aberto&&Math.abs(o.col-col)<=1&&Math.abs(o.row-row)<=1).forEach(bau=>{
    botoes.unshift({label:'📦 Abrir '+bau.nome,acao:'abrir_bau',bauId:bau.id,mapId,prioridade:10,desabilitado:false});
  });
  
  // Obstáculos destrutíveis adjacentes
  (mapa?.render_data?.objetos||[]).filter(o=>o.tipo==='obstaculo'&&o.destrutivel&&Math.abs(o.col-col)<=1&&Math.abs(o.row-row)<=1).forEach(obs=>{
    const hp = obs.hp_atual !== undefined ? obs.hp_atual : obs.hp_max;
    botoes.unshift({
      label: `⚔ Quebrar ${obs.nome} (${hp}/${obs.hp_max} HP)`,
      acao:'atacar_obstaculo',
      obstaculoId:obs.id,
      mapId,
      prioridade:9,
      desabilitado:false
    });
  });
  
  // Portas adjacentes
  (mapa?.render_data?.portas||[]).filter(p=>Math.abs(p.col-col)<=1&&Math.abs(p.row-row)<=1).forEach(porta=>{
    const temChave=!porta.trancada||charTemChave(charNome,porta.chave_palavra);
    
    // Botão de abrir/fechar porta (se não for destrutível ou se tiver chave)
    if (!porta.destrutivel || temChave) {
      botoes.unshift({
        label: porta.trancada?(temChave?'🗝 Destrancada: '+porta.nome:'🔒 Trancada: '+porta.nome):(porta.aberta?'🚪 Fechar '+porta.nome:'🚪 Abrir '+porta.nome),
        acao:'usar_porta',portaId:porta.id,mapId,prioridade:10,desabilitado:porta.trancada&&!temChave,
      });
    }
    
    // Botão de quebrar porta (se for destrutível)
    if (porta.destrutivel) {
      const hp = porta.hp_atual !== undefined ? porta.hp_atual : porta.hp_max;
      botoes.unshift({
        label: `⚔ Quebrar ${porta.nome} (${hp}/${porta.hp_max} HP)`,
        acao:'atacar_porta',
        portaId:porta.id,
        mapId,
        prioridade:9,
        desabilitado:false
      });
    }
  });
  return botoes;
};

const _origCtxExecPortas = window.ctxExecutarAcao;
window.ctxExecutarAcao = function(botao) {
  if (botao?.acao==='coletar_chave') { const n=TOKEN_CTRL.nomeSelecionado||RPG_DATA?.linked; _coletarChave(botao.mapId,botao.keyId,n); return; }
  if (botao?.acao==='abrir_bau')   { const n=TOKEN_CTRL.nomeSelecionado||RPG_DATA?.linked; _abrirBauModal(botao.mapId,botao.bauId,n); return; }
  if (botao?.acao==='atacar_porta') { const n=TOKEN_CTRL.nomeSelecionado||RPG_DATA?.linked; _abrirModalAtacarPorta(botao.mapId,botao.portaId,n); return; }
  if (botao?.acao==='atacar_obstaculo') { const n=TOKEN_CTRL.nomeSelecionado||RPG_DATA?.linked; _abrirModalAtacarObstaculo(botao.mapId,botao.obstaculoId,n); return; }
  return _origCtxExecPortas?.(botao);
};
window.ctxExecutarAcao=window.ctxExecutarAcao;

// ── Baú ──────────────────────────────────────────────────────────────────
function _abrirBauModal(mapId, bauId, charNome) {
  const mapa=_getMapaById(mapId);
  const bau=mapa?.render_data?.objetos?.find(o=>o.id===bauId);
  if(!bau||bau.tipo!=='bau') return;
  document.getElementById('abrir-bau-id').value=bauId;
  document.getElementById('abrir-bau-char').value=charNome||'';
  document.getElementById('abrir-bau-nome').textContent=bau.nome||'Baú';

  let descHtml='';
  if(bau.aberto){descHtml='<div style="color:var(--suave);font-style:italic">Este baú já foi aberto.</div>';}
  else if(bau.loot_aleatorio){
    descHtml=`<div style="color:var(--suave);font-size:.78rem">Loot aleatório (${bau.raridade||'comum'}, ${bau.loot_qtd||2} itens)</div>`;
  } else {
    const itens=bau.itens||[];
    descHtml=itens.length
      ?itens.map(it=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:5px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,.2)"><span style="font-size:1rem">${it.icone||'📦'}</span><span style="font-family:var(--fonte-d);font-size:.7rem;flex:1">${it.nome}</span><span style="color:var(--suave)">×${it.quantidade}</span></div>`).join('')
      :'<div style="color:var(--suave);font-style:italic;font-size:.78rem">Baú vazio</div>';
  }
  document.getElementById('abrir-bau-conteudo').innerHTML=descHtml;
  document.getElementById('abrir-bau-btn').style.display=bau.aberto?'none':'block';
  document.getElementById('modal-abrir-bau').style.display='flex';
}

async function abrirBauConfirmar() {
  const bauId=document.getElementById('abrir-bau-id').value;
  const charNome=document.getElementById('abrir-bau-char').value;
  const mapId=MAPA_STATE?.mapaAtualId;
  const mapa=_getMapaById(mapId);
  const bau=mapa?.render_data?.objetos?.find(o=>o.id===bauId);
  if(!bau) return;
  bau.aberto=true;

  // Distribuir itens ao inventário do personagem via INV
  const char=RPG_DATA?.characters?.find(c=>c.nome===charNome);
  if(char && !bau.loot_aleatorio && bau.itens?.length) {
    for(const it of bau.itens) {
      const def=(INV?.itemDefs||[]).find(d=>d.id===it.defId||d.nome===it.nome);
      if(def && typeof adicionarItemInventario==='function') {
        await adicionarItemInventario(char.id,def.id,it.quantidade).catch(()=>{});
      }
    }
    mostrarToast('📦 Itens do baú adicionados ao inventário de '+charNome,'ok');
  } else if(bau.loot_aleatorio) {
    // Gerar loot aleatório
    const defs=(INV?.itemDefs||[]).filter(d=>_rarPeso(d.raridade)>= _rarPeso(bau.raridade||'comum'));
    const qtd=bau.loot_qtd||2;
    for(let i=0;i<qtd&&defs.length;i++){
      const def=defs[Math.floor(Math.random()*defs.length)];
      if(char && typeof adicionarItemInventario==='function') await adicionarItemInventario(char.id,def.id,1).catch(()=>{});
    }
    mostrarToast('📦 Loot gerado para '+charNome,'ok');
  }

  const entry=(RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if(entry){entry.mapa.render_data=mapa.render_data;}
  await salvarRenderData(entry?.id,mapa.render_data);
  paredePorRenderizar(mapa);
  document.getElementById('modal-abrir-bau').style.display='none';
}

function _rarPeso(r){return {comum:1,incomum:2,raro:3,épico:4,lendário:5}[r]||1;}

// ── Atacar Porta Destrutível ─────────────────────────────────────────
function _abrirModalAtacarPorta(mapId, portaId, charNome) {
  const mapa=_getMapaById(mapId);
  const porta=mapa?.render_data?.portas?.find(p=>p.id===portaId);
  if(!porta||!porta.destrutivel) return;
  
  const hp = porta.hp_atual !== undefined ? porta.hp_atual : porta.hp_max;
  const char=RPG_DATA?.characters?.find(c=>c.nome===charNome);
  if(!char) return;
  
  const habilidades = atkGetHabilidadesCampanha(charNome).filter(h => h.formula_dano);
  
  if(!habilidades.length) {
    mostrarToast('Você não tem habilidades de dano para quebrar a porta','erro');
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'modal-atacar-porta-temp';
  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:950;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--escuro);border:1px solid var(--borda);border-top:2px solid #e74c3c;border-radius:16px 16px 0 0;padding:24px 20px 44px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.9rem;color:#e74c3c">⚔ Quebrar ${porta.nome}</div>
          <div style="font-size:0.7rem;color:var(--suave);margin-top:4px">HP: ${hp}/${porta.hp_max}</div>
        </div>
        <button onclick="document.getElementById('modal-atacar-porta-temp').remove()" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.75rem;color:var(--suave);margin-bottom:12px">Escolha uma habilidade de ataque:</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${habilidades.map(h => `
          <button onclick="_aplicarDanoPorta('${mapId}','${portaId}','${charNome}',${JSON.stringify(h).replace(/"/g,'&quot;')})" 
            style="padding:10px 14px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.3);border-radius:8px;color:#e8604c;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-align:left">
            ${h.nome} <span style="float:right;color:#f0cc6a;font-size:0.62rem">${h.formula_dano}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function _aplicarDanoPorta(mapId, portaId, charNome, habilidade) {
  const mapa=_getMapaById(mapId);
  const porta=mapa?.render_data?.portas?.find(p=>p.id===portaId);
  if(!porta) return;
  
  // Calcular dano
  const char=RPG_DATA?.characters?.find(c=>c.nome===charNome);
  const dano = calcularDanoHabilidade(habilidade, char);
  
  // Aplicar dano
  porta.hp_atual = (porta.hp_atual !== undefined ? porta.hp_atual : porta.hp_max) - dano;
  
  // Verificar se quebrou
  if(porta.hp_atual <= 0) {
    porta.hp_atual = 0;
    porta.aberta = true;
    porta.trancada = false;
    mostrarToast(`💥 ${porta.nome} foi quebrada! (${dano} de dano)`, 'sucesso');
  } else {
    mostrarToast(`⚔ ${dano} de dano aplicado. HP restante: ${porta.hp_atual}/${porta.hp_max}`, 'ok');
  }
  
  // Salvar
  const entry=(RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if(entry){entry.mapa.render_data=mapa.render_data;}
  await salvarRenderData(entry?.id,mapa.render_data);
  paredePorRenderizar(mapa);
  
  // Fechar modal
  document.getElementById('modal-atacar-porta-temp')?.remove();
  
  // Atualizar botões de ação
  if(typeof _mesaRenderizarColunas === 'function') _mesaRenderizarColunas();
}

// ── Atacar Obstáculo Destrutível ─────────────────────────────────────
function _abrirModalAtacarObstaculo(mapId, obstaculoId, charNome) {
  const mapa=_getMapaById(mapId);
  const obs=mapa?.render_data?.objetos?.find(o=>o.id===obstaculoId);
  if(!obs||obs.tipo!=='obstaculo'||!obs.destrutivel) return;
  
  const hp = obs.hp_atual !== undefined ? obs.hp_atual : obs.hp_max;
  const char=RPG_DATA?.characters?.find(c=>c.nome===charNome);
  if(!char) return;
  
  const habilidades = atkGetHabilidadesCampanha(charNome).filter(h => h.formula_dano);
  
  if(!habilidades.length) {
    mostrarToast('Você não tem habilidades de dano para quebrar o obstáculo','erro');
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'modal-atacar-obstaculo-temp';
  modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:950;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--escuro);border:1px solid var(--borda);border-top:2px solid #e74c3c;border-radius:16px 16px 0 0;padding:24px 20px 44px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <div style="font-family:var(--fonte-d);font-size:0.9rem;color:#e74c3c">⚔ Quebrar ${obs.nome}</div>
          <div style="font-size:0.7rem;color:var(--suave);margin-top:4px">HP: ${hp}/${obs.hp_max}</div>
        </div>
        <button onclick="document.getElementById('modal-atacar-obstaculo-temp').remove()" style="background:none;border:none;color:var(--suave);font-size:1.4rem;cursor:pointer">✕</button>
      </div>
      <div style="font-size:0.75rem;color:var(--suave);margin-bottom:12px">Escolha uma habilidade de ataque:</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${habilidades.map(h => `
          <button onclick="_aplicarDanoObstaculo('${mapId}','${obstaculoId}','${charNome}',${JSON.stringify(h).replace(/"/g,'&quot;')})" 
            style="padding:10px 14px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.3);border-radius:8px;color:#e8604c;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-align:left">
            ${h.nome} <span style="float:right;color:#f0cc6a;font-size:0.62rem">${h.formula_dano}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function _aplicarDanoObstaculo(mapId, obstaculoId, charNome, habilidade) {
  const mapa=_getMapaById(mapId);
  const obs=mapa?.render_data?.objetos?.find(o=>o.id===obstaculoId);
  if(!obs) return;
  
  // Calcular dano
  const char=RPG_DATA?.characters?.find(c=>c.nome===charNome);
  const dano = calcularDanoHabilidade(habilidade, char);
  
  // Aplicar dano
  obs.hp_atual = (obs.hp_atual !== undefined ? obs.hp_atual : obs.hp_max) - dano;
  
  // Verificar se foi destruído
  if(obs.hp_atual <= 0) {
    obs.hp_atual = 0;
    // Remover obstáculo do mapa
    const idx = mapa.render_data.objetos.findIndex(o => o.id === obstaculoId);
    if(idx !== -1) mapa.render_data.objetos.splice(idx, 1);
    mostrarToast(`💥 ${obs.nome} foi destruído! (${dano} de dano)`, 'sucesso');
  } else {
    mostrarToast(`⚔ ${dano} de dano aplicado. HP restante: ${obs.hp_atual}/${obs.hp_max}`, 'ok');
  }
  
  // Salvar
  const entry=(RPG_DATA?.mapas||[]).find(l=>l.mapa.map_id===mapId);
  if(entry){entry.mapa.render_data=mapa.render_data;}
  await salvarRenderData(entry?.id,mapa.render_data);
  paredePorRenderizar(mapa);
  
  // Fechar modal
  document.getElementById('modal-atacar-obstaculo-temp')?.remove();
  
  // Atualizar botões de ação
  if(typeof _mesaRenderizarColunas === 'function') _mesaRenderizarColunas();
}

// Função helper para calcular dano
function calcularDanoHabilidade(hab, char) {
  if(!hab.formula_dano) return 0;
  
  try {
    // Parse simples de fórmulas como "2d6+4" ou "1d8+FOR"
    const formula = hab.formula_dano.toUpperCase();
    let total = 0;
    
    // Extrair dados (ex: 2d6)
    const dadoMatch = formula.match(/(\d+)d(\d+)/);
    if(dadoMatch) {
      const qtd = parseInt(dadoMatch[1]);
      const lados = parseInt(dadoMatch[2]);
      for(let i=0;i<qtd;i++) {
        total += Math.floor(Math.random() * lados) + 1;
      }
    }
    
    // Extrair modificador fixo (ex: +4)
    const modMatch = formula.match(/([+-]\d+)/);
    if(modMatch) {
      total += parseInt(modMatch[1]);
    }
    
    // Extrair atributo (ex: +FOR)
    const attrs = ['FOR','DES','CON','INT','SAB','CAR'];
    attrs.forEach(attr => {
      if(formula.includes('+'+attr) && char?.atributos?.[attr]) {
        const mod = Math.floor((char.atributos[attr] - 10) / 2);
        total += mod;
      }
    });
    
    return Math.max(1, total); // Mínimo 1 de dano
  } catch(e) {
    return 1;
  }
}

// Expor funções globalmente
window._abrirModalAtacarPorta = _abrirModalAtacarPorta;
window._aplicarDanoPorta = _aplicarDanoPorta;
window._abrirModalAtacarObstaculo = _abrirModalAtacarObstaculo;
window._aplicarDanoObstaculo = _aplicarDanoObstaculo;
window.calcularDanoHabilidade = calcularDanoHabilidade;

// Expor globalmente
window.abrirEditorCena=abrirEditorCena;
window.fecharEditorCena=fecharEditorCena;
window.cenaSalvar=cenaSalvar;
window.cenaLimparTudo=cenaLimparTudo;
window.cenaSetFerramenta=cenaSetFerramenta;
window.cfgPortaConfirmar=cfgPortaConfirmar;
window.cfgChaveConfirmar=cfgChaveConfirmar;
window.cfgBauTab=cfgBauTab;
window.cfgBauRenderLista=cfgBauRenderLista;
window.cfgBauToggleItem=cfgBauToggleItem;
window.cfgBauConfirmar=cfgBauConfirmar;
window.abrirBauConfirmar=abrirBauConfirmar;


// ════════════════════════════════════════════════════════════════════════════
// INTEGRAÇÃO COM MODAL DE MAPA — funções chamadas por nmAtivarModoParede()
// ════════════════════════════════════════════════════════════════════════════

function nmAtivarModoParede() {
  const cor     = document.getElementById('nm-parede-cor')?.value     || '#7ec8f0';
  const largura = parseInt(document.getElementById('nm-parede-largura')?.value) || 3;
  WALLS_STATE.configAtual = { cor, largura };
  MAPA_STATE.toolMode = 'paredes';
  fecharModalNovoMapa();
  mostrarToast('🧱 Clique nas bordas do grid para adicionar paredes', '');
}

function nmAtivarModoPorta() {
  CENARIO_STATE.placement = {
    tipo: 'porta', nome: 'Porta',
    trancada: false, chave_palavra: '',
    aberta: false,
    mapa_destino: null, destino_col: 0, destino_row: 0,
    cor: '#c8a84b', icone: '🚪',
  };
  MAPA_STATE.toolMode = 'cenario_placement';
  fecharModalNovoMapa();
  mostrarToast('🚪 Clique no mapa para posicionar a porta', '');
}

function nmRenderParedesList() {
  const lista = document.getElementById('nm-paredes-lista');
  if (!lista) return;
  const mapa = _getMapaById(MAPA_STATE?.mapaAtualId);
  const paredes = mapa?.render_data?.paredes || [];
  const portas  = mapa?.render_data?.portas  || [];
  if (!paredes.length && !portas.length) {
    lista.innerHTML = '<div style="font-size:0.65rem;color:var(--suave);font-style:italic;padding:4px">Nenhuma parede ou porta</div>';
    return;
  }
  const mapId = (mapa?.map_id || '').replace(/'/g, "\\'");
  lista.innerHTML = [
    ...paredes.map(p => `<div style="display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:5px;background:rgba(126,200,240,0.05);border:1px solid rgba(126,200,240,0.15);margin-bottom:3px">
      <span style="font-size:0.8rem">🧱</span>
      <span style="font-size:0.65rem;color:var(--suave);flex:1">Parede ${p.tipo||'?'} (${p.col},${p.row})</span>
      <button onclick="paredRemover('${mapId}','${p.id}')" style="background:none;border:none;color:rgba(192,57,43,0.6);cursor:pointer;font-size:0.8rem" title="Remover">✕</button>
    </div>`),
    ...portas.map(d => `<div style="display:flex;align-items:center;gap:6px;padding:4px 7px;border-radius:5px;background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.15);margin-bottom:3px">
      <span style="font-size:0.8rem">${d.icone||'🚪'}</span>
      <span style="font-size:0.65rem;color:var(--suave);flex:1">${d.nome||'Porta'} (${d.col},${d.row})${d.mapa_destino?' → '+d.mapa_destino:''}</span>
      <button onclick="portaEditar('${mapId}','${d.id}')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.75rem" title="Editar">✏️</button>
    </div>`)
  ].join('');
}

window.nmAtivarModoParede = nmAtivarModoParede;
window.nmAtivarModoPorta  = nmAtivarModoPorta;
window.nmRenderParedesList = nmRenderParedesList;

// ── Popular seletor de mapa destino na aba de porta ───────────────────────
function cenarioPortaPopularMapas() {
  const sel = document.getElementById('cen-porta-mapa-destino');
  if (!sel || sel.options.length > 1) return; // já populado
  const mapas = RPG_DATA?.mapas || [];
  sel.innerHTML = mapas.length
    ? mapas.map(l => `<option value="${l.mapa.map_id}">${l.mapa.nome} (${l.mapa.map_id})</option>`).join('')
    : '<option value="">— Nenhum mapa disponível —</option>';
}
window.cenarioPortaPopularMapas = cenarioPortaPopularMapas;

// ── Trocar aba do modal de cenário ────────────────────────────────
function trocarAbaCenario(aba) {
  // Ocultar todas as abas
  document.querySelectorAll('.cenario-tab').forEach(tab => tab.style.display = 'none');
  // Mostrar aba selecionada
  const tabEl = document.getElementById(`cenario-tab-${aba}`);
  if (tabEl) tabEl.style.display = 'block';
  
  // Atualizar botões de navegação
  document.querySelectorAll('.cenario-nav-btn').forEach(btn => {
    if (btn.dataset.tab === aba) {
      const cores = {
        porta: { bg: 'rgba(176,126,240,0.12)', border: 'rgba(176,126,240,0.35)', color: '#b07ef0' },
        chave: { bg: 'rgba(200,168,75,0.12)', border: 'rgba(200,168,75,0.35)', color: '#c8a84b' },
        bau: { bg: 'rgba(39,174,96,0.12)', border: 'rgba(39,174,96,0.35)', color: '#5ee09a' },
        obstaculo: { bg: 'rgba(231,76,60,0.1)', border: 'rgba(231,76,60,0.3)', color: '#e74c3c' }
      };
      const cor = cores[aba] || cores.porta;
      btn.style.background = cor.bg;
      btn.style.borderColor = cor.border;
      btn.style.color = cor.color;
    } else {
      btn.style.background = 'transparent';
      btn.style.borderColor = 'var(--borda)';
      btn.style.color = 'var(--suave)';
    }
  });
}

// ── Atualizar resumo de objetos de cenário no modal de config ─────────
function atualizarResumoObjetosCenario() {
  const resumo = document.getElementById('cenario-objetos-resumo');
  if (!resumo) return;
  
  const mapId = MAPA_STATE?.mapaAtualId;
  const mapa = _getMapaById(mapId);
  if (!mapa || !mapa.render_data || !mapa.render_data.objetos) {
    resumo.innerHTML = '<div style="font-size:0.7rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Nenhum objeto configurado ainda</div>';
    return;
  }
  
  const objetos = mapa.render_data.objetos || [];
  if (objetos.length === 0) {
    resumo.innerHTML = '<div style="font-size:0.7rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Nenhum objeto configurado ainda</div>';
    return;
  }
  
  const html = objetos.map(obj => {
    const icones = { porta: '🚪', chave: '🗝', bau: '💰', obstaculo: '🪨' };
    const cores = { porta: '#b07ef0', chave: '#c8a84b', bau: '#5ee09a', obstaculo: '#e74c3c' };
    const icone = obj.icone || icones[obj.tipo] || '📍';
    const cor = cores[obj.tipo] || '#7a92aa';
    return `<div style="padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:6px;display:flex;align-items:center;gap:8px;font-size:0.72rem">
      <span style="font-size:1.1rem">${icone}</span>
      <span style="flex:1;color:${cor}">${obj.nome || 'Sem nome'}</span>
      <span style="font-size:0.65rem;color:var(--suave)">${obj.col},${obj.row}</span>
    </div>`;
  }).join('');
  
  resumo.innerHTML = html;
}

// ── Integração modal de cenário com editor canvas ─────────────────
let CANVAS_CONTEXT = null; // 'canvas' quando usado no editor canvas

function abrirModalCenarioNoCanvas(tipo) {
  CANVAS_CONTEXT = 'canvas';
  
  // Abrir modal
  const modalOverlay = document.getElementById('modal-cenario-overlay');
  if (modalOverlay) modalOverlay.style.display = 'flex';
  
  // Mapear tipo para aba correta
  const mapa = {
    porta: 'porta',
    chave: 'chave',
    bau: 'bau',
    obstaculo: 'obstaculo',
    objeto: 'bau' // fallback
  };
  
  trocarAbaCenario(mapa[tipo] || 'porta');
}

// Sobrescrever função para funcionar tanto no mapa quanto no canvas
const cenarioAtivarPlacement_original = window.cenarioAtivarPlacement;
window.cenarioAtivarPlacement = function(tipo) {
  if (CANVAS_CONTEXT === 'canvas') {
    // Modo canvas: adicionar listener de clique no canvas
    const canvas = document.getElementById('nmce-canvas');
    if (!canvas) {
      mostrarToast('Canvas não encontrado', 'erro');
      return;
    }
    
    // Verificar se funções do Catalog estão disponíveis
    if (typeof window.nmceCoords !== 'function' || typeof window._nmceSnapCelula !== 'function') {
      mostrarToast('Funções do editor não carregadas', 'erro');
      return;
    }
    
    // Fechar modal
    const modalOverlay = document.getElementById('modal-cenario-overlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    
    mostrarToast('📍 Clique no canvas para posicionar', '');
    
    // Adicionar listener temporário
    const handleClick = function(e) {
      const { x, y } = window.nmceCoords(e, canvas);
      const { col, row } = window._nmceSnapCelula(x, y, canvas);
      
      // Coletar dados do formulário
      const dados = coletarDadosFormularioCenario(tipo);
      
      // Adicionar ao render_data do canvas
      adicionarObjetoAoCanvas(tipo, col, row, dados);
      
      // Remover listener
      canvas.removeEventListener('click', handleClick);
      CANVAS_CONTEXT = null;
      
      mostrarToast('✓ Objeto adicionado', 'sucesso');
    };
    
    canvas.addEventListener('click', handleClick, { once: true });
    
  } else if (CANVAS_CONTEXT === 'canvas_editing') {
    // Modo edição: atualizar objeto existente
    if (!window._editandoObjeto) return;
    
    const { tipo: tipoObj, index } = window._editandoObjeto;
    const dados = coletarDadosFormularioCenario(tipo);
    
    // Atualizar objeto
    if (tipoObj === 'porta') {
      const porta = window.nmCE.renderData.portas[index];
      porta.nome = dados.nome;
      porta.icone = dados.icone;
      porta.cor = dados.cor;
      porta.trancada = dados.trancada;
      porta.chave_palavra = dados.chave_palavra || '';
      porta.transicao = dados.transicao;
      porta.mapa_destino = dados.mapa_destino;
      porta.destino_col = dados.destino_col;
      porta.destino_row = dados.destino_row;
      porta.destrutivel = dados.destrutivel || false;
      porta.hp_max = dados.hp_max;
      porta.hp_atual = dados.hp_atual;
    } else {
      const obj = window.nmCE.renderData.objetos[index];
      if (tipo === 'chave') {
        obj.nome = dados.nome;
        obj.icone = dados.icone;
        obj.chave_palavra = dados.palavra;
      } else if (tipo === 'bau') {
        obj.nome = dados.nome;
        obj.trancado = dados.trancado;
        obj.chave_palavra = dados.chave_palavra || '';
        obj.loot_tipo = dados.loot_tipo;
        obj.loot_ouro = dados.loot_ouro;
        obj.item_id = dados.item_id;
        obj.item_qtd = dados.item_qtd;
        obj.tier = dados.tier;
      } else if (tipo === 'obstaculo') {
        obj.nome = dados.nome;
        obj.icone = dados.icone;
        obj.tamanho = dados.tamanho;
        obj.destrutivel = dados.destrutivel || false;
        obj.hp_max = dados.hp_max;
        obj.hp_atual = dados.hp_atual;
      }
    }
    
    // Fechar modal
    const modalOverlay = document.getElementById('modal-cenario-overlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    
    // Re-renderizar
    const canvas = document.getElementById('nmce-canvas');
    if (canvas && typeof window._nmceRenderWalls === 'function') {
      window._nmceRenderWalls(canvas);
    }
    if (typeof window._nmceAtualizarLista === 'function') {
      window._nmceAtualizarLista();
    }
    
    // Limpar estado
    window._editandoObjeto = null;
    CANVAS_CONTEXT = null;
    
    // Restaurar texto dos botões
    const btnPorta = document.querySelector('#cenario-tab-porta button');
    const btnChave = document.querySelector('#cenario-tab-chave button');
    const btnBau = document.querySelector('#cenario-tab-bau button');
    const btnObs = document.querySelector('#cenario-tab-obstaculo button');
    
    if (btnPorta) btnPorta.innerHTML = '📍 Clique no mapa para posicionar';
    if (btnChave) btnChave.innerHTML = '📍 Clique no mapa para posicionar';
    if (btnBau) btnBau.innerHTML = '📍 Clique no mapa para posicionar';
    if (btnObs) btnObs.innerHTML = '📍 Clique no mapa para posicionar';
    
    mostrarToast('✓ Objeto atualizado', 'sucesso');
    
  } else {
    // Modo mapa normal: usar função original
    if (cenarioAtivarPlacement_original) {
      cenarioAtivarPlacement_original(tipo);
    }
  }
};

function coletarDadosFormularioCenario(tipo) {
  const dados = {};
  
  if (tipo === 'porta') {
    dados.nome = document.getElementById('cen-porta-nome')?.value.trim() || 'Porta';
    dados.icone = document.getElementById('cen-porta-icone')?.value.trim() || '🚪';
    dados.cor = document.getElementById('cen-porta-cor')?.value || '#c8a84b';
    dados.trancada = document.getElementById('cen-porta-trancada')?.checked || false;
    dados.chave_palavra = dados.trancada ? (document.getElementById('cen-porta-chave')?.value.trim() || '') : '';
    dados.transicao = document.getElementById('cen-porta-transicao')?.checked || false;
    dados.destrutivel = document.getElementById('cen-porta-destrutivel')?.checked || false;
    dados.hp_max = dados.destrutivel ? (parseInt(document.getElementById('cen-porta-hp')?.value) || 20) : null;
    dados.hp_atual = dados.hp_max;
    if (dados.transicao) {
      dados.mapa_destino = document.getElementById('cen-porta-mapa-destino')?.value || null;
      dados.destino_col = parseInt(document.getElementById('cen-porta-dest-col')?.value) || 0;
      dados.destino_row = parseInt(document.getElementById('cen-porta-dest-row')?.value) || 0;
    }
  }
  
  else if (tipo === 'chave') {
    dados.nome = document.getElementById('cen-chave-nome')?.value.trim() || 'Chave';
    dados.palavra = document.getElementById('cen-chave-palavra')?.value.trim() || '';
    dados.icone = document.getElementById('cen-chave-icone')?.value.trim() || '🗝';
  }
  
  else if (tipo === 'bau') {
    dados.nome = document.getElementById('cen-bau-nome')?.value.trim() || 'Baú';
    dados.trancado = document.getElementById('cen-bau-trancado')?.checked || false;
    dados.chave_palavra = dados.trancado ? (document.getElementById('cen-bau-chave')?.value.trim() || '') : '';
    dados.loot_tipo = document.getElementById('cen-bau-loot-tipo')?.value || 'nenhum';
    if (dados.loot_tipo === 'ouro') {
      dados.loot_ouro = parseInt(document.getElementById('cen-bau-ouro-qtd')?.value) || 50;
    } else if (dados.loot_tipo === 'item_catalog') {
      dados.item_id = document.getElementById('cen-bau-item-id')?.value || null;
      dados.item_qtd = parseInt(document.getElementById('cen-bau-item-qtd')?.value) || 1;
    } else if (dados.loot_tipo === 'aleatorio') {
      dados.tier = parseInt(document.getElementById('cen-bau-tier')?.value) || 1;
    }
  }
  
  else if (tipo === 'obstaculo') {
    dados.nome = document.getElementById('cen-obs-nome')?.value.trim() || 'Obstáculo';
    dados.icone = document.getElementById('cen-obs-icone')?.value.trim() || '🪨';
    dados.tamanho = parseInt(document.getElementById('cen-obs-tamanho')?.value) || 1;
    dados.destrutivel = document.getElementById('cen-obs-destrutivel')?.checked || false;
    dados.hp_max = dados.destrutivel ? (parseInt(document.getElementById('cen-obs-hp')?.value) || 50) : null;
    dados.hp_atual = dados.hp_max;
  }
  
  return dados;
}

function adicionarObjetoAoCanvas(tipo, col, row, dados) {
  if (!window.nmCE || !window.nmCE.renderData) {
    mostrarToast('Editor canvas não inicializado', 'erro');
    return;
  }
  
  if (tipo === 'porta') {
    window.nmCE.renderData.portas = window.nmCE.renderData.portas || [];
    window.nmCE.renderData.portas.push({
      id: 'door_' + Date.now(),
      col, row,
      nome: dados.nome,
      icone: dados.icone,
      cor: dados.cor,
      aberta: false,
      trancada: dados.trancada,
      chave_palavra: dados.chave_palavra || '',
      mapa_destino: dados.mapa_destino || null,
      destino_col: dados.destino_col || 0,
      destino_row: dados.destino_row || 0,
      destrutivel: dados.destrutivel || false,
      hp_max: dados.hp_max || null,
      hp_atual: dados.hp_atual || dados.hp_max
    });
  }
  
  else if (tipo === 'chave') {
    window.nmCE.renderData.objetos = window.nmCE.renderData.objetos || [];
    window.nmCE.renderData.objetos.push({
      id: 'chave_' + Date.now(),
      tipo: 'chave',
      col, row,
      nome: dados.nome,
      icone: dados.icone,
      chave_palavra: dados.palavra,
      aberto: false
    });
  }
  
  else if (tipo === 'bau') {
    window.nmCE.renderData.objetos = window.nmCE.renderData.objetos || [];
    window.nmCE.renderData.objetos.push({
      id: 'bau_' + Date.now(),
      tipo: 'bau',
      col, row,
      nome: dados.nome,
      icone: '📦',
      aberto: false,
      trancado: dados.trancado,
      chave_palavra: dados.chave_palavra || '',
      loot_tipo: dados.loot_tipo,
      loot_ouro: dados.loot_ouro || null,
      item_id: dados.item_id || null,
      item_qtd: dados.item_qtd || null,
      tier: dados.tier || null
    });
  }
  
  else if (tipo === 'obstaculo') {
    window.nmCE.renderData.objetos = window.nmCE.renderData.objetos || [];
    window.nmCE.renderData.objetos.push({
      id: 'obs_' + Date.now(),
      tipo: 'obstaculo',
      col, row,
      nome: dados.nome,
      icone: dados.icone,
      tamanho: dados.tamanho,
      aberto: false,
      destrutivel: dados.destrutivel || false,
      hp_max: dados.hp_max || null,
      hp_atual: dados.hp_atual || dados.hp_max
    });
  }
  
  // Re-renderizar
  const canvas = document.getElementById('nmce-canvas');
  if (canvas && typeof window._nmceRenderWalls === 'function') {
    window._nmceRenderWalls(canvas);
  }
  if (typeof window._nmceAtualizarLista === 'function') {
    window._nmceAtualizarLista();
  }
}

// ── EDIÇÃO DE OBJETOS CLICADOS ─────────────────────────────────────
function editarObjetoCanvas(tipo, index) {
  let obj;
  let tipoModal;
  
  if (tipo === 'porta') {
    obj = window.nmCE.renderData.portas[index];
    tipoModal = 'porta';
  } else {
    obj = window.nmCE.renderData.objetos[index];
    tipoModal = obj.tipo; // 'chave', 'bau', 'obstaculo'
  }
  
  if (!obj) return;
  
  // Guardar índice para atualizar depois
  window._editandoObjeto = { tipo, index };
  
  // Abrir modal
  CANVAS_CONTEXT = 'canvas_editing';
  const modalOverlay = document.getElementById('modal-cenario-overlay');
  if (modalOverlay) modalOverlay.style.display = 'flex';
  trocarAbaCenario(tipoModal);
  
  // Preencher campos com dados do objeto
  if (tipo === 'porta') {
    document.getElementById('cen-porta-nome').value = obj.nome || '';
    document.getElementById('cen-porta-icone').value = obj.icone || '🚪';
    document.getElementById('cen-porta-cor').value = obj.cor || '#c8a84b';
    document.getElementById('cen-porta-trancada').checked = obj.trancada || false;
    document.getElementById('cen-porta-chave-wrap').style.display = obj.trancada ? 'block' : 'none';
    document.getElementById('cen-porta-chave').value = obj.chave_palavra || '';
    document.getElementById('cen-porta-destrutivel').checked = obj.destrutivel || false;
    document.getElementById('cen-porta-hp-wrap').style.display = obj.destrutivel ? 'block' : 'none';
    document.getElementById('cen-porta-hp').value = obj.hp_max || 20;
  }
  else if (tipoModal === 'chave') {
    document.getElementById('cen-chave-nome').value = obj.nome || '';
    document.getElementById('cen-chave-palavra').value = obj.chave_palavra || '';
    document.getElementById('cen-chave-icone').value = obj.icone || '🗝';
  }
  else if (tipoModal === 'bau') {
    document.getElementById('cen-bau-nome').value = obj.nome || '';
    document.getElementById('cen-bau-trancado').checked = obj.trancado || false;
    document.getElementById('cen-bau-chave-wrap').style.display = obj.trancado ? 'block' : 'none';
    document.getElementById('cen-bau-chave').value = obj.chave_palavra || '';
    document.getElementById('cen-bau-loot-tipo').value = obj.loot_tipo || 'nenhum';
    if (typeof cenarioBauLootChange === 'function') cenarioBauLootChange();
    if (obj.loot_tipo === 'ouro') {
      document.getElementById('cen-bau-ouro-qtd').value = obj.loot_ouro || 50;
    }
  }
  else if (tipoModal === 'obstaculo') {
    document.getElementById('cen-obs-nome').value = obj.nome || '';
    document.getElementById('cen-obs-icone').value = obj.icone || '🪨';
    document.getElementById('cen-obs-tamanho').value = obj.tamanho || 1;
    document.getElementById('cen-obs-destrutivel').checked = obj.destrutivel || false;
    document.getElementById('cen-obs-hp-wrap').style.display = obj.destrutivel ? 'block' : 'none';
    document.getElementById('cen-obs-hp').value = obj.hp_max || 50;
  }
  
  // Mudar texto do botão para "Atualizar"
  const btnPorta = document.querySelector('#cenario-tab-porta button');
  const btnChave = document.querySelector('#cenario-tab-chave button');
  const btnBau = document.querySelector('#cenario-tab-bau button');
  const btnObs = document.querySelector('#cenario-tab-obstaculo button');
  
  if (btnPorta) btnPorta.innerHTML = '✓ Atualizar Porta';
  if (btnChave) btnChave.innerHTML = '✓ Atualizar Chave';
  if (btnBau) btnBau.innerHTML = '✓ Atualizar Baú';
  if (btnObs) btnObs.innerHTML = '✓ Atualizar Obstáculo';
}
