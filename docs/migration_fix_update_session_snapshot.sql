-- migration_fix_update_session_snapshot.sql
-- Remove o overload duplicado de update_session_snapshot.
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL).
--
-- Em produção existem DUAS versões da função:
--   update_session_snapshot(p_rpg_id text, p_snapshot jsonb)
--   update_session_snapshot(p_rpg_id uuid, p_snapshot jsonb)
-- Com as duas presentes, o PostgREST rejeita toda chamada REST com erro
-- PGRST203 (overload ambíguo) — ou seja, NENHUM snapshot de sessão persiste.
--
-- Qual manter: em produção rpg_session_state.rpg_id é TEXT (com FK para
-- rpg_registry.rpg_id, também text) — o oposto do que assume o cabeçalho de
-- migration_aventura_p2p.sql. A versão compatível com o schema real é a TEXT.
-- Antes de dropar, confira os corpos com:
--   select p.oid::regprocedure, pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'update_session_snapshot';

drop function if exists update_session_snapshot(uuid, jsonb);
