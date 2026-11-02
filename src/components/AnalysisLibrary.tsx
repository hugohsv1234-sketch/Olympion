'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, CheckCircle2, Clock3, Star } from 'lucide-react';
import type { AnalysisRecord } from '@/lib/types';
import { useStore } from './Provider';
export default function AnalysisLibrary({
  onOpen,
  busy,
}: {
  onOpen: (analysis: AnalysisRecord) => void;
  busy: boolean;
}) {
  const { records, put, setError } = useStore();
  const [favorites, setFavorites] = useState(false);
  const [limit, setLimit] = useState(6);
  const analyses = useMemo(
    () =>
      records
        .filter((r) => r.kind === 'analysis')
        .map((r) => ({ ...r, analysis: r.value as AnalysisRecord }))
        .filter((r) => !favorites || r.analysis.favorite)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [records, favorites],
  );
  if (!records.some((r) => r.kind === 'analysis')) return null;
  return (
    <section className="analysis-library">
      <div className="section-title">
        <div>
          <span className="eyebrow">DEIN PERSÖNLICHES LEHRBUCH</span>
          <h2>Dein Analyse-Archiv.</h2>
        </div>
        <button
          className={'chip ' + (favorites ? 'selected' : '')}
          aria-pressed={favorites}
          onClick={() => {
            setFavorites((v) => !v);
            setLimit(6);
          }}
        >
          <Star size={14} /> Favoriten
        </button>
      </div>
      {analyses.length ? (
        <div className="library-grid">
          {analyses.slice(0, limit).map((item) => {
            const a = item.analysis;
            return (
              <article className="library-card" key={item.id}>
                <div className="library-card-top">
                  <span>{a.source ? 'CHESS.COM' : 'OLYMPION ANALYSE'}</span>
                  <button
                    className={'icon-button ' + (a.favorite ? 'is-favorite' : '')}
                    aria-label={a.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                    aria-pressed={Boolean(a.favorite)}
                    disabled={busy}
                    onClick={() =>
                      void put(item.id, 'analysis', {
                        ...a,
                        favorite: !a.favorite,
                        updatedAt: Date.now(),
                      }).catch((e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'Favorit konnte nicht gespeichert werden.',
                        ),
                      )
                    }
                  >
                    <Star size={17} fill={a.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <h3>{a.title || 'Gespeicherte Partie'}</h3>
                <div className="library-detail">
                  <span>
                    <Clock3 size={13} /> {new Date(a.updatedAt).toLocaleDateString('de-DE')}
                  </span>
                  <span>
                    {a.complete ? <CheckCircle2 size={13} /> : <Bookmark size={13} />}
                    {a.complete
                      ? 'Vollständig'
                      : a.results.length + ' / ' + a.moves.length + ' Halbzüge'}
                  </span>
                </div>
                {a.note && <p className="library-note">{a.note}</p>}
                <button className="text-button" disabled={busy} onClick={() => onOpen(a)}>
                  {a.complete ? 'Analyse ansehen' : 'Analyse öffnen & fortsetzen'}{' '}
                  <ArrowRight size={15} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="archive-empty">
          <Star size={24} />
          <p>Markiere eine Analyse mit dem Stern, um sie hier wiederzufinden.</p>
        </div>
      )}
      {analyses.length > limit && (
        <button className="button secondary load-more" onClick={() => setLimit((n) => n + 6)}>
          Weitere Analysen
        </button>
      )}
    </section>
  );
}
