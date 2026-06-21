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

const LOCAL_NATIVE_RELAY = "ws://127.0.0.1:27822/ws";
const HOSTED_NATIVE_RELAY = "wss://v22-relay.116.203.155.30.sslip.io/ws";
const HOSTED_LICENSE_API = "https://v22.irongiant.vip";

function storageGet(defaults, cb) {
    const result = extensionApi.storage.sync.get(defaults, cb);
    if (result && typeof result.then === 'function') result.then(cb);
}

function storageSet(value, cb) {
    const result = extensionApi.storage.sync.set(value, cb);
    if (result && typeof result.then === 'function') result.then(cb);
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
