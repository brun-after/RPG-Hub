// js/systems/rest.js
// RPG Hub — Vol II v2.1
// Descanso Curto: recupera HP parcial + reseta cooldowns de recarga curta
// Descanso Longo: recupera tudo

async function descansoExecutar(tipo, nomePersonagem) {
  const c = (RPG_DATA?.characters||[]).find(x => x.nome === nomePersonagem);
  if (!c) return;

  const ca      = c.custom_attrs || {};
  const hpMax   = ca.hp_max || 100;
  const cfg     = RPG_DATA?.config || {};
  const pctCurto = cfg.descanso_curto_pct ?? 0.5;

  if (tipo === 'curto') {
    const recuperar = Math.floor(hpMax * pctCurto);
    c.hp_atual = Math.min(hpMax, (c.hp_atual || 0) + recuperar);

    // Resetar cooldowns marcados como descanso_curto
    const bid = typeof BATALHA_ATUAL_ID !== 'undefined' ? BATALHA_ATUAL_ID : null;
    const bs  = bid && typeof MAPA_STATE !== 'undefined' ? MAPA_STATE.batalhas[bid] : null;
    if (bs?.cooldowns) {
      const skills = (RPG_DATA?.skills||[]).filter(s => s.personagem === nomePersonagem);
      skills.forEach(sk => {
        if (sk.tipo_recarga === 'descanso_curto' && bs.cooldowns[sk.id]) {
          delete bs.cooldowns[sk.id];
        }
      });
    }

    mostrarToast(nomePersonagem + ' descansou brevemente. +' + recuperar + ' HP', 'sucesso');

  } else {
    // Descanso longo: recuperar tudo
    c.hp_atual = hpMax;

    // Resetar TODOS os cooldowns
    const bid = typeof BATALHA_ATUAL_ID !== 'undefined' ? BATALHA_ATUAL_ID : null;
    const bs  = bid && typeof MAPA_STATE !== 'undefined' ? MAPA_STATE.batalhas[bid] : null;
    if (bs?.cooldowns) bs.cooldowns = {};

    // Resetar atributos de recurso ao máximo
    const atribs = ca.atributos || {};
    (RPG_DATA?.attrDefs || []).forEach(def => {
      let cfg2: any = {};
      try { cfg2 = JSON.parse(def.opcoes || '{}'); } catch(e) {}
      if (cfg2.e_recurso && (cfg2 as any).max_attr) {
        atribs[def.nome] = parseFloat(atribs[cfg2.max_attr] || 0);
      }
    });
    ca.atributos = atribs;

    // Limpar estado moribundo/estabilizado
    if (ca.moribundo || ca.estabilizado) {
      ca.moribundo    = false;
      ca.estabilizado = false;
      delete ca.salvaguardas;
      c.hp_atual = hpMax;
    }

    mostrarToast(nomePersonagem + ' descansou completamente.', 'sucesso');
  }

  await sb(
    'characters?rpg_id=eq.' + encodeURIComponent(RPG_DATA.rpgId) +
    '&nome=eq.' + encodeURIComponent(nomePersonagem),
    { method: 'PATCH', body: JSON.stringify({ hp_atual: c.hp_atual, custom_attrs: ca }) }
  );

  // Atualizar UI localmente
  if (typeof renderCharView === 'function') renderCharView(nomePersonagem);
  if (typeof renderAttrView === 'function') renderAttrView(nomePersonagem);
  if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
}

async function descansoGrupo(tipo) {
  const pcs = (RPG_DATA?.characters||[]).filter(c =>
    c.custom_attrs?.tipo_personagem !== 'npc' &&
    c.custom_attrs?.tipo !== 'npc' &&
    !c.custom_attrs?.morto
  );

  for (const c of pcs) await descansoExecutar(tipo, c.nome);

  if (typeof chatEnviarNarrador === 'function') {
    chatEnviarNarrador(tipo === 'longo'
      ? 'O grupo descansa a noite toda e acorda recuperado.'
      : 'O grupo para brevemente para recuperar o fôlego.'
    );
  }

  // Re-renderizar tokens no mapa
  const mapId = typeof MAPA_STATE !== 'undefined' ? MAPA_STATE.mapaAtualId : null;
  if (mapId) {
    const entry = (RPG_DATA?.mapas||[]).find(l => l.mapa.map_id === mapId);
    if (entry && typeof mapaRenderTokens === 'function') mapaRenderTokens(entry.mapa);
  }
}

/* [migração-esm] accessors globais */
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "descansoExecutar", { configurable: true, get: () => descansoExecutar, set: (__v) => { descansoExecutar = __v; } });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "descansoGrupo", { configurable: true, get: () => descansoGrupo, set: (__v) => { descansoGrupo = __v; } });
