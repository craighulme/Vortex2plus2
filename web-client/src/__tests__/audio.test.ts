import { describe, expect, it } from "vitest";
import { AudioService } from "../audio/AudioService";

class FakeAudio extends EventTarget {
  currentTime = 0;
  loop = false;
  preload = "";
  volume = 1;
  playCount = 0;
  sinkId = "";

  constructor(readonly url: string) {
    super();
  }

  play(): Promise<void> {
    this.playCount++;
    return Promise.resolve();
  }

  setSinkId(value: string): Promise<void> {
    this.sinkId = value;
    return Promise.resolve();
  }
}

function makeStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

function makeWindow(seed: Record<string, string> = {}) {
  return {
    Audio: FakeAudio,
    HTMLMediaElement: { prototype: { setSinkId() {} } },
    localStorage: makeStorage(seed),
    navigator: {
      mediaDevices: {
        enumerateDevices: () => Promise.resolve([
          { kind: "audiooutput", deviceId: "speaker-1", label: "Speakers" },
          { kind: "audioinput", deviceId: "mic-1", label: "Microphone" }
        ])
      }
    }
  } as unknown as Window;
}

function makeDocument() {
  return {
    createElement(tag: string) {
      return {
        tag,
        value: "",
        textContent: "",
        innerHTML: "",
        options: [] as unknown[],
        appendChild(child: unknown) {
          (this as { options: unknown[] }).options.push(child);
        }
      };
    }
  } as unknown as Document;
}

describe("AudioService", () => {
  it("owns game sound volume and playback state", async () => {
    const windowRef = makeWindow({
      "Master volume": "0.5",
      "Sfx volume": "0.8"
    });
    const service = new AudioService(windowRef, makeDocument());

    const sounds = service.registerGameSounds({ oof: "/oof.mp3", ui: "/ui.mp3" });
    expect(sounds.oof?.volume).toBeCloseTo(0.4);
    expect(sounds.ui?.volume).toBeCloseTo(0.4);

    await expect(service.playSound("ui")).resolves.toMatchObject({ ok: false, status: "disabled" });
    expect((sounds.ui as unknown as FakeAudio).playCount).toBe(0);

    service.markCanPlaySounds();
    await expect(service.playSound("ui")).resolves.toMatchObject({ ok: true, status: "played" });
    expect((sounds.ui as unknown as FakeAudio).playCount).toBe(1);
  });

  it("has an explicit console-friendly test path", async () => {
    const windowRef = makeWindow();
    const service = new AudioService(windowRef, makeDocument());
    const sounds = service.registerGameSounds({ oof: "/oof.mp3" });

    await expect(service.testSound()).resolves.toMatchObject({ ok: true, status: "played" });

    expect(service.snapshot().canPlaySounds).toBe(true);
    expect((sounds.oof as unknown as FakeAudio).playCount).toBe(1);
  });

  it("persists slider values and reapplies volumes", () => {
    const windowRef = makeWindow();
    const service = new AudioService(windowRef, makeDocument());
    const sounds = service.registerGameSounds({ oof: "/oof.mp3" });

    service.setMasterVolume(0.25);
    service.setSfxVolume(0.5);

    expect(service.snapshot()).toMatchObject({ masterVolume: 0.25, sfxVolume: 0.5 });
    expect(sounds.oof?.volume).toBeCloseTo(0.125);
  });

  it("populates input and output selectors from browser devices", async () => {
    const windowRef = makeWindow({ vwebAudioOutput: "speaker-1", vwebAudioInput: "mic-1" });
    const documentRef = makeDocument();
    const outputSelect = documentRef.createElement("select") as HTMLSelectElement;
    const inputSelect = documentRef.createElement("select") as HTMLSelectElement;
    const status = { textContent: "", classList: { toggle() {} } } as unknown as HTMLElement;
    const service = new AudioService(windowRef, documentRef);

    service.attach({ outputSelect, inputSelect, status });
    await service.populateDevices();

    expect(outputSelect.value).toBe("speaker-1");
    expect(inputSelect.value).toBe("mic-1");
    expect(status.textContent).toContain("Found");
  });
});
