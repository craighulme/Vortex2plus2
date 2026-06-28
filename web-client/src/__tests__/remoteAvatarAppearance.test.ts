import { describe, expect, it, vi } from "vitest";
import { RemoteAvatarAppearanceService } from "../avatar/RemoteAvatarAppearanceService";

function makeService(isWebGpuRuntime: boolean) {
  const calls: string[] = [];
  const service = new RemoteAvatarAppearanceService().configure({
    isWebGpuRuntime,
    avatarService: {
      normalizeLegacy: (avatar: Record<string, unknown>) => ({
        shirt_id: Number(avatar.shirt_id || 0),
        pant_id: Number(avatar.pant_id || 0),
        body_type: "male",
        body_colors: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
        face_id: Number(avatar.face_id || 0)
      })
    } as any,
    avatarAssets: {
      cachedClothingImageUrl: () => null,
      prefetchClothingImage: (id: number) => Promise.resolve(id > 0 ? `asset:${id}` : null),
      clothingImageUrl: (id: number) => id > 0 ? `fallback:${id}` : null
    } as any,
    avatarMaterials: {
      prepareModernAvatarMaterials: vi.fn(() => calls.push("prepare")),
      buildShirtOverlay: vi.fn(() => "shirtMesh"),
      buildPantsOverlay: vi.fn(() => "pantsMesh"),
      buildFaceOverlay: vi.fn(() => "faceMesh"),
      applyBodyColors: vi.fn(() => calls.push("colors")),
      applyShirtToMesh: vi.fn((mesh: unknown, url: unknown) => calls.push(`${mesh}:${url}`)),
      applyModernAvatarTextures: vi.fn((_target: unknown, urls: unknown) => calls.push(`textures:${JSON.stringify(urls)}`))
    } as any
  });
  return { service, calls };
}

function makeFallbackService() {
  const calls: string[] = [];
  const service = new RemoteAvatarAppearanceService().configure({
    isWebGpuRuntime: true,
    avatarService: {
      normalizeLegacy: (avatar: Record<string, unknown>) => ({
        shirt_id: Number(avatar.shirt_id || 0),
        pant_id: 0,
        body_type: "male",
        body_colors: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
        face_id: 0
      })
    } as any,
    avatarAssets: {
      cachedClothingImageUrl: () => null,
      prefetchClothingImage: () => Promise.resolve(null),
      clothingImageUrl: (id: number) => id > 0 ? `fallback:${id}` : null
    } as any,
    avatarMaterials: {
      applyBodyColors: vi.fn(),
      applyShirtToMesh: vi.fn((mesh: unknown, url: unknown) => calls.push(`${mesh}:${url}`))
    } as any
  });
  return { service, calls };
}

describe("RemoteAvatarAppearanceService", () => {
  it("builds overlay meshes for WebGPU remotes", () => {
    const { service } = makeService(true);

    expect(service.buildShirtOverlay({})).toBe("shirtMesh");
    expect(service.buildPantsOverlay({})).toBe("pantsMesh");
    expect(service.buildFaceOverlay({})).toBe("faceMesh");
  });

  it("prepares legacy materials instead of overlays outside WebGPU", () => {
    const { service, calls } = makeService(false);

    expect(service.buildShirtOverlay({})).toBeNull();

    expect(calls).toEqual(["prepare"]);
  });

  it("applies remote avatar textures immediately without waiting for cold batch lookups", async () => {
    const { service, calls } = makeService(true);

    await service.applyAvatarToMeshes({
      grp: {} as any,
      bones: {},
      rest: {},
      shirtMesh: "shirt",
      pantsMesh: "pants",
      faceMesh: "face"
    }, { shirt_id: 1, pant_id: 2, face_id: 3 });

    expect(calls).toEqual(["colors", "shirt:fallback:1", "pants:fallback:2", "face:fallback:3"]);
  });

  it("uses warm cached clothing image URLs when available", async () => {
    const { service, calls } = makeService(true);
    (service as any).options.avatarAssets.cachedClothingImageUrl = (id: number) => id > 0 ? `cached:${id}` : null;

    await service.applyAvatarToMeshes({
      grp: {} as any,
      bones: {},
      rest: {},
      shirtMesh: "shirt",
      pantsMesh: "pants",
      faceMesh: "face"
    }, { shirt_id: 1, pant_id: 2, face_id: 3 });

    expect(calls).toEqual(["colors", "shirt:cached:1", "pants:cached:2", "face:cached:3"]);
  });

  it("falls back to direct clothing image routes when batched lookup misses", async () => {
    const { service, calls } = makeFallbackService();

    await service.applyAvatarToMeshes({
      grp: {} as any,
      bones: {},
      rest: {},
      shirtMesh: "shirt",
      pantsMesh: "pants",
      faceMesh: "face"
    }, { shirt_id: 9 });

    expect(calls).toContain("shirt:fallback:9");
  });

  it("passes player and clothing context into texture diagnostics", async () => {
    const { service } = makeService(true);
    const applyShirtToMesh = (service as any).options.avatarMaterials.applyShirtToMesh;

    await service.applyAvatarToMeshes({
      grp: {} as any,
      bones: {},
      rest: {},
      shirtMesh: "shirt",
      pantsMesh: "pants",
      faceMesh: "face"
    }, { id: 18154, username: "monsterenergy", shirt_id: 0, pant_id: 25, face_id: 56 });

    expect(applyShirtToMesh).toHaveBeenNthCalledWith(1, "shirt", null, expect.objectContaining({
      playerId: 18154,
      username: "monsterenergy",
      slot: "shirt",
      clothingId: 0
    }));
    expect(applyShirtToMesh).toHaveBeenNthCalledWith(2, "pants", "fallback:25", expect.objectContaining({
      slot: "pants",
      clothingId: 25
    }));
  });
});
