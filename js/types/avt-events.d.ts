// avt-events.d.ts
// RPG Hub — Payloads dos eventos avt_* (Entrega 4). Campos derivados
// mecanicamente dos params destructurados dos receptores avtReceber*;
// opcionais + index signature de propósito: protegem contra typo de nome
// de evento e documentam o contrato sem travar emissores que enviam
// campos extras. Fonte dos nomes: catálogo AVT_EVENTS (js/core/rtnet.ts).

export {};

declare global {
  interface AvtPayloadMap {
    avt_token_move: { [k: string]: any };
    avt_host_heartbeat: { [k: string]: any };
    avt_combate_inicio: { [k: string]: any };
    avt_batalha_update: { [k: string]: any };
    avt_combate_fim: { batalhaId?: any; faseId?: any; [k: string]: any };
    avt_combate_join: { batalhaId?: any; jogadorId?: any; jogadorNome?: any; initRoll?: any; faseId?: any; [k: string]: any };
    avt_npc_morreu: { npcId?: any; faseId?: any; [k: string]: any };
    avt_npc_perseguindo: { id?: any; targetId?: any; faseId?: any; [k: string]: any };
    avt_npc_respawn: { npcId?: any; x?: any; y?: any; hp?: any; faseId?: any; [k: string]: any };
    avt_convite_combate: { batId?: any; expiry?: any; aliadoIds?: any; faseId?: any; [k: string]: any };
    avt_xp_ganho: { ganhos?: any; [k: string]: any };
    avt_level_up: { charNome?: any; novoNivel?: any; [k: string]: any };
    avt_jogador_morreu: { charNome?: any; xpPerdido?: any; novoXp?: any; nivelAntes?: any; nivelDepois?: any; [k: string]: any };
    avt_jogador_ressurgiu: { charNome?: any; novoHp?: any; [k: string]: any };
    avt_jogador_visivel: { charNome?: any; [k: string]: any };
    avt_jogador_pausado: { charNome?: any; pausado?: any; [k: string]: any };
    avt_char_saiu: { charNome?: any; [k: string]: any };
    avt_skill_selecionada: { atacanteNome?: any; skillNome?: any; alvoNome?: any; [k: string]: any };
    avt_dado_rolado: { atacanteNome?: any; alvoNome?: any; skillNome?: any; dados?: any; total?: any; isCrit?: any; isFumble?: any; [k: string]: any };
    avt_dano_visual: { alvoNome?: any; dano?: any; isCrit?: any; faseId?: any; [k: string]: any };
    avt_dano_visual_batch: { alvoNomes?: any; dano?: any; isCrit?: any; stepMs?: any; faseId?: any; [k: string]: any };
    avt_hp_update: { nome?: any; hp?: any; hpMax?: any; [k: string]: any };
    avt_member_linked: { player_id?: any; linked?: any; [k: string]: any };
    avt_primeiro_ataque: { [k: string]: any };
    avt_skill_anim: { skillId?: any; atacanteNome?: any; alvoNome?: any; animacao?: any; areaCentro?: any; areaLinha?: any; faseId?: any; [k: string]: any };
    avt_attack_anim: { atacanteNome?: any; alvoNome?: any; animacao?: any; delay?: any; faseId?: any; [k: string]: any };
    avt_level_config_update: { config?: any; [k: string]: any };
    avt_state_tick: { [k: string]: any };
    avt_player_action: { [k: string]: any };
    avt_authoritative_apply: { [k: string]: any };
    avt_player_hp: { [k: string]: any };
    avt_player_damage: { [k: string]: any };
    avt_colisao_config: { colisaoJogJog?: any; colisaoJogNpc?: any; [k: string]: any };
    avt_entidade_nova: { entidade?: any; casterId?: any; faseId?: any; [k: string]: any };
    avt_invocacao_destruida: { invId?: any; [k: string]: any };
    avt_move_input: { [k: string]: any };
    avt_item_equipado: { charNome?: any; slotKey?: any; itemId?: any; nomeItem?: any; bonusSnapshot?: any; atributosAtuais?: any; [k: string]: any };
    avt_item_desequipado: { charNome?: any; slotKey?: any; atributosAtuais?: any; [k: string]: any };
    avt_char_update: { charNome?: any; atributos?: any; hpMax?: any; [k: string]: any };
    avt_rsv_update: { nome?: any; atributos?: any; [k: string]: any };
    avt_bau_aberto: { bauId?: any; jogadorNome?: any; faseId?: any; [k: string]: any };
    avt_obj_spawn: { obj?: any; faseId?: any; [k: string]: any };
    avt_obj_pickup: { objId?: any; faseId?: any; [k: string]: any };
    avt_rastro_marcar: { [k: string]: any };
    avt_armadilha_marcar: { trapId?: any; x?: any; y?: any; formula?: any; efeito?: any; expiry_ms?: any; caster?: any; casterId?: any; cor?: any; max?: any; faseId?: any; [k: string]: any };
    avt_armadilha_remover: { trapId?: any; motivo?: any; alvoNome?: any; dano?: any; faseId?: any; [k: string]: any };
    avt_armadilha_obj_disparo: { objId?: any; jogadorNome?: any; dano?: any; modo?: any; rearmarEmMs?: any; faseId?: any; [k: string]: any };
    avt_loja_update: { lojaId?: any; estoque?: any; faseId?: any; [k: string]: any };
    avt_ooc_cooldown: { [k: string]: any };
    avt_inv_update: { [k: string]: any };
    avt_fase_mudou: { [k: string]: any };
    avt_fase_host: { [k: string]: any };
    avt_fase_host_release: { [k: string]: any };
    avt_porta_proxima: { [k: string]: any };
    avt_dungeon_update: { [k: string]: any };
    avt_fase_presenca: { [k: string]: any };
    avt_efeito_anim_start: { animId?: any; posicao?: any; tipo?: any; alvoNome?: any; casterNome?: any; faseId?: any; [k: string]: any };
    avt_efeito_anim_stop: { tipo?: any; alvoNome?: any; faseId?: any; [k: string]: any };
    avt_ping: { [k: string]: any };
    avt_pong: { [k: string]: any };
  }
  type AvtEventName = keyof AvtPayloadMap;

  // Subtipos de combate_evento (broadcast de combate via combateBroadcast /
  // combateReceberBroadcast). União derivada dos call sites — typo no
  // discriminador vira erro de compilação.
  type CombateEventoTipo =
    | 'aguardando_aprovacao'
    | 'ataque_executado'
    | 'ataque_oportunidade'
    | 'batalha_criada'
    | 'batalha_encerrada'
    | 'batalha_estado'
    | 'batalha_pausada'
    | 'batalha_vitoria'
    | 'criativo_animacao'
    | 'dados_rolados'
    | 'dano_bloqueado_imunidade'
    | 'death_save_rolou'
    | 'defesa_resolvida'
    | 'efeito_aplicado'
    | 'efeito_atrasado_disparou'
    | 'empurrao_executado'
    | 'fase_mudou'
    | 'iniciativa_rolada'
    | 'item_dropado'
    | 'log_evento'
    | 'personagem_caiu'
    | 'personagem_estabilizou'
    | 'personagem_morto'
    | 'reacao_confirmada'
    | 'reacao_executada'
    | 'solicitacao_defesa_ativa'
    | 'solicitacao_reacao'
    | 'trigger_mostrar'
    | 'trigger_ocultar'
    | 'vez_passou'
    | 'xp_distribuido';

}
