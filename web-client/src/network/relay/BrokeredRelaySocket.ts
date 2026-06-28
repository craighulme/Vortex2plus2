export type BrokeredSocketEventHandler<TEvent = unknown> = ((event: TEvent) => void) | null;

export type BrokeredSocketWindow = {
  addEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  postMessage(message: unknown, targetOrigin: string): void;
  setTimeout(handler: () => void, timeout: number): unknown;
  crypto?: Pick<Crypto, "getRandomValues">;
  location: Pick<Location, "origin">;
};

export class BrokeredRelaySocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState: number;
  onopen: BrokeredSocketEventHandler<{ type: "open"; target: BrokeredRelaySocket }>;
  onmessage: BrokeredSocketEventHandler<{ type: "message"; data: unknown; target: BrokeredRelaySocket }>;
  onclose: BrokeredSocketEventHandler<{ type: "close"; code: number; reason: string; wasClean: boolean; target: BrokeredRelaySocket }>;
  onerror: BrokeredSocketEventHandler<{ type: "error"; message: string; target: BrokeredRelaySocket }>;
  _kicked: boolean;

  private readonly id: string;
  private readonly listener: (event: MessageEvent) => void;

  constructor(url: string, private readonly windowRef: BrokeredSocketWindow = window) {
    this.url = String(url || "");
    this.readyState = BrokeredRelaySocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._kicked = false;
    this.id = randomHexToken(windowRef, 8);
    this.listener = (event) => this.handleMessage(event);
    this.windowRef.addEventListener("message", this.listener);
    this.post("connect", { url: this.url });
  }

  send(data: unknown): void {
    if (this.readyState !== BrokeredRelaySocket.OPEN) throw new Error("brokered websocket is not open");
    this.post("send", { data });
  }

  close(): void {
    if (this.readyState === BrokeredRelaySocket.CLOSING || this.readyState === BrokeredRelaySocket.CLOSED) return;
    this.readyState = BrokeredRelaySocket.CLOSING;
    this.post("close");
    this.windowRef.setTimeout(() => {
      if (this.readyState !== BrokeredRelaySocket.CLOSING) return;
      this.readyState = BrokeredRelaySocket.CLOSED;
      this.windowRef.removeEventListener("message", this.listener);
      this.onclose?.({ type: "close", code: 1000, reason: "", wasClean: true, target: this });
    }, 1500);
  }

  private handleMessage(event: MessageEvent): void {
    const msg = event.data;
    if (!msg?.vwebBroker || msg.direction !== "extension" || msg.socketId !== this.id) return;
    if (msg.op === "open") {
      this.readyState = BrokeredRelaySocket.OPEN;
      this.onopen?.({ type: "open", target: this });
    } else if (msg.op === "message") {
      this.onmessage?.({ type: "message", data: msg.data, target: this });
    } else if (msg.op === "error") {
      this.onerror?.({ type: "error", message: msg.message || "", target: this });
    } else if (msg.op === "close") {
      this.readyState = BrokeredRelaySocket.CLOSED;
      this.windowRef.removeEventListener("message", this.listener);
      this.onclose?.({
        type: "close",
        code: msg.code || 1000,
        reason: msg.reason || "",
        wasClean: Boolean(msg.wasClean),
        target: this
      });
    }
  }

  private post(op: string, payload: Record<string, unknown> = {}): void {
    this.windowRef.postMessage({
      vwebBroker: true,
      direction: "page",
      socketId: this.id,
      op,
      ...payload
    }, this.windowRef.location.origin);
  }
}

function randomHexToken(windowRef: BrokeredSocketWindow, bytes: number): string {
  const values = new Uint8Array(bytes);
  if (windowRef.crypto?.getRandomValues) {
    windowRef.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i += 1) values[i] = Math.floor(Math.random() * 256);
  }
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}
