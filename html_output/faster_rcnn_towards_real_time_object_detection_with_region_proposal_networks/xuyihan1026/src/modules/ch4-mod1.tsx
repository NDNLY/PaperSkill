import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawFrame,
  drawLabel,
  drawLegend,
  drawStar,
  useCanvas,
} from '../lib/skyKit';

// §4 module (1080x280) — six preset anchors around the same sky field. Clicking one
// reveals its IoU (E7): > 0.7 is positive, < 0.3 is negative, in between is ignored.
const W = 1080;
const H = 280;

type Band = 'pos' | 'ignore' | 'neg';

interface Case {
  iou: number;
  band: Band;
}

function bandOf(iou: number): Band {
  if (iou > 0.7) return 'pos';
  if (iou < 0.3) return 'neg';
  return 'ignore';
}

const CASES: Case[] = [0.82, 0.71, 0.55, 0.29, 0.12, 0.68].map((iou) => ({
  iou,
  band: bandOf(iou),
}));

/** Where each preset frame sits, plus the offset of the star it is aimed at. */
const POS: Array<{ cx: number; cy: number; sx: number; sy: number }> = [
  { cx: 140, cy: 92, sx: 0, sy: 0 },
  { cx: 300, cy: 92, sx: 6, sy: -4 },
  { cx: 460, cy: 92, sx: 40, sy: 34 },
  { cx: 140, cy: 202, sx: 54, sy: 16 },
  { cx: 300, cy: 202, sx: 66, sy: 40 },
  { cx: 460, cy: 202, sx: 28, sy: 24 },
];

const FRAME = 92;
const HALF = FRAME / 2;

const BAND_META: Record<Band, { color: string; text: string }> = {
  pos: { color: COLORS.good, text: '正样本' },
  ignore: { color: COLORS.muted, text: '忽略' },
  neg: { color: COLORS.bad, text: '负样本' },
};

function feedbackFor(c: Case): { text: string; cls: string } {
  const iou = c.iou.toFixed(2);
  if (c.band === 'pos') {
    return { text: `IoU ${iou} > 0.7：正样本，参与分类与回归。`, cls: 'good' };
  }
  if (c.band === 'neg') {
    return { text: `IoU ${iou} < 0.3：负样本，只参与分类。`, cls: 'bad' };
  }
  return { text: `IoU ${iou}：不算正也不算负，不贡献损失。`, cls: '' };
}

/** Orange corner ticks mark the selected frame without recoloring its label. */
function drawSelectionTicks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number
): void {
  const len = 12;
  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  ctx.save();
  ctx.strokeStyle = COLORS.fader;
  ctx.lineWidth = 3;
  corners.forEach(([sx, sy]) => {
    const x = cx + sx * half;
    const y = cy + sy * half;
    ctx.beginPath();
    ctx.moveTo(x - sx * len, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - sy * len);
    ctx.stroke();
  });
  ctx.restore();
}

export const Ch4Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const [sel, setSel] = useState(0);
  const stateRef = useRef<{ sel: number }>({ sel: 0 });
  const [feedback, setFeedback] = useState(() => feedbackFor(CASES[0]));

  const { ref } = useCanvas<{ sel: number }>(
    (ctx, _time, s) => {
      clearScene(ctx, W, H);
      const active = CASES[s.sel];
      const activeBand = active.band;

      // ---- scene (40-620): six preset frames + the star each one aims at ----
      CASES.forEach((c, i) => {
        const pos = POS[i];
        const on = i === s.sel;
        const color = BAND_META[c.band].color;
        drawStar(ctx, pos.cx + pos.sx, pos.cy + pos.sy, on ? 8 : 7, {
          kind: on ? 'bright' : 'point',
        });
        drawFrame(ctx, pos.cx, pos.cy, FRAME, FRAME, {
          color,
          weight: on ? 3 : 2,
          alpha: on ? 1 : 0.5,
        });
        if (on) drawSelectionTicks(ctx, pos.cx, pos.cy, HALF);
      });

      // ---- rules (660-1042): three IoU bands, active row highlighted ----
      const PX = 660;
      const PY = 34;
      const PW = 382;
      const PH = 214;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = COLORS.sky2;
      ctx.fillRect(PX, PY, PW, PH);
      ctx.restore();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.grid;
      ctx.strokeRect(PX, PY, PW, PH);

      const meta = BAND_META[activeBand];
      drawLabel(ctx, meta.text, PX + 22, PY + 28, {
        color: meta.color,
        size: 20,
        bold: true,
      });
      drawLabel(ctx, `IoU ${active.iou.toFixed(2)}`, PX + PW - 22, PY + 28, {
        color: COLORS.ink,
        size: 16,
        align: 'right',
      });

      const RX = PX + 22;
      const RW = PW - 44;
      const RY = 84;
      const RH = 30;
      const GAP = 12;
      const rows: Array<{ band: Band; from: number; to: number }> = [
        { band: 'pos', from: 0.7, to: 1 },
        { band: 'ignore', from: 0.3, to: 0.7 },
        { band: 'neg', from: 0, to: 0.3 },
      ];
      rows.forEach((row, i) => {
        const y = RY + i * (RH + GAP);
        const color = BAND_META[row.band].color;
        const on = row.band === activeBand;
        const x0 = RX + row.from * RW;
        const w = (row.to - row.from) * RW;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = COLORS.axis;
        ctx.fillRect(RX, y, RW, RH);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = on ? 0.9 : 0.28;
        ctx.fillStyle = color;
        ctx.fillRect(x0, y, w, RH);
        ctx.restore();

        ctx.lineWidth = on ? 3 : 1.5;
        ctx.strokeStyle = on ? color : COLORS.grid;
        ctx.strokeRect(x0, y, w, RH);

        if (on) {
          ctx.beginPath();
          ctx.moveTo(RX - 9, y + RH / 2);
          ctx.lineTo(RX, y + RH / 2 - 7);
          ctx.lineTo(RX, y + RH / 2 + 7);
          ctx.closePath();
          ctx.fillStyle = COLORS.fader;
          ctx.fill();
        }
      });

      const bottom = RY + 3 * RH + 2 * GAP;
      [0.3, 0.7].forEach((t) => {
        const tx = RX + t * RW;
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, RY - 8);
        ctx.lineTo(tx, bottom + 6);
        ctx.stroke();
        ctx.restore();
      });

      const mx = RX + active.iou * RW;
      ctx.save();
      ctx.strokeStyle = COLORS.fader;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx, RY - 12);
      ctx.lineTo(mx, bottom + 10);
      ctx.stroke();
      ctx.restore();

      drawLegend(ctx, PX + 22, PY + PH - 18, [
        { color: COLORS.good, text: '正样本' },
        { color: COLORS.muted, text: '忽略' },
        { color: COLORS.bad, text: '负样本' },
      ]);
    },
    W,
    H,
    stateRef
  );

  const pick = (i: number) => {
    stateRef.current.sel = i;
    setSel(i);
    setFeedback(feedbackFor(CASES[i]));
  };

  const onCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((event.clientX - rect.left) * W) / rect.width;
    const y = ((event.clientY - rect.top) * H) / rect.height;
    const hit = POS.findIndex(
      (p) => Math.abs(x - p.cx) <= HALF + 6 && Math.abs(y - p.cy) <= HALF + 6
    );
    if (hit >= 0) pick(hit);
  };

  return (
    <div>
      <canvas
        id={`cv-${chapterId}-${moduleId}`}
        ref={ref}
        width={W}
        height={H}
        onClick={onCanvasClick}
        style={{ cursor: 'pointer' }}
      />
      <div className="ctrl">
        <label>
          当前 IoU <span className="val">{CASES[sel].iou.toFixed(2)}</span>
        </label>
        {CASES.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`chip${sel === i ? ' selected' : ''}`}
            onClick={() => pick(i)}
            aria-pressed={sel === i}
          >
            框 {i + 1}
          </button>
        ))}
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch4Mod1;
