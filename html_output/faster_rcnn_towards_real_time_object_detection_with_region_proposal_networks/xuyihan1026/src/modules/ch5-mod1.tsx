import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawLegend, useCanvas, clamp, lerp } from '../lib/skyKit';

// §5 module: λ balances the classification term against the regression term.
// Dominant operation: drag λ (log 0.1–100) or hit one of the four reported presets.
// Canvas updates the beam, the two loss bars and the four measured mAP points.
// A custom λ never invents an mAP: the curve gets a dashed marker and the feedback says so.

const W = 1080;
const H = 280;

const LOSS_CLS = 0.3;
const LOSS_REG_UNIT = 0.03;

const PRESETS = [0.1, 1, 10, 100];

const REPORT = [
  { l: 0.1, map: 67.2 },
  { l: 1, map: 68.9 },
  { l: 10, map: 69.9 },
  { l: 100, map: 69.1 },
];

const NOTE: Record<string, string> = {
  '0.1': '回归项几乎不起作用，mAP 67.2%。',
  '1': '两项接近等权，mAP 68.9%。',
  '10': '两项大致等权，mAP 69.9%。',
  '100': '回归项被放大，mAP 仍是 69.1%。',
};

// x axis: log10(lambda) from -1 to 2; y axis: mAP from 66.5 to 70.5
const PX0 = 620;
const PX1 = 1000;
const PY0 = 78;
const PY1 = 228;

const xOf = (lambda: number): number =>
  PX0 + ((Math.log10(clamp(lambda, 0.1, 100)) + 1) / 3) * (PX1 - PX0);
const yOf = (map: number): number => PY1 - ((map - 66.5) / 4) * (PY1 - PY0);

const mapAt = (lambda: number): number => {
  const xs = REPORT.map((r) => Math.log10(r.l));
  const x = Math.log10(clamp(lambda, 0.1, 100));
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i += 1;
  const t = clamp((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1);
  return lerp(REPORT[i].map, REPORT[i + 1].map, t);
};

const fmt = (lambda: number): string =>
  lambda >= 1 ? String(Math.round(lambda * 100) / 100) : String(Number(lambda.toPrecision(2)));

function drawPan(ctx: CanvasRenderingContext2D, x: number, y: number, drop: number): void {
  ctx.save();
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 15, y);
  ctx.quadraticCurveTo(x, y + 8, x + 15, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - drop);
  ctx.lineTo(x - 15, y);
  ctx.moveTo(x, y - drop);
  ctx.lineTo(x + 15, y);
  ctx.stroke();
  ctx.restore();
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = COLORS.axis;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(frac, 0, 1)), h - 4);
  ctx.restore();
}

export const Ch5Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ logv: 100 });
  const [logv, setLogv] = useState(100);

  const lambda = Math.pow(10, logv / 100);
  const cls = LOSS_CLS;
  const reg = LOSS_REG_UNIT * lambda;
  const reported = PRESETS.find((p) => Math.abs(100 * Math.log10(p) - logv) < 0.001);
  const feedback = reported
    ? { text: `λ = ${fmt(reported)}：${NOTE[String(reported)]}`, cls: 'good' }
    : { text: `λ = ${fmt(lambda)}：这是自定义值，论文未报告该点的 mAP。`, cls: '' };

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D) => {
      clearScene(ctx, W, H);
      const lam = Math.pow(10, stateRef.current.logv / 100);
      const clsLoss = LOSS_CLS;
      const regLoss = LOSS_REG_UNIT * lam;
      const maxTerm = Math.max(clsLoss, regLoss);

      // ---------- left: the balance beam ----------
      const pivotX = 300;
      const beamY = 88;
      const half = 106;
      const drop = 44;
      const tilt = -clamp(Math.log10(lam / 10), -1, 1) * 0.3;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const lx = pivotX - half * cos;
      const ly = beamY + half * sin;
      const rx = pivotX + half * cos;
      const ry = beamY - half * sin;

      ctx.save();
      ctx.strokeStyle = COLORS.rail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pivotX, beamY);
      ctx.lineTo(pivotX, 262);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pivotX - 20, 262);
      ctx.lineTo(pivotX + 20, 262);
      ctx.stroke();
      ctx.restore();

      drawPan(ctx, lx, ly + drop, drop);
      drawPan(ctx, rx, ry + drop, drop);

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
      ctx.arc(pivotX, beamY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // weight blocks: classification (blue) vs weighted regression (amber)
      const wL = 10 + 16 * (clsLoss / maxTerm);
      const wR = 10 + 16 * (regLoss / maxTerm);
      ctx.fillStyle = COLORS.route;
      ctx.fillRect(lx - 13, ly + drop - wL, 26, wL);
      ctx.fillStyle = COLORS.frame;
      ctx.fillRect(rx - 13, ry + drop - wR, 26, wR);

      if (Math.abs(tilt) < 0.02) {
        ctx.save();
        ctx.strokeStyle = COLORS.good;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pivotX, beamY, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // two loss bars
      drawBar(ctx, 90, 202, 180, 20, clsLoss / maxTerm, COLORS.route);
      drawBar(ctx, 310, 202, 180, 20, regLoss / maxTerm, COLORS.frame);
      drawLabel(ctx, '分类项', 90, 240, { color: COLORS.muted, size: 13 });
      drawLabel(ctx, '回归项', 310, 240, { color: COLORS.muted, size: 13 });

      // ---------- right: the four reported mAP points ----------
      ctx.save();
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PX0, PY0 - 6);
      ctx.lineTo(PX0, PY1);
      ctx.lineTo(PX1, PY1);
      ctx.stroke();
      ctx.restore();

      REPORT.forEach((r) => {
        const x = xOf(r.l);
        ctx.save();
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, PY1);
        ctx.lineTo(x, PY1 + 5);
        ctx.stroke();
        ctx.restore();
      });

      ctx.save();
      ctx.strokeStyle = COLORS.star;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      REPORT.forEach((r, i) => {
        const x = xOf(r.l);
        const y = yOf(r.map);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();

      REPORT.forEach((r) => {
        ctx.save();
        ctx.fillStyle = COLORS.good;
        ctx.beginPath();
        ctx.arc(xOf(r.l), yOf(r.map), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // current λ: an orange ring on the curve; dashed when the paper did not report it
      const cx = xOf(lam);
      const cy = yOf(mapAt(lam));
      const onPoint = REPORT.some((r) => Math.abs(r.l - lam) < 1e-6);
      ctx.save();
      if (!onPoint) {
        ctx.strokeStyle = COLORS.fader;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, PY1);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = COLORS.fader;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      if (onPoint) {
        ctx.fillStyle = COLORS.fader;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      drawLegend(ctx, PX0, 254, [
        { color: COLORS.good, text: '实测点' },
        { color: COLORS.fader, text: '当前 λ' },
      ]);
    },
    W,
    H,
    stateRef
  );

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    stateRef.current.logv = v;
    setLogv(v);
  };

  const pick = (lambdaValue: number) => {
    const v = Math.round(100 * Math.log10(lambdaValue));
    stateRef.current.logv = v;
    setLogv(v);
  };

  return (
    <div>
      <canvas ref={ref} width={W} height={H} />
      <div className="ctrl">
        <label>
          λ <span className="val">{fmt(lambda)}</span>
        </label>
        <input
          type="range"
          min={-100}
          max={200}
          step={10}
          value={logv}
          onChange={onSlide}
          aria-label="λ 权重（对数 0.1 到 100）"
        />
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${reported === p ? 'selected' : ''}`}
            onClick={() => pick(p)}
          >
            {fmt(p)}
          </button>
        ))}
      </div>
      <div className="ctrl">
        <label>
          分类项 <span className="val">{cls.toFixed(2)}</span>
        </label>
        <label>
          回归项 <span className="val">{reg.toFixed(2)}</span>
        </label>
        <label>
          合计（示意） <span className="val">{(cls + reg).toFixed(2)}</span>
        </label>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch5Mod1;
