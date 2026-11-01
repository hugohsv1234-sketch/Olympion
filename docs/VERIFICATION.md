# Durchgeführte Prüfung

Prüfdatum: **29. Oktober 2026**. Laufzeit: **Node.js 24.22.1**, Chrome in der verfügbaren Browserumgebung. Die CI ist zusätzlich für Node.js 22 konfiguriert; ein entfernter GitHub-Actions-Lauf wurde hier nicht ausgelöst.

## Erfolgreiche automatisierte Prüfungen

| Prüfung                                         | Ergebnis                                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saubere Installation mit `npm ci --include=dev` | Erfolgreich, inklusive automatischer Enginebereitstellung                                                                                                           |
| `npm run lint`                                  | Erfolgreich                                                                                                                                                         |
| `npm run typecheck`                             | Erfolgreich                                                                                                                                                         |
| `npm test`                                      | **33 Tests in 6 Testdateien bestanden**                                                                                                                             |
| `npm run puzzles:validate`                      | **1.001 eindeutige Stellungen**, alle enthaltenen UCI-Folgen legal; Mattlösungen und beide alternativen Wege der eigenen Lehrstellung geprüft                       |
| `npm run test:engine`                           | **20 Stufen × 3 Vergleichsstellungen**, legale Antworten, WDL, eigener Matt-in-zwei-Fall, verpasstes Matt und Abbruch mit anschließendem Stellungswechsel bestanden |
| `npm run build`                                 | Erfolgreicher statischer Produktionsbuild aller 8 Produktseiten                                                                                                     |
| PWA-/Asset-Dateien                              | Manifest, Icons, 21 Puzzlepakete, Engine-JS, WASM, Lizenz und Quellarchiv vorhanden; Service-Worker-Syntax geprüft                                                  |

Die 33 Logiktests enthalten unter anderem Rochaden, illegale Rochade durch Schach, en passant, alle vier Umwandlungsfiguren, Matt/Patt, Materialremis, drei-/fünffache Wiederholung, 50-/75-Züge-Regel, angekündigte Remiszüge, Uhrberechnung, PGN-Roundtrip, ungültige PGN-/FEN-Ausgangsstellungen, Prozentmetrik, Matt-Sonderfälle, Ratingfarmen, Hinweise, Wiederholungsabstände, lokale Kontentrennung und Schutz neuerer Daten vor älteren Importen.

## Datenbankregeln

Die **unveränderte mitgelieferte SQL-Migration** wurde in einer lokalen PostgreSQL-Testinstanz mit **PGlite** ausgeführt. Der Test legt zwei getrennte Auth-IDs und die Rollen `authenticated` und `anon` an. Er prüft:

- A kann eigene Daten synchronisieren und lesen.
- B sieht A-Daten nicht und kann sie nicht aktualisieren.
- B kann keinen Datensatz mit A als Besitzer einschleusen.
- Dieselbe Datensatz-ID bleibt zwischen A und B getrennt.
- Anonyme Tabellenzugriffe werden abgewiesen.
- Ungültige Nutzdaten werden abgewiesen.
- Ältere RPC-Änderungen überschreiben keinen neueren Stand.

`auth.uid()` wird in diesem lokalen Test aus einer gesetzten JWT-Nutzer-ID nachgebildet. Das prüft das SQL und die RLS-Policies, **nicht** Supabase-E-Mailzustellung, reale Tokens, eine laufende Supabase-Instanz oder geräteübergreifende Netzwerksynchronisierung.

## Tatsächlich im Browser geprüft

- Startseite, Navigation und lokale Schriften/Bilddateien.
- Botpartie gegen Hermes mit echtem Stockfish-Worker; eigener Zug, legaler Gegenzug und echte WDL-Livebewertung.
- Zugrücknahme mit Kennzeichnung als Trainingshilfe.
- Neuladen mit Wiederherstellung des gespeicherten und pausierten Partiezustands.
- Puzzle-Motivfilter und Speicherung eines gelösten Versuchs.
- Ungültige PGN führt zu einer verständlichen Fehlermeldung.
- Gültige PGN wird auf dem interaktiven Brett geöffnet.
- Eine vollständige Beispielanalyse über **12 Halbzüge** mit getrennten Ergebnissen für Weiß und Schwarz, Qualitätsklassen und Bewertungsverlauf.
- Beide gültigen Matt-in-zwei-Lösungen der eigenen Überlastungsaufgabe auf dem mobilen Brett bis zum Matt gespielt.
- Gespeicherte 12-Halbzug-Analyse nach Neuladen wieder geöffnet; CSS-Vollbildfallback und Navigation über den Bewertungsverlauf geprüft.
- „Diesen Moment üben“ öffnet die gespeicherte Fehlerstellung mit korrekt rekonstruierter vorheriger Zuggeschichte.
- Responsive Darstellung der Produktbereiche mit unveränderten echten App-Seiten in einem Browser-Viewport-Prüfrahmen.

### Responsive Größen

| CSS-Viewport | Verwendung           | Horizontaler Seitenüberlauf |
| ------------ | -------------------- | --------------------------- |
| 360 × 844    | Schmales Handy       | 0 px                        |
| 390 × 844    | Handy                | 0 px                        |
| 768 × 1024   | Tablet im Hochformat | 0 px                        |
| 1024 × 768   | Tablet im Querformat | 0 px                        |
| 1440 × 900   | Desktop              | 0 px                        |

Training, Puzzles, Arena, Analyse, Akademie, Fortschritt und Profil wurden bei allen fünf Größen vermessen. Die Startseite wurde ebenfalls bei 360, 390, 768, 1024 und 1440 CSS-Pixeln geprüft. Die Spielbretter in Puzzle und Analyse bleiben quadratisch; auf kleinen Breiten werden die Detailbereiche unter das Brett gestellt.

## Offene produktionsbezogene Prüfungen

- **GitHub-Repository:** Der Quellcode gehört in das vom Nutzer angelegte Repository [hugohsv1234-sketch/Olympion](https://github.com/hugohsv1234-sketch/Olympion), auf den Branch `main`. Build-Konfiguration, Assets und CI sind im Projekt enthalten.
- **Nicht auf Vercel veröffentlicht:** Die vollständige Konfiguration und Anleitung sind enthalten. Die spätere Produktionsadresse muss nach dem tatsächlichen Deployment geprüft werden.
- **Keine echte iPhone-/iPad-Hardware und kein Safari-Gerät verfügbar:** Responsive Browserprüfung ist keine vollständige Touch-, Safari- oder Hardwareprüfung.
- **PWA-Installation und Offline-Neustart nicht unter Produktions-HTTPS getestet:** Die verfügbare Vorschau verwendet HTTP. Service Worker und Installationsvoraussetzungen müssen nach dem Vercel-Deployment unter HTTPS abschließend geprüft werden. Es wurde keine Browser-Sicherheitswarnung umgangen.
- **Keine aktive Supabase-Instanz eingerichtet:** Liveanmeldung, Bestätigungsmail, Offline-Warteschlange über reale Netzunterbrechungen und Synchronisierung über mehrere echte Geräte müssen nach eigener Cloudkonfiguration geprüft werden. Lokale Speicher- und SQL/RLS-Tests sind bestanden.
- **Keine Elo-Kalibrierung:** Die funktionierenden 20 Konfigurationen sind keine empirisch kalibrierten Elo-Stufen.

Es wird keine absolute Fehlerfreiheit behauptet. Die Datei beschreibt die tatsächlich ausgeführten Prüfungen und ihre Grenzen.
