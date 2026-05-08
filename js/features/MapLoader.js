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
        let mesh = addStud(v.S[0], v.S[1], v.S[2], Number('0x' + v.C), v.P[0], v.P[1] - v.S[1] * 0.5, v.P[2], v.R[0] * deg2rad, v.R[1] * deg2rad, v.R[2] * deg2rad)
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
        let mesh = addStud(sx, sy, sz, Number('0x' + v.C), v.P[0], v.P[1] - v.S[1] * 0.5, v.P[2], rx * deg2rad, ry * deg2rad, rz * deg2rad)
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

// Source - https://stackoverflow.com/a/61511955
// Posted by Yong Wang, modified by community. See post 'Timeline' for change history
// Retrieved 2026-05-06, License - CC BY-SA 4.0
function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// maps, currently just crossroads. add more.
const maps = [
    {
        name: "Crossroads",
        url: "https://pastebin.com/raw/wfEXaPTx",
        picture: "https://static.wikitide.net/arsenalwiki/d/df/Crossroads.png",
        bannerpicture: "https://i.imgur.com/pUkDxcY.jpeg",
        description: "Classic Roblox Crossroads map!",
        creatorName: 'Inuk',
        creatorId: 1961,
        gameId: -1,

        spawnX: 330,
        spawnY: 100,
        spawnZ: 27,
    }, //added by Inuk, 6/5/2026, added a ramp to enter the map more easily
];




var url_string = document.URL;
var url = new URL(url_string);
var gamei = url.searchParams.get("VPlusGameId");
if (gamei) {
    let map = maps[gamei]
    let gameid = map.gameId
    const s = document.createElement("script");
    Object.defineProperty(window, "GAME_ID", {
        value: gameid,
        writable: false,
        configurable: false
    });

    console.log(`game id set to ${gameid}`);;
}
async function initialize() {
    if (document.location.pathname == '/home' || document.location.pathname == '/social' || document.location.pathname == '/search' || document.location.pathname == '/games/2') {
        // game buttons!
        let f = await fetch('/api/game-stats')
        let gameStats = await f.json()
        console.log(gameStats)
        for (let i = 0; i < maps.length; i++) {
            let map = maps[i]

            let gameId = map.gameId

            let main = document.createElement('a');
            main.className = 'game-card'
            main.href = '/games/1?VPlusGameId=' + i
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
    } else if (document.location.pathname == '/games/1') {
        var url_string = document.URL;
        var url = new URL(url_string);
        var gamei = url.searchParams.get("VPlusGameId");
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
                            <a class="btn-play" href="https://vortex.towerstats.com/demo?VPlusGameId=${gamei}">Play</a>
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
        var gamei = url.searchParams.get("VPlusGameId");
        let tmap
        if (gamei) {
            tmap = maps[gamei]

            window._vortex.setSpawn(tmap.spawnX, tmap.spawnY, tmap.spawnZ);

            loadMapUrl(tmap.name, tmap.url)
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
        title.textContent = "Maps";
        Object.assign(title.style, {
            fontSize: "14px",
            fontWeight: "700",
            color: "#fff"
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
                    btn.innerHTML = map.name + '(Loaded)'
                    loaded = true
                }
            };
            renderer.domElement.addEventListener('click', () => {
                if (locked) {
                    if (_cursorOver(btn)){
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

        panel.appendChild(input);

        // custom url loader button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = "Load URL";

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

        console.log('loading');
        // finally, add the gui to the page
        document.body.appendChild(panel);
    }
}

window.onload = () => {
    initialize()

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
    vortexsecondary.className='navbar-logo navbar-logo-secondary'
    vortexsecondary.innerHTML=' 2+2'
    vortexprimary.appendChild(vortexsecondary)
}