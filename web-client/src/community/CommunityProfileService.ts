export type VortexWebBadgeKind =
  | "developer"
  | "sponsor"
  | "supporter"
  | "contributor"
  | "community";

export type VortexWebCosmetics = {
  userId: number;
  nameGradient?: [string, string];
  nameplateUrl?: string;
  profileBackgroundUrl?: string;
  badges: Array<{
    id: string;
    kind: VortexWebBadgeKind;
    label: string;
    selected?: boolean;
  }>;
};

export type VortexUserProfile = {
  id: number;
  username: string;
  bio: string;
  createdAt: string;
  followers: number | null;
  following: number | null;
  isStaff: boolean;
  isModerator: boolean;
  isBooster: boolean;
  fetchedAt: number;
};

type UserProfileListener = (profile: VortexUserProfile) => void;

const USER_PROFILE_TTL_MS = 10 * 60 * 1000;
const USER_PROFILE_MISS_TTL_MS = 15 * 60 * 1000;
const USER_PROFILE_SPACING_MS = 2500;
const USER_PROFILE_RATE_LIMIT_MS = 60 * 1000;
const USER_PROFILE_MAX_ATTEMPTS = 3;

export class CommunityProfileService {
  private ownUserId: number | null = null;
  private readonly cosmetics = new Map<number, VortexWebCosmetics>();
  private readonly vortexUsers = new Map<number, VortexUserProfile>();
  private readonly missingVortexUsers = new Map<number, number>();
  private readonly userQueue: number[] = [];
  private readonly queuedUsers = new Set<number>();
  private readonly pendingUsers = new Map<number, Array<(profile: VortexUserProfile | null) => void>>();
  private readonly userAttempts = new Map<number, number>();
  private readonly listeners = new Set<UserProfileListener>();
  private userTimer: number | null = null;
  private userRateLimitedUntil = 0;

  constructor(private readonly windowRef: Window) {}

  setOwnUserId(userId: number | null): void {
    this.ownUserId = Number.isFinite(userId) ? userId : null;
  }

  isOwnProfile(profileUserId: number): boolean {
    return this.ownUserId === profileUserId;
  }

  applyCosmetics(record: VortexWebCosmetics): void {
    this.cosmetics.set(record.userId, normalizeCosmetics(record));
  }

  getCosmetics(userId: number): VortexWebCosmetics | null {
    return this.cosmetics.get(userId) ?? null;
  }

  selectedBadge(userId: number): VortexWebCosmetics["badges"][number] | null {
    const record = this.cosmetics.get(userId);
    return record?.badges.find((badge) => badge.selected) ?? null;
  }

  getVortexUser(userId: number): VortexUserProfile | null {
    const profile = this.vortexUsers.get(userId);
    if (!profile) return null;
    if (Date.now() - profile.fetchedAt > USER_PROFILE_TTL_MS) return null;
    return profile;
  }

  prefetchVortexUsers(userIds: unknown[]): void {
    for (const id of userIds) void this.requestVortexUser(id).catch(() => null);
  }

  requestVortexUser(userId: unknown, options: { priority?: boolean } = {}): Promise<VortexUserProfile | null> {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return Promise.resolve(null);
    const cached = this.getVortexUser(id);
    if (cached) return Promise.resolve(cached);
    if (this.hasFreshMissingUser(id)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const pending = this.pendingUsers.get(id) || [];
      pending.push(resolve);
      this.pendingUsers.set(id, pending);
      if (!this.queuedUsers.has(id)) {
        if (options.priority) this.userQueue.unshift(id);
        else this.userQueue.push(id);
        this.queuedUsers.add(id);
      }
      this.scheduleUserQueue(0);
    });
  }

  onVortexUserProfile(listener: UserProfileListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): { ownUserId: number | null; cachedProfiles: number; cachedVortexUsers: number; cachedMissingVortexUsers: number; queuedVortexUsers: number } {
    return {
      ownUserId: this.ownUserId,
      cachedProfiles: this.cosmetics.size,
      cachedVortexUsers: this.vortexUsers.size,
      cachedMissingVortexUsers: this.missingVortexUsers.size,
      queuedVortexUsers: this.userQueue.length
    };
  }

  private scheduleUserQueue(delayMs: number): void {
    if (this.userTimer !== null) return;
    this.userTimer = this.windowRef.setTimeout(() => {
      this.userTimer = null;
      void this.processUserQueue();
    }, delayMs);
  }

  private async processUserQueue(): Promise<void> {
    if (!this.userQueue.length) return;
    const now = Date.now();
    if (now < this.userRateLimitedUntil) {
      this.scheduleUserQueue(this.userRateLimitedUntil - now);
      return;
    }

    const id = this.userQueue.shift()!;
    this.queuedUsers.delete(id);
    const profile = await this.fetchVortexUser(id);
    if (profile) {
      this.vortexUsers.set(id, profile);
      this.userAttempts.delete(id);
      this.resolvePendingUser(id, profile);
      for (const listener of this.listeners) listener(profile);
    }

    if (this.userQueue.length) this.scheduleUserQueue(USER_PROFILE_SPACING_MS);
  }

  private async fetchVortexUser(id: number): Promise<VortexUserProfile | null> {
    try {
      const response = await this.windowRef.fetch(`/api/users/${encodeURIComponent(id)}`, {
        credentials: "include",
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (response.status === 429) {
        this.userRateLimitedUntil = Math.max(this.userRateLimitedUntil, Date.now() + USER_PROFILE_RATE_LIMIT_MS);
        this.resolvePendingUser(id, null);
        return null;
      }
      if (response.status >= 500) {
        return this.retryOrResolveNull(id, 0);
      }
      if (!response.ok) {
        this.cacheMissingUser(id);
        this.resolvePendingUser(id, null);
        return null;
      }
      const data = await response.json().catch(() => null);
      return normalizeVortexUser(data, id);
    } catch {
      return this.retryOrResolveNull(id, 0);
    }
  }

  private retryOrResolveNull(id: number, delayMs: number): null {
    const attempts = (this.userAttempts.get(id) || 0) + 1;
    this.userAttempts.set(id, attempts);
    if (attempts >= USER_PROFILE_MAX_ATTEMPTS) {
      this.userAttempts.delete(id);
      this.resolvePendingUser(id, null);
      return null;
    }
    if (delayMs > 0) {
      this.userRateLimitedUntil = Math.max(this.userRateLimitedUntil, Date.now() + delayMs);
    }
    if (!this.queuedUsers.has(id)) {
      this.userQueue.unshift(id);
      this.queuedUsers.add(id);
    }
    return null;
  }

  private hasFreshMissingUser(id: number): boolean {
    const expiresAt = this.missingVortexUsers.get(id);
    if (!expiresAt) return false;
    if (expiresAt > Date.now()) return true;
    this.missingVortexUsers.delete(id);
    return false;
  }

  private cacheMissingUser(id: number): void {
    this.userAttempts.delete(id);
    this.missingVortexUsers.set(id, Date.now() + USER_PROFILE_MISS_TTL_MS);
  }

  private resolvePendingUser(id: number, profile: VortexUserProfile | null): void {
    const pending = this.pendingUsers.get(id) || [];
    this.pendingUsers.delete(id);
    for (const resolve of pending) resolve(profile);
  }
}

function normalizeCosmetics(record: VortexWebCosmetics): VortexWebCosmetics {
  return {
    ...record,
    badges: record.badges.map((badge) => ({
      ...badge,
      label: badge.label.trim().slice(0, 32)
    }))
  };
}

function normalizeVortexUser(data: unknown, fallbackId: number): VortexUserProfile | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const nested = isRecord(record.user) ? record.user : record;
  const id = Number(nested.id ?? record.id ?? fallbackId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    username: stringValue(nested.username ?? nested.name ?? record.username ?? record.name),
    bio: stringValue(nested.bio ?? nested.about ?? nested.description ?? record.bio),
    createdAt: stringValue(nested.created_at ?? nested.createdAt ?? nested.joined_at ?? nested.joinedAt ?? record.created_at),
    followers: numberOrNull(nested.followers_count ?? nested.follower_count ?? nested.followersCount ?? record.followers_count),
    following: numberOrNull(nested.following_count ?? nested.followingCount ?? record.following_count),
    isStaff: booleanValue(nested.is_staff ?? nested.staff ?? record.is_staff),
    isModerator: booleanValue(nested.is_moderator ?? nested.is_mod ?? nested.moderator ?? record.is_moderator),
    isBooster: booleanValue(nested.is_booster ?? nested.booster ?? nested.is_boosting ?? record.is_booster),
    fetchedAt: Date.now()
  };
}

function stringValue(value: unknown): string {
  return String(value || "").trim();
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
