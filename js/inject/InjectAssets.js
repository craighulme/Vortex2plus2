//Made by inuk
const importedAssets = {
    stud: chrome.runtime.getURL("img/textures/stud.png"),
    studNormal: chrome.runtime.getURL("img/textures/studNormal.png"),

    swordMdl: chrome.runtime.getURL("files/meshes/sword/swordMdl.fbx"),

    swordSlash: chrome.runtime.getURL("files/sounds/swordSlash.mp3"),
    placeBlock: chrome.runtime.getURL("files/sounds/placeBlock.mp3"),
    sfothSong: chrome.runtime.getURL("files/sounds/sfothSong.mp3"),
    buildSong: chrome.runtime.getURL("files/sounds/buildSong.mp3"),

    oofSound: chrome.runtime.getURL("files/sounds/oof.mp3"),

    mapdata: {
        PARTYexe: chrome.runtime.getURL("files/mapdata/PARTY-exe.json"),
        BuildingPlace: chrome.runtime.getURL("files/mapdata/BuildingPlace.json"),
        Crossroads: chrome.runtime.getURL("files/mapdata/Crossroads.json"),
        SFBaseplate: chrome.runtime.getURL("files/mapdata/SFBaseplate.json"),
        SFOTH: chrome.runtime.getURL("files/mapdata/SFOTH.json"),
    },

    imgdata: {
        banners: {
            buildingplace: chrome.runtime.getURL("img/games/website/banners/buildingplace.jpeg"),
            crossroads: chrome.runtime.getURL("img/games/website/banners/crossroads.jpeg"),
            partyexe: chrome.runtime.getURL("img/games/website/banners/party-exe.webp"),
            sfoth: chrome.runtime.getURL("img/games/website/banners/sfoth.webp"),
            swordfightingbaseplate: chrome.runtime.getURL("img/games/website/banners/swordfightingbaseplate.png"),
            baseplate: chrome.runtime.getURL("img/games/website/banners/baseplate.png")
        },

        icons: {
            buildingplace: chrome.runtime.getURL("img/games/website/icons/buildingplace.png"),
            crossroads: chrome.runtime.getURL("img/games/website/icons/crossroads.png"),
            partyexe: chrome.runtime.getURL("img/games/website/icons/party-exe.png"),
            sfoth: chrome.runtime.getURL("img/games/website/icons/sfoth.webp"),
            swordfightingbaseplate: chrome.runtime.getURL("img/games/website/icons/swordfightingbaseplate.png"),
            baseplate: chrome.runtime.getURL("img/games/website/icons/baseplate.png")
        }
    }
};

const meta = document.createElement("meta");
meta.id = "_importedAssets";
meta.name = "_importedAssets";
meta.content = JSON.stringify(importedAssets);
document.documentElement.appendChild(meta)