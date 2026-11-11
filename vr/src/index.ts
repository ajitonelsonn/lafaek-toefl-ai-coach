/**
 * LafaekTOEFL Study Room: entry point. Creates the IWSDK world, registers systems and screens,
 * and wires the 2D overlay. The room uses the learner's own study-plan questions, so the overlay
 * asks visitors to sign in (or create a plan) before they can enter.
 */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { App, hubScreen } from './app.js';
import { ClickSystem } from './clicks.js';
import { currentUser, DataSource, hasStudyPlan } from './data.js';
import { interviewScreen } from './interview.js';
import { listeningScreen } from './listening.js';
import { PinchGrabSystem, sentenceScreen } from './sentence.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const overlay = $<HTMLDivElement>('overlay');
const enterBtn = $<HTMLButtonElement>('enter-vr');
const previewBtn = $<HTMLButtonElement>('preview');
const note = $<HTMLParagraphElement>('note');
const who = $<HTMLParagraphElement>('who');

/** Shows one of the overlay's action groups: ready, need-login or need-plan. */
function showActions(id: 'ready' | 'need-login' | 'need-plan'): void {
  for (const group of ['ready', 'need-login', 'need-plan']) $(group).hidden = group !== id;
  $('hint').hidden = id !== 'ready';
}

async function main() {
  const [world, user] = await Promise.all([World.create($<HTMLDivElement>('scene-container'), projectOptions), currentUser()]);
  world.registerSystem(ClickSystem);
  world.registerSystem(PinchGrabSystem);

  const app = new App(world, new DataSource(user));
  app.register('hub', hubScreen);
  app.register('sentence', sentenceScreen);
  app.register('listening', listeningScreen);
  app.register('interview', interviewScreen);
  await app.loadImages();
  app.open('hub');
  overlay.classList.add('ready');

  if (!user) {
    who.textContent = 'Sign in to practise in the study room. It uses the questions from your own study plan, so new learners create a free account and a study plan first.';
    showActions('need-login');
    return;
  }
  if (!(await hasStudyPlan())) {
    who.textContent = `Hi ${user.name?.split(' ')[0] ?? 'there'}! Create your study plan first. The study room uses the questions made for your plan.`;
    showActions('need-plan');
    return;
  }

  who.textContent = `Signed in${user.name ? ` as ${user.name}` : ''}: you will practise with your own study-plan questions.`;
  showActions('ready');
  const xrOk = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)));
  if (!xrOk) {
    enterBtn.disabled = true;
    note.textContent = 'Enter VR needs a VR headset. Open lafaektoefl.tech/vr in the Meta Quest browser, or use Preview to try it here with your mouse.';
  }
  enterBtn.addEventListener('click', () => {
    app.sound.resume();
    world.launchXR();
  });
  previewBtn.addEventListener('click', () => {
    app.sound.resume();
    overlay.hidden = true;
  });
  world.visibilityState.subscribe(() => {
    if (world.session) overlay.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !world.session) overlay.hidden = false;
  });
}

main().catch((e) => {
  console.error(e);
  note.textContent = 'The study room could not start. Please reload the page.';
});
