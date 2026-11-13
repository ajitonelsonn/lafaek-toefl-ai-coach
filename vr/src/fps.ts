/**
 * Frame-rate readout for testing on a headset: open the room with ?fps=1 and a small label stays
 * in the lower left of your view, showing frames per second, the headset's target rate and the
 * slowest frame in the last half second. Learners never see it without the flag.
 */
import { CanvasTexture, createSystem, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { C, font, roundRect } from './ui.js';

const W = 360;
const H = 120;

export class FpsSystem extends createSystem({}) {
  private readonly canvas = document.createElement('canvas');
  private ctx!: CanvasRenderingContext2D;
  private tex!: CanvasTexture;
  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  init(): void {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    // Drawn over everything (no depth test) so walls and panels never hide it.
    const mesh = new Mesh(
      new PlaneGeometry(0.12, 0.04),
      new MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    mesh.renderOrder = 999;
    mesh.raycast = () => {};
    mesh.name = 'FpsMeter';
    mesh.position.set(-0.11, -0.13, -0.5);
    this.world.createTransformEntity(mesh, { parent: this.world.cameraEntity });
    this.draw(null, 0, null);
  }

  update(delta: number): void {
    this.frames++;
    this.elapsed += delta;
    if (delta > this.worst) this.worst = delta;
    if (this.elapsed < 0.5) return;
    const target = this.world.session?.frameRate ?? null;
    this.draw(this.frames / this.elapsed, this.worst * 1000, target);
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }

  private draw(fps: number | null, worstMs: number, target: number | null): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 0, 0, W, H, 22);
    ctx.fillStyle = 'rgba(16,27,77,0.82)';
    ctx.fill();
    // Green at or near the target, amber a little below, red well below. Without a target: 72 Hz in
    // a headset (Quest's lowest rate), 60 Hz on a normal screen (Preview).
    const goal = target ?? (this.world.session ? 72 : 60);
    const color = fps == null ? '#ffffff' : fps >= goal * 0.95 ? C.success : fps >= goal * 0.8 ? '#f5b400' : C.danger;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.font = font(52, 800);
    ctx.fillText(fps == null ? '–' : String(Math.round(fps)), 22, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(26, 700);
    ctx.fillText('fps', 120, 36);
    ctx.fillStyle = '#cfe6ff';
    ctx.font = font(22, 600);
    ctx.fillText(`${target ? `target ${Math.round(target)}` : 'target –'}  ·  slowest ${worstMs ? worstMs.toFixed(1) : '–'} ms`, 22, 80);
    this.tex.needsUpdate = true;
  }
}
