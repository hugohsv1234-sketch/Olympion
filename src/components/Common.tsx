'use client';
import { useT } from '@/lib/i18n';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import type { MoveQuality } from '@/lib/types';
import { scoreText } from '@/lib/metrics';
export function Logo() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M4 12 20 4l16 8M7 14h26M5 34h30M9 30h22M10 18v10M30 18v10M16 28v-8l5-6 6 6-4 2v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m19 18 3 1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
export function Portrait({ level, size = 'normal' }: { level: number; size?: string }) {
  return (
    <img
      className={'portrait ' + size}
      src={`/images/god-${level}.webp`}
      alt=""
      loading="lazy"
      width="160"
      height="160"
    />
  );
}
export function Heading({
  god,
  title,
  description,
  children,
}: {
  god: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const tr = useT();
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{tr(god)}</span>
        <h1>{tr(title)}</h1>
        {description && <p>{tr(description)}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </header>
  );
}
export function ActionLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={'button ' + (secondary ? 'secondary' : 'primary')} href={href}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function Loading({ text = 'Wird geladen …' }: { text?: string }) {
  const tr = useT();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={21} />
      <span>{tr(text)}</span>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  const tr = useT();
  return (
    <div className="empty">
      <Logo />
      <h3>{tr(title)}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button,input,select,textarea,a')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const xs = ref.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input,select,textarea,a[href]',
      );
      if (!xs?.length) return;
      const first = xs[0],
        last = xs[xs.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-top">
          <h2>{tr(title)}</h2>
          <button className="icon-button" onClick={onClose} aria-label={tr('Schlie\u00DFen')}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function QualityCard({ result }: { result: MoveQuality }) {
  const tr = useT();
  return (
    <div className="quality-card">
      <div className="quality-number">
        {Math.round(result.quality)}
        <span>%</span>
      </div>
      <div>
        <strong>{tr(result.label)}</strong>
        <p>
          {result.san}
          {tr(' \u00B7 Bestzug ')}
          {result.bestSan}
        </p>
      </div>
      <p className="quality-explanation">{tr(result.explanation)}</p>
      <div className="quality-meta">
        <span>
          {scoreText(result.before)} → {scoreText(result.played)}
        </span>
        <span>
          {tr('Tiefe ')}
          {result.depth} · {tr(result.method)}
        </span>
        {result.confidence === 'gering' && <span>{tr('Geringe Sicherheit')}</span>}
      </div>
      <details>
        <summary>{tr('Was bedeutet der Prozentwert?')}</summary>
        <p>
          {tr(
            'OLYMPION vergleicht den erwarteten Punktanteil des Bestzugs mit deinem Zug: 100 \u00D7 (1 \u2212 Punktverlust).',
          )}{' '}
          {result.method === 'Näherung'
            ? tr('Diese Suche verwendet eine monotone N\u00E4herung aus Bauerneinheiten.')
            : tr('Grundlage sind Stockfish-WDL-Sch\u00E4tzungen.')}{' '}
          {tr(
            'Der Wert beschreibt diese Suche. Er ist keine Gewinnwahrscheinlichkeit und keine offizielle Spielst\u00E4rkewertung.',
          )}
        </p>
      </details>
    </div>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const tr = useT();
  return (
    <label className="toggle-row">
      <span>
        <strong>{tr(label)}</strong>
        {description && <small>{tr(description)}</small>}
      </span>
      <input
        className="toggle"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function ErrorText({ children }: { children: ReactNode }) {
  const tr = useT();
  return (
    <p className="inline-error" role="alert">
      {typeof children === 'string' ? tr(children) : children}
    </p>
  );
}
