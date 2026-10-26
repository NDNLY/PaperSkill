import React, { useRef } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawScope, drawStar, useCanvas, clamp, lerp } from '../lib/skyKit';

// Analogy (560x140): one hand lowers the telescope onto the same mount rail as the survey
// camera; once clamped, a copper pulse runs along the shared mount.
// 3.2 s loop, no controls, skyKit only.

const W = 560;
const H = 140;
const LOOP = 3200;
const RAIL_Y = 114;
const CAM_X = 150;
const SCOPE_X = 400;

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

export const Ch8Ana: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ tick: 0 });

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D, time: number) => {
      clearScene(ctx, W, H);
      drawStar(ctx, 62, 34, 1.3, { kind: 'faint' });
      drawStar(ctx, 510, 60, 1.2, { kind: 'faint' });
      drawStar(ctx, 300, 20, 1.4, { kind: 'faint' });

      const t = (time % LOOP) / LOOP;
      const dock = clamp((t - 0.62) / 0.08, 0, 1);
      const travel = ease(clamp((t - 0.1) / 0.52, 0, 1));
      const retreat = ease(clamp((t - 0.7) / 0.22, 0, 1));

      const scopeX = lerp(500, SCOPE_X, travel);
      const scopeY = lerp(50, 58, travel) + 4 * dock;
      const carrying = t < 0.7;

      // share mount: copper bar sitting on the observatory rail
      ctx.save();
      ctx.fillStyle = COLORS.rail;
      ctx.fillRect(60, RAIL_Y, 440, 8);
      ctx.fillStyle = COLORS.frame;
      ctx.fillRect(CAM_X - 8, RAIL_Y - 5, 16, 5);
      ctx.globalAlpha = clamp(dock, 0, 1);
      ctx.fillRect(SCOPE_X - 8, RAIL_Y - 5, 16, 5);
      ctx.restore();

      // survey camera, already clamped to the mount
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = COLORS.rail;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(CAM_X, 78);
      ctx.lineTo(CAM_X, RAIL_Y);
      ctx.stroke();
      ctx.restore();
      drawScope(ctx, CAM_X, 58, 0.8, { accent: COLORS.route });

      // telescope: carried above the mount, then clamped onto the same rail
      if (dock > 0.35) {
        ctx.save();
        ctx.globalAlpha = clamp((dock - 0.35) / 0.65, 0, 1);
        ctx.strokeStyle = COLORS.rail;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(SCOPE_X, 78);
        ctx.lineTo(SCOPE_X, RAIL_Y);
        ctx.stroke();
        ctx.strokeStyle = COLORS.rail;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(SCOPE_X, 80, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawScope(ctx, scopeX, scopeY, 0.8, { accent: COLORS.aux, pointing: carrying });

      // shared-mount pulse: copper glow travelling from camera to telescope
      if (dock > 0.6) {
        const pulse = clamp((t - 0.78) / 0.14, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = COLORS.fader;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CAM_X + 9, RAIL_Y + 4);
        ctx.lineTo(lerp(CAM_X + 9, SCOPE_X - 9, ease(pulse)), RAIL_Y + 4);
        ctx.stroke();
        ctx.restore();
        drawStar(ctx, lerp(CAM_X + 9, SCOPE_X - 9, ease(pulse)), RAIL_Y + 4, 3, { kind: 'point', color: COLORS.star });
      }

      // the hand: lowers the instrument, then lets go and moves away
      const handAlpha = carrying ? 1 : 1 - clamp((t - 0.7) / 0.18, 0, 1);
      const handX = carrying ? scopeX : lerp(SCOPE_X + 6, 486, retreat);
      const handY = carrying ? scopeY - 26 : lerp(scopeY - 26, 20, retreat);
      ctx.save();
      ctx.globalAlpha = clamp(handAlpha, 0, 1);
      drawHand(ctx, handX, handY);
      ctx.restore();

      // two labels only: the survey camera and the telescope
      drawLabel(ctx, '巡天相机', 122, 44, { color: COLORS.muted, size: 13, align: 'right' });
      drawLabel(ctx, '望远镜', 378, 44, { color: COLORS.muted, size: 13, align: 'right' });
    },
    W,
    H,
    stateRef
  );

  return <canvas ref={ref} width={W} height={H} />;
};

export default Ch8Ana;
