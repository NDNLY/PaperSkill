import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawLegend,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Analogy (560x140): a hand slides the survey frame one cell to the right across the
// star chart, and the target patch lights up. One moving subject (hand + frame),
// one goal (reach the next cell), one continuous 3.2 s loop. No controls.

const W = 560;
const H = 140;
const COLS = 7;
const ROWS = 3;
const GX = 24;
const GY = 18;
const CW = 73;
const CH = 28;
const LOOP_MS = 3200;

const hash = (r: number, c: number, i: number) => {
  const v = Math.sin(r * 127.1 + c * 311.7 + i * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// A simple light hand silhouette that reaches left, toward the frame it is pushing.
function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const tips: Array<[number, number]> = [
    [-18, -9],
    [-21, -2],
    [-18, 5],
    [-12, 9],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Dark halo keeps the hand readable over light record slips.
  ctx.strokeStyle = COLORS.sky;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  tips.forEach(([dx, dy]) => {
    ctx.moveTo(x + 3, y + dy * 0.35);
    ctx.lineTo(x + dx, y + dy);
  });
  ctx.stroke();
  ctx.fillStyle = COLORS.sky;
  ctx.beginPath();
  ctx.ellipse(x + 9, y, 12, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 15, y - 8.5, 14, 17);

  // Palm, four fingers reaching left, thumb.
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = COLORS.ink;
  ctx.lineWidth = 2.6;
  tips.forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + dy * 0.35);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.ellipse(x + 9, y, 9.5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 6);
  ctx.lineTo(x + 12, y + 12);
  ctx.stroke();

  // Wrist, so the silhouette reads as a hand reaching in.
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(x + 15, y - 6.5, 12, 13);
  ctx.restore();
}
export const Ch2Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef(0);

  const { ref } = useCanvas(
    (ctx, time) => {
      clearScene(ctx, W, H);

      const t = (time % LOOP_MS) / LOOP_MS;
      const slide = easeInOut(clamp((t - 0.08) / 0.5, 0, 1));
      const col = 1 + slide; // left edge of the 2-cell-wide frame, in cell units
      const fx = GX + col * CW;
      const fy = GY + CH;

      // Cells currently under the frame.
      ctx.save();
      ctx.globalAlpha = 0.17;
      ctx.fillStyle = COLORS.route;
      const c0 = Math.floor(col);
      for (let c = c0; c <= c0 + 1; c += 1) {
        for (let r = 1; r <= 2; r += 1) {
          ctx.fillRect(GX + c * CW + 1, GY + r * CH + 1, CW - 2, CH - 2);
        }
      }
      ctx.restore();

      // The patch the frame is heading for lights up once it arrives.
      const arrival = clamp((slide - 0.78) / 0.22, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.07 + 0.14 * arrival;
      ctx.fillStyle = COLORS.frame;
      ctx.fillRect(GX + 2 * CW + 1, GY + CH + 1, 2 * CW - 2, 2 * CH - 2);
      ctx.restore();

      // Faint survey grid.
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      for (let c = 0; c <= COLS; c += 1) {
        ctx.beginPath();
        ctx.moveTo(GX + c * CW, GY);
        ctx.lineTo(GX + c * CW, GY + ROWS * CH);
        ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r += 1) {
        ctx.beginPath();
        ctx.moveTo(GX, GY + r * CH);
        ctx.lineTo(GX + COLS * CW, GY + r * CH);
        ctx.stroke();
      }

      // Scattered stars; one bright target inside the patch ahead.
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const n = 1 + Math.floor(hash(r, c, 1) * 2);
          for (let i = 0; i < n; i += 1) {
            const sx = GX + c * CW + 6 + hash(r, c, i + 2) * (CW - 12);
            const sy = GY + r * CH + 5 + hash(r, c, i + 5) * (CH - 10);
            drawStar(ctx, sx, sy, 1 + hash(r, c, i + 8) * 1.4, {
              kind: hash(r, c, i + 13) > 0.86 ? 'point' : 'faint',
            });
          }
        }
      }
      drawStar(ctx, GX + 3 * CW, GY + 2 * CH, 5, { kind: 'bright' });

      // Moving frame.
      drawFrame(ctx, fx + CW, fy + CH, 2 * CW, 2 * CH, {
        color: COLORS.frame,
        weight: 3,
      });
      drawHand(ctx, fx + 2 * CW + 6, fy + CH + 16);

      drawLegend(ctx, 24, 124, [
        { color: COLORS.frame, text: '取景框' },
        { color: COLORS.route, text: '扫过的格' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} aria-label="一只手把取景框在星图上滑到下一格" />;
};

export default Ch2Ana;
