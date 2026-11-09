/**
 * Progress imagery.
 *
 * Two ways the app "shows you your progress as an image":
 *
 *  1. AI illustration — ask an image-capable model on the gateway for a
 *     motivational hero image from the coach's `imagePrompt`. Any OpenAI-style
 *     `/images/generations` endpoint works; the model id is configurable.
 *
 *  2. Offline poster — always available, no network, no cost. Builds an SVG
 *     "transformation card" from the user's real stats (weight delta, day X of
 *     Y, rank, streak, AI headline) that can be shown in-app and shared.
 */

import * as FileSystem from 'expo-file-system';
import { PosterStats, UserLevel } from '../types';

export type { PosterStats };

/* ------------------------------------------------------------------ *
 * AI image generation via an OpenAI-compatible images endpoint
 * ------------------------------------------------------------------ */

export interface ImageGenOptions {
  apiKey: string;
  baseUrl: string;
  /** e.g. an image model id available on the gateway */
  model: string;
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  signal?: AbortSignal;
}

export interface ImageGenResult {
  /** remote url or data: URI */
  url: string;
  revisedPrompt?: string;
}

export async function generateImage(opts: ImageGenOptions): Promise<ImageGenResult> {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      size: opts.size ?? '1024x1024',
      n: 1,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`Image generation failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const json = (await res.json()) as any;
  const item = json?.data?.[0];
  const url: string | undefined = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined);
  if (!url) throw new Error('Image endpoint returned no image');
  return { url, revisedPrompt: item?.revised_prompt };
}

/** Download a remote image into the app's document directory and return its uri. */
export async function cacheImage(url: string, name: string): Promise<string> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1] ?? '';
    const dest = `${FileSystem.documentDirectory}${name}.png`;
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest;
  }
  const dest = `${FileSystem.documentDirectory}${name}.png`;
  const dl = await FileSystem.downloadAsync(url, dest);
  return dl.uri;
}

/* ------------------------------------------------------------------ *
 * Offline SVG transformation poster
 * ------------------------------------------------------------------ */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(text: string, perLine: number, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > perLine) {
      lines.push(cur.trim());
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur.trim());
  return lines;
}

/** Build the SVG markup for a shareable progress poster (1080x1350). */
export function buildPosterSvg(stats: PosterStats): string {
  const W = 1080;
  const H = 1350;
  const lost = stats.startWeightKg - stats.currentWeightKg;
  const progress = Math.max(0, Math.min(1, stats.dayNumber / Math.max(1, stats.totalDays)));
  const encouragement = wrap(stats.encouragement, 34, 3);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1024"/>
      <stop offset="1" stop-color="#05060a"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3fa9ff"/>
      <stop offset="1" stop-color="#ffcc4d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.15" r="0.8">
      <stop offset="0" stop-color="#3fa9ff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#3fa9ff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <text x="64" y="120" fill="#ffcc4d" font-family="sans-serif" font-size="34" font-weight="700" letter-spacing="6">ASCENT · TRANSFORMATION</text>
  <text x="64" y="196" fill="#f5f7ff" font-family="sans-serif" font-size="66" font-weight="800">${esc(stats.name)}</text>
  <text x="64" y="248" fill="#9aa3c0" font-family="sans-serif" font-size="32">Day ${stats.dayNumber} of ${stats.totalDays}</text>

  <g transform="translate(64,300)">
    <rect x="0" y="0" width="952" height="14" rx="7" fill="#232a44"/>
    <rect x="0" y="0" width="${Math.round(952 * progress)}" height="14" rx="7" fill="url(#bar)"/>
  </g>

  <g transform="translate(64,380)">
    <rect x="0" y="0" width="300" height="200" rx="24" fill="#111524" stroke="#232a44"/>
    <text x="32" y="70" fill="#9aa3c0" font-family="sans-serif" font-size="26">WEIGHT</text>
    <text x="32" y="140" fill="#f5f7ff" font-family="sans-serif" font-size="64" font-weight="800">${stats.currentWeightKg.toFixed(1)}<tspan font-size="30" fill="#9aa3c0"> kg</tspan></text>
    <text x="32" y="180" fill="#39d98a" font-family="sans-serif" font-size="28">${lost >= 0 ? '−' : '+'}${Math.abs(lost).toFixed(1)} kg</text>

    <rect x="326" y="0" width="300" height="200" rx="24" fill="#111524" stroke="#232a44"/>
    <text x="358" y="70" fill="#9aa3c0" font-family="sans-serif" font-size="26">RANK</text>
    <text x="358" y="160" fill="#ffcc4d" font-family="sans-serif" font-size="86" font-weight="800">${esc(stats.rank)}</text>

    <rect x="652" y="0" width="300" height="200" rx="24" fill="#111524" stroke="#232a44"/>
    <text x="684" y="70" fill="#9aa3c0" font-family="sans-serif" font-size="26">STREAK</text>
    <text x="684" y="160" fill="#3fa9ff" font-family="sans-serif" font-size="86" font-weight="800">${stats.streak}<tspan font-size="30" fill="#9aa3c0">d</tspan></text>
  </g>

  <g transform="translate(64,640)">
    <rect x="0" y="0" width="952" height="360" rx="28" fill="#0c0f18" stroke="#3fa9ff" stroke-opacity="0.5"/>
    <text x="40" y="70" fill="#3fa9ff" font-family="sans-serif" font-size="30" font-weight="700">AI COACH · SCORE ${stats.score}/100</text>
    <text x="40" y="150" fill="#f5f7ff" font-family="sans-serif" font-size="46" font-weight="800">${esc(stats.headline)}</text>
    ${encouragement
      .map(
        (line, i) =>
          `<text x="40" y="${230 + i * 52}" fill="#9aa3c0" font-family="sans-serif" font-size="36">${esc(line)}</text>`,
      )
      .join('\n    ')}
  </g>

  <text x="64" y="1280" fill="#5f6884" font-family="sans-serif" font-size="26">Target ${stats.targetWeightKg.toFixed(1)} kg · Level ${stats.level} · Made with Ascent</text>
</svg>`;
}

/** Persist the poster SVG and return a file uri. */
export async function savePoster(stats: PosterStats, name = `progress_${Date.now()}`): Promise<string> {
  const svg = buildPosterSvg(stats);
  const dest = `${FileSystem.documentDirectory}${name}.svg`;
  await FileSystem.writeAsStringAsync(dest, svg);
  return dest;
}

export function levelToPosterStats(
  base: Omit<PosterStats, 'rank' | 'level' | 'streak'>,
  level: UserLevel,
  streak: number,
): PosterStats {
  return { ...base, rank: level.rank, level: level.level, streak };
}
