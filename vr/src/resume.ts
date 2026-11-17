/**
 * "Welcome back" bar for an activity, like the website's: when the learner has answered some of
 * an activity's questions (since their last "Start over"), a slim panel above the activity says
 * so with a progress bar that moves on with every saved answer, and the activity continues at
 * the first unanswered question. "Start
 * over" (pinch twice to confirm) clears the progress on the server and reopens the activity.
 */
import type { App } from './app.js';
import { Button, C, font, roundRect, type Scope } from './ui.js';

const W = 0.7;
const H = 0.12;

export interface ResumeBar {
  /** Redraws from the activity's current progress (call after its items have loaded). */
  update(): void;
}

export function resumeBar(app: App, scope: Scope, slug: string, x = 0, y = 1.8, z = -1.2): ResumeBar {
  const panel = scope.panel(W, H, x - 0.12, y, z).panel;
  let armed: ReturnType<typeof setTimeout> | null = null;
  const reset = new Button(scope, { w: 0.21, h: 0.075, label: 'Start over', icon: app.icon('retry'), tone: 'secondary' }, x + W / 2 + 0.01, y, z + 0.01, () => {
    if (!armed) {
      // First pinch: ask to confirm, so a stray pinch does not wipe the progress.
      reset.update({ label: 'Pinch to confirm' });
      armed = setTimeout(() => {
        armed = null;
        reset.update({ label: 'Start over' });
      }, 3500);
      return;
    }
    clearTimeout(armed);
    armed = null;
    reset.update({ label: 'Starting over…', enabled: false });
    void app.data
      .startOver(slug)
      .then(() => app.reopen())
      .catch(() => reset.update({ label: 'Try again', enabled: true }));
  });
  const show = (on: boolean) => {
    panel.mesh.visible = on;
    reset.visible = on;
  };
  show(false);
  /** Answered when the activity opened: decides between "Welcome back" and "Your progress". */
  let atStart: number | null = null;

  const bar: ResumeBar = {
    update() {
      const r = app.data.resume(slug);
      if (r && atStart === null) atStart = r.answered;
      if (!r || r.answered === 0 || r.total === 0) return show(false);
      const returning = (atStart ?? 0) > 0;
      const complete = r.answered >= r.total;
      const icon = app.icon(complete ? 'achievement' : 'continue');
      panel.draw((ctx, cw, ch) => {
        panel.card('#f0f5ff', '#b9cdf5', 28);
        if (icon) ctx.drawImage(icon, 22, (ch - 64) / 2, 64, 64);
        ctx.textBaseline = 'top';
        ctx.fillStyle = C.ink;
        ctx.font = font(27, 800);
        ctx.fillText(complete ? `You have completed all ${r.total} questions` : returning ? 'Welcome back! Continuing where you stopped' : 'Your progress in this activity', 104, 16);
        ctx.fillStyle = C.body;
        ctx.font = font(22, 500);
        ctx.fillText(complete ? 'Pinch Start over to practise them again.' : `You have answered ${r.answered} of ${r.total} questions.`, 104, 52);
        // Progress bar.
        const bw = cw - 104 - 34;
        roundRect(ctx, 104, ch - 30, bw, 10, 5);
        ctx.fillStyle = '#e1e8f5';
        ctx.fill();
        roundRect(ctx, 104, ch - 30, Math.max(10, (bw * r.answered) / r.total), 10, 5);
        ctx.fillStyle = complete ? C.success : C.primary;
        ctx.fill();
      });
      show(true);
    },
  };
  // Live: every saved answer moves the bar on straight away.
  const onProgress = () => bar.update();
  app.data.progressListeners.add(onProgress);
  scope.onDispose(() => {
    app.data.progressListeners.delete(onProgress);
    if (armed) clearTimeout(armed);
  });
  return bar;
}
