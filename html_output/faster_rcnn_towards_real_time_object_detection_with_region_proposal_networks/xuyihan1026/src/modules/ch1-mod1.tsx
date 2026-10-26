import React, { useEffect, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import {
  COLORS,
  clearScene,
  drawGrid,
  drawStar,
  drawScope,
  drawFrame,
  drawMeter,
  drawLabel,
  drawLegend,
  useCanvas,
  clamp,
} from '../lib/skyKit';

// Chapter 1.1 — where the bottleneck actually is.
// Linked views: left = the old way (a telescope dragged cell by cell over the whole sky),
// right = two time bars plus hit counts sharing one wall clock.

const W = 1080;
const H = 280;

const COLS = 8;
const ROWS = 3;
const GX = 40;
const GY = 34;
const GW = 500;
const GH = 180;

const T_OLD = 1830;
const T_NEW = 198;
const CAP = 2000;
const HIT_OLD = 14;
const HIT_NEW = 20;
const BAR_X = 650;
const BAR_W = 340;

const EMPTY_CELLS = [3, 9, 14, 22];

type StarSpot = { c: number; r: number; hit: boolean };

const STARS: StarSpot[] = [];
for (let i = 0; i < COLS * ROWS; i += 1) {
  if (EMPTY_CELLS.indexOf(i) >= 0) continue;
  STARS.push({ c: i % COLS, r: Math.floor(i / COLS), hit: STARS.length % 10 < 7 });
}

const cellX = (st: StarSpot): number => GX + (st.c + 0.5) * (GW / COLS);
const cellY = (st: StarSpot): number => GY + (st.r + 0.5) * (GH / ROWS);

type ModState = { run: number; t0: number | null; instant: boolean };

const FEEDBACK_IDLE = '按下开始，比较两种夜巡方式。';
const FEEDBACK_OLD = '逐格搬望远镜：每张图约 1830 毫秒，光候选框就 1510 毫秒。';
const FEEDBACK_NEW = '共享特征：整张图只要 198 毫秒，候选框只占 10 毫秒。';
const FEEDBACK_CAVEAT = '论文自己提醒：SS/EB 是 CPU 实现，跟 GPU 检测器比速度并不公平。';

export const Ch1Mod1: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stateRef = useRef<ModState>({ run: 0, t0: null, instant: reduced });
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setTimeout(() => setPhase('done'), reduced ? 150 : 1900);
    return () => window.clearTimeout(id);
  }, [phase, nonce, reduced]);

  const start = (): void => {
    stateRef.current.run = 1;
    stateRef.current.t0 = null;
    stateRef.current.instant = reduced;
    setPhase('running');
    setNonce((n) => n + 1);
  };

  const { ref } = useCanvas<ModState>(
    (ctx, time, s) => {
      clearScene(ctx, W, H);

      let elapsed = 0;
      if (s.run) {
        if (s.t0 === null) s.t0 = time;
        elapsed = s.instant ? 8000 : Math.max(0, time - s.t0);
      }
      const progOld = clamp(elapsed / T_OLD, 0, 1);
      const progNew = clamp(elapsed / T_NEW, 0, 1);
      const scan = progOld * STARS.length;
      const cursor = STARS[Math.min(STARS.length - 1, Math.floor(scan))];

      // --- left view: the sky the telescope has to walk over ---
      drawGrid(ctx, GX, GY, GW, GH, COLS, ROWS, {
        highlight: { r: cursor.r, c: cursor.c },
        windowRadius: 0,
      });

      STARS.forEach((st, i) => {
        if (st.hit && i < scan) {
          drawFrame(ctx, cellX(st), cellY(st), 20, 20, {
            color: COLORS.bad,
            dashed: true,
            weight: 1.5,
          });
        }
      });

      if (progNew >= 1) {
        drawFrame(ctx, GX + GW / 2, GY + GH / 2, GW + 14, GH + 14, {
          color: COLORS.route,
          weight: 3,
        });
        STARS.forEach((st) => {
          drawFrame(ctx, cellX(st), cellY(st), 40, 40, {
            color: COLORS.good,
            weight: 1.5,
            alpha: 0.85,
          });
        });
      }

      STARS.forEach((st) => {
        drawStar(ctx, cellX(st), cellY(st), st.hit ? 4 : 3, {
          kind: st.hit ? 'point' : 'faint',
        });
      });

      drawScope(ctx, cellX(cursor), GY + GH + 16, 0.85, {
        pointing: true,
        accent: COLORS.bad,
      });

      // --- right view: shared wall clock, same scale for both bars ---
      drawMeter(ctx, BAR_X, 76, BAR_W, 22, (progOld * T_OLD) / CAP, {
        direction: 'down',
        label: '旧 1830ms',
      });
      drawMeter(ctx, BAR_X, 164, BAR_W, 22, (progNew * T_NEW) / CAP, {
        direction: 'down',
        label: '共享 198ms',
      });
      drawLabel(ctx, `${Math.round(progOld * HIT_OLD)}/20`, 1000, 92, {
        color: COLORS.bad,
        size: 13,
      });
      drawLabel(ctx, `${Math.round(progNew * HIT_NEW)}/20`, 1000, 180, {
        color: COLORS.good,
        size: 13,
      });

      drawLegend(ctx, BAR_X, 246, [
        { color: COLORS.bad, text: '旧做法' },
        { color: COLORS.good, text: '共享特征' },
        { color: COLORS.star, text: '命中星' },
      ]);
    },
    W,
    H,
    stateRef
  );

  return (
    <div data-widget={`${chapterId}-${moduleId}`}>
      <canvas ref={ref} width={W} height={H} />
      <div className="ctrl">
        <button type="button" className="chip" onClick={start} disabled={phase === 'running'}>
          {phase === 'idle' ? '开始对比' : phase === 'running' ? '对比中…' : '重跑'}
        </button>
      </div>
      {phase === 'idle' ? (
        <div className="feedback">{FEEDBACK_IDLE}</div>
      ) : (
        <>
          <div className="feedback bad">{FEEDBACK_OLD}</div>
          <div className="feedback good">{FEEDBACK_NEW}</div>
          <div className="feedback">{FEEDBACK_CAVEAT}</div>
        </>
      )}
    </div>
  );
};

export default Ch1Mod1;
