/**
 * The Chess Castles helper's answers: how to use each part of the site. The
 * helper matches a question to the closest answers by their words; it does
 * not make anything up, and offers the support form when it has no answer.
 */

export interface HelpAnswer {
  id: string;
  /** The question, as shown in suggestions. */
  q: string;
  /** Words (and short phrases) people use when they mean this. */
  words: string[];
  /** The answer, in short sentences. */
  a: string;
  link?: { href: string; label: string };
}

export const KB: HelpAnswer[] = [
  { id: 'signin', q: 'How do I sign in?', words: ['sign in', 'login', 'log in', 'account', 'register', 'sign up', 'lichess account', 'password', 'google'], a: 'Tap “Sign in” and choose Google or Lichess. Chess Castles never sees your password. Parents can simply use Google. To play real opponents online you also need a free Lichess account, which you can connect later from Play → Online.', link: { href: '/profile', label: 'Open my profile' } },
  { id: 'signout-mixed', q: 'Why was I signed out?', words: ['signed out', 'logged out', 'sign out', 'two accounts', 'another account', 'wrong account'], a: 'If two different people sign in on the same browser, Chess Castles signs out to keep the accounts apart. Just sign in again with your own Lichess account.' },
  { id: 'photo', q: 'How do I add a profile photo?', words: ['photo', 'picture', 'avatar', 'image', 'dp', 'profile pic'], a: 'Open your profile and tap “Change photo”. When you are signed in, the photo is saved in your account. Only your friends see it.', link: { href: '/profile', label: 'Open my profile' } },
  { id: 'country', q: 'How do I change my country flag?', words: ['flag', 'country', 'nation', 'federation'], a: 'On your profile, pick your country in the details and save. The flag then shows next to your name while you play.', link: { href: '/profile', label: 'Edit my details' } },
  { id: 'fide-play', q: 'How do I play a FIDE-rated opponent?', words: ['fide', 'fide rated', 'rated player', 'play', 'opponent', 'bot', 'start game', 'new game', 'computer'], a: 'Open Play, pick a rating from 1000 to 2800 and a time control, then tap Play. FIDE-rated opponents are computer opponents that play in the style of players at that FIDE rating: their openings, plans and mistakes. Your results change your CC Rating.', link: { href: '/play', label: 'Play' } },
  { id: 'real-people', q: 'Are the FIDE-rated opponents real people?', words: ['real', 'real people', 'real person', 'human', 'is it a bot', 'bot', 'computer', 'actual fide', 'real fide', 'fide player'], a: 'No. They are computer opponents that play in the style of players at the FIDE rating you pick. They are not real people and not FIDE-rated players, and games against them don’t count for official FIDE ratings. To play real people, use Play → Online.', link: { href: '/about', label: 'About the opponents' } },
  { id: 'kfide', q: 'What is the CC Rating?', words: ['cc rating', 'ccrating', 'kfide', 'rating', 'my rating', 'elo', 'classical', 'standard', 'rapid', 'blitz', 'provisional', 'question mark'], a: 'The CC Rating is your Chess Castles rating, worked out the way FIDE rates players, from your games against the FIDE-rated players. Like FIDE, you have three: Classical, Rapid and Blitz, and each game counts only for its own speed. A “?” means fewer than 5 games at that speed. It is not an official FIDE rating.', link: { href: '/profile', label: 'See my CC Rating' } },
  { id: 'tournament', q: 'How do FIDE tournaments work?', words: ['tournament', 'trophy', 'swiss', 'round robin', 'cup', 'medal', 'standings', 'podium'], a: 'On Play, choose “Play a FIDE tournament”. You play 5 to 10 FIDE-rated players from the rating list, one game a round. The top three win trophies, saved on your profile.', link: { href: '/play/tournament', label: 'Start a tournament' } },
  { id: 'online', q: 'How do I play online against people?', words: ['online', 'people', 'human', 'real player', 'friend game', 'challenge', 'pairing', 'lichess game'], a: 'Play → Online uses your Lichess account: find an opponent, challenge a friend, or play Lichess’s computer. Games are played on Lichess, from Chess Castles.', link: { href: '/play?mode=online', label: 'Play online' } },
  { id: 'safe', q: 'Is Chess Castles safe for my child?', words: ['safe', 'safety', 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'parent', 'stranger', 'chat', 'सुरक्षित', 'बच्चा', 'बच्चे', 'मुलगा', 'मुलगी', 'मूल', 'सुरक्षा'], a: 'Yes. Players can message each other only after both agree to be friends, so there is no chat with strangers. Photos are shown only to friends, there are no ads, and anyone can be blocked or reported. Parents can ask us to see or delete their child’s data at any time.', link: { href: '/parents', label: 'For parents' } },
  { id: 'refund', q: 'How do refunds work?', words: ['refund', 'money back', 'cancel', 'cancellation', 'charged', 'payment', 'paid', 'पैसे', 'वापस', 'परत', 'रिफंड'], a: 'Cancel any time and keep your plan until the end of the period you paid for. The first payment for a plan is refunded in full within 7 days, and wrong or double charges are always refunded. Write to support@chesscastles.com or use the Help page.', link: { href: '/legal/refunds', label: 'Refund policy' } },
  { id: 'price', q: 'How much does it cost?', words: ['price', 'cost', 'fee', 'fees', 'rupees', '₹', 'subscription', 'कीमत', 'किंमत', 'फीस', 'शुल्क'], a: 'Pawn is free for ever. Bishop, Rook and Queen are optional paid plans (from ₹99 a month); they are not on sale yet. During the launch offer every new account gets Rook free.', link: { href: '/plans', label: 'See plans' } },
  { id: 'plans', q: 'What are the plans? Is Chess Castles free?', words: ['plan', 'plans', 'price', 'free', 'pawn', 'bishop', 'rook', 'queen', 'premium', 'membership', 'pay', 'upgrade', 'limit'], a: 'Pawn is free for ever. Bishop, Rook and Queen add more games against FIDE-rated players, Game Reviews, Insights and Guru lessons; Queen adds coach tools. During the launch offer every new player gets Rook free. Limits reset at midnight, India time.', link: { href: '/plans', label: 'See plans' } },
  { id: 'invite', q: 'How do I invite friends?', words: ['invite', 'referral', 'refer', 'friend link', 'free bishop'], a: 'Open Plans and copy your invite link. Each friend who joins with it gives you 7 days of Bishop, after any plan you have.', link: { href: '/plans', label: 'Your invite link' } },
  { id: 'coach-tools', q: 'I am a coach: how do I add my students?', words: ['coach', 'students', 'academy', 'homework', 'assign'], a: 'With the Queen plan, open My students and share your link. Students who open it and agree join you; you see their ratings, games and study and can set them work.', link: { href: '/students', label: 'My students' } },
  { id: 'bullet', q: 'Which time controls can I play online?', words: ['bullet', '1+0', '3+0', '2+1', 'blitz pairing', 'time control', 'lock', 'locked', 'lobby', 'quick pairing'], a: 'Online you can play blitz (3+0, 3+2, 5+0, 5+3), rapid (10+0, 10+5, 15+10) and classical (30+0, 30+20): by quick pairing, from the lobby, or by challenging a friend. Bullet is not available.', link: { href: '/play?mode=online', label: 'Play online' } },
  { id: 'challenge-error', q: '“You cannot challenge” error', words: ['cannot challenge', 'can not challenge', 'challenge error', 'not allowed challenge'], a: 'That player’s Lichess settings don’t accept challenges from you. They can change it on Lichess: Preferences → Privacy → “Let other players challenge you” → Always.' },
  { id: 'resume', q: 'My connection dropped during a game', words: ['connection', 'internet', 'lost game', 'closed', 'browser closed', 'resume', 'continue game', 'refresh', 'reload'], a: 'Open Chess Castles again: it takes you straight back to your game. Online games continue on Lichess; games against Chess Castles’ players are saved after every move. Your clock keeps running while you are away, like in a real game.' },
  { id: 'analysis', q: 'How do I analyse a game?', words: ['analyse', 'analysis', 'analyze', 'engine', 'stockfish', 'review', 'mistakes', 'best move', 'evaluation'], a: 'Open Analyse. Every move gets a badge (brilliant, best, mistake, blunder…) and the engine shows the top 3 lines. Your finished games have “Analyse” on the result card and in My games.', link: { href: '/analysis', label: 'Open Analyse' } },
  { id: 'import', q: 'How do I import a game or position?', words: ['import', 'pgn', 'fen', 'paste', 'chess.com game', 'load game', 'upload game'], a: 'In Analyse, tap “Import” and paste a PGN, a FEN, or a Lichess game link. For a chess.com game, use Share → PGN there and paste it.', link: { href: '/analysis', label: 'Open Analyse' } },
  { id: 'setup', q: 'How do I set up a position or clear the board?', words: ['set up', 'setup', 'clear board', 'empty board', 'board editor', 'place pieces', 'position'], a: 'In Analyse, tap “Clear / set up”. Clear the board, tap a piece and then squares to place it, choose who moves, then “Analyse this position”.', link: { href: '/analysis', label: 'Open Analyse' } },
  { id: 'variations', q: 'How do variations work in analysis?', words: ['variation', 'line', 'main line', 'side line', 'branch', 'alternative'], a: 'Play a different move anywhere in the game: it becomes a variation and the rest of the game stays. Use “Make main line” or “Delete variation” above the moves.' },
  { id: 'insights', q: 'What is Game Insights?', words: ['chess.com', 'insights', 'insight', 'weakness', 'weaknesses', 'my games report', 'study plan', 'guru'], a: 'Enter your chess.com username: Guru checks every move of your recent games, shows what costs you points, and builds a 7-day study plan with puzzles from your own mistakes.', link: { href: '/insights', label: 'Open Chess.com Insights' } },
  { id: 'plan', q: 'How do I make a daily study plan and reminders?', words: ['study plan', 'reminder', 'notification', 'daily', 'streak', 'schedule', 'alarm'], a: 'Open Learn: pick a topic for each day, the time and minutes, and tap “Remind me”. You get a reminder at study time and a warning before you lose your streak.', link: { href: '/learn', label: 'Open Learn' } },
  { id: 'puzzles', q: 'Where are puzzles?', words: ['puzzle', 'puzzles', 'tactics', 'daily puzzle', 'themes', 'fork', 'pin'], a: 'Puzzles has the puzzle of the day and themed puzzles (forks, pins, mates…). Chess.com Insights also makes puzzles from your own mistakes.', link: { href: '/puzzles', label: 'Open Puzzles' } },
  { id: 'vision', q: 'What is the Vision Gym?', words: ['vision', 'blindfold', 'visualisation', 'visualization', 'sprint', 'memory', 'board in head'], a: 'Train seeing the board in your head: blindfold puzzles (notation only), a 60-second square-naming sprint and Move Memory, with their own leaderboard.', link: { href: '/vision', label: 'Open the Vision Gym' } },
  { id: 'books', q: 'How do I read or listen to books?', words: ['book', 'books', 'read', 'listen', 'audio', 'audiobook', 'library', 'notation old', 'descriptive'], a: 'Open Books, choose a book (Opening, Middlegame, Endgame or General), and tap Read or Listen. Listen reads the book aloud, moves included. Old books write moves like P-K4; there is a guide to it.', link: { href: '/books', label: 'Open Books' } },
  { id: 'friends', q: 'How do I add friends?', words: ['friend', 'friends', 'add friend', 'search player', 'find player', 'request'], a: 'Open Friends → Find players and search by name or Lichess username. Players not on Chess Castles yet get your request when they sign in.', link: { href: '/friends?tab=find', label: 'Find players' } },
  { id: 'message', q: 'How do I message someone?', words: ['message', 'chat', 'talk', 'send message', 'inbox'], a: 'You can message friends only (both said yes), to keep everyone safe. Open Friends and tap Message next to them.', link: { href: '/friends', label: 'Open Friends' } },
  { id: 'watch-friend', q: 'How do I watch someone play?', words: ['watch', 'spectate', 'audience', 'live game', 'watching', 'follow game'], a: 'When a player is in a game, “Watch” appears next to them in Friends, in search results and on their profile. You can watch Chess Castles games and Lichess games live.', link: { href: '/friends', label: 'Open Friends' } },
  { id: 'friend-games', q: 'How do I see my friend’s games?', words: ['friend games', 'their games', 'his games', 'her games', 'review friend'], a: 'Open your friend’s profile: “Games on Chess Castles” and their latest Lichess games are there, each with Review.' },
  { id: 'leaderboard', q: 'Where is the leaderboard?', words: ['leaderboard', 'ranking', 'rank', 'top players', 'best players', 'board'], a: 'Leaderboard has tabs for CC Rating, Lichess ratings, Puzzles, Vision Gym, Study (this week) and Books, for everyone or just your friends.', link: { href: '/leaderboard', label: 'Open the Leaderboard' } },
  { id: 'ratings', q: 'How do I find a FIDE player’s rating?', words: ['fide rating', 'fide list', 'fide profile', 'fide id', 'rating list', 'player rating', 'india ranking'], a: 'Ratings has the FIDE rating list: search by name or FIDE ID, filter by country, and open a player’s profile with their history.', link: { href: '/ratings', label: 'Open Ratings' } },
  { id: 'lichess-tournament', q: 'Can I play arena tournaments?', words: ['arena', 'lichess tournament', 'join tournament'], a: 'Yes: Play → Online → Arena tournaments. Join an open arena, or watch the others live.', link: { href: '/play/lichess-tournaments', label: 'Arena tournaments' } },
  { id: 'sound', q: 'How do I turn sounds on or off?', words: ['sound', 'mute', 'volume', 'beep', 'noise', 'audio off'], a: 'Use the speaker button at the top right.' },
  { id: 'theme', q: 'How do I switch to light mode?', words: ['dark', 'light', 'theme', 'night mode', 'colour', 'color'], a: 'Use the sun/moon button at the top right.' },
  { id: 'report', q: 'How do I report a player?', words: ['report', 'cheater', 'cheating', 'abuse', 'harass', 'bully', 'block', 'rude'], a: 'Open their profile and choose Report (cheating, abuse, an inappropriate profile…), or Block so they can’t find or message you. Reports are private.', link: { href: '/legal/fair-play', label: 'Fair play policy' } },
  { id: 'delete', q: 'How do I delete my account or data?', words: ['delete', 'remove account', 'close account', 'my data', 'privacy', 'erase'], a: 'Send us a message below and choose “My account or data”. We delete your profile, friends, messages and games within 30 days.', link: { href: '/legal/privacy', label: 'Privacy policy' } },
  { id: 'free', q: 'Is Chess Castles free?', words: ['free', 'price', 'cost', 'pay', 'subscription', 'premium', 'money'], a: 'Yes, Chess Castles is free to use.' },
  { id: 'app', q: 'Is there an Android app?', words: ['app', 'android', 'mobile', 'phone', 'install', 'play store'], a: 'Chess Castles also has an Android app. On a phone you can also add this website to your home screen from the browser menu.' },
  { id: 'coach', q: 'What does the Coach do?', words: ['coach', 'guru', 'lesson', 'teacher', 'learn opening', 'explain'], a: 'Coach has Chess Guru: lessons, practice against a human-like opponent at your level, and explanations of positions.', link: { href: '/coach', label: 'Open Coach' } },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    // Letters of any script (Hindi and Marathi questions too), digits, + and .
    .replace(/[^\p{L}\p{M}\p{N}+.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');

/** The answers that fit a question best (best first); empty when nothing fits. */
export function findAnswers(question: string, max = 3): HelpAnswer[] {
  const q = norm(question);
  if (!q) return [];
  const words = new Set(q.split(' ').filter((w) => w.length > 1).map(stem));
  const scored = KB.map((k) => {
    let score = 0;
    for (const w of k.words) {
      const n = norm(w);
      if (n.includes(' ') || n.includes('.') || n.includes('+')) {
        if (q.includes(n)) score += 3;
      } else if (words.has(stem(n))) score += 2;
    }
    for (const w of norm(k.q).split(' ')) if (w.length > 3 && words.has(stem(w))) score += 0.5;
    return { k, score };
  });
  return scored
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.k);
}
