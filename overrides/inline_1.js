
document.getElementById('settings-btn').addEventListener('click', () => {
    if (window.VortexMenu?.toggle) {
        window.VortexMenu.toggle();
        return;
    }
    const p = document.getElementById('settings-panel');
    p.style.display = p.style.display === 'none' ? '' : 'none';
});

const sensSlider = document.getElementById('sp-sens');
const sensVal = document.getElementById('sp-sens-val');

const savedSens = parseFloat(localStorage.getItem('vortex_sens') || '1');
sensSlider.value = savedSens;
sensVal.textContent = savedSens.toFixed(2) + 'x';

sensSlider.addEventListener('input', function () {
    const v = parseFloat(this.value);
    sensVal.textContent = v.toFixed(2) + 'x';
    window._vortex.setSens(v);
    localStorage.setItem('vortex_sens', v);
});

const GREEN = 0x4db84b;
const RED_C = 0xc4281c;
const _PAD_BLUE = 0x0d69ac;

let _marketItems = {};
let _ownedIds = new Set();
let _currentItemId = undefined;

function _setPadColor(pad, hex) {
    if (!pad.mesh) return;
    if (Array.isArray(pad.mesh.material)) {
        for (const m of pad.mesh.material) m.color.setHex(hex);
    } else {
        pad.mesh.material.color.setHex(hex);
    }
}

function _padColor(pad) {
    if (_currentItemId === pad.item_id) return _PAD_BLUE;
    if (pad.item_id === null) return GREEN;
    return _ownedIds.has(pad.item_id) ? GREEN : RED_C;
}

function _refreshPadColors() {
    if (!window.SHIRT_PADS) return;
    for (const pad of window.SHIRT_PADS) _setPadColor(pad, _padColor(pad));
}

async function _loadMarketplace() {
    try {
        const [itemsRes, invRes, shirtRes] = await Promise.all([
            fetch('/api/marketplace/items'),
            fetch('/api/inventory'),
            fetch('/api/clothing/shirt'),
        ]);
        if (itemsRes.ok) {
            const arr = await itemsRes.json();
            for (const it of arr) _marketItems[it.id] = it;
        }
        if (invRes.ok) {
            const inv = await invRes.json();
            for (const id of (inv.item_ids || [])) _ownedIds.add(id);
        }
        if (shirtRes.ok) {
            const s = await shirtRes.json();
            _currentItemId = s.shirt_id ?? null;
        } else {
            _currentItemId = null;
        }
    } catch (e) { _currentItemId = null; }
    _refreshPadColors();
}

async function _spawnDummies() {
    while (!window._vortex || !window._vortex.getCharacter() || !window._mpCreateDummy || !window.SHIRT_PADS) {
        await new Promise(r => setTimeout(r, 100));
    }
    const dummyY = 2.6 + window._vortex.getCharFootOffset();
    for (const pad of window.SHIRT_PADS) {
        const shirtUrl = pad.item_id !== null ? (_marketItems[pad.item_id]?.image_path ?? null) : null;
        window._mpCreateDummy(pad.x, dummyY, pad.z + 1, shirtUrl, Math.PI);
    }
    _refreshPadColors();
}

async function _initMarketplace() {
    await _loadMarketplace();
    _spawnDummies();
}

_initMarketplace();

let _activeShirtPad = null;
let _promptOpen = false;
let _promptPad = null;

const _modal = document.getElementById('purchase-modal');
const _pmName = document.getElementById('pm-name');
const _pmPrice = document.getElementById('pm-price');
const _pmCancel = document.getElementById('pm-cancel');
const _pmGet = document.getElementById('pm-get');

function _equipShirt(pad) {
    if (_currentItemId === pad.item_id) return;
    _currentItemId = pad.item_id;
    if (pad.item_id === null) {
        window._vortex.applyShirt(null);
    } else {
        const item = _marketItems[pad.item_id];
        if (!item) return;
        window._vortex.applyShirt(item.image_path);
    }
    _refreshPadColors();
    fetch('/api/clothing/shirt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shirt_id: pad.item_id }),
    }).catch(() => { });
}

function _showPrompt(pad) {
    const item = _marketItems[pad.item_id];
    if (!item) return;
    _promptPad = pad;
    _promptOpen = true;
    _pmName.textContent = item.name;
    _pmPrice.textContent = item.price === 0 ? 'FREE' : item.price + ' coins';
    _modal.style.display = 'block';
}

function _closePrompt() {
    _promptOpen = false;
    _promptPad = null;
    _modal.style.display = 'none';
}

const _purchaseResolvers = new Map();
window._onPurchaseToken = (item_id, token) => {
    const resolve = _purchaseResolvers.get(item_id);
    if (resolve) { _purchaseResolvers.delete(item_id); resolve(token); }
};

async function _doPurchase() {
    const pad = _promptPad;
    if (!pad) return;
    _closePrompt();
    try {
        const token = await new Promise((resolve, reject) => {
            _purchaseResolvers.set(pad.item_id, resolve);
            window._mpSendWs({ type: 'request_purchase_token', item_id: pad.item_id });
            setTimeout(() => { _purchaseResolvers.delete(pad.item_id); reject(); }, 5000);
        });
        const res = await fetch('/api/marketplace/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: pad.item_id, token }),
        });
        if (res.ok) {
            _ownedIds.add(pad.item_id);
            _equipShirt(pad);
        }
    } catch (e) { }
}

window._onEngineClick = () => {
    if (!_promptOpen) return false;
    const co = window._vortex.cursorOver;
    if (co(_pmGet)) { _doPurchase(); return true; }
    if (co(_pmCancel)) { _closePrompt(); return true; }
    return true;
};

async function _handlePadStep(pad) {
    if (pad.item_id === null || _ownedIds.has(pad.item_id)) {
        _equipShirt(pad);
        return;
    }
    _showPrompt(pad);
}

let didVortexThings = false;

setInterval(() => {
    if (!didVortexThings && window._vortex) {
        window._vortex.setSens(savedSens);
        didVortexThings = true;
    }
    const ch = window._vortex?.getCharacter?.();
    if (!ch || !window.SHIRT_PADS || _promptOpen || _currentItemId === undefined) return;
    const p = ch.position;
    let hit = null;
    for (const pad of window.SHIRT_PADS) {
        const dx = p.x - pad.x, dz = p.z - pad.z;
        if (dx * dx + dz * dz < 6.25) { hit = pad; break; }
    }
    if (hit !== _activeShirtPad) {
        _activeShirtPad = hit;
        if (hit) _handlePadStep(hit);
    }
}, 100);


let fcountg = 0;
function postMessageAndWait(type, payload1, payload2) {
    return new Promise((resolve) => {
        const fcount = fcountg;
        function handler(event) {
            if (event.source !== window) return;
            if (event.data?.type !== (type + fcount) + "Response") return;

            window.removeEventListener("message", handler);

            const payload = event.data.payload;

            const res = new Response(payload.body, {
                status: payload.status,
                statusText: payload.statusText,
                headers: new Headers(payload.headers),
                url: payload.url,
                type: payload.type,
            });
            res.json = function(){
                return payload.bodyJson;
            }
            res.text = function(){
                return res.body;
            }

            resolve(res);
        }

        window.addEventListener("message", handler);

        window.postMessage({
            type: type + fcount,
            payload1,
            payload2
        }, "*");
        fcountg++;
    });
}

const oldFetch = fetch;
fetch = function(a,b){
    if((typeof a == 'string')&&a.startsWith('http')){
        return postMessageAndWait('fetch',a,b)
    }else{
        return oldFetch(a,b)
    }
}
