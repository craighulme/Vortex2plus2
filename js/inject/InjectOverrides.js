//Made by inuk
const textures = {
    white: chrome.runtime.getURL("img/textures/white.jpeg"),
    stud: chrome.runtime.getURL("img/textures/stud.png"),
    studNormal: chrome.runtime.getURL("img/textures/studNormal.png")
};

const meta = document.createElement("meta");
meta.id = "_textures";
meta.name = "_textures";
meta.content = JSON.stringify(textures);

function loadScript(src, onDone) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = onDone;
    s.onerror = () => console.error("Failed:", src);
    document.body.appendChild(s);
    return s;
}

function start() {
    const url = new URL(document.URL);
    const gamei = url.searchParams.get("VPlusGameId");
    document.documentElement.appendChild(meta)
    loadScript(chrome.runtime.getURL("overrides/vortex2+2-engine.js"), () => {
        loadScript(chrome.runtime.getURL("overrides/vortex2+2-multiplayer.js"), () => {
            if (!gamei) {
                loadScript(chrome.runtime.getURL("js/demoparts.js"));
            }
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}