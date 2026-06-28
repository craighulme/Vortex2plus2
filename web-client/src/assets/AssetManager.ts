import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { AssetManifest } from "./manifest";

type CachedAsset<T> = {
  value: Promise<T>;
  refs: number;
  dispose?: (value: T) => void;
};

export class AssetManager {
  private readonly cache = new Map<string, CachedAsset<unknown>>();

  constructor(
    readonly manifest: AssetManifest,
    private readonly diagnostics: DiagnosticsService
  ) {}

  resolve(path: string): string | null {
    const parts = path.split(".");
    let current: unknown = this.manifest;
    for (const part of parts) {
      current = current && typeof current === "object" ? (current as Record<string, unknown>)[part] : null;
    }
    return typeof current === "string" && current ? current : null;
  }

  resolveRequired(path: string): string {
    const resolved = this.resolve(path);
    if (!resolved) throw new Error(`asset manifest missing path: ${path}`);
    return resolved;
  }

  retainJson<T = unknown>(key: string, url: string): Promise<T> {
    return this.retain<T>(key, () => fetch(url, { cache: "force-cache" }).then((res) => {
      if (!res.ok) throw new Error(`asset fetch failed ${res.status}: ${url}`);
      return res.json() as Promise<T>;
    }));
  }

  retainImage(key: string, url: string): Promise<HTMLImageElement> {
    return this.retain<HTMLImageElement>(key, () => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`image load failed: ${url}`));
      image.src = url;
    }));
  }

  release(key: string): void {
    const cached = this.cache.get(key);
    if (!cached) return;
    cached.refs -= 1;
    if (cached.refs > 0) return;
    this.cache.delete(key);
    cached.value.then((value) => cached.dispose?.(value)).catch((error) => {
      this.diagnostics.warn("asset.release.failed", { key, error: String(error) });
    });
  }

  private retain<T>(key: string, loader: () => Promise<T>, dispose?: (value: T) => void): Promise<T> {
    const cached = this.cache.get(key) as CachedAsset<T> | undefined;
    if (cached) {
      cached.refs += 1;
      return cached.value;
    }
    const next: CachedAsset<T> = { value: loader(), refs: 1 };
    if (dispose) next.dispose = dispose;
    this.cache.set(key, next as CachedAsset<unknown>);
    return next.value;
  }
}
