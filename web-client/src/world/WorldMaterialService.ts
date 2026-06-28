type MaterialLike = {
  castShadow?: boolean;
  uuid?: string;
  userData?: Record<string, unknown>;
};

type MaterialSet = MaterialLike | MaterialLike[];

type ThreeMaterialDeps = {
  MeshStandardMaterial: new (options: Record<string, unknown>) => MaterialLike;
};

type WorldMaterialConfig = {
  THREE: ThreeMaterialDeps;
  studsPerTile: number;
  applyStudTextures: (material: MaterialLike) => void;
};

export class WorldMaterialService {
  private THREE: ThreeMaterialDeps | null = null;
  private studsPerTile = 4;
  private applyStudTextures: (material: MaterialLike) => void = () => {};
  private readonly materialCache = new Map<string, MaterialSet>();

  configure(config: WorldMaterialConfig): this {
    this.THREE = config.THREE;
    this.studsPerTile = config.studsPerTile || 4;
    this.applyStudTextures = config.applyStudTextures;
    return this;
  }

  getCachedMaterials(sw: number, sh: number, sd: number, color: number, shape = "Block", transparency = 0): MaterialSet | undefined {
    if (shape === "Block" || shape === "Wedge" || shape === "CornerWedge" || shape === "Cylinder" || shape === "Cylinder2") {
      const key = `c${color}t${transparency}s${shape}`;
      if (this.materialCache.has(key)) return this.materialCache.get(key);
      const materials = shape === "Block"
        ? this.createTopStudMaterialSet(1 / this.studsPerTile, 1 / this.studsPerTile, color, transparency)
        : this.createSmoothMaterial(color, transparency);
      this.applyShadowPolicy(materials, transparency);
      this.materialCache.set(key, materials);
      return materials;
    }
    if (shape === "Ball") {
      const radi = Math.min(sw, sh, sd);
      const key = `s${shape},r${radi},c${color}t${transparency}`;
      if (this.materialCache.has(key)) return this.materialCache.get(key);
      const material = this.createSmoothMaterial(color, transparency);
      this.applyShadowPolicy(material, transparency);
      this.materialCache.set(key, material);
      return material;
    }
    return undefined;
  }

  refreshStudTextures(): void {
    for (const cached of this.materialCache.values()) {
      for (const material of asMaterialArray(cached)) {
        if (material.userData?.vwebStudMaterial) this.applyStudTextures(material);
      }
    }
  }

  snapshot(): { materials: number; keys: string[] } {
    return {
      materials: this.materialCache.size,
      keys: [...this.materialCache.keys()]
    };
  }

  private createStudMaterial(rx: number, ry: number, color: number, transparency = 0): MaterialLike {
    const material = this.createSmoothMaterial(color, transparency);
    material.userData = {
      ...(material.userData || {}),
      vwebStudMaterial: { rx, ry },
      vwebFaceStyle: "stud-top"
    };
    this.applyStudTextures(material);
    return material;
  }

  private createSmoothMaterial(color: number, transparency = 0): MaterialLike {
    const THREE = this.assertConfigured();
    return new THREE.MeshStandardMaterial({
      color,
      transparent: transparency > 0,
      opacity: 1 - transparency,
      fog: true,
      roughness: 0.46,
      metalness: 0
    });
  }

  private createTopStudMaterialSet(rx: number, ry: number, color: number, transparency = 0): MaterialLike[] {
    const smooth = this.createSmoothMaterial(color, transparency);
    smooth.userData = { ...(smooth.userData || {}), vwebFaceStyle: "smooth" };
    const top = this.createStudMaterial(rx, ry, color, transparency);
    // BoxGeometry material order is +x, -x, +y, -y, +z, -z. Only +y should carry studs.
    const materials = [smooth, smooth, top, smooth, smooth, smooth];
    (materials as MaterialLike[] & { uuid?: string }).uuid = materials.map((material, index) => material.uuid || `m${index}`).join("|");
    return materials;
  }

  private applyShadowPolicy(materials: MaterialSet, transparency: number): void {
    if (transparency <= 0.7) return;
    for (const material of asMaterialArray(materials)) material.castShadow = false;
  }

  private assertConfigured(): ThreeMaterialDeps {
    if (!this.THREE) throw new Error("WorldMaterialService is not configured");
    return this.THREE;
  }
}

function asMaterialArray(materials: MaterialSet): MaterialLike[] {
  return Array.isArray(materials) ? materials : [materials];
}
