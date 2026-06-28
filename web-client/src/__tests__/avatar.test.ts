import { describe, expect, it } from "vitest";
import { AvatarMaterialService } from "../avatar/AvatarMaterialService";
import { ATTACHMENT_SLOTS, AvatarService, DEFAULT_BODY_COLORS } from "../avatar/AvatarService";

describe("avatar service", () => {
  it("defines production attachment slots and normalizes avatar data", () => {
    const avatar = new AvatarService().normalize({
      bodyType: "female",
      bodyColors: ["#000000", "bad"],
      shirtId: 12,
      attachments: { Hat: "asset-hat" }
    });

    expect(ATTACHMENT_SLOTS).toContain("RightHand");
    expect(avatar.bodyType).toBe("female");
    expect(avatar.bodyColors[1]).toBe(DEFAULT_BODY_COLORS[1]);
    expect(avatar.attachments.Hat).toBe("asset-hat");
  });

  it("normalizes legacy snake_case and camelCase avatar packets", () => {
    const service = new AvatarService();

    expect(service.normalizeLegacy({
      shirt_id: 8,
      pantId: 3,
      body_type: "female",
      body_colors: ["#ff0000"],
      faceId: 56
    })).toEqual({
      shirt_id: 8,
      pant_id: 3,
      body_type: "female",
      body_colors: ["#ff0000", DEFAULT_BODY_COLORS[1], DEFAULT_BODY_COLORS[2], DEFAULT_BODY_COLORS[3], DEFAULT_BODY_COLORS[4], DEFAULT_BODY_COLORS[5]],
      face_id: 56
    });
  });

  it("normalizes partial legacy avatar packets against a fallback", () => {
    const service = new AvatarService();

    expect(service.normalizeLegacy({ body_colors: ["00ff00"] }, {
      shirt_id: 8,
      pant_id: 3,
      body_type: "female",
      body_colors: ["#ff0000", "#0000ff"],
      face_id: 56
    })).toEqual({
      shirt_id: 8,
      pant_id: 3,
      body_type: "female",
      body_colors: ["#00ff00", DEFAULT_BODY_COLORS[1], DEFAULT_BODY_COLORS[2], DEFAULT_BODY_COLORS[3], DEFAULT_BODY_COLORS[4], DEFAULT_BODY_COLORS[5]],
      face_id: 56
    });
  });

  it("creates the VortexAvatar console API from legacy avatar callbacks", async () => {
    const applied: unknown[] = [];
    const persisted: unknown[] = [];
    const synced: unknown[] = [];
    const service = new AvatarService();
    service.attachLegacy({
      getAvatar: () => ({ shirt_id: 1, pant_id: 2, body_type: "male", body_colors: ["#ffffff"], face_id: 3 }),
      applyAvatar: async (avatar: unknown) => applied.push(avatar)
    });
    const api = service.createConsoleApi({
      persistOutfit: async (avatar) => { persisted.push(avatar); },
      syncLaunchInfo: (avatar) => { synced.push(avatar); }
    });

    expect(api.renderer).toBe("modern");
    expect(api.getOutfit()).toEqual({ shirt_id: 1, pant_id: 2, body_type: "male", body_colors: ["#ffffff"], face_id: 3 });
    await expect(api.setOutfit({ shirtId: 8, pant_id: 4, bodyType: "female", bodyColors: ["#ff0000"], face_id: 56 })).resolves.toEqual({
      shirt_id: 8,
      pant_id: 4,
      body_type: "female",
      body_colors: ["#ff0000", DEFAULT_BODY_COLORS[1], DEFAULT_BODY_COLORS[2], DEFAULT_BODY_COLORS[3], DEFAULT_BODY_COLORS[4], DEFAULT_BODY_COLORS[5]],
      face_id: 56
    });
    expect(persisted).toHaveLength(1);
    expect(synced).toHaveLength(1);
    expect(applied).toHaveLength(1);
  });

  it("uses the default Vortex body palette when avatar colors are absent", () => {
    const service = new AvatarService();

    expect(service.normalizeLegacy({})).toMatchObject({
      shirt_id: 0,
      pant_id: 0,
      body_type: "male",
      body_colors: DEFAULT_BODY_COLORS,
      face_id: 0
    });
  });

  it("aligns a modern avatar visual so its lowest point matches the root foot offset", () => {
    class FakeBox3 {
      min = { y: 0.25 };
      setFromObject() {
        return this;
      }
    }

    const service = new AvatarMaterialService().configure({
      THREE: { Box3: FakeBox3 },
      window: globalThis,
      document: globalThis.document
    });
    const visual = {
      position: { y: 0 },
      updateMatrixWorld: () => undefined
    };

    expect(service.alignVisualToRootFoot(visual, 2)).toBe(-2.25);
    expect(visual.position.y).toBe(-2.25);
  });

  it("hides the local first-person head from the camera without removing its shadow caster", () => {
    const service = new AvatarMaterialService().configure({
      THREE: {},
      window: globalThis,
      document: globalThis.document
    });
    const headMaterial = {
      userData: {},
      visible: true,
      transparent: false,
      opacity: 1,
      colorWrite: true,
      depthWrite: true,
      needsUpdate: false
    };
    const face = {
      name: "FaceOverlay",
      userData: {},
      material: { map: "face" },
      visible: true
    };
    const character = {
      visible: true,
      userData: {
        vwebModernAvatarMaterials: {
          headMaterials: [headMaterial],
          bodySlotMaterials: [],
          tickets: {}
        }
      },
      traverse: (visitor: (node: unknown) => void) => visitor(face)
    };

    service.setLocalFirstPersonHidden(character, true, { hideBody: false });

    expect(character.visible).toBe(true);
    expect(headMaterial.visible).toBe(true);
    expect(headMaterial.opacity).toBe(0);
    expect(headMaterial.colorWrite).toBe(false);
    expect(headMaterial.depthWrite).toBe(false);
    expect(face.visible).toBe(false);

    service.setLocalFirstPersonHidden(character, false, { hideBody: false });

    expect(headMaterial.visible).toBe(true);
    expect(headMaterial.transparent).toBe(false);
    expect(headMaterial.opacity).toBe(1);
    expect(headMaterial.colorWrite).toBe(true);
    expect(headMaterial.depthWrite).toBe(true);
    expect(face.visible).toBe(true);
  });
});
