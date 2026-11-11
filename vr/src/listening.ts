/**
 * Listen to a Conversation: the scene picture hangs in front, the two speakers stand to the
 * left and right and each voice comes from where that person stands (spatial audio). After the
 * conversation the learner pinches an answer for each question.
 */
import { CapsuleGeometry, Color, Entity, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, RayInteractable, SphereGeometry, TorusGeometry, Vector3 } from '@iwsdk/core';
import type { App, ScreenFactory } from './app.js';
import { animate, onPress } from './clicks.js';
import { errorMessage, type ListeningItem, type ListeningSlug } from './data.js';
import { Placed, Spinner, yawToViewer } from './models.js';
import { speak, stopSpeaking, type Voice } from './sound.js';
import { Button, C, font, OptionCard, roundRect, wrap, type Scope } from './ui.js';

type Gender = 'female' | 'male';

/**
 * One of the two speakers, left and right of the desk: a simple figure seated on a school chair.
 * The voice comes from the figure's head (spatial audio). While it talks, a halo glows around its
 * head and its name tag fills with colour.
 */
interface Speaker {
  group: Group;
  ring: Mesh;
  voice: Voice;
  label: (name: string) => void;
  talking: boolean;
  /** Marks this speaker as talking (halo + filled name tag) or not. */
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
  // Seated figure: body resting on the chair seat (about 45 cm high).
  const body = new Mesh(new CapsuleGeometry(0.13, 0.26, 6, 14), new MeshLambertMaterial({ color: new Color(color) }));
  body.position.set(0, 0.73, -0.06);
  const head = new Mesh(new SphereGeometry(0.1, 20, 14), new MeshLambertMaterial({ color: new Color('#f1c9a5') }));
  head.position.set(0, 1.1, -0.06);
  group.add(body, head);
  // Glowing halo around the head while this speaker talks (visible above the desk).
  const ring = new Mesh(new TorusGeometry(0.15, 0.014, 10, 48), new MeshBasicMaterial({ color: new Color(color), toneMapped: false }));
  ring.position.set(0, 1.1, -0.06);
  ring.visible = false;
  group.add(ring);
  const groupEntity = scope.add(group);

  const tag = scope.panel(0.28, 0.07, x * 0.92, 1.36, z + 0.05).panel;
  let chairRef: Placed | null = null;
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

  // The CC0 school chair loads in the background (chair front faces +Z, like the figure).
  let chair: Placed | null = null;
  let disposed = false;
  void Placed.place(app.world, groupEntity, 'school-chair', new Vector3(0, 0, -0.05), 0).then((p) => {
    chair = p;
    chairRef = p;
    if (p) p.root.visible = group.visible;
    if (disposed) p?.remove();
  });

  return {
    group,
    ring,
    voice: app.sound.voice(head),
    label,
    talking: false,
    setVisible(on: boolean) {
      group.visible = on;
      tag.mesh.visible = on;
      if (chairRef) chairRef.root.visible = on;
    },
    setTalking(on: boolean) {
      this.talking = talking = on;
      drawTag();
    },
    dispose: () => {
      disposed = true;
      chair?.remove();
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
  const speakers = [makeSpeaker(app, scope, 0, C.listening), makeSpeaker(app, scope, 1, C.speaking)];
  const spinner = new Spinner(app, new Vector3(0.4, 1.115, -0.86));
  const stopPulse = animate((time) => {
    for (const s of speakers) {
      s.ring.visible = s.talking;
      if (s.talking) s.ring.scale.setScalar(1 + Math.sin(time * 9) * 0.1);
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
    q = 0;
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
