import { describe, expect, it } from "vitest";
import { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";

describe("RuntimeAssetResolverService", () => {
  it("prefers manifest resolution before legacy fallback keys", () => {
    const resolver = new RuntimeAssetResolverService().configure({
      assets: {
        manifest: { raw: { legacy: "/legacy.png" } },
        resolve: (path) => path === "textures.stud" ? "/modern.png" : null
      }
    });

    expect(resolver.resolve("textures.stud", "legacy")).toBe("/modern.png");
    expect(resolver.resolve("missing.path", "legacy")).toBe("/legacy.png");
  });

  it("tolerates missing or invalid legacy fallback JSON", () => {
    const resolver = new RuntimeAssetResolverService().configure({
      assets: {},
      fallbackRaw: "{nope"
    });

    expect(resolver.resolve("missing.path", "legacy")).toBeNull();
  });
});
