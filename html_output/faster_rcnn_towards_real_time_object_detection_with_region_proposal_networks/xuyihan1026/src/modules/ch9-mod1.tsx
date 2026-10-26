import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawMeter,
  drawLegend,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Module 9.1 — drag the NMS IoU threshold (0.3-0.9) or switch NMS off.
// Duplicate proposals collapse as the threshold drops; the kept count and the mAP
// meter read from the same state.

const W = 1080;
const H = 280;

const FONT = '"SFMono-Regular", "Cascadia Mono", Menlo, monospace';

interface Cand {
  x: number;
  y: number;
  w: number;
  h: number;
  star: number;
  score: number;
}

const STARS = [
  { x: 250, y: 104, r: 6, bright: true },
  { x: 470, y: 172, r: 5, bright: true },
  { x: 118, y: 214, r: 3, bright: false },
  { x: 566, y: 76, r: 3, bright: false },
];

const CANDIDATES: Cand[] = [
  { x: 250, y: 104, w: 150, h: 96, star: 0, score: 0.95 },
  { x: 268, y: 116, w: 138, h: 90, star: 0, score: 0.88 },
  { x: 228, y: 92, w: 160, h: 104, star: 0, score: 0.81 },
  { x: 276, y: 128, w: 126, h: 82, star: 0, score: 0.72 },
  { x: 470, y: 172, w: 112, h: 78, star: 1, score: 0.9 },
  { x: 486, y: 182, w: 104, h: 72, star: 1, score: 0.77 },
  { x: 452, y: 164, w: 124, h: 86, star: 1, score: 0.69 },
  { x: 118, y: 214, w: 86, h: 62, star: 2, score: 0.55 },
  { x: 566, y: 76, w: 70, h: 52, star: 3, score: 0.48 },
];

// Best proposal of each star is always kept; the duplicates are suppressed one by one.
const BEST = new Set([0, 4, 7, 8]);
const DUPLICATES = CANDIDATES.map((c, i) => ({ c, i }))
  .filter(({ i }) => !BEST.has(i))
  .sort((a, b) => a.c.score - b.c.score)
  .map(({ i }) => i);

const keptCount = (iou: number, nms: boolean): number => {
  if (!nms) return 6000;
  if (iou <= 0.7) return Math.round(2000 * ((iou - 0.2) / 0.5));
  return Math.round(2000 + ((iou - 0.7) / 0.2) * 3000);
};

const suppressedCount = (iou: number, nms: boolean): number =>
  nms ? Math.round(clamp((0.9 - iou) / 0.6, 0, 1) * DUPLICATES.length) : 0;

const mapValue = (iou: number, nms: boolean): number =>
  nms ? clamp(0.99 - Math.abs(iou - 0.7) * 0.02, 0.9, 1) : 0.92;

const fmtIou = (v: number) => String(Number(v.toFixed(2)));

const hash = (i: number) => {
  const v = Math.sin(i * 77.7 + 13.1) * 43758.5453;
  return v - Math.floor(v);
};

const write = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 14,
  align: CanvasTextAlign = 'left',
  weight = '400'
): void => {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
};

export const Ch9Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ iou: 0.7, nms: true });
  const [iou, setIou] = useState(0.7);
  const [nms, setNms] = useState(true);
  const [feedback, setFeedback] = useState({
    text: 'IoU 0.7：约剩 2000 个候选，取前 300 个，mAP 不掉。',
    cls: 'good',
  });

  const update = (nextIou: number, nextNms: boolean) => {
    stateRef.current = { iou: nextIou, nms: nextNms };
    setIou(nextIou);
    setNms(nextNms);
    if (!nextNms) {
      setFeedback({
        text: '不做 NMS：6000 个重叠框全留着，检测更慢、误报更多。',
        cls: 'bad',
      });
      return;
    }
    setFeedback({
      text: `IoU ${fmtIou(nextIou)}：约剩 ${keptCount(nextIou, true)} 个候选，mAP 不受影响。`,
      cls: 'good',
    });
  };

  const kept = keptCount(iou, nms);

  const { ref } = useCanvas(
    (ctx, _time, s: { iou: number; nms: boolean }) => {
      clearScene(ctx, W, H);

      for (let i = 0; i < 24; i += 1) {
        drawStar(ctx, 46 + hash(i) * 558, 40 + hash(i + 50) * 200, 1 + hash(i + 99) * 1.2, {
          kind: 'faint',
        });
      }

      const suppressed = new Set(DUPLICATES.slice(0, suppressedCount(s.iou, s.nms)));

      // Draw suppressed duplicates first, then the kept proposals, then the best ones.
      const order = CANDIDATES.map((_c, i) => i).sort((a, b) => {
        const rank = (i: number) => (suppressed.has(i) ? 0 : BEST.has(i) ? 2 : 1);
        return rank(a) - rank(b);
      });
      order.forEach((i) => {
        const c = CANDIDATES[i];
        const isSuppressed = suppressed.has(i);
        drawFrame(ctx, c.x, c.y, c.w, c.h, {
          color: isSuppressed ? COLORS.muted : BEST.has(i) ? COLORS.good : COLORS.route,
          alpha: isSuppressed ? 0.45 : 1,
          dashed: isSuppressed,
          weight: isSuppressed ? 2 : BEST.has(i) ? 3 : 2.5,
        });
      });

      STARS.forEach((st) => {
        drawStar(ctx, st.x, st.y, st.r, { kind: st.bright ? 'bright' : 'point' });
      });

      // Bars: proposal count and mAP.
      write(ctx, '候选框', 660, 66, COLORS.muted, 14);
      write(ctx, String(keptCount(s.iou, s.nms)), 1020, 66, COLORS.ink, 16, 'right', '600');
      drawMeter(ctx, 660, 78, 360, 16, keptCount(s.iou, s.nms) / 6000, { direction: 'down' });

      write(ctx, 'mAP', 660, 148, COLORS.muted, 14);
      write(ctx, mapValue(s.iou, s.nms).toFixed(2), 1020, 148, COLORS.ink, 16, 'right', '600');
      drawMeter(ctx, 660, 160, 360, 16, mapValue(s.iou, s.nms), { direction: 'up' });

      write(ctx, '测试时只取前 300 个框', 660, 206, COLORS.muted, 13);
      write(ctx, s.nms ? `NMS IoU ${fmtIou(s.iou)}` : 'NMS 关闭', 660, 232, COLORS.fader, 14);

      drawLegend(ctx, 48, 262, [
        { color: COLORS.good, text: '保留' },
        { color: COLORS.muted, text: '压掉' },
        { color: COLORS.star, text: '星点' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return (
    <div>
      <canvas ref={ref} width={W} height={H} aria-label="拖动 NMS 阈值，看重复框如何被压掉" />
      <div className="ctrl">
        <button
          type="button"
          className={`chip${nms ? ' selected' : ''}`}
          aria-pressed={nms}
          onClick={() => update(iou, true)}
        >
          开 NMS
        </button>
        <button
          type="button"
          className={`chip${!nms ? ' selected' : ''}`}
          aria-pressed={!nms}
          onClick={() => update(iou, false)}
        >
          关 NMS
        </button>
        <label>
          IoU 阈值 <span className="val">{iou.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0.3}
          max={0.9}
          step={0.05}
          value={iou}
          aria-label="NMS 的 IoU 阈值"
          onChange={(e) => update(Number(e.target.value), nms)}
        />
        <span className="val">保留 {kept}</span>
      </div>
      <div className={`feedback ${feedback.cls}`} aria-live="polite">
        {feedback.text}
      </div>
    </div>
  );
};

export default Ch9Mod1;
