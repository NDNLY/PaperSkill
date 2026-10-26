import React, { useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawStar,
  drawFrame,
  drawGrid,
  drawLabel,
  drawLegend,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Module 2.1 — slide the 3x3 survey window over the 14x8 star chart, then read the
// compressed feature length and the two sibling 1x1 branches. One dominant operation
// (move the window) drives the canvas, the feedback and the position readout.

const W = 1080;
const H = 280;
const COLS = 14;
const ROWS = 8;
const GX = 48;
const GY = 44;
const CW = 34;
const CH = 22;
const FEAT = { zf: 256, vgg: 512 } as const;
type Backbone = keyof typeof FEAT;

interface Cell {
  r: number;
  c: number;
}

interface State extends Cell {
  backbone: Backbone;
}

const INITIAL_FEEDBACK = '窗口覆盖 3×3 个格子，压成一段特征。';
const FEEDBACK: Record<Backbone, string> = {
  vgg: '窗口覆盖 3×3 个格子，VGG 下压成 512 维。',
  zf: 'ZF 下是 256 维：主干更浅，特征更短。',
};

const hash = (r: number, c: number, i: number) => {
  const v = Math.sin(r * 127.1 + c * 311.7 + i * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

export const Ch2Mod1: React.FC<WidgetProps> = () => {
  const stateRef = useRef<State>({ r: 3, c: 5, backbone: 'vgg' });
  const [cell, setCell] = useState<Cell>({ r: 3, c: 5 });
  const [backbone, setBackbone] = useState<Backbone>('vgg');
  const [feedback, setFeedback] = useState({ text: INITIAL_FEEDBACK, cls: '' });
  const dragging = useRef(false);

  const moveTo = (r: number, c: number) => {
    const rr = Math.round(clamp(r, 0, ROWS - 1));
    const cc = Math.round(clamp(c, 0, COLS - 1));
    stateRef.current.r = rr;
    stateRef.current.c = cc;
    setCell({ r: rr, c: cc });
    setFeedback({ text: FEEDBACK[stateRef.current.backbone], cls: '' });
  };

  const pickBackbone = (b: Backbone) => {
    stateRef.current.backbone = b;
    setBackbone(b);
    setFeedback({ text: FEEDBACK[b], cls: '' });
  };

  const cellFromPointer = (e: React.PointerEvent<HTMLCanvasElement>): Cell | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    if (x < GX - 12 || x > GX + COLS * CW + 12 || y < GY - 12 || y > GY + ROWS * CH + 12) {
      return null;
    }
    return { r: Math.floor((y - GY) / CH), c: Math.floor((x - GX) / CW) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = cellFromPointer(e);
    if (!hit) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(hit.r, hit.c);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const hit = cellFromPointer(e);
    if (hit) moveTo(hit.r, hit.c);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    let dr = 0;
    let dc = 0;
    if (e.key === 'ArrowUp') dr = -1;
    else if (e.key === 'ArrowDown') dr = 1;
    else if (e.key === 'ArrowLeft') dc = -1;
    else if (e.key === 'ArrowRight') dc = 1;
    else return;
    e.preventDefault();
    moveTo(stateRef.current.r + dr, stateRef.current.c + dc);
  };

  const { ref } = useCanvas(
    (ctx, _time, s: State) => {
      clearScene(ctx, W, H);

      // Faint star chart: each cell holds a few stars.
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          const n = 1 + Math.floor(hash(r, c, 1) * 2);
          for (let i = 0; i < n; i += 1) {
            const sx = GX + c * CW + 5 + hash(r, c, i + 2) * (CW - 10);
            const sy = GY + r * CH + 4 + hash(r, c, i + 5) * (CH - 8);
            drawStar(ctx, sx, sy, 1 + hash(r, c, i + 8) * 1.5, {
              kind: hash(r, c, i + 13) > 0.9 ? 'bright' : hash(r, c, i + 17) > 0.5 ? 'point' : 'faint',
            });
          }
        }
      }

      // Cells covered by the 3x3 window.
      const r0 = Math.max(0, s.r - 1);
      const r1 = Math.min(ROWS - 1, s.r + 1);
      const c0 = Math.max(0, s.c - 1);
      const c1 = Math.min(COLS - 1, s.c + 1);
      ctx.save();
      ctx.globalAlpha = 0.17;
      ctx.fillStyle = COLORS.frame;
      for (let r = r0; r <= r1; r += 1) {
        for (let c = c0; c <= c1; c += 1) {
          ctx.fillRect(GX + c * CW + 1, GY + r * CH + 1, CW - 2, CH - 2);
        }
      }
      ctx.restore();

      drawGrid(ctx, GX, GY, COLS * CW, ROWS * CH, COLS, ROWS);

      // The centre cell of the window is the one the head is computed at.
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = COLORS.fader;
      ctx.fillRect(GX + s.c * CW + 1, GY + s.r * CH + 1, CW - 2, CH - 2);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = COLORS.fader;
      ctx.lineWidth = 2;
      ctx.strokeRect(GX + s.c * CW + 2, GY + s.r * CH + 2, CW - 4, CH - 4);
      ctx.restore();

      const wx = GX + c0 * CW;
      const wy = GY + r0 * CH;
      const ww = (c1 - c0 + 1) * CW;
      const wh = (r1 - r0 + 1) * CH;
      drawFrame(ctx, wx + ww / 2, wy + wh / 2, ww, wh, { color: COLORS.route, weight: 3 });
      drawLabel(ctx, '3×3 窗口', wx, wy - 6, { color: COLORS.ink, size: 14 });

      // Shared feature length, then the two sibling 1x1 branches.
      const fx = 640;
      const fy = 76;
      const fw = 340;
      const fh = 18;
      const dim = FEAT[s.backbone];

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx + ww, wy + wh / 2);
      ctx.lineTo(fx, fy + fh / 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = COLORS.axis;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.restore();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(fx, fy, fw, fh);

      const len = fw * (dim / 512);
      ctx.fillStyle = COLORS.route;
      ctx.fillRect(fx + 1.5, fy + 1.5, Math.max(4, len - 3), fh - 3);
      for (let x = fx + 21; x < fx + len - 2; x += 21) {
        ctx.strokeStyle = COLORS.sky;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, fy + 2);
        ctx.lineTo(x, fy + fh - 2);
        ctx.stroke();
      }

      const forkX = fx + len;
      const top = 136;
      const tileW = 42;
      const tileH = 13;
      const tileGap = 4;
      const clsX = 720;
      const regX = 880;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = COLORS.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(forkX, fy + fh);
      ctx.lineTo(forkX, 122);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(forkX, 122);
      ctx.lineTo(clsX + tileW / 2, top);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(forkX, 122);
      ctx.lineTo(regX + tileW / 2, top);
      ctx.stroke();
      ctx.restore();

      const tiles = (x: number, count: number, color: string) => {
        for (let i = 0; i < count; i += 1) {
          ctx.fillStyle = color;
          ctx.fillRect(x, top + i * (tileH + tileGap), tileW, tileH);
        }
      };
      tiles(clsX, 2, COLORS.route);
      tiles(regX, 4, COLORS.aux);
      drawLabel(ctx, '2k/4k 分支', 640, 130, { color: COLORS.muted, size: 14 });

      drawLegend(ctx, 48, 262, [
        { color: COLORS.route, text: '当前窗口' },
        { color: COLORS.frame, text: '覆盖格' },
        { color: COLORS.aux, text: '两条分支' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return (
    <div>
      <canvas
        ref={ref}
        width={W}
        height={H}
        tabIndex={0}
        aria-label="星图网格：拖动或按方向键移动 3×3 取景窗口"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
      <div className="ctrl">
        <span>主干</span>
        <button
          type="button"
          className={`chip${backbone === 'zf' ? ' selected' : ''}`}
          aria-pressed={backbone === 'zf'}
          onClick={() => pickBackbone('zf')}
        >
          ZF · 256
        </button>
        <button
          type="button"
          className={`chip${backbone === 'vgg' ? ' selected' : ''}`}
          aria-pressed={backbone === 'vgg'}
          onClick={() => pickBackbone('vgg')}
        >
          VGG · 512
        </button>
        <span className="val">{FEAT[backbone]} 维</span>
        <span>
          行 {cell.r + 1} · 列 {cell.c + 1}
        </span>
        <span>拖动星图，或用方向键移动一格</span>
      </div>
      <div className={`feedback ${feedback.cls}`} aria-live="polite">
        {feedback.text}
      </div>
    </div>
  );
};

export default Ch2Mod1;
