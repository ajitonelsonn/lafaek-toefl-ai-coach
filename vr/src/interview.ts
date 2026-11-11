/**
 * Take an Interview: the crocodile interviewer sits across the desk and asks each question out
 * loud. The learner pinches "Answer", speaks, and gets a transcript (Muse Voice Transcribe) and an
 * AI band score with coaching (Muse Spark) through the LafaekTOEFL API.
 */
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Texture } from '@iwsdk/core';
import type { ScreenFactory } from './app.js';
import { animate } from './clicks.js';
import { errorMessage, type AiScore, type InterviewItem } from './data.js';
import { speak, stopSpeaking } from './sound.js';
import { Button, C, font, roundRect, wrap } from './ui.js';
import { toWav16k } from './wav.js';

type Phase = 'idle' | 'asking' | 'ready' | 'recording' | 'scoring' | 'result';

export const interviewScreen: ScreenFactory = (app, scope) => {
  let item: InterviewItem | null = null;
  let demo = false;
  let q = 0;
  let phase: Phase = 'idle';
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  // The interviewer: the LafaekTOEFL mascot as a cutout on the far side of the desk.
  const mascot = new Group();
  mascot.position.set(0, 1.12, -1.25);
  if (app.mascot) {
    const tex = new Texture(app.mascot);
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
    const ratio = app.mascot.height / app.mascot.width;
    const cut = new Mesh(new PlaneGeometry(0.62, 0.62 * ratio), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, alphaTest: 0.05 }));
    cut.position.y = 0.3;
    mascot.add(cut);
  }
  scope.add(mascot);
  const stopBob = animate((time) => {
    const talking = phase === 'asking';
    mascot.position.y = 1.12 + Math.sin(time * (talking ? 8 : 1.6)) * (talking ? 0.012 : 0.006);
    mascot.rotation.z = phase === 'recording' ? Math.sin(time * 1.2) * 0.03 : 0;
  });

  const panel = scope.panel(0.94, 0.27, 0, 1.0, -0.92).panel;
  new Button(scope, { w: 0.2, h: 0.075, label: 'Room', icon: app.icon('home'), tone: 'ghost' }, -0.6, 0.82, -0.84, () => app.goHub());
  const ask = new Button(scope, { w: 0.28, h: 0.08, label: 'Hear question', icon: app.icon('voice'), tone: 'soft' }, -0.17, 0.82, -0.86, () => void askQuestion());
  const rec = new Button(scope, { w: 0.28, h: 0.08, label: 'Answer', icon: app.icon('start'), tone: 'primary', enabled: false }, 0.17, 0.82, -0.86, () => void toggleRecording());
  const next = new Button(scope, { w: 0.2, h: 0.075, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.6, 0.82, -0.84, () => nextQuestion());
  next.visible = false;

  const header = (ctx: CanvasRenderingContext2D, W: number) => {
    ctx.fillStyle = C.speaking;
    ctx.font = font(24, 800);
    ctx.fillText(`TAKE AN INTERVIEW${demo ? '  ·  DEMO' : ''}`, 40, 26);
    if (item) {
      ctx.fillStyle = C.muted;
      ctx.font = font(24, 700);
      ctx.textAlign = 'right';
      ctx.fillText(`Question ${q + 1} of ${item.questions.length}`, W - 40, 26);
      ctx.textAlign = 'left';
    }
  };

  const show = (title: string, body: string, opts: { color?: string; tone?: 'success' | 'danger'; seconds?: number; total?: number } = {}) =>
    panel.draw((ctx, W, H) => {
      panel.card(opts.tone === 'success' ? C.successSoft : opts.tone === 'danger' ? C.dangerSoft : C.surface, opts.tone === 'success' ? C.success : opts.tone === 'danger' ? C.danger : C.line);
      header(ctx, W);
      ctx.fillStyle = opts.color ?? C.ink;
      ctx.font = font(38, 800);
      wrap(ctx, title, 40, 68, W - (opts.total ? 260 : 80), 44, 2);
      ctx.fillStyle = C.body;
      ctx.font = font(29, 500);
      wrap(ctx, body, 40, 160, W - (opts.total ? 260 : 80), 35, 3);
      if (opts.total) {
        // Countdown ring while recording.
        const cx = W - 120;
        const cy = H / 2 + 14;
        ctx.lineWidth = 16;
        ctx.strokeStyle = '#ede9fe';
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = C.speaking;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((opts.seconds ?? 0) / opts.total));
        ctx.stroke();
        ctx.fillStyle = C.ink;
        ctx.font = font(48, 800);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.max(0, Math.ceil(opts.seconds ?? 0))), cx, cy + 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
    });

  const showScore = (transcript: string, s: AiScore | null) =>
    panel.draw((ctx, W, H) => {
      panel.card(C.surface, C.speaking);
      header(ctx, W);
      if (s?.band != null) {
        roundRect(ctx, 40, 64, 200, 170, 28);
        ctx.fillStyle = '#f3efff';
        ctx.fill();
        ctx.fillStyle = C.speaking;
        ctx.font = font(76, 800);
        ctx.textAlign = 'center';
        ctx.fillText(s.band.toFixed(1), 140, 92);
        ctx.font = font(26, 700);
        ctx.fillText('AI band / 6', 140, 184);
        ctx.textAlign = 'left';
      }
      const x = s?.band != null ? 270 : 40;
      ctx.fillStyle = C.ink;
      ctx.font = font(30, 700);
      let y = wrap(ctx, s?.summary ?? 'Your answer was saved.', x, 66, W - x - 40, 36, 2);
      ctx.fillStyle = C.success;
      ctx.font = font(26, 600);
      if (s?.strengths[0]) y = wrap(ctx, `+ ${s.strengths[0]}`, x, y + 4, W - x - 40, 31, 1);
      ctx.fillStyle = C.danger;
      if (s?.improvements[0]) y = wrap(ctx, `→ ${s.improvements[0]}`, x, y + 2, W - x - 40, 31, 1);
      ctx.fillStyle = C.muted;
      ctx.font = font(24, 500);
      wrap(ctx, `You said: "${transcript}"`, x, Math.min(y + 6, H - 60), W - x - 40, 28, 1);
    });

  const questionText = () => item?.questions[q]?.text ?? item?.questions[q]?.audio.script?.map((l) => l.text).join(' ');

  const ready = () => {
    phase = 'ready';
    ask.update({ enabled: true, label: 'Hear again' });
    rec.update({ enabled: true, label: 'Answer', icon: app.icon('start'), tone: 'primary' });
    const total = item!.questions[q].responseSeconds;
    show(questionText() ?? 'Listen to the question, then answer.', `Pinch Answer and speak for up to ${total} seconds. Pinch Stop when you finish.`);
  };

  const askQuestion = async () => {
    if (!item || phase === 'asking' || phase === 'recording' || phase === 'scoring') return;
    const question = item.questions[q];
    phase = 'asking';
    next.visible = false;
    ask.update({ enabled: false });
    rec.update({ enabled: false });
    show('The interviewer is asking…', questionText() ? '' : 'Listen carefully.');
    app.sound.resume();
    try {
      if (question.audio.assetIds.length) {
        for (const id of question.audio.assetIds) {
          const buf = await app.sound.decode(await (await app.data.media(id)).arrayBuffer());
          if (disposed) return;
          await voice.play(buf);
        }
      } else {
        for (const line of question.audio.script ?? []) await speak(line.text, { pitch: 1.0, rate: 0.92 });
      }
    } catch {
      // Audio failed: the question text (when known) is still shown.
    }
    if (!disposed) ready();
  };

  const toggleRecording = async () => {
    if (phase === 'recording') return stopRecording();
    if (phase !== 'ready' || !item) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      show('Microphone not available', 'Allow microphone access for this page in the browser, then try again.', { tone: 'danger' });
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
    ask.update({ enabled: false });
    rec.update({ label: 'Stop', icon: app.icon('stop'), tone: 'danger' });
    const total = item.questions[q].responseSeconds;
    const tick = () => {
      const left = total - (performance.now() - startedAt) / 1000;
      show('Recording… speak now', questionText() ?? '', { color: C.speaking, seconds: left, total });
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
    const question = item.questions[q];
    const seconds = Math.round((performance.now() - startedAt) / 1000);
    phase = 'scoring';
    rec.update({ enabled: false, label: 'Answer', icon: app.icon('start'), tone: 'primary' });
    if (demo || !app.data.live) {
      phase = 'result';
      app.completeActivity();
      show(`Recorded ${seconds} seconds. Nice!`, 'Sign in on lafaektoefl.tech to get your transcript and an AI band score for every answer.', { tone: 'success' });
      afterResult();
      return;
    }
    show('Scoring your answer…', 'Muse Voice Transcribe is writing down what you said, then Muse Spark scores it. This takes about 15 seconds.', { color: C.primary });
    app.sound.startLoop('thinking', 0.18);
    try {
      const wav = await toWav16k(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
      const transcript = await app.data.transcribe(item.itemId, question.unitId, wav);
      if (transcript.length < 20) {
        app.sound.stopLoop();
        phase = 'result';
        show('Say a little more', `We heard: "${transcript || '…'}". Answer in a few full sentences to get an AI score.`, { tone: 'danger' });
        afterResult();
        return;
      }
      const score = await app.data.score(item.itemId, question.unitId, transcript);
      app.sound.stopLoop();
      if (disposed) return;
      phase = 'result';
      app.sound.play('done', 0.6);
      app.completeActivity();
      showScore(transcript, score);
    } catch (e) {
      app.sound.stopLoop();
      phase = 'result';
      show('Could not score this answer', errorMessage(e), { tone: 'danger' });
    }
    afterResult();
  };

  const afterResult = () => {
    ask.update({ enabled: true, label: 'Hear again' });
    rec.update({ enabled: true, label: 'Try again', icon: app.icon('retry'), tone: 'secondary' });
    phase = 'ready';
    next.update({ label: q + 1 < (item?.questions.length ?? 0) ? 'Next' : 'Finish' });
    next.visible = true;
  };

  const nextQuestion = () => {
    if (!item) return;
    if (q + 1 >= item.questions.length) return app.goHub();
    q++;
    next.visible = false;
    void askQuestion();
  };

  // The voice comes from the interviewer's position.
  const voice = app.sound.voice(mascot);

  return {
    async start() {
      show('Loading your interview…', '', { color: C.primary });
      try {
        const r = await app.data.interview();
        item = r.items[0];
        demo = r.demo;
        show('Ready when you are', `${item.scenario} Pinch "Hear question" to begin.`);
        ask.update({ enabled: true, label: 'Hear question' });
      } catch (e) {
        show('Could not load the interview', errorMessage(e), { tone: 'danger' });
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
      app.sound.stopLoop();
      voice.dispose();
      stopBob();
    },
  };
};
