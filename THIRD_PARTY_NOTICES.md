# Drittanbieter-Software

| Komponente              | Version                             | Lizenz / Quelle                                              |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------ |
| Stockfish.js, Stockfish | npm 19.0.1 / Stockfish 19 Lite WASM | GPL-3.0, https://github.com/nmrugg/stockfish.js/tree/v19.0.1 |
| chess.js                | 1.4.0                               | BSD-2-Clause, https://github.com/jhlywa/chess.js             |
| Next.js                 | 16.4.3                              | MIT, https://github.com/vercel/next.js                       |
| React / React DOM       | 19.3.1                              | MIT, https://github.com/facebook/react                       |
| Supabase JS             | 2.118.0                             | MIT, https://github.com/supabase/supabase-js                 |
| Lucide                  | 0.468.0                             | ISC, https://github.com/lucide-icons/lucide                  |
| DM Sans / Cinzel        | lokale Schriftdateien               | SIL OFL 1.1, Lizenztexte im Fontordner                       |
| Lichess-Puzzles         | Snapshot Oktober 2026               | CC0-1.0, https://database.lichess.org/                       |

Das Projekt wird unter GPL-3.0 veröffentlicht, siehe `LICENSE`. Die abweichenden ursprünglichen Lizenzen eingebundener Bibliotheken bleiben erhalten. Installierte npm-Pakete enthalten ihre jeweiligen Lizenzdateien; die Lockdatei pinnt ihre Paketintegrität. Relevante Lizenztexte werden zusätzlich in `licenses/` aufbewahrt.

## Stockfish-Bereitstellung und zugehöriger Quellcode

Die ausgelieferten Dateien `stockfish-19-lite-single.js` und `stockfish-19-lite-single.wasm` werden unverändert aus `stockfish@19.0.1` kopiert. Hashes stehen in `public/engine/manifest.json`.

- GPL-Text: `public/engine/COPYING.txt` und Projektwurzel `LICENSE`.
- Zugehöriger veröffentlichter Quellcode: `public/engine/source.tar.gz`, unverändertes GitHub-Quellarchiv des Tags **v19.0.1**. Die Datei wird als öffentlicher Download mit der Website ausgeliefert.
- Offizielle Quelle: https://codeload.github.com/nmrugg/stockfish.js/tar.gz/refs/tags/v19.0.1
- Buildskripte und Anleitungen sind im Archiv enthalten. `build.js` unterstützt den Lite-Single-Thread-Build; das Upstream-README dokumentiert Emscripten und die benötigten NNUE-Netze.
- Projektänderungen betreffen den separaten UCI-Client und die Oberfläche, nicht den Enginecode.

Wird die Engine später aktualisiert, müssen Paketversion, Binärhashes, zugehöriges Quellarchiv und dieser Hinweis gemeinsam aktualisiert werden. Es reicht nicht, auf einen beliebigen späteren Upstream-Stand zu verlinken.
