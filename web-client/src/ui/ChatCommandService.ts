export type ChatCommandPlayer = {
  id: number;
  username: string;
  self?: boolean;
  pos?: VectorLike | null;
};

export type MovementMods = {
  fly: boolean;
  noclip: boolean;
  airwalk: boolean;
  gravityScale: number;
  flySpeed: number;
};

export type ChatCommandContext = {
  chat: {
    system(message: string): void;
    warn(message: string): void;
  };
  players(): ChatCommandPlayer[];
  localPosition(): VectorLike | null;
  movementMods(): MovementMods;
  setMovementMods(patch: Partial<MovementMods>): MovementMods;
  requireFeature(feature: string, label: string): boolean;
  teleportLocal(x: number, y: number, z: number): boolean;
  bringPlayer(player: ChatCommandPlayer): boolean;
};

export type MovementCommandApi = {
  get(): MovementMods;
  status(): string;
  fly(value?: unknown, speed?: unknown): MovementMods;
  noclip(value?: unknown): MovementMods;
  airwalk(value?: unknown): MovementMods;
  setGravity(scale?: unknown): MovementMods;
  reset(): MovementMods;
};

type VectorLike = {
  x: number;
  y: number;
  z: number;
};

type PlayerFindResult = {
  player?: ChatCommandPlayer;
  error?: string;
};

const HELP = "Commands: ::goto <player>, ::tp <x> <y> <z>, ::where [player], ::players, ::bring <player>, ::fly [on/off/speed], ::noclip [on/off], ::airwalk [on/off], ::setgravity <scale/reset>, ::movement";

export class ChatCommandService {
  createMovementApi(context: Pick<ChatCommandContext, "movementMods" | "setMovementMods"> & {
    assertFeature(feature: string, label: string): void;
  }): MovementCommandApi {
    return {
      get: () => context.movementMods(),
      status: () => this.movementStatusLine(context.movementMods()),
      fly: (value: unknown = null, speed: unknown = null) => {
        context.assertFeature("fly-command", "fly");
        const mods = context.movementMods();
        const numericValue = Number(value);
        const enabled = value === null ? !mods.fly : (Number.isFinite(numericValue) ? true : this.toggleValue(value, mods.fly));
        if (enabled === null) throw new Error("fly expects true/false/on/off");
        const numericSpeed = Number(speed ?? (Number.isFinite(numericValue) ? numericValue : NaN));
        return context.setMovementMods(Number.isFinite(numericSpeed) ? { fly: enabled, flySpeed: numericSpeed } : { fly: enabled });
      },
      noclip: (value: unknown = null) => {
        context.assertFeature("noclip-command", "noclip");
        const mods = context.movementMods();
        const enabled = value === null ? !mods.noclip : this.toggleValue(value, mods.noclip);
        if (enabled === null) throw new Error("noclip expects true/false/on/off");
        return context.setMovementMods({ noclip: enabled });
      },
      airwalk: (value: unknown = null) => {
        context.assertFeature("airwalk-command", "airwalk");
        const mods = context.movementMods();
        const enabled = value === null ? !mods.airwalk : this.toggleValue(value, mods.airwalk);
        if (enabled === null) throw new Error("airwalk expects true/false/on/off");
        return context.setMovementMods({ airwalk: enabled });
      },
      setGravity: (scale: unknown = 1) => {
        context.assertFeature("gravity-command", "setGravity");
        const value = String(scale).toLowerCase();
        const gravityScale = value === "reset" || value === "normal" || value === "default" ? 1 : Number(scale);
        if (!Number.isFinite(gravityScale) || gravityScale < 0 || gravityScale > 8) {
          throw new Error("gravity scale must be between 0 and 8");
        }
        return context.setMovementMods({ gravityScale });
      },
      reset: () => context.setMovementMods({ fly: false, noclip: false, airwalk: false, gravityScale: 1, flySpeed: 28 })
    };
  }

  handle(text: unknown, context: ChatCommandContext): boolean {
    const raw = String(text || "").trim();
    if (!raw.startsWith("::")) return false;

    const parts = raw.slice(2).trim().split(/\s+/).filter(Boolean);
    const command = String(parts.shift() || "help").toLowerCase();
    const rest = parts.join(" ");

    if (command === "help" || command === "?") {
      context.chat.system(HELP);
      return true;
    }

    if (command === "players" || command === "plr") {
      const names = context.players()
        .filter((player) => !player.self)
        .map((player) => player.username)
        .sort((a, b) => a.localeCompare(b));
      context.chat.system(names.length ? `Players: ${names.join(", ")}` : "No remote players loaded.");
      return true;
    }

    if (command === "where" || command === "pos" || command === "coords") {
      if (!rest) {
        context.chat.system(`You are at ${this.formatPosition(context.localPosition())}.`);
        return true;
      }
      const found = this.findPlayer(rest, context.players());
      if (!found.player) {
        context.chat.warn(found.error || "player not found");
        return true;
      }
      context.chat.system(`${found.player.username} is at ${this.formatPosition(found.player.pos)}.`);
      return true;
    }

    if (command === "movement" || command === "moves" || command === "mods") {
      context.chat.system(this.movementStatusLine(context.movementMods()));
      return true;
    }

    if (command === "fly") {
      if (!context.requireFeature("fly-command", "::fly")) return true;
      const mods = context.movementMods();
      let enabled = this.toggleValue(parts[0], mods.fly);
      let speed = Number(parts[0]);
      if (enabled === null && Number.isFinite(speed)) enabled = true;
      if (enabled === null) {
        context.chat.warn("Usage: ::fly [on|off|speed]");
        return true;
      }
      if (!Number.isFinite(speed) && parts[1] !== undefined) speed = Number(parts[1]);
      const next = context.setMovementMods(Number.isFinite(speed) ? { fly: enabled, flySpeed: speed } : { fly: enabled });
      context.chat.system(`Fly ${next.fly ? "enabled" : "disabled"}. ${this.movementStatusLine(next)}`);
      return true;
    }

    if (command === "noclip" || command === "clip") {
      if (!context.requireFeature("noclip-command", "::noclip")) return true;
      const mods = context.movementMods();
      const enabled = command === "clip"
        ? this.toggleValue(parts[0], !mods.noclip)
        : this.toggleValue(parts[0], mods.noclip);
      if (enabled === null) {
        context.chat.warn(command === "clip" ? "Usage: ::clip [on|off]" : "Usage: ::noclip [on|off]");
        return true;
      }
      const next = context.setMovementMods({ noclip: command === "clip" ? !enabled : enabled });
      context.chat.system(`Noclip ${next.noclip ? "enabled" : "disabled"}. ${this.movementStatusLine(next)}`);
      return true;
    }

    if (command === "airwalk" || command === "air") {
      if (!context.requireFeature("airwalk-command", "::airwalk")) return true;
      const mods = context.movementMods();
      const enabled = this.toggleValue(parts[0], mods.airwalk);
      if (enabled === null) {
        context.chat.warn("Usage: ::airwalk [on|off]");
        return true;
      }
      const next = context.setMovementMods({ airwalk: enabled });
      context.chat.system(`Airwalk ${next.airwalk ? "enabled" : "disabled"}. ${this.movementStatusLine(next)}`);
      return true;
    }

    if (command === "setgravity" || command === "gravity" || command === "fallspeed") {
      if (!context.requireFeature("gravity-command", "::setgravity")) return true;
      const value = String(parts[0] || "").trim().toLowerCase();
      if (!value || value === "reset" || value === "normal" || value === "default") {
        const next = context.setMovementMods({ gravityScale: 1 });
        context.chat.system(`Gravity reset. ${this.movementStatusLine(next)}`);
        return true;
      }
      const scale = Number(value);
      if (!Number.isFinite(scale) || scale < 0 || scale > 8) {
        context.chat.warn("Usage: ::setgravity <0..8|reset>");
        return true;
      }
      const next = context.setMovementMods({ gravityScale: scale });
      context.chat.system(`Gravity scale set to ${Number(next.gravityScale).toFixed(2)}. ${this.movementStatusLine(next)}`);
      return true;
    }

    if (command === "tp" || command === "teleport") {
      if (!context.requireFeature("teleport-commands", "::tp")) return true;
      const nums = parts.map(Number);
      if (nums.length < 3 || nums.slice(0, 3).some((n) => !Number.isFinite(n))) {
        context.chat.warn("Usage: ::tp <x> <y> <z>");
        return true;
      }
      if (context.teleportLocal(nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0)) {
        context.chat.system(`Teleported to ${this.formatPosition({ x: nums[0] ?? 0, y: nums[1] ?? 0, z: nums[2] ?? 0 })}.`);
      } else {
        context.chat.warn("No local character yet.");
      }
      return true;
    }

    if (command === "goto" || command === "to") {
      if (!context.requireFeature("teleport-commands", "::goto")) return true;
      const found = this.findPlayer(rest, context.players());
      if (!found.player) {
        context.chat.warn(found.error || "player not found");
        return true;
      }
      if (!found.player.pos) {
        context.chat.warn(`${found.player.username} has no position yet.`);
        return true;
      }
      const y = found.player.pos.y + 0.25;
      if (context.teleportLocal(found.player.pos.x, y, found.player.pos.z)) {
        context.chat.system(`Teleported to ${found.player.username}.`);
      } else {
        context.chat.warn("No local character yet.");
      }
      return true;
    }

    if (command === "bring") {
      if (!context.requireFeature("bring-command", "::bring")) return true;
      const found = this.findPlayer(rest, context.players());
      if (!found.player) {
        context.chat.warn(found.error || "player not found");
        return true;
      }
      if (found.player.self) {
        context.chat.warn("You cannot bring yourself.");
        return true;
      }
      if (context.bringPlayer(found.player)) {
        context.chat.system(`Moved ${found.player.username} locally. This does not move them server-side.`);
      } else {
        context.chat.warn("Player is not loaded.");
      }
      return true;
    }

    context.chat.warn(`Unknown command "::${command}". Try ::help`);
    return true;
  }

  toggleValue(arg: unknown, current: boolean): boolean | null {
    const value = String(arg || "").trim().toLowerCase();
    if (!value) return !current;
    if (["1", "on", "true", "yes", "y", "enable", "enabled"].includes(value)) return true;
    if (["0", "off", "false", "no", "n", "disable", "disabled"].includes(value)) return false;
    return null;
  }

  movementStatusLine(mods: MovementMods): string {
    return `Movement: fly=${mods.fly ? "on" : "off"}, noclip=${mods.noclip ? "on" : "off"}, airwalk=${mods.airwalk ? "on" : "off"}, gravity=${Number(mods.gravityScale).toFixed(2)}, flySpeed=${Number(mods.flySpeed).toFixed(1)}`;
  }

  findPlayer(query: unknown, players: ChatCommandPlayer[]): PlayerFindResult {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return { error: "missing player name" };

    const exactId = /^\d+$/.test(needle) ? players.find((player) => String(player.id) === needle) : null;
    if (exactId) return { player: exactId };

    const exact = players.find((player) => String(player.username || "").toLowerCase() === needle);
    if (exact) return { player: exact };

    const starts = players.filter((player) => String(player.username || "").toLowerCase().startsWith(needle));
    if (starts.length === 1 && starts[0]) return { player: starts[0] };
    if (starts.length > 1) return { error: `ambiguous: ${starts.map((player) => player.username).slice(0, 6).join(", ")}` };

    const contains = players.filter((player) => String(player.username || "").toLowerCase().includes(needle));
    if (contains.length === 1 && contains[0]) return { player: contains[0] };
    if (contains.length > 1) return { error: `ambiguous: ${contains.map((player) => player.username).slice(0, 6).join(", ")}` };

    const looseNeedle = this.commandNameKey(needle);
    if (looseNeedle) {
      const looseExact = players.filter((player) => this.commandNameKey(player.username) === looseNeedle);
      if (looseExact.length === 1 && looseExact[0]) return { player: looseExact[0] };
      if (looseExact.length > 1) return { error: `ambiguous: ${looseExact.map((player) => player.username).slice(0, 6).join(", ")}` };

      const looseStarts = players.filter((player) => this.commandNameKey(player.username).startsWith(looseNeedle));
      if (looseStarts.length === 1 && looseStarts[0]) return { player: looseStarts[0] };
      if (looseStarts.length > 1) return { error: `ambiguous: ${looseStarts.map((player) => player.username).slice(0, 6).join(", ")}` };

      const looseContains = players.filter((player) => this.commandNameKey(player.username).includes(looseNeedle));
      if (looseContains.length === 1 && looseContains[0]) return { player: looseContains[0] };
      if (looseContains.length > 1) return { error: `ambiguous: ${looseContains.map((player) => player.username).slice(0, 6).join(", ")}` };
    }

    return { error: `no player matching "${query}"` };
  }

  formatPosition(pos: VectorLike | null | undefined): string {
    if (!pos) return "(unknown)";
    return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
  }

  private commandNameKey(value: unknown): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[il1|]/g, "l")
      .replace(/[o0]/g, "o")
      .replace(/[^a-z0-9_]/g, "");
  }
}
