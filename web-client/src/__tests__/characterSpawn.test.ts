import { describe, expect, it, vi } from "vitest";
import { CharacterSpawnService } from "../avatar/CharacterSpawnService";

describe("CharacterSpawnService", () => {
  it("stores a normalized spawn point", () => {
    const service = new CharacterSpawnService();
    service.setSpawn(10, 20, 30, 1.5);

    expect(service.getSpawn()).toEqual({ x: 10, y: 20, z: 30, ry: 1.5 });
  });

  it("applies spawn with the character foot offset", () => {
    const service = new CharacterSpawnService();
    service.setSpawn(4, 8, 12, 2);
    const character = {
      position: { set: vi.fn() },
      rotation: { y: 0 }
    };

    expect(service.applyToCharacter(character, { footOffset: 2, standY: 3 })).toBe(true);
    expect(character.position.set).toHaveBeenCalledWith(4, 10, 12);
    expect(character.rotation.y).toBe(2);
  });

  it("uses stand height when the map has no spawn y", () => {
    const service = new CharacterSpawnService();
    service.setSpawn(1, null, 2, 3);
    const character = {
      position: { set: vi.fn() },
      rotation: { y: 0 }
    };

    service.applyToCharacter(character, { footOffset: 2, standY: 5 });

    expect(character.position.set).toHaveBeenCalledWith(1, 5, 2);
  });
});
