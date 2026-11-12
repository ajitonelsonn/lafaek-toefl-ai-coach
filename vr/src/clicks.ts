/**
 * Routes RayInteractable presses and hovers (hand pinch, controller trigger or mouse) to
 * per-entity handlers, and runs small position/scale tweens without per-frame allocation.
 */
import { createSystem, Entity, Hovered, Object3D, Pressed, Quaternion, Vector3 } from '@iwsdk/core';
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
}) {
  init(): void {
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (entity) => {
        if (entity.getValue(Clickable, 'enabled')) handlers.get(entity)?.down?.();
      }),
      // Released. Sliding off the target first (Hovered already gone) cancels, like a button on
      // the web; a disposed entity has left `handlers` / lost Clickable, so it does nothing.
      this.queries.pressed.subscribe('disqualify', (entity) => {
        const h = handlers.get(entity);
        if (!h || !entity.hasComponent(Clickable) || !entity.hasComponent(Hovered)) return;
        if (!entity.getValue(Clickable, 'enabled')) return;
        h.press?.();
      }),
      this.queries.hovered.subscribe('qualify', (entity) => {
        if (entity.getValue(Clickable, 'enabled')) handlers.get(entity)?.hover?.(true);
      }),
      this.queries.hovered.subscribe('disqualify', (entity) => handlers.get(entity)?.hover?.(false)),
    );
  }

  update(delta: number, time: number): void {
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
