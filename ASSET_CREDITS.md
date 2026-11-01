# Assets und Quellen

## Originale OLYMPION-Gestaltung

- `public/images/athena.webp`: eigens für dieses Projekt mit OpenAI Image Generation erzeugtes monochromes Motiv: Athene als Marmorbüste mit korinthischem Helm und griechischem Tempel. Erstellung 29.10.2026. Keine fremde Fotografie als Vorlage verwendet.
- `public/images/god-1.webp` bis `god-20.webp`: Ausschnitte eines eigens erzeugten 5×4-Porträtatlas. Reihenfolge entspricht `GODS` in `src/lib/bots.ts`. Die Abbildungen sind künstlerische Interpretationen und keine dokumentarischen Museumsfotografien.
- OLYMPION-Marke und App-Icons: eigene geometrische Zeichnung aus Tempel und Schachspringer. Keine übernommenen Schachplattform-Logos.
- Schachfiguren: eigene SVG-Pfade in `src/components/Chessboard.tsx`. Keine eingebetteten Unicode-/Emoji-Figuren auf dem spielbaren Brett.

Die Bildgenerierung erfolgte mit dem eingebauten Bildwerkzeug. Der Hero-Prompt beschrieb eine dramatisch beleuchtete Athene-Büste rechts, schwarze freie Textfläche links, monochrome Tempelarchitektur, ohne Schrift oder UI. Der Atlas-Prompt beschrieb 20 gleich große monochrome Marmorporträts in fünf Spalten und vier Zeilen, in der dokumentierten Götterreihenfolge. Die ausgewählten Projektassets liegen zuverlässig lokal; keine Hotlinks oder persönlichen Dateipfade.

## Götterreihenfolge

Hermes, Hebe, Iris, Hestia, Demeter, Persephone, Dionysos, Artemis, Apollon, Chronos, Hephaistos, Ares, Triton, Poseidon, Hekate, Hera, Hades, Prometheus, Athene, Zeus.

## Schriften

- **Cinzel**, aus dem offiziellen Google-Fonts-Repository, SIL Open Font License 1.1. Lokale variable TTF: `public/fonts/cinzel.ttf`. Lizenz: `public/fonts/cinzel-OFL.txt`. Quelle: https://github.com/google/fonts/tree/main/ofl/cinzel
- **DM Sans**, offizielles Google-Fonts-Repository, SIL Open Font License 1.1. Lokale variable TTF: `public/fonts/dmsans.ttf`. Lizenz: `public/fonts/dmsans-OFL.txt`. Quelle: https://github.com/google/fonts/tree/main/ofl/dmsans

Die App stellt beim Seitenaufruf keine Verbindung zu Google Fonts her.

## Puzzles

- 1.000 unterschiedliche Aufgaben aus https://database.lichess.org/lichess_db_puzzle.csv.zst, Lizenz **CC0-1.0**. Originalspiel-URLs und stabile Puzzle-IDs sind enthalten.
- Quelle abgerufen am 29.10.2026; HTTP-Last-Modified: 02.10.2026. 60.000 Quellzeilen wurden gestreamt, alle Lösungszüge mit chess.js validiert, präsentierte Ausgangsstellungen dedupliziert und nach Motiven/Rating geschichtet. SHA-256 und Importdaten stehen in `data/puzzle-import.json`.
- Zusätzlich `olympion-overload-1`: eigene didaktische Stellung. Der schwarze Turm g7 deckt die Dame h7 und schützt zugleich die achte Reihe. Dxh7+ erzwingt …Txh7, dann folgt Ta8#. Legalität und Gewinnzug werden im Engine-Funktionstest geprüft. Das interne Aufgabenrating 1.400 ist eine Produktvorgabe, keine Lichess-Kalibrierung.
- Lichess hat kein eigenes `overloading`-Tag; die eigene Lehrstellung stellt dieses Motiv gezielt bereit. Es werden keine fremden Themen falsch als Überlastung umetikettiert.

## Schachengine und Bibliotheken

Siehe `THIRD_PARTY_NOTICES.md`. Stockfish-Quellarchiv und Lizenz werden zusammen mit der App angeboten. Lichess, Stockfish, Chess.com und FIDE betreiben oder bestätigen OLYMPION nicht.
