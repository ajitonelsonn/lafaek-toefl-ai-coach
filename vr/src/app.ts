/**
 * The study room app: owns the room, the desk plant, the hub with three stations, and switching
 * between screens. Each screen builds its entities in a Scope and frees them when it closes.
 */
import { Entity, Group, RayInteractable, Vector3, VisibilityState, World } from '@iwsdk/core';
import { onPress } from './clicks.js';
import { DataSource } from './data.js';
import { Clickable } from './interaction.js';
import { buildRoom, DESK_Y, DESK_Z, Plant } from './room.js';
import { Sound } from './sound.js';
import { Button, C, font, roundRect, Scope, wrap } from './ui.js';

const BASE = import.meta.env.BASE_URL;
const ICONS = ['writing', 'listening', 'speaking', 'home', 'retry', 'next', 'start', 'stop', 'voice', 'success', 'achievement', 'streak', 'logout', 'continue'] as const;
export type IconName = (typeof ICONS)[number];

export interface Screen {
  start(): Promise<void> | void;
  dispose(): void;
}

export type ScreenFactory = (app: App, scope: Scope) => Screen;

/** Eye height the layout is designed for (a seated learner). */
export const EYE_Y = 1.2;

export class App {
  readonly sound: Sound;
  readonly workspace: Entity;
  readonly icons = new Map<string, HTMLImageElement>();
  mascot: HTMLImageElement | null = null;
  private screen: { scope: Scope; screen: Screen } | null = null;
  private readonly plant = new Plant();
  private readonly screens = new Map<string, ScreenFactory>();

  constructor(
    readonly world: World,
    readonly data: DataSource,
  ) {
    this.sound = new Sound(world);
    world.createTransformEntity(buildRoom());
    const ws = new Group();
    ws.name = 'Workspace';
    this.workspace = world.createTransformEntity(ws);
    this.plant.group.position.set(0.66, DESK_Y, DESK_Z + 0.22);
    world.createTransformEntity(this.plant.group);
    this.plant.setStage(this.studyDays());

    // Seat the learner when they enter VR; restore the 2D view when they leave.
    world.visibilityState.subscribe((state) => {
      if (state === VisibilityState.Visible && !this.seated) {
        this.seated = true;
        setTimeout(() => this.recenter(), 700);
      }
      if (state === VisibilityState.NonImmersive) {
        this.seated = false;
        world.player.position.set(0, 0, 0);
      }
    });
  }

  private seated = false;

  register(name: string, factory: ScreenFactory): void {
    this.screens.set(name, factory);
  }

  async loadImages(): Promise<void> {
    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    await Promise.all([
      ...ICONS.map(async (n) => {
        const img = await load(`${BASE}icons/${n}.png`);
        if (img) this.icons.set(n, img);
      }),
      load(`${BASE}img/mascot.png`).then((img) => (this.mascot = img)),
    ]);
  }

  icon(name: IconName): HTMLImageElement | null {
    return this.icons.get(name) ?? null;
  }

  open(name: string): void {
    this.screen?.screen.dispose();
    this.screen?.scope.dispose();
    const factory = this.screens.get(name);
    if (!factory) return;
    const scope = new Scope(this.world, this.workspace);
    const screen = factory(this, scope);
    this.screen = { scope, screen };
    void Promise.resolve(screen.start()).catch((e) => console.error(e));
  }

  goHub(): void {
    this.sound.play('close', 0.4);
    this.open('hub');
  }

  /** Puts the learner's eyes at the designed seated height, centred on the desk. */
  recenter(): void {
    const head = new Vector3();
    this.world.player.head.getWorldPosition(head);
    const p = this.world.player.position;
    p.x -= head.x;
    p.z -= head.z;
    p.y = Math.max(-0.8, Math.min(0.6, p.y + (EYE_Y - head.y)));
  }

  exitTo2D(): void {
    const target = this.data.live ? '/dashboard' : '/';
    if (this.world.session) {
      this.world.exitXR();
      setTimeout(() => (location.href = target), 400);
    } else location.href = target;
  }

  // --- Daily study habit: one plant stage per study day (kept in this browser). -------------

  private days(): string[] {
    try {
      return JSON.parse(localStorage.getItem('lafaek-vr:days') ?? '[]');
    } catch {
      return [];
    }
  }

  studyDays(): number {
    return this.days().length;
  }

  /** Records today as a study day; grows the plant when it is a new day. */
  completeActivity(): void {
    const today = new Date().toISOString().slice(0, 10);
    const days = this.days();
    if (days.includes(today)) return;
    days.push(today);
    try {
      localStorage.setItem('lafaek-vr:days', JSON.stringify(days.slice(-60)));
    } catch {
      // Storage blocked: the plant just does not remember.
    }
    this.plant.setStage(days.length);
    this.sound.play('grow', 0.6);
  }
}

// --- Hub ----------------------------------------------------------------------------------------

const STATIONS = [
  { id: 'sentence', title: 'Build a Sentence', body: 'Grab word tiles and put them in order.', icon: 'writing', color: C.writing, skill: 'WRITING' },
  { id: 'listening', title: 'Listen to a Conversation', body: 'Two speakers talk around you. Answer what you heard.', icon: 'listening', color: C.listening, skill: 'LISTENING' },
  { id: 'interview', title: 'Take an Interview', body: 'Answer the interviewer out loud and get an AI score.', icon: 'speaking', color: C.speaking, skill: 'SPEAKING' },
] as const;

export const hubScreen: ScreenFactory = (app, scope) => ({
  start() {
    const name = app.data.user?.name?.split(' ')[0];
    const { panel: title } = scope.panel(1.0, 0.25, 0, 1.47, -1.1);
    title.draw((ctx, W) => {
      title.card();
      ctx.fillStyle = C.primary;
      ctx.font = font(28, 700);
      ctx.fillText('LAFAEKTOEFL  ·  STUDY ROOM', 50, 34);
      ctx.fillStyle = C.ink;
      ctx.font = font(58, 800);
      ctx.fillText(name ? `Welcome back, ${name}` : 'Practise for the TOEFL in VR', 50, 76);
      ctx.fillStyle = C.body;
      ctx.font = font(32, 500);
      wrap(
        ctx,
        app.data.live ? 'Your own study-plan questions. Pinch a station to begin.' : 'Demo questions. Sign in on lafaektoefl.tech for your personal plan.',
        50,
        160,
        W - 100,
        40,
        2,
      );
    });

    STATIONS.forEach((s, i) => {
      const x = (i - 1) * 0.43;
      const { panel, entity } = scope.panel(0.4, 0.46, x, 1.04, -0.92 + Math.abs(i - 1) * 0.07);
      panel.mesh.name = `Station_${s.id}`;
      let hover = false;
      const draw = () =>
        panel.draw((ctx, W, H) => {
          roundRect(ctx, 4, 4, W - 8, H - 8, 40);
          ctx.fillStyle = hover ? '#f5f9ff' : C.surface;
          ctx.fill();
          ctx.lineWidth = hover ? 10 : 5;
          ctx.strokeStyle = hover ? s.color : C.line;
          ctx.stroke();
          roundRect(ctx, 34, 34, 130, 130, 32);
          ctx.fillStyle = `${s.color}1f`;
          ctx.fill();
          const img = app.icon(s.icon);
          if (img) ctx.drawImage(img, 49, 49, 100, 100);
          ctx.fillStyle = s.color;
          ctx.font = font(24, 800);
          ctx.fillText(s.skill, 190, 70);
          ctx.fillStyle = C.ink;
          ctx.font = font(40, 800);
          const y = wrap(ctx, s.title, 34, 190, W - 68, 46, 2);
          ctx.fillStyle = C.body;
          ctx.font = font(28, 500);
          wrap(ctx, s.body, 34, y + 12, W - 68, 34, 3);
          ctx.fillStyle = hover ? s.color : C.muted;
          ctx.font = font(26, 700);
          ctx.fillText(hover ? 'Pinch to start  →' : 'Pinch to start', 34, H - 56);
        });
      entity.addComponent(RayInteractable);
      entity.addComponent(Clickable);
      onPress(
        entity,
        () => {
          app.sound.play('open', 0.5);
          app.open(s.id);
        },
        (on) => {
          hover = on;
          if (on) app.sound.play('hover', 0.25);
          draw();
        },
      );
      draw();
    });

    // Habit line and controls lying on the desk, tilted towards the learner.
    const { panel: habit, entity: habitE } = scope.panel(0.6, 0.08, -0.04, DESK_Y + 0.05, DESK_Z + 0.08);
    habitE.object3D!.rotation.set(-1.0, 0, 0);
    const days = app.studyDays();
    habit.draw((ctx, W, H) => {
      habit.card('rgba(255,255,255,0.92)');
      const img = app.icon('streak');
      if (img) ctx.drawImage(img, 18, 12, H - 24, H - 24);
      ctx.fillStyle = C.ink;
      ctx.font = font(27, 700);
      ctx.textBaseline = 'middle';
      ctx.fillText(days ? `${days} study day${days > 1 ? 's' : ''} · your plant grows each day` : 'Finish a task today to grow your plant', H, H / 2 + 2);
    });

    const exit = new Button(scope, { w: 0.2, h: 0.07, label: 'Exit to 2D', icon: app.icon('logout'), tone: 'ghost' }, -0.5, DESK_Y + 0.05, DESK_Z + 0.08, () => app.exitTo2D());
    exit.entity.object3D!.rotation.set(-1.0, 0, 0);
    const center = new Button(scope, { w: 0.2, h: 0.07, label: 'Recenter', icon: app.icon('retry'), tone: 'ghost' }, 0.42, DESK_Y + 0.05, DESK_Z + 0.08, () => {
      app.sound.play('click', 0.4);
      app.recenter();
    });
    center.entity.object3D!.rotation.set(-1.0, 0, 0);
    app.sound.play('appear', 0.35);
  },
  dispose() {},
});
