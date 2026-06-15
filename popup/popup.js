//Made by Inuk
const extensionApi = globalThis.chrome || globalThis.browser;
let lightModeToggle = document.getElementById('lightMode')
let hubInput = document.getElementById('hubUrl')
let hubStatus = document.getElementById('hubStatus')
let localRelayBtn = document.getElementById('localRelayBtn')

const LOCAL_NATIVE_RELAY = "ws://127.0.0.1:27822/ws";

function storageGet(defaults, cb) {
    const result = extensionApi.storage.sync.get(defaults, cb);
    if (result && typeof result.then === 'function') result.then(cb);
}

function storageSet(value, cb) {
    const result = extensionApi.storage.sync.set(value, cb);
    if (result && typeof result.then === 'function') result.then(cb);
}

let hubTimer = null;
function saveHubUrl(value, label = "Saved") {
    const normalized = value.trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    hubInput.value = normalized;
    storageSet({ hubUrl: normalized }, () => {
        hubStatus.textContent = normalized ? label : "Browser multiplayer hub disabled";
        setTimeout(() => hubStatus.textContent = "", 1600);
    });
}

hubInput.addEventListener('input', () => {
    clearTimeout(hubTimer);
    hubTimer = setTimeout(() => {
        saveHubUrl(hubInput.value);
    }, 250);
});

localRelayBtn.addEventListener('click', () => saveHubUrl(LOCAL_NATIVE_RELAY, "Local relay selected"));

storageGet({ hubUrl: "" }, (stored) => {
    if (stored.hubUrl) {
        hubInput.value = stored.hubUrl;
        return;
    }
    saveHubUrl(LOCAL_NATIVE_RELAY, "Local relay selected");
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
