# Design: Zweisprachiger Blog — lars-gentsch.de

**Datum:** 2026-02-25
**Status:** Genehmigt

---

## Ziel

Einen zweisprachigen (DE/EN) Blog zur bestehenden Astro-Portfolio-Site hinzufügen. Artikel werden als Markdown-Dateien im Repository verwaltet. Die Homepage bleibt unverändert.

---

## 1. Content-Struktur

Artikel als Astro Content Collections mit Zod-Schema-Validierung:

```
src/content/
  config.ts              ← Zod-Schema für Blog-Collection
  blog/
    de/
      openclaw-synology.md
    en/
      openclaw-synology.md
```

**Frontmatter-Schema:**
```yaml
---
title: string
description: string
pubDate: date
slug: string
---
```

---

## 2. Routing & Seiten

Dateibasiertes Routing, kein Astro i18n-Config-Overhead. Homepage bleibt auf `/`.

```
src/pages/
  de/blog/
    index.astro          → /de/blog/
    [slug].astro         → /de/blog/<slug>
  en/blog/
    index.astro          → /en/blog/
    [slug].astro         → /en/blog/<slug>

src/layouts/
  BlogLayout.astro       ← gemeinsames Layout für beide Sprachen
```

- **Blog-Listing**: Artikel als Karten (Titel, Datum, Beschreibung, Link)
- **Artikel-Seite**: Vollständiges Markdown-Rendering mit Syntax-Highlighting (Shiki, eingebaut)

---

## 3. Navigation & Sprachumschalter

**Hauptnavigation** (`src/pages/index.astro`):
```
About | Expertise | Reading | Blog | Contact
```
"Blog" verlinkt auf `/de/blog/`.

**Blog-Header** (in `BlogLayout.astro`):
- Link zurück zur Homepage
- Sprachumschalter `DE | EN` — wechselt zum selben Artikel/Listing in der anderen Sprache

---

## 4. Styling

- Tailwind CSS (bestehendes Setup) — gleiche Farben und Typografie wie Homepage
- `@tailwindcss/typography` (neu) für Prose-Styling im Artikel-Body
- Shiki Syntax-Highlighting für Code-Blöcke (Astro built-in, kein Extra-Paket)

---

## 5. Erster Artikel

| Datei | Inhalt |
|-------|--------|
| `src/content/blog/de/openclaw-synology.md` | Bestehender DE-Artikel aus `BLOG-ARTIKEL.md` |
| `src/content/blog/en/openclaw-synology.md` | Englische Übersetzung (wird im Zuge der Implementierung erstellt) |

---

## 6. Änderungsübersicht

| Typ | Datei/Ordner | Änderung |
|-----|-------------|----------|
| Neu | `src/content/config.ts` | Zod-Schema für Blog-Collection |
| Neu | `src/content/blog/de/*.md` | Deutsche Artikel |
| Neu | `src/content/blog/en/*.md` | Englische Artikel |
| Neu | `src/layouts/BlogLayout.astro` | Gemeinsames Blog-Layout |
| Neu | `src/pages/de/blog/index.astro` | DE Blog-Listing |
| Neu | `src/pages/de/blog/[slug].astro` | DE Artikel-Seite |
| Neu | `src/pages/en/blog/index.astro` | EN Blog-Listing |
| Neu | `src/pages/en/blog/[slug].astro` | EN Artikel-Seite |
| Geändert | `src/pages/index.astro` | "Blog"-Link in Navigation |
| Geändert | `package.json` | `@tailwindcss/typography` hinzufügen |

---

## Nicht im Scope

- Volles Site-i18n (Homepage bleibt einsprachig Deutsch)
- Kommentarfunktion
- RSS-Feed
- Suche
- Tags/Kategorien
