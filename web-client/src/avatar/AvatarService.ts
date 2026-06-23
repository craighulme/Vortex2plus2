export const ATTACHMENT_SLOTS = [
  "Head",
  "Face",
  "Hat",
  "Mask",
  "Torso",
  "Shirt",
  "Pants",
  "LeftHand",
  "RightHand",
  "Back",
  "LeftFoot",
  "RightFoot"
] as const;

export type AttachmentSlot = typeof ATTACHMENT_SLOTS[number];

export type AvatarState = {
  bodyType: "male" | "female";
  bodyColors: string[];
  shirtId: number;
  pantId: number;
  faceId: number;
  attachments: Partial<Record<AttachmentSlot, string>>;
};

type LegacyAvatarApi = {
  applyAvatar?: unknown;
  getAvatar?: unknown;
  setAvatarRenderer?: unknown;
  getAvatarRenderer?: unknown;
};

export class AvatarService {
  private legacy: LegacyAvatarApi = {};
  private previewState: AvatarState = this.normalize();

  attachLegacy(api: LegacyAvatarApi): void {
    this.legacy = { ...this.legacy, ...api };
    const current = this.readLegacyAvatar();
    if (current) this.previewState = current;
  }

  normalize(input: Partial<AvatarState> = {}): AvatarState {
    return {
      bodyType: input.bodyType === "female" ? "female" : "male",
      bodyColors: normalizeBodyColors(input.bodyColors),
      shirtId: safeId(input.shirtId),
      pantId: safeId(input.pantId),
      faceId: safeId(input.faceId),
      attachments: { ...(input.attachments ?? {}) }
    };
  }

  async applyLocal(input: Partial<AvatarState>): Promise<AvatarState> {
    const avatar = this.normalize({ ...this.previewState, ...input });
    this.previewState = avatar;
    if (typeof this.legacy.applyAvatar === "function") {
      await this.legacy.applyAvatar(toLegacyAvatar(avatar));
    }
    return avatar;
  }

  setRenderer(mode: "modern" | "legacy"): string {
    if (typeof this.legacy.setAvatarRenderer === "function") {
      return String(this.legacy.setAvatarRenderer(mode));
    }
    return mode;
  }

  getRenderer(): string {
    if (typeof this.legacy.getAvatarRenderer === "function") {
      return String(this.legacy.getAvatarRenderer());
    }
    return "modern";
  }

  getPreviewState(): AvatarState {
    const current = this.readLegacyAvatar();
    if (current) this.previewState = current;
    return { ...this.previewState, bodyColors: [...this.previewState.bodyColors], attachments: { ...this.previewState.attachments } };
  }

  private readLegacyAvatar(): AvatarState | null {
    if (typeof this.legacy.getAvatar !== "function") return null;
    try {
      const raw = this.legacy.getAvatar() as Record<string, unknown>;
      return this.normalize({
        bodyType: raw.body_type === "female" || raw.bodyType === "female" ? "female" : "male",
        bodyColors: Array.isArray(raw.body_colors) ? raw.body_colors as string[] : (Array.isArray(raw.bodyColors) ? raw.bodyColors as string[] : []),
        shirtId: Number(raw.shirt_id ?? raw.shirtId ?? 0),
        pantId: Number(raw.pant_id ?? raw.pantId ?? 0),
        faceId: Number(raw.face_id ?? raw.faceId ?? 0)
      });
    } catch {
      return null;
    }
  }
}

function toLegacyAvatar(avatar: AvatarState): Record<string, unknown> {
  return {
    shirt_id: avatar.shirtId,
    pant_id: avatar.pantId,
    body_type: avatar.bodyType,
    body_colors: avatar.bodyColors,
    face_id: avatar.faceId
  };
}

function normalizeBodyColors(colors: string[] | undefined): string[] {
  const out = Array.isArray(colors) ? colors.slice(0, 6) : [];
  while (out.length < 6) out.push("#ffffff");
  return out.map((color) => /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff");
}

function safeId(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
}
