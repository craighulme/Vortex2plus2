export type StreamAssetKind =
  | "model"
  | "mesh"
  | "texture"
  | "material"
  | "audio"
  | "avatar-item"
  | "script-package"
  | "map-chunk";

export type StreamAssetManifest = {
  id: string;
  kind: StreamAssetKind;
  apiVersion: number;
  url: string;
  integrity?: string;
  byteLength?: number;
  slim?: {
    sourceId?: string;
    compositeId?: string;
    impostorId?: string;
    distances?: {
      source?: number;
      composite?: number;
      impostor?: number;
      cull?: number;
    };
  };
  capabilities?: string[];
  tags?: string[];
};

export type StreamAssetRecord = StreamAssetManifest & {
  status: "queued" | "ready" | "rejected";
  reason?: string;
  registeredAt: number;
};

type DiagnosticsLike = {
  warn(event: string, payload?: Record<string, unknown>): void;
};

const SUPPORTED_API_VERSION = 1;
const ALLOWED_KINDS = new Set<StreamAssetKind>([
  "model",
  "mesh",
  "texture",
  "material",
  "audio",
  "avatar-item",
  "script-package",
  "map-chunk"
]);

export class AssetStreamService {
  readonly supportedApiVersion = SUPPORTED_API_VERSION;
  private readonly records = new Map<string, StreamAssetRecord>();

  constructor(private readonly diagnostics: DiagnosticsLike) {}

  register(manifest: StreamAssetManifest): StreamAssetRecord {
    const rejection = validateManifest(manifest);
    const record: StreamAssetRecord = rejection ? {
      ...manifest,
      status: "rejected",
      reason: rejection,
      registeredAt: Date.now()
    } : {
      ...manifest,
      status: "queued",
      registeredAt: Date.now()
    };
    this.records.set(manifest.id, record);
    if (rejection) this.diagnostics.warn("stream.asset.rejected", { id: manifest.id, reason: rejection });
    return record;
  }

  markReady(id: string): boolean {
    const record = this.records.get(id);
    if (!record || record.status === "rejected") return false;
    this.records.set(id, { ...record, status: "ready" });
    return true;
  }

  get(id: string): StreamAssetRecord | null {
    return this.records.get(id) ?? null;
  }

  byKind(kind: StreamAssetKind): StreamAssetRecord[] {
    return [...this.records.values()].filter((record) => record.kind === kind);
  }

  snapshot(): { total: number; queued: number; ready: number; rejected: number } {
    const result = { total: this.records.size, queued: 0, ready: 0, rejected: 0 };
    for (const record of this.records.values()) result[record.status] += 1;
    return result;
  }
}

function validateManifest(manifest: StreamAssetManifest): string | undefined {
  if (!manifest.id.trim()) return "missing id";
  if (!ALLOWED_KINDS.has(manifest.kind)) return "unsupported kind";
  if (manifest.apiVersion !== SUPPORTED_API_VERSION) return "unsupported api version";
  if (!isSafeAssetUrl(manifest.url)) return "unsafe url";
  if (manifest.kind === "script-package" && !manifest.integrity) return "script package requires integrity";
  return undefined;
}

function isSafeAssetUrl(url: string): boolean {
  try {
    const base = typeof location === "undefined" ? "https://playvortex.io/" : location.href;
    const parsed = new URL(url, base);
    return parsed.protocol === "https:" || parsed.protocol === "chrome-extension:" || parsed.protocol === "moz-extension:";
  } catch {
    return false;
  }
}
