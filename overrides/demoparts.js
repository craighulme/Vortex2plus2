const loadDemo = (async function () {
    if (typeof RED != 'number') { window.RED = 0xc4281c; }
    if (typeof BLUE != 'number') { window.BLUE = 0x0d69ac; }
    if (typeof YELLOW != 'number') { window.YELLOW = 0xf2cd37; }
    if (typeof ORANGE != 'number') { window.ORANGE = 0xe2761a; }
    if (typeof PURPLE != 'number') { window.PURPLE = 0x5b3a8b; }
    if (typeof LIME != 'number') { window.LIME = 0x4db84b; }
    if (typeof WHITE != 'number') { window.WHITE = 0xf2f3f2; }
    if (typeof DARK != 'number') { window.DARK = 0x1a1a2e; }
    if (typeof PINK != 'number') { window.PINK = 0xe84393; }
    if (typeof TEAL != 'number') { window.TEAL = 0x00b4d8; }

    addStud(8, 3, 8, BLUE, 0, G, -20);
    addStud(6, 1, 6, RED, 0, G + 3, -32);

    addStud(8, 1, 8, BLUE, 17.00, 1.60, 0.00);
    addStud(6, 1, 6, BLUE, 29.00, 1.60, 0.00);
    addStud(4, 1, 4, TEAL, 40.00, 1.60, 0.00);
    addStud(3, 1, 3, TEAL, 50.00, 1.60, 0.00);
    addStud(2, 1, 2, YELLOW, 59.00, 1.60, 0.00);
    addStud(2, 1, 2, YELLOW, 68.00, 1.60, 0.00);
    addStud(2, 1, 2, ORANGE, 77.00, 1.60, 0.00);
    addStud(2, 1, 2, RED, 86.00, 1.60, 0.00);

    addStud(2, 1, 2, RED, 95.00, 4.60, 8.00);
    addStud(2, 1, 2, ORANGE, 103.00, 7.60, 0.00);
    addStud(2, 1, 2, YELLOW, 112.00, 10.60, 8.00);
    addStud(2, 1, 2, TEAL, 120.00, 13.60, 0.00);
    addStud(2, 1, 2, BLUE, 129.00, 16.60, 8.00);
    addStud(2, 1, 2, PURPLE, 137.00, 19.60, 0.00);
    addStud(2, 1, 2, PINK, 146.00, 22.60, 8.00);
    addStud(2, 1, 2, RED, 154.00, 25.60, 0.00);
    addStud(8, 2, 8, WHITE, 160.00, 25.60, 0.00);

    addStud(1, 1, 4, TEAL, 160.00, 25.60, 10.00);
    addStud(1, 1, 4, PINK, 160.00, 25.60, 19.00);
    addStud(1, 1, 4, TEAL, 160.00, 25.60, 28.00);
    addStud(1, 1, 4, PINK, 160.00, 25.60, 37.00);
    addStud(1, 1, 4, TEAL, 160.00, 25.60, 46.00);
    addStud(1, 1, 4, PINK, 160.00, 25.60, 55.00);
    addStud(1, 1, 4, TEAL, 160.00, 25.60, 64.00);
    addStud(1, 1, 4, PINK, 160.00, 25.60, 73.00);
    addStud(1, 1, 4, TEAL, 160.00, 25.60, 82.00);
    addStud(1, 1, 4, PINK, 160.00, 25.60, 91.00);
    addStud(6, 2, 6, WHITE, 160.00, 25.60, 93.00);

    addStud(2, 1, 2, RED, 173.00, 25.60, 95.00);
    addStud(2, 1, 2, ORANGE, 171.26, 28.10, 101.50);
    addStud(2, 1, 2, YELLOW, 166.50, 30.60, 106.26);
    addStud(2, 1, 2, LIME, 160.00, 33.10, 108.00);
    addStud(2, 1, 2, TEAL, 153.50, 35.60, 106.26);
    addStud(2, 1, 2, BLUE, 148.74, 38.10, 101.50);
    addStud(2, 1, 2, PURPLE, 147.00, 40.60, 95.00);
    addStud(2, 1, 2, PINK, 148.74, 43.10, 88.50);
    addStud(2, 1, 2, WHITE, 153.50, 45.60, 83.74);
    addStud(2, 1, 2, RED, 160.00, 48.10, 82.00);
    addStud(2, 1, 2, ORANGE, 166.50, 50.60, 83.74);
    addStud(2, 1, 2, YELLOW, 171.26, 53.10, 88.50);
    addStud(6, 2, 6, WHITE, 160.00, 53.10, 95.00);

    addStud(2, 2, 2, DARK, 148.00, 53.10, 95.00);
    addStud(3, 1, 3, RED, 148.00, 55.10, 95.00);
    addStud(2, 7, 2, DARK, 137.00, 53.10, 95.00);
    addStud(3, 1, 3, ORANGE, 137.00, 60.10, 95.00);
    addStud(2, 2, 2, DARK, 126.00, 53.10, 95.00);
    addStud(3, 1, 3, RED, 126.00, 55.10, 95.00);
    addStud(2, 7, 2, DARK, 115.00, 53.10, 95.00);
    addStud(3, 1, 3, ORANGE, 115.00, 60.10, 95.00);
    addStud(2, 2, 2, DARK, 104.00, 53.10, 95.00);
    addStud(3, 1, 3, RED, 104.00, 55.10, 95.00);
    addStud(2, 7, 2, DARK, 93.00, 53.10, 95.00);
    addStud(3, 1, 3, ORANGE, 93.00, 60.10, 95.00);
    addStud(2, 2, 2, DARK, 82.00, 53.10, 95.00);
    addStud(3, 1, 3, RED, 82.00, 55.10, 95.00);
    addStud(2, 7, 2, DARK, 71.00, 53.10, 95.00);
    addStud(3, 1, 3, ORANGE, 71.00, 60.10, 95.00);
    addStud(2, 2, 2, DARK, 60.00, 53.10, 95.00);
    addStud(3, 1, 3, RED, 60.00, 55.10, 95.00);
    addStud(2, 7, 2, DARK, 49.00, 53.10, 95.00);
    addStud(3, 1, 3, ORANGE, 49.00, 60.10, 95.00);
    addStud(6, 2, 6, WHITE, 41.00, 58.10, 95.00);

    addStud(2, 1, 8, BLUE, 41.00, 58.10, 85.00);
    addStud(8, 1, 2, BLUE, 49.00, 58.10, 79.00);
    addStud(2, 1, 8, TEAL, 57.00, 58.10, 71.00);
    addStud(8, 1, 2, TEAL, 49.00, 58.10, 63.00);
    addStud(2, 1, 8, PURPLE, 41.00, 58.10, 55.00);
    addStud(8, 1, 2, PURPLE, 33.00, 58.10, 47.00);
    addStud(2, 1, 8, PINK, 25.00, 58.10, 39.00);
    addStud(8, 1, 2, PINK, 33.00, 58.10, 31.00);
    addStud(2, 1, 6, RED, 41.00, 58.10, 23.00);
    addStud(6, 2, 6, WHITE, 41.00, 58.10, 17.00);

    addStud(2, 1, 2, ORANGE, 41.00, 58.10, 8.00);
    addStud(2, 1, 2, RED, 41.00, 60.10, 1.00);
    addStud(2, 1, 2, YELLOW, 41.00, 58.10, -6.00);
    addStud(1, 1, 2, TEAL, 41.00, 58.10, -13.00);
    addStud(2, 1, 2, PURPLE, 41.00, 61.10, -20.00);
    addStud(2, 1, 1, BLUE, 41.00, 60.10, -27.00);
    addStud(1, 1, 1, PINK, 41.00, 62.10, -34.00);
    addStud(1, 1, 1, RED, 41.00, 62.10, -41.00);
    addStud(1, 1, 1, ORANGE, 41.00, 62.10, -48.00);
    addStud(2, 1, 2, LIME, 41.00, 60.10, -55.00);
    addStud(2, 1, 2, LIME, 41.00, 60.10, -62.00);
    addStud(6, 2, 6, WHITE, 41.00, 60.10, -65.00);

    addStud(2, 1, 2, RED, 53.00, 60.10, -61.00);
    addStud(2, 1, 2, ORANGE, 49.99, 57.90, -68.17);
    addStud(2, 1, 2, YELLOW, 43.45, 55.70, -71.72);
    addStud(2, 1, 2, TEAL, 36.44, 53.50, -70.46);
    addStud(2, 1, 2, BLUE, 31.99, 51.30, -65.34);
    addStud(2, 1, 2, PURPLE, 31.74, 49.10, -58.89);
    addStud(2, 1, 2, PINK, 35.39, 46.90, -53.96);
    addStud(2, 1, 2, WHITE, 41.00, 44.70, -52.50);
    addStud(2, 1, 2, RED, 45.99, 42.50, -54.75);
    addStud(2, 1, 2, ORANGE, 48.31, 40.30, -59.33);
    addStud(2, 1, 2, YELLOW, 47.31, 38.10, -64.04);
    addStud(2, 1, 2, TEAL, 43.82, 35.90, -66.86);
    addStud(2, 1, 2, BLUE, 39.66, 33.70, -66.85);
    addStud(2, 1, 2, PURPLE, 36.70, 31.50, -64.43);
    addStud(6, 2, 6, WHITE, 41.00, 31.50, -61.00);

    addStud(2, 1, 2, ORANGE, 50.00, 31.50, -61.00);
    addStud(2, 1, 2, BLUE, 40.00, 34.50, -61.00);
    addStud(2, 1, 2, ORANGE, 50.00, 37.50, -61.00);
    addStud(2, 1, 2, BLUE, 40.00, 40.50, -61.00);
    addStud(2, 1, 2, YELLOW, 50.00, 43.50, -61.00);
    addStud(2, 1, 2, PURPLE, 40.00, 46.50, -61.00);
    addStud(2, 1, 2, YELLOW, 50.00, 49.50, -61.00);
    addStud(2, 1, 2, PURPLE, 40.00, 52.50, -61.00);
    addStud(2, 1, 2, RED, 50.00, 55.50, -61.00);
    addStud(2, 1, 2, TEAL, 40.00, 58.50, -61.00);
    addStud(2, 1, 2, RED, 50.00, 61.50, -61.00);
    addStud(2, 1, 2, TEAL, 40.00, 64.50, -61.00);
    addStud(6, 2, 6, WHITE, 45.00, 64.50, -61.00);

    addStud(12, 1, 1, TEAL, 61.00, 64.50, -61.00);
    addStud(1, 1, 12, ORANGE, 61.00, 64.50, -61.00);
    addStud(12, 1, 1, TEAL, 71.00, 67.50, -61.00);
    addStud(1, 1, 12, ORANGE, 71.00, 67.50, -61.00);
    addStud(12, 1, 1, TEAL, 81.00, 64.50, -61.00);
    addStud(1, 1, 12, ORANGE, 81.00, 64.50, -61.00);
    addStud(12, 1, 1, TEAL, 91.00, 61.50, -61.00);
    addStud(1, 1, 12, ORANGE, 91.00, 61.50, -61.00);
    addStud(12, 1, 1, TEAL, 101.00, 64.50, -61.00);
    addStud(1, 1, 12, ORANGE, 101.00, 64.50, -61.00);
    addStud(12, 1, 1, TEAL, 111.00, 67.50, -61.00);
    addStud(1, 1, 12, ORANGE, 111.00, 67.50, -61.00);
    addStud(12, 1, 1, TEAL, 121.00, 64.50, -61.00);
    addStud(1, 1, 12, ORANGE, 121.00, 64.50, -61.00);
    addStud(6, 2, 6, WHITE, 125.00, 64.50, -61.00);

    addStud(2, 1, 2, RED, 125.00, 64.50, -52.00);
    addStud(2, 1, 2, ORANGE, 125.00, 59.50, -43.00);
    addStud(2, 1, 2, YELLOW, 125.00, 54.50, -34.00);
    addStud(2, 1, 2, PINK, 125.00, 49.50, -25.00);
    addStud(2, 1, 2, TEAL, 125.00, 44.50, -16.00);
    addStud(2, 1, 2, BLUE, 125.00, 39.50, -7.00);
    addStud(2, 1, 2, PURPLE, 125.00, 34.50, 2.00);
    addStud(2, 1, 2, LIME, 125.00, 29.50, 11.00);
    addStud(6, 2, 6, WHITE, 125.00, 29.50, 15.00);

    addStud(2, 1, 2, PINK, 134.00, 30.50, 19.00);
    addStud(2, 1, 2, TEAL, 143.00, 29.50, 15.00);
    addStud(2, 1, 2, RED, 152.00, 31.50, 19.00);
    addStud(2, 1, 2, ORANGE, 161.00, 29.50, 15.00);
    addStud(2, 1, 2, PURPLE, 170.00, 30.50, 21.00);
    addStud(2, 1, 2, BLUE, 179.00, 29.50, 15.00);
    addStud(2, 1, 2, YELLOW, 188.00, 31.50, 15.00);
    addStud(2, 1, 2, PINK, 197.00, 29.50, 21.00);
    addStud(2, 1, 2, TEAL, 206.00, 29.50, 15.00);
    addStud(2, 1, 2, LIME, 215.00, 30.50, 15.00);
    addStud(6, 2, 6, WHITE, 221.00, 30.50, 15.00);

    addStud(1, 1, 1, RED, 231.00, 30.50, 15.00);
    addStud(1, 1, 1, ORANGE, 228.07, 32.50, 22.07);
    addStud(1, 1, 1, YELLOW, 221.00, 34.50, 25.00);
    addStud(1, 1, 1, LIME, 213.93, 36.50, 22.07);
    addStud(1, 1, 1, TEAL, 211.00, 38.50, 15.00);
    addStud(1, 1, 1, BLUE, 213.93, 40.50, 7.93);
    addStud(1, 1, 1, PURPLE, 221.00, 42.50, 5.00);
    addStud(1, 1, 1, PINK, 228.07, 44.50, 7.93);
    addStud(1, 1, 1, WHITE, 231.00, 46.50, 15.00);
    addStud(1, 1, 1, RED, 228.07, 48.50, 22.07);
    addStud(1, 1, 1, ORANGE, 221.00, 50.50, 25.00);
    addStud(1, 1, 1, YELLOW, 213.93, 52.50, 22.07);
    addStud(1, 1, 1, LIME, 211.00, 54.50, 15.00);
    addStud(1, 1, 1, TEAL, 213.93, 56.50, 7.93);
    addStud(1, 1, 1, BLUE, 221.00, 58.50, 5.00);
    addStud(1, 1, 1, PURPLE, 228.07, 60.50, 7.93);
    addStud(8, 1, 8, ORANGE, 221.00, 60.50, 15.00);

    addStud(14, 3, 14, LIME, 221.00, 61.50, 15.00);

    if (!window.STAIR_COLORS) {
        window.STAIR_COLORS = [BLUE, RED, YELLOW, ORANGE, PURPLE, LIME];
    }
    for (let n = 1; n <= 10; n++) {
        addStud(6, n, 1, STAIR_COLORS[(n - 1) % STAIR_COLORS.length], -15, G, -(5 + n));
    }

    addStud(6, 1, 6, PURPLE, -25, G, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 2, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 4, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 6, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 8, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 10, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 12, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 14, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 16, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 18, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 20, -6);
    addStud(6, 1, 6, PURPLE, -25, G + 22, -6);

    {
        const canvas = document.createElement('canvas');
        canvas.width = 4096; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 72px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillText('climbing logic still work in progress. please report all bugs to the discord server!!', 2048, 64);
        const tex = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(128, 4),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -Math.PI / 2;
        mesh.position.set(10, 1.62, 8);
        scene.add(mesh);
    }

    {
        const DEG = Math.PI / 180;
        addStud(8, 1, 8, ORANGE, -40, G, 0);
        addStud(8, 1, 16, RED, -40, G + 2.74, -12, 20 * DEG, 0, 0);
        addStud(8, 1, 8, LIME, -40, G + 5.5, -24);
        addStud(6, 1, 8, BLUE, -40, G + 8, -38, 45 * DEG, 0, 0);
        addStud(8, 2, 8, WHITE, -40, G + 11.5, -50);
        addStud(6, 1, 6, YELLOW, -40, G + 13.5, -62, 0, 45 * DEG, 0);
        addStud(8, 1, 8, PURPLE, -40, G + 14, -75, 0, 0, 20 * DEG);
    }
    addStud(32, 1, 58, 8947848, 0, G, 90);
    window['SHIRT_PADS'] = [{
        'x': 0x0,
        'z': 0x43,
        'item_id': null
    }, {
        'x': -10.5,
        'z': 0x4c,
        'item_id': 0x1
    }, {
        'x': -3.5,
        'z': 0x4c,
        'item_id': 0x2
    }, {
        'x': 3.5,
        'z': 0x4c,
        'item_id': 0x3
    }, {
        'x': 10.5,
        'z': 0x4c,
        'item_id': 0x4
    }, {
        'x': -10.5,
        'z': 0x57,
        'item_id': 0x5
    }, {
        'x': -3.5,
        'z': 0x57,
        'item_id': 0x6
    }, {
        'x': 3.5,
        'z': 0x57,
        'item_id': 0x7
    }, {
        'x': 10.5,
        'z': 0x57,
        'item_id': 0x8
    }, {
        'x': -10.5,
        'z': 0x62,
        'item_id': 0x9
    }, {
        'x': -3.5,
        'z': 0x62,
        'item_id': 0xa
    }, {
        'x': 3.5,
        'z': 0x62,
        'item_id': 0xb
    }, {
        'x': 10.5,
        'z': 0x62,
        'item_id': 0xc
    }, {
        'x': -10.5,
        'z': 0x6d,
        'item_id': 0xd
    }, {
        'x': -3.5,
        'z': 0x6d,
        'item_id': 0xe
    }, {
        'x': 3.5,
        'z': 0x6d,
        'item_id': 0xf
    }, {
        'x': 10.5,
        'z': 0x6d,
        'item_id': 0x10
    }];
    for (const pad of window.SHIRT_PADS) {
        const [mesh, _] = addStud(4, 0.5, 4, 12855324, pad.x, G + 1, pad.z);
        if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(mat => mat.clone());
        } else {
            mesh.material = mesh.material.clone();
        }
        pad.mesh = mesh;
    }
    addStud(1, 1, 2, 0x808080, -1, G + 3, 0);
    addStud(1, 20, 10, 0x808080, 0, G, 0);
    addStud(1, 20, 10, 0x808080, 0, G, 13);
    addStud(1, 20, 14, 0x808080, 3, G, 0);
    addStud(1, 20, 6, 0x808080, 3, G, 13);

    if (window._vortex && window._vortex.finishWorld) {
        window._vortex.finishWorld();
    }

});
