/**
 * The study room around a seated learner: floor, walls, a window with a sky, a desk at seated
 * height, a bookshelf, and a plant that grows with each day of study. Low-poly and unlit-heavy
 * so it stays well above 72 fps on Quest.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

export const DESK_Y = 0.72;
export const DESK_Z = -0.55;

const lambert = (color: string) => new MeshLambertMaterial({ color: new Color(color) });

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), lambert(color));
  m.position.set(x, y, z);
  return m;
}

function skyTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7fb2f5');
  grad.addColorStop(0.65, '#cfe3fb');
  grad.addColorStop(1, '#f6efe2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  // Distant green hills, a nod to Timor-Leste.
  g.fillStyle = '#7fae7a';
  g.beginPath();
  g.moveTo(0, 210);
  g.quadraticCurveTo(70, 170, 140, 200);
  g.quadraticCurveTo(200, 180, 256, 196);
  g.lineTo(256, 256);
  g.lineTo(0, 256);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[60, 60, 18], [84, 56, 22], [108, 62, 16], [180, 96, 14], [198, 92, 18]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildRoom(): Group {
  const room = new Group();
  room.name = 'StudyRoom';

  const floor = new Mesh(new CircleGeometry(6, 48), lambert('#d9c7ad'));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const rug = new Mesh(new CircleGeometry(1.1, 40), lambert('#c9d9f4'));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.002, -0.3);
  room.add(rug);

  // Walls: back (with window), left and right.
  const wall = '#f4efe6';
  room.add(box(6, 3, 0.1, wall, 0, 1.5, -2.4));
  room.add(box(0.1, 3, 5, wall, -2.6, 1.5, 0));
  room.add(box(0.1, 3, 5, wall, 2.6, 1.5, 0));
  const windowFrame = box(1.7, 1.05, 0.06, '#ffffff', 0, 1.75, -2.33);
  room.add(windowFrame);
  const sky = new Mesh(new PlaneGeometry(1.56, 0.92), new MeshBasicMaterial({ map: skyTexture(), toneMapped: false }));
  sky.position.set(0, 1.75, -2.295);
  room.add(sky);
  room.add(box(0.03, 0.92, 0.02, '#ffffff', 0, 1.75, -2.28));

  // Desk at seated height in front of the learner.
  const wood = '#b98a5e';
  room.add(box(1.5, 0.04, 0.62, wood, 0, DESK_Y - 0.02, DESK_Z));
  for (const [x, z] of [[-0.7, DESK_Z - 0.26], [0.7, DESK_Z - 0.26], [-0.7, DESK_Z + 0.26], [0.7, DESK_Z + 0.26]]) {
    room.add(box(0.05, DESK_Y - 0.04, 0.05, '#8c6644', x, (DESK_Y - 0.04) / 2, z));
  }

  // Bookshelf on the left with TOEFL-coloured books.
  room.add(box(0.9, 1.6, 0.32, '#c79b6d', -1.7, 0.8, -1.9));
  const colors = ['#1769f5', '#0e7490', '#7c3aed', '#b45309', '#15803d', '#2149b8', '#c2410c'];
  for (let shelf = 0; shelf < 3; shelf++) {
    room.add(box(0.84, 0.02, 0.3, '#a87d52', -1.7, 0.35 + shelf * 0.45, -1.88));
    for (let i = 0; i < 7; i++) {
      const h = 0.22 + ((i * 7 + shelf * 3) % 5) * 0.025;
      room.add(box(0.07, h, 0.2, colors[(i + shelf * 2) % colors.length], -2.05 + i * 0.105, 0.36 + shelf * 0.45 + h / 2, -1.86));
    }
  }

  // Warm lamp glow on the right.
  const lampPole = new Mesh(new CylinderGeometry(0.015, 0.015, 1.5, 8), lambert('#4b5563'));
  lampPole.position.set(1.8, 0.75, -1.8);
  room.add(lampPole);
  const shade = new Mesh(new ConeGeometry(0.22, 0.25, 20, 1, true), new MeshBasicMaterial({ color: '#ffe7b8', toneMapped: false }));
  shade.position.set(1.8, 1.55, -1.8);
  room.add(shade);

  return room;
}

/** A potted plant for the desk. Stage 0 = seedling … 4 = full plant. */
export class Plant {
  readonly group = new Group();
  private readonly leaves: Mesh[] = [];

  constructor() {
    this.group.name = 'StudyPlant';
    const pot = new Mesh(new CylinderGeometry(0.06, 0.045, 0.09, 18), lambert('#c2410c'));
    pot.position.y = 0.045;
    this.group.add(pot);
    const soil = new Mesh(new CylinderGeometry(0.055, 0.055, 0.01, 18), lambert('#5b4636'));
    soil.position.y = 0.088;
    this.group.add(soil);
    const leafMat = lambert('#3f9b4f');
    const leafGeo = new IcosahedronGeometry(0.035, 0);
    for (let i = 0; i < 9; i++) {
      const leaf = new Mesh(leafGeo, leafMat);
      const a = (i / 9) * Math.PI * 2;
      const r = 0.012 + (i % 3) * 0.018;
      leaf.position.set(Math.cos(a) * r, 0.11 + (i % 4) * 0.035, Math.sin(a) * r);
      leaf.scale.set(1, 1.5, 0.6);
      this.group.add(leaf);
      this.leaves.push(leaf);
    }
  }

  setStage(stage: number): void {
    const visible = 2 + Math.min(4, Math.max(0, stage)) * 2;
    this.leaves.forEach((leaf, i) => {
      leaf.visible = i < visible;
      const s = 0.7 + Math.min(4, stage) * 0.12;
      leaf.scale.set(s, s * 1.5, s * 0.6);
    });
  }
}
