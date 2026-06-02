-- migration_skills_area.sql
-- Adiciona suporte a ataques em área (AoE) na tabela skills
-- Executar no SQL Editor do Supabase (projeto correspondente ao SUPABASE_URL)

ALTER TABLE skills ADD COLUMN IF NOT EXISTS tipo_area   TEXT    DEFAULT NULL;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS tamanho_area INTEGER DEFAULT 1;

-- tipo_area: NULL = alvo único, 'quadrado' = área quadrada, 'linha' = linha reta
-- tamanho_area: 1–5 (ex: 1 = 3×3 células, 2 = 5×5 células, ...)
