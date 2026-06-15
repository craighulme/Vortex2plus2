(() => {
    const BTN_ID = "v22-play-browser-btn";

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

    async function getHubUrl() {
        const api = globalThis.chrome || globalThis.browser;
        const fallback = "ws://127.0.0.1:27822/ws";
        if (!api?.storage?.sync) return fallback;
        const stored = await api.storage.sync.get({ hubUrl: "" });
        return String(stored.hubUrl || fallback).trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
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
            const hubUrl = await getHubUrl();
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
            const launchUri = await fetchLaunchUri(gameId);
            const launch = new URL(launchUri);
            const token = launch.searchParams.get("token");
            if (!token) throw new Error("launch URI did not contain a token");

            const playUrl = new URL(`/games/${gameId}`, location.origin);
            playUrl.searchParams.set("Play", "1");
            playUrl.searchParams.set("VortexGameId", String(gameId));
            playUrl.searchParams.set("V22Token", token);
            if (hubUrl) playUrl.searchParams.set("V22Hub", hubUrl);
            location.href = playUrl.toString();
        } catch (err) {
            alert(`Vortex2+2 browser launch failed:\n${err.message || err}`);
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
