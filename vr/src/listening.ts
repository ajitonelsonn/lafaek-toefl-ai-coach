/**
 * Listen to a Conversation: the scene picture hangs in front, the two speakers stand to the
 * left and right and each voice comes from where that person stands (spatial audio). After the
 * conversation the learner pinches an answer for each question.
 */
import { CapsuleGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, TorusGeometry, Vector3 } from '@iwsdk/core';
import type { App, ScreenFactory } from './app.js';
import { animate } from './clicks.js';
import { errorMessage, type ListeningItem } from './data.js';
import { Placed, Spinner, yawToViewer } from './models.js';
import { speak, stopSpeaking, type Voice } from './sound.js';
import { Button, C, font, roundRect, wrap, type Scope } from './ui.js';

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
  dispose: () => void;
}

function makeSpeaker(app: App, scope: Scope, slot: 0 | 1, color: string): Speaker {
  const x = slot === 0 ? -0.95 : 0.95;
  const z = -1.25;
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
    if (disposed) p?.remove();
  });

  return {
    group,
    ring,
    voice: app.sound.voice(head),
    label,
    talking: false,
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

/** Which place speaks each segment: by gender when the two speakers differ, else alternating. */
function speakerPlan(item: ListeningItem): { byGender: boolean; who: (i: number) => 0 | 1 } {
  const genders = item.audio.speakers ?? [];
  const distinct = new Set(genders.filter((g): g is Gender => g === 'female' || g === 'male'));
  if (distinct.size === 2 && genders.every((g) => g)) return { byGender: true, who: (i) => (genders[i] === 'female' ? 0 : 1) };
  const script = item.audio.script ?? [];
  const names = [...new Set(script.map((l) => l.speaker))];
  return { byGender: false, who: (i) => ((script[i] ? Math.max(0, names.indexOf(script[i].speaker)) : i) % 2) as 0 | 1 };
}

export const listeningScreen: ScreenFactory = (app, scope) => {
  let items: ListeningItem[] = [];
  let index = 0;
  let q = 0;
  let correctCount = 0;
  let playing = false;
  let cancelled = false;
  /** One decode per audio segment, started when the item loads and awaited in order on play. */
  let buffers: Promise<AudioBuffer | null>[] | null = null;
  let plan: ReturnType<typeof speakerPlan> = { byGender: false, who: (i) => (i % 2) as 0 | 1 };

  const picture = scope.panel(0.72, 0.42, 0, 1.4, -1.15).panel;
  const info = scope.panel(0.94, 0.17, 0, 1.08, -0.95).panel;
  const speakers = [makeSpeaker(app, scope, 0, C.listening), makeSpeaker(app, scope, 1, C.speaking)];
  const spinner = new Spinner(app, new Vector3(0.36, 1.08, -0.84));
  const stopPulse = animate((time) => {
    for (const s of speakers) {
      s.ring.visible = s.talking;
      if (s.talking) s.ring.scale.setScalar(1 + Math.sin(time * 9) * 0.1);
    }
  });

  new Button(scope, { w: 0.2, h: 0.075, label: 'Room', icon: app.icon('home'), tone: 'ghost' }, -0.6, 0.95, -0.84, () => app.goHub());
  const play = new Button(scope, { w: 0.34, h: 0.085, label: 'Play conversation', icon: app.icon('start'), tone: 'primary' }, 0, 0.94, -0.88, () => void playConversation());
  const replay = new Button(scope, { w: 0.2, h: 0.075, label: 'Replay', icon: app.icon('retry'), tone: 'ghost' }, 0.6, 0.95, -0.84, () => void playConversation());
  replay.visible = false;
  const options = [0, 1, 2, 3].map(
    (i) => new Button(scope, { w: 0.46, h: 0.07, label: '', tone: 'secondary' }, (i % 2 ? 1 : -1) * 0.24, 0.94 - Math.floor(i / 2) * 0.08, -0.88, () => void answer(i)),
  );
  options.forEach((o, i) => {
    o.visible = false;
    o.panel.mesh.name = `Option_${'ABCD'[i]}`;
  });
  const next = new Button(scope, { w: 0.2, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.6, 0.86, -0.84, () => {
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

  const drawInfo = (draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void, tone?: 'success' | 'danger') =>
    info.draw((ctx, W, H) => {
      info.card(tone === 'success' ? C.successSoft : tone === 'danger' ? C.dangerSoft : C.surface, tone === 'success' ? C.success : tone === 'danger' ? C.danger : C.line);
      ctx.fillStyle = C.listening;
      ctx.font = font(24, 800);
      ctx.fillText('LISTEN TO A CONVERSATION', 40, 24);
      draw(ctx, W, H);
    });

  const message = (text: string, color: string = C.ink) =>
    drawInfo((ctx, W) => {
      ctx.fillStyle = color;
      ctx.font = font(36, 700);
      wrap(ctx, text, 40, 66, W - 80, 44, 2);
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
    plan = speakerPlan(item);
    // Name tags: the script's names when known, otherwise Speaker A / B.
    const script = item.audio.script ?? [];
    ([0, 1] as const).forEach((slot) => {
      const line = script.find((_, i) => plan.who(i) === slot);
      speakers[slot].label(line?.speaker ?? (slot === 0 ? 'Speaker A' : 'Speaker B'));
    });
    message('Pinch "Play conversation". Listen to who is speaking and where.');
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
    // Audio files (signed in): start downloading every segment now; playback begins as soon as
    // the first one is ready and later ones keep loading in the background.
    if (item.audio.assetIds.length) {
      buffers = item.audio.assetIds.map((id) =>
        app.data
          .media(id)
          .then((b) => b.arrayBuffer())
          .then((ab) => app.sound.decode(ab))
          .catch(() => null),
      );
    }
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
      ctx.fillStyle = C.muted;
      ctx.font = font(26, 700);
      ctx.fillText(`Question ${q + 1} of ${item.questions.length}`, W - 300, 24);
      ctx.fillStyle = C.ink;
      ctx.font = font(36, 700);
      wrap(ctx, question.prompt, 40, 64, W - 80, 44, 2);
    });
    question.options.slice(0, 4).forEach((opt, i) => {
      options[i].update({ label: `${opt.id}.  ${opt.text}`, tone: 'secondary', enabled: true, selected: false });
      options[i].visible = true;
    });
    app.sound.play('appear', 0.3);
  };

  const answer = async (i: number) => {
    const item = items[index];
    const question = item.questions[q];
    const opt = question.options[i];
    if (!opt) return;
    options.forEach((o) => o.update({ enabled: false }));
    // Show at once which answer was chosen and that it is being checked.
    options[i].update({ tone: 'soft', enabled: false, selected: true });
    app.sound.play('click', 0.4);
    message('Checking your answer…', C.primary);
    void spinner.show(true);
    try {
      const r = await app.data.check(item.itemId, question.unitId, opt.id);
      void spinner.show(false);
      if (r.correct) correctCount++;
      app.sound.play(r.correct ? 'done' : 'toggle', 0.5);
      options[i].update({ tone: r.correct ? 'success' : 'danger', enabled: false });
      const right = question.options.findIndex((o) => o.id === r.answer || o.text === r.answer);
      if (!r.correct && right >= 0) options[right].update({ tone: 'success', enabled: false });
      drawInfo((ctx, W) => {
        ctx.fillStyle = r.correct ? C.success : C.danger;
        ctx.font = font(36, 800);
        ctx.fillText(r.correct ? 'Correct!' : 'Not quite.', 40, 62);
        ctx.fillStyle = C.body;
        ctx.font = font(28, 500);
        wrap(ctx, r.explanation ?? '', 40, 108, W - 80, 34, 2);
      }, r.correct ? 'success' : 'danger');
      next.update({ label: q + 1 < item.questions.length ? 'Next' : 'Finish' });
      next.visible = true;
    } catch (e) {
      void spinner.show(false);
      message(errorMessage(e), C.danger);
      options.forEach((o) => o.update({ enabled: true, tone: 'secondary', selected: false }));
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
    drawInfo((ctx, W) => {
      ctx.fillStyle = C.ink;
      ctx.font = font(40, 800);
      ctx.fillText(`You got ${correctCount} of ${item.questions.length} right.`, 40, 62);
      ctx.fillStyle = C.body;
      ctx.font = font(30, 500);
      wrap(ctx, index + 1 < items.length ? 'Pinch Next for another conversation, or go back to the room.' : 'Nice work. Go back to the room for another station.', 40, 114, W - 80, 36, 2);
    }, correctCount === item.questions.length ? 'success' : undefined);
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
        items = await app.data.listening();
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
