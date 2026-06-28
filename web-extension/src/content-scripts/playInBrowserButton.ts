const BTN_ID = "vweb-play-browser-btn";
const HOSTED_LICENSE_API = "https://v22.irongiant.vip";
const HOSTED_RELAY_URL = "wss://v22-relay.116.203.155.30.sslip.io/ws";
const DEV_LOCAL_RELAY_KEY = "vwebDevLocalRelay";
const DEV_FEATURES_KEY = "vwebDevFeatures";
const LAST_LICENSE_LEASE_KEY = "vwebLastLicenseLease";
const LICENSE_HELP_MESSAGE = 'Vortex Web license key is invalid or not set.\nContact "quackduck." on Discord for access.';
const REQUESTED_FEATURES = [
    "vortex-native-bridge",
    "teleport-commands",
    "bring-command",
    "fly-command",
    "noclip-command",
    "gravity-command",
    "airwalk-command",
    "packet-debug"
];
const DEV_REQUESTED_FEATURES = [
    "avatar-spoof"
];

type LaunchIdentity = {
    id: number;
    username: string;
    gameId: number;
    shirtId: number;
    pantId: number;
    bodyType: string;
    bodyColors: unknown[];
    faceId: number;
    clientToken?: string;
    licenseLease?: unknown;
};

type StoredConfig = {
    hubUrl: string;
    licenseApiUrl: string;
    licenseKey: string;
    devLocalRelay?: boolean;
    devFeatures?: boolean;
};

type ActivationResponse = {
    lease?: unknown;
    error?: unknown;
    message?: unknown;
};

type LaunchStoreResponse = {
    ok?: boolean;
    launchId?: string;
};

type LicenseError = Error & {
    code?: string;
    reason?: string;
    status?: number;
};

type StorageArea = {
    get(defaults: Record<string, unknown>): Promise<Record<string, unknown>>;
    set(values: Record<string, unknown>): Promise<void>;
};

type ExtensionRuntime = {
    sendMessage?(message: unknown): Promise<unknown>;
};

type ExtensionApi = {
    runtime?: ExtensionRuntime;
    storage?: {
        local?: StorageArea;
        sync?: StorageArea;
    };
};

export function installPlayInBrowserButton(documentRef: Document = document, windowRef: Window = window, fetcher: typeof fetch = fetch): void {
    if (!/^\/games\/\d+\/?$/.test(windowRef.location.pathname) || windowRef.location.search.includes("Play=1")) return;
    const inject = () => void injectButton(documentRef, windowRef, fetcher);
    const observer = new MutationObserver(inject);
    observer.observe(documentRef.documentElement, { childList: true, subtree: true });
    if (documentRef.readyState === "loading") {
        documentRef.addEventListener("DOMContentLoaded", inject, { once: true });
    } else {
        inject();
    }
}

    function gameIdFromPath(windowRef: Window = window): number | null {
        const match = windowRef.location.pathname.match(/^\/games\/(\d+)(?:\/)?$/);
        return match ? Number(match[1]) : null;
    }

    function ensureStyle(documentRef: Document = document): void {
        if (documentRef.getElementById("vweb-play-browser-style")) return;
        const style = documentRef.createElement("style");
        style.id = "vweb-play-browser-style";
        style.textContent = `
            .vweb-play-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
            .vweb-play-browser-btn{
                display:inline-flex;align-items:center;justify-content:center;gap:8px;
                min-height:42px;padding:0 18px;border-radius:8px;border:0;
                background:#111827;color:#fff;text-decoration:none;font-weight:700;
                font-family:inherit;cursor:pointer;box-shadow:none;
            }
            .vweb-play-browser-btn:hover{background:#1f2937;color:#fff;text-decoration:none}
            .vweb-play-browser-btn[disabled]{opacity:.65;cursor:wait}
        `;
        documentRef.documentElement.appendChild(style);
    }

    function extractLaunchUri(html: string): string | null {
        const direct = html.match(/vortex:\/\/play\?game=\d+&token=[a-fA-F0-9]{64}/);
        if (direct) return direct[0];
        const decoded = html.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const fallback = decoded.match(/vortex:\/\/play\?game=\d+&token=[a-fA-F0-9]{64}/);
        return fallback ? fallback[0] : null;
    }

    async function fetchLaunchUri(fetcher: typeof fetch, gameId: number): Promise<string> {
        const res = await fetcher(`/games/${gameId}/play`, {
            credentials: "include",
            redirect: "follow",
            cache: "no-store"
        });
        if (!res.ok) {
            throw new Error(`launch token request failed: HTTP ${res.status}`);
        }
        const html = await res.text();
        const uri = extractLaunchUri(html);
        if (!uri) {
            throw new Error("launch token was not found; log in again or open the normal Play button once");
        }
        return uri;
    }

    async function fetchJson(fetcher: typeof fetch, path: string): Promise<Record<string, unknown> | null> {
        const res = await fetcher(path, {
            credentials: "include",
            cache: "no-store",
            headers: { accept: "application/json" }
        });
        if (!res.ok) return null;
        try {
            return await res.json();
        } catch {
            return null;
        }
    }

    async function fetchLaunchIdentity(fetcher: typeof fetch, gameId: number): Promise<LaunchIdentity | null> {
        const [me, catalog] = await Promise.all([
            fetchJson(fetcher, "/me"),
            fetchJson(fetcher, "/api/catalog/init")
        ]);
        if (!me?.id) return null;
        return {
            id: Number(me.id) || 0,
            username: String(me.username || me.name || "BrowserPlayer"),
            gameId: Number(gameId) || 0,
            shirtId: Number(catalog?.shirt_id ?? catalog?.shirtId ?? 0) || 0,
            pantId: Number(catalog?.pant_id ?? catalog?.pantId ?? 0) || 0,
            bodyType: String(catalog?.body_type ?? catalog?.bodyType ?? "male"),
            bodyColors: Array.isArray(catalog?.body_colors) ? catalog.body_colors : [],
            faceId: Number(catalog?.face_id ?? catalog?.faceId ?? 0) || 0
        };
    }

    function mergeIdentity(local: LaunchIdentity | null, verified: Partial<LaunchIdentity> | null, gameId: number): LaunchIdentity {
        const out = { ...(local || {}) };
        if (verified?.id) out.id = verified.id;
        if (verified?.username) out.username = verified.username;
        out.gameId = verified?.gameId || out.gameId || Number(gameId) || 0;
        if (verified?.shirtId) out.shirtId = verified.shirtId;
        if (verified?.pantId) out.pantId = verified.pantId;
        if (verified?.bodyType) out.bodyType = verified.bodyType;
        if (Array.isArray(verified?.bodyColors) && verified.bodyColors.length) out.bodyColors = verified.bodyColors;
        if (verified?.faceId) out.faceId = verified.faceId;
        if (verified?.clientToken) out.clientToken = verified.clientToken;
        return {
            id: Number(out.id) || 0,
            username: String(out.username || "BrowserPlayer"),
            gameId: Number(out.gameId || gameId) || 0,
            shirtId: Number(out.shirtId || 0) || 0,
            pantId: Number(out.pantId || 0) || 0,
            bodyType: String(out.bodyType || "male"),
            bodyColors: Array.isArray(out.bodyColors) ? out.bodyColors : [],
            faceId: Number(out.faceId || 0) || 0,
            clientToken: typeof out.clientToken === "string" ? out.clientToken : undefined,
            licenseLease: out.licenseLease
        };
    }

    async function storeLaunchConfig(config: Record<string, unknown>): Promise<string> {
        const api = extensionApi();
        if (api?.runtime?.sendMessage) {
            try {
                const res = await api.runtime.sendMessage({ type: "vweb:storeLaunchConfig", config }) as LaunchStoreResponse;
                if (res?.ok && res.launchId) return res.launchId;
            } catch {}
        }
        const launchId = crypto.randomUUID ? crypto.randomUUID() : randomHex(16);
        sessionStorage.setItem(`vwebLaunch:${launchId}`, JSON.stringify({ ...config, createdAt: Date.now() }));
        return launchId;
    }

    async function getStoredConfig(): Promise<StoredConfig> {
        const api = extensionApi();
        const fallback = {
            hubUrl: HOSTED_RELAY_URL,
            licenseApiUrl: HOSTED_LICENSE_API,
            licenseKey: ""
        };
        if (!api?.storage?.local) return fallback;
        let stored = await api.storage.local.get(fallback);
        if ((!stored.hubUrl || !stored.licenseKey) && api.storage.sync) {
            try {
                const synced = await api.storage.sync.get(fallback);
                stored = {
                    ...synced,
                    ...Object.fromEntries(Object.entries(stored).filter(([, value]) => value !== "" && value != null))
                };
                await api.storage.local.set(stored);
            } catch {}
        }
        const storedHubUrl = String(stored.hubUrl || "").trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
        const devLocalRelay = await isDevLocalRelayEnabled();
        const devFeatures = await isDevFeaturesEnabled();
        const localRelay = isLocalRelayUrl(storedHubUrl);
        return {
            hubUrl: localRelay && devLocalRelay ? storedHubUrl : fallback.hubUrl,
            licenseApiUrl: HOSTED_LICENSE_API,
            licenseKey: String(stored.licenseKey || "").trim(),
            devLocalRelay,
            devFeatures
        };
    }

    async function isDevLocalRelayEnabled(): Promise<boolean> {
        const api = extensionApi();
        try {
            if (api?.storage?.local) {
                const stored = await api.storage.local.get({ [DEV_LOCAL_RELAY_KEY]: false });
                return stored[DEV_LOCAL_RELAY_KEY] === true || stored[DEV_LOCAL_RELAY_KEY] === "1";
            }
        } catch {}
        return false;
    }

    async function isDevFeaturesEnabled(): Promise<boolean> {
        const api = extensionApi();
        try {
            if (api?.storage?.local) {
                const stored = await api.storage.local.get({ [DEV_FEATURES_KEY]: false });
                return stored[DEV_FEATURES_KEY] === true || stored[DEV_FEATURES_KEY] === "1";
            }
        } catch {}
        return false;
    }

    function requestedFeatures(config: Pick<StoredConfig, "devFeatures">): string[] {
        return config?.devFeatures
            ? [...REQUESTED_FEATURES, ...DEV_REQUESTED_FEATURES]
            : REQUESTED_FEATURES;
    }

    function isLocalRelayUrl(hubUrl: unknown): boolean {
        try {
            const parsed = new URL(String(hubUrl || ""));
            return (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
                ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname);
        } catch {
            return false;
        }
    }

    async function browserFingerprintHash(): Promise<string> {
        const api = extensionApi();
        let installId = "";
        if (api?.storage?.local) {
            const stored = await api.storage.local.get({ vwebInstallId: "" });
            installId = String(stored.vwebInstallId || "");
            if (!installId) {
                installId = crypto.randomUUID ? crypto.randomUUID() : randomHex(16);
                await api.storage.local.set({ vwebInstallId: installId });
            }
        }
        const material = `vortex-web-install\n${installId}`;
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    function randomHex(bytes: number): string {
        const values = new Uint8Array(bytes);
        crypto.getRandomValues(values);
        return [...values].map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async function activateLicense(fetcher: typeof fetch, config: StoredConfig): Promise<unknown> {
        if (!config.licenseKey) {
            const err: LicenseError = new Error("missing license key");
            err.code = "VWEB_LICENSE_INVALID";
            throw err;
        }
        const res = await fetcher(`${config.licenseApiUrl}/activate`, {
            method: "POST",
            cache: "no-store",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                license_key: config.licenseKey,
                fingerprint_hash: await browserFingerprintHash(),
                features: requestedFeatures(config)
            })
        });
        const text = await res.text();
        let raw: ActivationResponse = {};
        try { raw = JSON.parse(text); } catch {}
        if (!res.ok || !raw.lease) {
            const reason = String(raw.error || raw.message || `HTTP ${res.status}`);
            const err: LicenseError = new Error(`license activation failed: ${reason}`);
            err.code = "VWEB_LICENSE_INVALID";
            err.reason = reason;
            err.status = res.status;
            throw err;
        }
        await storeLastLicenseLease(raw.lease);
        return raw.lease;
    }

    async function storeLastLicenseLease(lease: unknown): Promise<void> {
        const api = extensionApi();
        if (!api?.storage?.local || !lease) return;
        try {
            await api.storage.local.set({ [LAST_LICENSE_LEASE_KEY]: { lease, savedAt: Date.now() } });
        } catch {}
    }

    function launchLocalRelay(documentRef: Document, gameId: number): void {
        const frame = documentRef.createElement("iframe");
        frame.hidden = true;
        frame.src = `v22bridge://start?game=${encodeURIComponent(String(gameId))}`;
        documentRef.documentElement.appendChild(frame);
        setTimeout(() => frame.remove(), 5000);
    }

    function waitForRelay(hubUrl: string, timeoutMs = 12000): Promise<boolean> {
        return new Promise((resolve) => {
            const started = Date.now();

            const attempt = () => {
                let ws;
                try {
                    const url = new URL(hubUrl);
                    if (!url.pathname || url.pathname === "/") url.pathname = "/ws";
                    ws = new WebSocket(url.toString());
                } catch {
                    resolve(false);
                    return;
                }

                let settled = false;
                const finish = (ok: boolean) => {
                    if (settled) return;
                    settled = true;
                    try { ws.close(); } catch {}
                    if (ok || Date.now() - started >= timeoutMs) {
                        resolve(ok);
                    } else {
                        setTimeout(attempt, 450);
                    }
                };

                const timer = setTimeout(() => finish(false), 900);
                ws.onopen = () => {
                    clearTimeout(timer);
                    finish(true);
                };
                ws.onerror = () => {
                    clearTimeout(timer);
                    finish(false);
                };
            };

            attempt();
        });
    }

    async function onClick(btn: HTMLButtonElement, gameId: number, documentRef: Document, windowRef: Window, fetcher: typeof fetch): Promise<void> {
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Preparing...";
        try {
            const config = await getStoredConfig();
            const hubUrl = config.hubUrl;
            if (config.devLocalRelay && isLocalRelayUrl(hubUrl)) {
                btn.textContent = "Checking relay...";
                const alreadyRunning = await waitForRelay(hubUrl, 900);
                if (!alreadyRunning) {
                    btn.textContent = "Starting relay...";
                    launchLocalRelay(documentRef, gameId);
                    const started = await waitForRelay(hubUrl);
                    if (!started) throw new Error("local relay is not running; run Start-NativeBridge.cmd once, then retry");
                }
            }

            btn.textContent = "Fetching token...";
            const identity = await fetchLaunchIdentity(fetcher, gameId);
            let mergedLicense = null;
            const launchUri = await fetchLaunchUri(fetcher, gameId);
            const launch = new URL(launchUri);
            const token = launch.searchParams.get("token");
            if (!token) throw new Error("launch URI did not contain a token");
            if (!isLocalRelayUrl(hubUrl)) {
                if (!config.licenseKey) {
                    const err: LicenseError = new Error("missing license key");
                    err.code = "VWEB_LICENSE_INVALID";
                    throw err;
                }
                mergedLicense = await activateLicense(fetcher, config);
            }
            const merged = mergeIdentity(identity, null, gameId);
            if (mergedLicense) merged.licenseLease = mergedLicense;
            const launchId = await storeLaunchConfig({
                token,
                hubUrl,
                identity: merged,
                brokered: !(config.devLocalRelay && isLocalRelayUrl(hubUrl)),
                devLocalRelay: !!config.devLocalRelay,
                devFeatures: !!config.devFeatures
            });

            const playUrl = new URL(`/games/${gameId}`, windowRef.location.origin);
            playUrl.searchParams.set("Play", "1");
            playUrl.searchParams.set("VortexGameId", String(gameId));
            playUrl.searchParams.set("VWEBLaunch", launchId);
            windowRef.location.href = playUrl.toString();
        } catch (err) {
            const error = err as LicenseError;
            if (error?.code === "VWEB_LICENSE_INVALID") {
                const detail = error.reason ? `\n\nServer reason: ${error.reason}` : "";
                const hint = /hwid/i.test(error.reason || "")
                    ? "\n\nThis key appears locked to another browser/install fingerprint."
                    : (/session_cap|cap|429/i.test(error.reason || "") ? "\n\nToo many active sessions are using this license. Wait for the old session to expire or revoke it server-side." : "");
                windowRef.alert(`${LICENSE_HELP_MESSAGE}${detail}${hint}`);
            } else {
                windowRef.alert(`Vortex Web browser launch failed:\n${err instanceof Error ? err.message : err}`);
            }
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    async function injectButton(documentRef: Document, windowRef: Window, fetcher: typeof fetch): Promise<void> {
        const gameId = gameIdFromPath(windowRef);
        if (!gameId || documentRef.getElementById(BTN_ID)) return;
        const play = documentRef.querySelector<HTMLAnchorElement>("a.btn-play[href*='/play']");
        if (!play || !play.parentElement) return;

        ensureStyle(documentRef);
        const row = documentRef.createElement("div");
        row.className = "vweb-play-row";
        play.parentElement.insertBefore(row, play);
        row.appendChild(play);

        const btn = documentRef.createElement("button");
        btn.id = BTN_ID;
        btn.className = "vweb-play-browser-btn";
        btn.type = "button";
        btn.textContent = "Play in Browser";
        btn.addEventListener("click", () => void onClick(btn, gameId, documentRef, windowRef, fetcher));
        row.appendChild(btn);
    }

function extensionApi(): ExtensionApi | null {
    const api = (globalThis as typeof globalThis & { chrome?: ExtensionApi; browser?: ExtensionApi }).chrome
        || (globalThis as typeof globalThis & { chrome?: ExtensionApi; browser?: ExtensionApi }).browser;
    return api || null;
}
