import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { COLORS, clearScene, drawLabel, drawLegend, useCanvas } from '../lib/skyKit';

// §8.2 module: four-step alternating training.
// Dominant operation: pick one of the four step chips.
// The canvas is a 4-step x 3-layer board: every step shows which layers train and which are frozen.

const W = 1080;
const H = 280;

type Status = 'train' | 'frozen' | 'idle';

type Step = {
  chip: string;
  target: string;
  conv: Status;
  rpn: Status;
  det: Status;
  note: string;
  fb: string;
  cls: string;
};

const STEPS: Step[] = [
  {
    chip: 'RPN',
    target: '训 RPN',
    conv: 'train',
    rpn: 'train',
    det: 'idle',
    note: '只用 ImageNet 权重训 RPN；检测器这一步还没参与，候选框全部由这个 RPN 产出。',
    fb: '第 1 步：只用 ImageNet 权重训 RPN。',
    cls: '',
  },
  {
    chip: '检测器',
    target: '训检测器',
    conv: 'train',
    rpn: 'frozen',
    det: 'train',
    note: '用第 1 步的候选框训 Fast R-CNN；候选框在这步固定不动，检测器开始学分类与精修。',
    fb: '第 2 步：用第 1 步的候选框训 Fast R-CNN。',
    cls: '',
  },
  {
    chip: '回训 RPN',
    target: '回训 RPN',
    conv: 'frozen',
    rpn: 'train',
    det: 'frozen',
    note: '固定共享卷积，用第 2 步检测器的权重回训 RPN 独有层；候选框质量在这步被拉高。',
    fb: '第 3 步：固定共享卷积，用检测器权重回训 RPN 独有层。',
    cls: '',
  },
  {
    chip: '微调检测器',
    target: '微调检测器',
    conv: 'frozen',
    rpn: 'frozen',
    det: 'train',
    note: '固定共享卷积，只微调检测器独有层；到这里两个阶段才真正共用同一份卷积。',
    fb: '第 4 步：固定共享卷积，只微调检测器独有层。',
    cls: 'good',
  },
];

const STATUS_ZH: Record<Status, string> = {
  train: '在训练',
  frozen: '已冻结',
  idle: '未参与',
};

const COL_X = (i: number): number => 46 + i * 250;
const COL_W = 238;
const CELL_X = 12;
const CELL_W = 214;
const ROW_Y = [80, 122, 164];
const ROW_H = 36;

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x - 6, y - 4, 12, 9);
  ctx.restore();
}

function drawRowIcon(ctx: CanvasRenderingContext2D, row: number, x: number, y: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  if (row === 0) {
    // shared conv: a small feature map
    for (let i = 0; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - 14 + i * 14, y - 9);
      ctx.lineTo(x - 14 + i * 14, y + 9);
      ctx.stroke();
    }
    for (let j = 0; j <= 2; j += 1) {
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 9 + j * 9);
      ctx.lineTo(x + 14, y - 9 + j * 9);
      ctx.stroke();
    }
  } else if (row === 1) {
    // RPN: nested frames
    ctx.strokeRect(x - 13, y - 9, 26, 18);
    ctx.strokeRect(x - 8, y - 5, 16, 10);
  } else {
    // detector: a telescope tube
    ctx.fillRect(x - 14, y - 4, 22, 8);
    ctx.fillRect(x + 5, y - 6, 4, 12);
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 4);
    ctx.lineTo(x - 12, y + 11);
    ctx.moveTo(x - 8, y + 4);
    ctx.lineTo(x - 4, y + 11);
    ctx.stroke();
  }
  ctx.restore();
}

export const Ch8Mod2: React.FC<WidgetProps> = () => {
  const stateRef = useRef({ step: 0 });
  const [step, setStep] = useState(0);

  const cur = STEPS[step];
  const feedback = { text: cur.fb, cls: cur.cls };

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D, time: number) => {
      clearScene(ctx, W, H);
      const s = stateRef.current;
      const pulse = 0.55 + 0.45 * Math.sin(time / 320);

      STEPS.forEach((item, col) => {
        const x = COL_X(col);
        const isCurrent = col === s.step;
        const done = col < s.step;

        // header band = one segment of the 4-step progress
        ctx.save();
        ctx.globalAlpha = isCurrent ? 0.85 : done ? 0.45 : 0.28;
        ctx.fillStyle = isCurrent ? COLORS.fader : done ? COLORS.route : COLORS.grid;
        ctx.fillRect(x + CELL_X, 44, CELL_W, 18);
        ctx.restore();

        const rows: Array<[Status, number]> = [
          [item.conv, 0],
          [item.rpn, 1],
          [item.det, 2],
        ];

        rows.forEach(([status, row]) => {
          const y = ROW_Y[row];
          const isTarget = isCurrent && ((row === 1 && item.rpn === 'train') || (row === 2 && item.det === 'train'));
          ctx.save();
          if (status === 'train') {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = COLORS.good;
            ctx.fillRect(x + CELL_X, y, CELL_W, ROW_H);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = COLORS.good;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + CELL_X, y, CELL_W, ROW_H);
            ctx.globalAlpha = 0.5 + 0.5 * pulse;
            ctx.fillStyle = COLORS.good;
            ctx.fillRect(x + CELL_X + 4, y + 4, 4, ROW_H - 8);
          } else if (status === 'frozen') {
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = COLORS.muted;
            ctx.fillRect(x + CELL_X, y, CELL_W, ROW_H);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = COLORS.muted;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(x + CELL_X, y, CELL_W, ROW_H);
          } else {
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = COLORS.grid;
            ctx.fillRect(x + CELL_X, y, CELL_W, ROW_H);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = COLORS.grid;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.strokeRect(x + CELL_X, y, CELL_W, ROW_H);
          }
          ctx.restore();

          drawRowIcon(
            ctx,
            row,
            x + CELL_X + 20,
            y + ROW_H / 2,
            status === 'train' ? COLORS.good : status === 'frozen' ? COLORS.muted : COLORS.grid
          );

          if (status === 'frozen') {
            drawLock(ctx, x + CELL_X + CELL_W - 20, y + ROW_H / 2, COLORS.muted);
          }

          if (isTarget) {
            ctx.save();
            ctx.strokeStyle = COLORS.fader;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + CELL_X - 3, y - 3, CELL_W + 6, ROW_H + 6);
            ctx.restore();
          }
        });

        if (isCurrent) {
          ctx.save();
          ctx.strokeStyle = COLORS.fader;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, 36, COL_W - 8, 178);
          ctx.restore();
        }
      });

      // only two in-canvas labels: which step, and what it trains
      drawLabel(ctx, `第 ${s.step + 1} 步`, 46, 30, {
        color: COLORS.ink,
        size: 15,
        bold: true,
      });
      drawLabel(ctx, STEPS[s.step].target, 170, 30, { color: COLORS.fader, size: 13 });

      drawLegend(ctx, 46, 244, [
        { color: COLORS.good, text: '在训练' },
        { color: COLORS.muted, text: '已冻结' },
        { color: COLORS.grid, text: '未参与' },
      ]);
    },
    W,
    H,
    stateRef
  );

  const pick = (index: number) => {
    stateRef.current.step = index;
    setStep(index);
  };

  return (
    <div>
      <canvas ref={ref} width={W} height={H} />
      <div className="ctrl">
        {STEPS.map((item, i) => (
          <button
            key={item.target}
            type="button"
            className={`chip ${step === i ? 'selected' : ''}`}
            onClick={() => pick(i)}
          >
            {i + 1} {item.chip}
          </button>
        ))}
      </div>
      <div className="hotspot-info">
        <div>
          <b>第 {step + 1} 步</b>　共享卷积：{STATUS_ZH[cur.conv]}　RPN 独有层：{STATUS_ZH[cur.rpn]}
          　检测器独有层：{STATUS_ZH[cur.det]}
        </div>
        <div>{cur.note}</div>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch8Mod2;
