interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let promptEvent: InstallPrompt | null = null;
let registered = false;
export async function registerPwa() {
  if (process.env.NODE_ENV === 'development') return;
  if (registered || typeof window === 'undefined') return;
  registered = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvent = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
  });
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch {
      /* Offline data remains in IndexedDB; profile reports support. */
    }
  }
}
export async function installApp() {
  if (promptEvent) {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    promptEvent = null;
    return choice.outcome;
  }
  return 'instructions';
}
export function standalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}
export const CACHE_VERSION = 'olympion-v1';
export async function cacheUrls(urls: string[], progress?: (n: number, total: number) => void) {
  if (!('caches' in window)) throw new Error('Dieser Browser unterstützt keinen Offlinecache.');
  const cache = await caches.open(CACHE_VERSION);
  let n = 0;
  for (const url of urls) {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error('Download fehlgeschlagen: ' + url);
    await cache.put(url, response);
    progress?.(++n, urls.length);
  }
  return n;
}
