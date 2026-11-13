/**
 * Talking movement for the Listening speakers. The models are single static meshes with no
 * skeleton, so a few lines in the vertex shader move two parts of the body:
 *
 * - the jaw: skin between the lips and the chin drops a little, by how loud the voice is right now
 *   (so the mouth opens and closes with the real speech);
 * - the hands: each forearm turns about its elbow in a slow, uneven gesture while the speaker talks.
 *
 * Positions below were measured on the models (lips found by the red of the texture) and are in
 * the glTF scene's units (about 1.9 tall, centred on the origin, facing +Z).
 */
import type { Mesh, MeshLambertMaterial } from '@iwsdk/core';

export interface TalkRig {
  /** Height of the line between the lips, the chin, and how far forward the face is. */
  mouthY: number;
  chinY: number;
  faceZ: number;
  /** Elbow pivots (x is mirrored for the other arm), and where the forearms start. */
  elbow: [number, number, number];
}

export const TALK_RIGS: Record<'speaker-female' | 'speaker-male', TalkRig> = {
  'speaker-female': { mouthY: 0.704, chinY: 0.672, faceZ: 0.03, elbow: [0.235, 0.33, 0.02] },
  'speaker-male': { mouthY: 0.706, chinY: 0.668, faceZ: -0.028, elbow: [0.265, 0.3, 0.0] },
};

/** Per-frame controls, written by the Listening screen. */
export interface Talker {
  /** 0 = still, 1 = talking (eased in and out by the caller). */
  talk: { value: number };
  /** How open the mouth is right now, 0–1. */
  mouth: { value: number };
  time: { value: number };
}

/** Adds the talking movement to a speaker mesh's material and returns its controls. */
export function addTalking(mesh: Mesh, material: MeshLambertMaterial, rig: TalkRig): Talker {
  // The shader works in the mesh's own (quantised) space: convert the measured positions.
  const s = mesh.scale.x || 1;
  const o = mesh.position;
  const ly = (y: number) => (y - o.y) / s;
  const lz = (z: number) => (z - o.z) / s;
  const lx = (x: number) => x / s;
  const talker: Talker = { talk: { value: 0 }, mouth: { value: 0 }, time: { value: 0 } };
  const unit = 1 / s;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTalk = talker.talk;
    shader.uniforms.uMouth = talker.mouth;
    shader.uniforms.uTime = talker.time;
    const f = (n: number) => n.toFixed(4);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTalk;
uniform float uMouth;
uniform float uTime;
const vec3 ELBOW = vec3(${f(lx(rig.elbow[0]))}, ${f(ly(rig.elbow[1]))}, ${f(lz(rig.elbow[2]))});
mat3 rotXY(float ax, float ay) {
  float cx = cos(ax), sx = sin(ax), cy = cos(ay), sy = sin(ay);
  return mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
}
// Forearm weight: in front of the body, beside the torso, at hand height.
float armWeight(vec3 p) {
  return smoothstep(${f(lz(0.07))}, ${f(lz(0.2))}, p.z)
    * smoothstep(${f(0.07 * unit)}, ${f(0.13 * unit)}, abs(p.x))
    * smoothstep(${f(ly(0.08))}, ${f(ly(0.16))}, p.y) * (1.0 - smoothstep(${f(ly(0.46))}, ${f(ly(0.54))}, p.y));
}
mat3 armRotation(vec3 p, out vec3 pivot) {
  float side = sign(p.x);
  pivot = vec3(ELBOW.x * side, ELBOW.y, ELBOW.z);
  float ph = side > 0.0 ? 1.7 : 0.0;
  // Slow, uneven gestures: lift and lower the forearm, and open it a little outwards.
  float lift = uTalk * (0.16 * sin(uTime * 2.6 + ph) + 0.07 * sin(uTime * 4.9 + ph * 2.3));
  float open = uTalk * side * 0.14 * sin(uTime * 1.9 + ph * 1.3);
  return rotXY(-lift * armWeight(p), open * armWeight(p));
}
// Jaw weight: the front of the face, from just under the lips down to the chin.
float jawWeight(vec3 p) {
  float below = smoothstep(${f(ly(rig.mouthY + 0.002))}, ${f(ly(rig.mouthY - 0.008))}, p.y);
  float chin = 1.0 - smoothstep(${f(ly(rig.chinY - 0.004))}, ${f(ly(rig.chinY - 0.03))}, p.y);
  float mid = 1.0 - smoothstep(${f(0.03 * unit)}, ${f(0.06 * unit)}, abs(p.x));
  float front = smoothstep(${f(lz(rig.faceZ - 0.05))}, ${f(lz(rig.faceZ - 0.02))}, p.z);
  return below * chin * mid * front;
}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vec3 talkPivot;
mat3 talkRot = armRotation(position, talkPivot);
objectNormal = talkRot * objectNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed = talkPivot + talkRot * (transformed - talkPivot);
transformed.y -= uMouth * ${f(0.011 * unit)} * jawWeight(position);
transformed.z -= uMouth * ${f(0.003 * unit)} * jawWeight(position);`,
      );
  };
  material.customProgramCacheKey = () => `talk-${rig.mouthY}-${rig.elbow.join(',')}`;
  material.needsUpdate = true;
  return talker;
}
