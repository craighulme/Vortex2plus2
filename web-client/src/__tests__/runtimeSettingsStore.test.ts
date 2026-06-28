import { describe, expect, it } from "vitest";
import { RuntimeSettingsStore } from "../runtime/RuntimeSettingsStore";

function storage(values: Record<string, string>): Storage {
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem() {},
    removeItem() {},
    clear() {},
    key: () => null,
    length: Object.keys(values).length
  };
}

describe("RuntimeSettingsStore", () => {
  it("reads boolean flags from stored strings", () => {
    const store = new RuntimeSettingsStore(storage({ a: "1", b: "true", c: "off" }));

    expect(store.readFlag("a")).toBe(true);
    expect(store.readFlag("b")).toBe(true);
    expect(store.readFlag("c", true)).toBe(false);
    expect(store.readFlag("missing", true)).toBe(true);
  });

  it("reads clamped numeric settings", () => {
    const store = new RuntimeSettingsStore(storage({ pixel: "3", bad: "wat" }));

    expect(store.readNumber("pixel", 1, 0.5, 2)).toBe(2);
    expect(store.readNumber("bad", 1, 0.5, 2)).toBe(1);
  });
});
