# Article Publication Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/publish-article "Doc Name"` Claude Code skill that reads a Google Doc, writes a bilingual DE/EN article in Lars's style, generates Imagen images, and publishes to lars-gentsch.de automatically.

**Architecture:** A project-local Claude Code skill (`.claude/skills/publish-article.md`) orchestrates subagents via the Task tool. Two Node.js helper scripts handle external API calls (Google Docs OAuth2, Imagen REST). The style guide is generated once from the user's own writing and cached in `docs/writing-style.md`.

**Tech Stack:** Node.js (ESM), `googleapis` npm package (Google Docs/Drive OAuth2), Gemini REST API (Imagen 3), Bash, Claude Code skill system

**Repo:** `/Users/lars/Projects/privat/professional-homepage/professional-homepage/`

---

### Task 1: Install googleapis and create scripts directory

**Files:**
- Modify: `package.json`
- Create: `scripts/` directory

**Step 1: Install googleapis**

```bash
cd /Users/lars/Projects/privat/professional-homepage/professional-homepage
npm install googleapis
```

Expected: `googleapis` appears in `package.json` dependencies.

**Step 2: Create scripts directory**

```bash
mkdir -p scripts
```

**Step 3: Add scripts to .gitignore exceptions**

Append to `.gitignore` (check existing content first):
- `scripts/token.json` should be ignored (OAuth token cache)
- `scripts/credentials.json` should be ignored (OAuth client secrets)

Add these two lines to `.gitignore`:
```
scripts/token.json
scripts/credentials.json
```

**Step 4: Verify build still works**

```bash
npm run build
```

Expected: 5 pages built, no errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "feat: add googleapis dependency for Google Docs integration"
```

---

### Task 2: Google Docs reader script

**Files:**
- Create: `scripts/gdoc-read.js`

**Context:** Google Docs API requires OAuth2 for private documents (a simple API key only works for public docs). This script handles OAuth2 with a one-time browser flow. Credentials are cached in `scripts/token.json`.

**Step 1: Create the script**

```javascript
// scripts/gdoc-read.js
// Usage: node scripts/gdoc-read.js "My Document Name"
// First run: opens browser for Google OAuth2 authentication
// Subsequent runs: uses cached token from scripts/token.json

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
];

function extractText(doc) {
  const content = doc.body?.content ?? [];
  return content
    .flatMap(el => el.paragraph?.elements ?? [])
    .map(el => el.textRun?.content ?? '')
    .join('')
    .trim();
}

async function getAuthClient() {
  const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = creds.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, 'utf8')));
    return oAuth2Client;
  }

  // One-time OAuth flow
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.error('Bitte diesen Link im Browser öffnen:', authUrl);

  const code = await new Promise((resolve) => {
    const server = createServer((req, res) => {
      const qs = new URL(req.url, 'http://localhost:3000').searchParams;
      res.end('Authentifizierung erfolgreich. Du kannst dieses Fenster schließen.');
      server.close();
      resolve(qs.get('code'));
    }).listen(3000);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.error('Token gespeichert in', TOKEN_PATH);
  return oAuth2Client;
}

async function main() {
  const docName = process.argv[2];
  if (!docName) {
    console.error('Usage: node scripts/gdoc-read.js "Document Name"');
    process.exit(1);
  }

  const auth = await getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  // Find document by name
  const searchResult = await drive.files.list({
    q: `name='${docName}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 5,
  });

  const files = searchResult.data.files;
  if (!files || files.length === 0) {
    console.error(`Kein Dokument gefunden: "${docName}"`);
    process.exit(1);
  }

  const docId = files[0].id;
  const doc = await docs.documents.get({ documentId: docId });
  const text = extractText(doc.data);

  // Output: JSON with title and text
  console.log(JSON.stringify({ title: doc.data.title, text }));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
```

**Step 2: Verify script syntax**

```bash
node --input-type=module < scripts/gdoc-read.js 2>&1 | head -5
```

Expected: Shows usage error (no doc name provided) — proves it parses correctly:
```
Usage: node scripts/gdoc-read.js "Document Name"
```

Actually run:
```bash
node scripts/gdoc-read.js 2>&1
```
Expected output: `Usage: node scripts/gdoc-read.js "Document Name"`

**Step 3: Document setup instructions**

Create `scripts/README.md`:

```markdown
# Scripts Setup

## Einmalige Einrichtung: Google Docs API

1. Google Cloud Console öffnen: https://console.cloud.google.com
2. Projekt erstellen oder auswählen
3. APIs aktivieren:
   - "Google Docs API" suchen → aktivieren
   - "Google Drive API" suchen → aktivieren
4. Credentials → "OAuth 2.0 Client ID erstellen"
   - Application type: "Desktop app"
   - Name: "professional-homepage"
5. JSON herunterladen → als `scripts/credentials.json` speichern
6. Ersten Lauf starten: `node scripts/gdoc-read.js "Test"`
   → Browser öffnet sich → Google-Account auswählen → Zugriff erlauben
   → Token wird in `scripts/token.json` gecacht

## Imagen API

Gemini API Key benötigt:
1. https://aistudio.google.com/apikey → API Key erstellen
2. Als Umgebungsvariable setzen: `export GEMINI_API_KEY="your-key"`
   (in ~/.zshrc für dauerhaften Zugang)
```

**Step 4: Commit**

```bash
git add scripts/gdoc-read.js scripts/README.md
git commit -m "feat: add Google Docs OAuth2 reader script"
```

---

### Task 3: Imagen image generator script

**Files:**
- Create: `scripts/imagen-generate.js`

**Context:** Calls the Gemini API's Imagen 3 endpoint. Returns base64-encoded PNG which is decoded and saved to disk. Reads `GEMINI_API_KEY` from environment.

**Step 1: Create the script**

```javascript
// scripts/imagen-generate.js
// Usage: node scripts/imagen-generate.js "prompt text" "output/path/image.png"
// Requires: GEMINI_API_KEY environment variable

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`;

async function generateImage(prompt, outputPath) {
  const response = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Imagen API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Keine Bilddaten in der API-Antwort');

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  console.log(`Bild gespeichert: ${outputPath}`);
}

async function main() {
  const [prompt, outputPath] = process.argv.slice(2);
  if (!prompt || !outputPath) {
    console.error('Usage: node scripts/imagen-generate.js "prompt" "output/path.png"');
    process.exit(1);
  }
  if (!API_KEY) {
    console.error('GEMINI_API_KEY nicht gesetzt. Export: export GEMINI_API_KEY="your-key"');
    process.exit(1);
  }
  await generateImage(prompt, outputPath);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
```

**Step 2: Verify script syntax**

```bash
node scripts/imagen-generate.js 2>&1
```

Expected: `Usage: node scripts/imagen-generate.js "prompt" "output/path.png"`

**Step 3: Commit**

```bash
git add scripts/imagen-generate.js
git commit -m "feat: add Imagen 3 image generation script"
```

---

### Task 4: Slug utility and directory scaffold

**Files:**
- Create: `scripts/slugify.js`

**Context:** Converts a German or English document name to a URL-safe slug. Used by the skill to derive file paths from the Google Doc name.

**Step 1: Create the utility**

```javascript
// scripts/slugify.js
// Usage: node scripts/slugify.js "OpenClaw auf dem NAS"
// Output: openclaw-auf-dem-nas

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// CLI usage
if (process.argv[2]) {
  console.log(slugify(process.argv[2]));
}
```

**Step 2: Verify**

```bash
node scripts/slugify.js "OpenClaw auf dem NAS — Eine Odyssee"
```

Expected: `openclaw-auf-dem-nas-eine-odyssee`

```bash
node scripts/slugify.js "Why I Mentor"
```

Expected: `why-i-mentor`

**Step 3: Commit**

```bash
git add scripts/slugify.js
git commit -m "feat: add slugify utility for document name → URL conversion"
```

---

### Task 5: The publish-article skill file

**Files:**
- Create: `.claude/skills/publish-article.md`

**Context:** This is the main Claude Code skill. It contains instructions that Claude follows when the user invokes `/publish-article "Doc Name"`. It orchestrates all subagents and helper scripts.

**Step 1: Create .claude/skills directory**

```bash
mkdir -p .claude/skills
```

**Step 2: Create the skill file**

```markdown
<!-- .claude/skills/publish-article.md -->
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
git add src/content/blog/ public/blog/
git commit -m "feat: publish article '$SLUG'"
git push
```

GitHub Actions deployt automatisch auf lars-gentsch.de.

**Ausgabe nach Abschluss:**
```
✅ Artikel veröffentlicht!
DE: https://lars-gentsch.de/de/blog/$SLUG
EN: https://lars-gentsch.de/en/blog/$SLUG
```
```

**Step 3: Verify skill file was created**

```bash
ls -la .claude/skills/
```

Expected: `publish-article.md` sichtbar.

**Step 4: Commit**

```bash
git add .claude/skills/publish-article.md
git commit -m "feat: add publish-article skill for automated blog pipeline"
```

---

### Task 6: Smoke test — Trockenlauf mit echtem Dokument

**Context:** Verifiziert dass alle Komponenten zusammenspielen. Erfordert echte API-Credentials.

**Step 1: Credentials prüfen**

```bash
echo "Google credentials: $(ls scripts/credentials.json 2>/dev/null && echo OK || echo FEHLT)"
echo "GEMINI_API_KEY: $([ -n "$GEMINI_API_KEY" ] && echo OK || echo FEHLT)"
```

Expected: Beides OK. Falls nicht: `scripts/README.md` folgen.

**Step 2: gdoc-read testen**

```bash
node scripts/gdoc-read.js "DEIN_TESTDOKUMENT_NAME" | head -c 200
```

Expected: JSON mit `title` und `text` Feldern.

**Step 3: Slugify testen**

```bash
node scripts/slugify.js "DEIN_TESTDOKUMENT_NAME"
```

Expected: Valider kebab-case Slug.

**Step 4: Imagen testen (kleiner Test)**

```bash
node scripts/imagen-generate.js "A simple blue circle on white background" "/tmp/test-image.png" && echo "Bild generiert: $(ls -lh /tmp/test-image.png)"
```

Expected: PNG-Datei ~ 100-500KB.

**Step 5: Ersten echten Artikel-Lauf starten**

```bash
# Im professional-homepage Verzeichnis:
/publish-article "DEIN_ERSTEN_ARTIKEL_DOC_NAME"
```

Beobachte: Skill liest Doc → fragt nach Stil-Referenzen (falls erster Lauf) → schreibt Artikel → generiert Bilder → committed und pusht.

**Step 6: Deployment prüfen**

Nach ~2 Minuten (GitHub Actions Deploy):
- `https://lars-gentsch.de/de/blog/SLUG` aufrufen
- `https://lars-gentsch.de/en/blog/SLUG` aufrufen

Expected: Artikel live, Bilder geladen, Sprachumschalter funktioniert.
