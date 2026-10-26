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
  lerp,
} from '../lib/skyKit';

// Analogy (560x140): a hand pushes the frame onto a star's centre; the frame tightens
// until it fits. One moving subject (hand + frame), one goal (centre on the star),
// 3.2 s loop. No controls.

const W = 560;
const H = 140;
const LOOP_MS = 3200;

const STAR = { x: 312, y: 64 };
const START = { x: 168, y: 72, w: 132, h: 76 };
const END = { x: 312, y: 64, w: 62, h: 60 };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const hash = (i: number) => {
  const v = Math.sin(i * 91.7 + 41.3) * 43758.5453;
  return v - Math.floor(v);
};

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
export const Ch6Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef(0);

  const { ref } = useCanvas(
    (ctx, time) => {
      clearScene(ctx, W, H);

      // Fixed background stars.
      for (let i = 0; i < 26; i += 1) {
        drawStar(ctx, 20 + hash(i) * (W - 40), 16 + hash(i + 60) * 96, 1 + hash(i + 120) * 1.2, {
          kind: 'faint',
        });
      }

      const t = (time % LOOP_MS) / LOOP_MS;
      const p = easeInOut(clamp((t - 0.1) / 0.55, 0, 1));
      const x = lerp(START.x, END.x, p);
      const y = lerp(START.y, END.y, p);
      const w = lerp(START.w, END.w, p);
      const h = lerp(START.h, END.h, p);
      const settled = p > 0.82;

      // The star being framed.
      drawStar(ctx, STAR.x, STAR.y, 5, { kind: 'bright' });

      // A short "snap" ring as the frame settles.
      if (settled) {
        const ring = clamp((p - 0.82) / 0.18, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - ring);
        ctx.strokeStyle = COLORS.good;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(STAR.x, STAR.y, 34 + ring * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawFrame(ctx, x, y, w, h, {
        color: settled ? COLORS.good : COLORS.frame,
        weight: 3,
      });
      drawHand(ctx, x + w / 2 + 6, y + 5);

      drawLegend(ctx, 24, 124, [
        { color: COLORS.frame, text: '正在推' },
        { color: COLORS.good, text: '套住了' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} aria-label="一只手把取景框推向星的圆心并收紧" />;
};

export default Ch6Ana;
