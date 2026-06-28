// @ts-nocheck
import * as THRE from "../../public/vendor/three.webgpu.js";
import * as BufferGeometryUtils from "../../public/vendor/BufferGeometryUtils.js";
import { GLTFLoader } from "../../public/vendor/GLTFLoader.js";
import { CSMShadowNode } from "../../public/vendor/CSMShadowNode.js";
import type { VortexRuntime } from "../runtime/types";

const VortexBufferGeometryUtils = {
    ...BufferGeometryUtils,
};

const THREE = {
    ...THRE,
    GLTFLoader: GLTFLoader,
    BufferGeometryUtils: VortexBufferGeometryUtils,
};

export async function launchEngine(VortexRuntime: VortexRuntime): Promise<void> {
const STUDS_PER_TILE = 4;
const scene = new THREE.Scene();

let fov = 85;
const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 3200);
const cameraService = VortexRuntime.camera;
if (!cameraService) {
    throw new Error('[camera] VortexRuntime camera service is required before the engine starts.');
}
VortexRuntime.loading?.mount?.();
VortexRuntime.loading?.attachThreeLoadingManager?.(THREE.DefaultLoadingManager);

const runtimeRendererService = VortexRuntime.renderer;
if (!runtimeRendererService) {
    throw new Error('[renderer] VortexRuntime renderer service is required before the engine starts.');
}

const sceneRuntime = await VortexRuntime.engineScene.configure({
    windowRef: window,
    document,
    localStorage,
    THREE,
    CSMShadowNode,
    scene,
    camera,
    rendererService: runtimeRendererService,
    sceneSettings: VortexRuntime.sceneSettings,
    shadowRuntime: VortexRuntime.shadowRuntime,
    perf: VortexRuntime.perf,
    settingsStore: VortexRuntime.settingsStore,
});
const {
    renderer,
    isWebGpuRuntime,
    ambient,
    shadows,
    shadowConfig,
    shadowMapSize,
    perf: VortexPerf,
    readStorageFlag,
    shadowsActive,
    setShadowsEnabled,
    setShadowQuality,
    updateLightingForFrame,
} = sceneRuntime;
const sceneSettings = VortexRuntime.sceneSettings;

const runtimeAssets = window.VortexRuntime?.assets;
const cursorService = VortexRuntime.cursor;
const worldRuntime = VortexRuntime.engineWorld.configure({
    THREE,
    scene,
    renderer,
    windowRef: window,
    assets: runtimeAssets,
    assetResolver: VortexRuntime.assetResolver,
    fallbackAssetRaw: window._importedAssets?.content,
    worldRuntime: VortexRuntime.worldRuntime,
    textures: VortexRuntime.textures,
    geometry: VortexRuntime.worldGeometry,
    materials: VortexRuntime.worldMaterials,
    colliders: VortexRuntime.worldColliders,
    parts: VortexRuntime.worldParts,
    sceneSettings,
    shadows,
    debugVisuals: VortexRuntime.debugVisuals,
    worldPicking: VortexRuntime.worldPicking,
    cursor: cursorService,
    camera,
    studsPerTile: STUDS_PER_TILE,
});
const worldRuntimeHandles = worldRuntime.worldRuntime;
const runtimeAsset = worldRuntime.runtimeAsset;

const WORLD_FLOOR_Y = 1.5;
const G = WORLD_FLOOR_Y;
window.G = G;

window.locked = false;

const anim = { time: 0, bones: {}, rest: {} };

const gltfLoader = new THREE.GLTFLoader();
const avatarRuntime = VortexRuntime.engineAvatar.configure({
    THREE,
    scene,
    document,
    windowRef: window,
    loader: gltfLoader,
    avatarService: VortexRuntime.avatar,
    avatarAssets: VortexRuntime.avatarAssets,
    avatarMaterials: VortexRuntime.avatarMaterials,
    localAvatar: VortexRuntime.localAvatar,
    remoteAvatarAppearance: VortexRuntime.remoteAvatarAppearance,
    characterSpawn: VortexRuntime.characterSpawn,
    animation: anim,
    isWebGpuRuntime,
    floorY: G,
    resolveAsset: (bodyType) => bodyType === "female"
        ? runtimeAsset("meshes.femalePlayerGlb", "femalePlayerGlb")
        : runtimeAsset("meshes.malePlayerGlb", "malePlayerGlb"),
    shadowsActive,
    markShadowsDirty: () => shadows.markNeedsUpdate(),
});
const {
    avatarMaterials,
    avatarAssets,
    characterSpawn,
    localAvatar,
    remoteAvatarAppearance,
} = avatarRuntime;
const getCharacter = avatarRuntime.getCharacter;
const characterMetrics = avatarRuntime.getMetrics;

function toggleDebug() {
    worldRuntime.toggleDebug(characterMetrics());
}

let hudRuntime = null;
let isFirstPerson = false;

function setMouseLock(sl) {
    hudRuntime?.setMouseLock(!!sl);
}

const localPlayerRuntime = VortexRuntime.engineLocalPlayer.configure({
    THREE,
    runtime: VortexRuntime,
    cameraObject: camera,
    animationState: anim,
    characterSpawn,
    localAvatar,
    windowRef: window,
    getCharacter,
    getNearbyColliders: worldRuntime.getNearbyColliders,
    getMetrics: characterMetrics,
    setMouseLock,
    setFirstPerson: (value) => { isFirstPerson = !!value; },
});
const localMovement = localPlayerRuntime.localMovement;
const cam = localPlayerRuntime.cameraState;

const runtimeInput = window.VortexRuntime && window.VortexRuntime.input;
if (!runtimeInput || typeof runtimeInput.attachTarget !== 'function') {
    throw new Error('[input] VortexRuntime input service is required before the engine starts.');
}
const keys = runtimeInput.keys;

function _cursorOver(el) {
    return hudRuntime?.cursorOver(el) || false;
}

hudRuntime = VortexRuntime.engineHud.configure({
    document,
    windowRef: window,
    runtime: VortexRuntime,
    renderer,
    rendererService: runtimeRendererService,
    shadows,
    shadowConfig,
    perf: VortexPerf,
    readStorageFlag,
    runtimeAsset,
    resetCharacterToSpawn: () => localMovement.resetCharacterToSpawn(),
    readCharacterPosition: () => getCharacter()?.position || null,
    readFogSettings: () => sceneSettings.readFogSettings(),
    readToneMappingMode: () => sceneSettings.readToneMappingMode(),
    readShadowsEnabled: () => sceneRuntime.readShadowsEnabled(),
    readStudTexturesEnabled: worldRuntime.useStudTextures,
    setShadowsEnabled,
    setShadowQuality,
    setToneMappingMode: (value) => sceneSettings.setToneMappingMode(value),
    setRenderFog: (value) => sceneSettings.setRenderFog(value),
    setFogDistance: (value) => sceneSettings.setFogDistance(value),
    refreshStudMaterialTextures: worldRuntime.refreshStudMaterialTextures,
    markSceneMaterialsForShaderUpdate: () => sceneSettings.markMaterialsForShaderUpdate(),
    input: runtimeInput,
    cursor: cursorService,
    camera: cameraService,
    localMovement,
    getCharacter,
    isFirstPerson: () => isFirstPerson,
    onToggleDebug: toggleDebug,
});

VortexRuntime.engineRuntimeBridge.install({
    windowRef: window,
    localStorage,
    three: THREE,
    gltfLoaderClass: GLTFLoader,
    gltfLoader,
    scene,
    ambient,
    renderer,
    cameraObject: camera,
    cameraState: cam,
    avatarMaterials,
    avatarAssets,
    localAvatar,
    remoteAvatarAppearance,
    characterSpawn,
    localMovement,
    camera: cameraService,
    animation: VortexRuntime.animation,
    shadows,
    shadowQuality: () => shadowConfig.quality,
    shadowMapSize: () => shadowMapSize,
    shadowsActive,
    setShadowsEnabled,
    setShadowQuality,
    sceneSettings,
    rendererService: runtimeRendererService,
    quality: VortexRuntime.quality,
    compatibility: VortexRuntime.engineCompatibility,
    frameLoop: VortexRuntime.frameLoop,
    profiler: VortexPerf,
    worldService: VortexRuntime.world,
    worldRuntime: worldRuntimeHandles,
    bufferGeometryUtils: VortexBufferGeometryUtils,
    keys,
    anim,
    getCharacter,
    getCharHeight: avatarRuntime.getCharHeight,
    getCharFootOffset: avatarRuntime.getCharFootOffset,
    getCharStandY: avatarRuntime.getCharStandY,
    readStorageFlag,
    requestPointerLock: () => hudRuntime?.requestPointerLock(),
    resetCharacterToSpawn: () => localMovement.resetCharacterToSpawn(),
    pick: () => worldRuntime.getClicked3DPoint(),
    cursorOver: _cursorOver,
    update: (dt) => localMovement.update(dt),
    updateCamera: (dt) => localMovement.updateCamera(dt),
    updateDebug: () => {
        worldRuntime.updateDebug(getCharacter(), characterMetrics());
    },
    updateLighting: updateLightingForFrame,
});
}
