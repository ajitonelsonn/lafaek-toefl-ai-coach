/**
 * Sound: short UI effects (non-positional) and spatial voices (positional, from a speaker's
 * position in the room). All audio shares one AudioListener on the camera.
 */
import { AudioAnalyser, AudioListener, Object3D, PositionalAudio, World } from '@iwsdk/core';

const BASE = import.meta.env.BASE_URL;

export const SFX = {
  click: 'audio/ui-click.ogg',
  hover: 'audio/ui-hover.ogg',
  toggle: 'audio/ui-toggle.ogg',
  grab: 'audio/card-grab.ogg',
  land: 'audio/card-land.ogg',
  drop: 'audio/card-drop.ogg',
  place: 'audio/tray-place.ogg',
  full: 'audio/tray-full.ogg',
  micOn: 'audio/mic-on.ogg',
  micOff: 'audio/mic-off.ogg',
  open: 'audio/panel-open.ogg',
  close: 'audio/panel-close.ogg',
  appear: 'audio/sfx-card-appear.mp3',
  done: 'audio/sfx-done-chime.mp3',
  whoosh: 'audio/sfx-flick-whoosh.mp3',
  grow: 'audio/sfx-plant-grow.mp3',
  thinking: 'audio/sfx-agent-thinking.mp3',
} as const;

export type SfxName = keyof typeof SFX;

export class Sound {
  readonly listener = new AudioListener();
  private readonly buffers = new Map<string, AudioBuffer>();
  private loop: { stop: () => void } | null = null;

  constructor(world: World) {
    world.camera.add(this.listener);
    // Load every effect in the background; a missing file only means silence.
    for (const [name, file] of Object.entries(SFX)) void this.load(name, `${BASE}${file}`);
  }

  get ctx(): AudioContext {
    return this.listener.context;
  }

  /** Browsers start audio suspended until a user gesture; call from any press. */
  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  async load(name: string, url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      this.buffers.set(name, await this.ctx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // Unsupported or missing file: stay silent.
    }
  }

  play(name: SfxName, volume = 0.5): void {
    const buf = this.buffers.get(name);
    if (!buf) return;
    this.resume();
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain).connect(this.listener.getInput());
    src.start();
  }

  /** Loops an effect quietly (e.g. while the AI is scoring) until stopLoop(). */
  startLoop(name: SfxName, volume = 0.25): void {
    this.stopLoop();
    const buf = this.buffers.get(name);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.loop = true;
    src.connect(gain).connect(this.listener.getInput());
    src.start();
    this.loop = { stop: () => src.stop() };
  }

  stopLoop(): void {
    this.loop?.stop();
    this.loop = null;
  }

  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(data);
  }

  /** A positional voice attached to an object (a speaker in the room). */
  voice(at: Object3D): Voice {
    return new Voice(this, at);
  }
}

export class Voice {
  private readonly audio: PositionalAudio;
  private analyser: AudioAnalyser | null = null;
  private smooth = 0;

  constructor(
    private readonly sound: Sound,
    at: Object3D,
  ) {
    this.audio = new PositionalAudio(sound.listener);
    this.audio.setRefDistance(0.8);
    this.audio.setRolloffFactor(1.2);
    this.audio.setDistanceModel('inverse');
    at.add(this.audio);
  }

  /** Plays a buffer and resolves when it ends (or is stopped). */
  play(buffer: AudioBuffer, volume = 1): Promise<void> {
    this.sound.resume();
    this.stop();
    return new Promise((resolve) => {
      this.audio.setBuffer(buffer);
      this.audio.setVolume(volume);
      const ended = PositionalAudio.prototype.onEnded;
      this.audio.onEnded = () => {
        ended.call(this.audio); // resets isPlaying
        resolve();
      };
      this.audio.play();
    });
  }

  /**
   * How loud the voice is right now, 0–1, smoothed so a mouth driven by it opens and closes
   * naturally. 0 when nothing is playing.
   */
  level(): number {
    if (!this.audio.isPlaying) return (this.smooth = 0);
    this.analyser ??= new AudioAnalyser(this.audio, 64);
    // Speech energy sits in the lower bins; about 30 of 255 is quiet speech, 110 is loud.
    const raw = Math.min(1, Math.max(0, (this.analyser.getAverageFrequency() - 18) / 80));
    this.smooth += (raw - this.smooth) * (raw > this.smooth ? 0.6 : 0.25);
    return this.smooth;
  }

  stop(): void {
    if (this.audio.isPlaying) this.audio.stop();
  }

  /** Whether a clip is playing now. */
  get playing(): boolean {
    return this.audio.isPlaying;
  }

  dispose(): void {
    this.stop();
    this.audio.removeFromParent();
  }
}

/** Speaks text with the browser voice (fallback while a question's audio file is not ready yet). */
export function speak(text: string, opts: { pitch?: number; rate?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) {
      setTimeout(resolve, Math.min(8000, 400 + text.length * 55));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1;
    // Some browsers never fire `end`; resolve after a generous estimate as a fallback.
    const fallback = setTimeout(resolve, 1500 + text.length * 90);
    u.onend = u.onerror = () => {
      clearTimeout(fallback);
      resolve();
    };
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
