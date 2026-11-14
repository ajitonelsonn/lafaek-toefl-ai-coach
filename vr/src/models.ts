/**
 * The 3D chair, loading spinner, lecture podium and the Listening speakers (speakers.ts). Each model is loaded once through the AssetManager,
 * normalised to a real-world size with its feet on the floor, and reused between screens (screens
 * detach it on close instead of disposing it, so the cached GPU data stays valid).
 */
import { AnimationMixer, AssetManager, Box3, Entity, Group, LoopRepeat, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, Vector3, World } from '@iwsdk/core';
import { animate } from './clicks.js';
import { LAFAEK, SPEAKERS, SPEAKER_IDS, type SpeakerId } from './speakers.js';
import { addTalking } from './talk.js';

export type ModelId = 'school-chair' | 'loading-spinner' | 'lecture-podium' | 'interviewer-lafaek' | SpeakerId;

const isSpeaker = (id: ModelId): id is SpeakerId => (SPEAKER_IDS as string[]).includes(id);

/** Target size in metres, measured on the model's largest-relevant axis. */
const SIZE: Record<ModelId, { axis: 'y' | 'max'; metres: number }> = {
  'school-chair': { axis: 'y', metres: 1.0 }, // real size (seat about 45 cm)
  'loading-spinner': { axis: 'max', metres: 0.12 },
  'lecture-podium': { axis: 'y', metres: 1.12 },
  'interviewer-lafaek': { axis: 'y', metres: LAFAEK.metres },
  // The Listening speakers at their real height (standing, or the top of the head when seated).
  ...(Object.fromEntries(SPEAKER_IDS.map((id) => [id, { axis: 'y', metres: SPEAKERS[id].metres }])) as Record<SpeakerId, { axis: 'y'; metres: number }>),
};

interface Loaded {
  root: Group;
  mixer: AnimationMixer | null;
}

const cache = new Map<ModelId, Promise<Loaded | null>>();

function normalise(obj: Object3D, id: ModelId): Group {
  // `precise` measures skinned meshes in their current (animated) pose, not the bind pose.
  obj.updateMatrixWorld(true);
  const box = new Box3().setFromObject(obj, true);
  const size = box.getSize(new Vector3());
  const { axis, metres } = SIZE[id];
  const current = axis === 'y' ? size.y : Math.max(size.x, size.y, size.z);
  const s = current > 0 ? metres / current : 1;
  obj.scale.multiplyScalar(s);
  // Feet (or base) on the floor, centred on the origin.
  obj.updateMatrixWorld(true);
  const after = new Box3().setFromObject(obj, true);
  const centre = after.getCenter(new Vector3());
  obj.position.x -= centre.x;
  obj.position.z -= centre.z;
  obj.position.y -= after.min.y;
  const holder = new Group();
  holder.name = id;
  holder.add(obj);
  return holder;
}

/** Loads (once) and returns a model ready to place, or null if it failed to load. */
export function loadModel(id: ModelId): Promise<Loaded | null> {
  let p = cache.get(id);
  if (!p) {
    p = AssetManager.loadGLTFById(id)
      .then((gltf) => {
        let mixer: AnimationMixer | null = null;
        if (gltf.animations.length) {
          mixer = new AnimationMixer(gltf.scene);
          const action = mixer.clipAction(gltf.animations[0]);
          action.setLoop(LoopRepeat, Infinity);
          action.play();
          mixer.update(0); // pose the model (e.g. seated) before measuring it
        }
        if (id === 'school-chair') {
          // White plastic to match the futuristic room (the source texture is dark navy).
          const white = new MeshStandardMaterial({ color: '#eef2fa', roughness: 0.35 });
          gltf.scene.traverse((o) => {
            if ((o as Mesh).isMesh) (o as Mesh).material = white;
          });
        }
        if (id === 'loading-spinner') {
          // Its source material needs specular lighting and renders black here: use the brand blue.
          const blue = new MeshBasicMaterial({ color: '#1769f5', toneMapped: false });
          gltf.scene.traverse((o) => {
            if ((o as Mesh).isMesh) (o as Mesh).material = blue;
          });
        }
        const rig = isSpeaker(id) ? SPEAKERS[id].rig : id === 'interviewer-lafaek' ? LAFAEK.rig : null;
        if (rig) {
          // Matte cloth and skin: Lambert with the colour and normal maps. The source PBR material
          // has metal in it, which turns dark without an environment map, and costs more on Quest.
          gltf.scene.traverse((o) => {
            const mesh = o as Mesh;
            if (!mesh.isMesh) return;
            const src = mesh.material as MeshStandardMaterial;
            const mat = new MeshLambertMaterial({ map: src.map, normalMap: src.normalMap, emissive: '#ffffff', emissiveMap: src.map, emissiveIntensity: 0.06 });
            // The first two models were made from bright studio photos: a warm tint brings their
            // skin in line with the rest of the cast.
            if (id === 'speaker-male') mat.color.set('#dcc3ad');
            if (id === 'speaker-female') mat.color.set('#eedccb');
            mesh.material = mat;
            // Mouth and hand movement while speaking (talk.ts); read by the Listening screen.
            mesh.userData.talker = addTalking(mesh, mat, rig, id);
            mesh.raycast = () => {};
            src.metalnessMap?.dispose();
            src.dispose();
          });
        }
        return { root: normalise(gltf.scene, id), mixer };
      })
      .catch((e) => {
        console.warn(`[models] ${id} failed to load`, e);
        return null;
      });
    cache.set(id, p);
  }
  return p;
}

/** A placed model: an entity holding the shared model, plus its animation while shown. */
export class Placed {
  private stopAnim: (() => void) | null = null;

  private constructor(
    readonly entity: Entity,
    readonly root: Group,
  ) {}

  static async place(world: World, parent: Entity, id: ModelId, at: Vector3, yaw = 0): Promise<Placed | null> {
    const m = await loadModel(id);
    if (!m) return null;
    const holder = new Group();
    holder.position.copy(at);
    holder.rotation.y = yaw;
    holder.add(m.root);
    const placed = new Placed(world.createTransformEntity(holder, { parent }), m.root);
    if (m.mixer) {
      const mixer = m.mixer;
      placed.stopAnim = animate((_t, delta) => mixer.update(delta));
    }
    return placed;
  }

  /** Removes it from the room but keeps the cached model and its GPU data for next time. */
  remove(): void {
    this.stopAnim?.();
    this.root.removeFromParent();
    this.entity.dispose({ disposeResources: false });
  }
}

/** Turns a model holder to face a seated learner at the origin. */
export function yawToViewer(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** The animated loading spinner, shown in front of the learner while something loads. */
export class Spinner {
  private placed: Placed | null = null;
  private loading: Promise<void> | null = null;
  private wanted = false;
  private disposed = false;

  constructor(
    private readonly app: { world: World; workspace: Entity },
    private readonly at: Vector3,
  ) {}

  async show(on: boolean): Promise<void> {
    this.wanted = on;
    if (on && !this.placed && !this.loading) {
      this.loading = Placed.place(this.app.world, this.app.workspace, 'loading-spinner', this.at, yawToViewer(this.at.x, this.at.z)).then((p) => {
        // The spinner's rings lie flat; stand them up so they face the learner.
        if (p) {
          p.root.rotation.x = Math.PI / 2;
          p.root.position.y = 0.06;
        }
        this.placed = p;
        if (this.disposed) p?.remove();
      });
    }
    await this.loading;
    if (this.placed) this.placed.root.visible = this.wanted && !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.placed?.remove();
    this.placed = null;
  }
}
