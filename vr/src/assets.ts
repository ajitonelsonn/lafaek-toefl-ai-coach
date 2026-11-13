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
  // The two Listening speakers, made with Meshy AI (image to 3D) from our own pictures.
  'speaker-female': model('speaker-female.glb', 'Listening speaker (woman)'),
  'speaker-male': model('speaker-male.glb', 'Listening speaker (man)'),
});
