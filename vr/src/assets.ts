/**
 * Asset manifest shared by the runtime and the IWSDK editor. The room itself is built in code
 * (src/room.ts) and question media comes from the LafaekTOEFL API at runtime. The school chair,
 * loading spinner and Listening speakers are glTF files in public/models (credits: public/models/CREDITS.md),
 * loaded lazily so the room opens without waiting for them.
 */
import { AssetType, defineAssets } from '@iwsdk/core';

const model = (file: string, name: string) => ({
  url: `${import.meta.env.BASE_URL}models/${file}`,
  type: AssetType.GLTF,
  name,
  priority: 'lazy' as const,
});

export default defineAssets({
  'school-chair': model('school-chair.glb', 'School chair'),
  'loading-spinner': model('loading.glb', 'Loading spinner'),
  // The Listening cast and the lecture podium, made with Meshy AI (see src/speakers.ts).
  'speaker-female': model('speaker-female.glb', 'Speaker: businesswoman'),
  'speaker-male': model('speaker-male.glb', 'Speaker: businessman'),
  'speaker-student-f': model('speaker-student-f.glb', 'Speaker: student (woman)'),
  'speaker-student-m': model('speaker-student-m.glb', 'Speaker: student (man)'),
  'speaker-librarian': model('speaker-librarian.glb', 'Speaker: librarian (seated)'),
  'speaker-staff': model('speaker-staff.glb', 'Speaker: campus staff (seated)'),
  'speaker-elder': model('speaker-elder.glb', 'Speaker: older man with tais (seated)'),
  'speaker-prof-f': model('speaker-prof-f.glb', 'Speaker: professor (woman)'),
  'speaker-prof-m': model('speaker-prof-m.glb', 'Speaker: professor (man)'),
  'speaker-announcer': model('speaker-announcer.glb', 'Speaker: announcer'),
  'lecture-podium': model('lecture-podium.glb', 'Lecture podium'),
  'interviewer-lafaek': model('interviewer-lafaek.glb', 'Interviewer: Lafaek the crocodile'),
});
