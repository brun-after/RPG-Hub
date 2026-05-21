// js/systems/aventura.js
// Aventura mode — solo/small-group top-down dungeon, tactical-pause combat
// rpg_registry { is_aventura: true, theme_json.dungeon_data } + characters + skills

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

var AVT_STATE = {
  rpgId: null,
  rpg: null,
  chars: [],
  skills: [],
  dungeon: null,           // { tiles[][], w, h, rooms[] }
  entidades: [],           // [{ id, nome, x, y, hp, hpMax, tipo, cor, pacienciaSecs, deteccaoRaio, isBoss }]
  batalhas: [],           // Array of active combat objects (multiple simultaneous combats)
  batalhaAutoSuspensa: false,
  alvoSelecionado: null,   // entId do alvo selecionado pelo clique no canvas
  _fleeTracker: {},        // { entId: { pursuing, pursuitTurnsLeft, prevDist } }
  mestreReposicionando: null, // entId being repositioned by master
  canvas: null,
  ctx: null,
  camera: { x: 0, y: 0, zoom: 1 },
  animFrame: null,
  _pendingTimeouts: [],
  _resizeObs: null,
  // GM / master
  isMestre: false,
  mestreAtivo: false,      // mestre em modo controle total (pode mover todos os personagens)
  npcIaAtiva: true,
  npcControlando: null,
  mestreVisaoGeral: false,
  mestrePainelAba: 'modo',
  // player assignment
  myCharNome: null,        // nome do personagem vinculado ao usuário atual
  membros: [],             // rpg_members carregados (para atribuição)
  // patience timers (per enemy)
  npcTimers: {},           // { entId: { patience: ms, maxPatience: ms, ativo: bool } }
  _lastFrameTs: 0,
  // character editor
  charEditorId: null,
  charEditorTab: 'attrs',
  // appearance / animation rendering (token sprites)
  aparencias: {},   // entId -> { parts, animations, partImgs: {key: Image}, loaded }
  entAnim: {},      // entId -> { state, stateStart, lastX, lastY, walkUntil, attackUntil, facing }
  _criando: {
    nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
    personagens: [], importCampanhaId: null,
    mapa: null,            // dungeon object chosen in step 3
    mapaOpcao: null,       // 'procedural'|'editor'|'json'|'claude'|'fase'
    faseId: null,          // selected fase id (opção 'fase')
    etapa: 0,
    _modoEscolha: null     // 'completa' | 'manual'
  },
  _novaFaseWizard: null,   // wizard state for creating extra phases
  _modoPortaPlacement: false, // when true, next map click sets door position
  _faseAnterior: null,     // saved dungeon to return to from extra phase
  itemCatalog: []          // item_catalog loaded for this adventure
};

const AVT_T  = { PAREDE: 0, PISO: 1, SAIDA: 2 };
const AVT_SZ = 48;

// Prompts para token top-down IA
const AVT_TOPDOWN_GEN_PROMPT = (desc) => `Crie um token RPG top-down (visão de cima, bird's-eye view) para: ${desc || 'um personagem RPG'}.
Estilo: pixel art ou pintado à mão, fundo TRANSPARENTE (PNG).
Resolução: qualquer — o engine reescala proporcionalmente. Prefira imagem aproximadamente quadrada (1:1) com o personagem centralizado e ocupando boa parte do quadro.
Perspectiva: estritamente top-down — câmera diretamente acima do personagem.
Mostre: topo da cabeça (cabelo/capacete), ombros, arma/equipamento segurado para o lado, pés levemente visíveis.
Silhueta clara e legível mesmo quando reduzida (o token será exibido pequeno no mapa).
SEM fundo, SEM sombra projetada (será adicionada pelo engine).
Use cores adequadas para um personagem de RPG.`;

const AVT_TOPDOWN_COORD_PROMPT = `Analise esta imagem de token RPG vista de cima (top-down, bird's-eye view, fundo transparente) e retorne APENAS JSON (sem markdown, sem blocos de código — apenas o objeto JSON começando com {) com as coordenadas normalizadas (0.0–1.0) das regiões visuais para animação.

{
  "body_cx": 0.50,
  "body_cy": 0.55,
  "body_r":  0.30,
  "head_cx": 0.50,
  "head_cy": 0.28,
  "head_r":  0.18,
  "weapon_cx": 0.72,
  "weapon_cy": 0.60,
  "weapon_r":  0.10,
  "legs_cy":   0.75,
  "legs_r":    0.12,
  "shadow_y":  0.88,
  "pivot_x":   0.50,
  "pivot_y":   0.50
}

REGRAS:
- x=0=esquerda, x=1=direita, y=0=topo, y=1=base.
- body_cx/cy: centro do corpo/torso visto de cima.
- body_r: raio do corpo como fração da largura da imagem.
- head_cx/cy: centro da cabeça (topo da figura).
- head_r: raio da cabeça.
- weapon_cx/cy: centro da arma ou membro estendido (0.5/0.5 se não visível).
- weapon_r: tamanho do elemento arma (0 se ausente).
- legs_cy: y da região de pernas/base.
- legs_r: raio da região de pernas.
- shadow_y: y onde a sombra tocaria o chão (geralmente 0.85–0.95).
- pivot_x/y: ponto de rotação do token para animação.`;

// Presets de aparência para NPCs e Bosses genéricos
const AVT_NPC_PRESETS = {
  goblin:    { nome:'Goblin',    icone:'G', cor:'#3a7a20', hpBase:12, pacienciaSecs:5, deteccaoRaio:3, xpBase:10 },
  esqueleto: { nome:'Esqueleto', icone:'S', cor:'#7a8090', hpBase:15, pacienciaSecs:6, deteccaoRaio:3, xpBase:10 },
  orc:       { nome:'Orc',       icone:'O', cor:'#6a3010', hpBase:25, pacienciaSecs:4, deteccaoRaio:4, xpBase:10 },
  troll:     { nome:'Troll',     icone:'T', cor:'#405c30', hpBase:40, pacienciaSecs:7, deteccaoRaio:4, xpBase:10 },
  vampiro:   { nome:'Vampiro',   icone:'V', cor:'#4a0a2a', hpBase:30, pacienciaSecs:3, deteccaoRaio:5, xpBase:10 },
  cultista:  { nome:'Cultista',  icone:'C', cor:'#2a1a5a', hpBase:18, pacienciaSecs:5, deteccaoRaio:3, xpBase:10 },
  boss:      { nome:'Boss',      icone:'☠', cor:'#4a0000', hpBase:100, pacienciaSecs:1, deteccaoRaio:6, isBoss:true, xpBase:50 },
};

// Mapeamento preset → modelo de criatura SVG (CREATURE_MODELS de appearance.js)
const AVT_PRESET_TO_CREATURE = {
  goblin: 'goblin', esqueleto: 'esqueleto', orc: 'goblin',
  troll: 'goblin', vampiro: 'demonio', cultista: 'demonio',
  boss: 'demonio', npc_generico: 'npc_generico'
};

// Varia levemente a cor em ±15 por semente determinística
function _hexVary(hex, seed) {
  const parse = (s, o) => parseInt(s.slice(o, o+2), 16);
  const r = parse(hex, 1), g = parse(hex, 3), b = parse(hex, 5);
  const v = (seed * 17 + 7) % 31 - 15;
  const clamp = x => Math.max(0, Math.min(255, x));
  return '#' + [clamp(r+v), clamp(g+v), clamp(b+v)].map(x => x.toString(16).padStart(2,'0')).join('');
}

// Cache e carregamento de imagens SVG de criaturas para o canvas
function _avtGetCreatureImg(tipo, cor) {
  if (!AVT_STATE._creatureImgCache) AVT_STATE._creatureImgCache = {};
  const key = tipo + '_' + cor;
  if (AVT_STATE._creatureImgCache[key]) return AVT_STATE._creatureImgCache[key];
  const model = (typeof CREATURE_MODELS !== 'undefined') && CREATURE_MODELS[tipo];
  if (!model) return null;
  try {
    const svg = model.iso ? model.iso(cor) : (model.head ? model.head(cor) : null);
    if (!svg) return null;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    AVT_STATE._creatureImgCache[key] = img;
    return img;
  } catch(e) { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function _avtSb(path, opts) { return sb(path, opts); }

async function aventuraCarregarLista() {
  try {
    const all = await _avtSb('rpg_registry?select=*&order=name');
    if (!all) return [];
    return all.filter(r => r.is_aventura === true || r.theme_json?.is_aventura === true);
  } catch(e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUB
// ─────────────────────────────────────────────────────────────────────────────

async function avtHubRenderSection() {
  const lista = document.getElementById('avt-hub-lista');
  if (!lista) return;
  lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0">Carregando…</div>';
  const aventuras = await aventuraCarregarLista();
  if (!aventuras.length) {
    lista.innerHTML = '<div style="color:#7a92aa;font-size:0.75rem;padding:8px 0;font-style:italic">Nenhum dungeon ainda.</div>';
    return;
  }
  lista.innerHTML = aventuras.map(r => {
    const t = r.theme_json || {};
    const cor = t.destaque || '#c8a84b';
    const rid = r.rpg_id.replace(/'/g, "\\'");
    return `<div class="avt-card" onclick="entrarAventura('${rid}')" style="--avt-acc:${cor}">
      <div class="avt-card-ico"><svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M13 3 L21 7 L21 19 L13 23 L5 19 L5 7Z" stroke="${cor}" stroke-width="1.2" fill="none"/>
        <path d="M9 13 L17 13 M13 9 L13 17" stroke="${cor}" stroke-width="1.5"/></svg></div>
      <div class="avt-card-info">
        <div class="avt-card-nome" style="color:${cor}">${r.name}</div>
        <div class="avt-card-sub">Dungeon</div>
      </div>
      <div class="avt-card-arr">→</div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// CRIAR AVENTURA — 3-step wizard
// ─────────────────────────────────────────────────────────────────────────────

function abrirCriarAventura() {
  AVT_STATE._criando = {
    nome: '', cor: '#c8a84b', cor2: '#4fa3d1', icone: 'sword',
    personagens: [{ nome: '', hp_max: 60, cor: '#4fa3d1', descricao: '' }],
    importCampanhaId: null, mapa: null, mapaOpcao: null, faseId: null, etapa: 0, _modoEscolha: null,
    _tilesetConfig: null, _tilesetImgFile: null, _tilesetImgUrl: null,
    _habilidadesGeradasIA: null, _extCampanhaJSON: null
  };
  document.getElementById('hub').style.display = 'none';
  document.getElementById('aventura-criar-screen').style.display = 'flex';
  _avtCriarRenderEtapa();
}

function fecharCriarAventura() {
  document.getElementById('aventura-criar-screen').style.display = 'none';
  document.getElementById('hub').style.display = 'block';
}

function _avtCriarRenderEtapa() {
  const c = AVT_STATE._criando;
  const body = document.getElementById('avt-criar-body');
  if (!body) return;

  const TOTAL = 4;
  const dotsTotal = c._modoEscolha === 'completa' ? 2 : TOTAL;
  const dots = document.getElementById('avt-criar-dots');
  if (dots) dots.innerHTML = Array.from({length: dotsTotal}, (_, i) =>
    `<div class="criar-step-dot ${i===c.etapa?'ativo':i<c.etapa?'feito':''}"></div>`
  ).join('');

  const btnPrev = document.getElementById('avt-criar-btn-prev');
  const btnNext = document.getElementById('avt-criar-btn-next');
  if (btnPrev) btnPrev.style.display = c.etapa > 0 ? '' : 'none';
  if (btnNext) {
    const isLast = c.etapa === TOTAL - 1;
    btnNext.textContent = isLast ? '▶ Iniciar Dungeon!' : 'Próximo →';
    btnNext.onclick = isLast ? aventuraCriarSubmit : _avtCriarAvancar;
  }

  body.scrollTop = 0;
  if (c.etapa === 0) _avtCriarRenderModoEscolha(body);
  else if (c.etapa === 1) _avtCriarRenderIdentidade(body);
  else if (c.etapa === 2) _avtCriarRenderPersonagens(body);
  else _avtCriarRenderMapa(body);
}

// ── ETAPA 0: Escolha de modo ─────────────────────────────────────────────────
function _avtCriarRenderModoEscolha(body) {
  const c = AVT_STATE._criando;
  body.innerHTML = `
    <div class="etapa-titulo">Como deseja criar?</div>
    <div class="etapa-desc">Escolha o modo de criação do seu dungeon.</div>
    <div onclick="AVT_STATE._criando._modoEscolha='completa';_avtCriarRenderEtapa()"
      style="margin-bottom:12px;padding:14px 16px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:12px;
             background:rgba(79,163,209,0.07);border:2px solid ${c._modoEscolha==='completa'?'#4fa3d1':'rgba(79,163,209,0.25)'};transition:border-color .15s">
      <span style="font-size:1.5rem">🌐</span>
      <div>
        <div style="font-family:var(--fonte-d);color:#c8a84b;font-size:0.85rem;margin-bottom:3px">Criação completa (IA externa)</div>
        <div style="font-size:0.72rem;color:#7a92aa">Envie um prompt para qualquer IA e cole o JSON — gera personagens + dungeon em um só passo</div>
      </div>
    </div>
    <div onclick="AVT_STATE._criando._modoEscolha='manual';_avtCriarRenderEtapa()"
      style="padding:14px 16px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:12px;
             background:rgba(200,168,75,0.07);border:2px solid ${c._modoEscolha==='manual'?'#c8a84b':'rgba(200,168,75,0.25)'};transition:border-color .15s">
      <span style="font-size:1.5rem">✏️</span>
      <div>
        <div style="font-family:var(--fonte-d);color:#c8a84b;font-size:0.85rem;margin-bottom:3px">Criação passo a passo</div>
        <div style="font-size:0.72rem;color:#7a92aa">Configure nome, personagens e mapa manualmente</div>
      </div>
    </div>`;
}

// ── ETAPA 1: Identidade ───────────────────────────────────────────────────────
function _avtCriarRenderIdentidade(body) {
  const c = AVT_STATE._criando;
  body.innerHTML = `
    <div class="etapa-titulo">Identidade do Dungeon</div>
    <div class="etapa-desc">Nome e cor do seu dungeon.</div>
    <div class="criar-field">
      <label>Nome *</label>
      <input class="criar-input" id="avt-c-nome" value="${c.nome}" placeholder="Ex: A Cripta Esquecida" maxlength="60">
    </div>
    <div class="criar-field">
      <label>Cor principal</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${['#c8a84b','#4fa3d1','#7b2fbe','#27ae60','#e8604c','#e67e22'].map(cor =>
          `<div onclick="avtCriarSetCor('${cor}')"
            style="width:28px;height:28px;border-radius:50%;background:${cor};cursor:pointer;
                   border:2px solid ${c.cor===cor?'#fff':'transparent'};transition:border-color .15s"></div>`
        ).join('')}
        <input type="color" value="${c.cor}" oninput="avtCriarSetCor(this.value)"
          style="width:28px;height:28px;border-radius:50%;border:none;padding:0;cursor:pointer;background:none">
      </div>
    </div>`;
}

// ── ETAPA 1: Personagens ──────────────────────────────────────────────────────
function _avtCriarRenderPersonagens(body) {
  const c = AVT_STATE._criando;
  const campanhas = (HUB_DATA?.rpgs || [])
    .filter(r => !r.is_arena && !r.is_aventura && !(r.theme_json?.is_aventura));
  const savedKey = localStorage.getItem('animgen_claude_key') || '';
  body.innerHTML = `
    <div class="etapa-titulo">Personagens</div>
    <div class="etapa-desc">Adicione seus heróis — ou importe de uma campanha.</div>
    ${campanhas.length ? `
    <div class="criar-field" style="margin-bottom:16px">
      <label>Importar de campanha (opcional)</label>
      <select id="avt-import-camp" onchange="avtCriarImportCampanha(this.value)"
        style="width:100%;padding:8px;background:#0a0f18;border:1px solid var(--borda);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem">
        <option value="">— Criar do zero —</option>
        ${campanhas.map(r => `<option value="${r.rpg_id}" ${c.importCampanhaId===r.rpg_id?'selected':''}>${r.name}</option>`).join('')}
      </select>
    </div>` : ''}
    <div id="avt-chars-lista">${_avtCriarRenderCharsLista()}</div>
    <button onclick="avtCriarAddChar()"
      style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px dashed rgba(255,255,255,0.2);background:transparent;color:#7a92aa;cursor:pointer;font-size:0.78rem">
      + Adicionar personagem
    </button>
    <div style="margin-top:18px;padding:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px">
      <div style="font-size:0.72rem;color:#c8a84b;font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">⚡ Gerar personagens com IA</div>
      <div style="font-size:0.72rem;color:#7a92aa;margin-bottom:10px">Balanceia personagens com base no dungeon. Os campos de descrição acima são enviados à IA.</div>

      <!-- IA externa -->
      <div style="margin-bottom:10px;padding:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(200,168,75,0.2);border-radius:6px">
        <div style="font-size:0.68rem;color:#c8a84b;font-weight:600;margin-bottom:6px">🌐 Via IA externa (Claude.ai, ChatGPT…)</div>
        <div style="font-size:0.67rem;color:#7a92aa;margin-bottom:8px;line-height:1.5">Copie o prompt, abra qualquer IA e descreva os personagens na conversa. Cole o JSON retornado abaixo.</div>
        <button onclick="_avtCopiarPromptPersonagensExterno()"
          style="width:100%;padding:6px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
          📋 Copiar prompt para IA externa
        </button>
        <textarea id="avt-chars-ext-json" rows="4" placeholder='Cole aqui o JSON retornado pela IA…'
          style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(10,15,24,0.8);border:1px solid rgba(200,168,75,0.15);border-radius:5px;color:#c8d8e8;font-family:monospace;font-size:0.63rem;resize:vertical;line-height:1.4"
          oninput="_avtAplicarPersonagensExterno(this.value)"></textarea>
        <div id="avt-chars-ext-status" style="margin-top:4px;font-size:0.68rem"></div>
      </div>

      <!-- Claude API direto -->
      <div style="padding:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(79,163,209,0.15);border-radius:6px">
        <div style="font-size:0.68rem;color:#4fa3d1;font-weight:600;margin-bottom:6px">⚡ Via Claude API (direto)</div>
        <div class="criar-field" style="margin-bottom:8px">
          <label style="font-size:0.65rem">Claude API Key</label>
          <input id="avt-chars-claude-key" type="password" value="${savedKey}" placeholder="sk-ant-…"
            style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;padding:6px 10px;font-family:monospace;font-size:0.78rem"
            oninput="localStorage.setItem('animgen_claude_key',this.value)">
        </div>
        <button onclick="_avtGerarPersonagensComIA()"
          style="width:100%;padding:8px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em">
          ⚡ Gerar personagens com IA
        </button>
        <div id="avt-chars-ia-status" style="margin-top:6px;font-size:0.72rem;color:#7a92aa"></div>
      </div>
    </div>`;
}

function _avtCriarRenderCharsLista() {
  return AVT_STATE._criando.personagens.map((p, i) => `
    <div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${p.cor||'#4fa3d1'};flex-shrink:0"></div>
        <input style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                      border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;font-family:inherit"
          placeholder="Nome do personagem" value="${p.nome}"
          oninput="AVT_STATE._criando.personagens[${i}].nome=this.value">
        <input type="number" min="10" max="999" value="${p.hp_max}"
          style="width:60px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                 border-radius:5px;color:#fff;padding:5px 8px;font-size:0.82rem;text-align:center"
          title="HP máx" oninput="AVT_STATE._criando.personagens[${i}].hp_max=+this.value||60">
        <span style="font-size:0.65rem;color:#7a92aa">HP</span>
        <select onchange="AVT_STATE._criando.personagens[${i}].classe_aventura=this.value"
          style="padding:4px 6px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
          <option value="guerreiro" ${(p.classe_aventura||'guerreiro')==='guerreiro'?'selected':''}>⚔ Guerreiro</option>
          <option value="mago" ${p.classe_aventura==='mago'?'selected':''}>🔮 Mago</option>
        </select>
        ${i > 0 ? `<button onclick="avtCriarRemChar(${i})"
          style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:0.9rem;padding:2px 4px">✕</button>` : ''}
      </div>
      <input style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
                    border-radius:5px;color:#c8d8e8;padding:5px 8px;font-size:0.75rem;font-family:inherit"
        placeholder="Descrição para a IA (ex: guerreiro anão focado em defesa e escudos...)" value="${p.descricao||''}"
        oninput="AVT_STATE._criando.personagens[${i}].descricao=this.value">
    </div>`).join('');
}

// ── ETAPA 3: Mapa ─────────────────────────────────────────────────────────────
function _avtCriarRenderMapa(body) {
  const c = AVT_STATE._criando;

  // In completa mode: go directly to ia_externa subpanel
  if (c._modoEscolha === 'completa') {
    c.mapaOpcao = 'ia_externa';
    body.innerHTML = `<div class="etapa-titulo">Campanha Completa (IA Externa)</div>
      <div id="avt-mapa-sub"></div>`;
    _avtCriarRenderMapaSub('ia_externa');
    return;
  }

  // Detect if source campaign has fases
  const temFases = !!(c._fasesDisponiveis?.length);

  body.innerHTML = `
    <div class="etapa-titulo">Mapa do Dungeon</div>
    <div class="etapa-desc">Como quer criar o mapa?</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div class="avt-mapa-opcao ${c.mapaOpcao==='editor'?'selecionado':''}" onclick="avtCriarSelecionarMapa('editor')">
        <div class="avt-mapa-opcao-ico">✏</div>
        <div class="avt-mapa-opcao-titulo">Editor manual</div>
        <div class="avt-mapa-opcao-desc">Desenhe o mapa célula por célula</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='json'?'selecionado':''}" onclick="avtCriarSelecionarMapa('json')">
        <div class="avt-mapa-opcao-ico">📋</div>
        <div class="avt-mapa-opcao-titulo">Importar JSON (IA)</div>
        <div class="avt-mapa-opcao-desc">Cole JSON gerado por IA externa</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='claude'?'selecionado':''}" onclick="avtCriarSelecionarMapa('claude')">
        <div class="avt-mapa-opcao-ico">⚡</div>
        <div class="avt-mapa-opcao-titulo">Gerar com Claude</div>
        <div class="avt-mapa-opcao-desc">Descreva e gere via Claude API</div>
      </div>
      <div class="avt-mapa-opcao ${c.mapaOpcao==='procedural'?'selecionado':''}" onclick="avtCriarSelecionarMapa('procedural')">
        <div class="avt-mapa-opcao-ico">🎲</div>
        <div class="avt-mapa-opcao-titulo">Dungeon procedural</div>
        <div class="avt-mapa-opcao-desc">Gerar dungeon aleatória automática</div>
      </div>
    </div>

    <div class="avt-mapa-opcao ${c.mapaOpcao==='ia_externa'?'selecionado':''}" onclick="avtCriarSelecionarMapa('ia_externa')"
      style="grid-column:1/-1;display:flex;align-items:center;gap:12px">
      <span style="font-size:1.2rem">🌐</span>
      <div>
        <div class="avt-mapa-opcao-titulo">Criar campanha com IA externa</div>
        <div class="avt-mapa-opcao-desc">Copie o prompt, converse com qualquer IA e cole o JSON — gera personagens + dungeon em um só passo</div>
      </div>
    </div>

    <div class="avt-mapa-opcao ${c.mapaOpcao==='ia_fase'?'selecionado':''}" onclick="avtCriarSelecionarMapa('ia_fase')"
      style="grid-column:1/-1;display:flex;align-items:center;gap:12px">
      <span style="font-size:1.2rem">🎨</span>
      <div>
        <div class="avt-mapa-opcao-titulo">Tileset por IA (só mapa visual)</div>
        <div class="avt-mapa-opcao-desc">Gere blocos visuais com IA de imagem e aplique ao mapa (personagens configurados manualmente)</div>
      </div>
    </div>

    ${temFases ? `
    <div class="avt-mapa-opcao ${c.mapaOpcao==='fase'?'selecionado':''}" onclick="avtCriarSelecionarMapa('fase')"
      style="grid-column:1/-1;display:flex;align-items:center;gap:12px">
      <span style="font-size:1.2rem">🗺</span>
      <div>
        <div class="avt-mapa-opcao-titulo">Usar fase existente</div>
        <div class="avt-mapa-opcao-desc">Aproveitar uma fase salva da campanha importada</div>
      </div>
    </div>` : ''}

    <div id="avt-mapa-sub" style="margin-top:14px"></div>`;

  if (c.mapaOpcao) _avtCriarRenderMapaSub(c.mapaOpcao);
}

function avtCriarSelecionarMapa(opcao) {
  AVT_STATE._criando.mapaOpcao = opcao;
  AVT_STATE._criando.mapa = null;
  // Re-render just the option cards + sub panel
  const body = document.getElementById('avt-criar-body');
  if (body) _avtCriarRenderMapa(body);
}

function _avtCriarRenderMapaSub(opcao) {
  const sub = document.getElementById('avt-mapa-sub');
  if (!sub) return;
  const c = AVT_STATE._criando;

  if (opcao === 'procedural') {
    sub.innerHTML = `
      <div style="padding:12px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:8px">
        <div style="font-size:0.78rem;color:#c8d8e8;margin-bottom:10px">Dungeon gerada proceduralmente (BSP). Quantidade de salas:</div>
        <div style="display:flex;align-items:center;gap:10px">
          <input id="avt-proc-salas" type="range" min="3" max="50" value="8" style="flex:1;accent-color:#4fa3d1"
            oninput="document.getElementById('avt-proc-salas-val').textContent=this.value;AVT_STATE._criando._procSalas=+this.value">
          <span id="avt-proc-salas-val" style="font-family:var(--fonte-d);font-size:0.85rem;color:#c8a84b;min-width:28px;text-align:right">8</span>
          <span style="font-size:0.68rem;color:#7a92aa">salas</span>
        </div>
        <div style="font-size:0.68rem;color:#7a92aa;margin-top:8px">O tamanho do grid cresce automaticamente com o número de salas. Nomes e tipos de inimigos podem ser ajustados após entrar no mapa.</div>
      </div>`;
    AVT_STATE._criando._procSalas = 8;
    AVT_STATE._criando.mapa = 'procedural';

  } else if (opcao === 'editor') {
    sub.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:0.7rem;color:#7a92aa">Tamanho:</span>
        <select id="avt-ed-tamanho" onchange="_avtEditorTamanho(this.value)"
          style="padding:4px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.7rem">
          <option value="22x16">Pequena (22×16 — ~5 salas)</option>
          <option value="40x28">Média (40×28 — ~12 salas)</option>
          <option value="60x40" selected>Grande (60×40 — ~25 salas)</option>
          <option value="80x56">Enorme (80×56 — ~50 salas)</option>
        </select>
        <span style="font-size:0.68rem;color:#7a92aa">·</span>
        <button onclick="_avtEditorAcaoSet('piso')" id="avt-ed-btn-piso" class="avt-ed-btn avt-ed-btn-ativo">Piso</button>
        <button onclick="_avtEditorAcaoSet('parede')" id="avt-ed-btn-parede" class="avt-ed-btn">Parede</button>
        <button onclick="_avtEditorAcaoSet('sala')" id="avt-ed-btn-sala" class="avt-ed-btn">Sala</button>
        <button onclick="_avtEditorLimpar()" class="avt-ed-btn">Limpar</button>
        <button onclick="_avtEditorReset()" class="avt-ed-btn">Resetar</button>
      </div>
      <div style="overflow:auto;max-height:380px;border:1px solid rgba(79,163,209,0.15);border-radius:6px">
        <canvas id="avt-ed-canvas" style="cursor:crosshair;display:block;touch-action:none"></canvas>
      </div>`;
    _avtEd.w = 60; _avtEd.h = 40;
    setTimeout(_avtEditorInit, 50);

  } else if (opcao === 'json') {
    sub.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:120px">
          <label style="display:block;font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Nº de salas</label>
          <input id="avt-json-salas" type="number" min="1" max="50" value="10"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem"
            oninput="_avtJsonAtualizarPrompt()">
        </div>
        <div style="flex:2;min-width:150px">
          <label style="display:block;font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Tamanho do grid</label>
          <select id="avt-json-tamanho" onchange="_avtJsonAtualizarPrompt()"
            style="width:100%;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            <option value="22x16">Pequena (22×16)</option>
            <option value="40x28">Média (40×28)</option>
            <option value="60x40" selected>Grande (60×40)</option>
            <option value="80x56">Enorme (80×56)</option>
          </select>
        </div>
        <button onclick="_avtCopiarPromptJson()" class="prompt-copy-btn" style="font-size:0.7rem;flex-shrink:0;align-self:flex-end">
          <span>⎘</span> <span>Copiar prompt</span>
          <span id="avt-json-ok" class="prompt-copy-ok">✓ Copiado!</span>
        </button>
      </div>
      <textarea id="avt-json-input" rows="7" placeholder='Cole aqui o JSON gerado pela IA...'
        style="width:100%;box-sizing:border-box;padding:8px;background:rgba(10,15,24,0.8);border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-family:monospace;font-size:0.72rem;resize:vertical;line-height:1.4"
        oninput="_avtJsonParsePreview(this.value)"></textarea>
      <div id="avt-json-status" style="margin-top:6px;font-size:0.75rem;color:#7a92aa"></div>`;

  } else if (opcao === 'claude') {
    const key = localStorage.getItem('animgen_claude_key') || '';
    sub.innerHTML = `
      <div class="criar-field">
        <label>Claude API Key ${key ? '(salva)' : '(necessária)'}</label>
        <input id="avt-claude-key" type="password" value="${key}"
          placeholder="sk-ant-…"
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;padding:7px 10px;font-family:monospace;font-size:0.8rem"
          oninput="localStorage.setItem('animgen_claude_key',this.value)">
      </div>
      <div style="display:flex;gap:10px;margin-bottom:6px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Nº de salas (1–50)</label>
          <input id="avt-claude-salas" type="number" min="1" max="50" value="10"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:0.8rem">
        </div>
        <div style="flex:2;min-width:150px">
          <label style="display:block;font-size:0.68rem;color:#7a92aa;margin-bottom:4px">Tamanho do grid</label>
          <select id="avt-claude-tamanho"
            style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;font-size:0.8rem">
            <option value="22x16">Pequena (22×16)</option>
            <option value="40x28">Média (40×28)</option>
            <option value="60x40" selected>Grande (60×40)</option>
            <option value="80x56">Enorme (80×56)</option>
          </select>
        </div>
      </div>
      <div class="criar-field">
        <label>Descreva o dungeon</label>
        <textarea id="avt-claude-desc" rows="3" placeholder="Ex: Uma cripta ancestral com guardiões mortos-vivos e uma sala do chefe no fundo. Inimigos fortes e numerosos."
          style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;padding:7px 10px;font-size:0.82rem;resize:vertical;line-height:1.5;font-family:inherit"></textarea>
      </div>
      <button onclick="_avtGerarComClaude()" id="avt-claude-btn"
        style="padding:9px 18px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.75rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em">
        ⚡ Gerar mapa
      </button>
      <div id="avt-claude-status" style="margin-top:8px;font-size:0.75rem;color:#7a92aa"></div>`;

  } else if (opcao === 'fase') {
    const fases = c._fasesDisponiveis || [];
    sub.innerHTML = `
      <div class="criar-field">
        <label>Fase existente</label>
        <select id="avt-fase-sel" onchange="AVT_STATE._criando.faseId=this.value;AVT_STATE._criando.mapa='fase-'+this.value"
          style="width:100%;padding:8px;background:#0a0f18;border:1px solid var(--borda);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.8rem">
          <option value="">— Selecionar —</option>
          ${fases.map(f => `<option value="${f.map_id}">${f.nome||f.map_id}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:0.72rem;color:#7a92aa">A fase será copiada para seu dungeon (independente).</div>`;

  } else if (opcao === 'ia_fase') {
    sub.innerHTML = `
      <div style="padding:12px;background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.15);border-radius:8px;display:flex;flex-direction:column;gap:10px">

        <!-- Configuração -->
        <div>
          <div style="font-size:0.68rem;color:rgba(200,168,75,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Configuração</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:3;min-width:140px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Descrição do dungeon</label>
              <input id="avt-tileset-desc" type="text" value="${(c.nome||'').replace(/"/g,'&quot;')}"
                placeholder="ex: cripta sombria com guardiões mortos-vivos"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Cols</label>
              <input id="avt-tileset-cols" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Linhas</label>
              <input id="avt-tileset-rows" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div style="min-width:80px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Largura dungeon</label>
              <input id="avt-tileset-largura" type="number" value="24" min="10" max="80"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:80px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Altura dungeon</label>
              <input id="avt-tileset-altura" type="number" value="18" min="8" max="60"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
          </div>
        </div>

        <!-- Passo 1: prompt de imagem -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:0.72rem;color:#c8a84b;font-weight:600">1. Prompt de imagem (tileset)</span>
            <button onclick="faseTilesetCopiarPromptImagem()"
              style="padding:4px 10px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase">
              ⎘ Copiar
            </button>
          </div>
          <div style="font-size:0.67rem;color:#7a92aa;line-height:1.5">Instrução para IA de imagem (DALL-E, Midjourney…) gerar o spritesheet de blocos.</div>
        </div>

        <!-- Passo 2: upload imagem -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="font-size:0.72rem;color:#c8a84b;font-weight:600;margin-bottom:8px">2. Carregar tileset gerado</div>
          <label style="display:inline-block;padding:6px 12px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.25);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">
            📁 Escolher imagem
            <input type="file" accept="image/*" style="display:none" onchange="faseTilesetHandleImageSelect(this)">
          </label>
          <span id="avt-tileset-img-nome" style="font-size:0.68rem;color:#7a92aa;margin-left:8px"></span>
          <div style="margin-top:8px">
            <img id="avt-tileset-img-preview" style="display:none;max-width:100%;max-height:140px;border:1px solid rgba(200,168,75,0.2);border-radius:4px;image-rendering:pixelated">
          </div>
        </div>

        <!-- Passo 3: prompt de layout -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:0.72rem;color:#c8a84b;font-weight:600">3. Prompt de layout da dungeon</span>
            <button onclick="faseTilesetCopiarPromptLayout()"
              style="padding:4px 10px;background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;cursor:pointer;text-transform:uppercase">
              ⎘ Copiar
            </button>
          </div>
          <div style="font-size:0.67rem;color:#7a92aa;line-height:1.5">Envie para Claude.ai ou ChatGPT <strong style="color:#c8a84b">junto com a imagem</strong>. A IA identifica os blocos e projeta as salas, corredores e objetos.</div>
        </div>

        <!-- Passo 4: colar JSON -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.15);border-radius:6px;padding:10px">
          <div style="font-size:0.72rem;color:#c8a84b;font-weight:600;margin-bottom:8px">4. Cole o JSON retornado</div>
          <textarea id="avt-tileset-json-input" rows="6" placeholder='{"version":2,"cols":4,"rows":4,"blocos":{...},"mapa":{"tiles":[...]}}'
            style="width:100%;box-sizing:border-box;padding:8px;background:rgba(10,15,24,0.8);border:1px solid rgba(200,168,75,0.15);border-radius:6px;color:#c8d8e8;font-family:monospace;font-size:0.65rem;resize:vertical;line-height:1.4"
            oninput="faseTilesetHandleJSONPaste(this.value)"></textarea>
          <div id="avt-tileset-json-status" style="margin-top:4px;font-size:0.72rem"></div>
        </div>
      </div>`;

    // A IA define a dungeon — não há sub-modo separado
    c.mapa = 'ia_fase_pending';

  } else if (opcao === 'ia_externa') {
    sub.innerHTML = `
      <div style="padding:12px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.15);border-radius:8px;display:flex;flex-direction:column;gap:12px">

        <!-- Configuração de tiles -->
        <div>
          <div style="font-size:0.68rem;color:rgba(79,163,209,0.8);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Riqueza visual do tileset</div>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Colunas</label>
              <input id="avt-ext-cols" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="min-width:56px">
              <label style="display:block;font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Linhas</label>
              <input id="avt-ext-rows" type="number" value="4" min="2" max="16"
                style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.8rem">
            </div>
            <div style="font-size:0.67rem;color:#7a92aa;flex:1;min-width:120px;padding-bottom:6px">Mais colunas/linhas = mais variedade visual. Mínimo recomendado: 4×4.</div>
          </div>
        </div>

        <!-- Seção A: imagem do tileset -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(200,168,75,0.2);border-radius:6px;padding:10px">
          <div style="font-size:0.7rem;color:#c8a84b;font-weight:600;margin-bottom:6px">🎨 A. Tileset visual (imagem)</div>
          <div style="font-size:0.67rem;color:#7a92aa;margin-bottom:8px;line-height:1.5">Gere uma imagem de spritesheet com qualquer IA de imagem (Midjourney, DALL-E, Stable Diffusion…).</div>
          <button onclick="_avtCopiarPromptImagemExterna()"
            style="width:100%;padding:6px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
            📋 Copiar prompt de imagem do tileset
          </button>
          <label style="display:inline-block;padding:5px 12px;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);border-radius:5px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase">
            📁 Carregar imagem gerada
            <input type="file" accept="image/*" style="display:none" onchange="_avtExtHandleImageSelect(this)">
          </label>
          <span id="avt-ext-img-nome" style="font-size:0.68rem;color:#7a92aa;margin-left:8px"></span>
          <div style="margin-top:8px">
            <img id="avt-ext-img-preview" style="display:none;max-width:100%;max-height:120px;border:1px solid rgba(200,168,75,0.2);border-radius:4px;image-rendering:pixelated">
          </div>
        </div>

        <!-- Seção B: campanha completa -->
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(79,163,209,0.2);border-radius:6px;padding:10px">
          <div style="font-size:0.7rem;color:#4fa3d1;font-weight:600;margin-bottom:6px">🌐 B. Personagens + dungeon (IA de texto)</div>
          <div style="font-size:0.67rem;color:#7a92aa;margin-bottom:8px;line-height:1.5">
            1. Copie o prompt técnico abaixo<br>
            2. Abra Claude.ai, ChatGPT ou qualquer IA de texto<br>
            3. Cole o prompt e <strong style="color:#c8d8e8">descreva na conversa</strong> os personagens e o tema do dungeon<br>
            4. Copie o JSON retornado e cole no campo abaixo
          </div>
          <button onclick="_avtCopiarPromptCampanhaExterna()"
            style="width:100%;padding:6px;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
            📋 Copiar prompt técnico
          </button>
          <textarea id="avt-ext-json-input" rows="6" placeholder='{"characters":[...],"tileset_config":{"blocos":{...},"mapa":{"tiles":[...]}}}'
            style="width:100%;box-sizing:border-box;padding:8px;background:rgba(10,15,24,0.8);border:1px solid rgba(79,163,209,0.15);border-radius:6px;color:#c8d8e8;font-family:monospace;font-size:0.63rem;resize:vertical;line-height:1.4"
            oninput="_avtExtHandleJSONPaste(this.value)"></textarea>
          <div id="avt-ext-json-status" style="margin-top:4px;font-size:0.72rem"></div>
        </div>
      </div>`;

    c.mapa = 'ia_externa_pending';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WIZARD NAV
// ─────────────────────────────────────────────────────────────────────────────

function avtCriarSetCor(cor) {
  AVT_STATE._criando.cor = cor;
  _avtCriarRenderEtapa();
}

function avtCriarAddChar() {
  AVT_STATE._criando.personagens.push({ nome: '', hp_max: 60, cor: '#4fa3d1', descricao: '' });
  const lista = document.getElementById('avt-chars-lista');
  if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
}

function avtCriarRemChar(i) {
  AVT_STATE._criando.personagens.splice(i, 1);
  const lista = document.getElementById('avt-chars-lista');
  if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
}

async function avtCriarImportCampanha(campId) {
  AVT_STATE._criando.importCampanhaId = campId || null;
  AVT_STATE._criando._fasesDisponiveis = [];
  AVT_STATE._criando._campSkillsToImport = [];
  if (!campId) {
    AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1' }];
    const lista = document.getElementById('avt-chars-lista');
    if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
    return;
  }
  try {
    const [chars, fases, campSkills] = await Promise.all([
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(campId)}&select=nome,hp_max,custom_attrs,id&order=nome`),
      _avtSb(`mapas?rpg_id=eq.${encodeURIComponent(campId)}&tipo=eq.fase&select=map_id,nome,render_data`)
        .catch(() => []),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(campId)}&select=*`)
        .catch(() => [])
    ]);
    if (chars?.length) {
      const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
      AVT_STATE._criando.personagens = chars
        .filter(c => c.custom_attrs?.tipo_personagem !== 'npc')
        .map((c, i) => ({ nome: c.nome, hp_max: c.hp_max || 60, cor: cores[i % cores.length], descricao: '' }));
      if (!AVT_STATE._criando.personagens.length)
        AVT_STATE._criando.personagens = [{ nome: '', hp_max: 60, cor: '#4fa3d1', descricao: '' }];
      const lista = document.getElementById('avt-chars-lista');
      if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
      mostrarToast(`${chars.length} personagens importados`, 'ok');
    }
    if (fases?.length) {
      AVT_STATE._criando._fasesDisponiveis = fases;
    }
    if (campSkills?.length) {
      AVT_STATE._criando._campSkillsToImport = campSkills;
      mostrarToast(`${campSkills.length} skills importadas`, 'ok');
    }
  } catch(e) { mostrarToast('Erro ao importar personagens', 'erro'); }
}

function _avtCriarVoltar() {
  const c = AVT_STATE._criando;
  if (c.etapa > 0) {
    // In completa mode, going back from map step returns to mode selection
    if (c._modoEscolha === 'completa' && c.etapa === 3) {
      c.etapa = 0;
    } else {
      c.etapa--;
    }
    _avtCriarRenderEtapa();
  }
}

function _avtCriarAvancar() {
  const c = AVT_STATE._criando;
  if (c.etapa === 0) {
    if (!c._modoEscolha) { mostrarToast('Escolha um modo de criação', 'aviso'); return; }
    if (c._modoEscolha === 'completa') {
      c.etapa = 3;
      c.mapaOpcao = 'ia_externa';
      _avtCriarRenderEtapa();
      return;
    }
    c.etapa = 1;
    _avtCriarRenderEtapa();
    return;
  }
  if (c.etapa === 1) {
    c.nome = document.getElementById('avt-c-nome')?.value?.trim() || c.nome;
    if (!c.nome) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  }
  if (c.etapa === 2) {
    const chars = c.personagens.filter(p => p.nome.trim());
    if (!chars.length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }
  }
  c.etapa++;
  _avtCriarRenderEtapa();
}

// ─────────────────────────────────────────────────────────────────────────────
// TILE EDITOR
// ─────────────────────────────────────────────────────────────────────────────

var _avtEd = { tiles: null, w: 60, h: 40, acao: 'piso', painting: false, salaStart: null };

function _avtEditorTamanho(val) {
  const [w, h] = val.split('x').map(Number);
  _avtEd.w = w; _avtEd.h = h;
  _avtEd.tiles = null;
  _avtEditorInit();
}

function _avtEditorInit() {
  const EDSZ = 14, W = _avtEd.w, H = _avtEd.h;
  if (!_avtEd.tiles) _avtEditorReset();
  const canvas = document.getElementById('avt-ed-canvas');
  if (!canvas) return;
  canvas.width  = W * EDSZ;
  canvas.height = H * EDSZ;
  canvas.style.width  = (W * EDSZ) + 'px';
  canvas.style.height = (H * EDSZ) + 'px';
  _avtEditorRenderCanvas();

  const getTile = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W * EDSZ / rect.width;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { tx: Math.floor(cx * scaleX / EDSZ), ty: Math.floor(cy * scaleX / EDSZ) };
  };

  const paint = (e) => {
    if (!_avtEd.painting) return;
    const {tx, ty} = getTile(e);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return;
    if (_avtEd.acao === 'sala' && _avtEd.salaStart) {
      // Preview only — fill on mouseup
    } else {
      _avtEd.tiles[ty][tx] = _avtEd.acao === 'parede' ? AVT_T.PAREDE : AVT_T.PISO;
    }
    _avtEditorRenderCanvas();
    AVT_STATE._criando.mapa = _avtEditorExport();
  };

  canvas.onmousedown = canvas.ontouchstart = (e) => {
    e.preventDefault(); _avtEd.painting = true;
    if (_avtEd.acao === 'sala') { _avtEd.salaStart = getTile(e); return; }
    paint(e);
  };
  canvas.onmousemove = canvas.ontouchmove = (e) => { e.preventDefault(); paint(e); };
  canvas.onmouseup = canvas.ontouchend = (e) => {
    if (_avtEd.acao === 'sala' && _avtEd.salaStart) {
      const {tx, ty} = getTile(e);
      const x0=Math.min(_avtEd.salaStart.tx,tx), y0=Math.min(_avtEd.salaStart.ty,ty);
      const x1=Math.max(_avtEd.salaStart.tx,tx), y1=Math.max(_avtEd.salaStart.ty,ty);
      for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) _avtEd.tiles[y][x] = AVT_T.PISO;
      _avtEd.salaStart = null;
    }
    _avtEd.painting = false;
    _avtEditorRenderCanvas();
    AVT_STATE._criando.mapa = _avtEditorExport();
  };
  document.onmouseup = () => { _avtEd.painting = false; };
}

function _avtEditorReset() {
  _avtEd.tiles = _avtGerarDungeon(_avtEd.w, _avtEd.h).tiles;
  _avtEditorRenderCanvas();
  AVT_STATE._criando.mapa = _avtEditorExport();
}

function _avtEditorLimpar() {
  _avtEd.tiles = Array.from({length: _avtEd.h}, () => Array(_avtEd.w).fill(AVT_T.PAREDE));
  _avtEditorRenderCanvas();
  AVT_STATE._criando.mapa = _avtEditorExport();
}

function _avtEditorAcaoSet(acao) {
  _avtEd.acao = acao;
  ['piso','parede','sala'].forEach(a => {
    const btn = document.getElementById(`avt-ed-btn-${a}`);
    if (btn) btn.classList.toggle('avt-ed-btn-ativo', a === acao);
  });
}

function _avtEditorRenderCanvas() {
  const canvas = document.getElementById('avt-ed-canvas');
  if (!canvas || !_avtEd.tiles) return;
  const ctx = canvas.getContext('2d');
  const EDSZ = 14, W = _avtEd.w, H = _avtEd.h;
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = _avtEd.tiles[y][x] === AVT_T.PISO ? '#1a2535' : '#0a0c14';
      ctx.fillRect(x*EDSZ, y*EDSZ, EDSZ, EDSZ);
      ctx.strokeStyle = 'rgba(79,163,209,0.06)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x*EDSZ+0.5, y*EDSZ+0.5, EDSZ-1, EDSZ-1);
    }
  }
}

function _avtEditorExport() {
  const rooms = [];
  return { tiles: _avtEd.tiles, w: _avtEd.w, h: _avtEd.h, rooms, inimigos: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON IMPORT
// ─────────────────────────────────────────────────────────────────────────────

function _avtGetGridParams(prefixo) {
  const sel = document.getElementById(prefixo + '-tamanho');
  const [w, h] = (sel?.value || '60x40').split('x').map(Number);
  const salas = parseInt(document.getElementById(prefixo + '-salas')?.value || '10', 10);
  return { w: w||60, h: h||40, salas: Math.min(50, Math.max(1, salas||10)) };
}

function _avtGerarPromptJson(opts) {
  const w = opts?.w || 60, h = opts?.h || 40, salas = opts?.salas || 10;
  return `Gere um mapa de dungeon para um RPG top-down. Retorne APENAS o JSON, sem texto adicional.

PARÂMETROS:
- Grid: ${w} colunas × ${h} linhas
- Número de salas: ${salas} (interligadas por corredores)
- tiles: 0 = parede, 1 = piso

FORMATO OBRIGATÓRIO:
{
  "largura": ${w},
  "altura": ${h},
  "tiles": [
    [0,0,1,1,...],   ← linha 0, ${w} valores
    ...              ← total de ${h} linhas
  ],
  "salas": [
    {"id":"sala_1","x":2,"y":2,"w":8,"h":6,"tipo":"entrada","descricao":"Salão de entrada com tochas"},
    {"id":"sala_boss","x":50,"y":30,"w":10,"h":8,"tipo":"chefe","descricao":"Câmara do chefe guardada por dois sentinelas"}
  ],
  "inimigos": [
    {"x":12,"y":8,"hp":20,"cor":"#7a3300","sala_id":"sala_2"},
    {"x":35,"y":20,"hp":40,"cor":"#3a1a6a","sala_id":"sala_5"}
  ],
  "skills_sugeridas": [
    {"nome":"Golpe Sombrio","formula_dano":"2d6+5","tipo":"Ataque","efeito_visual":"Sombra","descricao":"Ataque com energia das trevas"},
    {"nome":"Cura das Pedras","formula_dano":"1d8+2","tipo":"Cura","efeito_visual":"Cura","descricao":"Recupera HP ao tocar a rocha sagrada"}
  ],
  "animacoes_sugeridas": [
    {
      "para":"jogadores",
      "animado_data": {
        "parts": { "_full": {"texture":"(SVG inline como data URI — personagem top-down visto de cima)","x":0,"y":0,"width":64,"height":64} },
        "animations": {
          "idle":   {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":500,"transforms":{"_full":{"x":0,"y":-1}}}],"duration":1000,"loop":true},
          "walk":   {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":200,"transforms":{"_full":{"x":0,"y":-3}}}],"duration":400,"loop":true},
          "attack": {"frames":[{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":100,"transforms":{"_full":{"x":4,"y":-2}}}],"duration":300,"loop":false}
        }
      }
    }
  ]
}

REGRAS:
- Posicione inimigos APENAS em tiles de piso (valor 1)
- NÃO invente nomes de inimigos — deixe o campo "nome" ausente (o mestre definirá)
- Cores dos inimigos: use hex que combine com o tipo (ex: undead → tons de cinza/azul, demônios → vermelho escuro)
- Salas com "tipo":"chefe" devem ter inimigos com HP maior (60–120)
- Salas com "tipo":"entrada" NÃO têm inimigos
- Corredores devem conectar TODAS as salas em sequência lógica
- ${salas >= 20 ? 'Para dungeons grandes: distribua salas em clusters temáticos (entrada, desenvolvimento, clímax)' : 'Organize as salas em progressão linear com uma bifurcação opcional'}`;
}

function _avtJsonAtualizarPrompt() {
  // Atualiza o prompt ao mudar salas/tamanho na UI do modo json
}

function _avtCopiarPromptJson() {
  const params = _avtGetGridParams('avt-json');
  const txt = _avtGerarPromptJson(params);
  const copy = () => {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  };
  navigator.clipboard.writeText(txt).catch(copy);
  const ok = document.getElementById('avt-json-ok');
  if (ok) { ok.style.opacity=1; setTimeout(()=>ok.style.opacity=0,2000); }
}

function _avtJsonParsePreview(txt) {
  const st = document.getElementById('avt-json-status');
  if (!txt.trim()) { if (st) st.textContent=''; return; }
  try {
    const json = JSON.parse(txt);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._criando.mapa = dungeon;
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa válido — ${dungeon.w}×${dungeon.h} tiles, ${json.inimigos?.length||0} inimigos</span>`;
  } catch(e) {
    AVT_STATE._criando.mapa = null;
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ JSON inválido: ${e.message}</span>`;
  }
}

function _avtJsonToDungeon(json) {
  if (!json.tiles || !Array.isArray(json.tiles)) throw new Error('tiles ausente');
  const h = json.tiles.length, w = json.tiles[0]?.length || 0;
  if (!w || !h) throw new Error('dimensões inválidas');
  const inimigos = (json.inimigos || []).map((ini) => ({
    x: ini.x, y: ini.y, hp: ini.hp || 20, cor: ini.cor || '#7a3300',
    nome: ini.nome || null, sala_id: ini.sala_id || null,
    xpBase: typeof ini.xpBase === 'number' ? ini.xpBase : (ini.isBoss ? 50 : 10),
    isBoss: ini.isBoss || false,
    aparencia_tipo: ini.aparencia_tipo || null,
    pacienciaSecs: typeof ini.pacienciaSecs === 'number' ? ini.pacienciaSecs : 5,
    deteccaoRaio: typeof ini.deteccaoRaio === 'number' ? ini.deteccaoRaio : 3,
  }));
  return {
    tiles: json.tiles, w, h,
    rooms: json.salas || [],
    _inimigosJson: inimigos,
    _skillsSugeridas: json.skills_sugeridas || [],
    _animacoesSugeridas: json.animacoes_sugeridas || []
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE API
// ─────────────────────────────────────────────────────────────────────────────

async function _avtGerarComClaude() {
  const key = document.getElementById('avt-claude-key')?.value?.trim() ||
              localStorage.getItem('animgen_claude_key') || '';
  if (!key) { mostrarToast('Insira a Claude API Key', 'aviso'); return; }

  const desc = document.getElementById('avt-claude-desc')?.value?.trim() ||
               'Uma dungeon com inimigos variados';
  const params = _avtGetGridParams('avt-claude');

  const btn = document.getElementById('avt-claude-btn');
  const st  = document.getElementById('avt-claude-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  if (st) st.innerHTML = `Gerando dungeon ${params.w}×${params.h} com ${params.salas} salas…`;

  const systemPrompt = `Você é um gerador de mapas de dungeon para jogos RPG top-down.
Retorne APENAS um JSON válido no formato especificado, sem nenhum texto adicional, sem markdown.`;

  const userPrompt = `Gere um mapa de dungeon com a seguinte descrição: "${desc}"

${_avtGerarPromptJson(params)}`;

  try {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta sem JSON válido');

    const json = JSON.parse(match[0]);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._criando.mapa = dungeon;

    localStorage.setItem('animgen_claude_key', key);
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa gerado — ${dungeon.w}×${dungeon.h} tiles, ${dungeon._inimigosJson?.length||0} inimigos</span>`;
    mostrarToast('✓ Mapa gerado com Claude!', 'sucesso');
  } catch(e) {
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ Erro: ${e.message}</span>`;
    mostrarToast('Erro Claude API: ' + e.message, 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Gerar mapa'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IA: GERAÇÃO DE PERSONAGENS
// ─────────────────────────────────────────────────────────────────────────────

function _avtMontarPromptPersonagens(chars, dungeon) {
  const nInimigos = dungeon?._inimigosJson?.length || 0;
  const hpMedio = nInimigos > 0
    ? Math.round(dungeon._inimigosJson.reduce((s, e) => s + (e.hp || 20), 0) / nInimigos)
    : 20;
  const temBoss = dungeon?._inimigosJson?.some(e => e.isBoss) || false;
  return `Você é um mestre de RPG experiente. Crie personagens balanceados para ${chars.length} jogador(es) em JSON.

Contexto do dungeon: ${nInimigos} inimigos, HP médio dos inimigos: ${hpMedio}${temBoss ? ', tem chefe (boss)' : ''}.

Retorne APENAS um array JSON válido (sem markdown, sem explicações), com este formato exato para cada personagem:
[
  {
    "nome": "Nome do personagem",
    "hp_max": 60,
    "atributos": {"forca": 12, "destreza": 10, "constituicao": 12, "inteligencia": 8},
    "habilidades": [
      {"nome": "Golpe Pesado", "formula_dano": "1d8+2", "tipo_dano": "fisico", "cooldown_turnos": 1, "alcance_celulas": 1, "descricao": "Golpe poderoso com arma"},
      {"nome": "Escudo de Fé", "formula_dano": "0", "tipo_dano": "cura", "cooldown_turnos": 3, "alcance_celulas": 0, "descricao": "Cura 1d6 HP"}
    ],
    "aparencia_tipo": "npc_generico",
    "classe_aventura": "guerreiro",
    "movimentoMax": 3
  }
]

Regras de movimento: movimentoMax é quantas células o personagem pode se mover por turno (base 3). Personagens ágeis (destreza alta) devem ter movimentoMax maior (ex: ladino destreza 16 = movimentoMax 5). Tanques com destreza baixa podem ter movimentoMax 2. Balanceie o HP dos personagens considerando que precisam sobreviver ao dungeon. Cada personagem deve ter 2-3 habilidades.

Pedidos dos jogadores:
${chars.map((p, i) => `Jogador ${i+1} (${p.nome || 'Sem nome'}): ${p.descricao || 'guerreiro genérico'}`).join('\n')}`;
}

async function _avtGerarPersonagensComIA() {
  const key = document.getElementById('avt-chars-claude-key')?.value?.trim()
             || localStorage.getItem('animgen_claude_key') || '';
  if (!key) { mostrarToast('Insira a Claude API Key', 'aviso'); return; }

  const c = AVT_STATE._criando;
  const chars = c.personagens.filter(p => p.nome.trim() || p.descricao?.trim());
  if (!chars.length) { mostrarToast('Adicione ao menos um personagem', 'aviso'); return; }

  const st = document.getElementById('avt-chars-ia-status');
  const btn = document.querySelector('button[onclick="_avtGerarPersonagensComIA()"]');
  if (st) st.innerHTML = '⏳ Gerando personagens…';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Aguardando IA…'; }

  try {
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
        system: 'Você é um mestre de RPG que cria personagens balanceados. Retorne APENAS JSON válido, sem texto adicional, sem markdown.',
        messages: [{ role: 'user', content: _avtMontarPromptPersonagens(chars, c.mapa) }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Resposta sem JSON válido');

    const gerados = JSON.parse(match[0]);
    if (!Array.isArray(gerados) || !gerados.length) throw new Error('Array de personagens vazio');

    // Mesclar com personagens existentes (preservar índices)
    gerados.forEach((g, i) => {
      if (i < c.personagens.length) {
        const p = c.personagens[i];
        if (g.nome && !p.nome) p.nome = g.nome;
        if (g.hp_max) p.hp_max = g.hp_max;
        if (g.classe_aventura) p.classe_aventura = g.classe_aventura;
        if (g.aparencia_tipo) p.aparencia_tipo = g.aparencia_tipo;
        p._atributosIA = g.atributos || {};
        p._habilidadesIA = g.habilidades || [];
      }
    });

    // Guardar habilidades para importar no submit
    c._habilidadesGeradasIA = gerados;
    localStorage.setItem('animgen_claude_key', key);

    const resumo = gerados.map(g => `${g.nome} (${g.hp_max}HP)`).join(', ');
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Gerado: ${resumo}</span>`;

    // Re-renderizar a lista para mostrar dados atualizados
    const lista = document.getElementById('avt-chars-lista');
    if (lista) lista.innerHTML = _avtCriarRenderCharsLista();

    mostrarToast('✓ Personagens gerados pela IA!', 'sucesso');
  } catch(e) {
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ Erro: ${e.message}</span>`;
    mostrarToast('Erro IA: ' + e.message, 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Gerar personagens com IA'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IA EXTERNA: PERSONAGENS
// ─────────────────────────────────────────────────────────────────────────────

function _avtCopiarPromptPersonagensExterno() {
  const c = AVT_STATE._criando;
  const chars = c.personagens.filter(p => p.nome.trim() || p.descricao?.trim());
  const prompt = _avtMontarPromptPersonagens(chars.length ? chars : [{ nome: 'Personagem', descricao: 'guerreiro genérico' }], null);
  navigator.clipboard.writeText(prompt)
    .then(() => mostrarToast('📋 Prompt copiado — abra a IA e descreva os personagens na conversa!', 'ok'))
    .catch(() => mostrarToast('Erro ao copiar', 'err'));
}

function _avtAplicarPersonagensIA(gerados) {
  const c = AVT_STATE._criando;
  gerados.forEach((g, i) => {
    if (i < c.personagens.length) {
      const p = c.personagens[i];
      if (g.nome && !p.nome) p.nome = g.nome;
      if (g.hp_max) p.hp_max = g.hp_max;
      if (g.classe_aventura) p.classe_aventura = g.classe_aventura;
      if (g.aparencia_tipo) p.aparencia_tipo = g.aparencia_tipo;
      if (g.movimentoMax) p._movimentoMaxIA = g.movimentoMax;
      p._atributosIA  = g.atributos   || {};
      p._habilidadesIA = g.habilidades || [];
    }
  });
  c._habilidadesGeradasIA = gerados;
  const lista = document.getElementById('avt-chars-lista');
  if (lista) lista.innerHTML = _avtCriarRenderCharsLista();
}

function _avtAplicarPersonagensExterno(val) {
  const status = document.getElementById('avt-chars-ext-status');
  if (!val?.trim()) { if (status) status.textContent = ''; return; }
  try {
    const match = val.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Resposta sem array JSON [ ]');
    const gerados = JSON.parse(match[0]);
    if (!Array.isArray(gerados) || !gerados.length) throw new Error('Array vazio');
    _avtAplicarPersonagensIA(gerados);
    const resumo = gerados.map(g => `${g.nome} (${g.hp_max}HP)`).join(', ');
    if (status) status.innerHTML = `<span style="color:#27ae60">✓ Gerado: ${resumo}</span>`;
    mostrarToast('✓ Personagens aplicados!', 'sucesso');
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────────

async function aventuraCriarSubmit() {
  const c = AVT_STATE._criando;
  const isModoCompleta = c._modoEscolha === 'completa';
  // In completa mode, name can come from the imported JSON
  if (isModoCompleta && !c.nome && c._extCampanhaJSON?.nome) {
    c.nome = c._extCampanhaJSON.nome;
  }
  // No modo ia_externa os personagens vêm do JSON, mas precisamos de ao menos um placeholder
  const chars = c.mapaOpcao === 'ia_externa'
    ? (c.personagens.filter(p => p.nome.trim()).length ? c.personagens.filter(p => p.nome.trim()) : [{ nome: 'Herói', hp_max: 60, cor: '#4fa3d1' }])
    : c.personagens.filter(p => p.nome.trim());
  if (!isModoCompleta && !c.nome) { mostrarToast('Nome é obrigatório', 'aviso'); return; }
  if (!c.nome) { mostrarToast('Nome é obrigatório (defina no JSON da IA ou preenchendo o campo)', 'aviso'); return; }
  if (c.mapaOpcao !== 'ia_externa' && !chars.length) { mostrarToast('Adicione ao menos 1 personagem', 'aviso'); return; }
  if (!c.mapaOpcao) { mostrarToast('Escolha como criar o mapa', 'aviso'); return; }
  if ((c.mapaOpcao === 'json' || c.mapaOpcao === 'claude') && !c.mapa) {
    mostrarToast('Gere ou importe o mapa antes de continuar', 'aviso'); return;
  }
  if (c.mapaOpcao === 'fase' && !c.faseId) {
    mostrarToast('Selecione uma fase existente', 'aviso'); return;
  }
  if (c.mapaOpcao === 'ia_fase') {
    if (!c._tilesetImgFile) {
      mostrarToast('Carregue a imagem do tileset', 'aviso'); return;
    }
    if (!c._tilesetConfig?.mapa?.tiles) {
      mostrarToast('Cole o JSON de layout da dungeon (passo 4)', 'aviso'); return;
    }
  }
  if (c.mapaOpcao === 'ia_externa') {
    if (!c._tilesetImgFile) {
      mostrarToast('Carregue a imagem do tileset (seção A)', 'aviso'); return;
    }
    if (!c._extCampanhaJSON) {
      mostrarToast('Cole o JSON gerado pela IA (seção B)', 'aviso'); return;
    }
  }

  const btn = document.getElementById('avt-criar-btn-next');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Criando…'; }

  try {
    const rpgId = c.nome.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,30)
                  + '_avt_' + Date.now().toString(36);

    // Resolve dungeon
    let dungeonData = null;
    let tilesetImgUrl = null;

    if (c.mapaOpcao === 'ia_fase') {
      // Upload tileset image
      if (c._tilesetImgFile) {
        try {
          tilesetImgUrl = await uploadToStorage(c._tilesetImgFile, `aventuras/${rpgId}/tileset`);
        } catch(e) { console.warn('[tileset] upload failed:', e); }
      }
      // Build dungeon from tileset config mapa
      dungeonData = faseTilesetToDungeonData(c._tilesetConfig);
      if (dungeonData) dungeonData.tileset_img_url = tilesetImgUrl || null;
    } else if (c.mapaOpcao === 'ia_externa') {
      // Upload tileset image
      if (c._tilesetImgFile) {
        try {
          tilesetImgUrl = await uploadToStorage(c._tilesetImgFile, `aventuras/${rpgId}/tileset`);
        } catch(e) { console.warn('[tileset] upload failed:', e); }
      }
      // Build dungeon from AI-generated combined JSON
      const extData = c._extCampanhaJSON;
      dungeonData = faseTilesetToDungeonData(extData.tileset_config);
      if (dungeonData) dungeonData.tileset_img_url = tilesetImgUrl || null;
      // Inject AI-generated characters into chars array (replace manual ones)
      const extChars = extData.characters || [];
      extChars.forEach((g, i) => {
        if (i < chars.length) {
          if (g.nome) chars[i].nome = g.nome;
          if (g.hp_max) chars[i].hp_max = g.hp_max;
          if (g.classe_aventura) chars[i].classe_aventura = g.classe_aventura;
          if (g.aparencia_tipo) chars[i].aparencia_tipo = g.aparencia_tipo;
          chars[i]._atributosIA  = g.atributos   || {};
          chars[i]._habilidadesIA = g.habilidades || [];
        } else {
          chars.push({
            nome: g.nome || `Personagem ${i+1}`, hp_max: g.hp_max || 60,
            cor: '#4fa3d1', classe_aventura: g.classe_aventura || 'guerreiro',
            aparencia_tipo: g.aparencia_tipo || 'npc_generico',
            _atributosIA: g.atributos || {}, _habilidadesIA: g.habilidades || []
          });
        }
      });
    } else if (c.mapaOpcao === 'procedural' || c.mapa === 'procedural') {
      dungeonData = _avtGerarDungeonProcedural();
    } else if (c.mapa && typeof c.mapa === 'object') {
      dungeonData = c.mapa;
    }
    // 'fase' option: dungeonData stays null — will be loaded from fase render_data

    const themeJson = {
      nome: c.nome,
      destaque: c.cor, primario: c.cor2, animation: c.icone,
      is_aventura: true,
      dungeon_data: dungeonData,
      mapa_opcao: c.mapaOpcao,
      fase_id: c.faseId || null
    };

    let regBody = { rpg_id: rpgId, name: c.nome, owner_id: SESSION?.user?.id || null, theme_json: themeJson };
    try {
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify({ ...regBody, is_aventura: true }) });
    } catch(e) {
      await _avtSb('rpg_registry', { method: 'POST', body: JSON.stringify(regBody) });
    }

    if (SESSION?.user?.id) {
      await _avtSb('rpg_members', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, player_id: SESSION.user.id,
        nickname: SESSION.nickname || SESSION.user.email || 'aventureiro',
        role: 'mestre', permissoes: {}
      })});
    }

    const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];
    for (let i = 0; i < chars.length; i++) {
      const p = chars[i];
      const hpMax = p.hp_max || 60;
      const atributosIA = p._atributosIA || {};
      const custom_attrs = {
        cor: p.cor || cores[i % cores.length],
        tipo_personagem: 'jogador',
        classe_aventura: p.classe_aventura || 'guerreiro',
        ...(Object.keys(atributosIA).length ? { atributos: atributosIA } : {}),
        ...(p._movimentoMaxIA != null ? { movimentoMax: p._movimentoMaxIA } : {})
      };
      await _avtSb('characters', { method: 'POST', body: JSON.stringify({
        rpg_id: rpgId, nome: p.nome.trim(), hp_max: hpMax, hp_atual: hpMax,
        xp: 0, nivel: 1, custom_attrs
      })});
      // Importar habilidades geradas pela IA
      const habilidadesIA = p._habilidadesIA || [];
      if (habilidadesIA.length) {
        const skillsBody = habilidadesIA.map(h => ({
          rpg_id: rpgId, personagem: p.nome.trim(),
          habilidade: h.nome, formula_dano: h.formula_dano || '1d6',
          tipo_dano: h.tipo_dano || 'fisico',
          cooldown_turnos: h.cooldown_turnos || 0,
          alcance_celulas: h.alcance_celulas ?? 1,
          efeito: h.descricao || ''
        }));
        try {
          await _avtSb('skills', { method: 'POST', body: JSON.stringify(skillsBody) });
        } catch(e) { /* não crítico */ }
      }
    }

    // Import skills from source campaign if available
    if (c._campSkillsToImport?.length) {
      try {
        const newSkills = c._campSkillsToImport.map(sk => ({
          ...sk,
          id: undefined,
          rpg_id: rpgId,
          character_id: undefined // will be re-linked by name if needed
        }));
        await _avtSb('skills', { method: 'POST', body: JSON.stringify(newSkills) });
      } catch(e) { /* non-critical — skills import failed */ }
    }

    mostrarToast(`✦ "${c.nome}" criada!`, 'sucesso');
    HUB_DATA.rpgs = await getAllRPGs() || [];
    renderRPGList(HUB_DATA.rpgs);
    await avtHubRenderSection();
    fecharCriarAventura();
    setTimeout(() => entrarAventura(rpgId), 400);
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Iniciar Dungeon!'; }
    mostrarToast('Erro: ' + (e?.message || e), 'erro');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRAR / SAIR  — bug-fixed version
// ─────────────────────────────────────────────────────────────────────────────

async function _avtCarregarAtribuicaoJogador(rpgId) {
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  if (!SESSION?.user?.id) return;
  try {
    const membros = await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(rpgId)}&select=player_id,nickname,role,linked`);
    AVT_STATE.membros = membros || [];
    const meu = (membros || []).find(m => m.player_id === SESSION.user.id);
    if (meu?.linked) AVT_STATE.myCharNome = meu.linked;
  } catch(e) {}
}

async function _avtMestreAtribuirJogador(playerId, charNome) {
  try {
    await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`,
      { method:'PATCH', body:JSON.stringify({ linked: charNome || null }) });
    const m = AVT_STATE.membros.find(x => x.player_id === playerId);
    if (m) m.linked = charNome || null;
    mostrarToast('Personagem atribuído!', 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao atribuir: ' + (e?.message||e), 'erro'); }
}

async function _avtMestreSelecionarPersonagem(charNome) {
  if (!SESSION?.user?.id) return;
  AVT_STATE.myCharNome = charNome || null;
  try {
    await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${encodeURIComponent(SESSION.user.id)}`,
      { method:'PATCH', body:JSON.stringify({ linked: charNome || null }) });
    const m = AVT_STATE.membros.find(x => x.player_id === SESSION.user.id);
    if (m) m.linked = charNome || null;
    mostrarToast(charNome ? `Personagem do mestre: ${charNome}` : 'Personagem do mestre removido', 'ok');
  } catch(e) { mostrarToast('Erro ao salvar: ' + (e?.message||e), 'aviso'); }
  _avtMestrePainelRender();
}

async function _avtMestreAddXp(charNome, xpAmount) {
  if (!charNome || !xpAmount) return;
  const ent = AVT_STATE.entidades.find(e => e.nome === charNome && e.tipo === 'jogador');
  const dbChar = AVT_STATE.chars.find(c => c.nome === charNome);
  if (!dbChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  const prev = dbChar.xp || 0;
  dbChar.xp = Math.max(0, prev + xpAmount);
  if (ent) ent.xp = dbChar.xp;
  mostrarToast(`${xpAmount >= 0 ? '+' : ''}${xpAmount} XP para ${charNome} (total: ${dbChar.xp})`, 'ok');
  if (dbChar.id) {
    _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method:'PATCH', body:JSON.stringify({ xp: dbChar.xp })
    }).catch(()=>{});
  }
  _avtMestrePainelRender();
  _avtHudUpdate();
  // BUG-03 FIX: verificar e aplicar level-up automático após XP manual do mestre.
  await _avtAutoLevelUp(dbChar);
}

function _avtMestreAddBau() {
  const rd = AVT_STATE.dungeon?.render_data;
  if (!rd) { mostrarToast('Nenhum dungeon carregado', 'aviso'); return; }
  if (!rd.objetos) rd.objetos = [];
  const bauId = 'bau_' + Date.now();
  const newBau = { id: bauId, tipo: 'bau', nome: 'Baú', x: 1, y: 1, loot_itens: [], ouro: 0, aberto: false };
  rd.objetos.push(newBau);
  _avtMestreEditarBau(bauId);
  _avtSalvarDungeon();
}

function _avtMestreRemoverBau(bauId) {
  const rd = AVT_STATE.dungeon?.render_data;
  if (!rd?.objetos) return;
  const idx = rd.objetos.findIndex(o => String(o.id) === String(bauId));
  if (idx >= 0) rd.objetos.splice(idx, 1);
  _avtSalvarDungeon();
  _avtMestrePainelRender();
}

function _avtMestreReabrirBau(bauId) {
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
  if (bau) { bau.aberto = false; _avtSalvarDungeon(); _avtMestrePainelRender(); }
}

function _avtMestreEditarBau(bauId) {
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
  if (!bau) return;
  const catalog = AVT_STATE.itemCatalog || [];
  const catalogOpts = catalog.map(i => `<option value="${String(i.id).replace(/"/g,'&quot;')}">${i.nome||i.id}</option>`).join('');

  let overlay = document.getElementById('avt-bau-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avt-bau-editor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9600;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(overlay);
  }
  const lootItens = Array.isArray(bau.loot_itens) ? bau.loot_itens : [];
  overlay.innerHTML = `
    <div style="background:#0d1520;border:1px solid rgba(200,168,75,0.3);border-radius:12px;padding:20px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8a84b">📦 Editar Baú</div>
        <button onclick="document.getElementById('avt-bau-editor-overlay').style.display='none'" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem">×</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <label style="font-size:0.65rem;color:#7a92aa;display:block;margin-bottom:3px">Nome</label>
          <input id="avt-bau-nome" value="${(bau.nome||'Baú').replace(/"/g,'&quot;')}"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
        </div>
        <div>
          <label style="font-size:0.65rem;color:#7a92aa;display:block;margin-bottom:3px">Ouro</label>
          <input type="number" id="avt-bau-ouro" min="0" value="${bau.ouro||0}"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
        </div>
        <div>
          <label style="font-size:0.65rem;color:#7a92aa;display:block;margin-bottom:3px">Coluna (X)</label>
          <input type="number" id="avt-bau-x" min="0" value="${bau.x||0}"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
        </div>
        <div>
          <label style="font-size:0.65rem;color:#7a92aa;display:block;margin-bottom:3px">Linha (Y)</label>
          <input type="number" id="avt-bau-y" min="0" value="${bau.y||0}"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(200,168,75,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <label style="font-size:0.65rem;color:#7a92aa">Itens no baú</label>
          ${catalog.length ? `<button class="avt-mp-btn avt-mp-btn-ok" style="padding:2px 8px;font-size:0.68rem" onclick="_avtBauAddItem('${String(bauId).replace(/'/g,"\\'")}')">+ Item do catálogo</button>` : ''}
          <button class="avt-mp-btn" style="padding:2px 8px;font-size:0.68rem" onclick="_avtBauAddItemManual('${String(bauId).replace(/'/g,"\\'")}')">+ Item manual</button>
        </div>
        <div id="avt-bau-itens-lista">
          ${lootItens.map((it,i) => `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:5px 8px;background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.15);border-radius:5px">
              <span style="flex:1;font-size:0.72rem;color:#c8d8e8">${it.nome||it||'Item'} ${it.quantidade>1?'x'+it.quantidade:''}</span>
              <button onclick="_avtBauRemoverItem('${String(bauId).replace(/'/g,"\\'")}',${i})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9rem;padding:0">✕</button>
            </div>`).join('') || '<div style="font-size:0.7rem;color:#7a92aa;font-style:italic">Nenhum item.</div>'}
        </div>
        ${catalog.length ? `<select id="avt-bau-catalog-sel" style="width:100%;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;margin-top:6px;display:none">
          <option value="">Escolher do catálogo…</option>${catalogOpts}
        </select>` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="avt-mp-btn avt-mp-btn-ok" style="flex:1" onclick="_avtBauSalvar('${String(bauId).replace(/'/g,"\\'")}')">💾 Salvar</button>
        <button class="avt-mp-btn avt-mp-btn-danger" style="flex:1" onclick="document.getElementById('avt-bau-editor-overlay').style.display='none'">✕ Fechar</button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
  // Store current bauId for sub-functions
  overlay._bauId = bauId;
}

function _avtBauAddItem(bauId) {
  const sel = document.getElementById('avt-bau-catalog-sel');
  if (!sel) return;
  sel.style.display = sel.style.display === 'none' ? '' : 'none';
  if (sel.style.display !== 'none') {
    sel.onchange = () => {
      const itemId = sel.value;
      if (!itemId) return;
      const item = (AVT_STATE.itemCatalog||[]).find(i => String(i.id) === String(itemId));
      if (!item) return;
      const rd = AVT_STATE.dungeon?.render_data;
      const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
      if (!bau) return;
      if (!Array.isArray(bau.loot_itens)) bau.loot_itens = [];
      bau.loot_itens.push({ id: item.id, nome: item.nome, icone: item.icone||'📦', quantidade: 1 });
      sel.value = '';
      sel.style.display = 'none';
      _avtMestreEditarBau(bauId);
    };
  }
}

function _avtBauAddItemManual(bauId) {
  const nome = prompt('Nome do item:');
  if (!nome?.trim()) return;
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
  if (!bau) return;
  if (!Array.isArray(bau.loot_itens)) bau.loot_itens = [];
  bau.loot_itens.push({ nome: nome.trim(), icone: '📦', quantidade: 1 });
  _avtMestreEditarBau(bauId);
}

function _avtBauRemoverItem(bauId, idx) {
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
  if (!bau || !Array.isArray(bau.loot_itens)) return;
  bau.loot_itens.splice(idx, 1);
  _avtMestreEditarBau(bauId);
}

function _avtBauSalvar(bauId) {
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => String(o.id) === String(bauId));
  if (!bau) return;
  bau.nome  = document.getElementById('avt-bau-nome')?.value || 'Baú';
  bau.ouro  = parseInt(document.getElementById('avt-bau-ouro')?.value) || 0;
  bau.x     = parseInt(document.getElementById('avt-bau-x')?.value) || 0;
  bau.y     = parseInt(document.getElementById('avt-bau-y')?.value) || 0;
  document.getElementById('avt-bau-editor-overlay').style.display = 'none';
  _avtSalvarDungeon();
  _avtMestrePainelRender();
  mostrarToast('Baú salvo!', 'ok');
}

async function _avtSalvarDungeon() {
  if (!AVT_STATE.rpgId || !AVT_STATE.dungeon) return;
  const t = AVT_STATE.rpg?.theme_json || {};
  t.dungeon_data = AVT_STATE.dungeon;
  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method:'PATCH', body:JSON.stringify({ theme_json: t })
    });
  } catch(e) { mostrarToast('Erro ao salvar dungeon: ' + (e?.message||e), 'aviso'); }
}

async function _avtAdicionarMembro(input) {
  input = (input || '').trim().toLowerCase();
  if (!input) { mostrarToast('Digite o nome de usuário', 'aviso'); return; }
  try {
    let jogador = null;
    if (input.includes('@')) {
      const r = await _avtSb(`players_with_email?email=eq.${encodeURIComponent(input)}&select=id,nickname`);
      jogador = r?.[0] || null;
    } else {
      const r = await _avtSb(`players?nickname=eq.${encodeURIComponent(input)}&select=id,nickname`);
      jogador = r?.[0] || null;
    }
    if (!jogador) { mostrarToast(`Usuário "${input}" não encontrado`, 'erro'); return; }
    const jaExiste = await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${jogador.id}`);
    if (jaExiste?.length) { mostrarToast(`${jogador.nickname} já é membro`, 'aviso'); return; }
    await _avtSb('rpg_members', {
      method: 'POST',
      body: JSON.stringify({ rpg_id: AVT_STATE.rpgId, player_id: jogador.id, nickname: jogador.nickname, role: 'jogador', permissoes: {} })
    });
    AVT_STATE.membros.push({ player_id: jogador.id, nickname: jogador.nickname, role: 'jogador', linked: null });
    mostrarToast(`${jogador.nickname} adicionado!`, 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao adicionar: ' + (e?.message||e), 'erro'); }
}

async function _avtRemoverMembro(playerId) {
  const m = AVT_STATE.membros.find(x => x.player_id === playerId);
  const nick = m?.nickname || playerId.slice(0,8);
  if (!confirm(`Remover ${nick} do dungeon?`)) return;
  try {
    await _avtSb(`rpg_members?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}&player_id=eq.${encodeURIComponent(playerId)}`, { method: 'DELETE' });
    AVT_STATE.membros = AVT_STATE.membros.filter(x => x.player_id !== playerId);
    mostrarToast(`${nick} removido`, 'ok');
    _avtMestrePainelRender();
  } catch(e) { mostrarToast('Erro ao remover: ' + (e?.message||e), 'erro'); }
}

async function entrarAventura(rpgId) {
  // Cancel any existing render loop and event listeners before starting
  _avtCleanupListeners();

  mostrarLoading('Carregando dungeon…');
  try {
    const [rpgs, chars, skills, itemCatalog, attrDefs] = await Promise.all([
      _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=nome`),
      _avtSb(`skills?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*`),
      _avtSb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome,tipo,icone,raridade,img_url,slot_padrao,atributos_bonus&order=id`).catch(()=>[]),
      _avtSb(`attr_defs?rpg_id=eq.${encodeURIComponent(rpgId)}&select=*&order=ordem`).catch(()=>[])
    ]);

    AVT_STATE.rpgId      = rpgId;
    AVT_STATE.rpg        = rpgs?.[0] || { rpg_id: rpgId, name: 'Dungeon' };
    _avtDetectarMestre();
    AVT_STATE.chars      = chars || [];
    AVT_STATE.skills     = skills || [];
    AVT_STATE.itemCatalog = itemCatalog || [];
    AVT_STATE.attrDefs   = attrDefs  || [];
    AVT_STATE.entidades = [];
    AVT_STATE.npcTimers = {};
    AVT_STATE._lastFrameTs = 0;
    AVT_STATE.batalhas = [];

    // Load player assignment (which character this user controls)
    await _avtCarregarAtribuicaoJogador(rpgId);

    // Load or generate dungeon
    const t = AVT_STATE.rpg.theme_json || {};
    if (t.dungeon_data?.tiles) {
      AVT_STATE.dungeon = t.dungeon_data;
    } else {
      AVT_STATE.dungeon = _avtGerarDungeon(60, 40, 8);
    }
    AVT_STATE._tilesetConfig   = AVT_STATE.dungeon.tileset_config  || null;
    AVT_STATE._tilesetImgUrl   = AVT_STATE.dungeon.tileset_img_url || null;
    AVT_STATE._tilesetLoaded   = false;
    AVT_STATE._tilesetTextures = {};
    _avtPopularEntidades();
    _avtAplicarEstadoInimigosPersistido();
    _avtCarregarTodasAparencias();
    // Restaura combates em andamento (persistência)
    _avtCarregarBatalhasAtivas().catch(()=>{});
    // Carregar catálogo e inventário do jogador em background (não bloqueia init)
    if (typeof invCarregarDados === 'function') {
      invCarregarDados(rpgId).then(() => {
        const myChar = AVT_STATE.chars.find(c => c.nome === AVT_STATE.myCharNome);
        if (myChar?.id) invCarregarInventarioChar(myChar.id).catch(() => {});
      }).catch(() => {});
    }

    // Connect realtime for multiplayer sync
    window.CURRENT_RPG = rpgId;
    if (typeof iniciarRealtime === 'function') iniciarRealtime(rpgId);

    // Show screen — must happen BEFORE canvas init
    document.getElementById('hub').style.display = 'none';
    const screen = document.getElementById('aventura-screen');
    if (!screen) throw new Error('Elemento #aventura-screen não encontrado');
    screen.style.display = 'flex';

    // Update header
    document.getElementById('avt-nome').textContent = AVT_STATE.rpg.name;
    document.getElementById('avt-nome').style.color = t.destaque || '#c8a84b';

    // Double-RAF: wait for browser reflow before measuring canvas dimensions
    requestAnimationFrame(() => requestAnimationFrame(() => {
      _avtCanvasInit();
      _avtRenderLoop();
      _avtRenderHpBar();
      ocultarLoading();
      if (AVT_STATE._tilesetConfig && AVT_STATE._tilesetImgUrl) {
        _avtCarregarTileset(AVT_STATE._tilesetImgUrl, AVT_STATE._tilesetConfig)
          .catch(e => console.warn('[tileset] load failed:', e));
      }
    }));

    salvarNav('rpg', rpgId);
  } catch(e) {
    ocultarLoading();
    mostrarToast('Erro ao carregar dungeon: ' + (e?.message || e), 'erro');
    // Ensure hub is visible on error
    const screen = document.getElementById('aventura-screen');
    if (screen) screen.style.display = 'none';
    document.getElementById('hub').style.display = 'block';
  }
}

function sairAventura() {
  _avtCleanupListeners();
  const screen = document.getElementById('aventura-screen');
  if (screen) screen.style.display = 'none';
  document.getElementById('hub').style.display = 'block';
  avtHubRenderSection();
  AVT_STATE.rpgId   = null;
  AVT_STATE.dungeon = null;
  AVT_STATE.entidades = [];
  AVT_STATE.batalhas = [];
  AVT_STATE.mestreReposicionando = null;
  AVT_STATE.aparencias = {};
  AVT_STATE.entAnim = {};
  AVT_STATE.npcTimers = {};
  AVT_STATE.myCharNome = null;
  AVT_STATE.membros = [];
  AVT_STATE._lastFrameTs = 0;
}

function _avtCleanupListeners() {
  if (AVT_STATE.animFrame) { cancelAnimationFrame(AVT_STATE.animFrame); AVT_STATE.animFrame = null; }
  window.removeEventListener('resize', _avtCanvasResize);
  window.removeEventListener('keydown', _avtCanvasKey);
  (AVT_STATE._pendingTimeouts || []).forEach(id => clearTimeout(id));
  AVT_STATE._pendingTimeouts = [];
  if (AVT_STATE._resizeObs) { AVT_STATE._resizeObs.disconnect(); AVT_STATE._resizeObs = null; }
  avtDpadStop();
}

function _avtSetTimeout(fn, ms) {
  const id = setTimeout(fn, ms);
  AVT_STATE._pendingTimeouts.push(id);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// DUNGEON GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function _avtGerarDungeon(w, h, maxRooms) {
  maxRooms = maxRooms || 8;
  const tiles = Array.from({length: h}, () => Array(w).fill(AVT_T.PAREDE));
  const rooms = [];

  const _carveRoom = (rx, ry, rw, rh) => {
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++)
        if (y > 0 && y < h-1 && x > 0 && x < w-1) tiles[y][x] = AVT_T.PISO;
  };
  const _overlaps = (rx, ry, rw, rh) =>
    rooms.some(r => rx < r.x+r.w+2 && rx+rw+2 > r.x && ry < r.y+r.h+2 && ry+rh+2 > r.y);

  // Mais tentativas para dungeons maiores
  const maxAttempts = maxRooms * 20;
  for (let attempt = 0; attempt < maxAttempts && rooms.length < maxRooms; attempt++) {
    const rw = 4 + Math.floor(Math.random() * 7);
    const rh = 3 + Math.floor(Math.random() * 6);
    if (rw >= w - 2 || rh >= h - 2) continue;
    const rx = 1 + Math.floor(Math.random() * (w - rw - 2));
    const ry = 1 + Math.floor(Math.random() * (h - rh - 2));
    if (_overlaps(rx, ry, rw, rh)) continue;
    _carveRoom(rx, ry, rw, rh);
    rooms.push({ x:rx, y:ry, w:rw, h:rh, cx:Math.floor(rx+rw/2), cy:Math.floor(ry+rh/2) });
  }

  // Conectar todas as salas com corredores em L
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i-1], b = rooms[i];
    for (let x = Math.min(a.cx,b.cx); x <= Math.max(a.cx,b.cx); x++)
      if (tiles[a.cy]?.[x] !== undefined) tiles[a.cy][x] = AVT_T.PISO;
    for (let y = Math.min(a.cy,b.cy); y <= Math.max(a.cy,b.cy); y++)
      if (tiles[y]?.[b.cx] !== undefined) tiles[y][b.cx] = AVT_T.PISO;
  }

  return { tiles, w, h, rooms };
}

function _avtGerarDungeonProcedural() {
  const salas = AVT_STATE._criando?._procSalas || 8;
  // Grid cresce proporcionalmente ao número de salas
  const area = Math.max(22*16, salas * 60);
  const w = Math.round(Math.sqrt(area * 1.4));
  const h = Math.round(area / w);
  return _avtGerarDungeon(w, h, salas);
}

// Registra timer de paciência para um inimigo
function _avtInitNpcTimer(ent) {
  AVT_STATE.npcTimers[ent.id] = {
    patience: ent.pacienciaSecs * 1000,
    maxPatience: ent.pacienciaSecs * 1000,
    ativo: false
  };
}

// Popula só os inimigos de um dungeon (usado na entrada de fases extras)
function _avtPopularEntidadesInimigos(dungeon) {
  const d = dungeon || AVT_STATE.dungeon;
  if (!d?.tiles) return;
  const rooms = d.rooms?.length ? d.rooms : _avtDetectarSalas(d);
  const inimigosJson = d._inimigosJson || [];

  if (inimigosJson.length) {
    inimigosJson.forEach((ini, i) => {
      const corBase = ini.cor || '#7a5c00';
      const aparenciaTipo = ini.aparencia_tipo || (ini.isBoss ? 'boss' : 'npc_generico');
      const ent = {
        id: 'ini_' + i, nome: ini.nome || `Inimigo ${i+1}`, tipo: 'inimigo',
        x: ini.x, y: ini.y, hp: ini.hp || 20, hpMax: ini.hp || 20,
        cor: _hexVary(corBase, i), _semNome: !ini.nome,
        pacienciaSecs: ini.pacienciaSecs ?? 5,
        deteccaoRaio: ini.deteccaoRaio ?? 3,
        isBoss: ini.isBoss || false,
        xpBase: ini.xpBase ?? (ini.isBoss ? 50 : 10),
        presetTipo: aparenciaTipo
      };
      AVT_STATE.entidades.push(ent);
      _avtInitNpcTimer(ent);
    });
  } else {
    let uid = 0;
    const presetKeys = Object.keys(AVT_NPC_PRESETS).filter(k => k !== 'boss');
    const bossRoomIdx = rooms.length - 1;
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      const isBossRoom = i === bossRoomIdx && rooms.length > 2;
      if (isBossRoom) {
        const bPreset = AVT_NPC_PRESETS.boss;
        const ent = {
          id: 'ini_boss_fase', nome: 'Boss', tipo: 'inimigo',
          x: r.x + Math.floor(r.w/2), y: r.y + Math.floor(r.h/2),
          hp: bPreset.hpBase, hpMax: bPreset.hpBase,
          cor: bPreset.cor, icone: bPreset.icone, _semNome: true,
          pacienciaSecs: bPreset.pacienciaSecs, deteccaoRaio: bPreset.deteccaoRaio,
          isBoss: true, xpBase: bPreset.xpBase, presetTipo: 'boss'
        };
        AVT_STATE.entidades.push(ent);
        _avtInitNpcTimer(ent);
      } else {
        const count = 1 + Math.floor(Math.random() * Math.min(3, Math.floor(r.w * r.h / 8)));
        for (let j = 0; j < count; j++) {
          const presetKey = presetKeys[uid % presetKeys.length];
          const preset = AVT_NPC_PRESETS[presetKey];
          const ent = {
            id: 'ini_fase_' + uid, nome: `${preset.nome} ${uid+1}`, tipo: 'inimigo',
            x: r.x + 1 + (j % Math.max(1, r.w - 2)),
            y: r.y + 1 + Math.floor(j / Math.max(1, r.w - 2)),
            hp: preset.hpBase, hpMax: preset.hpBase,
            cor: _hexVary(preset.cor, uid), icone: preset.icone, _semNome: true,
            pacienciaSecs: preset.pacienciaSecs, deteccaoRaio: preset.deteccaoRaio,
            isBoss: false, xpBase: preset.xpBase, presetTipo: presetKey
          };
          AVT_STATE.entidades.push(ent);
          _avtInitNpcTimer(ent);
          uid++;
        }
      }
    }
  }
}

function _avtPopularEntidades() {
  const d = AVT_STATE.dungeon;
  AVT_STATE.entidades = [];
  AVT_STATE.npcTimers = {};
  if (!d || !d.rooms?.length && !d.tiles) return;

  const rooms = d.rooms?.length ? d.rooms : _avtDetectarSalas(d);
  const cores = ['#4fa3d1','#27ae60','#c8a84b','#7b2fbe','#e8604c'];

  // Spawn explícito do tileset, ou primeiro tile passável da primeira sala
  const spawns = d._spawnJogadores?.length ? d._spawnJogadores : null;
  const primRoom = rooms[0];

  AVT_STATE.chars.filter(c => c.custom_attrs?.tipo_personagem !== 'npc').forEach((c, i) => {
    const col = c.custom_attrs?.cor || cores[i % cores.length];
    const ca  = c.custom_attrs || {};
    const sp  = spawns?.[i] || spawns?.[0];
    // Priority: saved position → tileset spawn → room fallback
    const sx = typeof ca.avt_x === 'number' ? ca.avt_x
             : sp ? sp.x + (i % 3) : (primRoom?.x||1) + 1 + (i % 3);
    const sy = typeof ca.avt_y === 'number' ? ca.avt_y
             : sp ? sp.y + Math.floor(i/3) : (primRoom?.y||1) + 1 + Math.floor(i/3);
    // Usa aparência personalizada se houver, senão preset genérico
    const temAparencia = !!(ca.aparencia?.modo && ca.aparencia.modo !== 'nenhuma');
    AVT_STATE.entidades.push({
      id: c.id || c.nome, nome: c.nome, tipo: 'jogador',
      x: sx, y: sy,
      hp: c.hp_atual || c.hp_max || 60, hpMax: c.hp_max || 60, cor: col, dbId: c.id,
      presetTipo: temAparencia ? null : 'npc_generico'
    });
  });

  // Populate enemies for this dungeon
  _avtPopularEntidadesInimigos(d);
}

function _avtDetectarSalas(d) {
  // Simple fallback: find first and last piso tile as "room centers"
  const piso = [];
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++)
      if (_avtTilePassavel(x, y, d)) piso.push({x,y});
  if (!piso.length) return [{x:1,y:1,w:3,h:3,cx:2,cy:2}];
  const mid = Math.floor(piso.length / 2);
  return [
    { x:piso[0].x, y:piso[0].y, w:3, h:3, cx:piso[0].x, cy:piso[0].y },
    { x:piso[mid].x, y:piso[mid].y, w:3, h:3, cx:piso[mid].x, cy:piso[mid].y }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS RENDERING — bug-fixed
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasInit() {
  const wrap = document.getElementById('avt-mapa-wrap');
  if (!wrap) return;

  // Destroy old canvas
  const old = document.getElementById('avt-canvas');
  if (old) { old.onclick = null; old.remove(); }
  wrap.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'avt-canvas';
  canvas.style.cssText = 'display:block;cursor:pointer;image-rendering:pixelated;position:absolute;inset:0';
  wrap.appendChild(canvas);

  // Re-add D-pad inside wrap so it stays on top of canvas
  const dpad = document.getElementById('avt-dpad');
  if (dpad) wrap.appendChild(dpad);

  AVT_STATE.canvas = canvas;

  // ResizeObserver for reliable dimensions
  AVT_STATE._resizeObs = new ResizeObserver(() => _avtCanvasResize());
  AVT_STATE._resizeObs.observe(wrap);

  _avtCanvasResize();
  canvas.addEventListener('click', _avtCanvasClick);
  canvas.addEventListener('dblclick', _avtCanvasDblClick);
  window.addEventListener('resize', _avtCanvasResize);
  window.addEventListener('keydown', _avtCanvasKey);

  // ─── PAN do mapa (cursor mãozinha em tiles fora de salas) ───
  AVT_STATE._pan = null;
  const _tileFromEvent = (ev) => {
    const r = canvas.getBoundingClientRect();
    const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
    return {
      x: Math.floor((ev.clientX - r.left + AVT_STATE.camera.x) / SZ),
      y: Math.floor((ev.clientY - r.top  + AVT_STATE.camera.y) / SZ),
    };
  };
  const _tilePanavel = (tx, ty) => {
    // pan disponível quando o tile NÃO tem entidade e NÃO é caminhável de sala
    if (AVT_STATE.mestreReposicionando || AVT_STATE._modoPortaPlacement) return false;
    const ent = AVT_STATE.entidades.find(e => e.x === tx && e.y === ty);
    if (ent) return false;
    // se for tile passável (caminho/sala) → click normal (mover jogador)
    if (_avtTilePassavel && _avtTilePassavel(tx, ty, AVT_STATE.dungeon)) return false;
    return true;
  };
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const t = _tileFromEvent(ev);
    if (!_tilePanavel(t.x, t.y)) return;
    AVT_STATE._pan = {
      startX: ev.clientX, startY: ev.clientY,
      camX: AVT_STATE.camera.x, camY: AVT_STATE.camera.y,
      moved: false, pointerId: ev.pointerId,
    };
    AVT_STATE._userPanned = true;
    canvas.style.cursor = 'grabbing';
    try { canvas.setPointerCapture(ev.pointerId); } catch(_){}
  });
  canvas.addEventListener('pointermove', (ev) => {
    const pan = AVT_STATE._pan;
    if (pan && pan.pointerId === ev.pointerId) {
      const dx = ev.clientX - pan.startX;
      const dy = ev.clientY - pan.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true;
      AVT_STATE.camera.x = Math.round(pan.camX - dx);
      AVT_STATE.camera.y = Math.round(pan.camY - dy);
      return;
    }
    // Hover: cursor grab/pointer
    const t = _tileFromEvent(ev);
    canvas.style.cursor = _tilePanavel(t.x, t.y) ? 'grab' : 'pointer';
  });
  const _endPan = (ev) => {
    const pan = AVT_STATE._pan;
    if (!pan || pan.pointerId !== ev.pointerId) return;
    AVT_STATE._pan = null;
    AVT_STATE._panSuprimirClick = pan.moved;
    canvas.style.cursor = 'pointer';
    try { canvas.releasePointerCapture(ev.pointerId); } catch(_){}
  };
  canvas.addEventListener('pointerup', _endPan);
  canvas.addEventListener('pointercancel', _endPan);

  // Auto-show D-pad on mobile
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (dpad) dpad.style.display = isMobile ? 'block' : 'none';
  const dpadBtn = document.getElementById('avt-btn-dpad');
  if (dpadBtn) dpadBtn.style.display = isMobile ? 'inline-block' : 'none';

  _avtCameraCenter();
}

function _avtCanvasResize() {
  const wrap = document.getElementById('avt-mapa-wrap');
  const canvas = AVT_STATE.canvas;
  if (!wrap || !canvas) return;
  const w = wrap.clientWidth  || window.innerWidth;
  const h = wrap.clientHeight || (window.innerHeight - 130);
  if (w > 0 && h > 0) {
    canvas.width  = w;
    canvas.height = h;
    AVT_STATE.ctx = canvas.getContext('2d');
    // Só centraliza na primeira inicialização — não recentraliza quando a HUD
    // de combate abre/fecha (causava sensação de "câmera puxada pra baixo").
    if (!AVT_STATE._cameraInicializada) _avtCameraCenter();
  }
}

// Centers camera on group centroid — use only for init/reset, not during movement
function _avtCameraCenter() {
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const canvas = AVT_STATE.canvas;
  if (!jogadores.length || !canvas || !canvas.width) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const cx = jogadores.reduce((s, j) => s + j.x, 0) / jogadores.length;
  const cy = jogadores.reduce((s, j) => s + j.y, 0) / jogadores.length;
  AVT_STATE.camera.x = cx * SZ - canvas.width/2  + SZ/2;
  AVT_STATE.camera.y = cy * SZ - canvas.height/2 + SZ/2;
  AVT_STATE._cameraInicializada = true;
}

// Edge-triggered camera: follows only the controlled player to avoid cross-axis drift
function _avtCameraUpdate() {
  const canvas = AVT_STATE.canvas;
  if (!canvas?.width) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const MARGIN = 0.20;
  const mW = canvas.width  * MARGIN;
  const mH = canvas.height * MARGIN;

  const j = _avtMeuJogador() || AVT_STATE.entidades.find(e => e.tipo === 'jogador' && e.hp > 0);
  if (!j) return;

  const px = j.x * SZ - AVT_STATE.camera.x;
  const py = j.y * SZ - AVT_STATE.camera.y;
  let shiftX = 0, shiftY = 0;
  if (px < mW)                 shiftX = px - mW;
  if (px > canvas.width - mW)  shiftX = px - (canvas.width - mW);
  if (py < mH)                 shiftY = py - mH;
  if (py > canvas.height - mH) shiftY = py - (canvas.height - mH);
  AVT_STATE.camera.x = Math.round(AVT_STATE.camera.x + shiftX);
  AVT_STATE.camera.y = Math.round(AVT_STATE.camera.y + shiftY);
}

function _avtRenderLoop() {
  if (AVT_STATE.animFrame) cancelAnimationFrame(AVT_STATE.animFrame);
  const frame = () => {
    if (!AVT_STATE.canvas) return; // safety
    _avtRenderFrame();
    AVT_STATE.animFrame = requestAnimationFrame(frame);
  };
  AVT_STATE.animFrame = requestAnimationFrame(frame);
}

function _avtRenderFrame() {
  const { canvas, ctx, dungeon, entidades, camera } = AVT_STATE;
  if (!ctx || !dungeon || !canvas.width) return;
  // Cinematic hitstop: skip world update while frozen by a VFX
  if (AVT_STATE._fxFreezeUntil && performance.now() < AVT_STATE._fxFreezeUntil) return;

  // Track delta time for patience timers
  const now = performance.now();
  const dt = AVT_STATE._lastFrameTs ? now - AVT_STATE._lastFrameTs : 0;
  AVT_STATE._lastFrameTs = now;

  // Update patience timers (only for enemies not already in a combat)
  _avtAtualizarPaciencias(dt);

  const SZ = Math.round(AVT_SZ * (camera.zoom || 1));

  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < dungeon.h; y++) {
    for (let x = 0; x < dungeon.w; x++) {
      const t  = dungeon.tiles[y]?.[x];
      const px = Math.round(x * SZ - camera.x);
      const py = Math.round(y * SZ - camera.y);
      if (px + SZ < 0 || px > canvas.width || py + SZ < 0 || py > canvas.height) continue;
      if (AVT_STATE._tilesetLoaded) {
        ctx.imageSmoothingEnabled = false;
        // String-key grid (ia_fase): usa a chave diretamente
        // Binary grid (outros modos): usa autotile por vizinhos
        const key = typeof t === 'string' ? t : _avtGetTileSemanticKey(x, y, dungeon);
        const tileImg = key ? AVT_STATE._tilesetTextures[key] : null;
        if (tileImg) { ctx.drawImage(tileImg, px, py, SZ, SZ); continue; }
        if (t === null || t === undefined) continue; // void — fundo já foi preenchido
        ctx.fillStyle = _avtTilePassavel(x, y, dungeon) ? '#101520' : '#0a0c14';
        ctx.fillRect(px, py, SZ, SZ);
      } else if (t === AVT_T.SAIDA) {
        ctx.fillStyle = '#101520';
        ctx.fillRect(px, py, SZ, SZ);
        // Pulsing exit indicator (static glow)
        ctx.fillStyle = 'rgba(79,220,140,0.18)';
        ctx.fillRect(px+2, py+2, SZ-4, SZ-4);
        ctx.strokeStyle = 'rgba(79,220,140,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px+2, py+2, SZ-4, SZ-4);
        ctx.fillStyle = 'rgba(79,220,140,0.8)';
        ctx.font = `${Math.round(SZ*0.55)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚪', px + SZ/2, py + SZ/2);
      } else if (t === AVT_T.PISO || (typeof t === 'string' && _avtTilePassavel(x, y, dungeon))) {
        ctx.fillStyle = '#101520';
        ctx.fillRect(px, py, SZ, SZ);
        ctx.strokeStyle = 'rgba(79,163,209,0.07)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, SZ-1, SZ-1);
      } else {
        ctx.fillStyle = '#0a0c14';
        ctx.fillRect(px, py, SZ, SZ);
        ctx.fillStyle = 'rgba(79,163,209,0.04)';
        ctx.fillRect(px, py, SZ, 3);
        ctx.fillRect(px, py, 3, SZ);
      }
    }
  }

  // Overlay de grade suave nos tilesets (linhas finas e translúcidas)
  if (AVT_STATE._tilesetLoaded) {
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    for (let gx = 0; gx <= dungeon.w; gx++) {
      const gpx = Math.round(gx * SZ - camera.x);
      if (gpx < -1 || gpx > canvas.width + 1) continue;
      ctx.beginPath(); ctx.moveTo(gpx, 0); ctx.lineTo(gpx, canvas.height); ctx.stroke();
    }
    for (let gy = 0; gy <= dungeon.h; gy++) {
      const gpy = Math.round(gy * SZ - camera.y);
      if (gpy < -1 || gpy > canvas.height + 1) continue;
      ctx.beginPath(); ctx.moveTo(0, gpy); ctx.lineTo(canvas.width, gpy); ctx.stroke();
    }
  }

  // Portais de fases extras
  const _fasesExtras = AVT_STATE.rpg?.theme_json?.fases_extras || [];
  if (_fasesExtras.length && !AVT_STATE._faseAnterior) {
    for (const _fase of _fasesExtras) {
      const { col, row } = _fase.porta;
      const fpx = Math.round(col * SZ - camera.x);
      const fpy = Math.round(row * SZ - camera.y);
      if (fpx + SZ < 0 || fpx > canvas.width || fpy + SZ < 0 || fpy > canvas.height) continue;
      const _doorTex = AVT_STATE._tilesetLoaded ? AVT_STATE._tilesetTextures?.['porta_fase'] : null;
      if (_doorTex) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(_doorTex, fpx, fpy, SZ, SZ);
      } else {
        ctx.fillStyle = 'rgba(200,168,75,0.18)';
        ctx.fillRect(fpx + 2, fpy + 2, SZ - 4, SZ - 4);
        ctx.strokeStyle = 'rgba(200,168,75,0.75)';
        ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.strokeRect(fpx + 2, fpy + 2, SZ - 4, SZ - 4);
        ctx.font = `${Math.round(SZ * 0.55)}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,168,75,0.9)';
        ctx.fillText('🚪', fpx + SZ / 2, fpy + SZ / 2);
      }
    }
  }

  const _minhaBat = _avtMinhaBatalha();
  if (_minhaBat?.moverModo) {
    const ativo = _avtAtivo();
    if (ativo) {
      _avtBFS(ativo.x, ativo.y, 3).forEach(pos => {
        ctx.fillStyle = 'rgba(79,163,209,0.2)';
        ctx.fillRect(Math.round(pos.x*SZ-camera.x), Math.round(pos.y*SZ-camera.y), SZ, SZ);
      });
    }
  }

  // Highlight entity being repositioned by master
  if (AVT_STATE.mestreReposicionando) {
    const re = entidades.find(e => e.id === AVT_STATE.mestreReposicionando);
    if (re) {
      ctx.strokeStyle = 'rgba(255,200,50,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5,3]);
      ctx.strokeRect(Math.round(re.x*SZ-camera.x)+2, Math.round(re.y*SZ-camera.y)+2, SZ-4, SZ-4);
      ctx.setLineDash([]);
    }
  }

  entidades.forEach(e => {
    if (e.escondido) return; // NPCs mortos não aparecem no mapa
    const px = Math.round(e.x * SZ - camera.x);
    const py = Math.round(e.y * SZ - camera.y);
    if (px+SZ<0 || px>canvas.width || py+SZ<0 || py>canvas.height) return;

    const isBoss = e.isBoss === true;
    const rBase = Math.floor(SZ * 0.36);
    const r = isBoss ? Math.floor(rBase * 1.4) : rBase;
    const cx = px + SZ/2, cy = py + SZ/2;

    // Atualizar estado de animação (detectar movimento)
    _avtAnimAtualizar(e);

    // Sombra
    ctx.beginPath();
    ctx.ellipse(cx, cy+r+2, r-2, 4, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Detection radius outline for enemies when patience active (only if not in combat)
    if (e.tipo === 'inimigo' && !_avtBatalhaDeEnt(e.id)) {
      const timer = AVT_STATE.npcTimers[e.id];
      if (timer?.ativo) {
        // Patience ring (outer)
        const pct = timer.patience / timer.maxPatience;
        const rPat = r + 7;
        ctx.beginPath(); ctx.arc(cx, cy, rPat, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rPat, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
        ctx.strokeStyle = pct > 0.5 ? '#f39c12' : '#e74c3c';
        ctx.lineWidth = 2.5; ctx.stroke();
      }
    }

    // Sprite animado se disponível, senão SVG de criatura, senão fallback círculo+ícone/letra
    const ap = AVT_STATE.aparencias[e.id];
    if (ap && ap.loaded) {
      _avtDesenharAparencia(ctx, e, cx, cy, SZ, ap);
    } else {
      // Tentar renderizar SVG de criatura a partir do presetTipo
      const creatureModelKey = AVT_PRESET_TO_CREATURE[e.presetTipo];
      const creatureImg = creatureModelKey ? _avtGetCreatureImg(creatureModelKey, e.cor) : null;
      if (creatureImg && creatureImg.complete && creatureImg.naturalWidth > 0) {
        const imgH = SZ * 0.95;
        const ratio = creatureImg.naturalWidth / creatureImg.naturalHeight;
        const imgW = imgH * (isFinite(ratio) && ratio > 0 ? ratio : 1);
        ctx.drawImage(creatureImg, cx - imgW/2, py + SZ - imgH, imgW, imgH);
        // Contorno colorido sutil
        ctx.beginPath();
        ctx.arc(cx, cy + SZ*0.05, r * 0.5, 0, Math.PI*2);
        ctx.strokeStyle = isBoss ? 'rgba(231,76,60,0.4)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Fallback: círculo com ícone/letra
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = e.cor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        if (isBoss) {
          ctx.strokeStyle = '#e74c3c';
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = e.tipo==='inimigo' ? 'rgba(232,96,76,0.6)' : 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
        ctx.fillStyle = '#fff';
        const icone = e.icone || e.nome[0]?.toUpperCase() || '?';
        const fontSize = icone.length === 1 ? Math.floor(SZ * (isBoss ? 0.38 : 0.28)) : Math.floor(SZ * 0.26);
        ctx.font = `bold ${fontSize}px Cinzel,serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icone, cx, cy);
      }
    }

    // Boss: coroa acima da entidade
    if (isBoss) {
      ctx.font = `${Math.floor(SZ * 0.32)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', cx, py + SZ * 0.09);
    }

    // Anel de HP por cima
    const hpPct = e.hp / e.hpMax;
    ctx.beginPath();
    ctx.arc(cx, cy, r+2, -Math.PI/2, -Math.PI/2 + Math.PI*2*hpPct);
    ctx.strokeStyle = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Equipped weapon icon overlay (bottom-right corner)
    const dbCharForEquip = AVT_STATE.chars.find(c=>c.id===e.dbId||c.nome===e.nome);
    const equippedWeapon = dbCharForEquip?.custom_attrs?.equipamento?.arma_principal;
    if (equippedWeapon && typeof equippedWeapon === 'object' && equippedWeapon.img_url) {
      const iconSz = Math.round(SZ * 0.38);
      const iconX = cx + r * 0.55, iconY = cy + r * 0.55;
      const cached = AVT_STATE.aparencias[e.id + '_weapon'];
      if (cached?.img?.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSz/2 + 1, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(10,12,20,0.85)';
        ctx.fill();
        ctx.drawImage(cached.img, iconX - iconSz/2, iconY - iconSz/2, iconSz, iconSz);
        ctx.restore();
      } else if (!cached) {
        const img = new Image();
        img.onload = () => {};
        img.src = equippedWeapon.img_url;
        AVT_STATE.aparencias[e.id + '_weapon'] = { img };
      }
    }

    // Contorno de turno ativo (in any active combat)
    if (AVT_STATE.batalhas.some(b => b.iniciativa[b.turnoIdx]?.id === e.id)) {
      ctx.beginPath();
      ctx.arc(cx, cy, r+5, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(200,168,75,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Meu personagem: destaque sutil
    if (e.nome === AVT_STATE.myCharNome) {
      ctx.beginPath();
      ctx.arc(cx, cy, r+4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(79,163,209,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3,3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Alvo selecionado: anel pulsante magenta
    if (AVT_STATE.alvoSelecionado === e.id) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 280);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(232, 80, 200, ${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HP numérico
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.floor(SZ*0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${e.hp}`, cx, cy+r+9);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// APARÊNCIA ANIMADA — carregamento + render no canvas (idle/walk/attack)
// ─────────────────────────────────────────────────────────────────────────────

function _avtCarregarTodasAparencias() {
  (AVT_STATE.entidades || []).forEach(ent => _avtCarregarAparencia(ent));
}

function _avtCarregarAparencia(ent) {
  if (!ent) return;
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome);

  // Top-down IA token (image uploaded by user, coords from AI)
  const tdData = dbChar?.custom_attrs?.topdown_ia;
  if (tdData?.img_url) { _avtCarregarTopdownIa(ent, tdData); return; }

  const data   = dbChar?.custom_attrs?.animado_data;
  if (!data || !data.parts) return;

  const partImgs = {};
  const keys = Object.keys(data.parts);
  let pending = keys.length;
  const rec = { parts: data.parts, animations: data.animations || {}, partImgs, loaded: false };
  AVT_STATE.aparencias[ent.id] = rec;
  AVT_STATE.entAnim[ent.id] = {
    state: 'idle', stateStart: performance.now(),
    lastX: ent.x, lastY: ent.y,
    walkUntil: 0, attackUntil: 0, facing: 1, dir: { dx: 0, dy: 1 }
  };

  if (!pending) { rec.loaded = true; return; }
  keys.forEach(k => {
    const part = data.parts[k];
    if (!part?.texture) { pending--; if (!pending) rec.loaded = true; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { partImgs[k] = img; if (--pending <= 0) rec.loaded = true; };
    img.onerror = () => { if (--pending <= 0) rec.loaded = Object.keys(partImgs).length > 0; };
    img.src = part.texture;
  });
}

function _avtCarregarTopdownIa(ent, tdData) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const coords = { ...(tdData.coords || {}) };
  if (tdData.base_facing) coords.base_facing = tdData.base_facing;
  const rec = { tipo: 'topdown_ia', img, coords, loaded: false };
  AVT_STATE.aparencias[ent.id] = rec;
  if (!AVT_STATE.entAnim[ent.id]) {
    AVT_STATE.entAnim[ent.id] = {
      state: 'idle', stateStart: performance.now(),
      lastX: ent.x, lastY: ent.y, walkUntil: 0, attackUntil: 0, facing: 1, dir: { dx: 0, dy: 1 }
    };
  }
  img.onload  = () => { rec.loaded = true; };
  img.onerror = () => { rec.loaded = false; };
  img.src = tdData.img_url;
}

function _avtSetEntState(entId, state) {
  const a = AVT_STATE.entAnim[entId];
  if (!a) return;
  const ap = AVT_STATE.aparencias[entId];
  const now = performance.now();
  if (state === 'attack') {
    const dur = ap?.animations?.attack?.duration || 400;
    a.attackUntil = now + dur;
    a.state = 'attack';
    a.stateStart = now;
  } else if (state === 'walk') {
    const dur = ap?.animations?.walk?.duration || 600;
    a.walkUntil = now + Math.max(180, dur * 0.6);
    if (a.state !== 'walk' && a.state !== 'attack') { a.state = 'walk'; a.stateStart = now; }
  } else {
    a.state = 'idle'; a.stateStart = now;
  }
}

function _avtAnimAtualizar(ent) {
  let a = AVT_STATE.entAnim[ent.id];
  if (!a) {
    a = AVT_STATE.entAnim[ent.id] = {
      state: 'idle', stateStart: performance.now(),
      lastX: ent.x, lastY: ent.y, walkUntil: 0, attackUntil: 0, facing: 1, dir: { dx: 0, dy: 1 }
    };
  }
  const now = performance.now();
  if (ent.x !== a.lastX || ent.y !== a.lastY) {
    const dx = ent.x - a.lastX, dy = ent.y - a.lastY;
    if (dx !== 0) a.facing = dx > 0 ? 1 : -1;
    // Vetor de direção (top-down precisa de dx e dy para rotacionar)
    if (dx !== 0 || dy !== 0) a.dir = { dx, dy };
    a.lastX = ent.x; a.lastY = ent.y;
    _avtSetEntState(ent.id, 'walk');
  }
  // Resolver estado atual
  if (now < a.attackUntil) {
    if (a.state !== 'attack') { a.state = 'attack'; a.stateStart = now - (now - a.attackUntil + (AVT_STATE.aparencias[ent.id]?.animations?.attack?.duration || 400)); }
  } else if (now < a.walkUntil) {
    if (a.state !== 'walk') { a.state = 'walk'; a.stateStart = now; }
  } else {
    if (a.state !== 'idle') { a.state = 'idle'; a.stateStart = now; }
  }
}

function _avtInterp(a, b, t) { return a + (b - a) * t; }

function _avtFrameTransform(anim, partKey, tMs) {
  // Retorna {x,y,scaleX,scaleY,rotation} interpolado entre keyframes
  const frames = anim?.frames || [];
  if (!frames.length) return { x:0, y:0, scaleX:1, scaleY:1, rotation:0 };
  const dur = anim.duration || frames[frames.length-1].t || 1000;
  let t = tMs;
  if (anim.loop !== false) t = ((t % dur) + dur) % dur;
  else t = Math.min(t, dur);

  // Pegar transforms da parte específica ou _full
  const getT = (f) => f.transforms?.[partKey] || f.transforms?._full || {};
  let prev = frames[0], next = frames[frames.length-1];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t <= t) prev = frames[i];
    if (frames[i].t >= t) { next = frames[i]; break; }
  }
  const span = Math.max(1, (next.t - prev.t));
  const k = next === prev ? 0 : (t - prev.t) / span;
  const pT = getT(prev), nT = getT(next);
  return {
    x:        _avtInterp(pT.x        ?? 0, nT.x        ?? 0, k),
    y:        _avtInterp(pT.y        ?? 0, nT.y        ?? 0, k),
    scaleX:   _avtInterp(pT.scaleX   ?? 1, nT.scaleX   ?? 1, k),
    scaleY:   _avtInterp(pT.scaleY   ?? 1, nT.scaleY   ?? 1, k),
    rotation: _avtInterp(pT.rotation ?? 0, nT.rotation ?? 0, k)
  };
}

function _avtDesenharTopdownIa(ctx, ent, cx, cy, SZ, ap) {
  if (!ap.loaded || !ap.img) return;
  const a = AVT_STATE.entAnim[ent.id];
  const now = performance.now();

  // Tudo proporcional — funciona para QUALQUER resolução de imagem que a IA gere.
  const iw = ap.img.naturalWidth  || ap.img.width  || 1;
  const ih = ap.img.naturalHeight || ap.img.height || 1;
  const c  = ap.coords || {};

  // Fração da imagem ocupada pelo corpo (raio relativo à LARGURA).
  // Fallback: assume que o personagem ocupa ~70% do quadro (raio 0.35).
  const bodyRFrac = (typeof c.body_r === 'number' && c.body_r > 0.02) ? c.body_r : 0.35;

  // Pivô / âncora dentro da imagem (fração 0–1). Default: centro do corpo, ou meio-meio.
  const pivotXFrac = (typeof c.pivot_x === 'number') ? c.pivot_x
                   : (typeof c.body_cx === 'number') ? c.body_cx : 0.5;
  const pivotYFrac = (typeof c.pivot_y === 'number') ? c.pivot_y
                   : (typeof c.body_cy === 'number') ? c.body_cy : 0.5;

  // Tamanho-alvo do corpo no canvas (em px) — fração do tile.
  const targetBodyRpx = SZ * 0.32;
  // Escala que faz o raio do corpo (bodyRFrac * iw) virar targetBodyRpx no canvas.
  const scale = targetBodyRpx / (bodyRFrac * iw);

  const drawW = iw * scale;
  const drawH = ih * scale;
  // Offset para que o pivô caia em (0,0) após translate(cx,cy).
  const offX = -pivotXFrac * drawW;
  const offY = -pivotYFrac * drawH;

  // Rotação baseada na direção de movimento (vetor a.dir)
  // base_facing indica para onde a arte "olha" originalmente:
  //   'down' (default) | 'up' | 'right' | 'left'
  const baseFacing = c.base_facing || 'down';
  const baseAngles = { down: 0, left: Math.PI/2, up: Math.PI, right: -Math.PI/2 };
  const baseAng = baseAngles[baseFacing] ?? 0;
  let angle = baseAng;
  if (a?.dir && (a.dir.dx !== 0 || a.dir.dy !== 0)) {
    // atan2(dy,dx): leste=0, sul=PI/2, oeste=PI, norte=-PI/2
    // Subtraímos PI/2 para que vetor "sul" (dy=1) fique com ângulo 0 (que somado a baseAng=down=0 mantém arte virada pra baixo)
    angle = Math.atan2(a.dir.dy, a.dir.dx) - Math.PI/2 + baseAng;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (!a || a.state === 'idle') {
    const bob = Math.sin(now / 600) * 1.5;
    ctx.translate(0, bob);
    ctx.scale(1, 1 + Math.sin(now / 800) * 0.02);
  } else if (a.state === 'walk') {
    // Animação de andar mais visível: bob vertical + leve balanço lateral
    const bobY = Math.sin(now / 150) * 4;
    const sway = 1 + Math.sin(now / 150) * 0.06;
    ctx.translate(0, bobY);
    ctx.scale(sway, 2 - sway);
  } else if (a.state === 'attack') {
    const t = Math.min(1, (now - (a.stateStart || now)) / 400);
    ctx.translate(0, -Math.sin(t * Math.PI) * 8); // "lança" pra frente (já rotacionado)
  }
  ctx.drawImage(ap.img, offX, offY, drawW, drawH);
  ctx.restore();
}

function _avtDesenharAparencia(ctx, ent, cx, cy, SZ, ap) {
  // Top-down IA token: render uploaded image with simple animation
  if (ap.tipo === 'topdown_ia') { _avtDesenharTopdownIa(ctx, ent, cx, cy, SZ, ap); return; }

  const a = AVT_STATE.entAnim[ent.id];
  const anim = ap.animations?.[a?.state] || ap.animations?.idle;
  const tMs = a ? (performance.now() - a.stateStart) : 0;

  // Caixa-alvo do sprite — proporcional ao tile
  const targetH = Math.round(SZ * 0.95);

  ctx.save();
  ctx.translate(cx, cy);
  if (a && a.facing < 0) ctx.scale(-1, 1);

  // Renderiza cada parte (ordem do objeto)
  const partKeys = Object.keys(ap.parts);
  for (const k of partKeys) {
    const part = ap.parts[k];
    const img  = ap.partImgs[k];
    if (!img) continue;
    const tr = _avtFrameTransform(anim, k, tMs);

    const pW = part.width  || img.naturalWidth  || 64;
    const pH = part.height || img.naturalHeight || 64;
    const scale = targetH / pH;

    const drawW = pW * scale * (tr.scaleX || 1);
    const drawH = pH * scale * (tr.scaleY || 1);
    const ox = ((part.x || 0) + (tr.x || 0)) * scale;
    const oy = ((part.y || 0) + (tr.y || 0)) * scale;

    ctx.save();
    ctx.translate(ox, oy);
    if (tr.rotation) ctx.rotate(tr.rotation);
    try {
      ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
    } catch(e) { /* ignore broken frame */ }
    ctx.restore();
  }
  ctx.restore();
}

function _avtBFS(startX, startY, range) {
  const visited = new Map();
  const queue = [{x:startX, y:startY, dist:0}];
  visited.set(`${startX},${startY}`, true);
  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.dist > 0) result.push({x:cur.x, y:cur.y});
    if (cur.dist >= range) continue;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx=cur.x+dx, ny=cur.y+dy, key=`${nx},${ny}`;
      if (visited.has(key)) return;
      if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
      visited.set(key, true);
      queue.push({x:nx, y:ny, dist:cur.dist+1});
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT — keyboard (desktop) + click
// ─────────────────────────────────────────────────────────────────────────────

function _avtCanvasClick(e) {
  // Suprime click logo após um drag de pan do mapa
  if (AVT_STATE._panSuprimirClick) { AVT_STATE._panSuprimirClick = false; return; }
  const canvas = AVT_STATE.canvas;
  const rect = canvas.getBoundingClientRect();
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const tileX = Math.floor((e.clientX - rect.left + AVT_STATE.camera.x) / SZ);
  const tileY = Math.floor((e.clientY - rect.top  + AVT_STATE.camera.y) / SZ);

  // Door placement mode for nova fase wizard
  if (AVT_STATE._modoPortaPlacement) {
    AVT_STATE._modoPortaPlacement = false;
    canvas.style.cursor = '';
    if (AVT_STATE._novaFaseWizard) {
      AVT_STATE._novaFaseWizard.porta_col = tileX;
      AVT_STATE._novaFaseWizard.porta_row = tileY;
    }
    _avtMestreNovaFaseRender();
    mostrarToast(`Porta definida em (${tileX}, ${tileY})`, 'ok');
    return;
  }

  const ent = AVT_STATE.entidades.find(e => e.x===tileX && e.y===tileY);

  // Master reposition mode: move selected entity to clicked tile
  if (AVT_STATE.mestreReposicionando) {
    const re = AVT_STATE.entidades.find(e => e.id === AVT_STATE.mestreReposicionando);
    if (re && _avtTilePassavel(tileX, tileY, AVT_STATE.dungeon)) {
      re.x = tileX; re.y = tileY;
      AVT_STATE.batalhas.forEach(b => {
        const bi = b.iniciativa.find(ei => ei.id === re.id);
        if (bi) { bi.x = tileX; bi.y = tileY; }
      });
      realtimeBroadcast('avt_token_move', { nome: re.nome, x: re.x, y: re.y });
      _avtDebounceSalvarPosicao(re);
      mostrarToast(`${re.nome} reposicionado`, 'ok');
    }
    AVT_STATE.mestreReposicionando = null;
    return;
  }

  const minhaBat = _avtMinhaBatalha();
  if (minhaBat) {
    if (minhaBat.moverModo) {
      const ativo = _avtAtivo();
      const isMestreCtrl = AVT_STATE.npcControlando && ativo?.id === AVT_STATE.npcControlando;
      if (ativo?.tipo === 'jogador' || isMestreCtrl) {
        if (!minhaBat.movimentoRestante) minhaBat.movimentoRestante = {};
        const movRange = minhaBat.movimentoRestante[ativo.id] ?? _avtGetMovimentoMax(ativo);
        const reachable = _avtBFS(ativo.x, ativo.y, movRange);
        if (reachable.some(p => p.x===tileX && p.y===tileY)) {
          const entAtivo = AVT_STATE.entidades.find(e=>e.id===ativo.id);
          // Deduct movement cost before moving
          const cost = Math.max(1, Math.abs(tileX - ativo.x) + Math.abs(tileY - ativo.y));
          minhaBat.movimentoRestante[ativo.id] = Math.max(0, movRange - cost);
          ativo.x = tileX; ativo.y = tileY;
          if (entAtivo) { entAtivo.x = tileX; entAtivo.y = tileY; }
          if (!minhaBat._moveuNesteTurno) minhaBat._moveuNesteTurno = {};
          minhaBat._moveuNesteTurno[ativo.id] = true;
          const movLeft2 = minhaBat.movimentoRestante[ativo.id];
          if (movLeft2 <= 0) {
            minhaBat.moverModo = false;
          } else {
            mostrarToast(`↔ Movimento: ${movLeft2} célula(s) restante(s)`, '');
          }
          _avtLog(`${ativo.nome} move para (${tileX},${tileY})`, minhaBat.id);
          _avtCheckAbandonoCombate(ativo, minhaBat);
          _avtHudUpdate(); _avtCameraUpdate();
          realtimeBroadcast('avt_token_move', { nome: ativo.nome, x: tileX, y: tileY });
          if (ativo.tipo === 'jogador') _avtDebounceSalvarPosicao(ativo);
          else _avtDebounceSalvarPosicaoNpc(ativo);
        }
      }
    } else if (ent?.tipo === 'inimigo') {
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isMobile) {
        _avtMostrarListaAlvosMobile(minhaBat);
      } else {
        AVT_STATE.alvoSelecionado = ent.id;
        const sel = document.getElementById('avt-hud-alvo');
        if (sel) sel.value = ent.id;
        _avtMostrarSkillOverlay();
      }
    }
  } else if (!ent || ent.tipo !== 'inimigo') {
    const jogador = _avtMeuJogador();
    if (jogador && _avtTilePassavel(tileX, tileY, AVT_STATE.dungeon)) {
      const _oldX = jogador.x, _oldY = jogador.y;
      jogador.x = tileX; jogador.y = tileY;
      // Ao mover o personagem, retoma o follow da câmera no jogador
      if (AVT_STATE._userPanned) { AVT_STATE._userPanned = false; _avtCameraCenter(); }
      _avtCameraUpdate();
      _avtCheckProximidadeInimigos();
      realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
      _avtDebounceSalvarPosicao(jogador);
      _avtVerificarPortaFase(tileX, tileY);
      _avtVerificarSaida(tileX, tileY);
      // Recuperação passiva: +1 HP e +1 recurso por célula percorrida (distância Manhattan)
      _avtRecuperarPorMovimento(jogador, Math.max(1, Math.abs(tileX - _oldX) + Math.abs(tileY - _oldY)));
    }
  }
}

function _avtCanvasDblClick(e) {
  const canvas = AVT_STATE.canvas;
  const rect = canvas.getBoundingClientRect();
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const tileX = Math.floor((e.clientX - rect.left + AVT_STATE.camera.x) / SZ);
  const tileY = Math.floor((e.clientY - rect.top  + AVT_STATE.camera.y) / SZ);
  const ent = AVT_STATE.entidades.find(e => e.x === tileX && e.y === tileY);
  if (ent) {
    e.preventDefault();
    abrirAvtCharEditor(ent.id);
  }
}

function _avtCanvasKey(e) {
  // Only capture keys when aventura screen is visible
  if (document.getElementById('aventura-screen')?.style.display === 'none') return;
  const keys = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
                 a:[-1,0], d:[1,0], w:[0,-1], s:[0,1] };
  const dir = keys[e.key];
  if (!dir) return;
  const _myBatKey = _avtMinhaBatalha();
  if (_myBatKey) {
    // Em combate: só mover se for o turno do jogador
    const ativo  = _avtAtivo();
    const meuJog = _avtMeuJogador();
    if (!ativo || !meuJog || ativo.id !== meuJog.id) return;
    // Auto-ativar moverModo para que o movimento seja processado
    if (!_myBatKey.moverModo) _myBatKey.moverModo = true;
  }
  e.preventDefault();
  _avtMoverJogador(dir[0], dir[1]);
}

// Entrada do D-pad do controle mobile para o modo aventura
function _avtDpadControle(dc, dr) {
  const bat     = _avtMinhaBatalha();
  const jogador = _avtMeuJogador();
  if (!jogador) return;

  if (bat) {
    const ativo = _avtAtivo();
    if (!ativo || ativo.id !== jogador.id) {
      mostrarToast('⏳ Aguarde seu turno', 'aviso', 2000);
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }
    // Auto-ativar moverModo para o turno do jogador
    if (!bat.moverModo) bat.moverModo = true;
  }
  _avtMoverJogador(dc, dr);
  // Atualizar HUD do controle mobile se ativo
  if (typeof _atualizarZonaCentral === 'function') _atualizarZonaCentral();
  if (typeof _atualizarZonaDireita === 'function') _atualizarZonaDireita();
}
window._avtDpadControle = _avtDpadControle;

// Returns the entity the current user controls (their assigned character, or any player if master active)
function _avtMeuJogador() {
  // Prefer linked character (works for master and player alike)
  if (AVT_STATE.myCharNome) {
    const linked = AVT_STATE.entidades.find(e => e.nome === AVT_STATE.myCharNome && e.tipo === 'jogador');
    if (linked) return linked;
  }
  // mestreAtivo without a linked char: fall back to first living player
  if (AVT_STATE.isMestre && AVT_STATE.mestreAtivo) {
    return AVT_STATE.entidades.find(e => e.tipo === 'jogador' && e.hp > 0)
        || AVT_STATE.entidades.find(e => e.tipo === 'jogador');
  }
  // Fallback só para sessão solo (único jogador no mapa, sem vínculo configurado)
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  return jogadores.length === 1 ? jogadores[0] : null;
}

function _avtMoverJogador(dx, dy) {
  const minhaBat = _avtMinhaBatalha();
  // In combat moverModo, allow master to move the controlled NPC via WASD/dpad
  let jogador;
  if (minhaBat?.moverModo && AVT_STATE.npcControlando) {
    const ativo = _avtAtivo();
    if (ativo?.id === AVT_STATE.npcControlando)
      jogador = AVT_STATE.entidades.find(e => e.id === AVT_STATE.npcControlando);
  }
  if (!jogador) jogador = _avtMeuJogador();
  if (!jogador) return;
  const nx = jogador.x + dx, ny = jogador.y + dy;
  if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
  if (minhaBat?.moverModo) {
    if (!minhaBat.movimentoRestante) minhaBat.movimentoRestante = {};
    const movRestante = minhaBat.movimentoRestante[jogador.id] ?? _avtGetMovimentoMax(jogador);
    if (movRestante <= 0) {
      mostrarToast('🚫 Movimento esgotado', 'aviso', 2000);
      minhaBat.moverModo = false;
      return;
    }
    const reachable = _avtBFS(jogador.x, jogador.y, movRestante);
    if (!reachable.some(p => p.x===nx && p.y===ny)) return;
    const ativo = _avtAtivo();
    if (ativo?.id === jogador.id) {
      const cost = (dx !== 0 && dy !== 0) ? 2 : 1; // diagonal custa 2
      minhaBat.movimentoRestante[jogador.id] = Math.max(0, movRestante - cost);
      ativo.x = nx; ativo.y = ny;
      jogador.x = nx; jogador.y = ny;
      if (!minhaBat._moveuNesteTurno) minhaBat._moveuNesteTurno = {};
      minhaBat._moveuNesteTurno[jogador.id] = true;
      const movLeft = minhaBat.movimentoRestante[jogador.id];
      if (movLeft <= 0) {
        minhaBat.moverModo = false;
        mostrarToast('🚫 Movimento esgotado', '', 1800);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      } else {
        mostrarToast(`↔ ${movLeft} célula(s) restante(s)`, '', 1200);
      }
      _avtLog(`${jogador.nome} move para (${nx},${ny})`, minhaBat.id);
      _avtCheckAbandonoCombate(ativo, minhaBat);
      _avtHudUpdate();
      realtimeBroadcast('avt_token_move', { nome: ativo.nome, x: nx, y: ny });
      if (ativo.tipo === 'jogador') _avtDebounceSalvarPosicao(ativo);
      else _avtDebounceSalvarPosicaoNpc(ativo);
    }
  } else if (!minhaBat) {
    jogador.x = nx; jogador.y = ny;
    if (AVT_STATE._userPanned) { AVT_STATE._userPanned = false; _avtCameraCenter(); }
    _avtCheckProximidadeInimigos();
    // Se jogador entrou na área de um combate ativo, entra imediatamente
    _avtCheckEntradaCombateAtivo(jogador);
    realtimeBroadcast('avt_token_move', { nome: jogador.nome, x: jogador.x, y: jogador.y });
    _avtDebounceSalvarPosicao(jogador);
    _avtVerificarPortaFase(jogador.x, jogador.y);
    // Recuperação passiva: +1 HP e +1 recurso por célula percorrida
    _avtRecuperarPorMovimento(jogador, 1);
  }
  _avtCameraUpdate();
}

// If player walks into an active combat's area, join immediately (no patience timer)
function _avtCheckEntradaCombateAtivo(jogador) {
  if (!jogador || _avtBatalhaDeEnt(jogador.id)) return;
  for (const bat of AVT_STATE.batalhas) {
    const dist = Math.abs(jogador.x - bat.centroX) + Math.abs(jogador.y - bat.centroY);
    if (dist <= (bat.raio ?? 3)) {
      bat.envolvidos.push(jogador.id);
      const initRoll = Math.floor(Math.random()*20)+1+4;
      bat.iniciativa.push({ ...jogador, initRoll });
      bat.iniciativa.sort((a,b) => b.initRoll - a.initRoll);
      if (bat.turnoIdx >= bat.iniciativa.length) bat.turnoIdx = 0;
      _avtLog(`${jogador.nome} entrou no combate!`, bat.id);
      mostrarToast(`${jogador.nome} entrou no combate!`, 'aviso');
      _avtHudMostrar(true);
      _avtHudUpdate();
      _avtBroadcastJoinBatalha(bat.id, jogador.id, jogador.nome);
      _avtBroadcastBatalha(bat);
      break;
    }
  }
}

function _avtCheckProximidadeInimigos() {
  if (AVT_STATE.batalhaAutoSuspensa) return;
  // Only check enemies that are NOT already in a combat
  const enemiesLivres = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  if (!enemiesLivres.length) return;
  // Only free players (not in any combat) can trigger new combats
  const jogadoresLivres = AVT_STATE.entidades.filter(e => e.tipo === 'jogador' && e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  enemiesLivres.forEach(ini => {
    const raio = ini.deteccaoRaio ?? 3;
    const emRaio = jogadoresLivres.some(j => Math.abs(j.x - ini.x) + Math.abs(j.y - ini.y) <= raio);
    if (!AVT_STATE.npcTimers[ini.id]) {
      const maxMs = (ini.pacienciaSecs ?? 5) * 1000;
      AVT_STATE.npcTimers[ini.id] = { patience: maxMs, maxPatience: maxMs, ativo: false };
    }
    const timer = AVT_STATE.npcTimers[ini.id];
    if (emRaio) {
      timer.ativo = true;
    } else {
      timer.ativo = false;
      timer.patience = timer.maxPatience;
    }
  });
}

function _avtAtualizarPaciencias(dt) {
  if (!dt) return;
  for (const [id, timer] of Object.entries(AVT_STATE.npcTimers)) {
    if (!timer.ativo) continue;
    // Skip if this enemy is already in a combat
    if (_avtBatalhaDeEnt(id)) { timer.ativo = false; continue; }
    timer.patience = Math.max(0, timer.patience - dt);
    if (timer.patience <= 0) {
      const ini = AVT_STATE.entidades.find(e => e.id === id);
      if (ini) avtCombateIniciar(ini);
      timer.patience = timer.maxPatience;
      timer.ativo = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE D-PAD
// ─────────────────────────────────────────────────────────────────────────────

var _avtDpadTimer = null;

function avtDpad(dx, dy) {
  clearInterval(_avtDpadTimer);
  _avtDpadDoMove(dx, dy);
  if (navigator.vibrate) navigator.vibrate(15);
  _avtDpadTimer = setInterval(() => _avtDpadDoMove(dx, dy), 200);
}

function avtDpadStop() {
  clearInterval(_avtDpadTimer);
  _avtDpadTimer = null;
}

function _avtDpadDoMove(dx, dy) {
  _avtMoverJogador(dx, dy);
}

function _avtToggleDpad() {
  const dpad = document.getElementById('avt-dpad');
  if (!dpad) return;
  dpad.style.display = dpad.style.display === 'none' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLAYER SYNC
// ─────────────────────────────────────────────────────────────────────────────

// Receive remote player/NPC movement broadcast
function avtReceberMovimento({ nome, x, y }) {
  // Accept even if adventure not fully loaded — entities may still exist
  const ent = AVT_STATE.entidades.find(e => e.nome === nome);
  if (!ent) return;
  ent.x = x; ent.y = y;
  // Sync initiative snapshot if in combat
  const bat = AVT_STATE.batalhas.find(b => b.iniciativa.some(e => e.nome === nome));
  if (bat) {
    const init = bat.iniciativa.find(e => e.nome === nome);
    if (init) { init.x = x; init.y = y; }
  }
  // Force repaint so other clients see the token move immediately
  if (typeof _avtCameraUpdate === 'function') _avtCameraUpdate();
  if (typeof _avtRender === 'function') _avtRender();
}
window.avtReceberMovimento = avtReceberMovimento;

// Receive combat-start broadcast from master
function avtReceberCombateInicio(payload) {
  if (!AVT_STATE.rpgId) return;
  // Apply positions from payload first
  if (payload.posicoes) {
    payload.posicoes.forEach(({ nome, x, y }) => {
      const ent = AVT_STATE.entidades.find(e => e.nome === nome);
      if (ent) { ent.x = x; ent.y = y; }
    });
  }
  // Find or create combat with the given id
  if (payload.batalhaId && AVT_STATE.batalhas.some(b => b.id === payload.batalhaId)) return;
  // Find the trigger enemy if provided
  const iniEnt = payload.iniNome ? AVT_STATE.entidades.find(e => e.nome === payload.iniNome) : null;
  avtCombateIniciar(iniEnt, payload.batalhaId);
}
window.avtReceberCombateInicio = avtReceberCombateInicio;

// Broadcast full battle state so all clients stay in sync after every action
function _avtBroadcastBatalha(bat) {
  if (!bat) return;
  const snapshot = {
    id: bat.id,
    turnoIdx: bat.turnoIdx,
    log: bat.log.slice(0, 10),
    envolvidos: bat.envolvidos,
    iniciativa: bat.iniciativa.map(e => ({ id: e.id, nome: e.nome, hp: e.hp, hpMax: e.hpMax, tipo: e.tipo, initRoll: e.initRoll })),
  };
  realtimeBroadcast('avt_batalha_update', snapshot);
  // Persistência: snapshot completo na tabela batalhas
  _avtPersistirBatalha(bat);
}

// Receive battle-state update from any client
function avtReceberBatalhaUpdate(payload) {
  if (!AVT_STATE.rpgId || !payload?.id) return;
  const bat = AVT_STATE.batalhas.find(b => b.id === payload.id);
  if (!bat) return;
  bat.turnoIdx = payload.turnoIdx ?? bat.turnoIdx;
  if (Array.isArray(payload.log)) bat.log = payload.log;
  if (Array.isArray(payload.iniciativa)) {
    payload.iniciativa.forEach(snap => {
      const local = bat.iniciativa.find(e => e.id === snap.id);
      if (local) { local.hp = snap.hp; local.hpMax = snap.hpMax; }
      const ent = AVT_STATE.entidades.find(e => e.id === snap.id);
      if (ent) { ent.hp = snap.hp; ent.hpMax = snap.hpMax; }
    });
  }
  _avtRenderHpBar();
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberBatalhaUpdate = avtReceberBatalhaUpdate;

// Broadcast / receive combat end
function _avtBroadcastFimBatalha(batalhaId) {
  realtimeBroadcast('avt_combate_fim', { batalhaId });
}
function avtReceberFimBatalha({ batalhaId }) {
  if (!AVT_STATE.rpgId) return;
  AVT_STATE.batalhas = AVT_STATE.batalhas.filter(b => b.id !== batalhaId);
  _avtHudMostrar(!!_avtMinhaBatalha());
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberFimBatalha = avtReceberFimBatalha;

// Broadcast / receive player joining an existing combat
function _avtBroadcastJoinBatalha(batalhaId, jogadorId, jogadorNome) {
  realtimeBroadcast('avt_combate_join', { batalhaId, jogadorId, jogadorNome });
}
function avtReceberJoinBatalha({ batalhaId, jogadorId, jogadorNome }) {
  if (!AVT_STATE.rpgId) return;
  const bat = AVT_STATE.batalhas.find(b => b.id === batalhaId);
  if (!bat || bat.envolvidos.includes(jogadorId)) return;
  const ent = AVT_STATE.entidades.find(e => e.id === jogadorId);
  if (!ent) return;
  bat.envolvidos.push(jogadorId);
  const initRoll = Math.floor(Math.random()*20)+1+4;
  bat.iniciativa.push({ ...ent, initRoll });
  bat.iniciativa.sort((a,b) => b.initRoll - a.initRoll);
  _avtHudUpdate();
  _avtRenderLog();
}
window.avtReceberJoinBatalha = avtReceberJoinBatalha;

// Broadcast / receive NPC death (hidden from map)
function _avtBroadcastNpcMorreu(npcId) {
  realtimeBroadcast('avt_npc_morreu', { npcId });
}
function avtReceberNpcMorreu({ npcId }) {
  if (!AVT_STATE.rpgId) return;
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (ent) ent.escondido = true;
}
window.avtReceberNpcMorreu = avtReceberNpcMorreu;

// Broadcast / receive NPC respawn
function _avtBroadcastNpcRespawn(npcId, x, y, hp) {
  realtimeBroadcast('avt_npc_respawn', { npcId, x, y, hp });
}
function avtReceberNpcRespawn({ npcId, x, y, hp }) {
  if (!AVT_STATE.rpgId) return;
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (!ent) return;
  ent.escondido = false;
  ent.hp = hp;
  ent.hpMax = hp;
  ent.x = x;
  ent.y = y;
}
window.avtReceberNpcRespawn = avtReceberNpcRespawn;

// Returns XP required to level up FROM the given nivel.
// Reads optional level_config.xp_thresholds first, then falls back to nivel * 100.
function _avtXpParaNivel(nivel) {
  const thresholds = AVT_STATE.rpg?.theme_json?.level_config?.xp_thresholds;
  if (Array.isArray(thresholds) && thresholds[nivel - 1] != null) {
    return thresholds[nivel - 1];
  }
  return nivel * 100;
}

// Broadcast / receive XP gain
function _avtBroadcastXpGanho(ganhos) {
  realtimeBroadcast('avt_xp_ganho', { ganhos });
}
function avtReceberXpGanho({ ganhos }) {
  if (!AVT_STATE.rpgId || !Array.isArray(ganhos)) return;
  ganhos.forEach(({ nome, xp }) => {
    const char = AVT_STATE.chars.find(c => c.nome === nome);
    if (!char) return;
    char.xp = (char.xp || 0) + xp;
    mostrarToast(`✦ ${nome} +${xp} XP`, 'sucesso');
    // BUG-07 FIX: verificar level-up apenas para o próprio personagem do cliente,
    // evitando race condition de múltiplos clientes gravando no DB simultaneamente.
    if (nome === AVT_STATE.myCharNome) {
      _avtAutoLevelUp(char);
    }
  });
  _avtHudUpdate();
}
window.avtReceberXpGanho = avtReceberXpGanho;

// Broadcast / receive level-up event for visual effect on all clients
function _avtBroadcastLevelUp(charNome, novoNivel) {
  realtimeBroadcast('avt_level_up', { charNome, novoNivel });
}
function avtReceberLevelUp({ charNome, novoNivel }) {
  if (!AVT_STATE.rpgId) return;
  const char = AVT_STATE.chars.find(c => c.nome === charNome);
  if (char) {
    char.nivel = novoNivel;
    if (char.custom_attrs) char.custom_attrs.nivel = novoNivel;
  }
  _avtLevelUpParticleEffect(charNome, novoNivel);
  _avtHudUpdate();
}
window.avtReceberLevelUp = avtReceberLevelUp;

// ── LEVEL-UP VISUAL EFFECTS ───────────────────────────────────────────────────

// Injeta CSS keyframes para animações de XP (executado uma única vez).
(function _avtInjetarXpStyles() {
  if (document.getElementById('avt-xp-styles')) return;
  const s = document.createElement('style');
  s.id = 'avt-xp-styles';
  s.textContent = `
    @keyframes avt-levelup-fade{0%{opacity:0;transform:scale(0.85)}12%{opacity:1;transform:scale(1)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.05)}}
    @keyframes avt-xp-float{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-36px)}}
    @keyframes avt-levelup-pulse{0%,100%{box-shadow:0 0 8px rgba(200,168,75,0.3)}50%{box-shadow:0 0 18px rgba(200,168,75,0.7)}}
  `;
  document.head.appendChild(s);
})();

// Mostra texto flutuante "+N XP" no HUD do jogador.
function _avtMostrarXpFloat(xp) {
  const hud = document.getElementById('avt-hud-jogador');
  if (!hud) return;
  const el = document.createElement('div');
  el.textContent = `+${xp} XP`;
  el.style.cssText = 'position:absolute;right:10px;top:4px;color:#ffe066;font-family:var(--fonte-d);font-size:0.85rem;font-weight:bold;pointer-events:none;z-index:10;text-shadow:0 0 8px rgba(200,168,75,0.8);animation:avt-xp-float 2s ease-out forwards';
  hud.style.position = 'relative';
  hud.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

// Efeito de partículas Pixi.js no level-up (3 segundos).
async function _avtLevelUpParticleEffect(charNome, novoNivel) {
  try {
    if (typeof _pixiEnsureLoaded === 'function') await _pixiEnsureLoaded();
    else if (!window.PIXI) return;
  } catch (e) { return; }

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;z-index:9700;pointer-events:none';
  document.body.appendChild(container);

  const app = new PIXI.Application({
    width: window.innerWidth, height: window.innerHeight,
    backgroundAlpha: 0, antialias: true, resolution: 1,
  });
  container.appendChild(app.view);
  app.view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

  // Texto central
  const style = new PIXI.TextStyle({
    fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 'bold',
    fill: ['#ffe066', '#c8a84b'],
    dropShadow: true, dropShadowColor: '#c8a84b', dropShadowBlur: 20, dropShadowDistance: 0,
    stroke: '#3d2a00', strokeThickness: 3, align: 'center',
  });
  const label = new PIXI.Text(`⬆ LEVEL UP!\n${charNome} → Nível ${novoNivel}`, style);
  label.anchor.set(0.5);
  label.x = app.screen.width / 2;
  label.y = app.screen.height / 2 - 30;
  label.alpha = 0;
  app.stage.addChild(label);

  // Partículas douradas
  const NUM = 90;
  const parts = [];
  for (let i = 0; i < NUM; i++) {
    const g = new PIXI.Graphics();
    const sz = 2.5 + Math.random() * 5;
    g.beginFill(Math.random() > 0.45 ? 0xffe066 : 0xc8a84b, 0.92);
    g.drawCircle(0, 0, sz);
    g.endFill();
    // Estrelinhas em alguns
    if (Math.random() > 0.7) {
      g.beginFill(0xffffff, 0.6);
      g.drawCircle(0, 0, sz * 0.35);
      g.endFill();
    }
    g.x = app.screen.width / 2 + (Math.random() - 0.5) * 70;
    g.y = app.screen.height / 2 + (Math.random() - 0.5) * 70;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 5.5;
    g._vx = Math.cos(angle) * speed;
    g._vy = Math.sin(angle) * speed - 1.8;
    g._life = 0.55 + Math.random() * 0.45;
    g._age = Math.random() * 0.3; // offset aleatório para não explodirem todas juntas
    app.stage.addChild(g);
    parts.push(g);
  }

  // Halo central pulsante
  const halo = new PIXI.Graphics();
  halo.x = app.screen.width / 2;
  halo.y = app.screen.height / 2;
  app.stage.addChildAt(halo, 0);

  let elapsed = 0;
  const DURATION = 3000;
  app.ticker.add((delta) => {
    elapsed += app.ticker.elapsedMS;
    const t = Math.min(1, elapsed / DURATION);
    const fadeAlpha = t < 0.12 ? t / 0.12 : t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
    label.alpha = fadeAlpha;

    // Halo
    halo.clear();
    halo.beginFill(0xc8a84b, 0.07 * fadeAlpha);
    halo.drawCircle(0, 0, 120 + Math.sin(elapsed * 0.004) * 20);
    halo.endFill();
    halo.beginFill(0xffe066, 0.04 * fadeAlpha);
    halo.drawCircle(0, 0, 70 + Math.sin(elapsed * 0.006) * 12);
    halo.endFill();

    // Partículas
    parts.forEach(p => {
      p._age += delta * 0.018;
      if (p._age > p._life) {
        p._age = 0;
        p.x = app.screen.width / 2 + (Math.random() - 0.5) * 90;
        p.y = app.screen.height / 2 + (Math.random() - 0.5) * 90;
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 5;
        p._vx = Math.cos(a) * sp;
        p._vy = Math.sin(a) * sp - 1.5;
      }
      p.x += p._vx;
      p.y += p._vy;
      p._vy += 0.07;
      const lr = p._age / p._life;
      p.alpha = (1 - lr) * fadeAlpha;
      p.scale.set(1 - lr * 0.45);
    });
  });

  setTimeout(() => {
    try { app.destroy(true, { children: true, texture: true }); } catch(e) {}
    container.remove();
  }, DURATION + 150);
}

// NPC respawn: schedule timer-based respawn after death
function _avtAgendarRespawnNpc(ent) {
  const delay = (ent.respawnDelay ?? 60) * 1000;
  if (!ent.respawnTipo || ent.respawnTipo === 'nunca') return;
  if (ent.respawnTipo === 'timer') {
    _avtSetTimeout(() => avtRespawnNpc(ent.id), delay);
  }
  // 'manual' respawn is handled by master via panel button
}

// Respawn a dead NPC
function avtRespawnNpc(npcId) {
  const ent = AVT_STATE.entidades.find(e => e.id === npcId);
  if (!ent) return;
  ent.escondido = false;
  ent.hp = ent.hpMax;
  ent.vezes_morto = ent.vezes_morto || 0; // keep kill count
  delete AVT_STATE.npcTimers[npcId];
  mostrarToast(`${ent.nome} reapareceu!`, 'aviso');
  _avtBroadcastNpcRespawn(npcId, ent.x, ent.y, ent.hp);
}
window.avtRespawnNpc = avtRespawnNpc;

// Distribute XP from a killed NPC to all players in its combat
function _avtDistribuirXpNpc(npcEnt, bat) {
  const xpBase = npcEnt.xpBase ?? 0;
  if (!xpBase || !bat) return;
  const vezesMorto = npcEnt.vezes_morto || 0;
  const xpFinal = Math.max(1, Math.round(xpBase * Math.pow(0.8, vezesMorto)));
  const jogadoresNaBat = bat.iniciativa.filter(e => e.tipo === 'jogador');
  if (!jogadoresNaBat.length) return;
  const xpPorJog = Math.max(1, Math.round(xpFinal / jogadoresNaBat.length));
  const ganhos = jogadoresNaBat.map(j => ({ nome: j.nome, xp: xpPorJog }));

  ganhos.forEach(({ nome, xp }) => {
    const char = AVT_STATE.chars.find(c => c.nome === nome);
    if (!char) return;
    char.xp = (char.xp || 0) + xp;
    const maxNivel = AVT_STATE.rpg?.theme_json?.level_config?.nivel_maximo || 20;
    const nivelAtual = char.custom_attrs?.nivel || char.nivel || 1;
    const xpProxStr = nivelAtual < maxNivel ? `/ ${_avtXpParaNivel(nivelAtual)} XP` : ' (MAX)';
    mostrarToast(`✦ ${nome} +${xp} XP  (${char.xp}${xpProxStr})`, 'sucesso');
    if (nome === AVT_STATE.myCharNome) _avtMostrarXpFloat(xp);
    // Persist XP to DB
    if (char.id) {
      _avtSb('characters?id=eq.' + encodeURIComponent(char.id), { method: 'PATCH', body: JSON.stringify({ xp: char.xp }) }).catch(()=>{});
    }
    // Verificar e aplicar level-up automático
    _avtAutoLevelUp(char);
  });
  _avtBroadcastXpGanho(ganhos);
}

// Auto level-up quando XP atinge o threshold.
// BUG-01 FIX: while loop para suportar múltiplos níveis de uma vez.
// BUG-04 FIX: char.nivel atualizado em memória (antes só ca.nivel era atualizado).
async function _avtAutoLevelUp(char) {
  const maxNivel = AVT_STATE.rpg?.theme_json?.level_config?.nivel_maximo || 20;
  const lc = AVT_STATE.rpg?.theme_json?.level_config || {};
  // BUG-07 FIX: usar ?? 3 como padrão para garantir pontos de atributo mesmo sem config.
  const pontos_attr_por_nivel = lc.pontos_attr_por_nivel ?? 3;
  const hp_por_nivel = lc.hp_por_nivel || 0;
  const aumentos = lc.aumentos_automaticos || {};
  let leveled = false;

  while (true) {
    const ca = char.custom_attrs || {};
    const nivel = ca.nivel || char.nivel || 1;
    if (nivel >= maxNivel) break;
    const xpNeeded = _avtXpParaNivel(nivel);
    if ((char.xp || 0) < xpNeeded) break;

    const novoNivel = nivel + 1;
    ca.xp = (char.xp || 0) - xpNeeded;
    char.xp = ca.xp;
    ca.nivel = novoNivel;
    char.nivel = novoNivel; // sincronizar campo top-level para HUD e painel
    ca.pontos_attr = (ca.pontos_attr || 0) + pontos_attr_por_nivel;
    if (!ca.atributos) ca.atributos = {};
    Object.entries(aumentos).forEach(([a, v]) => {
      ca.atributos[a] = (parseFloat(ca.atributos[a]) || 0) + v;
    });
    ca.hp_max = (ca.hp_max || 60) + hp_por_nivel;
    char.hp_max = ca.hp_max;
    char.custom_attrs = ca;

    const ent = AVT_STATE.entidades.find(e => e.nome === char.nome);
    if (ent) ent.hpMax = ca.hp_max;

    mostrarToast(`⬆ ${char.nome} subiu para o Nível ${novoNivel}! 🎉`, 'sucesso');
    _avtLevelUpParticleEffect(char.nome, novoNivel);
    _avtBroadcastLevelUp(char.nome, novoNivel);
    leveled = true;
  }

  if (leveled && char.id) {
    const ca = char.custom_attrs || {};
    _avtSb('characters?id=eq.' + encodeURIComponent(char.id), {
      method: 'PATCH',
      body: JSON.stringify({
        xp: char.xp, nivel: ca.nivel, hp_max: ca.hp_max,
        pontos_attr: ca.pontos_attr, custom_attrs: ca
      })
    }).catch(() => {});
    _avtHudUpdate();
    _avtMestrePainelRender();
  }
}

// Handle NPC death: hide from map, maybe drop item, schedule respawn, give XP
function _avtNpcMorreu(npcEnt, bat) {
  if (!npcEnt || npcEnt.escondido) return;
  npcEnt.escondido = true;
  npcEnt.vezes_morto = (npcEnt.vezes_morto || 0) + 1;
  npcEnt.hp = 0;
  // Persistência da morte
  if (npcEnt.dbId) _avtPersistirHpChar(npcEnt);
  else _avtPersistirEstadoInimigos();
  _avtBroadcastNpcMorreu(npcEnt.id);

  // 10% drop chance on first kill only
  if (npcEnt.vezes_morto === 1 && Math.random() < 0.10) {
    _avtGerarDropNpc(npcEnt);
  }

  // XP distribution
  _avtDistribuirXpNpc(npcEnt, bat);

  // Schedule respawn
  _avtAgendarRespawnNpc(npcEnt);
}

// Generate a loot drop at NPC's position
async function _avtGerarDropNpc(npcEnt) {
  if (!AVT_STATE.rpgId) return;
  try {
    const catalog = AVT_STATE.itemCatalog || [];
    const droppable = catalog.filter(i => i.droppable);
    if (!droppable.length) return;
    const item = droppable[Math.floor(Math.random() * droppable.length)];
    await _avtSb('loot_pendente', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        rpg_id: AVT_STATE.rpgId,
        item_id: item.id,
        origem_npc: npcEnt.nome,
        posicao_col: npcEnt.x,
        posicao_row: npcEnt.y,
        mapa_id: AVT_STATE.faseId || null,
      })
    });
    mostrarToast(`${npcEnt.nome} droppou ${item.nome}!`, 'sucesso');
  } catch(e) {}
}

// Debounced save of dungeon position to DB (so late-joining players see correct positions)
var _avtSavePosTimers = {};
function _avtDebounceSalvarPosicao(jogador) {
  clearTimeout(_avtSavePosTimers[jogador.nome]);
  _avtSavePosTimers[jogador.nome] = setTimeout(async () => {
    const dbChar = AVT_STATE.chars.find(c => c.nome === jogador.nome);
    if (!dbChar?.id) return;
    const ca = { ...(dbChar.custom_attrs || {}), avt_x: jogador.x, avt_y: jogador.y };
    dbChar.custom_attrs = ca;
    try { await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), { method:'PATCH', body:JSON.stringify({ custom_attrs:ca }) }); } catch(e) {}
  }, 2000);
}

// Debounced save of NPC position (master-controlled NPCs persisted in characters)
function _avtDebounceSalvarPosicaoNpc(npc) {
  if (!AVT_STATE.rpgId || !npc?.dbId) return;
  clearTimeout(_avtSavePosTimers['npc:' + npc.dbId]);
  _avtSavePosTimers['npc:' + npc.dbId] = setTimeout(async () => {
    try {
      // Merge into existing custom_attrs if we have a local mirror
      const dbChar = (AVT_STATE.chars || []).find(c => c.id === npc.dbId);
      const base = dbChar?.custom_attrs || {};
      const ca = { ...base, avt_x: npc.x, avt_y: npc.y };
      if (dbChar) dbChar.custom_attrs = ca;
      await _avtSb('characters?id=eq.' + encodeURIComponent(npc.dbId), {
        method: 'PATCH',
        body: JSON.stringify({ custom_attrs: ca })
      });
    } catch (e) {}
  }, 1500);
}



// ─────────────────────────────────────────────────────────────────────────────
// COMBAT
// ─────────────────────────────────────────────────────────────────────────────

// Helpers to find combats
function _avtMinhaBatalha() {
  const eu = _avtMeuJogador();
  if (eu) {
    const b = AVT_STATE.batalhas.find(b => b.envolvidos.includes(eu.id));
    if (b) return b;
  }
  if (AVT_STATE.isMestre && AVT_STATE.batalhas.length) return AVT_STATE.batalhas[0];
  return null;
}
function _avtBatalhaDeEnt(entId) {
  return AVT_STATE.batalhas.find(b => b.envolvidos.includes(entId)) || null;
}

// Check if a combatant moved out of combat range and should be removed
function _avtCheckAbandonoCombate(ativo, bat) {
  if (!bat || ativo.tipo !== 'jogador') return;
  const dist = Math.abs(ativo.x - bat.centroX) + Math.abs(ativo.y - bat.centroY);
  const raioAbandono = (bat.raio ?? 3) + 3; // a bit more lenient than trigger radius
  if (dist > raioAbandono) {
    bat.iniciativa = bat.iniciativa.filter(e => e.id !== ativo.id);
    bat.envolvidos = bat.envolvidos.filter(id => id !== ativo.id);
    if (bat.turnoIdx >= bat.iniciativa.length) bat.turnoIdx = 0;
    _avtLog(`${ativo.nome} recuou e saiu do combate`, bat.id);
    mostrarToast(`${ativo.nome} saiu do combate`, 'aviso');
    _avtHudMostrar(!!_avtMinhaBatalha());
    _avtHudUpdate();
  }
}

function avtCombateIniciar(inimigo_trigger, forcedId) {
  const raio = inimigo_trigger?.deteccaoRaio ?? 3;
  const cx = inimigo_trigger?.x ?? 0;
  const cy = inimigo_trigger?.y ?? 0;

  // Determine participants: players within range + the trigger enemy (and other nearby enemies)
  let participantes;
  if (inimigo_trigger) {
    const jogadoresNoRaio = AVT_STATE.entidades.filter(e =>
      e.tipo === 'jogador' && e.hp > 0 && !_avtBatalhaDeEnt(e.id) &&
      Math.abs(e.x - cx) + Math.abs(e.y - cy) <= raio
    );
    const inimigosProximos = AVT_STATE.entidades.filter(e =>
      e.tipo === 'inimigo' && e.hp > 0 && !_avtBatalhaDeEnt(e.id) &&
      Math.abs(e.x - cx) + Math.abs(e.y - cy) <= raio * 1.5
    );
    participantes = [...jogadoresNoRaio, ...inimigosProximos];
  } else {
    // Manual start by master: include all free entities
    participantes = AVT_STATE.entidades.filter(e => e.hp > 0 && !_avtBatalhaDeEnt(e.id));
  }

  if (!participantes.length) {
    mostrarToast('Nenhum participante no alcance para iniciar combate', 'aviso');
    return null;
  }

  const batId = forcedId || ('bat_' + Date.now());
  const init = participantes.map(e => ({
    ...e, initRoll: Math.floor(Math.random()*20)+1 + (e.tipo==='jogador' ? 4 : 0)
  })).sort((a,b) => b.initRoll - a.initRoll);

  const jogadorIniciador = participantes.find(e => e.tipo === 'jogador');
  const bat = {
    id: batId,
    iniciativa: init,
    turnoIdx: 0,
    log: ['Combate iniciado!'],
    moverModo: false,
    envolvidos: participantes.map(e => e.id),
    centroX: cx,
    centroY: cy,
    raio,
    iniciador: jogadorIniciador?.nome || null,
    movimentoRestante: {},  // { entId: tilesLeft for this turn }
  };
  AVT_STATE.batalhas.push(bat);

  const nomes = participantes.map(e => e.nome).join(', ');
  mostrarToast(`⚔ Combate! (${nomes})`, 'aviso');

  const posicoes = participantes.map(e => ({ nome: e.nome, x: e.x, y: e.y }));
  realtimeBroadcast('avt_combate_inicio', { posicoes, batalhaId: batId, iniNome: inimigo_trigger?.nome || null });

  _avtHudMostrar(true);
  _avtHudUpdate();
  _avtRenderLog();
  // Não abre o painel do mestre automaticamente — o botão ⚙ está disponível manualmente
  const ativoNovo = bat.iniciativa[bat.turnoIdx];
  if (ativoNovo?.tipo === 'inimigo') _avtSetTimeout(() => _avtNpcTurno(bat), _avtNpcPensarDelay());
  return bat;
}

function avtCombateEncerrar(batalhaId) {
  if (!batalhaId) {
    if (AVT_STATE.batalhas.length === 0) return;
    batalhaId = AVT_STATE.batalhas[0].id;
  }
  _avtBroadcastFimBatalha(batalhaId);
  _avtRemoverBatalhaDb(batalhaId);
  AVT_STATE.batalhas = AVT_STATE.batalhas.filter(b => b.id !== batalhaId);
  _avtHudMostrar(!!_avtMinhaBatalha());
  _avtHudUpdate();
  _avtRenderLog();
  _avtMestrePainelRender();
  mostrarToast('Combate encerrado', 'ok');
}

// Jogador pode encerrar apenas o próprio combate (ou mestre encerra qualquer um)
function avtEncerrarMeuCombate() {
  const bat = _avtMinhaBatalha();
  if (!bat) return;
  if (!AVT_STATE.isMestre) {
    const eu = _avtMeuJogador();
    if (!eu || bat.iniciador !== eu.nome) {
      mostrarToast('Apenas o iniciador ou o mestre pode encerrar este combate', 'aviso');
      return;
    }
  }
  avtCombateEncerrar(bat.id);
}
window.avtEncerrarMeuCombate = avtEncerrarMeuCombate;

function _avtAtivo() {
  const b = _avtMinhaBatalha();
  return b ? b.iniciativa[b.turnoIdx] : null;
}

function _avtHudMostrar(show) {
  const hud = document.getElementById('avt-hud');
  if (hud) hud.style.display = show ? 'flex' : 'none';
}

// ─── Combat Skill Overlay ──────────────────────────────────────────────────────

function _avtSkillOverlayGetAlvoScreenPos(alvo) {
  const canvas = AVT_STATE.canvas;
  if (!canvas || !alvo) return null;
  const rect = canvas.getBoundingClientRect();
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  return {
    x: rect.left + alvo.x * SZ - AVT_STATE.camera.x + SZ / 2,
    y: rect.top  + alvo.y * SZ - AVT_STATE.camera.y + SZ / 2,
  };
}

function _avtMostrarListaAlvosMobile(bat) {
  document.getElementById('avt-alvo-mobile-overlay')?.remove();
  if (!bat) return;
  const inimigos = bat.iniciativa.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  if (!inimigos.length) return;
  const ov = document.createElement('div');
  ov.id = 'avt-alvo-mobile-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9950;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML = `
    <div style="background:#0a0f18;border:1px solid rgba(79,163,209,0.35);border-radius:12px;padding:16px;width:100%;max-width:320px">
      <div style="font-family:var(--fonte-d);color:#c8a84b;font-size:0.85rem;margin-bottom:12px;text-align:center">🎯 Selecionar Alvo</div>
      ${inimigos.map(e => `
        <div onclick="AVT_STATE.alvoSelecionado='${e.id}';document.getElementById('avt-alvo-mobile-overlay')?.remove();_avtMostrarSkillOverlay()"
          style="padding:10px 12px;margin-bottom:8px;border-radius:8px;background:rgba(232,96,76,0.08);border:1px solid rgba(232,96,76,0.3);cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <span style="color:#e8604c;font-family:var(--fonte-d);font-size:0.8rem">${e.nome}</span>
          <span style="font-size:0.7rem;color:#7a92aa">${e.hp}/${e.hpMax}HP</span>
        </div>`).join('')}
      <button onclick="document.getElementById('avt-alvo-mobile-overlay')?.remove()"
        style="width:100%;padding:8px;margin-top:4px;background:transparent;border:1px solid rgba(79,163,209,0.3);border-radius:8px;color:#7a92aa;cursor:pointer;font-size:0.75rem">Cancelar</button>
    </div>`;
  document.body.appendChild(ov);
}

function _avtMostrarSkillOverlay() {
  document.getElementById('avt-skill-overlay')?.remove();
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (!b || !ativo || ativo.tipo !== 'jogador') return;

  const inimigos = b.iniciativa.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  if (!inimigos.length) return;

  // Priority: canvas-selected target > HUD dropdown > first enemy
  const alvoId = AVT_STATE.alvoSelecionado
    || document.getElementById('avt-hud-alvo')?.value
    || inimigos[0]?.id;
  const alvo = b.iniciativa.find(e => e.id === alvoId) || inimigos[0];
  const alvoFixado = !!AVT_STATE.alvoSelecionado;
  const pos = _avtSkillOverlayGetAlvoScreenPos(alvo);
  const isRightHalf = pos ? pos.x > window.innerWidth / 2 : false;

  const _dbChar = AVT_STATE.chars.find(c => c.id === ativo.dbId || c.nome === ativo.nome);
  const _charSkillIds = _dbChar?.custom_attrs?.skills_ids || [];
  const mySkills = AVT_STATE.skills.filter(sk =>
    _charSkillIds.includes(sk.id) ||
    sk.personagem === ativo.nome ||
    (sk.character_id && sk.character_id === ativo.dbId)
  );

  const pendingId = AVT_STATE._pendingSkillId ?? null;

  const overlay = document.createElement('div');
  overlay.id = 'avt-skill-overlay';
  overlay.style.cssText = `position:fixed;top:50%;transform:translateY(-50%);${isRightHalf ? 'left:10px' : 'right:10px'};
    width:210px;max-height:70vh;overflow-y:auto;z-index:9900;
    background:rgba(5,8,16,0.97);border:1px solid rgba(79,163,209,0.35);
    border-radius:10px;padding:10px;box-shadow:0 4px 24px rgba(0,0,0,0.7)`;

  overlay.innerHTML = `
    <div style="font-family:var(--fonte-d);color:#c8a84b;font-size:0.72rem;margin-bottom:7px">⚔ Skill — ${ativo.nome}</div>
    ${alvoFixado
      ? `<div style="font-size:0.7rem;color:#e87850;margin-bottom:7px;padding:4px 8px;background:rgba(232,120,80,0.1);border-radius:5px;cursor:pointer"
           onclick="AVT_STATE.alvoSelecionado=null;_avtMostrarSkillOverlay()">🎯 <b>${alvo.nome}</b> (${alvo.hp}/${alvo.hpMax}HP) ✕</div>`
      : ''}
    <div class="avt-skill-overlay-item ${pendingId===null?'avt-skill-overlay-ativo':''}"
         onclick="_avtSkillOverlaySel(null)">
      <span>Ataque básico</span><span style="font-size:0.63rem;color:#7a92aa">1d8</span>
    </div>
    ${mySkills.map(sk => {
      const cdKey = ativo.id + '_' + sk.id;
      const cd = (AVT_STATE._cooldowns || {})[cdKey] || 0;
      return `<div onclick="${cd > 0 ? '' : `_avtSkillOverlaySel('${sk.id}')`}"
        class="avt-skill-overlay-item ${pendingId===sk.id?'avt-skill-overlay-ativo':''} ${cd > 0 ? 'avt-skill-overlay-disabled' : ''}"
        title="${(sk.efeito||'').replace(/"/g,'&quot;')}">
        <span>${sk.habilidade}</span>
        <span style="font-size:0.63rem;color:#7a92aa">${sk.formula_dano||'1d6'}${cd > 0 ? ` ⏱${cd}` : ''}</span>
      </div>`;
    }).join('')}
    <button onclick="_avtSkillOverlayCancelar()"
      style="margin-top:8px;width:100%;padding:4px;background:rgba(232,96,76,0.08);
      border:1px solid rgba(232,96,76,0.3);border-radius:5px;color:#e8604c;
      cursor:pointer;font-size:0.68rem;font-family:var(--fonte-d)">✕ Cancelar turno</button>`;

  document.body.appendChild(overlay);
}

function _avtSkillOverlaySel(skId) {
  if (window._avtAutoRollTimer) { clearTimeout(window._avtAutoRollTimer); window._avtAutoRollTimer = null; }
  AVT_STATE._pendingSkillId = skId;
  // Refresh overlay highlight
  document.querySelectorAll('#avt-skill-overlay .avt-skill-overlay-item').forEach(el => el.classList.remove('avt-skill-overlay-ativo'));
  const skNome = skId ? AVT_STATE.skills.find(s => s.id === skId)?.habilidade || 'Skill' : 'Ataque básico';

  // Broadcast selection to all players
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  const alvoId = AVT_STATE.alvoSelecionado || document.getElementById('avt-hud-alvo')?.value;
  const alvo = b?.iniciativa.find(e => e.id === alvoId) || b?.iniciativa.find(e => e.tipo === 'inimigo' && e.hp > 0);
  if (ativo && alvo) {
    realtimeBroadcast('avt_skill_selecionada', {
      atacanteNome: ativo.nome, skillId: skId, skillNome: skNome, alvoNome: alvo.nome
    });
  }

  // Show dice countdown near enemy
  _avtMostrarDiceOverlay(alvo, skId, 3);

  // Auto-roll after 3 seconds
  window._avtAutoRollTimer = setTimeout(_avtExecutarAtaque, 3000);
}

function _avtSkillOverlayCancelar() {
  if (window._avtAutoRollTimer) { clearTimeout(window._avtAutoRollTimer); window._avtAutoRollTimer = null; }
  AVT_STATE._pendingSkillId = undefined;
  AVT_STATE.alvoSelecionado = null;
  document.getElementById('avt-skill-overlay')?.remove();
  document.getElementById('avt-dice-overlay')?.remove();
}

// ─── Dice Overlay ──────────────────────────────────────────────────────────────

function _avtMostrarDiceOverlay(alvo, skId, countdown) {
  document.getElementById('avt-dice-overlay')?.remove();
  const pos = _avtSkillOverlayGetAlvoScreenPos(alvo);
  if (!pos) return;

  const overlay = document.createElement('div');
  overlay.id = 'avt-dice-overlay';

  // Position near enemy token (offset to not cover it)
  const left = Math.min(Math.max(pos.x - 50, 8), window.innerWidth - 110);
  const top  = Math.min(Math.max(pos.y + 40, 8), window.innerHeight - 120);
  overlay.style.cssText = `left:${left}px;top:${top}px`;

  const sk = skId ? AVT_STATE.skills.find(s => s.id === skId) : null;
  const formula = sk?.formula_dano || '1d8';

  overlay.innerHTML = `
    <div style="font-size:0.65rem;color:#7a92aa;margin-bottom:4px">${sk?.habilidade || 'Ataque básico'}</div>
    <div style="font-size:0.85rem;color:#c8a84b;margin-bottom:2px">${formula}</div>
    <div class="avt-dice-countdown" id="avt-dice-cd">Rolando em ${countdown}…</div>`;
  document.body.appendChild(overlay);

  // Count down 3→2→1
  let cd = countdown - 1;
  const cdEl = () => document.getElementById('avt-dice-cd');
  const tick = () => {
    if (!document.getElementById('avt-dice-overlay')) return;
    if (cd <= 0) { if (cdEl()) cdEl().textContent = 'Rolando…'; return; }
    if (cdEl()) cdEl().textContent = `Rolando em ${cd}…`;
    cd--;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function _avtMostrarResultadoDice(alvo, skNome, dadosRolados, total, isCrit) {
  const existing = document.getElementById('avt-dice-overlay');
  const pos = _avtSkillOverlayGetAlvoScreenPos(alvo);
  if (!existing && !pos) return;

  const left = existing ? parseInt(existing.style.left) : Math.min(Math.max(pos.x - 50, 8), window.innerWidth - 110);
  const top  = existing ? parseInt(existing.style.top)  : Math.min(Math.max(pos.y + 40, 8), window.innerHeight - 120);
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'avt-dice-overlay';
  overlay.style.cssText = `left:${left}px;top:${top}px`;

  const pips = dadosRolados.map(d => `<span class="avt-dice-pip">${d.val}</span>`).join('');
  overlay.innerHTML = `
    <div style="font-size:0.63rem;color:#7a92aa;margin-bottom:3px">${skNome}${isCrit ? ' 🎯 CRÍTICO' : ''}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:4px">${pips}</div>
    <div class="avt-dice-total">${total}</div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('avt-dice-overlay')?.remove(), 3500);
}

async function _avtExecutarAtaque() {
  if (window._avtAutoRollTimer) { clearTimeout(window._avtAutoRollTimer); window._avtAutoRollTimer = null; }
  document.getElementById('avt-skill-overlay')?.remove();

  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (!b || !ativo || ativo.tipo !== 'jogador') return;

  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo   = b.iniciativa.find(e => e.id === alvoId);
  if (!alvo || alvo.hp <= 0) { mostrarToast('Selecione um alvo válido', 'aviso'); return; }

  const skId = AVT_STATE._pendingSkillId ?? null;
  AVT_STATE._pendingSkillId = undefined;
  const sk = skId ? AVT_STATE.skills.find(s => s.id === skId) : null;
  const formula   = sk?.formula_dano || '1d8';
  const skillNome = sk?.habilidade   || 'Ataque básico';

  if (sk) {
    if (!AVT_STATE._cooldowns) AVT_STATE._cooldowns = {};
    const cdKey = ativo.id + '_' + sk.id;
    if (AVT_STATE._cooldowns[cdKey] > 0) {
      mostrarToast(`${skillNome} em cooldown`, 'aviso');
      return;
    }
    // Verificar e deduzir custo de recurso (Mana, Stamina, etc.)
    if (sk.custo_rsv && !/^passiv/i.test(sk.custo_rsv)) {
      const ok = await _avtDescontarCustoSkill(ativo.nome, sk.custo_rsv);
      if (!ok) return;
    }
  }
  if (sk?.alcance_celulas != null) {
    const dist = Math.abs(ativo.x - alvo.x) + Math.abs(ativo.y - alvo.y);
    if (dist > sk.alcance_celulas) {
      mostrarToast(`${alvo.nome} está fora de alcance`, 'aviso');
      return;
    }
  }

  _avtSetEntState(ativo.id, 'attack');

  // Parse and roll dice
  const dadosRolados = [];
  let danoTotal = 0;
  String(formula).toLowerCase().split('+').forEach(part => {
    part = part.trim();
    const m = part.match(/^(\d*)d(\d+)$/);
    if (m) {
      const n = parseInt(m[1]) || 1, faces = parseInt(m[2]) || 6;
      for (let i = 0; i < n; i++) {
        const val = Math.floor(Math.random() * faces) + 1;
        dadosRolados.push({ val, faces });
        danoTotal += val;
      }
    } else { danoTotal += parseInt(part) || 0; }
  });

  // Bônus de atributo da skill (mod_atributo_pct × atributo_base)
  if (sk?.atributo_base && sk?.mod_atributo_pct) {
    const dbAtivo2 = AVT_STATE.chars.find(c => c.nome === ativo.nome || c.id === ativo.dbId);
    const atrsAtivo = dbAtivo2?.custom_attrs?.atributos || {};
    const chaveAttr = Object.keys(atrsAtivo).find(k => k.toLowerCase() === (sk.atributo_base || '').toLowerCase());
    if (chaveAttr) {
      danoTotal += Math.ceil(parseFloat(atrsAtivo[chaveAttr] || 0) * sk.mod_atributo_pct / 100);
    }
  }

  const hitRoll  = Math.floor(Math.random() * 20) + 1;
  const isCrit   = hitRoll >= 19;
  const isFumble = hitRoll === 1;

  // Show dice result near enemy token
  const entAlvo = AVT_STATE.entidades.find(e => e.id === alvo.id);
  _avtMostrarResultadoDice(entAlvo || alvo, skillNome, dadosRolados, danoTotal, isCrit);

  // Broadcast dice roll to all players
  realtimeBroadcast('avt_dado_rolado', {
    atacanteNome: ativo.nome, alvoNome: alvo.nome, skillNome,
    dados: dadosRolados, total: danoTotal, isCrit, isFumble
  });

  if (isFumble) {
    const msg = `💨 ${ativo.nome} falha criticamente!${sk?.critico_negativo ? ' — ' + sk.critico_negativo : ''}`;
    _avtLog(msg, b.id); mostrarToast(msg, '');
  } else if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`, b.id);
    mostrarToast(`💨 ${ativo.nome} errou!`, '');
  } else {
    let real = isCrit ? danoTotal * 2 : danoTotal;
    if (ativo.tipo === 'jogador') {
      const dbAtivo = AVT_STATE.chars.find(c => c.nome === ativo.nome || c.id === ativo.dbId);
      const nivelAtivo = dbAtivo?.custom_attrs?.nivel ?? dbAtivo?.nivel ?? 1;
      const multConf = AVT_STATE.rpg?.theme_json?.level_config?.dano_mult_por_nivel || 0;
      if (multConf > 0 && nivelAtivo > 1) real = Math.floor(real * (1 + (nivelAtivo - 1) * multConf));
    }
    real = Math.floor(real);
    const tipoDano = sk?.tipo_dano || 'fisico';
    alvo.hp = Math.max(0, alvo.hp - real);
    if (entAlvo) { entAlvo.hp = alvo.hp; _avtAplicarDanoPersistir(entAlvo, entAlvo.hp); }
    const critMsg = isCrit && sk?.critico_positivo ? ' — ' + sk.critico_positivo : '';
    const msg = isCrit
      ? `🎯 CRÍTICO! ${ativo.nome} → ${alvo.nome}: ${real} [${tipoDano}] (${skillNome})${critMsg}`
      : `⚔ ${ativo.nome} → ${alvo.nome}: ${real} [${tipoDano}] (${skillNome})`;
    _avtLog(msg, b.id); mostrarToast(msg, 'ok');
    if (sk?.efeitos_bonus?.length && entAlvo) {
      if (!entAlvo.status_effects) entAlvo.status_effects = [];
      sk.efeitos_bonus.forEach(ef => {
        entAlvo.status_effects.push({ ...ef });
        _avtLog(`  ↳ ${ef.tipo}: ${ef.descricao} (${ef.duracao_turnos} turnos)`, b.id);
      });
    }
    _avtRenderHpBar();
    if (sk) _avtPlaySkillAnim(sk, entAlvo || alvo, ativo);
    if (alvo.hp <= 0) {
      _avtLog(`💀 ${alvo.nome} derrotado!`, b.id);
      if (alvo.tipo === 'inimigo') { _avtNpcMorreu(entAlvo || alvo, b); _avtCheckVitoria(b); }
      else _avtCheckDerrota(b);
    }
    _avtBroadcastBatalha(b);
  }

  if (sk?.cooldown_turnos > 0) {
    if (!AVT_STATE._cooldowns) AVT_STATE._cooldowns = {};
    AVT_STATE._cooldowns[ativo.id + '_' + sk.id] = sk.cooldown_turnos;
  }
  _avtSetTimeout(() => _avtTurnoAvancar(b), 600);
}

// Receive skill-selected broadcast from another player
function avtReceberSkillSelecionada({ atacanteNome, skillNome, alvoNome }) {
  mostrarToast(`${atacanteNome} usa ${skillNome} em ${alvoNome}…`, '');
}
window.avtReceberSkillSelecionada = avtReceberSkillSelecionada;

// Receive dice-rolled broadcast from another player
function avtReceberDadoRolado({ atacanteNome, alvoNome, skillNome, dados, total, isCrit }) {
  const alvo = AVT_STATE.entidades.find(e => e.nome === alvoNome);
  _avtMostrarResultadoDice(alvo || { x: 0, y: 0 }, `${atacanteNome}: ${skillNome}`, dados || [], total, isCrit);
  mostrarToast(`${atacanteNome} → ${alvoNome}: ${total}${isCrit ? ' 🎯 CRÍTICO' : ''}`, 'ok');
}
window.avtReceberDadoRolado = avtReceberDadoRolado;

function _avtHudUpdate() {
  const b = _avtMinhaBatalha();
  if (!b) { _avtHudMostrar(false); return; }
  const ativo = b.iniciativa[b.turnoIdx];
  if (!ativo) return;

  const initBar = document.getElementById('avt-hud-init');
  if (initBar) {
    initBar.innerHTML = b.iniciativa.map((e,i) =>
      `<span class="avt-init-badge ${i===b.turnoIdx?'ativo':''}" style="border-color:${e.cor}">${e.nome.split(' ')[0]}</span>`
    ).join('<span class="avt-init-sep">›</span>');
  }

  const hudEsq = document.getElementById('avt-hud-esq');
  const hudDir = document.getElementById('avt-hud-dir');
  if (!hudEsq || !hudDir) return;

  if (ativo.tipo === 'jogador') {
    const inimigos = b.iniciativa.filter(e => e.tipo==='inimigo' && e.hp>0);
    // Decrement this player's cooldowns at start of their turn
    if (AVT_STATE._cooldowns) {
      Object.keys(AVT_STATE._cooldowns).forEach(key => {
        if (key.startsWith(ativo.id + '_') && AVT_STATE._cooldowns[key] > 0) {
          AVT_STATE._cooldowns[key]--;
        }
      });
    }
    // Reset pending skill selection for new turn
    AVT_STATE._pendingSkillId = undefined;
    // Initialize movement budget for this turn
    if (!b.movimentoRestante) b.movimentoRestante = {};
    if (b.movimentoRestante[ativo.id] == null) {
      b.movimentoRestante[ativo.id] = _avtGetMovimentoMax(ativo);
    }
    const movLeft = b.movimentoRestante[ativo.id];
    const movMax  = _avtGetMovimentoMax(ativo);

    hudEsq.innerHTML = `
      <div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b></div>
      <div style="font-size:0.65rem;color:#4fa3d1;margin:2px 0 4px">${Array.from({length:movMax},(_,i)=>`<span style="color:${i<movLeft?'#4fa3d1':'rgba(79,163,209,0.2)'}">●</span>`).join('')} ↔ ${movLeft}/${movMax}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="avt-hud-alvo" onchange="AVT_STATE.alvoSelecionado=this.value;_avtMostrarSkillOverlay()"
          style="flex:1;min-width:110px;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem">
          ${inimigos.map(e => `<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!inimigos.length ? '<option>— sem alvos —</option>' : ''}
        </select>
      </div>`;
    hudDir.innerHTML = `
      <button class="avt-hud-btn avt-hud-btn-atk" onclick="_avtMostrarSkillOverlay()">⚔ Skills</button>
      <button class="avt-hud-btn avt-hud-btn-mov" onclick="avtHudMover()">↔ Mover</button>
      <button class="avt-hud-btn avt-hud-btn-pass" onclick="avtHudPassar()">⏭ Passar</button>`;

    // Auto-show skill overlay when it's this player's turn
    _avtSetTimeout(_avtMostrarSkillOverlay, 200);
  } else {
    const isMestreCtrl = AVT_STATE.npcControlando === ativo.id;
    if (isMestreCtrl) {
      const alvos = b.iniciativa.filter(e => e.tipo==='jogador' && e.hp>0);
      hudEsq.innerHTML = `
        <div class="avt-hud-turno" style="color:${ativo.cor}">🎮 Controlando: <b>${ativo.nome}</b></div>
        <select id="avt-hud-alvo" style="padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.72rem;min-width:110px">
          ${alvos.map(e=>`<option value="${e.id}">${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
          ${!alvos.length?'<option>— sem alvos —</option>':''}
        </select>`;
      hudDir.innerHTML = `
        <button class="avt-hud-btn avt-hud-btn-atk" onclick="avtHudAtacarNpc()">⚔ Atacar</button>
        <button class="avt-hud-btn avt-hud-btn-mov" onclick="avtHudMover()">↔ Mover</button>
        <button class="avt-hud-btn avt-hud-btn-pass" onclick="avtHudPassar()">⏭ Passar</button>`;
    } else {
      hudEsq.innerHTML = `<div class="avt-hud-turno" style="color:${ativo.cor}">Turno: <b>${ativo.nome}</b> (inimigo)</div>
        <div style="color:#7a92aa;font-size:0.8rem">IA processando…</div>`;
      hudDir.innerHTML = '';
    }
  }
}

function avtHudAtacar() {
  // Legacy entry point — delegates to the overlay skill selection flow
  _avtMostrarSkillOverlay();
}

function avtHudMover() {
  const b = _avtMinhaBatalha();
  if (!b) return;
  b.moverModo = !b.moverModo;
  mostrarToast(b.moverModo ? 'Clique no tile de destino (ou use WASD/D-pad)' : 'Mover cancelado', '');
}

function avtHudPassar() {
  _avtSkillOverlayCancelar();
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (ativo) _avtLog(`${ativo.nome} passa o turno`, b?.id);
  _avtTurnoAvancar(b);
}

function _avtTurnoAvancar(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  // Clean up combat overlays
  if (window._avtAutoRollTimer) { clearTimeout(window._avtAutoRollTimer); window._avtAutoRollTimer = null; }
  document.getElementById('avt-skill-overlay')?.remove();
  document.getElementById('avt-dice-overlay')?.remove();
  AVT_STATE._pendingSkillId = undefined;
  AVT_STATE.alvoSelecionado = null;
  bat.moverModo = false;
  bat.iniciativa = bat.iniciativa.filter(e => e.hp > 0);
  bat.envolvidos = bat.envolvidos.filter(id => bat.iniciativa.some(e => e.id === id));
  if (!bat.iniciativa.length) { avtCombateEncerrar(bat.id); return; }
  // +1 recurso por turno se a entidade que terminou o turno se moveu (sem HP em combate)
  const _entTerminou = bat.iniciativa[bat.turnoIdx];
  if (_entTerminou?.tipo === 'jogador' && bat._moveuNesteTurno?.[_entTerminou.id]) {
    const _charTerm = AVT_STATE.chars.find(c => c.nome === _entTerminou.nome || c.id === _entTerminou.dbId);
    if (_charTerm?.custom_attrs?.atributos) {
      _avtRecursosDoChar(_charTerm).forEach(r => {
        _charTerm.custom_attrs.atributos[r.nome] = Math.min(r.max, r.atual + 1);
      });
      if (_entTerminou.nome === AVT_STATE.myCharNome) {
        _avtRenderHpBar();
        const _pp = document.getElementById('avt-player-panel');
        if (_pp && _pp.style.display !== 'none') avtJogadorPainelRender();
        _avtSb(`characters?id=eq.${encodeURIComponent(_charTerm.id)}`,
          { method: 'PATCH', body: JSON.stringify({ custom_attrs: _charTerm.custom_attrs }) }
        ).catch(() => {});
      }
    }
    delete bat._moveuNesteTurno[_entTerminou.id];
  }
  bat.turnoIdx = (bat.turnoIdx + 1) % bat.iniciativa.length;
  // Reset movement budget for the new active entity
  if (!bat.movimentoRestante) bat.movimentoRestante = {};
  const novoAtivo = bat.iniciativa[bat.turnoIdx];
  if (novoAtivo) bat.movimentoRestante[novoAtivo.id] = _avtGetMovimentoMax(novoAtivo);
  _avtHudUpdate();
  _avtRenderLog();
  _avtBroadcastBatalha(bat);
  const ativoAgora = bat.iniciativa[bat.turnoIdx];
  if (ativoAgora?.tipo === 'inimigo') _avtSetTimeout(() => _avtNpcTurno(bat), _avtNpcPensarDelay());
}

function _avtGetMovimentoMax(ent) {
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome);
  if (dbChar?.custom_attrs?.movimentoMax != null) return dbChar.custom_attrs.movimentoMax;
  const dex = dbChar?.custom_attrs?.atributos?.destreza ?? 10;
  const mod = Math.floor((dex - 10) / 2);
  return Math.max(2, 3 + mod); // base 3 tiles, ±dex modifier, min 2
}

function _avtNpcEscolherSkill(npcEnt, alvo) {
  if (!npcEnt) return null;
  const npcSkills = AVT_STATE.skills.filter(sk => {
    if (!sk.personagem && !sk.character_id) return false;
    const byNome = sk.personagem === npcEnt.nome;
    const byId   = sk.character_id && sk.character_id === npcEnt.dbId;
    if (!byNome && !byId) return false;
    // Check cooldown
    const cdKey = npcEnt.id + '_' + sk.id;
    if ((AVT_STATE._cooldowns || {})[cdKey] > 0) return false;
    // Check range
    if (sk.alcance_celulas != null) {
      const dist = Math.abs(npcEnt.x - alvo.x) + Math.abs(npcEnt.y - alvo.y);
      if (dist > sk.alcance_celulas) return false;
    }
    return true;
  });
  if (!npcSkills.length) return null;
  // Prefer offensive skills (dano_bonus / debuff type), else random
  const ofensivas = npcSkills.filter(sk => sk.tipo_dano && sk.tipo_dano !== 'cura');
  const pool = ofensivas.length ? ofensivas : npcSkills;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Extract NPC attack execution into its own function so it can be called after movement
function _avtNpcExecutarAtaque(bat, npc, entNpc, skillAlvo, sk) {
  _avtSetEntState(npc.id, 'attack');
  const formula   = sk?.formula_dano || '1d6';
  const skillNome = sk?.habilidade   || 'Ataque básico';
  const tipoDano  = sk?.tipo_dano    || 'fisico';

  realtimeBroadcast('avt_skill_selecionada', {
    atacanteNome: npc.nome, skillId: sk?.id || null, skillNome, alvoNome: skillAlvo.nome
  });

  _avtSetTimeout(() => {
    const hitRoll  = Math.floor(Math.random()*20)+1;
    const isCrit   = hitRoll >= 19;
    const isFumble = hitRoll === 1;

    const dadosRolados = [];
    let danoTotal = 0;
    String(formula).toLowerCase().split('+').forEach(part => {
      part = part.trim();
      const m = part.match(/^(\d*)d(\d+)$/);
      if (m) {
        const n = parseInt(m[1]) || 1, faces = parseInt(m[2]) || 6;
        for (let i = 0; i < n; i++) {
          const val = Math.floor(Math.random() * faces) + 1;
          dadosRolados.push({ val, faces }); danoTotal += val;
        }
      } else { danoTotal += parseInt(part) || 0; }
    });

    realtimeBroadcast('avt_dado_rolado', {
      atacanteNome: npc.nome, alvoNome: skillAlvo.nome, skillNome,
      dados: dadosRolados, total: danoTotal, isCrit, isFumble
    });

    const entAlvo = AVT_STATE.entidades.find(e => e.id === skillAlvo.id || e.nome === skillAlvo.nome);
    _avtMostrarResultadoDice(entAlvo || skillAlvo, `${npc.nome}: ${skillNome}`, dadosRolados, danoTotal, isCrit);

    if (isFumble) {
      _avtLog(`💨 ${npc.nome} falha criticamente!`, bat.id);
    } else if (hitRoll < 5) {
      _avtLog(`${npc.nome} erra ${skillAlvo.nome}!`, bat.id);
    } else {
      let real = isCrit ? danoTotal * 2 : danoTotal;
      skillAlvo.hp = Math.max(0, skillAlvo.hp - real);
      if (entAlvo) { entAlvo.hp = skillAlvo.hp; _avtAplicarDanoPersistir(entAlvo, entAlvo.hp); }
      const initEnt = bat.iniciativa.find(e => e.id === skillAlvo.id || e.nome === skillAlvo.nome);
      if (initEnt) initEnt.hp = skillAlvo.hp;
      if (sk?.efeitos_bonus?.length && entAlvo) {
        if (!entAlvo.status_effects) entAlvo.status_effects = [];
        sk.efeitos_bonus.forEach(ef => entAlvo.status_effects.push({ ...ef }));
      }
      const critMsg = isCrit ? ' 🎯 CRÍTICO!' : '';
      _avtLog(`👹 ${npc.nome} → ${skillAlvo.nome}: ${real} [${tipoDano}] (${skillNome})${critMsg}`, bat.id);
      mostrarToast(`👹 ${npc.nome} ataca ${skillAlvo.nome}! -${real} HP${critMsg}`, 'aviso');
      if (sk) _avtPlaySkillAnim(sk, entAlvo || skillAlvo, entNpc);
      _avtRenderHpBar();
      _avtBroadcastBatalha(bat);
      if (skillAlvo.hp <= 0) { _avtLog(`💀 ${skillAlvo.nome} caiu!`, bat.id); _avtCheckDerrota(bat); }
    }
    if (sk?.cooldown_turnos > 0) {
      if (!AVT_STATE._cooldowns) AVT_STATE._cooldowns = {};
      AVT_STATE._cooldowns[entNpc.id + '_' + sk.id] = sk.cooldown_turnos;
    }
    _avtSetTimeout(() => _avtTurnoAvancar(bat), 600);
  }, 1000);
}


// ─────────────────────────────────────────────────────────────────────────────
// PERSISTÊNCIA DE COMBATE (HP, mortes, batalha ativa)
// ─────────────────────────────────────────────────────────────────────────────

// Delay aleatório (1–3s) antes do NPC pensar/agir
function _avtNpcPensarDelay() { return 1000 + Math.floor(Math.random() * 2000); }

// Debounced PATCH characters.hp_atual
var _avtHpSaveTimers = {};
function _avtPersistirHpChar(ent) {
  if (!ent?.dbId) return;
  clearTimeout(_avtHpSaveTimers[ent.dbId]);
  _avtHpSaveTimers[ent.dbId] = setTimeout(async () => {
    try {
      await _avtSb('characters?id=eq.' + encodeURIComponent(ent.dbId), {
        method: 'PATCH', body: JSON.stringify({ hp_atual: ent.hp })
      });
      const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId);
      if (dbChar) dbChar.hp_atual = ent.hp;
    } catch (e) {}
  }, 600);
}

// Debounced UPSERT de estado de inimigos procedurais em rpg_registry.theme_json
var _avtEstadoInimigosTimer = null;
function _avtPersistirEstadoInimigos() {
  if (!AVT_STATE.rpgId || !AVT_STATE.rpg) return;
  clearTimeout(_avtEstadoInimigosTimer);
  _avtEstadoInimigosTimer = setTimeout(async () => {
    try {
      const t = AVT_STATE.rpg.theme_json || {};
      if (!t.dungeon_data) t.dungeon_data = {};
      const estado = {};
      (AVT_STATE.entidades || []).forEach(e => {
        if (e.tipo !== 'inimigo' || e.dbId) return; // dbId vai pro characters
        // BUG-05 FIX: incluir vezes_morto para preservar o decay de XP entre sessões.
        estado[e.id] = { hp: e.hp, morto: !!e.escondido || e.hp <= 0, x: e.x, y: e.y, vezes_morto: e.vezes_morto || 0 };
      });
      t.dungeon_data._estadoInimigos = estado;
      AVT_STATE.rpg.theme_json = t;
      await _avtSb('rpg_registry?rpg_id=eq.' + encodeURIComponent(AVT_STATE.rpgId), {
        method: 'PATCH', body: JSON.stringify({ theme_json: t })
      });
    } catch (e) {}
  }, 1500);
}

// Aplica dano e persiste (helper único usado por ataque do jogador e do NPC)
function _avtAplicarDanoPersistir(entAlvo, novoHp) {
  if (!entAlvo) return;
  entAlvo.hp = Math.max(0, novoHp);
  if (entAlvo.dbId) _avtPersistirHpChar(entAlvo);
  if (entAlvo.tipo === 'inimigo' && !entAlvo.dbId) _avtPersistirEstadoInimigos();
}

// Debounced UPSERT de batalha ativa em public.batalhas
var _avtBatalhaSaveTimers = {};
function _avtPersistirBatalha(bat) {
  if (!bat || !AVT_STATE.rpgId) return;
  clearTimeout(_avtBatalhaSaveTimers[bat.id]);
  _avtBatalhaSaveTimers[bat.id] = setTimeout(async () => {
    try {
      const body = {
        rpg_id: AVT_STATE.rpgId,
        id: bat.id,
        ativa: true,
        pausada: false,
        turno_round: bat.turnoRound || 1,
        fase: 'em_andamento',
        ordem_atual: bat.turnoIdx || 0,
        participantes: bat.iniciativa.map(e => ({
          id: e.id, nome: e.nome, hp: e.hp, hpMax: e.hpMax,
          tipo: e.tipo, x: e.x, y: e.y, initRoll: e.initRoll, dbId: e.dbId || null
        })),
        recursos_participantes: {
          envolvidos: bat.envolvidos,
          centroX: bat.centroX, centroY: bat.centroY,
          raio: bat.raio, iniciador: bat.iniciador,
          log: (bat.log || []).slice(0, 30)
        }
      };
      await _avtSb('batalhas', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body)
      });
    } catch (e) {}
  }, 500);
}

async function _avtRemoverBatalhaDb(batalhaId) {
  if (!AVT_STATE.rpgId || !batalhaId) return;
  clearTimeout(_avtBatalhaSaveTimers[batalhaId]);
  try {
    await _avtSb('batalhas?rpg_id=eq.' + encodeURIComponent(AVT_STATE.rpgId)
                 + '&id=eq.' + encodeURIComponent(batalhaId),
                 { method: 'DELETE' });
  } catch (e) {}
}

// Carrega batalhas ativas do DB e reconstrói AVT_STATE.batalhas
async function _avtCarregarBatalhasAtivas() {
  if (!AVT_STATE.rpgId) return;
  try {
    const rows = await _avtSb('batalhas?rpg_id=eq.' + encodeURIComponent(AVT_STATE.rpgId)
                              + '&ativa=eq.true&select=*');
    if (!Array.isArray(rows)) return;
    rows.forEach(r => {
      const recursos = (typeof r.recursos_participantes === 'string'
        ? (() => { try { return JSON.parse(r.recursos_participantes); } catch(e){ return {}; } })()
        : r.recursos_participantes) || {};
      const parts = (typeof r.participantes === 'string'
        ? (() => { try { return JSON.parse(r.participantes); } catch(e){ return []; } })()
        : r.participantes) || [];
      // Reaplica HP às entidades locais
      parts.forEach(p => {
        const ent = AVT_STATE.entidades.find(e => e.id === p.id || e.nome === p.nome);
        if (ent) { ent.hp = p.hp; ent.hpMax = p.hpMax; if (p.x != null) ent.x = p.x; if (p.y != null) ent.y = p.y; }
      });
      const bat = {
        id: r.id,
        iniciativa: parts.map(p => ({ ...p })),
        turnoIdx: r.ordem_atual || 0,
        turnoRound: r.turno_round || 1,
        log: Array.isArray(recursos.log) ? recursos.log : ['Combate restaurado'],
        moverModo: false,
        envolvidos: recursos.envolvidos || parts.map(p => p.id),
        centroX: recursos.centroX || 0,
        centroY: recursos.centroY || 0,
        raio: recursos.raio || 3,
        iniciador: recursos.iniciador || null,
        movimentoRestante: {}
      };
      // Evita duplicar se já temos
      if (!AVT_STATE.batalhas.some(b => b.id === bat.id)) {
        AVT_STATE.batalhas.push(bat);
      }
    });
    if (AVT_STATE.batalhas.length) {
      _avtHudMostrar(!!_avtMinhaBatalha());
      _avtHudUpdate && _avtHudUpdate();
      _avtRenderLog && _avtRenderLog();
    }
  } catch (e) { /* silencioso */ }
}

// Aplica estado persistido de inimigos procedurais às entidades já geradas
function _avtAplicarEstadoInimigosPersistido() {
  const estado = AVT_STATE.rpg?.theme_json?.dungeon_data?._estadoInimigos;
  if (!estado || typeof estado !== 'object') return;
  // Remove inimigos mortos e ajusta HP dos vivos
  AVT_STATE.entidades = AVT_STATE.entidades.filter(e => {
    if (e.tipo !== 'inimigo' || e.dbId) return true;
    const s = estado[e.id];
    if (!s) return true;
    if (s.morto) return false; // não spawnar morto
    if (typeof s.hp === 'number') e.hp = s.hp;
    if (typeof s.x === 'number') e.x = s.x;
    if (typeof s.y === 'number') e.y = s.y;
    if (typeof s.vezes_morto === 'number') e.vezes_morto = s.vezes_morto; // BUG-05 FIX
    return true;
  });
}

// Helper exposto: imagem da ficha para um personagem (consumido pelo módulo de ficha)
function avtGetFichaImg(charNome) {
  const c = (AVT_STATE.chars || []).find(c => c.nome === charNome);
  return c?.custom_attrs?.topdown_ia?.ficha_img_url || null;
}
window.avtGetFichaImg = avtGetFichaImg;


function _avtNpcAtualizarPerseguicao(entNpc, nearest) {
  if (!AVT_STATE._fleeTracker) AVT_STATE._fleeTracker = {};
  const tracker = AVT_STATE._fleeTracker;
  const curDist = Math.abs(entNpc.x - nearest.x) + Math.abs(entNpc.y - nearest.y);
  const prev = tracker[entNpc.id] || {};
  const prevDist = prev.prevDist ?? curDist;
  // Player moved away from enemy → start pursuing
  if (curDist > prevDist && curDist > 3 && !prev.pursuing) {
    tracker[entNpc.id] = { pursuing: true, pursuitTurnsLeft: 5, prevDist: curDist };
  } else if (prev.pursuing && prev.pursuitTurnsLeft > 0) {
    tracker[entNpc.id] = { ...prev, prevDist: curDist };
  } else {
    tracker[entNpc.id] = { pursuing: false, pursuitTurnsLeft: 0, prevDist: curDist };
  }
}

function _avtNpcTurno(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const npc = bat.iniciativa[bat.turnoIdx];
  if (!npc || npc.tipo !== 'inimigo') return;
  const entNpc = AVT_STATE.entidades.find(e => e.id===npc.id);
  if (!entNpc || entNpc.hp<=0) { _avtTurnoAvancar(bat); return; }
  // Master controlling this NPC — show HUD and wait for master input
  if (AVT_STATE.npcControlando === npc.id) { _avtHudUpdate(); return; }
  // AI globally disabled — pass turn
  if (!AVT_STATE.npcIaAtiva) {
    _avtLog(`${npc.nome} aguarda (IA desligada)`, bat.id);
    _avtSetTimeout(() => _avtTurnoAvancar(bat), 800);
    return;
  }

  // Target players in THIS combat — prefer lowest HP. If none, fall back to GLOBAL pursuit.
  let jogadores = AVT_STATE.entidades.filter(e => e.tipo==='jogador' && e.hp>0 && bat.envolvidos.includes(e.id));
  let perseguicaoGlobal = false;
  if (!jogadores.length) {
    // Ninguém no combate — tenta perseguir o jogador vivo mais próximo no mapa todo
    const todos = AVT_STATE.entidades.filter(e => e.tipo==='jogador' && e.hp>0);
    if (!todos.length) {
      // Não há jogadores vivos: encerra combate
      avtCombateEncerrar(bat.id);
      return;
    }
    // Inicia/garante perseguição
    if (!AVT_STATE._fleeTracker) AVT_STATE._fleeTracker = {};
    const ft = AVT_STATE._fleeTracker[entNpc.id] || {};
    if (!ft.pursuing || ft.pursuitTurnsLeft <= 0) {
      AVT_STATE._fleeTracker[entNpc.id] = { pursuing: true, pursuitTurnsLeft: 5, prevDist: Infinity };
    }
    const ftNow = AVT_STATE._fleeTracker[entNpc.id];
    if (ftNow.pursuitTurnsLeft <= 0) {
      // Cansou de perseguir — encerra combate
      _avtLog('Inimigos perderam o interesse', bat.id);
      avtCombateEncerrar(bat.id);
      return;
    }
    jogadores = todos;
    perseguicaoGlobal = true;
  }

  let nearest = jogadores[0], nearDist = Infinity;
  jogadores.forEach(j => {
    const d = Math.abs(j.x-entNpc.x) + Math.abs(j.y-entNpc.y);
    if (d < nearDist) { nearest=j; nearDist=d; }
  });
  const lowestHp = jogadores.reduce((a, b) => a.hp < b.hp ? a : b, jogadores[0]);

  // Update flee/pursuit tracker
  _avtNpcAtualizarPerseguicao(entNpc, nearest);
  const fleeInfo = (AVT_STATE._fleeTracker || {})[entNpc.id] || {};

  // Choose skill (may have longer range than melee) — check range against all targets freely
  const skCandidate = AVT_STATE.skills.filter(sk => {
    if (!sk.personagem && !sk.character_id) return false;
    const byNome = sk.personagem === entNpc.nome;
    const byId   = sk.character_id && sk.character_id === entNpc.dbId;
    if (!byNome && !byId) return false;
    const cdKey = entNpc.id + '_' + sk.id;
    if ((AVT_STATE._cooldowns || {})[cdKey] > 0) return false;
    return sk.tipo_dano && sk.tipo_dano !== 'cura';
  });
  const sk = skCandidate.length ? skCandidate[Math.floor(Math.random() * skCandidate.length)] : null;
  const skillAlvo = lowestHp;
  const skillAlcance = sk?.alcance_celulas ?? 1;

  // Movement budget: dex-based + pursuit bonus
  if (!bat.movimentoRestante) bat.movimentoRestante = {};
  let movRestante = _avtGetMovimentoMax(entNpc);
  if (fleeInfo.pursuing && fleeInfo.pursuitTurnsLeft > 0) {
    movRestante += 1;
    if (AVT_STATE._fleeTracker[entNpc.id]) AVT_STATE._fleeTracker[entNpc.id].pursuitTurnsLeft--;
  }

  // Phase 1: Move toward target using full movement budget
  let moved = false;
  while (movRestante > 0) {
    const distNow = Math.abs(entNpc.x - skillAlvo.x) + Math.abs(entNpc.y - skillAlvo.y);
    if (distNow <= skillAlcance) break;

    let bestDir = null, bestDist = distNow;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nx = entNpc.x+dx, ny = entNpc.y+dy;
      if (!_avtTilePassavel(nx, ny, AVT_STATE.dungeon)) return;
      if (AVT_STATE.entidades.some(e2 => e2.id !== entNpc.id && e2.x === nx && e2.y === ny)) return;
      const d = Math.abs(skillAlvo.x-nx) + Math.abs(skillAlvo.y-ny);
      if (d < bestDist) { bestDist=d; bestDir=[dx,dy]; }
    });
    if (!bestDir) break;

    entNpc.x += bestDir[0]; entNpc.y += bestDir[1];
    npc.x = entNpc.x; npc.y = entNpc.y;
    movRestante--;
    moved = true;
  }

  if (moved) {
    realtimeBroadcast('avt_token_move', { nome: entNpc.nome, x: entNpc.x, y: entNpc.y });
    _avtDebounceSalvarPosicaoNpc(entNpc);
    _avtSetEntState(npc.id, 'walk');
  }

  // Phase 2: Attack if now in range (same turn after moving)
  const distFinal = Math.abs(entNpc.x - skillAlvo.x) + Math.abs(entNpc.y - skillAlvo.y);
  if (distFinal <= skillAlcance) {
    // Em perseguição global, re-adiciona alvo ao combate antes de atacar
    if (perseguicaoGlobal && !bat.envolvidos.includes(skillAlvo.id)) {
      bat.envolvidos.push(skillAlvo.id);
      const initRoll = Math.floor(Math.random()*20)+1+4;
      bat.iniciativa.push({ ...skillAlvo, initRoll });
      bat.iniciativa.sort((a,b) => b.initRoll - a.initRoll);
      _avtLog(`${skillAlvo.nome} foi alcançado e entrou em combate!`, bat.id);
      _avtBroadcastJoinBatalha(bat.id, skillAlvo.id, skillAlvo.nome);
    }
    _avtSetTimeout(() => _avtNpcExecutarAtaque(bat, npc, entNpc, skillAlvo, sk), moved ? 400 : 0);
  } else {
    _avtSetTimeout(() => _avtTurnoAvancar(bat), moved ? 500 : 300);
  }
}

function _avtCheckVitoria(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const inimigosVivos = bat.iniciativa.some(e => e.tipo==='inimigo' && e.hp>0);
  if (!inimigosVivos) {
    _avtSetTimeout(() => {
      _avtLog('=== VITÓRIA ===', bat.id);
      _avtRenderLog();
      avtCombateEncerrar(bat.id);
      mostrarToast('✦ Vitória!', 'sucesso');
    }, 400);
  }
}

function _avtCheckDerrota(bat) {
  if (!bat) bat = _avtMinhaBatalha();
  if (!bat) return;
  const jogadoresVivos = bat.iniciativa.some(e => e.tipo==='jogador' && e.hp>0);
  if (!jogadoresVivos) {
    _avtSetTimeout(() => {
      _avtLog('=== DERROTA ===', bat.id);
      _avtRenderLog();
      avtCombateEncerrar(bat.id);
      mostrarToast('💀 Todos os heróis caíram…', 'erro');
    }, 400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DICE
// ─────────────────────────────────────────────────────────────────────────────

function _avtRolarFormula(formula) {
  if (!formula) return Math.floor(Math.random()*8)+1;
  let total = 0;
  String(formula).toLowerCase().split('+').forEach(p => {
    p = p.trim();
    const m = p.match(/^(\d*)d(\d+)$/);
    if (m) { const n=parseInt(m[1])||1,d=parseInt(m[2])||6; for(let i=0;i<n;i++) total+=Math.floor(Math.random()*d)+1; }
    else total += parseInt(p)||0;
  });
  return Math.max(1, total);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG + HP BAR
// ─────────────────────────────────────────────────────────────────────────────

function _avtLog(msg, batalhaId) {
  const bat = batalhaId ? AVT_STATE.batalhas.find(b => b.id === batalhaId) : _avtMinhaBatalha();
  if (bat) {
    bat.log.unshift(msg);
    if (bat.log.length > 30) bat.log.length = 30;
  }
  _avtRenderLog();
}

function _avtRenderLog() {
  const el = document.getElementById('avt-log');
  if (!el) return;
  const bat = _avtMinhaBatalha();
  const log = bat ? bat.log : [];
  el.innerHTML = log.map(l => `<div class="avt-log-linha">${l}</div>`).join('');
}

function _avtRenderHpBar() {
  const wrap = document.getElementById('avt-hp-bars');
  if (!wrap) return;
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo==='jogador');
  wrap.innerHTML = jogadores.map(j => {
    const pct = Math.max(0, j.hp/j.hpMax*100);
    const col = pct>50 ? '#27ae60' : pct>25 ? '#f39c12' : '#e74c3c';
    return `<div class="avt-hp-item">
      <span class="avt-hp-nome" style="color:${j.cor}">${j.nome.split(' ')[0]}</span>
      <div class="avt-hp-bar-wrap"><div class="avt-hp-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <span class="avt-hp-val">${j.hp}/${j.hpMax}</span>
    </div>`;
  }).join('');
}

function _avtToggleLog() {
  const panel = document.getElementById('avt-log-panel');
  if (!panel) return;
  panel.style.display = panel.style.display==='none' ? 'block' : 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER DETECTION & PANEL
// ─────────────────────────────────────────────────────────────────────────────

function _avtDetectarMestre() {
  AVT_STATE.isMestre = !!(AVT_STATE.rpg?.owner_id && SESSION?.user?.id &&
    AVT_STATE.rpg.owner_id === SESSION.user.id);
  const btnM = document.getElementById('avt-btn-mestre');
  if (btnM) btnM.style.display = AVT_STATE.isMestre ? 'inline-flex' : 'none';
  const btnP = document.getElementById('avt-btn-player');
  if (btnP) btnP.style.display = AVT_STATE.isMestre ? 'none' : 'inline-flex';
  const btnC = document.getElementById('avt-btn-combate');
  if (btnC) btnC.style.display = AVT_STATE.isMestre ? 'inline-flex' : 'none';
}

// ─── PLAYER PANEL HELPERS ──────────────────────────────────────────────────────

// Recuperação passiva por movimento: +1 HP e +1 recurso (Mana/Stamina/etc.) por célula fora de combate
function _avtRecuperarPorMovimento(jogador, celulas) {
  if (celulas <= 0) return;
  const char = AVT_STATE.chars.find(c => c.nome === jogador.nome || c.id === jogador.dbId);
  if (!char) return;
  const ca   = char.custom_attrs || {};
  const atrs = ca.atributos || {};

  const hpMax    = ca.hp_max || jogador.hpMax || 100;
  const hpDepois = Math.min(hpMax, (char.hp_atual || jogador.hp || 0) + celulas);
  char.hp_atual  = hpDepois;
  jogador.hp     = hpDepois;

  _avtRecursosDoChar(char).forEach(r => {
    atrs[r.nome] = Math.min(r.max, r.atual + celulas);
  });
  ca.atributos  = atrs;
  char.custom_attrs = ca;

  _avtRenderHpBar();
  const pp = document.getElementById('avt-player-panel');
  if (pp && pp.style.display !== 'none') avtJogadorPainelRender();

  clearTimeout(AVT_STATE._recDebounceTimer);
  AVT_STATE._recDebounceTimer = setTimeout(async () => {
    AVT_STATE._recDebounceTimer = null;
    await _avtSb(`characters?id=eq.${encodeURIComponent(char.id)}`,
      { method: 'PATCH', body: JSON.stringify({ hp_atual: char.hp_atual, custom_attrs: ca }) }
    ).catch(() => {});
  }, 2000);
}

// Preenche RPG_DATA com dados de AVT_STATE para que funções de combat.js e
// inventory.js funcionem em adventure mode. Retorna função de restauração.
function _avtPatchRpgData() {
  const prev = window.RPG_DATA;
  window.RPG_DATA = {
    rpgId:      AVT_STATE.rpgId,
    characters: AVT_STATE.chars,
    skills:     AVT_STATE.skills || [],
    attrDefs:   AVT_STATE.attrDefs || [],
    myRole:     AVT_STATE.isMestre ? 'mestre' : 'jogador',
    linked:     AVT_STATE.myCharNome,
    config:     AVT_STATE.rpg?.theme_json || {},
  };
  return () => { window.RPG_DATA = prev; };
}

// Retorna lista de recursos do char: { nome, atual, max, maxAttr }
function _avtRecursosDoChar(char) {
  if (!char) return [];
  const atrs = char.custom_attrs?.atributos || {};
  const recursos = [];
  (AVT_STATE.attrDefs || []).forEach(def => {
    let cfg = {};
    try { cfg = typeof def.opcoes === 'string' ? JSON.parse(def.opcoes) : (def.opcoes || {}); } catch(e) {}
    if (cfg.e_recurso && cfg.max_attr) {
      const atual = parseFloat(atrs[def.nome] ?? 0);
      const max   = parseFloat(atrs[cfg.max_attr] ?? 0);
      if (max > 0) recursos.push({ nome: def.nome, atual, max, maxAttr: cfg.max_attr });
    }
  });
  // Fallback: detectar atributos com padrão Mana/Stamina/Ki mesmo sem attrDefs configurado
  if (!recursos.length) {
    const ALIASES = [
      { r: /^mana$/i, rMax: /^mana.?max$/i, nome: 'Mana' },
      { r: /^stamina$/i, rMax: /^stamina.?max$/i, nome: 'Stamina' },
      { r: /^ki$/i, rMax: /^ki.?max$/i, nome: 'Ki' },
      { r: /^energia$/i, rMax: /^energia.?max$/i, nome: 'Energia' },
    ];
    const keys = Object.keys(atrs);
    ALIASES.forEach(({ r, rMax, nome }) => {
      const k    = keys.find(k => r.test(k));
      const kMax = keys.find(k => rMax.test(k));
      if (k && kMax) {
        const atual = parseFloat(atrs[k] ?? 0);
        const max   = parseFloat(atrs[kMax] ?? 0);
        if (max > 0) recursos.push({ nome: k, atual, max, maxAttr: kMax });
      }
    });
  }
  return recursos;
}

// Deduz custo de recurso de uma skill no contexto de aventura (sem RPG_DATA)
async function _avtDescontarCustoSkill(nomeChar, custo_rsv) {
  if (!custo_rsv || /^passiv/i.test(custo_rsv)) return true;
  const match = custo_rsv.trim().match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return true;
  const quantidade = parseFloat(match[1]);
  const atributo   = match[2].trim();
  const char = AVT_STATE.chars.find(c => c.nome === nomeChar);
  if (!char) return false;
  const atrs  = char.custom_attrs?.atributos || {};
  const atual = parseFloat(atrs[atributo] ?? 0);
  if (atual < quantidade) {
    mostrarToast(`❌ ${atributo} insuficiente (${atual}/${quantidade})`, 'erro');
    return false;
  }
  atrs[atributo] = Math.max(0, atual - quantidade);
  if (!char.custom_attrs) char.custom_attrs = {};
  char.custom_attrs.atributos = atrs;
  mostrarToast(`−${quantidade} ${atributo}`, '');
  await _avtSb(`characters?id=eq.${encodeURIComponent(char.id)}`,
    { method: 'PATCH', body: JSON.stringify({ custom_attrs: char.custom_attrs }) }
  ).catch(() => {});
  avtJogadorPainelRender();
  return true;
}

// Abre modal de inventário dentro do modo aventura
async function avtAbrirInventario() {
  const jogador = _avtMeuJogador();
  if (!jogador) return mostrarToast('Nenhum personagem vinculado', 'aviso');
  const char = AVT_STATE.chars.find(c => c.nome === jogador.nome);
  if (!char) return;

  const modal = document.getElementById('avt-inventario-modal');
  if (!modal) return;

  // Garantir que dados de inventário estão carregados
  if (!INV?.itemDefs?.length) {
    mostrarToast('Carregando inventário…', '');
    const restore0 = _avtPatchRpgData();
    try { await invCarregarDados(AVT_STATE.rpgId).catch(() => {}); } finally { restore0(); }
  }
  if (char.id && !INV.inventario.some(i => i.character_id === char.id)) {
    await invCarregarInventarioChar(char.id).catch(() => {});
  }

  modal.style.display = 'flex';

  // Monkey-patch invToggleEquip para usar RPG_DATA bridge
  const _origToggle = window.invToggleEquip;
  window.invToggleEquip = async function(nome, id) {
    const restore2 = _avtPatchRpgData();
    try { await _origToggle(nome, id); } finally { restore2(); }
    // Sincronizar atributos atualizados de volta ao AVT_STATE
    const updated = window.RPG_DATA?.characters?.find?.(x => x.nome === nome);
    const avt = AVT_STATE.chars.find(x => x.nome === nome);
    if (avt && updated) avt.custom_attrs = updated.custom_attrs;
    const pp = document.getElementById('avt-player-panel');
    if (pp && pp.style.display !== 'none') avtJogadorPainelRender();
    // Refreshar o modal com RPG_DATA ativo
    const body = document.getElementById('avt-inv-body');
    if (body) {
      body.id = 'fichas-sec-inventario';
      const r3 = _avtPatchRpgData();
      try { await renderInventarioChar(nome); } finally { r3(); body.id = 'avt-inv-body'; }
    }
  };
  // Salva restore para quando o modal fechar
  modal._restoreToggle = () => { window.invToggleEquip = _origToggle; };

  // Troca temporária de ID para renderInventarioChar encontrar o container
  const body = document.getElementById('avt-inv-body');
  if (body) body.id = 'fichas-sec-inventario';
  const restore = _avtPatchRpgData();
  try {
    await renderInventarioChar(jogador.nome);
  } finally {
    restore();
    const el = document.getElementById('fichas-sec-inventario');
    if (el && el.closest('#avt-inventario-modal')) el.id = 'avt-inv-body';
  }
}
window.avtAbrirInventario = avtAbrirInventario;

function avtFecharInventario() {
  const modal = document.getElementById('avt-inventario-modal');
  if (!modal) return;
  modal.style.display = 'none';
  if (typeof modal._restoreToggle === 'function') { modal._restoreToggle(); modal._restoreToggle = null; }
}
window.avtFecharInventario = avtFecharInventario;

// Bridge para usar consumível no contexto de aventura
async function avtUsarConsumivel(invId, nomeUsuario) {
  if (!INV?.inventario?.length) await invCarregarTodosInventarios().catch(() => {});
  const restore = _avtPatchRpgData();
  try { await abrirModalUsarItem(invId, nomeUsuario); } finally { restore(); }
}
window.avtUsarConsumivel = avtUsarConsumivel;

// Descanso curto ou longo no modo aventura
async function avtDescansar(tipo) {
  const jogador = _avtMeuJogador();
  if (!jogador) return;
  const char = AVT_STATE.chars.find(c => c.nome === jogador.nome);
  if (!char) return;
  const ca  = char.custom_attrs || {};
  const atrs = ca.atributos || {};

  if (tipo === 'longo') {
    char.hp_atual = ca.hp_max || char.hpMax || 100;
    // Restaurar todos recursos ao máximo
    (AVT_STATE.attrDefs || []).forEach(def => {
      let cfg = {};
      try { cfg = typeof def.opcoes === 'string' ? JSON.parse(def.opcoes) : (def.opcoes || {}); } catch(e) {}
      if (cfg.e_recurso && cfg.max_attr && atrs[cfg.max_attr] != null) {
        atrs[def.nome] = parseFloat(atrs[cfg.max_attr]);
      }
    });
    // Fallback para Mana/Stamina sem attrDefs configurado
    _avtRecursosDoChar(char).forEach(r => { atrs[r.nome] = r.max; });
    // Limpar cooldowns da batalha ativa
    const bat = AVT_STATE.batalhas.find(b => b.envolvidos?.includes(jogador.id));
    if (bat?.cooldowns) bat.cooldowns = {};
    if (AVT_STATE._cooldowns) {
      Object.keys(AVT_STATE._cooldowns).forEach(k => {
        if (k.startsWith(jogador.id + '_')) delete AVT_STATE._cooldowns[k];
      });
    }
    mostrarToast('😴 Descanso longo! Recursos restaurados.', 'sucesso');
  } else {
    const hpMax = ca.hp_max || char.hpMax || 100;
    const recuperar = Math.floor(hpMax * 0.5);
    char.hp_atual = Math.min(hpMax, (char.hp_atual || 0) + recuperar);
    // Recuperar 30% de Stamina (não Mana — representa fôlego físico)
    _avtRecursosDoChar(char).forEach(r => {
      if (/stamina|vigor|resistencia/i.test(r.nome)) {
        atrs[r.nome] = Math.min(r.max, r.atual + Math.floor(r.max * 0.3));
      }
    });
    mostrarToast(`🌿 Descanso curto. +${recuperar} HP`, 'sucesso');
  }

  ca.atributos = atrs;
  char.custom_attrs = ca;
  const ent = AVT_STATE.entidades.find(e => e.nome === char.nome);
  if (ent) { ent.hp = char.hp_atual; ent.hpMax = ca.hp_max || ent.hpMax; }

  await _avtSb(`characters?id=eq.${encodeURIComponent(char.id)}`,
    { method: 'PATCH', body: JSON.stringify({ hp_atual: char.hp_atual, custom_attrs: ca }) }
  ).catch(() => {});
  avtJogadorPainelRender();
  _avtRenderHpBar();
}
window.avtDescansar = avtDescansar;

// ─── PLAYER PANEL ─────────────────────────────────────────────────────────────

function avtJogadorPainel() {
  const panel = document.getElementById('avt-player-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  if (!open) avtJogadorPainelRender();
}
window.avtJogadorPainel = avtJogadorPainel;

function avtJogadorPainelRender() {
  const el = document.getElementById('avt-pp-content');
  if (!el) return;
  const jogador = _avtMeuJogador();
  const bat     = _avtMinhaBatalha();
  const skills  = AVT_STATE.skills?.filter(s => !jogador || s.personagem === jogador.nome || (s.character_id && jogador.dbId && s.character_id === jogador.dbId)) || [];
  const char    = jogador ? AVT_STATE.chars.find(c => c.nome === jogador.nome) : null;

  if (!jogador) {
    el.innerHTML = `<p style="color:#7a92aa;font-family:var(--fonte-d);font-size:0.75rem">Nenhum personagem vinculado à sua sessão.</p>`;
    return;
  }

  const hpPct   = Math.max(0, (jogador.hp / jogador.hpMax) * 100);
  const hpCol   = hpPct > 50 ? '#27ae60' : hpPct > 25 ? '#f39c12' : '#e74c3c';
  const xp      = char?.xp ?? char?.custom_attrs?.xp ?? 0;
  const nivel   = char?.nivel ?? (char?.custom_attrs?.nivel ?? 1);
  const maxNivel = AVT_STATE.rpg?.theme_json?.level_config?.nivel_maximo || 20;
  const atMaxNivel = nivel >= maxNivel;
  const xpProximo  = atMaxNivel ? null : _avtXpParaNivel(nivel);
  const xpPct      = atMaxNivel ? 100 : Math.min(100, (xp / xpProximo) * 100);

  // ── 1. Header: avatar + nome + nível ──────────────────────────
  let html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:44px;height:44px;border-radius:50%;background:${jogador.cor || '#4fa3d1'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${jogador.icone || '⚔'}</div>
        <div style="flex:1">
          <div style="font-family:var(--fonte-d);font-size:0.88rem;color:#c8d8e8;letter-spacing:.06em">${jogador.nome}</div>
          <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa">${atMaxNivel ? `Nível ${nivel} <span style="color:#c8a84b">(MAX)</span>` : `Nível ${nivel} · ${xp}/${xpProximo} XP`}</div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;margin-bottom:3px">
          <span>HP</span><span style="color:${hpCol}">${jogador.hp} / ${jogador.hpMax}</span>
        </div>
        <div style="height:7px;background:rgba(79,163,209,0.12);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${hpPct}%;background:${hpCol};transition:width .3s"></div>
        </div>
      </div>
      <div>
        <div style="height:5px;background:rgba(200,168,75,0.12);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${xpPct}%;background:${atMaxNivel ? '#c8a84b' : 'linear-gradient(90deg,#b8922b,#ffe066,#c8a84b)'};border-radius:4px;transition:width .5s ease;box-shadow:0 0 6px rgba(200,168,75,0.5)"></div>
        </div>
      </div>
    </div>`;

  // ── 2. Barras de recurso (Mana, Stamina, etc.) ─────────────────
  const recursos = _avtRecursosDoChar(char);
  if (recursos.length) {
    html += `<div style="display:flex;flex-direction:column;gap:5px">`;
    recursos.forEach(r => {
      const pct = Math.max(0, Math.min(100, (r.atual / r.max) * 100));
      const cor = /mana|magia|arcana/i.test(r.nome) ? '#7ec8f0'
                : /stamina|vigor|fisica/i.test(r.nome) ? '#f0a050'
                : /ki|energia/i.test(r.nome) ? '#9b8fd4'
                : '#5ee09a';
      html += `
      <div>
        <div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.6rem;color:#7a92aa;margin-bottom:2px">
          <span>${r.nome}</span>
          <span style="color:${cor}">${Math.round(r.atual)} / ${Math.round(r.max)}</span>
        </div>
        <div style="height:5px;background:rgba(79,163,209,0.1);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width .3s"></div>
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── 3. Mini-painel de atributos (colapsável) ───────────────────
  const atrs = char?.custom_attrs?.atributos || {};
  const recursosNomes = new Set(recursos.flatMap(r => [r.nome, r.maxAttr]));
  const atrsKeys = Object.keys(atrs).filter(k => !recursosNomes.has(k)).slice(0, 8);
  const buffsAtivos = (char?.buffs || char?.custom_attrs?.buffs || []).filter(b => (b.turnos_restantes || 0) > 0);
  const attrsAberto = AVT_STATE._ppAttrsOpen || false;

  if (atrsKeys.length) {
    html += `
    <div style="border:1px solid rgba(79,163,209,0.1);border-radius:8px;overflow:hidden">
      <div onclick="AVT_STATE._ppAttrsOpen=!AVT_STATE._ppAttrsOpen;avtJogadorPainelRender()"
        style="padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:rgba(79,163,209,0.04)">
        <span style="font-family:var(--fonte-d);font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">📊 Atributos</span>
        <span style="font-size:0.7rem;color:#7a92aa">${attrsAberto ? '▴' : '▾'}</span>
      </div>
      ${attrsAberto ? `
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:0">
        ${atrsKeys.map(k => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(79,163,209,0.05)">
          <span style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa">${k}</span>
          <span style="font-family:var(--fonte-d);font-size:0.72rem;color:#c8d8e8">${Math.round(parseFloat(atrs[k]) || 0)}</span>
        </div>`).join('')}
        ${buffsAtivos.length ? `
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(79,163,209,0.08)">
          <div style="font-family:var(--fonte-d);font-size:0.52rem;color:#7a92aa;text-transform:uppercase;margin-bottom:3px">Efeitos Ativos</div>
          ${buffsAtivos.map(b => {
            const cor = b.tipo === 'debuff' || b.negativo ? '#e74c3c' : '#5ee09a';
            return `<div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.6rem;padding:2px 0">
              <span style="color:${cor}">${b.tipo === 'debuff' ? '☠' : '✨'} ${b.nome}</span>
              <span style="color:#7a92aa">${b.turnos_restantes}t</span>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>` : ''}
    </div>`;
  }

  // ── 4. Botão Inventário ────────────────────────────────────────
  html += `
  <button onclick="avtAbrirInventario()"
    style="width:100%;background:rgba(200,168,75,0.08);border:1px solid rgba(200,168,75,0.2);
    border-radius:7px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.65rem;
    padding:8px 12px;cursor:pointer;letter-spacing:.05em;transition:background 0.15s"
    onmouseover="this.style.background='rgba(200,168,75,0.16)'"
    onmouseout="this.style.background='rgba(200,168,75,0.08)'">
    🎒 Inventário
  </button>`;

  // ── 5. Combate ativo ───────────────────────────────────────────
  if (bat) {
    const podeEncerrar = bat.iniciador === jogador.nome;
    html += `
    <div style="border:1px solid rgba(232,96,76,0.25);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#e8604c;text-transform:uppercase;letter-spacing:.08em">⚔ Combate Ativo</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${bat.iniciativa.map((e,i) => `<span style="font-family:var(--fonte-d);font-size:0.62rem;padding:2px 7px;border-radius:4px;border:1px solid ${i===bat.turnoIdx?'rgba(232,96,76,0.6)':'rgba(79,163,209,0.2)'};color:${i===bat.turnoIdx?'#e8604c':'#7a92aa'}">${e.nome.split(' ')[0]} ${e.hp}HP</span>`).join('')}
      </div>
      ${podeEncerrar ? `<button onclick="avtEncerrarMeuCombate()" style="background:rgba(232,96,76,0.12);border:1px solid rgba(232,96,76,0.3);border-radius:6px;color:#e8604c;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 10px;cursor:pointer">⚑ Encerrar meu combate</button>` : ''}
    </div>`;
  }

  // ── 6. Baú na posição ─────────────────────────────────────────
  const bauNaPosicao = _avtBauNaPosicao(jogador.x, jogador.y);
  if (bauNaPosicao) {
    html += `
    <div style="border:1px solid rgba(200,168,75,0.25);border-radius:8px;padding:10px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#c8a84b;margin-bottom:8px">📦 ${bauNaPosicao.nome || 'Baú'}</div>
      <button onclick="avtAbrirBau('${bauNaPosicao.id}')" style="background:rgba(200,168,75,0.12);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.62rem;padding:5px 12px;cursor:pointer;width:100%">📦 Abrir Baú</button>
    </div>`;
  }

  // ── 7. Consumíveis rápidos ─────────────────────────────────────
  if (char?.id && typeof INV !== 'undefined') {
    const invChar = (INV.inventario || []).filter(i => i.character_id === char.id);
    const consumiveis = invChar.filter(i => {
      const def = (INV.itemDefs || []).find(d => d.id === (i.item_catalog_id || i.item_def_id));
      return def?.tipo === 'consumivel' && i.quantidade > 0;
    });
    if (consumiveis.length) {
      const nomeSafe = jogador.nome.replace(/'/g, "\\'");
      html += `
      <div style="display:flex;flex-direction:column;gap:5px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">🧪 Consumíveis</div>
          <button onclick="avtAbrirInventario()" style="background:none;border:none;font-family:var(--fonte-d);font-size:0.58rem;color:#4fa3d1;cursor:pointer;padding:0">ver todos</button>
        </div>
        ${consumiveis.slice(0, 3).map(i => {
          const def = (INV.itemDefs || []).find(d => d.id === (i.item_catalog_id || i.item_def_id));
          if (!def) return '';
          const efeitos = Array.isArray(def.efeitos) ? def.efeitos : [];
          const ef1 = efeitos[0];
          const efLabel = ef1
            ? (ef1.tipo === 'hp' ? `❤ +${ef1.valor}` : ef1.tipo === 'recurso' ? `✨ +${ef1.valor}` : (def.descricao || ''))
            : (def.descricao || '');
          return `
          <div style="display:flex;align-items:center;gap:8px;border:1px solid rgba(79,163,209,0.1);border-radius:6px;padding:6px 9px">
            <span style="font-size:1.1rem;flex-shrink:0">${def.icone || '📦'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--fonte-d);font-size:0.7rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.nome}</div>
              <div style="font-size:0.6rem;color:#7a92aa">${efLabel ? efLabel + ' · ' : ''}×${i.quantidade}</div>
            </div>
            <button onclick="avtUsarConsumivel(${i.id},'${nomeSafe}')" style="background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.22);border-radius:5px;color:#5ee09a;font-family:var(--fonte-d);font-size:0.58rem;padding:4px 8px;cursor:pointer;flex-shrink:0">Usar</button>
          </div>`;
        }).join('')}
      </div>`;
    }
  }

  // ── 8. Habilidades (aprimoradas) ───────────────────────────────
  if (skills.length) {
    const cooldowns = bat?.cooldowns || AVT_STATE._cooldowns || {};
    const TIPO_COR   = { acao:'#4fa3d1', passiva:'#5ee09a', reacao:'#c8a84b', interrupcao:'#e8604c', acao_livre:'#9b8fd4' };
    const TIPO_LABEL = { acao:'Ação', passiva:'Passiva', reacao:'Reação', interrupcao:'Interrupção', acao_livre:'Livre' };
    const DANO_COR   = { fisico:'#f0cc6a', magico:'#7ec8f0', cura:'#5ee09a', fogo:'#e05c00', gelo:'#4fc3f7', necro:'#9b59b6', raio:'#ffe066' };

    html += `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">⚔ Habilidades</div>
      ${skills.slice(0, 8).map(s => {
        const cdKey = (jogador.id || jogador.nome) + '_' + s.id;
        const cd    = cooldowns[cdKey] || cooldowns[s.id] || 0;
        const emCd  = cd > 0;

        // Custo de recurso
        let custoHtml = '';
        if (s.custo_rsv && !/^passiv/i.test(s.custo_rsv)) {
          const m = s.custo_rsv.trim().match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
          if (m) {
            const qtd  = parseFloat(m[1]);
            const attr = m[2].trim();
            const temRecurso = parseFloat(atrs[attr] ?? 0) >= qtd;
            const cor = temRecurso ? '#9b8fd4' : '#e74c3c';
            custoHtml = `<span style="font-size:0.6rem;color:${cor};padding:1px 5px;border:1px solid ${cor}44;border-radius:3px">⚡${s.custo_rsv}</span>`;
          }
        }

        // Faixa de dano com bônus de atributo
        let danoHtml = '';
        if (s.formula_dano) {
          const grupos = [...s.formula_dano.matchAll(/(\d+)d(\d+)/g)];
          const fixo   = (s.formula_dano.match(/[+-]\d+(?!d\d)/g) || []).reduce((a, v) => a + parseInt(v), 0);
          const modAttr = (s.atributo_base && s.mod_atributo_pct)
            ? Math.ceil(parseFloat(
                atrs[s.atributo_base] ??
                atrs[Object.keys(atrs).find(k => k.toLowerCase() === (s.atributo_base || '').toLowerCase())] ?? 0
              ) * s.mod_atributo_pct / 100)
            : 0;
          const minDado  = grupos.reduce((a, m) => a + parseInt(m[1]), 0);
          const maxDado  = grupos.reduce((a, m) => a + parseInt(m[1]) * parseInt(m[2]), 0);
          const minTotal = minDado + fixo + modAttr;
          const maxTotal = maxDado + fixo + modAttr;
          const corDano  = DANO_COR[s.tipo_dano] || '#f0cc6a';
          const modStr   = modAttr ? ` <span style="color:#7ec8f0">+${modAttr}(${s.atributo_base})</span>` : '';
          danoHtml = grupos.length
            ? `<span style="font-size:0.62rem;color:${corDano}">🎲 ${s.formula_dano}${modStr} <span style="color:#7a92aa;font-size:0.58rem">(${minTotal}–${maxTotal})</span></span>`
            : `<span style="font-size:0.62rem;color:${corDano}">🎲 ${s.formula_dano}</span>`;
        }

        const tipoCor   = TIPO_COR[s.tipo_habilidade] || '#4fa3d1';
        const tipoLabel = TIPO_LABEL[s.tipo_habilidade] || 'Ação';

        return `
        <div style="border:1px solid ${emCd ? 'rgba(100,100,100,0.1)' : 'rgba(79,163,209,0.14)'};border-radius:7px;padding:9px 10px;opacity:${emCd ? '0.5' : '1'};background:${emCd ? 'rgba(10,15,25,0.4)' : 'transparent'}">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:${(danoHtml || custoHtml) ? '4px' : '0'};flex-wrap:wrap">
            <span style="font-family:var(--fonte-d);font-size:0.75rem;color:${emCd ? '#556677' : '#c8d8e8'};flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.habilidade}</span>
            <span style="font-family:var(--fonte-d);font-size:0.5rem;padding:1px 5px;border:1px solid ${tipoCor}44;border-radius:3px;color:${tipoCor};flex-shrink:0">${tipoLabel}</span>
            ${emCd ? `<span style="font-family:var(--fonte-d);font-size:0.58rem;color:#f0a050;background:rgba(240,160,80,0.1);border:1px solid rgba(240,160,80,0.2);border-radius:3px;padding:1px 5px;flex-shrink:0">⏳${cd}t</span>` : ''}
          </div>
          ${s.efeito && !danoHtml ? `<div style="font-size:0.6rem;color:#7a92aa;margin-bottom:3px;line-height:1.4">${s.efeito}</div>` : ''}
          ${(danoHtml || custoHtml) ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${danoHtml}${custoHtml}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── 9. Log recente ───────────────────────────────────────────
  const allBatlogs = AVT_STATE.batalhas.flatMap(b => b.log.slice(0, 5));
  if (allBatlogs.length) {
    html += `
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">Log recente</div>
      ${allBatlogs.map(l => `<div style="font-family:var(--fonte-d);font-size:0.62rem;color:#c8d8e8;padding:3px 0;border-bottom:1px solid rgba(79,163,209,0.07)">${l}</div>`).join('')}
    </div>`;
  }

  el.innerHTML = html;
}
window.avtJogadorPainelRender = avtJogadorPainelRender;

// Check if a baú object exists at player's exact position
function _avtBauNaPosicao(x, y) {
  const rd = AVT_STATE.dungeon?.render_data;
  if (!rd?.objetos) return null;
  const largura = AVT_STATE.dungeon?.w || 1;
  const altura = AVT_STATE.dungeon?.h || 1;
  return rd.objetos.find(o => {
    if (o.tipo !== 'bau' && o.tipo !== 'chest') return false;
    const ox = Math.round((o.x ?? 0) * largura);
    const oy = Math.round((o.y ?? 0) * altura);
    return ox === x && oy === y;
  }) || null;
}

// Open a chest at player's position
async function avtAbrirBau(bauId) {
  const jogador = _avtMeuJogador();
  if (!jogador) return;
  const rd = AVT_STATE.dungeon?.render_data;
  const bau = rd?.objetos?.find(o => o.id === bauId || String(o.id) === String(bauId));
  if (!bau) { mostrarToast('Baú não encontrado', 'erro'); return; }
  if (bau.aberto) { mostrarToast('Este baú já foi aberto', 'aviso'); return; }
  bau.aberto = true;

  const char = AVT_STATE.chars.find(c => c.nome === jogador.nome);
  if (!char) return;

  // Distribute loot
  const loot = bau.loot_itens || [];
  if (loot.length === 0 && !bau.ouro) {
    mostrarToast('📦 Baú vazio!', 'aviso');
    avtJogadorPainelRender();
    return;
  }

  // Add gold if any
  if (bau.ouro && char) {
    const ca = { ...(char.custom_attrs || {}), ouro: (char.custom_attrs?.ouro || 0) + bau.ouro };
    char.custom_attrs = ca;
    await _avtSb('characters?id=eq.' + encodeURIComponent(char.id), { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) }).catch(()=>{});
    mostrarToast(`📦 Baú: +${bau.ouro} ouro!`, 'sucesso');
  }

  // Add items to inventario
  for (const item of loot) {
    if (!item.item_catalog_id && !item.id) continue;
    const itemId = item.item_catalog_id || item.id;
    await _avtSb('inventario', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        rpg_id: AVT_STATE.rpgId,
        character_id: char.id,
        personagem_nome: char.nome,
        item_catalog_id: itemId,
        quantidade: item.quantidade || 1,
        origem: 'bau',
      })
    }).catch(()=>{});
  }

  if (loot.length) mostrarToast(`📦 Baú aberto! ${loot.length} item(ns) adicionado(s) ao inventário`, 'sucesso');
  realtimeBroadcast('avt_bau_aberto', { bauId, jogadorNome: jogador.nome });
  avtJogadorPainelRender();
}
window.avtAbrirBau = avtAbrirBau;

// ─── END PLAYER PANEL ─────────────────────────────────────────────────────────

// ─── CATALOG IMPORT ───────────────────────────────────────────────────────────

function avtImportarCatalogo() {
  const existing = document.getElementById('avt-catalog-import-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'avt-catalog-import-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:12px;padding:20px;width:min(560px,95vw);display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-family:var(--fonte-d);font-size:0.85rem;color:#4fa3d1;flex:1;letter-spacing:.08em">IMPORTAR CATÁLOGO DE ITENS</span>
        <button onclick="document.getElementById('avt-catalog-import-modal').remove()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem">×</button>
      </div>
      <div style="font-family:var(--fonte-d);font-size:0.7rem;color:#7a92aa">Cole o JSON do catálogo abaixo. Formato: array de objetos com campos <code>nome</code>, <code>tipo</code>, <code>descricao</code>, <code>icone</code>, <code>raridade</code>, <code>droppable</code>, <code>drop_rate</code>, etc.</div>
      <textarea id="avt-catalog-json" rows="10" placeholder='[{"nome":"Espada de Ferro","tipo":"equipamento","icone":"⚔","raridade":"comum","droppable":true,"drop_rate":0.1}]'
        style="width:100%;background:#050810;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;padding:8px;font-family:monospace;resize:vertical;outline:none"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="document.getElementById('avt-catalog-import-modal').remove()" style="background:none;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7a92aa;font-family:var(--fonte-d);font-size:0.72rem;padding:6px 14px;cursor:pointer">Cancelar</button>
        <button onclick="avtImportarCatalogoConfirmar()" style="background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.4);border-radius:6px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.72rem;padding:6px 14px;cursor:pointer">Importar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.avtImportarCatalogo = avtImportarCatalogo;

async function avtImportarCatalogoConfirmar() {
  const raw = document.getElementById('avt-catalog-json')?.value.trim();
  if (!raw) { mostrarToast('Cole o JSON do catálogo', 'aviso'); return; }
  let itens;
  try { itens = JSON.parse(raw); } catch(e) { mostrarToast('JSON inválido: ' + e.message, 'erro'); return; }
  if (!Array.isArray(itens)) { mostrarToast('JSON deve ser um array de itens', 'erro'); return; }

  const rpgId = AVT_STATE.rpgId;
  if (!rpgId) { mostrarToast('Aventura não carregada', 'erro'); return; }

  mostrarToast('Importando...', '');
  let sucesso = 0, falha = 0;
  for (const item of itens) {
    try {
      await _avtSb('item_catalog', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...item, rpg_id: rpgId })
      });
      sucesso++;
    } catch(e) { falha++; }
  }

  // Reload catalog
  const catalog = await _avtSb(`item_catalog?rpg_id=eq.${encodeURIComponent(rpgId)}&select=id,nome,tipo,icone,raridade,img_url,slot_padrao,atributos_bonus,droppable,drop_rate`).catch(()=>[]);
  AVT_STATE.itemCatalog = catalog || [];

  document.getElementById('avt-catalog-import-modal')?.remove();
  mostrarToast(`Catálogo importado: ${sucesso} item(ns)${falha ? `, ${falha} erro(s)` : ''}`, sucesso ? 'sucesso' : 'erro');
}
window.avtImportarCatalogoConfirmar = avtImportarCatalogoConfirmar;

// ─── END CATALOG IMPORT ───────────────────────────────────────────────────────

function avtMestrePainel() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  if (!open) _avtMestrePainelRender();
}

function _avtPlaySkillAnim(sk, alvoEnt, atacanteEnt) {
  if (!sk || !alvoEnt) return;
  const anim = sk.animacao || {};
  const tipo = anim.tipo || 'nenhuma';
  if (tipo === 'nenhuma') return;

  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));
  const toScreen = (ent) => ({
    x: Math.round(ent.x * SZ - AVT_STATE.camera.x + SZ / 2),
    y: Math.round(ent.y * SZ - AVT_STATE.camera.y + SZ / 2),
  });

  const alvoScr = toScreen(alvoEnt);
  const atacScr = atacanteEnt ? toScreen(atacanteEnt) : alvoScr;

  if (tipo === 'simples') {
    _avtCanvasFlash(alvoScr.x, alvoScr.y, anim.cor || '#e74c3c', anim.subtipo || 'Impacto');
    return;
  }

  if (tipo === 'gsap') {
    const gc = anim.gsap_config || {};
    const posicao = anim.posicao || gc.alvo_efeito || 'alvo';
    const cor = gc.cor || anim.cor || '#e74c3c';
    const midX = Math.round((atacScr.x + alvoScr.x) / 2);
    const midY = Math.round((atacScr.y + alvoScr.y) / 2);
    const fx = posicao === 'atacante' ? atacScr.x : posicao === 'meio' ? midX : alvoScr.x;
    const fy = posicao === 'atacante' ? atacScr.y : posicao === 'meio' ? midY : alvoScr.y;
    if (posicao === 'ambos') {
      _avtCanvasFlash(atacScr.x, atacScr.y, cor, gc.preset || 'Impacto');
      _avtCanvasFlash(alvoScr.x, alvoScr.y, cor, gc.preset || 'Impacto');
    } else if (posicao === 'trajetoria' || posicao === 'raio' || posicao === 'retorno') {
      _avtCanvasEfeito('projetil', atacScr.x, atacScr.y, alvoScr.x, alvoScr.y, cor, 400, 20, true, null, posicao);
    } else if (posicao === 'area') {
      _avtCanvasEfeito('explosao', midX, midY, midX, midY, cor, 600, 60, false, null);
    } else {
      _avtCanvasFlash(fx, fy, cor, gc.preset || 'Impacto');
    }
    return;
  }

  if (['projetil','onda','explosao','raio','aura'].includes(tipo)) {
    const posicao = anim.posicao || 'alvo';
    const cor = anim.cor || '#e74c3c';
    const dur = anim.duracao || 600;
    const repeticoes = anim.repeticao || 1;
    const tamanho = anim.tamanho || 40;
    const trilha = !!anim.trilha;
    const icone = anim.icone || '';

    const midX = Math.round((atacScr.x + alvoScr.x) / 2);
    const midY = Math.round((atacScr.y + alvoScr.y) / 2);

    for (let r = 0; r < repeticoes; r++) {
      setTimeout(() => {
        if (posicao === 'alvo') {
          _avtCanvasEfeito(tipo, alvoScr.x, alvoScr.y, alvoScr.x, alvoScr.y, cor, dur, tamanho, trilha, icone);
        } else if (posicao === 'atacante') {
          _avtCanvasEfeito(tipo, atacScr.x, atacScr.y, atacScr.x, atacScr.y, cor, dur, tamanho, trilha, icone);
        } else if (posicao === 'meio') {
          _avtCanvasEfeito(tipo, midX, midY, midX, midY, cor, dur, tamanho, trilha, icone);
        } else if (posicao === 'trajetoria' || posicao === 'raio' || posicao === 'retorno') {
          _avtCanvasEfeito(tipo, atacScr.x, atacScr.y, alvoScr.x, alvoScr.y, cor, dur, tamanho, trilha, icone, posicao);
        } else if (posicao === 'area') {
          _avtCanvasEfeito('explosao', midX, midY, midX, midY, cor, dur, Math.max(tamanho, 60), trilha, icone);
        } else {
          _avtCanvasEfeito(tipo, alvoScr.x, alvoScr.y, alvoScr.x, alvoScr.y, cor, dur, tamanho, trilha, icone);
        }
      }, r * (dur + 100));
    }
    return;
  }

  if (tipo === 'pixi_particulas' && anim.particle_config) {
    const posicao = anim.posicao || 'alvo';
    _avtPixiParticleAnim(anim.particle_config, atacScr, alvoScr, posicao);
    return;
  }

  if (tipo === 'pixi_spine' && anim.spine_config) {
    const posicao = anim.posicao || anim.spine_config?.posicao || 'alvo';
    const midX = Math.round((atacScr.x + alvoScr.x) / 2);
    const midY = Math.round((atacScr.y + alvoScr.y) / 2);
    const spx = posicao === 'atacante' ? atacScr.x : posicao === 'meio' ? midX : alvoScr.x;
    const spy = posicao === 'atacante' ? atacScr.y : posicao === 'meio' ? midY : alvoScr.y;
    _avtPixiSpineAnim(anim.spine_config, spx, spy);
    return;
  }
}

function _avtCanvasEfeito(tipo, x1, y1, x2, y2, cor, dur, tamanho, trilha, icone, trajetoMode) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const startMs = performance.now();

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick(now) {
    const elapsed = now - startMs;
    const t = Math.min(1, elapsed / dur);

    ctx.save();
    ctx.globalAlpha = 1 - t;

    if (tipo === 'aura') {
      const r = tamanho * (0.5 + t * 0.8);
      ctx.beginPath();
      ctx.arc(x2, y2, r, 0, Math.PI * 2);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 4 * (1 - t);
      ctx.shadowColor = cor;
      ctx.shadowBlur = 20;
      ctx.stroke();
    } else if (tipo === 'explosao') {
      const r = tamanho * (0.2 + t * 1.5);
      ctx.beginPath();
      ctx.arc(x2, y2, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x2, y2, 0, x2, y2, r);
      grad.addColorStop(0, cor + 'ff');
      grad.addColorStop(0.5, cor + '88');
      grad.addColorStop(1, cor + '00');
      ctx.fillStyle = grad;
      ctx.shadowColor = cor;
      ctx.shadowBlur = 30;
      ctx.fill();
    } else if (tipo === 'raio') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      // Zigzag lightning
      const steps = 6;
      const dx = (x2 - x1) / steps, dy = (y2 - y1) / steps;
      for (let i = 1; i < steps; i++) {
        const jitter = (Math.random() - 0.5) * 18 * (1 - t);
        ctx.lineTo(x1 + dx * i + jitter, y1 + dy * i + jitter);
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 3 * (1 - t * 0.5);
      ctx.shadowColor = cor;
      ctx.shadowBlur = 15;
      ctx.stroke();
    } else if (tipo === 'onda') {
      const r = tamanho * (0.3 + t * 1.2);
      for (let ring = 0; ring < 2; ring++) {
        const rr = r * (1 - ring * 0.35);
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(1, rr), 0, Math.PI * 2);
        ctx.strokeStyle = cor;
        ctx.lineWidth = 3 * (1 - t);
        ctx.globalAlpha = (1 - t) * (1 - ring * 0.4);
        ctx.shadowColor = cor;
        ctx.shadowBlur = 12;
        ctx.stroke();
      }
    } else if (tipo === 'projetil') {
      // Projétil animado ao longo da trajetória
      const px = lerp(x1, x2, t);
      const py = trajetoMode === 'trajetoria'
        ? lerp(y1, y2, t) - Math.sin(t * Math.PI) * Math.abs(y2 - y1) * 0.4
        : lerp(y1, y2, t);
      ctx.globalAlpha = 1;
      if (icone) {
        ctx.font = `${tamanho * 0.6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icone, px, py);
      } else {
        ctx.beginPath();
        ctx.arc(px, py, tamanho * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.shadowColor = cor;
        ctx.shadowBlur = 15;
        ctx.fill();
      }
      if (trilha) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(px, py);
        ctx.strokeStyle = cor + '55';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.4 * (1 - t);
        ctx.stroke();
      }
    }

    ctx.restore();

    if (t < 1) requestAnimationFrame(tick);
    else if (tipo === 'projetil' && (trajetoMode === 'retorno')) {
      // Retorno: anima de volta
      _avtCanvasFlash(x1, y1, cor, 'Impacto');
    } else if (tipo === 'projetil') {
      _avtCanvasFlash(x2, y2, cor, 'Impacto');
    }
  }

  requestAnimationFrame(tick);
}

function _avtCanvasFlash(screenX, screenY, cor, tipo) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const SZ = Math.round(AVT_SZ * (AVT_STATE.camera.zoom || 1));

  let frame = 0;
  const FRAMES = 8;
  function draw() {
    if (frame >= FRAMES) return;
    frame++;
    const alpha = 1 - frame / FRAMES;
    const radius = SZ * 0.5 * (1 + frame * 0.15);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();
    requestAnimationFrame(draw);
  }
  draw();
}

function _avtEnsurePixiParticles() {
  if (typeof PIXI === 'undefined') return Promise.reject(new Error('PIXI ausente'));
  if (PIXI.particles && PIXI.particles.Emitter) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@pixi/particle-emitter@5/dist/particle-emitter.min.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Falha ao carregar @pixi/particle-emitter'));
    document.head.appendChild(s);
  });
}

// Lazy-load extra Pixi filter packages (glow, bloom, etc.) so the JSON can reference them.
function _avtEnsurePixiFilter(name) {
  if (typeof PIXI === 'undefined') return Promise.reject(new Error('PIXI ausente'));
  PIXI.filters = PIXI.filters || {};
  const map = {
    glow:        { key: 'GlowFilter',       url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-glow@5/dist/filter-glow.min.js' },
    bloom:       { key: 'AdvancedBloomFilter', url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-advanced-bloom@5/dist/filter-advanced-bloom.min.js' },
    shockwave:   { key: 'ShockwaveFilter',  url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-shockwave@5/dist/filter-shockwave.min.js' },
    godray:      { key: 'GodrayFilter',     url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-godray@5/dist/filter-godray.min.js' },
    rgbsplit:    { key: 'RGBSplitFilter',   url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-rgb-split@5/dist/filter-rgb-split.min.js' },
    outline:     { key: 'OutlineFilter',    url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-outline@5/dist/filter-outline.min.js' },
    crt:         { key: 'CRTFilter',        url: 'https://cdn.jsdelivr.net/npm/@pixi/filter-crt@5/dist/filter-crt.min.js' },
  };
  const spec = map[name];
  if (!spec) return Promise.resolve();
  if (PIXI.filters[spec.key]) return Promise.resolve();
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = spec.url; s.onload = () => res(); s.onerror = () => res();
    document.head.appendChild(s);
  });
}

// Build an array of PIXI.Filter objects from a [{type, ...opts}] spec list.
function _avtBuildPixiFilters(specs) {
  if (!Array.isArray(specs) || !specs.length || typeof PIXI === 'undefined') return [];
  const F = PIXI.filters || {};
  const parseColor = (c) => {
    if (typeof c === 'number') return c;
    if (typeof c === 'string' && c[0] === '#') return parseInt(c.slice(1), 16);
    return 0xffffff;
  };
  const out = [];
  specs.forEach(spec => {
    if (!spec || !spec.type) return;
    try {
      switch (spec.type) {
        case 'blur':       out.push(new PIXI.BlurFilter(spec.strength ?? 4, spec.quality ?? 4)); break;
        case 'noise':      out.push(new PIXI.NoiseFilter(spec.amount ?? 0.2)); break;
        case 'alpha':      out.push(new PIXI.AlphaFilter(spec.alpha ?? 1)); break;
        case 'colormatrix': {
          const cm = new PIXI.ColorMatrixFilter();
          if (spec.preset === 'sepia')      cm.sepia(true);
          else if (spec.preset === 'negative') cm.negative(true);
          else if (spec.preset === 'polaroid') cm.polaroid(true);
          else if (spec.preset === 'night')    cm.night(spec.intensity ?? 0.5);
          else if (spec.preset === 'predator') cm.predator(spec.amount ?? 0.5);
          else if (spec.hue != null)           cm.hue(spec.hue, true);
          else if (spec.brightness != null)    cm.brightness(spec.brightness, true);
          else if (spec.saturate != null)      cm.saturate(spec.saturate, true);
          out.push(cm);
          break;
        }
        case 'glow':
          if (F.GlowFilter) out.push(new F.GlowFilter({
            distance: spec.distance ?? 15,
            outerStrength: spec.outerStrength ?? 2,
            innerStrength: spec.innerStrength ?? 0,
            color: parseColor(spec.color ?? '#ffffff'),
            quality: spec.quality ?? 0.2,
          }));
          break;
        case 'bloom':
          if (F.AdvancedBloomFilter) out.push(new F.AdvancedBloomFilter({
            threshold: spec.threshold ?? 0.5,
            bloomScale: spec.bloomScale ?? 1.5,
            brightness: spec.brightness ?? 1,
            blur: spec.blur ?? 8,
            quality: spec.quality ?? 4,
          }));
          break;
        case 'shockwave':
          if (F.ShockwaveFilter) out.push(new F.ShockwaveFilter([spec.x ?? 0, spec.y ?? 0], {
            amplitude: spec.amplitude ?? 30, wavelength: spec.wavelength ?? 160, speed: spec.speed ?? 500, brightness: spec.brightness ?? 1,
          }));
          break;
        case 'godray':
          if (F.GodrayFilter) out.push(new F.GodrayFilter({
            angle: spec.angle ?? 30, gain: spec.gain ?? 0.5, lacunarity: spec.lacunarity ?? 2.5, parallel: spec.parallel ?? true,
          }));
          break;
        case 'rgbsplit':
          if (F.RGBSplitFilter) out.push(new F.RGBSplitFilter([spec.rx ?? -5, spec.ry ?? 0], [0, 0], [spec.bx ?? 5, spec.by ?? 0]));
          break;
        case 'outline':
          if (F.OutlineFilter) out.push(new F.OutlineFilter(spec.thickness ?? 2, parseColor(spec.color ?? '#ffffff'), spec.quality ?? 0.1));
          break;
        case 'crt':
          if (F.CRTFilter) out.push(new F.CRTFilter({ curvature: spec.curvature ?? 1, lineWidth: spec.lineWidth ?? 1, vignetting: spec.vignetting ?? 0.3, noise: spec.noise ?? 0.2 }));
          break;
      }
    } catch(e) { console.warn('[pixi-filter] erro montando', spec.type, e); }
  });
  return out;
}

// Resolve textures: accepts ["url1","url2"] or omitted (→ white pixel). Returns Promise<PIXI.Texture[]>.
function _avtLoadPixiTextures(urls) {
  if (typeof PIXI === 'undefined') return Promise.resolve([]);
  if (!Array.isArray(urls) || !urls.length) return Promise.resolve([PIXI.Texture.WHITE]);
  return Promise.all(urls.map(u => {
    try { return PIXI.Assets ? PIXI.Assets.load(u).catch(() => PIXI.Texture.WHITE) : PIXI.Texture.from(u); }
    catch(_) { return PIXI.Texture.WHITE; }
  })).then(arr => arr.length ? arr : [PIXI.Texture.WHITE]);
}

function _avtEnsurePixiSpine() {
  if (typeof PIXI === 'undefined') return Promise.reject(new Error('PIXI ausente'));
  if (PIXI.spine && PIXI.spine.Spine) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pixi-spine@4/dist/pixi-spine.umd.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Falha ao carregar pixi-spine'));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC PIXI VFX PIPELINE
//   _avtProcTextures   — procedural textures (spark/glow/smoke/ring/streak/star/ember/noise)
//   AVT_FX_PRESETS     — curated cinematic envelopes
//   _avtFxNormalize    — accept legacy flat/layered cfg + new envelope, merge with preset
//   _avtCameraFX       — shake, hitstop, flash, zoom punch, chromatic aberration
//   _avtPixiParticleAnim — orchestrates the whole scene
// ─────────────────────────────────────────────────────────────────────────────

var _AVT_PROC_TEX_CACHE = {};
function _avtProcTextures(name) {
  if (typeof PIXI === 'undefined') return null;
  if (_AVT_PROC_TEX_CACHE[name]) return _AVT_PROC_TEX_CACHE[name];
  const make = (size, draw) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const tex = PIXI.Texture.from(c);
    _AVT_PROC_TEX_CACHE[name] = tex; return tex;
  };
  switch (name) {
    case 'spark': return make(64, (g,s) => {
      const r = s/2, grd = g.createRadialGradient(r,r,0,r,r,r);
      grd.addColorStop(0,'rgba(255,255,255,1)');
      grd.addColorStop(0.3,'rgba(255,255,255,0.85)');
      grd.addColorStop(0.6,'rgba(255,255,255,0.25)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0,0,s,s);
    });
    case 'glow': return make(128, (g,s) => {
      const r = s/2, grd = g.createRadialGradient(r,r,0,r,r,r);
      grd.addColorStop(0,'rgba(255,255,255,1)');
      grd.addColorStop(0.4,'rgba(255,255,255,0.4)');
      grd.addColorStop(0.75,'rgba(255,255,255,0.08)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0,0,s,s);
    });
    case 'smoke': return make(128, (g,s) => {
      // turbulent puff: many soft blobs
      const r = s/2;
      const base = g.createRadialGradient(r,r,0,r,r,r);
      base.addColorStop(0,'rgba(255,255,255,0.55)');
      base.addColorStop(0.6,'rgba(255,255,255,0.15)');
      base.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = base; g.fillRect(0,0,s,s);
      g.globalCompositeOperation = 'source-over';
      for (let i=0;i<40;i++){
        const x = Math.random()*s, y = Math.random()*s, rr = 8+Math.random()*22;
        const gg = g.createRadialGradient(x,y,0,x,y,rr);
        gg.addColorStop(0,`rgba(255,255,255,${0.05+Math.random()*0.12})`);
        gg.addColorStop(1,'rgba(255,255,255,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x,y,rr,0,Math.PI*2); g.fill();
      }
    });
    case 'ember': return make(48, (g,s) => {
      const r = s/2, grd = g.createRadialGradient(r,r,0,r,r,r*0.55);
      grd.addColorStop(0,'rgba(255,255,255,1)');
      grd.addColorStop(0.6,'rgba(255,200,140,0.7)');
      grd.addColorStop(1,'rgba(255,120,40,0)');
      g.fillStyle = grd; g.fillRect(0,0,s,s);
    });
    case 'ring': return make(128, (g,s) => {
      const r = s/2;
      g.lineWidth = 6;
      const grd = g.createRadialGradient(r,r,r*0.4,r,r,r*0.95);
      grd.addColorStop(0,'rgba(255,255,255,0)');
      grd.addColorStop(0.5,'rgba(255,255,255,1)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0,0,s,s);
    });
    case 'streak': return make(128, (g,s) => {
      const grd = g.createLinearGradient(0,0,s,0);
      grd.addColorStop(0,'rgba(255,255,255,0)');
      grd.addColorStop(0.5,'rgba(255,255,255,1)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0,s/2-3,s,6);
    });
    case 'star': return make(96, (g,s) => {
      const r = s/2;
      const grd = g.createRadialGradient(r,r,0,r,r,r);
      grd.addColorStop(0,'rgba(255,255,255,1)');
      grd.addColorStop(0.5,'rgba(255,255,255,0.2)');
      grd.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0,0,s,s);
      // cross spikes
      const sg = g.createLinearGradient(0,r,s,r);
      sg.addColorStop(0,'rgba(255,255,255,0)');
      sg.addColorStop(0.5,'rgba(255,255,255,1)');
      sg.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = sg; g.fillRect(0,r-1.5,s,3);
      const sg2 = g.createLinearGradient(r,0,r,s);
      sg2.addColorStop(0,'rgba(255,255,255,0)');
      sg2.addColorStop(0.5,'rgba(255,255,255,1)');
      sg2.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = sg2; g.fillRect(r-1.5,0,3,s);
    });
    case 'noise': return make(128, (g,s) => {
      const id = g.createImageData(s,s);
      for (let i=0;i<id.data.length;i+=4){
        const v = (Math.random()*255)|0;
        id.data[i]=id.data[i+1]=id.data[i+2]=v; id.data[i+3]=255;
      }
      g.putImageData(id,0,0);
    });
    case 'rune': return make(64, (g,s) => {
      // glifo runico estilizado: anel fino + tracos angulares
      const r = s/2;
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(r, r, r*0.78, 0, Math.PI*2); g.stroke();
      g.lineWidth = 2;
      // 3 tracos angulares atravessando
      for (let i=0;i<3;i++){
        const a = i * (Math.PI*2/3) + Math.PI/6;
        g.beginPath();
        g.moveTo(r + Math.cos(a)*r*0.35, r + Math.sin(a)*r*0.35);
        g.lineTo(r + Math.cos(a)*r*0.86, r + Math.sin(a)*r*0.86);
        g.stroke();
      }
    });
    case 'arrowhead': return make(64, (g,s) => {
      // ponta de lanca/seta — losango alongado
      g.fillStyle = 'rgba(255,255,255,1)';
      g.beginPath();
      g.moveTo(s*0.5, s*0.05);
      g.lineTo(s*0.78, s*0.5);
      g.lineTo(s*0.5, s*0.95);
      g.lineTo(s*0.22, s*0.5);
      g.closePath(); g.fill();
      // brilho central fino
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(s*0.48, s*0.05, s*0.04, s*0.9);
    });
    case 'blade_slice': return make(96, (g,s) => {
      // arco fino de slash
      const cx = s/2, cy = s, r = s*0.85;
      g.strokeStyle = 'rgba(255,255,255,1)';
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, r, Math.PI*1.1, Math.PI*1.9); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 10;
      g.beginPath(); g.arc(cx, cy, r, Math.PI*1.1, Math.PI*1.9); g.stroke();
    });
    default: return PIXI.Texture.WHITE;
  }
}

// ── Curated presets ─────────────────────────────────────────────────────────
var AVT_FX_PRESETS = {
  // ─── EQUILIBRADO (default) — bloom moderado, shake leve, sem flash full-screen ─
  fire_impact: {
    duration: 900,
    lighting: { bloom:{threshold:0.55,intensity:0.85,quality:5}, tone:'filmic' },
    camera:   { shake:{amp:5,decay:0.92,freq:34}, hitstop:{ms:50,at:0.18} },
    background:{ darken:0.12 },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:10,outerStrength:1.4,color:'#ff8842'},
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.55,time:0},{value:0.05,time:1}],minimumScaleMultiplier:0.7},
                  color:{list:[{value:'ffffff',time:0},{value:'ffb255',time:0.3},{value:'c44a1c',time:1}]},
                  speed:{start:260,end:60,minimumSpeedMultiplier:0.5},
                  acceleration:{x:0,y:-50},
                  startRotation:{min:0,max:360}, rotationSpeed:{min:-180,max:180},
                  lifetime:{min:0.3,max:0.6}, frequency:0.006, emitterLifetime:0.28,
                  maxParticles:90, spawnType:'circle', spawnCircle:{x:0,y:0,r:5} } },
      { role:'sparks', texture:'ember', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.32,time:0},{value:0.06,time:1}]},
                  color:{list:[{value:'fff0c2',time:0},{value:'ff7a1c',time:1}]},
                  speed:{start:340,end:90}, acceleration:{x:0,y:220},
                  lifetime:{min:0.4,max:0.75}, frequency:0.014, emitterLifetime:0.3,
                  maxParticles:28, spawnType:'circle', spawnCircle:{x:0,y:0,r:3} } },
    ],
  },
  ice_shatter: {
    duration: 800,
    lighting: { bloom:{threshold:0.6,intensity:0.7,quality:5}, tone:'filmic' },
    camera:{ shake:{amp:3,decay:0.92,freq:30} },
    background:{ darken:0.08 },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:10,outerStrength:1.3,color:'#9fd9ff'},
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.5,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'7fc8ff',time:1}]},
                  speed:{start:240,end:60}, startRotation:{min:0,max:360},
                  lifetime:{min:0.3,max:0.6}, frequency:0.008, emitterLifetime:0.3,
                  maxParticles:70, spawnType:'circle', spawnCircle:{x:0,y:0,r:6} } },
      { role:'shock', texture:'ring', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:0.7,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.2,time:0},{value:1.8,time:1}]},
                  color:{list:[{value:'e8f6ff',time:0},{value:'4aa8e8',time:1}]},
                  speed:{start:0,end:0}, lifetime:{min:0.45,max:0.5},
                  frequency:0.5, emitterLifetime:0.05, maxParticles:1, spawnType:'point' } },
    ],
  },
  lightning_strike: {
    duration: 650,
    lighting:{ bloom:{threshold:0.5,intensity:1.0,quality:5}, tone:'filmic' },
    camera:{ shake:{amp:7,decay:0.88,freq:42}, hitstop:{ms:40,at:0.1} },
    background:{ darken:0.18 },
    layers: [
      { role:'core', texture:'streak', blendMode:'add', z:3, glow:{distance:12,outerStrength:1.6,color:'#cfe4ff'},
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.5,time:0},{value:0.1,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'9ec8ff',time:1}]},
                  speed:{start:120,end:20},
                  lifetime:{min:0.18,max:0.35}, frequency:0.005, emitterLifetime:0.3,
                  maxParticles:60, spawnType:'circle', spawnCircle:{x:0,y:0,r:3} } },
    ],
  },
  holy_burst: {
    duration: 900,
    lighting:{ bloom:{threshold:0.55,intensity:0.9,quality:5}, tone:'filmic' },
    camera:{ shake:{amp:2,decay:0.95,freq:24} },
    background:{ darken:0.05 },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:14,outerStrength:1.6,color:'#ffe18a'},
        emitter:{ alpha:{list:[{value:0.95,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.35,time:0},{value:0.04,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'ffd47a',time:1}]},
                  speed:{start:160,end:30}, startRotation:{min:0,max:360},
                  lifetime:{min:0.45,max:0.9}, frequency:0.01, emitterLifetime:0.5,
                  maxParticles:90, spawnType:'circle', spawnCircle:{x:0,y:0,r:8} } },
    ],
  },
  dark_implosion: {
    duration: 1000,
    lighting:{ bloom:{threshold:0.65,intensity:0.7,quality:4}, tone:'filmic' },
    camera:{ shake:{amp:4,decay:0.93,freq:30}, hitstop:{ms:60,at:0.55} },
    background:{ darken:0.25 },
    layers: [
      { role:'core', texture:'smoke', blendMode:'multiply', z:2,
        emitter:{ alpha:{list:[{value:0,time:0},{value:0.75,time:0.5},{value:0,time:1}]},
                  scale:{list:[{value:0.2,time:0},{value:1.6,time:1}]},
                  color:{list:[{value:'4a1a6a',time:0},{value:'0a0014',time:1}]},
                  speed:{start:90,end:18}, lifetime:{min:0.7,max:1.0}, frequency:0.014,
                  emitterLifetime:0.5, maxParticles:40, spawnType:'circle', spawnCircle:{x:0,y:0,r:10} } },
      { role:'sparks', texture:'ember', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.35,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'d080ff',time:0},{value:'5010a0',time:1}]},
                  speed:{start:-180,end:-15}, startRotation:{min:0,max:360},
                  lifetime:{min:0.5,max:0.85}, frequency:0.008, emitterLifetime:0.5,
                  maxParticles:55, spawnType:'circle', spawnCircle:{x:0,y:0,r:60} } },
    ],
  },

  // ─── NOVOS PRESETS SUTIS — para magia "designer", precisa e sem clarao ─────
  arcane_lance: {
    // Para usar num bloco `cast` ou `impact` — projetil deve usar `body` separado
    duration: 600,
    lighting: { bloom:{threshold:0.7,intensity:0.5,quality:4}, tone:'filmic' },
    camera:   { shake:{amp:2,decay:0.95,freq:28} },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:6,outerStrength:1.0,color:'#a978ff'},
        emitter:{ alpha:{list:[{value:0.8,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.25,time:0},{value:0.04,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'a978ff',time:0.4},{value:'5a30c8',time:1}]},
                  speed:{start:90,end:20}, startRotation:{min:0,max:360},
                  lifetime:{min:0.25,max:0.45}, frequency:0.015, emitterLifetime:0.3,
                  maxParticles:25, spawnType:'circle', spawnCircle:{x:0,y:0,r:4} } },
    ],
  },
  silent_dart: {
    duration: 350,
    lighting: { tone:'none' },
    camera:   {},
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3,
        emitter:{ alpha:{list:[{value:0.6,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.15,time:0},{value:0.02,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'cfd8e8',time:1}]},
                  speed:{start:40,end:5},
                  lifetime:{min:0.15,max:0.25}, frequency:0.02, emitterLifetime:0.2,
                  maxParticles:10, spawnType:'point' } },
    ],
  },
  whisper_bolt: {
    duration: 500,
    lighting: { bloom:{threshold:0.7,intensity:0.4,quality:3}, tone:'filmic' },
    camera:   {},
    layers: [
      { role:'core', texture:'streak', blendMode:'add', z:3,
        emitter:{ alpha:{list:[{value:0.7,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.25,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'9ec8ff',time:1}]},
                  speed:{start:60,end:10},
                  lifetime:{min:0.18,max:0.3}, frequency:0.012, emitterLifetime:0.3,
                  maxParticles:18, spawnType:'point' } },
    ],
  },
  precise_strike: {
    duration: 450,
    lighting: { bloom:{threshold:0.65,intensity:0.6,quality:4}, tone:'filmic' },
    camera:   { shake:{amp:3,decay:0.9,freq:36}, hitstop:{ms:35,at:0.15} },
    layers: [
      { role:'core', texture:'blade_slice', blendMode:'add', z:3,
        emitter:{ alpha:{list:[{value:0.95,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.4,time:0},{value:0.9,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'ffe9b8',time:1}]},
                  speed:{start:0,end:0}, lifetime:{min:0.2,max:0.25},
                  frequency:0.5, emitterLifetime:0.05, maxParticles:1, spawnType:'point' } },
      { role:'sparks', texture:'ember', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.18,time:0},{value:0.03,time:1}]},
                  color:{list:[{value:'fff0c2',time:0},{value:'ffa040',time:1}]},
                  speed:{start:200,end:30}, acceleration:{x:0,y:180},
                  lifetime:{min:0.2,max:0.4}, frequency:0.012, emitterLifetime:0.15,
                  maxParticles:16, spawnType:'circle', spawnCircle:{x:0,y:0,r:2} } },
    ],
  },
  gentle_heal: {
    duration: 1000,
    lighting: { bloom:{threshold:0.7,intensity:0.5,quality:4}, tone:'filmic' },
    camera:   {},
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:6,outerStrength:0.9,color:'#a0ffb8'},
        emitter:{ alpha:{list:[{value:0,time:0},{value:0.7,time:0.3},{value:0,time:1}]},
                  scale:{list:[{value:0.12,time:0},{value:0.3,time:0.5},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'a0ffb8',time:1}]},
                  speed:{start:30,end:5}, acceleration:{x:0,y:-40},
                  lifetime:{min:0.7,max:1.1}, frequency:0.04, emitterLifetime:0.7,
                  maxParticles:20, spawnType:'circle', spawnCircle:{x:0,y:0,r:14} } },
    ],
  },

  micro_sparks: {
    duration: 350,
    layers: [{ role:'sparks', texture:'spark', blendMode:'add', z:5,
      emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                scale:{list:[{value:0.22,time:0},{value:0.02,time:1}]},
                color:{list:[{value:'ffffff',time:0},{value:'ff9040',time:1}]},
                speed:{start:180,end:25}, acceleration:{x:0,y:280},
                lifetime:{min:0.22,max:0.4}, frequency:0.01, emitterLifetime:0.08,
                maxParticles:12, spawnType:'circle', spawnCircle:{x:0,y:0,r:2} }}]
  },

  // ─── CINEMATOGRAFICO / CATACLISMO — valores antigos, acessados via `intensidade` ─
  fire_impact_epic: {
    duration: 1300,
    lighting: { bloom:{threshold:0.3,intensity:1.6,quality:6}, tone:'filmic' },
    camera:   { shake:{amp:14,decay:0.9,freq:36}, hitstop:{ms:90,at:0.18},
                flash:{color:'#ffd28a',alpha:0.55,ms:120}, zoomPunch:{scale:1.045,ms:240},
                chromaticAberration:{amount:7,ms:200} },
    background:{ darken:0.35, radialDim:true },
    layers: [
      { role:'flash', texture:'glow', blendMode:'add', z:1, tint:'#fff1c2',
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:3.2,time:0},{value:5,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'ffa040',time:1}]},
                  speed:{start:0,end:0}, lifetime:{min:0.18,max:0.25}, frequency:0.4,
                  emitterLifetime:0.06, maxParticles:3, spawnType:'point' } },
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:14,outerStrength:2.2,color:'#ff8842'},
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.9,time:0},{value:0.05,time:1}],minimumScaleMultiplier:0.7},
                  color:{list:[{value:'ffffff',time:0},{value:'ffb255',time:0.3},{value:'c44a1c',time:1}]},
                  speed:{start:380,end:80,minimumSpeedMultiplier:0.5},
                  acceleration:{x:0,y:-60},
                  startRotation:{min:0,max:360}, rotationSpeed:{min:-180,max:180},
                  lifetime:{min:0.35,max:0.75}, frequency:0.004, emitterLifetime:0.35,
                  maxParticles:220, spawnType:'circle', spawnCircle:{x:0,y:0,r:6} } },
      { role:'sparks', texture:'ember', blendMode:'add', z:4, trail:{length:8,fade:0.85},
        subEmitters:[{ on:'death', preset:'micro_sparks', chance:0.25 }],
        emitter:{ alpha:{list:[{value:1,time:0},{value:0.8,time:0.6},{value:0,time:1}]},
                  scale:{list:[{value:0.45,time:0},{value:0.08,time:1}]},
                  color:{list:[{value:'fff0c2',time:0},{value:'ff7a1c',time:1}]},
                  speed:{start:520,end:120}, acceleration:{x:0,y:260},
                  lifetime:{min:0.55,max:1.0}, frequency:0.008, emitterLifetime:0.45,
                  maxParticles:60, spawnType:'circle', spawnCircle:{x:0,y:0,r:4} } },
      { role:'smoke', texture:'smoke', blendMode:'normal', z:2,
        emitter:{ alpha:{list:[{value:0,time:0},{value:0.55,time:0.2},{value:0,time:1}]},
                  scale:{list:[{value:0.5,time:0},{value:2.2,time:1}]},
                  color:{list:[{value:'5a3a26',time:0},{value:'201510',time:1}]},
                  speed:{start:90,end:30}, acceleration:{x:0,y:-30},
                  lifetime:{min:0.9,max:1.5}, frequency:0.02, emitterLifetime:0.5,
                  maxParticles:30, spawnType:'circle', spawnCircle:{x:0,y:0,r:10} } },
      { role:'shock', texture:'ring', blendMode:'add', z:5,
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.2,time:0},{value:3.5,time:1}]},
                  color:{list:[{value:'ffe2a8',time:0},{value:'ff6020',time:1}]},
                  speed:{start:0,end:0}, lifetime:{min:0.45,max:0.55},
                  frequency:0.5, emitterLifetime:0.05, maxParticles:1, spawnType:'point' } },
    ],
  },
  ice_shatter_epic: {
    duration: 1100,
    lighting: { bloom:{threshold:0.4,intensity:1.2,quality:5}, tone:'filmic' },
    camera:{ shake:{amp:8,decay:0.9,freq:30}, flash:{color:'#cfe8ff',alpha:0.4,ms:100}, hitstop:{ms:60,at:0.2} },
    background:{ darken:0.2 },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:14,outerStrength:2,color:'#9fd9ff'},
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.7,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'7fc8ff',time:1}]},
                  speed:{start:340,end:80}, startRotation:{min:0,max:360},
                  lifetime:{min:0.35,max:0.8}, frequency:0.005, emitterLifetime:0.4,
                  maxParticles:160, spawnType:'circle', spawnCircle:{x:0,y:0,r:8} } },
      { role:'shock', texture:'ring', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:0.9,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.2,time:0},{value:2.8,time:1}]},
                  color:{list:[{value:'e8f6ff',time:0},{value:'4aa8e8',time:1}]},
                  speed:{start:0,end:0}, lifetime:{min:0.5,max:0.55},
                  frequency:0.5, emitterLifetime:0.05, maxParticles:1, spawnType:'point' } },
    ],
  },
  lightning_strike_epic: {
    duration: 900,
    lighting:{ bloom:{threshold:0.25,intensity:2,quality:6}, tone:'filmic' },
    camera:{ shake:{amp:18,decay:0.85,freq:50}, flash:{color:'#e4f1ff',alpha:0.8,ms:80},
             hitstop:{ms:70,at:0.1}, chromaticAberration:{amount:10,ms:160}, zoomPunch:{scale:1.06,ms:200} },
    background:{ darken:0.5, radialDim:true },
    layers: [
      { role:'core', texture:'streak', blendMode:'add', z:3, glow:{distance:18,outerStrength:2.5,color:'#ffe18a'},
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.5,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'ffd47a',time:1}]},
                  speed:{start:240,end:30}, startRotation:{min:0,max:360},
                  lifetime:{min:0.6,max:1.2}, frequency:0.006, emitterLifetime:0.6,
                  maxParticles:200, spawnType:'circle', spawnCircle:{x:0,y:0,r:10} } },
    ],
  },
  dark_implosion_epic: {
    duration: 1300,
    lighting:{ bloom:{threshold:0.5,intensity:1.4,quality:5}, tone:'filmic' },
    camera:{ shake:{amp:10,decay:0.92,freq:34}, hitstop:{ms:120,at:0.55},
             flash:{color:'#1a0030',alpha:0.45,ms:200}, chromaticAberration:{amount:8,ms:300} },
    background:{ darken:0.55, radialDim:true },
    layers: [
      { role:'core', texture:'smoke', blendMode:'multiply', z:2,
        emitter:{ alpha:{list:[{value:0,time:0},{value:0.85,time:0.5},{value:0,time:1}]},
                  scale:{list:[{value:0.2,time:0},{value:2.2,time:1}]},
                  color:{list:[{value:'4a1a6a',time:0},{value:'0a0014',time:1}]},
                  speed:{start:120,end:20}, lifetime:{min:0.8,max:1.2}, frequency:0.01,
                  emitterLifetime:0.6, maxParticles:60, spawnType:'circle', spawnCircle:{x:0,y:0,r:14} } },
      { role:'sparks', texture:'ember', blendMode:'add', z:4,
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.45,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'d080ff',time:0},{value:'5010a0',time:1}]},
                  speed:{start:-260,end:-20}, startRotation:{min:0,max:360},
                  lifetime:{min:0.6,max:1}, frequency:0.005, emitterLifetime:0.6,
                  maxParticles:120, spawnType:'circle', spawnCircle:{x:0,y:0,r:80} } },
    ],
  },
  holy_burst_epic: {
    duration: 1100,
    lighting:{ bloom:{threshold:0.4,intensity:1.6,quality:6}, tone:'filmic' },
    camera:{ shake:{amp:6,decay:0.95,freq:28}, flash:{color:'#fff6c8',alpha:0.6,ms:140} },
    background:{ darken:0.2 },
    layers: [
      { role:'core', texture:'spark', blendMode:'add', z:3, glow:{distance:18,outerStrength:2.5,color:'#ffe18a'},
        emitter:{ alpha:{list:[{value:1,time:0},{value:0,time:1}]},
                  scale:{list:[{value:0.5,time:0},{value:0.05,time:1}]},
                  color:{list:[{value:'ffffff',time:0},{value:'ffd47a',time:1}]},
                  speed:{start:240,end:30}, startRotation:{min:0,max:360},
                  lifetime:{min:0.6,max:1.2}, frequency:0.006, emitterLifetime:0.6,
                  maxParticles:200, spawnType:'circle', spawnCircle:{x:0,y:0,r:10} } },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLICADOR DE INTENSIDADE — controla "exagero" do efeito todo.
// 'sutil'         — zera bloom global, proibe flash/zoomPunch/chromatic, shake 0.4x
// 'equilibrado'   — default; presets ja sao equilibrados, multiplicadores = 1
// 'cinematografico' — escolhe preset _epic se existir
// 'cataclismo'    — escolhe preset _epic + amplifica camera/bloom 1.25x
// ─────────────────────────────────────────────────────────────────────────────
function _avtIntensityProfile(level) {
  level = (level || 'equilibrado').toLowerCase();
  if (level === 'sutil') {
    return {
      level, presetSuffix: '',
      bloomMul: 0, shakeMul: 0.4, flashMul: 0, hitstopMul: 0.4, zoomPunchMul: 0, chromaticMul: 0,
      maxLayers: 2, particleMul: 0.7,
    };
  }
  if (level === 'cinematografico') {
    return { level, presetSuffix:'_epic',
      bloomMul:1, shakeMul:1, flashMul:1, hitstopMul:1, zoomPunchMul:1, chromaticMul:1,
      maxLayers: 8, particleMul: 1 };
  }
  if (level === 'cataclismo') {
    return { level, presetSuffix:'_epic',
      bloomMul:1.25, shakeMul:1.25, flashMul:1.2, hitstopMul:1.1, zoomPunchMul:1.2, chromaticMul:1.3,
      maxLayers: 12, particleMul: 1.15 };
  }
  // equilibrado
  return { level:'equilibrado', presetSuffix:'',
    bloomMul:1, shakeMul:1, flashMul:1, hitstopMul:1, zoomPunchMul:1, chromaticMul:1,
    maxLayers: 5, particleMul: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY RENDERER — desenha "corpo" de projetil/orbe com primitivas combinaveis.
// bodyCfg: {
//   parts: [
//     {kind:'shaft',  length:60, width:5, color:'#dfe8ff', outline:'#101830'},
//     {kind:'head',   length:18, width:10, color:'#9ec8ff', glow:{color:'#5a85ff',distance:8,outerStrength:2}},
//     {kind:'rune_ring', radius:18, color:'#a978ff', symbols:3, spin:120},
//     {kind:'orb',    radius:8, color:'#a978ff', glow:{...}},
//   ],
//   scale: 1, rotate:'velocity'|0..360,
//   sprite: { url, scale, tint, glow } // alternativa: sprite direto
//   modo: 'vetor' | 'sprite'
// }
// Retorna PIXI.Container ja preparado.
// ─────────────────────────────────────────────────────────────────────────────
function _avtBuildBody(bodyCfg, defaultColor) {
  if (typeof PIXI === 'undefined' || !bodyCfg) return null;
  const c = new PIXI.Container();
  c.__bodyMeta = { rotate: bodyCfg.rotate || 'velocity', scale: bodyCfg.scale || 1, spin: [] };

  // Modo sprite: imagem direta
  if (bodyCfg.sprite && bodyCfg.sprite.url) {
    try {
      const tex = PIXI.Texture.from(bodyCfg.sprite.url);
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      if (bodyCfg.sprite.tint) s.tint = _avtHexToInt(bodyCfg.sprite.tint);
      s.scale.set(bodyCfg.sprite.scale || 1);
      if (bodyCfg.sprite.glow && PIXI.filters && PIXI.filters.GlowFilter) {
        s.filters = [new PIXI.filters.GlowFilter({
          distance: bodyCfg.sprite.glow.distance ?? 10,
          outerStrength: bodyCfg.sprite.glow.outerStrength ?? 1.5,
          color: _avtHexToInt(bodyCfg.sprite.glow.color || '#ffffff'),
          quality: 0.3,
        })];
      }
      c.addChild(s);
    } catch(e) { console.warn('[body] sprite falhou', e); }
  }

  const col = (hex, fb) => _avtHexToInt(hex || fb || defaultColor || '#ffffff');
  const parts = Array.isArray(bodyCfg.parts) ? bodyCfg.parts : [];

  parts.forEach(p => {
    const g = new PIXI.Graphics();
    const C = col(p.color);
    const O = p.outline ? _avtHexToInt(p.outline) : null;

    switch ((p.kind || '').toLowerCase()) {
      case 'shaft': {
        // haste retangular alongada no eixo X (frente = +X)
        const L = p.length ?? 60, W = p.width ?? 4;
        if (O != null) { g.lineStyle(1.2, O, 1); }
        g.beginFill(C, p.alpha ?? 1);
        g.drawRoundedRect(-L * 0.5, -W * 0.5, L, W, W * 0.4);
        g.endFill();
        break;
      }
      case 'head': {
        // ponta de losango para frente
        const L = p.length ?? 18, W = p.width ?? 10;
        if (O != null) g.lineStyle(1.2, O, 1);
        g.beginFill(C, p.alpha ?? 1);
        g.moveTo(L, 0);
        g.lineTo(0, -W * 0.5);
        g.lineTo(-L * 0.2, 0);
        g.lineTo(0, W * 0.5);
        g.closePath();
        g.endFill();
        break;
      }
      case 'blade': {
        // lamina curva (espada)
        const L = p.length ?? 70, W = p.width ?? 14;
        if (O != null) g.lineStyle(1.4, O, 1);
        g.beginFill(C, p.alpha ?? 1);
        g.moveTo(-L * 0.5, 0);
        g.bezierCurveTo(-L * 0.2, -W * 0.6, L * 0.2, -W * 0.4, L * 0.5, 0);
        g.bezierCurveTo(L * 0.2,  W * 0.1, -L * 0.2, W * 0.2, -L * 0.5, 0);
        g.endFill();
        break;
      }
      case 'orb': {
        const r = p.radius ?? 10;
        if (O != null) g.lineStyle(1, O, 1);
        g.beginFill(C, p.alpha ?? 0.95);
        g.drawCircle(0, 0, r);
        g.endFill();
        // brilho interno
        g.beginFill(0xffffff, 0.35);
        g.drawCircle(-r * 0.3, -r * 0.3, r * 0.35);
        g.endFill();
        break;
      }
      case 'disc': {
        const r = p.radius ?? 14;
        if (O != null) g.lineStyle(1, O, 1);
        g.beginFill(C, p.alpha ?? 0.85);
        g.drawCircle(0, 0, r);
        g.endFill();
        break;
      }
      case 'crescent': {
        const r = p.radius ?? 18;
        g.beginFill(C, p.alpha ?? 0.9);
        g.drawCircle(0, 0, r);
        g.endFill();
        // recorte
        g.beginHole();
        g.drawCircle(r * 0.5, 0, r * 0.85);
        g.endHole();
        break;
      }
      case 'rune_ring': {
        // anel runico fino + N simbolos orbitando
        const r = p.radius ?? 20;
        const n = p.symbols ?? 3;
        g.lineStyle(p.lineWidth ?? 1.2, C, p.alpha ?? 0.85);
        g.drawCircle(0, 0, r);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          g.beginFill(C, 1);
          g.drawCircle(x, y, p.symbolSize ?? 1.8);
          g.endFill();
        }
        if (p.spin) c.__bodyMeta.spin.push({ obj: g, speed: p.spin });
        break;
      }
      case 'glyph': {
        const r = p.radius ?? 12;
        g.lineStyle(1.4, C, p.alpha ?? 0.9);
        g.moveTo(0, -r); g.lineTo(r * 0.86, r * 0.5); g.lineTo(-r * 0.86, r * 0.5); g.closePath();
        g.drawCircle(0, 0, r * 0.45);
        if (p.spin) c.__bodyMeta.spin.push({ obj: g, speed: p.spin });
        break;
      }
      default: break;
    }

    if (p.glow && PIXI.filters && PIXI.filters.GlowFilter) {
      g.filters = [new PIXI.filters.GlowFilter({
        distance: p.glow.distance ?? 8,
        outerStrength: p.glow.outerStrength ?? 1.4,
        color: _avtHexToInt(p.glow.color || p.color || defaultColor || '#ffffff'),
        quality: 0.3,
      })];
    }
    if (p.offset) g.position.set(p.offset.x || 0, p.offset.y || 0);
    c.addChild(g);
  });

  c.scale.set(bodyCfg.scale || 1);
  return c;
}

// Atualiza rotacao do body em direcao a velocidade e aplica spin de partes
function _avtUpdateBody(body, vx, vy, dt) {
  if (!body || !body.__bodyMeta) return;
  const meta = body.__bodyMeta;
  if (meta.rotate === 'velocity') {
    if (vx*vx + vy*vy > 0.001) body.rotation = Math.atan2(vy, vx);
  } else if (typeof meta.rotate === 'number') {
    body.rotation = meta.rotate * Math.PI / 180;
  }
  for (const s of meta.spin) {
    s.obj.rotation += (s.speed * Math.PI / 180) * (dt / 1000);
  }
}

// Deep merge for envelope + preset
function _avtFxDeepMerge(base, over) {
  if (over == null) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over; // arrays replace
  if (typeof base !== 'object' || typeof over !== 'object') return over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) out[k] = _avtFxDeepMerge(base[k], over[k]);
  return out;
}

// Normalize any incoming config into the canonical cinematic envelope.
function _avtFxNormalize(cfg) {
  cfg = cfg || {};
  // Intensidade: 'sutil'|'equilibrado'|'cinematografico'|'cataclismo'. Default equilibrado.
  const intensProfile = _avtIntensityProfile(cfg.intensidade);
  // Preset merge — se intensidade pedir _epic e existir, usa essa variante
  let chosenPreset = cfg.preset;
  if (chosenPreset && intensProfile.presetSuffix) {
    const upgraded = chosenPreset + intensProfile.presetSuffix;
    if (AVT_FX_PRESETS[upgraded]) chosenPreset = upgraded;
  }
  let base = {};
  if (chosenPreset && AVT_FX_PRESETS[chosenPreset]) {
    base = JSON.parse(JSON.stringify(AVT_FX_PRESETS[chosenPreset]));
  }
  const merged = _avtFxDeepMerge(base, cfg);
  merged._intensProfile = intensProfile;
  // Legacy: if no layers AND looks like a flat emitter, wrap it.
  if (!Array.isArray(merged.layers) || !merged.layers.length) {
    const flatKeys = ['alpha','scale','color','speed','lifetime','frequency','maxParticles',
      'acceleration','startRotation','rotationSpeed','spawnType','spawnCircle','spawnRect',
      'emitterLifetime','particlesPerWave','spawnChance','behaviors'];
    const looksFlat = flatKeys.some(k => merged[k] != null);
    if (looksFlat) {
      const emit = {};
      flatKeys.forEach(k => { if (merged[k] != null) { emit[k] = merged[k]; delete merged[k]; } });
      merged.layers = [{
        role:'core',
        textures: merged.textures, blendMode: merged.blendMode || 'add',
        filters: merged.filters, offset: merged.offset, beamSegments: merged.beamSegments,
        emitter: emit,
      }];
    } else {
      merged.layers = [];
    }
  }
  // Normalize each layer: legacy emitter fields could be at layer root
  merged.layers = merged.layers.map(l => {
    if (l.emitter) return l;
    const cp = Object.assign({}, l);
    ['role','texture','textures','blendMode','filters','offset','beamSegments','z',
     'trail','lightCast','subEmitters','glow','tint','parallax'].forEach(k => delete cp[k]);
    return Object.assign({}, l, { emitter: cp });
  });
  // Aplicar limite de camadas conforme intensidade (mantém as de menor z primeiro — base + core)
  if (merged.layers.length > intensProfile.maxLayers) {
    merged.layers = merged.layers
      .slice().sort((a,b)=>(a.z||0)-(b.z||0))
      .slice(0, intensProfile.maxLayers);
  }
  // Sutil zera bloom global
  if (intensProfile.bloomMul === 0 && merged.lighting && merged.lighting.bloom) {
    delete merged.lighting.bloom;
  } else if (intensProfile.bloomMul !== 1 && merged.lighting && merged.lighting.bloom) {
    merged.lighting.bloom.intensity = (merged.lighting.bloom.intensity || 1) * intensProfile.bloomMul;
  }
  return merged;
}

// Resolve a texture spec: preset name | URL | array. Always returns Promise<Texture[]>.
function _avtFxResolveTextures(spec) {
  if (typeof PIXI === 'undefined') return Promise.resolve([]);
  if (!spec) return Promise.resolve([PIXI.Texture.WHITE]);
  const arr = Array.isArray(spec) ? spec : [spec];
  return Promise.all(arr.map(s => {
    if (typeof s !== 'string') return PIXI.Texture.WHITE;
    if (/^(https?:|data:|blob:|\/)/.test(s)) {
      try { return PIXI.Assets ? PIXI.Assets.load(s).catch(() => PIXI.Texture.WHITE) : PIXI.Texture.from(s); }
      catch(_) { return PIXI.Texture.WHITE; }
    }
    const t = _avtProcTextures(s);
    return t || PIXI.Texture.WHITE;
  })).then(a => a.length ? a : [PIXI.Texture.WHITE]);
}

// ── Camera FX controller ─────────────────────────────────────────────────────
function _avtCameraFX(app, worldRoot, uiRoot, camCfg, totalDuration, intensProfile) {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IP = intensProfile || _avtIntensityProfile('equilibrado');
  const Craw = camCfg || {};
  // Aplica multiplicadores e remove campos zerados
  const C = {};
  if (Craw.shake && IP.shakeMul > 0) C.shake = Object.assign({}, Craw.shake, { amp: (Craw.shake.amp || 0) * IP.shakeMul });
  if (Craw.flash && IP.flashMul > 0) C.flash = Object.assign({}, Craw.flash, { alpha: (Craw.flash.alpha || 0) * IP.flashMul });
  if (Craw.hitstop && IP.hitstopMul > 0) C.hitstop = Object.assign({}, Craw.hitstop, { ms: (Craw.hitstop.ms || 0) * IP.hitstopMul });
  if (Craw.zoomPunch && IP.zoomPunchMul > 0) C.zoomPunch = Object.assign({}, Craw.zoomPunch, { scale: 1 + ((Craw.zoomPunch.scale || 1) - 1) * IP.zoomPunchMul });
  if (Craw.chromaticAberration && IP.chromaticMul > 0) C.chromaticAberration = Object.assign({}, Craw.chromaticAberration, { amount: (Craw.chromaticAberration.amount || 0) * IP.chromaticMul });
  const W = app.renderer.width, H = app.renderer.height;
  const baseX = worldRoot.position.x, baseY = worldRoot.position.y;
  const baseScale = worldRoot.scale.x;

  // Flash
  let flashSpr = null;
  if (C.flash) {
    flashSpr = new PIXI.Sprite(PIXI.Texture.WHITE);
    flashSpr.width = W; flashSpr.height = H;
    flashSpr.tint = _avtHexToInt(C.flash.color || '#ffffff');
    flashSpr.alpha = 0;
    flashSpr.blendMode = PIXI.BLEND_MODES.ADD;
    uiRoot.addChild(flashSpr);
  }

  // RGB split filter (chromatic aberration)
  let rgb = null;
  if (C.chromaticAberration && !reducedMotion && PIXI.filters && PIXI.filters.RGBSplitFilter) {
    rgb = new PIXI.filters.RGBSplitFilter([0,0],[0,0],[0,0]);
    uiRoot.filters = (uiRoot.filters || []).concat(rgb);
  }

  // Hitstop
  if (C.hitstop && !reducedMotion) {
    const at = (C.hitstop.at != null ? C.hitstop.at : 0.2) * totalDuration;
    setTimeout(() => {
      AVT_STATE._fxFreezeUntil = performance.now() + (C.hitstop.ms || 80);
    }, at);
  }

  const start = performance.now();
  let shakeSeed = Math.random()*1000;

  const tick = () => {
    const t = performance.now() - start;
    const k = Math.min(1, t / totalDuration);

    // Shake
    if (C.shake && !reducedMotion) {
      const amp = (C.shake.amp || 10) * Math.pow(C.shake.decay || 0.9, t/16);
      const freq = (C.shake.freq || 30) / 1000;
      worldRoot.position.set(
        baseX + Math.sin(t*freq + shakeSeed)*amp,
        baseY + Math.cos(t*freq*1.13 + shakeSeed)*amp
      );
    }

    // Zoom punch (easeOutBack -> back to 1)
    if (C.zoomPunch && !reducedMotion) {
      const dur = C.zoomPunch.ms || 220;
      const tt = Math.min(1, t/dur);
      // 0→peak at 0.4, then back to 1
      const peak = (C.zoomPunch.scale || 1.04);
      let s;
      if (tt < 0.4) s = 1 + (peak-1) * (tt/0.4);
      else s = peak - (peak-1) * ((tt-0.4)/0.6);
      worldRoot.scale.set(baseScale * s);
    }

    // Flash fade
    if (flashSpr) {
      const dur = C.flash.ms || 120;
      const a = Math.max(0, (C.flash.alpha || 0.5) * (1 - t/dur));
      flashSpr.alpha = a;
    }

    // Chromatic aberration fade
    if (rgb) {
      const dur = C.chromaticAberration.ms || 180;
      const amt = (C.chromaticAberration.amount || 6) * Math.max(0, 1 - t/dur);
      rgb.red = [-amt, 0]; rgb.blue = [amt, 0]; rgb.green = [0, 0];
    }
  };
  app.ticker.add(tick);
  return () => {
    try { app.ticker.remove(tick); } catch(_) {}
    worldRoot.position.set(baseX, baseY);
    worldRoot.scale.set(baseScale);
    AVT_STATE._fxFreezeUntil = 0;
  };
}

function _avtHexToInt(h) {
  if (typeof h !== 'string') return 0xffffff;
  h = h.replace('#','');
  if (h.length === 3) h = h.split('').map(c => c+c).join('');
  return parseInt(h, 16) || 0xffffff;
}

// ── Main entry point ─────────────────────────────────────────────────────────
function _avtPixiParticleAnim(particleConfig, atacScr, alvoScr, posicao) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  if (typeof atacScr === 'number') {
    const x = atacScr, y = alvoScr;
    atacScr = { x, y }; alvoScr = { x, y }; posicao = posicao || 'alvo';
  }
  posicao = posicao || 'alvo';
  if (!alvoScr) alvoScr = atacScr;
  // ── Novo envelope com fases (cast → travel → impact) ──────────────────────
  if (particleConfig && (particleConfig.phases || particleConfig.cast || particleConfig.travel || particleConfig.impact)) {
    return _avtPlayPhases(particleConfig, atacScr, alvoScr, posicao);
  }
  const midX = Math.round((atacScr.x + alvoScr.x) / 2);
  const midY = Math.round((atacScr.y + alvoScr.y) / 2);

  let startX, startY, endX, endY, mode;
  if (posicao === 'atacante') { startX = endX = atacScr.x; startY = endY = atacScr.y; mode = 'static'; }
  else if (posicao === 'meio' || posicao === 'area') { startX = endX = midX; startY = endY = midY; mode = posicao === 'area' ? 'area' : 'static'; }
  else if (posicao === 'trajetoria') { startX = atacScr.x; startY = atacScr.y; endX = alvoScr.x; endY = alvoScr.y; mode = 'travel'; }
  else if (posicao === 'raio')       { startX = atacScr.x; startY = atacScr.y; endX = alvoScr.x; endY = alvoScr.y; mode = 'beam'; }
  else if (posicao === 'retorno')    { startX = atacScr.x; startY = atacScr.y; endX = alvoScr.x; endY = alvoScr.y; mode = 'boomerang'; }
  else { startX = endX = alvoScr.x; startY = endY = alvoScr.y; mode = 'static'; }

  if (typeof PIXI === 'undefined') { _avtCanvasFlash(endX, endY, '#e74c3c', 'Impacto'); return; }

  // Normalize config (legacy compat + preset merge)
  const root = _avtFxNormalize(particleConfig);
  const layers = root.layers || [];
  if (!layers.length) { _avtCanvasFlash(endX, endY, '#e74c3c', 'Impacto'); return; }

  // Collect filter types to lazy-load
  const allFilterTypes = new Set();
  const collectFilters = obj => { if (Array.isArray(obj && obj.filters)) obj.filters.forEach(f => f && f.type && allFilterTypes.add(f.type)); };
  collectFilters(root); layers.forEach(collectFilters);
  if (root.lighting && root.lighting.bloom)   allFilterTypes.add('bloom');
  if (root.lighting && root.lighting.glow)    allFilterTypes.add('glow');
  if (root.camera   && root.camera.chromaticAberration) allFilterTypes.add('rgbsplit');
  layers.forEach(l => { if (l.glow) allFilterTypes.add('glow'); });

  const BLEND = {
    add: PIXI.BLEND_MODES.ADD, screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY,
    normal: PIXI.BLEND_MODES.NORMAL, overlay: PIXI.BLEND_MODES.OVERLAY ?? PIXI.BLEND_MODES.NORMAL,
  };

  Promise.all([
    _avtEnsurePixiParticles(),
    ...[...allFilterTypes].map(t => _avtEnsurePixiFilter(t)),
  ]).then(() => {
    // Remove any existing overlay
    const existing = document.getElementById('avt-pixi-particle-overlay');
    if (existing) existing.remove();

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'avt-pixi-particle-overlay';
    overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
    overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:100`;
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(overlayCanvas);

    let app;
    try {
      app = new PIXI.Application({ view: overlayCanvas, backgroundAlpha: 0, antialias: true,
        width: canvas.width, height: canvas.height, powerPreference:'high-performance' });

      // ── Stage tree ────────────────────────────────────────────────────────
      const worldRoot = new PIXI.Container();
      const uiRoot    = new PIXI.Container();
      app.stage.addChild(worldRoot);
      app.stage.addChild(uiRoot);

      // Background dim (vignette)
      if (root.background && (root.background.darken || root.background.radialDim)) {
        const dim = new PIXI.Graphics();
        const a = root.background.darken || 0.3;
        dim.beginFill(0x000000, a).drawRect(0,0,app.renderer.width, app.renderer.height).endFill();
        if (root.background.radialDim) dim.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        worldRoot.addChild(dim);
      }

      // Global filters: bloom + tone + user-defined
      const worldFilters = [];
      if (root.lighting && root.lighting.bloom && PIXI.filters.AdvancedBloomFilter) {
        const b = root.lighting.bloom;
        worldFilters.push(new PIXI.filters.AdvancedBloomFilter({
          threshold: b.threshold ?? 0.4, bloomScale: b.intensity ?? 1.5,
          brightness: 1.0, blur: 8, quality: b.quality ?? 6,
        }));
      }
      if (root.lighting && root.lighting.tone && root.lighting.tone !== 'none') {
        const cm = new PIXI.ColorMatrixFilter();
        if (root.lighting.tone === 'filmic') { cm.contrast(0.15, true); cm.saturate(0.12, true); cm.brightness(1.04, true); }
        else if (root.lighting.tone === 'aces') { cm.contrast(0.22, true); cm.saturate(0.18, true); cm.brightness(1.06, true); cm.hue(-4, true); }
        worldFilters.push(cm);
      }
      const userWorld = _avtBuildPixiFilters(root.filters);
      worldFilters.push(...userWorld);
      if (worldFilters.length) worldRoot.filters = worldFilters;

      // ── Layer setup ───────────────────────────────────────────────────────
      const baseLifeOf = c => {
        const e = c.emitter || c;
        const lt = e.lifetime || (e.behaviors && e.behaviors.find(b=>b.type==='lifetime')?.config?.lifetime);
        return ((lt && lt.max) || 1.0) * 1000;
      };
      const travelDur = mode === 'travel' ? 500 : mode === 'boomerang' ? 950 : mode === 'beam' ? 600 : 0;
      const maxLayerLife = Math.max(0, ...layers.map(baseLifeOf));
      const totalDuration = (root.duration != null ? root.duration : Math.max(maxLayerLife, travelDur)) + 200;

      // Sort layers by z
      const sorted = layers.map((l,i) => Object.assign({_idx:i}, l)).sort((a,b) => (a.z||0) - (b.z||0));

      const packs = [];           // { emitters, offset, parallax, trailCfg, trailHosts, lightSprite, subEmitters, layerContainer }
      const trackedParticles = new WeakSet();
      let totalParticleCap = 0;

      const setSpawn = (em, x, y, off) => {
        const ox = (off && off.x) || 0, oy = (off && off.y) || 0;
        if (typeof em.updateSpawnPos === 'function') em.updateSpawnPos(x + ox, y + oy);
        else { em.spawnPos = em.spawnPos || {}; em.spawnPos.x = x + ox; em.spawnPos.y = y + oy; }
      };

      const layerPromises = sorted.map(layer => {
        const texSpec = layer.texture || layer.textures || root.textures || 'spark';
        return _avtFxResolveTextures(texSpec).then(textures => {
          let cfg = Object.assign({}, layer.emitter || {});
          const isV5 = Array.isArray(cfg.behaviors);
          if (!isV5 && PIXI.particles.upgradeConfig) {
            try { cfg = PIXI.particles.upgradeConfig(cfg, textures); } catch(_) {}
          }
          totalParticleCap += (cfg.maxParticles || 50);

          const layerContainer = new PIXI.Container();
          const blend = BLEND[(layer.blendMode || root.blendMode || '').toLowerCase()];
          if (blend != null) layerContainer.blendMode = blend;

          const layerFilters = _avtBuildPixiFilters(layer.filters);
          if (layer.glow && PIXI.filters.GlowFilter) {
            layerFilters.push(new PIXI.filters.GlowFilter({
              distance: layer.glow.distance ?? 14, outerStrength: layer.glow.outerStrength ?? 2,
              innerStrength: layer.glow.innerStrength ?? 0,
              color: _avtHexToInt(layer.glow.color || '#ffffff'), quality: layer.glow.quality ?? 0.3,
            }));
          }
          if (layerFilters.length) layerContainer.filters = layerFilters;
          worldRoot.addChild(layerContainer);

          // Optional light cast sprite (cheap fake lighting)
          let lightSprite = null;
          if (layer.lightCast) {
            const tex = _avtProcTextures('glow');
            lightSprite = new PIXI.Sprite(tex);
            lightSprite.anchor.set(0.5);
            lightSprite.tint = _avtHexToInt(layer.lightCast.color || '#ffffff');
            lightSprite.alpha = layer.lightCast.alpha ?? 0.6;
            lightSprite.blendMode = PIXI.BLEND_MODES.ADD;
            const r = (layer.lightCast.radius || 90);
            lightSprite.width = lightSprite.height = r*2;
            layerContainer.addChild(lightSprite);
          }

          const emitters = [];
          if (mode === 'beam') {
            const N = layer.beamSegments || 12;
            for (let i = 0; i <= N; i++) {
              const t = i / N;
              const ex = startX + (endX - startX) * t;
              const ey = startY + (endY - startY) * t;
              const em = new PIXI.particles.Emitter(layerContainer, cfg);
              setSpawn(em, ex, ey, layer.offset); em.emit = true; emitters.push(em);
            }
          } else {
            const em = new PIXI.particles.Emitter(layerContainer, cfg);
            setSpawn(em, startX, startY, layer.offset); em.emit = true; emitters.push(em);
          }

          // Trail hosts (one ribbon of fading sprites per active particle)
          let trailHosts = null;
          if (layer.trail) {
            trailHosts = { container: new PIXI.Container(), perParticle: new WeakMap(),
                           cfg: layer.trail, tex: textures[0] || _avtProcTextures('spark') };
            trailHosts.container.blendMode = layerContainer.blendMode;
            layerContainer.addChild(trailHosts.container);
          }

          if (layer.tint) emitters.forEach(em => {
            // best-effort tint via colorStart/Tint not natively supported; rely on color list
          });

          packs.push({
            emitters, offset: layer.offset, parallax: layer.parallax || 0,
            trailHosts, lightSprite, subEmitters: layer.subEmitters || [],
            layerContainer, role: layer.role,
          });
        });
      });

      // Global particle budget warning
      Promise.all(layerPromises).then(() => {
        if (totalParticleCap > 1500) console.warn('[pixi-fx] heavy particle budget:', totalParticleCap);

        // ── Camera / impact FX ──────────────────────────────────────────────
        const cleanupCam = _avtCameraFX(app, worldRoot, uiRoot, root.camera, totalDuration, root._intensProfile);

        // ── Main render loop ────────────────────────────────────────────────
        let elapsed = 0;
        const tickFn = () => {
          const dt = app.ticker.deltaMS;
          // Honor hitstop on the VFX itself
          if (AVT_STATE._fxFreezeUntil && performance.now() < AVT_STATE._fxFreezeUntil) return;
          elapsed += dt;

          // Travel / boomerang positioning
          let cx = startX, cy = startY;
          if (mode === 'travel' || mode === 'boomerang') {
            const t = Math.min(1, elapsed / travelDur);
            const k = mode === 'travel' ? t : (t < 0.5 ? t * 2 : (1 - t) * 2);
            cx = startX + (endX - startX) * k;
            cy = startY + (endY - startY) * k;
          }

          packs.forEach(p => {
            if (mode === 'travel' || mode === 'boomerang') {
              p.emitters.forEach(em => setSpawn(em, cx, cy, p.offset));
            }
            // Update emitters
            p.emitters.forEach(em => em.update(dt * 0.001));

            // Track sub-emitter spawns on particle death + trails per active particle
            if (p.trailHosts || (p.subEmitters && p.subEmitters.length)) {
              p.emitters.forEach(em => {
                let part = em._activeParticlesFirst;
                const alive = new Set();
                while (part) {
                  alive.add(part);
                  if (!trackedParticles.has(part)) {
                    trackedParticles.add(part);
                    // Hook death via wrapping kill
                    const origKill = part.kill && part.kill.bind(part);
                    part._fxOwner = p;
                    if (origKill) {
                      part.kill = function() {
                        try {
                          p.subEmitters.forEach(sub => {
                            if (sub.on === 'death' && Math.random() < (sub.chance ?? 1)) {
                              _avtFxSpawnSub(app, worldRoot, sub, part.x, part.y);
                            }
                          });
                        } catch(_) {}
                        return origKill();
                      };
                    }
                  }
                  // Trail
                  if (p.trailHosts) {
                    let chain = p.trailHosts.perParticle.get(part);
                    if (!chain) {
                      chain = [];
                      p.trailHosts.perParticle.set(part, chain);
                    }
                    if (chain.length < (p.trailHosts.cfg.length || 10)) {
                      const s = new PIXI.Sprite(p.trailHosts.tex);
                      s.anchor.set(0.5);
                      s.tint = part.tint || 0xffffff;
                      s.blendMode = p.trailHosts.container.blendMode;
                      p.trailHosts.container.addChild(s);
                      chain.unshift(s);
                    } else {
                      const s = chain.pop(); chain.unshift(s);
                    }
                    const fade = p.trailHosts.cfg.fade ?? 0.85;
                    chain.forEach((s, i) => {
                      if (i === 0) { s.x = part.x; s.y = part.y; s.alpha = (part.alpha ?? 1) * 0.9; s.scale.set((part.scale?.x ?? 1) * 0.9); }
                      else { s.alpha *= fade; s.scale.x *= 0.98; s.scale.y *= 0.98; }
                    });
                  }
                  part = part.next;
                }
                // Cleanup trails for dead particles
                if (p.trailHosts) {
                  // (WeakMap auto-collects, but we should fade orphans visually — skip for simplicity)
                }
              });
            }

            // Light sprite follows mean position
            if (p.lightSprite) {
              let sumX = 0, sumY = 0, n = 0;
              p.emitters.forEach(em => {
                let pt = em._activeParticlesFirst;
                while (pt) { sumX += pt.x; sumY += pt.y; n++; pt = pt.next; }
              });
              if (n) { p.lightSprite.x = sumX/n; p.lightSprite.y = sumY/n; }
              else   { p.lightSprite.x = cx; p.lightSprite.y = cy; }
            }
          });

          if (elapsed > totalDuration) packs.forEach(p => p.emitters.forEach(em => { em.emit = false; }));
        };
        app.ticker.add(tickFn);

        // ── Cleanup ─────────────────────────────────────────────────────────
        setTimeout(() => {
          try { app.ticker.remove(tickFn); } catch(_) {}
          try { cleanupCam(); } catch(_) {}
          packs.forEach(p => p.emitters.forEach(em => { try { em.destroy(); } catch(_) {} }));
          try { app.destroy(true); } catch(_) {}
          overlayCanvas.remove();
          AVT_STATE._fxFreezeUntil = 0;
        }, totalDuration + 1100);
      });
    } catch(e) {
      console.warn('[pixi-fx] erro ao iniciar:', e);
      try { if (app) app.destroy(true); } catch(_) {}
      overlayCanvas.remove();
      AVT_STATE._fxFreezeUntil = 0;
      _avtCanvasFlash(endX, endY, '#e74c3c', 'Impacto');
    }
  }).catch((err) => {
    console.warn('[pixi-fx] lib indisponível:', err && err.message);
    _avtCanvasFlash(endX, endY, '#e74c3c', 'Impacto');
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// PHASES ORCHESTRATOR — cast (no atacante) → travel (corpo viajando) → impact
// envelope:
// {
//   intensidade: 'equilibrado',
//   cor: '#a978ff',
//   cast?:   { ms:350, layers?:[...], camera?:{}, body?:{}, lighting?:{} },
//   travel?: { ms:500, path:'linear|arc|spiral|homing', body:{}, trail?:{ layer:{...} }, rotate:'velocity' },
//   impact?: { ms:450, layers?:[...], camera?:{}, body?:{}, lighting?:{}, preset?:'arcane_lance' },
// }
// ─────────────────────────────────────────────────────────────────────────────
function _avtPlayPhases(env, atacScr, alvoScr, posicao) {
  const canvas = AVT_STATE.canvas;
  if (!canvas || typeof PIXI === 'undefined') {
    _avtCanvasFlash(alvoScr.x, alvoScr.y, env.cor || '#a978ff', 'Impacto');
    return;
  }
  const intensidade = env.intensidade || 'equilibrado';
  const cor = env.cor || '#ffffff';

  // CAST: sub-anim curta no atacante
  if (env.cast) {
    const castCfg = Object.assign({}, env.cast, { intensidade, cor });
    if (!castCfg.layers && !castCfg.preset) castCfg.preset = 'arcane_lance';
    setTimeout(() => {
      _avtPixiParticleAnim(castCfg, atacScr, atacScr, 'atacante');
    }, 0);
  }
  const castMs = (env.cast && env.cast.ms) || 0;

  // TRAVEL: corpo viajando + trail
  if (env.travel) {
    setTimeout(() => _avtPlayTravelBody(env.travel, atacScr, alvoScr, cor, intensidade), castMs);
  }
  const travelMs = (env.travel && env.travel.ms) || 0;

  // IMPACT: anim no alvo (com body opcional para mostrar o orbe colidindo)
  if (env.impact) {
    const impactCfg = Object.assign({}, env.impact, { intensidade, cor });
    if (!impactCfg.layers && !impactCfg.preset) impactCfg.preset = 'precise_strike';
    setTimeout(() => {
      _avtPixiParticleAnim(impactCfg, atacScr, alvoScr, 'alvo');
    }, castMs + travelMs);
  }
}

function _avtPlayTravelBody(travelCfg, atacScr, alvoScr, cor, intensidade) {
  const canvas = AVT_STATE.canvas;
  if (!canvas || typeof PIXI === 'undefined' || !travelCfg.body) return;
  const dur = travelCfg.ms || 500;
  const path = travelCfg.path || 'linear';

  // Overlay próprio para o corpo (não compartilha com particle anim para evitar conflito)
  const existing = document.getElementById('avt-pixi-body-overlay-' + Date.now());
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'avt-pixi-body-overlay-' + Math.random().toString(36).slice(2,8);
  overlayCanvas.width = canvas.width; overlayCanvas.height = canvas.height;
  overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:99`;
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(overlayCanvas);

  // Lazy-load filters needed by body
  const filterTypes = new Set();
  if (travelCfg.body.sprite && travelCfg.body.sprite.glow) filterTypes.add('glow');
  (travelCfg.body.parts || []).forEach(p => { if (p.glow) filterTypes.add('glow'); });

  Promise.all([...filterTypes].map(t => _avtEnsurePixiFilter(t))).then(() => {
    let app;
    try {
      app = new PIXI.Application({ view: overlayCanvas, backgroundAlpha:0, antialias:true,
        width: canvas.width, height: canvas.height });
      const body = _avtBuildBody(travelCfg.body, cor);
      if (!body) { app.destroy(true); overlayCanvas.remove(); return; }
      body.position.set(atacScr.x, atacScr.y);
      app.stage.addChild(body);

      // Trail simples: clones que desbotam
      const trailContainer = new PIXI.Container();
      app.stage.addChildAt(trailContainer, 0);
      const trailCfg = travelCfg.trail || {};
      const trailMax = trailCfg.length ?? 6;
      const trailFade = trailCfg.fade ?? 0.82;
      const trail = [];

      const start = performance.now();
      let lastX = atacScr.x, lastY = atacScr.y;

      const tick = () => {
        const now = performance.now();
        const t = Math.min(1, (now - start) / dur);

        // path
        let cx, cy;
        if (path === 'arc') {
          const mx = (atacScr.x + alvoScr.x) / 2;
          const my = (atacScr.y + alvoScr.y) / 2;
          const dx = alvoScr.x - atacScr.x, dy = alvoScr.y - atacScr.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          const nx = -dy / (len || 1), ny = dx / (len || 1);
          const sag = (travelCfg.arcHeight ?? 40) * Math.sin(t * Math.PI);
          cx = atacScr.x + (alvoScr.x - atacScr.x) * t + nx * sag;
          cy = atacScr.y + (alvoScr.y - atacScr.y) * t + ny * sag;
        } else if (path === 'spiral') {
          const baseX = atacScr.x + (alvoScr.x - atacScr.x) * t;
          const baseY = atacScr.y + (alvoScr.y - atacScr.y) * t;
          const r = 16 * (1 - t);
          const ang = t * Math.PI * 6;
          cx = baseX + Math.cos(ang) * r;
          cy = baseY + Math.sin(ang) * r;
        } else { // linear / homing(v1)
          cx = atacScr.x + (alvoScr.x - atacScr.x) * t;
          cy = atacScr.y + (alvoScr.y - atacScr.y) * t;
        }

        const vx = cx - lastX, vy = cy - lastY;
        body.position.set(cx, cy);
        _avtUpdateBody(body, vx, vy, app.ticker.deltaMS);
        lastX = cx; lastY = cy;

        // trail clone (cheap: every other frame)
        if (trail.length < trailMax && (now % 32 < 16)) {
          const ghost = new PIXI.Graphics();
          ghost.beginFill(_avtHexToInt(cor), 0.35);
          ghost.drawCircle(0, 0, 4);
          ghost.endFill();
          ghost.position.set(cx, cy);
          ghost.blendMode = PIXI.BLEND_MODES.ADD;
          trailContainer.addChild(ghost);
          trail.push(ghost);
        }
        for (const g of trail) g.alpha *= trailFade;

        if (t >= 1) {
          try { app.ticker.remove(tick); } catch(_) {}
          setTimeout(() => {
            try { app.destroy(true); } catch(_) {}
            overlayCanvas.remove();
          }, 200);
        }
      };
      app.ticker.add(tick);
    } catch(e) {
      console.warn('[phases] travel body falhou:', e);
      try { if (app) app.destroy(true); } catch(_) {}
      overlayCanvas.remove();
    }
  });
}

// Spawn a tiny one-shot sub-emitter at (x,y) without overlay/camera
function _avtFxSpawnSub(parentApp, parentRoot, subSpec, x, y) {
  try {
    const preset = AVT_FX_PRESETS[subSpec.preset];
    if (!preset || !preset.layers || !preset.layers.length) return;
    const layer = preset.layers[0];
    const tex = _avtProcTextures(layer.texture || 'spark');
    let cfg = Object.assign({}, layer.emitter);
    if (PIXI.particles.upgradeConfig && !Array.isArray(cfg.behaviors)) {
      try { cfg = PIXI.particles.upgradeConfig(cfg, [tex]); } catch(_) {}
    }
    const container = new PIXI.Container();
    container.blendMode = PIXI.BLEND_MODES.ADD;
    parentRoot.addChild(container);
    const em = new PIXI.particles.Emitter(container, cfg);
    if (typeof em.updateSpawnPos === 'function') em.updateSpawnPos(x, y);
    em.emit = true;
    const dur = preset.duration || 350;
    const start = performance.now();
    const tick = () => {
      const t = performance.now() - start;
      em.update(parentApp.ticker.deltaMS * 0.001);
      if (t > dur) em.emit = false;
      if (t > dur + 600) {
        try { parentApp.ticker.remove(tick); em.destroy(); container.destroy({children:true}); } catch(_) {}
      }
    };
    parentApp.ticker.add(tick);
  } catch(_) {}
}


function _avtPixiSpineAnim(spineConfig, screenX, screenY) {
  const canvas = AVT_STATE.canvas;
  if (!canvas) return;
  if (typeof PIXI === 'undefined' || !spineConfig || !spineConfig.skeleton) {
    _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
    return;
  }

  _avtEnsurePixiSpine().then(() => {
    const existingOverlay = document.getElementById('avt-pixi-spine-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'avt-pixi-spine-overlay';
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCanvas.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;pointer-events:none;z-index:101`;
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(overlayCanvas);

    const duration = spineConfig.duracao || 1000;
    let app;
    try {
      app = new PIXI.Application({ view: overlayCanvas, backgroundAlpha: 0, width: canvas.width, height: canvas.height });
      PIXI.Assets.load([spineConfig.skeleton, spineConfig.atlas].filter(Boolean)).then(resources => {
        try {
          const SpineClass = PIXI.spine && PIXI.spine.Spine;
          const data = resources && resources[spineConfig.skeleton] && resources[spineConfig.skeleton].spineData;
          if (SpineClass && data) {
            const spine = new SpineClass(data);
            spine.x = screenX;
            spine.y = screenY;
            spine.scale.set(spineConfig.scale || 1);
            if (spineConfig.animation) spine.state.setAnimation(0, spineConfig.animation, false);
            app.stage.addChild(spine);
          } else {
            _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
          }
        } catch(e) {
          console.warn('[pixi-spine] erro ao instanciar spine:', e);
          _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
        }
      }).catch((e) => {
        console.warn('[pixi-spine] falha ao carregar assets:', e);
        _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
      });
    } catch(e) {
      console.warn('[pixi-spine] erro app:', e);
      try { if (app) app.destroy(true); } catch(_) {}
      overlayCanvas.remove();
      _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
      return;
    }

    setTimeout(() => {
      try { app.destroy(true); } catch(_) {}
      const ov = document.getElementById('avt-pixi-spine-overlay');
      if (ov) ov.remove();
    }, duration + 500);
  }).catch((err) => {
    console.warn('[pixi-spine] lib indisponível:', err && err.message);
    _avtCanvasFlash(screenX, screenY, '#9b59b6', 'Impacto');
  });
}

function _avtMestrePainelRender() {
  const panel = document.getElementById('avt-mestre-panel');
  if (!panel) return;
  const membros = AVT_STATE.membros.filter(m => m.role !== 'mestre');
  const aba = AVT_STATE.mestrePainelAba;

  const abas = [
    { id: 'modo',        label: '🎮 Modo Mestre' },
    { id: 'combate',     label: '⚔ Combate' },
    { id: 'npcs',        label: '🤖 NPCs' },
    { id: 'personagens', label: '👤 Personagens' },
    { id: 'jogadores',   label: '👥 Jogadores' },
    { id: 'loot_xp',     label: '📦 Loot & XP' },
    { id: 'mapa',        label: '🗺 Mapa' },
    { id: 'campanha',    label: '🏰 Campanha', perigo: true },
  ];

  panel.style.display = 'flex';
  panel.innerHTML = `
    <div class="avt-mp-header" style="flex-shrink:0;padding:10px 14px">
      <span>⚙ PAINEL DO MESTRE</span>
      <button onclick="avtMestrePainel()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;padding:0;line-height:1">×</button>
    </div>
    <div class="avt-mp-body">
      <nav class="avt-mp-nav">
        ${abas.map(a => `<button class="avt-mp-nav-btn${aba===a.id?' ativo':''}${a.perigo?' perigo':''}"
          onclick="_avtMpAba('${a.id}')">${a.label}</button>`).join('')}
      </nav>
      <div class="avt-mp-content">${_avtMpConteudoAba()}</div>
    </div>`;
}

function _avtMpAba(aba) {
  AVT_STATE.mestrePainelAba = aba;
  _avtMestrePainelRender();
}

function _avtMpConteudoAba() {
  const batalhas = AVT_STATE.batalhas;
  const npcs = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
  const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
  const membros = AVT_STATE.membros.filter(m => m.role !== 'mestre');

  switch (AVT_STATE.mestrePainelAba) {

    case 'modo': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-label">👤 Meu personagem (mestre)</div>
        <div class="avt-mp-hint" style="margin-bottom:6px">Personagem que você (mestre) controla com WASD/clique.</div>
        <select onchange="_avtMestreSelecionarPersonagem(this.value)"
          style="width:100%;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;margin-bottom:4px">
          <option value="">— Nenhum (só observando) —</option>
          ${(AVT_STATE.chars||[]).map(c=>`<option value="${c.nome}" ${AVT_STATE.myCharNome===c.nome?'selected':''}>${c.nome}</option>`).join('')}
        </select>
        ${AVT_STATE.myCharNome ? `<div class="avt-mp-hint" style="color:#c8a84b">🎮 Você controla: <b>${AVT_STATE.myCharNome}</b></div>` : ''}
      </div>
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.mestreAtivo ? 'avt-mp-toggle-on' : ''}"
          onclick="AVT_STATE.mestreAtivo=!AVT_STATE.mestreAtivo;_avtMestrePainelRender();mostrarToast(AVT_STATE.mestreAtivo?'Controle total ativado':'Modo mestre desativado','ok')">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.mestreAtivo ? '🟢 Controle total ATIVO' : '⚪ Controle total INATIVO'}
        </button>
        <div class="avt-mp-hint">ATIVO: move qualquer personagem (WASD move seu personagem). INATIVO: move apenas o seu.</div>
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">📍 Reposicionar entidade</div>
        <div class="avt-mp-hint" style="margin-bottom:6px">Selecione uma entidade e clique no mapa para mover.</div>
        <select id="avt-mp-repos-sel" style="width:100%;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem;margin-bottom:6px">
          <option value="">Escolher entidade…</option>
          ${AVT_STATE.entidades.map(e=>`<option value="${e.id}" ${AVT_STATE.mestreReposicionando===e.id?'selected':''}>${e.tipo==='jogador'?'🧙':'👹'} ${e.nome} (${e.hp}/${e.hpMax}HP)</option>`).join('')}
        </select>
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtMestreIniciarRepos()">📍 Iniciar reposicionamento</button>
        ${AVT_STATE.mestreReposicionando ? `<div class="avt-mp-hint" style="color:#c8a84b;margin-top:4px">⚡ Clique no mapa para mover a entidade selecionada</div>` : ''}
      </div>`;

    case 'combate': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtCombateIniciar(null);_avtMestrePainelRender()">⚔ Iniciar combate geral</button>
        </div>
        ${batalhas.length ? batalhas.map(bat => {
          const envNomes = bat.envolvidos.map(id => {
            const e = AVT_STATE.entidades.find(x => x.id === id);
            return e ? `${e.tipo==='jogador'?'🧙':'👹'} ${e.nome}` : '';
          }).filter(Boolean).join(', ');
          const ativoNome = bat.iniciativa[bat.turnoIdx]?.nome || '?';
          return `<div style="margin-bottom:8px;padding:8px;border-radius:7px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.04)">
            <div style="font-size:0.7rem;color:#c8d8e8;font-weight:bold;margin-bottom:3px">⚔ Combate ativo</div>
            <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:3px">${envNomes}</div>
            <div style="font-size:0.62rem;color:#c8a84b;margin-bottom:6px">Turno: ${ativoNome}</div>
            <div class="avt-mp-row" style="gap:4px">
              <button class="avt-mp-btn avt-mp-btn-danger" onclick="avtCombateEncerrar('${bat.id}');_avtMestrePainelRender()">✕ Encerrar</button>
              <button class="avt-mp-btn" onclick="_avtPassarTurnoBatalha('${bat.id}')">⏭ Passar turno</button>
            </div>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum combate em andamento.</div>`}
        <div style="margin-top:8px">
          <button class="avt-mp-toggle-btn ${AVT_STATE.batalhaAutoSuspensa ? 'avt-mp-toggle-warn' : ''}"
            onclick="AVT_STATE.batalhaAutoSuspensa=!AVT_STATE.batalhaAutoSuspensa;_avtMestrePainelRender();mostrarToast(AVT_STATE.batalhaAutoSuspensa?'Batalha automática suspensa':'Batalha automática ativa','ok')">
            <span class="avt-mp-toggle-dot"></span>
            ${AVT_STATE.batalhaAutoSuspensa ? '🚫 Batalha auto: SUSPENSA' : '✅ Batalha auto: ATIVA'}
          </button>
          <div class="avt-mp-hint">Suspender impede que aproximação de inimigos inicie combate automaticamente.</div>
        </div>
      </div>`;

    case 'npcs': return `
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.npcIaAtiva ? 'avt-mp-toggle-on' : ''}"
          onclick="AVT_STATE.npcIaAtiva=!AVT_STATE.npcIaAtiva;_avtMestrePainelRender()">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.npcIaAtiva ? '🟢 IA de NPCs ATIVA' : '⚪ IA de NPCs INATIVA'}
        </button>
        ${npcs.length ? `
          <div class="avt-mp-row" style="margin-top:8px">
            <select id="avt-mp-npc-sel" style="flex:1;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.72rem">
              <option value="">Escolher NPC…</option>
              ${npcs.map(n=>`<option value="${n.id}" ${AVT_STATE.npcControlando===n.id?'selected':''}>${n.nome} (${n.hp}/${n.hpMax} HP)</option>`).join('')}
            </select>
            <button class="avt-mp-btn" onclick="_avtMestreAssumir()">🎮 Assumir</button>
            ${AVT_STATE.npcControlando ? `<button class="avt-mp-btn avt-mp-btn-danger" onclick="AVT_STATE.npcControlando=null;_avtMestrePainelRender()">✕ Liberar</button>` : ''}
          </div>
        ` : ''}
        ${(() => {
          const mortos = AVT_STATE.entidades.filter(e => e.tipo==='inimigo' && e.escondido);
          return mortos.length ? `
            <div class="avt-mp-label" style="margin-top:10px">💀 NPCs mortos (respawn manual)</div>
            ${mortos.map(e=>`<div class="avt-mp-row" style="margin-top:4px">
              <span style="flex:1;font-size:0.72rem;color:#7a92aa">${e.nome}</span>
              <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtRespawnNpc('${e.id}');_avtMestrePainelRender()">↺ Respawnar</button>
            </div>`).join('')}` : `<div class="avt-mp-hint" style="margin-top:6px">Nenhum NPC no momento.</div>`;
        })()}
      </div>`;

    case 'personagens': return `
      <div class="avt-mp-secao">
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%;margin-bottom:8px" onclick="_avtMestreGerarPersonagensExterno()">
          🌐 Gerar personagem/NPC/Boss via IA externa
        </button>
        ${AVT_STATE.entidades.length ? AVT_STATE.entidades.map(e => {
          const pct = Math.max(0, Math.min(100, (e.hp / e.hpMax) * 100));
          const cor = pct < 30 ? '#e74c3c' : pct < 60 ? '#f0cc6a' : '#27ae60';
          const batEnt = _avtBatalhaDeEnt(e.id);
          return `<div class="avt-mp-char-row" style="cursor:default">
            <span class="avt-mp-char-dot" style="background:${e.cor}"></span>
            <span class="avt-mp-char-nome" style="cursor:pointer" onclick="abrirAvtCharEditor('${e.id}');avtMestrePainel()">${e.nome}</span>
            <div class="avt-mp-hp-wrap" style="cursor:pointer" onclick="abrirAvtCharEditor('${e.id}');avtMestrePainel()">
              <div class="avt-mp-hp-bar" style="width:${pct}%;background:${cor}"></div>
            </div>
            <span class="avt-mp-char-hp" style="color:${cor}">${e.hp}/${e.hpMax}</span>
            ${batEnt ? `<span style="font-size:0.58rem;color:#e74c3c" title="Em combate">⚔</span>` : ''}
            <button title="Reposicionar no mapa" onclick="AVT_STATE.mestreReposicionando='${e.id}';mostrarToast('📍 Clique no mapa para mover ${e.nome.replace(/'/g,"\\'")}','ok');avtMestrePainel()"
              style="padding:2px 5px;font-size:0.62rem;background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#4fa3d1;cursor:pointer;flex-shrink:0">📍</button>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum personagem na cena.</div>`}
      </div>`;

    case 'jogadores': return `
      <div class="avt-mp-secao">
        <div class="avt-mp-hint">Vincule jogadores ao personagem pelo nome de usuário.</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <input id="avt-mp-add-nick" placeholder="Nome de usuário…" style="flex:1;padding:4px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;outline:none">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtAdicionarMembro(document.getElementById('avt-mp-add-nick').value)">+ Add</button>
        </div>
        ${membros.length ? membros.map(m => {
          const esc = m.player_id.replace(/'/g,"\\'");
          const allChars = AVT_STATE.chars || [];
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:8px">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.player_id}">${m.nickname||m.player_id.slice(0,8)}</span>
            <select onchange="_avtMestreAtribuirJogador('${esc}',this.value)"
              style="flex:1;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem">
              <option value="">— nenhum —</option>
              ${allChars.map(j=>`<option value="${j.nome}" ${m.linked===j.nome?'selected':''}>${j.nome}</option>`).join('')}
            </select>
            <button onclick="_avtRemoverMembro('${esc}')" style="padding:2px 6px;background:none;border:1px solid rgba(231,76,60,0.3);border-radius:4px;color:#e74c3c88;font-size:0.7rem;cursor:pointer" title="Remover">✕</button>
          </div>`;
        }).join('') : `<div style="margin-top:8px;font-size:0.7rem;color:#7a92aa;font-style:italic">Nenhum jogador adicionado ainda.</div>`}
      </div>`;

    case 'mapa': {
      const fases = AVT_STATE.rpg?.theme_json?.fases_extras || [];
      return `
      <div class="avt-mp-secao">
        <button class="avt-mp-toggle-btn ${AVT_STATE.mestreVisaoGeral?'avt-mp-toggle-on':''}" onclick="_avtMestreToggleVisao();_avtMestrePainelRender()">
          <span class="avt-mp-toggle-dot"></span>
          ${AVT_STATE.mestreVisaoGeral ? '👁 Visão geral ATIVA' : '👁 Visão geral INATIVA'}
        </button>
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">Editar mapa</div>
        <div class="avt-mp-row" style="flex-wrap:wrap;gap:6px">
          <button class="avt-mp-btn" onclick="_avtMestreAddInimigo()">👹 + NPC/Boss</button>
          <button class="avt-mp-btn" onclick="avtMestreAbrirEditor()">✏ Editar Manual</button>
          <button class="avt-mp-btn" onclick="_avtMestreAbrirEditorTileset()">🎨 Editar com Tileset</button>
        </div>
      </div>
      ${AVT_STATE._faseAnterior ? `
      <div class="avt-mp-secao">
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtVoltarFaseAnterior()">⬅ Voltar ao mapa anterior</button>
      </div>` : ''}
      <div class="avt-mp-secao">
        <div class="avt-mp-label">Fases extras</div>
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%;margin-bottom:8px" onclick="_avtMestreNovaFase()">🚪 + Nova Fase</button>
        ${fases.length ? fases.map(f => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.1);margin-bottom:4px">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8">${f.nome}</span>
            <span style="font-size:0.62rem;color:#7a92aa">${f.porta.lock_type==='livre'?'🔓':f.porta.lock_type==='chave'?'🔑':'⚔'} (${f.porta.col},${f.porta.row})</span>
            <button class="avt-mp-btn" style="flex:0;padding:3px 7px;min-width:0;font-size:0.65rem" onclick="_avtEntrarFaseExtra(AVT_STATE.rpg.theme_json.fases_extras.find(x=>x.id==='${f.id}'))">▶</button>
            <button class="avt-mp-btn avt-mp-btn-danger" style="flex:0;padding:3px 7px;min-width:0" onclick="_avtMestreRemoverFase('${f.id}')">✕</button>
          </div>`).join('')
        : `<div class="avt-mp-hint">Nenhuma fase extra criada.</div>`}
      </div>`;
    }

    case 'loot_xp': {
      const jogadores = AVT_STATE.entidades.filter(e => e.tipo === 'jogador');
      const npcsVivos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo' && e.hp > 0);
      const rd = AVT_STATE.dungeon?.render_data;
      const baus = (rd?.objetos || []).filter(o => o.tipo === 'bau' || o.tipo === 'chest');
      const inputStyle = 'width:60px;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.72rem;text-align:center';
      return `
      <div class="avt-mp-secao">
        <div class="avt-mp-label">✦ XP dos personagens</div>
        ${jogadores.length ? jogadores.map(e => {
          const dbC = AVT_STATE.chars.find(c=>c.id===e.dbId||c.nome===e.nome);
          const xp = dbC?.xp ?? 0;
          const nivel = dbC?.nivel ?? (dbC?.custom_attrs?.nivel ?? 1);
          const maxNivelP = AVT_STATE.rpg?.theme_json?.level_config?.nivel_maximo || 20;
          const atMaxP = nivel >= maxNivelP;
          const xpProx = atMaxP ? null : _avtXpParaNivel(nivel);
          const pronto = !atMaxP && xp >= xpProx;
          const safe = e.nome.replace(/'/g,"\\'");
          const cardBorder = pronto
            ? 'border:1px solid rgba(200,168,75,0.7);box-shadow:0 0 10px rgba(200,168,75,0.25);animation:avt-levelup-pulse 2s ease-in-out infinite'
            : 'border:1px solid rgba(79,163,209,0.12)';
          const xpLabel = atMaxP
            ? `<span style="font-size:0.62rem;color:#c8a84b">Nv${nivel} (MAX)</span>`
            : `<span style="font-size:0.62rem;color:${pronto?'#c8a84b':'#7a92aa'}">${pronto?'⬆ ':''}Nv${nivel} · ${xp}/${xpProx}xp</span>`;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:7px 9px;background:${pronto?'rgba(200,168,75,0.05)':'rgba(79,163,209,0.04)'};border-radius:6px;${cardBorder}">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8">${e.nome}</span>
            ${xpLabel}
            <input type="number" id="avt-xp-add-${e.nome.replace(/\W/g,'_')}" placeholder="+xp" min="1" max="99999" style="${inputStyle}">
            <button class="avt-mp-btn avt-mp-btn-ok" style="padding:2px 7px;font-size:0.68rem"
              onclick="_avtMestreAddXp('${safe}',+document.getElementById('avt-xp-add-${e.nome.replace(/\W/g,'_')}').value)">+XP</button>
            <button class="avt-mp-btn avt-mp-btn-danger" style="padding:2px 7px;font-size:0.68rem"
              onclick="_avtMestreAddXp('${safe}',-Math.abs(+document.getElementById('avt-xp-add-${e.nome.replace(/\W/g,'_')}').value))">−XP</button>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum personagem no mapa.</div>`}
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">💀 XP dos NPCs</div>
        <div class="avt-mp-hint" style="margin-bottom:6px">XP base concedido ao matar o NPC.</div>
        ${npcsVivos.length ? npcsVivos.map(e => {
          const safe = e.id.replace(/'/g,"\\'");
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="flex:1;font-size:0.72rem;color:#c8d8e8">${e.nome}</span>
            <input type="number" min="0" max="9999" value="${e.xpBase??0}"
              onchange="(()=>{const v=+this.value;const en=AVT_STATE.entidades.find(x=>x.id==='${safe}');if(en)en.xpBase=v;const dn=(AVT_STATE.dungeon?.render_data?.npcs||[]).find(x=>x.id==='${safe}');if(dn)dn.xpBase=v;_avtSalvarDungeon();})()"
              style="${inputStyle}">
            <span style="font-size:0.62rem;color:#7a92aa">xp</span>
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum NPC vivo.</div>`}
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-label">📦 Baús no mapa</div>
        <button class="avt-mp-btn avt-mp-btn-ok" style="width:100%;margin-bottom:8px" onclick="_avtMestreAddBau()">📦 + Novo Baú</button>
        ${baus.length ? baus.map(b => {
          const safe = String(b.id).replace(/'/g,"\\'");
          const itens = (b.loot_itens||[]).map(i=>i.nome||i).join(', ');
          return `<div style="padding:8px;border:1px solid rgba(200,168,75,0.2);border-radius:6px;background:rgba(200,168,75,0.03);margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="flex:1;font-size:0.72rem;color:#c8a84b">${b.nome||'Baú'} ${b.aberto?'(aberto)':''} <span style="font-size:0.6rem;color:#7a92aa">(${b.x},${b.y})</span></span>
              <button class="avt-mp-btn" style="padding:2px 7px;font-size:0.65rem" onclick="_avtMestreEditarBau('${safe}')">✏ Editar</button>
              <button class="avt-mp-btn avt-mp-btn-danger" style="padding:2px 7px;font-size:0.65rem" onclick="_avtMestreRemoverBau('${safe}')">✕</button>
            </div>
            <div style="font-size:0.62rem;color:#7a92aa">💰 ${b.ouro||0} ouro · ${(b.loot_itens||[]).length} itens${itens?' ('+itens.slice(0,40)+')':''}</div>
            ${b.aberto?`<button class="avt-mp-btn" style="padding:2px 8px;font-size:0.65rem;margin-top:4px" onclick="_avtMestreReabrirBau('${safe}')">↺ Resetar (fechar)</button>`:''}
          </div>`;
        }).join('') : `<div class="avt-mp-hint">Nenhum baú no dungeon. Crie um acima!</div>`}
      </div>`;
    }

    case 'campanha': {
      const lc = AVT_STATE.rpg?.theme_json?.level_config || {};
      const multAtual = lc.dano_mult_por_nivel ?? 0;
      return `
      <div class="avt-mp-secao">
        <div class="avt-mp-label">⚔ Multiplicador de Dano por Nível</div>
        <div class="avt-mp-hint" style="margin-bottom:8px">Quanto o dano das habilidades dos jogadores cresce a cada nível acima de 1. Ex: 0.10 = +10% por nível. Arredondamento sempre para baixo.</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <input type="number" id="avt-mp-dano-mult" min="0" max="2" step="0.05" value="${multAtual}"
            style="width:80px;padding:5px 7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.78rem;text-align:center">
          <span style="font-size:0.7rem;color:#7a92aa">por nível (0 = sem bônus)</span>
        </div>
        <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtSalvarDanoMult()"
          style="width:100%">💾 Salvar multiplicador</button>
      </div>
      <div class="avt-mp-secao">
        <div class="avt-mp-hint">Ações permanentes da campanha atual.</div>
        <button class="avt-mp-btn avt-mp-btn-danger" style="width:100%;margin-top:12px"
          onclick="_avtMestreExcluirCampanha()">🗑 Excluir campanha</button>
      </div>`;
    }

    default: return '';
  }
}

function avtMestreAbrirEditor() {
  const dungeon = AVT_STATE.dungeon;
  if (!dungeon) { mostrarToast('Nenhum mapa carregado', 'aviso'); return; }

  // Build editor overlay
  let overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avt-mestre-map-editor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px;overflow:auto';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  const EDSZ = 14;
  const W = dungeon.w, H = dungeon.h;

  // Copy tiles for editing
  _avtEd.tiles = dungeon.tiles.map(row => [...row]);
  _avtEd.w = W;
  _avtEd.h = H;

  overlay.innerHTML = `
    <div style="width:100%;max-width:900px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">✏ Editor de Mapa</div>
        <div style="display:flex;gap:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="avtMestreSalvarMapaEditado()">💾 Salvar</button>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        ${[
          ['piso','🟫 Piso'],['parede','🔲 Parede'],['entrada','🚪 Entrada'],['saida','🟢 Saída'],
          ['agua','💧 Água'],['armadilha','⚠ Armadilha']
        ].map(([v,l]) => `<button class="avt-mp-btn ${_avtEd.acao===v?'avt-mp-btn-ativo':''}"
          onclick="document.querySelectorAll('#avt-mestre-map-editor-overlay .avt-mp-btn').forEach(b=>b.classList.remove('avt-mp-btn-ativo'));this.classList.add('avt-mp-btn-ativo');_avtEd.acao='${v}'">${l}</button>`).join('')}
      </div>
      <div style="overflow:auto;max-height:60vh;border:1px solid rgba(255,255,255,0.1);border-radius:8px">
        <canvas id="avt-ed-canvas-mestre" style="display:block;image-rendering:pixelated"></canvas>
      </div>
      <div style="margin-top:8px;font-size:0.68rem;color:#7a92aa">Clique/arraste para pintar tiles. A câmera da sessão será atualizada ao salvar.</div>
    </div>`;

  const canvas = document.getElementById('avt-ed-canvas-mestre');
  if (!canvas) return;
  canvas.width = W * EDSZ;
  canvas.height = H * EDSZ;
  canvas.style.width = (W * EDSZ) + 'px';
  canvas.style.height = (H * EDSZ) + 'px';

  function renderMestreEditor() {
    const ctx = canvas.getContext('2d');
    const TILE_COLORS = { piso:'#2a1f14', parede:'#0a0a0a', entrada:'#1a3a1a', saida:'#1a3a1a', agua:'#0a1a2a', armadilha:'#2a0a0a', null:'#050810' };
    const BORDER_COLORS = { piso:'#3a2a18', parede:'#222', entrada:'#27ae60', saida:'#2ecc71', agua:'#1a4a6a', armadilha:'#8e2020' };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = _avtEd.tiles[y]?.[x];
        ctx.fillStyle = TILE_COLORS[t] || TILE_COLORS['null'];
        ctx.fillRect(x * EDSZ, y * EDSZ, EDSZ, EDSZ);
        ctx.strokeStyle = BORDER_COLORS[t] || '#111';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * EDSZ + 0.5, y * EDSZ + 0.5, EDSZ - 1, EDSZ - 1);
      }
    }
    // Draw entities
    AVT_STATE.entidades.forEach(ent => {
      if (ent.x < 0 || ent.x >= W || ent.y < 0 || ent.y >= H) return;
      ctx.fillStyle = ent.cor || (ent.tipo === 'jogador' ? '#4fa3d1' : '#e74c3c');
      ctx.beginPath();
      ctx.arc(ent.x * EDSZ + EDSZ/2, ent.y * EDSZ + EDSZ/2, EDSZ/2 - 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  renderMestreEditor();

  let painting = false;
  function paintTile(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W * EDSZ / rect.width;
    const scaleY = H * EDSZ / rect.height;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const tx = Math.floor(cx * scaleX / EDSZ);
    const ty = Math.floor(cy * scaleY / EDSZ);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
    if (!_avtEd.tiles[ty]) _avtEd.tiles[ty] = [];
    _avtEd.tiles[ty][tx] = _avtEd.acao;
    renderMestreEditor();
  }
  canvas.addEventListener('mousedown', e => { painting = true; paintTile(e); });
  canvas.addEventListener('mousemove', e => { if (painting) paintTile(e); });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); painting = true; paintTile(e); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (painting) paintTile(e); });
  canvas.addEventListener('touchend', () => { painting = false; });
}

async function avtMestreSalvarMapaEditado() {
  if (!_avtEd.tiles || !AVT_STATE.dungeon) return;
  AVT_STATE.dungeon.tiles = _avtEd.tiles.map(row => [...row]);
  const overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (overlay) overlay.style.display = 'none';
  // Persist to DB
  try {
    const themeJson = AVT_STATE.rpg?.theme_json || {};
    const newTheme = { ...themeJson, dungeon_data: AVT_STATE.dungeon };
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ theme_json: newTheme })
    });
    mostrarToast('Mapa salvo!', 'ok');
  } catch(e) {
    mostrarToast('Mapa atualizado localmente (erro ao persistir: ' + (e?.message||e) + ')', 'aviso');
  }
}

// ─── Excluir campanha ────────────────────────────────────────────────────────
async function _avtSalvarDanoMult() {
  const val = parseFloat(document.getElementById('avt-mp-dano-mult')?.value ?? 0) || 0;
  const rpg = AVT_STATE.rpg;
  if (!rpg) return;
  if (!rpg.theme_json) rpg.theme_json = {};
  if (!rpg.theme_json.level_config) rpg.theme_json.level_config = {};
  rpg.theme_json.level_config.dano_mult_por_nivel = val;
  try {
    await _avtSb('rpg_registry?id=eq.' + encodeURIComponent(rpg.id), {
      method: 'PATCH',
      body: JSON.stringify({ theme_json: rpg.theme_json })
    });
    mostrarToast(`Multiplicador de dano salvo: ${val} por nível`, 'sucesso');
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro');
  }
}

async function _avtMestreExcluirCampanha() {
  const nome = AVT_STATE.rpg?.name || 'esta campanha';
  if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
  try {
    await deleteRPGData(AVT_STATE.rpgId);
    mostrarToast('Campanha excluída', 'ok');
    setTimeout(sairAventura, 800);
  } catch(e) {
    mostrarToast('Erro ao excluir: ' + (e?.message || e), 'erro');
  }
}

// ─── Editor com Tileset ───────────────────────────────────────────────────────
function _avtMestreAbrirEditorTileset() {
  const dungeon = AVT_STATE.dungeon;
  if (!dungeon) { mostrarToast('Nenhum mapa carregado', 'aviso'); return; }
  const tilesetUrl = AVT_STATE.rpg?.theme_json?.tileset_img_url;

  let overlay = document.getElementById('avt-mestre-map-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avt-mestre-map-editor-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px;overflow:auto';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  const EDSZ = 14;
  const W = dungeon.w, H = dungeon.h;
  _avtEd.tiles = dungeon.tiles.map(row => [...row]);
  _avtEd.w = W; _avtEd.h = H;
  if (!_avtEd.tilesetPaints) _avtEd.tilesetPaints = Object.assign({}, AVT_STATE.rpg?.theme_json?.tileset_paints || {});
  _avtEd.tsBrush = null; // {tc, tr}
  const TSCOLS = 8; // assumed tileset grid columns

  if (!tilesetUrl) {
    overlay.innerHTML = `
      <div style="width:100%;max-width:900px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">🎨 Editor com Tileset</div>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
        <div style="color:#f0cc6a;font-size:0.8rem;padding:16px;border:1px solid rgba(240,204,106,0.3);border-radius:8px;background:rgba(240,204,106,0.06)">
          ⚠ Nenhum tileset disponível para este dungeon. Para usar esta função, gere um tileset na criação do dungeon. Alternativa: use o <button class="avt-mp-btn" style="display:inline-block;width:auto;margin-left:6px" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none';avtMestreAbrirEditor()">✏ Editor Manual</button>
        </div>
      </div>`;
    return;
  }

  overlay.innerHTML = `
    <div style="width:100%;max-width:1100px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:#c8d8e8">🎨 Editor com Tileset</div>
        <div style="display:flex;gap:8px">
          <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtMestreSalvarTilesetPaints()">💾 Salvar</button>
          <button class="avt-mp-btn avt-mp-btn-danger" onclick="document.getElementById('avt-mestre-map-editor-overlay').style.display='none'">✕ Fechar</button>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:0 0 auto">
          <div style="font-size:0.64rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Tileset — clique para selecionar bloco</div>
          <div id="avt-ts-picker" style="border:1px solid rgba(79,163,209,0.2);border-radius:6px;overflow:hidden;cursor:crosshair;position:relative">
            <img id="avt-ts-img" src="${tilesetUrl}" style="display:block;image-rendering:pixelated;max-width:256px">
            <canvas id="avt-ts-overlay" style="position:absolute;top:0;left:0;pointer-events:none"></canvas>
          </div>
          <div id="avt-ts-brush-info" style="font-size:0.62rem;color:#4fa3d1;margin-top:4px">Nenhum bloco selecionado</div>
        </div>
        <div style="flex:1;min-width:260px">
          <div style="font-size:0.64rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Mapa — clique/arraste para pintar</div>
          <div style="overflow:auto;max-height:65vh;border:1px solid rgba(255,255,255,0.1);border-radius:8px">
            <canvas id="avt-ed-canvas-mestre" style="display:block;image-rendering:pixelated"></canvas>
          </div>
          <div style="margin-top:6px;font-size:0.62rem;color:#7a92aa">Clique com brush selecionado para pintar. Clique sem brush para apagar decoração.</div>
        </div>
      </div>
    </div>`;

  const canvas = document.getElementById('avt-ed-canvas-mestre');
  canvas.width = W * EDSZ; canvas.height = H * EDSZ;
  canvas.style.width = (W * EDSZ) + 'px'; canvas.style.height = (H * EDSZ) + 'px';

  const tsImg = document.getElementById('avt-ts-img');
  const tsPicker = document.getElementById('avt-ts-picker');
  const tsOverlay = document.getElementById('avt-ts-overlay');

  function renderTsEditor() {
    const ctx = canvas.getContext('2d');
    const TILE_COLORS = { piso:'#2a1f14', parede:'#0a0a0a', entrada:'#1a3a1a', saida:'#1a3a1a', agua:'#0a1a2a', armadilha:'#2a0a0a', null:'#050810' };
    const BORDER_COLORS = { piso:'#3a2a18', parede:'#222', entrada:'#27ae60', saida:'#2ecc71', agua:'#1a4a6a', armadilha:'#8e2020' };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = _avtEd.tiles[y]?.[x];
        ctx.fillStyle = TILE_COLORS[t] || TILE_COLORS['null'];
        ctx.fillRect(x * EDSZ, y * EDSZ, EDSZ, EDSZ);
        ctx.strokeStyle = BORDER_COLORS[t] || '#111';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * EDSZ + 0.5, y * EDSZ + 0.5, EDSZ - 1, EDSZ - 1);
      }
    }
    // Draw tileset paints
    if (tsImg.complete && tsImg.naturalWidth) {
      const tsW = tsImg.naturalWidth, tsH = tsImg.naturalHeight;
      const TSROWS = Math.ceil(tsH / (tsW / TSCOLS));
      const tcSz = tsW / TSCOLS;
      Object.entries(_avtEd.tilesetPaints).forEach(([key, p]) => {
        const [px, py] = key.split('_').map(Number);
        if (px < 0 || px >= W || py < 0 || py >= H) return;
        ctx.drawImage(tsImg, p.tc * tcSz, p.tr * (tsH / TSROWS), tcSz, tsH / TSROWS,
          px * EDSZ, py * EDSZ, EDSZ, EDSZ);
      });
    }
    // Draw entities
    AVT_STATE.entidades.forEach(ent => {
      if (ent.x < 0 || ent.x >= W || ent.y < 0 || ent.y >= H) return;
      ctx.fillStyle = ent.cor || (ent.tipo === 'jogador' ? '#4fa3d1' : '#e74c3c');
      ctx.beginPath();
      ctx.arc(ent.x * EDSZ + EDSZ/2, ent.y * EDSZ + EDSZ/2, EDSZ/2 - 1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  tsImg.onload = () => {
    tsOverlay.width = tsImg.offsetWidth || tsImg.naturalWidth;
    tsOverlay.height = tsImg.offsetHeight || tsImg.naturalHeight;
    renderTsEditor();
  };
  if (tsImg.complete) { tsImg.onload(); }

  tsPicker.addEventListener('click', e => {
    const rect = tsImg.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cellW = rect.width / TSCOLS;
    const tsH = tsImg.naturalHeight, tsW = tsImg.naturalWidth;
    const TSROWS = Math.ceil(tsH / (tsW / TSCOLS));
    const cellH = rect.height / TSROWS;
    const tc = Math.floor(x / cellW), tr = Math.floor(y / cellH);
    _avtEd.tsBrush = { tc, tr };
    document.getElementById('avt-ts-brush-info').textContent = `Bloco selecionado: coluna ${tc}, linha ${tr}`;
    // Draw selection outline
    const oc = tsOverlay.getContext('2d');
    oc.clearRect(0, 0, tsOverlay.width, tsOverlay.height);
    oc.strokeStyle = '#4fa3d1';
    oc.lineWidth = 2;
    oc.strokeRect(tc * cellW + 1, tr * cellH + 1, cellW - 2, cellH - 2);
    tsOverlay.style.width = rect.width + 'px';
    tsOverlay.style.height = rect.height + 'px';
    tsOverlay.width = rect.width;
    tsOverlay.height = rect.height;
    oc.strokeRect(tc * cellW + 1, tr * cellH + 1, cellW - 2, cellH - 2);
  });

  let painting = false;
  function paintTs(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const tx = Math.floor(cx * W * EDSZ / rect.width / EDSZ);
    const ty = Math.floor(cy * H * EDSZ / rect.height / EDSZ);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
    const key = `${tx}_${ty}`;
    if (_avtEd.tsBrush) {
      _avtEd.tilesetPaints[key] = { tc: _avtEd.tsBrush.tc, tr: _avtEd.tsBrush.tr };
    } else {
      delete _avtEd.tilesetPaints[key];
    }
    renderTsEditor();
  }
  canvas.addEventListener('mousedown', e => { painting = true; paintTs(e); });
  canvas.addEventListener('mousemove', e => { if (painting) paintTs(e); });
  canvas.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); painting = true; paintTs(e); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (painting) paintTs(e); });
  canvas.addEventListener('touchend', () => { painting = false; });
}

async function _avtMestreSalvarTilesetPaints() {
  if (!AVT_STATE.rpg) return;
  try {
    const newTheme = { ...(AVT_STATE.rpg.theme_json || {}), tileset_paints: _avtEd.tilesetPaints };
    AVT_STATE.rpg.theme_json = newTheme;
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH', body: JSON.stringify({ theme_json: newTheme })
    });
    document.getElementById('avt-mestre-map-editor-overlay').style.display = 'none';
    mostrarToast('Tileset salvo!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro');
  }
}

// ─── Nova Fase (wizard) ──────────────────────────────────────────────────────
function _avtMestreNovaFase() {
  AVT_STATE._novaFaseWizard = AVT_STATE._novaFaseWizard || {
    mapaOpcao: 'procedural', dungeon: null, _procSalas: 8,
    lock_type: 'livre', chave_palavra: '', npc_boss_id: '',
    porta_col: null, porta_row: null
  };
  _avtMestreNovaFaseRender();
}

function _avtMestreNovaFaseRender() {
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  const w = AVT_STATE._novaFaseWizard;
  const inimigos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo');
  const portaLabel = (w.porta_col != null && w.porta_row != null)
    ? `<span style="color:#27ae60">✓ Porta em (${w.porta_col}, ${w.porta_row})</span>`
    : `<span style="color:#7a92aa">Não definida</span>`;
  const mapaLabel = w.dungeon
    ? `<span style="color:#27ae60">✓ Mapa gerado (${w.dungeon.w}×${w.dungeon.h})</span>`
    : `<span style="color:#7a92aa">Nenhum mapa gerado</span>`;
  const mapOpts = [
    { v:'procedural', ico:'🎲', label:'Procedural' },
    { v:'json',       ico:'📋', label:'JSON (IA)' },
    { v:'claude',     ico:'⚡', label:'Claude API' },
    { v:'editor',     ico:'✏', label:'Editor' }
  ];

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box" style="max-width:540px;width:100%;max-height:90vh;overflow-y:auto">
      <div class="avt-modal-header">
        <span>🚪 Nova Fase</span>
        <button onclick="_avtNfCancelar()" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body" style="display:flex;flex-direction:column;gap:14px">

        <!-- Informações básicas -->
        <div>
          <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Nome da fase</label>
          <input id="avt-nf-nome" value="${(w.nome||'').replace(/"/g,'&quot;')}" placeholder="Ex: Caverna do Norte"
            style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.78rem"
            oninput="AVT_STATE._novaFaseWizard.nome=this.value">
        </div>

        <!-- Tipo de bloqueio -->
        <div>
          <label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:5px">Tipo de bloqueio da porta</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${[['livre','🔓 Livre'],['chave','🔑 Chave'],['npc','⚔ Derrotar Boss']].map(([val,lbl])=>`
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.73rem;color:#c8d8e8">
                <input type="radio" name="avt-nf-lock" value="${val}" ${w.lock_type===val?'checked':''} onchange="_avtNfLockChange(this.value)"> ${lbl}
              </label>`).join('')}
          </div>
          <div id="avt-nf-extra" style="margin-top:8px">
            ${w.lock_type==='chave'?`<input id="avt-nf-chave" value="${(w.chave_palavra||'').replace(/"/g,'&quot;')}" placeholder="Palavra-chave (ex: chave_dourada)"
              oninput="AVT_STATE._novaFaseWizard.chave_palavra=this.value"
              style="width:100%;box-sizing:border-box;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">`:
            w.lock_type==='npc'?`<select id="avt-nf-npc" onchange="AVT_STATE._novaFaseWizard.npc_boss_id=this.value"
              style="width:100%;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${inimigos.length?inimigos.map(e=>`<option value="${e.id}" ${w.npc_boss_id===e.id?'selected':''}>${e.nome}${e.isBoss?' 👑':''} (${e.hp} HP)</option>`).join('')
                :'<option value="">— nenhum NPC na cena —</option>'}</select>`:''}
          </div>
        </div>

        <!-- Mapa -->
        <div>
          <div style="font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Mapa da Fase</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            ${mapOpts.map(o=>`
              <div onclick="_avtNfSelecionarMapa('${o.v}')"
                style="padding:8px 4px;text-align:center;border-radius:7px;border:1px solid ${w.mapaOpcao===o.v?'rgba(79,163,209,0.6)':'rgba(255,255,255,0.08)'};background:${w.mapaOpcao===o.v?'rgba(79,163,209,0.12)':'rgba(255,255,255,0.02)'};cursor:pointer">
                <div style="font-size:1.2rem;margin-bottom:3px">${o.ico}</div>
                <div style="font-size:0.62rem;color:#c8d8e8">${o.label}</div>
              </div>`).join('')}
          </div>
          <div id="avt-nf-mapa-sub"></div>
          <div style="font-size:0.68rem;margin-top:6px">${mapaLabel}</div>
        </div>

        <!-- Porta -->
        <div>
          <div style="font-size:0.65rem;color:rgba(79,163,209,0.7);font-family:var(--fonte-d);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Posição da Porta no Mapa Atual</div>
          <div style="display:flex;align-items:center;gap:10px">
            <button class="avt-mp-btn" onclick="_avtNfIniciarPlacement()">📍 Clique no mapa para definir</button>
            <span style="font-size:0.72rem">${portaLabel}</span>
          </div>
        </div>

      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="avt-mp-btn" onclick="_avtNfCancelar()">Cancelar</button>
        <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtMestreSalvarNovaFase()">✓ Criar Fase</button>
      </div>
    </div>`;
  _avtNfRenderMapaSub(w.mapaOpcao);
}

function _avtNfCancelar() {
  AVT_STATE._novaFaseWizard = null;
  AVT_STATE._modoPortaPlacement = false;
  if (AVT_STATE.canvas) AVT_STATE.canvas.style.cursor = '';
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _avtNfLockChange(val) {
  if (!AVT_STATE._novaFaseWizard) return;
  AVT_STATE._novaFaseWizard.lock_type = val;
  const extra = document.getElementById('avt-nf-extra');
  if (!extra) return;
  const inimigos = AVT_STATE.entidades.filter(e => e.tipo === 'inimigo');
  if (val === 'chave') {
    extra.innerHTML = `<input id="avt-nf-chave" value="${(AVT_STATE._novaFaseWizard.chave_palavra||'').replace(/"/g,'&quot;')}" placeholder="Palavra-chave (ex: chave_dourada)"
      oninput="AVT_STATE._novaFaseWizard.chave_palavra=this.value"
      style="width:100%;box-sizing:border-box;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem">`;
  } else if (val === 'npc') {
    extra.innerHTML = `<select id="avt-nf-npc" onchange="AVT_STATE._novaFaseWizard.npc_boss_id=this.value"
      style="width:100%;padding:5px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
      ${inimigos.length?inimigos.map(e=>`<option value="${e.id}">${e.nome}${e.isBoss?' 👑':''} (${e.hp} HP)</option>`).join('')
        :'<option value="">— nenhum NPC na cena —</option>'}</select>`;
  } else {
    extra.innerHTML = '';
  }
}

function _avtNfSelecionarMapa(opcao) {
  if (!AVT_STATE._novaFaseWizard) return;
  AVT_STATE._novaFaseWizard.mapaOpcao = opcao;
  // Update option card styles
  const grid = document.querySelector('#avt-nf-mapa-sub')?.parentElement?.querySelector('[style*="grid-template-columns"]');
  if (grid) {
    [...grid.children].forEach((el, i) => {
      const opts = ['procedural','json','claude','editor'];
      const sel = opts[i] === opcao;
      el.style.border = `1px solid ${sel?'rgba(79,163,209,0.6)':'rgba(255,255,255,0.08)'}`;
      el.style.background = sel?'rgba(79,163,209,0.12)':'rgba(255,255,255,0.02)';
    });
  }
  _avtNfRenderMapaSub(opcao);
}

function _avtNfRenderMapaSub(opcao) {
  const sub = document.getElementById('avt-nf-mapa-sub');
  if (!sub) return;
  const w = AVT_STATE._novaFaseWizard;
  const inp = `style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"`;

  if (opcao === 'procedural') {
    sub.innerHTML = `<div style="padding:10px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.12);border-radius:7px">
      <div style="font-size:0.72rem;color:#c8d8e8;margin-bottom:8px">Dungeon BSP aleatória. Número de salas:</div>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="range" min="3" max="30" value="${w._procSalas||8}" style="flex:1;accent-color:#4fa3d1"
          oninput="AVT_STATE._novaFaseWizard._procSalas=+this.value;document.getElementById('avt-nf-salas-val').textContent=this.value">
        <span id="avt-nf-salas-val" style="font-family:var(--fonte-d);color:#c8a84b;min-width:24px">${w._procSalas||8}</span>
        <span style="font-size:0.65rem;color:#7a92aa">salas</span>
      </div>
      <button class="avt-mp-btn avt-mp-btn-ok" style="margin-top:8px;width:100%" onclick="_avtNfGerarProcedural()">🎲 Pré-visualizar mapa</button>
    </div>`;
  } else if (opcao === 'json') {
    sub.innerHTML = `<div>
      <textarea id="avt-nf-json-input" rows="5" placeholder='Cole aqui o JSON gerado pela IA...'
        style="width:100%;box-sizing:border-box;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-family:monospace;font-size:0.68rem;resize:vertical"
        oninput="_avtNfJsonParse(this.value)"></textarea>
      <div id="avt-nf-json-status" style="font-size:0.68rem;color:#7a92aa;margin-top:4px"></div>
    </div>`;
  } else if (opcao === 'claude') {
    sub.innerHTML = `<div style="display:flex;flex-direction:column;gap:7px">
      <input id="avt-nf-claude-key" type="password" placeholder="Claude API Key (sk-ant-...)"
        value="${(localStorage.getItem('animgen_claude_key')||'').replace(/"/g,'&quot;')}" ${inp}>
      <input id="avt-nf-claude-desc" placeholder="Descreva a fase (ex: Vila abandonada com fantasmas)"
        value="${(w._claudeDesc||'').replace(/"/g,'&quot;')}"
        oninput="AVT_STATE._novaFaseWizard._claudeDesc=this.value" ${inp}>
      <button id="avt-nf-claude-btn" class="avt-mp-btn avt-mp-btn-ok" style="width:100%" onclick="_avtNfGerarComClaude()">⚡ Gerar mapa com Claude</button>
      <div id="avt-nf-claude-status" style="font-size:0.68rem;color:#7a92aa"></div>
    </div>`;
  } else if (opcao === 'editor') {
    sub.innerHTML = `<div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;align-items:center">
        <span style="font-size:0.65rem;color:#7a92aa">Tamanho:</span>
        <select id="avt-nf-ed-tamanho" onchange="_avtNfEditorTamanho(this.value)"
          style="padding:3px 6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.68rem">
          <option value="22x16">22×16</option>
          <option value="40x28" selected>40×28</option>
          <option value="60x40">60×40</option>
        </select>
        <button onclick="_avtNfEditorAcao('piso')" class="avt-ed-btn avt-ed-btn-ativo" id="avt-nf-btn-piso">Piso</button>
        <button onclick="_avtNfEditorAcao('parede')" class="avt-ed-btn" id="avt-nf-btn-parede">Parede</button>
        <button onclick="_avtNfEditorLimpar()" class="avt-ed-btn">Limpar</button>
        <button onclick="_avtNfEditorExport()" class="avt-mp-btn avt-mp-btn-ok" style="font-size:0.65rem;padding:3px 10px">✓ Usar este mapa</button>
      </div>
      <div style="overflow:auto;max-height:220px;border:1px solid rgba(79,163,209,0.12);border-radius:5px">
        <canvas id="avt-nf-ed-canvas" style="cursor:crosshair;display:block;touch-action:none"></canvas>
      </div>
    </div>`;
    setTimeout(_avtNfEditorInit, 50);
  }
}

function _avtNfGerarProcedural() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const salas = w._procSalas || 8;
  const area = Math.max(22 * 16, salas * 60);
  const ww = Math.ceil(Math.sqrt(area * (22 / 16)));
  const hh = Math.ceil(area / ww);
  w.dungeon = _avtGerarDungeon(ww, hh, salas);
  const el = document.querySelector('#avt-nf-mapa-sub');
  if (el) {
    const st = document.createElement('div');
    st.style.cssText = 'font-size:0.68rem;color:#27ae60;margin-top:6px';
    st.textContent = `✓ Mapa gerado — ${w.dungeon.w}×${w.dungeon.h} tiles, ${salas} salas`;
    el.appendChild(st);
  }
  // Update status label
  const lbl = document.querySelector('[id="avt-anim-import-overlay"] .avt-modal-body > div:nth-child(3) > div:last-child');
  _avtMestreNovaFaseRender();
  mostrarToast('Mapa procedural gerado!', 'ok');
}

function _avtNfJsonParse(txt) {
  const st = document.getElementById('avt-nf-json-status');
  if (!txt.trim()) { if (st) st.textContent = ''; return; }
  try {
    const json = JSON.parse(txt);
    const dungeon = _avtJsonToDungeon(json);
    AVT_STATE._novaFaseWizard.dungeon = dungeon;
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa válido — ${dungeon.w}×${dungeon.h} tiles</span>`;
  } catch(e) {
    AVT_STATE._novaFaseWizard.dungeon = null;
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ JSON inválido: ${e.message}</span>`;
  }
}

async function _avtNfGerarComClaude() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const key = document.getElementById('avt-nf-claude-key')?.value?.trim() || localStorage.getItem('animgen_claude_key') || '';
  if (!key) { mostrarToast('Insira a Claude API Key', 'aviso'); return; }
  const desc = document.getElementById('avt-nf-claude-desc')?.value?.trim() || 'Uma dungeon com inimigos variados';
  w._claudeDesc = desc;
  const params = { w: 40, h: 28, salas: 10 };
  const btn = document.getElementById('avt-nf-claude-btn');
  const st = document.getElementById('avt-nf-claude-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando…'; }
  if (st) st.textContent = `Gerando dungeon ${params.w}×${params.h}…`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:8192,
        system:'Você é um gerador de mapas de dungeon para jogos RPG top-down. Retorne APENAS um JSON válido, sem texto adicional.',
        messages:[{ role:'user', content:`Gere um mapa de dungeon: "${desc}"\n\n${_avtGerarPromptJson(params)}` }]
      })
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err?.error?.message||`HTTP ${res.status}`); }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Resposta sem JSON válido');
    const dungeon = _avtJsonToDungeon(JSON.parse(match[0]));
    w.dungeon = dungeon;
    localStorage.setItem('animgen_claude_key', key);
    if (st) st.innerHTML = `<span style="color:#27ae60">✓ Mapa gerado — ${dungeon.w}×${dungeon.h} tiles</span>`;
    mostrarToast('Mapa gerado com Claude!', 'ok');
  } catch(e) {
    if (st) st.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
    mostrarToast('Erro Claude: ' + e.message, 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Gerar mapa com Claude'; }
  }
}

// Minimal canvas editor for nova fase
const _avtNfEd = { tiles: null, w: 40, h: 28, acao: 'piso', drawing: false };
function _avtNfEditorInit() {
  const canvas = document.getElementById('avt-nf-ed-canvas');
  if (!canvas) return;
  canvas.width = _avtNfEd.w * 12; canvas.height = _avtNfEd.h * 12;
  if (!_avtNfEd.tiles) _avtNfEd.tiles = Array.from({length:_avtNfEd.h}, ()=>Array(_avtNfEd.w).fill(AVT_T.PAREDE));
  _avtNfEditorDraw();
  const paint = e => {
    const r = canvas.getBoundingClientRect();
    const cw = r.width/_avtNfEd.w, ch = r.height/_avtNfEd.h;
    const tx = Math.floor((e.clientX-r.left)/cw), ty = Math.floor((e.clientY-r.top)/ch);
    if (tx>=0&&tx<_avtNfEd.w&&ty>=0&&ty<_avtNfEd.h) {
      _avtNfEd.tiles[ty][tx] = _avtNfEd.acao==='piso' ? AVT_T.PISO : AVT_T.PAREDE;
      _avtNfEditorDraw();
    }
  };
  canvas.onmousedown = e => { _avtNfEd.drawing=true; paint(e); };
  canvas.onmousemove = e => { if(_avtNfEd.drawing) paint(e); };
  canvas.onmouseup = () => { _avtNfEd.drawing=false; };
}
function _avtNfEditorDraw() {
  const canvas = document.getElementById('avt-nf-ed-canvas');
  if (!canvas||!_avtNfEd.tiles) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width/_avtNfEd.w, ch = canvas.height/_avtNfEd.h;
  for (let y=0;y<_avtNfEd.h;y++) for (let x=0;x<_avtNfEd.w;x++) {
    ctx.fillStyle = _avtNfEd.tiles[y][x]===AVT_T.PISO?'#1a2535':'#0a0c14';
    ctx.fillRect(x*cw,y*ch,cw,ch);
  }
}
function _avtNfEditorAcao(a) {
  _avtNfEd.acao = a;
  ['piso','parede'].forEach(k => {
    const b = document.getElementById('avt-nf-btn-'+k);
    if (b) b.classList.toggle('avt-ed-btn-ativo', k===a);
  });
}
function _avtNfEditorTamanho(v) {
  const [ww,hh] = v.split('x').map(Number);
  _avtNfEd.w=ww; _avtNfEd.h=hh;
  _avtNfEd.tiles = Array.from({length:hh},()=>Array(ww).fill(AVT_T.PAREDE));
  const c = document.getElementById('avt-nf-ed-canvas');
  if (c) { c.width=ww*12; c.height=hh*12; }
  _avtNfEditorDraw();
}
function _avtNfEditorLimpar() {
  _avtNfEd.tiles = Array.from({length:_avtNfEd.h},()=>Array(_avtNfEd.w).fill(AVT_T.PAREDE));
  _avtNfEditorDraw();
}
function _avtNfEditorExport() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w||!_avtNfEd.tiles) return;
  w.dungeon = { tiles:_avtNfEd.tiles.map(r=>[...r]), w:_avtNfEd.w, h:_avtNfEd.h, rooms:[] };
  mostrarToast('Mapa do editor definido!', 'ok');
  _avtMestreNovaFaseRender();
}

function _avtNfIniciarPlacement() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  // Save current nome to wizard state before hiding overlay
  w.nome = document.getElementById('avt-nf-nome')?.value?.trim() || w.nome;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (overlay) overlay.style.display = 'none';
  AVT_STATE._modoPortaPlacement = true;
  if (AVT_STATE.canvas) AVT_STATE.canvas.style.cursor = 'crosshair';
  mostrarToast('📍 Clique no mapa para posicionar a porta da nova fase', 'ok');
}

async function _avtMestreSalvarNovaFase() {
  const w = AVT_STATE._novaFaseWizard;
  if (!w) return;
  const nome = (document.getElementById('avt-nf-nome')?.value?.trim() || w.nome || '').trim();
  if (!nome) { mostrarToast('Informe o nome da fase', 'aviso'); return; }
  if (w.porta_col == null || w.porta_row == null) { mostrarToast('Defina a posição da porta clicando no mapa', 'aviso'); return; }

  // Resolve dungeon_data
  let dungeonData = w.dungeon;
  if (!dungeonData) {
    if (w.mapaOpcao === 'procedural') {
      const salas = w._procSalas || 8;
      const area = Math.max(22*16, salas*60);
      const ww = Math.ceil(Math.sqrt(area*(22/16))); const hh = Math.ceil(area/ww);
      dungeonData = _avtGerarDungeon(ww, hh, salas);
    } else {
      mostrarToast('Gere ou configure o mapa antes de criar a fase', 'aviso'); return;
    }
  }

  // Place SAIDA tile in last room of new phase's dungeon
  if (dungeonData.rooms?.length > 0) {
    const lastRoom = dungeonData.rooms[dungeonData.rooms.length - 1];
    const sx = lastRoom.cx ?? lastRoom.x, sy = lastRoom.cy ?? lastRoom.y;
    if (dungeonData.tiles[sy]?.[sx] !== undefined) dungeonData.tiles[sy][sx] = AVT_T.SAIDA;
  }

  const fase = {
    id: Date.now().toString(),
    nome,
    dungeon_data: dungeonData,
    porta: { col: w.porta_col, row: w.porta_row, lock_type: w.lock_type, chave_palavra: w.chave_palavra, npc_boss_id: w.npc_boss_id }
  };

  if (!AVT_STATE.rpg.theme_json) AVT_STATE.rpg.theme_json = {};
  AVT_STATE.rpg.theme_json.fases_extras = [...(AVT_STATE.rpg.theme_json.fases_extras || []), fase];

  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method:'PATCH', body:JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
    });
    AVT_STATE._novaFaseWizard = null;
    document.getElementById('avt-anim-import-overlay').style.display = 'none';
    mostrarToast(`Fase "${nome}" criada!`, 'ok');
    _avtMestrePainelRender();
    // Navigate mestre directly to the new phase
    _avtEntrarFaseExtra(fase);
  } catch(e) {
    mostrarToast('Erro ao salvar fase: ' + (e?.message || e), 'erro');
  }
}

async function _avtMestreRemoverFase(faseId) {
  if (!confirm('Remover esta fase?')) return;
  const extras = (AVT_STATE.rpg.theme_json.fases_extras || []).filter(f => f.id !== faseId);
  AVT_STATE.rpg.theme_json.fases_extras = extras;
  try {
    await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
      method: 'PATCH', body: JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
    });
    mostrarToast('Fase removida', 'ok');
    _avtMestrePainelRender();
  } catch(e) {
    mostrarToast('Erro: ' + (e?.message || e), 'erro');
  }
}

// ─── Verificação de porta ao mover ───────────────────────────────────────────
function _avtVerificarPortaFase(x, y) {
  const fases = AVT_STATE.rpg?.theme_json?.fases_extras;
  if (!fases?.length) return;
  const fase = fases.find(f => f.porta.col === x && f.porta.row === y);
  if (!fase) return;
  const p = fase.porta;
  if (p.lock_type === 'npc') {
    const vivo = AVT_STATE.entidades.find(e => e.id === p.npc_boss_id && e.hp > 0);
    if (vivo) { mostrarToast(`Derrote ${vivo.nome} primeiro!`, 'aviso'); return; }
  }
  if (p.lock_type === 'chave') {
    const jog = _avtMeuJogador();
    const chaves = jog?.custom_attrs?.chaves_coletadas || jog?.custom_attrs?.chaves || [];
    const tem = chaves.some(c => (typeof c === 'string' ? c : c.chave_palavra) === p.chave_palavra);
    if (!tem) { mostrarToast(`Precisas de: ${p.chave_palavra}`, 'aviso'); return; }
  }
  _avtEntrarFaseExtra(fase);
}

async function _avtEntrarFaseExtra(fase) {
  if (!fase.dungeon_data) {
    fase.dungeon_data = _avtGerarDungeon(40, 28, 6);
    // Place SAIDA tile in last room
    if (fase.dungeon_data.rooms?.length > 0) {
      const lr = fase.dungeon_data.rooms[fase.dungeon_data.rooms.length - 1];
      const sx = lr.cx ?? lr.x, sy = lr.cy ?? lr.y;
      if (fase.dungeon_data.tiles[sy]?.[sx] !== undefined) fase.dungeon_data.tiles[sy][sx] = AVT_T.SAIDA;
    }
    const extras = AVT_STATE.rpg.theme_json.fases_extras.map(f =>
      f.id === fase.id ? { ...f, dungeon_data: fase.dungeon_data } : f
    );
    AVT_STATE.rpg.theme_json.fases_extras = extras;
    try {
      await _avtSb(`rpg_registry?rpg_id=eq.${encodeURIComponent(AVT_STATE.rpgId)}`, {
        method: 'PATCH', body: JSON.stringify({ theme_json: AVT_STATE.rpg.theme_json })
      });
    } catch(e) { /* continua mesmo sem persistir */ }
  }

  // Salvar estado completo da fase atual antes de trocar
  const jogador = _avtMeuJogador();
  AVT_STATE._faseAnterior = {
    dungeon:    AVT_STATE.dungeon,
    entidades:  AVT_STATE.entidades.map(e => ({ ...e })),
    npcTimers:  { ...AVT_STATE.npcTimers },
    faseId:     AVT_STATE._faseAtualId || 'principal'
  };

  // Trocar dungeon
  AVT_STATE.dungeon = fase.dungeon_data;
  AVT_STATE._faseAtualId = fase.id;

  // Na nova fase: apenas o jogador que cruzou a porta + inimigos próprios da fase
  const jogadorNaFase = jogador ? { ...jogador } : null;
  AVT_STATE.entidades = [];
  AVT_STATE.npcTimers = {};

  if (jogadorNaFase) {
    // Posicionar no spawn da nova fase
    const spawns = fase.dungeon_data._spawnJogadores;
    const sala   = fase.dungeon_data.rooms?.[0];
    if (spawns?.length) {
      jogadorNaFase.x = spawns[0].x;
      jogadorNaFase.y = spawns[0].y;
    } else if (sala) {
      jogadorNaFase.x = sala.cx != null ? sala.cx : sala.x;
      jogadorNaFase.y = sala.cy != null ? sala.cy : sala.y;
    }
    AVT_STATE.entidades.push(jogadorNaFase);
  }

  // Inimigos próprios desta fase
  _avtPopularEntidadesInimigos(fase.dungeon_data);

  mostrarToast(`Entrando: ${fase.nome}`, 'ok');
  _avtCameraUpdate();
  _avtMestrePainelRender();
}

function _avtVerificarSaida(x, y) {
  if (!AVT_STATE._faseAnterior) return;
  const tile = AVT_STATE.dungeon?.tiles?.[y]?.[x];
  if (tile === AVT_T.SAIDA) {
    if (confirm('🚪 Sair desta fase e voltar ao mapa anterior?')) _avtVoltarFaseAnterior();
  }
}

function _avtVoltarFaseAnterior() {
  if (!AVT_STATE._faseAnterior) return;

  // Capturar posição atual do jogador na fase extra para atualizar no mapa anterior
  const jogadorNaFase = _avtMeuJogador();

  // Restaurar estado da fase anterior
  AVT_STATE.dungeon    = AVT_STATE._faseAnterior.dungeon;
  AVT_STATE.entidades  = AVT_STATE._faseAnterior.entidades.map(e => ({ ...e }));
  AVT_STATE.npcTimers  = { ...AVT_STATE._faseAnterior.npcTimers };
  AVT_STATE._faseAtualId = AVT_STATE._faseAnterior.faseId || 'principal';
  AVT_STATE._faseAnterior = null;

  // Mover o jogador de volta para perto da porta de entrada (fase principal)
  const jogadorRestaurado = jogadorNaFase
    ? AVT_STATE.entidades.find(e => e.id === jogadorNaFase.id)
    : null;
  if (jogadorRestaurado) {
    // Posicionar ao lado da porta usada para entrar
    const portaFase = (AVT_STATE.rpg?.theme_json?.fases_extras || [])
      .find(f => f.id === AVT_STATE._faseAtualId);
    if (portaFase) {
      jogadorRestaurado.x = portaFase.porta.col + 1;
      jogadorRestaurado.y = portaFase.porta.row;
    } else if (AVT_STATE.dungeon?.rooms?.length) {
      const sala = AVT_STATE.dungeon.rooms[0];
      jogadorRestaurado.x = sala.cx != null ? sala.cx : sala.x;
      jogadorRestaurado.y = sala.cy != null ? sala.cy : sala.y;
    }
  }

  mostrarToast('Voltou ao mapa anterior', 'ok');
  _avtCameraUpdate();
  _avtMestrePainelRender();
}

function _avtMestreGerarPersonagensExterno() {
  const dungeon = AVT_STATE.dungeon;
  const nInimigos = dungeon?._inimigosJson?.length || AVT_STATE.entidades.filter(e => e.tipo === 'inimigo').length || 0;
  const hpMedio = nInimigos > 0
    ? Math.round(AVT_STATE.entidades.filter(e => e.tipo === 'inimigo').reduce((s, e) => s + e.hpMax, 0) / nInimigos)
    : 20;
  const temBoss = AVT_STATE.entidades.some(e => e.isBoss);
  const prompt = _avtMontarPromptPersonagens(
    [{ nome: 'Personagem/NPC', descricao: 'descreva na IA o tipo de personagem, NPC ou boss que quer gerar' }],
    { _inimigosJson: AVT_STATE.entidades.filter(e => e.tipo === 'inimigo').map(e => ({ hp: e.hpMax, isBoss: e.isBoss })) }
  );

  const overlayId = 'avt-mp-ia-ext-overlay';
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="background:#0d1520;border:1px solid rgba(79,163,209,0.25);border-radius:12px;padding:18px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-family:var(--fonte-d);font-size:0.78rem;color:#4fa3d1;letter-spacing:.08em">🌐 GERAR VIA IA EXTERNA</span>
        <button onclick="document.getElementById('${overlayId}').remove()"
          style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1rem">✕</button>
      </div>
      <div style="font-size:0.7rem;color:#7a92aa;margin-bottom:10px;line-height:1.5">
        Copie o prompt, abra Claude.ai ou ChatGPT e descreva o personagem/NPC/boss que quer gerar. Cole o JSON retornado abaixo.
      </div>
      <button onclick="navigator.clipboard.writeText(document.getElementById('avt-mp-ia-prompt').value).then(()=>mostrarToast('📋 Prompt copiado!','ok'))"
        style="width:100%;padding:6px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:6px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.68rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        📋 Copiar prompt
      </button>
      <textarea id="avt-mp-ia-prompt" rows="4" readonly
        style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(10,15,24,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:#7a92aa;font-family:monospace;font-size:0.6rem;resize:none;line-height:1.4;margin-bottom:10px"
      >${prompt.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      <div style="font-size:0.68rem;color:#c8a84b;font-weight:600;margin-bottom:4px">Cole o JSON retornado:</div>
      <textarea id="avt-mp-ia-json" rows="5" placeholder='[{"nome":"...","hp_max":60,"habilidades":[...],...}]'
        style="width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(10,15,24,0.8);border:1px solid rgba(79,163,209,0.15);border-radius:5px;color:#c8d8e8;font-family:monospace;font-size:0.63rem;resize:vertical;line-height:1.4;margin-bottom:8px"></textarea>
      <div id="avt-mp-ia-status" style="font-size:0.68rem;margin-bottom:8px"></div>
      <button onclick="_avtMestreAplicarPersonagensExterno()"
        style="width:100%;padding:8px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:#4fa3d1;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:.06em">
        ✓ Aplicar ao dungeon
      </button>
    </div>`;
  overlay.style.display = 'flex';
}

function _avtMestreAplicarPersonagensExterno() {
  const val = document.getElementById('avt-mp-ia-json')?.value?.trim() || '';
  const status = document.getElementById('avt-mp-ia-status');
  if (!val) { if (status) status.innerHTML = '<span style="color:#e74c3c">Cole o JSON primeiro</span>'; return; }
  try {
    const match = val.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Sem array JSON [ ]');
    const gerados = JSON.parse(match[0]);
    if (!Array.isArray(gerados) || !gerados.length) throw new Error('Array vazio');

    const cores = ['#e8604c','#7b2fbe','#27ae60','#c8a84b','#4fa3d1'];
    gerados.forEach((g, i) => {
      const hpMax = g.hp_max || 60;
      const isBoss = g.aparencia_tipo === 'boss' || g.classe_aventura === 'boss' || (g.nome||'').toLowerCase().includes('boss');
      const ent = {
        id: 'ext_' + Date.now() + '_' + i,
        nome: g.nome || `Personagem ${i+1}`,
        tipo: isBoss || g.aparencia_tipo?.includes('inimigo') ? 'inimigo' : 'jogador',
        x: (AVT_STATE.dungeon?.rooms?.[0]?.cx ?? 5) + i,
        y: AVT_STATE.dungeon?.rooms?.[0]?.cy ?? 5,
        hp: hpMax, hpMax,
        cor: g.cor || cores[i % cores.length],
        isBoss, _semNome: false,
        pacienciaSecs: g.pacienciaSecs ?? 5,
        deteccaoRaio: g.deteccaoRaio ?? 3,
        xpBase: isBoss ? 50 : 10,
        presetTipo: g.aparencia_tipo || 'npc_generico',
        _atributosIA: g.atributos || {},
        _habilidadesIA: g.habilidades || []
      };
      AVT_STATE.entidades.push(ent);
      if (ent.tipo === 'inimigo') _avtInitNpcTimer(ent);
    });

    if (status) status.innerHTML = `<span style="color:#27ae60">✓ ${gerados.length} entidade(s) adicionada(s) ao mapa</span>`;
    mostrarToast(`✓ ${gerados.length} personagem(ns) adicionado(s)!`, 'sucesso');
    setTimeout(() => {
      document.getElementById('avt-mp-ia-ext-overlay')?.remove();
      _avtMestrePainelRender();
    }, 1200);
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:#e74c3c">✗ ${e.message}</span>`;
  }
}

function _avtMestreAssumir() {
  const sel = document.getElementById('avt-mp-npc-sel');
  if (!sel?.value) return;
  AVT_STATE.npcControlando = sel.value;
  AVT_STATE.npcIaAtiva = false;
  mostrarToast('🎮 Controlando: ' + (sel.options[sel.selectedIndex]?.text?.split('(')[0].trim()||'NPC'), 'ok');
  _avtMestrePainelRender();
}

function _avtMestreIniciarRepos() {
  const sel = document.getElementById('avt-mp-repos-sel');
  if (!sel?.value) { mostrarToast('Selecione uma entidade para reposicionar', 'aviso'); return; }
  AVT_STATE.mestreReposicionando = sel.value;
  const ent = AVT_STATE.entidades.find(e => e.id === sel.value);
  mostrarToast(`📍 Clique no mapa para mover ${ent?.nome || 'entidade'}`, 'ok');
  avtMestrePainel(); // close panel so player can click on map
}

function _avtPassarTurnoBatalha(batalhaId) {
  const bat = AVT_STATE.batalhas.find(b => b.id === batalhaId);
  if (!bat) return;
  const ativo = bat.iniciativa[bat.turnoIdx];
  if (ativo) _avtLog(`${ativo.nome} passa o turno`, bat.id);
  _avtTurnoAvancar(bat);
  _avtMestrePainelRender();
}

function _avtMestreAddInimigo() {
  const d = AVT_STATE.dungeon; if (!d) return;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box">
      <div class="avt-modal-header">
        <span>👹 Adicionar NPC / Boss</span>
        <button onclick="document.getElementById('avt-anim-import-overlay').style.display='none'" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body" style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:0.7rem;color:#7a92aa">Escolha um tipo ou personalize abaixo:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="avt-npc-presets">
          ${Object.entries(AVT_NPC_PRESETS).map(([k,p])=>`
            <button onclick="_avtNpcPresetSel('${k}')"
              style="padding:6px 10px;border-radius:6px;border:1px solid ${p.isBoss?'rgba(231,76,60,0.4)':'rgba(79,163,209,0.2)'};background:rgba(255,255,255,0.03);color:#c8d8e8;cursor:pointer;font-size:0.72rem;font-family:var(--fonte-d)">
              ${p.icone} ${p.nome}${p.isBoss?' 👑':''}
            </button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Nome</label>
            <input id="avt-npc-nome" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem" placeholder="Goblin"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">HP</label>
            <input id="avt-npc-hp" type="number" min="1" max="9999" value="20" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Paciência (seg)</label>
            <input id="avt-npc-pac" type="number" min="0.5" max="60" value="5" step="0.5" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Raio de Detecção</label>
            <input id="avt-npc-raio" type="number" min="1" max="15" value="3" style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><label style="font-size:0.62rem;color:#7a92aa;display:block;margin-bottom:3px">Cor</label>
            <input id="avt-npc-cor" type="color" value="#7a5c00" style="width:100%;height:30px;border:1px solid rgba(79,163,209,0.2);border-radius:5px;background:#0a0f18;cursor:pointer"></div>
          <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
            <input type="checkbox" id="avt-npc-boss" style="cursor:pointer">
            <label for="avt-npc-boss" style="font-size:0.72rem;color:#c8d8e8;cursor:pointer">Boss 👑</label>
          </div>
        </div>
      </div>
      <div class="avt-modal-footer">
        <button class="avt-mp-btn" onclick="document.getElementById('avt-anim-import-overlay').style.display='none'">Cancelar</button>
        <button class="avt-mp-btn" onclick="_avtNpcConfirmarAdd()">+ Adicionar ao Mapa</button>
      </div>
    </div>`;
}

function _avtNpcPresetSel(key) {
  const p = AVT_NPC_PRESETS[key]; if (!p) return;
  const n = document.getElementById('avt-npc-nome'); if (n) n.value = p.nome;
  const h = document.getElementById('avt-npc-hp'); if (h) h.value = p.hpBase;
  const pa = document.getElementById('avt-npc-pac'); if (pa) pa.value = p.pacienciaSecs;
  const r = document.getElementById('avt-npc-raio'); if (r) r.value = p.deteccaoRaio;
  const b = document.getElementById('avt-npc-boss'); if (b) b.checked = !!p.isBoss;
}

function _avtNpcConfirmarAdd() {
  const d = AVT_STATE.dungeon; if (!d) return;
  const pisos = [];
  for (let y=0;y<d.h;y++) for (let x=0;x<d.w;x++)
    if (_avtTilePassavel(x, y, d) && !AVT_STATE.entidades.some(e=>e.x===x&&e.y===y))
      pisos.push({x,y});
  if (!pisos.length) { mostrarToast('Sem espaço no mapa', 'aviso'); return; }
  const pos = pisos[Math.floor(Math.random()*pisos.length)];
  const nome = document.getElementById('avt-npc-nome')?.value?.trim() || 'Inimigo';
  const hp   = parseInt(document.getElementById('avt-npc-hp')?.value) || 20;
  const pac  = parseFloat(document.getElementById('avt-npc-pac')?.value) || 5;
  const raio = parseInt(document.getElementById('avt-npc-raio')?.value) || 3;
  const cor  = document.getElementById('avt-npc-cor')?.value || '#7a5c00';
  const isBoss = document.getElementById('avt-npc-boss')?.checked || false;
  const id = 'npc_' + Date.now();
  const ent = { id, nome, tipo:'inimigo', x:pos.x, y:pos.y, hp, hpMax:hp, cor, isBoss,
    pacienciaSecs:pac, deteccaoRaio:raio };
  AVT_STATE.entidades.push(ent);
  AVT_STATE.npcTimers[id] = { patience:pac*1000, maxPatience:pac*1000, ativo:false };
  document.getElementById('avt-anim-import-overlay').style.display = 'none';
  mostrarToast(`${nome} adicionado!`, 'ok');
}

function _avtNpcSetPaciencia(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.pacienciaSecs = val;
  const t = AVT_STATE.npcTimers[entId];
  if (t) { t.maxPatience = val * 1000; t.patience = Math.min(t.patience, t.maxPatience); }
}
function _avtNpcSetRaio(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.deteccaoRaio = val;
}
function _avtNpcSetBoss(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.isBoss = val;
}
function _avtNpcSetCor(entId, val) {
  const e = AVT_STATE.entidades.find(x => x.id === entId); if (!e) return;
  e.cor = val;
}

function _avtMestreToggleVisao() {
  AVT_STATE.mestreVisaoGeral = !AVT_STATE.mestreVisaoGeral;
  const d = AVT_STATE.dungeon; const cv = AVT_STATE.canvas;
  if (AVT_STATE.mestreVisaoGeral && d && cv?.width) {
    const zoom = Math.min(cv.width/(d.w*AVT_SZ), cv.height/(d.h*AVT_SZ)) * 0.92;
    AVT_STATE.camera.zoom = zoom;
    AVT_STATE.camera.x = (d.w*AVT_SZ*zoom - cv.width)/2;
    AVT_STATE.camera.y = (d.h*AVT_SZ*zoom - cv.height)/2;
  } else {
    AVT_STATE.camera.zoom = 1;
    _avtCameraCenter();
  }
  _avtMestrePainelRender();
}

function avtHudAtacarNpc() {
  const b = _avtMinhaBatalha();
  const ativo = _avtAtivo();
  if (!b || !ativo || ativo.tipo !== 'inimigo') return;
  const alvoId = document.getElementById('avt-hud-alvo')?.value;
  const alvo = b.iniciativa.find(e=>e.id===alvoId);
  if (!alvo || alvo.hp<=0) { mostrarToast('Selecione um alvo', 'aviso'); return; }
  _avtSetEntState(ativo.id, 'attack');
  const dano = _avtRolarFormula('1d8');
  const hitRoll = Math.floor(Math.random()*20)+1;
  if (hitRoll < 5) {
    _avtLog(`${ativo.nome} erra ${alvo.nome}! (${hitRoll})`, b.id);
    mostrarToast('💨 ' + ativo.nome + ' errou!', '');
  } else {
    const real = hitRoll >= 19 ? dano*2 : dano;
    alvo.hp = Math.max(0, alvo.hp - real);
    const entAlvo = AVT_STATE.entidades.find(e=>e.id===alvo.id);
    if (entAlvo) entAlvo.hp = alvo.hp;
    _avtLog('🎮 ' + ativo.nome + ' → ' + alvo.nome + ': ' + real + (hitRoll>=19?' (CRÍTICO)':''), b.id);
    mostrarToast(ativo.nome + ' ataca! -' + real + ' HP', 'aviso');
    _avtRenderHpBar();
    if (alvo.hp <= 0) { _avtLog('💀 ' + alvo.nome + ' caiu!', b.id); _avtCheckDerrota(b); }
  }
  _avtSetTimeout(() => _avtTurnoAvancar(b), 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER EDITOR (Diablo III layout)
// ─────────────────────────────────────────────────────────────────────────────

function abrirAvtCharEditor(entId) {
  AVT_STATE.charEditorId = entId;
  if (!AVT_STATE.charEditorTab) AVT_STATE.charEditorTab = 'attrs';
  const screen = document.getElementById('avt-char-editor');
  if (screen) screen.style.display = 'flex';
  _avtCharEditorRender();
}

function fecharAvtCharEditor() {
  const screen = document.getElementById('avt-char-editor');
  if (screen) screen.style.display = 'none';
  AVT_STATE.charEditorId = null;
}

function _avtDefaultAttrs() {
  return { forca:10, destreza:10, inteligencia:10, constituicao:10, sabedoria:10, carisma:10, pontos:6 };
}

function _avtCharEditorRender() {
  const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
  if (!ent) { fecharAvtCharEditor(); return; }
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome) || {};
  const ca = dbChar.custom_attrs || {};
  const attrs = ca.atributos || _avtDefaultAttrs();
  const isMestre = AVT_STATE.isMestre;
  const cor = ent.cor || '#4fa3d1';
  const isBoss = !!ent.isBoss;
  const nivel = dbChar.nivel || ent.nivel || 1;

  const fichaImg = ca.topdown_ia?.ficha_img_url
    || ca.aparencia?.img_iso
    || ca.aparencia?.img_frente
    || ca.img_full
    || ca.img_retrato
    || null;

  const hpPct = ent.hpMax > 0 ? Math.max(0, Math.min(100, ent.hp / ent.hpMax * 100)) : 0;
  const hpColor = hpPct > 50 ? '#27ae60' : hpPct > 25 ? '#c8a84b' : '#e74c3c';
  const tipoLabel = { jogador: 'Jogador', npc: 'NPC', criatura: 'Criatura', objeto: 'Objeto' }[ca.tipo || 'npc'] || 'Personagem';

  const left = document.getElementById('avt-ce-left');
  if (!left) return;

  const entIdSafe = ent.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const animData = ca.animado_data;
  const hasImage = fichaImg || animData;

  // — Imagem externa (fora do modal) —
  const extPortrait = document.getElementById('avt-ce2-ext-portrait');
  const outerWrap = extPortrait?.closest('.avt-ce2-outer-wrap');
  if (extPortrait) {
    if (hasImage) {
      extPortrait.style.display = '';
      outerWrap?.classList.add('tem-retrato');
      extPortrait.innerHTML = `
        <div class="avt-ce2-portrait-wrap" id="avt-ce2-portrait-wrap"
          ${isMestre ? `onclick="_avtCe2TrocarImagem('${entIdSafe}')"` : ''}>
          <div id="avt-ce2-portrait-inner" class="avt-ce2-portrait-inner">${fichaImg ? `<img src="${fichaImg}" alt="${ent.nome}" class="avt-ce2-portrait-img">` : ''}</div>
          ${isBoss ? `<div class="avt-ce2-boss-ribbon">👑 BOSS</div>` : ''}
          ${isMestre ? `<div class="avt-ce2-portrait-hover-overlay"><span style="font-size:1.4rem">🖼</span><span>Trocar Imagem</span></div>` : ''}
        </div>`;
      if (animData && typeof animRendererMount === 'function') {
        const wrap = extPortrait.querySelector('#avt-ce2-portrait-inner');
        if (wrap) animRendererMount(wrap, animData, { displayWidth: 220, displayHeight: 260 });
      }
    } else {
      extPortrait.style.display = 'none';
      extPortrait.innerHTML = '';
      outerWrap?.classList.remove('tem-retrato');
    }
  }

  // — Sidebar esquerda (dentro do modal, sem portrait) —
  left.innerHTML = `
    <div class="avt-ce2-sidebar-body">
      <div class="avt-ce2-char-name" style="color:${cor}">${ent.nome}${isBoss ? ' 👑' : ''}</div>
      <div class="avt-ce2-badges-row">
        <span class="avt-ce2-badge" style="color:${cor};border-color:${cor}40;background:${cor}10">${tipoLabel}</span>
        ${ent.tipo === 'inimigo' ? `<span class="avt-ce2-badge" style="color:#e74c3c;border-color:#e74c3c40;background:#e74c3c10">Inimigo</span>` : ''}
        ${nivel > 1 ? `<span class="avt-ce2-badge" style="color:#c8a84b;border-color:#c8a84b40;background:#c8a84b10">Nv ${nivel}</span>` : ''}
      </div>

      <div class="avt-ce2-stat-label-row">
        <span style="font-size:0.65rem;color:#7a92aa">❤ HP</span>
        <span style="font-family:var(--fonte-d);font-size:0.78rem;color:${hpColor}">${ent.hp} / ${ent.hpMax}</span>
      </div>
      <div class="avt-ce2-bar-track" style="margin-bottom:${isMestre ? '8px' : '14px'}">
        <div class="avt-ce2-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
      </div>

      ${isMestre ? `
      <div class="avt-ce2-hp-btns">
        <button class="avt-ce2-mini-btn avt-ce2-mini-danger" onclick="_avtCe2HpDelta('${entIdSafe}',-5)">−5</button>
        <button class="avt-ce2-mini-btn avt-ce2-mini-danger" onclick="_avtCe2HpDelta('${entIdSafe}',-1)">−1</button>
        <button class="avt-ce2-mini-btn avt-ce2-mini-ok" onclick="_avtCe2HpDelta('${entIdSafe}',1)">+1</button>
        <button class="avt-ce2-mini-btn avt-ce2-mini-ok" onclick="_avtCe2HpDelta('${entIdSafe}',5)">+5</button>
      </div>` : ''}

      ${isMestre ? `
      <div class="avt-ce2-sidebar-actions">
        <button class="avt-ce2-action-btn" onclick="_avtCe2TrocarImagem('${entIdSafe}')">🖼 Trocar Imagem</button>
        <button class="avt-ce2-action-btn" onclick="_avtCharImportarAparencia('${entIdSafe}')">🎨 Importar via IA</button>
      </div>` : ''}
    </div>

    <div class="avt-ce2-sidebar-footer">
      <button class="avt-ce2-close-btn" onclick="fecharAvtCharEditor()">✕ Fechar</button>
    </div>
  `;

  _avtCharEditorRenderRight(ent, dbChar, attrs);
}

function _avtCe2HpDelta(entId, delta) {
  const ent = AVT_STATE.entidades.find(e => e.id === entId);
  if (!ent) return;
  ent.hp = Math.max(0, Math.min(ent.hpMax, ent.hp + delta));
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome);
  if (dbChar) dbChar.hp_atual = ent.hp;
  _avtRenderHpBar?.();
  _avtCharEditorRender();
}

function _avtCe2TrocarImagem(entId) {
  let wrap = document.getElementById('avt-ce2-portrait-wrap');
  if (!wrap) {
    const extPortrait = document.getElementById('avt-ce2-ext-portrait');
    if (!extPortrait) return;
    extPortrait.style.display = '';
    extPortrait.innerHTML = `<div class="avt-ce2-portrait-wrap" id="avt-ce2-portrait-wrap"><div class="avt-ce2-portrait-inner"></div></div>`;
    wrap = document.getElementById('avt-ce2-portrait-wrap');
    if (!wrap) return;
  }
  if (wrap.querySelector('.avt-ce2-img-popover')) {
    wrap.querySelector('.avt-ce2-img-popover').remove(); return;
  }
  const idSafe = entId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const pop = document.createElement('div');
  pop.className = 'avt-ce2-img-popover';
  pop.innerHTML = `
    <div class="avt-ce2-img-popover-title">Trocar Imagem</div>
    <input id="avt-ce2-img-url-inp" type="text" placeholder="Cole a URL da imagem (PNG, JPG, GIF)…">
    <div class="avt-ce2-img-popover-row">
      <button onclick="event.stopPropagation();_avtCe2SalvarImgUrl('${idSafe}')"
        class="avt-ce2-sm-btn add" style="flex:1">✓ Aplicar</button>
      <button onclick="event.stopPropagation();this.closest('.avt-ce2-img-popover').remove()"
        class="avt-ce2-sm-btn">✕</button>
    </div>
    <button onclick="event.stopPropagation();_avtCharImportarAparencia('${idSafe}');this.closest('.avt-ce2-img-popover').remove()"
      class="avt-ce2-sm-btn" style="width:100%;text-align:left;margin-top:2px">🎨 Importar via IA</button>
  `;
  pop.addEventListener('click', e => e.stopPropagation());
  wrap.appendChild(pop);
  setTimeout(() => { const inp = document.getElementById('avt-ce2-img-url-inp'); if (inp) inp.focus(); }, 30);
}

async function _avtCe2SalvarImgUrl(entId) {
  const inp = document.getElementById('avt-ce2-img-url-inp');
  if (!inp) return;
  const url = inp.value.trim();
  if (!url) { mostrarToast('Cole uma URL válida', 'aviso'); return; }
  const ent = AVT_STATE.entidades.find(e => e.id === entId);
  if (!ent) return;
  const dbChar = AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome);
  if (!dbChar) { mostrarToast('Personagem não encontrado no banco', 'erro'); return; }
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.aparencia) dbChar.custom_attrs.aparencia = {};
  dbChar.custom_attrs.aparencia.img_frente = url;
  try {
    await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method: 'PATCH', body: JSON.stringify({ custom_attrs: dbChar.custom_attrs })
    });
    mostrarToast('Imagem salva!', 'ok');
    _avtCharEditorRender();
  } catch(e) { mostrarToast('Erro ao salvar: ' + (e?.message || e), 'erro'); }
}

function _avtCharEditorRenderRight(ent, dbChar, attrs) {
  const right = document.getElementById('avt-ce-right');
  if (!right) return;
  const isMestre = AVT_STATE.isMestre;
  const tabs = isMestre ? ['attrs', 'equip', 'skills', 'skill-edit'] : ['attrs', 'equip', 'skills'];
  const tab = AVT_STATE.charEditorTab;
  const labels = { attrs: '📊 Atributos', equip: '⚔ Equipamentos', skills: '✨ Skills', 'skill-edit': '⚙ Editar' };
  right.innerHTML = `
    <div class="avt-ce2-tabs">
      ${tabs.map(t => `<button class="avt-ce2-tab${t === tab ? ' ativo' : ''}" onclick="_avtCharEditorTab('${t}')">${labels[t]}</button>`).join('')}
    </div>
    <div class="avt-ce2-content" id="avt-ce-content"></div>
  `;
  const content = document.getElementById('avt-ce-content');
  if (tab === 'attrs')           _avtCharEditorRenderAttrs(content, ent, dbChar, attrs);
  else if (tab === 'equip')      _avtCharEditorRenderEquip(content, ent, dbChar);
  else if (tab === 'skills')     _avtCharEditorRenderSkills(content, ent, dbChar);
  else if (tab === 'skill-edit') _avtCharEditorRenderSkillEdit(content);
}

function _avtCharEditorTab(tab) {
  AVT_STATE.charEditorTab = tab; _avtCharEditorRender();
}

function _avtCe2EditStatCard(card, attrNome, entId) {
  if (!card) return;
  card.classList.add('editing');
  const inp = card.querySelector('.avt-ce2-stat-inp');
  if (!inp) return;
  inp.focus(); inp.select();
  const finish = () => {
    card.classList.remove('editing');
    const v = inp.value.trim();
    if (v === '') return;
    const ent = AVT_STATE.entidades.find(e => e.id === entId);
    const dbChar = AVT_STATE.chars.find(c => c.id === ent?.dbId || c.nome === ent?.nome);
    if (!dbChar) return;
    if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
    if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = {};
    const def = (RPG_DATA?.attrDefs || []).find(a => a.nome === attrNome);
    dbChar.custom_attrs.atributos[attrNome] = def?.tipo === 'number' ? +v : v;
    const numEl = card.querySelector('.avt-ce2-stat-num');
    if (numEl) numEl.textContent = v;
  };
  inp.onblur = finish;
  inp.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { card.classList.remove('editing'); }
  };
}

function _avtCharEditorRenderAttrs(container, ent, dbChar, attrs) {
  if (!container) return;
  const isMestre = AVT_STATE.isMestre;
  const isEnemy = ent.tipo === 'inimigo';
  const cor = ent.cor || '#4fa3d1';
  const ca = dbChar.custom_attrs || {};
  const entIdSafe = ent.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const ATTR_DEFS_DEFAULT = [
    { key: 'forca',        label: 'Força',        emoji: '⚔', color: '#e74c3c' },
    { key: 'destreza',     label: 'Destreza',     emoji: '🎯', color: '#2ecc71' },
    { key: 'constituicao', label: 'Constituição',  emoji: '🛡', color: '#e67e22' },
    { key: 'inteligencia', label: 'Inteligência',  emoji: '🔮', color: '#9b59b6' },
    { key: 'sabedoria',    label: 'Sabedoria',     emoji: '👁', color: '#4fa3d1' },
    { key: 'carisma',      label: 'Carisma',       emoji: '✨', color: '#c8a84b' },
  ];

  const useRpgAttrs = (RPG_DATA?.attrDefs?.length || 0) > 0;
  let attrsHtml = '';

  if (useRpgAttrs) {
    const ad = RPG_DATA.attrDefs;
    const atribs = ca.atributos || {};
    const adStatus      = ad.filter(a => a.categoria === 'status');
    const adBasicos     = ad.filter(a => (a.categoria || 'basico') === 'basico');
    const adEspeciais   = ad.filter(a => a.categoria === 'especial');
    const adResistencia = ad.filter(a => a.categoria === 'resistencia');

    const renderCard = (a, accentColor) => {
      const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
      const cardId = 'avt-ce2-sc-' + a.nome.replace(/[^a-z0-9]/gi, '_');
      const nomeSafe = a.nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<div class="avt-ce2-stat-card" id="${cardId}"
        ${isMestre ? `onclick="_avtCe2EditStatCard(this,'${nomeSafe}','${entIdSafe}')" title="Clique para editar"` : ''}>
        <div class="avt-ce2-stat-num" style="color:${accentColor}">${v}</div>
        <div class="avt-ce2-stat-name">${a.nome}</div>
        ${isMestre ? `<input class="avt-ce2-stat-inp" type="text" value="${v !== '—' ? v : ''}">` : ''}
      </div>`;
    };

    const renderRes = (a) => {
      const v = parseFloat(atribs[a.nome]) || 0;
      let maxVal = v;
      try {
        const cfg = JSON.parse(a.opcoes || '{}');
        if (cfg.max_base !== undefined) {
          const av = parseFloat(atribs[cfg.max_attr] || 0);
          maxVal = (cfg.max_base || 0) + av * (cfg.max_mult || 0);
        }
      } catch(_) {}
      const pct = maxVal > 0 ? Math.round(Math.min(v / maxVal, 1) * 100) : 100;
      return `<div class="avt-ce2-res-bar">
        <div class="avt-ce2-res-bar-inner">
          <div class="avt-ce2-res-bar-label">${a.nome}</div>
          <div class="avt-ce2-res-bar-track">
            <div class="avt-ce2-res-bar-fill" style="width:${pct}%;background:#4fa3d1"></div>
          </div>
        </div>
        <div class="avt-ce2-res-bar-num" style="color:#4fa3d1">${v}${maxVal !== v ? ` / ${Math.round(maxVal)}` : ''}</div>
      </div>`;
    };

    const grupo = (titulo, cor2, items, fn) => items.length ? `
      <div class="avt-ce2-group">
        <div class="avt-ce2-group-title" style="color:${cor2}">${titulo}</div>
        ${fn === renderRes
          ? items.map(renderRes).join('')
          : `<div class="avt-ce2-stats-grid">${items.map(a => fn(a, cor2)).join('')}</div>`}
      </div>` : '';

    const statusHtml = adStatus.length ? `
      <div class="avt-ce2-group">
        <div class="avt-ce2-group-title" style="color:#4fa3d1">📊 Recursos</div>
        ${adStatus.map(renderRes).join('')}
      </div>` : '';

    attrsHtml = statusHtml
      + grupo('🔷 Básicos', cor, adBasicos, renderCard)
      + grupo('✨ Especiais', '#b07ef0', adEspeciais, renderCard)
      + grupo('🛡 Defesas', '#e8a020', adResistencia, renderCard);

  } else {
    const pontos = attrs.pontos || 0;
    attrsHtml = `
      ${pontos > 0 ? `<div class="avt-ce2-pontos-banner">⭐ ${pontos} ponto${pontos !== 1 ? 's' : ''} de atributo disponíve${pontos !== 1 ? 'is' : 'l'}</div>` : ''}
      <div class="avt-ce2-group">
        <div class="avt-ce2-group-title" style="color:${cor}">Atributos</div>
        <div class="avt-ce2-attrs-grid">
          ${ATTR_DEFS_DEFAULT.map(a => `
            <div class="avt-ce2-attr-row">
              <div class="avt-ce2-attr-emoji">${a.emoji}</div>
              <div class="avt-ce2-attr-label" style="color:${a.color}">${a.label}</div>
              <div class="avt-ce2-attr-controls">
                <button class="avt-ce2-attr-btn" onclick="_avtAttrDelta('${entIdSafe}','${a.key}',-1)"
                  ${(attrs[a.key] || 10) <= 8 && !isMestre ? 'disabled' : ''}>−</button>
                <span class="avt-ce2-attr-num" style="color:${a.color}">${attrs[a.key] || 10}</span>
                <button class="avt-ce2-attr-btn" onclick="_avtAttrDelta('${entIdSafe}','${a.key}',1)"
                  ${!isMestre && pontos <= 0 ? 'disabled' : ''}>+</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  const hpMaxHtml = isMestre ? `
    <div class="avt-ce2-group">
      <div class="avt-ce2-group-title" style="color:${cor}">HP Máximo</div>
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0">
        <input type="number" min="1" max="9999" value="${ent.hpMax}"
          onchange="_avtAttrHpMax('${entIdSafe}',+this.value)" class="avt-ce2-hp-input">
        <span style="font-size:0.72rem;color:#7a92aa">HP atual: ${ent.hp}</span>
      </div>
    </div>` : '';

  const npcHtml = isEnemy && isMestre ? `
    <div class="avt-ce2-group">
      <div class="avt-ce2-group-title" style="color:#e74c3c">🤖 Comportamento</div>
      <div class="avt-ce2-npc-grid">
        <div>
          <label class="avt-ce2-field-label">Paciência (seg)</label>
          <input type="number" min="0.5" max="60" step="0.5" value="${ent.pacienciaSecs ?? 5}"
            onchange="_avtNpcSetPaciencia('${entIdSafe}',+this.value)" class="avt-ce2-field-input">
        </div>
        <div>
          <label class="avt-ce2-field-label">Raio Detecção</label>
          <input type="number" min="1" max="15" value="${ent.deteccaoRaio ?? 3}"
            onchange="_avtNpcSetRaio('${entIdSafe}',+this.value)" class="avt-ce2-field-input">
        </div>
        <div>
          <label class="avt-ce2-field-label">Cor</label>
          <input type="color" value="${ent.cor || '#7a5c00'}"
            onchange="_avtNpcSetCor('${entIdSafe}',this.value)"
            style="width:100%;height:32px;border:1px solid rgba(79,163,209,0.15);border-radius:6px;background:#0a0f18;cursor:pointer">
        </div>
        <div style="display:flex;align-items:flex-end;padding-bottom:4px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.72rem;color:#c8d8e8">
            <input type="checkbox" ${ent.isBoss ? 'checked' : ''} onchange="_avtNpcSetBoss('${entIdSafe}',this.checked)">
            Boss 👑
          </label>
        </div>
      </div>
    </div>` : '';

  container.innerHTML = attrsHtml + hpMaxHtml + npcHtml + `
    <div style="padding-top:6px">
      <button class="avt-ce2-save-btn" onclick="_avtCharSalvarAttrs('${entIdSafe}')">💾 Salvar atributos</button>
    </div>
  `;
}

function _avtAttrDelta(entId, attr, delta) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
  const a = dbChar.custom_attrs.atributos;
  if (delta>0 && !AVT_STATE.isMestre && (a.pontos||0)<=0) return;
  if (delta<0 && (a[attr]||10)<=8) return;
  a[attr] = (a[attr]||10) + delta;
  if (!AVT_STATE.isMestre) a.pontos = Math.max(0, (a.pontos||0) - delta);
  _avtCharEditorRender();
}

function _avtAttrHpMax(entId, val) {
  if (!val || val < 1) return;
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (ent) { ent.hpMax = val; if (ent.hp > val) ent.hp = val; }
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (dbChar) { dbChar.hp_max = val; if ((dbChar.hp_atual||0) > val) dbChar.hp_atual = val; }
  _avtRenderHpBar();
}

async function _avtCharSalvarAttrs(entId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar?.id) { mostrarToast('Salvo localmente', 'aviso'); return; }
  try {
    await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method:'PATCH', body:JSON.stringify({ custom_attrs:dbChar.custom_attrs, hp_max:ent.hpMax, hp_atual:ent.hp })
    });
    mostrarToast('Atributos salvos!', 'ok');
  } catch(e) { mostrarToast('Erro: ' + (e?.message||e), 'erro'); }
}

const AVT_EQUIP_SLOTS = [
  { key:'arma_principal', label:'Arma',      icon:'⚔' },
  { key:'corpo',          label:'Armadura',   icon:'🛡' },
  { key:'acessorio',      label:'Acessório',  icon:'💍' },
  { key:'amuleto',        label:'Amuleto',    icon:'📿' },
  { key:'anel',           label:'Anel',       icon:'🔮' },
];

function _avtCharEditorRenderEquip(container, ent, dbChar) {
  if (!container) return;
  const isMestre = AVT_STATE.isMestre;
  const cor = ent.cor || '#4fa3d1';
  const equip = dbChar.custom_attrs?.equipamento || {};
  const catalog = AVT_STATE.itemCatalog || [];
  const entIdSafe = ent.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const slotHtml = AVT_EQUIP_SLOTS.map(sl => {
    const equipped = equip[sl.key];
    const equippedName = equipped ? (typeof equipped === 'object' ? equipped.nome : equipped) : null;
    const equippedImg  = equipped && typeof equipped === 'object' ? equipped.img_url : null;
    const bonuses      = equipped && typeof equipped === 'object' ? equipped.bonus_snapshot : null;
    const bonusText    = bonuses && Object.keys(bonuses).length
      ? Object.entries(bonuses).map(([a, v]) => `${a}: ${v > 0 ? '+' : ''}${v}`).join(' · ')
      : null;
    const compatItems  = catalog.filter(i => {
      if (i.tipo !== 'equipamento' && i.tipo !== 'arma') return false;
      const s = i.slot_padrao || '';
      if (!s) return true;
      const slotMap = { arma_principal: ['arma_principal','arma_1m','arma_2m','arco','lanca'], corpo: ['corpo','armadura'], acessorio: ['acessorio','maos','capa'], amuleto: ['amuleto'], anel: ['anel'] };
      return (slotMap[sl.key] || [sl.key]).includes(s);
    });

    const iconEl = equippedImg
      ? `<div class="avt-ce2-equip-slot-icon"><img src="${equippedImg}" onerror="this.style.display='none'"></div>`
      : `<div class="avt-ce2-equip-slot-icon">${sl.icon}</div>`;

    const selectEl = isMestre && compatItems.length ? `
      <select class="avt-ce2-equip-select"
        onchange="_avtEquiparItem('${entIdSafe}','${sl.key}',this.value);this.value=''">
        <option value="">— Equipar do catálogo —</option>
        ${compatItems.map(i => `<option value="${i.id}">${i.icone || ''} ${i.nome}${i.raridade ? ` (${i.raridade})` : ''}</option>`).join('')}
      </select>` : '';

    const unequipBtn = isMestre && equippedName
      ? `<button class="avt-ce2-sm-btn danger" onclick="_avtDesequiparItem('${entIdSafe}','${sl.key}')" title="Remover">✕</button>` : '';

    const emptyCatalogNote = isMestre && !catalog.length
      ? `<div style="font-size:0.65rem;color:#4a6275;margin-top:6px;font-style:italic">Nenhum item no catálogo. <a href="#" onclick="event.preventDefault();avtImportarCatalogo()" style="color:#4fa3d1">Importar catálogo</a></div>` : '';

    return `<div class="avt-ce2-equip-slot${equippedName ? ' occupied' : ''}">
      <div class="avt-ce2-equip-slot-header">
        ${iconEl}
        <div class="avt-ce2-equip-slot-info">
          <div class="avt-ce2-equip-slot-label">${sl.label}</div>
          <div class="avt-ce2-equip-slot-name${equippedName ? '' : ' vazio'}">${equippedName || '— vazio —'}</div>
          ${bonusText ? `<div class="avt-ce2-equip-bonus">📊 ${bonusText}</div>` : ''}
        </div>
        ${unequipBtn}
      </div>
      ${selectEl}
      ${emptyCatalogNote}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="avt-ce2-group">
      <div class="avt-ce2-group-title" style="color:${cor}">⚔ Slots de Equipamento</div>
      <div class="avt-ce2-equip-list">${slotHtml}</div>
    </div>`;
}

function _avtEquiparItem(entId, slotKey, itemId) {
  if (!itemId) return;
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  const item = AVT_STATE.itemCatalog.find(i=>i.id===itemId);
  if (!item) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  if (!dbChar.custom_attrs.equipamento) dbChar.custom_attrs.equipamento = {};
  if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
  // Revert previous item in slot
  const prev = dbChar.custom_attrs.equipamento[slotKey];
  if (prev && typeof prev === 'object' && prev.bonus_snapshot) {
    Object.entries(prev.bonus_snapshot).forEach(([attr, delta]) => {
      dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) - delta;
    });
  }
  // Apply new bonuses
  const bonus = item.atributos_bonus || {};
  const snapshot = {};
  Object.entries(bonus).forEach(([attr, val]) => {
    const delta = typeof val === 'object' ? (val.valor||0) : parseFloat(val)||0;
    snapshot[attr] = delta;
    dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) + delta;
  });
  dbChar.custom_attrs.equipamento[slotKey] = { item_id: item.id, nome: item.nome, img_url: item.img_url||null, bonus_snapshot: snapshot };
  _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
    method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
  }).catch(e => mostrarToast('Erro ao equipar: ' + (e?.message||e), 'erro'));
  _avtCharEditorRender();
}

function _avtDesequiparItem(entId, slotKey) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) return;
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  const prev = dbChar.custom_attrs.equipamento?.[slotKey];
  if (prev && typeof prev === 'object' && prev.bonus_snapshot) {
    if (!dbChar.custom_attrs.atributos) dbChar.custom_attrs.atributos = _avtDefaultAttrs();
    Object.entries(prev.bonus_snapshot).forEach(([attr, delta]) => {
      dbChar.custom_attrs.atributos[attr] = (parseFloat(dbChar.custom_attrs.atributos[attr])||0) - delta;
    });
  }
  if (dbChar.custom_attrs.equipamento) delete dbChar.custom_attrs.equipamento[slotKey];
  _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
    method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
  }).catch(e => mostrarToast('Erro ao desequipar: ' + (e?.message||e), 'erro'));
  _avtCharEditorRender();
}

function _avtCharEditorRenderSkills(container, ent, dbChar) {
  if (!container) return;
  const isMestre = AVT_STATE.isMestre;
  const cor = ent.cor || '#4fa3d1';
  const entIdSafe = ent.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const charSkillIds = dbChar.custom_attrs?.skills_ids || ent.custom_attrs?.skills_ids || [];
  const mySkills = AVT_STATE.skills.filter(sk => charSkillIds.includes(sk.id));
  const otherSkills = AVT_STATE.skills.filter(sk => !charSkillIds.includes(sk.id));

  const autoIcon = (sk) => {
    if (sk.animacao?.icone) return sk.animacao.icone;
    const t = (sk.tipo_dano || '').toLowerCase();
    if (t === 'fogo') return '🔥';
    if (t === 'gelo') return '❄️';
    if (t === 'raio') return '⚡';
    if (t === 'cura') return '💚';
    if (t === 'magia' || t === 'arcano') return '✨';
    if (t === 'veneno') return '☠️';
    if (t === 'fisico' || sk.formula_dano) return '⚔️';
    return '🌀';
  };

  const tipoBadgeCls = (tipo) => {
    const t = (tipo || '').toLowerCase();
    if (t === 'fogo' || t === 'raio') return 'orange';
    if (t === 'gelo') return '';
    if (t === 'cura') return '';
    if (['magia','arcano','veneno'].includes(t)) return 'purple';
    return '';
  };

  const skillCards = mySkills.map(sk => {
    const icon = autoIcon(sk);
    const bodyId = 'avt-sk2-body-' + sk.id.replace(/[^a-z0-9]/gi, '_');
    const skIdSafe = sk.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const nameSafe = (sk.habilidade || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const badges = [];
    if (sk.custo_rsv) badges.push(`<span class="avt-ce2-skill-badge purple">${sk.custo_rsv}</span>`);
    if (sk.tipo_dano) badges.push(`<span class="avt-ce2-skill-badge ${tipoBadgeCls(sk.tipo_dano)}">${sk.tipo_dano}</span>`);
    if (sk.cooldown_turnos) badges.push(`<span class="avt-ce2-skill-badge">⏱ ${sk.cooldown_turnos}t</span>`);
    if (sk.alcance_celulas != null) badges.push(`<span class="avt-ce2-skill-badge">📏 ${sk.alcance_celulas}c</span>`);

    const temFormula = !!(sk.formula_dano || (sk.efeito && /\d+d\d+/i.test(sk.efeito)));
    const formula = sk.formula_dano || sk.efeito?.match(/\d+d\d+[+-]?\d*/i)?.[0] || '';

    const removeBtn = isMestre
      ? `<button class="avt-ce2-sm-btn danger" onclick="event.stopPropagation();_avtSkillToggleChar('${entIdSafe}','${skIdSafe}')" title="Remover desta ficha">✕</button>` : '';

    const rollBtn = temFormula
      ? `<button class="avt-ce2-skill-roll-btn" onclick="event.stopPropagation();typeof rolarFormulaDano==='function'&&rolarFormulaDano('${formula}','${nameSafe}','${ent.nome.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">🎲 ${formula}</button>` : '';

    return `
      <div class="avt-ce2-skill-card">
        <div class="avt-ce2-skill-header" onclick="const b=document.getElementById('${bodyId}');b.classList.toggle('open')">
          <div class="avt-ce2-skill-icon" style="background:${cor}12;border-color:${cor}30">${icon}</div>
          <div class="avt-ce2-skill-meta">
            <div class="avt-ce2-skill-name">${sk.habilidade || 'Habilidade'}</div>
            ${badges.length ? `<div class="avt-ce2-skill-badges">${badges.join('')}</div>` : ''}
          </div>
          <div class="avt-ce2-skill-actions">${removeBtn}</div>
        </div>
        <div class="avt-ce2-skill-body" id="${bodyId}">
          ${sk.efeito ? `<div class="avt-ce2-skill-desc">${sk.efeito}</div>` : ''}
          ${rollBtn}
        </div>
      </div>`;
  }).join('');

  let manageHtml = '';
  if (isMestre && AVT_STATE.skills.length > 0) {
    const manageItems = otherSkills.map(sk => {
      const skIdSafe = sk.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<div class="avt-ce2-skill-manage-item">
        <div style="min-width:0">
          <div class="avt-ce2-skill-manage-name">${autoIcon(sk)} ${sk.habilidade || 'Skill'}</div>
          <div class="avt-ce2-skill-manage-sub">${sk.formula_dano || '—'} · ${sk.tipo_dano || '—'}</div>
        </div>
        <button class="avt-ce2-sm-btn add" onclick="_avtSkillToggleChar('${entIdSafe}','${skIdSafe}')">+ Dar</button>
      </div>`;
    }).join('');

    manageHtml = `
      <div class="avt-ce2-skill-manage">
        <div class="avt-ce2-skill-manage-title">Skills disponíveis (${otherSkills.length})</div>
        ${otherSkills.length ? manageItems : `<div class="avt-ce2-empty" style="padding:10px 0">Todas as skills já estão atribuídas.</div>`}
      </div>`;
  }

  const editBtn = isMestre
    ? `<button class="avt-ce2-sm-btn add" style="width:100%;padding:10px;margin-top:8px;border-style:dashed"
        onclick="_avtCharEditorTab('skill-edit')">⚙ Gerenciar / Criar Skills</button>` : '';

  container.innerHTML = mySkills.length
    ? `<div class="avt-ce2-skills-list">${skillCards}</div>${manageHtml}${editBtn}`
    : `<div class="avt-ce2-empty">Nenhuma habilidade atribuída a este personagem.</div>${manageHtml}${editBtn}`;
}

function _avtSkillToggleChar(entId, skillId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (!ent) return;
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  // Use dbChar if available, otherwise store on entity directly (dungeon-generated NPCs)
  const target = dbChar || ent;
  if (!target.custom_attrs) target.custom_attrs = {};
  if (!target.custom_attrs.skills_ids) target.custom_attrs.skills_ids = [];
  const ids = target.custom_attrs.skills_ids;
  const idx = ids.indexOf(skillId);
  if (idx>=0) ids.splice(idx,1); else ids.push(skillId);
  if (dbChar?.id) {
    _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method:'PATCH', body:JSON.stringify({ custom_attrs: dbChar.custom_attrs })
    }).catch(e => mostrarToast('Erro ao salvar skill: ' + (e?.message||e), 'erro'));
  }
  // Sync personagem/character_id on the skill so combat HUD filter stays consistent
  const skObj = AVT_STATE.skills.find(s => s.id === skillId);
  if (skObj && dbChar) {
    if (idx >= 0) {
      // removed — clear link if owned by this character
      if (skObj.personagem === dbChar.nome || skObj.character_id === dbChar.id) {
        skObj.personagem = ''; skObj.character_id = null;
        _avtSb('skills?id=eq.' + encodeURIComponent(skillId), {
          method: 'PATCH', body: JSON.stringify({ personagem: '', character_id: null })
        }).catch(() => {});
      }
    } else {
      // added — bind to this character
      skObj.personagem = dbChar.nome; skObj.character_id = dbChar.id;
      _avtSb('skills?id=eq.' + encodeURIComponent(skillId), {
        method: 'PATCH', body: JSON.stringify({ personagem: dbChar.nome, character_id: dbChar.id })
      }).catch(() => {});
    }
  }
  _avtCharEditorRender();
}

function _avtCharEditorRenderSkillEdit(container) {
  if (!container) return;
  const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
  const dbChar = ent ? AVT_STATE.chars.find(c => c.id === ent.dbId || c.nome === ent.nome) : null;
  const charSkillIds = dbChar?.custom_attrs?.skills_ids || ent?.custom_attrs?.skills_ids || [];

  // Skills for this character: by name match OR by skills_ids
  const charNome = ent?.nome || '';
  const charSkills = AVT_STATE.skills.filter(sk =>
    charSkillIds.includes(sk.id) ||
    (charNome && sk.personagem === charNome) ||
    (ent?.dbId && sk.character_id === ent.dbId)
  );
  const otherSkills = AVT_STATE.skills.filter(sk => !charSkills.includes(sk));

  const filterMode = AVT_STATE._skillEditFilter || 'char';

  const shownSkills = filterMode === 'char' ? charSkills : AVT_STATE.skills;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="avt-ce-section-title" style="margin:0">⚙ Editar Skills${charNome ? ` — ${charNome}` : ''}</div>
      <button class="avt-mp-btn" onclick="_avtSkillNova()">+ Nova</button>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:10px">
      <button class="avt-mp-btn ${filterMode==='char'?'avt-mp-btn-ativo':''}" style="font-size:0.68rem;padding:3px 8px"
        onclick="AVT_STATE._skillEditFilter='char';_avtCharEditorRender()">
        Deste personagem (${charSkills.length})
      </button>
      <button class="avt-mp-btn ${filterMode==='all'?'avt-mp-btn-ativo':''}" style="font-size:0.68rem;padding:3px 8px"
        onclick="AVT_STATE._skillEditFilter='all';_avtCharEditorRender()">
        Todas (${AVT_STATE.skills.length})
      </button>
    </div>
    <div id="avt-ce-skill-lista">
      ${shownSkills.length ? shownSkills.map(_avtSkillCardHtml).join('') : `<div style="color:#7a92aa;font-size:0.75rem;font-style:italic">${filterMode==='char'?`Nenhuma skill atribuída a "${charNome}". Use "+ Nova" ou mude o filtro para "Todas".`:'Nenhuma skill criada ainda.'}</div>`}
    </div>`;
}

function _avtSkillCardHtml(sk) {
  const eid = 'avt-sk-f-' + sk.id.replace(/[^a-z0-9]/gi,'_');
  const anim = sk.animacao || {};
  const animTipo = anim.tipo || 'nenhuma';
  const attrDefs = (RPG_DATA?.attrDefs || []).filter(a => a.tipo === 'number');

  const TIPOS_DANO = ['fisico','magico','fogo','gelo','raio','veneno','cura','psiquico','forcas','luz','sombra'];
  const ANIM_TIPOS = ['nenhuma','simples','projetil','onda','explosao','raio','aura','gsap','pixi_particulas','pixi_spine'];
  const GSAP_PRESETS = ['impacto_shake','impacto_escala','aura_pulso','critico_espiral','cura_flutuante','raio_dash','teletransporte','invocar_aparece','explosao_radial','gelo_freeze','fogo_charge','sombra_mergulho'];
  const GATILHOS = ['ser_atacado','ser_atingido','sofrer_dano','aliado_atacado','inimigo_move_adjacente','inicio_turno_proprio','fim_turno_proprio','acertar_critico','matar_inimigo','custom'];

  const efeitosBonus = Array.isArray(sk.efeitos_bonus) ? sk.efeitos_bonus : [];

  return `
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:8px;margin-bottom:6px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer" onclick="const f=document.getElementById('${eid}');f.style.display=f.style.display==='none'?'block':'none'">
        <span style="flex:1;font-family:var(--fonte-d);font-size:0.78rem;color:#c8d8e8">${sk.habilidade||sk.nome||'Skill'}</span>
        <span style="font-size:0.62rem;color:#7a92aa">${sk.formula_dano||'—'} · ${sk.tipo_dano||sk.tipo||'—'}${sk.cooldown_turnos?` · ⏱${sk.cooldown_turnos}t`:''}</span>
        <button class="avt-mp-btn avt-mp-btn-danger" onclick="event.stopPropagation();_avtSkillDeletar('${sk.id}')" style="padding:2px 6px">✕</button>
      </div>
      <div id="${eid}" style="display:none;padding:12px;border-top:1px solid rgba(255,255,255,0.06)">

        <!-- Row 1: Nome + Fórmula -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Nome</div>
            <input value="${(sk.habilidade||'').replace(/"/g,'&quot;')}" oninput="_avtSkillField('${sk.id}','habilidade',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Fórmula de dano</div>
            <input value="${sk.formula_dano||''}" placeholder="2d6+3" oninput="_avtSkillField('${sk.id}','formula_dano',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Row 2: Tipo dano + Cooldown + Alcance -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Tipo de dano</div>
            <select onchange="_avtSkillField('${sk.id}','tipo_dano',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${TIPOS_DANO.map(t=>`<option value="${t}" ${(sk.tipo_dano||'fisico')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
          <div><div class="avt-sk-label">Cooldown (turnos)</div>
            <input type="number" min="0" max="99" value="${sk.cooldown_turnos||0}" oninput="_avtSkillField('${sk.id}','cooldown_turnos',+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Alcance (células)</div>
            <input type="number" min="0" max="99" value="${sk.alcance_celulas!=null?sk.alcance_celulas:''}" placeholder="—" oninput="_avtSkillField('${sk.id}','alcance_celulas',this.value===''?null:+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Row 3: Atributo base + Mod% + Alvo -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Atributo base</div>
            <select onchange="_avtSkillField('${sk.id}','atributo_base',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              <option value="">— Nenhum —</option>
              ${attrDefs.map(a=>`<option value="${a.nome}" ${sk.atributo_base===a.nome?'selected':''}>${a.nome}</option>`).join('')}
            </select></div>
          <div><div class="avt-sk-label">Mod. atributo (%)</div>
            <input type="number" min="-999" max="999" value="${sk.mod_atributo_pct!=null?sk.mod_atributo_pct:''}" placeholder="0"
              oninput="_avtSkillField('${sk.id}','mod_atributo_pct',this.value===''?null:+this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Tipo de alvo</div>
            <select onchange="_avtSkillField('${sk.id}','alvo_tipo',this.value)"
              style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
              ${['inimigo','aliado','proprio','area'].map(t=>`<option value="${t}" ${(sk.alvo_tipo||'inimigo')===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
        </div>

        <!-- Row 4: Crítico pos + neg -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div><div class="avt-sk-label">Crítico positivo (nat 20)</div>
            <input value="${(sk.critico_positivo||'').replace(/"/g,'&quot;')}" placeholder="ex: Atordoa por 1 turno"
              oninput="_avtSkillField('${sk.id}','critico_positivo',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          <div><div class="avt-sk-label">Falha crítica (nat 1)</div>
            <input value="${(sk.critico_negativo||'').replace(/"/g,'&quot;')}" placeholder="ex: Perde próximo turno"
              oninput="_avtSkillField('${sk.id}','critico_negativo',this.value)"
              style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
        </div>

        <!-- Efeitos bônus -->
        <div style="margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="avt-sk-label">Efeitos bônus</div>
            <button class="avt-mp-btn" style="padding:2px 8px;font-size:0.68rem" onclick="_avtSkillAddEfeito('${sk.id}')">+ Efeito</button>
          </div>
          <div id="avt-sk-efeitos-${sk.id.replace(/[^a-z0-9]/gi,'_')}">
            ${efeitosBonus.map((ef, i) => `
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;padding:5px 8px;background:rgba(79,163,209,0.05);border:1px solid rgba(79,163,209,0.15);border-radius:5px">
                <select onchange="_avtSkillEfeitoField('${sk.id}',${i},'tipo',this.value)"
                  style="padding:3px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem">
                  ${['buff','debuff','veneno','sangramento','atordoamento','invocacao','cura_bonus','dano_bonus'].map(t=>`<option value="${t}" ${ef.tipo===t?'selected':''}>${t}</option>`).join('')}
                </select>
                <input value="${(ef.descricao||'').replace(/"/g,'&quot;')}" placeholder="Descrição"
                  oninput="_avtSkillEfeitoField('${sk.id}',${i},'descricao',this.value)"
                  style="flex:1;padding:3px 5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem">
                <input type="number" value="${ef.duracao_turnos||1}" min="1" max="99" placeholder="Dur."
                  oninput="_avtSkillEfeitoField('${sk.id}',${i},'duracao_turnos',+this.value)"
                  style="width:45px;padding:3px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:4px;color:#c8d8e8;font-size:0.7rem;text-align:center"
                  title="Duração (turnos)">
                <button onclick="_avtSkillRemEfeito('${sk.id}',${i})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.9rem;padding:0;line-height:1">✕</button>
              </div>`).join('')}
          </div>
        </div>

        <!-- Habilidade reativa -->
        <div style="margin-bottom:8px">
          <div class="avt-sk-label" style="margin-bottom:4px">Habilidade reativa</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div><div class="avt-sk-label">Gatilho</div>
              <select onchange="_avtSkillField('${sk.id}','gatilho_tipo',this.value||null)"
                style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
                <option value="">— Não reativa —</option>
                ${GATILHOS.map(g=>`<option value="${g}" ${sk.gatilho_tipo===g?'selected':''}>${g}</option>`).join('')}
              </select></div>
            <div><div class="avt-sk-label">Condição (opcional)</div>
              <input value="${(sk.gatilho_descricao||'').replace(/"/g,'&quot;')}" placeholder="ex: apenas se aliado"
                oninput="_avtSkillField('${sk.id}','gatilho_descricao',this.value)"
                style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.75rem"></div>
          </div>
        </div>

        <!-- Descrição -->
        <div style="margin-bottom:8px"><div class="avt-sk-label">Descrição / efeito narrativo</div>
          <textarea rows="2" oninput="_avtSkillField('${sk.id}','descricao',this.value)"
            style="width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.72rem;resize:none">${sk.descricao||''}</textarea>
        </div>

        <!-- Animação -->
        <div style="margin-bottom:10px">
          <div class="avt-sk-label" style="margin-bottom:5px">Animação</div>
          <select onchange="_avtSkillAnimSetTipoSel('${sk.id}',this.value)"
            style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-family:var(--fonte-d);font-size:0.73rem;margin-bottom:8px">
            <option value="nenhuma" ${animTipo==='nenhuma'?'selected':''}>— Nenhuma —</option>
            <optgroup label="Canvas">
              <option value="simples" ${animTipo==='simples'?'selected':''}>Flash simples</option>
              <option value="projetil" ${animTipo==='projetil'?'selected':''}>🏹 Projétil</option>
              <option value="onda" ${animTipo==='onda'?'selected':''}>🌊 Onda</option>
              <option value="explosao" ${animTipo==='explosao'?'selected':''}>💥 Explosão</option>
              <option value="raio" ${animTipo==='raio'?'selected':''}>⚡ Raio</option>
              <option value="aura" ${animTipo==='aura'?'selected':''}>🔮 Aura</option>
            </optgroup>
            <optgroup label="GSAP (DOM)">
              <option value="gsap" ${animTipo==='gsap'?'selected':''}>GSAP preset</option>
            </optgroup>
            <optgroup label="Pixi">
              <option value="pixi_particulas" ${animTipo==='pixi_particulas'?'selected':''}>✨ Partículas Pixi</option>
              <option value="pixi_spine" ${animTipo==='pixi_spine'?'selected':''}>🦴 Skeleton (Pixi Spine)</option>
            </optgroup>
          </select>
          <div id="avt-sk-anim-cfg-${sk.id.replace(/[^a-z0-9]/gi,'_')}">
            ${_avtSkillAnimCfgHtml(sk)}
          </div>
        </div>

        <button class="avt-mp-btn avt-mp-btn-ok" onclick="_avtSkillSalvar('${sk.id}')" style="width:100%">💾 Salvar skill</button>
      </div>
    </div>`;
}

function _avtSkillField(id, field, val) { const sk=AVT_STATE.skills.find(s=>s.id===id); if(sk) sk[field]=val; }

function _avtSkillEfeitoField(skId, idx, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!Array.isArray(sk.efeitos_bonus)) sk.efeitos_bonus = [];
  if (!sk.efeitos_bonus[idx]) sk.efeitos_bonus[idx] = {};
  sk.efeitos_bonus[idx][field] = val;
}

function _avtSkillAddEfeito(skId) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!Array.isArray(sk.efeitos_bonus)) sk.efeitos_bonus = [];
  sk.efeitos_bonus.push({ tipo:'debuff', descricao:'', duracao_turnos:1 });
  // Re-render just this skill card
  const eid = 'avt-sk-f-' + skId.replace(/[^a-z0-9]/gi,'_');
  const container = document.getElementById(eid);
  if (!container) return;
  const expanded = container.style.display !== 'none';
  const parent = container.parentElement;
  if (parent) parent.outerHTML = _avtSkillCardHtml(sk);
  const newEl = document.getElementById(eid);
  if (newEl && expanded) newEl.style.display = 'block';
}

function _avtSkillRemEfeito(skId, idx) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk || !Array.isArray(sk.efeitos_bonus)) return;
  sk.efeitos_bonus.splice(idx, 1);
  const eid = 'avt-sk-f-' + skId.replace(/[^a-z0-9]/gi,'_');
  const container = document.getElementById(eid);
  if (!container) return;
  const expanded = container.style.display !== 'none';
  const parent = container.parentElement;
  if (parent) parent.outerHTML = _avtSkillCardHtml(sk);
  const newEl = document.getElementById(eid);
  if (newEl && expanded) newEl.style.display = 'block';
}

function _avtSkillAnimSetTipo(skId, tipo, btn) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao.tipo = tipo;
  if (btn) {
    const allBtns = btn.parentElement.querySelectorAll('.avt-mp-btn');
    allBtns.forEach(b => b.classList.remove('avt-mp-btn-ativo'));
    btn.classList.add('avt-mp-btn-ativo');
  }
  const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
  const cfgEl = document.getElementById(cfgId);
  if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
}

function _avtSkillAnimSetTipoSel(skId, tipo) {
  _avtSkillAnimSetTipo(skId, tipo, null);
}

function _avtSkillAnimField(skId, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao[field] = val;
}

function _avtSkillAnimCfgHtml(sk) {
  const anim = sk.animacao || {};
  const tipo = anim.tipo || 'nenhuma';
  const sid = sk.id.replace(/[^a-z0-9]/gi,'_');

  if (tipo === 'nenhuma') return '<div class="avt-mp-hint">Nenhuma animação ao usar esta skill.</div>';

  const CAMINHOS = [
    { v:'alvo',        l:'No alvo' },
    { v:'trajetoria',  l:'Trajetória (atacante→alvo)' },
    { v:'area',        l:'Área (AoE)' },
    { v:'atacante',    l:'No atacante (emanação)' },
    { v:'meio',        l:'No centro do campo' },
    { v:'raio',        l:'Raio contínuo' },
    { v:'retorno',     l:'Bumerangue (vai e volta)' },
  ];
  const inpSt = 'width:100%;box-sizing:border-box;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem';

  if (tipo === 'simples') {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="avt-sk-label">Efeito visual</div>
        <select onchange="_avtSkillAnimField('${sk.id}','subtipo',this.value)" style="${inpSt}">
          ${['Fogo','Gelo','Raio','Cura','Sombra','Arcano','Veneno','Impacto'].map(t=>`<option value="${t}" ${(anim.subtipo||'Impacto')===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div><div class="avt-sk-label">Cor</div>
        <input type="color" value="${anim.cor||'#e74c3c'}" oninput="_avtSkillAnimField('${sk.id}','cor',this.value)"
          style="width:100%;height:30px;padding:2px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;cursor:pointer"></div>
    </div>`;
  }

  if (['projetil','onda','explosao','raio','aura'].includes(tipo)) {
    const tipoLabel = {projetil:'Projétil',onda:'Onda',explosao:'Explosão',raio:'Raio',aura:'Aura'}[tipo];
    return `<div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div class="avt-sk-label">Caminho do efeito</div>
          <select onchange="_avtSkillAnimField('${sk.id}','posicao',this.value)" style="${inpSt}">
            ${CAMINHOS.map(c=>`<option value="${c.v}" ${(anim.posicao||'alvo')===c.v?'selected':''}>${c.l}</option>`).join('')}
          </select></div>
        <div><div class="avt-sk-label">Cor principal</div>
          <input type="color" value="${anim.cor||'#e74c3c'}" oninput="_avtSkillAnimField('${sk.id}','cor',this.value)"
            style="width:100%;height:30px;padding:2px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;cursor:pointer"></div>
        <div><div class="avt-sk-label">Ícone (emoji)</div>
          <input value="${anim.icone||''}" placeholder="✨" oninput="_avtSkillAnimField('${sk.id}','icone',this.value)" style="${inpSt}"></div>
        <div><div class="avt-sk-label">Duração (ms)</div>
          <input type="number" min="100" max="3000" step="100" value="${anim.duracao||600}"
            oninput="_avtSkillAnimField('${sk.id}','duracao',+this.value)" style="${inpSt}"></div>
        <div><div class="avt-sk-label">Repetições</div>
          <input type="number" min="1" max="10" value="${anim.repeticao||1}"
            oninput="_avtSkillAnimField('${sk.id}','repeticao',+this.value)" style="${inpSt}"></div>
        <div><div class="avt-sk-label">Tamanho (px)</div>
          <input type="number" min="10" max="200" value="${anim.tamanho||40}"
            oninput="_avtSkillAnimField('${sk.id}','tamanho',+this.value)" style="${inpSt}"></div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.72rem;color:#c8d8e8;cursor:pointer">
        <input type="checkbox" ${anim.trilha?'checked':''} onchange="_avtSkillAnimField('${sk.id}','trilha',this.checked)">
        Rastro de partículas ao longo do caminho
      </label>
      <div class="avt-mp-hint" style="margin-top:4px">Tipo: <b>${tipoLabel}</b> — renderizado no canvas do mapa da aventura.</div>
    </div>`;
  }

  if (tipo === 'gsap') {
    const GSAP_PRESETS = ['impacto_shake','impacto_escala','aura_pulso','critico_espiral','cura_flutuante','raio_dash','teletransporte','invocar_aparece','explosao_radial','gelo_freeze','fogo_charge','sombra_mergulho'];
    const gc = anim.gsap_config || {};
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="avt-sk-label">Preset GSAP</div>
        <select onchange="_avtSkillAnimGsapField('${sk.id}','preset',this.value)"
          style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
          ${GSAP_PRESETS.map(p=>`<option value="${p}" ${(gc.preset||'impacto_shake')===p?'selected':''}>${p}</option>`).join('')}
        </select></div>
      <div><div class="avt-sk-label">Cor</div>
        <input type="color" value="${gc.cor||'#e74c3c'}" oninput="_avtSkillAnimGsapField('${sk.id}','cor',this.value)"
          style="width:100%;height:30px;padding:2px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;cursor:pointer"></div>
      <div><div class="avt-sk-label">Intensidade</div>
        <input type="range" min="0.1" max="3" step="0.1" value="${gc.intensidade||1}"
          oninput="_avtSkillAnimGsapField('${sk.id}','intensidade',+this.value)"
          style="width:100%"></div>
      <div style="grid-column:1/-1"><div class="avt-sk-label">Caminho do efeito</div>
        <select onchange="_avtSkillAnimField('${sk.id}','posicao',this.value)"
          style="width:100%;padding:5px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.73rem">
          ${CAMINHOS.map(c=>`<option value="${c.v}" ${(anim.posicao||'alvo')===c.v?'selected':''}>${c.l}</option>`).join('')}
        </select></div>
    </div>`;
  }

  if (tipo === 'pixi_particulas') {
    const INTENS = ['sutil','equilibrado','cinematografico','cataclismo'];
    const intensAtual = anim.intensidade || (anim.particle_config && anim.particle_config.intensidade) || 'equilibrado';
    const refImg = anim.referencia_img;
    return `<div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><div class="avt-sk-label">Caminho do efeito</div>
          <select onchange="_avtSkillAnimField('${sk.id}','posicao',this.value)" style="${inpSt}">
            ${CAMINHOS.map(c=>`<option value="${c.v}" ${(anim.posicao||'alvo')===c.v?'selected':''}>${c.l}</option>`).join('')}
          </select></div>
        <div><div class="avt-sk-label">Intensidade (calibra exagero)</div>
          <select onchange="_avtSkillAnimField('${sk.id}','intensidade',this.value)" style="${inpSt}">
            ${INTENS.map(v=>`<option value="${v}" ${intensAtual===v?'selected':''}>${v}</option>`).join('')}
          </select></div>
      </div>
      <div style="margin-bottom:8px;padding:7px;background:rgba(169,120,255,0.05);border:1px solid rgba(169,120,255,0.18);border-radius:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:0.7rem;color:#a978ff;font-weight:600">🖼 Imagem de referência (opcional)</span>
          ${refImg ? `<button class="avt-mp-btn" style="font-size:0.6rem;padding:1px 5px" onclick="_avtSkillRemoverRefImg('${sk.id}')">remover</button>` : ''}
        </div>
        <div style="font-size:0.64rem;color:#7a92aa;margin-bottom:5px;line-height:1.4">Anexe um PNG do projétil/efeito que você quer que a IA reproduza. A IA vai reconstruir a silhueta no campo <code>body</code> ou usar como sprite direto.</div>
        ${refImg ? `<div style="display:flex;align-items:center;gap:8px"><img src="${refImg}" style="max-height:60px;max-width:60px;border-radius:4px;background:#000;border:1px solid rgba(169,120,255,0.3)"><span style="font-size:0.62rem;color:#a978ff">✓ Referência anexada — será enviada à IA</span></div>` : `<input type="file" accept="image/png,image/jpeg,image/webp" onchange="_avtSkillAnexarRefImg('${sk.id}',this.files[0])" style="font-size:0.65rem;color:#c8d8e8;width:100%">`}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="avt-sk-label">Config JSON (envelope cinematográfico)</div>
        <div style="display:flex;gap:4px">
          <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillCopiarPromptIA('pixi_particulas','${sk.id}')">⎘ Copiar prompt</button>
          <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillGerarAnimIA('${sk.id}','pixi_particulas')">⚡ Gerar com IA</button>
        </div>
      </div>
      <textarea rows="6" placeholder='{"alpha":{"start":1,"end":0},"scale":{"start":0.3,"end":0},"color":{"start":"#e74c3c","end":"#f0cc6a"},"speed":{"start":200,"end":50},"lifetime":{"min":0.5,"max":1.5},"frequency":0.01,"maxParticles":100}'
        oninput="_avtSkillAnimParticleJson('${sk.id}',this.value)"
        style="width:100%;box-sizing:border-box;padding:6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem;font-family:monospace;resize:vertical">${anim.particle_config ? JSON.stringify(anim.particle_config, null, 2) : ''}</textarea>
    </div>`;
  }

  if (tipo === 'pixi_spine') {
    return `<div>
      <div style="margin-bottom:8px"><div class="avt-sk-label">Caminho do efeito</div>
        <select onchange="_avtSkillAnimField('${sk.id}','posicao',this.value)" style="${inpSt}">
          ${CAMINHOS.map(c=>`<option value="${c.v}" ${(anim.posicao||'alvo')===c.v?'selected':''}>${c.l}</option>`).join('')}
        </select></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div class="avt-sk-label">Config JSON (pixi-spine)</div>
        <div style="display:flex;gap:4px">
          <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillCopiarPromptIA('pixi_spine','${sk.id}')">⎘ Copiar prompt</button>
          <button class="avt-mp-btn" style="font-size:0.65rem;padding:2px 7px" onclick="_avtSkillGerarAnimIA('${sk.id}','pixi_spine')">⚡ Gerar com IA</button>
        </div>
      </div>
      <textarea rows="6" placeholder='{"skeleton":"URL_DO_SKELETON.json","atlas":"URL_DO_ATLAS.atlas","animation":"attack","scale":1,"duracao":1000}'
        oninput="_avtSkillAnimSpineJson('${sk.id}',this.value)"
        style="width:100%;box-sizing:border-box;padding:6px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:5px;color:#c8d8e8;font-size:0.68rem;font-family:monospace;resize:vertical">${anim.spine_config ? JSON.stringify(anim.spine_config, null, 2) : ''}</textarea>
    </div>`;
  }

  return '';
}

// Auto-save debounced de skill (persiste sk.animacao no Supabase sem o usuário precisar clicar Salvar)
const _AVT_SK_SAVE_TIMERS = new Map();
function _avtSkillAutoSave(skId, delay) {
  if (!skId) return;
  if (_AVT_SK_SAVE_TIMERS.has(skId)) clearTimeout(_AVT_SK_SAVE_TIMERS.get(skId));
  const t = setTimeout(() => {
    _AVT_SK_SAVE_TIMERS.delete(skId);
    try { _avtSkillSalvar(skId); } catch(_) {}
  }, delay ?? 800);
  _AVT_SK_SAVE_TIMERS.set(skId, t);
}

function _avtSkillAnimGsapField(skId, field, val) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  if (!sk.animacao.gsap_config) sk.animacao.gsap_config = {};
  sk.animacao.gsap_config[field] = val;
  _avtSkillAutoSave(skId);
}

function _avtSkillAnexarRefImg(skId, file) {
  if (!file) return;
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;
  if (file.size > 2 * 1024 * 1024) {
    mostrarToast('Imagem muito grande (max 2MB)', 'erro'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    if (!sk.animacao) sk.animacao = {};
    sk.animacao.referencia_img = e.target.result;
    sk.animacao.referencia_img_mime = file.type;
    const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
    const cfgEl = document.getElementById(cfgId);
    if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
    _avtSkillAutoSave(skId, 200);
    mostrarToast('Imagem de referência anexada — clique "⚡ Gerar com IA" para usar', 'ok');
  };
  reader.readAsDataURL(file);
}

function _avtSkillRemoverRefImg(skId) {
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk || !sk.animacao) return;
  delete sk.animacao.referencia_img;
  delete sk.animacao.referencia_img_mime;
  const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
  const cfgEl = document.getElementById(cfgId);
  if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
  _avtSkillAutoSave(skId, 200);
}

function _avtSkillAnimParticleJson(skId, raw) {
  try {
    const cfg = JSON.parse(raw);
    const sk = AVT_STATE.skills.find(s=>s.id===skId);
    if (!sk) return;
    if (!sk.animacao) sk.animacao = {};
    sk.animacao.particle_config = cfg;
    _avtSkillAutoSave(skId);
  } catch(e) { /* invalid JSON — ignore until valid */ }
}

function _avtSkillAnimSpineJson(skId, raw) {
  try {
    const cfg = JSON.parse(raw);
    const sk = AVT_STATE.skills.find(s=>s.id===skId);
    if (!sk) return;
    if (!sk.animacao) sk.animacao = {};
    sk.animacao.spine_config = cfg;
    _avtSkillAutoSave(skId);
  } catch(e) { /* ignore */ }
}


function _avtSkillPromptIA(animTipo, forApi, posicao) {
  posicao = posicao || 'alvo';
  const POS_GUIDE = {
    alvo:       'POSIÇÃO: efeito CENTRADO NO ALVO (impacto, debuff, explosão local). Lifetime curto, spread amplo, frequency baixa.',
    atacante:   'POSIÇÃO: efeito EMANANDO DO ATACANTE (carga, buff, aura pessoal). Partículas expandem radialmente.',
    meio:       'POSIÇÃO: efeito no PONTO MÉDIO (encontro de poderes).',
    area:       'POSIÇÃO: efeito de ÁREA (AoE) com espalhamento amplo.',
    trajetoria: 'POSIÇÃO: PROJÉTIL viajando. **Use o envelope `phases` com cast/travel/impact** e descreva o corpo do projétil em `travel.body` (vetorial em parts, ou sprite). Partículas no travel são APENAS um rastro fino (lifetime curto, spread pequeno).',
    raio:       'POSIÇÃO: RAIO contínuo. Beam segmentado, partículas finas/densas, lifetime curto.',
    retorno:    'POSIÇÃO: BUMERANGUE — use `phases` com travel ida + travel volta.',
  };
  if (animTipo === 'pixi_particulas') {
    const base = [
      'Você é um VFX artist sênior em PixiJS v7 + @pixi/particle-emitter v5 trabalhando com um renderizador cinematográfico custom. Gere APENAS JSON válido (sem markdown, sem comentários, sem texto extra).',
      '',
      'PRINCÍPIOS DE LEITURA (mais importantes que qualquer regra técnica):',
      '- O espectador precisa identificar a FORMA do que foi lançado. Se é uma lança, ele vê uma lança. Se é um orbe, vê um orbe. Partículas são *tempero* do corpo, NÃO substitutos do corpo.',
      '- Magia de RPG bem feita (Elden Ring, Genshin) tem economia visual: pouca coisa, bem desenhada. Excesso de bloom + add-blend vira "clarão".',
      '- Default = `intensidade:"equilibrado"`. Reserve `cinematografico`/`cataclismo` para os 10% de efeitos que merecem (chefes, ultimates, cataclismos narrativos). NÃO inclua bloom forte, shake grande, flash full-screen ou zoomPunch a menos que o usuário tenha pedido um impacto contundente.',
      '- Para projéteis com forma definida (lança, flecha, adaga, espada arremessada, glifo, orbe), VOCÊ DEVE USAR `phases` + `travel.body`. Não tente resolver com partículas só.',
      '',
      'INTENSIDADE (campo top-level, opcional, default "equilibrado"):',
      '  "sutil"          → sem bloom global, sem flash/shake; 1-2 camadas; magia silenciosa, leitura limpa.',
      '  "equilibrado"    → bloom moderado, shake leve, sem flash full-screen. **Default — use isto na maioria dos casos.**',
      '  "cinematografico"→ presets _epic, shake e flash visíveis. Use para impactos pesados.',
      '  "cataclismo"     → amplifica tudo. Apenas para ultimates devastadoras.',
      '',
      'ENVELOPE COM FASES (use para projéteis e magias direcionais):',
      '{',
      '  "intensidade": "equilibrado",',
      '  "cor": "#a978ff",                          // cor base da magia',
      '  "cast":   { "ms": 350, "preset": "arcane_lance", "body": {...opcional, glifo de invocação no atacante...} },',
      '  "travel": {',
      '    "ms": 500,',
      '    "path": "linear" | "arc" | "spiral",   // arc = arremesso com gravidade; spiral = magia em rotação',
      '    "rotate": "velocity",                   // body se orienta na direção do voo',
      '    "body": {                               // ← O CORPO DO PROJÉTIL — vetor ou sprite',
      '      "scale": 1,',
      '      "parts": [                            // composição vetorial (frente = +X)',
      '        {"kind":"shaft","length":54,"width":4,"color":"#dfe4ff","outline":"#1a1530"},',
      '        {"kind":"head","length":18,"width":11,"color":"#a978ff","glow":{"color":"#7a40ff","distance":8,"outerStrength":1.6}},',
      '        {"kind":"rune_ring","radius":18,"color":"#c8a0ff","symbols":3,"spin":140,"offset":{"x":-6,"y":0}}',
      '      ]',
      '      // OU body via sprite: { "sprite": { "url":"https://...png", "scale":0.8, "tint":"#a978ff", "glow":{...} } }',
      '    },',
      '    "trail": { "length": 6, "fade": 0.82 }  // rastro discreto que segue o corpo',
      '  },',
      '  "impact": { "ms": 400, "preset": "precise_strike" }   // anel/faíscas focados no alvo',
      '}',
      '',
      'PRIMITIVAS DE BODY (combine 1-4 para compor a forma):',
      '  shaft       — haste/cabo (length, width, color, outline)',
      '  head        — ponta de lança/flecha (length, width, color, glow)',
      '  blade       — lâmina curva (length, width)',
      '  orb         — esfera com brilho interno (radius)',
      '  disc        — disco plano (radius)',
      '  crescent    — crescente/lua (radius)',
      '  rune_ring   — anel rúnico fino com N símbolos orbitando (radius, symbols, spin=graus/s)',
      '  glyph       — triângulo com círculo central (radius, spin)',
      '  Cada parte aceita: offset{x,y}, alpha, glow{color,distance,outerStrength}',
      '',
      'ENVELOPE CLÁSSICO (para efeitos estáticos — alvo, área, atacante, raio):',
      '{',
      '  "preset": "fire_impact|ice_shatter|lightning_strike|holy_burst|dark_implosion|arcane_lance|silent_dart|precise_strike|gentle_heal|whisper_bolt",',
      '  "intensidade": "equilibrado",',
      '  "duration": 800,',
      '  "lighting": { "bloom":{"threshold":0.6,"intensity":0.8}, "tone":"filmic" },',
      '  "camera":   { "shake":{"amp":4,"decay":0.92,"freq":34} },',
      '  "layers": [',
      '    { "role":"core", "texture":"spark|glow|smoke|ember|ring|streak|star|rune|arrowhead|blade_slice|noise",',
      '      "blendMode":"add|normal|multiply", "z":3,',
      '      "glow":{"distance":10,"outerStrength":1.4,"color":"#a978ff"},',
      '      "emitter":{ "alpha":{...}, "scale":{...}, "color":{...}, "speed":{...},',
      '                  "lifetime":{"min":0.3,"max":0.6}, "frequency":0.008,',
      '                  "emitterLifetime":0.3, "maxParticles":60, "spawnType":"point" } }',
      '  ]',
      '}',
      '',
      'DIRETRIZES (princípios, não obrigações cegas):',
      '- Cores em gradiente coerentes (fogo: branco→amarelo→laranja→vermelho; gelo: branco→ciano→azul; arcano: branco→violeta→magenta; santo: branco→dourado; sombrio: roxo→preto).',
      '- blendMode "add" para luz/energia; "normal" para fumaça; "multiply" para sombra/sangue/implosão.',
      '- Use texturas procedurais — NÃO INVENTE URLs.',
      '- Para projéteis com forma identificável, `phases.travel.body` é OBRIGATÓRIO. Partículas no travel devem ser fininhas (maxParticles ≤ 30, lifetime ≤ 0.4s) — elas acompanham o body, não o substituem.',
      '- Se o usuário anexou uma IMAGEM DE REFERÊNCIA na conversa, reconstrua a silhueta dela em `travel.body.parts` (vetorial) reproduzindo cores, formas e proporções. Se for simples demais para vetor, devolva `travel.body.sprite.url` apontando para data URL ou diga ao código que use a referência como sprite.',
      '',
      POS_GUIDE[posicao] || POS_GUIDE.alvo,
      '',
      'Retorne SOMENTE o objeto JSON.',
    ].join('\n');
    return forApi ? base : base + '\n\nEfeito desejado: <DESCREVA AQUI>';
  }
  const base = `Você é um especialista em Pixi Spine. Gere APENAS um JSON válido de configuração de animação spine para RPG com os campos: skeleton (URL .json), atlas (URL .atlas), animation (nome), posicao (alvo|atacante|meio|trajetoria|raio|area|retorno), scale (número), duracao (ms). Sem texto fora do JSON, sem markdown.\n\nPOSIÇÃO selecionada: ${posicao}. ${POS_GUIDE[posicao] || ''}`;
  return forApi ? base : base + '\n\nEfeito desejado: <DESCREVA AQUI>';
}

function _avtSkillCopiarPromptIA(animTipo, skId) {
  const sk = skId ? AVT_STATE.skills.find(s=>s.id===skId) : null;
  const posicao = sk?.animacao?.posicao || 'alvo';
  const txt = _avtSkillPromptIA(animTipo, false, posicao);
  (navigator.clipboard?.writeText(txt) || Promise.reject()).then(
    () => mostrarToast('📋 Prompt copiado — cole em qualquer IA', 'ok'),
    () => { const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); mostrarToast('📋 Prompt copiado','ok'); }
  );
}

async function _avtSkillGerarAnimIA(skId, animTipo) {
  const apiKey = typeof faseGenGetApiKey === 'function' ? faseGenGetApiKey() : null;
  if (!apiKey) {
    mostrarToast('Configure a chave da API Claude em Configurações do mapa para usar IA', 'aviso');
    return;
  }
  const sk = AVT_STATE.skills.find(s=>s.id===skId);
  if (!sk) return;

  const descricao = prompt(`Descreva o efeito visual desejado para "${sk.habilidade||'esta skill'}":\n(ex: "explosão de fogo laranja que se expande em anel", "cristais de gelo azul que congela o alvo")`);
  if (!descricao) return;

  mostrarToast('Gerando config de animação com IA…', '');

  const isParticle = animTipo === 'pixi_particulas';
  const systemPrompt = _avtSkillPromptIA(animTipo, /*forApi*/ true, sk?.animacao?.posicao || 'alvo');

  // Monta conteúdo multimodal se houver imagem de referência (apenas para pixi_particulas)
  const refImg = isParticle ? sk?.animacao?.referencia_img : null;
  const refMime = sk?.animacao?.referencia_img_mime || 'image/png';
  let userContent;
  if (refImg && refImg.startsWith('data:')) {
    // extrai base64 puro do data URL
    const b64 = refImg.split(',')[1] || '';
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: refMime, data: b64 } },
      { type: 'text', text: 'IMAGEM DE REFERÊNCIA acima. Reconstrua a silhueta dela no campo travel.body (vetorial via primitivas combinadas), reproduzindo cores, proporções e formato.\n\nEfeito desejado: ' + descricao },
    ];
  } else {
    userContent = descricao;
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-calls': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      })
    });
    const data = await resp.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta não contém JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    if (!sk.animacao) sk.animacao = {};
    if (isParticle) sk.animacao.particle_config = parsed;
    else sk.animacao.spine_config = parsed;

    // Update textarea
    const cfgId = 'avt-sk-anim-cfg-' + skId.replace(/[^a-z0-9]/gi,'_');
    const cfgEl = document.getElementById(cfgId);
    if (cfgEl) cfgEl.innerHTML = _avtSkillAnimCfgHtml(sk);
    // Persiste imediatamente — sem isso, recarregar a página perde o config gerado
    try { await _avtSkillSalvar(skId); } catch(_) {}
    mostrarToast('Config de animação gerada e salva!', 'ok');
  } catch(e) {
    mostrarToast('Erro ao gerar: ' + (e?.message||e), 'erro');
  }
}

function _avtSkillAnimTipo(id, tipo) {
  const sk = AVT_STATE.skills.find(s=>s.id===id);
  if (!sk) return;
  if (!sk.animacao) sk.animacao = {};
  sk.animacao.tipo = tipo;
}

async function _avtSkillNova() {
  const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
  const nova = {
    rpg_id: AVT_STATE.rpgId,
    personagem: ent?.nome || '',
    character_id: ent?.dbId || null,
    habilidade: 'Nova Skill',
    formula_dano: '1d6',
    efeito: '',
    animacao: { tipo: 'nenhuma' },
  };
  try {
    const res = await _avtSb('skills', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(nova) });
    if (res?.[0]?.id) nova.id = res[0].id;
  } catch(e) { nova.id = 'sk_local_' + Date.now(); mostrarToast('Skill criada localmente (sem sync)', 'aviso'); }
  AVT_STATE.skills.push(nova);
  _avtCharEditorRenderSkillEdit(document.getElementById('avt-ce-content'));
}

async function _avtSkillSalvar(id) {
  const sk = AVT_STATE.skills.find(s => s.id === id);
  if (!sk) return;
  const payload = {
    habilidade: sk.habilidade,
    efeito: sk.efeito || '',
    formula_dano: sk.formula_dano || null,
    tipo_dano: sk.tipo_dano || 'fisico',
    cooldown_turnos: sk.cooldown_turnos || 0,
    alcance_celulas: sk.alcance_celulas != null ? sk.alcance_celulas : null,
    atributo_base: sk.atributo_base || null,
    mod_atributo_pct: sk.mod_atributo_pct != null ? sk.mod_atributo_pct : null,
    alvo_tipo: sk.alvo_tipo || 'inimigo',
    critico_positivo: sk.critico_positivo || null,
    critico_negativo: sk.critico_negativo || null,
    efeitos_bonus: sk.efeitos_bonus?.length ? sk.efeitos_bonus : null,
    gatilho_tipo: sk.gatilho_tipo || null,
    gatilho_descricao: sk.gatilho_descricao || null,
    animacao: sk.animacao || null,
  };
  try {
    if (!sk.id || sk.id.startsWith('sk_local_')) {
      const ent = AVT_STATE.entidades.find(e => e.id === AVT_STATE.charEditorId);
      const res = await _avtSb('skills', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          ...payload,
          rpg_id: sk.rpg_id || AVT_STATE.rpgId,
          personagem: sk.personagem || ent?.nome || '',
          character_id: sk.character_id || ent?.dbId || null,
        })
      });
      if (res?.[0]?.id) sk.id = res[0].id;
    } else {
      await _avtSb('skills?id=eq.' + encodeURIComponent(sk.id), { method: 'PATCH', body: JSON.stringify(payload) });
    }
    mostrarToast('Skill salva!', 'ok');
    // Collapse the card as visual feedback
    const eid = 'avt-sk-f-' + id.replace(/[^a-z0-9]/gi,'_');
    const formEl = document.getElementById(eid);
    if (formEl) formEl.style.display = 'none';
  } catch(e) { mostrarToast('Erro: ' + (e?.message || e), 'erro'); }
}

async function _avtSkillDeletar(id) {
  if (!confirm('Deletar esta skill?')) return;
  AVT_STATE.skills = AVT_STATE.skills.filter(s=>s.id!==id);
  try { await _avtSb('skills?id=eq.' + encodeURIComponent(id), {method:'DELETE'}); } catch(e) {}
  _avtCharEditorRenderSkillEdit(document.getElementById('avt-ce-content'));
}

// ─────────────────────────────────────────────────────────────────────────────
// APPEARANCE IMPORT (AI)
// ─────────────────────────────────────────────────────────────────────────────

const _AVT_ANIM_PROMPT = `Crie os dados de aparência animada para este personagem de RPG top-down.
Retorne APENAS o JSON (sem texto adicional):

{
  "parts": {
    "_full": { "texture": "URL_OU_DATA_URI_SVG", "x": 0, "y": 0, "width": 128, "height": 200 }
  },
  "animations": {
    "idle": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0,"scaleY":1}}},{"t":500,"transforms":{"_full":{"x":0,"y":-2,"scaleY":1.02}}}], "duration":1000, "loop":true },
    "walk": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":300,"transforms":{"_full":{"x":0,"y":-4}}}], "duration":600, "loop":true },
    "attack": { "frames": [{"t":0,"transforms":{"_full":{"x":0,"y":0}}},{"t":150,"transforms":{"_full":{"x":8,"y":-3}}}], "duration":400, "loop":false }
  },
  "equipment_slots": {}
}

Use SVG inline como texture (data:image/svg+xml,...) se não tiver imagem real.
O personagem é: [NOME_DESCRICAO]`;

function _avtCharImportarAparencia(entId) {
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  if (!ent) return;
  const overlay = document.getElementById('avt-anim-import-overlay');
  if (!overlay) return;
  const promptTxt = _AVT_ANIM_PROMPT.replace('[NOME_DESCRICAO]', ent.nome + ' — ' + (ent.tipo==='jogador'?'herói':'NPC inimigo'));
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="avt-modal-box">
      <div class="avt-modal-header">
        <span>🎨 Aparência via IA — ${ent.nome}</span>
        <button onclick="document.getElementById('avt-anim-import-overlay').style.display='none'" style="background:none;border:none;color:#7a92aa;cursor:pointer;font-size:1.2rem;line-height:1;padding:0">×</button>
      </div>
      <div class="avt-modal-body">

        <!-- Tabs -->
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button id="avt-apar-tab-anim" onclick="_avtAparTabSwitch('anim')"
            style="flex:1;padding:6px 4px;background:rgba(79,163,209,0.15);border:1px solid rgba(79,163,209,0.4);border-radius:6px;color:#4fa3d1;cursor:pointer;font-size:0.72rem;font-family:var(--fonte-d)">
            🦴 Animado (partes)</button>
          <button id="avt-apar-tab-topdown" onclick="_avtAparTabSwitch('topdown')"
            style="flex:1;padding:6px 4px;background:rgba(200,168,75,0.07);border:1px solid rgba(200,168,75,0.25);border-radius:6px;color:#c8a84b;cursor:pointer;font-size:0.72rem;font-family:var(--fonte-d)">
            🎯 Top-Down IA</button>
        </div>

        <!-- Tab: Animado (partes) -->
        <div id="avt-apar-tab-anim-body">
          <p style="font-size:0.75rem;color:#7a92aa;margin:0 0 10px">Copie o prompt, envie para Claude ou outra IA junto com a imagem do personagem, cole o JSON retornado aqui.</p>
          <div style="display:flex;gap:6px;margin-bottom:10px;align-items:flex-start">
            <textarea id="avt-anim-prompt-ta" rows="4" readonly style="flex:1;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.15);border-radius:6px;color:#7a92aa;font-size:0.64rem;resize:none;font-family:monospace">${promptTxt}</textarea>
            <button class="avt-mp-btn" onclick="_avtCopiarTexto('avt-anim-prompt-ta')" style="flex-shrink:0">⎘ Copiar</button>
          </div>
          <div style="font-size:0.7rem;color:#7a92aa;margin-bottom:5px">Cole o JSON retornado pela IA:</div>
          <textarea id="avt-anim-json-ta" rows="6" placeholder='{"parts":{...},"animations":{...}}'
            style="width:100%;box-sizing:border-box;padding:7px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#c8d8e8;font-size:0.7rem;resize:vertical;font-family:monospace"></textarea>
          <div id="avt-anim-status" style="font-size:0.7rem;min-height:1.4em;margin-top:5px"></div>
        </div>

        <!-- Tab: Top-Down IA -->
        <div id="avt-apar-tab-topdown-body" style="display:none">
          <p style="font-size:0.72rem;color:#7a92aa;margin:0 0 10px">Gere uma imagem top-down com IA externa e use-a como token animado no mapa de aventura.</p>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">① Descrição do personagem</div>
            <input id="avt-td-desc" placeholder="Ex: guerreiro élfico com espada longa e armadura prateada"
              style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-size:0.72rem">
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">② Prompt para IA gerar imagem</div>
            <textarea id="avt-td-gen-prompt" readonly rows="4"
              style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7a92aa;font-size:0.64rem;resize:none;font-family:monospace">${AVT_TOPDOWN_GEN_PROMPT(ent.nome)}</textarea>
            <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
              <button class="avt-mp-btn" onclick="(()=>{const d=document.getElementById('avt-td-desc').value||'${ent.nome}';const p=AVT_TOPDOWN_GEN_PROMPT(d);document.getElementById('avt-td-gen-prompt').value=p;navigator.clipboard?.writeText(p);mostrarToast('Prompt copiado!','ok')})()">⎘ Atualizar e copiar</button>
            </div>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">③ Upload da imagem gerada (PNG transparente)</div>
            <input type="file" id="avt-td-img" accept="image/png,image/webp,image/gif"
              onchange="_avtTdPreviewImagem(this)"
              style="font-size:0.7rem;color:#c8d8e8;width:100%">
            <div id="avt-td-img-preview" style="margin-top:6px"></div>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">④ Prompt para extrair coordenadas</div>
            <div style="font-size:0.65rem;color:#7a92aa;margin-bottom:4px">Envie a imagem + este prompt para a IA. Ela retornará JSON de coordenadas.</div>
            <textarea id="avt-td-coord-prompt" readonly rows="3"
              style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.2);border-radius:6px;color:#7a92aa;font-size:0.64rem;resize:none;font-family:monospace">${AVT_TOPDOWN_COORD_PROMPT.split('\n').slice(0,4).join('\n')}…</textarea>
            <button class="avt-mp-btn" style="margin-top:4px" onclick="navigator.clipboard?.writeText(AVT_TOPDOWN_COORD_PROMPT);mostrarToast('Prompt copiado!','ok')">⎘ Copiar prompt completo</button>
          </div>

          <div style="margin-bottom:12px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">⑤ Cole o JSON de coordenadas aqui</div>
            <textarea id="avt-td-coords-json" rows="4" placeholder='{"body_cx":0.5,"body_cy":0.55,"body_r":0.3,...}'
              style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-size:0.65rem;resize:vertical;font-family:monospace"></textarea>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">⑥ Imagem para a FICHA (corpo todo / perfil — opcional mas recomendado)</div>
            <input type="file" id="avt-td-ficha-img" accept="image/png,image/jpeg,image/webp"
              onchange="(function(i){const f=i.files?.[0];const p=document.getElementById('avt-td-ficha-preview');if(f&&p){p.innerHTML='<img src=\''+URL.createObjectURL(f)+'\' style=\'max-width:120px;max-height:140px;object-fit:contain;border-radius:6px;border:1px solid rgba(79,163,209,0.3)\'>'}})(this)"
              style="font-size:0.7rem;color:#c8d8e8;width:100%">
            <div id="avt-td-ficha-preview" style="margin-top:6px"></div>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;color:#4fa3d1;margin-bottom:4px">⑦ Orientação base da imagem do mapa</div>
            <select id="avt-td-base-facing"
              style="width:100%;box-sizing:border-box;padding:6px 8px;background:#0a0f18;border:1px solid rgba(79,163,209,0.3);border-radius:6px;color:#c8d8e8;font-size:0.72rem">
              <option value="down" selected>Olhando para BAIXO (padrão top-down)</option>
              <option value="up">Olhando para CIMA</option>
              <option value="right">Olhando para a DIREITA</option>
              <option value="left">Olhando para a ESQUERDA</option>
            </select>
          </div>

          <button onclick="_avtTopdownIaSalvar('${entId}')"
            style="width:100%;padding:8px;background:rgba(200,168,75,0.15);border:1px solid rgba(200,168,75,0.4);border-radius:8px;color:#c8a84b;cursor:pointer;font-family:var(--fonte-d);font-size:0.78rem">
            💾 Salvar token top-down + imagem da ficha</button>
        </div>

      </div>
      <div class="avt-modal-footer" id="avt-apar-footer-anim">
        <button class="avt-mp-btn" onclick="_avtAnimPreview()">👁 Validar JSON</button>
        <button class="avt-mp-btn" onclick="_avtAnimSalvar('${entId}')">💾 Salvar aparência</button>
      </div>
    </div>`;
}

function _avtAparTabSwitch(tab) {
  const isAnim = tab === 'anim';
  document.getElementById('avt-apar-tab-anim-body').style.display    = isAnim ? '' : 'none';
  document.getElementById('avt-apar-tab-topdown-body').style.display = isAnim ? 'none' : '';
  document.getElementById('avt-apar-footer-anim').style.display      = isAnim ? '' : 'none';
  document.getElementById('avt-apar-tab-anim').style.background    = isAnim ? 'rgba(79,163,209,0.25)' : 'rgba(79,163,209,0.07)';
  document.getElementById('avt-apar-tab-topdown').style.background  = isAnim ? 'rgba(200,168,75,0.07)' : 'rgba(200,168,75,0.2)';
}

function _avtTdPreviewImagem(input) {
  const f = input.files?.[0];
  const prev = document.getElementById('avt-td-img-preview');
  if (f && prev) {
    const url = URL.createObjectURL(f);
    prev.innerHTML = `<img src="${url}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1px solid rgba(79,163,209,0.3)">`;
  }
}

function _avtCopiarTexto(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const txt = el.value||el.textContent;
  (navigator.clipboard?.writeText(txt)||Promise.reject()).then(
    ()=>mostrarToast('Copiado!','ok'),
    ()=>{ const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();mostrarToast('Copiado!','ok'); }
  );
}

function _avtAnimPreview() {
  const txt = document.getElementById('avt-anim-json-ta')?.value?.trim();
  const st  = document.getElementById('avt-anim-status');
  if (!txt) return;
  try {
    const data = JSON.parse(txt);
    if (!data.parts) throw new Error('Falta o campo "parts"');
    const nP = Object.keys(data.parts).length;
    const nA = Object.keys(data.animations||{}).length;
    if (st) st.innerHTML = '<span style="color:#27ae60">✓ JSON válido — ' + nP + ' parte(s), ' + nA + ' animação(ões)</span>';
  } catch(e) {
    if (st) st.innerHTML = '<span style="color:#e74c3c">✗ JSON inválido: ' + e.message + '</span>';
  }
}

async function _avtAnimSalvar(entId) {
  const txt = document.getElementById('avt-anim-json-ta')?.value?.trim();
  if (!txt) { mostrarToast('Cole o JSON antes de salvar', 'aviso'); return; }
  let data;
  try { data = JSON.parse(txt); if (!data.parts) throw new Error(); }
  catch(e) { mostrarToast('JSON inválido', 'erro'); return; }
  const ent = AVT_STATE.entidades.find(e=>e.id===entId);
  const dbChar = AVT_STATE.chars.find(c=>c.id===ent?.dbId||c.nome===ent?.nome);
  if (!dbChar) { mostrarToast('Personagem não encontrado', 'erro'); return; }
  if (!dbChar.custom_attrs) dbChar.custom_attrs = {};
  dbChar.custom_attrs.animado_data = data;
  if (dbChar.id) {
    try {
      await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
        method:'PATCH', body:JSON.stringify({ custom_attrs:dbChar.custom_attrs })
      });
      mostrarToast('Aparência salva!', 'ok');
    } catch(e) { mostrarToast('Salvo localmente (erro DB)', 'aviso'); }
  }
  // Recarrega aparência da entidade correspondente para atualizar o token no mapa
  const entMapa = AVT_STATE.entidades.find(e => e.dbId === dbChar.id || e.nome === dbChar.nome);
  if (entMapa) _avtCarregarAparencia(entMapa);
  document.getElementById('avt-anim-import-overlay').style.display = 'none';
  _avtCharEditorRender();
}

async function _avtTopdownIaSalvar(entId) {
  const imgInput      = document.getElementById('avt-td-img');
  const fichaInput    = document.getElementById('avt-td-ficha-img');
  const coordsText    = document.getElementById('avt-td-coords-json')?.value?.trim();
  const baseFacing    = document.getElementById('avt-td-base-facing')?.value || 'down';

  // Resolve personagem cedo para podermos reaproveitar valores já salvos
  const ent = AVT_STATE.entidades.find(e => e.id === entId);
  const dbChar = AVT_STATE.chars.find(c => c.id === ent?.dbId || c.nome === ent?.nome);
  if (!dbChar) { mostrarToast('Personagem não encontrado', 'aviso'); return; }
  const prevTd = dbChar.custom_attrs?.topdown_ia || {};

  const novoTokenFile = imgInput?.files?.[0] || null;
  const novaFichaFile = fichaInput?.files?.[0] || null;

  // Precisa haver pelo menos algo novo (token, ficha ou coords) para salvar
  if (!novoTokenFile && !novaFichaFile && !coordsText) {
    mostrarToast('Nada para salvar — selecione token, ficha ou cole coords', 'aviso'); return;
  }
  // Token só é obrigatório se ainda não existir um salvo
  if (!novoTokenFile && !prevTd.img_url) {
    mostrarToast('Selecione a imagem top-down (passo ③)', 'aviso'); return;
  }

  let coords = prevTd.coords || null;
  if (coordsText) {
    try { coords = JSON.parse(coordsText); }
    catch(e) { mostrarToast('JSON de coordenadas inválido: ' + e.message, 'aviso'); return; }
  }
  if (!coords && novoTokenFile) {
    mostrarToast('Cole o JSON de coordenadas (passo ⑤)', 'aviso'); return;
  }

  mostrarToast('Salvando…', '');

  // Helper local: upload e devolve URL pública
  async function _upload(file, suffix) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const storagePath = `aventuras/${AVT_STATE.rpgId}/tokens/${entId}_${suffix}_${Date.now()}.${ext}`;
    const bucket = 'game-assets';
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SESSION.access_token}`,
        'Content-Type':  file.type || 'image/png',
        'Cache-Control': '3600',
        'x-upsert':      'true',
      },
      body: file,
    });
    if (!upRes.ok) throw new Error('Upload falhou: ' + await upRes.text());
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;
  }

  try {
    const publicUrl = novoTokenFile ? await _upload(novoTokenFile, 'map') : prevTd.img_url;
    const fichaUrl  = novaFichaFile ? await _upload(novaFichaFile, 'ficha') : (prevTd.ficha_img_url || null);

    const newAttrs = {
      ...(dbChar.custom_attrs || {}),
      topdown_ia: {
        img_url: publicUrl,
        ficha_img_url: fichaUrl,
        coords,
        base_facing: baseFacing
      }
    };
    await _avtSb('characters?id=eq.' + encodeURIComponent(dbChar.id), {
      method: 'PATCH', body: JSON.stringify({ custom_attrs: newAttrs })
    });
    dbChar.custom_attrs = newAttrs;
    _avtCharEditorRender();

    // Hot-reload appearance on the map
    if (ent) {
      delete AVT_STATE.aparencias[ent.id];
      _avtCarregarAparencia(ent);
    }

    // Notifica o módulo de ficha para refrescar a imagem (que estava cacheada / pré-gerada).
    // O módulo de ficha deve escutar 'avt:ficha-img-updated' e/ou expor window.fichaRefresh(nome).
    try {
      window.dispatchEvent(new CustomEvent('avt:ficha-img-updated', {
        detail: { charNome: dbChar.nome, charId: dbChar.id, fichaUrl, tokenUrl: publicUrl }
      }));
    } catch(_) {}
    if (typeof window.fichaRefresh === 'function') {
      try { window.fichaRefresh(dbChar.nome); } catch(_) {}
    }

    mostrarToast(novaFichaFile ? 'Token e imagem da ficha salvos!' : 'Token salvo!', 'ok');
    document.getElementById('avt-anim-import-overlay').style.display = 'none';
  } catch(err) {
    console.error('_avtTopdownIaSalvar:', err);
    mostrarToast('Erro ao salvar: ' + (err.message || String(err)), 'aviso');
  }
}
window._avtTopdownIaSalvar = _avtTopdownIaSalvar;
window._avtAparTabSwitch   = _avtAparTabSwitch;
window._avtTdPreviewImagem = _avtTdPreviewImagem;
