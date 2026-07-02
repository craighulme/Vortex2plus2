import type { RuntimeApi } from "./RuntimeApiExportService";
import type { RuntimeStartupConfig } from "./RuntimeStartupTypes";
import type { RigBoneRest, RuntimeObject3D } from "../avatar/remote/RemotePlayerTypes";

export class RuntimeApiService {
  create(config: RuntimeStartupConfig): RuntimeApi {
    return {
      scene: config.scene as RuntimeApi["scene"],
      getCharacter: () => config.getCharacter() as RuntimeObject3D | null,
      getGrounded: () => config.localMovement.getGrounded(),
      getVelY: () => config.localMovement.getVelY(),
      setVelY: (value: unknown) => config.localMovement.setVelY(value),
      setGrounded: (value: unknown) => config.localMovement.setGrounded(value),
      getMovementConstants: () => config.localMovement.constants(),
      getMovementMods: () => config.localMovement.getMovementMods(),
      setMovementMods: (patch: unknown) => config.localMovement.setMovementMods(patch as never),
      getCameraState: () => config.camera.snapshot(),
      getClimbState: () => config.localMovement.getClimbState(),
      getCharFootOffset: config.getCharFootOffset,
      getCharHeight: config.getCharHeight,
      getSpawn: () => config.characterSpawn.getSpawn(),
      getAnimRest: () => config.anim.rest as Record<string, RigBoneRest>,
      getFootIkState: () => config.animation.getFootIkState(),
      keys: config.keys,
      setSens: (multiplier: unknown) => config.camera.setSensitivity(multiplier),
      getShadowsEnabled: () => config.shadowsActive(),
      setShadowsEnabled: (value: unknown) => config.setShadowsEnabled(value),
      requestLock: () => config.requestPointerLock(),
      resetCharacter: () => config.resetCharacterToSpawn(),
      pick: () => config.pick(),
      getObjects: () => config.worldRuntime.objects,
      getColliders: () => config.worldRuntime.colliders,
      getCamera: () => config.cameraObject,
      getCharBubbleBase: () => {
        const character = config.getCharacter();
        return character ? character.position.y + config.getCharHeight() - config.getCharFootOffset() + 0.4 : 0;
      },
      setSpawn: (x: number, y: number, z: number, ry = Math.PI) => {
        console.log(`set spawn to: ${x} ${y} ${z}`);
        config.characterSpawn.setSpawn(x, y, z, ry);
        config.characterSpawn.applyToCharacter(config.getCharacter() as never, {
          footOffset: config.getCharFootOffset(),
          standY: config.getCharStandY()
        });
      },
      applyShirt: (url: string) => {
        config.avatarMaterials.applyShirtToMesh(config.localAvatar.getShirtMesh(), url);
      },
      applyShirtToMesh: (mesh: unknown, url: string) => {
        config.remoteAvatarAppearance.applyShirtToMesh(mesh, url);
      },
      buildShirtOverlay: (target: unknown) => config.remoteAvatarAppearance.buildShirtOverlay(target),
      buildPantsOverlay: (target: unknown) => config.remoteAvatarAppearance.buildPantsOverlay(target),
      buildFaceOverlay: (target: unknown) => config.remoteAvatarAppearance.buildFaceOverlay(target),
      applyBodyColors: (target: unknown, colors: unknown) => config.remoteAvatarAppearance.applyBodyColors(target, Array.isArray(colors) ? colors.map(String) : []),
      prepareModernAvatarMaterials: (target: unknown) => config.remoteAvatarAppearance.prepareModernAvatarMaterials(target),
      prefetchAvatarImages: (avatars: unknown) => config.avatarAssets.prefetchAvatarImages((Array.isArray(avatars) ? avatars : [avatars]) as Array<Record<string, unknown>>),
      applyAvatar: async (avatar: unknown) => {
        await config.localAvatar.applyAvatar(isRecord(avatar) ? avatar : {});
      },
      applyAvatarToMeshes: async (meshes: unknown, avatar: unknown) => {
        await config.remoteAvatarAppearance.applyAvatarToMeshes(meshes as never, isRecord(avatar) ? avatar : {});
      },
      getAvatar: () => config.localAvatar.getAvatar()
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
