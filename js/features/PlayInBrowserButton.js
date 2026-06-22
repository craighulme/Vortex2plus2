(() => {
    const BTN_ID = "v22-play-browser-btn";
    const HOSTED_LICENSE_API = "https://v22.irongiant.vip";
    const LICENSE_HELP_MESSAGE = 'Vortex2+2 license key is invalid or not set.\nContact "quackduck." on Discord for access.';
    const REQUESTED_FEATURES = [
        "vortex-native-bridge",
        "avatar-spoof",
        "teleport-commands",
        "bring-command",
        "packet-debug",
        "fly-command",
        "noclip-command",
        "gravity-command",
        "airwalk-command"
    ];

    function gameIdFromPath() {
        const match = location.pathname.match(/^\/games\/(\d+)(?:\/)?$/);
        return match ? Number(match[1]) : null;
    }

    function ensureStyle() {
        if (document.getElementById("v22-play-browser-style")) return;
        const style = document.createElement("style");
        style.id = "v22-play-browser-style";
        style.textContent = `
            .v22-play-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
            .v22-play-browser-btn{
                display:inline-flex;align-items:center;justify-content:center;gap:8px;
                min-height:42px;padding:0 18px;border-radius:8px;border:0;
                background:#111827;color:#fff;text-decoration:none;font-weight:700;
                font-family:inherit;cursor:pointer;box-shadow:none;
            }
            .v22-play-browser-btn:hover{background:#1f2937;color:#fff;text-decoration:none}
            .v22-play-browser-btn[disabled]{opacity:.65;cursor:wait}
        `;
        document.documentElement.appendChild(style);
    }

    function extractLaunchUri(html) {
        const direct = html.match(/vortex:\/\/play\?game=\d+&token=[a-fA-F0-9]{64}/);
        if (direct) return direct[0];
        const decoded = html.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
        const fallback = decoded.match(/vortex:\/\/play\?game=\d+&token=[a-fA-F0-9]{64}/);
        return fallback ? fallback[0] : null;
    }

    async function fetchLaunchUri(gameId) {
        const res = await fetch(`/games/${gameId}/play`, {
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

    async function fetchJson(path) {
        const res = await fetch(path, {
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

    async function fetchLaunchIdentity(gameId) {
        const [me, catalog] = await Promise.all([
            fetchJson("/me"),
            fetchJson("/api/catalog/init")
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

    function mergeIdentity(local, verified, gameId) {
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
        return out;
    }

    async function storeLaunchConfig(config) {
        const api = globalThis.chrome || globalThis.browser;
        if (api?.runtime?.sendMessage) {
            try {
                const res = await api.runtime.sendMessage({ type: "v22:storeLaunchConfig", config });
                if (res?.ok && res.launchId) return res.launchId;
            } catch {}
        }
        const launchId = crypto.randomUUID ? crypto.randomUUID() : randomHex(16);
        sessionStorage.setItem(`v22Launch:${launchId}`, JSON.stringify({ ...config, createdAt: Date.now() }));
        return launchId;
    }

    async function getStoredConfig() {
        const api = globalThis.chrome || globalThis.browser;
        const fallback = {
            hubUrl: "wss://v22-relay.116.203.155.30.sslip.io/ws",
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
        return {
            hubUrl: isLocalRelayUrl(storedHubUrl) ? storedHubUrl : fallback.hubUrl,
            licenseApiUrl: HOSTED_LICENSE_API,
            licenseKey: String(stored.licenseKey || "").trim()
        };
    }

    function isLocalRelayUrl(hubUrl) {
        try {
            const parsed = new URL(hubUrl);
            return (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
                ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname);
        } catch {
            return false;
        }
    }

    async function browserFingerprintHash() {
        const api = globalThis.chrome || globalThis.browser;
        let installId = "";
        if (api?.storage?.local) {
            const stored = await api.storage.local.get({ v22InstallId: "" });
            installId = String(stored.v22InstallId || "");
            if (!installId) {
                installId = crypto.randomUUID ? crypto.randomUUID() : randomHex(16);
                await api.storage.local.set({ v22InstallId: installId });
            }
        }
        const material = [
            installId,
            navigator.userAgent || "",
            navigator.platform || "",
            (navigator.languages || []).join(","),
            `${screen.width || 0}x${screen.height || 0}x${screen.colorDepth || 0}`
        ].join("\n");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    function randomHex(bytes) {
        const values = new Uint8Array(bytes);
        crypto.getRandomValues(values);
        return [...values].map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async function activateLicense(config) {
        if (!config.licenseKey) {
            const err = new Error("missing license key");
            err.code = "V22_LICENSE_INVALID";
            throw err;
        }
        const res = await fetch(`${config.licenseApiUrl}/activate`, {
            method: "POST",
            cache: "no-store",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                license_key: config.licenseKey,
                fingerprint_hash: await browserFingerprintHash(),
                features: REQUESTED_FEATURES
            })
        });
        const text = await res.text();
        let raw = {};
        try { raw = JSON.parse(text); } catch {}
        if (!res.ok || !raw.lease) {
            const err = new Error(`license activation failed: HTTP ${res.status}${raw.error ? " " + raw.error : ""}`);
            err.code = "V22_LICENSE_INVALID";
            throw err;
        }
        return raw.lease;
    }

    function launchLocalRelay(gameId) {
        const frame = document.createElement("iframe");
        frame.hidden = true;
        frame.src = `v22bridge://start?game=${encodeURIComponent(String(gameId))}`;
        document.documentElement.appendChild(frame);
        setTimeout(() => frame.remove(), 5000);
    }

    function waitForRelay(hubUrl, timeoutMs = 12000) {
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
                const finish = (ok) => {
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

    async function onClick(btn, gameId) {
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Preparing...";
        try {
            const config = await getStoredConfig();
            const hubUrl = config.hubUrl;
            if (isLocalRelayUrl(hubUrl)) {
                btn.textContent = "Checking relay...";
                const alreadyRunning = await waitForRelay(hubUrl, 900);
                if (!alreadyRunning) {
                    btn.textContent = "Starting relay...";
                    launchLocalRelay(gameId);
                    const started = await waitForRelay(hubUrl);
                    if (!started) throw new Error("local relay is not running; run Start-NativeBridge.cmd once, then retry");
                }
            }

            btn.textContent = "Fetching token...";
            const identity = await fetchLaunchIdentity(gameId);
            let mergedLicense = null;
            const launchUri = await fetchLaunchUri(gameId);
            const launch = new URL(launchUri);
            const token = launch.searchParams.get("token");
            if (!token) throw new Error("launch URI did not contain a token");
            if (!isLocalRelayUrl(hubUrl)) {
                if (!config.licenseKey) {
                    const err = new Error("missing license key");
                    err.code = "V22_LICENSE_INVALID";
                    throw err;
                }
                mergedLicense = await activateLicense(config);
            }
            const merged = mergeIdentity(identity, null, gameId);
            if (mergedLicense) merged.licenseLease = mergedLicense;
            const launchId = await storeLaunchConfig({
                token,
                hubUrl,
                identity: merged,
                brokered: !isLocalRelayUrl(hubUrl)
            });

            const playUrl = new URL(`/games/${gameId}`, location.origin);
            playUrl.searchParams.set("Play", "1");
            playUrl.searchParams.set("VortexGameId", String(gameId));
            playUrl.searchParams.set("V22Launch", launchId);
            location.href = playUrl.toString();
        } catch (err) {
            if (err?.code === "V22_LICENSE_INVALID") {
                alert(LICENSE_HELP_MESSAGE);
            } else {
                alert(`Vortex2+2 browser launch failed:\n${err.message || err}`);
            }
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    async function injectButton() {
        const gameId = gameIdFromPath();
        if (!gameId || document.getElementById(BTN_ID)) return;
        const play = document.querySelector("a.btn-play[href*='/play']");
        if (!play || !play.parentElement) return;

        ensureStyle();
        const row = document.createElement("div");
        row.className = "v22-play-row";
        play.parentElement.insertBefore(row, play);
        row.appendChild(play);

        const btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.className = "v22-play-browser-btn";
        btn.type = "button";
        btn.textContent = "Play in Browser";
        btn.addEventListener("click", () => onClick(btn, gameId));
        row.appendChild(btn);

    }

    if (!/^\/games\/\d+\/?$/.test(location.pathname) || location.search.includes("Play=1")) return;
    const observer = new MutationObserver(injectButton);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectButton, { once: true });
    } else {
        injectButton();
    }
})();
