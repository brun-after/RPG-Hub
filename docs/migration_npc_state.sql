-- migration_npc_state.sql
-- Sincronização autoritativa de NPCs no fallback Supabase (sem P2P).
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL).
--
-- O cliente já chama estas RPCs (js/systems/aventura.ts §NPC-SYNC e
-- _avtFlushPersistencia) e assina `realtime:public:npc_state:rpg_id=eq.<id>`
-- (js/core/realtime.ts). Sem esta migração, cada chamada é um 404 — nos logs
-- de produção aparecem dezenas de POST /rpc/npc_update_position 404 por
-- segundo durante o jogo.
--
-- Contrato consumido pelo cliente (_avtNpcOnRemoteUpdate):
--   rpg_id, npc_id, hp, hp_max, x, y, dead, version, host_user, killer_user

-- ── 1. Tabela npc_state ──────────────────────────────────────────────────────
create table if not exists npc_state (
  rpg_id       text not null,
  npc_id       text not null,
  hp           integer not null default 0,
  hp_max       integer not null default 1,
  x            double precision not null default 0,
  y            double precision not null default 0,
  dead         boolean not null default false,
  killer_user  uuid,
  host_user    uuid,
  host_expires timestamptz,
  version      bigint not null default 1,
  updated_at   timestamptz not null default now(),
  primary key (rpg_id, npc_id)
);

alter table npc_state enable row level security;

-- Membros do RPG leem o estado (necessário também para o realtime autorizar
-- os postgres_changes por linha).
create policy "members read npc_state" on npc_state
  for select using (
    exists (
      select 1 from rpg_members m
      where m.rpg_id = npc_state.rpg_id
        and m.player_id = auth.uid()
    )
  );

-- Escrita apenas via RPCs security definer abaixo (sem policy de
-- insert/update/delete, PostgREST nega escrita direta).

-- Dedupe de dano (nonce): eventos repetidos (retry/reconnect) não aplicam 2×.
create table if not exists npc_damage_nonce (
  rpg_id     text not null,
  npc_id     text not null,
  nonce      text not null,
  created_at timestamptz not null default now(),
  primary key (rpg_id, npc_id, nonce)
);
alter table npc_damage_nonce enable row level security;

-- Publicar mudanças no Realtime (idempotente).
do $$
begin
  begin
    alter publication supabase_realtime add table npc_state;
  exception when duplicate_object then null;
  end;
end $$;

-- ── 2. RPC npc_upsert ────────────────────────────────────────────────────────
-- Semeia (ou re-semeia após respawn) o estado canônico a partir do local.
create or replace function npc_upsert(
  _rpg text, _npc text, _hp integer, _hp_max integer,
  _x double precision, _y double precision
) returns npc_state
language plpgsql security definer as $$
declare r npc_state;
begin
  insert into npc_state as ns (rpg_id, npc_id, hp, hp_max, x, y, dead, updated_at)
  values (_rpg, _npc, greatest(0, _hp), greatest(1, _hp_max), _x, _y, _hp <= 0, now())
  on conflict (rpg_id, npc_id) do update set
    -- Linha já existe: só "ressuscita" (respawn) se o canônico está morto;
    -- nunca sobrescreve HP vivo de outro cliente com o estado local de quem entra.
    hp         = case when ns.dead then greatest(0, excluded.hp) else ns.hp end,
    hp_max     = greatest(1, excluded.hp_max),
    x          = case when ns.dead then excluded.x else ns.x end,
    y          = case when ns.dead then excluded.y else ns.y end,
    dead       = case when ns.dead and excluded.hp > 0 then false else ns.dead end,
    killer_user= case when ns.dead and excluded.hp > 0 then null else ns.killer_user end,
    version    = ns.version + 1,
    updated_at = now()
  returning * into r;
  return r;
end $$;

-- ── 3. RPC npc_claim_host ────────────────────────────────────────────────────
-- Lease de ~6s: ganha quem chega com lease vencido/vago; renova quem já é host.
create or replace function npc_claim_host(
  _rpg text, _npc text, _user uuid
) returns npc_state
language plpgsql security definer as $$
declare r npc_state;
begin
  update npc_state ns set
    host_user    = case when ns.host_user is null or ns.host_expires is null
                          or ns.host_expires < now() or ns.host_user = _user
                        then _user else ns.host_user end,
    host_expires = case when ns.host_user is null or ns.host_expires is null
                          or ns.host_expires < now() or ns.host_user = _user
                        then now() + interval '6 seconds' else ns.host_expires end,
    updated_at   = now()
  where ns.rpg_id = _rpg and ns.npc_id = _npc
  returning * into r;
  return r;
end $$;

-- ── 4. RPC npc_update_position ───────────────────────────────────────────────
-- Host corrente move o NPC (renova o lease). _user null (flush de saída) só
-- escreve quando não há host vivo — nunca briga com o host ativo.
create or replace function npc_update_position(
  _rpg text, _npc text, _x double precision, _y double precision, _user uuid
) returns npc_state
language plpgsql security definer as $$
declare r npc_state;
begin
  update npc_state ns set
    x = _x, y = _y,
    host_expires = case when _user is not null and ns.host_user = _user
                        then now() + interval '6 seconds' else ns.host_expires end,
    version    = ns.version + 1,
    updated_at = now()
  where ns.rpg_id = _rpg and ns.npc_id = _npc
    and (
      (_user is not null and ns.host_user = _user and (ns.host_expires is null or ns.host_expires >= now()))
      or ns.host_user is null or ns.host_expires is null or ns.host_expires < now()
    )
  returning * into r;
  return r;
end $$;

-- ── 5. RPC npc_release_host ──────────────────────────────────────────────────
create or replace function npc_release_host(
  _rpg text, _npc text, _user uuid
) returns void
language plpgsql security definer as $$
begin
  update npc_state ns set host_user = null, host_expires = null, updated_at = now()
  where ns.rpg_id = _rpg and ns.npc_id = _npc and ns.host_user = _user;
end $$;

-- ── 6. RPC npc_apply_damage ──────────────────────────────────────────────────
-- Decremento atômico com dedupe por nonce; marca dead/killer_user no last hit.
create or replace function npc_apply_damage(
  _rpg text, _npc text, _delta integer, _attacker uuid, _nonce text
) returns npc_state
language plpgsql security definer as $$
declare r npc_state;
begin
  if _nonce is not null then
    begin
      insert into npc_damage_nonce (rpg_id, npc_id, nonce) values (_rpg, _npc, _nonce);
    exception when unique_violation then
      select * into r from npc_state where rpg_id = _rpg and npc_id = _npc;
      return r; -- nonce repetido: devolve o canônico sem reaplicar
    end;
  end if;

  update npc_state ns set
    hp          = greatest(0, ns.hp - _delta),
    dead        = (ns.hp - _delta) <= 0,
    killer_user = case when (ns.hp - _delta) <= 0 and not ns.dead then _attacker else ns.killer_user end,
    version     = ns.version + 1,
    updated_at  = now()
  where ns.rpg_id = _rpg and ns.npc_id = _npc
  returning * into r;
  return r;
end $$;

-- Higiene: nonces com mais de 1 dia podem ser limpos por qualquer chamada de dano.
create index if not exists npc_damage_nonce_created_idx on npc_damage_nonce (created_at);
