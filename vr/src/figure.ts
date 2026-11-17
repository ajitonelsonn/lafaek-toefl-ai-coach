/**
 * A person built from one cutout photo: the photo's silhouette is "inflated" into a rounded relief,
 * deepest in the middle of the body and thin at the edges, so the figure has real depth in the
 * headset (both eyes see it from slightly different angles) instead of looking like a flat card.
 * Soft shading is baked into vertex colours once, so it costs no lights per frame.
 */
import { BufferAttribute, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Texture, Vector3 } from '@iwsdk/core';

/** Columns of the relief grid; rows follow the photo's shape. About 4,000 vertices per figure. */
const COLS = 40;
/** How far in from the silhouette edge the body reaches full depth, and how far it bulges. */
const RIM = 0.12;
const DEPTH = 0.085;
/** Light from the upper left, in front of the figure. */
const LIGHT = new Vector3(-0.45, 0.55, 0.7).normalize();

export interface Figure {
  mesh: Mesh;
  width: number;
  height: number;
}

/** Builds a standing figure `height` metres tall with its feet at y = 0, facing +Z. */
export function buildFigure(img: HTMLImageElement, height: number): Figure {
  const width = (img.width / img.height) * height;
  const cols = COLS;
  const rows = Math.round((cols * img.height) / img.width);
  const vx = cols + 1;
  const vy = rows + 1;

  // Silhouette at grid resolution: the browser averages the alpha while scaling down.
  const canvas = document.createElement('canvas');
  canvas.width = vx;
  canvas.height = vy;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, vx, vy);
  const alpha = ctx.getImageData(0, 0, vx, vy).data;

  // Distance from each grid point to the nearest point outside the body, in metres
  // (two-pass chamfer distance: 1 for a side step, √2 for a diagonal one).
  const cw = width / cols;
  const ch = height / rows;
  const cd = Math.hypot(cw, ch);
  const far = 1e6;
  const dist = new Float32Array(vx * vy);
  for (let i = 0; i < vx * vy; i++) dist[i] = alpha[i * 4 + 3] > 127 ? far : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= vx || y >= vy ? 0 : dist[y * vx + x]);
  for (let y = 0; y < vy; y++)
    for (let x = 0; x < vx; x++) {
      const i = y * vx + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x - 1, y) + cw, at(x, y - 1) + ch, at(x - 1, y - 1) + cd, at(x + 1, y - 1) + cd);
    }
  for (let y = vy - 1; y >= 0; y--)
    for (let x = vx - 1; x >= 0; x--) {
      const i = y * vx + x;
      if (!dist[i]) continue;
      dist[i] = Math.min(dist[i], at(x + 1, y) + cw, at(x, y + 1) + ch, at(x + 1, y + 1) + cd, at(x - 1, y + 1) + cd);
    }

  // PlaneGeometry orders its vertices row by row from the top left, like the image.
  const geo = new PlaneGeometry(width, height, cols, rows);
  geo.translate(0, height / 2, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    // A rounded profile: steep at the silhouette, flat across the middle of the body.
    const t = 1 - Math.min(dist[i] / RIM, 1);
    pos.setZ(i, DEPTH * Math.sqrt(1 - t * t));
  }
  geo.computeVertexNormals();

  const normals = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(normals, i);
    const shade = 0.74 + 0.26 * Math.max(0, n.dot(LIGHT));
    colors.set([shade, shade, shade], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));

  const tex = new Texture(img);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  // DoubleSide: the steep rim stays filled when seen from the side.
  const mesh = new Mesh(geo, new MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: DoubleSide, toneMapped: false }));
  mesh.raycast = () => {};
  return { mesh, width, height };
}
