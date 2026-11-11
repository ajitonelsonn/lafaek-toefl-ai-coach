/**
 * The study room app: owns the room, the desk plant, the hub with three stations, and switching
 * between screens. Each screen builds its entities in a Scope and frees them when it closes.
 */
import { AdditiveBlending, CapsuleGeometry, Entity, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RayInteractable, SRGBColorSpace, Texture, Vector3, VisibilityState, World } from '@iwsdk/core';
import { animate, onPress } from './clicks.js';
import { DataSource } from './data.js';
import { Clickable } from './interaction.js';
import { beamTexture, buildRoom, DESK_Y, DESK_Z, PALETTE, Plant } from './room.js';
import { Sound } from './sound.js';
import { addGlow, Button, C, font, roundRect, Scope, wrap } from './ui.js';

const BASE = import.meta.env.BASE_URL;
const ICONS = ['writing', 'listening', 'speaking', 'home', 'retry', 'next', 'start', 'stop', 'voice', 'success', 'achievement', 'streak', 'logout', 'continue', 'vr-build-sentence', 'vr-listen', 'vr-interview'] as const;
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
    const room = buildRoom();
    world.createTransformEntity(room.group);
    animate((time) => room.tick(time));
    this.companion = this.buildCompanion();
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
        setTimeout(() => {
          this.recenter();
          this.fitToFieldOfView();
        }, 700);
      }
      if (state === VisibilityState.NonImmersive) {
        this.seated = false;
        world.player.position.set(0, 0, 0);
        this.workspace.object3D!.position.z = 0;
      }
    });
  }

  private seated = false;
  private readonly companion: Group;

  /**
   * The Lafaek VR mascot as a learning companion, floating on a small hologram pad to the left of
   * the desk. Shown in the hub and Build a Sentence; hidden where it could block a station.
   */
  private buildCompanion(): Group {
    const g = new Group();
    g.name = 'Companion';
    g.position.set(-0.98, 0.98, -1.05);
    g.rotation.y = Math.atan2(0.98, 1.05);
    const tex = new Texture();
    tex.colorSpace = SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = `${BASE}img/companion.webp`;
    const cut = new Mesh(new PlaneGeometry(0.46, 0.364), new MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, toneMapped: false }));
    cut.raycast = () => {};
    g.add(cut);
    const pad = new Mesh(new CapsuleGeometry(0.004, 0.3, 4, 8), new MeshBasicMaterial({ color: PALETTE.led, toneMapped: false }));
    pad.rotation.z = Math.PI / 2;
    pad.position.y = -0.2;
    g.add(pad);
    const beam = new Mesh(new PlaneGeometry(0.34, 0.24), new MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    beam.raycast = () => {};
    beam.position.set(0, -0.08, -0.01);
    g.add(beam);
    this.world.createTransformEntity(g);
    animate((time) => {
      cut.position.y = Math.sin(time * 1.3) * 0.012;
      cut.rotation.z = Math.sin(time * 0.7) * 0.025;
    });
    return g;
  }

  /**
   * Narrow fields of view (e.g. Meta VR Glasses) see less of the room: move the panels back a
   * little so the stations and controls still fit in view. Quest-class headsets keep the layout.
   */
  private fitToFieldOfView(): void {
    const cams = this.world.renderer.xr.getCamera().cameras;
    const m = cams[0]?.projectionMatrix.elements;
    if (!m) return;
    const fovX = (2 * Math.atan(1 / m[0]) * 180) / Math.PI;
    this.workspace.object3D!.position.z = fovX < 85 ? -0.28 : 0;
  }

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
    // The companion stays out of the way of the speakers and the interviewer.
    this.companion.visible = name === 'hub' || name === 'sentence';
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
    // Back to the VR page (/vr), where the learner came from.
    const target = '/vr';
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
  { id: 'sentence', title: 'Build a Sentence', body: 'Grab word tiles and put them in order.', icon: 'vr-build-sentence', color: C.writing, skill: 'WRITING' },
  { id: 'listening', title: 'Listen to a Conversation', body: 'Two speakers talk around you.', icon: 'vr-listen', color: C.listening, skill: 'LISTENING' },
  { id: 'interview', title: 'Take an Interview', body: 'Answer out loud and get an AI score.', icon: 'vr-interview', color: C.speaking, skill: 'SPEAKING' },
] as const;

const CARD_W = 0.36;
const CARD_H = 0.42;
const CARD_Y = 1.08;

export const hubScreen: ScreenFactory = (app, scope) => {
  const stops: (() => void)[] = [];
  return {
    start() {
      const name = app.data.user?.name?.split(' ')[0];
      const days = app.studyDays();

      // Compact, personalised welcome panel.
      const { panel: title } = scope.panel(0.7, 0.15, 0, 1.43, -1.08);
      addGlow(title).setStrength(0.2);
      title.draw((ctx, W, H) => {
        title.card();
        ctx.fillStyle = C.primary;
        ctx.font = font(22, 800);
        ctx.fillText('LAFAEKTOEFL  ·  VR STUDY ROOM', 36, 26);
        ctx.fillStyle = C.ink;
        ctx.font = font(44, 800);
        ctx.fillText(name ? `Welcome back, ${name}` : 'Welcome back', 36, 60);
        ctx.fillStyle = C.body;
        ctx.font = font(24, 600);
        ctx.fillText('Pinch a station to practise with your own questions.', 36, 114);
        // Study-day chip on the right.
        const chip = days ? `${days} day${days > 1 ? 's' : ''}` : 'Day 1';
        ctx.font = font(24, 800);
        const cw = ctx.measureText(chip).width + 74;
        roundRect(ctx, W - cw - 30, 26, cw, 46, 23);
        ctx.fillStyle = C.soft;
        ctx.fill();
        const flame = app.icon('streak');
        if (flame) ctx.drawImage(flame, W - cw - 22, 30, 38, 38);
        ctx.fillStyle = C.primaryDark;
        ctx.textBaseline = 'middle';
        ctx.fillText(chip, W - cw + 22, 50);
        void H;
      });

      // Three floating holographic station cards, each over a light beam from the desk.
      const beamTex = beamTexture();
      STATIONS.forEach((s, i) => {
        const x = (i - 1) * (CARD_W + 0.05);
        const z = -0.9 + Math.abs(i - 1) * 0.06;
        const { panel, entity } = scope.panel(CARD_W, CARD_H, x, CARD_Y, z);
        panel.mesh.name = `Station_${s.id}`;
        const glowFrame = addGlow(panel, s.color);
        glowFrame.setStrength(0.15);
        let hover = false;
        const icon = app.icon(s.icon);
        const draw = () =>
          panel.draw((ctx, W, H) => {
            roundRect(ctx, 4, 4, W - 8, H - 8, 34);
            ctx.fillStyle = hover ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)';
            ctx.fill();
            const shine = ctx.createLinearGradient(0, 0, 0, H * 0.55);
            shine.addColorStop(0, `${s.color}26`);
            shine.addColorStop(1, `${s.color}00`);
            ctx.fillStyle = shine;
            ctx.fill();
            ctx.lineWidth = hover ? 8 : 4;
            ctx.strokeStyle = hover ? s.color : 'rgba(61, 139, 255, 0.45)';
            ctx.stroke();
            // 3D icon, centred.
            if (icon) {
              const ih = 128;
              const iw = (icon.width / icon.height) * ih;
              ctx.drawImage(icon, (W - iw) / 2, 34, iw, ih);
            }
            // Skill chip.
            ctx.font = font(20, 800);
            const tw = ctx.measureText(s.skill).width + 28;
            roundRect(ctx, (W - tw) / 2, 182, tw, 34, 17);
            ctx.fillStyle = `${s.color}1f`;
            ctx.fill();
            ctx.fillStyle = s.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.skill, W / 2, 200);
            ctx.textBaseline = 'top';
            ctx.fillStyle = C.ink;
            ctx.font = font(34, 800);
            const y = wrap(ctx, s.title, W / 2, 232, W - 50, 40, 2);
            ctx.fillStyle = C.body;
            ctx.font = font(23, 500);
            wrap(ctx, s.body, W / 2, y + 6, W - 56, 28, 2);
            ctx.fillStyle = hover ? s.color : C.muted;
            ctx.font = font(22, 800);
            ctx.fillText(hover ? 'Pinch to start  →' : 'Pinch to start', W / 2, H - 48);
            ctx.textAlign = 'left';
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
            glowFrame.setStrength(on ? 0.85 : 0.15);
            panel.mesh.scale.setScalar(on ? 1.03 : 1);
            if (on) app.sound.play('hover', 0.25);
            draw();
          },
        );
        draw();

        // Light beam and emitter strip on the desk under the card.
        const beamH = CARD_Y - CARD_H / 2 - DESK_Y;
        const beam = new Mesh(new PlaneGeometry(CARD_W * 0.8, beamH), new MeshBasicMaterial({ map: beamTex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
        beam.raycast = () => {};
        beam.position.set(x, DESK_Y + beamH / 2, z);
        beam.rotation.copy(panel.mesh.rotation);
        scope.add(beam);
        const emitter = new Mesh(new CapsuleGeometry(0.005, CARD_W * 0.6, 4, 8), new MeshBasicMaterial({ color: s.color, toneMapped: false }));
        emitter.rotation.set(0, panel.mesh.rotation.y, Math.PI / 2);
        emitter.position.set(x, DESK_Y + 0.004, z + 0.02);
        scope.add(emitter);

        // Gentle float, out of step between cards.
        const baseY = CARD_Y;
        stops.push(
          animate((time) => {
            panel.mesh.position.y = baseY + Math.sin(time * 1.1 + i * 1.7) * 0.006;
          }),
        );
      });

      // Control dock: Recenter and Exit to 2D, floating just above the desk front.
      const dockY = DESK_Y + 0.13;
      const dockZ = DESK_Z + 0.02;
      const center = new Button(scope, { w: 0.2, h: 0.072, label: 'Recenter', icon: app.icon('retry'), tone: 'ghost' }, -0.12, dockY, dockZ, () => {
        app.sound.play('click', 0.4);
        app.recenter();
      });
      const exit = new Button(scope, { w: 0.2, h: 0.072, label: 'Exit to 2D', icon: app.icon('logout'), tone: 'ghost' }, 0.12, dockY, dockZ, () => app.exitTo2D());
      for (const b of [center, exit]) {
        b.entity.object3D!.rotation.set(-0.55, 0, 0);
        addGlow(b.panel).setStrength(0.2);
      }
      app.sound.play('appear', 0.35);
    },
    dispose() {
      stops.forEach((stop) => stop());
    },
  };
};
