// MockWebSocket para os testes do realtime. realtime.ts lê WebSocket.OPEN
// como estático da classe global, então as constantes precisam existir.
// Os gatilhos _open/_message/_serverClose simulam o lado servidor.
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) throw new Error('socket não está aberto');
    this.sent.push(data);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // ── gatilhos de teste ──
  _open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  _message(obj: any) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }

  _serverClose() {
    this.close();
  }

  // ── helpers de inspeção ──
  frames(): any[] {
    return this.sent.map(s => JSON.parse(s));
  }

  framesDe(event: string): any[] {
    return this.frames().filter(f => f.event === event);
  }

  static last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}
