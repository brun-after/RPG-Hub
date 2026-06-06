-- migration_rpg_members_session_data.sql
-- Adiciona coluna session_data à tabela rpg_members
-- Executar no SQL Editor do Supabase

alter table rpg_members
  add column if not exists session_data jsonb not null default '{}';
