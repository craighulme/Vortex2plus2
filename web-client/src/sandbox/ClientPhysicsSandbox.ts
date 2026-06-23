type RuntimeLike = {
  renderer: { getHandles(): { scene?: unknown } };
  world: { getLegacyHandles(): { getColliders?: unknown } };
  legacy: { getVortex(): unknown };
  slim?: {
    registerTarget?(target: {
      id: string;
      label?: string;
      source: ThreeObject;
      impostor?: ThreeObject;
      getCenter?: () => Vec3;
      radius?: number;
      distances?: { source?: number; composite?: number; impostor?: number; cull?: number };
      onBandChange?: (band: "source" | "composite" | "impostor" | "culled") => void;
    }): void;
    unregisterTarget?(id: string): void;
  };
  diagnostics: { warn(event: string, payload?: Record<string, unknown>): void };
};

type SandboxBall = {
  mesh: ThreeObject;
  velocity: Vec3;
  radius: number;
};

type StressBody = {
  position: Vec3;
  velocity: Vec3;
  half: Vec3;
  rotation: Vec3;
  angular: Vec3;
  hue: number;
  sleepFrames: number;
  sleeping: boolean;
};

type Vec3 = { x: number; y: number; z: number };
type DisposableMaterial = { dispose?(): void; map?: { dispose?(): void } };
type ThreeObject = {
  name?: string;
  visible?: boolean;
  position: Vec3 & { set(x: number, y: number, z: number): void };
  rotation?: Vec3;
  scale?: Vec3 & { set(x: number, y: number, z: number): void };
  geometry?: { dispose?(): void };
  material?: DisposableMaterial | DisposableMaterial[];
};
type StressMesh = ThreeObject & {
  count?: number;
  frustumCulled?: boolean;
  setMatrixAt(index: number, matrix: unknown): void;
  setColorAt?(index: number, color: unknown): void;
  instanceMatrix?: { needsUpdate?: boolean; setUsage?(usage: unknown): void };
  instanceColor?: { needsUpdate?: boolean };
};

type Collider = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export class ClientPhysicsSandbox {
  private readonly balls: SandboxBall[] = [];
  private readonly stressBodies: StressBody[] = [];
  private stressMesh: StressMesh | null = null;
  private stressImpostor: ThreeObject | null = null;
  private stressLodBand: "source" | "composite" | "impostor" | "culled" = "source";
  private stressRunning = false;
  private stressRate = 250;
  private stressAccumulator = 0;
  private stressCapacityReached = false;
  private lastUpdateAt = performance.now();
  private stressFrame = 0;
  private readonly stressCapacity = 15000;

  update(runtime: RuntimeLike): void {
    const now = performance.now();
    const dt = Math.min(0.033, Math.max(0, (now - this.lastUpdateAt) / 1000));
    this.lastUpdateAt = now;
    if (!dt) return;
    if (!this.balls.length && !this.stressRunning && !this.stressBodies.length) return;

    const colliders = this.readColliders(runtime);
    if (this.stressRunning) this.spawnStressBodies(runtime, dt);

    for (const ball of this.balls) {
      this.kickFromPlayer(runtime, ball);
      ball.velocity.y -= 68 * dt;
      ball.velocity.x *= Math.pow(0.985, dt * 60);
      ball.velocity.z *= Math.pow(0.985, dt * 60);
      ball.mesh.position.x += ball.velocity.x * dt;
      ball.mesh.position.y += ball.velocity.y * dt;
      ball.mesh.position.z += ball.velocity.z * dt;

      if (ball.mesh.rotation) {
        ball.mesh.rotation.x += ball.velocity.z * dt / Math.max(0.1, ball.radius);
        ball.mesh.rotation.z -= ball.velocity.x * dt / Math.max(0.1, ball.radius);
      }

      this.resolveWorld(ball, colliders);
    }

    if (this.stressBodies.length) {
      const THREE = readThree();
      this.stressFrame += 1;
      const shouldStepStress = this.shouldStepStress();
      if (shouldStepStress) {
        const stressColliders = this.selectStressColliders(runtime, colliders);
        for (const body of this.stressBodies) {
          const wokeFromPlayer = this.pushBoxFromPlayer(runtime, body);
          if (body.sleeping && !wokeFromPlayer) continue;
          if (wokeFromPlayer) body.sleeping = false;
          body.velocity.y -= 72 * dt;
          body.velocity.x *= Math.pow(0.992, dt * 60);
          body.velocity.z *= Math.pow(0.992, dt * 60);
          body.angular.x *= Math.pow(0.99, dt * 60);
          body.angular.y *= Math.pow(0.99, dt * 60);
          body.angular.z *= Math.pow(0.99, dt * 60);
          body.position.x += body.velocity.x * dt;
          body.position.y += body.velocity.y * dt;
          body.position.z += body.velocity.z * dt;
          body.rotation.x += body.angular.x * dt;
          body.rotation.y += body.angular.y * dt;
          body.rotation.z += body.angular.z * dt;
          this.resolveBoxWorld(body, stressColliders);
        }
      }
      for (const ball of this.balls) this.resolveBallStress(ball);
      if (THREE && this.stressLodBand === "source") this.updateStressMesh(THREE);
      this.updateStressImpostor();
    }
  }

  spawnFootball(runtime: RuntimeLike): boolean {
    const THREE = readThree();
    const scene = readScene(runtime);
    if (!THREE || !scene?.add) {
      runtime.diagnostics.warn("sandbox.spawnFootball.failed", { reason: "THREE scene not ready" });
      return false;
    }

    const origin = readPlayerSpawn(runtime);
    const geometry = new THREE.SphereGeometry(0.9, 32, 18);
    const materialOptions: Record<string, unknown> = { color: 0xffffff, shininess: 55 };
    const texture = createFootballTexture(THREE);
    if (texture) materialOptions.map = texture;
    const material = new THREE.MeshPhongMaterial(materialOptions);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "VortexWebSandboxFootball";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(origin.x, origin.y + 1.6, origin.z);
    scene.add(mesh);
    this.balls.push({ mesh, radius: 0.9, velocity: { x: 0, y: 3, z: 0 } });
    return true;
  }

  spawnStressField(runtime: RuntimeLike, count = 500): boolean {
    return this.startStress(runtime, count);
  }

  startStress(runtime: RuntimeLike, rate = 250): boolean {
    const THREE = readThree();
    const scene = readScene(runtime);
    if (!THREE || !scene?.add) {
      runtime.diagnostics.warn("sandbox.startStress.failed", { reason: "THREE scene not ready" });
      return false;
    }
    if (!this.stressMesh) this.createStressMesh(THREE, scene, runtime);
    this.stressRate = clamp(Math.floor(rate), 10, 500);
    this.stressRunning = true;
    this.stressCapacityReached = false;
    return true;
  }

  stopStress(): void {
    this.stressRunning = false;
    this.stressAccumulator = 0;
  }

  isActive(): boolean {
    return this.balls.length > 0 || this.stressRunning || this.stressBodies.length > 0;
  }

  private createStressMesh(THREE: any, scene: { add?(object: unknown): void }, runtime: RuntimeLike): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, this.stressCapacity) as StressMesh;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix?.setUsage?.(THREE.DynamicDrawUsage);
    mesh.name = "VortexWebInstancedStressField";
    scene.add?.(mesh);
    this.stressMesh = mesh;

    const impostorGeometry = new THREE.BoxGeometry(1, 1, 1);
    const impostorMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      wireframe: true
    });
    const impostor = new THREE.Mesh(impostorGeometry, impostorMaterial) as ThreeObject;
    impostor.name = "VortexWebStressSlimProxy";
    impostor.visible = false;
    scene.add?.(impostor);
    this.stressImpostor = impostor;

    runtime.slim?.registerTarget?.({
      id: "sandbox:stress",
      label: "Stress field",
      source: mesh,
      impostor,
      getCenter: () => this.estimateStressCenter(),
      radius: 42,
      distances: { source: 135, composite: 260, impostor: 520, cull: 980 },
      onBandChange: (band) => {
        this.stressLodBand = band;
      }
    });
  }

  clear(runtime: RuntimeLike): void {
    const scene = readScene(runtime);
    for (const ball of this.balls.splice(0)) {
      scene?.remove?.(ball.mesh);
      ball.mesh.geometry?.dispose?.();
      disposeMaterial(ball.mesh.material);
    }
    this.clearStressField(scene);
  }

  stats(): { balls: number; stressBodies: number; stressRunning: boolean; stressRate: number; stressCapacity: number } {
    return {
      balls: this.balls.length,
      stressBodies: this.stressBodies.length,
      stressRunning: this.stressRunning,
      stressRate: this.stressRate,
      stressCapacity: this.stressCapacity
    };
  }

  private clearStressField(scene: { remove?(object: unknown): void } | null): void {
    this.stressRunning = false;
    this.stressAccumulator = 0;
    this.stressBodies.splice(0);
    this.stressLodBand = "source";
    if (!this.stressMesh) return;
    this.stressMesh.visible = true;
    scene?.remove?.(this.stressImpostor);
    this.stressImpostor?.geometry?.dispose?.();
    disposeMaterial(this.stressImpostor?.material);
    this.stressImpostor = null;
    this.stressMesh.visible = true;
    // The runtime unregister is optional so older boot bundles can still call clear safely.
    (globalThis as typeof globalThis & { VortexRuntime?: RuntimeLike }).VortexRuntime?.slim?.unregisterTarget?.("sandbox:stress");
    scene?.remove?.(this.stressMesh);
    this.stressMesh.geometry?.dispose?.();
    disposeMaterial(this.stressMesh.material);
    this.stressMesh = null;
  }

  private readColliders(runtime: RuntimeLike): Collider[] {
    const getter = runtime.world.getLegacyHandles().getColliders;
    if (typeof getter !== "function") return [];
    try {
      const colliders = getter();
      return Array.isArray(colliders) ? colliders.filter(isCollider) : [];
    } catch {
      return [];
    }
  }

  private selectStressColliders(runtime: RuntimeLike, colliders: Collider[]): Collider[] {
    if (colliders.length <= 96) return colliders;
    const origin = readPlayerSpawn(runtime);
    const selected: Collider[] = [];
    for (const collider of colliders) {
      const cx = (collider.minX + collider.maxX) * 0.5;
      const cy = (collider.minY + collider.maxY) * 0.5;
      const cz = (collider.minZ + collider.maxZ) * 0.5;
      if (Math.abs(cx - origin.x) > 90 || Math.abs(cz - origin.z) > 90 || Math.abs(cy - origin.y) > 80) continue;
      selected.push(collider);
      if (selected.length >= 128) break;
    }
    return selected.length ? selected : colliders.slice(0, 96);
  }

  private kickFromPlayer(runtime: RuntimeLike, ball: SandboxBall): void {
    const legacy = runtime.legacy.getVortex();
    if (!legacy || typeof legacy !== "object") return;
    const getCharacter = (legacy as { getCharacter?: unknown }).getCharacter;
    if (typeof getCharacter !== "function") return;
    const character = getCharacter();
    const position = character?.position;
    if (!position) return;
    const dx = ball.mesh.position.x - Number(position.x || 0);
    const dy = ball.mesh.position.y - Number(position.y || 0);
    const dz = ball.mesh.position.z - Number(position.z || 0);
    const distSq = dx * dx + dz * dz;
    if (distSq > 5.8 || Math.abs(dy) > 3.2) return;
    const dist = Math.max(0.001, Math.sqrt(distSq));
    const impulse = 22;
    ball.velocity.x += (dx / dist) * impulse;
    ball.velocity.z += (dz / dist) * impulse;
    ball.velocity.y = Math.max(ball.velocity.y, 9);
  }

  private resolveBallStress(ball: SandboxBall): void {
    if (!this.stressBodies.length) return;
    const limit = ball.radius + 2.8;
    const limitSq = limit * limit;
    for (const body of this.stressBodies) {
      const dx = ball.mesh.position.x - body.position.x;
      const dy = ball.mesh.position.y - body.position.y;
      const dz = ball.mesh.position.z - body.position.z;
      if (dx * dx + dy * dy + dz * dz > limitSq) continue;
      const closestX = clamp(ball.mesh.position.x, body.position.x - body.half.x, body.position.x + body.half.x);
      const closestY = clamp(ball.mesh.position.y, body.position.y - body.half.y, body.position.y + body.half.y);
      const closestZ = clamp(ball.mesh.position.z, body.position.z - body.half.z, body.position.z + body.half.z);
      const sx = ball.mesh.position.x - closestX;
      const sy = ball.mesh.position.y - closestY;
      const sz = ball.mesh.position.z - closestZ;
      const distSq = sx * sx + sy * sy + sz * sz;
      if (distSq > ball.radius * ball.radius) continue;
      const dist = Math.max(0.0001, Math.sqrt(distSq));
      const nx = sx / dist || 0;
      const ny = sy / dist || 1;
      const nz = sz / dist || 0;
      const push = ball.radius - dist + 0.015;
      ball.mesh.position.x += nx * push;
      ball.mesh.position.y += ny * push;
      ball.mesh.position.z += nz * push;
      const dot = ball.velocity.x * nx + ball.velocity.y * ny + ball.velocity.z * nz;
      if (dot < 0) {
        ball.velocity.x -= 1.35 * dot * nx;
        ball.velocity.y -= 1.35 * dot * ny;
        ball.velocity.z -= 1.35 * dot * nz;
        body.velocity.x += ball.velocity.x * 0.055;
        body.velocity.y += Math.max(0, ball.velocity.y) * 0.025;
        body.velocity.z += ball.velocity.z * 0.055;
        body.angular.x += nz * 1.25;
        body.angular.z -= nx * 1.25;
        body.sleeping = false;
        body.sleepFrames = 0;
      }
    }
  }

  private pushBoxFromPlayer(runtime: RuntimeLike, body: StressBody): boolean {
    const player = readPlayerPosition(runtime);
    if (!player) return false;
    const dx = body.position.x - player.x;
    const dy = body.position.y - player.y;
    const dz = body.position.z - player.z;
    const radius = Math.max(1.4, body.half.x + body.half.z + 1.2);
    const distSq = dx * dx + dz * dz;
    if (distSq > radius * radius || Math.abs(dy) > 3.4) return false;
    const dist = Math.max(0.001, Math.sqrt(distSq));
    const impulse = 19 * (1 - Math.min(1, dist / radius));
    body.velocity.x += (dx / dist) * impulse;
    body.velocity.z += (dz / dist) * impulse;
    body.velocity.y = Math.max(body.velocity.y, 7);
    body.angular.x += dz * 0.35;
    body.angular.z -= dx * 0.35;
    body.sleepFrames = 0;
    return true;
  }

  private resolveWorld(ball: SandboxBall, colliders: Collider[]): void {
    if (ball.mesh.position.y < ball.radius) {
      ball.mesh.position.y = ball.radius;
      if (ball.velocity.y < 0) ball.velocity.y *= -0.58;
    }
    for (const collider of colliders) {
      const closestX = clamp(ball.mesh.position.x, collider.minX, collider.maxX);
      const closestY = clamp(ball.mesh.position.y, collider.minY, collider.maxY);
      const closestZ = clamp(ball.mesh.position.z, collider.minZ, collider.maxZ);
      const dx = ball.mesh.position.x - closestX;
      const dy = ball.mesh.position.y - closestY;
      const dz = ball.mesh.position.z - closestZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > ball.radius * ball.radius || distSq <= 0.000001) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const push = ball.radius - dist;
      ball.mesh.position.x += nx * push;
      ball.mesh.position.y += ny * push;
      ball.mesh.position.z += nz * push;
      const dot = ball.velocity.x * nx + ball.velocity.y * ny + ball.velocity.z * nz;
      if (dot < 0) {
        ball.velocity.x -= (1.55 * dot) * nx;
        ball.velocity.y -= (1.55 * dot) * ny;
        ball.velocity.z -= (1.55 * dot) * nz;
      }
    }
  }

  private spawnStressBodies(runtime: RuntimeLike, dt: number): void {
    if (this.stressBodies.length >= this.stressCapacity) {
      this.stressRunning = false;
      if (!this.stressCapacityReached) {
        this.stressCapacityReached = true;
        runtime.diagnostics.warn("sandbox.stress.capacity", { capacity: this.stressCapacity });
      }
      return;
    }

    this.stressAccumulator += this.stressRate * dt;
    const count = Math.min(
      Math.floor(this.stressAccumulator),
      this.stressCapacity - this.stressBodies.length,
      Math.ceil(this.stressRate / 12)
    );
    if (count <= 0) return;
    this.stressAccumulator -= count;
    const THREE = readThree();
    const color = THREE && this.stressMesh?.setColorAt ? new THREE.Color() : null;
    const origin = readPlayerSpawn(runtime);
    for (let i = 0; i < count; i += 1) {
      const size = {
        x: randomBetween(0.55, 1.65),
        y: randomBetween(0.45, 1.45),
        z: randomBetween(0.55, 1.65)
      };
      const bodyIndex = this.stressBodies.length;
      const hue = (bodyIndex * 0.037 + Math.random() * 0.08) % 1;
      this.stressBodies.push({
        position: {
          x: origin.x + randomBetween(-18, 18),
          y: origin.y + randomBetween(15, 42),
          z: origin.z + randomBetween(7, 38)
        },
        velocity: {
          x: randomBetween(-2.2, 2.2),
          y: randomBetween(-2, 2),
          z: randomBetween(-2.2, 2.2)
        },
        half: { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 },
        rotation: {
          x: randomBetween(0, Math.PI),
          y: randomBetween(0, Math.PI),
          z: randomBetween(0, Math.PI)
        },
        angular: {
          x: randomBetween(-3.2, 3.2),
          y: randomBetween(-3.2, 3.2),
          z: randomBetween(-3.2, 3.2)
        },
        hue,
        sleepFrames: 0,
        sleeping: false
      });
      if (color && this.stressMesh?.setColorAt) {
        color.setHSL(hue, 0.82, 0.58);
        this.stressMesh.setColorAt(bodyIndex, color);
      }
    }
    if (this.stressMesh?.instanceColor) this.stressMesh.instanceColor.needsUpdate = true;
  }

  private resolveBoxWorld(body: StressBody, colliders: Collider[]): void {
    let touchingGround = false;
    if (body.position.y - body.half.y < 0) {
      body.position.y = body.half.y;
      if (body.velocity.y < 0) body.velocity.y *= -0.38;
      body.velocity.x *= 0.86;
      body.velocity.z *= 0.86;
      body.angular.x *= 0.72;
      body.angular.z *= 0.72;
      touchingGround = true;
    }

    for (const collider of colliders) {
      const minX = body.position.x - body.half.x;
      const maxX = body.position.x + body.half.x;
      const minY = body.position.y - body.half.y;
      const maxY = body.position.y + body.half.y;
      const minZ = body.position.z - body.half.z;
      const maxZ = body.position.z + body.half.z;
      if (
        maxX < collider.minX || minX > collider.maxX ||
        maxY < collider.minY || minY > collider.maxY ||
        maxZ < collider.minZ || minZ > collider.maxZ
      ) {
        continue;
      }

      const pushLeft = collider.maxX - minX;
      const pushRight = maxX - collider.minX;
      const pushDown = collider.maxY - minY;
      const pushUp = maxY - collider.minY;
      const pushBack = collider.maxZ - minZ;
      const pushForward = maxZ - collider.minZ;
      const axis = smallestPush([
        { axis: "x", amount: Math.min(pushLeft, pushRight), sign: pushLeft < pushRight ? 1 : -1 },
        { axis: "y", amount: Math.min(pushDown, pushUp), sign: pushDown < pushUp ? 1 : -1 },
        { axis: "z", amount: Math.min(pushBack, pushForward), sign: pushBack < pushForward ? 1 : -1 }
      ]);

      if (axis.axis === "x") {
        body.position.x += axis.amount * axis.sign;
        if (body.velocity.x * axis.sign < 0) body.velocity.x *= -0.34;
        body.angular.z += body.velocity.x * 0.04;
      } else if (axis.axis === "y") {
        body.position.y += axis.amount * axis.sign;
        if (body.velocity.y * axis.sign < 0) body.velocity.y *= -0.34;
        if (axis.sign > 0) {
          body.velocity.x *= 0.82;
          body.velocity.z *= 0.82;
          touchingGround = true;
        }
      } else {
        body.position.z += axis.amount * axis.sign;
        if (body.velocity.z * axis.sign < 0) body.velocity.z *= -0.34;
        body.angular.x -= body.velocity.z * 0.04;
      }
    }

    const linear = Math.abs(body.velocity.x) + Math.abs(body.velocity.y) + Math.abs(body.velocity.z);
    const angular = Math.abs(body.angular.x) + Math.abs(body.angular.y) + Math.abs(body.angular.z);
    if (touchingGround && linear < 0.12 && angular < 0.18) {
      body.sleepFrames += 1;
      if (body.sleepFrames > 18) {
        body.sleeping = true;
        body.velocity.x = 0;
        body.velocity.y = 0;
        body.velocity.z = 0;
        body.angular.x = 0;
        body.angular.y = 0;
        body.angular.z = 0;
      }
    } else {
      body.sleepFrames = 0;
    }
  }

  private updateStressMesh(THREE: any): void {
    if (!this.stressMesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const count = this.stressBodies.length;
    this.stressMesh.count = count;
    for (let i = 0; i < count; i += 1) {
      const body = this.stressBodies[i];
      if (!body) continue;
      position.set(body.position.x, body.position.y, body.position.z);
      scale.set(body.half.x * 2, body.half.y * 2, body.half.z * 2);
      euler.set(body.rotation.x, body.rotation.y, body.rotation.z);
      quaternion.setFromEuler(euler);
      matrix.compose(position, quaternion, scale);
      this.stressMesh.setMatrixAt(i, matrix);
    }
    if (this.stressMesh.instanceMatrix) this.stressMesh.instanceMatrix.needsUpdate = true;
  }

  private shouldStepStress(): boolean {
    if (this.stressLodBand === "source") return true;
    if (this.stressLodBand === "composite") return this.stressFrame % 2 === 0;
    if (this.stressLodBand === "impostor") return this.stressFrame % 8 === 0;
    return false;
  }

  private estimateStressCenter(): Vec3 {
    if (!this.stressBodies.length) {
      const runtime = (globalThis as typeof globalThis & { VortexRuntime?: RuntimeLike }).VortexRuntime;
      return runtime ? readPlayerSpawn(runtime) : { x: 0, y: 8, z: 0 };
    }
    let x = 0;
    let y = 0;
    let z = 0;
    const stride = Math.max(1, Math.floor(this.stressBodies.length / 96));
    let count = 0;
    for (let i = 0; i < this.stressBodies.length; i += stride) {
      const body = this.stressBodies[i];
      if (!body) continue;
      x += body.position.x;
      y += body.position.y;
      z += body.position.z;
      count += 1;
    }
    return count ? { x: x / count, y: y / count, z: z / count } : { x: 0, y: 0, z: 0 };
  }

  private updateStressImpostor(): void {
    if (!this.stressImpostor || !this.stressBodies.length) return;
    const center = this.estimateStressCenter();
    this.stressImpostor.position.set(center.x, center.y, center.z);
    let maxX = 1;
    let maxY = 1;
    let maxZ = 1;
    const stride = Math.max(1, Math.floor(this.stressBodies.length / 128));
    for (let i = 0; i < this.stressBodies.length; i += stride) {
      const body = this.stressBodies[i];
      if (!body) continue;
      maxX = Math.max(maxX, Math.abs(body.position.x - center.x) + body.half.x);
      maxY = Math.max(maxY, Math.abs(body.position.y - center.y) + body.half.y);
      maxZ = Math.max(maxZ, Math.abs(body.position.z - center.z) + body.half.z);
    }
    this.stressImpostor.scale?.set(maxX * 2, maxY * 2, maxZ * 2);
  }
}

function readThree(): any {
  return (globalThis as typeof globalThis & { THREE?: unknown }).THREE;
}

function readScene(runtime: RuntimeLike): { add?(object: unknown): void; remove?(object: unknown): void } | null {
  const scene = runtime.renderer.getHandles().scene;
  return scene && typeof scene === "object" ? scene as { add?(object: unknown): void; remove?(object: unknown): void } : null;
}

function readPlayerSpawn(runtime: RuntimeLike): Vec3 {
  const transform = readPlayerTransform(runtime);
  if (transform) {
    return {
      x: transform.x + Math.sin(transform.rotationY) * 5,
      y: transform.y,
      z: transform.z + Math.cos(transform.rotationY) * 5
    };
  }
  return { x: 0, y: 8, z: 0 };
}

function readPlayerPosition(runtime: RuntimeLike): Vec3 | null {
  const transform = readPlayerTransform(runtime);
  return transform ? { x: transform.x, y: transform.y, z: transform.z } : null;
}

function readPlayerTransform(runtime: RuntimeLike): (Vec3 & { rotationY: number }) | null {
  const legacy = runtime.legacy.getVortex();
  if (legacy && typeof legacy === "object") {
    const getCharacter = (legacy as { getCharacter?: unknown }).getCharacter;
    if (typeof getCharacter === "function") {
      const ch = getCharacter();
      if (ch?.position) {
        const ry = Number(ch.rotation?.y || 0);
        return {
          x: Number(ch.position.x || 0),
          y: Number(ch.position.y || 4),
          z: Number(ch.position.z || 0),
          rotationY: ry
        };
      }
    }
  }
  return null;
}

function disposeMaterial(material: ThreeObject["material"]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.map?.dispose?.();
      item.dispose?.();
    }
  } else {
    material?.map?.dispose?.();
    material?.dispose?.();
  }
}

function createFootballTexture(THREE: any): unknown | null {
  if (typeof document === "undefined" || !THREE?.CanvasTexture) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 4;
  for (let y = -32; y < 160; y += 64) {
    for (let x = -24; x < 296; x += 72) {
      drawPatch(ctx, x, y, 19);
      ctx.beginPath();
      ctx.moveTo(x + 19, y);
      ctx.lineTo(x + 53, y + 18);
      ctx.lineTo(x + 48, y + 52);
      ctx.lineTo(x + 13, y + 52);
      ctx.lineTo(x + 8, y + 18);
      ctx.closePath();
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat?.set?.(1.6, 1);
  return texture;
}

function drawPatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#111827";
  ctx.fill();
}

function isCollider(value: unknown): value is Collider {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return ["minX", "maxX", "minY", "maxY", "minZ", "maxZ"].every((key) => Number.isFinite(Number(c[key])));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function smallestPush(values: Array<{ axis: "x" | "y" | "z"; amount: number; sign: number }>): { axis: "x" | "y" | "z"; amount: number; sign: number } {
  let best = values[0] ?? { axis: "y" as const, amount: 0, sign: 1 };
  for (const value of values) {
    if (value.amount < best.amount) best = value;
  }
  return best;
}
