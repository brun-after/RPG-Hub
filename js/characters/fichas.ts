// fichas.js — Aba unificada Fichas (substitui Personagem + Atributos)
// Accordion: Aparência / Personagem / Atributos  + Inventário ao final

// ── Seleção de personagem ─────────────────────────────────────
function fichasSelectChar(nome: any, btn: any) {
  document.querySelectorAll('#fichas-select-row .char-btn').forEach(b => b.classList.remove('ativo'));
  if (btn) btn.classList.add('ativo');
  FICHAS_VIEW = CHAR_VIEW = ATTR_VIEW = nome;
  renderFichaView(nome);
}

// ── Filtro de busca ───────────────────────────────────────────
function fichasFiltrar(input: any) {
  const q = (input.value || '').trim().toLowerCase();
  const row = document.getElementById('fichas-select-row');
  if (!row) return;
  const clr = document.getElementById('fichas-search-clear');
  if (clr) clr.style.display = q ? 'block' : 'none';
  row.querySelectorAll('.char-btn').forEach(btn => {
    btn.style.display = (!q || btn.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}

function fichasFiltrarLimpar() {
  const inp = document.getElementById('fichas-search-input');
  if (inp) { inp.value = ''; fichasFiltrar(inp); inp.focus(); }
  const clr = document.getElementById('fichas-search-clear');
  if (clr) clr.style.display = 'none';
}

// ── Construção dos botões de personagem ──────────────────────
function buildFichasBtns() {
  const chars = RPG_DATA?.characters || [];
  const atualNome = FICHAS_VIEW;
  const seen = new Set();
  const btns = [];

  const makeBtn = (c: any, labelHtml: any) => {
    const ca = c.custom_attrs || {};
    const cor = ca.cor || 'var(--primario)';
    const ativo = c.nome === atualNome ? ' ativo' : '';
    const nomeSafe = c.nome.replace(/'/g, "\\'");
    return `<button class="char-btn${ativo}" onclick="fichasSelectChar('${nomeSafe}',this)" style="border-left:3px solid ${cor}">${labelHtml || c.nome}</button>`;
  };

  const makeGenBtn = (base: any, instancias: any) => {
    const rep = instancias[0];
    const ca = rep.custom_attrs || {};
    const cor = ca.cor || 'var(--primario)';
    const count = instancias.length;
    const isAtivo = instancias.some((x: any) => x.nome === atualNome) ? ' ativo' : '';
    const nomeSafe = rep.nome.replace(/'/g, "\\'");
    const countTag = count > 1
      ? ` <span style='font-size:0.55rem;background:rgba(232,96,76,0.25);border-radius:8px;padding:1px 5px;color:#e8604c;margin-left:2px'>${count}</span>`
      : ` <span style='font-size:0.6rem;opacity:0.5'>⚔</span>`;
    return `<button class="char-btn${isAtivo}" onclick="fichasSelectChar('${nomeSafe}',this)" style="border-left:3px solid ${cor}" title="${count} instância(s)">${base}${countTag}</button>`;
  };

  const pets = chars.filter(c => c.custom_attrs?.eh_pet === true);

  const adicionarComPets = (c: any, labelOverride?: any) => {
    if (seen.has(c.nome)) return;
    seen.add(c.nome);
    btns.push(makeBtn(c, labelOverride));
    pets.filter(p => p.custom_attrs?.pet_dono === c.nome).forEach(pet => {
      if (seen.has(pet.nome)) return;
      seen.add(pet.nome);
      btns.push(makeBtn(pet, `<span style='font-size:0.6rem;opacity:0.5;margin-right:2px'>🐾</span>${pet.nome}`));
    });
  };

  const jogadores   = chars.filter(c => { const t = c.custom_attrs?.tipo || 'jogador'; return t === 'jogador' && !c.custom_attrs?.eh_pet; });
  const npcs        = chars.filter(c => { const t = c.custom_attrs?.tipo || 'jogador'; return t === 'npc' && !c.custom_attrs?.npc_generico && !c.custom_attrs?.eh_pet; });
  const criaturas   = chars.filter(c => { const t = c.custom_attrs?.tipo || 'jogador'; return (t === 'criatura' || t === 'objeto' || c.custom_attrs?.npc_generico) && !c.custom_attrs?.eh_pet; });

  jogadores.forEach(c => adicionarComPets(c));
  npcs.forEach(c => adicionarComPets(c));

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

  pets.forEach(p => {
    if (seen.has(p.nome)) return;
    seen.add(p.nome);
    btns.push(makeBtn(p, `<span style='font-size:0.6rem;opacity:0.5;margin-right:2px'>🐾</span>${p.nome}`));
  });

  const isMestre = RPG_DATA?.myRole === 'mestre';
  if (isMestre) {
    btns.push(`<button class="char-btn" onclick="abrirModalNovoChar()" style="border-style:dashed;color:var(--suave)" title="Criar personagem ou NPC">＋</button>`);
  }

  return btns.join('');
}

// ── Renderiza botões na aba Fichas ───────────────────────────
function renderFichasBtns() {
  const row = document.getElementById('fichas-select-row');
  if (!row) return;
  row.innerHTML = buildFichasBtns();

  // Visibilidade da busca
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
  const wrap = document.getElementById('fichas-search-wrap');
  if (wrap) wrap.classList.toggle('visivel', total > 5);

  // Auto-selecionar personagem vinculado para jogadores
  if (!FICHAS_VIEW && RPG_DATA?.linked) {
    const linkedBtn = row.querySelector(`.char-btn`);
    // Procurar botão do personagem vinculado
    const allBtns = row.querySelectorAll('.char-btn');
    for (const btn of allBtns) {
      if (btn.textContent.trim() === RPG_DATA.linked) {
        fichasSelectChar(RPG_DATA.linked, btn);
        return;
      }
    }
  }

  // Se já há um selecionado, re-renderizar
  if (FICHAS_VIEW) {
    renderFichaView(FICHAS_VIEW);
  }
}

// ── Accordion toggle ─────────────────────────────────────────
function fichasToggleSection(id: any) {
  const body = document.getElementById('fichas-sec-' + id);
  if (!body) return;
  body.classList.toggle('open');
  const icon = document.getElementById('fichas-ico-' + id);
  if (icon) icon.textContent = body.classList.contains('open') ? '▲' : '▼';
  if (id === 'aparencia' && body.classList.contains('open')) {
    requestAnimationFrame(() => { window._animScheduleTokenMount?.(true); });
  }
}

function _fichasAccordion(id: any, titulo: any, conteudo: any, aberto: any) {
  const openClass = aberto ? ' open' : '';
  const icone = aberto ? '▲' : '▼';
  return `<div class="fichas-accordion">
    <div class="fichas-accordion-header" onclick="fichasToggleSection('${id}')">
      <span>${titulo}</span>
      <span id="fichas-ico-${id}" style="font-size:0.65rem">${icone}</span>
    </div>
    <div class="fichas-accordion-body${openClass}" id="fichas-sec-${id}">
      ${conteudo}
    </div>
  </div>`;
}

// ── Toggle dos formulários de edição ─────────────────────────
function fichasToggleEditPersonagem(nome: any) {
  document.getElementById('edit-char-form-' + nome)?.classList.toggle('aberto');
}

function fichasToggleEditAtributos(nome: any) {
  document.getElementById('edit-form-' + nome)?.classList.toggle('aberto');
}

// ── HP rápido ────────────────────────────────────────────────
async function fichasHpStep(nome: any, delta: any) {
  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const hp_max = ca.hp_max || 100;
  const novoHp = Math.max(0, Math.min(hp_max, (c.hp_atual ?? hp_max) + delta));
  c.hp_atual = novoHp;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ hp_atual: novoHp }) });
    renderFichaView(nome);
    mapaRenderTokens?.(MAPA_STATE?.mapaAtivo);
    mapaRenderStatus?.();
  } catch(e) { mostrarToast('Erro ao salvar HP', 'erro'); }
}

// ── Seção: Aparência ─────────────────────────────────────────
function _fichasSecAparencia(c: any, ca: any, cor: any, podEditar: any) {
  const ap = ca.aparencia;
  const nomeSafe = c.nome.replace(/'/g, "\\'");

  let previewHtml = '';
  if (typeof apmodTokenSVG === 'function' && ap) {
    const tokenHtml = apmodTokenSVG(c);
    if (tokenHtml) {
      previewHtml = `<div class="fichas-token-preview">
        <div style="border-radius:8px;border:2px solid ${cor}44;background:rgba(0,0,0,0.3);padding:6px;display:inline-flex;align-items:center;justify-content:center;min-width:60px;min-height:60px">
          ${tokenHtml}
        </div>
      </div>`;
    }
  }
  if (!previewHtml) {
    const imgUrl = normalizeImgUrl?.(ca.img || ca.img_url || '') || '';
    if (imgUrl) {
      previewHtml = `<div class="fichas-token-preview">
        <div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:2px solid ${cor}">
          <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">
        </div>
      </div>`;
    } else {
      previewHtml = `<div class="fichas-token-preview">
        <div class="fichas-token-circle" style="background:${cor}18;border:2px solid ${cor}44;width:60px;height:60px">
          ${c.nome[0] || '?'}
        </div>
      </div>`;
    }
  }

  const modoLabel = ap?.modo === 'animado' ? '🎬 Animado' : ap?.modo === 'imagem' ? '🖼 Imagem' : '— sem aparência';
  const editBtn = podEditar
    ? `<button onclick="abrirModalAparencia('${nomeSafe}')" style="padding:7px 14px;background:linear-gradient(135deg,rgba(79,163,209,0.14),rgba(79,163,209,0.06));border:1px solid rgba(79,163,209,0.35);border-radius:7px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">🎨 Editar Aparência</button>`
    : '';

  return `
    ${previewHtml}
    <div style="text-align:center;font-family:var(--fonte-d);font-size:0.65rem;color:var(--suave);margin-bottom:12px">${modoLabel}</div>
    <div class="fichas-aparencia-btns">${editBtn}</div>`;
}

// ── Seção: Personagem ─────────────────────────────────────────
function _fichasSecPersonagem(c: any, ca: any, cor: any, podEditar: any, isMestre: any, nivel: any, xp: any, hp: any, hp_max: any, nivel_maximo: any) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const xp_proximo = nivel < nivel_maximo ? nivel * 100 : null;
  const xp_pct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 100;
  const hpPct = Math.min(100, Math.round((hp / hp_max) * 100));
  const sk = typeof _skFiltrarPorChar === 'function' ? _skFiltrarPorChar(RPG_DATA.skills, c.nome) : [];

  const levelUpHtml = isMestre && nivel < nivel_maximo
    ? `<button onclick="abrirModalLevelUp('${nomeSafe}')" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08));border:1px solid rgba(200,168,75,0.5);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.7rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">⬆ Level Up — Nível ${nivel} → ${nivel + 1}</button>`
    : '';

  const skH = sk.map((s: any) => {
    const sId = s.id;
    const nivelNecessario = s.nivel_necessario || 1;
    const bloqueada = nivelNecessario > nivel;
    const botoesSkill = podEditar
      ? `<button onclick="abrirModalSkill('${sId}')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.9rem;padding:2px 4px" title="Editar">✏️</button>`
        + `<button onclick="removerSkill('${sId}','${s.habilidade.replace(/'/g, "\\'")}','${nomeSafe}')" style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.9rem;padding:2px 4px" title="Remover">✕</button>`
      : '';
    return `<div class="skill-item" style="${bloqueada ? 'opacity:0.45;' : ''}">
      <div class="skill-header">
        <div class="skill-nome">${s.habilidade}${bloqueada ? ` <span style="font-size:0.6rem;color:var(--suave)">(Nível ${nivelNecessario})</span>` : ''}</div>
        ${s.custo_rsv ? `<span class="badge badge-roxo">${s.custo_rsv}</span>` : ''}
        ${botoesSkill}
      </div>
      <div class="skill-efeito">${s.efeito}</div>
    </div>`;
  }).join('');

  const editFormHtml = podEditar ? `
    <div style="margin-top:4px">
      <button class="fichas-edit-toggle" onclick="fichasToggleEditPersonagem('${nomeSafe}')">✏ Editar Personagem</button>
    </div>
    <div class="edit-form" id="edit-char-form-${c.nome}">
      <div class="card-titulo" style="margin-bottom:12px">Informações — ${c.nome}</div>
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1"><label>Nome do Personagem</label><input type="text" id="fc-nome" value="${c.nome}" style="text-align:left"></div>
        <div class="form-group"><label>Tipo</label>
          <select id="fc-tipo" style="width:100%;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem">
            <option value="jogador"${(ca.tipo || 'jogador') === 'jogador' ? ' selected' : ''}>Jogador</option>
            <option value="npc"${ca.tipo === 'npc' ? ' selected' : ''}>NPC</option>
            <option value="criatura"${ca.tipo === 'criatura' ? ' selected' : ''}>Criatura</option>
            <option value="objeto"${ca.tipo === 'objeto' ? ' selected' : ''}>Objeto</option>
          </select>
        </div>
        ${(ca.tipo === 'npc' || ca.tipo === 'criatura') ? `
        <div class="form-group"><label>Facção</label>
          <select id="fc-faction" style="width:100%;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem">
            <option value="inimigo"${(ca.npc_faction || 'inimigo') === 'inimigo' ? ' selected' : ''}>⚔ Inimigo</option>
            <option value="neutro"${ca.npc_faction === 'neutro' ? ' selected' : ''}>⚪ Neutro</option>
            <option value="aliado"${ca.npc_faction === 'aliado' ? ' selected' : ''}>💚 Aliado</option>
          </select>
        </div>` : ''}
        <div class="form-group"><label>Cor do token</label><input type="color" id="fc-cor" value="${ca.cor || '#4fa3d1'}" style="width:100%;padding:4px;height:36px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Classe / Profissão</label><input type="text" id="fc-classe" value="${ca.classe || ''}" placeholder="Ex: Guerreiro, Mago…" style="text-align:left"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Raça / Espécie</label><input type="text" id="fc-raca" value="${ca.raca || ''}" placeholder="Ex: Humano, Elfo…" style="text-align:left"></div>
      </div>
      <div class="form-group" style="margin-bottom:10px"><label>Background / História</label>
        <textarea id="fc-background" rows="3" placeholder="História e contexto…" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem;resize:vertical">${ca.background || ''}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:10px"><label>Companheiro / Familiar</label>
        <input type="text" id="fc-companheiro" value="${ca.companheiro || ''}" placeholder="Animal, NPC parceiro…" style="text-align:left">
      </div>
      <div style="margin-bottom:10px;padding:10px 12px;background:rgba(126,200,240,0.04);border:1px solid rgba(126,200,240,0.15);border-radius:8px">
        <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--primario-v);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">🐾 Pet / Montaria</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--texto);cursor:pointer;margin-bottom:8px">
          <input type="checkbox" id="fc-eh-pet" ${ca.eh_pet ? 'checked' : ''} style="accent-color:var(--primario)" onchange="document.getElementById('fc-pet-dono-wrap').style.display=this.checked?'block':'none'">
          Este personagem é um pet / montaria
        </label>
        <div id="fc-pet-dono-wrap" style="display:${ca.eh_pet ? 'block' : 'none'}">
          <label style="font-size:0.75rem;color:var(--suave);display:block;margin-bottom:4px">Dono do pet</label>
          <select id="fc-pet-dono" style="width:100%;padding:7px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.8rem">
            <option value="">— selecione —</option>
            ${(RPG_DATA?.characters || []).filter(x => x.nome !== c.nome && !x.custom_attrs?.eh_pet).map(x => `<option value="${x.nome}"${ca.pet_dono === x.nome ? ' selected' : ''}>${x.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primario" style="flex:2" onclick="salvarInfoPersonagem('${nomeSafe}')">Salvar</button>
        <button class="btn btn-secundario" style="flex:1" onclick="fichasToggleEditPersonagem('${nomeSafe}')">Cancelar</button>
      </div>
      ${isMestre ? `<button onclick="excluirPersonagemCompleto('${nomeSafe}', false)" style="width:100%;margin-top:8px;padding:9px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.25);border-radius:8px;color:#c0392b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase">🗑 Excluir Personagem</button>` : ''}
      ${(isMestre && (ca.tipo_personagem || ca.tipo) === 'npc') ? `
      <div style="margin-top:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px">
        <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer">
          <input type="checkbox" onchange="charviewToggleOcultarAtribs('${nomeSafe}',this.checked)" ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
          🔒 Ocultar atributos para jogadores
        </label>
      </div>` : ''}
    </div>
  ` : `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Somente ${c.nome} ou o mestre podem editar.</div>`;

  return `
    ${levelUpHtml}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-family:var(--fonte-d);font-size:1rem;color:var(--texto)">${c.nome}</div>
        <div style="font-size:0.78rem;color:${cor};font-style:italic">${ca.tipo || 'jogador'} · Nível ${nivel}${ca.classe ? ' · ' + ca.classe : ''}${ca.raca ? ' · ' + ca.raca : ''}</div>
        ${RPG_DATA?.linked === c.nome ? '<div style="margin-top:3px;font-family:var(--fonte-d);font-size:0.55rem;color:var(--primario-v);letter-spacing:0.05em">⚔ Seu personagem</div>' : ''}
      </div>
    </div>
    <div class="fichas-hp-row">
      ${podEditar ? `<button class="fichas-hp-btn" onclick="fichasHpStep('${nomeSafe}',-1)">−</button>` : ''}
      <div style="flex:1">
        <div class="barra-container barra-hp" style="margin-bottom:0">
          <div class="barra-header"><span class="barra-nome">HP</span><span class="barra-num" style="color:var(--perigo)">${hp} / ${hp_max}</span></div>
          <div class="barra-bg"><div class="barra-fill" style="width:${hpPct}%"></div></div>
        </div>
      </div>
      ${podEditar ? `<button class="fichas-hp-btn" onclick="fichasHpStep('${nomeSafe}',1)">＋</button>` : ''}
    </div>
    ${xp_proximo != null ? `
    <div class="barra-container" style="margin-top:6px;margin-bottom:10px">
      <div class="barra-header"><span class="barra-nome" style="color:var(--destaque)">XP</span><span style="font-size:0.75rem;color:var(--suave)">${xp} / ${xp_proximo}</span></div>
      <div class="xp-barra-bg"><div class="xp-barra" style="width:${xp_pct}%"></div></div>
    </div>` : `<div style="font-size:0.7rem;color:var(--destaque);margin:6px 0 10px;text-align:center">✦ Nível Máximo</div>`}
    ${ca.background ? `<div class="card"><div class="card-titulo">História</div><div style="font-size:0.9rem;line-height:1.7">${ca.background}</div></div>` : ''}
    ${ca.companheiro ? `<div class="card"><div class="card-titulo">Companheiro</div><div style="font-size:0.9rem">${ca.companheiro}</div></div>` : ''}
    <div class="card" style="margin-top:8px">
      <div class="card-titulo">Habilidades</div>
      ${skH || '<div style="color:var(--suave);font-style:italic">Nenhuma habilidade</div>'}
      ${podEditar ? `<button onclick="abrirModalSkill(null,'${nomeSafe}')" style="width:100%;margin-top:10px;padding:8px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase">＋ Adicionar Skill</button>` : ''}
    </div>
    ${editFormHtml}`;
}

// ── Seção: Atributos ──────────────────────────────────────────
function _fichasSecAtributos(c: any, ca: any, cor: any, podEditar: any, isMestre: any) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const ad = RPG_DATA?.attrDefs || [];
  const atribs = ca.atributos || {};
  const hp_max = ca.hp_max || 100;
  const hp = c.hp_atual ?? hp_max;
  const hpPct = Math.min(100, Math.round((hp / hp_max) * 100));

  const tipoChar = ca.tipo_personagem || ca.tipo || 'jogador';
  const ehNpc = tipoChar === 'npc';
  const ocultarAtribs = !isMestre && ehNpc && ca.ocultar_atributos === true;
  const somenteBasico = ca.npc_generico === true;

  const adVisiveis = ocultarAtribs ? [] : ad.filter(a => somenteBasico ? ['basico', 'resistencia'].includes(a.categoria || 'basico') : true);
  const adBasicos     = adVisiveis.filter(a => (a.categoria || 'basico') === 'basico');
  const adEspeciais   = adVisiveis.filter(a => a.categoria === 'especial');
  const adStatus      = adVisiveis.filter(a => a.categoria === 'status');
  const adResistencia = adVisiveis.filter(a => a.categoria === 'resistencia');

  const renderStatBox = (a: any, cor_: any) => {
    const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
    return `<div class="stat-box" style="border-top:2px solid ${cor_}"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:${cor_}">${v}</div></div>`;
  };

  const renderStatusBar = (a: any) => {
    const v = parseFloat(atribs[a.nome]) || 0;
    let maxVal = v;
    try {
      const cfg = JSON.parse(a.opcoes || '{}');
      if (cfg.max_base !== undefined) {
        const av = parseFloat(atribs[cfg.max_attr] || 0);
        maxVal = (cfg.max_base || 0) + av * (cfg.max_mult || 0);
      }
    } catch(e) {}
    if (maxVal > 0 && maxVal !== v) {
      const pct = Math.round(Math.min(v / maxVal, 1) * 100);
      return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.65rem;color:#4fa3d1;margin-bottom:3px"><span>${a.nome}</span><span>${v} / ${Math.round(maxVal)}</span></div><div style="height:6px;background:rgba(79,163,209,0.15);border-radius:3px"><div style="height:100%;width:${pct}%;background:#4fa3d1;border-radius:3px;transition:width 0.3s"></div></div></div>`;
    }
    return `<div class="stat-box" style="border-top:2px solid #4fa3d1"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:#4fa3d1">${v}</div></div>`;
  };

  const boxes = (adStatus.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#4fa3d1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">📊 Recursos</div><div class="stats-grid">${adStatus.map(renderStatusBar).join('')}</div>` : '')
    + (adBasicos.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">🔷 Básicos</div><div class="stats-grid">${adBasicos.map(a => renderStatBox(a, cor)).join('')}</div>` : '')
    + (adEspeciais.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">✨ Especiais</div><div class="stats-grid">${adEspeciais.map(a => renderStatBox(a, '#b07ef0')).join('')}</div>` : '')
    + (adResistencia.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#e8a020;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">🛡 Defesas</div><div class="stats-grid">${adResistencia.map(a => renderStatBox(a, '#e8a020')).join('')}</div>` : '')
    + (ocultarAtribs ? `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:10px 0">— atributos não revelados —</div>` : '');

  // Salvaguardas de morte
  const moribundoHtml = ca.moribundo ? (() => {
    const salv = ca.salvaguardas || { sucessos: 0, falhas: 0 };
    return `<div style="background:rgba(142,68,173,0.12);border:1px solid rgba(142,68,173,0.4);border-radius:8px;padding:8px 12px;margin-bottom:10px;text-align:center">
      <div style="font-family:var(--fonte-d);font-size:0.65rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">☠ Moribundo — Salvaguardas de Morte</div>
      <div style="font-size:0.78rem;color:var(--texto)">✔ ${salv.sucessos}/2  &nbsp; ✘ ${salv.falhas}/3</div>
    </div>`;
  })() : '';

  // Distribuição de pontos
  const pontos_attr = ca.pontos_attr || 0;
  const pontosHtml = pontos_attr > 0 ? `
    <div class="card" style="border-left:3px solid var(--destaque);margin-top:10px">
      <div class="card-titulo">⭐ ${pontos_attr} Ponto${pontos_attr > 1 ? 's' : ''} de Atributo</div>
      <div style="font-size:0.85rem;color:var(--suave);margin-bottom:10px">Distribua seus pontos:</div>
      <div class="form-grid">
        ${ad.filter(a => a.tipo === 'number' && (a.categoria === 'basico' || a.categoria === 'especial' || !a.categoria)).map(a => {
          const k = 'pa-' + a.nome.replace(/[^a-z0-9]/gi, '_');
          return `<div class="form-group"><label>${a.nome} (atual: ${atribs[a.nome] || 0})</label><input type="number" id="${k}" value="0" min="0" placeholder="+0"></div>`;
        }).join('')}
      </div>
      <button class="btn btn-primario" onclick="distribuirPontosAttr('${nomeSafe}')">Aplicar Pontos</button>
    </div>` : '';

  // Toggle ocultar atributos (mestre + NPC)
  const ocultarToggle = (isMestre && ehNpc) ? `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px;margin-top:10px">
      <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer;flex:1">
        <input type="checkbox" id="attrview-toggle-ocultar" onchange="attrviewToggleOcultarAtribs('${nomeSafe}')" ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
        Ocultar atributos para jogadores
      </label>
    </div>` : '';

  // Formulário de edição
  const renderEditField = (a: any) => {
    const key = a.nome.replace(/[^a-z0-9]/gi, '_');
    if (a.tipo === 'number') return `<div class="form-group"><label>${a.nome}</label><input type="number" id="fca-${key}" value="${atribs[a.nome] || 0}" min="0"></div>`;
    if (a.tipo === 'text')   return `<div class="form-group"><label>${a.nome}</label><input type="text" id="fca-${key}" value="${atribs[a.nome] || ''}"></div>`;
    if (a.tipo === 'boolean') return `<div class="form-group"><label>${a.nome}</label><select id="fca-${key}"><option value="true"${atribs[a.nome] === true || atribs[a.nome] === 'true' ? ' selected' : ''}>Sim</option><option value="false"${!atribs[a.nome] ? ' selected' : ''}>Não</option></select></div>`;
    if (a.tipo === 'select') {
      const ops = (a.opcoes || '').split(',').map((x: any) => x.trim()).filter(Boolean);
      return `<div class="form-group"><label>${a.nome}</label><select id="fca-${key}">${ops.map((o: any) => `<option value="${o}"${atribs[a.nome] === o ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
    }
    return '';
  };

  const editCust = adVisiveis.filter(a => (a.categoria !== 'resistencia' || isMestre) && a.categoria !== 'status').map(renderEditField).join('');
  const editStatus = adStatus.map(a => {
    const key = a.nome.replace(/[^a-z0-9]/gi, '_');
    let maxLabel = '';
    try {
      const cfg = JSON.parse(a.opcoes || '{}');
      if (cfg.max_base !== undefined) {
        const av = parseFloat(atribs[cfg.max_attr] || 0);
        maxLabel = ` / ${Math.ceil(cfg.max_base + av * (cfg.max_mult || 0))}`;
      }
    } catch(e) {}
    return `<div class="form-group"><label>${a.nome}${maxLabel}</label><input type="number" id="fca-${key}" value="${atribs[a.nome] || 0}" min="0"></div>`;
  }).join('');

  const editFormHtml = podEditar ? `
    <div style="margin-top:10px">
      <button class="fichas-edit-toggle" onclick="fichasToggleEditAtributos('${nomeSafe}')">✏ Editar Atributos</button>
    </div>
    <div class="edit-form" id="edit-form-${c.nome}">
      <div class="card-titulo" style="margin-bottom:12px">Atributos — ${c.nome}</div>
      <div class="form-grid">
        <div class="form-group"><label>HP Atual</label><input type="number" id="f-hp_atual" value="${hp}" min="0" max="${hp_max}"></div>
        ${editStatus}
        ${editCust}
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-primario" style="flex:2" onclick="salvarAtributos('${nomeSafe}')">Salvar</button>
        <button class="btn btn-secundario" style="flex:1" onclick="fichasToggleEditAtributos('${nomeSafe}')">Cancelar</button>
      </div>
    </div>` : '';

  return `
    ${moribundoHtml}
    ${boxes}
    ${pontosHtml}
    ${ocultarToggle}
    ${editFormHtml}`;
}

// ── Renderizar a ficha completa ───────────────────────────────
async function renderFichaView(nome: any) {
  const container = document.getElementById('fichas-view');
  if (!container) return;

  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  if (!c) { container.innerHTML = ''; return; }

  const ca = c.custom_attrs || {};
  const cor = ca.cor || 'var(--primario)';
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podEditar = typeof podeEditarPersonagem === 'function' ? podeEditarPersonagem(nome) : (isMestre || RPG_DATA?.linked === nome);
  const nivel = ca.nivel || 1;
  const xp = ca.xp || 0;
  const hp_max = ca.hp_max || 100;
  const hp = c.hp_atual ?? hp_max;
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel_maximo = lc.nivel_maximo || 20;

  const ap = ca.aparencia;
  const semAparencia = !ap || (!ap.img_frente && !ap.img_iso && !ap.composed_img && !ap.animado?.parts);
  const temAnimado = ap?.modo === 'animado' && ap?.animado?.parts && Object.keys(ap.animado.parts).length > 0;
  const aparenciaAberta = (podEditar && semAparencia) || temAnimado;

  const secAparencia = _fichasSecAparencia(c, ca, cor, podEditar);
  const secPersonagem = _fichasSecPersonagem(c, ca, cor, podEditar, isMestre, nivel, xp, hp, hp_max, nivel_maximo);
  const secAtributos = _fichasSecAtributos(c, ca, cor, podEditar, isMestre);
  const secInvocacoes = (typeof renderSecaoInvocacoes === 'function')
    ? renderSecaoInvocacoes(c, ca, isMestre, podEditar)
    : '<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Módulo de invocações não carregado.</div>';

  container.innerHTML =
    _fichasAccordion('aparencia',  '🎨 Aparência',   secAparencia,   aparenciaAberta) +
    _fichasAccordion('personagem', '👤 Personagem',  secPersonagem,  true) +
    _fichasAccordion('atributos',  '📊 Atributos',   secAtributos,   true) +
    _fichasAccordion('invocacoes', '🔮 Invocações',  secInvocacoes,  false) +
    _fichasAccordion('inventario', '🎒 Inventário',  '<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Carregando…</div>', false);

  // Montar canvas animado para personagens com aparência animada
  requestAnimationFrame(() => { window._animScheduleTokenMount?.(true); });

  // Preencher accordion de inventário
  if (typeof renderInventarioChar === 'function') {
    await renderInventarioChar(nome);
  }
}

// ── Refresh parcial: só o corpo da seção Atributos ────────────
function fichasRefreshAtributos(nome: any) {
  const body = document.getElementById('fichas-sec-atributos');
  if (!body) return;
  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const cor = ca.cor || 'var(--primario)';
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podEditar = typeof podeEditarPersonagem === 'function'
    ? podeEditarPersonagem(nome)
    : (isMestre || RPG_DATA?.linked === nome);
  body.innerHTML = _fichasSecAtributos(c, ca, cor, podEditar, isMestre);
}
window.fichasRefreshAtributos = fichasRefreshAtributos;


/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasSelectChar", { configurable: true, get: () => fichasSelectChar, set: (__v) => { fichasSelectChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasFiltrar", { configurable: true, get: () => fichasFiltrar, set: (__v) => { fichasFiltrar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasFiltrarLimpar", { configurable: true, get: () => fichasFiltrarLimpar, set: (__v) => { fichasFiltrarLimpar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "buildFichasBtns", { configurable: true, get: () => buildFichasBtns, set: (__v) => { buildFichasBtns = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderFichasBtns", { configurable: true, get: () => renderFichasBtns, set: (__v) => { renderFichasBtns = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasToggleSection", { configurable: true, get: () => fichasToggleSection, set: (__v) => { fichasToggleSection = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_fichasAccordion", { configurable: true, get: () => _fichasAccordion, set: (__v) => { _fichasAccordion = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasToggleEditPersonagem", { configurable: true, get: () => fichasToggleEditPersonagem, set: (__v) => { fichasToggleEditPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasToggleEditAtributos", { configurable: true, get: () => fichasToggleEditAtributos, set: (__v) => { fichasToggleEditAtributos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasHpStep", { configurable: true, get: () => fichasHpStep, set: (__v) => { fichasHpStep = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_fichasSecAparencia", { configurable: true, get: () => _fichasSecAparencia, set: (__v) => { _fichasSecAparencia = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_fichasSecPersonagem", { configurable: true, get: () => _fichasSecPersonagem, set: (__v) => { _fichasSecPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_fichasSecAtributos", { configurable: true, get: () => _fichasSecAtributos, set: (__v) => { _fichasSecAtributos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderFichaView", { configurable: true, get: () => renderFichaView, set: (__v) => { renderFichaView = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fichasRefreshAtributos", { configurable: true, get: () => fichasRefreshAtributos, set: (__v) => { fichasRefreshAtributos = __v; } });
