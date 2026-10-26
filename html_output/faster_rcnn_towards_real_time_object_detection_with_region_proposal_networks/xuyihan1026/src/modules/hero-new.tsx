// hero-new · right panel of the cover comparison (520x140, control-free).
//
// New way: one wide-field frame sweeps the whole sky once, a few bright cells light up
// as it reaches them, and the telescope only ever sits on the mount waiting for those
// candidates. The green time bar stays short the whole time.
// One moving subject: the sweeping frame. Two static props: the survey grid on the
// mount and the parked telescope. Everything is a function of `time` over a 2.4 s loop.

import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawScope,
  drawGrid,
  drawMeter,
  drawLabel,
  clamp,
  lerp,
  useCanvas,
} from '../lib/skyKit';

const W = 520;
const H = 140;
const BAND = { x: 16, y: 8, w: 488, h: 72 };
const BAR = { x: 16, y: 104, w: 488, h: 11 };
const COLS = 6;
const ROWS = 2;
const LOOP = 2400;
const SWEEP_W = 200;

type Star = [number, number, number, 'point' | 'bright' | 'faint'];

// The same sky field as the left panel, so only the method differs.
const STARS: Star[] = [
  [38, 22, 1.6, 'point'],
  [62, 44, 1.1, 'faint'],
  [96, 60, 1.2, 'faint'],
  [150, 18, 2.2, 'bright'],
  [186, 48, 1.3, 'point'],
  [208, 30, 1.3, 'faint'],
  [232, 68, 1.2, 'faint'],
  [268, 26, 1.8, 'point'],
  [300, 70, 1.1, 'faint'],
  [318, 52, 1.3, 'point'],
  [356, 20, 1.1, 'faint'],
  [398, 62, 1.7, 'point'],
  [420, 68, 1.2, 'point'],
  [438, 30, 1.2, 'faint'],
  [478, 44, 1.4, 'point'],
  [500, 18, 1.1, 'faint'],
];

// The three cells whose stars get flagged as candidates.
const CANDIDATES: Array<{ r: number; c: number }> = [
  { r: 0, c: 1 },
  { r: 1, c: 2 },
  { r: 0, c: 3 },
];

function cellCenter(r: number, c: number): { x: number; y: number; cw: number; ch: number } {
  const cw = BAND.w / COLS;
  const ch = BAND.h / ROWS;
  return { x: BAND.x + (c + 0.5) * cw, y: BAND.y + (r + 0.5) * ch, cw, ch };
}

export const HeroNew: React.FC<WidgetProps> = () => {
  const stateRef = useRef<Record<string, never>>({});
  const { ref } = useCanvas<Record<string, never>>(
    (ctx, time) => {
      clearScene(ctx, W, H);
      for (const [sx, sy, r, kind] of STARS) drawStar(ctx, sx, sy, r, { kind });
      drawGrid(ctx, BAND.x, BAND.y, BAND.w, BAND.h, COLS, ROWS);

      const p = (time % LOOP) / LOOP;
      // The wide field enters on the left, covers the whole sky once, leaves on the right.
      const x0 = BAND.x + SWEEP_W / 2;
      const x1 = BAND.x + BAND.w - SWEEP_W / 2;
      const fx = lerp(x0, x1, p);

      // A candidate lights up only once the wide field has reached it.
      const fade = clamp((1 - p) / 0.1, 0, 1);
      for (const { r, c } of CANDIDATES) {
        const cell = cellCenter(r, c);
        const reach = clamp((cell.x - x0) / (x1 - x0), 0, 1);
        const on = clamp((p - reach) / 0.09, 0, 1) * fade;
        if (on <= 0.01) continue;
        drawStar(ctx, cell.x, cell.y, 3, { kind: 'bright' });
        drawFrame(ctx, cell.x, cell.y, cell.cw - 8, cell.ch - 8, {
          color: COLORS.frame,
          weight: 3,
          alpha: on,
        });
      }

      // The single moving subject.
      drawFrame(ctx, fx, BAND.y + BAND.h / 2, SWEEP_W, BAND.h - 6, {
        color: COLORS.route,
        weight: 2.5,
        alpha: 0.95,
      });

      // The telescope stays parked on the mount: it only ever looks where it is told.
      drawScope(ctx, 474, 58, 0.7, { pointing: true, accent: COLORS.aux });

      drawLabel(ctx, '共享特征', BAR.x + 2, 96, { color: COLORS.good, size: 14, bold: true });
      // Shorter is better, so the short bar reads green on its own.
      drawMeter(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 0.1 + 0.06 * p, { direction: 'down' });
    },
    W,
    H,
    stateRef
  );
  return <canvas ref={ref} width={W} height={H} />;
};

export default HeroNew;
