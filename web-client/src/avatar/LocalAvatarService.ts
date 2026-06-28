import type { AvatarAssetService } from "./AvatarAssetService";
import type { AvatarMaterialService } from "./AvatarMaterialService";
import { DEFAULT_BODY_COLORS, type AvatarService, type LegacyAvatarState } from "./AvatarService";

type ThreeLike = Record<string, any>;

type SpawnPoint = {
  x: number;
  y: number | null;
  z: number;
  ry: number;
};

type BoneRest = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  sz: number;
};

export type LocalAvatarAnimationState = {
  bones: Record<string, any>;
  rest: Record<string, BoneRest>;
};

export type LocalAvatarOptions = {
  THREE: ThreeLike;
  scene: any;
  loader: any;
  windowRef?: Window;
  avatarService: AvatarService;
  avatarAssets: AvatarAssetService;
  avatarMaterials: AvatarMaterialService;
  animation: LocalAvatarAnimationState;
  isWebGpuRuntime: boolean;
  getSpawn(): SpawnPoint;
  getFootOffset(): number;
  getStandY(): number;
  resolveAsset(bodyType: "male" | "female"): string;
  shadowsActive(): boolean;
  onCharacterChanged?(character: any): void;
  onMetricsChanged?(metrics: { height: number; standY: number }): void;
  onShadowsDirty?(): void;
  onRendererChanged?(): void;
  isDebugEnabled?(): boolean;
};

const DEFAULT_AVATAR: LegacyAvatarState = {
  shirt_id: 0,
  pant_id: 0,
  body_type: "male",
  body_colors: [...DEFAULT_BODY_COLORS],
  face_id: 0
};

export class LocalAvatarService {
  private options: LocalAvatarOptions | null = null;
  private character: any = null;
  private shirtMesh: any = null;
  private pantsMesh: any = null;
  private faceMesh: any = null;
  private avatarState: LegacyAvatarState = cloneAvatar(DEFAULT_AVATAR);

  configure(options: LocalAvatarOptions): this {
    this.options = options;
    return this;
  }

  getCharacter(): any {
    return this.character;
  }

  getAvatar(): LegacyAvatarState {
    return cloneAvatar(this.avatarState);
  }

  getShirtMesh(): any {
    return this.shirtMesh;
  }

  setFirstPersonMode(firstPerson: boolean, options: { hideBody?: boolean } = {}): void {
    if (!this.character) return;
    this.requireOptions().avatarMaterials.setLocalFirstPersonHidden?.(this.character, firstPerson, options);
  }

  reload(): void {
    this.loadModernCharacter();
  }

  async applyAvatar(avatar: Record<string, unknown> = {}): Promise<void> {
    const options = this.requireOptions();
    const previousBodyType = this.avatarState.body_type;
    this.avatarState = options.avatarService.normalizeLegacy(avatar, this.avatarState);
    if (options.isDebugEnabled?.()) console.debug("[avatar] local", JSON.stringify(this.avatarState));
    if (this.character && previousBodyType !== this.avatarState.body_type) {
      this.reload();
      return;
    }
    if (!this.character) return;

    options.avatarMaterials.applyBodyColors(this.character, this.avatarState.body_colors);
    const [shirtUrl, pantsUrl, faceUrl] = await Promise.all([
      Promise.resolve(options.avatarAssets.clothingImageUrl(this.avatarState.shirt_id)),
      Promise.resolve(options.avatarAssets.clothingImageUrl(this.avatarState.pant_id)),
      Promise.resolve(options.avatarAssets.clothingImageUrl(this.avatarState.face_id))
    ]);

    if (options.isWebGpuRuntime) {
      options.avatarMaterials.applyShirtToMesh(this.shirtMesh, shirtUrl);
      options.avatarMaterials.applyShirtToMesh(this.pantsMesh, pantsUrl);
      options.avatarMaterials.applyShirtToMesh(this.faceMesh, faceUrl);
    } else {
      options.avatarMaterials.applyModernAvatarTextures(this.character, { shirtUrl, pantsUrl, faceUrl });
    }
  }

  setSpawnPosition(): void {
    const options = this.requireOptions();
    const spawn = options.getSpawn();
    if (!this.character) return;
    this.character.position.set(spawn.x, Number(spawn.y ?? 0) + options.getFootOffset(), spawn.z);
    this.character.rotation.y = spawn.ry ?? Math.PI;
  }

  private loadModernCharacter(): void {
    const options = this.requireOptions();
    const url = options.resolveAsset(this.avatarState.body_type);
    options.loader.load(url, (gltf: any) => {
      const root = new options.THREE.Group();
      root.name = "ModernAvatarRoot";
      gltf.scene.name = "ModernAvatarVisual";
      gltf.scene.rotation.y = Math.PI;
      options.avatarMaterials.alignVisualToRootFoot(gltf.scene, options.getFootOffset());
      root.add(gltf.scene);
      this.prepareCharacterModel(root);
    }, undefined, (error: unknown) => {
      console.error("[avatar] GLB load failed", error);
    });
  }

  private prepareCharacterModel(model: any): void {
    const options = this.requireOptions();
    const previous = this.character;
    const previousFootY = previous ? previous.position.y - options.getFootOffset() : null;
    const previousRotationY = previous ? previous.rotation.y : options.getSpawn().ry;
    const previousPosition = previous ? previous.position.clone() : null;

    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const box = new options.THREE.Box3().setFromObject(model);
    const height = box.max.y - box.min.y;
    const standY = options.getStandY();
    console.log("char foot offset:", options.getFootOffset().toFixed(3), "| height:", height.toFixed(3), "| renderer: modern");

    const spawn = options.getSpawn();
    const spawnY = previousFootY !== null
      ? previousFootY + options.getFootOffset()
      : (spawn.y !== null ? spawn.y + options.getFootOffset() : standY);
    model.position.set(
      previousPosition ? previousPosition.x : spawn.x,
      spawnY,
      previousPosition ? previousPosition.z : spawn.z
    );
    model.rotation.y = previousRotationY;
    model.castShadow = options.shadowsActive();

    options.animation.bones = {};
    options.animation.rest = {};
    model.traverse((child: any) => {
      if (child.isBone || child.type === "Bone") this.registerBone(child);
      if (child.isMesh) {
        child.castShadow = options.shadowsActive();
        child.receiveShadow = options.shadowsActive();
      }
    });

    this.disposeCharacter(previous);
    options.scene.add(model);
    this.character = model;
    options.windowRef && ((options.windowRef as Window & { character?: any }).character = model);
    options.onCharacterChanged?.(model);
    options.avatarMaterials.prepareModernAvatarMaterials(model);
    this.shirtMesh = options.isWebGpuRuntime ? options.avatarMaterials.buildShirtOverlay(model) : null;
    this.pantsMesh = options.isWebGpuRuntime ? options.avatarMaterials.buildPantsOverlay(model) : null;
    this.faceMesh = options.isWebGpuRuntime ? options.avatarMaterials.buildFaceOverlay(model) : null;
    options.onMetricsChanged?.({ height, standY });
    this.applyAvatar(this.avatarState).catch((error) => console.warn("[avatar] apply failed", error));
    options.onShadowsDirty?.();
    options.onRendererChanged?.();
  }

  private registerBone(child: any): void {
    const options = this.requireOptions();
    const name = child.name;
    const alias = canonicalBoneName(name);
    const rest: BoneRest = {
      x: child.rotation.x,
      y: child.rotation.y,
      z: child.rotation.z,
      px: child.position.x,
      py: child.position.y,
      pz: child.position.z,
      sx: child.scale.x,
      sy: child.scale.y,
      sz: child.scale.z
    };
    options.animation.bones[name] = child;
    options.animation.rest[name] = rest;
    options.animation.bones[alias] = child;
    options.animation.rest[alias] = rest;
  }

  private disposeCharacter(root: any): void {
    const options = this.requireOptions();
    if (!root) return;
    options.scene.remove(root);
    root.traverse((obj: any) => {
      if (obj.geometry && /Overlay$/.test(obj.name || "")) obj.geometry.dispose?.();
      if (obj.material && /Overlay$/.test(obj.name || "")) {
        obj.material.map?.dispose?.();
        obj.material.dispose?.();
      }
    });
  }

  private requireOptions(): LocalAvatarOptions {
    if (!this.options) throw new Error("[avatar] LocalAvatarService is not configured.");
    return this.options;
  }
}

function canonicalBoneName(name: unknown): string {
  return String(name || "").replace(/\s+/g, "_");
}

function cloneAvatar(avatar: LegacyAvatarState): LegacyAvatarState {
  return { ...avatar, body_colors: [...avatar.body_colors] };
}
