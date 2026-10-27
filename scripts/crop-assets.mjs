// Derives UI assets from the supplied source images without modifying them.
// Sources: logo_icon/*.png and ilu/*.png. Outputs: public/assets/**.
// Every crop is listed in public/assets/ASSET_MANIFEST.md with its source and purpose.
//
// Run: npm run assets:crop
import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const src = (p) => path.join(root, p);
const out = (p) => path.join(root, "public/assets", p);

async function ensureDir(file) {
  await mkdir(path.dirname(file), { recursive: true });
}

async function crop(source, dest, { left, top, width, height }, { trim = false, resize } = {}) {
  const file = out(dest);
  await ensureDir(file);
  let img = sharp(src(source)).extract({ left, top, width, height });
  if (trim) {
    // Trim transparent padding only (threshold keeps soft anti-aliased edges).
    img = sharp(await img.png().toBuffer()).trim({ threshold: 1 });
  }
  if (resize) img = img.resize(resize);
  await img.png({ compressionLevel: 9 }).toFile(file);
  console.log("wrote", dest);
}

// ---------------------------------------------------------------------------
// 1. Logo (logo_icon/logo.png, 1254x1254, transparent)
//    Mascot + open book occupies rows 155-880; wordmark rows 885-1105.
// ---------------------------------------------------------------------------
async function logo() {
  const file = out("logo/logo.png");
  await ensureDir(file);
  await copyFile(src("logo_icon/logo.png"), file);
  console.log("copied logo/logo.png");
  await crop("logo_icon/logo.png", "logo/logo-full-trimmed.png", { left: 60, top: 150, width: 1140, height: 962 }, { trim: true });
  // The book tip (x 610-650) dips to row 882 while the wordmark starts at row 880,
  // so the mark stops at row 878 and the wordmark masks the tip pixels out.
  await crop("logo_icon/logo.png", "logo/logo-mark.png", { left: 160, top: 150, width: 940, height: 729 }, { trim: true });
  const wordmarkTop = 879;
  const tipMask = await sharp({
    create: { width: 44, height: 5, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const wordmark = await sharp(src("logo_icon/logo.png"))
    .extract({ left: 60, top: wordmarkTop, width: 1140, height: 233 })
    .composite([{ input: tipMask, left: 608 - 60, top: 0, blend: "dest-out" }])
    .png()
    .toBuffer();
  const wordmarkFile = out("logo/logo-wordmark.png");
  await sharp(wordmark).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toFile(wordmarkFile);
  console.log("wrote logo/logo-wordmark.png");
}

// ---------------------------------------------------------------------------
// 2. Background sheet (logo_icon/all_background.png, 1663x946, opaque)
//    White gutters were measured programmatically; each panel is inset 2px
//    so no gutter or caption text is included.
// ---------------------------------------------------------------------------
const backgroundPanels = [
  // top row: y 0-426, captions below y 427
  { name: "login", left: 0, right: 401, top: 0, bottom: 425 },
  { name: "signup", left: 413, right: 826, top: 0, bottom: 425 },
  { name: "otp", left: 839, right: 1243, top: 0, bottom: 425 },
  { name: "forgot-password", left: 1255, right: 1662, top: 0, bottom: 425 },
  // bottom row: y 488-882, captions below y 883
  { name: "dashboard", left: 0, right: 327, top: 489, bottom: 881 },
  { name: "progress", left: 335, right: 731, top: 489, bottom: 881 },
  { name: "resources", left: 742, right: 1009, top: 489, bottom: 881 },
  { name: "profile", left: 1020, right: 1327, top: 489, bottom: 881 },
  { name: "settings", left: 1339, right: 1662, top: 489, bottom: 881 },
];

async function backgrounds() {
  for (const p of backgroundPanels) {
    const inset = 2;
    const left = p.left + inset;
    const top = p.top + (p.top === 0 ? 0 : inset);
    const width = p.right - p.left - inset * 2;
    const height = p.bottom - top - inset;
    await crop("logo_icon/all_background.png", `backgrounds/${p.name}.png`, { left, top, width, height });
  }
  // Auth panels: illustration only, without the baked-in "LafaekTOEFL" wordmark
  // (the real logo is rendered above it in the layout).
  const sceneTop = { login: 140, signup: 150, otp: 150, "forgot-password": 140 };
  for (const p of backgroundPanels.slice(0, 4)) {
    const left = p.left + 2;
    const top = sceneTop[p.name];
    await crop("logo_icon/all_background.png", `backgrounds/${p.name}-scene.png`, {
      left,
      top,
      width: p.right - p.left - 4,
      height: p.bottom - top,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Icon sheet (logo_icon/all_icon.png, 1536x1024, transparent)
//    Icon rows (alpha bands) were measured; labels sit in separate bands, so
//    each crop is limited to an icon band and the label is never included.
//    Within each cell the alpha bounding box is computed from connected
//    components, discarding thin divider lines.
// ---------------------------------------------------------------------------
const iconRows = [
  { band: [75, 159], icons: [["home", 75], ["practice", 196], ["mock-test", 313], ["progress", 427], ["resources", 545], ["profile", 664], ["settings", 788], ["login", 943], ["signup", 1061], ["otp-verify", 1187], ["forgot-password", 1320], ["logout", 1460]] },
  { band: [273, 361], icons: [["listening", 82], ["reading", 204], ["speaking", 318], ["writing", 441], ["ai-practice", 568], ["ai-coach", 716], ["tips", 820], ["test-strategy", 929], ["feedback", 1041], ["discussion", 1155], ["saved", 1258], ["favorite", 1357], ["history", 1465]] },
  { band: [458, 527], icons: [["start", 74], ["pause", 180], ["stop", 284], ["next", 389], ["previous", 489], ["retry", 601], ["volume-on", 716], ["volume-off", 836], ["speed", 943], ["download", 1052], ["upload", 1161], ["share", 1267], ["edit", 1365], ["delete", 1470]] },
  { band: [615, 690], icons: [["success", 73], ["error", 174], ["warning", 277], ["info", 380], ["loading", 481], ["online", 587], ["offline", 687], ["premium", 793], ["streak", 897], ["achievement", 1013], ["goal", 1131], ["score", 1241], ["analytics", 1352], ["calendar", 1465]] },
  { band: [777, 839], icons: [["email", 71], ["password", 167], ["show", 270], ["hide", 367], ["user", 460], ["users", 552], ["key", 655], ["security", 757], ["phone", 859], ["message", 960], ["help", 1061], ["support", 1160], ["contact-admin", 1297], ["continue", 1471]] },
  { band: [919, 979], icons: [["video", 76], ["pdf", 177], ["link", 267], ["image", 366], ["document", 464], ["audio", 560], ["voice", 654], ["quiz", 748], ["practice-test", 850], ["score-chart", 952], ["report", 1050], ["website", 1157], ["external-link", 1277], ["search", 1379], ["filter", 1474]] },
];

function componentsBBox(data, W, x0, y0, x1, y1) {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const seen = new Uint8Array(w * h);
  const opaque = (x, y) => data[((y0 + y) * W + (x0 + x)) * 4 + 3] > 40;
  const boxes = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !opaque(x, y)) continue;
      let minX = x, maxX = x, minY = y, maxY = y, count = 0;
      const stack = [[x, y]];
      seen[y * w + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny * w + nx] || !opaque(nx, ny)) continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const thinLine = (bw <= 5 && bh > 25) || (bh <= 5 && bw > 25);
      if (count > 12 && !thinLine) boxes.push({ minX, maxX, minY, maxY });
    }
  }
  if (!boxes.length) return null;
  return {
    left: x0 + Math.min(...boxes.map((b) => b.minX)),
    right: x0 + Math.max(...boxes.map((b) => b.maxX)),
    top: y0 + Math.min(...boxes.map((b) => b.minY)),
    bottom: y0 + Math.max(...boxes.map((b) => b.maxY)),
  };
}

async function icons() {
  const sheet = src("logo_icon/all_icon.png");
  const { data, info } = await sharp(sheet).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  for (const row of iconRows) {
    const [bandTop, bandBottom] = row.band;
    for (let i = 0; i < row.icons.length; i++) {
      const [name, cx] = row.icons[i];
      const prev = row.icons[i - 1]?.[1] ?? cx - 120;
      const next = row.icons[i + 1]?.[1] ?? cx + 120;
      const x0 = Math.max(0, Math.round((prev + cx) / 2) + 1);
      const x1 = Math.min(W - 1, Math.round((cx + next) / 2) - 1);
      const box = componentsBBox(data, W, x0, bandTop - 4, x1, bandBottom + 4);
      if (!box) {
        console.warn("no icon found for", name);
        continue;
      }
      const pad = 4;
      const left = Math.max(x0, box.left - pad);
      const top = Math.max(bandTop - 6, box.top - pad);
      const right = Math.min(x1, box.right + pad);
      const bottom = Math.min(bandBottom + 6, box.bottom + pad);
      const width = right - left + 1;
      const height = bottom - top + 1;
      const size = Math.max(width, height);
      const file = out(`icons/${name}.png`);
      await ensureDir(file);
      await sharp(sheet)
        .extract({ left, top, width, height })
        .extend({
          top: Math.floor((size - height) / 2),
          bottom: Math.ceil((size - height) / 2),
          left: Math.floor((size - width) / 2),
          right: Math.ceil((size - width) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toFile(file);
      console.log("wrote", `icons/${name}.png`, `${size}x${size}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Visuals that only exist in the page screenshots (ilu/*.png).
//    Cropped at roughly 1x display size; used where the sheets have no match.
// ---------------------------------------------------------------------------
const screenshotCrops = [
  { source: "ilu/dashboard_page.png", dest: "crops/sidebar-motto.png", box: { left: 16, top: 762, width: 216, height: 152 } },
  { source: "ilu/Listen to a Conversation — Practice Page.png", dest: "crops/listening-conversation.png", box: { left: 312, top: 272, width: 526, height: 248 } },
  { source: "ilu/Listen to an Announcement — Practice Page.png", dest: "crops/listening-announcement.png", box: { left: 312, top: 272, width: 520, height: 240 } },
  { source: "ilu/Write an Email — Practice Page.png", dest: "crops/writing-email-hiking.png", box: { left: 312, top: 270, width: 366, height: 258 } },
  { source: "ilu/Listen and Repeat — Practice Page.png", dest: "crops/speaking-office-printer.png", box: { left: 646, top: 304, width: 330, height: 348 } },
  { source: "ilu/Vocabulary — Practice and Review.png", dest: "crops/vocabulary-environment.png", box: { left: 922, top: 396, width: 280, height: 288 } },
  { source: "ilu/Build a Sentence — Practice Page.png", dest: "crops/avatar-speaker-a.png", box: { left: 328, top: 330, width: 74, height: 74 } },
  { source: "ilu/Build a Sentence — Practice Page.png", dest: "crops/avatar-speaker-b.png", box: { left: 328, top: 411, width: 74, height: 74 } },
  { source: "ilu/Study Plan — Personalized TOEFL Learning.png", dest: "crops/header-study-plan.png", box: { left: 1120, top: 98, width: 172, height: 110 } },
  { source: "ilu/Vocabulary — Practice and Review.png", dest: "crops/header-vocabulary.png", box: { left: 1084, top: 100, width: 204, height: 96 } },
  { source: "ilu/Mock Test — Full TOEFL Practice Exam.png", dest: "crops/header-mock-test.png", box: { left: 1088, top: 88, width: 210, height: 130 } },
  { source: "ilu/Progress — Scores and Performance Analytics.png", dest: "crops/header-progress.png", box: { left: 1094, top: 92, width: 186, height: 100 } },
  { source: "ilu/reource-page.png", dest: "crops/header-usage.png", box: { left: 1092, top: 98, width: 180, height: 116 } },
];

async function screenshots() {
  for (const c of screenshotCrops) await crop(c.source, c.dest, c.box);
}

await logo();
await backgrounds();
await icons();
await screenshots();
