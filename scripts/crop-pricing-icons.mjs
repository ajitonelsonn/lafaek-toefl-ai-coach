// Crops the pricing icons from the owner's icon sheet (logo_icon/price_icon.png, not in git).
// Each icon is found inside a rough box by its solid pixels (alpha ≥ 150), cropped with padding,
// and the soft coloured glow around it is faded out so it sits cleanly on light tiles.
// Run: node scripts/crop-pricing-icons.mjs   (outputs to public/assets/pricing/)
import sharp from "sharp";

const SRC = "logo_icon/price_icon.png";
const OUT = "public/assets/pricing";
// Rough search boxes [left, top, right, bottom] on the 1536×1024 sheet.
const ICONS = {
  starter: [15, 60, 245, 330], // green dino
  boost: [250, 70, 465, 315], // rocket (left edge clear of the dino tail)
  "open-source": [462, 100, 695, 320], // laptop with GitHub mark
  crown: [688, 105, 875, 305],
  check: [15, 600, 140, 740],
  mail: [240, 785, 390, 925],
  code: [1385, 595, 1525, 735],
};

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const alphaAt = (x, y) => data[(y * W + x) * 4 + 3];

for (const [name, [l, t, r, b]] of Object.entries(ICONS)) {
  let minX = r, minY = b, maxX = l, maxY = t;
  for (let y = t; y < b; y++)
    for (let x = l; x < r; x++)
      if (alphaAt(x, y) >= 150) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const pad = 6;
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  const width = Math.min(W - left, maxX - minX + 1 + pad * 2), height = Math.min(info.height - top, maxY - minY + 1 + pad * 2);
  const { data: px, info: ci } = await sharp(SRC).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Fade the glow: alpha below 150 → 0, 150–235 ramps up, above stays.
  for (let i = 3; i < px.length; i += 4) px[i] = px[i] < 150 ? 0 : px[i] > 235 ? px[i] : Math.round(((px[i] - 150) / 85) * 255);
  const side = Math.max(ci.width, ci.height);
  await sharp(px, { raw: { width: ci.width, height: ci.height, channels: 4 } })
    .extend({ top: Math.floor((side - ci.height) / 2), bottom: Math.ceil((side - ci.height) / 2), left: Math.floor((side - ci.width) / 2), right: Math.ceil((side - ci.width) / 2), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${name}.png`);
  console.log(`${name}: box ${left},${top} ${width}×${height} → ${OUT}/${name}.png`);
}
