'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/i18n';
import { MOVE_GRADES, moveGrade } from '@/lib/review';
import type { MoveQuality } from '@/lib/types';

export default function MoveCelebration({
  result,
  motion,
}: {
  result: MoveQuality;
  motion: boolean;
}) {
  const tr = useT();
  const [finished, setFinished] = useState(false);
  const grade = moveGrade(result);
  useEffect(() => {
    const timer = setTimeout(() => setFinished(true), grade === 'brilliant' ? 3400 : 2800);
    return () => clearTimeout(timer);
  }, [grade]);
  if (finished || !['brilliant', 'great'].includes(grade)) return null;
  const brilliant = grade === 'brilliant';
  return (
    <div
      className={`move-celebration ${grade} ${motion ? '' : 'still'}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setFinished(true);
      }}
    >
      <div className="celebration-halo" aria-hidden="true" />
      <div className="celebration-orbit" aria-hidden="true" />
      <div className="celebration-particles" aria-hidden="true">
        {Array.from({ length: brilliant ? 28 : 18 }, (_, i) => (
          <i
            key={i}
            style={
              {
                '--angle': `${i * 137.5}deg`,
                '--distance': `${100 + (i % 5) * 24}px`,
                '--delay': `${(i % 7) * 35}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="celebration-medallion" aria-hidden="true">
        <svg viewBox="0 0 200 200" className="celebration-laurel">
          {[0, 1].map((side) => (
            <g key={side} transform={side ? 'translate(200 0) scale(-1 1)' : undefined}>
              <path
                d="M90 176C33 148 23 79 66 30"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              {Array.from({ length: 7 }, (_, i) => (
                <ellipse
                  key={i}
                  cx={42 + Math.abs(i - 3) * 3}
                  cy={48 + i * 17}
                  rx="5"
                  ry="13"
                  transform={`rotate(${-40 + i * 10} ${42 + Math.abs(i - 3) * 3} ${48 + i * 17})`}
                  fill="currentColor"
                />
              ))}
            </g>
          ))}
        </svg>
        <span>{MOVE_GRADES[grade].symbol}</span>
        <div className="celebration-shine" />
      </div>
      <div className="celebration-title" role="status">
        <small>OLYMPION</small>
        <strong>{tr(MOVE_GRADES[grade].label)}</strong>
        <span>
          {result.san} <i />{' '}
          {tr(brilliant ? 'Ein Opfer. Eine Idee.' : 'Der eine entscheidende Zug.')}
        </span>
      </div>
    </div>
  );
}
