/**
 * Reading: Read in Daily Life (an email, notice or chat) and Read an Academic Passage. The text
 * hangs on the left as a readable floating page (pinch the page buttons to turn it); the question
 * and four answer cards sit on the right. Answers are checked and saved by the LafaekTOEFL API.
 */
import type { ScreenFactory } from './app.js';
import { resumeBar } from './resume.js';
import { errorMessage, type ReadingItem, type ReadingSlug } from './data.js';
import { Button, C, font, OptionCard, roundRect, wrap, type Ctx } from './ui.js';

interface Line {
  text: string;
  size: number;
  weight: number;
  color: string;
  /** Extra space above this line (px). */
  gap: number;
  /** Chat: draw the line inside a bubble. */
  bubble?: boolean;
}

const PASSAGE = { w: 0.66, h: 0.62, x: -0.37, y: 1.2, z: -0.92 };
const QUESTION = { x: 0.4, z: -0.9 };

/** Turns a reading item into styled lines that fit the page width. */
function layout(ctx: Ctx, item: ReadingItem, maxW: number): Line[] {
  const out: Line[] = [];
  const add = (text: string, size: number, weight: number, color: string, gap = 0, bubble = false) => {
    ctx.font = font(size, weight);
    const words = text.split(/\s+/).filter(Boolean);
    let line = '';
    let first = true;
    const width = bubble ? maxW - 40 : maxW;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        out.push({ text: line, size, weight, color, gap: first ? gap : 0, bubble });
        first = false;
        line = word;
      } else line = test;
    }
    if (line) out.push({ text: line, size, weight, color, gap: first ? gap : 0, bubble });
  };
  const doc = item.document;
  if (doc?.type === 'email') {
    add(`From: ${doc.from}`, 24, 700, C.muted);
    add(`To: ${doc.to}`, 24, 700, C.muted);
    add(doc.subject, 30, 800, C.ink, 10);
    doc.body.forEach((p) => add(p, 27, 500, C.ink, 14));
    add(doc.signOff, 27, 600, C.ink, 14);
  } else if (doc?.type === 'notice') {
    add(doc.heading, 34, 800, C.writing);
    doc.body.forEach((p) => add(p, 27, 500, C.ink, 14));
    if (doc.footer) add(doc.footer, 24, 600, C.muted, 14);
  } else if (doc?.type === 'chat') {
    add(doc.title, 30, 800, C.ink);
    for (const m of doc.messages) {
      add(`${m.sender}  ·  ${m.time}`, 21, 800, C.primary, 14);
      add(m.text, 26, 500, C.ink, 4, true);
    }
  } else {
    add(item.title, 32, 800, C.ink);
    (item.paragraphs ?? []).forEach((p) => add(p, 26, 500, C.ink, 16));
  }
  return out;
}

/** Splits lines into pages that fit the given height. */
function paginate(lines: Line[], height: number): Line[][] {
  const pages: Line[][] = [[]];
  let used = 0;
  for (const l of lines) {
    const h = l.gap + l.size * 1.35 + (l.bubble ? 8 : 0);
    if (used + h > height && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(pages[pages.length - 1].length ? l : { ...l, gap: 0 });
    used += h;
  }
  return pages;
}

export const makeReadingScreen =
  (slug: ReadingSlug, label: string): ScreenFactory =>
  (app, scope) => {
    let items: ReadingItem[] = [];
    let index = 0;
    let q = 0;
    let correctCount = 0;
    let pages: Line[][] = [];
    let page = 0;
    let nextItemPending = false;

    const passage = scope.panel(PASSAGE.w, PASSAGE.h, PASSAGE.x, PASSAGE.y, PASSAGE.z).panel;
    const info = scope.panel(0.5, 0.21, QUESTION.x, 1.4, QUESTION.z).panel;
    // "Welcome back": progress since the last Start over, like the website.
    const bar = resumeBar(app, scope, slug);
    const options = [0, 1, 2, 3].map(
      (i) => new OptionCard(app.sound, scope, i, QUESTION.x, 1.235 - i * 0.095, QUESTION.z, () => void answer(i), { w: 0.5, h: 0.082 }),
    );
    const prev = new Button(scope, { w: 0.2, h: 0.07, label: 'Prev page', icon: app.icon('ctl-back'), tone: 'ghost', enabled: false }, PASSAGE.x - 0.22, 0.86, -0.88, () => turn(-1));
    const nextPage = new Button(scope, { w: 0.2, h: 0.07, label: 'Next page', icon: app.icon('next'), tone: 'ghost', enabled: false }, PASSAGE.x + 0.22, 0.86, -0.88, () => turn(1));
    new Button(scope, { w: 0.17, h: 0.07, label: 'Back', icon: app.icon('ctl-back'), tone: 'ghost' }, 0.12, 0.86, -0.86, () => app.goHub());
    const next = new Button(scope, { w: 0.2, h: 0.07, label: 'Next', icon: app.icon('next'), tone: 'primary' }, 0.5, 0.86, -0.86, () => {
      if (nextItemPending) {
        nextItemPending = false;
        index++;
        loadItem();
      } else nextQuestion();
    });
    next.visible = false;

    const drawPassage = () => {
      const item = items[index];
      passage.draw((ctx, W, H) => {
        passage.card();
        ctx.fillStyle = C.primary;
        ctx.font = font(22, 800);
        ctx.fillText(label.toUpperCase(), 36, 24);
        if (pages.length > 1) {
          ctx.textAlign = 'right';
          ctx.fillStyle = C.muted;
          ctx.font = font(21, 700);
          ctx.fillText(`Page ${page + 1} of ${pages.length}`, W - 36, 24);
          ctx.textAlign = 'left';
        }
        if (!item) return;
        let y = 70;
        for (const l of pages[page] ?? []) {
          y += l.gap;
          ctx.font = font(l.size, l.weight);
          if (l.bubble) {
            const tw = ctx.measureText(l.text).width + 32;
            roundRect(ctx, 36, y - 4, tw, l.size * 1.35 + 4, 14);
            ctx.fillStyle = C.soft;
            ctx.fill();
            ctx.fillStyle = l.color;
            ctx.fillText(l.text, 52, y);
          } else {
            ctx.fillStyle = l.color;
            ctx.fillText(l.text, 36, y);
          }
          y += l.size * 1.35 + (l.bubble ? 8 : 0);
        }
        void H;
      });
    };

    const turn = (dir: number) => {
      page = Math.max(0, Math.min(pages.length - 1, page + dir));
      app.sound.play('whoosh', 0.3);
      prev.update({ enabled: page > 0 });
      nextPage.update({ enabled: page < pages.length - 1 });
      drawPassage();
    };

    const drawInfo = (draw: (ctx: Ctx, W: number) => void, counter?: string) =>
      info.draw((ctx, W) => {
        info.card();
        if (counter) {
          ctx.fillStyle = C.muted;
          ctx.font = font(21, 800);
          ctx.fillText(counter, 32, 22);
        }
        draw(ctx, W);
      });

    const drawResult = (ok: boolean, title: string, body: string, counter?: string) =>
      drawInfo((ctx, W) => {
        ctx.beginPath();
        ctx.arc(52, 78, 19, 0, Math.PI * 2);
        ctx.fillStyle = ok ? C.success : C.danger;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (ok) {
          ctx.moveTo(43, 78);
          ctx.lineTo(50, 85);
          ctx.lineTo(62, 71);
        } else {
          ctx.moveTo(45, 71);
          ctx.lineTo(59, 85);
          ctx.moveTo(59, 71);
          ctx.lineTo(45, 85);
        }
        ctx.stroke();
        ctx.fillStyle = ok ? C.success : C.danger;
        ctx.font = font(30, 800);
        ctx.textBaseline = 'middle';
        ctx.fillText(title, 84, 79);
        ctx.textBaseline = 'top';
        ctx.fillStyle = C.body;
        ctx.font = font(22, 500);
        wrap(ctx, body, 32, 112, W - 64, 27, 3);
      }, counter);

    const message = (text: string, color: string = C.ink) =>
      drawInfo((ctx, W) => {
        ctx.fillStyle = color;
        ctx.font = font(28, 700);
        wrap(ctx, text, 32, 56, W - 64, 34, 4);
      });

    const showQuestion = () => {
      const item = items[index];
      const question = item.questions[q];
      next.visible = false;
      drawInfo((ctx, W) => {
        ctx.fillStyle = C.ink;
        ctx.font = font(28, 800);
        wrap(ctx, question.prompt, 32, 56, W - 64, 34, 4);
      }, `Question ${q + 1} of ${item.questions.length}`);
      options.forEach((o, i) => {
        const opt = question.options[i];
        o.visible = Boolean(opt);
        if (opt) o.set(opt.id, opt.text);
      });
      app.sound.play('appear', 0.3);
    };

    const loadItem = () => {
      // Continue at the first question not answered yet.
      q = app.data.firstOpen(slug, items[index].itemId, items[index].questions.map((x) => x.unitId));
      correctCount = 0;
      page = 0;
      const ctx = document.createElement('canvas').getContext('2d')!;
      pages = paginate(layout(ctx, items[index], PASSAGE.w * 1000 - 72), PASSAGE.h * 1000 - 150);
      prev.update({ enabled: false });
      nextPage.update({ enabled: pages.length > 1 });
      drawPassage();
      showQuestion();
    };

    const answer = async (i: number) => {
      const item = items[index];
      const question = item.questions[q];
      const opt = question.options[i];
      if (!opt) return;
      options.forEach((o) => o.setEnabled(false));
      options[i].setState('selected');
      app.sound.play('click', 0.4);
      message('Checking your answer…', C.primary);
      const counter = `Question ${q + 1} of ${item.questions.length}`;
      try {
        const r = await app.data.check(item.itemId, question.unitId, opt.id);
        if (r.correct) correctCount++;
        app.sound.play(r.correct ? 'done' : 'toggle', 0.5);
        const right = question.options.findIndex((o) => o.id === r.answer || o.text === r.answer);
        options.forEach((o, k) => o.setState(k === i ? (r.correct ? 'correct' : 'wrong') : k === right ? 'correct' : 'dim'));
        drawResult(Boolean(r.correct), r.correct ? 'Correct!' : 'Not quite.', r.explanation ?? '', counter);
        next.update({ label: q + 1 < item.questions.length ? 'Next' : 'Finish' });
        next.visible = true;
      } catch (e) {
        message(errorMessage(e), C.danger);
        options.forEach((o) => {
          o.setState('idle');
          o.setEnabled(true);
        });
      }
    };

    const nextQuestion = () => {
      const item = items[index];
      if (q + 1 < item.questions.length) {
        q++;
        showQuestion();
        return;
      }
      options.forEach((o) => (o.visible = false));
      next.visible = false;
      app.completeActivity();
      drawResult(
        correctCount === item.questions.length,
        `You got ${correctCount} of ${item.questions.length} right.`,
        index + 1 < items.length ? 'Pinch Next for another text, or Back for the other activities.' : 'Nice work. Pinch Back for the other activities.',
      );
      if (index + 1 < items.length) {
        next.update({ label: 'Next' });
        next.visible = true;
        nextItemPending = true;
      }
    };

    return {
      async start() {
        message('Loading your reading questions…', C.primary);
        try {
          items = await app.data.reading(slug);
          bar.update();
          if (!items.length) {
            message('These questions are not ready yet. They appear here as soon as your study plan finishes making them. Try another activity or come back in a few minutes.', C.muted);
            return;
          }
          loadItem();
        } catch (e) {
          message(errorMessage(e), C.danger);
        }
      },
      dispose() {},
    };
  };
