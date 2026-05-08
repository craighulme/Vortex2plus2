//Made by inuk, for https://github.com/inuk84/Vortex-2-plus-2

console.log('VORTEX ENGINE OVERRIDDEN!')
const STUDS_PER_TILE = 4;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 192, 480);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0x87CEEB);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("scene").appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(1600, 3200, 1600);
sun.castShadow = true;
sun.shadow.mapSize.width = 5000;
sun.shadow.mapSize.height = 5000;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 19600;
sun.shadow.camera.left = -256;
sun.shadow.camera.right = 256;
sun.shadow.camera.top = 256;
sun.shadow.camera.bottom = -256;
sun.shadow.autoUpdate = true;
scene.add(sun);



const tlLoader = new THREE.TextureLoader();
const texCache = new Map();
let textures = JSON.parse(window._textures.content);
function studTex(rx, ry) {
    const t = tlLoader.load(textures.stud);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
}
function studNormalTex(rx, ry) {
    const t = tlLoader.load(textures.studNormal);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
}

const geoCache = new Map();
const matCache = new Map();

function getCachedGeo(sw, sh, sd) {
    const key = `${sw},${sh},${sd}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(sw, sh, sd));
    return geoCache.get(key);
}

function getCachedMats(sw, sh, sd, color) {
    const key = `${sw},${sh},${sd},${color}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = (rx, ry) => new THREE.MeshStandardMaterial({ color: color, map: studTex(rx, ry), normalMap: studNormalTex(rx, ry) });
    const mats = [
        m(sd / STUDS_PER_TILE, sh / STUDS_PER_TILE),
        m(sd / STUDS_PER_TILE, sh / STUDS_PER_TILE),
        m(sw / STUDS_PER_TILE, sd / STUDS_PER_TILE),
        m(sw / STUDS_PER_TILE, sd / STUDS_PER_TILE),
        m(sw / STUDS_PER_TILE, sh / STUDS_PER_TILE),
        m(sw / STUDS_PER_TILE, sh / STUDS_PER_TILE),
    ];
    matCache.set(key, mats);
    return mats;
}

const instancedMeshes = new Map();
const MAX_INSTANCES = 1024;

function getInstanceKey(sw, sh, sd, color) { return `${sw},${sh},${sd},${color}`; }

function flushInstances() {
    for (const [, entry] of instancedMeshes) {
        entry.mesh.count = entry.count;
        entry.mesh.instanceMatrix.needsUpdate = true;
    }
}

const _dummy = new THREE.Object3D();

function addStud(sw, sh, sd, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(
        getCachedGeo(sw, sh, sd),
        getCachedMats(sw, sh, sd, color)
    );
    const cy = y + sh / 2;
    mesh.position.set(x, cy, z);
    if (rx !== 0 || ry !== 0 || rz !== 0) mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (rx === 0 && ry === 0 && rz === 0) {
        const b = {
            minX: x - sw / 2, maxX: x + sw / 2,
            minY: y, maxY: y + sh,
            minZ: z - sd / 2, maxZ: z + sd / 2,
        };
        colliders.push(b);
        insertToChunks(b);
    } else {
        ry = ry % 360
        while (ry > 45) {
            ry -= 45
            sx, sz = sz, -sx
        }
        const b = buildOBB(sw, sh, sd, x, cy, z, rx, ry, rz);
        colliders.push(b);
        insertToChunks(b);
    }
    return mesh;
}

function buildOBB(sw, sh, sd, cx, cy, cz, rx, ry, rz) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
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

const ground = new THREE.Mesh(
    getCachedGeo(320, 3.2, 320),
    getCachedMats(320, 3.2, 320, 0x4db84b)
);
ground.receiveShadow = true;
scene.add(ground);

const colliders = [];

const CHUNK_SIZE = 4;
const chunkMap = new Map();

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

let CHAR_STAND_Y = 3.68;
const WALK_SPEED = 16;
const JUMP_POWER = 50;
const GRAVITY = -196.2;
const ROT_SPEED = 14;
const STEP_HEIGHT = 1.5;
const STEP_CLIMB_SPEED = 32;

let CHAR_FOOT_OFFSET = 2.08;
let CHAR_HEIGHT = 5;
let CHAR_HALF_W = 1;
let CHAR_HALF_D = 0.5;

let CAM_H_SENS = 0.0015 * Math.PI;
let CAM_V_SENS = 0.0015 * Math.PI;
const CAM_PIVOT_Y = 2.56;
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
let locked = false;
let coyoteTimer = 0;
let jumpBuffer = 0;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.15;

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

const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const cursorEl = document.getElementById('cursor');
let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;

const anim = { time: 0, bones: {}, rest: {} };

function getBone(...names) {
    for (const n of names) if (anim.bones[n]) return anim.bones[n];
    return null;
}

let character = null;
let _spawnPoint = { x: 0, y: null, z: 0, ry: Math.PI };

const fbxLoader = new THREE.FBXLoader();
fbxLoader.load('assets/models/player.fbx', (fbx) => {
    const helper = new THREE.SkeletonHelper(fbx.children[0]);
    scene.add(helper);

    fbx.position.set(0, 0, 0);
    fbx.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(fbx);
    CHAR_FOOT_OFFSET = -box.min.y;
    CHAR_HEIGHT = box.max.y - box.min.y;
    CHAR_STAND_Y = G + CHAR_FOOT_OFFSET;
    console.log('char foot offset:', CHAR_FOOT_OFFSET.toFixed(3), '| height:', CHAR_HEIGHT.toFixed(3));

    const spawnY = _spawnPoint.y !== null ? _spawnPoint.y + CHAR_FOOT_OFFSET : CHAR_STAND_Y;
    fbx.position.set(_spawnPoint.x, spawnY, _spawnPoint.z);
    fbx.rotation.y = _spawnPoint.ry;
    fbx.castShadow = true;
    fbx.traverse(child => {
        if (child.isBone || child.type === 'Bone') {
            anim.bones[child.name] = child;
            anim.rest[child.name] = {
                x: child.rotation.x, y: child.rotation.y, z: child.rotation.z,
                px: child.position.x, py: child.position.y, pz: child.position.z,
            };
        }
    });
    fbx.traverse(child => {
        if (child.isMesh) child.castShadow = true;
    });
    fbx.children[0].receiveShadow=true;

    scene.add(fbx);
    character = fbx;

    renderer.shadowMap.needsUpdate = true;
});

const cam = {
    yaw: 0,
    pitch: 0.35,
    distance: 25.6,
    minPitch: -1.55,
    maxPitch: 1.55,
    minDist: 3.2,
    maxDist: 512,
};

const keys = {};

document.addEventListener('keydown', e => {
    if (window._chatFocused) return;
    if (!locked) return;
    keys[e.code] = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        shiftLock = !shiftLock;
        crosshair.style.display = shiftLock ? 'block' : 'none';
        cursorEl.style.display = shiftLock ? 'none' : 'block';
        if (!shiftLock) {
            cursorX = window.innerWidth / 2;
            cursorY = window.innerHeight / 2;
            cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
            if (character) {
                character.rotation.y = ((character.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                if (character.rotation.y > Math.PI) character.rotation.y -= 2 * Math.PI;
            }
        }
    }
    if (e.code === 'Comma') cam.yaw = Math.round((cam.yaw + Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4);
    if (e.code === 'Period') cam.yaw = Math.round((cam.yaw - Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4);
    if (e.code === 'Space') jumpBuffer = JUMP_BUFFER;
    if (e.code === 'Backquote') toggleDebug();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('pointerlockchange', () => {
    locked = !!document.pointerLockElement;
    if (locked) {
        overlay.classList.add('hidden');
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    } else {
        overlay.classList.remove('hidden');
        Object.keys(keys).forEach(k => keys[k] = false);
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

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('click', () => {
    if (locked) {
        const cursorOver = _cursorOver;

        const chatEl = document.getElementById('chat-window');
        const topbarEl = document.getElementById('hud-topbar');
        const lbFriendEl = document.getElementById('lb-player-panel');
        const lbBodyEl = document.getElementById('lb-body');

        if (chatEl && !chatEl.classList.contains('hidden') && cursorOver(chatEl)) {
            const sendBtnEl = document.getElementById('chat-send');
            if (sendBtnEl && cursorOver(sendBtnEl)) {
                window.Chat?.send();
            } else {
                window.Chat?.activate();
            }
            return;
        }

        if (cursorOver(topbarEl)) {
            for (const child of topbarEl.children) {
                if (cursorOver(child)) { child.click(); break; }
            }
            return;
        }

        if (lbFriendEl && lbFriendEl.style.display !== 'none' && cursorOver(lbFriendEl)) {
            for (const child of lbFriendEl.querySelectorAll('button, a')) {
                if (cursorOver(child)) { child.click(); return; }
            }
            return;
        }

        if (lbBodyEl) {
            for (const row of lbBodyEl.querySelectorAll('[data-player-id]')) {
                if (cursorOver(row)) {
                    window.Leaderboard?.selectPlayer(parseInt(row.dataset.playerId));
                    return;
                }
            }
        }

        const notifEl = document.getElementById('notif-container');
        if (notifEl) {
            for (const btn of notifEl.querySelectorAll('.notif-btn:not(:disabled)')) {
                if (cursorOver(btn)) { btn.click(); return; }
            }
        }

        if (window._chatFocused) {
            window.Chat?.deactivate();
            return;
        }

        window.Leaderboard?.closeFriendPanel();
    }
    renderer.domElement.requestPointerLock();
});
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 2) { rmb = true; return; }
    if (e.button === 0 && locked) {
        const panel = document.getElementById('settings-panel');
        if (panel && panel.style.display !== 'none') {
            for (const slider of panel.querySelectorAll('input[type=range]')) {
                if (_cursorOver(slider)) { _sliderDrag = slider; return; }
            }
        }
    }
});
document.addEventListener('mouseup', e => {
    if (e.button === 2) rmb = false;
    if (e.button === 0) _sliderDrag = null;
});

document.addEventListener('mousemove', e => {
    if (!locked) return;
    if (_sliderDrag) {
        cursorX = Math.max(0, Math.min(window.innerWidth, cursorX + e.movementX));
        cursorY = Math.max(0, Math.min(window.innerHeight, cursorY + e.movementY));
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        const range = parseFloat(_sliderDrag.max) - parseFloat(_sliderDrag.min);
        let v = parseFloat(_sliderDrag.value) + e.movementX * range * 0.005;
        v = Math.max(parseFloat(_sliderDrag.min), Math.min(parseFloat(_sliderDrag.max), v));
        _sliderDrag.value = v;
        _sliderDrag.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }
    if (shiftLock || rmb) {
        cam.yaw -= e.movementX * CAM_H_SENS;
        cam.pitch = Math.max(cam.minPitch, Math.min(cam.maxPitch, cam.pitch + e.movementY * CAM_V_SENS));
    } else {
        cursorX = Math.max(0, Math.min(window.innerWidth, cursorX + e.movementX));
        cursorY = Math.max(0, Math.min(window.innerHeight, cursorY + e.movementY));
        cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    }
});

renderer.domElement.addEventListener('wheel', e => {
    if (locked) {
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
    cam.distance = Math.max(cam.minDist, Math.min(cam.maxDist, cam.distance + e.deltaY * 0.015));
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
            if (b.maxY + CHAR_FOOT_OFFSET > stepUpTarget) { stepUpTarget = b.maxY + CHAR_FOOT_OFFSET; console.log('stepup') }
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
            if (velY < 0) { velY = 0; grounded = true; extraVelX = 0; extraVelZ = 0; }
        } else {
            character.position.y -= pushY;
            if (velY > 0) velY = 0;
        }
    }
}

function resolveBlocksH(nearby,dt) {
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
            character.position.x -= Math.sign(dx) * Math.min(ov0,STEP_CLIMB_SPEED*dt);
        } else {
            character.position.z -= Math.sign(dz) * Math.min(ov1,STEP_CLIMB_SPEED*dt);
        }
        pushedBlocks.add(b);
    }
}


function resolveBlocksV(nearby,dt) {
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
            if(change>0){
                grounded=true;
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

    dt = Math.min(dt,0.05);

    if (keys['KeyI']) cam.distance = Math.max(cam.minDist, cam.distance - CAM_KEY_ZOOM_SPEED * dt);
    if (keys['KeyO']) cam.distance = Math.min(cam.maxDist, cam.distance + CAM_KEY_ZOOM_SPEED * dt);

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

        if (shiftLock) {
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

    const moveInput = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) moveInput.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveInput.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveInput.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveInput.x += 1;

    const moving = moveInput.lengthSq() > 0;
    let velX = 0, velZ = 0;
    if (moving) {
        moveInput.normalize();
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), cam.yaw
        );
        moveInput.applyQuaternion(yawQuat);

        velX = moveInput.x * WALK_SPEED;
        velZ = moveInput.z * WALK_SPEED;

        if (!shiftLock) {
            const targetAngle = Math.atan2(moveInput.x, moveInput.z);
            character.rotation.y = lerpAngle(character.rotation.y, targetAngle, Math.min(1, ROT_SPEED * dt));
        }
    }

    velX += extraVelX;
    velZ += extraVelZ;

    const sp2 = velX * velX + velZ * velZ;
    if (sp2 > WALK_SPEED * WALK_SPEED) {
        const sc = WALK_SPEED / Math.sqrt(sp2);
        velX *= sc;
        velZ *= sc;
    }

    {
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

    if (shiftLock) character.rotation.y = cam.yaw + Math.PI;

    climbCooldown = Math.max(0, climbCooldown - dt);



    if (stepUpTarget > character.position.y) {
        const rise = Math.min(stepUpTarget - character.position.y, STEP_CLIMB_SPEED * dt);
        character.position.y += rise;
        velY = 0;
        grounded = true;
    }

    const nearby = getNearbyColliders(character.position.x, character.position.y, character.position.z);

    resolveBlocksH(nearby,dt);
    resolveOBBH(nearby);
    tryLedgeGrab(nearby);

    if (grounded) coyoteTimer = COYOTE_TIME;
    else coyoteTimer = Math.max(0, coyoteTimer - dt);

    if (keys['Space']) jumpBuffer = JUMP_BUFFER;
    jumpBuffer = Math.max(0, jumpBuffer - dt);

    velY += GRAVITY * dt;
    character.position.y += velY * dt;

    grounded = false;
    if (character.position.y <= CHAR_STAND_Y) {
        character.position.y = CHAR_STAND_Y;
        velY = 0;
        grounded = true;
        extraVelX = 0; extraVelZ = 0;
    }

    resolveBlocksV(nearby,dt);
    resolveOBBV(nearby);

    if (jumpBuffer > 0 && (grounded || coyoteTimer > 0)) {
        velY = JUMP_POWER;
        grounded = false;
        coyoteTimer = 0;
        jumpBuffer = 0;
    }

    updateAnimations(dt, moving);
}

function updateCamera() {
    if (!character) return;

    const sinYaw = Math.sin(cam.yaw);
    const cosYaw = Math.cos(cam.yaw);
    const sinPitch = Math.sin(cam.pitch);
    const cosPitch = Math.cos(cam.pitch);

    const pivot = new THREE.Vector3(
        character.position.x,
        character.position.y + CAM_PIVOT_Y,
        character.position.z
    );

    if (shiftLock) {
        pivot.x += cosYaw * SHIFT_LOCK_OFFSET;
        pivot.z += -sinYaw * SHIFT_LOCK_OFFSET;
    }

    camera.position.set(
        pivot.x + cam.distance * cosPitch * sinYaw,
        pivot.y + cam.distance * sinPitch,
        pivot.z + cam.distance * cosPitch * cosYaw
    );
    camera.lookAt(pivot);
}

let lastTime = performance.now();

function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    updateCamera();

    if (charDebugMesh && character) {
        const fy = character.position.y - CHAR_FOOT_OFFSET;
        charDebugMesh.position.set(character.position.x, fy + CHAR_HEIGHT / 2, character.position.z);
        charDebugMesh.rotation.y = character.rotation.y;
    }
    updateDebugMeshes();

    window._mpUpdate?.(dt);
    sun.position.set(camera.position.x + 1000, camera.position.y + 2000, camera.position.z + 1000);
    sun.target.position.copy(camera.position);
    sun.updateMatrixWorld();
    sun.target.updateMatrixWorld();
    sun.shadow.camera.updateProjectionMatrix();
    renderer.render(scene, camera);
}

const DEG2RAD = Math.PI / 180;

async function loadMap(path, tx = 0, ty = 0, tz = 0) {
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

window._vortex = {
    scene,
    getCharacter: () => character,
    getGrounded: () => grounded,
    getVelY: () => velY,
    getClimbState: () => climbState,
    getCharFootOffset: () => CHAR_FOOT_OFFSET,
    getCharHeight: () => CHAR_HEIGHT,
    getAnimRest: () => anim.rest,
    keys,
    setSens(mult) {
        CAM_H_SENS = 0.002 * Math.PI * mult;
        CAM_V_SENS = 0.0015 * Math.PI * mult;
    },
    requestLock() { renderer.domElement.requestPointerLock(); },
    loadMap,
    getCamera: () => camera,
    getCharBubbleBase: () => character ? character.position.y + CHAR_HEIGHT - CHAR_FOOT_OFFSET + 0.4 : 0,
    setSpawn(x, y, z, ry = Math.PI) {
        _spawnPoint = { x, y, z, ry };
        if (character) {
            character.position.set(x, y + CHAR_FOOT_OFFSET, z);
            character.rotation.y = ry;
        }
    },
};


requestAnimationFrame(loop);