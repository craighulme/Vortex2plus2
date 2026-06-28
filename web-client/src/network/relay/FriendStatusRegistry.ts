export type FriendStatus = "friends" | "request_received" | "request_sent" | "none";

export class FriendStatusRegistry {
  private readonly friendIds = new Set<number>();
  private readonly incomingIds = new Set<number>();
  private readonly outgoingIds = new Set<number>();

  replace(friends: unknown[] = [], incoming: unknown[] = [], outgoing: unknown[] = []): void {
    this.friendIds.clear();
    this.incomingIds.clear();
    this.outgoingIds.clear();
    for (const item of friends) addPositiveId(this.friendIds, readAnyId(item, ["id", "user_id", "userId"]));
    for (const item of incoming) addPositiveId(this.incomingIds, readAnyId(item, ["from_user_id", "fromUserId", "id"]));
    for (const item of outgoing) addPositiveId(this.outgoingIds, readAnyId(item, ["to_user_id", "toUserId", "id"]));
  }

  status(id: unknown): FriendStatus {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return "none";
    if (this.friendIds.has(playerId)) return "friends";
    if (this.incomingIds.has(playerId)) return "request_received";
    if (this.outgoingIds.has(playerId)) return "request_sent";
    return "none";
  }

  statusMap(ids: Iterable<unknown>): Record<string, FriendStatus> {
    const out: Record<string, FriendStatus> = {};
    for (const id of ids) out[String(Number(id))] = this.status(id);
    return out;
  }

  set(id: unknown, status: FriendStatus): FriendStatus {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return "none";
    this.friendIds.delete(playerId);
    this.incomingIds.delete(playerId);
    this.outgoingIds.delete(playerId);
    if (status === "friends") this.friendIds.add(playerId);
    else if (status === "request_received") this.incomingIds.add(playerId);
    else if (status === "request_sent") this.outgoingIds.add(playerId);
    return this.status(playerId);
  }

  clear(): void {
    this.friendIds.clear();
    this.incomingIds.clear();
    this.outgoingIds.clear();
  }
}

export async function fetchFriendLists(fetcher: typeof fetch): Promise<[unknown[], unknown[], unknown[]]> {
  return Promise.all([
    fetchJsonArray(fetcher, "/api/friends"),
    fetchJsonArray(fetcher, "/api/friends/requests/incoming"),
    fetchJsonArray(fetcher, "/api/friends/requests/outgoing")
  ]);
}

function readAnyId(value: unknown, keys: string[]): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const id = Number(record[key]);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return 0;
}

function addPositiveId(target: Set<number>, id: number): void {
  if (Number.isFinite(id) && id > 0) target.add(id);
}

async function fetchJsonArray(fetcher: typeof fetch, url: string): Promise<unknown[]> {
  const response = await fetcher(url);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
