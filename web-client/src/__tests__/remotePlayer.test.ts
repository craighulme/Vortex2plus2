import { describe, expect, it } from "vitest";
import { RemotePlayerService } from "../avatar/RemotePlayerService";

const LEGACY_AVATAR = {
  shirt_id: 0,
  pant_id: 0,
  body_type: "male" as const,
  body_colors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
  face_id: 0
};

class FakeSprite {
  isSprite = true;
  userData = {};
  rotation = {};
  position = { y: 0 };
  scale = { set: (x: number, y: number, z: number) => { this.scaleValue = [x, y, z]; } };
  scaleValue: number[] = [];
  removed = false;
  material = {
    map: { dispose: () => { this.mapDisposed = true; } },
    dispose: () => { this.materialDisposed = true; }
  };
  mapDisposed = false;
  materialDisposed = false;
  parent = { remove: () => { this.removed = true; } };

  constructor(material?: unknown) {
    if (material) this.material = material as FakeSprite["material"];
  }

  clone(): FakeSprite {
    return new FakeSprite();
  }

  traverse(visitor: (object: FakeSprite) => void): void {
    visitor(this);
  }
}

class FakeGroup {
  userData = {};
  visible = true;
  rotation = { y: 0, set() {} };
  position = {
    x: 0,
    y: 0,
    z: 0,
    copied: null as unknown,
    lerped: null as unknown,
    clone() {
      return { x: this.x, y: this.y, z: this.z };
    },
    copy(value: unknown) {
      this.copied = value;
    },
    lerp(value: unknown, alpha: number) {
      this.lerped = { value, alpha };
    }
  };
  added: unknown[] = [];

  add(object: unknown): void {
    this.added.push(object);
  }

  clone(): FakeGroup {
    return new FakeGroup();
  }

  traverse(): void {}
}

function makeDocument() {
  return {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error("unexpected tag");
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          font: "",
          textAlign: "",
          strokeStyle: "",
          lineWidth: 0,
          fillStyle: "",
          strokeText() {},
          fillText() {}
        })
      };
    }
  } as unknown as Document;
}

describe("RemotePlayerService", () => {
  it("owns remote name label replacement and sprite cleanup", () => {
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => null,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });
    const group = new FakeGroup();
    const oldSprite = new FakeSprite();
    const remote = { meshes: { grp: group, bones: {}, rest: {}, nameSprite: oldSprite } };

    service.setNameLabel(remote, "monsterenergy");

    expect(oldSprite.removed).toBe(true);
    expect(oldSprite.mapDisposed).toBe(true);
    expect(oldSprite.materialDisposed).toBe(true);
    expect(group.added).toHaveLength(1);
    expect(remote.meshes.nameSprite).not.toBe(oldSprite);
  });

  it("creates nametag sprites without writing rectangular transparent cards into the scene", () => {
    const spriteMaterials: Array<Record<string, unknown>> = [];
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          options: Record<string, unknown>;
          constructor(options: Record<string, unknown>) {
            this.options = options;
            spriteMaterials.push(options);
          }
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => new FakeGroup() as never,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });

    service.makeRemote("player", 7, LEGACY_AVATAR);

    expect(spriteMaterials[0]).toMatchObject({
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
  });

  it("passes remote identity context when applying an avatar to a new remote", () => {
    const applied: unknown[] = [];
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => new FakeGroup() as never,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null,
        applyAvatarToMeshes: (_meshes, avatar) => applied.push(avatar)
      }
    });

    service.makeRemote("RecoveredName", 21264, LEGACY_AVATAR);

    expect(applied).toEqual([{
      ...LEGACY_AVATAR,
      id: 21264,
      playerId: 21264,
      username: "RecoveredName"
    }]);
  });

  it("updates remote interpolation and animation from one frame call", () => {
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => null,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });
    const group = new FakeGroup();
    const remote = {
      meshes: { grp: group, bones: {}, rest: {} },
      hasPosition: true,
      tPos: { x: 10, y: 2, z: -3 },
      tRy: Math.PI / 2,
      seen: 1000
    };
    let animated = false;

    const result = service.updateFrame({
      remotes: new Map([[7, remote]]),
      pendingAvatars: new Map(),
      dt: 1 / 60,
      now: 1100,
      shouldAnimate: true,
      normalizeAvatar: () => LEGACY_AVATAR,
      displayName: () => "player",
      noteState: () => {},
      animate: (id, item, dt) => {
        animated = id === 7 && item === remote && dt === 1 / 60;
      }
    });

    expect(result.updated).toBe(1);
    expect(group.position.lerped).toEqual({ value: remote.tPos, alpha: 0.2 });
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2 * 0.2);
    expect(animated).toBe(true);
  });

  it("throttles idle remote animation while preserving accumulated time", () => {
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => null,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });
    const group = new FakeGroup();
    const remote = {
      meshes: { grp: group, bones: {}, rest: {} },
      hasPosition: true,
      tPos: { x: 0, y: 2, z: 0 },
      tRy: 0,
      seen: 1000,
      anim: "idle"
    };
    const animatedDts: number[] = [];
    const base = {
      remotes: new Map([[7, remote]]),
      pendingAvatars: new Map(),
      shouldAnimate: true,
      normalizeAvatar: () => LEGACY_AVATAR,
      displayName: () => "player",
      noteState: () => {},
      animate: (_id: unknown, _item: unknown, dt: number) => animatedDts.push(dt)
    };

    service.updateFrame({ ...base, dt: 1 / 120, now: 1000 });
    service.updateFrame({ ...base, dt: 1 / 120, now: 1010 });
    service.updateFrame({ ...base, dt: 1 / 120, now: 1090 });

    expect(animatedDts).toHaveLength(2);
    expect(animatedDts[0]).toBeCloseTo(1 / 120);
    expect(animatedDts[1]).toBeCloseTo(1 / 60);
  });

  it("hides stale remotes without animating them", () => {
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove() {} },
        getCharacter: () => null,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });
    const group = new FakeGroup();
    const remote = {
      meshes: { grp: group, bones: {}, rest: {} },
      hasPosition: true,
      tPos: { x: 0, y: 0, z: 0 },
      tRy: 0,
      seen: 1000
    };
    const states: string[] = [];

    const result = service.updateFrame({
      remotes: new Map([[7, remote]]),
      pendingAvatars: new Map(),
      dt: 1 / 60,
      now: 7001,
      shouldAnimate: true,
      normalizeAvatar: () => LEGACY_AVATAR,
      displayName: () => "player",
      noteState: (_remote, status, reason) => states.push(`${status}:${reason}`),
      animate: () => {
        throw new Error("stale remote should not animate");
      }
    });

    expect(result.hidden).toBe(1);
    expect(group.visible).toBe(false);
    expect(states).toEqual(["hidden:stale-position"]);
  });

  it("rebuilds remote meshes while preserving position, yaw, and visibility", () => {
    const sceneRemoved: unknown[] = [];
    const service = new RemotePlayerService().configure({
      document: makeDocument(),
      THREE: {
        Skeleton: class {},
        CanvasTexture: class {},
        SpriteMaterial: class {
          constructor(readonly options: Record<string, unknown>) {}
          dispose() {}
        },
        Sprite: FakeSprite
      },
      vortex: {
        scene: { add() {}, remove(object: unknown) { sceneRemoved.push(object); } },
        getCharacter: () => new FakeGroup() as never,
        getAnimRest: () => ({}),
        getCharFootOffset: () => 2,
        getCharHeight: () => 5,
        buildShirtOverlay: () => null
      }
    });
    const oldGroup = new FakeGroup();
    oldGroup.visible = true;
    oldGroup.position.x = 4;
    oldGroup.position.y = 5;
    oldGroup.position.z = 6;
    oldGroup.rotation.y = 1.25;
    const remote = {
      username: "kagome",
      avatar: LEGACY_AVATAR,
      meshes: { grp: oldGroup, bones: {}, rest: {} }
    };

    const result = service.rebuildAll({
      remotes: new Map([[2, remote]]),
      normalizeAvatar: () => LEGACY_AVATAR
    });

    expect(result).toEqual({ rebuilt: 1, failed: 0 });
    expect(sceneRemoved).toEqual([oldGroup]);
    expect(remote.meshes?.grp).not.toBe(oldGroup);
    expect(remote.meshes?.grp.position.copied).toEqual({ x: 4, y: 5, z: 6 });
    expect(remote.meshes?.grp.rotation.y).toBe(1.25);
    expect(remote.meshes?.grp.visible).toBe(true);
  });
});
