# OLYMPION über GitHub und Vercel veröffentlichen

Das Repository ist **[hugohsv1234-sketch/Olympion](https://github.com/hugohsv1234-sketch/Olympion)**. Für deine Vercel-Veröffentlichung kannst du direkt bei **Schritt 3** beginnen. Die Projektwurzel enthält bereits `package.json` und `vercel.json`.

## 1. Projekt entpacken und prüfen

Installiere Node.js 22 LTS. Öffne ein Terminal im entpackten Ordner `olympion`.

```bash
npm ci --include=dev
npm run typecheck
npm test
npm run build
```

Gasttraining funktioniert ohne `.env.local`. Lege für Gastbetrieb keine Beispieldatenbankwerte als echte Variablen an.

## 2. Neues GitHub-Repository erstellen

Mit GitHub Desktop: **File → Add Local Repository** bzw. zuerst **Create a New Repository** im Projektordner, alle Projektdateien committen und **Publish Repository** mit dem Namen `olympion` wählen. `node_modules`, `.next`, `out` und echte `.env`-Dateien sind bereits ausgeschlossen.

Alternativ mit Git und GitHub CLI, nachdem `gh auth login` abgeschlossen ist:

```bash
git init -b main
git add .
git commit -m "Build OLYMPION chess academy"
gh repo create olympion --private --source=. --remote=origin --push
```

Das erstellt bei Bedarf eine eigene private Kopie. Für das vorhandene Repository **Olympion** ist dieser Schritt nicht mehr nötig.

## 3. Auf Vercel importieren

1. Auf Vercel **Add New → Project** wählen und das neue GitHub-Repository importieren.
2. Framework: **Next.js**. Projektwurzel ist der Ordner mit `package.json`.
3. Node-Version: **22.x**.
4. `vercel.json` enthält bereits: Install `npm ci --include=dev`, Build `npm run build`, Ausgabe `out`.
5. Ohne Konten werden zunächst keine Umgebungsvariablen benötigt.
6. **Deploy** wählen. Öffne die von Vercel tatsächlich zurückgegebene HTTPS-Adresse.

Der kleine Stockfish-Build wird in `postinstall` und erneut vor dem Build automatisch kopiert. Er kommt aus dem gepinnten npm-Paket mit Lockfile-Integrität. Große Multi-Thread- oder Full-Builds werden nicht veröffentlicht. WASM erhält vom statischen Host den MIME-Typ `application/wasm`; das auf der fertigen Adresse in den Entwicklerwerkzeugen prüfen.

## 4. Optional Konten aktivieren

1. Eigenes Supabase-Projekt anlegen.
2. Im SQL Editor den vollständigen Inhalt von `supabase/migrations/001_user_records.sql` **einmal** ausführen. Alternativ die Supabase CLI für Migrationen verwenden.
3. In Supabase Auth E-Mail/Passwort-Anmeldung einschalten und gewünschte E-Mail-Bestätigung konfigurieren.
4. Unter Auth → URL Configuration die Vercel-Produktionsadresse als Site URL eintragen. Erlaubte Redirect URL: `https://DEINE-DOMAIN/profil`; lokal zusätzlich `http://localhost:3000/profil`. Bei Previewdomains nur ausdrücklich verwendete Domains erlauben.
5. In Vercel → Settings → Environment Variables folgende **öffentliche** Werte setzen:

| Name                            | Wert                               |
| ------------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Projekt-URL aus Supabase           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher anon-/Publishable-Key |

6. Für lokale Entwicklung `.env.example` nach `.env.local` kopieren und die beiden Beispielwerte ersetzen.
7. Vercel neu bauen/deployen: Die öffentlichen Variablen werden beim Build eingebunden. Sie sind absichtlich im Browser sichtbar; **niemals** einen `service_role`- oder Secret-Key verwenden.
8. Unter Profil registrieren, ggf. E-Mail bestätigen und anmelden. Die lokalen Gastdaten erst über **Gastdaten übernehmen** in das gewünschte Konto kopieren.

Die Tabelle und der RPC verwenden die angemeldete Nutzer-ID aus dem JWT. Der Browser darf keine fremde Nutzer-ID an die Synchronisierung übergeben. RLS schützt Lesen und Schreiben; Trigger und RPC validieren Daten serverseitig. Das Schema hat keine öffentlich freigegebenen Tabellen.

## 5. Abschließender Funktionstest

- In einem frischen Browser eine Aufgabe lösen, Seite neu laden und den tatsächlichen Fortschritt prüfen.
- Arena starten, zwei Halbzüge spielen, App wechseln, zurückkehren und pausierte Uhr samt Zugliste prüfen.
- Schwachen und starken Bot ausprobieren; Live-Bewertung abwarten. Bei Workerfehler darf kein Prozentwert erfunden werden.
- PGN importieren, Analyse starten/abbrechen/fortsetzen, im Bewertungsgraph klicken und Vollbild öffnen.
- Profil → Engine und Puzzlepakete herunterladen; danach offline neu laden und geladene Bereiche ausprobieren.
- PWA auf Android/Chrome installieren; auf iPhone/iPad „Zum Home-Bildschirm“ über das Browsermenü testen.
- Bei aktivierter Cloud **zwei eigene Testkonten in getrennten Browserprofilen** verwenden. Datensatz von A erstellen; B darf ihn weder lesen noch ändern. B darf auch per direktem Tabellenzugriff keinen Datensatz mit `user_id=A` einfügen. Erst dann den Cloudbetrieb freigeben.
- Dasselbe Konto auf zwei Geräten öffnen: neue unabhängige Versuche synchronisieren, offline Änderungen anlegen, wieder online gehen und prüfen, dass keine IDs doppelt vorkommen. Gastdatenübernahme zweimal auslösen; beim zweiten Mal dürfen keine zusätzlichen Duplikate entstehen.

Es werden keine Zugangsdaten mitgeliefert. Cloudzugriffsschutz und echte mobile Installation müssen gegen deine eingerichtete Produktionsumgebung geprüft werden.
