// lib/simdb.js
// Banco de dados em memória que replica o comportamento do Supabase REST API.
// Suporta: GET (com filtros eq/neq/gt/gte/lt/lte), POST, PATCH, DELETE
// Suficiente para rodar a simulação completa sem tocar no banco de produção.

import { randomUUID } from 'crypto';

// ── Store principal ────────────────────────────────────────────
// Map<tableName, Map<rowId, rowData>>
const store = new Map();

// Tabelas conhecidas (criadas vazias no boot)
const TABLES = [
  'rpg_registry', 'rpg_members', 'players',
  'attr_defs', 'characters', 'skills', 'mapas',
  'batalhas', 'criativos', 'lore', 'inventario',
  'item_catalog', 'item_usos', 'moedas', 'loot_pendente',
  'level_up_log', 'tabelas', 'trades',
];
for (const t of TABLES) store.set(t, new Map());

// Contadores para PKs numéricas (bigint)
const counters = {};
function nextId(table) {
  counters[table] = (counters[table] || 0) + 1;
  return counters[table];
}

// ── Parser de URL no estilo Supabase REST ──────────────────────
// Ex: "characters?rpg_id=eq.foo&nome=eq.Kael&select=*"
function parseUrl(endpoint) {
  const [rawTable, rawQuery = ''] = endpoint.split('?');
  const table = rawTable.trim();
  const filters = [];
  let select = null;
  let limit = null;
  let order = null;

  for (const part of rawQuery.split('&')) {
    if (!part) continue;
    const [key, val] = part.split('=');
    if (key === 'select') { select = val; continue; }
    if (key === 'limit')  { limit = parseInt(val); continue; }
    if (key === 'order')  { order = val; continue; }

    // filter: field=op.value
    const dotIdx = val?.indexOf('.');
    if (dotIdx === -1 || dotIdx === undefined) continue;
    const op    = val.slice(0, dotIdx);
    const value = decodeURIComponent(val.slice(dotIdx + 1));
    filters.push({ key: decodeURIComponent(key), op, value });
  }

  return { table, filters, select, limit, order };
}

// Aplicar um filtro a uma linha
function matchFilter(row, { key, op, value }) {
  const rv = String(row[key] ?? '');
  switch (op) {
    case 'eq':  return rv === value;
    case 'neq': return rv !== value;
    case 'gt':  return parseFloat(rv) > parseFloat(value);
    case 'gte': return parseFloat(rv) >= parseFloat(value);
    case 'lt':  return parseFloat(rv) < parseFloat(value);
    case 'lte': return parseFloat(rv) <= parseFloat(value);
    case 'like': return rv.includes(value.replace(/%/g, ''));
    case 'is':  return value === 'null' ? row[key] == null : row[key] != null;
    default:    return true;
  }
}

// Aplicar lista de filtros (AND)
function applyFilters(rows, filters) {
  return rows.filter(row => filters.every(f => matchFilter(row, f)));
}

// Projeção de campos (select=field1,field2)
function applySelect(row, select) {
  if (!select || select === '*') return row;
  const fields = select.split(',').map(f => f.trim());
  const out = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out;
}

// ── PK helpers ────────────────────────────────────────────────
function getPkField(table) {
  switch (table) {
    case 'rpg_registry':    return 'rpg_id';
    case 'mapas':
    case 'inventario':
    case 'item_catalog':
    case 'item_usos':
    case 'moedas':
    case 'loot_pendente':
    case 'level_up_log':
    case 'tabelas':
    case 'trades':
    case 'atributos_grupos':
      return 'id'; // bigint auto-increment
    default:
      return 'id'; // uuid / text
  }
}

function genPk(table, row) {
  // Se a linha já fornece a PK, usa ela
  const pkField = getPkField(table);
  if (row[pkField] !== undefined) return row[pkField];
  // Tabelas com bigint
  const bigintTables = ['mapas','inventario','item_catalog','item_usos','moedas','loot_pendente','level_up_log','tabelas','trades','atributos_grupos'];
  if (bigintTables.includes(table)) return nextId(table);
  // UUID default
  return randomUUID();
}

// ── Operações principais ──────────────────────────────────────

export function simGet(endpoint) {
  const { table, filters, select, limit } = parseUrl(endpoint);
  const tbl = store.get(table);
  if (!tbl) throw new SimError(404, endpoint, `Tabela "${table}" não existe`);

  let rows = [...tbl.values()];
  rows = applyFilters(rows, filters);
  const projected = rows.map(r => applySelect(r, select));
  return limit ? projected.slice(0, limit) : projected;
}

export function simPost(endpoint, body) {
  const { table } = parseUrl(endpoint);
  const tbl = store.get(table);
  if (!tbl) throw new SimError(404, endpoint, `Tabela "${table}" não existe`);

  const row = {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...body,
  };
  const pkField = getPkField(table);
  const pk = genPk(table, row);
  row[pkField] = pk;

  // Chave interna Map: usar pk como string
  tbl.set(String(pk), row);
  return [row];
}

export function simPatch(endpoint, body) {
  const { table, filters } = parseUrl(endpoint);
  const tbl = store.get(table);
  if (!tbl) throw new SimError(404, endpoint, `Tabela "${table}" não existe`);

  const rows = applyFilters([...tbl.values()], filters);
  if (rows.length === 0) {
    // Retorna [] sem erro (comportamento Supabase com return=representation)
    return [];
  }
  const pkField = getPkField(table);
  const updated = [];
  for (const row of rows) {
    const merged = { ...row, ...body, updated_at: new Date().toISOString() };
    tbl.set(String(row[pkField]), merged);
    updated.push(merged);
  }
  return updated;
}

export function simDelete(endpoint) {
  const { table, filters } = parseUrl(endpoint);
  const tbl = store.get(table);
  if (!tbl) throw new SimError(404, endpoint, `Tabela "${table}" não existe`);

  const pkField = getPkField(table);
  const rows = applyFilters([...tbl.values()], filters);
  for (const row of rows) tbl.delete(String(row[pkField]));
  return rows;
}

// ── Interface principal (equivalente a sb()) ──────────────────
export function simSb(endpoint, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : undefined;

  // Latência simulada: 5–40ms
  const latency = 5 + Math.floor(Math.random() * 35);
  const start = Date.now();
  while (Date.now() - start < latency) {} // spin wait (ms)

  switch (method) {
    case 'GET':    return simGet(endpoint);
    case 'POST':   return simPost(endpoint, body);
    case 'PATCH':  return simPatch(endpoint, body);
    case 'DELETE': return simDelete(endpoint);
    default: throw new SimError(405, endpoint, `Método ${method} não suportado`);
  }
}

// ── Broadcast simulado (no-op que registra o evento) ──────────
export function simBroadcast(channel, event, payload) {
  // No modo simulação, broadcasts são registrados mas não transmitidos
  _broadcastLog.push({ channel, event, payload, ts: Date.now() });
}
const _broadcastLog = [];
export function getBroadcastLog() { return _broadcastLog; }

// ── Seed de jogadores simulados ───────────────────────────────
export function seedPlayers(players) {
  const tbl = store.get('players');
  for (const p of players) {
    tbl.set(p.id, { created_at: new Date().toISOString(), nome_real: '', ...p });
  }
}

// ── Dump do store (debug) ─────────────────────────────────────
export function dumpTable(table) {
  return [...(store.get(table)?.values() || [])];
}

export class SimError extends Error {
  constructor(status, endpoint, body) {
    super(`[SimDB ${status}] ${endpoint}: ${body}`);
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}
