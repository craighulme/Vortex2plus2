import { CSMShadowNode } from './libs/CSMShadowNode.js';

function normalizeShadowConfig(config = {}) {
    const quality = ['low', 'medium', 'high', 'ultra'].includes(config.quality) ? config.quality : 'medium';
    return {
        quality,
        mapSize: Number.isFinite(config.mapSize) ? config.mapSize : 2048,
        cascades: Number.isFinite(config.cascades) ? config.cascades : 4,
        maxFar: Number.isFinite(config.maxFar) ? config.maxFar : 500,
        lightMargin: Number.isFinite(config.lightMargin) ? config.lightMargin : 200,
        fade: config.fade !== false,
    };
}

function sameShadowConfig(left, right) {
    return left.quality === right.quality
        && left.mapSize === right.mapSize
        && left.cascades === right.cascades
        && left.maxFar === right.maxFar
        && left.lightMargin === right.lightMargin
        && left.fade === right.fade;
}

export class ShadowService {
    constructor({ THREE, scene, camera, renderer, backend, enabled, shadowConfig }) {
        this.THREE = THREE;
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.backend = backend;
        this.enabled = !!enabled;
        this.shadowConfig = normalizeShadowConfig(shadowConfig);
        this.shadowMapSize = this.shadowConfig.mapSize;
        this.technique = 'csm';
        this.csmShadowNode = null;
        this.lastCsmProjectionSignature = '';

        this.sun = new THREE.DirectionalLight(0xffffff, 3);
        this.sunTarget = new THREE.Object3D();
        this.backLight = new THREE.DirectionalLight(0xffffff, 0.4);

        this.configureRenderer();
        this.configureStandardSun();
        this.configureBackLight();

        scene.add(this.sun);
        scene.add(this.sunTarget);
        scene.add(this.backLight);

        if (this.technique === 'csm') this.createCsmShadowNode();
        this.setEnabled(this.enabled);
    }

    configureRenderer() {
        if (!this.renderer.shadowMap) return;
        this.renderer.shadowMap.enabled = this.enabled;
        this.renderer.shadowMap.type = this.THREE.PCFShadowMap;
    }

    configureStandardSun() {
        this.sun.castShadow = this.enabled;
        this.sun.shadow.mapSize.width = this.shadowMapSize;
        this.sun.shadow.mapSize.height = this.shadowMapSize;
        this.sun.shadow.camera.near = 0.1;
        const size = 350;
        this.sun.shadow.camera.far = 2 * size;
        this.sun.shadow.camera.left = -size;
        this.sun.shadow.camera.right = size;
        this.sun.shadow.camera.top = size;
        this.sun.shadow.camera.bottom = -size;
        this.sun.shadow.autoUpdate = this.enabled;
        this.sun.shadow.bias = -0.00003;
        delete this.sun.shadow.shadowNode;
        this.sun.position.set(1, 2, 1);
        this.sunTarget.position.set(0, 0, 0);
        this.sun.target = this.sunTarget;
    }

    configureBackLight() {
        this.backLight.position.set(-160, 500, -160);
        this.backLight.castShadow = false;
    }

    createCsmShadowNode() {
        this.sun.shadow.mapSize.width = this.shadowMapSize;
        this.sun.shadow.mapSize.height = this.shadowMapSize;
        this.csmShadowNode = new CSMShadowNode(this.sun, {
            maxFar: this.shadowConfig.maxFar,
            cascades: this.shadowConfig.cascades,
            mode: 'practical',
            lightMargin: this.shadowConfig.lightMargin,
            fade: this.shadowConfig.fade,
        });
    }

    reconfigure(config) {
        const next = normalizeShadowConfig(config);
        if (sameShadowConfig(this.shadowConfig, next)) return this.snapshot();

        if (this.csmShadowNode) {
            delete this.sun.shadow.shadowNode;
            this.csmShadowNode.dispose?.();
            this.csmShadowNode = null;
        }

        this.shadowConfig = next;
        this.shadowMapSize = next.mapSize;
        this.lastCsmProjectionSignature = '';
        this.configureRenderer();
        this.configureStandardSun();
        this.createCsmShadowNode();
        this.setEnabled(this.enabled);
        this.markSceneMaterialsForUpdate();
        this.markNeedsUpdate();
        return this.snapshot();
    }

    getProjectionSignature() {
        const camera = this.csmShadowNode?.camera || this.camera;
        if (!camera) return '';
        return [
            camera.near,
            camera.far,
            camera.fov,
            camera.aspect,
            camera.zoom,
            this.csmShadowNode?.maxFar,
            this.csmShadowNode?.cascades,
            this.csmShadowNode?.mode,
        ].join('|');
    }

    active() {
        return !!this.enabled && !!this.renderer.shadowMap?.enabled;
    }

    setEnabled(value) {
        this.enabled = !!value;
        if (this.renderer.shadowMap) {
            this.renderer.shadowMap.enabled = this.enabled;
            this.renderer.shadowMap.needsUpdate = this.enabled;
        }
        this.sun.castShadow = this.enabled;
        this.sun.shadow.autoUpdate = this.enabled;
        if (this.enabled && this.csmShadowNode) {
            this.sun.shadow.shadowNode = this.csmShadowNode;
        } else {
            delete this.sun.shadow.shadowNode;
        }
        return this.enabled;
    }

    syncObjectShadowFlags(root) {
        const active = this.active();
        root.traverse?.((object) => {
            if (!object.isMesh) return;
            object.castShadow = active && object.userData?.v22DisableCastShadow !== true;
            object.receiveShadow = active && object.userData?.v22DisableReceiveShadow !== true;
        });
    }

    markNeedsUpdate() {
        if (this.active() && this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
    }

    markSceneMaterialsForUpdate(root = this.scene) {
        root.traverse?.((object) => {
            const material = object.material;
            if (!material) return;
            const materials = Array.isArray(material) ? material : [material];
            for (const item of materials) item.needsUpdate = true;
        });
    }

    update() {
        if (!this.active()) return;
        if (this.csmShadowNode?.camera) {
            const projectionSignature = this.getProjectionSignature();
            if (projectionSignature !== this.lastCsmProjectionSignature) {
                this.lastCsmProjectionSignature = projectionSignature;
                this.csmShadowNode.updateFrustums();
            }
        }
    }

    snapshot() {
        return {
            enabled: this.enabled,
            active: this.active(),
            backend: this.backend,
            technique: this.technique,
            implementation: this.csmShadowNode ? 'CSMShadowNode' : 'DirectionalLightShadow',
            quality: this.shadowConfig.quality,
            csmSupported: true,
            webgpuCsmSupported: true,
            cascades: this.csmShadowNode?.cascades || 0,
            maxFar: this.shadowConfig.maxFar,
            shadowMapSize: this.shadowMapSize,
            disabledReason: null,
        };
    }
}
