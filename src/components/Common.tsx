'use client';
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
  return (
    <header className="page-heading">
      <div>
        <span className="eyebrow">{god}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
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
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={21} />
      <span>{text}</span>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Logo />
      <h3>{title}</h3>
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
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function QualityCard({ result }: { result: MoveQuality }) {
  return (
    <div className="quality-card">
      <div className="quality-number">
        {Math.round(result.quality)}
        <span>%</span>
      </div>
      <div>
        <strong>{result.label}</strong>
        <p>
          {result.san} · Bestzug {result.bestSan}
        </p>
      </div>
      <p className="quality-explanation">{result.explanation}</p>
      <div className="quality-meta">
        <span>
          {scoreText(result.before)} → {scoreText(result.played)}
        </span>
        <span>
          Tiefe {result.depth} · {result.method}
        </span>
        {result.confidence === 'gering' && <span>Geringe Sicherheit</span>}
      </div>
      <details>
        <summary>Was bedeutet der Prozentwert?</summary>
        <p>
          OLYMPION vergleicht den erwarteten Punktanteil des Bestzugs mit deinem Zug: 100 × (1 −
          Punktverlust).{' '}
          {result.method === 'Näherung'
            ? 'Diese Suche verwendet eine monotone Näherung aus Bauerneinheiten.'
            : 'Grundlage sind Stockfish-WDL-Schätzungen.'}{' '}
          Der Wert beschreibt diese Suche. Er ist keine Gewinnwahrscheinlichkeit und keine
          offizielle Spielstärkewertung.
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
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
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
  return (
    <p className="inline-error" role="alert">
      {children}
    </p>
  );
}
