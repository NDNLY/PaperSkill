import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawMeter,
  drawLabel,
  drawLegend,
  useCanvas,
} from '../lib/skyKit';

// Chapter 3.1 — why nine frames.
// Three scale chips x three aspect chips, or click one of the nine frames in the 3x3 board.
// The selected frame is drawn on the star; an IoU meter shows where it falls.

const W = 1080;
const H = 280;

const CX = 186;
const CY = 122;
const K = 0.235;

const GT = { w: 200, h: 380 };
const SCALES = [128, 256, 512];
// Grid column order matters: 1:1 sits in the middle, so the centre cell (index 4) is 256² at 1:1.
const RATIO_KEYS = ['1:2', '1:1', '2:1'];
const CHIP_RATIOS = ['1:1', '1:2', '2:1'];
const RATIO_VAL: Record<string, number> = { '1:1': 1, '1:2': 2, '2:1': 0.5 };

const MINI_X = 362;
const MINI_Y = 34;
const MINI_CW = 62;
const MINI_CH = 60;
const MINI_BASE = [14, 24, 40];

const anchorSize = (scale: number, ratio: string): { w: number; h: number } => {
  const r = RATIO_VAL[ratio];
  return { w: Math.sqrt((scale * scale) / r), h: Math.sqrt(scale * scale * r) };
};

const iouOf = (scale: number, ratio: string): number => {
  const a = anchorSize(scale, ratio);
  const iw = Math.min(a.w, GT.w);
  const ih = Math.min(a.h, GT.h);
  const inter = iw * ih;
  return inter / (a.w * a.h + GT.w * GT.h - inter);
};

const selIndex = (scale: number, ratio: string): number =>
  SCALES.indexOf(scale) * 3 + RATIO_KEYS.indexOf(ratio);

type ModState = { scale: number; ratio: string };

const FB_INITIAL = '256² 的 1:1 框：还没完全套住星。';
const FB_POS = '这个框 IoU > 0.7，会被当正样本。';
const FB_NEG = 'IoU < 0.3，算负样本。';
const FB_MID = 'IoU 在 0.3–0.7 之间：既不算正也不算负，不参与损失。';

const feedbackFor = (iou: number): { text: string; cls: string } => {
  if (iou > 0.7) return { text: FB_POS, cls: 'good' };
  if (iou < 0.3) return { text: FB_NEG, cls: 'bad' };
  return { text: FB_MID, cls: '' };
};

export const Ch3Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const stateRef = useRef<ModState>({ scale: 256, ratio: '1:1' });
  const [ui, setUi] = useState<ModState>({ scale: 256, ratio: '1:1' });
  const [feedback, setFeedback] = useState({ text: FB_INITIAL, cls: '' });

  const commit = (scale: number, ratio: string): void => {
    stateRef.current.scale = scale;
    stateRef.current.ratio = ratio;
    setUi({ scale, ratio });
    setFeedback(feedbackFor(iouOf(scale, ratio)));
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const col = Math.floor((x - MINI_X) / MINI_CW);
    const row = Math.floor((y - MINI_Y) / MINI_CH);
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    commit(SCALES[row], RATIO_KEYS[col]);
  };

  const { ref } = useCanvas<ModState>(
    (ctx, time, s) => {
      clearScene(ctx, W, H);
      const { scale, ratio } = s;
      const iou = iouOf(scale, ratio);
      const active = selIndex(scale, ratio);
      const pulse = 0.5 + 0.5 * Math.sin(time / 420);

      // --- left: the star, its ground-truth patch, and the nine anchor frames on it ---
      drawFrame(ctx, CX, CY, GT.w * K, GT.h * K, {
        color: COLORS.muted,
        dashed: true,
        weight: 1.5,
        alpha: 0.9,
      });

      SCALES.forEach((sc) => {
        RATIO_KEYS.forEach((rk) => {
          const a = anchorSize(sc, rk);
          const on = sc === scale && rk === ratio;
          drawFrame(ctx, CX, CY, a.w * K, a.h * K, on
            ? { color: COLORS.fader, weight: 3, alpha: 1 }
            : { color: COLORS.frame, weight: 1.5, alpha: 0.3, dashed: true });
        });
      });

      drawStar(ctx, CX, CY, 5, { kind: 'bright' });

      // --- middle: the 3x3 anchor board, every cell is a click target ---
      for (let i = 0; i < 9; i += 1) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = MINI_X + (col + 0.5) * MINI_CW;
        const y = MINI_Y + (row + 0.5) * MINI_CH;
        const on = i === active;
        if (on) {
          drawFrame(ctx, x, y, MINI_CW - 8, MINI_CH - 8, {
            color: COLORS.route,
            weight: 1.5,
            alpha: 0.45 + 0.35 * pulse,
            dashed: true,
          });
        }
        const a = anchorSize(SCALES[row], RATIO_KEYS[col]);
        const base = MINI_BASE[row];
        drawFrame(ctx, x, y, (a.w / SCALES[row]) * base, (a.h / SCALES[row]) * base, {
          color: on ? COLORS.fader : COLORS.frame,
          weight: on ? 3 : 1.5,
          alpha: on ? 1 : 0.55,
          dashed: !on,
        });
      }

      // --- right: current params and the IoU meter ---
      drawLabel(ctx, `${scale}²·${ratio}`, 620, 66, { color: COLORS.ink, size: 15, bold: true });
      drawLabel(ctx, `IoU ${iou.toFixed(2)}`, 620, 88, { color: COLORS.ink, size: 13 });
      drawMeter(ctx, 620, 100, 380, 26, iou, { direction: 'up' });

      [0.3, 0.7].forEach((t) => {
        const x = 620 + 380 * t;
        ctx.save();
        ctx.strokeStyle = COLORS.ink;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 98);
        ctx.lineTo(x, 128);
        ctx.stroke();
        ctx.restore();
        drawLabel(ctx, t.toFixed(1), x - 10, 146, { color: COLORS.muted, size: 12 });
      });

      drawLegend(ctx, 40, 252, [
        { color: COLORS.frame, text: '锚框' },
        { color: COLORS.fader, text: '选中' },
        { color: COLORS.muted, text: '真值框' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return (
    <div data-widget={`${chapterId}-${moduleId}`}>
      <canvas ref={ref} width={W} height={H} onClick={onCanvasClick} />
      <div className="ctrl">
        <div className="chip-row" style={{ flex: '1 0 100%', marginBottom: 0 }}>
          {SCALES.map((sc) => (
            <button
              key={sc}
              type="button"
              className={`chip${ui.scale === sc ? ' selected' : ''}`}
              onClick={() => commit(sc, ui.ratio)}
            >
              {sc}²
            </button>
          ))}
        </div>
        <div className="chip-row" style={{ flex: '1 0 100%', marginBottom: 0 }}>
          {CHIP_RATIOS.map((rk) => (
            <button
              key={rk}
              type="button"
              className={`chip${ui.ratio === rk ? ' selected' : ''}`}
              onClick={() => commit(ui.scale, rk)}
            >
              {rk}
            </button>
          ))}
        </div>
        <label style={{ flex: '1 0 100%', justifyContent: 'center' }}>
          IoU <span className="val">{iouOf(ui.scale, ui.ratio).toFixed(2)}</span>
        </label>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
      <div className="note">
        <b>论文的锚框消融</b>（VOC 2007 test，VGG-16）：默认 3 尺度 × 3 长宽比 69.9% mAP；
        只留 1 个锚框 65.8%–66.7%（掉 3–4 个点）；3 尺度配 1 种长宽比 69.8%；3 种长宽比配 1 个尺度 68.8%。
        尺度与长宽比在精度上并不是完全独立的两个维度，作者仍保留两者以保持灵活。
      </div>
    </div>
  );
};

export default Ch3Mod1;
