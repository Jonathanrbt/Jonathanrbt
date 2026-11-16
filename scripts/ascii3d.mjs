// Software 3D → ASCII renderer.
//
// The reference is a three.js scene drawn through AsciiEffect with the ramp
// " .:-+*=%@#". GitHub cannot run WebGL in a README, so the same idea is baked
// here: a surface is sampled densely, rotated, projected onto a character grid
// with a z-buffer, lit, and each cell takes the ramp character of its
// brightness. The result is a list of frames (arrays of strings) that the SVG
// flips through.

export const RAMP = ' .:-+*=%@#';

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// three.js TorusKnotGeometry(radius, tube, tubularSegments, radialSegments, p, q).
export function torusKnot({ radius = 1, tube = 0.2, p = 2, q = 3, nu = 1400, nv = 56 } = {}) {
  const curve = (u) => {
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cs = Math.cos((q / p) * u);
    return [radius * (2 + cs) * 0.5 * cu, radius * (2 + cs) * su * 0.5, radius * Math.sin((q / p) * u) * 0.5];
  };
  const pts = [];
  for (let i = 0; i < nu; i++) {
    const u = (i / nu) * p * Math.PI * 2;
    const P1 = curve(u);
    const P2 = curve(u + 0.01);
    const T = [P2[0] - P1[0], P2[1] - P1[1], P2[2] - P1[2]];
    const N0 = [P2[0] + P1[0], P2[1] + P1[1], P2[2] + P1[2]];
    const B = norm(cross(T, N0));
    const N = norm(cross(B, T));
    for (let j = 0; j < nv; j++) {
      const v = (j / nv) * Math.PI * 2;
      const cx = -tube * Math.cos(v);
      const cy = tube * Math.sin(v);
      const n = [cx * N[0] + cy * B[0], cx * N[1] + cy * B[1], cx * N[2] + cy * B[2]];
      pts.push({ p: [P1[0] + n[0], P1[1] + n[1], P1[2] + n[2]], n: norm(n) });
    }
  }
  return pts;
}

// Classic donut.c torus: ring radius R, tube radius r.
export function torus({ R = 1, r = 0.45, nu = 220, nv = 90 } = {}) {
  const pts = [];
  for (let i = 0; i < nu; i++) {
    const u = (i / nu) * Math.PI * 2;
    for (let j = 0; j < nv; j++) {
      const v = (j / nv) * Math.PI * 2;
      const n = [Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v)];
      pts.push({ p: [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)], n });
    }
  }
  return pts;
}

function rotate([x, y, z], ax, ay, az) {
  let c = Math.cos(ax); let s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay); s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(az); s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

// Lights mirror the reference scene: ambient + point (10,10,10) + directional (-10,-10,-5).
const L1 = norm([10, 10, 10]);
const L2 = norm([-10, -10, -5]);

/**
 * Renders `frames` frames of one full turn.
 * spin(t) -> [ax, ay, az] for t in [0, 1).
 * aspect = character height / width, so circles stay round on the grid.
 */
export function renderFrames(points, { cols, rows, frames, spin, scale, aspect = 2, camera = 5, ambient = 0.18 }) {
  const out = [];
  for (let f = 0; f < frames; f++) {
    const [ax, ay, az] = spin(f / frames);
    const zbuf = new Float32Array(cols * rows).fill(-Infinity);
    const lum = new Float32Array(cols * rows);
    for (const { p, n } of points) {
      const [x, y, z] = rotate(p, ax, ay, az);
      const ooz = 1 / (camera - z);
      const c = Math.round(cols / 2 + x * ooz * scale * aspect);
      const r = Math.round(rows / 2 - y * ooz * scale);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const k = r * cols + c;
      if (ooz <= zbuf[k]) continue;
      zbuf[k] = ooz;
      const nn = rotate(n, ax, ay, az);
      lum[k] = ambient + 0.62 * Math.max(0, dot(nn, L1)) + 0.5 * Math.max(0, dot(nn, L2));
    }
    const lines = [];
    for (let r = 0; r < rows; r++) {
      let s = '';
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (zbuf[k] === -Infinity) { s += ' '; continue; }
        const idx = 1 + Math.min(RAMP.length - 2, Math.floor(Math.min(1, lum[k]) * (RAMP.length - 1)));
        s += RAMP[idx];
      }
      lines.push(s);
    }
    out.push(lines);
  }
  return out;
}
