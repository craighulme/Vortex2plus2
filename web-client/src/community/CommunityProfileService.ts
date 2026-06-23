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

export class CommunityProfileService {
  private ownUserId: number | null = null;
  private readonly cosmetics = new Map<number, VortexWebCosmetics>();

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

  snapshot(): { ownUserId: number | null; cachedProfiles: number } {
    return {
      ownUserId: this.ownUserId,
      cachedProfiles: this.cosmetics.size
    };
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
