import { describe, expect, it } from "vitest";
import { ChatBubbleService } from "../ui/ChatBubbleService";

class FakeSprite {
  visible = false;
  material = {
    map: null as { dispose?: () => void } | null,
    needsUpdate: false,
    dispose: () => {
      this.materialDisposed = true;
    }
  };
  materialDisposed = false;
  scale = {
    y: 0,
    set: (x: number, y: number, z: number) => {
      this.scaleValue = [x, y, z];
      this.scale.y = y;
    }
  };
  scaleValue: number[] = [];
  position = {
    value: [0, 0, 0],
    set: (x: number, y: number, z: number) => {
      this.position.value = [x, y, z];
    }
  };

  constructor(readonly materialInput: unknown) {
    this.material = materialInput as FakeSprite["material"];
  }
}

function makeDocument() {
  return {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`unexpected tag ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          font: "",
          fillStyle: "",
          lineWidth: 0,
          strokeStyle: "",
          textAlign: "",
          textBaseline: "",
          measureText: (value: string) => ({ width: value.length * 10 }),
          beginPath() {},
          moveTo() {},
          lineTo() {},
          arcTo() {},
          closePath() {},
          fill() {},
          fillText() {}
        })
      };
    }
  } as unknown as Document;
}

describe("ChatBubbleService", () => {
  it("owns bubble rendering, positioning, and cleanup", () => {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    let nextTimer = 0;
    const service = new ChatBubbleService().configure({
      document: makeDocument(),
      window: {
        setTimeout: () => ++nextTimer,
        clearTimeout: () => {}
      } as unknown as Window,
      scene: {
        add: (object) => added.push(object),
        remove: (object) => removed.push(object)
      },
      THREE: {
        CanvasTexture: class {
          dispose() {}
        },
        SpriteMaterial: class {
          map: { dispose?: () => void } | null = null;
          needsUpdate = false;
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      }
    });

    service.show(7, "hello world");
    service.show(7, "second");
    service.show(7, "third");
    service.show(7, "fourth");

    expect(service.snapshot()).toEqual({ players: 1, messages: 3 });
    expect(added).toHaveLength(1);
    const sprite = added[0] as FakeSprite;

    service.updatePositions({
      selfId: null,
      selfAnchor: null,
      selfBubbleBaseY: 0,
      remoteBubbleBaseOffset: 5,
      getRemoteAnchor: () => ({ visible: true, position: { x: 10, y: 20, z: 30 } })
    });

    expect(sprite.visible).toBe(true);
    expect(sprite.position.value[0]).toBe(10);
    expect(sprite.position.value[1]).toBeGreaterThan(20);
    expect(sprite.position.value[2]).toBe(30);

    service.clearPlayer(7);
    expect(service.hasBubbles()).toBe(false);
    expect(removed).toContain(sprite);
  });
});
