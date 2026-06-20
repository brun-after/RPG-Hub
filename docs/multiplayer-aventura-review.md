# Revisão do Multiplayer — Modo Aventura

Documento de revisão do sistema de sincronização em tempo real do Modo Aventura,
produzido junto com a correção dos bugs de "pausado indevido" e rubber-banding.

## Arquitetura (resumo)

- **Transporte:** mesh WebRTC DataChannel (≤6 jogadores) com sinalização e fallback via
  Supabase Realtime. Núcleo em `js/core/rtnet.js`.
- **Modelo:** host-autoritativo. O host emite `avt_state_tick` a cada 100 ms com posição,
  HP, status e flags de todas as entidades. Lógica/handlers em `js/systems/aventura.js`.
- **Eleição de host:** modo `voluntary` — o primeiro a entrar não vira host
  automaticamente; é eleito por clique ou (agora) por **auto-promoção em sessão solo**.

## Correções entregues nesta revisão

### 1. Falso "pausado" (inclusive solo)
- **Causa:** `_avtVerificarInatividade()` decidia a auto-suspensão por **presença de
  chat** (`CHAT._lastSeenAll[membro.nickname]`), não por atividade de jogo. Jogar sem
  digitar no chat, ou divergência de chave `nickname`, derrubava `algumAtivo` para falso
  e suspendia o jogo. Em `voluntary`, o solo também ficava preso na sala de espera.
- **Correção:**
  - Carimbo de atividade real de jogo (`AVT_STATE._ultimaAtividade`) atualizado em
    movimento/ação do jogador local (`_avtMarcarAtividade`).
  - `_avtVerificarInatividade()` considera ativo quem teve atividade de jogo **ou**
    presença de chat recente; **solo nunca auto-suspende**.
  - `rtnet.js`: auto-promoção a host quando não há outros peers nem host após a janela.

### 2. Rubber-banding / movimento impossível em multiplayer
- **Causa:** o não-host previa o movimento localmente, mas a reconciliação do tick puxava
  o **próprio** personagem de volta à posição (atrasada) do host a cada 100 ms
  (`isMe && maxDiv > 0.5`), brigando com a predição local por toda a latência de
  round-trip → oscilação.
- **Correção — reconciliação autoritativa por sequência de input** (padrão de produção):
  - Cada passo do próprio personagem recebe um `seq` monotônico, é aplicado localmente e
    enviado **imediatamente** ao host (`avt_move_input` com `seq`), com buffer
    `ent._pendingInputs`.
  - O host valida colisão e **confirma o `seq`** (aceito ou rejeitado) em `ent._ackSeq`,
    ecoado no tick (`ackSeq`).
  - O cliente descarta inputs `seq <= ackSeq`; enquanto houver inputs em voo, **confia
    100% na predição local** (sem correção). Sem inputs pendentes, fecha o drift contra o
    host. Divergência muito grande (teleporte) força resync.
  - **Escala:** maior latência apenas aumenta os inputs não confirmados em voo, sem
    rubber-banding, independentemente do número de peers.

## Efetividade dos pontos JÁ cobertos

| Sistema | Mecanismo | Avaliação |
|---|---|---|
| Posição de jogador (próprio) | predição + reconciliação por `seq` | **Efetivo após esta correção** (antes: rubber-banding) |
| Posição de jogadores remotos / NPCs | tick + dead-band/lerp | Efetivo (host-autoritativo) |
| HP / dano | tick + `avt_hp_update` + `avt_dano_visual` | Efetivo; anti-thrash de 1,5 s adequado |
| Combate (início/turnos/iniciativa/fim, dados) | snapshots + eventos confiáveis | Efetivo |
| Equipamento / atributos | `avt_item_*` / `avt_char_update` | Efetivo |
| XP / level / morte / ressurreição | eventos confiáveis + persistência | Efetivo |
| Baús / colisão / edição de mapa | eventos confiáveis (host/mestre) | Efetivo |
| Pausa / host | inatividade + watchdog + auto-promoção | **Efetivo após esta correção** |

## Pontos antes descobertos — agora COBERTOS

| Sistema | Estado anterior | Cobertura implementada |
|---|---|---|
| Rastro (Persona/Anima) | Aplicação local; quebrado em P2P (células do não-host nunca chegavam ao host) | **Host-autoritativo**: `avt_rastro_marcar` propaga as células; dano aplicado só pela autoridade (`_avtRastroChecarEntrada` gated por `_avtEhAutoridade`); `_rastroCells` incluído no snapshot |
| Flag de NPC dominado (fora de combate) | Só no host (em combate já vinha no `avt_batalha_update`) | `dominado`/`donoNome`/`tipo`/`cor` propagados no `avt_state_tick` e aplicados a NPCs |
| Timers de paciência de NPC | `dt` local por cliente (HUD podia divergir) | Contagem já era host-autoritativa; agora o tempo restante (`pat`) viaja no tick → HUD do não-host espelha o host |
| Cooldowns OOC de skills | Só via snapshot (15 s) | `avt_ooc_cooldown` emitido a cada uso (`_avtSetOocCooldown`), aplicação monotônica no receptor |
| Regen de recursos (mana/PSI fora de combate) | Só HP era propagado; mana ficava dessincronizada | `_avtRecuperarPorMovimento` agora também emite `avt_rsv_update` quando recursos mudam |
| Inventário/itens | Cache `AVT_INV` por cliente; mudanças não invalidavam outros clientes | `avt_inv_update` (com `ouro` opcional) emitido em conceder/remover/consumir/ouro/baú; receptor recarrega do banco e re-renderiza painéis abertos |

Eventos novos registrados em `js/core/rtnet.js`: `avt_rastro_marcar`, `avt_ooc_cooldown`,
`avt_inv_update` (todos `reliable`, `persist: never`). Dominado e paciência viajam dentro
do `avt_state_tick` existente.

### Padrão usado
Mesmo modelo host-autoritativo já estabelecido: estado mutável é propagado por evento
confiável dedicado ou pelo tick autoritativo; o banco permanece como fonte da verdade para
inventário (o evento apenas dispara reload). Reuso de `AVT_HANDLER_MAP`/`EVENT_OPTS`
(`rtnet.js`) e dos renderizadores/persistência já existentes.
