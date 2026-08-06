// maps/fase-generator.js
// Fase Map Generator: image upload + AI coordinate extraction (Claude Vision or external AI)
// Mirrors the pattern from characters/anim-generator.js

// ── Chave Claude API (compartilhada com anim-generator) ────────────────────
function faseGenGetApiKey() {
  return localStorage.getItem('animgen_claude_key') || '';
}
function faseGenSetApiKey(val) {
  localStorage.setItem('animgen_claude_key', val.trim());
}

// ── Prompt para IA de geração de imagem ───────────────────────────────────
const FASE_IMG_PROMPT_TEMPLATE = (opts = {}) => {
  const estilo   = (opts as any).estilo   || 'pixel art fantasy dungeon';
  const tilt     = (opts as any).tilt     || 72;
  const elementos = ((opts as any).elementos || ['parede', 'porta', 'baú', 'tocha']).join(', ');
  return `Generate a top-down RPG map image (slightly tilted perspective, vertical scale ~${tilt}%) in the style of "${estilo}".

TECHNICAL REQUIREMENTS:
- Perspective: camera looking down at ~${100 - tilt}° angle (classic 16-bit RPG style, like Zelda: A Link to the Past)
- The map background must fill the entire image canvas with no white margins
- Use high contrast between floor, walls and interactive objects
- Walls must have clear, readable outlines
- Interactive elements must be visually distinct and centered on their tile

ELEMENTS TO INCLUDE (position them clearly and distinctly):
${elementos}

GRID:
- Mentally divide the image into a 10×8 normalized grid (each cell = 10% of width / 12.5% of height)
- Each interactive element must occupy the CENTER of its grid cell
- Walls run along EDGES of grid cells (not centers)

OUTPUT: A single cohesive map image. No UI, no text labels, no borders outside the map.`;
};

// ── Prompt de coordenadas para Claude Vision ───────────────────────────────
const FASE_COORD_PROMPT = `Analyze this top-down RPG map image and return ONLY a JSON object (no markdown, no code blocks — start with {) describing all interactive elements with normalized coordinates (0.0–1.0, where 0,0 is top-left and 1,1 is bottom-right).

Return this exact structure:
{
  "perspective": { "tilt_y": 0.72, "shadow_offset": 4 },
  "paredes": [
    { "id": "w1", "x1": 0.0, "y1": 0.3, "x2": 0.5, "y2": 0.3, "tipo": "solido" }
  ],
  "portas": [
    { "id": "p1", "x": 0.5, "y": 0.1, "nome": "Porta Norte", "aberta": false, "trancada": false }
  ],
  "baus": [
    { "id": "b1", "x": 0.7, "y": 0.6, "trancado": false }
  ],
  "itens_no_chao": [],
  "spawn_jogadores": [
    { "id": "s1", "x": 0.5, "y": 0.9, "tipo": "entrada" }
  ],
  "entidades": []
}

RULES:
- All coordinates are normalized 0.0–1.0 (x: left→right, y: top→bottom)
- For walls: x1,y1 = start point; x2,y2 = end point of the wall segment
- For doors, chests, items, spawns: x,y = center of the element
- tilt_y: estimated vertical compression of the perspective (0.65–0.80 for slight tilt, 1.0 for flat top-down)
- Only include elements clearly visible in the image
- Doors connecting to other maps: set mapa_destino to null (to be filled by GM)
- Chest loot: leave as empty array []
- Entity stats: leave as empty object {}
- Return ONLY the JSON, absolutely no other text`;

// ── Prompt de coordenadas para IA Externa ─────────────────────────────────
function faseGenPromptExterno() {
  return FASE_COORD_PROMPT + `

SCHEMA REFERENCE — return exactly this structure:
{
  "perspective": { "tilt_y": number (0.65-1.0), "shadow_offset": number },
  "paredes": [ { "id": string, "x1": 0-1, "y1": 0-1, "x2": 0-1, "y2": 0-1, "tipo": "solido"|"transparente" } ],
  "portas": [ { "id": string, "x": 0-1, "y": 0-1, "nome": string, "aberta": boolean, "trancada": boolean, "chave_palavra": string|null, "mapa_destino": null, "destino_x": 0-1, "destino_y": 0-1 } ],
  "baus": [ { "id": string, "x": 0-1, "y": 0-1, "trancado": boolean, "chave_palavra": string|null, "loot": [], "aberto": false } ],
  "itens_no_chao": [ { "id": string, "x": 0-1, "y": 0-1, "item_id": string|null, "quantidade": number } ],
  "spawn_jogadores": [ { "id": string, "x": 0-1, "y": 0-1, "tipo": "entrada"|"saida" } ],
  "entidades": [ { "id": string, "tipo": "criatura"|"npc"|"boss", "nome": string, "x": 0-1, "y": 0-1, "estado": "dormindo", "patrol_path": [], "aggro_radius": 0.08, "sleep_radius": 0.04, "combate_tipo": "tatico", "combate_timer_s": 10, "stats": {}, "drops": [], "ia_perfil": null } ]
}`;
}

// ── Chamada à API Claude Vision ────────────────────────────────────────────
async function _faseGenApiCall(imageBase64, mimeType) {
  const key = faseGenGetApiKey();
  if (!key) throw new Error('Chave Claude API não configurada');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: FASE_COORD_PROMPT }
        ]
      }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta da API não contém JSON válido');
  return JSON.parse(match[0]);
}

// ── Converter arquivo para base64 ──────────────────────────────────────────
function _faseFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = (e.target as any).result.split(',')[1];
      resolve({ b64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Gerar coordenadas via Claude Vision ────────────────────────────────────
async function faseGenFromImage(file) {
  const { b64, mimeType }: any = await _faseFileToBase64(file);
  return await _faseGenApiCall(b64, mimeType);
}

// ── Validar e normalizar JSON importado ────────────────────────────────────
function faseGenValidarJSON(raw) {
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido: não encontrou objeto { }');
    raw = JSON.parse(match[0]);
  }
  const defaults = {
    perspective:     { tilt_y: 0.72, shadow_offset: 4 },
    paredes:         [],
    portas:          [],
    baus:            [],
    itens_no_chao:   [],
    spawn_jogadores: [],
    entidades:       []
  };
  return Object.assign({}, defaults, raw);
}

// ════════════════════════════════════════════════════════════════════════════
// UI — Modal de Fase
// ════════════════════════════════════════════════════════════════════════════

// Estado temporário do modal
let _faseGenModalData = null;   // render_data em edição
let _faseGenImgFile   = null;   // arquivo de imagem selecionado
let _faseGenMapId     = null;   // map_id em edição (null = novo mapa via fase-renderer)

// ── Abrir modal de configuração de fase ────────────────────────────────────
function abrirModalFaseConfig(mapId) {
  _faseGenMapId = mapId || null;
  const entry = mapId ? (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === mapId) : null;
  const mapa  = entry?.mapa || {};
  const rd    = mapa.render_data || {};
  _faseGenModalData = faseGenValidarJSON(rd);

  const el = document.getElementById('modal-fase-config-overlay');
  if (!el) return;
  el.style.display = 'flex';

  // Preencher chave API salva
  const apiKeyEl = document.getElementById('fase-api-key');
  if (apiKeyEl) apiKeyEl.value = faseGenGetApiKey();

  // Atualizar preview de imagem
  _faseGenAtualizarPreview(mapa.img_url || '');
  // Atualizar título
  const titulo = document.getElementById('modal-fase-titulo');
  if (titulo) titulo.textContent = mapId ? `Fase: ${mapa.nome}` : 'Novo Mapa de Fase';
  // Atualizar tilt slider
  const tiltSlider = document.getElementById('fase-tilt-slider');
  if (tiltSlider) {
    tiltSlider.value = Math.round((_faseGenModalData.perspective.tilt_y || 0.72) * 100);
    document.getElementById('fase-tilt-val').textContent = tiltSlider.value + '%';
  }
  // Renderizar editor JSON
  _faseGenRenderEditorJSON();
}

function fecharModalFaseConfig() {
  const el = document.getElementById('modal-fase-config-overlay');
  if (el) el.style.display = 'none';
  _faseGenImgFile = null;
}

// ── Preview de imagem ──────────────────────────────────────────────────────
function _faseGenAtualizarPreview(url) {
  const prev = document.getElementById('fase-img-preview');
  const placeholder = document.getElementById('fase-img-placeholder');
  if (!prev || !placeholder) return;
  if (url) {
    prev.src = normalizeImgUrl(url);
    prev.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    prev.style.display = 'none';
    placeholder.style.display = 'flex';
  }
}

function faseGenHandleImageSelect(input) {
  const file = input?.files?.[0];
  if (!file) return;
  _faseGenImgFile = file;
  const url = URL.createObjectURL(file);
  _faseGenAtualizarPreview(url);
  const nameEl = document.getElementById('fase-img-nome');
  if (nameEl) nameEl.textContent = file.name;
}

// ── Tilt slider ────────────────────────────────────────────────────────────
function faseGenTiltChange(val) {
  const v = parseInt(val);
  const el = document.getElementById('fase-tilt-val');
  if (el) el.textContent = v + '%';
  if (_faseGenModalData) _faseGenModalData.perspective.tilt_y = v / 100;
}

// ── Copiar prompt de imagem ────────────────────────────────────────────────
function faseGenCopiarPromptImagem() {
  const elementos = (document.getElementById('fase-elementos-input')?.value || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const estilo = document.getElementById('fase-estilo-input')?.value || 'pixel art fantasy dungeon';
  const tilt   = parseInt(document.getElementById('fase-tilt-slider')?.value || '72');
  const prompt = FASE_IMG_PROMPT_TEMPLATE({ estilo, tilt, elementos });
  navigator.clipboard.writeText(prompt).then(
    () => mostrarToast('📋 Prompt de imagem copiado!', 'ok'),
    () => mostrarToast('Erro ao copiar', 'err')
  );
}

// ── Gerar coordenadas via Claude Vision ────────────────────────────────────
async function faseGenGerarCoordenadas() {
  if (!_faseGenImgFile) { mostrarToast('Selecione uma imagem primeiro', 'aviso'); return; }
  const key = faseGenGetApiKey();
  if (!key) { mostrarToast('Configure a chave Claude API', 'aviso'); return; }

  const btn = document.getElementById('fase-btn-gerar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analisando...'; }
  try {
    const json = await faseGenFromImage(_faseGenImgFile);
    _faseGenModalData = faseGenValidarJSON(json);

    // Gerar catálogo de itens e popular baús com base no tema da dungeon
    const estilo = document.getElementById('fase-estilo-input')?.value || 'fantasy dungeon';
    await _faseGenGerarCatalogoEPopularBaus(estilo, _faseGenModalData, key);

    _faseGenRenderEditorJSON();
    mostrarToast('✓ Coordenadas extraídas e catálogo gerado', 'ok');
  } catch(e) {
    mostrarToast('Erro Claude Vision: ' + e.message, 'err');
    console.error('[fase-generator] Claude Vision error:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Gerar Coordenadas com Claude Vision'; }
  }
}

// Gera catálogo de itens temáticos e popula os baús do mapa
async function _faseGenGerarCatalogoEPopularBaus(estilo, rd, apiKey) {
  const numBaus = (rd.baus || []).length;
  if (!numBaus && !(rd.entidades || []).length) return;

  const rpgId = RPG_DATA?.rpgId;
  if (!rpgId) return;

  const catalogPrompt = `You are a game master creating items for a "${estilo}" RPG dungeon.
Generate a JSON array of ${Math.max(6, numBaus * 2 + (rd.entidades||[]).length)} items for this dungeon.
Each item must fit the dungeon theme. Include: weapons, armor, potions, keys, and rare treasures.
Include ${numBaus} chest-specific items (one per chest) and drop items for the ${(rd.entidades||[]).length} enemies.

Return ONLY a JSON array (no markdown), with each item having:
{
  "nome": string,
  "tipo": "equipamento"|"consumivel"|"misc",
  "descricao": string,
  "icone": string (single emoji),
  "raridade": "comum"|"incomum"|"raro"|"épico",
  "droppable": boolean,
  "drop_rate": number (0.05-0.3),
  "tier_min": 1,
  "tier_max": 5,
  "slot_padrao": "arma"|"armadura"|"capacete"|"botas"|"anel"|null,
  "chest_item": boolean
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: catalogPrompt }]
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return;
    const itens = JSON.parse(match[0]);

    // Salvar itens no banco
    const savedIds = [];
    for (const item of itens) {
      try {
        const [saved] = await sb('item_catalog', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rpg_id: rpgId,
            nome: item.nome,
            descricao: item.descricao,
            tipo: item.tipo || 'misc',
            icone: item.icone,
            raridade: item.raridade,
            droppable: item.droppable ?? false,
            drop_rate: item.drop_rate ?? 0.1,
            tier_min: item.tier_min ?? 1,
            tier_max: item.tier_max ?? 5,
            slot_padrao: item.slot_padrao || null,
            gerado_automaticamente: true,
          })
        });
        if (saved) savedIds.push({ ...saved, chest_item: item.chest_item });
      } catch(e) {}
    }

    // Popular baús com itens do catálogo gerado
    const chestItems = savedIds.filter(i => i.chest_item);
    if (rd.baus) {
      rd.baus.forEach((bau, idx) => {
        const item = chestItems[idx % chestItems.length];
        if (item) {
          bau.loot_itens = [{ item_catalog_id: item.id, nome: item.nome, quantidade: 1 }];
        }
      });
    }

    // Atualizar catálogo em memória no AVT_STATE se disponível
    if (typeof AVT_STATE !== 'undefined') {
      const catalog = await sb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome,tipo,icone,raridade,img_url,slot_padrao,atributos_bonus,droppable,drop_rate`).catch(()=>[]);
      AVT_STATE.itemCatalog = catalog || [];
    }

    mostrarToast(`✦ Catálogo gerado: ${savedIds.length} itens adicionados`, 'sucesso');
  } catch(e) {
    console.warn('[fase-generator] catalog generation failed:', e);
  }
}

// ── Copiar prompt para IA externa ──────────────────────────────────────────
function faseGenCopiarPromptExterno() {
  navigator.clipboard.writeText(faseGenPromptExterno()).then(
    () => mostrarToast('📋 Prompt copiado — cole em Claude.ai / ChatGPT / Gemini junto com a imagem', 'ok'),
    () => mostrarToast('Erro ao copiar', 'err')
  );
}

// ── Toggle painel importação externa ──────────────────────────────────────
function faseGenToggleImportExterno() {
  const wrap = document.getElementById('fase-import-externo-wrap');
  if (!wrap) return;
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

// ── Importar JSON externo ─────────────────────────────────────────────────
function faseGenImportarJSONExterno() {
  const ta = document.getElementById('fase-import-externo-json');
  if (!ta?.value.trim()) { mostrarToast('Cole o JSON no campo', 'aviso'); return; }
  try {
    _faseGenModalData = faseGenValidarJSON(ta.value);
    _faseGenRenderEditorJSON();
    ta.value = '';
    document.getElementById('fase-import-externo-wrap').style.display = 'none';
    mostrarToast('✓ JSON importado', 'ok');
  } catch(e) {
    mostrarToast('JSON inválido: ' + e.message, 'err');
  }
}

// ── Editor JSON visual ─────────────────────────────────────────────────────
function _faseGenRenderEditorJSON() {
  const ta = document.getElementById('fase-json-editor');
  if (!ta || !_faseGenModalData) return;
  ta.value = JSON.stringify(_faseGenModalData, null, 2);
}

function faseGenJSONEditado(val) {
  try {
    _faseGenModalData = JSON.parse(val);
    document.getElementById('fase-json-err').textContent = '';
  } catch(e) {
    document.getElementById('fase-json-err').textContent = '⚠ JSON inválido: ' + e.message;
  }
}

// ── Salvar fase ────────────────────────────────────────────────────────────
async function faseGenSalvar() {
  if (!_faseGenMapId) { mostrarToast('Mapa não identificado', 'err'); return; }
  if (!_faseGenModalData) { mostrarToast('Nenhum dado de fase para salvar', 'aviso'); return; }

  // Validar JSON do editor antes de salvar
  const ta = document.getElementById('fase-json-editor');
  if (ta) {
    try { _faseGenModalData = JSON.parse(ta.value); } catch(e) {
      mostrarToast('JSON inválido — corrija antes de salvar', 'err'); return;
    }
  }

  const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === _faseGenMapId);
  if (!entry) { mostrarToast('Mapa não encontrado', 'err'); return; }

  const btn = document.getElementById('fase-btn-salvar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

  try {
    // Upload de imagem se houver novo arquivo
    let imgUrl = entry.mapa.img_url || '';
    if (_faseGenImgFile) {
      try {
        const uploaded = await uploadToStorage(_faseGenImgFile, `mapas/${RPG_DATA.rpgId}`);
        if (uploaded) imgUrl = uploaded;
      } catch(uploadErr) {
        console.warn('[fase-generator] image upload failed, continuing without image:', uploadErr);
      }
    }

    // Salvar render_data e img_url
    await salvarRenderData(entry.id, _faseGenModalData);
    if (imgUrl !== entry.mapa.img_url) {
      await sb(`mapas?id=eq.${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ img_url: imgUrl })
      });
      entry.mapa.img_url = imgUrl;
    }

    entry.mapa.render_data = _faseGenModalData;
    mostrarToast('✓ Mapa de fase salvo', 'ok');
    fecharModalFaseConfig();

    // Re-renderizar se este mapa está ativo
    if (MAPA_STATE.mapaAtualId === _faseGenMapId) {
      renderMapaViewer?.();
    }
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + e.message, 'err');
    console.error('[fase-generator] save error:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Fase'; }
  }
}

// ── Adicionar entidade via UI ──────────────────────────────────────────────
function faseGenAdicionarEntidade() {
  if (!_faseGenModalData) return;
  const nome = prompt('Nome da entidade (criatura/NPC/Boss):');
  if (!nome) return;
  const tipo = prompt('Tipo (criatura, npc, boss):', 'criatura') || 'criatura';
  const id   = 'e_' + Date.now();
  _faseGenModalData.entidades.push({
    id, tipo, nome,
    char_ref: null,
    x: 0.5, y: 0.5,
    estado: 'dormindo',
    patrol_path: [],
    aggro_radius: 0.08,
    sleep_radius: 0.04,
    combate_tipo: 'tatico',
    combate_timer_s: 10,
    stats: {},
    drops: [],
    ia_perfil: null
  });
  _faseGenRenderEditorJSON();
  mostrarToast(`✓ Entidade "${nome}" adicionada`, 'ok');
}

// ── Exportar combate para IA (chamado do sistema de batalha) ──────────────
async function faseExportarCombate(batalhaId) {
  const b = MAPA_STATE.batalhas?.[batalhaId];
  if (!b) return null;

  const entry = (RPG_DATA?.mapas || []).find(l => l.mapa.map_id === b.mapa_id);
  const faseRd = entry?.mapa?.render_data || {};

  const export_data = {
    versao: 1,
    timestamp: new Date().toISOString(),
    contexto: {
      mapa_id: b.mapa_id,
      tipo_combate: 'tatico',
      rounds: b.turno_round || 0,
      entidades: (faseRd.entidades || []).filter(e =>
        (b.participantes || []).includes(e.nome)
      ),
      jogadores: (b.participantes || [])
        .map(nome => (RPG_DATA?.characters || []).find(c => c.nome === nome))
        .filter(Boolean)
        .map(c => ({ nome: c.nome, nivel: c.custom_attrs?.nivel, hp_max: c.hp_max }))
    },
    historico_acoes: b._historico_acoes || [],
    ia_decisoes: b._ia_decisoes || [],
    veredito: b.ativa ? 'em_andamento' : (b._veredito || 'encerrado')
  };

  // Persistir no registro da batalha
  try {
    await sb(`batalhas?id=eq.${batalhaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ia_export: export_data })
    });
    mostrarToast('📊 Combate exportado para IA', 'ok');
  } catch(e) {
    console.error('[fase-generator] export error:', e);
  }

  return export_data;
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenGetApiKey", { configurable: true, get: () => faseGenGetApiKey, set: (__v) => { faseGenGetApiKey = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenSetApiKey", { configurable: true, get: () => faseGenSetApiKey, set: (__v) => { faseGenSetApiKey = __v; } });
Object.defineProperty(globalThis, "FASE_IMG_PROMPT_TEMPLATE", { configurable: true, get: () => FASE_IMG_PROMPT_TEMPLATE });
Object.defineProperty(globalThis, "FASE_COORD_PROMPT", { configurable: true, get: () => FASE_COORD_PROMPT });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenPromptExterno", { configurable: true, get: () => faseGenPromptExterno, set: (__v) => { faseGenPromptExterno = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseGenApiCall", { configurable: true, get: () => _faseGenApiCall, set: (__v) => { _faseGenApiCall = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseFileToBase64", { configurable: true, get: () => _faseFileToBase64, set: (__v) => { _faseFileToBase64 = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenFromImage", { configurable: true, get: () => faseGenFromImage, set: (__v) => { faseGenFromImage = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenValidarJSON", { configurable: true, get: () => faseGenValidarJSON, set: (__v) => { faseGenValidarJSON = __v; } });
Object.defineProperty(globalThis, "_faseGenModalData", { configurable: true, get: () => _faseGenModalData, set: (__v) => { _faseGenModalData = __v; } });
Object.defineProperty(globalThis, "_faseGenImgFile", { configurable: true, get: () => _faseGenImgFile, set: (__v) => { _faseGenImgFile = __v; } });
Object.defineProperty(globalThis, "_faseGenMapId", { configurable: true, get: () => _faseGenMapId, set: (__v) => { _faseGenMapId = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalFaseConfig", { configurable: true, get: () => abrirModalFaseConfig, set: (__v) => { abrirModalFaseConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalFaseConfig", { configurable: true, get: () => fecharModalFaseConfig, set: (__v) => { fecharModalFaseConfig = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseGenAtualizarPreview", { configurable: true, get: () => _faseGenAtualizarPreview, set: (__v) => { _faseGenAtualizarPreview = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenHandleImageSelect", { configurable: true, get: () => faseGenHandleImageSelect, set: (__v) => { faseGenHandleImageSelect = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenTiltChange", { configurable: true, get: () => faseGenTiltChange, set: (__v) => { faseGenTiltChange = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenCopiarPromptImagem", { configurable: true, get: () => faseGenCopiarPromptImagem, set: (__v) => { faseGenCopiarPromptImagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenGerarCoordenadas", { configurable: true, get: () => faseGenGerarCoordenadas, set: (__v) => { faseGenGerarCoordenadas = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseGenGerarCatalogoEPopularBaus", { configurable: true, get: () => _faseGenGerarCatalogoEPopularBaus, set: (__v) => { _faseGenGerarCatalogoEPopularBaus = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenCopiarPromptExterno", { configurable: true, get: () => faseGenCopiarPromptExterno, set: (__v) => { faseGenCopiarPromptExterno = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenToggleImportExterno", { configurable: true, get: () => faseGenToggleImportExterno, set: (__v) => { faseGenToggleImportExterno = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenImportarJSONExterno", { configurable: true, get: () => faseGenImportarJSONExterno, set: (__v) => { faseGenImportarJSONExterno = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_faseGenRenderEditorJSON", { configurable: true, get: () => _faseGenRenderEditorJSON, set: (__v) => { _faseGenRenderEditorJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenJSONEditado", { configurable: true, get: () => faseGenJSONEditado, set: (__v) => { faseGenJSONEditado = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenSalvar", { configurable: true, get: () => faseGenSalvar, set: (__v) => { faseGenSalvar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseGenAdicionarEntidade", { configurable: true, get: () => faseGenAdicionarEntidade, set: (__v) => { faseGenAdicionarEntidade = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "faseExportarCombate", { configurable: true, get: () => faseExportarCombate, set: (__v) => { faseExportarCombate = __v; } });
