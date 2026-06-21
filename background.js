const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/craighulme/Vortex2plus2/main/extension-update.json";
const REPO_URL = "https://github.com/craighulme/Vortex2plus2";
const UPDATE_ALARM = "v22-update-check";
const CHECK_INTERVAL_MINUTES = 240;
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

const extensionApi = globalThis.chrome || globalThis.browser;

function currentVersion() {
    return extensionApi.runtime?.getManifest?.().version || "0.0.0";
}

function parseVersion(version) {
    return String(version || "0")
        .split(/[.-]/)
        .map((part) => {
            const parsed = Number.parseInt(part, 10);
            return Number.isFinite(parsed) ? parsed : 0;
        });
}

function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

function storageGet(area, defaults) {
    return new Promise((resolve) => {
        const result = extensionApi.storage[area].get(defaults, resolve);
        if (result && typeof result.then === "function") result.then(resolve);
    });
}

function storageSet(area, value) {
    return new Promise((resolve) => {
        const result = extensionApi.storage[area].set(value, resolve);
        if (result && typeof result.then === "function") result.then(resolve);
    });
}

async function fetchUpdateManifest() {
    const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
        cache: "no-store",
        headers: { accept: "application/json" }
    });
    if (!res.ok) throw new Error(`update check failed: HTTP ${res.status}`);
    const update = await res.json();
    update.version = String(update.version || "");
    update.url = String(update.url || REPO_URL);
    update.summary = String(update.summary || update.title || "");
    update.changelog = Array.isArray(update.changelog) ? update.changelog.map((item) => String(item)).slice(0, 6) : [];
    return update;
}

async function getUpdateStatus(force = false) {
    const now = Date.now();
    const cached = await storageGet("local", {
        v22UpdateManifest: null,
        v22UpdateCheckedAt: 0
    });
    let update = cached.v22UpdateManifest;
    const checkedAt = Number(cached.v22UpdateCheckedAt || 0);

    if (force || !update || now - checkedAt > CACHE_MAX_AGE_MS) {
        try {
            update = await fetchUpdateManifest();
            await storageSet("local", {
                v22UpdateManifest: update,
                v22UpdateCheckedAt: now,
                v22UpdateCheckError: ""
            });
        } catch (err) {
            await storageSet("local", {
                v22UpdateCheckedAt: now,
                v22UpdateCheckError: String(err && err.message || err)
            });
        }
    }

    if (!update?.version) {
        return { ok: false, currentVersion: currentVersion(), isNewer: false };
    }

    const dismissed = await storageGet("sync", { dismissedUpdateVersion: "" });
    const latestVersion = String(update.version || "");
    const isNewer = compareVersions(latestVersion, currentVersion()) > 0;
    return {
        ok: true,
        currentVersion: currentVersion(),
        latestVersion,
        isNewer,
        dismissed: String(dismissed.dismissedUpdateVersion || "") === latestVersion,
        update
    };
}

async function setupUpdateAlarm() {
    try {
        await extensionApi.alarms.create(UPDATE_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: CHECK_INTERVAL_MINUTES
        });
    } catch {}
}

extensionApi.runtime.onInstalled.addListener(() => {
    setupUpdateAlarm();
    getUpdateStatus(true);
});

extensionApi.runtime.onStartup?.addListener?.(() => {
    setupUpdateAlarm();
    getUpdateStatus(true);
});

extensionApi.alarms?.onAlarm?.addListener?.((alarm) => {
    if (alarm.name === UPDATE_ALARM) getUpdateStatus(true);
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "v22:getUpdateStatus") {
        getUpdateStatus(Boolean(message.force)).then(sendResponse);
        return true;
    }
    if (message?.type === "v22:dismissUpdate" && message.version) {
        storageSet("sync", { dismissedUpdateVersion: String(message.version) }).then(() => {
            sendResponse({ ok: true });
        });
        return true;
    }
    return false;
});

setupUpdateAlarm();
