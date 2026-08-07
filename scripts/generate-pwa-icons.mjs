// One-off icon generator: renders an SVG app icon to PNG at the sizes a PWA manifest
// needs, using the Playwright/Chromium already installed as a devDependency (no new
// image-processing package required just for this).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#059669"/>
  <path d="M256 96c-70.7 0-128 57.3-128 128 0 96 128 224 128 224s128-128 128-224c0-70.7-57.3-128-128-128z" fill="#ffffff"/>
  <circle cx="256" cy="224" r="56" fill="#059669"/>
</svg>
`;

const sizes = [
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { size, file } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size)}</body></html>`);
  const el = await page.$('svg');
  const buffer = await el.screenshot({ omitBackground: false });
  writeFileSync(join(outDir, file), buffer);
  console.log('wrote', file);
}

await browser.close();
