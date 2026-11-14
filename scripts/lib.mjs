// Shared drawing kit: palette, fonts, text-to-path and common SVG pieces.
//
// GitHub strips CSS/JS from READMEs, but an SVG loaded through <img> keeps its
// own <style> animations and SMIL. Those images cannot fetch fonts, so all text
// is converted to vector glyphs with the portfolio's real typefaces.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(ROOT, '..', 'assets');
const CACHE = path.join(ROOT, '.cache');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// Portfolio palette (src/index.css): black canvas, zinc borders, aged gold.
export const C = {
  bg: '#000000',
  panel: '#050505',
  bar: '#0a0a0a',
  border: '#27272a',
  dim: '#3f3f46',
  muted: '#71717a',
  text: '#f5f5f5',
  gold: '#c9aa6e',
  goldLight: '#e3c98b',
  sepia: '#9c7a3c',
  cream: '#f3ead2',
};
export const W = 1000;
export const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$/\\|<>=+*-_[]{}?!';

// ─── IO ──────────────────────────────────────────────────────────────────────

export async function cached(url, name) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

async function loadFont(url, name) {
  const buf = await cached(url, name);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const r2 = (n) => Math.round(n * 100) / 100;

// Deterministic randomness: rebuilding without changes yields identical files.
export function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// ─── Fonts & text-to-path ────────────────────────────────────────────────────

const GF = 'https://fonts.gstatic.com/s/';
export const F = {
  light: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj62UUsj.ttf`, 'sg-300.ttf'),
  regular: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf`, 'sg-400.ttf'),
  medium: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf`, 'sg-500.ttf'),
  bold: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf`, 'sg-700.ttf'),
  serif: await loadFont(`${GF}playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf`, 'pf-italic.ttf'),
  mono: await loadFont(`${GF}jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf`, 'jbm-400.ttf'),
  monoBold: await loadFont(`${GF}jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf`, 'jbm-700.ttf'),
};

export const hasGlyph = (font, ch) => font.charToGlyph(ch).index !== 0;

// Drops characters the font cannot draw (emoji in commit messages, etc.).
export const sanitize = (font, text) =>
  [...text].filter((ch) => !ch.trim() || hasGlyph(font, ch)).join('').replace(/\s+/g, ' ').trim();

export function glyphFor(font, ch) {
  const g = font.charToGlyph(ch);
  if (g.index === 0 && ch.trim()) console.warn(`  ! missing glyph "${ch}" in ${font.names.fullName.en}`);
  return g;
}

// Lays out a string glyph by glyph (kerning + tracking in em).
export function layout(font, text, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const chars = [...text];
  const glyphs = chars.map((ch) => glyphFor(font, ch));
  const out = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    out.push({ ch: chars[i], g, x });
    x += g.advanceWidth * scale;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
  });
  return { glyphs: out, width: x };
}

export const measure = (font, text, size, tracking = 0) => layout(font, text, size, tracking).width;

// Glyph outlines are defined once per document (at 1em = unitsPerEm) and
// placed with <use>, so repeated letters cost a few bytes instead of a path.
const glyphDefs = new Map();
function glyphRef(font, g) {
  const key = `${font.names.postScriptName.en}-${g.index}`;
  if (!glyphDefs.has(key)) glyphDefs.set(key, { id: `g${glyphDefs.size}`, d: g.getPath(0, 0, font.unitsPerEm).toPathData(0) });
  return glyphDefs.get(key);
}

// One <g> of <use> glyphs for a run of text. anchor: start | middle | end.
export function txt(font, text, x, y, size, { fill = C.text, opacity, tracking = 0, anchor = 'start', cls, style } = {}) {
  const { glyphs, width } = layout(font, text, size, tracking);
  const ox = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const s = size / font.unitsPerEm;
  const uses = glyphs
    .filter(({ ch }) => ch.trim())
    .map(({ g, x: gx }) => `<use href="#${glyphRef(font, g).id}" x="${Math.round(gx / s)}"/>`)
    .join('');
  if (!uses) return '';
  return `<g transform="translate(${r2(ox)} ${r2(y)}) scale(${+s.toFixed(5)})" fill="${fill}"${opacity != null ? ` fill-opacity="${opacity}"` : ''}${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${uses}</g>`;
}

// Sequential runs of differently styled text on one line: [{ t, font, size, ...opts }].
export function runs(parts, x, y) {
  let cx = x;
  return parts.map(({ t, font = F.mono, size = 14, tracking = 0, ...opts }) => {
    const out = txt(font, t, cx, y, size, { tracking, ...opts });
    cx += measure(font, t, size, tracking);
    return out;
  }).join('');
}

export function wrap(font, text, size, maxW, tracking = 0) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(font, next, size, tracking) > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function truncate(font, text, size, maxW) {
  if (measure(font, text, size) <= maxW) return text;
  let t = text;
  while (t.length && measure(font, `${t}…`, size) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// ─── Document ────────────────────────────────────────────────────────────────

export const svgOpen = (w, h, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`;

export function write(name, raw) {
  // Inject this document's glyph table right after <title>, then reset it.
  const defs = `<defs>${[...glyphDefs.values()].map(({ id, d }) => `<path id="${id}" d="${d}"/>`).join('')}</defs>`;
  glyphDefs.clear();
  const svg = raw.replace('</title>', `</title>${defs}`);
  const file = path.join(OUT, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg);
  console.log(`  ${name.padEnd(24)} ${(svg.length / 1024).toFixed(0).padStart(5)} KB`);
}

export const reducedMotion = (rules) => `@media (prefers-reduced-motion: reduce){${rules}}`;

const grainDefs = `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"/></filter>`;

// Rounded black frame with zinc border and film grain, like the portfolio canvas.
export const frame = (w, h, inner, { grain = true, rx = 20, extraDefs = '' } = {}) => `
<defs>${grainDefs}<clipPath id="frame"><rect width="${w}" height="${h}" rx="${rx}"/></clipPath>${extraDefs}</defs>
<g clip-path="url(#frame)">
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  ${inner}
  ${grain ? `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.06"/>` : ''}
</g>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="none" stroke="${C.border}"/>`;

// Terminal/editor window chrome: muted traffic lights + centered title.
export const chrome = (w, title, right = '') => `
<rect width="${w}" height="40" fill="${C.bar}"/>
<line x1="0" y1="40.5" x2="${w}" y2="40.5" stroke="${C.border}"/>
${[22, 42, 62].map((cx) => `<circle cx="${cx}" cy="20" r="5.5" fill="${C.border}"/>`).join('')}
${txt(F.mono, title, w / 2, 25, 12, { fill: C.text, opacity: 0.4, anchor: 'middle' })}
${right ? label(right, w - 22, 24, { fill: C.text, opacity: 0.3, size: 9.5, anchor: 'end' }) : ''}`;

// Small uppercase label, the portfolio's "text-[10px] uppercase tracking-widest".
export const label = (text, x, y, { fill = C.gold, opacity = 1, size = 11, anchor = 'start', cls, style } = {}) =>
  txt(F.medium, text.toUpperCase(), x, y, size, { fill, opacity, tracking: 0.28, anchor, cls, style });

export function chip(text, x, y, { size = 9.5, padX = 12, h = 26, fill = C.text, opacity = 0.8 } = {}) {
  const t = text.toUpperCase();
  const w = measure(F.medium, t, size, 0.14) + padX * 2;
  return {
    w,
    svg: `<rect x="${r2(x)}" y="${y}" width="${r2(w)}" height="${h}" rx="${h / 2}" fill="#ffffff" fill-opacity="0.03" stroke="${C.border}"/>${txt(F.medium, t, x + padX, y + h / 2 + size * 0.36, size, { fill, opacity, tracking: 0.14 })}`,
  };
}

// The portfolio's "*" motif: an eight-ray gold asterisk turning slowly.
export const asterisk = (cx, cy, r, { opacity = 0.55, dur = 40, width = 1.2 } = {}) => {
  const rays = Array.from({ length: 4 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const dx = r2(Math.cos(a) * r);
    const dy = r2(Math.sin(a) * r);
    return `<line x1="${r2(cx - dx)}" y1="${r2(cy - dy)}" x2="${r2(cx + dx)}" y2="${r2(cy + dy)}"/>`;
  }).join('');
  return `<g stroke="${C.goldLight}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}">
  ${rays}<circle cx="${cx}" cy="${cy}" r="${r2(r * 0.18)}" fill="none"/>
  <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>
</g>`;
};

// Drifting warm glow, standing in for the portfolio's WebGL shader backdrop.
export const glowDefs = `<radialGradient id="glow"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.2"/><stop offset="0.55" stop-color="${C.sepia}" stop-opacity="0.06"/><stop offset="1" stop-color="${C.sepia}" stop-opacity="0"/></radialGradient>`;
export const glow = (cx, cy, r, dx, dy, dur) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#glow)">
  <animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
</circle>`;

// Shared entrance used by most panels.
export const fadeCss = `
.in{opacity:0;animation:in 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`;
