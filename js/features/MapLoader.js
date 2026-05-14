//Made by inuk
//this script is responsible for loading custom maps and games

let mapsLoaded = []

async function loadMapUrl(name, url) {
    console.log("Loading map:", name, url);
    let f = await fetch('https://cors.io/?url=' + url)
    let r = await f.json()
    let mapData = JSON.parse(r.body)
    let deg2rad = 0.0174532925;
    mapsLoaded[name] = []
    for (let i = 0; i < mapData.length; i++) {
        let v = mapData[i]
        let mesh, _ = addStud(v.S[0], v.S[1], v.S[2], Number('0x' + v.C), v.P[0], v.P[1] - v.S[1] * 0.5, v.P[2], v.R[0] * deg2rad, v.R[1] * deg2rad, v.R[2] * deg2rad)
        mapsLoaded[name][i] = mesh
    }
}

function loadMapRaw(name, r) {
    let mapData = JSON.parse(r)
    let deg2rad = 0.0174532925;
    mapsLoaded[name] = []
    for (let i = 0; i < mapData.length; i++) {
        let v = mapData[i]
        let sx = v.S[0]
        let sy = v.S[1]
        let sz = v.S[2]
        let rx = v.R[0]
        let ry = v.R[1]
        let rz = v.R[2]
        let mesh, _ = addStud(sx, sy, sz, Number('0x' + v.C), v.P[0], v.P[1] - v.S[1] * 0.5, v.P[2], rx * deg2rad, ry * deg2rad, rz * deg2rad)
        mapsLoaded[name][i] = mesh
    }
}

function unloadMap(name) {
    if (mapsLoaded[name]) {
        for (let i = 0; i < mapsLoaded[name].length; i++) {
            let mesh = mapsLoaded[name][i]
            scene.remove(mesh)
        }
    }
}

const maps = [
    {
        name: "Crossroads",
        url: "https://pastebin.com/raw/5sRJkYLN",
        picture: "https://static.wikitide.net/arsenalwiki/d/df/Crossroads.png",
        bannerpicture: "https://i.imgur.com/pUkDxcY.jpeg",
        description: "Classic Roblox Crossroads map!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -1,

        spawnPoints: [[330, 100, 27]],

        SWORD_FIGHT: true,
    }, //added by Inuk, 6/5/2026, added a ramp to enter the map more easily

    {
        name: "Sword Fights on the Heights",
        url: "https://pastebin.com/raw/DRyzkQ7s",
        picture: "https://tr.rbxcdn.com/180DAY-4884ac5cad0006f5c02e2a7ef0903a41/256/256/Image/Webp/noFilter",
        bannerpicture: "https://static.wikia.nocookie.net/roblox/images/8/84/Sword_Fight_on_the_Heights_Original_Thumbnail.png/revision/latest?cb=20170114113709",
        description: "Classic Roblox Sword Fights on the Heights map, with sword system made by Inuk!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -2,

        spawnPoints: [[-882.333740234375, 14.200042724609375, 1286.9000244140626], [-1151.333740234375, 506.2000732421875, 872.9000244140625], [-1150.333740234375, 633.4000244140625, 855.9000244140625], [-1081.333740234375, 689.8001098632813, 1322.9000244140626], [-1150.333740234375, 633.4000244140625, 847.9000244140625], [-1320.333740234375, 275.80010986328127, 1015.9000244140625], [-874.333740234375, 14.200042724609375, 1286.9000244140626], [-1222.333740234375, 155.800048828125, 1376.9000244140626], [-1298.333740234375, 40.60003662109375, 1349.9000244140626], [-1418.333740234375, 272.2000427246094, 1107.9000244140626], [-1204.333740234375, 505.4000549316406, 1161.9000244140626], [-1281.333740234375, 286.6000671386719, 1240.9000244140626], [-1180.333740234375, 247.0000457763672, 1135.9000244140626], [-1180.333740234375, 247.0000457763672, 1187.9000244140626], [-1232.333740234375, 247.0000457763672, 1187.9000244140626], [-1232.333740234375, 247.0000457763672, 1135.9000244140626], [-1206.333740234375, 247.0000457763672, 1359.9000244140626], [-1052.333740234375, 136.6000518798828, 1302.9000244140626], [-1217.333740234375, 247.0000457763672, 1013.9000244140625], [-1328.333740234375, 275.8000793457031, 1007.9000244140625], [-1410.333740234375, 339.4000549316406, 1016.9000244140625], [-1103.333740234375, 339.4000549316406, 1073.9000244140626], [-1143.333740234375, 339.4000549316406, 1277.9000244140626], [-1083.333740234375, 136.60003662109376, 1331.9000244140626], [-1121.333740234375, 339.4000549316406, 1014.9000244140625], [-1185.333740234375, 40.60003662109375, 1275.9000244140626], [-1678.333740234375, 386.2000427246094, 1210.9000244140626], [-1678.333740234375, 386.2000427246094, 1273.9000244140626], [-1416.333740234375, 57.4000244140625, 1399.9000244140626], [-1059.333740234375, 218.20004272460938, 1220.9000244140626]],

        skyColor: 0xFFB540,

        SWORD_FIGHT: true,
        VOID_DIE: true,
    }, //added by Inuk, 9/5/2026

    {
        name: "Sword pvp baseplate",
        url: "https://pastebin.com/raw/5Kf08aWP",
        picture: "https://i.imgur.com/18tY4J2.png",
        bannerpicture: "https://i.imgur.com/mu68Bvp.png",
        description: "Custom made simple pvp map by Inuk",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -3,

        spawnPoints: [[10, 10, 10], [-10, 10, 10], [10, 10, -10], [-10, 10, -10]],

        skyColor: 0xA00000,

        SWORD_FIGHT: true,
    }, //added by Inuk, 10/5/2026

    {
        name: "Vortex2+2 Building game",
        url: "https://pastebin.com/raw/pJY1RC43",
        picture: "https://i.imgur.com/tow9wq7.png",
        bannerpicture: "https://i.imgur.com/SooHiwI.jpeg",
        description: "Custom made game building game with autosave and multiplayer support!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -4,

        spawnPoints: [[10, 10, 10], [-10, 10, 10], [10, 10, -10], [-10, 10, -10]],

        //skyColor: 0xA00000,

        BUILD_MODE: true,
    }, //added by Inuk, 10/5/2026

    {
        name: "PARTY.exe",
        url: "https://pastebin.com/raw/uWkAURvH",
        picture: "https://tr.rbxcdn.com/180DAY-0e38f156d98eb9095dc7c652caf2afcb/352/352/Image/Png/noFilter",
        bannerpicture: "https://tr.rbxcdn.com/180DAY-b87e0753f91e85fd11c55391517d676c/768/432/Image/Webp/noFilter",
        description: "Simple testing game made by exelerantt to test out his vortex 2+2 addon.",
        creatorName: "exelerantt",
        creatorId: 2162,
        gameId: -45659278, // party.exe game id XD

        spawnPoints: [[53, 60, 0]],

        VOID_DIE: true
    }, // added by exelerantt, 5/14/26 (american date)
];

function defSpawnPoint() {
    let cx = 0;
    let cy = 10;
    let cz = 0;
    return { x: cx, y: cy, z: cz }
}
function chooseSpawnPoint(m) {
    if (!m) return defSpawnPoint()
    let entry = m.spawnPoints[Math.round(Math.random() * (m.spawnPoints.length - 1))]
    let cx = entry[0]
    let cy = entry[1]
    let cz = entry[2]
    return { x: cx, y: cy, z: cz }
}

window.chooseSpawnPoint = chooseSpawnPoint;

(function () {
    var url_string = document.URL;
    var url = new URL(url_string);
    var gamei = url.searchParams.get("V22GameId");
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
        const s = document.createElement("script");
        Object.defineProperty(window, "GAME_ID", {
            value: gameid,
            writable: false,
            configurable: false
        });
        console.log(`game id set to ${gameid}`);;
    } else {
        window.map = false;
    }
    console.log('set window map data')
})();

async function initialize() {
    if (document.location.pathname == '/home' || document.location.pathname == '/social' || document.location.pathname == '/search' || document.location.pathname == '/games/2') {
        // game buttons!
        let f = await fetch('/api/game-stats')
        let gameStats = await f.json()
        function waitForGamesLoaded() {
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
                    gctitle.innerHTML = map.name
                    let gcmeta = document.createElement('div')
                    gcmeta.className = 'game-card-meta'
                    gcbody.appendChild(gcmeta)
                    let active = 0
                    if (gameStats[gameId]) {
                        active = gameStats[gameId].active
                    }
                    gcmeta.innerHTML = active + ' Playing'
                    if (map.picture) {
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
    } else if (document.location.pathname == '/games/1') {
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
            page.id = 'page_vplus'
            page.innerHTML = `
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
                            <a class="btn-play" href="https://vortex.towerstats.com/games/1/play?V22GameId=${gamei}">Play</a>
                        </div>

                        <div class="game-description-box">
                            <div class="game-description-label">About</div>
                            <div class="game-description-text">${map.description}</div>
                        </div>
                    </div>
    `;
        }
    } else {

        var url_string = document.URL;
        var url = new URL(url_string);
        var gamei = url.searchParams.get("V22GameId");
        let tmap
        if (gamei) {
            tmap = maps[gamei]
            let spawn = window.chooseSpawnPoint(tmap)
            window._vortex.setSpawn(spawn.x, spawn.y, spawn.z, 0);

            loadMapUrl(tmap.name, tmap.url)

            if (tmap.skyColor) {
                scene.fog = new THREE.Fog(tmap.skyColor, 192, 480);
                renderer.setClearColor(tmap.skyColor);
            }
        }

        // gui stuff
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

        // title
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

        // button styler
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
        // map buttons!!
        maps.forEach(map => {
            const btn = document.createElement('button');
            btn.innerHTML = map.name + '(Not loaded)';
            styleBtn(btn);
            let loaded = false;
            if (map === tmap) {
                btn.innerHTML = map.name + '(Loaded)'
                loaded = true
            }
            btn.onclick = () => {
                if (loaded) {
                    unloadMap(map.name)
                    btn.innerHTML = map.name + '(Not loaded)'
                    loaded = false
                } else {
                    loadMapUrl(map.name, map.url);
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

        // custom url loader
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

        // custom url loader button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = "Load URL";
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

        console.log('loading');
        // finally, add the gui to the page
        document.body.appendChild(panel);
    }
}

window.onload = () => {
    initialize()

    if (typeof connect != 'undefined') connect()

    let watermark = document.createElement('a')
    watermark.innerHTML = 'Vortex2+2 v0.1.0 by @inuk'
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