# Ratings, Zeit und Zugqualität

## Puzzle-Rating

- Startwert 1.200, ausdrücklich als Startwert gekennzeichnet.
- Elo-ähnliche Produktmetrik: `R_neu = round(R_alt + 24 × (S − E))`, mit `E = 1 / (1 + 10^((Aufgabenrating − R_alt)/400))`.
- `S = 1` nur bei selbstständiger Lösung ohne Fehler und ohne Hinweise; sonst `S = 0`.
- Pro unbekannter Aufgaben-ID zählt genau der erste Versuch. Bereits bekannte Aufgaben und explizite Wiederholungen geben kein weiteres Rating.
- Ein Versuch erhält eine stabile UUID. Nach dem ersten Lösungszug, Fehler oder Hinweis wird er gespeichert und beim Abschluss unter derselben ID aktualisiert. Unvollständige gestartete Versuche gelten als nicht gelöst.
- Historien werden aus nach Zeit sortierten Versuchen rekonstruiert. Keine FIDE-, Chess.com- oder Lichess-Spielerwertung.

## Wiederholungen

Fehler, Hinweise oder eine nicht gelöste Aufgabe planen zunächst eine Wiederholung nach zehn Minuten. Anschließende selbstständige Erfolge verlängern die Abstände auf 1, 3, 7, 14 und 30 Tage. Eine erneute nicht selbstständige Lösung setzt die Stufe zurück. Nur fällige Aufgaben erscheinen im Wiederholungsmodus.

## 20 Botkonfigurationen

Die vollständige Liste wird im Funktionstest unter `docs/engine-test-results.json` protokolliert; die Quelle ist `src/lib/bots.ts`.

Für Index `i = 0 … 19`:

- Skill Level: `round(i × 20 / 19)`.
- Knotenbudget: `round(256 × 2^(i × 0.63))`.
- MultiPV: 8 für i < 7, 5 für i < 12, 3 für i < 16, sonst 1.
- Zusätzliche Fehlerrate: `max(0, (14 − i) / 16)`.

Anfänger wählen bei diesem Fehleranteil einen nach dem FEN-Hash reproduzierbar bestimmten schwächeren, legalen Kandidaten. Der Stockfish-Skill hat eigene interne Zufallselemente. Exakte Zugreproduzierbarkeit über verschiedene Enginezustände hinweg ist deshalb keine Zusage.

Der UCI-Handshake liest die tatsächlichen Optionen und Bereiche. Zahlen werden an die unterstützten Grenzen geklemmt. Vor jeder Suche wird `UCI_LimitStrength=false` gesetzt; `UCI_Elo` wird nicht verwendet. Die Analyse setzt unabhängig von der Botstufe Skill 20 und MultiPV 1. Die Hash-Tabelle wird pro Suche geleert.

Ein zusätzlicher Zeitdeckel verhindert endlose Suchen in bereits entschiedenen Stellungen: `clamp(ceil(Knoten/60), 1000, 20000)` Millisekunden. Angezeigt wird die tatsächlich erreichte Tiefe, nicht eine garantierte Tiefe. Die letzte exakte UCI-Bewertung wird bevorzugt; bloße Bounds überschreiben keine vorhandene exakte Bewertung.

## OLYMPION-Zugqualität

Beide Suchen starten aus derselben Ausgangsstellung einschließlich vorheriger Zugfolge. Die erste Suche bestimmt den besten Kandidaten. Die zweite erzwingt den gespielten Zug über `searchmoves`, wenn er nicht bereits der Bestzug war. Beide verwenden dasselbe Knotenbudget, denselben Zeitdeckel, Skill 20 und MultiPV 1.

Mit Stockfish-WDL:

```text
E = (W + 0,5 × D) / (W + D + L)
Qualität = 100 × (1 − clamp(E_best − E_gespielt, 0, 1))
```

Die UCI-Bewertung und WDL werden aus Sicht des am Zug befindlichen Spielers geliefert. Da beide Suchen dieselbe Ausgangsstellung verwenden, haben sie dieselbe Perspektive. Für den Verlauf und die Bewertungsleiste werden schwarze Root-Scores invertiert, sodass Weiß die stabile Perspektive ist.

Ohne WDL gilt als ausdrücklich markierte Näherung `E = 1 / (1 + exp(-cp / 220))`. Die Bauerneinheiten werden nicht durcheinander geteilt. Die Umrechnung ist keine Gewinnwahrscheinlichkeit und keine offizielle Stockfish-Accuracy.

Wenn die Bewertung des gespielten Zugs um mehr als 0,04 erwartete Punkte besser als der zunächst gefundene Bestzug erscheint, werden beide Suchen mit dreifachem Knotenbudget wiederholt. Verbleibende Widersprüche, Bounds oder stark unterschiedliche Tiefen erhalten „Geringe Sicherheit“.

Mattwerte werden separat gespeichert, angezeigt und klassifiziert. Verpasstes oder zugelassenes Matt überschreibt die gewöhnliche Qualitätsklasse. Für die Erwartungsmetrik werden forcierte Siege/Verluste als 1/0 geführt. Unterschiedliche Mattdistanzen können denselben Prozentwert haben; die Mattdistanz bleibt separat sichtbar. Erzwungene Einzelzüge werden als „Erzwungener Zug“ gekennzeichnet.

| Klasse        | Bedingung nach Sonderfällen            |
| ------------- | -------------------------------------- |
| Bester Zug    | derselbe Zug wie der gefundene Bestzug |
| Sehr gut      | ≥ 98 %                                 |
| Guter Zug     | ≥ 92 %                                 |
| Ungenauigkeit | ≥ 80 %                                 |
| Fehler        | ≥ 60 %                                 |
| Grober Fehler | < 60 %                                 |

Die Gesamtwerte je Farbe sind arithmetische Mittel der analysierten Zugqualitäten. Abdeckung und analysierte Zugzahl stehen unmittelbar daneben. Teilanalysen werden nicht als vollständige Partie ausgegeben. Der begrenzte In-Memory-Analysecache enthält FEN, gesamte vorherige Zuggeschichte, Zug, Engineversion und Budget.

## Uhr und Unterbrechung

Aktuelle Zeit = gespeicherte Restzeit minus nichtnegative Differenz aus aktuellem Zeitstempel und Zugbeginn. Die Anzeige rendert regelmäßig, zählt aber keine Ticks herunter. Nach einem Zug kommt gegebenenfalls das Inkrement hinzu. Rücknahmen setzen auf den gespeicherten Uhrstand vor den zurückgenommenen Halbzügen zurück und zählen als Hilfe.

Bei sichtbarem Tab-/App-Wechsel und beim Verlassen der Arena wird die Restzeit gespeichert und die Trainingsuhr pausiert. Nach einem harten Browserabbruch wird der letzte gespeicherte Uhrstand pausiert wiederhergestellt. Er ist bewusst kein Turnieruhr- oder Anti-Cheating-System.

Trainingszeit wird in aktiven, fokussierten Trainingsansichten in 15-Sekunden-Intervallen gespeichert. Kurze Restintervalle werden beim normalen Seitenwechsel ergänzt. Ein harter Browserabbruch kann höchstens das noch nicht gesicherte Intervall verlieren.
