import { parseSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';
import { CloudBook, movesInRange } from '$lib/book/book';
import { fenOf, moveToUci, playSans, positionFromFen, sanOf, START_FEN } from '$lib/chess/position';
import { moveSentence, noteText, shortCount } from '../explain';
import { openingNotes } from '../facts';
import type { L10n, Lang } from '../i18n';
import type { Lesson, LessonEntry, Level, Slide } from '../types';

/**
 * Opening courses: a main line played out move by move. Each move is
 * explained from checked facts (development, centre, castling, threats) and
 * how often strong players (2000+) chose it in our 5.4 million games.
 */
export interface OpeningCourse {
  id: string;
  name: string;
  eco: string;
  side: 'white' | 'black';
  level: Level;
  section: string;
  /** The main line, in SAN. */
  line: string;
  idea: L10n;
}

const I = (en: string, hi: string, mr: string): L10n => ({ en, hi, mr });

export const COURSES: OpeningCourse[] = [
  // Opening basics
  {
    id: 'italian-game', name: 'Italian Game (Giuoco Piano)', eco: 'C50', side: 'white', level: 'beginner', section: 'Opening basics',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    idea: I('The oldest plan in chess: a pawn in the centre, quick development, the bishop aiming at f7, and early castling. Calm, healthy and perfect for learning.', 'शतरंज का सबसे पुराना plan: centre में pawn, जल्दी development, f7 पर निशाना साधता bishop और जल्दी castling। शांत, मज़बूत और सीखने के लिए perfect।', 'बुद्धिबळातला सगळ्यात जुना plan: centre मध्ये pawn, पटकन development, f7 वर नेम धरणारा bishop आणि लवकर castling. शांत, भक्कम आणि शिकायला perfect.'),
  },
  {
    id: 'fried-liver', name: 'Fried Liver Attack', eco: 'C57', side: 'white', level: 'beginner', section: 'Opening basics',
    line: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3 Nb4',
    idea: I('A wild attack on f7: White sacrifices a knight to pull the black king into the open. Black should avoid it with 5...Na5, but you must know the danger!', 'f7 पर एक जंगली attack: White एक knight sacrifice करके black king को खुले में खींच लाता है। Black को 5...Na5 से इससे बचना चाहिए, पर खतरा जानना ज़रूरी है!', 'f7 वर एक धमाकेदार attack: White एक knight sacrifice करून black king ला उघड्यावर ओढतो. Black ने 5...Na5 खेळून हे टाळायला हवं, पण धोका माहीत पाहिजे!'),
  },
  {
    id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06', side: 'white', level: 'beginner', section: 'Opening basics',
    line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3',
    idea: I('White offers the c-pawn to pull Black\'s d-pawn away from the centre. Simple development and steady pressure: a favourite of world champions for over a hundred years.', 'White c-pawn offer करता है ताकि Black का d-pawn centre से हट जाए। सीधा development और लगातार pressure: सौ साल से ज़्यादा से world champions की पसंद।', 'White c-pawn offer करतो म्हणजे Black चा d-pawn centre पासून दूर जाईल. सोपं development आणि सतत pressure: शंभराहून जास्त वर्षं world champions ची आवड.'),
  },
  // Open games
  {
    id: 'giuoco-pianissimo', name: 'Italian Game: Giuoco Pianissimo', eco: 'C53', side: 'white', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7',
    idea: I('The modern Italian: White keeps the centre solid with c3 and d3, then slowly prepares d4 and a kingside build-up. Carlsen and Caruana play it at the highest level.', 'Modern Italian: White c3 और d3 से centre solid रखता है, फिर धीरे-धीरे d4 और kingside की तैयारी करता है। Carlsen और Caruana इसे सबसे ऊँचे level पर खेलते हैं।', 'Modern Italian: White c3 आणि d3 ने centre solid ठेवतो, मग हळूहळू d4 आणि kingside ची तयारी करतो. Carlsen आणि Caruana ही सगळ्यात उच्च level वर खेळतात.'),
  },
  {
    id: 'two-knights', name: 'Two Knights Defence', eco: 'C59', side: 'black', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5',
    idea: I('Black answers the Italian with an active knight and meets Ng5 with ...d5 and ...Na5, giving a pawn for fast development and attack. The right way to beat the Fried Liver.', 'Black Italian का जवाब active knight से देता है और Ng5 के खिलाफ़ ...d5 और ...Na5 खेलता है: एक pawn देकर तेज़ development और attack। Fried Liver को हराने का सही तरीका।', 'Black Italian ला active knight ने उत्तर देतो आणि Ng5 विरुद्ध ...d5 आणि ...Na5 खेळतो: एक pawn देऊन पटकन development आणि attack. Fried Liver ला हरवायचा बरोबर मार्ग.'),
  },
  {
    id: 'ruy-lopez', name: 'Ruy Lopez (Closed)', eco: 'C84', side: 'white', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
    idea: I('The Spanish Game: the bishop attacks the knight that defends e5, building long-term pressure. White castles, plays c3 and h3, and prepares d4. One of the richest openings in chess.', 'Spanish Game: bishop उस knight पर attack करता है जो e5 को defend करता है, और लंबा pressure बनता है। White castling करता है, c3 और h3 खेलता है, और d4 की तैयारी करता है। शतरंज की सबसे rich openings में से एक।', 'Spanish Game: bishop e5 ला defend करणाऱ्या knight वर attack करतो, आणि लांबचं pressure तयार होतं. White castling करतो, c3 आणि h3 खेळतो, आणि d4 ची तयारी करतो. बुद्धिबळातल्या सगळ्यात rich openings पैकी एक.'),
  },
  {
    id: 'berlin', name: 'Berlin Defence', eco: 'C67', side: 'black', level: 'advanced', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
    idea: I('The "Berlin Wall": Black trades queens early and reaches a solid endgame with the bishop pair. Kramnik used it to beat Kasparov in their 2000 World Championship match.', '"Berlin Wall": Black जल्दी queens trade करता है और bishop pair के साथ एक solid endgame पाता है। Kramnik ने 2000 World Championship match में Kasparov को हराने के लिए इसे खेला।', '"Berlin Wall": Black लवकर queens trade करतो आणि bishop pair सोबत एक solid endgame मिळवतो. Kramnik ने 2000 च्या World Championship match मध्ये Kasparov ला हरवताना ही खेळली.'),
  },
  {
    id: 'scotch', name: 'Scotch Game', eco: 'C45', side: 'white', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
    idea: I('White opens the centre at once with d4. After the exchange on c6, White gains space with e5 and c4 while Black gets the bishop pair. Kasparov revived it in the 1990s.', 'White तुरंत d4 से centre खोलता है। c6 पर exchange के बाद White e5 और c4 से space लेता है, जबकि Black को bishop pair मिलता है। Kasparov ने 1990 के दशक में इसे फिर से popular बनाया।', 'White लगेच d4 ने centre उघडतो. c6 वर exchange नंतर White e5 आणि c4 ने space घेतो, तर Black ला bishop pair मिळते. Kasparov ने 1990 च्या दशकात ही परत popular केली.'),
  },
  {
    id: 'four-knights', name: 'Four Knights Game', eco: 'C48', side: 'white', level: 'beginner', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6',
    idea: I('All four knights come out first: the most natural development there is. Safe, symmetrical and great for learning how pieces cooperate.', 'चारों knights सबसे पहले बाहर आते हैं: सबसे natural development। Safe, symmetrical और pieces का साथ काम करना सीखने के लिए बढ़िया।', 'चारही knights सगळ्यात आधी बाहेर येतात: सगळ्यात natural development. Safe, symmetrical आणि pieces एकत्र कसे काम करतात हे शिकायला मस्त.'),
  },
  {
    id: 'petrov', name: "Petrov's Defence", eco: 'C42', side: 'black', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
    idea: I('Black counterattacks e4 instead of defending e5. Very solid: careful move order matters (3...d6 first, never 3...Nxe4? at once).', 'Black e5 को defend करने की बजाय e4 पर counterattack करता है। बहुत solid: move order का ध्यान रखो (पहले 3...d6, तुरंत 3...Nxe4? कभी नहीं)।', 'Black e5 defend करण्याऐवजी e4 वर counterattack करतो. खूप solid: move order जपायचा (आधी 3...d6, लगेच 3...Nxe4? कधीच नाही).'),
  },
  {
    id: 'kings-gambit', name: "King's Gambit", eco: 'C39', side: 'white', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6',
    idea: I('The romantic gambit of the 1800s: White gives the f-pawn to open the f-file and attack. Sharp and dangerous for both sides.', '1800 के दशक का romantic gambit: White f-file खोलकर attack करने के लिए f-pawn देता है। दोनों तरफ़ के लिए sharp और खतरनाक।', '1800 च्या दशकातला romantic gambit: White f-file उघडून attack करायला f-pawn देतो. दोन्ही बाजूंसाठी sharp आणि धोकादायक.'),
  },
  {
    id: 'vienna', name: 'Vienna Game', eco: 'C29', side: 'white', level: 'beginner', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O',
    idea: I('White develops the queen\'s knight first and then strikes with f4, like a safer King\'s Gambit.', 'White पहले queen-side knight निकालता है और फिर f4 से वार करता है, एक safe King\'s Gambit की तरह।', 'White आधी queen-side knight बाहेर काढतो आणि मग f4 ने वार करतो, safe King\'s Gambit सारखं.'),
  },
  {
    id: 'evans-gambit', name: 'Evans Gambit', eco: 'C52', side: 'white', level: 'intermediate', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O',
    idea: I('White gives the b-pawn to win time: c3 and d4 follow with tempo, and the pieces fly toward the black king. Kasparov famously beat Anand with it in 1995.', 'White समय पाने के लिए b-pawn देता है: c3 और d4 tempo के साथ आते हैं, और pieces black king की तरफ़ दौड़ते हैं। Kasparov ने 1995 में इसी से Anand को हराया था।', 'White वेळ मिळवायला b-pawn देतो: c3 आणि d4 tempo सोबत येतात, आणि pieces black king कडे धावतात. Kasparov ने 1995 मध्ये याच opening ने Anand ला हरवलं होतं.'),
  },
  {
    id: 'philidor', name: 'Philidor Defence', eco: 'C41', side: 'black', level: 'beginner', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O',
    idea: I('Named after Philidor, the great 18th-century player: Black holds e5 firmly with ...d6 and ...Nbd7, then develops calmly. Solid and easy to learn.', '18वीं सदी के महान player Philidor के नाम पर: Black ...d6 और ...Nbd7 से e5 को मज़बूती से पकड़ता है, फिर आराम से develop करता है। Solid और सीखने में आसान।', '18 व्या शतकातले महान player Philidor यांच्या नावाने: Black ...d6 आणि ...Nbd7 ने e5 घट्ट पकडून ठेवतो, मग शांतपणे develop करतो. Solid आणि शिकायला सोपं.'),
  },
  {
    id: 'danish-gambit', name: 'Danish Gambit', eco: 'C21', side: 'white', level: 'beginner', section: 'Open games (1.e4 e5)',
    line: 'e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2',
    idea: I('White gives two pawns for two bishops aiming at the black king. A great opening for kids to learn about fast development and open lines.', 'White दो pawns देता है और बदले में दो bishops black king पर निशाना साधते हैं। Kids के लिए तेज़ development और खुली lines सीखने की बढ़िया opening।', 'White दोन pawns देतो आणि त्याबदल्यात दोन bishops black king वर नेम धरतात. पटकन development आणि उघड्या lines शिकायला kids साठी मस्त opening.'),
  },
  // Sicilian
  {
    id: 'najdorf', name: 'Sicilian: Najdorf Variation', eco: 'B90', side: 'black', level: 'advanced', section: 'Sicilian Defence',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O',
    idea: I('5...a6 keeps White\'s pieces off b5 and prepares ...e5 and ...b5. The fighting choice of Fischer and Kasparov. Here White plays the sharp English Attack with castling on opposite sides.', '5...a6 White के pieces को b5 से दूर रखता है और ...e5 और ...b5 की तैयारी करता है। Fischer और Kasparov की fighting पसंद। यहाँ White sharp English Attack खेलता है, अलग-अलग तरफ़ castling के साथ।', '5...a6 White चे pieces b5 पासून दूर ठेवतो आणि ...e5 आणि ...b5 ची तयारी करतो. Fischer आणि Kasparov ची fighting निवड. इथे White sharp English Attack खेळतो, वेगवेगळ्या बाजूला castling करून.'),
  },
  {
    id: 'dragon', name: 'Sicilian: Dragon Variation', eco: 'B76', side: 'black', level: 'advanced', section: 'Sicilian Defence',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O',
    idea: I('The bishop on g7 breathes fire along the long diagonal. Against the Yugoslav Attack both kings are attacked: White pushes h4-h5, Black uses the c-file. Pure race!', 'g7 वाला bishop लंबे diagonal पर आग उगलता है। Yugoslav Attack में दोनों kings पर attack होता है: White h4-h5 धकेलता है, Black c-file use करता है। सीधी race!', 'g7 वरचा bishop लांब diagonal वर आग ओकतो. Yugoslav Attack मध्ये दोन्ही kings वर attack होतो: White h4-h5 ढकलतो, Black c-file वापरतो. सरळ race!'),
  },
  {
    id: 'taimanov', name: 'Sicilian: Taimanov Variation', eco: 'B48', side: 'black', level: 'intermediate', section: 'Sicilian Defence',
    line: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Qd2 Nf6 O-O-O',
    idea: I('A flexible Sicilian: ...e6, ...Nc6 and ...Qc7 keep many plans open, with the queen watching e5 and the c-file.', 'एक flexible Sicilian: ...e6, ...Nc6 और ...Qc7 कई plans खुले रखते हैं, queen e5 और c-file पर नज़र रखती है।', 'एक flexible Sicilian: ...e6, ...Nc6 आणि ...Qc7 अनेक plans उघडे ठेवतात, queen e5 आणि c-file वर लक्ष ठेवते.'),
  },
  {
    id: 'sveshnikov', name: 'Sicilian: Sveshnikov Variation', eco: 'B33', side: 'black', level: 'advanced', section: 'Sicilian Defence',
    line: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5',
    idea: I('Black accepts a hole on d5 and a backward d-pawn in exchange for activity and space. Dynamic and deeply studied, a favourite of Carlsen.', 'Black d5 पर hole और पीछे छूटा d-pawn स्वीकार करता है, बदले में activity और space। Dynamic और गहराई से पढ़ी गई, Carlsen की पसंदीदा।', 'Black d5 वर hole आणि मागे राहिलेला d-pawn स्वीकारतो, त्याबदल्यात activity आणि space. Dynamic आणि खोलवर अभ्यासलेली, Carlsen ची आवडती.'),
  },
  {
    id: 'alapin', name: 'Sicilian: Alapin Variation', eco: 'B22', side: 'white', level: 'intermediate', section: 'Sicilian Defence',
    line: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 Bc4',
    idea: I('White avoids the main lines: c3 prepares d4 to build a big pawn centre. Simple ideas and a good weapon for club players.', 'White main lines से बचता है: c3 एक बड़ा pawn centre बनाने के लिए d4 की तैयारी करता है। सीधे ideas और club players के लिए अच्छा हथियार।', 'White main lines टाळतो: c3 मोठं pawn centre बनवायला d4 ची तयारी करतो. सोप्या ideas आणि club players साठी चांगलं हत्यार.'),
  },
  // Other answers to 1.e4
  {
    id: 'french', name: 'French Defence (Classical)', eco: 'C14', side: 'black', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O',
    idea: I('Black builds a strong wall with ...e6 and ...d5 and attacks White\'s centre later with ...c5 and ...f6. The light-squared bishop is the problem piece to solve.', 'Black ...e6 और ...d5 से मज़बूत दीवार बनाता है और बाद में ...c5 और ...f6 से White के centre पर attack करता है। Light-squared bishop वो piece है जिसकी problem solve करनी होती है।', 'Black ...e6 आणि ...d5 ने मजबूत भिंत बांधतो आणि नंतर ...c5 आणि ...f6 ने White च्या centre वर attack करतो. Light-squared bishop हा problem असलेला piece असतो.'),
  },
  {
    id: 'french-advance', name: 'French Defence: Advance Variation', eco: 'C02', side: 'white', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2',
    idea: I('White pushes e5 and grabs space. Black attacks the pawn chain at its base with ...c5 and ...Qb6. Remember: attack a pawn chain at its base!', 'White e5 धकेलकर space लेता है। Black ...c5 और ...Qb6 से pawn chain की जड़ पर attack करता है। याद रखो: pawn chain पर उसकी जड़ से attack करो!', 'White e5 ढकलून space घेतो. Black ...c5 आणि ...Qb6 ने pawn chain च्या मुळावर attack करतो. लक्षात ठेव: pawn chain वर तिच्या मुळापासून attack कर!'),
  },
  {
    id: 'winawer', name: 'French Defence: Winawer Variation', eco: 'C18', side: 'black', level: 'advanced', section: 'Other answers to 1.e4',
    line: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4',
    idea: I('Black pins the knight and gives up the bishop to double White\'s pawns. White gets the bishop pair and attacks g7 at once. Very sharp!', 'Black knight को pin करता है और White के pawns doubled करने के लिए bishop दे देता है। White को bishop pair मिलता है और वो तुरंत g7 पर attack करता है। बहुत sharp!', 'Black knight ला pin करतो आणि White चे pawns doubled करायला bishop देतो. White ला bishop pair मिळते आणि तो लगेच g7 वर attack करतो. खूप sharp!'),
  },
  {
    id: 'caro-kann', name: 'Caro-Kann Defence (Classical)', eco: 'B19', side: 'black', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3',
    idea: I('Black supports ...d5 with ...c6 and develops the light-squared bishop outside the pawn chain before playing ...e6. Rock-solid, a favourite of Karpov.', 'Black ...c6 से ...d5 को support करता है और ...e6 से पहले light-squared bishop को pawn chain के बाहर निकाल लेता है। चट्टान जैसा solid, Karpov की पसंद।', 'Black ...c6 ने ...d5 ला support करतो आणि ...e6 च्या आधी light-squared bishop ला pawn chain बाहेर काढतो. खडकासारखं solid, Karpov ची आवड.'),
  },
  {
    id: 'caro-advance', name: 'Caro-Kann: Advance Variation', eco: 'B12', side: 'black', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3',
    idea: I('White grabs space with e5. Black develops the bishop to f5 first, then strikes the centre with ...c5.', 'White e5 से space लेता है। Black पहले bishop को f5 पर लाता है, फिर ...c5 से centre पर वार करता है।', 'White e5 ने space घेतो. Black आधी bishop f5 वर आणतो, मग ...c5 ने centre वर वार करतो.'),
  },
  {
    id: 'scandinavian', name: 'Scandinavian Defence', eco: 'B01', side: 'black', level: 'beginner', section: 'Other answers to 1.e4',
    line: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
    idea: I('Black hits e4 at once. The queen comes out early but finds a safe square on a5, and the light-squared bishop develops to f5. Simple and direct.', 'Black तुरंत e4 पर वार करता है। Queen जल्दी बाहर आती है पर a5 पर safe जगह पाती है, और light-squared bishop f5 पर develop होता है। सीधा और आसान।', 'Black लगेच e4 वर वार करतो. Queen लवकर बाहेर येते पण a5 वर safe जागा मिळवते, आणि light-squared bishop f5 वर develop होतो. सोपं आणि थेट.'),
  },
  {
    id: 'pirc', name: 'Pirc Defence', eco: 'B07', side: 'black', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3',
    idea: I('A hypermodern defence: Black lets White build a centre, then attacks it with pieces and pawn breaks like ...e5 or ...b5.', 'Hypermodern defence: Black White को centre बनाने देता है, फिर pieces और ...e5 या ...b5 जैसे pawn breaks से उस पर attack करता है।', 'Hypermodern defence: Black White ला centre बनवू देतो, मग pieces आणि ...e5 किंवा ...b5 सारख्या pawn breaks ने त्यावर attack करतो.'),
  },
  {
    id: 'alekhine', name: "Alekhine's Defence", eco: 'B04', side: 'black', level: 'intermediate', section: 'Other answers to 1.e4',
    line: 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7',
    idea: I('Named after World Champion Alekhine: Black invites White\'s pawns forward, hoping they become targets.', 'World Champion Alekhine के नाम पर: Black White के pawns को आगे बुलाता है, इस उम्मीद में कि वे targets बन जाएँ।', 'World Champion Alekhine यांच्या नावाने: Black White च्या pawns ना पुढे बोलावतो, ते targets बनतील या आशेने.'),
  },
  // Queen's pawn openings
  {
    id: 'qgd', name: "Queen's Gambit Declined (Tartakower)", eco: 'D58', side: 'black', level: 'intermediate', section: "Queen's pawn openings",
    line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
    idea: I('Black keeps the d5 pawn firmly with ...e6 and develops calmly. ...b6 and ...Bb7 solve the problem of the light-squared bishop.', 'Black ...e6 से d5 pawn को मज़बूती से रखता है और आराम से develop करता है। ...b6 और ...Bb7 light-squared bishop की problem solve करते हैं।', 'Black ...e6 ने d5 pawn घट्ट ठेवतो आणि शांतपणे develop करतो. ...b6 आणि ...Bb7 light-squared bishop चा problem सोडवतात.'),
  },
  {
    id: 'qga', name: "Queen's Gambit Accepted", eco: 'D27', side: 'black', level: 'intermediate', section: "Queen's pawn openings",
    line: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
    idea: I('Black takes the c4 pawn but does not try to keep it. Instead Black develops quickly and hits the centre with ...c5.', 'Black c4 pawn ले लेता है पर उसे रखने की कोशिश नहीं करता। बल्कि जल्दी develop करता है और ...c5 से centre पर वार करता है।', 'Black c4 pawn घेतो पण तो टिकवायचा प्रयत्न करत नाही. उलट पटकन develop करतो आणि ...c5 ने centre वर वार करतो.'),
  },
  {
    id: 'slav', name: 'Slav Defence', eco: 'D17', side: 'black', level: 'intermediate', section: "Queen's pawn openings",
    line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O',
    idea: I('Black protects d5 with ...c6, keeping the c8-bishop free to come out to f5 or g4. Solid and popular at every level.', 'Black ...c6 से d5 protect करता है, जिससे c8 वाला bishop f5 या g4 पर निकल सके। Solid और हर level पर popular।', 'Black ...c6 ने d5 protect करतो, म्हणजे c8 वरचा bishop f5 किंवा g4 वर बाहेर येऊ शकतो. Solid आणि प्रत्येक level वर popular.'),
  },
  {
    id: 'semi-slav', name: 'Semi-Slav Defence (Meran)', eco: 'D47', side: 'black', level: 'advanced', section: "Queen's pawn openings",
    line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5',
    idea: I('Black combines ...c6 and ...e6, then takes on c4 and expands with ...b5, ...Bb7 and ...c5. Rich and sharp.', 'Black ...c6 और ...e6 को मिलाता है, फिर c4 पर capture करके ...b5, ...Bb7 और ...c5 से फैलता है। Rich और sharp।', 'Black ...c6 आणि ...e6 एकत्र करतो, मग c4 वर capture करून ...b5, ...Bb7 आणि ...c5 ने पसरतो. Rich आणि sharp.'),
  },
  {
    id: 'catalan', name: 'Catalan Opening', eco: 'E05', side: 'white', level: 'advanced', section: "Queen's pawn openings",
    line: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6',
    idea: I('Queen\'s Gambit plus a fianchetto: the bishop on g2 presses along the long diagonal toward b7 and the queenside. A favourite of Kramnik and Carlsen.', 'Queen\'s Gambit के साथ fianchetto: g2 वाला bishop लंबे diagonal पर b7 और queenside की तरफ़ pressure बनाता है। Kramnik और Carlsen की पसंद।', 'Queen\'s Gambit सोबत fianchetto: g2 वरचा bishop लांब diagonal वर b7 आणि queenside कडे pressure टाकतो. Kramnik आणि Carlsen ची आवड.'),
  },
  {
    id: 'london', name: 'London System', eco: 'D02', side: 'white', level: 'beginner', section: "Queen's pawn openings",
    line: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3',
    idea: I('A system you can play against almost anything: d4, Bf4, e3, Nf3, c3 and Nbd2. Solid structure and easy plans, very popular with club players.', 'एक system जो लगभग हर चीज़ के खिलाफ़ खेला जा सकता है: d4, Bf4, e3, Nf3, c3 और Nbd2। Solid structure और आसान plans, club players में बहुत popular।', 'जवळपास कोणत्याही विरुद्ध खेळता येणारी system: d4, Bf4, e3, Nf3, c3 आणि Nbd2. Solid structure आणि सोपे plans, club players मध्ये खूप popular.'),
  },
  {
    id: 'trompowsky', name: 'Trompowsky Attack', eco: 'A45', side: 'white', level: 'intermediate', section: "Queen's pawn openings",
    line: 'd4 Nf6 Bg5 e6 e4 h6 Bxf6 Qxf6 Nc3 d6',
    idea: I('White develops the bishop to g5 at once and is happy to trade it for the knight, building a big centre with e4.', 'White bishop को तुरंत g5 पर लाता है और उसे knight से trade करने को तैयार है, e4 से बड़ा centre बनाते हुए।', 'White bishop लगेच g5 वर आणतो आणि त्याला knight शी trade करायला तयार असतो, e4 ने मोठं centre बनवत.'),
  },
  // Indian defences
  {
    id: 'kings-indian', name: "King's Indian Defence", eco: 'E97', side: 'black', level: 'advanced', section: 'Indian defences',
    line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
    idea: I('Black lets White take the centre, then strikes back with ...e5. After d5, White attacks on the queenside and Black storms the kingside with ...f5. Fischer and Kasparov\'s weapon.', 'Black White को centre लेने देता है, फिर ...e5 से जवाबी वार करता है। d5 के बाद White queenside पर attack करता है और Black ...f5 से kingside पर हमला बोलता है। Fischer और Kasparov का हथियार।', 'Black White ला centre घेऊ देतो, मग ...e5 ने प्रतिवार करतो. d5 नंतर White queenside वर attack करतो आणि Black ...f5 ने kingside वर तुटून पडतो. Fischer आणि Kasparov चं हत्यार.'),
  },
  {
    id: 'nimzo-indian', name: 'Nimzo-Indian Defence', eco: 'E54', side: 'black', level: 'advanced', section: 'Indian defences',
    line: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O',
    idea: I('Named after Nimzowitsch: the bishop pins the c3 knight to stop e4. Black is ready to give the bishop for the knight to damage White\'s pawns.', 'Nimzowitsch के नाम पर: bishop c3 वाले knight को pin करता है ताकि e4 न हो सके। Black White के pawns बिगाड़ने के लिए bishop को knight से trade करने को तैयार है।', 'Nimzowitsch यांच्या नावाने: bishop c3 वरच्या knight ला pin करतो म्हणजे e4 होऊ नये. White चे pawns बिघडवायला Black bishop ला knight शी trade करायला तयार असतो.'),
  },
  {
    id: 'grunfeld', name: 'Grünfeld Defence', eco: 'D85', side: 'black', level: 'advanced', section: 'Indian defences',
    line: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Bc4 c5 Ne2',
    idea: I('Black gives White a big pawn centre on purpose, then attacks it with the g7-bishop, ...c5 and the pieces. A dynamic favourite of Kasparov.', 'Black जान-बूझकर White को बड़ा pawn centre देता है, फिर g7 bishop, ...c5 और pieces से उस पर attack करता है। Kasparov की dynamic पसंद।', 'Black मुद्दाम White ला मोठं pawn centre देतो, मग g7 bishop, ...c5 आणि pieces ने त्यावर attack करतो. Kasparov ची dynamic आवड.'),
  },
  {
    id: 'queens-indian', name: "Queen's Indian Defence", eco: 'E15', side: 'black', level: 'advanced', section: 'Indian defences',
    line: 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7',
    idea: I('Black controls the e4 square with the queen\'s bishop from the side. ...Ba6 attacks c4 to make White\'s development awkward.', 'Black queen-side bishop से बगल से e4 square को control करता है। ...Ba6 c4 पर attack करके White का development मुश्किल बनाता है।', 'Black queen-side bishop ने बाजूने e4 square control करतो. ...Ba6 c4 वर attack करून White चं development अवघड करतो.'),
  },
  {
    id: 'benoni', name: 'Modern Benoni', eco: 'A70', side: 'black', level: 'advanced', section: 'Indian defences',
    line: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O',
    idea: I('An unbalanced fight: White has a central majority and space, Black has a queenside majority and an active g7-bishop. Both sides race with their pawn majorities.', 'असंतुलित लड़ाई: White के पास centre में ज़्यादा pawns और space है, Black के पास queenside majority और active g7 bishop। दोनों अपनी pawn majorities के साथ race करते हैं।', 'असंतुलित लढाई: White कडे centre मध्ये जास्त pawns आणि space, Black कडे queenside majority आणि active g7 bishop. दोघंही आपल्या pawn majorities घेऊन race करतात.'),
  },
  {
    id: 'benko', name: 'Benko Gambit', eco: 'A59', side: 'black', level: 'intermediate', section: 'Indian defences',
    line: 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6 e4 Bxf1 Kxf1 g6',
    idea: I('Black gives a pawn for long-lasting pressure on the a- and b-files. Even in the endgame Black\'s rooks keep pushing.', 'Black a- और b-files पर लंबे pressure के लिए एक pawn देता है। Endgame में भी Black के rooks pressure बनाए रखते हैं।', 'Black a- आणि b-files वर लांबच्या pressure साठी एक pawn देतो. Endgame मध्ये पण Black चे rooks pressure टिकवून ठेवतात.'),
  },
  {
    id: 'dutch', name: 'Dutch Defence (Leningrad)', eco: 'A87', side: 'black', level: 'intermediate', section: 'Indian defences',
    line: 'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6',
    idea: I('Black controls e4 with the f-pawn and fianchettoes the bishop like a King\'s Indian. Fighting chess with kingside chances.', 'Black f-pawn से e4 को control करता है और King\'s Indian की तरह bishop का fianchetto करता है। Kingside chances वाली fighting chess।', 'Black f-pawn ने e4 control करतो आणि King\'s Indian सारखा bishop चा fianchetto करतो. Kingside chances असलेलं fighting chess.'),
  },
  // Flank openings
  {
    id: 'english', name: 'English Opening', eco: 'A29', side: 'white', level: 'intermediate', section: 'Flank openings',
    line: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2',
    idea: I('1.c4 controls d5 from the side. Here White plays a Sicilian with an extra move, using the g2-bishop against the centre.', '1.c4 बगल से d5 को control करता है। यहाँ White एक extra move के साथ Sicilian खेलता है, g2 bishop से centre पर pressure डालते हुए।', '1.c4 बाजूने d5 control करतो. इथे White एक extra move सोबत Sicilian खेळतो, g2 bishop ने centre वर pressure टाकत.'),
  },
  {
    id: 'reti', name: 'Réti Opening', eco: 'A13', side: 'white', level: 'intermediate', section: 'Flank openings',
    line: 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3',
    idea: I('A hypermodern opening by Richard Réti: White controls the centre from a distance with the knight, c4 and fianchettoed bishops.', 'Richard Réti की hypermodern opening: White knight, c4 और fianchetto वाले bishops से दूर से centre control करता है।', 'Richard Réti यांची hypermodern opening: White knight, c4 आणि fianchetto केलेल्या bishops ने लांबून centre control करतो.'),
  },
  {
    id: 'kings-indian-attack', name: "King's Indian Attack", eco: 'A07', side: 'white', level: 'beginner', section: 'Flank openings',
    line: 'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4 d3 Nbd7 Nbd2 e5 e4',
    idea: I('One easy setup for White: Nf3, g3, Bg2, castle, d3, Nbd2 and e4. Fischer used it to attack on the kingside.', 'White के लिए एक आसान setup: Nf3, g3, Bg2, castling, d3, Nbd2 और e4। Fischer ने इससे kingside पर attack किया।', 'White साठी एक सोपा setup: Nf3, g3, Bg2, castling, d3, Nbd2 आणि e4. Fischer ने यानेच kingside वर attack केला.'),
  },
  {
    id: 'bird', name: "Bird's Opening", eco: 'A03', side: 'white', level: 'beginner', section: 'Flank openings',
    line: 'f4 d5 Nf3 Nf6 e3 g6 b3 Bg7 Bb2',
    idea: I('1.f4 controls e5. White builds a Dutch-style setup with the bishop on b2 aiming at the black king.', '1.f4 e5 को control करता है। White Dutch जैसा setup बनाता है, b2 वाला bishop black king पर निशाना साधता है।', '1.f4 e5 control करतो. White Dutch सारखा setup बनवतो, b2 वरचा bishop black king वर नेम धरतो.'),
  },
];

const POPULAR_MIN = 50;

/** Slides for a course: the idea, then each move with its reasons and statistics, then practice. */
export async function buildCourse(c: OpeningCourse, book: CloudBook = new CloudBook()): Promise<Lesson> {
  const sans = c.line.split(' ');
  const slides: Slide[] = [];
  const intro: L10n = {
    en: `${c.name} (${c.eco}). You play ${c.side === 'white' ? 'White' : 'Black'}. ${c.idea.en}`,
    hi: `${c.name} (${c.eco})। तुम ${c.side === 'white' ? 'White' : 'Black'} से खेलोगे। ${c.idea.hi}`,
    mr: `${c.name} (${c.eco}). तू ${c.side === 'white' ? 'White' : 'Black'} ने खेळशील. ${c.idea.mr}`,
  };
  slides.push({ fen: START_FEN, text: intro, orientation: c.side, practice: false });

  let pos = positionFromFen(START_FEN);
  // Statistics for every position on the line, fetched together.
  const positions = [pos.clone()];
  for (const san of sans) {
    const m = parseSan(pos, san) as NormalMove;
    pos.play(m);
    positions.push(pos.clone());
  }
  const entries = await Promise.all(positions.slice(0, -1).map((p) => book.entries(p).catch(() => [])));
  pos = positionFromFen(START_FEN);
  sans.forEach((san, i) => {
    const before = positions[i];
    const m = parseSan(before, san) as NormalMove;
    const notes = openingNotes(before, m);
    const stats = movesInRange(entries[i], 2000);
    const total = stats.reduce((n, x) => n + x.games, 0);
    const mine = stats.find((x) => sanOf(before, x.move) === san);
    const text = (l: Lang) => {
      const parts = [moveSentence(before, m, l), ...notes.map((n) => noteText(n, l))];
      if (mine && total >= POPULAR_MIN) parts.push(noteText({ k: 'popular', pct: Math.round((100 * mine.games) / total), games: shortCount(total) }, l));
      return parts.join(' ');
    };
    slides.push({
      fen: fenOf(before),
      moves: [moveToUci(m)],
      text: { en: text('en'), hi: text('hi'), mr: text('mr') },
      orientation: c.side,
      practice: { fen: fenOf(positions[i + 1]), side: c.side },
    });
  });
  const end = fenOf(positions[positions.length - 1]);
  slides.push({
    fen: end,
    text: {
      en: `This is the main position of the ${c.name}. Now practise it against the engine: choose a strength and play on from here.`,
      hi: `यह ${c.name} की main position है। अब इसे engine के खिलाफ़ practice करो: strength चुनो और यहीं से खेलो।`,
      mr: `ही ${c.name} ची main position आहे. आता engine विरुद्ध practice कर: strength निवड आणि इथूनच खेळ.`,
    },
    orientation: c.side,
    practice: { fen: end, side: c.side },
  });
  return { id: c.id, category: 'opening', section: c.section, level: c.level, title: c.name, blurb: c.idea.en, slides };
}

export const OPENING_LESSONS: LessonEntry[] = COURSES.map((c) => ({
  id: c.id,
  category: 'opening',
  section: c.section,
  level: c.level,
  title: c.name,
  blurb: c.idea.en,
  load: () => buildCourse(c),
}));

/** One entry of the opening library (static/data/openings.json): [eco, name, SAN line]. */
export type LibraryRow = [string, string, string];

let library: Promise<LibraryRow[]> | undefined;
export function loadLibrary(fetchFn: typeof fetch = fetch): Promise<LibraryRow[]> {
  library ??= fetchFn('/data/openings.json').then((r) => r.json());
  return library;
}

/** A course for any named opening: its line, extended with strong players' main moves to 12 moves. */
export async function libraryCourse(index: number, book: CloudBook = new CloudBook()): Promise<Lesson> {
  const rows = await loadLibrary();
  const [eco, name, line] = rows[index];
  const sans = line.split(' ');
  // Whoever made the defining last move is the side the opening belongs to.
  const side: 'white' | 'black' = sans.length % 2 === 1 ? 'white' : 'black';
  const pos = playSans(line);
  while (sans.length < 12) {
    const top = movesInRange(await book.entries(pos).catch(() => []), 2000)[0];
    if (!top || !pos.isLegal(top.move) || top.games < POPULAR_MIN) break;
    sans.push(sanOf(pos, top.move));
    pos.play(top.move);
  }
  const generic: L10n = {
    en: `This is the ${name}. Watch the main moves strong players play here, and why.`,
    hi: `यह ${name} है। देखो strong players यहाँ कौन सी main moves खेलते हैं, और क्यों।`,
    mr: `ही ${name} आहे. बघ strong players इथे कोणत्या main moves खेळतात, आणि का.`,
  };
  const lesson = await buildCourse({ id: `lib-${index}`, name, eco, side, level: 'intermediate', section: 'Opening library', line: sans.join(' '), idea: generic }, book);
  return lesson;
}
