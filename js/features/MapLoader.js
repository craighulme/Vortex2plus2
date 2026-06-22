let mapsLoaded = []
const deg2rad = 0.0174532925;
function normalizeMapColor(c) {
    if (Array.isArray(c)) {
        return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
    }
    if (typeof c === "number") return c;
    return Number("0x" + String(c || "808080").replace(/^#/, ""));
}

function loadMapRaw(name, r, tx=0, ty=1.6, tz=0, options = {}) {
    let mapData = typeof r == "string" ? JSON.parse(r) : r;
    const rotationScale = options.rotationRadians ? 1 : deg2rad;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let minPX = Infinity, minPY = Infinity, minPZ = Infinity;
    let maxPX = -Infinity, maxPY = -Infinity, maxPZ = -Infinity;
    for (let i = 0; i < mapData.length; i++) {
        let v = mapData[i]
        const [px, py, pz] = v.P ? v.P : v.Position;
        const [sx, sy, sz] = v.S ? v.S : v.Size;
        minPX = Math.min(minPX, px); maxPX = Math.max(maxPX, px);
        minPY = Math.min(minPY, py); maxPY = Math.max(maxPY, py);
        minPZ = Math.min(minPZ, pz); maxPZ = Math.max(maxPZ, pz);
        minX = Math.min(minX, px - sx / 2); maxX = Math.max(maxX, px + sx / 2);
        minY = Math.min(minY, py - sy / 2); maxY = Math.max(maxY, py + sy / 2);
        minZ = Math.min(minZ, pz - sz / 2); maxZ = Math.max(maxZ, pz + sz / 2);
    }
    const preserveWorldCoords = !!options.preserveWorldCoords;
    const ox = preserveWorldCoords ? 0 : tx - (minPX + maxPX) / 2;
    const oy = preserveWorldCoords ? 0 : ty - minPY;
    const oz = preserveWorldCoords ? 0 : tz - (minPZ + maxPZ) / 2;
    const bounds = {
        minX: minX + ox, maxX: maxX + ox,
        minY: minY + oy, maxY: maxY + oy,
        minZ: minZ + oz, maxZ: maxZ + oz,
        centerX: (minX + maxX) / 2 + ox,
        centerY: (minY + maxY) / 2 + oy,
        centerZ: (minZ + maxZ) / 2 + oz,
    };
    mapsLoaded[name] = {studs:[],meshes:[],bounds}
    for (let i = 0; i < mapData.length; i++) {
        let v = mapData[i]
        let s = v.Size ?? v.S;
        let p = v.P ?? v.Position;
        let r = v.R ?? v.Rotation ?? [0, 0, 0];
        let c = v.C ?? v.Color ?? "808080";
        let transp = v.Tr ?? v.Transparency ?? 0;
        let sh = v.Sh || v.Shape || "Block";
        let canCollide = !v.CantCollide;
        const rx = r[0] * rotationScale;
        const ry = r[1] * rotationScale;
        const rz = r[2] * rotationScale;
        let [mesh, stud_id] = addStud(s[0], s[1], s[2], normalizeMapColor(c), p[0] + ox, p[1] - s[1] * 0.5 + oy, p[2] + oz, rx, ry, rz, sh, transp, true, canCollide, options.rotationOrder)
        if (options.rotationOrder && mesh.rotation.order !== options.rotationOrder) {
            mesh.rotation.order = options.rotationOrder;
            mesh.rotation.set(rx, ry, rz);
            mesh.updateMatrix();
        }
        mapsLoaded[name].studs.push(stud_id);
        mapsLoaded[name].meshes.push(mesh);
    }
    const geometries = new Map();
    const materials = new Map();
    for (let i = 0; i < mapsLoaded[name].meshes.length; i++) {
        let mesh = mapsLoaded[name].meshes[i];
        let key = mesh.material.uuid;
        mesh.updateMatrix();
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrix);

        if (!materials.has(key)) {
            materials.set(key, mesh.material);
            geometries.set(key, [geo]);
        } else {
            geometries.set(key, [...geometries.get(key), geo]);
        }
    }
    mapsLoaded[name].meshes=[];
    geometries.forEach((value, key) => {
        const merged = THREE.BufferGeometryUtils.mergeGeometries(value);
        const mergedMesh = new THREE.Mesh(merged, materials.get(key));
        mergedMesh.castShadow=true;
        mergedMesh.receiveShadow=true;
        scene.add(mergedMesh);
        objects.push(mergedMesh);
        mapsLoaded[name].meshes=[...mapsLoaded[name].meshes,mergedMesh];
    })
    mapsLoaded[name].translation = preserveWorldCoords ? [0, 0, 0] : [ox+tx,oy+ty,oz+tz];
    return mapsLoaded[name];
}
async function loadMapUrl(name, url, tx=0, ty=1.6, tz=0, options = {}) {
    if (!url) return
    let f = await fetch(url)
    let mapData = await f.json()
    return loadMapRaw(name,mapData,tx,ty,tz,options);
}

async function loadMapData(name, asset, tx=0, ty=1.6, tz=0) {
    let f = await fetch(importedAssets.mapdata[asset])
    let r = await f.text()
    let mapData = JSON.parse(r)
    return loadMapRaw(name,mapData,tx,ty,tz);
}

async function loadOfficialVortexMap(gameId) {
    const name = `Official Vortex ${gameId}`;
    const res = await fetch(`/api/maps/${encodeURIComponent(gameId)}`, {
        credentials: "include",
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`official map fetch failed: HTTP ${res.status}`);
    const mapData = await res.json();
    const rotationRadians = officialMapUsesRadians(mapData);
    const loaded = loadMapRaw(name, mapData, 0, 0, 0, {
        preserveWorldCoords: true,
        rotationRadians,
        rotationOrder: "XYZ",
    });
    const b = loaded.bounds;
    const spawn = {
        x: b.centerX,
        y: b.maxY + 8,
        z: b.centerZ,
    };
    window.map = {
        name,
        officialGameId: gameId,
        spawnPoints: [[spawn.x, spawn.y, spawn.z]],
    };
    window._vortex.setSpawn(spawn.x, spawn.y, spawn.z, 0);
    console.info(`loaded official Vortex map ${gameId}`, {
        parts: mapData.length,
        bounds: b,
        spawn,
        rotationRadians,
    });
    return loaded;
}

function officialMapUsesRadians(mapData) {
    for (const part of mapData) {
        const r = part.R ?? part.Rotation;
        if (!Array.isArray(r)) continue;
        for (const value of r) {
            if (Math.abs(Number(value) || 0) > Math.PI * 2 + 0.001) return false;
        }
    }
    return true;
}

function unloadMap(name) {
    if (mapsLoaded[name]) {
        for (let i = 0; i < mapsLoaded[name].studs.length; i++) {
            let stud_id = mapsLoaded[name].studs[i]
            removeStud(stud_id);
        }
        for (let i = 0; i < mapsLoaded[name].meshes.length; i++) {
            let mesh = mapsLoaded[name].meshes[i];
            removeMatching_array(objects,mesh);
            scene.remove(mesh);
        }
    }
}

const maps = [
    {
        name: "Crossroads",
        url: "window._importedAssets.Crossroads",
        picture: "window._importedAssets.crossroads",
        bannerpicture: "window._importedAssets.crossroads",
        description: "Classic Roblox Crossroads map!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -1,

        spawnPoints: [[17, 100, 0]],

        SWORD_FIGHT: true,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "Sword Fights on the Heights",
        url: "window._importedAssets.SFOTH",
        picture: "window._importedAssets.sfoth",
        bannerpicture: "window._importedAssets.sfoth",
        description: "Classic Roblox Sword Fights on the Heights map, with sword system made by Inuk!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -2,

        spawnPoints: [[172.28240966796876,368.3000183105469,-1657.9500732421876],[132.28240966796876,368.3000183105469,-1453.9500732421876],[-44.71759796142578,304.7000732421875,-1715.9500732421876],[71.28240203857422,534.300048828125,-1569.9500732421876],[-142.71759033203126,301.1000061035156,-1623.9500732421876],[-5.717597961425781,315.5000305175781,-1490.9500732421876],[223.28240966796876,165.50001525878907,-1428.9500732421876],[58.28240203857422,275.9000244140625,-1717.9500732421876],[-402.71759033203127,415.1000061035156,-1520.9500732421876],[-402.71759033203127,415.1000061035156,-1457.9500732421876],[-52.71759796142578,304.7000427246094,-1723.9500732421876],[192.28240966796876,165.5,-1399.9500732421876],[69.28240203857422,275.9000244140625,-1371.9500732421876],[-134.71759033203126,368.3000183105469,-1714.9500732421876],[125.28240203857422,662.2999877929688,-1875.9500732421876],[401.28240966796877,43.100006103515628,-1444.9500732421876],[124.28240203857422,535.1000366210938,-1858.9500732421876],[393.28240966796877,43.100006103515628,-1444.9500732421876],[194.28240966796876,718.7000732421875,-1408.9500732421876],[53.28240203857422,184.70001220703126,-1354.9500732421876],[-22.71759796142578,69.5,-1381.9500732421876],[125.28240203857422,662.2999877929688,-1883.9500732421876],[43.28240203857422,275.9000244140625,-1543.9500732421876],[43.28240203857422,275.9000244140625,-1595.9500732421876],[95.28240203857422,275.9000244140625,-1543.9500732421876],[-140.71759033203126,86.29998779296875,-1331.9500732421876],[90.28240203857422,69.5,-1455.9500732421876],[216.28240966796876,247.10000610351563,-1510.9500732421876],[154.28240966796876,368.3000183105469,-1716.9500732421876],[95.28240203857422,275.9000244140625,-1595.9500732421876]],

        skyColor: 0xFFB540,

        SWORD_FIGHT: true,
        VOID_DIE: true,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "Sword pvp baseplate",
        url: "window._importedAssets.SFBaseplate",
        picture: "window._importedAssets.swordfightingbaseplate",
        bannerpicture: "window._importedAssets.swordfightingbaseplate",
        description: "Custom made simple pvp map by Inuk",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -3,

        spawnPoints: [[10, 10, 10], [-10, 10, 10], [10, 10, -10], [-10, 10, -10]],

        skyColor: 0xA00000,

        SWORD_FIGHT: true,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "Vortex2+2 Building game",
        url: "window._importedAssets.BuildingPlace",
        picture: "window._importedAssets.buildingplace",
        bannerpicture: "window._importedAssets.buildingplace",
        description: "Custom made game building game with autosave and multiplayer support!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -4,

        spawnPoints: [[10, 10, 10], [-10, 10, 10], [10, 10, -10], [-10, 10, -10]],


        BUILD_MODE: true,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "Glass Houses",
        url: "window._importedAssets.Glasshouses",
        picture: "window._importedAssets.Glasshouses",
        bannerpicture: "window._importedAssets.Glasshouses",
        description: "Battle it out with friends in this classic destructible environment! (not actually destructible)",
        creatorName: "Streety",
        creatorId: 6837,
        gameId: -7,

        SWORD_FIGHT: true,
        REMOVE_BASEPLATE: true,
    },

    {
        name: "PARTY.exe",
        url: "window._importedAssets.PARTYexe",
        picture: "window._importedAssets.partyexe",
        bannerpicture: "window._importedAssets.partyexe",
        description: "Simple testing game made by exelerantt to test out his vortex 2+2 addon.",
        creatorName: "exelerantt",
        creatorId: 2162,
        gameId: -5,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "Baseplate",
        url: "window._importedAssets.Baseplate",
        picture: "window._importedAssets.baseplate",
        bannerpicture: "window._importedAssets.baseplate",
        description: "Just your average baseplate.",
        creatorName: "exelerantt",
        creatorId: 2162,
        gameId: -6,

        REMOVE_BASEPLATE: true,
    },

    {
        name: "NDS",
        url: "window._importedAssets.NDS",
        picture: "window._importedAssets.NDS",
        bannerpicture: "window._importedAssets.NDS",
        description: "Just your average natural disaster survival.",
        creatorName: "inuk",
        creatorId: 1961,
        gameId: -8,
        spawnPoints: [[-1602.02, 177.215, 367.537]],
        ty:-11,
        REMOVE_BASEPLATE: true,
    },
];

function defSpawnPoint() {
    let cx = 0;
    let cy = 10;
    let cz = 0;
    return { x: cx, y: cy, z: cz }
}
function chooseSpawnPoint(m) {
    if (!m || !m.spawnPoints) return defSpawnPoint()
    let entry = m.spawnPoints[Math.round(Math.random() * (m.spawnPoints.length - 1))]
    let cx = entry[0]
    let cy = entry[1]
    let cz = entry[2]
    let mn = m.name;
    let mloaded = mapsLoaded[mn]
    if(mloaded){
        cx+=mloaded.translation[0]
        cy+=mloaded.translation[1]
        cz+=mloaded.translation[2]
    }
    return { x: cx, y: cy, z: cz }
}

window.chooseSpawnPoint = chooseSpawnPoint;

(function () {
    var url_string = document.URL;
    var url = new URL(url_string);
    var gamei = url.searchParams.get("V22GameId");
    var officialGameId = parseInt(url.searchParams.get("VortexGameId") || "0", 10);
    if (gamei) {
        let map = maps[gamei]
        window.map = map;
        let gameid = map.gameId
        if (map.SWORD_FIGHT) {
            window.SWORD_FIGHT = true;
        }
        if (map.VOID_DIE) {
            window.VOID_DIE = true;
        }
        if (map.BUILD_MODE) {
            window.BUILD_MODE = true;
        }
        if (map.REMOVE_BASEPLATE) {
            window.REMOVE_BASEPLATE = true;
        }
        const s = document.createElement("script");
        Object.defineProperty(window, "GAME_ID", {
            value: gameid,
            writable: false,
            configurable: false
        });
        console.info(`game id set to ${gameid}`);
    } else if (officialGameId > 0) {
        window.map = {
            name: `Official Vortex ${officialGameId}`,
            officialGameId,
            spawnPoints: [[0, 10, 0]],
        };
        Object.defineProperty(window, "GAME_ID", {
            value: officialGameId,
            writable: false,
            configurable: false
        });
        console.info(`official game id set to ${officialGameId}`);
    } else {
        window.map = false;
    }
    console.info('set window map data')
})();

async function importMapAssets() {
    let mapsLen = maps.length;
    for (let i = 0; i < mapsLen; i++) {
        let map = maps[i]
        if (map.url) {
            while (!window.importedAssets) {
                let el = document.getElementById("_importedAssets"); if (el) {
                    window.importedAssets = JSON.parse(el.content);
                }
                else {
                    await new Promise(r => setTimeout(r, 50));
                }
            }
            if (map.url.startsWith("window.")) {
                maps[i].url = importedAssets.mapdata[map.url.split(".")[2]]
            }
        }
    };
}

async function initialize() {
    var url_string = document.URL;
    var url = new URL(url_string);
    var gamei = url.searchParams.get("V22GameId");
    var play = url.searchParams.get("Play");
    await importMapAssets();
    if (document.location.pathname == '/home' || document.location.pathname == '/social' || document.location.pathname == '/search') {
        let f = await fetch('/api/game-stats')
        let gameStats = await f.json()
        async function waitForGamesLoaded() {
            if (document.getElementById('games-grid').children.length > 0) {
                for (let i = 0; i < maps.length; i++) {
                    let map = maps[i]
                    let gameId = map.gameId

                    let main = document.createElement('a');
                    main.className = 'game-card'
                    main.href = '/games/1?V22GameId=' + i
                    let thumb = document.createElement('div')
                    thumb.className = 'game-card-thumb'
                    main.appendChild(thumb)
                    let gcbody = document.createElement('div')
                    gcbody.className = 'game-card-body'
                    main.appendChild(gcbody)
                    let gctitle = document.createElement('div')
                    gctitle.className = 'game-card-title'
                    gcbody.appendChild(gctitle)
                    gctitle.innerHTML = '[2+2] ' + map.name
                    let gcmeta = document.createElement('div')
                    gcmeta.className = 'game-card-meta'
                    gcbody.appendChild(gcmeta)
                    let active = 0
                    if (gameStats[gameId]) {
                        active = gameStats[gameId].active
                    }
                    gcmeta.innerHTML = active + ' Playing'
                    if (map.picture) {
                        while (!window.importedAssets) { let el = document.getElementById("_importedAssets"); if (el) window.importedAssets = JSON.parse(el.content); else await new Promise(r => setTimeout(r, 50)); }

                        if (map.picture.startsWith("window.")) {
                            map.picture = importedAssets.imgdata.icons[map.picture.split(".")[2]]
                        }

                        let gcpic = document.createElement('img')
                        gcpic.alt = map.name
                        gcpic.src = map.picture
                        thumb.appendChild(gcpic)
                    }
                    document.getElementById('games-grid').appendChild(main);
                };
                return
            } else {
                setTimeout(() => {
                    waitForGamesLoaded()
                }, 100);
            }
        }
        waitForGamesLoaded();
    } else if (document.location.pathname == '/games/1' && !play) {
        var url_string = document.URL;
        var url = new URL(url_string);
        var gamei = url.searchParams.get("V22GameId");
        if (gamei) {
            let f = await fetch('/api/game-stats')
            let gameStats = await f.json()
            let map = maps[gamei]
            let gameId = map.gameId
            let active = 0
            let visits = 0
            let creatorName = map.creatorName
            let creatorId = map.creatorId
            let picture = map.bannerpicture

            while (!window.importedAssets) { let el = document.getElementById("_importedAssets"); if (el) window.importedAssets = JSON.parse(el.content); else await new Promise(r => setTimeout(r, 50)); }

            if (picture.startsWith("window.")) {
                picture = importedAssets.imgdata.banners[picture.split(".")[2]]
            }

            if (gameStats[gameId]) {
                active = gameStats[gameId].active
                visits = gameStats[gameId].visits
            }
            function formatNumber(n) {
                if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
                if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
                return String(n);
            }
            const page = document.getElementById('page');
            let txt = `
                        <div class="game-banner">
                            <img src="${picture}" alt="${map.name}">
                        </div>

                        <div class="game-detail-header">
                            <div class="game-detail-info">
                                <div class="game-detail-title">${map.name}</div>
                                <div class="game-detail-creator">By <a href="/users/${map.creatorId}/profile" style="color:inherit;">${map.creatorName}</a></div>
                                <div class="game-detail-stats">
                                    <div class="game-stat">
                                        <span class="game-stat-value" id="stat-active">${formatNumber(active)}</span>
                                        <span class="game-stat-label">Playing</span>
                                    </div>
                                    <div class="game-stat">
                                        <span class="game-stat-value">${formatNumber(visits)}</span>
                                        <span class="game-stat-label">Visits</span>
                                    </div>
                                </div>
                            </div>
                            <a class="btn-play" href="https://vortex.towerstats.com/games/1?Play=1&V22GameId=${gamei}">Play</a>
                        </div>

                        <div class="game-description-box">
                            <div class="game-description-label">About</div>
                            <div class="game-description-text">${map.description}</div>
                        </div>
                    </div>
            `;
            page.innerHTML = txt;
            Object.defineProperty(page, "innerHTML", {
                value: txt,
                writable: false,
                configurable: false
            });
        }
    } else {

        var url_string = document.URL;
        var url = new URL(url_string);
        var gamei = url.searchParams.get("V22GameId");
        var officialGameId = parseInt(url.searchParams.get("VortexGameId") || "0", 10);
        let tmap
        if (gamei) {
            tmap = maps[gamei]
            if (tmap.gameId != 1) {
                await loadMapUrl(tmap.name, tmap.url, tmap.tx ? tmap.tx : 0, tmap.ty ? tmap.ty : 1.6, tmap.tz ? tmap.tz : 0)
                let spawn = window.chooseSpawnPoint(tmap)
                window._vortex.setSpawn(spawn.x, spawn.y, spawn.z, 0);
                if (!tmap.REMOVE_BASEPLATE) {
                    const ground = new THREE.Mesh(
                        getCachedGeo(320, 3.2, 320),
                        getCachedMats(320, 3.2, 320, 0x4db84b)
                    );
                    ground.receiveShadow = true;
                    scene.add(ground);
                }

                if (tmap.skyColor) {
                    scene.fog = new THREE.Fog(tmap.skyColor, 192, 480);
                    renderer.setClearColor(tmap.skyColor);
                    backLight.color = new THREE.Color(tmap.skyColor);
                    scene.fog.color = new THREE.Color(tmap.skyColor);
                    ambient.color = new THREE.Color(tmap.skyColor);
                }
            }
        } else if (officialGameId > 0) {
            try {
                await loadOfficialVortexMap(officialGameId);
            } catch (err) {
                console.warn(`Failed to load official Vortex map ${officialGameId}`, err);
                if (typeof Chat !== "undefined") {
                    Chat.system(`Could not load official map ${officialGameId}; using fallback baseplate.`);
                }
                const ground = new THREE.Mesh(
                    getCachedGeo(320, 3.2, 320),
                    getCachedMats(320, 3.2, 320, 0x4db84b)
                );
                ground.receiveShadow = true;
                scene.add(ground);
                window._vortex.setSpawn(0, 10, 0, 0);
            }
        }

        const panel = document.createElement('div');
        panel.id = "maps-loader-panel";

        Object.assign(panel.style, {
            position: "fixed",
            bottom: "12px",
            right: "12px",
            width: "160px",
            background: "rgba(18, 18, 26, 0.95)",
            borderRadius: "8px",
            padding: "12px",
            zIndex: "300",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
        });

        const title = document.createElement('div');
        title.textContent = "Vortex 2+2 Maps";
        Object.assign(title.style, {
            fontSize: "14px",
            fontWeight: "700",
            color: "#fff",
            width: '100%',
            height: '30px'
        });
        panel.appendChild(title);

        function styleBtn(btn, type = "default") {
            Object.assign(btn.style, {
                padding: "6px 10px",
                border: "none",
                borderRadius: "5px",
                fontSize: "12px",
                fontFamily: "inherit",
                fontWeight: "600",
                cursor: "pointer",
                textAlign: "center",
                background: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)"
            });

            if (type === "primary") {
                btn.style.background = "#2563EB";
                btn.style.color = "#fff";
                btn.onmouseenter = () => btn.style.background = "#1d4ed8";
                btn.onmouseleave = () => btn.style.background = "#2563EB";
            }
        }
        let collapsibles = {};
        let ci = 0;
        maps.forEach(map => {
            const btn = document.createElement('button');
            btn.innerHTML = map.name + '(Not loaded)';
            styleBtn(btn);
            let loaded = false;
            if (map === tmap) {
                btn.innerHTML = map.name + '(Loaded)'
                loaded = true
            }
            btn.onclick = async function(){
                if (loaded) {
                    unloadMap(map.name)
                    btn.innerHTML = map.name + '(Not loaded)'
                    loaded = false
                } else {
                    if (map.url && map.url.startsWith("window.")) {
                        await loadMapData(map.name, map.url.split(".")[2])
                    } else {
                        await loadMapUrl(map.name, map.url)
                    }
                    let spawn = window.chooseSpawnPoint(map)
                    window._vortex.setSpawn(spawn.x, spawn.y, spawn.z, 0);
                    btn.innerHTML = map.name + '(Loaded)'
                    loaded = true
                }
            };
            collapsibles[ci] = btn;
            ci++;
            renderer.domElement.addEventListener('click', () => {
                if (locked) {
                    if (_cursorOver(btn)) {
                        btn.click();
                    }
                }
            });

            panel.appendChild(btn);
        });

        const input = document.createElement('input');
        input.placeholder = "Custom URL...";
        Object.assign(input.style, {
            padding: "6px",
            borderRadius: "5px",
            border: "none",
            fontSize: "12px",
            outline: "none",
            background: "rgba(255,255,255,0.08)",
            color: "#fff"
        });
        collapsibles[ci] = input;
        ci++;

        panel.appendChild(input);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = "Load URL/JSON";
        collapsibles[ci] = loadBtn;
        ci++;

        styleBtn(loadBtn, "primary");

        loadBtn.onclick = () => {
            const url = input.value.trim();
            if (!url) return;
            if (url.startsWith('https://')) {
                loadMapUrl("Custom", url);
            } else {
                loadMapRaw("Custom", url);
            }

        };

        panel.appendChild(loadBtn);

        title.onclick = function () {
            for (let i = 0; i < ci; i++) {
                collapsibles[i].style.display = collapsibles[i].style.display == 'none' ? 'block' : 'none'
            }
        }
        renderer.domElement.addEventListener('click', () => {
            if (_cursorOver(title)) {
                for (let i = 0; i < ci; i++) {
                    collapsibles[i].style.display = collapsibles[i].style.display == 'none' ? 'block' : 'none'
                }
            }
        })

        for (let i = 0; i < ci; i++) {
            collapsibles[i].style.display = 'none'
        }

        document.body.appendChild(panel);
    }
}

function mapLoaderReady() {
    return typeof window.addStud === "function" &&
        typeof window.removeStud === "function" &&
        typeof window.getCachedGeo === "function" &&
        typeof window.getCachedMats === "function" &&
        typeof window.removeMatching_array === "function" &&
        typeof window.THREE !== "undefined" &&
        !!window.THREE.BufferGeometryUtils &&
        typeof window._vortex?.setSpawn === "function" &&
        typeof window.scene !== "undefined" &&
        typeof window.renderer !== "undefined" &&
        Array.isArray(window.objects);
}

function bootMapLoader(attempt = 0) {
    if (window.__v22MapLoaderBooted) return;
    if (!mapLoaderReady()) {
        if (attempt === 0) console.info('waiting for Vortex engine before map loader');
        if (attempt > 200) {
            console.warn('map loader could not start: Vortex engine globals were not ready');
            return;
        }
        setTimeout(() => bootMapLoader(attempt + 1), 50);
        return;
    }
    window.__v22MapLoaderBooted = true;
    console.info('initializing map loader');
    initialize().catch(err => {
        window.__v22MapLoaderBooted = false;
        console.warn('map loader initialization failed', err);
    })

    let watermark = document.createElement('a')
    watermark.innerHTML = 'Vortex2+2 v0.4.0 by @inuk'
    Object.assign(watermark.style, {
        position: 'fixed',
        bottom: '5px',
        left: '5px',
        color: 'white',
        fontSize: 'x-small',
        opacity: '0.1',
    })
    document.body.appendChild(watermark)
    let vortexprimary = document.getElementsByClassName('navbar-logo')[0];
    if (!vortexprimary) vortexprimary = document.getElementsByClassName('logo')[0]
    if (!vortexprimary) return;
    let vortexsecondary = vortexprimary.cloneNode()
    vortexsecondary.className = 'navbar-logo navbar-logo-secondary'
    vortexsecondary.innerHTML = ' 2+2'
    vortexprimary.appendChild(vortexsecondary)
}

if (document.readyState === "loading") {
    window.addEventListener("load", bootMapLoader, { once: true });
} else {
    bootMapLoader();
}
