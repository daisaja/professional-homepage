// scripts/linkedin-auth.js
// Run once locally to get LinkedIn OAuth tokens.
// Stores credentials in scripts/linkedin-token.json (gitignored).
//
// Usage:
//   1. Create scripts/linkedin-credentials.json with { "client_id": "...", "client_secret": "..." }
//   2. node scripts/linkedin-auth.js
//   3. Copy LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN to GitHub Secrets

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDS_PATH = path.join(__dirname, 'linkedin-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'linkedin-token.json');
const REDIRECT_URI = 'http://localhost:3001/callback';
const SCOPE = 'w_member_social';

async function main() {
  if (!existsSync(CREDS_PATH)) {
    console.error(`Fehlende Datei: ${CREDS_PATH}`);
    console.error('Anlegen mit: {"client_id": "...", "client_secret": "..."}');
    process.exit(1);
  }

  const { client_id, client_secret } = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', client_id);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPE);

  console.log('\nBitte diesen Link im Browser öffnen:');
  console.log(authUrl.toString());
  console.log('\nWarte auf Callback...');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const qs = new URL(req.url, 'http://localhost:3001').searchParams;
      if (qs.get('error')) {
        res.end('Fehler: ' + qs.get('error_description'));
        server.close();
        reject(new Error(qs.get('error_description')));
        return;
      }
      res.end('Authentifizierung erfolgreich. Du kannst dieses Fenster schließen.');
      server.close();
      resolve(qs.get('code'));
    }).listen(3001);
  });

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id,
      client_secret,
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) {
    console.error('Token-Fehler:', tokens.error_description);
    process.exit(1);
  }

  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = await meRes.json();
  const personUrn = `urn:li:person:${me.id}`;

  const stored = {
    access_token: tokens.access_token,
    person_urn: personUrn,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };

  writeFileSync(TOKEN_PATH, JSON.stringify(stored, null, 2));

  console.log('\n✅ Tokens gespeichert:', TOKEN_PATH);
  console.log('\nFür GitHub Secrets:');
  console.log('LINKEDIN_ACCESS_TOKEN =', stored.access_token);
  console.log('LINKEDIN_PERSON_URN   =', stored.person_urn);
  console.log('\nToken läuft ab:', stored.expires_at);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
