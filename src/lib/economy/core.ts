/**
 * The Castle Treasury (owner, 2026-10-23: "gems and gold in the corner … when a user wins a match or a tournament,
 * studies, solves puzzles, or comes back every day with a streak, give him points; with enough points, skins and board
 * designs to show other players, and a shop to buy them"). Two currencies, both earned only, never bought with money
 * (as ChessKid does for children):
 * - Gold: for everyday play and study (a game, a puzzle, a lesson, the daily visit).
 * - Gems: rare, for milestones (streaks, levels, awards, Castle Cup podiums, all three daily quests).
 * Everything here is plain data and pure functions with no imports, so the very same file runs in the browser and on
 * the API worker (server/api-worker/src/economyCore.ts is a copy: `node scripts/sync-economy.mjs`). The server is the
 * source of truth for a signed-in player; the browser runs the same rules for a visitor and to show a reward at once.
 *
 * Kind to children (research, 2026-10-23): no loot boxes or random chests (every reward is shown before it is won), no
 * real-money currency, a missed day pauses the 7-day calendar instead of resetting it, Streak Shields cost gold (never
 * gems), and learning features are never sold.
 */

export type Currency = 'gold' | 'gems';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'royal';
/** Where an item goes. `shield` is a consumable (Streak Shields), not something worn. */
export type Slot = 'board' | 'pieces' | 'finish' | 'frame' | 'name' | 'banner' | 'victory' | 'sound' | 'shield' | 'guru';
export const WEAR_SLOTS = ['board', 'pieces', 'finish', 'frame', 'name', 'banner', 'victory', 'sound'] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

/** How a Royal item is won (never sold). */
export type Unlock = { streak: number } | { level: number } | { cupWin: true } | { founder: true };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  /** The price: gold or gems (one of them). */
  gold?: number;
  gems?: number;
  unlock?: Unlock;
  /** One line for the shop card. */
  blurb: string;
  /** Moves or glows (the shop shows a ✨ "animated" tag). */
  animated?: boolean;
}

/** The boards, piece sets and sound themes everyone already has (src/lib/boardTheme.ts, pieceSets.ts, sound.ts: a test checks). */
export const STARTER_BOARDS = ['classic', 'wood', 'marble', 'ebony', 'stone', 'walnut', 'forest', 'ocean', 'coral', 'candy', 'lemon', 'midnight', 'space', 'jungle'];
export const STARTER_PIECES = ['merida', 'cburnett', 'spatial', 'fantasy', 'celtic', 'chessnut', 'pirouetti', 'papercut', 'totoy', 'pixel'];
export const STARTER_SOUNDS = ['wood', 'fun'];

/** Rarity order (for sorting) and the order the shop shows the slots in. */
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'royal'];

export const ITEMS: Item[] = [
  // ---- boards (the look: src/lib/economy/cosmetics.css, [data-board])
  { id: 'tourney', slot: 'board', name: 'Tournament Hall', rarity: 'common', gold: 350, blurb: 'Green and cream, like the boards at every Indian open.' },
  { id: 'moat', slot: 'board', name: 'Moat Blue', rarity: 'common', gold: 400, blurb: 'Calm water around the castle walls.' },
  { id: 'rosewood', slot: 'board', name: 'Rosewood', rarity: 'common', gold: 450, blurb: 'Warm rosewood with a fine grain.' },
  { id: 'amethyst', slot: 'board', name: 'Royal Amethyst', rarity: 'rare', gold: 1500, blurb: 'Purple stone from the queen’s chamber.' },
  { id: 'monsoon', slot: 'board', name: 'Monsoon Courtyard', rarity: 'rare', gold: 1800, blurb: 'Wet slate and the first rain of June.' },
  { id: 'sakura', slot: 'board', name: 'Sakura Garden', rarity: 'rare', gold: 2000, blurb: 'Pink blossoms drift over the squares.' },
  { id: 'sandfort', slot: 'board', name: 'Sandstone Fort', rarity: 'epic', gold: 4500, blurb: 'Golden sandstone and jaali lattice, from a Rajasthan fort.' },
  { id: 'icepalace', slot: 'board', name: 'Ice Palace', rarity: 'epic', gold: 5000, blurb: 'Frosted glass that sparkles in the cold.' },
  { id: 'neon', slot: 'board', name: 'Neon Joust', rarity: 'epic', gems: 70, blurb: 'A glowing arena for night battles.', animated: true },
  { id: 'hoard', slot: 'board', name: 'Dragon’s Hoard', rarity: 'legendary', gems: 180, blurb: 'Black onyx and shimmering gold coins.', animated: true },
  { id: 'lavakeep', slot: 'board', name: 'Dragonfire Keep', rarity: 'legendary', gems: 220, blurb: 'Obsidian squares with lava glowing between them.', animated: true },
  { id: 'coronation', slot: 'board', name: 'Coronation Hall', rarity: 'royal', unlock: { streak: 30 }, blurb: 'Crimson and gold. For a 30-day streak.' },
  // ---- piece sets (whole new pieces, from Lichess's collection: licences in src/lib/pieceSets.ts)
  { id: 'mpchess', slot: 'pieces', name: 'Classic Staunton', rarity: 'common', gold: 400, blurb: 'Clean tournament pieces, easy to read.' },
  { id: 'shapes', slot: 'pieces', name: 'Abstract Shapes', rarity: 'common', gold: 500, blurb: 'Every piece a simple shape: a puzzle for the eyes.' },
  { id: 'rhosgfx', slot: 'pieces', name: 'Terracotta', rarity: 'rare', gold: 1600, blurb: 'Ivory against fired red clay.' },
  { id: 'kiwen-suwi', slot: 'pieces', name: 'Bubble Court', rarity: 'rare', gold: 2000, blurb: 'Round, friendly pieces with big smiles of shape.' },
  { id: 'firi', slot: 'pieces', name: 'Golden Pagoda', rarity: 'epic', gems: 60, blurb: 'Silver and gold pieces from a faraway palace.' },
  // ---- piece finishes (worn over any piece set)
  { id: 'gilded', slot: 'finish', name: 'Gilded Court', rarity: 'rare', gold: 1500, blurb: 'White pieces cast in gold.' },
  { id: 'onyx', slot: 'finish', name: 'Onyx & Pearl', rarity: 'rare', gold: 1600, blurb: 'Pearl white against polished onyx.' },
  { id: 'emerald', slot: 'finish', name: 'Emerald Guard', rarity: 'epic', gold: 4500, blurb: 'Jade and emerald armies.' },
  { id: 'ruby', slot: 'finish', name: 'Ruby & Sapphire', rarity: 'epic', gold: 5000, blurb: 'Two royal houses: ruby against sapphire.' },
  { id: 'shadow', slot: 'finish', name: 'Shadow Legion', rarity: 'epic', gems: 75, blurb: 'Pieces wrapped in a violet aura.', animated: true },
  { id: 'crystal', slot: 'finish', name: 'Crystal Court', rarity: 'legendary', gems: 200, blurb: 'Clear crystal that catches the light.', animated: true },
  // ---- avatar frames (everyone sees them: profile, friends, Online now)
  { id: 'bronze', slot: 'frame', name: 'Bronze Ring', rarity: 'common', gold: 300, blurb: 'A first ring for a new knight.' },
  { id: 'oak', slot: 'frame', name: 'Oak Shield', rarity: 'common', gold: 400, blurb: 'Carved from the castle gate.' },
  { id: 'silver', slot: 'frame', name: 'Silver Battlements', rarity: 'rare', gold: 1500, blurb: 'The castle wall, in silver.' },
  { id: 'laurel', slot: 'frame', name: 'Golden Laurel', rarity: 'rare', gold: 2000, blurb: 'A champion’s wreath.' },
  { id: 'frostring', slot: 'frame', name: 'Frost Ring', rarity: 'epic', gold: 4500, blurb: 'Ice crystals around your picture.' },
  { id: 'crownring', slot: 'frame', name: 'Gilded Crown', rarity: 'epic', gold: 5500, blurb: 'A gold ring with a crown on top.' },
  { id: 'ember', slot: 'frame', name: 'Ember Halo', rarity: 'epic', gems: 80, blurb: 'A ring of living fire.', animated: true },
  { id: 'aurora', slot: 'frame', name: 'Aurora', rarity: 'legendary', gems: 160, blurb: 'The northern lights, turning slowly.', animated: true },
  { id: 'dragonhalo', slot: 'frame', name: 'Dragonfire Halo', rarity: 'legendary', gems: 220, blurb: 'Gold and flame, with a dragon’s glow.', animated: true },
  { id: 'founder', slot: 'frame', name: 'Founder’s Crest', rarity: 'royal', unlock: { founder: true }, blurb: 'For everyone who joined Chess Castles in its launch year.' },
  { id: 'centurion', slot: 'frame', name: 'Centurion Crest', rarity: 'royal', unlock: { streak: 100 }, blurb: 'For a 100-day streak.' },
  { id: 'champion', slot: 'frame', name: 'Cup Champion', rarity: 'royal', unlock: { cupWin: true }, blurb: 'For winning a Castle Cup.', animated: true },
  // ---- name styles
  { id: 'ngold', slot: 'name', name: 'Gold Leaf', rarity: 'rare', gold: 1200, blurb: 'Your name in gold.' },
  { id: 'nember', slot: 'name', name: 'Ember', rarity: 'rare', gold: 1400, blurb: 'Your name glowing like embers.' },
  { id: 'nfrost', slot: 'name', name: 'Frost', rarity: 'rare', gold: 1400, blurb: 'Your name in ice blue.' },
  { id: 'nroyal', slot: 'name', name: 'Royal Violet', rarity: 'epic', gold: 4000, blurb: 'The colour of kings.' },
  { id: 'nrainbow', slot: 'name', name: 'Rainbow', rarity: 'legendary', gems: 150, blurb: 'Every colour, moving.', animated: true },
  { id: 'nsovereign', slot: 'name', name: 'Sovereign', rarity: 'royal', unlock: { level: 30 }, blurb: 'Crimson and gold. For Level 30.' },
  // ---- profile banners
  { id: 'brook', slot: 'banner', name: 'Banner of the Rook', rarity: 'common', gold: 350, blurb: 'A tower against a clear sky.' },
  { id: 'bmoat', slot: 'banner', name: 'Moonlit Moat', rarity: 'common', gold: 450, blurb: 'The castle under a full moon.' },
  { id: 'btwilight', slot: 'banner', name: 'Twilight Ramparts', rarity: 'rare', gold: 1500, blurb: 'Purple dusk over the walls.' },
  { id: 'bmonsoon', slot: 'banner', name: 'Monsoon Fort', rarity: 'rare', gold: 1800, blurb: 'Clouds and rain over a hill fort.' },
  { id: 'bthrone', slot: 'banner', name: 'Throne Room', rarity: 'epic', gold: 4500, blurb: 'Red carpet, gold pillars.' },
  { id: 'bsiege', slot: 'banner', name: 'Siege at Dawn', rarity: 'legendary', gems: 180, blurb: 'The sun rises behind the castle.', animated: true },
  { id: 'bpennant', slot: 'banner', name: 'Squire’s Pennant', rarity: 'royal', unlock: { streak: 7 }, blurb: 'For your first 7-day streak.' },
  // ---- victory effects (after a game you won)
  { id: 'vconfetti', slot: 'victory', name: 'Confetti', rarity: 'common', gold: 300, blurb: 'A burst of confetti when you win.', animated: true },
  { id: 'vfireworks', slot: 'victory', name: 'Fireworks', rarity: 'rare', gold: 1500, blurb: 'Fireworks over the board.', animated: true },
  { id: 'vgoldrain', slot: 'victory', name: 'Golden Rain', rarity: 'epic', gold: 4500, blurb: 'Gold coins pour down.', animated: true },
  { id: 'vfanfare', slot: 'victory', name: 'Royal Fanfare', rarity: 'legendary', gems: 160, blurb: 'A crown, light rays and gold.', animated: true },
  // ---- sound packs (every move, capture, check and result; src/lib/sound.ts makes them, no sound files)
  { id: 'sarcade', slot: 'sound', name: 'Arcade', rarity: 'common', gold: 400, blurb: '8-bit blips and a power-up for every win.' },
  { id: 'scrystal', slot: 'sound', name: 'Crystal Bells', rarity: 'rare', gold: 1500, blurb: 'Glass bells that ring with every move.' },
  { id: 'smarble', slot: 'sound', name: 'Marble Hall', rarity: 'rare', gold: 1800, blurb: 'Stone clicks that echo round a great hall.' },
  { id: 'sroyal', slot: 'sound', name: 'Royal Court', rarity: 'epic', gold: 4500, blurb: 'Harp strings, and trumpets when you win.' },
  { id: 'sdrums', slot: 'sound', name: 'Dragon Drums', rarity: 'legendary', gems: 150, blurb: 'War drums, thunder on captures and a gong for victory.' },
  // ---- Gurus (owner, 2026-10-23: "one Guru is free; the others are unlocked, and teach in their own way"): Guruji is
  // everyone's; each of these opens one more (src/lib/coach/avatar.ts: the id after "g-" is the Guru's).
  { id: 'g-hoot', slot: 'guru', name: 'Professor Hoot', rarity: 'common', gold: 300, blurb: 'A wise owl who explains slowly, for young players.' },
  { id: 'g-gaja', slot: 'guru', name: 'Gaja', rarity: 'common', gold: 300, blurb: 'A gentle elephant from chaturanga, the first chess.' },
  { id: 'g-robo', slot: 'guru', name: 'Robo', rarity: 'common', gold: 350, blurb: 'A friendly chess robot with a quick, cheerful voice.' },
  { id: 'g-knight', slot: 'guru', name: 'Knight Guru', rarity: 'common', gold: 400, blurb: 'The Chess Castles knight, the very first Guru.' },
  { id: 'g-rohan', slot: 'guru', name: 'Coach Rohan', rarity: 'rare', gold: 800, blurb: 'A young titled coach: clear, quick and energetic.' },
  { id: 'g-meera', slot: 'guru', name: 'Coach Meera', rarity: 'rare', gold: 800, blurb: 'A patient coach who explains every idea step by step.' },
  { id: 'g-sheru', slot: 'guru', name: 'Sheru', rarity: 'epic', gems: 45, blurb: 'A playful tiger cub who roars at every good move.' },
  { id: 'g-anjali', slot: 'guru', name: 'Coach Anjali', rarity: 'epic', gems: 50, blurb: 'A warm, experienced coach with a lifelike voice.' },
  { id: 'g-arjun', slot: 'guru', name: 'Coach Arjun', rarity: 'epic', gems: 50, blurb: 'A calm, cheerful coach with a lifelike voice who loves a plan.' },
  // ---- Streak Shield: saves the streak on a missed day (at most 2 held)
  { id: 'shield', slot: 'shield', name: 'Streak Shield', rarity: 'common', gold: 250, blurb: 'Missed a day? A shield keeps your streak going.' },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, Item>;
export const MAX_SHIELDS = 2;
/** Royal items are won, not bought; the shop shows how. Everyone who starts in the launch year gets the Founder's Crest. */
export const FOUNDER_UNTIL = Date.UTC(2027, 0, 1);

// ---- earning

/** One thing the player did. `ref` makes it count once (a game id, an activity time); `score` for Puzzle Rush. */
export interface EarnEvent {
  kind: EarnKind;
  ref?: string;
  score?: number;
}

/**
 * What each thing pays, and how many a day pay (more still count for the daily quests). About 250 gold for half an
 * hour a day (3 games, 10 puzzles, a lesson, the quests): a Common item in two days, a Rare in a week.
 */
export const EARN = {
  win: { gold: 15, cap: 20 },
  winOnline: { gold: 25, cap: 20 },
  draw: { gold: 8, cap: 20 },
  loss: { gold: 4, cap: 20 },
  puzzle: { gold: 4, cap: 40 },
  puzzleClean: { gold: 6, cap: 40 },
  daily: { gold: 25, cap: 1 },
  vision: { gold: 3, cap: 20 },
  line: { gold: 8, cap: 20 },
  lesson: { gold: 25, cap: 8 },
  review: { gold: 10, cap: 3 },
  rush: { gold: 10, cap: 5 },
  race: { gold: 10, cap: 10 },
  raceWin: { gold: 20, cap: 10 },
  award: { gold: 50, gems: 3, cap: 10 },
  // Castle Cups: counted by the server from the cup results (never sent by a browser).
  cup: { gold: 30, cap: 5 },
  cupPodium: { gold: 150, gems: 6, cap: 5 },
  cupWin: { gold: 200, gems: 10, cap: 5 },
} as const;
export type EarnKind = keyof typeof EARN;

/**
 * Gems for steady work (owner, 2026-10-23: "give gems in every feature, but make sure they do not take advantage"):
 * every N-th thing of a kind done in a day, within that kind's gold cap, pays gems, and all of a day's gems from this
 * are capped (GEMS_PER_DAY). Doing more than the cap pays only a coin, so there is nothing to gain from grinding one thing.
 * The milestone gems (levels, streaks, awards, quests, cups) are separate and not counted here.
 */
export const GEM_EVERY: Partial<Record<EarnKind, { every: number; gems: number }>> = {
  win: { every: 5, gems: 1 },
  winOnline: { every: 3, gems: 1 },
  puzzleClean: { every: 10, gems: 1 },
  puzzle: { every: 15, gems: 1 },
  daily: { every: 1, gems: 1 },
  vision: { every: 4, gems: 1 },
  line: { every: 5, gems: 1 },
  lesson: { every: 2, gems: 1 },
  review: { every: 3, gems: 1 },
  rush: { every: 3, gems: 1 },
  race: { every: 5, gems: 1 },
  raceWin: { every: 3, gems: 1 },
};
/** The most gems a day's play and study can pay (the Shop's cheapest gem item costs 60). */
export const GEMS_PER_DAY = 12;
/** Past a kind's cap, up to this many times the cap, each one still pays a single coin (so a keen player sees it count). */
export const OVER_CAP_TIMES = 3;
/** The kinds a browser may send (the cup ones come from the server's own results). */
export const CLIENT_KINDS: EarnKind[] = ['win', 'winOnline', 'draw', 'loss', 'puzzle', 'puzzleClean', 'daily', 'vision', 'line', 'lesson', 'review', 'rush', 'race', 'raceWin', 'award'];

/** The 7-day calendar: the day of the calendar moves on with every visit (a missed day pauses it, never resets it). */
export const LADDER: { gold: number; gems: number }[] = [
  { gold: 25, gems: 0 },
  { gold: 35, gems: 0 },
  { gold: 50, gems: 0 },
  { gold: 60, gems: 0 },
  { gold: 75, gems: 1 },
  { gold: 100, gems: 0 },
  { gold: 150, gems: 5 },
];

/** Days in a row: gems at each milestone, and the Royal item it unlocks. */
export const MILESTONES: { days: number; gems: number; item?: string }[] = [
  { days: 3, gems: 2 },
  { days: 7, gems: 5, item: 'bpennant' },
  { days: 14, gems: 10 },
  { days: 30, gems: 25, item: 'coronation' },
  { days: 60, gems: 40 },
  { days: 100, gems: 75, item: 'centurion' },
  { days: 365, gems: 250 },
];

/** Three quests a day, one from each group (picked by the date, the same for everyone that day). */
export interface Quest {
  id: string;
  group: 'play' | 'puzzles' | 'learn';
  need: number;
  /** The kinds whose count (today) moves it on. */
  kinds: EarnKind[];
  gold: number;
}
export const QUESTS: Quest[] = [
  { id: 'win1', group: 'play', need: 1, kinds: ['win', 'winOnline'], gold: 40 },
  { id: 'play2', group: 'play', need: 2, kinds: ['win', 'winOnline', 'draw', 'loss'], gold: 35 },
  { id: 'play3', group: 'play', need: 3, kinds: ['win', 'winOnline', 'draw', 'loss'], gold: 50 },
  { id: 'puz5', group: 'puzzles', need: 5, kinds: ['puzzle', 'puzzleClean', 'daily'], gold: 30 },
  { id: 'puz10', group: 'puzzles', need: 10, kinds: ['puzzle', 'puzzleClean', 'daily'], gold: 50 },
  { id: 'rush1', group: 'puzzles', need: 1, kinds: ['rush'], gold: 30 },
  { id: 'race1', group: 'puzzles', need: 1, kinds: ['race'], gold: 30 },
  { id: 'daily1', group: 'puzzles', need: 1, kinds: ['daily'], gold: 30 },
  { id: 'learn1', group: 'learn', need: 1, kinds: ['lesson'], gold: 40 },
  { id: 'line2', group: 'learn', need: 2, kinds: ['line'], gold: 35 },
  { id: 'review1', group: 'learn', need: 1, kinds: ['review'], gold: 30 },
];
/** All three quests of the day done: a bonus. */
export const QUEST_BONUS = { gold: 50, gems: 2 };

/** A new treasury: a welcome gift, so a new player can buy a first item today. */
export const WELCOME = { gold: 500, gems: 25 };
/** A visitor's gold and gems carried into their account when they sign in (once, at most this). */
export const CARRY_MAX = { gold: 3000, gems: 60 };

// ---- levels (XP: every gold coin earned from play, study and visits; spending never lowers it)

/** The XP to reach a level: 0, 100, 300, 600, 1000… (level 10 in about three weeks of daily play). */
export const xpFor = (level: number) => 50 * level * (level - 1);
export function levelOf(xp: number): number {
  let n = 1;
  while (n < 99 && xpFor(n + 1) <= xp) n++;
  return n;
}
/** The castle rank a level carries. */
export const RANKS: { level: number; name: string }[] = [
  { level: 1, name: 'Pawn' },
  { level: 3, name: 'Squire' },
  { level: 6, name: 'Knight' },
  { level: 10, name: 'Castellan' },
  { level: 15, name: 'Baron' },
  { level: 20, name: 'Count' },
  { level: 25, name: 'Duke' },
  { level: 30, name: 'Prince' },
  { level: 40, name: 'Sovereign' },
  { level: 50, name: 'Legend' },
];
export const rankOf = (level: number) => [...RANKS].reverse().find((r) => level >= r.level)!.name;
/** Gems for reaching a level: 3, and 10 at every fifth. */
export const levelGems = (level: number) => (level % 5 === 0 ? 10 : 3);

// ---- the treasury

export interface Grant {
  /** What it was for: an EarnKind, 'login', 'quest', 'bonus', 'level', 'streak', 'welcome', 'carry', 'unlock'. */
  why: string;
  gold: number;
  gems: number;
  /** A Royal item won, or the quest/level/streak number. */
  item?: string;
  n?: number;
}

export interface LogEntry {
  at: number;
  why: string;
  gold: number;
  gems: number;
  item?: string;
}

export interface Wallet {
  v: 1;
  gold: number;
  gems: number;
  /** Every gold coin ever earned (not bought, not carried): the level. */
  xp: number;
  /** The level whose gems were paid (so a level pays once). */
  levelPaid: number;
  /** Items bought or won (the starter boards and piece sets are everyone's). */
  owned: string[];
  equipped: Partial<Record<WearSlot, string>>;
  shields: number;
  /** The daily visit: last day claimed ("2026-10-23"), days in a row, the best run, visits in all (the calendar's day). */
  login: { last: string; streak: number; best: number; total: number; saved: number };
  /** Streak milestones paid (days). */
  milestones: number[];
  /** Today: how many of each kind (for the caps and the quests) and the quests claimed. */
  today: { day: string; counts: Partial<Record<EarnKind, number>>; quests: string[]; bonus: boolean; /** Gems paid today for steady work (GEMS_PER_DAY). */ gems?: number };
  /** Recent refs, so a game or a puzzle pays once (the newest last). */
  refs: string[];
  /** Recent rewards and purchases, newest first. */
  log: LogEntry[];
  created: number;
  /** A visitor's treasury was carried in (once per account). */
  carried: boolean;
  /** Castle Cups counted so far (the server pays the difference); undefined until first seen. */
  cups?: { played: number; podiums: number; wins: number };
  /** What was done before the Treasury began has been paid (once: see historySync). */
  history?: true;
}

const MAX_REFS = 400;
const MAX_LOG = 60;

export function newWallet(now: number): { wallet: Wallet; grants: Grant[] } {
  const wallet: Wallet = {
    v: 1,
    gold: 0,
    gems: 0,
    xp: 0,
    levelPaid: 1,
    owned: [],
    equipped: {},
    shields: 0,
    login: { last: '', streak: 0, best: 0, total: 0, saved: 0 },
    milestones: [],
    today: { day: '', counts: {}, quests: [], bonus: false },
    refs: [],
    log: [],
    created: now,
    carried: false,
  };
  const grants: Grant[] = [];
  give(wallet, grants, { why: 'welcome', gold: WELCOME.gold, gems: WELCOME.gems }, now, false);
  settle(wallet, grants, now);
  return { wallet, grants };
}

/** A stored treasury, checked (a damaged or old one is mended rather than lost). */
export function cleanWallet(v: unknown, now: number): Wallet {
  const fresh = newWallet(now).wallet;
  if (!v || typeof v !== 'object') return fresh;
  const o = v as Partial<Wallet>;
  const n = (x: unknown, hi = 1e9) => (x !== null && x !== '' && Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.min(Math.floor(Number(x)), hi) : 0);
  const day = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');
  const equipped: Wallet['equipped'] = {};
  for (const s of WEAR_SLOTS) {
    const id = (o.equipped as Record<string, unknown> | undefined)?.[s];
    if (typeof id === 'string' && id) equipped[s] = id;
  }
  const counts: Wallet['today']['counts'] = {};
  for (const [k, c] of Object.entries(o.today?.counts ?? {})) if (k in EARN) counts[k as EarnKind] = n(c, 10_000);
  return {
    v: 1,
    gold: n(o.gold),
    gems: n(o.gems),
    xp: n(o.xp),
    levelPaid: Math.max(1, n(o.levelPaid, 99)),
    owned: Array.isArray(o.owned) ? [...new Set(o.owned.filter((id): id is string => typeof id === 'string' && id in ITEM))] : [],
    equipped,
    shields: Math.min(n(o.shields), MAX_SHIELDS),
    login: { last: day(o.login?.last), streak: n(o.login?.streak, 100_000), best: n(o.login?.best, 100_000), total: n(o.login?.total, 100_000), saved: n(o.login?.saved, 100_000) },
    milestones: Array.isArray(o.milestones) ? o.milestones.filter((m): m is number => MILESTONES.some((x) => x.days === m)) : [],
    today: { day: day(o.today?.day), counts, quests: Array.isArray(o.today?.quests) ? o.today.quests.filter((q): q is string => QUESTS.some((x) => x.id === q)) : [], bonus: !!o.today?.bonus, gems: n(o.today?.gems, 1000) },
    refs: Array.isArray(o.refs) ? o.refs.filter((r): r is string => typeof r === 'string').slice(-MAX_REFS) : [],
    log: Array.isArray(o.log)
      ? o.log
          .filter((e): e is LogEntry => !!e && typeof e === 'object' && typeof (e as LogEntry).why === 'string')
          .slice(0, MAX_LOG)
          .map((e) => ({ at: n(e.at, 1e15), why: e.why.slice(0, 20), gold: Math.trunc(Number(e.gold) || 0), gems: Math.trunc(Number(e.gems) || 0), ...(typeof e.item === 'string' ? { item: e.item } : {}) }))
      : [],
    created: n(o.created, 1e15) || now,
    carried: !!o.carried,
    cups: o.cups && typeof o.cups === 'object' ? { played: n(o.cups.played), podiums: n(o.cups.podiums), wins: n(o.cups.wins) } : undefined,
    ...(o.history === true ? { history: true as const } : {}),
  };
}

function give(w: Wallet, grants: Grant[], g: Grant, now: number, xp = true) {
  if (!g.gold && !g.gems && !g.item) return;
  w.gold += g.gold;
  w.gems += g.gems;
  if (xp) w.xp += g.gold;
  grants.push(g);
  w.log.unshift({ at: now, why: g.why, gold: g.gold, gems: g.gems, ...(g.item ? { item: g.item } : {}) });
  if (w.log.length > MAX_LOG) w.log.length = MAX_LOG;
}

/** Whether a Royal item's condition is met. */
export function unlocked(w: Wallet, item: Item): boolean {
  const u = item.unlock;
  if (!u) return false;
  if ('streak' in u) return w.login.best >= u.streak;
  if ('level' in u) return levelOf(w.xp) >= u.level;
  if ('cupWin' in u) return (w.cups?.wins ?? 0) > 0;
  return w.created < FOUNDER_UNTIL;
}

/** Level gems, streak milestones and Royal items: paid once each, after any change. */
function settle(w: Wallet, grants: Grant[], now: number) {
  const level = levelOf(w.xp);
  while (w.levelPaid < level) {
    w.levelPaid++;
    give(w, grants, { why: 'level', gold: 0, gems: levelGems(w.levelPaid), n: w.levelPaid }, now, false);
  }
  for (const m of MILESTONES) {
    if (w.login.best < m.days || w.milestones.includes(m.days)) continue;
    w.milestones.push(m.days);
    give(w, grants, { why: 'streak', gold: 0, gems: m.gems, n: m.days }, now, false);
  }
  for (const item of ITEMS) {
    if (item.rarity !== 'royal' || w.owned.includes(item.id) || !unlocked(w, item)) continue;
    w.owned.push(item.id);
    grants.push({ why: 'unlock', gold: 0, gems: 0, item: item.id });
    w.log.unshift({ at: now, why: 'unlock', gold: 0, gems: 0, item: item.id });
  }
}

/** A new day: today's counts and quests start again (a day earlier than the last one seen counts as the same day). */
function roll(w: Wallet, day: string) {
  if (w.today.day === day || (w.today.day && day < w.today.day)) return;
  w.today = { day, counts: {}, quests: [], bonus: false, gems: 0 };
}

export type Result = { ok: true; wallet: Wallet; grants: Grant[] } | { ok: false; wallet: Wallet; error: string };

/** One thing done: its gold (up to the day's cap), counted for the quests. Each ref pays once. */
export function earn(w0: Wallet, ev: EarnEvent, day: string, now: number): Result {
  const w = structuredClone(w0);
  const rule = EARN[ev.kind];
  if (!rule) return { ok: false, wallet: w0, error: 'unknown' };
  if (ev.ref) {
    const ref = String(ev.ref).slice(0, 64);
    if (w.refs.includes(ref)) return { ok: true, wallet: w0, grants: [] };
    w.refs.push(ref);
    if (w.refs.length > MAX_REFS) w.refs.splice(0, w.refs.length - MAX_REFS);
  }
  roll(w, day);
  const count = (w.today.counts[ev.kind] ?? 0) + 1;
  w.today.counts[ev.kind] = count;
  const grants: Grant[] = [];
  if (count <= rule.cap) {
    const bonus = ev.kind === 'rush' ? Math.min(30, Math.floor(Math.max(0, Number(ev.score) || 0) / 2)) : 0;
    let gems = 'gems' in rule ? rule.gems : 0;
    // Steady work: every N-th one of the day pays gems (up to the day's limit).
    const every = GEM_EVERY[ev.kind];
    if (every && count % every.every === 0 && (w.today.gems ?? 0) < GEMS_PER_DAY) {
      gems += every.gems;
      w.today.gems = (w.today.gems ?? 0) + every.gems;
    }
    give(w, grants, { why: ev.kind, gold: rule.gold + bonus, gems }, now);
  } else if (rule.cap >= 10 && count <= rule.cap * OVER_CAP_TIMES) {
    give(w, grants, { why: ev.kind, gold: 1, gems: 0 }, now);
  }
  settle(w, grants, now);
  return { ok: true, wallet: w, grants };
}

const dayNumber = (day: string) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000);
/** Days from one date to another ("2026-10-22" to "2026-10-23": 1). */
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);

/** Whether today's visit reward is waiting. */
export const canClaim = (w: Wallet, day: string) => w.login.last !== day && (!w.login.last || w.login.last < day);
/** The calendar's day (0–6) the next visit pays. */
export const ladderDay = (w: Wallet) => w.login.total % LADDER.length;
/** The streak as it stands today (0 if a day was missed and no shield can save it). */
export function liveStreak(w: Wallet, day: string): number {
  if (!w.login.last) return 0;
  const gap = daysBetween(w.login.last, day);
  if (gap <= 1) return w.login.streak;
  return gap - 1 <= w.shields ? w.login.streak : 0;
}

/** Today's visit: the calendar's reward, the streak (a shield covers a missed day), milestones. */
export function claimDaily(w0: Wallet, day: string, now: number): Result {
  if (!canClaim(w0, day)) return { ok: false, wallet: w0, error: 'claimed' };
  const w = structuredClone(w0);
  roll(w, day);
  const gap = w.login.last ? daysBetween(w.login.last, day) : 1;
  if (gap === 1) w.login.streak++;
  else if (gap > 1 && gap - 1 <= w.shields) {
    w.shields -= gap - 1;
    w.login.saved += gap - 1;
    w.login.streak++;
  } else w.login.streak = 1;
  w.login.best = Math.max(w.login.best, w.login.streak);
  const step = LADDER[ladderDay(w)];
  w.login.total++;
  w.login.last = day;
  const grants: Grant[] = [];
  give(w, grants, { why: 'login', gold: step.gold, gems: step.gems, n: w.login.total }, now);
  settle(w, grants, now);
  return { ok: true, wallet: w, grants };
}

/** A simple hash of a string (for picking the day's quests and deals: the same for everyone, every device). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The day's three quests: one to play, one with puzzles, one to learn. */
export function questsFor(day: string): Quest[] {
  return (['play', 'puzzles', 'learn'] as const).map((g, i) => {
    const pool = QUESTS.filter((q) => q.group === g);
    return pool[hash(`${day}:${i}`) % pool.length];
  });
}
export const questProgress = (w: Wallet, q: Quest, day: string) => (w.today.day === day ? q.kinds.reduce((s, k) => s + (w.today.counts[k] ?? 0), 0) : 0);

/** A finished quest's gold (and, with all three, the bonus). */
export function claimQuest(w0: Wallet, id: string, day: string, now: number): Result {
  const q = questsFor(day).find((x) => x.id === id);
  if (!q) return { ok: false, wallet: w0, error: 'not-today' };
  if (w0.today.day === day && w0.today.quests.includes(id)) return { ok: false, wallet: w0, error: 'claimed' };
  if (questProgress(w0, q, day) < q.need) return { ok: false, wallet: w0, error: 'not-done' };
  const w = structuredClone(w0);
  roll(w, day);
  w.today.quests.push(id);
  const grants: Grant[] = [];
  give(w, grants, { why: 'quest', gold: q.gold, gems: 0, item: id }, now);
  if (!w.today.bonus && questsFor(day).every((x) => w.today.quests.includes(x.id))) {
    w.today.bonus = true;
    give(w, grants, { why: 'bonus', gold: QUEST_BONUS.gold, gems: QUEST_BONUS.gems }, now);
  }
  settle(w, grants, now);
  return { ok: true, wallet: w, grants };
}

/** Today's deals: three items a quarter off (Common to Epic, not owned by many yet: picked by the date). */
export const DEAL_OFF = 0.25;
export function dealsFor(day: string): string[] {
  const pool = ITEMS.filter((i) => i.slot !== 'shield' && (i.rarity === 'common' || i.rarity === 'rare' || i.rarity === 'epic'));
  const out: string[] = [];
  for (let k = 0; out.length < 3 && k < 50; k++) {
    const id = pool[hash(`deal:${day}:${k}`) % pool.length].id;
    if (!out.includes(id) && !out.some((o) => ITEM[o].slot === ITEM[id].slot)) out.push(id);
  }
  return out;
}

/** What an item costs today (a deal is a quarter off), in its currency. */
export function priceOf(item: Item, day: string): { currency: Currency; amount: number; was?: number } | undefined {
  const currency: Currency | undefined = item.gold ? 'gold' : item.gems ? 'gems' : undefined;
  if (!currency) return undefined;
  const full = (item.gold ?? item.gems)!;
  if (!dealsFor(day).includes(item.id)) return { currency, amount: full };
  return { currency, amount: Math.round((full * (1 - DEAL_OFF)) / 5) * 5, was: full };
}

export const owns = (w: Wallet, id: string) => STARTER_BOARDS.includes(id) || STARTER_PIECES.includes(id) || STARTER_SOUNDS.includes(id) || w.owned.includes(id);

export function buy(w0: Wallet, id: string, day: string, now: number): Result {
  const item = ITEM[id];
  if (!item) return { ok: false, wallet: w0, error: 'unknown' };
  if (item.rarity === 'royal') return { ok: false, wallet: w0, error: 'royal' };
  if (item.slot === 'shield' ? w0.shields >= MAX_SHIELDS : owns(w0, id)) return { ok: false, wallet: w0, error: 'owned' };
  const price = priceOf(item, day);
  if (!price) return { ok: false, wallet: w0, error: 'unknown' };
  if (w0[price.currency] < price.amount) return { ok: false, wallet: w0, error: 'short' };
  const w = structuredClone(w0);
  w[price.currency] -= price.amount;
  if (item.slot === 'shield') w.shields++;
  else w.owned.push(id);
  w.log.unshift({ at: now, why: 'buy', gold: price.currency === 'gold' ? -price.amount : 0, gems: price.currency === 'gems' ? -price.amount : 0, item: id });
  if (w.log.length > MAX_LOG) w.log.length = MAX_LOG;
  return { ok: true, wallet: w, grants: [] };
}

/** Wears an item ('' takes it off); only what the player owns (or a starter board or piece set). */
export function equip(w0: Wallet, slot: WearSlot, id: string): Result {
  if (!WEAR_SLOTS.includes(slot)) return { ok: false, wallet: w0, error: 'slot' };
  if (id) {
    const starter = (slot === 'board' && STARTER_BOARDS.includes(id)) || (slot === 'pieces' && STARTER_PIECES.includes(id)) || (slot === 'sound' && STARTER_SOUNDS.includes(id));
    if (!starter && (ITEM[id]?.slot !== slot || !owns(w0, id))) return { ok: false, wallet: w0, error: 'not-owned' };
  }
  const w = structuredClone(w0);
  if (id) w.equipped[slot] = id;
  else delete w.equipped[slot];
  return { ok: true, wallet: w, grants: [] };
}

/** A visitor's gold and gems carried into the account, once, up to CARRY_MAX. */
export function carry(w0: Wallet, gold: number, gems: number, now: number): Result {
  if (w0.carried) return { ok: false, wallet: w0, error: 'carried' };
  const w = structuredClone(w0);
  w.carried = true;
  const grants: Grant[] = [];
  const g = Math.min(CARRY_MAX.gold, Math.max(0, Math.floor(gold) || 0));
  const m = Math.min(CARRY_MAX.gems, Math.max(0, Math.floor(gems) || 0));
  give(w, grants, { why: 'carry', gold: g, gems: m }, now, false);
  return { ok: true, wallet: w, grants };
}

/** Castle Cups since last time (the server, from its own results): the first look only notes where things stand. */
export function cupSync(w0: Wallet, played: number, podiums: number, wins: number, day: string, now: number): Result {
  if (!w0.cups) {
    const w = structuredClone(w0);
    w.cups = { played, podiums, wins };
    const grants: Grant[] = [];
    settle(w, grants, now);
    return { ok: true, wallet: w, grants };
  }
  let w = w0;
  const grants: Grant[] = [];
  const pay = (kind: 'cup' | 'cupPodium' | 'cupWin', n: number) => {
    for (let i = 0; i < Math.min(n, 5); i++) {
      const r = earn(w, { kind }, day, now);
      if (r.ok) {
        w = r.wallet;
        grants.push(...r.grants);
      }
    }
  };
  const before = w0.cups;
  if (played <= before.played && podiums <= before.podiums && wins <= before.wins) return { ok: true, wallet: w0, grants: [] };
  w = structuredClone(w0);
  w.cups = { played: Math.max(played, before.played), podiums: Math.max(podiums, before.podiums), wins: Math.max(wins, before.wins) };
  pay('cup', played - before.played);
  pay('cupPodium', podiums - before.podiums);
  pay('cupWin', wins - before.wins);
  const extra: Grant[] = [];
  settle(w, extra, now);
  return { ok: true, wallet: w, grants: [...grants, ...extra] };
}

/**
 * What a player did before the Treasury began (owner, 2026-10-23: "from day one, whoever played puzzles and did the study,
 * give coin and gems accordingly"). The server counts it from its own records of the account (the progress the site
 * sends with every change, and the rated games it checked), never from what a browser says.
 */
export interface History {
  /** Rated puzzles solved. */
  puzzles: number;
  /** Puzzle Rush and Rush Unlimited runs. */
  rushRuns: number;
  races: number;
  raceWins: number;
  /** Rated games against the FIDE-level opponents, by result. */
  wins: number;
  draws: number;
  losses: number;
  /** Awards the account had won. */
  awards: string[];
}
/** The most a player's past can pay (the first weeks of play and study are worth about this). */
export const HISTORY_MAX = { gold: 6000, gems: 60 };
/** What the past pays per thing: a little below the live rates, as no daily caps applied then (puzzles ~ the average of 4 and 6). */
export const HISTORY_RATE = { puzzle: 5, rush: 10, race: 10, raceWin: 20, win: 15, draw: 8, loss: 4 } as const;
/** The past, paid once: gold for what was done (at the rates above, up to HISTORY_MAX), and an award's pay for each award not paid already. */
export function historySync(w0: Wallet, h: History, now: number): Result {
  if (w0.history) return { ok: true, wallet: w0, grants: [] };
  const w = structuredClone(w0);
  w.history = true;
  const grants: Grant[] = [];
  const c = (x: number) => Math.max(0, Math.min(100_000, Math.floor(Number(x)) || 0));
  const R = HISTORY_RATE;
  const play = c(h.wins) * R.win + c(h.draws) * R.draw + c(h.losses) * R.loss;
  const study = c(h.puzzles) * R.puzzle + c(h.rushRuns) * R.rush;
  const racer = c(h.races) * R.race + c(h.raceWins) * R.raceWin;
  const owed = h.awards.filter((id) => !w.refs.includes('a:' + id)).length;
  const gold = Math.min(HISTORY_MAX.gold, play + study + racer + owed * EARN.award.gold);
  const gems = Math.min(HISTORY_MAX.gems, owed * EARN.award.gems);
  give(w, grants, { why: 'history', gold, gems }, now, true);
  settle(w, grants, now);
  return { ok: true, wallet: w, grants };
}

/** Gems for each friend who joins with a player's invite link (owner, 2026-10-23: "give 3 diamonds, so they add their parents and friends"), for the first INVITE_MAX friends. */
export const INVITE_REWARD = { gems: 3 };
export const INVITE_MAX = 20;

/** A gift of gold and gems from an admin (owner, 2026-10-23: "reward some gems if I want"; also an admin's top-up to test the Shop): no caps, no level XP. */
export function gift(w0: Wallet, gold: number, gems: number, now: number, why = 'gift'): Result {
  const w = structuredClone(w0);
  const grants: Grant[] = [];
  const g = Math.max(0, Math.min(1_000_000, Math.floor(Number(gold)) || 0));
  const m = Math.max(0, Math.min(100_000, Math.floor(Number(gems)) || 0));
  give(w, grants, { why, gold: g, gems: m }, now, false);
  return { ok: true, wallet: w, grants };
}
/** An admin takes any item, Royal ones too (to test what each looks like): the item is owned, nothing is spent. */
export function adminOwn(w0: Wallet, id: string, now: number): Result {
  const item = ITEM[id];
  if (!item) return { ok: false, wallet: w0, error: 'unknown' };
  if (item.slot === 'shield' || owns(w0, id)) return { ok: false, wallet: w0, error: 'owned' };
  const w = structuredClone(w0);
  w.owned.push(id);
  w.log.unshift({ at: now, why: 'gift', gold: 0, gems: 0, item: id });
  if (w.log.length > MAX_LOG) w.log.length = MAX_LOG;
  return { ok: true, wallet: w, grants: [] };
}

/** What everyone may see of a player's treasury: what they wear, and their level. */
export interface PublicLook {
  level: number;
  frame?: string;
  name?: string;
  banner?: string;
  board?: string;
  pieces?: string;
  finish?: string;
}
export function publicLook(w: Wallet): PublicLook {
  const e = w.equipped;
  return { level: levelOf(w.xp), ...(e.frame ? { frame: e.frame } : {}), ...(e.name ? { name: e.name } : {}), ...(e.banner ? { banner: e.banner } : {}), ...(e.board ? { board: e.board } : {}), ...(e.pieces ? { pieces: e.pieces } : {}), ...(e.finish ? { finish: e.finish } : {}) };
}
