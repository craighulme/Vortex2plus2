import { describe, expect, it } from "vitest";
import { TextureService } from "../assets/TextureService";

function makeWindow() {
  const values = new Map<string, string>();
  return {
    localStorage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      }
    }
  } as unknown as Window;
}

describe("TextureService", () => {
  class FakeDataTexture {
    userData?: Record<string, unknown>;
    needsUpdate = false;
    colorSpace?: unknown;
    image: { complete: boolean; naturalWidth: number; naturalHeight: number; width: number; height: number };

    constructor(
      readonly data: Uint8Array,
      width: number,
      height: number
    ) {
      this.image = { complete: true, naturalWidth: width, naturalHeight: height, width, height };
    }
  }

  it("dedupes stud textures and only applies them after they are ready", () => {
    const loadedCallbacks: Array<() => void> = [];
    const textures: Array<{
      image?: { complete: boolean; naturalWidth: number; naturalHeight: number };
      userData?: Record<string, unknown>;
      repeat: { set(rx: number, ry: number): void };
      needsUpdate?: boolean;
    }> = [];

    class FakeTextureLoader {
      load(_url: string, onLoad?: (texture: any) => void) {
        const texture: any = {
          repeat: { set() {} }
        };
        textures.push(texture);
        if (onLoad) loadedCallbacks.push(() => {
          texture.image = { complete: true, naturalWidth: 32, naturalHeight: 32 };
          onLoad(texture);
        });
        return texture;
      }
    }

    let changed = 0;
    const service = new TextureService(makeWindow()).configure({
      THREE: { DataTexture: FakeDataTexture, TextureLoader: FakeTextureLoader, RepeatWrapping: "repeat", SRGBColorSpace: "srgb" },
      importedAssets: { stud: "/stud.png", studNormal: "/normal.png" },
      maxTextureAnisotropy: 4,
      onTextureChanged: () => {
        changed++;
      }
    });

    const material: {
      map?: any;
      normalMap?: any;
      userData: { vwebStudMaterial: { rx: number; ry: number } };
      needsUpdate: boolean;
    } = { userData: { vwebStudMaterial: { rx: 1, ry: 1 } }, needsUpdate: false };
    service.applyStudTexturesToMaterial(material);

    expect(textures).toHaveLength(2);
    expect(material).toMatchObject({ map: null, normalMap: null, needsUpdate: true });

    loadedCallbacks.forEach((callback) => callback());
    material.needsUpdate = false;
    service.applyStudTexturesToMaterial(material);

    expect(changed).toBe(2);
    expect(material.map).toBe(textures[0]);
    expect(material.normalMap).toBe(textures[1]);
    expect(material.needsUpdate).toBe(true);
    expect(service.snapshot()).toMatchObject({ textures: 2, studTextures: true });
  });

  it("uses stable placeholder maps when stud textures are disabled", () => {
    class FakeTextureLoader {
      load() {
        return { repeat: { set() {} } };
      }
    }
    const service = new TextureService(makeWindow()).configure({
      THREE: { DataTexture: FakeDataTexture, TextureLoader: FakeTextureLoader, SRGBColorSpace: "srgb", LinearSRGBColorSpace: "linear" },
      importedAssets: { stud: "/stud.png", studNormal: "/normal.png" },
      maxTextureAnisotropy: 1
    });

    service.setStudTextures(false);
    const material: any = {
      map: {},
      normalMap: {},
      userData: { vwebStudMaterial: { rx: 1, ry: 1 } },
      needsUpdate: false
    };

    service.applyStudTexturesToMaterial(material);

    expect(material.map).toBeInstanceOf(FakeDataTexture);
    expect(material.normalMap).toBeInstanceOf(FakeDataTexture);
    expect(material.map).not.toBe(material.normalMap);
    expect(material.map.userData?.vwebKind).toBe("disabled-stud-diffuse");
    expect(material.normalMap.userData?.vwebKind).toBe("disabled-stud-normal");
    expect(material.needsUpdate).toBe(true);
  });

  it("does not swap a previously textured material back to null while stud textures reload", () => {
    const loadedCallbacks: Array<() => void> = [];
    const loadedTextures: any[] = [];
    class FakeTextureLoader {
      load(_url: string, onLoad?: (texture: any) => void) {
        const texture: any = { repeat: { set() {} } };
        loadedTextures.push(texture);
        if (onLoad) loadedCallbacks.push(() => {
          texture.image = { complete: true, naturalWidth: 32, naturalHeight: 32 };
          onLoad(texture);
        });
        return texture;
      }
    }

    const windowRef = makeWindow();
    const service = new TextureService(windowRef).configure({
      THREE: { DataTexture: FakeDataTexture, TextureLoader: FakeTextureLoader },
      importedAssets: { stud: "/stud.png", studNormal: "/normal.png" },
      maxTextureAnisotropy: 1
    });

    const material: any = {
      userData: { vwebStudMaterial: { rx: 1, ry: 1 } },
      needsUpdate: false
    };

    service.setStudTextures(false);
    service.applyStudTexturesToMaterial(material);
    const disabledMap = material.map;
    const disabledNormalMap = material.normalMap;

    service.setStudTextures(true);
    material.needsUpdate = false;
    service.applyStudTexturesToMaterial(material);
    expect(material.map).toBe(disabledMap);
    expect(material.normalMap).toBe(disabledNormalMap);
    expect(material.needsUpdate).toBe(false);

    loadedCallbacks.forEach((callback) => callback());
    service.applyStudTexturesToMaterial(material);
    expect(material.map).toBe(loadedTextures[0]);
    expect(material.normalMap).toBe(loadedTextures[1]);
  });
});
