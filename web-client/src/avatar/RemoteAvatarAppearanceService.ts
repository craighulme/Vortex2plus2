import type { AvatarAssetService } from "./AvatarAssetService";
import type { AvatarMaterialService } from "./AvatarMaterialService";
import type { AvatarService, LegacyAvatarState } from "./AvatarService";
import type { RemotePlayerMeshes } from "./RemotePlayerService";

export type RemoteAvatarAppearanceOptions = {
  avatarService: AvatarService;
  avatarAssets: AvatarAssetService;
  avatarMaterials: AvatarMaterialService;
  isWebGpuRuntime: boolean;
  isDebugEnabled?: () => boolean;
};

export class RemoteAvatarAppearanceService {
  private options: RemoteAvatarAppearanceOptions | null = null;

  configure(options: RemoteAvatarAppearanceOptions): this {
    this.options = options;
    return this;
  }

  buildShirtOverlay(target: unknown): unknown {
    const options = this.requireOptions();
    if (!options.isWebGpuRuntime) {
      options.avatarMaterials.prepareModernAvatarMaterials(target);
      return null;
    }
    return options.avatarMaterials.buildShirtOverlay(target);
  }

  buildPantsOverlay(target: unknown): unknown {
    const options = this.requireOptions();
    if (!options.isWebGpuRuntime) {
      options.avatarMaterials.prepareModernAvatarMaterials(target);
      return null;
    }
    return options.avatarMaterials.buildPantsOverlay(target);
  }

  buildFaceOverlay(target: unknown): unknown {
    const options = this.requireOptions();
    if (!options.isWebGpuRuntime) {
      options.avatarMaterials.prepareModernAvatarMaterials(target);
      return null;
    }
    return options.avatarMaterials.buildFaceOverlay(target);
  }

  applyBodyColors(target: unknown, colors: string[]): void {
    this.requireOptions().avatarMaterials.applyBodyColors(target, colors);
  }

  prepareModernAvatarMaterials(target: unknown): unknown {
    return this.requireOptions().avatarMaterials.prepareModernAvatarMaterials(target);
  }

  applyShirtToMesh(mesh: unknown, url: string | null): unknown {
    return this.requireOptions().avatarMaterials.applyShirtToMesh(mesh, url);
  }

  async applyAvatarToMeshes(meshes: RemotePlayerMeshes | null | undefined, avatar: LegacyAvatarState | Record<string, unknown>): Promise<void> {
    if (!meshes) return;
    const options = this.requireOptions();
    const normalized = options.avatarService.normalizeLegacy(avatar);
    const rawAvatar = avatar as Record<string, unknown>;
    const playerId = Number(rawAvatar.id ?? rawAvatar.user_id ?? rawAvatar.userId ?? rawAvatar.player_id ?? rawAvatar.playerId ?? 0) || null;
    const username = String(rawAvatar.username ?? rawAvatar.name ?? "").trim() || null;
    if (options.isDebugEnabled?.()) console.debug("[avatar] remote", JSON.stringify(normalized));
    options.avatarMaterials.applyBodyColors(meshes.grp, normalized.body_colors);
    const [shirtUrl, pantsUrl, faceUrl] = await Promise.all([
      this.resolveAvatarTextureUrl(normalized.shirt_id),
      this.resolveAvatarTextureUrl(normalized.pant_id),
      this.resolveAvatarTextureUrl(normalized.face_id)
    ]);
    if (options.isWebGpuRuntime) {
      options.avatarMaterials.applyShirtToMesh(meshes.shirtMesh, shirtUrl, {
        playerId,
        username,
        slot: "shirt",
        clothingId: normalized.shirt_id
      });
      options.avatarMaterials.applyShirtToMesh(meshes.pantsMesh, pantsUrl, {
        playerId,
        username,
        slot: "pants",
        clothingId: normalized.pant_id
      });
      options.avatarMaterials.applyShirtToMesh(meshes.faceMesh, faceUrl, {
        playerId,
        username,
        slot: "face",
        clothingId: normalized.face_id
      });
    } else {
      options.avatarMaterials.applyModernAvatarTextures(meshes.grp, { shirtUrl, pantsUrl, faceUrl });
    }
  }

  private requireOptions(): RemoteAvatarAppearanceOptions {
    if (!this.options) throw new Error("[avatar] RemoteAvatarAppearanceService is not configured.");
    return this.options;
  }

  private async resolveAvatarTextureUrl(id: unknown): Promise<string | null> {
    const options = this.requireOptions();
    const cached = options.avatarAssets.cachedClothingImageUrl?.(id);
    if (cached) return cached;
    const direct = options.avatarAssets.clothingImageUrl(id);
    void options.avatarAssets.prefetchClothingImage(id).catch(() => null);
    return direct;
  }
}
