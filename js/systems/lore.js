// systems/lore.js
// RPG Hub — Lore system: rendering, filtering, editing campaign knowledge entries
// Includes: renderLore(), filtrarLore(), abrirModalLore(), salvarLore(), removerLore()

function renderHeader(){document.getElementById('hdr-char').textContent=RPG_DATA.linked||'';}


// ── LORE ─────────────────────────────────────────────────────
function renderLore(){
 // Filtrar entradas internas do sistema (cache de chat, logs automáticos)
 const SECOES_INTERNAS = ['chat_cache', 'chat_log'];
 const SECOES_GM = ['segredos', 'segredo'];
 const isMestre = RPG_DATA?.myRole === 'mestre';
 const loreVisivel = (RPG_DATA.lore || []).filter(l =>
   !SECOES_INTERNAS.includes(l.secao) &&
   l.titulo !== '_cache' &&
   (isMestre || !SECOES_GM.includes(l.secao))
 );
 const secs=[...new Set(loreVisivel.map(l=>l.secao))];
 const podeEditarL = temPermissao('editar_lore');
 document.getElementById('lore-filtros').innerHTML=secs.map((s,i)=>`<button class="lore-filtro${i===0?' ativo':''}" onclick="filtrarLore('${s}',this)">${fmtSec(s)}</button>`).join('');
 document.getElementById('lore-items').innerHTML=loreVisivel.map(item=>`<div class="card lore-item${item.secao===secs[0]?' visivel':''}" data-secao="${item.secao}"><div class="lore-titulo" style="display:flex;align-items:center;gap:8px">${item.titulo}<span style="flex:1"></span>${podeEditarL?`<button onclick="abrirModalLore(${item.id})" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.85rem;padding:2px 4px;flex-shrink:0" title="Editar">✏️</button><button onclick="removerLore(${item.id},'${item.titulo.replace(/'/g,"\\'")}' )" style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.85rem;padding:2px 4px;flex-shrink:0" title="Remover">✕</button>`:''}</div><div class="lore-texto">${item.conteudo}</div></div>`).join('')
   +(podeEditarL?`<button onclick="abrirModalLore(null)" style="width:100%;margin-top:10px;padding:10px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase">＋ Nova Entrada de Lore</button>`:'');
}
function fmtSec(s){const m={mundo:'O Mundo',magia:'Magia',sociedade:'Sociedade',segredo:'Segredos',historia:'História',regras:'Regras',facoes:'Facções'};return m[s]||s.charAt(0).toUpperCase()+s.slice(1);}
function filtrarLore(s,btn){document.querySelectorAll('.lore-filtro').forEach(b=>b.classList.remove('ativo'));btn.classList.add('ativo');document.querySelectorAll('.lore-item').forEach(el=>el.classList.toggle('visivel',el.dataset.secao===s));}


// ── PERSONAGEM ────────────────────────────────────────────────
// Threshold: mostrar busca quando houver mais botões que cabem sem scroll
const CHAR_SEARCH_THRESHOLD = 5;

function renderCharButtons(){
  const row = document.getElementById('char-select-row');
  if (row) {
    row.innerHTML = buildCharBtns('char') +
      `<button class="char-btn" onclick="abrirModalNovoChar()" style="border-style:dashed;color:var(--suave)" title="Criar personagem ou NPC">＋</button>`;
    _charSearchToggle('char');
  }
  if (typeof renderFichasBtns === 'function') renderFichasBtns();
}

// Mostrar caixa de busca se tiver mais que o threshold
function _charSearchToggle(tab) {
  const prefix = tab === 'attr' ? 'attr' : 'char';
  const wrap = document.getElementById(prefix + '-search-wrap');
  if (!wrap) return;
  // Count visible buttons (deduplicated groups)
  const chars = RPG_DATA?.characters || [];
  const genBases = new Set();
  let total = 0;
  chars.forEach(c => {
    const ca = c.custom_attrs || {};
    if (ca.npc_generico) {
      const base = ca.nome_base || c.nome.replace(/ \d+$/, '');
      if (!genBases.has(base)) { genBases.add(base); total++; }
    } else {
      total++;
    }
  });
  wrap.classList.toggle('visivel', total > CHAR_SEARCH_THRESHOLD);
  // Limpar busca anterior ao re-render
  const inp = document.getElementById(prefix + '-search-input');
  if (inp) inp.value = '';
  const clr = document.getElementById(prefix + '-search-clear');
  if (clr) clr.style.display = 'none';
}

// Filtrar botões em tempo real
function charFiltrar(input, tab) {
  const q = input.value.trim().toLowerCase();
  const prefix = tab === 'attr' ? 'attr' : 'char';
  const row = document.getElementById(prefix + '-select-row');
  if (!row) return;
  const clr = document.getElementById(prefix + '-search-clear');
  if (clr) clr.style.display = q ? 'block' : 'none';
  row.querySelectorAll('.char-btn').forEach(btn => {
    const label = btn.textContent.toLowerCase();
    btn.style.display = (!q || label.includes(q)) ? '' : 'none';
  });
}

// Limpar busca
function charFiltrarLimpar(tab) {
  const prefix = tab === 'attr' ? 'attr' : 'char';
  const inp = document.getElementById(prefix + '-search-input');
  if (inp) { inp.value = ''; charFiltrar(inp, tab); inp.focus(); }
}
// Constrói botões de seleção de personagens.
// Ordem: Jogadores → NPCs especiais → Criaturas/genéricos (pets aparecem logo após seu dono).
function buildCharBtns(tab) {
  const chars = RPG_DATA.characters || [];
  const atualNome = tab === 'attr' ? ATTR_VIEW : CHAR_VIEW;
  const seen = new Set();
  const btns = [];

  // Helper: gera o HTML de um botão individual
  const makeBtn = (c, overrideLabel) => {
    const ca = c.custom_attrs || {};
    const nome = c.nome;
    const label = overrideLabel || nome;
    const ativo = nome === atualNome ? ' ativo' : '';
    return `<button class="char-btn${ativo}" onclick="selecionarChar('${nome.replace(/'/g,"\\'")}',this,'${tab}')">${label}</button>`;
  };

  // Helper: gera botão de grupo genérico (criatura com múltiplas instâncias)
  const makeGenBtn = (base, instancias) => {
    const rep = instancias[0];
    const count = instancias.length;
    const isAtivo = instancias.some(x => x.nome === atualNome) ? ' ativo' : '';
    const countTag = count > 1
      ? ` <span style='font-size:0.55rem;background:rgba(232,96,76,0.25);border-radius:8px;padding:1px 5px;color:#e8604c;margin-left:2px'>${count}</span>`
      : ' <span style=\'font-size:0.6rem;opacity:0.5\'>⚔</span>';
    return `<button class="char-btn${isAtivo}" onclick="selecionarChar('${rep.nome.replace(/'/g,"\\'")}',this,'${tab}')" title="${count} instância(s)">${base}${countTag}</button>`;
  };

  // Separar em grupos
  const jogadores    = chars.filter(c => {
    const t = c.custom_attrs?.tipo || c.custom_attrs?.tipo_personagem || 'jogador';
    return t === 'jogador' && !c.custom_attrs?.eh_pet;
  });
  const npcsEspeciais = chars.filter(c => {
    const t = c.custom_attrs?.tipo || c.custom_attrs?.tipo_personagem || 'jogador';
    return (t === 'npc') && !c.custom_attrs?.npc_generico && !c.custom_attrs?.eh_pet;
  });
  const criaturas = chars.filter(c => {
    const t = c.custom_attrs?.tipo || c.custom_attrs?.tipo_personagem || 'jogador';
    return (t === 'criatura' || t === 'objeto' || c.custom_attrs?.npc_generico) && !c.custom_attrs?.eh_pet;
  });
  const pets = chars.filter(c => c.custom_attrs?.eh_pet === true);

  // Função que insere pets vinculados a um dono logo após seu botão
  const adicionarComPets = (c, labelOverride) => {
    if (seen.has(c.nome)) return;
    seen.add(c.nome);
    btns.push(makeBtn(c, labelOverride));
    // Pets com pet_dono === c.nome aparecem imediatamente após
    const petsDoChar = pets.filter(p => p.custom_attrs?.pet_dono === c.nome);
    petsDoChar.forEach(pet => {
      if (seen.has(pet.nome)) return;
      seen.add(pet.nome);
      // Ícone de vínculo + nome do pet
      const petLabel = `<span style='font-size:0.6rem;opacity:0.5;margin-right:2px'>🐾</span>${pet.nome}`;
      btns.push(makeBtn(pet, petLabel));
    });
  };

  // 1. Jogadores (com seus pets)
  jogadores.forEach(c => adicionarComPets(c));

  // 2. NPCs especiais (com seus pets)
  npcsEspeciais.forEach(c => adicionarComPets(c));

  // 3. Criaturas / genéricos (agrupadas por nome_base se npc_generico, com seus pets)
  const genSeen = new Set();
  criaturas.forEach(c => {
    const ca = c.custom_attrs || {};
    if (ca.npc_generico) {
      const base = ca.nome_base || c.nome.replace(/ \d+$/, '');
      if (genSeen.has(base)) return;
      genSeen.add(base);
      const instancias = chars.filter(x => {
        const xb = x.custom_attrs?.nome_base || x.nome.replace(/ \d+$/, '');
        return xb === base && x.custom_attrs?.npc_generico;
      });
      instancias.forEach(i => seen.add(i.nome));
      btns.push(makeGenBtn(base, instancias));
    } else {
      adicionarComPets(c);
    }
  });

  // 4. Pets sem dono (pet_dono vazio ou dono não encontrado)
  pets.forEach(p => {
    if (seen.has(p.nome)) return;
    seen.add(p.nome);
    const petLabel = `<span style='font-size:0.6rem;opacity:0.5;margin-right:2px'>🐾</span>${p.nome}`;
    btns.push(makeBtn(p, petLabel));
  });

  return btns.join('');
}

function selecionarChar(nome, btn, tab) {
  // Shim: redireciona para fichasSelectChar
  if (typeof fichasSelectChar === 'function') {
    fichasSelectChar(nome, btn);
  } else {
    const p = tab === 'attr' ? 'attr-' : 'char-';
    document.querySelectorAll(`#${p}select-row .char-btn`).forEach(b => b.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');
    FICHAS_VIEW = CHAR_VIEW = ATTR_VIEW = nome;
    renderFichaView?.(nome);
  }
}


function renderCharView(nome) {
  // Shim: delegates to unified fichas system
  FICHAS_VIEW = CHAR_VIEW = nome;
  if (typeof renderFichaView === 'function') renderFichaView(nome);
}


// ── LORE CRUD — (movido de characters/skills.js) ────────────────
// ── 14D: LORE ────────────────────────────────────────────────
function abrirModalLore(loreId) {
  const overlay = document.getElementById('modal-lore-overlay');
  document.getElementById('modal-lore-id').value = loreId || '';
  if (loreId) {
    const l = RPG_DATA.lore.find(x => x.id === loreId);
    if (!l) return;
    document.getElementById('modal-lore-titulo').textContent = 'Editar Lore';
    document.getElementById('lore-titulo-input').value = l.titulo || '';
    document.getElementById('lore-secao-input').value = l.secao || '';
    document.getElementById('lore-conteudo-input').value = l.conteudo || '';
  } else {
    document.getElementById('modal-lore-titulo').textContent = 'Nova Entrada de Lore';
    document.getElementById('lore-titulo-input').value = '';
    document.getElementById('lore-secao-input').value = '';
    document.getElementById('lore-conteudo-input').value = '';
  }
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalLore(); };
}
function fecharModalLore() {
  document.getElementById('modal-lore-overlay').style.display = 'none';
}
async function salvarLore() {
  if (!temPermissao('editar_lore')) { mostrarToast('Sem permissão para editar Lore', 'erro'); return; }
  const loreId = document.getElementById('modal-lore-id').value;
  const titulo = document.getElementById('lore-titulo-input').value.trim();
  const secao = document.getElementById('lore-secao-input').value.trim() || 'mundo';
  const conteudo = document.getElementById('lore-conteudo-input').value.trim();
  if (!titulo) { mostrarToast('Título obrigatório', 'erro'); return; }
  const body = { rpg_id: RPG_DATA.rpgId, titulo, secao, conteudo };
  try {
    if (loreId) {
      await sb(`lore?id=eq.${encodeURIComponent(loreId)}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = RPG_DATA.lore.findIndex(l => l.id == loreId);
      if (idx >= 0) RPG_DATA.lore[idx] = { ...RPG_DATA.lore[idx], ...body };
    } else {
      const [novo] = await sb('lore', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(body) });
      RPG_DATA.lore.push(novo || body);
    }
    fecharModalLore();
    renderLore();
    mostrarToast('Lore salvo!', 'sucesso');
  } catch(e) { mostrarToast('Erro ao salvar lore', 'erro'); }
}
async function removerLore(loreId, titulo) {
  if (!temPermissao('editar_lore')) { mostrarToast('Sem permissão para editar Lore', 'erro'); return; }
  if (!confirm(`Remover "${titulo}"?`)) return;
  try {
    await sb(`lore?id=eq.${encodeURIComponent(loreId)}`, { method: 'DELETE' });
    RPG_DATA.lore = RPG_DATA.lore.filter(l => l.id != loreId);
    renderLore();
    mostrarToast('Entrada removida', 'sucesso');
  } catch(e) { mostrarToast('Erro ao remover lore', 'erro'); }
}
