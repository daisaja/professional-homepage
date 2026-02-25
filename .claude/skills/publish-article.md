# publish-article

Vollautomatische Artikel-Pipeline: liest ein Google-Doc, schreibt einen zweisprachigen (DE/EN) Artikel in Lars's Stil, generiert Bilder via Imagen, und published auf lars-gentsch.de.

## Aufruf

`/publish-article "Google Doc Name"`

## Voraussetzungen prüfen

Bevor du beginnst, verifiziere:
1. `GOOGLE_API_KEY` ist gesetzt — `echo $GOOGLE_API_KEY` (muss einen Wert haben)
2. `GEMINI_API_KEY` ist gesetzt — `echo $GEMINI_API_KEY` (muss einen Wert haben)
3. `scripts/credentials.json` existiert — sonst Nutzer auf `scripts/README.md` verweisen
4. Working directory ist das Repo: `/Users/lars/Projects/privat/professional-homepage/professional-homepage/`

## Schritt 1: Slug und Pfade ableiten

```bash
SLUG=$(node scripts/slugify.js "DOKUMENTNAME")
echo "Slug: $SLUG"
```

Definiere folgende Pfade (nutze $SLUG):
- DE-Artikel: `src/content/blog/de/$SLUG.md`
- EN-Artikel: `src/content/blog/en/$SLUG.md`
- Bild-Verzeichnis: `public/blog/$SLUG/`

## Schritt 2: Google Doc lesen

```bash
DOC_JSON=$(node scripts/gdoc-read.js "DOKUMENTNAME")
```

Extrahiere `title` und `text` aus dem JSON. Bei Fehler: Fehlermeldung ausgeben und Abbruch.

## Schritt 3: Stil-Guide prüfen / erstellen

**Falls `docs/writing-style.md` existiert:** Laden und weiter zu Schritt 4.

**Falls nicht vorhanden:**
- Nutzer fragen: "Welche Google-Docs sollen als Stil-Referenz dienen? (1-3 Dokumentnamen eingeben)"
- Für jeden genannten Namen: `node scripts/gdoc-read.js "Name"` aufrufen
- Alle Texte an einen **Style-Analyzer-Subagenten** übergeben mit diesem Task:

  > "Lies die folgenden Texte von Lars Gentsch und destilliere eine präzise Stil-Zusammenfassung.
  > Analysiere: Ton, Satzbau, typische Muster, Humor, Sprache, Struktur.
  > Gib das Ergebnis als `docs/writing-style.md` im folgenden Format aus:
  > ```
  > # Lars Gentsch — Writing Style Guide
  > ## Ton
  > ## Satzbau
  > ## Typische Muster
  > ## Sprache
  > ## Struktur
  > ```
  > Sei konkret mit Beispielen. Keine generischen Beschreibungen."

- Ergebnis in `docs/writing-style.md` speichern und committen:
  ```bash
  git add docs/writing-style.md
  git commit -m "docs: add writing style guide from Lars's reference texts"
  ```

## Schritt 4: DE-Artikel schreiben (Writer Subagent)

Dispatche einen **Writer-Subagenten** mit diesem Task:

> "Du schreibst einen Blog-Artikel für Lars Gentsch.
>
> **Rohtext aus Google Doc:**
> [ROHTEXT EINFÜGEN]
>
> **Stil-Guide:**
> [INHALT VON docs/writing-style.md EINFÜGEN]
>
> **Aufgabe:**
> Schreibe einen vollständigen, fertigen Artikel auf Deutsch.
> - Übernimm die Kernidee und Fakten aus dem Rohtext
> - Schreibe strikt im Stil des Stil-Guides
> - Kein Frontmatter, nur der Artikel-Body in Markdown
> - Länge: 1200-2000 Wörter
> - Artikel soll mit einem starken, persönlichen Einstieg beginnen
> - Abschnittsüberschriften (##), Code-Blöcke wo passend
>
> Gib NUR den Markdown-Text aus, nichts anderes."

Speichere das Ergebnis als Variable `DE_DRAFT`.

## Schritt 5: Style Review (Style Reviewer Subagent)

Dispatche einen **Style-Reviewer-Subagenten** mit diesem Task:

> "Du reviewst einen Artikel auf Übereinstimmung mit Lars Gentschs Schreibstil.
>
> **Artikel:**
> [DE_DRAFT EINFÜGEN]
>
> **Stil-Guide:**
> [INHALT VON docs/writing-style.md EINFÜGEN]
>
> **Aufgabe:**
> Gib konkretes, spezifisches Feedback:
> - Welche Sätze klingen nicht nach Lars? (zitiere sie)
> - Wo fehlt Selbstironie oder persönliche Note?
> - Wo ist der Ton zu formell / zu trocken?
> - Was sollte umgeschrieben werden? (mit Vorschlag)
> Maximal 5 konkrete Punkte. Keine generischen Lobs."

Übergib das Feedback an den **Writer-Subagenten** für eine Überarbeitung:

> "Überarbeite den folgenden Artikel basierend auf dem Style-Feedback.
>
> **Artikel:**
> [DE_DRAFT EINFÜGEN]
>
> **Feedback:**
> [REVIEWER_FEEDBACK EINFÜGEN]
>
> Gib den überarbeiteten Artikel aus. Nur Markdown, kein Frontmatter."

Speichere das Ergebnis als `DE_FINAL`.

## Schritt 6: EN-Übersetzung (Translator Subagent)

Dispatche einen **Translator-Subagenten** mit diesem Task:

> "Übersetze den folgenden deutschen Artikel ins Englische.
>
> **Artikel:**
> [DE_FINAL EINFÜGEN]
>
> **Wichtig:**
> - Ton und Persönlichkeit beibehalten: selbstironisch, direkt, humorvoll
> - Nicht steif oder akademisch übersetzen
> - Deutsche Redewendungen sinngemäß ins Englische übertragen
> - Kurze Sätze bleiben kurze Sätze
>
> Gib nur den übersetzten Markdown-Text aus, kein Frontmatter."

Speichere das Ergebnis als `EN_FINAL`.

## Schritt 7: Bild-Konzepte entwickeln (Image Ideator Subagent)

Dispatche einen **Image-Ideator-Subagenten** mit diesem Task:

> "Entwickle 2-3 Bild-Konzepte für folgenden Artikel.
>
> **Artikel:**
> [DE_FINAL EINFÜGEN]
>
> **Format — für jedes Konzept:**
> ```
> KONZEPT 1:
> prompt: [Imagen-Prompt auf Englisch, konkret und visuell beschreibend, 1-2 Sätze]
> hasText: true/false  [true wenn Bild Beschriftungen/Text enthalten soll]
> altDe: [Alt-Text auf Deutsch]
> altEn: [Alt-Text auf Englisch]
> ```
>
> Prompts sollen: visuell konkret sein, zum Artikel passen, konsistenten Stil haben (digital art / illustration).
> Bei hasText: true — prompt zweimal angeben: einmal mit deutschen, einmal mit englischen Beschriftungen."

## Schritt 8: Bilder generieren (Generator + Critic Loop)

Für jedes Konzept aus Schritt 7:

**8a. Bild generieren:**
```bash
node scripts/imagen-generate.js "PROMPT" "public/blog/$SLUG/image-N.png"
# Bei hasText: true, zweimal:
node scripts/imagen-generate.js "PROMPT_DE" "public/blog/$SLUG/image-N-de.png"
node scripts/imagen-generate.js "PROMPT_EN" "public/blog/$SLUG/image-N-en.png"
```

**8b. Critic Review (max. 3 Iterationen):**

Dispatche einen **Image-Critic-Subagenten** mit Zugang zum generierten Bild:

> "Bewerte dieses Bild für einen Tech-Blog-Artikel von Lars Gentsch.
>
> **Artikel-Kontext:** [Kurzzusammenfassung des Artikels]
> **Intendiertes Konzept:** [PROMPT]
> **Bild:** [Pfad zum Bild — verwende das Read-Tool um es anzusehen]
>
> Bewerte (1-10):
> - Relevanz zum Artikel
> - Visuelle Qualität
> - Stil-Konsistenz
>
> Falls Score < 7: Gib einen verbesserten Prompt aus.
> Falls Score >= 7: Gib 'AKZEPTIERT' aus."

Bei verbessertem Prompt: erneut generieren. Max. 3 Iterationen total.

## Schritt 9: Artikel-Dateien erstellen

**9a. Frontmatter vorbereiten:**
- `title`: Aus dem Artikel (erste H1 oder aus Doc-Titel ableiten)
- `description`: Ein-Satz-Zusammenfassung (aus Artikel destillieren)
- `pubDate`: Heutiges Datum (`date +%Y-%m-%d`)

**9b. DE-Artikel speichern:**

```
src/content/blog/de/$SLUG.md
```

Inhalt:
```markdown
---
title: "[TITEL]"
description: "[BESCHREIBUNG]"
pubDate: YYYY-MM-DD
---

[DE_FINAL]

[BILDER EINBETTEN — siehe 9c]
```

**9c. EN-Artikel speichern:**

```
src/content/blog/en/$SLUG.md
```

Gleiche Struktur mit EN-Frontmatter und `EN_FINAL`.

**9d. Bilder einbetten:**

Füge Bilder an passenden Stellen im Artikel ein (nach dem ersten Abschnitt, in der Mitte, am Ende):
```markdown
![ALT_TEXT](/blog/SLUG/image-N.png)
```
Bei sprachspezifischen Bildern: DE-Artikel bekommt `-de.png`, EN-Artikel bekommt `-en.png`.

## Schritt 10: Commit und Deploy

```bash
git add src/content/blog/ public/blog/ linkedin-posts/
git commit -m "feat: publish article '$SLUG'"
git push
```

GitHub Actions deployt automatisch auf lars-gentsch.de.

## Schritt 11: LinkedIn-Post erstellen (LinkedIn-Texter Subagent)

**11a. Titelbild auswählen:**

Prüfe folgende Pfade in dieser Reihenfolge und nimm den ersten, der existiert:
1. `public/blog/$SLUG/image-1-en.png`
2. `public/blog/$SLUG/image-1.png`

Speichere den gefundenen Pfad als `LINKEDIN_IMAGE` (oder leer wenn keiner existiert).

**11b. EN-Post generieren:**

Dispatche einen **LinkedIn-Texter-Subagenten** mit diesem Task:

> "Schreibe einen LinkedIn-Post auf Englisch für Lars Gentsch.
>
> **Artikel:**
> [EN_FINAL EINFÜGEN]
>
> **Link:** https://lars-gentsch.de/en/blog/$SLUG
>
> **Format:**
> - Erster Satz: starker Hook — neugierig machend, keine Clickbait-Plattitüden
> - 3-4 kurze Sätze Kernaussage (keine Bullet-Listen — LinkedIn rendert sie schlecht)
> - Abschluss: persönliche Einladung zum Lesen + Link
> - 3-5 relevante Hashtags am Ende
> - Ton: selbstironisch, direkt, wie Lars schreibt — nicht corporate
> - Länge: max. 1300 Zeichen (LinkedIn-Limit für Preview)
>
> Gib NUR den Post-Text aus, nichts anderes."

Speichere das Ergebnis als `EN_POST`.

**11c. LinkedIn-Post-Datei erstellen:**

Erstelle `linkedin-posts/$SLUG.md` mit folgendem Inhalt:

```markdown
---
slug: $SLUG
image: $LINKEDIN_IMAGE
en_url: https://lars-gentsch.de/en/blog/$SLUG
published: false
published_at: ~
linkedin_post_id: ~
---

$EN_POST
```

(Falls kein Bild gefunden: `image: ~`)

**Ausgabe nach Abschluss:**
```
✅ Artikel veröffentlicht!
DE: https://lars-gentsch.de/de/blog/$SLUG
EN: https://lars-gentsch.de/en/blog/$SLUG

LinkedIn-Post bereit: linkedin-posts/$SLUG.md
Zum Veröffentlichen: GitHub Actions → "Publish to LinkedIn" → slug: $SLUG
```
