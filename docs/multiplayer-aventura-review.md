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

## Pontos DESCOBERTOS — plano de cobertura (não implementado nesta entrega)

| Sistema | Estado atual | Plano de cobertura |
|---|---|---|
| Inventário/itens (pickup, drop, troca entre jogadores) | Só equipamento sincroniza; concessões do mestre são locais | Eventos `avt_item_*` autoritativos pelo host (pegar/soltar/transferir) com persistência e validação de posse |
| Cooldowns OOC de skills | Host rastreia `_oocCooldowns` localmente | Incluir cooldowns por entidade no tick ou evento dedicado; cliente apenas exibe |
| Regen de recursos (mana/PSI fora de combate) | Sincronizado só em mudança | Enviar baseline + taxa no snapshot/tick para convergência |
| Flag de NPC dominado | Só no host | Propagar flag de domínio no tick (já há flags `atravessar`/`fantasma` como padrão) |
| Rastro (Persona) | Aplicação local em cada cliente | Tornar autoritativo via host + incluir células no snapshot |
| Timers de paciência de NPC | `dt` local por cliente | Canonizar no host e enviar tempo restante no tick |

### Prioridade sugerida
1. **Inventário/itens** (maior impacto de jogo e risco de divergência de estado).
2. **Cooldowns OOC** e **regen de recursos** (afetam decisões de combate fora de turno).
3. **Paciência de NPC**, **flag de dominado**, **rastro** (refinamentos de consistência).

### Padrão recomendado para os gaps
Seguir o mesmo modelo host-autoritativo já usado: mutação proposta pelo não-host →
`avt_player_action`/evento dedicado → host valida e aplica → propaga via tick/evento
confiável + persistência. Reusar `_avtAcaoParaHost` (`aventura.js`) e o mapa de handlers
`AVT_HANDLER_MAP` (`rtnet.js`).
