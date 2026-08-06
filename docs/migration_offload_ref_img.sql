-- migration_offload_ref_img.sql
-- Tira imagens de referência (data-URI) de dentro de skills.animacao.
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL).
--
-- Problema: a imagem-guia do editor Pixi Studio era gravada INTEIRA (base64)
-- em skills.animacao.referencia_img. Como o load da aventura faz
-- skills?select=* (js/systems/aventura.ts, _avtCarregarDados), todo jogador
-- baixava o blob a cada entrada — em "The One", uma única skill somava ~793KB
-- (~900KB de payload total de skills).
--
-- O código novo comprime a imagem no anexo (≤256px). Para as linhas antigas,
-- este script PRESERVA o dado original estacionando-o em
-- pixi_animations.config_json.referencia_img_backup (fora do caminho quente)
-- e remove o campo pesado de skills. Para reexibir a referência no editor,
-- basta re-anexar a imagem (agora comprimida) — ou recuperá-la do backup.

-- 1. Estacionar backups (uma linha de pixi_animations por skill afetada).
insert into pixi_animations (rpg_id, nome, descricao, config_json)
select
  s.rpg_id,
  'backup-ref-img: ' || coalesce(s.habilidade, s.id::text),
  'Backup automático da imagem de referência removida de skills.animacao (migration_offload_ref_img)',
  jsonb_build_object(
    'skill_id', s.id,
    'referencia_img_backup', s.animacao->'referencia_img',
    'referencia_img_mime',   s.animacao->'referencia_img_mime'
  )
from skills s
where length(coalesce(s.animacao->>'referencia_img', '')) > 65536;

-- 2. Remover o campo pesado das skills.
update skills s
set animacao = (s.animacao - 'referencia_img' - 'referencia_img_mime')
where length(coalesce(s.animacao->>'referencia_img', '')) > 65536;
