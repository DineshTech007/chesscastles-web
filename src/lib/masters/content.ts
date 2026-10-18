import type { L10n } from '$lib/coach/i18n';

/**
 * "Endgames with the masters": real endgames from great players' tournament
 * games (CaissaBase, classical over-the-board games only), checked move by
 * move with Stockfish (scripts/masters/). The student plays the master's side.
 */

export type Group = 'today' | 'india' | 'women' | 'legends';
export interface Teacher {
  /** A key of LEGENDS (name and bio). */
  id: string;
  group: Group;
  /** The country, in words (no flags or photos). */
  country: string;
}

export const GROUPS: { id: Group; label: string }[] = [
  { id: 'india', label: 'Stars of India' },
  { id: 'today', label: "Today's world stars" },
  { id: 'women', label: "Women's champions" },
  { id: 'legends', label: 'Endgame legends' },
];

export const TEACHERS: Teacher[] = [
  { id: 'gukesh', group: 'india', country: 'India' },
  { id: 'pragg', group: 'india', country: 'India' },
  { id: 'arjun', group: 'india', country: 'India' },
  { id: 'anand', group: 'india', country: 'India' },
  { id: 'carlsen', group: 'today', country: 'Norway' },
  { id: 'caruana', group: 'today', country: 'USA' },
  { id: 'giri', group: 'today', country: 'Netherlands' },
  { id: 'kramnik', group: 'today', country: 'Russia' },
  { id: 'humpy', group: 'women', country: 'India' },
  { id: 'harika', group: 'women', country: 'India' },
  { id: 'vaishali', group: 'women', country: 'India' },
  { id: 'houyifan', group: 'women', country: 'China' },
  { id: 'polgar', group: 'women', country: 'Hungary' },
  { id: 'capablanca', group: 'legends', country: 'Cuba' },
  { id: 'rubinstein', group: 'legends', country: 'Poland' },
  { id: 'smyslov', group: 'legends', country: 'Russia' },
  { id: 'karpov', group: 'legends', country: 'Russia' },
  { id: 'fischer', group: 'legends', country: 'USA' },
];

export type Cat = 'pawn' | 'rook' | 'minor' | 'rook-minor' | 'rook-vs-minor' | 'queen';
export type MinorKind = 'same-bishops' | 'opposite-bishops' | 'knights' | 'knight-bishop';
export type Goal = 'win' | 'squeeze' | 'hold';

export const CATS: { id: Cat; name: string; short: string; tip: L10n }[] = [
  {
    id: 'pawn',
    name: 'Pawn endgames',
    short: 'Pawn endgame',
    tip: {
      en: 'In a pawn endgame the king is the strongest piece. Bring it forward, use the opposition, and count the moves carefully: one tempo can decide the game.',
      hi: 'Pawn endgame में king सबसे ताक़तवर piece होता है। उसे आगे लाओ, opposition का इस्तेमाल करो, और moves ध्यान से गिनो: एक tempo से game का फ़ैसला हो सकता है।',
      mr: 'Pawn endgame मध्ये king सगळ्यात ताकदवान piece असतो. त्याला पुढे आण, opposition वापर, आणि moves नीट मोज: एका tempo ने game चा निकाल लागू शकतो.',
    },
  },
  {
    id: 'rook',
    name: 'Rook endgames',
    short: 'Rook endgame',
    tip: {
      en: 'The most common endgame of all. Keep your rook active, put it behind passed pawns, and bring your king up. An active rook is often worth a pawn.',
      hi: 'यह सबसे आम endgame है। अपना rook active रखो, उसे passed pawns के पीछे रखो, और king को आगे लाओ। Active rook अक्सर एक pawn के बराबर होता है।',
      mr: 'हा सगळ्यात जास्त येणारा endgame आहे. तुझा rook active ठेव, त्याला passed pawns च्या मागे ठेव, आणि king पुढे आण. Active rook बऱ्याचदा एका pawn इतका मौल्यवान असतो.',
    },
  },
  {
    id: 'minor',
    name: 'Bishop and knight endgames',
    short: 'Minor piece endgame',
    tip: {
      en: 'With only bishops and knights left, the kings come to the centre and passed pawns become very strong.',
      hi: 'जब सिर्फ़ bishops और knights बचते हैं, तब kings centre में आते हैं और passed pawns बहुत ताक़तवर हो जाते हैं।',
      mr: 'फक्त bishops आणि knights उरले की kings centre मध्ये येतात आणि passed pawns खूप ताकदवान होतात.',
    },
  },
  {
    id: 'rook-minor',
    name: 'Rook and minor piece',
    short: 'Rook and minor piece endgame',
    tip: {
      en: 'With more pieces on the board, improve them one by one: find your worst piece and make it better, and look for weak pawns to attack.',
      hi: 'जब board पर ज़्यादा pieces हों, तो उन्हें एक-एक करके बेहतर बनाओ: अपना सबसे कमज़ोर piece ढूँढो और उसे बेहतर जगह पर लाओ, और attack करने के लिए weak pawns ढूँढो।',
      mr: 'Board वर जास्त pieces असले की ते एक-एक करून सुधार: तुझा सगळ्यात कमकुवत piece शोध आणि त्याला चांगल्या जागी आण, आणि attack करायला weak pawns शोध.',
    },
  },
  {
    id: 'rook-vs-minor',
    name: 'Rook against a bishop or knight',
    short: 'Rook against minor piece',
    tip: {
      en: 'A rook is stronger than a bishop or a knight. The side with the rook attacks pawns and creates a passed pawn; the defender keeps the pawns together on safe squares.',
      hi: 'Rook, bishop या knight से ज़्यादा ताक़तवर है। Rook वाला side pawns पर attack करता है और passed pawn बनाता है; बचाने वाला अपने pawns को साथ और safe squares पर रखता है।',
      mr: 'Rook हा bishop किंवा knight पेक्षा ताकदवान असतो. Rook असलेली बाजू pawns वर attack करते आणि passed pawn बनवते; बचाव करणारा आपले pawns एकत्र आणि safe squares वर ठेवतो.',
    },
  },
  {
    id: 'queen',
    name: 'Queen endgames',
    short: 'Queen endgame',
    tip: {
      en: 'In queen endgames checks come from everywhere. Keep your king safe from checks, and push the passed pawn: it is the most important thing on the board.',
      hi: 'Queen endgames में checks हर तरफ़ से आते हैं। अपने king को checks से safe रखो, और passed pawn को आगे बढ़ाओ: board पर वही सबसे ज़रूरी चीज़ है।',
      mr: 'Queen endgames मध्ये checks सगळीकडून येतात. तुझा king checks पासून safe ठेव, आणि passed pawn पुढे ढकल: board वरची तीच सगळ्यात महत्त्वाची गोष्ट आहे.',
    },
  },
];

export const KIND_TIP: Record<MinorKind, L10n> = {
  'same-bishops': {
    en: 'Bishops of the same colour: put your pawns on the other colour, so your bishop is free and theirs has targets.',
    hi: 'एक ही रंग के bishops: अपने pawns दूसरे रंग के squares पर रखो, ताकि तुम्हारा bishop आज़ाद रहे और उनके bishop को निशाने मिलें।',
    mr: 'एकाच रंगाचे bishops: तुझे pawns दुसऱ्या रंगाच्या squares वर ठेव, म्हणजे तुझा bishop मोकळा राहील आणि त्यांच्या bishop ला निशाणे मिळतील.',
  },
  'opposite-bishops': {
    en: 'Bishops of opposite colours often end in a draw, even a pawn or two down: the defender stops the pawns on squares the other bishop can never reach.',
    hi: 'अलग-अलग रंग के bishops में अक्सर draw होता है, एक-दो pawn कम होकर भी: बचाने वाला pawns को उन squares पर रोकता है जहाँ दूसरा bishop कभी नहीं पहुँच सकता।',
    mr: 'वेगवेगळ्या रंगाचे bishops असले की बऱ्याचदा draw होतो, एक-दोन pawn कमी असूनही: बचाव करणारा pawns ना अशा squares वर थांबवतो जिथे दुसरा bishop कधीच पोहोचू शकत नाही.',
  },
  knights: {
    en: 'Knight endgames are a lot like pawn endgames: the king must be active, and a passed pawn far from the other pieces is very hard for a knight to stop.',
    hi: 'Knight endgames काफ़ी हद तक pawn endgames जैसे होते हैं: king active होना चाहिए, और दूर वाला passed pawn knight के लिए रोकना बहुत मुश्किल होता है।',
    mr: 'Knight endgames बरेचसे pawn endgames सारखे असतात: king active हवा, आणि लांबचा passed pawn थांबवणं knight ला खूप अवघड जातं.',
  },
  'knight-bishop': {
    en: 'Knight against bishop: the bishop loves open boards with pawns on both sides, the knight loves closed positions with all the pawns on one side.',
    hi: 'Knight बनाम bishop: bishop को खुला board पसंद है जहाँ दोनों तरफ़ pawns हों, knight को बंद position पसंद है जहाँ सारे pawns एक तरफ़ हों।',
    mr: 'Knight विरुद्ध bishop: bishop ला दोन्ही बाजूंना pawns असलेला मोकळा board आवडतो, knight ला सगळे pawns एका बाजूला असलेली बंद position आवडते.',
  },
};

export const KIND_NAME: Record<MinorKind, string> = {
  'same-bishops': 'Bishops',
  'opposite-bishops': 'Opposite-coloured bishops',
  knights: 'Knights',
  'knight-bishop': 'Knight against bishop',
};

export const GOALS: Record<Goal, { label: string; text: L10n }> = {
  win: {
    label: 'Win it',
    text: {
      en: '{teacher} is better here. Your task: find {teacher}\'s moves and win it.',
      hi: 'यहाँ {teacher} बेहतर हैं। तुम्हारा काम: {teacher} की moves ढूँढो और game जीतो।',
      mr: 'इथे {teacher} चांगल्या स्थितीत आहे. तुझं काम: {teacher} च्या moves शोध आणि game जिंक.',
    },
  },
  squeeze: {
    label: 'Outplay',
    text: {
      en: 'The position is about equal, but {teacher} keeps pressing. Find the moves that slowly outplay the opponent.',
      hi: 'Position लगभग बराबर है, लेकिन {teacher} दबाव बनाए रखते हैं। वो moves ढूँढो जिनसे धीरे-धीरे सामने वाला पिछड़ जाता है।',
      mr: 'Position जवळपास बरोबरीची आहे, पण {teacher} दबाव ठेवतो. अशा moves शोध ज्यांनी हळूहळू समोरचा मागे पडतो.',
    },
  },
  hold: {
    label: 'Defend',
    text: {
      en: '{teacher} is worse here. Your task: defend like {teacher} and hold the draw.',
      hi: 'यहाँ {teacher} कमज़ोर स्थिति में हैं। तुम्हारा काम: {teacher} की तरह बचाव करो और draw बचाओ।',
      mr: 'इथे {teacher} कमकुवत स्थितीत आहे. तुझं काम: {teacher} सारखा बचाव कर आणि draw वाचव.',
    },
  },
};

/** Guru's lines during a lesson ({teacher} short name, {full} name, {opponent}, {san}, {event} with its year). */
export const SAY = {
  game: {
    en: '{full} against {opponent}, {event}. You play {teacher}\'s pieces.',
    hi: '{full} बनाम {opponent}, {event}। तुम {teacher} के pieces से खेलोगे।',
    mr: '{full} विरुद्ध {opponent}, {event}. तू {teacher} चे pieces खेळणार आहेस.',
  },
  middlegame: {
    en: 'The opening is over. Your task: play the middlegame the way {teacher} did, move by move.',
    hi: 'Opening ख़त्म हो गई। तुम्हारा काम: middlegame वैसे ही खेलो जैसे {teacher} ने खेला, एक-एक move करके।',
    mr: 'Opening संपली. तुझं काम: middlegame तसाच खेळ जसा {teacher} ने खेळला, एक-एक move करत.',
  },
  yourMove: { en: 'Your move: what did {teacher} play?', hi: 'तुम्हारी move: {teacher} ने क्या खेला?', mr: 'तुझी move: {teacher} ने काय खेळलं?' },
  correct: { en: 'Yes! {teacher} played {san}.', hi: 'हाँ! {teacher} ने {san} खेला।', mr: 'हो! {teacher} ने {san} खेळलं.' },
  only: { en: 'This was the only good move!', hi: 'यही एक अच्छी move थी!', mr: 'हीच एकमेव चांगली move होती!' },
  alsoGood: {
    en: 'Good move too! {teacher} played {san}, so we follow the game.',
    hi: 'यह भी अच्छी move है! {teacher} ने {san} खेला, तो हम game के साथ चलते हैं।',
    mr: 'ही पण चांगली move आहे! {teacher} ने {san} खेळलं, म्हणून आपण game प्रमाणे पुढे जाऊ.',
  },
  retry: { en: 'Not quite: that lets the advantage slip. Try another move.', hi: 'पूरी तरह नहीं: इससे फ़ायदा हाथ से निकल जाता है। कोई और move try करो।', mr: 'नक्की नाही: यामुळे फायदा हातातून जातो. दुसरी move try कर.' },
  retryHold: { en: 'Not quite: that makes the defence harder. Try another move.', hi: 'पूरी तरह नहीं: इससे बचाव और मुश्किल हो जाता है। कोई और move try करो।', mr: 'नक्की नाही: यामुळे बचाव आणखी अवघड होतो. दुसरी move try कर.' },
  reveal: { en: '{teacher} played {san}.', hi: '{teacher} ने {san} खेला।', mr: '{teacher} ने {san} खेळलं.' },
  reply: { en: '{opponent} answers {san}.', hi: '{opponent} जवाब में {san} खेलते हैं।', mr: '{opponent} उत्तर म्हणून {san} खेळतात.' },
  endWin: { en: 'And that is the game: {teacher} won!', hi: 'और game ख़त्म: {teacher} जीत गए!', mr: 'आणि game संपला: {teacher} जिंकला!' },
  endDraw: { en: 'And that is the game: a draw. Well defended!', hi: 'और game ख़त्म: draw। बढ़िया बचाव!', mr: 'आणि game संपला: draw. मस्त बचाव!' },
  decisive: { en: 'Now the win is clear. {teacher} went on to win this game.', hi: 'अब जीत साफ़ है। {teacher} ने यह game जीत लिया।', mr: 'आता जिंकणं नक्की आहे. {teacher} ने हा game जिंकला.' },
  laterWin: { en: 'The game went on from here, and {teacher} won in the end.', hi: 'यहाँ से game आगे चला, और आख़िर में {teacher} जीत गए।', mr: 'इथून game पुढे चालला, आणि शेवटी {teacher} जिंकला.' },
  laterDraw: { en: 'The game went on from here and ended in a draw: {teacher} held it.', hi: 'यहाँ से game आगे चला और draw पर ख़त्म हुआ: {teacher} ने बचा लिया।', mr: 'इथून game पुढे चालला आणि draw झाला: {teacher} ने वाचवला.' },
} satisfies Record<string, L10n>;

/** "Nakamura, Hi" -> "Nakamura"; "Carlsen, Magnus" -> "Magnus Carlsen". */
export function playerName(raw: string): string {
  const [last, first] = raw.split(',').map((s) => s.trim());
  if (!first) return last;
  const clean = first.replace(/\./g, '');
  return clean.length >= 3 && !/^[A-Z]{1,2}$/.test(clean) ? `${clean} ${last}` : last;
}

/** The name a teacher is called by: "Carlsen", "Gukesh" (not "D"), "Pragg". */
export function shortName(full: string): string {
  if (full.startsWith('Praggnanandhaa')) return 'Pragg';
  const parts = full.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? full;
  return last.length <= 2 ? parts[0] : last;
}
