import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  clamp,
  drawGrid,
  drawLabel,
  drawLegend,
  drawList,
  drawScope,
  useCanvas,
} from '../lib/skyKit';

// §7 module (1080x280) — compare the two-stage survey-then-measure pipeline with the
// one-stage dense sliding window (E20, E14). The 2 s run grows both result bars.
const W = 1080;
const H = 280;

type Mode = 'two' | 'one';
type Run = 0 | 1;

const RES: Record<Mode, { map: number; boxes: number }> = {
  two: { map: 58.7, boxes: 300 },
  one: { map: 53.9, boxes: 20000 },
};

const RUN_MS = 2000;
const MAX_BOXES = 20000;

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function feedbackFor(mode: Mode, run: Run): { text: string; cls: string } {
  if (mode === 'one') {
    return {
      text: '一阶段稠密滑窗：53.9%，要处理 20000 个框，还慢。',
      cls: 'bad',
    };
  }
  if (run === 0) {
    return {
      text: '两阶段：先出 300 个候选，再对它们分类回归。',
      cls: '',
    };
  }
  return { text: '两阶段：58.7% mAP，只需处理 300 个框。', cls: 'good' };
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8, y2 - 4);
  ctx.lineTo(x2 - 8, y2 + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** One result bar: dark track, ghost target marker, and a fill that grows with the run. */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  fill: number,
  color: string
): void {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = COLORS.axis;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.grid;
  ctx.strokeRect(x, y, w, h);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * frac, y - 6);
  ctx.lineTo(x + w * frac, y + h + 6);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = color;
  ctx.fillRect(x + 1.5, y + 1.5, Math.max(2, (w - 3) * frac * fill), h - 3);
}

export const Ch7Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const [mode, setMode] = useState<Mode>('two');
  const [run, setRun] = useState<Run>(0);
  const stateRef = useRef<{ mode: Mode; run: Run; startAt: number }>({
    mode: 'two',
    run: 0,
    startAt: 0,
  });
  const feedback = feedbackFor(mode, run);

  const { ref } = useCanvas<typeof stateRef.current>(
    (ctx, time, s) => {
      clearScene(ctx, W, H);
      const res = RES[s.mode];
      const color = s.mode === 'two' ? COLORS.good : COLORS.bad;
      const progress =
        s.run === 1 ? easeOut(clamp((time - s.startAt) / RUN_MS, 0, 1)) : 0;

      // ---- flow (40-620): survey camera -> candidate list -> telescope ----
      if (s.mode === 'two') {
        drawScope(ctx, 96, 106, 1.15, { accent: COLORS.route });
        drawArrow(ctx, 124, 106, 186, 106, COLORS.route);
        drawList(ctx, 196, 72, 128, 76, { rows: 5, highlight: 0 });
        drawArrow(ctx, 330, 106, 426, 106, COLORS.route);
        drawScope(ctx, 458, 106, 1.35, {
          pointing: true,
          accent: COLORS.aux,
        });
      } else {
        // no second stage: the survey camera must classify every cell itself
        drawScope(ctx, 96, 106, 1.15, { accent: COLORS.route });
        drawArrow(ctx, 124, 106, 186, 106, COLORS.bad);
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = COLORS.bad;
        ctx.fillRect(196, 64, 386, 88);
        ctx.restore();
        drawGrid(ctx, 196, 64, 386, 88, 16, 6);
      }

      // stage cost strip: two shares for two-stage, one dense bar for one-stage
      const SX = 66;
      const SY = 196;
      const SW = 528;
      const SH = 14;
      if (s.mode === 'two') {
        const split = SX + SW * 0.62;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = COLORS.route;
        ctx.fillRect(SX, SY, split - SX, SH);
        ctx.fillStyle = COLORS.aux;
        ctx.fillRect(split, SY, SX + SW - split, SH);
        ctx.restore();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = COLORS.grid;
        ctx.strokeRect(SX, SY, SW, SH);
        ctx.beginPath();
        ctx.moveTo(split, SY);
        ctx.lineTo(split, SY + SH);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = COLORS.bad;
        ctx.fillRect(SX, SY, SW, SH);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        for (let i = 0; i < 60; i += 1) {
          const tx = SX + 6 + (i * (SW - 12)) / 59;
          ctx.beginPath();
          ctx.moveTo(tx, SY + 3);
          ctx.lineTo(tx, SY + SH - 3);
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = COLORS.grid;
        ctx.strokeRect(SX, SY, SW, SH);
      }

      // ---- result bars (660-1020): mAP and anchors per image ----
      const BX = 680;
      const BW = 330;
      const BH = 28;
      const Y1 = 92;
      const Y2 = 176;
      const mapFrac = res.map / 60;
      const boxFrac = Math.log10(res.boxes) / Math.log10(MAX_BOXES);
      drawBar(ctx, BX, Y1, BW, BH, mapFrac, progress, color);
      drawBar(ctx, BX, Y2, BW, BH, boxFrac, progress, color);
      drawLabel(ctx, `${res.map.toFixed(1)}%`, BX + BW, Y1 - 10, {
        color: COLORS.ink,
        size: 15,
        align: 'right',
      });
      drawLabel(ctx, `${res.boxes}`, BX + BW, Y2 - 10, {
        color: COLORS.ink,
        size: 15,
        align: 'right',
      });

      drawLegend(ctx, 48, 240, [
        { color: COLORS.route, text: '巡天相机' },
        { color: COLORS.aux, text: '望远镜' },
        { color: COLORS.bad, text: '一阶段' },
      ]);
    },
    W,
    H,
    stateRef
  );

  const selectMode = (next: Mode) => {
    stateRef.current.mode = next;
    setMode(next);
  };

  const start = () => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now = performance.now();
    stateRef.current.run = 1;
    stateRef.current.startAt = reduced ? now - RUN_MS - 100 : now;
    setRun(1);
  };

  return (
    <div>
      <canvas id={`cv-${chapterId}-${moduleId}`} ref={ref} width={W} height={H} />
      <div className="ctrl">
        <div className="chip-row">
          <button
            type="button"
            className={`chip${mode === 'two' ? ' selected' : ''}`}
            onClick={() => selectMode('two')}
            aria-pressed={mode === 'two'}
          >
            两阶段
          </button>
          <button
            type="button"
            className={`chip${mode === 'one' ? ' selected' : ''}`}
            onClick={() => selectMode('one')}
            aria-pressed={mode === 'one'}
          >
            一阶段稠密滑窗
          </button>
        </div>
        <button type="button" className="chip" onClick={start}>
          {run === 0 ? '开始' : '重跑'}
        </button>
        <span className="val">
          {mode === 'two' ? '58.7% · 300 框' : '53.9% · 20000 框'}
        </span>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch7Mod1;
