type RaycasterLike = {
  setFromCamera(mouse: unknown, camera: unknown): void;
  intersectObjects(objects: unknown[]): Array<{
    point: unknown;
    face?: { normal?: unknown };
    object: unknown;
  }>;
};

type VectorLike = {
  x: number;
  y: number;
};

type ThreePickingDeps = {
  Raycaster: new () => RaycasterLike;
  Vector3: new () => VectorLike;
};

export type PickResult = [unknown, unknown, unknown];

export class WorldPickingService {
  private raycaster: RaycasterLike | null = null;
  private THREE: ThreePickingDeps | null = null;

  configure(THREE: ThreePickingDeps): this {
    this.THREE = THREE;
    this.raycaster = new THREE.Raycaster();
    return this;
  }

  pick(camera: unknown, objects: unknown[], cursorX: number, cursorY: number, width: number, height: number): PickResult {
    const THREE = this.assertConfigured();
    const raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster = raycaster;
    const mouse = new THREE.Vector3();
    mouse.x = ((cursorX / width) * 2) - 1;
    mouse.y = -(((cursorY / height) * 2) - 1);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    const first = intersects[0];
    if (first) {
      return [first.point, first.face?.normal || false, first.object];
    }
    return [false, false, false];
  }

  private assertConfigured(): ThreePickingDeps {
    if (!this.THREE) throw new Error("WorldPickingService is not configured");
    return this.THREE;
  }
}
