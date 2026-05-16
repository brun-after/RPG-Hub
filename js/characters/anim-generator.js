// characters/anim-generator.js
// Character Animation Generator: Claude Vision API → Pixel Art SVG por parte do corpo

const ANIM_CHAR_PROMPT = `You are a pixel art generator for a 2D RPG game. Analyze this character image carefully.

Return ONLY valid JSON (no markdown, no code blocks, no extra text — just the raw JSON object starting with {):
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
    "head": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>RECTS</svg>",
    "torso": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 24'>RECTS</svg>",
    "arm_upper_l": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "arm_lower_l": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "arm_upper_r": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "arm_lower_r": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "leg_upper_l": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "leg_lower_l": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "leg_upper_r": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>",
    "leg_lower_r": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'>RECTS</svg>"
  }
}

STRICT RULES for pixel art SVGs:
- Use ONLY <rect> elements at integer x,y with width=1 height=1 (or small multiples)
- Fill each SVG completely — no transparent areas at the edges
- head (16x16): face with eyes, nose, mouth, hair — character facing FORWARD
- torso (16x24): full chest/shirt/armor — wide at shoulders, narrower at waist
- arm parts (8x12): single arm segment — arm_upper is sleeve/shoulder, arm_lower is forearm/hand
- leg parts (8x12): single leg segment — leg_upper is thigh, leg_lower is shin+boot
- arm_upper_r and arm_upper_l should mirror each other in color (can be same)
- Use the character's EXACT colors extracted from the palette
- Outline the shapes with the "outline" color at edges
- NO whitespace, NO newlines inside SVG strings`;

const ANIM_EQUIP_PROMPT_TPL = (slot) => `You are a pixel art generator for a 2D RPG game. Analyze this equipment image.

Return ONLY valid JSON (no markdown):
{
  "svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 32'>RECTS</svg>",
  "palette": { "main": "#hex", "edge": "#hex", "grip": "#hex" },
  "rotation_hint": -15
}

Equipment slot: ${slot}
Rules:
- Use ONLY <rect> elements at integer positions
- For weapons (sword/axe/spear): viewBox 0 0 16 32, blade at top, grip at bottom
- For shields: viewBox 0 0 16 20
- For helmets: viewBox 0 0 14 12
- For other slots: viewBox 0 0 16 16
- rotation_hint: suggested rotation in degrees for visual placement (-15 for swords, 0 for shields)
- Match the equipment's colors from the image exactly`;

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

  return {
    version: 1,
    palette: result.palette || {},
    style: result.style || 'fantasy',
    parts: result.parts || {},
    skeleton: ANIM_SKELETON,
    animations: ANIM_DEFAULTS,
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
      if (window._apmodAnimCtrl) { window._apmodAnimCtrl.destroy(); window._apmodAnimCtrl = null; }
      window._apmodAnimCtrl = animRendererMount(canvasWrap, animadoData, { width: 120, height: 180, animName: 'idle' });
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
    if (window._apmodAnimCtrl) {
      animRendererUpdateEquipment(window._apmodAnimCtrl, slot, equipData);
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
  if (!window._apmodAnimCtrl) return;
  window._apmodAnimCtrl.setAnimation(animName);

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

function animGenImportarJSON() {
  const ta = document.getElementById('animgen-import-json');
  if (!ta || !ta.value.trim()) { mostrarToast('Cole o JSON gerado pela IA na área de texto', 'aviso'); return; }

  let raw = ta.value.trim();
  // Strip markdown code blocks if present
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed;
  try { parsed = JSON.parse(raw); } catch(e) { mostrarToast('JSON inválido: ' + e.message, 'erro'); return; }

  if (!parsed.parts || typeof parsed.parts !== 'object') {
    mostrarToast('JSON não contém o campo "parts" com as partes do corpo', 'erro');
    return;
  }

  // Build full animado object merging with defaults
  const animadoData = {
    version: 1,
    palette: parsed.palette || {},
    style: parsed.style || 'fantasy',
    parts: parsed.parts,
    animations: ANIM_DEFAULTS,
    equipment_slots: window._apmodAnimado?.equipment_slots || {
      weapon_r: null, shield: null, helmet: null, chest_armor: null,
      cape: null, glove_r: null, boot_l: null, boot_r: null
    }
  };

  window._apmodAnimado = animadoData;
  window._apmodOriginalStale = true;
  window._apmodLastBaseTab = 'animado';
  ta.value = '';

  // Show preview
  const previewWrap = document.getElementById('animgen-preview-wrap');
  const equipWrap = document.getElementById('animgen-equip-wrap');
  if (previewWrap) previewWrap.style.display = 'block';
  if (equipWrap) equipWrap.style.display = 'block';

  // Show palette swatches
  const paletteEl = document.getElementById('animgen-palette');
  if (paletteEl && animadoData.palette) {
    paletteEl.innerHTML = Object.entries(animadoData.palette).map(([k, v]) =>
      `<div title="${k}: ${v}" style="width:18px;height:18px;border-radius:3px;background:${v};border:1px solid rgba(255,255,255,0.2)"></div>`
    ).join('');
  }

  // Mount renderer
  const canvasWrap = document.getElementById('animgen-canvas-wrap');
  if (canvasWrap) {
    if (window._apmodAnimCtrl) { window._apmodAnimCtrl.destroy(); window._apmodAnimCtrl = null; }
    window._apmodAnimCtrl = animRendererMount(canvasWrap, animadoData, { width: 120, height: 180, animName: 'idle' });
  }

  mostrarToast('Personagem importado! Salvando...', 'ok');

  // Auto-salvar imediatamente para garantir persistência — o usuário não
  // precisa lembrar de clicar "Salvar" após o import.
  if (typeof apmodSalvar === 'function' && window._apmodNome) {
    apmodSalvar(window._apmodNome);
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
  if (window._apmodAnimCtrl) animRendererUpdateEquipment(window._apmodAnimCtrl, slot, equipData);

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
    Envie uma imagem e a IA criará pixel art animado do personagem — com partes separadas que se movem ao andar e atacar.
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
      <div style="font-family:var(--fonte-d);font-size:0.52rem;color:var(--suave);line-height:1.6;margin-bottom:8px">
        1. Copie o prompt abaixo → cole em ChatGPT, Gemini, Claude.ai ou outra IA com suporte a imagem → anexe a foto do personagem → cole o JSON retornado aqui.
      </div>
      <button onclick="animGenCopiarPromptPersonagem()"
        style="width:100%;padding:7px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.35);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;margin-bottom:8px">
        📋 Copiar Prompt do Personagem
      </button>
      <textarea id="animgen-import-json" placeholder="Cole aqui o JSON retornado pela IA..."
        style="width:100%;box-sizing:border-box;height:90px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;padding:6px 8px;color:var(--texto);font-family:monospace;font-size:0.56rem;resize:vertical;margin-bottom:6px"></textarea>
      <button onclick="animGenImportarJSON()"
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
