/**
 * Listen to a Conversation: the scene picture hangs in front, the two speakers stand to the
 * left and right and each voice comes from where that person stands (spatial audio). After the
 * conversation the learner pinches an answer for each question.
 */
import { CapsuleGeometry, Color, Group, Mesh, MeshLambertMaterial, SphereGeometry, TorusGeometry, MeshBasicMaterial } from '@iwsdk/core';
import type { App, ScreenFactory } from './app.js';
import { animate } from './clicks.js';
import { errorMessage, type ListeningItem } from './data.js';
import { speak, stopSpeaking, type Voice } from './sound.js';
import { Button, C, font, roundRect, wrap, type Scope } from './ui.js';

const BASE = import.meta.env.BASE_URL;

interface Speaker {
  group: Group;
  ring: Mesh;
  voice: Voice;
  label: (name: string) => void;
  talking: boolean;
}

function makeSpeaker(app: App, scope: Scope, x: number, color: string, pitchHint: string): Speaker {
  const group = new Group();
  group.position.set(x, 0.72, -1.2);
  group.rotation.y = Math.atan2(-x, 1.2);
  const mat = new MeshLambertMaterial({ color: new Color(color) });
  const body = new Mesh(new CapsuleGeometry(0.12, 0.28, 6, 14), mat);
  body.position.y = 0.26;
  group.add(body);
  const head = new Mesh(new SphereGeometry(0.1, 20, 14), new MeshLambertMaterial({ color: new Color('#f1c9a5') }));
  head.position.y = 0.6;
  group.add(head);
  const ring = new Mesh(new TorusGeometry(0.17, 0.008, 8, 40), new MeshBasicMaterial({ color: new Color(color), toneMapped: false }));
  ring.position.y = 0.6;
  ring.visible = false;
  group.add(ring);
  scope.add(group);
  const tag = scope.panel(0.26, 0.07, x, 1.5, -1.2).panel;
  const label = (name: string) =>
    tag.draw((ctx, W, H) => {
      tag.card('rgba(255,255,255,0.94)', color, 30);
      ctx.fillStyle = color;
      ctx.font = font(34, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, W / 2, H / 2 + 2);
    });
  label(pitchHint);
  return { group, ring, voice: app.sound.voice(head), label, talking: false };
}

export const listeningScreen: ScreenFactory = (app, scope) => {
  let items: ListeningItem[] = [];
  let demo = false;
  let index = 0;
  let q = 0;
  let correctCount = 0;
  let playing = false;
  let cancelled = false;
  /** One decode per audio segment, started when the item loads and awaited in order on play. */
  let buffers: Promise<AudioBuffer | null>[] | null = null;

  const picture = scope.panel(0.72, 0.42, 0, 1.4, -1.15).panel;
  const info = scope.panel(0.94, 0.17, 0, 1.08, -0.95).panel;
  const speakers = [makeSpeaker(app, scope, -0.9, C.listening, 'Speaker A'), makeSpeaker(app, scope, 0.9, C.speaking, 'Speaker B')];
  const stopPulse = animate((time) => {
    for (const s of speakers) {
      s.ring.visible = s.talking;
      if (s.talking) s.ring.scale.setScalar(1 + Math.sin(time * 9) * 0.08);
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
      ctx.fillText(`LISTEN TO A CONVERSATION${demo ? '  ·  DEMO' : ''}`, 40, 24);
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
    const names = [...new Set((item.audio.script ?? []).map((l) => l.speaker))];
    speakers[0].label(names[0] ?? 'Speaker A');
    speakers[1].label(names[1] ?? 'Speaker B');
    message('Pinch "Play conversation". Listen to who is speaking and where.');
    // Picture: the learner's Muse Image scene, or the demo illustration.
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
    } else if (demo) drawPicture(await loadImg(`${BASE}img/demo-conversation.png`), item.title);
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
    const names = [...new Set(script.map((l) => l.speaker))];
    const segments = buffers?.length ?? script.length;
    for (let i = 0; i < segments && !cancelled; i++) {
      // Who speaks: from the script when known, otherwise the two voices take turns.
      const who = script[i] ? Math.max(0, names.indexOf(script[i].speaker)) % 2 : i % 2;
      const s = speakers[who];
      s.talking = true;
      message(`${script[i]?.speaker ?? (who ? 'Speaker B' : 'Speaker A')} is speaking…  (${i + 1} of ${segments})`, who ? C.speaking : C.listening);
      const buf = buffers?.[i] ? await buffers[i] : null;
      if (cancelled) break;
      if (buf) await s.voice.play(buf);
      else if (script[i]) await speak(script[i].text, { pitch: who ? 0.85 : 1.15 });
      s.talking = false;
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
      options[i].update({ label: `${opt.id}.  ${opt.text}`, tone: 'secondary', enabled: true });
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
    app.sound.play('click', 0.4);
    try {
      const r = await app.data.check(item.itemId, question.unitId, opt.id);
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
      message(errorMessage(e), C.danger);
      options.forEach((o) => o.update({ enabled: true }));
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
        ({ items, demo } = await app.data.listening());
        await loadItem();
      } catch (e) {
        message(errorMessage(e), C.danger);
      }
    },
    dispose() {
      cancelled = true;
      stopSpeaking();
      speakers.forEach((s) => s.voice.dispose());
      stopPulse();
    },
  };
};
