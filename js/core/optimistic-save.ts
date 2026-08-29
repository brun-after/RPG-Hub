// core/optimistic-save.ts
// RPG Hub — camada de salvamento otimista.
//
// Padrão: o caller muta o estado local, re-renderiza IMEDIATAMENTE e chama
// salvarOtimista() para persistir em background. Em caso de falha, o usuário
// é notificado via toast e o dado canônico da entidade é re-buscado do
// servidor (sem rollback local por snapshot — decisão de design).
//
// Coalescing: um write em voo por chave. Chamadas para a mesma chave enquanto
// há write em voo substituem o "próximo" (last-write-wins) — como persistir()
// lê o estado local vivo no momento da execução, o valor enviado é sempre o
// mais recente. Convenção de chaves:
//   'characters:<id>' · 'lore:<id>' · 'skills:<id>' · 'inventario:<invId>'
//   · 'rpg_registry:arena:<rpgId>'
//
// osEco(chave) informa ao realtime se um postgres_change recebido é eco do
// nosso próprio write ('pendente' = há write em voo ou debounced — não
// aplicar; 'recente' = settle há <1,5s — aplicar sem toast).

interface OsOpts {
  chave: string;
  persistir: () => Promise<any>;
  aoFalhar?: () => void | Promise<void>;
  msgErro?: string;
}

const OS_FILA = new Map<string, { proximo: OsOpts | null; prom: Promise<void> }>();
const OS_DEBOUNCE = new Map<string, { timer: ReturnType<typeof setTimeout>; opts: OsOpts }>();
const OS_RECENTE = new Map<string, number>();
const OS_GRACE_MS = 1500;

function salvarOtimista(o: OsOpts): void {
  const ent = OS_FILA.get(o.chave);
  if (ent) { ent.proximo = o; return; }   // last-write-wins para a mesma chave
  const entry = { proximo: null as OsOpts | null, prom: Promise.resolve() };
  OS_FILA.set(o.chave, entry);
  entry.prom = _osExecutar(o);
}

async function _osExecutar(o: OsOpts): Promise<void> {
  try {
    await o.persistir();   // reusa os retries do sb(): 401-refresh e backoff 57014
  } catch (e) {
    console.error('[os] falha ao persistir', o.chave, e);
    if (typeof mostrarToast === 'function') {
      mostrarToast(o.msgErro || '⚠ Falha ao salvar — ressincronizando…', 'erro', 6000);
    }
    // Ressincronizar com o canônico do servidor; se o próprio refetch falhar
    // (ex.: offline), mantém o estado local — o toast de erro já avisou.
    try { await o.aoFalhar?.(); } catch (_) {}
  } finally {
    OS_RECENTE.set(o.chave, Date.now());
    const ent = OS_FILA.get(o.chave);
    const prox = ent?.proximo;
    if (ent && prox) { ent.proximo = null; ent.prom = _osExecutar(prox); }
    else OS_FILA.delete(o.chave);
  }
}

// Variante com debounce (trailing edge) — para saves de alta frequência que
// gravam um blob inteiro (ex.: arena). O opts mais recente vence.
function salvarOtimistaDebounced(o: OsOpts & { ms?: number }): void {
  const ent = OS_DEBOUNCE.get(o.chave);
  if (ent) clearTimeout(ent.timer);
  const timer = setTimeout(() => {
    OS_DEBOUNCE.delete(o.chave);
    salvarOtimista(o);
  }, o.ms ?? 200);
  OS_DEBOUNCE.set(o.chave, { timer, opts: o });
}

// Dispara imediatamente todos os saves debounced pendentes e aguarda os writes
// em voo. Usar antes de transições destrutivas (sair da arena, deletar) e no
// beforeunload — neste último o await é melhor esforço.
function osFlushTudo(): Promise<void> {
  for (const [chave, ent] of OS_DEBOUNCE) {
    clearTimeout(ent.timer);
    OS_DEBOUNCE.delete(chave);
    salvarOtimista(ent.opts);
  }
  const proms: Promise<void>[] = [];
  for (const ent of OS_FILA.values()) proms.push(ent.prom);
  return Promise.allSettled(proms).then(() => {});
}

// Estado de eco para o realtime:
//   'pendente' — write em voo ou aguardando debounce: estado local é mais novo
//                que qualquer coisa vinda do servidor; NÃO aplicar o record.
//   'recente'  — settle há <OS_GRACE_MS: é o eco do nosso próprio write;
//                aplicar (idempotente) mas sem toast de "atualizado".
function osEco(chave: string): 'pendente' | 'recente' | null {
  if (OS_FILA.has(chave) || OS_DEBOUNCE.has(chave)) return 'pendente';
  const t = OS_RECENTE.get(chave);
  return (t && Date.now() - t < OS_GRACE_MS) ? 'recente' : null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { osFlushTudo(); });
}

// ── RE-FETCH CANÔNICO POR ENTIDADE (caminho de erro) ─────────────────────────

const _OS_CHAR_SELECT = 'id,rpg_id,nome,hp_atual,hp_max,xp,nivel,pontos_attr,custom_attrs,map_positions,active_map_id,buffs';

async function osRefetchCharacter(rpgId: string, idOuNome: string): Promise<void> {
  if (!rpgId || !idOuNome) return;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOuNome);
  const filtro = isUuid ? `id=eq.${encodeURIComponent(idOuNome)}` : `nome=eq.${encodeURIComponent(idOuNome)}`;
  const rows = await sb<any[]>(`characters?rpg_id=eq.${encodeURIComponent(rpgId)}&${filtro}&select=${_OS_CHAR_SELECT}&limit=1`);
  const rec = rows && rows[0];
  if (!rec) return;
  _normalizarCharRow(rec);
  // Merge (não substituição) — o select é parcial; preserva campos carregados
  // por outros fluxos.
  if (RPG_DATA?.characters) {
    const idx = RPG_DATA.characters.findIndex(c => (rec.id && c.id === rec.id) || (c.nome === rec.nome && c.rpg_id === rec.rpg_id));
    if (idx >= 0) RPG_DATA.characters[idx] = { ...RPG_DATA.characters[idx], ...rec };
  }
  if (typeof AR !== 'undefined' && AR?.chars) {
    const ai = AR.chars.findIndex((c: any) => (rec.id && c.id === rec.id) || (c.nome === rec.nome && c.rpg_id === rec.rpg_id));
    if (ai >= 0) AR.chars[ai] = { ...AR.chars[ai], ...rec };
  }
  const nome = rec.nome;
  try {
    if (typeof FICHAS_VIEW !== 'undefined' && FICHAS_VIEW === nome && typeof renderFichaView === 'function') renderFichaView(nome);
    if (typeof CHAR_VIEW !== 'undefined' && CHAR_VIEW === nome && typeof renderCharView === 'function') renderCharView(nome);
    if (typeof ATTR_VIEW !== 'undefined' && ATTR_VIEW === nome && typeof renderAttrView === 'function') renderAttrView(nome);
    if (typeof renderCharButtons === 'function') renderCharButtons();
    if (typeof MAPA_STATE !== 'undefined' && MAPA_STATE?.mapaAtualId && RPG_DATA?.mapas) {
      const entry = RPG_DATA.mapas.find(l => l.mapa.map_id === MAPA_STATE.mapaAtualId);
      if (entry && typeof mapaRenderTokens === 'function') mapaRenderTokens(entry.mapa);
      if (typeof mapaRenderStatus === 'function') mapaRenderStatus();
    }
    if (typeof AR !== 'undefined' && AR?.session) {
      if (typeof renderArenaPersonagens === 'function') renderArenaPersonagens();
      if (typeof renderMesa === 'function') renderMesa();
    }
  } catch (_) {}
}

async function osRefetchLore(): Promise<void> {
  if (!RPG_DATA?.rpgId) return;
  const lore = await sb<any[]>(`lore?rpg_id=eq.${encodeURIComponent(RPG_DATA.rpgId)}&select=*&order=id`);
  RPG_DATA.lore = (lore || []).filter((l: any) => l.secao !== 'mapa');
  if (typeof renderLore === 'function') renderLore();
}

async function osRefetchSkill(skillId: any): Promise<void> {
  if (!RPG_DATA?.rpgId || skillId == null) return;
  const rows = await sb<any[]>(`skills?id=eq.${encodeURIComponent(skillId)}&select=*&limit=1`);
  const s = rows && rows[0];
  if (!s) return;
  if (typeof s.animacao === 'string') { try { s.animacao = JSON.parse(s.animacao); } catch (ex) { s.animacao = null; } }
  if (s.animacao && typeof s.animacao !== 'object') s.animacao = null;
  if (!Array.isArray(s.efeitos_bonus)) { if (typeof s.efeitos_bonus === 'string') { try { s.efeitos_bonus = JSON.parse(s.efeitos_bonus); } catch (ex) { s.efeitos_bonus = []; } } else s.efeitos_bonus = []; }
  const idx = (RPG_DATA.skills || []).findIndex((x: any) => x.id == s.id);
  if (idx >= 0) RPG_DATA.skills[idx] = s;
  try {
    if (typeof FICHAS_VIEW !== 'undefined' && FICHAS_VIEW && typeof renderFichaView === 'function') renderFichaView(FICHAS_VIEW);
  } catch (_) {}
}

async function osRefetchInventario(charId: any): Promise<void> {
  if (charId == null) return;
  if (typeof carregarInventarioChar === 'function') await carregarInventarioChar(charId);
}

async function osRefetchArenaEstado(): Promise<void> {
  if (typeof AR === 'undefined' || !AR?.session?.rpg_id) return;
  const reg = await sb<any[]>(`rpg_registry?rpg_id=eq.${encodeURIComponent(AR.session.rpg_id)}&select=arena_estado&limit=1`);
  const raw = reg && reg[0] ? reg[0].arena_estado : null;
  if (raw == null) return;
  try {
    AR.estado = typeof raw === 'object' ? raw : JSON.parse(raw || '{}');
    if (!AR.estado.log) AR.estado.log = [];
    if ((AR.estado as any).iniciativa_arena) AR.iniciativa = (AR.estado as any).iniciativa_arena;
    else AR.iniciativa = null;
  } catch (_) { return; }
  try {
    if (typeof renderArenaCenario === 'function') renderArenaCenario();
    if (typeof renderArenaLog === 'function') renderArenaLog();
    if (typeof renderArenaIniciativaUI === 'function') renderArenaIniciativaUI();
    if (typeof renderArenaPersonagens === 'function') renderArenaPersonagens();
    if (typeof renderArenaEntidades === 'function') renderArenaEntidades();
    if (typeof renderArenaEfeitos === 'function') renderArenaEfeitos();
    if (typeof renderMesa === 'function') renderMesa();
  } catch (_) {}
}

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "salvarOtimista", { configurable: true, writable: true, value: salvarOtimista });
Object.defineProperty(globalThis, "salvarOtimistaDebounced", { configurable: true, writable: true, value: salvarOtimistaDebounced });
Object.defineProperty(globalThis, "osFlushTudo", { configurable: true, writable: true, value: osFlushTudo });
Object.defineProperty(globalThis, "osEco", { configurable: true, writable: true, value: osEco });
Object.defineProperty(globalThis, "osRefetchCharacter", { configurable: true, writable: true, value: osRefetchCharacter });
Object.defineProperty(globalThis, "osRefetchLore", { configurable: true, writable: true, value: osRefetchLore });
Object.defineProperty(globalThis, "osRefetchSkill", { configurable: true, writable: true, value: osRefetchSkill });
Object.defineProperty(globalThis, "osRefetchInventario", { configurable: true, writable: true, value: osRefetchInventario });
Object.defineProperty(globalThis, "osRefetchArenaEstado", { configurable: true, writable: true, value: osRefetchArenaEstado });
