'use client';
import { uuid } from '@/lib/id';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  CircleUserRound,
  Columns3,
  Compass,
  Crosshair,
  Download,
  Flame,
  Home,
  Menu,
  Swords,
  X,
  WifiOff,
  Puzzle,
} from 'lucide-react';
import type { Section } from '@/lib/types';
import { useStore } from './Provider';
import { Logo } from './Common';
import { attemptsFrom, streak } from '@/lib/puzzles';
import { registerPwa } from '@/lib/pwa';
const nav = [
  { id: 'start', name: 'Der Olymp', sub: 'Übersicht', icon: Home, href: '/' },
  {
    id: 'training',
    name: 'Mein Training',
    sub: 'Dein täglicher Plan',
    icon: Compass,
    href: '/training',
  },
  {
    id: 'puzzles',
    name: 'Taktik & Puzzles',
    sub: 'Athenes Akademie',
    icon: Puzzle,
    href: '/puzzles',
  },
  { id: 'arena', name: 'Die Arena', sub: 'Spiele gegen die Götter', icon: Swords, href: '/arena' },
  {
    id: 'analyse',
    name: 'Partieanalyse',
    sub: 'Apollons Einsichten',
    icon: Crosshair,
    href: '/analyse',
  },
  {
    id: 'akademie',
    name: 'Die Akademie',
    sub: 'Wissen wird Können',
    icon: BookOpen,
    href: '/akademie',
  },
  {
    id: 'fortschritt',
    name: 'Dein Aufstieg',
    sub: 'Fortschritt & Meilensteine',
    icon: ChartNoAxesCombined,
    href: '/fortschritt',
  },
];
export default function Shell({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  const { records, settings, user, status, error, setError, put } = useStore();
  const [menu, setMenu] = useState(false),
    [online, setOnline] = useState(true);
  const sessions = useRef({ id: '', seconds: 0, last: 0 });
  useEffect(() => {
    void registerPwa();
    const change = () => setOnline(navigator.onLine);
    change();
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, []);
  useEffect(() => {
    if (!['puzzles', 'arena', 'analyse', 'akademie'].includes(section)) return;
    sessions.current = { id: uuid(), seconds: 0, last: Date.now() };
    let startDay = new Date().toDateString();
    const tick = () => {
      const s = sessions.current,
        now = Date.now();
      if (!document.hidden && document.hasFocus()) {
        s.seconds += Math.min(20, (now - s.last) / 1000);
      }
      s.last = now;
      if (s.seconds >= 1)
        void put('session:' + s.id, 'session', {
          seconds: Math.floor(s.seconds),
          at: now,
          section,
        }).catch(() => undefined);
      if (new Date().toDateString() !== startDay) {
        sessions.current = { id: uuid(), seconds: 0, last: now };
        startDay = new Date().toDateString();
      }
    };
    const timer = setInterval(tick, 15000);
    const visibility = () => {
      sessions.current.last = Date.now();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      tick();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [section, put]);
  return (
    <div className={'app ' + (!settings.motion ? 'no-motion' : '')}>
      <a className="skip-link" href="#content">
        Zum Inhalt springen
      </a>
      <aside className={'sidebar ' + (menu ? 'is-open' : '')}>
        <Link className="brand" href="/" onClick={() => setMenu(false)}>
          <Logo />
          <span>
            OLYMPION<small>DIE SCHACHAKADEMIE</small>
          </span>
        </Link>
        <div className="sidebar-line" />
        <span className="nav-label">DEIN WEG ZUM OLYMP</span>
        <nav aria-label="Hauptnavigation">
          {nav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              aria-current={section === n.id ? 'page' : undefined}
              className={'nav-item ' + (section === n.id ? 'active' : '')}
              onClick={() => setMenu(false)}
            >
              <n.icon size={19} />
              <span>
                {n.name}
                <small>{n.sub}</small>
              </span>
              {section === n.id && <span className="active-mark" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quote">
            <Columns3 size={21} />
            <p>„Der Anfang ist die Hälfte des Ganzen.“</p>
            <span>ARISTOTELES</span>
          </div>
          <Link href="/profil" className={'profile-link ' + (section === 'profil' ? 'active' : '')}>
            <span className="avatar">{(settings.name || 'G')[0].toUpperCase()}</span>
            <span>
              {settings.name || 'Gast'}
              <small>{user ? 'Konto verbunden' : 'Lokales Gastprofil'}</small>
            </span>
            <CircleUserRound size={17} />
          </Link>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Menü schließen"
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? 'Menü schließen' : 'Menü öffnen'}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="breadcrumb">
              OLYMPION <span>/</span>{' '}
              {nav.find((n) => n.id === section)?.name || 'Profil & Einstellungen'}
            </span>
          </div>
          <div className="topbar-right">
            {!online && (
              <span className="offline-label">
                <WifiOff size={15} />
                Offline
              </span>
            )}
            <span className="streak">
              <Flame size={17} />
              {streak(attemptsFrom(records))}
              <span>{streak(attemptsFrom(records)) === 1 ? 'Tag in Folge' : 'Tage in Folge'}</span>
            </span>
            <Link href="/profil" className="top-install">
              <Download size={16} />
              <span>App installieren</span>
            </Link>
            <Link className="top-avatar" href="/profil" aria-label="Profil öffnen">
              {(settings.name || 'G')[0].toUpperCase()}
            </Link>
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Meldung schließen"
              onClick={() => setError(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <main id="content" className={'main section-' + section}>
          {children}
        </main>
        <footer className="footer">
          <span>
            <Logo />
            OLYMPION <span>·</span> Jeder Zug ein Schritt.
          </span>
          <Link href="/profil">
            {status}
            <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Mobile Hauptnavigation">
        {[
          { href: '/training', id: 'training', name: 'Training', icon: Compass },
          { href: '/puzzles', id: 'puzzles', name: 'Puzzles', icon: Puzzle },
          { href: '/arena', id: 'arena', name: 'Arena', icon: Swords },
          { href: '/analyse', id: 'analyse', name: 'Analyse', icon: Crosshair },
          { href: '/fortschritt', id: 'fortschritt', name: 'Aufstieg', icon: ChartNoAxesCombined },
        ].map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className={section === n.id ? 'active' : ''}
            aria-current={section === n.id ? 'page' : undefined}
          >
            <n.icon size={20} />
            <span>{n.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
