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
    <html lang="de" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=JSON.parse(localStorage.getItem('olympion-display')||'{}');if(d.theme==='light'||d.theme==='dark')document.documentElement.dataset.theme=d.theme;if(d.language==='de'||d.language==='en')document.documentElement.lang=d.language}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
