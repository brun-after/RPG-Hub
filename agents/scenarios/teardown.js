// scenarios/teardown.js
// Remove todos os dados de teste do Supabase (cascade via rpg_id)

import { sb, setAuthToken } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('teardown', 'desktop');

export async function teardown(rpgId, mestreToken) {
  if (!rpgId) {
    log.warn('Nenhum rpgId fornecido — teardown ignorado');
    return;
  }

  setAuthToken(mestreToken);
  log.info(`🗑 Iniciando teardown da campanha ${rpgId}...`);

  // A FK ON DELETE CASCADE no Supabase cuida de deletar:
  // characters, skills, mapas, batalhas, criativos, attr_defs, lore, rpg_members
  const t0 = Date.now();
  try {
    await sb(`rpg_registry?id=eq.${rpgId}`, { method: 'DELETE' });
    log.metrica('teardown_campanha', Date.now() - t0, true, null, { rpgId });
    log.info(`✅ Campanha ${rpgId} e todos os dados removidos`);
  } catch (e) {
    log.metrica('teardown_campanha', Date.now() - t0, false, e);
    log.error(`Falha ao remover campanha: ${e.message}`);
    log.warn('Tentando limpeza manual por tabela...');
    await limpezaManual(rpgId);
  }
}

async function limpezaManual(rpgId) {
  const tabelas = [
    'criativos', 'batalhas', 'skills', 'mapas',
    'characters', 'attr_defs', 'atributos_grupos',
    'item_catalog', 'inventario', 'lore',
    'rpg_members', 'rpg_registry',
  ];

  for (const tabela of tabelas) {
    try {
      await sb(`${tabela}?rpg_id=eq.${rpgId}`, { method: 'DELETE' });
      log.info(`  ✓ ${tabela} limpa`);
    } catch (e) {
      log.warn(`  ✗ Falha ao limpar ${tabela}: ${e.message}`);
    }
  }
}
