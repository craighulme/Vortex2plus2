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

export type LegacyAvatarState = {
  shirt_id: number;
  pant_id: number;
  body_type: "male" | "female";
  body_colors: string[];
  face_id: number;
};

export const DEFAULT_BODY_COLORS = [
  "#d9d9d9",
  "#4b2a7b",
  "#ffffff",
  "#ffffff",
  "#1d145f",
  "#1d145f"
];

export type VortexAvatarConsoleApi = {
  readonly renderer: string;
  getOutfit(): LegacyAvatarState | unknown;
  setOutfit(outfit: Record<string, unknown>, persist?: boolean): Promise<LegacyAvatarState>;
};

export type VortexAvatarConsoleOptions = {
  persistOutfit(avatar: LegacyAvatarState): Promise<void>;
  syncLaunchInfo(avatar: LegacyAvatarState): void;
};

type LegacyAvatarApi = {
  applyAvatar?: unknown;
  getAvatar?: unknown;
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

  normalizeLegacy(input: Record<string, unknown> = {}, fallback: Partial<LegacyAvatarState> = {}): LegacyAvatarState {
    const bodyColors = Array.isArray(input.body_colors)
      ? input.body_colors
      : Array.isArray(input.bodyColors)
        ? input.bodyColors
        : Array.isArray(fallback.body_colors)
          ? fallback.body_colors
          : [];
    const avatar = this.normalize({
      bodyType: String(input.body_type ?? input.bodyType ?? fallback.body_type ?? "male").toLowerCase() === "female" ? "female" : "male",
      bodyColors: bodyColors.map((color) => String(color)),
      shirtId: Number(input.shirt_id ?? input.shirtId ?? fallback.shirt_id ?? 0),
      pantId: Number(input.pant_id ?? input.pantId ?? fallback.pant_id ?? 0),
      faceId: Number(input.face_id ?? input.faceId ?? fallback.face_id ?? 0)
    });
    return toLegacyAvatar(avatar) as LegacyAvatarState;
  }

  async applyLocal(input: Partial<AvatarState>): Promise<AvatarState> {
    const avatar = this.normalize({ ...this.previewState, ...input });
    this.previewState = avatar;
    if (typeof this.legacy.applyAvatar === "function") {
      await this.legacy.applyAvatar(toLegacyAvatar(avatar));
    }
    return avatar;
  }

  getRenderer(): string {
    return "modern";
  }

  getPreviewState(): AvatarState {
    const current = this.readLegacyAvatar();
    if (current) this.previewState = current;
    return { ...this.previewState, bodyColors: [...this.previewState.bodyColors], attachments: { ...this.previewState.attachments } };
  }

  createConsoleApi(options: VortexAvatarConsoleOptions): VortexAvatarConsoleApi {
    const thisService = this;
    return {
      get renderer() {
        return thisService.getRenderer();
      },
      getOutfit() {
        return thisService.readLegacyRawAvatar() || toLegacyAvatar(thisService.getPreviewState());
      },
      async setOutfit(outfit: Record<string, unknown>, persist = true) {
        const normalized = thisService.normalizeLegacy(outfit);
        if (persist) await options.persistOutfit(normalized);
        options.syncLaunchInfo(normalized);
        if (typeof thisService.legacy.applyAvatar === "function") {
          await thisService.legacy.applyAvatar(normalized);
        }
        thisService.previewState = thisService.normalize({
          bodyType: normalized.body_type,
          bodyColors: normalized.body_colors,
          shirtId: normalized.shirt_id,
          pantId: normalized.pant_id,
          faceId: normalized.face_id
        });
        return normalized;
      }
    };
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

  private readLegacyRawAvatar(): unknown {
    if (typeof this.legacy.getAvatar !== "function") return null;
    try {
      return this.legacy.getAvatar();
    } catch {
      return null;
    }
  }
}

function toLegacyAvatar(avatar: AvatarState): LegacyAvatarState {
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
  while (out.length < 6) out.push(DEFAULT_BODY_COLORS[out.length] || "#ffffff");
  return out.map((color, index) => {
    const value = String(color || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    if (/^[0-9a-f]{6}$/i.test(value)) return `#${value}`;
    return DEFAULT_BODY_COLORS[index] || "#ffffff";
  });
}

function safeId(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
}
