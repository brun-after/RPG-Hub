// scenarios/setup.js
// Cria toda a estrutura da campanha de teste:
// campanha, membros, attr_defs, personagens, habilidades, pet, NPCs, mapa tático

import { sb, setAuthToken } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';
import { randomUUID } from 'crypto';

const log = createLogger('setup', 'desktop');

// UUIDs determinísticos por nome — evita conflitos em re-runs
function sid(nome) {
  const h = nome.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0);
  return 'aaaaaaaa-bbbb-4ccc-aaaa-' + Math.abs(h).toString(16).padStart(12, '0').slice(0, 12);
}

// ── Dados da campanha ──────────────────────────────────────────
export const CAMPANHA_NOME = 'Agentes - A Cripta Maldita';
export const CAMPANHA_ID   = 'test-' + Date.now(); // gerado em runtime

// Personagens (definidos aqui para uso em outros módulos)
export const PERSONAGENS = {
  arquimedes: {
    nome: 'Arquimedes', nivel: 5, hp: 38, hp_max: 38,
    custom_attrs: {
      tipo_personagem: 'jogador', cor: '#7c3aed',
      aparencia: { modelo_criatura: 'mage', tamanho: 1.0, cor_base: '#7c3aed' },
      atributos: { Forca: 8, Destreza: 14, Constituicao: 12, Inteligencia: 18, CA: 13, Iniciativa: 2 },
    },
  },
  kael: {
    nome: 'Kael', nivel: 5, hp: 52, hp_max: 52,
    custom_attrs: {
      tipo_personagem: 'jogador', cor: '#dc2626',
      aparencia: { modelo_criatura: 'warrior', tamanho: 1.1, cor_base: '#b45309' },
      atributos: { Forca: 18, Destreza: 12, Constituicao: 16, Inteligencia: 10, CA: 16, Iniciativa: 1 },
    },
  },
  lyra: {
    nome: 'Lyra', nivel: 5, hp: 42, hp_max: 42,
    custom_attrs: {
      tipo_personagem: 'jogador', cor: '#16a34a',
      aparencia: { modelo_criatura: 'archer', tamanho: 0.95, cor_base: '#15803d' },
      atributos: { Forca: 12, Destreza: 18, Constituicao: 13, Inteligencia: 12, CA: 15, Iniciativa: 4 },
    },
  },
  theron: {
    nome: 'Theron', nivel: 5, hp: 49, hp_max: 49,
    custom_attrs: {
      tipo_personagem: 'jogador', cor: '#d97706',
      aparencia: { modelo_criatura: 'paladin', tamanho: 1.05, cor_base: '#f59e0b' },
      atributos: { Forca: 16, Destreza: 10, Constituicao: 15, Inteligencia: 11, CA: 18, Iniciativa: 0 },
    },
  },
  sombra: {
    nome: 'Sombra', nivel: 3, hp: 22, hp_max: 22,
    custom_attrs: {
      tipo_personagem: 'criatura', eh_pet: true, pet_dono: 'Theron', cor: '#374151',
      aparencia: { modelo_criatura: 'npc_generico', tamanho: 0.8, cor_base: '#1f2937' },
      atributos: { Forca: 14, Destreza: 15, Constituicao: 12, Inteligencia: 3, CA: 13, Iniciativa: 2 },
    },
  },
  capitao_vorn: {
    nome: 'Capitão Vorn', nivel: 4, hp: 40, hp_max: 40,
    custom_attrs: {
      tipo_personagem: 'npc', npc_faction: 'inimigo', cor: '#991b1b',
      aparencia: { modelo_criatura: 'warrior', tamanho: 1.0, cor_base: '#7f1d1d' },
      atributos: { Forca: 16, Destreza: 12, Constituicao: 14, Inteligencia: 10, CA: 15, Iniciativa: 1 },
    },
  },
  lobo_trevas: {
    nome: 'Lobo das Trevas', nivel: 3, hp: 28, hp_max: 28,
    custom_attrs: {
      tipo_personagem: 'criatura', npc_faction: 'inimigo', cor: '#1e1b4b',
      aparencia: { modelo_criatura: 'npc_generico', tamanho: 1.2, cor_base: '#312e81' },
      atributos: { Forca: 15, Destreza: 13, Constituicao: 13, Inteligencia: 3, CA: 12, Iniciativa: 3 },
    },
  },
};

// Habilidades dos personagens
const HABILIDADES = [
  // Arquimedes
  { personagem: 'Arquimedes', habilidade: 'Rajada Arcana',     formula_dano: '2d8+3',  tipo_dano: 'magico',  alcance_celulas: 6, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Arquimedes', habilidade: 'Escudo Arcano',     formula_dano: '0',       tipo_dano: 'defesa',  alcance_celulas: 0, alvo_tipo: 'proprio', custo_rsv: 1, cooldown_turnos: 1, tipo_habilidade: 'reativa', gatilho_tipo: 'ser_atacado' },
  { personagem: 'Arquimedes', habilidade: 'Bola de Fogo',      formula_dano: '3d6+2',  tipo_dano: 'fogo',    alcance_celulas: 8, alvo_tipo: 'area',    custo_rsv: 2, cooldown_turnos: 2 },
  // Kael
  { personagem: 'Kael', habilidade: 'Golpe Pesado',            formula_dano: '2d6+4',  tipo_dano: 'fisico',  alcance_celulas: 1, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Kael', habilidade: 'Investida',               formula_dano: '1d10+4', tipo_dano: 'fisico',  alcance_celulas: 3, alvo_tipo: 'inimigo', custo_rsv: 1, cooldown_turnos: 1 },
  { personagem: 'Kael', habilidade: 'Segunda Chance',          formula_dano: '1d4',    tipo_dano: 'cura',    alcance_celulas: 0, alvo_tipo: 'proprio', custo_rsv: 1, cooldown_turnos: 3 },
  // Lyra
  { personagem: 'Lyra', habilidade: 'Flecha Perfurante',       formula_dano: '1d8+4',  tipo_dano: 'fisico',  alcance_celulas: 8, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Lyra', habilidade: 'Chuva de Flechas',        formula_dano: '2d6+2',  tipo_dano: 'fisico',  alcance_celulas: 6, alvo_tipo: 'area',    custo_rsv: 2, cooldown_turnos: 2 },
  { personagem: 'Lyra', habilidade: 'Flecha Envenenada',       formula_dano: '1d4+2',  tipo_dano: 'veneno',  alcance_celulas: 8, alvo_tipo: 'inimigo', custo_rsv: 1, cooldown_turnos: 1 },
  // Theron
  { personagem: 'Theron', habilidade: 'Golpe Sagrado',         formula_dano: '1d8+3',  tipo_dano: 'sagrado', alcance_celulas: 1, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Theron', habilidade: 'Imposição de Mãos',     formula_dano: '1d8+5',  tipo_dano: 'cura',    alcance_celulas: 1, alvo_tipo: 'aliado',  custo_rsv: 1, cooldown_turnos: 1 },
  { personagem: 'Theron', habilidade: 'Aura Protetora',        formula_dano: '0',       tipo_dano: 'defesa',  alcance_celulas: 0, alvo_tipo: 'proprio', custo_rsv: 1, cooldown_turnos: 2 },
  // Sombra (pet)
  { personagem: 'Sombra', habilidade: 'Mordida Feroz',         formula_dano: '1d6+2',  tipo_dano: 'fisico',  alcance_celulas: 1, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Sombra', habilidade: 'Rugido Intimidador',    formula_dano: '0',       tipo_dano: 'debuff',  alcance_celulas: 2, alvo_tipo: 'inimigo', custo_rsv: 1, cooldown_turnos: 2 },
  // Capitão Vorn (NPC)
  { personagem: 'Capitão Vorn', habilidade: 'Tajo do Capitão', formula_dano: '1d10+3', tipo_dano: 'fisico',  alcance_celulas: 1, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Capitão Vorn', habilidade: 'Grito de Guerra', formula_dano: '0',       tipo_dano: 'buff',    alcance_celulas: 0, alvo_tipo: 'proprio', custo_rsv: 1, cooldown_turnos: 3 },
  // Lobo das Trevas (NPC criatura)
  { personagem: 'Lobo das Trevas', habilidade: 'Mordida Sombria', formula_dano: '1d8+3', tipo_dano: 'sombrio', alcance_celulas: 1, alvo_tipo: 'inimigo', custo_rsv: 0, cooldown_turnos: 0 },
  { personagem: 'Lobo das Trevas', habilidade: 'Uivo das Trevas', formula_dano: '1d4',   tipo_dano: 'debuff',  alcance_celulas: 3, alvo_tipo: 'area',    custo_rsv: 1, cooldown_turnos: 2 },
];

// ── Função principal de setup ──────────────────────────────────
// sessoes: { mestre, jogador1, jogador2, jogador3 } com { access_token, user: { id, email } }
export async function setup(sessoes) {
  log.info('Iniciando setup da campanha de teste...');

  const mestreSession = sessoes.mestre;
  setAuthToken(mestreSession.access_token);
  log.info(`Setup como: ${mestreSession.user?.email}`);

  // 2. Criar campanha
  const t1 = Date.now();
  let campanha;
  const rpgIdGerado = 'test-' + Date.now();
  try {
    const [c] = await sb('rpg_registry', {
      method: 'POST',
      body: JSON.stringify({
        rpg_id: rpgIdGerado,
        name: CAMPANHA_NOME,
        owner_id: mestreSession.user.id,
        theme_json: {
          sistema: 'dnd5e',
          battle_config: {
            usa_reacoes: true,
            max_reacoes_por_rodada: 1,
            tipo_defesa: 'passiva',
            graus_de_sucesso: false,
            passivas_automaticas: true,
          },
        },
      }),
    });
    campanha = c;
    log.metrica('criar_campanha', Date.now() - t1, true, null, { campanha_id: campanha.rpg_id });
    log.info(`Campanha criada: "${campanha.name}" [${campanha.rpg_id}]`);
  } catch (e) {
    log.metrica('criar_campanha', Date.now() - t1, false, e);
    throw new Error(`Falha ao criar campanha: ${e.message}`);
  }

  const rpgId = campanha.rpg_id;

  // 3. Adicionar membros usando as sessões recebidas
  const membros = [
    { sess: mestreSession,       role: 'mestre',   char_nome: 'Arquimedes', chave: 'mestre'   },
    { sess: sessoes.jogador1,    role: 'jogador',  char_nome: 'Kael',       chave: 'jogador1' },
    { sess: sessoes.jogador2,    role: 'jogador',  char_nome: 'Lyra',       chave: 'jogador2' },
    { sess: sessoes.jogador3,    role: 'jogador',  char_nome: 'Theron',     chave: 'jogador3' },
  ];

  setAuthToken(mestreSession.access_token);
  for (const { sess, role, char_nome, chave } of membros) {
    const tm = Date.now();
    try {
      await sb('rpg_members', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: rpgId,
          player_id: sess.user.id,
          nickname: char_nome.toLowerCase(),
          role,
          linked: char_nome,
        }),
      });
      log.metrica(`adicionar_membro_${chave}`, Date.now() - tm, true);
      log.info(`${chave} adicionado como ${role} → personagem "${char_nome}"`);
    } catch (e) {
      log.metrica(`adicionar_membro_${chave}`, Date.now() - tm, false, e);
      log.warn(`Falha ao adicionar membro ${chave}: ${e.message}`);
    }
  }

  // 4. Criar attr_defs (atributos da campanha)
  log.info('Criando definições de atributos...');
  const attrDefs = [
    { nome: 'Forca',        tipo: 'number', categoria: 'basico',     ordem: 1 },
    { nome: 'Destreza',     tipo: 'number', categoria: 'basico',     ordem: 2 },
    { nome: 'Constituicao', tipo: 'number', categoria: 'basico',     ordem: 3 },
    { nome: 'Inteligencia', tipo: 'number', categoria: 'basico',     ordem: 4 },
    { nome: 'CA',           tipo: 'number', categoria: 'especial',   ordem: 5 },
    { nome: 'Iniciativa',   tipo: 'number', categoria: 'especial',   ordem: 6 },
  ];
  for (const def of attrDefs) {
    try {
      await sb('attr_defs', {
        method: 'POST',
        body: JSON.stringify({ ...def, rpg_id: rpgId }),
      });
    } catch (e) {
      log.warn(`Falha ao criar attr_def "${def.nome}": ${e.message}`);
    }
  }
  log.info(`${attrDefs.length} atributos criados`);

  // 5. Criar personagens
  log.info('Criando personagens...');
  const personagensCriados = {};
  for (const [chave, p] of Object.entries(PERSONAGENS)) {
    const tp = Date.now();
    try {
      const [criado] = await sb('characters', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: rpgId,
          nome: p.nome,
          nivel: p.nivel,
          hp_atual: p.hp,
          hp_max: p.hp_max,
          xp: 0,
          pontos_attr: 0,
          custom_attrs: p.custom_attrs,
          map_positions: {},
          buffs: [],
        }),
      });
      personagensCriados[chave] = criado;
      log.metrica('criar_personagem', Date.now() - tp, true, null, { nome: p.nome });
      log.info(`Personagem criado: ${p.nome} [${p.custom_attrs.tipo_personagem}]`);
    } catch (e) {
      log.metrica('criar_personagem', Date.now() - tp, false, e);
      log.error(`Falha ao criar personagem ${p.nome}: ${e.message}`);
    }
  }

  // Verificação BUG-02: Sombra (pet) — validar que criou corretamente
  const sombra = personagensCriados.sombra;
  if (!sombra?.custom_attrs?.eh_pet || sombra?.custom_attrs?.pet_dono !== 'Theron') {
    log.bug('B02', 'Pet Sombra criado sem eh_pet=true ou pet_dono incorreto', 'moderado', {
      eh_pet: sombra?.custom_attrs?.eh_pet,
      pet_dono: sombra?.custom_attrs?.pet_dono,
    });
  }

  // 6. Criar habilidades
  log.info('Criando habilidades...');
  for (const h of HABILIDADES) {
    const personagem = Object.values(personagensCriados).find(p => p.nome === h.personagem);
    const th = Date.now();
    try {
      await sb('skills', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: rpgId,
          character_id: personagem?.id || null,
          personagem: h.personagem,
          habilidade: h.habilidade,
          formula_dano: h.formula_dano,
          tipo_dano: h.tipo_dano,
          alcance_celulas: h.alcance_celulas,
          alvo_tipo: h.alvo_tipo,
          custo_rsv: h.custo_rsv || 0,
          cooldown_turnos: h.cooldown_turnos || 0,
          tipo_habilidade: h.tipo_habilidade || 'ativa',
          gatilho_tipo: h.gatilho_tipo || null,
          efeitos_bonus: [],
          animacao: { tipo: 'projectile', cor: '#ffd700', icone: '⚔', duracao: 600 },
        }),
      });
      log.metrica('criar_habilidade', Date.now() - th, true, null, { nome: h.habilidade });
    } catch (e) {
      log.metrica('criar_habilidade', Date.now() - th, false, e);
      log.warn(`Falha ao criar habilidade "${h.habilidade}": ${e.message}`);
    }
  }
  log.info(`${HABILIDADES.length} habilidades criadas`);

  // 7. Criar mapa tático com grid e tokens posicionados
  log.info('Criando mapa tático...');
  const mapaId = 'mapa_cripta_' + rpgId.slice(0, 8);
  const posicoes = {
    'Arquimedes':      { col: 5, row: 9 },
    'Kael':            { col: 4, row: 8 },
    'Lyra':            { col: 6, row: 9 },
    'Theron':          { col: 5, row: 8 },
    'Sombra':          { col: 4, row: 9 },
    'Capitão Vorn':    { col: 5, row: 3 },
    'Lobo das Trevas': { col: 6, row: 3 },
  };

  try {
    await sb('mapas', {
      method: 'POST',
      body: JSON.stringify({
        rpg_id: rpgId,
        map_id: mapaId,
        nome: 'Cripta Maldita',
        tipo: 'tatico',
        largura_total: 10,
        altura_total: 10,
        escala_val: 1.5,
        escala_unit: 'm',
        render_data: {
          grid: true,
          paredes: [
            { tipo: 'h', col: 3, row: 5 },
            { tipo: 'h', col: 4, row: 5 },
            { tipo: 'h', col: 5, row: 5 },
            { tipo: 'h', col: 6, row: 5 },
            { tipo: 'v', col: 3, row: 5 },
            { tipo: 'v', col: 7, row: 5 },
          ],
          portas: [
            { col: 5, row: 5, estado: 'fechada', destino_mapa: null },
          ],
          zonas: [],
          fog_of_war: [],
        },
      }),
    });
    log.info(`Mapa tático criado: ${mapaId}`);
  } catch (e) {
    log.warn(`Falha ao criar mapa: ${e.message}`);
  }

  // 8. Posicionar tokens no mapa
  for (const [chave, p] of Object.entries(personagensCriados)) {
    const pos = posicoes[p.nome];
    if (!pos) continue;
    const tp = Date.now();
    try {
      await sb(`characters?rpg_id=eq.${rpgId}&nome=eq.${encodeURIComponent(p.nome)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          active_map_id: mapaId,
          map_positions: { [mapaId]: pos },
        }),
      });
      log.metrica('posicionar_token', Date.now() - tp, true, null, { nome: p.nome, pos });
    } catch (e) {
      log.metrica('posicionar_token', Date.now() - tp, false, e);
      log.warn(`Falha ao posicionar token de ${p.nome}: ${e.message}`);
    }
  }
  log.info('Tokens posicionados no mapa');

  log.info('✅ Setup concluído');
  return {
    rpgId,
    mapaId,
    campanha,
    personagens: personagensCriados,
  };
}

// Tenta criar contas de teste (pode falhar por hCaptcha/confirmação)
export async function tentarCriarContas(contas) {
  log.info('Tentando criar contas de teste (pode falhar por hCaptcha)...');
  const nicknames = {
    mestre:   { email: contas.mestre.email,   senha: contas.mestre.senha,   nick: 'mestre_agente', nome: 'Mestre Agente' },
    jogador1: { email: contas.jogador1.email, senha: contas.jogador1.senha, nick: 'kael_agente',   nome: 'Kael Agente' },
    jogador2: { email: contas.jogador2.email, senha: contas.jogador2.senha, nick: 'lyra_agente',   nome: 'Lyra Agente' },
    jogador3: { email: contas.jogador3.email, senha: contas.jogador3.senha, nick: 'theron_agente', nome: 'Theron Agente' },
  };

  for (const [chave, dados] of Object.entries(nicknames)) {
    try {
      await authSignup(dados.email, dados.senha, dados.nick, dados.nome);
      log.info(`Conta criada: ${dados.email}`);
    } catch (e) {
      if (e.message.includes('already registered') || e.message.includes('already exists')) {
        log.info(`Conta já existe: ${dados.email}`);
      } else if (e.message.includes('captcha') || e.message.includes('hcaptcha')) {
        log.atrito(
          'Signup requer hCaptcha no backend — impossível criar contas automaticamente',
          'alto',
          'Adicionar modo de teste que desabilita hCaptcha (SUPABASE_AUTH_CAPTCHA_ENABLED=false em dev)'
        );
        log.bug('B-AUTH-01', 'hCaptcha obrigatório impede criação de contas automatizadas para testes', 'moderado');
        break;
      } else {
        log.warn(`Erro ao criar conta ${dados.email}: ${e.message}`);
      }
    }
  }
}
