export const COSMETICS_PAGE_CACHE_KEY = "vortexWebCosmeticsLeaderboard";
export const COSMETICS_TTL_MS = 10 * 60 * 1000;
export const COSMETICS_RETRY_MS = 30 * 1000;

export type LeaderboardCosmeticsRecord = {
  badges?: Array<{ kind?: string; selected?: boolean }>;
  badgeGradient?: string[];
  badgeEffect?: string;
  nameplateUrl?: string;
  nameGradient?: string[];
  nameEffect?: string;
  profileBackgroundUrl?: string;
  profile_background_url?: string;
  backgroundUrl?: string;
  background_url?: string;
};

export type LeaderboardCosmeticsCache = {
  records: Record<string, LeaderboardCosmeticsRecord>;
  fetchedAt: Record<string, number>;
  cacheTtlMs: number;
};

export function readLeaderboardCosmeticsCache(storage: Storage, documentRef: Document): LeaderboardCosmeticsCache {
  const cached = readLocalCosmeticsCache(storage);
  const meta = documentRef.getElementById("_vortexWebCosmetics") as HTMLMetaElement | null;
  if (!meta?.content) return cached;
  try {
    const parsed = JSON.parse(meta.content) as Partial<LeaderboardCosmeticsCache> | null;
    if (!parsed || typeof parsed !== "object") return cached;
    return {
      records: { ...(cached.records || {}), ...(parsed.records || {}) },
      fetchedAt: { ...(cached.fetchedAt || {}), ...(parsed.fetchedAt || {}) },
      cacheTtlMs: parsed.cacheTtlMs || cached.cacheTtlMs || COSMETICS_TTL_MS
    };
  } catch {
    return cached;
  }
}

export function readLocalCosmeticsCache(storage: Storage): LeaderboardCosmeticsCache {
  try {
    const raw = storage.getItem(COSMETICS_PAGE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<LeaderboardCosmeticsCache> | null : null;
    if (!parsed || typeof parsed !== "object") return emptyCache();
    return {
      records: parsed.records && typeof parsed.records === "object" ? parsed.records : {},
      fetchedAt: parsed.fetchedAt && typeof parsed.fetchedAt === "object" ? parsed.fetchedAt : {},
      cacheTtlMs: COSMETICS_TTL_MS
    };
  } catch {
    return emptyCache();
  }
}

export function writeLeaderboardCosmeticsCache(storage: Storage, cosmetics: LeaderboardCosmeticsCache): void {
  try {
    storage.setItem(COSMETICS_PAGE_CACHE_KEY, JSON.stringify({
      records: cosmetics.records || {},
      fetchedAt: cosmetics.fetchedAt || {},
      cacheTtlMs: COSMETICS_TTL_MS
    }));
  } catch {}
}

export function readCommunityApiBase(documentRef: Document): string {
  const meta = documentRef.getElementById("_vortexCommunityApi") as HTMLMetaElement | null;
  if (!meta?.content) return "https://v22.irongiant.vip";
  try {
    const parsed = JSON.parse(meta.content) as unknown;
    return String(parsed || "https://v22.irongiant.vip").replace(/\/+$/, "");
  } catch {
    return "https://v22.irongiant.vip";
  }
}

export function cosmeticsFor(
  cosmetics: LeaderboardCosmeticsCache,
  playerId: number | string
): LeaderboardCosmeticsRecord | null {
  return cosmetics.records?.[String(playerId)] || null;
}

export function playerPanelBackgroundUrl(record: LeaderboardCosmeticsRecord | null): string {
  return String(
    record?.profileBackgroundUrl ||
    record?.profile_background_url ||
    record?.backgroundUrl ||
    record?.background_url ||
    ""
  ).trim();
}

export function isVideoUrl(value: unknown): boolean {
  const raw = String(value || "").split("?")[0]?.split("#")[0]?.toLowerCase() || "";
  return raw.endsWith(".mp4") || raw.endsWith(".webm") || raw.endsWith(".mov") || raw.endsWith(".m4v");
}

function emptyCache(): LeaderboardCosmeticsCache {
  return { records: {}, fetchedAt: {}, cacheTtlMs: COSMETICS_TTL_MS };
}
