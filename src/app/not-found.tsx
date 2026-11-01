import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">OLYMPION · 404</span>
      <h1>Dieser Weg führt nicht zum Olymp.</h1>
      <p>Die angeforderte Seite wurde nicht gefunden.</p>
      <Link className="button primary" href="/">
        Zur Akademie
      </Link>
    </main>
  );
}
