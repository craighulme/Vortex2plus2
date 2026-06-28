export type AssetManifest = {
  textures: Record<string, string>;
  meshes: Record<string, string>;
  sounds: Record<string, string>;
  maps: Record<string, string>;
  images: {
    banners: Record<string, string>;
    icons: Record<string, string>;
  };
  scripts: Record<string, string>;
  raw: Record<string, unknown>;
};

export function normalizeAssetManifest(raw: unknown): AssetManifest {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    textures: pickRecord({
      stud: value.stud,
      studNormal: value.studNormal
    }),
    meshes: pickRecord({
      malePlayerGlb: value.malePlayerGlb,
      femalePlayerGlb: value.femalePlayerGlb
    }),
    sounds: pickRecord({
      oofSound: value.oofSound
    }),
    maps: pickRecord((value.mapdata as Record<string, unknown> | undefined) ?? {}),
    images: {
      banners: pickRecord(readNested(value, ["imgdata", "banners"])),
      icons: pickRecord(readNested(value, ["imgdata", "icons"]))
    },
    scripts: pickRecord(readNested(value, ["scripts"])),
    raw: value
  };
}

function readNested(value: Record<string, unknown>, path: string[]): Record<string, unknown> {
  let current: unknown = value;
  for (const key of path) {
    current = current && typeof current === "object" ? (current as Record<string, unknown>)[key] : null;
  }
  return current && typeof current === "object" ? current as Record<string, unknown> : {};
}

function pickRecord(source: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}
