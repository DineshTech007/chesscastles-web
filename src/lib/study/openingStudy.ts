import type { L10n } from '$lib/coach/i18n';
import { polyglotKey } from '$lib/chess/polyglot';
import { playSans } from '$lib/chess/position';
import type { Opening } from '$lib/openings';
import REPS from './repertoires.json';
import CHAPTERS from './chapters.json';

/**
 * The opening study section: an opening (from repertoires.json, shared with
 * scripts/study) with its main lines, the middlegame plans of each line, the
 * trainer, model games, puzzles from real games, and play against a
 * FIDE-rated opponent. The plans are written by hand and stay general and
 * true; the games and puzzles come from CaissaBase (scripts/study).
 */
export interface StudyLine {
  id: string;
  name: string;
  /** The moves from the start to the chapter's position. */
  sans: string;
  /** Chapters found from the games (scripts/study/repertoire.py): */
  /** The opponent's move that starts the chapter ("3...Bf5"). */
  title?: string;
  /** The opening's name for the position (Lichess's names), if any. */
  openingName?: string;
  games?: number;
  /** The student's side's score in those games. */
  score?: number;
  /** Variations of a full repertoire of the chapter, and their average length in the student's moves. */
  variations?: number;
  depth?: number;
  /** Position key at the chapter's start (hex). */
  key?: string;
  /** Hand-picked lines: one of the student's own options inside a line (it ends with the student's move). */
  option?: boolean;
  /** The written plans it uses (default: its id). */
  plan?: string;
  /** Hand-picked: a rare reply with too few games to be a chapter, listed with the chapters (the trainer continues it with our engines). */
  sideline?: boolean;
}
export interface StudyOpening {
  id: string;
  name: string;
  side: 'white' | 'black';
  root: string;
  /** The chapters found from the opening's games (or the hand-picked lines until they are built). */
  lines: StudyLine[];
  /** The hand-picked main lines, with written plans. */
  curated: StudyLine[];
  /** Games of the opening in the database. */
  games?: number;
}

type ChapterFile = Record<string, { games: number; chapters: { id: string; title: string; name: string; sans: string; games: number; score: number; variations: number; depth: number; key: string }[] }>;

export const STUDY_OPENINGS: StudyOpening[] = Object.entries(REPS as Record<string, Omit<StudyOpening, 'id' | 'curated'> & { eco: string[] }>).map(([id, r]) => {
  const found = (CHAPTERS as ChapterFile)[id];
  return {
    id,
    name: r.name,
    side: r.side,
    root: r.root,
    curated: r.lines,
    games: found?.games,
    lines: found?.chapters.length
      ? [
          ...found.chapters.map((c) => ({ id: c.id, name: c.name ? `${c.title} · ${c.name.replace(/^[^:]*: /, '')}` : c.title, sans: c.sans, title: c.title, openingName: c.name, games: c.games, score: c.score, variations: c.variations, depth: c.depth, key: c.key })),
          ...r.lines.filter((l) => l.sideline && !found.chapters.some((c) => c.sans === l.sans)).map((l) => ({ ...l, name: `${l.name} (sideline)` })),
        ]
      : r.lines.filter((l) => !l.option),
  };
});

/** Position keys along a line's moves (after each move), cached. */
const pathKeys = new Map<string, string[]>();
function keysOf(sans: string): string[] {
  let k = pathKeys.get(sans);
  if (!k) {
    const words = sans.split(' ').filter(Boolean);
    k = words.map((_, i) => polyglotKey(playSans(words.slice(0, i + 1).join(' '))).toString(16));
    pathKeys.set(sans, k);
  }
  return k;
}

/**
 * The hand-written plans that belong to a line (a chapter found from the
 * games): the hand-picked lines that pass through its position, in any move
 * order. Those that go on with the student's own move are options ("if you
 * play 3...c5").
 */
export function curatedFor(o: StudyOpening, line: StudyLine): StudyLine[] {
  const own = keysOf(line.sans);
  const at = own[own.length - 1];
  return o.curated.filter((c) => {
    const theirs = keysOf(c.sans);
    // The line's position is on the hand-picked line's way, or the hand-picked line ends on the way to the line.
    return theirs.includes(at) || (!c.option && own.includes(theirs[theirs.length - 1]));
  });
}

/** The plans of a hand-picked line. */
export const planOf = (o: StudyOpening, c: StudyLine) => PLANS[o.id]?.lines[c.plan ?? c.id];

export const studyById = (id: string) => STUDY_OPENINGS.find((o) => o.id === id);

const T = (en: string, hi: string, mr: string): L10n => ({ en, hi, mr });

export interface Plans {
  overview: L10n;
  /** Plans for the student's side in each line, then what to watch out for. */
  lines: Record<string, { plans: L10n[]; watch?: L10n }>;
}

export const PLANS: Record<string, Plans> = {
  'caro-kann': {
    overview: T(
      'The Caro-Kann is a solid answer to 1.e4. Black supports ...d5 with ...c6, so the centre stays strong, and the light-squared bishop can often come out to f5 or g4 before ...e6. Black\'s pawn structure is very healthy, which is why Caro-Kann players are happy to reach an endgame.',
      'Caro-Kann, 1.e4 का एक मज़बूत जवाब है। Black ...c6 से ...d5 को support करता है, इसलिए centre मज़बूत रहता है, और light-squared bishop अक्सर ...e6 से पहले f5 या g4 पर निकल आता है। Black का pawn structure बहुत healthy होता है, इसलिए Caro-Kann खेलने वाले endgame तक पहुँचकर खुश रहते हैं।',
      'Caro-Kann हे 1.e4 ला एक भक्कम उत्तर आहे. Black ...c6 ने ...d5 ला support करतो, त्यामुळे centre मजबूत राहतं, आणि light-squared bishop बऱ्याचदा ...e6 च्या आधी f5 किंवा g4 वर बाहेर येतो. Black चं pawn structure खूप healthy असतं, म्हणून Caro-Kann खेळणारे endgame पर्यंत पोहोचून खूश असतात.',
    ),
    lines: {
      advance: {
        plans: [
          T('Develop the bishop to f5 first, then play ...e6: the bishop stays outside the pawn chain.', 'पहले bishop को f5 पर लाओ, फिर ...e6 खेलो: इस तरह bishop pawn chain के बाहर रहता है।', 'आधी bishop f5 वर आण, मग ...e6 खेळ: असं केल्याने bishop pawn chain च्या बाहेर राहतो.'),
          T('Hit White\'s centre with ...c5, the main pawn break, often with ...Nc6 and ...Qb6 to press on d4 and b2.', 'White के centre पर ...c5 से वार करो, यही main pawn break है, अक्सर ...Nc6 और ...Qb6 के साथ d4 और b2 पर दबाव डालते हुए।', 'White च्या centre वर ...c5 ने वार कर, हाच main pawn break आहे, बऱ्याचदा ...Nc6 आणि ...Qb6 सोबत d4 आणि b2 वर दबाव टाकत.'),
          T('The knights usually go to d7 and e7 (the e7 knight can head for f5 or c6), because ...Nf6 is not possible with a pawn on e5.', 'Knights आमतौर पर d7 और e7 पर जाते हैं (e7 वाला knight f5 या c6 की तरफ़ जा सकता है), क्योंकि e5 पर pawn होने से ...Nf6 नहीं खेल सकते।', 'Knights सहसा d7 आणि e7 वर जातात (e7 वरचा knight f5 किंवा c6 कडे जाऊ शकतो), कारण e5 वर pawn असताना ...Nf6 खेळता येत नाही.'),
        ],
        watch: T('White often gains space with g4 and h4 to chase the f5 bishop: keep a safe square ready for it.', 'White अक्सर g4 और h4 से space लेकर f5 वाले bishop का पीछा करता है: उसके लिए एक safe square तैयार रखो।', 'White बऱ्याचदा g4 आणि h4 ने space घेऊन f5 वरच्या bishop चा पाठलाग करतो: त्याच्यासाठी एक safe square तयार ठेव.'),
      },
      'advance-c5': {
        plans: [
          T("3...c5 hits White's centre at once, before the bishop comes out: a sharp alternative to 3...Bf5.", '3...c5 bishop निकालने से पहले ही White के centre पर तुरंत वार करता है: 3...Bf5 का एक तीखा विकल्प।', '3...c5 bishop बाहेर काढण्याआधीच White च्या centre वर लगेच वार करतो: 3...Bf5 चा एक धारदार पर्याय.'),
          T('If White takes on c5, Black usually plays ...e6 or ...Nc6 and wins the pawn back with ...Bxc5; against 4.c3 or 4.Nf3, Black develops with ...Nc6 and brings the c8 bishop to g4 or f5 while the centre stays tense.', 'अगर White c5 पर लेता है, तो Black आमतौर पर ...e6 या ...Nc6 खेलकर ...Bxc5 से pawn वापस जीतता है; 4.c3 या 4.Nf3 के ख़िलाफ़ Black ...Nc6 से develop करता है और c8 वाले bishop को g4 या f5 पर लाता है, जबकि centre तना रहता है।', 'White ने c5 वर घेतलं तर Black सहसा ...e6 किंवा ...Nc6 खेळून ...Bxc5 ने pawn परत जिंकतो; 4.c3 किंवा 4.Nf3 विरुद्ध Black ...Nc6 ने develop करतो आणि c8 वरचा bishop g4 किंवा f5 वर आणतो, तोपर्यंत centre ताणलेलं राहतं.'),
        ],
        watch: T("With the pawns locked on d5 and e5 the position is close to a French Advance: White's extra space on the kingside can become an attack, so get your king to safety in time.", 'd5 और e5 पर pawns अटके होने से position French Advance जैसी होती है: kingside पर White का ज़्यादा space attack बन सकता है, इसलिए अपने king को समय पर safe करो।', 'd5 आणि e5 वर pawns अडकल्याने position French Advance सारखी असते: kingside वरची White ची जास्त space attack बनू शकते, म्हणून तुझा king वेळेत safe कर.'),
      },
      classical: {
        plans: [
          T('4...Bf5 develops the bishop with tempo, attacking the knight on e4.', '4...Bf5 से bishop tempo के साथ आता है और e4 वाले knight पर attack करता है।', '4...Bf5 ने bishop tempo सह बाहेर येतो आणि e4 वरच्या knight वर attack करतो.'),
          T('White often pushes h4-h5 to gain space and push the bishop back; Black keeps the bishop on the h7-b1 diagonal and plays ...e6, ...Nd7, ...Ngf6 and ...Bd6 or ...Be7.', 'White अक्सर h4-h5 खेलकर space लेता है और bishop को पीछे धकेलता है; Black bishop को h7-b1 diagonal पर रखता है और ...e6, ...Nd7, ...Ngf6 और ...Bd6 या ...Be7 खेलता है।', 'White बऱ्याचदा h4-h5 खेळून space घेतो आणि bishop ला मागे ढकलतो; Black bishop ला h7-b1 diagonal वर ठेवतो आणि ...e6, ...Nd7, ...Ngf6 आणि ...Bd6 किंवा ...Be7 खेळतो.'),
          T('White often castles queenside. Black\'s typical pawn break is ...c5 against d4, and with no weak pawns, trades usually help Black.', 'White अक्सर queenside castling करता है। Black का typical pawn break d4 के ख़िलाफ़ ...c5 है, और कोई weak pawn न होने से trades अक्सर Black की मदद करते हैं।', 'White बऱ्याचदा queenside castling करतो. Black चा typical pawn break d4 विरुद्ध ...c5 आहे, आणि एकही weak pawn नसल्याने trades सहसा Black ला मदत करतात.'),
        ],
      },
      karpov: {
        plans: [
          T('4...Nd7 prepares ...Ngf6, so Black can take back on f6 with a knight and keep the pawns healthy.', '4...Nd7 से ...Ngf6 की तैयारी होती है, ताकि f6 पर knight से वापस ले सकें और pawns healthy रहें।', '4...Nd7 ने ...Ngf6 ची तयारी होते, म्हणजे f6 वर knight ने परत घेता येतं आणि pawns healthy राहतात.'),
          T('Black develops quietly: ...Ngf6, ...e6, ...Bd6 or ...Be7, castles kingside, then frees the position with ...c5 or ...e5.', 'Black शांति से develop करता है: ...Ngf6, ...e6, ...Bd6 या ...Be7, kingside castling, फिर ...c5 या ...e5 से position खोलता है।', 'Black शांतपणे develop करतो: ...Ngf6, ...e6, ...Bd6 किंवा ...Be7, kingside castling, मग ...c5 किंवा ...e5 ने position मोकळी करतो.'),
        ],
        watch: T(
          'A famous trap: after 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3, the natural 7...h6? runs into 8.Nxe6!, as in Deep Blue vs Kasparov, 1997. Play 7...Bd6 first.',
          'एक मशहूर trap: 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3 के बाद सीधा 7...h6? खेलने पर 8.Nxe6! आता है, जैसा Deep Blue बनाम Kasparov, 1997 में हुआ। पहले 7...Bd6 खेलो।',
          'एक प्रसिद्ध trap: 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3 नंतर सरळ 7...h6? खेळलं तर 8.Nxe6! येतं, जसं Deep Blue विरुद्ध Kasparov, 1997 मध्ये झालं. आधी 7...Bd6 खेळ.',
        ),
      },
      exchange: {
        plans: [
          T('The pawns form a Carlsbad structure with colours reversed, so Black\'s typical plan is the minority attack: ...b5-b4 to leave White a weak pawn on c3.', 'Pawns का Carlsbad structure बनता है, बस रंग उल्टे, इसलिए Black का typical plan minority attack है: ...b5-b4 खेलकर White के c3 वाले pawn को कमज़ोर बनाना।', 'Pawns चं Carlsbad structure तयार होतं, फक्त रंग उलटे, म्हणून Black चा typical plan minority attack आहे: ...b5-b4 खेळून White चा c3 वरचा pawn कमकुवत करणं.'),
          T('Develop with ...Nc6, ...Nf6, ...Bg4 (pinning the knight on f3) and ...e6.', '...Nc6, ...Nf6, ...Bg4 (f3 वाले knight को pin करते हुए) और ...e6 से develop करो।', '...Nc6, ...Nf6, ...Bg4 (f3 वरच्या knight ला pin करत) आणि ...e6 ने develop कर.'),
        ],
        watch: T('White often aims at Black\'s king with Bf4, Qc2 or Qb3 and a knight on e5: keep the h7 square and the b7 pawn covered.', 'White अक्सर Bf4, Qc2 या Qb3 और e5 पर knight से Black के king पर निशाना साधता है: h7 square और b7 pawn को बचाकर रखो।', 'White बऱ्याचदा Bf4, Qc2 किंवा Qb3 आणि e5 वरच्या knight ने Black च्या king वर नेम धरतो: h7 square आणि b7 pawn सांभाळ.'),
      },
      panov: {
        plans: [
          T('The Panov often gives White an isolated queen\'s pawn (IQP) on d4.', 'Panov में अक्सर White के पास d4 पर एक isolated queen\'s pawn (IQP) आता है।', 'Panov मध्ये बऱ्याचदा White कडे d4 वर एक isolated queen\'s pawn (IQP) येतो.'),
          T('Black\'s plan: block the pawn with a knight on d5, trade pieces, and win the weak pawn later. Endgames are usually good for Black.', 'Black का plan: d5 पर knight रखकर pawn को रोको, pieces trade करो, और बाद में कमज़ोर pawn जीतो। Endgames आमतौर पर Black के लिए अच्छे होते हैं।', 'Black चा plan: d5 वर knight ठेवून pawn अडव, pieces trade कर, आणि नंतर कमकुवत pawn जिंक. Endgames सहसा Black साठी चांगले असतात.'),
        ],
        watch: T('White\'s chances are active pieces, a kingside attack and the d4-d5 break: don\'t let White open the centre while your king is still in the middle.', 'White के पास active pieces, kingside attack और d4-d5 break के मौक़े हैं: जब तक तुम्हारा king बीच में है, White को centre खोलने मत दो।', 'White कडे active pieces, kingside attack आणि d4-d5 break च्या संधी असतात: तुझा king मध्ये असेपर्यंत White ला centre उघडू देऊ नकोस.'),
      },
      fantasy: {
        plans: [
          T('3.f3 holds the centre with pawns. If Black takes on e4 and White takes back with the f-pawn, White gets open lines but a looser king.', '3.f3 से White pawns के साथ centre पकड़े रखता है। अगर Black e4 पर लेता है और White f-pawn से वापस लेता है, तो White को खुली lines मिलती हैं लेकिन उसका king थोड़ा ढीला हो जाता है।', '3.f3 ने White pawns सोबत centre धरून ठेवतो. Black ने e4 वर घेतलं आणि White ने f-pawn ने परत घेतलं, तर White ला मोकळ्या lines मिळतात पण त्याचा king थोडा सैल होतो.'),
          T('Solid answers are 3...e6 (then ...c5, or ...Nd7 and ...Bb4) and 3...dxe4 4.fxe4 e5, hitting the centre at once.', 'मज़बूत जवाब हैं 3...e6 (फिर ...c5, या ...Nd7 और ...Bb4) और 3...dxe4 4.fxe4 e5, जो तुरंत centre पर वार करता है।', 'भक्कम उत्तरं आहेत 3...e6 (मग ...c5, किंवा ...Nd7 आणि ...Bb4) आणि 3...dxe4 4.fxe4 e5, जे लगेच centre वर वार करतं.'),
        ],
        watch: T('White often plays Be3, Qd2 and castles queenside, then storms the kingside with pawns.', 'White अक्सर Be3, Qd2 खेलकर queenside castling करता है, फिर kingside पर pawns से हमला करता है।', 'White बऱ्याचदा Be3, Qd2 खेळून queenside castling करतो, मग kingside वर pawns ने हल्ला करतो.'),
      },
      other: {
        plans: [T('Other moves: follow the Caro-Kann ideas: a solid centre with ...c6 and ...d5, the light-squared bishop out before ...e6, and ...c5 or ...e5 as the pawn breaks.', 'दूसरी moves: Caro-Kann के ideas अपनाओ: ...c6 और ...d5 से मज़बूत centre, ...e6 से पहले light-squared bishop बाहर, और pawn breaks ...c5 या ...e5।', 'इतर moves: Caro-Kann च्या ideas वापर: ...c6 आणि ...d5 ने भक्कम centre, ...e6 च्या आधी light-squared bishop बाहेर, आणि pawn breaks ...c5 किंवा ...e5.')],
      },
    },
  },
  'jobava-london': {
    overview: T(
      'The Jobava London, named after Georgian grandmaster Baadur Jobava, puts the knight on c3 and the bishop on f4 early. It is aggressive: the knight can jump to b5 to attack c7 together with the bishop, the queen often comes to f3 or d2, and White often castles queenside and attacks on the kingside.',
      'Jobava London, Georgian grandmaster Baadur Jobava के नाम पर, जल्दी ही knight को c3 और bishop को f4 पर रखता है। यह aggressive है: knight b5 पर कूदकर bishop के साथ c7 पर attack कर सकता है, queen अक्सर f3 या d2 पर आती है, और White अक्सर queenside castling करके kingside पर attack करता है।',
      'Jobava London, Georgian grandmaster Baadur Jobava यांच्या नावाने, लवकरच knight c3 वर आणि bishop f4 वर ठेवतो. हे aggressive आहे: knight b5 वर उडी मारून bishop सोबत c7 वर attack करू शकतो, queen बऱ्याचदा f3 किंवा d2 वर येते, आणि White बऱ्याचदा queenside castling करून kingside वर attack करतो.',
    ),
    lines: {
      c5: {
        plans: [
          T('Against 3...c5, 4.e3 is the most common move: after ...cxd4 exd4 the e-file opens and White\'s pieces get good squares.', '3...c5 के ख़िलाफ़ 4.e3 सबसे आम move है: ...cxd4 exd4 के बाद e-file खुलती है और White के pieces को अच्छे squares मिलते हैं।', '3...c5 विरुद्ध 4.e3 ही सगळ्यात सामान्य move आहे: ...cxd4 exd4 नंतर e-file उघडते आणि White च्या pieces ना चांगले squares मिळतात.'),
          T('The jump Nb5 attacks c7 together with the f4 bishop: always check whether Black has covered c7.', 'Nb5 की छलांग f4 वाले bishop के साथ c7 पर attack करती है: हमेशा देखो कि Black ने c7 को बचाया है या नहीं।', 'Nb5 ची उडी f4 वरच्या bishop सोबत c7 वर attack करते: Black ने c7 सांभाळलाय की नाही हे नेहमी बघ.'),
          T('Then Bd3, Nf3 or Qf3, and a kingside attack, sometimes after castling queenside.', 'फिर Bd3, Nf3 या Qf3, और kingside attack, कभी-कभी queenside castling के बाद।', 'मग Bd3, Nf3 किंवा Qf3, आणि kingside attack, कधी कधी queenside castling नंतर.'),
        ],
      },
      e6: {
        plans: [
          T('After 3...e6 the c8 bishop is shut in. 4.Nb5 attacks c7 at once; 4...Na6 is the usual defence.', '3...e6 के बाद c8 वाला bishop बंद हो जाता है। 4.Nb5 तुरंत c7 पर attack करता है; आम बचाव 4...Na6 है।', '3...e6 नंतर c8 वरचा bishop आत अडकतो. 4.Nb5 लगेच c7 वर attack करतो; नेहमीचा बचाव 4...Na6 आहे.'),
          T('White continues with e3, Bd3, Nf3 and often h4 or Ne5 for a kingside attack.', 'White e3, Bd3, Nf3 खेलता है और kingside attack के लिए अक्सर h4 या Ne5।', 'White e3, Bd3, Nf3 खेळतो आणि kingside attack साठी बऱ्याचदा h4 किंवा Ne5.'),
        ],
        watch: T('...Bb4 pins the knight on c3: be ready to break the pin with a3 or by moving the queen to d3.', '...Bb4 से c3 वाला knight pin होता है: pin तोड़ने के लिए a3 या queen को d3 पर लाने के लिए तैयार रहो।', '...Bb4 ने c3 वरचा knight pin होतो: pin तोडायला a3 किंवा queen d3 वर आणायला तयार राहा.'),
      },
      bf5: {
        plans: [
          T('Black copies with ...Bf5. Strong players are split almost evenly between 4.e3 and the sharp 4.f3 with g4 (which has its own line here, "3...Bf5 4.f3").', 'Black ...Bf5 से नक़ल करता है। Strong players लगभग बराबर बँटे हुए हैं: 4.e3 और तीखा 4.f3 g4 के साथ (जिसकी यहाँ अपनी अलग line है, "3...Bf5 4.f3")।', 'Black ...Bf5 ने नक्कल करतो. Strong players जवळपास सारखे विभागलेले आहेत: 4.e3 आणि धारदार 4.f3 g4 सोबत (ज्याची इथे स्वतंत्र line आहे, "3...Bf5 4.f3").'),
          T('With 4.e3, a calmer plan is Nb5 and Bd3 to trade off Black\'s good bishop.', 'एक शांत plan है e3, Nb5 और Bd3, ताकि Black का अच्छा bishop trade हो जाए।', 'एक शांत plan आहे e3, Nb5 आणि Bd3, म्हणजे Black चा चांगला bishop trade होईल.'),
        ],
      },
      'bf5-f3': {
        plans: [
          T('4.f3 prepares g4, chasing the f5 bishop and grabbing space on the kingside. After 4...e6, strong players answer 5.g4 in almost every game.', '4.f3 से g4 की तैयारी होती है, जो f5 वाले bishop का पीछा करता है और kingside पर space लेता है। 4...e6 के बाद strong players लगभग हर game में 5.g4 खेलते हैं।', '4.f3 ने g4 ची तयारी होते, जो f5 वरच्या bishop चा पाठलाग करतो आणि kingside वर space घेतो. 4...e6 नंतर strong players जवळपास प्रत्येक game मध्ये 5.g4 खेळतात.'),
          T('After 5...Bg6, h4 threatens h5, when the bishop on g6 has no good square left. Black answers with ...h5 or ...h6.', '5...Bg6 के बाद h4 से h5 की धमकी होती है, जिसके बाद g6 वाले bishop के पास कोई अच्छा square नहीं बचता। Black ...h5 या ...h6 से जवाब देता है।', '5...Bg6 नंतर h4 ने h5 ची धमकी येते, त्यानंतर g6 वरच्या bishop ला चांगला square उरत नाही. Black ...h5 किंवा ...h6 ने उत्तर देतो.'),
          T('White then plays e3, Qd2 or Nge2, often castles queenside, and uses the kingside pawns to attack; Black usually hits back in the centre with ...c5.', 'फिर White e3, Qd2 या Nge2 खेलता है, अक्सर queenside castling करता है, और kingside pawns से attack करता है; Black आमतौर पर centre में ...c5 से जवाब देता है।', 'मग White e3, Qd2 किंवा Nge2 खेळतो, बऱ्याचदा queenside castling करतो, आणि kingside pawns ने attack करतो; Black सहसा centre मध्ये ...c5 ने उत्तर देतो.'),
        ],
        watch: T("Pushing f3, g4 and h4 also loosens White's own position: White's king is usually safest on the queenside.", 'f3, g4 और h4 धकेलने से White की अपनी position भी ढीली होती है: White का king आमतौर पर queenside पर सबसे safe रहता है।', 'f3, g4 आणि h4 ढकलल्याने White ची स्वतःची position पण सैल होते: White चा king सहसा queenside वर सगळ्यात safe असतो.'),
      },
      a6: {
        plans: [
          T('3...a6 stops Nb5. White builds up with e3, Nf3 and Bd3, often followed by Ne5 and a kingside attack.', '3...a6, Nb5 को रोकता है। White e3, Nf3 और Bd3 से तैयारी करता है, अक्सर उसके बाद Ne5 और kingside attack।', '3...a6 हे Nb5 ला थांबवतं. White e3, Nf3 आणि Bd3 ने तयारी करतो, बऱ्याचदा त्यानंतर Ne5 आणि kingside attack.'),
        ],
      },
      g6: {
        plans: [
          T('Against ...g6 White often plays Qd2 and Bh6 to trade Black\'s fianchetto bishop, castles queenside and pushes h4-h5.', '...g6 के ख़िलाफ़ White अक्सर Qd2 और Bh6 खेलकर Black का fianchetto bishop trade करता है, queenside castling करता है और h4-h5 धकेलता है।', '...g6 विरुद्ध White बऱ्याचदा Qd2 आणि Bh6 खेळून Black चा fianchetto bishop trade करतो, queenside castling करतो आणि h4-h5 ढकलतो.'),
          T('e4 builds a big centre; Black usually strikes back with ...c5 or ...d6 and ...e5.', 'e4 से बड़ा centre बनता है; Black आमतौर पर ...c5 या ...d6 और ...e5 से जवाब देता है।', 'e4 ने मोठं centre तयार होतं; Black सहसा ...c5 किंवा ...d6 आणि ...e5 ने उत्तर देतो.'),
        ],
      },
      'sl-c5': {
        plans: [
          T('Against 1...c5, 2.d5 is the strongest: the pawn takes space and cramps Black\'s pieces. Then Nc3, Bf4 and e4 build a big centre.', '1...c5 के ख़िलाफ़ 2.d5 सबसे strong है: pawn जगह लेता है और Black के pieces को तंग कर देता है। फिर Nc3, Bf4 और e4 से बड़ा centre बनता है।', '1...c5 विरुद्ध 2.d5 सगळ्यात strong आहे: pawn जागा घेतो आणि Black च्या pieces ना अडचणीत टाकतो. मग Nc3, Bf4 आणि e4 ने मोठा centre तयार होतो.'),
          T('2.dxc5 also works, but Black wins the pawn back with ...e6 and ...Bxc5 and develops easily.', '2.dxc5 भी चलता है, पर Black ...e6 और ...Bxc5 से pawn वापस ले लेता है और आराम से pieces निकालता है।', '2.dxc5 पण चालतो, पण Black ...e6 आणि ...Bxc5 ने pawn परत घेतो आणि सहज pieces बाहेर काढतो.'),
        ],
        watch: T('...Qb6 hits b2. Nc3 is a good pawn offer: after ...Qxb2, Bd2 and e4 give White a big lead in development.', '...Qb6 से b2 पर attack होता है। Nc3 अच्छा pawn offer है: ...Qxb2 के बाद Bd2 और e4 से White development में बहुत आगे निकल जाता है।', '...Qb6 ने b2 वर attack होतो. Nc3 हा चांगला pawn offer आहे: ...Qxb2 नंतर Bd2 आणि e4 ने White development मध्ये खूप पुढे जातो.'),
      },
      'sl-nc6': {
        plans: [
          T('Against 2...Nc6, 3.Bf4 keeps to the system, then e3, Nf3 and Bd3 or Bb5. The knight on c6 blocks Black\'s c-pawn, so ...c5 is hard to play.', '2...Nc6 के ख़िलाफ़ 3.Bf4 system में रहता है, फिर e3, Nf3 और Bd3 या Bb5। c6 वाला knight Black के c-pawn को रोकता है, इसलिए ...c5 खेलना मुश्किल है।', '2...Nc6 विरुद्ध 3.Bf4 system मध्येच राहतो, मग e3, Nf3 आणि Bd3 किंवा Bb5. c6 वरचा knight Black च्या c-pawn ला अडवतो, म्हणून ...c5 खेळणं अवघड जातं.'),
          T('Bb5 pins the knight on c6 to the king, a handy extra idea once e3 is in.', 'e3 खेलने के बाद Bb5 c6 वाले knight को king के साथ pin करता है, यह एक काम का idea है।', 'e3 खेळल्यानंतर Bb5 ने c6 वरचा knight king सोबत pin होतो, हा एक कामाचा idea आहे.'),
        ],
        watch: T('...e5 is Black\'s break. Take with the bishop: Bxe5 Nxe5 dxe5, and after ...d4 the knight goes back to b1. Never retreat the bishop to c1: ...exd4 and ...Bb4+ hurt.', '...e5 Black का break है। Bishop से लो: Bxe5 Nxe5 dxe5, और ...d4 के बाद knight b1 पर वापस जाता है। Bishop को कभी c1 पर वापस मत ले जाओ: ...exd4 और ...Bb4+ से नुकसान होता है।', '...e5 हा Black चा break आहे. Bishop ने घे: Bxe5 Nxe5 dxe5, आणि ...d4 नंतर knight b1 वर परत जातो. Bishop कधीच c1 वर मागे नेऊ नकोस: ...exd4 आणि ...Bb4+ ने नुकसान होतं.'),
      },
      'sl-3nc6': {
        plans: [
          T('Against 3...Nc6, 4.Nb5! is the sharpest: it hits c7, and Black has only one good answer, the pawn offer ...e5.', '3...Nc6 के ख़िलाफ़ 4.Nb5! सबसे तेज़ है: यह c7 पर attack करता है, और Black के पास एक ही अच्छा जवाब है, pawn offer ...e5।', '3...Nc6 विरुद्ध 4.Nb5! सगळ्यात धारदार आहे: हा c7 वर attack करतो, आणि Black कडे एकच चांगलं उत्तर आहे, pawn offer ...e5.'),
          T('After 4...e5 5.Bxe5 Nxe5 6.dxe5 the f6 knight is attacked; after ...a6 7.Nc3 d4 8.exf6 dxc3 9.Qxd8+ Kxd8 10.bxc3 gxf6, Black\'s pawns are broken and White has the better endgame.', '4...e5 5.Bxe5 Nxe5 6.dxe5 के बाद f6 वाले knight पर attack है; ...a6 7.Nc3 d4 8.exf6 dxc3 9.Qxd8+ Kxd8 10.bxc3 gxf6 के बाद Black के pawns टूट जाते हैं और White का endgame बेहतर है।', '4...e5 5.Bxe5 Nxe5 6.dxe5 नंतर f6 वरच्या knight वर attack आहे; ...a6 7.Nc3 d4 8.exf6 dxc3 9.Qxd8+ Kxd8 10.bxc3 gxf6 नंतर Black चे pawns तुटतात आणि White चा endgame चांगला असतो.'),
          T('For a calm game, 4.e3 with Nf3 and Bb5 (pinning the knight on c6) is solid.', 'शांत game के लिए 4.e3, Nf3 और Bb5 (c6 वाले knight को pin करके) मज़बूत है।', 'शांत game साठी 4.e3, Nf3 आणि Bb5 (c6 वरचा knight pin करून) भक्कम आहे.'),
        ],
      },
      other: {
        plans: [T('Other replies: keep the Jobava ideas: Nc3 and Bf4, the Nb5 jump against c7 when it works, and a kingside attack with the queen and the h-pawn.', 'दूसरे जवाब: Jobava के ideas रखो: Nc3 और Bf4, जब काम करे तब c7 के ख़िलाफ़ Nb5, और queen और h-pawn से kingside attack।', 'इतर उत्तरं: Jobava च्या ideas ठेव: Nc3 आणि Bf4, जमत असेल तेव्हा c7 विरुद्ध Nb5, आणि queen व h-pawn ने kingside attack.')],
      },
    },
  },
  chebanenko: {
    overview: T(
      'The Chebanenko Slav (4...a6, named after the Moldovan trainer Vyacheslav Chebanenko) is a flexible Slav: ...a6 prepares ...b5 to gain space on the queenside, and the c8 bishop stays free to come out to f5 or g4.',
      'Chebanenko Slav (4...a6, Moldova के trainer Vyacheslav Chebanenko के नाम पर) एक flexible Slav है: ...a6 से queenside पर space के लिए ...b5 की तैयारी होती है, और c8 वाला bishop f5 या g4 पर निकलने के लिए आज़ाद रहता है।',
      'Chebanenko Slav (4...a6, Moldova चे trainer Vyacheslav Chebanenko यांच्या नावाने) हा एक flexible Slav आहे: ...a6 ने queenside वर space साठी ...b5 ची तयारी होते, आणि c8 वरचा bishop f5 किंवा g4 वर यायला मोकळा राहतो.',
    ),
    lines: {
      e3: {
        plans: [
          T('5...b5 grabs space; after 6.b3 the bishop goes to g4, and Black follows with ...e6 and ...Nbd7.', '5...b5 से space मिलता है; 6.b3 के बाद bishop g4 पर जाता है, और Black ...e6 और ...Nbd7 खेलता है।', '5...b5 ने space मिळते; 6.b3 नंतर bishop g4 वर जातो, आणि Black ...e6 आणि ...Nbd7 खेळतो.'),
          T('Black can also play 5...Bg4 or 5...e6 first. The usual Slav idea: bring the bishop out before ...e6.', 'Black पहले 5...Bg4 या 5...e6 भी खेल सकता है। Slav का आम idea: ...e6 से पहले bishop बाहर लाओ।', 'Black आधी 5...Bg4 किंवा 5...e6 पण खेळू शकतो. Slav ची नेहमीची idea: ...e6 च्या आधी bishop बाहेर आण.'),
          T('Once developed, Black breaks with ...c5 or ...e5 in the centre.', 'Develop करने के बाद Black centre में ...c5 या ...e5 से break करता है।', 'Develop झाल्यावर Black centre मध्ये ...c5 किंवा ...e5 ने break करतो.'),
        ],
      },
      c5: {
        plans: [
          T('5.c5 gains space and takes the b6 and d6 squares, but the c5 pawn can become a target.', '5.c5 से space मिलता है और b6, d6 squares पर क़ब्ज़ा होता है, लेकिन c5 वाला pawn निशाना बन सकता है।', '5.c5 ने space मिळते आणि b6, d6 squares ताब्यात येतात, पण c5 वरचा pawn निशाणा बनू शकतो.'),
          T('Black prepares the central break ...e5 with ...Bf5 or ...Bg4 and ...Nbd7; ...b6 is the other way to attack c5.', 'Black ...Bf5 या ...Bg4 और ...Nbd7 से centre में ...e5 break की तैयारी करता है; c5 पर attack का दूसरा तरीक़ा ...b6 है।', 'Black ...Bf5 किंवा ...Bg4 आणि ...Nbd7 ने centre मध्ये ...e5 break ची तयारी करतो; c5 वर attack करायचा दुसरा मार्ग ...b6 आहे.'),
        ],
        watch: T('White often supports c5 with b4 and plays Bf4 to stop ...e5: time the break carefully.', 'White अक्सर b4 से c5 को support करता है और ...e5 रोकने के लिए Bf4 खेलता है: break सही समय पर करो।', 'White बऱ्याचदा b4 ने c5 ला support करतो आणि ...e5 थांबवायला Bf4 खेळतो: break योग्य वेळी कर.'),
      },
      a4: {
        plans: [
          T('5.a4 stops ...b5, but leaves the b4 square weak: a black knight or bishop (...Bb4) can use it.', '5.a4 से ...b5 रुकता है, लेकिन b4 square कमज़ोर हो जाता है: Black का knight या bishop (...Bb4) वहाँ आ सकता है।', '5.a4 ने ...b5 थांबतो, पण b4 square कमकुवत होतो: Black चा knight किंवा bishop (...Bb4) तिथे येऊ शकतो.'),
          T('Common plans: 5...e6 followed by ...c5, or the bishop out to f5 or g4 before ...e6.', 'आम plans: 5...e6 और फिर ...c5, या ...e6 से पहले bishop को f5 या g4 पर निकालना।', 'नेहमीचे plans: 5...e6 आणि मग ...c5, किंवा ...e6 च्या आधी bishop f5 किंवा g4 वर काढणं.'),
        ],
      },
      exchange: {
        plans: [
          T('The symmetrical structure is quiet, and ...a6 is useful here: it keeps White\'s pieces off b5.', 'Symmetrical structure शांत होता है, और यहाँ ...a6 काम का है: यह White के pieces को b5 से दूर रखता है।', 'Symmetrical structure शांत असतं, आणि इथे ...a6 उपयोगी आहे: ते White च्या pieces ना b5 पासून दूर ठेवतं.'),
          T('Develop with ...Nc6, ...Bf5 or ...Bg4 and ...e6, and fight for the open c-file with ...Rc8.', '...Nc6, ...Bf5 या ...Bg4 और ...e6 से develop करो, और ...Rc8 से खुली c-file के लिए लड़ो।', '...Nc6, ...Bf5 किंवा ...Bg4 आणि ...e6 ने develop कर, आणि ...Rc8 ने मोकळ्या c-file साठी लढ.'),
        ],
        watch: T('Black is very solid here; the main danger is falling behind in development.', 'यहाँ Black बहुत solid है; मुख्य ख़तरा development में पीछे रह जाना है।', 'इथे Black खूप solid आहे; मुख्य धोका development मध्ये मागे पडणं हा आहे.'),
      },
      quiet: {
        plans: [
          T('After 4.e3 White\'s c1 bishop is shut in, so Black gets an easy game: ...Bg4 or ...Bf5 brings the bishop out before ...e6.', '4.e3 के बाद White का c1 वाला bishop बंद हो जाता है, इसलिए Black का खेल आसान होता है: ...Bg4 या ...Bf5 से bishop ...e6 से पहले बाहर आता है।', '4.e3 नंतर White चा c1 वरचा bishop आत अडकतो, म्हणून Black चा खेळ सोपा होतो: ...Bg4 किंवा ...Bf5 ने bishop ...e6 च्या आधी बाहेर येतो.'),
          T('5.Nc3 leads to the main line with 5.e3.', '5.Nc3 से 5.e3 वाली main line आ जाती है।', '5.Nc3 ने 5.e3 ची main line येते.'),
        ],
      },
      other: {
        plans: [T('Other moves: keep the Chebanenko ideas: ...b5 when it gains space, the bishop out before ...e6, and the central breaks ...c5 or ...e5.', 'दूसरी moves: Chebanenko के ideas रखो: जब space मिले तब ...b5, ...e6 से पहले bishop बाहर, और centre में ...c5 या ...e5 breaks।', 'इतर moves: Chebanenko च्या ideas ठेव: space मिळत असेल तेव्हा ...b5, ...e6 च्या आधी bishop बाहेर, आणि centre मध्ये ...c5 किंवा ...e5 breaks.')],
      },
    },
  },
};

/** Trainer ids: "st-caro-kann" (the whole opening) or "st-caro-kann--advance" (one line). */
export function studyTrainerId(opening: string, line?: string) {
  return line ? `st-${opening}--${line}` : `st-${opening}`;
}

/** The trainer's "opening" for a study opening or one of its lines. */
export function studyOpening(id: string): (Opening & { study: string }) | undefined {
  const m = /^st-([a-z-]+?)(?:--([a-z0-9-]+))?$/.exec(id);
  const o = m && studyById(m[1]);
  if (!o) return undefined;
  const line = m![2] ? (o.lines.find((l) => l.id === m![2]) ?? o.curated.find((l) => l.id === m![2])) : undefined;
  if (m![2] && !line) return undefined;
  return {
    id,
    study: o.id,
    name: line ? `${o.name}: ${line.title ?? line.name}` : o.name,
    sans: line ? line.sans : o.root,
    side: o.side,
    blurb: line ? `The ${line.name} of the ${o.name}.` : `The ${o.name}, all main lines.`,
  };
}
