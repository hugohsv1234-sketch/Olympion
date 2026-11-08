# Konten, Profilbilder und öffentliche Elo aktivieren

Die Erweiterung nutzt den bereits vorhandenen Supabase-Client. Gasttraining bleibt unabhängig davon verfügbar. Die Anmeldung ist erst aktiv, wenn ein echtes Supabase-Projekt verbunden ist. Nicht konfigurierte Anbieter werden sichtbar deaktiviert; die Rangliste enthält keine Beispieldaten.

## Datenbank und Vercel

1. Ein Supabase-Projekt für OLYMPION auswählen oder anlegen.
2. Migrationen `001_user_records.sql` und anschließend `002_profiles_and_rankings.sql` einmal anwenden. Die zweite Migration erstellt bestätigte öffentliche Profile, die Rangliste, geschützte Belohnungen, Serverpartien und den Avatar-Bucket.
3. Auf Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und **nur serverseitig** `OLYMPION_RANKING_KEY` setzen. Den Ranglistenschlüssel aus 32 kryptografisch zufälligen Bytes als Hex-String erzeugen. In `olympion_private.ranking_key` ausschließlich den SHA-256-Hash dieses Strings als `bytea` speichern. Der Klartext gehört ausschließlich in Vercel.
4. Neu deployen. Der bestehende statische Next.js-Export bleibt bestehen. Die zusätzliche Vercel Function unter `/api/ranking` prüft angemeldete Nutzer und rechnet Ranglisten-Botzüge mit demselben Stockfish-Build auf dem Server.
5. `GET /api/ranking` zeigt nur `{configured: true/false}`; Schlüssel, E-Mails und Sitzungen werden dabei nicht ausgegeben.

## E-Mail und Passwort

In Supabase Auth E-Mail/Passwort und **Confirm email** aktivieren. Passwort-Mindestlänge auf mindestens zehn Zeichen einstellen. Als Site URL `https://olympion-tcuq.vercel.app` verwenden. Die folgenden Redirects ausdrücklich erlauben:

- `https://olympion-tcuq.vercel.app/profil`
- `https://olympion-tcuq.vercel.app/profil?auth=confirmed`
- `https://olympion-tcuq.vercel.app/profil?auth=recovery`

Für lokale Tests die entsprechenden URLs der tatsächlich gestarteten Vorschau erlauben. Keine pauschale Wildcard über fremde Domains freigeben.

Für öffentliche Registrierungen muss ein eigener SMTP-Absender konfiguriert und mit einem tatsächlichen Bestätigungs- und Resetversand getestet werden. Der eingebaute Supabase-Mailversand ist ein eingeschränkter Testdienst; das bloße Setzen der Projekt-URL garantiert keinen Mailversand an beliebige Nutzer. Ein Reset bestätigt nicht, ob eine E-Mail bereits registriert ist.

Die App bietet Registrierung, Bestätigung erneut senden mit Wartezeit, Anmeldung, Passwort vergessen und ein separates Formular für das neue Passwort nach einem gültigen Recovery-Link. Nicht bestätigte Konten erhalten kein öffentliches Profil und keine Elo.

## Google, Apple und Samsung

OAuth-Anmeldungen benutzen Supabase Auth; die App baut keinen eigenen Token-Austausch. Anbieter erst nach ihrer tatsächlichen Freischaltung aktivieren.

- **Google:** OAuth-Webanwendung in Google Cloud konfigurieren. Die von Supabase angezeigte Callback-Adresse als erlaubten Redirect eintragen. Client-ID und Secret ausschließlich in Supabase hinterlegen. Die App prüft die öffentlichen Auth-Einstellungen und aktiviert den Button erst bei eingeschaltetem Google-Anbieter.
- **Apple:** Einen eigenen Sign-in-with-Apple-Webdienst mit Services ID, erlaubter Domain und der Supabase-Callback-Adresse einrichten. Die erforderlichen Apple-Entwicklerdaten und das signierte Client-Secret in Supabase hinterlegen; das Ablaufdatum des Secrets beachten.
- **Samsung:** Im Samsung Account Developer Console eine eigene OAuth/OIDC-Webanwendung registrieren. In Supabase einen Custom OAuth/OIDC Provider mit der Kennung `custom:samsung` und den tatsächlich von Samsung vergebenen Daten einrichten. Die Callback-Adresse aus Supabase verwenden. Nach erfolgreichem Test auf Vercel `NEXT_PUBLIC_SAMSUNG_AUTH_ENABLED=true` setzen und neu bauen. Keine fremden Client-IDs, geratenen Endpunkte oder direkten Samsung-Passwortformulare verwenden.

Für diese Social-Anmeldungen versendet die App keine zusätzliche Bestätigungsmail. Der Anbieter und Supabase müssen die Identität und E-Mail bereits verifiziert haben. Die Freischaltung und Anbieter-Zugangsdaten lassen sich nicht aus einem bloß installierten Plugin ableiten.

## Öffentliche Elo

- Start bei **0 All-Time-Elo**. Die vorhandene adaptive Puzzle-Spielstärke mit Startwert 1.200 bleibt separat.
- **+1** pro erstmals vollständig gelöstem regulären Puzzle. Wiederholungen derselben Puzzle-ID und eigene Fehlerübungen erzeugen keine zusätzlichen öffentlichen Punkte.
- Botstufe `s`: **round(3 + (s − 1) × 17 / 19)** Punkte pro neu gewonnener Partie. Stufe 1 gibt 3, Stufe 20 gibt 20 Punkte. Niederlagen und Remis ziehen nichts ab.
- Mit einem bestätigten Konto werden neue Botpartien als Online-Ranglistenpartien gestartet. Der Server speichert die Zugfolge, erzeugt die Botzüge und wertet verifizierte Matt-Siege. Zugrücknahmen stehen im lokalen Gasttraining zur Verfügung.
- Puzzlelösungen werden gegen die ausgelieferten Aufgaben geprüft. Jeder verifizierte Erfolg wird über einen eindeutigen Datenbankschlüssel genau einmal verbucht. Wiederholte oder unterbrochene HTTP-Anfragen erzeugen keine doppelten Punkte.
- Ältere Gast-Backups und private Synchronisationsdatensätze werden nicht automatisch zu öffentlichen Punkten. Sie sind keine serververifizierten Ranglistenpartien.
- Die Rangliste zeigt nur Anzeigename, Avatar, Punkte, Puzzle- und Botsiegzahlen. E-Mail, Passwörter, Token, Notizen und private Partien werden nicht veröffentlicht.

## Profilbild und Einstellungen

JPG, PNG und WebP bis 8 MB werden im Browser mittig quadratisch auf 256 × 256 Pixel zugeschnitten und als WebP bis 150 KB neu kodiert. So werden keine ursprünglichen Fotometadaten hochgeladen. Pro Nutzer existiert genau der aktuelle Pfad `USER_ID/avatar.webp`; RLS verhindert fremde Uploads. Gastbilder bleiben lokal.

Nachtmodus, Sprache (Deutsch/English), Premoves, Live-Analyse, Animationen, Koordinaten, Kontrast und Ton werden im Profil gespeichert. Die helle Ansicht verwendet helle Flächen und dunkle Schrift. Animationen beachten die Systemeinstellung für reduzierte Bewegung. Premoves werden nach dem gegnerischen Zug erneut auf Legalität geprüft und können abgebrochen oder vollständig deaktiviert werden. Die Live-Bewertung erscheint erst nach dem eigenen Zug und lässt sich auch im laufenden Spiel ausschalten.

## Prüfung vor Freigabe

Die Tests verwenden die echten SQL-Migrationen in PostgreSQL/PGlite sowie den echten Stockfish-Prozess. Zusätzlich in der verbundenen Produktionsumgebung mit eigenen Testkonten prüfen: Bestätigungsmail → Anmeldung → Avatar → Puzzlepunkt → Botsieg → Rangliste → Abmeldung → Passwort-Reset → Anmeldung mit neuem Passwort. Anschließend alle drei tatsächlich freigeschalteten OAuth-Anbieter einzeln testen. Ohne Anbieter-Zugangsdaten oder SMTP ist diese Live-Prüfung nicht abgeschlossen.

Offizielle Referenzen: [Supabase Passwort-Auth](https://supabase.com/docs/guides/auth/passwords), [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple), [Custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Samsung Account Developer Console](https://developer.account.samsung.com/).
