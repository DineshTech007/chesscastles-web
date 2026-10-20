// The social-media copy for the feature videos (title, description, hashtags per language),
// from scripts/videos/features.mjs → reports/videos/social.md. Not shown on the site.
//   node scripts/videos/social.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { FEATURES, LANGS } from './features.mjs';

const NAME = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
const lines = ['# Feature videos: titles, descriptions and hashtags for social media', '', 'Videos: static/videos/<feature>-<lang>.mp4 (16:9, 15–20 s, voice + captions). One block per feature and language.', ''];
for (const f of FEATURES) {
  lines.push(`## ${f.name} (${f.id})`, '');
  for (const l of LANGS) {
    const s = f.social[l];
    lines.push(`### ${NAME[l]} · video: static/videos/${f.id}-${l}.mp4`, '', `**Title:** ${s.title}`, '', `**Description:** ${s.description}`, '', `**Script:** ${f.say[l].join(' ')}`, '', `**Hashtags:** ${f.social.hashtags.join(' ')}`, '');
  }
}
mkdirSync('reports/videos', { recursive: true });
writeFileSync('reports/videos/social.md', lines.join('\n'));
console.log(`reports/videos/social.md: ${FEATURES.length} features × ${LANGS.length} languages`);
