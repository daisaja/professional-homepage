// scripts/slugify.js
// Usage: node scripts/slugify.js "OpenClaw auf dem NAS"
// Output: openclaw-auf-dem-nas

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// CLI usage
if (process.argv[2]) {
  console.log(slugify(process.argv[2]));
}
