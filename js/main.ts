// main.ts
// RPG Hub — Ponto de entrada do bundle (Vite).
// A ordem dos imports reproduz a ordem dos antigos <script> tags do index.html:
// os módulos dependem uns dos outros via globals expostos em window
// (rodapés "[migração-esm] accessors globais" em cada arquivo).

// Bibliotecas de terceiros (antes: CDN)
import './core/vendor';
import './core/pixi-lazy';

// Core
import './config';
import './state';
import './core/utils';
import './core/supabase';
import './core/realtime';
import './core/rtnet';
import './core/events';

// Chat + áudio
import './chat/chat';
import './systems/audio';

// Registry central de tipos de efeito de skill (consumido por combate/aventura)
import './systems/effect-registry.js';

// Combate
import './combat/combat.js';
import './combat/animations.js';
import './combat/battle-system.js';
import './combat/reactions.js';

// Mapas
import './maps/camera';
import './maps/fase-renderer.js';
import './maps/fase-generator.js';
import './maps/fase-tileset.js';
import './maps/maps.js';
import './maps/tactical.js';
import './maps/background.js';

// Auth, hub e sistemas
import './auth/auth';
import './hub/hub.js';
import './systems/lore.js';
import './characters/characters.js';
import './characters/fichas.js';
import './characters/skills.js';
import './characters/invocacoes.js';
import './characters/appearance.js';
import './systems/npcs.js';
import './hub/import.js';
import './systems/arena.js';
import './systems/inventory.js';
import './systems/aventura.js';
import './aventura/renderer-pixi';
import './systems/avt-walk-presets.js';
import './systems/avt-menu.js';
import './systems/avt-inventario.js';
import './systems/avt-perf.js';
import './systems/catalog-packages.js';
import './systems/catalog.js';
import './systems/attribute-mapping.js';
import './systems/rest.js';
import './ui/tutorial';
import './systems/creative.js';
import './systems/pixi-studio-presets.js';
import './systems/pixi-studio.js';
import './systems/pixi-studio-avt.js';
import './systems/market.js';
import './ui/modals.js';
import './combat/anim-gsap-spine.js';
import './characters/anim-renderer.js';
import './characters/token';
import './characters/anim-generator.js';
import './init';

// Blocos que eram <script> inline no index.html (mesma ordem relativa)
import './ui/inline-patch-import';
import './ui/inline-tema';
import './ui/inline-mapa-ataque';
import './ui/inline-combate-log';
import './ui/inline-error-handler';
