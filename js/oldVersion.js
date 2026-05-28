console.log('test')
var url_string = document.URL;
var url = new URL(url_string);
var play = url.searchParams.get("Play");
if (play) {
    console.log('play')

    async function init() {
        const html = await fetch(
            chrome.runtime.getURL("overrides/play.html")
        ).then(r => r.text());
        document.open();
        document.write(html);
        document.close();
        //import assets moved to here
        const importedAssets = {
            stud: chrome.runtime.getURL("img/textures/stud.png"),
            studNormal: chrome.runtime.getURL("img/textures/studNormal.png"),

            swordMdl: chrome.runtime.getURL("mdl/swordMdl.fbx"),

            swordSlash: chrome.runtime.getURL("sounds/swordSlash.mp3"),
            placeBlock: chrome.runtime.getURL("sounds/placeBlock.mp3"),
            sfothSong: chrome.runtime.getURL("sounds/sfothSong.mp3"),
            buildSong: chrome.runtime.getURL("sounds/buildSong.mp3"),

            oofSound: chrome.runtime.getURL("sounds/oof.mp3")
        };

        const meta = document.createElement("meta");
        meta.id = "_importedAssets";
        meta.name = "_importedAssets";
        meta.content = JSON.stringify(importedAssets);
        document.documentElement.appendChild(meta)
    }
    init();
}