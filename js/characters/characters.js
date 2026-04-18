// characters/characters.js
// RPG Hub — Character display: char buttons, char view, level up, XP, attribute rendering
// Includes: renderCharButtons(), renderCharView(), abrirModalLevelUp(), renderAttrView()

// ── LEVEL UP (MESTRE) ──────────────────────────────────────────
function abrirModalLevelUp(nome){
 const c=RPG_DATA.characters.find(x=>x.nome===nome); if(!c)return;
 const ca=c.custom_attrs||{};
 const nivel=ca.nivel||1;
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const hp_max_atual=ca.hp_max||100;
 const hp_por_nivel=lc.hp_por_nivel||0;
 const pontos_attr_por_nivel=lc.pontos_attr_por_nivel||0;
 const aumentos=lc.aumentos_automaticos||{};
 const habs_por_nivel=lc.habilidades_por_nivel||{};
 const novoNivel=nivel+1;
 const novo_hp_max=hp_max_atual+hp_por_nivel;
 const novas_habs=(habs_por_nivel[novoNivel]||[]);
 // Montar preview
 let preview=`<b>Nível ${nivel} → ${novoNivel}</b><br><br>`;
 if(hp_por_nivel>0) preview+=`❤ HP Máx: ${hp_max_atual} → ${novo_hp_max}<br>`;
 if(pontos_attr_por_nivel>0) preview+=`⭐ +${pontos_attr_por_nivel} ponto(s) de atributo<br>`;
 Object.entries(aumentos).forEach(([attr,val])=>{ preview+=`🔷 ${attr}: +${val}<br>`; });
 if(novas_habs.length) preview+=`✨ Habilidades desbloqueadas: ${novas_habs.join(', ')}<br>`;
 if(!hp_por_nivel&&!pontos_attr_por_nivel&&!Object.keys(aumentos).length&&!novas_habs.length) preview+='Nenhum bônus automático configurado.';

 const overlay=document.createElement('div');
 overlay.id='modal-levelup-overlay';
 overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
 overlay.innerHTML=`
   <div style="background:var(--painel);border:1px solid rgba(200,168,75,0.4);border-radius:12px;padding:24px;width:100%;max-width:400px">
     <div style="font-family:var(--fonte-d);font-size:0.78rem;color:var(--destaque);text-transform:uppercase;margin-bottom:4px">⬆ Level Up</div>
     <div style="font-family:var(--fonte-d);font-size:1rem;color:var(--texto);margin-bottom:14px">${nome}</div>
     <div style="background:rgba(200,168,75,0.05);border:1px solid rgba(200,168,75,0.2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:0.88rem;line-height:1.8;color:var(--texto)">${preview}</div>
     <div style="display:flex;gap:8px">
       <button onclick="document.getElementById('modal-levelup-overlay').remove()" class="btn btn-secundario" style="flex:1">Cancelar</button>
       <button onclick="executarLevelUp('${nome.replace(/'/g,"\\'")}')" class="btn btn-primario" style="flex:2">✓ Aplicar Level Up</button>
     </div>
   </div>`;
 overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)overlay.remove();});
 document.body.appendChild(overlay);
}

async function executarLevelUp(nome){
 const c=RPG_DATA.characters.find(x=>x.nome===nome); if(!c)return;
 const ca={...(c.custom_attrs||{})};
 const nivel=(ca.nivel||1);
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const hp_por_nivel=lc.hp_por_nivel||0;
 const pontos_attr_por_nivel=lc.pontos_attr_por_nivel||0;
 const aumentos=lc.aumentos_automaticos||{};
 const novo_nivel=nivel+1;
 ca.nivel=novo_nivel;
 ca.xp=0; // reset XP ao subir
 ca.pontos_attr=(ca.pontos_attr||0)+pontos_attr_por_nivel;
 if(!ca.atributos)ca.atributos={};
 // Aplicar aumentos automáticos de atributo PRIMEIRO
 Object.entries(aumentos).forEach(([attr,val])=>{ca.atributos[attr]=(parseFloat(ca.atributos[attr])||0)+val;});

 // BUG-04 FIX: recalcular hp_max APÓS os aumentos de atributo, para que
 // hp_attr_mult seja aplicado sobre o novo valor do atributo
 const hp_antigo = ca.hp_max || 100;
 c.custom_attrs = ca; // sincronizar antes de chamar recalcularHpMax
 const novo_hp_max = recalcularHpMax(c) ?? (hp_antigo + hp_por_nivel);
 ca.hp_max = novo_hp_max;
 c.hp_max  = novo_hp_max;

 // Aumentar hp_atual proporcionalmente à diferença
 const ganho_hp = novo_hp_max - hp_antigo;
 c.hp_atual = Math.min(novo_hp_max, (c.hp_atual ?? hp_antigo) + Math.max(0, ganho_hp));
 c.custom_attrs = ca;
 try{
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify({
       hp_atual:c.hp_atual,
       custom_attrs:ca,
       nivel:ca.nivel,
       hp_max:ca.hp_max,
       xp:ca.xp,
       pontos_attr:ca.pontos_attr
     })});
   document.getElementById('modal-levelup-overlay')?.remove();
   mostrarToast(`${nome} subiu para o Nível ${novo_nivel}! 🎉 (HP max: ${novo_hp_max})`,'sucesso');
   renderCharView(nome);
 }catch(e){mostrarToast('Erro ao aplicar level up','erro');}
}

// ================================================================
// SISTEMA DE XP DA MESA
// ================================================================

let _xpModalNome = null; // personagem atualmente aberto no modal XP

function abrirModalXP(nome) {
  _xpModalNome = nome;
  const overlay = document.getElementById('modal-xp-overlay');
  if (!overlay) return;
  document.getElementById('xp-modal-nome').textContent = nome;
  document.getElementById('xp-todos-input').style.display = 'none';
  xpAtualizarModalUI(nome);
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalXP(); };
}

function fecharModalXP() {
  document.getElementById('modal-xp-overlay').style.display = 'none';
  _xpModalNome = null;
}

function xpAtualizarModalUI(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel = ca.nivel || 1;
  const nivel_maximo = lc.nivel_maximo || 20;
  const xp = ca.xp || 0;
  const xp_proximo = nivel < nivel_maximo ? nivel * 100 : null;
  const pct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 100;

  document.getElementById('xp-modal-nivel').textContent = `Nivel ${nivel}`;
  document.getElementById('xp-modal-xp-label').textContent = xp_proximo
    ? `XP: ${xp} / ${xp_proximo}`
    : `XP: ${xp} (nivel maximo)`;
  document.getElementById('xp-modal-pct').textContent = xp_proximo ? `${pct}%` : 'Max';
  document.getElementById('xp-modal-barra').style.width = `${pct}%`;
  document.getElementById('xp-manual-input').value = xp;

  // Mostrar botao de level up se XP suficiente
  const levelupWrap = document.getElementById('xp-modal-levelup-wrap');
  const btnForcar = document.getElementById('xp-btn-forcar-levelup');
  if (xp_proximo && xp >= xp_proximo && nivel < nivel_maximo) {
    document.getElementById('xp-modal-levelup-label').textContent =
      `${nome} atingiu XP suficiente para o Nivel ${nivel + 1}!`;
    levelupWrap.style.display = 'block';
    if (btnForcar) btnForcar.style.display = 'none';
  } else {
    levelupWrap.style.display = 'none';
    if (btnForcar) btnForcar.style.display = nivel < nivel_maximo ? '' : 'none';
  }
}

// Dar XP rapido (adiciona ao atual)
async function xpDarRapido(quantidade) {
  const nome = _xpModalNome;
  if (!nome) return;
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = { ...(c.custom_attrs || {}) };
  ca.xp = (ca.xp || 0) + quantidade;
  c.custom_attrs = ca;
  await xpSalvarChar(c, ca);
  xpAtualizarModalUI(nome);
  // Auto level up se atingiu o necessario
  await xpChecarAutoLevelUp(nome);
  mostrarToast(`+${quantidade} XP para ${nome}!`, 'sucesso');
}

// Toggle painel "dar para todos"
function xpDarParaTodos() {
  const wrap = document.getElementById('xp-todos-input');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
  if (wrap.style.display === 'block') document.getElementById('xp-todos-valor').focus();
}

// Confirmar XP para todos os jogadores PCs
async function xpConfirmarTodos() {
  const val = parseInt(document.getElementById('xp-todos-valor').value);
  if (!val || val <= 0) { mostrarToast('Informe um valor valido', 'erro'); return; }
  const pcs = (RPG_DATA.characters || []).filter(c =>
    (c.custom_attrs?.tipo || 'jogador') === 'jogador'
  );
  document.getElementById('xp-todos-input').style.display = 'none';
  document.getElementById('xp-todos-valor').value = '';
  for (const c of pcs) {
    const ca = { ...(c.custom_attrs || {}) };
    ca.xp = (ca.xp || 0) + val;
    c.custom_attrs = ca;
    await xpSalvarChar(c, ca);
    await xpChecarAutoLevelUp(c.nome);
  }
  mostrarToast(`+${val} XP para todos os jogadores!`, 'sucesso');
  if (_xpModalNome) xpAtualizarModalUI(_xpModalNome);
}

// Salvar XP manual (define valor fixo)
async function xpSalvarManual() {
  const nome = _xpModalNome;
  if (!nome) return;
  const val = parseInt(document.getElementById('xp-manual-input').value);
  if (isNaN(val) || val < 0) { mostrarToast('Valor invalido', 'erro'); return; }
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = { ...(c.custom_attrs || {}) };
  ca.xp = val;
  c.custom_attrs = ca;
  await xpSalvarChar(c, ca);
  xpAtualizarModalUI(nome);
  await xpChecarAutoLevelUp(nome);
  mostrarToast(`XP de ${nome} definido para ${val}`, 'sucesso');
}

// Level up pelo botao automatico (quando XP suficiente)
async function xpExecutarLevelUp() {
  const nome = _xpModalNome;
  if (!nome) return;
  await executarLevelUp(nome); // reutiliza a funcao existente
  xpAtualizarModalUI(nome);
}

// Level up manual forcado pelo mestre
async function xpForcarLevelUp() {
  const nome = _xpModalNome;
  if (!nome) return;
  abrirModalLevelUp(nome); // abre o modal de confirmacao existente
}

// Verifica se o personagem atingiu XP para subir e faz o level up automaticamente
async function xpChecarAutoLevelUp(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel = ca.nivel || 1;
  const nivel_maximo = lc.nivel_maximo || 20;
  if (nivel >= nivel_maximo) return;
  const xp_proximo = nivel * 100;
  if ((ca.xp || 0) >= xp_proximo) {
    // Auto level up silencioso
    await executarLevelUp(nome);
    mostrarToast(`⭐ ${nome} subiu para o Nivel ${(ca.nivel || 1) + 1}! XP acumulado.`, 'sucesso');
    if (_xpModalNome === nome) xpAtualizarModalUI(nome);
  }
}

// Salvar char no banco (XP + colunas dedicadas)
async function xpSalvarChar(c, ca) {
  try {
    await sb(
      `characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(c.nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca, xp: ca.xp }) }
    );
  } catch(e) { mostrarToast('Erro ao salvar XP', 'erro'); }
}

async function distribuirPontosAttr(nome){
 const c=RPG_DATA.characters.find(x=>x.nome===nome); if(!c)return;
 const ca={...(c.custom_attrs||{})};
 if(!ca.atributos)ca.atributos={};
 const attrDefs=RPG_DATA.attrDefs||[];
 let total=0;
 const aumentos={};
 // BUG-03 FIX: Somente atributos básicos/especiais podem receber pontos (não status nem resistência)
 attrDefs.filter(a=>a.tipo==='number'&&(a.categoria==='basico'||a.categoria==='especial'||!a.categoria)).forEach(a=>{
   const k='pa-'+a.nome.replace(/[^a-z0-9]/gi,'_');
   const el=document.getElementById(k);
   const v=parseInt(el?.value||0);
   if(v>0){aumentos[a.nome]=v;total+=v;}
 });
 if(total===0){mostrarToast('Informe ao menos +1 em algum atributo','erro');return;}
 if(total>(ca.pontos_attr||0)){mostrarToast(`Você tem apenas ${ca.pontos_attr} ponto(s)!`,'erro');return;}
 Object.entries(aumentos).forEach(([attr,val])=>{ca.atributos[attr]=(parseFloat(ca.atributos[attr])||0)+val;});
 ca.pontos_attr=(ca.pontos_attr||0)-total;
 // BUG-04 FIX: Recalcular hp_max quando atributo que afeta HP é distribuído
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const novoHpMax = calcularHpMaxComAtributos(lc, ca.atributos, c.hp_max, ca.nivel||1);
 if(novoHpMax && novoHpMax !== c.hp_max){ ca.hp_max=novoHpMax; c.hp_max=novoHpMax; }
 c.custom_attrs=ca;
 try{
   const patchBody={custom_attrs:ca,pontos_attr:ca.pontos_attr};
   if(novoHpMax && novoHpMax !== (c.hp_max||0)) patchBody.hp_max=novoHpMax;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(patchBody)});
   mostrarToast('Atributos distribuídos!','sucesso');
   renderCharView(nome); renderAttrView(nome);
 }catch(e){mostrarToast('Erro ao salvar','erro');}
}

// ── ATRIBUTOS ─────────────────────────────────────────────────
function renderAttrButtons(){
  document.getElementById('attr-select-row').innerHTML=buildCharBtns('attr');
  _charSearchToggle('attr');
}


function renderAttrView(nome){
 const c=RPG_DATA.characters.find(x=>x.nome===nome); if(!c)return;
 const ad=RPG_DATA.attrDefs||[];
 const ca=c.custom_attrs||{};
 const atribs=ca.atributos||{};
 const hp_max=ca.hp_max||100;
 const hp=c.hp_atual??hp_max;
 const hpPct=Math.round((hp/hp_max)*100);
 const cor=ca.cor||'var(--primario)';

 // Determinar se é NPC genérico (só vê atributos básicos)
 const tipoChar = ca.tipo_personagem || ca.tipo || 'jogador';
 const ehGenerico = ca.npc_generico === true;
 const ehNpc = tipoChar === 'npc';
 const isMestreView = RPG_DATA?.myRole === 'mestre';
 const ocultarAtribsNpc = !isMestreView && ehNpc && ca.ocultar_atributos === true;
 const somenteBasico = ehGenerico; // NPCs genéricos: só atributos básicos

 // Filtrar attrs por categoria
 const adVisiveis = ocultarAtribsNpc ? [] : ad.filter(a => somenteBasico ? ['basico','resistencia'].includes(a.categoria || 'basico') : true);
 const adBasicos    = adVisiveis.filter(a => (a.categoria || 'basico') === 'basico');
 const adEspeciais  = adVisiveis.filter(a => a.categoria === 'especial');
 const adStatus     = adVisiveis.filter(a => a.categoria === 'status');
 const adResistencia= adVisiveis.filter(a => a.categoria === 'resistencia');

 const renderStatBox = (a) => {
   const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
   return `<div class="stat-box" style="border-top:2px solid ${cor}"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:${cor}">${v}</div></div>`;
 };

 // Status pools — show as mini bars if they have a max formula
 const renderStatusBar = (a) => {
   const v = parseFloat(atribs[a.nome]) || 0;
   let maxVal = v;
   try {
     const cfg = JSON.parse(a.opcoes || '{}');
     if (cfg.max_base !== undefined) {
       const attrVal = parseFloat(atribs[cfg.max_attr] || 0);
       maxVal = (cfg.max_base || 0) + attrVal * (cfg.max_mult || 0);
     }
   } catch(e) {}
   if (maxVal > 0 && maxVal !== v) {
     const pct = Math.round(Math.min(v / maxVal, 1) * 100);
     return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-family:var(--fonte-d);font-size:0.65rem;color:#4fa3d1;margin-bottom:3px"><span>${a.nome}</span><span>${v} / ${Math.round(maxVal)}</span></div><div style="height:6px;background:rgba(79,163,209,0.15);border-radius:3px"><div style="height:100%;width:${pct}%;background:#4fa3d1;border-radius:3px;transition:width 0.3s"></div></div></div>`;
   }
   return `<div class="stat-box" style="border-top:2px solid #4fa3d1"><div class="stat-label">${a.nome}</div><div class="stat-valor" style="color:#4fa3d1">${v}</div></div>`;
 };

 // Resistencias — show with shield icon and percentage/value
 const renderResistenciaBox = (a) => {
   const v = atribs[a.nome] !== undefined ? atribs[a.nome] : '—';
   let label = a.nome;
   let tooltip = '';
   try {
     const cfg = JSON.parse(a.opcoes || '{}');
     if (cfg.tipo === 'armadura') tooltip = `${cfg.pct_geral||0}% geral · ${cfg.pct_fisico||0}% físico`;
     else if (cfg.tipo === 'resistencia') tooltip = `vs ${cfg.damage_type||'?'} (${cfg.modo||'%'})`;
   } catch(e) {}
   return `<div class="stat-box" style="border-top:2px solid #e8a020" title="${tooltip}"><div class="stat-label" style="color:#e8a020">🛡 ${label}</div><div class="stat-valor" style="color:#e8a020">${v}</div></div>`;
 };

 const boxesBasicos    = adBasicos.map(renderStatBox).join('');
 const boxesEspeciais  = adEspeciais.map(renderStatBox).join('');
 const boxesStatus     = adStatus.map(renderStatusBar).join('');
 const boxesResistencia= adResistencia.map(renderResistenciaBox).join('');
 const boxes = (adStatus.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#4fa3d1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">📊 Recursos</div><div class="stats-grid">${boxesStatus}</div>` : '')
   + (adBasicos.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:var(--suave);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">🔷 Básicos</div><div class="stats-grid">${boxesBasicos}</div>` : '')
   + (adEspeciais.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">✨ Especiais</div><div class="stats-grid">${boxesEspeciais}</div>` : '')
   + (adResistencia.length ? `<div style="font-family:var(--fonte-d);font-size:0.58rem;color:#e8a020;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:10px">🛡 Defesas</div><div class="stats-grid">${boxesResistencia}</div>` : '')
   + (ocultarAtribsNpc ? `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:10px 0">— atributos não revelados —</div>` : '');

 // Toggle ocultar atributos (mestre + NPC)
 const ocultarToggleHtml = (isMestreView && ehNpc) ? `
   <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(176,126,240,0.05);border:1px solid rgba(176,126,240,0.15);border-radius:8px;margin-top:10px">
     <label style="display:flex;align-items:center;gap:8px;font-family:var(--fonte-d);font-size:0.6rem;color:#b07ef0;text-transform:uppercase;letter-spacing:0.07em;cursor:pointer;flex:1">
       <input type="checkbox" id="attrview-toggle-ocultar" onchange="attrviewToggleOcultarAtribs('${nome.replace(/'/g,"\\'")}') " ${ca.ocultar_atributos ? 'checked' : ''} style="accent-color:#b07ef0">
       Ocultar atributos para jogadores
     </label>
   </div>` : '';

 const renderEditField = (a) => {
   const key = a.nome.replace(/[^a-z0-9]/gi,'_');
   if(a.tipo==='number') return `<div class="form-group"><label>${a.nome}</label><input type="number" id="fca-${key}" value="${atribs[a.nome]||0}" min="0"></div>`;
   if(a.tipo==='text')   return `<div class="form-group"><label>${a.nome}</label><input type="text" id="fca-${key}" value="${atribs[a.nome]||''}"></div>`;
   if(a.tipo==='boolean') return `<div class="form-group"><label>${a.nome}</label><select id="fca-${key}"><option value="true"${atribs[a.nome]===true||atribs[a.nome]==='true'?' selected':''}>Sim</option><option value="false"${!atribs[a.nome]?' selected':''}>Não</option></select></div>`;
   if(a.tipo==='select'){const ops=(a.opcoes||'').split(',').map(x=>x.trim()).filter(Boolean);return`<div class="form-group"><label>${a.nome}</label><select id="fca-${key}">${ops.map(o=>`<option value="${o}"${atribs[a.nome]===o?' selected':''}>${o}</option>`).join('')}</select></div>`;}
   return '';
 };
 // Campos editáveis: só atributos visíveis ao personagem (excluindo resistência — mestre edita nos atribs; excluindo status — tem editStatus separado)
 const editCust = adVisiveis.filter(a => (a.categoria !== 'resistencia' || isMestreView) && a.categoria !== 'status').map(renderEditField).join('');
 // Status pools: edit separately with max label — BUG-01 FIX: agora usado no template
 const editStatus = adStatus.map(a => {
   const key = a.nome.replace(/[^a-z0-9]/gi,'_');
   let maxVal = ''; 
   try { 
     const cfg = JSON.parse(a.opcoes||'{}');
     if (cfg.max_base !== undefined) {
       const attrVal = parseFloat(atribs[cfg.max_attr]||0);
       maxVal = ` / ${Math.ceil(cfg.max_base + attrVal*(cfg.max_mult||0))}`;
     }
   } catch(e) {}
   return `<div class="form-group"><label>${a.nome}${maxVal}</label><input type="number" id="fca-${key}" value="${atribs[a.nome]||0}" min="0"></div>`;
 }).join('');

 const imgAttr = normalizeImgUrl(ca.img||'');
 const aparenciaAttr = ca.aparencia || {};
 let avatarAttrHtml;
 if (aparenciaAttr && (aparenciaAttr.modo === 'builder' || aparenciaAttr.modo === 'criatura' || aparenciaAttr.modo === 'svg' || aparenciaAttr.modo === 'imagem')) {
   const miniSvgAttr = typeof apmodTokenSVG === 'function' ? apmodTokenSVG(c, 'geral') : null;
   if (miniSvgAttr) {
     avatarAttrHtml = `<div style="width:64px;height:64px;border-radius:50%;border:2px solid ${cor};overflow:hidden;display:flex;align-items:center;justify-content:center;background:${cor}14">${miniSvgAttr}</div>`;
   } else {
     avatarAttrHtml = imgAttr
       ? `<img src="${imgAttr}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid ${cor}" onerror="this.style.display='none'">`
       : `<div style="width:64px;height:64px;border-radius:50%;background:${cor}18;border:2px solid ${cor}44;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:${cor}">${c.nome[0]||'?'}</div>`;
   }
 } else {
   avatarAttrHtml = imgAttr
     ? `<img src="${imgAttr}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid ${cor}" onerror="this.style.display='none'">`
     : `<div style="width:64px;height:64px;border-radius:50%;background:${cor}18;border:2px solid ${cor}44;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:${cor}">${c.nome[0]||'?'}</div>`;
 }
 document.getElementById('attr-view').innerHTML=`
   <div class="card" style="border-top:3px solid ${cor}">
     <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
       <div style="position:relative;flex-shrink:0">
         ${avatarAttrHtml}
       </div>
       <div>
         <div style="font-family:var(--fonte-d);font-size:1rem;color:var(--texto)">${c.nome}</div>
         <div style="font-size:0.8rem;color:${cor};font-style:italic">${ca.tipo||'jogador'}${ca.classe?' · '+ca.classe:''}${ca.raca?' · '+ca.raca:''}</div>
       </div>
     </div>
     ${(() => {
       const ehMoribundo = ca.moribundo === true;
       if (!ehMoribundo) return '';
       const salv = ca.salvaguardas || { sucessos: 0, falhas: 0 };
       return `<div style="background:rgba(142,68,173,0.12);border:1px solid rgba(142,68,173,0.4);
            border-radius:8px;padding:8px 12px;margin-bottom:10px;text-align:center">
         <div style="font-family:var(--fonte-d);font-size:0.65rem;color:#b07ef0;
              text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">
           ☠ Moribundo — Salvaguardas de Morte
         </div>
         <div style="font-size:0.78rem;color:var(--texto)">
           ✔ ${salv.sucessos}/2  &nbsp; ✘ ${salv.falhas}/3
         </div>
       </div>`;
     })()}
     <div class="barra-container barra-hp">
       <div class="barra-header"><span class="barra-nome">HP</span><span class="barra-num" style="color:var(--perigo)">${hp} / ${hp_max}</span></div>
       <div class="barra-bg"><div class="barra-fill" style="width:${Math.min(hpPct,100)}%"></div></div>
     </div>
   </div>
   ${boxes}
   ${ocultarToggleHtml}
   ${podeEditarPersonagem(nome)
     ? `<div style="margin-top:4px"><button class="btn btn-secundario" style="width:100%" onclick="toggleEdit('${nome}')">✏ Editar Atributos</button></div>
   <div class="edit-form" id="edit-form-${nome}">
     <div class="card-titulo" style="margin-bottom:12px">Atributos — ${nome}</div>
     <div class="form-grid">
       <div class="form-group"><label>HP Atual</label><input type="number" id="f-hp_atual" value="${hp}" min="0" max="${hp_max}"></div>
       ${editStatus}
       ${editCust}
     </div>
     <div style="display:flex;gap:8px;margin-top:4px">
       <button class="btn btn-primario" style="flex:2" onclick="salvarAtributos('${nome}')">Salvar</button>
       <button class="btn btn-secundario" style="flex:1" onclick="toggleEdit('${nome}')">Cancelar</button>
     </div>
   </div>`
     : `<div style="font-size:0.78rem;color:var(--suave);font-style:italic;text-align:center;padding:8px">Somente ${nome} ou o mestre podem editar.</div>`}`;
}

function toggleEdit(nome){document.getElementById('edit-form-'+nome).classList.toggle('aberto');}
function toggleEditChar(nome){document.getElementById('edit-char-form-'+nome).classList.toggle('aberto');}


async function attrviewToggleOcultarAtribs(nome) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c || !c.custom_attrs) return;
  const novoEstado = document.getElementById('attrview-toggle-ocultar')?.checked ?? false;
  c.custom_attrs.ocultar_atributos = novoEstado;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    mostrarToast(novoEstado ? '🔒 Atributos ocultos para jogadores' : '🔓 Atributos visíveis', '');
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

async function charviewToggleOcultarAtribs(nome, checked) {
  const c = RPG_DATA.characters.find(x => x.nome === nome);
  if (!c || !c.custom_attrs) return;
  c.custom_attrs.ocultar_atributos = checked;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    mostrarToast(checked ? '🔒 Atributos ocultos para jogadores' : '🔓 Atributos visíveis', '');
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

// ── salvarAtributos: salva apenas HP atual + attrDefs (aba Atributos) ──
async function salvarAtributos(nome){
 if (!podeEditarPersonagem(nome)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
 const c=RPG_DATA.characters.find(x=>x.nome===nome);
 if(!c)return;
 const ad=RPG_DATA.attrDefs||[];
 const hp=+(document.getElementById('f-hp_atual')?.value)??c.hp_atual;
 const ca={...(c.custom_attrs||{})};
 if(!ca.atributos)ca.atributos={};
 // Coletar apenas atributos customizados (fca-*)
 ad.forEach(a=>{
   const key='fca-'+a.nome.replace(/[^a-z0-9]/gi,'_');
   const el=document.getElementById(key);
   if(!el)return;
   if(a.tipo==='number')ca.atributos[a.nome]=+el.value;
   else if(a.tipo==='boolean')ca.atributos[a.nome]=el.value==='true';
   else ca.atributos[a.nome]=el.value;
 });
 // BUG-04 FIX: Recalcular hp_max quando atributo hp_attr for editado
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const novoHpMax = calcularHpMaxComAtributos(lc, ca.atributos, null, ca.nivel||1);
 if(novoHpMax && novoHpMax !== c.hp_max){ ca.hp_max=novoHpMax; c.hp_max=novoHpMax; }
 c.hp_atual=hp; c.custom_attrs=ca;
 // UX-02 FIX: Desabilitar botão durante salvamento
 const btnSalvar = document.querySelector(`#edit-form-${CSS.escape(nome)} .btn-primario`);
 if(btnSalvar){btnSalvar.disabled=true;btnSalvar.textContent='Salvando…';}
 try{
   const patchBody={hp_atual:hp,custom_attrs:ca};
   if(novoHpMax && novoHpMax > 0) patchBody.hp_max=novoHpMax;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(patchBody)});
   mostrarToast('Atributos salvos!','sucesso');
   renderAttrView(nome);
 }catch(e){
   mostrarToast('Erro ao salvar atributos','erro');
   if(btnSalvar){btnSalvar.disabled=false;btnSalvar.textContent='Salvar';}
 }
}

// ── salvarInfoPersonagem: salva info do personagem (aba Personagem) ──
async function salvarInfoPersonagem(nome){
 if (!podeEditarPersonagem(nome)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
 const c=RPG_DATA.characters.find(x=>x.nome===nome);
 if(!c)return;
 const ca={...(c.custom_attrs||{})};
 const tipoVal=document.getElementById('fc-tipo')?.value; if(tipoVal) ca.tipo=tipoVal;
 const factionVal=document.getElementById('fc-faction')?.value; if(factionVal) ca.npc_faction=factionVal; else if(tipoVal==='jogador') delete ca.npc_faction;
 const corVal=document.getElementById('fc-cor')?.value; if(corVal) ca.cor=corVal;
 const classeVal=(document.getElementById('fc-classe')?.value||'').trim(); ca.classe=classeVal;
 const racaVal=(document.getElementById('fc-raca')?.value||'').trim(); ca.raca=racaVal;
 const bgVal=(document.getElementById('fc-background')?.value||'').trim(); ca.background=bgVal;
 const eqVal=(document.getElementById('fc-equipamentos')?.value||'').trim(); ca.equipamentos=eqVal;
 const compVal=(document.getElementById('fc-companheiro')?.value||'').trim(); ca.companheiro=compVal;
 const ehPetVal=document.getElementById('fc-eh-pet')?.checked||false; ca.eh_pet=ehPetVal;
 const petDonoVal=ehPetVal?(document.getElementById('fc-pet-dono')?.value||'').trim():''; ca.pet_dono=petDonoVal||null;
 const imgVal=(document.getElementById('fc-img')?.value||'').trim(); ca.img=imgVal;
 // Verificar rename
 const novoNome=(document.getElementById('fc-nome')?.value||'').trim();
 const renomear=novoNome && novoNome!==nome;
 if(renomear){
   const dup=RPG_DATA.characters.find(x=>x.nome===novoNome);
   if(dup){mostrarToast(`Já existe um personagem chamado "${novoNome}"`, 'erro');return;}
 }
 c.custom_attrs=ca;
 const nomeAlvo=renomear?novoNome:nome;
 try{
   const bodyChar={custom_attrs:ca};
   if(renomear) bodyChar.nome=novoNome;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(bodyChar)});
   if(renomear){
     // Atualizar campo personagem para compat com registros antigos
     await sb(`skills?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&personagem=eq.${encodeURIComponent(nome)}`,
       {method:'PATCH',body:JSON.stringify({personagem:novoNome})});
     // Migrar character_id em skills que ainda não o possuem
     const _cIdRename = RPG_DATA.characters.find(x => x.nome === nome)?.id;
     if (_cIdRename) {
       await sb(`skills?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&personagem=eq.${encodeURIComponent(nome)}&character_id=is.null`,
         {method:'PATCH',body:JSON.stringify({character_id:_cIdRename})}).catch(()=>{});
     }
     RPG_DATA.skills.forEach(s=>{if(s.personagem===nome){s.personagem=novoNome;if(_cIdRename&&!s.character_id)s.character_id=_cIdRename;}});
     try{
       await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&linked=eq.${encodeURIComponent(nome)}`,
         {method:'PATCH',body:JSON.stringify({linked:novoNome})});
     }catch(e2){}
     c.nome=novoNome;
     if(CHAR_VIEW===nome) CHAR_VIEW=novoNome;
     if(ATTR_VIEW===nome) ATTR_VIEW=novoNome;
     if(CFG_CHAR===nome) CFG_CHAR=novoNome;
     if(RPG_DATA.linked===nome) RPG_DATA.linked=novoNome;
     renderCharButtons(); renderAttrButtons(); renderConfig(); renderHeader();
   }
   mostrarToast('Personagem salvo!','sucesso');
   renderCharView(nomeAlvo);
   renderAttrView(nomeAlvo);
 }catch(e){mostrarToast('Erro ao salvar personagem','erro');}
}



// ── NOVO PERSONAGEM — (movido de characters/skills.js) ──────────
// ── 14B: NOVO PERSONAGEM ──────────────────────────────────────
function abrirModalNovoChar() {
  document.getElementById('nc-nome').value = '';
  document.getElementById('nc-tipo').value = 'jogador';
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  document.getElementById('nc-nivel').value = 1;
  document.getElementById('nc-hp').value = hp_base;
  document.getElementById('nc-classe').value = '';
  document.getElementById('nc-raca').value = '';
  document.getElementById('nc-cor').value = '#4fa3d1';
  const overlay = document.getElementById('modal-novo-char-overlay');
  overlay.style.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalNovoChar(); };
}
function fecharModalNovoChar() {
  document.getElementById('modal-novo-char-overlay').style.display = 'none';
}
async function criarNovoPersonagem() {
  const nome = document.getElementById('nc-nome').value.trim();
  if (!nome) { mostrarToast('Nome obrigatório', 'erro'); return; }
  if (RPG_DATA.characters.find(c => c.nome === nome)) { mostrarToast('Já existe um personagem com esse nome', 'erro'); return; }
  const tipo = document.getElementById('nc-tipo').value;
  const nivel = parseInt(document.getElementById('nc-nivel')?.value)||1;
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  const hp_por_nivel=lc.hp_por_nivel||0;
  const hp_max=hp_base+(nivel-1)*hp_por_nivel;
  const hp_max_override=+(document.getElementById('nc-hp').value)||hp_max;
  const cor = document.getElementById('nc-cor').value || '#4fa3d1';
  const classe = document.getElementById('nc-classe').value.trim();
  const raca = document.getElementById('nc-raca').value.trim();
  const ca = { tipo, cor, nivel, hp_max:hp_max_override, xp:0, pontos_attr:0 };
  if (classe) ca.classe = classe;
  if (raca) ca.raca = raca;
  if (tipo === 'npc') ca.tipo_personagem = 'npc';
  if (tipo === 'npc' || tipo === 'criatura') {
    const factionNew = document.getElementById('nc-faction')?.value || 'inimigo';
    ca.npc_faction = factionNew;
  }
  try {
    const [novo] = await sb('characters', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        rpg_id: RPG_DATA.rpgId, nome, hp_atual: hp_max_override, custom_attrs: ca,
        nivel: nivel, hp_max: hp_max_override, xp: 0, pontos_attr: 0
      })
    });
    RPG_DATA.characters.push(novo || { nome, hp_atual: hp_max_override, custom_attrs: ca });
    fecharModalNovoChar();
    renderCharButtons();
    renderAttrButtons();
    renderConfig();
    mostrarToast(`${nome} criado!`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao criar personagem', 'erro'); }
}
