/**
 * Talking movement for the Listening speakers. The models are single static meshes with no
 * skeleton, so a few lines in the vertex shader move two parts of the body:
 *
 * - the jaw: skin between the lips and the chin drops a little, by how loud the voice is right now
 *   (so the mouth opens and closes with the real speech);
 * - the hands: each forearm turns up about its elbow in a slow, uneven gesture while the speaker
 *   talks, then settles back to rest. Only the hand and forearm move, so a seated person's knees
 *   just below their hands stay still.
 *
 * The positions come from each model's measured rig (speakers.ts). Distances below are written
 * as fractions of the model's height, so the same numbers fit every model.
 */
import type { Mesh, MeshLambertMaterial } from '@iwsdk/core';
import type { SpeakerRig } from './speakers.js';

/** Per-frame controls, written by the Listening screen. */
export interface Talker {
  /** 0 = still, 1 = talking (eased in and out by the caller). */
  talk: { value: number };
  /** How open the mouth is right now, 0–1. */
  mouth: { value: number };
  time: { value: number };
}

/** Adds the talking movement to a speaker mesh's material and returns its controls. */
export function addTalking(mesh: Mesh, material: MeshLambertMaterial, rig: SpeakerRig, key: string): Talker {
  // The shader works in the mesh's own (quantised) space: convert the measured positions.
  const s = mesh.scale.x || 1;
  const o = mesh.position;
  const lx = (x: number) => (x - o.x) / s;
  const ly = (y: number) => (y - o.y) / s;
  const lz = (z: number) => (z - o.z) / s;
  /** A length given as a fraction of the model's height, in mesh units. */
  const L = (fraction: number) => (fraction * rig.h) / s;
  const f = (n: number) => n.toFixed(5);
  const vec = (p: [number, number, number] | null) => (p ? `vec3(${f(lx(p[0]))}, ${f(ly(p[1]))}, ${f(lz(p[2]))})` : 'vec3(0.0)');
  const talker: Talker = { talk: { value: 0 }, mouth: { value: 0 }, time: { value: 0 } };
  const [jawIn, jawOut] = rig.jawWidth ?? [0.016, 0.032];
  const jawDepth = rig.jawDepth ?? 0.026;
  const jawDrop = rig.jawDrop ?? 0.0058;
  const [reachIn, reachOut] = rig.handReach ?? [0.045, 0.11];

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTalk = talker.talk;
    shader.uniforms.uMouth = talker.mouth;
    shader.uniforms.uTime = talker.time;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTalk;
uniform float uMouth;
uniform float uTime;
const vec3 HAND_L = ${vec(rig.hands[0])};
const vec3 HAND_R = ${vec(rig.hands[1])};
const float HAS_L = ${rig.hands[0] ? '1.0' : '0.0'};
const float HAS_R = ${rig.hands[1] ? '1.0' : '0.0'};
const float FACE_X = ${f(lx(rig.cx))};
mat3 rotXY(float ax, float ay) {
  float cx = cos(ax), sx = sin(ax), cy = cos(ay), sy = sin(ay);
  return mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy) * mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
}
// Hand and forearm weight: near the hand, in front of the elbow, not below the hand.
float armWeight(vec3 p, vec3 hand, vec3 elbow) {
  float near = 1.0 - smoothstep(${f(L(reachIn))}, ${f(L(reachOut))}, distance(p, hand));
  float front = smoothstep(elbow.z + ${f(L(0.015))}, elbow.z + ${f(L(0.05))}, p.z);
  float above = smoothstep(hand.y - ${f(L(0.035))}, hand.y - ${f(L(0.012))}, p.y);
  return near * front * above;
}
mat3 armRotation(vec3 p, out vec3 pivot) {
  bool left = p.x < FACE_X;
  vec3 hand = left ? HAND_L : HAND_R;
  float has = left ? HAS_L : HAS_R;
  float side = left ? -1.0 : 1.0;
  // The elbow sits behind and a little below the hand.
  pivot = hand + vec3(0.0, ${f(-L(0.01))}, ${f(-L(0.13))});
  float w = has * armWeight(p, hand, pivot);
  float ph = left ? 0.0 : 1.7;
  // Slow, uneven gestures: the forearm rises and falls back to rest, and opens a little.
  float lift = uTalk * (0.11 + 0.08 * sin(uTime * 2.6 + ph) + 0.04 * sin(uTime * 4.9 + ph * 2.3));
  float open = uTalk * side * 0.12 * sin(uTime * 1.9 + ph * 1.3);
  return rotXY(-lift * w, open * w);
}
// Jaw weight: the front of the face, from just under the lips down to the chin.
float jawWeight(vec3 p) {
  float below = smoothstep(${f(ly(rig.mouthY) + L(0.001))}, ${f(ly(rig.mouthY) - L(0.0042))}, p.y);
  float chin = 1.0 - smoothstep(${f(ly(rig.chinY) - L(0.002))}, ${f(ly(rig.chinY) - L(0.016))}, p.y);
  float mid = 1.0 - smoothstep(${f(L(jawIn))}, ${f(L(jawOut))}, abs(p.x - FACE_X));
  float front = smoothstep(${f(lz(rig.faceZ) - L(jawDepth))}, ${f(lz(rig.faceZ) - L(jawDepth * 0.4))}, p.z);
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
float jaw = uMouth * jawWeight(position);
transformed.y -= jaw * ${f(L(jawDrop))};
transformed.z -= jaw * ${f(L(jawDrop * 0.28))};`,
      );
  };
  material.customProgramCacheKey = () => `talk-${key}`;
  material.needsUpdate = true;
  return talker;
}
