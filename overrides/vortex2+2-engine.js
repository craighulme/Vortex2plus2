//Made by inuk, for https://github.com/inuk84/Vortex-2-plus-2
console.log('VORTEX ENGINE OVERRIDDEN!')

import * as THRE from "./libs/three.module.js";
import * as BufferGeometryUtils from "./libs/BufferGeometryUtils.js";
import { FBXLoader } from "./libs/FBXLoader.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";

const THREE = {
    ...THRE,
    FBXLoader: FBXLoader,
    GLTFLoader: GLTFLoader,
    BufferGeometryUtils: BufferGeometryUtils,
};

const _loadingScreen = document.createElement("div");
_loadingScreen.id = "loadingScreen";
const _loadingLogo = document.createElement("div");
_loadingLogo.id = "loadingLogo";
_loadingLogo.textContent = "VORTEX WEB";
const _loadingBarBg = document.createElement("div");
_loadingBarBg.id = "loadingBarBg";
const _loadingBarFill = document.createElement("div");
_loadingBarFill.id = "loadingBarFill";
const _loadingText = document.createElement("div");
_loadingText.id = "loadingText";
_loadingBarBg.appendChild(_loadingBarFill);
_loadingScreen.appendChild(_loadingLogo);
_loadingScreen.appendChild(_loadingBarBg);
document.body.appendChild(_loadingScreen);

let _worldBuilt = false;

THREE.DefaultLoadingManager.onStart = function (url, loaded, total) {
    if (_worldBuilt) return;
    _loadingScreen.classList.remove("hidden");
};
THREE.DefaultLoadingManager.onProgress = function (url, loaded, total) {
    if (_worldBuilt) return;
    _loadingBarFill.style.width = (loaded / total) * 100 + "%";
    if (loaded >= total) {
        _worldBuilt = true;
        _loadingScreen.classList.add("hidden");
    }
};
THREE.DefaultLoadingManager.onLoad = function () { };



const STUDS_PER_TILE = 4;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 192, 486);

let fov = 85;
const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 3200);

function readStorageFlag(key, fallback = false) {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "1" || value === "yes" || value === "true" || value === "on";
}

function readStorageNumber(key, fallback, min = -Infinity, max = Infinity) {
    const value = Number(localStorage.getItem(key));
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

let enableShadows = readStorageFlag('enableShadows', false);
const renderer = new THREE.WebGLRenderer({
    antialias: readStorageFlag('v22Antialias', false),
    powerPreference: "high-performance",
});
renderer.setClearColor(0x87CEEB);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = enableShadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
document.getElementById("scene").appendChild(renderer.domElement);
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function readToneMappingMode() {
    const value = String(localStorage.getItem('v22ToneMapping') || 'none').toLowerCase();
    return value === 'agx' || value === 'aces' ? value : 'none';
}

function toneMappingConstant(mode) {
    if (mode === 'agx' && THREE.AgXToneMapping !== undefined) return THREE.AgXToneMapping;
    if (mode === 'aces' && THREE.ACESFilmicToneMapping !== undefined) return THREE.ACESFilmicToneMapping;
    return THREE.NoToneMapping;
}

let toneMappingMode = readToneMappingMode();
renderer.toneMapping = toneMappingConstant(toneMappingMode);

function markSceneMaterialsForShaderUpdate(root = scene) {
    root.traverse?.((obj) => {
        const material = obj.material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const mat of materials) mat.needsUpdate = true;
    });
}

function setToneMappingMode(mode) {
    const next = String(mode || '').toLowerCase();
    toneMappingMode = next === 'agx' || next === 'aces' ? next : 'none';
    renderer.toneMapping = toneMappingConstant(toneMappingMode);
    localStorage.setItem('v22ToneMapping', toneMappingMode);
    markSceneMaterialsForShaderUpdate();
    return toneMappingMode;
}

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = enableShadows;
const shadowMapSize = readStorageNumber('v22ShadowMapSize', 1024, 256, 4096);
sun.shadow.mapSize.width = shadowMapSize;
sun.shadow.mapSize.height = shadowMapSize;
sun.shadow.camera.near = 0.1;
const s = 350;
sun.shadow.camera.far = 2 * s;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.autoUpdate = enableShadows;
sun.shadow.bias = -0.000002;
scene.add(sun);
const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 0, 0);
scene.add(sunTarget);
sun.target = sunTarget;
const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
backLight.position.set(-160, 500, -160);
backLight.castShadow = false;
window.backLight = backLight;
scene.add(backLight);

function shadowsActive() {
    return !!enableShadows && !!renderer.shadowMap.enabled;
}

function syncSceneShadowFlags(root = scene) {
    const active = shadowsActive();
    root.traverse?.((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = active;
        obj.receiveShadow = active;
    });
}

function setShadowsEnabled(value) {
    enableShadows = !!value;
    sun.castShadow = enableShadows;
    sun.shadow.autoUpdate = enableShadows;
    renderer.shadowMap.enabled = enableShadows;
    renderer.shadowMap.needsUpdate = enableShadows;
    localStorage.setItem('enableShadows', enableShadows ? 'yes' : 'no');
    syncSceneShadowFlags();
    return enableShadows;
}

function updateLightingForFrame() {
    if (!shadowsActive()) return;
    sun.position.set(camera.position.x + 50, camera.position.y + 100, camera.position.z + 50);
    sunTarget.position.copy(camera.position);
    sunTarget.updateMatrixWorld();
    sun.updateMatrixWorld();
}

const VortexPerf = window.VortexPerf || {};
Object.assign(VortexPerf, {
    enabled: readStorageFlag('v22Perf', false),
    log: false,
    frames: 0,
    totals: Object.create(null),
    lastReport: null,
    lastRafAt: null,
    rafSamples: 0,
    rafTotal: 0,
    rafMin: Infinity,
    rafMax: 0,
    rafLongFrames: 0,
    reset(clearLastReport = false) {
        this.frames = 0;
        this.totals = Object.create(null);
        this.lastRafAt = null;
        this.rafSamples = 0;
        this.rafTotal = 0;
        this.rafMin = Infinity;
        this.rafMax = 0;
        this.rafLongFrames = 0;
        if (clearLastReport) this.lastReport = null;
    },
    setEnabled(value) {
        this.enabled = !!value;
        localStorage.setItem('v22Perf', this.enabled ? '1' : '0');
        this.reset(true);
        return this.enabled;
    },
    setLog(value) {
        this.log = !!value;
        return this.log;
    },
    stop() {
        this.enabled = false;
        this.log = false;
        localStorage.setItem('v22Perf', '0');
        localStorage.removeItem('v22PerfLog');
        this.reset(true);
        return true;
    },
    begin(now) {
        if (!this.enabled) return null;
        if (this.lastRafAt !== null && Number.isFinite(now)) {
            const rafDt = Math.max(0, now - this.lastRafAt);
            this.rafSamples++;
            this.rafTotal += rafDt;
            this.rafMin = Math.min(this.rafMin, rafDt);
            this.rafMax = Math.max(this.rafMax, rafDt);
            if (rafDt > 34) this.rafLongFrames++;
        }
        if (Number.isFinite(now)) this.lastRafAt = now;
        const start = performance.now();
        return { frameStart: start, mark: start, rafNow: now };
    },
    mark(frame, name) {
        if (!frame) return;
        const now = performance.now();
        this.totals[name] = (this.totals[name] || 0) + (now - frame.mark);
        frame.mark = now;
    },
    end(frame) {
        if (!frame) return;
        const now = performance.now();
        this.totals.frame = (this.totals.frame || 0) + (now - frame.frameStart);
        this.frames++;
        if (this.frames >= 180) {
            this.lastReport = this.report();
            if (this.log) {
                console.table(this.lastReport.sections);
                console.table(this.lastReport.cadence);
                console.table(this.lastReport.renderer);
            }
            this.reset();
        }
    },
    report() {
        if (this.frames === 0 && this.lastReport) return this.lastReport;
        const frames = Math.max(1, this.frames);
        const sections = {};
        for (const [name, value] of Object.entries(this.totals)) {
            sections[name] = Number((value / frames).toFixed(3));
        }
        const avgRafMs = this.rafSamples ? this.rafTotal / this.rafSamples : 0;
        const info = renderer.info;
        return {
            frames: this.frames,
            sections,
            cadence: {
                samples: this.rafSamples,
                avgRafMs: Number(avgRafMs.toFixed(3)),
                estimatedPresentedFps: avgRafMs > 0 ? Number((1000 / avgRafMs).toFixed(1)) : 0,
                minRafMs: Number((Number.isFinite(this.rafMin) ? this.rafMin : 0).toFixed(3)),
                maxRafMs: Number(this.rafMax.toFixed(3)),
                longFramesOver34ms: this.rafLongFrames
            },
            renderer: {
                calls: info.render.calls,
                triangles: info.render.triangles,
                points: info.render.points,
                lines: info.render.lines,
                geometries: info.memory.geometries,
                textures: info.memory.textures,
                programs: info.programs?.length ?? 0
            },
            quality: window.VortexQuality?.get?.() || null
        };
    },
    sample(seconds = 5, options = {}) {
        const previousLog = this.log;
        this.enabled = true;
        this.log = !!options.log;
        localStorage.setItem('v22Perf', '1');
        this.reset(true);
        const duration = Math.max(1, Math.min(30, Number(seconds) || 5)) * 1000;
        return new Promise((resolve) => {
            setTimeout(() => {
                const report = this.report();
                this.log = previousLog;
                resolve(report);
            }, duration);
        });
    }
});
window.VortexPerf = VortexPerf;

const tlLoader = new THREE.TextureLoader();
const texCache = new Map();
let importedAssets = JSON.parse(window._importedAssets.content);
const maxTextureAnisotropy = Math.min(4, renderer.capabilities?.getMaxAnisotropy?.() || 1);

function cachedTexture(kind, url, rx, ry) {
    const key = `${kind}|${url}|${Number(rx).toFixed(4)}|${Number(ry).toFixed(4)}`;
    if (texCache.has(key)) return texCache.get(key);
    const texture = tlLoader.load(url);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.anisotropy = maxTextureAnisotropy;
    if (kind === "stud" && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, texture);
    return texture;
}

function studTex(rx, ry) {
    return cachedTexture("stud", importedAssets.stud, rx, ry);
}
function studNormalTex(rx, ry) {
    return cachedTexture("normal", importedAssets.studNormal, rx, ry);
}
function makeCube(width, height, depth) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const flat = geo.toNonIndexed();
    const pos = flat.attributes.position;
    const uv = [];
    for (let i = 0; i < pos.count; i += 6) {
        const verts = [];
        for (let v = 0; v < 6; v++) {
            verts.push({
                x: pos.getX(i + v),
                y: pos.getY(i + v),
                z: pos.getZ(i + v),
            });
        }
        const axes = ['x', 'y', 'z'];
        const varying = axes.filter(a => {
            const vals = verts.map(v => v[a]);
            return Math.max(...vals) - Math.min(...vals) > 0;
        });
        const [uAxis, vAxis] = varying;
        const uMin = Math.min(...verts.map(v => v[uAxis]));
        const vMin = Math.min(...verts.map(v => v[vAxis]));
        for (let v = 0; v < 6; v++) {
            uv.push(
                verts[v][uAxis] - uMin,
                verts[v][vAxis] - vMin,
            );
        }
    }
    flat.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return flat;
}

function makeQuadSphere(radius, subs) {
    const geometry = new THREE.BoxGeometry(1, 1, 1, subs, subs, subs);
    const pos = geometry.attributes.position;
    const normal = new THREE.Float32BufferAttribute(pos.count * 3, 3);
    const uv = geometry.attributes.uv;
    const posVec = new THREE.Vector3();
    const uvVec = new THREE.Vector2();
    const halfU = 0.5;
    const halfV = 0.5;
    for (let i = 0; i < pos.count; i++) {
        posVec.fromBufferAttribute(pos, i);
        const len = posVec.length();
        const scale = 1///len; //apparently in roblox balls don't have correct uvs?
        uvVec.fromBufferAttribute(uv, i);
        uv.setXY(i, halfU + (uvVec.x - halfU) * scale, halfV + (uvVec.y - halfV) * scale);
        posVec.normalize().multiplyScalar(radius);
        pos.setXYZ(i, posVec.x, posVec.y, posVec.z);
        normal.setXYZ(i, posVec.x / radius, posVec.y / radius, posVec.z / radius);
    }
    geometry.setAttribute("normal", normal);
    uv.needsUpdate = true;
    return geometry;
}
function makeCylinder(radiusTop, radiusBottom, height, radialSegs, heightSegs) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const halfH = height / 2;
    for (let y = 0; y <= heightSegs; y++) {
        const t = y / heightSegs;
        const r = radiusTop + (radiusBottom - radiusTop) * t;
        const posY = halfH - t * height;
        const slope = (radiusBottom - radiusTop) / height;
        for (let x = 0; x <= radialSegs; x++) {
            const theta = (x / radialSegs) * Math.PI * 2;
            const sin = Math.sin(theta);
            const cos = Math.cos(theta);
            positions.push(cos * r, posY, sin * r);
            const nx = cos;
            const ny = slope;
            const nz = sin;
            const nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
            normals.push(nx/nLen, ny/nLen, nz/nLen);
            uvs.push((x / radialSegs) * Math.PI * 2 * Math.max(radiusTop, radiusBottom), t * height);
        }
    }
    const ringVerts = radialSegs + 1;
    for (let y = 0; y < heightSegs; y++) {
        for (let x = 0; x < radialSegs; x++) {
            const a = y * ringVerts + x;
            const b = a + ringVerts;
            const c = b + 1;
            const d = a + 1;
            indices.push(a, d, b);
            indices.push(b, d, c);
        }
    }
    function addCap(radius, posY, normalY) {
        const centerIdx = positions.length / 3;
        positions.push(0, posY, 0);
        normals.push(0, normalY, 0);
        uvs.push(0, 0);
        for (let x = 0; x <= radialSegs; x++) {
            const theta = (x / radialSegs) * Math.PI * 2;
            const sin = Math.sin(theta);
            const cos = Math.cos(theta);
            positions.push(cos * radius, posY, sin * radius);
            normals.push(0, normalY, 0);
            uvs.push(cos * radius, sin * radius);
        }
        for (let x = 0; x < radialSegs; x++) {
            const a = centerIdx;
            const b = centerIdx + 1 + x;
            const c = centerIdx + 1 + x + 1;
            if (normalY > 0) {
                indices.push(a, c, b);
            } else {
                indices.push(a, b, c);
            }
        }
    }
    addCap(radiusTop,    halfH,  1);
    addCap(radiusBottom, -halfH, -1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry.toNonIndexed();
}
function makeWedge(width, height, depth) {
    const shape = new THREE.Shape();
    const hw = width * 0.5;
    const hh = height * 0.5;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, -hh);
    const extrudeSettings = {
        depth,
        bevelEnabled: false
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
}

function makeCornerWedge(width, height, depth) {
    const hw = width * 0.5;
    const hh = height * 0.5;
    const hd = depth * 0.5;
    let geometry = new THREE.BufferGeometry();
    const vertices = [
        hw, -hh, -hd, // 0
        -hw, -hh, -hd, // 1
        hw, -hh, hd, // 2
        -hw, -hh, hd, // 3
        -hw, hh, -hd, // 4
    ];
    const indices = [
        1, 2, 3,
        0, 2, 1,

        0, 1, 4,

        4, 1, 3,

        2, 0, 4,
        2, 4, 3,
    ];
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
    const diagDepth = height + depth  /*Math.sqrt(height*height+depth*depth)*/;
    const diagWidth = height + width  /*Math.sqrt(height*height+width*width)*/;
    const uvs = [
        0, 0, width, depth, 0, depth,
        width, 0, width, depth, 0, 0,

        0, 0, width, 0, width, height,

        depth, height, depth, 0, 0, 0,

        depth, diagWidth, 0, diagWidth, 0, 0,

        diagDepth, width, 0, 0, diagDepth, 0,
    ];
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
}

const geoCache = new Map();
const matCache = new Map();

function getCachedGeo(sw, sh, sd, shape = "Block") {
    if (shape == "Block") {
        const key = `${shape},${sw},${sh},${sd}`;
        if (!geoCache.has(key)) geoCache.set(key, makeCube(sw, sh, sd));
        return geoCache.get(key);
    } else if (shape == "Ball") {
        const radi = Math.min(sw, sh, sd);
        const key = `${shape},${radi}`;
        if (!geoCache.has(key)) geoCache.set(key, makeQuadSphere(radi * 0.5, 6));
        return geoCache.get(key);
    } else if (shape == "Cylinder") {
        const radi = Math.min(sh, sd);
        const key = `${shape},${radi},${sw}`;
        if (!geoCache.has(key)) geoCache.set(key, makeCylinder(radi*0.5,radi*0.5,sw,20,1));
        return geoCache.get(key);
    } else if (shape == "Cylinder2") {
        const radi = Math.min(sw, sd);
        const key = `${shape},${radi},${sh}`;
        if (!geoCache.has(key)) geoCache.set(key, makeCylinder(radi*0.5,radi*0.5,sh,20,1));
        return geoCache.get(key);
    } else if (shape == "Wedge") {
        const key = `${shape},${sw},${sh},${sd}`;
        if (!geoCache.has(key)) geoCache.set(key, makeWedge(sd, sh, sw));
        return geoCache.get(key);
    } else if (shape == "CornerWedge") {
        const key = `${shape},${sw},${sh},${sd}`;
        if (!geoCache.has(key)) geoCache.set(key, makeCornerWedge(sd, sh, sw));
        return geoCache.get(key);
    } else {
        console.log(`unknown shape: ${shape}`)
    }
}

function getCachedMats(sw, sh, sd, color, shape = "Block", transparency = 0) {
    if (shape == "Block" || shape == "Wedge" || shape == "CornerWedge" || shape == "Cylinder" || shape == "Cylinder2") {
        const key = `c${color}t${transparency}`;
        if (matCache.has(key)) return matCache.get(key);
        const m = (rx, ry) => new THREE.MeshPhongMaterial({ color: color, map: studTex(rx, ry), normalMap: studNormalTex(rx, ry), shininess: 80, transparent: transparency > 0, opacity: 1 - transparency, fog: true });
        if (transparency > 0.7) m.castShadow = false;
        const mats = m(1 / STUDS_PER_TILE, 1 / STUDS_PER_TILE);
        matCache.set(key, mats);
        return mats;
    } else if (shape == "Ball") {
        const radi = Math.min(sw, sh, sd);
        const key = `s${shape},r${radi},c${color}t${transparency}`;
        if (matCache.has(key)) return matCache.get(key);
        const m = (rx, ry) => new THREE.MeshPhongMaterial({ color: color, map: studTex(rx, ry), normalMap: studNormalTex(rx, ry), shininess: 80, transparent: transparency > 0, opacity: 1 - transparency, fog: true });
        if (transparency > 0.7) m.castShadow = false;
        const mats = m(radi / STUDS_PER_TILE, radi / STUDS_PER_TILE);
        matCache.set(key, mats);
        return mats;
    }
}

const colliders = [];

const CHUNK_SIZE = 4;
const chunkMap = new Map();

const _dummy = new THREE.Object3D();
const stud_datas = [];
const objects = [];
function addStud(sw, sh, sd, color, x, y, z, rx = 0, ry = 0, rz = 0, shape = "Block", transparency = 0, staticMesh = false, canCollide = true, rotationOrder = 'YXZ') {
    const mesh = new THREE.Mesh(
        getCachedGeo(sw, sh, sd, shape),
        getCachedMats(sw, sh, sd, color, shape, transparency)
    );
    const cy = y + sh / 2;
    mesh.rotation.order = rotationOrder || 'YXZ';
    if (shape == "Cylinder") {
        mesh.position.set(x, cy, z);
        mesh.rotation.set(rx, ry, rz + Math.PI * 0.5);
    } else if (shape == "Wedge") {
        mesh.position.set(x, cy, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), - Math.PI * 0.5)
    } else if (shape == "CornerWedge") {
        mesh.position.set(x, cy, z);
        mesh.rotation.set(rx, ry, rz);
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), - Math.PI * 0.5)
    } else {
        mesh.position.set(x, cy, z);
        mesh.rotation.set(rx, ry, rz);
    }
    mesh.castShadow = shadowsActive();
    mesh.receiveShadow = shadowsActive();
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    mesh.updateMatrix();
    if (!staticMesh) scene.add(mesh);
    let b;
    if (shape == "Ball") {
        sw *= 0.7;
        sh *= 0.7;
        sd *= 0.7;
    }
    if (canCollide) {
        if (rx === 0 && ry === 0 && rz === 0) {
            b = {
                minX: x - sw / 2, maxX: x + sw / 2,
                minY: y, maxY: y + sh,
                minZ: z - sd / 2, maxZ: z + sd / 2,
            };
            colliders.push(b);
            insertToChunks(b);
        } else {
            b = buildOBB(sw, sh, sd, x, cy, z, rx, ry, rz, mesh.rotation.order);
            colliders.push(b);
            insertToChunks(b);
        }
    }
    const m = staticMesh ? (null) : (mesh);
    let stud_id = stud_datas.push({ m, b, canCollide, sw, sh, sd, color, shape, transparency }) - 1;
    mesh.stud_id = stud_id;
    if (!staticMesh && canCollide) objects.push(mesh);
    return [mesh, stud_id];
}


function buildOBB(sw, sh, sd, cx, cy, cz, rx, ry, rz, rotationOrder = 'YXZ') {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, rotationOrder || 'YXZ'));
    const e = m.elements;

    const ux = e[0], uy = e[1], uz = e[2];
    const vx = e[4], vy = e[5], vz = e[6];
    const wx = e[8], wy = e[9], wz = e[10];
    const hx = sw / 2, hy = sh / 2, hz = sd / 2;

    const ex = hx * Math.abs(ux) + hy * Math.abs(vx) + hz * Math.abs(wx);
    const ey = hx * Math.abs(uy) + hy * Math.abs(vy) + hz * Math.abs(wy);
    const ez = hx * Math.abs(uz) + hy * Math.abs(vz) + hz * Math.abs(wz);
    return {
        isOBB: true,
        cx, cy, cz,
        hx, hy, hz,
        ux, uy, uz,
        vx, vy, vz,
        wx, wy, wz,
        minX: cx - ex, maxX: cx + ex,
        minY: cy - ey, maxY: cy + ey,
        minZ: cz - ez, maxZ: cz + ez,
    };
}

function chunkKey(cx, cy, cz) { return `${cx},${cy},${cz}`; }
function worldToChunk(x) { return Math.floor(x / CHUNK_SIZE); }

function insertToChunks(b) {
    const x0 = worldToChunk(b.minX), x1 = worldToChunk(b.maxX);
    const y0 = worldToChunk(b.minY), y1 = worldToChunk(b.maxY);
    const z0 = worldToChunk(b.minZ), z1 = worldToChunk(b.maxZ);
    for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
            for (let cz = z0; cz <= z1; cz++) {
                const key = chunkKey(cx, cy, cz);
                if (!chunkMap.has(key)) chunkMap.set(key, new Set());
                chunkMap.get(key).add(b);
            }
        }
    }
}

function removeMatching_map(a, b) {
    for (const [key, value] of a.entries()) {
        if (JSON.stringify(value) === JSON.stringify(b)) {
            a.delete(key);
        }
    }
}
function removeMatching_array(arr, b) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (JSON.stringify(arr[i]) === JSON.stringify(b)) {
            arr.splice(i, 1);
        }
    }
}


function removeCollider(b) {
    const x0 = worldToChunk(b.minX), x1 = worldToChunk(b.maxX);
    const y0 = worldToChunk(b.minY), y1 = worldToChunk(b.maxY);
    const z0 = worldToChunk(b.minZ), z1 = worldToChunk(b.maxZ);
    for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
            for (let cz = z0; cz <= z1; cz++) {
                const key = chunkKey(cx, cy, cz);
                if (!chunkMap.has(key)) continue;
                removeMatching_map(chunkMap.get(key), b);
            }
        }
    }
    removeMatching_array(colliders, b);
}

function removeStud(stud_id) {
    let data = stud_datas[stud_id];
    if (data) {
        let mesh = data.m;
        let b = data.b;
        if (b) {
            removeCollider(b);
        }
        if (mesh) {
            scene.remove(mesh);
        }

        for (let i = 0; i < objects.length; i++) {
            if (objects[i].stud_id == stud_id) {
                objects.splice(i, 1);
                break;
            }
        }
        stud_datas[stud_id] = null;
    }
}

function rebuildStudCollider(stud_id, canCollide = true) {
    const data = stud_datas[stud_id];
    if (!data || !data.m) return false;
    if (data.b) {
        removeCollider(data.b);
        data.b = null;
    }
    data.canCollide = !!canCollide;
    if (!data.canCollide) return true;
    data.m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(data.m);
    const b = {
        minX: box.min.x, maxX: box.max.x,
        minY: box.min.y, maxY: box.max.y,
        minZ: box.min.z, maxZ: box.max.z,
    };
    data.b = b;
    colliders.push(b);
    insertToChunks(b);
    if (!objects.includes(data.m)) objects.push(data.m);
    return true;
}

const _nearbySet = new Set();

function getNearbyColliders(px, py, pz) {
    _nearbySet.clear();
    const cx = worldToChunk(px), cy = worldToChunk(py), cz = worldToChunk(pz);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                const bucket = chunkMap.get(chunkKey(cx + dx, cy + dy, cz + dz));
                if (bucket) bucket.forEach(b => _nearbySet.add(b));
            }
        }
    }
    return _nearbySet;
}

const G = 1.6;
window.G = G;

let CHAR_STAND_Y = 3.68;
const WALK_SPEED = 16;
const JUMP_POWER = 50;
const GRAVITY = -196.2;
const ROT_SPEED = 10;
const STEP_HEIGHT = 1.4;
const STEP_CLIMB_SPEED = 32;

let CHAR_FOOT_OFFSET = 2.08;
let CHAR_HEIGHT = 5;
let CHAR_HALF_W = 1;
let CHAR_HALF_D = 0.5;

let CAM_H_SENS = 0.0015 * Math.PI;
let CAM_V_SENS = 0.0015 * Math.PI;
const CAM_PIVOT_Y = 2.56;
const CAM_REFERENCE_FOOT_OFFSET = 2.08;
const SHIFT_LOCK_OFFSET = 1.75;
const CAM_KEY_ZOOM_SPEED = 32;

let debugMode = false;
const debugMeshes = [];
let charDebugMesh = null;
let chunkZoneMesh = null;

function makeWireBox(minX, minY, minZ, maxX, maxY, maxZ, color) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ));
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false });
    const m = new THREE.LineSegments(geo, mat);
    m.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    m.renderOrder = 999;
    return m;
}

function makeWireOBB(b) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2));
    const mat = new THREE.LineBasicMaterial({ color: 0xff8800, depthTest: false });
    const m = new THREE.LineSegments(geo, mat);
    m.position.set(b.cx, b.cy, b.cz);
    const mat4 = new THREE.Matrix4();
    mat4.set(
        b.ux, b.vx, b.wx, 0,
        b.uy, b.vy, b.wy, 0,
        b.uz, b.vz, b.wz, 0,
        0, 0, 0, 1
    );
    m.setRotationFromMatrix(mat4);
    m.renderOrder = 999;
    return m;
}

function toggleDebug() {
    debugMode = !debugMode;
    if (debugMode) {
        charDebugMesh = makeWireBox(-CHAR_HALF_W, 0, -CHAR_HALF_D, CHAR_HALF_W, CHAR_HEIGHT, CHAR_HALF_D, 0xff4444);
        scene.add(charDebugMesh);
    } else {
        debugMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); scene.remove(m); });
        debugMeshes.length = 0;
        if (charDebugMesh) { charDebugMesh.geometry.dispose(); charDebugMesh.material.dispose(); scene.remove(charDebugMesh); charDebugMesh = null; }
        if (chunkZoneMesh) { chunkZoneMesh.geometry.dispose(); chunkZoneMesh.material.dispose(); scene.remove(chunkZoneMesh); chunkZoneMesh = null; }
    }
}

function updateDebugMeshes() {
    if (!debugMode || !character) return;

    debugMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); scene.remove(m); });
    debugMeshes.length = 0;
    if (chunkZoneMesh) { chunkZoneMesh.geometry.dispose(); chunkZoneMesh.material.dispose(); scene.remove(chunkZoneMesh); chunkZoneMesh = null; }

    const px = character.position.x, pz = character.position.z;
    const nearby = getNearbyColliders(px, character.position.y, pz);

    for (const b of nearby) {
        let m;
        if (b.isOBB) {
            m = makeWireOBB(b);
        } else {
            m = makeWireBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, 0xffff00);
        }
        scene.add(m);
        debugMeshes.push(m);
    }

    const cx = worldToChunk(px), cz = worldToChunk(pz);
    const zoneMinX = (cx - 1) * CHUNK_SIZE, zoneMaxX = (cx + 2) * CHUNK_SIZE;
    const zoneMinZ = (cz - 1) * CHUNK_SIZE, zoneMaxZ = (cz + 2) * CHUNK_SIZE;
    const zoneH = 512;
    chunkZoneMesh = makeWireBox(zoneMinX, -zoneH / 2, zoneMinZ, zoneMaxX, zoneH / 2, zoneMaxZ, 0x00ccff);
    scene.add(chunkZoneMesh);
}

let velY = 0;
let grounded = true;
let stepUpTarget = -Infinity;
const pushedBlocks = new Set();
let shiftLock = false;
window.locked = false;
let coyoteTimer = 0;
let jumpBuffer = 0;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.05;

let climbState = 'none';
let climbLedgeY = 0;
let climbFwdX = 0, climbFwdZ = 0;
let climbBlock = null;
let climbCooldown = 0;
const CLIMB_RISE_SPEED = 11.2;
const CLIMB_SIDE_SPEED = 11.2;
const CLIMB_REACH = 0.1;
const CLIMB_FALL_CUTOFF = -200;
const CLIMB_MAX_PART_H = 1.5;
const CLIMB_WINDOW = 2.2;
const CLIMB_JUMP_UP = 38;
const CLIMB_JUMP_BACK_V = 14;
const HANG_DEPTH = 1.2;

let extraVelX = 0, extraVelZ = 0;
const movementMods = {
    fly: false,
    noclip: false,
    airwalk: false,
    gravityScale: 1,
    flySpeed: 28
};

function setMovementMods(patch = {}) {
    if (patch.fly !== undefined) movementMods.fly = !!patch.fly;
    if (patch.noclip !== undefined) movementMods.noclip = !!patch.noclip;
    if (patch.airwalk !== undefined) movementMods.airwalk = !!patch.airwalk;
    if (patch.gravityScale !== undefined) {
        const scale = Number(patch.gravityScale);
        movementMods.gravityScale = Number.isFinite(scale) ? Math.max(0, Math.min(8, scale)) : 1;
    }
    if (patch.flySpeed !== undefined) {
        const speed = Number(patch.flySpeed);
        movementMods.flySpeed = Number.isFinite(speed) ? Math.max(2, Math.min(120, speed)) : 28;
    }
    if (movementMods.fly || movementMods.airwalk) {
        velY = 0;
        grounded = true;
        jumpBuffer = 0;
        climbState = 'none';
    }
    return { ...movementMods };
}

function getMovementMods() {
    return { ...movementMods };
}

const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const cursorEl = document.getElementById('cursor');

let leaveButton = document.createElement('span')
leaveButton.innerHTML = 'Leave'
overlay.appendChild(leaveButton);
let yousure = false;
leaveButton.onclick = function () {
    if (yousure) {
        window.location.href = "https://vortex.towerstats.com/";
    } else {
        yousure = true;
        leaveButton.innerText = 'You sure?'
        setTimeout(() => {
            leaveButton.innerText = 'Leave'
            yousure = false;
        }, 2000);
    }

}
Object.assign(overlay.style, {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '100px'
});

let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;

const anim = { time: 0, bones: {}, rest: {} };

function getBone(...names) {
    for (const n of names) if (anim.bones[n]) return anim.bones[n];
    return null;
}

let character = null;
let _spawnPoint = { x: 0, y: null, z: 0, ry: Math.PI };
let _shirtMesh = null;
let _pantsMesh = null;
let _faceMesh = null;
let _avatarRenderer = localStorage.getItem("v22AvatarRenderer") || "modern";
let _avatarState = {
    shirt_id: 0,
    pant_id: 0,
    body_type: "male",
    body_colors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    face_id: 0
};
const _clothingImageCache = new Map();
const _clothingImageInflight = new Map();
const _clothingImageQueue = new Set();
let _clothingImageTimer = null;
const CLOTHING_IMAGE_TTL_MS = 5 * 60 * 1000;
const CLOTHING_IMAGE_RETRY_MS = 30 * 1000;

const fbxLoader = new THREE.FBXLoader();
const gltfLoader = new THREE.GLTFLoader();

function _canonicalBoneName(name) {
    return String(name || "").replace(/\s+/g, "_");
}

const _neutralAvatarState = {
    shirt_id: 0,
    pant_id: 0,
    body_type: "male",
    body_colors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    face_id: 0
};

function _normalizeAvatar(avatar = {}, fallback = _avatarState) {
    const base = fallback || _neutralAvatarState;
    const colors = Array.isArray(avatar.body_colors) ? avatar.body_colors : (Array.isArray(avatar.bodyColors) ? avatar.bodyColors : base.body_colors);
    const outColors = [];
    for (let i = 0; i < 6; i++) {
        const color = String(colors[i] || "#ffffff").trim();
        outColors.push(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "#ffffff");
    }
    return {
        shirt_id: Number(avatar.shirt_id ?? avatar.shirtId ?? base.shirt_id ?? 0) || 0,
        pant_id: Number(avatar.pant_id ?? avatar.pantId ?? base.pant_id ?? 0) || 0,
        body_type: String(avatar.body_type ?? avatar.bodyType ?? base.body_type ?? "male").toLowerCase() === "female" ? "female" : "male",
        body_colors: outColors,
        face_id: Number(avatar.face_id ?? avatar.faceId ?? base.face_id ?? 0) || 0
    };
}

async function _modernClothingUrl(id) {
    id = Number(id || 0);
    if (!id) return null;
    const cached = _getClothingImageCache(id);
    if (cached.hit) return cached.url;
    if (_clothingImageInflight.has(id)) return _clothingImageInflight.get(id).promise;

    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    _clothingImageInflight.set(id, { promise, resolve });
    _clothingImageQueue.add(id);

    if (!_clothingImageTimer) {
        _clothingImageTimer = setTimeout(_flushClothingImageQueue, 0);
    }

    return promise;
}

function _getClothingImageCache(id) {
    const entry = _clothingImageCache.get(id);
    if (!entry) return { hit: false, url: null };
    if (entry.expiresAt <= Date.now()) {
        _clothingImageCache.delete(id);
        return { hit: false, url: null };
    }
    return { hit: true, url: entry.url };
}

function _setClothingImageCache(id, url, ttlMs) {
    _clothingImageCache.set(id, {
        url: url || null,
        expiresAt: Date.now() + ttlMs
    });
}

function _readClothingImageUrl(data, id) {
    if (!data) return null;
    const direct = data[String(id)] ?? data[id];
    if (typeof direct === "string") return direct;
    const nested = data.images?.[String(id)] ?? data.images?.[id] ?? data.urls?.[String(id)] ?? data.urls?.[id];
    if (typeof nested === "string") return nested;
    const list = Array.isArray(data) ? data : (Array.isArray(data.images) ? data.images : []);
    const match = list.find((item) => Number(item?.id) === Number(id));
    return typeof match?.url === "string" ? match.url : (typeof match?.image === "string" ? match.image : null);
}

async function _flushClothingImageQueue() {
    const queued = [..._clothingImageQueue];
    _clothingImageQueue.clear();
    _clothingImageTimer = null;

    const ids = [];
    for (const id of queued) {
        const cached = _getClothingImageCache(id);
        if (cached.hit) {
            const pending = _clothingImageInflight.get(id);
            _clothingImageInflight.delete(id);
            pending?.resolve(cached.url);
        } else {
            ids.push(id);
        }
    }

    if (!ids.length) return;

    let data = null;
    let failed = false;
    try {
        const res = await fetch(`/api/clothing/images?ids=${ids.map((item) => encodeURIComponent(item)).join(",")}`, { credentials: "same-origin", cache: "force-cache" });
        if (!res.ok) {
            failed = true;
            if (res.status === 429) console.warn(`[avatar] clothing image lookup rate limited for ${ids.length} item(s)`);
            else console.warn(`[avatar] clothing image lookup failed: HTTP ${res.status}`);
        } else {
            data = await res.json();
        }
    } catch (err) {
        failed = true;
        console.warn("[avatar] clothing image lookup failed", err);
    }

    for (const id of ids) {
        const url = failed ? null : _readClothingImageUrl(data, id);
        _setClothingImageCache(id, url, failed ? CLOTHING_IMAGE_RETRY_MS : CLOTHING_IMAGE_TTL_MS);
        const pending = _clothingImageInflight.get(id);
        _clothingImageInflight.delete(id);
        pending?.resolve(url || null);
    }

    if (_clothingImageQueue.size && !_clothingImageTimer) {
        _clothingImageTimer = setTimeout(_flushClothingImageQueue, 0);
    }
}

async function _avatarClothingUrl(id) {
    id = Number(id || 0);
    return id ? `/api/clothing/image/${encodeURIComponent(id)}` : null;
}

function _avatarImageIds(avatar) {
    const normalized = _normalizeAvatar(avatar, _neutralAvatarState);
    return [normalized.shirt_id, normalized.pant_id, normalized.face_id].filter((id) => Number(id) > 0);
}

function _prefetchAvatarImages(avatars = []) {
    const unique = new Set();
    for (const avatar of avatars) {
        for (const id of _avatarImageIds(avatar)) unique.add(id);
    }
    for (const id of unique) _modernClothingUrl(id).catch(() => null);
}

function _registerBone(child) {
    const name = child.name;
    const alias = _canonicalBoneName(name);
    const rest = {
        x: child.rotation.x, y: child.rotation.y, z: child.rotation.z,
        px: child.position.x, py: child.position.y, pz: child.position.z,
    };
    anim.bones[name] = child;
    anim.rest[name] = rest;
    anim.bones[alias] = child;
    anim.rest[alias] = rest;
}

function _disposeCharacter(root) {
    if (!root) return;
    scene.remove(root);
    root.traverse((obj) => {
        if (obj.geometry && /Overlay$/.test(obj.name || "")) obj.geometry.dispose?.();
        if (obj.material && /Overlay$/.test(obj.name || "")) {
            obj.material.map?.dispose?.();
            obj.material.dispose?.();
        }
    });
}

function _prepareCharacterModel(model) {
    const previous = character;
    const previousFootY = previous ? previous.position.y - CHAR_FOOT_OFFSET : null;
    const previousRotationY = previous ? previous.rotation.y : _spawnPoint.ry;
    const previousPosition = previous ? previous.position.clone() : null;

    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    CHAR_FOOT_OFFSET = -box.min.y;
    CHAR_HEIGHT = box.max.y - box.min.y;
    CHAR_STAND_Y = G + CHAR_FOOT_OFFSET;
    console.log('char foot offset:', CHAR_FOOT_OFFSET.toFixed(3), '| height:', CHAR_HEIGHT.toFixed(3), '| renderer:', _avatarRenderer);

    const spawnY = previousFootY !== null
        ? previousFootY + CHAR_FOOT_OFFSET
        : (_spawnPoint.y !== null ? _spawnPoint.y + CHAR_FOOT_OFFSET : CHAR_STAND_Y);
    model.position.set(
        previousPosition ? previousPosition.x : _spawnPoint.x,
        spawnY,
        previousPosition ? previousPosition.z : _spawnPoint.z
    );
    model.rotation.y = previousRotationY;
    model.castShadow = shadowsActive();

    anim.bones = {};
    anim.rest = {};
    model.traverse(child => {
        if (child.isBone || child.type === 'Bone') _registerBone(child);
        if (child.isMesh) {
            child.castShadow = shadowsActive();
            child.receiveShadow = shadowsActive();
        }
    });

    _disposeCharacter(previous);
    scene.add(model);
    character = model;
    window.character = character;
    if (_avatarRenderer === "modern") {
        _prepareModernAvatarMaterials(model);
        _shirtMesh = null;
        _pantsMesh = null;
        _faceMesh = null;
    } else {
        _shirtMesh = _buildShirtOverlay(model);
        _pantsMesh = null;
        _faceMesh = null;
    }
    _applyAvatar(_avatarState).catch((err) => console.warn("[avatar] apply failed", err));
    if (shadowsActive()) renderer.shadowMap.needsUpdate = true;
    window.dispatchEvent(new CustomEvent("v22-character-renderer-changed", { detail: { renderer: _avatarRenderer } }));
}

function _loadLegacyCharacter() {
    console.warn("[avatar] legacy FBX renderer is deprecated and kept only for old shirt compatibility.");
    fbxLoader.load(importedAssets.playerMdl, (fbx) => _prepareCharacterModel(fbx));
}

function _loadModernCharacter() {
    const url = _avatarState.body_type === "female" ? importedAssets.femalePlayerGlb : importedAssets.malePlayerGlb;
    gltfLoader.load(url, (gltf) => {
        const root = new THREE.Group();
        root.name = "ModernAvatarRoot";
        gltf.scene.name = "ModernAvatarVisual";
        gltf.scene.rotation.y = Math.PI;
        root.add(gltf.scene);
        _prepareCharacterModel(root);
    }, undefined, (err) => {
        console.error("[avatar] GLB load failed, falling back to legacy FBX", err);
        _avatarRenderer = "legacy";
        localStorage.setItem("v22AvatarRenderer", _avatarRenderer);
        _loadLegacyCharacter();
    });
}

function _reloadCharacter() {
    if (_avatarRenderer === "legacy") _loadLegacyCharacter();
    else _loadModernCharacter();
}

async function _applyAvatar(avatar = {}) {
    const previousBodyType = _avatarState.body_type;
    _avatarState = _normalizeAvatar(avatar);
    if (window.VortexAvatarDebug) console.debug("[avatar] local", JSON.stringify(_avatarState));
    if (character && _avatarRenderer === "modern" && previousBodyType !== _avatarState.body_type) {
        _reloadCharacter();
        return;
    }
    if (!character) return;

    if (_avatarRenderer === "modern") {
        _applyBodyColors(character, _avatarState.body_colors);
        const [shirtUrl, pantsUrl, faceUrl] = await Promise.all([
            _avatarClothingUrl(_avatarState.shirt_id).catch(() => null),
            _avatarClothingUrl(_avatarState.pant_id).catch(() => null),
            _avatarClothingUrl(_avatarState.face_id).catch(() => null),
        ]);
        _applyModernAvatarTextures(character, { shirtUrl, pantsUrl, faceUrl });
    } else {
        const shirtUrl = await _avatarClothingUrl(_avatarState.shirt_id).catch(() => null);
        _applyShirtToMesh(_shirtMesh, shirtUrl);
    }
}

function _setAvatarRenderer(mode) {
    const next = String(mode || "").toLowerCase() === "legacy" ? "legacy" : "modern";
    if (_avatarRenderer === next) return _avatarRenderer;
    _avatarRenderer = next;
    localStorage.setItem("v22AvatarRenderer", _avatarRenderer);
    _reloadCharacter();
    return _avatarRenderer;
}

_reloadCharacter();

const cam = {
    yaw: 0,
    pitch: 0.35,
    distance: 25.6,
    minPitch: -1.55,
    maxPitch: 1.55,
    minDist: 2,
    maxDist: 512,
};
const moveInput = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);
const yawQuat = new THREE.Quaternion();
const cameraPivot = new THREE.Vector3();

const runtimeInput = window.VortexRuntime && window.VortexRuntime.input;
if (runtimeInput && typeof runtimeInput.attachTarget === 'function') {
    runtimeInput.attachTarget(renderer.domElement);
}
const keys = runtimeInput && runtimeInput.keys || {};
let mouseLock = false;

function requestGamePointerLock() {
    if (runtimeInput && typeof runtimeInput.requestPointerLock === 'function') {
        runtimeInput.requestPointerLock(renderer.domElement);
    } else if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
}

function setMouseLock(sl) {
    if (mouseLock == sl) return
    mouseLock = sl;
    crosshair.style.display = mouseLock ? 'block' : 'none';
    cursorEl.style.display = mouseLock ? 'none' : 'block';
    cursorX = window.innerWidth / 2;
    cursorY = window.innerHeight / 2;
    if (!mouseLock) {
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        if (character) {
            character.rotation.y = ((character.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (character.rotation.y > Math.PI) character.rotation.y -= 2 * Math.PI;
        }
    }
}
let isFirstPerson = false;

document.addEventListener('keydown', e => {
    if (window._chatFocused) return;
    if (!window.locked) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        shiftLock = !shiftLock;
        if (!isFirstPerson) setMouseLock(shiftLock);
    }
    if (e.code === 'Comma') cam.yaw = Math.round((cam.yaw + Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4);
    if (e.code === 'Period') cam.yaw = Math.round((cam.yaw - Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4);
    if (e.code === 'Space') jumpBuffer = JUMP_BUFFER;
    if (e.code === 'Backquote') toggleDebug();
});

document.addEventListener('vortex-input-pointerlock-error', (event) => {
    console.warn('[pointer-lock] request failed', event.detail && event.detail.error);
    overlay.style.opacity = 1;
    const overlayText = overlay.querySelector('span');
    if (overlayText) overlayText.textContent = 'Click to play';
});

document.addEventListener('pointerlockchange', () => {
    window.locked = runtimeInput && typeof runtimeInput.isLocked === 'function'
        ? runtimeInput.isLocked()
        : !!document.pointerLockElement;
    if (window.locked) {
        overlay.style.opacity = 0;
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        const overlayText = overlay.querySelector('span');
        if (overlayText) overlayText.textContent = 'Click to play';
    } else {
        overlay.style.opacity = 1;
        rmb = false;
    }
});

let rmb = false;
let _sliderDrag = null;

function _cursorOver(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom;
}


const chatEl = document.getElementById('chat-window');
renderer.domElement.addEventListener('click', () => {
    if (window.locked) {
        const cursorOver = _cursorOver;
        let guiHandled = false;
        const topbarEl = document.getElementById('hud-topbar');
        const lbFriendEl = document.getElementById('lb-player-panel');
        const lbBodyEl = document.getElementById('lb-body');
        const getButton = document.getElementById("pm-get");
        const cancelButton = document.getElementById('pm-cancel')

        if (getButton && _cursorOver(getButton)) {
            getButton.click();
        }
        if (cancelButton && _cursorOver(cancelButton)) {
            cancelButton.click();
        }

        if (cursorOver(topbarEl)) {
            guiHandled = true;
            for (const child of topbarEl.children) {
                if (cursorOver(child)) { child.click(); break; }
            }
            return;
        }

        if (lbFriendEl && lbFriendEl.style.display !== 'none' && cursorOver(lbFriendEl)) {
            guiHandled = true;
            for (const child of lbFriendEl.querySelectorAll('button, a')) {
                if (cursorOver(child)) { child.click(); return; }
            }
            return;
        }

        if (lbBodyEl) {
            for (const row of lbBodyEl.querySelectorAll('[data-player-id]')) {
                if (cursorOver(row)) {
                    guiHandled = true;
                    window.Leaderboard?.selectPlayer(parseInt(row.dataset.playerId));
                    return;
                }
            }
        }

        const notifEl = document.getElementById('notif-container');
        if (notifEl) {
            for (const btn of notifEl.querySelectorAll('.notif-btn:not(:disabled)')) {
                if (cursorOver(btn)) { guiHandled = true; btn.click(); return; }
            }
        }

        if (window._chatFocused) {
            window.Chat?.deactivate();
            return;
        }

        if (cursorOver(toggleShadowsCheckBox)) {
            guiHandled = true;
            toggleShadowsCheckBox.click();
        }

        if (chatEl && !chatEl.classList.contains('hidden') && cursorOver(chatEl)) {
            const sendBtnEl = document.getElementById('chat-send');
            if (sendBtnEl && cursorOver(sendBtnEl)) {
                window.Chat?.send();
            } else {
                window.Chat?.activate();
            }
            return;
        }

        window.Leaderboard?.closeFriendPanel();
    }
    requestGamePointerLock();
});

const settingsPanel = document.getElementById('settings-panel');
settingsPanel.style.cursor = 'auto'
chatEl.style.cursor = 'auto'
const toggleShadows = document.createElement('div');
toggleShadows.className = 'sp-row';
let toggleShadowsleftText = document.createElement('span');
toggleShadowsleftText.className = 'sp-label';
toggleShadowsleftText.innerText = 'Toggle shadows'
let toggleShadowsCheckBox = document.createElement('input');
toggleShadowsCheckBox.type = "checkbox";
if (enableShadows) {
    toggleShadowsCheckBox.click();
}
toggleShadowsCheckBox.onchange = function () {
    setShadowsEnabled(toggleShadowsCheckBox.checked);
}
toggleShadows.appendChild(toggleShadowsleftText);
toggleShadows.appendChild(toggleShadowsCheckBox);


function makeSettingsSlider(text, min, max, def, step, onchange) {
    def = localStorage.getItem(text) ? parseFloat(localStorage.getItem(text)) : def;
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'sp-row';
    let sliderLeftText = document.createElement('span');
    sliderLeftText.className = 'sp-label';
    sliderLeftText.innerText = text
    let sliderSlider = document.createElement('input');
    sliderSlider.type = "range";
    sliderSlider.min = min;
    sliderSlider.max = max;
    sliderSlider.step = step;
    let sliderRightText = document.createElement('span');
    sliderRightText.className = 'sp-val';
    sliderRightText.innerText = def;
    sliderSlider.oninput = function () {
        sliderRightText.innerText = sliderSlider.value
        localStorage.setItem(text, sliderSlider.value);
        onchange(sliderSlider, Number(sliderSlider.value));
    }
    sliderContainer.appendChild(sliderLeftText);
    sliderContainer.appendChild(sliderSlider);
    sliderContainer.appendChild(sliderRightText);
    settingsPanel.appendChild(sliderContainer);
    sliderSlider.value = def;
    onchange(sliderSlider, def);
}

const oofSound = new Audio(importedAssets.oofSound)

const slashSound = new Audio(importedAssets.swordSlash);
slashSound.preload = "auto";
slashSound.volume = 0.8;
const clickSound = new Audio(importedAssets.placeBlock);
clickSound.preload = "auto";
clickSound.volume = 0.8;

settingsPanel.appendChild(toggleShadows);


var raycaster = new THREE.Raycaster();

function getClicked3DPoint() {
    let mpos = new THREE.Vector3();
    mpos.x = ((cursorX / window.innerWidth) * 2) - 1;
    mpos.y = -(((cursorY / window.innerHeight) * 2) - 1);

    raycaster.setFromCamera(mpos, camera);
    var intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {
        return [intersects[0].point, intersects[0].face.normal, intersects[0].object];
    } else {
        return [false, false, false]
    }
};

const BLOCK_COLORS = [
    0x111111,  // black
    0x555555,  // dark gray
    0xEBEBEB,  // white

    0xD83C2A,  // red
    0xD87A3A,  // orange
    0xD8C85A,  // yellow
    0x3AD85A,  // green
    0x4AC7D8,  // cyan
    0x4A6FD8,  // blue

    0xAAAAAA,  // light gray
    0xF2D2BD,  // sand
    0xD6B3FF,  // pink purple ish
    0xFFB6C1,  // pink
    0xFF7E7E,  // light red
    0xFFC58E,  // light orange
    0xFFF59E,  // light yellow
    0xB8F59E,  // light green
    0x9EF5E8,  // aqua
    0xA5C8FF,  // light blue


    0x222222,  // near black
    0x4A3422,  // dark brown
    0x3B136E,  // purple
    0x5C224D,  // dark pink
    0x4A0C0C,  // dark red
    0x5A2A0A,  // brown-orange
    0x5A5010,  // olive
    0x1E4A1E,  // dark green
    0x103C46,  // dark cyan
    0x1A237A,  // dark blue
];
const MAX_BLOCKS = 2000;

function validPlacement(x, y, z) {
    if (myBlocks.length >= MAX_BLOCKS) return false
    if (Math.abs(x) < 10 || Math.abs(z) < 10) return false
    if (Math.abs(x) > 147 || Math.abs(z) > 147) return false
    if (Math.abs(x) + Math.abs(z) < 46) return false
    if (y <= 1.5) return false
    return true;
}


let BlockDisplayMesh;
let selectedBlockState = 1;
function update_Display_Block() {
    if (!(BlockDisplayMesh)) {
        BlockDisplayMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2.01, 2.01, 2.01),
            new THREE.MeshStandardMaterial({ color: 0x123456, transparent: true, opacity: 0.5 }),
        );
        BlockDisplayMesh.position.y = -9999;
        scene.add(BlockDisplayMesh);
    }
    let [point, normal, hit] = getClicked3DPoint();
    if (point) {
        let roundedPoint = point.add(normal.multiplyScalar(1));
        roundedPoint.x = Math.round(roundedPoint.x);
        roundedPoint.y = Math.round(roundedPoint.y);
        roundedPoint.z = Math.round(roundedPoint.z);

        if (selectedBlockState < 1) {
            if (hit.stud_id && blocks.has(`block_${hit.position.x}_${hit.position.y}_${hit.position.z}`)) {
                roundedPoint.copy(hit.position);
            } else {
                BlockDisplayMesh.position.y = -9999;
                return
            }
        }


        BlockDisplayMesh.position.x = roundedPoint.x;
        BlockDisplayMesh.position.y = roundedPoint.y;
        BlockDisplayMesh.position.z = roundedPoint.z;

        let colhex = selectedBlockState < 1 ? 0xFF0000 : BLOCK_COLORS[selectedBlockState - 1];
        if (!validPlacement(roundedPoint.x, roundedPoint.y, roundedPoint.z)) colhex = 0xFF0000
        let cb = (colhex % 0x100) / 255;
        let cg = (Math.floor(colhex / 0x100) % 0x100) / 255;
        let cr = (Math.floor(colhex / 0x10000) % 0x100) / 255;

        BlockDisplayMesh.material.color.r = cr * 0.5 + 0.1;
        BlockDisplayMesh.material.color.g = cg * 0.5 + 0.1;
        BlockDisplayMesh.material.color.b = cb * 0.5 + 0.1;
        BlockDisplayMesh.material.transparent = true;
        BlockDisplayMesh.material.opacity = Math.sin(performance.now() * 0.007) * 0.1 + 0.4;
    } else {
        BlockDisplayMesh.position.y = -9999;
    }
}

let toolbuttons = []
let blockCounter;
async function makeToolButtons() {
    if (!window.map) {
        setTimeout(() => {
            makeToolButtons()
        }, 100);
        return
    }
    if (window.BUILD_MODE) {
        let toolbar = document.createElement('div');
        toolbar.style = `
        position: absolute;
        bottom: 10px;
        right: 30%;
        width: 40%;
        display: grid;
        gap: 4px;
        pointer-events: all;
        justify-content: center;
        grid-template-columns: repeat(10,32px);
    `
        for (let i = 0; i < BLOCK_COLORS.length + 1; i++) {
            let button = document.createElement('button');
            button.className = 'hud-btn';
            let colhex = i == 0 ? 0xFF0000 : BLOCK_COLORS[i - 1];
            let cb = (colhex % 0x100);
            let cg = (Math.floor(colhex / 0x100) % 0x100);
            let cr = (Math.floor(colhex / 0x10000) % 0x100);
            if (i == 0) {
                button.innerText = 'X'
                button.style = `
                color: rgba(${cr}, ${cg}, ${cb}, 90%) !important;
                height: 32px;
                flex: 1 0 8%;
            `;
            }
            else {
                button.style = `
                background: rgba(${cr}, ${cg}, ${cb}, 90%) !important;
                height: 32px;
                flex: 1 0 8%;
            `;
            };

            button.onclick = function () {
                selectedBlockState = i;
            }
            toolbar.appendChild(button);
            toolbuttons[i] = button;
        }

        blockCounter = document.createElement('p');
        window.blockCounter = blockCounter;
        blockCounter.style = "height: 32px;color: rgb(255 255 255 / 90%) !important;position: absolute;left: 30%;width: 40%;bottom: 100px;text-align: center;text-shadow: 1px 1px 5px black;";
        blockCounter.innerText = '0/' + MAX_BLOCKS;
        toolbar.appendChild(blockCounter);

        document.getElementById('hud').appendChild(toolbar);
    }
}

makeToolButtons()

let _sliderDragPreciseValue = 0;
let canSlice = true;
renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 2) { rmb = true; return; }
    if (e.button === 0 && window.locked) {
        if (settingsPanel && settingsPanel.style.display !== 'none') {
            for (const slider of settingsPanel.querySelectorAll('input[type=range]')) {
                if (_cursorOver(slider)) { _sliderDrag = slider; _sliderDragPreciseValue = parseFloat(slider.value); return; }
            }
        }
        if (window.SWORD_FIGHT && !playerSpecialValues.slicing && canSlice) {
            playerSpecialValues.slicing = true;
            canSlice = false
            slashSound.currentTime = 0;
            slashSound.play();
            setTimeout(() => {
                playerSpecialValues.slicing = false;
                setTimeout(() => {
                    canSlice = true
                }, 100);
            }, 500);
        } else if (window.BUILD_MODE) {
            for (let i = 0; i < toolbuttons.length; i++) {
                let btn = toolbuttons[i];
                if (_cursorOver(btn)) {
                    btn.click();
                    return
                }
            }
            let [point, normal, hit] = getClicked3DPoint();
            if (point) {
                let roundedPoint = point.add(normal.multiplyScalar(1));
                roundedPoint.x = Math.round(roundedPoint.x);
                roundedPoint.y = Math.round(roundedPoint.y);
                roundedPoint.z = Math.round(roundedPoint.z);

                if (selectedBlockState == 0) {
                    if (hit.stud_id) {
                        roundedPoint.copy(hit.position);
                    } else {
                        return
                    }
                }
                _setBlockState(-1, roundedPoint.x, roundedPoint.y, roundedPoint.z, selectedBlockState);
            }
        }
    }
});
document.addEventListener('mouseup', e => {
    if (e.button === 2) rmb = false;
    if (e.button === 0) _sliderDrag = null;
});

document.addEventListener('mousemove', e => {
    if (!window.locked) return;
    if (_sliderDrag) {
        cursorX = Math.max(0, Math.min(window.innerWidth, cursorX + e.movementX));
        cursorY = Math.max(0, Math.min(window.innerHeight, cursorY + e.movementY));
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        const range = parseFloat(_sliderDrag.max) - parseFloat(_sliderDrag.min);
        let v = _sliderDragPreciseValue + e.movementX * range / _sliderDrag.offsetWidth;
        _sliderDragPreciseValue = Math.max(parseFloat(_sliderDrag.min), Math.min(parseFloat(_sliderDrag.max), v));
        v = Math.max(parseFloat(_sliderDrag.min), Math.min(parseFloat(_sliderDrag.max), Math.round(v / _sliderDrag.step) * _sliderDrag.step));
        _sliderDrag.value = v;
        _sliderDrag.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }
    if (mouseLock || rmb) {
        cam.yaw -= e.movementX * CAM_H_SENS;
        cam.pitch = Math.max(cam.minPitch, Math.min(cam.maxPitch, cam.pitch + e.movementY * CAM_V_SENS));
    } else {
        cursorX = Math.max(0, Math.min(window.innerWidth, cursorX + e.movementX));
        cursorY = Math.max(0, Math.min(window.innerHeight, cursorY + e.movementY));
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    }
});
let camWantDist = cam.distance;
renderer.domElement.addEventListener('wheel', e => {
    if (window.locked) {
        for (const id of ['chat-messages', 'lb-body']) {
            const el = document.getElementById(id);
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (cursorX >= r.left && cursorX <= r.right && cursorY >= r.top && cursorY <= r.bottom) {
                el.scrollTop += e.deltaY;
                return;
            }
        }
    }
    camWantDist = Math.max(cam.minDist, Math.min(cam.maxDist, camWantDist * (1 + e.deltaY * 0.0005) + e.deltaY * 0.01));
    if (camWantDist < 2) {
        camWantDist = 2
        setMouseLock(true)
    } else {
        setMouseLock(shiftLock)
    }
}, { passive: true });

function lerpAngle(current, target, t) {
    let diff = target - current;
    diff = ((diff % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    return current + diff * t;
}

function setRot(bone, axis, target, speed, dt) {
    if (!bone) return;
    const rest = anim.rest[bone.name]?.[axis] ?? 0;
    bone.rotation[axis] = THREE.MathUtils.lerp(bone.rotation[axis], rest + target, Math.min(1, speed * dt));
}

function updateClimbAnimation(dt, moving) {
    anim.time += dt;
    const t = anim.time;
    const sp = 10;

    const lLeg = anim.bones['Left_Leg'];
    const rLeg = anim.bones['Right_Leg'];
    const lArm = anim.bones['Left_Arm'];
    const rArm = anim.bones['Right_Arm'];
    const torso = anim.bones['Torso'];

    const lArmRestY = anim.rest['Left_Arm']?.py ?? 0;
    const rArmRestY = anim.rest['Right_Arm']?.py ?? 0;

    const grip = moving ? Math.sin(t * 6) * 0.15 : 0;
    setRot(lArm, 'x', -Math.PI * 0.75 + grip, sp, dt);
    setRot(rArm, 'x', -Math.PI * 0.75 - grip, sp, dt);
    setRot(lArm, 'z', 0.35, sp, dt);
    setRot(rArm, 'z', -0.35, sp, dt);

    const kick = moving ? Math.sin(t * 6) * 0.3 : 0;
    setRot(lLeg, 'x', 0.3 + kick, sp, dt);
    setRot(rLeg, 'x', 0.3 - kick, sp, dt);

    setRot(torso, 'x', -0.15, sp, dt);
    setRot(torso, 'z', 0, sp, dt);

    if (lArm) lArm.position.y = THREE.MathUtils.lerp(lArm.position.y, lArmRestY + 0.5, Math.min(1, sp * dt));
    if (rArm) rArm.position.y = THREE.MathUtils.lerp(rArm.position.y, rArmRestY + 0.5, Math.min(1, sp * dt));
}

function updateAnimations(dt, moving) {
    anim.time += dt;
    const t = anim.time;
    const sp = 12;

    const lLeg = anim.bones['Left_Leg'];
    const rLeg = anim.bones['Right_Leg'];
    const lArm = anim.bones['Left_Arm'];
    const rArm = anim.bones['Right_Arm'];
    const torso = anim.bones['Torso'];
    const head = anim.bones['Head'];

    const lArmRestY = anim.rest['Left_Arm']?.py ?? 0;
    const rArmRestY = anim.rest['Right_Arm']?.py ?? 0;

    if (!grounded) {
        setRot(lLeg, 'x', 0, sp, dt);
        setRot(rLeg, 'x', 0, sp, dt);
        setRot(lArm, 'x', -Math.PI, sp, dt);
        setRot(rArm, 'x', -Math.PI, sp, dt);
        setRot(lArm, 'z', 0, sp, dt);
        setRot(rArm, 'z', 0, sp, dt);
        setRot(torso, 'x', 0, sp, dt);
        if (lArm) lArm.position.y = THREE.MathUtils.lerp(lArm.position.y, lArmRestY - 0.75, Math.min(1, sp * dt));
        if (rArm) rArm.position.y = THREE.MathUtils.lerp(rArm.position.y, rArmRestY - 0.75, Math.min(1, sp * dt));
    } else if (moving) {
        const swing = Math.sin(t * 2.8 * Math.PI);
        setRot(lLeg, 'x', swing * 1.0, sp, dt);
        setRot(rLeg, 'x', -swing * 1.0, sp, dt);
        setRot(lArm, 'x', -swing * 0.8, sp, dt);
        setRot(rArm, 'x', swing * 0.8, sp, dt);
        setRot(lArm, 'z', 0.05, sp, dt);
        setRot(rArm, 'z', -0.05, sp, dt);
        setRot(torso, 'x', 0.03, sp, dt);
        setRot(torso, 'z', 0, sp, dt);
        if (lArm) lArm.position.y = THREE.MathUtils.lerp(lArm.position.y, lArmRestY, Math.min(1, sp * dt));
        if (rArm) rArm.position.y = THREE.MathUtils.lerp(rArm.position.y, rArmRestY, Math.min(1, sp * dt));
    } else {
        const breathe = Math.sin(t * 1.2) * 0.015;
        setRot(lLeg, 'x', 0, sp, dt);
        setRot(rLeg, 'x', 0, sp, dt);
        setRot(lArm, 'x', 0, sp, dt);
        setRot(rArm, 'x', 0, sp, dt);
        setRot(lArm, 'z', 0.1 + breathe, sp, dt);
        setRot(rArm, 'z', -0.1 - breathe, sp, dt);
        setRot(torso, 'x', breathe, sp, dt);
        setRot(torso, 'z', 0, sp, dt);
        if (lArm) lArm.position.y = THREE.MathUtils.lerp(lArm.position.y, lArmRestY, Math.min(1, sp * dt));
        if (rArm) rArm.position.y = THREE.MathUtils.lerp(rArm.position.y, rArmRestY, Math.min(1, sp * dt));
    }
}

function obbOverlap(cx, cz, co, si, b) {
    const aco = Math.abs(co), asi = Math.abs(si);
    const bcx = (b.minX + b.maxX) * 0.5, bcz = (b.minZ + b.maxZ) * 0.5;
    const bhx = (b.maxX - b.minX) * 0.5, bhz = (b.maxZ - b.minZ) * 0.5;
    const dx = bcx - cx, dz = bcz - cz;

    const ov0 = (CHAR_HALF_W * aco + CHAR_HALF_D * asi) + bhx - Math.abs(dx);
    if (ov0 <= 0) return null;

    const ov1 = (CHAR_HALF_W * asi + CHAR_HALF_D * aco) + bhz - Math.abs(dz);
    if (ov1 <= 0) return null;

    const dp2 = dx * co - dz * si;
    const ov2 = CHAR_HALF_W + (bhx * aco + bhz * asi) - Math.abs(dp2);
    if (ov2 <= 0) return null;

    const dp3 = dx * si + dz * co;
    const ov3 = CHAR_HALF_D + (bhx * asi + bhz * aco) - Math.abs(dp3);
    if (ov3 <= 0) return null;

    return { ov0, ov1, ov2, ov3, dx, dz, dp2, dp3, co, si };
}

function mtvOBBvsChar(obb) {
    const px = character.position.x;
    const py = character.position.y - CHAR_FOOT_OFFSET + CHAR_HEIGHT / 2;
    const pz = character.position.z;
    const phx = CHAR_HALF_W;
    const phy = CHAR_HEIGHT / 2;
    const phz = CHAR_HALF_D;
    const cy = Math.cos(character.rotation.y);
    const sy = Math.sin(character.rotation.y);
    const cux = cy, cuy = 0, cuz = -sy; // right
    const cvx = 0, cvy = 1, cvz = 0;   // up
    const cwx = sy, cwy = 0, cwz = cy;  // forward
    const dx = px - obb.cx;
    const dy = py - obb.cy;
    const dz = pz - obb.cz;
    let minOv = Infinity;
    let nx = 0, ny = 0, nz = 0;
    function testAxis(ax, ay, az) {
        const len = Math.sqrt(ax * ax + ay * ay + az * az);
        if (len < 1e-8) return true;
        ax /= len;
        ay /= len;
        az /= len;
        const charR =
            phx * Math.abs(ax * cux + ay * cuy + az * cuz) +
            phy * Math.abs(ax * cvx + ay * cvy + az * cvz) +
            phz * Math.abs(ax * cwx + ay * cwy + az * cwz);
        const obbR =
            obb.hx * Math.abs(ax * obb.ux + ay * obb.uy + az * obb.uz) +
            obb.hy * Math.abs(ax * obb.vx + ay * obb.vy + az * obb.vz) +
            obb.hz * Math.abs(ax * obb.wx + ay * obb.wy + az * obb.wz);
        const sep = Math.abs(dx * ax + dy * ay + dz * az);
        const ov = charR + obbR - sep;
        if (ov <= 0) return false;
        if (ov < minOv) {
            minOv = ov;
            nx = ax;
            ny = ay;
            nz = az;
        }
        return true;
    }
    if (!testAxis(cux, cuy, cuz)) return null;
    if (!testAxis(cvx, cvy, cvz)) return null;
    if (!testAxis(cwx, cwy, cwz)) return null;
    if (!testAxis(obb.ux, obb.uy, obb.uz)) return null;
    if (!testAxis(obb.vx, obb.vy, obb.vz)) return null;
    if (!testAxis(obb.wx, obb.wy, obb.wz)) return null;
    const charAxes = [
        [cux, cuy, cuz],
        [cvx, cvy, cvz],
        [cwx, cwy, cwz]
    ];
    const obbAxes = [
        [obb.ux, obb.uy, obb.uz],
        [obb.vx, obb.vy, obb.vz],
        [obb.wx, obb.wy, obb.wz]
    ];
    for (const [ax, ay, az] of charAxes) {
        for (const [bx, by, bz] of obbAxes) {

            const cx = ay * bz - az * by;
            const cy = az * bx - ax * bz;
            const cz = ax * by - ay * bx;

            if (!testAxis(cx, cy, cz)) return null;
        }
    }
    if (dx * nx + dy * ny + dz * nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
    }
    return { nx, ny, nz, depth: minOv };
}

function resolveOBBH(nearby) {
    for (const b of nearby) {
        if (!b.isOBB) continue;
        const r = mtvOBBvsChar(b);
        if (!r) continue;
        const { nx, ny, nz, depth } = r;
        const absY = Math.abs(ny);
        const horzLen = Math.sqrt(nx * nx + nz * nz);
        if (horzLen <= absY) continue;

        const fy = character.position.y - CHAR_FOOT_OFFSET;
        const stepNeeded = b.maxY - fy;
        if (stepNeeded > 0 && stepNeeded <= STEP_HEIGHT && grounded && velY <= 0) {
            if (b.maxY + CHAR_FOOT_OFFSET > stepUpTarget) stepUpTarget = b.maxY + CHAR_FOOT_OFFSET;
            continue;
        }
        character.position.x += nx * depth;
        character.position.z += nz * depth;
        pushedBlocks.add(b);
    }
}

function resolveOBBV(nearby) {
    for (const b of nearby) {
        if (!b.isOBB) continue;
        if (pushedBlocks.has(b)) continue;
        const r = mtvOBBvsChar(b);
        if (!r) continue;
        const { nx, ny, nz, depth } = r;
        const absY = Math.abs(ny);
        const horzLen = Math.sqrt(nx * nx + nz * nz);
        if (horzLen > absY) continue;

        const pushY = absY > 0.001 ? depth / absY : depth;
        if (ny > 0) {
            character.position.y += pushY;
            if (velY <= 0) { velY = 0; grounded = true; extraVelX = 0; extraVelZ = 0; }
        } else {
            character.position.y -= pushY;
            if (velY > 0) velY = 0;
        }
    }
}

function resolveBlocksH(nearby, dt) {
    stepUpTarget = -Infinity;
    pushedBlocks.clear();
    const cx = character.position.x, cz = character.position.z;
    const ry = character.rotation.y;
    const co = Math.cos(ry), si = Math.sin(ry);
    const aco = Math.abs(co), asi = Math.abs(si);
    const halfX = CHAR_HALF_W * aco + CHAR_HALF_D * asi;
    const halfZ = CHAR_HALF_W * asi + CHAR_HALF_D * aco;
    const canStep = grounded || coyoteTimer > 0;
    for (const b of nearby) {
        if (b.isOBB) continue;
        const fy = character.position.y - CHAR_FOOT_OFFSET;
        if (b.maxY <= fy || b.minY >= fy + CHAR_HEIGHT) continue;
        if (cx + halfX <= b.minX || cx - halfX >= b.maxX) continue;
        if (cz + halfZ <= b.minZ || cz - halfZ >= b.maxZ) continue;
        const stepNeeded = b.maxY - fy;
        if (stepNeeded > 0 && stepNeeded <= STEP_HEIGHT && canStep && velY <= 0) {
            if (b.maxY + CHAR_FOOT_OFFSET > stepUpTarget) { stepUpTarget = b.maxY + CHAR_FOOT_OFFSET }
            continue;
        }
        const r = obbOverlap(cx, cz, co, si, b);
        if (!r) continue;

        const yLo = Math.max(fy, b.minY), yHi = Math.min(fy + CHAR_HEIGHT, b.maxY);
        if (yHi - yLo < 0.02) continue;

        const { ov0, ov1, dx, dz } = r;
        if (ov0 <= ov1) {
            character.position.x -= Math.sign(dx) * Math.min(ov0, STEP_CLIMB_SPEED * dt);
        } else {
            character.position.z -= Math.sign(dz) * Math.min(ov1, STEP_CLIMB_SPEED * dt);
        }
        pushedBlocks.add(b);
    }
}


function resolveBlocksV(nearby, dt) {
    const cx = character.position.x, cz = character.position.z;
    const ry = character.rotation.y;
    const co = Math.cos(ry), si = Math.sin(ry);

    for (const b of nearby) {
        if (b.isOBB) continue;
        if (pushedBlocks.has(b)) continue;

        const fy = character.position.y - CHAR_FOOT_OFFSET;

        if (!obbOverlap(cx, cz, co, si, b)) continue;

        const oyU = b.maxY - fy;
        const oyD = fy + CHAR_HEIGHT - b.minY;
        if (oyU <= 0 || oyD <= 0) continue;

        if (oyU <= oyD) {
            let goal = b.maxY + CHAR_FOOT_OFFSET;
            let change = goal - character.position.y;
            if (change > 0) {
                grounded = true;
            }
            character.position.y += Math.sign(change) * Math.min(Math.abs(change), STEP_CLIMB_SPEED * dt);
            if (velY <= 0) { velY = 0; grounded = true; extraVelX = 0; extraVelZ = 0; }
        } else {
            if (fy < b.minY) {
                let goal = b.minY - CHAR_HEIGHT + CHAR_FOOT_OFFSET;
                let change = goal - character.position.y;
                character.position.y += Math.sign(change) * Math.min(Math.abs(change), STEP_CLIMB_SPEED * dt);
                if (velY > 0) velY = 0;
            }
        }
    }
}

function findClimbableBlock(px, pz, footY, fwdX, fwdZ) {
    if (climbBlock) {
        const b = climbBlock;
        if (b.maxY - b.minY <= CLIMB_MAX_PART_H &&
            b.maxY >= footY - HANG_DEPTH - 0.1 &&
            b.minY <= footY + CHAR_HEIGHT) {
            const cpx = Math.max(b.minX, Math.min(px, b.maxX));
            const cpz = Math.max(b.minZ, Math.min(pz, b.maxZ));
            const dx = cpx - px, dz = cpz - pz;
            const dlen = Math.sqrt(dx * dx + dz * dz);
            if (dlen <= CHAR_HALF_W + CLIMB_REACH + 0.4) return b;
        }
    }

    const nearby = getNearbyColliders(px, footY + CHAR_HEIGHT / 2, pz);
    let best = null, bestScore = Infinity;
    for (const b of nearby) {
        if (b.maxY - b.minY > CLIMB_MAX_PART_H) continue;
        if (b.maxY < footY - HANG_DEPTH - 0.1) continue;
        if (b.minY > footY + CHAR_HEIGHT) continue;

        const cpx = Math.max(b.minX, Math.min(px, b.maxX));
        const cpz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        const dx = cpx - px, dz = cpz - pz;
        const dlen = Math.sqrt(dx * dx + dz * dz);
        if (dlen > CHAR_HALF_W + CLIMB_REACH + 0.4) continue;
        if (dlen >= 0.01) {
            if ((dx / dlen) * fwdX + (dz / dlen) * fwdZ < -0.5) continue;
        }
        const score = dlen + Math.abs(b.maxY - footY) * 0.1;
        if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
}

function findChainBlockBelow(px, pz, ledgeY, fwdX, fwdZ) {
    const nearby = getNearbyColliders(px, ledgeY, pz);
    let best = null, bestY = -Infinity;
    for (const cb of nearby) {
        if (cb.maxY - cb.minY > CLIMB_MAX_PART_H) continue;
        if (cb.maxY >= ledgeY - 0.01) continue;
        if (cb.maxY < ledgeY - CLIMB_WINDOW) continue;
        const cpx = Math.max(cb.minX, Math.min(px, cb.maxX));
        const cpz = Math.max(cb.minZ, Math.min(pz, cb.maxZ));
        const dx = cpx - px, dz = cpz - pz;
        const dlen = Math.sqrt(dx * dx + dz * dz);
        if (dlen > CHAR_HALF_W + CLIMB_REACH + 0.4) continue;
        if (cb.maxY > bestY) { best = cb; bestY = cb.maxY; }
    }
    return best;
}

function findChainBlockAbove(px, pz, ledgeY, fwdX, fwdZ) {
    const nearby = getNearbyColliders(px, ledgeY, pz);
    for (const cb of nearby) {
        if (cb.maxY - cb.minY > CLIMB_MAX_PART_H) continue;
        if (cb.maxY <= ledgeY + 0.01 || cb.maxY > ledgeY + CLIMB_WINDOW) continue;
        const cbcx = (cb.minX + cb.maxX) * 0.5 - px;
        const cbcz = (cb.minZ + cb.maxZ) * 0.5 - pz;
        const cbcd = Math.sqrt(cbcx * cbcx + cbcz * cbcz);
        if (cbcd > 0.01 && (cbcx / cbcd) * fwdX + (cbcz / cbcd) * fwdZ < 0.4) continue;
        return cb;
    }
    return null;
}

function tryLedgeGrab(nearby) {
    if (climbCooldown > 0 || climbState !== 'none' || grounded || velY < CLIMB_FALL_CUTOFF) return;
    if ((keys['KeyS'] || keys['ArrowDown']) && !(keys['KeyW'] || keys['ArrowUp'])) return;

    const footY = character.position.y - CHAR_FOOT_OFFSET;
    const px = character.position.x, pz = character.position.z;
    const fwdX = Math.sin(character.rotation.y);
    const fwdZ = Math.cos(character.rotation.y);

    let bestBlock = null, bestApX = 0, bestApZ = 0, bestDist = Infinity;

    for (const b of nearby) {
        if (b.maxY - b.minY > CLIMB_MAX_PART_H) continue;

        const below = b.maxY - footY;
        if (below <= STEP_HEIGHT || below > CLIMB_WINDOW) continue;

        if (b.minY > footY + CHAR_HEIGHT) continue;

        const ox = Math.min(px + CHAR_HALF_W + CLIMB_REACH, b.maxX) - Math.max(px - CHAR_HALF_W - CLIMB_REACH, b.minX);
        const oz = Math.min(pz + CHAR_HALF_D + CLIMB_REACH, b.maxZ) - Math.max(pz - CHAR_HALF_D - CLIMB_REACH, b.minZ);
        if (ox <= 0 || oz <= 0) continue;

        const cpx = Math.max(b.minX, Math.min(px, b.maxX));
        const cpz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        let apX = cpx - px, apZ = cpz - pz;
        const apLen = Math.sqrt(apX * apX + apZ * apZ);
        if (apLen < 0.01) {
            apX = fwdX; apZ = fwdZ;
        } else {
            apX /= apLen; apZ /= apLen;
            if (apX * fwdX + apZ * fwdZ < -0.9) continue;
        }

        if (apLen < bestDist) {
            bestDist = apLen;
            bestBlock = b;
            bestApX = apX; bestApZ = apZ;
        }
    }

    if (!bestBlock) return;

    climbLedgeY = bestBlock.maxY;
    climbBlock = bestBlock;
    climbFwdX = bestApX;
    climbFwdZ = bestApZ;
    climbState = 'hanging';
    velY = 0;
}

function update(dt) {
    if (!character) return;

    dt = Math.min(dt, 0.05);

    let cdlerp = dt * 20;
    if (keys['KeyI']) camWantDist = Math.max(cam.minDist, camWantDist * (1 - CAM_KEY_ZOOM_SPEED * dt * 0.05) - CAM_KEY_ZOOM_SPEED * dt * 0.9);
    if (keys['KeyO']) camWantDist = Math.min(cam.maxDist, camWantDist * (1 + CAM_KEY_ZOOM_SPEED * dt * 0.05) + CAM_KEY_ZOOM_SPEED * dt * 0.9);
    if (keys['KeyI'] || keys['KeyO']) {
        if (camWantDist < 2) {
            camWantDist = 2
            setMouseLock(true)
        } else {
            setMouseLock(shiftLock)
        }
    }
    cam.distance = cam.distance * (1 - cdlerp) + camWantDist * cdlerp;

    if (climbState === 'hanging') {
        const px0 = character.position.x, pz0 = character.position.z;
        let footY = character.position.y - CHAR_FOOT_OFFSET;

        const stillValid = findClimbableBlock(px0, pz0, footY, climbFwdX, climbFwdZ);
        if (!stillValid) {
            climbState = 'none'; climbCooldown = 0.25;
            updateClimbAnimation(dt); return;
        }
        climbBlock = stillValid;
        climbLedgeY = stillValid.maxY;

        if (mouseLock) {
            const grabAngle = Math.atan2(climbFwdX, climbFwdZ);
            const camAngle = cam.yaw + Math.PI;
            const diff = ((camAngle - grabAngle) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
            if (Math.abs(diff) > Math.PI / 4) {
                climbState = 'none'; climbCooldown = 0.25; velY = 0;
                updateClimbAnimation(dt); return;
            }
            character.rotation.y = cam.yaw + Math.PI;
        } else {
            const faceAngle = Math.atan2(climbFwdX, climbFwdZ);
            character.rotation.y = lerpAngle(character.rotation.y, faceAngle, Math.min(1, ROT_SPEED * dt));
        }

        if (jumpBuffer > 0) {
            velY = CLIMB_JUMP_UP;
            extraVelX = -climbFwdX * CLIMB_JUMP_BACK_V;
            extraVelZ = -climbFwdZ * CLIMB_JUMP_BACK_V;
            climbState = 'none';
            climbCooldown = 0;
            jumpBuffer = 0;
            updateClimbAnimation(dt); return;
        }


        const pressW = !!(keys['KeyW'] || keys['ArrowUp']);
        const pressS = !!(keys['KeyS'] || keys['ArrowDown']);

        const rawVert = (pressW ? 1 : 0) - (pressS ? 1 : 0);
        const anyInput = rawVert !== 0;

        if (rawVert < -0.1 && footY <= G + 0.15) {
            character.position.y = CHAR_STAND_Y;
            climbState = 'none'; climbCooldown = 0; velY = 0;
            updateClimbAnimation(dt); return;
        }

        velY = 0;

        character.position.y += rawVert * CLIMB_RISE_SPEED * dt;

        footY = character.position.y - CHAR_FOOT_OFFSET;

        if (rawVert < 0 && footY < climbLedgeY - HANG_DEPTH) {
            const belowBlock = findChainBlockBelow(character.position.x, character.position.z, climbLedgeY, climbFwdX, climbFwdZ);
            if (belowBlock) {
                climbBlock = belowBlock;
                climbLedgeY = belowBlock.maxY;
            } else {
                climbState = 'none'; climbCooldown = 0.1; velY = -2;
                updateClimbAnimation(dt); return;
            }
        }

        if (footY < G) {
            character.position.y = CHAR_STAND_Y;
            climbState = 'none'; climbCooldown = 0; velY = 0;
            updateClimbAnimation(dt); return;
        }

        footY = character.position.y - CHAR_FOOT_OFFSET;
        if (footY >= climbLedgeY) {
            const chainBlock = findChainBlockAbove(character.position.x, character.position.z, climbLedgeY, climbFwdX, climbFwdZ);
            if (chainBlock) {
                climbBlock = chainBlock;
                climbLedgeY = chainBlock.maxY;
            } else if (rawVert > 0.3) {
                character.position.x += climbFwdX * 0.4;
                character.position.z += climbFwdZ * 0.4;
                climbState = 'none'; velY = 2;
                updateClimbAnimation(dt); return;
            } else {
                character.position.y = climbLedgeY + CHAR_FOOT_OFFSET;
            }
        }

        if (!anyInput) {
            const hangY = climbLedgeY - HANG_DEPTH + CHAR_FOOT_OFFSET;
            const stillAtTop = !findChainBlockAbove(character.position.x, character.position.z, climbLedgeY, climbFwdX, climbFwdZ);
            if (stillAtTop && character.position.y > hangY) {
                const drop = Math.min(CLIMB_RISE_SPEED * 2 * dt, character.position.y - hangY);
                character.position.y -= drop;
            }
        }

        updateClimbAnimation(dt, anyInput);
        return;
    }

    moveInput.set(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp']) moveInput.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveInput.z += 1;
    if (keys['KeyA']) moveInput.x -= 1;
    if (keys['KeyD']) moveInput.x += 1;

    const moving = moveInput.lengthSq() > 0;
    let velX = 0, velZ = 0;
    const movementSpeed = (movementMods.fly || movementMods.noclip) ? movementMods.flySpeed : WALK_SPEED;
    if (movementMods.fly || movementMods.noclip || movementMods.airwalk) stepUpTarget = -Infinity;
    if (moving) {
        moveInput.normalize();
        yawQuat.setFromAxisAngle(upAxis, cam.yaw);
        moveInput.applyQuaternion(yawQuat);

        velX = moveInput.x * movementSpeed;
        velZ = moveInput.z * movementSpeed;

        if (!mouseLock) {
            const targetAngle = Math.atan2(moveInput.x, moveInput.z);
            character.rotation.y = lerpAngle(character.rotation.y, targetAngle, Math.min(1, ROT_SPEED * dt));
        }
    }

    velX += extraVelX;
    velZ += extraVelZ;

    const sp2 = velX * velX + velZ * velZ;
    if (sp2 > movementSpeed * movementSpeed) {
        const sc = movementSpeed / Math.sqrt(sp2);
        velX *= sc;
        velZ *= sc;
    }

    if (movementMods.noclip) {
        character.position.x += velX * dt;
        character.position.z += velZ * dt;
    } else {
        const fy0 = character.position.y - CHAR_FOOT_OFFSET;
        const aco = Math.abs(Math.cos(character.rotation.y));
        const asi = Math.abs(Math.sin(character.rotation.y));
        const halfX = CHAR_HALF_W * aco + CHAR_HALF_D * asi;
        const halfZ = CHAR_HALF_W * asi + CHAR_HALF_D * aco;
        const swNearby = getNearbyColliders(character.position.x, character.position.y, character.position.z);
        const canStep = grounded || coyoteTimer > 0;

        let dx = velX * dt;
        for (const b of swNearby) {
            if (b.isOBB) continue;
            if (b.maxY <= fy0 || b.minY >= fy0 + CHAR_HEIGHT) continue;
            const stepNeeded = b.maxY - fy0;
            if (stepNeeded > 0 && stepNeeded <= STEP_HEIGHT && canStep && velY <= 0) continue;
            if (character.position.z + halfZ <= b.minZ || character.position.z - halfZ >= b.maxZ) continue;
            if (dx > 0) {
                const edge = character.position.x + halfX;
                if (edge > b.minX) continue;
                const allow = b.minX - edge;
                if (allow < dx) dx = Math.max(0, allow);
            } else if (dx < 0) {
                const edge = character.position.x - halfX;
                if (edge < b.maxX) continue;
                const allow = b.maxX - edge;
                if (allow > dx) dx = Math.min(0, allow);
            }
        }
        character.position.x += dx;

        let dz = velZ * dt;
        for (const b of swNearby) {
            if (b.isOBB) continue;
            if (b.maxY <= fy0 || b.minY >= fy0 + CHAR_HEIGHT) continue;
            const stepNeeded = b.maxY - fy0;
            if (stepNeeded > 0 && stepNeeded <= STEP_HEIGHT && canStep && velY <= 0) continue;
            if (character.position.x + halfX <= b.minX || character.position.x - halfX >= b.maxX) continue;
            if (dz > 0) {
                const edge = character.position.z + halfZ;
                if (edge > b.minZ) continue;
                const allow = b.minZ - edge;
                if (allow < dz) dz = Math.max(0, allow);
            } else if (dz < 0) {
                const edge = character.position.z - halfZ;
                if (edge < b.maxZ) continue;
                const allow = b.maxZ - edge;
                if (allow > dz) dz = Math.min(0, allow);
            }
        }
        character.position.z += dz;
    }

    if (extraVelX !== 0 || extraVelZ !== 0) {
        const decay = Math.max(0, 1 - 2.5 * dt);
        extraVelX *= decay;
        extraVelZ *= decay;
        if (Math.abs(extraVelX) < 0.3) extraVelX = 0;
        if (Math.abs(extraVelZ) < 0.3) extraVelZ = 0;
    }

    if (mouseLock) character.rotation.y = cam.yaw + Math.PI;

    climbCooldown = Math.max(0, climbCooldown - dt);



    if (stepUpTarget > character.position.y) {
        const rise = Math.min(stepUpTarget - character.position.y, STEP_CLIMB_SPEED * dt);
        character.position.y += rise;
        velY = 0;
        grounded = true;
    }

    const nearby = getNearbyColliders(character.position.x, character.position.y, character.position.z);

    if (!movementMods.noclip) {
        resolveBlocksH(nearby, dt);
        resolveOBBH(nearby);
        if (!movementMods.fly && !movementMods.airwalk) tryLedgeGrab(nearby);
    }

    if (grounded) coyoteTimer = COYOTE_TIME;
    else coyoteTimer = Math.max(0, coyoteTimer - dt);

    if (keys['Space']) jumpBuffer = JUMP_BUFFER;
    jumpBuffer = Math.max(0, jumpBuffer - dt);

    if (movementMods.fly) {
        const vertical = (keys['Space'] ? 1 : 0) -
            ((keys['ShiftLeft'] || keys['ShiftRight'] || keys['ControlLeft'] || keys['ControlRight']) ? 1 : 0);
        character.position.y += vertical * movementMods.flySpeed * dt;
        velY = 0;
        grounded = true;
        coyoteTimer = COYOTE_TIME;
        jumpBuffer = 0;
    } else if (movementMods.airwalk) {
        velY = 0;
        grounded = true;
        coyoteTimer = COYOTE_TIME;
        jumpBuffer = 0;
    } else {
        velY += GRAVITY * movementMods.gravityScale * dt;
        character.position.y += velY * dt;
        grounded = false;
    }

    if (!movementMods.noclip && character.position.y <= CHAR_STAND_Y) {
        character.position.y = CHAR_STAND_Y;
        velY = 0;
        grounded = true;
        extraVelX = 0; extraVelZ = 0;
    }

    if (!movementMods.noclip) {
        resolveBlocksV(nearby, dt);
        resolveOBBV(nearby);
    }

    if (!movementMods.fly && !movementMods.airwalk && jumpBuffer > 0 && (grounded || coyoteTimer > 0)) {
        velY = JUMP_POWER;
        grounded = false;
        coyoteTimer = 0;
        jumpBuffer = 0;
    }

    updateAnimations(dt, moving);

    if (window.BUILD_MODE) update_Display_Block();
}
function updateCamera(dt) {
    if (!character) return;

    if (keys['ArrowLeft']) cam.yaw += dt * 2;
    if (keys['ArrowRight']) cam.yaw -= dt * 2;

    const sinYaw = Math.sin(cam.yaw);
    const cosYaw = Math.cos(cam.yaw);
    const sinPitch = Math.sin(cam.pitch);
    const cosPitch = Math.cos(cam.pitch);

    const pivot = cameraPivot.set(
        character.position.x,
        character.position.y + CAM_PIVOT_Y + CAM_REFERENCE_FOOT_OFFSET - CHAR_FOOT_OFFSET,
        character.position.z
    );

    let cdist = cam.distance
    isFirstPerson = cdist <= 2.001;
    if (isFirstPerson) {
        setMouseLock(true)
        cdist = 0.5;
        pivot.x -= sinYaw * 1;
        pivot.z -= cosYaw * 1;
    } else if (shiftLock) {
        pivot.x += cosYaw * SHIFT_LOCK_OFFSET;
        pivot.z += -sinYaw * SHIFT_LOCK_OFFSET;
    }

    if (typeof playerSpecialValues != 'undefined' && playerSpecialValues.health <= 0) {
        return;
    }

    camera.position.set(
        pivot.x + cdist * cosPitch * sinYaw,
        pivot.y + cdist * sinPitch,
        pivot.z + cdist * cosPitch * cosYaw
    );
    camera.lookAt(pivot);
}
let sword;
let loadingSword = false;
let died = false;
function swordUpdate() {
    if (!window.SWORD_FIGHT) return;
    setRot(anim.bones.Right_Arm, 'x', -Math.PI * 0.5, 1, 1);
    if (typeof playerSpecialValues == 'undefined') return
    if (!character) return
    if (!anim.bones.Right_Arm) return
    anim.bones.Right_Arm.position.y = 1.5
    anim.bones.Right_Arm.position.z = isFirstPerson ? 0.3 : -0.5
    if (!loadingSword) {
        loadingSword = true;
        fbxLoader.load(importedAssets.swordMdl, (fbx) => {
            fbx.scale.multiplyScalar(0.005);
            sword = fbx;
            sword.castShadow = shadowsActive();
            sword.receiveShadow = shadowsActive();
            sword.rotation.order = 'YXZ';
            scene.add(sword);
        });
    }
    let fwdx = Math.sin(character.rotation.y);
    let fwdz = Math.cos(character.rotation.y);
    let rx = -Math.cos(character.rotation.y);
    let rz = Math.sin(character.rotation.y);

    let slicing = playerSpecialValues.slicing

    let fwd = slicing ? 3.2 : 1.5;
    fwd += isFirstPerson ? 0.8 : 0;
    let right = 1.5;
    let up = slicing ? 1.5 : 2.8;

    let x = character.position.x + rx * right + fwdx * fwd;
    let y = character.position.y + up;
    let z = character.position.z + rz * right + fwdz * fwd;

    if (!sword) return

    sword.position.set(x, y, z);
    sword.rotation.y = character.rotation.y;
    sword.rotation.x = slicing ? Math.PI * 0.5 : 0

    if (window.VOID_DIE && character.position.y <= CHAR_STAND_Y + 1) {
        playerSpecialValues.health = -999;
    }

    if (playerSpecialValues.health <= 0 && !died) {
        if (window.canPlaySounds) {
            oofSound.play()
        }
        let sp = window.chooseSpawnPoint(window.map);
        _spawnPoint.x = sp.x;
        _spawnPoint.y = sp.y + CHAR_FOOT_OFFSET;
        _spawnPoint.z = sp.z;

        character.position.x = _spawnPoint.x + 9999;
        character.position.y = _spawnPoint.y + 9999;
        character.position.z = _spawnPoint.z + 9999;

        setTimeout(() => {
            died = false;
            velY = 0;
            character.position.x = _spawnPoint.x;
            character.position.y = _spawnPoint.y;
            character.position.z = _spawnPoint.z;
            character.rotation.y = _spawnPoint.ry
            playerSpecialValues.health = 1;
        }, 1500);
    }

}

let lastTime = performance.now();

function loop(now) {
    requestAnimationFrame(loop);
    const perfFrame = VortexPerf.begin(now);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    VortexPerf.mark(perfFrame, "update");
    swordUpdate(dt);
    VortexPerf.mark(perfFrame, "sword");
    updateCamera(dt);
    VortexPerf.mark(perfFrame, "camera");

    if (charDebugMesh && character) {
        const fy = character.position.y - CHAR_FOOT_OFFSET;
        charDebugMesh.position.set(character.position.x, fy + CHAR_HEIGHT / 2, character.position.z);
        charDebugMesh.rotation.y = character.rotation.y;
    }
    updateDebugMeshes();
    VortexPerf.mark(perfFrame, "debug");

    window._mpUpdate?.(dt);
    VortexPerf.mark(perfFrame, "multiplayer");

    updateLightingForFrame();
    VortexPerf.mark(perfFrame, "lighting");
    renderer.render(scene, camera);
    VortexPerf.mark(perfFrame, "render");
    VortexPerf.end(perfFrame);
}

const DEG2RAD = Math.PI / 180;

async function loadMapVortex(path, tx = 0, ty = 0, tz = 0) {
    const parts = await fetch(path).then(r => r.json());
    const valid = parts.filter(p => p.Type === 'Part' && p.Shape === 'Block');
    if (!valid.length) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of valid) {
        const [px, py, pz] = p.Position;
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
    }
    const ox = tx - (minX + maxX) / 2;
    const oy = ty - (minY + maxY) / 2;
    const oz = tz - (minZ + maxZ) / 2;

    for (const p of valid) {
        const [sw, sh, sd] = p.Size;
        const [px, py, pz] = p.Position;
        const [rx, ry, rz] = p.Rotation;
        const [cr, cg, cb] = p.Color;
        const color = (Math.round(cr * 255) << 16) | (Math.round(cg * 255) << 8) | Math.round(cb * 255);
        addStud(sw, sh, sd, color, px + ox, (py - sh / 2) + oy, pz + oz, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
    }
}

let gameSong;
let gameSongVolume = 0.9;
makeSettingsSlider('Music volume', 0, 1, 0.9, 0.1, function (slider, val) {
    gameSongVolume = val;
    if (gameSong) {
        gameSong.volume = val;
    }
})
makeSettingsSlider('Sfx volume', 0, 1, 1, 0.1, function (slider, val) {
    slashSound.volume = val * 0.8;
    clickSound.volume = val * 0.8;
    oofSound.volume = val;
})

overlay.addEventListener('click', () => {
    if (leaveButton.matches(':hover')) { return }
    window.canPlaySounds = true;
    if (window.SWORD_FIGHT || window.BUILD_MODE) {
        if (!gameSong) {
            gameSong = new Audio(window.SWORD_FIGHT && importedAssets.sfothSong || importedAssets.buildSong);
            gameSong.loop = true;
            gameSong.preload = "auto";
            gameSong.volume = gameSongVolume;
            gameSong.addEventListener('ended', function () {
                this.currentTime = 0;
                this.play();
            }, false);
            gameSong.preload = "auto";
            gameSong.play();
        }
    }
    requestGamePointerLock();
});
if (runtimeInput && typeof runtimeInput.attachOverlay === 'function') {
    runtimeInput.attachOverlay(overlay, () => leaveButton.matches(':hover'));
} else {
    overlay.addEventListener('pointerdown', () => {
        if (leaveButton.matches(':hover')) { return }
        requestGamePointerLock();
    });
}

window._vortex = {
    scene,
    getCharacter: () => character,
    getGrounded: () => grounded,
    getVelY: () => velY,
    setVelY(v) { velY = Number(v) || 0; },
    setGrounded(v) { grounded = !!v; },
    getMovementConstants: () => ({ WALK_SPEED, JUMP_POWER, GRAVITY }),
    getMovementMods,
    setMovementMods,
    getCameraState: () => ({ yaw: cam.yaw, pitch: cam.pitch, distance: cam.distance }),
    getClimbState: () => climbState,
    getCharFootOffset: () => CHAR_FOOT_OFFSET,
    getCharHeight: () => CHAR_HEIGHT,
    getSpawn: () => ({ ..._spawnPoint }),
    getAnimRest: () => anim.rest,
    keys,
    setSens(mult) {
        CAM_H_SENS = 0.0015 * Math.PI * mult;
        CAM_V_SENS = 0.0015 * Math.PI * mult;
    },
    getShadowsEnabled() {
        return shadowsActive();
    },
    setShadowsEnabled(value) {
        return setShadowsEnabled(value);
    },
    requestLock() { requestGamePointerLock(); },
    loadMap: loadMapVortex,
    addPart(x, y, z, sx = 4, sy = 1, sz = 4, color = 0x4a6fd8, canCollide = true) {
        const [mesh, id] = addStud(sx, sy, sz, color, x, y - sy * 0.5, z, 0, 0, 0, "Block", 0, false, canCollide);
        return { mesh, id };
    },
    pick: getClicked3DPoint,
    getObjects: () => objects,
    getColliders: () => colliders,
    rebuildStudCollider,
    removePart(id) {
        removeStud(id);
    },
    getCamera: () => camera,
    getCharBubbleBase: () => character ? character.position.y + CHAR_HEIGHT - CHAR_FOOT_OFFSET + 0.4 : 0,
    setSpawn(x, y, z, ry = Math.PI) {
        console.log(`set spawn to: ${x} ${y} ${z}`)
        _spawnPoint = { x, y, z, ry };
        if (character) {
            character.position.set(x, y + CHAR_FOOT_OFFSET, z);
            character.rotation.y = ry;
        }
    },
    applyShirt(url) {
        _applyShirtToMesh(_shirtMesh, url);
    },
    applyShirtToMesh(mesh, url) {
        _applyShirtToMesh(mesh, url);
    },
    buildShirtOverlay(target) {
        if (_avatarRenderer === "modern") {
            _prepareModernAvatarMaterials(target);
            return null;
        }
        return _buildShirtOverlay(target);
    },
    buildPantsOverlay(target) {
        if (_avatarRenderer === "modern") {
            _prepareModernAvatarMaterials(target);
            return null;
        }
        return null;
    },
    buildFaceOverlay(target) {
        if (_avatarRenderer === "modern") {
            _prepareModernAvatarMaterials(target);
            return null;
        }
        return null;
    },
    applyBodyColors(target, colors) {
        _applyBodyColors(target, colors);
    },
    prepareModernAvatarMaterials(target) {
        return _prepareModernAvatarMaterials(target);
    },
    prefetchAvatarImages(avatars) {
        _prefetchAvatarImages(Array.isArray(avatars) ? avatars : [avatars]);
    },
    async applyAvatar(avatar) {
        await _applyAvatar(avatar);
    },
    async applyAvatarToMeshes(meshes, avatar) {
        if (!meshes) return;
        const normalized = _normalizeAvatar(avatar, _neutralAvatarState);
        if (window.VortexAvatarDebug) console.debug("[avatar] remote", JSON.stringify(normalized));
        if (_avatarRenderer === "modern") {
            _applyBodyColors(meshes.grp, normalized.body_colors);
            const [shirtUrl, pantsUrl, faceUrl] = await Promise.all([
                _avatarClothingUrl(normalized.shirt_id).catch(() => null),
                _avatarClothingUrl(normalized.pant_id).catch(() => null),
                _avatarClothingUrl(normalized.face_id).catch(() => null),
            ]);
            _applyModernAvatarTextures(meshes.grp, { shirtUrl, pantsUrl, faceUrl });
        } else {
            const shirtUrl = await _avatarClothingUrl(normalized.shirt_id).catch(() => null);
            _applyShirtToMesh(meshes.shirtMesh, shirtUrl);
            _applyShirtToMesh(meshes.pantsMesh, null);
            _applyShirtToMesh(meshes.faceMesh, null);
        }
    },
    getAvatarRenderer() {
        return _avatarRenderer;
    },
    setAvatarRenderer(mode) {
        return _setAvatarRenderer(mode);
    },
    getAvatar() {
        return { ..._avatarState, body_colors: [..._avatarState.body_colors] };
    },
};

window.VortexQuality = {
    get() {
        return {
            shadows: shadowsActive(),
            antialias: readStorageFlag('v22Antialias', false),
            pixelRatio: renderer.getPixelRatio(),
            toneMapping: toneMappingMode,
            shadowMapSize,
            avatarRenderer: _avatarRenderer,
            perfProfiler: !!VortexPerf.enabled,
            runtimeBooted: !!window.VortexRuntime,
            runtimeDisabled: localStorage.getItem("v22RuntimeDisabled") === "1",
            runtimeDevTools: !!window.VortexRuntimeDevTools?.active?.(),
            renderer: window.VortexRuntime?.renderer?.snapshot?.() || null,
            caches: {
                geometries: geoCache.size,
                materials: matCache.size,
                textures: texCache.size
            }
        };
    },
    setShadows(value) {
        return setShadowsEnabled(value);
    },
    setAvatarRenderer(mode) {
        return _setAvatarRenderer(mode);
    },
    setToneMapping(mode) {
        return setToneMappingMode(mode);
    },
    performance() {
        setShadowsEnabled(false);
        localStorage.setItem('v22Antialias', '0');
        setToneMappingMode('none');
        return this.get();
    },
    visual() {
        setShadowsEnabled(true);
        localStorage.setItem('v22Antialias', '1');
        setToneMappingMode('agx');
        return this.get();
    },
};


window.THREE = THREE;
window.FBXLoader = FBXLoader;
window.GLTFLoader = GLTFLoader;
window.fbxLoader = fbxLoader;
window.gltfLoader = gltfLoader;

window.addStud = addStud;
window.removeStud = removeStud;
window.rebuildStudCollider = rebuildStudCollider;
window.getCachedGeo = getCachedGeo;
window.getCachedMats = getCachedMats;
window.removeMatching_array = removeMatching_array;

window.scene = scene;
window.ambient = ambient;
window.renderer = renderer;
window.objects = objects;
window.camera = camera;
window.cam = cam;
window.VortexRuntime?.renderer?.attachLegacy?.({ scene, camera, renderer });
window.VortexRuntime?.world?.attachLegacy?.({
    addPart: window._vortex?.addPart,
    removePart: window._vortex?.removePart,
    pick: window._vortex?.pick,
    getObjects: window._vortex?.getObjects,
    getColliders: window._vortex?.getColliders
});

window._cursorOver = _cursorOver;

window.clickSound = clickSound;
window.canPlaySounds = false;

window.BLOCK_COLORS = BLOCK_COLORS;
window.MAX_BLOCKS = MAX_BLOCKS;
window.validPlacement = validPlacement;

requestAnimationFrame(loop);
