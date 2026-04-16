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
| 6 | `js/systems/rest.js` | 98 | — |
| 7 | `js/systems/npcs.js` | 176 | — |
| 8 | `js/core/realtime.js` | 269 | — |
| 9 | `js/chat/chat.js` | 324 | — |
| 10 | `js/combat/animations.js` | 382 | — |
| 11 | `js/maps/camera.js` | 394 | — |
| 12 | `js/systems/lore.js` | 417 | — |
| 13 | `js/state.js` | 441 | — |
| 14 | `js/auth/auth.js` | 482 | — |
| 15 | `js/core/supabase.js` | 504 | — |
| 16 | `js/characters/characters.js` | 581 | — |
| 17 | `js/characters/skills.js` | 627 | — |
| 18 | `js/hub/hub.js` | 2300 | — |
| 19 | `js/systems/inventory.js` | 2222 | — |
| 20 | `js/ui/tabs.js` | 2229 | — |
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

*— Documento em construção. Atualizado a cada novo arquivo mapeado.*
