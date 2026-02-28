# Professional Homepage - Lars Gentsch

Professionelle Homepage für Lars Gentsch, gehostet unter [lars-gentsch.de](https://lars-gentsch.de).

## Technologien

- **Astro** - Modernes Web-Framework für statische Seiten
- **Tailwind CSS v4** - Utility-first CSS Framework
- **TypeScript** - Type-safe development

## Entwicklung

### Voraussetzungen

- Node.js 20 oder höher
- npm

### Installation

```bash
npm install
```

### Development Server starten

```bash
npm run dev
```

Der Development Server läuft unter `http://localhost:4321`

### Build für Production

```bash
npm run build
```

Die statischen Dateien werden im `dist/` Verzeichnis generiert.

### Preview der Production Build

```bash
npm run preview
```

## Deployment

Deployment läuft automatisch via GitHub Actions bei jedem Push auf `main`:

1. Node.js 20 wird aufgesetzt
2. `npm ci` + `npm run build`
3. `dist/` wird per **rsync über SSH** auf den Strato-Server synchronisiert

Benötigte GitHub Secrets:
- `FTP_HOST` — SSH-Host des Strato-Servers
- `FTP_USERNAME` — SSH-Benutzername
- `FTP_PASSWORD` — SSH-Passwort

## Projektstruktur

```
/
├── public/                 # Statische Assets (favicon, Bilder)
│   └── blog/               # Blog-Artikel-Bilder (je Slug ein Ordner)
├── src/
│   ├── content/
│   │   └── blog/
│   │       ├── de/         # Deutsche Artikel (.md)
│   │       └── en/         # Englische Artikel (.md)
│   ├── layouts/            # Astro-Layouts
│   ├── pages/              # Seiten (index.astro, Blog-Routen)
│   └── styles/             # CSS-Dateien
├── scripts/                # Node-Skripte (Blog-Pipeline)
├── linkedin-posts/         # LinkedIn-Post-Entwürfe
├── docs/                   # Dokumentation & Schreibstil-Guide
├── .github/workflows/      # GitHub Actions (deploy, LinkedIn)
├── astro.config.mjs
└── package.json
```

## Inhalt aktualisieren

Blog-Artikel liegen als Markdown-Dateien in `src/content/blog/de/` und `src/content/blog/en/`. Neue Artikel werden über die Artikel-Pipeline erstellt (siehe `docs/`).

Die Hauptseite liegt in `src/pages/index.astro`.

## Links

- GitHub Repository: [https://github.com/daisaja/professional-homepage](https://github.com/daisaja/professional-homepage)
- LinkedIn: [https://de.linkedin.com/in/lars-gentsch-0854a48b](https://de.linkedin.com/in/lars-gentsch-0854a48b)
- Goodreads: [https://www.goodreads.com/user/show/65778884-lars-gentsch](https://www.goodreads.com/user/show/65778884-lars-gentsch)

## Lizenz

© 2026 Lars Gentsch. Alle Rechte vorbehalten.
