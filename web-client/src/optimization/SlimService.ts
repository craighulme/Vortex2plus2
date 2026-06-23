export type SlimBand = "source" | "composite" | "impostor" | "culled";

export type SlimDistances = {
  source: number;
  composite: number;
  impostor: number;
  cull: number;
};

export type SlimTarget = {
  id: string;
  label?: string;
  source: SlimObject;
  composite?: SlimObject;
  impostor?: SlimObject;
  center?: Vec3;
  getCenter?: () => Vec3;
  radius?: number;
  distances?: Partial<SlimDistances>;
  onBandChange?: (band: SlimBand, previous: SlimBand) => void;
};

type RuntimeLike = {
  renderer: { getHandles(): { camera?: unknown } };
};

type SlimObject = {
  visible?: boolean;
};

type Vec3 = { x: number; y: number; z: number };

const DEFAULT_DISTANCES: SlimDistances = {
  source: 120,
  composite: 240,
  impostor: 420,
  cull: 900
};

type StoredTarget = Required<Pick<SlimTarget, "id" | "source">> & Omit<SlimTarget, "distances"> & {
  distances: SlimDistances;
  band: SlimBand;
};

export class SlimService {
  private readonly targets = new Map<string, StoredTarget>();
  private profile: "quality" | "balanced" | "performance" = "balanced";
  private lastUpdateAt = 0;
  private updateIntervalMs = 160;

  registerTarget(target: SlimTarget): void {
    const previous = this.targets.get(target.id);
    const stored: StoredTarget = {
      ...target,
      distances: normalizeDistances(target.distances),
      band: previous?.band ?? "source"
    };
    this.targets.set(target.id, stored);
    this.applyBand(stored, stored.band, stored.band);
  }

  unregisterTarget(id: string): void {
    const target = this.targets.get(id);
    if (!target) return;
    setVisible(target.source, true);
    setVisible(target.composite, false);
    setVisible(target.impostor, false);
    this.targets.delete(id);
  }

  setProfile(profile: "quality" | "balanced" | "performance"): void {
    this.profile = profile;
  }

  update(runtime: RuntimeLike, force = false): void {
    if (!force && this.targets.size === 0) return;
    const now = performance.now();
    if (!force && now - this.lastUpdateAt < this.updateIntervalMs) return;
    this.lastUpdateAt = now;
    const camera = readCameraPosition(runtime);
    if (!camera) return;

    for (const target of this.targets.values()) {
      const center = target.getCenter?.() ?? target.center ?? { x: 0, y: 0, z: 0 };
      const distance = Math.max(0, distanceBetween(camera, center) - (target.radius ?? 0));
      const band = this.chooseBand(distance, target.distances);
      if (band === target.band) continue;
      const previous = target.band;
      target.band = band;
      this.applyBand(target, band, previous);
    }
  }

  getBand(id: string): SlimBand | null {
    return this.targets.get(id)?.band ?? null;
  }

  hasTargets(): boolean {
    return this.targets.size > 0;
  }

  snapshot(): { profile: string; targets: number; bands: Record<SlimBand, number> } {
    const bands: Record<SlimBand, number> = { source: 0, composite: 0, impostor: 0, culled: 0 };
    for (const target of this.targets.values()) bands[target.band] += 1;
    return {
      profile: this.profile,
      targets: this.targets.size,
      bands
    };
  }

  private chooseBand(distance: number, distances: SlimDistances): SlimBand {
    const bias = this.profile === "quality" ? 1.25 : this.profile === "performance" ? 0.72 : 1;
    if (distance <= distances.source * bias) return "source";
    if (distance <= distances.composite * bias) return "composite";
    if (distance <= distances.impostor * bias) return "impostor";
    if (distance <= distances.cull * bias) return "impostor";
    return "culled";
  }

  private applyBand(target: StoredTarget, band: SlimBand, previous: SlimBand): void {
    const composite = target.composite ?? target.impostor;
    const impostor = target.impostor ?? target.composite;
    setVisible(target.source, band === "source" || (!composite && !impostor && band !== "culled"));
    setVisible(target.composite, band === "composite");
    setVisible(target.impostor, band === "impostor" || (band === "composite" && !target.composite));
    if (band === "culled") {
      setVisible(target.source, false);
      setVisible(target.composite, false);
      setVisible(target.impostor, false);
    }
    if (band !== previous) target.onBandChange?.(band, previous);
  }
}

function normalizeDistances(distances: Partial<SlimDistances> | undefined): SlimDistances {
  const value = { ...DEFAULT_DISTANCES, ...distances };
  value.composite = Math.max(value.source + 1, value.composite);
  value.impostor = Math.max(value.composite + 1, value.impostor);
  value.cull = Math.max(value.impostor + 1, value.cull);
  return value;
}

function setVisible(object: SlimObject | undefined, visible: boolean): void {
  if (!object) return;
  object.visible = visible;
}

function readCameraPosition(runtime: RuntimeLike): Vec3 | null {
  const camera = runtime.renderer.getHandles().camera;
  if (!camera || typeof camera !== "object") return null;
  const position = (camera as { position?: unknown }).position;
  if (!position || typeof position !== "object") return null;
  const p = position as Record<string, unknown>;
  return {
    x: Number(p.x ?? 0),
    y: Number(p.y ?? 0),
    z: Number(p.z ?? 0)
  };
}

function distanceBetween(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
