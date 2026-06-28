export type AudioTone = "" | "warn" | "error";

export type AudioElements = {
  outputSelect?: HTMLSelectElement | null;
  inputSelect?: HTMLSelectElement | null;
  status?: HTMLElement | null;
};

export type GameSoundName = string;

export type GameSoundUrls = Record<GameSoundName, string | undefined>;

export type GameMusicOptions = {
  url?: string;
};

export type AudioSnapshot = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  chatVolume: number;
  outputDeviceId: string;
  inputDeviceId: string;
  canPlaySounds: boolean;
  sounds: string[];
  musicPlaying: boolean;
};

export type AudioPlayResult = {
  ok: boolean;
  sound: GameSoundName;
  status: "played" | "disabled" | "missing" | "blocked";
  error?: string;
};

export type AudioPlayOptions = {
  force?: boolean;
};

type AudioLike = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type RuntimeWindow = Window & {
  Audio: new (url?: string) => HTMLAudioElement;
  HTMLMediaElement?: typeof HTMLMediaElement;
};

const STORAGE = {
  master: "Master volume",
  music: "Music volume",
  sfx: "Sfx volume",
  chat: "Chat volume",
  output: "vwebAudioOutput",
  input: "vwebAudioInput"
} as const;

export class AudioService {
  private outputSelect: HTMLSelectElement | null = null;
  private inputSelect: HTMLSelectElement | null = null;
  private status: HTMLElement | null = null;
  private readonly sounds = new Map<GameSoundName, AudioLike>();
  private music: AudioLike | null = null;
  private canPlaySounds = false;
  private masterVolume: number;
  private musicVolume: number;
  private sfxVolume: number;
  private chatVolume: number;

  constructor(private readonly windowRef: Window, private readonly documentRef: Document) {
    this.masterVolume = this.readVolume(STORAGE.master, 1);
    this.musicVolume = this.readVolume(STORAGE.music, 0.9);
    this.sfxVolume = this.readVolume(STORAGE.sfx, 1);
    this.chatVolume = this.readVolume(STORAGE.chat, 1);
  }

  attach(elements: AudioElements): void {
    this.outputSelect = elements.outputSelect ?? null;
    this.inputSelect = elements.inputSelect ?? null;
    this.status = elements.status ?? null;

    if (this.outputSelect) {
      this.outputSelect.onchange = async () => {
        this.windowRef.localStorage.setItem(STORAGE.output, this.outputSelect?.value || "");
        const routed = await this.applyOutputToAll();
        this.setStatus(
          routed || !this.selectedOutputId()
            ? "Output device saved."
            : "Output saved, but this browser did not apply it to existing sounds.",
          routed ? "" : "warn"
        );
      };
    }

    if (this.inputSelect) {
      this.inputSelect.onchange = () => {
        this.windowRef.localStorage.setItem(STORAGE.input, this.inputSelect?.value || "");
      };
    }
  }

  registerGameSounds(urls: GameSoundUrls): Record<GameSoundName, AudioLike | null> {
    const registered: Record<GameSoundName, AudioLike | null> = {};
    for (const [name, url] of Object.entries(urls)) {
      if (!url || this.sounds.has(name)) continue;
      const audio = new (this.windowRef as RuntimeWindow).Audio(url) as AudioLike;
      audio.preload = "auto";
      this.sounds.set(name, audio);
      registered[name] = audio;
      void this.applyOutputTo(audio);
    }
    this.applyVolumes();
    for (const name of Object.keys(urls)) registered[name] = this.sounds.get(name) ?? null;
    return registered;
  }

  getSound(name: GameSoundName): AudioLike | null {
    return this.sounds.get(name) ?? null;
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clamp01(value);
    this.windowRef.localStorage.setItem(STORAGE.master, String(this.masterVolume));
    this.applyVolumes();
  }

  setMusicVolume(value: number): void {
    this.musicVolume = clamp01(value);
    this.windowRef.localStorage.setItem(STORAGE.music, String(this.musicVolume));
    this.applyVolumes();
  }

  setSfxVolume(value: number): void {
    this.sfxVolume = clamp01(value);
    this.windowRef.localStorage.setItem(STORAGE.sfx, String(this.sfxVolume));
    this.applyVolumes();
  }

  setChatVolume(value: number): void {
    this.chatVolume = clamp01(value);
    this.windowRef.localStorage.setItem(STORAGE.chat, String(this.chatVolume));
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  getChatVolume(): number {
    return this.chatVolume;
  }

  volumeLabel(value: number): string {
    return `${Math.round(Number(value) * 100)}%`;
  }

  markCanPlaySounds(): void {
    this.canPlaySounds = true;
  }

  canPlay(): boolean {
    return this.canPlaySounds;
  }

  async startMusic(options: GameMusicOptions): Promise<void> {
    if (!options.url || this.music) return;
    const music = new (this.windowRef as RuntimeWindow).Audio(options.url) as AudioLike;
    music.loop = true;
    music.preload = "auto";
    music.addEventListener("ended", function restart() {
      this.currentTime = 0;
      void this.play();
    }, false);
    this.music = music;
    await this.applyOutputTo(music);
    this.applyVolumes();
    await music.play();
  }

  async playSound(name: GameSoundName, options: AudioPlayOptions = {}): Promise<AudioPlayResult> {
    if (!this.canPlaySounds && !options.force) return { ok: false, sound: name, status: "disabled" };
    const sound = this.sounds.get(name);
    if (!sound) return { ok: false, sound: name, status: "missing" };
    sound.currentTime = 0;
    try {
      await sound.play();
      return { ok: true, sound: name, status: "played" };
    } catch (error) {
      return {
        ok: false,
        sound: name,
        status: "blocked",
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      };
    }
  }

  async testSound(name: GameSoundName = this.firstSoundName() ?? "oof"): Promise<AudioPlayResult> {
    this.markCanPlaySounds();
    this.applyVolumes();
    return this.playSound(name, { force: true });
  }

  async populateDevices(): Promise<void> {
    if (!this.outputSelect || !this.inputSelect) return;
    const mediaDevices = this.windowRef.navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) {
      this.outputSelect.innerHTML = '<option value="">Default output</option>';
      this.inputSelect.innerHTML = '<option value="">Default microphone</option>';
      this.setStatus("This browser does not expose audio device selection on this page.", "warn");
      return;
    }

    const devices = await mediaDevices.enumerateDevices();
    this.fillSelect(this.outputSelect, devices, "audiooutput", this.selectedOutputId(), "output");
    this.fillSelect(this.inputSelect, devices, "audioinput", this.selectedInputId(), "microphone");

    const outputCount = devices.filter((device) => device.kind === "audiooutput").length;
    const inputCount = devices.filter((device) => device.kind === "audioinput").length;
    const mediaElement = (this.windowRef as RuntimeWindow).HTMLMediaElement;
    const canRouteOutput = typeof mediaElement !== "undefined"
      && typeof mediaElement.prototype.setSinkId === "function";

    if (!canRouteOutput) {
      this.setStatus("Output device switching is not supported by this browser. The default output will be used.", "warn");
    } else if (inputCount === 0 && outputCount === 0) {
      this.setStatus(
        this.microphoneAllowedByPolicy()
          ? "No audio devices were exposed yet. Click Enable microphone list so the browser can ask permission."
          : "Microphone access is blocked by this page policy. Reload the extension and game page, then try again.",
        "warn"
      );
    } else {
      this.setStatus(`Found ${inputCount || 1} microphone option(s) and ${outputCount || 1} output option(s).`);
    }
  }

  async requestMicrophoneDeviceList(warn?: (message: string) => void): Promise<boolean> {
    const mediaDevices = this.windowRef.navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      this.setStatus("Microphone selection is not supported by this browser on this page.", "error");
      warn?.("Microphone selection is not supported in this browser.");
      return false;
    }
    if (!this.microphoneAllowedByPolicy()) {
      this.setStatus("Microphone access is blocked by the game page policy. Reload the extension and launch the game again so the updated permission rule can apply.", "error");
      warn?.("Microphone access is blocked by the page policy.");
      return false;
    }

    let stream: MediaStream | null = null;
    try {
      this.setStatus("Waiting for browser microphone permission...");
      const deviceId = this.selectedInputId() || undefined;
      stream = await mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      });
      await this.populateDevices();
      this.setStatus("Microphone permission granted. Device lists have been refreshed.");
      return true;
    } catch (error) {
      const name = readErrorName(error);
      const detail = name === "NotAllowedError"
        ? "The browser blocked microphone access. Check the site permission icon in the address bar, then try again."
        : `Microphone request failed: ${name}`;
      this.setStatus(detail, "error");
      warn?.("Microphone permission was not granted.");
      return false;
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  async testOutput(): Promise<void> {
    this.markCanPlaySounds();
    this.applyVolumes();
    const soundName = this.firstSoundName();
    if (!soundName) {
      this.setStatus("No test sound is loaded yet.", "error");
      return;
    }
    const routed = await this.applyOutputTo(this.sounds.get(soundName) ?? null);
    const result = await this.playSound(soundName, { force: true });
    if (result.status === "missing") {
      this.setStatus("No test sound is loaded yet.", "error");
      return;
    }
    if (result.ok) {
      this.setStatus(
        routed ? "Played test sound through the selected output." : "Played test sound through the browser default output.",
        routed ? "" : "warn"
      );
    } else {
      this.setStatus(`The browser blocked the test sound. Click in the game once, then try again. ${result.error || ""}`.trim(), "error");
    }
  }

  async applyOutputToAll(): Promise<boolean> {
    const results = await Promise.all(this.allAudio().map((audio) => this.applyOutputTo(audio)));
    return results.some(Boolean);
  }

  applyVolumes(): void {
    if (this.music) this.music.volume = this.masterVolume * this.musicVolume;
    for (const sound of this.sounds.values()) sound.volume = this.masterVolume * this.sfxVolume;
  }

  snapshot(): AudioSnapshot {
    return {
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      chatVolume: this.chatVolume,
      outputDeviceId: this.selectedOutputId(),
      inputDeviceId: this.selectedInputId(),
      canPlaySounds: this.canPlaySounds,
      sounds: [...this.sounds.keys()],
      musicPlaying: Boolean(this.music)
    };
  }

  private selectedOutputId(): string {
    return this.windowRef.localStorage.getItem(STORAGE.output) || "";
  }

  private selectedInputId(): string {
    return this.windowRef.localStorage.getItem(STORAGE.input) || "";
  }

  private async applyOutputTo(audio: AudioLike | null): Promise<boolean> {
    if (!audio?.setSinkId) return false;
    try {
      await audio.setSinkId(this.selectedOutputId());
      return true;
    } catch {
      return false;
    }
  }

  private allAudio(): AudioLike[] {
    return [this.music, ...this.sounds.values()].filter(Boolean) as AudioLike[];
  }

  private firstSoundName(): string | null {
    return this.sounds.keys().next().value ?? null;
  }

  private setStatus(message: string, tone: AudioTone = ""): void {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle("warn", tone === "warn");
    this.status.classList.toggle("error", tone === "error");
  }

  private fillSelect(
    select: HTMLSelectElement,
    devices: MediaDeviceInfo[],
    kind: MediaDeviceKind,
    selected: string,
    fallbackLabel: string
  ): void {
    const matches = devices.filter((device) => device.kind === kind);
    select.innerHTML = "";
    const def = this.documentRef.createElement("option");
    def.value = "";
    def.textContent = `Default ${fallbackLabel}`;
    select.appendChild(def);
    matches.forEach((device, index) => {
      const option = this.documentRef.createElement("option");
      option.value = device.deviceId;
      option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
      select.appendChild(option);
    });
    select.value = [...select.options].some((option) => option.value === selected) ? selected : "";
  }

  private microphoneAllowedByPolicy(): boolean {
    const policy = (this.documentRef as Document & {
      permissionsPolicy?: { allowsFeature?: (feature: string) => boolean; allowedFeatures?: () => string[] };
      featurePolicy?: { allowsFeature?: (feature: string) => boolean; allowedFeatures?: () => string[] };
    }).permissionsPolicy || (this.documentRef as Document & {
      featurePolicy?: { allowsFeature?: (feature: string) => boolean; allowedFeatures?: () => string[] };
    }).featurePolicy;
    if (!policy) return true;
    try {
      if (typeof policy.allowsFeature === "function") return policy.allowsFeature("microphone");
      if (typeof policy.allowedFeatures === "function") return policy.allowedFeatures().includes("microphone");
    } catch {}
    return true;
  }

  private readVolume(key: string, fallback: number): number {
    const value = Number(this.windowRef.localStorage.getItem(key));
    return Number.isFinite(value) ? clamp01(value) : fallback;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function readErrorName(error: unknown): string {
  if (!error || typeof error !== "object") return "PermissionError";
  const typed = error as { name?: unknown };
  return typeof typed.name === "string" ? typed.name : "PermissionError";
}
