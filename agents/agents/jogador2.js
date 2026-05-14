// agents/jogador2.js
// Agente do Jogador 2 — Lyra (Arqueira) — Mobile Controller Mode
// Usa modo de controle: D-pad, botões de ação, acompanha pela TV do mestre

import { sb, setAuthToken } from '../lib/supabase.js';
import { RealtimeClient } from '../lib/realtime.js';
import { createLogger } from '../lib/logger.js';

export class AgenteJogador2 {
  constructor({ sessao, rpgId, mapaId }) {
    this.sessao      = sessao;
    this.rpgId       = rpgId;
    this.mapaId      = mapaId;
    this.log         = createLogger('jogador2', 'mobile');
    this.realtime    = null;
    this.nome        = 'Lyra';
    this.dispositivo = 'mobile';
    this.mobileCtrl  = { ativo: true, ativadoManualmente: false };
    this.eventos     = [];
  }

  get token() { return this.sessao?.access_token; }

  async conectar(supabaseUrl, anonKey) {
    this.realtime = new RealtimeClient(supabaseUrl, anonKey, this.token, this.log);

    this.realtime
      .on('characters:UPDATE', ({ record }) => {
        if (record?.nome === this.nome) {
          this.log.debug(`[Realtime Mobile] ${this.nome} HP → ${record?.hp_atual}`);
        }
        this.eventos.push({ tipo: 'char_update', nome: record?.nome, ts: Date.now() });
      })
      .on('batalhas:UPDATE', () => {
        this.eventos.push({ tipo: 'batalha_update', ts: Date.now() });
      });

    await this.realtime.connect();
    this.realtime.subscribeTable('characters', this.rpgId);
    this.realtime.subscribeTable('batalhas', this.rpgId);
    await this.realtime.waitReady();

    // Simula ativação do modo controle mobile
    this._ativarModoControle();
    this.log.info('📱 Jogador 2 (Lyra) conectado — Mobile Controller Mode ativo');
    this.log.metrica('conectar_realtime', 0, true, null, { papel: 'jogador', personagem: 'Lyra', dispositivo: 'mobile' });
  }

  _ativarModoControle() {
    // Simula: MOBILE_CTRL.ativo = true, sidebar oculta, orientação landscape
    this.mobileCtrl.ativo = true;
    this.log.info('   🎮 Modo Controle Mobile ativado');

    // Verificações UX do modo mobile
    this.log.atrito(
      'Modo controle mobile ativa automaticamente em landscape — pode surpreender jogadores que não esperam',
      'baixo',
      'Adicionar aviso na primeira ativação explicando que o modo foi ativado automaticamente'
    );
  }

  // ── Simula D-pad mobile ───────────────────────────────────────
  async dpadMover(dc, dr, posAtual) {
    setAuthToken(this.token);

    // Simula: _dpadPress(dc, dr) → vibrate(18) → _dpadMoverToken()
    // navigator.vibrate(18) não disponível em Node — apenas log
    this.log.debug(`🕹 D-pad: (${dc >= 0 ? '+' : ''}${dc}, ${dr >= 0 ? '+' : ''}${dr})`);

    const nova = {
      col: Math.max(0, Math.min(9, posAtual.col + dc)),
      row: Math.max(0, Math.min(9, posAtual.row + dr)),
    };

    const t0 = Date.now();
    try {
      await sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.nome)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          active_map_id: this.mapaId,
          map_positions: { [this.mapaId]: nova },
        }),
      });
      this.log.metrica('mobile_mover', Date.now() - t0, true, null, {
        personagem: this.nome,
        de: posAtual,
        para: nova,
        dispositivo: 'mobile',
        via: 'dpad',
      });
      this.log.info(`   🗺 [Mobile] Lyra moveu via D-pad: (${posAtual.col},${posAtual.row}) → (${nova.col},${nova.row})`);
      return nova;
    } catch (e) {
      this.log.metrica('mobile_mover', Date.now() - t0, false, e);
      this.log.warn(`D-pad falhou: ${e.message}`);
      return posAtual;
    }
  }

  // ── Verificar zona de ação mobile (botões direita) ────────────
  async verificarZonaAcoes(batalhaId) {
    setAuthToken(this.token);
    try {
      const batalha = await sb(`batalhas?id=eq.${batalhaId}&select=fase,ordem_atual,participantes`);
      const b = batalha?.[0];
      if (!b) return;

      const partAtual = b.participantes?.[b.ordem_atual];
      const minhavez = partAtual?.nome === this.nome;

      this.log.info(`   📱 [Mobile] Zona de ações: ${minhavez ? '⚔ MINHA VEZ' : `vez de ${partAtual?.nome || '?'}`}`);

      if (minhavez) {
        // Verificar se botões de ataque aparecem quando é a vez do jogador
        this.log.metrica('mobile_verificar_vez', 0, true, null, { minhavez, personagem: this.nome });
      } else {
        // Verificar UX — o jogador mobile deve conseguir ver o estado do combate mesmo fora da vez
        this.log.atrito(
          'No mobile, quando não é a vez do jogador, a zona de ações fica vazia — difícil acompanhar o jogo',
          'medio',
          'Mostrar barra de status do personagem atual ou indicador de quem está atacando'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar zona de ações mobile: ${e.message}`);
    }
  }

  // ── Verificar estado do personagem no centro do mobile ────────
  async verificarEstadoPersonagem() {
    setAuthToken(this.token);
    try {
      const chars = await sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.nome)}&select=hp_atual,hp_max,nivel`);
      const char = chars?.[0];
      if (!char) return;

      const pct = Math.round(char.hp_atual / char.hp_max * 100);
      this.log.info(`   📊 [Mobile] ${this.nome}: ${char.hp_atual}/${char.hp_max} HP (${pct}%) Nível ${char.nivel}`);

      // Verificação: barra de HP visível no modo controle
      if (pct <= 25) {
        this.log.atrito(
          `${this.nome} está com HP crítico (${pct}%) mas no mobile a barra pode não ser visível o suficiente`,
          'medio',
          'Adicionar alerta visual pulsante quando HP < 25% no modo controle mobile'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar estado no mobile: ${e.message}`);
    }
  }

  // ── Enviar chat via mobile ────────────────────────────────────
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
            cor: '#16a34a',
            texto,
            ts: Date.now(),
            via: 'mobile',
          }),
        }),
      });
      this.log.metrica('chat_mensagem', Date.now() - t0, true, null, { autor: this.nome, via: 'mobile' });
      this.log.info(`   💬 [Mobile] [${this.nome}]: "${texto}"`);
    } catch (e) {
      this.log.metrica('chat_mensagem', Date.now() - t0, false, e);
      // Chat via mobile pode ser difícil — teclado virtual ocupa espaço
      this.log.atrito(
        'No modo controle mobile, abrir o chat requer sair do modo e usar o teclado virtual',
        'medio',
        'Adicionar botão de chat rápido no modo controle que não desfaz o layout de controle'
      );
    }
  }

  // ── Verificar carregamento mínimo no mobile ───────────────────
  async verificarCarregamentoMobile() {
    setAuthToken(this.token);
    const t0 = Date.now();
    try {
      // Mobile só precisa do personagem vinculado + batalha ativa — não carrega tudo
      const [char, batalha] = await Promise.all([
        sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.nome)}&select=hp_atual,hp_max,custom_attrs`),
        sb(`batalhas?rpg_id=eq.${this.rpgId}&ativa=eq.true&select=id,fase,ordem_atual,participantes`),
      ]);
      const duracao = Date.now() - t0;
      this.log.metrica('carregar_campanha', duracao, true, null, {
        dispositivo: 'mobile',
        char: !!char?.[0],
        batalha_ativa: !!batalha?.[0],
      });
      this.log.info(`   📱 Carregamento mobile: ${duracao}ms | Batalha ativa: ${batalha?.[0] ? 'SIM' : 'NÃO'}`);

      if (duracao > 2000) {
        this.log.atrito(
          `Carregamento no mobile demorou ${duracao}ms — impacta experiência em conexões móveis`,
          'alto',
          'Reduzir dados carregados no modo mobile — apenas personagem vinculado e batalha ativa'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar carregamento mobile: ${e.message}`);
    }
  }

  async desconectar() {
    this.mobileCtrl.ativo = false;
    this.realtime?.disconnect();
    this.log.info('Jogador 2 (mobile) desconectado');
  }
}
