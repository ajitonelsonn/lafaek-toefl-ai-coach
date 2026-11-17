/**
 * Listen and Repeat: the learner hears one sentence, repeats it into the headset microphone, and
 * sees how many words matched (Muse Voice Transcribe via the LafaekTOEFL API): matched words in
 * green, missed words in red, and what they said. Each sentence's audio is loaded before the
 * "Hear sentence" button turns on.
 */
import type { ScreenFactory } from './app.js';
import { resumeBar } from './resume.js';
import { errorMessage, type RepeatItem, type SpeechResult } from './data.js';
import { Spinner } from './models.js';
import { Vector3 } from '@iwsdk/core';
import { speak, stopSpeaking } from './sound.js';
import { Button, C, font, wrap, type Ctx } from './ui.js';
import { toWav16k } from './wav.js';

type Phase = 'loading' | 'ready' | 'hearing' | 'recording' | 'scoring' | 'result';

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

export const repeatScreen: ScreenFactory = (app, scope) => {
  let item: RepeatItem | null = null;
  let s = 0;
  let phase: Phase = 'loading';
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  let heard = false;

  const situation = scope.panel(0.9, 0.13, 0, 1.46, -1.1).panel;
  const panel = scope.panel(0.9, 0.27, 0, 1.17, -0.95).panel;
  // "Welcome back": progress since the last Start over, like the website.
  const bar = resumeBar(app, scope, 'listen-repeat');
  const spinner = new Spinner(app, new Vector3(0.4, 1.2, -0.88));
  const voice = app.sound.voice(panel.mesh);
  new Button(scope, { w: 0.17, h: 0.075, label: 'Back', icon: app.icon('ctl-back'), tone: 'ghost' }, -0.6, 0.95, -0.85, () => app.goHub());
  const hear = new Button(scope, { w: 0.28, h: 0.08, label: 'Loading…', icon: app.icon('voice'), tone: 'soft', enabled: false }, -0.18, 0.95, -0.88, () => void hearSentence());
  hear.panel.mesh.name = 'Btn_Hearsentence';
  const rec = new Button(scope, { w: 0.28, h: 0.08, label: 'Repeat', icon: app.icon('start'), tone: 'primary', enabled: false }, 0.18, 0.95, -0.88, () => void toggleRecording());
  rec.panel.mesh.name = 'Btn_Repeat';
  const next = new Button(scope, { w: 0.18, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.6, 0.95, -0.85, () => nextSentence());
  next.visible = false;

  /** Each sentence's audio, downloaded ahead (unitId -> decoded clips). */
  const audio = new Map<string, Promise<(AudioBuffer | null)[]>>();
  const preload = (i: number) => {
    const sentence = item?.sentences[i];
    if (!sentence || !sentence.audio.assetIds.length) return Promise.resolve([] as (AudioBuffer | null)[]);
    if (!audio.has(sentence.unitId)) {
      audio.set(sentence.unitId, Promise.all(sentence.audio.assetIds.map((id) => app.data.media(id).then((b) => b.arrayBuffer()).then((ab) => app.sound.decode(ab)).catch(() => null))));
    }
    return audio.get(sentence.unitId)!;
  };

  const header = (ctx: Ctx, W: number) => {
    ctx.fillStyle = C.speaking;
    ctx.font = font(22, 800);
    ctx.fillText('LISTEN AND REPEAT', 36, 22);
    if (item) {
      ctx.fillStyle = C.muted;
      ctx.font = font(21, 800);
      ctx.textAlign = 'right';
      ctx.fillText(`Sentence ${s + 1} of ${item.sentences.length}`, W - 36, 22);
      ctx.textAlign = 'left';
    }
  };

  const show = (title: string, body = '', opts: { color?: string; seconds?: number; total?: number } = {}) =>
    panel.draw((ctx, W, H) => {
      panel.card();
      header(ctx, W);
      ctx.fillStyle = opts.color ?? C.ink;
      ctx.font = font(36, 800);
      wrap(ctx, title, 36, 64, W - (opts.total ? 250 : 72), 42, 2);
      ctx.fillStyle = C.body;
      ctx.font = font(26, 500);
      wrap(ctx, body, 36, 160, W - (opts.total ? 250 : 72), 32, 3);
      if (opts.total) {
        const cx = W - 115;
        const cy = H / 2 + 12;
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#ede9fe';
        ctx.beginPath();
        ctx.arc(cx, cy, 64, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = C.speaking;
        ctx.beginPath();
        ctx.arc(cx, cy, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((opts.seconds ?? 0) / opts.total));
        ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.font = font(44, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.max(0, Math.ceil(opts.seconds ?? 0))), cx, cy + 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
    });

  /** The result: banner, the sentence with matched (green) and missed (red) words, what was said. */
  const showResult = (r: SpeechResult) =>
    panel.draw((ctx, W) => {
      panel.card();
      header(ctx, W);
      const pct = Math.round((r.similarity ?? 0) * 100);
      const ok = Boolean(r.correct);
      ctx.beginPath();
      ctx.arc(54, 76, 19, 0, Math.PI * 2);
      ctx.fillStyle = ok ? C.success : C.danger;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (ok) {
        ctx.moveTo(45, 76);
        ctx.lineTo(52, 83);
        ctx.lineTo(64, 69);
      } else {
        ctx.moveTo(47, 69);
        ctx.lineTo(61, 83);
        ctx.moveTo(61, 69);
        ctx.lineTo(47, 83);
      }
      ctx.stroke();
      ctx.fillStyle = ok ? C.success : C.danger;
      ctx.font = font(30, 800);
      ctx.textBaseline = 'middle';
      ctx.fillText(ok ? `Great! ${pct}% of the words matched.` : `${pct}% of the words matched. Try again?`, 86, 77);
      ctx.textBaseline = 'top';
      // The sentence, word by word: green when you said it, red when it was missed.
      const said = new Map<string, number>();
      for (const w of r.transcript.split(/\s+/).map(norm).filter(Boolean)) said.set(w, (said.get(w) ?? 0) + 1);
      let x = 36;
      let y = 114;
      ctx.font = font(30, 800);
      for (const word of (r.expected ?? '').split(/\s+/).filter(Boolean)) {
        const key = norm(word);
        const hit = (said.get(key) ?? 0) > 0;
        if (hit) said.set(key, (said.get(key) ?? 0) - 1);
        const ww = ctx.measureText(word).width;
        if (x + ww > W - 36) {
          x = 36;
          y += 38;
        }
        ctx.fillStyle = hit ? C.success : C.danger;
        ctx.fillText(word, x, y);
        if (!hit) ctx.fillRect(x, y + 33, ww, 3);
        x += ww + 12;
      }
      ctx.fillStyle = C.muted;
      ctx.font = font(22, 600);
      wrap(ctx, `You said: "${r.transcript || '…'}"`, 36, y + 46, W - 72, 26, 2);
    });

  const ready = () => {
    phase = 'ready';
    hear.update({ enabled: true, label: heard ? 'Hear again' : 'Hear sentence' });
    rec.update({ enabled: heard, label: 'Repeat', icon: app.icon('start'), tone: 'primary' });
    if (!heard) show('Listen to the sentence', 'Pinch "Hear sentence", then repeat it exactly.');
    else show('Now repeat the sentence', `Pinch Repeat and say it. You have up to ${item!.sentences[s].responseSeconds} seconds.`);
  };

  /** Loads this sentence's audio (buttons stay off meanwhile), then enables "Hear sentence". */
  const prepare = async () => {
    phase = 'loading';
    heard = false;
    next.visible = false;
    hear.update({ enabled: false, label: 'Loading…' });
    rec.update({ enabled: false });
    show('Loading the sentence…', '', { color: C.muted });
    void spinner.show(true);
    await preload(s);
    void preload(s + 1); // next one in the background
    void spinner.show(false);
    if (!disposed) ready();
  };

  const hearSentence = async () => {
    if (!item || phase === 'hearing' || phase === 'recording' || phase === 'scoring' || phase === 'loading') return;
    phase = 'hearing';
    hear.update({ enabled: false });
    rec.update({ enabled: false });
    show('Listen…', '', { color: C.speaking });
    app.sound.resume();
    const clips = await preload(s);
    const sentence = item.sentences[s];
    if (clips.some(Boolean)) {
      for (const buf of clips) if (buf && !disposed) await voice.play(buf);
    } else {
      for (const line of sentence.audio.script ?? []) await speak(line.text, { rate: 0.92 });
    }
    heard = true;
    if (!disposed) ready();
  };

  const toggleRecording = async () => {
    if (phase === 'recording') return stopRecording();
    if (phase !== 'ready' || !item || !heard) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      show('Microphone not available', 'Allow microphone access for this page in the browser, then try again.', { color: C.danger });
      return;
    }
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => void finishRecording();
    recorder.start();
    startedAt = performance.now();
    phase = 'recording';
    app.sound.play('micOn', 0.6);
    hear.update({ enabled: false });
    rec.update({ label: 'Stop', icon: app.icon('stop'), tone: 'danger' });
    const total = item.sentences[s].responseSeconds;
    const tick = () => {
      const left = total - (performance.now() - startedAt) / 1000;
      show('Recording… say the sentence', 'Pinch Stop when you finish.', { color: C.speaking, seconds: left, total });
      if (left <= 0) stopRecording();
    };
    tick();
    timer = setInterval(tick, 250);
  };

  const stopRecording = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    app.sound.play('micOff', 0.6);
  };

  const finishRecording = async () => {
    if (disposed || !item) return;
    phase = 'scoring';
    rec.update({ enabled: false, label: 'Repeat', icon: app.icon('start'), tone: 'primary' });
    show('Checking your words…', 'Muse Voice Transcribe is writing down what you said.', { color: C.primary });
    void spinner.show(true);
    try {
      const wav = await toWav16k(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
      const r = await app.data.speak(item.itemId, item.sentences[s].unitId, wav);
      void spinner.show(false);
      if (disposed) return;
      phase = 'result';
      app.sound.play(r.correct ? 'done' : 'toggle', 0.55);
      if (r.correct) app.completeActivity();
      showResult(r);
    } catch (e) {
      void spinner.show(false);
      phase = 'result';
      show('Could not check this answer', errorMessage(e), { color: C.danger });
    }
    phase = 'ready';
    hear.update({ enabled: true, label: 'Hear again' });
    rec.update({ enabled: true, label: 'Try again', icon: app.icon('retry'), tone: 'secondary' });
    next.update({ label: s + 1 < item.sentences.length ? 'Next' : 'Finish' });
    next.visible = true;
  };

  const nextSentence = () => {
    if (!item) return;
    if (s + 1 >= item.sentences.length) return app.goHub();
    s++;
    void prepare();
  };

  return {
    async start() {
      show('Loading your sentences…', '', { color: C.primary });
      try {
        item = (await app.data.repeat())[0] ?? null;
        bar.update();
        // Continue at the first sentence not repeated yet.
        if (item) s = app.data.firstOpen('listen-repeat', item.itemId, item.sentences.map((x) => x.unitId));
        if (!item) {
          show('No sentences yet', 'These questions are not ready yet. They appear here as soon as your study plan finishes making them. Try another activity or come back in a few minutes.');
          return;
        }
        situation.draw((ctx, W) => {
          situation.card();
          ctx.fillStyle = C.speaking;
          ctx.font = font(21, 800);
          ctx.fillText('THE SITUATION', 34, 20);
          ctx.fillStyle = C.ink;
          ctx.font = font(26, 600);
          wrap(ctx, item!.situation, 34, 54, W - 68, 32, 2);
        });
        await prepare();
      } catch (e) {
        show('Could not load the sentences', errorMessage(e), { color: C.danger });
      }
    },
    dispose() {
      disposed = true;
      if (timer) clearInterval(timer);
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
      stopSpeaking();
      voice.dispose();
      spinner.dispose();
    },
  };
};
