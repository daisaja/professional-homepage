// scripts/linkedin-post.js
// Reads linkedin-posts/$SLUG.md, posts to LinkedIn, writes published status back.
//
// Usage: node scripts/linkedin-post.js linkedin-posts/my-slug.md
// Env:   LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PERSON_URN = process.env.LINKEDIN_PERSON_URN;

// --- Frontmatter parsing (no external deps) ---

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found in file');

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const colonIdx = line.indexOf(':');
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    frontmatter[key] =
      raw === '~' || raw === 'null' ? null :
      raw === 'true' ? true :
      raw === 'false' ? false :
      raw;
  }
  return { frontmatter, body: match[2].trim() };
}

function serializeFile(frontmatter, body) {
  const lines = Object.entries(frontmatter).map(([k, v]) => {
    if (v === null) return `${k}: ~`;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

// --- LinkedIn API helpers ---

async function liRequest(endpoint, options = {}) {
  const res = await fetch(`https://api.linkedin.com/v2${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn ${endpoint}: ${res.status} ${text}`);
  }
  return res.json();
}

async function uploadImage(imagePath) {
  const registration = await liRequest('/assets?action=registerUpload', {
    method: 'POST',
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: PERSON_URN,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });

  const uploadUrl =
    registration.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
  const assetUrn = registration.value.asset;

  const imageBuffer = readFileSync(imagePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' },
    body: imageBuffer,
  });
  if (!uploadRes.ok) throw new Error(`Image upload failed: ${uploadRes.status}`);

  return assetUrn;
}

async function createPost(text, imageAssetUrn) {
  const shareContent = {
    shareCommentary: { text },
    shareMediaCategory: imageAssetUrn ? 'IMAGE' : 'NONE',
  };
  if (imageAssetUrn) {
    shareContent.media = [{ status: 'READY', media: imageAssetUrn, title: { text: '' } }];
  }

  const result = await liRequest('/ugcPosts', {
    method: 'POST',
    body: JSON.stringify({
      author: PERSON_URN,
      lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  return result.id;
}

// --- Main ---

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/linkedin-post.js <path-to-linkedin-post.md>');
    process.exit(1);
  }
  if (!TOKEN) { console.error('LINKEDIN_ACCESS_TOKEN nicht gesetzt'); process.exit(1); }
  if (!PERSON_URN) { console.error('LINKEDIN_PERSON_URN nicht gesetzt'); process.exit(1); }

  const absPath = path.resolve(filePath);
  const content = readFileSync(absPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);

  if (frontmatter.published === true) {
    console.log('Bereits veröffentlicht:', frontmatter.linkedin_post_id);
    process.exit(0);
  }

  let imageAssetUrn = null;
  if (frontmatter.image) {
    const imagePath = path.join(REPO_ROOT, frontmatter.image);
    if (existsSync(imagePath)) {
      console.log('Bild hochladen:', frontmatter.image);
      imageAssetUrn = await uploadImage(imagePath);
    } else {
      console.log('Bild nicht gefunden, Post ohne Bild:', frontmatter.image);
    }
  }

  console.log('LinkedIn-Post erstellen...');
  const postId = await createPost(body, imageAssetUrn);

  frontmatter.published = true;
  frontmatter.published_at = new Date().toISOString();
  frontmatter.linkedin_post_id = postId;

  writeFileSync(absPath, serializeFile(frontmatter, body));
  console.log('✅ Post veröffentlicht:', postId);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
