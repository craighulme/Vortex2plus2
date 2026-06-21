//Made by Inuk
const extensionApi = globalThis.chrome || globalThis.browser;
let lightModeToggle = document.getElementById('lightMode')
let hubInput = document.getElementById('hubUrl')
let licenseKeyInput = document.getElementById('licenseKey')
let hubStatus = document.getElementById('hubStatus')
let localRelayBtn = document.getElementById('localRelayBtn')
let hostedRelayBtn = document.getElementById('hostedRelayBtn')
let hostedPanel = document.getElementById('hostedPanel')
let localPanel = document.getElementById('localPanel')
let extensionVersionLabel = document.getElementById('extensionVersion')
let updateCard = document.getElementById('updateCard')
let updateTitle = document.getElementById('updateTitle')
let updatePill = document.getElementById('updatePill')
let updateBody = document.getElementById('updateBody')
let updateList = document.getElementById('updateList')
let openUpdateBtn = document.getElementById('openUpdateBtn')
let dismissUpdateBtn = document.getElementById('dismissUpdateBtn')

const LOCAL_NATIVE_RELAY = "ws://127.0.0.1:27822/ws";
const HOSTED_NATIVE_RELAY = "wss://v22-relay.116.203.155.30.sslip.io/ws";
const HOSTED_LICENSE_API = "https://v22.irongiant.vip";
const UPDATE_MANIFEST_URL = "https://api.github.com/repos/craighulme/Vortex2plus2/contents/extension-update.json?ref=main";
const REPO_URL = "https://github.com/craighulme/Vortex2plus2";
const CURRENT_VERSION = extensionApi.runtime?.getManifest?.().version || "0.0.0";

extensionVersionLabel.textContent = `Version ${CURRENT_VERSION}`;

function storageGet(defaults, cb) {
    const result = extensionApi.storage.sync.get(defaults, cb);
    if (result && typeof result.then === 'function') result.then(cb);
}

function storageSet(value, cb) {
    const result = extensionApi.storage.sync.set(value, cb);
    if (result && typeof result.then === 'function') result.then(cb);
}

function storageGetAsync(defaults) {
    return new Promise((resolve) => storageGet(defaults, resolve));
}

let hubTimer = null;
function setStatus(label) {
    hubStatus.textContent = label;
    setTimeout(() => hubStatus.textContent = "", 1600);
}

function isLocalRelayUrl(value) {
    try {
        const parsed = new URL(value);
        return (parsed.protocol === "ws:" || parsed.protocol === "wss:") &&
            ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname);
    } catch {
        return false;
    }
}

function selectMode(mode, label = null) {
    const local = mode === "local";
    hostedRelayBtn.classList.toggle("active", !local);
    localRelayBtn.classList.toggle("active", local);
    hostedPanel.hidden = local;
    localPanel.hidden = !local;
    if (local) {
        const currentHubUrl = hubInput.value.trim();
        const localHubUrl = isLocalRelayUrl(currentHubUrl) ? currentHubUrl : LOCAL_NATIVE_RELAY;
        saveHubUrl(localHubUrl, label);
    } else {
        hubInput.value = HOSTED_NATIVE_RELAY;
        storageSet({ hubUrl: HOSTED_NATIVE_RELAY, licenseApiUrl: HOSTED_LICENSE_API }, () => {
            if (label) setStatus(label);
        });
    }
}

function saveHubUrl(value, label = "Saved") {
    const normalized = value.trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    hubInput.value = normalized;
    storageSet({ hubUrl: normalized }, () => {
        if (label !== null) setStatus(normalized ? label : "Browser multiplayer hub disabled");
    });
}

let licenseTimer = null;
function saveLicenseSettings(label = "Saved") {
    const licenseKey = licenseKeyInput.value.trim();
    storageSet({ licenseApiUrl: HOSTED_LICENSE_API, licenseKey }, () => {
        setStatus(label);
    });
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

function openUrl(url) {
    const safeUrl = String(url || REPO_URL);
    if (extensionApi.tabs?.create) {
        extensionApi.tabs.create({ url: safeUrl });
        return;
    }
    window.open(safeUrl, "_blank", "noopener");
}

function decodeUpdatePayload(raw) {
    if (raw?.content && raw.encoding === "base64") {
        return JSON.parse(atob(String(raw.content).replace(/\s/g, "")));
    }
    return raw;
}

function renderUpdateCard(update, isNewer) {
    const latestVersion = String(update.version || "");
    const updateUrl = String(update.url || REPO_URL);
    updateCard.hidden = false;
    updateTitle.textContent = isNewer ? `Update ${latestVersion} available` : `Latest: ${latestVersion || CURRENT_VERSION}`;
    updatePill.textContent = isNewer ? "New" : "Current";
    updateBody.textContent = update.summary || update.title || "Open the repo for the latest release notes.";
    updateList.textContent = "";
    const items = Array.isArray(update.changelog) ? update.changelog.slice(0, 5) : [];
    for (const item of items) {
        const li = document.createElement("li");
        li.textContent = String(item);
        updateList.appendChild(li);
    }
    updateList.hidden = items.length === 0;
    openUpdateBtn.textContent = isNewer ? "Get update" : "Open repo";
    openUpdateBtn.onclick = () => openUrl(updateUrl);
    dismissUpdateBtn.hidden = !isNewer;
    dismissUpdateBtn.onclick = () => {
        storageSet({ dismissedUpdateVersion: latestVersion }, () => {
            updateCard.hidden = true;
        });
    };
}

async function checkForUpdates() {
    try {
        const stored = await storageGetAsync({ dismissedUpdateVersion: "" });
        const dismissedUpdateVersion = String(stored.dismissedUpdateVersion || "");
        const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
            cache: "no-store",
            headers: { accept: "application/json" }
        });
        if (!res.ok) return;
        const update = decodeUpdatePayload(await res.json());
        const latestVersion = String(update.version || "");
        if (!latestVersion) return;
        const isNewer = compareVersions(latestVersion, CURRENT_VERSION) > 0;
        if (isNewer && dismissedUpdateVersion !== latestVersion) {
            renderUpdateCard(update, true);
        } else if (!isNewer) {
            renderUpdateCard(update, false);
        }
    } catch {
        updateCard.hidden = true;
    }
}

hubInput.addEventListener('input', () => {
    clearTimeout(hubTimer);
    hubTimer = setTimeout(() => {
        saveHubUrl(hubInput.value);
    }, 250);
});

function scheduleLicenseSave() {
    clearTimeout(licenseTimer);
    licenseTimer = setTimeout(() => saveLicenseSettings(), 250);
}

licenseKeyInput.addEventListener('input', scheduleLicenseSave);

localRelayBtn.addEventListener('click', () => selectMode("local", "Local relay selected"));
hostedRelayBtn.addEventListener('click', () => selectMode("hosted", "Hosted relay selected"));

storageGet({ hubUrl: "", licenseKey: "" }, (stored) => {
    licenseKeyInput.value = stored.licenseKey || "";
    if (isLocalRelayUrl(stored.hubUrl || "")) {
        hubInput.value = stored.hubUrl;
        selectMode("local");
        return;
    }
    hubInput.value = HOSTED_NATIVE_RELAY;
    selectMode("hosted");
});

checkForUpdates();

let lightMode = localStorage.getItem('theme')
if (lightMode==='true') {
    lightMode=true;
    lightModeToggle.click();
    (async function () {
        const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        extensionApi.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                localStorage.setItem("theme", 'light');
                document.documentElement.setAttribute('theme', 'light');
            },
        });
    })();
}
lightModeToggle.onclick = async function () {
    lightMode = !lightMode
    localStorage.setItem("theme", lightMode);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0];

    if (lightMode) {
        extensionApi.scripting.executeScript({
            target: { tabId: tabId.id },
            func: () => {
                localStorage.setItem("theme", 'light');
                document.documentElement.setAttribute('theme', 'light');
            },
        });
    } else {
        extensionApi.scripting.executeScript({
            target: { tabId: tabId.id },
            func: () => {
                localStorage.setItem("theme", 'dark');
                document.documentElement.removeAttribute('theme');
            },
        });
    }

}
