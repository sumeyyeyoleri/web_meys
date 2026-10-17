/**
 * Deterministic generator for abstract, painterly SVG placeholder artworks.
 * Used by the seed so the site has visual content without any real assets.
 * Every output is clearly a sample (`isSample = true` in the database).
 */

export type Composition = 'colorField' | 'organic' | 'strokes' | 'horizon' | 'orbits' | 'hills';

export interface Palette {
  ground: string;
  colors: [string, string, string, string];
}

/** Rich but slightly muted palettes on deep grounds, so the works glow on a dark gallery wall. */
export const PALETTES = {
  terracotta: { ground: '#2B1A15', colors: ['#B4532A', '#D9925E', '#5E3A2B', '#E8C9A6'] },
  sea: { ground: '#13221F', colors: ['#2F5D62', '#5E8B7E', '#A7C4BC', '#E8D3A8'] },
  ochre: { ground: '#2A2116', colors: ['#C8963E', '#8C5A1F', '#E9C46A', '#463A28'] },
  dusk: { ground: '#221C27', colors: ['#6B4E71', '#C9A9A6', '#E3B5A4', '#3A2E44'] },
  sage: { ground: '#1C2420', colors: ['#6F8F72', '#A7B89A', '#C9C19B', '#2E3B33'] },
  clay: { ground: '#261C19', colors: ['#9C4A3B', '#D7A48A', '#B9B19E', '#4A3530'] },
  nightBlue: { ground: '#121A26', colors: ['#2F4A6D', '#D9A441', '#7DA2D6', '#E8D3A8'] },
  gold: { ground: '#1E1A12', colors: ['#D4AF6A', '#8A6B3A', '#E8D3A8', '#3B3122'] },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

export interface ArtworkOptions {
  seed: number;
  palette: PaletteName;
  composition: Composition;
  width?: number;
  height?: number;
  title?: string;
}

/** Small, fast, deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Closed, smooth blob through jittered points on an ellipse (Catmull-Rom → cubic Bézier). */
function blobPath(rng: Rng, cx: number, cy: number, rx: number, ry: number, points = 7): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = between(rng, 0.7, 1.2);
    pts.push([cx + Math.cos(angle) * rx * jitter, cy + Math.sin(angle) * ry * jitter]);
  }
  const at = (i: number) => pts[(i + points) % points] as [number, number];
  let d = `M${r1(at(0)[0])},${r1(at(0)[1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0]!)},${r1(c1[1]!)} ${r1(c2[0]!)},${r1(c2[1]!)} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return `${d} Z`;
}

/** Wavy brush stroke across the canvas. */
function strokePath(rng: Rng, w: number, h: number): string {
  const startX = between(rng, -0.1, 0.3) * w;
  const endX = between(rng, 0.7, 1.1) * w;
  const y = between(rng, 0.1, 0.9) * h;
  const amp = between(rng, 0.03, 0.12) * h;
  const segments = 3;
  let d = `M${r1(startX)},${r1(y)}`;
  for (let i = 1; i <= segments; i++) {
    const x = startX + ((endX - startX) * i) / segments;
    const cx = x - (endX - startX) / segments / 2;
    const cy = y + (i % 2 === 0 ? amp : -amp) * between(rng, 0.5, 1.4);
    d += ` Q${r1(cx)},${r1(cy)} ${r1(x)},${r1(y + between(rng, -amp, amp) * 0.4)}`;
  }
  return d;
}

function colorField(rng: Rng, p: Palette, w: number, h: number): string {
  const margin = w * 0.08;
  const bands = 2 + Math.floor(rng() * 2);
  const gap = h * 0.04;
  const bandH = (h - margin * 2 - gap * (bands - 1)) / bands;
  let out = '';
  for (let i = 0; i < bands; i++) {
    const y = margin + i * (bandH + gap);
    const color = p.colors[i % p.colors.length]!;
    out += `<rect x="${r1(margin)}" y="${r1(y)}" width="${r1(w - margin * 2)}" height="${r1(bandH)}" rx="${r1(w * 0.01)}" fill="${color}" opacity="${r1(between(rng, 0.75, 0.95))}" filter="url(#bleed)"/>`;
  }
  return out;
}

function organic(rng: Rng, p: Palette, w: number, h: number): string {
  let out = '';
  const count = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const rx = between(rng, 0.12, 0.32) * w;
    const ry = between(rng, 0.12, 0.32) * h;
    const d = blobPath(rng, between(rng, 0.15, 0.85) * w, between(rng, 0.15, 0.85) * h, rx, ry);
    out += `<path d="${d}" fill="${pick(rng, p.colors)}" opacity="${r1(between(rng, 0.55, 0.9))}" filter="url(#bleed)"/>`;
  }
  return out;
}

function strokes(rng: Rng, p: Palette, w: number, h: number): string {
  let out = `<rect width="${w}" height="${h}" fill="${p.colors[3]}" opacity="0.35"/>`;
  const count = 9 + Math.floor(rng() * 6);
  for (let i = 0; i < count; i++) {
    out += `<path d="${strokePath(rng, w, h)}" fill="none" stroke="${pick(rng, p.colors)}" stroke-width="${r1(between(rng, 0.02, 0.09) * h)}" stroke-linecap="round" opacity="${r1(between(rng, 0.55, 0.9))}" filter="url(#brush)"/>`;
  }
  return out;
}

function horizon(rng: Rng, p: Palette, w: number, h: number): string {
  const horizonY = between(rng, 0.45, 0.65) * h;
  // Shapes overshoot the canvas so the displacement filter never reveals bare edges.
  const bleed = w * 0.05;
  let out = `<rect x="${r1(-bleed)}" y="${r1(-bleed)}" width="${r1(w + bleed * 2)}" height="${r1(horizonY + bleed)}" fill="${p.colors[2]}" opacity="0.55" filter="url(#bleed)"/>`;
  out += `<circle cx="${r1(between(rng, 0.25, 0.75) * w)}" cy="${r1(horizonY * between(rng, 0.4, 0.6))}" r="${r1(between(rng, 0.06, 0.1) * w)}" fill="${p.colors[0]}" opacity="0.85" filter="url(#bleed)"/>`;
  for (let i = 0; i < 4; i++) {
    const y = horizonY + i * ((h - horizonY) / 4);
    const amp = between(rng, 0.02, 0.06) * h;
    const left = -bleed;
    const right = w + bleed;
    const d = `M${r1(left)},${r1(y)} C${r1(w * 0.3)},${r1(y - amp)} ${r1(w * 0.6)},${r1(y + amp)} ${r1(right)},${r1(y - amp / 2)} L${r1(right)},${r1(h + bleed)} L${r1(left)},${r1(h + bleed)} Z`;
    out += `<path d="${d}" fill="${p.colors[(i + 1) % 4]}" opacity="${r1(0.55 + i * 0.1)}" filter="url(#bleed)"/>`;
  }
  return out;
}

function orbits(rng: Rng, p: Palette, w: number, h: number): string {
  let out = '';
  const cx = between(rng, 0.35, 0.65) * w;
  const cy = between(rng, 0.35, 0.65) * h;
  for (let i = 6; i > 0; i--) {
    const r = (Math.min(w, h) * 0.07 * i) * between(rng, 0.9, 1.1);
    out += `<circle cx="${r1(cx + between(rng, -20, 20))}" cy="${r1(cy + between(rng, -20, 20))}" r="${r1(r)}" fill="none" stroke="${p.colors[i % 4]}" stroke-width="${r1(between(rng, 10, 34))}" opacity="${r1(between(rng, 0.5, 0.85))}" filter="url(#brush)"/>`;
  }
  out += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(Math.min(w, h) * 0.06)}" fill="${p.colors[0]}" filter="url(#bleed)"/>`;
  return out;
}

/** Relative luminance-ish brightness of a #RRGGBB colour (0–255). */
function brightness(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/** Layered hills receding into the distance under a sun or moon. */
function hills(rng: Rng, p: Palette, w: number, h: number): string {
  const light = [...p.colors].sort((a, b) => brightness(b) - brightness(a))[0]!;
  const bleed = w * 0.05;
  const orbX = between(rng, 0.2, 0.8) * w;
  const orbY = between(rng, 0.18, 0.32) * h;
  const orbR = between(rng, 0.05, 0.08) * w;
  let out = `<circle cx="${r1(orbX)}" cy="${r1(orbY)}" r="${r1(orbR * 2.4)}" fill="${light}" opacity="0.12" filter="url(#bleed)"/>`;
  out += `<circle cx="${r1(orbX)}" cy="${r1(orbY)}" r="${r1(orbR)}" fill="${light}" opacity="0.9" filter="url(#bleed)"/>`;
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const base = h * (0.42 + i * 0.12);
    const amp = h * between(rng, 0.04, 0.1);
    const peak = between(rng, 0.2, 0.8) * w;
    const d = `M${r1(-bleed)},${r1(base + amp)} C${r1(peak * 0.5)},${r1(base + amp * 0.4)} ${r1(peak - w * 0.1)},${r1(base - amp)} ${r1(peak)},${r1(base - amp)} S${r1(w * 0.9)},${r1(base + amp * 0.6)} ${r1(w + bleed)},${r1(base)} L${r1(w + bleed)},${r1(h + bleed)} L${r1(-bleed)},${r1(h + bleed)} Z`;
    // Back layers are lighter and hazier; front layers darker and denser.
    const color = p.colors[[2, 1, 0, 1, 0][i] as 0 | 1 | 2];
    out += `<path d="${d}" fill="${color}" opacity="${r1(0.35 + i * 0.15)}" filter="url(#bleed)"/>`;
  }
  return out;
}

const COMPOSERS: Record<Composition, (rng: Rng, p: Palette, w: number, h: number) => string> = {
  colorField,
  organic,
  strokes,
  horizon,
  orbits,
  hills,
};

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function generateArtwork(options: ArtworkOptions): string {
  const { seed, composition, width: w = 1200, height: h = 900 } = options;
  const palette = PALETTES[options.palette];
  const rng = mulberry32(seed);
  const body = COMPOSERS[composition](rng, palette, w, h);
  const title = escapeXml(options.title ?? 'Sample artwork');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    <filter id="bleed" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${seed % 1000}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="brush" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04 0.006" numOctaves="2" seed="${(seed * 7) % 1000}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed % 97}" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="${palette.ground}"/>
  ${body}
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
</svg>
`;
}
