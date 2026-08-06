// db.d.ts
// RPG Hub — Tipos das linhas do banco (Supabase/PostgREST), Entrega 3.
//
// Derivados do uso real no código (listas de select= e literais de insert em
// js/core/supabase.ts) e do DDL em docs/*.sql. O endpoint OpenAPI do PostgREST
// exige a chave service_role, então a geração automática não está disponível
// com a anon key — ao evoluir o esquema, atualize aqui junto.
//
// Cada Row mantém um index signature: o código acessa colunas além das
// mapeadas e o objetivo desta entrega é documentar sem travar (strict: false).
// Campos jsonb ficam `any` aqui; os formatos de runtime vivem em domain.d.ts.

export {};

declare global {
  // ── Núcleo do RPG ──────────────────────────────────────────────
  interface RpgRegistryRow {
    rpg_id: string;
    name: string;
    owner_id: string;
    config: any;               // jsonb: tema, level_config, permissoes, batalha_estado, arena_estado
    [k: string]: any;
  }

  interface RpgMemberRow {
    rpg_id: string;
    player_id: string;
    linked: string | null;     // nome do personagem vinculado
    session_data: any;         // jsonb por-jogador
    [k: string]: any;
  }

  interface CharacterRow {
    id: string;                // uuid
    rpg_id: string;
    nome: string;
    hp_atual: number;
    hp_max: number;
    xp: number;
    nivel: number;
    pontos_attr: number;
    custom_attrs: any;         // jsonb — shape de runtime: CustomAttrs (domain.d.ts)
    map_positions: any;        // jsonb: { [mapId]: { col, row } }
    active_map_id: string | null;
    buffs: any[];              // jsonb
    [k: string]: any;
  }

  interface MapaRow {
    id: string;
    rpg_id: string;
    map_id: string;
    nome: string;
    img_url: string;
    escala_val: number;
    escala_unit: string;
    grid: number;
    parent_map_id: string | null;
    tipo: string;              // 'geral'|'mundo'|'local'|'tatico'|'fase' (aliases legados — state.ts mapaGetTipo)
    zona_x: number | null;
    zona_y: number | null;
    zona_w_percent: number | null;
    zona_h_percent: number | null;
    largura_total: number | null;
    altura_total: number | null;
    largura_real: number | null;
    altura_real: number | null;
    representar_pct: number;
    locais: any;               // jsonb (array)
    render_data: any;          // jsonb — shape de runtime: RenderData (domain.d.ts)
    [k: string]: any;
  }

  interface SkillRow {
    id: string;
    rpg_id: string;
    personagem: string;
    character_id: string | null;
    habilidade: string;
    efeito: string;
    formula_dano: string | null;
    custo_rsv: string | number | null;
    cooldown_turnos: number;
    tipo_dano: string;         // 'fisico' | tipos customizados do RPG
    alcance_celulas: number | null;
    atributo_base: string | null;
    alvo_tipo: string;         // 'inimigo' | 'aliado' | 'proprio' | 'area' …
    efeitos_bonus: any;        // jsonb (array) — normalizado em runtime
    critico_positivo: string | null;
    critico_negativo: string | null;
    animacao: any;             // jsonb — normalizado em runtime
    [k: string]: any;
  }

  interface LoreRow {
    id: string;
    rpg_id: string;
    secao: string;             // 'mundo' | 'mapa' | 'chat_cache' | seções custom
    titulo: string;
    conteudo: string;
    [k: string]: any;
  }

  interface AttrDefRow {
    id: string;
    rpg_id: string;
    nome: string;
    tipo: string;              // 'text' | 'number' | …
    opcoes: any;
    ordem: number;
    categoria: string;         // 'basico' | …
    [k: string]: any;
  }

  interface AtributosGrupoRow {
    id: string;
    rpg_id: string;
    nome_customizado: string;
    [k: string]: any;
  }

  interface BatalhaRow {
    id: string;
    rpg_id: string;
    mapa_id: string;
    mapa_nome: string;
    ativa: boolean;
    pausada: boolean;
    turno_round: number;
    fase: string;              // 'iniciativa' | 'empate' | 'combate'
    participantes: any[];      // jsonb
    ordem_atual: any;          // jsonb
    iniciativas_roladas: Record<string, number>;
    empatados: string[];
    dado_sel: any;
    cooldowns: Record<string, any>;
    recursos_participantes: Record<string, any>;
    [k: string]: any;
  }

  interface CriativoRow {
    id: string;
    rpg_id: string;
    atacante: string;
    alvo: string;
    descricao: string;
    turno: number;
    status: string;            // 'pendente'|'aprovado_dc'|'dc_rolado_sucesso'|'dc_rolado_narrativo'|'dc_rolado_falha'|'aprovado_aguardando_rolagem'|…
    formula_aprovada: string | null;
    mod_atributo: string | null;
    mod_atributo_pct: number | null;
    custo_cobrado: any;
    animacao: any;             // jsonb
    [k: string]: any;
  }

  // ── Itens e economia ───────────────────────────────────────────
  interface ItemCatalogRow {
    id: string;
    rpg_id: string;
    nome: string;
    tipo: string;              // 'consumivel' | 'equipamento' | 'misc' | …
    descricao: string | null;
    icone: string;
    raridade: string;          // 'comum' | …
    valor_base: number | null;
    efeitos: any;              // jsonb — só quando tipo==='consumivel'
    alvo: string | null;       //         idem
    alcance_m: number | null;  //         idem
    requer_aprovacao: boolean;
    slot_padrao: string | null;        // só quando tipo==='equipamento'
    atributos_bonus: any;              // idem (jsonb)
    tipo_canonico: string | null;
    img_url: string | null;
    nivel_minimo_uso: number;
    unico_no_mundo: boolean;
    peso: number | null;
    [k: string]: any;
  }

  interface InventarioRow {
    id: string;
    rpg_id: string;
    character_id: string;
    item_catalog_id: string;
    quantidade: number;
    equipado: boolean;
    notas: string | null;
    [k: string]: any;
  }

  interface MercadoRow    { id: string; rpg_id: string; [k: string]: any; }
  interface MoedaRow      { id: string; rpg_id: string; [k: string]: any; }
  interface TradeRow      { id: string; rpg_id: string; [k: string]: any; }
  interface LootPendenteRow { id: string; rpg_id: string; [k: string]: any; }
  interface ItemUsoRow    { id: string; rpg_id: string; [k: string]: any; }
  interface InvocacaoRow  { id: string; rpg_id: string; [k: string]: any; }
  interface TabelaRow     { id: string; rpg_id: string; [k: string]: any; }
  interface NpcStateRow   { [k: string]: any; }
  interface PlayerRow     { id: string; nickname?: string; [k: string]: any; }

  // ── docs/*.sql (DDL local) ─────────────────────────────────────
  interface PixiAnimationRow {
    id: string;                // uuid
    rpg_id: string | null;
    criado_por: string | null; // uuid → auth.users
    global: boolean;
    nome: string;
    descricao: string | null;
    behavior: string;
    duracao_ms: number | null;
    config_json: any;          // jsonb
    preview_url: string | null;
    criado_em: string;         // timestamptz
    [k: string]: any;
  }

  interface RpgSessionStateRow {
    rpg_id: string;            // uuid PK → rpg_registry
    host_user_id: string | null;
    snapshot: any;             // jsonb
    snapshot_ver: number;
    updated_at: string;
    [k: string]: any;
  }

  interface AvtSessionStateRow {
    session_key: string;       // text PK
    host_user_id: string | null;
    snapshot: any;             // jsonb
    snapshot_ver: number;
    updated_at: string;
    [k: string]: any;
  }
}
