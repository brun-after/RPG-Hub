// agents/jogador3.js
// Agente do Jogador 3 — Theron (Paladino) + Pet Sombra — Mobile Controller Mode
// Especial: tem pet vinculado — verifica que pet age na mesma vez que o dono

import { sb, setAuthToken } from '../lib/supabase.js';
import { RealtimeClient } from '../lib/realtime.js';
import { createLogger } from '../lib/logger.js';

export class AgenteJogador3 {
  constructor({ sessao, rpgId, mapaId }) {
    this.sessao      = sessao;
    this.rpgId       = rpgId;
    this.mapaId      = mapaId;
    this.log         = createLogger('jogador3', 'mobile');
    this.realtime    = null;
    this.nome        = 'Theron';
    this.petNome     = 'Sombra';
    this.dispositivo = 'mobile';
    this.mobileCtrl  = { ativo: true, modo: 'personagem' }; // 'personagem' | 'pet'
    this.eventos     = [];
  }

  get token() { return this.sessao?.access_token; }

  async conectar(supabaseUrl, anonKey) {
    this.realtime = new RealtimeClient(supabaseUrl, anonKey, this.token, this.log);

    this.realtime
      .on('characters:UPDATE', ({ record }) => {
        if (record?.nome === this.nome || record?.nome === this.petNome) {
          this.log.debug(`[Realtime Mobile] ${record.nome} HP → ${record?.hp_atual}`);
        }
      })
      .on('batalhas:UPDATE', () => {
        this.eventos.push({ tipo: 'batalha_update', ts: Date.now() });
      });

    await this.realtime.connect();
    this.realtime.subscribeTable('characters', this.rpgId);
    this.realtime.subscribeTable('batalhas', this.rpgId);
    await this.realtime.waitReady();

    this.log.info('📱 Jogador 3 (Theron + Pet Sombra) conectado — Mobile Controller Mode');
    this.log.metrica('conectar_realtime', 0, true, null, {
      papel: 'jogador', personagem: 'Theron', pet: 'Sombra', dispositivo: 'mobile'
    });
  }

  // ── Verificar aba de pet no mobile ────────────────────────────
  async verificarAbaPet() {
    setAuthToken(this.token);
    try {
      // Busca personagem e pet
      const [theron, sombra] = await Promise.all([
        sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.nome)}&select=hp_atual,hp_max,custom_attrs`),
        sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.petNome)}&select=hp_atual,hp_max,custom_attrs`),
      ]);

      const t = theron?.[0];
      const s = sombra?.[0];

      if (!s) {
        this.log.bug('B02', `Pet ${this.petNome} não encontrado para ${this.nome}`, 'critico', { rpgId: this.rpgId });
        return;
      }

      // Verificar flags de pet
      const ehPet = s.custom_attrs?.eh_pet === true;
      const petDono = s.custom_attrs?.pet_dono;

      if (!ehPet) {
        this.log.bug('B02', `${this.petNome} não tem eh_pet=true no custom_attrs`, 'moderado', { custom_attrs: s.custom_attrs });
      }
      if (petDono !== this.nome) {
        this.log.bug('B02', `pet_dono de ${this.petNome} é "${petDono}" mas deveria ser "${this.nome}"`, 'moderado');
      }

      this.log.info(`🐺 Aba de pet verificada:`);
      this.log.info(`   ${this.nome}: ${t?.hp_atual}/${t?.hp_max} HP`);
      this.log.info(`   ${this.petNome}: ${s?.hp_atual}/${s?.hp_max} HP | eh_pet=${ehPet} | pet_dono=${petDono}`);
      this.log.metrica('verificar_pet', 0, true, null, { ehPet, petDono });

    } catch (e) {
      this.log.error(`Falha ao verificar aba de pet: ${e.message}`);
    }
  }

  // ── Alternância de aba personagem/pet no mobile ───────────────
  alternarAbaMobile() {
    this.mobileCtrl.modo = this.mobileCtrl.modo === 'personagem' ? 'pet' : 'personagem';
    this.log.info(`   📱 [Mobile] Alternando para aba: ${this.mobileCtrl.modo}`);
    this.log.metrica('mobile_alternar_aba', 0, true, null, { modo: this.mobileCtrl.modo });

    if (this.mobileCtrl.modo === 'pet') {
      this.log.atrito(
        'A aba de pet no mobile não é intuitiva — muitos jogadores podem não saber que ela existe',
        'medio',
        'Adicionar tooltip ou tutorial na primeira vez que um personagem com pet entra no modo controle'
      );
    }
  }

  // ── Verificar que pet não tem linha própria de iniciativa ─────
  async verificarPetIniciativa(batalhaId) {
    setAuthToken(this.token);
    try {
      const batalha = await sb(`batalhas?id=eq.${batalhaId}&select=participantes,iniciativas_roladas`);
      const b = batalha?.[0];
      if (!b) return;

      const participantes = b.participantes || [];
      const iniciativas = b.iniciativas_roladas || {};

      const petNaOrdem = participantes.some(p => p.nome === this.petNome);
      const petTemIniciativa = iniciativas[this.petNome] != null;

      if (petNaOrdem) {
        this.log.bug('B02', `Pet ${this.petNome} aparece como participante separado na batalha — deveria compartilhar vez de ${this.nome}`, 'critico', {
          participantes: participantes.map(p => p.nome),
        });
      } else {
        this.log.info(`✅ Pet ${this.petNome} NÃO está na lista de iniciativa — correto (age na vez de ${this.nome})`);
        this.log.metrica('pet_iniciativa_ok', 0, true, null, { pet: this.petNome, dono: this.nome });
      }

      if (petTemIniciativa) {
        this.log.bug('B02', `Pet ${this.petNome} tem iniciativa rolada separada (${iniciativas[this.petNome]}) — não deveria`, 'moderado', { iniciativa: iniciativas[this.petNome] });
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar iniciativa do pet: ${e.message}`);
    }
  }

  // ── Simula D-pad mobile para Theron ──────────────────────────
  async dpadMover(dc, dr, posAtual) {
    setAuthToken(this.token);
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
      this.log.info(`   🗺 [Mobile] Theron moveu: (${posAtual.col},${posAtual.row}) → (${nova.col},${nova.row})`);
      return nova;
    } catch (e) {
      this.log.warn(`D-pad Theron falhou: ${e.message}`);
      return posAtual;
    }
  }

  // ── Verificar que pet se move junto com dono ─────────────────
  async verificarMovimentoPet(posAtual) {
    setAuthToken(this.token);
    try {
      const sombra = await sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.petNome)}&select=map_positions,active_map_id`);
      const pet = sombra?.[0];
      if (!pet) return;

      const posPet = pet.map_positions?.[this.mapaId];
      this.log.info(`   🐺 Posição de ${this.petNome}: (${posPet?.col ?? '?'}, ${posPet?.row ?? '?'}) | Theron está em (${posAtual.col}, ${posAtual.row})`);

      // Pet pode estar em posição diferente do dono (não se move automaticamente)
      // Mas deveria estar próximo na configuração inicial
      const distancia = Math.abs((posPet?.col || 0) - posAtual.col) + Math.abs((posPet?.row || 0) - posAtual.row);
      if (distancia > 3) {
        this.log.atrito(
          `Pet ${this.petNome} está longe do dono ${this.nome} (distância: ${distancia} células) — não tem movimento automático`,
          'baixo',
          'Considerar opção de "seguir dono" para pets no mapa'
        );
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar posição do pet: ${e.message}`);
    }
  }

  // ── Verificar HP do pet após dano ────────────────────────────
  async verificarHpPet() {
    setAuthToken(this.token);
    try {
      const sombra = await sb(`characters?rpg_id=eq.${this.rpgId}&nome=eq.${encodeURIComponent(this.petNome)}&select=hp_atual,hp_max`);
      const pet = sombra?.[0];
      if (!pet) return;

      const pct = Math.round(pet.hp_atual / pet.hp_max * 100);
      this.log.info(`   🐺 ${this.petNome} HP: ${pet.hp_atual}/${pet.hp_max} (${pct}%)`);

      // Se pet morreu, verificar se bloqueia turno de Theron
      if (pet.hp_atual <= 0) {
        this.log.info(`   💀 ${this.petNome} está incapacitado — verificar se ${this.nome} ainda age normalmente`);
        this.log.metrica('pet_incapacitado', 0, true, null, { pet: this.petNome, dono: this.nome });
      }
    } catch (e) {
      this.log.warn(`Falha ao verificar HP do pet: ${e.message}`);
    }
  }

  // ── Enviar chat ───────────────────────────────────────────────
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
            cor: '#d97706',
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
      this.log.warn(`Falha ao enviar chat mobile: ${e.message}`);
    }
  }

  async desconectar() {
    this.mobileCtrl.ativo = false;
    this.realtime?.disconnect();
    this.log.info('Jogador 3 (mobile + pet) desconectado');
  }
}
