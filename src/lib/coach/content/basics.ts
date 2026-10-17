import { parseSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';
import { fenOf, moveToUci, playSans, positionFromFen, START_FEN } from '$lib/chess/position';
import type { L10n } from '../i18n';
import type { Category, Lesson, LessonEntry, Level, Slide } from '../types';

/** Moves in SAN from fen (or the start), as UCI for a slide. */
export function uciLine(sans: string, fen = START_FEN): string[] {
  const pos = positionFromFen(fen);
  return sans
    .split(' ')
    .filter(Boolean)
    .map((san) => {
      const m = parseSan(pos, san) as NormalMove;
      if (!m) throw new Error(`Illegal move ${san} in lesson line`);
      pos.play(m);
      return moveToUci(m);
    });
}

/** The position after SAN moves from the start. */
export const after = (sans: string) => fenOf(playSans(sans));

export const T = (en: string, hi: string, mr: string): L10n => ({ en, hi, mr });

interface Def {
  id: string;
  category: Category;
  section: string;
  level: Level;
  title: string;
  blurb: string;
  slides: () => Slide[];
}

const DEFS: Def[] = [
  {
    id: 'opening-principles',
    category: 'opening',
    section: 'Opening basics',
    level: 'beginner',
    title: 'Opening principles',
    blurb: 'Centre, development, castling: the three golden rules of every opening.',
    slides: () => [
      {
        fen: START_FEN,
        marks: ['d4', 'e4', 'd5', 'e5'],
        practice: false,
        text: T(
          'Every good opening follows three golden rules. One: fight for the centre, the four squares d4, e4, d5 and e5. Two: develop your knights and bishops quickly. Three: castle early to keep your king safe.',
          'हर अच्छी opening तीन golden rules मानती है। एक: centre के लिए लड़ो, यानी चार squares d4, e4, d5 और e5। दो: अपने knights और bishops जल्दी develop करो। तीन: king को safe रखने के लिए जल्दी castling करो।',
          'प्रत्येक चांगली opening तीन golden rules पाळते. एक: centre साठी लढ, म्हणजे चार squares d4, e4, d5 आणि e5. दोन: तुझे knights आणि bishops पटकन develop कर. तीन: king safe ठेवायला लवकर castling कर.',
        ),
      },
      {
        fen: START_FEN,
        moves: uciLine('e4 e5 Nf3 Nc6 Bc4 Bc5'),
        text: T(
          'Watch both sides follow the rules: a pawn to the centre, then knights before bishops, each piece moving toward the centre. No piece moves twice, and no time is wasted.',
          'देखो दोनों तरफ़ rules मानते हैं: पहले centre में pawn, फिर bishops से पहले knights, हर piece centre की तरफ़। कोई piece दो बार नहीं चलता और समय बर्बाद नहीं होता।',
          'बघ दोन्ही बाजू rules पाळतात: आधी centre मध्ये pawn, मग bishops आधी knights, प्रत्येक piece centre कडे. कोणताही piece दोनदा चालत नाही आणि वेळ वाया जात नाही.',
        ),
        practice: { side: 'white' },
      },
      {
        fen: after('e4 e5 Nf3 Nc6 Bc4 Bc5'),
        moves: uciLine('O-O', after('e4 e5 Nf3 Nc6 Bc4 Bc5')),
        text: T(
          'Now castle! The king hides behind its pawns, and the rook comes toward the centre where it can join the game.',
          'अब castling करो! King अपने pawns के पीछे छिप जाता है, और rook centre की तरफ़ आता है जहाँ वो game में आ सके।',
          'आता castling कर! King आपल्या pawns मागे लपतो, आणि rook centre कडे येतो जिथे तो game मध्ये येऊ शकतो.',
        ),
      },
      {
        fen: START_FEN,
        moves: uciLine('e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Qb3 Qe7 Nc3 Nd4'),
        text: T(
          'Do not bring the queen out too early. Here White\'s queen comes out on move two, and Black develops new pieces while chasing it around. Every chase is a free move for Black.',
          'Queen को बहुत जल्दी बाहर मत लाओ। यहाँ White की queen दूसरी move पर ही बाहर आती है, और Black उसका पीछा करते-करते नए pieces develop करता जाता है। हर पीछा Black के लिए एक free move है।',
          'Queen ला खूप लवकर बाहेर काढू नकोस. इथे White ची queen दुसऱ्याच move ला बाहेर येते, आणि Black तिचा पाठलाग करता करता नवे pieces develop करत जातो. प्रत्येक पाठलाग Black साठी एक free move आहे.',
        ),
        practice: { side: 'black' },
      },
    ],
  },
  {
    id: 'opening-traps',
    category: 'opening',
    section: 'Opening basics',
    level: 'beginner',
    title: 'Famous opening traps',
    blurb: 'Fool\'s mate, Scholar\'s mate, Legal\'s mate and more: never fall for them!',
    slides: () => [
      {
        fen: START_FEN,
        moves: uciLine('f3 e5 g4 Qh4#'),
        text: T(
          'Fool\'s mate, the fastest checkmate in chess: White weakens the king with f3 and g4, and the black queen mates on h4 in just two moves. Never open the diagonal in front of your king like this!',
          "Fool's mate, शतरंज का सबसे तेज़ checkmate: White f3 और g4 से king को कमज़ोर करता है, और black queen सिर्फ़ दो moves में h4 पर mate कर देती है। अपने king के आगे का diagonal ऐसे कभी मत खोलो!",
          "Fool's mate, बुद्धिबळातला सगळ्यात जलद checkmate: White f3 आणि g4 ने king ला कमकुवत करतो, आणि black queen फक्त दोन moves मध्ये h4 वर mate करते. आपल्या king समोरचा diagonal असा कधीच उघडू नकोस!",
        ),
        practice: false,
      },
      {
        fen: START_FEN,
        moves: uciLine('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#'),
        text: T(
          'Scholar\'s mate: the queen and bishop both aim at f7, which only the king defends. If Black does not see it, Qxf7 is checkmate. Many beginners lose this way.',
          "Scholar's mate: queen और bishop दोनों f7 पर निशाना साधते हैं, जिसे सिर्फ़ king defend करता है। अगर Black इसे नहीं देखता, तो Qxf7 checkmate है। बहुत सारे beginners ऐसे हारते हैं।",
          "Scholar's mate: queen आणि bishop दोघंही f7 वर नेम धरतात, ज्याला फक्त king defend करतो. Black ला हे दिसलं नाही तर Qxf7 checkmate. खूप beginners असेच हरतात.",
        ),
        practice: false,
      },
      {
        fen: after('e4 e5 Qh5 Nc6 Bc4'),
        moves: uciLine('g6 Qf3 Nf6', after('e4 e5 Qh5 Nc6 Bc4')),
        text: T(
          'The defence is easy: block the queen with ...g6, and when it comes back to f3, cover f7 with the knight on f6. Now Black is fine and will chase the queen with tempo.',
          'बचाव आसान है: ...g6 से queen को रोको, और जब वो f3 पर वापस आए तो f6 वाले knight से f7 को cover करो। अब Black ठीक है और tempo के साथ queen का पीछा करेगा।',
          'बचाव सोपा आहे: ...g6 ने queen ला अडव, आणि ती f3 वर परत आली की f6 वरच्या knight ने f7 cover कर. आता Black ठीक आहे आणि tempo सोबत queen चा पाठलाग करेल.',
        ),
        practice: { side: 'black' },
      },
      {
        fen: START_FEN,
        moves: uciLine('e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#'),
        text: T(
          'Legal\'s mate, from the 1700s: White lets the queen be taken because the knights and bishop give checkmate. Black was greedy: taking the queen was the mistake.',
          "Legal's mate, 1700 के दशक से: White queen को जाने देता है क्योंकि knights और bishop checkmate दे देते हैं। Black लालची था: queen लेना ही गलती थी।",
          "Legal's mate, 1700 च्या दशकातला: White queen जाऊ देतो कारण knights आणि bishop checkmate देतात. Black लोभी होता: queen घेणं हीच चूक होती.",
        ),
        practice: false,
      },
      {
        fen: START_FEN,
        moves: uciLine('e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#'),
        text: T(
          'The Blackburne Shilling trap: Black leaves the e5 pawn, White grabs it and attacks f7, but the black queen and knight strike back and mate the king. Grabbing pawns without looking can be deadly.',
          'Blackburne Shilling trap: Black e5 pawn छोड़ देता है, White उसे लेकर f7 पर attack करता है, पर black queen और knight पलटवार करके king को mate कर देते हैं। बिना देखे pawns लेना खतरनाक हो सकता है।',
          'Blackburne Shilling trap: Black e5 चा pawn सोडतो, White तो घेऊन f7 वर attack करतो, पण black queen आणि knight उलट हल्ला करून king ला mate करतात. न बघता pawns घेणं घातक ठरू शकतं.',
        ),
        practice: false,
      },
      {
        fen: START_FEN,
        moves: uciLine('d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8'),
        text: T(
          'The Elephant trap in the Queen\'s Gambit: White takes a pawn that looks free on d5, but after ...Nxd5 the bishop takes the queen and Black wins a piece with a check from b4. Always ask: why did my opponent leave this pawn?',
          "Queen's Gambit का Elephant trap: White d5 पर free दिखने वाला pawn ले लेता है, पर ...Nxd5 के बाद bishop queen लेता है और Black b4 से check देकर एक piece जीत लेता है। हमेशा पूछो: सामने वाले ने यह pawn क्यों छोड़ा?",
          "Queen's Gambit मधला Elephant trap: White d5 वर free वाटणारा pawn घेतो, पण ...Nxd5 नंतर bishop queen घेतो आणि Black b4 वरून check देऊन एक piece जिंकतो. नेहमी विचार: समोरच्याने हा pawn का सोडला?",
        ),
        practice: false,
      },
      {
        fen: START_FEN,
        moves: uciLine('d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#'),
        text: T(
          'The Englund trap: White develops naturally, but grabs a pawn and walks into ...Qc1, checkmate. Even good-looking moves need a quick safety check.',
          'Englund trap: White natural तरीके से develop करता है, पर एक pawn लेते-लेते ...Qc1 checkmate में फँस जाता है। अच्छी दिखने वाली moves को भी एक बार safety के लिए check करो।',
          'Englund trap: White natural पद्धतीने develop करतो, पण एक pawn घेता घेता ...Qc1 checkmate मध्ये अडकतो. चांगल्या दिसणाऱ्या moves सुद्धा एकदा safety साठी check कर.',
        ),
        practice: false,
      },
    ],
  },
  {
    id: 'piece-values',
    category: 'middlegame',
    section: 'Basics',
    level: 'beginner',
    title: 'Piece values and good trades',
    blurb: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9: learn to count before you capture.',
    slides: () => [
      {
        fen: START_FEN,
        marks: ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2'],
        practice: false,
        text: T('Pieces have points. A pawn is worth 1.', 'Pieces के points होते हैं। Pawn 1 point का है।', 'Pieces चे points असतात. Pawn 1 point चा असतो.'),
      },
      {
        fen: START_FEN,
        marks: ['b1', 'g1', 'c1', 'f1'],
        practice: false,
        text: T('Knights and bishops are worth 3 each. A knight is about as strong as a bishop.', 'Knights और bishops 3-3 points के हैं। Knight लगभग bishop जितना ही strong है।', 'Knights आणि bishops प्रत्येकी 3 points चे. Knight साधारण bishop इतकाच strong असतो.'),
      },
      {
        fen: START_FEN,
        marks: ['a1', 'h1', 'd1'],
        practice: false,
        text: T('A rook is worth 5 and the queen 9. The king has no price: you can never lose it.', 'Rook 5 points का है और queen 9 की। King की कोई कीमत नहीं: उसे कभी खोया नहीं जा सकता।', 'Rook 5 points चा आणि queen 9 ची. King ला किंमत नाही: तो कधीच गमावता येत नाही.'),
      },
      {
        fen: START_FEN,
        practice: false,
        text: T(
          'Before every capture, count. Giving a knight (3) for a rook (5) is a good trade: you win 2 points. Giving your queen (9) for a knight (3) loses 6. If both sides lose the same, the trade is equal.',
          'हर capture से पहले गिनो। Rook (5) के बदले knight (3) देना अच्छा trade है: तुम 2 points जीतते हो। Knight (3) के बदले queen (9) देना 6 points का नुकसान है। अगर दोनों का बराबर जाए, तो trade बराबर है।',
          'प्रत्येक capture आधी मोज. Rook (5) च्या बदल्यात knight (3) देणं चांगला trade: तू 2 points जिंकतोस. Knight (3) च्या बदल्यात queen (9) देणं म्हणजे 6 points चं नुकसान. दोघांचं सारखंच गेलं तर trade बरोबरीचा.',
        ),
      },
    ],
  },
  {
    id: 'free-pieces',
    category: 'middlegame',
    section: 'Basics',
    level: 'beginner',
    title: 'Free pieces and safe pieces',
    blurb: 'Take pieces nobody defends, and never leave your own hanging.',
    slides: () => [
      {
        fen: '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1',
        marks: ['d5'],
        practice: false,
        text: T(
          'A piece that is attacked and not defended is "hanging". The black knight on d5 is attacked by the white queen and nobody defends it.',
          'जिस piece पर attack हो और कोई defend न करे, वो "hanging" है। d5 वाले black knight पर white queen का attack है और उसे कोई defend नहीं करता।',
          'ज्या piece वर attack आहे आणि त्याला कोणी defend करत नाही, तो "hanging" असतो. d5 वरच्या black knight वर white queen चा attack आहे आणि त्याला कोणीच defend करत नाही.',
        ),
      },
      {
        fen: '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1',
        moves: ['d1d5'],
        practice: false,
        text: T('So take it! The queen captures the knight for free: White wins 3 points.', 'तो ले लो! Queen knight को free में capture करती है: White 3 points जीतता है।', 'मग घे की! Queen knight ला free मध्ये capture करते: White 3 points जिंकतो.'),
      },
      {
        fen: 'r3k3/8/8/8/8/8/8/R3K3 w - - 0 1',
        moves: ['a1a8'],
        text: T(
          'Here the black rook on a8 is hanging. White\'s rook takes it with check. Before every move, ask two questions: Can I take something for free? Is any of my pieces hanging?',
          'यहाँ a8 वाला black rook hanging है। White का rook उसे check के साथ ले लेता है। हर move से पहले दो सवाल पूछो: क्या मैं कुछ free में ले सकता हूँ? क्या मेरा कोई piece hanging है?',
          'इथे a8 वरचा black rook hanging आहे. White चा rook त्याला check देऊन घेतो. प्रत्येक move आधी दोन प्रश्न विचार: मी काही free मध्ये घेऊ शकतो का? माझा एखादा piece hanging आहे का?',
        ),
        practice: false,
      },
    ],
  },
  {
    id: 'counting',
    category: 'middlegame',
    section: 'Basics',
    level: 'beginner',
    title: 'Counting attackers and defenders',
    blurb: 'Two attackers beat one defender: count before you capture.',
    slides: () => [
      {
        fen: '3r2k1/5ppp/8/3p4/8/8/3R1PPP/3R2K1 w - - 0 1',
        marks: ['d5', 'd2', 'd1', 'd8'],
        practice: false,
        text: T(
          'The black pawn on d5 is attacked twice, by both white rooks, and defended once, by the black rook. Two attackers against one defender: White can win it.',
          'd5 वाले black pawn पर दो बार attack है, दोनों white rooks से, और उसे एक बार defend किया गया है, black rook से। दो attackers बनाम एक defender: White उसे जीत सकता है।',
          'd5 वरच्या black pawn वर दोनदा attack आहे, दोन्ही white rooks कडून, आणि त्याला एकदा defend केलंय, black rook ने. दोन attackers विरुद्ध एक defender: White तो जिंकू शकतो.',
        ),
      },
      {
        fen: '3r2k1/5ppp/8/3p4/8/8/3R1PPP/3R2K1 w - - 0 1',
        moves: ['d2d5', 'd8d5', 'd1d5'],
        text: T('Rook takes, rook takes back, rook takes again: White makes the last capture and is a pawn up. Two attackers beat one defender.', 'Rook लेता है, rook वापस लेता है, rook फिर लेता है: आखिरी capture White का है और White एक pawn आगे है। दो attackers एक defender को हरा देते हैं।', 'Rook घेतो, rook परत घेतो, rook पुन्हा घेतो: शेवटचा capture White चा आहे आणि White एक pawn पुढे आहे. दोन attackers एका defender ला हरवतात.'),
        practice: false,
      },
      {
        fen: '3r2k1/5ppp/8/3p4/8/8/3R1PPP/6K1 w - - 0 1',
        moves: ['d2d5', 'd8d5'],
        text: T('But with only one attacker against one defender, taking is a mistake: White loses a rook (5) for a pawn (1). Always count first!', 'पर सिर्फ़ एक attacker बनाम एक defender हो, तो लेना गलती है: White एक pawn (1) के बदले rook (5) खो देता है। हमेशा पहले गिनो!', 'पण फक्त एक attacker विरुद्ध एक defender असेल तर घेणं चूक आहे: White एका pawn (1) साठी rook (5) गमावतो. नेहमी आधी मोज!'),
        practice: false,
      },
    ],
  },
  {
    id: 'thinking-routine',
    category: 'middlegame',
    section: 'Basics',
    level: 'beginner',
    title: 'Checks, captures, threats',
    blurb: 'The three questions strong players ask before every move.',
    slides: () => [
      {
        fen: '4r3/7k/1p2b2p/p4p2/P2rNP2/4N3/6BP/4R1K1 w - - 0 43',
        practice: false,
        text: T(
          'Strong players look at forcing moves first. Ask, in this order: Which checks do I have? Which captures? Which threats? Then ask the same about your opponent: what are they threatening?',
          'Strong players सबसे पहले forcing moves देखते हैं। इसी order में पूछो: मेरे पास कौन से checks हैं? कौन से captures? कौन सी threats? फिर यही सामने वाले के लिए पूछो: वो क्या threat कर रहा है?',
          'Strong players सगळ्यात आधी forcing moves बघतात. याच क्रमाने विचार: माझ्याकडे कोणते checks आहेत? कोणते captures? कोणत्या threats? मग हेच समोरच्यासाठी विचार: तो काय threat करतोय?',
        ),
      },
      {
        fen: '4r3/7k/1p2b2p/p4p2/P2rNP2/4N3/6BP/4R1K1 w - - 0 43',
        moves: ['e4f6'],
        text: T(
          'Here the first check White looks at, knight to f6, is the winner: it attacks the king and the rook on e8 at the same time. Gukesh found exactly this at the 2019 World Blitz Championship.',
          'यहाँ White जो पहला check देखता है, knight f6 पर, वही जीत दिलाता है: यह एक साथ king और e8 वाले rook पर attack करता है। Gukesh ने 2019 World Blitz Championship में बिल्कुल यही खेला था।',
          'इथे White जो पहिला check बघतो, knight f6 वर, तोच जिंकवतो: तो एकाच वेळी king आणि e8 वरच्या rook वर attack करतो. Gukesh ने 2019 च्या World Blitz Championship मध्ये नेमकं हेच खेळलं होतं.',
        ),
        practice: { fen: '4r3/7k/1p2b2p/p4p2/P2rNP2/4N3/6BP/4R1K1 w - - 0 43', side: 'white' },
      },
    ],
  },
];

function build(d: Def): Lesson {
  return { id: d.id, category: d.category, section: d.section, level: d.level, title: d.title, blurb: d.blurb, slides: d.slides() };
}

export const BASIC_LESSONS: LessonEntry[] = DEFS.map((d) => ({
  id: d.id,
  category: d.category,
  section: d.section,
  level: d.level,
  title: d.title,
  blurb: d.blurb,
  load: async () => build(d),
}));
