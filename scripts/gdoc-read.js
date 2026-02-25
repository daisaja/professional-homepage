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
