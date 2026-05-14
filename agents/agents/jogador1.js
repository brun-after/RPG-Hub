// agents/jogador1.js
// Agente do Jogador 1 — Kael (Guerreiro) — Desktop
// Usa a interface completa do VTT (não mobile controller)

import { sb, setAuthToken } from '../lib/supabase.js';
import { RealtimeClient } from '../lib/realtime.js';
import { createLogger } from '../lib/logger.js';
import { rolar } from '../lib/dice.js';

export class AgenteJogador1 {
  constructor({ sessao, rpgId, mapaId }) {
    this.sessao      = sessao;
    this.rpgId       = rpgId;
    this.mapaId      = mapaId;
    this.log         = createLogger('jogador1', 'desktop');
    this.realtime    = null;
    this.nome        = 'Kael';
    this.dispositivo = 'desktop';
    this.eventos     = [];
    this._realtimeDelays = [];
    this._lastUpdate = null;
  }

  get token() { return this.sessao?.access_token; }

  async conectar(supabaseUrl, anonKey) {
    this.realtime = new RealtimeClient(supabaseUrl, anonKey, this.token, this.log);

    this.realtime
      .on('characters:UPDATE', ({ record }) => {
        if (this._lastUpdate && record?.nome === this.nome) {
          const delay = Date.now() - this._lastUpdate;
          this._realtimeDelays.push(delay);
          this.log.debug(`[Realtime] Atualização própria recebida em ${delay}ms`);
        }
        this.eventos.push({ tipo: 'char_update', nome: record?.nome, ts: Date.now() });
      })
      .on('batalhas:UPDATE', () => {
        this.eventos.push({ tipo: 'batalha_update', ts: Date.now() });
      });

    await this.realtime.connect();
    this.realtime.subscribeTable('characters', this.rpgId);
    this.realtime.subscribeTable('batalhas', this.rpgId);
    this.realtime.subscribeBroadcast(this.rpgId);
    await this.realtime.waitReady();

    this.log.info('🖥 Jogador 1 (Kael) conectado — desktop VTT completo');
    this.log.metrica('conectar_realtime', 0, true, null, { papel: 'jogador', personagem: 'Kael', dispositivo: 'desktop' });
  }

  // ── Carregamento progressivo da campanha ─────────────────────
  async carregarCampanha() {
    setAuthToken(this.token);
    const t0 = Date.now();
    try {
      const [chars, skills, mapas] = await Promise.all([
        sb(`characters?rpg_id=eq.${this.rpgId}&select=id,nome,hp_atual,hp_max,nivel,custom_attrs,map_positions`),
        sb(`skills?rpg_id=eq.${this.rpgId}&personagem=eq.${encodeURIComponent(this.nome)}&select=*`),
        sb(`mapas?rpg_id=eq.${this.rpgId}&select=map_id,nome,tipo`),
      ]);

      const duracao = Date.now() - t0;
      this.log.metrica('carregar_campanha', duracao, true, null, {
        chars: chars?.length,
        skills: skills?.length,
        mapas: mapas?.length,
      });
      this.log.info(`📦 Campanha carregada em ${duracao}ms: ${chars?.length} personagens, ${skills?.length} habilidades, ${mapas?.length} mapas`);

      // Verificação: tempo de carregamento
      if (duracao > 3000) {
        this.log.atrito(
          `Carregamento da campanha demorou ${duracao}ms — acima do esperado para uma boa experiência`,
          'medio',
          'Verificar se carregamento progressivo está configurado corretamente'
        );
      }

      // Verificar se as habilidades do personagem estão disponíveis
      if (!skills?.length) {
        this.log.bug('B-SKILL-01', `${this.nome} não tem habilidades carregadas`, 'moderado', { skills });
      }

      return { chars, skills, mapas };
    } catch (e) {
      this.log.metrica('carregar_campanha', Date.now() - t0, false, e);
      this.log.error(`Falha ao carregar campanha: ${e.message}`);
      return {};
    }
  }

  // ── Verificar view de personagem (ficha) ─────────────────────
  async verificarFichaPersonagem() {
    setAuthToken(this.token);
    try {
      const chars = await sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.nome)}&select=*`);
      const char = chars?.[0];
      if (!char) {
        this.log.bug('B-CHAR-01', `Personagem ${this.nome} não encontrado na ficha`, 'critico');
        return;
      }

      const atributos = char.custom_attrs?.atributos || {};
      const nAtributos = Object.keys(atributos).length;
      this.log.info(`📋 Ficha de ${this.nome}: HP ${char.hp_atual}/${char.hp_max} | Nível ${char.nivel} | ${nAtributos} atributos`);

      if (nAtributos === 0) {
        this.log.atrito(
          'Personagem não tem atributos definidos — jogador veria ficha vazia',
          'alto',
          'Verificar se attr_defs foi criado corretamente e personagens tem valores em custom_attrs.atributos'
        );
      }
    } catch (e) {
      this.log.error(`Falha ao verificar ficha: ${e.message}`);
    }
  }

  // ── Chat — enviar mensagem como jogador ───────────────────────
  async enviarChat(texto) {
    setAuthToken(this.token);
    const t0 = Date.now();
    try {
      await sb('lore', {
        method: 'POST',
        body: JSON.stringify({
          rpg_id: this.rpgId,
          secao: 'chat_log',
          titulo: this.nome,
          conteudo: JSON.stringify({
            autor: this.nome,
            cor: '#dc2626',
            texto,
            ts: Date.now(),
          }),
        }),
      });
      this.log.metrica('chat_mensagem', Date.now() - t0, true, null, { autor: this.nome });
      this.log.info(`💬 [${this.nome}]: "${texto}"`);
    } catch (e) {
      this.log.metrica('chat_mensagem', Date.now() - t0, false, e);
      this.log.warn(`Falha ao enviar chat: ${e.message}`);
    }
  }

  // ── Verificar delay de realtime ───────────────────────────────
  reportarDelayRealtime() {
    if (this._realtimeDelays.length > 0) {
      const media = Math.round(this._realtimeDelays.reduce((a, b) => a + b, 0) / this._realtimeDelays.length);
      this.log.info(`📡 Delay médio de realtime para ${this.nome}: ${media}ms (${this._realtimeDelays.length} amostras)`);
      this.log.metrica('realtime_delay_avg', media, true, null, { samples: this._realtimeDelays.length, realtime_delay_ms: media });
      if (media > 500) {
        this.log.atrito(
          `Delay de realtime alto: ${media}ms — jogadores podem perceber dessincronia`,
          'medio',
          'Investigar latência da conexão WebSocket com Supabase'
        );
      }
    }
  }

  async desconectar() {
    this.reportarDelayRealtime();
    this.realtime?.disconnect();
    this.log.info('Jogador 1 desconectado');
  }
}
