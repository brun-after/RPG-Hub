// js/systems/avt-inventario.js
// Sistema de inventário independente para o modo aventura.
// Sem fluxo de aprovação, sem dependência do módulo VTT (inventory.js / INV).

// ─── ESTADO ──────────────────────────────────────────────────────────────────

const AVT_INV = {
  rpgId:       null,
  catalogo:    [],   // item_catalog rows desta aventura
  inventarios: {},   // charId → inventario rows[]
};

const _AVT_SLOTS = {
  arma_principal:  { label: 'Arma',    icon: '⚔' },
  arma_secundaria: { label: 'Escudo',  icon: '🗡' },
  cabeca:          { label: 'Cabeça',  icon: '🪖' },
  corpo:           { label: 'Corpo',   icon: '🥋' },
  maos:            { label: 'Mãos',    icon: '🧤' },
  pernas:          { label: 'Pernas',  icon: '👖' },
  pes:             { label: 'Pés',     icon: '👢' },
  anel:            { label: 'Anel',    icon: '💍' },
  amuleto:         { label: 'Amuleto', icon: '📿' },
  capa:            { label: 'Capa',    icon: '🧣' },
};

const _AVT_RAR_COR = {
  comum:    '#888',
  incomum:  '#2ecc71',
  raro:     '#3498db',
  epico:    '#9b59b6',
  lendario: '#f39c12',
};

// Ícone do item: imagem (img_url) se houver, senão emoji. `px` controla o tamanho.
function _avtInvIco(def, px) {
  px = px || 18;
  if (def && def.img_url) {
    return `<span style="display:inline-block;width:${px}px;height:${px}px;flex-shrink:0;border-radius:4px;vertical-align:middle;background:#0a0f18 center/cover no-repeat;background-image:url('${String(def.img_url).replace(/'/g,'%27')}')"></span>`;
  }
  return `<span style="font-size:${Math.round(px*0.9)}px;flex-shrink:0">${(def && def.icone) || '📦'}</span>`;
}

// ─── INIT & RESET ─────────────────────────────────────────────────────────────

async function avtInvInit(rpgId) {
  AVT_INV.rpgId       = rpgId;
  AVT_INV.catalogo    = [];
  AVT_INV.inventarios = {};
  try {
    const e = encodeURIComponent(rpgId);
    const [catalogo, inventario] = await Promise.all([
      sb(`item_catalog?rpg_id=eq.${e}&select=id,nome,tipo,icone,raridade,descricao,slot_padrao,atributos_bonus,efeitos,visual_config,img_url&order=nome`).catch(() => []),
      sb(`inventario?rpg_id=eq.${e}&select=*&order=id`).catch(() => []),
    ]);
    AVT_INV.catalogo = catalogo || [];
    (inventario || []).forEach(row => {
      if (!AVT_INV.inventarios[row.character_id]) AVT_INV.inventarios[row.character_id] = [];
      AVT_INV.inventarios[row.character_id].push(row);
    });
  } catch (e) {
    try { console.warn('[AVT_INV] init error:', e); } catch (_) {}
  }
}

function avtInvReset() {
  AVT_INV.rpgId       = null;
  AVT_INV.catalogo    = [];
  AVT_INV.inventarios = {};
}

async function avtInvCarregarChar(charId) {
  if (!charId || !AVT_INV.rpgId) return;
  try {
    const rows = await sb(
      `inventario?character_id=eq.${encodeURIComponent(charId)}&rpg_id=eq.${encodeURIComponent(AVT_INV.rpgId)}&select=*&order=id`
    ).catch(() => []);
    AVT_INV.inventarios[charId] = rows || [];
  } catch (_) {}
}

// [4.6] Invalida o cache de inventário deste personagem nos demais clientes.
// O banco é a fonte da verdade; o evento apenas dispara o reload + re-render remoto.
// `extra` pode trazer campos diretos (ex.: { ouro }) aplicados sem releitura de tabela.
function avtInvBroadcastUpdate(charId, extra) {
  if (!charId) return;
  try {
    if (typeof window._avtBroadcast === 'function') {
      window._avtBroadcast('avt_inv_update', Object.assign({ charId: String(charId) }, extra || {}));
    }
  } catch (_) {}
}
window.avtInvBroadcastUpdate = avtInvBroadcastUpdate;

// ─── ITEM CRUD ────────────────────────────────────────────────────────────────

async function avtInvDarItem(charId, itemId, qty) {
  if (!charId || !itemId || !AVT_INV.rpgId) return null;
  const q = Math.max(1, parseInt(qty) || 1);
  try {
    const row = await sb('inventario', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body:    JSON.stringify({
        rpg_id:          AVT_INV.rpgId,
        character_id:    charId,
        item_catalog_id: itemId,
        quantidade:      q,
        equipado:        false,
        slot_equipado:   null,
        bonus_snapshot:  null,
      }),
    });
    const newRow = Array.isArray(row) ? row[0] : row;
    if (newRow) {
      if (!AVT_INV.inventarios[charId]) AVT_INV.inventarios[charId] = [];
      AVT_INV.inventarios[charId].push(newRow);
      avtInvBroadcastUpdate(charId);
    }
    return newRow || null;
  } catch (e) {
    try { console.warn('[AVT_INV] dar item error:', e); } catch (_) {}
    return null;
  }
}

async function avtInvRemoverItem(invId, charId) {
  try {
    await sb(`inventario?id=eq.${encodeURIComponent(invId)}`, { method: 'DELETE' });
    if (charId && AVT_INV.inventarios[charId]) {
      AVT_INV.inventarios[charId] = AVT_INV.inventarios[charId].filter(i => String(i.id) !== String(invId));
      avtInvBroadcastUpdate(charId);
    } else {
      Object.keys(AVT_INV.inventarios).forEach(cid => {
        AVT_INV.inventarios[cid] = AVT_INV.inventarios[cid].filter(i => String(i.id) !== String(invId));
      });
      if (charId) avtInvBroadcastUpdate(charId);
    }
  } catch (e) {
    try { console.warn('[AVT_INV] remover item error:', e); } catch (_) {}
    throw e;
  }
}

// ─── EQUIP / DESEQUIP ─────────────────────────────────────────────────────────

let _avtInvEquipando = false;

async function avtInvEquipar(charNome, invId) {
  if (_avtInvEquipando) return;
  _avtInvEquipando = true;
  try {
    const char = (typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : []).find(c => c.nome === charNome);
    if (!char?.id) return;

    const charInv = AVT_INV.inventarios[char.id] || [];
    const invItem = charInv.find(i => String(i.id) === String(invId));
    if (!invItem) return;

    const def = AVT_INV.catalogo.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
    if (!def || def.tipo !== 'equipamento') {
      mostrarToast('Este item não pode ser equipado', 'aviso');
      return;
    }

    if (invItem.equipado) {
      await _avtInvDoDesequipar(char, invItem, def);
    } else {
      const slotDef = def.slot_padrao || def.slot;
      const slotOcupado = charInv.find(i => i.equipado && i.slot_equipado === slotDef && String(i.id) !== String(invId));
      if (slotOcupado) {
        const defAnt = AVT_INV.catalogo.find(d => d.id === (slotOcupado.item_catalog_id || slotOcupado.item_def_id));
        await _avtInvDoDesequipar(char, slotOcupado, defAnt);
      }
      await _avtInvDoEquipar(char, invItem, def);
    }

    if (typeof avtJogadorPainelRender === 'function') avtJogadorPainelRender();
    const modal = document.getElementById('avt-inventario-modal');
    if (modal && modal.style.display !== 'none') avtInvRenderPanel(charNome, 'avt-inv-body');
  } finally {
    _avtInvEquipando = false;
  }
}

async function _avtInvDoEquipar(char, invItem, def) {
  const ca = char.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};

  const bonus   = def.atributos_bonus || def.bonus_attrs || {};
  const slotDef = def.slot_padrao || def.slot;
  const snapshot = {};

  Object.entries(bonus).forEach(([attr, val]) => {
    const atual = parseFloat(ca.atributos[attr]) || 0;
    let delta;
    if (typeof val === 'object' && val.modo === 'pct') {
      delta = Math.round(atual * Math.abs(val.valor) / 100) * Math.sign(val.valor);
    } else {
      delta = typeof val === 'object' ? val.valor : parseFloat(val) || 0;
    }
    snapshot[attr]      = delta;
    ca.atributos[attr]  = atual + delta;
  });

  invItem.equipado       = true;
  invItem.slot_equipado  = slotDef;
  invItem.bonus_snapshot = snapshot;
  char.custom_attrs      = ca;

  // Update animated renderer if applicable
  const animJson = def.visual_config?.animacao_json;
  if (animJson && ca.aparencia?.modo === 'animado') {
    const ctrl = window._animCtrlMap?.[char.nome];
    if (ctrl && typeof animRendererUpdateEquipment === 'function') {
      animRendererUpdateEquipment(ctrl, slotDef, animJson);
    }
    if (!ca.aparencia.animado) ca.aparencia.animado = {};
    if (!ca.aparencia.animado.equipment_slots) ca.aparencia.animado.equipment_slots = {};
    ca.aparencia.animado.equipment_slots[slotDef] = animJson;
  }

  try {
    await Promise.all([
      sb(`inventario?id=eq.${encodeURIComponent(invItem.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipado: true, slot_equipado: slotDef, bonus_snapshot: snapshot }),
      }),
      sb(`characters?id=eq.${encodeURIComponent(char.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_attrs: ca }),
      }),
    ]);
    const bonusEntries = Object.entries(bonus);
    const diffStr = bonusEntries.length
      ? ' · ' + bonusEntries.map(([attr, val]) => {
          const v = typeof val === 'object'
            ? (val.valor >= 0 ? '+' : '') + val.valor + (val.modo === 'pct' ? '%' : '')
            : (val >= 0 ? '+' : '') + val;
          return attr + ' ' + v;
        }).join(' · ')
      : '';
    mostrarToast(`⚔ ${def.nome} equipado!${diffStr}`, 'sucesso');
  } catch (_) {
    mostrarToast('Erro ao equipar', 'erro');
  }
}

async function _avtInvDoDesequipar(char, invItem, def) {
  const ca = char.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};

  const snapshot = invItem.bonus_snapshot;
  if (snapshot && Object.keys(snapshot).length) {
    Object.entries(snapshot).forEach(([attr, delta]) => {
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - delta;
    });
  } else if (def) {
    const bonus = def.atributos_bonus || def.bonus_attrs || {};
    Object.entries(bonus).forEach(([attr, val]) => {
      const n = typeof val === 'object' ? val.valor : parseFloat(val) || 0;
      ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) - n;
    });
  }

  const slotDef = invItem.slot_equipado || def?.slot_padrao || def?.slot;
  invItem.equipado       = false;
  invItem.slot_equipado  = null;
  invItem.bonus_snapshot = null;
  char.custom_attrs      = ca;

  // Clear animated renderer slot
  if (slotDef && ca.aparencia?.modo === 'animado') {
    const ctrl = window._animCtrlMap?.[char.nome];
    if (ctrl && typeof animRendererUpdateEquipment === 'function') {
      animRendererUpdateEquipment(ctrl, slotDef, null);
    }
    if (ca.aparencia?.animado?.equipment_slots) {
      ca.aparencia.animado.equipment_slots[slotDef] = null;
    }
  }

  try {
    await Promise.all([
      sb(`inventario?id=eq.${encodeURIComponent(invItem.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipado: false, slot_equipado: null, bonus_snapshot: null }),
      }),
      sb(`characters?id=eq.${encodeURIComponent(char.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_attrs: ca }),
      }),
    ]);
    mostrarToast(`${def?.nome || 'Item'} desequipado`, 'ok');
  } catch (_) {
    mostrarToast('Erro ao desequipar', 'erro');
  }
}

// ─── USO DE CONSUMÍVEL (sem aprovação) ────────────────────────────────────────

async function avtInvUsarConsumivel(charNome, invId) {
  const char = (typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : []).find(c => c.nome === charNome);
  if (!char?.id) return mostrarToast('Personagem não encontrado', 'erro');

  const charInv = AVT_INV.inventarios[char.id] || [];
  const invItem = charInv.find(i => String(i.id) === String(invId));
  if (!invItem) return mostrarToast('Item não encontrado', 'erro');

  const def = AVT_INV.catalogo.find(d => d.id === (invItem.item_catalog_id || invItem.item_def_id));
  if (!def) return mostrarToast('Definição do item não encontrada', 'erro');

  if (def.tipo === 'equipamento') {
    await avtInvEquipar(charNome, invId);
    return;
  }

  if (def.tipo !== 'consumivel') {
    mostrarToast('Este item não pode ser usado', 'aviso');
    return;
  }

  await avtInvAplicarEfeitos(def.efeitos || [], charNome);

  const novaQtd = (invItem.quantidade || 1) - 1;
  invItem.quantidade = novaQtd;

  if (novaQtd <= 0) {
    try {
      await sb(`inventario?id=eq.${encodeURIComponent(invItem.id)}`, { method: 'DELETE' });
      AVT_INV.inventarios[char.id] = charInv.filter(i => String(i.id) !== String(invItem.id));
    } catch (_) {}
  } else {
    try {
      await sb(`inventario?id=eq.${encodeURIComponent(invItem.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: novaQtd }),
      });
    } catch (_) {}
  }

  avtInvBroadcastUpdate(char.id);
  if (typeof avtJogadorPainelRender === 'function') avtJogadorPainelRender();
  const modal = document.getElementById('avt-inventario-modal');
  if (modal && modal.style.display !== 'none') avtInvRenderPanel(charNome, 'avt-inv-body');
}

async function avtInvAplicarEfeitos(efeitos, charNome) {
  if (!Array.isArray(efeitos) || !efeitos.length) return;
  const chars = typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : [];
  const char  = chars.find(c => c.nome === charNome);
  if (!char) return;

  const ca   = char.custom_attrs || {};
  if (!ca.atributos) ca.atributos = {};
  if (!ca.buffs) ca.buffs = [];

  const ent    = (typeof AVT_STATE !== 'undefined' ? (AVT_STATE.entidades || []) : []).find(e => e.nome === charNome);
  const hpMax  = ent?.hpMax || char.hp_max || 100;

  const msgs       = [];
  let charModified = false;
  let hpModified   = false;

  for (const ef of efeitos) {
    switch (ef.tipo) {

      case 'hp': {
        const valor = parseFloat(ef.valor) || 0;
        if (valor > 0) {
          const antes  = ent ? ent.hp : (char.hp_atual || 0);
          const depois = Math.min(hpMax, antes + valor);
          const cura   = depois - antes;
          if (ent) ent.hp = depois;
          char.hp_atual = depois;
          if (cura > 0) {
            msgs.push(`❤ +${Math.round(cura)} HP`);
            hpModified = true;
            if (ent && typeof _avtMostrarCuraAcimaDaHead === 'function') _avtMostrarCuraAcimaDaHead(ent, Math.round(cura));
          }
        } else if (valor < 0) {
          const dano   = Math.abs(valor);
          const antes  = ent ? ent.hp : (char.hp_atual || 0);
          const depois = Math.max(0, antes - dano);
          if (ent) ent.hp = depois;
          char.hp_atual = depois;
          msgs.push(`💔 -${Math.round(dano)} HP`);
          hpModified = true;
        }
        break;
      }

      case 'dano': {
        const dano   = parseFloat(ef.valor) || 0;
        const antes  = ent ? ent.hp : (char.hp_atual || 0);
        const depois = Math.max(0, antes - dano);
        if (ent) ent.hp = depois;
        char.hp_atual = depois;
        msgs.push(`💔 -${Math.round(dano)} HP`);
        hpModified = true;
        break;
      }

      case 'recurso': {
        const recurso = ef.recurso;
        const valor   = parseFloat(ef.valor) || 0;
        if (recurso) {
          const atual   = parseFloat(ca.atributos[recurso]) || 0;
          const maxAttr = recurso + 'Max';
          const maxVal  = parseFloat(ca.atributos[maxAttr]);
          ca.atributos[recurso] = isNaN(maxVal)
            ? Math.max(0, atual + valor)
            : Math.min(maxVal, Math.max(0, atual + valor));
          msgs.push(`${valor >= 0 ? '✨ +' : ''}${valor} ${recurso}`);
          charModified = true;
        }
        break;
      }

      case 'atributo': {
        const attr   = ef.attr;
        const valor  = parseFloat(ef.valor) || 0;
        const dur    = ef.duracao_turnos || 0;
        if (attr) {
          ca.atributos[attr] = (parseFloat(ca.atributos[attr]) || 0) + valor;
          if (dur > 0) {
            ca.buffs.push({ tipo: 'buff', nome: `${attr} ${valor >= 0 ? '+' : ''}${valor}`, attr, valor, turnos_restantes: dur });
            msgs.push(`⬆ ${attr} ${valor >= 0 ? '+' : ''}${valor} (${dur}t)`);
          } else {
            msgs.push(`⬆ ${attr} ${valor >= 0 ? '+' : ''}${valor}`);
          }
          charModified = true;
        }
        break;
      }

      case 'remover_debuff': {
        const nome  = ef.debuff;
        if (nome) {
          const antes = ca.buffs.length;
          ca.buffs    = ca.buffs.filter(b => b.nome !== nome);
          if (ca.buffs.length < antes) msgs.push(`🧹 ${nome} removido`);
          charModified = true;
        }
        break;
      }

      case 'debuff': {
        const nome = ef.debuff || ef.nome;
        const dur  = ef.duracao_turnos || 3;
        if (nome) {
          ca.buffs.push({ tipo: 'debuff', nome, turnos_restantes: dur, negativo: true });
          msgs.push(`☠ ${nome} (${dur}t)`);
          charModified = true;
        }
        break;
      }

      case 'buff': {
        const nome = ef.nome || ef.buff;
        const dur  = ef.duracao_turnos || 3;
        if (nome) {
          ca.buffs.push({ tipo: 'buff', nome, turnos_restantes: dur });
          msgs.push(`✨ ${nome} (${dur}t)`);
          charModified = true;
        }
        break;
      }

      case 'dot': {
        const nome = ef.nome || 'DoT';
        const dur  = ef.duracao_turnos || 3;
        ca.buffs.push({ tipo: 'dot', nome, formula: ef.dot_formula, turnos_restantes: dur, negativo: true });
        msgs.push(`🩸 ${nome} (${dur}t)`);
        charModified = true;
        break;
      }

      case 'invocar': {
        const invocacaoId = ef.invocacao_id;
        if (invocacaoId) {
          if (!Array.isArray(ca.invocacoes)) ca.invocacoes = [];
          if (!ca.invocacoes.some(i => i.invocacao_id === invocacaoId)) {
            ca.invocacoes.push({ invocacao_id: invocacaoId, origem: 'item' });
            msgs.push('🔮 Invocação concedida');
          }
          charModified = true;
        }
        break;
      }
    }
  }

  char.custom_attrs = ca;

  if (hpModified || charModified) {
    try {
      const patch = {};
      if (hpModified)   patch.hp_atual     = char.hp_atual;
      if (charModified) patch.custom_attrs = ca;
      await sb(`characters?id=eq.${encodeURIComponent(char.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch (_) {}

    if (hpModified) {
      if (ent && typeof _avtPersistirHpChar === 'function') _avtPersistirHpChar(ent);
      if (typeof _avtRenderHpBar === 'function') _avtRenderHpBar();
    }
  }

  if (msgs.length) mostrarToast(msgs.join(' · '), 'sucesso');
}

// ─── OURO ─────────────────────────────────────────────────────────────────────

async function avtInvDarOuro(charNome, qty) {
  if (!charNome || !qty) return;
  const char = (typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : []).find(c => c.nome === charNome);
  if (!char) return;
  if (!char.custom_attrs) char.custom_attrs = {};
  char.custom_attrs.ouro = (char.custom_attrs.ouro || 0) + Math.abs(qty);
  try {
    await sb(`characters?id=eq.${encodeURIComponent(char.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_attrs: char.custom_attrs }),
    });
  } catch (_) {}
  avtInvBroadcastUpdate(char.id, { ouro: char.custom_attrs.ouro });
}

async function avtInvRemoverOuro(charNome, qty) {
  if (!charNome || !qty) return;
  const char = (typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : []).find(c => c.nome === charNome);
  if (!char) return;
  if (!char.custom_attrs) char.custom_attrs = {};
  char.custom_attrs.ouro = Math.max(0, (char.custom_attrs.ouro || 0) - Math.abs(qty));
  try {
    await sb(`characters?id=eq.${encodeURIComponent(char.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_attrs: char.custom_attrs }),
    });
  } catch (_) {}
  avtInvBroadcastUpdate(char.id, { ouro: char.custom_attrs.ouro });
}

// ─── RENDERIZAÇÃO ─────────────────────────────────────────────────────────────

async function avtAbrirInventario() {
  const jogador = typeof _avtMeuJogador === 'function' ? _avtMeuJogador() : null;
  if (!jogador) return mostrarToast('Nenhum personagem vinculado', 'aviso');
  const char = (typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : []).find(c => c.nome === jogador.nome);
  if (!char?.id) return;

  if (!AVT_INV.inventarios[char.id]) await avtInvCarregarChar(char.id);

  const modal = document.getElementById('avt-inventario-modal');
  if (modal) {
    modal.style.display = 'flex';
    avtInvRenderPanel(jogador.nome, 'avt-inv-body');
  }
}

function avtFecharInventario() {
  const modal = document.getElementById('avt-inventario-modal');
  if (modal) modal.style.display = 'none';
}

function avtInvRenderPanel(charNome, containerId) {
  const el = document.getElementById(containerId || 'avt-inv-body');
  if (!el) return;
  const chars = typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : [];
  const char  = chars.find(c => c.nome === charNome);
  if (!char?.id) {
    el.innerHTML = '<p style="color:#7a92aa;font-family:var(--fonte-d);font-size:0.75rem">Personagem não encontrado.</p>';
    return;
  }

  const inv      = AVT_INV.inventarios[char.id] || [];
  const ouro     = char.custom_attrs?.ouro || 0;
  const nomeSafe = charNome.replace(/'/g, "\\'");

  // ── Ouro ──
  let html = `
  <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(200,168,75,0.07);border:1px solid rgba(200,168,75,0.18);border-radius:8px;margin-bottom:12px">
    <span style="font-size:1.2rem">💰</span>
    <span style="font-family:var(--fonte-d);font-size:0.92rem;color:#c8a84b;font-weight:700">${ouro}</span>
    <span style="font-family:var(--fonte-d);font-size:0.65rem;color:#7a92aa">ouro</span>
  </div>`;

  // ── Slots de equipamento ──
  const equipped = inv.filter(i => i.equipado && i.slot_equipado);
  html += `
  <div style="margin-bottom:14px">
    <div style="font-family:var(--fonte-d);font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">⚔ Equipado</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">`;

  for (const [slot, slotInfo] of Object.entries(_AVT_SLOTS)) {
    const equippedItem = equipped.find(i => i.slot_equipado === slot);
    const def          = equippedItem ? AVT_INV.catalogo.find(d => d.id === (equippedItem.item_catalog_id || equippedItem.item_def_id)) : null;
    const border       = def ? (_AVT_RAR_COR[def.raridade] || '#888') : 'rgba(79,163,209,0.1)';

    if (def && equippedItem) {
      const idSafe = String(equippedItem.id).replace(/'/g, "\\'");
      html += `
      <div onclick="avtInvEquipar('${nomeSafe}','${idSafe}')"
        title="${def.nome} — ${slotInfo.label}. Clique para desequipar."
        style="padding:5px 4px;background:rgba(79,163,209,0.06);border:1px solid ${border};border-radius:5px;cursor:pointer;text-align:center;min-width:0">
        <div style="font-size:0.5rem;color:#7a92aa;margin-bottom:2px">${slotInfo.icon} ${slotInfo.label}</div>
        <div style="font-size:0.6rem;color:#c8d8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${def.nome}">${_avtInvIco(def,14)} ${def.nome}</div>
      </div>`;
    } else {
      html += `
      <div style="padding:5px 4px;background:rgba(79,163,209,0.02);border:1px solid ${border};border-radius:5px;text-align:center;min-width:0">
        <div style="font-size:0.5rem;color:#7a92aa;margin-bottom:2px">${slotInfo.icon} ${slotInfo.label}</div>
        <div style="font-size:0.55rem;color:#2a3344">—</div>
      </div>`;
    }
  }
  html += `</div></div>`;

  // ── Mochila ──
  const bagItems = inv.filter(i => !i.equipado || !i.slot_equipado);

  if (!bagItems.length) {
    html += `<div style="font-family:var(--fonte-d);font-size:0.7rem;color:#7a92aa;text-align:center;padding:18px 0;border:1px solid rgba(79,163,209,0.08);border-radius:8px">Mochila vazia</div>`;
  } else {
    html += `<div style="font-family:var(--fonte-d);font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">🎒 Mochila</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:5px">`;

    for (const item of bagItems) {
      const def = AVT_INV.catalogo.find(d => d.id === (item.item_catalog_id || item.item_def_id));
      if (!def) continue;
      const idSafe   = String(item.id).replace(/'/g, "\\'");
      const rarColor = _AVT_RAR_COR[def.raridade] || '#888';

      let actionBtn = '';
      if (def.tipo === 'equipamento') {
        actionBtn = `<button onclick="avtInvEquipar('${nomeSafe}','${idSafe}')"
          style="background:rgba(79,163,209,0.1);border:1px solid rgba(79,163,209,0.25);border-radius:5px;
                 color:#4fa3d1;font-family:var(--fonte-d);font-size:0.58rem;padding:4px 10px;cursor:pointer;flex-shrink:0;white-space:nowrap">⚔ Equipar</button>`;
      } else if (def.tipo === 'consumivel') {
        actionBtn = `<button onclick="avtInvUsarConsumivel('${nomeSafe}','${idSafe}')"
          style="background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.22);border-radius:5px;
                 color:#5ee09a;font-family:var(--fonte-d);font-size:0.58rem;padding:4px 10px;cursor:pointer;flex-shrink:0;white-space:nowrap">✦ Usar</button>`;
      }

      const efLabel   = _avtInvEfLabel(def.efeitos);
      const qtdSuffix = (item.quantidade || 1) > 1 ? ` · ×${item.quantidade}` : '';

      html += `
      <div style="display:flex;align-items:center;gap:8px;border:1px solid rgba(79,163,209,0.1);border-radius:7px;padding:7px 10px;background:rgba(5,8,16,0.3)">
        ${_avtInvIco(def,20)}
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--fonte-d);font-size:0.7rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.nome}</div>
          <div style="font-size:0.58rem;color:${rarColor}">${def.raridade || 'comum'} · ${def.tipo}${efLabel ? ' · ' + efLabel : ''}${qtdSuffix}</div>
          ${def.descricao ? `<div style="font-size:0.57rem;color:#556;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.descricao}</div>` : ''}
        </div>
        ${actionBtn}
      </div>`;
    }

    html += `</div>`;
  }

  el.innerHTML = html;
}

// Render equipment slots summary for the player HUD (replaces section 4b)
function avtInvRenderSlotsHud(char) {
  if (!char?.id) return '';
  const inv      = AVT_INV.inventarios[char.id] || [];
  const equipped = inv.filter(i => i.equipado && i.slot_equipado);
  if (!equipped.length) return '';

  const nomeSafe  = char.nome.replace(/'/g, "\\'");
  const equipOpen = (typeof AVT_STATE !== 'undefined' && AVT_STATE._ppEquipOpen) || false;
  const SLOTS_PP  = { arma_principal: '⚔', arma_secundaria: '🗡', cabeca: '🪖', corpo: '🥋', maos: '🧤', pernas: '👖', pes: '👢', anel: '💍', amuleto: '📿', capa: '🧣' };

  let html = `
  <div style="border:1px solid rgba(79,163,209,0.1);border-radius:8px;overflow:hidden">
    <div onclick="AVT_STATE._ppEquipOpen=!AVT_STATE._ppEquipOpen;avtJogadorPainelRender()"
      style="padding:7px 12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:rgba(79,163,209,0.04)">
      <span style="font-family:var(--fonte-d);font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">⚔ Equipado</span>
      <span style="font-size:0.65rem;color:#7a92aa">${equipOpen ? '▴' : '▾'}</span>
    </div>`;

  if (equipOpen) {
    html += `<div style="padding:8px 10px;display:flex;flex-direction:column;gap:3px">`;
    equipped.forEach(item => {
      const def = AVT_INV.catalogo.find(d => d.id === (item.item_catalog_id || item.item_def_id));
      if (!def) return;
      const slotIcon = SLOTS_PP[item.slot_equipado] || '📦';
      const rarColor = _AVT_RAR_COR[def.raridade] || '#888';
      html += `
      <div style="display:flex;align-items:center;gap:7px;padding:3px 6px">
        <span style="font-size:0.75rem;flex-shrink:0">${slotIcon}</span>
        <span style="font-size:0.62rem;color:#c8d8e8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${def.icone || ''} ${def.nome}</span>
        <span style="font-size:0.55rem;color:${rarColor}">${def.raridade || 'comum'}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// Render quick consumables for the player HUD (replaces section 7)
function avtInvRenderConsumiveisHud(char) {
  if (!char?.id) return '';
  const inv = AVT_INV.inventarios[char.id] || [];
  const consumiveis = inv.filter(i => {
    const def = AVT_INV.catalogo.find(d => d.id === (i.item_catalog_id || i.item_def_id));
    return def?.tipo === 'consumivel' && (i.quantidade || 0) > 0;
  });
  if (!consumiveis.length) return '';

  const nomeSafe = char.nome.replace(/'/g, "\\'");
  let html = `
  <div style="display:flex;flex-direction:column;gap:5px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div style="font-family:var(--fonte-d);font-size:0.62rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.08em">🧪 Consumíveis</div>
      <button onclick="avtAbrirInventario()" style="background:none;border:none;font-family:var(--fonte-d);font-size:0.58rem;color:#4fa3d1;cursor:pointer;padding:0">ver todos</button>
    </div>`;

  consumiveis.slice(0, 3).forEach(item => {
    const def = AVT_INV.catalogo.find(d => d.id === (item.item_catalog_id || item.item_def_id));
    if (!def) return;
    const idSafe  = String(item.id).replace(/'/g, "\\'");
    const efLabel = _avtInvEfLabel(def.efeitos);
    html += `
    <div style="display:flex;align-items:center;gap:8px;border:1px solid rgba(79,163,209,0.1);border-radius:6px;padding:6px 9px">
      <span style="font-size:1.1rem;flex-shrink:0">${def.icone || '📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fonte-d);font-size:0.7rem;color:#c8d8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${def.nome}</div>
        <div style="font-size:0.6rem;color:#7a92aa">${efLabel ? efLabel + ' · ' : ''}×${item.quantidade}</div>
      </div>
      <button onclick="avtInvUsarConsumivel('${nomeSafe}','${idSafe}')"
        style="background:rgba(94,224,154,0.1);border:1px solid rgba(94,224,154,0.22);border-radius:5px;
               color:#5ee09a;font-family:var(--fonte-d);font-size:0.58rem;padding:4px 8px;cursor:pointer;flex-shrink:0">Usar</button>
    </div>`;
  });

  html += `</div>`;
  return html;
}

// Helper: short label for first effect
function _avtInvEfLabel(efeitos) {
  if (!Array.isArray(efeitos) || !efeitos.length) return '';
  const ef = efeitos[0];
  if (!ef) return '';
  if (ef.tipo === 'hp'      && ef.valor > 0)  return `❤ +${ef.valor}`;
  if (ef.tipo === 'recurso' && ef.valor > 0)  return `✨ +${ef.valor} ${ef.recurso || ''}`.trim();
  if (ef.tipo === 'atributo')                  return `⬆ ${ef.attr} +${ef.valor}`;
  if (ef.tipo === 'dano')                      return `💔 ${ef.valor} dano`;
  return '';
}

// ─── RENDER INVENTÁRIO DO MESTRE (para o painel master) ───────────────────────

function avtInvRenderMestreInv(charNome) {
  const chars   = typeof AVT_STATE !== 'undefined' ? AVT_STATE.chars : [];
  const char    = chars.find(c => c.nome === charNome);
  if (!char?.id) return '<div style="font-size:0.62rem;color:#7a92aa">Selecione um personagem.</div>';

  const inv         = AVT_INV.inventarios[char.id] || [];
  const SLOTS_LBL   = { arma_principal:{l:'Arma',i:'⚔'}, arma_secundaria:{l:'Escudo',i:'🗡'}, cabeca:{l:'Cabeça',i:'🪖'}, corpo:{l:'Corpo',i:'🥋'}, maos:{l:'Mãos',i:'🧤'}, pernas:{l:'Pernas',i:'👖'}, pes:{l:'Pés',i:'👢'}, anel:{l:'Anel',i:'💍'}, amuleto:{l:'Amuleto',i:'📿'}, capa:{l:'Capa',i:'🧣'} };
  const nomeSafe    = charNome.replace(/'/g, "\\'");
  const charIdSafe  = String(char.id).replace(/'/g, "\\'");

  if (!inv.length) {
    return `<div class="avt-mp-hint">Inventário vazio.
      <button class="avt-mp-btn" style="padding:2px 8px;font-size:0.65rem;margin-left:6px"
        onclick="avtInvCarregarChar('${charIdSafe}').then(()=>_avtMestrePainelRender())">↺ Recarregar</button>
    </div>`;
  }

  const equipped    = inv.filter(i => i.equipado && i.slot_equipado);
  const unequipped  = inv.filter(i => !i.equipado || !i.slot_equipado);

  let html = '';

  if (equipped.length) {
    html += `<div style="margin-bottom:8px">
      <div style="font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">⚔ Slots Equipados</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
    Object.entries(SLOTS_LBL).forEach(([slot, {l, i}]) => {
      const eq  = equipped.find(e => e.slot_equipado === slot);
      const def = eq ? AVT_INV.catalogo.find(d => d.id === (eq.item_catalog_id || eq.item_def_id)) : null;
      const border = def ? (_AVT_RAR_COR[def.raridade] || '#888') : 'rgba(79,163,209,0.12)';
      if (!def) return;
      html += `<div style="padding:5px 6px;background:rgba(79,163,209,0.06);border:1px solid ${border};border-radius:5px;min-width:0">
        <div style="font-size:0.55rem;color:#7a92aa;margin-bottom:2px">${i} ${l}</div>
        <div style="font-size:0.62rem;color:#c8d8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${def.icone || '📦'} ${def.nome}</div>
        <button onclick="_avtMestreRemoverItemChar('${String(eq.id).replace(/'/g,"\\'")}','${nomeSafe}',true)"
          style="margin-top:2px;width:100%;background:none;border:1px solid rgba(200,168,75,0.15);border-radius:3px;color:#7a92aa;font-size:0.52rem;cursor:pointer;padding:1px 0">↩ Remover</button>
      </div>`;
    });
    html += `</div></div>`;
  }

  if (unequipped.length) {
    html += `<div>
      <div style="font-size:0.6rem;color:#7a92aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">🎒 Mochila</div>`;
    unequipped.forEach(item => {
      const def = AVT_INV.catalogo.find(d => d.id === (item.item_catalog_id || item.item_def_id));
      if (!def) return;
      const idSafe = String(item.id).replace(/'/g, "\\'");
      html += `<div style="display:flex;align-items:center;gap:6px;padding:4px 7px;background:rgba(79,163,209,0.03);border:1px solid rgba(79,163,209,0.08);border-radius:5px;margin-bottom:3px">
        <span style="font-size:0.9rem">${def.icone || '📦'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.68rem;color:#c8d8e8">${def.nome}</div>
          <div style="font-size:0.58rem;color:#7a92aa">${def.tipo}${item.quantidade > 1 ? ` · ×${item.quantidade}` : ''}</div>
        </div>
        <button onclick="_avtMestreRemoverItemChar('${idSafe}','${nomeSafe}',true)"
          style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:0.8rem;padding:0">✕</button>
      </div>`;
    });
    html += `</div>`;
  }

  return html;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

/* [migração-esm] AVT_INV já exposto pelo rodapé */
window.avtInvInit                = avtInvInit;
window.avtInvReset               = avtInvReset;
window.avtInvCarregarChar        = avtInvCarregarChar;
window.avtInvDarItem             = avtInvDarItem;
window.avtInvRemoverItem         = avtInvRemoverItem;
window.avtInvEquipar             = avtInvEquipar;
window.avtInvUsarConsumivel      = avtInvUsarConsumivel;
window.avtInvAplicarEfeitos      = avtInvAplicarEfeitos;
window.avtInvDarOuro             = avtInvDarOuro;
window.avtInvRemoverOuro         = avtInvRemoverOuro;
window.avtAbrirInventario        = avtAbrirInventario;
window.avtFecharInventario       = avtFecharInventario;
window.avtInvRenderPanel         = avtInvRenderPanel;
window.avtInvRenderSlotsHud      = avtInvRenderSlotsHud;
window.avtInvRenderConsumiveisHud = avtInvRenderConsumiveisHud;
window.avtInvRenderMestreInv     = avtInvRenderMestreInv;

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "AVT_INV", { configurable: true, get: () => AVT_INV });
Object.defineProperty(globalThis, "_AVT_SLOTS", { configurable: true, get: () => _AVT_SLOTS });
Object.defineProperty(globalThis, "_AVT_RAR_COR", { configurable: true, get: () => _AVT_RAR_COR });
Object.defineProperty(globalThis, "_avtInvIco", { configurable: true, get: () => _avtInvIco, set: (__v) => { _avtInvIco = __v; } });
Object.defineProperty(globalThis, "avtInvInit", { configurable: true, get: () => avtInvInit, set: (__v) => { avtInvInit = __v; } });
Object.defineProperty(globalThis, "avtInvReset", { configurable: true, get: () => avtInvReset, set: (__v) => { avtInvReset = __v; } });
Object.defineProperty(globalThis, "avtInvCarregarChar", { configurable: true, get: () => avtInvCarregarChar, set: (__v) => { avtInvCarregarChar = __v; } });
Object.defineProperty(globalThis, "avtInvBroadcastUpdate", { configurable: true, get: () => avtInvBroadcastUpdate, set: (__v) => { avtInvBroadcastUpdate = __v; } });
Object.defineProperty(globalThis, "avtInvDarItem", { configurable: true, get: () => avtInvDarItem, set: (__v) => { avtInvDarItem = __v; } });
Object.defineProperty(globalThis, "avtInvRemoverItem", { configurable: true, get: () => avtInvRemoverItem, set: (__v) => { avtInvRemoverItem = __v; } });
Object.defineProperty(globalThis, "_avtInvEquipando", { configurable: true, get: () => _avtInvEquipando, set: (__v) => { _avtInvEquipando = __v; } });
Object.defineProperty(globalThis, "avtInvEquipar", { configurable: true, get: () => avtInvEquipar, set: (__v) => { avtInvEquipar = __v; } });
Object.defineProperty(globalThis, "_avtInvDoEquipar", { configurable: true, get: () => _avtInvDoEquipar, set: (__v) => { _avtInvDoEquipar = __v; } });
Object.defineProperty(globalThis, "_avtInvDoDesequipar", { configurable: true, get: () => _avtInvDoDesequipar, set: (__v) => { _avtInvDoDesequipar = __v; } });
Object.defineProperty(globalThis, "avtInvUsarConsumivel", { configurable: true, get: () => avtInvUsarConsumivel, set: (__v) => { avtInvUsarConsumivel = __v; } });
Object.defineProperty(globalThis, "avtInvAplicarEfeitos", { configurable: true, get: () => avtInvAplicarEfeitos, set: (__v) => { avtInvAplicarEfeitos = __v; } });
Object.defineProperty(globalThis, "avtInvDarOuro", { configurable: true, get: () => avtInvDarOuro, set: (__v) => { avtInvDarOuro = __v; } });
Object.defineProperty(globalThis, "avtInvRemoverOuro", { configurable: true, get: () => avtInvRemoverOuro, set: (__v) => { avtInvRemoverOuro = __v; } });
Object.defineProperty(globalThis, "avtAbrirInventario", { configurable: true, get: () => avtAbrirInventario, set: (__v) => { avtAbrirInventario = __v; } });
Object.defineProperty(globalThis, "avtFecharInventario", { configurable: true, get: () => avtFecharInventario, set: (__v) => { avtFecharInventario = __v; } });
Object.defineProperty(globalThis, "avtInvRenderPanel", { configurable: true, get: () => avtInvRenderPanel, set: (__v) => { avtInvRenderPanel = __v; } });
Object.defineProperty(globalThis, "avtInvRenderSlotsHud", { configurable: true, get: () => avtInvRenderSlotsHud, set: (__v) => { avtInvRenderSlotsHud = __v; } });
Object.defineProperty(globalThis, "avtInvRenderConsumiveisHud", { configurable: true, get: () => avtInvRenderConsumiveisHud, set: (__v) => { avtInvRenderConsumiveisHud = __v; } });
Object.defineProperty(globalThis, "_avtInvEfLabel", { configurable: true, get: () => _avtInvEfLabel, set: (__v) => { _avtInvEfLabel = __v; } });
Object.defineProperty(globalThis, "avtInvRenderMestreInv", { configurable: true, get: () => avtInvRenderMestreInv, set: (__v) => { avtInvRenderMestreInv = __v; } });
