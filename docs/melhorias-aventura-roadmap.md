# Modo Aventura — melhorias: o que entrou e o que fica planejado

Entrega derivada da exploração completa do Modo Aventura (agosto/2026) e das
decisões do dono do projeto:

- ✅ **Armadilhas**: aprovadas nas duas formas — skill do jogador e objeto
  posicionável pelo mestre na criação/edição de fase.
- ❌ **Puzzles**: descartados — não combinam com o estilo "enxame" do jogo.
- ✅ **NPC amigável**: somente **loja** ou **invocações** (invocações já
  existiam via `avtInvocar`); nada de diálogo/quest-giver.

## Implementado nesta entrega

| Frente | Resumo |
|---|---|
| Correções | Escape de HTML centralizado (`_escHtml`) nos renders de itens/skills; desequipar sem snapshot invertendo bônus `pct` corretamente; rollback local quando equipar/desequipar falha no banco; Guia corrigido (setas = alternar alvo); comentários do rtnet no tick real de 100ms |
| 🪤 Armadilha-skill | Tipo `armadilha` no `EFFECT_REGISTRY`; jogador arma numa célula (mira própria, custo/cooldown), inimigo pisa e dispara (one-shot, dano por fórmula + DOT/Stun opcional); limite simultâneo por caster; expiração; sync `avt_armadilha_marcar`/`avt_armadilha_remover`; editor de skills com dice builder |
| 🪤 Armadilha do mestre | Objeto `armadilha_mestre` em `render_data.objetos`: oculto dos jogadores (marcador só para o mestre), dispara quando um jogador pisa (cliente do próprio jogador decide, padrão da coleta); one-shot ou rearme após N segundos; ferramentas completas na aba Mapa |
| 🛒 Loja | Objeto `loja` com estoque configurável; cartão 🛒 no painel quando adjacente; modal Comprar/Vender com estorno em falha; preços por `valor_base` do catálogo (agora carregado e editável); venda a `loja_revenda_pct` (padrão 50%, aba Balanceamento); sync `avt_loja_update` — **primeiro dreno de ouro do jogo** |
| UX | Overlay de pausa in-game (⏸/Esc) com Config+Guia sem derrubar RTNet; Esc contextual (cancela mira antes de pausar); aria-labels no header; Guia com seções de armadilhas e loja |
| Rede | `avtReceberObjSpawn` agora faz **merge por id** (reposicionar/editar objetos sincroniza em jogo); RTT ao host visível no indicador do header (`🟢 42ms` + qualidade no tooltip) |
| Higiene | `_avtCarregarDados` zera células de rastro/armadilha e relógios de varredura ao carregar (re-entrada/troca de RPG não herda runtime velho) |
| Testes | `tests/sim/armadilha.test.ts` (15 cenários) e `tests/sim/loja.test.ts` (13 cenários) no harness determinístico; fixture ganhou skill 103 e catálogo com preços |

## Já resolvido no código (constava como pendência em docs/revisao-sincronizacao.md)

- **(E) `seq` escopado por RPG** — `_avtSeqKey` prefixa as chaves com `rpgId`
  e `entrarAventura` zera `_avtTokenSeq`/`_avtRxMove` ao trocar de aventura.
- **(F) Métricas de latência** — RTT medido por ping/pong de 2s, exposto no
  overlay `AVT_PERF` e agora também no indicador do header.

## Planejado — PRs próprios (multiplayer, alto impacto/risco)

### (C) Snapshot delta-comprimido
Hoje o `AVT_STATE` inteiro é serializado a cada 15s por cliente-host
(dezenas de KB × jogadores → escrita cara no Supabase).
Proposta: manter um snapshot-base por sessão e gravar apenas o diff
(`jsondiffpatch` ou diff caseiro por entidade, como o state tick v2 já faz em
memória), com keyframe completo a cada N minutos ou na troca de host.
Pré-requisito: versionar o formato em `avt_session_state` para reidratação de
late-joiner tolerar base+diffs. Riscos: corrida entre host novo/antigo no
takeover (>30s) — reusar a regra atual de takeover antes do primeiro diff.

### (D) Fonte única de estado de NPC
NPC ainda propaga por dois canais (broadcasts `avt_npc_*` + Postgres Changes
de `npc_state`), com kill-switch `npcSyncEnabled`. Proposta: promover o state
tick (10 Hz, autoridade por fase) a fonte única em P2P e usar `npc_state`
apenas como persistência fria (respawn/reidratação), removendo os broadcasts
redundantes um a um atrás de flag — na ordem: posição → hp → morte/respawn.
Cada etapa validada no harness sim (digest entre host e clone) antes da
próxima.

## Backlog de conteúdo (aguardando priorização do dono)

Compatíveis com o estilo enxame; nenhum exige diálogo/puzzle:

1. **Variedade de bosses** — hoje só existe o preset `boss`. Proposta barata:
   2-3 presets extras (ex.: `boss_bruto` lento com empurrão em área,
   `boss_invocador` que usa `invocar_catalogo`, `boss_veloz` com dash) usando
   apenas efeitos que o `EFFECT_REGISTRY` já suporta + `npc_classes` editável
   que o mestre já tem. Sem sistema novo — só presets + skills de NPC.
2. **Defesa/armadura** — todo ataque acerta (d20 só modula crítico). Proposta
   mínima: atributo derivado `defesa` (base por classe + bônus de
   `atributos_bonus` dos equipamentos) aplicado como redução plana no dano
   final, clamp ≥1. Não mexe na tabela de crítico nem no ritmo do enxame, e dá
   função aos slots de armadura que hoje são só stats.
3. **Eventos de onda ("enxame de verdade")** — gatilho por sala: pisar num
   marcador (reuso do modelo de armadilha do mestre) spawna N inimigos do
   preset X por M rodadas, com recompensa no fim (baú/orbes via
   `_avtSpawnObjMapa`). Reusa dynamic spawns + presets; vira o "evento de
   sala" que falta entre um boss e outro.
4. **Loja itinerante** (extensão da loja) — objeto `loja` com
   `fases_visiveis[]` ou movimento entre fases a cada N minutos, para
   incentivar exploração de fases antigas.

## Notas de dívida conhecida (fora do escopo desta entrega)

- Dispatcher de eventos duplicado entre `rtnet.ts` e `realtime.ts` (item B do
  doc de revisão) — refactor só com burn-in de e2e.
- Dispatch de efeitos de skill replicado em ~10 call sites em `aventura.ts`;
  um dispatcher único por tipo reduziria o custo de cada efeito novo (ficou
  evidente ao adicionar `armadilha`).
- Acessibilidade: cobertura aria ainda é só nos controles primários do header
  e na pausa; painéis/HUD seguem sem navegação por teclado.
