/**
 * The study room around a seated learner: a futuristic white-and-blue classroom inspired by
 * Timor-Leste. Curved white walls with three panoramic windows (views of Dili: the flag and
 * mountains, Cristo Rei, and the coastline), blue LED strips, a glossy floor, a white desk with a
 * glowing edge, a white bookshelf, a bench, a bean bag and plants. Built from simple shapes and a
 * few small textures so it stays above 72 fps on Quest; the LEDs pulse and light motes drift.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  BackSide,
} from '@iwsdk/core';

export const DESK_Y = 0.72;
export const DESK_Z = -0.55;

/** Brand palette for the room. */
export const PALETTE = {
  blue: '#1769f5',
  led: '#3d8bff',
  cyan: '#6fd3ff',
  navy: '#101b4d',
  white: '#f7f9fd',
  wall: '#eef2fa',
};

const BASE = import.meta.env.BASE_URL;
const WALL_R = 2.9;
const CEIL_Y = 3.0;

const standard = (color: string, roughness = 0.6, metalness = 0) => new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
const glow = (color: string, opacity = 1) =>
  new MeshBasicMaterial({ color: new Color(color), toneMapped: false, transparent: opacity < 1, opacity });

/** A rounded rectangle shape (centred), optionally with a rounded-rectangle hole. */
function roundedShape(w: number, h: number, r: number, hole?: { w: number; h: number; r: number }): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  if (hole) {
    const p = new Path();
    const hx = -hole.w / 2;
    const hy = -hole.h / 2;
    const hr = hole.r;
    p.moveTo(hx + hr, hy);
    p.quadraticCurveTo(hx, hy, hx, hy + hr);
    p.lineTo(hx, hy + hole.h - hr);
    p.quadraticCurveTo(hx, hy + hole.h, hx + hr, hy + hole.h);
    p.lineTo(hx + hole.w - hr, hy + hole.h);
    p.quadraticCurveTo(hx + hole.w, hy + hole.h, hx + hole.w, hy + hole.h - hr);
    p.lineTo(hx + hole.w, hy + hr);
    p.quadraticCurveTo(hx + hole.w, hy, hx + hole.w - hr, hy);
    p.lineTo(hx + hr, hy);
    s.holes.push(p);
  }
  return s;
}

function extrude(shape: Shape, depth: number, bevel = 0.01): ExtrudeGeometry {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
}

/** Soft radial gradient for the glossy floor (bright centre, gentle falloff). */
function floorTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, '#f4f7fd');
  grad.addColorStop(0.55, '#dde5f4');
  grad.addColorStop(1, '#c9d5ec');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  // Faint tile lines for a polished-floor feel.
  g.strokeStyle = 'rgba(160, 180, 220, 0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft light beam (vertical gradient), used under holographic panels. */
export function beamTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(111, 211, 255, 0.55)');
  grad.addColorStop(1, 'rgba(111, 211, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft round dot for the light motes (points are square without a texture). */
function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function loadTexture(file: string): Texture {
  const tex = new Texture();
  tex.colorSpace = SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
  };
  img.src = `${BASE}img/${file}`;
  return tex;
}

/** Places an object on the curved wall at an angle around the learner (0° = in front, 180° = behind). */
export function onWall(obj: Group, angleDeg: number, y: number, inset = 0.08): Group {
  const a = (angleDeg * Math.PI) / 180;
  const r = WALL_R - inset;
  obj.position.set(Math.sin(a) * r, y, -Math.cos(a) * r);
  obj.rotation.y = -a;
  return obj;
}

/** Wraps a flat panel (w × h) in the white rounded frame and blue LED line used on the walls. */
export function framed(content: Group, w: number, h: number): Group {
  const g = new Group();
  g.add(content);
  const frame = new Mesh(extrude(roundedShape(w + 0.1, h + 0.1, 0.08, { w: w - 0.01, h: h - 0.01, r: 0.05 }), 0.04), standard(PALETTE.white, 0.35));
  frame.position.z = -0.012;
  g.add(frame);
  const led = new Mesh(extrude(roundedShape(w + 0.12, h + 0.12, 0.085, { w: w + 0.09, h: h + 0.09, r: 0.075 }), 0.002, 0), glow(PALETTE.led));
  led.position.z = 0.03;
  g.add(led);
  return g;
}

/** A framed painting: the picture, a white rounded frame and a thin blue LED line. */
function framedArt(file: string, w: number, h: number): Group {
  const g = new Group();
  g.add(new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: loadTexture(file), toneMapped: false })));
  const frame = new Mesh(extrude(roundedShape(w + 0.12, h + 0.12, 0.06, { w: w - 0.01, h: h - 0.01, r: 0.03 }), 0.04), standard(PALETTE.white, 0.35));
  frame.position.z = -0.01;
  g.add(frame);
  const led = new Mesh(extrude(roundedShape(w + 0.13, h + 0.13, 0.065, { w: w + 0.11, h: h + 0.11, r: 0.06 }), 0.002, 0), glow(PALETTE.led));
  led.position.z = 0.03;
  g.add(led);
  return g;
}

/**
 * The motto board on the back wall: "Small steps every day lead to a big score!" with the mascot
 * and the four zone icons. Drawn on a canvas; images are added as they load.
 */
function mottoBoard(w: number, h: number): Group {
  const c = document.createElement('canvas');
  c.width = Math.round(w * 600);
  c.height = Math.round(h * 600);
  const g2 = c.getContext('2d')!;
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const imgs: Record<string, HTMLImageElement | null> = {};
  const names = ['img/mascot-vr.png', 'icons/zone/zone-reading.png', 'icons/zone/zone-listening.png', 'icons/zone/zone-speaking.png', 'icons/zone/zone-writing.png'];
  const draw = () => {
    const W = c.width;
    const H = c.height;
    const grad = g2.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#101b4d');
    grad.addColorStop(0.6, '#1d3fa8');
    grad.addColorStop(1, '#1769f5');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, W, H);
    // Soft light spots.
    for (const [x, y, r] of [[W * 0.15, H * 0.2, H * 0.6], [W * 0.85, H * 0.9, H * 0.7]]) {
      const spot = g2.createRadialGradient(x, y, 0, x, y, r);
      spot.addColorStop(0, 'rgba(111, 211, 255, 0.25)');
      spot.addColorStop(1, 'rgba(111, 211, 255, 0)');
      g2.fillStyle = spot;
      g2.fillRect(0, 0, W, H);
    }
    const mascot = imgs['img/mascot-vr.png'];
    const mh = H * 0.78;
    if (mascot) g2.drawImage(mascot, W * 0.04, (H - mh) / 2, (mascot.width / mascot.height) * mh, mh);
    const tx = W * 0.36;
    g2.fillStyle = '#9fd0ff';
    g2.font = `800 ${Math.round(H * 0.07)}px system-ui, -apple-system, Roboto, sans-serif`;
    g2.textBaseline = 'top';
    g2.fillText('LAFAEKTOEFL  ·  STUDY ROOM', tx, H * 0.12);
    g2.fillStyle = '#ffffff';
    let mottoSize = Math.round(H * 0.13);
    const fit = () => (g2.font = `800 ${mottoSize}px system-ui, -apple-system, Roboto, sans-serif`);
    fit();
    while (mottoSize > 10 && g2.measureText('Small steps every day').width > W - tx - W * 0.04) {
      mottoSize -= 1;
      fit();
    }
    g2.fillText('Small steps every day', tx, H * 0.24);
    g2.fillText('lead to a big score!', tx, H * 0.24 + mottoSize * 1.2);
    // The four zones.
    const zones = ['reading', 'listening', 'speaking', 'writing'];
    const size = H * 0.2;
    zones.forEach((z, i) => {
      const x = tx + i * (W * 0.155);
      const img = imgs[`icons/zone/zone-${z}.png`];
      if (img) g2.drawImage(img, x, H * 0.6, (img.width / img.height) * size, size);
      g2.fillStyle = '#cfe6ff';
      g2.font = `700 ${Math.round(H * 0.055)}px system-ui, -apple-system, Roboto, sans-serif`;
      g2.fillText(z[0].toUpperCase() + z.slice(1), x, H * 0.82);
    });
    tex.needsUpdate = true;
  };
  for (const n of names) {
    imgs[n] = null;
    const img = new Image();
    img.onload = () => {
      imgs[n] = img;
      draw();
    };
    img.src = `${BASE}${n}`;
  }
  draw();
  const g = new Group();
  g.add(new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, toneMapped: false })));
  const frame = new Mesh(extrude(roundedShape(w + 0.1, h + 0.1, 0.08, { w: w - 0.01, h: h - 0.01, r: 0.05 }), 0.04), standard(PALETTE.white, 0.35));
  frame.position.z = -0.01;
  g.add(frame);
  const led = new Mesh(extrude(roundedShape(w + 0.12, h + 0.12, 0.085, { w: w + 0.09, h: h + 0.09, r: 0.075 }), 0.002, 0), glow(PALETTE.led));
  led.position.z = 0.03;
  g.add(led);
  return g;
}

/** One panoramic window on the curved wall, at an angle around the learner. */
function windowAt(angleDeg: number, view: string, w: number, h: number, y: number): Group {
  const g = new Group();
  const a = (angleDeg * Math.PI) / 180;
  const r = WALL_R - 0.32;
  g.position.set(Math.sin(a) * r, y, -Math.cos(a) * r);
  g.rotation.y = -a;
  const pane = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: loadTexture(view), toneMapped: false }));
  g.add(pane);
  // White rounded frame, and a thin blue LED line inside it.
  const frame = new Mesh(extrude(roundedShape(w + 0.16, h + 0.16, 0.16, { w: w - 0.02, h: h - 0.02, r: 0.12 }), 0.05), standard(PALETTE.white, 0.35));
  frame.position.z = -0.01;
  g.add(frame);
  const led = new Mesh(extrude(roundedShape(w + 0.02, h + 0.02, 0.13, { w: w - 0.01, h: h - 0.01, r: 0.125 }), 0.002, 0), glow(PALETTE.led));
  led.position.z = 0.045;
  g.add(led);
  return g;
}

export interface Room {
  group: Group;
  /** Per-frame animation: LED pulse and drifting light motes. */
  tick: (time: number) => void;
}

export function buildRoom(): Room {
  const room = new Group();
  room.name = 'StudyRoom';

  // Glossy floor with a soft rug under the desk.
  const floor = new Mesh(new CircleGeometry(WALL_R + 0.1, 64), new MeshStandardMaterial({ map: floorTexture(), roughness: 0.18, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const rug = new Mesh(new CircleGeometry(1.15, 48), standard('#d9def0', 0.95));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.003, -0.45);
  room.add(rug);

  // Curved white wall around the learner, and a ceiling.
  const wall = new Mesh(new CylinderGeometry(WALL_R, WALL_R, CEIL_Y, 64, 1, true), new MeshLambertMaterial({ color: new Color(PALETTE.wall), side: BackSide }));
  wall.position.y = CEIL_Y / 2;
  room.add(wall);
  const ceiling = new Mesh(new CircleGeometry(WALL_R, 64), standard('#fbfcff', 0.9));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEIL_Y;
  room.add(ceiling);

  // LED strips: floor edge, ceiling edge, a ceiling ring and a ceiling light panel.
  const leds: MeshBasicMaterial[] = [];
  const ledRing = (radius: number, y: number, tube: number, color = PALETTE.led) => {
    const m = glow(color);
    leds.push(m);
    const ring = new Mesh(new TorusGeometry(radius, tube, 6, 96), m);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    room.add(ring);
    return m;
  };
  const floorLed = ledRing(WALL_R - 0.02, 0.04, 0.012);
  ledRing(WALL_R - 0.03, CEIL_Y - 0.06, 0.014, '#9fd0ff');
  ledRing(1.7, CEIL_Y - 0.02, 0.02, '#cfe6ff');
  const panel = new Mesh(extrude(roundedShape(1.4, 0.32, 0.12), 0.02, 0), glow('#f2f8ff'));
  panel.rotation.x = Math.PI / 2;
  panel.position.set(0, CEIL_Y - 0.03, -0.9);
  room.add(panel);

  // Three panoramic windows: the flag and mountains, Cristo Rei, and the coastline.
  room.add(windowAt(-52, 'view-left.webp', 1.45, 1.45, 1.6));
  room.add(windowAt(0, 'view-center.webp', 2.0, 1.34, 1.62));
  room.add(windowAt(52, 'view-right.webp', 1.7, 1.13, 1.6));

  // The back wall (behind the learner): the live progress board in the centre (src/progress.ts,
  // placed by the app), the motto board on its left and a painting from the app on its right.
  room.add(onWall(mottoBoard(1.15, 0.5), 228, 1.62, 0.14));
  room.add(onWall(framedArt('art-progress.webp', 0.84, 0.6), 132, 1.6));

  // White desk: rounded top with a glowing front edge, on a pedestal.
  const top = new Mesh(extrude(roundedShape(1.5, 0.62, 0.12), 0.035, 0.008), standard('#ffffff', 0.22));
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, DESK_Y - 0.04, DESK_Z);
  room.add(top);
  const edgeMat = glow(PALETTE.led);
  leds.push(edgeMat);
  const edge = new Mesh(new CapsuleGeometry(0.01, 1.34, 4, 8), edgeMat);
  edge.rotation.z = Math.PI / 2;
  edge.position.set(0, DESK_Y - 0.05, DESK_Z + 0.315);
  room.add(edge);
  const pedestal = new Mesh(extrude(roundedShape(1.1, 0.34, 0.1), DESK_Y - 0.08, 0.01), standard('#d9e2f2', 0.35));
  pedestal.rotation.x = -Math.PI / 2;
  pedestal.position.set(0, 0.01, DESK_Z - 0.05);
  room.add(pedestal);
  const baseLed = new Mesh(new CapsuleGeometry(0.005, 0.95, 4, 8), edgeMat);
  baseLed.rotation.z = Math.PI / 2;
  baseLed.position.set(0, 0.07, DESK_Z + 0.13);
  room.add(baseLed);

  // White bookshelf with colourful books, on the left.
  const shelf = new Group();
  shelf.position.set(-2.05, 0, -1.65);
  shelf.rotation.y = Math.PI / 4.2;
  const shelfBack = new Mesh(extrude(roundedShape(0.9, 1.7, 0.08), 0.05, 0.01), standard(PALETTE.white, 0.4));
  shelfBack.position.set(0, 0.85, -0.15);
  shelf.add(shelfBack);
  const bookColors = ['#1769f5', '#2149b8', '#7444d6', '#0f8a6b', '#d4561f', '#f2b705', '#101b4d'];
  for (let s = 0; s < 3; s++) {
    const board = new Mesh(extrude(roundedShape(0.82, 0.26, 0.04), 0.025, 0), standard(PALETTE.white, 0.4));
    board.rotation.x = -Math.PI / 2;
    board.position.set(0, 0.42 + s * 0.45, -0.02);
    shelf.add(board);
    const shelfLed = new Mesh(new CapsuleGeometry(0.004, 0.72, 4, 8), edgeMat);
    shelfLed.rotation.z = Math.PI / 2;
    shelfLed.position.set(0, 0.4 + s * 0.45, 0.1);
    shelf.add(shelfLed);
    for (let i = 0; i < 6; i++) {
      const hgt = 0.2 + ((i * 7 + s * 3) % 4) * 0.025;
      const book = new Mesh(extrude(roundedShape(0.07, hgt, 0.01), 0.17, 0), standard(bookColors[(i + s * 2) % bookColors.length], 0.7));
      book.position.set(-0.28 + i * 0.1, 0.45 + s * 0.45 + hgt / 2, -0.1);
      shelf.add(book);
    }
  }
  room.add(shelf);

  // Padded white bench along the left wall.
  const bench = new Group();
  bench.position.set(-1.95, 0, 0.35);
  bench.rotation.y = Math.PI / 2.4;
  for (let i = 0; i < 2; i++) {
    const seat = new Mesh(new CapsuleGeometry(0.18, 0.7, 6, 16), standard(PALETTE.white, 0.75));
    seat.rotation.z = Math.PI / 2;
    seat.position.set(-0.55 + i * 1.1, 0.22, 0);
    seat.scale.set(1, 1, 1.25);
    bench.add(seat);
  }
  room.add(bench);

  // Lavender bean bag on the right.
  const bean = new Mesh(new SphereGeometry(0.42, 28, 18), standard('#b7b4f2', 0.9));
  bean.scale.set(1.15, 0.72, 1.05);
  bean.position.set(2.05, 0.3, -0.75);
  room.add(bean);

  // Plants in white pots.
  const plantAt = (x: number, z: number, scale: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    const pot = new Mesh(new CylinderGeometry(0.17, 0.13, 0.34, 24), standard(PALETTE.white, 0.35));
    pot.position.y = 0.17;
    g.add(pot);
    const leafMat = standard('#3f9b4f', 0.7);
    const leafGeo = new SphereGeometry(0.12, 10, 8);
    for (let i = 0; i < 9; i++) {
      const leaf = new Mesh(leafGeo, leafMat);
      const a = (i / 9) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.14, 0.5 + (i % 3) * 0.12, Math.sin(a) * 0.14);
      leaf.scale.set(0.55, 1.5, 0.28);
      leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
      g.add(leaf);
    }
    room.add(g);
  };
  plantAt(-1.35, -2.2, 1.1);
  plantAt(1.45, -2.15, 1.0);
  plantAt(2.35, 0.6, 1.2);

  // Light motes drifting slowly through the room.
  const COUNT = 40;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.8 + Math.random() * 1.8;
    positions[i * 3] = Math.sin(a) * r;
    positions[i * 3 + 1] = 0.4 + Math.random() * 2.2;
    positions[i * 3 + 2] = -Math.abs(Math.cos(a)) * r;
    seeds[i] = Math.random() * 10;
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const motes = new Points(moteGeo, new PointsMaterial({ map: dotTexture(), color: new Color('#9fd0ff'), size: 0.03, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  room.add(motes);
  const base = positions.slice();

  const ledColor = new Color(PALETTE.led);
  const ledBright = new Color('#8fc3ff');
  const tick = (time: number) => {
    // Gentle LED "breathing".
    const k = 0.5 + Math.sin(time * 1.4) * 0.5;
    floorLed.color.copy(ledColor).lerp(ledBright, k * 0.6);
    edgeMat.color.copy(floorLed.color);
    // Motes float up and down.
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 1] = base[i * 3 + 1] + Math.sin(time * 0.4 + seeds[i]) * 0.08;
      positions[i * 3] = base[i * 3] + Math.cos(time * 0.3 + seeds[i]) * 0.04;
    }
    moteGeo.attributes.position.needsUpdate = true;
  };

  return { group: room, tick };
}

/** A white potted plant for the desk that grows with each day of study (stage 0–4). */
export class Plant {
  readonly group = new Group();
  private readonly leaves: Mesh[] = [];

  constructor() {
    this.group.name = 'StudyPlant';
    const pot = new Mesh(new CylinderGeometry(0.055, 0.042, 0.09, 20), standard(PALETTE.white, 0.35));
    pot.position.y = 0.045;
    this.group.add(pot);
    const ring = new Mesh(new TorusGeometry(0.055, 0.003, 6, 32), glow(PALETTE.led));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.088;
    this.group.add(ring);
    const leafMat = standard('#3f9b4f', 0.7);
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

/** Material helpers shared with the holographic panels. */
export const holo = { glow, DoubleSide, AdditiveBlending };
