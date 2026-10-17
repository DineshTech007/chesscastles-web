import type { Role } from 'chessops/types';
import { makeSquare } from 'chessops/util';
import { START_FEN, positionFromFen, uciToMove } from '$lib/chess/position';
import { moveSentence, noteText, type Note } from '../explain';
import { openingNotes } from '../facts';
import { fill, type L10n, type Lang } from '../i18n';
import type { Lesson, LessonEntry, Level, Slide } from '../types';
import { LEGENDS } from './legends';
import MOMENTS from '../data/moments.json';

/** A lesson moment from a legend's game (scripts/select-moments.mjs, lines from scripts/moment-lines.mjs). */
interface Moment {
  fen: string;
  move: string;
  line?: string[];
  game: { id: number; white: string; black: string; event: string; year: number; legend: string };
}

interface MotifLesson {
  motif: string;
  id: string;
  section: string;
  level: Level;
  title: string;
  blurb: string;
  /** The idea, explained before the examples. */
  intro: L10n[];
  /** What happens on the key move ({legend}, {piece}, {from}, {to}, {file}). */
  key: L10n;
}

const LESSONS: MotifLesson[] = [
  {
    motif: 'fork',
    id: 'knight-forks',
    section: 'Tactics',
    level: 'beginner',
    title: 'Knight forks',
    blurb: 'The jumping knight attacks two pieces at once. See the forks Gukesh, Anand, Divya and other stars played.',
    intro: [
      {
        en: 'A fork is one piece attacking two pieces at the same time. The opponent can save only one of them, so you win the other. The knight is the best forker: it jumps in an L shape and attacks up to eight squares.',
        hi: 'Fork का मतलब है एक piece से एक साथ दो pieces पर attack। सामने वाला सिर्फ़ एक को बचा सकता है, तो दूसरा तुम जीत लेते हो। Knight सबसे अच्छा forker है: वो L shape में jump करता है और आठ squares तक attack करता है।',
        mr: 'Fork म्हणजे एकाच piece ने एकाच वेळी दोन pieces वर attack. समोरचा फक्त एकच वाचवू शकतो, म्हणून दुसरा तू जिंकतोस. Knight सगळ्यात भारी forker आहे: तो L shape मध्ये उडी मारतो आणि आठ squares पर्यंत attack करतो.',
      },
      {
        en: 'The best forks hit the king and a big piece, like the queen or a rook. The king must escape the check, and the big piece falls. This is called a royal fork.',
        hi: 'सबसे अच्छे forks king और किसी बड़े piece, जैसे queen या rook, पर होते हैं। King को check से बचना ही पड़ता है, और बड़ा piece चला जाता है। इसे royal fork कहते हैं।',
        mr: 'सगळ्यात भारी forks king आणि एखाद्या मोठ्या piece वर असतात, जसं queen किंवा rook. King ला check मधून आधी बाहेर पडावंच लागतं, आणि मोठा piece जातो. याला royal fork म्हणतात.',
      },
    ],
    key: { en: '{legend} jumps the knight from {from} to {to}.', hi: '{legend} knight को {from} से {to} पर jump कराते हैं।', mr: '{legend} knight ला {from} वरून {to} वर उडी मारायला लावतात.' },
  },
  {
    motif: 'doubleattack',
    id: 'double-attacks',
    section: 'Tactics',
    level: 'beginner',
    title: 'Double attacks',
    blurb: 'Queens, bishops, rooks and even pawns can attack two things at once.',
    intro: [
      {
        en: 'Any piece can fork, not just the knight. A queen can attack in eight directions, and a pawn can fork two pieces diagonally. Always look for moves that create two threats at once: the opponent cannot answer both.',
        hi: 'सिर्फ़ knight ही नहीं, कोई भी piece fork कर सकता है। Queen आठ दिशाओं में attack करती है, और pawn भी तिरछा दो pieces पर fork कर सकता है। हमेशा ऐसी move ढूँढो जो एक साथ दो threats बनाए: सामने वाला दोनों का जवाब नहीं दे सकता।',
        mr: 'फक्त knight च नाही, कोणताही piece fork करू शकतो. Queen आठ दिशांना attack करते, आणि pawn पण तिरकं दोन pieces वर fork करू शकतो. नेहमी अशी move शोध जी एकाच वेळी दोन threats तयार करते: समोरचा दोन्हींचं उत्तर देऊ शकत नाही.',
      },
    ],
    key: { en: '{legend} plays the {piece} from {from} to {to}, attacking two targets at once.', hi: '{legend} {piece} को {from} से {to} पर लाते हैं और एक साथ दो चीज़ों पर attack करते हैं।', mr: '{legend} {piece} ला {from} वरून {to} वर आणतात आणि एकाच वेळी दोन गोष्टींवर attack करतात.' },
  },
  {
    motif: 'pin',
    id: 'pins',
    section: 'Tactics',
    level: 'beginner',
    title: 'Pins',
    blurb: 'Freeze a piece in front of its king, then win it.',
    intro: [
      {
        en: 'A pin attacks a piece that cannot move away, because a more valuable piece, often the king, stands behind it on the same line. Only bishops, rooks and queens can pin, because they attack along lines.',
        hi: 'Pin में ऐसे piece पर attack होता है जो हट नहीं सकता, क्योंकि उसके पीछे उसी line में ज़्यादा कीमती piece, अक्सर king, खड़ा है। सिर्फ़ bishop, rook और queen pin कर सकते हैं, क्योंकि वे lines में attack करते हैं।',
        mr: 'Pin मध्ये अशा piece वर attack होतो जो हलू शकत नाही, कारण त्याच्या मागे त्याच line वर जास्त किमतीचा piece, बहुतेक वेळा king, उभा असतो. फक्त bishop, rook आणि queen pin करू शकतात, कारण ते lines वर attack करतात.',
      },
      {
        en: 'A pinned piece is stuck. Attack it again, with a pawn if you can, and it falls.',
        hi: 'Pin हुआ piece फँस जाता है। उस पर दोबारा attack करो, हो सके तो pawn से, और वो गिर जाएगा।',
        mr: 'Pin झालेला piece अडकतो. त्याच्यावर पुन्हा attack कर, जमलं तर pawn ने, आणि तो जातो.',
      },
    ],
    key: { en: '{legend} brings the {piece} to {to}, and now a piece is pinned to its king.', hi: '{legend} {piece} को {to} पर लाते हैं, और अब एक piece अपने king से pin हो जाता है।', mr: '{legend} {piece} ला {to} वर आणतात, आणि आता एक piece त्याच्या king शी pin होतो.' },
  },
  {
    motif: 'skewer',
    id: 'skewers',
    section: 'Tactics',
    level: 'intermediate',
    title: 'Skewers',
    blurb: 'Attack the big piece; when it moves, take the one behind it.',
    intro: [
      {
        en: 'A skewer is a pin turned around. You attack a valuable piece, like the king or queen, and behind it on the same line stands another piece. The valuable piece must move away, and you capture the piece behind it.',
        hi: 'Skewer उल्टा pin है। तुम किसी कीमती piece, जैसे king या queen, पर attack करते हो, और उसी line में उसके पीछे दूसरा piece खड़ा है। कीमती piece को हटना पड़ता है, और तुम पीछे वाला piece capture कर लेते हो।',
        mr: 'Skewer म्हणजे उलटा pin. तू एखाद्या किमती piece वर, जसं king किंवा queen, attack करतोस, आणि त्याच line वर त्याच्या मागे दुसरा piece उभा असतो. किमती piece ला बाजूला व्हावं लागतं, आणि मागचा piece तू capture करतोस.',
      },
    ],
    key: { en: '{legend} plays the {piece} to {to}: the front piece must move, and the one behind falls.', hi: '{legend} {piece} को {to} पर लाते हैं: आगे वाले piece को हटना पड़ता है, और पीछे वाला गिर जाता है।', mr: '{legend} {piece} ला {to} वर आणतात: पुढच्या piece ला हलावं लागतं, आणि मागचा piece जातो.' },
  },
  {
    motif: 'discovered',
    id: 'discovered-attacks',
    section: 'Tactics',
    level: 'intermediate',
    title: 'Discovered attacks',
    blurb: 'Move one piece out of the way and another one attacks.',
    intro: [
      {
        en: 'In a discovered attack, one piece moves out of the way and uncovers an attack by a bishop, rook or queen standing behind it. The piece that moves can make its own threat too, so you get two attacks with one move.',
        hi: 'Discovered attack में एक piece रास्ते से हटता है और उसके पीछे खड़े bishop, rook या queen का attack खुल जाता है। हटने वाला piece खुद भी threat बना सकता है, तो एक move में दो attacks।',
        mr: 'Discovered attack मध्ये एक piece रस्त्यातून बाजूला होतो आणि त्याच्या मागे उभ्या bishop, rook किंवा queen चा attack उघडतो. हलणारा piece स्वतः पण threat करू शकतो, म्हणजे एका move मध्ये दोन attacks.',
      },
    ],
    key: { en: '{legend} moves the {piece} from {from} to {to}, and the piece behind it attacks.', hi: '{legend} {piece} को {from} से {to} पर हटाते हैं, और पीछे वाला piece attack करने लगता है।', mr: '{legend} {piece} ला {from} वरून {to} वर हलवतात, आणि मागचा piece attack करू लागतो.' },
  },
  {
    motif: 'doublecheck',
    id: 'double-check',
    section: 'Tactics',
    level: 'advanced',
    title: 'Double check',
    blurb: 'Two pieces give check at once: the king must run.',
    intro: [
      {
        en: 'A double check is the strongest discovered attack: both the moving piece and the piece behind it give check. You cannot block two checks or capture two pieces, so the king must move. Double checks often lead to mate.',
        hi: 'Double check सबसे ताकतवर discovered attack है: चलने वाला piece और उसके पीछे वाला piece दोनों check देते हैं। दो checks को न रोका जा सकता है न दोनों pieces को capture किया जा सकता है, तो king को भागना ही पड़ता है। Double check से अक्सर mate होता है।',
        mr: 'Double check हा सगळ्यात जबरदस्त discovered attack आहे: हलणारा piece आणि त्याच्या मागचा piece दोघंही check देतात. दोन checks अडवता येत नाहीत आणि दोन्ही pieces capture करता येत नाहीत, म्हणून king ला पळावंच लागतं. Double check मुळे बऱ्याचदा mate होतो.',
      },
    ],
    key: { en: '{legend} moves the {piece} to {to}: double check!', hi: '{legend} {piece} को {to} पर लाते हैं: double check!', mr: '{legend} {piece} ला {to} वर आणतात: double check!' },
  },
  {
    motif: 'backrank',
    id: 'back-rank-mate',
    section: 'Checkmate patterns',
    level: 'beginner',
    title: 'Back-rank mate',
    blurb: 'A king trapped behind its own pawns, mated by a rook or queen.',
    intro: [
      {
        en: 'A king that stays behind its three pawns feels safe, but it has no escape square. A rook or queen that reaches the back rank can give checkmate. Strong players often make a little window for the king with a pawn move like h3 or h6.',
        hi: 'अपने तीन pawns के पीछे बैठा king safe लगता है, पर उसके पास भागने का कोई square नहीं होता। Back rank पर पहुँचा rook या queen checkmate दे सकता है। Strong players अक्सर h3 या h6 जैसी pawn move से king के लिए एक खिड़की बना देते हैं।',
        mr: 'आपल्या तीन pawns च्या मागे बसलेला king safe वाटतो, पण त्याला पळायला square नसतो. Back rank वर पोहोचलेला rook किंवा queen checkmate देऊ शकतो. Strong players बऱ्याचदा h3 किंवा h6 सारख्या pawn move ने king साठी एक खिडकी ठेवतात.',
      },
    ],
    key: { en: '{legend} plays the {piece} to {to} on the back rank.', hi: '{legend} {piece} को back rank पर {to} पर लाते हैं।', mr: '{legend} {piece} ला back rank वर {to} वर आणतात.' },
  },
  {
    motif: 'smothered',
    id: 'smothered-mate',
    section: 'Checkmate patterns',
    level: 'intermediate',
    title: 'Smothered mate',
    blurb: 'The knight mates a king that is boxed in by its own pieces.',
    intro: [
      {
        en: 'In a smothered mate the king is surrounded by its own pieces, so it cannot move at all. A single knight check is then checkmate, because the knight jumps over everything and cannot be blocked.',
        hi: 'Smothered mate में king अपने ही pieces से घिरा होता है, इसलिए वो बिल्कुल हिल नहीं सकता। तब knight का एक check ही checkmate होता है, क्योंकि knight सबके ऊपर से jump करता है और उसे रोका नहीं जा सकता।',
        mr: 'Smothered mate मध्ये king आपल्याच pieces नी वेढलेला असतो, त्यामुळे तो अजिबात हलू शकत नाही. मग knight चा एक check च checkmate ठरतो, कारण knight सगळ्यांवरून उडी मारतो आणि त्याला अडवता येत नाही.',
      },
    ],
    key: { en: '{legend} jumps the knight to {to}.', hi: '{legend} knight को {to} पर jump कराते हैं।', mr: '{legend} knight ला {to} वर उडी मारायला लावतात.' },
  },
  {
    motif: 'mate2',
    id: 'mate-in-two',
    section: 'Checkmate patterns',
    level: 'intermediate',
    title: 'Mate in two',
    blurb: 'Real games where a legend forced checkmate in two moves.',
    intro: [
      {
        en: 'To find a mate in two, look at every check first, then at moves that take away the king\'s last escape squares. In these real games, the legend\'s first move leaves the opponent no defence.',
        hi: 'Mate in two ढूँढने के लिए पहले हर check देखो, फिर ऐसी moves जो king के बचे हुए squares बंद कर दें। इन असली games में legend की पहली move के बाद सामने वाले के पास कोई बचाव नहीं बचता।',
        mr: 'Mate in two शोधायला आधी प्रत्येक check बघ, मग king चे उरलेले squares बंद करणाऱ्या moves बघ. या खऱ्या games मध्ये legend च्या पहिल्या move नंतर समोरच्याकडे काहीच बचाव उरत नाही.',
      },
    ],
    key: { en: '{legend} starts with the {piece} from {from} to {to}.', hi: '{legend} शुरुआत करते हैं {piece} को {from} से {to} पर लाकर।', mr: '{legend} सुरुवात करतात {piece} ला {from} वरून {to} वर आणून.' },
  },
  {
    motif: 'mate3',
    id: 'mate-in-three',
    section: 'Checkmate patterns',
    level: 'advanced',
    title: 'Mate in three',
    blurb: 'Longer mating attacks from real games.',
    intro: [
      {
        en: 'A mate in three needs a plan: often a check or a sacrifice to pull the king out, then the pieces close the net. Watch how each move leaves the opponent fewer choices.',
        hi: 'Mate in three के लिए plan चाहिए: अक्सर एक check या sacrifice से king को बाहर खींचो, फिर pieces जाल बंद करते हैं। देखो हर move कैसे सामने वाले के options कम करती है।',
        mr: 'Mate in three साठी plan लागतो: बहुतेक वेळा check किंवा sacrifice ने king ला बाहेर ओढायचं, मग pieces जाळं बंद करतात. बघ प्रत्येक move समोरच्याचे options कसे कमी करते.',
      },
    ],
    key: { en: '{legend} begins with the {piece} from {from} to {to}.', hi: '{legend} शुरू करते हैं {piece} को {from} से {to} पर लाकर।', mr: '{legend} सुरुवात करतात {piece} ला {from} वरून {to} वर आणून.' },
  },
  {
    motif: 'queensac',
    id: 'queen-sacrifices',
    section: 'Tactics',
    level: 'advanced',
    title: 'Queen sacrifices',
    blurb: 'Giving away the strongest piece to force checkmate.',
    intro: [
      {
        en: 'Sometimes the queen is worth giving up. If taking the queen lets your other pieces give checkmate, the sacrifice wins the game. Legends calculate the whole line before they let the queen go.',
        hi: 'कभी-कभी queen को देना भी फ़ायदे का होता है। अगर queen लेने से तुम्हारे बाकी pieces checkmate दे सकते हैं, तो sacrifice game जिता देती है। Legends queen देने से पहले पूरी line calculate करते हैं।',
        mr: 'कधी कधी queen देणं पण फायद्याचं असतं. queen घेतल्यावर तुझे बाकीचे pieces checkmate देऊ शकत असतील, तर sacrifice ने game जिंकतो. Legends queen देण्याआधी पूर्ण line calculate करतात.',
      },
    ],
    key: { en: '{legend} puts the queen on {to}, where it can be taken!', hi: '{legend} queen को {to} पर रखते हैं, जहाँ उसे capture किया जा सकता है!', mr: '{legend} queen ला {to} वर ठेवतात, जिथे ती capture होऊ शकते!' },
  },
  {
    motif: 'greekgift',
    id: 'greek-gift',
    section: 'Tactics',
    level: 'advanced',
    title: 'The Greek gift sacrifice',
    blurb: 'Bishop takes h7 with check, and the attack on the king begins.',
    intro: [
      {
        en: 'The Greek gift is a classic attack on a castled king: the bishop takes the h7 pawn (h2 for Black) with check. After the king takes it, the knight and queen jump in with checks. It works when the knight can reach g5 and the queen can reach the h-file.',
        hi: 'Greek gift castled king पर एक classic attack है: bishop check के साथ h7 का pawn ले लेता है (Black के लिए h2)। King के bishop लेने के बाद knight और queen checks के साथ आते हैं। यह तब काम करता है जब knight g5 पर और queen h-file पर पहुँच सके।',
        mr: 'Greek gift हा castled king वरचा classic attack आहे: bishop check देऊन h7 चा pawn घेतो (Black साठी h2). King ने bishop घेतल्यावर knight आणि queen checks देत येतात. Knight g5 वर आणि queen h-file वर पोहोचू शकत असेल तेव्हाच हे चालतं.',
      },
    ],
    key: { en: '{legend} plays bishop takes {to}, check!', hi: '{legend} bishop से {to} capture करते हैं, check!', mr: '{legend} bishop ने {to} capture करतात, check!' },
  },
  {
    motif: 'combination',
    id: 'combinations',
    section: 'Tactics',
    level: 'advanced',
    title: 'Winning combinations',
    blurb: 'Forcing sequences that win material, found by world-class players.',
    intro: [
      {
        en: 'A combination is a series of forcing moves, checks, captures and threats, that wins something in the end. The first move often looks strange or even gives material away. Follow the whole line to see why it works.',
        hi: 'Combination forcing moves की एक series है, checks, captures और threats, जिससे आखिर में कुछ जीत मिलता है। पहली move अक्सर अजीब लगती है या material भी दे देती है। पूरी line देखो, तब समझ आएगा कि यह क्यों काम करती है।',
        mr: 'Combination म्हणजे forcing moves ची एक series, checks, captures आणि threats, ज्याने शेवटी काहीतरी जिंकता येतं. पहिली move बऱ्याचदा विचित्र वाटते किंवा material पण देते. पूर्ण line बघ, मग कळेल हे का चालतं.',
      },
    ],
    key: { en: '{legend} starts the combination with the {piece} from {from} to {to}.', hi: '{legend} combination की शुरुआत {piece} को {from} से {to} पर लाकर करते हैं।', mr: '{legend} combination ची सुरुवात {piece} ला {from} वरून {to} वर आणून करतात.' },
  },
  {
    motif: 'passedpawn',
    id: 'passed-pawns',
    section: 'Strategy',
    level: 'intermediate',
    title: 'Passed pawn power',
    blurb: 'A pawn that no enemy pawn can stop can decide the game.',
    intro: [
      {
        en: 'A passed pawn has no enemy pawns in front of it or on the files next to it. Only pieces can stop it, and every step forward makes it more dangerous. When it reaches the last rank it becomes a queen.',
        hi: 'Passed pawn के आगे या बगल वाली files पर कोई enemy pawn नहीं होता। उसे सिर्फ़ pieces रोक सकते हैं, और हर कदम के साथ वो और खतरनाक होता जाता है। आखिरी rank पर पहुँचकर वो queen बन जाता है।',
        mr: 'Passed pawn च्या पुढे किंवा शेजारच्या files वर एकही enemy pawn नसतो. त्याला फक्त pieces अडवू शकतात, आणि प्रत्येक पावलाबरोबर तो जास्त धोकादायक होतो. शेवटच्या rank वर पोहोचला की तो queen बनतो.',
      },
    ],
    key: { en: '{legend} pushes the pawn to {to}.', hi: '{legend} pawn को {to} पर आगे बढ़ाते हैं।', mr: '{legend} pawn ला {to} वर पुढे ढकलतात.' },
  },
  {
    motif: 'outpost',
    id: 'outposts',
    section: 'Strategy',
    level: 'intermediate',
    title: 'Knight outposts',
    blurb: 'A safe square deep in enemy land, where no pawn can chase your knight.',
    intro: [
      {
        en: 'An outpost is a square in the opponent\'s half, protected by your pawn, where no enemy pawn can ever attack. A knight on an outpost is a monster: it cannot be chased away and controls many squares.',
        hi: 'Outpost सामने वाले के half में ऐसा square है जिसे तुम्हारा pawn protect करता है और जिस पर कोई enemy pawn कभी attack नहीं कर सकता। Outpost पर बैठा knight एक monster है: उसे भगाया नहीं जा सकता और वो बहुत सारे squares control करता है।',
        mr: 'Outpost म्हणजे समोरच्याच्या half मधला असा square जो तुझा pawn protect करतो आणि ज्यावर कोणताही enemy pawn कधीच attack करू शकत नाही. Outpost वर बसलेला knight एकदम monster असतो: त्याला हाकलता येत नाही आणि तो खूप squares control करतो.',
      },
    ],
    key: { en: '{legend} puts the knight on {to}: a pawn protects it and no enemy pawn can ever chase it away.', hi: '{legend} knight को {to} पर रखते हैं: pawn उसे protect करता है और कोई enemy pawn उसे कभी भगा नहीं सकता।', mr: '{legend} knight ला {to} वर ठेवतात: pawn त्याला protect करतो आणि कोणताही enemy pawn त्याला कधीच हाकलू शकत नाही.' },
  },
  {
    motif: 'openfile',
    id: 'open-files',
    section: 'Strategy',
    level: 'intermediate',
    title: 'Rooks on open files',
    blurb: 'Put your rooks where no pawns block them.',
    intro: [
      {
        en: 'Rooks love open files, files with no pawns on them. From an open file a rook can travel all the way into the opponent\'s camp. Take the open file before your opponent does, and double your rooks on it if you can.',
        hi: 'Rooks को open files पसंद हैं, यानी ऐसी files जिन पर कोई pawn नहीं। Open file से rook सीधा सामने वाले के घर तक जा सकता है। Open file पर सामने वाले से पहले कब्ज़ा करो, और हो सके तो दोनों rooks वहाँ लाओ।',
        mr: 'Rooks ना open files आवडतात, म्हणजे ज्या files वर एकही pawn नाही. Open file वरून rook थेट समोरच्याच्या घरात जाऊ शकतो. समोरच्याच्या आधी open file ताब्यात घे, आणि जमलं तर दोन्ही rooks तिथे आण.',
      },
    ],
    key: { en: '{legend} moves the rook to the open {file}-file.', hi: '{legend} rook को open {file}-file पर लाते हैं।', mr: '{legend} rook ला open {file}-file वर आणतात.' },
  },
  {
    motif: 'seventh',
    id: 'seventh-rank',
    section: 'Strategy',
    level: 'intermediate',
    title: 'Rook on the 7th rank',
    blurb: 'A rook on the 7th rank eats pawns and traps the king.',
    intro: [
      {
        en: 'The 7th rank (the 2nd rank for Black) is where the opponent\'s pawns start. A rook there attacks those pawns from the side and can trap the king on the last rank. Two rooks on the 7th are often winning.',
        hi: '7th rank (Black के लिए 2nd rank) वहाँ है जहाँ सामने वाले के pawns शुरू में होते हैं। वहाँ पहुँचा rook उन pawns पर बगल से attack करता है और king को आखिरी rank पर फँसा सकता है। 7th rank पर दो rooks अक्सर जीत दिला देते हैं।',
        mr: '7th rank (Black साठी 2nd rank) म्हणजे जिथे समोरच्याचे pawns सुरुवातीला असतात. तिथे पोहोचलेला rook त्या pawns वर बाजूने attack करतो आणि king ला शेवटच्या rank वर अडकवू शकतो. 7th rank वर दोन rooks असले की बऱ्याचदा game जिंकतो.',
      },
    ],
    key: { en: '{legend} brings the rook to {to}, on the 7th rank.', hi: '{legend} rook को 7th rank पर {to} पर लाते हैं।', mr: '{legend} rook ला 7th rank वर {to} वर आणतात.' },
  },
];

const VALUE: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
const TACTICAL = new Set(['capture', 'pins', 'attacks', 'fork', 'check', 'mate']);

const SEEN_TEXT: L10n = { en: '{white} vs {black}, {event} {year}.', hi: '{white} vs {black}, {event} {year}।', mr: '{white} vs {black}, {event} {year}.' };
const LOOK: L10n = { en: '{legend} plays {side} here. Look at the {piece} on {from}: what can it do?', hi: 'यहाँ {legend} {side} से खेल रहे हैं। {from} वाले {piece} को देखो: वो क्या कर सकता है?', mr: 'इथे {legend} {side} ने खेळत आहेत. {from} वरचा {piece} बघ: तो काय करू शकतो?' };
const END_WIN: L10n = { en: 'At the end of the line, {legend} has won the {piece}.', hi: 'Line के आखिर में {legend} ने {piece} जीत लिया।', mr: 'Line च्या शेवटी {legend} ने {piece} जिंकला.' };
const END_MATE: L10n = { en: 'And it ends in checkmate. Brilliant!', hi: 'और आखिर में checkmate। कमाल!', mr: 'आणि शेवटी checkmate. कमाल!' };
const END_QUEEN: L10n = { en: 'The pawn becomes a queen, and the game is decided.', hi: 'Pawn queen बन जाता है, और game का फ़ैसला हो जाता है।', mr: 'Pawn queen बनतो, आणि game चा निकाल लागतो.' };
const END_PLAN: L10n = { en: 'Watch how the position develops: {legend} keeps the advantage.', hi: 'देखो position कैसे आगे बढ़ती है: {legend} बढ़त बनाए रखते हैं।', mr: 'बघ position कशी पुढे जाते: {legend} आघाडी टिकवून ठेवतात.' };
const PRACTICE_HINT: L10n = { en: 'Now try it yourself: press Practice and play this position against the engine.', hi: 'अब खुद try करो: Practice दबाओ और यह position engine के खिलाफ़ खेलो।', mr: 'आता स्वतः try कर: Practice दाब आणि ही position engine विरुद्ध खेळ.' };

const both = (fn: (lang: Lang) => string): L10n => ({ en: fn('en'), hi: fn('hi'), mr: fn('mr') });

/** The slides for one real-game moment: the position, the key move, the whole line. */
function momentSlides(def: MotifLesson, m: Moment, firstTime: boolean): Slide[] {
  const pos = positionFromFen(m.fen);
  const move = uciToMove(m.move)!;
  const piece = pos.board.get(move.from)?.role ?? 'piece';
  const legend = LEGENDS[m.game.legend]?.name ?? m.game.legend;
  const side = pos.turn === 'white' ? 'White' : 'Black';
  const vars = { legend, piece, from: makeSquare(move.from), to: makeSquare(move.to), file: makeSquare(move.to)[0], side, white: m.game.white, black: m.game.black, event: m.game.event, year: m.game.year || '' };
  const game = { ...m.game };
  const orientation = pos.turn;

  const intro: Slide = {
    fen: m.fen,
    game,
    orientation,
    marks: [vars.from],
    text: both((l) => [fill(SEEN_TEXT[l], vars), firstTime && LEGENDS[m.game.legend] ? LEGENDS[m.game.legend].bio[l] : '', fill(LOOK[l], vars)].filter(Boolean).join(' ')),
    practice: { side: pos.turn },
  };

  // The key move, with the tactical facts it creates.
  const notes = openingNotes(pos, move).filter((n) => TACTICAL.has(n.k)) as Note[];
  const key: Slide = {
    fen: m.fen,
    moves: [m.move],
    game,
    orientation,
    text: both((l) => [fill(def.key[l], vars), ...notes.map((n) => noteText(n, l))].join(' ')),
    practice: { fen: m.fen, side: pos.turn },
  };

  // The whole line: what it wins in the end.
  const line = (m.line ?? [m.move]).filter((u, i) => i > 0 || u === m.move);
  const p = pos.clone();
  const start = material(p, pos.turn);
  let biggest: Role | undefined;
  let promoted = false;
  for (const u of line) {
    const mv = uciToMove(u);
    if (!mv || !p.isLegal(mv)) break;
    const taken = p.board.get(mv.to);
    if (p.turn === pos.turn && taken && taken.color !== p.turn && (!biggest || VALUE[taken.role] > VALUE[biggest])) biggest = taken.role;
    if (mv.promotion) promoted = true;
    p.play(mv);
  }
  const gain = material(p, pos.turn) - start;
  const end = p.isCheckmate() ? END_MATE : promoted ? END_QUEEN : gain >= 2 && biggest ? END_WIN : END_PLAN;
  const slides = [intro, key];
  if (line.length > 1) {
    slides.push({
      fen: m.fen,
      moves: line,
      game,
      orientation,
      text: both((l) => `${fill(end[l], { ...vars, piece: biggest ?? 'piece' })} ${PRACTICE_HINT[l]}`),
      practice: { fen: m.fen, side: pos.turn },
    });
  }
  return slides;
}

function material(pos: ReturnType<typeof positionFromFen>, color: 'white' | 'black'): number {
  let n = 0;
  for (const r of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]) n += (pos.board.pieces(color, r).size() - pos.board.pieces(color === 'white' ? 'black' : 'white', r).size()) * VALUE[r];
  return n;
}

function build(def: MotifLesson): Lesson {
  const moments = ((MOMENTS as Record<string, Moment[]>)[def.motif] ?? []).filter((m) => uciToMove(m.move) && positionFromFen(m.fen).isLegal(uciToMove(m.move)!));
  const first = moments[0];
  const slides: Slide[] = def.intro.map((text) => ({ fen: first ? first.fen : START_FEN, text, practice: false as const, orientation: first ? positionFromFen(first.fen).turn : 'white' }));
  const seen = new Set<string>();
  for (const m of moments) {
    slides.push(...momentSlides(def, m, !seen.has(m.game.legend)));
    seen.add(m.game.legend);
  }
  return { id: def.id, category: 'middlegame', section: def.section, level: def.level, title: def.title, blurb: def.blurb, slides, legends: [...seen] };
}

export const TACTIC_LESSONS: LessonEntry[] = LESSONS.map((def) => ({
  id: def.id,
  category: 'middlegame',
  section: def.section,
  level: def.level,
  title: def.title,
  blurb: def.blurb,
  legends: [...new Set(((MOMENTS as Record<string, Moment[]>)[def.motif] ?? []).map((m) => m.game.legend))],
  load: async () => build(def),
}));

