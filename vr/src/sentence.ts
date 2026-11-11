/**
 * Build a Sentence: word tiles lie on the desk. Pinch-and-drag a tile onto a slot (hands-first
 * grab), or pinch it once to send it to the next free slot; pinch a placed tile to send it back.
 * Each slot holds one tile. When every slot is full the learner checks the answer.
 */
import {
  BoxGeometry,
  CanvasTexture,
  createSystem,
  Entity,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  RayInteractable,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { ScreenFactory } from './app.js';
import { cancelTween, forget, onPress, tweenTo } from './clicks.js';
import { errorMessage, type CheckResult, type PartRole, type SentenceItem } from './data.js';
import { Clickable, WordTile } from './interaction.js';
import { DESK_Y, DESK_Z } from './room.js';
import { Button, C, CanvasPanel, font, roundRect, wrap } from './ui.js';

type Hand = 'left' | 'right';

/** Pinch-grab events for word tiles, forwarded to the open Build a Sentence screen. */
const pinchHooks: {
  start?: (hand: Hand, at: Vector3) => boolean;
  move?: (hand: Hand, at: Vector3) => void;
  end?: (hand: Hand) => void;
} = {};

/**
 * Near grab for hands (pinch) and controllers (squeeze): on selectstart/squeezestart the open
 * screen may claim the object under the fingertip or grip; it then follows that point each frame
 * until the pinch or squeeze ends. Ray pinches at a distance are handled as taps via RayInteractable.
 */
export class PinchGrabSystem extends createSystem({}) {
  private readonly at = new Vector3();
  private readonly held: Record<Hand, boolean> = { left: false, right: false };
  private bound: XRSession | null = null;

  private point(hand: Hand, source: XRInputSource): Vector3 {
    const spaces = this.world.playerSpaceEntities;
    const obj = (source.hand ? spaces.indexTipSpaces[hand] : spaces.gripSpaces[hand]).object3D!;
    return obj.getWorldPosition(this.at);
  }

  private readonly onStart = (e: XRInputSourceEvent) => {
    const hand = e.inputSource.handedness;
    if (hand !== 'left' && hand !== 'right') return;
    // Hands grab with a pinch (select); controllers with the grip (squeeze).
    if ((e.type === 'selectstart') !== Boolean(e.inputSource.hand)) return;
    this.held[hand] = pinchHooks.start?.(hand, this.point(hand, e.inputSource)) ?? false;
  };

  private readonly onEnd = (e: XRInputSourceEvent) => {
    const hand = e.inputSource.handedness;
    if ((hand !== 'left' && hand !== 'right') || !this.held[hand]) return;
    this.held[hand] = false;
    pinchHooks.end?.(hand);
  };

  private bind(session: XRSession | null): void {
    if (this.bound) {
      for (const t of ['selectstart', 'squeezestart'] as const) this.bound.removeEventListener(t, this.onStart);
      for (const t of ['selectend', 'squeezeend'] as const) this.bound.removeEventListener(t, this.onEnd);
    }
    this.bound = session;
    this.held.left = this.held.right = false;
    if (!session) return;
    for (const t of ['selectstart', 'squeezestart'] as const) session.addEventListener(t, this.onStart);
    for (const t of ['selectend', 'squeezeend'] as const) session.addEventListener(t, this.onEnd);
  }

  update(): void {
    const session = this.world.session ?? null;
    if (session !== this.bound) this.bind(session);
    if (!session) return;
    for (const source of session.inputSources) {
      const hand = source.handedness;
      if ((hand === 'left' || hand === 'right') && this.held[hand]) pinchHooks.move?.(hand, this.point(hand, source));
    }
  }
}

/** How close (m) the fingertip or grip must be to a tile to pick it up. */
const REACH = 0.07;

const TILE_H = 0.085;
const SNAP_DISTANCE = 0.13;
const SLOT_Y = 1.17;
const SLOT_Z = -0.9;

/** Width (m) of fixed sentence text drawn at 34 px. */
function textWidth(text: string): number {
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = font(34, 600);
  return c.measureText(text).width / 1000 + 0.02;
}

function measure(text: string): number {
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = font(40, 700);
  return Math.max(0.13, Math.min(0.3, (c.measureText(text).width + 60) / 1000));
}

type TileState = 'idle' | 'correct' | 'wrong';

/** A word tile: a thin box whose front face is a canvas, redrawn for its state after Check. */
function tileView(text: string, w: number): { mesh: Mesh; setState: (state: TileState) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * 1000);
  canvas.height = Math.round(TILE_H * 1000);
  const ctx = canvas.getContext('2d')!;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const side = new MeshLambertMaterial({ color: '#c9dbfb' });
  const face = new MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  const mesh = new Mesh(new BoxGeometry(w, TILE_H, 0.018), [side, side, side, side, face, side]);
  const setState = (state: TileState) => {
    const look = { idle: ['#ffffff', C.primary, C.ink], correct: [C.successSoft, C.success, C.success], wrong: [C.dangerSoft, C.danger, C.danger] }[state];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(ctx, 3, 3, canvas.width - 6, canvas.height - 6, 16);
    ctx.fillStyle = look[0];
    ctx.fill();
    ctx.lineWidth = state === 'idle' ? 6 : 9;
    ctx.strokeStyle = look[1];
    ctx.stroke();
    ctx.fillStyle = look[2];
    let size = 40;
    ctx.font = font(size, 700);
    while (size > 22 && ctx.measureText(text).width > canvas.width - 36) ctx.font = font((size -= 2), 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    if (state === 'wrong') {
      // Struck through, like the 2D feedback.
      const tw = Math.min(ctx.measureText(text).width, canvas.width - 30);
      ctx.fillRect((canvas.width - tw) / 2, canvas.height / 2 - 1, tw, 5);
    }
    side.color.set(state === 'idle' ? '#c9dbfb' : look[1]);
    tex.needsUpdate = true;
  };
  setState('idle');
  return { mesh, setState };
}

/** Role chips for "Why this order?" — the same labels and colours as the 2D practice page. */
const ROLES: Record<PartRole, { label: string; color: string; soft: string }> = {
  opener: { label: 'QUESTION OPENER', color: '#2f6fe4', soft: '#eaf2ff' },
  connector: { label: 'CONNECTOR', color: '#7444d6', soft: '#f3eeff' },
  subject: { label: 'SUBJECT', color: '#1769f5', soft: '#eaf2ff' },
  verb: { label: 'VERB', color: '#d4561f', soft: '#fff1e8' },
  object: { label: 'OBJECT', color: '#0f8a6b', soft: '#e6f6f0' },
  rest: { label: 'REST', color: '#3c4a73', soft: '#eef3fb' },
};

export const sentenceScreen: ScreenFactory = (app, scope) => {
  let items: SentenceItem[] = [];
  let index = 0;
  let tiles: { entity: Entity; mesh: Mesh; setState: (s: TileState) => void; home: Vector3; homeQ: Quaternion; token: number; slot: number; dragAt: number; grabFrom: Vector3 }[] = [];
  const drags: Partial<Record<Hand, { tile: (typeof tiles)[number]; offset: Vector3 }>> = {};
  let slots: { pos: Vector3; quat: Quaternion; tile: number }[] = [];
  let checking = false;
  let finished = false;

  // The task (before Check) and the feedback (after Check) share the space above the slots.
  const prompt = scope.panel(1.0, 0.2, 0, 1.5, -1.12).panel;
  const result = scope.panel(1.08, 0.38, 0, 1.53, -1.14).panel;
  result.mesh.visible = false;
  const status = scope.panel(0.6, 0.05, 0, 1.03, -0.88).panel;
  new Button(scope, { w: 0.22, h: 0.075, label: 'Back', icon: app.icon('ctl-back'), tone: 'ghost' }, -0.55, 0.96, -0.84, () => app.goHub());
  const clear = new Button(scope, { w: 0.2, h: 0.075, label: 'Clear', icon: app.icon('retry'), tone: 'secondary' }, -0.23, 0.96, -0.86, () => clearAll());
  const retry = new Button(scope, { w: 0.24, h: 0.075, label: 'Try again', icon: app.icon('retry'), tone: 'secondary' }, -0.13, 0.96, -0.86, () => tryAgain());
  retry.visible = false;
  const check = new Button(scope, { w: 0.24, h: 0.075, label: 'Check', icon: app.icon('success'), tone: 'primary', enabled: false }, 0.24, 0.96, -0.86, () => void runCheck());
  const next = new Button(scope, { w: 0.22, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.16, 0.96, -0.86, () => nextItem());
  next.visible = false;
  let roundScope: Entity[] = [];
  let marks: Entity[] = [];
  /** Entities that live for one sentence only (freed by buildRound/dispose, not by the screen scope). */
  const addRound = (obj: Mesh): Entity => {
    const e = app.world.createTransformEntity(obj, { parent: app.workspace });
    roundScope.push(e);
    return e;
  };
  const freeRound = () => {
    freeMarks();
    for (const e of roundScope) {
      forget(e);
      e.dispose();
    }
    roundScope = [];
  };
  /** The green "correct word" labels shown above wrong tiles after Check. */
  const freeMarks = () => {
    for (const e of marks) e.dispose();
    marks = [];
  };
  const local = new Vector3();

  const drawPrompt = (error?: string) => {
    const item = items[index];
    prompt.draw((ctx, W, H) => {
      prompt.card();
      ctx.fillStyle = C.writing;
      ctx.font = font(22, 800);
      ctx.fillText(item ? `BUILD A SENTENCE  ·  ${index + 1} OF ${items.length}` : 'BUILD A SENTENCE', 40, 24);
      if (error || !item) {
        ctx.fillStyle = C.danger;
        ctx.font = font(30, 700);
        wrap(ctx, error ?? '', 40, 64, W - 80, 38, 3);
        return;
      }
      ctx.fillStyle = C.ink;
      ctx.font = font(30, 800);
      ctx.fillText('Make an appropriate sentence.', 40, 58);
      // The other speaker's line, as a chat bubble.
      ctx.font = font(28, 500);
      const tw = Math.min(W - 150, ctx.measureText(item.context).width + 40);
      roundRect(ctx, 40, 104, tw, 56, 24);
      ctx.fillStyle = C.soft;
      ctx.fill();
      ctx.fillStyle = C.ink;
      wrap(ctx, item.context, 60, 116, tw - 36, 32, 1);
      ctx.fillStyle = C.muted;
      ctx.font = font(20, 600);
      ctx.textAlign = 'right';
      ctx.fillText('Pinch a tile to place it, or drag it onto a slot', W - 40, H - 34);
      ctx.textAlign = 'left';
    });
  };

  /** The 2D-style feedback: result banner, correct sentence, "Why this order?" chips, reason. */
  const showResult = (r: CheckResult | null) => {
    prompt.mesh.visible = !r;
    result.mesh.visible = Boolean(r);
    if (!r) return;
    result.draw((ctx, W) => {
      result.card();
      // Banner.
      const ok = Boolean(r.correct);
      roundRect(ctx, 24, 22, W - 48, 76, 22);
      ctx.fillStyle = ok ? C.successSoft : C.dangerSoft;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ok ? '#9fd8bd' : '#f3b8bd';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(70, 60, 22, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = ok ? C.success : C.danger;
      ctx.stroke();
      ctx.beginPath();
      if (ok) {
        ctx.moveTo(60, 60);
        ctx.lineTo(68, 69);
        ctx.lineTo(82, 51);
      } else {
        ctx.moveTo(62, 52);
        ctx.lineTo(78, 68);
        ctx.moveTo(78, 52);
        ctx.lineTo(62, 68);
      }
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = font(34, 800);
      ctx.textBaseline = 'middle';
      ctx.fillText(ok ? 'Correct! Well done.' : 'Your answer was incorrect!', 108, 62);
      ctx.textBaseline = 'top';
      // Correct sentence.
      ctx.fillStyle = C.muted;
      ctx.font = font(22, 700);
      ctx.fillText('Correct sentence', 32, 120);
      ctx.fillStyle = C.ink;
      ctx.font = font(32, 800);
      let y = wrap(ctx, r.answer ?? '', 32, 150, W - 64, 38, 2);
      // Why this order?
      if (r.parts?.length) {
        ctx.fillStyle = C.ink;
        ctx.font = font(24, 800);
        ctx.fillText('Why this order?', 32, y + 8);
        y += 44;
        let x = 32;
        for (const part of r.parts) {
          const role = ROLES[part.role] ?? ROLES.rest;
          ctx.font = font(26, 700);
          const textW = ctx.measureText(part.text).width;
          ctx.font = font(15, 800);
          const w = Math.max(textW, ctx.measureText(role.label).width) + 28;
          if (x + w > W - 32) break; // keep to one row of chips
          roundRect(ctx, x, y, w, 64, 14);
          ctx.fillStyle = role.soft;
          ctx.fill();
          ctx.fillStyle = role.color;
          ctx.fillText(role.label, x + 14, y + 8);
          ctx.font = font(26, 700);
          ctx.fillText(part.text, x + 14, y + 28);
          x += w + 10;
        }
        y += 74;
      }
      ctx.fillStyle = C.body;
      ctx.font = font(22, 500);
      wrap(ctx, r.explanation ?? '', 32, y, W - 64, 27, 2);
    });
  };

  const drawStatus = (text: string, color: string = C.body) =>
    status.draw((ctx, W, H) => {
      status.card('rgba(255,255,255,0.9)');
      ctx.fillStyle = color;
      ctx.font = font(24, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, H / 2 + 2);
    });

  const filled = () => slots.every((s) => s.tile >= 0);

  const refresh = () => {
    const done = filled();
    check.update({ enabled: done && !checking && !finished });
    clear.update({ enabled: !checking && !finished && slots.some((s) => s.tile >= 0) });
    if (!finished) drawStatus(done ? 'All slots full. Pinch Check.' : `${slots.filter((s) => s.tile >= 0).length} of ${slots.length} words placed`, done ? C.success : C.body);
  };

  const sendHome = (t: (typeof tiles)[number]) => {
    if (t.slot >= 0) slots[t.slot].tile = -1;
    t.slot = -1;
    t.entity.setValue(WordTile, 'slot', -1);
    tweenTo(t.mesh, t.home, t.homeQ);
  };

  const place = (t: (typeof tiles)[number], slot: number) => {
    if (slots[slot].tile >= 0 && slots[slot].tile !== tiles.indexOf(t)) return false; // one tile per slot
    if (t.slot >= 0) slots[t.slot].tile = -1;
    t.slot = slot;
    slots[slot].tile = tiles.indexOf(t);
    t.entity.setValue(WordTile, 'slot', slot);
    tweenTo(t.mesh, slots[slot].pos, slots[slot].quat, 0.22);
    app.sound.play(filled() ? 'full' : 'land', 0.55);
    return true;
  };

  const tap = (t: (typeof tiles)[number]) => {
    if (checking || finished) return;
    if (t.slot >= 0) {
      app.sound.play('drop', 0.5);
      sendHome(t);
    } else {
      const free = slots.findIndex((s) => s.tile < 0);
      if (free >= 0) place(t, free);
    }
    refresh();
  };

  // Near pinch/squeeze: claim the closest tile within reach of the fingertip or grip.
  pinchHooks.start = (hand, at) => {
    if (checking || finished) return false;
    let best: (typeof tiles)[number] | null = null;
    let bestD = REACH;
    for (const t of tiles) {
      if (Object.values(drags).some((d) => d?.tile === t)) continue;
      const d = t.mesh.getWorldPosition(local).distanceTo(at);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best) return false;
    cancelTween(best.mesh);
    best.dragAt = performance.now();
    best.grabFrom.copy(best.mesh.getWorldPosition(local));
    drags[hand] = { tile: best, offset: best.grabFrom.clone().sub(at) };
    app.sound.play('grab', 0.5);
    return true;
  };

  pinchHooks.move = (hand, at) => {
    const d = drags[hand];
    if (!d) return;
    local.copy(at).add(d.offset);
    app.workspace.object3D!.worldToLocal(local);
    d.tile.mesh.position.copy(local);
  };

  pinchHooks.end = (hand) => {
    const d = drags[hand];
    delete drags[hand];
    if (!d) return;
    const t = d.tile;
    if (checking || finished) {
      tweenTo(t.mesh, t.slot >= 0 ? slots[t.slot].pos : t.home, t.slot >= 0 ? slots[t.slot].quat : t.homeQ);
      return;
    }
    // A pinch without moving the tile is a tap: place it (or send it back).
    const moved = t.mesh.getWorldPosition(local).distanceTo(t.grabFrom);
    if (moved < 0.025) {
      tap(t);
      return;
    }
    local.copy(t.mesh.position);
    // Snap to the nearest slot that is free (or already this tile's), if close enough.
    let best = -1;
    let bestD = SNAP_DISTANCE;
    slots.forEach((s, i) => {
      if (s.tile >= 0 && s.tile !== tiles.indexOf(t)) return;
      const dd = s.pos.distanceTo(local);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    if (best >= 0) place(t, best);
    else {
      app.sound.play('drop', 0.45);
      sendHome(t);
    }
    refresh();
  };

  const clearAll = () => {
    tiles.forEach((t) => t.slot >= 0 && sendHome(t));
    app.sound.play('whoosh', 0.35);
    refresh();
  };

  /** After a wrong answer: tiles back to normal and to the tray, ready for another go. */
  const tryAgain = () => {
    freeMarks();
    finished = false;
    tiles.forEach((t) => {
      t.setState('idle');
      if (t.slot >= 0) sendHome(t);
    });
    showResult(null);
    retry.visible = false;
    next.visible = false;
    clear.visible = true;
    check.visible = true;
    app.sound.play('whoosh', 0.35);
    refresh();
  };

  /** Marks each placed tile right (green) or wrong (red, struck through, correct word above it). */
  const markTiles = (order: string[]) => {
    const item = items[index];
    slots.forEach((s, i) => {
      const t = tiles[s.tile];
      if (!t) return;
      const ok = item.tokens[t.token].id === order[i];
      t.setState(ok ? 'correct' : 'wrong');
      if (ok) return;
      const want = item.tokens.find((tk) => tk.id === order[i])?.text ?? '';
      const label = new CanvasPanel(Math.max(0.12, measure(want) * 0.82), 0.042);
      label.draw((ctx, W, H) => {
        roundRect(ctx, 2, 2, W - 4, H - 4, H / 2 - 2);
        ctx.fillStyle = C.success;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = font(26, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(want, W / 2, H / 2 + 1);
      });
      label.mesh.position.set(s.pos.x, s.pos.y + TILE_H / 2 + 0.028, s.pos.z + 0.012);
      label.mesh.raycast = () => {};
      marks.push(app.world.createTransformEntity(label.mesh, { parent: app.workspace }));
    });
  };

  const runCheck = async () => {
    const item = items[index];
    if (!item || !filled() || checking) return;
    checking = true;
    refresh();
    drawStatus('Checking…', C.primary);
    const order = slots.map((s) => item.tokens[tiles[s.tile].token].id);
    try {
      const r = await app.data.check(item.itemId, item.unitId, order);
      finished = true;
      showResult(r);
      if (r.order) markTiles(r.order);
      if (r.correct) {
        app.sound.play('done', 0.6);
        app.completeActivity();
      } else app.sound.play('toggle', 0.5);
      drawStatus(r.correct ? 'Great job!' : 'Compare with the green words, then try again.', r.correct ? C.success : C.danger);
      clear.visible = false;
      check.visible = false;
      retry.visible = !r.correct;
      next.update({ label: index + 1 < items.length ? 'Next' : 'Finish' });
      next.visible = true;
    } catch (e) {
      drawPrompt(errorMessage(e));
    } finally {
      checking = false;
      refresh();
    }
  };

  const nextItem = () => {
    if (index + 1 >= items.length) return app.goHub();
    index++;
    buildRound();
  };

  const buildRound = () => {
    freeRound();
    finished = false;
    next.visible = retry.visible = false;
    clear.visible = check.visible = true;
    const item = items[index];
    showResult(null);
    drawPrompt();

    // Slots: one row (two when long), facing the learner above the desk. Rows leave room for the
    // green correction labels shown above wrong tiles.
    const widths = item.tokens.map((t) => measure(t.text));
    const slotW = Math.max(...widths) + 0.01;
    const gap = 0.018;
    // A fixed start of the sentence (e.g. "If") sits before the first slot of the first row.
    const prefixW = item.prefix ? textWidth(item.prefix) + 0.02 : 0;
    // …and a fixed end (e.g. "these days?") after the last slot of the last row.
    const suffixW = item.suffix ? textWidth(item.suffix) + 0.02 : 0;
    const perRow = Math.max(1, Math.floor((1.36 - prefixW - suffixW + gap) / (slotW + gap)));
    const rows = Math.ceil(item.tokens.length / perRow);
    slots = item.tokens.map((_, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, item.tokens.length - row * perRow);
      const col = i - row * perRow;
      const x = (col - (inRow - 1) / 2) * (slotW + gap) + (row === 0 ? prefixW / 2 : 0) - (row === rows - 1 ? suffixW / 2 : 0);
      const y = SLOT_Y + (rows - 1) * 0.07 - row * 0.14;
      const frame = new CanvasPanel(slotW, TILE_H + 0.012);
      frame.draw((ctx, W, H) => {
        roundRect(ctx, 4, 4, W - 8, H - 8, 16);
        ctx.fillStyle = 'rgba(234,242,255,0.75)';
        ctx.fill();
        ctx.setLineDash([14, 10]);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#8fb3f5';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#8fb3f5';
        ctx.font = font(26, 700);
        ctx.fillText(String(i + 1), 16, 12);
      });
      frame.mesh.position.set(x, y, SLOT_Z - 0.012);
      frame.mesh.name = `Slot_${i}`;
      addRound(frame.mesh);
      return { pos: new Vector3(x, y, SLOT_Z), quat: new Quaternion(), tile: -1 };
    });
    if (item.prefix) {
      const first = slots[0].pos;
      const pre = new CanvasPanel(prefixW, 0.06);
      pre.draw((ctx, W, H) => {
        ctx.fillStyle = C.ink;
        ctx.font = font(34, 600);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.prefix ?? '', W - 6, H / 2);
      });
      pre.mesh.position.set(first.x - slotW / 2 - prefixW / 2 - 0.006, first.y, SLOT_Z);
      addRound(pre.mesh);
    }
    // The fixed end of the sentence after the last slot.
    if (item.suffix) {
      const last = slots[slots.length - 1].pos;
      const suffix = new CanvasPanel(suffixW, 0.06);
      suffix.draw((ctx, _W, H) => {
        ctx.fillStyle = C.ink;
        ctx.font = font(34, 600);
        ctx.textBaseline = 'middle';
        ctx.fillText(item.suffix ?? '', 6, H / 2);
      });
      suffix.mesh.position.set(last.x + slotW / 2 + suffixW / 2 + 0.006, last.y, SLOT_Z);
      addRound(suffix.mesh);
    }

    // Tiles on the desk tray, tilted up towards the learner, in up to two rows.
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.55);
    const trayRows = widths.reduce<number[][]>((acc, w, i) => {
      const row = acc[acc.length - 1];
      const rowW = row.reduce((sum, j) => sum + widths[j] + 0.02, 0);
      if (rowW + w > 1.0 && row.length) acc.push([i]);
      else row.push(i);
      return acc;
    }, [[]]);
    tiles = [];
    trayRows.forEach((row, r) => {
      const total = row.reduce((sum, j) => sum + widths[j], 0) + (row.length - 1) * 0.025;
      let x = -total / 2;
      row.forEach((j) => {
        const { mesh, setState } = tileView(item.tokens[j].text, widths[j]);
        mesh.name = `Tile_${j}`;
        const home = new Vector3(x + widths[j] / 2, DESK_Y + 0.05 + r * 0.05, DESK_Z + 0.12 - r * 0.1);
        x += widths[j] + 0.025;
        mesh.position.copy(home);
        mesh.quaternion.copy(tilt);
        const entity = addRound(mesh);
        entity.addComponent(RayInteractable);
        entity.addComponent(Clickable);
        entity.addComponent(WordTile, { token: j, slot: -1 });
        const t = { entity, mesh, setState, home, homeQ: tilt.clone(), token: j, slot: -1, dragAt: 0, grabFrom: new Vector3() };
        tiles.push(t);
        // A ray pinch (or click) from a distance is a tap. Skip it when the same pinch started a
        // near grab, which handles its own tap on release.
        onPress(entity, () =>
          setTimeout(() => {
            if (performance.now() - t.dragAt > 400 && !Object.values(drags).some((d) => d?.tile === t)) tap(t);
          }, 60),
        );
      });
    });
    app.sound.play('appear', 0.35);
    refresh();
  };

  return {
    async start() {
      drawStatus('Loading your sentences…', C.primary);
      try {
        items = await app.data.sentences();
        if (!items.length) {
          drawPrompt('These questions are not ready yet. They appear here as soon as your study plan finishes making them. Try another station or come back in a few minutes.');
          drawStatus('No sentences yet', C.muted);
          return;
        }
        buildRound();
      } catch (e) {
        drawPrompt(errorMessage(e));
      }
    },
    dispose() {
      pinchHooks.start = pinchHooks.move = pinchHooks.end = undefined;
      freeRound();
    },
  };
};
