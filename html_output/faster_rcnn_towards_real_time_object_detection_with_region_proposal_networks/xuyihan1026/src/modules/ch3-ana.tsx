import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawLabel,
  drawLegend,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Analogy animation for chapter 3 (560x140, control-free, 3.3 s loop):
// a hand lays three differently sized finder frames onto one bright star, one at a time.
// One moving subject (the hand carrying the frame), one visible goal (the bright star).

const W = 560;
const H = 140;
const LOOP = 3300;
const SX = 292;
const SY = 70;
const SIZES = [58, 80, 104];

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
  ctx.ellipse(x, y, 7, 8.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let k = 0; k < 3; k += 1) {
    ctx.beginPath();
    ctx.moveTo(x - 4 + k * 4, y - 4);
    ctx.lineTo(x - 2 + k * 4, y - 13);
    ctx.stroke();
  }
  ctx.restore();
}

type AnaState = { reduced: boolean };

export const Ch3Ana: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const stateRef = useRef<AnaState>({
    reduced:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  const { ref } = useCanvas<AnaState>(
    (ctx, time, s) => {
      clearScene(ctx, W, H, '同一格九框');

      const p = s.reduced ? 0.98 : (time % LOOP) / LOOP;

      // The goal star sits still; only the hand and the frames it carries move.
      drawStar(ctx, SX, SY, 5, { kind: 'bright' });
      drawLabel(ctx, '亮星', SX + 10, SY - 14, { color: COLORS.star, size: 12 });

      let handX = SX + 150;
      let handY = SY + 4;
      let handShown = false;

      SIZES.forEach((size, i) => {
        const start = 0.02 + i * 0.26;
        const local = clamp((p - start) / 0.16, 0, 1);
        if (local <= 0) return;
        const grow = 0.55 + 0.45 * smooth(local);
        const fits = i === 1;
        drawFrame(ctx, SX, SY, size * grow, size * grow, {
          color: fits ? COLORS.good : COLORS.frame,
          weight: fits ? 3 : 2,
          alpha: 0.45 + 0.55 * local,
          dashed: !fits,
        });
        handShown = true;
        handX = SX + size / 2 + 14 + (1 - smooth(local)) * 96;
        handY = SY + 4;
      });

      if (handShown) drawHand(ctx, handX, handY);

      drawLegend(ctx, 24, 124, [
        { color: COLORS.good, text: '刚好套住' },
        { color: COLORS.frame, text: '其他大小' },
      ]);
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

export default Ch3Ana;
