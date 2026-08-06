// characters/anim-generator.js
// Character Animation Generator: Claude Vision API → segmentação de partes por bbox + recorte raster

const ANIM_CHAR_PROMPT = `Analise esta imagem de personagem de pé (corpo inteiro, fundo transparente) e retorne APENAS JSON (sem markdown, sem blocos de código — apenas o objeto JSON começando com {) com as linhas de divisão normalizadas (0.0–1.0) para segmentar o personagem em partes animáveis. As regiões resultantes devem cobrir 100% da imagem sem lacunas ou sobreposições.

{
  "head_y2":   0.22,
  "waist_y":   0.55,
  "arm_l_x":   0.28,
  "arm_r_x":   0.72,
  "leg_mid_x": 0.50,
  "elbow_l_y": 0.40,
  "elbow_r_y": 0.40,
  "knee_l_y":  0.72,
  "knee_r_y":  0.72,
  "pivot_head":        {"x": 0.5,  "y": 0.87},
  "pivot_shoulder_l":  {"x": 0.85, "y": 0.1},
  "pivot_shoulder_r":  {"x": 0.15, "y": 0.1},
  "pivot_elbow_l":     {"x": 0.85, "y": 0.08},
  "pivot_elbow_r":     {"x": 0.15, "y": 0.08},
  "pivot_hip_l":       {"x": 0.85, "y": 0.08},
  "pivot_hip_r":       {"x": 0.15, "y": 0.08},
  "pivot_knee_l":      {"x": 0.85, "y": 0.08},
  "pivot_knee_r":      {"x": 0.15, "y": 0.08}
}

REGRAS:
- Coordenadas: y=0=topo, y=1=base, x=0=esquerda, x=1=direita.
- head_y2: Y da base do pescoço (onde a cabeça termina).
- waist_y: Y da cintura (onde o torso termina, início das pernas).
- arm_l_x: X que separa o braço esquerdo do torso (borda direita do braço esq).
- arm_r_x: X que separa o torso do braço direito (borda esquerda do braço dir).
- leg_mid_x: X que divide a perna esquerda da direita.
- elbow_l_y / elbow_r_y: Y do cotovelo de cada braço (deve estar entre head_y2 e waist_y).
- knee_l_y / knee_r_y: Y do joelho de cada perna (deve estar entre waist_y e 1.0).
- pivot_*: ponto de rotação relativo ao bbox da parte (x,y entre 0 e 1). Cabeça gira pela nuca (y≈0.85). Braços e pernas giram pelo topo (y≈0.1).`;

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

function _buildBboxFromLines(raw) {
  // Clamp all values to valid ranges, preventing negative bbox dimensions
  const hy2 = Math.min(Math.max(+(raw.head_y2  ?? 0.22), 0.05), 0.45);
  const wy  = Math.min(Math.max(+(raw.waist_y  ?? 0.55), hy2 + 0.10), 0.90);
  const alx = Math.min(Math.max(+(raw.arm_l_x  ?? 0.28), 0.05), 0.45);
  const arx = Math.min(Math.max(+(raw.arm_r_x  ?? 0.72), alx + 0.10), 0.95);
  const lmx = Math.min(Math.max(+(raw.leg_mid_x?? 0.50), 0.15), 0.85);
  const ely = Math.min(Math.max(+(raw.elbow_l_y?? 0.40), hy2 + 0.05), wy - 0.05);
  const ery = Math.min(Math.max(+(raw.elbow_r_y?? 0.40), hy2 + 0.05), wy - 0.05);
  const kly = Math.min(Math.max(+(raw.knee_l_y ?? 0.72), wy  + 0.05), 0.95);
  const kry = Math.min(Math.max(+(raw.knee_r_y ?? 0.72), wy  + 0.05), 0.95);
  return {
    head:        { x: 0,   y: 0,   w: 1,       h: hy2       },
    torso:       { x: alx, y: hy2, w: arx-alx, h: wy-hy2   },
    arm_upper_l: { x: 0,   y: hy2, w: alx,     h: ely-hy2  },
    arm_lower_l: { x: 0,   y: ely, w: alx,     h: wy-ely   },
    arm_upper_r: { x: arx, y: hy2, w: 1-arx,   h: ery-hy2  },
    arm_lower_r: { x: arx, y: ery, w: 1-arx,   h: wy-ery   },
    leg_upper_l: { x: 0,   y: wy,  w: lmx,     h: kly-wy   },
    leg_lower_l: { x: 0,   y: kly, w: lmx,     h: 1-kly    },
    leg_upper_r: { x: lmx, y: wy,  w: 1-lmx,   h: kry-wy   },
    leg_lower_r: { x: lmx, y: kry, w: 1-lmx,   h: 1-kry    },
  };
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
      const parts = (e.target as any).result.split(',');
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
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      // bbox is normalized (0–1); convert to pixel coords and clamp to valid range
      const sx = Math.max(0, Math.min(bbox.x * iw, iw - 1));
      const sy = Math.max(0, Math.min(bbox.y * ih, ih - 1));
      const sw = Math.max(1, Math.min(bbox.w * iw, iw - sx));
      const sh = Math.max(1, Math.min(bbox.h * ih, ih - sy));

      const canvas = document.createElement('canvas');
      canvas.width  = targetW * 2;
      canvas.height = targetH * 2;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW * 2, targetH * 2);
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
  const { data, mimeType }: any = await animGenFileToBase64(imageFile);

  const lines = await _animGenApiCall([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data } },
      { type: 'text', text: ANIM_CHAR_PROMPT }
    ]
  }]);

  const CANVAS_W = 120, CANVAS_H = 180;

  // Single full-image crop — all bones share this texture, masked to their regions
  const fullTex = await _animCropPartFromImage(imageFile, { x: 0, y: 0, w: 1, h: 1 }, CANVAS_W, CANVAS_H);

  const bboxes = _buildBboxFromLines(lines);
  const pivotMap = {
    head:        lines.pivot_head        || { x: 0.5,  y: 0.87 },
    torso:       { x: 0.5, y: 0.47 },
    arm_upper_l: lines.pivot_shoulder_l  || { x: 0.85, y: 0.1  },
    arm_lower_l: lines.pivot_elbow_l     || { x: 0.85, y: 0.08 },
    arm_upper_r: lines.pivot_shoulder_r  || { x: 0.15, y: 0.1  },
    arm_lower_r: lines.pivot_elbow_r     || { x: 0.15, y: 0.08 },
    leg_upper_l: lines.pivot_hip_l       || { x: 0.85, y: 0.08 },
    leg_lower_l: lines.pivot_knee_l      || { x: 0.85, y: 0.08 },
    leg_upper_r: lines.pivot_hip_r       || { x: 0.15, y: 0.08 },
    leg_lower_r: lines.pivot_knee_r      || { x: 0.15, y: 0.08 },
  };

  const parts: any = {};
  if (fullTex) parts._full = { texture: fullTex, width: CANVAS_W, height: CANVAS_H };

  for (const boneId of Object.keys(_ANIM_BONE_CFG)) {
    const bbox = bboxes[boneId];
    if (!bbox) continue;
    parts[boneId] = {
      bbox,
      pivot:     pivotMap[boneId],
      zIndex:    _ANIM_PART_ZINDEX[boneId] ?? 5,
      jointWith: _animBoneParentName(boneId)
    };
  }

  return {
    version: 2,
    palette: lines.palette || {},
    style:   lines.style   || 'fantasy',
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
  const { data, mimeType }: any = await animGenFileToBase64(imageFile);

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
      paletteEl.innerHTML = Object.entries<any>(animadoData.palette).map(([k, v]) =>
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

  const isSegLines = ('head_y2' in parsed && 'waist_y' in parsed);
  if (!isSegLines && (!parsed.parts || typeof parsed.parts !== 'object')) {
    mostrarToast('JSON inválido: esperado linhas de segmentação (head_y2, waist_y...) ou campo "parts"', 'erro');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
    return;
  }

  try {
    // v2 with segmentation lines: build full-image + bbox-per-bone from line coordinates
    if (isSegLines) {
      if (!window._animGenSelectedFile) {
        mostrarToast('Selecione a imagem de referência antes de importar o JSON de segmentação', 'aviso');
        if (btn) { btn.disabled = false; btn.textContent = '✅ Carregar Personagem'; }
        return;
      }
      const CANVAS_W = 120, CANVAS_H = 180;
      const fullTex = await _animCropPartFromImage(window._animGenSelectedFile, { x:0, y:0, w:1, h:1 }, CANVAS_W, CANVAS_H);
      const bboxes  = _buildBboxFromLines(parsed);
      const pivotMap = {
        head:        parsed.pivot_head        || { x: 0.5,  y: 0.87 },
        arm_upper_l: parsed.pivot_shoulder_l  || { x: 0.85, y: 0.1  },
        arm_lower_l: parsed.pivot_elbow_l     || { x: 0.85, y: 0.08 },
        arm_upper_r: parsed.pivot_shoulder_r  || { x: 0.15, y: 0.1  },
        arm_lower_r: parsed.pivot_elbow_r     || { x: 0.15, y: 0.08 },
        leg_upper_l: parsed.pivot_hip_l       || { x: 0.85, y: 0.08 },
        leg_lower_l: parsed.pivot_knee_l      || { x: 0.85, y: 0.08 },
        leg_upper_r: parsed.pivot_hip_r       || { x: 0.15, y: 0.08 },
        leg_lower_r: parsed.pivot_knee_r      || { x: 0.15, y: 0.08 },
      };
      const parts: any   = {};
      if (fullTex) parts._full = { texture: fullTex, width: CANVAS_W, height: CANVAS_H };
      for (const boneId of Object.keys(_ANIM_BONE_CFG)) {
        const bbox = bboxes[boneId];
        if (!bbox) continue;
        parts[boneId] = {
          bbox,
          pivot:     pivotMap[boneId] || { x: 0.5, y: 0.1 },
          zIndex:    _ANIM_PART_ZINDEX[boneId] ?? 5,
          jointWith: _animBoneParentName(boneId)
        };
      }
      parsed.parts   = parts;
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
      paletteEl.innerHTML = Object.entries<any>(animadoData.palette).map(([k, v]) =>
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
          ${Object.entries<any>(animado.palette || {}).map(([k, v]) =>
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

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "ANIM_CHAR_PROMPT", { configurable: true, get: () => ANIM_CHAR_PROMPT });
Object.defineProperty(globalThis, "ANIM_EQUIP_PROMPT_TPL", { configurable: true, get: () => ANIM_EQUIP_PROMPT_TPL });
Object.defineProperty(globalThis, "ANIM_DEFAULTS", { configurable: true, get: () => ANIM_DEFAULTS });
Object.defineProperty(globalThis, "ANIM_SKELETON", { configurable: true, get: () => ANIM_SKELETON });
Object.defineProperty(globalThis, "_ANIM_PART_ZINDEX", { configurable: true, get: () => _ANIM_PART_ZINDEX });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animBoneParentName", { configurable: true, get: () => _animBoneParentName, set: (__v) => { _animBoneParentName = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_buildBboxFromLines", { configurable: true, get: () => _buildBboxFromLines, set: (__v) => { _buildBboxFromLines = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenGetApiKey", { configurable: true, get: () => animGenGetApiKey, set: (__v) => { animGenGetApiKey = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenSetApiKey", { configurable: true, get: () => animGenSetApiKey, set: (__v) => { animGenSetApiKey = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenFileToBase64", { configurable: true, get: () => animGenFileToBase64, set: (__v) => { animGenFileToBase64 = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenFileToDataUrl", { configurable: true, get: () => animGenFileToDataUrl, set: (__v) => { animGenFileToDataUrl = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animCropPartFromImage", { configurable: true, get: () => _animCropPartFromImage, set: (__v) => { _animCropPartFromImage = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_animGenApiCall", { configurable: true, get: () => _animGenApiCall, set: (__v) => { _animGenApiCall = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenFromImage", { configurable: true, get: () => animGenFromImage, set: (__v) => { animGenFromImage = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenEquipFromImage", { configurable: true, get: () => animGenEquipFromImage, set: (__v) => { animGenEquipFromImage = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenHandleImageSelect", { configurable: true, get: () => animGenHandleImageSelect, set: (__v) => { animGenHandleImageSelect = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenHandleGenerate", { configurable: true, get: () => animGenHandleGenerate, set: (__v) => { animGenHandleGenerate = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenHandleEquipImage", { configurable: true, get: () => animGenHandleEquipImage, set: (__v) => { animGenHandleEquipImage = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenSetPreviewAnim", { configurable: true, get: () => animGenSetPreviewAnim, set: (__v) => { animGenSetPreviewAnim = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenCopiarPromptPersonagem", { configurable: true, get: () => animGenCopiarPromptPersonagem, set: (__v) => { animGenCopiarPromptPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenCopiarPromptEquip", { configurable: true, get: () => animGenCopiarPromptEquip, set: (__v) => { animGenCopiarPromptEquip = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenImportarJSON", { configurable: true, get: () => animGenImportarJSON, set: (__v) => { animGenImportarJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenToggleImport", { configurable: true, get: () => animGenToggleImport, set: (__v) => { animGenToggleImport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenToggleEquipImport", { configurable: true, get: () => animGenToggleEquipImport, set: (__v) => { animGenToggleEquipImport = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "animGenImportarEquipJSON", { configurable: true, get: () => animGenImportarEquipJSON, set: (__v) => { animGenImportarEquipJSON = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_apmodTabAnimado", { configurable: true, get: () => _apmodTabAnimado, set: (__v) => { _apmodTabAnimado = __v; } });
