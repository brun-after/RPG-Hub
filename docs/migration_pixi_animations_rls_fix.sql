-- migration_pixi_animations_rls_fix.sql
-- Corrige leitura das animações do Studio Pixi para jogadores (não-mestre).
-- Executar no SQL Editor do Supabase (bancos já existentes).
--
-- Problema: a policy de SELECT original só liberava leitura para o criador
-- (criado_por = auth.uid()) ou para animações globais (global = true).
-- Animações não-globais são salvas com rpg_id NULL na maioria dos casos
-- (PIXI_STUDIO_STATE.rpgId só é definido ao abrir o picker via editor de
-- skill), então nenhuma policy por escopo de rpg_id consegue casar e os
-- jogadores não conseguem ler a config_json — a animação não renderiza.
--
-- Animações Pixi são apenas dados cosméticos (configuração visual) e já são
-- referenciadas por skills amplamente legíveis, então liberamos a leitura
-- para qualquer usuário autenticado. Escrita continua restrita ao criador.

drop policy if exists "pixi_animations_select" on pixi_animations;
create policy "pixi_animations_select" on pixi_animations
  for select
  to authenticated
  using (true);
