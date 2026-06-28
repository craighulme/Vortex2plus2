export type AvatarNormalizer<T> = (value: unknown) => T;

export type PacketDebugSnapshot = {
  id: number;
  username: string;
  game: number;
  x: number;
  y: number;
  z: number;
  ry: number;
  anim: string;
  shirt_id: number;
  pant_id: number;
  body_type: string;
  body_colors: unknown[];
  face_id: number;
  has_avatar: boolean;
  record_bytes: number;
  float_offset: number;
  seen_at: string;
  source?: string;
  spoof_latency_ms?: number;
};

export type PacketDebugProbeEvent = Record<string, unknown> & {
  type?: string;
  at?: string;
};

export type PacketDebugLeave = {
  id: number;
  username: string;
  at: string;
};

export type PendingSpoof<T> = {
  seq: number;
  signature: string;
  avatar: T;
  sentAt: number;
};

export type RandomSpoofCallbacks<T> = {
  bridgeOpen(): boolean;
  bridgeSend(payload: Record<string, unknown>): void;
  setOutboundAvatar(patch: T, options: Record<string, unknown>): void;
  log?(message: string, patch: T): void;
  setTimeoutRef?: typeof setTimeout;
  setIntervalRef?: typeof setInterval;
  clearIntervalRef?: typeof clearInterval;
};

export class PacketDebugService {
  private enabledValue = false;
  private readonly playersById = new Map<number, PacketDebugSnapshot>();
  private readonly historyItems: Array<{ source: string; at: string; players: PacketDebugSnapshot[] }> = [];
  private readonly probeItems: PacketDebugProbeEvent[] = [];
  private readonly leaveItems: PacketDebugLeave[] = [];
  private readonly latencyItems: unknown[] = [];
  private readonly pendingSpoofs: Array<PendingSpoof<unknown>> = [];
  private lastPrintAt = 0;
  private lastProbePrintKey = "";
  private lastProbePrintAt = 0;
  private originalAvatar: unknown = null;
  private spoofSeq = 0;
  private randomTimer: ReturnType<typeof setInterval> | null = null;
  private readonly randomTimers: Array<ReturnType<typeof setInterval>> = [];
  private logTablesValue = false;

  constructor(private readonly storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
    this.enabledValue = storage?.getItem("vwebPacketDebug") === "1";
  }

  get enabled(): boolean {
    return this.enabledValue;
  }

  setEnabled(value: boolean): boolean {
    this.enabledValue = Boolean(value);
    this.storage?.setItem("vwebPacketDebug", this.enabledValue ? "1" : "0");
    return this.enabledValue;
  }

  setLog(value: boolean): boolean {
    this.logTablesValue = Boolean(value);
    return this.logTablesValue;
  }

  get logTables(): boolean {
    return this.logTablesValue;
  }

  syncAccess(allowed: boolean): boolean {
    if (!allowed) {
      this.enabledValue = false;
      this.storage?.removeItem("vwebPacketDebug");
      return false;
    }
    this.enabledValue = this.storage?.getItem("vwebPacketDebug") === "1";
    return true;
  }

  snapshotPlayer(player: unknown, fallbackGameId = 0): PacketDebugSnapshot | null {
    if (!player || typeof player !== "object") return null;
    const value = player as Record<string, unknown>;
    if (!Number.isFinite(Number(value.id))) return null;
    return {
      id: Number(value.id),
      username: String(value.username || value.name || ""),
      game: Number(value.game || value.game_id || value.gameId || fallbackGameId || 0) || 0,
      x: Number(value.x || 0),
      y: Number(value.y || 0),
      z: Number(value.z || 0),
      ry: Number(value.ry ?? value.yaw ?? 0),
      anim: String(value.anim || ""),
      shirt_id: Number(value.shirt_id ?? value.shirtId ?? 0) || 0,
      pant_id: Number(value.pant_id ?? value.pantId ?? 0) || 0,
      body_type: String(value.body_type ?? value.bodyType ?? ""),
      body_colors: Array.isArray(value.body_colors) ? [...value.body_colors] : (Array.isArray(value.bodyColors) ? [...value.bodyColors] : []),
      face_id: Number(value.face_id ?? value.faceId ?? 0) || 0,
      has_avatar: Boolean(value.hasAvatar || value.shirt_id || value.pant_id || value.face_id || value.body_colors || value.bodyColors),
      record_bytes: Number(value.recordBytes || 0) || 0,
      float_offset: Number(value.floatOffset || 0) || 0,
      seen_at: new Date().toISOString()
    };
  }

  recordReplicatedPlayers<T>(source: string, players: unknown[], options: {
    fallbackGameId?: number;
    normalizeAvatar: AvatarNormalizer<T>;
    now?: number;
    log?: Pick<Console, "table" | "log">;
  }): PacketDebugSnapshot[] {
    if (!Array.isArray(players) || !players.length) return [];
    if (!this.enabledValue && !this.pendingSpoofs.length) return [];
    const batch: PacketDebugSnapshot[] = [];
    for (const player of players) {
      const snap = this.snapshotPlayer(player, options.fallbackGameId || 0);
      if (!snap) continue;
      snap.source = source;
      this.matchSpoofEcho(snap, options.normalizeAvatar, options.now ?? performance.now(), options.log);
      this.playersById.set(snap.id, snap);
      batch.push(snap);
    }
    if (!batch.length) return [];
    this.historyItems.push({ source, at: new Date().toISOString(), players: batch });
    trim(this.historyItems, 200);
    const now = options.now ?? performance.now();
    if (this.enabledValue && this.logTablesValue && now - this.lastPrintAt > 1000) {
      this.lastPrintAt = now;
      options.log?.table?.([...this.playersById.values()].map((p) => ({
        id: p.id,
        username: p.username,
        shirt: p.shirt_id,
        pants: p.pant_id,
        face: p.face_id,
        body: p.body_type,
        colors: p.body_colors.join(","),
        bytes: p.record_bytes,
        source: p.source
      })));
    }
    return batch;
  }

  avatarSignature<T>(avatar: unknown, normalizeAvatar: AvatarNormalizer<T>): string {
    const normalized = normalizeAvatar(avatar || {}) as Record<string, unknown>;
    return JSON.stringify({
      shirt_id: normalized.shirt_id,
      pant_id: normalized.pant_id,
      body_type: normalized.body_type,
      body_colors: normalized.body_colors,
      face_id: normalized.face_id
    });
  }

  addPendingSpoof<T>(avatar: T, normalizeAvatar: AvatarNormalizer<T>, now = performance.now()): number {
    const seq = ++this.spoofSeq;
    this.pendingSpoofs.push({
      seq,
      signature: this.avatarSignature(avatar, normalizeAvatar),
      avatar,
      sentAt: now
    });
    trim(this.pendingSpoofs, 40);
    return seq;
  }

  recordProbeEvent(event: PacketDebugProbeEvent, log?: Pick<Console, "log" | "warn">, now = performance.now()): PacketDebugProbeEvent {
    const item: PacketDebugProbeEvent = { ...event, at: event.at || new Date().toISOString() };
    this.probeItems.push(item);
    trim(this.probeItems, 200);
    if (this.enabledValue) {
      const key = JSON.stringify({
        type: item.type,
        packet_type: item.packet_type,
        bytes: item.bytes,
        expected: item.expected,
        records: item.records,
        anomalies: item.anomalies || [],
        case: item.case,
        mutation: item.mutation
      });
      if (key === this.lastProbePrintKey && now - this.lastProbePrintAt < 2000) return item;
      this.lastProbePrintKey = key;
      this.lastProbePrintAt = now;
      if (item.type === "debug_packet" && Array.isArray(item.anomalies) && item.anomalies.length) {
        log?.warn?.("[packet-debug] packet anomaly", item);
      } else {
        log?.log?.("[packet-debug] probe", item);
      }
    }
    return item;
  }

  recordLeave(id: unknown, username: unknown): PacketDebugLeave {
    const item = {
      id: Number(id || 0) || 0,
      username: String(username || ""),
      at: new Date().toISOString()
    };
    this.leaveItems.push(item);
    trim(this.leaveItems, 100);
    return item;
  }

  players(): PacketDebugSnapshot[] {
    return [...this.playersById.values()];
  }

  last(id: unknown): PacketDebugSnapshot | undefined {
    return this.playersById.get(Number(id));
  }

  history(): Array<{ source: string; at: string; players: PacketDebugSnapshot[] }> {
    return [...this.historyItems];
  }

  leaves(): PacketDebugLeave[] {
    return [...this.leaveItems];
  }

  probes(): PacketDebugProbeEvent[] {
    return [...this.probeItems];
  }

  latencies(): unknown[] {
    return [...this.latencyItems];
  }

  rememberOriginalAvatar<T>(avatar: T): void {
    if (!this.originalAvatar) this.originalAvatar = avatar;
  }

  takeOriginalAvatar<T>(): T | null {
    const original = this.originalAvatar as T | null;
    this.originalAvatar = null;
    return original;
  }

  hasOriginalAvatar(): boolean {
    return Boolean(this.originalAvatar);
  }

  nextSpoofSeq(): number {
    return this.spoofSeq;
  }

  randomAvatarPatch(options: Record<string, unknown> = {}): {
    shirt_id: number;
    pant_id: number;
    body_type: "male" | "female";
    body_colors: string[];
    face_id: number;
  } {
    const defaultIds = Array.from({ length: Number(options.maxId || 50) || 50 }, (_, i) => i + 1);
    const shirts = Array.isArray(options.shirts) && options.shirts.length ? options.shirts : defaultIds;
    const pants = Array.isArray(options.pants) && options.pants.length ? options.pants : defaultIds;
    const faces = Array.isArray(options.faces) && options.faces.length ? options.faces : defaultIds;
    return {
      shirt_id: Number(shirts[randInt(0, shirts.length - 1)]) || 0,
      pant_id: Number(pants[randInt(0, pants.length - 1)]) || 0,
      body_type: Math.random() < 0.5 ? "male" : "female",
      body_colors: Array.from({ length: 6 }, randHexColor),
      face_id: Number(faces[randInt(0, faces.length - 1)]) || 0
    };
  }

  startRandomSpoof<T extends Record<string, unknown>>(options: Record<string, unknown> = {}, callbacks: RandomSpoofCallbacks<T>): {
    running: true;
    threads: number;
    intervalMs: number;
    countPerThread: number;
    totalExpected: number | "infinite";
  } {
    const intervalMs = Math.max(50, Number(options.intervalMs ?? options.interval ?? 1000) || 1000);
    const count = Math.max(0, Number(options.count || 0) || 0);
    const threadCount = Math.max(1, Number(options.MultiThread || 1));
    const posRand = !!options.PosRand;
    const setTimeoutRef = callbacks.setTimeoutRef || setTimeout;
    const setIntervalRef = callbacks.setIntervalRef || setInterval;
    const clearIntervalRef = callbacks.clearIntervalRef || clearInterval;

    this.stopRandomSpoof(clearIntervalRef);

    let sent = 0;
    for (let i = 0; i < threadCount; i++) {
      const jitterMs = Math.random() * (intervalMs / 2);
      setTimeoutRef.call(globalThis, () => {
        const tick = () => {
          sent += 1;
          if (posRand && callbacks.bridgeOpen()) {
            callbacks.bridgeSend({
              type: "state",
              x: (Math.random() - 0.5) * 200000,
              y: (Math.random() - 0.5) * 200000,
              z: (Math.random() - 0.5) * 200000,
              ry: Math.random() * Math.PI * 2,
              anim: Math.random() > 0.5 ? "jump" : "walk"
            });
          }

          const patch = this.randomAvatarPatch(options) as unknown as T;
          callbacks.setOutboundAvatar(patch, {
            measure: true,
            flush: true,
            rebuild: options.rebuild !== false && options.applyLocal !== false,
            rebuildRemotes: false
          });

          if (this.enabledValue) callbacks.log?.(`[packet-debug] thread ${i} spoof #${this.nextSpoofSeq()}`, patch);

          if (count && sent >= count * threadCount) {
            this.stopRandomSpoof(clearIntervalRef);
          }
        };

        tick();
        if (!count || count > 1) {
          const timer = setIntervalRef.call(globalThis, tick, intervalMs);
          this.randomTimers.push(timer);
        }
      }, jitterMs);
    }

    return {
      running: true,
      threads: threadCount,
      intervalMs,
      countPerThread: count,
      totalExpected: count ? count * threadCount : "infinite"
    };
  }

  stopRandomSpoof(clearIntervalRef: typeof clearInterval = clearInterval): boolean {
    this.randomTimers.forEach((timer) => clearIntervalRef.call(globalThis, timer));
    this.randomTimers.length = 0;
    if (this.randomTimer) {
      clearIntervalRef.call(globalThis, this.randomTimer);
      this.randomTimer = null;
    }
    return true;
  }

  private matchSpoofEcho<T>(snap: PacketDebugSnapshot, normalizeAvatar: AvatarNormalizer<T>, now: number, log?: Pick<Console, "log">): void {
    if (!snap.has_avatar) return;
    const sig = this.avatarSignature(snap, normalizeAvatar);
    const index = this.pendingSpoofs.findIndex((item) => item.signature === sig);
    if (index < 0) return;
    const item = this.pendingSpoofs.splice(index, 1)[0];
    if (!item) return;
    const latencyMs = now - item.sentAt;
    const result = {
      seq: item.seq,
      latency_ms: Math.round(latencyMs * 10) / 10,
      source: snap.source,
      avatar: item.avatar,
      seen_at: new Date().toISOString()
    };
    snap.spoof_latency_ms = result.latency_ms;
    this.latencyItems.push(result);
    trim(this.latencyItems, 100);
    if (this.enabledValue) {
      log?.log?.(`[packet-debug] spoof #${result.seq} echoed in ${result.latency_ms}ms via ${result.source}`);
    }
  }
}

function trim<T>(items: T[], max: number): void {
  while (items.length > max) items.shift();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randHexColor(): string {
  return `#${randInt(0, 0xffffff).toString(16).padStart(6, "0")}`;
}
