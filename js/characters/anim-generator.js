// characters/anim-generator.js
// Character Animation Generator: Claude Vision API → segmentação de partes por bbox + recorte raster

const ANIM_CHAR_PROMPT = `Analise esta imagem de personagem e retorne APENAS JSON válido (sem markdown, sem blocos de código — apenas o objeto JSON começando com {), identificando a posição de cada parte do corpo na imagem original.

{
  "palette": {
    "skin": "#hex",
    "hair": "#hex",
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "outline": "#hex"
  },
  "style": "fantasy",
  "parts": {
    "head":        { "bbox": {"x": 10, "y": 5,   "w": 60, "h": 65}, "pivot": {"x": 0.5, "y": 0.87}, "zIndex": 9, "jointWith": "torso" },
    "torso":       { "bbox": {"x": 8,  "y": 70,  "w": 70, "h": 90}, "pivot": {"x": 0.5, "y": 0.47}, "zIndex": 6, "jointWith": "root" },
    "arm_upper_l": { "bbox": {"x": 0,  "y": 72,  "w": 25, "h": 50}, "pivot": {"x": 0.5, "y": 0.09}, "zIndex": 3, "jointWith": "torso" },
    "arm_lower_l": { "bbox": {"x": 0,  "y": 120, "w": 25, "h": 50}, "pivot": {"x": 0.5, "y": 0.09}, "zIndex": 2, "jointWith": "arm_upper_l" },
    "arm_upper_r": { "bbox": {"x": 75, "y": 72,  "w": 25, "h": 50}, "pivot": {"x": 0.5, "y": 0.09}, "zIndex": 7, "jointWith": "torso" },
    "arm_lower_r": { "bbox": {"x": 75, "y": 120, "w": 25, "h": 50}, "pivot": {"x": 0.5, "y": 0.09}, "zIndex": 7, "jointWith": "arm_upper_r" },
    "leg_upper_l": { "bbox": {"x": 8,  "y": 160, "w": 30, "h": 55}, "pivot": {"x": 0.5, "y": 0.05}, "zIndex": 4, "jointWith": "torso" },
    "leg_lower_l": { "bbox": {"x": 8,  "y": 213, "w": 30, "h": 55}, "pivot": {"x": 0.5, "y": 0.05}, "zIndex": 4, "jointWith": "leg_upper_l" },
    "leg_upper_r": { "bbox": {"x": 42, "y": 160, "w": 30, "h": 55}, "pivot": {"x": 0.5, "y": 0.05}, "zIndex": 5, "jointWith": "torso" },
    "leg_lower_r": { "bbox": {"x": 42, "y": 213, "w": 30, "h": 55}, "pivot": {"x": 0.5, "y": 0.05}, "zIndex": 5, "jointWith": "leg_upper_r" }
  }
}

REGRAS:
- bbox: coordenadas em pixels na imagem original (x, y, largura, altura) da região que contém aquela parte do corpo. Os valores devem ser precisos — o sistema vai recortar exatamente essa área da imagem.
- pivot: ponto de rotação normalizado (0.0–1.0) relativo ao bbox de cada parte. Exemplos: ombro do braço superior → y≈0.05 (topo do bbox). Nuca da cabeça → y≈0.85. Quadril da perna superior → y≈0.05.
- zIndex: profundidade de desenho (0 = mais ao fundo). Referência: arm_lower_l=2, arm_upper_l=3, leg_l=4, leg_r=5, torso=6, arm_r=7, head=9.
- jointWith: parte pai na hierarquia de ossos (root, torso, arm_upper_l, arm_upper_r, leg_upper_l, leg_upper_r).
- TODAS as 10 partes são obrigatórias: head, torso, arm_upper_l, arm_lower_l, arm_upper_r, arm_lower_r, leg_upper_l, leg_lower_l, leg_upper_r, leg_lower_r.
- palette: extraia as cores reais do personagem na imagem.
- Não gere SVGs. Não redesenhe nada. Apenas analise e anote.`;

const ANIM_EQUIP_PROMPT_TPL = (slot) => `You are a 2D equipment artist for a fantasy RPG game. Analyze this equipment image and generate a flat 2D cartoon SVG sprite.

Return ONLY valid JSON (no markdown):
{
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 48'>...</svg>",
  "palette": { "main": "#hex", "edge": "#hex", "grip": "#hex" },
  "rotation_hint": -15
}

Equipment slot: ${slot}

SVG RULES:
- Use <rect>, <circle>, <ellipse>, <path>, <polygon> — any standard SVG shapes
- Bold, clear silhouette — legible at 20px wide
- 3 shading layers: base color, darker shadow, lighter highlight (use separate shapes with lower opacity or explicit colors)
- Outline main shape with the darkest/outline color (stroke or border shapes)
- NO whitespace or newlines inside SVG attribute values

VIEWBOX AND SHAPE BY SLOT:
- sword/spear/staff/polearm (weapon_r): viewBox="0 0 16 48" — blade (pointed top, wider base) at top 70%, crossguard rect at 70%, grip (narrow, darker) at bottom 30%
- axe/hammer (weapon_r): viewBox="0 0 20 40" — wide head at top, narrow handle below
- dagger (weapon_r): viewBox="0 0 10 36" — slim tapered blade, short grip
- shield (shield): viewBox="0 0 22 26" — rounded or kite shape, boss circle in center, rim outline
- helmet (helmet): viewBox="0 0 22 20" — dome/helm shape, visor or face opening, cheek guards
- chest armor (chest_armor): viewBox="0 0 24 32" — breastplate shape, pauldron hints, central ridge
- other slots: viewBox="0 0 18 18"

rotation_hint: suggested rotation in degrees for visual placement when held by the character (-30 for swords held diagonally, 0 for shields, -15 for daggers, 0 for axes).
Match the equipment's EXACT colors from the image.`;

// Default keyframe animations
const ANIM_DEFAULTS = {
  idle: {
    duration: 2000,
    loop: true,
    tracks: {
      torso: [
        {t:0,rotation:0,y_offset:0},
        {t:1000,rotation:0.8,y_offset:1.2},
        {t:2000,rotation:0,y_offset:0}
      ],
      head: [
        {t:0,rotation:0,y_offset:0},
        {t:1200,rotation:-0.8,y_offset:1.0},
        {t:2000,rotation:0,y_offset:0}
      ],
      arm_upper_l: [
        {t:0,rotation:-5},
        {t:1000,rotation:-8},
        {t:2000,rotation:-5}
      ],
      arm_upper_r: [
        {t:0,rotation:5},
        {t:1000,rotation:8},
        {t:2000,rotation:5}
      ],
      arm_lower_l: [
        {t:0,rotation:8},
        {t:1000,rotation:11},
        {t:2000,rotation:8}
      ],
      arm_lower_r: [
        {t:0,rotation:-8},
        {t:1000,rotation:-11},
        {t:2000,rotation:-8}
      ]
    }
  },
  walk: {
    duration: 800,
    loop: true,
    tracks: {
      torso: [
        {t:0,y_offset:0},
        {t:200,y_offset:-2},
        {t:400,y_offset:0},
        {t:600,y_offset:-2},
        {t:800,y_offset:0}
      ],
      head: [
        {t:0,y_offset:0},
        {t:200,y_offset:-1.5},
        {t:400,y_offset:0},
        {t:600,y_offset:-1.5},
        {t:800,y_offset:0}
      ],
      arm_upper_l: [
        {t:0,rotation:-35},
        {t:400,rotation:35},
        {t:800,rotation:-35}
      ],
      arm_upper_r: [
        {t:0,rotation:35},
        {t:400,rotation:-35},
        {t:800,rotation:35}
      ],
      arm_lower_l: [
        {t:0,rotation:10},
        {t:400,rotation:-5},
        {t:800,rotation:10}
      ],
      arm_lower_r: [
        {t:0,rotation:-5},
        {t:400,rotation:10},
        {t:800,rotation:-5}
      ],
      leg_upper_l: [
        {t:0,rotation:32},
        {t:400,rotation:-32},
        {t:800,rotation:32}
      ],
      leg_upper_r: [
        {t:0,rotation:-32},
        {t:400,rotation:32},
        {t:800,rotation:-32}
      ],
      leg_lower_l: [
        {t:0,rotation:-8},
        {t:200,rotation:18},
        {t:400,rotation:-8},
        {t:600,rotation:18},
        {t:800,rotation:-8}
      ],
      leg_lower_r: [
        {t:0,rotation:18},
        {t:200,rotation:-8},
        {t:400,rotation:18},
        {t:600,rotation:-8},
        {t:800,rotation:18}
      ]
    }
  },
  attack: {
    duration: 600,
    loop: false,
    tracks: {
      torso: [
        {t:0,rotation:0},
        {t:120,rotation:-18},
        {t:320,rotation:22},
        {t:600,rotation:0}
      ],
      head: [
        {t:0,rotation:0},
        {t:120,rotation:-12},
        {t:320,rotation:15},
        {t:600,rotation:0}
      ],
      arm_upper_r: [
        {t:0,rotation:5},
        {t:80,rotation:-90},
        {t:280,rotation:65},
        {t:600,rotation:5}
      ],
      arm_lower_r: [
        {t:0,rotation:-8},
        {t:80,rotation:-50},
        {t:280,rotation:15},
        {t:600,rotation:-8}
      ],
      arm_upper_l: [
        {t:0,rotation:-5},
        {t:200,rotation:-20},
        {t:600,rotation:-5}
      ]
    }
  }
};

const ANIM_SKELETON = {
  root:        {offset:[0,0],       children:['torso']},
  torso:       {parent:'root',      offset:[0,-22],    children:['head','arm_upper_l','arm_upper_r','leg_upper_l','leg_upper_r']},
  head:        {parent:'torso',     offset:[0,-40]},
  arm_upper_l: {parent:'torso',     offset:[-20,-22],  children:['arm_lower_l']},
  arm_lower_l: {parent:'arm_upper_l',offset:[0,20]},
  arm_upper_r: {parent:'torso',     offset:[20,-22],   children:['arm_lower_r']},
  arm_lower_r: {parent:'arm_upper_r',offset:[0,20]},
  leg_upper_l: {parent:'torso',     offset:[-11,22],   children:['leg_lower_l']},
  leg_lower_l: {parent:'leg_upper_l',offset:[0,20]},
  leg_upper_r: {parent:'torso',     offset:[11,22],    children:['leg_lower_r']},
  leg_lower_r: {parent:'leg_upper_r',offset:[0,20]}
};

const _ANIM_PART_ZINDEX = {
  arm_lower_l: 2, arm_upper_l: 3, leg_lower_l: 4, leg_upper_l: 4,
  leg_lower_r: 5, leg_upper_r: 5, torso: 6, arm_upper_r: 7, arm_lower_r: 7, head: 9
};

function _animBoneParentName(boneId) {
  return ANIM_SKELETON[boneId]?.parent || 'root';
}

// ── API Key ─────────────────────────────────────────────────────────────────

function animGenGetApiKey() {
  return localStorage.getItem('animgen_claude_key') || '';
}

function animGenSetApiKey(key) {
  localStorage.setItem('animgen_claude_key', (key || '').trim());
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function animGenFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const parts = e.target.result.split(',');
      resolve({ data: parts[1], mimeType: file.type || 'image/png' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function animGenFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function _animCropPartFromImage(imageFile, bbox, targetW, targetH) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = targetW * 2;
      canvas.height = targetH * 2;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, targetW * 2, targetH * 2);
      URL.revokeObjectURL(url);
      try { resolve(canvas.toDataURL('image/png')); }
      catch(e) { resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function _animGenApiCall(messages) {
  const key = animGenGetApiKey();
  if (!key) throw new Error('Chave Claude API não configurada. Insira sua chave na aba 🎬 Animado.');

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
      max_tokens: 8192,
      messages
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Erro API Claude (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('IA não retornou JSON válido. Tente novamente.');

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error('JSON inválido na resposta da IA. Tente novamente.');
  }
}

// ── Entry points ─────────────────────────────────────────────────────────────

async function animGenFromImage(imageFile) {
  const { data, mimeType } = await animGenFileToBase64(imageFile);

  const result = await _animGenApiCall([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
      { type: 'text', text: ANIM_CHAR_PROMPT }
    ]
  }]);

  const rawParts = result.parts || {};
  const parts = {};

  await Promise.all(Object.entries(_ANIM_BONE_CFG).map(async ([boneId, bc]) => {
    const partMeta = rawParts[boneId];
    if (!partMeta?.bbox) return;

    const texture = await _animCropPartFromImage(imageFile, partMeta.bbox, bc.imgW, bc.imgH);
    if (!texture) return;

    parts[boneId] = {
      texture,
      pivot:     partMeta.pivot    || { x: bc.pivot[0], y: bc.pivot[1] },
      width:     bc.imgW,
      height:    bc.imgH,
      zIndex:    partMeta.zIndex   ?? _ANIM_PART_ZINDEX[boneId] ?? 5,
      jointWith: partMeta.jointWith || _animBoneParentName(boneId)
    };
  }));

  return {
    version: 2,
    palette: result.palette || {},
    style:   result.style   || 'fantasy',
    parts,
    skeleton:        ANIM_SKELETON,
    animations:      ANIM_DEFAULTS,
    equipment_slots: {
      weapon_r: null, shield: null, helmet: null,
      chest_armor: null, cape: null, boot_l: null, boot_r: null, glove_r: null
    }
  };
}

async function animGenEquipFromImage(imageFile, slot) {
  const { data, mimeType } = await animGenFileToBase64(imageFile);

  const result = await _animGenApiCall([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
      { type: 'text', text: ANIM_EQUIP_PROMPT_TPL(slot) }
    ]
  }]);

  return {
    slot,
    svg: result.svg || '',
    palette: result.palette || {},
    offset: [0, 0],
    rotation: result.rotation_hint || 0,
    scale: 1.0
  };
}

// ── UI Handlers ───────────────────────────────────────────────────────────────

function animGenHandleImageSelect(input) {
  const file = input.files?.[0];
  if (!file) return;
  window._animGenSelectedFile = file;
  const nameEl = document.getElementById('animgen-img-name');
  if (nameEl) nameEl.textContent = file.name.slice(0, 30);
}

async function animGenHandleGenerate() {
  const file = window._animGenSelectedFile;
  if (!file) { mostrarToast('Selecione uma imagem primeiro', 'aviso'); return; }

  const btn = document.getElementById('animgen-btn-gerar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando...'; }

  try {
    const animadoData = await animGenFromImage(file);
    window._apmodAnimado = animadoData;
    window._apmodOriginalStale = true;
    window._apmodLastBaseTab = 'animado';

    // Show preview sections
    const previewWrap = document.getElementById('animgen-preview-wrap');
    const equipWrap = document.getElementById('animgen-equip-wrap');
    if (previewWrap) previewWrap.style.display = 'block';
    if (equipWrap) equipWrap.style.display = 'block';

    // Show palette
    const paletteEl = document.getElementById('animgen-palette');
    if (paletteEl && animadoData.palette) {
      paletteEl.innerHTML = Object.entries(animadoData.palette).map(([k, v]) =>
        `<div title="${k}: ${v}" style="width:18px;height:18px;border-radius:3px;background:${v};border:1px solid rgba(255,255,255,0.2)"></div>`
      ).join('');
    }

    // Mount animation renderer
    const canvasWrap = document.getElementById('animgen-canvas-wrap');
    if (canvasWrap) {
      if (window._apmodAnimTabCtrl) { window._apmodAnimTabCtrl.destroy(); window._apmodAnimTabCtrl = null; }
      window._apmodAnimTabCtrl = animRendererMount(canvasWrap, animadoData, { width: 120, height: 180, animName: 'idle' });
    }

    mostrarToast('Personagem gerado com sucesso!', 'ok');
  } catch (e) {
    mostrarToast('Erro: ' + e.message, 'erro');
    console.error('[AnimGen]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🎨 Gerar Personagem com IA'; }
  }
}

async function animGenHandleEquipImage(slot, input) {
  const file = input.files?.[0];
  if (!file) return;

  input.disabled = true;
  const slotBtn = input.nextElementSibling;
  if (slotBtn) slotBtn.textContent = '⏳...';

  try {
    const equipData = await animGenEquipFromImage(file, slot);

    if (!window._apmodAnimado) window._apmodAnimado = { equipment_slots: {} };
    if (!window._apmodAnimado.equipment_slots) window._apmodAnimado.equipment_slots = {};
    window._apmodAnimado.equipment_slots[slot] = equipData;
    window._apmodOriginalStale = true;

    // Update slot preview
    const previewEl = document.getElementById(`animgen-slot-preview-${slot}`);
    if (previewEl && equipData.svg) {
      previewEl.innerHTML = `<div style="width:24px;height:32px;overflow:hidden">${equipData.svg}</div>`;
    }

    // Update live renderer
    if (window._apmodAnimTabCtrl) {
      animRendererUpdateEquipment(window._apmodAnimTabCtrl, slot, equipData);
    }

    mostrarToast(`Equipamento gerado: ${slot}`, 'ok');
  } catch (e) {
    mostrarToast('Erro ao gerar equipamento: ' + e.message, 'erro');
    console.error('[AnimGen Equip]', e);
  } finally {
    input.disabled = false;
    if (slotBtn) slotBtn.textContent = '🔄 Trocar';
  }
}

function animGenSetPreviewAnim(animName) {
  if (!window._apmodAnimTabCtrl) return;
  window._apmodAnimTabCtrl.setAnimation(animName);

  // Update button styles
  document.querySelectorAll('.animgen-anim-btn').forEach(b => {
    b.style.background = 'rgba(20,29,43,0.6)';
    b.style.borderColor = 'var(--borda)';
    b.style.color = 'var(--suave)';
  });
  const labels = { idle: '⏸ Idle', walk: '🚶 Caminhar', attack: '⚔ Atacar' };
  const activeText = labels[animName];
  document.querySelectorAll('.animgen-anim-btn').forEach(b => {
    if (b.textContent.trim() === activeText) {
      b.style.background = 'rgba(79,163,209,0.15)';
      b.style.borderColor = 'var(--primario)';
      b.style.color = 'var(--primario)';
    }
  });
}

// ── External AI Import / Export ───────────────────────────────────────────────

function animGenCopiarPromptPersonagem() {
  navigator.clipboard.writeText(ANIM_CHAR_PROMPT).then(() => {
    mostrarToast('Prompt copiado! Cole numa IA com suporte a imagem junto com a foto do personagem.', 'ok');
  }).catch(() => {
    // Fallback: show in textarea for manual copy
    const ta = document.getElementById('animgen-import-json');
    if (ta) { ta.value = ANIM_CHAR_PROMPT; ta.select(); }
    mostrarToast('Copie o texto da área abaixo (Ctrl+A, Ctrl+C)', '');
  });
}

function animGenCopiarPromptEquip(slot) {
  const prompt = ANIM_EQUIP_PROMPT_TPL(slot);
  navigator.clipboard.writeText(prompt).then(() => {
    mostrarToast('Prompt de equipamento copiado!', 'ok');
  }).catch(() => {
    const ta = document.getElementById(`animgen-import-equip-json-${slot}`);
    if (ta) { ta.value = prompt; ta.select(); }
    mostrarToast('Copie o texto da área abaixo', '');
  });
}

async function animGenImportarJSON() {
  const ta = document.getElementById('animgen-import-json');
  if (!ta || !ta.value.trim()) { mostrarToast('Cole o JSON gerado pela IA na área de texto', 'aviso'); return; }

  const btn = document.getElementById('animgen-btn-importar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Processando...'; }

  let raw = ta.value.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) {
    mostrarToast('JSON inválido: ' + e.message, 'erro');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
    return;
  }

  if (!parsed.parts || typeof parsed.parts !== 'object') {
    mostrarToast('JSON não contém o campo "parts" com as partes do corpo', 'erro');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
    return;
  }

  try {
    // v2 with bboxes: crop parts from the uploaded reference image
    const hasBbox = Object.values(parsed.parts).some(p => p?.bbox);
    if (hasBbox) {
      if (!window._animGenSelectedFile) {
        mostrarToast('Selecione a imagem de referência antes de importar o JSON com bboxes', 'aviso');
        if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
        return;
      }
      const parts = {};
      await Promise.all(Object.entries(_ANIM_BONE_CFG).map(async ([boneId, bc]) => {
        const partMeta = parsed.parts[boneId];
        if (!partMeta?.bbox) return;
        const texture = await _animCropPartFromImage(window._animGenSelectedFile, partMeta.bbox, bc.imgW, bc.imgH);
        if (!texture) return;
        parts[boneId] = {
          texture,
          pivot:     partMeta.pivot    || { x: bc.pivot[0], y: bc.pivot[1] },
          width:     bc.imgW,
          height:    bc.imgH,
          zIndex:    partMeta.zIndex   ?? _ANIM_PART_ZINDEX[boneId] ?? 5,
          jointWith: partMeta.jointWith || _animBoneParentName(boneId)
        };
      }));
      parsed.parts = parts;
      parsed.version = 2;
    }

    const animadoData = {
      version:  parsed.version || 1,
      palette:  parsed.palette || {},
      style:    parsed.style   || 'fantasy',
      parts:    parsed.parts,
      skeleton: parsed.skeleton || ANIM_SKELETON,
      animations: ANIM_DEFAULTS,
      equipment_slots: window._apmodAnimado?.equipment_slots || {
        weapon_r: null, shield: null, helmet: null, chest_armor: null,
        cape: null, glove_r: null, boot_l: null, boot_r: null
      }
    };

    window._apmodAnimado = animadoData;
    window._apmodOriginalStale = true;
    window._apmodLastBaseTab = 'animado';

    const previewWrap = document.getElementById('animgen-preview-wrap');
    const equipWrap   = document.getElementById('animgen-equip-wrap');
    if (previewWrap) previewWrap.style.display = 'block';
    if (equipWrap)   equipWrap.style.display   = 'block';

    const paletteEl = document.getElementById('animgen-palette');
    if (paletteEl && animadoData.palette) {
      paletteEl.innerHTML = Object.entries(animadoData.palette).map(([k, v]) =>
        `<div title="${k}: ${v}" style="width:18px;height:18px;border-radius:3px;background:${v};border:1px solid rgba(255,255,255,0.2)"></div>`
      ).join('');
    }

    const canvasWrap = document.getElementById('animgen-canvas-wrap');
    if (canvasWrap) {
      if (window._apmodAnimTabCtrl) { window._apmodAnimTabCtrl.destroy(); window._apmodAnimTabCtrl = null; }
      window._apmodAnimTabCtrl = animRendererMount(canvasWrap, animadoData, { width: 120, height: 180, animName: 'idle' });
    }

    mostrarToast('Personagem importado! Clique em Salvar para persistir.', 'ok');
  } catch(e) {
    mostrarToast('Erro ao processar JSON: ' + e.message, 'erro');
    console.error('[AnimGen Import]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
  }
}

function animGenToggleImport() {
  const wrap = document.getElementById('animgen-import-wrap');
  if (!wrap) return;
  const open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
  const btn = document.getElementById('animgen-toggle-import-btn');
  if (btn) btn.textContent = open ? '📥 Importar de IA Externa' : '▲ Fechar Importação';
}

function animGenToggleEquipImport(slot) {
  const wrap = document.getElementById(`animgen-equip-import-wrap-${slot}`);
  if (!wrap) return;
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function animGenImportarEquipJSON(slot) {
  const ta = document.getElementById(`animgen-import-equip-json-${slot}`);
  if (!ta || !ta.value.trim()) { mostrarToast('Cole o JSON do equipamento', 'aviso'); return; }

  let raw = ta.value.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { mostrarToast('JSON inválido: ' + e.message, 'erro'); return; }

  if (!parsed.svg) { mostrarToast('JSON não contém o campo "svg"', 'erro'); return; }

  const equipData = {
    slot,
    svg: parsed.svg,
    palette: parsed.palette || {},
    offset: [0, 0],
    rotation: parsed.rotation_hint || 0,
    scale: 1.0
  };

  if (!window._apmodAnimado) window._apmodAnimado = { equipment_slots: {} };
  if (!window._apmodAnimado.equipment_slots) window._apmodAnimado.equipment_slots = {};
  window._apmodAnimado.equipment_slots[slot] = equipData;
  window._apmodOriginalStale = true;

  // Update slot preview
  const previewEl = document.getElementById(`animgen-slot-preview-${slot}`);
  if (previewEl) previewEl.innerHTML = `<div style="width:24px;height:32px;overflow:hidden">${equipData.svg}</div>`;

  // Update live renderer
  if (window._apmodAnimTabCtrl) animRendererUpdateEquipment(window._apmodAnimTabCtrl, slot, equipData);

  ta.value = '';
  document.getElementById(`animgen-equip-import-wrap-${slot}`)?.style && (document.getElementById(`animgen-equip-import-wrap-${slot}`).style.display = 'none');
  mostrarToast(`Equipamento importado: ${slot}`, 'ok');
}

// ── Tab HTML ──────────────────────────────────────────────────────────────────

function _apmodTabAnimado(aparencia) {
  const animado = aparencia.animado || {};
  const hasData = !!(animado.parts && Object.keys(animado.parts).length);
  const savedKey = animGenGetApiKey();

  const equipSlots = [
    { key: 'weapon_r',   label: '⚔ Arma Dir.' },
    { key: 'shield',     label: '🛡 Escudo' },
    { key: 'helmet',     label: '⛑ Elmo' },
    { key: 'chest_armor',label: '🦺 Armadura' },
    { key: 'cape',       label: '🧥 Capa' },
    { key: 'glove_r',   label: '🧤 Luva Dir.' },
    { key: 'boot_l',    label: '👢 Bota Esq.' },
    { key: 'boot_r',    label: '👢 Bota Dir.' }
  ];

  const equipSlotsHtml = equipSlots.map(s => {
    const eq = animado.equipment_slots?.[s.key];
    return `<div style="background:rgba(10,14,24,0.6);border:1px solid var(--borda);border-radius:6px;padding:7px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave)">${s.label}</span>
        <button onclick="animGenCopiarPromptEquip('${s.key}')" title="Copiar prompt para IA externa"
          style="padding:1px 5px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.25);border-radius:3px;color:#c8a84b;font-size:0.55rem;cursor:pointer;line-height:1.4">
          📋
        </button>
      </div>
      <div id="animgen-slot-preview-${s.key}" style="height:32px;display:flex;align-items:center;justify-content:center;margin-bottom:4px">
        ${eq && eq.svg ? `<div style="width:24px;height:32px;overflow:hidden">${eq.svg}</div>` : '<span style="color:rgba(255,255,255,0.15);font-size:0.65rem">vazio</span>'}
      </div>
      <input type="file" id="animgen-equip-file-${s.key}" accept="image/*" style="display:none"
        onchange="animGenHandleEquipImage('${s.key}', this)">
      <div style="display:flex;gap:3px;margin-bottom:3px">
        <button onclick="document.getElementById('animgen-equip-file-${s.key}').click()"
          style="flex:1;padding:3px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.48rem;cursor:pointer;font-family:var(--fonte-d)">
          ${eq ? '🔄' : '📷'} API
        </button>
        <button onclick="animGenToggleEquipImport('${s.key}')"
          style="flex:1;padding:3px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:3px;color:var(--suave);font-size:0.48rem;cursor:pointer;font-family:var(--fonte-d)">
          📥 JSON
        </button>
      </div>
      <div id="animgen-equip-import-wrap-${s.key}" style="display:none">
        <textarea id="animgen-import-equip-json-${s.key}" placeholder="Cole JSON aqui..."
          style="width:100%;box-sizing:border-box;height:50px;background:var(--painel);border:1px solid var(--borda);border-radius:3px;padding:4px;color:var(--texto);font-family:monospace;font-size:0.48rem;resize:none;margin-bottom:3px"></textarea>
        <button onclick="animGenImportarEquipJSON('${s.key}')"
          style="width:100%;padding:3px;background:rgba(46,160,67,0.15);border:1px solid rgba(46,160,67,0.35);border-radius:3px;color:#3fb950;font-size:0.5rem;cursor:pointer;font-family:var(--fonte-d)">
          ✅ Carregar
        </button>
      </div>
    </div>`;
  }).join('');

  return `<div id="apmod-tab-animado" class="apmod-tab-content" style="display:none">
  <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--suave);margin-bottom:12px;line-height:1.6">
    Envie uma imagem de corpo inteiro e a IA identificará cada parte do corpo, recortando texturas reais para animação esquelética.
  </div>

  <div style="margin-bottom:12px;padding:10px;background:rgba(200,168,75,0.06);border:1px solid rgba(200,168,75,0.2);border-radius:6px">
    <label style="font-family:var(--fonte-d);font-size:0.56rem;color:#c8a84b;display:block;margin-bottom:5px;text-transform:uppercase">🔑 Chave Claude API</label>
    <input type="password" id="animgen-api-key" value="${savedKey}" placeholder="sk-ant-api03-..."
      style="width:100%;box-sizing:border-box;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:6px 8px;color:var(--texto);font-family:monospace;font-size:0.62rem"
      oninput="animGenSetApiKey(this.value)">
    <div style="font-size:0.5rem;color:var(--suave);margin-top:4px">Salvo localmente no navegador. Obtenha em console.anthropic.com</div>
  </div>

  <div style="margin-bottom:12px">
    <label style="font-family:var(--fonte-d);font-size:0.56rem;color:var(--suave);display:block;margin-bottom:5px;text-transform:uppercase">📷 Imagem de Referência</label>
    <div style="display:flex;gap:8px;align-items:center">
      <input type="file" id="animgen-img-input" accept="image/*" style="display:none" onchange="animGenHandleImageSelect(this)">
      <button onclick="document.getElementById('animgen-img-input').click()"
        style="background:rgba(20,29,43,0.8);border:1px solid var(--borda);border-radius:6px;padding:7px 12px;color:var(--texto);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer">
        📁 Escolher
      </button>
      <span id="animgen-img-name" style="font-size:0.56rem;color:var(--suave);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">nenhuma imagem</span>
    </div>
  </div>

  <button id="animgen-btn-gerar" onclick="animGenHandleGenerate()"
    style="width:100%;padding:10px;background:linear-gradient(135deg,#3a6aaa,#5a8acc);border:none;border-radius:8px;color:#fff;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">
    🎨 Gerar Personagem com IA
  </button>

  <div style="margin-bottom:14px">
    <button id="animgen-toggle-import-btn" onclick="animGenToggleImport()"
      style="width:100%;padding:8px;background:rgba(10,14,24,0.8);border:1px solid var(--borda);border-radius:6px;color:var(--suave);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;text-align:left">
      📥 Importar de IA Externa
    </button>
    <div id="animgen-import-wrap" style="display:none;padding:10px;background:rgba(10,14,24,0.6);border:1px solid var(--borda);border-top:none;border-radius:0 0 6px 6px">
      <div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);line-height:1.6;margin-bottom:6px">
        1. Selecione a imagem de referência acima.<br>
        2. Copie o prompt abaixo → cole em Claude.ai, ChatGPT ou Gemini com a mesma imagem → cole o JSON retornado aqui.
      </div>
      <div style="font-family:var(--fonte-d);font-size:0.5rem;color:#c8a84b;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:4px;padding:5px 7px;margin-bottom:7px">
        ⚠ A imagem de referência deve estar selecionada antes de carregar o JSON — ela é usada para recortar as texturas.
      </div>
      <button onclick="animGenCopiarPromptPersonagem()"
        style="width:100%;padding:7px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.35);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;margin-bottom:8px">
        📋 Copiar Prompt do Personagem
      </button>
      <textarea id="animgen-import-json" placeholder="Cole aqui o JSON retornado pela IA..."
        style="width:100%;box-sizing:border-box;height:90px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:6px 8px;color:var(--texto);font-family:monospace;font-size:0.56rem;resize:vertical;margin-bottom:6px"></textarea>
      <button id="animgen-btn-importar" onclick="animGenImportarJSON()"
        style="width:100%;padding:7px;background:rgba(46,160,67,0.18);border:1px solid rgba(46,160,67,0.4);border-radius:5px;color:#3fb950;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer">
        ✅ Carregar Personagem
      </button>
    </div>
  </div>

  <div id="animgen-preview-wrap" style="margin-bottom:14px;display:${hasData ? 'block' : 'none'}">
    <div style="font-family:var(--fonte-d);font-size:0.54rem;color:var(--suave);text-transform:uppercase;margin-bottom:6px;letter-spacing:0.06em">Preview Animado</div>
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div id="animgen-canvas-wrap" style="width:120px;height:180px;border:1px solid var(--borda);border-radius:6px;background:#0a0e18;flex-shrink:0;overflow:hidden"></div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button onclick="animGenSetPreviewAnim('idle')" class="animgen-anim-btn"
          style="padding:6px 10px;background:rgba(79,163,209,0.15);border:1px solid var(--primario);border-radius:4px;color:var(--primario);font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">
          ⏸ Idle
        </button>
        <button onclick="animGenSetPreviewAnim('walk')" class="animgen-anim-btn"
          style="padding:6px 10px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">
          🚶 Caminhar
        </button>
        <button onclick="animGenSetPreviewAnim('attack')" class="animgen-anim-btn"
          style="padding:6px 10px;background:rgba(20,29,43,0.6);border:1px solid var(--borda);border-radius:4px;color:var(--suave);font-family:var(--fonte-d);font-size:0.56rem;cursor:pointer">
          ⚔ Atacar
        </button>
        <div id="animgen-palette" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">
          ${Object.entries(animado.palette || {}).map(([k, v]) =>
            `<div title="${k}: ${v}" style="width:16px;height:16px;border-radius:2px;background:${v};border:1px solid rgba(255,255,255,0.15)"></div>`
          ).join('')}
        </div>
      </div>
    </div>
  </div>

  <div id="animgen-equip-wrap" style="display:${hasData ? 'block' : 'none'}">
    <div style="font-family:var(--fonte-d);font-size:0.54rem;color:var(--destaque);text-transform:uppercase;margin-bottom:8px;letter-spacing:0.06em">⚔ Equipamentos Animados</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${equipSlotsHtml}
    </div>
  </div>
</div>`;
}
