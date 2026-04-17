# Mapeamento de Funções — RPG Hub

> Documento gerado progressivamente. Cada seção cobre um arquivo JS, mapeando suas funções, o que fazem, e quais dependências externas (funções ou variáveis definidas em outros arquivos) cada uma requer.

---

## Índice de Arquivos

| # | Arquivo | Linhas | Status |
|---|---------|--------|--------|
| 1 | `js/init.js` | 5 | ✅ Mapeado |
| 2 | `sw.js` | 6 | ✅ Mapeado |
| 3 | `js/core/events.js` | 50 | ✅ Mapeado |
| 4 | `js/core/utils.js` | 64 | ✅ Mapeado |
| 5 | `js/config.js` | 91 | ✅ Mapeado |
| 6 | `js/systems/rest.js` | 98 | ✅ Mapeado |
| 7 | `js/systems/npcs.js` | 176 | ✅ Mapeado |
| 8 | `js/core/realtime.js` | 269 | ✅ Mapeado |
| 9 | `js/chat/chat.js` | 324 | ✅ Mapeado |
| 10 | `js/combat/animations.js` | 382 | ✅ Mapeado |
| 11 | `js/maps/camera.js` | 394 | ✅ Mapeado |
| 12 | `js/systems/lore.js` | 417 | ✅ Mapeado |
| 13 | `js/state.js` | 441 | ✅ Mapeado |
| 14 | `js/auth/auth.js` | 482 | ✅ Mapeado |
| 15 | `js/core/supabase.js` | 504 | ✅ Mapeado |
| 16 | `js/characters/characters.js` | 581 | ✅ Mapeado |
| 17 | `js/characters/skills.js` | 627 | ✅ Mapeado |
| 18 | `js/hub/hub.js` | 2300 | ✅ Mapeado |
| 19 | `js/systems/inventory.js` | 2222 | ✅ Mapeado |
| 20 | `js/ui/tabs.js` | 2229 | ✅ Mapeado |
| 21 | `js/systems/creative.js` | 2456 | — |
| 22 | `js/hub/import.js` | 2676 | — |
| 23 | `js/systems/arena.js` | 3720 | — |
| 24 | `js/combat/combat.js` | 4321 | — |
| 25 | `js/ui/modals.js` | 2591 | — |
| 26 | `js/systems/catalog.js` | 9233 | — *(2 partes)* |
| 27 | `js/maps/maps.js` | 10012 | — *(2 partes)* |

---

## 1. `js/init.js`

**Linhas:** 5  
**Descrição geral:** Marcador de inicialização da aplicação. Emite um log no console confirmando que todos os módulos foram carregados via tags `<script>` no HTML.

### Funções definidas

*Nenhuma.*

### Variáveis/constantes definidas

*Nenhuma.*

### Dependências externas

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `console.log` | API nativa | Browser |

### Observações

Arquivo de sinalização: é o último `<script>` carregado no `index.html`, indicando que todos os outros módulos já estão disponíveis no escopo global.

---

## 2. `sw.js`

**Linhas:** 6  
**Descrição geral:** Service Worker mínimo para habilitar a instalação do app como PWA. Não implementa cache — todas as requisições vão direto à rede.

### Funções definidas

*Nenhuma função nomeada. Dois listeners anônimos registrados via `self.addEventListener`:*

| Evento | Linha | O que faz |
|--------|-------|-----------|
| `install` | 5 | Chama `self.skipWaiting()` para ativar o SW imediatamente, sem esperar o ciclo normal |
| `activate` | 6 | Chama `self.clients.claim()` para que o SW assuma controle das abas abertas sem necessidade de reload |

### Variáveis/constantes definidas

*Nenhuma.*

### Dependências externas

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `self.addEventListener` | Service Worker API | Browser |
| `self.skipWaiting()` | Service Worker API | Browser |
| `self.clients.claim()` | Service Worker API | Browser |

### Observações

Propositalmente sem handler de `fetch`: o app busca sempre dados frescos do Supabase, sem cache offline.

---

## 3. `js/core/events.js`

**Linhas:** 50  
**Descrição geral:** Helpers de permissão de usuário e utilitário de estado de batalha. O event bus (`HUB_EVENTS`) está definido em `config.js`, não aqui.

### Funções definidas

#### `temPermissao(chave)` — linha 7
Verifica se o usuário atual possui uma permissão específica.
- Mestre sempre retorna `true`.
- Jogadores: consulta `RPG_DATA.myPermissoes[chave]`; se não configurado, usa o valor padrão de `PERMISSOES_CONFIG`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA` | objeto global | `js/state.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `RPG_DATA.myPermissoes` | propriedade | `js/state.js` |
| `PERMISSOES_CONFIG` | array global | não identificado ainda |

---

#### `podeEditarPersonagem(nomePersonagem)` — linha 14
Retorna `true` se o usuário pode editar o personagem informado.
- Mestre: sempre pode.
- Jogador: apenas se `RPG_DATA.linked` for igual ao nome do personagem.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `RPG_DATA.linked` | propriedade | `js/state.js` |

---

#### `_estadoBatalhaJogador(nomePersonagem)` — linha 23
Retorna o estado de batalha do personagem do ponto de vista do jogador. Valores possíveis:
- `'livre'` → mestre, ou está em combate ativo e é o seu turno
- `'fora_combate'` → sem batalha ativa que inclua o personagem
- `'outro_turno'` → batalha ativa, mas não é o turno do personagem

Suporta dois modos: **Arena** (usa `AR.iniciativa`) e **Campanha normal** (usa `MAPA_STATE.batalhas`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR` | objeto global (Arena) | `js/systems/arena.js` |
| `AR.session` | propriedade | `js/systems/arena.js` |
| `AR.myRole` | propriedade | `js/systems/arena.js` |
| `AR.iniciativa` | propriedade | `js/systems/arena.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `MAPA_STATE.batalhas` | propriedade | `js/state.js` |

---

## 4. `js/core/utils.js`

**Linhas:** 64  
**Descrição geral:** Sistema de ícones e animações SVG customizados, usados em cards e telas de carregamento. Suporta tipos built-in e SVGs customizados via CSV.

### Funções definidas

#### `injectCustomCSS(rpgId, css)` — linha 11
Injeta ou atualiza um bloco `<style>` no `document.head` com CSS customizado, identificado pelo id `custom-anim-{rpgId}`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `document.getElementById` | DOM API | Browser |
| `document.createElement` | DOM API | Browser |
| `document.head.appendChild` | DOM API | Browser |

---

#### `processCustomSVG(svg, color1, color2)` — linha 24
Função pura. Substitui os tokens `#COLOR1` e `#COLOR2` em uma string SVG pelas cores fornecidas. Retorna `null` se `svg` for falsy.

**Dependências externas:** *Nenhuma.*

---

#### `getCardIconSVG(tipo, c1, c2, customSVG)` — linha 30
Retorna uma string SVG para o ícone de um card. Se `customSVG` for fornecido, processa e retorna ele via `processCustomSVG`. Caso contrário, usa os tipos built-in: `flame`, `rune`, `gear`, `crystal`, `spirit`, `sigil` (fallback para um hexágono genérico).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `processCustomSVG` | função | mesmo arquivo (`utils.js` linha 24) |

---

#### `getLoadingAnimSVG(tipo, customSVG)` — linha 48
Retorna uma string HTML (`<div class="anim-{tipo}">…</div>`) com SVG animado para estados de carregamento. Suporta os mesmos tipos de `getCardIconSVG`. Usa variáveis CSS (`--destaque`, `--primario`, `--primario-v`, `--destaque-v`) para colorização.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| CSS vars `--destaque`, `--primario`, `--primario-v`, `--destaque-v` | variáveis CSS | folha de estilos global |

---

## 5. `js/config.js`

**Linhas:** 91  
**Descrição geral:** Arquivo de configuração central. Define credenciais do Supabase, hCaptcha, o event bus global `HUB_EVENTS`, e utilitários de tamanho de personagem por dispositivo.

### Variáveis/constantes definidas

| Nome | Linha | Valor / Descrição |
|------|-------|-------------------|
| `SUPABASE_URL` | 9 | URL do projeto Supabase |
| `SUPABASE_KEY` | 10 | Chave anon pública do Supabase |
| `HCAPTCHA_SITEKEY` | 11 | Site key do hCaptcha |
| `EMAIL_CONFIRMATION_ENABLED` | 90 | `true` — habilita confirmação de e-mail no fluxo de auth |
| `HUB_EVENTS` | 17 | Objeto event bus (IIFE) — exposto globalmente |

### Funções definidas

#### `HUB_EVENTS.on(tipo, fn)` — linha 20
Registra um listener `fn` para o evento `tipo`.  
**Deps externas:** *Nenhuma* (usa closure `_listeners` interno).

#### `HUB_EVENTS.off(tipo, fn)` — linha 24
Remove o listener `fn` do evento `tipo`.  
**Deps externas:** *Nenhuma.*

#### `HUB_EVENTS.emit(tipo, dados)` — linha 28
Dispara todos os listeners registrados para `tipo`, passando `dados`. Captura erros com `console.warn`.  
**Deps externas:** *Nenhuma.*

---

#### `_isMobile()` — linha 59
Retorna `true` se a viewport for ≤ 768px ou se o user-agent indicar dispositivo móvel (Android/iPhone/iPad/iPod).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `window.innerWidth` | Browser API | Browser |
| `navigator.userAgent` | Browser API | Browser |

---

#### `_charSizeKey(nome)` — linha 64
Retorna a chave de localStorage para o tamanho do personagem `nome`, escopada pelo `rpgId` do RPG atual.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window.RPG_DATA.rpgId` | propriedade global | `js/state.js` (opcional; fallback `'default'`) |

---

#### `_getMobileSize(nome)` — linha 69
Lê o tamanho de personagem salvo no `localStorage`. Retorna `null` se não encontrado ou em caso de erro.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `localStorage` | Browser API | Browser |
| `_charSizeKey` | função | mesmo arquivo (`config.js` linha 64) |

---

#### `_setMobileSize(nome, val)` — linha 76
Salva o tamanho do personagem no `localStorage`. Ignora erros silenciosamente.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `localStorage` | Browser API | Browser |
| `_charSizeKey` | função | mesmo arquivo (`config.js` linha 64) |

---

#### `window._getCharTamanhoEfetivo(nome, ca)` — linha 81
Retorna o tamanho efetivo de exibição de um personagem no canvas/mapa.
- Em mobile: usa valor salvo no localStorage (via `_getMobileSize`), com mínimo de `0.4`.
- Em desktop: usa `ca.aparencia.tamanho` com mínimo de `0.4` (padrão `1.0`).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `_isMobile` | função | mesmo arquivo (`config.js` linha 59) |
| `_getMobileSize` | função | mesmo arquivo (`config.js` linha 69) |
| `window.RPG_DATA` | objeto global | `js/state.js` (opcional) |

### Eventos disponíveis no `HUB_EVENTS` (documentados no arquivo)

| Evento | Dados | Descrição |
|--------|-------|-----------|
| `token_moveu` | `{ nome, deCelula, paraCelula, movimentoRestante }` | Token movido no mapa |
| `dano_aplicado` | `{ atacante, alvo, valor, tipo }` | Dano aplicado a um personagem |
| `cura_aplicada` | `{ origem, alvo, valor }` | Cura aplicada |
| `turno_avancou` | `{ personagem, rodada }` | Turno avançou |
| `habilidade_usada` | `{ personagem, habilidade, alvo }` | Habilidade usada |
| `zona_ativada` | `{ zona, personagem }` | Zona de efeito ativada |
| `cena_carregada` | `{ cena_id, nome }` | Nova cena/mapa carregado |
| `batalha_iniciada` | `{ mapa_id }` | Batalha iniciada |
| `batalha_encerrada` | `{ mapa_id, resultado }` | Batalha encerrada |
| `item_usado` | `{ personagem, item, efeito, aprovacao }` | Item consumido |
| `loot_dropado` | `{ npc, itens, posicao }` | Loot gerado por NPC |

---

## 6. `js/systems/rest.js`

**Linhas:** 98  
**Descrição geral:** Sistema de descanso (curto e longo) para personagens. Recupera HP, reseta cooldowns de habilidades e restaura atributos de recurso. Atualiza o banco via Supabase e re-renderiza a UI.

### Funções definidas

#### `descansoExecutar(tipo, nomePersonagem)` — linha 6 *(async)*
Executa o descanso para um único personagem.
- **Curto:** recupera `pctCurto * hpMax` HP (padrão 50%); reseta cooldowns com `tipo_recarga === 'descanso_curto'` na batalha atual.
- **Longo:** recupera HP máximo; zera todos os cooldowns; restaura atributos de recurso ao seu máximo (`e_recurso` + `max_attr` nas opções da attrDef); limpa estado moribundo/estabilizado.
- Persiste via `sb()` (PATCH em `characters`) e atualiza a UI local.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA` | objeto global | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `RPG_DATA.config` | objeto | `js/state.js` |
| `RPG_DATA.skills` | array | `js/state.js` |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `RPG_DATA.rpgId` | string | `js/state.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/maps/maps.js` ou `js/combat/combat.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `mostrarToast` | função | não identificado ainda |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |
| `renderCharView` | função | `js/characters/characters.js` (provável) |
| `renderAttrView` | função | `js/characters/characters.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `descansoGrupo(tipo)` — linha 76 *(async)*
Aplica descanso (curto ou longo) a todos os personagens jogadores vivos (exclui NPCs e mortos). Envia mensagem do narrador no chat e re-renderiza tokens no mapa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters` | array | `js/state.js` |
| `descansoExecutar` | função | mesmo arquivo (`rest.js` linha 6) |
| `chatEnviarNarrador` | função | `js/chat/chat.js` (provável) |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `RPG_DATA.mapas` | array | `js/state.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |

---

## 7. `js/systems/npcs.js`

**Linhas:** 176  
**Descrição geral:** Criação de NPCs genéricos e posicionamento deles no mapa da campanha via clique. Inclui modal de criação, lógica de numeração sequencial e fila de placement.

### Variáveis definidas

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `NPC_PLACEMENT_QUEUE` | 135 | `let` (array) | Fila de nomes de NPCs aguardando posicionamento no mapa |

### Funções definidas

#### `abrirModalNpcGenerico()` — linha 7
Abre o modal de criação de NPC genérico. Renderiza dinamicamente os campos de atributos básicos (`categoria === 'basico'`) com base em `RPG_DATA.attrDefs`. Suporta tipos `number`, `text`, `boolean` e `select`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `mostrarToast` | função | não identificado ainda |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `fecharModalNpcGenerico` | função | mesmo arquivo (`npcs.js` linha 47) |

---

#### `fecharModalNpcGenerico()` — linha 47
Oculta o overlay do modal de NPC genérico. Função simples, sem dependências além do DOM.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `document.getElementById` | DOM API | Browser |

---

#### `criarNpcGenerico()` — linha 51 *(async)*
Lê os valores do formulário do modal e cria 1–20 NPCs no banco. Trata numeração sequencial (ex: "Goblin 1", "Goblin 2") evitando conflitos com nomes já existentes. Após criação, opcionalmente inicia o fluxo de posicionamento no mapa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `mostrarToast` | função | não identificado ainda |
| `RPG_DATA.attrDefs` | array | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `RPG_DATA.rpgId` | string | `js/state.js` |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |
| `fecharModalNpcGenerico` | função | mesmo arquivo (`npcs.js` linha 47) |
| `renderAttrButtons` | função | não identificado ainda |
| `buildCharBtns` | função | não identificado ainda |
| `abrirModalNovoChar` | função | não identificado ainda |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `npcGenericoIniciarPlacement` | função | mesmo arquivo (`npcs.js` linha 137) |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `npcGenericoIniciarPlacement(nomes)` — linha 137
Inicializa a fila de posicionamento com os nomes dos NPCs criados e chama o primeiro passo.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `NPC_PLACEMENT_QUEUE` | variável | mesmo arquivo (`npcs.js` linha 135) |
| `npcGenericoProximoPlacement` | função | mesmo arquivo (`npcs.js` linha 142) |

---

#### `npcGenericoProximoPlacement()` — linha 142
Processa o próximo NPC da fila de placement. Adiciona classe `placement-ativo` ao mapa e aguarda um clique do usuário. Ao clicar, calcula a posição percentual, faz snap para o centro da célula do grid e chama `setCharActiveMap` para persistir a posição. Recursiva — chama-se novamente após cada NPC posicionado.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `NPC_PLACEMENT_QUEUE` | variável | mesmo arquivo (`npcs.js` linha 135) |
| `RPG_DATA.mapas` | array | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |
| `mostrarToast` | função | não identificado ainda |
| `document.getElementById('mapa-wrap')` | DOM API | Browser / `index.html` |
| `_getMapaById` | função | `js/maps/maps.js` (provável) |
| `pctParaCelula` | função | `js/maps/maps.js` (provável) |
| `setCharActiveMap` | função | `js/maps/maps.js` (provável) |
| `npcGenericoProximoPlacement` | função (recursão) | mesmo arquivo |

---

## 8. `js/core/realtime.js`

**Linhas:** 269  
**Descrição geral:** Gerencia a conexão WebSocket com o Supabase Realtime. Assina múltiplos canais de dados e roteia eventos recebidos para os handlers corretos do sistema. Implementa reconexão automática com backoff exponencial.

### Variáveis globais referenciadas (definidas fora deste arquivo)

`realtimeWS` — referência global ao WebSocket atual (atribuída internamente).

### Funções definidas

#### `iniciarRealtime(rpgId)` — linha 6
Abre a conexão WebSocket e assina 9 canais Supabase Realtime:

| Canal | Dados monitorados |
|-------|-------------------|
| `characters` | Personagens do RPG |
| `lore` | Entradas de lore |
| `skills` | Habilidades |
| `attr_defs` | Definições de atributos |
| `rpg_registry` | Estado da batalha, arena e configurações |
| `batalhas` | Linhas da tabela de batalhas |
| `criativos` | Itens criativos |
| `mapas` | Mapas |
| `realtime:chat:{rpgId}` | Broadcast de chat, animações, tokens e combate |

Funções internas (closures):
- `conectar()` — cria o WebSocket, registra handlers `onopen/onmessage/onerror/onclose`
- `join(topic)` — envia `phx_join` para um canal
- `parseMapa(r)` — normaliza um registro da tabela `mapas` para o formato `{ id, rpg_id, mapa: {...} }`

Lógica de reconexão: backoff exponencial (`2^tentativas * 1000ms`, máx 30s). Mostra/oculta banner `#reconexao-banner`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `SUPABASE_URL`, `SUPABASE_KEY` | constantes | `js/config.js` |
| `RPG_DATA` | objeto global | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `CHAR_VIEW`, `ATTR_VIEW` | variáveis globais | `js/state.js` |
| `AR` | objeto global | `js/systems/arena.js` |
| `CURRENT_RPG` | variável global | `js/state.js` ou `js/hub/hub.js` |
| `chatIniciar` | função | `js/chat/chat.js` |
| `chatReceberMensagem` | função | `js/chat/chat.js` |
| `chatReceberPresenca` | função | `js/chat/chat.js` |
| `animReceberBroadcast` | função | `js/combat/animations.js` (provável) |
| `tokenMoveReceber` | função | `js/maps/maps.js` (provável) |
| `combateReceberBroadcast` | função | `js/combat/combat.js` (provável) |
| `_getMapaById` | função | `js/maps/maps.js` (provável) |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `renderCharView` | função | `js/characters/characters.js` (provável) |
| `renderAttrView` | função | `js/characters/characters.js` (provável) |
| `renderCharButtons` | função | não identificado ainda |
| `mostrarToast` | função | não identificado ainda |
| `renderLore` | função | `js/systems/lore.js` (provável) |
| `batalhaReceberEstadoRemoto` | função | `js/combat/combat.js` (provável) |
| `renderMesa` | função | não identificado ainda |
| `batalhaReceberLinhaRemota` | função | `js/combat/combat.js` (provável) |
| `criativoReceberLinhaRemota` | função | `js/systems/creative.js` (provável) |
| `renderMapaViewer` | função | `js/maps/maps.js` (provável) |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `chatAtualizarOnline` | função | `js/chat/chat.js` |
| `document` | DOM API | Browser |

---

#### `fecharRealtime()` — linha 247
Fecha o WebSocket ativo, oculta o indicador de status (`.realtime-dot`), limpa o intervalo de presença do chat e zera o estado de presença.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `CHAT._presenceInterval` | propriedade | `js/state.js` |
| `CHAT.online`, `CHAT.rpgId` | propriedades | `js/state.js` |
| `chatAtualizarOnline` | função | `js/chat/chat.js` |
| `document.getElementById` | DOM API | Browser |

---

#### `realtimeBroadcast(tipo, payload)` — linha 258
Envia um evento broadcast genérico para todos os jogadores via WebSocket. Exportada em `window.realtimeBroadcast`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `realtimeWS` | variável global | `js/state.js` |
| `CURRENT_RPG` | variável global | `js/state.js` ou `js/hub/hub.js` |

---

## 9. `js/chat/chat.js`

**Linhas:** 324  
**Descrição geral:** Sistema de chat em tempo real via Supabase Realtime Broadcast. Sem tabela dedicada — usa broadcast para envio imediato e uma linha na tabela `lore` como cache persistente (cap de 1000 chars). Controla presença de usuários online.

### Constantes definidas

| Nome | Linha | Valor | Descrição |
|------|-------|-------|-----------|
| `CHAT_TTL` | 11 | `3 600 000` ms | Tempo de vida de uma mensagem (1 hora) |
| `CHAT_CHAR_CAP` | 12 | `1000` | Máximo de caracteres ao persistir no banco |
| `CHAT_LORE_SEC` | 13 | `'chat_cache'` | Nome da seção usada na tabela `lore` |

### Atribuições sobre o objeto global `CHAT`

| Propriedade | Linha | Descrição |
|-------------|-------|-----------|
| `CHAT._saveTimer` | 42 | Timer do debounce de salvamento no banco |
| `CHAT._loreId` | 43 | ID da linha `lore` usada como cache do chat |

### Funções definidas

#### `chatSerializar(msgs)` — linha 17
Filtra mensagens dentro do `CHAT_TTL` e remove as mais antigas até o array serializado caber em `CHAT_CHAR_CAP` caracteres. Retorna JSON string.  
**Deps externas:** *Nenhuma* (usa só constantes do mesmo arquivo).

---

#### `chatSalvarLocal(rpgId, msgs)` — linha 29
Salva o histórico serializado no `localStorage` com chave `chat_hist_{rpgId}`.

**Deps externas:** `localStorage` (Browser), `chatSerializar` (mesmo arquivo).

---

#### `chatLerLocal(rpgId)` — linha 32
Lê e filtra mensagens do `localStorage`, descartando as expiradas (> `CHAT_TTL`).

**Deps externas:** `localStorage` (Browser), `CHAT_TTL` (mesmo arquivo).

---

#### `chatAgendarSalvoBanco()` — linha 45
Debounce de 30 segundos: persiste o histórico serializado em uma linha da tabela `lore` (`secao = 'chat_cache'`). Cria a linha na primeira vez, atualiza nas demais.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CHAT._saveTimer`, `CHAT.rpgId`, `CHAT.msgs`, `CHAT._loreId` | propriedades | `js/state.js` |
| `chatSerializar` | função | mesmo arquivo |
| `sb` | função (fetch Supabase) | `js/core/supabase.js` |

---

#### `chatCarregarDoBanco(rpgId)` — linha 69 *(async)*
Busca a linha de cache do chat na tabela `lore` e retorna as mensagens válidas (dentro do TTL).

**Dependências externas:** `sb` (supabase.js), `CHAT._loreId`, `CHAT_TTL`, `CHAT_LORE_SEC` (mesmo arquivo).

---

#### `chatIniciar(rpgId, wsRef)` — linha 79 *(async)*
Inicializa o chat: carrega histórico local imediatamente, depois mescla com dados do banco (dedup por `ts+autor+texto`). Faz join no canal broadcast `realtime:chat:{rpgId}` e inicia heartbeat de presença a cada 20s.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CHAT.*` | objeto global | `js/state.js` |
| `chatLerLocal`, `chatRenderizar`, `chatCarregarDoBanco`, `chatSalvarLocal`, `chatAtualizarOnline` | funções | mesmo arquivo |
| `SESSION` | objeto global | `js/auth/auth.js` (provável) |
| `USER_ID` | variável global | `js/auth/auth.js` (provável) |
| `RPG_DATA.characters`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `_atualizarBadgeMesa` | função | não identificado ainda |
| `batalhaIdMinha` | função | `js/combat/combat.js` (provável) |
| `BATALHA_ATUAL_ID` | variável global | `js/maps/maps.js` ou `js/combat/combat.js` |
| `MAPA_STATE.batalhas` | propriedade | `js/state.js` |
| `batalhaRenderOrdemStrip` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderVezLabel` | função | `js/combat/combat.js` (provável) |

---

#### `chatEnviar()` — linha 139
Lê o input `#chat-input`, envia a mensagem e renova presença via WebSocket. Usa o personagem vinculado ao usuário como identidade no chat. Suporta contexto de Arena (`AR.ws`) e Campanha (`realtimeWS`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `AR.session.rpg_id`, `AR.ws`, `AR.chars` | propriedades | `js/systems/arena.js` |
| `CURRENT_RPG.id` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `realtimeWS` | variável global | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `SESSION.nickname` | propriedade | `js/auth/auth.js` (provável) |
| `USER_ID` | variável global | `js/auth/auth.js` (provável) |
| `mostrarToast` | função | não identificado ainda |

---

#### `chatReceberMensagem(pkg)` — linha 170
Recebe pacote broadcast `{autor, cor, texto, ts}`, deduplica, appenda ao histórico, persiste localmente e agenda salvamento no banco. Incrementa `CHAT.naoLidos` se o chat estiver fechado.

**Deps externas:** `CHAT.*` (state.js), `chatSalvarLocal`, `chatAgendarSalvoBanco`, `chatAtualizarBadge`, `chatRenderizar` (mesmo arquivo), `SESSION`, `USER_ID`, `document`.

---

#### `chatRenderizar()` — linha 189
Renderiza os últimos 80 itens do histórico no elemento `#chat-mensagens`. Mensagens do sistema (`tipo === 'sistema'`) recebem estilo centralizado/itálico.

**Deps externas:** `document`, `CHAT.*`, `SESSION`, `USER_ID`, `chatEscapar`, `chatAtualizarOnline` (mesmo arquivo).

---

#### `chatReceberPresenca(pkg)` — linha 213
Atualiza `CHAT.online` com o pacote de presença recebido, descartando inativos (> 30s).

**Deps externas:** `CHAT.online`, `chatAtualizarOnline` (mesmo arquivo).

---

#### `chatAtualizarOnline()` — linha 224
Renderiza os indicadores de usuários online (dots coloridos + contador) no elemento `#chat-online`.

**Deps externas:** `document`, `CHAT.online`.

---

#### `chatMostrar(rpgId)` — linha 236
Exibe os botões de chat e reflash no header. Chat começa fechado.

**Deps externas:** `CHAT.*`, `document`, `chatAtualizarBadge` (mesmo arquivo).

---

#### `chatOcultar()` — linha 247
Remove a classe `visivel` do `#chat-container` e marca `CHAT.aberto = false`.

**Deps externas:** `document`, `CHAT.aberto`.

---

#### `reflashDados()` — linha 253 *(async)*
Recarrega todos os dados do RPG via `getRPGData()` e re-renderiza a interface completa sem mudar de aba.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CURRENT_RPG.id` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `getRPGData` | função | `js/core/supabase.js` (provável) |
| `RPG_DATA` | objeto global | `js/state.js` |
| `CHAR_VIEW` | variável global | `js/state.js` |
| `renderHeader`, `renderLore`, `renderCharButtons`, `renderAttrButtons`, `renderDados`, `renderConfig`, `renderMapasTab`, `renderCharView`, `renderAttrView` | funções | vários arquivos |
| `mostrarToast` | função | não identificado ainda |
| `document` | DOM API | Browser |

---

#### `chatToggle()` — linha 279
Alterna visibilidade do painel de chat. Deps: `CHAT.aberto`, `chatOcultar`, `chatAbrir` (mesmo arquivo).

---

#### `chatAbrir()` — linha 287
Adiciona classe `visivel`, zera `naoLidos`, atualiza badge e renderiza. Foca o input.

**Deps externas:** `document`, `CHAT.*`, `chatAtualizarBadge`, `chatRenderizar` (mesmo arquivo).

---

#### `chatAtualizarBadge()` — linha 294
Atualiza o badge de não-lidos em dois lugares: `#chat-fab-badge` (header) e `#ar-chat-badge` (arena). Exibe `9+` quando `CHAT.naoLidos > 9`.

**Deps externas:** `document`, `CHAT.naoLidos`.

---

#### `chatSalvarLog()` — linha 309 *(async)*
Salva snapshot permanente do histórico de chat como entrada na tabela `lore` (seção `chat_log`).

**Deps externas:** `CHAT.msgs`, `AR.session.rpg_id`, `CURRENT_RPG.id`, `sb`, `mostrarToast`.

---

#### `chatEscapar(texto)` — linha 321
Função pura de sanitização HTML: escapa `& < > "`. Previne XSS nas mensagens renderizadas.  
**Deps externas:** *Nenhuma.*

### Observações

- **`chatEnviarNarrador`** (referenciada em `rest.js`) **não está definida neste arquivo**. Origem ainda não identificada.
- `CHAT` como objeto global é pré-requisito deste arquivo — provável em `js/state.js`.

---

## 10. `js/combat/animations.js`

**Linhas:** 382  
**Descrição geral:** Duas responsabilidades distintas: (1) broadcast de eventos de combate em tempo real para todos os jogadores; (2) motor de animação de ataque — emite e recebe animações via WebSocket e resolve os elementos DOM dos tokens para alimentar o engine Canvas 2D definido em `camera.js`.

> **Acoplamento cruzado:** este arquivo depende de `animarAtaque` (definida em `camera.js`), enquanto `camera.js` usa `_animCriarCanvas`, `_animCentro` e `_animHexToRgb` definidos aqui. Ambos precisam estar carregados antes que qualquer animação seja disparada.

### Constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_ANIM_SID` | 284 | UUID de sessão por aba (`Math.random().toString(36).slice(2)`), usado para ignorar o eco do próprio emissor nos broadcasts |

### Funções definidas

#### `combateBroadcast(tipo, dados)` — linha 9
Envia evento de combate via WebSocket pelo canal `realtime:public:characters`. Anexa `_ANIM_SID` ao payload para que o emissor possa ignorar o próprio eco.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR.session.rpg_id`, `AR.ws` | propriedades | `js/systems/arena.js` |
| `RPG_DATA.rpgId` | propriedade | `js/state.js` |
| `realtimeWS` | variável global | `js/state.js` |
| `_ANIM_SID` | constante | mesmo arquivo (linha 284) |

---

#### `combateReceberBroadcast(payload)` — linha 25
Recebe broadcast de combate e despacha para lógica específica conforme o campo `tipo`. Ignora pacotes com `_sid === _ANIM_SID` (eco do próprio cliente).

Tipos de evento tratados:

| Tipo | Ação |
|------|------|
| `dados_rolados` | Toast com resultado do dado |
| `vez_passou` | Atualiza `bs.ordemAtual`, navega ao mapa se necessário, notifica vez |
| `ataque_executado` | Toast com dano e efeitos |
| `aguardando_aprovacao` | Toast para o mestre; notifica criativo pendente |
| `batalha_criada` | Insere batalha em `MAPA_STATE.batalhas`, navega ao mapa |
| `iniciativa_rolada` | Atualiza iniciativa do participante, verifica se todos rolaram |
| `batalha_estado` | Sync completo de fase/participantes/ordem |
| `batalha_pausada` | Atualiza `bs.pausada` |
| `batalha_encerrada` | Remove batalha do estado |
| `trigger_mostrar` | Exibe card de trigger remoto |
| `trigger_ocultar` | Oculta card de trigger |
| `personagem_morto` | Marca `ca.morto`, re-renderiza tokens |
| `personagem_caiu` | Marca `ca.moribundo`, re-renderiza tokens |
| `personagem_estabilizou` | Marca `ca.estabilizado`, re-renderiza tokens |
| `fase_mudou` | Atualiza `bs.fase` |
| `empurrao_executado` | Atualiza posição do alvo no mapa |
| `ataque_oportunidade` | Toast com resultado |
| `batalha_vitoria` | Exibe tela de vitória (apenas para jogadores) |
| `criativo_animacao` | Delega para `_onReceberAnimacaoCriativo` |

**Dependências externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE`, `RPG_DATA` | objetos globais | `js/state.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/combat/combat.js` ou `js/maps/maps.js` |
| `AR` | objeto global | `js/systems/arena.js` |
| `mostrarToast` | função | não identificado ainda |
| `selecionarMapa` | função | `js/maps/maps.js` (provável) |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |
| `_notificarVez` | função | `js/combat/combat.js` (provável) |
| `_atualizarBadgeMesa` | função | não identificado ainda |
| `_atualizarSeletorBatalhas` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderFaseIniciativa` | função | `js/combat/combat.js` (provável) |
| `batalhaVerificarIniciativasCompletas` | função | `js/combat/combat.js` (provável) |
| `batalhaRenderVezLabel` | função | `js/combat/combat.js` (provável) |
| `_mesaRenderAcoes`, `_mesaRenderIniciativa` | funções | não identificado ainda |
| `MOBILE_CTRL`, `_atualizarZonaDireita` | variável/função | não identificado ainda |
| `_atkMostrarTriggerRemoto` | função | não identificado ainda |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `_mostrarTelaVitoria` | função | `js/combat/combat.js` (provável) |
| `_onReceberAnimacaoCriativo` | função | `js/systems/creative.js` (provável) |
| `_notificarNovoCreativoPendente` | função | não identificado ainda |
| `document` | DOM API | Browser |

---

#### `animBroadcast(payload)` — linha 287
Envia payload de animação de ataque via evento `anim_ataque` no mesmo canal de characters.

**Dependências externas:** `AR.session.rpg_id`, `AR.ws`, `RPG_DATA.rpgId`, `realtimeWS`.

---

#### `animReceberBroadcast(payload)` — linha 302 *(async)*
Recebe broadcast de animação de ataque remoto, resolve os elementos DOM dos tokens e executa a animação localmente com suporte a repetições.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_ANIM_SID` | constante | mesmo arquivo (linha 284) |
| `resolverTokenEl` | função | mesmo arquivo (linha 351) |
| `animarAtaque` | função | `js/maps/camera.js` linha 205 |

---

#### `_atkRodarAnimacao()` — linha 320 *(async)*
Helper interno: emite animação para os outros jogadores via `animBroadcast` e executa também localmente. Lê contexto do objeto global `COMBATE`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `animBroadcast` | função | mesmo arquivo (linha 287) |
| `resolverTokenEl` | função | mesmo arquivo (linha 351) |
| `animarAtaque` | função | `js/maps/camera.js` linha 205 |

---

#### `resolverTokenEl(nome, contexto)` — linha 351
Retorna o elemento DOM do token pelo nome e contexto (`'arena'` ou mapa). Usa `CSS.escape` para segurança no seletor.

**Dependências externas:** `CSS.escape` (Browser API), `document.querySelector`.

---

#### `_animCriarCanvas()` — linha 361
Cria e anexa ao `document.body` um `<canvas>` fullscreen com `pointer-events:none` e `z-index:10100`.

**Dependências externas:** `document`, `window.innerWidth`, `window.innerHeight`.

---

#### `_animCentro(el)` — linha 370
Retorna `{x, y}` com o centro absoluto de um elemento DOM via `getBoundingClientRect`.  
**Deps externas:** DOM API.

---

#### `_animHexToRgb(hex)` — linha 375
Converte string hex (`#rrggbb` ou `#rgb`) para string `"R,G,B"`. Função pura, sem deps externas.

---

## 11. `js/maps/camera.js`

**Linhas:** 394  
**Descrição geral:** Camada visual do mapa. Injeta CSS de animações, aplica efeitos de combate em 3 camadas (intenção → impacto → número flutuante + partículas), gerencia pulso de zonas, badge de loot e overlay de grid tático. Também define o dispatcher `animarAtaque` e os renderers Canvas 2D para cada tipo de animação.

> **Nota de nomenclatura:** apesar do nome `camera.js`, o arquivo não implementa câmera/pan/zoom. Seu escopo real é o sistema de efeitos visuais do mapa e o engine Canvas 2D de animações.

### IIFEs executadas na carga

| IIFE | Linha | O que faz |
|------|-------|-----------|
| `_injetarCssEfeitos()` | 10 | Injeta ~18 regras CSS para animações de intenção, impacto, números flutuantes e partículas |
| `_injetarCssZonas()` | 95 | Injeta CSS para pulso visual das 5 categorias de zonas |
| *(anônima lootPiscar)* | 141 | Injeta `@keyframes lootPiscar` para o badge de loot |

### Constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_TIPO_ANIM_CLASS` | 52 | Mapa de tipo de dano (`fisico`, `fogo`, `gelo`, …) para sufixo CSS |
| `_origMRTokens7` | 101 | Guarda referência original de `window.mapaRenderTokens` antes do monkey-patch |
| `_origMapaRenderCanvas7` | 165 | Guarda referência original de `window.mapaRenderCanvas` antes do monkey-patch |

### Monkey-patches em `window`

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.mapaRenderTokens` | 102 | Após renderizar tokens, aplica pulso de zonas, verifica proximidade e adiciona badges de loot |
| `window.mapaRenderCanvas` | 166 | Após renderizar canvas, converte saídas `x_percent` para células e sobrepõe grid tático |
| `window.animarAtaque3Camadas` | 90 | Exporta `animarAtaque3Camadas` para o escopo global |
| `window.snapParaCelula` | 163 | Exporta `snapParaCelula` para o escopo global |

### Listeners HUB_EVENTS registrados

| Evento | Linha | Ação |
|--------|-------|------|
| `dano_aplicado` | 91 | Chama `animarAtaque3Camadas` (não-cura) |
| `cura_aplicada` | 92 | Chama `animarAtaque3Camadas` (modo cura) |
| `cena_carregada` | 156 | Chama `_verificarMapaIsoLegado` |

### Funções definidas

#### `animarAtaque3Camadas(atacanteNome, alvoNome, dano, tipoDano, ehCritico, ehCura)` — linha 54
Executa animação em 3 fases com delays sequenciais:
1. *(t=0ms)* Flash de intenção no token atacante (`anim-intencao-{tipo}`)
2. *(t=200ms)* Flash de impacto no alvo (`anim-impacto-{tipo}`) + partículas
3. *(t=300ms)* Número flutuante (dano/cura/ERROU/crítico) sobre o token alvo

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_TIPO_ANIM_CLASS` | constante | mesmo arquivo (linha 52) |
| `_dispararParticulasToken` | função | mesmo arquivo (linha 77) |
| `document.querySelector`, `CSS.escape` | APIs | Browser |
| `document.getElementById('mapa-img')` | DOM | Browser / `index.html` |

---

#### `_dispararParticulasToken(tokenEl, tipoClass)` — linha 77
Cria 8 elementos `div.particula-impacto` ao redor do token com ângulos e distâncias aleatórias, usando variáveis CSS `--px`/`--py` para a dispersão.

**Dependências externas:** `document.getElementById('mapa-img')`, `document.createElement`.

---

#### `_aplicarPulsoZonas(m)` — linha 106
Aplica classe `zona-pulso-{tipo}` em cada elemento `.mapa-zona` conforme o `zona_tipo` do local correspondente.

**Dependências externas:** `document.querySelectorAll`.

---

#### `_verificarProximidadeZonas(m)` — linha 113
Verifica se algum jogador está a ≤ 2 células de uma zona não visitada. Se sim, emite entrada no feed.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.mapaAtualId` | propriedade | `js/state.js` |
| `RPG_DATA.characters` | array | `js/state.js` |
| `getPosicaoNoMapa` | função | `js/maps/maps.js` (provável) |
| `feedAdicionarEntrada` | função | não identificado ainda |

---

#### `_aplicarIconesLootTokens()` — linha 132
Adiciona badge `💰 Loot` aos tokens de personagens mortos com `ca.tem_loot === true`.

**Dependências externas:** `RPG_DATA.characters`, `document.querySelector`, `CSS.escape`.

---

#### `_verificarMapaIsoLegado(m)` — linha 144
Exibe ou remove banner de aviso para mapas com `transform3d.depth` (formato isométrico legado).

**Dependências externas:** `document.getElementById`, `document.getElementById('mapa-tokens')`.

---

#### `snapParaCelula(xPct, yPct, mapa)` — linha 159
Converte coordenadas percentuais para célula de grid `{col, row}`. Função pura, sem deps externas. Exportada em `window.snapParaCelula`.

---

#### `animarAtaque({ atacEl, alvoEl, animacao, dano })` — linha 205
Dispatcher central das animações Canvas 2D. Retorna `Promise`. Delega para:

| `animacao.tipo` | Função | Descrição |
|-----------------|--------|-----------|
| `projetil` | `_animProjetil` | Projétil em curva de Bézier com trilha opcional |
| `onda` | `_animOnda` | Ondas concêntricas expansivas |
| `explosao` | `_animExplosao` | Partículas de explosão |
| `raio` | `_animRaio` | Relâmpago zigzag com brilho |
| `aura` | `_animAura` | Aura pulsante ao redor do alvo |
| `gif`/`imagem`/`svg`/`iframe` | `_animMedia` | Mídia posicionada entre tokens |

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_animCentro` | função | `js/combat/animations.js` linha 370 |
| `_animHexToRgb` | função | `js/combat/animations.js` linha 375 |
| `_animCriarCanvas` | função | `js/combat/animations.js` linha 361 |
| `_animMedia` | função | **não encontrada ainda** |
| `_animImpacto` | função | **não encontrada ainda** (usada em `_animProjetil`) |

---

#### `_animProjetil`, `_animOnda`, `_animExplosao`, `_animRaio`, `_animGerarZigzag`, `_animAura` — linhas 233–393
Renderers Canvas 2D individuais. Todos usam `requestAnimationFrame` + `performance.now`. Recebem `ctx`, `canvas`, `origem`, `alvo`, `cor`, `rgb`, `icone`, `done` (callback de resolução da Promise).

Funções puras de cálculo auxiliar:
- `_animGerarZigzag(a, b, n)` (linha 357): gera n pontos zigzag aleatórios entre dois pontos. Sem deps externas.

---

## 12. `js/systems/lore.js`

**Linhas:** 417  
**Descrição geral:** Apesar do nome, este arquivo vai muito além do sistema de lore. Contém a renderização do header, o sistema completo de botões e busca de personagens, e a função `renderCharView` — o maior e mais complexo renderer de ficha de personagem do sistema.

> **Atenção de nomenclatura:** o escopo real é `lore + character UI`, não apenas lore.

### Constantes definidas

| Nome | Linha | Valor | Descrição |
|------|-------|-------|-----------|
| `CHAR_SEARCH_THRESHOLD` | 25 | `5` | Número mínimo de personagens para exibir caixa de busca |

### Funções definidas

#### `renderHeader()` — linha 5
Atualiza o nome do personagem vinculado no header (`#hdr-char`).

**Deps externas:** `document.getElementById`, `RPG_DATA.linked`.

---

#### `renderLore()` — linha 9
Renderiza todas as entradas de lore visíveis (excluindo `chat_cache` e `chat_log`) agrupadas por seção. Inclui botões de editar/remover baseados na permissão `'editar_lore'`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.lore` | array | `js/state.js` |
| `temPermissao` | função | `js/core/events.js` |
| `fmtSec` | função | mesmo arquivo (linha 19) |
| `filtrarLore` | função | mesmo arquivo (linha 20) |
| `abrirModalLore` | função | **não encontrada ainda** |
| `removerLore` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `fmtSec(s)` — linha 19
Função pura. Traduz slugs de seção para nomes legíveis (ex: `'facoes'` → `'Facções'`). Sem deps externas.

---

#### `filtrarLore(s, btn)` — linha 20
Ativa o botão de filtro clicado e mostra apenas os itens da seção correspondente.

**Deps externas:** `document.querySelectorAll`.

---

#### `renderCharButtons()` — linha 27
Reconstrói a linha de botões de seleção de personagens (`#char-select-row`) chamando `buildCharBtns` e exibe botão de criação.

**Deps externas:** `document.getElementById`, `buildCharBtns` (mesmo arquivo), `abrirModalNovoChar` (**não encontrada ainda**), `_charSearchToggle` (mesmo arquivo).

---

#### `_charSearchToggle(tab)` — linha 34
Exibe ou oculta a caixa de busca de personagens com base na contagem de entradas (NPCs genéricos são agrupados por `nome_base` para a contagem).

**Deps externas:** `RPG_DATA.characters`, `document.getElementById`, `CHAR_SEARCH_THRESHOLD` (mesmo arquivo).

---

#### `charFiltrar(input, tab)` — linha 60
Filtra botões de personagem em tempo real por texto. Mostra/oculta o botão "limpar busca".

**Deps externas:** `document.getElementById`, `document.querySelectorAll`.

---

#### `charFiltrarLimpar(tab)` — linha 74
Limpa o input de busca e reseta o filtro.

**Deps externas:** `document.getElementById`, `charFiltrar` (mesmo arquivo).

---

#### `buildCharBtns(tab)` — linha 81
Constrói HTML dos botões de seleção de personagens. Lógica de ordenação e agrupamento:
1. **Jogadores** (com seus pets logo após)
2. **NPCs especiais** (não genéricos, com seus pets)
3. **Criaturas / genéricos** (genéricos agrupados por `nome_base` com badge de contagem)
4. **Pets sem dono**

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters` | array | `js/state.js` |
| `ATTR_VIEW`, `CHAR_VIEW` | variáveis globais | `js/state.js` |
| `selecionarChar` | função | mesmo arquivo (linha 174) |

---

#### `selecionarChar(nome, btn, tab)` — linha 174
Seleciona o personagem ativo, atualiza botão ativo na linha e renderiza a view correspondente (`char` ou `attr`).

**Deps externas:** `document.querySelectorAll`, `ATTR_VIEW`, `CHAR_VIEW` (state.js), `renderAttrView` (**não encontrada ainda**), `renderCharView` (mesmo arquivo).

---

#### `renderCharView(nome)` — linha 177 *(função principal ~240 linhas)*
Renderiza a ficha completa do personagem no painel `#char-view`. É a função mais complexa do arquivo. Inclui:

- Barra de HP e barra de XP com porcentagem
- Avatar (modo APMOD com SVG por partes + overlays de equipamentos, ou imagem URL simples)
- Stat boxes por categoria (status/recursos, básicos, especiais, resistências)
- Lista de habilidades com metadados (fórmula, alcance, cooldown, tipo de dano, efeitos bônus, críticos)
- Formulário de edição inline (nome, tipo, classe, raça, cor, background, equipamentos, pet/dono, aparência)
- Botões condicionais: inventário, level up, distribuição de pontos, excluir (só mestre)
- Bloqueio de atributos para NPCs

**Dependências externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.skills`, `RPG_DATA.attrDefs`, `RPG_DATA.linked`, `RPG_DATA.myRole` | propriedades | `js/state.js` |
| `_skFiltrarPorChar` | função | `js/state.js` |
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `normalizeImgUrl` | função | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | propriedade | `js/state.js` ou `js/hub/hub.js` |
| `CHAR_VIEW`, `ATTR_VIEW` | variáveis | `js/state.js` |
| `apmodTokenSVG` | função | **não encontrada ainda** |
| `_aeqComputeMatrix3d` | função | **não encontrada ainda** |
| `tintOverlayHtml` | função | **não encontrada ainda** |
| `abrirModalAparencia` | função | **não encontrada ainda** |
| `abrirInventario` | função | `js/systems/inventory.js` (provável) |
| `distribuirPontosAttr` | função | **não encontrada ainda** |
| `abrirModalLevelUp` | função | **não encontrada ainda** |
| `toggleEditChar` | função | **não encontrada ainda** |
| `salvarInfoPersonagem` | função | **não encontrada ainda** |
| `excluirPersonagemCompleto` | função | **não encontrada ainda** |
| `charviewToggleOcultarAtribs` | função | **não encontrada ainda** |
| `abrirModalSkill` | função | `js/characters/skills.js` (provável) |
| `removerSkill` | função | `js/characters/skills.js` (provável) |
| `document.getElementById('char-view')` | DOM | Browser / `index.html` |

---

## 13. `js/state.js`

**Linhas:** 441  
**Descrição geral:** Arquivo de estado global da aplicação. Define todas as variáveis de estado compartilhadas entre módulos, o objeto `MAPA_STATE` e o sistema de zoom/pan/câmera do mapa. É o ponto central de dados do sistema.

### Variáveis e objetos globais definidos

| Nome | Linha | Tipo/Valor inicial | Descrição |
|------|-------|--------------------|-----------|
| `HUB_DATA` | 7 | `{rpgs:[]}` | Dados do hub (lista de RPGs do usuário) |
| `RPG_DATA` | 7 | `null` | Dados completos do RPG ativo (characters, skills, lore, attrDefs, mapas, etc.) |
| `CURRENT_RPG` | 7 | `null` | Objeto do RPG atualmente selecionado |
| `DADO_SEL` | 8 | `null` | Tipo de dado selecionado |
| `CHAR_VIEW` | 8 | `null` | Nome do personagem ativo na aba de ficha |
| `ATTR_VIEW` | 8 | `null` | Nome do personagem ativo na aba de atributos |
| `CFG_CHAR` | 8 | `null` | Personagem em configuração |
| `HISTORICO` | 9 | `[]` | Histórico de rolagens de dados |
| `USER_ID` | 9 | `null` | ID do usuário autenticado |
| `realtimeWS` | 9 | `null` | Referência ao WebSocket Supabase Realtime |
| `SESSION` | 10 | `null` | Sessão auth: `{access_token, user:{id,email}}` |
| `CRIATIVO_TIPO` | 13 | `'ataque'` | Tipo de ação criativa selecionada |
| `CRIATIVO_ALVO_TIPO` | 14 | `'unico'` | Alvo da ação criativa |
| `CHAT` | 17 | objeto | Estado do chat (msgs, aberto, naoLidos, rpgId, online, _presenceInterval) |
| `INI_VALOR_ATUAL` | 25 | `null` | Valor de iniciativa sendo rolado |
| `INI_NOME_ATUAL` | 26 | `null` | Personagem rolando iniciativa |
| `CRIATIVO_ID_ATUAL` | 27 | `null` | ID da ação criativa em andamento |
| `CRIATIVOS_CAMP` | 28 | `[]` | Ações criativas da campanha (sync via rpg_registry) |
| `CRIATIVO_MESTRE_BUILDER` | 29 | `[]` | Builder de dados do mestre para ações criativas |
| `BATALHA_ATUAL_ID` | 30 | `null` | ID da batalha visualizada no mapa atual |
| `_skModalCharId` | 46 | `null` | UUID do personagem no modal de skill aberto |
| `MAPA_STATE` | 47 | objeto | Estado do mapa: `mapaAtualId`, `mapaGeralId`, `toolMode`, `medicaoAtiva`, `dragging`, `dragTimer`, `batalhas{}`, getter `batalha` |
| `MAPA_ZOOM` | 55 | objeto | Estado de zoom/pan: `zoom`, `panX`, `panY`, `locked`, `activeChar`, `modo`, `_autoRafId`, `_inited`, `_keyInited` |
| `_cameraTarget` | 138 | `{panX:0,panY:0,zoom:1}` | Alvo da interpolação da câmera automática |
| `TIPOS_DADO` | 436 | `[4,6,8,10,20,100]` | Tipos de dado disponíveis por padrão |
| `IMPORT_CSVS` | 439 | `{}` | Cache de CSVs importados |
| `COR_MAP` | 440 | objeto | Mapa de nome de cor para variável CSS |

### Funções definidas

#### `_skCharId(nome)` — linha 34
Retorna o UUID do personagem pelo nome. Usado para vincular skills por UUID em vez de nome.  
**Deps externas:** `RPG_DATA.characters`.

---

#### `_skFiltrarPorChar(skills, nome)` — linha 41
Filtra skills pelo UUID do personagem, com fallback para o campo `personagem` (nome) em registros legados.  
**Deps externas:** `_skCharId` (mesmo arquivo).

---

#### `mapaGetTipo(mapa)` — linha 74
Normaliza o tipo do mapa: aliases `'geral'`→`'mundo'` e `'local'`→`'tatico'`. Função pura.

#### `mapaIsMundo(mapa)` — linha 80
Retorna `true` se o mapa é do tipo mundo. Deps: `mapaGetTipo`.

#### `mapaIsTatico(mapa)` — linha 81
Retorna `true` se o mapa é tático. Deps: `mapaGetTipo`.

---

#### `mapaZoomApply()` — linha 57
Aplica o estado atual de `MAPA_ZOOM` como CSS `transform` em `#mapa-img`. Atualiza o label de porcentagem de zoom.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`.

---

#### `mapaToggleLock()` — linha 83
Alterna `MAPA_ZOOM.locked`. Atualiza botão `#mapa-lock-btn` e cursor do mapa.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`, `mostrarToast`.

---

#### `mapaToggleModoCamera()` — linha 100
Alterna modo da câmera (`'auto'` ↔ `'manual'`). No modo auto, inicia o loop RAF.  
**Deps externas:** `MAPA_ZOOM`, `document.getElementById`, `mostrarToast`, `_cameraAutoLoop` (mesmo arquivo).

---

#### `_cameraCalcCentroide(mapId)` — linha 113
Calcula o centroide (0–1) de todos os personagens jogadores no mapa informado.

**Deps externas:** `RPG_DATA.characters`, `_getMapaById` (maps.js), `getPosicaoNoMapa` (maps.js).

---

#### `_cameraAutoTick()` — linha 140
Um frame do loop de câmera automática. Calcula zoom-alvo para manter todos os jogadores visíveis com 15% de margem e interpola suavemente (`t=0.08`).

**Deps externas:** `MAPA_ZOOM`, `MAPA_STATE.mapaAtualId`, `document.getElementById`, `_cameraCalcCentroide`, `_getMapaById`, `RPG_DATA.characters`, `getPosicaoNoMapa`, `mapaZoomApply` (todos internos exceto `_getMapaById` e `getPosicaoNoMapa`).

---

#### `_cameraAutoLoop()` — linha 191
Inicia o loop RAF da câmera automática. Continua enquanto `MAPA_ZOOM.modo === 'auto'`.  
**Deps externas:** `requestAnimationFrame` (Browser), `_cameraAutoTick` (mesmo arquivo).

---

#### `mapaZoomManualGuard()` — linha 205
Retorna `true` se o pan/zoom manual é permitido (modo não é `'auto'`). Sem deps externas.

---

#### `mapaCharSizeAtivar(nome)` — linha 212
Ativa o HUD de tamanho de token para um personagem. Em mobile, carrega o valor do cache local.

**Deps externas:** `RPG_DATA.characters`, `MAPA_ZOOM`, `document.getElementById`, `_isMobile` (config.js), `_getMobileSize` (config.js), `mapaCharSizeSlide` (mesmo arquivo).

---

#### `mapaCharSizeSlide(v)` — linha 238
Atualiza tamanho do token em memória e via CSS direto no elemento DOM (sem re-render). Salva no localStorage em mobile.

**Deps externas:** `MAPA_ZOOM`, `RPG_DATA.characters`, `document.getElementById`, `_isMobile`, `_setMobileSize` (config.js), `document.querySelector`, `CSS.escape`.

---

#### `mapaCharSizeStep(delta)` — linha 262
Incrementa/decrementa o slider de tamanho por `delta`.  
**Deps externas:** `document.getElementById`, `mapaCharSizeSlide` (mesmo arquivo).

---

#### `mapaCharSizeConfirmar()` — linha 269 *(async)*
Confirma o tamanho do token. **Mobile:** salva só localmente. **Desktop:** persiste no Supabase via `sb()`.

**Deps externas:** `MAPA_ZOOM`, `_isMobile`, `_setMobileSize`, `RPG_DATA`, `document.getElementById`, `mostrarToast`, `mapaCharSizeFechar` (mesmo arquivo), `mapaRenderTokens`, `MAPA_STATE`, `sb` (supabase.js).

---

#### `mapaCharSizeFechar()` — linha 314
Oculta o HUD de tamanho de token.  
**Deps externas:** `MAPA_ZOOM.activeChar`, `document.getElementById`.

---

#### `mapaZoomSet(z, pivotX, pivotY)` — linha 320
Define zoom para o valor `z` mantendo o ponto pivot fixo. Clampea entre 0.05 e 20.  
**Deps externas:** `MAPA_ZOOM`, `mapaZoomApply` (mesmo arquivo).

---

#### `mapaZoomReset()` — linha 331
Reseta zoom para 1 e pan para 0,0.  
**Deps externas:** `MAPA_ZOOM`, `mapaCharSizeFechar`, `mapaZoomApply` (mesmo arquivo).

---

#### `mapaZoomInit()` — linha 337
Registra todos os event listeners de zoom/pan do mapa. Executado uma única vez (`_inited`). Suporta:
- Mouse wheel (zoom centrado no cursor)
- Pinch-to-zoom (2 dedos touch)
- Pointer pan (arrastar mapa)
- Atalhos de teclado: `+`/`=` zoom in, `-` zoom out, `0` reset

**Deps externas:** `MAPA_ZOOM`, `MAPA_STATE.toolMode`, `document.getElementById`, `document.addEventListener`, `mapaZoomSet`, `mapaZoomReset` (mesmo arquivo).

---

#### `normalizeImgUrl(url)` — linha 425
Normaliza URLs do Google Drive para o formato direto `lh3.googleusercontent.com/d/{id}`. Função pura, sem deps externas.

---

#### `getDiceConfig(rpgId)` — linha 437
Lê configuração de dados do localStorage. Fallback para `TIPOS_DADO`.  
**Deps externas:** `localStorage`, `TIPOS_DADO` (mesmo arquivo).

#### `setDiceConfig(rpgId, arr)` — linha 438
Salva configuração de dados no localStorage.  
**Deps externas:** `localStorage`.

### Observações

- **`mostrarToast`** é chamada em `mapaToggleLock`, `mapaToggleModoCamera` e `mapaCharSizeConfirmar` mas **não está definida em nenhum arquivo mapeado até agora**. Pendente de identificação.
- **`_getMapaById`** e **`getPosicaoNoMapa`** usadas na câmera automática — prováveis em `js/maps/maps.js`.
- O getter `MAPA_STATE.batalha` retorna a batalha da `BATALHA_ATUAL_ID` atual — padrão de acesso conveniente usado amplamente no sistema de combate.

---

## 14. `js/auth/auth.js`

**Linhas:** 482  
**Descrição geral:** Sistema completo de autenticação. Gerencia login, cadastro com hCaptcha, recuperação de senha, refresh automático de token e o bootstrap inicial da aplicação após autenticação bem-sucedida.

### Variáveis definidas

| Nome | Linha | Valor inicial | Descrição |
|------|-------|---------------|-----------|
| `AUTH_MODE` | 7 | `'login'` | Modo atual do formulário (`'login'` ou `'cadastro'`) |
| `HCAPTCHA_WIDGET_ID` | 8 | `null` | ID do widget hCaptcha renderizado |

### Funções definidas

#### `onHcaptchaLoad()` — linha 11
Callback chamado pela API do hCaptcha ao carregar. Renderiza o widget no elemento `#auth-hcaptcha`.

**Deps externas:** `document.getElementById`, `hcaptcha.render` (API externa), `HCAPTCHA_SITEKEY` (config.js).

---

#### `authTab(modo)` — linha 21
Troca o painel de auth entre login e cadastro. Atualiza estilos dos botões de aba, visibilidade dos campos extras e reseta o hCaptcha e mensagens.

**Deps externas:** `document.getElementById`, `EMAIL_CONFIRMATION_ENABLED` (config.js), `hcaptcha.reset`, `authErro`, `authSucesso`, `authOcultarRecuperacao` (mesmo arquivo).

---

#### `authErro(msg)` / `authSucesso(msg)` — linhas 37 / 42
Exibe ou oculta as mensagens de erro/sucesso no formulário.  
**Deps externas:** `document.getElementById`.

---

#### `authToggleSenha()` / `authToggleSenha2()` — linhas 47 / 51
Alterna visibilidade dos campos de senha.  
**Deps externas:** `document.getElementById`.

---

#### `authSubmit()` — linha 56 *(async)*
Handler principal do formulário. Valida email e senha mínima, verifica se o widget hCaptcha foi renderizado e delega para `authCadastrar` ou `authEntrar`.

**Deps externas:** `document.getElementById`, `AUTH_MODE`, `HCAPTCHA_WIDGET_ID`, `authErro`, `authCadastrar`, `authEntrar` (mesmo arquivo).

---

#### `authCadastrar(email, senha, nickname, nomeReal)` — linha 91 *(async)*
Cria conta via endpoint GoTrue `/auth/v1/signup` com token hCaptcha. Exibe mensagem de confirmação de e-mail ou de sucesso conforme `EMAIL_CONFIRMATION_ENABLED`.

**Deps externas:** `hcaptcha.getResponse`, `HCAPTCHA_WIDGET_ID`, `SUPABASE_URL`, `SUPABASE_KEY` (config.js), `EMAIL_CONFIRMATION_ENABLED` (config.js), `traduzirErroAuth`, `authSucesso`, `authErro` (mesmo arquivo).

---

#### `authEntrar(email, senha)` — linha 116 *(async)*
Autentica via `/auth/v1/token?grant_type=password`. Busca nickname na tabela `players`, preenche `SESSION` e chama `iniciarApp`.

**Deps externas:** `hcaptcha.getResponse`, `SUPABASE_URL`, `SUPABASE_KEY`, `traduzirErroAuth`, `SESSION` (state.js), `localStorage`, `iniciarApp` (mesmo arquivo).

---

#### `authMostrarRecuperacao()` / `authOcultarRecuperacao()` — linhas 150 / 157
Exibe/oculta o painel de recuperação de senha.  
**Deps externas:** `document.getElementById`.

---

#### `authEnviarRecuperacao()` — linha 161 *(async)*
Envia e-mail de recuperação de senha via `/auth/v1/recover`. Exibe mensagem de sucesso ou erro.

**Deps externas:** `EMAIL_CONFIRMATION_ENABLED`, `SUPABASE_URL`, `SUPABASE_KEY`, `document.getElementById`.

---

#### `authVerificarLinkRecuperacao()` — linha 189
Lê `window.location.hash`, verifica se é um link de recuperação (`type=recovery`). Se sim, extrai o token e abre o formulário de nova senha.

**Deps externas:** `window.location.hash`, `history.replaceState`, `authExibirFormNovaSenha` (mesmo arquivo).

---

#### `authVerificarConfirmacaoEmail()` — linha 200 *(async)*
Lê o hash da URL para links de confirmação de e-mail (`type=signup` ou `type=email_change`). Se válido, busca dados do usuário com o token, preenche `SESSION` e chama `iniciarApp`.

**Deps externas:** `window.location.hash`, `history.replaceState`, `SUPABASE_URL`, `SUPABASE_KEY`, `SESSION` (state.js), `localStorage`, `iniciarApp`, `esconderSplash`, `document.getElementById`, `authSucesso` (mesmo arquivo).

---

#### `authExibirFormNovaSenha(tokenRecuperacao)` — linha 239
Cria e injeta no `document.body` um overlay com formulário para definir nova senha. O botão chama `authSalvarNovaSenha` com o token.

**Deps externas:** `document.getElementById`, `document.createElement`, `document.body.appendChild`.

---

#### `authSalvarNovaSenha(tokenRecuperacao)` — linha 266 *(async)*
Salva a nova senha via `PUT /auth/v1/user` com o token de recuperação. Fecha o modal e exibe mensagem de sucesso.

**Deps externas:** `document.getElementById`, `SUPABASE_URL`, `SUPABASE_KEY`.

---

#### `traduzirErroAuth(msg)` — linha 305
Função pura. Traduz mensagens de erro do Supabase GoTrue para português. Sem deps externas.

---

#### `authRefreshSession()` — linha 322 *(async)*
Renova o access token usando o refresh token via `/auth/v1/token?grant_type=refresh_token`. Atualiza `SESSION` e localStorage. Retorna `true`/`false`.

**Deps externas:** `SESSION` (state.js), `SUPABASE_URL`, `SUPABASE_KEY`, `localStorage`.

---

#### `authSair()` — linha 340
Logout: limpa `SESSION`, remove `rpghub_session` e `rpghub_nav` do localStorage, exibe tela de auth e reseta formulário.

**Deps externas:** `SESSION` (state.js), `localStorage`, `document.getElementById`, `authTab` (mesmo arquivo).

---

#### *(listener)* `window.addEventListener('load', ...)` — linha 352
Bootstrap da aplicação. Sequência de verificação na carga da página:
1. Link de confirmação de e-mail → `authVerificarConfirmacaoEmail`
2. Link de recuperação de senha → `authVerificarLinkRecuperacao`
3. Sessão salva no localStorage → `authRefreshSession` → `iniciarApp`
4. Sem sessão: exibe tela de login

**Deps externas:** `authVerificarConfirmacaoEmail`, `authVerificarLinkRecuperacao`, `esconderSplash`, `localStorage`, `SESSION`, `authRefreshSession`, `iniciarApp`, `document.getElementById` (mesmo arquivo / state.js / DOM).

---

#### `iniciarApp()` — linha 375 *(async)*
Bootstrap pós-login. Define `USER_ID`, carrega lista de RPGs, verifica navegação salva (`rpghub_nav`) para entrar diretamente numa campanha ou arena.

**Deps externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `SESSION` | objeto global | `js/state.js` |
| `USER_ID` | variável global | `js/state.js` |
| `HUB_DATA` | objeto global | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `getAllRPGs` | função | `js/core/supabase.js` |
| `renderRPGList` | função | mesmo arquivo (linha 414) |
| `localStorage` | Browser API | Browser |
| `salvarNav` | função | **não encontrada ainda** |
| `abrirArenaHub` | função | **não encontrada ainda** |
| `entrarArena` | função | **não encontrada ainda** |
| `entrarRPG` | função | **não encontrada ainda** |

---

#### `renderRPGList(rpgs)` — linha 414
Renderiza os cards de campanha e arena no hub. Separa os RPGs em campanhas normais e arenas, gerando HTML com ícones SVG e cores do tema.

**Deps externas:** `document.getElementById`, `getCardIconSVG` (core/utils.js), `entrarRPG`, `entrarArenaFromHub` (mesmo arquivo).

---

#### `entrarArenaFromHub(rpgId)` — linha 476 *(async)*
Abre o painel de arena e entra diretamente na sessão de arena salva.

**Deps externas:** `document.getElementById`, `carregarArenaList`, `entrarArena` (**ambas não encontradas ainda**).

---

### Fluxos de auth.js

```
CARGA DA PÁGINA
└── window.load
    ├── authVerificarConfirmacaoEmail() ──► [link de email?]
    │   └── [sim] ──► iniciarApp()
    ├── authVerificarLinkRecuperacao() ──► [link de recovery?]
    │   └── [sim] ──► authExibirFormNovaSenha()
    │                      └── authSalvarNovaSenha()
    ├── [sessão no localStorage?]
    │   └── authRefreshSession() ──► [ok?] ──► iniciarApp()
    └── [nenhum] ──► exibir tela de login

FLUXO DE LOGIN
authSubmit()
├── AUTH_MODE=login  ──► authEntrar() ──► SESSION preenchida ──► iniciarApp()
└── AUTH_MODE=cadastro ──► authCadastrar() ──► mensagem de sucesso

FLUXO DE INICIALIZAÇÃO
iniciarApp()
├── getAllRPGs() [supabase.js]
├── renderRPGList()
└── [nav salva?]
    ├── is_arena ──► abrirArenaHub() + entrarArena()
    └── campanha ──► entrarRPG()

FLUXO DE RECUPERAÇÃO DE SENHA
authMostrarRecuperacao() ──► authEnviarRecuperacao() ──► [email enviado]
[link no email] ──► authVerificarLinkRecuperacao() ──► authExibirFormNovaSenha()
                                                          └── authSalvarNovaSenha()
```

---

## 15. `js/core/supabase.js`

**Linhas:** 504  
**Descrição geral:** Camada de acesso a dados. Fornece o wrapper `sb()` para todas as chamadas REST ao Supabase, funções de leitura/escrita de personagens e RPGs, carregamento progressivo em 4 fases e o sistema de importação/atualização de RPG via CSV.

### Funções definidas

#### `sb(path, opts, _retry)` — linha 9 *(async)*
Wrapper central do Supabase REST API. Todas as operações de dados do sistema passam por aqui.

Comportamentos especiais:
- **401 (Unauthorized):** chama `authRefreshSession()` → repete a request; se falhar → `authSair()`
- **Timeout (código 57014):** retry automático até 3x com backoff linear (1s, 2s, 3s)
- **204 No Content:** retorna `null`
- **Body vazio:** retorna `null`

**Deps externas:** `SUPABASE_URL`, `SUPABASE_KEY` (config.js), `SESSION.access_token` (state.js), `authRefreshSession`, `authSair` (auth.js).

---

#### `uploadToStorage(file, folder)` — linha 43 *(async)*
Faz upload de um arquivo para o bucket `game-assets` do Supabase Storage. Gera nome único com timestamp + random. Retorna a URL pública do arquivo.

**Deps externas:** `SUPABASE_URL`, `SUPABASE_KEY`, `SESSION.access_token` (state.js).

---

#### `getAllRPGs()` — linha 67
Busca todos os RPGs do usuário via `sb()`. Usada por `iniciarApp` (auth.js).  
**Deps externas:** `sb` (mesmo arquivo).

---

#### `getRPGData(rpgId)` — linha 70 *(async)*
Retorna **imediatamente** um objeto vazio de RPG (sem chamadas de rede). O carregamento real é feito por `_carregarProgressivo()` em seguida. Permite que o app fique visível sem esperar os dados.

**Deps externas:** *Nenhuma* (retorna objeto estático).

---

#### `_carregarProgressivo(rpgId)` — linha 77 *(async)*
Carregamento em 4 fases sequenciais com status visual no elemento `#rpg-load-status`:

| Fase | Dados | Renderiza |
|------|-------|-----------|
| 0 | `attr_defs` + batalhas ativas + `atributos_grupos` | UI de batalha, badge da mesa |
| 1 | Mapas (sem imagens) | `renderMapasTab()` |
| 2 | Personagens (sem imagens) | `renderCharButtons`, `renderCharView`, `renderAttrView`, tokens no mapa |
| 3 | Skills + Lore + Criativos | `renderLore`, `renderConfig`, `criativoRenderMestre` |
| 4 | Imagens dos mapas | `renderMapaViewer` *(não-bloqueante — 300ms delay)* |

**Deps externas (selecionadas):**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função | mesmo arquivo |
| `RPG_DATA`, `MAPA_STATE`, `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR`, `CRIATIVOS_CAMP` | globais | `js/state.js` |
| `ATTR_MAPPING_CACHE` | variável | **não encontrada ainda** |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |
| `_atualizarBadgeMesa` | função | **não encontrada ainda** |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `_mapaInicializarLayout` | função | `js/maps/maps.js` (provável) |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | **não encontrada ainda** |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | **não encontrada ainda** |
| `mapaRenderTokens` | função | `js/maps/maps.js` (provável) |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |
| `renderLore` | função | `js/systems/lore.js` |
| `renderConfig` | função | **não encontrada ainda** |
| `criativoRenderMestre` | função | `js/systems/creative.js` (provável) |
| `renderMapaViewer` | função | `js/maps/maps.js` (provável) |

---

#### `saveCharacterStats(rpgId, charName, stats)` — linha 192 *(async)*
Persiste `hp_atual` e/ou `custom_attrs` de um personagem via PATCH.  
**Deps externas:** `sb`.

---

#### `saveMemberLinked(rpgId, charName)` — linha 200 *(async)*
Vincula o jogador logado a um personagem em `rpg_members`.  
**Deps externas:** `SESSION`, `sb`, `mostrarToast`.

---

#### `deleteRPGData(rpgId)` — linha 207 *(async)*
Remove o RPG da tabela `rpg_registry`. Bloqueia o RPG `'dual'`.  
**Deps externas:** `sb`.

---

#### `buildLevelConfig(cfg)` — linha 214
Constrói objeto de configuração de nível a partir de uma linha de config CSV. Retorna `null` se nenhum campo válido for encontrado. Função pura.

---

#### `calcularHpMaxComAtributos(lc, charAtributos, hpMaxExplicito, nivel)` — linha 232
Calcula o HP máximo de um personagem. HP explícito tem prioridade; caso contrário, usa `hp_base + bonus_por_nivel + atributo * multiplicador`. Função pura.

---

#### `buildTheme(cfg)` — linha 246
Constrói o objeto de tema completo (cores, fontes, animações, level_config) a partir de uma linha de config CSV.  
**Deps internas:** `buildLevelConfig` (mesmo arquivo).

---

#### `insertSection(rpgId, section, rows, levelConfig)` — linha 277 *(async)*
Insere linhas em qualquer tabela do sistema. Suporta: `characters`, `skills`, `lore`, `mapas`, `attr_defs`, `item_catalog`, `inventario`.

Lógica especial por seção:
- **characters**: auto-correção de colunas invertidas (companheiro/equipamentos), parse de `atributos_json`, cálculo de `hp_max`
- **skills**: resolve `character_id` por nome (query extra em `characters`)
- **inventario**: resolve `character_id` e `item_catalog_id` por nome (2 queries extras)

**Deps externas:** `sb`, `normalizeImgUrl` (state.js), `calcularHpMaxComAtributos` (mesmo arquivo).

---

#### `importRPG(payload, mapasJSON)` — linha 422 *(async)*
Importa um RPG completo a partir do payload processado de um CSV. Sequência:
1. Cria entrada em `rpg_registry`
2. Vincula o criador como mestre em `rpg_members`
3. Insere seções em ordem: characters → skills → lore → attr_defs → mapas → item_catalog → inventario
4. Importa mapeamento de atributos (`attr_grupos`) e vocabulário temático
5. Importa mapas JSON (se fornecido)

**Deps externas:** `sb`, `buildTheme`, `buildLevelConfig`, `SESSION`, `insertSection`, `importarMapasJSON` (**não encontrada ainda**), `_mapeamentoCache` (**não encontrada ainda**).

---

#### `updateRPG(rpgId, payload)` — linha 481 *(async)*
Atualiza um RPG existente. Para cada seção: deleta os dados antigos e re-insere com `insertSection`. Para `config`: atualiza `theme_json` via PATCH.

**Deps externas:** `sb`, `buildTheme`, `insertSection` (mesmo arquivo).

---

### Fluxos de supabase.js

```
TODAS AS OPERAÇÕES DE DADOS
└── sb(path, opts)
    ├── [401] ──► authRefreshSession() ──► [ok] ──► retry sb()
    │                                      └── [fail] ──► authSair()
    ├── [57014 timeout] ──► retry com backoff (até 3x)
    └── [sucesso] ──► JSON.parse(response)

ENTRADA NO RPG (chamada por entrarRPG — não mapeado ainda)
└── getRPGData(rpgId) ──► retorna objeto vazio imediatamente
    └── _carregarProgressivo(rpgId)
        ├── Fase 0: attr_defs + batalhas ──► _aplicarEstadoBatalhaUI()
        ├── Fase 1: mapas ──► renderMapasTab()
        ├── Fase 2: characters ──► renderCharButtons() + renderCharView()
        ├── Fase 3: skills + lore + criativos ──► renderLore() + renderConfig()
        └── Fase 4: imagens [300ms delay, não bloqueante] ──► renderMapaViewer()

IMPORTAÇÃO DE RPG
importRPG(payload)
├── sb('rpg_registry', POST) ──► cria registro
├── sb('rpg_members', POST) ──► vincula mestre
└── insertSection() [×7 seções em sequência]
    ├── characters: normalizeImgUrl + calcularHpMaxComAtributos + sb(POST)
    ├── skills: resolve character_id + sb(POST)
    └── inventario: resolve character_id + item_catalog_id + sb(POST)

VÍNCULO DE DADOS (sb ↔ auth)
sb() ──► authRefreshSession() [auth.js]
authEntrar() ──► SESSION preenchida ──► sb() passa a enviar Bearer token
```

---

### Atualização: resolução de `mostrarToast`

`mostrarToast` é chamada em `saveMemberLinked` (supabase.js), `mapaToggleLock` (state.js), `rest.js`, `npcs.js`, `chat.js`, `animations.js` e outros. Após análise de todos os arquivos mapeados, **ainda não foi encontrada definida**. Provavelmente está em `js/ui/modals.js` ou `js/hub/hub.js`.

---

---

## 16. `js/characters/characters.js`

**Linhas:** 581  
**Descrição geral:** Sistema de XP, level up, distribuição de pontos de atributo e renderização do painel de atributos (`renderAttrView`). Também cobre edição e renomeação de personagens com cascata de dados.

### Variáveis/constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `_xpModalNome` | 92 | Nome do personagem aberto no modal de XP; `null` quando fechado |

### Funções definidas

#### `abrirModalLevelUp(nome)` — linha 6
Abre overlay de confirmação de level up. Lê `CURRENT_RPG.theme.level_config` para montar preview: HP ganho, pontos de atributo, aumentos automáticos, habilidades desbloqueadas.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `document.body.appendChild` | DOM API | Browser |

---

#### `executarLevelUp(nome)` — linha 44 *(async)*
Aplica o level up: incrementa `nivel`, zera `xp`, acumula `pontos_attr`, aplica aumentos automáticos de atributo, recalcula `hp_max` via `recalcularHpMax`, persiste via `sb()`, atualiza `renderCharView`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `recalcularHpMax(c)` | função | **não encontrada ainda** |
| `sb(path, opts)` | função async | `js/core/supabase.js` |
| `mostrarToast(msg, tipo)` | função | **não encontrada ainda** |
| `renderCharView(nome)` | função | `js/systems/lore.js` |

---

#### `abrirModalXP(nome)` — linha 94
Abre modal de XP: define `_xpModalNome`, preenche nome no header, chama `xpAtualizarModalUI`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `xpAtualizarModalUI` | função | mesmo arquivo |

---

#### `fecharModalXP()` — linha 105
Fecha modal de XP e limpa `_xpModalNome`.

---

#### `xpAtualizarModalUI(nome)` — linha 110
Atualiza barra de progresso de XP, label de nível, botão de level up e botão de forçar level up no modal.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |

---

#### `xpDarRapido(quantidade)` — linha 144 *(async)*
Adiciona XP ao personagem aberto no modal, salva, verifica auto level up, mostra toast.

**Dependências externas:** `xpSalvarChar`, `xpChecarAutoLevelUp`, `mostrarToast`, `RPG_DATA.characters`

---

#### `xpDarParaTodos()` — linha 160
Toggle do painel de XP para todos os jogadores.

---

#### `xpConfirmarTodos()` — linha 167 *(async)*
Distribui XP para todos os personagens tipo `'jogador'`. Para cada um: atualiza `ca.xp`, chama `xpSalvarChar`, verifica auto level up.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters` | array global | `js/state.js` |
| `xpSalvarChar` | função | mesmo arquivo |
| `xpChecarAutoLevelUp` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |
| `xpAtualizarModalUI` | função | mesmo arquivo |

---

#### `xpSalvarManual()` — linha 187 *(async)*
Define o XP do personagem para um valor fixo digitado no input, salva, verifica auto level up.

**Dependências externas:** `xpSalvarChar`, `xpChecarAutoLevelUp`, `mostrarToast`

---

#### `xpExecutarLevelUp()` — linha 204 *(async)*
Botão de level up automático no modal XP. Delega para `executarLevelUp`, depois atualiza UI do modal.

---

#### `xpForcarLevelUp()` — linha 212 *(async)*
Botão de forçar level up (mestre). Delega para `abrirModalLevelUp`.

---

#### `xpChecarAutoLevelUp(nome)` — linha 219 *(async)*
Verifica se o personagem atingiu XP suficiente para subir de nível. Se sim, chama `executarLevelUp` silenciosamente.

**Dependências externas:** `RPG_DATA.characters`, `CURRENT_RPG.theme.level_config`, `executarLevelUp`, `mostrarToast`, `xpAtualizarModalUI`

---

#### `xpSalvarChar(c, ca)` — linha 237 *(async)*
Persiste `custom_attrs` e `xp` do personagem via PATCH no Supabase.

**Dependências externas:** `sb`, `RPG_DATA.rpgId`, `mostrarToast`

---

#### `distribuirPontosAttr(nome)` — linha 246 *(async)*
Lê os inputs `pa-{attr}` do DOM, valida que total não excede `pontos_attr`, aplica aumentos, recalcula `hp_max` via `calcularHpMaxComAtributos`, persiste via `sb()`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters`, `RPG_DATA.attrDefs` | globals | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `calcularHpMaxComAtributos(lc, atribs, hpMax, nivel)` | função | `js/core/supabase.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | mesmo arquivo |

---

#### `renderAttrButtons()` — linha 280
Reconstrói o seletor de personagens da aba Atributos. Wrapper para `buildCharBtns('attr')` e `_charSearchToggle`.

**Dependências externas:** `buildCharBtns`, `_charSearchToggle` — ambas em `js/systems/lore.js`

---

#### `renderAttrView(nome)` — linha 286
Renderiza o painel completo de atributos. Inclui: avatar (suporta APMOD builder via `apmodTokenSVG`), barra de HP, salvaguardas de morte, stat boxes por categoria (básicos/especiais/status/resistência), toggle de ocultar atributos (mestre+NPC), formulário de edição com campos por tipo de `attrDef`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.characters`, `RPG_DATA.attrDefs`, `RPG_DATA.myRole` | globals | `js/state.js` |
| `normalizeImgUrl(url)` | função | `js/state.js` |
| `apmodTokenSVG(c, modo)` | função | **não encontrada ainda** |
| `podeEditarPersonagem(nome)` | função | `js/core/events.js` |
| `toggleEdit(nome)` | função | mesmo arquivo |
| `attrviewToggleOcultarAtribs` | função | mesmo arquivo |
| `salvarAtributos` | função | mesmo arquivo |

---

#### `toggleEdit(nome)` — linha 457
Toggle de visibilidade do form `#edit-form-{nome}` (aba Atributos).

---

#### `toggleEditChar(nome)` — linha 458
Toggle de visibilidade do form `#edit-char-form-{nome}` (aba Personagem).

---

#### `attrviewToggleOcultarAtribs(nome)` — linha 461 *(async)*
Lê o estado do checkbox `#attrview-toggle-ocultar` e persiste `ocultar_atributos` via `sb()` (aba Atributos).

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`

---

#### `charviewToggleOcultarAtribs(nome, checked)` — linha 473 *(async)*
Persiste `ocultar_atributos` a partir de um parâmetro booleano direto (chamada inline do HTML na aba Personagem).

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `sb`, `mostrarToast`

---

#### `salvarAtributos(nome)` — linha 485 *(async)*
Lê inputs `fca-{attr}` + `f-hp_atual`, recalcula `hp_max` via `calcularHpMaxComAtributos`, persiste via PATCH, re-renderiza `renderAttrView`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.characters`, `RPG_DATA.attrDefs`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `calcularHpMaxComAtributos` | função | `js/core/supabase.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderAttrView` | função | mesmo arquivo |

---

#### `salvarInfoPersonagem(nome)` — linha 524 *(async)*
Salva informações do personagem (tipo, cor, classe, raça, imagem, pet). Suporta renomeação com cascata: atualiza `skills.personagem`, `rpg_members.linked`, e as variáveis globais `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR`, `RPG_DATA.linked`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.characters`, `RPG_DATA.skills`, `RPG_DATA.linked`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharButtons`, `renderAttrButtons` | funções | `js/systems/lore.js` / mesmo arquivo |
| `renderConfig` | função | **não encontrada ainda** |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | mesmo arquivo |

---

### Fluxos de characters.js

```
SISTEMA DE XP
xpDarRapido(qtd) ──► xpSalvarChar(c, ca) ──► sb() [PATCH characters]
                └──► xpChecarAutoLevelUp(nome)
                         └── [xp >= threshold] ──► executarLevelUp(nome)

xpConfirmarTodos() ──► [para cada PC] ──► xpSalvarChar + xpChecarAutoLevelUp

xpSalvarManual() ──► xpSalvarChar ──► xpChecarAutoLevelUp

NÍVEL UP
abrirModalLevelUp(nome) ──► [overlay DOM] ──► executarLevelUp(nome) [on confirm]
    └── executarLevelUp(nome)
            ├── recalcularHpMax(c)   [não encontrada ainda]
            ├── sb() [PATCH characters]
            └── renderCharView(nome)

xpForcarLevelUp() ──► abrirModalLevelUp(nome)
xpExecutarLevelUp() ──► executarLevelUp(nome)

DISTRIBUIÇÃO DE PONTOS
distribuirPontosAttr(nome)
    ├── [lê inputs pa-{attr}]
    ├── calcularHpMaxComAtributos() [supabase.js]
    ├── sb() [PATCH characters]
    ├── renderCharView(nome) [lore.js]
    └── renderAttrView(nome) [mesmo arquivo]

SALVAR ATRIBUTOS (aba Atributos)
salvarAtributos(nome)
    ├── [lê inputs fca-{attr} + f-hp_atual]
    ├── calcularHpMaxComAtributos()
    ├── sb() [PATCH characters]
    └── renderAttrView(nome)

RENOMEAR PERSONAGEM (salvarInfoPersonagem)
salvarInfoPersonagem(nome)
    ├── sb() [PATCH characters → nome=novoNome]
    ├── sb() [PATCH skills → personagem=novoNome]
    ├── sb() [PATCH rpg_members → linked=novoNome]
    ├── [atualiza CHAR_VIEW, ATTR_VIEW, CFG_CHAR, RPG_DATA.linked]
    ├── renderCharButtons() + renderAttrButtons() + renderConfig() + renderHeader()
    └── renderCharView(novoNome) + renderAttrView(novoNome)
```

---

## 17. `js/characters/skills.js`

**Linhas:** 627  
**Descrição geral:** CRUD de habilidades, lore e mapas. Formula builder para dano de habilidades. Criação de personagens. O arquivo termina com `PLACEMENT_STATE = null` — o sistema de placement de mapas continua em `js/maps/maps.js`.

### Variáveis/constantes definidas

| Nome | Linha | Descrição |
|------|-------|-----------|
| `SK_FB` | 68 | Array de grupos da fórmula de dano em construção. Cada grupo: `{tipo:'dado', faces, qtd}` ou `{tipo:'bonus', valor}` |
| `PLACEMENT_STATE` | 627 | Estado do modo de posicionamento de mapa local (valor inicial `null`; lógica continua em `maps.js`) |

### Funções definidas

#### `abrirModalNovoChar()` — linha 10
Abre modal de criação de personagem. Pré-preenche HP base a partir de `CURRENT_RPG.theme.level_config`.

**Dependências externas:** `CURRENT_RPG.theme.level_config` (state.js)

---

#### `fecharModalNovoChar()` — linha 24
Fecha o modal de criação.

---

#### `criarNovoPersonagem()` — linha 27 *(async)*
Cria novo personagem via `sb()`, calcula `hp_max` a partir do nível e do `level_config`, adiciona a `RPG_DATA.characters`, re-renderiza botões.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `CURRENT_RPG.theme.level_config` | objeto global | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | `js/characters/characters.js` |
| `renderConfig` | função | **não encontrada ainda** |

---

#### `skFBAdicionarDado(faces)` — linha 70
Incrementa (ou insere) um grupo de dado no `SK_FB` e atualiza a UI.

**Dependências externas:** `skFBAtualizarUI` (mesmo arquivo)

---

#### `skFBRemoverDado(faces)` — linha 76
Decrementa (ou remove) um grupo de dado do `SK_FB`.

---

#### `skFBAdicionarBonus()` — linha 83
Usa `prompt()` para pedir valor, adiciona/merge ao grupo bonus em `SK_FB`.

---

#### `skFBLimpar()` — linha 91
Limpa `SK_FB` e atualiza UI.

---

#### `skFBAtualizarUI()` — linha 92
Re-renderiza chips visuais do formula builder (`#sk-fb-chips`), preview (`#sk-fb-preview`), e o campo oculto `#sk-formula`. Usa `formulaDeGrupos(SK_FB)` se disponível, senão monta string manualmente.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `formulaDeGrupos(SK_FB)` | função | **não encontrada ainda** |

---

#### `skFBCarregarFormula(formula)` — linha 111
Faz parse de uma string de fórmula (ex: `2d6+3`) de volta para o array `SK_FB`. Suporta múltiplos dados e bônus.

---

#### `skPopularAtributos()` — linha 122
Preenche o `<select>` `#sk-atributo-base` com os atributos de tipo `number` definidos em `RPG_DATA.attrDefs`.

**Dependências externas:** `RPG_DATA.attrDefs` (state.js)

---

#### `abrirModalSkill(skillId, personagemNome)` — linha 133
Abre o modal de habilidade em modo edição (se `skillId`) ou criação. Popula ~20 campos: nome, custo, efeito, fórmula de dano (via `skFBCarregarFormula`), cooldown, tipo de dano, alcance, atributo base, tipo de alvo, crits, efeitos bônus, campos de invocação, e todos os campos de animação. Aplica limite de duração para não-mestre (3000ms).

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.skills` | array global | `js/state.js` |
| `_skModalCharId` | variável global | `js/state.js` |
| `_skCharId(nome)` | função | `js/state.js` |
| `CHAR_VIEW` | variável global | `js/state.js` |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `skFBCarregarFormula` | função | mesmo arquivo |
| `skPopularAtributos` | função | mesmo arquivo |
| `skAlvoTipoChange` | função | **não encontrada ainda** |
| `skTipoDanoChange` | função | **não encontrada ainda** |
| `SK_EFEITOS_TEMP` | array global | **não encontrada ainda** |
| `skRenderEfeitosLista` | função | **não encontrada ainda** |
| `skAnimTipoChange` | função | **não encontrada ainda** |
| `skAnimValidarDuracao` | função | **não encontrada ainda** |

---

#### `fecharModalSkill()` — linha 232
Fecha o modal de habilidade.

---

#### `salvarSkill()` — linha 235 *(async)*
Valida e persiste uma habilidade (POST ou PATCH). Valida limite de duração de animação (3000ms para jogadores, 10000ms para mestre). Atualiza `RPG_DATA.skills` localmente, re-renderiza `renderCharView` se for o personagem atual.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `podeEditarPersonagem` | função | `js/core/events.js` |
| `RPG_DATA.skills`, `RPG_DATA.rpgId`, `RPG_DATA.myRole` | globals | `js/state.js` |
| `_skModalCharId`, `_skCharId` | global/função | `js/state.js` |
| `CHAR_VIEW` | global | `js/state.js` |
| `SK_EFEITOS_TEMP` | array global | **não encontrada ainda** |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |

---

#### `removerSkill(skillId, nome, personagem)` — linha 321 *(async)*
Confirma e deleta habilidade via `sb()`, remove de `RPG_DATA.skills`, re-renderiza.

**Dependências externas:** `podeEditarPersonagem`, `sb`, `RPG_DATA.skills`, `CHAR_VIEW`, `renderCharView`, `mostrarToast`

---

#### `abrirModalLore(loreId)` — linha 333
Abre modal de lore em modo edição ou criação. *Nota: esta função está em skills.js, não em lore.js — foi definida aqui por conveniência.*

---

#### `fecharModalLore()` — linha 352
Fecha modal de lore.

---

#### `salvarLore()` — linha 355 *(async)*
Valida permissão `editar_lore`, persiste lore via `sb()`, atualiza `RPG_DATA.lore`, re-renderiza `renderLore()`.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `temPermissao('editar_lore')` | função | `js/core/events.js` |
| `RPG_DATA.lore`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderLore` | função | `js/systems/lore.js` |

---

#### `removerLore(loreId, titulo)` — linha 377 *(async)*
Confirma e deleta entrada de lore, remove de `RPG_DATA.lore`, re-renderiza.

**Dependências externas:** `temPermissao`, `sb`, `RPG_DATA.lore`, `renderLore`, `mostrarToast`

---

#### `abrirModalNovoMapa()` — linha 389
Abre o modal de criação de mapa. Pré-seleciona tipo tático se já há mapa ativo. Detecta unidade de escala do mapa pai. Registra handler de Escape.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.mapas` | array global | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade global | `js/state.js` |
| `nmBgTab` | função | **não encontrada ainda** |
| `nmBgClearUpload` | função | **não encontrada ainda** |
| `nmCE` | objeto global | **não encontrada ainda** |
| `nmceBgRender` | função | **não encontrada ainda** |
| `nmTipoChange` | função | mesmo arquivo |
| `nmParentChange` | função | mesmo arquivo |

---

#### `nmTipoChange(tipo)` — linha 449
Filtra os mapas disponíveis para seletor de pai conforme o tipo (geral/tático), mostra/oculta a seção de pai, chama `nmceUpdateIsoGuide`.

**Dependências externas:** `RPG_DATA.mapas`, `nmceUpdateIsoGuide` (**não encontrada ainda**)

---

#### `nmParentChange(paiId)` — linha 473
Atualiza labels de unidade e chama `nmAtualizarPreview` ao mudar o mapa pai.

---

#### `nmAtualizarPreview()` — linha 487
Calcula e exibe dimensões de exibição do novo mapa em relação ao mapa pai (em unidades reais e percentual).

**Dependências externas:** `RPG_DATA.mapas`

---

#### `fecharModalNovoMapa()` — linha 513
Fecha o modal de criação de mapa e remove o handler de Escape.

---

#### `criarNovoMapa()` — linha 518 *(async)*
Cria novo mapa: calcula `zona_w_percent`/`zona_h_percent` a partir das dimensões reais, obtém imagem via `nmBgGetFinal()`, persiste via `sb()`, adiciona a `RPG_DATA.mapas`, ativa modo de placement se tiver mapa pai.

**Dependências externas:**

| Dependência | Tipo | Origem |
|-------------|------|--------|
| `RPG_DATA.mapas`, `RPG_DATA.rpgId` | globals | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | propriedade global | `js/state.js` |
| `nmBgGetFinal` | função | **não encontrada ainda** |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderMapasTab` | função | **não encontrada ainda** |
| `selecionarMapa` | função | **não encontrada ainda** |
| `ativarModoPlacement` | função | **não encontrada ainda** |

---

### Fluxos de skills.js

```
CRIAR PERSONAGEM
abrirModalNovoChar() ──► [modal DOM]
criarNovoPersonagem()
    ├── sb('characters', POST)
    ├── RPG_DATA.characters.push(novo)
    ├── renderCharButtons() [lore.js]
    ├── renderAttrButtons() [characters.js]
    └── renderConfig() [não mapeado]

FORMULA BUILDER (SK_FB)
skFBAdicionarDado(faces) ──► skFBAtualizarUI()
skFBRemoverDado(faces) ──► skFBAtualizarUI()
skFBAdicionarBonus() ──► [prompt] ──► skFBAtualizarUI()
skFBCarregarFormula(str) ──► [parse] ──► skFBAtualizarUI()
skFBAtualizarUI() ──► formulaDeGrupos(SK_FB) ──► [render chips + preview]

CRUD DE HABILIDADE
abrirModalSkill(id, nome)
    ├── [edição] ──► skFBCarregarFormula + skPopularAtributos
    └── [criação] ──► skFBLimpar + skPopularAtributos

salvarSkill()
    ├── [valida duração de animação]
    ├── [edição] ──► sb('skills', PATCH) ──► RPG_DATA.skills[idx] = {...}
    └── [criação] ──► sb('skills', POST) ──► RPG_DATA.skills.push(nova)
    └── renderCharView(personagem) [lore.js]

removerSkill(id)
    ├── sb('skills', DELETE)
    ├── RPG_DATA.skills = filter(...)
    └── renderCharView(personagem) [lore.js]

CRUD DE LORE
abrirModalLore(id) ──► [modal DOM]
salvarLore()
    ├── [edição] ──► sb('lore', PATCH) ──► RPG_DATA.lore[idx] = {...}
    └── [criação] ──► sb('lore', POST) ──► RPG_DATA.lore.push(novo)
    └── renderLore() [lore.js]

CRIAR MAPA
abrirModalNovoMapa()
    ├── nmTipoChange(tipo) ──► [popula seletor de pai]
    └── nmParentChange(paiId) ──► nmAtualizarPreview()

criarNovoMapa()
    ├── [calcula zona_w/h_percent a partir de dimensões reais]
    ├── nmBgGetFinal() ──► [obtém URL de fundo]
    ├── sb('mapas', POST)
    ├── RPG_DATA.mapas.push(entry)
    ├── renderMapasTab() [não mapeado]
    ├── [sem pai] ──► selecionarMapa(map_id)
    └── [com pai] ──► selecionarMapa(parentId) + ativarModoPlacement(map_id, ...)
```

---

### Relação entre characters.js e skills.js

Esses dois arquivos formam o subsistema de gestão de personagens:

```
characters.js (atributos, XP, level up, info)
     │
     ├── renderAttrView(nome) ◄── chamada também por salvarAtributos e distribuirPontosAttr
     │
     └── salvarInfoPersonagem(nome) ──► [cascade rename]
              ├── skills.personagem
              ├── rpg_members.linked
              └── CHAR_VIEW / ATTR_VIEW / CFG_CHAR

skills.js (habilidades, lore, mapas, novo personagem)
     │
     ├── salvarSkill() ──► renderCharView() [lore.js - renderiza lista de skills]
     ├── salvarLore() ──► renderLore() [lore.js]
     └── criarNovoMapa() ──► ativarModoPlacement() [maps.js - não mapeado]

Ambos dependem de:
    ├── podeEditarPersonagem / temPermissao [events.js]
    ├── sb() [supabase.js]
    ├── renderCharView / renderCharButtons / renderLore [lore.js]
    └── RPG_DATA / CHAR_VIEW / CURRENT_RPG [state.js]
```

*— Documento em construção. Atualizado a cada novo arquivo mapeado.*

---

## 19. `js/systems/inventory.js` *(linhas 1–2222 — Completo)*

**Linhas totais:** 2222
**Descrição geral (parcial):** Sistema completo de inventário e equipamentos. Gerencia carregamento de dados (`item_catalog`, `tabelas`, `item_usos`), renderização da aba de tabelas e catálogo, inventário na ficha do personagem, equipar/desequipar com aplicação de bônus de atributos, e uso de itens consumíveis. Inclui o wizard de criação de campanha (`CRIAR_STATE`, citado no cabeçalho do arquivo).

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `INV` | 8 | `const` objeto | Estado global do sistema de inventário: `itemDefs`, `inventario`, `tabelas`, `usosPendentes`, `catalogo`, `inventarios`, `carregado`, `charAtivo`, `charId` |
| `SLOTS_LABELS` | 22 | `const` objeto | Mapa de chave de slot → `{ label, icon }` para os 10 slots de equipamento |
| `_invEquipando` | 359 | `let` bool | Guard contra duplo clique em equipar/desequipar |
| `_usarItemCtx` | 472 | `let` object\|null | Contexto do item aberto no modal de uso: `{ invItem, def, nomeUsuario }` |
| `_addInvCharId` | 817 | `let` number\|null | ID do personagem alvo do modal de adicionar ao inventário |
| `_addInvCharNome` | 818 | `let` string\|null | Nome do personagem alvo do modal de adicionar ao inventário |
| `_itemDefEfeitos` | 885 | `let` array | Buffer de efeitos sendo editados no modal de criar/editar item |
| `_itemDefBonus` | 886 | `let` object | Buffer de bônus de atributos sendo editados no modal de criar/editar item |

### Monkey-patches registrados na carga

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.entrarRPG` | 101 | Após entrar no RPG: chama `invCarregarDados`, `renderTabelasTab`, `renderMestreBtnsTabelas`, `renderItensPendentes` |
| `window.renderCharView` | 113 | Após renderizar ficha: chama `renderInventarioChar(nome)` |

### Funções definidas (linhas 1–500)

#### `invCarregarDados(rpgId)` — linha 36 *(async)*
Carrega em paralelo via `sb()`: `item_catalog` (com todos os campos), `tabelas` e `item_usos` com status pendente. Agenda carregamento lazy de imagens via `requestIdleCallback` (fallback: `setTimeout` 2s).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `_invCarregarImagensItens` | função | mesmo arquivo (linha 53) |
| `requestIdleCallback` | Browser API | Browser |

---

#### `_invCarregarImagensItens(rpgId)` — linha 53 *(async)*
Busca apenas `id` e `img_url` do `item_catalog` e atualiza o cache `INV.itemDefs` sem bloquear o carregamento principal. Erros ignorados silenciosamente.

**Dependências externas:** `sb`, `INV.itemDefs`.

---

#### `invCarregarInventarioChar(charId)` — linha 66 *(async)*
Busca o inventário de um personagem específico, mescla no cache global `INV.inventario` (remove entradas antigas do mesmo `charId`, insere novas).

**Dependências externas:** `sb`, `INV.inventario`.

---

#### `invCarregarTodosInventarios()` — linha 76 *(async)*
Itera sobre todos os personagens em `RPG_DATA.characters` e carrega seus inventários sequencialmente, preenchendo `INV.inventario` e `INV.inventarios[charId]`.

**Dependências externas:** `RPG_DATA.characters`, `sb`, `INV`.

---

#### `renderMestreBtnsTabelas()` — linha 122
Exibe ou oculta `#tabelas-mestre-btns` conforme o papel do usuário.

**Dependências externas:** `document.getElementById`, `RPG_DATA.myRole`.

---

#### `renderTabelasTab()` — linha 132
Renderiza duas seções na aba de tabelas:
1. **Tabelas genéricas:** cards com cabeçalho, `<table>` HTML renderizada a partir de `t.colunas` e `t.linhas`, botões de editar/deletar/toggle visibilidade (mestre)
2. **Catálogo de itens:** lista de `INV.itemDefs` com ícone/imagem, raridade, efeitos via `_efeitoLabel`, bônus de atributos, slot e botões de editar/deletar (mestre)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.tabelas`, `INV.itemDefs` | estado global | mesmo arquivo |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `SLOTS_LABELS` | constante | mesmo arquivo |
| `_efeitoLabel` | função | mesmo arquivo (linha 215) |
| `_resolveItemImgSrc` | função | **não encontrada ainda** (linhas > 500) |
| `abrirModalTabela`, `deletarTabela`, `toggleVisibilidadeTabela` | funções | **não encontradas ainda** |
| `abrirEditarItemCatalogo`, `deletarItemDef` | funções | **não encontradas ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `_efeitoLabel(ef)` — linha 215
Função pura. Converte um objeto de efeito em string legível. Suporta tipos: `hp`, `recurso`, `atributo`, `remover_debuff`, `dano`, `debuff`, `buff`, `dot`.

**Dependências externas:** *Nenhuma.*

---

#### `renderItensPendentes()` — linha 232
Exibe aprovações pendentes de uso de item apenas para o mestre. Renderiza lista de `INV.usosPendentes` com info do item, quem usou e em quem, mais botões de Aprovar/Rejeitar.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.usosPendentes`, `INV.itemDefs` | estado global | mesmo arquivo |
| `RPG_DATA.myRole`, `RPG_DATA.characters` | propriedades | `js/state.js` |
| `_efeitoLabel` | função | mesmo arquivo |
| `aprovarUsoItem`, `rejeitarUsoItem` | funções | **não encontradas ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `renderInventarioChar(nome)` — linha 260 *(async)*
Renderiza a seção de inventário dentro do `#char-view`. Carrega o inventário do personagem via `invCarregarInventarioChar`, separa itens em **equipamentos** (com grid de slots) e **consumíveis** (com botão Usar). Injeta ou substitui `#inv-section-{charId}` no final da ficha.

Lógica de slots: cada slot mostra o item equipado (com bônus), item disponível para equipar (em tom reduzido) ou slot vazio.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.myRole`, `RPG_DATA.linked` | globais | `js/state.js` |
| `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `SLOTS_LABELS` | constante | mesmo arquivo |
| `invCarregarInventarioChar` | função | mesmo arquivo (linha 66) |
| `_efeitoLabel` | função | mesmo arquivo (linha 215) |
| `invToggleEquip` | função | mesmo arquivo (linha 360) |
| `abrirModalAddInv` | função | **não encontrada ainda** |
| `abrirModalUsarItem` | função | mesmo arquivo (linha 474) |
| `document.getElementById` | DOM API | Browser |

---

#### `invToggleEquip(nomeChar, invId)` — linha 360 *(async)*
Equipa ou desequipa um item. Guard contra duplo clique (`_invEquipando`). Se equipando e o slot já está ocupado, desequipa o item anterior primeiro. Delega para `_invEquipar` ou `_invDesequipar`.

**Dependências externas:** `INV.inventario`, `INV.itemDefs`, `RPG_DATA.characters`, `_invEquipar`, `_invDesequipar`, `renderInventarioChar` (mesmo arquivo).

---

#### `_invEquipar(nomeChar, invItem, def)` — linha 392 *(async)*
Aplica bônus de atributos do item ao personagem (suporta modo percentual e absoluto), atualiza `invItem.equipado`, `slot_equipado` e `bonus_snapshot` (delta real aplicado), persiste via PATCH paralelo em `inventario` e `characters`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.rpgId` | globais | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | `js/characters/characters.js` |

---

#### `_invDesequipar(nomeChar, invItem, def)` — linha 431 *(async)*
Reverte bônus de atributos usando `bonus_snapshot` (se disponível) ou os valores brutos do item como fallback. Persiste via PATCH paralelo.

**Dependências externas:** (mesmas de `_invEquipar`).

---

#### `abrirModalUsarItem(invId, nomeUsuario)` — linha 474 *(async)*
Carrega todos os inventários se necessário, localiza o item e a definição, preenche o modal de uso (`#usar-item-nome`, `#usar-item-desc`, `#usar-item-efeitos`, `#usar-item-alvo-sel`). Monta lista de alvos filtrada por `def.alvo` (`'self'`/`'aliado'`/`'inimigo'`). Para cada candidato, calcula distância euclidiana no grid do mapa (usando `escala_val` e `grid`) e desabilita alvos fora de `def.alcance_m`. Exibe aviso de aprovação para jogadores quando `def.requer_aprovacao` ou `def.alvo` não definido.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `invCarregarTodosInventarios` | função | mesmo arquivo |
| `RPG_DATA.characters`, `RPG_DATA.myRole`, `RPG_DATA.mapas` | globais | `js/state.js` |
| `MAPA_STATE.mapaAtualId` | global | `js/maps/maps.js` |
| `selecionarAlvoItem` | função | mesmo arquivo (linha 562) |
| `document.getElementById` | DOM API | Browser |

---

#### `selecionarAlvoItem(alvoId, alvoNome, btn)` — linha 562
Marca o alvo selecionado no modal de uso: escreve `alvoId` em `#usar-item-alvo-sel`, redefine estilos de todos os botões na lista e destaca o botão clicado em azul.

**Dependências externas:** `document.getElementById`, `document.querySelectorAll`.

---

#### `fecharModalUsarItem()` — linha 572
Oculta o overlay `#modal-usar-item-overlay` e limpa `_usarItemCtx`.

**Dependências externas:** `document.getElementById`.

---

#### `confirmarUsarItem()` — linha 577 *(async)*
Orquestrador de uso de item. Fluxo:
1. Valida contexto e alvo.
2. Se `precisaAprovacao` **e** usuário não é mestre → POST em `item_usos` (status `'pendente'`), atualiza `INV.usosPendentes`, chama `renderItensPendentes` e fecha o modal.
3. Caso contrário → chama `_aplicarEfeitosItem` (imediato) e depois `_consumirItem`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA.characters`, `RPG_DATA.rpgId`, `RPG_DATA.myRole` | globais | `js/state.js` |
| `INV.usosPendentes`, `INV.inventario`, `INV.itemDefs` | estado global | mesmo arquivo |
| `_aplicarEfeitosItem` | função | mesmo arquivo (linha 624) |
| `_consumirItem` | função | mesmo arquivo (linha 759) |
| `renderItensPendentes` | função | mesmo arquivo (linha 232) |
| `fecharModalUsarItem` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |

---

#### `_aplicarEfeitosItem(efeitos, alvoNome, usuarioNome)` — linha 624 *(async)*
Itera sobre o array de efeitos do item e aplica cada um ao personagem alvo. Detecta contexto de Arena (`AR.session`) e usa `arSb` ou `sb` conforme necessário.

Efeitos suportados:

| Tipo | O que faz |
|------|-----------|
| `'hp'` | Soma `ef.valor` ao `hp_atual` (clampado em `[0, hp_max]`), PATCH no banco, emite `HUB_EVENTS('cura_aplicada')` se positivo |
| `'recurso'` | Adiciona `ef.valor` a `ca.atributos[ef.recurso]`; débitos clampados em 0 |
| `'atributo'` | Se `duracao_turnos > 0`: cria buff temporário com `modificador_delta` + aplica delta imediato. Se permanente: soma diretamente |
| `'remover_debuff'` | Filtra `alvo.buffs` removendo o debuff pelo nome |
| `'dano'` | Subtrai `ef.valor` do HP, PATCH no banco, emite `HUB_EVENTS('dano_aplicado')` |
| `'debuff'` | Push em `alvo.buffs` com `tipo:'debuff'`, `negativo:true`, `auto_aplicado:true` |
| `'buff'` | Push em `alvo.buffs` com suporte a `hot_formula`, `boost_dano`, duração |
| `'dot'` | Push em `alvo.buffs` com `dot_formula`, `dot_turnos_restantes` |

Ao final: PATCH em `characters` com `custom_attrs` + `buffs`, exibe toast e re-renderiza (`renderCharView`, `renderAttrView`, `mapaRenderStatus` ou equivalentes de Arena).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `AR` | global | `js/systems/arena.js` |
| `arSb` | função | `js/systems/arena.js` |
| `sb` | função async | `js/core/supabase.js` |
| `saveCharacterStats` | função | `js/characters/characters.js` |
| `HUB_EVENTS.emit` | método | `js/core/events.js` |
| `RPG_DATA` | global | `js/state.js` |
| `mostrarToast` | função | **não encontrada ainda** |
| `renderCharView` | função | `js/systems/lore.js` |
| `renderAttrView` | função | `js/characters/characters.js` |
| `mapaRenderStatus` | função | `js/maps/maps.js` |
| `renderArenaPersonagens`, `renderArenaEntidades` | funções | `js/systems/arena.js` |

---

#### `_consumirItem(invItem)` — linha 759 *(async)*
Decrementa a quantidade do item em 1. Se chegar a zero: DELETE em `inventario` e remove das caches `INV.inventario` e `INV.inventarios[charId]`. Caso contrário: PATCH com nova quantidade e atualiza ambas as caches.

**Dependências externas:** `sb`, `INV.inventario`, `INV.inventarios`.

---

#### `aprovarUsoItem(usoId)` — linha 784 *(async)*
Fluxo de aprovação do mestre:
1. Localiza o uso em `INV.usosPendentes`, o item e os personagens envolvidos.
2. Chama `_aplicarEfeitosItem` com `efeitos_snap` (snapshot salvo no momento do pedido).
3. Chama `_consumirItem` para debitar o item.
4. PATCH em `item_usos` com `status:'aplicado'` e timestamp.
5. Remove da lista de pendentes, re-renderiza e exibe toast.

**Dependências externas:** `INV`, `RPG_DATA.characters`, `_aplicarEfeitosItem`, `_consumirItem`, `sb`, `renderItensPendentes`, `mostrarToast`.

---

#### `rejeitarUsoItem(usoId)` — linha 806 *(async)*
PATCH em `item_usos` com `status:'rejeitado'` e timestamp. Remove da lista de pendentes e re-renderiza.

**Dependências externas:** `sb`, `INV.usosPendentes`, `renderItensPendentes`, `mostrarToast`.

---

#### `abrirModalAddInv(nome, charId)` — linha 820
Armazena `charId` e `nome` em `_addInvCharId`/`_addInvCharNome`, preenche o header do modal, limpa o campo de busca e chama `renderAddInvLista`. Exibe `#modal-add-inv-overlay`.

**Dependências externas:** `document.getElementById`, `renderAddInvLista`.

---

#### `fecharModalAddInv()` — linha 830
Oculta `#modal-add-inv-overlay`.

**Dependências externas:** `document.getElementById`.

---

#### `renderAddInvLista()` — linha 834
Filtra `INV.itemDefs` pelo texto de busca digitado em `#add-inv-busca`. Renderiza cards clicáveis com ícone, nome, raridade (com cor) e botão `＋`. Cada card chama `adicionarAoInventario(d.id)` ao clicar.

**Dependências externas:** `INV.itemDefs`, `adicionarAoInventario`, `document.getElementById`.

---

#### `adicionarAoInventario(itemDefId)` — linha 852 *(async)*
Adiciona um item ao inventário do personagem em `_addInvCharId`:
- Se o item já existe e é consumível (`tipo === 'consumivel'`): incrementa `quantidade` via PATCH.
- Caso contrário: POST em `inventario` com `item_catalog_id`, `quantidade:1`, `equipado:false` e empurra o resultado para `INV.inventario`.
Fecha o modal e re-renderiza o inventário do personagem.

**Dependências externas:** `INV.inventario`, `INV.itemDefs`, `RPG_DATA.rpgId`, `sb`, `fecharModalAddInv`, `renderInventarioChar`, `mostrarToast`.

---

#### `abrirModalItemDef(id)` — linha 888 *(parcial — continua além de 973)*
Abre o modal de criar/editar item. Reseta `_itemDefEfeitos` e `_itemDefBonus`. Se `id` fornecido: preenche todos os campos com valores do `def` existente (nome, ícone, tipo, descrição, raridade, valor, alvo, alcance, aprovação, slot, img_url), copia efeitos e bônus para os buffers e chama `_renderItemDefEfeitos`/`_renderItemDefBonus`. Se novo: define valores padrão. Por fim chama `itemDefTipoChange()` e, após timeout, tenta mapear os efeitos existentes para a categoria correta no formulário inteligente via `itemDefCatChange`.

> ⚠ Função não completamente lida. A próxima análise começa na linha 973.

---

### Resolução de dependências — linhas 474–973

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `aprovarUsoItem` | linha 784 (mesmo arquivo) |
| `rejeitarUsoItem` | linha 806 (mesmo arquivo) |
| `abrirModalAddInv` | linha 820 (mesmo arquivo) |
| `abrirModalUsarItem` (completa) | linha 474 (mesmo arquivo) |

---

### Variáveis/constantes definidas (linhas 973–1472)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `_tabelaColunasEdit` | 1218 | `let` array | Buffer de colunas sendo editadas no modal de tabela |
| `_tabelaLinhasEdit` | 1219 | `let` array | Buffer de linhas sendo editadas no modal de tabela |
| `CRIAR_STATE` | 1376 | `let` objeto | Estado global do wizard de criação de campanha: `nivel`, `etapaIdx`, `etapas`, `dados` |
| `CRIAR_NIVEIS` | 1389 | `const` objeto | Configuração dos 3 níveis do wizard (`basico`, `intermediario`, `detalhado`) com etapas e cor |
| `ATTR_PRESETS` | 1395 | `const` array | 4 presets de atributos prontos (D&D, Narrativo, Horror, Cyberpunk) |
| `ICONES_OPCOES` | 1402 | `const` array | 8 opções de ícone para a campanha (`flame`, `rune`, `crystal`, etc.) |
| `COR_PRESETS` | 1413 | `const` array | 12 cores predefinidas para identidade visual da campanha |

### Monkey-patches adicionais (linhas 973–1472)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.abrirAba` | 1339 | Ao abrir a aba `'tabelas'`: se `INV.itemDefs` ainda vazio, chama `invCarregarDados` antes de renderizar; senão renderiza diretamente |

### Funções definidas (linhas 973–1472)

#### `_idefUpdateImgPreview(src)` — linha 978
Atualiza o preview de imagem no modal de item (`#idef-img-preview`). Se `src` fornecido: renderiza `<img>` com `onerror` silencioso. Se vazio: mostra `'📦'`.

**Dependências externas:** `document.getElementById`.

---

#### `idefUploadImg(input)` — linha 984 *(async)*
Faz upload de imagem para o Supabase Storage via `uploadToStorage(file, 'items')`, preenche `#idef-img-url` com a URL retornada e chama `_idefUpdateImgPreview`.

**Dependências externas:** `uploadToStorage`, `mostrarToast`, `_idefUpdateImgPreview`.

---

#### `fecharModalItemDef()` — linha 999
Oculta `#modal-itemdef-overlay`.

**Dependências externas:** `document.getElementById`.

---

#### `itemDefTipoChange()` — linha 1001
Exibe/oculta as seções `#idef-sec-consumivel` e `#idef-sec-equipamento` de acordo com `#idef-tipo`.

**Dependências externas:** `document.getElementById`.

---

#### `itemDefCatChange()` — linha 1007
Mostra a seção de categoria de efeito selecionada (`cura`/`recurso`/`buff`/`debuff_inimigo`/`antidoto`/`multiplo`) e oculta as demais. Também configura o toggle de HOT (heal over time).

**Dependências externas:** `document.getElementById`, `document.querySelector`.

---

#### `_idefColetarEfeitosSimples()` — linha 1024
Converte os campos do formulário simplificado de efeitos (UI de alto nível) para o formato interno `efeitos[]`. Funciona como tradutor por categoria:

| Categoria | Campos lidos | Efeito gerado |
|-----------|-------------|---------------|
| `cura` | valor, hot, turnos, alvo | `{ tipo:'hp', valor, hot, duracao_turnos }` |
| `recurso` | nome, valor, alvo | `{ tipo:'recurso', recurso, valor }` |
| `buff` | attr, valor, turnos, alvo | `{ tipo:'atributo', attr, valor, duracao_turnos }` |
| `debuff_inimigo` | alcance, aprovação, dano, debuff | `[{tipo:'dano'}, {tipo:'debuff'}]` |
| `antidoto` | debuff, alvo | `{ tipo:'remover_debuff', debuff }` |
| `multiplo` | — | usa `_itemDefEfeitos` direto |

Retorna `{ efeitos, alvo, alcance_m, requer_aprovacao }`.

**Dependências externas:** `_itemDefEfeitos`, `document.getElementById`.

---

#### `itemDefAddEfeito()` — linha 1081
Adiciona efeito padrão `{ tipo:'hp', valor:10, duracao_turnos:0 }` a `_itemDefEfeitos` e re-renderiza.

**Dependências externas:** `_itemDefEfeitos`, `_renderItemDefEfeitos`.

---

#### `_renderItemDefEfeitos()` — linha 1086
Renderiza a lista de efeitos no modal com selects de tipo e inputs de valor/nome/turnos. Cada linha tem botão ✕ que chama `_itemDefEfeitoRemover`.

**Dependências externas:** `_itemDefEfeitos`, `document.getElementById`.

---

#### `_itemDefEfeitoChange(idx, key, val)` — linha 1107
Atualiza `_itemDefEfeitos[idx][key] = val` (listener inline dos selects/inputs de efeito).

#### `_itemDefEfeitoRemover(idx)` — linha 1108
Remove o efeito no índice e re-renderiza.

---

#### `itemDefAddBonus()` — linha 1110
Adiciona entrada inicial em `_itemDefBonus` usando o primeiro `RPG_DATA.attrDefs` (fallback `'Força'`) como chave (com timestamp para unicidade) e re-renderiza.

**Dependências externas:** `RPG_DATA.attrDefs`, `_itemDefBonus`, `_renderItemDefBonus`.

---

#### `_renderItemDefBonus()` — linha 1117
Renderiza as linhas de bônus de atributos no modal: input de texto para o nome do atributo e input numérico para o valor, com botão de remoção.

**Dependências externas:** `_itemDefBonus`, `document.getElementById`.

---

#### `_itemDefBonusChaveChange(idx, novaChave)` — linha 1127
Renomeia uma chave de `_itemDefBonus`: remove a entrada antiga e cria nova com a mesma valor.

#### `_itemDefBonusValChange(idx, val)` — linha 1134
Atualiza o valor de `_itemDefBonus[chave]` pelo índice.

#### `_itemDefBonusRemover(idx)` — linha 1138
Remove chave de `_itemDefBonus` pelo índice e re-renderiza.

---

#### `salvarItemDef()` — linha 1144 *(async)*
Salva o item no catálogo (`item_catalog`). Fluxo:
1. Para consumíveis: chama `_idefColetarEfeitosSimples()` e escreve alvo/alcance/aprovação nos campos legados.
2. Limpa as chaves de timestamp dos bônus (sufixo `_<timestamp>`).
3. Monta `body` com todos os campos + `tipo_canonico` (derivado do `slot_padrao` para equipamentos).
4. Se `id` fornecido: PATCH. Senão: POST com `Prefer:return=representation`.
5. Atualiza cache local, fecha modal, chama `renderTabelasTab`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA.rpgId` | global | `js/state.js` |
| `INV.itemDefs` | estado global | mesmo arquivo |
| `_idefColetarEfeitosSimples` | função | mesmo arquivo |
| `fecharModalItemDef`, `renderTabelasTab`, `mostrarToast` | funções | mesmo arquivo |

---

#### `deletarItemDef(id)` — linha 1203 *(async)*
Confirma com `confirm()`, DELETE em `item_catalog?id=eq.{id}`, remove de `INV.itemDefs` e de `INV.inventario` (itens com `item_catalog_id` ou `item_def_id` correspondente). Re-renderiza.

**Dependências externas:** `sb`, `INV`, `renderTabelasTab`, `mostrarToast`.

---

#### `abrirModalTabela(id)` — linha 1221
Abre o modal de criar/editar tabela. Se `id`: preenche campos com os dados da tabela existente e copia arrays de colunas/linhas para buffers editáveis (com proteção anti-congelamento via `Object.isFrozen`). Se novo: define valores padrão. Chama `_renderTabelaColunas` e `_renderTabelaLinhas`.

**Dependências externas:** `INV.tabelas`, `_tabelaColunasEdit`, `_tabelaLinhasEdit`, `_renderTabelaColunas`, `_renderTabelaLinhas`, `document.getElementById`.

---

#### `fecharModalTabela()` — linha 1249
Oculta `#modal-tabela-overlay`.

#### `tabelaAdicionarColuna()` — linha 1251
Adiciona nova coluna ao buffer `_tabelaColunasEdit` com key e label automáticos. Re-renderiza colunas e linhas.

#### `_renderTabelaColunas()` — linha 1257
Renderiza inputs de nome de coluna com botões de remoção.

#### `_tabelaColunaLabel(idx, val)` — linha 1265
Atualiza `label` e deriva `key` (lowercase, snake_case) de uma coluna.

#### `_tabelaRemoverColuna(idx)` — linha 1269
Remove coluna do buffer e re-renderiza colunas + linhas.

#### `tabelaAdicionarLinha()` — linha 1271
Adiciona linha ao buffer `_tabelaLinhasEdit` com chaves de todas as colunas atuais vazias.

#### `_renderTabelaLinhas()` — linha 1278
Renderiza o grid de inputs das linhas da tabela, uma célula por coluna × linha. Exibe mensagem guia se não há colunas ou linhas.

#### `_tabelaLinhaVal(li, key, val)` — linha 1288
Atualiza `_tabelaLinhasEdit[li][key] = val`.

#### `_tabelaRemoverLinha(li)` — linha 1289
Remove linha do buffer e re-renderiza.

---

#### `salvarTabela()` — linha 1291 *(async)*
Salva a tabela em `tabelas`. Se `id`: PATCH com colunas/linhas/nome/desc/visivel. Senão: POST. Atualiza cache local, fecha modal, re-renderiza.

**Dependências externas:** `sb`, `RPG_DATA.rpgId`, `INV.tabelas`, `fecharModalTabela`, `renderTabelasTab`, `mostrarToast`.

---

#### `deletarTabela(id)` — linha 1319 *(async)*
Confirma, DELETE em `tabelas`, remove de `INV.tabelas`, re-renderiza.

**Dependências externas:** `sb`, `INV.tabelas`, `renderTabelasTab`, `mostrarToast`.

---

#### `toggleVisibilidadeTabela(id, visivel)` — linha 1329 *(async)*
PATCH em `tabelas` com novo `visivel`, atualiza cache local e re-renderiza.

**Dependências externas:** `sb`, `INV.tabelas`, `renderTabelasTab`, `mostrarToast`.

---

#### `abrirCriarCampanha()` — linha 1421
Reseta `CRIAR_STATE` para valores iniciais, esconde `#hub`, exibe `#criar-screen` e chama `criarRenderEtapa`.

**Dependências externas:** `CRIAR_STATE`, `criarRenderEtapa`, `document.getElementById`.

---

#### `fecharCriarCampanha()` — linha 1431
Esconde `#criar-screen` e restaura `#hub`.

**Dependências externas:** `document.getElementById`.

---

#### `criarNavegar(dir)` — linha 1439
Avança (+1) ou volta (-1) no wizard. Ao avançar: valida a etapa atual (`criarValidarEtapa`) e salva os dados (`criarSalvarEtapa`). Atualiza `CRIAR_STATE.etapaIdx` e chama `criarRenderEtapa`.

**Dependências externas:** `CRIAR_STATE`, `criarValidarEtapa`, `criarSalvarEtapa`, `criarRenderEtapa`.

---

#### `criarValidarEtapa()` — linha 1450
Valida a etapa atual do wizard:
- `'nivel'`: exige `CRIAR_STATE.nivel` selecionado
- `'identidade'`: exige `#criar-nome` preenchido; deriva `rpg_id` via `gerarRpgId`
- `'personagens'`: exige ao menos 1 card `[data-char-idx]`
- Demais: passa sem validação

Retorna `true/false`.

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`, `mostrarToast`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSalvarEtapa()` — linha 1470
Delega para a função de salvar específica da etapa atual:
- `'identidade'` → copia nome, descrição e `rpg_id` de `#criar-nome`/`#criar-desc`/`#criar-id`
- `'atributos'` → `criarSalvarAtributos()`
- `'personagens'` → `criarSalvarPersonagens()`
- `'habilidades'` → `criarSalvarHabilidades()`
- `'lore'` → `criarSalvarLore()`
- `'mecanicas'` → `criarSalvarMecanicas()`

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`, `document.getElementById`, funções de salvar por etapa.

---

#### `gerarRpgId(nome)` — linha 1485
Função pura. Transforma o nome da campanha em slug: lowercase, espaços → `_`, remove não-alfanuméricos, trunca em 32 chars e adiciona sufixo `Date.now().toString(36)`.

**Dependências externas:** *Nenhuma.*

---

#### `criarRenderEtapa()` — linha 1492
Renderiza a etapa atual do wizard:
1. Atualiza dots de progresso (`#criar-steps-dots`).
2. Exibe/oculta botão Prev, define texto do Next (`'✦ Criar Campanha!'` na etapa `'revisar'` ou `'Próximo →'`).
3. Despacha para a função de render específica da etapa via mapa `{ nivel, identidade, atributos, personagens, habilidades, lore, mecanicas, revisar }`.

**Dependências externas:** `CRIAR_STATE`, `criarSubmit`, `criarNavegar`, funções `criarRender*`, `document.getElementById`.

---

#### `criarRenderNivel(body)` — linha 1527
Injeta HTML dos 3 cards de nível (`basico`, `intermediario`, `detalhado`) no `body`. Cada card chama `criarSelecionarNivel(nivel)`.

**Dependências externas:** `CRIAR_STATE`, `criarSelecionarNivel`.

---

#### `criarSelecionarNivel(nivel)` — linha 1568
Armazena o nível escolhido em `CRIAR_STATE.nivel`, copia as etapas de `CRIAR_NIVEIS[nivel]`. Se `attrDefs` ainda vazio, inicializa com `ATTR_PRESETS[0]`. Re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `CRIAR_NIVEIS`, `ATTR_PRESETS`, `criarRenderEtapa`.

---

#### `criarRenderIdentidade(body)` — linha 1579
Renderiza o formulário de identidade da campanha: nome, ID (com auto-geração), descrição, paleta de cores (`COR_PRESETS`) e grid de ícones (`ICONES_OPCOES`).

**Dependências externas:** `CRIAR_STATE.dados`, `COR_PRESETS`, `ICONES_OPCOES`, `criarAutoId`, `criarSetCor`, `criarSetIcone`.

---

#### `criarAutoId(nome)` — linha 1624
Derivia `rpg_id` do nome digitado (slug) e preenche `#criar-id`.

**Dependências externas:** `document.getElementById`.

---

#### `criarSetCor(cor)` — linha 1629
Atualiza `CRIAR_STATE.dados.cor`, `#criar-cor` e marca o preset ativo.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSetIcone(key, el)` — linha 1637
Atualiza `CRIAR_STATE.dados.icone`, remove `.ativo` de todos os botões de ícone e adiciona ao `el` clicado.

**Dependências externas:** `CRIAR_STATE`, `document.querySelectorAll`.

---

#### `criarRenderAtributos(body)` — linha 1644
Renderiza a etapa de atributos com seções condicionais por nível:
- `basico`: sempre visível
- `status` (Mana/Stamina): `intermediario`+`detalhado`
- `especial` (Sanidade, Karma…): `detalhado` apenas
- `resistencia` (Armadura…): `detalhado` apenas

Inclui botões de preset e botões `＋ Atributo` por categoria.

**Dependências externas:** `CRIAR_STATE`, `ATTR_PRESETS`, `_renderAttrsList`, `criarAplicarPreset`, `criarAddAttr`, `criarAddResistencia`.

---

#### `_renderAttrsList(cat)` — linha 1690
Renderiza inputs de nome para atributos da categoria `cat`. Cada input tem `onchange` que atualiza `CRIAR_STATE.dados.attrDefs[idx].nome` diretamente.

**Dependências externas:** `CRIAR_STATE`.

---

#### `criarAplicarPreset(idx)` — linha 1702
Substitui os atributos `'basico'` por aqueles do preset `ATTR_PRESETS[idx]`, mantendo atributos de outras categorias. Re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `ATTR_PRESETS`, `criarRenderAtributos`, `mostrarToast`.

---

#### `criarAddAttr(cat)` — linha 1712
Adiciona atributo vazio à categoria `cat`, re-renderiza e foca o último input.

**Dependências externas:** `CRIAR_STATE`, `criarRenderAtributos`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarAddResistencia()` — linha 1723
Adiciona atributo padrão `'Armadura'` com `opcoes` JSON de resistência, re-renderiza.

**Dependências externas:** `CRIAR_STATE`, `criarRenderAtributos`, `mostrarToast`.

---

#### `criarRemoverAttr(idx)` — linha 1729
Remove atributo pelo índice e re-renderiza.

---

#### `criarSalvarAtributos()` — linha 1734
Filtra `attrDefs` removendo entradas com `nome` em branco (dados já salvos via `onchange`).

---

#### `criarRenderPersonagens(body)` — linha 1741
Renderiza a etapa de personagens: lista de cards via `_renderCharCard` e botão `＋`.

**Dependências externas:** `CRIAR_STATE`, `_renderCharCard`, `criarAddPersonagem`.

---

#### `_renderCharCard(p, i, attrs)` — linha 1757
Renderiza um card de personagem com: cor, nome, tipo, HP máximo, cor individual e grid de inputs de atributos básicos/status. Todos os inputs têm `onchange` que atualiza `CRIAR_STATE.dados.personagens[i]` inline.

**Dependências externas:** `CRIAR_STATE`.

---

#### `criarAddPersonagem()` — linha 1798
Adiciona personagem padrão (`{ nome:'', tipo:'jogador', cor:'#4fa3d1', hp_max:100, atributos:{} }`), re-renderiza e rola/foca o novo card.

---

#### `criarRemoverPersonagem(i)` — linha 1809
Remove personagem pelo índice e re-renderiza.

---

#### `criarSalvarPersonagens()` — linha 1814
No-op: dados já salvos via `onchange`.

---

#### `criarRenderHabilidades(body)` — linha 1819
Renderiza a etapa de habilidades. Mostra aviso se não há personagens. Renderiza cards via `_renderSkillCard` com campos condicionais por nível:
- `avancado` (`intermediario`+`detalhado`): custo e cooldown
- `formula` (`detalhado`): fórmula de dano e tipo de dano

**Dependências externas:** `CRIAR_STATE`, `_renderSkillCard`, `criarAddHabilidade`.

---

#### `_renderSkillCard(h, i, chars, mostrarAvancado, mostrarFormula)` — linha 1841
Renderiza card de habilidade com: nome, personagem (select), efeito (textarea), custo/cooldown (se `mostrarAvancado`), fórmula/tipo de dano (se `mostrarFormula`). Todos com `onchange` em `CRIAR_STATE.dados.habilidades[i]`.

---

#### `criarAddHabilidade()` — linha 1896
Adiciona habilidade padrão, re-renderiza e rola ao último card.

---

#### `criarRemoverHabilidade(i)` — linha 1906
Remove habilidade pelo índice e re-renderiza.

---

#### `criarSalvarHabilidades()` — linha 1911
No-op: dados já salvos via `onchange`.

---

#### `criarRenderLore(body)` — linha 1914
Renderiza a etapa de lore com categorias fixas (`mundo`, `magia`, `sociedade`, `história`, `facções`, `regras`). Renderiza cards via `_renderLoreCard`.

**Dependências externas:** `CRIAR_STATE`, `_renderLoreCard`, `criarAddLore`.

---

#### `_renderLoreCard(l, i, categs)` — linha 1931
Renderiza card de lore: input de título, select de categoria e textarea de conteúdo.

---

#### `criarAddLore()` — linha 1944
Adiciona entrada de lore vazia, re-renderiza e rola ao último card.

---

#### `criarRemoverLore(i)` — linha 1953
Remove lore pelo índice e re-renderiza.

---

#### `criarSalvarLore()` — linha 1958
No-op: dados já salvos via `onchange`.

---

#### `criarRenderMecanicas(body)` — linha 1962
Renderiza a etapa de mecânicas com seções:
- **Combate e Movimento**: velocidade base, fator de velocidade, seleção de modo de turno (Livre vs. Exclusivo).
- **HP e Progressão**: HP inicial, HP por nível, nível máximo, atributo que contribui com HP (+ multiplicador), pontos de atributo por nível.

Define `window.criarSetModoTurno` inline para alternar `CRIAR_STATE.dados.mecanicas.turno_modo_exclusivo`.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`, `document.querySelectorAll`.

---

#### `criarSetModoTurno(exclusivo)` — linha 2050 *(definida dentro de `criarRenderMecanicas`)*
Atualiza `CRIAR_STATE.dados.mecanicas.turno_modo_exclusivo` e alterna a classe `.selecionado` nos cards de modo de turno.

---

#### `criarSalvarMecanicas()` — linha 2059
Lê todos os inputs do formulário de mecânicas e persiste em `CRIAR_STATE.dados.mecanicas`: `velocidade_base`, `velocidade_fator`, `hp_base`, `hp_por_nivel`, `nivel_maximo`, `pontos_attr_por_nivel`, `hp_attr`, `hp_attr_mult`. `turno_modo_exclusivo` já salvo via click.

**Dependências externas:** `CRIAR_STATE`, `document.getElementById`.

---

#### `criarRenderRevisar(body)` — linha 2077
Renderiza a etapa de revisão com resumo de todas as seções do wizard: nome + cor + nível + ID, atributos (até 8, com ícone por categoria), personagens (com cor individual), habilidades e lore (opcionais). Exibe aviso sobre tutorial ativado por padrão.

**Dependências externas:** `CRIAR_STATE`, `gerarRpgId`.

---

#### `criarSubmit()` — linha 2127 *(async)*
Orquestrador final do wizard. Fluxo:
1. Valida nome e existência de ao menos 1 personagem.
2. Constrói `payload` compatível com `importRPG`: `config` (com mecânicas), `characters`, `skills`, `lore`, `attr_defs`.
3. Chama `await importRPG(payload)`.
4. Ativa tutorial da campanha via `localStorage` (`rpghub_tutorial_{rpgId}`).
5. Recarrega `HUB_DATA.rpgs` via `getAllRPGs()`, renderiza lista.
6. Após 1,2 s: chama `fecharCriarCampanha()` e `entrarRPG(rpgId)`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `CRIAR_STATE` | global | mesmo arquivo |
| `importRPG` | função async | `js/hub/import.js` |
| `gerarRpgId` | função | mesmo arquivo |
| `getAllRPGs` | função | `js/auth/auth.js` ou hub |
| `HUB_DATA` | global | `js/state.js` ou hub |
| `renderRPGList` | função | `js/hub/hub.js` ou similar |
| `entrarRPG` | função | `js/hub/hub.js` |
| `fecharCriarCampanha` | função | mesmo arquivo |
| `mostrarToast` | função | **não encontrada ainda** |
| `localStorage` | Browser API | Browser |

---

### Resolução de dependências — linhas 1962–2222

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `_resolveItemImgSrc` | — **não encontrada no arquivo** (provavelmente alias de lógica inline em `renderTabelasTab`) |
| `abrirEditarItemCatalogo` | — **não encontrada no arquivo** (possivelmente referência obsoleta, `abrirModalItemDef` é a função real) |
| `mostrarToast` | — **não encontrada neste arquivo** (definida em outro módulo, usada extensivamente aqui) |

---

### Sumário de dependências externas não resolvidas — `js/systems/inventory.js`

| Dependência | Tipo | Módulo provável |
|-------------|------|-----------------|
| `mostrarToast` | função | `js/ui/modals.js` ou `js/hub/hub.js` |
| `saveCharacterStats` | função | `js/characters/characters.js` |
| `uploadToStorage` | função | `js/core/supabase.js` |
| `getAllRPGs` | função | `js/auth/auth.js` |
| `HUB_DATA` | global | `js/state.js` ou `js/hub/hub.js` |
| `renderRPGList` | função | `js/hub/hub.js` |
| `importRPG` | função | `js/hub/import.js` |
| `arSb` | função | `js/systems/arena.js` |
| `renderArenaPersonagens`, `renderArenaEntidades` | funções | `js/systems/arena.js` |
| `mapaRenderStatus` | função | `js/maps/maps.js` |
| `itemDefCatChange` | função | mesmo arquivo — linha 1007 ✅ |

---

---

### Resolução de dependências — linhas 973–1472

| Dependência marcada "não encontrada" | Encontrada em |
|--------------------------------------|---------------|
| `abrirModalTabela` | linha 1221 (mesmo arquivo) |
| `deletarTabela` | linha 1319 (mesmo arquivo) |
| `toggleVisibilidadeTabela` | linha 1329 (mesmo arquivo) |
| `deletarItemDef` | linha 1203 (mesmo arquivo) |
| `abrirEditarItemCatalogo` | — não encontrada (possivelmente alias de `abrirModalItemDef`) |
| `_resolveItemImgSrc` | **não encontrada ainda** (linhas > 1472) |

---

## 18. `js/hub/hub.js` *(linhas 1–500 — Em progresso)*

**Linhas totais:** 2300  
**Descrição geral (parcial):** Arquivo central da interface da mesa de jogo. Responsável pelo layout de 3 colunas (desktop), feed de eventos, sistema de notificações, barra de contexto do mestre, entrada em campanhas (`entrarRPG`), aplicação de tema e tela de loading. Contém também o monkey-patch de `combateBroadcast` para reemitir eventos no `HUB_EVENTS`.

> **Nota:** Este arquivo é o maior orquestrador da UI. Chama funções de praticamente todos os outros módulos.

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `FEED_MESA` | 289 | `const` objeto | Estado do feed da mesa: `{ entradas: [], maxEntradas: 200 }` |
| `NOTIFICACOES` | 348 | `const` objeto | Estado das notificações: `{ fila: [] }` |
| `LOADING_START` | 478 | `let` number | Timestamp do início da tela de loading |
| `_origCombateBroadcast5` | 385 | `const` | Salva referência original de `combateBroadcast` antes do monkey-patch |
| `_origEntrarRPGF5` | 447 | `const` | Salva referência original de `entrarRPG` antes do monkey-patch |

### Funções definidas (linhas 1–500)

#### `mesaModoVerificar()` — linha 13
Ativa ou desativa o layout de 3 colunas da mesa. Em viewports > 1100px injeta CSS de grid e as 3 colunas via `_mesaInjetarColunas`. Em viewports menores remove a classe `mesa-ativo`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById('tab-mapas')` | DOM API | Browser |
| `window.innerWidth` | Browser API | Browser |
| `_mesaInjetarColunas` | função | mesmo arquivo (linha 39) |
| `_mesaRenderizarColunas` | função | mesmo arquivo (linha 103) |

---

#### `_mesaInjetarColunas()` — linha 39
Cria e injeta as 3 `div`s da mesa (col-esq, col-centro, col-dir) e a barra de ações, movendo elementos existentes do DOM (`mapa-breadcrumb`, `mapa-lista`, `mapa-toolbar`, `mapa-wrap`, `mapa-status` e vários painéis de batalha/criativos) para suas novas colunas. Idempotente (verifica se `#mesa-col-esq` já existe).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `document.createElement` | DOM API | Browser |
| `mapaRenderStatus` | função | `js/maps/maps.js` (provável) |

---

#### `_mesaRenderizarColunas()` — linha 103
Atalho que chama em sequência `_mesaRenderChars`, `_mesaRenderIniciativa` e `_mesaRenderAcoes`.

---

#### `_mesaRenderChars()` — linha 105
Limpa o elemento `#mesa-chars-lista` e chama `mapaRenderStatus` para re-renderizar a lista de personagens da coluna esquerda.

**Dependências externas:** `document.getElementById`, `mapaRenderStatus` (`js/maps/maps.js`).

---

#### `_mesaRenderIniciativa()` — linha 111
Renderiza a lista de participantes da iniciativa na coluna esquerda. Exibe nome, cor e marca o participante atual (com ícone `▶`). Cada item é clicável via `selecionarAlvoLista`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `selecionarAlvoLista` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

---

#### `_mesaRenderBarraSkills()` — linha 123
Alias simples que chama `_mesaRenderAcoes`.

---

#### `_mesaRenderAcoes()` — linha 125
Renderiza o painel de ações da coluna direita. Constrói HTML dinamicamente conforme o contexto:
- **Fase iniciativa/empate:** botão de rolar iniciativa, lista de participantes com status de rolagem
- **Fase combate:** exibe de quem é a vez; se for a vez do jogador renderiza atalhos de habilidades via `_mesaRenderAtaqueInline`; botões de ação criativa, pular vez, jogar por NPC offline; ações posicionais via `ctxGerarBotoes`
- **Sem batalha:** botão de iniciar batalha (mestre), interações posicionais
- **Mestre:** lista de aprovações pendentes de `CRIATIVOS_CAMP`, controles de batalha (pausar/encerrar)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `RPG_DATA.myRole`, `RPG_DATA.linked` | propriedades | `js/state.js` |
| `CRIATIVOS_CAMP` | array global | `js/state.js` |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `TOKEN_CTRL.nomeSelecionado` | propriedade | **não encontrada ainda** |
| `atkGetHabilidadesCampanha` | função | **não encontrada ainda** |
| `_mesaRenderAtaqueInline` | função | **não encontrada ainda** (linhas > 500) |
| `abrirModalIniciativa` | função | **não encontrada ainda** |
| `abrirModalAcao` | função | **não encontrada ainda** |
| `batalhaPassarVez` | função | `js/combat/combat.js` (provável) |
| `batalhaJogarPorOffline` | função | **não encontrada ainda** |
| `ctxGerarBotoes` | função | **não encontrada ainda** |
| `ctxPriorizar` | função | **não encontrada ainda** |
| `ctxExecutarAcao` | função | **não encontrada ainda** |
| `ctxMostrarOcultos` | função | **não encontrada ainda** |
| `abrirModalIniciarBatalha` | função | **não encontrada ainda** |
| `scrollToPendingApprovals` | função | **não encontrada ainda** |
| `criativoRenderMestre` | função | `js/systems/creative.js` (provável) |
| `pausarOuRetomarBatalha` | função | `js/combat/combat.js` (provável) |
| `encerrarBatalha` | função | `js/combat/combat.js` (provável) |
| `document.getElementById` | DOM API | Browser |

---

#### `_mesaAtacarHab(btn)` — linha 262
Handler de click nos botões de habilidade da mesa (modo mestre). Lê `data-char` e `data-hab` do botão, define `COMBATE.atacanteNome` e `COMBATE.habilidadeSel`, e inicia o fluxo de ataque.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mapaAtaqueIniciar` | função | **não encontrada ainda** |

---

#### *(listener `resize`)* — linha 271
Ao redimensionar a janela: re-verifica o modo mesa e re-renderiza o canvas do mapa tático se houver mapa ativo.

**Dependências externas:** `document.getElementById`, `MAPA_STATE`, `RPG_DATA.mapas`, `mapaIsTatico` (state.js), `mapaRenderCanvas` (**não encontrada ainda**), `mesaModoVerificar`, `_mesaRenderizarColunas`.

---

#### Listeners `HUB_EVENTS` registrados (linhas 283–315)

| Evento | Linha | Ação |
|--------|-------|------|
| `turno_avancou` | 283 | Re-renderiza iniciativa e ações; atualiza zona direita se mobile |
| `dano_aplicado` | 284 | Re-renderiza chars e `mapaRenderStatus` |
| `cura_aplicada` | 285 | Re-renderiza chars e `mapaRenderStatus` |
| `token_selecionado` | 286 | Re-renderiza ações |
| `dano_aplicado` | 308 | Adiciona entrada no feed |
| `cura_aplicada` | 309 | Adiciona entrada no feed |
| `turno_avancou` | 310 | Adiciona entrada no feed |
| `token_moveu` | 311 | Adiciona entrada de movimento no feed |
| `habilidade_usada` | 312 | Adiciona entrada no feed |
| `zona_ativada` | 313 | Adiciona entrada no feed |
| `cena_carregada` | 314 | Adiciona entrada de cena no feed |
| `item_usado` | 315 | Adiciona entrada de item no feed |
| `turno_avancou` | 345 | Chama `barraContextoAtualizar(personagem)` |
| `turno_avancou` | 381 | Libera notificações adiadas (`_adiada=false`) |

---

#### `feedAdicionarEntrada(texto, tipo, personagem)` — linha 291
Adiciona uma entrada ao `FEED_MESA.entradas` (no início) e chama `feedRenderizar`. Limita a `maxEntradas` (200) entradas.

**Dependências externas:** `FEED_MESA` (mesmo arquivo), `feedRenderizar` (mesmo arquivo).

---

#### `feedRenderizar()` — linha 297
Renderiza as últimas 40 entradas do `FEED_MESA` no elemento `#mesa-feed-lista`. Cada entrada exibe horário formatado, texto e cor por tipo (`dano`, `cura`, `turno`, `movimento`, `item`, `cena`, `info`).

**Dependências externas:** `FEED_MESA`, `document.getElementById`.

---

#### `barraContextoInicializar()` — linha 318
Injeta a barra fixa de contexto do mestre no `document.body` (apenas para o mestre). Exibe papel atual e botão de avançar turno. Idempotente.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `document.createElement`, `document.body.appendChild` | DOM API | Browser |
| `mapaToggleModoCamera` | função | `js/state.js` linha 100 |

---

#### `barraContextoAtualizar(personagem)` — linha 328
Atualiza o texto e cor da barra de contexto conforme o personagem cujo turno é atual. Diferencia mestre atuando como seu personagem vs. mestre controlando NPC.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `RPG_DATA.myRole`, `RPG_DATA.linked`, `RPG_DATA.characters` | propriedades | `js/state.js` |
| `batalhaPassarVez` | função | `js/combat/combat.js` (provável) |

---

#### `notifAdicionar({ tipo, prioridade, titulo, descricao, acao, dados })` — linha 350
Cria um objeto de notificação com ID único e o adiciona à fila. Notificações de prioridade `'baixa'` são adiadas durante combate ativo (flag `_adiada`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `NOTIFICACOES` | objeto | mesmo arquivo (linha 348) |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `MAPA_STATE.batalhas` | objeto | `js/state.js` |
| `notifRenderizar` | função | mesmo arquivo (linha 359) |

---

#### `notifRenderizar()` — linha 359
Renderiza o painel de notificações (`#notif-painel`) no canto inferior direito. Cria o elemento se não existir. Exibe até 5 notificações visíveis. Notificações de alta prioridade têm animação `notifPulso`.

Funções globais auxiliares:
- `window.notifDismiss(id)` — marca notificação como resolvida
- `window.notifExpandir(id)` — executa ação da notificação ao clicar
- `window.notifExecutar(id)` — executa callback `acao.fn` e resolve

**Dependências externas:** `NOTIFICACOES`, `document.getElementById`, `document.createElement`, `document.body`.

---

#### `entrarRPG(rpgId)` — linha 398 *(async)*
Fluxo completo de entrada em uma campanha:
1. Salva navegação via `salvarNav`
2. Busca metadata do RPG em `HUB_DATA.rpgs`
3. Define `CURRENT_RPG` e aplica tema via `aplicarTema`
4. Exibe loading via `mostrarLoading`
5. Carrega `RPG_DATA` via `getRPGData`
6. Busca role/linked/permissoes do jogador na tabela `rpg_members`
7. Renderiza UI inicial: header, lore, chars, atribs, dados, config, mapas
8. Inicia Realtime, Chat e carregamento progressivo
9. Restaura aba salva no `localStorage`

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `salvarNav` | função | **não encontrada ainda** |
| `MAPA_STATE` | objeto global | `js/state.js` |
| `HUB_DATA.rpgs` | array | `js/state.js` |
| `CURRENT_RPG` | variável global | `js/state.js` |
| `aplicarTema` | função | mesmo arquivo (linha 461) |
| `mostrarLoading` | função | mesmo arquivo (linha 480) |
| `getRPGData` | função | `js/core/supabase.js` |
| `SESSION` | objeto global | `js/state.js` |
| `sb` | função async | `js/core/supabase.js` |
| `RPG_DATA`, `CHAR_VIEW`, `ATTR_VIEW`, `CFG_CHAR` | globais | `js/state.js` |
| `renderHeader` | função | `js/systems/lore.js` |
| `renderLore` | função | `js/systems/lore.js` |
| `renderCharButtons` | função | `js/systems/lore.js` |
| `renderAttrButtons` | função | `js/characters/characters.js` |
| `renderDados` | função | **não encontrada ainda** |
| `renderConfig` | função | **não encontrada ainda** |
| `renderMapasTab` | função | `js/maps/maps.js` (provável) |
| `mostrarApp` | função | **não encontrada ainda** |
| `ocultarLoading` | função | **não encontrada ainda** |
| `localStorage` | Browser API | Browser |
| `iniciarRealtime` | função | `js/core/realtime.js` |
| `chatMostrar` | função | `js/chat/chat.js` |
| `_carregarProgressivo` | função | `js/core/supabase.js` |
| `mostrarToast` | função | **não encontrada ainda** |

> **Nota:** `entrarRPG` é redefinida logo abaixo (linha 448) via monkey-patch que adiciona uma chamada `setTimeout` de 800ms após a entrada, inicializando sistemas das fases 5+: `mesaModoVerificar`, `barraContextoInicializar`, `bibliotecaCarregarDoLore`, `sessionRenderPainel`, `_atualizarBannerControleMobile`, `desbloquearOrientacaoPWA`, `inicializarSistemaAprovacoes`.

---

#### `aplicarTema(rpg)` — linha 461
Aplica as variáveis CSS do tema do RPG no `:root` do documento. Suporta: cores (preto, escuro, painel, borda, cinza, texto, suave, primario, destaque, perigo, sucesso, especial), fontes (display + text), URL de fonte externa.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.documentElement.style.setProperty` | DOM API | Browser |
| `document.getElementById`, `document.createElement`, `document.head.appendChild` | DOM API | Browser |

---

#### `mostrarLoading(rpg)` — linha 480 *(parcial — continua além da linha 500)*
Exibe a tela de loading com animação SVG customizável, nome do RPG e botão de escape. Aplica CSS de animação do tema via `injectCustomCSS`. Registra timestamp em `LOADING_START`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `LOADING_START` | variável | mesmo arquivo (linha 478) |
| `document.getElementById` | DOM API | Browser |
| `injectCustomCSS` | função | `js/core/utils.js` |
| `getLoadingAnimSVG` | função | `js/core/utils.js` |
| `loadingEscapar` | função | **não encontrada ainda** (linhas > 500) |

> *(Continuação nas linhas 480–980 abaixo)*

---

---

### Funções definidas (linhas 480–980)

#### `mostrarLoading(rpg)` — linha 480 *(continuação)*
Oculta o hub, aplica CSS de animação do tema via `injectCustomCSS`, renderiza SVG animado no `#loading-anim`, define o título e adiciona/exibe a tela de loading. Cria botão "← Voltar ao Hub" que aparece após 3s. Define timer de 20s que força o escape com `mostrarToast`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `injectCustomCSS` | função | `js/core/utils.js` |
| `getLoadingAnimSVG` | função | `js/core/utils.js` |
| `loadingEscapar` | função | mesmo arquivo (linha 510) |
| `mostrarToast` | função | **não encontrada ainda** |

---

#### `loadingEscapar()` — linha 510
Cancela todos os timers de loading, oculta a tela de loading/criar, re-exibe o hub e fecha o Realtime.

**Dependências externas:** `document.getElementById`, `fecharRealtime` (`js/core/realtime.js`).

---

#### `ocultarLoading()` — linha 524
Cancela timers e aguarda o mínimo de 2.5s desde `LOADING_START` antes de fazer fade-out da tela de loading. Só re-exibe o hub se o `#app` não estiver visível e nenhuma tela de import/criar estiver ativa.

**Dependências externas:** `LOADING_START` (mesmo arquivo), `document.getElementById`.

---

#### `mostrarApp(rpg)` — linha 547
Exibe o painel do app: define nome do RPG, adiciona classe `visible` ao `#app`, ativa a primeira aba, oculta botão de deletar se for RPG `'dual'`, reseta `DADO_SEL` e `HISTORICO`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById`, `document.querySelectorAll` | DOM API | Browser |
| `DADO_SEL`, `HISTORICO` | variáveis globais | `js/state.js` |

---

#### `voltarHub()` — linha 556
Fecha o chat, limpa a navegação salva no localStorage, fecha o Realtime, oculta o app, re-exibe o hub, limpa estilos do tema e reseta `CURRENT_RPG` / `RPG_DATA`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `chatOcultar` | função | `js/chat/chat.js` |
| `localStorage.removeItem` | Browser API | Browser |
| `fecharRealtime` | função | `js/core/realtime.js` |
| `document.getElementById`, `document.documentElement` | DOM API | Browser |
| `CURRENT_RPG`, `RPG_DATA` | variáveis globais | `js/state.js` |

---

#### `window.selecionarAlvoLista(nomeEncodado)` — linha 568
Define `TOKEN_CTRL.nomeSelecionado` com o nome decodado, exibe toast de confirmação, re-renderiza ações e status do mapa.

**Dependências externas:** `TOKEN_CTRL` (**não encontrado ainda**), `mostrarToast`, `_mesaRenderAcoes` (mesmo arquivo), `mapaRenderStatus` (`js/maps/maps.js`).

---

#### `window._atualizarBadgeMesa()` — linha 578
Stub: oculta `#chat-badge-mesa` se existir. Sem lógica real implementada.

---

#### `_mesaDispararAnimacao(atacanteNome, alvoNome, animacao)` — linha 611 *(async)*
Obtém posições dos tokens no DOM e dispara animação visual: para tipos de mídia (`gif`, `imagem`, `svg`, `iframe`) chama `_animMedia`; para tipos canvas (`projetil`, `onda`, etc.) apenas loga (TODO). Aguarda 300ms como fallback.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.querySelector('.mapa-token[data-nome=...]')` | DOM API | Browser |
| `_animMedia` | função | **não encontrada ainda** |

---

#### `_mesaRenderAtaqueInline(atacanteNome, habilidades)` — linha 657
Renderizador do fluxo de ataque inline no painel de ações da mesa. Implementa uma máquina de 3 estados gerenciada pelo objeto global `window._MESA_ATK_STATE`:

| Step | Conteúdo renderizado |
|------|----------------------|
| 1 | Lista de habilidades disponíveis com cooldown, bloqueio, preview de dano (range min–max + modificador de atributo) e seção de pets/montarias |
| 2 | Lista de alvos disponíveis com distância em células, warnings de fogo amigo e indicador de fora do alcance |
| 3 | Preview da fórmula de dano + botão de rolar; após rolar, exibe resultado e botão de confirmar (visual diferente para cura/suporte/dano) |

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo (inicializado aqui) |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `getCooldownsBatalhaSeguro` | função | **não encontrada ainda** |
| `atkVerificarBloqueioAtaque` | função | **não encontrada ainda** |
| `calcularRangeDano` | função | **não encontrada ainda** |
| `calcModAtributo` | função | **não encontrada ainda** |
| `_mesaPetGetPetsDoDono` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaPetDonoEstaAtivo` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaPetGetHabilidades` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaAtaqueInlineGetAlvos` | função | **não encontrada ainda** (linhas > 980) |
| `_mesaShowRangeCircle` | função | **não encontrada ainda** |
| `mapaHideRangeCircle` | função | **não encontrada ainda** (`js/maps/maps.js` provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `_mesaRenderAcoes` | função | mesmo arquivo (linha 125) |

---

#### `window._mesaAtaqueInlineSelecionarHab(idx, habilidade)` — linha 963
Define step=2, armazena a habilidade selecionada em `_MESA_ATK_STATE` e re-renderiza o painel.

---

#### `window._mesaAtaqueInlineSelecionarAlvo(alvoNome)` — linha 972 *(parcial — continua além de 980)*
Define step=3, armazena o alvo em `_MESA_ATK_STATE`, limpa dados rolados e chama `mapaHideRangeCircle`. Função continua nas linhas > 980.

> *(Continuação nas linhas 972–1472 abaixo)*

---

### Resolução de dependências identificadas nesta análise

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `feedAdicionarEntrada` | `js/hub/hub.js` linha 291 ✅ |
| `notifAdicionar` | `js/hub/hub.js` linha 350 ✅ |
| `entrarRPG` | `js/hub/hub.js` linha 398 ✅ |
| `aplicarTema` | `js/hub/hub.js` linha 461 ✅ |
| `barraContextoAtualizar` | `js/hub/hub.js` linha 328 ✅ |
| `mostrarApp` | `js/hub/hub.js` linha 547 ✅ |
| `ocultarLoading` | `js/hub/hub.js` linha 524 ✅ |
| `voltarHub` | `js/hub/hub.js` linha 556 ✅ |
| `selecionarAlvoLista` | `js/hub/hub.js` linha 568 ✅ |
| `_atualizarBadgeMesa` | `js/hub/hub.js` linha 578 ✅ (stub) |

---

### Funções definidas (linhas 972–1472)

#### `window._mesaAtaqueInlineSelecionarAlvo(alvoNome)` — linha 972 *(completa)*
Define step=3, armazena o alvo em `_MESA_ATK_STATE`, limpa dados rolados, chama `mapaHideRangeCircle` e re-renderiza o painel.

**Dependências externas:** `mapaHideRangeCircle` (**não encontrada ainda**, `js/maps/maps.js` provável), `_mesaRenderAcoes` (mesmo arquivo).

---

#### `window._mesaAtaqueInlineVoltar()` — linha 984
Retrocede um step no fluxo inline. Bloqueia se os dados já foram rolados (`state.dadosRolados` preenchido). Ao voltar ao step 1 limpa estado e esconde círculo de alcance e AoE.

**Dependências externas:** `mostrarToast`, `mapaHideRangeCircle`, `mapaHideAoECircle` (**não encontrada ainda**), `_mesaRenderAcoes`.

---

#### `window._mesaAtaquePet(petNome, habilidadeIdx)` — linha 1010
Inicia ataque usando habilidade de um pet/montaria. Busca a habilidade via `_mesaPetGetHabilidades`, armazena `_petAtacante` e `_donoAtacante` no state, salta para step 2.

**Dependências externas:** `_mesaPetGetHabilidades` (mesmo arquivo, linha 1279), `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `_mesaRenderAcoes`.

---

#### `window._mesaAtaqueInlineRolar()` — linha 1033 *(async)*
Rola dados do ataque inline. Exibe animação de 5 frames simulados antes do resultado real. Chama `rolarFormulaDano`, armazena resultado em `state.dadosRolados`, vibra o dispositivo (se suportado) e re-renderiza.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `document.getElementById` | DOM API | Browser |
| `rolarFormulaDano` | função | mesmo arquivo (linha 1375) |
| `navigator.vibrate` | Browser API | Browser |
| `_mesaRenderAcoes` | função | mesmo arquivo |

---

#### `window._mesaAtaqueInlineConfirmar()` — linha 1098 *(async)*
Confirma o ataque inline. Configura o objeto global `COMBATE` com atacante, habilidade, alvo e resultado. Se for ataque de pet, substitui temporariamente o atacante. Dispara animação da habilidade via `_mesaDispararAnimacao` antes de aplicar o dano. Chama `_atkAplicarDanoFinal` para aplicar dano, efeitos, cooldown e broadcast. Reseta o state completo após a conclusão.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `_mesaDispararAnimacao` | função | mesmo arquivo (linha 611) |
| `_atkAplicarDanoFinal` | função | **não encontrada ainda** |
| `_mesaRenderAcoes` | função | mesmo arquivo |

---

#### `_mesaAtaqueInlineGetAlvos(atacanteNome, habilidade)` — linha 1180
Calcula a lista de alvos disponíveis para o ataque inline. Leva em conta:
- Apenas participantes da batalha ativa
- Sistema de **faction** (`jogador`, `aliado`, `neutro`, `inimigo`) via helper `_getFaction`
- Modo buff/cura: só aliados e jogadores
- Modo ataque: inimigos sempre; aliados/jogadores apenas se PvP ou fogo amigo ativo, ou for o mestre
- **Fogo amigo** (`fogoAmigo` / `fogoAmigoForte`) para warnings visuais
- Distância em células via `_calcularDistanciaSegura` e `foraAlcance` se habilidade tem `alcance_celulas`
- Suporte a ataque via pet (usa posição do pet para distância)

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `window._MESA_ATK_STATE` | objeto global | mesmo arquivo |
| `CURRENT_RPG.theme.pvp_ativo`, `CURRENT_RPG.theme.fogo_amigo_ativo` | propriedades | `js/state.js` |
| `RPG_DATA.characters`, `RPG_DATA.myRole` | globais | `js/state.js` |
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `_calcularDistanciaSegura` | função | mesmo arquivo (linha 1327) |

---

#### `_mesaPetGetHabilidades(petNome)` — linha 1279
Retorna as habilidades de um pet. Busca primeiro em `ca.habilidades`; se não houver, delega para `atkGetHabilidadesCampanha`.

**Dependências externas:** `RPG_DATA.characters`, `atkGetHabilidadesCampanha` (**não encontrada ainda**).

---

#### `_mesaPetGetPetsDoDono(donoNome)` — linha 1294
Retorna todos os personagens em `RPG_DATA.characters` que têm `custom_attrs.eh_pet === true` e `custom_attrs.pet_dono === donoNome`. Função simples de filtro.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `_mesaPetDonoEstaAtivo(donoNome, tipoDanoHabilidade)` — linha 1302
Verifica se o dono do pet está apto a atacar: HP > 0, sem debuff `sem_ataque` ativo, e sem bloqueio por tipo de dano via `atkVerificarBloqueioAtaque`.

**Dependências externas:** `RPG_DATA.characters`, `atkVerificarBloqueioAtaque` (**não encontrada ainda**).

---

#### `_calcularDistanciaSegura(token1, token2)` — linha 1327
Função pura. Calcula a **distância de Chebyshev** (movimento xadrez — diagonal conta 1) entre dois tokens, normalizando diferentes formatos de posição (`col/row`, `x/y`, `column/linha`). Retorna `null` se posição indisponível.

**Dependências externas:** *Nenhuma.*

---

#### `calcularRangeDano(formula)` — linha 1346
Função pura. Extrai da fórmula (ex: `2d6`) os valores mínimo e máximo de dano. Retorna `{ min: qtd, max: qtd*faces }`.

**Dependências externas:** *Nenhuma.*

---

#### `calcModAtributo(habilidade, charNome, contexto)` — linha 1361
Função pura. Calcula o modificador de atributo (fórmula D&D: `floor((valor - 10) / 2)`). Suporta contexto `'arena'` (usa `AR.personagens`) ou campanha (usa `RPG_DATA.characters`).

**Dependências externas:** `AR.personagens` (`js/systems/arena.js`), `RPG_DATA.characters` (`js/state.js`).

---

#### `rolarFormulaDano(formula, habilidade, charNome, contexto)` — linha 1375
Rola a fórmula de dano (ex: `2d6+3`). Aplica modificador de atributo via `calcModAtributo`. Suporta críticos via `verificarCritico` (multiplicadores: 1.2× menor, 1.3× maior, 0 para erro). Dispara animação de crítico via `mostrarAnimacaoCritico` se disponível.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `calcModAtributo` | função | mesmo arquivo (linha 1361) |
| `verificarCritico` | função | **não encontrada ainda** |
| `mostrarAnimacaoCritico` | função | **não encontrada ainda** |

---

#### `getCooldownsBatalhaSeguro(batalhaId)` — linha 1433
Wrapper seguro de `getCooldownsBatalha`: retorna `{}` se a função não existir.

**Dependências externas:** `getCooldownsBatalha` (**não encontrada ainda**, `js/combat/combat.js` provável).

---

#### `_mesaShowRangeCircle(atacanteNome, alcance)` — linha 1444 *(parcial — continua além de 1472)*
Exibe um círculo visual de alcance no mapa para a habilidade selecionada. Busca a posição do atacante na batalha, remove círculo anterior e cria `#mapa-range-circle` posicionado absolutamente no grid.

> *(Continuação nas linhas 1444–1944 abaixo)*

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas` | globais | `js/state.js` |
| `document.getElementById('mapa-grid')` | DOM API | Browser |
| `mapaHideRangeCircle` | função | mesmo arquivo (linha 1499) ✅ |

---

### Resolução de dependências — linhas 972–1472

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `_mesaPetGetHabilidades` | `js/hub/hub.js` linha 1279 ✅ |
| `_mesaPetGetPetsDoDono` | `js/hub/hub.js` linha 1294 ✅ |
| `_mesaPetDonoEstaAtivo` | `js/hub/hub.js` linha 1302 ✅ |
| `_mesaAtaqueInlineGetAlvos` | `js/hub/hub.js` linha 1180 ✅ |
| `_mesaShowRangeCircle` | `js/hub/hub.js` linha 1444 ✅ (parcial) |
| `calcularRangeDano` | `js/hub/hub.js` linha 1346 ✅ |
| `calcModAtributo` | `js/hub/hub.js` linha 1361 ✅ |
| `rolarFormulaDano` | `js/hub/hub.js` linha 1375 ✅ |
| `getCooldownsBatalhaSeguro` | `js/hub/hub.js` linha 1433 ✅ |

---

### Funções definidas (linhas 1444–1944)

#### `_mesaShowRangeCircle(atacanteNome, alcance)` — linha 1444 *(completa)*
Busca a posição do atacante nos participantes da batalha e cria `#mapa-range-circle`: `div` circular absoluto no `#mapa-grid`, com borda tracejada âmbar e animação `pulseRange`. Injeta o `@keyframes` se ainda não existir.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `document.getElementById`, `mapaHideRangeCircle` (mesmo arquivo, linha 1499).

---

#### `mapaHideRangeCircle()` — linha 1499
Remove o elemento `#mapa-range-circle` do DOM se existir.

---

#### `mapaShowAoECircle(centerPos, radius)` — linha 1504
Cria `#mapa-aoe-circle`: círculo vermelho de AoE com animação `pulseAoE`. Atualiza `_AOE_STATE` (verificação defensiva). Injeta `@keyframes` se necessário.

**Dependências externas:** `document.getElementById('mapa-grid')`, `_AOE_STATE` (**não encontrado ainda**), `mapaHideAoECircle` (mesmo arquivo).

---

#### `mapaHideAoECircle()` — linha 1556
Remove `#mapa-aoe-circle` e limpa `_AOE_STATE.active/center/radius` (verificação defensiva).

---

#### `_atkMostrarTrigger()` — linha 1572
Exibe o card flutuante de confirmação de ataque (`#atk-trigger-card`). Lê `COMBATE.habilidadeSel`, `alvoNome` e `dadosRolados` para montar o HTML. Exibe resultado do dano, botões Cancelar/Aplicar e inicia countdown de 15s via `_atkTriggerStartCountdown`.

**Dependências externas:** `COMBATE`, `document.getElementById`, `document.body`, `_TRIGGER_CARD_STATE` (mesmo arquivo), `_atkOcultarTrigger` (mesmo arquivo), `_atkTriggerStartCountdown` (mesmo arquivo).

---

#### `_atkTriggerStartCountdown()` — linha 1652
Inicia intervalo de 1s que decrementa `_TRIGGER_CARD_STATE.countdown`. Ao chegar a zero, chama `_atkTriggerCancelar`.

**Dependências externas:** `_TRIGGER_CARD_STATE`, `document.getElementById('atk-trigger-countdown')`, `_atkTriggerCancelar` (mesmo arquivo).

---

#### `_atkOcultarTrigger()` — linha 1672
Oculta o card com animação `slideOutRight` (300ms), cancela o intervalo de countdown, reseta `_TRIGGER_CARD_STATE`.

---

#### `window._atkTriggerAplicar()` — linha 1688
Aplica o ataque do trigger card: verifica `COMBATE._jaAplicado`, chama `aplicarDanoBatalha` e `setCooldownBatalha`, emite `dano_aplicado` e `habilidade_usada` no `HUB_EVENTS`, mostra toast de sucesso e fecha o card.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `mostrarToast` | função | **não encontrada ainda** |
| `aplicarDanoBatalha` | função | **não encontrada ainda** |
| `setCooldownBatalha` | função | **não encontrada ainda** |
| `HUB_EVENTS.emit` | método | `js/config.js` |
| `BATALHA_ATUAL_ID` | variável global | `js/state.js` |
| `_atkOcultarTrigger` | função | mesmo arquivo |

---

#### `window._atkTriggerCancelar()` — linha 1736
Fecha o trigger card e reseta `COMBATE._jaAplicado` e `_pendingTrigger`. Re-renderiza UI via `_aplicarEstadoBatalhaUI` se contexto for campanha.

**Dependências externas:** `_atkOcultarTrigger`, `COMBATE`, `_aplicarEstadoBatalhaUI` (`js/combat/combat.js` provável).

---

#### `_estadoBatalhaJogador(nomePersonagem)` — linha 1751
> ⚠ **Redefinição local:** esta função já foi mapeada em `js/core/events.js` linha 23 com lógica mais completa (suporta Arena + mapa). Esta versão em hub.js é uma reimplementação simplificada, sem suporte a Arena — retorna `'fora_combate'`, `'livre'` ou `'outro_turno'` consultando apenas `MAPA_STATE.batalhas`.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`.

---

#### `abrirModalAtaque(atacanteNome, contexto)` — linha 1783 *(parcial — continua além de 1944)*
Abre o modal de ataque. Verifica estado de batalha do jogador (bloqueia se não for a sua vez). Reseta completamente o objeto `COMBATE`. Carrega lista de habilidades via `atkGetHabilidadesArena` ou `atkGetHabilidadesCampanha` conforme o contexto. Monta HTML dos botões de habilidade com badges de cooldown/bloqueio/range. Exibe seção de ações criativas se o jogador tiver permissão. Chama `atkRenderizarSecaoPets` e `atkIrParaStep(1)`. Implementa lógica interna `_setModalModo` para posicionar o modal em desktop (painel direito da mesa) ou mobile (sidebar).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `mostrarToast` | função | **não encontrada ainda** |
| `RPG_DATA.myRole` | propriedade | `js/state.js` |
| `_estadoBatalhaJogador` | função | mesmo arquivo (linha 1751) |
| `COMBATE` | objeto global | `js/combat/combat.js` (provável) |
| `_atkOcultarTrigger` | função | mesmo arquivo |
| `atkGetHabilidadesArena` | função | **não encontrada ainda** |
| `atkGetHabilidadesCampanha` | função | **não encontrada ainda** |
| `getCooldownsBatalhaSeguro` | função | mesmo arquivo (linha 1433) |
| `AR.estado.cooldowns` | propriedade | `js/systems/arena.js` |
| `atkVerificarBloqueioAtaque` | função | **não encontrada ainda** |
| `calcularRangeDano`, `calcModAtributo` | funções | mesmo arquivo |
| `temPermissao` | função | `js/core/events.js` |
| `criativoSetTipo`, `criativoSetAlvo` | funções | `js/systems/creative.js` (provável) |
| `atkRenderizarSecaoPets` | função | **não encontrada ainda** |
| `atkIrParaStep` | função | **não encontrada ainda** |
| `document.getElementById` | DOM API | Browser |

*(Continuação nas linhas 1783–2300 abaixo)*

---

### Resolução de dependências — linhas 1444–1944

| Função/Variável | Encontrada em |
|-----------------|---------------|
| `mapaHideRangeCircle` | `js/hub/hub.js` linha 1499 ✅ |
| `mapaShowAoECircle` | `js/hub/hub.js` linha 1504 ✅ |
| `mapaHideAoECircle` | `js/hub/hub.js` linha 1556 ✅ |
| `_atkMostrarTrigger` | `js/hub/hub.js` linha 1572 ✅ |
| `_atkTriggerAplicar` | `js/hub/hub.js` linha 1688 ✅ |
| `_atkTriggerCancelar` | `js/hub/hub.js` linha 1736 ✅ |

---

### Funções definidas (linhas 1783–2300)

#### `abrirModalAtaque(atacanteNome, contexto)` — linha 1783 *(completa)*
Abre o modal de ataque com suporte a 3 modos de exibição conforme o contexto e o layout:
- **`painel`** — embutido no `#mesa-acao-painel` (desktop 3-col) ou `#atk-sidebar-painel` (mobile)
- **`inline`** — posicionado absolutamente sobre `#atk-painel-campanha-anchor` (campanha com âncora visível)
- **`overlay`** — modal fullscreen fixo (`position:fixed`, z-index 9999) como fallback

Fluxo interno:
1. Valida estado de turno do jogador via `_estadoBatalhaJogador`
2. Reseta o objeto global `COMBATE` completamente
3. Carrega habilidades (`atkGetHabilidadesArena` / `atkGetHabilidadesCampanha`) e monta lista com badges de cooldown/bloqueio/range
4. Exibe ações criativas se `temPermissao('ataque_criativo')`
5. Renderiza seção de pets via `atkRenderizarSecaoPets`
6. Vai ao step 1 via `atkIrParaStep(1)`

---

#### `fecharModalAtaque()` — linha 2011
Fecha o modal de ataque. Devolve o elemento ao `document.body` se estava embutido no painel ou sidebar. Limpa círculos de alcance e AoE. Se `COMBATE._pendingTrigger`, exibe o trigger card em vez de simplesmente fechar. Se foi cancelado em contexto campanha, re-renderiza via `_aplicarEstadoBatalhaUI`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `document.getElementById` | DOM API | Browser |
| `COMBATE`, `ATAQUE_MAPA_STATE` | objetos globais | `js/combat/combat.js` (provável) |
| `mapaHideRangeCircle`, `mapaHideAoECircle` | funções | mesmo arquivo |
| `_mesaRenderAcoes` | função | mesmo arquivo |
| `_atkMostrarTrigger` | função | mesmo arquivo |
| `_aplicarEstadoBatalhaUI` | função | `js/combat/combat.js` (provável) |

---

#### `configurarAtalhosCombate()` — linha 2068
Registra listener `keydown` global para o modal de ataque. Atalhos:
- `1`–`9` → `atkSelecionarHabilidade(idx)`
- `Enter` → `_mesaAtaqueInlineRolar()` ou `_mesaAtaqueInlineConfirmar()` conforme botão visível
- `Escape` → `fecharModalAtaque()`
- `R` → `_mesaAtaqueInlineRolar()`

Inicializado imediatamente (ou no `DOMContentLoaded` se o documento ainda estiver carregando).

**Dependências externas:** `document.addEventListener`, `atkSelecionarHabilidade` (**não encontrada ainda**), `_mesaAtaqueInlineRolar`, `_mesaAtaqueInlineConfirmar`, `fecharModalAtaque` (mesmo arquivo).

---

#### `window._debugEstadoBatalha()` — linha 2122
Helper de debug. Loga no console o estado completo: variáveis globais (`BATALHA_ATUAL_ID`, `MAPA_STATE`, `RPG_DATA`, `COMBATE`, `ATAQUE_MAPA_STATE`, `_TRIGGER_CARD_STATE`, `_AOE_STATE`), lista de batalhas e participantes, lista de personagens e tokens no mapa, e resultado de `_mesaAtaqueInlineGetAlvos` para o atacante atual.

---

#### `ativarModoAtaqueMapa(atacanteNome)` — linha 2192
Ativa o modo de ataque clicável no mapa. Define `ATAQUE_MAPA_STATE.ativo = true`. Cria/exibe painel flutuante `#atk-mapa-float-panel` no canto superior direito. Chama `_marcarAlvosDisponiveis` para destacar tokens inimigos e aliados.

**Dependências externas:** `ATAQUE_MAPA_STATE` (`js/combat/combat.js` provável), `document.getElementById`, `document.body`, `_marcarAlvosDisponiveis` (mesmo arquivo).

---

#### `desativarModoAtaqueMapa()` — linha 2237
Reseta `ATAQUE_MAPA_STATE`, oculta o painel flutuante e remove classes de destaque de todos os `.mapa-token`.

---

#### `_marcarAlvosDisponiveis(atacanteNome)` — linha 2249
Destaca tokens no mapa conforme o lado do participante: inimigos recebem `atk-target-disponivel` (glow vermelho + `pulseTarget`), aliados recebem `atk-target-buff` (glow azul). Injeta `#atk-mapa-styles` com os keyframes se ainda não existir.

**Dependências externas:** `BATALHA_ATUAL_ID`, `MAPA_STATE.batalhas`, `document.querySelector`, `document.getElementById`, `document.head`.

---

### Resumo final de `js/hub/hub.js`

| Seção | Linhas | Funções/sistemas |
|-------|--------|-----------------|
| Mesa 3 colunas | 1–285 | `mesaModoVerificar`, `_mesaInjetarColunas`, `_mesaRenderizarColunas`, `_mesaRenderChars`, `_mesaRenderIniciativa`, `_mesaRenderBarraSkills`, `_mesaRenderAcoes`, `_mesaAtacarHab` |
| Feed + Notificações + Contexto | 288–396 | `feedAdicionarEntrada`, `feedRenderizar`, `barraContextoInicializar`, `barraContextoAtualizar`, `notifAdicionar`, `notifRenderizar` + 3 globais |
| Entrada/saída campanha | 398–565 | `entrarRPG`, monkey-patch entrarRPG+combateBroadcast, `aplicarTema`, `mostrarLoading`, `loadingEscapar`, `ocultarLoading`, `mostrarApp`, `voltarHub` |
| Globais de UI | 568–584 | `selecionarAlvoLista`, `_atualizarBadgeMesa` |
| Ataque inline (3 steps) | 600–957 | `_mesaDispararAnimacao`, `_mesaRenderAtaqueInline` |
| Navegação ataque inline | 963–1173 | `_mesaAtaqueInlineSelecionarHab/Alvo/Voltar`, `_mesaAtaquePet`, `_mesaAtaqueInlineRolar`, `_mesaAtaqueInlineConfirmar` |
| Alvos, pets, cálculos | 1180–1438 | `_mesaAtaqueInlineGetAlvos`, `_mesaPetGet*`, `_mesaPetDonoEstaAtivo`, `_calcularDistanciaSegura`, `calcularRangeDano`, `calcModAtributo`, `rolarFormulaDano`, `getCooldownsBatalhaSeguro` |
| Círculos visuais | 1444–1566 | `_mesaShowRangeCircle`, `mapaHideRangeCircle`, `mapaShowAoECircle`, `mapaHideAoECircle` |
| Trigger flutuante | 1572–1745 | `_atkMostrarTrigger`, `_atkTriggerStartCountdown`, `_atkOcultarTrigger`, `_atkTriggerAplicar`, `_atkTriggerCancelar` |
| Modal de ataque | 1751–2008 | `_estadoBatalhaJogador` (redefinição), `abrirModalAtaque`, `fecharModalAtaque` |
| Atalhos + Debug + Mapa | 2068–2296 | `configurarAtalhosCombate`, `_debugEstadoBatalha`, `ativarModoAtaqueMapa`, `desativarModoAtaqueMapa`, `_marcarAlvosDisponiveis` |

---

### Dependências globais ainda não resolvidas (ao fim do hub.js)

| Função/Variável | Referenciada em |
|-----------------|-----------------|
| `mostrarToast` | amplamente em todo o sistema |
| `atkGetHabilidadesArena` | `abrirModalAtaque` |
| `atkGetHabilidadesCampanha` | `_mesaRenderAcoes`, `abrirModalAtaque` |
| `atkVerificarBloqueioAtaque` | `_mesaRenderAtaqueInline`, `abrirModalAtaque` |
| `atkSelecionarHabilidade` | `configurarAtalhosCombate` |
| `atkRenderizarSecaoPets` | `abrirModalAtaque` |
| `atkIrParaStep` | `abrirModalAtaque` |
| `_atkAplicarDanoFinal` | `_mesaAtaqueInlineConfirmar` |
| `aplicarDanoBatalha` | `_atkTriggerAplicar` |
| `setCooldownBatalha` | `_atkTriggerAplicar` |
| `getCooldownsBatalha` | `getCooldownsBatalhaSeguro` |
| `verificarCritico` | `rolarFormulaDano` |
| `mostrarAnimacaoCritico` | `rolarFormulaDano` |
| `_AOE_STATE` | `mapaShowAoECircle`, `mapaHideAoECircle` |
| `ATAQUE_MAPA_STATE` | `fecharModalAtaque`, `ativarModoAtaqueMapa`, `desativarModoAtaqueMapa` |
| `TOKEN_CTRL` | `_mesaRenderAcoes`, `selecionarAlvoLista` |
| `salvarNav` | `entrarRPG` |
| `renderDados` | `entrarRPG` |
| `renderConfig` | `entrarRPG` |
| `_animMedia` | `_mesaDispararAnimacao` |

---

## 20. `js/ui/tabs.js` *(linhas 1–500 — Em progresso)*

**Linhas totais:** 2229  
**Descrição real:** Apesar do nome `tabs.js`, este arquivo implementa o **sistema de cenário tático do mapa**: paredes, portas (com trancas/chaves e transição de mapa), baús, chaves colecionáveis, obstáculos e o editor visual de cenário (`CENA_ED`). O nome do arquivo não reflete o conteúdo.

### Variáveis/constantes definidas (linhas 1–500)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `WALLS_STATE` | 13 | `const` objeto | Estado do modo de edição de paredes: `primeroPonto` (snap point aguardando 2º clique) e `configAtual` (`{ cor, largura }`) |
| `CENARIO_STATE` | 415 | `const` objeto | Estado do painel de cenário: `placement` (objeto aguardando clique no mapa) e `tabAtiva` (aba selecionada: `'porta'`/`'chave'`/`'bau'`/`'obstaculo'`) |

### Monkey-patches registrados na carga (linhas 1–500)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.ctxGerarBotoes` | 378 | Se há porta adjacente ao personagem, insere botão `'Abrir/Fechar Porta'` no início da lista de ações contextuais |
| `window.ctxExecutarAcao` | 400 | Intercepta `botao.acao === 'usar_porta'` e chama `usarPorta`; delega outros casos ao original |

### Funções definidas (linhas 1–500)

#### `paredeBloqueiaMovimento(mapId, colAtual, rowAtual, dc, dr)` — linha 19
Verifica se existe uma parede no `render_data.paredes[]` do mapa que bloqueia o movimento de `(colAtual, rowAtual)` na direção `(dc, dr)`. Normaliza paredes no formato genérico (`col1/row1/col2/row2`) para o formato canônico `{tipo, col, row}`. Suporta movimentos horizontais (parede vertical `tipo='v'`) e verticais (parede horizontal `tipo='h'`).

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |

---

#### `portaAdjacenteAo(mapId, col, row)` — linha 48
Retorna a primeira porta em `render_data.portas[]` dentro de distância Chebyshev ≤ 1 de `(col, row)`, ou `null`.

**Dependências externas:** `_getMapaById`.

---

#### `usarPorta(mapId, portaId, charNome)` — linha 57 *(async)*
Toggle `porta.aberta`. Antes: verifica trança — se `porta.trancada && porta.chave_palavra` e o personagem não tem a chave (`_charTemChave`), exibe toast e aborta. Após toggle: persiste via `salvarRenderData`, re-renderiza tokens. Se porta foi aberta e tem `mapa_destino`: chama `_portaTransportarChar`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |
| `_charTemChave` | função | mesmo arquivo (linha 124) |
| `TOKEN_CTRL.nomeSelecionado` | propriedade | `js/maps/maps.js` |
| `RPG_DATA.linked` | propriedade | `js/state.js` |
| `salvarRenderData` | função | mesmo arquivo (linha 365) |
| `mapaRenderTokens` | função | `js/maps/maps.js` |
| `_portaTransportarChar` | função | mesmo arquivo (linha 89) |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `_portaTransportarChar(charNome, porta)` — linha 89 *(async)*
Transporta o personagem ao destino da porta: atualiza `map_positions[mapa_destino]` e `active_map_id`, persiste via PATCH em `characters`, navega para o mapa destino (tenta `navegarParaMapa` → `mapaCarregar` → `selecionarMapa`). Se `superficieVerificarEntrada` disponível: chama para a célula de chegada. Faz broadcast `'porta_transicao'` para outros jogadores.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `RPG_DATA.characters`, `RPG_DATA.mapas` | globais | `js/state.js` |
| `sb` | função | `js/core/supabase.js` |
| `navegarParaMapa` / `mapaCarregar` / `selecionarMapa` | funções | `js/maps/maps.js` |
| `superficieVerificarEntrada` | função | `js/maps/maps.js` (opcional) |
| `realtimeBroadcast` | função | `js/core/realtime.js` |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `_charTemChave(charNome, mapId, chavePalavra)` — linha 124
Verifica se o personagem tem a chave em `custom_attrs.chaves_coletadas` ou `custom_attrs.chaves`. Suporta chave como string simples ou objeto `{ chave_palavra }`.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `paredePorRenderizar(m)` — linha 132
Renderiza paredes e portas no SVG overlay (`#mapa-dist-svg`). Remove elementos anteriores com classe `.mapa-parede`/`.mapa-porta`. Para cada parede: cria `<line>` SVG com coords calculadas a partir da célula (suporta `tipo:'v'`, `tipo:'h'` e formato genérico `col1/row1/col2/row2`). Para cada porta: cria `<circle>` + `<text>` SVG com cor/ícone refletindo estado `aberta`. Em modo `toolMode==='paredes'`: clique na parede chama `paredRemover`; clique na porta chama `portaEditar`. Fora do modo edição: clique na porta chama `usarPorta`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `MAPA_STATE.toolMode` | propriedade | `js/maps/maps.js` |
| `paredRemover` | função | mesmo arquivo (linha 308) |
| `portaEditar` | função | mesmo arquivo (linha 348) |
| `usarPorta` | função | mesmo arquivo (linha 57) |
| `document.getElementById` | DOM API | Browser |

---

#### `_snapParede(xPx, yPx, canvas, mapa)` — linha 233
Converte coordenadas de pixel para o snap point mais próximo na grade. Retorna `{ tipo:'v', col, row }` se a borda vertical for mais próxima, ou `{ tipo:'h', col, row }` caso contrário.

**Dependências externas:** *Nenhuma.*

---

#### `_gerarSegmentos(p1, p2)` — linha 256
Gera array de segmentos de parede entre dois snap points: se ambos `'v'` na mesma coluna → segmentos verticais sequenciais; se ambos `'h'` na mesma linha → segmentos horizontais sequenciais; caso contrário: retorna apenas `p1` (fallback).

**Dependências externas:** *Nenhuma.*

---

#### `paredAdicionarPonto(xPx, yPx)` — linha 271
Estado em 2 cliques: primeiro clique armazena snap em `WALLS_STATE.primeroPonto`; segundo clique gera segmentos via `_gerarSegmentos`, os adiciona a `render_data.paredes[]` com ID único, re-renderiza e persiste.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `_snapParede`, `_gerarSegmentos`, `WALLS_STATE`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`, `mostrarToast`, `document.getElementById`.

---

#### `paredRemover(mapId, paredId)` — linha 308
Remove parede por ID de `render_data.paredes[]`, re-renderiza e persiste.

**Dependências externas:** `_getMapaById`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `portaAdicionar(col, row)` — linha 318
Adiciona nova porta em `render_data.portas[]`. Lê configuração de `CENARIO_STATE.placement` (nome, trancada, chave_palavra, mapa_destino, coords de destino, cor, ícone) ou usa defaults. Persiste e re-renderiza.

**Dependências externas:** `MAPA_STATE.mapaAtualId`, `_getMapaById`, `CENARIO_STATE`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `portaEditar(mapId, portaId)` — linha 348
Edição simples via `prompt()`: permite renomear a porta ou deletá-la (input vazio). Persiste e re-renderiza.

**Dependências externas:** `_getMapaById`, `RPG_DATA.mapas`, `paredePorRenderizar`, `salvarRenderData`.

---

#### `salvarRenderData(entryId, renderData)` — linha 365 *(async)*
PATCH em `mapas?id=eq.{entryId}` com o campo `render_data`. Erros logados mas não propagados.

**Dependências externas:** `sb`, `CURRENT_RPG`.

---

#### `abrirPainelCenario()` — linha 421
Verifica se há mapa selecionado, chama `cenarioRenderObjetos()` e exibe `#modal-cenario-overlay`.

**Dependências externas:** `MAPA_STATE.mapaAtualId`, `cenarioRenderObjetos`, `mostrarToast`, `document.getElementById`.

---

#### `fecharPainelCenario()` — linha 430
Fecha o painel, limpa `CENARIO_STATE.placement`, zera `MAPA_STATE.toolMode`, remove classe `.ativo` dos botões de ferramenta. Chama `atualizarResumoObjetosCenario` se disponível.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `atualizarResumoObjetosCenario` (opcional), `document.getElementById`, `document.querySelectorAll`.

---

#### `cenarioTab(tipo, btn)` — linha 442
Ativa a aba do painel de cenário: oculta todas as divs `.cenario-tab`, remove destaque de todos os botões, exibe `#cenario-tab-{tipo}` e aplica destaque roxo no `btn`.

**Dependências externas:** `CENARIO_STATE`, `document.querySelectorAll`, `document.getElementById`.

---

#### `cenarioBauLootChange()` — linha 456
Mostra/oculta as seções de loot do baú (`#cen-bau-aleatorio-wrap`, `#cen-bau-item-wrap`, `#cen-bau-ouro-wrap`) conforme o tipo selecionado em `#cen-bau-loot-tipo`.

**Dependências externas:** `document.getElementById`.

---

#### `cenarioBuscarItem()` — linha 463 *(async)*
Filtra `INV.itemDefs` pelo texto em `#cen-bau-item-busca` (até 8 resultados) e renderiza lista clicável. Cada item chama `cenarioSelecionarItem`.

**Dependências externas:** `INV.itemDefs`, `cenarioSelecionarItem`, `document.getElementById`.

---

#### `cenarioSelecionarItem(id, nome, icone)` — linha 478
Preenche `#cen-bau-item-id` com o ID selecionado, exibe confirmação em `#cen-bau-item-sel` e limpa a lista de busca.

**Dependências externas:** `document.getElementById`.

---

#### `cenarioAtivarPlacement(tipo)` — linha 486 *(parcial — continua além de 500)*
Coleta a configuração do formulário para o tipo de objeto (`porta`, `chave`, `bau`, `obstaculo`), armazena em `CENARIO_STATE.placement` e ativa o modo de clique no mapa.

> ⚠ Função não completamente lida. A próxima análise começa na linha 486.

---

### Variáveis/constantes definidas (linhas 486–985)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `CENA_ED` | 874 | `const` objeto | Estado do editor de cena avançado: `ferramenta`, `primeroPonto`, `mapa`, `undoStack`, `cfgBauItens` |

### Monkey-patches adicionais (linhas 486–985)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.ctxGerarBotoes` (2ª camada) | 830 | Para objetos de cenário adjacentes (Chebyshev ≤ 1): insere botões de ação para porta, chave e baú |
| `window.ctxExecutarAcao` (2ª camada) | 855 | Intercepta `botao.acao === 'cenario_obj'` e chama `cenarioInteragirObjeto` |

### Funções definidas (linhas 486–985)

#### `cenarioAtivarPlacement(tipo)` — linha 486 *(completa)*
Coleta configuração do formulário por tipo:
- `'porta'`: nome, trancada, chave_palavra, transição de mapa (mapa_destino, destino_col/row), cor, ícone
- `'chave'`: nome, chave_palavra, ícone
- `'bau'`: nome, trancado, chave_palavra, loot_tipo (`aleatorio`/`item_catalog`/`ouro`/`nenhum`) + campos específicos
- `'obstaculo'`: nome, ícone, tamanho

Armazena em `CENARIO_STATE.placement`, define `MAPA_STATE.toolMode = 'cenario_placement'` e fecha o painel aguardando clique no mapa.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `mostrarToast`, `document.getElementById`.

---

#### `cenarioHandleMapaClick(e, wrap)` — linha 539
Handler de clique no mapa quando `toolMode === 'cenario_placement'`. Converte coordenadas de pixel para célula (col/row), cria objeto com ID único em `render_data.objetos[]`, persiste, re-renderiza tokens, exibe toast e limpa o estado de placement.

**Dependências externas:** `MAPA_STATE`, `CENARIO_STATE`, `_getMapaById`, `RPG_DATA.mapas`, `mapaRenderTokens`, `salvarRenderData`, `cenarioRenderObjetos`, `mostrarToast`, `document.getElementById`.

---

#### `cenarioRenderObjetos()` — linha 577
Renderiza a lista de objetos do mapa no `#cenario-objetos-lista` dentro do modal. Mostra paredes (com botão de remover via `paredRemover`) e objetos (com ícone dinâmico por tipo/estado, coordenadas, botão de loot para baús via `cenarioAbrirBauEditor`, e botão de remover via `cenarioRemoverObjeto`).

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `paredRemover`, `cenarioAbrirBauEditor`, `cenarioRemoverObjeto`, `document.getElementById`.

---

#### `cenarioRemoverObjeto(id)` — linha 608
Remove objeto por ID de `render_data.objetos[]`, re-renderiza no mapa e persiste.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `RPG_DATA.mapas`, `mapaRenderTokens`, `salvarRenderData`, `cenarioRenderObjetos`.

---

#### `cenarioAbrirBauEditor(bauId)` — linha 621
Edição simplificada de loot via `prompt()`: permite adicionar item por nome ao `bau.loot_itens[]`. Busca em `INV.itemDefs` por correspondência exata de nome. Persiste e atualiza lista.

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `INV.itemDefs`, `RPG_DATA.mapas`, `salvarRenderData`, `cenarioRenderObjetos`, `mostrarToast`.

---

#### `cenarioRenderObjetos_mapa(m)` — linha 639
Renderiza os objetos de cenário no overlay `#mapa-tokens` como divs absolutos com ícone + label. Objetos já coletados/abertos são omitidos. Cada elemento tem `click` → `cenarioInteragirObjeto`.

**Dependências externas:** `cenarioInteragirObjeto`, `document.getElementById`.

---

#### `cenarioInteragirObjeto(obj, mapId)` — linha 682
Dispatcher de interação por tipo:
- `'porta'` → `cenarioAbrirPorta`
- `'chave'` → `cenarioPegarChave`
- `'bau'` → `cenarioAbrirBau`
- `'obstaculo'` → toast informativo

Exige personagem selecionado (exceto para o mestre).

**Dependências externas:** `RPG_DATA.myRole`, `TOKEN_CTRL.nomeSelecionado`, `RPG_DATA.linked`, `cenarioAbrirPorta`, `cenarioPegarChave`, `cenarioAbrirBau`, `mostrarToast`.

---

#### `_cenarioSalvarObj(mapa, entry)` — linha 704
Helper interno: sincroniza `entry.mapa.render_data`, chama `mapaRenderTokens` e `salvarRenderData`.

**Dependências externas:** `mapaRenderTokens`, `salvarRenderData`.

---

#### `cenarioAbrirPorta(porta, mapId, charNome, mapa)` — linha 710
Toggle `porta.aberta`. Se trancada: verifica `custom_attrs.chaves_coletadas`. Persiste via `_cenarioSalvarObj`.

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.mapas`, `_cenarioSalvarObj`, `mostrarToast`.

---

#### `cenarioPegarChave(chave, mapId, charNome, mapa)` — linha 729
Marca `chave.coletada = true`, adiciona `chave_palavra` a `char.custom_attrs.chaves_coletadas`. Persiste render_data e PATCH em `characters`.

**Dependências externas:** `RPG_DATA.characters`, `RPG_DATA.rpgId`, `_cenarioSalvarObj`, `sb`, `mostrarToast`.

---

#### `cenarioAbrirBau(bau, mapId, charNome, mapa)` — linha 752 *(async)*
Abre baú (se não já aberto e sem tranca/chave bloqueando). Distribui loot conforme `bau.loot_tipo`:

| loot_tipo | Ação |
|-----------|------|
| `'aleatorio'` | Gera drops via `calcularDrops`/`gerarStatusItem`/`gerarNomeItem`, insere em `item_catalog` e `loot_pendente` |
| `'item'` | POST direto em `inventario` |
| `'ouro'` | Incrementa `custom_attrs.ouro` do personagem + PATCH |
| `loot_itens` (array) | Insere cada item pré-definido em `inventario` |

Persiste com `_cenarioSalvarObj`.

**Dependências externas:**

| Dependência | Tipo | Origem esperada |
|-------------|------|-----------------|
| `calcularDrops`, `gerarStatusItem`, `gerarNomeItem` | funções | `js/systems/catalog.js` |
| `sb` | função | `js/core/supabase.js` |
| `RPG_DATA` | global | `js/state.js` |
| `_cenarioSalvarObj` | função | mesmo arquivo |
| `mostrarToast` | função | `js/ui/modals.js` |

---

#### `cenarioObstaculoBloqueiaMovimento(mapId, colDest, rowDest)` — linha 812
Retorna `true` se há obstáculo com `tamanho` cobrindo a célula destino, ou porta fechada exatamente na célula. Ignora objetos já coletados/abertos.

**Dependências externas:** `_getMapaById`.

---

#### `abrirEditorCena()` — linha 882
Verifica mapa ativo, inicializa `CENA_ED` com o mapa atual (garantindo arrays `paredes`/`portas`/`objetos`), exibe `#modal-cena-overlay` e agenda renderização do canvas e lista de objetos.

**Dependências externas:** `MAPA_STATE`, `RPG_DATA.mapas`, `CENA_ED`, `cenaRenderizarCanvas`, `cenaRenderizarObjetos`, `_cenaBotoesAtualizar`, `mostrarToast`, `document.getElementById`.

---

#### `fecharEditorCena()` — linha 899
Oculta `#modal-cena-overlay`.

---

#### `cenaSetFerramenta(f)` — linha 903
Define `CENA_ED.ferramenta`, limpa `primeroPonto`, atualiza botões e exibe instrução textual para a ferramenta (`parede`, `porta`, `porta_trancada`, `chave`, `objeto`, `bau`, `remover`).

**Dependências externas:** `CENA_ED`, `_cenaBotoesAtualizar`, `document.getElementById`.

---

#### `_cenaBotoesAtualizar()` — linha 919
Remove `.ativo` de todos `.cena-tool-btn` e adiciona ao botão da ferramenta atual.

---

#### `cenaRenderizarCanvas()` — linha 928
Redimensiona o `<canvas id="cena-canvas">` para o tamanho da área, limpa e desenha: primeiro a imagem de fundo (`m.img_url`) se existir (com callback `onload`), depois chama `cenaGrade` e `cenaRenderizarSVG`.

**Dependências externas:** `CENA_ED`, `cenaGrade`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cenaGrade(ctx, m, W, H)` — linha 950
Desenha o grid no `CanvasRenderingContext2D` com linhas `rgba(200,168,75,0.12)` a cada célula.

**Dependências externas:** *Nenhuma.*

---

#### `cenaRenderizarSVG()` — linha 961 *(parcial — continua além de 985)*
Limpa e re-renderiza paredes e objetos do cenário no `<svg id="cena-svg">` usando `_cenaSvgEl`. Paredes: `<line>` com hit area transparente para clique. Continuação além da linha 985.

> ⚠ Função não completamente lida. A próxima análise começa na linha 961.

---

### Monkey-patches adicionais (linhas 961–1460)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `paredePorRenderizar` (global override) | 1269 | Após renderizar paredes/portas, chama `_renderizarObjetosNoMapa(m)` |
| `usarPorta` (global override) | 1354 | Substitui a função original com versão que chama `charTemChave` em vez de `_charTemChave` e suporta `porta.trancada = false` ao desbloquear |
| `paredeBloqueiaMovimento` (global override) | 1376 | Estende o original: também bloqueia se houver objeto `'blocker'` na célula destino |
| `window.ctxGerarBotoes` (4ª camada) | 1388 | Adiciona botões para: coletar chave, abrir baú, quebrar obstáculo destrutível (`atacar_obstaculo`) e portas destrutíveis (`atacar_porta`) |
| `window.ctxExecutarAcao` (4ª camada) | 1447 | Intercepta `coletar_chave`, `abrir_bau`, `atacar_porta`, `atacar_obstaculo` |

### Funções definidas (linhas 961–1460)

#### `cenaRenderizarSVG()` — linha 961 *(completa)*
Limpa `<svg id="cena-svg">` e re-renderiza: paredes como `<line>` com hit area transparente (12px de espessura) para clique fácil; portas e objetos como círculo + emoji + label via `renderObj` helper interno (closure). Paredes/objetos recebem `click` que chama `cenaRemoverParede`/`cenaRemoverObj` quando a ferramenta é `'remover'`. Exibe ponto dourado no primeiro ponto de parede pendente.

**Dependências externas:** `CENA_ED`, `_cenaSvgEl`, `cenaRemoverParede`, `cenaRemoverObj`, `document.getElementById`.

---

#### `_cenaSvgEl(tag, attrs)` — linha 1038
Helper que cria um elemento SVG com `createElementNS` e aplica todos os atributos do objeto `attrs`.

**Dependências externas:** `document.createElementNS`.

---

#### IIFE `_cenaClickInit` — linha 1045
Registra listener `'click'` em `#cena-mapa-area` via `DOMContentLoaded`. Ignora cliques em elementos SVG clicáveis (circles/lines); os demais chamam `_cenaHandleClick`.

**Dependências externas:** `_cenaHandleClick`, `document.addEventListener`, `document.getElementById`.

---

#### `_cenaHandleClick(e)` — linha 1056
Dispatcher de clique no editor por ferramenta:
- `'parede'`: 2 cliques → armazena 1º ponto e cria segmento com segundo
- `'porta'`/`'porta_trancada'`: preenche campos e abre `#modal-cfg-porta`
- `'chave'`: preenche campos e abre `#modal-cfg-chave`
- `'objeto'`: cria blocker direto em `render_data.objetos`
- `'bau'`: preenche campos e abre `#modal-cfg-bau`

Todas as operações que adicionam elementos registram no `CENA_ED.undoStack`.

**Dependências externas:** `CENA_ED`, `_cenaCoordsFromEvent`, `cenaRenderizarSVG`, `cfgBauTab`, `cfgBauRenderLista`, `cfgBauRenderSelecionados`, `mostrarToast`, `document.getElementById`.

---

#### `_cenaCoordsFromEvent(e)` — linha 1111
Converte coordenadas de clique para célula `{col, row}` clampadas aos limites do mapa.

**Dependências externas:** `CENA_ED`, `document.getElementById`.

---

#### `cenaRemoverParede(id)` — linha 1124
Remove parede por ID do buffer `CENA_ED.mapa.render_data.paredes` e re-renderiza SVG.

#### `cenaRemoverObj(id, tipo)` — linha 1130
Remove porta (se `tipo === 'porta'`) ou objeto de `render_data.objetos`/`portas` e re-renderiza SVG.

---

#### `cfgPortaConfirmar()` — linha 1139
Lê nome, col/row e tipo do modal de porta, cria entrada em `render_data.portas[]` com `trancada` e `chave_palavra`, empurra no `undoStack` e fecha o modal.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cfgChaveConfirmar()` — linha 1153
Lê nome, col/row e `chave_palavra` do modal de chave, cria objeto `{tipo:'chave'}` em `render_data.objetos[]`, empurra no `undoStack` e fecha.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cfgBauTab(tab)` — linha 1166
Alterna entre as abas `'itens'` e `'loot'` no modal de configuração do baú.

**Dependências externas:** `document.getElementById`.

---

#### `cfgBauRenderLista()` — linha 1175
Renderiza lista de `INV.itemDefs` filtrada por busca em `#cfg-bau-busca` (máx 30 itens). Items selecionados em `CENA_ED.cfgBauItens` ficam destacados.

**Dependências externas:** `INV.itemDefs`, `CENA_ED`, `cfgBauToggleItem`, `document.getElementById`.

---

#### `cfgBauToggleItem(defId, nome, icone)` — linha 1191
Toggle de seleção de item para o baú: remove se já selecionado, adiciona `{defId, nome, icone, quantidade:1}` se não. Re-renderiza lista e selecionados.

---

#### `cfgBauRenderSelecionados()` — linha 1199
Renderiza os itens já selecionados para o baú com input de quantidade e botão de remoção.

**Dependências externas:** `CENA_ED`, `document.getElementById`.

---

#### `cfgBauConfirmar()` — linha 1212
Cria ou atualiza objeto baú em `render_data.objetos[]` com: nome, col/row, lista de itens (modo `'itens'`) ou loot aleatório com raridade e quantidade (modo `'loot'`). Fecha modal e re-renderiza SVG.

**Dependências externas:** `CENA_ED`, `cenaRenderizarSVG`, `document.getElementById`.

---

#### `cenaLimparTudo()` — linha 1234
Confirma com `confirm()` e limpa `paredes`, `portas` e `objetos` do mapa no editor.

---

#### `cenaSalvar()` — linha 1241 *(async)*
Persiste `CENA_ED.mapa.render_data` via `salvarRenderData`. Se o mapa está ativo: chama `mapaRenderTokens` para atualizar ao vivo.

**Dependências externas:** `CENA_ED`, `RPG_DATA.mapas`, `salvarRenderData`, `MAPA_STATE`, `mapaRenderTokens`, `mostrarToast`.

---

#### Listener Ctrl+Z — linha 1253
Registrado globalmente via `document.addEventListener('keydown')`. Ativo apenas quando `#modal-cena-overlay` está visível. Desfaz a última operação de `undoStack` (remove parede/porta/objeto pelo ID armazenado).

---

#### `_renderizarObjetosNoMapa(m)` — linha 1275
Renderiza objetos de cenário (chave, blocker, baú) como `<g>` SVG no `#mapa-dist-svg` do mapa ao vivo. Blocker não tem clique; chave e baú chamam `_objetoClicar`.

**Dependências externas:** `_objetoClicar`, `document.getElementById`.

---

#### `_objetoClicar(mapId, objId)` — linha 1312
Roteia clique em objeto durante sessão: chave → `_coletarChave`; baú → `_abrirBauModal`. Exige personagem selecionado.

**Dependências externas:** `_getMapaById`, `TOKEN_CTRL`, `RPG_DATA.linked`, `_coletarChave`, `_abrirBauModal`, `mostrarToast`.

---

#### `_coletarChave(mapId, keyId, charNome)` — linha 1326
Adiciona `{id, nome, chave_palavra}` a `char.custom_attrs.chaves[]`, remove chave do `render_data.objetos`, persiste e re-renderiza. Chama `_mesaRenderAcoes?.()` para atualizar botões contextuais.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `RPG_DATA.mapas`, `RPG_DATA.rpgId`, `paredePorRenderizar`, `salvarRenderData`, `_mesaRenderAcoes`, `mostrarToast`.

---

#### `charTemChave(charNome, chave_palavra)` — linha 1348
Verifica se `char.custom_attrs.chaves` contém entrada com `chave_palavra` correspondente. **Nota:** existe também `_charTemChave` (linha 124) que usa `chaves_coletadas` — duas implementações ligeiramente diferentes do mesmo conceito.

**Dependências externas:** `RPG_DATA.characters`.

---

#### `_abrirBauModal(mapId, bauId, charNome)` — linha 1458 *(parcial — continua além de 1460)*
Localiza baú no `render_data.objetos` e prepara o modal de interação com o baú.

> ⚠ Função não completamente lida. A próxima análise começa na linha 1458.

---

### Variáveis/constantes definidas (linhas 1458–1957)

| Nome | Linha | Tipo | Descrição |
|------|-------|------|-----------|
| `CANVAS_CONTEXT` | 1868 | `let` string\|null | Contexto de uso do modal de cenário: `'canvas'` (editor canvas) / `'canvas_editing'` (edição) / `null` (mapa ao vivo) |

### Monkey-patches adicionais (linhas 1458–1957)

| Alvo | Linha | O que adiciona |
|------|-------|----------------|
| `window.cenarioAtivarPlacement` (override) | 1890 | Intercepta: se `CANVAS_CONTEXT === 'canvas'`, adiciona listener de clique no canvas do editor; se `'canvas_editing'`, atualiza objeto existente via `window._editandoObjeto`; caso contrário: delega ao original |

### Funções definidas (linhas 1458–1957)

#### `_abrirBauModal(mapId, bauId, charNome)` — linha 1458 *(completa)*
Preenche e exibe `#modal-abrir-bau` com: nome do baú, conteúdo (lista de itens, info de loot aleatório ou mensagem de já aberto) e botão de confirmação (oculto se já aberto).

**Dependências externas:** `_getMapaById`, `document.getElementById`.

---

#### `abrirBauConfirmar()` — linha 1481 *(async)*
Confirma a abertura do baú: marca `bau.aberto = true`, distribui itens via `adicionarItemInventario` para cada item em `bau.itens` ou gera loot aleatório (filtra `INV.itemDefs` por raridade mínima via `_rarPeso`). Persiste e re-renderiza.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `RPG_DATA.characters`, `INV.itemDefs`, `adicionarItemInventario` (função externa), `_rarPeso`, `salvarRenderData`, `paredePorRenderizar`, `mostrarToast`, `document.getElementById`.

---

#### `_rarPeso(r)` — linha 1518
Função pura. Mapeia raridade para peso numérico: `comum→1`, `incomum→2`, `raro→3`, `épico→4`, `lendário→5`.

**Dependências externas:** *Nenhuma.*

---

#### `_abrirModalAtacarPorta(mapId, portaId, charNome)` — linha 1521
Cria e appenda `#modal-atacar-porta-temp` ao `document.body` com lista de habilidades com `formula_dano` do personagem (via `atkGetHabilidadesCampanha`). Cada botão chama `_aplicarDanoPorta`.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `atkGetHabilidadesCampanha`, `mostrarToast`, `document.body`.

---

#### `_aplicarDanoPorta(mapId, portaId, charNome, habilidade)` — linha 1563 *(async)*
Calcula dano via `calcularDanoHabilidade`, aplica a `porta.hp_atual`. Se HP ≤ 0: marca `porta.aberta = true` e `porta.trancada = false`. Persiste, re-renderiza, remove modal temp e chama `_mesaRenderizarColunas?.()`.

**Dependências externas:** `_getMapaById`, `RPG_DATA`, `calcularDanoHabilidade`, `salvarRenderData`, `paredePorRenderizar`, `_mesaRenderizarColunas`, `mostrarToast`, `document.getElementById`.

---

#### `_abrirModalAtacarObstaculo(mapId, obstaculoId, charNome)` — linha 1599
Análogo a `_abrirModalAtacarPorta` mas para objetos com `tipo === 'obstaculo'` e `destrutivel === true`. Cria `#modal-atacar-obstaculo-temp`.

**Dependências externas:** `_getMapaById`, `RPG_DATA.characters`, `atkGetHabilidadesCampanha`, `mostrarToast`.

---

#### `_aplicarDanoObstaculo(mapId, obstaculoId, charNome, habilidade)` — linha 1641 *(async)*
Aplica dano ao obstáculo. Se HP ≤ 0: remove o obstáculo de `render_data.objetos` (splice). Persiste, re-renderiza, fecha modal temp.

**Dependências externas:** (mesmas de `_aplicarDanoPorta`).

---

#### `calcularDanoHabilidade(hab, char)` — linha 1678
Função pura (exceto por `Math.random`). Parseia `hab.formula_dano` como string de dado (regex `NdX`), modificador fixo (`+N`) e atributos D&D clássicos (`FOR/DES/CON/INT/SAB/CAR`) com modificador `floor((valor - 10) / 2)`. Retorna mínimo de 1.

**Dependências externas:** *Nenhuma (usa apenas `char.atributos`).*

---

#### `nmAtivarModoParede()` — linha 1743
Lê cor e largura de `#nm-parede-cor`/`#nm-parede-largura`, atualiza `WALLS_STATE.configAtual`, define `MAPA_STATE.toolMode = 'paredes'` e fecha o modal.

**Dependências externas:** `WALLS_STATE`, `MAPA_STATE`, `fecharModalNovoMapa`, `mostrarToast`, `document.getElementById`.

---

#### `nmAtivarModoPorta()` — linha 1752
Preenche `CENARIO_STATE.placement` com defaults de porta e define `MAPA_STATE.toolMode = 'cenario_placement'`. Fecha o modal.

**Dependências externas:** `CENARIO_STATE`, `MAPA_STATE`, `fecharModalNovoMapa`, `mostrarToast`.

---

#### `nmRenderParedesList()` — linha 1765
Renderiza a lista de paredes e portas do mapa atual em `#nm-paredes-lista` com botões de remover (`paredRemover`) e editar (`portaEditar`).

**Dependências externas:** `_getMapaById`, `MAPA_STATE`, `paredRemover`, `portaEditar`, `document.getElementById`.

---

#### `cenarioPortaPopularMapas()` — linha 1795
Popula o `<select id="cen-porta-mapa-destino">` com os mapas disponíveis em `RPG_DATA.mapas` (somente se ainda não populado).

**Dependências externas:** `RPG_DATA.mapas`, `document.getElementById`.

---

#### `trocarAbaCenario(aba)` — linha 1806
Troca aba ativa no modal de cenário: oculta todas `.cenario-tab`, exibe `#cenario-tab-{aba}`. Aplica cor temática por aba ao botão ativo (`porta`→roxo, `chave`→dourado, `bau`→verde, `obstaculo`→vermelho).

**Dependências externas:** `document.querySelectorAll`, `document.getElementById`.

---

#### `atualizarResumoObjetosCenario()` — linha 1835
Renderiza `#cenario-objetos-resumo` com a lista de objetos do mapa atual (ícone, nome, coordenadas). Exibe mensagem vazia se não há objetos.

**Dependências externas:** `MAPA_STATE`, `_getMapaById`, `document.getElementById`.

---

#### `abrirModalCenarioNoCanvas(tipo)` — linha 1870
Define `CANVAS_CONTEXT = 'canvas'`, abre `#modal-cenario-overlay` e chama `trocarAbaCenario` para o tipo solicitado.

**Dependências externas:** `trocarAbaCenario`, `document.getElementById`.

---

#### Override `window.cenarioAtivarPlacement` — linha 1890 *(parcial — continua além de 1957)*
Camada de integração entre o modal de cenário e o editor canvas (`nmCE`). Dois modos:
- `CANVAS_CONTEXT === 'canvas'`: registra listener `once` no `#nmce-canvas`; no clique chama `nmceCoords`, `_nmceSnapCelula`, `coletarDadosFormularioCenario` e `adicionarObjetoAoCanvas`
- `CANVAS_CONTEXT === 'canvas_editing'`: atualiza objeto em `window.nmCE.renderData.portas[index]` ou `objetos[index]`

> ⚠ Função não completamente lida. A próxima análise começa na linha 1890.

---

### Funções definidas (linhas 1890–2229)

#### Override `window.cenarioAtivarPlacement` — linha 1890 *(completa)*
Três modos de operação via `CANVAS_CONTEXT`:
- `'canvas'`: registra listener `once` em `#nmce-canvas`; no clique: obtém coords via `window.nmceCoords`/`window._nmceSnapCelula`, coleta dados do formulário via `coletarDadosFormularioCenario`, adiciona objeto via `adicionarObjetoAoCanvas`, limpa `CANVAS_CONTEXT`.
- `'canvas_editing'`: lê `window._editandoObjeto {tipo, index}`, atualiza campos do objeto correspondente em `window.nmCE.renderData.portas[index]` (porta) ou `objetos[index]` (chave/bau/obstaculo), re-renderiza via `window._nmceRenderWalls`/`window._nmceAtualizarLista`, restaura texto dos botões e exibe toast.
- `null` (padrão): delega ao `cenarioAtivarPlacement_original`.

**Dependências externas:** `CANVAS_CONTEXT`, `coletarDadosFormularioCenario`, `adicionarObjetoAoCanvas`, `window.nmCE`, `window.nmceCoords`, `window._nmceSnapCelula`, `window._nmceRenderWalls`, `window._nmceAtualizarLista`, `mostrarToast`, `document.getElementById`, `document.querySelector`.

---

#### `coletarDadosFormularioCenario(tipo)` — linha 2017
Lê todos os campos do formulário do modal de cenário para o tipo solicitado e retorna objeto `dados`:

| tipo | Campos coletados |
|------|-----------------|
| `'porta'` | nome, icone, cor, trancada, chave_palavra, transicao, destrutivel, hp_max/hp_atual, mapa_destino, destino_col/row |
| `'chave'` | nome, palavra, icone |
| `'bau'` | nome, trancado, chave_palavra, loot_tipo + campos específicos (ouro/item_id+qtd/tier) |
| `'obstaculo'` | nome, icone, tamanho, destrutivel, hp_max/hp_atual |

**Dependências externas:** `document.getElementById`.

---

#### `adicionarObjetoAoCanvas(tipo, col, row, dados)` — linha 2070
Adiciona o objeto ao `window.nmCE.renderData` (destino `portas[]` para porta, `objetos[]` para demais). Cria estrutura com ID único (`Date.now()`), campos extraídos de `dados` e `aberto:false`. Re-renderiza via `window._nmceRenderWalls` e `window._nmceAtualizarLista`.

**Dependências externas:** `window.nmCE`, `window._nmceRenderWalls`, `window._nmceAtualizarLista`, `mostrarToast`, `document.getElementById`.

---

#### `editarObjetoCanvas(tipo, index)` — linha 2155
Abre o modal de cenário em modo edição (`CANVAS_CONTEXT = 'canvas_editing'`). Armazena `{tipo, index}` em `window._editandoObjeto`. Chama `trocarAbaCenario(tipoModal)` e preenche todos os campos do formulário com os valores do objeto existente. Altera texto dos botões para `'✓ Atualizar ...'`.

**Dependências externas:** `window.nmCE`, `CANVAS_CONTEXT`, `trocarAbaCenario`, `cenarioBauLootChange`, `mostrarToast`, `document.getElementById`, `document.querySelector`.

---

### Sumário de dependências externas não resolvidas — `js/ui/tabs.js`

| Dependência | Tipo | Módulo provável |
|-------------|------|-----------------|
| `_getMapaById` | função | `js/maps/maps.js` |
| `mapaRenderTokens` | função | `js/maps/maps.js` |
| `MAPA_STATE` | global | `js/maps/maps.js` |
| `TOKEN_CTRL` | global | `js/maps/maps.js` |
| `getPosicaoNoMapa` | função | `js/maps/maps.js` |
| `_mesaRenderAcoes` | função | `js/hub/hub.js` |
| `_mesaRenderizarColunas` | função | `js/hub/hub.js` |
| `fecharModalNovoMapa` | função | `js/maps/maps.js` |
| `superficieVerificarEntrada` | função | `js/maps/maps.js` (opcional) |
| `realtimeBroadcast` | função | `js/core/realtime.js` |
| `mostrarToast` | função | `js/ui/modals.js` |
| `atkGetHabilidadesCampanha` | função | `js/combat/combat.js` |
| `adicionarItemInventario` | função | `js/systems/inventory.js` |
| `calcularDrops`, `gerarStatusItem`, `gerarNomeItem` | funções | `js/systems/catalog.js` |
| `window.nmCE`, `window.nmceCoords`, `window._nmceSnapCelula`, `window._nmceRenderWalls`, `window._nmceAtualizarLista` | globais | `js/systems/catalog.js` |

---
