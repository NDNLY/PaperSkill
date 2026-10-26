import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawGrid,
  drawScope,
  drawFrame,
  drawLabel,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Analogy animation for chapter 1 (560x140, control-free, 3.2 s loop):
// a hand pushes the telescope cell by cell along the mount rail towards the goal patch.
// One moving subject (the hand + telescope), one visible goal (the bright target star).

const W = 560;
const H = 140;
const LOOP = 3200;
const COLS = 6;
const ROWS = 2;
const GX = 44;
const GY = 28;
const GW = 470;
const GH = 62;
const CW = GW / COLS;
const STEP_COUNT = COLS - 1;

type StarSpot = { c: number; r: number; bright: boolean };

const STARS: StarSpot[] = [
  { c: 0, r: 0, bright: false },
  { c: 1, r: 1, bright: false },
  { c: 2, r: 0, bright: false },
  { c: 3, r: 1, bright: false },
  { c: 4, r: 0, bright: false },
  { c: 5, r: 0, bright: true },
  { c: 1, r: 0, bright: false },
  { c: 4, r: 1, bright: false },
  { c: 0, r: 1, bright: false },
  { c: 3, r: 0, bright: false },
];

const cellCX = (c: number): number => GX + (c + 0.5) * CW;
const cellCY = (r: number): number => GY + (r + 0.5) * (GH / ROWS);

const smooth = (t: number): number => {
  const v = clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
};

/** A small stylised hand: palm plus three fingers, drawn with palette colours only. */
function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = COLORS.rail;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, 7, 8.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let k = 0; k < 3; k += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 4 + k * 4, y - 4);
    ctx.lineTo(x - 6.5 + k * 4, y - 13);
    ctx.stroke();
  }
  ctx.restore();
}

type AnaState = { reduced: boolean };

export const Ch1Ana: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const stateRef = useRef<AnaState>({
    reduced:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  const { ref } = useCanvas<AnaState>(
    (ctx, time, s) => {
      clearScene(ctx, W, H, '逐格搬镜');

      const p = s.reduced ? 1 : (time % LOOP) / LOOP;
      const travel = clamp(p / 0.86, 0, 1);
      const stepF = travel * STEP_COUNT;
      const a = Math.min(STEP_COUNT, Math.floor(stepF));
      const b = Math.min(STEP_COUNT, a + 1);
      const f = smooth(stepF - a);
      const scopeX = cellCX(a) + (cellCX(b) - cellCX(a)) * f;
      const liveCol = f > 0.5 ? b : a;

      drawGrid(ctx, GX, GY, GW, GH, COLS, ROWS, {
        highlight: { r: 0, c: liveCol },
        windowRadius: 0,
      });

      STARS.forEach((st) => {
        drawStar(ctx, cellCX(st.c), cellCY(st.r), st.bright ? 4 : 2.6, {
          kind: st.bright ? 'bright' : 'point',
        });
      });

      // The mount rail accumulates the distance the telescope has already been dragged.
      ctx.save();
      ctx.fillStyle = COLORS.frame;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(GX, H - 8, Math.max(0, scopeX - GX), 8);
      ctx.restore();

      // The visible goal: the bright target patch, framed.
      drawFrame(ctx, cellCX(5), cellCY(0), CW - 16, GH / ROWS - 12, {
        color: COLORS.frame,
        dashed: true,
        weight: 2,
      });
      drawLabel(ctx, '目标星', cellCX(5) + CW / 2 - 34, cellCY(0) - 12, {
        color: COLORS.frame,
        size: 12,
      });

      // The telescope slides along the mount rail, pushed by the hand.
      drawScope(ctx, scopeX, GY + GH + 12, 0.8, { pointing: true, accent: COLORS.frame });
      drawHand(ctx, scopeX - 21, GY + GH + 6);
    },
    W,
    H,
    stateRef
  );

  return (
    <div data-widget={`${chapterId}-${moduleId}`}>
      <canvas ref={ref} width={W} height={H} />
    </div>
  );
};

export default Ch1Ana;
