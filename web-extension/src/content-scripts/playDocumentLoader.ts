type LaunchConfig = {
    token?: string;
    hubUrl?: string;
    devLocalRelay?: boolean;
    devFeatures?: boolean;
    brokered?: boolean;
    createdAt?: number | string;
    identity?: Record<string, unknown> | null;
};

type BrokerPayload = {
    vwebBroker?: boolean;
    direction?: string;
    socketId?: unknown;
    op?: string;
    url?: unknown;
    data?: string;
};

type ScriptInfo = {
    src: string;
    type: string;
};

declare global {
    interface Window {
        VortexWebCosmetics?: {
            API_BASE?: string;
            load?(): Promise<unknown>;
        };
    }
}

const runtimeApi = requireRuntimeApi();

function requireRuntimeApi(): RuntimeApi {
    const extensionApi = (globalThis as typeof globalThis & { chrome?: MinimalExtensionApi; browser?: MinimalExtensionApi }).chrome
        || (globalThis as typeof globalThis & { chrome?: MinimalExtensionApi; browser?: MinimalExtensionApi }).browser;
    if (!extensionApi?.runtime?.getURL) throw new Error("extension runtime API is unavailable");
    return extensionApi.runtime;
}

const importedAssets = {
    stud: runtimeApi.getURL("img/textures/stud.png"),
    studNormal: runtimeApi.getURL("img/textures/studNormal.png"),

    malePlayerGlb: runtimeApi.getURL("runtime/assets/avatar/male.glb"),
    femalePlayerGlb: runtimeApi.getURL("runtime/assets/avatar/female.glb"),

    oofSound: runtimeApi.getURL("runtime/assets/audio/oof.mp3"),

    imgdata: {
        banners: {
            crossroads: runtimeApi.getURL("img/games/website/banners/crossroads.jpeg"),
            partyexe: runtimeApi.getURL("img/games/website/banners/party-exe.webp"),
            baseplate: runtimeApi.getURL("img/games/website/banners/baseplate.png"),
            Glasshouses: runtimeApi.getURL("img/games/website/banners/Glasshouses.webp"),
            NDS: runtimeApi.getURL("img/games/website/banners/NDS.png")
        },

        icons: {
            crossroads: runtimeApi.getURL("img/games/website/icons/crossroads.png"),
            partyexe: runtimeApi.getURL("img/games/website/icons/party-exe.png"),
            baseplate: runtimeApi.getURL("img/games/website/icons/baseplate.png"),
            Glasshouses: runtimeApi.getURL("img/games/website/icons/Glasshouses.webp"),
            NDS: runtimeApi.getURL("img/games/website/icons/NDS.png")
        }
    }
};

const runtimeScriptMap = new Map([
    ["boot.iife.js", "runtime/boot.iife.js"],

    ["three.min.js", "runtime/vendor/three.webgpu.js"],
    ["GLTFLoader.js", "runtime/vendor/GLTFLoader.js"],
    ["inflate.min.js", "runtime/vendor/inflate.min.js"],

    ["engine.js", "runtime/boot.iife.js"],
    ["vortex-engine.js", "runtime/boot.iife.js"]
]);

let vwebLaunchConfig: LaunchConfig | null = null;
const vwebBrokerSockets = new Map<string, WebSocket>();

function isLocalRelayUrl(value: unknown): boolean {
    try {
        const u = new URL(String(value || ""));
        return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
    } catch {
        return false;
    }
}

function sameRelayPath(left: unknown, right: unknown): boolean {
    try {
        const a = new URL(String(left || ""));
        const b = new URL(String(right || ""));
        const ap = a.pathname && a.pathname !== "/" ? a.pathname : "/ws";
        const bp = b.pathname && b.pathname !== "/" ? b.pathname : "/ws";
        return a.protocol === b.protocol && a.host === b.host && ap === bp;
    } catch {
        return false;
    }
}

function brokerPost(socketId: string, op: string, payload: Record<string, unknown> = {}): void {
    window.postMessage({
        vwebBroker: true,
        direction: "extension",
        socketId,
        op,
        ...payload
    }, location.origin);
}

function brokerSend(ws: WebSocket, message: string): void {
    let outbound = message;
    try {
        const parsed = typeof message === "string" ? JSON.parse(message) : null;
        if (parsed?.type === "hello") {
            parsed.launchToken = vwebLaunchConfig?.token || "";
            parsed.licenseLease = vwebLaunchConfig?.identity?.licenseLease ||
                vwebLaunchConfig?.identity?.license_lease ||
                vwebLaunchConfig?.identity?.lease ||
                null;
            outbound = JSON.stringify(parsed);
        }
    } catch {}
    ws.send(outbound);
}

function pageSafeIdentity(identity: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!identity || typeof identity !== "object") return null;
    const out = { ...identity };
    const lease = readRecord(out.licenseLease || out.license_lease || out.lease);
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

function handleBrokerMessage(event: MessageEvent<BrokerPayload>): void {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg?.vwebBroker || msg.direction !== "page") return;
    const socketId = String(msg.socketId || "");
    if (!socketId) return;

    if (msg.op === "connect") {
        if (!vwebLaunchConfig?.token || !sameRelayPath(msg.url, vwebLaunchConfig.hubUrl)) {
            brokerPost(socketId, "error", { message: "blocked relay connection" });
            brokerPost(socketId, "close", { code: 1008, reason: "blocked relay connection", wasClean: false });
            return;
        }
        try {
            const ws = new WebSocket(String(msg.url));
            vwebBrokerSockets.set(socketId, ws);
            ws.onopen = () => brokerPost(socketId, "open");
            ws.onmessage = (e) => brokerPost(socketId, "message", { data: e.data });
            ws.onerror = () => brokerPost(socketId, "error", { message: "relay websocket error" });
            ws.onclose = (e) => {
                vwebBrokerSockets.delete(socketId);
                brokerPost(socketId, "close", { code: e.code, reason: e.reason, wasClean: e.wasClean });
            };
        } catch (err) {
            brokerPost(socketId, "error", { message: String(err instanceof Error ? err.message : err) });
            brokerPost(socketId, "close", { code: 1006, reason: "connect failed", wasClean: false });
        }
        return;
    }

    const ws = vwebBrokerSockets.get(socketId);
    if (!ws) return;
    if (msg.op === "send" && ws.readyState === WebSocket.OPEN) {
        brokerSend(ws, String(msg.data || ""));
    } else if (msg.op === "close") {
        try { ws.close(); } catch {}
        vwebBrokerSockets.delete(socketId);
    }
}

function installBrokeredRelayBridge(): void {
    window.removeEventListener("message", handleBrokerMessage);
    window.addEventListener("message", handleBrokerMessage);
}

installBrokeredRelayBridge();

function runtimeUrl(path: string): string {
    return runtimeApi.getURL(path);
}

function replaceUrl(src: string | null): string {
    if (!src) return "";
    const file = src.split("/").pop();
    if (!file) return src;
    const target = runtimeScriptMap.get(file);
    if (!target) return src;
    return runtimeUrl(target);
}

function appendMeta(documentRef: Document, id: string, content: unknown): void {
    const meta = documentRef.createElement("meta");
    meta.id = id;
    meta.name = id;
    meta.content = JSON.stringify(content);
    documentRef.documentElement.appendChild(meta);
}

function appendScriptSequential(documentRef: Document, scriptInfo: ScriptInfo): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = documentRef.createElement("script");
        script.src = scriptInfo.src;
        script.async = false;
        if (scriptInfo.type) script.type = scriptInfo.type;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${scriptInfo.src}`));
        documentRef.body.appendChild(script);
    });
}

async function readLaunchConfig(launchId: string | null): Promise<LaunchConfig | null> {
    if (!launchId) return null;
    const key = `vwebLaunch:${launchId}`;
    const legacyKey = `v22Launch:${launchId}`;
    const maxAgeMs = 5 * 60 * 1000;
    if (runtimeApi.sendMessage) {
        try {
            const res = await runtimeApi.sendMessage({ type: "vweb:takeLaunchConfig", launchId }) as { ok?: boolean; config?: LaunchConfig };
            if (res?.ok && res.config) return res.config;
        } catch {}
    }
    try {
        const raw = sessionStorage.getItem(key) || sessionStorage.getItem(legacyKey);
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(legacyKey);
        const cfg = raw ? JSON.parse(raw) as LaunchConfig | null : null;
        if (!cfg?.createdAt || Date.now() - Number(cfg.createdAt) <= maxAgeMs) return cfg;
    } catch {
    }
    return null;
}

function stripLaunchParams(): void {
    const clean = new URL(location.href);
    clean.searchParams.delete("VWEBLaunch");
    clean.searchParams.delete("V22Launch");
    clean.searchParams.delete("VWEBToken");
    clean.searchParams.delete("V22Token");
    clean.searchParams.delete("VWEBHub");
    clean.searchParams.delete("V22Hub");
    history.replaceState(history.state, document.title, clean.toString());
}

async function rewritePlayDocument(html: string, url: URL, documentRef: Document): Promise<void> {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const launchConfig = await readLaunchConfig(url.searchParams.get("VWEBLaunch") || url.searchParams.get("V22Launch"));
    const cosmetics = window.VortexWebCosmetics;
    const cosmeticsState = cosmetics?.load
        ? await cosmetics.load().catch(() => null)
        : null;
    vwebLaunchConfig = launchConfig;
    installBrokeredRelayBridge();
    const launchToken = launchConfig?.token || "";
    const requestedHubUrl = launchConfig?.hubUrl || "";
    const devLocalRelay = !!launchConfig?.devLocalRelay;
    const devFeatures = !!launchConfig?.devFeatures;
    const hubUrl = isLocalRelayUrl(requestedHubUrl) && !devLocalRelay ? "" : requestedHubUrl;
    const identity = launchConfig?.identity || null;
    stripLaunchParams();

    for (const link of parsed.querySelectorAll<HTMLLinkElement>("link[href]")) {
        const file = link.getAttribute("href")?.split("/").pop();
        if (file === "styles.css") link.href = runtimeUrl("runtime/page/styles.css");
        if (file === "favicon.ico") link.href = "/favicon.ico";
    }

    const scripts: ScriptInfo[] = [];
    for (const oldScript of parsed.querySelectorAll("script[src]")) {
        scripts.push({
            src: replaceUrl(oldScript.getAttribute("src")),
            type: oldScript.getAttribute("type") || ""
        });
        oldScript.remove();
    }

    documentRef.documentElement.replaceWith(documentRef.importNode(parsed.documentElement, true));

    appendMeta(documentRef, "_importedAssets", importedAssets);
    appendMeta(documentRef, "_vortexBridgeConfig", {
        officialGameId: Number(url.searchParams.get("VortexGameId") || 0),
        customGameId: null,
        launchToken: launchConfig?.brokered === false && devLocalRelay ? launchToken : "",
        hubUrl,
        brokered: Boolean(launchConfig && (launchConfig.brokered !== false || !devLocalRelay)),
        devLocalRelay,
        devFeatures,
        identity: pageSafeIdentity(readRecord(identity))
    });
    appendMeta(documentRef, "_vortexWebCosmetics", cosmeticsState || { ownUserId: null, records: {} });
    appendMeta(documentRef, "_vortexCommunityApi", cosmetics?.API_BASE || "https://v22.irongiant.vip");

    for (const scriptInfo of scripts) {
        await appendScriptSequential(documentRef, scriptInfo);
    }
}

export function installPlayDocumentLoader(documentRef: Document = document, fetcher: typeof fetch = fetch): void {
    const url = new URL(documentRef.URL);
    const play = url.searchParams.get("Play");
    if (play) {
        takeoverPlayDocument(documentRef);
        void initPlayDocument(url, documentRef, fetcher);
    } else {
        appendMeta(documentRef, "_importedAssets", importedAssets);
    }
}

function takeoverPlayDocument(documentRef: Document): void {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vortex Web</title>
  <style>
    html,body{margin:0;width:100%;height:100%;background:#05070b;color:#fff;font-family:Arial,sans-serif}
    body{display:grid;place-items:center}
    .vweb-boot{opacity:.78;font-size:14px}
  </style>
</head>
<body><div class="vweb-boot">Starting Vortex Web...</div></body>
</html>`;
    try {
        documentRef.open();
        documentRef.write(html);
        documentRef.close();
        installBrokeredRelayBridge();
    } catch {
        const root = documentRef.documentElement;
        if (root) root.innerHTML = `<head><title>Vortex Web</title></head><body><div>Starting Vortex Web...</div></body>`;
        installBrokeredRelayBridge();
    }
}

async function initPlayDocument(url: URL, documentRef: Document, fetcher: typeof fetch): Promise<void> {
    try {
        const html = await fetcher(
            runtimeUrl("runtime/page/play.html")
        ).then(r => r.text());
        await rewritePlayDocument(html, url, documentRef);
    } catch (err) {
        console.error("[Vortex Web] play loader failed", err);
        const message = `<pre style="padding:16px;color:#fff;background:#111;white-space:pre-wrap">Vortex Web failed to load:\n${String(err instanceof Error ? err.stack || err.message : err)}</pre>`;
        if (documentRef.body) documentRef.body.innerHTML = message;
        else if (documentRef.documentElement) documentRef.documentElement.innerHTML = `<body>${message}</body>`;
    }
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

