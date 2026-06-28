export type ChatBubbleAnchor = {
  visible?: boolean;
  position?: {
    x: number;
    y: number;
    z: number;
    set?: (x: number, y: number, z: number) => void;
  };
};

type ChatBubbleServiceConfig = {
  THREE: ThreeLike;
  document: Document;
  window: Pick<Window, "setTimeout" | "clearTimeout">;
  scene: { add(object: unknown): void; remove(object: unknown): void };
};

type BubbleEntry = {
  text: string;
  timer: number;
};

type BubbleState = {
  messages: BubbleEntry[];
  sprite: BubbleSprite | null;
};

type BubbleSprite = {
  visible: boolean;
  material: {
    map?: { dispose?(): void } | null;
    needsUpdate?: boolean;
    dispose?(): void;
  };
  scale: { x?: number; y: number; z?: number; set(x: number, y: number, z: number): void };
  position: { set(x: number, y: number, z: number): void };
};

type ThreeLike = {
  CanvasTexture: new (canvas: HTMLCanvasElement) => { dispose?(): void };
  SpriteMaterial: new (options: Record<string, unknown>) => BubbleSprite["material"];
  Sprite: new (material: BubbleSprite["material"]) => BubbleSprite;
};

const BUBBLE_WORLD_W = 3.2;
const BUBBLE_CANVAS_W = 400;
const BUBBLE_SCALE = BUBBLE_WORLD_W / BUBBLE_CANVAS_W;
const BUBBLE_DURATION = 15000;
const MAX_BUBBLES = 3;
const B_PAD = 18;
const B_R = 12;
const B_FONT = "600 30px system-ui,sans-serif";
const B_LINE = 38;
const B_TRI = 12;
const B_GAP = 6;

export class ChatBubbleService {
  private config: ChatBubbleServiceConfig | null = null;
  private measureContext: CanvasRenderingContext2D | null = null;
  private readonly bubbles = new Map<number, BubbleState>();

  configure(config: ChatBubbleServiceConfig): this {
    this.config = config;
    if (!this.measureContext) {
      this.measureContext = config.document.createElement("canvas").getContext("2d");
      if (this.measureContext) this.measureContext.font = B_FONT;
    }
    return this;
  }

  show(id: unknown, text: unknown): void {
    const playerId = Number(id);
    if (!Number.isFinite(playerId)) return;
    const config = this.assertConfigured();
    let bubble = this.bubbles.get(playerId);
    if (!bubble) {
      bubble = { messages: [], sprite: null };
      this.bubbles.set(playerId, bubble);
    }
    if (bubble.messages.length >= MAX_BUBBLES) {
      const removed = bubble.messages.shift();
      if (removed) config.window.clearTimeout(removed.timer);
    }
    const entry: BubbleEntry = {
      text: String(text || ""),
      timer: 0
    };
    bubble.messages.push(entry);
    this.redraw(playerId);
    entry.timer = Number(config.window.setTimeout(() => {
      const current = this.bubbles.get(playerId);
      if (!current) return;
      const index = current.messages.indexOf(entry);
      if (index !== -1) current.messages.splice(index, 1);
      if (!current.messages.length) {
        if (current.sprite) current.sprite.visible = false;
        this.bubbles.delete(playerId);
      } else {
        this.redraw(playerId);
      }
    }, BUBBLE_DURATION));
  }

  updatePositions(options: {
    selfId: number | null;
    selfAnchor: ChatBubbleAnchor | null | undefined;
    selfBubbleBaseY: number;
    remoteBubbleBaseOffset: number;
    getRemoteAnchor(id: number): ChatBubbleAnchor | null | undefined;
  }): void {
    for (const [id, bubble] of this.bubbles) {
      if (!bubble.sprite || !bubble.messages.length) {
        if (bubble.sprite) bubble.sprite.visible = false;
        continue;
      }

      const anchor = id === options.selfId ? options.selfAnchor : options.getRemoteAnchor(id);
      if (!anchor?.visible && id !== options.selfId) {
        bubble.sprite.visible = false;
        continue;
      }
      if (!anchor?.position) {
        bubble.sprite.visible = false;
        continue;
      }
      const y = id === options.selfId ? options.selfBubbleBaseY : anchor.position.y + options.remoteBubbleBaseOffset;
      bubble.sprite.position.set(anchor.position.x, y + bubble.sprite.scale.y / 2, anchor.position.z);
      bubble.sprite.visible = true;
    }
  }

  clearPlayer(id: unknown): void {
    const playerId = Number(id);
    const bubble = this.bubbles.get(playerId);
    if (!bubble) return;
    const config = this.assertConfigured();
    for (const message of bubble.messages) config.window.clearTimeout(message.timer);
    if (bubble.sprite) this.disposeSprite(bubble.sprite);
    this.bubbles.delete(playerId);
  }

  hasBubbles(): boolean {
    return this.bubbles.size > 0;
  }

  snapshot(): { players: number; messages: number } {
    let messages = 0;
    for (const bubble of this.bubbles.values()) messages += bubble.messages.length;
    return { players: this.bubbles.size, messages };
  }

  private redraw(id: number): void {
    const bubble = this.bubbles.get(id);
    if (!bubble) return;
    if (!bubble.messages.length) {
      if (bubble.sprite) bubble.sprite.visible = false;
      return;
    }
    const config = this.assertConfigured();
    const measure = this.measureContext;
    if (!measure) return;

    const maxWrapW = BUBBLE_CANVAS_W - B_PAD * 2;
    const messageLines = bubble.messages.map((message) => wrapLines(measure, message.text, maxWrapW));
    const messageWidths = messageLines.map((lines) =>
      Math.ceil(Math.min(Math.max(...lines.map((line) => measure.measureText(line).width)) + B_PAD * 2, BUBBLE_CANVAS_W))
    );
    const canvasWidth = Math.max(...messageWidths);
    const messageHeights = messageLines.map((lines) => lines.length * B_LINE + B_PAD * 2);
    const totalHeight = messageHeights.reduce((sum, height) => sum + height, 0) + B_GAP * (bubble.messages.length - 1) + B_TRI;
    const canvas = config.document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = totalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = B_FONT;

    let y = 0;
    for (let i = 0; i < bubble.messages.length; i += 1) {
      const isBottom = i === bubble.messages.length - 1;
      const bodyHeight = messageHeights[i] ?? 0;
      const lines = messageLines[i] ?? [];
      const bubbleWidth = messageWidths[i] ?? BUBBLE_CANVAS_W;
      const bubbleX = (canvasWidth - bubbleWidth) / 2;

      context.fillStyle = "rgba(233, 233, 233, 0.95)";
      context.beginPath();
      context.moveTo(bubbleX + B_R, y);
      context.lineTo(bubbleX + bubbleWidth - B_R, y);
      context.arcTo(bubbleX + bubbleWidth, y, bubbleX + bubbleWidth, y + B_R, B_R);
      context.lineTo(bubbleX + bubbleWidth, y + bodyHeight - B_R);
      context.arcTo(bubbleX + bubbleWidth, y + bodyHeight, bubbleX + bubbleWidth - B_R, y + bodyHeight, B_R);
      if (isBottom) {
        context.lineTo(canvasWidth / 2 + B_TRI, y + bodyHeight);
        context.lineTo(canvasWidth / 2, y + bodyHeight + B_TRI);
        context.lineTo(canvasWidth / 2 - B_TRI, y + bodyHeight);
      }
      context.lineTo(bubbleX + B_R, y + bodyHeight);
      context.arcTo(bubbleX, y + bodyHeight, bubbleX, y + bodyHeight - B_R, B_R);
      context.lineTo(bubbleX, y + B_R);
      context.arcTo(bubbleX, y, bubbleX + B_R, y, B_R);
      context.closePath();
      context.fill();

      context.fillStyle = "#000000";
      context.textAlign = "center";
      context.textBaseline = "top";
      for (let j = 0; j < lines.length; j += 1) {
        context.fillText(lines[j] ?? "", canvasWidth / 2, y + B_PAD + j * B_LINE);
      }
      y += bodyHeight + (isBottom ? B_TRI : B_GAP);
    }

    if (!bubble.sprite) {
      bubble.sprite = new config.THREE.Sprite(new config.THREE.SpriteMaterial({ depthTest: true, transparent: true }));
      config.scene.add(bubble.sprite);
    }
    bubble.sprite.material.map?.dispose?.();
    bubble.sprite.material.map = new config.THREE.CanvasTexture(canvas);
    bubble.sprite.material.needsUpdate = true;
    bubble.sprite.scale.set(canvasWidth * BUBBLE_SCALE, totalHeight * BUBBLE_SCALE, 1);
    bubble.sprite.visible = true;
  }

  private disposeSprite(sprite: BubbleSprite): void {
    const config = this.assertConfigured();
    config.scene.remove(sprite);
    sprite.material.map?.dispose?.();
    sprite.material.dispose?.();
  }

  private assertConfigured(): ChatBubbleServiceConfig {
    if (!this.config) throw new Error("ChatBubbleService is not configured");
    return this.config;
  }
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
