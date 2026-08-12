// aventura/fase-editor.ts
// Editor de fases do Modo Aventura — substitui os 3 editores antigos (unificado
// do mestre, editor do wizard de criação e mini editor de Nova Fase).
//
// Overlay fullscreen com: zoom/pan (roda + pinch + arraste), undo/redo por
// traço, ferramentas de piso/parede/vazio/saída/borracha, balde (flood fill),
// retângulo, pincel de peça do tileset COM ROTAÇÃO (R/F ou botões), spawn de
// jogadores, par de portas internas e porta de fase. Pointer Events em tudo
// (mouse + touch + caneta).
//
// Modos:
//   avtFaseEditorAbrir({ modo: 'live' })  — edita AVT_STATE.dungeon (só mestre);
//     salvar reusa a sequência provada do editor antigo (aprendizado de estilo,
//     _avtGravarDungeonNoSlot, PATCH rpg_registry, broadcast avt_dungeon_update)
//     agora COM a guarda _avtRpgAtivo/_avtPodeSalvarRegistro.
//   avtFaseEditorAbrir({ modo: 'draft', w, h, tiles?, rooms?, onExport }) —
//     edita um grid destacado e entrega via onExport(dungeonData); rooms são
//     preservadas (ou derivadas do piso pintado) em vez de zeradas.

const FED: any = {
  aberto: false, modo: 'live',
  tiles: [] as any[], w: 0, h: 0,
  baseline: null as any,
  portasInternas: [] as any[], fasesExtras: [] as any[], rooms: [] as any[],
  spawns: [] as any[], chestPositions: [] as any[],
  tool: 'wall', brushKey: null as any, brushXf: 0,
  undo: [] as any[], redo: [] as any[], _stroke: null as any,
  zoom: 1, panX: 0, panY: 0,
  // Tileset do modo draft: url/config vêm do chamador (wizard/Nova Fase) e as
  // texturas ficam locais (FED.texs) — nunca tocam AVT_STATE da fase ao vivo.
  tsUrl: null as any, tsCfg: null as any, tsHerdadoDe: null as any, texs: null as any,
  pendingDoorAnchor: null as any, _portaCfgCell: null as any,
  _rectAnchor: null as any, _rectHover: null as any,
  onExport: null as any,
  _pointers: new Map(), _panStart: null as any, _pinchStart: null as any,
};

const FED_SZ = 24; // px por tile no zoom 1

function _fedTilesetTexturas() {
  if (FED.texs) return FED.texs; // draft: texturas locais
  const A: any = (window as any).AVT_STATE;
  return (A?._tilesetLoaded && A?._tilesetTextures) ? A._tilesetTextures : null;
}
function _fedTilesetCfg() {
  if (FED.tsCfg) return FED.tsCfg; // draft
  const A: any = (window as any).AVT_STATE;
  return A?._tilesetConfig || A?.dungeon?.tileset_config
    || A?.rpg?.theme_json?.dungeon_data?.tileset_config || null;
}
// Resolve o tileset visível no editor. Em live prefere o tileset APLICADO da
// fase atual (_tilesetImgUrl) — o resolver antigo ignorava fases extras com
// tileset próprio e mostrava a paleta do tileset principal.
function _fedResolverTileset() {
  if (FED.modo !== 'live') return { url: FED.tsUrl, cfg: FED.tsCfg, herdadoDe: FED.tsHerdadoDe };
  const A: any = (window as any).AVT_STATE;
  const url = A?._tilesetImgUrl || A?.dungeon?.tileset_img_url
    || A?.rpg?.theme_json?.dungeon_data?.tileset_img_url
    || A?.rpg?.theme_json?.tileset_img_url || null;
  return { url, cfg: _fedTilesetCfg(), herdadoDe: A?._tilesetHerdadoDe || null };
}
// Garante as texturas em memória ao abrir; sem isso o canvas mostrava só cores
// sólidas e o Distribuir gravava chaves invisíveis (a queixa do "tileset sumiu").
function _fedPreloadTileset() {
  const W: any = window as any;
  const ts = _fedResolverTileset();
  if (!ts.url || !ts.cfg || typeof W._avtCarregarTileset !== 'function') return;
  const A: any = W.AVT_STATE;
  if (FED.modo === 'live') {
    if (A?._tilesetLoaded && A?._tilesetTextures) return;
    W._avtCarregarTileset(ts.url, ts.cfg)
      .then(() => { _fedRender(); _fedInfoPincel(); })
      .catch(() => {});
  } else {
    W._avtCarregarTileset(ts.url, ts.cfg, { aplicar: false })
      .then((texs: any) => { FED.texs = texs || null; _fedRender(); _fedInfoPincel(); })
      .catch(() => {});
  }
}

// ── Abertura ─────────────────────────────────────────────────────────────────
function avtFaseEditorAbrir(opts: any) {
  const W: any = window as any;
  opts = opts || {};
  FED.modo = opts.modo || 'live';

  if (FED.modo === 'live') {
    const dungeon = W.AVT_STATE?.dungeon;
    if (!dungeon) { W.mostrarToast?.('Nenhum mapa carregado', 'aviso'); return; }
    if (typeof W._avtSouMestre === 'function' && !W._avtSouMestre()) {
      W.mostrarToast?.('Apenas o mestre pode editar o mapa', 'aviso'); return;
    }
    FED.tiles = dungeon.tiles.map((r: any) => [...r]);
    FED.baseline = dungeon.tiles.map((r: any) => [...r]);
    FED.w = dungeon.w; FED.h = dungeon.h;
    FED.rooms = dungeon.rooms || [];
    FED.chestPositions = dungeon._chestPositions || [];
    FED.portasInternas = (dungeon._portasInternas || []).map((p: any) => JSON.parse(JSON.stringify(p)));
    FED.fasesExtras = (W.AVT_STATE.rpg?.theme_json?.fases_extras || []).map((f: any) => JSON.parse(JSON.stringify(f)));
    FED.spawns = (dungeon._spawnJogadores || []).map((s: any) => ({ ...s }));
    FED.onExport = null;
    FED.tsUrl = null; FED.tsCfg = null; FED.tsHerdadoDe = null;
  } else {
    FED.w = opts.w || 24; FED.h = opts.h || 18;
    FED.tiles = opts.tiles
      ? opts.tiles.map((r: any) => [...r])
      : Array.from({ length: FED.h }, () => Array(FED.w).fill(0 /* AVT_T.PAREDE */));
    FED.baseline = null;
    FED.rooms = opts.rooms || [];
    FED.chestPositions = [];
    FED.portasInternas = [];
    FED.fasesExtras = [];
    FED.spawns = (opts.spawn_jogadores || []).map((s: any) => ({ ...s }));
    FED.onExport = opts.onExport || null;
    FED.tsUrl = opts.tilesetUrl || null;
    FED.tsCfg = opts.tilesetConfig ? JSON.parse(JSON.stringify(opts.tilesetConfig)) : null;
    FED.tsHerdadoDe = opts.tilesetHerdadoDe || null;
  }

  FED.tool = 'wall'; FED.brushKey = null; FED.brushXf = 0;
  FED.undo = []; FED.redo = []; FED._stroke = null;
  FED.pendingDoorAnchor = null; FED._rectAnchor = null; FED._rectHover = null;
  FED.zoom = 1; FED.panX = 0; FED.panY = 0;
  FED.texs = null;
  FED.aberto = true;

  _fedMontarUI();
  _fedRender();
  _fedPreloadTileset();
}

// ── UI ───────────────────────────────────────────────────────────────────────
function _fedMontarUI() {
  let ov = document.getElementById('avt-fase-editor');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'avt-fase-editor';
    document.body.appendChild(ov);
  }
  (ov as any).style.cssText = 'position:fixed;inset:0;background:rgba(4,7,13,0.97);z-index:9500;display:flex;flex-direction:column;font-family:var(--fonte-d,serif)';

  const W: any = window as any;
  const ts = _fedResolverTileset();
  const tsUrl = ts.url;
  const tsSrc = tsUrl && typeof W.normalizeImgUrl === 'function' ? W.normalizeImgUrl(tsUrl) : tsUrl;
  const tool = (id: string, label: string, titulo: string) =>
    `<button id="fed-tool-${id}" class="fed-btn ${FED.tool === id ? 'fed-btn-on' : ''}" title="${titulo}" onclick="_fedSetTool('${id}')">${label}</button>`;

  ov.innerHTML = `
    <div class="fed-toolbar">
      ${tool('floor', '🟫', 'Piso')}${tool('wall', '🔲', 'Parede')}${tool('void', '⬛', 'Vazio (fora da dungeon)')}${tool('saida', '🚪', 'Saída da fase')}${tool('erase', '🧽', 'Borracha (remove porta/spawn e vira parede)')}
      <span class="fed-sep"></span>
      ${tool('fill', '🪣', 'Balde — preenche a região contígua')}${tool('rect', '▭', 'Retângulo — arraste para preencher')}
      <span class="fed-sep"></span>
      ${tool('door', '🌀', 'Porta (interna/fase) — 2 cliques')}${tool('spawn', '📍', 'Spawn de jogadores')}
      <span class="fed-sep"></span>
      <button class="fed-btn" onclick="_fedUndo()" title="Desfazer (Ctrl+Z)">↩</button>
      <button class="fed-btn" onclick="_fedRedo()" title="Refazer (Ctrl+Y)">↪</button>
      <span class="fed-sep"></span>
      <span style="font-size:0.62rem;color:#7a92aa">Tam.</span>
      <input id="fed-w" type="number" min="8" max="120" value="${FED.w}" class="fed-num">
      <input id="fed-h" type="number" min="8" max="120" value="${FED.h}" class="fed-num">
      <button class="fed-btn" onclick="_fedResize()" title="Redimensionar (corta/expande com vazio)">⤢</button>
      <span style="flex:1"></span>
      ${tsUrl ? `<button class="fed-btn" onclick="_fedDistribuir()" title="Recalcula as peças do tileset por vizinhança (preserva portas/saída)">✦ Distribuir</button>` : ''}
      ${FED.modo === 'live'
        ? `<button class="fed-btn fed-btn-ok" onclick="_fedSalvarLive()">💾 Salvar</button>`
        : `<button class="fed-btn fed-btn-ok" onclick="_fedExportarDraft()">✓ Usar este mapa</button>`}
      <button class="fed-btn fed-btn-danger" onclick="avtFaseEditorFechar()">✕</button>
    </div>
    <div id="fed-status" class="fed-status">Ferramenta: Parede — clique/arraste para pintar. Roda = zoom · botão do meio ou 2 dedos = pan · R gira · F espelha.</div>
    <div class="fed-body">
      ${tsUrl ? `
      <div class="fed-palette">
        <div class="fed-palette-title">Tileset — clique na peça</div>
        ${ts.herdadoDe ? `<div class="fed-brush-info" style="color:#c8a84b">Herdado de "${ts.herdadoDe}"</div>` : ''}
        <div id="fed-ts-wrap" style="position:relative;cursor:crosshair">
          <img id="fed-ts-img" src="${tsSrc}" style="display:block;image-rendering:pixelated;width:100%">
          <canvas id="fed-ts-sel" style="position:absolute;inset:0;pointer-events:none"></canvas>
        </div>
        <div class="fed-rot-row">
          <button class="fed-btn" onclick="_fedGirar(-1)" title="Girar anti-horário">⟲</button>
          <button class="fed-btn" onclick="_fedGirar(1)" title="Girar horário (R)">⟳</button>
          <button class="fed-btn" onclick="_fedFlip()" title="Espelhar (F)">⇋</button>
          <canvas id="fed-brush-prev" width="34" height="34" style="border:1px solid rgba(79,163,209,0.3);border-radius:4px;image-rendering:pixelated"></canvas>
        </div>
        <div id="fed-brush-info" class="fed-brush-info">Nenhuma peça selecionada</div>
      </div>` : ''}
      <div class="fed-canvas-wrap" id="fed-canvas-wrap">
        <canvas id="fed-canvas" style="display:block;touch-action:none"></canvas>
      </div>
    </div>`;

  const wrap = document.getElementById('fed-canvas-wrap')!;
  const canvas = document.getElementById('fed-canvas') as HTMLCanvasElement;
  const fit = () => {
    canvas.width = wrap.clientWidth || 800;
    canvas.height = wrap.clientHeight || 500;
    _fedRender();
  };
  setTimeout(fit, 0);
  window.addEventListener('resize', fit);
  (FED as any)._fitFn = fit;

  _fedBindCanvas(canvas);
  _fedBindPalette();
  _fedBindTeclado();
}

function avtFaseEditorFechar() {
  const ov = document.getElementById('avt-fase-editor');
  if (ov) (ov as any).style.display = 'none';
  FED.aberto = false;
  FED.texs = null; // libera as texturas locais do draft
  if ((FED as any)._fitFn) { window.removeEventListener('resize', (FED as any)._fitFn); (FED as any)._fitFn = null; }
  if ((FED as any)._keyFn) { window.removeEventListener('keydown', (FED as any)._keyFn); (FED as any)._keyFn = null; }
}

function _fedStatus(msg: string) {
  const el = document.getElementById('fed-status');
  if (el) el.textContent = msg;
}

function _fedSetTool(id: string) {
  FED.tool = id;
  FED.pendingDoorAnchor = null; FED._rectAnchor = null;
  document.querySelectorAll('.fed-btn-on').forEach(b => b.classList.remove('fed-btn-on'));
  document.getElementById('fed-tool-' + id)?.classList.add('fed-btn-on');
  const nomes: any = {
    floor: 'Piso', wall: 'Parede', void: 'Vazio', saida: 'Saída', erase: 'Borracha',
    fill: 'Balde', rect: 'Retângulo', door: 'Porta — clique na célula', spawn: 'Spawn de jogadores',
    tile: 'Peça do tileset',
  };
  _fedStatus('Ferramenta: ' + (nomes[id] || id));
  _fedRender();
}

// ── Undo/redo por lote ───────────────────────────────────────────────────────
function _fedStrokeStart() { FED._stroke = []; }
function _fedStrokeEnd() {
  if (FED._stroke && FED._stroke.length) {
    FED.undo.push({ cells: FED._stroke });
    if (FED.undo.length > 120) FED.undo.shift();
    FED.redo = [];
  }
  FED._stroke = null;
}
function _fedSet(x: number, y: number, valor: any) {
  if (x < 0 || y < 0 || x >= FED.w || y >= FED.h) return;
  if (!FED.tiles[y]) FED.tiles[y] = [];
  const antes = FED.tiles[y][x];
  if (antes === valor) return;
  FED.tiles[y][x] = valor;
  if (FED._stroke) FED._stroke.push({ x, y, antes, depois: valor });
}
function _fedAplicarLote(cells: any[], usarAntes: boolean) {
  for (const c of cells) FED.tiles[c.y][c.x] = usarAntes ? c.antes : c.depois;
}
function _fedUndo() {
  const b = FED.undo.pop();
  if (!b) return;
  if (b.grid) { FED.redo.push({ grid: FED.tiles.map((r: any) => [...r]), w: FED.w, h: FED.h }); FED.tiles = b.grid; FED.w = b.w; FED.h = b.h; }
  else { _fedAplicarLote(b.cells, true); FED.redo.push(b); }
  _fedRender();
}
function _fedRedo() {
  const b = FED.redo.pop();
  if (!b) return;
  if (b.grid) { FED.undo.push({ grid: FED.tiles.map((r: any) => [...r]), w: FED.w, h: FED.h }); FED.tiles = b.grid; FED.w = b.w; FED.h = b.h; }
  else { _fedAplicarLote(b.cells, false); FED.undo.push(b); }
  _fedRender();
}

// ── Ferramentas ──────────────────────────────────────────────────────────────
function _fedValorDaFerramenta(): any {
  const W: any = window as any;
  const T = W.AVT_T || { PAREDE: 0, PISO: 1, SAIDA: 2 };
  switch (FED.tool) {
    case 'floor': return T.PISO;
    case 'wall':  return T.PAREDE;
    case 'void':  return null;
    case 'saida': return T.SAIDA;
    case 'tile':  return W._avtCellCom ? W._avtCellCom(FED.brushKey, FED.brushXf) : FED.brushKey;
    default: return undefined;
  }
}

function _fedPintar(x: number, y: number) {
  const W: any = window as any;
  const t = FED.tool;
  if (t === 'erase') {
    const antes = FED.portasInternas.length;
    FED.portasInternas = FED.portasInternas.filter((p: any) =>
      !((p.a && p.a.col === x && p.a.row === y) || (p.b && p.b.col === x && p.b.row === y)));
    if (FED.portasInternas.length !== antes) W.mostrarToast?.('Porta interna removida', 'ok');
    FED.fasesExtras.forEach((f: any) => {
      if (f.porta && f.porta.col === x && f.porta.row === y) { f.porta = null; W.mostrarToast?.('Porta de fase removida', 'ok'); }
    });
    FED.spawns = FED.spawns.filter((s: any) => !(s.x === x && s.y === y));
    _fedSet(x, y, (W.AVT_T || { PAREDE: 0 }).PAREDE);
    return;
  }
  if (t === 'spawn') {
    const ix = FED.spawns.findIndex((s: any) => s.x === x && s.y === y);
    if (ix >= 0) FED.spawns.splice(ix, 1);
    else FED.spawns.push({ x, y });
    _fedRender();
    return;
  }
  const v = _fedValorDaFerramenta();
  if (v !== undefined) _fedSet(x, y, v);
}

function _fedFill(x: number, y: number) {
  const alvo = FED.tiles[y]?.[x];
  const v = FED.tool === 'fill' ? ((): any => {
    // Balde usa o "material" atual do pincel: peça do tileset se selecionada, senão piso
    const W: any = window as any;
    if (FED.brushKey) return W._avtCellCom ? W._avtCellCom(FED.brushKey, FED.brushXf) : FED.brushKey;
    return (W.AVT_T || { PISO: 1 }).PISO;
  })() : undefined;
  if (v === undefined || alvo === v) return;
  const mesma = (c: any) => c === alvo;
  const fila = [[x, y]];
  const visto = new Set([x + ',' + y]);
  let n = 0;
  while (fila.length && n < 20000) {
    const [cx, cy] = fila.shift()!;
    if (!mesma(FED.tiles[cy]?.[cx])) continue;
    _fedSet(cx, cy, v); n++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= FED.w || ny >= FED.h || visto.has(k)) continue;
      visto.add(k); fila.push([nx, ny]);
    }
  }
}

function _fedRect(a: any, b: any) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const W: any = window as any;
  const v = FED.brushKey
    ? (W._avtCellCom ? W._avtCellCom(FED.brushKey, FED.brushXf) : FED.brushKey)
    : (W.AVT_T || { PISO: 1 }).PISO;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) _fedSet(x, y, v);
}

function _fedResize() {
  const nw = Math.max(8, Math.min(120, parseInt((document.getElementById('fed-w') as any)?.value || FED.w, 10)));
  const nh = Math.max(8, Math.min(120, parseInt((document.getElementById('fed-h') as any)?.value || FED.h, 10)));
  if (nw === FED.w && nh === FED.h) return;
  FED.undo.push({ grid: FED.tiles.map((r: any) => [...r]), w: FED.w, h: FED.h });
  FED.redo = [];
  const novo = Array.from({ length: nh }, (_, y) =>
    Array.from({ length: nw }, (_, x) => (y < FED.h && x < FED.w) ? FED.tiles[y][x] : null));
  FED.tiles = novo; FED.w = nw; FED.h = nh;
  _fedStatus(`Mapa redimensionado para ${nw}×${nh} (expande com vazio).`);
  _fedRender();
}

// "Distribuir": recalcula peças via autotiler, preservando portas/saída/objetos.
function _fedDistribuir() {
  const W: any = window as any;
  const T = W.AVT_T || { PAREDE: 0, PISO: 1, SAIDA: 2 };
  const view = { w: FED.w, h: FED.h, tiles: FED.tiles, _chestPositions: FED.chestPositions, tileset_config: _fedTilesetCfg() };
  _fedStrokeStart();
  for (let y = 0; y < FED.h; y++) {
    for (let x = 0; x < FED.w; x++) {
      const t = FED.tiles[y]?.[x];
      if (t === null || t === undefined || t === T.SAIDA) continue;
      const base = W._avtCellBase ? W._avtCellBase(t) : t;
      // Preserva portas pintadas (o antigo Distribuir as convertia em parede)
      if (base === 'porta' || base === 'porta_fase') continue;
      const key = W._avtGetTileSemanticKey(x, y, view);
      if (key) _fedSet(x, y, key);
    }
  }
  _fedStrokeEnd();
  _fedStatus('Peças redistribuídas por vizinhança (portas e saída preservadas).');
  _fedRender();
}

// ── Canvas: entrada + render ─────────────────────────────────────────────────
function _fedCelDoEvento(canvas: HTMLCanvasElement, ev: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  const cx = (ev.clientX - r.left - FED.panX) / FED.zoom;
  const cy = (ev.clientY - r.top - FED.panY) / FED.zoom;
  return { x: Math.floor(cx / FED_SZ), y: Math.floor(cy / FED_SZ) };
}

function _fedBindCanvas(canvas: HTMLCanvasElement) {
  let pintando = false;

  canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
    canvas.setPointerCapture(ev.pointerId);
    FED._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (FED._pointers.size === 2) {
      // Pinch: cancela pintura e inicia zoom por gesto
      pintando = false; _fedStrokeEnd();
      const pts = [...FED._pointers.values()];
      FED._pinchStart = {
        d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: FED.zoom, panX: FED.panX, panY: FED.panY,
        cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2,
      };
      return;
    }

    if (ev.button === 1 || ev.button === 2) {
      FED._panStart = { x: ev.clientX, y: ev.clientY, panX: FED.panX, panY: FED.panY };
      return;
    }

    const cel = _fedCelDoEvento(canvas, ev);
    if (cel.x < 0 || cel.y < 0 || cel.x >= FED.w || cel.y >= FED.h) return;

    if (FED.tool === 'door') { _fedCliqueDoor(cel.x, cel.y); return; }
    if (FED.tool === 'fill') { _fedStrokeStart(); _fedFill(cel.x, cel.y); _fedStrokeEnd(); _fedRender(); return; }
    if (FED.tool === 'rect') { FED._rectAnchor = cel; FED._rectHover = cel; _fedRender(); return; }
    if (FED.tool === 'spawn') { _fedPintar(cel.x, cel.y); return; }

    pintando = true;
    _fedStrokeStart();
    _fedPintar(cel.x, cel.y);
    _fedRender();
  });

  canvas.addEventListener('pointermove', (ev: PointerEvent) => {
    if (FED._pointers.has(ev.pointerId)) FED._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (FED._pinchStart && FED._pointers.size === 2) {
      const pts = [...FED._pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const fator = Math.max(0.25, Math.min(4, FED._pinchStart.zoom * (d / Math.max(1, FED._pinchStart.d))));
      _fedZoomAt(FED._pinchStart.cx, FED._pinchStart.cy, fator, canvas);
      return;
    }
    if (FED._panStart) {
      FED.panX = FED._panStart.panX + (ev.clientX - FED._panStart.x);
      FED.panY = FED._panStart.panY + (ev.clientY - FED._panStart.y);
      _fedRender();
      return;
    }
    if (FED._rectAnchor) {
      FED._rectHover = _fedCelDoEvento(canvas, ev);
      _fedRender();
      return;
    }
    if (!pintando) return;
    const cel = _fedCelDoEvento(canvas, ev);
    _fedPintar(cel.x, cel.y);
    _fedRender();
  });

  const fim = (ev: PointerEvent) => {
    FED._pointers.delete(ev.pointerId);
    if (FED._pointers.size < 2) FED._pinchStart = null;
    FED._panStart = null;
    if (FED._rectAnchor && FED._rectHover) {
      _fedStrokeStart();
      _fedRect(FED._rectAnchor, FED._rectHover);
      _fedStrokeEnd();
      FED._rectAnchor = null; FED._rectHover = null;
    }
    if (pintando) { pintando = false; _fedStrokeEnd(); }
    _fedRender();
  };
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  canvas.addEventListener('contextmenu', ev => ev.preventDefault());

  canvas.addEventListener('wheel', (ev: WheelEvent) => {
    ev.preventDefault();
    const fator = Math.max(0.25, Math.min(4, FED.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
    _fedZoomAt(ev.clientX, ev.clientY, fator, canvas);
  }, { passive: false });
}

function _fedZoomAt(clientX: number, clientY: number, novoZoom: number, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  const mx = clientX - r.left, my = clientY - r.top;
  // Mantém o ponto sob o cursor fixo durante o zoom
  FED.panX = mx - ((mx - FED.panX) / FED.zoom) * novoZoom;
  FED.panY = my - ((my - FED.panY) / FED.zoom) * novoZoom;
  FED.zoom = novoZoom;
  _fedRender();
}

function _fedBindTeclado() {
  if ((FED as any)._keyFn) window.removeEventListener('keydown', (FED as any)._keyFn);
  const fn = (ev: KeyboardEvent) => {
    if (!FED.aberto) return;
    const tag = (document.activeElement as any)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = ev.key.toLowerCase();
    if (k === 'escape') {
      if (FED.pendingDoorAnchor) { FED.pendingDoorAnchor = null; _fedStatus('Porta cancelada.'); _fedRender(); }
      else avtFaseEditorFechar();
    } else if (k === 'r') { _fedGirar(1); }
    else if (k === 'f') { _fedFlip(); }
    else if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); _fedUndo(); }
    else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); _fedRedo(); }
  };
  (FED as any)._keyFn = fn;
  window.addEventListener('keydown', fn);
}

// ── Paleta do tileset ────────────────────────────────────────────────────────
function _fedBindPalette() {
  const wrapEl = document.getElementById('fed-ts-wrap');
  const img = document.getElementById('fed-ts-img') as HTMLImageElement;
  if (!wrapEl || !img) return;
  wrapEl.addEventListener('click', (ev: MouseEvent) => {
    const cfg = _fedTilesetCfg();
    if (!cfg) return;
    const r = img.getBoundingClientRect();
    const cols = cfg.cols || 4, rows = cfg.rows || 4;
    const tc = Math.floor(((ev.clientX - r.left) / r.width) * cols);
    const tr = Math.floor(((ev.clientY - r.top) / r.height) * rows);
    if (tc < 0 || tr < 0 || tc >= cols || tr >= rows) return;
    const W: any = window as any;
    const key = W._avtBlocoChavePorCelula ? W._avtBlocoChavePorCelula(tc, tr) : null;
    if (!key) { _fedAtribuirPapel(tc, tr); return; }
    FED.brushKey = key; FED.brushXf = 0;
    _fedSetTool('tile');
    _fedInfoPincel();
    _fedMarcarSelecao(tc, tr, cols, rows, img);
  });
}

function _fedMarcarSelecao(tc: number, tr: number, cols: number, rows: number, img: HTMLImageElement) {
  const sel = document.getElementById('fed-ts-sel') as HTMLCanvasElement;
  if (!sel) return;
  sel.width = img.clientWidth; sel.height = img.clientHeight;
  const c = sel.getContext('2d')!;
  c.clearRect(0, 0, sel.width, sel.height);
  c.strokeStyle = '#c8a84b'; c.lineWidth = 2;
  c.strokeRect((tc / cols) * sel.width + 1, (tr / rows) * sel.height + 1, sel.width / cols - 2, sel.height / rows - 2);
}

function _fedInfoPincel() {
  const el = document.getElementById('fed-brush-info');
  if (el) {
    const rot = ['0°', '90°', '180°', '270°'][FED.brushXf & 3];
    const flip = FED.brushXf >= 4 ? ' + flip' : '';
    el.textContent = FED.brushKey ? `${FED.brushKey} · ${rot}${flip}` : 'Nenhuma peça selecionada';
  }
  const prev = document.getElementById('fed-brush-prev') as HTMLCanvasElement;
  const texs = _fedTilesetTexturas();
  const W: any = window as any;
  if (prev) {
    const c = prev.getContext('2d')!;
    c.clearRect(0, 0, prev.width, prev.height);
    const tex = FED.brushKey && texs ? texs[FED.brushKey] : null;
    if (tex && W._avtDrawTileXform) W._avtDrawTileXform(c, tex, 1, 1, 32, FED.brushXf);
  }
}

function _fedGirar(sentido: number) {
  if (!FED.brushKey) return;
  const rot = ((FED.brushXf & 3) + sentido + 4) % 4;
  FED.brushXf = (FED.brushXf >= 4 ? 4 : 0) + rot;
  _fedInfoPincel();
  _fedStatus(`Pincel: ${FED.brushKey} girado.`);
}
function _fedFlip() {
  if (!FED.brushKey) return;
  FED.brushXf = FED.brushXf >= 4 ? FED.brushXf - 4 : FED.brushXf + 4;
  _fedInfoPincel();
}

// Célula do atlas sem papel mapeado: oferece atribuir uma chave em vez do
// antigo no-op silencioso do picker.
function _fedAtribuirPapel(tc: number, tr: number) {
  const W: any = window as any;
  const cfg = _fedTilesetCfg();
  if (!cfg) return;
  const papel = prompt(
    `A célula (${tc},${tr}) do atlas não tem papel mapeado.\n` +
    `Digite uma chave para ela (ex.: piso_6, objeto_4, decor_1) ou deixe vazio para cancelar:`);
  if (!papel || !papel.trim()) return;
  const key = papel.trim().replace(/[^a-z0-9_]/gi, '_');
  cfg.blocos = cfg.blocos || {};
  cfg.blocos[key] = `bloco_${tc}_${tr}`;
  const url = _fedResolverTileset().url;
  if (url && typeof W._avtCarregarTileset === 'function') {
    const p = FED.modo === 'live'
      ? W._avtCarregarTileset(url, cfg)
      : W._avtCarregarTileset(url, cfg, { aplicar: false }).then((texs: any) => { FED.texs = texs || null; });
    p.then(() => {
      FED.brushKey = key; FED.brushXf = 0;
      _fedSetTool('tile'); _fedInfoPincel(); _fedRender();
      W.mostrarToast?.(`Papel "${key}" atribuído à célula (${tc},${tr})`, 'ok');
    }).catch(() => W.mostrarToast?.('Falha ao refatiar o tileset', 'erro'));
  }
}

// ── Portas (portado do editor antigo, sobre o estado novo) ───────────────────
function _fedCliqueDoor(x: number, y: number) {
  if (FED.pendingDoorAnchor) { _fedCompletarPortaInterna(x, y); return; }
  _fedAbrirConfigPorta(x, y);
}

function _fedAbrirConfigPorta(col: number, row: number) {
  FED._portaCfgCell = { col, row };
  let modal = document.getElementById('fed-porta-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'fed-porta-modal';
    (modal as any).style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9600;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(modal);
  }
  const fases = FED.fasesExtras || [];
  modal.innerHTML = `
    <div style="background:#0d1320;border:1px solid rgba(79,163,209,0.3);border-radius:10px;padding:18px;width:320px;max-width:92vw">
      <div style="font-family:var(--fonte-d);font-size:0.85rem;color:#c8d8e8;margin-bottom:12px">🚪 Posicionar porta (${col},${row})</div>
      <label style="display:block;font-size:0.72rem;color:#c8d8e8;margin-bottom:6px"><input type="radio" name="fed-porta-tipo" value="interna" checked> 🌀 Porta interna (teleporte)</label>
      <label style="display:block;font-size:0.72rem;color:#c8d8e8;margin-bottom:10px"><input type="radio" name="fed-porta-tipo" value="fase"> 🚪 Porta de fase</label>
      <div id="fed-porta-fase-cfg" style="display:none;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-bottom:10px">
        ${fases.length ? `
        <label style="display:block;font-size:0.64rem;color:#7a92aa;margin-bottom:4px">Leva à fase</label>
        <select id="fed-porta-fase-sel" style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;margin-bottom:8px">
          ${fases.map((f: any) => `<option value="${f.id}">${f.nome}</option>`).join('')}
        </select>
        <label style="display:block;font-size:0.64rem;color:#7a92aa;margin-bottom:4px">Tranca</label>
        <select id="fed-porta-lock" style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem">
          <option value="livre">🔓 Livre</option>
          <option value="chave">🔑 Chave</option>
          <option value="npc">⚔ Derrotar NPC/Boss</option>
        </select>` : `<div style="font-size:0.66rem;color:#f0cc6a">Nenhuma fase extra criada. Use "🚪 + Nova Fase" antes de ligar uma porta de fase.</div>`}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="fed-btn fed-btn-danger" onclick="document.getElementById('fed-porta-modal').style.display='none'">Cancelar</button>
        <button class="fed-btn fed-btn-ok" onclick="_fedConfirmarPorta()">Confirmar</button>
      </div>
    </div>`;
  (modal as any).style.display = 'flex';
  modal.querySelectorAll('input[name="fed-porta-tipo"]').forEach(r =>
    r.addEventListener('change', () => {
      const tipo = (document.querySelector('input[name="fed-porta-tipo"]:checked') as any)?.value;
      const cfg = document.getElementById('fed-porta-fase-cfg');
      if (cfg) (cfg as any).style.display = tipo === 'fase' ? 'block' : 'none';
    }));
}

function _fedConfirmarPorta() {
  const W: any = window as any;
  const T = W.AVT_T || { PISO: 1 };
  const cell = FED._portaCfgCell;
  if (!cell) return;
  const tipo = (document.querySelector('input[name="fed-porta-tipo"]:checked') as any)?.value || 'interna';
  (document.getElementById('fed-porta-modal') as any).style.display = 'none';
  _fedStrokeStart();
  if (tipo === 'interna') {
    FED.pendingDoorAnchor = { col: cell.col, row: cell.row };
    _fedSet(cell.col, cell.row, T.PISO);
    _fedStrokeEnd();
    _fedStatus('Porta interna: clique na célula de destino (teleporte). Esc cancela.');
    W.mostrarToast?.('Clique no destino da porta interna', 'ok');
  } else {
    const faseId = (document.getElementById('fed-porta-fase-sel') as any)?.value;
    if (!faseId) { _fedStrokeEnd(); W.mostrarToast?.('Crie uma fase antes', 'aviso'); return; }
    const lock = (document.getElementById('fed-porta-lock') as any)?.value || 'livre';
    const fase = FED.fasesExtras.find((f: any) => f.id === faseId);
    if (fase) {
      fase.porta = { col: cell.col, row: cell.row, lock_type: lock,
        chave_palavra: fase.porta?.chave_palavra || '', npc_boss_id: fase.porta?.npc_boss_id || '' };
      _fedSet(cell.col, cell.row, T.PISO);
      W.mostrarToast?.('Porta de fase posicionada', 'ok');
    }
    _fedStrokeEnd();
  }
  _fedRender();
}

function _fedCompletarPortaInterna(col: number, row: number) {
  const W: any = window as any;
  const T = W.AVT_T || { PISO: 1 };
  const a = FED.pendingDoorAnchor;
  FED.pendingDoorAnchor = null;
  if (!a) return;
  if (a.col === col && a.row === row) { W.mostrarToast?.('Destino deve ser outra célula', 'aviso'); return; }
  const maxNum = FED.portasInternas.reduce((m: number, p: any) => Math.max(m, p.numero || 0), 1);
  _fedStrokeStart();
  FED.portasInternas.push({ numero: maxNum + 1, nome: 'Porta ' + (maxNum + 1), a: { col: a.col, row: a.row }, b: { col, row } });
  _fedSet(col, row, T.PISO);
  _fedStrokeEnd();
  _fedStatus('Porta interna criada.');
  W.mostrarToast?.('Porta interna criada', 'ok');
  _fedRender();
}

// ── Render ───────────────────────────────────────────────────────────────────
function _fedRender() {
  const canvas = document.getElementById('fed-canvas') as HTMLCanvasElement;
  if (!canvas || !FED.aberto) return;
  const ctx = canvas.getContext('2d')!;
  const W: any = window as any;
  const T = W.AVT_T || { PAREDE: 0, PISO: 1, SAIDA: 2 };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(FED.zoom, 0, 0, FED.zoom, FED.panX, FED.panY);
  ctx.imageSmoothingEnabled = false;

  const texs = _fedTilesetTexturas();
  const view = { w: FED.w, h: FED.h, tiles: FED.tiles, _chestPositions: FED.chestPositions, tileset_config: _fedTilesetCfg() };

  for (let y = 0; y < FED.h; y++) {
    for (let x = 0; x < FED.w; x++) {
      const t = FED.tiles[y]?.[x];
      const px = x * FED_SZ, py = y * FED_SZ;
      let drawn = false;
      if (texs) {
        const key = typeof t === 'string' ? W._avtCellBase(t) : W._avtGetTileSemanticKey(x, y, view);
        const img = key ? texs[key] : null;
        if (img) { W._avtDrawTileXform(ctx, img, px, py, FED_SZ, W._avtCellXform(t)); drawn = true; }
      }
      if (!drawn) {
        const parede = W._avtChaveEhParede ? W._avtChaveEhParede(t) : (t === 0 || t == null);
        ctx.fillStyle = (t === T.SAIDA) ? '#1a3a1a' : (t === null || t === undefined) ? '#04070d' : parede ? '#0a0c14' : '#101520';
        ctx.fillRect(px, py, FED_SZ, FED_SZ);
      }
      ctx.strokeStyle = 'rgba(60,80,110,0.25)'; ctx.lineWidth = 1 / FED.zoom;
      ctx.strokeRect(px + 0.5, py + 0.5, FED_SZ - 1, FED_SZ - 1);
      if (t === T.SAIDA) {
        ctx.font = `${Math.round(FED_SZ * 0.7)}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🚪', px + FED_SZ / 2, py + FED_SZ / 2);
      }
    }
  }

  // Overlays: portas, portas de fase, spawns
  ctx.font = `${Math.round(FED_SZ * 0.75)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  FED.portasInternas.forEach((p: any) => [p.a, p.b].forEach((ep: any) => {
    if (!ep) return;
    ctx.fillText('🌀', ep.col * FED_SZ + FED_SZ / 2, ep.row * FED_SZ + FED_SZ / 2);
  }));
  FED.fasesExtras.forEach((f: any) => {
    if (!f.porta) return;
    ctx.fillText('🚪', f.porta.col * FED_SZ + FED_SZ / 2, f.porta.row * FED_SZ + FED_SZ / 2);
  });
  FED.spawns.forEach((s: any) => {
    ctx.fillText('📍', s.x * FED_SZ + FED_SZ / 2, s.y * FED_SZ + FED_SZ / 2);
  });
  if (FED.pendingDoorAnchor) {
    ctx.strokeStyle = '#a878ff'; ctx.lineWidth = 2 / FED.zoom;
    ctx.strokeRect(FED.pendingDoorAnchor.col * FED_SZ, FED.pendingDoorAnchor.row * FED_SZ, FED_SZ, FED_SZ);
  }
  if (FED._rectAnchor && FED._rectHover) {
    const x0 = Math.min(FED._rectAnchor.x, FED._rectHover.x) * FED_SZ;
    const y0 = Math.min(FED._rectAnchor.y, FED._rectHover.y) * FED_SZ;
    const x1 = (Math.max(FED._rectAnchor.x, FED._rectHover.x) + 1) * FED_SZ;
    const y1 = (Math.max(FED._rectAnchor.y, FED._rectHover.y) + 1) * FED_SZ;
    ctx.fillStyle = 'rgba(200,168,75,0.18)';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#c8a84b'; ctx.lineWidth = 2 / FED.zoom;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
}

// ── Rooms derivadas do piso (para drafts sem rooms) ──────────────────────────
// Componentes conexos de piso → bounding boxes. A primeira vira 'entrada' e a
// maior 'chefe' — corrige o export rooms:[] dos editores antigos, que quebrava
// posicionamento de boss/portas/saída downstream.
function _fedDerivarRooms() {
  const W: any = window as any;
  const passavel = (x: number, y: number) => {
    const t = FED.tiles[y]?.[x];
    if (t === null || t === undefined) return false;
    if (typeof t === 'number') return t === 1 || t === 2;
    return !(W._avtChaveEhParede ? W._avtChaveEhParede(t) : false);
  };
  const visto = new Set<string>();
  const rooms: any[] = [];
  for (let y = 0; y < FED.h; y++) {
    for (let x = 0; x < FED.w; x++) {
      if (!passavel(x, y) || visto.has(x + ',' + y)) continue;
      let minX = x, maxX = x, minY = y, maxY = y, n = 0;
      const fila = [[x, y]];
      visto.add(x + ',' + y);
      while (fila.length) {
        const [cx, cy] = fila.shift()!;
        n++;
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
          if (nx < 0 || ny < 0 || nx >= FED.w || ny >= FED.h || visto.has(k) || !passavel(nx, ny)) continue;
          visto.add(k); fila.push([nx, ny]);
        }
      }
      rooms.push({ id: 'sala_' + (rooms.length + 1), x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, tipo: 'normal', _n: n });
    }
  }
  if (rooms.length) {
    rooms[0].tipo = 'entrada';
    if (rooms.length > 1) {
      // Chefe = a maior sala que NÃO é a entrada
      const candidatas = rooms.slice(1);
      const maior = candidatas.reduce((a, b) => (b._n > a._n ? b : a), candidatas[0]);
      maior.tipo = 'chefe';
    }
    rooms.forEach(r => delete r._n);
  }
  return rooms;
}

// ── Salvar (live) / Exportar (draft) ─────────────────────────────────────────
async function _fedSalvarLive() {
  const W: any = window as any;
  const A: any = W.AVT_STATE;
  if (!FED.tiles || !A?.dungeon) return;
  // Guarda de permissão: o save antigo pulava _avtRpgAtivo/_avtPodeSalvarRegistro
  // e qualquer cliente podia sobrescrever o theme_json inteiro.
  if (typeof W._avtRpgAtivo === 'function' && !W._avtRpgAtivo()) return;
  if (typeof W._avtPodeSalvarRegistro === 'function' && !W._avtPodeSalvarRegistro()) {
    W.mostrarToast?.('Apenas o mestre/host pode salvar o mapa', 'aviso'); return;
  }

  // Aprendizado de estilo: diff baseline×editado (mesma sequência do editor antigo)
  try {
    const tj = A.rpg.theme_json = A.rpg.theme_json || {};
    const profile = tj.generation_style_profile || {};
    const rules = W._avtAprenderPlacements(FED.baseline, FED.tiles, FED.w, FED.h, profile.placement_rules || {});
    const dungeonStats = { tiles: FED.tiles, rooms: A.dungeon.rooms, _portasInternas: FED.portasInternas };
    tj.generation_style_profile = W._avtMesclarPerfilEstilo(profile, W._avtDerivarStats(dungeonStats), rules);
  } catch (e) { console.warn('[fase-editor] aprendizado de estilo falhou:', e); }

  A.dungeon.tiles = FED.tiles.map((r: any) => [...r]);
  A.dungeon.w = FED.w; A.dungeon.h = FED.h;
  A.dungeon._portasInternas = FED.portasInternas;
  A.dungeon._spawnJogadores = FED.spawns;

  const tj = A.rpg.theme_json;
  const faseId = A._faseAtualId || 'principal';
  W._avtGravarDungeonNoSlot(tj);
  if (FED.fasesExtras && tj.fases_extras) {
    tj.fases_extras.forEach((f: any) => {
      const ed = FED.fasesExtras.find((x: any) => x.id === f.id);
      if (ed) f.porta = ed.porta;
    });
  }
  if (tj.tileset_paints) delete tj.tileset_paints; // legado morto

  avtFaseEditorFechar();
  try {
    await W._avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(A.rpgId)}`, {
      method: 'PATCH', body: JSON.stringify({ theme_json: tj })
    });
    W.mostrarToast?.('Mapa salvo!', 'ok');
  } catch (e: any) {
    W.mostrarToast?.('Mapa atualizado localmente (erro ao persistir: ' + (e?.message || e) + ')', 'aviso');
  }
  A._dungeonRev = (A._dungeonRev || 0) + 1;
  if (typeof W._avtTileBakeInvalidate === 'function') W._avtTileBakeInvalidate();
  try {
    W._avtBroadcast?.('avt_dungeon_update', {
      faseId,
      dungeon: A.dungeon,
      fases_extras: tj.fases_extras || []
    });
  } catch (_) {}
}

function _fedExportarDraft() {
  const rooms = (FED.rooms && FED.rooms.length) ? FED.rooms : _fedDerivarRooms();
  const data = {
    tiles: FED.tiles.map((r: any) => [...r]),
    w: FED.w, h: FED.h,
    rooms,
    inimigos: [],
    _portasInternas: FED.portasInternas,
    spawn_jogadores: FED.spawns,
  };
  if (typeof FED.onExport === 'function') FED.onExport(data);
  avtFaseEditorFechar();
  (window as any).mostrarToast?.(`Mapa ${FED.w}×${FED.h} pronto (${rooms.length} sala(s))`, 'ok');
}

// ── Exports globais (UI usa onclick inline) ──────────────────────────────────
Object.assign(window as any, {
  avtFaseEditorAbrir, avtFaseEditorFechar,
  _fedSetTool, _fedUndo, _fedRedo, _fedResize, _fedDistribuir,
  _fedSalvarLive, _fedExportarDraft, _fedGirar, _fedFlip, _fedConfirmarPorta,
  _fedDerivarRooms, _fedSet, _fedFill, _fedRect, _fedStrokeStart, _fedStrokeEnd, FED,
});
