//Made by Inuk
const COLORS = ['#1a1a1a', '#2563EB', '#16A34A', '#9333EA', '#D97706', '#DC2626', '#0891B2'];
function avatarColor(u) {
    let h = 0;
    for (const c of u) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
    return parseInt(COLORS[h % COLORS.length].slice(1), 16);
}

function _isBone(n) { return n.isBone || n.type === 'Bone'; }

function _clonePlayerFBX() {
    const src = _vortex.getCharacter();
    if (!src) return null;

    const clone = src.clone(true);

    const srcBones = {}, cloneBones = {};
    src.traverse(n => { if (_isBone(n)) srcBones[n.name] = n; });
    clone.traverse(n => { if (_isBone(n)) cloneBones[n.name] = n; });

    const srcMeshes = [], cloneMeshes = [];
    src.traverse(m => { if (m.isSkinnedMesh) srcMeshes.push(m); });
    clone.traverse(m => { if (m.isSkinnedMesh) cloneMeshes.push(m); });
    srcMeshes.forEach((srcM, i) => {
        const cloneM = cloneMeshes[i];
        if (!cloneM) return;
        const newBones = srcM.skeleton.bones.map(b => cloneBones[b.name] || b);
        cloneM.skeleton = new THREE.Skeleton(newBones, srcM.skeleton.boneInverses.map(m => m.clone()));
        cloneM.bind(cloneM.skeleton, srcM.bindMatrix.clone());
    });

    const rest = _vortex.getAnimRest();
    clone.traverse(n => {
        if (!_isBone(n) || !rest[n.name]) return;
        const r = rest[n.name];
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

function makeRemote(username) {
    const clone = _clonePlayerFBX();
    if (!clone) return null;

    const fo = _vortex.getCharFootOffset();
    const ch = _vortex.getCharHeight();
    const spr = _makeNameLabel(username);
    spr.position.y = ch - fo + 1.4;
    clone.add(spr);

    const bones = {};
    clone.traverse(n => { if (_isBone(n)) bones[n.name] = n; });
    const rest = _vortex.getAnimRest();

    return { grp: clone, bones, rest };
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

function _animateRemote(r, dt) {
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
}

const BUBBLE_WORLD_W = 3.2;
const BUBBLE_CANVAS_W = 400;
const BUBBLE_SCALE = BUBBLE_WORLD_W / BUBBLE_CANVAS_W;
const BUBBLE_DURATION = 15000;
const MAX_BUBBLES = 3;
const _bubbles = new Map();

const B_PAD = 18;
const B_R = 12;
const B_FONT = '30px system-ui,sans-serif';
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

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
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

        ctx.fillStyle = '#111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], CW / 2, y + B_PAD + j * B_LINE);
        }

        y += bodyH + (isBot ? B_TRI : B_GAP);
    }

    if (!b.sprite) {
        b.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
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

function _updateBubblePositions() {
    const bubbleBase = _vortex.getCharHeight() - _vortex.getCharFootOffset() + 0.4;

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
}

const remotes = new Map();
let myId = null;
let ws = null;
let broadcastTimer = null;

const _pendingAvatars = new Map();

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

async function connect() {
    const res = await fetch(`/api/ws-ticket?game_id=${window.GAME_ID || 0}&fingerprint=${encodeURIComponent(window._fingerprint || '')}`).then(r => r.ok ? r.json() : null);
    if (!res) { setTimeout(connect, 4000); return; }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/game?ticket=${res.ticket}`);

    ws.onopen = () => {
        clearTimeout(ws._retry);
        _reconnectAttempts = 0;
        startBroadcast();
    };

    ws.onmessage = e => handle(JSON.parse(e.data));

    ws.onclose = () => {
        stopBroadcast();
        if (!ws._kicked) {
            if (_reconnectAttempts >= _MAX_RECONNECTS) return;
            _reconnectAttempts++;
            ws._retry = setTimeout(connect, 3000);
        }
    };

    ws.onerror = () => ws.close();
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
            Leaderboard.setMyId(myId);
            Leaderboard.addPlayer({ id: myId, username: d.username, is_staff: d.is_staff, is_booster: d.is_booster });
            for (const p of d.players) addRemote(p.id, p.username, p.is_staff, p.is_booster);
            fetchFriendData();
            break;
        }

        case 'join': {
            if (d.id === myId) break;
            addRemote(d.id, d.username, d.is_staff, d.is_booster);
            Chat.systemPlayer(d.username, `${d.username} joined.`, false);
            break;
        }

        case 'leave': {
            Chat.systemPlayer(d.username, `${d.username} left.`, false);
            removeRemote(d.id);
            break;
        }

        case 'kick_log': {
            Chat.clearPlayerMsg(d.username);
            Chat.systemRed(`${d.username} was kicked by ${d.by}.`);
            removeRemote(d.id);
            break;
        }

        case 'states': {
            for (const p of d.players) {
                const r = remotes.get(p.id);
                if (!r) continue;
                r.tPos.set(p.x, p.y, p.z);
                r.tRy = p.ry;
                r.anim = p.anim;
                r.seen = performance.now();
                if (r.meshes && !r.meshes.grp.visible) {
                    r.meshes.grp.position.copy(r.tPos);
                    r.meshes.grp.rotation.y = p.ry;
                    r.meshes.grp.visible = true;
                }
            }
            break;
        }

        case 'chat': {
            Chat.message(d.username, d.msg, d.id === myId, d.is_staff, d.is_owner, d.is_booster);
            _showBubble(d.id, d.msg);
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

function addRemote(id, username, is_staff, is_booster) {
    if (remotes.has(id)) return;

    let meshes = null;
    if (_vortex.getCharacter()) { try { meshes = makeRemote(username); } catch (e) { console.error('[mp] makeRemote failed:', e); } }
    if (!meshes) _pendingAvatars.set(id, { username, is_staff, is_booster });

    remotes.set(id, {
        meshes,
        tPos: new THREE.Vector3(0, -999, 0),
        tRy: 0,
        anim: 'idle',
        animTime: 0,
        seen: performance.now(),
    });
    Leaderboard.addPlayer({ id, username, is_staff, is_booster });
    Leaderboard.setFriendStatus(id, _statusFor(id));
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
    disposeRemote(r.meshes);
    _pendingAvatars.delete(id);
    remotes.delete(id);
    Leaderboard.removePlayer(id);
}

function startBroadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
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
        ws.send(JSON.stringify({
            type: 'state',
            x: char.position.x,
            y: char.position.y,
            z: char.position.z,
            ry,
            anim,
        }));
    }, 50);
}

function stopBroadcast() {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
}

const LERP = 12;
const ANIM_DIST_SQ = 80 * 80;

window._mpUpdate = function (dt) {
    if (_pendingAvatars.size > 0 && _vortex.getCharacter()) {
        for (const [id, info] of _pendingAvatars) {
            const r = remotes.get(id);
            if (r && !r.meshes) {
                try { r.meshes = makeRemote(info.username); } catch (e) { console.error('[mp] makeRemote failed:', e); }
                if (r.meshes) r.meshes.grp.visible = false;
            }
        }
        _pendingAvatars.clear();
    }

    const now = performance.now();
    const cam = _vortex.getCamera?.();
    const camPos = cam ? cam.position : null;

    for (const [, r] of remotes) {
        if (!r.meshes) continue;

        const g = r.meshes.grp;
        if (now - r.seen > 5000) { g.visible = false; continue; }

        g.position.lerp(r.tPos, Math.min(1, LERP * dt));

        let dy = r.tRy - g.rotation.y;
        dy = ((dy % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        g.rotation.y += dy * Math.min(1, LERP * dt);
        if (g.rotation.y > Math.PI) g.rotation.y -= 2 * Math.PI;
        else if (g.rotation.y < -Math.PI) g.rotation.y += 2 * Math.PI;

        if (!camPos || g.position.distanceToSquared(camPos) < ANIM_DIST_SQ) {
            _animateRemote(r, dt);
        }
    }

    _updateBubblePositions();
};

window._mpSendChat = function (msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'chat', msg }));
};