# Professional Homepage - Lars Gentsch

Professionelle Homepage für Lars Gentsch, gehostet unter [lars-gentsch.de](https://lars-gentsch.de).

## Technologien

- **Astro** - Modernes Web-Framework für statische Seiten
- **Tailwind CSS v4** - Utility-first CSS Framework
- **TypeScript** - Type-safe development

## Entwicklung

### Voraussetzungen

- Node.js 18 oder höher
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

## Deployment auf Strato

### Schritt 1: Production Build erstellen

```bash
npm run build
```

Dies erstellt alle statischen Dateien im `dist/` Verzeichnis.

### Schritt 2: Dateien hochladen

1. Verbinden Sie sich via FTP/SFTP mit Ihrem Strato-Server:
   - Host: Ihre Strato FTP-Adresse (z.B. `ftp.strato.de` oder `ssh.strato.de`)
   - Benutzername: Ihr Strato FTP-Benutzername
   - Passwort: Ihr Strato FTP-Passwort

2. Navigieren Sie zum Web-Root-Verzeichnis (üblicherweise `/` oder `/html` oder `/public_html`)

3. Laden Sie **alle Dateien und Ordner** aus dem `dist/` Verzeichnis hoch

### Schritt 3: Domain konfigurieren

1. Loggen Sie sich in Ihr Strato-Kundencenter ein
2. Navigieren Sie zu "Domains & SSL"
3. Stellen Sie sicher, dass `lars-gentsch.de` auf das richtige Verzeichnis zeigt

### Alternative: GitHub Actions für automatisches Deployment

Sie können auch GitHub Actions für automatisches Deployment einrichten:

1. FTP-Zugangsdaten als GitHub Secrets hinzufügen:
   - `FTP_HOST`
   - `FTP_USERNAME`
   - `FTP_PASSWORD`

2. Workflow-Datei erstellen (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Strato

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy via FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.FTP_HOST }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          local-dir: ./dist/
```

## Projektstruktur

```
/
├── public/             # Statische Assets (favicon, etc.)
├── src/
│   ├── pages/         # Seiten (index.astro)
│   └── styles/        # CSS-Dateien
├── astro.config.mjs   # Astro-Konfiguration
└── package.json       # Projekt-Dependencies
```

## Inhalt aktualisieren

Die Hauptseite befindet sich in `src/pages/index.astro`. Hier können Sie folgende Sektionen anpassen:

- **Hero Section** - Name und Titel
- **About Section** - Beruflicher Hintergrund
- **Expertise Section** - Fachgebiete
- **Reading List** - Lieblingsbücher
- **Contact Section** - Kontaktlinks

## Links

- GitHub Repository: [https://github.com/daisaja/professional-homepage](https://github.com/daisaja/professional-homepage)
- LinkedIn: [https://de.linkedin.com/in/lars-gentsch-0854a48b](https://de.linkedin.com/in/lars-gentsch-0854a48b)
- Goodreads: [https://www.goodreads.com/user/show/65778884-lars-gentsch](https://www.goodreads.com/user/show/65778884-lars-gentsch)

## Lizenz

© 2025 Lars Gentsch. Alle Rechte vorbehalten.
