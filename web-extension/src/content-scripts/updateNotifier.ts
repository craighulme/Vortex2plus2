const CARD_ID = "vweb-update-notice";
const STYLE_ID = "vweb-update-notice-style";
const DEFAULT_UPDATE_URL = "https://github.com/craighulme/Vortex-Web";

type UpdateStatus = {
  isNewer?: boolean;
  dismissed?: boolean;
  latestVersion?: unknown;
  update?: {
    version?: unknown;
    title?: unknown;
    summary?: unknown;
    changelog?: unknown;
    url?: unknown;
  };
};

export function installUpdateNotifier(documentRef: Document = document, windowRef: Window = window): void {
  void checkForUpdateNotice(documentRef, windowRef);
}

async function sendMessage(message: unknown): Promise<unknown> {
  const api = extensionApi();
  if (!api?.runtime?.sendMessage) return null;
  return await new Promise((resolve) => {
    try {
      const result = api.runtime?.sendMessage?.(message, resolve);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(resolve).catch(() => resolve(null));
      }
    } catch {
      resolve(null);
    }
  });
}

function extensionApi(): MinimalExtensionApi | null {
  const api = (globalThis as typeof globalThis & { browser?: MinimalExtensionApi; chrome?: MinimalExtensionApi }).chrome
    || (globalThis as typeof globalThis & { browser?: MinimalExtensionApi; chrome?: MinimalExtensionApi }).browser;
  return api || null;
}

function openUpdate(windowRef: Window, url: unknown): void {
  windowRef.open(String(url || DEFAULT_UPDATE_URL), "_blank", "noopener");
}

function ensureStyle(documentRef: Document): void {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #vweb-update-notice{
      position:fixed;right:18px;top:18px;z-index:2147483647;
      width:min(390px,calc(100vw - 36px));max-height:calc(100vh - 36px);box-sizing:border-box;
      border:1px solid var(--linecol2, rgba(255,255,255,.16));border-radius:8px;
      background:var(--bgcol2, #252525);color:var(--textcol1, #fff);
      box-shadow:0 14px 40px rgba(0,0,0,.28);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      text-align:left;padding:13px;overflow:auto;
    }
    #vweb-update-notice *{box-sizing:border-box}
    .vweb-update-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .vweb-update-title{font-size:14px;font-weight:760;line-height:1.25}
    .vweb-update-subtitle{margin:-2px 0 8px;color:var(--textcol1, #fff);font-size:13px;font-weight:720;line-height:1.25}
    .vweb-update-pill{flex:0 0 auto;border-radius:999px;padding:3px 8px;background:var(--accentcol1, #098b4a);color:#fff;font-size:10px;font-weight:760;text-transform:uppercase}
    .vweb-update-body{margin:0 0 9px;color:var(--textcol2, rgba(255,255,255,.74));font-size:12px;line-height:1.4}
    .vweb-update-list{margin:0 0 11px;padding-left:17px;color:var(--textcol1, #fff);font-size:12px;line-height:1.35}
    .vweb-update-list li{margin:3px 0}
    .vweb-update-actions{display:flex;justify-content:flex-end;gap:8px}
    .vweb-update-actions button{
      border:0;border-radius:6px;padding:7px 10px;font:inherit;font-size:12px;font-weight:720;cursor:pointer;
    }
    .vweb-update-primary{background:var(--accentcol1, #098b4a) !important;color:#fff !important}
    .vweb-update-secondary{background:var(--bgcol3, rgba(255,255,255,.08)) !important;color:var(--textcol1, #fff) !important}
  `;
  documentRef.documentElement.appendChild(style);
}

function showNotice(status: UpdateStatus | null, documentRef: Document, windowRef: Window): void {
  if (!status?.isNewer || status.dismissed || documentRef.getElementById(CARD_ID)) return;
  const update = status.update || {};
  const latestVersion = String(status.latestVersion || update.version || "");
  const card = documentRef.createElement("div");
  card.id = CARD_ID;
  card.innerHTML = `
    <div class="vweb-update-head">
      <div class="vweb-update-title"></div>
      <div class="vweb-update-pill">New</div>
    </div>
    <div class="vweb-update-subtitle"></div>
    <p class="vweb-update-body"></p>
    <ul class="vweb-update-list"></ul>
    <div class="vweb-update-actions">
      <button class="vweb-update-secondary" type="button">Later</button>
      <button class="vweb-update-primary" type="button">Get update</button>
    </div>
  `;
  text(card, ".vweb-update-title", `Vortex Web ${latestVersion} is available`);
  const subtitle = card.querySelector<HTMLElement>(".vweb-update-subtitle");
  if (subtitle) {
    subtitle.textContent = typeof update.title === "string" ? update.title : "";
    subtitle.hidden = !subtitle.textContent;
  }
  text(card, ".vweb-update-body", typeof update.summary === "string" ? update.summary : "Open the repo for the latest version.");
  const list = card.querySelector<HTMLElement>(".vweb-update-list");
  const items = Array.isArray(update.changelog) ? update.changelog : [];
  for (const item of items) {
    const li = documentRef.createElement("li");
    li.textContent = String(item);
    list?.appendChild(li);
  }
  if (list) list.hidden = items.length === 0;
  card.querySelector(".vweb-update-primary")?.addEventListener("click", () => openUpdate(windowRef, update.url));
  card.querySelector(".vweb-update-secondary")?.addEventListener("click", async () => {
    await sendMessage({ type: "vweb:dismissUpdate", version: latestVersion });
    card.remove();
  });
  ensureStyle(documentRef);
  documentRef.body.appendChild(card);
}

async function checkForUpdateNotice(documentRef: Document, windowRef: Window): Promise<void> {
  const status = await sendMessage({ type: "vweb:getUpdateStatus" }) as UpdateStatus | null;
  if (documentRef.body) {
    showNotice(status, documentRef, windowRef);
    return;
  }
  documentRef.addEventListener("DOMContentLoaded", () => showNotice(status, documentRef, windowRef), { once: true });
}

function text(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}
