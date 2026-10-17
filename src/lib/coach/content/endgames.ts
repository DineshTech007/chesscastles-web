import type { L10n } from '../i18n';
import type { Lesson, LessonEntry, Level, Slide } from '../types';
import EG from '../data/endgames.json';
import TB from '../data/endgames-advanced.json';

/**
 * Endgame lessons. Every position and demonstration line was checked with
 * Stockfish (scripts/endgame-lines.mjs) or, for the advanced ones, against the
 * tablebase's perfect play (scripts/tablebase-lines.mjs): the wins really win,
 * the draws really hold.
 */
const D = { ...EG, ...TB } as Record<string, { fen: string; line: string[] }>;

interface Def {
  id: string;
  section: string;
  level: Level;
  title: string;
  blurb: string;
  slides: (Omit<Slide, 'fen' | 'moves'> & { pos: string; to?: number })[];
}

/** A slide on one of the checked positions, playing out the first `to` moves of its line. */
function slide(s: Def['slides'][number]): Slide {
  const p = D[s.pos];
  const { pos: _pos, to = 0, ...rest } = s;
  void _pos;
  return { fen: p.fen, moves: to > 0 ? p.line.slice(0, to) : undefined, ...rest };
}

const T = (en: string, hi: string, mr: string): L10n => ({ en, hi, mr });

const DEFS: Def[] = [
  {
    id: 'queen-mate',
    section: 'Basic checkmates',
    level: 'beginner',
    title: 'Checkmate with king and queen',
    blurb: 'The box method: shrink the king\'s space, bring your king, finish without stalemate.',
    slides: [
      {
        pos: 'queen-mate',
        text: T(
          'King and queen against a lonely king is always a win. The plan has three parts: the queen builds a box around the enemy king, the box gets smaller, and your king walks up to help.',
          'King और queen बनाम अकेला king हमेशा जीत है। Plan के तीन हिस्से हैं: queen दुश्मन king के चारों ओर एक box बनाती है, box छोटा होता जाता है, और तुम्हारा king मदद के लिए पास आता है।',
          'King आणि queen विरुद्ध एकटा king नेहमी जिंकतो. Plan चे तीन भाग: queen समोरच्या king भोवती एक box बनवते, box लहान होत जातो, आणि तुझा king मदतीला जवळ येतो.',
        ),
        practice: false,
      },
      {
        pos: 'queen-mate',
        to: 8,
        text: T(
          'Watch the queen: she stays a knight\'s jump away from the king, never giving it room. The black king is pushed to the edge.',
          'Queen को देखो: वो king से एक knight की jump जितनी दूरी पर रहती है और उसे जगह नहीं देती। Black king किनारे की तरफ़ धकेला जाता है।',
          'Queen कडे बघ: ती king पासून एका knight च्या उडीइतक्या अंतरावर राहते आणि त्याला जागा देत नाही. Black king कडेला ढकलला जातो.',
        ),
      },
      {
        pos: 'queen-mate',
        to: 99,
        text: T(
          'Now the king comes close to protect the queen, and the queen gives checkmate on the edge. Careful: always leave the enemy king one square until the final move, or it is stalemate, a draw!',
          'अब king queen को protect करने पास आता है, और queen किनारे पर checkmate देती है। ध्यान रखो: आखिरी move तक दुश्मन king को हमेशा एक square छोड़ो, वरना stalemate यानी draw हो जाएगा!',
          'आता king queen ला protect करायला जवळ येतो, आणि queen कडेवर checkmate देते. लक्ष ठेव: शेवटच्या move पर्यंत समोरच्या king ला नेहमी एक square सोड, नाहीतर stalemate म्हणजे draw होईल!',
        ),
        practice: { fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'rook-mate',
    section: 'Basic checkmates',
    level: 'beginner',
    title: 'Checkmate with king and rook',
    blurb: 'The rook cuts the board, the kings face each other, and the rook checks.',
    slides: [
      {
        pos: 'rook-mate',
        text: T(
          'King and rook against king is also always a win, but it takes teamwork. The rook cuts the enemy king off on one side of a line. Your king walks toward it. When the kings face each other, a check from the rook pushes the king back one row.',
          'King और rook बनाम king भी हमेशा जीत है, पर इसमें teamwork चाहिए। Rook एक line से दुश्मन king को एक तरफ़ रोक देता है। तुम्हारा king उसकी तरफ़ चलता है। जब दोनों kings आमने-सामने हों, तो rook का check king को एक row पीछे धकेल देता है।',
          'King आणि rook विरुद्ध king पण नेहमी जिंकतो, पण यात teamwork लागतं. Rook एका line ने समोरच्या king ला एका बाजूला अडवतो. तुझा king त्याच्याकडे चालतो. दोन्ही kings समोरासमोर आले की rook चा check king ला एक row मागे ढकलतो.',
        ),
        practice: false,
      },
      {
        pos: 'rook-mate',
        to: 16,
        text: T(
          'See how the rook keeps its wall while the white king marches up. The black king loses one row at a time.',
          'देखो rook अपनी दीवार बनाए रखता है जबकि white king आगे बढ़ता है। Black king एक-एक row खोता जाता है।',
          'बघ rook आपली भिंत टिकवून ठेवतो आणि white king पुढे सरकतो. Black king एक-एक row गमावत जातो.',
        ),
      },
      {
        pos: 'rook-mate',
        to: 99,
        text: T(
          'On the edge, the kings face each other and the rook gives checkmate along the last row.',
          'किनारे पर दोनों kings आमने-सामने आते हैं और rook आखिरी row पर checkmate देता है।',
          'कडेवर दोन्ही kings समोरासमोर येतात आणि rook शेवटच्या row वर checkmate देतो.',
        ),
        practice: { fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'rook-ladder',
    section: 'Basic checkmates',
    level: 'beginner',
    title: 'The two-rook ladder',
    blurb: 'Two rooks climb like a ladder and mate without the king\'s help.',
    slides: [
      {
        pos: 'rook-ladder',
        text: T(
          'Two rooks are so strong that they do not need their king. One rook builds a wall, the other gives check, then they take turns, like climbing a ladder, until the king falls off the edge of the board.',
          'दो rooks इतने ताकतवर हैं कि उन्हें अपने king की ज़रूरत नहीं। एक rook दीवार बनाता है, दूसरा check देता है, फिर वे बारी-बारी से, सीढ़ी चढ़ने की तरह, आगे बढ़ते हैं जब तक king board के किनारे से गिर न जाए।',
          'दोन rooks इतके strong असतात की त्यांना त्यांच्या king ची गरज नसते. एक rook भिंत बांधतो, दुसरा check देतो, मग ते आळीपाळीने, शिडी चढल्यासारखे, पुढे जातात, king board च्या कडेवरून पडेपर्यंत.',
        ),
        practice: false,
      },
      {
        pos: 'rook-ladder',
        to: 99,
        text: T(
          'Watch the ladder: check, wall, check, wall. If the king comes close to a rook, move that rook far away along the same row and keep climbing.',
          'सीढ़ी देखो: check, दीवार, check, दीवार। अगर king किसी rook के पास आए, तो उस rook को उसी row में दूर ले जाओ और चढ़ते रहो।',
          'शिडी बघ: check, भिंत, check, भिंत. King एखाद्या rook जवळ आला तर तो rook त्याच row वर लांब ने आणि चढत राहा.',
        ),
        practice: { fen: '8/8/3k4/8/8/8/8/R3K2R w - - 0 1', side: 'white' },
      },
      {
        pos: 'ladder-final',
        to: 1,
        text: T(
          'The final picture: the rook on the 7th rank is the wall, the other rook checks on the 8th. Checkmate!',
          'आखिरी तस्वीर: 7th rank वाला rook दीवार है, दूसरा rook 8th rank पर check देता है। Checkmate!',
          'शेवटचं चित्र: 7th rank वरचा rook भिंत आहे, दुसरा rook 8th rank वर check देतो. Checkmate!',
        ),
        practice: false,
      },
    ],
  },
  {
    id: 'king-pawn',
    section: 'Pawn endgames',
    level: 'beginner',
    title: 'King leads the pawn',
    blurb: 'Walk your pawn to the last rank with the king in front as a bodyguard.',
    slides: [
      {
        pos: 'king-in-front',
        text: T(
          'A pawn alone cannot reach the last rank: the enemy king would eat it. So your king walks in front of the pawn, like a bodyguard, and pushes the enemy king away. With your king on the 6th rank in front of the pawn, you always win.',
          'अकेला pawn आखिरी rank तक नहीं पहुँच सकता: दुश्मन king उसे खा जाएगा। इसलिए तुम्हारा king bodyguard की तरह pawn के आगे चलता है और दुश्मन king को दूर धकेलता है। अगर तुम्हारा king pawn के आगे 6th rank पर है, तो जीत पक्की है।',
          'एकटा pawn शेवटच्या rank पर्यंत पोहोचू शकत नाही: समोरचा king त्याला खाऊन टाकेल. म्हणून तुझा king bodyguard सारखा pawn च्या पुढे चालतो आणि समोरच्या king ला दूर ढकलतो. तुझा king pawn च्या पुढे 6th rank वर असला की जिंकणं पक्कं.',
        ),
        practice: false,
      },
      {
        pos: 'king-in-front',
        to: 99,
        text: T(
          'Watch the white king clear the way. The pawn walks up behind it and becomes a queen.',
          'देखो white king कैसे रास्ता साफ़ करता है। Pawn उसके पीछे-पीछे चलकर queen बन जाता है।',
          'बघ white king कसा रस्ता मोकळा करतो. Pawn त्याच्या मागोमाग चालत queen बनतो.',
        ),
        practice: { fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'opposition',
    section: 'Pawn endgames',
    level: 'intermediate',
    title: 'The opposition',
    blurb: 'When kings face each other, the side NOT to move wins the battle.',
    slides: [
      {
        pos: 'opposition-draw',
        marks: ['e4', 'e6'],
        text: T(
          'The kings face each other with one square between them. This is called the opposition. The king that must move has to give way. Here White must move, so White cannot get past: it is a draw.',
          'दोनों kings एक square छोड़कर आमने-सामने हैं। इसे opposition कहते हैं। जिस king को move करनी है, उसे रास्ता देना पड़ता है। यहाँ White को move करनी है, इसलिए White आगे नहीं जा सकता: draw है।',
          'दोन्ही kings एक square सोडून समोरासमोर आहेत. याला opposition म्हणतात. ज्या king ला move करायची असते त्याला बाजूला व्हावं लागतं. इथे White ला move करायची आहे, म्हणून White पुढे जाऊ शकत नाही: draw आहे.',
        ),
        practice: { side: 'white' },
      },
      {
        pos: 'opposition-draw',
        to: 99,
        text: T(
          'Watch: Black keeps facing the white king every time, and the pawn never gets through.',
          'देखो: Black हर बार white king के सामने आ जाता है, और pawn कभी आगे नहीं जा पाता।',
          'बघ: Black प्रत्येक वेळी white king च्या समोर येतो, आणि pawn कधीच पुढे जाऊ शकत नाही.',
        ),
        practice: false,
      },
      {
        pos: 'opposition-win',
        marks: ['e4', 'e6'],
        to: 99,
        text: T(
          'Same position, but now Black must move. Black has to give way, the white king walks forward, and the pawn queens. Taking the opposition decides most king and pawn endgames!',
          'वही position, पर अब Black को move करनी है। Black को रास्ता देना पड़ता है, white king आगे बढ़ता है, और pawn queen बनता है। ज़्यादातर king और pawn endgames का फ़ैसला opposition लेने से होता है!',
          'तीच position, पण आता Black ला move करायची आहे. Black ला बाजूला व्हावं लागतं, white king पुढे जातो, आणि pawn queen बनतो. बहुतेक king आणि pawn endgames चा निकाल opposition घेण्यावर ठरतो!',
        ),
        practice: { fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'square-rule',
    section: 'Pawn endgames',
    level: 'beginner',
    title: 'The rule of the square',
    blurb: 'Can the king catch the pawn? Draw a square and you know at once.',
    slides: [
      {
        pos: 'square-inside',
        marks: ['a5', 'a1', 'e1', 'e5', 'd2'],
        text: T(
          'To know if a king can catch a running pawn, imagine a square from the pawn to the last rank. Here it is a5, a1, e1, e5. If the king can step inside this square, it catches the pawn. The white king on d2 is inside.',
          'King भागते pawn को पकड़ पाएगा या नहीं, यह जानने के लिए pawn से आखिरी rank तक एक square सोचो। यहाँ वो a5, a1, e1, e5 है। अगर king इस square में आ सकता है, तो वो pawn पकड़ लेगा। d2 वाला white king अंदर है।',
          'King पळणाऱ्या pawn ला पकडू शकेल का हे कळायला pawn पासून शेवटच्या rank पर्यंत एक square डोळ्यासमोर आण. इथे तो a5, a1, e1, e5 आहे. King या square मध्ये येऊ शकला तर तो pawn पकडतो. d2 वरचा white king आत आहे.',
        ),
        practice: false,
      },
      {
        pos: 'square-inside',
        to: 99,
        text: T('The king steps toward the corner and catches the pawn. Draw.', 'King कोने की तरफ़ बढ़ता है और pawn को पकड़ लेता है। Draw।', 'King कोपऱ्याकडे जातो आणि pawn पकडतो. Draw.'),
      },
      {
        pos: 'square-outside',
        to: 99,
        marks: ['g2'],
        text: T(
          'Now the white king on g2 is outside the square. However fast it runs, the pawn is quicker and becomes a queen.',
          'अब g2 वाला white king square के बाहर है। वो कितनी भी तेज़ी से भागे, pawn ज़्यादा तेज़ है और queen बन जाता है।',
          'आता g2 वरचा white king square च्या बाहेर आहे. तो कितीही वेगाने पळाला तरी pawn जास्त वेगवान आहे आणि queen बनतो.',
        ),
        practice: false,
      },
    ],
  },
  {
    id: 'outside-passer',
    section: 'Pawn endgames',
    level: 'intermediate',
    title: 'The outside passed pawn',
    blurb: 'A passed pawn far from the kings drags the enemy king away.',
    slides: [
      {
        pos: 'outside-passer',
        to: 99,
        text: T(
          'White has a passed pawn on the a-file, far away from the kings. The black king must run over to stop it, and meanwhile the white king eats the black pawns on the other side.',
          'White के पास a-file पर passed pawn है, kings से बहुत दूर। Black king को उसे रोकने के लिए भागना पड़ता है, और इतने में white king दूसरी तरफ़ के black pawns खा जाता है।',
          'White कडे a-file वर passed pawn आहे, kings पासून खूप लांब. Black king ला त्याला अडवायला पळावं लागतं, आणि तेवढ्यात white king दुसऱ्या बाजूचे black pawns खाऊन टाकतो.',
        ),
        practice: { fen: '8/5kpp/8/P7/8/8/5KPP/8 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'lucena',
    section: 'Rook endgames',
    level: 'intermediate',
    title: 'The Lucena position: building a bridge',
    blurb: 'The most important winning technique in rook endgames.',
    slides: [
      {
        pos: 'lucena',
        text: T(
          'White\'s pawn is one step from queening, but the white king is stuck in front of it, and the black rook checks from the side. The winning idea is called building a bridge: the white rook will shield the king from the checks.',
          'White का pawn queen बनने से एक कदम दूर है, पर white king उसके आगे फँसा है, और black rook बगल से checks देता है। जीतने का idea "bridge बनाना" कहलाता है: white rook king को checks से बचाएगा।',
          'White चा pawn queen व्हायला एक पाऊल दूर आहे, पण white king त्याच्या पुढे अडकलाय, आणि black rook बाजूने checks देतो. जिंकण्याची idea म्हणजे "bridge बांधणं": white rook king ला checks पासून वाचवेल.',
        ),
        practice: false,
      },
      {
        pos: 'lucena',
        to: 99,
        text: T(
          'First the rook checks the black king away, then it goes to the 4th rank. When the checks come, the king walks down and the rook blocks: the bridge. The pawn queens.',
          'पहले rook check देकर black king को दूर करता है, फिर 4th rank पर जाता है। जब checks आते हैं, king नीचे आता है और rook बीच में आकर रोकता है: यही bridge है। Pawn queen बनता है।',
          'आधी rook check देऊन black king ला दूर करतो, मग 4th rank वर जातो. Checks आले की king खाली येतो आणि rook मध्ये येऊन अडवतो: हाच bridge. Pawn queen बनतो.',
        ),
        practice: { fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'philidor-position',
    section: 'Rook endgames',
    level: 'intermediate',
    title: 'The Philidor defence',
    blurb: 'How to hold a draw with rook against rook and pawn.',
    slides: [
      {
        pos: 'philidor',
        text: T(
          'Black is a pawn down but can draw. The rook stays on the 6th rank, stopping the white king from coming forward. Only when the pawn moves to the 6th does the rook go to the back and give checks from behind.',
          'Black एक pawn कम है पर draw कर सकता है। Rook 6th rank पर रहता है और white king को आगे आने से रोकता है। जब pawn 6th rank पर आ जाए, तभी rook पीछे जाकर पीछे से checks देता है।',
          'Black एक pawn कमी आहे पण draw करू शकतो. Rook 6th rank वर राहतो आणि white king ला पुढे येऊ देत नाही. Pawn 6th rank वर आला कीच rook मागे जाऊन मागून checks देतो.',
        ),
        practice: false,
      },
      {
        pos: 'philidor',
        to: 99,
        text: T(
          'Watch Black keep the rook on the 6th rank, then switch to checks from behind. White can never escape the checks: draw.',
          'देखो Black rook को 6th rank पर रखता है, फिर पीछे से checks पर जाता है। White checks से कभी बच नहीं पाता: draw।',
          'बघ Black rook ला 6th rank वर ठेवतो, मग मागून checks वर जातो. White checks मधून कधीच सुटू शकत नाही: draw.',
        ),
        practice: { fen: '4k3/8/r7/4PK2/8/8/8/1R6 b - - 0 1', side: 'black' },
      },
    ],
  },
  {
    id: 'rook-behind',
    section: 'Rook endgames',
    level: 'intermediate',
    title: 'Rooks belong behind passed pawns',
    blurb: 'The rule of Tarrasch: your rook is strongest behind the passed pawn.',
    slides: [
      {
        pos: 'rook-behind',
        to: 99,
        text: T(
          'White\'s rook stands behind the passed a-pawn and pushes it forward; Black\'s rook stands in front and can only wait. As the pawn advances, the white rook gets stronger and the black rook more passive.',
          'White का rook passed a-pawn के पीछे है और उसे आगे धकेलता है; Black का rook उसके आगे है और बस इंतज़ार कर सकता है। Pawn जैसे-जैसे आगे बढ़ता है, white rook और ताकतवर और black rook और बेबस होता जाता है।',
          'White चा rook passed a-pawn च्या मागे आहे आणि त्याला पुढे ढकलतो; Black चा rook त्याच्या पुढे आहे आणि फक्त थांबून राहू शकतो. Pawn जसजसा पुढे जातो, white rook जास्त strong आणि black rook जास्त अडकलेला होतो.',
        ),
        practice: { fen: 'r7/5pk1/6p1/P7/8/6P1/5PK1/R7 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'queen-vs-pawn',
    section: 'Advanced endgames',
    level: 'advanced',
    title: 'Queen against a pawn on the 7th',
    blurb: 'Check, come closer, check again: stop the pawn and win.',
    slides: [
      {
        pos: 'queen-vs-pawn',
        to: 99,
        text: T(
          'The black pawn is about to queen. The white queen checks and comes closer each time, until it stands in front of the pawn and forces the black king to block it. Then the white king gets a free move to come closer. Repeat, and White wins.',
          'Black pawn queen बनने वाला है। White queen check देती है और हर बार पास आती है, जब तक वो pawn के आगे न आ जाए और black king को pawn के आगे आने पर मजबूर न कर दे। तब white king को पास आने की एक free move मिलती है। यही दोहराओ, और White जीतता है।',
          'Black pawn queen व्हायच्या बेतात आहे. White queen check देते आणि प्रत्येक वेळी जवळ येते, pawn च्या पुढे येईपर्यंत आणि black king ला pawn च्या पुढे यायला भाग पाडेपर्यंत. मग white king ला जवळ यायला एक free move मिळते. हेच पुन्हा पुन्हा कर, आणि White जिंकतो.',
        ),
        practice: { fen: '6K1/8/8/8/8/2k5/3p4/7Q w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'bishop-knight-mate',
    section: 'Advanced endgames',
    level: 'advanced',
    title: 'Bishop and knight mate',
    blurb: 'The hardest basic mate: drive the king to the bishop\'s corner.',
    slides: [
      {
        pos: 'bishop-knight',
        text: T(
          'King, bishop and knight can mate, but only in a corner of the same colour as the bishop. Here the bishop is on dark squares, so the mate happens in a1 or h8. Push the king to the edge, then walk it along the edge to the right corner with your knight. It can take 30 moves: a real test!',
          'King, bishop और knight mate कर सकते हैं, पर सिर्फ़ bishop के रंग वाले corner में। यहाँ bishop dark squares पर है, इसलिए mate a1 या h8 में होगा। King को किनारे पर धकेलो, फिर knight की मदद से किनारे-किनारे सही corner तक ले जाओ। इसमें 30 moves तक लग सकती हैं: असली test!',
          'King, bishop आणि knight mate करू शकतात, पण फक्त bishop च्या रंगाच्या corner मध्ये. इथे bishop dark squares वर आहे, म्हणून mate a1 किंवा h8 मध्ये होईल. King ला कडेला ढकल, मग knight च्या मदतीने कडेकडेने बरोबर corner पर्यंत ने. याला 30 moves पर्यंत लागू शकतात: खरी परीक्षा!',
        ),
        practice: { fen: '8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'key-squares',
    section: 'Pawn endgames',
    level: 'intermediate',
    title: 'Key squares',
    blurb: 'Reach the magic squares in front of your pawn and the win is certain.',
    slides: [
      {
        pos: 'key-squares',
        marks: ['d4', 'e4', 'f4'],
        text: T(
          'Every pawn has key squares: if your king reaches one of them, the pawn queens whatever the opponent does. For a pawn on its 2nd, 3rd or 4th rank, the key squares are the three squares two ranks in front of it. For this e2 pawn they are d4, e4 and f4.',
          'हर pawn के key squares होते हैं: अगर तुम्हारा king उनमें से किसी पर पहुँच जाए, तो सामने वाला कुछ भी करे, pawn queen बनेगा। 2nd, 3rd या 4th rank वाले pawn के लिए key squares उसके दो rank आगे वाले तीन squares हैं। इस e2 pawn के लिए वो d4, e4 और f4 हैं।',
          'प्रत्येक pawn चे key squares असतात: तुझा king त्यापैकी एकावर पोहोचला तर समोरच्याने काहीही केलं तरी pawn queen होतो. 2nd, 3rd किंवा 4th rank वरच्या pawn साठी key squares म्हणजे त्याच्या दोन rank पुढचे तीन squares. या e2 pawn साठी ते d4, e4 आणि f4 आहेत.',
        ),
        practice: false,
      },
      {
        pos: 'key-squares',
        to: 99,
        text: T(
          'Watch: the white king does not push the pawn early. It walks up first and fights for the key squares, keeping the pawn safely behind. The pawn moves only when the king leads the way.',
          'देखो: white king pawn को जल्दी नहीं धकेलता। वो पहले आगे चलकर key squares के लिए लड़ता है, और pawn को पीछे safe रखता है। Pawn तभी चलता है जब king रास्ता दिखाता है।',
          'बघ: white king pawn लवकर ढकलत नाही. तो आधी पुढे चालत जाऊन key squares साठी लढतो, आणि pawn मागे safe ठेवतो. King रस्ता दाखवतो तेव्हाच pawn चालतो.',
        ),
        practice: { fen: '8/8/8/2k5/8/8/4P3/4K3 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'reti-manoeuvre',
    section: 'Pawn endgames',
    level: 'advanced',
    title: 'The Réti manoeuvre',
    blurb: 'A famous study: the king chases two goals at once and saves a lost-looking game.',
    slides: [
      {
        pos: 'reti',
        text: T(
          "This is a famous study by Richard Réti from 1921. The white king seems far too slow to catch the black h-pawn, and White's own pawn on c6 looks lost. Yet White draws!",
          'यह Richard Réti की 1921 की एक मशहूर study है। White king black h-pawn को पकड़ने के लिए बहुत धीमा लगता है, और White का c6 वाला pawn भी गया हुआ लगता है। फिर भी White draw करता है!',
          'ही Richard Réti यांची 1921 ची एक प्रसिद्ध study आहे. White king black h-pawn पकडायला खूपच हळू वाटतो, आणि White चा c6 वरचा pawn पण गेल्यासारखा वाटतो. तरीही White draw करतो!',
        ),
        practice: false,
      },
      {
        pos: 'reti',
        to: 99,
        text: T(
          'The secret is the diagonal: a king walking diagonally moves toward two places at once. Each step brings it closer both to the h-pawn and to its own c-pawn. Black must spend time, and in the end both sides make a queen: draw.',
          'राज़ है diagonal: तिरछा चलता king एक साथ दो जगहों की तरफ़ बढ़ता है। हर कदम उसे h-pawn और अपने c-pawn दोनों के पास ले जाता है। Black को समय गँवाना पड़ता है, और आखिर में दोनों queen बनाते हैं: draw।',
          'रहस्य आहे diagonal: तिरका चालणारा king एकाच वेळी दोन ठिकाणांच्या दिशेने जातो. प्रत्येक पाऊल त्याला h-pawn आणि स्वतःच्या c-pawn दोघांच्या जवळ नेतं. Black ला वेळ घालवावा लागतो, आणि शेवटी दोघंही queen बनवतात: draw.',
        ),
        practice: { fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'rook-vs-pawn',
    section: 'Rook endgames',
    level: 'intermediate',
    title: 'Rook against pawn: count the moves',
    blurb: 'A rook usually beats a pawn, unless your king is too far away.',
    slides: [
      {
        pos: 'rook-vs-pawn',
        to: 99,
        text: T(
          'A rook is much stronger than a pawn, but here the white king on a4 is too far away to help. The pawn, supported by its king, is about to queen, and the best White can do is give the rook for it: a draw. In endgames like this, always count the moves your king needs.',
          'Rook pawn से कहीं ज़्यादा ताकतवर है, पर यहाँ a4 वाला white king मदद के लिए बहुत दूर है। अपने king के support वाला pawn queen बनने वाला है, और White सबसे अच्छा यही कर सकता है कि उसके बदले rook दे दे: draw। ऐसे endgames में हमेशा गिनो कि तुम्हारे king को कितनी moves चाहिए।',
          'Rook pawn पेक्षा खूप strong असतो, पण इथे a4 वरचा white king मदतीला खूप लांब आहे. आपल्या king च्या support वाला pawn queen व्हायच्या बेतात आहे, आणि White जास्तीत जास्त एवढंच करू शकतो की त्याच्या बदल्यात rook देणं: draw. अशा endgames मध्ये नेहमी मोज की तुझ्या king ला किती moves लागतील.',
        ),
        practice: { fen: '8/8/8/8/K7/8/2kp4/7R w - - 0 1', side: 'white' },
      },
    ],
  },
  {
    id: 'vancura',
    section: 'Rook endgames',
    level: 'advanced',
    title: 'The Vancura defence',
    blurb: 'Hold a rook and a-pawn endgame by attacking the pawn from the side.',
    slides: [
      {
        pos: 'vancura',
        to: 99,
        text: T(
          "White's rook stands in front of its a-pawn, the worst place for it. Black's rook attacks the pawn from the side, so the white rook must keep guarding it, and the black king stays safely near g7. White can never make progress: a draw. This defence was found by Josef Vancura in 1924.",
          'White का rook अपने a-pawn के आगे खड़ा है, जो उसकी सबसे खराब जगह है। Black का rook pawn पर बगल से attack करता है, इसलिए white rook को उसे बचाते रहना पड़ता है, और black king g7 के पास safe रहता है। White कभी आगे नहीं बढ़ पाता: draw। यह defence Josef Vancura ने 1924 में खोजा था।',
          'White चा rook आपल्या a-pawn च्या पुढे उभा आहे, ही त्याची सगळ्यात वाईट जागा. Black चा rook pawn वर बाजूने attack करतो, त्यामुळे white rook ला त्याचं रक्षण करत राहावं लागतं, आणि black king g7 जवळ safe राहतो. White कधीच पुढे जाऊ शकत नाही: draw. हा defence Josef Vancura यांनी 1924 मध्ये शोधला.',
        ),
        practice: { fen: 'R7/6k1/P4r2/8/8/8/6K1/8 w - - 0 1', side: 'black' },
      },
    ],
  },
  {
    id: 'wrong-bishop',
    section: 'Advanced endgames',
    level: 'intermediate',
    title: 'The wrong-coloured bishop',
    blurb: 'A bishop and a rook pawn cannot win if the bishop does not control the corner.',
    slides: [
      {
        pos: 'wrong-bishop',
        marks: ['h8'],
        to: 99,
        text: T(
          "White is a bishop and a pawn up, yet it is a draw! The pawn queens on h8, a dark square, but White's bishop moves on light squares and can never drive the black king out of the corner. This kind of unbreakable defence is called a fortress.",
          'White एक bishop और एक pawn ज़्यादा है, फिर भी draw है! Pawn h8 पर queen बनेगा, जो dark square है, पर White का bishop light squares पर चलता है और black king को corner से कभी नहीं निकाल सकता। ऐसे अटूट defence को fortress कहते हैं।',
          'White कडे एक bishop आणि एक pawn जास्त आहे, तरीही draw आहे! Pawn h8 वर queen होतो, जो dark square आहे, पण White चा bishop light squares वर चालतो आणि black king ला corner मधून कधीच हाकलू शकत नाही. अशा न तुटणाऱ्या defence ला fortress म्हणतात.',
        ),
        practice: { fen: '7k/8/8/6KP/8/8/2B5/8 w - - 0 1', side: 'black' },
      },
    ],
  },
  {
    id: 'opposite-bishops',
    section: 'Advanced endgames',
    level: 'advanced',
    title: 'Opposite-coloured bishops',
    blurb: 'Even two pawns up, a bishop endgame can be a draw.',
    slides: [
      {
        pos: 'opposite-bishops',
        to: 99,
        text: T(
          'White is two pawns up, but the bishops move on different colours. Black attacks the pawns with the king and bishop until they fall, and a lone bishop cannot win. Endgames with opposite-coloured bishops are often drawn even with extra pawns.',
          'White दो pawns ज़्यादा है, पर दोनों bishops अलग-अलग रंगों पर चलते हैं। Black king और bishop से pawns पर attack करता है जब तक वे गिर न जाएँ, और अकेला bishop जीत नहीं सकता। Opposite-coloured bishops वाले endgames extra pawns के बावजूद अक्सर draw होते हैं।',
          'White कडे दोन pawns जास्त आहेत, पण दोन्ही bishops वेगवेगळ्या रंगांवर चालतात. Black king आणि bishop ने pawns वर attack करतो, ते पडेपर्यंत, आणि एकटा bishop जिंकू शकत नाही. Opposite-coloured bishops असलेले endgames extra pawns असूनही बऱ्याचदा draw होतात.',
        ),
        practice: { fen: '8/8/5k2/2b5/2B2PP1/6K1/8/8 w - - 0 1', side: 'black' },
      },
    ],
  },
  {
    id: 'queen-vs-rook',
    section: 'Advanced endgames',
    level: 'advanced',
    title: 'Queen against rook',
    blurb: 'The queen wins, but only with precise technique.',
    slides: [
      {
        pos: 'queen-vs-rook',
        to: 99,
        text: T(
          'A queen beats a rook, but it is not easy. The white king and queen work together to push the black king and rook apart, using checks and zugzwang, until the rook can be won with a fork or the king is mated. Watch how patiently White improves the pieces.',
          'Queen rook को हरा देती है, पर यह आसान नहीं। White king और queen मिलकर checks और zugzwang से black king और rook को अलग करते हैं, जब तक fork से rook न जीत लिया जाए या king mate न हो जाए। देखो White कितने धैर्य से pieces बेहतर करता है।',
          'Queen rook ला हरवते, पण हे सोपं नाही. White king आणि queen मिळून checks आणि zugzwang ने black king आणि rook ला वेगळं करतात, fork ने rook जिंकेपर्यंत किंवा king mate होईपर्यंत. बघ White किती संयमाने pieces सुधारतो.',
        ),
        practice: { fen: '3k4/3r4/3K4/8/8/8/8/7Q w - - 0 1', side: 'white' },
      },
    ],
  },
];

export const ENDGAME_LESSONS: LessonEntry[] = DEFS.map((d) => ({
  id: d.id,
  category: 'endgame',
  section: d.section,
  level: d.level,
  title: d.title,
  blurb: d.blurb,
  load: async (): Promise<Lesson> => ({ id: d.id, category: 'endgame', section: d.section, level: d.level, title: d.title, blurb: d.blurb, slides: d.slides.map(slide) }),
}));
