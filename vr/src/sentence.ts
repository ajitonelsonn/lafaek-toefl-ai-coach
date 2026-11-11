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
import { errorMessage, type SentenceItem } from './data.js';
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

function measure(text: string): number {
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = font(40, 700);
  return Math.max(0.13, Math.min(0.3, (c.measureText(text).width + 60) / 1000));
}

function tileMesh(text: string, w: number): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * 1000);
  canvas.height = Math.round(TILE_H * 1000);
  const ctx = canvas.getContext('2d')!;
  roundRect(ctx, 3, 3, canvas.width - 6, canvas.height - 6, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = C.primary;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  let size = 40;
  ctx.font = font(size, 700);
  while (size > 22 && ctx.measureText(text).width > canvas.width - 36) ctx.font = font((size -= 2), 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const side = new MeshLambertMaterial({ color: '#c9dbfb' });
  const face = new MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  return new Mesh(new BoxGeometry(w, TILE_H, 0.018), [side, side, side, side, face, side]);
}

export const sentenceScreen: ScreenFactory = (app, scope) => {
  let items: SentenceItem[] = [];
  let demo = false;
  let index = 0;
  let tiles: { entity: Entity; mesh: Mesh; home: Vector3; homeQ: Quaternion; token: number; slot: number; dragAt: number; grabFrom: Vector3 }[] = [];
  const drags: Partial<Record<Hand, { tile: (typeof tiles)[number]; offset: Vector3 }>> = {};
  let slots: { pos: Vector3; quat: Quaternion; tile: number }[] = [];
  let checking = false;
  let finished = false;

  const header = scope.panel(1.0, 0.27, 0, 1.47, -1.1).panel;
  const status = scope.panel(0.6, 0.05, 0, 1.045, -0.88).panel;
  new Button(scope, { w: 0.22, h: 0.075, label: 'Room', icon: app.icon('home'), tone: 'ghost' }, -0.55, 0.98, -0.84, () => app.goHub());
  const clear = new Button(scope, { w: 0.2, h: 0.075, label: 'Clear', icon: app.icon('retry'), tone: 'secondary' }, -0.23, 0.98, -0.86, () => clearAll());
  const check = new Button(scope, { w: 0.24, h: 0.075, label: 'Check', icon: app.icon('success'), tone: 'primary', enabled: false }, 0.24, 0.98, -0.86, () => void runCheck());
  const next = new Button(scope, { w: 0.22, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.55, 0.98, -0.84, () => nextItem());
  next.visible = false;
  let roundScope: Entity[] = [];
  /** Entities that live for one sentence only (freed by buildRound/dispose, not by the screen scope). */
  const addRound = (obj: Mesh): Entity => {
    const e = app.world.createTransformEntity(obj, { parent: app.workspace });
    roundScope.push(e);
    return e;
  };
  const freeRound = () => {
    for (const e of roundScope) {
      forget(e);
      e.dispose();
    }
    roundScope = [];
  };
  const local = new Vector3();

  const drawHeader = (result?: { correct: boolean | null; answer?: string; explanation?: string; error?: string }) => {
    const item = items[index];
    header.draw((ctx, W) => {
      const tone = result?.error ? C.danger : result ? (result.correct ? C.success : C.danger) : null;
      header.card(tone === C.success ? C.successSoft : tone === C.danger ? C.dangerSoft : C.surface, tone ?? C.line);
      ctx.fillStyle = C.writing;
      ctx.font = font(26, 800);
      ctx.fillText(`BUILD A SENTENCE  ·  ${index + 1} OF ${items.length}${demo ? '  ·  DEMO' : ''}`, 44, 30);
      if (!item) return;
      if (result?.error) {
        ctx.fillStyle = C.danger;
        ctx.font = font(36, 700);
        wrap(ctx, result.error, 44, 80, W - 88, 44, 3);
        return;
      }
      if (result) {
        ctx.fillStyle = tone!;
        ctx.font = font(44, 800);
        ctx.fillText(result.correct ? 'Correct! Well done.' : 'Not quite. Here is the answer:', 44, 72);
        ctx.fillStyle = C.ink;
        ctx.font = font(36, 700);
        const y = wrap(ctx, result.answer ?? '', 44, 128, W - 88, 42, 2);
        ctx.fillStyle = C.body;
        ctx.font = font(28, 500);
        wrap(ctx, result.explanation ?? '', 44, y + 4, W - 88, 34, 2);
        return;
      }
      ctx.fillStyle = C.body;
      ctx.font = font(30, 500);
      wrap(ctx, item.context, 44, 74, W - 88, 38, 2);
      ctx.fillStyle = C.ink;
      ctx.font = font(36, 700);
      wrap(ctx, 'Put the words in order to answer with a question.', 44, 160, W - 88, 44, 1);
      ctx.fillStyle = C.muted;
      ctx.font = font(26, 500);
      ctx.fillText('Pinch and drag a tile onto a slot, or pinch it once to place it.', 44, 214);
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
      drawHeader(r);
      if (r.correct) {
        app.sound.play('done', 0.6);
        app.completeActivity();
      } else app.sound.play('toggle', 0.5);
      drawStatus(r.correct ? 'Great job!' : 'Read the answer, then try the next one.', r.correct ? C.success : C.danger);
      next.update({ label: index + 1 < items.length ? 'Next' : 'Finish' });
      next.visible = true;
    } catch (e) {
      drawHeader({ correct: null, error: errorMessage(e) });
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
    next.visible = false;
    const item = items[index];
    drawHeader();

    // Slots: one row (two when long), facing the learner above the desk.
    const widths = item.tokens.map((t) => measure(t.text));
    const slotW = Math.max(...widths) + 0.01;
    const gap = 0.018;
    const perRow = Math.max(1, Math.floor((1.32 + gap) / (slotW + gap)));
    const rows = Math.ceil(item.tokens.length / perRow);
    slots = item.tokens.map((_, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, item.tokens.length - row * perRow);
      const col = i - row * perRow;
      const x = (col - (inRow - 1) / 2) * (slotW + gap);
      const y = SLOT_Y + (rows - 1) * 0.05 - row * 0.1;
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
    // The fixed end of the sentence after the last slot.
    if (item.suffix) {
      const last = slots[slots.length - 1].pos;
      const suffix = new CanvasPanel(0.36, 0.06);
      suffix.draw((ctx, _W, H) => {
        ctx.fillStyle = C.ink;
        ctx.font = font(34, 600);
        ctx.textBaseline = 'middle';
        wrap(ctx, item.suffix ?? '', 6, H / 2 - 4, 350, 36, 1);
      });
      const sx = last.x + slotW / 2 + 0.2;
      const fits = sx + 0.18 < 0.75;
      suffix.mesh.position.set(fits ? sx : 0, fits ? last.y : last.y - 0.09, SLOT_Z);
      addRound(suffix.mesh);
    }

    // Tiles on the desk tray, tilted up towards the learner, in up to two rows.
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.55);
    const trayRows = widths.reduce<number[][]>((acc, w, i) => {
      const row = acc[acc.length - 1];
      const rowW = row.reduce((s, j) => s + widths[j] + 0.02, 0);
      if (rowW + w > 1.0 && row.length) acc.push([i]);
      else row.push(i);
      return acc;
    }, [[]]);
    tiles = [];
    trayRows.forEach((row, r) => {
      const total = row.reduce((s, j) => s + widths[j], 0) + (row.length - 1) * 0.025;
      let x = -total / 2;
      row.forEach((j) => {
        const mesh = tileMesh(item.tokens[j].text, widths[j]);
        mesh.name = `Tile_${j}`;
        const home = new Vector3(x + widths[j] / 2, DESK_Y + 0.05 + r * 0.05, DESK_Z + 0.12 - r * 0.1);
        x += widths[j] + 0.025;
        mesh.position.copy(home);
        mesh.quaternion.copy(tilt);
        const entity = addRound(mesh);
        entity.addComponent(RayInteractable);
        entity.addComponent(Clickable);
        entity.addComponent(WordTile, { token: j, slot: -1 });
        const t = { entity, mesh, home, homeQ: tilt.clone(), token: j, slot: -1, dragAt: 0, grabFrom: new Vector3() };
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
        ({ items, demo } = await app.data.sentences());
        buildRound();
      } catch (e) {
        drawHeader({ correct: null, error: errorMessage(e) });
      }
    },
    dispose() {
      pinchHooks.start = pinchHooks.move = pinchHooks.end = undefined;
      freeRound();
    },
  };
};
