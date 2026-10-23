import { readFileSync, writeFileSync } from 'node:fs';
const nl = String.fromCharCode(10), crlf = String.fromCharCode(13, 10);
function patch(f, pairs) {
  let t = readFileSync(f, 'utf8');
  const was = t.includes(crlf);
  if (was) t = t.split(crlf).join(nl);
  for (const [a, b] of pairs) {
    if (!t.includes(a)) throw new Error(f + ' missing ' + a.slice(0, 60));
    t = t.replace(a, b);
  }
  writeFileSync(f, was ? t.split(nl).join(crlf) : t);
}
const add = (anchor, lines) => anchor + '\n' + lines.map((l) => '    ' + l).join('\n');
patch('src/lib/i18n/features/economy.ts', [
  [`    'eco.why.invite': 'A friend joined with your link',`, add(`    'eco.why.invite': 'A friend joined with your link',`, [
    `'eco.earn.h': 'You earn here',`,
    `'eco.earn.per': 'for every {every}',`,
    `'eco.earn.today': '{used}/{cap} today',`,
    `'eco.earn.limit': 'Daily limit: a coin each now',`,
    `'eco.earn.done': 'Daily limit reached',`,
  ])],
  [`    'eco.why.invite': 'एक दोस्त आपके लिंक से जुड़ा',`, add(`    'eco.why.invite': 'एक दोस्त आपके लिंक से जुड़ा',`, [
    `'eco.earn.h': 'यहाँ आप कमाते हैं',`,
    `'eco.earn.per': 'हर {every} पर',`,
    `'eco.earn.today': 'आज {used}/{cap}',`,
    `'eco.earn.limit': 'रोज़ की सीमा: अब एक सिक्का',`,
    `'eco.earn.done': 'रोज़ की सीमा पूरी',`,
  ])],
  [`    'eco.why.invite': 'एक मित्र तुमच्या लिंकने जोडला गेला',`, add(`    'eco.why.invite': 'एक मित्र तुमच्या लिंकने जोडला गेला',`, [
    `'eco.earn.h': 'इथे तुम्ही कमावता',`,
    `'eco.earn.per': 'प्रत्येक {every} मागे',`,
    `'eco.earn.today': 'आज {used}/{cap}',`,
    `'eco.earn.limit': 'रोजची मर्यादा: आता एक नाणं',`,
    `'eco.earn.done': 'रोजची मर्यादा पूर्ण',`,
  ])],
]);

/** Adds the hint after the page's header (the first </header> within 40 lines of the page div), else right after the page div. */
function place(f, kinds, note) {
  let t = readFileSync(f, 'utf8');
  const was = t.includes(crlf);
  if (was) t = t.split(crlf).join(nl);
  const tag = `<EarnHint kinds={[${kinds.map((k) => `'${k}'`).join(', ')}]}${note ? ` note="${note}"` : ''} />`;
  if (!t.includes('EarnHint.svelte')) {
    const i = t.indexOf('</script>');
    t = t.slice(0, i) + `  import EarnHint from '$lib/economy/EarnHint.svelte';\n` + t.slice(i);
  }
  const lines = t.split(nl);
  const start = lines.findIndex((l) => /<div class="page|<h1 class="display h"/.test(l));
  if (start < 0) throw new Error(f + ': no page start');
  let at = start;
  if (/<div class="page/.test(lines[start])) {
    const end = lines.slice(start, start + 40).findIndex((l) => l.includes('</header>'));
    if (end >= 0) at = start + end;
  } else at = start; // books list: after the h1 line
  lines.splice(at + 1, 0, '  ' + tag);
  writeFileSync(f, (was ? lines.join(crlf) : lines.join(nl)));
}
place('src/routes/puzzles/+page.svelte', ['puzzleClean', 'puzzle', 'daily'], '');
place('src/routes/puzzles/themes/+page.svelte', ['puzzleClean', 'puzzle'], '');
place('src/routes/puzzles/rush/+page.svelte', ['rush'], '');
place('src/routes/puzzles/racer/+page.svelte', ['race', 'raceWin'], '');
place('src/routes/vision/+page.svelte', ['vision'], '');
place('src/routes/coach/+page.svelte', ['lesson'], 'Pay once you have read the lesson: a lesson you only tap through pays nothing.');
place('src/routes/books/+page.svelte', ['lesson'], 'A chapter pays once you have taken the time to read it.');
place('src/routes/learn/+page.svelte', ['lesson', 'line', 'review'], '');
