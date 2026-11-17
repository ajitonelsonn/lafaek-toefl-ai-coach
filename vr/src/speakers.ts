/**
 * The cast of the Listening room: 3D people made with Meshy AI (public/models/speaker-*.glb).
 * Each conversation, announcement or talk picks who speaks from here, matched to the voice's
 * gender and the scene, so the learner meets different people instead of the same two every time.
 *
 * `rig` holds positions measured on each model (in the glTF's own units, facing +Z): the mouth
 * and chin heights (read from the textured face), how far forward the face is, and the hands
 * (talk.ts moves these while the person speaks). A null hand stays still (e.g. holding a mic).
 */
export type SpeakerScene = 'conversation' | 'announcement' | 'lecture' | 'response';
export type Gender = 'female' | 'male';

export interface SpeakerRig {
  /** Model height in its own units, and the face's centre line. */
  h: number;
  cx: number;
  mouthY: number;
  chinY: number;
  faceZ: number;
  hands: [Vec3 | null, Vec3 | null];
  /** Optional tuning (fractions of the height) for unusual faces, e.g. a crocodile's snout. */
  jawWidth?: [number, number];
  jawDepth?: number;
  jawDrop?: number;
  handReach?: [number, number];
}
type Vec3 = [number, number, number];

export interface SpeakerInfo {
  gender: Gender;
  /** Real height in metres: standing height, or the top of the head when seated. */
  metres: number;
  seated: boolean;
  scenes: SpeakerScene[];
  /** Scene titles this person suits best (e.g. the librarian for a library conversation). */
  prefer?: RegExp;
  rig: SpeakerRig;
}

const CAMPUS = /student|class|campus|dorm|friend|study|group|club|cafeteria|exam|homework/i;
const TEACHING = /professor|lecture|assignment|essay|research|course|seminar|grade|paper|thesis|lab/i;

export const SPEAKERS = {
  'speaker-female': {
    gender: 'female', metres: 1.58, seated: false, scenes: ['conversation', 'announcement', 'response'],
    rig: { h: 1.9028, cx: 0.0118, mouthY: 0.705, chinY: 0.672, faceZ: 0.0368, hands: [[-0.2147, 0.3218, 0.2797], [0.2052, 0.2995, 0.2851]] },
  },
  'speaker-male': {
    gender: 'male', metres: 1.68, seated: false, scenes: ['conversation', 'announcement', 'response'],
    rig: { h: 1.9014, cx: 0.0001, mouthY: 0.705, chinY: 0.668, faceZ: -0.0249, hands: [[-0.2721, 0.3283, 0.2735], [0.2675, 0.2455, 0.2871]] },
  },
  'speaker-student-f': {
    gender: 'female', metres: 1.55, seated: false, scenes: ['conversation', 'response'], prefer: CAMPUS,
    rig: { h: 0.9507, cx: -0.001, mouthY: 0.3687, chinY: 0.3402, faceZ: 0.0618, hands: [[-0.0532, 0.1273, 0.1387], [0.0494, 0.1288, 0.1403]] },
  },
  'speaker-student-m': {
    gender: 'male', metres: 1.68, seated: false, scenes: ['conversation', 'response'], prefer: CAMPUS,
    rig: { h: 0.9507, cx: -0.0005, mouthY: 0.3637, chinY: 0.3379, faceZ: -0.0056, hands: [[-0.0823, 0.0776, 0.1061], [0.0824, 0.0776, 0.1055]] },
  },
  'speaker-librarian': {
    gender: 'female', metres: 1.24, seated: true, scenes: ['conversation'], prefer: /librar|book|borrow|return|reading room|archive/i,
    rig: { h: 0.9512, cx: 0.0153, mouthY: 0.3432, chinY: 0.319, faceZ: -0.0315, hands: [[-0.0393, -0.0764, 0.1598], [0.0518, -0.0685, 0.1605]] },
  },
  'speaker-staff': {
    gender: 'male', metres: 1.32, seated: true, scenes: ['conversation', 'response'], prefer: /office|regist|admin|fee|form|schedule|staff|desk|housing|enrol|ID card|permit/i,
    rig: { h: 0.9517, cx: -0.0042, mouthY: 0.3416, chinY: 0.3173, faceZ: -0.0246, hands: [[-0.1397, -0.0496, 0.1932], [0.1346, -0.0491, 0.194]] },
  },
  'speaker-elder': {
    gender: 'male', metres: 1.3, seated: true, scenes: ['conversation'], prefer: /family|grand|history|culture|community|village|tradition/i,
    rig: { h: 0.9517, cx: 0.0096, mouthY: 0.3529, chinY: 0.3249, faceZ: -0.0286, hands: [[-0.1044, -0.0037, 0.2128], [0.0963, 0.0001, 0.2188]] },
  },
  'speaker-prof-f': {
    gender: 'female', metres: 1.6, seated: false, scenes: ['lecture', 'conversation'], prefer: TEACHING,
    rig: { h: 0.9502, cx: -0.0021, mouthY: 0.3666, chinY: 0.3347, faceZ: -0.0017, hands: [[-0.0924, 0.1712, 0.1252], [0.0868, 0.1689, 0.1255]] },
  },
  'speaker-prof-m': {
    gender: 'male', metres: 1.7, seated: false, scenes: ['lecture', 'conversation'], prefer: TEACHING,
    rig: { h: 0.9507, cx: -0.002, mouthY: 0.3697, chinY: 0.3406, faceZ: -0.0129, hands: [[-0.0863, 0.2038, 0.1214], [0.0463, 0.1959, 0.1078]] },
  },
  'speaker-announcer': {
    gender: 'female', metres: 1.58, seated: false, scenes: ['announcement'],
    // Her right hand holds the microphone, so only the free hand gestures.
    rig: { h: 0.9507, cx: 0.0005, mouthY: 0.3638, chinY: 0.3379, faceZ: -0.0036, hands: [null, [0.0663, 0.1692, 0.1377]] },
  },
} satisfies Record<string, SpeakerInfo>;

export type SpeakerId = keyof typeof SPEAKERS;
export const SPEAKER_IDS = Object.keys(SPEAKERS) as SpeakerId[];

export function speakerInfo(id: SpeakerId): SpeakerInfo {
  return SPEAKERS[id];
}

/** A small stable hash, so the same question always shows the same people. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Picks who speaks: someone of the right gender who suits the scene, preferring people whose
 * `prefer` matches the title. `seed` (the question's id plus the slot) keeps the choice stable,
 * and `avoid` keeps two speakers in one conversation different.
 */
export function pickSpeaker(gender: Gender, scene: SpeakerScene, title: string, seed: string, avoid?: SpeakerId): SpeakerId {
  const fits = SPEAKER_IDS.filter((id) => id !== avoid && SPEAKERS[id].gender === gender && (SPEAKERS[id] as SpeakerInfo).scenes.includes(scene));
  const pool = fits.length ? fits : SPEAKER_IDS.filter((id) => id !== avoid && SPEAKERS[id].gender === gender);
  const preferred = pool.filter((id) => (SPEAKERS[id] as SpeakerInfo).prefer?.test(title));
  const from = preferred.length ? preferred : pool;
  return from[hash(seed) % from.length];
}

/**
 * The interviewer in Take an Interview: Lafaek, the LafaekTOEFL crocodile, seated on a blue chair
 * (public/models/interviewer-lafaek.glb). The snout is wide and deep, and the hands are held close
 * to the belly, so the jaw region is wider and the hand region tighter than on the people.
 */
export const LAFAEK = {
  metres: 1.0,
  rig: {
    h: 0.9521, cx: 0.072, mouthY: 0.2378, chinY: 0.2026, faceZ: 0.2532,
    hands: [[-0.1312, 0.0232, 0.1786], [0.2868, 0.0232, 0.1788]],
    jawWidth: [0.05, 0.085], jawDepth: 0.07, jawDrop: 0.012, handReach: [0.03, 0.07],
  } satisfies SpeakerRig,
};
