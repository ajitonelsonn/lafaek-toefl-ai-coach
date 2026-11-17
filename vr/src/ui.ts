/**
 * Spatial UI built from canvas textures: text panels and pinchable buttons. Sizes are metres;
 * text is drawn at 1000 px per metre, so a 36 px font is 3.6 cm tall (readable at ~1 m).
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Entity,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PokeInteractable,
  RayInteractable,
  SRGBColorSpace,
  World,
} from '@iwsdk/core';
import { forget, onPress } from './clicks.js';
import { Clickable } from './interaction.js';

export const C = {
  primary: '#1769f5',
  primaryDark: '#2149b8',
  ink: '#101b4d',
  body: '#3c4a73',
  muted: '#6b7799',
  soft: '#eaf2ff',
  surface: '#ffffff',
  line: '#d7e2f7',
  success: '#15803d',
  successSoft: '#e7f7ec',
  danger: '#c2410c',
  dangerSoft: '#fff1e8',
  listening: '#0e7490',
  speaking: '#7c3aed',
  writing: '#b45309',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PPM = 1000;

export type Ctx = CanvasRenderingContext2D;

export function font(size: number, weight = 500): string {
  return `${weight} ${size}px ${FONT}`;
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws wrapped text and returns the y below the last line. Stops after maxLines with an ellipsis. */
export function wrap(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 99): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines++;
      if (lines === maxLines) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineH;
      }
      ctx.fillText(line, x, y);
      y += lineH;
      line = words[i];
    } else line = test;
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

/** A flat panel whose face is a canvas you can redraw at any time. */
export class CanvasPanel {
  readonly mesh: Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
  readonly W: number;
  readonly H: number;
  private readonly tex: CanvasTexture;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.W = this.canvas.width = Math.round(width * PPM);
    this.H = this.canvas.height = Math.round(height * PPM);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false });
    this.mesh = new Mesh(new PlaneGeometry(width, height), mat);
  }

  draw(fn: (ctx: Ctx, W: number, H: number) => void): void {
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.ctx.textBaseline = 'top';
    fn(this.ctx, this.W, this.H);
    this.tex.needsUpdate = true;
  }

  /**
   * Frosted-glass card, the base look of every panel: translucent white with a soft top
   * highlight and a thin blue edge. Coloured fills (results) are drawn solid.
   */
  card(fill = C.surface, stroke = C.line, radius = 36): void {
    const { ctx, W, H } = this;
    const glass = fill === C.surface;
    roundRect(ctx, 3, 3, W - 6, H - 6, radius);
    ctx.fillStyle = glass ? 'rgba(255, 255, 255, 0.86)' : fill;
    ctx.fill();
    if (glass) {
      const shine = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      shine.addColorStop(0, 'rgba(234, 242, 255, 0.9)');
      shine.addColorStop(1, 'rgba(234, 242, 255, 0)');
      ctx.fillStyle = shine;
      ctx.fill();
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = glass && stroke === C.line ? 'rgba(61, 139, 255, 0.45)' : stroke;
    ctx.stroke();
  }
}

/**
 * Hidden objects must not catch the hand ray (an invisible panel would block what is behind it),
 * so hiding removes the pointer components and showing adds them back.
 */
export function setPointerTarget(entity: Entity, on: boolean, poke = false): void {
  if (on) {
    if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    if (poke && !entity.hasComponent(PokeInteractable)) entity.addComponent(PokeInteractable);
  } else {
    if (entity.hasComponent(RayInteractable)) entity.removeComponent(RayInteractable);
    if (entity.hasComponent(PokeInteractable)) entity.removeComponent(PokeInteractable);
  }
}

/** Tracks the entities one screen creates, so leaving the screen frees all of them. */
export class Scope {
  private readonly entities: Entity[] = [];
  private readonly cleanups: (() => void)[] = [];
  constructor(
    readonly world: World,
    readonly parent: Entity,
  ) {}

  add(obj: Object3D, parent: Entity = this.parent): Entity {
    const e = this.world.createTransformEntity(obj, { parent });
    this.entities.push(e);
    return e;
  }

  panel(width: number, height: number, x: number, y: number, z: number, parent?: Entity): { panel: CanvasPanel; entity: Entity } {
    const panel = new CanvasPanel(width, height);
    panel.mesh.position.set(x, y, z);
    faceViewer(panel.mesh);
    return { panel, entity: this.add(panel.mesh, parent) };
  }

  /** Runs when the screen closes (e.g. to stop listening for updates). */
  onDispose(fn: () => void): void {
    this.cleanups.push(fn);
  }

  dispose(): void {
    for (const fn of this.cleanups.splice(0)) fn();
    for (let i = this.entities.length - 1; i >= 0; i--) {
      forget(this.entities[i]);
      this.entities[i].dispose();
    }
    this.entities.length = 0;
  }
}

/** Turns a panel at its position to face a seated viewer at the origin, eye height ~1.2 m. */
export function faceViewer(obj: Object3D, eyeY = 1.2): void {
  const { x, y, z } = obj.position;
  obj.rotation.set(Math.atan2(y - eyeY, -z) * 0.6, Math.atan2(-x, -z), 0, 'YXZ');
}

export type Tone = 'primary' | 'secondary' | 'soft' | 'success' | 'danger' | 'ghost';

export interface ButtonSpec {
  w: number;
  h: number;
  label: string;
  sub?: string;
  icon?: HTMLImageElement | null;
  tone?: Tone;
  enabled?: boolean;
  /** The learner's chosen answer: stays fully visible while disabled. */
  selected?: boolean;
  /** Also pressable by touching it with the index finger (for buttons within arm's reach). */
  poke?: boolean;
}

/** A pinchable button: a canvas panel with RayInteractable + Clickable and hover feedback. */
export class Button {
  readonly panel: CanvasPanel;
  readonly entity: Entity;
  private hovered = false;

  constructor(
    scope: Scope,
    private spec: ButtonSpec,
    x: number,
    y: number,
    z: number,
    onClick: () => void,
    parent?: Entity,
  ) {
    const made = scope.panel(spec.w, spec.h, x, y, z, parent);
    this.panel = made.panel;
    this.entity = made.entity;
    this.panel.mesh.name = `Btn_${spec.label.replace(/\W+/g, '')}`;
    this.entity.addComponent(RayInteractable);
    if (spec.poke) this.entity.addComponent(PokeInteractable);
    this.entity.addComponent(Clickable, { enabled: spec.enabled !== false });
    onPress(
      this.entity,
      () => {
        if (this.spec.enabled === false) return;
        onClick();
      },
      (on) => {
        this.hovered = on;
        this.render();
      },
    );
    this.render();
  }

  update(patch: Partial<ButtonSpec>): void {
    this.spec = { ...this.spec, ...patch };
    this.entity.setValue(Clickable, 'enabled', this.spec.enabled !== false);
    this.render();
  }

  set visible(v: boolean) {
    this.panel.mesh.visible = v;
    this.entity.setValue(Clickable, 'enabled', v && this.spec.enabled !== false);
    setPointerTarget(this.entity, v, this.spec.poke);
  }

  private render(): void {
    const { label, sub, icon, tone = 'secondary', enabled = true, selected = false } = this.spec;
    const hover = this.hovered && enabled;
    const palette: Record<Tone, [string, string, string]> = {
      primary: [hover ? C.primaryDark : C.primary, C.primaryDark, '#ffffff'],
      secondary: [hover ? C.soft : C.surface, hover ? C.primary : C.line, C.ink],
      soft: [hover ? '#d6e6ff' : C.soft, hover ? C.primary : '#c5d8fb', C.primaryDark],
      success: [hover ? '#d3f1dc' : C.successSoft, C.success, C.success],
      danger: [hover ? '#ffe2d1' : C.dangerSoft, C.danger, C.danger],
      ghost: [hover ? 'rgba(234,242,255,0.95)' : 'rgba(255,255,255,0.85)', C.line, C.ink],
    };
    const [fill, stroke, text] = palette[tone];
    this.panel.draw((ctx, W, H) => {
      // Answered choices (success/danger) stay fully visible even though they are disabled.
      ctx.globalAlpha = enabled || selected || tone === 'success' || tone === 'danger' ? 1 : 0.45;
      roundRect(ctx, 4, 4, W - 8, H - 8, Math.min(H / 2 - 4, 40));
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = hover ? 8 : 5;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      let size = Math.min(44, Math.round(H * (sub ? 0.32 : 0.42)));
      const iconSize = icon ? Math.round(H * 0.62) : 0;
      // Long labels (real answer options can be a full sentence) shrink to fit the button.
      const room = W - 56 - (icon ? iconSize + 18 : 0);
      ctx.font = font(size, 700);
      while (size > 20 && ctx.measureText(label).width > room) ctx.font = font((size -= 1), 700);
      const textW = Math.max(ctx.measureText(label).width, sub ? (ctx.font = font(Math.round(size * 0.66), 500), ctx.measureText(sub).width) : 0);
      const gap = icon ? 18 : 0;
      let x = (W - (iconSize + gap + textW)) / 2;
      if (icon) {
        ctx.drawImage(icon, x, (H - iconSize) / 2, iconSize, iconSize);
        x += iconSize + gap;
      }
      ctx.fillStyle = text;
      ctx.textBaseline = 'middle';
      ctx.font = font(size, 700);
      ctx.fillText(label, x, sub ? H * 0.38 : H / 2 + 2);
      if (sub) {
        ctx.font = font(Math.round(size * 0.66), 500);
        ctx.globalAlpha = enabled ? 0.8 : 0.4;
        ctx.fillText(sub, x, H * 0.7);
      }
      ctx.globalAlpha = 1;
    });
  }
}

/**
 * A soft glowing frame behind a panel (the "hologram" look). It is a child of the panel mesh, so
 * it moves with it; `setStrength` brightens it on hover.
 */
export function addGlow(panel: CanvasPanel, color = '#3d8bff'): { setStrength: (k: number) => void } {
  const pad = 0.035;
  const c = document.createElement('canvas');
  const W = (c.width = Math.round((panel.width + pad * 2) * 400));
  const H = (c.height = Math.round((panel.height + pad * 2) * 400));
  const g = c.getContext('2d')!;
  const inset = pad * 400;
  g.shadowColor = color;
  g.shadowBlur = inset * 0.9;
  g.strokeStyle = color;
  g.lineWidth = 6;
  roundRect(g, inset, inset, W - inset * 2, H - inset * 2, 16);
  g.stroke();
  g.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(new PlaneGeometry(panel.width + pad * 2, panel.height + pad * 2), mat);
  mesh.position.z = -0.004;
  mesh.raycast = () => {}; // never blocks the pinch ray
  // Nor a finger touch: the glow is larger than its panel, so neighbouring glows overlap.
  (mesh as unknown as { pointerEvents: string }).pointerEvents = 'none';
  panel.mesh.add(mesh);
  return { setStrength: (k: number) => (mat.opacity = 0.35 + k * 0.6) };
}

/** An answer card: round letter badge (check / cross after checking) and text that wraps to two lines. */
export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

export class OptionCard {
  private readonly panel: CanvasPanel;
  private readonly entity: Entity;
  private letter = '';
  private text = '';
  private state: OptionState = 'idle';
  private enabled = true;
  private hover = false;

  constructor(sound: { play: (name: 'hover', volume?: number) => void }, scope: Scope, i: number, x: number, y: number, z: number, onPick: () => void, size: { w: number; h: number } = { w: 0.45, h: 0.088 }) {
    const made = scope.panel(size.w, size.h, x, y, z);
    this.panel = made.panel;
    this.entity = made.entity;
    this.panel.mesh.name = `Option_${'ABCD'[i]}`;
    this.entity.addComponent(RayInteractable);
    this.entity.addComponent(Clickable);
    onPress(
      this.entity,
      () => this.enabled && onPick(),
      (on) => {
        this.hover = on && this.enabled;
        if (this.hover) sound.play('hover', 0.2);
        this.render();
      },
    );
    this.visible = false;
  }

  set visible(v: boolean) {
    this.panel.mesh.visible = v;
    this.entity.setValue(Clickable, 'enabled', v && this.enabled);
    setPointerTarget(this.entity, v);
  }

  set(letter: string, text: string): void {
    this.letter = letter;
    this.text = text;
    this.state = 'idle';
    this.setEnabled(true);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.entity.setValue(Clickable, 'enabled', on && this.panel.mesh.visible);
    if (!on) this.hover = false;
    this.render();
  }

  setState(state: OptionState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    const { state, hover } = this;
    const look: Record<OptionState, { fill: string; stroke: string; badge: string; text: string }> = {
      idle: { fill: hover ? '#f1f6ff' : 'rgba(255,255,255,0.92)', stroke: hover ? C.primary : 'rgba(61,139,255,0.4)', badge: C.primary, text: C.ink },
      selected: { fill: C.soft, stroke: C.primary, badge: C.primary, text: C.ink },
      correct: { fill: C.successSoft, stroke: C.success, badge: C.success, text: C.success },
      wrong: { fill: C.dangerSoft, stroke: C.danger, badge: C.danger, text: C.danger },
      dim: { fill: 'rgba(255,255,255,0.7)', stroke: C.line, badge: '#9aa6c2', text: C.muted },
    };
    const l = look[state];
    this.panel.draw((ctx, W, H) => {
      roundRect(ctx, 4, 4, W - 8, H - 8, 24);
      ctx.fillStyle = l.fill;
      ctx.fill();
      ctx.lineWidth = state === 'idle' && !hover ? 4 : 7;
      ctx.strokeStyle = l.stroke;
      ctx.stroke();
      // Letter badge, or ✓ / ✗ once checked.
      const cx = 46;
      const cy = H / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fillStyle = l.badge;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 5;
      if (state === 'correct' || state === 'wrong') {
        ctx.beginPath();
        if (state === 'correct') {
          ctx.moveTo(cx - 10, cy);
          ctx.lineTo(cx - 3, cy + 8);
          ctx.lineTo(cx + 11, cy - 8);
        } else {
          ctx.moveTo(cx - 8, cy - 8);
          ctx.lineTo(cx + 8, cy + 8);
          ctx.moveTo(cx + 8, cy - 8);
          ctx.lineTo(cx - 8, cy + 8);
        }
        ctx.stroke();
      } else {
        ctx.font = font(24, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.letter, cx, cy + 1);
        ctx.textAlign = 'left';
      }
      // Answer text: up to two lines, slightly smaller only when it would need three.
      ctx.fillStyle = l.text;
      ctx.textBaseline = 'top';
      let size = 27;
      const maxW = W - 100;
      const lines = (sz: number) => {
        ctx.font = font(sz, 700);
        let n = 1;
        let line = '';
        for (const word of this.text.split(/\s+/)) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxW && line) {
            n++;
            line = word;
          } else line = test;
        }
        return n;
      };
      while (size > 21 && lines(size) > 2) size -= 1;
      const n = Math.min(2, lines(size));
      const lh = size * 1.2;
      wrap(ctx, this.text, 84, (H - n * lh) / 2 + 2, maxW, lh, 2);
    });
  }
}

