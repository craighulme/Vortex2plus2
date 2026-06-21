(() => {
    const extensionApi = globalThis.chrome || globalThis.browser;
    const CARD_ID = "v22-update-notice";

    function sendMessage(message) {
        return new Promise((resolve) => {
            if (!extensionApi?.runtime?.sendMessage) {
                resolve(null);
                return;
            }
            try {
                const result = extensionApi.runtime.sendMessage(message, resolve);
                if (result && typeof result.then === "function") result.then(resolve).catch(() => resolve(null));
            } catch {
                resolve(null);
            }
        });
    }

    function openUpdate(url) {
        window.open(String(url || "https://github.com/craighulme/Vortex2plus2"), "_blank", "noopener");
    }

    function ensureStyle() {
        if (document.getElementById("v22-update-notice-style")) return;
        const style = document.createElement("style");
        style.id = "v22-update-notice-style";
        style.textContent = `
            #v22-update-notice{
                position:fixed;right:18px;top:18px;z-index:2147483647;
                width:min(360px,calc(100vw - 36px));box-sizing:border-box;
                border:1px solid rgba(148,163,184,.28);border-radius:8px;
                background:#10141d;color:#eef4ff;box-shadow:0 14px 40px rgba(0,0,0,.38);
                font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                text-align:left;padding:13px;
            }
            #v22-update-notice *{box-sizing:border-box}
            .v22-update-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
            .v22-update-title{font-size:14px;font-weight:760;line-height:1.25}
            .v22-update-pill{flex:0 0 auto;border-radius:999px;padding:3px 8px;background:#2563eb;color:#fff;font-size:10px;font-weight:760;text-transform:uppercase}
            .v22-update-body{margin:0 0 9px;color:#cbd5e1;font-size:12px;line-height:1.4}
            .v22-update-list{margin:0 0 11px;padding-left:17px;color:#e5edf8;font-size:12px;line-height:1.35}
            .v22-update-list li{margin:3px 0}
            .v22-update-actions{display:flex;justify-content:flex-end;gap:8px}
            .v22-update-actions button{
                border:0;border-radius:6px;padding:7px 10px;font:inherit;font-size:12px;font-weight:720;cursor:pointer;
            }
            .v22-update-primary{background:#2563eb;color:#fff}
            .v22-update-secondary{background:rgba(255,255,255,.08);color:#dbeafe}
        `;
        document.documentElement.appendChild(style);
    }

    function showNotice(status) {
        if (!status?.isNewer || status.dismissed || document.getElementById(CARD_ID)) return;
        const update = status.update || {};
        const latestVersion = String(status.latestVersion || update.version || "");
        const card = document.createElement("div");
        card.id = CARD_ID;
        card.innerHTML = `
            <div class="v22-update-head">
                <div class="v22-update-title"></div>
                <div class="v22-update-pill">New</div>
            </div>
            <p class="v22-update-body"></p>
            <ul class="v22-update-list"></ul>
            <div class="v22-update-actions">
                <button class="v22-update-secondary" type="button">Later</button>
                <button class="v22-update-primary" type="button">Get update</button>
            </div>
        `;
        card.querySelector(".v22-update-title").textContent = `Vortex2+2 ${latestVersion} is available`;
        card.querySelector(".v22-update-body").textContent = update.summary || "Open the repo for the latest version.";
        const list = card.querySelector(".v22-update-list");
        const items = Array.isArray(update.changelog) ? update.changelog.slice(0, 4) : [];
        for (const item of items) {
            const li = document.createElement("li");
            li.textContent = String(item);
            list.appendChild(li);
        }
        list.hidden = items.length === 0;
        card.querySelector(".v22-update-primary").addEventListener("click", () => openUpdate(update.url));
        card.querySelector(".v22-update-secondary").addEventListener("click", async () => {
            await sendMessage({ type: "v22:dismissUpdate", version: latestVersion });
            card.remove();
        });
        ensureStyle();
        document.body.appendChild(card);
    }

    async function checkForUpdateNotice() {
        const status = await sendMessage({ type: "v22:getUpdateStatus" });
        if (document.body) {
            showNotice(status);
            return;
        }
        document.addEventListener("DOMContentLoaded", () => showNotice(status), { once: true });
    }

    checkForUpdateNotice();
})();
