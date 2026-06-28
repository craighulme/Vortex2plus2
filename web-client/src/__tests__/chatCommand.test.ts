import { describe, expect, it } from "vitest";
import { ChatCommandService, type ChatCommandContext, type MovementMods } from "../ui/ChatCommandService";

function makeContext(overrides: Partial<ChatCommandContext> = {}) {
  const systems: string[] = [];
  const warnings: string[] = [];
  let mods: MovementMods = {
    fly: false,
    noclip: false,
    airwalk: false,
    gravityScale: 1,
    flySpeed: 28
  };
  const context: ChatCommandContext = {
    chat: {
      system: (message) => systems.push(message),
      warn: (message) => warnings.push(message)
    },
    players: () => [
      { id: 1, username: "monsterenergy", self: true, pos: { x: 1, y: 2, z: 3 } },
      { id: 2, username: "kagome", pos: { x: 4, y: 5, z: 6 } }
    ],
    localPosition: () => ({ x: 1, y: 2, z: 3 }),
    movementMods: () => mods,
    setMovementMods: (patch) => {
      mods = { ...mods, ...patch };
      return mods;
    },
    requireFeature: () => true,
    teleportLocal: () => true,
    bringPlayer: () => true,
    ...overrides
  };
  return { context, systems, warnings, get mods() { return mods; } };
}

describe("ChatCommandService", () => {
  it("ignores normal chat text", () => {
    const service = new ChatCommandService();
    const { context } = makeContext();

    expect(service.handle("hello", context)).toBe(false);
  });

  it("lists loaded players", () => {
    const service = new ChatCommandService();
    const { context, systems } = makeContext();

    expect(service.handle("::players", context)).toBe(true);
    expect(systems).toEqual(["Players: kagome"]);
  });

  it("matches players loosely for where commands", () => {
    const service = new ChatCommandService();
    const { context, systems } = makeContext();

    expect(service.handle("::where kag0me", context)).toBe(true);
    expect(systems).toEqual(["kagome is at (4.00, 5.00, 6.00)."]);
  });

  it("applies gated movement commands through callbacks", () => {
    const service = new ChatCommandService();
    const harness = makeContext();

    expect(service.handle("::fly 40", harness.context)).toBe(true);
    expect(harness.mods.fly).toBe(true);
    expect(harness.mods.flySpeed).toBe(40);
    expect(harness.systems[0]).toContain("Fly enabled.");
  });

  it("does not run restricted movement commands when feature checks fail", () => {
    const service = new ChatCommandService();
    const harness = makeContext({
      requireFeature: (_feature, label) => {
        harness.warnings.push(`${label} denied`);
        return false;
      }
    });

    expect(service.handle("::noclip on", harness.context)).toBe(true);
    expect(harness.mods.noclip).toBe(false);
    expect(harness.warnings).toEqual(["::noclip denied"]);
  });

  it("creates the VortexMovement console API from the same movement helpers", () => {
    const service = new ChatCommandService();
    const harness = makeContext();
    const api = service.createMovementApi({
      movementMods: harness.context.movementMods,
      setMovementMods: harness.context.setMovementMods,
      assertFeature: () => {}
    });

    expect(api.status()).toContain("fly=off");
    expect(api.fly("35")).toMatchObject({ fly: true, flySpeed: 35 });
    expect(api.noclip()).toMatchObject({ noclip: true });
    expect(api.airwalk("on")).toMatchObject({ airwalk: true });
    expect(api.setGravity("reset")).toMatchObject({ gravityScale: 1 });
    expect(api.reset()).toEqual({
      fly: false,
      noclip: false,
      airwalk: false,
      gravityScale: 1,
      flySpeed: 28
    });
  });
});
