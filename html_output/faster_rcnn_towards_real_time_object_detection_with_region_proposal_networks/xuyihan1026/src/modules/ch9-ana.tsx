import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawLegend,
  useCanvas,
  clamp,
  lerp,
} from '../lib/skyKit';

// Analogy (560x140): a hand peels duplicate record slips off the same star until one
// slip remains. One moving subject (hand + the slip it holds), one goal (one record
// per star), 3.4 s loop. No controls.

const W = 560;
const H = 140;
const LOOP_MS = 3400;

const STAR = { x: 200, y: 34 };
const KEPT = { x: 200, y: 88, w: 84, h: 44 };
const DUPS = [
  { x: 124, y: 62, w: 74, h: 40, rot: -0.13, exit: { x: -40, y: 18 } },
  { x: 278, y: 68, w: 74, h: 40, rot: 0.11, exit: { x: 604, y: 26 } },
];
const REST = { x: 470, y: 104 };

const hash = (i: number) => {
  const v = Math.sin(i * 83.3 + 29.7) * 43758.5453;
  return v - Math.floor(v);
};

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function drawSlip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
  color: string,
  alpha: number,
  stamp: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    const ly = -h / 2 + 11 + i * 9;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 8, ly);
    ctx.lineTo(w / 2 - 8, ly);
    ctx.stroke();
  }
  if (stamp) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    ctx.arc(w / 2 - 12, -h / 2 + 11, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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
  ctx.fillRect(x + 17, y - 9, 13, 18);

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

  // Sleeve cuff in the mount-rail copper.
  ctx.fillStyle = COLORS.rail;
  ctx.fillRect(x + 19, y - 8, 10, 16);
  ctx.strokeStyle = COLORS.sky;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 19, y - 8, 10, 16);
  ctx.restore();
}
export const Ch9Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef(0);

  const { ref } = useCanvas(
    (ctx, time) => {
      clearScene(ctx, W, H);

      for (let i = 0; i < 24; i += 1) {
        drawStar(ctx, 18 + hash(i) * (W - 36), 14 + hash(i + 70) * 100, 1 + hash(i + 140), {
          kind: 'faint',
        });
      }
      drawStar(ctx, STAR.x, STAR.y, 5, { kind: 'bright' });

      const t = (time % LOOP_MS) / LOOP_MS;
      const hand = { x: REST.x, y: REST.y };

      DUPS.forEach((d, k) => {
        const start = 0.1 + k * 0.3;
        const q = clamp((t - start) / 0.24, 0, 1);
        if (q >= 1) return; // already peeled away
        const drag = clamp((q - 0.3) / 0.7, 0, 1);
        const e = easeInOut(drag);
        const px = lerp(d.x, d.exit.x, e);
        const py = lerp(d.y, d.exit.y, e);
        drawSlip(ctx, px, py, d.w, d.h, d.rot + e * 0.2, COLORS.muted, 1 - drag * 0.9, false);
        // Hand reaches the slip first, then carries it off the sky.
        if (q > 0) {
          const grab = clamp(q / 0.3, 0, 1);
          if (drag > 0) {
            hand.x = px + 52;
            hand.y = py + 2;
          } else {
            hand.x = lerp(REST.x, d.x + 52, grab);
            hand.y = lerp(REST.y, d.y + 2, grab);
          }
        }
      });

      // The one record that stays.
      drawSlip(ctx, KEPT.x, KEPT.y, KEPT.w, KEPT.h, 0, COLORS.good, 1, true);

      drawHand(ctx, hand.x, hand.y);

      drawLegend(ctx, 318, 18, [
        { color: COLORS.muted, text: '重复记录' },
        { color: COLORS.good, text: '保留一条' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} aria-label="一只手把重复的记录纸抽掉，只留一张" />;
};

export default Ch9Ana;
