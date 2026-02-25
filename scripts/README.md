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
