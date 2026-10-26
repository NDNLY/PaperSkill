// hero-old · left panel of the cover comparison (520x140, control-free).
//
// Old way: the telescope is dragged cell by cell across the whole sky, so the red time
// bar underneath grows to almost full width by the end of the pass.
// One moving subject: the scope. Two static props: the survey grid and the time bar.
// Everything is a function of `time` over one continuous 2.4 s loop.

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
const CELLS = COLS * ROWS;
const LOOP = 2400;

type Star = [number, number, number, 'point' | 'bright' | 'faint'];

// The same sky field as the right panel, so only the method differs.
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

/** Centre of survey cell `i`, walked left-to-right then right-to-left (snake). */
function cellCenter(i: number): { x: number; y: number; cw: number; ch: number } {
  const cw = BAND.w / COLS;
  const ch = BAND.h / ROWS;
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return { x: BAND.x + (col + 0.5) * cw, y: BAND.y + (row + 0.5) * ch, cw, ch };
}

export const HeroOld: React.FC<WidgetProps> = () => {
  const stateRef = useRef<Record<string, never>>({});
  const { ref } = useCanvas<Record<string, never>>(
    (ctx, time) => {
      clearScene(ctx, W, H);
      for (const [sx, sy, r, kind] of STARS) drawStar(ctx, sx, sy, r, { kind });
      drawGrid(ctx, BAND.x, BAND.y, BAND.w, BAND.h, COLS, ROWS);

      // One slot per cell: hold, then slide on to the next cell.
      const p = (time % LOOP) / LOOP;
      const slot = p * CELLS;
      const i = Math.min(CELLS - 1, Math.floor(slot));
      const k = clamp((slot - i - 0.58) / 0.42, 0, 1);
      const e = k * k * (3 - 2 * k);
      const from = cellCenter(i);
      const to = cellCenter((i + 1) % CELLS);
      const x = lerp(from.x, to.x, e);
      const y = lerp(from.y, to.y, e);

      // The window is carried along with the scope: one dragged unit, one cell per slot.
      drawFrame(ctx, x, y, from.cw - 8, from.ch - 8, {
        color: COLORS.frame,
        weight: 2,
        alpha: 0.85,
      });
      drawScope(ctx, x, y - 4, 0.85, { accent: COLORS.bad });

      drawLabel(ctx, '逐格搬镜', BAR.x + 2, 96, { color: COLORS.bad, size: 14, bold: true });
      // Longer is worse, so the meter colours the long bar red on its own.
      drawMeter(ctx, BAR.x, BAR.y, BAR.w, BAR.h, 0.8 + 0.16 * p, { direction: 'down' });
    },
    W,
    H,
    stateRef
  );
  return <canvas ref={ref} width={W} height={H} />;
};

export default HeroOld;
