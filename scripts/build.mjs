// Generates the animated SVGs of the GitHub profile README in ../assets.
//
// GitHub strips CSS and JS from READMEs, but an SVG loaded through <img> keeps
// its own <style> animations and SMIL. Those images cannot fetch fonts or other
// URLs, so every piece of text is converted to vector paths with the
// portfolio's real typefaces, and every logo/screenshot is inlined as data URI.
//
// Usage: npm install && npm run build
// PORTFOLIO_DIR can point to the portfolio checkout (default: ../..).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import {
  PORTFOLIO_REPO, PROFILE, ABOUT, VISION, CTA, PROJECTS, EXPERIENCE, TECH_REELS,
} from './data.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', 'assets');
const CACHE = path.join(ROOT, '.cache');
const PORTFOLIO = process.env.PORTFOLIO_DIR ?? path.resolve(ROOT, PORTFOLIO_REPO);
const DEVICON = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/';

// Portfolio palette (src/index.css): black canvas, zinc borders, aged gold.
const C = {
  bg: '#000000',
  panel: '#050505',
  border: '#27272a',
  text: '#f5f5f5',
  gold: '#c9aa6e',
  goldLight: '#e3c98b',
  sepia: '#9c7a3c',
  cream: '#f3ead2',
  live: '#34d399',
};
const W = 1000;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$/\\|<>=+*-_[]{}?!';

// ─── IO helpers ──────────────────────────────────────────────────────────────

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(OUT, 'projects'), { recursive: true });

async function cached(url, name) {
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

const write = (name, raw) => {
  // Inject this document's glyph table right after <title>, then reset it.
  const defs = `<defs>${[...glyphDefs.values()].map(({ id, d }) => `<path id="${id}" d="${d}"/>`).join('')}</defs>`;
  glyphDefs.clear();
  const svg = raw.replace('</title>', `</title>${defs}`);
  fs.writeFileSync(path.join(OUT, name), svg);
  console.log(`  ${name.padEnd(34)} ${(svg.length / 1024).toFixed(0).padStart(5)} KB`);
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r2 = (n) => Math.round(n * 100) / 100;

// Deterministic randomness so rebuilding without changes yields identical files.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Fonts & text-to-path ────────────────────────────────────────────────────

const GF = 'https://fonts.gstatic.com/s/';
const F = {
  light: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj62UUsj.ttf`, 'sg-300.ttf'),
  regular: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf`, 'sg-400.ttf'),
  medium: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUUsj.ttf`, 'sg-500.ttf'),
  bold: await loadFont(`${GF}spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf`, 'sg-700.ttf'),
  serif: await loadFont(`${GF}playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf`, 'pf-italic.ttf'),
  mono: await loadFont(`${GF}jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf`, 'jbm-400.ttf'),
};

const glyphFor = (font, ch) => {
  const g = font.charToGlyph(ch);
  if (g.index === 0 && ch.trim()) console.warn(`  ! missing glyph "${ch}" in ${font.names.fullName.en}`);
  return g;
};

// Lays out a string glyph by glyph (kerning + tracking in em).
function layout(font, text, size, tracking = 0) {
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

const measure = (font, text, size, tracking = 0) => layout(font, text, size, tracking).width;

function pathData(font, text, x, y, size, tracking = 0) {
  return layout(font, text, size, tracking)
    .glyphs.map(({ g, x: gx }) => g.getPath(x + gx, y, size).toPathData(2))
    .join('');
}

// Glyph outlines are defined once per document (at 1em = unitsPerEm) and
// placed with <use>, so repeated letters cost a few bytes instead of a path.
const glyphDefs = new Map();
function glyphRef(font, g) {
  const key = `${font.names.postScriptName.en}-${g.index}`;
  if (!glyphDefs.has(key)) {
    const d = g.getPath(0, 0, font.unitsPerEm).toPathData(0);
    glyphDefs.set(key, { id: `g${glyphDefs.size}`, d });
  }
  return glyphDefs.get(key);
}

// One <g> of <use> glyphs for a run of text. anchor: start | middle | end.
function txt(font, text, x, y, size, { fill = C.text, opacity, tracking = 0, anchor = 'start', cls, style } = {}) {
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

function wrap(font, text, size, maxW, tracking = 0) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(font, next, size, tracking) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Shared SVG pieces ───────────────────────────────────────────────────────

const svgOpen = (w, h, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`;

const grainDefs = `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"/></filter>`;

// Rounded black frame with zinc border and film grain, like the portfolio canvas.
const frame = (w, h, inner, { grain = true, rx = 22, extraDefs = '' } = {}) => `
<defs>${grainDefs}<clipPath id="frame"><rect width="${w}" height="${h}" rx="${rx}"/></clipPath>${extraDefs}</defs>
<g clip-path="url(#frame)">
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  ${inner}
  ${grain ? `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.06"/>` : ''}
</g>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="none" stroke="${C.border}"/>`;

const reducedMotion = (rules) => `@media (prefers-reduced-motion: reduce){${rules}}`;

// Small uppercase label, the portfolio's "text-[10px] uppercase tracking-widest".
const label = (text, x, y, { fill = C.gold, opacity = 1, size = 11, anchor = 'start', cls, style } = {}) =>
  txt(F.medium, text.toUpperCase(), x, y, size, { fill, opacity, tracking: 0.28, anchor, cls, style });

function chip(text, x, y, { size = 10, padX = 14, h = 30 } = {}) {
  const w = measure(F.medium, text.toUpperCase(), size, 0.14) + padX * 2;
  return {
    w,
    svg: `<rect x="${r2(x)}" y="${y}" width="${r2(w)}" height="${h}" rx="8" fill="#ffffff" fill-opacity="0.03" stroke="${C.border}"/>${txt(F.medium, text.toUpperCase(), x + padX, y + h / 2 + size * 0.36, size, { fill: C.text, opacity: 0.8, tracking: 0.14 })}`,
  };
}

function chipRow(items, x, y, maxW, opts = {}) {
  let cx = x;
  let cy = y;
  const gap = 8;
  const parts = [];
  for (const it of items) {
    const { w } = chip(it, 0, 0, opts);
    if (cx + w > x + maxW && cx > x) { cx = x; cy += (opts.h ?? 30) + gap; }
    parts.push(chip(it, cx, cy, opts).svg);
    cx += w + gap;
  }
  return { svg: parts.join(''), bottom: cy + (opts.h ?? 30) };
}

// The portfolio's "*" motif: an eight-ray gold asterisk turning slowly.
const asterisk = (cx, cy, r, { opacity = 0.55, dur = 40 } = {}) => {
  const rays = Array.from({ length: 4 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const dx = r2(Math.cos(a) * r);
    const dy = r2(Math.sin(a) * r);
    return `<line x1="${cx - dx}" y1="${cy - dy}" x2="${cx + dx}" y2="${cy + dy}"/>`;
  }).join('');
  return `<g stroke="${C.goldLight}" stroke-width="1.2" stroke-linecap="round" opacity="${opacity}">
  ${rays}<circle cx="${cx}" cy="${cy}" r="${r2(r * 0.18)}" fill="none"/>
  <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>
</g>`;
};

// Drifting warm glow, standing in for the portfolio's WebGL shader backdrop.
const glowDefs = `<radialGradient id="glow"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.22"/><stop offset="0.55" stop-color="${C.sepia}" stop-opacity="0.06"/><stop offset="1" stop-color="${C.sepia}" stop-opacity="0"/></radialGradient>`;
const glow = (cx, cy, r, dx, dy, dur) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#glow)">
  <animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
</circle>`;

// ─── 1. Hero: "Software*Developer" signal decode ─────────────────────────────

function hero() {
  const H = 480;
  const size = 128;
  const tracking = -0.05;
  const x0 = 56;
  const baselines = [212, 318];
  const rand = rng(7);
  const start = 0.4;
  const stagger = 0.055;
  const churn = 0.34;
  const steps = 4;

  const scr = [];
  const fin = [];
  const split = [];
  const whole = [];
  let i = 0;
  let lastLock = 0;

  PROFILE.heroTitle.forEach((word, li) => {
    const text = word.toUpperCase();
    const { glyphs } = layout(F.bold, text, size, tracking);
    const y = baselines[li];
    for (const { g, x } of glyphs) {
      const gx = x0 + x;
      const appear = start + i * stagger;
      const lock = appear + churn + rand() * 0.06;
      lastLock = Math.max(lastLock, lock);
      for (let k = 0; k < steps; k++) {
        const ch = GLYPHS[Math.floor(rand() * GLYPHS.length)];
        const d = glyphFor(F.bold, ch).getPath(gx, y, size).toPathData(2);
        scr.push(`<path d="${d}" class="scr" style="animation-delay:${r2(appear + (k * churn) / steps)}s"/>`);
      }
      const d = g.getPath(gx, y, size).toPathData(2);
      fin.push(`<path d="${d}" class="fin" style="animation-delay:${r2(lock)}s"/>`);
      split.push(`<path d="${d}" class="sp sp1" style="animation-delay:${r2(lock)}s"/><path d="${d}" class="sp sp2" style="animation-delay:${r2(lock)}s"/>`);
      whole.push(d);
      i++;
    }
  });

  const decoded = r2(lastLock + 0.4);
  const allD = whole.join('');
  // Lean like the portfolio's italic title, pivoting on the last baseline so it keeps the margin.
  const skew = `translate(0 ${baselines[1]}) skewX(-9) translate(0 ${-baselines[1]})`;

  // Bottom row: tagline (left) + expertise chips (right).
  const lineY = 372;
  let tagSize = 19;
  const tagW = () =>
    measure(F.light, PROFILE.heroLine.pre, tagSize) +
    measure(F.serif, PROFILE.heroLine.em, tagSize + 2) +
    measure(F.light, PROFILE.heroLine.post, tagSize);
  while (tagW() > 470) tagSize -= 0.5;
  let tx = x0;
  const tag = [];
  tag.push(txt(F.light, PROFILE.heroLine.pre, tx, 428, tagSize, { opacity: 0.8 }));
  tx += measure(F.light, PROFILE.heroLine.pre, tagSize);
  tag.push(txt(F.serif, PROFILE.heroLine.em, tx, 428, tagSize + 2, { fill: C.cream }));
  tx += measure(F.serif, PROFILE.heroLine.em, tagSize + 2);
  tag.push(txt(F.light, PROFILE.heroLine.post, tx, 428, tagSize, { opacity: 0.8 }));

  const chips = chipRow(PROFILE.expertise, 560, 414, 400, { size: 9.5, h: 28 });

  const css = `
.scr{fill:${C.gold};opacity:0;filter:blur(.5px);animation:scr ${r2(churn / steps)}s linear none}
@keyframes scr{from,to{opacity:.72}}
.fin{fill:${C.text};opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:lock .3s cubic-bezier(.16,1,.3,1) forwards}
@keyframes lock{0%{opacity:.5;fill:${C.gold};transform:translateY(-6px) skewX(8deg)}45%{opacity:1;fill:${C.cream};transform:skewX(-3deg)}100%{opacity:.92;fill:${C.text};transform:none}}
.sp{opacity:0;animation:sp .3s ease-out none}
.sp1{fill:${C.sepia};transform:translateX(2px)}.sp2{fill:${C.goldLight};transform:translateX(-2px)}
@keyframes sp{0%{opacity:.75}100%{opacity:0}}
.b1,.b2{opacity:0;filter:blur(.8px);animation:9s steps(1,end) infinite}
.b1{fill:${C.goldLight};animation-name:b1;animation-delay:${decoded + 1}s}
.b2{fill:${C.sepia};animation-name:b2;animation-delay:${r2(decoded + 1.08)}s}
@keyframes b1{0%,92%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}93%{opacity:.4;transform:translate(-4px,-2px);clip-path:inset(8% 0 64% 0)}95%{opacity:.35;transform:translate(3px,1px);clip-path:inset(52% 0 22% 0)}97%{opacity:0}}
@keyframes b2{0%,92%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}93%{opacity:.4;transform:translate(4px,2px);clip-path:inset(70% 0 8% 0)}95%{opacity:.35;transform:translate(-3px,-1px);clip-path:inset(18% 0 56% 0)}97%{opacity:0}}
.fade{opacity:0;animation:fade .9s cubic-bezier(.16,1,.3,1) forwards}
@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.rule{stroke-dasharray:888;stroke-dashoffset:888;animation:rule 1.4s cubic-bezier(.16,1,.3,1) ${decoded}s forwards}
@keyframes rule{to{stroke-dashoffset:0}}
${reducedMotion('.scr,.sp,.b1,.b2{display:none}.fin{animation:none;opacity:.92}.fade{animation:none;opacity:1}.rule{animation:none;stroke-dashoffset:0}')}`;

  const inner = `
${glow(820, 120, 340, -60, 40, 16)}
${glow(160, 460, 300, 70, -30, 21)}
${asterisk(850, 250, 78)}
<g class="fade" style="animation-delay:.1s">
  ${label(PROFILE.status, x0, 62, { fill: C.text, opacity: 0.7, size: 10.5 })}
  ${label(PROFILE.location, W - 56, 62, { fill: C.text, opacity: 0.4, size: 10.5, anchor: 'end' })}
</g>
<g transform="${skew}">
  ${scr.join('')}
  ${split.join('')}
  ${fin.join('')}
  <path d="${allD}" class="b1"/><path d="${allD}" class="b2"/>
</g>
<line x1="${x0}" y1="${lineY}" x2="${W - 56}" y2="${lineY}" stroke="${C.border}" class="rule"/>
<g class="fade" style="animation-delay:${decoded}s">${tag.join('')}</g>
<g class="fade" style="animation-delay:${r2(decoded + 0.15)}s">
  ${label('Expertise', 560, 398, { fill: C.text, opacity: 0.4, size: 9.5 })}
  ${chips.svg}
</g>
<g class="fade" style="animation-delay:${r2(decoded + 0.3)}s">${label(`${PROFILE.name} — ${PROFILE.role}`, x0, 110, { fill: C.gold, size: 10.5 })}</g>`;

  write('hero.svg', `${svgOpen(W, H, `${PROFILE.name} — Software Developer`)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs })}</svg>`);
}

// ─── 2. Section headers: ghost title + gold label ────────────────────────────

function sectionHeader(slug, labelText, title) {
  const H = 130;
  const size = 92;
  const t = title.toUpperCase();
  const d = pathData(F.bold, t, 0, 96, size, -0.05);
  const tw = measure(F.bold, t, size, -0.05);
  const css = `
.lbl{opacity:0;animation:fade .9s cubic-bezier(.16,1,.3,1) .2s forwards}
@keyframes fade{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.ln{stroke-dasharray:140;stroke-dashoffset:140;animation:ln 1.2s cubic-bezier(.16,1,.3,1) .1s forwards}
@keyframes ln{to{stroke-dashoffset:0}}
${reducedMotion('.lbl{animation:none;opacity:1}.ln{animation:none;stroke-dashoffset:0}')}`;
  const svg = `${svgOpen(W, H, title)}<style>${css}</style>
<defs>
  <linearGradient id="glint" gradientUnits="userSpaceOnUse" x1="-300" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
    <stop offset="0.5" stop-color="${C.goldLight}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#ffffff" stop-opacity="0.1"/>
    <animateTransform attributeName="gradientTransform" type="translate" values="0 0;${r2(tw + 600)} 0;${r2(tw + 600)} 0" keyTimes="0;0.35;1" dur="7s" repeatCount="indefinite"/>
  </linearGradient>
</defs>
<path d="${d}" fill="#8b8b8b" fill-opacity="0.22"/>
<path d="${d}" fill="url(#glint)" opacity="0.5"/>
<line x1="2" y1="${H - 12}" x2="142" y2="${H - 12}" stroke="${C.gold}" stroke-width="1" class="ln"/>
<g class="lbl">${label(labelText, 2, H - 24, { size: 11 })}</g>
</svg>`;
  write(`section-${slug}.svg`, svg);
}

// ─── 3. Terminal: whoami ─────────────────────────────────────────────────────

function terminal() {
  const size = 14;
  const lh = 25;
  const x0 = 32;
  const charW = measure(F.mono, 'M', size);
  const prompt = glyphFor(F.mono, '❯').index ? '❯' : '$';
  const bullet = glyphFor(F.mono, '▹').index ? '▹' : '>';

  const script = [
    { cmd: 'whoami', out: [[{ t: `${PROFILE.name} · ${PROFILE.role}`, c: C.text }]] },
    { cmd: 'cat roles.txt', out: [[{ t: PROFILE.roles.join('  ·  '), c: C.goldLight }]] },
    { cmd: 'cat why-me.md', out: PROFILE.reasons.map((r) => [{ t: `${bullet} `, c: C.gold }, { t: r, c: C.text, o: 0.72 }]) },
    { cmd: 'echo $STATUS', out: [[{ t: '● ', c: C.live }, { t: `${PROFILE.status} — ${PROFILE.modality}`, c: C.text, o: 0.85 }]] },
  ];

  const lines = 1 + script.reduce((n, s) => n + 1 + s.out.length, 0);
  const top = 70;
  const H = top + lines * lh + 26;
  const parts = [];
  const clips = [];
  let y = top;
  let t = 0.6;
  const typeSpeed = 0.055;

  const promptSvg = (yy) =>
    txt(F.mono, prompt, x0, yy, size, { fill: C.gold }) + txt(F.mono, '~', x0 + charW * 2, yy, size, { fill: C.sepia });

  script.forEach((s, si) => {
    const cx = x0 + charW * 4;
    const n = [...s.cmd].length;
    const widths = Array.from({ length: n + 1 }, (_, k) => r2(k * charW)).join(';');
    const xs = Array.from({ length: n + 1 }, (_, k) => r2(cx + k * charW)).join(';');
    const dur = r2(n * typeSpeed);
    const id = `c${si}`;
    clips.push(`<clipPath id="${id}"><rect x="${cx}" y="${y - 16}" height="22" width="0"><animate attributeName="width" values="${widths}" dur="${dur}s" begin="${r2(t)}s" calcMode="discrete" fill="freeze"/></rect></clipPath>`);
    parts.push(`<g opacity="0"><set attributeName="opacity" to="1" begin="${r2(t - 0.35)}s" fill="freeze"/>${promptSvg(y)}</g>`);
    parts.push(`<g clip-path="url(#${id})">${txt(F.mono, s.cmd, cx, y, size, { fill: C.text })}</g>`);
    parts.push(`<rect y="${y - 14}" width="${r2(charW)}" height="18" fill="${C.gold}" opacity="0" x="${cx}"><set attributeName="opacity" to="0.85" begin="${r2(t - 0.35)}s"/><animate attributeName="x" values="${xs}" dur="${dur}s" begin="${r2(t)}s" calcMode="discrete" fill="freeze"/><set attributeName="opacity" to="0" begin="${r2(t + dur + 0.2)}s"/></rect>`);
    t += dur + 0.3;
    y += lh;
    s.out.forEach((segs, oi) => {
      let ox = x0;
      const row = segs.map((sg) => {
        const p = txt(F.mono, sg.t, ox, y + oi * lh, size, { fill: sg.c, opacity: sg.o });
        ox += measure(F.mono, sg.t, size);
        return p;
      }).join('');
      parts.push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.25s" begin="${r2(t + oi * 0.12)}s" fill="freeze"/>${row}</g>`);
    });
    t += s.out.length * 0.12 + 0.5;
    y += s.out.length * lh;
  });

  // Idle prompt with the blinking block cursor.
  parts.push(`<g opacity="0"><set attributeName="opacity" to="1" begin="${r2(t - 0.3)}s" fill="freeze"/>${promptSvg(y)}<rect x="${x0 + charW * 4}" y="${y - 14}" width="${r2(charW)}" height="18" fill="${C.gold}"><animate attributeName="opacity" values="1;0" dur="1.1s" begin="${r2(t)}s" repeatCount="indefinite" calcMode="discrete"/></rect></g>`);

  const chrome = `
<rect width="${W}" height="42" fill="#0a0a0a"/>
<line x1="0" y1="42.5" x2="${W}" y2="42.5" stroke="${C.border}"/>
${[22, 42, 62].map((cx) => `<circle cx="${cx}" cy="21" r="5.5" fill="${C.border}"/>`).join('')}
${txt(F.mono, 'jonatin@arch: ~', W / 2, 26, 12, { fill: C.text, opacity: 0.4, anchor: 'middle' })}
${label('zsh', W - 24, 25, { fill: C.text, opacity: 0.3, size: 9.5, anchor: 'end' })}`;

  write('whoami.svg', `${svgOpen(W, H, `${PROFILE.name} — whoami`)}${frame(W, H, `${chrome}${parts.join('\n')}`, { extraDefs: clips.join(''), rx: 16 })}</svg>`);
}

// ─── 4. About ────────────────────────────────────────────────────────────────

function about() {
  const x0 = 48;
  const maxW = 600;
  const p1 = wrap(F.serif, ABOUT.paragraphs[0], 23, maxW);
  const p2 = wrap(F.light, ABOUT.paragraphs[1], 16, maxW);
  let y = 78;
  const rows = [];
  let delay = 0.2;
  p1.forEach((l) => {
    rows.push(`<g class="rv" style="animation-delay:${r2(delay)}s">${txt(F.serif, l, x0, y, 23, { fill: C.cream })}</g>`);
    y += 34; delay += 0.08;
  });
  y += 16;
  p2.forEach((l) => {
    rows.push(`<g class="rv" style="animation-delay:${r2(delay)}s">${txt(F.light, l, x0, y, 16, { opacity: 0.68 })}</g>`);
    y += 27; delay += 0.08;
  });
  const H = y + 30;

  const sx = 740;
  const statH = (H - 60) / ABOUT.stats.length;
  const stats = ABOUT.stats.map((s, i) => {
    const sy = 40 + i * statH;
    return `<g class="rv" style="animation-delay:${r2(0.4 + i * 0.15)}s">
  ${i ? `<line x1="${sx}" y1="${r2(sy)}" x2="${W - 48}" y2="${r2(sy)}" stroke="${C.border}"/>` : ''}
  ${txt(F.serif, s.value, sx, r2(sy + statH * 0.62), 54, { fill: C.text })}
  ${label(s.label, sx + 50, r2(sy + statH * 0.62 - 6), { fill: C.text, opacity: 0.45, size: 10 })}
</g>`;
  }).join('');

  const css = `
.rv{opacity:0;animation:rv 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes rv{from{opacity:0;transform:translateY(12px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
${reducedMotion('.rv{animation:none;opacity:1}')}`;
  const inner = `
${glow(900, 40, 260, -40, 30, 18)}
<g class="rv">${label(ABOUT.label, x0, 44, { size: 10.5 })}</g>
${rows.join('\n')}
<line x1="${sx - 40}" y1="40" x2="${sx - 40}" y2="${H - 30}" stroke="${C.border}"/>
${stats}`;
  write('about.svg', `${svgOpen(W, H, ABOUT.label)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs })}</svg>`);
}

// ─── 5. Vision: word-by-word reveal ──────────────────────────────────────────

function vision() {
  const s1 = 38;
  const s2 = 30;
  const maxW = 860;
  const l1 = wrap(F.bold, VISION.line1.toUpperCase(), s1, maxW, -0.04);
  const l2 = wrap(F.serif, VISION.line2.toLowerCase(), s2, maxW);
  let y = 112;
  let d = 0.3;
  const words = [];
  const place = (font, lines, size, tracking, opts, lh) => {
    for (const line of lines) {
      const lw = measure(font, line, size, tracking);
      let x = (W - lw) / 2;
      const space = measure(font, ' ', size) + tracking * size;
      for (const word of line.split(' ')) {
        words.push(`<g class="w" style="animation-delay:${r2(d)}s">${txt(font, word, x, y, size, { tracking, ...opts })}</g>`);
        x += measure(font, word, size, tracking) + space;
        d += 0.07;
      }
      y += lh;
    }
  };
  place(F.bold, l1, s1, -0.04, { fill: C.text, opacity: 0.92 }, s1 * 1.08);
  y += 18;
  d += 0.25;
  place(F.serif, l2, s2, 0, { fill: C.text, opacity: 0.45 }, s2 * 1.3);
  const H = y + 26;
  const css = `
.w{opacity:0;animation:w .9s cubic-bezier(.16,1,.3,1) forwards}
@keyframes w{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
${reducedMotion('.w{animation:none;opacity:1}')}`;
  const inner = `
${glow(W / 2, H / 2, 380, 0, 20, 14)}
${label(VISION.label, W / 2, 52, { size: 10.5, anchor: 'middle' })}
${words.join('\n')}`;
  write('vision.svg', `${svgOpen(W, H, `${VISION.line1} ${VISION.line2}`)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs })}</svg>`);
}

// ─── 6. Tech reels ───────────────────────────────────────────────────────────

const mime = (p) => (p.endsWith('.png') ? 'image/png' : p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg' : 'image/svg+xml');

async function iconData(icon) {
  const buf = icon.startsWith('/')
    ? fs.readFileSync(path.join(PORTFOLIO, 'public', icon))
    : await cached(DEVICON + icon, `devicon-${icon.replace(/\//g, '_')}`);
  return `data:${mime(icon)};base64,${buf.toString('base64')}`;
}

async function techReels() {
  const cardH = 52;
  const gap = 12;
  const rowGap = 14;
  const iconS = 24;
  const nameS = 15;
  const top = 18;
  const durations = [46, 38, 52, 42];
  const H = top * 2 + TECH_REELS.length * cardH + (TECH_REELS.length - 1) * rowGap;

  const icons = new Map();
  for (const t of TECH_REELS.flat()) icons.set(t.name, await iconData(t.icon));

  // Each icon is defined once and reused with <use>, keeping the file small.
  const defs = [...icons].map(([name, href], i) =>
    `<symbol id="i${i}" viewBox="0 0 ${iconS} ${iconS}"><image href="${href}" width="${iconS}" height="${iconS}"${TECH_REELS.flat().find((t) => t.name === name).invert ? ' filter="url(#inv)"' : ''}/></symbol>`);
  const iconId = new Map([...icons.keys()].map((n, i) => [n, `i${i}`]));

  const rows = [];
  const css = [];
  TECH_REELS.forEach((items, ri) => {
    const cards = items.map((t) => ({ t, w: 18 + iconS + 12 + measure(F.medium, t.name, nameS) + 20 }));
    let set = [...cards];
    let setW = set.reduce((s, c) => s + c.w + gap, 0);
    while (setW < W + 200) { set = set.concat(cards); setW = set.reduce((s, c) => s + c.w + gap, 0); }
    const y = top + ri * (cardH + rowGap);
    let x = 0;
    const g = [];
    for (const copy of [0, 1]) {
      for (const { t, w } of set) {
        g.push(`<rect x="${r2(x)}" y="${y}" width="${r2(w)}" height="${cardH}" rx="16" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.1"/>
<use href="#${iconId.get(t.name)}" x="${r2(x + 18)}" y="${y + (cardH - iconS) / 2}" width="${iconS}" height="${iconS}"/>
${txt(F.medium, t.name, x + 18 + iconS + 12, y + cardH / 2 + nameS * 0.35, nameS, { opacity: 0.88 })}`);
        x += w + gap;
      }
      void copy;
    }
    css.push(`.r${ri}{animation:r${ri} ${durations[ri % 4]}s linear infinite${ri % 2 ? ' reverse' : ''}}@keyframes r${ri}{from{transform:translateX(0)}to{transform:translateX(${r2(-setW)}px)}}`);
    rows.push(`<g class="r${ri}">${g.join('')}</g>`);
  });

  const extraDefs = `${defs.join('')}
<filter id="inv"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>
<linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.1" stop-color="#fff"/><stop offset="0.9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="fade"><rect width="${W}" height="${H}" fill="url(#edge)"/></mask>`;
  const style = `<style>${css.join('\n')}${reducedMotion(TECH_REELS.map((_, i) => `.r${i}`).join(',') + '{animation:none}')}</style>`;
  write('tech.svg', `${svgOpen(W, H, `Stack: ${TECH_REELS.flat().map((t) => t.name).join(', ')}`)}${style}${frame(W, H, `<g mask="url(#fade)">${rows.join('\n')}</g>`, { extraDefs, grain: false })}</svg>`);
}

// ─── 7. Project cards ────────────────────────────────────────────────────────

function projectImage(rel) {
  const src = path.join(PORTFOLIO, rel);
  const out = path.join(CACHE, `${path.basename(rel)}.card.jpg`);
  if (!fs.existsSync(out)) execFileSync('magick', [src, '-resize', '920x', '-strip', '-quality', '74', out]);
  return `data:image/jpeg;base64,${fs.readFileSync(out).toString('base64')}`;
}

function projectCards() {
  const CW = 490;
  const pad = 18;
  const imgH = 262;
  const inner = CW - pad * 2;
  const descS = 13.5;
  const descLh = 21;

  const laid = PROJECTS.map((p) => ({ p, desc: wrap(F.light, p.description, descS, inner) }));
  const chipH = 26;
  const chipRows = laid.map(({ p }) => chipRow(p.tech, 0, 0, inner, { size: 9, h: chipH, padX: 11 }).bottom);
  const maxDesc = Math.max(...laid.map((l) => l.desc.length));
  const H = Math.ceil(pad + imgH + 34 + 38 + maxDesc * descLh + 18 + Math.max(...chipRows) + pad + 4);

  laid.forEach(({ p, desc }, idx) => {
    const img = projectImage(p.image);
    const align = p.imagePosition === 'top' ? 'xMidYMin slice' : 'xMidYMid slice';
    let y = pad + imgH + 34;
    const cat = label(p.category, pad, y, { size: 9.5, fill: C.gold });
    y += 38;
    const title = txt(F.bold, p.title, pad, y, 30, { tracking: -0.03 });
    y += 30;
    const body = desc.map((l, i) => txt(F.light, l, pad, y + i * descLh, descS, { opacity: 0.62 })).join('');
    const chipsY = H - pad - Math.max(...chipRows) - 2;
    const chips = chipRow(p.tech, pad, chipsY, inner, { size: 9, h: chipH, padX: 11 }).svg;
    const ver = 'VER ↗';
    const verText = glyphFor(F.medium, '↗').index ? ver : 'VER';
    const pillW = measure(F.medium, verText, 10, 0.2) + 26;
    const delay = 1.2 + idx * 0.9;

    const css = `
.in{opacity:0;animation:in 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.zoom{transform-box:fill-box;transform-origin:center;animation:zoom 14s ease-in-out infinite alternate}
@keyframes zoom{from{transform:scale(1)}to{transform:scale(1.06)}}
.glint{animation:glint 7s ease-in-out ${r2(delay)}s infinite}
@keyframes glint{0%{transform:translateX(-${CW}px)}35%,100%{transform:translateX(${CW * 1.6}px)}}
${reducedMotion('.in{animation:none;opacity:1}.zoom,.glint{animation:none}.glint{display:none}')}`;

    const svg = `${svgOpen(CW, H, `${p.title} — ${p.category}`)}<style>${css}</style>
${frame(CW, H, `
<rect width="${CW}" height="${H}" fill="${C.panel}"/>
<g clip-path="url(#img)">
  <image href="${img}" x="${pad}" y="${pad}" width="${inner}" height="${imgH}" preserveAspectRatio="${align}" class="zoom"/>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${imgH}" fill="url(#shade)"/>
  <rect x="0" y="${pad}" width="140" height="${imgH}" fill="url(#glintG)" class="glint" transform="skewX(-18)"/>
</g>
<rect x="${pad + 0.5}" y="${pad + 0.5}" width="${inner - 1}" height="${imgH - 1}" rx="12" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
<rect x="${r2(CW - pad - 12 - pillW)}" y="${pad + 12}" width="${r2(pillW)}" height="28" rx="14" fill="#000000" fill-opacity="0.6" stroke="#ffffff" stroke-opacity="0.15"/>
${txt(F.medium, verText, CW - pad - 12 - pillW / 2, pad + 30, 10, { tracking: 0.2, anchor: 'middle', opacity: 0.9 })}
<g class="in" style="animation-delay:.15s">${cat}</g>
<g class="in" style="animation-delay:.25s">${title}</g>
<g class="in" style="animation-delay:.38s">${body}</g>
<g class="in" style="animation-delay:.5s">${chips}</g>`, {
      grain: true,
      extraDefs: `<clipPath id="img"><rect x="${pad}" y="${pad}" width="${inner}" height="${imgH}" rx="12"/></clipPath>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${C.panel}" stop-opacity="0"/><stop offset="1" stop-color="${C.panel}" stop-opacity="0.75"/></linearGradient>
<linearGradient id="glintG" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.goldLight}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></linearGradient>`,
    })}</svg>`;
    write(`projects/${p.slug}.svg`, svg);
  });
}

// ─── 8. Experience timeline ──────────────────────────────────────────────────

function experience() {
  const lx = 46;
  const x0 = 84;
  const maxW = W - x0 - 48;
  let y = 64;
  const items = [];
  const dots = [];
  EXPERIENCE.forEach((e, i) => {
    const d = r2(0.3 + i * 0.35);
    const desc = wrap(F.light, e.desc, 14.5, maxW);
    dots.push(`<circle cx="${lx}" cy="${y - 5}" r="5" fill="${C.bg}" stroke="${C.gold}" stroke-width="1.5" class="in" style="animation-delay:${d}s"/>${i === 0 ? `<circle cx="${lx}" cy="${y - 5}" r="2" fill="${C.gold}"/>` : ''}`);
    let yy = y;
    const block = [label(e.year, x0, yy, { size: 10.5 })];
    yy += 34;
    block.push(txt(F.bold, e.role, x0, yy, 24, { tracking: -0.02 }));
    const rw = measure(F.bold, e.role, 24, -0.02);
    block.push(txt(F.serif, `— ${e.company}`, x0 + rw + 12, yy, 19, { fill: C.cream, opacity: 0.75 }));
    yy += 30;
    desc.forEach((l, li) => block.push(txt(F.light, l, x0, yy + li * 23, 14.5, { opacity: 0.6 })));
    yy += (desc.length - 1) * 23;
    items.push(`<g class="in" style="animation-delay:${d}s">${block.join('')}</g>`);
    y = yy + 54;
  });
  const H = y - 20;
  const css = `
.in{opacity:0;animation:in 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.track{stroke-dasharray:${H};stroke-dashoffset:${H};animation:track 2s cubic-bezier(.16,1,.3,1) .2s forwards}
@keyframes track{to{stroke-dashoffset:0}}
${reducedMotion('.in{animation:none;opacity:1}.track{animation:none;stroke-dashoffset:0}')}`;
  const inner = `
${glow(80, 60, 240, 30, 60, 20)}
<line x1="${lx}" y1="40" x2="${lx}" y2="${H - 36}" stroke="url(#trackG)" stroke-width="1.2" class="track"/>
${dots.join('')}
${items.join('\n')}`;
  write('experience.svg', `${svgOpen(W, H, 'Experiencia')}<style>${css}</style>${frame(W, H, inner, {
    extraDefs: `${glowDefs}<linearGradient id="trackG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.border}"/></linearGradient>`,
  })}</svg>`);
}

// ─── 9. Contact CTA, link buttons, footer ────────────────────────────────────

function contact() {
  const H = 330;
  const x0 = 56;
  const s = 56;
  const css = `
.in{opacity:0;animation:in 1s cubic-bezier(.16,1,.3,1) forwards}
@keyframes in{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
${reducedMotion('.in{animation:none;opacity:1}')}`;
  const roles = chipRow(PROFILE.roles, x0, 262, 600, { size: 9.5, h: 28 });
  const modalityX = x0 + measure(F.medium, PROFILE.status.toUpperCase(), 10.5, 0.28) + 24;
  const inner = `
${glow(860, 260, 340, -50, -30, 17)}
${asterisk(860, 150, 64, { opacity: 0.45, dur: 50 })}
<g class="in" style="animation-delay:.1s">
  ${label(PROFILE.status, x0, 58, { fill: C.text, opacity: 0.7, size: 10.5 })}
  <line x1="${modalityX - 12}" y1="46" x2="${modalityX - 12}" y2="62" stroke="#ffffff" stroke-opacity="0.12"/>
  ${label(PROFILE.modality, modalityX, 58, { fill: C.text, opacity: 0.4, size: 10.5 })}
</g>
<g class="in" style="animation-delay:.3s">${txt(F.serif, CTA[0], x0, 140, s, { fill: C.text })}</g>
<g class="in" style="animation-delay:.45s">${txt(F.serif, CTA[1], x0, 140 + s * 1.15, s, { fill: 'url(#ctaG)' })}</g>
<g class="in" style="animation-delay:.65s">${label('Roles que busco', x0, 248, { fill: C.text, opacity: 0.4, size: 9.5 })}${roles.svg}</g>`;
  write('contact.svg', `${svgOpen(W, H, `${CTA.join(' ')} — ${PROFILE.status}`)}<style>${css}</style>${frame(W, H, inner, {
    extraDefs: `${glowDefs}<linearGradient id="ctaG" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}"/><stop offset="1" stop-color="${C.sepia}"/></linearGradient>`,
  })}</svg>`);
}

function button(slug, text) {
  const h = 48;
  const t = text.toUpperCase();
  const tw = measure(F.medium, t, 11, 0.22);
  const w = Math.ceil(tw + 64);
  const arrow = glyphFor(F.medium, '↗').index ? '↗' : '→';
  const svg = `${svgOpen(w, h, text)}
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.goldLight}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></linearGradient><clipPath id="b"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>
<g clip-path="url(#b)">
  <rect width="${w}" height="${h}" fill="#0a0a0a"/>
  <rect y="0" width="60" height="${h}" fill="url(#g)"><animate attributeName="x" values="-80;${w + 20};${w + 20}" keyTimes="0;0.3;1" dur="6s" repeatCount="indefinite"/></rect>
</g>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${h / 2 - 0.5}" fill="none" stroke="${C.border}"/>
${txt(F.medium, t, 24, h / 2 + 4, 11, { tracking: 0.22, opacity: 0.88 })}
${txt(F.medium, arrow, w - 22, h / 2 + 5, 14, { fill: C.gold, anchor: 'end' })}
</svg>`;
  write(`btn-${slug}.svg`, svg);
}

function divider() {
  const H = 28;
  const svg = `${svgOpen(W, H, 'divider')}
<defs>
  <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${C.border}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.border}"/><stop offset="1" stop-color="${C.border}" stop-opacity="0"/></linearGradient>
  <linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.goldLight}"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></linearGradient>
</defs>
<rect x="0" y="${H / 2}" width="${W}" height="1" fill="url(#l)"/>
<rect y="${H / 2 - 0.5}" width="180" height="2" fill="url(#s)"><animate attributeName="x" values="-200;${W + 20};${W + 20}" keyTimes="0;0.45;1" dur="8s" repeatCount="indefinite"/></rect>
<g transform="translate(${W / 2} ${H / 2})"><rect x="-4" y="-4" width="8" height="8" fill="${C.bg}" stroke="${C.gold}" transform="rotate(45)"/></g>
</svg>`;
  write('divider.svg', svg);
}

function footer() {
  const H = 70;
  const svg = `${svgOpen(W, H, `${PROFILE.role} · ${PROFILE.location}`)}
${label(`${PROFILE.role} · ${PROFILE.location}`, W / 2, 30, { fill: '#8b8b8b', opacity: 0.9, size: 10, anchor: 'middle' })}
${txt(F.serif, 'Diseñado y construido por mí', W / 2, 58, 15, { fill: C.gold, opacity: 0.8, anchor: 'middle' })}
</svg>`;
  write('footer.svg', svg);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

console.log('Building profile assets…');
hero();
sectionHeader('projects', 'Trabajo', 'Proyectos');
sectionHeader('experience', 'Trayectoria', 'Experiencia');
sectionHeader('tech', 'Stack & Toolkit', 'Tecnologías');
sectionHeader('contact', 'Hablemos', 'Contacto');
terminal();
about();
vision();
await techReels();
projectCards();
experience();
contact();
button('portfolio', 'Portafolio');
button('linkedin', 'LinkedIn');
button('email', 'Email');
button('cv-es', 'CV Español');
button('cv-en', 'CV English');
divider();
footer();
console.log('Done.');
