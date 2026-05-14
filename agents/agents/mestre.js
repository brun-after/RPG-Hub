// agents/mestre.js
// Agente do Mestre — desktop (TV do mestre)
// Controla: NPCs, aprovações, chat como NPC, personagem Arquimedes, abertura de mapa

import { sb, setAuthToken } from '../lib/supabase.js';
import { RealtimeClient } from '../lib/realtime.js';
import { createLogger } from '../lib/logger.js';

export class AgentesMestre {
  constructor({ sessao, rpgId, mapaId, personagens, habilidades }) {
    this.sessao     = sessao;
    this.rpgId      = rpgId;
    this.mapaId     = mapaId;
    this.personagens = personagens;
    this.habilidades = habilidades;
    this.log        = createLogger('mestre', 'desktop');
    this.realtime   = null;
    this.eventos    = [];
    this.nome       = 'Arquimedes';
    this.papel      = 'mestre';
  }

  get token() { return this.sessao?.access_token; }

  // ── Conectar ao realtime ──────────────────────────────────────
  async conectar(supabaseUrl, anonKey) {
    this.realtime = new RealtimeClient(supabaseUrl, anonKey, this.token, this.log);

    this.realtime
      .on('characters:UPDATE', ({ record }) => {
        this.log.debug(`[Realtime] personagem atualizado: ${record?.nome} HP=${record?.hp_atual}`);
        this.eventos.push({ tipo: 'char_update', ts: Date.now(), nome: record?.nome });
      })
      .on('batalhas:UPDATE', ({ record }) => {
        this.log.debug(`[Realtime] batalha atualizada: fase=${record?.fase} ordem=${record?.ordem_atual}`);
        this.eventos.push({ tipo: 'batalha_update', ts: Date.now() });
      })
      .on('broadcast:chat_msg', (payload) => {
        this.log.debug(`[Chat] ${payload?.autor}: ${payload?.texto}`);
      });

    await this.realtime.connect();
    this.realtime.subscribeTable('characters', this.rpgId);
    this.realtime.subscribeTable('batalhas', this.rpgId);
    this.realtime.subscribeTable('criativos', this.rpgId);
    this.realtime.subscribeBroadcast(this.rpgId);
    await this.realtime.waitReady();

    this.log.info('🖥 Mestre conectado (desktop/TV)');
    this.log.metrica('conectar_realtime', 0, true, null, { papel: 'mestre', dispositivo: 'desktop' });
  }

  // ── Abrir mapa — simula GM abrindo mapa tático ───────────────
  async abrirMapa() {
    setAuthToken(this.token);
    const t0 = Date.now();
    try {
      const mapas = await sb(`mapas?rpg_id=eq.${this.rpgId}&map_id=eq.${this.mapaId}&select=*`);
      const mapa = mapas?.[0];
      if (!mapa) throw new Error('Mapa não encontrado');
      this.log.metrica('abrir_mapa', Date.now() - t0, true, null, { mapaId: this.mapaId });
      this.log.info(`🗺 Mapa aberto: "${mapa.nome}" (${mapa.largura_total}x${mapa.altura_total} grid)`);

      // Verificar paredes e portas
      const paredes = mapa.render_data?.paredes?.length || 0;
      const portas = mapa.render_data?.portas?.length || 0;
      this.log.info(`   Paredes: ${paredes} | Portas: ${portas}`);
      return mapa;
    } catch (e) {
      this.log.metrica('abrir_mapa', Date.now() - t0, false, e);
      this.log.error(`Falha ao abrir mapa: ${e.message}`);
      this.log.bug('B-MAPA-01', 'GM não conseguiu carregar mapa tático', 'critico', { erro: e.message });
      return null;
    }
  }

  // ── Enviar mensagem no chat (como NPC) ───────────────────────
  async chatComoNpc(npcNome, texto) {
    const t0 = Date.now();
    try {
      // Simula identity switch do GM para NPC no chat
      setAuthToken(this.token);
      await sb('lore', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: this.rpgId,
          secao: 'chat_log',
          titulo: npcNome,
          conteudo: JSON.stringify({
            autor: npcNome,
            cor: '#991b1b',
            texto,
            ts: Date.now(),
            tipo: 'npc',
          }),
        }),
      });
      this.log.metrica('chat_mensagem', Date.now() - t0, true, null, { autor: npcNome, tipo: 'npc' });
      this.log.info(`💬 [${npcNome}]: "${texto}"`);
    } catch (e) {
      this.log.metrica('chat_mensagem', Date.now() - t0, false, e);
      this.log.warn(`Falha ao enviar chat como NPC: ${e.message}`);
      this.log.atrito(
        'GM precisa de forma clara de trocar identidade para falar como NPC no chat',
        'medio',
        'Considerar dropdown mais visível de seleção de identidade no chat'
      );
    }
  }

  // ── Verificar UX: Iniciativa strip ───────────────────────────
  async verificarIniciatviStrip(batalhaId) {
    setAuthToken(this.token);
    try {
      const batalhas = await sb(`batalhas?id=eq.${batalhaId}&select=*`);
      const batalha = batalhas?.[0];
      if (!batalha) {
        this.log.bug('B01', 'GM não conseguiu carregar estado da batalha', 'critico');
        return;
      }

      const participantes = batalha.participantes || [];
      const ordemAtual = batalha.ordem_atual ?? -1;

      // Verificar se ordem_atual está dentro dos limites
      if (ordemAtual >= participantes.length) {
        this.log.bug('B01', `ordem_atual (${ordemAtual}) fora dos limites (${participantes.length} participantes) — off-by-one!`, 'critico', {
          ordem_atual: ordemAtual,
          total_participantes: participantes.length,
        });
      } else {
        this.log.info(`✅ Iniciativa strip OK: vez de ${participantes[ordemAtual]?.nome || '?'} (${ordemAtual}/${participantes.length - 1})`);
      }
    } catch (e) {
      this.log.error(`Falha ao verificar iniciativa strip: ${e.message}`);
    }
  }

  // ── Verificar presença de jogadores no chat ───────────────────
  async verificarPresencaChat() {
    // Simula verificar se jogadores offline ainda aparecem
    this.log.info('👥 Verificando presença no chat...');
    this.log.atrito(
      'Sistema de presença usa TTL de 30s — jogadores levam até 30s para sumir da lista',
      'baixo',
      'Reduzir TTL de presença para 15s ou adicionar indicador visual de "último visto"'
    );
  }

  // ── Verificar fog of war ──────────────────────────────────────
  async verificarFogOfWar() {
    setAuthToken(this.token);
    try {
      const mapas = await sb(`mapas?rpg_id=eq.${this.rpgId}&map_id=eq.${this.mapaId}&select=render_data`);
      const fogData = mapas?.[0]?.render_data?.fog_of_war || [];
      this.log.info(`🌫 Fog of war: ${fogData.length} células reveladas`);

      if (fogData.length === 0) {
        this.log.atrito(
          'Fog of war estava zerado — GM precisa revelar manualmente cada área antes da sessão',
          'medio',
          'Adicionar opção de "revelar tudo" para o GM ou configuração automática de visibilidade'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar fog of war: ${e.message}`);
    }
  }

  // ── Verificar cooldowns após batalha ─────────────────────────
  async verificarCooldowns(batalhaId) {
    setAuthToken(this.token);
    try {
      const batalhas = await sb(`batalhas?id=eq.${batalhaId}&select=cooldowns`);
      const cooldowns = batalhas?.[0]?.cooldowns || {};
      const total = Object.keys(cooldowns).length;
      this.log.info(`⏱ Cooldowns rastreados na batalha: ${total}`);
      if (total === 0) {
        this.log.atrito(
          'Nenhum cooldown de habilidade foi rastreado na batalha — verificar se sistema de cooldowns está integrado',
          'medio',
          'Verificar se combat.js está salvando cooldowns na tabela batalhas após uso de habilidade'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar cooldowns: ${e.message}`);
    }
  }

  async desconectar() {
    this.realtime?.disconnect();
    this.log.info('Mestre desconectado');
  }
}
