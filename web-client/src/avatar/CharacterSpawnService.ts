export type CharacterSpawnPoint = {
  x: number;
  y: number | null;
  z: number;
  ry: number;
};

export type CharacterPlacementOptions = {
  footOffset: number;
  standY: number;
};

const DEFAULT_SPAWN: CharacterSpawnPoint = {
  x: 0,
  y: null,
  z: 0,
  ry: Math.PI
};

export class CharacterSpawnService {
  private spawn: CharacterSpawnPoint = { ...DEFAULT_SPAWN };

  getSpawn(): CharacterSpawnPoint {
    return { ...this.spawn };
  }

  setSpawn(x: number, y: number | null, z: number, ry = Math.PI): CharacterSpawnPoint {
    this.spawn = {
      x: safeNumber(x, this.spawn.x),
      y: y === null ? null : safeNumber(y, this.spawn.y ?? 0),
      z: safeNumber(z, this.spawn.z),
      ry: safeNumber(ry, this.spawn.ry)
    };
    return this.getSpawn();
  }

  syncFromCandidate(candidate: unknown): CharacterSpawnPoint {
    if (!candidate || typeof candidate !== "object") return this.getSpawn();
    const raw = candidate as Partial<CharacterSpawnPoint>;
    return this.setSpawn(
      Number(raw.x ?? this.spawn.x),
      raw.y === null || raw.y === undefined ? this.spawn.y : Number(raw.y),
      Number(raw.z ?? this.spawn.z),
      Number(raw.ry ?? this.spawn.ry ?? Math.PI)
    );
  }

  applyToCharacter(character: any, options: CharacterPlacementOptions): boolean {
    if (!character) return false;
    const y = this.spawn.y !== null ? this.spawn.y + options.footOffset : options.standY;
    character.position.set(this.spawn.x, y, this.spawn.z);
    character.rotation.y = this.spawn.ry ?? Math.PI;
    return true;
  }
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}
