import type { TextureService } from "../assets/TextureService";
import type { SceneSettingsService } from "../renderer/SceneSettingsService";
import type { ShadowService } from "../renderer/ShadowService";
import type { WorldCollider, WorldColliderService } from "./WorldColliderService";
import type { WorldGeometryService } from "./WorldGeometryService";
import type { WorldMaterialService } from "./WorldMaterialService";
import type { WorldPartService } from "./WorldPartService";

type RendererLike = {
  capabilities?: {
    getMaxAnisotropy?: () => number;
  };
};

type WorldRuntimeConfig = {
  THREE: Record<string, unknown>;
  scene: unknown;
  renderer: RendererLike;
  textures: TextureService;
  geometry: WorldGeometryService;
  materials: WorldMaterialService;
  colliders: WorldColliderService;
  parts: WorldPartService;
  sceneSettings: SceneSettingsService;
  shadows: Pick<ShadowService, "active" | "markNeedsUpdate">;
  studsPerTile: number;
  runtimeAsset(path: string, fallbackKey?: string): string | null;
};

export type WorldRuntimeHandles = {
  textureService: TextureService;
  geometryService: WorldGeometryService;
  materialService: WorldMaterialService;
  colliderService: WorldColliderService;
  partService: WorldPartService;
  objects: WorldPartService["objects"];
  colliders: WorldColliderService["colliders"];
  addStud: WorldPartService["addStud"];
  removeStud: WorldPartService["removeStud"];
  getNearbyColliders(px: number, py: number, pz: number): Set<WorldCollider>;
  useStudTextures(): boolean;
  applyStudTexturesToMaterial(material: unknown): void;
  refreshStudMaterialTextures(): void;
  textureDiagnostics(): Array<Record<string, unknown>>;
};

export class WorldRuntimeService {
  configure(config: WorldRuntimeConfig): WorldRuntimeHandles {
    let materialService: WorldMaterialService | null = null;
    const maxTextureAnisotropy = Math.min(4, config.renderer.capabilities?.getMaxAnisotropy?.() || 1);
    const importedAssets: { stud?: string; studNormal?: string } = {};
    const studTexture = config.runtimeAsset("textures.stud", "stud");
    const studNormalTexture = config.runtimeAsset("textures.studNormal", "studNormal");
    if (studTexture) importedAssets.stud = studTexture;
    if (studNormalTexture) importedAssets.studNormal = studNormalTexture;
    const textureService = config.textures.configure({
      THREE: config.THREE as never,
      importedAssets,
      maxTextureAnisotropy,
      onTextureChanged: () => {
        materialService?.refreshStudTextures();
        config.sceneSettings.markMaterialsForShaderUpdate();
        config.shadows.markNeedsUpdate();
      }
    });

    const applyStudTexturesToMaterial = (material: unknown) => {
      textureService.applyStudTexturesToMaterial(material as never);
    };
    const refreshStudMaterialTextures = () => {
      materialService?.refreshStudTextures();
    };

    const geometryService = config.geometry.configure(config.THREE as never);
    materialService = config.materials.configure({
      THREE: config.THREE as never,
      studsPerTile: config.studsPerTile,
      applyStudTextures: applyStudTexturesToMaterial as never
    });
    const colliderService = config.colliders.configure(config.THREE as never);
    const partService = config.parts.configure({
      THREE: config.THREE as never,
      scene: config.scene as never,
      geometry: geometryService,
      materials: materialService,
      colliders: colliderService,
      shadowsActive: () => config.shadows.active()
    });

    return {
      textureService,
      geometryService,
      materialService,
      colliderService,
      partService,
      objects: partService.objects,
      colliders: colliderService.colliders,
      addStud: partService.addStud.bind(partService) as WorldPartService["addStud"],
      removeStud: partService.removeStud.bind(partService) as WorldPartService["removeStud"],
      getNearbyColliders: (px, py, pz) => colliderService.getNearbyColliders(px, py, pz),
      useStudTextures: () => textureService.useStudTextures(),
      applyStudTexturesToMaterial,
      refreshStudMaterialTextures,
      textureDiagnostics: () => textureService.diagnostics()
    };
  }
}
