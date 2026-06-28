export type LegacyAvatarLike = {
  shirt_id?: unknown;
  shirtId?: unknown;
  pant_id?: unknown;
  pantId?: unknown;
  face_id?: unknown;
  faceId?: unknown;
};

type CacheEntry = {
  url: string | null;
  expiresAt: number;
};

type InflightEntry = {
  promise: Promise<string | null>;
  resolve: (url: string | null) => void;
};

type ClothingDiagnostic = {
  at: number;
  type: "batch-failed" | "batch-miss" | "batch-hit" | "direct-url";
  ids?: number[];
  id?: number;
  url?: string | null;
  status?: number;
  reason?: string;
};

const CLOTHING_IMAGE_TTL_MS = 5 * 60 * 1000;
const CLOTHING_IMAGE_RETRY_MS = 30 * 1000;
const CLOTHING_IMAGE_MAX_ATTEMPTS = 3;
const CLOTHING_IMAGE_RETRY_DELAYS_MS = [900, 2500];
const CLOTHING_DIAGNOSTIC_LIMIT = 80;

export class AvatarAssetService {
  private readonly clothingImageCache = new Map<number, CacheEntry>();
  private readonly clothingImageInflight = new Map<number, InflightEntry>();
  private readonly clothingImageQueue = new Set<number>();
  private readonly clothingImageAttempts = new Map<number, number>();
  private readonly diagnostics: ClothingDiagnostic[] = [];
  private clothingImageTimer: number | null = null;

  constructor(private readonly windowRef: Window) {}

  clothingImageUrl(id: unknown): string | null {
    const safeId = Number(id || 0);
    const url = safeId > 0 ? `/api/clothing/image/${encodeURIComponent(safeId)}` : null;
    if (safeId > 0) this.recordDiagnostic({ type: "direct-url", id: safeId, url });
    return url;
  }

  async prefetchClothingImage(id: unknown): Promise<string | null> {
    const safeId = Number(id || 0);
    if (!safeId) return null;
    const cached = this.getClothingImageCache(safeId);
    if (cached.hit) return cached.url;
    if (this.clothingImageInflight.has(safeId)) return this.clothingImageInflight.get(safeId)?.promise ?? null;

    let resolve!: (url: string | null) => void;
    const promise = new Promise<string | null>((done) => {
      resolve = done;
    });
    this.clothingImageInflight.set(safeId, { promise, resolve });
    this.clothingImageQueue.add(safeId);

    if (this.clothingImageTimer === null) {
      this.clothingImageTimer = this.windowRef.setTimeout(() => {
        void this.flushClothingImageQueue();
      }, 0);
    }

    return promise;
  }

  cachedClothingImageUrl(id: unknown): string | null {
    const safeId = Number(id || 0);
    if (!safeId) return null;
    const cached = this.getClothingImageCache(safeId);
    return cached.hit ? cached.url : null;
  }

  prefetchAvatarImages(avatars: LegacyAvatarLike | LegacyAvatarLike[]): void {
    const unique = new Set<number>();
    for (const avatar of Array.isArray(avatars) ? avatars : [avatars]) {
      for (const id of this.avatarImageIds(avatar)) unique.add(id);
    }
    for (const id of unique) void this.prefetchClothingImage(id).catch(() => null);
  }

  avatarImageIds(avatar: LegacyAvatarLike = {}): number[] {
    return [
      Number(avatar.shirt_id ?? avatar.shirtId ?? 0),
      Number(avatar.pant_id ?? avatar.pantId ?? 0),
      Number(avatar.face_id ?? avatar.faceId ?? 0)
    ].filter((id) => Number.isFinite(id) && id > 0);
  }

  snapshot(): { cacheSize: number; inflight: number; queued: number; retrying: number; diagnostics: ClothingDiagnostic[] } {
    return {
      cacheSize: this.clothingImageCache.size,
      inflight: this.clothingImageInflight.size,
      queued: this.clothingImageQueue.size,
      retrying: this.clothingImageAttempts.size,
      diagnostics: this.diagnostics.slice(-20)
    };
  }

  clearDiagnostics(): void {
    this.diagnostics.length = 0;
  }

  private getClothingImageCache(id: number): { hit: boolean; url: string | null } {
    const entry = this.clothingImageCache.get(id);
    if (!entry) return { hit: false, url: null };
    if (entry.expiresAt <= Date.now()) {
      this.clothingImageCache.delete(id);
      return { hit: false, url: null };
    }
    return { hit: true, url: entry.url };
  }

  private setClothingImageCache(id: number, url: string | null, ttlMs: number): void {
    this.clothingImageCache.set(id, {
      url: url || null,
      expiresAt: Date.now() + ttlMs
    });
  }

  private scheduleClothingImageQueue(ids: number[], delayMs: number): void {
    for (const id of ids) this.clothingImageQueue.add(id);
    if (this.clothingImageTimer !== null) return;
    this.clothingImageTimer = this.windowRef.setTimeout(() => {
      void this.flushClothingImageQueue();
    }, delayMs);
  }

  private readClothingImageUrl(data: unknown, id: number): string | null {
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;
    const direct = record[String(id)] ?? record[id];
    if (typeof direct === "string") return direct;
    const images = isRecord(record.images) ? record.images : {};
    const urls = isRecord(record.urls) ? record.urls : {};
    const nested = images[String(id)] ?? images[id] ?? urls[String(id)] ?? urls[id];
    if (typeof nested === "string") return nested;
    const list = Array.isArray(data) ? data : Array.isArray(record.images) ? record.images : [];
    const match = list.find((item) => isRecord(item) && Number(item.id) === id);
    if (!isRecord(match)) return null;
    return typeof match.url === "string" ? match.url : typeof match.image === "string" ? match.image : null;
  }

  private async flushClothingImageQueue(): Promise<void> {
    const queued = [...this.clothingImageQueue];
    this.clothingImageQueue.clear();
    this.clothingImageTimer = null;

    const ids: number[] = [];
    for (const id of queued) {
      const cached = this.getClothingImageCache(id);
      if (cached.hit) {
        const pending = this.clothingImageInflight.get(id);
        this.clothingImageInflight.delete(id);
        pending?.resolve(cached.url);
      } else {
        ids.push(id);
      }
    }

    if (!ids.length) return;

    let data: unknown = null;
    let failed = false;
    try {
      const response = await this.windowRef.fetch(`/api/clothing/images?ids=${ids.map((id) => encodeURIComponent(id)).join(",")}`, {
        credentials: "same-origin",
        cache: "force-cache"
      });
      if (!response.ok) {
        failed = true;
        this.recordDiagnostic({ type: "batch-failed", ids, status: response.status, reason: response.status === 429 ? "rate-limited" : "http-error" });
        if (response.status === 429) console.warn(`[avatar] clothing image lookup rate limited for ${ids.length} item(s)`);
        else console.warn(`[avatar] clothing image lookup failed: HTTP ${response.status}`);
      } else {
        data = await response.json();
      }
    } catch (error) {
      failed = true;
      this.recordDiagnostic({ type: "batch-failed", ids, reason: error instanceof Error ? error.message : String(error) });
      console.warn("[avatar] clothing image lookup failed", error);
    }

    const retryIds: number[] = [];
    for (const id of ids) {
      if (failed) {
        const attempts = (this.clothingImageAttempts.get(id) || 0) + 1;
        this.clothingImageAttempts.set(id, attempts);
        if (attempts < CLOTHING_IMAGE_MAX_ATTEMPTS) {
          retryIds.push(id);
          continue;
        }
      }
      const url = failed ? null : this.readClothingImageUrl(data, id);
      if (!failed) this.recordDiagnostic({ type: url ? "batch-hit" : "batch-miss", id, url });
      this.clothingImageAttempts.delete(id);
      this.setClothingImageCache(id, url, failed ? CLOTHING_IMAGE_RETRY_MS : CLOTHING_IMAGE_TTL_MS);
      const pending = this.clothingImageInflight.get(id);
      this.clothingImageInflight.delete(id);
      pending?.resolve(url || null);
    }

    if (retryIds.length) {
      const maxAttempts = Math.max(...retryIds.map((id) => this.clothingImageAttempts.get(id) || 1));
      const delay = CLOTHING_IMAGE_RETRY_DELAYS_MS[Math.min(maxAttempts - 1, CLOTHING_IMAGE_RETRY_DELAYS_MS.length - 1)] || CLOTHING_IMAGE_RETRY_MS;
      this.scheduleClothingImageQueue(retryIds, delay);
      return;
    }

    if (this.clothingImageQueue.size && this.clothingImageTimer === null) {
      this.scheduleClothingImageQueue([...this.clothingImageQueue], 0);
    }
  }

  private recordDiagnostic(event: Omit<ClothingDiagnostic, "at">): void {
    this.diagnostics.push({ at: Date.now(), ...event });
    if (this.diagnostics.length > CLOTHING_DIAGNOSTIC_LIMIT) {
      this.diagnostics.splice(0, this.diagnostics.length - CLOTHING_DIAGNOSTIC_LIMIT);
    }
  }
}

function isRecord(value: unknown): value is Record<string | number, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
