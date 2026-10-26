import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawStar, useCanvas, clamp, lerp } from '../lib/skyKit';

// Analogy (560x140): one hand presses the stopwatch, two light points race from the same
// start line, the green one finishes first and stops.
// 3.4 s loop, no controls, skyKit only.

const W = 560;
const H = 140;
const LOOP = 3400;
const X0 = 150;
const X1 = 470;
const LANE_A = 96;
const LANE_B = 118;

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = COLORS.star;
  ctx.strokeStyle = COLORS.star;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * 5, y + 3);
    ctx.lineTo(x + i * 5, y + 9);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 10, y - 3);
  ctx.lineTo(x + 21, y - 11);
  ctx.stroke();
  ctx.restore();
}

export const Ch10Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ tick: 0 });

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D, time: number) => {
      clearScene(ctx, W, H);
      drawStar(ctx, 300, 18, 1.3, { kind: 'faint' });
      drawStar(ctx, 508, 40, 1.2, { kind: 'faint' });

      const t = (time % LOOP) / LOOP;

      // press the stopwatch
      const press = ease(clamp((t - 0.04) / 0.14, 0, 1));
      const withdraw = ease(clamp((t - 0.24) / 0.14, 0, 1));
      const handX = lerp(lerp(250, 86, press), 208, withdraw);
      const handY = lerp(lerp(8, 22, press), 4, withdraw);
      const handAlpha = 1 - clamp((t - 0.34) / 0.12, 0, 1);

      // stopwatch
      const sweep = clamp((t - 0.28) / 0.52, 0, 1);
      const needle = -Math.PI / 2 + sweep * Math.PI * 3;
      ctx.save();
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(86, 52, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.rail;
      ctx.fillRect(82, 32, 8, 5);
      ctx.strokeStyle = COLORS.star;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(86, 52);
      ctx.lineTo(86 + Math.cos(needle) * 11, 52 + Math.sin(needle) * 11);
      ctx.stroke();
      ctx.globalAlpha = 1 - clamp((t - 0.2) / 0.1, 0, 1) * 0.4;
      ctx.strokeStyle = COLORS.frame;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(86 + Math.cos(a) * 13, 52 + Math.sin(a) * 13);
        ctx.lineTo(86 + Math.cos(a) * 16, 52 + Math.sin(a) * 16);
        ctx.stroke();
      }
      ctx.restore();

      // press flash
      if (t > 0.14 && t < 0.34) {
        ctx.save();
        ctx.globalAlpha = 1 - clamp((t - 0.14) / 0.2, 0, 1);
        ctx.strokeStyle = COLORS.frame;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(86, 33, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // the two lanes
      ctx.save();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(X0, LANE_A);
      ctx.lineTo(X1, LANE_A);
      ctx.moveTo(X0, LANE_B);
      ctx.lineTo(X1, LANE_B);
      ctx.stroke();
      ctx.restore();

      // finish post
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = COLORS.star;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(X1, 82);
      ctx.lineTo(X1, 130);
      ctx.stroke();
      ctx.restore();

      // race: the green point finishes first
      const greenP = ease(clamp((t - 0.3) / 0.3, 0, 1));
      const greyP = ease(clamp((t - 0.3) / 0.44, 0, 1));
      const gx = lerp(X0, X1, greenP);
      const bx = lerp(X0, X1, greyP);

      drawStar(ctx, bx, LANE_B, 4, { kind: 'point', color: COLORS.muted });
      drawStar(ctx, gx, LANE_A, 4.5, { kind: 'point', color: COLORS.good });

      if (greenP >= 1) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time / 240);
        ctx.strokeStyle = COLORS.good;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, LANE_A, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // one hand, one stopwatch, one race
      if (handAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(handAlpha, 0, 1);
        drawHand(ctx, handX, handY);
        ctx.restore();
      }

      // two labels: the two competitors
      drawLabel(ctx, '本方法', 92, 92, { color: COLORS.good, size: 13 });
      drawLabel(ctx, '对照', 92, 116, { color: COLORS.muted, size: 13 });
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} />;
};

export default Ch10Ana;
