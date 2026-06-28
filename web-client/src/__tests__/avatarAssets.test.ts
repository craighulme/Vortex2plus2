import { describe, expect, it, vi } from "vitest";
import { AvatarAssetService } from "../avatar/AvatarAssetService";

function createWindow(fetchImpl: Window["fetch"]) {
  return {
    fetch: fetchImpl,
    setTimeout(callback: () => void) {
      queueMicrotask(callback);
      return 1;
    }
  } as unknown as Window;
}

describe("AvatarAssetService", () => {
  it("builds direct clothing image urls", () => {
    const service = new AvatarAssetService(createWindow(vi.fn() as unknown as Window["fetch"]));

    expect(service.clothingImageUrl(12)).toBe("/api/clothing/image/12");
    expect(service.clothingImageUrl(0)).toBeNull();
  });

  it("extracts avatar image ids from legacy and camelCase fields", () => {
    const service = new AvatarAssetService(createWindow(vi.fn() as unknown as Window["fetch"]));

    expect(service.avatarImageIds({ shirt_id: 1, pantId: 2, face_id: 0 })).toEqual([1, 2]);
  });

  it("batches prefetch lookups and caches the result", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ images: { 10: "/shirt.png" } }), { status: 200 }));
    const service = new AvatarAssetService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.prefetchClothingImage(10)).resolves.toBe("/shirt.png");
    await expect(service.prefetchClothingImage(10)).resolves.toBe("/shirt.png");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(service.snapshot()).toMatchObject({ cacheSize: 1, inflight: 0, queued: 0, retrying: 0 });
    expect(service.snapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "batch-hit", id: 10, url: "/shirt.png" })
    ]));
  });

  it("retries transient clothing lookup failures before resolving", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 522 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: { 11: "/retry-shirt.png" } }), { status: 200 }));
    const service = new AvatarAssetService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.prefetchClothingImage(11)).resolves.toBe("/retry-shirt.png");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(service.snapshot()).toMatchObject({ cacheSize: 1, inflight: 0, queued: 0, retrying: 0 });
    expect(service.snapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "batch-failed", status: 522 }),
      expect.objectContaining({ type: "batch-hit", id: 11, url: "/retry-shirt.png" })
    ]));
  });

  it("records lookup misses and direct URL fallbacks", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ images: {} }), { status: 200 }));
    const service = new AvatarAssetService(createWindow(fetchImpl as unknown as Window["fetch"]));

    await expect(service.prefetchClothingImage(12)).resolves.toBeNull();
    expect(service.clothingImageUrl(12)).toBe("/api/clothing/image/12");

    expect(service.snapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "batch-miss", id: 12, url: null }),
      expect.objectContaining({ type: "direct-url", id: 12, url: "/api/clothing/image/12" })
    ]));
  });
});
