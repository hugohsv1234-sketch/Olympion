'use client';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useT } from '@/lib/i18n';
import { MOVE_GRADES, moveGrade } from '@/lib/review';
import type { MoveQuality } from '@/lib/types';

// Presentation adapted from the user's OLYMPION Figma export.
function Laurels() {
  const leaves = Array.from({ length: 9 });

  return (
    <div className="laurels" aria-hidden="true">
      {(['left', 'right'] as const).map((side) => (
        <div className={`laurel laurel--${side}`} key={side}>
          <span className="laurel-stem" />
          {leaves.map((_, index) => (
            <span
              className={`laurel-leaf laurel-leaf--${index % 2 ? 'outer' : 'inner'}`}
              style={{ '--leaf': index } as React.CSSProperties}
              key={index}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LightEffects() {
  return (
    <div className="effects" aria-hidden="true">
      <span className="arrival-ring arrival-ring--one" />
      <span className="arrival-ring arrival-ring--two" />
      <span className="flight-trail" />
      <span className="orbit orbit--one" />
      <span className="orbit orbit--two" />
      <span className="spark spark--one" />
      <span className="spark spark--two" />
      <span className="spark spark--three" />
      <span className="spark spark--four" />
      <span className="spark spark--five" />
      <span className="spark spark--six" />
    </div>
  );
}

function TargetElectricity({ symbol }: { symbol: string }) {
  return (
    <div className="target-electricity" aria-hidden="true" data-layer="Zielfeld-Energie">
      <svg viewBox="0 0 120 80">
        <g className="target-arc target-arc--left">
          <path className="lightning-edge" d="M8 48 L25 34 L37 41 L52 23 L61 37" />
          <path className="lightning-core" d="M8 48 L25 34 L37 41 L52 23 L61 37" />
        </g>
        <g className="target-arc target-arc--right">
          <path className="lightning-edge" d="M112 48 L95 34 L83 41 L68 23 L59 37" />
          <path className="lightning-core" d="M112 48 L95 34 L83 41 L68 23 L59 37" />
        </g>
      </svg>
      <span className="target-residue">{symbol}</span>
    </div>
  );
}

function LightningEffects() {
  const leftBolt = 'M18 22 L74 58 L59 76 L123 105 L104 125 L178 163 L203 205';
  const rightBolt = 'M412 22 L356 58 L371 76 L307 105 L326 125 L252 163 L227 205';
  const sideBolt = 'M430 170 L372 159 L350 178 L310 166 L286 195 L252 198';

  return (
    <div className="lightning-stage" aria-hidden="true">
      <svg viewBox="0 0 430 430" role="presentation">
        <g className="thunderbolt-silhouette" data-layer="Donnerkeil-Silhouette">
          <path d="M197 48 L250 48 L229 133 L278 133 L188 270 L207 173 L162 173 Z" />
          <path className="meander-detail" d="M128 110 H165 V89 H185 M302 110 H265 V89 H245" />
          <path className="meander-detail" d="M140 272 H172 V294 H198 M290 272 H258 V294 H232" />
        </g>

        <g className="main-bolt main-bolt--left" data-layer="Hauptblitz links">
          <path className="lightning-edge" d={leftBolt} />
          <path className="lightning-core" d={leftBolt} />
        </g>
        <g className="main-bolt main-bolt--right" data-layer="Hauptblitz rechts">
          <path className="lightning-edge" d={rightBolt} />
          <path className="lightning-core" d={rightBolt} />
        </g>
        <g className="main-bolt main-bolt--side" data-layer="Seitlicher Hauptblitz">
          <path className="lightning-edge" d={sideBolt} />
          <path className="lightning-core" d={sideBolt} />
        </g>

        <g className="bolt-branches" data-layer="Blitz-Verästelungen">
          <path className="lightning-edge branch branch--one" d="M123 105 L91 119 L76 145" />
          <path className="lightning-core branch branch--one" d="M123 105 L91 119 L76 145" />
          <path className="lightning-edge branch branch--two" d="M307 105 L339 119 L354 145" />
          <path className="lightning-core branch branch--two" d="M307 105 L339 119 L354 145" />
          <path className="lightning-edge branch branch--three" d="M350 178 L370 202 L397 207" />
          <path className="lightning-core branch branch--three" d="M350 178 L370 202 L397 207" />
        </g>

        <g className="ring-electricity" data-layer="Elektrischer Ringbogen">
          <circle className="lightning-edge" cx="215" cy="185" r="95" />
          <circle className="lightning-core" cx="215" cy="185" r="95" />
        </g>

        <g className="symbol-electricity" data-layer="Symbol-Impuls">
          <path className="lightning-edge" d="M195 175 L211 163 L221 178 L238 165" />
          <path className="lightning-core" d="M195 175 L211 163 L221 178 L238 165" />
        </g>
      </svg>
      <span className="impact-flare" data-layer="Auftreff-Reflex" />
      <span className="metal-reflection" data-layer="Metall-Reflex" />
      <span className="laurel-reflection laurel-reflection--left" />
      <span className="laurel-reflection laurel-reflection--right" />
      <span className="electric-flight-trail" data-layer="Elektrische Flugspur" />
    </div>
  );
}

function Medallion({ award }: { award: { symbol: string } }) {
  return (
    <div className="medallion-flight">
      <div className="medallion">
        <div className="medallion-rim">
          <div className="medallion-stone">
            <span className="medallion-shine" />
            <span className="medallion-symbol">{award.symbol}</span>
            <span className="medallion-greek">◆ · ◆ · ◆</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MoveCelebration({
  result,
  motion,
  boardRef,
  orientation,
}: {
  result: MoveQuality;
  motion: boolean;
  boardRef: RefObject<HTMLDivElement | null>;
  orientation: 'w' | 'b';
}) {
  const tr = useT();
  const scene = useRef<HTMLDivElement>(null);
  const [finished, setFinished] = useState(false);
  const grade = moveGrade(result);
  const special = grade === 'brilliant' || grade === 'great';
  useEffect(() => {
    if (!special) return;
    const timer = setTimeout(() => setFinished(true), grade === 'brilliant' ? 3600 : 2800);
    return () => clearTimeout(timer);
  }, [grade, special]);
  useEffect(() => {
    if (!special || finished) return;
    const position = () => {
      const element = scene.current;
      const board = boardRef.current;
      if (!element || !board) return;
      const bounds = board.getBoundingClientRect();
      const viewport = element.getBoundingClientRect();
      const square = result.move.slice(2, 4);
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]) - 1;
      const squareX =
        bounds.left +
        (((orientation === 'w' ? file : 7 - file) + 0.5) * bounds.width) / 8 -
        viewport.left;
      const squareY =
        bounds.top +
        (((orientation === 'w' ? 7 - rank : rank) + 0.5) * bounds.height) / 8 -
        viewport.top;
      const x = Math.max(24, Math.min(viewport.width - 24, squareX));
      const y = Math.max(24, Math.min(viewport.height - 24, squareY));
      const scale = Math.min(1, (viewport.width - 12) / 430, (viewport.height - 12) / 430);
      const dx = (x - viewport.width / 2) / scale;
      const dy = (y - viewport.height / 2) / scale + 30;
      element.style.setProperty('--trail-angle', `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`);
      element.style.setProperty('--trail-width', `${Math.hypot(dx, dy)}px`);
      element.style.setProperty('--award-scale', String(scale));
      element.style.setProperty('--target-x', `${x}px`);
      element.style.setProperty('--target-y', `${y}px`);
      element.style.setProperty('--flight-x', `${(x - viewport.width / 2) / scale}px`);
      element.style.setProperty('--flight-y', `${(y - viewport.height / 2) / scale + 30}px`);
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [boardRef, orientation, result.move, special, finished]);
  if (finished || !special) return null;
  const brilliant = grade === 'brilliant';
  const award = { symbol: MOVE_GRADES[grade].symbol };
  return (
    <div
      ref={scene}
      className={`olympion-award award-animation award-animation--${grade}${motion ? '' : ' award-still'}`}
      style={
        {
          '--accent': brilliant ? '#20E0CD' : '#397BFF',
          '--accent-deep': brilliant ? '#075B63' : '#102C68',
        } as CSSProperties
      }
    >
      <div className="stage-dim" aria-hidden="true" />
      <div className="target-pulse" aria-hidden="true" />
      <TargetElectricity symbol={award.symbol} />
      <LightEffects />
      <LightningEffects />
      <div className="award-lockup">
        <Laurels />
        <div aria-hidden="true">
          <Medallion award={award} />
        </div>
        <div className="award-copy" role="status" aria-live="polite" aria-atomic="true">
          <span className="award-eyebrow">OLYMPION</span>
          <h2>{tr(MOVE_GRADES[grade].label)}</h2>
          <span className="award-rule" aria-hidden="true" />
          <p>
            {result.san} · {tr(brilliant ? 'Ein Opfer. Eine Idee.' : 'Der eine entscheidende Zug.')}
          </p>
        </div>
      </div>
    </div>
  );
}
