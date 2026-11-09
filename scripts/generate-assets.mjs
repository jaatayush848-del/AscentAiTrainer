#!/usr/bin/env node
/**
 * generate-assets.mjs
 *
 * Builds the app icon, adaptive (Android) icon, monochrome icon and splash
 * image as real PNG files, using only Node's built-in `zlib`. No npm packages,
 * no image libraries, nothing to install.
 *
 * The design is an original "ascent chevron" — two strokes rising to an apex
 * with a crossbar, which also reads as a letter A — so the app ships no
 * third-party artwork.
 *
 * Run once from the project root:
 *
 *     node scripts/generate-assets.mjs
 *
 * The files are written to `assets/` and referenced by `app.json`. The app does
 * not need this at runtime; run it again only if you change the artwork or the
 * colours below.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets');
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ *
 * PNG encoder
 * ------------------------------------------------------------------ */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode an RGBA pixel buffer (width*height*4) as a PNG buffer. */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */

const TOP = [12, 18, 42];
const BOTTOM = [5, 6, 10];
const BLUE = [63, 169, 255];
const GOLD = [255, 204, 77];
const WHITE = [245, 247, 255];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Unit-space design: an "A" that doubles as an upward chevron. */
const BLUE_STROKES = [[0.28, 0.78, 0.5, 0.36]];
const GOLD_LEG = [[0.5, 0.36, 0.74, 0.72]];
const GOLD_BAR = [[0.374, 0.6, 0.66, 0.6]];

/**
 * Render the mark.
 *   scale       – how large the glyph is relative to the canvas
 *   transparent – drop the background (adaptive / monochrome / splash)
 *   mono        – paint the whole glyph white (Android themed icons)
 *   glow        – radial accent glow behind the mark (opaque icons only)
 */
function render(size, { scale = 1, transparent = false, mono = false, glow = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling per axis (anti-aliasing)
  const thBlue = 0.078 * size;
  const thGold = 0.072 * size;
  const thBar = 0.056 * size;

  const pt = (u, v) => [0.5 * size + (u - 0.5) * size * scale, 0.5 * size + (v - 0.5) * size * scale];
  const scaled = (list) => list.map(([u1, v1, u2, v2]) => [...pt(u1, v1), ...pt(u2, v2)]);

  const blue = scaled(BLUE_STROKES);
  const goldLeg = scaled(GOLD_LEG);
  const goldBar = scaled(GOLD_BAR);

  const distList = (px, py, list) => {
    let d = Infinity;
    for (const s of list) d = Math.min(d, distToSegment(px, py, s[0], s[1], s[2], s[3]));
    return d;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let bCov = 0;
      let gCov = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (distList(px, py, blue) <= thBlue / 2) bCov += 1;
          const dg = Math.min(distList(px, py, goldLeg), distList(px, py, goldBar));
          const limit = distList(px, py, goldBar) <= distList(px, py, goldLeg) ? thBar : thGold;
          if (dg <= limit / 2) gCov += 1;
        }
      }
      const total = SS * SS;
      bCov /= total;
      gCov /= total;

      // Monochrome icons are an alpha mask of the whole glyph in a single
      // colour; Android tints them, so never emit the two-tone here.
      if (mono) {
        const cov = Math.max(bCov, gCov);
        const o = (y * size + x) * 4;
        rgba[o] = WHITE[0];
        rgba[o + 1] = WHITE[1];
        rgba[o + 2] = WHITE[2];
        rgba[o + 3] = Math.round(cov * 255);
        continue;
      }

      let r;
      let g;
      let b;
      let a;
      if (transparent) {
        r = BLUE[0];
        g = BLUE[1];
        b = BLUE[2];
        a = 0;
      } else {
        const t = y / (size - 1);
        let c = mix(TOP, BOTTOM, t);
        if (glow) {
          const dx = (x - size * 0.5) / (size * 0.62);
          const dy = (y - size * 0.42) / (size * 0.62);
          c = mix(c, BLUE, 0.3 * Math.max(0, 1 - (dx * dx + dy * dy)));
        }
        r = c[0];
        g = c[1];
        b = c[2];
        a = 1;
      }

      r = lerp(r, BLUE[0], bCov);
      g = lerp(g, BLUE[1], bCov);
      b = lerp(b, BLUE[2], bCov);
      r = lerp(r, GOLD[0], gCov);
      g = lerp(g, GOLD[1], gCov);
      b = lerp(b, GOLD[2], gCov);
      if (transparent) a = Math.max(bCov, gCov);

      const o = (y * size + x) * 4;
      rgba[o] = Math.round(r);
      rgba[o + 1] = Math.round(g);
      rgba[o + 2] = Math.round(b);
      rgba[o + 3] = Math.round(a * 255);
    }
  }
  return rgba;
}

function write(name, buffer) {
  writeFileSync(join(outDir, name), buffer);
  console.log(`  wrote assets/${name} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

console.log('Generating Ascent AI Trainer assets...');
write('icon.png', encodePng(1024, 1024, render(1024, { scale: 0.92 })));
write('adaptive-icon.png', encodePng(1024, 1024, render(1024, { scale: 0.6, transparent: true })));
write('monochrome-icon.png', encodePng(1024, 1024, render(1024, { scale: 0.6, transparent: true, mono: true })));
write('splash.png', encodePng(1024, 1024, render(1024, { scale: 0.42, transparent: true })));
console.log('Done. Rebuild the app to pick up the new icons.');
