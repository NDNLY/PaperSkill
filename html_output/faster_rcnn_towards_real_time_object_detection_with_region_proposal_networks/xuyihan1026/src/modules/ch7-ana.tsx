import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  clamp,
  lerp,
  drawFrame,
  drawGrid,
  drawLabel,
  drawScope,
  drawStar,
  useCanvas,
} from '../lib/skyKit';

// §7 analogy (560x140) — one hand sweeps the wide-field camera across the survey grid,
// then the same mount becomes a telescope pointing only at the one bright patch.
// 3.4 s loop, no controls.
const W = 560;
const H = 140;
const LOOP = 3400;
const GX = 40;
const GY = 18;
const GW = 448;
const GH = 76;
const PATCH = { x: 479, y: 63 };
const SCOPE_Y = 106;

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

export const Ch7Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef<{ start: number }>({ start: -1 });

  const { ref } = useCanvas<{ start: number }>(
    (ctx, time, s) => {
      if (s.start < 0) s.start = time;
      clearScene(ctx, W, H);
      const elapsed = ((time - s.start) % LOOP + LOOP) % LOOP;
      const p = elapsed / LOOP;
      const sweep = easeInOut(clamp((p - 0.08) / 0.44, 0, 1));
      const x = lerp(76, 390, sweep);
      const detected = p > 0.54;
      const refined = p > 0.62;
      const fade = clamp(
        p < 0.05 ? p / 0.05 : p > 0.93 ? (1 - p) / 0.07 : 1,
        0,
        1
      );

      // the whole sky is on one survey grid, shared by both instruments
      drawGrid(ctx, GX, GY, GW, GH, 8, 4);
      const field: Array<[number, number]> = [
        [96, 34],
        [152, 82],
        [208, 46],
        [264, 28],
        [320, 74],
        [376, 40],
        [432, 84],
        [88, 62],
        [240, 84],
      ];
      field.forEach(([sx, sy], i) => {
        drawStar(ctx, sx, sy, i % 3 === 0 ? 2.2 : 1.6, { kind: 'faint' });
      });

      ctx.save();
      ctx.globalAlpha = fade;

      // wide-field scan beam while the survey camera sweeps
      if (!refined) {
        ctx.save();
        ctx.globalAlpha = 0.08 * fade;
        ctx.fillStyle = COLORS.route;
        ctx.fillRect(x - 18, GY, 36, GH);
        ctx.restore();
      }

      // the bright patch is the goal; only this patch is ever measured closely
      drawStar(ctx, PATCH.x, PATCH.y, 8, { kind: detected ? 'bright' : 'faint' });
      if (detected) {
        drawFrame(ctx, PATCH.x, PATCH.y, 34, 34, {
          color: COLORS.frame,
          weight: 2.5,
          alpha: 0.9 * fade,
        });
      }

      // one moving subject on the mount: survey camera first, then telescope
      const accent = refined ? COLORS.aux : COLORS.route;
      drawScope(ctx, x, SCOPE_Y, 1.25, { pointing: refined, accent });
      drawHand(ctx, x - 44, SCOPE_Y + 4, fade);

      if (refined) {
        ctx.save();
        ctx.globalAlpha = 0.6 * fade;
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = COLORS.aux;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 21, SCOPE_Y - 10);
        ctx.lineTo(PATCH.x, PATCH.y);
        ctx.stroke();
        ctx.restore();
      }

      drawLabel(ctx, refined ? '精测' : '巡天', Math.max(12, x - 62), 96, {
        color: accent,
        size: 13,
      });
      if (detected) {
        drawLabel(ctx, '候选', PATCH.x - 46, 34, {
          color: COLORS.frame,
          size: 13,
        });
      }
      ctx.restore();
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} />;
};

export default Ch7Ana;
