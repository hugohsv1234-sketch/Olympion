import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'OLYMPION — Die Schachakademie',
  description:
    'Trainiere mit Athene. Spiele gegen 20 Götter. Analysiere deine Partien mit Stockfish. Deine Schachakademie für jeden Bildschirm.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'OLYMPION', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0d',
  viewportFit: 'cover',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
