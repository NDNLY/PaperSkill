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

// Module 6.1 — four offsets turn the anchor (dashed) into the live box (solid).
// The box, the IoU and the four parameterisation terms all read from the same state.

const W = 1080;
const H = 280;

const AX = 330;
const AY = 138;
const AW = 124;
const AH = 66;
const GT = { x: 382, y: 132, w: 108, h: 64 };

type OffsetKey = 'tx' | 'ty' | 'tw' | 'th';
type Offsets = Record<OffsetKey, number>;
const ZERO: Offsets = { tx: 0, ty: 0, tw: 0, th: 0 };
const KEYS: OffsetKey[] = ['tx', 'ty', 'tw', 'th'];

const FONT = '"SFMono-Regular", "Cascadia Mono", Menlo, monospace';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (o: Offsets): Box => ({
  x: AX + o.tx * AW,
  y: AY + o.ty * AH,
  w: AW * Math.exp(o.tw),
  h: AH * Math.exp(o.th),
});

const iouOf = (b: Box): number => {
  const ix =
    Math.min(b.x + b.w / 2, GT.x + GT.w / 2) - Math.max(b.x - b.w / 2, GT.x - GT.w / 2);
  const iy =
    Math.min(b.y + b.h / 2, GT.y + GT.h / 2) - Math.max(b.y - b.h / 2, GT.y - GT.h / 2);
  if (ix <= 0 || iy <= 0) return 0;
  const inter = ix * iy;
  return inter / (b.w * b.h + GT.w * GT.h - inter);
};

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

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

export const Ch6Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef<Offsets>({ ...ZERO });
  const [offsets, setOffsets] = useState<Offsets>({ ...ZERO });
  const [feedback, setFeedback] = useState({ text: '偏移全 0：框就是锚框本身。', cls: '' });

  const apply = (next: Offsets, isReset: boolean) => {
    stateRef.current = next;
    setOffsets(next);
    if (isReset) {
      setFeedback({ text: '偏移全 0：框就是锚框本身。', cls: '' });
      return;
    }
    const iou = iouOf(boxOf(next));
    setFeedback(
      iou > 0.7
        ? { text: `IoU ${iou.toFixed(2)}：已经套住星了。`, cls: 'good' }
        : { text: `IoU ${iou.toFixed(2)}：继续调中心与大小。`, cls: '' }
    );
  };

  const onChange = (k: OffsetKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    apply({ ...stateRef.current, [k]: Number(e.target.value) }, false);
  };

  const reset = () => apply({ ...ZERO }, true);

  const iou = iouOf(boxOf(offsets));

  const { ref } = useCanvas(
    (ctx, _time, s: Offsets) => {
      clearScene(ctx, W, H);

      const b = boxOf(s);
      const cur = iouOf(b);

      // Shift from the anchor centre to the live centre.
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(AX, AY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      // Anchor (reference) and the live box. Corner ticks keep the anchor readable
      // even when the live box sits exactly on top of it.
      drawFrame(ctx, AX, AY, AW, AH, { color: COLORS.muted, dashed: true, weight: 2 });
      ctx.save();
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 2;
      (
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as Array<[number, number]>
      ).forEach(([sx, sy]) => {
        const cx0 = AX + (sx * AW) / 2;
        const cy0 = AY + (sy * AH) / 2;
        ctx.beginPath();
        ctx.moveTo(cx0 - sx * 10, cy0);
        ctx.lineTo(cx0, cy0);
        ctx.lineTo(cx0, cy0 - sy * 10);
        ctx.stroke();
      });
      ctx.restore();
      drawFrame(ctx, b.x, b.y, b.w, b.h, {
        color: cur > 0.7 ? COLORS.good : COLORS.route,
        weight: 3,
      });

      // Target star.
      drawStar(ctx, GT.x, GT.y, 5, { kind: 'bright' });
      ctx.fillStyle = COLORS.fader;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();

      drawLabel(ctx, '锚框', 48, 32, { color: COLORS.muted, size: 14 });
      drawLabel(ctx, '当前框', 100, 32, {
        color: cur > 0.7 ? COLORS.good : COLORS.route,
        size: 14,
      });

      // Side panel: the four terms plus the resulting geometry and IoU.
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = COLORS.sky2;
      ctx.fillRect(648, 36, 392, 210);
      ctx.restore();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(648, 36, 392, 210);

      const rows: Array<[string, number]> = [
        ['t_x = (x − x_a) / w_a', s.tx],
        ['t_y = (y − y_a) / h_a', s.ty],
        ['t_w = log(w / w_a)', s.tw],
        ['t_h = log(h / h_a)', s.th],
      ];
      rows.forEach(([term, v], i) => {
        const ry = 66 + i * 28;
        write(ctx, term, 662, ry, COLORS.muted, 14);
        write(ctx, signed(v), 1024, ry, COLORS.fader, 16, 'right', '600');
      });

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(662, 164);
      ctx.lineTo(1026, 164);
      ctx.stroke();

      write(
        ctx,
        `x ${b.x.toFixed(0)}   y ${b.y.toFixed(0)}   w ${b.w.toFixed(0)}   h ${b.h.toFixed(0)}`,
        662,
        186,
        COLORS.muted,
        13
      );

      write(ctx, 'IoU', 662, 210, COLORS.ink, 15, 'left', '600');
      write(ctx, cur.toFixed(2), 1024, 212, COLORS.fader, 18, 'right', '600');
      drawMeter(ctx, 662, 218, 362, 10, cur, { direction: 'up' });

      drawLegend(ctx, 48, 262, [
        { color: COLORS.star, text: '真值星' },
        { color: COLORS.fader, text: '偏移量' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return (
    <div>
      <canvas ref={ref} width={W} height={H} aria-label="拖动偏移量，把框从锚框挪到星上" />
      <div className="ctrl">
        {KEYS.map((k) => (
          <label key={k}>
            {k} <span className="val">{offsets[k].toFixed(2)}</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={offsets[k]}
              aria-label={`偏移量 ${k}`}
              onChange={onChange(k)}
            />
          </label>
        ))}
        <button type="button" className="chip" onClick={reset}>
          重置
        </button>
        <span className="val">IoU {iou.toFixed(2)}</span>
      </div>
      <div className={`feedback ${feedback.cls}`} aria-live="polite">
        {feedback.text}
      </div>
    </div>
  );
};

export default Ch6Mod1;
