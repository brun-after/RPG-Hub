// systems/lore.js
// RPG Hub — Lore system: rendering, filtering, editing campaign knowledge entries
// Includes: renderLore(), filtrarLore(), abrirModalLore(), salvarLore(), removerLore()

function renderHeader(){document.getElementById('hdr-char').textContent=RPG_DATA.linked||'';}


// ── LORE ─────────────────────────────────────────────────────
function renderLore(){
 const secs=[...new Set(RPG_DATA.lore.map(l=>l.secao))];
 const podeEditarL = temPermissao('editar_lore');
 document.getElementById('lore-filtros').innerHTML=secs.map((s,i)=>`<button class="lore-filtro${i===0?' ativo':''}" onclick="filtrarLore('${s}',this)">${fmtSec(s)}</button>`).join('');
 document.getElementById('lore-items').innerHTML=RPG_DATA.lore.map(item=>`<div class="card lore-item${item.secao===secs[0]?' visivel':''}" data-secao="${item.secao}"><div class="lore-titulo" style="display:flex;align-items:center;gap:8px">${item.titulo}<span style="flex:1"></span>${podeEditarL?`<button onclick="abrirModalLore(${item.id})" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.85rem;padding:2px 4px;flex-shrink:0" title="Editar">✏️</button><button onclick="removerLore(${item.id},'${item.titulo.replace(/'/g,"\\'")}' )" style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.85rem;padding:2px 4px;flex-shrink:0" title="Remover">✕</button>`:''}</div><div class="lore-texto">${item.conteudo}</div></div>`).join('')
   +(podeEditarL?`<button onclick="abrirModalLore(null)" style="width:100%;margin-top:10px;padding:10px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase">＋ Nova Entrada de Lore</button>`:'');
}
function fmtSec(s){const m={mundo:'O Mundo',magia:'Magia',sociedade:'Sociedade',segredo:'Segredos',historia:'História',regras:'Regras',facoes:'Facções'};return m[s]||s.charAt(0).toUpperCase()+s.slice(1);}
function filtrarLore(s,btn){document.querySelectorAll('.lore-filtro').forEach(b=>b.classList.remove('ativo'));btn.classList.add('ativo');document.querySelectorAll('.lore-item').forEach(el=>el.classList.toggle('visivel',el.dataset.secao===s));}


// ── PERSONAGEM ────────────────────────────────────────────────
// Threshold: mostrar busca quando houver mais botões que cabem sem scroll
const CHAR_SEARCH_THRESHOLD = 5;

function renderCharButtons(){
  document.getElementById('char-select-row').innerHTML = buildCharBtns('char') +
    `<button class="char-btn" onclick="abrirModalNovoChar()" style="border-style:dashed;color:var(--suave)" title="Criar personagem ou NPC">＋</button>`;
  _charSearchToggle('char');
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

function selecionarChar(nome,btn,tab){const p=tab==='attr'?'attr-':'char-';document.querySelectorAll(`#${p}select-row .char-btn`).forEach(b=>b.classList.remove('ativo'));btn.classList.add('ativo');if(tab==='attr'){ATTR_VIEW=nome;renderAttrView(nome);}else{CHAR_VIEW=nome;renderCharView(nome);}}


function renderCharView(nome){
 const c=RPG_DATA.characters.find(x=>x.nome===nome); if(!c)return;
 const ca=c.custom_attrs||{};
 const sk=_skFiltrarPorChar(RPG_DATA.skills, nome);
 const hp_max=ca.hp_max||100;
 const hp=c.hp_atual??hp_max;
 const nivel=ca.nivel||1;
 const xp=ca.xp||0;
 const pontos_attr=ca.pontos_attr||0;
 const cor=ca.cor||'var(--primario)';
 const imgUrl=normalizeImgUrl(ca.img||ca.img_url||'');
 const atribs=ca.atributos||{};
 const attrDefs=RPG_DATA.attrDefs||[];
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const nivel_maximo=lc.nivel_maximo||20;
 const isMestre=RPG_DATA?.myRole==='mestre';

 // XP para próximo nível (100*nivel por padrão)
 const xp_proximo=nivel<nivel_maximo?nivel*100:null;
 const xp_pct=xp_proximo?Math.min(100,Math.round(xp/xp_proximo*100)):100;

 // Habilidades com indicação de bloqueio por nível
 const skH=sk.map(s=>{
   const tc=s.critico_positivo||s.critico_negativo;
   const sId=s.id;
   const efBonusTags = Array.isArray(s.efeitos_bonus) ? s.efeitos_bonus.map(ef => {
     const partes = [];
     if(ef.alvo==='usuario') partes.push('👤');
     if(ef.dot_formula)   partes.push(`🩸 DOT ${ef.dot_formula}×${ef.dot_turnos}t`);
     if(ef.sem_movimento) partes.push(`🚫 Mov.${ef.sem_movimento_turnos}t`);
     if(ef.sem_ataque)    partes.push(`⚔🚫 ${ef.sem_ataque_tipo==='fisico'?'Fís.':ef.sem_ataque_tipo==='magico'?'Mag.':'Atk.'}${ef.sem_ataque_turnos}t`);
     if(ef.mod_dano!=null&&ef.mod_dano!==0) partes.push(`📉${ef.mod_dano>0?'+':''}${ef.mod_dano}×${ef.mod_dano_turnos}t`);
     if(ef.hot_formula) partes.push(`💚 HOT ${ef.hot_formula}×${ef.hot_turnos}t`);
     if(ef.boost_dano)  partes.push(`⚡ +${ef.boost_dano}×${ef.boost_dano_turnos}t`);
     if(ef.rec_atributo) partes.push(`🔷 ${ef.rec_atributo} ${ef.rec_formula}${ef.rec_modo==='turno'?'×'+ef.rec_turnos+'t':''}`);
     return `<span style="font-size:0.68rem;background:rgba(79,163,209,0.07);border:1px solid rgba(79,163,209,0.2);border-radius:4px;padding:1px 5px;color:var(--primario-v)">${ef.nome}${partes.length ? ' · '+partes.join(' ') : ''}</span>`;
   }).join(' ') : '';
   const metaRow = [
     s.formula_dano?`<span style="font-size:0.82rem;color:var(--destaque)">🎲 ${s.formula_dano}</span>`:'',
     s.alcance_celulas!=null?`<span style="font-size:0.78rem;color:#7ec8f0">⟷ ${s.alcance_celulas}c</span>`:'',
     s.cooldown_turnos>0?`<span style="font-size:0.78rem;color:#a07040">⏳ CD ${s.cooldown_turnos}t</span>`:'',
     s.tipo_dano&&s.tipo_dano!=='fisico'?`<span style="font-size:0.72rem;color:var(--suave)">${{fisico:'⚔',magico:'✨',fogo:'🔥',gelo:'❄',veneno:'☠',cura:'💚',psiquico:'🌀',invocacao:'🔮',outro:'◆'}[s.tipo_dano]||''} ${s.tipo_dano}</span>`:'',
     // Badge de invocação com nome e duração
     (()=>{ const inv=s.invocar_nome||(Array.isArray(s.efeitos_bonus)?s.efeitos_bonus:[]).find(e=>e?.tipo==='invocacao')?.invocar_nome; if(!inv) return ''; const dur=s.invocar_duracao_turnos??0; return `<span style="font-size:0.72rem;color:#b07ef0">🔮 ${inv}${dur>0?' · '+dur+'t':''}</span>`; })(),
   ].filter(Boolean).join(' · ');
   const nivelNecessario=s.nivel_necessario||1;
   const bloqueada=nivelNecessario>nivel;
   const podeEdSkill = podeEditarPersonagem(nome);
   const botoesSkill = podeEdSkill
     ? `<button onclick="abrirModalSkill('${sId}')" style="background:none;border:none;color:var(--suave);cursor:pointer;font-size:0.9rem;padding:2px 4px" title="Editar">✏️</button>` + `<button onclick="removerSkill('${sId}','${s.habilidade.replace(/'/g, String.fromCharCode(92)+String.fromCharCode(39))}','${nome.replace(/'/g, String.fromCharCode(92)+String.fromCharCode(39))}')" style="background:none;border:none;color:#e74c3c66;cursor:pointer;font-size:0.9rem;padding:2px 4px" title="Remover">✕</button>`
     : '';
   return`<div class="skill-item" style="${bloqueada?'opacity:0.45;':''}"><div class="skill-header"><div class="skill-nome">${s.habilidade}${bloqueada?` <span style="font-size:0.6rem;color:var(--suave)">(Nível ${nivelNecessario})</span>`:''}</div>${s.custo_rsv?`<span class="badge badge-roxo">${s.custo_rsv}</span>`:''}${botoesSkill}</div><div class="skill-efeito">${s.efeito}</div>${metaRow?`<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${metaRow}</div>`:''} ${efBonusTags?`<div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${efBonusTags}</div>`:''} ${tc?`<div class="skill-criticos">${s.critico_positivo?`<div class="crit-box crit-pos"><div class="crit-label">Crítico +</div>${s.critico_positivo}</div>`:''} ${s.critico_negativo?`<div class="crit-box crit-neg"><div class="crit-label">Crítico −</div>${s.critico_negativo}</div>`:''}</div>`:''}</div>`;
 }).join('');

 // Atributos customizados como stat boxes — BUG-02 FIX: diferenciação por categoria
 const ehNpcCharView = (ca.tipo_personagem || ca.tipo) === 'npc';
 const isMestreCharView = RPG_DATA?.myRole === 'mestre';
 const ocultarCharView = !isMestreCharView && ehNpcCharView && ca.ocultar_atributos === true;
 const _cvBasicos    = attrDefs.filter(a=>(a.categoria||'basico')==='basico');
 const _cvEspeciais  = attrDefs.filter(a=>a.categoria==='especial');
 const _cvStatus     = attrDefs.filter(a=>a.categoria==='status');
 const _cvResist     = attrDefs.filter(a=>a.categoria==='resistencia');
 const _cvRenderBox = (a,cor_)=>{const v=atribs[a.nome]!==undefined?atribs[a.nome]:'—';return`<div class="stat-box" style="border-top:2px solid ${cor_}"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:${cor_}">${v}</div></div>`;};
 const _cvRenderStatus = (a)=>{
   const v=parseFloat(atribs[a.nome])||0;
   let maxVal=v;
   try{const cfg=JSON.parse(a.opcoes||'{}');if(cfg.max_base!==undefined){const av=parseFloat(atribs[cfg.max_attr]||0);maxVal=(cfg.max_base||0)+av*(cfg.max_mult||0);}}catch(e){}
   if(maxVal>0&&maxVal!==v){const pct=Math.round(Math.min(v/maxVal,1)*100);return`<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.62rem;color:#4fa3d1;margin-bottom:2px"><span>${a.nome}</span><span>${v}/${Math.round(maxVal)}</span></div><div style="height:5px;background:rgba(79,163,209,0.15);border-radius:3px"><div style="height:100%;width:${pct}%;background:#4fa3d1;border-radius:3px;transition:width 0.3s"></div></div></div>`;}
   return _cvRenderBox(a,'#4fa3d1');
 };
 const statBoxes = ocultarCharView ? '' :
   (_cvStatus.length?`<div style="font-family:var(--fonte-d);font-size:0.55rem;color:#4fa3d1;text-transform:uppercase;letter-spacing:0.07em;margin-top:8px;margin-bottom:5px">📊 Recursos</div><div class="stats-grid">${_cvStatus.map(_cvRenderStatus).join('')}</div>`:'')+
   (_cvBasicos.length?`<div style="font-family:var(--fonte-d);font-size:0.55rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.07em;margin-top:8px;margin-bottom:5px">🔷 Atributos</div><div class="stats-grid">${_cvBasicos.map(a=>_cvRenderBox(a,cor)).join('')}</div>`:'')+
   (_cvEspeciais.length?`<div style="font-family:var(--fonte-d);font-size:0.55rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;margin-top:8px;margin-bottom:5px">✨ Especiais</div><div class="stats-grid">${_cvEspeciais.map(a=>_cvRenderBox(a,'#b07ef0')).join('')}</div>`:'')+
   (_cvResist.length?`<div style="font-family:var(--fonte-d);font-size:0.55rem;color:#e8a020;text-transform:uppercase;letter-spacing:0.07em;margin-top:8px;margin-bottom:5px">🛡 Defesas</div><div class="stats-grid">${_cvResist.map(a=>_cvRenderBox(a,'#e8a020')).join('')}</div>`:'');

 // Distribuição de pontos_attr
 const pontosHtml=pontos_attr>0?`
   <div class="card" style="border-left:3px solid var(--destaque)">
     <div class="card-titulo">⭐ ${pontos_attr} Ponto${pontos_attr>1?'s':''} de Atributo Disponíve${pontos_attr>1?'is':'l'}</div>
     <div style="font-size:0.88rem;color:var(--suave);margin-bottom:10px">Distribua seus pontos entre os atributos:</div>
     <div class="form-grid">
       ${attrDefs.filter(a=>a.tipo==='number'&&(a.categoria==='basico'||a.categoria==='especial'||!a.categoria)).map(a=>{const k='pa-'+a.nome.replace(/[^a-z0-9]/gi,'_');return`<div class="form-group"><label>${a.nome} (atual: ${atribs[a.nome]||0})</label><input type="number" id="${k}" value="0" min="0" placeholder="+0"></div>`;}).join('')}
     </div>
     <button class="btn btn-primario" onclick="distribuirPontosAttr('${nome.replace(/'/g,"\\'")}')">Aplicar Pontos</button>
   </div>`:'';

 // Level Up (só mestre)
 const levelUpHtml=isMestre&&nivel<nivel_maximo?`
   <button onclick="abrirModalLevelUp('${nome.replace(/'/g,"\\'")}') " style="width:100%;padding:11px;background:linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08));border:1px solid rgba(200,168,75,0.5);border-radius:8px;color:var(--destaque);font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">⬆ Level Up — Nível ${nivel} → ${nivel+1}</button>`:'';

 const hpPct=Math.round((hp/hp_max)*100);

  const podEditar = podeEditarPersonagem(nome);
  const aparencia = ca.aparencia;
  const corPele = aparencia?.partes?.cor_pele || '#d4a876';

  // ── APMOD: avatar do personagem ──────────────────────────────
  let avatarHtml;
  if (typeof apmodTokenSVG === 'function' && aparencia) {
    const headSvg = apmodTokenSVG(c, 'geral');
    // Usa imagem composta pré-gerada se disponível (tem equipamentos já incorporados)
    const composedImg = aparencia.composed_img;
    const _equipVisuaisChar = aparencia?.equipamentos_visuais || [];
    const tw = 40, th = 58;
    const isoContent = composedImg
      ? `<img src="${composedImg}" style="width:${tw}px;height:${th}px;object-fit:contain;image-rendering:high-quality" crossorigin="anonymous">`
      : (() => {
          const isoSvg = apmodTokenSVG(c, 'local');
          const _eqOverlayChar = (camada) => _equipVisuaisChar
            .filter(eq => eq.visivel !== false && (eq.img || eq.img_url || (eq.svg && eq.svg.length > 5))
              && (camada === 'atras' ? eq.camada === 'atras' : eq.camada !== 'atras'))
            .map(eq => {
              const xP = eq.x != null ? eq.x : 50, yP = eq.y != null ? eq.y : 40;
              const esc = (eq.escala != null ? eq.escala : 80) / 100;
              const eW = Math.round(0.35 * tw * esc), eH = Math.round(0.45 * th * esc);
              const l = Math.round((xP / 100) * tw - eW / 2);
              const t = Math.round((yP / 100) * th - eH / 2);
              const rot = eq.rotacao != null ? eq.rotacao : 0;
              const rotH = eq.rotacaoH || 0;
              const _ccWarp = eq.warpCorners ? _aeqComputeMatrix3d(eW, eH, eq.warpCorners.map(c=>({x:c.x*eW,y:c.y*eH}))) : null;
              const _ccTfParts = _ccWarp && _ccWarp !== 'none' ? [_ccWarp] : [rotH ? `perspective(400px) rotateY(${rotH}deg)` : '', rot ? `rotate(${rot}deg)` : '', eq.skewX ? `skewX(${eq.skewX}deg)` : '', eq.skewY ? `skewY(${eq.skewY}deg)` : ''].filter(Boolean);
              const _ccTfOrigin = (_ccWarp && _ccWarp !== 'none') ? 'transform-origin:0 0;' : 'transform-origin:center center;';
              const _ccTf = _ccTfParts.length ? `transform:${_ccTfParts.join(' ')};${_ccTfOrigin}` : '';
              const inn = (eq.img || eq.img_url)
                ? `<img src="${eq.img || eq.img_url}" loading="lazy" style="width:${eW}px;height:${eH}px;object-fit:contain;pointer-events:none" onerror="this.style.display='none'">`
                : `<div style="width:${eW}px;height:${eH}px;display:flex;align-items:center;justify-content:center;pointer-events:none">${eq.svg}</div>`;
              return `<div style="position:absolute;left:${l}px;top:${t}px;z-index:${eq.camada==='atras'?0:5};pointer-events:none;${_ccTf}">${inn}</div>`;
            }).join('');
          return `${_eqOverlayChar('atras')}<div style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2px;z-index:2">${isoSvg || `<span style="font-size:1.2rem;color:${cor}">${c.nome[0]||'?'}</span>`}</div>${_eqOverlayChar('frente')}`;
        })();
    const temEquipVisual = _equipVisuaisChar.some(eq => eq.visivel !== false && !!(eq.img || eq.img_url) || !!(eq.svg && eq.svg.length > 5));
    avatarHtml = `
      <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:8px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-family:var(--fonte-d);font-size:0.45rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.06em">Geral</div>
          <div class="apmod-token-wrap" style="width:56px;height:56px;border-radius:50%;background:${cor}14;border:2px solid ${cor};display:flex;align-items:center;justify-content:center;overflow:hidden">
            ${headSvg || `<span style="font-size:1.6rem;color:${cor}">${c.nome[0]||'?'}</span>`}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-family:var(--fonte-d);font-size:0.45rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.06em">Iso${temEquipVisual?' ⚔':''}</div>
          <div style="position:relative;width:${tw}px;height:${th}px;border-radius:4px;background:rgba(0,0,0,0.3);border:1px solid ${cor}44;overflow:visible">
            ${isoContent}
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${podEditar ? `<button onclick="abrirModalAparencia('${c.nome.replace(/'/g,"\\'")}') " style="padding:6px 10px;background:linear-gradient(135deg,rgba(79,163,209,0.12),rgba(79,163,209,0.06));border:1px solid rgba(79,163,209,0.35);border-radius:6px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.58rem;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase">🎨 Aparência</button>` : ''}
        </div>
      </div>`;
  } else {
    const imgUrl2 = normalizeImgUrl(ca.img||ca.img_url||'');
    const _ficTints = ca.aparencia?.tints || [];
    const _ficOvls  = tintOverlayHtml(_ficTints);
    avatarHtml = `
      <div style="position:relative;display:inline-block;margin-bottom:8px">
        ${imgUrl2
          ? `<div style="position:relative;width:80px;height:80px;border-radius:50%;overflow:hidden;border:2px solid ${cor}"><img src="${imgUrl2}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">${_ficOvls}</div>`
          : `<div style="width:80px;height:80px;border-radius:50%;background:${cor}18;border:2px solid ${cor}44;display:flex;align-items:center;justify-content:center;font-size:2rem;color:${cor}">${c.nome[0]||'?'}</div>`}
        ${podEditar ? `<button onclick="abrirModalAparencia('${c.nome.replace(/'/g,"\\'")}') " style="position:absolute;bottom:0;right:0;width:26px;height:26px;border-radius:50%;background:var(--escuro);border:1px solid var(--borda);cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center" title="Aparência">🎨</button>` : ''}
      </div>`
  }

  document.getElementById('char-view').innerHTML=`
   ${levelUpHtml}
   <div class="card" style="border-top:3px solid ${cor}">
     ${avatarHtml}
     <div class="char-nome">${c.nome}</div>
     <div class="char-sub" style="color:var(--suave)">${ca.tipo||'jogador'} · Nível ${nivel}${ca.classe?' · '+ca.classe:''}${ca.raca?' · '+ca.raca:''}</div>
     <div style="height:10px"></div>
     <div class="barra-container barra-hp">
       <div class="barra-header"><span class="barra-nome">HP</span><span class="barra-num" style="color:var(--perigo)">${hp} / ${hp_max}</span></div>
       <div class="barra-bg"><div class="barra-fill" style="width:${Math.min(hpPct,100)}%"></div></div>
     </div>
     ${xp_proximo!=null?`
     <div class="barra-container" style="margin-top:8px">
       <div class="barra-header"><span class="barra-nome" style="color:var(--destaque)">XP</span><span style="font-size:0.75rem;color:var(--suave)">${xp} / ${xp_proximo}</span></div>
       <div class="xp-barra-bg"><div class="xp-barra" style="width:${xp_pct}%"></div></div>
     </div>`:'<div style="font-size:0.72rem;color:var(--destaque);margin-top:6px;text-align:center">✦ Nível Máximo</div>'}
   </div>
   ${podEditar ? `
   <div style="margin-top:8px;margin-bottom:4px">
     ${RPG_DATA.linked === nome ? '<div style="padding:5px 10px;margin-bottom:6px;background:rgba(79,163,209,0.06);border:1px solid rgba(79,163,209,0.2);border-radius:6px;font-family:var(--fonte-d);font-size:0.58rem;color:var(--primario-v);letter-spacing:0.05em;display:flex;align-items:center;gap:5px"><span>⚔</span><span>Seu personagem</span></div>' : ''}
     <button onclick="abrirInventario('${nome}')" style="width:100%;margin-bottom:6px;padding:11px;background:linear-gradient(135deg,rgba(79,163,209,0.15),rgba(79,163,209,0.06));border:1px solid rgba(79,163,209,0.4);border-radius:8px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.08em">🎒 Inventário &amp; Moedas</button>
   </div>` : ''}
   ${pontosHtml}
   ${statBoxes?`<div class="stats-grid">${statBoxes}</div>`:''}
   ${ca.background?`<div class="card"><div class="card-titulo">História</div><div style="font-size:1rem;line-height:1.7">${ca.background}</div></div>`:''}
   ${ca.equipamentos?`<div class="card"><div class="card-titulo">Equipamentos</div><div style="font-size:1rem;line-height:1.7">${ca.equipamentos}</div></div>`:''}
   ${ca.companheiro?`<div class="card"><div class="card-titulo">Companheiro</div><div style="font-size:1rem;line-height:1.7">${ca.companheiro}</div></div>`:''}
   <div class="card"><div class="card-titulo">Habilidades</div>${skH||'<div style="color:var(--suave);font-style:italic">Nenhuma habilidade</div>'}${podEditar ? `<button onclick="abrirModalSkill(null,'${c.nome.replace(/'/g,"\\'")}') " style="width:100%;margin-top:10px;padding:8px;background:rgba(79,163,209,0.06);border:1px dashed rgba(79,163,209,0.3);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.65rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase">＋ Adicionar Skill</button>` : ''}</div>
   ${podEditar ? `
   <div style="margin-top:4px">
     <button class="btn btn-secundario" style="width:100%" onclick="toggleEditChar('${nome}')">✏ Editar Personagem</button>
   </div>
   <div class="edit-form" id="edit-char-form-${nome}">
     <div class="card-titulo" style="margin-bottom:12px">Informações — ${nome}</div>
     <div class="form-grid">
       <div class="form-group" style="grid-column:1/-1"><label>Nome do Personagem</label><input type="text" id="fc-nome" value="${c.nome}" style="text-align:left"></div>
       <div class="form-group"><label>Tipo</label><select id="fc-tipo" style="width:100%;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem"><option value="jogador"${(ca.tipo||'jogador')==='jogador'?' selected':''}>Jogador</option><option value="npc"${ca.tipo==='npc'?' selected':''}>NPC</option><option value="criatura"${ca.tipo==='criatura'?' selected':''}>Criatura</option><option value="objeto"${ca.tipo==='objeto'?' selected':''}>Objeto</option></select></div>
       ${(ca.tipo==='npc'||ca.tipo==='criatura')? `<div class="form-group"><label>Facção</label><select id="fc-faction" style="width:100%;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem"><option value="inimigo"${(ca.npc_faction||'inimigo')==='inimigo'?' selected':''}>⚔ Inimigo</option><option value="neutro"${ca.npc_faction==='neutro'?' selected':''}>⚪ Neutro</option><option value="aliado"${ca.npc_faction==='aliado'?' selected':''}>💚 Aliado</option></select></div>` : ''}
       <div class="form-group"><label>Cor do token</label><input type="color" id="fc-cor" value="${ca.cor||'#4fa3d1'}" style="width:100%;padding:4px;height:36px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;cursor:pointer"></div>
       <div class="form-group" style="grid-column:1/-1"><label>Classe / Profissão</label><input type="text" id="fc-classe" value="${ca.classe||''}" placeholder="Ex: Guerreiro, Mago, Ladino…" style="text-align:left"></div>
       <div class="form-group" style="grid-column:1/-1"><label>Raça / Espécie</label><input type="text" id="fc-raca" value="${ca.raca||''}" placeholder="Ex: Humano, Elfo, Anão…" style="text-align:left"></div>
     </div>
     <div class="form-group" style="margin-bottom:10px"><label>Background / História</label><textarea id="fc-background" rows="3" placeholder="História e contexto do personagem…" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem;resize:vertical">${ca.background||''}</textarea></div>
     <div class="form-group" style="margin-bottom:10px"><label>Equipamentos</label><textarea id="fc-equipamentos" rows="2" placeholder="Itens e equipamentos…" style="width:100%;box-sizing:border-box;padding:8px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.85rem;resize:vertical">${ca.equipamentos||''}</textarea></div>
     <div class="form-group" style="margin-bottom:10px"><label>Companheiro / Familiar</label><input type="text" id="fc-companheiro" value="${ca.companheiro||''}" placeholder="Animal, NPC parceiro…" style="text-align:left"></div>
     <div style="margin-bottom:10px;padding:10px 12px;background:rgba(126,200,240,0.04);border:1px solid rgba(126,200,240,0.15);border-radius:8px">
       <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--primario-v);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">🐾 Sistema de Pet / Montaria</div>
       <label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:var(--texto);cursor:pointer;margin-bottom:8px">
         <input type="checkbox" id="fc-eh-pet" ${ca.eh_pet?'checked':''} style="accent-color:var(--primario)" onchange="document.getElementById('fc-pet-dono-wrap').style.display=this.checked?'block':'none'">
         Este personagem é um pet / montaria
       </label>
       <div id="fc-pet-dono-wrap" style="display:${ca.eh_pet?'block':'none'}">
         <label style="font-size:0.75rem;color:var(--suave);display:block;margin-bottom:4px">Dono do pet</label>
         <select id="fc-pet-dono" style="width:100%;padding:7px 10px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.8rem">
           <option value="">— selecione —</option>
           ${(RPG_DATA?.characters||[]).filter(x=>x.nome!==nome&&!(x.custom_attrs?.eh_pet)).map(x=>`<option value="${x.nome}"${ca.pet_dono===x.nome?' selected':''}>${x.nome}</option>`).join('')}
         </select>
       </div>
     </div>
     <div style="margin-bottom:14px;padding:10px 12px;background:rgba(79,163,209,0.04);border:1px solid rgba(79,163,209,0.18);border-radius:8px">
       <div style="font-family:var(--fonte-d);font-size:0.6rem;color:var(--primario-v);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">🎨 Aparência Visual</div>
       <div style="font-size:0.78rem;color:var(--suave);margin-bottom:8px">Crie o visual do personagem: templates, builder por partes ou SVG livre.</div>
       <button type="button" onclick="toggleEditChar('${nome}');setTimeout(()=>abrirModalAparencia('${nome.replace(/'/g,"\\'")}'),120)" style="width:100%;padding:9px;background:linear-gradient(135deg,rgba(79,163,209,0.14),rgba(79,163,209,0.06));border:1px solid rgba(79,163,209,0.35);border-radius:6px;color:var(--primario-v);font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">🎨 Editar Aparência</button>
     </div>
     <div style="display:flex;gap:8px">
       <button class="btn btn-primario" style="flex:2" onclick="salvarInfoPersonagem('${nome}')">Salvar</button>
       <button class="btn btn-secundario" style="flex:1" onclick="toggleEditChar('${nome}')">Cancelar</button>
     </div>
     ${RPG_DATA?.myRole==='mestre' ? `<button onclick="excluirPersonagemCompleto('${nome.replace(/'/g,"\\'")}', false)" style="width:100%;margin-top:8px;padding:9px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.25);border-radius:8px;color:#c0392b;font-family:var(--fonte-d);font-size:0.65rem;cursor:pointer;letter-spacing:0.06em;text-transform:uppercase">🗑 Excluir Personagem</button>` : ''}
     ${(RPG_DATA?.myRole==='mestre' && (ca.tipo_personagem||ca.tipo)==='npc') ? `
     <div style="margin-top:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px">
       <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer">
         <input type="checkbox" onchange="charviewToggleOcultarAtribs('${nome.replace(/'/g,"\\'")}',this.checked)" ${ca.ocultar_atributos?'checked':''} style="accent-color:#b07ef0">
         🔒 Ocultar atributos para jogadores
       </label>
     </div>` : ''}
   </div>` : '<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Somente '+nome+' ou o mestre podem editar.</div>'}`;
}


