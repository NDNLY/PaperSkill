import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawStar, useCanvas, clamp, lerp } from '../lib/skyKit';

// Analogy (560x140): one hand hangs the second weight on the balance beam; the beam levels out.
// One moving subject (the hand + its weight), one goal (both pans carrying the same weight).
// 3.2 s loop, no controls, skyKit only.

const W = 560;
const H = 140;
const LOOP = 3200;

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
  ctx.moveTo(x + 10, y - 2);
  ctx.lineTo(x + 21, y - 10);
  ctx.stroke();
  ctx.restore();
}

function drawWeight(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  // y = top edge of the weight body
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + 1, 4, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 1);
  ctx.lineTo(x + 9, y + 1);
  ctx.lineTo(x + 7, y + 14);
  ctx.lineTo(x - 7, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPan(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 13, y);
  ctx.quadraticCurveTo(x, y + 7, x + 13, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x - 13, y);
  ctx.moveTo(x, y - 20);
  ctx.lineTo(x + 13, y);
  ctx.stroke();
  ctx.restore();
}

export const Ch5Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ tick: 0 });

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D, time: number) => {
      clearScene(ctx, W, H);
      drawStar(ctx, 74, 30, 1.4, { kind: 'faint' });
      drawStar(ctx, 498, 42, 1.2, { kind: 'faint' });
      drawStar(ctx, 512, 96, 1.6, { kind: 'faint' });

      const t = (time % LOOP) / LOOP;
      const pivotX = 280;
      const beamY = 78;
      const half = 60;
      const panDrop = 20;

      // Beam starts left-down (one weight already on that pan) and levels once the second hangs.
      const levelT = clamp((t - 0.66) / 0.2, 0, 1);
      const tilt = lerp(0.26, 0, ease(levelT));
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const lx = pivotX - half * cos;
      const ly = beamY + half * sin;
      const rx = pivotX + half * cos;
      const ry = beamY - half * sin;

      // stand + pivot
      ctx.save();
      ctx.strokeStyle = COLORS.rail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pivotX, beamY);
      ctx.lineTo(pivotX, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pivotX - 15, 128);
      ctx.lineTo(pivotX + 15, 128);
      ctx.stroke();
      ctx.restore();

      // pans (strings + dish) sit under both beam ends
      drawPan(ctx, lx, ly + panDrop);
      drawPan(ctx, rx, ry + panDrop);

      // beam
      ctx.save();
      ctx.strokeStyle = COLORS.frame;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.fillStyle = COLORS.frame;
      ctx.beginPath();
      ctx.arc(pivotX, beamY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // the first weight: classification, already on the left pan
      drawWeight(ctx, lx, ly + panDrop - 14, COLORS.route);
      // the second weight: regression, carried by the hand, then released on the right pan
      const carrying = t < 0.66;
      if (carrying) {
        const travel = ease(clamp((t - 0.08) / 0.46, 0, 1));
        const lower = ease(clamp((t - 0.54) / 0.12, 0, 1));
        const handX = lerp(46, rx, travel);
        const handY = lerp(34, 40, travel) + 34 * lower;
        const fadeIn = clamp(t / 0.06, 0, 1);
        ctx.save();
        ctx.globalAlpha = fadeIn;
        drawWeight(ctx, handX, handY + 8, COLORS.frame);
        drawHand(ctx, handX, handY);
        ctx.restore();
      } else {
        drawWeight(ctx, rx, ry + panDrop - 14, COLORS.frame);
      }

      // hand leaves after the release
      if (t >= 0.66 && t < 0.94) {
        const retreat = ease(clamp((t - 0.66) / 0.2, 0, 1));
        const fadeOut = 1 - clamp((t - 0.84) / 0.1, 0, 1);
        const handX = lerp(rx, 466, retreat);
        const handY = lerp(ry + panDrop - 6, 24, retreat);
        ctx.save();
        ctx.globalAlpha = clamp(fadeOut, 0, 1);
        drawHand(ctx, handX, handY);
        ctx.restore();
      }

      // balanced marker
      if (levelT > 0.75) {
        const pulse = 0.55 + 0.45 * Math.sin(time / 260);
        ctx.save();
        ctx.globalAlpha = clamp((levelT - 0.75) / 0.25, 0, 1) * pulse;
        ctx.strokeStyle = COLORS.good;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pivotX, beamY, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // two labels for the two pans; the beam itself carries no text
      drawLabel(ctx, '分类', lx - 26, 124, { color: COLORS.route, size: 13, align: 'right' });
      drawLabel(ctx, '回归', rx + 24, 124, { color: COLORS.frame, size: 13 });
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} />;
};

export default Ch5Ana;
