//Made by inuk
const importedAssets = {
    stud: chrome.runtime.getURL("img/textures/stud.png"),
    studNormal: chrome.runtime.getURL("img/textures/studNormal.png"),

    swordMdl: chrome.runtime.getURL("mdl/swordMdl.fbx"),

    swordSlash: chrome.runtime.getURL("sounds/swordSlash.mp3"),

    sfothSong: chrome.runtime.getURL("sounds/sfothSong.mp3"),

    oofSound: chrome.runtime.getURL("sounds/oof.mp3")
};

const meta = document.createElement("meta");
meta.id = "_importedAssets";
meta.name = "_importedAssets";
meta.content = JSON.stringify(importedAssets);
document.documentElement.appendChild(meta)
let scripts = document.createElement('div');
function loadScript(src, onDone) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = onDone;
    s.onerror = () => console.error("Failed:", src);
    scripts.appendChild(s);
    return s;
}

function start() {
    const url = new URL(document.URL);
    const gamei = url.searchParams.get("VPlusGameId");
    document.body.prepend(scripts)
    if (!gamei && url.pathname == '/demo') {
        loadScript(chrome.runtime.getURL("overrides/demoparts.js"));
    }
}



if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}