-- migration_aventura_p2p.sql
-- Modo Aventura P2P: tabela de snapshot de sessão (camada B) + RPC de atualização
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL)

-- ── 1. Tabela rpg_session_state ──────────────────────────────────────────────
-- Armazena o snapshot periódico (15s) do AVT_STATE serializado.
-- Uma linha por rpg_id; o host faz UPSERT; clientes leem para reidratar.

create table if not exists rpg_session_state (
  rpg_id        uuid primary key references rpg_registry(id) on delete cascade,
  host_user_id  uuid not null,
  snapshot      jsonb not null default '{}',
  snapshot_ver  int  not null default 1,
  updated_at    timestamptz not null default now()
);

alter table rpg_session_state enable row level security;

-- Membros do RPG podem ler o snapshot (para reidratar ao entrar)
create policy "members read session" on rpg_session_state
  for select using (
    exists (
      select 1 from rpg_members m
      where m.rpg_id = rpg_session_state.rpg_id
        and m.player_id = auth.uid()
    )
  );

-- Somente o host atual pode escrever/atualizar
create policy "host writes session" on rpg_session_state
  for all using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());


-- ── 2. RPC update_session_snapshot ───────────────────────────────────────────
-- Chamada pelo host a cada 15s (snapshot periódico) e a cada 5s (heartbeat).
-- Garante que apenas o host eleito consiga atualizar.

create or replace function update_session_snapshot(
  p_rpg_id  uuid,
  p_snapshot jsonb
) returns void
language plpgsql security definer as $$
begin
  insert into rpg_session_state (rpg_id, host_user_id, snapshot, updated_at)
  values (p_rpg_id, auth.uid(), p_snapshot, now())
  on conflict (rpg_id) do update
    set snapshot    = excluded.snapshot,
        host_user_id = excluded.host_user_id,
        updated_at  = now()
    -- Permite que um novo host assuma quando o antigo está morto (>30s)
    where rpg_session_state.host_user_id = auth.uid()
       or rpg_session_state.updated_at < now() - interval '30 seconds';
end;
$$;

-- Conceder execução para usuários autenticados
grant execute on function update_session_snapshot(uuid, jsonb) to authenticated;


-- ── 3. Índice para leituras rápidas por rpg_id ───────────────────────────────
create index if not exists rpg_session_state_rpg_id_idx
  on rpg_session_state (rpg_id);


-- ── NOTAS DE APLICAÇÃO ───────────────────────────────────────────────────────
-- 1. Executar este script inteiro em uma única transação no SQL Editor.
-- 2. Sem rollback automático: verificar erros antes de aplicar em produção.
-- 3. A tabela rpg_session_state é de baixo volume (uma linha por sessão ativa).
-- 4. O snapshot contém apenas estado de sessão (entidades, batalhas, timers);
--    dados permanentes (HP final, XP) continuam em characters / batalhas.
