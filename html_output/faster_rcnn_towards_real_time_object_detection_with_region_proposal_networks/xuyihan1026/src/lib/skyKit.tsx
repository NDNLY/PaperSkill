// Paper-specific Canvas drawing kit for the Faster R-CNN tutorial.
// One shared visual world: a night observatory where a wide-field survey flags candidate
// patches and a telescope only measures those patches.
// Written once by the coordinator; every packet widget imports from here.
//
// Semantic colors: red = failure / old method, blue = guidance / current,
// green = success / paper method, orange = user emphasis, purple = auxiliary.

import { useEffect, useRef, useState } from 'react';
import { setupCanvas, observeCanvas, clamp, lerp } from './canvasKit';

export const COLORS = {
  sky: '#101826',
  sky2: '#1b2434',
  grid: '#3b4a63',
  star: '#e8c26a',
  frame: '#f0b429',
  rail: '#92400e',
  route: '#4f8cc9',
  good: '#228d5c',
  bad: '#c43f52',
  aux: '#a78bfa',
  fader: '#f07e47',
  ink: '#e8edf5',
  muted: '#8a97ad',
  axis: '#2a3547',
} as const;

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif';

/** Night field, survey grid, mount rail, optional <=8-char corner label. */
export function clearScene(ctx: CanvasRenderingContext2D, w: number, h: number, label?: string): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, w, h);
  // subtle vignette
  const g = ctx.createRadialGradient(w / 2, h * 0.35, 40, w / 2, h * 0.35, w * 0.75);
  g.addColorStop(0, 'rgba(59,74,99,0.30)');
  g.addColorStop(1, 'rgba(16,24,38,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // mount rail
  ctx.fillStyle = COLORS.rail;
  ctx.fillRect(0, h - 8, w, 8);
  if (label) drawLabel(ctx, label, 12, 20, { color: COLORS.muted, size: 13 });
}

/** A star point with a soft glow. kind = point | bright | faint */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  opts: { kind?: 'point' | 'bright' | 'faint'; color?: string } = {}
): void {
  const kind = opts.kind ?? 'point';
  const color = opts.color ?? COLORS.star;
  const radius = kind === 'bright' ? r * 1.6 : kind === 'faint' ? r * 0.7 : r;
  if (kind === 'bright') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.5);
    g.addColorStop(0, 'rgba(232,194,106,0.55)');
    g.addColorStop(1, 'rgba(232,194,106,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = kind === 'faint' ? 'rgba(232,194,106,0.55)' : color;
  ctx.fill();
}

/** A bounding frame (anchor or proposal). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  opts: { color?: string; alpha?: number; dashed?: boolean; weight?: number; label?: string } = {}
): void {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.strokeStyle = opts.color ?? COLORS.frame;
  ctx.lineWidth = opts.weight ?? 2;
  if (opts.dashed) ctx.setLineDash([6, 5]);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  if (opts.label) drawLabel(ctx, opts.label, cx - w / 2, cy - h / 2 - 6, { color: COLORS.muted, size: 13 });
}

/** The 3x3 anchor frames around one cell. `activeIndex` highlights one of them. */
export function drawAnchorSet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  base: number,
  opts: { activeIndex?: number } = {}
): void {
  const scales = [0.55, 1, 1.9];
  const ratios: Array<[number, number]> = [
    [1, 1],
    [0.62, 1.6],
    [1.6, 0.62],
  ];
  let i = 0;
  for (const s of scales) {
    for (const [rx, ry] of ratios) {
      const w = base * s * rx;
      const h = base * s * ry;
      const on = opts.activeIndex === i;
      drawFrame(ctx, cx, cy, w, h, {
        color: on ? COLORS.fader : COLORS.frame,
        alpha: on ? 1 : 0.45,
        weight: on ? 3 : 1.5,
        dashed: !on,
      });
      i += 1;
    }
  }
}

/** A survey camera / telescope icon. */
export function drawScope(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  opts: { pointing?: boolean; accent?: string } = {}
): void {
  const accent = opts.accent ?? COLORS.route;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // tripod
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, 22);
  ctx.moveTo(0, 0);
  ctx.lineTo(8, 22);
  ctx.strokeStyle = COLORS.rail;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // tube
  ctx.save();
  ctx.rotate(opts.pointing ? -0.45 : 0);
  ctx.beginPath();
  ctx.rect(-16, -9, 32, 13);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // barrel opening
  ctx.beginPath();
  ctx.rect(14, -11, 5, 17);
  ctx.fillStyle = COLORS.frame;
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** Feature-map grid with one live cell. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  opts: { highlight?: { r: number; c: number }; windowRadius?: number } = {}
): void {
  const cw = w / cols;
  const ch = h / rows;
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  for (let c = 0; c <= cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(x + c * cw, y);
    ctx.lineTo(x + c * cw, y + h);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * ch);
    ctx.lineTo(x + w, y + r * ch);
    ctx.stroke();
  }
  if (opts.highlight) {
    const { r, c } = opts.highlight;
    const rad = opts.windowRadius ?? 0;
    ctx.fillStyle = 'rgba(79,140,201,0.18)';
    ctx.fillRect(x + (c - rad) * cw, y + (r - rad) * ch, cw * (2 * rad + 1), ch * (2 * rad + 1));
    ctx.strokeStyle = COLORS.route;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + (c - rad) * cw, y + (r - rad) * ch, cw * (2 * rad + 1), ch * (2 * rad + 1));
  }
  ctx.restore();
}

/** Horizontal meter, semantic coloring. 'down' = lower is better. */
export function drawMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  opts: { direction?: 'up' | 'down'; label?: string; axisMax?: number; muted?: boolean } = {}
): void {
  const direction = opts.direction ?? 'up';
  const v = clamp(value, 0, 1);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = 'rgba(42,53,71,0.85)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.grid;
  ctx.stroke();
  const good = direction === 'up' ? v : 1 - v;
  const color = opts.muted ? COLORS.muted : good > 0.66 ? COLORS.good : good < 0.33 ? COLORS.bad : COLORS.route;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1.5, y + 1.5, Math.max(0, (w - 3) * v), h - 3);
  if (opts.axisMax !== undefined) {
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'right';
    ctx.fillText(String(opts.axisMax), x + w, y - 6);
  }
  if (opts.label) drawLabel(ctx, opts.label, x, y + h + 18, { color: COLORS.muted, size: 13 });
}

/** A proposal list panel with N rows; one row may be highlighted. */
export function drawList(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { rows: number; highlight?: number }
): void {
  const rows = Math.max(1, opts.rows);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fillStyle = 'rgba(27,36,52,0.92)';
  ctx.fill();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const rowH = (h - 12) / rows;
  for (let i = 0; i < rows; i += 1) {
    const ry = y + 6 + i * rowH;
    if (opts.highlight === i) {
      ctx.fillStyle = 'rgba(79,140,201,0.25)';
      ctx.fillRect(x + 4, ry, w - 8, rowH - 2);
    }
    ctx.beginPath();
    ctx.moveTo(x + 10, ry + rowH * 0.5);
    ctx.lineTo(x + w - 14, ry + rowH * 0.5);
    ctx.strokeStyle = opts.highlight === i ? COLORS.route : COLORS.grid;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/** In-Canvas label, capped at 8 characters by convention. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color?: string; size?: number; align?: CanvasTextAlign; bold?: boolean } = {}
): void {
  ctx.save();
  ctx.font = `${opts.bold ? '600 ' : ''}${opts.size ?? 15}px ${FONT}`;
  ctx.fillStyle = opts.color ?? COLORS.ink;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text.slice(0, 8), x, y);
  ctx.restore();
}

/** One compact legend of at most 3 entries. */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  items: Array<{ color: string; text: string }>
): void {
  const shown = items.slice(0, 3);
  ctx.save();
  ctx.font = `13px ${FONT}`;
  ctx.textBaseline = 'middle';
  let cx = x;
  shown.forEach((item) => {
    ctx.beginPath();
    ctx.arc(cx + 5, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'left';
    ctx.fillText(item.text, cx + 15, y);
    cx += 15 + ctx.measureText(item.text).width + 26;
  });
  ctx.restore();
}

export { clamp, lerp };

/** Shared canvas hook: HiDPI, off-screen pausing, rAF loop, `is-ready`. */
export function useCanvas<T>(
  draw: (ctx: CanvasRenderingContext2D, time: number, state: T) => void,
  w: number,
  h: number,
  stateRef: React.MutableRefObject<T>
): { ref: React.RefObject<HTMLCanvasElement>; ready: boolean } {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D;
    try {
      ctx = setupCanvas(canvas, w, h);
    } catch {
      return;
    }
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    let raf: number | null = null;
    const tick = (time: number) => {
      drawRef.current(ctx, time, stateRef.current);
      if (!canvas.classList.contains('is-ready')) {
        canvas.classList.add('is-ready');
        setReady(true);
      }
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };
    const start = () => {
      if (raf === null) raf = requestAnimationFrame(tick);
    };
    const disconnect = observeCanvas(canvas, start, stop);
    return () => {
      stop();
      disconnect();
    };
  }, [w, h, stateRef]);

  return { ref, ready };
}
