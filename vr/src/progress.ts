/**
 * The progress wall: a live "Your Progress" board on the wall behind the learner, built from the
 * learner's real data (/api/progress and the latest mock test). It refreshes whenever the learner
 * returns to the hub, so finished activities show up straight away.
 */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import type { ProgressSummary } from './data.js';
import { C, font, roundRect } from './ui.js';

const SKILLS: { id: 'reading' | 'listening' | 'writing' | 'speaking'; label: string; color: string }[] = [
  { id: 'reading', label: 'Reading', color: '#2f6fe4' },
  { id: 'listening', label: 'Listening', color: '#0f8a6b' },
  { id: 'writing', label: 'Writing', color: '#d4561f' },
  { id: 'speaking', label: 'Speaking', color: '#7444d6' },
];

export class ProgressBoard {
  readonly group = new Group();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: CanvasTexture;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    this.canvas.width = Math.round(width * 700);
    this.canvas.height = Math.round(height * 700);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    mesh.raycast = () => {};
    this.group.add(mesh);
    this.draw(null, null);
  }

  /** Redraws the board; `p` null shows a loading state. */
  draw(p: ProgressSummary | null, name: string | null): void {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const s = H / 700; // scale: designed for a 700 px tall board
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 0, 0, W, H, 40 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.lineWidth = 6 * s;
    ctx.strokeStyle = 'rgba(61,139,255,0.5)';
    ctx.stroke();
    ctx.textBaseline = 'top';
    const pad = 48 * s;

    ctx.fillStyle = C.primary;
    ctx.font = font(Math.round(26 * s), 800);
    ctx.fillText('LAFAEKTOEFL  ·  PROGRESS WALL', pad, pad);
    ctx.fillStyle = C.ink;
    ctx.font = font(Math.round(58 * s), 800);
    ctx.fillText(name ? `Your progress, ${name}` : 'Your progress', pad, pad + 40 * s);

    if (!p) {
      ctx.fillStyle = C.muted;
      ctx.font = font(Math.round(32 * s), 600);
      ctx.fillText('Loading your progress…', pad, pad + 140 * s);
      this.tex.needsUpdate = true;
      return;
    }

    // Stat tiles.
    const stats: [string, string][] = [
      [String(p.questionsAttempted), 'questions answered'],
      [p.accuracy == null ? '–' : `${Math.round(p.accuracy)}%`, 'accuracy'],
      [String(p.studyDays), p.studyDays === 1 ? 'study day' : 'study days'],
      [String(p.practiceMinutes), 'minutes practised'],
    ];
    const tileY = pad + 130 * s;
    const tileW = (W - pad * 2 - 3 * 22 * s) / 4;
    stats.forEach(([value, label], i) => {
      const x = pad + i * (tileW + 22 * s);
      roundRect(ctx, x, tileY, tileW, 120 * s, 22 * s);
      ctx.fillStyle = C.soft;
      ctx.fill();
      ctx.fillStyle = C.primaryDark;
      ctx.font = font(Math.round(50 * s), 800);
      ctx.fillText(value, x + 24 * s, tileY + 16 * s);
      ctx.fillStyle = C.body;
      ctx.font = font(Math.round(22 * s), 600);
      ctx.fillText(label, x + 24 * s, tileY + 80 * s);
    });

    // Skill bars (left) and latest mock test (right).
    const barsX = pad;
    const barsW = (W - pad * 2) * 0.62;
    let y = tileY + 160 * s;
    ctx.fillStyle = C.ink;
    ctx.font = font(Math.round(28 * s), 800);
    ctx.fillText('Your practice by skill', barsX, y);
    y += 48 * s;
    for (const skill of SKILLS) {
      const k = p.skills[skill.id];
      const share = k.available ? Math.min(1, k.done / k.available) : 0;
      ctx.fillStyle = C.ink;
      ctx.font = font(Math.round(24 * s), 700);
      ctx.fillText(skill.label, barsX, y);
      ctx.fillStyle = C.muted;
      ctx.font = font(Math.round(21 * s), 600);
      ctx.textAlign = 'right';
      const detail = k.aiBand != null ? `AI band ${k.aiBand.toFixed(1)} / 6` : k.accuracy != null ? `${Math.round(k.accuracy)}% correct` : 'not started';
      ctx.fillText(`${k.done} of ${k.available} done  ·  ${detail}`, barsX + barsW, y + 2 * s);
      ctx.textAlign = 'left';
      roundRect(ctx, barsX, y + 34 * s, barsW, 16 * s, 8 * s);
      ctx.fillStyle = '#e6ecf8';
      ctx.fill();
      if (share > 0) {
        roundRect(ctx, barsX, y + 34 * s, Math.max(16 * s, barsW * share), 16 * s, 8 * s);
        ctx.fillStyle = skill.color;
        ctx.fill();
      }
      y += 70 * s;
    }

    const mx = barsX + barsW + 40 * s;
    const mw = W - pad - mx;
    const my = tileY + 160 * s;
    roundRect(ctx, mx, my, mw, H - my - pad, 26 * s);
    const grad = ctx.createLinearGradient(mx, my, mx + mw, H - pad);
    grad.addColorStop(0, '#101b4d');
    grad.addColorStop(1, '#1769f5');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = '#9fd0ff';
    ctx.font = font(Math.round(22 * s), 800);
    ctx.fillText('LATEST MOCK TEST', mx + 28 * s, my + 28 * s);
    if (p.mockBand != null) {
      ctx.fillStyle = '#ffffff';
      ctx.font = font(Math.round(96 * s), 800);
      ctx.fillText(p.mockBand.toFixed(1), mx + 28 * s, my + 66 * s);
      ctx.font = font(Math.round(30 * s), 700);
      ctx.fillText('/ 6 band', mx + 28 * s, my + 176 * s);
      ctx.fillStyle = '#cfe6ff';
      ctx.font = font(Math.round(21 * s), 600);
      ctx.fillText(p.certificate ? `Certificate ${p.certificate}` : 'Score 4.0 or higher for a certificate', mx + 28 * s, my + 226 * s);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = font(Math.round(32 * s), 800);
      ctx.fillText(p.mockPending ? 'Being scored…' : 'No mock test yet', mx + 28 * s, my + 74 * s);
      ctx.fillStyle = '#cfe6ff';
      ctx.font = font(Math.round(21 * s), 600);
      ctx.fillText('Take one on the website when', mx + 28 * s, my + 124 * s);
      ctx.fillText('you feel ready.', mx + 28 * s, my + 152 * s);
    }
    this.tex.needsUpdate = true;
  }

  get size(): { w: number; h: number } {
    return { w: this.width, h: this.height };
  }
}
