-- migration_avt_session_state.sql
-- Modo Aventura P2P: snapshot de sessão para aventuras com id NÃO-UUID.
-- A tabela rpg_session_state (migration_aventura_p2p.sql) tem rpg_id uuid com FK
-- para rpg_registry, o que impede aventuras identificadas por string de persistir
-- snapshot — antes desta migração, essas sessões dependiam exclusivamente do
-- snapshot_response de peer para reidratar late-joiners.
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL).

-- ── 1. Tabela avt_session_state ──────────────────────────────────────────────
-- Uma linha por sessão de aventura; chave é o id string da aventura.

create table if not exists avt_session_state (
  session_key   text primary key,
  host_user_id  uuid not null,
  snapshot      jsonb not null default '{}',
  snapshot_ver  int  not null default 1,
  updated_at    timestamptz not null default now()
);

alter table avt_session_state enable row level security;

-- Qualquer usuário autenticado pode ler (o snapshot não contém segredos;
-- sem FK para rpg_registry não há como restringir por membership).
create policy "authenticated read avt session" on avt_session_state
  for select using (auth.role() = 'authenticated');

-- Escrita apenas via RPC security definer (abaixo); sem policy de insert/update
-- direto, PostgREST nega escrita fora do RPC.

-- ── 2. RPC update_avt_session_snapshot ───────────────────────────────────────
-- Chamada pelo host a cada 15s. Mesmo modelo de takeover da RPC original:
-- só o host corrente escreve, exceto quando o registro está velho (>30s).

create or replace function update_avt_session_snapshot(
  p_key      text,
  p_snapshot jsonb
) returns void
language plpgsql security definer as $$
begin
  insert into avt_session_state (session_key, host_user_id, snapshot, updated_at)
  values (p_key, auth.uid(), p_snapshot, now())
  on conflict (session_key) do update
    set snapshot     = excluded.snapshot,
        host_user_id = excluded.host_user_id,
        updated_at   = now()
    where avt_session_state.host_user_id = auth.uid()
       or avt_session_state.updated_at < now() - interval '30 seconds';
end;
$$;

grant execute on function update_avt_session_snapshot(text, jsonb) to authenticated;

-- ── 3. Limpeza opcional de sessões antigas (rodar manualmente se necessário) ──
-- delete from avt_session_state where updated_at < now() - interval '30 days';

-- ── NOTAS ─────────────────────────────────────────────────────────────────────
-- 1. O cliente roteia automaticamente: rpgId em formato UUID usa
--    rpg_session_state; qualquer outro usa avt_session_state
--    (js/core/supabase.ts → sessionStateGet/sessionStateUpdate).
-- 2. Sem esta migração aplicada, as chamadas para aventuras string falham com
--    404/400 e o cliente tolera (comportamento igual ao anterior).
