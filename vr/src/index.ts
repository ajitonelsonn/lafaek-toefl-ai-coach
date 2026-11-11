/**
 * LafaekTOEFL Study Room: entry point. Creates the IWSDK world, registers systems and screens,
 * and wires the 2D overlay (Enter VR / preview in browser / back to the 2D site).
 */
import { VisibilityState, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { App, hubScreen } from './app.js';
import { ClickSystem } from './clicks.js';
import { currentUser, DataSource } from './data.js';
import { interviewScreen } from './interview.js';
import { listeningScreen } from './listening.js';
import { PinchGrabSystem, sentenceScreen } from './sentence.js';

const overlay = document.getElementById('overlay') as HTMLDivElement;
const enterBtn = document.getElementById('enter-vr') as HTMLButtonElement;
const previewBtn = document.getElementById('preview') as HTMLButtonElement;
const backLink = document.getElementById('back-2d') as HTMLAnchorElement;
const note = document.getElementById('note') as HTMLParagraphElement;
const who = document.getElementById('who') as HTMLParagraphElement;

async function main() {
  const [world, user] = await Promise.all([World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions), currentUser()]);
  world.registerSystem(ClickSystem);
  world.registerSystem(PinchGrabSystem);

  const app = new App(world, new DataSource(user));
  app.register('hub', hubScreen);
  app.register('sentence', sentenceScreen);
  app.register('listening', listeningScreen);
  app.register('interview', interviewScreen);
  await app.loadImages();
  app.open('hub');

  who.textContent = user ? `Signed in${user.name ? ` as ${user.name}` : ''}: you will practise with your own study-plan questions.` : 'Not signed in: you will try the demo questions.';
  backLink.href = user ? '/dashboard' : '/';

  const xrOk = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)));
  if (!xrOk) {
    enterBtn.disabled = true;
    note.textContent = 'VR is not available in this browser. Open lafaektoefl.tech/vr in the Meta Quest browser, or preview it here with your mouse.';
  }
  enterBtn.addEventListener('click', () => {
    app.sound.resume();
    world.launchXR();
  });
  previewBtn.addEventListener('click', () => {
    app.sound.resume();
    overlay.hidden = true;
  });
  world.visibilityState.subscribe((state) => {
    overlay.hidden = state !== VisibilityState.NonImmersive ? true : overlay.hidden;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !world.session) overlay.hidden = false;
  });
  overlay.classList.add('ready');
}

main().catch((e) => {
  console.error(e);
  note.textContent = 'The study room could not start. Please reload the page.';
});
