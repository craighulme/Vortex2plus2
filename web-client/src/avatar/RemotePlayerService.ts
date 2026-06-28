import type { LegacyAvatarState } from "./AvatarService";

export type RemotePlayerMeshes = {
  grp: LegacyObject3D;
  proxy?: LegacyObject3D | null;
  bones: Record<string, LegacyBone>;
  rest: Record<string, LegacyBoneRest>;
  shirtMesh?: unknown;
  pantsMesh?: unknown;
  faceMesh?: unknown;
  nameSprite?: LegacySprite;
};

type RemotePlayerServiceConfig = {
  THREE: ThreeLike;
  document: Document;
  vortex: LegacyVortexApi;
};

type LegacyVortexApi = {
  scene: { add(object: unknown): void; remove(object: unknown): void };
  getCharacter(): LegacyObject3D | null;
  getAnimRest(): Record<string, LegacyBoneRest>;
  getCharFootOffset(): number;
  getCharHeight(): number;
  buildShirtOverlay(group: LegacyObject3D): unknown;
  buildPantsOverlay?: (group: LegacyObject3D) => unknown;
  buildFaceOverlay?: (group: LegacyObject3D) => unknown;
  applyAvatarToMeshes?: (meshes: RemotePlayerMeshes, avatar: RemoteAvatarContext) => void;
};

type LegacyObject3D = {
  name?: string;
  type?: string;
  isBone?: boolean;
  isMesh?: boolean;
  isSkinnedMesh?: boolean;
  isSprite?: boolean;
  visible?: boolean;
  parent?: { remove?(object: unknown): void };
  userData: Record<string, unknown>;
  material?: LegacyMaterial | LegacyMaterial[];
  geometry?: unknown;
  castShadow?: boolean;
  receiveShadow?: boolean;
  skeleton?: { bones: LegacyBone[]; boneInverses: Array<{ clone(): unknown }> };
  bindMatrix?: { clone(): unknown };
  rotation: { y?: number; set?(x: number, y: number, z: number): void };
  position: LegacyVector3;
  clone(recursive?: boolean): LegacyObject3D;
  traverse(visitor: (object: LegacyObject3D) => void): void;
  bind?(skeleton: unknown, bindMatrix: unknown): void;
  add?(object: unknown): void;
  scale?: { set?(x: number, y: number, z: number): void };
};

type LegacyBone = LegacyObject3D & {
  rotation: { set?(x: number, y: number, z: number): void } & Record<string, number>;
  position: LegacyVector3;
};

type LegacyVector3 = {
  x?: number;
  y: number;
  z?: number;
  clone?(): LegacyVector3;
  copy?(value: LegacyVector3): void;
  lerp?(value: LegacyVector3, alpha: number): void;
  set?(x: number, y: number, z: number): void;
};

type LegacyBoneRest = {
  x?: number;
  y?: number;
  z?: number;
  py?: number;
};

type LegacyMaterial = {
  clone?(): LegacyMaterial;
  dispose?(): void;
  map?: { dispose?(): void };
};

type LegacySprite = LegacyObject3D & {
  material?: LegacyMaterial;
  scale: { set(x: number, y: number, z: number): void };
};

type ThreeLike = {
  Group?: new () => LegacyObject3D;
  Mesh?: new (geometry: unknown, material: unknown) => LegacyObject3D;
  BoxGeometry?: new (x: number, y: number, z: number) => unknown;
  MeshStandardMaterial?: new (options: Record<string, unknown>) => LegacyMaterial;
  Skeleton: new (bones: LegacyBone[], boneInverses: unknown[]) => unknown;
  CanvasTexture: new (canvas: HTMLCanvasElement) => unknown;
  SpriteMaterial: new (options: Record<string, unknown>) => LegacyMaterial;
  Sprite: new (material: LegacyMaterial) => LegacySprite;
  Box3?: new () => LegacyBox3;
};

type LegacyBox3 = {
  setFromObject(object: unknown): LegacyBox3;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
};

export type RemotePlayerRecord = {
  id?: unknown;
  avatar?: LegacyAvatarState;
  username?: string;
  is_staff?: unknown;
  is_booster?: unknown;
  meshes?: RemotePlayerMeshes | null | undefined;
  hasPosition?: boolean;
  tPos?: LegacyVector3 | undefined;
  tRy?: number;
  seen?: number;
  anim?: string;
  animTime?: number;
  lastAnimationAt?: number;
  animationAccumulator?: number;
  lastAnimationName?: string;
};

export type RemoteAvatarContext = LegacyAvatarState & {
  id?: unknown;
  playerId?: unknown;
  username?: string;
};

export type RemoteRenderProfile = {
  totals: {
    remotes: number;
    visible: number;
    meshes: number;
    skinnedMeshes: number;
    sprites: number;
    materials: number;
    uniqueGeometries: number;
    uniqueTextures: number;
    shadowCasters: number;
    shadowReceivers: number;
    animatedActive: number;
  };
  rows: RemoteRenderProfileRow[];
};

export type RemoteRenderProfileRow = {
  id: string;
  username: string;
  visible: boolean;
  meshes: number;
  skinnedMeshes: number;
  sprites: number;
  materials: number;
  uniqueGeometries: number;
  uniqueTextures: number;
  shadowCasters: number;
  shadowReceivers: number;
  anim: string;
  ageMs: number | null;
  positionY: number | null;
  visualMinY: number | null;
  visualMaxY: number | null;
  visualFootDelta: number | null;
};

type RemotePlayerFrameOptions = {
  remotes: Map<unknown, RemotePlayerRecord>;
  pendingAvatars: Map<unknown, Record<string, unknown>>;
  dt: number;
  now?: number;
  shouldAnimate?: boolean;
  normalizeAvatar: (input: Record<string, unknown>) => LegacyAvatarState;
  displayName: (id: unknown, username: unknown) => string;
  noteState: (remote: RemotePlayerRecord, status: string, reason: string) => void;
  animate: (id: unknown, remote: RemotePlayerRecord, dt: number) => void;
  onCreateError?: (error: unknown) => void;
  cameraPosition?: { x?: unknown; y?: unknown; z?: unknown } | null;
};

type RemotePlayerFrameSnapshot = {
  created: number;
  updated: number;
  hidden: number;
  shadowCasters: number;
  pendingCleared: boolean;
};

type RemotePlayerRebuildSnapshot = {
  rebuilt: number;
  failed: number;
};

const REMOTE_LERP = 12;
const REMOTE_STALE_MS = 5000;

export class RemotePlayerService {
  private config: RemotePlayerServiceConfig | null = null;
  private created = 0;
  private disposed = 0;
  private lastBudget: RemoteRenderBudgetSnapshot = emptyBudgetSnapshot();
  private proxyResources: RemoteProxyResources | null = null;

  configure(config: RemotePlayerServiceConfig): this {
    this.config = config;
    return this;
  }

  makeRemote(username: string, _id: number, avatar: LegacyAvatarState): RemotePlayerMeshes | null {
    const config = this.assertConfigured();
    const group = this.cloneLocalPlayer();
    if (!group) return null;
    const proxy = this.createRemoteProxy(avatar);

    const nameSprite = this.createNameLabel(username);
    nameSprite.position.y = this.nameLabelY();
    group.add?.(nameSprite);

    const bones: Record<string, LegacyBone> = {};
    group.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as LegacyBone;
      bones[bone.name || ""] = bone;
      bones[boneAlias(bone.name)] = bone;
    });

    const meshes: RemotePlayerMeshes = {
      grp: group,
      proxy,
      bones,
      rest: config.vortex.getAnimRest(),
      shirtMesh: config.vortex.buildShirtOverlay(group),
      pantsMesh: config.vortex.buildPantsOverlay?.(group),
      faceMesh: config.vortex.buildFaceOverlay?.(group),
      nameSprite
    };
    config.vortex.applyAvatarToMeshes?.(meshes, withRemoteAvatarContext(avatar, _id, username));
    this.created += 1;
    return meshes;
  }

  setNameLabel(remote: { meshes?: RemotePlayerMeshes | null } | null | undefined, username: string): void {
    if (!remote?.meshes?.grp) return;
    const oldSprite = remote.meshes.nameSprite;
    if (oldSprite) this.disposeSprite(oldSprite);
    const sprite = this.createNameLabel(username);
    sprite.position.y = this.nameLabelY();
    remote.meshes.grp.add?.(sprite);
    remote.meshes.nameSprite = sprite;
  }

  disposeRemote(meshes: RemotePlayerMeshes | null | undefined): void {
    if (!meshes?.grp) return;
    const { vortex } = this.assertConfigured();
    vortex.scene.remove(meshes.grp);
    if (meshes.proxy) vortex.scene.remove(meshes.proxy);
    this.safeTraverse(meshes.grp, (object) => {
      if (object.isSprite) this.disposeSprite(object as LegacySprite);
    });
    if (meshes.nameSprite) this.disposeSprite(meshes.nameSprite);
    this.disposed += 1;
  }

  cloneLocalPlayer(): LegacyObject3D | null {
    return this.clonePlayer();
  }

  updateFrame(options: RemotePlayerFrameOptions): RemotePlayerFrameSnapshot {
    this.assertConfigured();
    let created = 0;
    let updated = 0;
    let hidden = 0;
    let pendingCleared = false;
    let shadowCasters = 0;

    if (options.pendingAvatars.size > 0 && this.config?.vortex.getCharacter()) {
      for (const [id, info] of options.pendingAvatars) {
        const remote = options.remotes.get(id);
        if (!remote || remote.meshes) continue;
        try {
          remote.avatar = options.normalizeAvatar(info);
          remote.username = options.displayName(id, info.username || remote.username);
          remote.meshes = this.makeRemote(remote.username, Number(id), remote.avatar);
          if (remote.meshes) {
            created += 1;
            this.syncCreatedRemote(remote);
          }
        } catch (error) {
          options.onCreateError?.(error);
        }
      }
      options.pendingAvatars.clear();
      pendingCleared = true;
    }

    const now = options.now ?? performance.now();
    for (const [id, remote] of options.remotes) {
      if (!remote.meshes) continue;
      const group = remote.meshes.grp;
      if (!remote.hasPosition || !remote.tPos) {
        options.noteState(remote, "hidden", "no-position");
        group.visible = false;
        if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
        hidden += 1;
        continue;
      }
      if (now - Number(remote.seen || 0) > REMOTE_STALE_MS) {
        options.noteState(remote, "hidden", "stale-position");
        group.visible = false;
        if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
        hidden += 1;
        continue;
      }

      group.position.lerp?.(remote.tPos, Math.min(1, REMOTE_LERP * options.dt));
      this.rotateTowards(group, Number(remote.tRy || 0), options.dt);
      this.syncProxyTransform(remote);
      if (options.shouldAnimate) {
        const animationDt = this.consumeAnimationDelta(remote, options.dt, now);
        if (animationDt > 0) options.animate(id, remote, animationDt);
      }
      updated += 1;
    }

    if (options.cameraPosition) {
      this.lastBudget = this.updateRenderBudget(options.remotes, options.cameraPosition);
      shadowCasters = this.lastBudget.shadowCasters;
    }

    return { created, updated, hidden, shadowCasters, pendingCleared };
  }

  rebuildAll(options: {
    remotes: Map<unknown, RemotePlayerRecord>;
    normalizeAvatar: (input: Record<string, unknown>) => LegacyAvatarState;
    onError?: (error: unknown) => void;
  }): RemotePlayerRebuildSnapshot {
    let rebuilt = 0;
    let failed = 0;
    for (const [id, remote] of options.remotes) {
      const old = remote.meshes;
      const visible = old?.grp?.visible;
      const position = old?.grp?.position?.clone?.();
      const yaw = old?.grp?.rotation?.y;
      this.disposeRemote(old);
      remote.meshes = null;
      try {
        const avatar = options.normalizeAvatar(remote.avatar || {});
        remote.avatar = avatar;
        remote.meshes = this.makeRemote(remote.username || String(id), Number(id), avatar);
        if (remote.meshes) {
          if (position) remote.meshes.grp.position.copy?.(position);
          if (Number.isFinite(yaw)) remote.meshes.grp.rotation.y = Number(yaw);
          remote.meshes.grp.visible = Boolean(visible);
          rebuilt += 1;
        }
      } catch (error) {
        failed += 1;
        options.onError?.(error);
      }
    }
    return { rebuilt, failed };
  }

  snapshot(): { configured: boolean; created: number; disposed: number } {
    return {
      configured: Boolean(this.config),
      created: this.created,
      disposed: this.disposed
    };
  }

  profile(remotes: Map<unknown, RemotePlayerRecord> | null | undefined, now = performance.now()): RemoteRenderProfile & { budget: RemoteRenderBudgetSnapshot } {
    const rows: RemoteRenderProfileRow[] = [];
    const totals = {
      remotes: 0,
      visible: 0,
      meshes: 0,
      skinnedMeshes: 0,
      sprites: 0,
      materials: 0,
      uniqueGeometries: 0,
      uniqueTextures: 0,
      shadowCasters: 0,
      shadowReceivers: 0,
      animatedActive: 0
    };

    for (const [id, remote] of remotes || []) {
      totals.remotes += 1;
      const row = this.profileRemote(String(id), remote, now);
      rows.push(row);
      if (row.visible) totals.visible += 1;
      totals.meshes += row.meshes;
      totals.skinnedMeshes += row.skinnedMeshes;
      totals.sprites += row.sprites;
      totals.materials += row.materials;
      totals.uniqueGeometries += row.uniqueGeometries;
      totals.uniqueTextures += row.uniqueTextures;
      totals.shadowCasters += row.shadowCasters;
      totals.shadowReceivers += row.shadowReceivers;
      if (row.anim && row.anim !== "idle") totals.animatedActive += 1;
    }

    rows.sort((a, b) => b.meshes + b.materials - (a.meshes + a.materials));
    return { totals, rows, budget: { ...this.lastBudget } };
  }

  private clonePlayer(): LegacyObject3D | null {
    const { THREE, vortex } = this.assertConfigured();
    const source = vortex.getCharacter();
    if (!source) return null;
    const clone = source.clone(true);
    clone.userData = clone.userData || {};
    delete clone.userData.vwebModernAvatarMaterials;

    const toRemove: LegacyObject3D[] = [];
    clone.traverse((object) => {
      if (/Overlay$/.test(object.name || "")) toRemove.push(object);
      if (object.userData) delete object.userData.vwebModernAvatarMaterials;
    });
    for (const object of toRemove) object.parent?.remove?.(object);

    clone.traverse((object) => {
      if (!object.isMesh) return;
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material?.clone ? material.clone() : material);
      } else if (object.material?.clone) {
        object.material = object.material.clone();
      }
      if (object.userData) {
        delete object.userData.vwebClonedBodyMaterials;
        delete object.userData.vwebClonedBodyMaterial;
      }
    });

    const sourceBones: Record<string, LegacyBone> = {};
    const cloneBones: Record<string, LegacyBone> = {};
    source.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as LegacyBone;
      sourceBones[bone.name || ""] = bone;
      sourceBones[boneAlias(bone.name)] = bone;
    });
    clone.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as LegacyBone;
      cloneBones[bone.name || ""] = bone;
      cloneBones[boneAlias(bone.name)] = bone;
    });

    const sourceMeshes: LegacyObject3D[] = [];
    const cloneMeshes: LegacyObject3D[] = [];
    source.traverse((mesh) => {
      if (mesh.isSkinnedMesh) sourceMeshes.push(mesh);
    });
    clone.traverse((mesh) => {
      if (mesh.isSkinnedMesh) cloneMeshes.push(mesh);
    });
    sourceMeshes.forEach((sourceMesh, index) => {
      const cloneMesh = cloneMeshes[index];
      if (!cloneMesh?.skeleton || !sourceMesh.skeleton || !sourceMesh.bindMatrix) return;
      const bones = sourceMesh.skeleton.bones.map((bone) => cloneBones[bone.name || ""] || cloneBones[boneAlias(bone.name)] || bone);
      const skeleton = new THREE.Skeleton(bones, sourceMesh.skeleton.boneInverses.map((matrix) => matrix.clone()));
      (cloneMesh as { skeleton: unknown }).skeleton = skeleton;
      cloneMesh.bind?.(skeleton, sourceMesh.bindMatrix.clone());
    });

    const rest = vortex.getAnimRest();
    clone.traverse((node) => {
      if (!isBone(node)) return;
      const bone = node as LegacyBone;
      const pose = rest[bone.name || ""] || rest[boneAlias(bone.name)];
      if (!pose) return;
      bone.rotation.set?.(Number(pose.x || 0), Number(pose.y || 0), Number(pose.z || 0));
      bone.position.y = Number(pose.py || 0);
    });

    clone.rotation.set?.(0, Math.PI, 0);
    clone.traverse((object) => {
      if (object.isMesh) (object as LegacyObject3D & { castShadow?: boolean }).castShadow = true;
    });
    clone.visible = false;
    vortex.scene.add(clone);
    return clone;
  }

  private createNameLabel(username: string): LegacySprite {
    const { THREE, document } = this.assertConfigured();
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 80;
    const context = canvas.getContext("2d");
    if (context) {
      context.font = "bold 44px system-ui,sans-serif";
      context.textAlign = "center";
      context.strokeStyle = "rgba(0,0,0,0.9)";
      context.lineWidth = 6;
      context.strokeText(username, 256, 58);
      context.fillStyle = "#fff";
      context.fillText(username, 256, 58);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      depthTest: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 0.625, 1);
    return sprite;
  }

  private disposeSprite(sprite: LegacySprite): void {
    sprite.parent?.remove?.(sprite);
    sprite.material?.map?.dispose?.();
    sprite.material?.dispose?.();
  }

  private safeTraverse(root: LegacyObject3D, visitor: (object: LegacyObject3D) => void): void {
    try {
      if (typeof root.traverse === "function") {
        root.traverse(visitor);
        return;
      }
    } catch {
      // A partially cloned Three object can have a malformed child graph; disposal should stay best-effort.
    }
    visitor(root);
  }

  private nameLabelY(): number {
    const { vortex } = this.assertConfigured();
    return vortex.getCharHeight() - vortex.getCharFootOffset() + 1.4;
  }

  private syncCreatedRemote(remote: RemotePlayerRecord): void {
    if (!remote.meshes) return;
    if (remote.hasPosition && remote.tPos) {
      remote.meshes.grp.position.copy?.(remote.tPos);
      remote.meshes.grp.rotation.y = Number(remote.tRy || 0);
      remote.meshes.grp.visible = true;
      if (remote.meshes.proxy) {
        remote.meshes.proxy.position.copy?.(remote.tPos);
        remote.meshes.proxy.rotation.y = Number(remote.tRy || 0);
        remote.meshes.proxy.visible = false;
      }
    } else {
      remote.meshes.grp.visible = false;
      if (remote.meshes.proxy) remote.meshes.proxy.visible = false;
    }
  }

  private rotateTowards(group: LegacyObject3D, targetYaw: number, dt: number): void {
    const currentYaw = Number(group.rotation.y || 0);
    let deltaYaw = targetYaw - currentYaw;
    deltaYaw = ((deltaYaw % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    group.rotation.y = currentYaw + deltaYaw * Math.min(1, REMOTE_LERP * dt);
    if (group.rotation.y > Math.PI) group.rotation.y -= 2 * Math.PI;
    else if (group.rotation.y < -Math.PI) group.rotation.y += 2 * Math.PI;
  }

  private consumeAnimationDelta(remote: RemotePlayerRecord, dt: number, now: number): number {
    const frameDt = Math.max(0, Number(dt) || 0);
    if (frameDt <= 0) return 0;
    const anim = String(remote.anim || "idle");
    if (remote.lastAnimationName !== anim) {
      remote.lastAnimationName = anim;
      remote.lastAnimationAt = now;
      remote.animationAccumulator = 0;
      return frameDt;
    }
    const intervalMs = remoteAnimationIntervalMs(anim);
    const lastAt = Number(remote.lastAnimationAt || 0);
    if (!lastAt || now - lastAt >= intervalMs) {
      const accumulated = Number(remote.animationAccumulator || 0) + frameDt;
      remote.animationAccumulator = 0;
      remote.lastAnimationAt = now;
      return accumulated;
    }
    remote.animationAccumulator = Math.min(0.25, Number(remote.animationAccumulator || 0) + frameDt);
    return 0;
  }

  private profileRemote(id: string, remote: RemotePlayerRecord, now: number): RemoteRenderProfileRow {
    const group = remote.meshes?.grp;
    const stats = {
      meshes: 0,
      skinnedMeshes: 0,
      sprites: 0,
      shadowCasters: 0,
      shadowReceivers: 0
    };
    const materials = new Set<unknown>();
    const geometries = new Set<unknown>();
    const textures = new Set<unknown>();

    if (group?.visible) {
      this.safeTraverse(group, (object) => {
        if (object.isSprite) stats.sprites += 1;
        if (!object.isMesh) return;
        stats.meshes += 1;
        if (object.isSkinnedMesh) stats.skinnedMeshes += 1;
        if (object.castShadow) stats.shadowCasters += 1;
        if (object.receiveShadow) stats.shadowReceivers += 1;
        const geometry = object.geometry;
        if (geometry) geometries.add(geometry);
        for (const material of materialList(object.material)) {
          if (!material) continue;
          materials.add(material);
          collectMaterialTextures(material, textures);
        }
      });
    }
    const proxy = remote.meshes?.proxy;
    if (proxy?.visible) {
      this.safeTraverse(proxy, (object) => {
        if (object.isSprite) stats.sprites += 1;
        if (!object.isMesh) return;
        stats.meshes += 1;
        if (object.isSkinnedMesh) stats.skinnedMeshes += 1;
        if (object.castShadow) stats.shadowCasters += 1;
        if (object.receiveShadow) stats.shadowReceivers += 1;
        if (object.geometry) geometries.add(object.geometry);
        for (const material of materialList(object.material)) {
          if (!material) continue;
          materials.add(material);
          collectMaterialTextures(material, textures);
        }
      });
    }
    const visibleRoot = group?.visible ? group : proxy?.visible ? proxy : group;
    const bounds = this.readVisualBounds(visibleRoot);
    const positionY = numberOrNull(visibleRoot?.position?.y);

    return {
      id,
      username: String(remote.username || ""),
      visible: Boolean(group?.visible || proxy?.visible),
      meshes: stats.meshes,
      skinnedMeshes: stats.skinnedMeshes,
      sprites: stats.sprites,
      materials: materials.size,
      uniqueGeometries: geometries.size,
      uniqueTextures: textures.size,
      shadowCasters: stats.shadowCasters,
      shadowReceivers: stats.shadowReceivers,
      anim: String(remote.anim || "idle"),
      ageMs: Number(remote.seen) ? Math.round(now - Number(remote.seen)) : null,
      positionY,
      visualMinY: bounds?.minY ?? null,
      visualMaxY: bounds?.maxY ?? null,
      visualFootDelta: positionY === null || bounds?.minY === undefined ? null : roundNumber(bounds.minY - positionY)
    };
  }

  updateRenderBudget(
    remotes: Map<unknown, RemotePlayerRecord> | null | undefined,
    cameraPosition: { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  ): RemoteRenderBudgetSnapshot {
    this.lastBudget = this.applyRenderBudget(remotes, cameraPosition);
    return { ...this.lastBudget };
  }

  private applyRenderBudget(
    remotes: Map<unknown, RemotePlayerRecord> | null | undefined,
    cameraPosition: { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  ): RemoteRenderBudgetSnapshot {
    const camera = readVec3(cameraPosition);
    if (!camera) return emptyBudgetSnapshot();
    const candidates: Array<{ remote: RemotePlayerRecord; distance: number; active: boolean }> = [];
    for (const remote of remotes?.values?.() || []) {
      const group = remote.meshes?.grp;
      const proxy = remote.meshes?.proxy;
      const visible = Boolean(group?.visible || proxy?.visible);
      if (!group || !visible) {
        this.setRemoteCastShadow(remote, false);
        continue;
      }
      const position = readVec3(group.position);
      if (!position) continue;
      const distance = distanceBetween(camera, position);
      const active = remote.anim === "walk" || remote.anim === "jump" || remote.anim === "climb";
      candidates.push({ remote, distance, active });
    }

    candidates.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.distance - b.distance;
    });

    let withShadows = 0;
    let shadowCasters = 0;
    let fullRemotes = 0;
    let proxyRemotes = 0;
    const crowded = candidates.length > REMOTE_FULL_AVATAR_BUDGET + REMOTE_ACTIVE_FULL_EXTRA;
    for (const [index, candidate] of candidates.entries()) {
      const full = candidate.distance <= REMOTE_ALWAYS_FULL_DISTANCE ||
        index < REMOTE_FULL_AVATAR_BUDGET ||
        (candidate.active && candidate.distance <= REMOTE_ACTIVE_FULL_DISTANCE && (!crowded || index < REMOTE_FULL_AVATAR_BUDGET + REMOTE_ACTIVE_FULL_EXTRA));
      this.setRemoteLod(candidate.remote, full ? "full" : "proxy");
      if (full) fullRemotes += 1;
      else proxyRemotes += 1;
      const allowShadow = withShadows < REMOTE_SHADOW_BUDGET && candidate.distance <= REMOTE_SHADOW_DISTANCE;
      const casters = this.setRemoteCastShadow(candidate.remote, allowShadow);
      if (allowShadow) {
        withShadows += 1;
        shadowCasters += casters;
      }
    }

    return {
      visibleRemotes: candidates.length,
      fullRemotes,
      proxyRemotes,
      shadowedRemotes: withShadows,
      shadowCasters,
      shadowBudget: REMOTE_SHADOW_BUDGET,
      shadowDistance: REMOTE_SHADOW_DISTANCE
    };
  }

  private setRemoteCastShadow(remote: RemotePlayerRecord, castShadow: boolean): number {
    let casters = 0;
    const group = remote.meshes?.grp;
    if (!group) return casters;
    this.safeTraverse(group, (object) => {
      if (!object.isMesh) return;
      object.castShadow = castShadow;
      if (castShadow) casters += 1;
    });
    return casters;
  }

  private setRemoteLod(remote: RemotePlayerRecord, lod: "full" | "proxy"): void {
    const group = remote.meshes?.grp;
    const proxy = remote.meshes?.proxy;
    if (!group) return;
    if (!proxy || lod === "full") {
      group.visible = true;
      if (proxy) proxy.visible = false;
      return;
    }
    group.visible = false;
    proxy.visible = true;
  }

  private syncProxyTransform(remote: RemotePlayerRecord): void {
    const group = remote.meshes?.grp;
    const proxy = remote.meshes?.proxy;
    if (!group || !proxy) return;
    proxy.position.copy?.(group.position);
    proxy.rotation.y = Number(group.rotation.y || 0);
  }

  private createRemoteProxy(avatar: LegacyAvatarState): LegacyObject3D | null {
    const { THREE, vortex } = this.assertConfigured();
    if (!THREE.Group || !THREE.Mesh || !THREE.BoxGeometry || !THREE.MeshStandardMaterial) return null;
    const resources = this.getProxyResources(THREE, avatar);
    const group = new THREE.Group();
    group.name = "RemoteAvatarProxy";
    group.userData = { ...(group.userData || {}), vwebRuntimeKind: "remote-avatar-proxy" };
    const parts = [
      { key: "torso", x: 0, y: 1.9, z: 0, sx: 1.55, sy: 1.9, sz: 0.75 },
      { key: "head", x: 0, y: 3.25, z: 0, sx: 1.1, sy: 1.1, sz: 1.1 },
      { key: "arm", x: -1.15, y: 1.95, z: 0, sx: 0.55, sy: 1.75, sz: 0.55 },
      { key: "arm", x: 1.15, y: 1.95, z: 0, sx: 0.55, sy: 1.75, sz: 0.55 },
      { key: "leg", x: -0.42, y: 0.45, z: 0, sx: 0.62, sy: 1.45, sz: 0.62 },
      { key: "leg", x: 0.42, y: 0.45, z: 0, sx: 0.62, sy: 1.45, sz: 0.62 }
    ];
    for (const part of parts) {
      const mesh = new THREE.Mesh(resources.unitBox, resources.materials[part.key] || resources.materials.torso);
      mesh.position.set?.(part.x, part.y, part.z);
      mesh.scale?.set?.(part.sx, part.sy, part.sz);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = { ...(mesh.userData || {}), vwebRuntimeKind: "remote-avatar-proxy" };
      group.add?.(mesh);
    }
    group.visible = false;
    vortex.scene.add(group);
    return group;
  }

  private getProxyResources(THREE: ThreeLike, avatar: LegacyAvatarState): RemoteProxyResources {
    const key = "default";
    if (this.proxyResources) return this.proxyResources;
    const BoxGeometry = THREE.BoxGeometry;
    const MeshStandardMaterial = THREE.MeshStandardMaterial;
    if (!BoxGeometry || !MeshStandardMaterial) throw new Error("remote proxy resources require Three mesh constructors");
    const unitBox = new BoxGeometry(1, 1, 1);
    const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
    const colors = Array.isArray(avatar.body_colors) ? avatar.body_colors : [];
    this.proxyResources = {
      key,
      unitBox,
      materials: {
        torso: material(String(colors[1] || "#4f46e5")),
        head: material(String(colors[0] || "#d8d8d8")),
        arm: material(String(colors[2] || "#d8d8d8")),
        leg: material(String(colors[4] || "#1f2a7a"))
      }
    };
    return this.proxyResources;
  }

  private readVisualBounds(group: LegacyObject3D | null | undefined): { minY: number; maxY: number } | null {
    const Box3 = this.config?.THREE.Box3;
    if (!group || !Box3) return null;
    try {
      const box = new Box3().setFromObject(group);
      const minY = numberOrNull(box.min.y);
      const maxY = numberOrNull(box.max.y);
      if (minY === null || maxY === null) return null;
      return { minY, maxY };
    } catch {
      return null;
    }
  }

  private assertConfigured(): RemotePlayerServiceConfig {
    if (!this.config) throw new Error("RemotePlayerService is not configured");
    return this.config;
  }
}

export type RemoteRenderBudgetSnapshot = {
  visibleRemotes: number;
  fullRemotes: number;
  proxyRemotes: number;
  shadowedRemotes: number;
  shadowCasters: number;
  shadowBudget: number;
  shadowDistance: number;
};

function materialList(material: LegacyMaterial | LegacyMaterial[] | undefined): LegacyMaterial[] {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function collectMaterialTextures(material: LegacyMaterial, textures: Set<unknown>): void {
  for (const [key, value] of Object.entries(material as Record<string, unknown>)) {
    if (!/map$/i.test(key)) continue;
    if (value && typeof value === "object") textures.add(value);
  }
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? roundNumber(number) : null;
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function readVec3(value: { x?: unknown; y?: unknown; z?: unknown } | null | undefined): { x: number; y: number; z: number } | null {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const z = Number(value?.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function distanceBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function emptyBudgetSnapshot(): RemoteRenderBudgetSnapshot {
  return {
    visibleRemotes: 0,
    fullRemotes: 0,
    proxyRemotes: 0,
    shadowedRemotes: 0,
    shadowCasters: 0,
    shadowBudget: REMOTE_SHADOW_BUDGET,
    shadowDistance: REMOTE_SHADOW_DISTANCE
  };
}

const REMOTE_SHADOW_BUDGET = 6;
const REMOTE_SHADOW_DISTANCE = 160;
const REMOTE_FULL_AVATAR_BUDGET = 10;
const REMOTE_ACTIVE_FULL_EXTRA = 4;
const REMOTE_ALWAYS_FULL_DISTANCE = 28;
const REMOTE_ACTIVE_FULL_DISTANCE = 110;

type RemoteProxyResources = {
  key: string;
  unitBox: unknown;
  materials: Record<string, LegacyMaterial>;
};

function isBone(node: LegacyObject3D | null | undefined): boolean {
  return Boolean(node?.isBone || node?.type === "Bone");
}

function boneAlias(name: unknown): string {
  return String(name || "").replace(/\s+/g, "_");
}

function remoteAnimationIntervalMs(anim: string): number {
  if (anim === "walk" || anim === "jump" || anim === "climb") return 1000 / 30;
  return 1000 / 12;
}

function withRemoteAvatarContext(avatar: LegacyAvatarState, id: unknown, username: unknown): RemoteAvatarContext {
  return {
    ...avatar,
    id,
    playerId: id,
    username: String(username || "").trim()
  };
}
