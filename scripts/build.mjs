// Builds assets/terminal.svg: the whole profile README as one continuous,
// animated terminal session (no seams between sections).
//
// - Text is real <text> set in JetBrains Mono, embedded as a subset woff2
//   (an SVG inside <img> cannot fetch fonts).
// - The torus knot is rendered to ASCII frames by ascii3d.mjs
//   and flipped with CSS steps(), the README-safe stand-in for the
//   three.js AsciiEffect scene.
// - "Ahora mismo" and the contribution map come from the GitHub API; the last
//   result is cached in activity.json so builds without a token still work.
//
// Usage: npm install && npm run build

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import figlet from 'figlet';
import subsetFont from 'subset-font';
import { torusKnot, renderFrames } from './ascii3d.mjs';
import { LOGIN, SITE, HERO, BOOT, SYSTEM, SHIPS, FOOTER } from './data.mjs';
import { fetchActivity } from './github.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '..', 'assets');
const CACHE = path.join(ROOT, '.cache');
const ACTIVITY = path.join(ROOT, 'activity.json');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// ─── Look ────────────────────────────────────────────────────────────────────

const W = 1000;
const PAD = 36;
const SIZE = 13;
const LH = 20;
const cw = (size = SIZE) => size * 0.6; // JetBrains Mono advance = 600/1000 em
const COLS = Math.floor((W - PAD * 2) / cw());
const C = { bg: '#050505', fg: '#d9d9d9', hi: '#ffffff', dim: '#8a8a8a', faint: '#4d4d4d', ghost: '#262626' };
const PROMPT = [{ t: 'jonatin@cachyos', c: 'hi', b: true }, { t: ' ~', c: 'dim' }, { t: '> ', c: 'faint' }];

// The layout is timed in "script seconds"; K compresses the whole session
// so it plays in about nine real seconds.
const K = 0.6;

// Performance: an animated SVG inside <img> is re-rasterized whole on every
// change. Every endless animation therefore changes only on one shared
// 12 fps grid (TICK), so they all land on the same repaint instead of each
// forcing its own: ~12 repaints/s instead of 60-80.
const FPS = 12;
const q = (sec) => (Math.round(sec * FPS) / FPS).toFixed(4); // seconds on the grid
const pct = (ticks, total) => ((ticks / total) * 100).toFixed(4);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r2 = (n) => Math.round(n * 100) / 100;
const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
const len = (s) => [...s].length;

// ─── Drawing primitives ──────────────────────────────────────────────────────

const parts = [];
const defs = [];
let clipId = 0;

// One line of styled runs: [{ t, c: 'hi'|'fg'|'dim'|'faint'|'ghost', b }].
function line(x, y, runs, { size = SIZE, at, cls = '', anchor } = {}) {
  const spans = runs.map((r) => `<tspan class="${r.c ?? 'fg'}${r.b ? ' b' : ''}">${esc(r.t)}</tspan>`).join('');
  const klass = [at != null ? 'p' : '', cls].filter(Boolean).join(' ');
  return `<text x="${r2(x)}" y="${r2(y)}"${size !== SIZE ? ` font-size="${size}"` : ''}${anchor ? ` text-anchor="${anchor}"` : ''}${klass ? ` class="${klass}"` : ''}${at != null ? ` style="animation-delay:${r2(at * K)}s"` : ''}>${spans}</text>`;
}

// Runs revealed key by key (SMIL clip, discrete steps), with a block cursor.
function typed(x, y, runs, at, { speed = 0.045, size = SIZE, keepCursor = false } = {}) {
  const n = runs.reduce((s, r) => s + len(r.t), 0);
  const w = cw(size);
  const dur = r2(Math.max(0.05, n * speed * K));
  const begin = r2(at * K);
  const id = `t${clipId++}`;
  const widths = Array.from({ length: n + 1 }, (_, k) => r2(k * w)).join(';');
  const xs = Array.from({ length: n + 1 }, (_, k) => r2(x + k * w)).join(';');
  defs.push(`<clipPath id="${id}"><rect x="${r2(x)}" y="${r2(y - size)}" height="${r2(size * 1.5)}" width="0"><animate attributeName="width" values="${widths}" dur="${dur}s" begin="${begin}s" calcMode="discrete" fill="freeze"/></rect></clipPath>`);
  const cursorEnd = keepCursor ? '' : `<set attributeName="opacity" to="0" begin="${r2(begin + dur + 0.1)}s"/>`;
  const cursor = `<rect x="${r2(x)}" y="${r2(y - size * 0.95)}" width="${r2(w)}" height="${r2(size * 1.25)}" fill="${C.hi}" opacity="0"><set attributeName="opacity" to="0.9" begin="${r2(Math.max(0, begin - 0.15))}s"/><animate attributeName="x" values="${xs}" dur="${dur}s" begin="${begin}s" calcMode="discrete" fill="freeze"/>${cursorEnd}${keepCursor ? `<animate attributeName="opacity" values="0.9;0" dur="1s" begin="${q(begin + dur)}s" repeatCount="indefinite" calcMode="discrete"/>` : ''}</rect>`;
  return { svg: `<g clip-path="url(#${id})">${line(x, y, runs, { size })}</g>${cursor}`, end: at + dur / K };
}

// Shell prompt + typed command. Returns the time the command finished.
function command(y, cmd, at) {
  const promptW = PROMPT.reduce((s, r) => s + len(r.t), 0) * cw();
  parts.push(line(PAD, y, PROMPT, { at: Math.max(0, at - 0.25) }));
  const t = typed(PAD + promptW, y, [{ t: cmd, c: 'hi' }], at);
  parts.push(t.svg);
  return t.end + 0.25;
}

// Section rule: "── 02 · ahora mismo ─────────".
function rule(y, n, title, at) {
  const head = `── ${String(n).padStart(2, '0')} · ${title} `;
  parts.push(line(PAD, y, [{ t: '── ', c: 'faint' }, { t: String(n).padStart(2, '0'), c: 'dim' }, { t: ` · ${title} `, c: 'hi', b: true }, { t: '─'.repeat(COLS - len(head)), c: 'ghost' }], { at }));
}

// Flip-book of ASCII frames (CSS steps). Frame i is visible during [i, i+1)/n.
function flipbook(frames, x, y, { size, lh, dur, at, cls }) {
  const n = frames.length;
  const step = dur / n;
  const w = cw(size);
  const groups = frames.map((rows, i) => {
    const tspans = rows.map((row, ri) => {
      const lead = row.length - row.trimStart().length;
      const body = row.trim();
      return body ? `<tspan x="${r2(x + lead * w)}" y="${r2(y + ri * lh)}">${esc(body)}</tspan>` : '';
    }).join('');
    const delay = (-(((n - i) % n) * step)).toFixed(4);
    return `<text class="kf" style="animation-delay:${delay}s">${tspans}</text>`;
  }).join('');
  return `<g class="${cls} p" style="animation-delay:${r2(at * K)}s" font-size="${size}">${groups}</g>`;
}

// ─── Data ────────────────────────────────────────────────────────────────────

let activity = await fetchActivity(LOGIN).catch((e) => {
  console.warn(`  ! live data unavailable: ${e.message}`);
  return null;
});
if (activity) fs.writeFileSync(ACTIVITY, `${JSON.stringify({ ...activity, fetchedAt: new Date().toISOString() }, null, 1)}\n`);
else if (fs.existsSync(ACTIVITY)) activity = JSON.parse(fs.readFileSync(ACTIVITY, 'utf8'));
const now = activity?.fetchedAt ? new Date(activity.fetchedAt) : new Date();

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function ago(iso) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 60) return m <= 1 ? 'hace un momento' : `hace ${m} minutos`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`;
  const mo = Math.round(d / 30);
  return mo === 1 ? 'hace 1 mes' : `hace ${mo} meses`;
}

// ─── Layout: one continuous session ──────────────────────────────────────────

let y = 76;
let t = 0.3;

// Boot log.
BOOT.forEach((msg) => {
  parts.push(line(PAD, y, [{ t: '[  ', c: 'faint' }, { t: 'OK', c: 'hi', b: true }, { t: '  ] ', c: 'faint' }, { t: msg, c: 'dim' }], { size: 12, at: t }));
  y += 18;
  t += 0.12;
});
y += 16;

// Banner: the handle in figlet on one line (left) and the torus knot (right).
y += 14;
const bannerTop = y;
const figSize = 9;
const figLh = 10.8;
const handle = HERO.handle.toUpperCase().replace(/([A-Z]{3})$/, ' $1'); // JONATHAN RBT
const fig = figlet.textSync(handle, { font: 'ANSI Shadow' }).split('\n').filter((r) => r.trim());
// Solid blocks become crisp rects (text glyphs leave seams between cells);
// the box-drawing outline of ANSI Shadow stays as grey text: a drop shadow.
function banner(rows, x0, y0, { blocks = C.hi, shadow = C.faint, at } = {}) {
  const w = cw(figSize);
  return rows.map((row, i) => {
    const top = y0 + i * figLh;
    const rects = [];
    const chars = [...row];
    for (let c = 0; c < chars.length; c++) {
      if (chars[c] !== '█') continue;
      let e = c;
      while (chars[e + 1] === '█') e++;
      rects.push(`<rect x="${r2(x0 + c * w)}" y="${r2(top)}" width="${r2((e - c + 1) * w + 0.3)}" height="${r2(figLh + 0.3)}"/>`);
      c = e;
    }
    const outline = chars.map((ch) => (ch === '█' ? ' ' : ch)).join('');
    const delay = at != null ? ` class="p" style="animation-delay:${r2((at + i * 0.045) * K)}s"` : '';
    return `<g${delay}><g fill="${blocks}">${rects.join('')}</g>${outline.trim() ? `<text x="${r2(x0)}" y="${r2(top + figLh * 0.78)}" font-size="${figSize}" fill="${shadow}">${esc(outline)}</text>` : ''}</g>`;
  }).join('');
}
parts.push(`<g class="glitch-host">${banner(fig, PAD, y, { at: t })}</g>`);
parts.push(`<g class="g1">${banner(fig, PAD, y, { blocks: '#9a9a9a', shadow: 'none' })}</g><g class="g2">${banner(fig, PAD, y, { blocks: '#3a3a3a', shadow: 'none' })}</g>`);
const decoded = t + fig.length * 0.045 + 0.3;
y += fig.length * figLh + 26;

parts.push(line(PAD, y, [{ t: '// ', c: 'faint' }, { t: HERO.role, c: 'fg' }], { at: decoded }));
y += LH;
parts.push(line(PAD, y, [{ t: '// ', c: 'faint' }, { t: HERO.where, c: 'dim' }], { at: decoded + 0.1 }));
y += LH + 10;
const heroLine = typed(PAD, y, [{ t: '> ', c: 'dim' }, { t: HERO.line, c: 'hi', b: true }], decoded + 0.4, { speed: 0.03 });
parts.push(heroLine.svg);
t = heroLine.end + 0.3;

// The spinning torus knot, smaller than the name block beside it.
const knotSize = 8;
const knotLh = 8.9;
const knotCols = 64;
const knotRows = 32;
const knot = renderFrames(torusKnot(), {
  cols: knotCols, rows: knotRows, frames: 72, scale: 42, aspect: knotLh / cw(knotSize),
  spin: (p) => [p * Math.PI * 2, p * Math.PI * 2, 0],
});
const knotX = W - PAD - knotCols * cw(knotSize);
const knotY = bannerTop - 40;
parts.push(flipbook(knot, knotX, knotY, { size: knotSize, lh: knotLh, dur: 12, at: 0.6, cls: 'knot' }));
parts.push(line(W - PAD, knotY + knotRows * knotLh + 4, [{ t: 'torusKnot(1, 0.2, p=2, q=3) · ramp " .:-+*=%@#"', c: 'faint' }], { size: 10, anchor: 'end', at: 1.2 }));
y = Math.max(y, knotY + knotRows * knotLh + 4) + 44;

// 01 · fastfetch with the logo configured on the real machine
// (~/.config/omarchy/branding/about.txt, copied to logo.txt): braille art,
// drawn dot by dot so it does not depend on the font having braille glyphs.
rule(y, 1, 'fastfetch', t);
y += 38;
t = command(y, 'fastfetch', t + 0.2);
y += 30;
const ffTop = y;
const logo = fs.readFileSync(path.join(ROOT, 'logo.txt'), 'utf8').split('\n').filter((r, i, a) => r.trim() || i < a.length - 1);
const logoCw = 6.6;
const logoLh = logoCw * 2; // braille cell = 2x4 dots on a square pitch
// Braille bit -> [column, row] of the dot inside the 2x4 cell.
const BRAILLE = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
const dots = [];
logo.forEach((row, ri) => {
  [...row].forEach((ch, ci) => {
    const bits = ch.codePointAt(0) - 0x2800;
    if (bits <= 0 || bits > 0xff) return;
    BRAILLE.forEach(([dx, dy], b) => {
      if (bits & (1 << b)) dots.push(`<circle cx="${r2(PAD + ci * logoCw + (dx + 0.5) * logoCw / 2)}" cy="${r2(ffTop - 14 + ri * logoLh + (dy + 0.5) * logoLh / 4)}" r="${r2(logoCw * 0.17)}"/>`);
    });
  });
});
parts.push(`<g class="p" fill="${C.fg}" style="animation-delay:${r2(t * K)}s">${dots.join('')}</g>`);
const logoW = Math.max(...logo.map((r) => [...r].length)) * logoCw;
const logoH = logo.length * logoLh;
const ix = PAD + logoW + 48;
const [user, host] = SYSTEM.host.split('@');
parts.push(line(ix, y, [{ t: user, c: 'hi', b: true }, { t: '@', c: 'faint' }, { t: host, c: 'hi', b: true }], { at: t }));
y += LH;
parts.push(line(ix, y, [{ t: '─'.repeat(len(SYSTEM.host)), c: 'faint' }], { at: t }));
y += LH;
SYSTEM.rows.forEach(([k, v], i) => {
  parts.push(line(ix, y, [{ t: k.padEnd(8), c: 'hi', b: true }, { t: v, c: 'fg' }], { at: t + 0.04 * (i + 1) }));
  y += LH;
});
y += 6;
const shades = [C.ghost, '#3a3a3a', C.faint, '#6b6b6b', C.dim, '#b0b0b0', C.fg, C.hi];
parts.push(`<g class="p" style="animation-delay:${r2((t + 0.5) * K)}s">${shades.map((c, i) => `<rect x="${r2(ix + i * 28)}" y="${r2(y - 11)}" width="24" height="12" fill="${c}"/>`).join('')}</g>`);
t += 0.7;
y = Math.max(y, ffTop - 14 + logoH) + 44;

// 02 · ahora mismo (live).
rule(y, 2, 'ahora mismo', t);
y += 38;
t = command(y, 'gh activity --latest', t + 0.2);
y += 30;
if (activity?.latest) {
  const msg = activity.latest.message.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
  parts.push(line(PAD, y, [{ t: 'repo      ', c: 'dim' }, { t: activity.latest.repo, c: 'hi', b: true }, { t: `  ·  ${ago(activity.latest.date)}`, c: 'dim' }], { at: t }));
  y += LH;
  parts.push(line(PAD, y, [{ t: 'commit    ', c: 'dim' }, { t: msg.length > 90 ? `${msg.slice(0, 89)}…` : msg, c: 'fg' }], { at: t + 0.06 }));
  y += LH + 12;
}
if (activity?.languages?.length) {
  parts.push(line(PAD, y, [{ t: 'lenguajes · últimos 12 meses', c: 'dim' }], { at: t + 0.12 }));
  y += LH + 4;
  const barCols = 48;
  activity.languages.forEach((l, i) => {
    const full = Math.max(1, Math.round(l.pct * barCols));
    const at = t + 0.2 + i * 0.08;
    parts.push(line(PAD, y, [{ t: l.name.padEnd(13), c: 'fg' }], { at }));
    const bar = typed(PAD + 13 * cw(), y, [{ t: '█'.repeat(full), c: 'hi' }, { t: '░'.repeat(barCols - full), c: 'ghost' }], at, { speed: 0.012 });
    parts.push(bar.svg);
    parts.push(line(PAD + (13 + barCols + 2) * cw(), y, [{ t: `${(l.pct * 100).toFixed(1).padStart(5)}%`, c: 'dim' }], { at: at + 0.4 }));
    y += LH;
  });
}
t += 1.1;
y += 34;

// 03 · un año de commits (live): the calendar in the same ASCII ramp.
if (activity?.weeks) {
  rule(y, 3, 'un año de commits', t);
  y += 38;
  t = command(y, 'gh contributions --year', t + 0.2);
  y += 30;
  const fmt = (n) => n.toLocaleString('es-CO');
  parts.push(line(PAD, y, [
    { t: fmt(activity.total), c: 'hi', b: true }, { t: ' contribuciones   ', c: 'dim' },
    { t: String(activity.streak.current), c: 'hi', b: true }, { t: ' racha actual   ', c: 'dim' },
    { t: String(activity.streak.longest), c: 'hi', b: true }, { t: ' racha más larga', c: 'dim' },
  ], { at: t }));
  y += LH + 8;
  const glyph = ['·', ':', '+', '%', '@'];
  const tone = ['ghost', 'faint', 'dim', 'fg', 'hi'];
  const weeks = activity.weeks;
  const gx = PAD + 5 * cw();
  // Month labels.
  let monthRow = ' '.repeat(weeks.length * 2);
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const d = new Date(`${w[0].date}T00:00:00Z`);
    if (d.getUTCMonth() !== lastMonth && d.getUTCDate() <= 7 && wi < weeks.length - 2) {
      lastMonth = d.getUTCMonth();
      monthRow = monthRow.slice(0, wi * 2) + MONTHS[lastMonth] + monthRow.slice(wi * 2 + 3);
    }
  });
  parts.push(line(gx, y, [{ t: monthRow, c: 'faint' }], { size: SIZE, at: t + 0.1 }));
  y += LH - 2;
  const dayNames = ['', 'lun', '', 'mié', '', 'vie', ''];
  const twinkles = [];
  for (let d = 0; d < 7; d++) {
    const runs = [];
    weeks.forEach((w, wi) => {
      const day = w.find((x) => new Date(`${x.date}T00:00:00Z`).getUTCDay() === d);
      if (!day) { runs.push({ t: '  ', c: 'ghost' }); return; }
      runs.push({ t: `${glyph[day.level]} `, c: tone[day.level], b: day.level === 4 });
      if (day.level >= 3 && Math.abs(hash(day.date)) % 3 === 0) {
        twinkles.push(`<text x="${r2(gx + wi * 2 * cw())}" y="${r2(y)}" class="tw hi b" style="animation-delay:${q(1 + (Math.abs(hash(day.date)) % 37) / 10)}s">${glyph[day.level]}</text>`);
      }
    });
    parts.push(line(PAD, y, [{ t: dayNames[d].padEnd(5), c: 'faint' }], { at: t + 0.15 + d * 0.06 }));
    parts.push(line(gx, y, runs, { at: t + 0.15 + d * 0.06 }));
    y += LH - 4;
  }
  parts.push(`<g class="p" style="animation-delay:${r2((t + 0.6) * K)}s">${twinkles.join('')}</g>`);
  y += 6;
  parts.push(line(gx, y, [{ t: 'menos ', c: 'faint' }, ...glyph.map((g, i) => ({ t: `${g} `, c: tone[i] })), { t: 'más', c: 'faint' }], { at: t + 0.6 }));
  t += 1;
  y += 46;
}

// 04 · ship log as git log --graph.
rule(y, 4, 'ship log', t);
y += 38;
t = command(y, 'git log --graph --oneline', t + 0.2);
y += 30;
SHIPS.forEach((s, i) => {
  const sha = (hash(s.name) >>> 0).toString(16).padStart(8, '0').slice(0, 7);
  const deco = [];
  if (i === 0) deco.push({ t: '(', c: 'dim' }, { t: 'HEAD -> main', c: 'hi', b: true }, { t: ') ', c: 'dim' });
  if (s.tag) deco.push({ t: '(', c: 'dim' }, { t: `tag: ${s.tag}`, c: 'hi' }, { t: ') ', c: 'dim' });
  const at = t + i * 0.12;
  parts.push(line(PAD, y, [{ t: '* ', c: 'hi', b: true }, { t: `${sha} `, c: 'dim' }, ...deco, { t: 'feat: ', c: 'dim' }, { t: s.name, c: 'hi', b: true }], { at }));
  parts.push(line(W - PAD, y, [{ t: `[${s.kind}${s.link ? ' ↗' : ''}]`, c: 'faint' }], { at, anchor: 'end' }));
  y += LH;
  const pipe = i < SHIPS.length - 1 ? '│ ' : '  ';
  parts.push(line(PAD, y, [{ t: pipe, c: 'faint' }, { t: `  ${s.what}`, c: 'fg' }, { t: `   ${s.stack}`, c: 'faint' }], { at: at + 0.04 }));
  y += LH;
  if (i < SHIPS.length - 1) { parts.push(line(PAD, y, [{ t: '│', c: 'faint' }], { at: at + 0.06 })); y += LH; }
});
t += SHIPS.length * 0.12 + 0.4;
y += 34;

// 05 · eof.
rule(y, 5, 'eof', t);
y += 38;
t = command(y, 'cat ~/.plan', t + 0.2);
y += 34;
FOOTER.forEach((f, i) => {
  parts.push(line(PAD, y, [{ t: f, c: 'hi', b: true }], { size: 17, at: t + i * 0.1 }));
  y += 28;
});
parts.push(line(PAD, y, [{ t: '→ ', c: 'dim' }, { t: SITE.replace('https://', ''), c: 'fg' }], { at: t + 0.2 }));
y += 40;
const promptW = PROMPT.reduce((s, r) => s + len(r.t), 0) * cw();
parts.push(line(PAD, y, PROMPT, { at: t + 0.5 }));
// CSS, not SMIL: an endless SMIL animation makes Chromium repaint the image every frame.
parts.push(`<rect x="${r2(PAD + promptW)}" y="${r2(y - SIZE * 0.95)}" width="${r2(cw())}" height="${r2(SIZE * 1.25)}" fill="${C.hi}" class="blink" style="animation-delay:${q((t + 0.5) * K)}s"/>`);
const H = Math.ceil(y + 40);

// ─── Assemble ────────────────────────────────────────────────────────────────

const css = `
svg{font-size:${SIZE}px}
text{font-family:'JBM',ui-monospace,monospace;white-space:pre}
.fg{fill:${C.fg}}.hi{fill:${C.hi}}.dim{fill:${C.dim}}.faint{fill:${C.faint}}.ghost{fill:${C.ghost}}.b{font-weight:700}
.p{opacity:0;animation:p .01s linear forwards}
@keyframes p{to{opacity:1}}
.kf{visibility:hidden;fill:${C.fg};animation-timing-function:steps(1,end);animation-iteration-count:infinite}
.knot .kf{animation-duration:12s;animation-name:k72}
@keyframes k72{0%{visibility:visible}${pct(1, 72)}%,100%{visibility:hidden}}
.g1,.g2{opacity:0;animation:9s steps(1,end) ${q(decoded * K + 1.5)}s infinite}
.g1{animation-name:g1}.g2{animation-name:g2}
@keyframes g1{0%,${pct(98, 108)}%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}${pct(99, 108)}%{opacity:.7;transform:translate(-5px,0);clip-path:inset(10% 0 62% 0)}${pct(101, 108)}%{opacity:.6;transform:translate(4px,0);clip-path:inset(55% 0 20% 0)}${pct(103, 108)}%{opacity:0}}
@keyframes g2{0%,${pct(98, 108)}%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}${pct(99, 108)}%{opacity:.8;transform:translate(5px,0);clip-path:inset(68% 0 6% 0)}${pct(101, 108)}%{opacity:.7;transform:translate(-3px,0);clip-path:inset(22% 0 52% 0)}${pct(103, 108)}%{opacity:0}}
.glitch-host{animation:jit 9s steps(1,end) ${q(decoded * K + 1.5)}s infinite}
@keyframes jit{0%,${pct(98, 108)}%,${pct(103, 108)}%,100%{transform:none}${pct(99, 108)}%{transform:translate(2px,0)}${pct(101, 108)}%{transform:translate(-2px,0)}}
.blink{opacity:0;animation:blink 1s steps(1,end) infinite}
@keyframes blink{0%{opacity:.9}50%,100%{opacity:0}}
.tw{animation:tw ${(40 / FPS).toFixed(4)}s steps(20,end) infinite}
@keyframes tw{0%,100%{opacity:0}50%{opacity:1}}
.screen{animation:flicker 7s steps(1,end) infinite}
@keyframes flicker{0%,100%{opacity:1}${pct(26, 84)}%{opacity:.96}${pct(27, 84)}%{opacity:1}${pct(65, 84)}%{opacity:.97}${pct(66, 84)}%{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .p{animation:none;opacity:1}.kf{animation:none}.kf:first-child{visibility:visible}
  .g1,.g2,.tw{display:none}.blink{animation:none;opacity:.9}.glitch-host,.screen{animation:none}
}`;

const body = `
<defs>
  ${defs.join('')}
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  <pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity="0.035"/></pattern>
  <radialGradient id="vig" cx="50%" cy="40%" r="75%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="34" fill="#0c0c0c"/>
  <line x1="0" y1="34.5" x2="${W}" y2="34.5" stroke="#1c1c1c"/>
  ${[20, 38, 56].map((x) => `<circle cx="${x}" cy="17" r="5" fill="#2a2a2a"/>`).join('')}
  ${line(W / 2, 22, [{ t: `${SYSTEM.host}: ~ — fish`, c: 'faint' }], { size: 11.5, anchor: 'middle' })}
  ${line(W - 18, 22, [{ t: 'tty1', c: 'ghost' }], { size: 11, anchor: 'end' })}
  <g class="screen">${parts.join('\n')}</g>
  <rect width="${W}" height="${H}" fill="url(#scan)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="#1f1f1f"/>`;

// Embed only the glyphs this file uses.
const used = new Set([...body.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), ...' →↗']);
const text = [...used].join('');
async function fontFace(file, url, weight) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const woff2 = await subsetFont(fs.readFileSync(p), text, { targetFormat: 'woff2' });
  return `@font-face{font-family:'JBM';font-weight:${weight};src:url(data:font/woff2;base64,${woff2.toString('base64')}) format('woff2')}`;
}
const GF = 'https://fonts.gstatic.com/s/jetbrainsmono/v24/';
const fonts = [
  await fontFace('jbm-400.ttf', `${GF}tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf`, 400),
  await fontFace('jbm-700.ttf', `${GF}tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf`, 700),
].join('');

const title = `${HERO.name} — ${HERO.role}. ${HERO.line}`;
const desc = [
  SYSTEM.rows.map(([k, v]) => `${k}: ${v}`).join('; '),
  activity?.latest ? `Último push: ${activity.latest.repo}.` : '',
  activity ? `${activity.total} contribuciones en el último año.` : '',
  `Proyectos: ${SHIPS.map((s) => `${s.name} — ${s.what}`).join('; ')}.`,
  FOOTER.join(' '),
].filter(Boolean).join(' ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ttl dsc" xml:space="preserve"><title id="ttl">${esc(title)}</title><desc id="dsc">${esc(desc)}</desc><style>${fonts}${css}</style>${body}</svg>`;
fs.writeFileSync(path.join(OUT, 'terminal.svg'), svg);
console.log(`  terminal.svg  ${W}x${H}  ${(svg.length / 1024).toFixed(0)} KB  session ${r2(t * K)}s${activity ? '' : '  (no activity data)'}`);
