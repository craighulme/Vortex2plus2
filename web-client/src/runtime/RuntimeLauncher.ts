import * as THRE from "../../public/vendor/three.webgpu.js";
import * as BufferGeometryUtils from "../../public/vendor/BufferGeometryUtils.js";
import { GLTFLoader } from "../../public/vendor/GLTFLoader.js";
import { CSMShadowNode } from "../../public/vendor/CSMShadowNode.js";
import { attachRuntimeApi } from "./createRuntime";
import type { VortexRuntime } from "./types";

const VortexBufferGeometryUtils = {
    ...BufferGeometryUtils,
};

const THREE = {
    ...THRE,
    GLTFLoader: GLTFLoader,
    BufferGeometryUtils: VortexBufferGeometryUtils,
};

type RuntimeWindow = Window & {
    _importedAssets?: { content?: unknown };
    VortexChunkDebug?: unknown;
    G?: number;
    locked?: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export async function launchRuntime(VortexRuntime: VortexRuntime): Promise<void> {
const runtimeWindow = window as RuntimeWindow;
const STUDS_PER_TILE = 4;
const scene = new THREE.Scene();

let fov = 85;
const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 3200);
const renderChunkForward = new THREE.Vector3();
const cameraService = VortexRuntime.camera;
if (!cameraService) {
    throw new Error('[camera] VortexRuntime camera service is required before the runtime starts.');
}
VortexRuntime.loading?.mount?.();
VortexRuntime.loading?.attachThreeLoadingManager?.(THREE.DefaultLoadingManager);

const runtimeRendererService = VortexRuntime.renderer;
if (!runtimeRendererService) {
    throw new Error('[renderer] VortexRuntime renderer service is required before the runtime starts.');
}

const sceneRuntime = await VortexRuntime.sceneSetup.configure({
    windowRef: runtimeWindow,
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

const runtimeAssets = VortexRuntime.assets;
const cursorService = VortexRuntime.cursor;
const worldRuntime = VortexRuntime.worldBridge.configure({
    THREE,
    scene,
    renderer,
    windowRef: window,
    assets: runtimeAssets,
    assetResolver: VortexRuntime.assetResolver,
    fallbackAssetRaw: runtimeWindow._importedAssets?.content == null ? null : String(runtimeWindow._importedAssets.content),
    worldRuntime: VortexRuntime.worldRuntime,
    textures: VortexRuntime.textures,
    geometry: VortexRuntime.worldGeometry,
    materials: VortexRuntime.worldMaterials,
    colliders: VortexRuntime.worldColliders,
    parts: VortexRuntime.worldParts,
    dynamicObjects: VortexRuntime.worldDynamicObjects,
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
applyStoredRenderDistance(VortexRuntime.world, localStorage);
const chunkDebug = createChunkDebugController(THREE, scene, VortexRuntime.world);
runtimeWindow.VortexChunkDebug = chunkDebug.api;

const WORLD_FLOOR_Y = 1.5;
const G = WORLD_FLOOR_Y;
runtimeWindow.G = G;

runtimeWindow.locked = false;

const anim = { time: 0, bones: {}, rest: {} };

const gltfLoader = new THREE.GLTFLoader();
const avatarRuntime = VortexRuntime.avatarSetup.configure({
    THREE,
    scene,
    document,
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    loader: gltfLoader,
    avatarService: VortexRuntime.avatar,
    avatarAssets: VortexRuntime.avatarAssets,
    avatarMaterials: VortexRuntime.avatarMaterials,
    equipment: VortexRuntime.avatarEquipment,
    localAvatar: VortexRuntime.localAvatar,
    remoteAvatarAppearance: VortexRuntime.remoteAvatarAppearance,
    characterSpawn: VortexRuntime.characterSpawn,
    animation: anim,
    isWebGpuRuntime,
    floorY: G,
    resolveAsset: (bodyType) => String(bodyType === "female"
        ? runtimeAsset("meshes.femalePlayerGlb", "femalePlayerGlb")
        : runtimeAsset("meshes.malePlayerGlb", "malePlayerGlb")),
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

let hudRuntime: any = null;
let isFirstPerson = false;

function setMouseLock(sl: unknown) {
    hudRuntime?.setMouseLock(!!sl);
}

const localPlayerRuntime = VortexRuntime.localPlayerSetup.configure({
    THREE,
    runtime: VortexRuntime,
    cameraObject: camera,
    animationState: anim,
    characterSpawn,
    localAvatar,
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    getCharacter,
    getNearbyColliders: worldRuntime.getNearbyColliders,
    getMetrics: characterMetrics,
    setMouseLock,
    setFirstPerson: (value) => { isFirstPerson = !!value; },
});
const localMovement = localPlayerRuntime.localMovement;

const runtimeInput = VortexRuntime.input;
if (!runtimeInput || typeof runtimeInput.attachTarget !== 'function') {
    throw new Error('[input] VortexRuntime input service is required before the runtime starts.');
}
const keys = runtimeInput.keys;

hudRuntime = VortexRuntime.hudSetup.configure({
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
    setRenderDistance: (value, profile) => VortexRuntime.world.setRenderDistance(value, profile),
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

VortexRuntime.runtimeStartup.install({
    windowRef: runtimeWindow as Window & Record<string, unknown>,
    localStorage,
    three: THREE,
    scene,
    renderer,
    cameraObject: camera,
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
    runtimeApiExports: VortexRuntime.runtimeApiExports,
    setRuntimeApi: (api) => attachRuntimeApi(VortexRuntime, api),
    frameLoop: VortexRuntime.frameLoop,
    profiler: VortexPerf,
    worldService: VortexRuntime.world,
    worldRuntime: worldRuntimeHandles,
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
    update: (dt) => localMovement.update(dt),
    updateCamera: (dt) => localMovement.updateCamera(dt),
    updateDebug: () => {
        camera.getWorldDirection?.(renderChunkForward);
        VortexRuntime.world.updateRenderChunks({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            forward: {
                x: renderChunkForward.x,
                y: renderChunkForward.y,
                z: renderChunkForward.z,
            },
            verticalFovDegrees: camera.fov,
            aspect: camera.aspect,
        });
        chunkDebug.update();
        worldRuntime.updateDebug(getCharacter(), characterMetrics());
    },
    updateMultiplayer: (dt) => VortexRuntime.multiplayerBridge.updateFrame(dt),
    updateLighting: updateLightingForFrame,
});
}

function applyStoredRenderDistance(worldService: any, storage: StorageLike) {
    const distance = Number(storage.getItem("vwebRenderDistance"));
    if (!Number.isFinite(distance)) return;
    const rawProfile = storage.getItem("vwebRenderDistanceProfile");
    const profile = rawProfile === "performance" || rawProfile === "visual" ? rawProfile : "balanced";
    worldService.setRenderDistance?.(distance, profile);
}

function createChunkDebugController(THREE: any, scene: any, worldService: any) {
    const helpers = new Map<string, any>();
    let visible = false;

    function rows() {
        return worldService.renderChunkDebugRows?.() || [];
    }

    function snapshot() {
        return worldService.renderChunkSnapshot?.() || null;
    }

    function clear() {
        for (const helper of helpers.values()) {
            scene.remove(helper);
            helper.geometry?.dispose?.();
            helper.material?.dispose?.();
        }
        helpers.clear();
    }

    function makeHelper(row: any) {
        if (!row?.min || !row?.max) return null;
        const box = new THREE.Box3(
            new THREE.Vector3(row.min.x, row.min.y, row.min.z),
            new THREE.Vector3(row.max.x, row.max.y, row.max.z)
        );
        const helper = new THREE.Box3Helper(box, row.visible ? 0x38d46f : 0xff4d4d);
        helper.name = `VortexRenderChunk:${row.chunkKey}`;
        helper.renderOrder = 9999;
        helper.userData = {
            ...(helper.userData || {}),
            vwebRuntimeKind: "render-chunk-debug",
            vwebRenderChunk: row.chunkKey
        };
        return helper;
    }

    function update() {
        if (!visible) return;
        const nextRows = rows();
        const nextIds = new Set(nextRows.map((row: any) => row.id));
        for (const [id, helper] of helpers) {
            if (nextIds.has(id)) continue;
            scene.remove(helper);
            helper.geometry?.dispose?.();
            helper.material?.dispose?.();
            helpers.delete(id);
        }
        for (const row of nextRows) {
            const helper = helpers.get(row.id);
            if (helper) {
                helper.visible = true;
                helper.material?.color?.setHex?.(row.visible ? 0x38d46f : 0xff4d4d);
                continue;
            }
            const next = makeHelper(row);
            if (!next) continue;
            helpers.set(row.id, next);
            scene.add(next);
        }
    }

    const api = {
        show() {
            visible = true;
            update();
            return snapshot();
        },
        hide() {
            visible = false;
            clear();
            return snapshot();
        },
        toggle() {
            return visible ? api.hide() : api.show();
        },
        rows() {
            const data = rows();
            console.table(data.map((row: any) => ({
                chunk: row.chunkKey,
                visible: row.visible,
                objects: row.objects,
                x: Math.round(row.center?.x ?? 0),
                y: Math.round(row.center?.y ?? 0),
                z: Math.round(row.center?.z ?? 0),
                radius: Math.round(row.radius)
            })));
            return data;
        },
        snapshot,
        setDistance(value: unknown) {
            const result = worldService.setRenderDistance?.(Number(value), "balanced") || worldService.setRenderChunkCullDistance?.(Number(value));
            update();
            return result || snapshot();
        },
        setNear(value: unknown) {
            const result = worldService.setRenderChunkMinimumVisibleDistance?.(Number(value));
            update();
            return { ...snapshot(), minimumVisibleDistance: result };
        },
        setViewCulling(value: unknown) {
            worldService.setRenderChunkViewCullingEnabled?.(!!value);
            update();
            return snapshot();
        }
    };

    return { api, update };
}
