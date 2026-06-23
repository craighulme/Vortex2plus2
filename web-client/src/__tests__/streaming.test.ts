import { describe, expect, it } from "vitest";
import { AssetStreamService } from "../streaming/AssetStreamService";

describe("AssetStreamService", () => {
  it("accepts versioned safe manifests and tracks readiness", () => {
    const service = new AssetStreamService({ warn: () => undefined });
    const record = service.register({
      id: "mesh:test",
      kind: "mesh",
      apiVersion: 1,
      url: "https://assets.example.invalid/test.glb",
      slim: { impostorId: "mesh:test:impostor" }
    });

    expect(record.status).toBe("queued");
    expect(service.markReady("mesh:test")).toBe(true);
    expect(service.snapshot()).toEqual({ total: 1, queued: 0, ready: 1, rejected: 0 });
  });

  it("rejects script packages without integrity metadata", () => {
    const service = new AssetStreamService({ warn: () => undefined });
    const record = service.register({
      id: "script:test",
      kind: "script-package",
      apiVersion: 1,
      url: "https://assets.example.invalid/test.lua.wasm"
    });

    expect(record.status).toBe("rejected");
    expect(record.reason).toBe("script package requires integrity");
  });
});
