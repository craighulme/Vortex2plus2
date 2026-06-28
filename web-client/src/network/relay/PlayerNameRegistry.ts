export class PlayerNameRegistry {
  private readonly knownPlayerNames = new Map<number, string>();

  isPlaceholder(id: unknown, value: unknown): boolean {
    const playerId = Number(id);
    const raw = String(value || "").trim();
    if (!raw) return true;
    if (!Number.isFinite(playerId) || playerId <= 0) return false;
    const lower = raw.toLowerCase();
    const idText = String(playerId);
    return raw === idText ||
      raw === `#${idText}` ||
      lower === `user${idText}` ||
      lower === `#user${idText}` ||
      lower === "browserplayer";
  }

  remember(id: unknown, username: unknown): string {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return "";
    const name = String(username || "").trim();
    if (this.isPlaceholder(playerId, name)) return this.knownPlayerNames.get(playerId) || "";
    this.knownPlayerNames.set(playerId, name);
    return name;
  }

  displayName(id: unknown, username: unknown): string {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return String(username || "").trim();
    return this.remember(playerId, username) || this.knownPlayerNames.get(playerId) || `#${playerId}`;
  }

  snapshot(): Record<number, string> {
    return Object.fromEntries(this.knownPlayerNames.entries());
  }

  clear(): void {
    this.knownPlayerNames.clear();
  }
}
