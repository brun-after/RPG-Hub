// maps/fase-tileset.js
// Tileset system for adventure mode: prompts, validation, autotile key resolution

// ── Prompt 1 — Geração de imagem do tileset ──────────────────────────────────
function faseTilesetImgPromptTemplate(opts) {
  const estilo   = opts.estilo   || 'pixel art fantasy dungeon';
  const tileSize = opts.tileSize || 16;
  const cols     = opts.cols     || 8;
  const rows     = opts.rows     || 8;
  const imgW     = cols * tileSize;
  const imgH     = rows * tileSize;

  return `Generate a tileset image for a top-down RPG dungeon in the style of: "${estilo}".

TECHNICAL REQUIREMENTS:
- Image size: exactly ${imgW}×${imgH} pixels
- Divided into a uniform grid of ${cols} columns × ${rows} rows
- Each cell is exactly ${tileSize}×${tileSize} pixels
- Zero margins, zero padding between cells — pixel-perfect grid boundaries
- Transparent or solid dark background consistent with the style

CELL LAYOUT (column × row, zero-indexed):
Row 0:
  bloco_0_0 = NW corner wall (floor opens to south and east)
  bloco_1_0 = NE corner wall (floor opens to south and west)
  bloco_2_0 = North wall face (floor below, wall above)
  bloco_3_0 = West wall face (floor to right, wall to left)
  bloco_4_0 = Floor tile — variant 1 (main floor)
  bloco_5_0 = Floor tile — variant 2 (slightly different texture)
  bloco_6_0 = Chest tile (treasure chest, closed)
  bloco_7_0 = [spare — can reuse another tile]

Row 1:
  bloco_0_1 = SW corner wall (floor opens to north and east)
  bloco_1_1 = SE corner wall (floor opens to north and west)
  bloco_2_1 = South wall face (floor above, wall below)
  bloco_3_1 = East wall face (floor to left, wall to right)
  bloco_4_1 = Floor tile — variant 3 (subtle crack or pattern)
  bloco_5_1 = Object/obstacle tile 1 (barrel, pillar, or rock)
  bloco_6_1 = Object/obstacle tile 2 (different obstacle)
  bloco_7_1 = [spare — can reuse another tile]

IMPORTANT RULES:
- All tiles must be clearly readable at ${tileSize}px size — use strong outlines and contrast
- Corner tiles must visually show a 90° wall turn
- Wall face tiles must have a distinct top/side surface suggesting depth
- Floor variants can be subtle — same base texture with slight noise or cracks
- Chest tile must be recognizable as a treasure container
- Identical-looking tiles do NOT need to be redrawn — spare cells can duplicate an existing cell's design
- NO text labels, NO UI chrome, NO borders outside the tile grid

OUTPUT: A single flat spritesheet image, no layering, no background outside the tile area.`;
}

// ── Prompt 2 — Coordenadas para IA de texto ──────────────────────────────────
function faseTilesetCoordPromptTemplate(opts) {
  const tileSize = opts.tileSize || 16;
  const cols     = opts.cols     || 8;
  const rows     = opts.rows     || 8;

  return `I have a tileset image divided into a ${cols}×${rows} grid. Each cell is ${tileSize}×${tileSize} pixels. Cells are named bloco_COL_ROW (zero-indexed, e.g. bloco_0_0 = top-left cell).

Analyze the image and return ONLY a JSON object (no markdown, no code blocks — start with {) mapping each semantic role to the bloco_COL_ROW coordinate that best matches it visually.

Return EXACTLY this structure:
{
  "version": 1,
  "tile_size": ${tileSize},
  "cols": ${cols},
  "rows": ${rows},
  "blocos": {
    "canto_NO": "bloco_X_Y",
    "canto_NE": "bloco_X_Y",
    "canto_SO": "bloco_X_Y",
    "canto_SE": "bloco_X_Y",
    "parede_N": "bloco_X_Y",
    "parede_S": "bloco_X_Y",
    "parede_O": "bloco_X_Y",
    "parede_L": "bloco_X_Y",
    "piso_1":   "bloco_X_Y",
    "piso_2":   "bloco_X_Y",
    "piso_3":   "bloco_X_Y",
    "objeto_1": "bloco_X_Y",
    "objeto_2": "bloco_X_Y",
    "bau":      "bloco_X_Y"
  },
  "regras": {
    "piso_variacao_chance": 0.15,
    "objeto_chance": 0.03
  }
}

SEMANTIC KEY REFERENCE:
- canto_NO/NE/SO/SE: wall corner tiles (NW, NE, SW, SE)
- parede_N/S/O/L: wall face tiles (north/south/west/east)
- piso_1/2/3: floor tile variants (if only 1-2 variants exist, reuse bloco_X_Y)
- objeto_1/2: obstacle/decoration tiles
- bau: chest/treasure tile

RULES:
- Replace every bloco_X_Y with actual column and row numbers from the image
- If a role has no good match, reuse the closest similar tile (e.g. reuse piso_1 for piso_3)
- tile_size must equal image_width / ${cols} = ${tileSize}
- Return ONLY the JSON, no other text`;
}

// ── Validação e normalização do JSON ─────────────────────────────────────────
function faseTilesetValidarJSON(raw) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }
  const defaults = {
    version:   1,
    tile_size: 16,
    cols:      8,
    rows:      8,
    blocos:    {
      canto_NO: 'bloco_0_0', canto_NE: 'bloco_1_0',
      canto_SO: 'bloco_0_1', canto_SE: 'bloco_1_1',
      parede_N: 'bloco_2_0', parede_S: 'bloco_2_1',
      parede_O: 'bloco_3_0', parede_L: 'bloco_3_1',
      piso_1:   'bloco_4_0', piso_2:   'bloco_4_1', piso_3: 'bloco_4_2',
      objeto_1: 'bloco_5_0', objeto_2: 'bloco_5_1',
      bau:      'bloco_6_0'
    },
    regras: { piso_variacao_chance: 0.15, objeto_chance: 0.03 }
  };
  const result = Object.assign({}, defaults, raw);
  result.blocos = Object.assign({}, defaults.blocos, raw.blocos || {});
  result.regras = Object.assign({}, defaults.regras, raw.regras || {});
  return result;
}

// ── Estado do módulo ──────────────────────────────────────────────────────────
let _tilesetImgFile = null;

// ── UI: copiar prompt de imagem ───────────────────────────────────────────────
function faseTilesetCopiarPromptImagem() {
  const estilo    = document.getElementById('avt-tileset-desc')?.value?.trim()
                    || AVT_STATE._criando?.nome || 'pixel art fantasy dungeon';
  const tileSize  = parseInt(document.getElementById('avt-tileset-tilesize')?.value || '16', 10);
  const cols      = parseInt(document.getElementById('avt-tileset-cols')?.value || '8', 10);
  const rows      = parseInt(document.getElementById('avt-tileset-rows')?.value || '8', 10);
  const prompt    = faseTilesetImgPromptTemplate({ estilo, tileSize, cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de imagem copiado!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: copiar prompt de coordenadas ─────────────────────────────────────────
function faseTilesetCopiarPromptCoordenadas() {
  const tileSize = parseInt(document.getElementById('avt-tileset-tilesize')?.value || '16', 10);
  const cols     = parseInt(document.getElementById('avt-tileset-cols')?.value || '8', 10);
  const rows     = parseInt(document.getElementById('avt-tileset-rows')?.value || '8', 10);
  const prompt   = faseTilesetCoordPromptTemplate({ tileSize, cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de coordenadas copiado — envie junto com a imagem', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: selecionar imagem ─────────────────────────────────────────────────────
function faseTilesetHandleImageSelect(input) {
  const file = input?.files?.[0];
  if (!file) return;
  _tilesetImgFile = file;
  AVT_STATE._criando._tilesetImgFile = file;
  const url = URL.createObjectURL(file);
  AVT_STATE._criando._tilesetImgUrl = url;
  const prev = document.getElementById('avt-tileset-img-preview');
  if (prev) { prev.src = url; prev.style.display = 'block'; }
  const nome = document.getElementById('avt-tileset-img-nome');
  if (nome) nome.textContent = file.name;
}

// ── UI: colar JSON de coordenadas ─────────────────────────────────────────────
function faseTilesetHandleJSONPaste(val) {
  const status = document.getElementById('avt-tileset-json-status');
  if (!val.trim()) { if (status) status.textContent = ''; return; }
  try {
    const cfg = faseTilesetValidarJSON(val);
    AVT_STATE._criando._tilesetConfig = cfg;
    if (status) status.innerHTML = '<span style="color:#27ae60">✓ JSON válido</span>';
  } catch(e) {
    AVT_STATE._criando._tilesetConfig = null;
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

// ── Carregar tileset e pré-cortar blocos ──────────────────────────────────────
async function _avtCarregarTileset(imgUrl, config) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = (typeof normalizeImgUrl === 'function') ? normalizeImgUrl(imgUrl) : imgUrl;
  });

  const ts = config.tile_size || 16;
  const textures = {};

  for (const [semanticKey, blocoRef] of Object.entries(config.blocos || {})) {
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);

    const canvas = document.createElement('canvas');
    canvas.width  = ts;
    canvas.height = ts;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, col * ts, row * ts, ts, ts, 0, 0, ts, ts);

    const tileImg = new Image();
    tileImg.src = canvas.toDataURL('image/png');
    await new Promise(res => { tileImg.onload = res; tileImg.onerror = res; });
    textures[semanticKey] = tileImg;
  }

  AVT_STATE._tilesetTextures = textures;
  AVT_STATE._tilesetLoaded   = true;
}

// ── Autotile: resolver chave semântica a partir de vizinhos ──────────────────
function _avtGetTileSemanticKey(x, y, dungeon) {
  const tileAt = (tx, ty) => dungeon.tiles[ty]?.[tx] === AVT_T.PISO;
  const here = dungeon.tiles[y]?.[x];

  if (here === AVT_T.PISO) {
    if (dungeon._chestPositions?.some(p => p.x === x && p.y === y)) return 'bau';
    const seed    = (x * 7 + y * 13) % 100;
    const config  = AVT_STATE._tilesetConfig;
    const varCh   = Math.round((config?.regras?.piso_variacao_chance ?? 0.15) * 100);
    const objCh   = Math.round((config?.regras?.objeto_chance ?? 0.03) * 100);
    if (seed < objCh)                                    return 'objeto_1';
    if (seed < varCh)                                    return 'piso_2';
    if (seed < varCh * 1.5 && config?.blocos?.piso_3)   return 'piso_3';
    return 'piso_1';
  }

  // Tile de parede — detectar pelo vizinho que é piso
  const N = tileAt(x, y - 1), S = tileAt(x, y + 1);
  const E = tileAt(x + 1, y), W = tileAt(x - 1, y);

  if (S && E && !N && !W) return 'canto_NO';
  if (S && W && !N && !E) return 'canto_NE';
  if (N && E && !S && !W) return 'canto_SO';
  if (N && W && !S && !E) return 'canto_SE';
  if (S && !N)            return 'parede_N';
  if (N && !S)            return 'parede_S';
  if (E && !W)            return 'parede_O';
  if (W && !E)            return 'parede_L';

  return null; // parede interna sem vizinho piso — fundo escuro
}

// ── PixiJS: carregar tileset para FASE_STATE (modo fase-renderer) ─────────────
async function _faseTilesetCarregar(rd) {
  const config  = rd.tileset_config;
  const imgUrl  = rd.tileset_img_url;
  if (!config || !imgUrl) return;

  const ts   = config.tile_size || 16;
  const url  = (typeof normalizeImgUrl === 'function') ? normalizeImgUrl(imgUrl) : imgUrl;
  const base = await PIXI.Assets.load(url).catch(() => null);
  if (!base) return;

  const textures = {};
  for (const [semanticKey, blocoRef] of Object.entries(config.blocos || {})) {
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);
    textures[semanticKey] = new PIXI.Texture(
      base.baseTexture || base,
      new PIXI.Rectangle(col * ts, row * ts, ts, ts)
    );
  }

  if (typeof FASE_STATE !== 'undefined') {
    FASE_STATE._tilesetTextures = textures;
    FASE_STATE._tilesetConfig   = config;
  }
}

// ── PixiJS: renderizar grade de tiles com tileset ────────────────────────────
function _faseRenderDungeonTiles(layer, rd) {
  const dungeon = rd.dungeon_data;
  if (!dungeon?.tiles) return;
  const textures = FASE_STATE?._tilesetTextures;
  if (!textures) return;
  const ts = rd.tileset_config?.tile_size || 16;

  for (let y = 0; y < dungeon.h; y++) {
    for (let x = 0; x < dungeon.w; x++) {
      const key = _avtGetTileSemanticKey(x, y, dungeon);
      const tex = key ? textures[key] : null;
      if (!tex) continue;
      const spr = new PIXI.Sprite(tex);
      spr.x = x * ts;
      spr.y = y * ts;
      spr.width  = ts;
      spr.height = ts;
      layer.addChild(spr);
    }
  }
}
