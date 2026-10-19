import type { Lang } from '$lib/coach/i18n';
import { MORE_POSTS } from './more';

/**
 * The Chess Castles blog: stories and tips about chess, each in English, Hindi and Marathi (chess words stay
 * in English; Hindi and Marathi are everyday spoken language). English is the default. In a body, a line
 * starting with "## " is a heading and lines starting with "- " are a list. Only facts that can be checked
 * go in the stories (dates, scores, names); legends are called legends.
 */
export type L3<T = string> = Record<Lang, T>;

export type Tag = 'Improve' | 'Kids' | 'Story' | 'History' | 'India' | 'Parents';

export interface Post {
  slug: string;
  /** ISO date of publishing. */
  date: string;
  /** Minutes to read. */
  read: number;
  tag: Tag;
  /** A chess piece for the cover, and its colours. */
  piece: string;
  hue: number;
  title: L3;
  summary: L3;
  body: L3<string[]>;
}

export const TAG_NAME: Record<Tag, L3> = {
  Improve: { en: 'Improve', hi: 'Improve', mr: 'Improve' },
  Kids: { en: 'Kids’ improvement', hi: 'बच्चों का सुधार', mr: 'मुलांची प्रगती' },
  Story: { en: 'Story', hi: 'कहानी', mr: 'गोष्ट' },
  History: { en: 'History', hi: 'इतिहास', mr: 'इतिहास' },
  India: { en: 'India', hi: 'भारत', mr: 'भारत' },
  Parents: { en: 'Parents', hi: 'Parents', mr: 'पालक' },
};

const BASE_POSTS: Post[] = [
  {
    slug: 'stuck-at-the-same-rating',
    date: '2026-10-20',
    read: 3,
    tag: 'Improve',
    piece: '♛',
    hue: 38,
    title: { en: 'Stuck at the same rating? 7 ways to break through', hi: 'एक ही rating पर अटके हैं? आगे बढ़ने के 7 तरीके', mr: 'एकाच rating वर अडकलात? पुढे जाण्याचे 7 मार्ग' },
    summary: {
      en: 'Every player hits a wall. Here is what strong players do when the rating will not move.',
      hi: 'हर player की rating कभी रुक जाती है। जब rating आगे न बढ़े, तब strong players क्या करते हैं।',
      mr: 'प्रत्येक player ची rating कधी तरी थांबते. rating पुढे सरकत नसेल तेव्हा strong players काय करतात.',
    },
    body: {
      en: [
        'A flat rating does not mean you have stopped improving. Often it means the same habits are costing you the same points. Try these seven things.',
        '## Seven ways to break through',
        '- Review your losses, not your wins. Find the one mistake that decided each game, and look for patterns: hanging pieces, time trouble, or one opening that keeps going wrong.',
        '- Fix one weakness at a time. Chess Castles’ Game Insights lists what costs you most. Work on the first item for a whole week.',
        '- Solve puzzles every day, even for 15 minutes. Tactics decide most games below 2000.',
        '- Learn basic endgames. King and pawn endgames and rook endgames win many "equal" positions.',
        '- Play longer games. Rapid and classical games give you time to think, and you can review them.',
        '- Do not play ten games in a row when you are tired or upset. A loss streak is usually a sign to stop.',
        '- Sleep, take a walk, then come back. The brain sorts out chess patterns while you rest.',
        'Pick two of these for the next month. You will be surprised how fast a stuck rating starts to move.',
      ],
      hi: [
        'rating का रुक जाना यह नहीं बताता कि आपका सुधार रुक गया है। अक्सर इसका मतलब होता है कि वही आदतें बार-बार वही points कटवा रही हैं। ये सात चीज़ें आज़माइए।',
        '## आगे बढ़ने के सात तरीके',
        '- जीते हुए नहीं, हारे हुए games का review कीजिए। हर game में वह एक गलती ढूँढिए जिसने game तय किया, और pattern देखिए: मोहरे छूट जाना, time trouble, या कोई opening जो बार-बार बिगड़ती है।',
        '- एक बार में एक कमज़ोरी ठीक कीजिए। Chess Castles का Game Insights बताता है कि सबसे ज़्यादा नुक़सान किससे हो रहा है। पहली चीज़ पर पूरा हफ़्ता लगाइए।',
        '- रोज़ puzzles हल कीजिए, चाहे 15 minutes ही। 2000 से नीचे ज़्यादातर games tactics से तय होते हैं।',
        '- Basic endgames सीखिए। King-pawn और rook endgames कई "बराबर" positions जिता देते हैं।',
        '- लंबे games खेलिए। Rapid और classical में सोचने का समय मिलता है, और उनका review भी हो सकता है।',
        '- थके हुए या परेशान होने पर लगातार दस games मत खेलिए। लगातार हार रुक जाने का इशारा होती है।',
        '- सोइए, थोड़ा टहलिए, फिर लौटिए। आराम के दौरान दिमाग़ chess के patterns सुलझा लेता है।',
        'अगले महीने के लिए इनमें से दो चुन लीजिए। आप हैरान होंगे कि अटकी हुई rating कितनी जल्दी हिलने लगती है।',
      ],
      mr: [
        'rating थांबली म्हणजे तुमची सुधारणा थांबली असं नाही. बऱ्याचदा त्याचा अर्थ असा असतो की त्याच सवयी त्याच points ची हानी करत आहेत. या सात गोष्टी करून बघा.',
        '## पुढे जाण्याचे सात मार्ग',
        '- जिंकलेल्या नाही, हरलेल्या games चा review करा. प्रत्येक game मधली ती एक चूक शोधा जिने game ठरवली, आणि pattern बघा: मोहरे सुटणं, time trouble, किंवा एखादी opening जी वारंवार बिघडते.',
        '- एका वेळी एकच कमजोरी सुधारा. Chess Castles चं Game Insights सांगतं की सगळ्यात जास्त नुकसान कशाने होतंय. पहिल्या गोष्टीवर पूर्ण आठवडा द्या.',
        '- रोज puzzles सोडवा, अगदी 15 minutes का असेना. 2000 च्या खाली बहुतेक games tactics ठरवतात.',
        '- Basic endgames शिका. King-pawn आणि rook endgames अनेक "बरोबरीच्या" positions जिंकवून देतात.',
        '- मोठ्या games खेळा. Rapid आणि classical मध्ये विचार करायला वेळ मिळतो, आणि त्यांचा review करता येतो.',
        '- थकलेले किंवा चिडलेले असताना सलग दहा games खेळू नका. सलग हार म्हणजे थांबायचा इशारा असतो.',
        '- झोपा, थोडं चाला, मग परत या. विश्रांतीत मेंदू chess चे patterns नीट लावतो.',
        'पुढच्या महिन्यासाठी यातल्या दोन निवडा. अडकलेली rating किती लवकर हलायला लागते ते बघून तुम्हाला आश्चर्य वाटेल.',
      ],
    },
  },
  {
    slug: 'the-immortal-game',
    date: '2026-10-19',
    read: 2,
    tag: 'History',
    piece: '♗',
    hue: 280,
    title: { en: 'The Immortal Game: winning after giving away the queen and both rooks', hi: 'Immortal Game: रानी और दोनों rooks गँवाकर भी जीत', mr: 'Immortal Game: राणी आणि दोन्ही rooks देऊनही विजय' },
    summary: {
      en: 'In 1851, Adolf Anderssen gave up almost everything and still checkmated his opponent.',
      hi: '1851 में Adolf Anderssen ने लगभग सब कुछ कुर्बान कर दिया और फिर भी checkmate किया।',
      mr: '1851 मध्ये Adolf Anderssen ने जवळजवळ सगळं बळी दिलं आणि तरीही checkmate केला.',
    },
    body: {
      en: [
        'In London in 1851, during the world’s first international chess tournament, two players sat down for a friendly game: Adolf Anderssen of Germany, with White, and Lionel Kieseritzky of France.',
        'Anderssen attacked at once, sacrificing a pawn, then a bishop. Then he did something that looks crazy: he gave up both rooks, and then even his queen. By the end he had lost a bishop, two rooks and the queen.',
        '[board:r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23|The final position: White has given up a queen and two rooks, and Black is checkmated]',
        'But Kieseritzky’s king had nowhere to hide. Anderssen finished with a checkmate in which just a bishop and two knights did the work. The game is still called the Immortal Game.',
        '## What can we learn?',
        '- Pieces are tools, not treasures. If giving material wins the king, it is a good trade.',
        '- Before you sacrifice, count: how many moves until checkmate, and can the opponent escape?',
        '- Develop your pieces fast and attack the king: the attack in this game came from quick development.',
        'You can find the game in our database of 5.4 million games and step through it with the engine.',
      ],
      hi: [
        '1851 में London में, दुनिया के पहले international chess tournament के दौरान, दो players एक friendly game खेलने बैठे: Germany के Adolf Anderssen (White) और France के Lionel Kieseritzky।',
        'Anderssen ने तुरंत हमला किया, पहले एक pawn और फिर एक bishop कुर्बान किया। फिर उन्होंने ऐसा किया जो पागलपन लगता है: दोनों rooks दे दिए, और फिर रानी भी। आख़िर तक उन्होंने एक bishop, दो rooks और रानी गँवा दी थी।',
        '[board:r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23|आख़िरी position: White ने रानी और दो rooks दे दिए, और Black का checkmate हो गया]',
        'लेकिन Kieseritzky के king के पास छिपने की जगह नहीं थी। Anderssen ने सिर्फ़ एक bishop और दो knights के दम पर checkmate कर दिया। इस game को आज भी Immortal Game कहते हैं।',
        '## हम क्या सीख सकते हैं?',
        '- मोहरे औज़ार हैं, ख़ज़ाना नहीं। अगर मोहरे देकर king मिलता है, तो सौदा अच्छा है।',
        '- Sacrifice से पहले गिनिए: checkmate में कितनी moves लगेंगी, और क्या opponent बच सकता है?',
        '- मोहरे जल्दी develop कीजिए और king पर हमला कीजिए: इस game का हमला तेज़ development से आया था।',
        'यह game हमारे 5.4 million games के database में है, और आप इसे engine के साथ step-by-step देख सकते हैं।',
      ],
      mr: [
        '1851 मध्ये London मध्ये, जगातल्या पहिल्या international chess tournament दरम्यान, दोन players एक friendly game खेळायला बसले: Germany चे Adolf Anderssen (White) आणि France चे Lionel Kieseritzky.',
        'Anderssen ने लगेच हल्ला केला, आधी एक pawn आणि मग एक bishop बळी दिला. मग त्यांनी वेडेपणा वाटेल असं केलं: दोन्ही rooks दिले, आणि नंतर राणीसुद्धा. शेवटी त्यांनी एक bishop, दोन rooks आणि राणी गमावली होती.',
        '[board:r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23|शेवटची position: White ने राणी आणि दोन rooks दिले, आणि Black चा checkmate झाला]',
        'पण Kieseritzky च्या king ला लपायला जागा नव्हती. Anderssen ने फक्त एक bishop आणि दोन knights यांच्या जोरावर checkmate केला. या game ला आजही Immortal Game म्हणतात.',
        '## आपण काय शिकतो?',
        '- मोहरे हत्यारं आहेत, खजिना नाही. मोहरे देऊन king मिळत असेल तर सौदा चांगला आहे.',
        '- Sacrifice आधी मोजा: checkmate ला किती moves लागतील, आणि opponent सुटू शकतो का?',
        '- मोहरे लवकर develop करा आणि king वर हल्ला करा: या game चा हल्ला जलद development मधून आला होता.',
        'ही game आमच्या 5.4 million games च्या database मध्ये आहे, आणि तुम्ही ती engine सोबत step-by-step बघू शकता.',
      ],
    },
  },
  {
    slug: 'the-rice-and-the-chessboard',
    date: '2026-10-18',
    read: 2,
    tag: 'Story',
    piece: '♟',
    hue: 150,
    title: { en: 'The legend of the rice on the chessboard', hi: 'Chessboard पर चावल के दानों की कहानी', mr: 'Chessboard वरच्या तांदळाच्या दाण्यांची गोष्ट' },
    summary: {
      en: 'A famous legend about a clever inventor, a king and 64 squares, and a number too big to imagine.',
      hi: 'एक चतुर आविष्कारक, एक राजा और 64 खानों की मशहूर कहानी, और एक इतनी बड़ी संख्या जिसकी कल्पना मुश्किल है।',
      mr: 'एक हुशार संशोधक, एक राजा आणि 64 घरांची प्रसिद्ध गोष्ट, आणि कल्पनाही करता येणार नाही इतकी मोठी संख्या.',
    },
    body: {
      en: [
        'This is a legend, told for hundreds of years. A king loved the new game of chess so much that he asked its inventor what reward he wanted.',
        'The inventor smiled: "Place one grain of rice on the first square of the board, two on the second, four on the third, and keep doubling for all 64 squares."',
        'The king laughed. What a small prize! But his advisers started to count. By the 11th square it was 1,024 grains. By the 21st square, over a million. On the last square alone, there would be 9,223,372,036,854,775,808 grains.',
        '[rice]',
        'In all, the board needs 18,446,744,073,709,551,615 grains of rice, far more than all the rice ever grown on Earth. The legend says the king had to admit that the inventor was cleverer than him.',
        'It is a story about doubling, the same idea that makes a small habit, like ten minutes of puzzles a day, grow into something huge over a year.',
      ],
      hi: [
        'यह एक कहानी (legend) है जो सैकड़ों साल से सुनाई जाती है। एक राजा को chess का नया खेल इतना पसंद आया कि उसने उसके आविष्कारक से पूछा कि इनाम में क्या चाहिए।',
        'आविष्कारक मुस्कुराया: "board के पहले खाने पर चावल का एक दाना रखिए, दूसरे पर दो, तीसरे पर चार, और सभी 64 खानों तक दोगुना करते जाइए।"',
        'राजा हँस पड़ा। कितना छोटा इनाम! लेकिन उसके मंत्री गिनने लगे। 11वें खाने तक 1,024 दाने हो गए। 21वें तक दस लाख से ज़्यादा। आख़िरी खाने पर अकेले 9,223,372,036,854,775,808 दाने होते।',
        '[rice]',
        'कुल मिलाकर board को 18,446,744,073,709,551,615 दाने चाहिए, जो धरती पर आज तक उगे सारे चावल से कहीं ज़्यादा हैं। कहानी कहती है कि राजा को मानना पड़ा कि आविष्कारक उससे ज़्यादा चतुर था।',
        'यह दोगुना होने की कहानी है, वही बात जिससे रोज़ के दस minutes के puzzles जैसी छोटी आदत साल भर में बहुत बड़ी बन जाती है।',
      ],
      mr: [
        'ही एक गोष्ट (legend) आहे, जी शेकडो वर्षं सांगितली जाते. एका राजाला chess चा नवा खेळ इतका आवडला की त्याने त्याच्या संशोधकाला विचारलं, बक्षीस म्हणून काय हवं.',
        'संशोधक हसला: "board च्या पहिल्या घरावर तांदळाचा एक दाणा ठेवा, दुसऱ्यावर दोन, तिसऱ्यावर चार, आणि सगळ्या 64 घरांपर्यंत दुप्पट करत जा."',
        'राजा हसला. किती छोटं बक्षीस! पण त्याचे मंत्री मोजू लागले. 11 व्या घरापर्यंत 1,024 दाणे झाले. 21 व्या घरापर्यंत दहा लाखांहून जास्त. फक्त शेवटच्या घरावर 9,223,372,036,854,775,808 दाणे झाले असते.',
        '[rice]',
        'एकूण board ला 18,446,744,073,709,551,615 दाणे लागतात, जे पृथ्वीवर आजवर पिकलेल्या सगळ्या तांदळापेक्षा कितीतरी जास्त आहेत. गोष्ट सांगते की राजाला कबूल करावं लागलं की संशोधक त्याच्यापेक्षा हुशार होता.',
        'ही दुप्पट होण्याची गोष्ट आहे, तीच कल्पना जिच्यामुळे रोज दहा minutes च्या puzzles सारखी छोटी सवय वर्षभरात खूप मोठी होते.',
      ],
    },
  },
  {
    slug: 'chess-was-born-in-india',
    date: '2026-10-17',
    read: 2,
    tag: 'India',
    piece: '♞',
    hue: 24,
    title: { en: 'Chess was born in India: the story of chaturanga', hi: 'Chess का जन्म भारत में हुआ: चतुरंग की कहानी', mr: 'Chess चा जन्म भारतात झाला: चतुरंगाची गोष्ट' },
    summary: {
      en: 'Long before the computer, chess started as an Indian war game with four parts of an army.',
      hi: 'Computer से बहुत पहले chess भारत में एक युद्ध-खेल के रूप में शुरू हुआ, जिसमें सेना के चार अंग थे।',
      mr: 'Computer च्या खूप आधी chess भारतात एक युद्ध-खेळ म्हणून सुरू झाला, ज्यात सैन्याचे चार अंग होते.',
    },
    body: {
      en: [
        'Most historians agree that chess began in India around the 6th century, as a game called chaturanga. The word means "four limbs", the four parts of an ancient Indian army: infantry, cavalry, elephants and chariots.',
        'You can still see them on the board. The infantry became the pawns, the cavalry became the knight, the elephant became the bishop (in some languages the bishop is still called "elephant") and the chariot became the rook.',
        'From India the game travelled to Persia, where it was called shatranj, and then to the Arab world and Europe. On the way the pieces changed: the queen became the strongest piece only about 500 years ago.',
        'So when you play a game today, you are playing a very old Indian invention. It is no accident that India is again one of the strongest chess nations in the world.',
      ],
      hi: [
        'ज़्यादातर इतिहासकार मानते हैं कि chess लगभग छठी शताब्दी में भारत में चतुरंग नाम के खेल के रूप में शुरू हुआ। इस शब्द का मतलब है "चार अंग", यानी प्राचीन भारतीय सेना के चार हिस्से: पैदल सेना, घुड़सवार, हाथी और रथ।',
        'आप इन्हें आज भी board पर देख सकते हैं। पैदल सेना pawns बनी, घुड़सवार knight बना, हाथी bishop बना (कई भाषाओं में bishop को आज भी "हाथी" कहते हैं) और रथ rook बना।',
        'भारत से यह खेल Persia पहुँचा, जहाँ इसका नाम शतरंज (shatranj) पड़ा, और फिर अरब दुनिया और Europe तक गया। रास्ते में मोहरे बदले: रानी सबसे ताक़तवर मोहरा सिर्फ़ लगभग 500 साल पहले बनी।',
        'यानी आज जब आप game खेलते हैं, तो एक बहुत पुराना भारतीय आविष्कार खेल रहे होते हैं। यह संयोग नहीं कि भारत फिर से दुनिया के सबसे मज़बूत chess देशों में है।',
      ],
      mr: [
        'बहुतेक इतिहासकार मानतात की chess साधारण सहाव्या शतकात भारतात चतुरंग नावाचा खेळ म्हणून सुरू झाला. या शब्दाचा अर्थ "चार अंग", म्हणजे प्राचीन भारतीय सैन्याचे चार भाग: पायदळ, घोडदळ, हत्ती आणि रथ.',
        'ते आजही board वर दिसतात. पायदळ म्हणजे pawns, घोडदळ म्हणजे knight, हत्ती म्हणजे bishop (काही भाषांमध्ये bishop ला आजही "हत्ती" म्हणतात) आणि रथ म्हणजे rook.',
        'भारतातून हा खेळ Persia ला गेला, जिथे त्याचं नाव शतरंज (shatranj) पडलं, आणि मग अरब जग आणि Europe मध्ये गेला. वाटेत मोहरे बदलले: राणी सगळ्यात ताकदवान मोहरा फक्त सुमारे 500 वर्षांपूर्वी झाली.',
        'म्हणजे आज तुम्ही game खेळता तेव्हा एक खूप जुना भारतीय शोध खेळत असता. भारत पुन्हा जगातल्या सगळ्यात मजबूत chess देशांपैकी एक असणं हा योगायोग नाही.',
      ],
    },
  },
  {
    slug: 'viswanathan-anand-the-tiger-of-madras',
    date: '2026-10-16',
    read: 2,
    tag: 'India',
    piece: '♚',
    hue: 210,
    title: { en: 'Viswanathan Anand: the Tiger of Madras who made India a chess country', hi: 'Viswanathan Anand: वह "Tiger of Madras" जिसने भारत को chess का देश बनाया', mr: 'Viswanathan Anand: "Tiger of Madras" ज्याने भारताला chess चा देश बनवलं' },
    summary: {
      en: 'India’s first Grandmaster, and a World Champion whose success lit the path for a new generation.',
      hi: 'भारत के पहले Grandmaster, और ऐसे World Champion जिनकी सफलता ने नई पीढ़ी का रास्ता रोशन किया।',
      mr: 'भारताचे पहिले Grandmaster, आणि असे World Champion ज्यांच्या यशाने नव्या पिढीचा मार्ग उजळला.',
    },
    body: {
      en: [
        'Viswanathan Anand was born in Chennai in 1969 and learned chess from his mother as a child. He played very fast, so much that people called him the "Lightning Kid", and later the "Tiger of Madras".',
        'In 1988 he became India’s first Grandmaster. That was a big moment: before him, many Indians thought a world-level chess career was not possible from India.',
        'Anand won the FIDE World Championship in 2000, and became undisputed World Champion in 2007. He defended the title against Vladimir Kramnik in 2008, Veselin Topalov in 2010 and Boris Gelfand in 2012. In 2013 he lost the title to Magnus Carlsen in a match played in his home city, Chennai.',
        'His biggest gift may be the next generation. Today’s young Indian stars grew up watching him, and his academy in Chennai has helped many of them, including D Gukesh.',
        'The lesson for every young player: stay curious, keep a fast mind, and be gracious in both victory and defeat.',
      ],
      hi: [
        'Viswanathan Anand का जन्म 1969 में Chennai में हुआ और उन्होंने बचपन में माँ से chess सीखा। वे इतना तेज़ खेलते थे कि लोग उन्हें "Lightning Kid" कहते थे, और बाद में "Tiger of Madras"।',
        '1988 में वे भारत के पहले Grandmaster बने। यह बहुत बड़ा पल था: उनसे पहले कई भारतीय सोचते थे कि भारत से दुनिया-स्तर का chess career मुमकिन नहीं।',
        'Anand ने 2000 में FIDE World Championship जीती, और 2007 में undisputed World Champion बने। उन्होंने यह title 2008 में Vladimir Kramnik, 2010 में Veselin Topalov और 2012 में Boris Gelfand के ख़िलाफ़ बचाया। 2013 में अपने ही शहर Chennai में हुए match में वे Magnus Carlsen से title हार गए।',
        'उनकी सबसे बड़ी देन शायद अगली पीढ़ी है। आज के युवा भारतीय सितारे उन्हें देखकर बड़े हुए, और Chennai में उनकी academy ने इनमें से कई की मदद की, जिनमें D Gukesh भी हैं।',
        'हर युवा player के लिए सबक: जिज्ञासु रहिए, दिमाग़ तेज़ रखिए, और जीत और हार दोनों में विनम्र रहिए।',
      ],
      mr: [
        'Viswanathan Anand यांचा जन्म 1969 मध्ये Chennai मध्ये झाला आणि त्यांनी लहानपणी आईकडून chess शिकलं. ते इतकं वेगाने खेळायचे की लोक त्यांना "Lightning Kid" म्हणायचे, आणि पुढे "Tiger of Madras".',
        '1988 मध्ये ते भारताचे पहिले Grandmaster झाले. तो खूप मोठा क्षण होता: त्यांच्या आधी अनेक भारतीयांना वाटायचं की भारतातून जागतिक दर्जाची chess career शक्य नाही.',
        'Anand यांनी 2000 मध्ये FIDE World Championship जिंकली, आणि 2007 मध्ये undisputed World Champion झाले. त्यांनी हा title 2008 मध्ये Vladimir Kramnik, 2010 मध्ये Veselin Topalov आणि 2012 मध्ये Boris Gelfand विरुद्ध राखला. 2013 मध्ये त्यांच्याच शहरात Chennai मध्ये झालेल्या match मध्ये ते Magnus Carlsen कडून title हरले.',
        'त्यांची सगळ्यात मोठी देणगी कदाचित पुढची पिढी आहे. आजचे तरुण भारतीय तारे त्यांना बघत मोठे झाले, आणि Chennai मधल्या त्यांच्या academy ने यातल्या अनेकांना मदत केली, त्यात D Gukesh सुद्धा आहेत.',
        'प्रत्येक तरुण player साठी धडा: जिज्ञासू राहा, मन तल्लख ठेवा, आणि विजय आणि पराभव दोन्हीमध्ये नम्र राहा.',
      ],
    },
  },
  {
    slug: 'gukesh-youngest-world-champion',
    date: '2026-10-15',
    read: 2,
    tag: 'India',
    piece: '♔',
    hue: 45,
    title: { en: 'Gukesh: the youngest World Champion in history', hi: 'Gukesh: इतिहास के सबसे कम उम्र के World Champion', mr: 'Gukesh: इतिहासातले सगळ्यात तरुण World Champion' },
    summary: {
      en: 'At 18, a boy from Chennai beat the reigning champion and made chess history.',
      hi: '18 साल की उम्र में Chennai के एक लड़के ने मौजूदा champion को हराकर इतिहास रचा।',
      mr: 'वयाच्या 18 व्या वर्षी Chennai च्या एका मुलाने विद्यमान champion ला हरवून इतिहास घडवला.',
    },
    body: {
      en: [
        'Dommaraju Gukesh was born in Chennai in 2006. He started chess at seven, and at 12 years and 7 months he became a Grandmaster, one of the youngest ever.',
        'In 2024 he won the Candidates Tournament in Toronto at only 17, the youngest player ever to do so. That earned him the right to challenge the World Champion.',
        'In December 2024, in Singapore, he played China’s Ding Liren for the World Championship. After 14 games the score was level, but in the last game Gukesh won. He finished 7½–6½ and became the youngest undisputed World Champion in history, at 18.',
        'He later said he had dreamed of this moment since he was a small child. His story shows how steady daily work, good coaches and a family that believes in you can take you a very long way.',
        'Dream big, and then do the small work every day.',
      ],
      hi: [
        'Dommaraju Gukesh का जन्म 2006 में Chennai में हुआ। उन्होंने सात साल की उम्र में chess शुरू किया, और 12 साल 7 महीने की उम्र में Grandmaster बने, जो अब तक के सबसे कम उम्र के लोगों में से एक है।',
        '2024 में उन्होंने सिर्फ़ 17 साल की उम्र में Toronto का Candidates Tournament जीता, ऐसा करने वाले सबसे कम उम्र के player। इससे उन्हें World Champion को चुनौती देने का हक़ मिला।',
        'दिसंबर 2024 में Singapore में उन्होंने World Championship के लिए China के Ding Liren से खेला। 14 games के बाद score बराबर था, लेकिन आख़िरी game Gukesh ने जीता। वे 7½–6½ से जीते और 18 साल की उम्र में इतिहास के सबसे कम उम्र के undisputed World Champion बने।',
        'उन्होंने बाद में कहा कि वे बचपन से इस पल का सपना देखते थे। उनकी कहानी बताती है कि रोज़ की लगातार मेहनत, अच्छे coaches और भरोसा करने वाला परिवार आपको बहुत दूर ले जा सकते हैं।',
        'बड़े सपने देखिए, और फिर रोज़ छोटी-छोटी मेहनत कीजिए।',
      ],
      mr: [
        'Dommaraju Gukesh यांचा जन्म 2006 मध्ये Chennai मध्ये झाला. त्यांनी सातव्या वर्षी chess सुरू केलं, आणि 12 वर्षे 7 महिन्यांच्या वयात ते Grandmaster झाले, जे आजवरच्या सगळ्यात कमी वयाच्या लोकांपैकी एक आहे.',
        '2024 मध्ये त्यांनी फक्त 17 व्या वर्षी Toronto मधली Candidates Tournament जिंकली, असं करणारे सगळ्यात तरुण player. त्यामुळे त्यांना World Champion ला आव्हान देण्याचा हक्क मिळाला.',
        'डिसेंबर 2024 मध्ये Singapore मध्ये त्यांनी World Championship साठी China च्या Ding Liren शी खेळलं. 14 games नंतर score बरोबरीत होता, पण शेवटची game Gukesh ने जिंकली. ते 7½–6½ ने जिंकले आणि वयाच्या 18 व्या वर्षी इतिहासातले सगळ्यात तरुण undisputed World Champion झाले.',
        'नंतर त्यांनी सांगितलं की ते लहानपणापासून या क्षणाचं स्वप्न बघत होते. त्यांची गोष्ट सांगते की रोजची सातत्यपूर्ण मेहनत, चांगले coaches आणि तुमच्यावर विश्वास ठेवणारं कुटुंब तुम्हाला खूप दूर नेऊ शकतात.',
        'मोठी स्वप्नं बघा, आणि मग रोज छोटी छोटी मेहनत करा.',
      ],
    },
  },
  {
    slug: 'deep-blue-vs-kasparov',
    date: '2026-10-14',
    read: 2,
    tag: 'Story',
    piece: '♜',
    hue: 195,
    title: { en: 'The day a computer beat the World Champion', hi: 'वह दिन जब एक computer ने World Champion को हराया', mr: 'ज्या दिवशी computer ने World Champion ला हरवलं' },
    summary: {
      en: 'In 1997, IBM’s Deep Blue beat Garry Kasparov in a match. What did it change?',
      hi: '1997 में IBM के Deep Blue ने Garry Kasparov को एक match में हराया। इससे क्या बदला?',
      mr: '1997 मध्ये IBM च्या Deep Blue ने Garry Kasparov ला एका match मध्ये हरवलं. त्यातून काय बदललं?',
    },
    body: {
      en: [
        'Garry Kasparov was the World Chess Champion for 15 years and many people thought no machine could beat him. In February 1996, in Philadelphia, he played IBM’s computer Deep Blue and won the match 4–2, although the machine won one game.',
        'In May 1997, in New York, they played again with an improved Deep Blue. This time the computer won the six-game match 3½–2½. It was the first time a computer beat a reigning World Champion in a match with normal time controls.',
        'Many feared that chess was finished. The opposite happened. Today a free engine on your phone is stronger than any human, and it is the best coach ever: players of every level use it to find mistakes and new ideas. Stockfish, the engine inside Chess Castles, is one of the strongest in the world.',
        'Chess is more popular now than ever. The computer did not replace the human fight; it gave everyone a tireless teacher.',
      ],
      hi: [
        'Garry Kasparov 15 साल तक World Chess Champion रहे और कई लोग सोचते थे कि कोई मशीन उन्हें नहीं हरा सकती। फ़रवरी 1996 में Philadelphia में उन्होंने IBM के computer Deep Blue से खेला और match 4–2 से जीता, हालाँकि मशीन ने एक game जीता।',
        'मई 1997 में New York में दोनों फिर खेले, इस बार बेहतर बने Deep Blue के साथ। इस बार computer ने छह games का match 3½–2½ से जीता। यह पहली बार था जब किसी computer ने सामान्य time control वाले match में मौजूदा World Champion को हराया।',
        'कई लोगों को डर लगा कि chess ख़त्म हो गया। उल्टा हुआ। आज आपके phone का free engine किसी भी इंसान से ज़्यादा strong है, और वह अब तक का सबसे अच्छा coach है: हर level के players उससे गलतियाँ और नए ideas ढूँढते हैं। Chess Castles के अंदर का engine Stockfish दुनिया के सबसे मज़बूत engines में से एक है।',
        'Chess आज पहले से कहीं ज़्यादा लोकप्रिय है। Computer ने इंसानी मुक़ाबले की जगह नहीं ली; उसने सबको एक कभी न थकने वाला शिक्षक दे दिया।',
      ],
      mr: [
        'Garry Kasparov 15 वर्षं World Chess Champion होते आणि अनेकांना वाटायचं की कोणतंही यंत्र त्यांना हरवू शकणार नाही. फेब्रुवारी 1996 मध्ये Philadelphia मध्ये त्यांनी IBM चा computer Deep Blue शी खेळून match 4–2 ने जिंकली, जरी यंत्राने एक game जिंकली.',
        'मे 1997 मध्ये New York मध्ये दोघे पुन्हा खेळले, यावेळी सुधारलेल्या Deep Blue सोबत. यावेळी computer ने सहा games ची match 3½–2½ ने जिंकली. सामान्य time control च्या match मध्ये एका computer ने विद्यमान World Champion ला हरवण्याची ही पहिली वेळ होती.',
        'अनेकांना भीती वाटली की chess संपलं. उलटंच झालं. आज तुमच्या phone वरचा free engine कोणत्याही माणसापेक्षा strong आहे, आणि तो आजवरचा सगळ्यात चांगला coach आहे: प्रत्येक level चे players त्याच्याकडून चुका आणि नवीन ideas शोधतात. Chess Castles मधला engine Stockfish जगातल्या सगळ्यात strong engines पैकी एक आहे.',
        'Chess आज पूर्वीपेक्षा जास्त लोकप्रिय आहे. Computer ने माणसांच्या लढतीची जागा घेतली नाही; त्याने सगळ्यांना कधीही न थकणारा शिक्षक दिला.',
      ],
    },
  },
  {
    slug: 'seven-tips-for-chess-parents',
    date: '2026-10-13',
    read: 3,
    tag: 'Parents',
    piece: '♙',
    hue: 330,
    title: { en: '7 tips for parents of a young chess player', hi: 'छोटे chess player के parents के लिए 7 सुझाव', mr: 'लहान chess player च्या पालकांसाठी 7 सूचना' },
    summary: {
      en: 'How to support your child without pressure, from a coach’s point of view.',
      hi: 'बिना दबाव डाले अपने बच्चे का साथ कैसे दें, एक coach के नज़रिए से।',
      mr: 'दडपण न आणता मुलाला साथ कशी द्यावी, एका coach च्या दृष्टिकोनातून.',
    },
    body: {
      en: [
        'Chess teaches focus, patience and handling losses. Here is how parents can help.',
        '## Seven tips',
        '- Praise effort and good ideas, not only wins. "I liked how you checked every threat" is better than "You won".',
        '- Ask, do not tell. After a game: "Which move was hardest? What would you change?" Children learn more from their own answers.',
        '- Keep a routine: a short daily practice (15–30 minutes) beats one long weekend session.',
        '- Let them lose. Losses are the best teacher; do not rescue the child from every difficult game.',
        '- Do not compare with other children. Compare the child with themselves from three months ago.',
        '- Choose tournaments that fit: age-group and rating-group events, not only the biggest ones. Playing opponents of similar strength is more fun.',
        '- Protect sleep, play and school. Chess is a long journey, and a happy child plays for many years.',
        'You do not need to know chess. Your interest and calm matter more than your chess knowledge. Our Chess Guide answers the questions parents ask most.',
      ],
      hi: [
        'Chess ध्यान, धैर्य और हार को सँभालना सिखाता है। Parents इस तरह मदद कर सकते हैं।',
        '## सात सुझाव',
        '- सिर्फ़ जीत की नहीं, मेहनत और अच्छे ideas की तारीफ़ कीजिए। "तुमने हर threat देखी, यह मुझे अच्छा लगा" कहना "तुम जीते" कहने से बेहतर है।',
        '- बताइए नहीं, पूछिए। Game के बाद: "कौन सी move सबसे मुश्किल थी? तुम क्या बदलते?" बच्चे अपने जवाबों से ज़्यादा सीखते हैं।',
        '- एक routine रखिए: रोज़ छोटी practice (15–30 minutes) हफ़्ते के अंत की एक लंबी practice से बेहतर है।',
        '- उन्हें हारने दीजिए। हार सबसे अच्छी शिक्षक है; बच्चे को हर मुश्किल game से बचाइए मत।',
        '- दूसरे बच्चों से तुलना मत कीजिए। बच्चे की तुलना तीन महीने पहले के उसी बच्चे से कीजिए।',
        '- ऐसे tournaments चुनिए जो सही बैठें: age-group और rating-group events, सिर्फ़ सबसे बड़े नहीं। बराबर ताक़त के opponents से खेलना ज़्यादा मज़ेदार होता है।',
        '- नींद, खेल और पढ़ाई को बचाकर रखिए। Chess लंबा सफ़र है, और ख़ुश बच्चा कई साल खेलता है।',
        'आपको chess आना ज़रूरी नहीं। आपकी दिलचस्पी और शांति आपके chess ज्ञान से ज़्यादा मायने रखती है। हमारा Chess Guide parents के सबसे आम सवालों के जवाब देता है।',
      ],
      mr: [
        'Chess एकाग्रता, संयम आणि हार सांभाळायला शिकवतो. पालक अशी मदत करू शकतात.',
        '## सात सूचना',
        '- फक्त विजयाचं नाही, मेहनतीचं आणि चांगल्या ideas चं कौतुक करा. "तू प्रत्येक threat बघितलीस, ते मला आवडलं" हे "तू जिंकलास" पेक्षा चांगलं आहे.',
        '- सांगू नका, विचारा. game नंतर: "कुठली move सगळ्यात कठीण होती? तू काय बदलशील?" मुलं स्वतःच्या उत्तरांतून जास्त शिकतात.',
        '- एक routine ठेवा: रोजचा छोटा सराव (15–30 minutes) आठवड्याच्या शेवटच्या एका मोठ्या सरावापेक्षा चांगला.',
        '- त्यांना हरू द्या. हार हा सर्वोत्तम शिक्षक आहे; मुलाला प्रत्येक कठीण game मधून वाचवू नका.',
        '- इतर मुलांशी तुलना करू नका. मुलाची तुलना तीन महिन्यांपूर्वीच्या त्याच मुलाशी करा.',
        '- योग्य बसणारे tournaments निवडा: age-group आणि rating-group events, फक्त सगळ्यात मोठे नाही. सारख्या ताकदीच्या opponents शी खेळणं जास्त मजेचं असतं.',
        '- झोप, खेळ आणि अभ्यास जपा. Chess हा लांबचा प्रवास आहे, आणि आनंदी मूल अनेक वर्षं खेळतं.',
        'तुम्हाला chess यायला हवं असं नाही. तुमची आवड आणि शांतता तुमच्या chess ज्ञानापेक्षा जास्त महत्त्वाची आहे. आमचं Chess Guide पालकांच्या सगळ्यात नेहमीच्या प्रश्नांची उत्तरं देतं.',
      ],
    },
  },
];

export const POSTS: Post[] = [...BASE_POSTS, ...MORE_POSTS];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);
