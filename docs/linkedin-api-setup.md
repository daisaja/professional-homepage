# LinkedIn API Setup

Einmalige Einrichtung für automatisches Posten via GitHub Actions.

## 1. LinkedIn App erstellen

1. Gehe zu [LinkedIn Developer Portal](https://developer.linkedin.com/apps)
2. Klicke **Create app**
3. App-Name: z.B. `lars-gentsch-blog`
4. LinkedIn Page: deine persönliche Profilseite verlinken
5. App-Logo hochladen (beliebig)
6. **Create app**

## 2. Produkt hinzufügen

Im Tab **Products**:
- **Share on LinkedIn** → **Request access**

Das gibt dir die `w_member_social`-Permission, die zum Posten benötigt wird. Die Freigabe passiert meist sofort für eigene Apps.

## 3. OAuth-Redirect konfigurieren

Im Tab **Auth**:
- Unter **Authorized redirect URLs**: `http://localhost:3001/callback` hinzufügen
- **Client ID** und **Client Secret** notieren

## 4. Credentials-Datei anlegen

```bash
cat > scripts/linkedin-credentials.json << 'EOF'
{
  "client_id": "DEINE_CLIENT_ID",
  "client_secret": "DEIN_CLIENT_SECRET"
}
EOF
```

Diese Datei ist gitignored und bleibt lokal.

## 5. Einmalige Authentifizierung

```bash
node scripts/linkedin-auth.js
```

- Browser-Link öffnen
- Mit LinkedIn anmelden und App autorisieren
- Der Token wird in `scripts/linkedin-token.json` gespeichert (gitignored)
- Im Terminal erscheinen die Werte für GitHub Secrets

## 6. GitHub Secrets setzen

Im GitHub-Repository unter **Settings → Secrets and variables → Actions**:

| Secret | Wert |
|--------|------|
| `LINKEDIN_ACCESS_TOKEN` | Access Token aus Schritt 5 |
| `LINKEDIN_PERSON_URN` | Person URN aus Schritt 5 (`urn:li:person:...`) |

## 7. LinkedIn-Post manuell triggern

Nach einer Artikel-Veröffentlichung:

1. GitHub → Actions → **Publish to LinkedIn**
2. **Run workflow** → `slug`: Artikel-Slug eingeben
3. Action postet auf LinkedIn und schreibt `published: true` zurück ins Repo

## Token-Ablauf

LinkedIn Access Tokens laufen nach **60 Tagen** ab. Zur Erneuerung:

```bash
node scripts/linkedin-auth.js
```

Danach den neuen `LINKEDIN_ACCESS_TOKEN` in GitHub Secrets aktualisieren.
