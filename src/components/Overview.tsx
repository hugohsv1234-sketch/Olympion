'use client';
import { useT, useLocale } from '@/lib/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeUsername } from '@/lib/chesscom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Crown,
  Flame,
  GraduationCap,
  Puzzle,
  Swords,
  Target,
  Trophy,
  Clock3,
  Globe2,
  Columns3,
} from 'lucide-react';
import { useStore } from './Provider';
import { ActionLink, Empty, Heading, Portrait } from './Common';
import { attemptsFrom, duePuzzles, localDay, ratingHistory, streak, THEMES } from '@/lib/puzzles';
import type { AnalysisRecord, GameRecord, LessonResult, Mistake } from '@/lib/types';
export function useStats() {
  const { records } = useStore();
  const attempts = attemptsFrom(records),
    history = ratingHistory(attempts),
    games = records.filter((r) => r.kind === 'game').map((r) => r.value as GameRecord),
    lessons = records.filter((r) => r.kind === 'lesson').map((r) => r.value as LessonResult);
  const sessions = records
    .filter((r) => r.kind === 'session')
    .map(
      (r) =>
        r.value as {
          at: number;
          seconds: number;
        },
    );
  const seconds = sessions.reduce((s, r) => s + r.seconds, 0),
    today = sessions
      .filter((s) => localDay(s.at) === localDay())
      .reduce((sum, s) => sum + s.seconds, 0);
  const themes = Object.entries(THEMES)
    .map(([key, name]) => {
      const a = attempts.filter((a) => a.themes.includes(key));
      return {
        key,
        name,
        n: a.length,
        rate: a.length
          ? a.filter((a) => a.success && a.hints === 0 && a.errors === 0).length / a.length
          : 0,
      };
    })
    .filter((x) => x.n >= 5)
    .sort((a, b) => a.rate - b.rate);
  return {
    attempts,
    history,
    rating: history.at(-1)?.rating || 1200,
    games,
    lessons,
    seconds,
    today,
    themes,
    due: duePuzzles(attempts),
    streak: streak(attempts),
    solved: new Set(attempts.filter((a) => a.success).map((a) => a.puzzleId)).size,
  };
}
export function Home() {
  const locale = useLocale();
  const tr = useT();
  const { settings, records, ready } = useStore();
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const s = useStats();
  const today = localDay();
  const analyses = records
    .filter((r) => r.kind === 'analysis')
    .map((r) => r.value as AnalysisRecord);
  const solvedToday = new Set(
    s.attempts.filter((a) => a.success && localDay(a.at) === today).map((a) => a.puzzleId),
  ).size;
  const reviewedToday = analyses.some(
    (a) => a.complete && a.completedAt && localDay(a.completedAt) === today,
  );
  const learnedToday = s.lessons.some((l) => l.completed && localDay(l.at) === today);
  const missions = [
    {
      title: 'Schärfe deinen Blick',
      text: 'Drei Taktikaufgaben. Drei neue Ideen.',
      href: '/puzzles?mode=series',
      progress: Math.min(3, solvedToday) + ' / 3',
      done: solvedToday >= 3,
      icon: Puzzle,
    },
    {
      title: 'Verstehe deine Partie',
      text: 'Analysiere eine Partie mit Stockfish.',
      href: '/analyse',
      progress: reviewedToday ? 'Erledigt' : '0 / 1',
      done: reviewedToday,
      icon: Target,
    },
    {
      title: 'Lerne ein Prinzip',
      text: 'Schließe eine Lektion in der Akademie ab.',
      href: '/akademie',
      progress: learnedToday ? 'Erledigt' : '0 / 1',
      done: learnedToday,
      icon: GraduationCap,
    },
  ];
  const days = ready
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 6 + i);
        const day = localDay(date.getTime());
        const active =
          s.attempts.some((a) => localDay(a.at) === day) ||
          s.lessons.some((l) => l.completed && localDay(l.at) === day) ||
          records.some(
            (r) =>
              r.kind === 'session' &&
              (
                r.value as {
                  seconds: number;
                }
              ).seconds > 0 &&
              localDay(
                (
                  r.value as {
                    at: number;
                  }
                ).at,
              ) === day,
          );
        return {
          key: day,
          label: date.toLocaleDateString(locale, { weekday: 'narrow' }),
          day: date.getDate(),
          active,
        };
      })
    : [];
  const progress = Math.min(100, Math.round((s.today / (settings.goal * 60)) * 100));
  return (
    <>
      <div className="olymp-welcome">
        <div>
          <span className="live-indicator" />
          {tr(' DEIN PLATZ AUF DEM OLYMP')}
        </div>
        <span>
          {settings.name === 'Gast'
            ? tr('Deine n\u00E4chste gute Entscheidung beginnt hier.')
            : 'Willkommen zurück, ' + settings.name + '.'}
        </span>
      </div>
      <section className="olymp-hero">
        <img
          src="/images/athena.webp"
          alt={tr('Athene aus Marmor vor einem antiken griechischen Tempel')}
          width={1672}
          height={941}
          fetchPriority="high"
        />
        <div className="olymp-hero-shade" />
        <div className="olymp-hero-content">
          <div className="hero-seal">
            <Columns3 size={16} />
            <span>{tr('GEFORMT DURCH STRATEGIE')}</span>
          </div>
          <h1>
            {tr('Dein Zug.')}
            <br />
            <em>{tr('Dein Olymp.')}</em>
          </h1>
          <p>
            {tr('Sieh mehr als den n\u00E4chsten Zug.')}
            <br />
            {tr('Trainiere mit Athene. Spiele gegen die G\u00F6tter.')}
            <br className="desktop-only" />
            {tr(' Lerne aus deinen eigenen Partien.')}
          </p>
          <div className="hero-actions">
            <ActionLink href="/training">{tr('Jetzt besser werden')}</ActionLink>
            <Link className="hero-secondary" href="/arena">
              {tr('Betritt die Arena ')}
              <Swords size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-god-label">
          <span>{tr('01 / ATHENE')}</span>
          <strong>
            {tr('Weisheit ist')}
            <br />
            {tr('dein st\u00E4rkster Zug.')}
          </strong>
          <span className="god-rule" />
        </div>
        <div className="hero-coordinate" aria-hidden="true">
          {tr('\u0391\u0398\u0397\u039D\u0391 \u00B7 STRATEGIE & WEISHEIT')}
        </div>
      </section>
      <div className="home-stats-grid">
        {[
          {
            label: 'Dein Puzzle-Rating',
            value: s.rating,
            note: s.history.length ? 'Deine Trainingswertung' : 'Startwert · dein Weg beginnt',
            icon: Trophy,
          },
          {
            label: 'Gelöste Aufgaben',
            value: s.solved,
            note: 'Aus deinen echten Ergebnissen',
            icon: Puzzle,
          },
          {
            label: 'Deine Trainingsserie',
            value: s.streak,
            note: s.streak === 1 ? 'Tag in Folge' : 'Tage in Folge',
            icon: Flame,
          },
          {
            label: 'Heute trainiert',
            value: Math.floor(s.today / 60) + ' Min.',
            note: 'Dein Tagesziel: ' + settings.goal + ' Minuten',
            icon: Clock3,
          },
        ].map((stat) => (
          <Link href="/fortschritt" className="home-stat" key={stat.label}>
            <div>
              <span>{tr(stat.label)}</span>
              <stat.icon size={17} />
            </div>
            <strong>{stat.value}</strong>
            <small>{tr(stat.note)}</small>
          </Link>
        ))}
      </div>
      <section className="chesscom-launch">
        <div className="launch-symbol">
          <Globe2 size={27} />
        </div>
        <div className="launch-copy">
          <span className="eyebrow">{tr('NEU \u00B7 DEINE PARTIEN IM FOKUS')}</span>
          <h2>{tr('Dein Chess.com-Name gen\u00FCgt.')}</h2>
          <p>{tr('Entdecke deine Wendepunkte. Entwickle deinen eigenen Spielstil.')}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setError('');
              router.push('/analyse?chesscom=' + encodeURIComponent(normalizeUsername(name)));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label className="sr-only" htmlFor="home-chesscom">
            {tr('Dein Chess.com-Name')}
          </label>
          <div className="launch-field">
            <input
              id="home-chesscom"
              value={name}
              maxLength={50}
              autoCapitalize="none"
              spellCheck={false}
              placeholder={tr('Dein Chess.com-Name')}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              aria-label={tr('Chess.com-Partien laden')}
              disabled={!name.trim()}
            >
              <ArrowRight size={21} />
            </button>
          </div>
          <small>{tr('Ohne Passwort. Echte Stockfish-Analyse.')}</small>
          {error && (
            <span className="inline-error" role="alert">
              {tr(error)}
            </span>
          )}
        </form>
      </section>
      <div className="home-daily-grid">
        <section className="mission-board">
          <div className="section-title">
            <div>
              <span className="eyebrow">{tr('KLEINE SCHRITTE. GROSSE WIRKUNG.')}</span>
              <h2>{tr('Deine Missionen f\u00FCr heute.')}</h2>
            </div>
            <span className="mission-count">{missions.filter((m) => m.done).length} / 3</span>
          </div>
          <div className="mission-list">
            {missions.map((mission, i) => (
              <Link
                href={mission.href}
                className={'mission-row ' + (mission.done ? 'done' : '')}
                key={mission.title}
              >
                <span className="mission-icon">
                  {mission.done ? <Check size={21} /> : <mission.icon size={21} />}
                </span>
                <div>
                  <small>
                    {tr('MISSION 0')}
                    {i + 1}
                  </small>
                  <h3>{tr(mission.title)}</h3>
                  <p>{tr(mission.text)}</p>
                </div>
                <span className="mission-state">
                  {tr(mission.progress)}
                  <ArrowUpRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="weekly-board">
          <span className="eyebrow">{tr('DEIN RHYTHMUS')}</span>
          <h2>{tr('Jeder Tag ein Schritt.')}</h2>
          <div
            className="goal-orbit"
            style={{ background: 'conic-gradient(#e7e9e9 ' + progress + '%, #24292d 0)' }}
            role="img"
            aria-label={progress + ' Prozent deines Tagesziels erreicht'}
          >
            <div>
              <strong>
                {Math.floor(s.today / 60)}
                <small>{tr('MIN.')}</small>
              </strong>
              <span>
                {tr('von ')}
                {settings.goal}
                {tr(' heute')}
              </span>
            </div>
          </div>
          <div className="week-days" aria-label={tr('Deine letzten sieben Trainingstage')}>
            {days.map((day) => (
              <div
                className={'week-day ' + (day.active ? 'active' : '')}
                key={day.key}
                title={day.key + (day.active ? ' · trainiert' : ' · kein Training')}
              >
                <span>{tr(day.label)}</span>
                <strong>{day.active ? <Check size={15} /> : day.day}</strong>
              </div>
            ))}
          </div>
          <p>
            {days.filter((d) => d.active).length}
            {tr(' aktive Tage in den letzten 7 Tagen.')}
          </p>
          <Link href="/training" className="text-button">
            {tr('Deinen Trainingsplan \u00F6ffnen ')}
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="section-title mode-heading">
        <div>
          <span className="eyebrow">{tr('W\u00C4HLE DEINE HERAUSFORDERUNG')}</span>
          <h2>{tr('Was ist dein n\u00E4chster Zug?')}</h2>
        </div>
        <span>{tr('Ein Olymp. Viele Wege nach oben.')}</span>
      </div>
      <div className="olymp-mode-grid">
        {[
          {
            name: 'Athenes Prüfung',
            label: 'TAKTIK & PUZZLES',
            number: 'I',
            text: 'Über 1.000 echte Stellungen. Trainiere deinen Blick für das Entscheidende.',
            href: '/puzzles',
            god: 19,
            button: 'Taktik trainieren',
            icon: Puzzle,
          },
          {
            name: 'Die Arena der Götter',
            label: '20 STOCKFISH-GEGNER',
            number: 'II',
            text: 'Von Hermes bis Zeus. Finde deinen Gegner und wachse an jedem Duell.',
            href: '/arena',
            god: 12,
            button: 'Gegner auswählen',
            icon: Swords,
          },
          {
            name: 'Apollons Einsichten',
            label: 'DEINE PERSÖNLICHE ANALYSE',
            number: 'III',
            text: 'Deine eigenen Partien werden zu deinem besten Lehrbuch. Verstehe jeden Zug.',
            href: '/analyse',
            god: 9,
            button: 'Partien analysieren',
            icon: Target,
          },
        ].map((mode) => (
          <article className="olymp-mode-card" key={mode.name}>
            <div className="mode-card-top">
              <mode.icon size={20} />
              <span>{mode.number}</span>
            </div>
            <div className="mode-statue">
              <img
                src={'/images/god-' + mode.god + '.webp'}
                alt=""
                width={250}
                height={300}
                loading="lazy"
              />
            </div>
            <div className="mode-card-content">
              <span className="eyebrow">{tr(mode.label)}</span>
              <h3>{tr(mode.name)}</h3>
              <p>{tr(mode.text)}</p>
              <Link href={mode.href}>
                {tr(mode.button)}
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <section className="olymp-manifesto">
        <Columns3 size={34} />
        <div>
          <span className="eyebrow">{tr('WISSEN WIRD SPIELST\u00C4RKE')}</span>
          <h2>{tr('Dein st\u00E4rkster Gegner war gestern du.')}</h2>
          <p>{tr('Heute gehst du einen Zug weiter.')}</p>
        </div>
        <ActionLink secondary href="/akademie">
          {tr('Die Akademie entdecken')}
        </ActionLink>
      </section>
    </>
  );
}
export function Training() {
  const tr = useT();
  const { settings, put, records } = useStore();
  const s = useStats();
  const weak = s.themes[0];
  const current = s.games.find((g) => !g.result);
  const ownMistakes = records.filter((r) => r.kind === 'mistake' && !(r.value as Mistake).done);
  return (
    <>
      <Heading
        god={tr('ATHENE \u00B7 DEIN PERS\u00D6NLICHER PLAN')}
        title={`Dein Training, ${settings.name}.`}
        description={tr('Kleine Schritte. Klare Aufgaben. Jeden Tag ein bisschen weiter.')}
      />
      <div className="training-intro">
        <div>
          <span className="eyebrow">{tr('DEIN TAGESZIEL')}</span>
          <div className="goal-number">
            {Math.floor(s.today / 60)}{' '}
            <span>
              / {settings.goal}
              {tr(' Minuten')}
            </span>
          </div>
          <div className="progress-track">
            <span style={{ width: Math.min(100, (s.today / (settings.goal * 60)) * 100) + '%' }} />
          </div>
          <p>{tr('Gez\u00E4hlt wird aktive Zeit in Training, Arena und Analyse.')}</p>
        </div>
        <div className="goal-controls">
          {([10, 20, 30] as const).map((goal) => (
            <button
              key={goal}
              aria-pressed={goal === settings.goal}
              className={goal === settings.goal ? 'chip selected' : 'chip'}
              onClick={() =>
                void put('settings', 'settings', { ...settings, goal }).catch(() => undefined)
              }
            >
              {goal}
              {tr(' Min.')}
            </button>
          ))}
        </div>
        <Portrait level={19} size="mentor" />
      </div>
      <div className="metric-grid">
        <Metric
          label={tr('Puzzle-Rating')}
          value={s.rating}
          note={s.history.length ? 'Interne Trainingswertung' : 'Startwert · noch unbewertet'}
        />
        <Metric
          label={tr('Gel\u00F6ste Aufgaben')}
          value={s.solved}
          note={`${s.attempts.length} gespeicherte Versuche`}
        />
        <Metric
          label={tr('Trainingsserie')}
          value={s.streak + (s.streak === 1 ? ' Tag' : ' Tage')}
          note="Ein Puzzleversuch zählt als Trainingstag"
        />
        <Metric label={tr('Wiederholungen')} value={s.due.length} note="Jetzt fällige Aufgaben" />
      </div>
      <div className="section-title">
        <div>
          <span className="eyebrow">{tr('DEIN PLAN F\u00DCR HEUTE')}</span>
          <h2>{tr('Trainiere mit einer Idee.')}</h2>
        </div>
        <span>
          {s.themes.length
            ? tr('Aus deinen Ergebnissen abgeleitet')
            : tr('Wir lernen deine St\u00E4rken erst kennen.')}
        </span>
      </div>
      <div className="training-list">
        {[
          {
            n: 'I',
            title: 'Den Blick schärfen',
            text: weak
              ? `Dein Fokus: ${weak.name}. Löse fünf passende Aufgaben.`
              : 'Löse fünf gemischte Aufgaben, damit wir dein Niveau besser einschätzen können.',
            time: Math.round(settings.goal * 0.4),
            href: weak ? '/puzzles?theme=' + weak.key : '/puzzles',
            icon: Puzzle,
          },
          {
            n: 'II',
            title:
              s.due.length || ownMistakes.length
                ? 'Fehler in Wissen verwandeln'
                : 'Ein Prinzip verstehen',
            text: ownMistakes.length
              ? `${ownMistakes.length} Fehlerstellungen aus deinen Analysen warten auf dich. Finde diesmal den besseren Zug.`
              : s.due.length
                ? `${s.due.length} Aufgaben stehen zur Wiederholung an. Erst verstehen, dann schneller werden.`
                : 'Lerne Entwicklung, Zentrum oder Königssicherheit in einer kurzen Brettübung.',
            time: Math.round(settings.goal * 0.3),
            href: ownMistakes.length
              ? '/puzzles?mistake=' + encodeURIComponent(ownMistakes[0].id)
              : s.due.length
                ? '/puzzles?mode=review'
                : '/akademie',
            icon: GraduationCap,
          },
          {
            n: 'III',
            title: current ? 'Deine Partie fortsetzen' : 'Das Gelernte anwenden',
            text: current
              ? 'Dein gespeicherter Zwischenstand wartet in der Arena.'
              : 'Spiele eine ruhige Partie und analysiere anschließend deine Entscheidungen.',
            time: Math.round(settings.goal * 0.3),
            href: '/arena',
            icon: Swords,
          },
        ].map((t) => (
          <Link className="training-row" key={t.n} href={t.href}>
            <span className="roman">{t.n}</span>
            <div className="row-icon">
              <t.icon size={22} />
            </div>
            <div>
              <h3>{tr(t.title)}</h3>
              <p>{tr(t.text)}</p>
            </div>
            <span className="duration">
              ~ {t.time}
              {tr(' Min.')}
            </span>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
      <div className="mentor-note">
        <Portrait level={19} />
        <div>
          <span className="eyebrow">{tr('ATHENES HINWEIS')}</span>
          <p>
            {s.themes.length
              ? `Bei „${weak.name}“ hast du bisher ${Math.round(weak.rate * 100)} % ohne Hilfe gelöst (${weak.n} Versuche). Nimm dir Zeit für gegnerische Antworten.`
              : tr(
                  'Pr\u00FCfe vor jedem Zug: Was droht mein Gegner? Mit weniger als f\u00FCnf Versuchen pro Motiv treffen wir noch keine verl\u00E4ssliche Einsch\u00E4tzung.',
                )}
          </p>
        </div>
      </div>
    </>
  );
}
function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  const tr = useT();
  return (
    <div className="metric">
      <span>{tr(label)}</span>
      <strong>{value}</strong>
      <small>{tr(note)}</small>
    </div>
  );
}
export function RatingChart({
  history,
}: {
  history: {
    at: number;
    rating: number;
  }[];
}) {
  const locale = useLocale();
  const tr = useT();
  if (history.length < 2)
    return (
      <Empty title={tr('Deine Entwicklung braucht die ersten Schritte.')}>
        {tr('Nach zwei bewerteten Erstversuchen entsteht hier dein Ratingverlauf.')}
      </Empty>
    );
  const lo = Math.min(...history.map((h) => h.rating)) - 20,
    hi = Math.max(...history.map((h) => h.rating)) + 20;
  const path = history
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${20 + (i / (history.length - 1)) * 640} ${150 - ((p.rating - lo) / (hi - lo)) * 120}`,
    )
    .join(' ');
  return (
    <div className="rating-chart">
      <svg
        viewBox="0 0 680 180"
        role="img"
        aria-label={`Puzzle-Rating von ${history[0].rating} auf ${history.at(-1)!.rating}`}
      >
        <path d="M20 30h640M20 90h640M20 150h640" stroke="#303033" strokeDasharray="3 5" />
        <path d={path} stroke="#e7e7e4" strokeWidth="2" fill="none" />
        {history.map((p, i) => (
          <circle
            key={i}
            cx={20 + (i / (history.length - 1)) * 640}
            cy={150 - ((p.rating - lo) / (hi - lo)) * 120}
            r="2.5"
            fill="white"
          >
            <title>
              {new Date(p.at).toLocaleDateString(locale)} · {p.rating}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels">
        <span>{new Date(history[0].at).toLocaleDateString(locale)}</span>
        <span>{new Date(history.at(-1)!.at).toLocaleDateString(locale)}</span>
      </div>
    </div>
  );
}
export function Progress() {
  const locale = useLocale();
  const tr = useT();
  const s = useStats();
  const { records } = useStore();
  const completed = s.games.filter((g) => g.result && g.result !== '*');
  const analyses = records
    .filter((r) => r.kind === 'analysis')
    .map((r) => r.value as AnalysisRecord);
  const badges = [
    { title: 'Der erste Schritt', text: 'Eine Aufgabe gelöst', done: s.solved >= 1, icon: Compass },
    { title: 'Wacher Blick', text: '25 Aufgaben gelöst', done: s.solved >= 25, icon: Target },
    { title: 'Athenes Schüler', text: '100 Aufgaben gelöst', done: s.solved >= 100, icon: Crown },
    {
      title: 'In der Arena',
      text: '10 Partien beendet',
      done: completed.length >= 10,
      icon: Swords,
    },
    { title: 'Beständigkeit', text: '7 Tage in Folge trainiert', done: s.streak >= 7, icon: Flame },
    {
      title: 'Wissen wird Können',
      text: '5 Lektionen abgeschlossen',
      done: s.lessons.filter((l) => l.completed).length >= 5,
      icon: Trophy,
    },
  ];
  return (
    <>
      <Heading
        god={tr('ZEUS \u00B7 DEIN AUFSTIEG')}
        title={tr('Fortschritt, der dir geh\u00F6rt.')}
        description={tr('Deine echten Ergebnisse. Deine n\u00E4chsten M\u00F6glichkeiten.')}
      />
      <div className="metric-grid">
        <Metric label={tr('Puzzle-Rating')} value={s.rating} note="Interner Startwert: 1.200" />
        <Metric
          label={tr('Gel\u00F6ste Aufgaben')}
          value={s.solved}
          note="Unterschiedliche Aufgaben"
        />
        <Metric
          label={tr('Aktive Trainingszeit')}
          value={Math.floor(s.seconds / 60) + ' Min.'}
          note="Auf diesem Profil erfasst"
        />
        <Metric
          label={tr('Beendete Partien')}
          value={completed.length}
          note={`${completed.filter((g) => g.assists > 0).length} mit Trainingshilfen`}
        />
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>{tr('Dein Ratingverlauf')}</h2>
          <span className="tag">{tr('PUZZLETRAINING')}</span>
        </div>
        <RatingChart history={s.history} />
        <details>
          <summary>{tr('Wie wird mein Rating berechnet?')}</summary>
          <p>
            {tr(
              'Startwert 1.200. Elo-\u00E4hnliche Aktualisierung mit K = 24 und dem Lichess-Aufgabenrating als Gegenspieler. Nur der erste Versuch einer unbekannten Aufgabe z\u00E4hlt. Hilfen, Fehler oder Abbruch z\u00E4hlen dabei als nicht selbstst\u00E4ndig gel\u00F6st. Wiederholungen bringen keine weiteren Ratingpunkte. Keine FIDE- oder Plattformwertung.',
            )}
          </p>
        </details>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>{tr('St\u00E4rken & Lernfelder')}</h2>
          {s.themes.length ? (
            s.themes.map((t) => (
              <Link className="theme-stat" href={'/puzzles?theme=' + t.key} key={t.key}>
                <div>
                  <strong>{tr(t.name)}</strong>
                  <small>
                    {t.n}
                    {tr(' Versuche \u00B7 ohne Fehler und Hilfe')}
                  </small>
                </div>
                <span>{Math.round(t.rate * 100)} %</span>
                <div className="progress-track">
                  <span style={{ width: t.rate * 100 + '%' }} />
                </div>
              </Link>
            ))
          ) : (
            <Empty title={tr('Noch keine sichere Einsch\u00E4tzung.')}>
              {tr(
                'Ab f\u00FCnf Versuchen pro Motiv zeigen wir deine L\u00F6sequote. Starte mit gemischten Aufgaben.',
              )}
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>{tr('In der Arena')}</h2>
          {completed.length ? (
            <div className="bot-results">
              {[...new Set(completed.map((g) => g.level))]
                .sort((a, b) => a - b)
                .map((level) => {
                  const gs = completed.filter((g) => g.level === level);
                  return (
                    <div className="bot-result" key={level}>
                      <Portrait level={level} />
                      <span>
                        {tr('Stufe ')}
                        {level}
                        <small>
                          {gs.length}
                          {tr(' Partien \u00B7')}{' '}
                          {
                            gs.filter(
                              (g) =>
                                (g.color === 'w' && g.result === '1-0') ||
                                (g.color === 'b' && g.result === '0-1'),
                            ).length
                          }{' '}
                          {tr('Siege')}
                        </small>
                      </span>
                      <Swords size={17} />
                    </div>
                  );
                })}
            </div>
          ) : (
            <Empty title={tr('Deine erste Herausforderung wartet.')}>
              {tr(
                'Spiele gegen einen der 20 Gegner. Ergebnisse und verwendete Hilfen werden gespeichert.',
              )}
            </Empty>
          )}
          <ActionLink secondary href="/arena">
            {tr('Zur Arena')}
          </ActionLink>
        </section>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>{tr('Deine Meilensteine')}</h2>
          <span>
            {badges.filter((b) => b.done).length} / {badges.length}
            {tr(' erreicht')}
          </span>
        </div>
        <div className="badges">
          {badges.map((b) => (
            <div className={'badge ' + (b.done ? 'unlocked' : '')} key={b.title}>
              <b.icon size={30} />
              <strong>{tr(b.title)}</strong>
              <small>{tr(b.text)}</small>
              {b.done && <Check size={14} />}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>{tr('Analysierte Zugqualit\u00E4t')}</h2>
        {analyses.length ? (
          <div className="analysis-history">
            {analyses.map((a, i) => {
              const mean = a.results.length
                ? a.results.reduce((s, r) => s + r.quality, 0) / a.results.length
                : null;
              return (
                <div key={i}>
                  <strong>{mean === null ? '–' : mean.toFixed(1) + ' %'}</strong>
                  <span>
                    {a.results.length} / {a.moves.length}
                    {tr(' Halbz\u00FCge \u00B7')} {a.budget.toLocaleString(locale)}
                    {tr(' Knoten')}
                  </span>
                  <small>
                    {a.complete ? tr('Vollst\u00E4ndige Analyse') : tr('Teilweise analysiert')}
                    {tr(' \u00B7 beide Farben gemeinsam')}
                  </small>
                </div>
              );
            })}
          </div>
        ) : (
          <p>
            {tr(
              'Noch keine Analyse gespeichert. Vergleiche nur Auswertungen mit derselben Intensit\u00E4t.',
            )}
          </p>
        )}
      </section>
      {records.some((r) => r.kind === 'mistake') && (
        <section className="panel">
          <h2>{tr('Deine Fehlerstellungen')}</h2>
          <p>
            {tr(
              'Aus echten Wendepunkten deiner Analysen. \u00DCbe den besten gefundenen Zug erneut.',
            )}
          </p>
          {records
            .filter((r) => r.kind === 'mistake')
            .slice(-12)
            .map((r) => {
              const m = r.value as Mistake;
              return (
                <Link
                  key={r.id}
                  className="saved-game"
                  href={'/puzzles?mistake=' + encodeURIComponent(r.id)}
                >
                  <span>
                    {m.san}
                    {tr(' \u00B7 Halbzug ')}
                    {m.ply + 1}
                    <small>
                      {m.done ? tr('Ohne Hilfe wiederholt') : tr('Zur Wiederholung bereit')}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </Link>
              );
            })}
        </section>
      )}
    </>
  );
}
