// Generates the animated SVGs of the GitHub profile README in ../assets.
//
// Static panels (hero, fastfetch, ship log) come from data.mjs.
// Live panels (now, constellation) come from the GitHub API and are refreshed
// daily by .github/workflows/refresh.yml; without a token they are skipped and
// the committed versions stay as they are.
//
// Usage: npm install && npm run build

import {
  C, W, F, GLYPHS, r2, rng, hash, txt, runs, measure, layout, glyphFor, truncate, sanitize, hasGlyph,
  svgOpen, write, frame, chrome, label, asterisk, glow, glowDefs, reducedMotion, fadeCss,
} from './lib.mjs';
import { LOGIN, HERO, SYSTEM, SHIPS, FOOTER } from './data.mjs';
import { fetchActivity } from './github.mjs';

const PROMPT = hasGlyph(F.mono, '❯') ? '❯' : '$';
const ARROW = hasGlyph(F.medium, '↗') ? '↗' : '→';

// Prompt "❯ ~" followed by a command typed key by key (SMIL, discrete steps).
function typedCommand(id, cmd, x, y, begin, { size = 14, speed = 0.06 } = {}) {
  const cw = measure(F.mono, 'M', size);
  const cx = x + cw * 4;
  const n = [...cmd].length;
  const dur = r2(n * speed);
  const widths = Array.from({ length: n + 1 }, (_, k) => r2(k * cw)).join(';');
  const xs = Array.from({ length: n + 1 }, (_, k) => r2(cx + k * cw)).join(';');
  return {
    end: begin + dur,
    defs: `<clipPath id="${id}"><rect x="${cx}" y="${y - 16}" height="22" width="0"><animate attributeName="width" values="${widths}" dur="${dur}s" begin="${begin}s" calcMode="discrete" fill="freeze"/></rect></clipPath>`,
    svg: `${txt(F.mono, PROMPT, x, y, size, { fill: C.gold })}${txt(F.mono, '~', x + cw * 2, y, size, { fill: C.sepia })}
<g clip-path="url(#${id})">${txt(F.mono, cmd, cx, y, size)}</g>
<rect y="${y - 14}" width="${r2(cw)}" height="18" fill="${C.gold}" opacity="0.85" x="${cx}"><animate attributeName="x" values="${xs}" dur="${dur}s" begin="${begin}s" calcMode="discrete" fill="freeze"/><set attributeName="opacity" to="0" begin="${r2(begin + dur + 0.25)}s"/></rect>`,
  };
}

// ─── 1. Hero: name in "signal decode" ────────────────────────────────────────

function hero() {
  const H = 350;
  const size = 104;
  const tracking = -0.05;
  const x0 = 56;
  const baselines = [166, 258];
  const words = HERO.name.toUpperCase().split(' ');
  const rand = rng(11);
  const start = 0.35;
  const stagger = 0.06;
  const churn = 0.34;
  const steps = 4;
  const scr = [];
  const fin = [];
  const split = [];
  const whole = [];
  let i = 0;
  let lastLock = 0;

  words.forEach((word, li) => {
    const y = baselines[li];
    for (const { g, x } of layout(F.bold, word, size, tracking).glyphs) {
      const gx = x0 + x;
      const appear = start + i * stagger;
      const lock = appear + churn + rand() * 0.06;
      lastLock = Math.max(lastLock, lock);
      for (let k = 0; k < steps; k++) {
        const ch = GLYPHS[Math.floor(rand() * GLYPHS.length)];
        scr.push(`<path d="${glyphFor(F.bold, ch).getPath(gx, y, size).toPathData(1)}" class="scr" style="animation-delay:${r2(appear + (k * churn) / steps)}s"/>`);
      }
      const d = g.getPath(gx, y, size).toPathData(1);
      fin.push(`<path d="${d}" class="fin" style="animation-delay:${r2(lock)}s"/>`);
      split.push(`<path d="${d}" class="sp sp1" style="animation-delay:${r2(lock)}s"/><path d="${d}" class="sp sp2" style="animation-delay:${r2(lock)}s"/>`);
      whole.push(d);
      i++;
    }
  });

  const decoded = r2(lastLock + 0.35);
  const allD = whole.join('');
  // Lean like the portfolio's italic title, pivoting on the last baseline.
  const skew = `translate(0 ${baselines[1]}) skewX(-9) translate(0 ${-baselines[1]})`;

  const css = `
.scr{fill:${C.gold};opacity:0;filter:blur(.5px);animation:scr ${r2(churn / steps)}s linear none}
@keyframes scr{from,to{opacity:.72}}
.fin{fill:${C.text};opacity:0;transform-box:fill-box;transform-origin:50% 100%;animation:lock .3s cubic-bezier(.16,1,.3,1) forwards}
@keyframes lock{0%{opacity:.5;fill:${C.gold};transform:translateY(-6px) skewX(8deg)}45%{opacity:1;fill:${C.cream};transform:skewX(-3deg)}100%{opacity:.94;fill:${C.text};transform:none}}
.sp{opacity:0;animation:sp .3s ease-out none}
.sp1{fill:${C.sepia};transform:translateX(2px)}.sp2{fill:${C.goldLight};transform:translateX(-2px)}
@keyframes sp{0%{opacity:.75}100%{opacity:0}}
.b1,.b2{opacity:0;filter:blur(.8px);animation:9s steps(1,end) infinite}
.b1{fill:${C.goldLight};animation-name:b1;animation-delay:${r2(decoded + 1)}s}
.b2{fill:${C.sepia};animation-name:b2;animation-delay:${r2(decoded + 1.08)}s}
@keyframes b1{0%,92%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}93%{opacity:.4;transform:translate(-4px,-2px);clip-path:inset(8% 0 64% 0)}95%{opacity:.35;transform:translate(3px,1px);clip-path:inset(52% 0 22% 0)}97%{opacity:0}}
@keyframes b2{0%,92%,100%{opacity:0;transform:none;clip-path:inset(0 0 100% 0)}93%{opacity:.4;transform:translate(4px,2px);clip-path:inset(70% 0 8% 0)}95%{opacity:.35;transform:translate(-3px,-1px);clip-path:inset(18% 0 56% 0)}97%{opacity:0}}
${fadeCss}
${reducedMotion('.scr,.sp,.b1,.b2{display:none}.fin{animation:none;opacity:.94}.in{animation:none;opacity:1}')}`;

  const inner = `
${glow(800, 110, 330, -60, 40, 16)}
${glow(150, 380, 280, 70, -30, 21)}
${asterisk(820, 190, 86)}
<g class="in" style="animation-delay:.1s">
  ${label(HERO.role, x0, 58, { size: 10.5 })}
  ${label(HERO.where, W - 56, 58, { fill: C.text, opacity: 0.4, size: 10.5, anchor: 'end' })}
</g>
<g transform="${skew}">
  ${scr.join('')}${split.join('')}${fin.join('')}
  <path d="${allD}" class="b1"/><path d="${allD}" class="b2"/>
</g>
<g class="in" style="animation-delay:${decoded}s">${txt(F.serif, HERO.line, x0, 310, 25, { fill: C.cream, opacity: 0.9 })}</g>`;

  write('hero.svg', `${svgOpen(W, H, `${HERO.name} — ${HERO.role}. ${HERO.line}`)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs })}</svg>`);
}

// ─── 2. fastfetch: the dev setup as identity ─────────────────────────────────

function fastfetch() {
  const size = 14.5;
  const lh = 25;
  const x0 = 30;
  const cmd = typedCommand('t0', 'fastfetch', x0, 78, 0.5);
  const t0 = cmd.end + 0.25;
  const ix = 360;
  const keyW = measure(F.monoBold, 'MMMMMMMM', size);
  const [user, host] = SYSTEM.host.split('@');
  let y = 128;
  const rows = [];
  rows.push(`<g class="in" style="animation-delay:${r2(t0)}s">${runs([
    { t: user, fill: C.gold, font: F.monoBold, size },
    { t: '@', fill: C.muted, size },
    { t: host, fill: C.gold, font: F.monoBold, size },
  ], ix, y)}</g>`);
  y += 14;
  rows.push(`<line x1="${ix}" y1="${y}" x2="${r2(ix + measure(F.mono, SYSTEM.host, size))}" y2="${y}" stroke="${C.border}" class="in" style="animation-delay:${r2(t0)}s"/>`);
  y += 26;
  SYSTEM.rows.forEach(([k, v], i) => {
    rows.push(`<g class="in" style="animation-delay:${r2(t0 + 0.05 * (i + 1))}s">${txt(F.monoBold, k, ix, y, size, { fill: C.gold })}${txt(F.mono, v, ix + keyW, y, size, { opacity: 0.85 })}</g>`);
    y += lh;
  });
  y += 8;
  const palette = [C.bg, C.bar, C.border, C.muted, C.sepia, C.gold, C.goldLight, C.cream];
  const swatches = palette.map((c, i) => `<rect x="${ix + i * 30}" y="${y}" width="26" height="14" rx="3" fill="${c}" stroke="${C.border}"/>`).join('');
  rows.push(`<g class="in" style="animation-delay:${r2(t0 + 0.05 * (SYSTEM.rows.length + 2))}s">${swatches}</g>`);
  const H = y + 40;
  const logoY = r2((128 + y + 14) / 2);

  const css = `${fadeCss}
.logo{opacity:0;animation:in 1.2s cubic-bezier(.16,1,.3,1) ${r2(t0)}s forwards}
${reducedMotion('.in,.logo{animation:none;opacity:1}')}`;
  const inner = `
${chrome(W, `${SYSTEM.host}: ~`, 'fish')}
${glow(185, logoY, 220, 20, -20, 15)}
${cmd.svg}
<g class="logo">
  ${asterisk(185, logoY, 92, { opacity: 0.85, dur: 30, width: 2 })}
  ${asterisk(185, logoY, 56, { opacity: 0.35, dur: 22, width: 1 })}
</g>
${rows.join('\n')}`;
  write('fastfetch.svg', `${svgOpen(W, H, `fastfetch — ${SYSTEM.rows.map(([k, v]) => `${k}: ${v}`).join(', ')}`)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs + cmd.defs, rx: 16 })}</svg>`);
}

// ─── 4. Now: latest push + languages (live) ──────────────────────────────────

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

function ago(iso, today) {
  const m = Math.max(0, Math.round((today - Date.parse(iso)) / 60000));
  if (m < 60) return m <= 1 ? 'hace un momento' : `hace ${m} minutos`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`;
  const mo = Math.round(d / 30);
  return mo === 1 ? 'hace 1 mes' : `hace ${mo} meses`;
}

function now(data, today) {
  const H = 232;
  const x0 = 44;
  const rx = 560;
  const shades = [C.cream, C.goldLight, C.gold, C.sepia, C.dim];
  const parts = [];

  if (data.latest) {
    const repo = truncate(F.bold, data.latest.repo, 34, 460);
    const msg = truncate(F.mono, sanitize(F.mono, data.latest.message), 13, 440);
    parts.push(`<g class="in" style="animation-delay:.2s">${label('último push', x0, 92, { fill: C.text, opacity: 0.4, size: 9.5 })}</g>`);
    parts.push(`<g class="in" style="animation-delay:.3s">${txt(F.bold, repo, x0, 134, 34, { tracking: -0.03 })}</g>`);
    parts.push(`<g class="in" style="animation-delay:.42s">${runs([{ t: `${PROMPT} `, fill: C.gold, size: 13 }, { t: msg, size: 13, opacity: 0.7 }], x0, 164)}</g>`);
    parts.push(`<g class="in" style="animation-delay:.54s">${txt(F.serif, ago(data.latest.date, today), x0, 198, 17, { fill: C.cream, opacity: 0.8 })}</g>`);
  }

  // Language bar: segments grow in sequence.
  const barW = W - 44 - rx;
  let bx = rx;
  const bar = [];
  const legend = [];
  data.languages.forEach((l, i) => {
    const w = Math.max(2, l.pct * barW);
    bar.push(`<rect x="${r2(bx)}" y="104" width="${r2(Math.max(1, w - 2))}" height="8" rx="2" fill="${shades[i]}" class="grow" style="animation-delay:${r2(0.4 + i * 0.12)}s"/>`);
    bx += w;
    const lx = rx + (i < 3 ? 0 : 220);
    const ly = 146 + (i % 3) * 26;
    legend.push(`<g class="in" style="animation-delay:${r2(0.6 + i * 0.08)}s"><rect x="${lx}" y="${ly - 9}" width="9" height="9" rx="2" fill="${shades[i]}"/>${txt(F.medium, l.name, lx + 18, ly, 14, { opacity: 0.85 })}${txt(F.mono, `${(l.pct * 100).toFixed(1)}%`, lx + 196, ly, 12, { fill: C.muted, anchor: 'end' })}</g>`);
  });

  const css = `${fadeCss}
.grow{transform-box:fill-box;transform-origin:0 50%;transform:scaleX(0);animation:grow .9s cubic-bezier(.16,1,.3,1) forwards}
@keyframes grow{to{transform:scaleX(1)}}
${reducedMotion('.in{animation:none;opacity:1}.grow{animation:none;transform:none}')}`;
  const inner = `
${glow(900, 40, 240, -40, 30, 18)}
<g class="in">${label('Ahora mismo', x0, 50, { size: 10.5 })}${label(`actualizado ${shortDate(today)}`, W - 44, 50, { fill: C.text, opacity: 0.35, size: 9.5, anchor: 'end' })}</g>
<line x1="${rx - 40}" y1="78" x2="${rx - 40}" y2="${H - 30}" stroke="${C.border}"/>
${parts.join('\n')}
<g class="in" style="animation-delay:.2s">${label('lenguajes · últimos 12 meses', rx, 92, { fill: C.text, opacity: 0.4, size: 9.5 })}</g>
${bar.join('')}
${legend.join('')}`;
  const title = `Ahora mismo: ${data.latest ? `último push en ${data.latest.repo}, ${ago(data.latest.date, today)}. ` : ''}Lenguajes: ${data.languages.map((l) => `${l.name} ${(l.pct * 100).toFixed(0)}%`).join(', ')}`;
  write('now.svg', `${svgOpen(W, H, title)}<style>${css}</style>${frame(W, H, inner, { extraDefs: glowDefs })}</svg>`);
}

// ─── 5. Contributions as a constellation (live) ──────────────────────────────

function constellation(data) {
  const H = 262;
  const weeks = data.weeks;
  const cell = 16.2;
  const gridW = weeks.length * cell;
  const x0 = (W - gridW) / 2 + cell / 2;
  const y0 = 96;
  const radius = [1.1, 1.9, 2.6, 3.3, 4.1];
  const tone = [C.dim, C.sepia, C.gold, C.goldLight, C.cream];

  const dots = [];
  const halos = [];
  const peaks = [];
  const months = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const x = r2(x0 + wi * cell);
    const first = new Date(`${week[0].date}T00:00:00Z`);
    if (first.getUTCMonth() !== lastMonth && first.getUTCDate() <= 7) {
      lastMonth = first.getUTCMonth();
      if (wi < weeks.length - 2) months.push(label(MONTHS[lastMonth], x - 3, y0 + 7 * cell + 18, { fill: C.text, opacity: 0.3, size: 8.5 }));
    }
    let peak = null;
    week.forEach((d) => {
      const y = r2(y0 + new Date(`${d.date}T00:00:00Z`).getUTCDay() * cell);
      const h = Math.abs(hash(d.date));
      const delay = r2(0.2 + wi * 0.025);
      if (!d.count) {
        dots.push(`<circle cx="${x}" cy="${y}" r="${radius[0]}" fill="${tone[0]}" opacity=".7"/>`);
        return;
      }
      const cls = h % 4 === 0
        ? `class="in tw" style="animation-delay:${delay}s,${r2(2 + (h % 7) * 0.6)}s;animation-duration:.8s,${r2(2.4 + (h % 5) * 0.7)}s"`
        : `class="in" style="animation-delay:${delay}s"`;
      dots.push(`<circle cx="${x}" cy="${y}" r="${radius[d.level]}" fill="${tone[d.level]}" ${cls}/>`);
      if (d.level >= 3) halos.push(`<circle cx="${x}" cy="${y}" r="${r2(radius[d.level] * 3)}" fill="url(#halo)" class="in" style="animation-delay:${delay}s"/>`);
      if (!peak || d.count > peak.count) peak = { x, y, count: d.count };
    });
    peaks.push(peak);
  });

  // Constellation lines between each week's brightest star.
  const segs = [];
  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i] && peaks[i - 1]) segs.push(`M${peaks[i - 1].x} ${peaks[i - 1].y}L${peaks[i].x} ${peaks[i].y}`);
  }

  const fmt = (n) => n.toLocaleString('es-CO');
  const statParts = [
    { t: fmt(data.total), font: F.bold, size: 15, fill: C.gold },
    { t: '  CONTRIBUCIONES     ', font: F.medium, size: 9.5, tracking: 0.2, opacity: 0.45 },
    { t: String(data.streak.current), font: F.bold, size: 15, fill: C.gold },
    { t: '  RACHA ACTUAL     ', font: F.medium, size: 9.5, tracking: 0.2, opacity: 0.45 },
    { t: String(data.streak.longest), font: F.bold, size: 15, fill: C.gold },
    { t: '  RACHA MÁS LARGA', font: F.medium, size: 9.5, tracking: 0.2, opacity: 0.45 },
  ];
  const statsW = statParts.reduce((s, p) => s + measure(p.font, p.t, p.size, p.tracking ?? 0), 0);

  const css = `
.in{opacity:0;animation:in .8s ease-out forwards}
@keyframes in{to{opacity:1}}
.tw{animation-name:in,tw;animation-timing-function:ease-out,ease-in-out;animation-iteration-count:1,infinite;animation-fill-mode:forwards,none}
@keyframes tw{0%,100%{opacity:1}50%{opacity:.25}}
.links{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 3.5s ease-in-out 1s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
${reducedMotion('.in,.tw{animation:none;opacity:1}.links{animation:none;stroke-dashoffset:0}')}`;
  const inner = `
${glow(W / 2, 150, 420, 0, 20, 16)}
${label('Un año de commits', 44, 54, { size: 10.5 })}
${runs(statParts, W - 44 - statsW, 55)}
<path d="${segs.join('')}" fill="none" stroke="${C.gold}" stroke-opacity=".28" stroke-width=".8" pathLength="1" class="links"/>
${halos.join('')}
${dots.join('')}
${months.join('')}`;
  write('constellation.svg', `${svgOpen(W, H, `${data.total} contribuciones en el último año. Racha actual: ${data.streak.current} días, racha más larga: ${data.streak.longest} días.`)}<style>${css}</style>${frame(W, H, inner, {
    extraDefs: `${glowDefs}<radialGradient id="halo"><stop offset="0" stop-color="${C.goldLight}" stop-opacity=".35"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></radialGradient>`,
  })}</svg>`);
}

// ─── 6. Ship log: projects as `git log --graph` ──────────────────────────────

function shiplog() {
  const top = 104;
  const rowH = 66;
  const gx = 46;
  const x0 = 72;
  const H = top + SHIPS.length * rowH - 10;
  const rows = SHIPS.map((s, i) => {
    const y = top + i * rowH;
    const sha = (hash(s.name) >>> 0).toString(16).padStart(8, '0').slice(0, 7);
    const deco = [];
    if (i === 0) deco.push({ t: '(', fill: C.muted }, { t: 'HEAD -> main', fill: C.goldLight }, { t: ') ', fill: C.muted });
    if (s.tag) deco.push({ t: '(', fill: C.muted }, { t: `tag: ${s.tag}`, fill: C.goldLight }, { t: ') ', fill: C.muted });
    const head = runs([
      { t: `${sha} `, fill: C.sepia, size: 13.5 },
      ...deco.map((d) => ({ ...d, size: 13.5 })),
      { t: 'feat: ', fill: C.gold, size: 13.5 },
      { t: s.name, font: F.monoBold, size: 13.5 },
    ], x0, y);
    const sub = runs([
      { t: s.what, font: F.light, size: 15, opacity: 0.65 },
      { t: `   ${s.stack}`, size: 11.5, fill: C.muted },
    ], x0, y + 26);
    const kind = label(s.link ? `${s.kind} ${ARROW}` : s.kind, W - 40, y + 4, { fill: C.text, opacity: 0.35, size: 9.5, anchor: 'end' });
    const dot = i === 0
      ? `<circle cx="${gx}" cy="${y - 5}" r="5.5" fill="${C.gold}"/>`
      : `<circle cx="${gx}" cy="${y - 5}" r="5" fill="${C.bg}" stroke="${C.gold}" stroke-width="1.5"/>`;
    return `<g class="in" style="animation-delay:${r2(0.3 + i * 0.14)}s">${dot}${head}${sub}${kind}</g>`;
  });
  const css = `${fadeCss}
.graph{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.6s cubic-bezier(.16,1,.3,1) .2s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
${reducedMotion('.in{animation:none;opacity:1}.graph{animation:none;stroke-dashoffset:0}')}`;
  const inner = `
${glow(880, 60, 260, -30, 40, 19)}
${label('Ship log', 44, 52, { size: 10.5 })}
${txt(F.mono, 'git log --graph --oneline', W - 40, 52, 12, { fill: C.muted, anchor: 'end' })}
<line x1="${gx}" y1="${top - 5}" x2="${gx}" y2="${H - 34}" stroke="url(#gl)" stroke-width="1.5" pathLength="1" class="graph"/>
${rows.join('\n')}`;
  write('shiplog.svg', `${svgOpen(W, H, `Ship log: ${SHIPS.map((s) => `${s.name} — ${s.what}`).join('; ')}`)}<style>${css}</style>${frame(W, H, inner, {
    extraDefs: `${glowDefs}<linearGradient id="gl" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${H - 34}"><stop offset="0" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.border}"/></linearGradient>`,
  })}</svg>`);
}

// ─── 7. Footer, buttons, divider ─────────────────────────────────────────────

function footer() {
  const lh = 42;
  const H = 110 + FOOTER.length * lh;
  const css = `${fadeCss}${reducedMotion('.in{animation:none;opacity:1}')}`;
  const lines = FOOTER.map((line, i) =>
    `<g class="in" style="animation-delay:${r2(0.2 + i * 0.2)}s">${txt(F.serif, line, W / 2, 98 + i * lh, 32, { fill: i ? 'url(#fg)' : C.text, anchor: 'middle' })}</g>`);
  const inner = `
${glow(W / 2, H, 360, 0, -20, 14)}
${asterisk(W / 2, 40, 12, { opacity: 0.7, dur: 18 })}
${lines.join('\n')}`;
  write('footer.svg', `${svgOpen(W, H, FOOTER.join(' '))}<style>${css}</style>${frame(W, H, inner, {
    extraDefs: `${glowDefs}<linearGradient id="fg" x1="0" x2="1"><stop offset="0.3" stop-color="${C.goldLight}"/><stop offset="0.7" stop-color="${C.sepia}"/></linearGradient>`,
  })}</svg>`);
}

function button(slug, text) {
  const h = 46;
  const t = text.toUpperCase();
  const w = Math.ceil(measure(F.medium, t, 11, 0.22) + 64);
  write(`btn-${slug}.svg`, `${svgOpen(w, h, text)}
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.goldLight}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></linearGradient><clipPath id="b"><rect width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>
<g clip-path="url(#b)">
  <rect width="${w}" height="${h}" fill="${C.bar}"/>
  <rect x="-80" width="60" height="${h}" fill="url(#g)"><animate attributeName="x" values="-80;${w + 20};${w + 20}" keyTimes="0;0.3;1" dur="6s" repeatCount="indefinite"/></rect>
</g>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${h / 2 - 0.5}" fill="none" stroke="${C.border}"/>
${txt(F.medium, t, 24, h / 2 + 4, 11, { tracking: 0.22, opacity: 0.88 })}
${txt(F.medium, ARROW, w - 22, h / 2 + 5, 14, { fill: C.gold, anchor: 'end' })}
</svg>`);
}

function divider() {
  const H = 28;
  write('divider.svg', `${svgOpen(W, H, 'divider')}
<defs>
  <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${C.border}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.border}"/><stop offset="1" stop-color="${C.border}" stop-opacity="0"/></linearGradient>
  <linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="${C.goldLight}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.goldLight}"/><stop offset="1" stop-color="${C.goldLight}" stop-opacity="0"/></linearGradient>
</defs>
<rect x="0" y="${H / 2}" width="${W}" height="1" fill="url(#l)"/>
<rect x="-200" y="${H / 2 - 0.5}" width="180" height="2" fill="url(#s)"><animate attributeName="x" values="-200;${W + 20};${W + 20}" keyTimes="0;0.45;1" dur="8s" repeatCount="indefinite"/></rect>
<rect x="${W / 2 - 4}" y="${H / 2 - 4}" width="8" height="8" fill="${C.bg}" stroke="${C.gold}" transform="rotate(45 ${W / 2} ${H / 2})"/>
</svg>`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

console.log('Building profile assets…');
hero();
fastfetch();
shiplog();
footer();
button('portfolio', 'Portafolio');
button('linkedin', 'LinkedIn');
button('email', 'Email');
divider();

const activity = await fetchActivity(LOGIN).catch((e) => {
  console.warn(`  ! live data unavailable: ${e.message}`);
  return null;
});
if (activity) {
  const today = new Date();
  now(activity, today);
  constellation(activity);
} else {
  console.log('  (no GitHub token: now.svg and constellation.svg left unchanged)');
}
console.log('Done.');
