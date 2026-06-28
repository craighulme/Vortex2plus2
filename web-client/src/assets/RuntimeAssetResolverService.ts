export type RuntimeAssetResolverConfig = {
  assets: {
    manifest?: { raw?: Record<string, string> };
    resolve?: (path: string) => string | null;
  };
  fallbackRaw?: string | null;
};

export class RuntimeAssetResolverService {
  private assets: RuntimeAssetResolverConfig["assets"] | null = null;
  private fallbackAssets: Record<string, string> = {};

  configure(config: RuntimeAssetResolverConfig): this {
    this.assets = config.assets;
    this.fallbackAssets = config.assets.manifest?.raw || parseFallbackAssets(config.fallbackRaw);
    return this;
  }

  resolve(path: string, fallbackKey: string | null = null): string | null {
    const resolved = this.assets?.resolve?.(path);
    if (resolved) return resolved;
    return fallbackKey ? this.fallbackAssets[fallbackKey] || null : null;
  }
}

function parseFallbackAssets(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
