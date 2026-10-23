// After `vite build`: pages search engines can read. The site is drawn in the browser, so every address answered the
// same app shell (about 120 words); here each blog post, the blog's list and the Chess Guide get their own HTML file
// with the same text the app shows (English, with the Hindi and Marathi titles and summaries), a title, a
// description, a canonical address and structured data (BlogPosting, FAQPage). The app removes the text (#seo) as it
// starts and draws the page as usual. Also writes build/sitemap.xml with every post. Cloudflare serves
// /blog/<slug> from build/blog/<slug>.html.
//   node scripts/seo-pages.mjs   (run by `npm run build`)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'build');
const SITE = 'https://chesscastles.com';

// The content, straight from the site's own modules.
const tmp = join(root, 'node_modules/.cache/seo-pages.mjs');
await build({
  stdin: { contents: "export { POSTS, TAG_NAME } from './src/lib/blog/posts.ts'; export { GUIDE, TOPIC_NAME } from './src/lib/guide/guide.ts';", resolveDir: root, loader: 'ts' },
  outfile: tmp,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'error',
  alias: { $lib: join(root, 'src/lib') },
});
const { POSTS, TAG_NAME, GUIDE, TOPIC_NAME } = await import(pathToFileURL(tmp).href);

const shell = readFileSync(join(out, 'index.html'), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The app's light markdown (headings, lists, pictures, links, bold) as HTML. */
function md(lines) {
  const html = [];
  let list = false;
  const inline = (s) =>
    esc(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const line of lines) {
    const l = line.trim();
    if (!l.startsWith('- ') && list) (html.push('</ul>'), (list = false));
    if (l.startsWith('### ')) html.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (l.startsWith('## ')) html.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith('- ')) {
      if (!list) (html.push('<ul>'), (list = true));
      html.push(`<li>${inline(l.slice(2))}</li>`);
    } else if (/^\[img:/.test(l)) {
      const [src, alt = ''] = l.slice(5, -1).split('|');
      html.push(`<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" /><figcaption>${inline(alt)}</figcaption></figure>`);
    } else if (l.startsWith('> ')) html.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (l) html.push(`<p>${inline(l)}</p>`);
  }
  if (list) html.push('</ul>');
  return html.join('\n');
}

const STYLE = `<style>#seo{max-width:760px;margin:0 auto;padding:8px 16px 40px;color:var(--text,#e8ecf3);font:16px/1.65 system-ui,sans-serif}#seo h1{font-size:30px;line-height:1.2}#seo img{max-width:100%;height:auto}#seo a{color:var(--accent,#f0b43a)}#seo nav a{margin-right:12px}</style>`;
const NAV = `<nav><a href="/">Chess Castles</a><a href="/play">Play</a><a href="/learn">Learn</a><a href="/puzzles">Puzzles</a><a href="/blog">Blog</a><a href="/guide">Chess Guide</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a></nav>`;

function page(path, { title, description, type = 'website', jsonld, body }) {
  const url = SITE + path;
  let h = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${type}" />`);
  const head = `<link rel="canonical" href="${url}" /><meta property="og:url" content="${url}" />${STYLE}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}`;
  h = h.replace('</head>', `${head}</head>`);
  const seo = `<div id="seo">${NAV}${body}</div>`;
  h = h.includes('<div style="display: contents">') ? h.replace('<div style="display: contents">', `${seo}<div style="display: contents">`) : h.replace(/<body([^>]*)>/, `<body$1>${seo}`);
  const file = join(out, `${path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, h);
  return path;
}

const ORG = { '@type': 'Organization', name: 'Chess Castles', url: SITE, logo: `${SITE}/icon-512.png` };
const written = [];

// The blog: each post, and the list.
for (const p of POSTS) {
  const other = ['hi', 'mr']
    .map((l) => `<section lang="${l}"><h2>${esc(p.title[l])}</h2><p>${esc(p.summary[l])}</p></section>`)
    .join('');
  written.push(
    page(`/blog/${p.slug}`, {
      title: `${p.title.en} · Chess Castles`,
      description: p.summary.en,
      type: 'article',
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title.en,
        description: p.summary.en,
        datePublished: p.date,
        inLanguage: 'en',
        image: `${SITE}/social-card.png`,
        author: ORG,
        publisher: ORG,
        mainEntityOfPage: `${SITE}/blog/${p.slug}`,
      },
      body: `<article><p>${esc(TAG_NAME[p.tag]?.en ?? p.tag)} · ${esc(p.date)} · ${p.read} min read</p><h1>${esc(p.title.en)}</h1><p><strong>${esc(p.summary.en)}</strong></p>${md(p.body.en)}${other}</article>`,
    }),
  );
}
written.push(
  page('/blog', {
    title: 'Chess blog for players, kids and parents · Chess Castles',
    description: 'Chess Castles blog: how to improve your rating, chess tips for kids, stories and chess history, in English, Hindi and Marathi.',
    jsonld: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Chess Castles Blog', url: `${SITE}/blog`, publisher: ORG },
    body: `<h1>Chess Castles blog</h1><p>How to improve, chess for kids, stories and chess history, in English, हिंदी and मराठी.</p>${POSTS.map((p) => `<article><h2><a href="/blog/${p.slug}">${esc(p.title.en)}</a></h2><p>${esc(p.summary.en)}</p></article>`).join('')}`,
  }),
);

// The Chess Guide: questions and answers (an FAQ).
written.push(
  page('/guide', {
    title: 'Chess Guide: ratings, tournaments and help for parents · Chess Castles',
    description: 'Answers to the questions chess players and parents in India ask: FIDE and Lichess ratings, how to enter tournaments, AICF, and how to help a child improve.',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: GUIDE.map((g) => ({ '@type': 'Question', name: g.q.en, acceptedAnswer: { '@type': 'Answer', text: g.a.en.join(' ') } })),
    },
    body: `<h1>Chess Guide</h1>${Object.keys(TOPIC_NAME)
      .map((t) => `<section><h2>${esc(TOPIC_NAME[t].en)}</h2>${GUIDE.filter((g) => g.topic === t).map((g) => `<h3>${esc(g.q.en)}</h3>${md(g.a.en)}`).join('')}</section>`)
      .join('')}`,
  }),
);

// About, Contact and the policies: the text is in the .svelte pages (plain HTML, no logic), so it is read from there and
// the same words are in the file search engines and the AdSense reviewer fetch.
const svelteText = (file, open, close) => {
  let t = readFileSync(join(root, 'src/routes', file), 'utf8').replace(/<script[\s\S]*?<\/script>/, '').replace(/<style[\s\S]*$/, '');
  const a = t.indexOf(open);
  const b = t.lastIndexOf(close);
  if (a < 0 || b < 0) throw new Error(`seo-pages: cannot read ${file}`);
  t = t.slice(a + open.length, b);
  if (/[{}]/.test(t)) throw new Error(`seo-pages: ${file} has logic; give it its own text`);
  return t.replace(/^[^<]*>/, '').trim();
};
const LEGAL = [
  ['/legal/privacy', 'legal/privacy/+page.svelte', 'Privacy policy', "How Chess Castles handles personal data, children's data and advertising, and the rights you have under India's DPDP Act."],
  ['/legal/terms', 'legal/terms/+page.svelte', 'Terms of use', 'The rules for using Chess Castles: accounts, fair play, children, plans and payments.'],
  ['/legal/fair-play', 'legal/fair-play/+page.svelte', 'Fair play policy', 'How Chess Castles keeps games fair: what counts as cheating, how it is checked and what happens next.'],
  ['/legal/refunds', 'legal/refunds/+page.svelte', 'Refund policy', 'When and how payments to Chess Castles can be refunded.'],
  ['/contact', 'contact/+page.svelte', 'Contact us', 'Email and support for Chess Castles: help for players, parents and coaches, and how to send a complaint.'],
];
for (const [path, file, title, description] of LEGAL) {
  const inner = svelteText(file, '<LegalPage', '</LegalPage>');
  written.push(page(path, { title: `${title} · Chess Castles`, description, body: `<article><h1>${esc(title)}</h1>${inner}</article>` }));
}
{
  const inner = svelteText('about/+page.svelte', '<div class="page">', '</div>');
  written.push(
    page('/about', {
      title: 'About Chess Castles · who we are and what we use',
      description: 'Chess Castles is a free chess site and app for players in India: play, learn, analyse and follow ratings. What our opponents, coach and engines are, and the open-source work we build on.',
      jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Chess Castles', url: SITE + '/about', publisher: ORG },
      body: `<article>${inner}</article>`,
    }),
  );
}

// The sitemap: the site's pages (static/sitemap.xml) and every post.
const base = readFileSync(join(root, 'static/sitemap.xml'), 'utf8');
const have = new Set([...base.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const extra = [
  ...POSTS.map((p) => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.date, freq: 'monthly', pr: '0.7' })),
  ...['/blog', '/guide', '/journey', '/journey/story', '/wishes', '/learn/roadmap', '/live', '/about', '/contact', '/legal/privacy', '/legal/terms', '/legal/fair-play', '/legal/refunds'].map((p) => ({ loc: SITE + p, freq: 'weekly', pr: '0.7' })),
].filter((u) => !have.has(u.loc));
const urls = extra.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.pr}</priority></url>`).join('\n');
writeFileSync(join(out, 'sitemap.xml'), base.replace('</urlset>', `${urls}\n</urlset>`));
console.log(`seo pages: ${written.length} written; sitemap: ${have.size + extra.length} addresses`);
