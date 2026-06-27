# Revisão da Sincronização Host ↔ Players — Propostas de Melhoria

Complementa `docs/multiplayer-aventura-review.md` (que cobre a arquitetura e as correções de
"pausado indevido" e rubber-banding). Este documento foca em **eficiência e robustez** da
camada de sincronização, separando o que foi aplicado nesta entrega do que fica proposto.

## Panorama (recapitulação)

- **Transporte:** mesh WebRTC DataChannel (≤6 jogadores), dois canais por peer — `game`
  (confiável/ordenado) e `fast` (não confiável) — com sinalização e fallback via Supabase
  Realtime. Núcleo em `js/core/rtnet.js`; fallback/outbox em `js/core/realtime.js`.
- **Modelo:** host-autoritativo. `avt_state_tick` a 10 Hz com posições/HP/status; reconciliação
  do próprio personagem por `seq`/`ackSeq`; isolamento por fase em todos os handlers.
- **Recuperação:** heartbeat de host (5 s) + watchdog (15 s); snapshot completo a 15 s;
  ressync periódico do não-host (10 s); reconexão WebSocket com backoff exponencial.

## Aplicado nesta entrega (baixo risco)

### 1. Helper de isolamento de fase — `_avtMinhaFase(faseId)`
O padrão `faseId != null && faseId !== (AVT_STATE._faseAtualId || 'principal')` estava
duplicado em `avtReceberMovimento`, `avtAplicarSnapshotMerge` e `avtReceberStateTick`.
Centralizado em `_avtMinhaFase()` (`js/systems/aventura.js`). Refator puro, comportamento
idêntico; reduz risco de divergência se a regra de fase mudar no futuro.

### 2. Jitter no ressync periódico
Todos os não-host pediam o snapshot ao host no mesmo intervalo fixo de 10 s (pico de carga no
host com 6 jogadores). Agora o intervalo recebe um jitter de ±2,5 s por cliente
(`js/core/rtnet.js`, `periodicSyncTimer`), espalhando os pedidos no tempo. Custo zero, sem
mudança de protocolo.

## Propostas (não aplicadas — risco/benefício ou esforço maior)

| # | Proposta | Por que não agora | Benefício |
|---|---|---|---|
| A | **Batch de dano em área** num único `avt_dano_visual_batch` | Os broadcasts de AoE são **propositalmente escalonados** (`setTimeout(..., idxA*80)`) para que cada número de dano apareça 80 ms após o anterior, igual em todos os peers. Unificar quebraria esse timing visual ("sem perder nada"). Exigiria enviar a cadência no payload. | Menos mensagens por conjuração em área |
| B | **Dispatcher único** RTNet/Realtime | Há lógica de roteamento duplicada entre `rtnet.js` e `realtime.js` (fallback). Unificar é um refactor estrutural com risco de regressão no fallback. | Manutenção/consistência |
| C | **Snapshot delta-compresso** | Hoje salva o `AVT_STATE` inteiro a cada 15 s (dezenas de KB × jogadores → escrita cara no Supabase). Delta exige versionamento de estado e reconciliação cuidadosa. | Custo de banco e latência |
| D | **Fonte única de estado de NPC** | NPC propaga por broadcasts (`avt_npc_*`) **e** por Postgres Changes — autoridade dupla. Consolidar numa fonte reduz complexidade, mas mexe num caminho sensível de combate. | Consistência |
| E | **Contadores de `seq` escopados por RPG** | `window._avtTokenSeq` / `window._avtRxMove` são globais; trocar de RPG sem reload pode colidir `seq`. Precisa de ciclo de vida (criar/limpar) por sessão. | Robustez em troca de sala |
| F | **Métricas de latência (ping/pong)** | Sem medição de RTT, "está travando" é difícil de diagnosticar. Adicionar ping no heartbeat + UI de diagnóstico é seguro, mas é feature nova. | Observabilidade |

### Recomendação de priorização
F (observabilidade) e E (robustez) são os próximos passos de menor risco; C tem o maior
retorno de custo de infra mas exige projeto cuidadoso; A só vale se a cadência visual for
preservada (enviar `stepMs` no batch).
