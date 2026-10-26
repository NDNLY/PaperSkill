import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  clamp,
  lerp,
  drawFrame,
  drawLabel,
  drawLegend,
  drawStar,
  useCanvas,
} from '../lib/skyKit';

// §4 analogy (560x140) — one hand slides a framing box off empty sky and onto a star;
// once the box covers the star its outline turns from red to green. 3.0 s loop, no controls.
const W = 560;
const H = 140;
const LOOP = 3000;
const START = { x: 168, y: 66 };
const TARGET = { x: 400, y: 66 };
const BOX = 66;

/** The surveyor's hand: palm plus three finger strokes. */
function drawHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(x, y, 26, 14);
  ctx.fillStyle = COLORS.sky2;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const fx = x + 6 + i * 7;
    ctx.moveTo(fx, y);
    ctx.lineTo(fx, y - 8);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  ctx.restore();
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const Ch4Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef<Record<string, never>>({});

  const { ref } = useCanvas<Record<string, never>>(
    (ctx, time) => {
      clearScene(ctx, W, H);
      const p = (time % LOOP) / LOOP;
      const travel = easeInOut(clamp((p - 0.12) / 0.43, 0, 1));
      const fade = clamp(
        p < 0.05 ? p / 0.05 : p > 0.92 ? (1 - p) / 0.08 : 1,
        0,
        1
      );

      // static night field: distant stars and the empty-to-target track
      const distant: Array<[number, number]> = [
        [56, 32],
        [104, 102],
        [236, 28],
        [300, 106],
        [508, 36],
        [520, 100],
        [336, 24],
      ];
      distant.forEach(([x, y], i) => {
        drawStar(ctx, x, y, i % 2 === 0 ? 2.2 : 1.6, { kind: 'faint' });
      });
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(START.x + 40, START.y);
      ctx.lineTo(TARGET.x - 40, TARGET.y);
      ctx.stroke();
      ctx.restore();

      // the goal: one bright star; the moving box either covers it or not
      const onStar = travel >= 0.82;
      drawStar(ctx, TARGET.x, TARGET.y, 8, { kind: onStar ? 'bright' : 'point' });

      // the one moving subject: hand + frame
      const fx = lerp(START.x, TARGET.x, travel);
      const fy = lerp(START.y, TARGET.y, travel);
      drawFrame(ctx, fx, fy, BOX, BOX, {
        color: onStar ? COLORS.good : COLORS.bad,
        weight: 3,
        alpha: 0.95 * fade,
      });
      drawHand(ctx, fx - 38, fy + 26, fade);

      drawLabel(ctx, '空处', 142, 114, { color: COLORS.muted, size: 13 });
      drawLabel(ctx, '目标星', TARGET.x - 18, TARGET.y - 40, {
        color: COLORS.muted,
        size: 13,
      });
      drawLegend(ctx, 330, 120, [
        { color: COLORS.bad, text: '未套住' },
        { color: COLORS.good, text: '套住星' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} />;
};

export default Ch4Ana;
