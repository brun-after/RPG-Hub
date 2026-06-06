-- migration_pixi_animations.sql
-- Tabela de animações do Studio Pixi
-- Executar no SQL Editor do Supabase

-- ── 1. Tabela pixi_animations ─────────────────────────────────────────────────
create table if not exists pixi_animations (
  id          uuid primary key default gen_random_uuid(),
  rpg_id      uuid references rpg_registry(rpg_id) on delete cascade,
  criado_por  uuid references auth.users(id) on delete set null,
  global      boolean not null default false,
  nome        text not null default 'Animação',
  descricao   text not null default '',
  behavior    text not null default 'one-shot',
  duracao_ms  int  not null default 1000,
  config_json jsonb not null default '{}',
  preview_url text,
  criado_em   timestamptz not null default now()
);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
alter table pixi_animations enable row level security;

-- Leitura: dono da animação ou animação global
create policy "pixi_animations_select" on pixi_animations
  for select using (
    criado_por = auth.uid()
    or global = true
  );

-- Insert: apenas usuários autenticados, criado_por deve ser o próprio usuário
create policy "pixi_animations_insert" on pixi_animations
  for insert with check (criado_por = auth.uid());

-- Update/Delete: apenas o criador
create policy "pixi_animations_update" on pixi_animations
  for update using (criado_por = auth.uid());

create policy "pixi_animations_delete" on pixi_animations
  for delete using (criado_por = auth.uid());

-- ── 3. Índices ────────────────────────────────────────────────────────────────
create index if not exists pixi_animations_rpg_id_idx   on pixi_animations (rpg_id);
create index if not exists pixi_animations_criado_por_idx on pixi_animations (criado_por);
create index if not exists pixi_animations_global_idx   on pixi_animations (global) where global = true;
