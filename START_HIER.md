# OLYMPION bei Vercel veröffentlichen

Repository: **[hugohsv1234-sketch/Olympion](https://github.com/hugohsv1234-sketch/Olympion)**. Der vollständige Quellcode liegt auf `main`, direkt in der Projektwurzel.

## In Vercel

1. Im Vercel-Dashboard **Add New → Project** wählen.
2. Das GitHub-Repository **Olympion** importieren. Falls es nicht erscheint, Vercel in der GitHub-Auswahl Zugriff auf dieses Repository geben.
3. **Root Directory:** Projektwurzel unverändert lassen. Keinen zusätzlichen Unterordner eintragen.
4. **Framework Preset:** Next.js. **Node.js:** 22.x.
5. Die enthaltene `vercel.json` setzt Install Command `npm ci --include=dev`, Build Command `npm run build` und Output Directory `out`.
6. Für den Gastbetrieb keine Umgebungsvariablen eintragen.
7. **Deploy** anklicken und auf den fertigen Build warten. Vercel zeigt anschließend die Website-Adresse an.

## Was direkt funktioniert

Puzzles, Training, die 20 Botstufen, lokale Partieanalyse und das Speichern auf deinem Gerät benötigen keinen Server und keinen API-Schlüssel. Für Anmeldung und geräteübergreifenden Fortschritt ist optional Supabase nötig; dafür gibt es `DEPLOYMENT.md`.

## Geprüft

Am 29. Oktober 2026: saubere Installation, 33 bestandene Tests, 1.001 validierte Aufgaben und erfolgreicher Produktionsbuild mit TypeScript-Prüfung. Die Veröffentlichung bei Vercel übernimmt der Nutzer selbst.
