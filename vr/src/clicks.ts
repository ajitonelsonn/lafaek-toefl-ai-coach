/**
 * Routes RayInteractable presses and hovers (hand pinch, controller trigger or mouse) to
 * per-entity handlers, and runs small position/scale tweens without per-frame allocation.
 */
import { createSystem, Entity, Hovered, Object3D, PokeInteractable, Pressed, Quaternion, Vector3 } from '@iwsdk/core';
import { Clickable } from './interaction.js';

interface Handlers {
  press?: () => void;
  hover?: (on: boolean) => void;
  down?: () => void;
}

const handlers = new Map<Entity, Handlers>();

/**
 * Runs `press` when a pinch, trigger, click or finger touch on the entity is released (a select
 * fires on release, as on Quest). Release matters: if the pressed object vanished or moved away
 * while the pinch was still held (a card that opens a new screen, a word tile flying to its
 * slot), IWSDK's hand ray would stay stuck in its select state, the next pinch would be lost
 * and finger touch would stop working. `down` runs at the start of the press.
 */
export function onPress(entity: Entity, press: () => void, hover?: (on: boolean) => void, down?: () => void): void {
  handlers.set(entity, { press, hover, down });
}

export function forget(entity: Entity): void {
  handlers.delete(entity);
}

export function setClickable(entity: Entity, enabled: boolean): void {
  if (entity.hasComponent(Clickable)) entity.setValue(Clickable, 'enabled', enabled);
}

interface Tween {
  obj: Object3D;
  fromP: Vector3;
  toP: Vector3;
  fromQ: Quaternion;
  toQ: Quaternion;
  t: number;
  duration: number;
  done?: () => void;
}

const tweens: Tween[] = [];

/** Moves an object (in its parent's space) to a position/rotation with an ease-out curve. */
export function tweenTo(obj: Object3D, pos: Vector3, quat: Quaternion, duration = 0.28, done?: () => void): void {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1);
  tweens.push({ obj, fromP: obj.position.clone(), toP: pos.clone(), fromQ: obj.quaternion.clone(), toQ: quat.clone(), t: 0, duration, done });
}

export function cancelTween(obj: Object3D): void {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj) tweens.splice(i, 1);
}

type Animator = (time: number, delta: number) => void;
const animators = new Set<Animator>();

/** Runs a small per-frame callback (bobbing, pulsing) until the returned function is called. */
export function animate(fn: Animator): () => void {
  animators.add(fn);
  return () => animators.delete(fn);
}

export class ClickSystem extends createSystem({
  pressed: { required: [Clickable, Pressed] },
  hovered: { required: [Clickable, Hovered] },
  /** Touch buttons a fingertip is hovering close to (the dock). */
  near: { required: [Clickable, Hovered, PokeInteractable] },
}) {
  /** A pinch that began next to a touch button, per hand: pressed when the pinch ends. */
  private readonly nearPinch: Record<'left' | 'right', Entity | null> = { left: null, right: null };

  init(): void {
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (entity) => {
        if (entity.getValue(Clickable, 'enabled')) handlers.get(entity)?.down?.();
      }),
      // Released. On a far target, sliding off first (Hovered already gone) cancels, like a button
      // on the web; a disposed entity has left `handlers` / lost Clickable, so it does nothing.
      this.queries.pressed.subscribe('disqualify', (entity) => {
        const h = handlers.get(entity);
        if (!h || !entity.hasComponent(Clickable)) return;
        // A fingertip leaving a flat touch button ends its hover in the same step as its press
        // (IWSDK reports the leave first), so for touch buttons a release without hover still
        // counts. Far (ray) targets keep the slide-off-to-cancel rule.
        if (!entity.hasComponent(Hovered) && !entity.hasComponent(PokeInteractable)) return;
        if (!entity.getValue(Clickable, 'enabled')) return;
        h.press?.();
      }),
      this.queries.hovered.subscribe('qualify', (entity) => {
        if (entity.getValue(Clickable, 'enabled')) handlers.get(entity)?.hover?.(true);
      }),
      this.queries.hovered.subscribe('disqualify', (entity) => handlers.get(entity)?.hover?.(false)),
    );
  }

  /**
   * Close to a touch button the hand switches from "point and pinch" to "touch", and a pinch
   * there would do nothing. People still pinch out of habit, so a pinch that starts and ends
   * while the fingertip hovers next to a touch button presses it too. If the button was touched
   * or ray-pressed during that pinch, the normal press already handled it.
   */
  private nearPinches(): void {
    for (const hand of ['left', 'right'] as const) {
      const select = this.input.xr.getSelectState(hand);
      if (select.start) {
        let target: Entity | null = null;
        for (const e of this.queries.near.entities) {
          if (e.getValue(Clickable, 'enabled') && !e.hasComponent(Pressed)) target = e;
        }
        this.nearPinch[hand] = target;
        if (target) handlers.get(target)?.down?.();
      }
      const held = this.nearPinch[hand];
      if (!held) continue;
      // Touched or ray-pressed meanwhile, or gone: leave it to the normal press.
      if (!held.active || !held.hasComponent(Clickable) || held.hasComponent(Pressed)) {
        this.nearPinch[hand] = null;
        continue;
      }
      if (select.end) {
        this.nearPinch[hand] = null;
        if (held.hasComponent(Hovered) && held.getValue(Clickable, 'enabled')) handlers.get(held)?.press?.();
      }
    }
  }

  update(delta: number, time: number): void {
    this.nearPinches();
    for (const fn of animators) fn(time, delta);
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t = Math.min(1, tw.t + delta / tw.duration);
      const k = 1 - Math.pow(1 - tw.t, 3);
      tw.obj.position.lerpVectors(tw.fromP, tw.toP, k);
      tw.obj.quaternion.slerpQuaternions(tw.fromQ, tw.toQ, k);
      if (tw.t >= 1) {
        tweens.splice(i, 1);
        tw.done?.();
      }
    }
  }
}
