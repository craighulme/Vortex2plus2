import { describe, expect, it } from "vitest";
import { WorldPartService } from "../world/WorldPartService";

class FakeMesh {
  userData: Record<string, unknown> = {};
  position = { set: (x: number, y: number, z: number) => { this.pos = [x, y, z]; } };
  rotation = { order: "YXZ", set: (x: number, y: number, z: number) => { this.rot = [x, y, z]; } };
  castShadow = false;
  receiveShadow = false;
  matrixAutoUpdate = true;
  frustumCulled = false;
  stud_id?: number;
  pos: number[] = [];
  rot: number[] = [];

  constructor(readonly geometry: unknown, readonly material: unknown) {}
  rotateOnAxis(_axis: unknown, radians: number) {
    this.rotated = radians;
  }
  rotated = 0;
  updateMatrix() {}
  updateMatrixWorld() {}
}

class FakeVector3 {
  constructor(readonly x: number, readonly y: number, readonly z: number) {}
}

function makeService() {
  const scene = {
    added: [] as unknown[],
    removed: [] as unknown[],
    add(object: unknown) { this.added.push(object); },
    remove(object: unknown) { this.removed.push(object); }
  };
  const colliderService = {
    colliders: [] as unknown[],
    createCollider: (...args: unknown[]) => ({ args }),
    add(collider: unknown) { this.colliders.push(collider); },
    remove(collider: unknown) {
      this.colliders = this.colliders.filter((item) => item !== collider);
    },
    rebuildFromObject: (object: unknown) => ({ rebuiltFrom: object }),
    removeMatchingArray<T>(items: T[], value: T) {
      const index = items.indexOf(value);
      if (index !== -1) items.splice(index, 1);
    }
  };
  const service = new WorldPartService().configure({
    THREE: { Mesh: FakeMesh, Vector3: FakeVector3 },
    scene,
    geometry: { getCachedGeometry: () => "geometry" } as any,
    materials: { getCachedMaterials: () => "material" } as any,
    colliders: colliderService as any,
    shadowsActive: () => true
  });
  return { service, scene, colliderService };
}

describe("WorldPartService", () => {
  it("adds dynamic studs to the scene, object list, and collider service", () => {
    const { service, scene, colliderService } = makeService();

    const [mesh, id] = service.addStud(4, 2, 4, 0x336699, 10, 1, 12, 0, 0, 0, "Block", 0, false, true, "YXZ", "Truss");

    expect(id).toBe(0);
    expect(mesh.stud_id).toBe(0);
    expect(mesh.userData).toMatchObject({ vwebRuntimeKind: "world-part", vwebPartShape: "Block", vwebPartType: "Truss", vwebPartColor: 0x336699 });
    expect(scene.added).toEqual([mesh]);
    expect(service.objects).toEqual([mesh]);
    expect(colliderService.colliders).toHaveLength(1);
    expect((colliderService.colliders[0] as { args: unknown[] }).args.at(-1)).toBe("Truss");
  });

  it("keeps static source parts out of the scene but tracks their collider", () => {
    const { service, scene, colliderService } = makeService();

    const [mesh, id] = service.addStud(4, 1, 4, 0xffffff, 0, 0, 0, 0, 0, 0, "Block", 0, true, true);

    expect(mesh.userData.vwebRuntimeKind).toBe("world-source-part");
    expect(id).toBe(0);
    expect(scene.added).toEqual([]);
    expect(service.objects).toEqual([]);
    expect(colliderService.colliders).toHaveLength(1);
  });

  it("removes and rebuilds dynamic colliders", () => {
    const { service, scene, colliderService } = makeService();
    const [mesh, id] = service.addStud(4, 1, 4, 0xffffff, 0, 0, 0);

    expect(service.rebuildStudCollider(id, true)).toBe(true);
    expect(colliderService.colliders).toHaveLength(1);
    expect(service.objects).toEqual([mesh]);

    service.removeStud(id);

    expect(scene.removed).toEqual([mesh]);
    expect(service.objects).toEqual([]);
    expect(colliderService.colliders).toHaveLength(0);
  });
});
