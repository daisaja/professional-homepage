# Article Publication Pipeline — Design

**Datum:** 2026-02-25
**Status:** Genehmigt

---

## Ziel

Ein Claude Code Skill `/publish-article "Google Doc Name"` der vollautomatisch:
1. Eine Artikel-Idee aus Google Drive liest
2. Einen zweisprachigen (DE/EN) Artikel im persönlichen Schreibstil verfasst
3. Passende Bilder via Google Imagen generiert und per Critic-Loop verfeinert
4. Alles ins Repo committed und auf lars-gentsch.de deployt

---

## Gesamtfluss

```
/publish-article "Dokument-Name"
        ↓
[Reader] Google Doc lesen → Rohtext + Slug
        ↓
[Style] docs/writing-style.md prüfen
        → fehlt: Stil-Referenz-Docs aus Drive lesen → Stil-Guide generieren → speichern
        → vorhanden: direkt laden
        ↓
[Writer] Rohtext + Stil-Guide → fertiger DE-Artikel
        ↓
[Style Reviewer] DE-Artikel vs. Stil-Guide → konkretes Feedback
        ↓
[Writer] Überarbeitung (1 Iteration)
        ↓
[Translator] DE-Artikel → EN-Artikel (Ton + Stil beibehalten)
        ↓
[Image Ideator] Artikel → 2-3 Bild-Konzepte
                          → je Konzept: braucht Text im Bild? (ja/nein)
        ↓
[Generator + Critic] Pro Konzept, max. 3 Iterationen:
        Imagen API → Bild → Critic bewertet → verbesserter Prompt → ...
        Falls Text im Bild: DE-Version + EN-Version separat generieren
        ↓
[Publisher] Dateien speichern → git commit + push → Auto-Deploy
```

---

## Abschnitt 1: Google Drive Integration

**API:** Google Docs REST API (kein MCP-Server)

**Voraussetzungen (einmalig):**
- Google Cloud Projekt → "Google Docs API" + "Google Drive API" aktivieren
- API-Key erstellen (eingeschränkt auf diese APIs)
- `GOOGLE_API_KEY` als Umgebungsvariable setzen

**Doc-Lookup:**
```bash
# 1. Doc-ID per Namen finden
curl "https://www.googleapis.com/drive/v3/files?q=name='Dokument-Name'&key=$GOOGLE_API_KEY"

# 2. Inhalt lesen
curl "https://docs.googleapis.com/v1/documents/{docId}?key=$GOOGLE_API_KEY"
```

**Slug-Generierung:** Automatisch aus Dokumentname
- `"OpenClaw auf NAS"` → `openclaw-auf-nas`
- Lowercase, Umlaute ersetzen (ä→ae, ö→oe, ü→ue, ß→ss), Leerzeichen → `-`

---

## Abschnitt 2: Stil-Guide

**Datei:** `docs/writing-style.md`

**Initialisierung (nur beim ersten Aufruf oder wenn Datei fehlt):**
- Skill fragt: *"Welche Google-Docs soll ich als Stil-Referenz lesen? (1-3 Namen)"*
- Liest diese Dokumente via Google Docs API
- Style-Analyzer-Subagent destilliert Stil-Charakteristika
- Speichert in `docs/writing-style.md`

**Inhalt (Beispiel):**
```markdown
# Lars Gentsch — Writing Style Guide

## Ton
- Selbstironisch, ehrlich über Rückschläge und Frustration
- Technisch präzise aber nie trocken oder akademisch
- Triumphierend am Ende — der Kampf lohnt sich immer

## Satzbau
- Kurze Sätze für Punch: "Root im Container. Nicht elegant. Funktioniert."
- Rhetorische Fragen als Spannungsaufbau
- Parenthesen für Selbstkommentare: "(Warum habe ich das nicht früher gemacht?)"

## Struktur
- Problem → gescheiterter Versuch (mehrfach) → Detektivarbeit → Lösung
- Konkretes Scheitern benennen, nicht beschönigen
- Am Ende: Was habe ich gelernt? Warum war es es wert?

## Sprache
- Direkte Ansprache: "Macht es. Aktiviert SSH von Anfang an."
- Fachbegriffe werden erklärt, aber nicht übermäßig
- Humor durch Kontrast (aufgeblasene Erwartung vs. nüchterne Realität)
```

**Wiederverwendung:** Bei jedem weiteren `/publish-article` Aufruf wird `docs/writing-style.md` direkt geladen — kein erneutes Drive-Lesen.

---

## Abschnitt 3: Writer & Style Reviewer

**Writer Agent:**
- Input: Rohtext aus Google Doc + `docs/writing-style.md`
- Output: Fertiger DE-Artikel als Markdown (ohne Frontmatter)
- Anweisung: Stil-Guide strikt befolgen, Rohtext als Ideenquelle nicht als Vorlage

**Style Reviewer Agent:**
- Input: DE-Artikel + `docs/writing-style.md`
- Output: Konkretes Feedback (keine generischen Lobs)
  - Welche Sätze klingen nicht wie Lars?
  - Wo fehlt Selbstironie / Humor?
  - Wo ist der Ton zu formell / zu locker?
- Eine Review-Runde, dann überarbeitet der Writer

**Translator Agent:**
- Input: Überarbeiteter DE-Artikel
- Output: EN-Artikel
- Anweisung: Ton und Persönlichkeit beibehalten, nicht steif übersetzen

---

## Abschnitt 4: Bildgenerierung

**Image Ideator Agent:**
- Input: Fertiger DE-Artikel
- Output: 2-3 Bild-Konzepte, je mit:
  - Imagen-Prompt (EN, da Imagen EN-Prompts bevorzugt)
  - Flag: `hasText: true/false` (enthält das Bild Text/Beschriftungen?)

**Generator + Critic Loop (pro Konzept, max. 3 Iterationen):**

```
Imagen API aufrufen
      ↓
Critic Agent: Relevanz zum Artikel? Qualität? Stil-Konsistenz?
      → ✅ akzeptiert | ❌ verbesserter Prompt
      ↓
Falls ❌: erneut generieren (max. 3×)
```

**Zweisprachige Bilder:**
- `hasText: false` → ein Bild, in DE + EN Artikel verwendet
- `hasText: true` → zwei Generierungen mit angepasstem Prompt
  - DE-Prompt: gleicher Inhalt, deutsche Beschriftungen
  - EN-Prompt: gleicher Inhalt, englische Beschriftungen

**Imagen API:**
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instances":[{"prompt":"..."}],"parameters":{"sampleCount":1}}'
```

**Voraussetzung:** `GEMINI_API_KEY` als Umgebungsvariable

---

## Abschnitt 5: Dateistruktur & Publishing

**Gespeicherte Dateien (Beispiel Slug `openclaw-auf-nas`):**

```
src/content/blog/
  de/openclaw-auf-nas.md
  en/openclaw-auf-nas.md

public/blog/
  openclaw-auf-nas/
    image-1.png              ← sprachneutral
    image-2-de.png           ← mit deutschem Text
    image-2-en.png           ← mit englischem Text
    image-3.png              ← sprachneutral
```

**Frontmatter (automatisch generiert):**
```yaml
---
title: "..."
description: "Ein-Satz-Zusammenfassung"
pubDate: YYYY-MM-DD
---
```

**Bilder im Artikel eingebettet:**
```markdown
![Beschreibung](/blog/openclaw-auf-nas/image-1.png)
```

**Abschluss:**
```bash
git add src/content/blog/ public/blog/
git commit -m "feat: publish article 'openclaw-auf-nas'"
git push   # → GitHub Actions → Auto-Deploy lars-gentsch.de
```

---

## Skill-Datei

**Pfad:** `.claude/skills/publish-article.md`

**Aufruf:** `/publish-article "Dokumentname in Google Drive"`

**Abhängigkeiten:**
| Variable | Zweck |
|----------|-------|
| `GOOGLE_API_KEY` | Google Docs/Drive API |
| `GEMINI_API_KEY` | Imagen Bildgenerierung |

---

## Nicht im Scope

- Automatische Erkennung neuer Docs (kein Polling/Webhook)
- Mehrsprachigkeit über DE/EN hinaus
- Video- oder Audio-Content
- Kommentarfunktion / Social Sharing
- SEO-Optimierung (Meta-Tags, sitemap) — separates Thema
