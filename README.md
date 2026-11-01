# OLYMPION

Eine deutschsprachige Schachakademie in Schwarz, Weiß und Grau, inspiriert von griechischer Architektur und Mythologie. Die Schachengine rechnet auf deinem Gerät.

## Direkt zu GitHub und Vercel

Repository: **[hugohsv1234-sketch/Olympion](https://github.com/hugohsv1234-sketch/Olympion)**. Die Projektdateien liegen direkt auf dem Branch `main` in der Repository-Wurzel.

1. In Vercel **Add New → Project** wählen.
2. Das GitHub-Repository **Olympion** importieren. Framework: **Next.js**, Root Directory: Projektwurzel, Node.js: **22.x**.
3. **Deploy** anklicken. Installationsbefehl, Build und Ausgabeverzeichnis stehen bereits in `vercel.json`.

Kein API-Schlüssel nötig. Fortschritt wird zunächst auf dem jeweiligen Gerät gespeichert. Konten und Synchronisierung zwischen Geräten lassen sich optional später mit Supabase einrichten.

Die kompakte Anleitung steht in **[START_HIER.md](START_HIER.md)**; Details zur optionalen Kontoeinrichtung in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Starten

Voraussetzung: **Node.js 22 LTS** und npm. Node 24 wird ebenfalls unterstützt. Nach dem Entpacken im Projektverzeichnis:

```bash
npm ci --include=dev
npm run dev
```

Öffne `http://localhost:3000`. Ein Konto oder API-Schlüssel ist für Gasttraining, Puzzletraining, Botspiel und lokale Analyse nicht nötig.

Produktionsversion lokal prüfen:

```bash
npm run build
npm start
```

Die App erzeugt einen statischen Next.js-Export in `out/`. `npm start` verwendet den mitgelieferten kleinen HTTP-Dateiserver. Für PWA-Installation ist HTTPS oder localhost nötig.

## Enthalten

- Acht erreichbare Bereiche: Start, Training, Puzzles, Arena, Analyse, Akademie, Fortschritt und Profil.
- **1.000 unterschiedliche Lichess-Aufgaben** aus dem CC0-Datensatz und **eine eigene Überlastungs-Lehrstellung**. Alle Zugfolgen werden auf Legalität geprüft; Mattmotive enden in Matt.
- Adaptives Training, Tagesaufgabe, freie Serien, Motivfilter, abgestufte Hinweise, Drei-Minuten-Training und zeitgesteuerte Wiederholungen.
- **20 Stockfish-Botkonfigurationen** mit unterschiedlichen Rechenbudgets, Skill-Leveln und kontrollierter Kandidatenauswahl. Keine erfundenen Elo-Angaben.
- Vollständige Zugregeln über chess.js; explizite Unterscheidung von beanspruchbaren und automatischen Wiederholungs-/Zählerremisfällen.
- Wählbare Farben und Bedenkzeiten, Zugrücknahme als Hilfe, PGN-Export, pausierbare Uhr und Wiederherstellung der Zuggeschichte.
- Live-Zugqualität auf Basis echter unabhängiger Stockfish-Suchen; WDL-Metrik mit separater Mattbehandlung.
- PGN-/FEN-Import, unterbrechbare und fortsetzbare Partieanalyse, getrennte Farbstatistiken, Verlauf, Wendepunkte, Varianten, Vollbild und eigene Fehlerübungen.
- Zwölf interaktive Lektionen, Tagesziele, echte Statistiken und sechs Meilensteine.
- IndexedDB-Gastprofil, JSON-Sicherung und -Import. Optional Supabase Auth/Postgres mit RLS, Offline-Warteschlange und Übernahme von Gastdaten ohne ID-Duplikate.
- PWA mit App-Icons, Service Worker und kontrolliertem Engine-/Puzzledownload.
- Lokale Schriften, originale Schachfiguren als SVG und für OLYMPION erzeugte monochrome Statuenbilder.

## Architektur

| Bereich                                 | Ort                                               |
| --------------------------------------- | ------------------------------------------------- |
| Next.js App Router / statische Seiten   | `src/app`                                         |
| Bedienoberflächen                       | `src/components`                                  |
| Schachregeln und Partiegeschichte       | `src/lib/chess.ts`                                |
| UCI-Worker, Scheduler, Abbruch, Analyse | `src/lib/engine.ts`                               |
| Prozentmetrik und Mattfälle             | `src/lib/metrics.ts`                              |
| 20 Botstufen                            | `src/lib/bots.ts`                                 |
| Puzzlelogik / Rating / Wiederholungen   | `src/lib/puzzles.ts`                              |
| Lokaler Speicher / Konflikte / Backup   | `src/lib/storage.ts`                              |
| Auth / Synchronisierung                 | `src/lib/cloud.ts`, `src/components/Provider.tsx` |
| Datenbankschutz und Validierung         | `supabase/migrations/001_user_records.sql`        |
| Reproduzierbare Datenaufbereitung       | `scripts/`, `data/puzzle-import.json`             |

Die Browserengine ist **Stockfish.js 19.0.1 lite-single**. Sie benötigt keine Cross-Origin-Isolation und keinen Schachserver. Ein serialisierter Scheduler wartet nach `stop` auf `bestmove`, bevor ein anderer Auftrag startet. Ein Timeout verwirft den Worker vollständig. UI-Aufträge besitzen zusätzlich eigene Abbruchsignale und Stellungs-/Partiekennungen.

## Prüfungen

```bash
npm run lint
npm run typecheck
npm test
npm run puzzles:validate
npm run test:engine
npm run build
```

`test:engine` startet denselben gepinnten Single-Thread-Build im Node-Prozess, prüft jede der 20 Stufen an drei Stellungen, validiert legale Antworten, WDL-Ausgabe, die eigene Überlastungsaufgabe, einen Mattfall und Abbruch mit anschließendem Stellungswechsel. Es schreibt `docs/engine-test-results.json`. Das ist ein Funktionstest und keine Elo-Kalibrierung.

Die durchgeführten und noch ausstehenden Browser-/Cloudprüfungen stehen in `docs/VERIFICATION.md`. Die Konfiguration enthält keine aktive Supabase-Instanz. Ohne Einrichtung kann kein kontenübergreifender Livezugriffstest als bestanden gelten.

## Puzzlebestand reproduzieren

Die 1.001 fertigen Aufgabenpakete sind enthalten; für einen normalen Build ist kein Datenimport nötig. Für eine neue Aufbereitung wird nur ein begrenzter Ausschnitt des großen Quelldatensatzes gestreamt:

```bash
python3 -m pip install zstandard
python3 scripts/download-puzzles.py lichess-source.csv 60000
npm run puzzles:import -- lichess-source.csv
npm run puzzles:validate
```

Der offizielle Download wird regelmäßig aktualisiert. Ein neuer Abruf kann deshalb andere Aufgaben erzeugen. Zur Identifikation des mitgelieferten Ausschnitts stehen Snapshotdatum und SHA-256 in `data/puzzle-import.json`. Bei einem neueren Quelldatensatz muss dessen Snapshotdatum im Importmanifest entsprechend aktualisiert werden.

## Veröffentlichungsanleitung

Siehe **[DEPLOYMENT.md](DEPLOYMENT.md)**. Sie enthält GitHub-Import, Vercel-Einstellungen, Supabase-Migration, Auth-Weiterleitungen und den abschließenden Funktionstest.

## Daten und Lizenzen

Siehe `ASSET_CREDITS.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md` und `docs/METRICS.md`. Der zugehörige Stockfish-Quellcode liegt unter `public/engine/source.tar.gz`, die GPL unter `public/engine/COPYING.txt`. Beim Installieren kopiert das Vorbereitungsskript ausschließlich den kleinen benötigten Build aus dem per Lockfile gepinnten npm-Paket; große Enginevarianten kommen nicht in Git.

## Bekannte Grenzen

- Zugqualität ist eine eigene Suchmetrik; die Engine kennt nicht die objektive Wahrheit. Knotenzahl und erreichte Tiefe werden angezeigt. Bei Widersprüchen wird genauer gesucht und geringe Sicherheit markiert.
- Die 20 Stufen sind unterschiedlich konfiguriert und funktional geprüft; eine streng monotone Erfolgsrate gegen Menschen ist nicht kalibriert.
- Die Remisautomatik deckt die Materialfälle von chess.js, Patt und die expliziten Wiederholungs-/Zählerregeln ab. Beliebige mathematisch tote, aber materialreiche Blockadestellungen werden nicht vollständig bewiesen. Bei Zeitüberschreitung wird die offensichtliche Mattunmöglichkeit gegen einen nackten König berücksichtigt; komplexere Unmöglichkeitsbeweise sind nicht implementiert.
- Offlinefunktion hängt von erfolgreichem Download, HTTPS und den Speichergrenzen des Browsers ab. Offline-Downloads sind gezielt; ein frischer Besuch lädt keine große Engine ungefragt.
- Bei einem harten Browserabbruch wird eine Trainingspartie beim Wiederöffnen mit dem letzten gespeicherten Uhrstand pausiert. Sichtbarer App-Wechsel speichert vorher den aktuellen Zeitstand.
- Parallele Änderungen desselben Datensatzes verwenden Last-Write-Wins mit Zeitstempel und Geräte-ID. Unabhängige Versuche/Partien haben eigene UUIDs. Zwei Geräte sollten dieselbe laufende Partie nicht gleichzeitig bearbeiten. Die Oberfläche bleibt bei Syncfehlern lokal nutzbar.
- Kein kommerzieller Livebetrieb, keine echte iPhone-/iPad-Hardware und keine aktiven Supabase-Konten werden durch die Projektprüfung ersetzt.
