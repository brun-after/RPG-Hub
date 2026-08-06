// characters/characters.js
// RPG Hub — Character display: char buttons, char view, level up, XP, attribute rendering
// Includes: renderCharButtons(), renderCharView(), abrirModalLevelUp(), renderAttrView()

// ── LEVEL UP (MESTRE) ──────────────────────────────────────────
function abrirModalLevelUp(nome: any){
 const c=RPG_DATA!.characters.find(x=>x.nome===nome); if(!c)return;
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
 Object.entries<any>(aumentos).forEach(([attr,val])=>{ preview+=`🔷 ${attr}: +${val}<br>`; });
 if(novas_habs.length) preview+=`✨ Habilidades desbloqueadas: ${novas_habs.join(', ')}<br>`;
 if(!hp_por_nivel&&!pontos_attr_por_nivel&&!Object.keys(aumentos).length&&!novas_habs.length) preview+='Nenhum bônus automático configurado.';

 const overlay=document.createElement('div');
 overlay.id='modal-levelup-overlay';
 overlay.style!.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
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

async function executarLevelUp(nome: any){
 const c=RPG_DATA!.characters.find(x=>x.nome===nome); if(!c)return;
 const ca={...(c.custom_attrs||{})};
 const nivel=(ca.nivel||1);
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const hp_por_nivel=lc.hp_por_nivel||0;
 // BUG-07 FIX: usar ?? 3 como padrão para garantir pontos de atributo sem config.
 const pontos_attr_por_nivel=lc.pontos_attr_por_nivel??3;
 const aumentos=lc.aumentos_automaticos||{};
 const novo_nivel=nivel+1;
 ca.nivel=novo_nivel;
 // BUG-02 FIX: carregar XP overflow para o próximo nível em vez de zerar.
 const xp_antes = ca.xp || 0;
 const xp_threshold = _xpParaNivel(nivel);
 ca.xp = Math.max(0, xp_antes - xp_threshold);
 ca.pontos_attr=(ca.pontos_attr||0)+pontos_attr_por_nivel;
 if(!ca.atributos)ca.atributos={};
 // Aplicar aumentos automáticos de atributo PRIMEIRO
 Object.entries<any>(aumentos).forEach(([attr,val])=>{ca.atributos![attr]=(parseFloat(ca.atributos![attr])||0)+val;});

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
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify({
       hp_atual:c.hp_atual,
       custom_attrs:ca,
       nivel:ca.nivel,
       hp_max:ca.hp_max,
       xp:ca.xp,
       pontos_attr:ca.pontos_attr
     })});
   if(c.custom_attrs?.linhagem_id && typeof window._avtSyncLinhagem==='function') window._avtSyncLinhagem(c);
   document.getElementById('modal-levelup-overlay')?.remove();
   mostrarToast(`${nome} subiu para o Nível ${novo_nivel}! 🎉 (HP max: ${novo_hp_max})`,'sucesso');
   renderCharView(nome);
 }catch(e){mostrarToast('Erro ao aplicar level up','erro');}
}

// ================================================================
// SISTEMA DE XP DA MESA
// ================================================================

let _xpModalNome: any = null; // personagem atualmente aberto no modal XP

function abrirModalXP(nome: any) {
  _xpModalNome = nome;
  const overlay = document.getElementById('modal-xp-overlay');
  if (!overlay) return;
  document.getElementById('xp-modal-nome')!.textContent = nome;
  document.getElementById('xp-todos-input')!.style!.display = 'none';
  xpAtualizarModalUI(nome);
  overlay.style!.display = 'flex';
  overlay.onclick = e => { if (e.target === overlay) fecharModalXP(); };
}

function fecharModalXP() {
  document.getElementById('modal-xp-overlay')!.style!.display = 'none';
  _xpModalNome = null;
}

function xpAtualizarModalUI(nome: any) {
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
  if (!c) return;
  const ca = c.custom_attrs || {};
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel = ca.nivel || 1;
  const nivel_maximo = lc.nivel_maximo || 20;
  const xp = ca.xp || 0;
  const xp_proximo = nivel < nivel_maximo ? nivel * 100 : null;
  const pct = xp_proximo ? Math.min(100, Math.round(xp / xp_proximo * 100)) : 100;

  document.getElementById('xp-modal-nivel')!.textContent = `Nivel ${nivel}`;
  document.getElementById('xp-modal-xp-label')!.textContent = xp_proximo
    ? `XP: ${xp} / ${xp_proximo}`
    : `XP: ${xp} (nivel maximo)`;
  document.getElementById('xp-modal-pct')!.textContent = xp_proximo ? `${pct}%` : 'Max';
  document.getElementById('xp-modal-barra')!.style!.width = `${pct}%`;
  document.getElementById('xp-manual-input')!.value = (xp) as any;

  // Mostrar botao de level up se XP suficiente
  const levelupWrap = document.getElementById('xp-modal-levelup-wrap');
  const btnForcar = document.getElementById('xp-btn-forcar-levelup');
  if (xp_proximo && xp >= xp_proximo && nivel < nivel_maximo) {
    document.getElementById('xp-modal-levelup-label')!.textContent =
      `${nome} atingiu XP suficiente para o Nivel ${nivel + 1}!`;
    levelupWrap!.style!.display = 'block';
    if (btnForcar) btnForcar.style!.display = 'none';
  } else {
    levelupWrap!.style!.display = 'none';
    if (btnForcar) btnForcar.style!.display = nivel < nivel_maximo ? '' : 'none';
  }
}

// Dar XP rapido (adiciona ao atual)
async function xpDarRapido(quantidade: any) {
  const nome = _xpModalNome;
  if (!nome) return;
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
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
  wrap!.style!.display = wrap!.style!.display === 'none' ? 'block' : 'none';
  if (wrap!.style!.display === 'block') document.getElementById('xp-todos-valor')!.focus!()!;
}

// Confirmar XP para todos os jogadores PCs
async function xpConfirmarTodos() {
  const val = parseInt(document.getElementById('xp-todos-valor')!.value!);
  if (!val || val <= 0) { mostrarToast('Informe um valor valido', 'erro'); return; }
  const pcs = (RPG_DATA!.characters || []).filter(c =>
    (c.custom_attrs?.tipo || 'jogador') === 'jogador'
  );
  document.getElementById('xp-todos-input')!.style!.display = 'none';
  document.getElementById('xp-todos-valor')!.value = '';
  for (const c of pcs) {
    const ca = { ...(c.custom_attrs || {}) };
    ca.xp = (ca.xp || 0) + val;
    c.custom_attrs = ca;
    await xpSalvarChar(c, ca);
    await xpChecarAutoLevelUp(c.nome);
  }
  mostrarToast(`+${val} XP para todos os jogadores!`, 'sucesso');
  if (_xpModalNome) xpAtualizarModalUI(_xpModalNome);
  // Broadcast XP para todos os players verem sem precisar de refresh
  if (typeof combateBroadcast === 'function') {
    combateBroadcast('xp_distribuido', { quantidade: val, destinatarios: pcs.map(c => c.nome) });
  }
}

// Salvar XP manual (define valor fixo)
async function xpSalvarManual() {
  const nome = _xpModalNome;
  if (!nome) return;
  const val = parseInt(document.getElementById('xp-manual-input')!.value!);
  if (isNaN(val) || val < 0) { mostrarToast('Valor invalido', 'erro'); return; }
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
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

// Retorna XP necessário para subir do nivel informado.
function _xpParaNivel(nivel: any) {
  const thresholds = CURRENT_RPG?.theme?.level_config?.xp_thresholds;
  if (Array.isArray(thresholds) && thresholds[nivel - 1] != null) {
    return thresholds[nivel - 1];
  }
  return nivel * 100;
}

// Verifica se o personagem atingiu XP para subir e faz o level up automaticamente.
// BUG-02 FIX: while loop para suportar múltiplos níveis de uma vez.
async function xpChecarAutoLevelUp(nome: any) {
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
  if (!c) return;
  const lc = (CURRENT_RPG?.theme?.level_config) || {};
  const nivel_maximo = lc.nivel_maximo || 20;
  let leveled = false;

  while (true) {
    const ca = c.custom_attrs || {};
    const nivel = ca.nivel || 1;
    if (nivel >= nivel_maximo) break;
    const xp_proximo = _xpParaNivel(nivel);
    if ((ca.xp || 0) < xp_proximo) break;
    await executarLevelUp(nome);
    leveled = true;
  }

  if (leveled) {
    const ca = c.custom_attrs || {};
    mostrarToast(`⭐ ${nome} subiu para o Nível ${ca.nivel}! XP acumulado.`, 'sucesso');
    if (_xpModalNome === nome) xpAtualizarModalUI(nome);
  }
}

// Salvar char no banco (XP + colunas dedicadas)
async function xpSalvarChar(c: any, ca: any) {
  try {
    await sb(
      `characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(c.nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: ca, xp: ca.xp }) }
    );
  } catch(e) { mostrarToast('Erro ao salvar XP', 'erro'); }
}

async function distribuirPontosAttr(nome: any){
 const c=RPG_DATA!.characters.find(x=>x.nome===nome); if(!c)return;
 const ca: any={...(c.custom_attrs||{})};
 if(!ca.atributos)ca.atributos={};
 const attrDefs=RPG_DATA!.attrDefs||[];
 let total=0;
 const aumentos: Record<string, any> = {};
 // BUG-03 FIX: Somente atributos básicos/especiais podem receber pontos (não status nem resistência)
 attrDefs.filter(a=>a.tipo==='number'&&(a.categoria==='basico'||a.categoria==='especial'||!a.categoria)).forEach(a=>{
   const k='pa-'+a.nome.replace(/[^a-z0-9]/gi,'_');
   const el=document.getElementById(k);
   const v=parseInt((el?.value||0 as any));
   if(v>0){aumentos[a.nome]=v;total+=v;}
 });
 if(total===0){mostrarToast('Informe ao menos +1 em algum atributo','erro');return;}
 if(total>(ca.pontos_attr||0)){mostrarToast(`Você tem apenas ${ca.pontos_attr} ponto(s)!`,'erro');return;}
 Object.entries<any>(aumentos).forEach(([attr,val])=>{ca.atributos[attr]=(parseFloat(ca.atributos[attr])||0)+val;});
 ca.pontos_attr=(ca.pontos_attr||0)-total;
 // BUG-04 FIX: Recalcular hp_max quando atributo que afeta HP é distribuído
 const lc=(CURRENT_RPG?.theme?.level_config)||{};
 const novoHpMax = calcularHpMaxComAtributos(lc, ca.atributos, c.hp_max, ca.nivel||1);
 if(novoHpMax && novoHpMax !== c.hp_max){ ca.hp_max=novoHpMax; c.hp_max=novoHpMax; }
 c.custom_attrs=ca;
 try{
   const patchBody: any={custom_attrs:ca,pontos_attr:ca.pontos_attr};
   if(novoHpMax && novoHpMax !== (c.hp_max||0)) patchBody.hp_max=novoHpMax;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(patchBody)});
   if(c.custom_attrs?.linhagem_id && typeof window._avtSyncLinhagem==='function') window._avtSyncLinhagem(c);
   mostrarToast('Atributos distribuídos!','sucesso');
   if (typeof renderFichaView === 'function') renderFichaView(nome); else { renderCharView(nome); renderAttrView(nome); }
 }catch(e){mostrarToast('Erro ao salvar','erro');}
}

// ── ATRIBUTOS ─────────────────────────────────────────────────
function renderAttrButtons() {
  // Shim: delegates to fichas system
  if (typeof renderFichasBtns === 'function') renderFichasBtns();
}


function renderAttrView(nome: any) {
  // Shim: delegates to unified fichas system
  FICHAS_VIEW = ATTR_VIEW = nome;
  if (typeof renderFichaView === 'function') renderFichaView(nome);
}

function toggleEdit(nome: any){document.getElementById('edit-form-'+nome)!.classList!.toggle!('aberto')!;}
function toggleEditChar(nome: any){document.getElementById('edit-char-form-'+nome)!.classList!.toggle!('aberto')!;}


async function attrviewToggleOcultarAtribs(nome: any) {
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
  if (!c || !c.custom_attrs) return;
  const novoEstado = document.getElementById('attrview-toggle-ocultar')?.checked ?? false;
  c.custom_attrs.ocultar_atributos = novoEstado;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    mostrarToast(novoEstado ? '🔒 Atributos ocultos para jogadores' : '🔓 Atributos visíveis', '');
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

async function charviewToggleOcultarAtribs(nome: any, checked: any) {
  const c = RPG_DATA!.characters.find(x => x.nome === nome);
  if (!c || !c.custom_attrs) return;
  c.custom_attrs.ocultar_atributos = checked;
  try {
    await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
      { method: 'PATCH', body: JSON.stringify({ custom_attrs: c.custom_attrs }) });
    mostrarToast(checked ? '🔒 Atributos ocultos para jogadores' : '🔓 Atributos visíveis', '');
  } catch(e) { mostrarToast('Erro ao salvar', 'erro'); }
}

// ── salvarAtributos: salva apenas HP atual + attrDefs (aba Atributos) ──
async function salvarAtributos(nome: any){
 if (!podeEditarPersonagem(nome)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
 const c=RPG_DATA!.characters.find(x=>x.nome===nome);
 if(!c)return;
 const ad=RPG_DATA!.attrDefs||[];
 // @ts-expect-error — bug latente preservado: '+x' nunca é nullish, o ?? à direita nunca dispara
 const hp=(+(document.getElementById('f-hp_atual')?.value) as any)??c.hp_atual;
 const ca: any={...(c.custom_attrs||{})};
 if(!ca.atributos)ca.atributos={};
 // Coletar apenas atributos customizados (fca-*)
 ad.forEach(a=>{
   const key='fca-'+a.nome.replace(/[^a-z0-9]/gi,'_');
   const el=document.getElementById(key);
   if(!el)return;
   if(a.tipo==='number')ca.atributos[a.nome]=+el.value!;
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
   const patchBody: any={hp_atual:hp,custom_attrs:ca};
   if(novoHpMax && novoHpMax > 0) patchBody.hp_max=novoHpMax;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(patchBody)});
   mostrarToast('Atributos salvos!','sucesso');
   if(typeof renderFichaView==='function') renderFichaView(nome); else renderAttrView(nome);
 }catch(e){
   mostrarToast('Erro ao salvar atributos','erro');
   if(btnSalvar){btnSalvar.disabled=false;btnSalvar.textContent='Salvar';}
 }
}

// ── salvarInfoPersonagem: salva info do personagem (aba Personagem) ──
async function salvarInfoPersonagem(nome: any){
 if (!podeEditarPersonagem(nome)) { mostrarToast('Sem permissão para editar este personagem', 'erro'); return; }
 const c=RPG_DATA!.characters.find(x=>x.nome===nome);
 if(!c)return;
 const ca: any={...(c.custom_attrs||{})};
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
   const dup=RPG_DATA!.characters.find(x=>x.nome===novoNome);
   if(dup){mostrarToast(`Já existe um personagem chamado "${novoNome}"`, 'erro');return;}
 }
 c.custom_attrs=ca;
 const nomeAlvo=renomear?novoNome:nome;
 try{
   const bodyChar: any={custom_attrs:ca};
   if(renomear) bodyChar.nome=novoNome;
   await sb(`characters?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&nome=eq.${encodeURIComponent(nome)}`,
     {method:'PATCH',body:JSON.stringify(bodyChar)});
   if(renomear){
     // Atualizar campo personagem para compat com registros antigos
     await sb(`skills?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&personagem=eq.${encodeURIComponent(nome)}`,
       {method:'PATCH',body:JSON.stringify({personagem:novoNome})});
     // Migrar character_id em skills que ainda não o possuem
     const _cIdRename = RPG_DATA!.characters.find(x => x.nome === nome)?.id;
     if (_cIdRename) {
       await sb(`skills?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&personagem=eq.${encodeURIComponent(nome)}&character_id=is.null`,
         {method:'PATCH',body:JSON.stringify({character_id:_cIdRename})}).catch(()=>{});
     }
     RPG_DATA!.skills.forEach(s=>{if(s.personagem===nome){s.personagem=novoNome;if(_cIdRename&&!s.character_id)s.character_id=_cIdRename;}});
     try{
       await sb(`rpg_members?rpg_id=eq.${encodeURIComponent(RPG_DATA!.rpgId)}&linked=eq.${encodeURIComponent(nome)}`,
         {method:'PATCH',body:JSON.stringify({linked:novoNome})});
     }catch(e2){}
     c.nome=novoNome;
     if(CHAR_VIEW===nome) CHAR_VIEW=novoNome;
     if(ATTR_VIEW===nome) ATTR_VIEW=novoNome;
     if(FICHAS_VIEW===nome) FICHAS_VIEW=novoNome;
     if(CFG_CHAR===nome) CFG_CHAR=novoNome;
     if(RPG_DATA!.linked===nome) RPG_DATA!.linked=novoNome;
     renderCharButtons(); if(typeof renderFichasBtns==='function') renderFichasBtns(); renderAttrButtons(); renderConfig(); renderHeader();
   }
   mostrarToast('Personagem salvo!','sucesso');
   if(typeof renderFichaView==='function') renderFichaView(nomeAlvo); else { renderCharView(nomeAlvo); renderAttrView(nomeAlvo); }
 }catch(e){mostrarToast('Erro ao salvar personagem','erro');}
}



// ── NOVO PERSONAGEM — (movido de characters/skills.js) ──────────
// ── 14B: NOVO PERSONAGEM ──────────────────────────────────────
function abrirModalNovoChar() {
  document.getElementById('nc-nome')!.value = '';
  document.getElementById('nc-tipo')!.value = 'jogador';
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  document.getElementById('nc-nivel')!.value = (1) as any;
  document.getElementById('nc-hp')!.value = hp_base;
  document.getElementById('nc-classe')!.value = '';
  document.getElementById('nc-raca')!.value = '';
  document.getElementById('nc-cor')!.value = '#4fa3d1';
  const overlay = document.getElementById('modal-novo-char-overlay');
  overlay!.style!.display = 'flex';
  overlay!.onclick = e => { if (e.target === overlay) fecharModalNovoChar(); };
}
function fecharModalNovoChar() {
  document.getElementById('modal-novo-char-overlay')!.style!.display = 'none';
}
async function criarNovoPersonagem() {
  const nome = document.getElementById('nc-nome')!.value!.trim!()!;
  if (!nome) { mostrarToast('Nome obrigatório', 'erro'); return; }
  if (RPG_DATA!.characters.find(c => c.nome === nome)) { mostrarToast('Já existe um personagem com esse nome', 'erro'); return; }
  const tipo = document.getElementById('nc-tipo')!.value!;
  const nivel = parseInt(document.getElementById('nc-nivel')?.value!)||1;
  const lc=(CURRENT_RPG?.theme?.level_config)||{};
  const hp_base=lc.hp_base||100;
  const hp_por_nivel=lc.hp_por_nivel||0;
  const hp_max=hp_base+(nivel-1)*hp_por_nivel;
  const hp_max_override=+(document.getElementById('nc-hp')!.value!)!||hp_max;
  const cor = document.getElementById('nc-cor')!.value! || '#4fa3d1';
  const classe = document.getElementById('nc-classe')!.value!.trim!()!;
  const raca = document.getElementById('nc-raca')!.value!.trim!()!;
  const ca: any = { tipo, cor, nivel, hp_max:hp_max_override, xp:0, pontos_attr:0 };
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
        rpg_id: RPG_DATA!.rpgId, nome, hp_atual: hp_max_override, custom_attrs: ca,
        nivel: nivel, hp_max: hp_max_override, xp: 0, pontos_attr: 0
      })
    });
    RPG_DATA!.characters.push(novo || { nome, hp_atual: hp_max_override, custom_attrs: ca });
    fecharModalNovoChar();
    renderCharButtons();
    renderAttrButtons();
    renderConfig();
    mostrarToast(`${nome} criado!`, 'sucesso');
  } catch(e) { mostrarToast('Erro ao criar personagem', 'erro'); }
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalLevelUp", { configurable: true, get: () => abrirModalLevelUp, set: (__v) => { abrirModalLevelUp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "executarLevelUp", { configurable: true, get: () => executarLevelUp, set: (__v) => { executarLevelUp = __v; } });
Object.defineProperty(globalThis, "_xpModalNome", { configurable: true, get: () => _xpModalNome, set: (__v) => { _xpModalNome = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalXP", { configurable: true, get: () => abrirModalXP, set: (__v) => { abrirModalXP = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalXP", { configurable: true, get: () => fecharModalXP, set: (__v) => { fecharModalXP = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpAtualizarModalUI", { configurable: true, get: () => xpAtualizarModalUI, set: (__v) => { xpAtualizarModalUI = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpDarRapido", { configurable: true, get: () => xpDarRapido, set: (__v) => { xpDarRapido = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpDarParaTodos", { configurable: true, get: () => xpDarParaTodos, set: (__v) => { xpDarParaTodos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpConfirmarTodos", { configurable: true, get: () => xpConfirmarTodos, set: (__v) => { xpConfirmarTodos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpSalvarManual", { configurable: true, get: () => xpSalvarManual, set: (__v) => { xpSalvarManual = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpExecutarLevelUp", { configurable: true, get: () => xpExecutarLevelUp, set: (__v) => { xpExecutarLevelUp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpForcarLevelUp", { configurable: true, get: () => xpForcarLevelUp, set: (__v) => { xpForcarLevelUp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_xpParaNivel", { configurable: true, get: () => _xpParaNivel, set: (__v) => { _xpParaNivel = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpChecarAutoLevelUp", { configurable: true, get: () => xpChecarAutoLevelUp, set: (__v) => { xpChecarAutoLevelUp = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "xpSalvarChar", { configurable: true, get: () => xpSalvarChar, set: (__v) => { xpSalvarChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "distribuirPontosAttr", { configurable: true, get: () => distribuirPontosAttr, set: (__v) => { distribuirPontosAttr = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderAttrButtons", { configurable: true, get: () => renderAttrButtons, set: (__v) => { renderAttrButtons = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "renderAttrView", { configurable: true, get: () => renderAttrView, set: (__v) => { renderAttrView = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleEdit", { configurable: true, get: () => toggleEdit, set: (__v) => { toggleEdit = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "toggleEditChar", { configurable: true, get: () => toggleEditChar, set: (__v) => { toggleEditChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "attrviewToggleOcultarAtribs", { configurable: true, get: () => attrviewToggleOcultarAtribs, set: (__v) => { attrviewToggleOcultarAtribs = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "charviewToggleOcultarAtribs", { configurable: true, get: () => charviewToggleOcultarAtribs, set: (__v) => { charviewToggleOcultarAtribs = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarAtributos", { configurable: true, get: () => salvarAtributos, set: (__v) => { salvarAtributos = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "salvarInfoPersonagem", { configurable: true, get: () => salvarInfoPersonagem, set: (__v) => { salvarInfoPersonagem = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "abrirModalNovoChar", { configurable: true, get: () => abrirModalNovoChar, set: (__v) => { abrirModalNovoChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "fecharModalNovoChar", { configurable: true, get: () => fecharModalNovoChar, set: (__v) => { fecharModalNovoChar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "criarNovoPersonagem", { configurable: true, get: () => criarNovoPersonagem, set: (__v) => { criarNovoPersonagem = __v; } });
