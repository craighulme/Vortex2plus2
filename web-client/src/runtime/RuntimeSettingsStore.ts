export class RuntimeSettingsStore {
  constructor(private readonly storage: Storage) {}

  readFlag(key: string, fallback = false): boolean {
    const value = this.storage.getItem(key);
    if (value === null) return fallback;
    return value === "1" || value === "yes" || value === "true" || value === "on";
  }

  readNumber(key: string, fallback: number, min = -Infinity, max = Infinity): number {
    const value = Number(this.storage.getItem(key));
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
