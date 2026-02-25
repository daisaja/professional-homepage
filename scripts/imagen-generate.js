// scripts/imagen-generate.js
// Usage: node scripts/imagen-generate.js "prompt text" "output/path/image.png"
// Requires: GEMINI_API_KEY environment variable

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;

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
