# Guia de Módulos — RPG Hub

> **Para colaboradores (humanos ou IA):** Leia este documento antes de qualquer alteração.  
> Ele descreve onde está cada parte do sistema e o que você precisa abrir para cada tipo de mudança.

---

## Como o código está organizado

O JavaScript do RPG Hub está dividido em **26 arquivos** dentro da pasta `js/`, organizados por domínio. Não existe build step, bundler ou npm — os arquivos são carregados diretamente no `index.html` em ordem de dependência.

```
js/
├── config.js                  # Credenciais e constantes globais
├── state.js                   # Variáveis de estado global da aplicação
├── init.js                    # Sinal de inicialização (carregado por último)
│
├── core/                      # Infraestrutura base (sem features)
│   ├── events.js              # Helpers de permissão e utilitários de batalha
│   ├── utils.js               # Ícones, animações CSS, configuração de dados
│   ├── supabase.js            # Cliente Supabase: leitura, escrita, upload
│   └── realtime.js            # WebSocket / sincronização em tempo real
│
├── auth/
│   └── auth.js                # Login, registro, recuperação de senha, sessão
│
├── chat/
│   └── chat.js                # Chat em tempo real via Supabase Broadcast
│
├── characters/
│   ├── characters.js          # Fichas de personagem, atributos, level up, XP
│   └── skills.js              # Habilidades: CRUD, builder de fórmulas, lore, novo mapa
│
├── combat/
│   ├── combat.js              # Sistema de combate: iniciativa, turnos, dano, críticos, empurrar
│   └── animations.js          # Animações de combate no Canvas 2D + handlers de broadcast
│
├── maps/
│   ├── camera.js              # Efeitos visuais, zonas, tokens mortos, inicialização
│   └── maps.js                # Renderização de mapas, tokens, movimento, combate tático
│
├── systems/
│   ├── inventory.js           # Inventário, equipamentos, itens, wizard de campanha
│   ├── lore.js                # Lore: renderização, filtros, CRUD (filtra entradas internas de chat)
│   ├── npcs.js                # Geração e posicionamento de NPCs genéricos
│   ├── creative.js            # Ações criativas, tutorial, fluxo de ataque da arena
│   ├── catalog.js             # Aparência (APMOD), editor canvas de mapa, catálogo de itens
│   ├── arena.js               # Modo Arena (PvP/PvE): estado, navegação, combate
│   └── rest.js                # ★ NOVO — Sistema de Descanso Curto e Longo
│
├── hub/
│   ├── hub.js                 # Hub de campanhas: lista, mesa 3 colunas, iniciarApp()
│   └── import.js              # Importação de campanhas, geração por IA, tabs, toasts
│
└── ui/
    ├── modals.js              # Mercado secreto, painel de sessão
    └── tabs.js                # Paredes, portas, chaves, baús, obstáculos: lógica de colisão e interação
```

---

## Detalhamento por arquivo

---

### `js/config.js` — 91 linhas
**Credenciais e constantes da aplicação.**

Contém:
- `SUPABASE_URL`, `SUPABASE_KEY` — credenciais de acesso ao banco
- `HCAPTCHA_SITEKEY` — chave do captcha de registro
- `HUB_EVENTS` — event bus central (pub/sub entre módulos)
- `EMAIL_CONFIRMATION_ENABLED` — liga/desliga confirmação de e-mail

**Edite aqui quando:** precisar trocar as credenciais do Supabase, mudar a chave do hCaptcha, ou ativar/desativar confirmação de e-mail.

---

### `js/state.js` — 441 linhas
**Todas as variáveis de estado global da aplicação.**

Contém:
- `SESSION` — sessão do usuário autenticado `{ access_token, user: { id, email } }`
- `RPG_DATA` — dados completos da campanha ativa (personagens, habilidades, mapas, etc.)
- `CURRENT_RPG` — ID da campanha aberta
- `HUB_DATA` — lista de campanhas do usuário `{ rpgs: [] }`
- `MAPA_ZOOM`, `MAPA_STATE`, `BATALHA_ATUAL_ID` — estado do mapa e batalha
- `CHAT` — objeto com mensagens, online, não lidos
- `HISTORICO` — histórico de rolagens de dados
- `TIPOS_DADO`, `IMPORT_CSVS` — configurações de dados e importação
- Utilitários de câmera automática e tamanho de personagem por dispositivo

**Edite aqui quando:** precisar adicionar uma nova variável de estado global, ou mudar o valor padrão de algum estado.

---

### `js/core/supabase.js` — 506 linhas
**Cliente Supabase: toda a comunicação com o banco de dados.**

Funções principais:
- `sb(path, opts)` — chamada REST genérica ao Supabase (assinatura: path + objeto de opções com `method`, `body`, `prefer`, `headers`)
- `sbUpload(bucket, path, file)` — upload de arquivos para Storage
- `getAllRPGs()` — lista todas as campanhas do usuário
- `lerRPG(id)` — carrega todos os dados de uma campanha
- `importRPG(data)` — cria campanha com dados importados
- `updateRPGData(rpgId, section, data)` — salva seção de dados na campanha
- `deleteRPGData(id)` — remove entrada do banco
- Lógica de retry com backoff exponencial

**Edite aqui quando:** precisar mudar como dados são lidos/salvos no banco, adicionar nova tabela, ou alterar queries ao Supabase.

> **Atenção:** Nunca usar `encodeURIComponent()` em IDs inteiros ao montar paths de PATCH/DELETE — o Supabase REST não aceita IDs codificados em filtros de igualdade.

---

### `js/core/realtime.js` — 268 linhas
**Conexão WebSocket para sincronização em tempo real entre jogadores.**

Funções principais:
- `iniciarRealtime(rpgId)` — abre canal WebSocket da campanha
- `fecharRealtime()` — encerra a conexão e limpa listeners
- `realtimeBroadcast(tipo, payload)` — envia evento broadcast para todos os jogadores
- Handlers de presença, chat, movimentação de tokens, batalha
- Handler `porta_transicao` — sincroniza teletransporte de personagem entre mapas

**Edite aqui quando:** precisar adicionar um novo evento em tempo real ou mudar o comportamento de reconexão.

---

### `js/core/events.js` — 50 linhas
**Helpers de permissão e utilitários para processamento de eventos.**

Funções:
- `temPermissao(acao)` — verifica se o usuário pode executar uma ação
- `podeEditarPersonagem(nome)` — verifica se pode editar um personagem específico
- `_estadoBatalhaJogador()` — retorna estado atual da batalha do jogador

> Nota: O event bus `HUB_EVENTS` em si fica em `config.js`.

**Edite aqui quando:** precisar mudar regras de permissão ou adicionar utilitários de verificação de estado.

---

### `js/core/utils.js` — 64 linhas
**Utilitários de animação e configuração visual de ícones.**

Funções:
- `injectCustomCSS(css)` — injeta CSS personalizado no documento
- `processCustomSVG(config)` — processa SVGs customizados
- `getCardIconSVG(tipo)` — retorna SVG de ícone de card
- `getLoadingAnimSVG()` — retorna SVG de animação de carregamento

**Edite aqui quando:** precisar alterar ícones customizáveis ou animações de loading.

---

### `js/auth/auth.js` — 482 linhas
**Sistema completo de autenticação.**

Funções principais:
- `authTab(aba)` — alterna entre abas Login / Registro
- `fazerLogin()` — autentica com e-mail e senha
- `registrar()` — cria nova conta com hCaptcha
- `recuperarSenha()` — envia e-mail de recuperação
- `refreshSession()` — renova token JWT automaticamente
- `logout()` — encerra sessão e limpa estado

**Edite aqui quando:** precisar mudar o fluxo de login, adicionar outro método de autenticação, ou alterar a tela de registro.

---

### `js/chat/chat.js` — 324 linhas
**Chat em tempo real entre jogadores da campanha.**

Contém o objeto `CHAT` e funções:
- Envio e recebimento de mensagens via Supabase Broadcast
- Persistência do histórico de mensagens na tabela `lore` (seção `chat_cache`) — **não visível na aba Lore**
- Renderização do chat na tela
- Controle de presença online e badge de mensagens não lidas

**Edite aqui quando:** precisar alterar o comportamento do chat, presença online, ou como mensagens são persistidas.

---

### `js/characters/characters.js` — 566 linhas
**Fichas de personagem, atributos, level up e XP.**

Funções principais:
- `renderCharView(nome)` — renderiza card resumido do personagem
- `renderAttrView(nome)` — renderiza ficha completa com barras de HP, atributos e estado moribundo
- `abrirModalLevelUp(nome)` — abre modal de level up
- `salvarAtributos(nome)` — persiste atributos editados no banco

**Novidades Vol II v2.1:**
- `renderAttrView` exibe painel **☠ Moribundo** com contadores de salvaguarda (✔ sucessos / ✘ falhas) quando `custom_attrs.moribundo === true`

**Edite aqui quando:** precisar alterar a ficha de personagem, o fluxo de level up, a exibição de atributos, ou a UI do estado moribundo.

---

### `js/characters/skills.js`
**Habilidades: CRUD, builder de fórmulas, lore e integração com mapa.**

**Edite aqui quando:** precisar alterar como habilidades são criadas, editadas, calculadas ou exibidas.

---

### `js/combat/combat.js` — 2.720 linhas
**Sistema de combate: iniciativa, turnos, dano, críticos.**

Funções principais:
- `atkIniciarAtaque()` / `atkConfirmarAtaque()` — fluxo de ataque
- `atkAplicarDano(nomeAlvo, dano, contexto, tipoDano)` — aplica dano e gerencia estado
- `batalhaRolarIniciativa()` — rola iniciativa d20
- `calcularDanoFinal()` — aplica buffs, resistências e críticos ao dano bruto

**Novidades Vol II v2.1:**
- `atkAplicarDano` agora diferencia jogadores (caem em estado **moribundo** com salvaguardas) de NPCs (morte direta)
- `acaoEmpurrar(atacanteNome, alvoNome, batalhaId)` — nova ação: rola Força vs Força, desloca 2 células verificando paredes, causa dano de impacto

**Edite aqui quando:** precisar alterar mecânicas de dano, iniciativa, críticos, ou adicionar novas ações de combate.

---

### `js/combat/animations.js` — 283 linhas
**Animações de combate no Canvas 2D e handlers de broadcast.**

Contém:
- `combateReceberBroadcast(payload)` — despacha eventos recebidos via WebSocket para todos os clientes
- Motor de animação de ataque (Canvas 2D, zero dependências)
- `animBroadcast(payload)` — emite animação para todos via canal de chat

**Novidades Vol II v2.1 — novos handlers em `combateReceberBroadcast`:**

| Evento | Efeito |
|---|---|
| `personagem_caiu` | Marca `moribundo=true`, re-renderiza tokens, exibe toast |
| `personagem_estabilizou` | Limpa moribundo, marca `estabilizado=true`, re-renderiza |
| `fase_mudou` | Atualiza `bs.fase` e chama `_aplicarEstadoBatalhaUI()` (pré-combate → iniciativa) |
| `empurrao_executado` | Atualiza posição do alvo no mapa local, re-renderiza tokens |
| `ataque_oportunidade` | Exibe toast com resultado do ataque fora de turno |

**Edite aqui quando:** precisar adicionar novos tipos de animação, novos eventos de broadcast, ou alterar como eventos de batalha são sincronizados entre clientes.

---

### `js/maps/maps.js` — ~9.370 linhas
**Renderização de mapas, tokens, movimento e lógica de combate tático.**

Subsistemas principais:
- Renderização de tokens (`mapaRenderTokens`) com degradação visual por HP
- Movimento por teclado/arrastar com verificação de colisão
- Sistema de batalha: `batalhaIniciar`, `batalhaPassarVez`, `_aplicarEstadoBatalhaUI`
- Fog of war (desativado — funções existem mas retornam imediatamente)
- Botões contextuais (`ctxGerarBotoes`) baseados em posição no grid
- Movimentação de recursos e sistema de movimento por pontos

**Novidades Vol II v2.1:**

| Feature | Função / local |
|---|---|
| HUD de Turno | Listener `HUB_EVENTS.on('turno_avancou')` — exibe nome e anel no token da vez |
| Degradação visual de token | `mapaRenderTokens` — aplica `filter` e classes `token-critico` / `token-moribundo` por % HP |
| Badge Moribundo | `_mapaAdicionarBadgesBuffTokens` — badge roxo "MORIBUNDO" acima do token |
| Salvaguardas de Morte | `batalhaPassarVez` — rola d20 por personagem moribundo a cada round; 20 natural acorda, 2 sucessos estabiliza, 3 falhas mata |
| Reset de reações | `batalhaPassarVez` — `bs.reacoes = {}` no início de cada round |
| Highlight de células | `ctxHighlightTurno(charNome)` — overlay SVG: azul = movimento, vermelho = alvos atacáveis |
| Highlight limpar | `ctxHighlightLimpar()` — chamado em `turno_avancou` e ao fechar ataque |
| BFS de movimento | `_bfsCelulas(col, row, movMax, mapId, W, H)` — pathfinding respeitando paredes |
| Células com alvo | `_celulasComAlvo(col, row, alcance, mapId, W, H, charNome)` |
| Clique ativa highlight | `_tokenCliqueSimples` — ativa highlight se for vez do personagem |
| Preview AoE | `aoePreviewAtualizar(centroCol, centroRow, raio)` — badges ☠/⚠ em tokens no raio |
| Pré-combate | `batalhaConfirmarPosicionamento()` — fase `posicionamento` → `iniciativa` |
| Botão posicionamento | `_aplicarEstadoBatalhaUI` — mostra/oculta `#btn-confirmar-posicionamento-wrap` |
| Ataques de Oportunidade | `verificarAtaqueOportunidade(mapId, nome, colAntes, rowAntes, colDepois, rowDepois)` |
| Hook de movimento | `_moverTokenPorSeta` — chama `verificarAtaqueOportunidade` e `superficieVerificarEntrada` |
| Botão Empurrar | `ctxGerarBotoes` — adiciona botão "💥 Empurrar" para inimigos adjacentes em combate |
| Superfícies render | `superficieRenderizar(mapa, tokensEl)` — renderiza overlay colorido por tipo (fogo/gelo/etc.) |
| Superfícies efeito | `superficieVerificarEntrada(mapId, charNome, col, row)` — aplica DOT/debuff ao entrar na célula |
| Linha de Visão | `losVerificar(mapId, col1, row1, col2, row2)` — verifica intersecção com paredes |
| LoS integrado | `fogRevealAround` — usa `losVerificar` antes de revelar cada célula |
| Intersecção de segmentos | `_segIntersect(ax, ay, bx, by, cx, cy, dx, dy)` — auxiliar geométrico para LoS |
| Superfícies no mapa | `mapaRenderTokens` — chama `superficieRenderizar` após renderizar objetos de cenário |

**Edite aqui quando:** precisar alterar renderização de tokens, movimento, mecânicas de batalha, highlight visual, salvaguardas, ataques de oportunidade, superfícies de terreno, ou linha de visão.

---

### `js/maps/camera.js`
**Efeitos visuais, zonas, tokens mortos, inicialização.**

Contém `_injetarCssEfeitos()` — gera keyframes e classes CSS de animação de token dinamicamente.

**Edite aqui quando:** precisar alterar efeitos visuais de câmera, zonas de interesse, ou a injeção de CSS de animação.

---

### `js/systems/inventory.js`
**Inventário, equipamentos, itens e wizard de campanha.**

**Edite aqui quando:** precisar alterar como itens são gerenciados, equipados ou exibidos.

---

### `js/systems/rest.js` — 98 linhas ★ NOVO
**Sistema de Descanso Curto e Longo.**

Funções:
- `descansoExecutar(tipo, nomePersonagem)` — executa descanso para um personagem
  - `'curto'`: recupera `descanso_curto_pct` do HP máximo (padrão 50%), reseta cooldowns com `tipo_recarga: 'descanso_curto'`
  - `'longo'`: recupera HP total, reseta todos os cooldowns, restaura recursos ao máximo, limpa estado moribundo/estabilizado
- `descansoGrupo(tipo)` — chama `descansoExecutar` para todos os PCs vivos, envia narração ao chat

Configurável via `RPG_DATA.config.descanso_curto_pct` (valor entre 0 e 1).

**Edite aqui quando:** precisar alterar a recuperação de HP no descanso, o reset de cooldowns, ou adicionar efeitos adicionais ao descanso.

---

### `js/systems/lore.js`
**Lore: renderização, filtros, CRUD. Entradas do chat são filtradas automaticamente.**

---

### `js/systems/npcs.js`
**Geração e posicionamento de NPCs genéricos.**

---

### `js/systems/creative.js`
**Ações criativas dos jogadores e tutorial.**

---

### `js/systems/catalog.js`
**Aparência (APMOD), editor canvas de mapa, catálogo de itens.**

Contém:
- Editor canvas de mapa (ferramentas 🧱 🚪 📦, pincel, formas)
- Sistema de aparência de personagem (APMOD)
- Catálogo de itens da campanha
- Mercado NPC

**Edite aqui quando:** precisar alterar o editor visual de mapas, o sistema de aparência, ou o catálogo de itens.

---

### `js/systems/arena.js`
**Modo Arena (PvP/PvE): estado, navegação, combate.**

---

### `js/hub/hub.js`
**Hub de campanhas, entrada no jogo, layout mesa 3 colunas.**

---

### `js/hub/import.js`
**Importação de campanhas, geração por IA, controle de abas, toasts.**

Contém `mostrarToast(msg, tipo)` — notificações globais usadas por todos os módulos.

---

### `js/ui/modals.js`
**Mercado secreto e painel de sessão do mestre.**

---

### `js/ui/tabs.js` — 1.554 linhas
**Paredes, portas, chaves, baús e obstáculos — lógica de jogo.**

Contém:
- `paredeBloqueiaMovimento(mapId, col, row, dc, dr)` — verifica colisão com parede durante movimento
- `usarPorta(mapId, portaId, charNome)` — toggle aberta/fechada, verifica tranca, teletransporte entre mapas via `_portaTransportarChar()`
- Sistema de chaves e baús
- Botões contextuais: portas, chaves e baús adjacentes

**Novidades Vol II v2.1:**
- `_portaTransportarChar` chama `superficieVerificarEntrada` ao chegar no destino — personagens que entram por portal também são afetados por superfícies

**Edite aqui quando:** precisar alterar interação com portas/chaves/baús, colisão de paredes, ou teletransporte entre mapas.

---

### `js/init.js` — 5 linhas
**Sinal de inicialização — carregado por último.**

---

## Referência rápida: "O que devo abrir?"

| Quero alterar... | Arquivo(s) |
|---|---|
| Credenciais do Supabase | `js/config.js` |
| Nova variável de estado global | `js/state.js` |
| Como dados são lidos/salvos no banco | `js/core/supabase.js` |
| Novo evento em tempo real entre jogadores | `js/core/realtime.js` |
| Regras de permissão (mestre/jogador) | `js/core/events.js` |
| Tela de login ou registro | `js/auth/auth.js` |
| Chat entre jogadores | `js/chat/chat.js` |
| Ficha de personagem / estado moribundo | `js/characters/characters.js` |
| Habilidades e seus efeitos | `js/characters/skills.js` |
| Mecânicas de combate, dados, dano | `js/combat/combat.js` |
| **Ação de Empurrar** | `js/combat/combat.js` (`acaoEmpurrar`) |
| Animações visuais de ataque | `js/combat/animations.js` |
| **Novos handlers de broadcast** | `js/combat/animations.js` (`combateReceberBroadcast`) |
| Editor de mapas, tokens, movimento | `js/maps/maps.js` |
| **HUD de turno, highlight de células** | `js/maps/maps.js` |
| **Salvaguardas de morte** | `js/maps/maps.js` (`batalhaPassarVez`) |
| **Ataques de oportunidade** | `js/maps/maps.js` (`verificarAtaqueOportunidade`) |
| **Superfícies de terreno** | `js/maps/maps.js` (`superficieVerificarEntrada`, `superficieRenderizar`) |
| **Linha de visão** | `js/maps/maps.js` (`losVerificar`) |
| **Preview AoE dinâmico** | `js/maps/maps.js` (`aoePreviewAtualizar`) |
| **Pré-combate / posicionamento** | `js/maps/maps.js` (`batalhaConfirmarPosicionamento`) |
| Efeitos visuais nos tokens (brilho, pulso) | `js/maps/camera.js` |
| **Descanso Curto e Longo** | `js/systems/rest.js` |
| Inventário e equipamentos | `js/systems/inventory.js` |
| Lore e narrativa da campanha | `js/systems/lore.js` |
| Geração de NPCs rápidos | `js/systems/npcs.js` |
| Ações criativas dos jogadores | `js/systems/creative.js` |
| Editor canvas de mapa (pintura + paredes) | `js/systems/catalog.js` |
| Aparência de personagem, catálogo de itens | `js/systems/catalog.js` |
| Modo Arena (PvP/PvE) | `js/systems/arena.js` |
| Hub de campanhas, entrada no jogo | `js/hub/hub.js` |
| Importação de campanhas, geração por IA | `js/hub/import.js` |
| Mercado secreto, painel do mestre | `js/ui/modals.js` |
| Interação com portas/chaves/baús no jogo | `js/ui/tabs.js` |
| Colisão de paredes durante movimento | `js/ui/tabs.js` |
| Teletransporte entre mapas via porta | `js/ui/tabs.js` |

---

## Ordem de carregamento no `index.html`

Os arquivos são carregados em ordem de dependência. Não altere essa ordem sem motivo:

```html
<script src="js/config.js"></script>       <!-- 1. Constantes e event bus -->
<script src="js/state.js"></script>         <!-- 2. Estado global -->
<script src="js/core/utils.js"></script>    <!-- 3. Utilitários base -->
<script src="js/core/supabase.js"></script> <!-- 4. API do banco -->
<script src="js/core/realtime.js"></script> <!-- 5. WebSocket -->
<script src="js/core/events.js"></script>   <!-- 6. Helpers de permissão -->
<script src="js/chat/chat.js"></script>     <!-- 7. Chat -->
<script src="js/combat/combat.js"></script> <!-- 8. Combate -->
<script src="js/combat/animations.js"></script>
<script src="js/maps/camera.js"></script>   <!-- 9. Mapa -->
<script src="js/maps/maps.js"></script>
<script src="js/auth/auth.js"></script>     <!-- 10. Autenticação -->
<script src="js/hub/hub.js"></script>       <!-- 11. Hub -->
<script src="js/systems/lore.js"></script>  <!-- 12. Sistemas -->
<script src="js/characters/characters.js"></script>
<script src="js/characters/skills.js"></script>
<script src="js/systems/npcs.js"></script>
<script src="js/hub/import.js"></script>
<script src="js/systems/arena.js"></script>
<script src="js/systems/inventory.js"></script>
<script src="js/systems/rest.js"></script>  <!-- ★ NOVO -->
<script src="js/systems/creative.js"></script>
<script src="js/systems/catalog.js"></script>
<script src="js/ui/modals.js"></script>     <!-- 13. UI -->
<script src="js/ui/tabs.js"></script>
<script src="js/init.js"></script>          <!-- 14. Inicialização -->
```

---

## Arquitetura geral

- **Tecnologia:** JavaScript vanilla (ES6+), sem framework, sem bundler
- **Backend:** Supabase (PostgreSQL + Auth + Realtime WebSocket + Storage)
- **Estado:** variáveis globais declaradas em `state.js`, acessíveis em todos os módulos
- **Comunicação entre módulos:** via `HUB_EVENTS` (pub/sub) e variáveis globais compartilhadas
- **Sem build step:** edite o arquivo, salve, recarregue o browser — pronto
