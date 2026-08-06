// domain.d.ts
// RPG Hub — Formatos de runtime das entidades de domínio (Entrega 3).
//
// Complementa db.d.ts: aqui ficam os shapes que o app monta em memória a
// partir das rows (normalizações canônicas em js/core/supabase.ts) e os
// objetos de estado globais. Interfaces mantêm index signature onde o app
// pendura campos dinâmicos (strict: false; documentar sem travar).
// `Celula` está declarada em js/config.ts (global script).

export {};

declare global {
  // ── Personagem ─────────────────────────────────────────────────
  // custom_attrs (jsonb) após a normalização de supabase.ts:127-136, que
  // espelha nivel/hp_max/xp/pontos_attr das colunas para dentro do objeto.
  interface CustomAttrs {
    atributos?: Record<string, number | string>;
    tipo?: string;                 // 'jogador' | 'npc' | 'criatura'
    tipo_personagem?: string;
    nivel?: number;
    hp_max?: number;
    xp?: number;
    pontos_attr?: number;
    cor?: string;
    img?: string;
    img_url?: string;
    img_retrato?: string;
    classe?: string;
    raca?: string;
    background?: string;
    aparencia?: Aparencia;
    ataque_basico?: any;
    ouro?: number;
    eh_pet?: boolean;
    pet_dono?: string;
    morto?: boolean;
    moribundo?: boolean;
    estabilizado?: boolean;
    skills_ids?: any[];
    skill_numeros?: any;
    equipamento?: any;
    equipamentos?: string;
    companheiro?: string;
    salvaguardas?: any;
    buffs?: any[];
    invocacoes?: any[];
    linhagem_id?: string;
    arc_skill_id?: string;
    npc_generico?: boolean;
    npc_faction?: string;
    chaves_coletadas?: any[];
    owner_nickname?: string;
    visivel_geral?: boolean;
    hp_base_override?: number;
    avt_x?: number;
    avt_y?: number;
    iso_anim?: any;
    iso_token_url?: string;
    topdown_ia?: any;
    [k: string]: any;
  }

  // Personagem em memória = CharacterRow com custom_attrs normalizado.
  interface Personagem extends CharacterRow {
    custom_attrs: CustomAttrs;
  }

  interface Aparencia {
    modo?: string;                 // 'animado' | 'imagem' | …
    animado?: any;
    tamanho?: number;
    partes?: any;
    tints?: any;
    cor_base?: string;
    img_frente?: string;
    img_iso?: string;
    img_token?: string;
    composed_img?: string;
    svg_frente?: string;
    svg_iso?: string;
    equipamentos_visuais?: any;
    modelo_criatura?: string;
    [k: string]: any;
  }

  // ── Mapa ───────────────────────────────────────────────────────
  // Entrada de RPG_DATA.mapas — wrapper montado em supabase.ts:113-116.
  interface MapaWrapper {
    id: string;
    rpg_id: string;
    mapa: MapaInfo;
  }

  interface MapaInfo {
    map_id: string;
    nome: string;
    img_url: string;
    escala_val: number;
    escala_unit: string;
    grid: number;
    parent_map_id: string | null;
    tipo: string;                  // 'geral'|'mundo'|'local'|'tatico'|'fase' (mapaGetTipo normaliza aliases)
    zona_x?: number | null;
    zona_y?: number | null;
    zona_w_percent?: number | null;
    zona_h_percent?: number | null;
    largura_total: number | null;
    altura_total: number | null;
    largura_real?: number | null;
    altura_real?: number | null;
    representar_pct?: number;
    locais: any[];
    render_data: RenderData | null;
    transform3d?: any;
    tiles?: any;
    [k: string]: any;
  }

  // Duas variantes de render_data: mapa plano (paredes/portas/objetos) e
  // mapa de fase (perspective/chunks/spawns). Campos unificados opcionais.
  interface RenderData {
    paredes?: any[];
    portas?: any[];
    objetos?: any[];
    baus?: any[];
    itens_no_chao?: any[];
    spawn_jogadores?: any[];
    entidades?: any[];
    perspective?: { tilt_y?: number; shadow_offset?: number; [k: string]: any };
    chunk_size?: number;
    visao?: any;
    descricao_visual?: any;
    transform3d?: any;
    [k: string]: any;
  }

  // ── Batalha (memória; hydrate snake→camel em supabase.ts:101) ──
  interface ParticipanteBatalha {
    nome: string;
    tipo?: string;
    iniciativa?: number;
    x?: number;
    y?: number;
    isBoss?: boolean;
    classe_aventura?: string;
    [k: string]: any;
  }

  interface Batalha {
    id: string;
    mapa_id: string;
    mapa_nome?: string;
    ativa: boolean;
    // BUG documentado: o hydrate escreve 'pausada', mas combat.ts também
    // lê/escreve o alias 'pausado' — os dois coexistem em runtime.
    pausada?: boolean;
    pausado?: boolean;
    turnoRound?: number;
    fase?: string;                 // 'iniciativa' | 'empate' | 'combate'
    participantes: ParticipanteBatalha[];
    ordemAtual?: any;
    iniciativasRoladas?: Record<string, number>;
    empatados?: string[];
    dadoSel?: any;
    cooldowns?: Record<string, any>;
    recursos_participantes?: Record<string, {
      reacao_disponivel?: boolean;
      slots_defesa_restantes?: number;
      penalidade_defesa_atual?: number;
      [k: string]: any;
    }>;
    [k: string]: any;
  }

  // ── Skill (memória; animacao/efeitos_bonus já parseados) ───────
  interface Skill extends SkillRow {
    animacao: any | null;
    efeitos_bonus: any[];
  }

  // ── Item de catálogo (tipo discrimina campos, ver insertSection) ─
  interface ItemCatalogItem extends ItemCatalogRow {
    visual_config?: any;
    trade_offs?: any;
  }

  // ── RPG_DATA (estado central; criado em getRPGData e preenchido
  //    por _carregarProgressivo; campos tardios são opcionais) ────
  interface RpgData {
    rpgId: string;
    characters: Personagem[];
    skills: Skill[];
    lore: LoreRow[];
    mapas: MapaWrapper[];
    attrDefs: AttrDefRow[];
    linked: string | null;
    membrosLinked: Record<string, any>;
    _carregandoProgressivo?: boolean;
    // Preenchidos depois do boot:
    myRole?: string;               // 'mestre' | 'jogador' | …
    myPermissoes?: any;
    userId?: string;
    rpg?: any;
    theme?: any;
    config?: any;
    level_config?: any;
    [k: string]: any;
  }

  // ── Objetos de estado (state.ts) ───────────────────────────────
  interface MapaState {
    mapaAtualId: string | null;
    mapaGeralId: string | null;
    toolMode: string | null;
    medicaoAtiva: any;
    dragging: any;
    dragTimer: any;
    batalhas: Record<string, Batalha>;
    readonly batalha: Batalha | null;
    [k: string]: any;
  }

  interface FaseState {
    faseAtualId: string | null;
    app: any;                      // PIXI.Application
    worldContainer: any;
    chunks: Record<string, any>;
    entidades: Record<string, any>;
    jogadoresPos: Record<string, any>;
    loopRafId: any;
    iaAtiva: boolean;
    modoMestre: boolean;
    _cameraLerp: { x: number; y: number; zoom: number };
    [k: string]: any;
  }

  interface ChatState {
    msgs: Array<{ nick?: string; cor?: string; ts?: number; [k: string]: any }>;
    aberto: boolean;
    naoLidos: number;
    rpgId: string | null;
    online: Array<{ nick?: string; cor?: string; ts?: number }>;
    _presenceInterval: any;
    _saveTimer?: any;
    _loreId?: string | null;
    _lastSeenAll?: number;
    [k: string]: any;
  }

  interface MapaZoomState {
    zoom: number;
    panX: number;
    panY: number;
    locked: boolean;
    activeChar: string | null;
    modo: string;                  // 'auto' | 'manual'
    _inited?: boolean;
    _keyInited?: boolean;
    _resizeInited?: boolean;
    _autoRafId?: any;
    [k: string]: any;
  }

  // ── Sessão de auth (localStorage rpghub_session) ───────────────
  interface SessaoAuth {
    access_token: string;
    refresh_token?: string;
    nickname?: string;
    user: {
      id: string;
      email?: string;
      user_metadata?: { sfx_biblioteca?: any[]; [k: string]: any };
      [k: string]: any;
    };
    [k: string]: any;
  }
}
