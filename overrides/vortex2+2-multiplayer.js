if (typeof COLORS == 'undefined') {
    const COLORS = ['#1a1a1a', '#2563EB', '#16A34A', '#9333EA', '#D97706', '#DC2626', '#0891B2'];
}
function avatarColor(u) {
    let h = 0;
    for (const c of u) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
    return parseInt(COLORS[h % COLORS.length].slice(1), 16);
}

function _isBone(n) { return n.isBone || n.type === 'Bone'; }
function _boneAlias(name) { return String(name || "").replace(/\s+/g, "_"); }
const NATIVE_CHARACTER_FOOT_OFFSET = 2.0;

function _nativeFootOffset() {
    const offset = Number(localStorage.getItem("v22NativeFootOffset"));
    return Number.isFinite(offset) && Math.abs(offset) < 10 ? offset : NATIVE_CHARACTER_FOOT_OFFSET;
}

function _sceneFootOffset() {
    const offset = Number(_vortex.getCharFootOffset?.());
    return Number.isFinite(offset) ? offset : _nativeFootOffset();
}

function _nativeYToSceneY(y) {
    return Number(y) - _nativeFootOffset() + _sceneFootOffset();
}

function _sceneYToNativeY(y) {
    return Number(y) - _sceneFootOffset() + _nativeFootOffset();
}

function _normalizeAvatarFields(data = {}) {
    const colors = Array.isArray(data.body_colors) ? data.body_colors : (Array.isArray(data.bodyColors) ? data.bodyColors : []);
    return {
        shirt_id: Number(data.shirt_id ?? data.shirtId ?? 0) || 0,
        pant_id: Number(data.pant_id ?? data.pantId ?? 0) || 0,
        body_type: String(data.body_type ?? data.bodyType ?? "male").toLowerCase() === "female" ? "female" : "male",
        body_colors: _safeBodyColors(colors),
        face_id: Number(data.face_id ?? data.faceId ?? 0) || 0
    };
}

function _clonePlayerFBX() {
    const src = _vortex.getCharacter();
    if (!src) return null;

    const clone = src.clone(true);
    const toRemove = [];
    clone.traverse(o => {
        if (/Overlay$/.test(o.name || "")) toRemove.push(o);
    });
    toRemove.forEach(o => o.parent?.remove(o));

    clone.traverse(o => {
        if (!o.isMesh) return;
        if (Array.isArray(o.material)) {
            o.material = o.material.map(m => m?.clone ? m.clone() : m);
        } else if (o.material?.clone) {
            o.material = o.material.clone();
        }
        delete o.userData.v22ClonedBodyMaterials;
        delete o.userData.v22ClonedBodyMaterial;
    });

    const srcBones = {}, cloneBones = {};
    src.traverse(n => {
        if (!_isBone(n)) return;
        srcBones[n.name] = n;
        srcBones[_boneAlias(n.name)] = n;
    });
    clone.traverse(n => {
        if (!_isBone(n)) return;
        cloneBones[n.name] = n;
        cloneBones[_boneAlias(n.name)] = n;
    });

    const srcMeshes = [], cloneMeshes = [];
    src.traverse(m => { if (m.isSkinnedMesh) srcMeshes.push(m); });
    clone.traverse(m => { if (m.isSkinnedMesh) cloneMeshes.push(m); });
    srcMeshes.forEach((srcM, i) => {
        const cloneM = cloneMeshes[i];
        if (!cloneM) return;
        const newBones = srcM.skeleton.bones.map(b => cloneBones[b.name] || cloneBones[_boneAlias(b.name)] || b);
        cloneM.skeleton = new THREE.Skeleton(newBones, srcM.skeleton.boneInverses.map(m => m.clone()));
        cloneM.bind(cloneM.skeleton, srcM.bindMatrix.clone());
    });

    const rest = _vortex.getAnimRest();
    clone.traverse(n => {
        if (!_isBone(n)) return;
        const r = rest[n.name] || rest[_boneAlias(n.name)];
        if (!r) return;
        n.rotation.set(r.x, r.y, r.z);
        n.position.y = r.py;
    });

    clone.rotation.set(0, Math.PI, 0);
    clone.traverse(m => { if (m.isMesh) m.castShadow = true; });
    clone.visible = false;
    _vortex.scene.add(clone);
    return clone;
}

function _makeNameLabel(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 44px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 6;
    ctx.strokeText(username, 256, 58);
    ctx.fillStyle = '#fff';
    ctx.fillText(username, 256, 58);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    spr.scale.set(4, 0.625, 1);
    return spr;
}

function makeRemote(username, id, avatar) {
    const grp = _clonePlayerFBX();
    if (!grp) return null;

    const fo = _vortex.getCharFootOffset();
    const ch = _vortex.getCharHeight();
    const spr = _makeNameLabel(username);
    spr.position.y = ch - fo + 1.4;
    grp.add(spr);

    const bones = {};
    grp.traverse(n => {
        if (!_isBone(n)) return;
        bones[n.name] = n;
        bones[_boneAlias(n.name)] = n;
    });
    const rest = _vortex.getAnimRest();
    const shirtMesh = _vortex.buildShirtOverlay(grp);
    const pantsMesh = _vortex.buildPantsOverlay?.(grp);
    const faceMesh = _vortex.buildFaceOverlay?.(grp);
    const meshes = { grp, bones, rest, shirtMesh, pantsMesh, faceMesh };
    _vortex.applyAvatarToMeshes?.(meshes, avatar);
    return meshes;
}

function disposeRemote(m) {
    if (!m) return;
    _vortex.scene.remove(m.grp);
    m.grp.traverse(o => {
        if (o.isSprite) {
            o.material?.map?.dispose();
            o.material?.dispose();
        }
    });
}

function _setB(bones, rest, name, axis, target, sp, dt) {
    const bone = bones[name];
    if (!bone) return;
    const r = rest[name]?.[axis] ?? 0;
    bone.rotation[axis] = THREE.MathUtils.lerp(bone.rotation[axis], r + target, Math.min(1, sp * dt));
}

function _setPosY(bones, rest, name, offset, sp, dt) {
    const bone = bones[name];
    if (!bone) return;
    const ry = rest[name]?.py ?? 0;
    bone.position.y = THREE.MathUtils.lerp(bone.position.y, ry + offset, Math.min(1, sp * dt));
}

let swords = new Map()
function _animateRemote(id, r, dt) {
    const { bones, rest } = r.meshes;
    const sp = 12;
    r.animTime += dt;
    const t = r.animTime;

    if (r.anim === 'climb') {
        const grip = Math.sin(t * 6) * 0.15;
        const kick = Math.sin(t * 6) * 0.3;
        _setB(bones, rest, 'Left_Arm', 'x', -Math.PI * 0.75 + grip, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'x', -Math.PI * 0.75 - grip, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'z', 0.35, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'z', -0.35, sp, dt);
        _setB(bones, rest, 'Left_Leg', 'x', 0.3 + kick, sp, dt);
        _setB(bones, rest, 'Right_Leg', 'x', 0.3 - kick, sp, dt);
        _setB(bones, rest, 'Torso', 'x', -0.15, sp, dt);
        _setB(bones, rest, 'Torso', 'z', 0, sp, dt);
        _setPosY(bones, rest, 'Left_Arm', 0.5, sp, dt);
        _setPosY(bones, rest, 'Right_Arm', 0.5, sp, dt);
    } else if (r.anim === 'jump') {
        _setB(bones, rest, 'Left_Leg', 'x', 0, sp, dt);
        _setB(bones, rest, 'Right_Leg', 'x', 0, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'x', -Math.PI, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'x', -Math.PI, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'z', 0, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'z', 0, sp, dt);
        _setB(bones, rest, 'Torso', 'x', 0, sp, dt);
        _setPosY(bones, rest, 'Left_Arm', -0.75, sp, dt);
        _setPosY(bones, rest, 'Right_Arm', -0.75, sp, dt);
    } else if (r.anim === 'walk') {
        const swing = Math.sin(t * 2.8 * Math.PI);
        _setB(bones, rest, 'Left_Leg', 'x', swing * 1.0, sp, dt);
        _setB(bones, rest, 'Right_Leg', 'x', -swing * 1.0, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'x', -swing * 0.8, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'x', swing * 0.8, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'z', 0.05, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'z', -0.05, sp, dt);
        _setB(bones, rest, 'Torso', 'x', 0.03, sp, dt);
        _setB(bones, rest, 'Torso', 'z', 0, sp, dt);
        _setPosY(bones, rest, 'Left_Arm', 0, sp, dt);
        _setPosY(bones, rest, 'Right_Arm', 0, sp, dt);
    } else {
        const breathe = Math.sin(t * 1.2) * 0.015;
        _setB(bones, rest, 'Left_Leg', 'x', 0, sp, dt);
        _setB(bones, rest, 'Right_Leg', 'x', 0, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'x', 0, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'x', 0, sp, dt);
        _setB(bones, rest, 'Left_Arm', 'z', 0.1 + breathe, sp, dt);
        _setB(bones, rest, 'Right_Arm', 'z', -0.1 - breathe, sp, dt);
        _setB(bones, rest, 'Torso', 'x', breathe, sp, dt);
        _setB(bones, rest, 'Torso', 'z', 0, sp, dt);
        _setPosY(bones, rest, 'Left_Arm', 0, sp, dt);
        _setPosY(bones, rest, 'Right_Arm', 0, sp, dt);
    }

    if (window.SWORD_FIGHT) {
        let sword = swords.get(id);
        if (!swords.has(id)) {
            swords.set(id, false);
            fbxLoader.load(importedAssets.swordMdl, (fbx) => {
                fbx.scale.multiplyScalar(0.005);
                sword = fbx;
                sword.castShadow = true;
                sword.receiveShadow = true;
                sword.rotation.order = 'YXZ';
                scene.add(sword);
                swords.set(r.id, sword)
            });
            return
        }
        if (!sword) return
        _setB(bones, rest, 'Right_Arm', 'x', -Math.PI * 0.5, 1, 1);
        bones.Right_Arm.position.y = 1.5
        bones.Right_Arm.position.z = -0.5
        let g = r.meshes.grp;
        let pos = g.position;
        let ry = g.rotation.y;
        let fwdx = Math.sin(ry);
        let fwdz = Math.cos(ry);
        let rx = -Math.cos(ry);
        let rz = Math.sin(ry);

        if (!customPlayerData[id]) {
            return;
        }

        let slicing = customPlayerData[id].slicing

        let fwd = slicing ? 3.2 : 1.5;
        let right = 1.5;
        let up = slicing ? 1.5 : 2.8;

        let x = pos.x + rx * right + fwdx * fwd;
        let y = pos.y + up;
        let z = pos.z + rz * right + fwdz * fwd;

        sword.position.set(x, y, z);
        sword.rotation.y = ry;
        sword.rotation.x = slicing ? Math.PI * 0.5 : 0

        if (slicing) {
            let dx = (x - rx * 0.5) - character.position.x;
            let dy = y - character.position.y;
            let dz = (z - rz * 0.5) - character.position.z;
            let distsq = (dx * dx + dy * dy + dz * dz);
            if (distsq < 7) {
                playerSpecialValues.health -= dt * 1;
            }
        }
    }
}

const BUBBLE_WORLD_W = 3.2;
const BUBBLE_CANVAS_W = 400;
const BUBBLE_SCALE = BUBBLE_WORLD_W / BUBBLE_CANVAS_W;
const BUBBLE_DURATION = 15000;
const MAX_BUBBLES = 3;
const _bubbles = new Map();
const _healthbars = new Map();

const B_PAD = 18;
const B_R = 12;
const B_FONT = '600 30px system-ui,sans-serif';
const B_LINE = 38;
const B_TRI = 12;
const B_GAP = 6;
const _measureCtx = document.createElement('canvas').getContext('2d');
_measureCtx.font = B_FONT;

function _wrapLines(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
}

function _redrawBubble(id) {
    const b = _bubbles.get(id);
    if (!b) return;
    if (!b.msgs.length) { if (b.sprite) b.sprite.visible = false; return; }

    const maxWrapW = BUBBLE_CANVAS_W - B_PAD * 2;
    const msgLines = b.msgs.map(m => _wrapLines(_measureCtx, m.text, maxWrapW));

    const msgW = msgLines.map(ls =>
        Math.ceil(Math.min(Math.max(...ls.map(l => _measureCtx.measureText(l).width)) + B_PAD * 2, BUBBLE_CANVAS_W))
    );
    const CW = Math.max(...msgW);

    const msgBodyH = msgLines.map(ls => ls.length * B_LINE + B_PAD * 2);
    const totalH = msgBodyH.reduce((a, h) => a + h, 0) + B_GAP * (b.msgs.length - 1) + B_TRI;

    const canvas = document.createElement('canvas');
    canvas.width = CW; canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    ctx.font = B_FONT;

    let y = 0;
    for (let i = 0; i < b.msgs.length; i++) {
        const isBot = i === b.msgs.length - 1;
        const bodyH = msgBodyH[i];
        const lines = msgLines[i];
        const bw = msgW[i];
        const bx = (CW - bw) / 2;

        ctx.fillStyle = 'rgba(233, 233, 233, 0.95)';
        ctx.beginPath();
        ctx.moveTo(bx + B_R, y);
        ctx.lineTo(bx + bw - B_R, y);
        ctx.arcTo(bx + bw, y, bx + bw, y + B_R, B_R);
        ctx.lineTo(bx + bw, y + bodyH - B_R);
        ctx.arcTo(bx + bw, y + bodyH, bx + bw - B_R, y + bodyH, B_R);
        if (isBot) {
            ctx.lineTo(CW / 2 + B_TRI, y + bodyH);
            ctx.lineTo(CW / 2, y + bodyH + B_TRI);
            ctx.lineTo(CW / 2 - B_TRI, y + bodyH);
        }
        ctx.lineTo(bx + B_R, y + bodyH);
        ctx.arcTo(bx, y + bodyH, bx, y + bodyH - B_R, B_R);
        ctx.lineTo(bx, y + B_R);
        ctx.arcTo(bx, y, bx + B_R, y, B_R);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], CW / 2, y + B_PAD + j * B_LINE);
        }

        y += bodyH + (isBot ? B_TRI : B_GAP);
    }

    if (!b.sprite) {
        b.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true, transparent: true }));
        _vortex.scene.add(b.sprite);
    }
    b.sprite.material.map?.dispose();
    b.sprite.material.map = new THREE.CanvasTexture(canvas);
    b.sprite.material.needsUpdate = true;
    b.sprite.scale.set(CW * BUBBLE_SCALE, totalH * BUBBLE_SCALE, 1);
    b.sprite.visible = true;
}

function _showBubble(id, text) {
    let b = _bubbles.get(id);
    if (!b) { b = { msgs: [], sprite: null }; _bubbles.set(id, b); }

    if (b.msgs.length >= MAX_BUBBLES) {
        clearTimeout(b.msgs.shift().timer);
    }

    const entry = { text, timer: null };
    b.msgs.push(entry);
    _redrawBubble(id);

    entry.timer = setTimeout(() => {
        const idx = b.msgs.indexOf(entry);
        if (idx !== -1) b.msgs.splice(idx, 1);
        if (!b.msgs.length) {
            if (b.sprite) { b.sprite.visible = false; }
            _bubbles.delete(id);
        } else {
            _redrawBubble(id);
        }
    }, BUBBLE_DURATION);
}

function _redrawHealthbar(id, health) {
    let hbar = _healthbars.get(id);
    if (!hbar) { hbar = { sprite: null }; _healthbars.set(id, hbar); }

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 70;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let grad = ctx.createLinearGradient(0, 5, 0, canvas.height - 10)
    grad.addColorStop(0, "#3f8d00");
    grad.addColorStop(0.7, "#214602");
    grad.addColorStop(1, "#0b1a00");
    ctx.fillStyle = grad;
    ctx.fillRect(5, 5, Math.max(5, Math.min(canvas.width - 10, canvas.width * health)), canvas.height - 10);
    ctx.font = 'small-caps bold ' + (canvas.height - 20) + 'px sans-serif';
    ctx.fillStyle = "white";
    ctx.textAlign = 'end'
    ctx.textBaseline = 'middle'
    ctx.fillText("HEALTH", canvas.width - 10, (canvas.height - 10) * 0.65);

    if (!hbar.sprite) {
        hbar.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true, transparent: false }));
        _vortex.scene.add(hbar.sprite);
    }

    hbar.sprite.material.map?.dispose();
    hbar.sprite.material.map = new THREE.CanvasTexture(canvas);
    hbar.sprite.material.needsUpdate = true;

    hbar.sprite.scale.set(2.5, 0.35, 1);
    hbar.sprite.visible = true;
}

let playerSpecialValues = {
    health: 1,
    slicing: false,
}
let customPlayerData = {};

function _healthbarDrawingLoop(id) {
    if (id == myId) {
        customPlayerData[id] = playerSpecialValues
    }
    if (!customPlayerData[id]) {
        setTimeout(() => { _healthbarDrawingLoop(id) }, 500);
    } else {
        _redrawHealthbar(id, customPlayerData[id].health);
        setTimeout(() => { _healthbarDrawingLoop(id) }, 100);
    }

}
function _showHealthBar(id) {
    if (!window.SWORD_FIGHT) {
        return;
    }
    _healthbarDrawingLoop(id);
}

function _updateBubblePositions() {
    let bubbleOffset = window.SWORD_FIGHT ? 0.8 : 0.4;
    let bubbleBase = _vortex.getCharHeight() - _vortex.getCharFootOffset() + bubbleOffset;
    for (const [id, b] of _bubbles) {
        if (!b.sprite || !b.msgs.length) { if (b.sprite) b.sprite.visible = false; continue; }

        let wx, wy, wz;
        if (id === myId) {
            const char = _vortex.getCharacter();
            if (!char) { b.sprite.visible = false; continue; }
            wx = char.position.x; wy = _vortex.getCharBubbleBase(); wz = char.position.z;
        } else {
            const r = remotes.get(id);
            if (!r || !r.meshes || !r.meshes.grp.visible) { b.sprite.visible = false; continue; }
            const g = r.meshes.grp;
            wx = g.position.x; wy = g.position.y + bubbleBase; wz = g.position.z;
        }

        b.sprite.position.set(wx, wy + b.sprite.scale.y / 2, wz);
    }
    for (const [id, hbar] of _healthbars) {
        if (!hbar.sprite) { continue; }
        let wx, wy, wz;
        if (id === myId) {
            const char = _vortex.getCharacter();
            if (!char) { hbar.sprite.visible = false; continue; }
            wx = char.position.x; wy = _vortex.getCharBubbleBase(); wz = char.position.z;
        } else {
            const r = remotes.get(id);
            if (!r || !r.meshes || !r.meshes.grp.visible) { hbar.sprite.visible = false; continue; }
            const g = r.meshes.grp;
            wx = g.position.x; wy = g.position.y + bubbleBase; wz = g.position.z;
        }

        hbar.sprite.position.set(wx, wy + hbar.sprite.scale.y / 2 - 0.3, wz);
    }
}

const remotes = new Map();
window._vortexRemotes = remotes;
let myId = null;
let ws = null;
let broadcastTimer = null;
let bridgeConfig = null;
let launchInfo = null;
let connectPromise = null;
let connectFinished = false;
let animClock = 0;
let hubMode = false;

const _pendingAvatars = new Map();
const _pendingBubbles = new Map();

let _friendIds = new Set();
let _incomingIds = new Set();
let _outgoingIds = new Set();

function _statusFor(id) {
    if (_friendIds.has(id)) return 'friends';
    if (_incomingIds.has(id)) return 'request_received';
    if (_outgoingIds.has(id)) return 'request_sent';
    return 'none';
}

async function fetchFriendData() {
    const [friends, incoming, outgoing] = await Promise.all([
        fetch('/api/friends').then(r => r.ok ? r.json() : []),
        fetch('/api/friends/requests/incoming').then(r => r.ok ? r.json() : []),
        fetch('/api/friends/requests/outgoing').then(r => r.ok ? r.json() : []),
    ]);
    _friendIds = new Set(friends.map(f => f.id));
    _incomingIds = new Set(incoming.map(f => f.from_user_id));
    _outgoingIds = new Set(outgoing.map(f => f.to_user_id));

    const map = {};
    for (const [id] of remotes) map[id] = _statusFor(id);
    Leaderboard.setFriendStatuses(map);
}

let _reconnectAttempts = 0;
const _MAX_RECONNECTS = 3;

function randomHexToken(bytes = 32) {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return [...values].map(v => v.toString(16).padStart(2, "0")).join("");
}

function getBridgeConfig() {
    if (bridgeConfig) return bridgeConfig;
    const defaults = {
        officialGameId: Number(window.GAME_ID || 0),
        customGameId: null,
        launchToken: "",
        hubUrl: "ws://127.0.0.1:27822/ws"
    };
    const meta = document.getElementById("_vortexBridgeConfig");
    if (!meta?.content) {
        bridgeConfig = defaults;
        return bridgeConfig;
    }
    try {
        bridgeConfig = { ...defaults, ...JSON.parse(meta.content) };
    } catch (e) {
        console.warn("[mp] failed to parse bridge config", e);
        bridgeConfig = defaults;
    }
    return bridgeConfig;
}

function _isLocalRelayUrl(value) {
    try {
        const u = new URL(value);
        return ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
    } catch {
        return false;
    }
}

function bridgeOpen() {
    return ws && ws.readyState === WebSocket.OPEN;
}

function _u64(view, off) {
    if (off + 8 > view.byteLength) return null;
    const v = view.getBigUint64(off, true);
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(v);
}

function _u32(view, off) {
    return off + 4 <= view.byteLength ? view.getUint32(off, true) : null;
}

function _textOk(text) {
    return !!text && [...text].every(c => {
        const n = c.codePointAt(0);
        return n === 9 || n === 10 || n === 13 || (n >= 32 && n !== 0x7f);
    });
}

function _findField(obj, names) {
    const wanted = new Set(names.map(n => n.toLowerCase()));
    const seen = new Set();
    const stack = [obj];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
        seen.add(cur);
        for (const [k, v] of Object.entries(cur)) {
            if (wanted.has(k.toLowerCase())) return v;
            if (v && typeof v === 'object') stack.push(v);
        }
    }
    return undefined;
}

function _numField(obj, names, fallback = 0) {
    const v = _findField(obj, names);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
    return fallback;
}

function _strField(obj, names, fallback = "") {
    const v = _findField(obj, names);
    return typeof v === 'string' ? v : fallback;
}

function _wsEndpoint(raw) {
    const fields = [
        "websocket_url", "websocketUrl", "ws_url", "wsUrl", "socket_url", "socketUrl",
        "game_server", "gameServer", "server_addr", "serverAddr", "endpoint", "address"
    ];
    for (const name of fields) {
        const value = _findField(raw, [name]);
        if (typeof value === "string" && /^wss?:\/\//i.test(value)) return value;
    }
    const host = _strField(raw, ["ws_host", "wsHost", "websocket_host", "websocketHost"], "");
    const port = _numField(raw, ["ws_port", "wsPort", "websocket_port", "websocketPort"], 0);
    if (host && port) return `wss://${host}:${port}`;
    return null;
}

async function verifyLaunchToken(cfg) {
    const requestedClientToken = randomHexToken();
    const res = await fetch(`/api/verify-launch?token=${encodeURIComponent(cfg.launchToken)}`, {
        credentials: "include",
        cache: "no-store",
        headers: {
            "X-Client-Token": requestedClientToken
        }
    });
    if (!res.ok) {
        let detail = "";
        try { detail = await res.text(); } catch {}
        throw new Error(`verify-launch failed: HTTP ${res.status}${detail ? " " + detail : ""}`);
    }
    const raw = await res.json();
    const info = {
        raw,
        id: _numField(raw, ["id", "user_id", "userId", "player_id", "playerId"], 0),
        username: _strField(raw, ["username", "name", "display_name", "displayName"], "BrowserPlayer"),
        gameId: _numField(raw, ["game_id", "gameId", "game"], Number(cfg.officialGameId || window.GAME_ID || 0)),
        shirtId: _numField(raw, ["shirt_id", "shirtId", "clothing_id", "clothingId"], 0),
        pantId: _numField(raw, ["pant_id", "pantId"], 0),
        bodyType: _strField(raw, ["body_type", "bodyType"], "male"),
        bodyColors: Array.isArray(raw?.body_colors) ? raw.body_colors : (Array.isArray(raw?.bodyColors) ? raw.bodyColors : []),
        faceId: _numField(raw, ["face_id", "faceId"], 0),
        clientToken: _strField(raw, ["client_token", "clientToken", "token"], cfg.launchToken),
        appToken: _strField(raw, ["app_token", "appToken"], ""),
        requestedClientToken,
        wsEndpoint: _wsEndpoint(raw)
    };
    if (!info.id) throw new Error("verify-launch response did not expose a player id");
    return info;
}

function _parseMovementRecord(buffer, offset, hasPacketType) {
    const view = new DataView(buffer, offset);
    const start = hasPacketType ? 4 : 0;
    if (view.byteLength < start + 34) return null;
    const id = _u64(view, start);
    const game = _u64(view, start + 8);
    const nameLen = _u64(view, start + 16);
    if (id == null || game == null || !nameLen || nameLen > 64) return null;
    const nameOff = start + 24;
    if (nameOff + nameLen > view.byteLength) return null;
    const bytes = new Uint8Array(buffer, offset + nameOff, nameLen);
    const name = new TextDecoder().decode(bytes);
    if (!_textOk(name)) return null;

    const foffNoNul = nameOff + nameLen;
    const offsets = [foffNoNul + 1, foffNoNul + 2, foffNoNul];
    let best = null;
    for (const foff of offsets) {
        if (foff + 18 > view.byteLength) continue;
        const x = view.getFloat32(foff, true);
        const y = view.getFloat32(foff + 4, true);
        const z = view.getFloat32(foff + 8, true);
        const yaw = view.getFloat32(foff + 12, true);
        if (![x, y, z, yaw].every(Number.isFinite)) continue;
        if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000 || Math.abs(z) > 1000000) continue;
        const hasModernTail = foff + 63 <= view.byteLength && view.getUint8(foff + 22) === 1;
        const avatar = _readPacketAvatar(view, foff);
        if (hasModernTail && !avatar.valid) continue;
        const rec = {
            id, game, name, x, y, z, yaw,
            state0: view.getUint8(foff + 16),
            state1: view.getUint8(foff + 17),
            animTime: foff + 22 <= view.byteLength ? view.getFloat32(foff + 18, true) : 0,
            ...avatar,
            floatOffset: foff,
            recordBytes: hasModernTail ? 63 : (foff + 55 <= view.byteLength ? 55 : 22)
        };
        let score = 0;
        if (rec.state0 <= 1 && rec.state1 <= 1) score += 100;
        if (Math.abs(rec.yaw) <= 8) score += 20;
        if (foff === foffNoNul + 1) score += 4;
        else if (foff === foffNoNul + 2) score += 2;
        if (!best || score > best.score) best = { rec, score };
    }
    return best?.rec || null;
}

function _packetColorHex(value) {
    return `#${(Number(value || 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

function _readPacketAvatar(view, foff) {
    const avatar = {
        shirtId: 0,
        pantId: 0,
        bodyType: "male",
        bodyColors: [],
        faceId: 0,
        hasAvatar: false,
        valid: true
    };
    if (foff + 63 <= view.byteLength && view.getUint8(foff + 22) === 1) {
        const firstId = view.getUint32(foff + 23, true);
        avatar.faceId = firstId;
        avatar.pantId = view.getUint32(foff + 28, true);
        const colors = [];
        let off = foff + 33;
        for (let i = 0; i < 6; i += 1) {
            colors.push(_packetColorHex(view.getUint32(off, true)));
            off += 4;
        }
        avatar.bodyColors = colors;
        const bodyTypeByte = view.getUint8(off);
        avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
        avatar.faceId = view.getUint32(off + 1, true);
        avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) &&
            avatar.pantId >= 0 && avatar.pantId < 1000 &&
            avatar.faceId >= 0 && avatar.faceId < 1000;
        avatar.hasAvatar = avatar.valid;
    } else if (foff + 55 <= view.byteLength) {
        avatar.shirtId = view.getUint8(foff + 22);
        avatar.pantId = view.getUint8(foff + 23);
        const colors = [];
        let off = foff + 25;
        for (let i = 0; i < 6; i += 1) {
            colors.push(_packetColorHex(view.getUint32(off, true)));
            off += 4;
        }
        avatar.bodyColors = colors;
        const bodyTypeByte = view.getUint8(off);
        avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
        avatar.faceId = view.getUint32(off + 1, true);
        avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) &&
            avatar.shirtId >= 0 && avatar.shirtId < 1000 &&
            avatar.pantId >= 0 && avatar.pantId < 1000 &&
            avatar.faceId >= 0 && avatar.faceId < 1000;
        avatar.hasAvatar = avatar.valid;
    } else if (foff + 27 <= view.byteLength && view.getUint8(foff + 22) === 1) {
        avatar.faceId = view.getUint32(foff + 23, true);
    } else if (foff + 26 <= view.byteLength) {
        avatar.shirtId = view.getUint32(foff + 22, true);
    }
    if (avatar.shirtId < 0 || avatar.shirtId >= 1000) avatar.shirtId = 0;
    if (avatar.pantId < 0 || avatar.pantId >= 1000) avatar.pantId = 0;
    if (avatar.faceId < 0 || avatar.faceId >= 1000) avatar.faceId = 0;
    return avatar;
}

function _findNextRecord(buffer, off, rec) {
    const minNext = off + rec.floatOffset + (rec.recordBytes || 22);
    const maxNext = Math.min(buffer.byteLength, off + rec.floatOffset + 96);
    for (let next = minNext; next <= maxNext; next++) {
        if (_parseMovementRecord(buffer, next, false)) return next;
    }
    return null;
}

function _parsePlayersPacket(buffer) {
    const view = new DataView(buffer);
    if (_u32(view, 0) !== 1) return null;
    const expected = _u64(view, 4);
    if (expected == null) return null;
    const records = [];
    const seen = new Set();
    let off = 12;
    while (off + 32 < buffer.byteLength && records.length < 128 && (!expected || records.length < expected)) {
        const rec = _parseMovementRecord(buffer, off, false);
        if (!rec) {
            off += 1;
            continue;
        }
        if (!seen.has(rec.id)) {
            seen.add(rec.id);
            records.push(rec);
        }
        const next = _findNextRecord(buffer, off, rec);
        off = next == null ? off + 1 : next;
    }
    return records;
}

function _parseChatPacket(buffer) {
    const view = new DataView(buffer);
    if (_u32(view, 0) !== 2) return null;
    const playerId = _u64(view, 4);
    const nameLen = _u64(view, 12);
    if (playerId == null || !nameLen || nameLen > 64) return null;
    let off = 20;
    if (off + nameLen + 8 > buffer.byteLength) return null;
    const username = new TextDecoder().decode(new Uint8Array(buffer, off, nameLen));
    if (!_textOk(username)) return null;
    off += nameLen;
    const msgLen = _u64(view, off);
    if (!msgLen || msgLen > 512) return null;
    off += 8;
    if (off + msgLen > buffer.byteLength) return null;
    const message = new TextDecoder().decode(new Uint8Array(buffer, off, msgLen));
    if (!_textOk(message)) return null;
    return { playerId, username, message };
}

function _parseSystemPacket(buffer) {
    const view = new DataView(buffer);
    if (_u32(view, 0) !== 5) return null;
    const msgLen = _u64(view, 4);
    if (!msgLen || msgLen > 1024 || 12 + msgLen > buffer.byteLength) return null;
    const message = new TextDecoder().decode(new Uint8Array(buffer, 12, msgLen));
    return _textOk(message) ? { message } : null;
}

function _classifySystemMessage(message) {
    const text = String(message || "");
    if (/wait|slow down|too fast|rate limit|throttle/i.test(text)) {
        const wait = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second)/i)?.[1] || 0);
        return { type: "chat_throttled", wait: wait || "a moment" };
    }
    if (/blocked|filtered|not allowed|inappropriate|moderation/i.test(text)) {
        return { type: "chat_blocked", msg: text };
    }
    if (/kick|ban|disconnect|already playing|another window/i.test(text)) {
        return { type: "system_red", msg: text };
    }
    return { type: "system", msg: text };
}

function _writeU64(view, off, value) {
    view.setBigUint64(off, BigInt(Math.max(0, Math.floor(value || 0))), true);
}

function _safeBodyColors(value) {
    const input = Array.isArray(value) ? value : [];
    const out = [];
    for (let i = 0; i < 6; i++) {
        const color = String(input[i] || "#ffffff").trim();
        out.push(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "#ffffff");
    }
    return out;
}

function _packetColorInt(color) {
    const match = String(color || "").match(/^#?([0-9a-f]{6})$/i);
    return match ? parseInt(match[1], 16) : 0xffffff;
}

function _encodeMovementPacket(data) {
    const nameBytes = new TextEncoder().encode(launchInfo.username);
    const len = 4 + 8 + 8 + 8 + nameBytes.length + 1 + 16 + 2 + 4 + 41;
    const buffer = new ArrayBuffer(len);
    const view = new DataView(buffer);
    let off = 0;
    view.setUint32(off, 0, true); off += 4;
    _writeU64(view, off, launchInfo.id); off += 8;
    _writeU64(view, off, launchInfo.gameId); off += 8;
    _writeU64(view, off, nameBytes.length); off += 8;
    new Uint8Array(buffer, off, nameBytes.length).set(nameBytes); off += nameBytes.length;
    view.setUint8(off, 0); off += 1;
    view.setFloat32(off, Number(data.x || 0), true); off += 4;
    view.setFloat32(off, Number(data.y || 0), true); off += 4;
    view.setFloat32(off, Number(data.z || 0), true); off += 4;
    view.setFloat32(off, Number(data.ry || 0), true); off += 4;
    const anim = String(data.anim || "idle");
    view.setUint8(off, anim === "idle" ? 0 : 1); off += 1;
    view.setUint8(off, anim === "jump" ? 0 : 1); off += 1;
    animClock += 0.05;
    view.setFloat32(off, animClock, true); off += 4;
    const colors = _safeBodyColors(launchInfo.bodyColors);
    const bodyType = String(launchInfo.bodyType || "male").toLowerCase() === "female" ? 2 : 1;
    const faceId = Number(launchInfo.faceId || 0) || 0;
    view.setUint8(off, 1); off += 1;
    view.setUint32(off, faceId, true); off += 4;
    view.setUint8(off, bodyType); off += 1;
    view.setUint32(off, Number(launchInfo.pantId || 0) || 0, true); off += 4;
    view.setUint8(off, 0); off += 1;
    for (let i = 0; i < 6; i += 1) {
        view.setUint32(off, _packetColorInt(colors[i]), true);
        off += 4;
    }
    view.setUint8(off, bodyType); off += 1;
    view.setUint32(off, faceId, true); off += 4;
    view.setUint8(off, 0);
    return buffer;
}

function _encodeHeartbeat() {
    const token = String(launchInfo.clientToken || "").slice(0, 64);
    const bytes = new TextEncoder().encode(token);
    const buffer = new ArrayBuffer(12 + bytes.length);
    const view = new DataView(buffer);
    view.setUint32(0, 6, true);
    _writeU64(view, 4, bytes.length);
    new Uint8Array(buffer, 12, bytes.length).set(bytes);
    return buffer;
}

function _encodeChatPacket(msg) {
    const name = new TextEncoder().encode(launchInfo.username);
    const text = new TextEncoder().encode(String(msg || "").slice(0, 512));
    const buffer = new ArrayBuffer(4 + 8 + 8 + name.length + 8 + text.length + 1);
    const view = new DataView(buffer);
    let off = 0;
    view.setUint32(off, 2, true); off += 4;
    _writeU64(view, off, launchInfo.id); off += 8;
    _writeU64(view, off, name.length); off += 8;
    new Uint8Array(buffer, off, name.length).set(name); off += name.length;
    _writeU64(view, off, text.length); off += 8;
    new Uint8Array(buffer, off, text.length).set(text); off += text.length;
    view.setUint8(off, 0);
    return buffer;
}

function _handleNativePacket(buffer) {
    const players = _parsePlayersPacket(buffer);
    if (players) {
        const converted = players.filter(p => p.id !== myId).map(p => {
            const state = {
                id: p.id,
                username: p.name,
                is_staff: false,
                is_booster: false,
                x: p.x,
                y: p.y,
                z: p.z,
                ry: p.yaw,
                anim: p.state1 === 0 ? "jump" : p.state0 ? "walk" : "idle"
            };
            if (p.hasAvatar) {
                if (p.shirtId) state.shirt_id = p.shirtId;
                if (p.pantId) state.pant_id = p.pantId;
                if (p.bodyType) state.body_type = p.bodyType;
                if (Array.isArray(p.bodyColors) && p.bodyColors.length === 6) state.body_colors = p.bodyColors;
                if (p.faceId) state.face_id = p.faceId;
            }
            return state;
        });
        for (const p of converted) {
            if (!remotes.has(p.id)) handle({ type: "join", ...p });
        }
        handle({ type: "states", players: converted });
        return;
    }
    const chat = _parseChatPacket(buffer);
    if (chat) {
        handle({
            type: "chat",
            id: chat.playerId,
            username: chat.username,
            msg: chat.message,
            is_staff: false,
            is_owner: false,
            is_booster: false
        });
        return;
    }
    const notice = _parseSystemPacket(buffer);
    if (notice) {
        handle(_classifySystemMessage(notice.message));
    }
}

function bridgeSend(payload) {
    if (!bridgeOpen()) return false;
    if (!launchInfo) return false;
    if (hubMode) {
        ws.send(JSON.stringify(payload));
    } else if (payload.type === "state") {
        ws.send(_encodeMovementPacket(payload));
    } else if (payload.type === "chat") {
        ws.send(_encodeChatPacket(payload.msg));
    } else {
        return false;
    }
    return true;
}

async function connect() {
    if (connectFinished) return;
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
    if (connectPromise) return connectPromise;
    connectPromise = connectOnce().finally(() => {
        connectPromise = null;
    });
    return connectPromise;
}

async function connectOnce() {
    const cfg = getBridgeConfig();
    const localRelay = cfg.hubUrl && _isLocalRelayUrl(cfg.hubUrl);
    if (!cfg.launchToken) {
        Chat.system("Vortex2+2 multiplayer is offline: missing launch token.");
        return;
    }

    try {
        if (!launchInfo) {
            launchInfo = await verifyLaunchToken(cfg);
        }
    } catch (err) {
        Chat.system(`Vortex2+2 multiplayer auth failed: ${err.message || err}`);
        connectFinished = true;
        return;
    }

    if (cfg.hubUrl) {
        hubMode = true;
        const hubUrl = new URL(cfg.hubUrl);
        if (!hubUrl.pathname || hubUrl.pathname === "/") hubUrl.pathname = "/ws";
        hubUrl.searchParams.set("game", String(localRelay ? (cfg.officialGameId || window.GAME_ID || 0) : launchInfo.gameId));
        try { Chat.system(`Vortex2+2 connecting relay: ${hubUrl.host}`); } catch {}
        ws = new WebSocket(hubUrl.toString());

        ws.onopen = () => {
            try { Chat.system("Vortex2+2 relay connected."); } catch {}
            clearTimeout(ws._retry);
            _reconnectAttempts = 0;
            const hello = {
                type: "hello",
                id: launchInfo?.id || 0,
                username: launchInfo?.username || "",
                gameId: localRelay ? Number(cfg.officialGameId || window.GAME_ID || 0) : launchInfo.gameId,
                shirt_id: launchInfo?.shirtId || 0,
                pant_id: launchInfo?.pantId || 0,
                body_type: launchInfo?.bodyType || "male",
                body_colors: launchInfo?.bodyColors || [],
                face_id: launchInfo?.faceId || 0,
                is_staff: false,
                is_booster: false
            };
            if (localRelay) {
                hello.launchToken = cfg.launchToken;
                hello.clientToken = launchInfo?.clientToken || "";
                hello.appToken = launchInfo?.appToken || "";
            }
            ws.send(JSON.stringify(hello));
        };

        ws.onmessage = e => {
            try {
                handle(JSON.parse(e.data));
            } catch (err) {
                console.warn("[mp] bad hub message", err, e.data);
            }
        };

        ws.onclose = () => {
            stopBroadcast();
            if (!ws._kicked) {
                if (_reconnectAttempts >= _MAX_RECONNECTS) return;
                _reconnectAttempts++;
                ws._retry = setTimeout(connect, 3000);
            }
        };

        ws.onerror = () => {
            try { Chat.system("Vortex2+2 hub connection failed."); } catch {}
            ws.close();
        };

        connectFinished = true;
        return;
    }

    handle({
        type: "init",
        id: launchInfo.id,
        username: launchInfo.username,
        is_staff: false,
        is_booster: false,
        shirt_id: launchInfo.shirtId,
        pant_id: launchInfo.pantId,
        body_type: launchInfo.bodyType,
        body_colors: launchInfo.bodyColors,
        face_id: launchInfo.faceId,
        players: []
    });

    if (!launchInfo.wsEndpoint) {
        Chat.system("Vortex2+2 multiplayer is offline: set a browser multiplayer hub URL in the extension popup. The live app no longer exposes a browser WebSocket endpoint, and Chrome extensions cannot connect to UDP/raw TCP game sockets.");
        connectFinished = true;
        return;
    }

    ws = new WebSocket(launchInfo.wsEndpoint);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
        clearTimeout(ws._retry);
        _reconnectAttempts = 0;
        if (/^[a-fA-F0-9]{64}$/.test(String(launchInfo.clientToken || ""))) {
            ws.send(_encodeHeartbeat());
        }
    };

    ws.onmessage = e => {
        try {
            if (e.data instanceof ArrayBuffer) _handleNativePacket(e.data);
            else if (e.data instanceof Blob) e.data.arrayBuffer().then(_handleNativePacket);
            else handle(JSON.parse(e.data));
        } catch (err) {
            console.warn("[mp] bad multiplayer message", err, e.data);
        }
    };

    ws.onclose = () => {
        stopBroadcast();
        if (!ws._kicked) {
            if (_reconnectAttempts >= _MAX_RECONNECTS) return;
            _reconnectAttempts++;
            ws._retry = setTimeout(connect, 3000);
        }
    };

    ws.onerror = () => {
        try { Chat.system("Vortex2+2 multiplayer websocket connection failed."); } catch {}
        ws.close();
    }
    connectFinished = true;
}

let specialReplicatedNumber = 0
let blockChangeBuffer = [];
let myBlocks = [];
function saveBlocks() {
    let stringed = JSON.stringify(myBlocks);
    localStorage.setItem('blocks', stringed);
}
function loadBlocks() {
    let stringed = localStorage.getItem('blocks');
    if (stringed) {
        let savedBlokcs = JSON.parse(stringed);
        for (let i = 0; i < savedBlokcs.length; i++) {
            let b = savedBlokcs[i];
            let sp = b.split(',');
            _setBlockState(myId ? myId : -1, parseFloat(sp[0]), parseFloat(sp[1]), parseFloat(sp[2]), parseFloat(sp[3]))
        }
    }
}
let encodeFrame = 0;
function encodeNetworkData(data) {
    let ry = data.ry;
    encodeFrame++;
    if (window.SWORD_FIGHT) {
        let healthBits = Math.round(Math.min(Math.max(0, playerSpecialValues.health * 15), 15));
        let slicingBits = playerSpecialValues.slicing ? 16 : 0;

        let syncNormalData = 512;

        specialReplicatedNumber = healthBits + slicingBits + syncNormalData

        let ryBase = Math.round(data.ry * 100) / 100;
        ry = ryBase + (specialReplicatedNumber / 1024) * 0.01;
    } else if (window.BUILD_MODE) {
        if (blocks.size > 0 && encodeFrame % 4 == 0) {
            let a = null;
            let b = null;
            blocks.forEach(block => {
                if ((block.owner == myId || block.owner == -1) && (!a || block.last_sync < b.last_sync)) {
                    a = `block_${block.x}_${block.y}_${block.z}`;
                    b = block;
                }
            });
            if (b) {
                b.last_sync = encodeFrame;
                blocks.set(a, b);
                let anim = data.anim;
                blockChangeBuffer.splice(0, 1)
                return {
                    type: data.type,
                    x: b.y,
                    y: b.z,
                    z: b.state,
                    ry: b.x,
                    anim,
                };
            }

        } else if (blockChangeBuffer.length > 0 && encodeFrame % 4 < 3) {
            let bchange = blockChangeBuffer[0];

            let bx = bchange[0];
            let by = bchange[1];
            let bz = bchange[2];
            let bstate = bchange[3];
            let anim = data.anim;
            blockChangeBuffer.splice(0, 1)
            return {
                type: data.type,
                x: by,
                y: bz,
                z: bstate,
                ry: bx,
                anim,
            };
        }
        specialReplicatedNumber = 512

        let ryBase = Math.round(data.ry * 100) / 100;
        ry = ryBase + (specialReplicatedNumber / 1024) * 0.01;
    }

    let anim = data.anim;
    return {
        type: data.type,
        x: data.x,
        y: data.y,
        z: data.z,
        ry,
        anim,
    };
}


const blocks = new Map();
let canPlace = true;
function _setBlockState(userid, x, y, z, state) {
    if (!canPlace) return
    if (!validPlacement(x, y, z)) return
    let blockKeyName = `block_${x}_${y}_${z}`
    let changed = false;
    if (state == 0) {
        if (blocks.has(blockKeyName)) {
            let blockData = blocks.get(blockKeyName);
            if (blockData.owner == userid || blockData.owner == -1) {
                changed = true;
                removeStud(blockData.stud_id);
                blocks.delete(blockKeyName);
            }
        }
    } else if (!blocks.has(blockKeyName)) {
        changed = true;
        let [mesh, stud_id] = addStud(2, 2, 2, BLOCK_COLORS[state - 1], x, y - 1, z);
        blocks.set(blockKeyName, { owner: userid, stud_id: stud_id, last_sync: 0, x, y, z, state });
    } else {
        let blockData = blocks.get(blockKeyName);
        if (blockData.owner == userid || blockData.owner == -1) {
            if (blockData.state != state) {
                changed = true;
                removeStud(blockData.stud_id);
                let [mesh, stud_id] = addStud(2, 2, 2, BLOCK_COLORS[state - 1], x, y - 1, z);
                blocks.set(blockKeyName, { owner: userid, stud_id: stud_id, last_sync: 0, x, y, z, state });
            }
        }
    }
    if ((userid == myId || userid == -1) && changed) {
        if (state > 0) {
            myBlocks.push(`${x},${y},${z},${state}`);
        } else {
            for (let i = 0; i < myBlocks.length; i++) {
                if (myBlocks[i].startsWith(`${x},${y},${z}`)) {
                    myBlocks.splice(i, 1);
                    break;
                }
            }
        }
        saveBlocks();
        blockChangeBuffer.push([x, y, z, state]);
        blockCounter.innerText = myBlocks.length + '/' + MAX_BLOCKS;
        if (myBlocks.length >= MAX_BLOCKS) {
            blockCounter.style.color = 'rgb(255 0 0 / 90%)'
        } else {
            blockCounter.style.color = 'rgb(255 255 255 / 90%)'
        }
        if (canPlaySounds) {
            clickSound.currentTime = 0;
            clickSound.play();
        }
    }
}

let intv = setInterval(() => {
    if(typeof validPlacement!='undefined' && typeof blockCounter!='undefined'){
        clearInterval(intv);
        loadBlocks();
    }
}, 10);

function removeBlocks(userid) {
    blocks.forEach(b => {
        if (b.owner == userid) {
            removeStud(b.stud_id);
            blocks.delete(`block_${b.x}_${b.y}_${b.z}`);
        }
    });
}


const url = new URL(document.URL);
const gamei = url.searchParams.get("V22GameId");
function decodeNetworkData(playerData, r) {
    if (playerData.shirt_id !== undefined || playerData.pant_id !== undefined || playerData.body_colors !== undefined || playerData.face_id !== undefined) {
        const avatarPatch = {};
        if (playerData.shirt_id !== undefined && Number(playerData.shirt_id) > 0) avatarPatch.shirt_id = playerData.shirt_id;
        if (playerData.pant_id !== undefined && Number(playerData.pant_id) > 0) avatarPatch.pant_id = playerData.pant_id;
        if (playerData.body_type !== undefined) avatarPatch.body_type = playerData.body_type;
        if (Array.isArray(playerData.body_colors) && playerData.body_colors.length === 6) avatarPatch.body_colors = playerData.body_colors;
        if (playerData.face_id !== undefined && Number(playerData.face_id) > 0) avatarPatch.face_id = playerData.face_id;
        const nextAvatar = _normalizeAvatarFields({ ...(r.avatar || {}), ...avatarPatch });
        const prev = JSON.stringify(r.avatar || {});
        const next = JSON.stringify(nextAvatar);
        if (prev !== next) {
            r.avatar = nextAvatar;
            if (r.meshes) _vortex.applyAvatarToMeshes?.(r.meshes, nextAvatar);
        }
    }

    if (![playerData.x, playerData.y, playerData.z, playerData.ry].every(Number.isFinite)) {
        return;
    }

    let fractional = (playerData.ry * 100) % 1;
    let specialState = Math.round(fractional * 1024);

    if (window.SWORD_FIGHT) {
        let healthBits = (specialState >>> 0) & ((1 << 4) - 1);
        let slicingBits = (specialState >>> 4) & ((1 << 1) - 1);
        if (!customPlayerData[playerData.id]) {
            customPlayerData[playerData.id] = {
                health: 1,
                slicing: false,
            }
        }
        if (customPlayerData[playerData.id]) {
            customPlayerData[playerData.id].health = healthBits / 15;
            customPlayerData[playerData.id].slicing = (slicingBits > 0);
        } else {
            customPlayerData[playerData.id] = {
                health: healthBits / 15,
                slicing: (slicingBits > 0),
            }
        }


        let syncNormalData = (specialState & 512) !== 0;
        if (!gamei) {
            syncNormalData = true;
        }
        if (syncNormalData) {
            r.tPos.set(playerData.x, _nativeYToSceneY(playerData.y), playerData.z);
            r.tRy = Math.round(playerData.ry * 100) / 100;
            r.anim = playerData.anim;
            r.seen = performance.now();
            if (r.meshes && !r.meshes.grp.visible) {
                r.meshes.grp.position.copy(r.tPos);
                r.meshes.grp.rotation.y = playerData.ry;
                r.meshes.grp.visible = true;
            }
        }
    } else if (window.BUILD_MODE) {
        let syncNormalData = (specialState & 512) !== 0;
        if (!gamei) {
            syncNormalData = true;
        }
        if (syncNormalData) {
            r.tPos.set(playerData.x, _nativeYToSceneY(playerData.y), playerData.z);
            r.tRy = Math.round(playerData.ry * 100) / 100;
            r.anim = playerData.anim;
            r.seen = performance.now();
            if (r.meshes && !r.meshes.grp.visible) {
                r.meshes.grp.position.copy(r.tPos);
                r.meshes.grp.rotation.y = playerData.ry;
                r.meshes.grp.visible = true;
            }
        } else {
            let x_block = Math.round(playerData.ry);
            let y_block = Math.round(playerData.x);
            let z_block = Math.round(playerData.y);
            let state_block = Math.round(playerData.z);
            let fraction_1 = playerData.x - y_block;
            let fraction_2 = playerData.y - z_block;
            let fraction_3 = playerData.z - state_block;
            _setBlockState(playerData.id, x_block, y_block, z_block, state_block);
        }
    } else {
        r.tPos.set(playerData.x, _nativeYToSceneY(playerData.y), playerData.z);
        r.tRy = playerData.ry;
        r.anim = playerData.anim;
        r.seen = performance.now();
        if (r.meshes && !r.meshes.grp.visible) {
            r.meshes.grp.position.copy(r.tPos);
            r.meshes.grp.rotation.y = playerData.ry;
            r.meshes.grp.visible = true;
        }
    }

}

function handle(d) {
    switch (d.type) {

        case 'kicked': {
            ws._kicked = true;
            ws.close();
            window.location.href = '/';
            break;
        }

        case 'init': {
            myId = d.id;
            if (!launchInfo || launchInfo.localRelayPending) {
                launchInfo = {
                    id: d.id,
                    username: d.username,
                    gameId: d.game_id || d.gameId || Number(window.GAME_ID || 0),
                    shirtId: d.shirt_id || 0,
                    pantId: d.pant_id || 0,
                    bodyType: d.body_type || "male",
                    bodyColors: d.body_colors || [],
                    faceId: d.face_id || 0,
                    clientToken: "",
                    appToken: "",
                    raw: d
                };
            }
            Leaderboard.setMyId(myId);
            Leaderboard.addPlayer({ id: myId, username: d.username, is_staff: d.is_staff, is_booster: d.is_booster });
            const initialPlayers = Array.isArray(d.players) ? d.players : [];
            _vortex.prefetchAvatarImages?.([d, ...initialPlayers]);
            for (const p of initialPlayers) {
                addRemote(p.id, p.username, p.is_staff, p.is_booster, p);
                _showHealthBar(p.id)
            }
            _vortex.applyAvatar?.(d);
            _showHealthBar(myId);
            fetchFriendData();
            if (window.BUILD_MODE) {
                canPlace = true;
                if (document.readyState == 'complete') {
                    loadBlocks();
                } else {
                    document.onload = loadBlocks;
                }
            }
            startBroadcast();
            break;
        }

        case 'join': {
            if (d.id === myId) break;
            _vortex.prefetchAvatarImages?.(d);
            addRemote(d.id, d.username, d.is_staff, d.is_booster, d);
            _showHealthBar(d.id);
            Chat.systemPlayer(d.username, `${d.username} joined.`);
            break;
        }

        case 'leave': {
            Chat.systemPlayer(d.username, `${d.username} left.`);
            removeRemote(d.id);
            if (window.BUILD_MODE) removeBlocks(d.id)
            break;
        }

        case 'kickbroad': {
            Chat.clearPlayerMsg(d.username);
            Chat.systemRed(`${d.username} was kicked by ${d.by}.`);
            removeRemote(d.id);
            break;
        }

        case 'states': {
            const players = Array.isArray(d.players) ? d.players : [];
            _vortex.prefetchAvatarImages?.(players);
            for (const p of players) {
                if (p.id !== myId && !remotes.has(p.id)) {
                    addRemote(p.id, p.username, p.is_staff, p.is_booster, p);
                }
                const r = remotes.get(p.id);
                if (!r) continue;
                decodeNetworkData(p, r)
            }
            break;
        }

        case 'chat': {
            if (d.id !== myId && !remotes.has(d.id)) {
                addRemote(d.id, d.username, d.is_staff, d.is_booster, {});
            }
            Chat.message(d.username, d.msg, d.id === myId, d.is_staff, d.is_owner, d.is_booster);
            if (d.id === myId || remotes.has(d.id)) {
                _showBubble(d.id, d.msg);
            } else {
                const pending = _pendingBubbles.get(d.id) || [];
                pending.push(String(d.msg || ""));
                while (pending.length > MAX_BUBBLES) pending.shift();
                _pendingBubbles.set(d.id, pending);
            }
            break;
        }

        case "chat_muted": {
            Chat.system("You have been muted for " + d.minutes + " minutes by an administrator.");
            break;
        }

        case 'chat_throttled': {
            Chat.warn(`Please wait ${d.wait}s before sending another message.`);
            break;
        }

        case 'chat_blocked': {
            Chat.warn(d.msg);
            break;
        }

        case "system": {
            Chat.system(d.msg);
            break;
        }

        case "system_red": {
            Chat.systemRed(d.msg);
            break;
        }

        case "shirt_update": {
            _vortex.prefetchAvatarImages?.(d);
            const rp = remotes.get(d.id);
            if (rp?.meshes) {
                const avatar = _normalizeAvatarFields({ ...(rp.avatar || {}), ...d });
                rp.avatar = avatar;
                _vortex.applyAvatarToMeshes?.(rp.meshes, avatar);
            } else {
                const pending = _pendingAvatars.get(d.id);
                if (pending) pending.shirt_id = d.shirt_id;
            }
            break;
        }
        case "screen_open": {
            window.openScreen?.(d.screen_id, d.token);
            break;
        }

        case 'friend_request': {
            window.Notifications?.friendRequest(d.from_id, d.from_username);
            _incomingIds.add(d.from_id);
            Leaderboard.setFriendStatus(d.from_id, 'request_received');
            break;
        }

        case 'friend_request_cancelled': {
            window.Notifications?.friendRequestCancelled?.(d.from_id);
            _incomingIds.delete(d.from_id);
            Leaderboard.setFriendStatus(d.from_id, 'none');
            break;
        }

        case 'friend_accepted': {
            window.Notifications?.friendAccepted(d.by_username);
            _friendIds.add(d.by_id);
            _outgoingIds.delete(d.by_id);
            Leaderboard.setFriendStatus(d.by_id, 'friends');
            break;
        }

        case 'followed': {
            window.Notifications?.followed?.(d.by_username);
            break;
        }

        case 'unfollowed': {
            window.Notifications?.unfollowed?.(d.by_username);
            break;
        }
    }
}

window._mpSetFriendStatus = function (id, status) {
    if (status === 'friends') { _friendIds.add(id); _incomingIds.delete(id); _outgoingIds.delete(id); }
    else if (status === 'request_sent') { _outgoingIds.add(id); }
    else if (status === 'none') { _friendIds.delete(id); _incomingIds.delete(id); _outgoingIds.delete(id); }
    Leaderboard.setFriendStatus(id, status);
};

function addRemote(id, username, is_staff, is_booster, avatarData) {
    if (remotes.has(id)) {
        const r = remotes.get(id);
        r.username = username || r.username;
        r.is_staff = is_staff ?? r.is_staff;
        r.is_booster = is_booster ?? r.is_booster;
        decodeNetworkData(avatarData || {}, r);
        return;
    }
    const avatar = _normalizeAvatarFields(avatarData);
    let meshes = null;
    if (_vortex.getCharacter()) { try { meshes = makeRemote(username, id, avatar); } catch (e) { console.error('[mp] makeRemote failed:', e); } }
    if (!meshes) _pendingAvatars.set(id, { username, is_staff, is_booster, ...avatar });

    remotes.set(id, {
        meshes,
        tPos: new THREE.Vector3(0, -999, 0),
        tRy: 0,
        anim: 'idle',
        animTime: 0,
        seen: performance.now(),
        id: id,
        username,
        is_staff,
        is_booster,
        avatar,
    });
    Leaderboard.addPlayer({ id, username, is_staff, is_booster });
    Leaderboard.setFriendStatus(id, _statusFor(id));
    if (!avatar.shirt_id) hydrateRemoteShirt(id);

    const pendingBubbles = _pendingBubbles.get(id);
    if (pendingBubbles?.length) {
        for (const msg of pendingBubbles) _showBubble(id, msg);
        _pendingBubbles.delete(id);
    }
}

const _remoteShirtCache = new Map();
const _remoteShirtInflight = new Set();

async function hydrateRemoteShirt(id) {
    id = Number(id || 0);
    if (!id || id === myId) return;
    if (_remoteShirtCache.has(id)) {
        applyRemoteShirt(id, _remoteShirtCache.get(id));
        return;
    }
    if (_remoteShirtInflight.has(id)) return;
    _remoteShirtInflight.add(id);
    try {
        const res = await fetch(`/api/users/${id}`, { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const shirtId = extractProfileShirtId(data);
        _remoteShirtCache.set(id, shirtId || 0);
        if (shirtId) applyRemoteShirt(id, shirtId);
    } catch (e) {
    } finally {
        _remoteShirtInflight.delete(id);
    }
}

function extractProfileShirtId(data) {
    const preferred = [
        data?.shirt_id,
        data?.shirtId,
        data?.clothing_id,
        data?.clothingId,
        data?.equipped_shirt_id,
        data?.equippedShirtId,
        data?.avatar?.shirt_id,
        data?.avatar?.shirtId,
        data?.shirt?.id,
        data?.clothing?.id,
    ];
    for (const value of preferred) {
        const id = Number(value || 0);
        if (Number.isInteger(id) && id > 0) return id;
    }

    const seen = new Set();
    const stack = [data];
    while (stack.length) {
        const item = stack.pop();
        if (!item || typeof item !== 'object' || seen.has(item)) continue;
        seen.add(item);
        for (const [key, value] of Object.entries(item)) {
            if (value && typeof value === 'object') {
                stack.push(value);
                continue;
            }
            if (!/(shirt|clothing)/i.test(key)) continue;
            const id = Number(value || 0);
            if (Number.isInteger(id) && id > 0 && id < 100000) return id;
        }
    }
    return 0;
}

function applyRemoteShirt(id, shirtId) {
    const avatar = _normalizeAvatarFields({ ...(remotes.get(id)?.avatar || {}), shirt_id: shirtId || 0 });
    const rp = remotes.get(id);
    if (rp?.meshes) {
        rp.avatar = avatar;
        _vortex.applyAvatarToMeshes?.(rp.meshes, avatar);
    } else {
        const pending = _pendingAvatars.get(id);
        if (pending) pending.shirt_id = shirtId || 0;
    }
}

function removeRemote(id) {
    const r = remotes.get(id);
    if (!r) return;
    const bub = _bubbles.get(id);
    if (bub) {
        for (const m of bub.msgs) clearTimeout(m.timer);
        if (bub.sprite) { _vortex.scene.remove(bub.sprite); bub.sprite.material.map?.dispose(); bub.sprite.material.dispose(); }
        _bubbles.delete(id);
    }
    const hbar = _healthbars.get(id);
    if (hbar) {
        _vortex.scene.remove(hbar.sprite);
        _healthbars.delete(id)
    }
    const sword = swords.get(id);
    if (sword) {
        _vortex.scene.remove(sword)
        swords.delete(id)
    }
    disposeRemote(r.meshes);
    _pendingAvatars.delete(id);
    _pendingBubbles.delete(id);
    remotes.delete(id);
    Leaderboard.removePlayer(id);
}

function startBroadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setInterval(() => {
        if (!bridgeOpen()) return;
        const char = _vortex.getCharacter();
        if (!char) return;

        const k = _vortex.keys;
        const mv = k['KeyW'] || k['KeyS'] || k['KeyA'] || k['KeyD'] ||
            k['ArrowUp'] || k['ArrowDown'] || k['ArrowLeft'] || k['ArrowRight'];
        const cl = _vortex.getClimbState();
        const gr = _vortex.getGrounded();
        const anim = cl !== 'none' ? 'climb' : !gr ? 'jump' : mv ? 'walk' : 'idle';

        let ry = char.rotation.y % (2 * Math.PI);
        if (ry > Math.PI) ry -= 2 * Math.PI;
        else if (ry < -Math.PI) ry += 2 * Math.PI;
        let dataToEncode = {
            type: 'state',
            x: char.position.x,
            y: _sceneYToNativeY(char.position.y),
            z: char.position.z,
            ry: ry,
            anim: anim,
        }
        let encoded = encodeNetworkData(dataToEncode);
        bridgeSend(encoded);
    }, 50);
}

function stopBroadcast() {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
}

const LERP = 12;

window._mpUpdate = function (dt) {
    if (_pendingAvatars.size > 0 && _vortex.getCharacter()) {
        for (const [id, info] of _pendingAvatars) {
            const r = remotes.get(id);
            if (r && !r.meshes) {
                try {
                    r.avatar = _normalizeAvatarFields(info);
                    r.meshes = makeRemote(info.username, id, r.avatar);
                } catch (e) {
                    console.error('[mp] makeRemote failed:', e);
                }

                if (r.meshes) r.meshes.grp.visible = false;
                const pendingBubbles = _pendingBubbles.get(id);
                if (pendingBubbles?.length) {
                    for (const msg of pendingBubbles) _showBubble(id, msg);
                    _pendingBubbles.delete(id);
                }
            }
        }
        _pendingAvatars.clear();
    }

    const now = performance.now();
    const cam = _vortex.getCamera?.();
    const camPos = cam ? cam.position : null;

    for (const [key, r] of remotes) {
        if (!r.meshes) continue;

        const g = r.meshes.grp;
        if (now - r.seen > 5000) { g.visible = false; continue; }

        g.position.lerp(r.tPos, Math.min(1, LERP * dt));

        let dy = r.tRy - g.rotation.y;
        dy = ((dy % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        g.rotation.y += dy * Math.min(1, LERP * dt);
        if (g.rotation.y > Math.PI) g.rotation.y -= 2 * Math.PI;
        else if (g.rotation.y < -Math.PI) g.rotation.y += 2 * Math.PI;

        if (camPos) {
            _animateRemote(key, r, dt);
        }
    }

    _updateBubblePositions();
};

window._mpSendChat = function (msg) {
    bridgeSend({ type: 'chat', msg });
}

window._mpRebuildAvatars = function () {
    for (const [id, r] of remotes) {
        const old = r.meshes;
        const visible = old?.grp?.visible;
        const pos = old?.grp?.position?.clone();
        const ry = old?.grp?.rotation?.y;
        disposeRemote(old);
        r.meshes = null;
        try {
            r.meshes = makeRemote(r.username || String(id), id, r.avatar || {});
            if (r.meshes) {
                if (pos) r.meshes.grp.position.copy(pos);
                if (Number.isFinite(ry)) r.meshes.grp.rotation.y = ry;
                r.meshes.grp.visible = !!visible;
            }
        } catch (e) {
            console.error("[mp] avatar rebuild failed:", e);
        }
    }
};

window.addEventListener("v22-character-renderer-changed", () => {
    window._mpRebuildAvatars?.();
});

window.VortexAvatar = {
    get renderer() {
        return _vortex.getAvatarRenderer?.() || "legacy";
    },
    setRenderer(mode) {
        const next = _vortex.setAvatarRenderer?.(mode);
        return next;
    },
    getOutfit() {
        return _vortex.getAvatar?.();
    },
    async setOutfit(outfit, persist = true) {
        const normalized = _normalizeAvatarFields(outfit);
        if (persist) {
            const res = await fetch("/api/clothing/outfit", {
                method: "PUT",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    shirt_id: normalized.shirt_id,
                    pant_id: normalized.pant_id,
                    body_type: normalized.body_type,
                    body_colors: normalized.body_colors,
                    face_id: normalized.face_id
                })
            });
            if (!res.ok) throw new Error(`outfit update failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
        }
        if (launchInfo) {
            launchInfo.shirtId = normalized.shirt_id;
            launchInfo.pantId = normalized.pant_id;
            launchInfo.bodyType = normalized.body_type;
            launchInfo.bodyColors = normalized.body_colors;
            launchInfo.faceId = normalized.face_id;
        }
        await _vortex.applyAvatar?.(normalized);
        return normalized;
    }
};

window._mpCreateDummy = function (x, y, z, shirtUrl, ry = 0) {
    const char = _clonePlayerFBX();
    if (!char) return
    char.position.set(x, y, z);
    char.rotation.y = ry;
    char.visible = true;
    const sm = _vortex.buildShirtOverlay(char);
    if (sm && shirtUrl) _vortex.applyShirtToMesh(sm, shirtUrl);
    return char;
};

connect();
