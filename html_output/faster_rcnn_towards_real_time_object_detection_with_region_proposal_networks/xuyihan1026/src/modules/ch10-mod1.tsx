import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawLegend, useCanvas, clamp } from '../lib/skyKit';

// §10 module: one result race, three verified metric groups.
// Dominant operation: press 开始比较, then switch the voc / speed / coco chips.
// CRITICAL: for speed the metric is LOWER-is-better, so the bar length, the axis label and the
// leading marker all respect the direction (198 ms vs 1830 ms).

const W = 1080;
const H = 280;

type Bench = 'voc' | 'speed' | 'coco';

type Result = {
  chip: string;
  ours: number;
  rival: number;
  max: number;
  dir: 'up' | 'down';
  axisLabel: string;
  label: string;
};

const RES: Record<Bench, Result> = {
  voc: {
    chip: 'VOC 2007',
    ours: 59.9,
    rival: 58.7,
    max: 70,
    dir: 'up',
    axisLabel: '越高越好·mAP',
    label: 'VOC 2007 mAP（ZF，300 框 vs SS 2000 框）',
  },
  speed: {
    chip: '速度',
    ours: 198,
    rival: 1830,
    max: 2000,
    dir: 'down',
    axisLabel: '越低越好·毫秒',
    label: '每张图毫秒（VGG，越低越好）',
  },
  coco: {
    chip: 'COCO',
    ours: 42.1,
    rival: 39.3,
    max: 50,
    dir: 'up',
    axisLabel: '越高越好·mAP',
    label: 'COCO test-dev mAP@0.5（Faster vs Fast R-CNN）',
  },
};

const BENCHES: Bench[] = ['voc', 'speed', 'coco'];

const TRACK_X = 96;
const TRACK_W = 904;
const LANE_OURS = 88;
const LANE_RIVAL = 142;
const BAR_H = 34;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Bar length in "better is longer" space: lower-is-better metrics are inverted. */
const fracOf = (value: number, r: Result): number =>
  r.dir === 'down' ? clamp((r.max - value) / r.max, 0, 1) : clamp(value / r.max, 0, 1);

function drawTrackBar(
  ctx: CanvasRenderingContext2D,
  y: number,
  frac: number,
  progress: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = COLORS.sky2;
  ctx.fillRect(TRACK_X, y, TRACK_W, BAR_H);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(TRACK_X, y, TRACK_W, BAR_H);
  ctx.fillStyle = color;
  ctx.fillRect(TRACK_X, y, Math.max(0, TRACK_W * frac * progress), BAR_H);
  ctx.restore();
}

export const Ch10Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef<{ bench: Bench; start: number | null; race: number }>({
    bench: 'voc',
    start: null,
    race: 0,
  });
  const [bench, setBench] = useState<Bench>('voc');
  const [race, setRace] = useState(0);

  const res = RES[bench];
  const feedback =
    race === 0
      ? { text: '选一组结果，按下开始。', cls: '' }
      : { text: `${res.label}：本方法 ${res.ours}，对照 ${res.rival}。`, cls: 'good' };

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D, time: number) => {
      clearScene(ctx, W, H);
      const s = stateRef.current;
      const r = RES[s.bench];
      const elapsed = s.start === null ? 0 : Math.max(0, (time - s.start) / 1000);
      const pOurs = easeOutCubic(clamp(elapsed / 1.05, 0, 1));
      const pRival = easeOutCubic(clamp((elapsed - 0.25) / 1.5, 0, 1));
      if (s.start !== null && elapsed >= 1.9 && s.race === 0) {
        s.race = 1;
        setRace(1);
      }

      const fracOurs = fracOf(r.ours, r);
      const fracRival = fracOf(r.rival, r);
      const oursWins = r.dir === 'up' ? r.ours > r.rival : r.ours < r.rival;

      // start line and finish line
      ctx.save();
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(TRACK_X, 74);
      ctx.lineTo(TRACK_X, 190);
      ctx.stroke();
      ctx.strokeStyle = COLORS.star;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(TRACK_X + TRACK_W, 74);
      ctx.lineTo(TRACK_X + TRACK_W, 190);
      ctx.stroke();
      ctx.restore();

      drawTrackBar(ctx, LANE_OURS, fracOurs, pOurs, COLORS.good);
      drawTrackBar(ctx, LANE_RIVAL, fracRival, pRival, COLORS.muted);

      // leading marker: only when the paper method really is ahead in this metric's direction
      if (oursWins && pOurs >= 1) {
        const xEnd = TRACK_X + TRACK_W * fracOurs;
        ctx.save();
        ctx.fillStyle = COLORS.fader;
        ctx.beginPath();
        ctx.moveTo(xEnd + 14, LANE_OURS + BAR_H / 2);
        ctx.lineTo(xEnd + 3, LANE_OURS + BAR_H / 2 - 9);
        ctx.lineTo(xEnd + 3, LANE_OURS + BAR_H / 2 + 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // axis with a stated direction
      ctx.save();
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(TRACK_X, 196);
      ctx.lineTo(TRACK_X + TRACK_W, 196);
      ctx.stroke();
      [0, 0.25, 0.5, 0.75, 1].forEach((f) => {
        const x = TRACK_X + TRACK_W * f;
        ctx.beginPath();
        ctx.moveTo(x, 196);
        ctx.lineTo(x, 202);
        ctx.stroke();
      });
      ctx.restore();

      drawLabel(ctx, r.axisLabel, TRACK_X, 222, { color: COLORS.muted, size: 13 });
      drawLegend(ctx, 660, 222, [
        { color: COLORS.good, text: '本方法' },
        { color: COLORS.muted, text: '对照' },
      ]);
    },
    W,
    H,
    stateRef
  );

  const startRace = () => {
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stateRef.current.start = reduce ? -1e6 : performance.now();
    stateRef.current.race = 0;
    setRace(0);
  };

  const pick = (value: Bench) => {
    stateRef.current.bench = value;
    stateRef.current.start = null;
    stateRef.current.race = 0;
    setBench(value);
    setRace(0);
  };

  return (
    <div>
      <canvas ref={ref} width={W} height={H} />
      <div className="ctrl">
        <button type="button" className="tiny" onClick={startRace}>
          开始比较
        </button>
        {BENCHES.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${bench === value ? 'selected' : ''}`}
            onClick={() => pick(value)}
          >
            {RES[value].chip}
          </button>
        ))}
        <label>
          本方法 <span className="val">{res.ours}</span>
        </label>
        <label>
          对照 <span className="val">{res.rival}</span>
        </label>
      </div>
      <div className="hotspot-info">
        <div>{res.label}</div>
        <div>
          本方法 <b>{res.ours}</b>　对照 <b>{res.rival}</b>　方向：{res.dir === 'up' ? '越高越好' : '越低越好'}
        </div>
      </div>
      <div className="hotspot-info">
        <div>
          <b>同一篇论文的其他已验证结果</b>
        </div>
        <div>
          VOC 2007 test、VGG-16、只训 VOC07：共享特征 69.9% mAP，不共享 68.5%，SS 基线 66.9%。
          加上 VOC 2012 trainval（07+12）到 73.2%，SS 对应 70.0%。
          COCO test-dev 上则是 42.1% mAP@0.5 / 21.5% mAP@[.5,.95]。
        </div>
      </div>
      <div className="hotspot-info">
        <div>
          <b>边界</b>
        </div>
        <div>论文自己提醒：SS/EB 是 CPU 实现，与 GPU 检测器比速度并不公平；竞赛第一还叠加了其他改进。</div>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch10Mod1;
