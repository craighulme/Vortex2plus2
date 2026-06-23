const extensionApi = globalThis.chrome || globalThis.browser;
const initialUrl = new URL(document.URL);
const isPlayRuntimePage = initialUrl.searchParams.has("Play");
if (isPlayRuntimePage) {
    window.stop();
}

const importedAssets = {
    stud: extensionApi.runtime.getURL("img/textures/stud.png"),
    studNormal: extensionApi.runtime.getURL("img/textures/studNormal.png"),

    swordMdl: extensionApi.runtime.getURL("files/meshes/swordMdl.fbx"),
    playerMdl: extensionApi.runtime.getURL("files/meshes/player.fbx"),
    malePlayerGlb: extensionApi.runtime.getURL("files/meshes/male.glb"),
    femalePlayerGlb: extensionApi.runtime.getURL("files/meshes/female.glb"),

    swordSlash: extensionApi.runtime.getURL("files/sounds/swordSlash.mp3"),
    placeBlock: extensionApi.runtime.getURL("files/sounds/placeBlock.mp3"),
    sfothSong: extensionApi.runtime.getURL("files/sounds/sfothSong.mp3"),
    buildSong: extensionApi.runtime.getURL("files/sounds/buildSong.mp3"),

    oofSound: extensionApi.runtime.getURL("files/sounds/oof.mp3"),

    imgdata: {
        banners: {
            buildingplace: extensionApi.runtime.getURL("img/games/website/banners/buildingplace.jpeg"),
            crossroads: extensionApi.runtime.getURL("img/games/website/banners/crossroads.jpeg"),
            partyexe: extensionApi.runtime.getURL("img/games/website/banners/party-exe.webp"),
            sfoth: extensionApi.runtime.getURL("img/games/website/banners/sfoth.webp"),
            swordfightingbaseplate: extensionApi.runtime.getURL("img/games/website/banners/swordfightingbaseplate.png"),
            baseplate: extensionApi.runtime.getURL("img/games/website/banners/baseplate.png"),
            Glasshouses: extensionApi.runtime.getURL("img/games/website/banners/Glasshouses.webp"),
            NDS: extensionApi.runtime.getURL("img/games/website/banners/NDS.png")
        },

        icons: {
            buildingplace: extensionApi.runtime.getURL("img/games/website/icons/buildingplace.png"),
            crossroads: extensionApi.runtime.getURL("img/games/website/icons/crossroads.png"),
            partyexe: extensionApi.runtime.getURL("img/games/website/icons/party-exe.png"),
            sfoth: extensionApi.runtime.getURL("img/games/website/icons/sfoth.webp"),
            swordfightingbaseplate: extensionApi.runtime.getURL("img/games/website/icons/swordfightingbaseplate.png"),
            baseplate: extensionApi.runtime.getURL("img/games/website/icons/baseplate.png"),
            Glasshouses: extensionApi.runtime.getURL("img/games/website/icons/Glasshouses.webp"),
            NDS: extensionApi.runtime.getURL("img/games/website/icons/NDS.png")
        }
    },
    mapdata: {
        PARTYexe: extensionApi.runtime.getURL("files/mapdata/PARTY-exe.json"),
        BuildingPlace: extensionApi.runtime.getURL("files/mapdata/BuildingPlace.json"),
        Crossroads: extensionApi.runtime.getURL("files/mapdata/Crossroads.json"),
        SFBaseplate: extensionApi.runtime.getURL("files/mapdata/SFBaseplate.json"),
        SFOTH: extensionApi.runtime.getURL("files/mapdata/SFOTH.json"),
        Baseplate: extensionApi.runtime.getURL("files/mapdata/Baseplate.json"),
        Glasshouses: extensionApi.runtime.getURL("files/mapdata/Glasshouses.json"),
        NDS: extensionApi.runtime.getURL("files/mapdata/NDS.json")
    }
};

const overrides = new Map([
    ["boot.iife.js", "overrides/v22-runtime/boot.iife.js"],

    ["three.min.js", "overrides/libs/three.module.js"],
    ["FBXLoader.js", "overrides/libs/FBXLoader.js"],
    ["GLTFLoader.js", "overrides/libs/GLTFLoader.js"],
    ["inflate.min.js", "overrides/libs/inflate.min.js"],

    ["inline_1.js", "overrides/inline_1.js"],

    ["notifications.js", "overrides/notifications.js"],
    ["leaderboard.js", "overrides/leaderboard.js"],
    ["chat.js", "overrides/chat.js"],
    ["avatar.js", "overrides/avatar.js"],
    ["parts.js", "overrides/demoparts.js"],
    ["social.js", "overrides/social.js"],

    ["vortex-engine.js", "overrides/vortex2+2-engine.js"],
    ["multiplayer.js", "overrides/vortex2+2-multiplayer.js"]
]);

let v22LaunchConfig = null;
const v22BrokerSockets = new Map();

function sameRelayPath(left, right) {
    try {
        const a = new URL(left);
        const b = new URL(right);
        const ap = a.pathname && a.pathname !== "/" ? a.pathname : "/ws";
        const bp = b.pathname && b.pathname !== "/" ? b.pathname : "/ws";
        return a.protocol === b.protocol && a.host === b.host && ap === bp;
    } catch {
        return false;
    }
}

function brokerPost(socketId, op, payload = {}) {
    window.postMessage({
        v22Broker: true,
        direction: "extension",
        socketId,
        op,
        ...payload
    }, location.origin);
}

function brokerSend(ws, message) {
    let outbound = message;
    try {
        const parsed = typeof message === "string" ? JSON.parse(message) : null;
        if (parsed?.type === "hello") {
            parsed.launchToken = v22LaunchConfig?.token || "";
            parsed.licenseLease = v22LaunchConfig?.identity?.licenseLease ||
                v22LaunchConfig?.identity?.license_lease ||
                v22LaunchConfig?.identity?.lease ||
                null;
            outbound = JSON.stringify(parsed);
        }
    } catch {}
    ws.send(outbound);
}

function pageSafeIdentity(identity) {
    if (!identity || typeof identity !== "object") return null;
    const out = { ...identity };
    const lease = out.licenseLease || out.license_lease || out.lease || null;
    if (Array.isArray(lease?.allowed_features)) out.licenseFeatures = [...lease.allowed_features];
    delete out.licenseLease;
    delete out.license_lease;
    delete out.lease;
    delete out.clientToken;
    delete out.client_token;
    delete out.appToken;
    delete out.app_token;
    return out;
}

window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg?.v22Broker || msg.direction !== "page") return;
    const socketId = String(msg.socketId || "");
    if (!socketId) return;

    if (msg.op === "connect") {
        if (!v22LaunchConfig?.token || !sameRelayPath(msg.url, v22LaunchConfig.hubUrl)) {
            brokerPost(socketId, "error", { message: "blocked relay connection" });
            brokerPost(socketId, "close", { code: 1008, reason: "blocked relay connection", wasClean: false });
            return;
        }
        try {
            const ws = new WebSocket(String(msg.url));
            v22BrokerSockets.set(socketId, ws);
            ws.onopen = () => brokerPost(socketId, "open");
            ws.onmessage = (e) => brokerPost(socketId, "message", { data: e.data });
            ws.onerror = () => brokerPost(socketId, "error", { message: "relay websocket error" });
            ws.onclose = (e) => {
                v22BrokerSockets.delete(socketId);
                brokerPost(socketId, "close", { code: e.code, reason: e.reason, wasClean: e.wasClean });
            };
        } catch (err) {
            brokerPost(socketId, "error", { message: String(err && err.message || err) });
            brokerPost(socketId, "close", { code: 1006, reason: "connect failed", wasClean: false });
        }
        return;
    }

    const ws = v22BrokerSockets.get(socketId);
    if (!ws) return;
    if (msg.op === "send" && ws.readyState === WebSocket.OPEN) {
        brokerSend(ws, msg.data);
    } else if (msg.op === "close") {
        try { ws.close(); } catch {}
        v22BrokerSockets.delete(socketId);
    }
});

function runtimeUrl(path) {
    return extensionApi.runtime.getURL(path);
}

function replaceUrl(src) {
    if (!src) return null;
    const file = src.split("/").pop();
    const target = overrides.get(file);
    if (!target) return src;
    return runtimeUrl(target);
}

function appendMeta(id, content) {
    const meta = document.createElement("meta");
    meta.id = id;
    meta.name = id;
    meta.content = JSON.stringify(content);
    document.documentElement.appendChild(meta);
}

async function readLaunchConfig(launchId) {
    if (!launchId) return null;
    const key = `v22Launch:${launchId}`;
    const maxAgeMs = 5 * 60 * 1000;
    if (extensionApi?.runtime?.sendMessage) {
        try {
            const res = await extensionApi.runtime.sendMessage({ type: "v22:takeLaunchConfig", launchId });
            if (res?.ok && res.config) return res.config;
        } catch {}
    }
    try {
        const raw = sessionStorage.getItem(key);
        sessionStorage.removeItem(key);
        const cfg = raw ? JSON.parse(raw) : null;
        if (!cfg?.createdAt || Date.now() - Number(cfg.createdAt) <= maxAgeMs) return cfg;
    } catch {
    }
    return null;
}

function stripLaunchParams() {
    const clean = new URL(location.href);
    clean.searchParams.delete("V22Launch");
    clean.searchParams.delete("V22Token");
    clean.searchParams.delete("V22Hub");
    history.replaceState(history.state, document.title, clean.toString());
}

async function rewritePlayDocument(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const launchConfig = await readLaunchConfig(url.searchParams.get("V22Launch"));
    v22LaunchConfig = launchConfig;
    const launchToken = launchConfig?.token || "";
    const hubUrl = launchConfig?.hubUrl || "";
    const identity = launchConfig?.identity || null;
    stripLaunchParams();

    for (const link of parsed.querySelectorAll("link[href]")) {
        const file = link.getAttribute("href").split("/").pop();
        if (file === "styles.css") link.href = runtimeUrl("overrides/styles.css");
        if (file === "favicon.ico") link.href = "/favicon.ico";
    }

    const scripts = [];
    for (const oldScript of parsed.querySelectorAll("script[src]")) {
        scripts.push({
            src: replaceUrl(oldScript.getAttribute("src")),
            type: oldScript.getAttribute("type") || ""
        });
        oldScript.remove();
    }

    document.documentElement.replaceWith(document.importNode(parsed.documentElement, true));

    appendMeta("_importedAssets", importedAssets);
    appendMeta("_vortexBridgeConfig", {
        officialGameId: Number(url.searchParams.get("VortexGameId") || 0),
        customGameId: url.searchParams.get("V22GameId"),
        launchToken: launchConfig?.brokered === false ? launchToken : "",
        hubUrl,
        brokered: Boolean(launchConfig && launchConfig.brokered !== false),
        identity: pageSafeIdentity(identity)
    });

    for (const scriptInfo of scripts) {
        const script = document.createElement("script");
        script.src = scriptInfo.src;
        if (scriptInfo.type) script.type = scriptInfo.type;
        document.body.appendChild(script);
    }
}

var url_string = document.URL;
var url = new URL(url_string);
var play = url.searchParams.get("Play");
if (play) {
    async function init() {
        let html = await fetch(
            runtimeUrl("overrides/play.html")
        ).then(r => r.text());
        await rewritePlayDocument(html);
    }
    init().catch(err => {
        console.error("[Vortex Web] play loader failed", err);
        document.body.innerHTML = `<pre style="padding:16px;color:#fff;background:#111;white-space:pre-wrap">Vortex Web failed to load:\n${String(err && err.stack || err)}</pre>`;
    });
} else {
    if (url.searchParams.get("V22GameId")) {
        const warn = document.createElement('div');
        warn.innerHTML = `
            <h2>vortex2+2 warning</h2>
            <br>
            <p>vortex2+2 multiplayer does not work anymore,breaking lots of things,<br>and there's nothing I can currently do about it.<br>the old vortex Websocket server that 2+2 used for multiplayer have been removed,<br>and I don't think it'll ever come back again.</p>
            <br>
            <br>
        `;
        warn.style = `
            position: absolute;
            left: 0;
            width: 100%;
            top: 0;
            height: 100%;
            background-color: rgba(0.1,0.1,0.1,0.8);
            align-content: center;
            text-align: center;
            padding: 20px;
            border: solid 5px black;
            backdrop-filter: blur(3px);
            z-index: 10;
        `
        const closebtn = document.createElement('button');
        closebtn.style = `
            padding: 10px;
            background-color: rgb(255,100,100) !important;
        `;
        closebtn.innerHTML = 'close';
        warn.appendChild(closebtn);
        closebtn.onclick = function () {
            warn.remove();
        }
        var observer = new MutationObserver(function () {
            if (document.body) {
                document.body.appendChild(warn);
                observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
    const meta = document.createElement("meta");
    meta.id = "_importedAssets";
    meta.name = "_importedAssets";
    meta.content = JSON.stringify(importedAssets);
    document.documentElement.appendChild(meta)
}
