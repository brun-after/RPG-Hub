// systems/npcs.js
// RPG Hub — Generic NPC creation and placement on the campaign map
// Includes: abrirModalNpcGenerico(), criarNpcGenerico(), PLACEMENT_STATE

// ── NPC GENÉRICO DA MESA ─────────────────────────────────────

function abrirModalNpcGenerico() {
  if (!MAPA_STATE.mapaAtualId) {
    mostrarToast('Abra um mapa na Mesa antes de criar NPCs', 'erro');
    return;
  }
  document.getElementById('ng-nome').value = '';
  document.getElementById('ng-qtd').value = 1;
  document.getElementById('ng-hp').value = 100;
  document.getElementById('ng-cor').value = '#e8604c';
  document.getElementById('ng-img').value = '';
  document.getElementById('ng-posicionar').checked = true;

  // Renderizar campos de atributos básicos
  const basicos = (RPG_DATA.attrDefs || []).filter(a => (a.categoria || 'basico') === 'basico');
  const el = document.getElementById('ng-attrs-basicos');
  if (basicos.length) {
    el.innerHTML = '<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">🔷 Atributos Básicos</div>'
      + '<div class="form-grid" style="grid-template-columns:repeat(3,1fr);gap:8px">'
      + basicos.map(a => {
          const key = a.nome.replace(/[^a-z0-9]/gi,'_');
          if (a.tipo === 'number')  return `<div class="form-group"><label style="font-size:0.65rem">${a.nome}</label><input type="number" id="ng-attr-${key}" value="0" min="0"></div>`;
          if (a.tipo === 'text')    return `<div class="form-group" style="grid-column:span 3"><label style="font-size:0.65rem">${a.nome}</label><input type="text" id="ng-attr-${key}" value=""></div>`;
          if (a.tipo === 'boolean') return `<div class="form-group"><label style="font-size:0.65rem">${a.nome}</label><select id="ng-attr-${key}"><option value="false">Não</option><option value="true">Sim</option></select></div>`;
          if (a.tipo === 'select') {
            const ops = (a.opcoes||'').split(',').map(x=>x.trim()).filter(Boolean);
            return `<div class="form-group"><label style="font-size:0.65rem">${a.nome}</label><select id="ng-attr-${key}">${ops.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>`;
          }
          return '';
        }).join('')
      + '</div>';
  } else {
    el.innerHTML = '';
  }

  const overlay = document.getElementById('modal-npc-gen-overlay');
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalNpcGenerico(); };
  setTimeout(() => document.getElementById('ng-nome').focus(), 100);
}

function fecharModalNpcGenerico() {
  document.getElementById('modal-npc-gen-overlay').style.display = 'none';
}

async function criarNpcGenerico() {
  const nomeBase = document.getElementById('ng-nome').value.trim();
  if (!nomeBase) { mostrarToast('Nome é obrigatório', 'erro'); return; }
  const qtd  = Math.max(1, Math.min(20, parseInt(document.getElementById('ng-qtd').value) || 1));
  const hp   = parseInt(document.getElementById('ng-hp').value) || 100;
  const cor  = document.getElementById('ng-cor').value;
  const img  = document.getElementById('ng-img').value.trim();
  const posicionar = document.getElementById('ng-posicionar').checked;

  // Coletar atributos básicos preenchidos
  const basicos = (RPG_DATA.attrDefs || []).filter(a => (a.categoria || 'basico') === 'basico');
  const atributosBase = {};
  basicos.forEach(a => {
    const key = a.nome.replace(/[^a-z0-9]/gi,'_');
    const el  = document.getElementById('ng-attr-' + key);
    if (!el) return;
    atributosBase[a.nome] = a.tipo === 'number' ? (parseFloat(el.value) || 0)
                           : a.tipo === 'boolean' ? (el.value === 'true')
                           : el.value;
  });

  // Descobrir números já usados com este nome base
  const reEscape = nomeBase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const existentes = (RPG_DATA.characters || [])
    .map(c => c.nome)
    .filter(n => n === nomeBase || n.match(new RegExp(`^${reEscape} (\\d+)$`)))
    .map(n => { const m = n.match(/ (\d+)$/); return m ? parseInt(m[1]) : 0; });

  let proximoNum = Math.max(0, ...existentes) + 1;
  const criados = [];

  for (let i = 0; i < qtd; i++) {
    let nome;
    if (qtd === 1 && !existentes.length) {
      nome = nomeBase;
    } else {
      // Se o nome base sem número ainda não existe, usá-lo para o primeiro
      if (!existentes.includes(0) && i === 0 && !existentes.length) {
        nome = nomeBase;
      } else {
        nome = `${nomeBase} ${proximoNum++}`;
      }
    }

    const custom_attrs = {
      tipo_personagem: 'npc',
      tipo: 'npc',
      npc_generico: true,
      nome_base: nomeBase,
      cor,
      ...(img ? { img } : {}),
      atributos: { ...atributosBase },
    };

    try {
      const [row] = await sb('characters', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ rpg_id: RPG_DATA.rpgId, nome, hp_atual: hp, custom_attrs })
      });
      const char = row || { nome, hp_atual: hp, custom_attrs };
      RPG_DATA.characters.push(char);
      criados.push(nome);
    } catch(e) { mostrarToast('Erro ao criar ' + nome, 'erro'); }
  }

  fecharModalNpcGenerico();
  // Recarregar seletores de personagens
  if (typeof renderAttrButtons === 'function') renderAttrButtons();
  document.getElementById('char-select-row').innerHTML = buildCharBtns('char')
    + `<button class="char-btn" onclick="abrirModalNovoChar()" style="border-style:dashed;color:var(--suave)" title="Criar personagem ou NPC">＋</button>`;

  mostrarToast(criados.length + ' NPC(s) criado(s)!', 'sucesso');

  if (posicionar && criados.length > 0) {
    npcGenericoIniciarPlacement(criados);
  } else {
    const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mapaRenderStatus();
  }
}

// Posicionar NPCs criados um a um no mapa por clique
let NPC_PLACEMENT_QUEUE = [];

function npcGenericoIniciarPlacement(nomes) {
  NPC_PLACEMENT_QUEUE = [...nomes];
  npcGenericoProximoPlacement();
}

function npcGenericoProximoPlacement() {
  if (!NPC_PLACEMENT_QUEUE.length) {
    const entry = (RPG_DATA.mapas||[]).find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
    if (entry) mapaRenderTokens(entry.mapa);
    mapaRenderStatus();
    mostrarToast('Todos os NPCs posicionados!', 'sucesso');
    return;
  }
  const nome = NPC_PLACEMENT_QUEUE[0];
  const restante = NPC_PLACEMENT_QUEUE.length;
  mostrarToast('Clique no mapa: ' + nome + ' (' + restante + ' restante' + (restante>1?'s':'') + ')', '');
  const wrap = document.getElementById('mapa-wrap');
  wrap.classList.add('placement-ativo');
  const handler = (e) => {
    if (e.target.closest('.mapa-token') || e.target.closest('.mapa-zona')) return;
    const rect = wrap.getBoundingClientRect();
    let x = Math.max(2, Math.min(98, (e.clientX - rect.left) / rect.width  * 100));
    let y = Math.max(2, Math.min(98, (e.clientY - rect.top)  / rect.height * 100)); // let: o snap abaixo reatribui (com const era TypeError em runtime)
    wrap.classList.remove('placement-ativo');
    wrap.removeEventListener('click', handler);
    // Snap para centro da célula: converter %→célula→% exato
    const _snapMapa = _getMapaById(MAPA_STATE.mapaAtualId);
    if (_snapMapa) {
      const _snapPos = pctParaCelula(x, y, MAPA_STATE.mapaAtualId);
      x = (_snapPos.col + 0.5) / (_snapMapa.largura_total || 20) * 100;
      y = (_snapPos.row + 0.5) / (_snapMapa.altura_total  || 20) * 100;
    }
    setCharActiveMap(nome, MAPA_STATE.mapaAtualId, x, y).then(() => {
      NPC_PLACEMENT_QUEUE.shift();
      npcGenericoProximoPlacement();
    });
  };
  wrap.addEventListener('click', handler);
  wrap._npcPlacementHandler = handler;
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalNpcGenerico", { configurable: true, get: () => abrirModalNpcGenerico, set: (__v) => { abrirModalNpcGenerico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalNpcGenerico", { configurable: true, get: () => fecharModalNpcGenerico, set: (__v) => { fecharModalNpcGenerico = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "criarNpcGenerico", { configurable: true, get: () => criarNpcGenerico, set: (__v) => { criarNpcGenerico = __v; } });
Object.defineProperty(globalThis, "NPC_PLACEMENT_QUEUE", { configurable: true, get: () => NPC_PLACEMENT_QUEUE, set: (__v) => { NPC_PLACEMENT_QUEUE = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "npcGenericoIniciarPlacement", { configurable: true, get: () => npcGenericoIniciarPlacement, set: (__v) => { npcGenericoIniciarPlacement = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "npcGenericoProximoPlacement", { configurable: true, get: () => npcGenericoProximoPlacement, set: (__v) => { npcGenericoProximoPlacement = __v; } });
