/**
 * LafaekTOEFL Study Room: entry point. Creates the IWSDK world, registers systems and screens,
 * and wires the 2D overlay. The room uses the learner's own study-plan questions, so the overlay
 * asks visitors to sign in (or create a plan) before they can enter.
 */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { App, hubScreen, ZONES, zoneScreen } from './app.js';
import { ClickSystem } from './clicks.js';
import { currentUser, DataSource, hasStudyPlan } from './data.js';
import { interviewScreen } from './interview.js';
import { makeListeningScreen } from './listening.js';
import { makeReadingScreen } from './reading.js';
import { repeatScreen } from './repeat.js';
import { PinchGrabSystem, sentenceScreen } from './sentence.js';

/** From the /vr page: ?mode=preview opens the room in this browser; ?open=<station> starts there. */
const params = new URLSearchParams(location.search);
const STATIONS = ['zone-reading', 'zone-listening', 'zone-speaking', 'zone-writing', 'reading-daily', 'reading-academic', 'sentence', 'listen-response', 'listen-conversation', 'listen-announcement', 'listen-talk', 'repeat', 'interview'];
const startAt = STATIONS.includes(params.get('open') ?? '') ? (params.get('open') as string) : 'hub';
const previewNow = params.get('mode') === 'preview';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const overlay = $<HTMLDivElement>('overlay');
const enterBtn = $<HTMLButtonElement>('enter-vr');
const previewBtn = $<HTMLButtonElement>('preview');
const note = $<HTMLParagraphElement>('note');

/** Shows one of the overlay's action groups: ready, need-login or need-plan. */
function showActions(id: 'ready' | 'need-login' | 'need-plan'): void {
  for (const group of ['ready', 'need-login', 'need-plan']) $(group).hidden = group !== id;
}

async function main() {
  const [world, user] = await Promise.all([World.create($<HTMLDivElement>('scene-container'), projectOptions), currentUser()]);
  world.registerSystem(ClickSystem);
  world.registerSystem(PinchGrabSystem);

  // VR is only for signed-in learners with a study plan. Until that check passes, any XR session
  // (the browser's own Enter VR prompt, or the dev emulator) is ended at once.
  let allowed = false;
  world.visibilityState.subscribe(() => {
    if (!world.session) return;
    if (allowed) overlay.hidden = true;
    else world.exitXR();
  });
  overlay.classList.add('ready');

  if (!user) {
    showActions('need-login');
    return;
  }
  if (!(await hasStudyPlan())) {
    showActions('need-plan');
    return;
  }

  // Signed in with a plan: build the room and allow VR.
  const app = new App(world, new DataSource(user));
  app.register('hub', hubScreen);
  // Three zones (Reading & Word Puzzle, Listening, Speaking) and their activities. Writing stays 2D.
  for (const z of ZONES) app.register(z.id, zoneScreen(z.id));
  app.register('reading-daily', makeReadingScreen('read-in-daily-life', 'Read in Daily Life'));
  app.register('reading-academic', makeReadingScreen('read-academic-passage', 'Read an Academic Passage'));
  app.register('sentence', sentenceScreen);
  app.register('listen-response', makeListeningScreen('listen-choose-response', 'Listen and Choose a Response'));
  app.register('listen-conversation', makeListeningScreen('listen-conversation', 'Listen to a Conversation'));
  app.register('listen-announcement', makeListeningScreen('listen-announcement', 'Listen to an Announcement'));
  app.register('listen-talk', makeListeningScreen('listen-academic-talk', 'Listen to an Academic Talk'));
  app.register('repeat', repeatScreen);
  app.register('interview', interviewScreen);
  await app.loadImages();
  app.open(startAt);
  allowed = true;
  showActions('ready');
  const xrOk = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)));
  if (!xrOk) {
    enterBtn.disabled = true;
    note.textContent = 'Start VR needs a Meta Quest headset. Use Preview to try it here.';
  }
  enterBtn.addEventListener('click', () => {
    app.sound.resume();
    world.launchXR();
  });
  previewBtn.addEventListener('click', () => {
    app.sound.resume();
    overlay.hidden = true;
  });
  if (previewNow) {
    app.sound.resume();
    overlay.hidden = true;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !world.session) overlay.hidden = false;
  });
}

main().catch((e) => {
  console.error(e);
  note.textContent = 'The study room could not start. Please reload the page.';
});
