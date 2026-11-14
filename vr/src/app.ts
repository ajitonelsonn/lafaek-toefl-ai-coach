/**
 * The study room app: owns the room, the desk plant, the hub with three stations, and switching
 * between screens. Each screen builds its entities in a Scope and frees them when it closes.
 */
import { AdditiveBlending, CapsuleGeometry, Entity, Group, Mesh, Object3D, MeshBasicMaterial, PlaneGeometry, RayInteractable, SRGBColorSpace, Texture, Vector3, VisibilityState, World } from '@iwsdk/core';
import { animate, onPress } from './clicks.js';
import { DataSource } from './data.js';
import { Clickable } from './interaction.js';
import { beamTexture, buildRoom, DESK_Y, DESK_Z, framed, onWall, PALETTE, Plant } from './room.js';
import { loadModel } from './models.js';
import { ProgressBoard } from './progress.js';
import { LAFAEK } from './speakers.js';
import { Sound } from './sound.js';
import { addGlow, Button, C, font, roundRect, Scope, setPointerTarget, wrap } from './ui.js';

const BASE = import.meta.env.BASE_URL;
const ICONS = [
  'writing', 'listening', 'speaking', 'home', 'retry', 'next', 'start', 'stop', 'voice', 'success', 'achievement', 'streak', 'logout', 'continue',
  'zone-reading', 'zone-listening', 'zone-speaking', 'zone-writing',
  'mod-daily-life', 'mod-academic-passage', 'mod-build-sentence', 'mod-choose-response', 'mod-conversation', 'mod-announcement', 'mod-academic-talk', 'mod-listen-repeat', 'mod-interview',
  'ctl-home', 'ctl-back', 'ctl-exit', 'ctl-recenter',
] as const;
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
  /** Hand pictures for the hands tutorial. */
  handSelect: HTMLImageElement | null = null;
  handHold: HTMLImageElement | null = null;
  /** The two Listening speakers (cutout photos made into 3D figures). */
  speakerFemale: HTMLImageElement | null = null;
  speakerMale: HTMLImageElement | null = null;
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
    // The live progress board on the wall behind the learner.
    this.board = new ProgressBoard(2.1, 1.1);
    // Every saved answer (checked, spoken or AI-scored) refreshes the wall.
    data.onSaved = () => this.progressChanged();
    // Set into the room (inset) so the wide flat board stays in front of the curved wall.
    world.createTransformEntity(onWall(framed(this.board.group, 2.1, 1.1), 180, 1.62, 0.32));
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
  private readonly board: ProgressBoard;
  private boardAt = 0;

  private boardTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * An answer was saved or an activity finished: refresh the progress wall shortly after. Bursts
   * (several answers in a row) are merged into one refresh.
   */
  progressChanged(): void {
    if (this.boardTimer) clearTimeout(this.boardTimer);
    this.boardTimer = setTimeout(() => {
      this.boardTimer = null;
      void this.refreshProgress(true);
    }, 1500);
  }

  /** Refreshes the progress wall; without `force`, at most every 5 s (e.g. returning to the hub). */
  async refreshProgress(force = false): Promise<void> {
    if ((!force && Date.now() - this.boardAt < 5000) || !this.data.live) return;
    this.boardAt = Date.now();
    try {
      this.board.draw(await this.data.progress(), this.data.user?.name?.split(' ')[0] ?? null);
    } catch {
      // Keep the last drawn board.
    }
  }

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
    // The 3D Lafaek (the same model as the interviewer) replaces the flat picture once it has
    // loaded: a small figure sitting on the pad.
    let figure: Object3D | null = null;
    void loadModel('interviewer-lafaek').then((m) => {
      if (!m) return;
      const size = 0.42;
      figure = m.root.clone();
      figure.scale.setScalar(size / LAFAEK.metres);
      figure.position.set((-LAFAEK.rig.cx / LAFAEK.rig.h) * size, -0.2, 0);
      figure.traverse((o) => (o.raycast = () => {}));
      g.add(figure);
      cut.visible = false;
      beam.visible = false;
    });
    animate((time) => {
      if (figure) {
        figure.position.y = -0.2 + Math.sin(time * 1.3) * 0.008;
        figure.rotation.y = Math.sin(time * 0.6) * 0.18;
      }
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
        // Zone, module and control icons are crops of the VR icon sheet, kept in icons/zone/.
        const img = await load(`${BASE}icons/${/^(zone|mod|ctl)-/.test(n) ? 'zone/' : ''}${n}.png`);
        if (img) this.icons.set(n, img);
      }),
      load(`${BASE}img/mascot.png`).then((img) => (this.mascot = img)),
      load(`${BASE}img/hand-pinch-select.png`).then((img) => (this.handSelect = img)),
      load(`${BASE}img/hand-pinch-hold.png`).then((img) => (this.handHold = img)),
      load(`${BASE}img/speaker-female.webp`).then((img) => (this.speakerFemale = img)),
      load(`${BASE}img/speaker-male.webp`).then((img) => (this.speakerMale = img)),
    ]);
  }

  icon(name: IconName): HTMLImageElement | null {
    return this.icons.get(name) ?? null;
  }

  private current = 'hub';

  open(name: string): void {
    this.current = name;
    // Music only where nobody speaks: not in Listening, Listen and Repeat or the interview.
    this.sound.setMusic(!(name.startsWith('listen-') || name === 'repeat' || name === 'interview'));
    if (name === 'hub') void this.refreshProgress();
    this.screen?.screen.dispose();
    this.screen?.scope.dispose();
    const factory = this.screens.get(name);
    if (!factory) return;
    // The companion stays out of the way of the speakers and the interviewer.
    this.companion.visible = name === 'hub' || name.startsWith('zone-') || name === 'sentence' || name.startsWith('reading-') || name === 'repeat';
    const scope = new Scope(this.world, this.workspace);
    const screen = factory(this, scope);
    this.screen = { scope, screen };
    void Promise.resolve(screen.start()).catch((e) => console.error(e));
  }

  /** Opens the current screen again from the start (e.g. after "Start over"). */
  reopen(): void {
    this.open(this.current);
  }

  /** Back one level: an activity returns to its zone, a zone to the hub. */
  goHub(): void {
    this.sound.play('close', 0.4);
    this.open(PARENT[this.current] ?? 'hub');
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
    if (days.includes(today)) {
      this.progressChanged(); // a finished activity still updates the progress wall
      return;
    }
    days.push(today);
    try {
      localStorage.setItem('lafaek-vr:days', JSON.stringify(days.slice(-60)));
    } catch {
      // Storage blocked: the plant just does not remember.
    }
    this.plant.setStage(days.length);
    this.sound.play('grow', 0.6);
    this.progressChanged();
  }
}

// --- Zones and hub ----------------------------------------------------------------------------

interface Module {
  screen: string;
  title: string;
  body: string;
  icon: IconName;
  /** Typing tasks stay on the website: shown faded, not openable in VR. */
  website?: boolean;
}

interface Zone {
  id: string;
  title: string;
  body: string;
  skill: string;
  color: string;
  icon: IconName;
  modules: Module[];
}

/** The four VR zones. Writing's typing tasks (email, discussion) stay on the website. */
export const ZONES: Zone[] = [
  {
    id: 'zone-reading',
    title: 'Reading',
    body: 'Read emails, notices, chats and academic passages.',
    skill: 'READING',
    color: '#2f6fe4',
    icon: 'zone-reading',
    modules: [
      { screen: 'reading-daily', title: 'Read in Daily Life', body: 'Emails, notices and chats.', icon: 'mod-daily-life' },
      { screen: 'reading-academic', title: 'Read an Academic Passage', body: 'A short academic text.', icon: 'mod-academic-passage' },
    ],
  },
  {
    id: 'zone-listening',
    title: 'Listening',
    body: 'Voices come from where people stand. Pinch your answers.',
    skill: 'LISTENING',
    color: C.listening,
    icon: 'zone-listening',
    modules: [
      { screen: 'listen-response', title: 'Listen and Choose a Response', body: 'Hear one line, pick a reply.', icon: 'mod-choose-response' },
      { screen: 'listen-conversation', title: 'Listen to a Conversation', body: 'Two speakers around you.', icon: 'mod-conversation' },
      { screen: 'listen-announcement', title: 'Listen to an Announcement', body: 'A campus announcement.', icon: 'mod-announcement' },
      { screen: 'listen-talk', title: 'Listen to an Academic Talk', body: 'A short lecture.', icon: 'mod-academic-talk' },
    ],
  },
  {
    id: 'zone-speaking',
    title: 'Speaking',
    body: 'Speak into your headset and get scored by AI.',
    skill: 'SPEAKING',
    color: C.speaking,
    icon: 'zone-speaking',
    modules: [
      { screen: 'repeat', title: 'Listen and Repeat', body: 'Repeat each sentence.', icon: 'mod-listen-repeat' },
      { screen: 'interview', title: 'Take an Interview', body: 'Answer out loud, get an AI score.', icon: 'mod-interview' },
    ],
  },
  {
    id: 'zone-writing',
    title: 'Writing',
    body: 'Build sentences with draggable 3D word tiles.',
    skill: 'WRITING',
    color: C.writing,
    icon: 'zone-writing',
    modules: [
      { screen: 'sentence', title: 'Build a Sentence', body: 'Grab 3D word tiles and put them in order.', icon: 'mod-build-sentence' },
    ],
  },
];

/** Where "Back" goes from each screen. */
const PARENT: Record<string, string> = Object.fromEntries(ZONES.flatMap((z) => [[z.id, 'hub'], ...z.modules.filter((m) => !m.website).map((m) => [m.screen, z.id])]));

const CARD_Y = 1.08;

/**
 * A floating holographic card (zone or activity): glass panel with a glow frame, a light beam from
 * the desk, a gentle float, and hover feedback. Returns a stop function for the float animation.
 */
function holoCard(
  app: App,
  scope: Scope,
  spec: { name: string; title: string; body: string; skill: string; color: string; icon: IconName; tile: boolean; website?: boolean },
  x: number,
  z: number,
  w: number,
  h: number,
  phase: number,
  onPick: () => void,
  beamTex: ReturnType<typeof beamTexture>,
): () => void {
  const { panel, entity } = scope.panel(w, h, x, CARD_Y, z);
  panel.mesh.name = spec.name;
  const glowFrame = addGlow(panel, spec.color);
  glowFrame.setStrength(0.15);
  let hover = false;
  const icon = app.icon(spec.icon);
  const draw = () =>
    panel.draw((ctx, W, H) => {
      ctx.globalAlpha = spec.website ? 0.62 : 1;
      roundRect(ctx, 4, 4, W - 8, H - 8, 34);
      ctx.fillStyle = hover ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)';
      ctx.fill();
      const shine = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      shine.addColorStop(0, `${spec.color}26`);
      shine.addColorStop(1, `${spec.color}00`);
      ctx.fillStyle = shine;
      ctx.fill();
      ctx.lineWidth = hover ? 8 : 4;
      ctx.strokeStyle = hover ? spec.color : 'rgba(61, 139, 255, 0.45)';
      ctx.stroke();
      // Icon: zone icons stand on their own; activity icons sit on a rounded tile.
      if (icon) {
        const ih = spec.tile ? 118 : 140;
        const iw = Math.min(W - 60, (icon.width / icon.height) * ih);
        const ix = (W - iw) / 2;
        if (spec.tile) {
          ctx.save();
          roundRect(ctx, ix, 30, iw, ih, 24);
          ctx.clip();
          ctx.drawImage(icon, ix, 30, iw, ih);
          ctx.restore();
        } else ctx.drawImage(icon, ix, 24, iw, ih);
      }
      ctx.font = font(19, 800);
      const tw = ctx.measureText(spec.skill).width + 26;
      roundRect(ctx, (W - tw) / 2, 176, tw, 32, 16);
      ctx.fillStyle = `${spec.color}1f`;
      ctx.fill();
      ctx.fillStyle = spec.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.skill, W / 2, 193);
      ctx.textBaseline = 'top';
      ctx.fillStyle = C.ink;
      ctx.font = font(W < 330 ? 29 : 33, 800);
      const y = wrap(ctx, spec.title, W / 2, 224, W - 40, W < 330 ? 34 : 38, 2);
      ctx.fillStyle = C.body;
      ctx.font = font(22, 500);
      wrap(ctx, spec.body, W / 2, y + 6, W - 46, 27, 2);
      ctx.fillStyle = hover ? spec.color : C.muted;
      ctx.font = font(21, 800);
      ctx.fillText(spec.website ? 'On the website' : hover ? 'Pinch to open  →' : 'Pinch to open', W / 2, H - 44);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    });
  if (spec.website) {
    // Typing tasks are not opened in VR: no pinch target, no beam.
    draw();
    return () => {};
  }
  entity.addComponent(RayInteractable);
  entity.addComponent(Clickable);
  onPress(
    entity,
    () => {
      app.sound.play('open', 0.5);
      onPick();
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
  const beamH = CARD_Y - h / 2 - DESK_Y;
  const beam = new Mesh(new PlaneGeometry(w * 0.8, beamH), new MeshBasicMaterial({ map: beamTex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
  beam.raycast = () => {};
  beam.position.set(x, DESK_Y + beamH / 2, z);
  beam.rotation.copy(panel.mesh.rotation);
  scope.add(beam);
  const emitter = new Mesh(new CapsuleGeometry(0.005, w * 0.6, 4, 8), new MeshBasicMaterial({ color: spec.color, toneMapped: false }));
  emitter.rotation.set(0, panel.mesh.rotation.y, Math.PI / 2);
  emitter.position.set(x, DESK_Y + 0.004, z + 0.02);
  scope.add(emitter);
  return animate((time) => {
    panel.mesh.position.y = CARD_Y + Math.sin(time * 1.1 + phase * 1.7) * 0.006;
  });
}

/** Lays out n cards in a gentle arc in front of the learner. */
function arc(n: number, w: number): { x: number; z: number }[] {
  const gap = 0.045;
  return Array.from({ length: n }, (_, i) => {
    const off = i - (n - 1) / 2;
    return { x: off * (w + gap), z: -0.9 + Math.abs(off) * 0.06 };
  });
}

/** Header panel for the hub and zone screens. */
function headerPanel(scope: Scope, eyebrow: string, title: string, line: string, chip?: { text: string; icon: HTMLImageElement | null }) {
  const { panel } = scope.panel(0.74, 0.15, 0, 1.43, -1.08);
  addGlow(panel).setStrength(0.2);
  panel.draw((ctx, W) => {
    panel.card();
    ctx.fillStyle = C.primary;
    ctx.font = font(22, 800);
    ctx.fillText(eyebrow, 36, 26);
    ctx.fillStyle = C.ink;
    ctx.font = font(42, 800);
    ctx.fillText(title, 36, 60);
    ctx.fillStyle = C.body;
    ctx.font = font(23, 600);
    ctx.fillText(line, 36, 112);
    if (chip) {
      ctx.font = font(24, 800);
      const cw = ctx.measureText(chip.text).width + 74;
      roundRect(ctx, W - cw - 30, 26, cw, 46, 23);
      ctx.fillStyle = C.soft;
      ctx.fill();
      if (chip.icon) ctx.drawImage(chip.icon, W - cw - 22, 30, 38, 38);
      ctx.fillStyle = C.primaryDark;
      ctx.textBaseline = 'middle';
      ctx.fillText(chip.text, W - cw + 22, 50);
    }
  });
}

/** Recenter / Exit to 2D dock (hub) or Back / Recenter (zones), floating above the desk front. */
/**
 * The dock floats just above the desk front, within arm's reach (about 45 cm, Meta's touch range):
 * its buttons work with a pinch from the hand ray or by touching them with the index finger.
 */
function dock(app: App, scope: Scope, left: { label: string; icon: IconName; act: () => void }, right: { label: string; icon: IconName; act: () => void }, help: () => void) {
  const y = DESK_Y + 0.11;
  const z = DESK_Z + 0.22;
  const items: [number, { label: string; icon: IconName | null; act: () => void }][] = [
    [-0.33, left],
    [-0.11, { label: 'How to use', icon: null, act: help }],
    [0.11, right],
  ];
  for (const [x, it] of items) {
    const btn = new Button(scope, { w: 0.19, h: 0.07, label: it.label, icon: it.icon ? app.icon(it.icon) : app.handSelect, tone: 'ghost', poke: true }, x, y, z, it.act);
    btn.entity.object3D!.rotation.set(-0.6, 0, 0);
    addGlow(btn.panel).setStrength(0.2);
  }
  // The learner's music switch (remembered between visits).
  const musicLabel = () => (app.sound.musicOff ? 'Music off' : 'Music on');
  const music: Button = new Button(scope, { w: 0.19, h: 0.07, label: musicLabel(), icon: app.icon('listening'), tone: 'ghost', poke: true }, 0.33, y, z, () => {
    app.sound.toggleMusic();
    music.update({ label: musicLabel() });
  });
  music.entity.object3D!.rotation.set(-0.6, 0, 0);
  addGlow(music.panel).setStrength(0.2);
}

/**
 * Hands tutorial inside VR: shown on the first visit to the hub and again from "How to use".
 * It covers the three hand actions the room uses: point and pinch, pinch and hold, and touch.
 */
function handTips(app: App, scope: Scope): { open: () => void } {
  const { panel, entity } = scope.panel(0.86, 0.42, 0, 1.2, -0.72);
  // A pinch on the panel itself does nothing, so cards behind it cannot be pressed by mistake.
  entity.addComponent(RayInteractable);
  entity.addComponent(Clickable);
  onPress(entity, () => {});
  addGlow(panel).setStrength(0.5);
  panel.draw((ctx, W) => {
    panel.card();
    ctx.fillStyle = C.primary;
    ctx.font = font(22, 800);
    ctx.fillText('HOW TO USE YOUR HANDS', 36, 26);
    ctx.fillStyle = C.ink;
    ctx.font = font(40, 800);
    ctx.fillText('No controllers needed', 36, 58);
    const rows: [HTMLImageElement | null, string, string][] = [
      [app.handSelect, 'Point and pinch to choose', 'Point your hand at a card or an answer, then touch your thumb to your index finger.'],
      [app.handHold, 'Pinch and hold to grab', 'In Build a Sentence, pick up a word tile, move your hand and let go over a slot.'],
      [null, 'Touch nearby buttons', 'The buttons just above the desk can also be pressed with your index finger.'],
    ];
    rows.forEach(([img, title, body], i) => {
      const y = 120 + i * 86;
      roundRect(ctx, 36, y, 96, 72, 18);
      ctx.fillStyle = C.soft;
      ctx.fill();
      if (img) ctx.drawImage(img, 40, y + 4, 88, (img.height / img.width) * 88);
      else {
        // A touch target: ring and dot.
        ctx.strokeStyle = C.primary;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(84, y + 36, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = C.primary;
        ctx.beginPath();
        ctx.arc(84, y + 36, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = C.ink;
      ctx.font = font(28, 800);
      ctx.fillText(title, 154, y + 4);
      ctx.fillStyle = C.body;
      ctx.font = font(22, 500);
      wrap(ctx, body, 154, y + 40, W - 190, 26, 1);
    });
  });
  const ok = new Button(scope, { w: 0.2, h: 0.07, label: 'Got it', icon: app.icon('success'), tone: 'primary', poke: true }, 0, 0.94, -0.7, () => {
    app.sound.play('click', 0.4);
    show(false);
    try {
      localStorage.setItem('lafaek-vr:hand-tips', '1');
    } catch {
      // Storage blocked: the tips just show again next time.
    }
  });
  const show = (on: boolean) => {
    panel.mesh.visible = on;
    entity.setValue(Clickable, 'enabled', on);
    setPointerTarget(entity, on); // a hidden panel must not block the cards behind it
    ok.visible = on;
  };
  let seen = false;
  try {
    seen = localStorage.getItem('lafaek-vr:hand-tips') === '1';
  } catch {
    // Storage blocked: show the tips.
  }
  show(!seen);
  return {
    open: () => {
      app.sound.play('open', 0.4);
      show(true);
    },
  };
}

const recenterAction = (app: App) => ({
  label: 'Recenter',
  icon: 'ctl-recenter' as IconName,
  act: () => {
    app.sound.play('click', 0.4);
    app.recenter();
  },
});

export const hubScreen: ScreenFactory = (app, scope) => {
  const stops: (() => void)[] = [];
  return {
    start() {
      const name = app.data.user?.name?.split(' ')[0];
      const days = app.studyDays();
      headerPanel(scope, 'LAFAEKTOEFL  ·  VR STUDY ROOM', name ? `Welcome back, ${name}` : 'Welcome back', 'Pick a zone to practise with your own questions.', {
        text: days ? `${days} day${days > 1 ? 's' : ''}` : 'Day 1',
        icon: app.icon('streak'),
      });
      const beamTex = beamTexture();
      const w = 0.32;
      arc(ZONES.length, w).forEach((p, i) => {
        const z = ZONES[i];
        const vr = z.modules.filter((m) => !m.website).length;
        stops.push(
          holoCard(app, scope, { name: `Station_${z.id}`, title: z.title, body: z.body, skill: `${vr} IN VR`, color: z.color, icon: z.icon, tile: false }, p.x, p.z, w, 0.42, i, () => app.open(z.id), beamTex),
        );
      });
      const tips = handTips(app, scope);
      dock(app, scope, recenterAction(app), { label: 'Exit to 2D', icon: 'ctl-exit', act: () => app.exitTo2D() }, tips.open);
      app.sound.play('appear', 0.35);
    },
    dispose() {
      stops.forEach((stop) => stop());
    },
  };
};

/** A zone's menu: its activities as holographic cards. */
export const zoneScreen =
  (zoneId: string): ScreenFactory =>
  (app, scope) => {
    const stops: (() => void)[] = [];
    const zone = ZONES.find((z) => z.id === zoneId)!;
    return {
      start() {
        headerPanel(scope, `VR STUDY ROOM  ·  ${zone.skill}`, zone.title, zone.id === 'zone-writing' ? 'Write an Email and Academic Discussion are on the website.' : 'Pinch an activity to start.');
        const beamTex = beamTexture();
        const w = zone.modules.length >= 4 ? 0.3 : 0.34;
        arc(zone.modules.length, w).forEach((p, i) => {
          const m = zone.modules[i];
          stops.push(
            holoCard(app, scope, { name: `Station_${m.screen}`, title: m.title, body: m.body, skill: zone.skill, color: zone.color, icon: m.icon, tile: !m.website, website: m.website }, p.x, p.z, w, 0.4, i, () => app.open(m.screen), beamTex),
          );
        });
        const tips = handTips(app, scope);
        dock(app, scope, { label: 'Back', icon: 'ctl-back', act: () => app.goHub() }, recenterAction(app), tips.open);
        app.sound.play('appear', 0.35);
      },
      dispose() {
        stops.forEach((stop) => stop());
      },
    };
  };
