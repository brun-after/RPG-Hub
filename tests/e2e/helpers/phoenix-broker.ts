// Broker Phoenix mínimo para o teste hermético de 2 clientes.
//
// O app fala com o Supabase Realtime via um cliente Phoenix hand-rolled
// (js/core/realtime.ts): frames JSON {topic, event, payload, ref}. Para o
// RTNet, a sinalização inteira são eventos 'broadcast'. Então o "servidor"
// necessário é só isto: responder phx_join/heartbeat com phx_reply ok e
// retransmitir broadcasts para todos os sockets exceto o emissor (o join usa
// broadcast:{self:false} — ecoar para o emissor causaria loops).
//
// Instalar com: await context.routeWebSocket(/realtime\/v1\/websocket/, broker.handler)
// Sem ws.connectToServer() o Playwright opera em modo mock — nós somos o servidor.
import type { WebSocketRoute } from '@playwright/test';

export interface BrokerPhoenix {
  handler: (ws: WebSocketRoute) => void;
  sockets: () => number;
}

export function criarBrokerPhoenix(): BrokerPhoenix {
  const socks = new Set<WebSocketRoute>();

  return {
    sockets: () => socks.size,
    handler: (ws: WebSocketRoute) => {
      socks.add(ws);
      ws.onClose(() => socks.delete(ws));
      ws.onMessage(raw => {
        let msg: any;
        try { msg = JSON.parse(String(raw)); } catch { return; }

        if (msg.event === 'phx_join' || msg.event === 'heartbeat') {
          ws.send(JSON.stringify({
            topic: msg.topic,
            event: 'phx_reply',
            payload: { status: 'ok', response: {} },
            ref: msg.ref,
          }));
          return;
        }

        if (msg.event === 'broadcast') {
          const frame = JSON.stringify({
            topic: msg.topic,
            event: 'broadcast',
            payload: msg.payload,
            ref: null,
          });
          for (const peer of socks) {
            if (peer !== ws) {
              try { peer.send(frame); } catch { /* socket fechando */ }
            }
          }
        }
        // phx_leave e demais frames: sem resposta necessária
      });
    },
  };
}
