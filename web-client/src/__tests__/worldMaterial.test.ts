import { describe, expect, it } from "vitest";
import { WorldMaterialService } from "../world/WorldMaterialService";

class FakeMaterial {
  userData: Record<string, unknown> = {};
  castShadow = true;
  uuid = `mat-${Math.random()}`;

  constructor(readonly options: Record<string, unknown>) {}
}

describe("WorldMaterialService", () => {
  it("caches stud materials by color/transparency and refreshes texture bindings", () => {
    const refreshed: unknown[] = [];
    const service = new WorldMaterialService().configure({
      THREE: { MeshStandardMaterial: FakeMaterial },
      studsPerTile: 4,
      applyStudTextures: (material) => refreshed.push(material)
    });

    const first = service.getCachedMaterials(4, 1, 4, 0xff0000, "Block", 0);
    const second = service.getCachedMaterials(8, 2, 8, 0xff0000, "Block", 0);

    expect(first).toBe(second);
    expect(Array.isArray(first)).toBe(true);
    const materials = first as FakeMaterial[];
    expect(materials).toHaveLength(6);
    expect(materials[2]).toMatchObject({
      options: {
        color: 0xff0000,
        transparent: false,
        opacity: 1,
        roughness: 0.46,
        metalness: 0
      },
      userData: {
        vwebStudMaterial: { rx: 0.25, ry: 0.25 },
        vwebFaceStyle: "stud-top"
      }
    });
    expect(materials.filter((material) => material.userData.vwebStudMaterial)).toHaveLength(1);
    expect(materials[0]?.userData.vwebFaceStyle).toBe("smooth");

    service.refreshStudTextures();

    expect(refreshed).toHaveLength(2);
    expect(service.snapshot()).toMatchObject({ materials: 1 });
  });

  it("uses ball radius for stud texture scale and disables high-transparency shadows", () => {
    const service = new WorldMaterialService().configure({
      THREE: { MeshStandardMaterial: FakeMaterial },
      studsPerTile: 4,
      applyStudTextures: () => {}
    });

    const material = service.getCachedMaterials(8, 8, 8, 0x00ff00, "Ball", 0.8);

    expect(material).toMatchObject({
      castShadow: false,
      options: {
        color: 0x00ff00,
        transparent: true,
        opacity: 0.19999999999999996
      }
    });
    expect((material as FakeMaterial).userData.vwebStudMaterial).toBeUndefined();
  });
});
