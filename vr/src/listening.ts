/**
 * Listen to a Conversation: the scene picture hangs in front, and the speakers (3D people from the
 * cast in speakers.ts, different for each question) stand or sit to the left and right. Each voice
 * comes from where that person is (spatial audio). After the conversation the learner pinches an
 * answer for each question.
 */
import { CapsuleGeometry, Color, Entity, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, RayInteractable, SphereGeometry, TorusGeometry, Vector3 } from '@iwsdk/core';
import type { App, ScreenFactory } from './app.js';
import { animate, onPress } from './clicks.js';
import { errorMessage, type ListeningItem, type ListeningSlug } from './data.js';
import { buildFigure } from './figure.js';
import { pickSpeaker, speakerInfo, type Gender, type SpeakerId, type SpeakerScene } from './speakers.js';
import type { Talker } from './talk.js';
import { Placed, Spinner, yawToViewer } from './models.js';
import { resumeBar } from './resume.js';
import { contactShadow } from './room.js';
import { speak, stopSpeaking, type Voice } from './sound.js';
import { Button, C, font, OptionCard, roundRect, wrap, type Scope } from './ui.js';

/**
 * One of the two speaker places, left and right of the desk. Who stands (or sits) there changes
 * with each question: setModel() swaps in a person from the cast (speakers.ts). The voice comes
 * from the person's mouth (spatial audio). While they talk, a ring glows on the floor, the body
 * sways a little, the hands gesture and the mouth moves (talk.ts), and the name tag fills with
 * colour.
 */
interface Speaker {
  group: Group;
  ring: Mesh;
  /** The figure itself (once loaded), moved slightly while it talks. */
  readonly body: Object3D | null;
  /** Mouth and hand movement of the 3D model (talk.ts), once it has loaded. */
  readonly talker: Talker | null;
  voice: Voice;
  label: (name: string) => void;
  talking: boolean;
  /** Puts this person in the place (keeps the current one if it is the same). */
  setModel: (id: SpeakerId) => void;
  /** Adds or removes the lecture podium beside the speaker. */
  setPodium: (on: boolean) => void;
  /** Marks this speaker as talking (glowing ring + filled name tag) or not. */
  setTalking: (on: boolean) => void;
  /** Shows or hides this speaker (one-voice tasks use a single speaker). */
  setVisible: (on: boolean) => void;
  dispose: () => void;
}

function makeSpeaker(app: App, scope: Scope, slot: 0 | 1, color: string): Speaker {
  // Out to the sides (about 48°), clear of the answers and the Room / Replay / Next buttons.
  const x = slot === 0 ? -1.3 : 1.3;
  const z = -1.15;
  const group = new Group();
  group.position.set(x, 0, z);
  group.rotation.y = yawToViewer(x, z);
  const groupEntity = scope.add(group);
  // The figure: a cast model loads in the background (cached after the first time); if it cannot
  // load, a cutout photo is made into a relief figure instead (figure.ts).
  let body: Object3D | null = null;
  let placed: Placed | null = null;
  let fallback: Object3D | null = null;
  let talker: Talker | null = null;
  let current: SpeakerId | null = null;
  let disposed = false;

  // The voice comes from the mouth; the name tag floats just above the head.
  const mouth = new Object3D();
  group.add(mouth);
  // Glowing ring on the floor around the feet while this speaker talks.
  const ring = new Mesh(new TorusGeometry(0.3, 0.012, 8, 56), new MeshBasicMaterial({ color: new Color(color), toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  ring.visible = false;
  group.add(ring);
  // A soft shadow on the floor, so the person stands in the room.
  group.add(contactShadow(0.95, 0.8, 0.4));
  const tag = scope.panel(0.28, 0.07, x, 1.8, z + 0.05).panel;

  const release = () => {
    body?.rotation.set(0, 0, 0);
    if (talker) talker.talk.value = talker.mouth.value = 0;
    placed?.remove();
    fallback?.removeFromParent();
    placed = null;
    fallback = null;
    body = null;
    talker = null;
  };

  const setModel = (id: SpeakerId) => {
    if (id === current) return;
    current = id;
    release();
    const info = speakerInfo(id);
    mouth.position.set(0, info.metres - 0.14, 0.08);
    tag.mesh.position.y = info.metres + 0.1;
    void Placed.place(app.world, groupEntity, id, new Vector3(), 0).then((p) => {
      // Too late: the screen closed or another person was chosen meanwhile.
      if (disposed || current !== id) return p?.remove();
      placed = p;
      if (p) {
        body = p.root;
        p.root.traverse((o) => (talker ??= (o.userData.talker as Talker | undefined) ?? null));
      } else {
        const img = info.gender === 'female' ? app.speakerFemale : app.speakerMale;
        if (img) group.add((body = fallback = buildFigure(img, info.metres).mesh));
      }
    });
  };

  // The lecture podium stands beside the speaker, on the outer side so it stays clear of the buttons.
  let podium: Placed | null = null;
  let podiumWanted = false;
  const setPodium = (on: boolean) => {
    podiumWanted = on;
    if (!on) {
      podium?.remove();
      podium = null;
      return;
    }
    if (podium) return;
    void Placed.place(app.world, groupEntity, 'lecture-podium', new Vector3(slot === 0 ? -0.42 : 0.42, 0, 0.3), 0).then((p) => {
      if (disposed || !podiumWanted || podium) return p?.remove();
      podium = p;
    });
  };

  let name = slot === 0 ? 'Speaker A' : 'Speaker B';
  let talking = false;
  const voiceIcon = app.icon('voice');
  const drawTag = () =>
    tag.draw((ctx, W, H) => {
      tag.card(talking ? color : 'rgba(255,255,255,0.94)', color, 30);
      ctx.fillStyle = talking ? '#ffffff' : color;
      ctx.font = font(34, 800);
      ctx.textBaseline = 'middle';
      const iconSize = talking && voiceIcon ? H - 22 : 0;
      const textW = ctx.measureText(name).width;
      const x0 = (W - textW - (iconSize ? iconSize + 10 : 0)) / 2;
      if (iconSize && voiceIcon) ctx.drawImage(voiceIcon, x0, (H - iconSize) / 2, iconSize, iconSize);
      ctx.fillText(name, x0 + (iconSize ? iconSize + 10 : 0), H / 2 + 2);
    });
  const label = (n: string) => {
    name = n;
    drawTag();
  };
  drawTag();

  return {
    group,
    ring,
    get body() {
      return body;
    },
    get talker() {
      return talker;
    },
    voice: app.sound.voice(mouth),
    label,
    talking: false,
    setModel,
    setPodium,
    setVisible(on: boolean) {
      group.visible = on;
      tag.mesh.visible = on;
    },
    setTalking(on: boolean) {
      this.talking = talking = on;
      drawTag();
    },
    dispose: () => {
      disposed = true;
      // Models are shared between screens: put them back upright before detaching them.
      release();
      podium?.remove();
    },
  };
}

/**
 * Which place speaks each segment: one speaker for announcements, talks and Choose a Response
 * (left for a woman, right for a man); for conversations by gender when the two speakers differ,
 * else alternating.
 */
function speakerPlan(item: ListeningItem): { byGender: boolean; single: 0 | 1 | null; who: (i: number) => 0 | 1 } {
  const genders = item.audio.speakers ?? [];
  if (item.scene && item.scene !== 'conversation') {
    const slot: 0 | 1 = genders.find((g) => g) === 'female' ? 0 : 1;
    return { byGender: false, single: slot, who: () => slot };
  }
  const distinct = new Set(genders.filter((g): g is Gender => g === 'female' || g === 'male'));
  if (distinct.size === 2 && genders.every((g) => g)) return { byGender: true, single: null, who: (i) => (genders[i] === 'female' ? 0 : 1) };
  const script = item.audio.script ?? [];
  const names = [...new Set(script.map((l) => l.speaker))];
  return { byGender: false, single: null, who: (i) => ((script[i] ? Math.max(0, names.indexOf(script[i].speaker)) : i) % 2) as 0 | 1 };
}

/** The four listening tasks share this screen; `label` is shown on the panel. */
export const makeListeningScreen = (slug: ListeningSlug, label: string): ScreenFactory => (app, scope) => {
  let items: ListeningItem[] = [];
  let index = 0;
  let q = 0;
  let correctCount = 0;
  let playing = false;
  let cancelled = false;
  /** One decode per audio segment, started when the item loads and awaited in order on play. */
  let buffers: Promise<AudioBuffer | null>[] | null = null;
  let plan: ReturnType<typeof speakerPlan> = { byGender: false, single: null, who: (i) => (i % 2) as 0 | 1 };

  const picture = scope.panel(0.66, 0.38, 0, 1.43, -1.15).panel;
  const info = scope.panel(0.94, 0.21, 0, 1.115, -0.95).panel;
  // "Welcome back": progress since the last Start over, like the website.
  const bar = resumeBar(app, scope, slug);
  const speakers = [makeSpeaker(app, scope, 0, C.listening), makeSpeaker(app, scope, 1, C.speaking)];
  const spinner = new Spinner(app, new Vector3(0.4, 1.115, -0.86));
  const stopPulse = animate((time) => {
    for (let k = 0; k < speakers.length; k++) {
      const s = speakers[k];
      const other = speakers[1 - k];
      s.ring.visible = s.talking;
      if (s.talking) s.ring.scale.setScalar(1 + Math.sin(time * 9) * 0.08);
      if (s.body) {
        // Talking: a small, natural sway. Listening: turn towards the person who is talking.
        const listening = !s.talking && other.talking && other.group.visible;
        const yaw = s.talking ? Math.sin(time * 1.7) * 0.05 : listening ? (k === 0 ? 0.45 : -0.45) : 0;
        s.body.rotation.y += (yaw - s.body.rotation.y) * 0.07;
        s.body.rotation.z = s.talking ? Math.sin(time * 2.4) * 0.012 : 0;
      }
      // Hands gesture while talking, and the mouth follows how loud the voice is.
      const t = s.talker;
      if (!t) continue;
      t.time.value = time;
      t.talk.value += ((s.talking ? 1 : 0) - t.talk.value) * 0.06;
      let mouth = 0;
      if (s.talking) {
        // The browser voice (used while a question's audio is not ready) cannot be measured:
        // then the mouth moves in a speech-like rhythm instead.
        mouth = s.voice.playing ? s.voice.level() : Math.max(0, Math.sin(time * 11) * 0.6 + Math.sin(time * 4.3) * 0.4);
      }
      t.mouth.value += (mouth - t.mouth.value) * 0.5;
    }
  });

  // Controls sit between the answers and the speakers: Room on the left, Replay / Next on the right.
  new Button(scope, { w: 0.2, h: 0.075, label: 'Back', icon: app.icon('ctl-back'), tone: 'ghost' }, -0.69, 0.93, -0.86, () => app.goHub());
  // Starts disabled: it is enabled only after the picture and all audio have loaded (loadItem).
  const play = new Button(scope, { w: 0.36, h: 0.09, label: 'Loading conversation…', tone: 'primary', enabled: false }, 0, 0.93, -0.9, () => void playConversation());
  play.panel.mesh.name = 'Btn_Playconversation';
  const replay = new Button(scope, { w: 0.2, h: 0.075, label: 'Replay', icon: app.icon('retry'), tone: 'ghost' }, 0.69, 0.93, -0.86, () => void playConversation());
  replay.visible = false;
  // 2 x 2 answer cards with a letter badge; text wraps instead of shrinking.
  const options = [0, 1, 2, 3].map((i) => new OptionCard(app.sound, scope, i, (i % 2 ? 1 : -1) * 0.235, 0.93 - Math.floor(i / 2) * 0.1, -0.9, () => void answer(i)));
  const next = new Button(scope, { w: 0.2, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.69, 0.835, -0.86, () => {
    if (nextItemPending) {
      nextItemPending = false;
      index++;
      void loadItem();
    } else nextQuestion();
  });
  next.visible = false;
  let nextItemPending = false;

  const drawPicture = (img: CanvasImageSource | null, title: string) =>
    picture.draw((ctx, W, H) => {
      picture.card(C.surface, C.line, 30);
      ctx.save();
      roundRect(ctx, 14, 14, W - 28, H - 28, 22);
      ctx.clip();
      if (img) {
        const iw = (img as HTMLImageElement).width;
        const ih = (img as HTMLImageElement).height;
        const s = Math.max((W - 28) / iw, (H - 28) / ih);
        ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      } else {
        ctx.fillStyle = C.soft;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      const g = ctx.createLinearGradient(0, H - 110, 0, H);
      g.addColorStop(0, 'rgba(16,27,77,0)');
      g.addColorStop(1, 'rgba(16,27,77,0.75)');
      ctx.fillStyle = g;
      ctx.fillRect(14, H - 110, W - 28, 96);
      ctx.fillStyle = '#ffffff';
      ctx.font = font(34, 800);
      ctx.fillText(title, 40, H - 70);
    });

  const drawInfo = (draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, counter?: string) =>
    info.draw((ctx, W, H) => {
      info.card();
      ctx.fillStyle = C.listening;
      ctx.font = font(22, 800);
      ctx.fillText(label.toUpperCase(), 36, 22);
      if (counter) {
        // "Question 1 of 2" chip on the right.
        ctx.font = font(20, 800);
        const cw = ctx.measureText(counter).width + 28;
        roundRect(ctx, W - cw - 30, 16, cw, 34, 17);
        ctx.fillStyle = C.soft;
        ctx.fill();
        ctx.fillStyle = C.primaryDark;
        ctx.textBaseline = 'middle';
        ctx.fillText(counter, W - cw - 16, 34);
        ctx.textBaseline = 'top';
      }
      draw(ctx, W, H);
    });

  /** Result banner (✓ / ✗ and a title) plus the explanation, inside the info panel. */
  const drawResult = (ok: boolean, title: string, body: string, counter?: string) =>
    drawInfo((ctx, W) => {
      roundRect(ctx, 24, 60, W - 48, 62, 18);
      ctx.fillStyle = ok ? C.successSoft : C.dangerSoft;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(64, 91, 19, 0, Math.PI * 2);
      ctx.fillStyle = ok ? C.success : C.danger;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (ok) {
        ctx.moveTo(55, 91);
        ctx.lineTo(62, 98);
        ctx.lineTo(74, 84);
      } else {
        ctx.moveTo(57, 84);
        ctx.lineTo(71, 98);
        ctx.moveTo(71, 84);
        ctx.lineTo(57, 98);
      }
      ctx.stroke();
      ctx.fillStyle = ok ? C.success : C.danger;
      ctx.font = font(32, 800);
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 96, 92);
      ctx.textBaseline = 'top';
      ctx.fillStyle = C.body;
      ctx.font = font(24, 500);
      wrap(ctx, body, 36, 134, W - 72, 29, 2);
    }, counter);

  const message = (text: string, color: string = C.ink) =>
    drawInfo((ctx, W) => {
      ctx.fillStyle = color;
      ctx.font = font(36, 700);
      wrap(ctx, text, 36, 70, W - 72, 44, 3);
    });

  const loadItem = async () => {
    const item = items[index];
    // Continue at the first question not answered yet (e.g. after leaving halfway).
    q = app.data.firstOpen(slug, item.itemId, item.questions.map((x) => x.unitId));
    correctCount = 0;
    buffers = null;
    options.forEach((o) => (o.visible = false));
    next.visible = false;
    replay.visible = false;
    play.visible = true;
    drawPicture(null, item.title);
    // Choose a Response has no picture: just the voice, the question and the answers.
    picture.mesh.visible = item.scene !== 'response';
    plan = speakerPlan(item);
    speakers.forEach((sp, k) => sp.setVisible(plan.single === null || plan.single === k));
    // Name tags: the script's names when known, otherwise Speaker A / B.
    const script = item.audio.script ?? [];
    ([0, 1] as const).forEach((slot) => {
      const line = script.find((_, i) => plan.who(i) === slot);
      const role = item.scene === 'lecture' ? 'Professor' : item.scene === 'announcement' ? 'Announcer' : 'Speaker';
      speakers[slot].label(line?.speaker ?? (plan.single !== null ? role : slot === 0 ? 'Speaker A' : 'Speaker B'));
    });
    // Who speaks: a person from the cast for each place, matched to the voice's gender and the
    // scene (the same question always shows the same people). Two women or two men in one
    // conversation get two different people.
    const scene: SpeakerScene = (['announcement', 'lecture', 'response'] as const).find((sc) => sc === item.scene) ?? 'conversation';
    const genders = item.audio.speakers ?? [];
    const segments = Math.max(genders.length, script.length, item.audio.assetIds.length);
    const genderOf = (slot: 0 | 1): Gender => {
      for (let i = 0; i < segments; i++) {
        const g = genders[i];
        if (plan.who(i) === slot && g) return g;
      }
      return slot === 0 ? 'female' : 'male';
    };
    if (plan.single !== null) {
      speakers[plan.single].setModel(pickSpeaker(genderOf(plan.single), scene, item.title, `${item.itemId}:${plan.single}`));
    } else {
      const first = pickSpeaker(genderOf(0), scene, item.title, `${item.itemId}:0`);
      speakers[0].setModel(first);
      speakers[1].setModel(pickSpeaker(genderOf(1), scene, item.title, `${item.itemId}:1`, first));
    }
    // An academic talk gets a lecture podium beside the professor.
    speakers.forEach((sp, k) => sp.setPodium(scene === 'lecture' && plan.single === k));
    // Nothing can be pressed until the picture and every audio clip have loaded.
    play.update({ enabled: false, label: 'Loading conversation…', icon: null });
    message('Loading the picture and the conversation…', C.muted);
    void spinner.show(true);
    // Audio: start downloading every segment now, in parallel with the picture.
    buffers = item.audio.assetIds.length
      ? item.audio.assetIds.map((id) =>
          app.data
            .media(id)
            .then((b) => b.arrayBuffer())
            .then((ab) => app.sound.decode(ab))
            .catch(() => null),
        )
      : null;
    // Picture: the learner's Muse Image scene.
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    if (item.imageAssetId) {
      try {
        const url = URL.createObjectURL(await app.data.media(item.imageAssetId));
        drawPicture(await loadImg(url), item.title);
        URL.revokeObjectURL(url);
      } catch {
        // Picture is optional; keep the placeholder.
      }
    }
    await Promise.all(buffers ?? []);
    if (cancelled) return;
    void spinner.show(false);
    // Wording per task: conversations have two speakers, the others one voice.
    const copy: Record<string, [string, string]> = {
      response: ['Play', 'Pinch "Play" to hear one line, then choose the best reply.'],
      announcement: ['Play announcement', 'Pinch "Play announcement" and listen for the key details.'],
      lecture: ['Play talk', 'Pinch "Play talk" and listen to the main ideas.'],
    };
    const [playLabel, hint] = copy[item.scene ?? ''] ?? ['Play conversation', 'Pinch "Play conversation". Listen to who is speaking and where.'];
    play.update({ enabled: true, label: playLabel, icon: app.icon('start') });
    message(hint);
  };

  const playConversation = async () => {
    const item = items[index];
    if (!item || playing) return;
    playing = true;
    cancelled = false;
    app.sound.resume();
    play.update({ enabled: false, label: 'Listening…' });
    replay.update({ enabled: false });
    const script = item.audio.script ?? [];
    const segments = buffers?.length ?? script.length;
    for (let i = 0; i < segments && !cancelled; i++) {
      // Who speaks: matched by gender when known, otherwise from the script or taking turns.
      const who = plan.who(i);
      const s = speakers[who];
      const name = script[i]?.speaker ?? (who ? 'Speaker B' : 'Speaker A');
      let buf: AudioBuffer | null = null;
      if (buffers?.[i]) {
        // Show the spinner only if this clip is still downloading.
        const waiting = setTimeout(() => {
          message('Loading the next part…', C.muted);
          void spinner.show(true);
        }, 150);
        buf = await buffers[i];
        clearTimeout(waiting);
        void spinner.show(false);
      }
      if (cancelled) break;
      s.setTalking(true);
      message(`${name} is speaking…  (${i + 1} of ${segments})`, who ? C.speaking : C.listening);
      if (buf) await s.voice.play(buf);
      else if (script[i]) await speak(script[i].text, { pitch: item.audio.speakers?.[i] === 'male' || (!item.audio.speakers && who) ? 0.85 : 1.15 });
      s.setTalking(false);
    }
    playing = false;
    if (cancelled) return;
    play.visible = false;
    replay.visible = true;
    replay.update({ enabled: true });
    showQuestion();
  };

  const showQuestion = () => {
    const item = items[index];
    const question = item.questions[q];
    next.visible = false;
    drawInfo((ctx, W) => {
      ctx.fillStyle = C.ink;
      ctx.font = font(36, 800);
      wrap(ctx, question.prompt, 36, 72, W - 72, 44, 3);
    }, `Question ${q + 1} of ${item.questions.length}`);
    options.forEach((o, i) => {
      const opt = question.options[i];
      o.visible = Boolean(opt);
      if (opt) o.set(opt.id, opt.text);
    });
    app.sound.play('appear', 0.3);
  };

  const answer = async (i: number) => {
    const item = items[index];
    const question = item.questions[q];
    const opt = question.options[i];
    if (!opt) return;
    options.forEach((o) => o.setEnabled(false));
    // Show at once which answer was chosen and that it is being checked.
    options[i].setState('selected');
    app.sound.play('click', 0.4);
    message('Checking your answer…', C.primary);
    void spinner.show(true);
    try {
      const r = await app.data.check(item.itemId, question.unitId, opt.id);
      void spinner.show(false);
      if (r.correct) correctCount++;
      app.sound.play(r.correct ? 'done' : 'toggle', 0.5);
      const right = question.options.findIndex((o) => o.id === r.answer || o.text === r.answer);
      options.forEach((o, k) => o.setState(k === i ? (r.correct ? 'correct' : 'wrong') : k === right ? 'correct' : 'dim'));
      drawResult(Boolean(r.correct), r.correct ? 'Correct!' : 'Not quite.', r.explanation ?? '', `Question ${q + 1} of ${item.questions.length}`);
      next.update({ label: q + 1 < item.questions.length ? 'Next' : 'Finish' });
      next.visible = true;
    } catch (e) {
      void spinner.show(false);
      message(errorMessage(e), C.danger);
      options.forEach((o) => {
        o.setState('idle');
        o.setEnabled(true);
      });
    }
  };

  const nextQuestion = () => {
    const item = items[index];
    options.forEach((o) => (o.visible = false));
    if (q + 1 < item.questions.length) {
      q++;
      showQuestion();
      return;
    }
    // Finished this conversation.
    next.visible = false;
    app.completeActivity();
    drawResult(
      correctCount === item.questions.length,
      `You got ${correctCount} of ${item.questions.length} right.`,
      index + 1 < items.length ? 'Pinch Next for another conversation, or go back to the room.' : 'Nice work. Go back to the room for another station.',
    );
    if (index + 1 < items.length) {
      next.update({ label: 'Next' });
      next.visible = true;
      nextItemPending = true;
    }
  };

  return {
    async start() {
      message('Loading your conversation…', C.primary);
      try {
        items = await app.data.listening(slug);
        bar.update();
        if (!items.length) {
          play.visible = false;
          message('These questions are not ready yet. They appear here as soon as your study plan finishes making them. Try another station or come back in a few minutes.', C.muted);
          return;
        }
        await loadItem();
      } catch (e) {
        message(errorMessage(e), C.danger);
      }
    },
    dispose() {
      cancelled = true;
      stopSpeaking();
      speakers.forEach((s) => {
        s.voice.dispose();
        s.dispose();
      });
      stopPulse();
      spinner.dispose();
    },
  };
};
