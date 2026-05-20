// maps/fase-tileset.js
// Tileset system for adventure mode: prompts, validation, string-grid rendering

// ── Prompt 1 — Geração de imagem do tileset ──────────────────────────────────
function faseTilesetImgPromptTemplate(opts) {
  const estilo = opts.estilo || 'pixel art fantasy dungeon';
  const cols   = opts.cols   || 4;
  const rows   = opts.rows   || 4;

  const row3 = rows >= 4 ? `
Row 3:
  bloco_0_3 = Door tile (dungeon door, top-down view — dark wood frame with metal hinges, closed; fits seamlessly with stone floor)
  bloco_1_3 = Floor variant 3 (alternate stone, dirt, or runic floor)
  bloco_2_3 = Inner wall / alcove (inner wall face or decorative alcove)
  bloco_3_3 = Trap tile (pressure plate, magical rune, or spike trap on floor)
` : '';

  const extraRows = rows > 4 ? `\nRow 4 and beyond: fill with thematic variations or reuse existing designs.` : '';

  return `Generate a tileset image for a top-down RPG dungeon in the style of: "${estilo}".

TECHNICAL REQUIREMENTS:
- The image is divided into a uniform grid of exactly ${cols} columns × ${rows} rows
- Every row has the same height; every column has the same width — perfectly equal cells
- Zero margins, zero padding between cells — grid lines must be exact fractions of the image size
- The image can be any square resolution (512×512, 1024×1024, etc.) — what matters is the grid proportions
- Top-down perspective (camera looking straight down)

REQUIRED CELLS (column × row, zero-indexed — fill every cell):
Row 0:
  bloco_0_0 = NW corner wall  (stone wall turning from north face to west face)
  bloco_1_0 = North wall face (stone wall top edge — floor is below this tile)
  bloco_2_0 = NE corner wall  (stone wall turning from north face to east face)
  bloco_3_0 = Floor tile variant 1 (main stone floor, cracked or mossy)

Row 1:
  bloco_0_1 = West wall face  (stone wall left edge — floor is to the right)
  bloco_1_1 = Floor tile variant 2 (floor with subtle crack or different stone)
  bloco_2_1 = East wall face  (stone wall right edge — floor is to the left)
  bloco_3_1 = Obstacle/object (barrel, pillar, crate, or boulder on floor)

Row 2:
  bloco_0_2 = SW corner wall  (stone wall turning from south face to west face)
  bloco_1_2 = South wall face (stone wall bottom edge — floor is above this tile)
  bloco_2_2 = SE corner wall  (stone wall turning from south face to east face)
  bloco_3_2 = Chest tile      (closed wooden treasure chest on floor, top-down)
${row3}${extraRows}

VISUAL RULES:
- All wall tiles must have strong outlines and depth (top-down stone wall look)
- Corner tiles must clearly show the 90° junction between two wall faces
- Floor tiles should look walkable: flat stone, cobblestone, or similar
- Chest must be recognizable as a closed treasure container
- Obstacle must look like something that blocks passage
- Door tile must be recognizable as a closed door (wood + metal hardware, top-down)
- Identical tiles do NOT need to be redrawn — reuse bloco_X_Y reference in the second prompt
- NO text labels, NO UI chrome, NO borders outside the tile grid

OUTPUT: One flat image, no layers, the full grid as described.`;
}

// ── Prompt 2 — Coordenadas + layout completo da dungeon ──────────────────────
function faseTilesetLayoutPromptTemplate(opts) {
  const cols      = opts.cols      || 4;
  const rows      = opts.rows      || 4;
  const descricao = opts.descricao || 'a dungeon with several rooms connected by corridors';
  const largura   = opts.largura   || 24;
  const altura    = opts.altura    || 18;

  const portaFaseBloco = rows >= 4 ? `\n    "porta_fase": "bloco_0_3",` : '';

  return `You have a tileset image divided into a ${cols}×${rows} grid. Cells are named bloco_COL_ROW (zero-indexed, col 0 = leftmost, row 0 = topmost). The tileset was generated for: "${descricao}".

Your task is TWO things in ONE JSON response:

1. MAP each cell to its semantic role (by looking at the image)
2. DESIGN the complete dungeon layout as a tile grid using those roles

Return ONLY a JSON object (no markdown, start with {):

{
  "version": 2,
  "cols": ${cols},
  "rows": ${rows},

  "blocos": {
    "canto_NO": "bloco_0_0",
    "parede_N":  "bloco_1_0",
    "canto_NE": "bloco_2_0",
    "piso_1":   "bloco_3_0",
    "parede_O":  "bloco_0_1",
    "piso_2":   "bloco_1_1",
    "parede_L":  "bloco_2_1",
    "objeto_1": "bloco_3_1",
    "canto_SO": "bloco_0_2",
    "parede_S":  "bloco_1_2",
    "canto_SE": "bloco_2_2",
    "bau":      "bloco_3_2"${portaFaseBloco}
  },

  "mapa": {
    "largura": ${largura},
    "altura":  ${altura},
    "salas": [
      {"id": "entrada", "x": 2, "y": 2, "w": 6, "h": 5, "tipo": "entrada"},
      {"id": "sala_2",  "x": 14, "y": 3, "w": 5, "h": 4, "tipo": "normal"},
      {"id": "chefe",   "x": 10, "y": 12, "w": 7, "h": 5, "tipo": "chefe"}
    ],
    "spawn_jogadores": [{"x": 4, "y": 4}],
    "inimigos": [
      {"x": 16, "y": 5, "hp": 30},
      {"x": 13, "y": 14, "hp": 60}
    ],
    "tiles": [
      THE FULL ${largura}×${altura} GRID HERE — see rules below
    ]
  }
}

══ TILESET MAPPING RULES ══
- Look at each cell in the tileset image
- Replace bloco_X_Y in "blocos" with the grid coordinate of the cell that best matches that semantic role
- Cell bloco_C_R occupies the fraction x=[C/${cols}, (C+1)/${cols}] × y=[R/${rows}, (R+1)/${rows}] of the image
- If a role has no good visual match, reuse the closest tile (e.g. reuse "piso_1" for "piso_2")
- Do NOT include "tile_size" — the system calculates it automatically from the image dimensions and cols/rows

══ DUNGEON DESIGN RULES ══
The "tiles" array must be exactly ${altura} rows × ${largura} columns.
Each cell contains a semantic key string or null:

Allowed values:
  null        — void/empty (dark, outside dungeon)
  "canto_NO"  — NW corner wall
  "canto_NE"  — NE corner wall
  "canto_SO"  — SW corner wall
  "canto_SE"  — SE corner wall
  "parede_N"  — north wall face (top edge of a room)
  "parede_S"  — south wall face (bottom edge of a room)
  "parede_O"  — west wall face (left edge of a room)
  "parede_L"  — east wall face (right edge of a room)
  "piso_1"    — floor tile variant 1
  "piso_2"    — floor tile variant 2 (mix with piso_1 for variety)
  "objeto_1"  — obstacle/object (impassable, placed on floor areas)
  "bau"       — treasure chest (placed inside rooms, near walls)

DESIGN GUIDELINES:
- Create as many rooms as needed to make the dungeon feel complete and interesting — you decide the count and layout
- Fill the ${largura}×${altura} grid naturally; do not leave large empty voids
- Every room boundary: corner tiles at 4 corners, wall faces along edges, floor inside
- Corridors: wall faces on the sides, floor in the middle (1-tile-wide corridors use just floor between wall tiles)
- Scatter "piso_2" randomly inside rooms (10–20% of floor tiles) for visual variety
- Place 1–3 "bau" tiles near room walls (not blocking corridors)
- Place 1–4 "objeto_1" tiles inside rooms as obstacles
- One room should be the entrance (player spawn), one should be the boss/final room
- Ensure ALL rooms are reachable — corridors must connect every room
- The adventure theme is: "${descricao}" — adapt room count, size, density, and layout style to match

IMPORTANT: Return ONLY the JSON. The "tiles" array must have EXACTLY ${altura} sub-arrays, each with EXACTLY ${largura} values.`;
}

// ── Prompt unificado para IA externa (personagens + dungeon + tileset) ────────
function _avtPromptCampanhaExterna(opts) {
  const cols   = opts.cols   || 4;
  const rows   = opts.rows   || 4;

  const portaFaseBloco = rows >= 4 ? `\n        "porta_fase": "bloco_0_3",` : '';

  return `You are a creative RPG game master. The players will describe the characters they want directly in this conversation.

Your job is to generate a complete RPG campaign JSON based on their requests.

══ OUTPUT FORMAT ══
Return ONLY a single JSON object (no markdown, start with {).
The root field "nome" is REQUIRED and must be a short adventure title in Portuguese with 3 to 6 words:

{
  "nome": "Adventure Name",
  "characters": [
    {
      "nome": "Character Name",
      "hp_max": 60,
      "atributos": {"forca": 12, "destreza": 10, "constituicao": 12, "inteligencia": 8},
      "habilidades": [
        {"nome": "Heavy Strike", "formula_dano": "1d8+2", "tipo_dano": "fisico", "cooldown_turnos": 1, "alcance_celulas": 1, "descricao": "Powerful weapon blow"},
        {"nome": "Shield of Faith", "formula_dano": "0", "tipo_dano": "cura", "cooldown_turnos": 3, "alcance_celulas": 0, "descricao": "Heals 1d6 HP"}
      ],
      "aparencia_tipo": "npc_generico",
      "classe_aventura": "guerreiro"
    }
  ],
  "tileset_config": {
    "version": 2,
    "cols": ${cols},
    "rows": ${rows},
    "blocos": {
      "canto_NO": "bloco_0_0",
      "parede_N":  "bloco_1_0",
      "canto_NE": "bloco_2_0",
      "piso_1":   "bloco_3_0",
      "parede_O":  "bloco_0_1",
      "piso_2":   "bloco_1_1",
      "parede_L":  "bloco_2_1",
      "objeto_1": "bloco_3_1",
      "canto_SO": "bloco_0_2",
      "parede_S":  "bloco_1_2",
      "canto_SE": "bloco_2_2",
      "bau":      "bloco_3_2"${portaFaseBloco}
    },
    "mapa": {
      "largura": <WIDTH>,
      "altura":  <HEIGHT>,
      "salas": [...],
      "spawn_jogadores": [{"x": 4, "y": 4}],
      "inimigos": [
        {"x": 10, "y": 5, "hp": 30, "nome": "Enemy Name"},
        {"x": 20, "y": 12, "hp": 80, "nome": "Boss Name", "isBoss": true}
      ],
      "tiles": [ /* full 2D grid */ ]
    }
  }
}

══ CHARACTER RULES ══
- Generate one character per player request
- Balance HP between 40–120 depending on class and player description
- Each character must have 2–4 abilities with balanced damage formulas
- "aparencia_tipo" options: npc_generico, guerreiro, mago, goblin, esqueleto, orc, troll, vampiro, cultista, boss
- "classe_aventura" options: guerreiro, mago

══ DUNGEON RULES ══
- The tileset grid is ${cols}×${rows} — use bloco_COL_ROW references in "blocos" for each semantic role
- For "mapa": choose any width and height that fits the story — fill the grid naturally with interconnected rooms
- No fixed room count limit — design as many rooms as the story needs
- The dungeon should match the theme the players describe
- The "tiles" array must be EXACTLY <HEIGHT> sub-arrays, each with EXACTLY <WIDTH> values (you choose <WIDTH> and <HEIGHT>)
- Place enemies ("inimigos") with appropriate HP inside rooms
- Ensure all rooms are reachable via corridors

══ HOW TO USE THIS PROMPT ══
1. The players will now describe the characters they want and the dungeon theme
2. Listen to their requests in this conversation
3. When ready, generate the complete JSON as specified above
4. Players will copy the JSON and paste it into the RPG system`;
}

// ── Validação do JSON da campanha externa (personagens + tileset) ─────────────
function _avtValidarJSONCampanhaExterna(raw) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }

  if (!raw.nome || typeof raw.nome !== 'string' || !raw.nome.trim())
    throw new Error('Campo "nome" ausente ou vazio');
  if (!Array.isArray(raw.characters) || !raw.characters.length)
    throw new Error('Campo "characters" ausente ou vazio');
  if (!raw.tileset_config || typeof raw.tileset_config !== 'object')
    throw new Error('Campo "tileset_config" ausente');
  if (!raw.tileset_config.blocos)
    throw new Error('Campo "tileset_config.blocos" ausente');

  const cfg = raw.tileset_config;
  const mapa = cfg.mapa;
  if (!mapa || !Array.isArray(mapa.tiles) || !mapa.tiles.length)
    throw new Error('Campo "tileset_config.mapa.tiles" ausente ou vazio');

  const h = mapa.tiles.length;
  const w = mapa.tiles[0]?.length || 0;
  if (!h || !w) throw new Error('mapa.tiles vazio');

  return {
    nome:           raw.nome.trim(),
    characters:     raw.characters,
    tileset_config: {
      version: cfg.version || 2,
      cols:    cfg.cols    || 4,
      rows:    cfg.rows    || 4,
      blocos:  cfg.blocos,
      mapa: {
        largura:         mapa.largura || w,
        altura:          mapa.altura  || h,
        tiles:           mapa.tiles,
        salas:           mapa.salas           || [],
        spawn_jogadores: mapa.spawn_jogadores || [],
        inimigos:        mapa.inimigos        || []
      }
    }
  };
}

// ── UI: copiar prompt de campanha externa ─────────────────────────────────────
function _avtCopiarPromptCampanhaExterna() {
  const cols = parseInt(document.getElementById('avt-ext-cols')?.value || '4', 10);
  const rows = parseInt(document.getElementById('avt-ext-rows')?.value || '4', 10);
  const prompt = _avtPromptCampanhaExterna({ cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt técnico copiado — abra a IA externa e cole!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: copiar prompt de imagem do tileset (modo ia_externa) ──────────────────
function _avtCopiarPromptImagemExterna() {
  const cols = parseInt(document.getElementById('avt-ext-cols')?.value || '4', 10);
  const rows = parseInt(document.getElementById('avt-ext-rows')?.value || '4', 10);
  const prompt = faseTilesetImgPromptTemplate({ estilo: 'pixel art fantasy dungeon', cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de imagem copiado — use no Midjourney, DALL-E ou similar!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: selecionar imagem (modo ia_externa — usa IDs distintos) ───────────────
function _avtExtHandleImageSelect(input) {
  const file = input?.files?.[0];
  if (!file) return;
  AVT_STATE._criando._tilesetImgFile = file;
  const url = URL.createObjectURL(file);
  AVT_STATE._criando._tilesetImgUrl = url;
  const prev = document.getElementById('avt-ext-img-preview');
  if (prev) { prev.src = url; prev.style.display = 'block'; }
  const nome = document.getElementById('avt-ext-img-nome');
  if (nome) nome.textContent = file.name;
}

// ── UI: colar JSON da campanha externa ────────────────────────────────────────
function _avtExtHandleJSONPaste(val) {
  const status = document.getElementById('avt-ext-json-status');
  if (!val.trim()) { if (status) status.textContent = ''; return; }
  try {
    const data = _avtValidarJSONCampanhaExterna(val);
    AVT_STATE._criando._extCampanhaJSON = data;
    if (data.nome) AVT_STATE._criando.nome = data.nome;
    const w = data.tileset_config.mapa.largura;
    const h = data.tileset_config.mapa.altura;
    const nc = data.characters.length;
    const ns = data.tileset_config.mapa.salas?.length || 0;
    const nomeCampanha = data.nome ? ` — <b>${data.nome}</b>` : '';
    if (status) status.innerHTML =
      `<span style="color:#27ae60">✓ ${nc} personagem(ns) + mapa ${w}×${h} — ${ns} sala(s)${nomeCampanha}</span>`;
  } catch(e) {
    AVT_STATE._criando._extCampanhaJSON = null;
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

// ── Validação do JSON combinado ───────────────────────────────────────────────
function faseTilesetValidarJSON(raw) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }

  if (!raw.blocos || typeof raw.blocos !== 'object') throw new Error('Campo "blocos" ausente');

  const result = {
    version: raw.version || 2,
    cols:    raw.cols    || 4,
    rows:    raw.rows    || 4,
    blocos:  raw.blocos,
    mapa:    raw.mapa    || null
  };

  if (result.mapa) {
    if (!Array.isArray(result.mapa.tiles)) throw new Error('Campo "mapa.tiles" ausente ou inválido');
    const h = result.mapa.tiles.length;
    const w = result.mapa.tiles[0]?.length || 0;
    if (!h || !w) throw new Error('mapa.tiles vazio');
    result.mapa.largura = result.mapa.largura || w;
    result.mapa.altura  = result.mapa.altura  || h;
    result.mapa.salas   = result.mapa.salas   || [];
    result.mapa.spawn_jogadores = result.mapa.spawn_jogadores || [];
    result.mapa.inimigos        = result.mapa.inimigos        || [];
  }

  return result;
}

// Converte mapa do tileset em dungeon_data compatível com o engine
function faseTilesetToDungeonData(config) {
  const m = config.mapa;
  if (!m?.tiles) return null;
  const h = m.tiles.length;
  const w = m.tiles[0]?.length || 0;
  return {
    tiles:          m.tiles,      // string-key grid
    w, h,
    rooms:          m.salas       || [],
    _inimigosJson:  m.inimigos    || [],
    _spawnJogadores: m.spawn_jogadores || [],
    tileset_config:  config,      // embedded
    tileset_img_url: null         // preenchido após upload
  };
}

// ── Estado do módulo ──────────────────────────────────────────────────────────
let _tilesetImgFile = null;

// ── UI: copiar prompt de imagem ───────────────────────────────────────────────
function faseTilesetCopiarPromptImagem() {
  const estilo = document.getElementById('avt-tileset-desc')?.value?.trim()
                 || AVT_STATE._criando?.nome || 'pixel art fantasy dungeon';
  const cols   = parseInt(document.getElementById('avt-tileset-cols')?.value || '4', 10);
  const rows   = parseInt(document.getElementById('avt-tileset-rows')?.value || '4', 10);
  const prompt = faseTilesetImgPromptTemplate({ estilo, cols, rows });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de imagem copiado!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

// ── UI: copiar prompt de layout ───────────────────────────────────────────────
function faseTilesetCopiarPromptLayout() {
  const descricao = document.getElementById('avt-tileset-desc')?.value?.trim()
                    || AVT_STATE._criando?.nome || 'a fantasy dungeon';
  const cols      = parseInt(document.getElementById('avt-tileset-cols')?.value || '4', 10);
  const rows      = parseInt(document.getElementById('avt-tileset-rows')?.value || '4', 10);
  const largura   = parseInt(document.getElementById('avt-tileset-largura')?.value || '24', 10);
  const altura    = parseInt(document.getElementById('avt-tileset-altura')?.value || '18', 10);
  const prompt    = faseTilesetLayoutPromptTemplate({ descricao, cols, rows, largura, altura });
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt de layout copiado — envie junto com a imagem', 'ok'))
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

// ── UI: colar JSON de layout ──────────────────────────────────────────────────
function faseTilesetHandleJSONPaste(val) {
  const status = document.getElementById('avt-tileset-json-status');
  if (!val.trim()) { if (status) status.textContent = ''; return; }
  try {
    const cfg = faseTilesetValidarJSON(val);
    AVT_STATE._criando._tilesetConfig = cfg;
    const w = cfg.mapa?.largura || '?', h = cfg.mapa?.altura || '?';
    const hasMapa = !!cfg.mapa?.tiles;
    if (status) status.innerHTML = hasMapa
      ? `<span style="color:#27ae60">✓ Tileset + mapa ${w}×${h} válidos — ${cfg.mapa.salas?.length||0} salas</span>`
      : `<span style="color:#e67e22">⚠ Tileset válido mas sem "mapa.tiles" — a IA não incluiu o layout</span>`;
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

  const cols = config.cols || 4;
  const rows = config.rows || 4;
  // Fractional cell dimensions — resolution-agnostic regardless of AI output size
  const sw = img.naturalWidth  / cols;
  const sh = img.naturalHeight / rows;
  const textures = {};

  for (const [semanticKey, blocoRef] of Object.entries(config.blocos || {})) {
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw); canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, col * sw, row * sh, sw, sh, 0, 0, canvas.width, canvas.height);

    const tileImg = new Image();
    tileImg.src = canvas.toDataURL('image/png');
    await new Promise(res => { tileImg.onload = res; tileImg.onerror = res; });
    textures[semanticKey] = tileImg;
  }

  AVT_STATE._tilesetTextures = textures;
  AVT_STATE._tilesetLoaded   = true;
}

// ── Verificar se tile é passável (para colisão) ───────────────────────────────
function _avtTilePassavel(x, y, dungeon) {
  const t = dungeon.tiles[y]?.[x];
  if (t === null || t === undefined) return false;
  if (typeof t === 'number') return t === AVT_T.PISO || t === AVT_T.SAIDA;
  // String-key grid: passável se for piso ou baú
  return t.startsWith('piso') || t === 'bau';
}

// ── Autotile para grids binários legados (0/1) ────────────────────────────────
function _avtGetTileSemanticKey(x, y, dungeon) {
  const tileAt = (tx, ty) => dungeon.tiles[ty]?.[tx] === AVT_T.PISO;
  const here = dungeon.tiles[y]?.[x];

  if (here === AVT_T.PISO) {
    if (dungeon._chestPositions?.some(p => p.x === x && p.y === y)) return 'bau';
    const seed   = (x * 7 + y * 13) % 100;
    const config = AVT_STATE._tilesetConfig;
    const varCh  = Math.round((config?.regras?.piso_variacao_chance ?? 0.15) * 100);
    const objCh  = Math.round((config?.regras?.objeto_chance ?? 0.03) * 100);
    if (seed < objCh)                                   return 'objeto_1';
    if (seed < varCh)                                   return 'piso_2';
    if (seed < varCh * 1.5 && config?.blocos?.piso_3)  return 'piso_3';
    return 'piso_1';
  }

  const N = tileAt(x, y-1), S = tileAt(x, y+1);
  const E = tileAt(x+1, y), W = tileAt(x-1, y);

  if (S && E && !N && !W) return 'canto_NO';
  if (S && W && !N && !E) return 'canto_NE';
  if (N && E && !S && !W) return 'canto_SO';
  if (N && W && !S && !E) return 'canto_SE';
  if (S && !N)            return 'parede_N';
  if (N && !S)            return 'parede_S';
  if (E && !W)            return 'parede_O';
  if (W && !E)            return 'parede_L';
  return null;
}

// ── PixiJS: carregar tileset (modo fase-renderer) ─────────────────────────────
async function _faseTilesetCarregar(rd) {
  const config = rd.tileset_config;
  const imgUrl = rd.tileset_img_url;
  if (!config || !imgUrl) return;

  const url = (typeof normalizeImgUrl === 'function') ? normalizeImgUrl(imgUrl) : imgUrl;
  const base = await PIXI.Assets.load(url).catch(() => null);
  if (!base) return;

  const bt   = base.baseTexture || base;
  const cols = config.cols || 4;
  const rows = config.rows || 4;
  // Fractional cell dimensions — resolution-agnostic
  const sw = bt.width  / cols;
  const sh = bt.height / rows;

  const textures = {};
  for (const [semanticKey, blocoRef] of Object.entries(config.blocos || {})) {
    const match = String(blocoRef).match(/^bloco_(\d+)_(\d+)$/);
    if (!match) continue;
    const col = parseInt(match[1]), row = parseInt(match[2]);
    textures[semanticKey] = new PIXI.Texture(bt, new PIXI.Rectangle(col * sw, row * sh, sw, sh));
  }

  if (typeof FASE_STATE !== 'undefined') {
    FASE_STATE._tilesetTextures = textures;
    FASE_STATE._tilesetConfig   = config;
  }
}

// ── PixiJS: renderizar grade de tiles com tileset ────────────────────────────
function _faseRenderDungeonTiles(layer, rd) {
  const dungeon = rd.dungeon_data || rd.tileset_config?.mapa;
  if (!dungeon?.tiles) return;
  const textures = FASE_STATE?._tilesetTextures;
  if (!textures) return;
  // Display tile size in world units — independent of source image resolution
  const displayTs = (typeof FASE_TILE_SZ !== 'undefined') ? FASE_TILE_SZ : 64;
  const h = dungeon.tiles.length;

  for (let y = 0; y < h; y++) {
    const row = dungeon.tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      const key  = typeof cell === 'string' ? cell : _avtGetTileSemanticKey(x, y, dungeon);
      const tex  = key ? textures[key] : null;
      if (!tex) continue;
      const spr = new PIXI.Sprite(tex);
      spr.x = x * displayTs; spr.y = y * displayTs;
      spr.width = displayTs; spr.height = displayTs;
      layer.addChild(spr);
    }
  }
}
