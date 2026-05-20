// fichas.js — Ficha de personagem redesenhada
// Layout: header (portrait + HP) + abas (Atributos | Skills | Personagem | Inventário)

// ── Estado da aba ativa ───────────────────────────────────────
if (typeof window.FICHAS_TAB === 'undefined') window.FICHAS_TAB = 'atributos';

// ── Seleção de personagem ─────────────────────────────────────
function fichasSelectChar(nome, btn) {
  document.querySelectorAll('#fichas-select-row .char-btn').forEach(b => b.classList.remove('ativo'));
  if (btn) btn.classList.add('ativo');
  FICHAS_VIEW = CHAR_VIEW = ATTR_VIEW = nome;
  renderFichaView(nome);
}

// ── Filtro de busca ───────────────────────────────────────────
function fichasFiltrar(input) {
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

  const makeBtn = (c, labelHtml) => {
    const ca = c.custom_attrs || {};
    const cor = ca.cor || 'var(--primario)';
    const ativo = c.nome === atualNome ? ' ativo' : '';
    const nomeSafe = c.nome.replace(/'/g, "\\'");
    return `<button class="char-btn${ativo}" onclick="fichasSelectChar('${nomeSafe}',this)" style="border-left:3px solid ${cor}">${labelHtml || c.nome}</button>`;
  };

  const makeGenBtn = (base, instancias) => {
    const rep = instancias[0];
    const ca = rep.custom_attrs || {};
    const cor = ca.cor || 'var(--primario)';
    const count = instancias.length;
    const isAtivo = instancias.some(x => x.nome === atualNome) ? ' ativo' : '';
    const nomeSafe = rep.nome.replace(/'/g, "\\'");
    const countTag = count > 1
      ? ` <span style='font-size:0.55rem;background:rgba(232,96,76,0.25);border-radius:8px;padding:1px 5px;color:#e8604c;margin-left:2px'>${count}</span>`
      : ` <span style='font-size:0.6rem;opacity:0.5'>⚔</span>`;
    return `<button class="char-btn${isAtivo}" onclick="fichasSelectChar('${nomeSafe}',this)" style="border-left:3px solid ${cor}" title="${count} instância(s)">${base}${countTag}</button>`;
  };

  const pets = chars.filter(c => c.custom_attrs?.eh_pet === true);

  const adicionarComPets = (c, labelOverride) => {
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

  const chars = RPG_DATA?.characters || [];
  const genBases = new Set();
  let total = 0;
  chars.forEach(c => {
    const ca = c.custom_attrs || {};
    if (ca.npc_generico) {
      const base = ca.nome_base || c.nome.replace(/ \d+$/, '');
      if (!genBases.has(base)) { genBases.add(base); total++; }
    } else { total++; }
  });
  const wrap = document.getElementById('fichas-search-wrap');
  if (wrap) wrap.classList.toggle('visivel', total > 5);

  if (!FICHAS_VIEW && RPG_DATA?.linked) {
    const allBtns = row.querySelectorAll('.char-btn');
    for (const btn of allBtns) {
      if (btn.textContent.trim() === RPG_DATA.linked) {
        fichasSelectChar(RPG_DATA.linked, btn);
        return;
      }
    }
  }

  if (FICHAS_VIEW) renderFichaView(FICHAS_VIEW);
}

// ── HP rápido ────────────────────────────────────────────────
async function fichasHpStep(nome, delta) {
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

// ── Salvar um único atributo inline ──────────────────────────
async function _fichaStatSalvarInline(attrNome, novoValor, charNome) {
  const c = RPG_DATA?.characters?.find(x => x.nome === charNome);
  if (!c) return;
  const ca = { ...(c.custom_attrs || {}) };
  if (!ca.atributos) ca.atributos = {};
  const def = (RPG_DATA?.attrDefs || []).find(a => a.nome === attrNome);
  if (def?.tipo === 'number') ca.atributos[attrNome] = +novoValor;
  else ca.atributos[attrNome] = novoValor;
  c.custom_attrs = ca;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(charNome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca }) });
  } catch(e) { mostrarToast('Erro ao salvar atributo', 'erro'); }
  fichasRefreshAtributos(charNome);
}

// ── Ativar edição inline num stat card ───────────────────────
function fichaStatIniciarEdicao(card, attrNome, valorAtual, charNome) {
  if (!card) return;
  card.classList.add('editing');
  const inp = card.querySelector('.ficha-stat-input');
  if (!inp) return;
  inp.value = valorAtual !== '—' ? valorAtual : '';
  inp.focus();
  inp.select();
  const confirmar = () => {
    card.classList.remove('editing');
    const novo = inp.value.trim();
    if (novo !== '' && novo != valorAtual) {
      _fichaStatSalvarInline(attrNome, novo, charNome);
    }
  };
  inp.onblur = confirmar;
  inp.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { card.classList.remove('editing'); }
  };
}

// ── Abrir aba da ficha ────────────────────────────────────────
function fichaAbrirTab(tab) {
  window.FICHAS_TAB = tab;
  const container = document.getElementById('fichas-view');
  if (!container) return;
  container.querySelectorAll('.ficha-tab-btn').forEach(b => b.classList.toggle('ativo', b.dataset.tab === tab));
  container.querySelectorAll('.ficha-tab-pane').forEach(p => {
    p.style.display = p.dataset.tab === tab ? '' : 'none';
  });
  if (tab === 'inventario' && FICHAS_VIEW && typeof renderInventarioChar === 'function') {
    renderInventarioChar(FICHAS_VIEW);
  }
}

// ── Header: portrait + info + HP ─────────────────────────────
function _fichaHeader(c, ca, cor, podEditar, isMestre, nivel, xp, hp, hp_max, nivel_maximo) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const hpPct = Math.min(100, Math.round((hp / hp_max) * 100));
  const hpColor = hpPct > 50 ? 'var(--sucesso)' : hpPct > 25 ? '#e8a020' : 'var(--perigo)';

  // Portrait
  const ap = ca.aparencia;
  let portraitInner = '';
  if (typeof apmodTokenSVG === 'function' && ap) {
    const tokenHtml = apmodTokenSVG(c);
    if (tokenHtml) {
      portraitInner = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:4px;box-sizing:border-box">${tokenHtml}</div>`;
    }
  }
  if (!portraitInner) {
    const imgUrl = typeof normalizeImgUrl === 'function'
      ? (normalizeImgUrl(ca.aparencia?.img_frente || ca.aparencia?.img_url || ca.img || ca.img_url || '') || '')
      : (ca.aparencia?.img_frente || ca.aparencia?.img_url || ca.img || ca.img_url || '');
    if (imgUrl) {
      portraitInner = `<img src="${imgUrl}" alt="${c.nome}" onerror="this.style.display='none'">`;
    } else {
      portraitInner = `<div class="ficha-portrait-placeholder" style="background:${cor}18;color:${cor}">${c.nome[0] || '?'}</div>`;
    }
  }

  const portraitClick = podEditar ? `onclick="abrirModalAparencia('${nomeSafe}')"` : '';

  // Badge tipo
  const tipoLabels = { jogador: { label: 'Jogador', color: 'var(--primario)' }, npc: { label: 'NPC', color: '#b07ef0' }, criatura: { label: 'Criatura', color: '#e8a020' }, objeto: { label: 'Objeto', color: 'var(--suave)' } };
  const tipoInfo = tipoLabels[ca.tipo] || tipoLabels.jogador;
  const esSeuChar = RPG_DATA?.linked === c.nome;

  // Sub-info
  const partes = [ca.classe, ca.raca].filter(Boolean);
  const subInfo = partes.length ? partes.join(' · ') : '';

  // XP bar
  const xp_proximo = nivel < nivel_maximo ? nivel * 100 : null;
  const xp_pct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 100;
  const xpHtml = xp_proximo != null
    ? `<div class="ficha-xp-row">
        <div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.58rem;color:var(--destaque);margin-bottom:3px">
          <span>XP · Nível ${nivel}</span><span>${xp} / ${xp_proximo}</span>
        </div>
        <div style="height:4px;background:rgba(200,168,75,0.15);border-radius:2px"><div style="height:100%;width:${xp_pct}%;background:var(--destaque);border-radius:2px;transition:width 0.3s"></div></div>
      </div>`
    : `<div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--destaque)">✦ Nível Máximo (${nivel})</div>`;

  return `<div class="ficha-header">
    <div class="ficha-portrait" ${portraitClick} title="${podEditar ? 'Clique para editar aparência' : ''}">
      ${portraitInner}
      ${podEditar ? `<div class="ficha-portrait-overlay">🖼 Trocar<br>Imagem</div>` : ''}
    </div>
    <div class="ficha-header-info">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
        <span class="ficha-header-badge" style="color:${tipoInfo.color};border-color:${tipoInfo.color}44;background:${tipoInfo.color}12">${tipoInfo.label}</span>
        ${esSeuChar ? `<span class="ficha-header-badge" style="color:var(--primario-v);border-color:var(--primario)44;background:rgba(79,163,209,0.1)">⚔ Seu personagem</span>` : ''}
      </div>
      <div class="ficha-header-nome">${c.nome}</div>
      ${subInfo ? `<div class="ficha-header-sub">${subInfo}</div>` : '<div style="margin-bottom:6px"></div>'}
      <div class="ficha-hp-row">
        ${podEditar ? `<button class="ficha-hp-btn" onclick="fichasHpStep('${nomeSafe}',-1)" title="−1 HP">−</button>` : ''}
        <div class="ficha-hp-barra">
          <div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.62rem;margin-bottom:3px">
            <span style="color:var(--suave)">HP</span>
            <span style="color:${hpColor}">${hp} / ${hp_max}</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${hpPct}%;background:${hpColor};border-radius:3px;transition:width 0.3s"></div>
          </div>
        </div>
        ${podEditar ? `<button class="ficha-hp-btn" onclick="fichasHpStep('${nomeSafe}',1)" title="+1 HP">＋</button>` : ''}
      </div>
      ${xpHtml}
    </div>
  </div>`;
}

// ── Aba: Atributos (estilo Diablo III) ────────────────────────
function _fichaTabAtributos(c, ca, cor, podEditar, isMestre) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const ad = RPG_DATA?.attrDefs || [];
  const atribs = ca.atributos || {};
  const hp_max = ca.hp_max || 100;
  const hp = c.hp_atual ?? hp_max;

  const tipoChar = ca.tipo_personagem || ca.tipo || 'jogador';
  const ehNpc = tipoChar === 'npc';
  const ocultarAtribs = !isMestre && ehNpc && ca.ocultar_atributos === true;
  const somenteBasico = ca.npc_generico === true;

  const adVisiveis = ocultarAtribs ? [] : ad.filter(a => somenteBasico ? ['basico', 'resistencia'].includes(a.categoria || 'basico') : true);
  const adStatus      = adVisiveis.filter(a => a.categoria === 'status');
  const adBasicos     = adVisiveis.filter(a => (a.categoria || 'basico') === 'basico');
  const adEspeciais   = adVisiveis.filter(a => a.categoria === 'especial');
  const adResistencia = adVisiveis.filter(a => a.categoria === 'resistencia');

  const renderStatCard = (a, corAccent) => {
    const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
    const cardId = 'fsc-' + a.nome.replace(/[^a-z0-9]/gi, '_');
    const editAttrs = podEditar
      ? `onclick="fichaStatIniciarEdicao(document.getElementById('${cardId}'),'${a.nome.replace(/'/g, "\\'")}','${v}','${nomeSafe}')"`
      : '';
    return `<div class="ficha-stat-card" id="${cardId}" ${editAttrs} title="${a.nome}${podEditar ? ' (clique para editar)' : ''}">
      <div class="ficha-stat-valor" style="color:${corAccent}">${v}</div>
      <div class="ficha-stat-label">${a.nome}</div>
      ${podEditar ? `<input class="ficha-stat-input" type="text" value="${v !== '—' ? v : ''}" aria-label="${a.nome}">` : ''}
    </div>`;
  };

  const renderStatusBar = (a) => {
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
      const cardId = 'fsc-' + a.nome.replace(/[^a-z0-9]/gi, '_');
      const editAttrs = podEditar ? `onclick="fichaStatIniciarEdicao(document.getElementById('${cardId}'),'${a.nome.replace(/'/g,"\\'")}','${v}','${nomeSafe}')" style="cursor:pointer"` : '';
      return `<div class="ficha-stat-bar" id="${cardId}" ${editAttrs} title="${podEditar ? 'Clique para editar' : ''}">
        <div class="ficha-stat-bar-info">
          <div class="ficha-stat-bar-nome">${a.nome}</div>
          <div class="ficha-stat-bar-track">
            <div class="ficha-stat-bar-fill" style="width:${pct}%;background:#4fa3d1"></div>
          </div>
        </div>
        <div class="ficha-stat-bar-num" style="color:#4fa3d1">${v} / ${Math.round(maxVal)}</div>
        ${podEditar ? `<input class="ficha-stat-input" type="text" value="${v}" aria-label="${a.nome}" style="border-radius:6px">` : ''}
      </div>`;
    }
    return renderStatCard(a, '#4fa3d1');
  };

  // Salvaguardas de morte
  const moribundoHtml = ca.moribundo ? `<div class="ficha-moribundo-alert">
    ☠ Moribundo — Salvaguardas de Morte<br>
    <span style="font-size:0.9rem">✔ ${(ca.salvaguardas?.sucessos||0)}/2 &nbsp; ✘ ${(ca.salvaguardas?.falhas||0)}/3</span>
  </div>` : '';

  // Grupos de stats
  const grupoHtml = (titulo, corAccent, emoji, items, renderFn) => {
    if (!items.length) return '';
    return `<div class="ficha-stats-grupo">
      <div class="ficha-stats-grupo-titulo" style="color:${corAccent}">${emoji} ${titulo}</div>
      <div class="ficha-stats-grid">${items.map(a => renderFn(a, corAccent)).join('')}</div>
    </div>`;
  };

  const statusHtml = adStatus.length ? `<div class="ficha-stats-grupo">
    <div class="ficha-stats-grupo-titulo" style="color:#4fa3d1">📊 Recursos</div>
    <div>${adStatus.map(renderStatusBar).join('')}</div>
  </div>` : '';

  const ocultarHtml = ocultarAtribs ? `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:16px 0">— atributos não revelados —</div>` : '';

  // Distribuição de pontos
  const pontos_attr = ca.pontos_attr || 0;
  const pontosHtml = (pontos_attr > 0 && podEditar) ? `<div class="ficha-pontos-banner">
    <div class="ficha-pontos-titulo">⭐ ${pontos_attr} Ponto${pontos_attr > 1 ? 's' : ''} de Atributo disponíve${pontos_attr > 1 ? 'is' : 'l'}</div>
    <div class="form-grid">
      ${ad.filter(a => a.tipo === 'number' && (a.categoria === 'basico' || a.categoria === 'especial' || !a.categoria)).map(a => {
        const k = 'pa-' + a.nome.replace(/[^a-z0-9]/gi, '_');
        return `<div class="form-group"><label>${a.nome} (atual: ${atribs[a.nome] || 0})</label><input type="number" id="${k}" value="0" min="0" placeholder="+0"></div>`;
      }).join('')}
    </div>
    <button class="btn btn-primario" onclick="distribuirPontosAttr('${nomeSafe}')">Aplicar Pontos</button>
  </div>` : '';

  // Toggle ocultar (mestre + NPC)
  const ocultarToggle = (isMestre && ehNpc) ? `<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px;margin-top:14px">
    <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer;flex:1">
      <input type="checkbox" id="attrview-toggle-ocultar" onchange="attrviewToggleOcultarAtribs('${nomeSafe}')" ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
      Ocultar atributos para jogadores
    </label>
  </div>` : '';

  return moribundoHtml
    + pontosHtml
    + statusHtml
    + ocultarHtml
    + grupoHtml('Básicos', cor, '🔷', adBasicos, renderStatCard)
    + grupoHtml('Especiais', '#b07ef0', '✨', adEspeciais, renderStatCard)
    + grupoHtml('Defesas', '#e8a020', '🛡', adResistencia, renderStatCard)
    + ocultarToggle;
}

// ── Aba: Skills ───────────────────────────────────────────────
function _fichaTabSkills(c, ca, cor, podEditar, nivel) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const sk = typeof _skFiltrarPorChar === 'function' ? _skFiltrarPorChar(RPG_DATA.skills, c.nome) : [];

  if (!sk.length && !podEditar) {
    return `<div style="color:var(--suave);font-style:italic;font-size:0.84rem;text-align:center;padding:20px 0">Nenhuma habilidade</div>`;
  }

  // Ícones automáticos baseados no tipo de dano / efeito
  const autoIcon = (s) => {
    if (s.animacao?.icone) return s.animacao.icone;
    const tipo = (s.tipo_dano || '').toLowerCase();
    if (tipo === 'fogo') return '🔥';
    if (tipo === 'gelo') return '❄️';
    if (tipo === 'raio') return '⚡';
    if (tipo === 'cura') return '💚';
    if (tipo === 'magia' || tipo === 'arcano') return '✨';
    if (tipo === 'veneno') return '☠️';
    if (s.formula_dano) return '⚔️';
    return '🌀';
  };

  const skCards = sk.map(s => {
    const nivelNecessario = s.nivel_necessario || 1;
    const bloqueada = nivelNecessario > nivel;
    const sId = s.id;
    const sNomeSafe = (s.habilidade || '').replace(/'/g, "\\'");
    const icone = autoIcon(s);

    const badges = [];
    if (s.custo_rsv) badges.push(`<span class="badge badge-roxo">${s.custo_rsv}</span>`);
    if (s.tipo_dano && s.tipo_dano !== 'fisico') badges.push(`<span class="badge badge-cinza">${s.tipo_dano}</span>`);
    if (bloqueada) badges.push(`<span class="badge" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3)">Nível ${nivelNecessario}</span>`);

    const temFormula = !!(s.formula_dano || (s.efeito && /\d+d\d+/i.test(s.efeito)));
    const formula = s.formula_dano || (s.efeito?.match(/\d+d\d+[+-]?\d*/i)?.[0] || '');

    const botoesAcao = [];
    if (temFormula) {
      botoesAcao.push(`<button class="btn-rolar" onclick="rolarFormulaDano('${formula}','${sNomeSafe}','${nomeSafe}',null)" title="Rolar ${formula}">🎲 Rolar</button>`);
    }
    if (podEditar) {
      botoesAcao.push(`<button onclick="abrirModalSkill('${sId}')" title="Editar">✏</button>`);
      botoesAcao.push(`<button class="btn-danger" onclick="removerSkill('${sId}','${sNomeSafe}','${nomeSafe}')" title="Remover">✕</button>`);
    }

    return `<div class="ficha-skill-card${bloqueada ? ' bloqueada' : ''}">
      <div class="ficha-skill-topo">
        <div class="ficha-skill-icon" style="background:${cor}12;border-color:${cor}30">${icone}</div>
        <div class="ficha-skill-info">
          <div class="ficha-skill-nome">${s.habilidade}</div>
          ${badges.length ? `<div class="ficha-skill-badges">${badges.join('')}</div>` : ''}
        </div>
        ${botoesAcao.length ? `<div class="ficha-skill-acoes">${botoesAcao.join('')}</div>` : ''}
      </div>
      ${s.efeito ? `<div class="ficha-skill-efeito">${s.efeito}</div>` : ''}
    </div>`;
  }).join('');

  const addBtn = podEditar
    ? `<button class="ficha-add-skill-btn" onclick="abrirModalSkill(null,'${nomeSafe}')">＋ Adicionar Habilidade</button>`
    : '';

  return `<div class="ficha-skills-grid">${skCards}</div>${addBtn}`;
}

// ── Aba: Personagem ───────────────────────────────────────────
function _fichaTabPersonagem(c, ca, cor, podEditar, isMestre, nivel, nivel_maximo) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");

  const levelUpHtml = isMestre && nivel < nivel_maximo
    ? `<button class="ficha-level-up-btn" onclick="abrirModalLevelUp('${nomeSafe}')">⬆ Level Up — Nível ${nivel} → ${nivel + 1}</button>`
    : '';

  // Lore cards
  const loreHtml = [
    ca.background ? `<div class="ficha-section-card">
      <div class="ficha-section-card-titulo">📖 História / Background</div>
      <div class="ficha-lore-text">${ca.background}</div>
    </div>` : '',
    ca.companheiro ? `<div class="ficha-section-card">
      <div class="ficha-section-card-titulo">🐾 Companheiro</div>
      <div class="ficha-lore-text">${ca.companheiro}</div>
    </div>` : '',
  ].join('');

  if (!podEditar) {
    return levelUpHtml + loreHtml
      + `<div style="font-size:0.76rem;color:var(--suave);font-style:italic;text-align:center;padding:12px 0">Somente ${c.nome} ou o mestre podem editar.</div>`;
  }

  // Formulário de edição completo
  const editForm = `<div class="ficha-section-card">
    <div class="ficha-section-card-titulo">✏ Editar Informações</div>
    <div class="form-grid">
      <div class="form-group" style="grid-column:1/-1"><label>Nome do Personagem</label>
        <input type="text" id="fc-nome" value="${c.nome}" style="text-align:left"></div>
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
      <div class="form-group"><label>Cor do token</label>
        <input type="color" id="fc-cor" value="${ca.cor || '#4fa3d1'}" style="width:100%;padding:4px;height:36px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;cursor:pointer">
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Classe / Profissão</label>
        <input type="text" id="fc-classe" value="${ca.classe || ''}" placeholder="Ex: Guerreiro, Mago…" style="text-align:left">
      </div>
      <div class="form-group" style="grid-column:1/-1"><label>Raça / Espécie</label>
        <input type="text" id="fc-raca" value="${ca.raca || ''}" placeholder="Ex: Humano, Elfo…" style="text-align:left">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:10px"><label>Background / História</label>
      <textarea id="fc-background" rows="3" placeholder="História e contexto…" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem;resize:vertical">${ca.background || ''}</textarea>
    </div>
    <div class="form-group" style="margin-bottom:12px"><label>Companheiro / Familiar</label>
      <input type="text" id="fc-companheiro" value="${ca.companheiro || ''}" placeholder="Animal, NPC parceiro…" style="text-align:left">
    </div>
    <div style="margin-bottom:12px;padding:10px 12px;background:rgba(126,200,240,0.04);border:1px solid rgba(126,200,240,0.15);border-radius:8px">
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
    </div>
    ${isMestre ? `<button onclick="excluirPersonagemCompleto('${nomeSafe}', false)" style="width:100%;margin-top:8px;padding:9px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.25);border-radius:8px;color:#c0392b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase">🗑 Excluir Personagem</button>` : ''}
    ${(isMestre && (ca.tipo_personagem || ca.tipo) === 'npc') ? `
    <div style="margin-top:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px">
      <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer">
        <input type="checkbox" onchange="charviewToggleOcultarAtribs('${nomeSafe}',this.checked)" ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
        🔒 Ocultar atributos para jogadores
      </label>
    </div>` : ''}
  </div>`;

  return levelUpHtml + loreHtml + editForm;
}

// ── Aba: Atributos — formulário de edição completo ────────────
function _fichaTabAtributosEditForm(c, ca, cor, isMestre) {
  const nomeSafe = c.nome.replace(/'/g, "\\'");
  const ad = RPG_DATA?.attrDefs || [];
  const atribs = ca.atributos || {};
  const hp_max = ca.hp_max || 100;
  const hp = c.hp_atual ?? hp_max;

  const tipoChar = ca.tipo_personagem || ca.tipo || 'jogador';
  const ehNpc = tipoChar === 'npc';
  const adVisiveis = ad.filter(a => {
    if (ca.npc_generico) return ['basico', 'resistencia'].includes(a.categoria || 'basico');
    return true;
  });

  const adStatus   = adVisiveis.filter(a => a.categoria === 'status');
  const adEditaveis = adVisiveis.filter(a => (a.categoria !== 'resistencia' || isMestre) && a.categoria !== 'status');

  const renderEditField = (a) => {
    const key = a.nome.replace(/[^a-z0-9]/gi, '_');
    if (a.tipo === 'number') return `<div class="form-group"><label>${a.nome}</label><input type="number" id="fca-${key}" value="${atribs[a.nome] || 0}" min="0"></div>`;
    if (a.tipo === 'text') return `<div class="form-group"><label>${a.nome}</label><input type="text" id="fca-${key}" value="${atribs[a.nome] || ''}"></div>`;
    if (a.tipo === 'boolean') return `<div class="form-group"><label>${a.nome}</label><select id="fca-${key}"><option value="true"${atribs[a.nome] === true || atribs[a.nome] === 'true' ? ' selected' : ''}>Sim</option><option value="false"${!atribs[a.nome] ? ' selected' : ''}>Não</option></select></div>`;
    if (a.tipo === 'select') {
      const ops = (a.opcoes || '').split(',').map(x => x.trim()).filter(Boolean);
      return `<div class="form-group"><label>${a.nome}</label><select id="fca-${key}">${ops.map(o => `<option value="${o}"${atribs[a.nome] === o ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
    }
    return '';
  };

  const editStatusFields = adStatus.map(a => {
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

  return `<div class="ficha-section-card" style="margin-top:16px">
    <div class="ficha-section-card-titulo">✏ Editar Atributos Completos</div>
    <div class="form-grid">
      <div class="form-group"><label>HP Atual</label><input type="number" id="f-hp_atual" value="${hp}" min="0" max="${hp_max}"></div>
      ${editStatusFields}
      ${adEditaveis.map(renderEditField).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-primario" style="flex:2" onclick="salvarAtributos('${nomeSafe}')">Salvar Tudo</button>
    </div>
  </div>`;
}

// ── Renderizar a ficha completa ───────────────────────────────
async function renderFichaView(nome) {
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

  const abas = [
    { id: 'atributos', label: '📊 Atributos' },
    { id: 'skills',    label: '⚡ Habilidades' },
    { id: 'personagem', label: '👤 Personagem' },
    { id: 'inventario', label: '🎒 Inventário' },
  ];

  const tabAtual = window.FICHAS_TAB || 'atributos';

  const headerHtml = _fichaHeader(c, ca, cor, podEditar, isMestre, nivel, xp, hp, hp_max, nivel_maximo);

  const tabBtns = abas.map(a =>
    `<button class="ficha-tab-btn${a.id === tabAtual ? ' ativo' : ''}" data-tab="${a.id}" onclick="fichaAbrirTab('${a.id}')">${a.label}</button>`
  ).join('');

  const atributosHtml = _fichaTabAtributos(c, ca, cor, podEditar, isMestre)
    + (podEditar ? _fichaTabAtributosEditForm(c, ca, cor, isMestre) : '');

  const skillsHtml = _fichaTabSkills(c, ca, cor, podEditar, nivel);
  const personagemHtml = _fichaTabPersonagem(c, ca, cor, podEditar, isMestre, nivel, nivel_maximo);

  const renderPane = (id, content) => {
    const vis = id === tabAtual ? '' : ' style="display:none"';
    return `<div class="ficha-tab-pane" data-tab="${id}"${vis}>${content}</div>`;
  };

  container.innerHTML =
    headerHtml +
    `<div class="ficha-tabs">${tabBtns}</div>` +
    `<div class="ficha-tab-body">` +
      renderPane('atributos', atributosHtml) +
      renderPane('skills', skillsHtml) +
      renderPane('personagem', personagemHtml) +
      renderPane('inventario', '<div style="color:var(--suave);font-style:italic;font-size:0.82rem;padding:6px 0">Carregando…</div>') +
    `</div>`;

  // Montar canvas animado
  requestAnimationFrame(() => { window._animScheduleTokenMount?.(true); });

  // Carregar inventário se aba ativa
  if (tabAtual === 'inventario' && typeof renderInventarioChar === 'function') {
    await renderInventarioChar(nome);
  }
}

// ── Refresh parcial: atualiza apenas a aba de atributos ───────
function fichasRefreshAtributos(nome) {
  const pane = document.querySelector('#fichas-view .ficha-tab-pane[data-tab="atributos"]');
  if (!pane) return;
  const c = RPG_DATA?.characters?.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const cor = ca.cor || 'var(--primario)';
  const isMestre = RPG_DATA?.myRole === 'mestre';
  const podEditar = typeof podeEditarPersonagem === 'function'
    ? podeEditarPersonagem(nome)
    : (isMestre || RPG_DATA?.linked === nome);
  pane.innerHTML = _fichaTabAtributos(c, ca, cor, podEditar, isMestre)
    + (podEditar ? _fichaTabAtributosEditForm(c, ca, cor, isMestre) : '');
}
window.fichasRefreshAtributos = fichasRefreshAtributos;
