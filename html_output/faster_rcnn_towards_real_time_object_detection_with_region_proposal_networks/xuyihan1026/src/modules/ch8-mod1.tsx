import React, { useEffect, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawAnchorSet,
  drawFrame,
  drawGrid,
  drawLabel,
  drawLegend,
  drawScope,
  useCanvas,
} from '../lib/skyKit';

// §8.1 module: the whole night-survey chain, clickable.
// Dominant operation: click one of the four parts (canvas hotspot or DOM chip).
// The orange ring moves, the active path is re-coloured and a fixed detail panel is replaced.
// The shared conv is drawn as a copper link feeding both the RPN and the RoI pooling stage.

const W = 1080;
const H = 280;

type Part = 'conv' | 'rpn' | 'roi' | 'cls';

const ORDER: Part[] = ['conv', 'rpn', 'roi', 'cls'];

const PARTS: Record<
  Part,
  { name: string; input: string; output: string; detail: string; fb: string; cls: string }
> = {
  conv: {
    name: '共享卷积',
    input: '整片夜空',
    output: '卷积特征图',
    detail: 'VGG / ZF 主干把整张图压成一张卷积特征图；RPN 与检测器都从同一张图读特征。',
    fb: '共享卷积：两台仪器共用同一份特征。',
    cls: '',
  },
  rpn: {
    name: 'RPN',
    input: '卷积特征图',
    output: '候选框',
    detail: '在特征图上滑 3×3 窗口，两条 1×1 分支分别出目标性与框偏移；NMS 后取前 300 个候选。',
    fb: 'RPN：滑窗 + 两条 1×1 分支，输出候选框。',
    cls: '',
  },
  roi: {
    name: 'RoI 池化',
    input: '候选框 + 特征图',
    output: '固定大小特征块',
    detail: '把大小不一的候选框对齐成同一尺寸的特征块，后面的分类器才好批处理。',
    fb: 'RoI 池化：把每个候选框对齐成固定大小。',
    cls: '',
  },
  cls: {
    name: '分类器',
    input: '固定特征块',
    output: '类别 + 精修框',
    detail: '只对候选框做分类与精修，昂贵的那一步只落在少数候选上。',
    fb: '分类器：只对候选框做分类与精修。',
    cls: 'good',
  },
};

const BOX: Record<Part, { x: number; y: number; w: number; h: number }> = {
  conv: { x: 56, y: 96, w: 132, h: 72 },
  rpn: { x: 250, y: 40, w: 132, h: 72 },
  roi: { x: 250, y: 176, w: 132, h: 72 },
  cls: { x: 470, y: 176, w: 132, h: 72 },
};

type EdgeKey = 'e-cr' | 'e-cro' | 'e-rr' | 'e-rc';

const EDGE: Record<EdgeKey, Array<[number, number]>> = {
  'e-cr': [
    [188, 132],
    [215, 132],
    [215, 76],
    [250, 76],
  ],
  'e-cro': [
    [188, 132],
    [215, 132],
    [215, 212],
    [250, 212],
  ],
  'e-rr': [
    [316, 112],
    [316, 176],
  ],
  'e-rc': [
    [382, 212],
    [470, 212],
  ],
};

const ACTIVE: Record<Part, EdgeKey[]> = {
  conv: ['e-cr', 'e-cro'],
  rpn: ['e-cr'],
  roi: ['e-cro', 'e-rr'],
  cls: ['e-rr', 'e-rc'],
};

function strokePath(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  color: string,
  width: number,
  dashed: boolean,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([7, 6]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function arrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 'up' | 'down' | 'left' | 'right',
  color: string
): void {
  const s = 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  if (dir === 'right') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - s * 1.6, y - s);
    ctx.lineTo(x - s * 1.6, y + s);
  } else if (dir === 'down') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - s, y - s * 1.6);
    ctx.lineTo(x + s, y - s * 1.6);
  } else if (dir === 'up') {
    ctx.moveTo(x, y);
    ctx.lineTo(x - s, y + s * 1.6);
    ctx.lineTo(x + s, y + s * 1.6);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 1.6, y - s);
    ctx.lineTo(x + s * 1.6, y + s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPartIcon(
  ctx: CanvasRenderingContext2D,
  part: Part,
  cx: number,
  cy: number,
  s: number
): void {
  if (part === 'conv') {
    drawGrid(ctx, cx - 30 * s, cy - 20 * s, 60 * s, 40 * s, 5, 3, { highlight: { r: 1, c: 2 } });
  } else if (part === 'rpn') {
    drawAnchorSet(ctx, cx, cy, 20 * s, { activeIndex: 4 });
  } else if (part === 'roi') {
    drawFrame(ctx, cx - 26 * s, cy - 12 * s, 24 * s, 16 * s, {
      color: COLORS.frame,
      dashed: true,
      alpha: 0.45,
      weight: 1.5,
    });
    drawFrame(ctx, cx - 26 * s, cy + 12 * s, 16 * s, 22 * s, {
      color: COLORS.frame,
      dashed: true,
      alpha: 0.45,
      weight: 1.5,
    });
    drawFrame(ctx, cx - 26 * s, cy + 1 * s, 28 * s, 13 * s, {
      color: COLORS.frame,
      dashed: true,
      alpha: 0.45,
      weight: 1.5,
    });
    ctx.save();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8 * s, cy);
    ctx.lineTo(cx + 8 * s, cy);
    ctx.stroke();
    ctx.restore();
    arrowHead(ctx, cx + 9 * s, cy, 'right', COLORS.muted);
    drawFrame(ctx, cx + 25 * s, cy, 26 * s, 26 * s, { color: COLORS.good, weight: 3 });
  } else {
    drawScope(ctx, cx, cy + 6 * s, 0.85 * s, { pointing: true, accent: COLORS.aux });
  }
}

export const Ch8Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef<{ sel: Part; share: boolean }>({ sel: 'rpn', share: true });
  const [sel, setSel] = useState<Part>('rpn');
  const [share, setShare] = useState(true);

  const part = PARTS[sel];
  const feedback = share
    ? { text: part.fb, cls: part.cls }
    : { text: `${part.fb} 当前是各自独立：铜色共享连线断开，两份卷积各算一遍。`, cls: '' };

  const { ref } = useCanvas(
    (ctx: CanvasRenderingContext2D) => {
      clearScene(ctx, W, H);
      const s = stateRef.current;
      const activeEdges = ACTIVE[s.sel];

      // ---- edges first, boxes on top ----
      (Object.keys(EDGE) as EdgeKey[]).forEach((key) => {
        const pts = EDGE[key];
        const active = activeEdges.includes(key);
        const sharedLink = key === 'e-cr' || key === 'e-cro';
        if (active) strokePath(ctx, pts, COLORS.fader, 7, false, 0.26);
        if (sharedLink) {
          strokePath(ctx, pts, s.share ? COLORS.rail : COLORS.muted, 3, !s.share, 1);
        } else {
          strokePath(ctx, pts, active ? COLORS.fader : COLORS.route, active ? 3 : 2, false, 1);
        }
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const dir: 'up' | 'down' | 'left' | 'right' =
          last[0] === prev[0] ? (last[1] > prev[1] ? 'down' : 'up') : last[0] > prev[0] ? 'right' : 'left';
        const arrowColor = sharedLink
          ? s.share
            ? COLORS.rail
            : COLORS.muted
          : active
          ? COLORS.fader
          : COLORS.route;
        arrowHead(ctx, last[0], last[1], dir, arrowColor);
      });

      // copper junction where the shared feature splits into the two stages
      ctx.save();
      ctx.fillStyle = s.share ? COLORS.rail : COLORS.muted;
      ctx.beginPath();
      ctx.arc(215, 132, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ---- the four parts ----
      ORDER.forEach((key) => {
        const b = BOX[key];
        const on = s.sel === key;
        if (on) {
          ctx.save();
          ctx.strokeStyle = COLORS.fader;
          ctx.lineWidth = 3;
          ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = 0.94;
        ctx.fillStyle = COLORS.sky2;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = on ? COLORS.fader : COLORS.grid;
        ctx.lineWidth = on ? 2.5 : 1.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.restore();
        drawPartIcon(ctx, key, b.x + b.w / 2, b.y + b.h / 2, 1);
      });

      // ---- fixed detail panel ----
      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = COLORS.sky2;
      ctx.fillRect(700, 40, 340, 208);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(700, 40, 340, 208);
      ctx.restore();

      drawLabel(ctx, PARTS[s.sel].name, 720, 72, { color: COLORS.ink, size: 16, bold: true });
      drawLabel(ctx, s.share ? '共享特征' : '各自独立', 720, 96, {
        color: s.share ? COLORS.star : COLORS.muted,
        size: 13,
      });

      drawPartIcon(ctx, s.sel, 870, 140, 1.3);

      // input -> part -> output strip
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = COLORS.route;
      ctx.fillRect(720, 190, 86, 32);
      ctx.fillStyle = COLORS.aux;
      ctx.fillRect(926, 190, 90, 32);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(720, 190, 86, 32);
      ctx.strokeStyle = COLORS.aux;
      ctx.strokeRect(926, 190, 90, 32);
      ctx.strokeStyle = COLORS.frame;
      ctx.strokeRect(826, 190, 80, 32);
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(812, 206);
      ctx.lineTo(820, 206);
      ctx.moveTo(910, 206);
      ctx.lineTo(920, 206);
      ctx.stroke();
      ctx.restore();
      arrowHead(ctx, 822, 206, 'right', COLORS.muted);
      arrowHead(ctx, 922, 206, 'right', COLORS.muted);

      drawLegend(ctx, 60, 262, [
        { color: COLORS.rail, text: '共享连线' },
        { color: COLORS.fader, text: '当前路径' },
        { color: COLORS.route, text: '数据流' },
      ]);
    },
    W,
    H,
    stateRef
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.cursor = 'pointer';
    const onPointerDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      for (const key of ORDER) {
        const b = BOX[key];
        if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) {
          stateRef.current.sel = key;
          setSel(key);
          return;
        }
      }
    };
    el.addEventListener('pointerdown', onPointerDown);
    return () => el.removeEventListener('pointerdown', onPointerDown);
  }, [ref]);

  const pick = (key: Part) => {
    stateRef.current.sel = key;
    setSel(key);
  };

  const setShared = (value: boolean) => {
    stateRef.current.share = value;
    setShare(value);
  };

  return (
    <div>
      <canvas ref={ref} width={W} height={H} />
      <div className="ctrl">
        {ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip ${sel === key ? 'selected' : ''}`}
            onClick={() => pick(key)}
          >
            {PARTS[key].name}
          </button>
        ))}
      </div>
      <div className="ctrl">
        <button
          type="button"
          className={`chip ${share ? 'selected' : ''}`}
          onClick={() => setShared(true)}
        >
          共享特征
        </button>
        <button
          type="button"
          className={`chip ${!share ? 'selected' : ''}`}
          onClick={() => setShared(false)}
        >
          各自独立
        </button>
      </div>
      <div className="hotspot-info">
        <div>
          <b>{part.name}</b>　输入：{part.input}　→　输出：{part.output}
        </div>
        <div>{part.detail}</div>
      </div>
      <div className={`feedback ${feedback.cls}`}>{feedback.text}</div>
    </div>
  );
};

export default Ch8Mod1;
