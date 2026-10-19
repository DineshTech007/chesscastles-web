import type { L10n } from '$lib/coach/i18n';
import type { Plans } from './openingStudy';

/**
 * The written plans of the most-played tournament openings (added October 2026): for each opening an overview,
 * and for each hand-picked line the plans of the student's side and what to watch out for. General and true,
 * like the first three openings' plans in openingStudy.ts; chess words stay in English in Hindi and Marathi.
 */
const T = (en: string, hi: string, mr: string): L10n => ({ en, hi, mr });

export const PLANS2: Record<string, Plans> = {
  'ruy-lopez': {
    overview: T(
      "The Ruy Lopez (the Spanish Game) is one of the oldest and richest openings. With 3.Bb5 White attacks the knight that defends e5, builds slow pressure, castles and prepares c3 and d4 to take the centre. World champions have played it for 150 years.",
      'Ruy Lopez (Spanish Game) सबसे पुरानी और सबसे गहरी openings में से एक है। 3.Bb5 से White उस knight पर attack करता है जो e5 को defend करता है, धीरे-धीरे दबाव बनाता है, castle करता है और centre लेने के लिए c3 और d4 की तैयारी करता है। World champions इसे 150 साल से खेल रहे हैं।',
      'Ruy Lopez (Spanish Game) ही सर्वात जुन्या आणि सर्वात समृद्ध openings पैकी एक आहे. 3.Bb5 ने White त्या knight वर attack करतो जो e5 ला defend करतो, हळूहळू दबाव वाढवतो, castle करतो आणि centre घेण्यासाठी c3 आणि d4 ची तयारी करतो. World champions ती 150 वर्षं खेळत आहेत.',
    ),
    lines: {
      morphy: {
        plans: [
          T('After 3...a6 keep the bishop with 4.Ba4, castle, then Re1, c3 and d4: a strong centre and a long, rich middlegame.', '3...a6 के बाद 4.Ba4 से bishop बचाओ, castle करो, फिर Re1, c3 और d4: मज़बूत centre और लंबा, गहरा middlegame।', '3...a6 नंतर 4.Ba4 ने bishop वाचव, castle कर, मग Re1, c3 आणि d4: भक्कम centre आणि लांब, समृद्ध middlegame.'),
          T('The bishop often retreats to c2 and the knight travels b1-d2-f1-g3 to join the kingside attack.', 'Bishop अक्सर c2 पर लौटता है और knight b1-d2-f1-g3 का रास्ता लेकर kingside attack में शामिल होता है।', 'Bishop बऱ्याचदा c2 वर परत येतो आणि knight b1-d2-f1-g3 असा प्रवास करून kingside attack मध्ये सामील होतो.'),
        ],
        watch: T('In the Marshall Attack (...O-O and ...d5) Black gives a pawn for a fast attack on your king: know the main moves before you allow it.', 'Marshall Attack (...O-O और ...d5) में Black तुम्हारे king पर तेज़ attack के लिए एक pawn देता है: इसे होने देने से पहले main moves जान लो।', 'Marshall Attack (...O-O आणि ...d5) मध्ये Black तुझ्या king वर वेगवान attack साठी एक pawn देतो: ते होऊ देण्याआधी main moves माहीत करून घे.'),
      },
      berlin: {
        plans: [
          T('Against 3...Nf6 castle at once; after 4...Nxe4 5.d4 or 5.Re1 you win the pawn back with a lead in development.', '3...Nf6 के ख़िलाफ़ तुरंत castle करो; 4...Nxe4 के बाद 5.d4 या 5.Re1 से development में आगे रहते हुए pawn वापस जीतो।', '3...Nf6 विरुद्ध लगेच castle कर; 4...Nxe4 नंतर 5.d4 किंवा 5.Re1 ने development मध्ये पुढे राहून pawn परत जिंक.'),
          T('Many players avoid the Berlin endgame with 4.d3: a quiet Italian-style game where White keeps more pieces and plays slowly for a kingside attack.', 'बहुत से players 4.d3 से Berlin endgame से बचते हैं: Italian जैसा शांत game, जहाँ White ज़्यादा pieces रखकर धीरे-धीरे kingside attack की ओर खेलता है।', 'अनेक players 4.d3 ने Berlin endgame टाळतात: Italian सारखा शांत game, जिथे White जास्त pieces ठेवून हळूहळू kingside attack कडे खेळतो.'),
        ],
        watch: T('In the Berlin endgame Black has the bishop pair but a damaged pawn structure: use your kingside pawn majority.', 'Berlin endgame में Black के पास bishop pair है पर pawn structure कमज़ोर है: अपनी kingside pawn majority का उपयोग करो।', 'Berlin endgame मध्ये Black कडे bishop pair असते पण pawn structure कमकुवत असते: तुझ्या kingside pawn majority चा उपयोग कर.'),
      },
      classical: {
        plans: [
          T('Against 3...Bc5 play c3 and d4: the centre pawns gain time by hitting the bishop.', '3...Bc5 के ख़िलाफ़ c3 और d4 खेलो: centre के pawns bishop पर वार करके समय जीतते हैं।', '3...Bc5 विरुद्ध c3 आणि d4 खेळ: centre चे pawns bishop वर वार करून वेळ जिंकतात.'),
          T('Castle early and keep the e4 pawn well protected before you push d4.', 'जल्दी castle करो और d4 push करने से पहले e4 pawn को अच्छी तरह protect रखो।', 'लवकर castle कर आणि d4 push करण्याआधी e4 pawn चांगला protect ठेव.'),
        ],
      },
      other: {
        plans: [
          T('Against rarer replies the plan is the same: castle, Re1, c3 and d4 for a big centre.', 'कम खेले जाने वाले जवाबों के ख़िलाफ़ भी plan वही है: castle, Re1, c3 और d4 से बड़ा centre।', 'कमी खेळल्या जाणाऱ्या उत्तरांविरुद्धही plan तोच: castle, Re1, c3 आणि d4 ने मोठं centre.'),
          T('If Black blocks with ...d6 or ...Nge7, take the e5 pawn only when it is really free.', 'अगर Black ...d6 या ...Nge7 से रोकता है, तो e5 pawn तभी लो जब वह सच में free हो।', 'Black ने ...d6 किंवा ...Nge7 ने अडवलं तर e5 pawn तेव्हाच घे जेव्हा तो खरंच free असेल.'),
        ],
      },
    },
  },

  italian: {
    overview: T(
      "The Italian Game aims the bishop at f7, Black's weakest point at the start. Today's top players choose the slow plan with c3 and d3: a healthy centre, a safe king, and a long fight in which White slowly gains space.",
      'Italian Game में bishop f7 पर निशाना लगाता है, जो शुरुआत में Black का सबसे कमज़ोर point है। आज के top players c3 और d3 वाला धीमा plan चुनते हैं: healthy centre, safe king और लंबी लड़ाई, जिसमें White धीरे-धीरे space लेता है।',
      'Italian Game मध्ये bishop f7 वर नेम धरतो, जो सुरुवातीला Black चा सर्वात कमकुवत point असतो. आजचे top players c3 आणि d3 चा संथ plan निवडतात: healthy centre, safe king आणि लांब लढत, ज्यात White हळूहळू space घेतो.',
    ),
    lines: {
      giuoco: {
        plans: [
          T('Against 3...Bc5 play c3, d3, O-O and Re1, then a4 to gain space on the queenside.', '3...Bc5 के ख़िलाफ़ c3, d3, O-O और Re1 खेलो, फिर queenside पर space लेने के लिए a4।', '3...Bc5 विरुद्ध c3, d3, O-O आणि Re1 खेळ, मग queenside वर space घेण्यासाठी a4.'),
          T('The knight goes b1-d2-f1-g3 and the bishop often retreats to b3 or a2, keeping its eye on f7.', 'Knight b1-d2-f1-g3 जाता है और bishop अक्सर b3 या a2 पर लौटता है, f7 पर नज़र रखते हुए।', 'Knight b1-d2-f1-g3 जातो आणि bishop बऱ्याचदा b3 किंवा a2 वर परत येतो, f7 वर लक्ष ठेवत.'),
        ],
        watch: T('When Black plays ...d5 at the right moment the centre opens: keep your pieces ready and your king castled.', 'जब Black सही समय पर ...d5 खेलता है तो centre खुल जाता है: अपने pieces तैयार और king castled रखो।', 'Black ने योग्य वेळी ...d5 खेळलं की centre उघडतं: तुझे pieces तयार आणि king castled ठेव.'),
      },
      'two-knights': {
        plans: [
          T('Against 3...Nf6 the safe choice is 4.d3: no early adventures, simply develop and castle.', '3...Nf6 के ख़िलाफ़ सुरक्षित चुनाव 4.d3 है: कोई जल्दबाज़ी नहीं, बस develop करो और castle करो।', '3...Nf6 विरुद्ध सुरक्षित निवड 4.d3 आहे: कोणतीही घाई नाही, फक्त develop कर आणि castle कर.'),
          T('4.Ng5 attacks f7 at once; after 4...d5 5.exd5 Na5 Black gives a pawn for quick development, so you must know the lines.', '4.Ng5 तुरंत f7 पर attack करता है; 4...d5 5.exd5 Na5 के बाद Black तेज़ development के लिए pawn देता है, इसलिए lines जाननी ज़रूरी हैं।', '4.Ng5 लगेच f7 वर attack करतो; 4...d5 5.exd5 Na5 नंतर Black वेगवान development साठी pawn देतो, म्हणून lines माहीत असायला हव्यात.'),
        ],
      },
      quiet: {
        plans: [
          T('Against quiet moves like 3...Be7 or 3...d6, take the centre with d4 at once: Black is a little passive.', '3...Be7 या 3...d6 जैसी शांत चालों के ख़िलाफ़ तुरंत d4 से centre लो: Black थोड़ा passive है।', '3...Be7 किंवा 3...d6 सारख्या शांत चालींविरुद्ध लगेच d4 ने centre घे: Black थोडा passive आहे.'),
          T('Develop fast and look for open lines toward f7 and the black king.', 'तेज़ी से develop करो और f7 और black king की तरफ़ खुली lines ढूँढो।', 'वेगाने develop कर आणि f7 आणि black king कडे उघड्या lines शोध.'),
        ],
      },
      other: {
        plans: [
          T('The Italian plan works against almost everything: c3, d3, castle, Re1 and a slow build-up.', 'Italian plan लगभग हर चीज़ के ख़िलाफ़ काम करता है: c3, d3, castle, Re1 और धीरे-धीरे तैयारी।', 'Italian plan जवळजवळ सगळ्याविरुद्ध चालतो: c3, d3, castle, Re1 आणि हळूहळू तयारी.'),
          T('Watch for tactics on f7 for you, and on f2 for Black.', 'अपने लिए f7 पर और Black के लिए f2 पर tactics पर नज़र रखो।', 'तुझ्यासाठी f7 वर आणि Black साठी f2 वर tactics कडे लक्ष ठेव.'),
        ],
      },
    },
  },

  'queens-gambit': {
    overview: T(
      "In the Queen's Gambit White offers the c-pawn to pull Black's d-pawn away from the centre. It is not a real gambit: if Black takes, White wins the pawn back easily. White gets space and easy development, which is why it is one of the most popular openings at every level.",
      "Queen's Gambit में White, Black के d-pawn को centre से हटाने के लिए c-pawn offer करता है। यह असली gambit नहीं है: अगर Black लेता है, तो White आसानी से pawn वापस जीत लेता है। White को space और आसान development मिलता है, इसलिए यह हर level पर सबसे लोकप्रिय openings में से एक है।",
      "Queen's Gambit मध्ये White, Black च्या d-pawn ला centre पासून दूर नेण्यासाठी c-pawn offer करतो. हा खरा gambit नाही: Black ने घेतला तर White सहज pawn परत जिंकतो. White ला space आणि सोपं development मिळतं, म्हणून ही प्रत्येक level वर सर्वात लोकप्रिय openings पैकी एक आहे.",
    ),
    lines: {
      qgd: {
        plans: [
          T('Against 2...e6 develop with Nc3, Bg5 (or Bf4), e3 and Nf3: the c8 bishop behind the e6 pawn is Black\'s problem piece.', '2...e6 के ख़िलाफ़ Nc3, Bg5 (या Bf4), e3 और Nf3 से develop करो: e6 pawn के पीछे फँसा c8 bishop Black का problem piece है।', '2...e6 विरुद्ध Nc3, Bg5 (किंवा Bf4), e3 आणि Nf3 ने develop कर: e6 pawn मागे अडकलेला c8 bishop हा Black चा problem piece आहे.'),
          T('The minority attack: with the pawn exchange on d5, push b4-b5 to give Black a weak pawn on c6.', 'Minority attack: d5 पर pawn exchange के बाद b4-b5 push करो ताकि c6 पर Black का pawn कमज़ोर हो जाए।', 'Minority attack: d5 वर pawn exchange झाल्यावर b4-b5 push कर म्हणजे c6 वर Black चा pawn कमकुवत होईल.'),
        ],
      },
      slav: {
        plans: [
          T('Against 2...c6 the main moves are Nf3, Nc3 and e3: protect c4 and develop calmly.', '2...c6 के ख़िलाफ़ main moves Nf3, Nc3 और e3 हैं: c4 को protect करो और शांति से develop करो।', '2...c6 विरुद्ध main moves Nf3, Nc3 आणि e3 आहेत: c4 protect कर आणि शांतपणे develop कर.'),
          T('If Black takes on c4 and holds the pawn with ...b5, a4 breaks up the queenside pawns.', 'अगर Black c4 पर लेकर ...b5 से pawn पकड़े रखता है, तो a4 से queenside pawns टूट जाते हैं।', 'Black ने c4 वर घेऊन ...b5 ने pawn धरून ठेवला तर a4 ने queenside pawns फुटतात.'),
        ],
        watch: T('The Slav bishop comes to f5 or g4 before ...e6: be ready to answer with Qb3, hitting b7.', 'Slav में bishop ...e6 से पहले f5 या g4 पर आता है: b7 पर वार करने वाले Qb3 से जवाब देने के लिए तैयार रहो।', 'Slav मध्ये bishop ...e6 च्या आधी f5 किंवा g4 वर येतो: b7 वर वार करणाऱ्या Qb3 ने उत्तर द्यायला तयार रहा.'),
      },
      qga: {
        plans: [
          T('Against 2...dxc4 play e3 (or e4) and Bxc4: you win the pawn back and have the better centre.', '2...dxc4 के ख़िलाफ़ e3 (या e4) और Bxc4 खेलो: pawn वापस जीतो और बेहतर centre पाओ।', '2...dxc4 विरुद्ध e3 (किंवा e4) आणि Bxc4 खेळ: pawn परत जिंक आणि चांगलं centre मिळव.'),
          T('Black usually plays ...c5 to hit d4; an isolated d-pawn for White is common and gives active pieces.', 'Black आमतौर पर d4 पर वार करने के लिए ...c5 खेलता है; White के लिए isolated d-pawn आम है और pieces को active बनाता है।', 'Black सहसा d4 वर वार करण्यासाठी ...c5 खेळतो; White साठी isolated d-pawn सामान्य आहे आणि pieces active करतो.'),
        ],
      },
      other: {
        plans: [
          T('Against other replies keep it simple: Nc3, Nf3, e3 or e4 when it is safe, and a lead in development.', 'दूसरे जवाबों के ख़िलाफ़ सरल रहो: Nc3, Nf3, सुरक्षित हो तो e3 या e4, और development में बढ़त।', 'इतर उत्तरांविरुद्ध सोपं ठेव: Nc3, Nf3, सुरक्षित असेल तर e3 किंवा e4, आणि development मध्ये आघाडी.'),
          T('Against the Albin Counter-Gambit (2...e5) take the pawn and develop the kingside quickly.', 'Albin Counter-Gambit (2...e5) के ख़िलाफ़ pawn लो और kingside जल्दी develop करो।', 'Albin Counter-Gambit (2...e5) विरुद्ध pawn घे आणि kingside लवकर develop कर.'),
        ],
      },
    },
  },

  london: {
    overview: T(
      'The London System is a set-up you can play against almost anything: d4, Bf4, e3, Nf3, c3, Bd3 and Nbd2. It is solid, easy to learn and full of clear plans, which is why it is popular from club players to world champions.',
      'London System एक set-up है जिसे लगभग हर चीज़ के ख़िलाफ़ खेला जा सकता है: d4, Bf4, e3, Nf3, c3, Bd3 और Nbd2। यह solid है, सीखने में आसान है और इसमें साफ़ plans हैं, इसलिए club players से लेकर world champions तक यह लोकप्रिय है।',
      'London System हा एक set-up आहे जो जवळजवळ सगळ्याविरुद्ध खेळता येतो: d4, Bf4, e3, Nf3, c3, Bd3 आणि Nbd2. तो solid आहे, शिकायला सोपा आहे आणि त्यात स्पष्ट plans आहेत, म्हणून club players पासून world champions पर्यंत तो लोकप्रिय आहे.',
    ),
    lines: {
      d5: {
        plans: [
          T('Build the pyramid: Bf4, e3, c3, Nf3, Bd3, Nbd2 and castle. The bishop on f4 stays outside the pawn chain.', 'Pyramid बनाओ: Bf4, e3, c3, Nf3, Bd3, Nbd2 और castle। f4 वाला bishop pawn chain के बाहर रहता है।', 'Pyramid बनव: Bf4, e3, c3, Nf3, Bd3, Nbd2 आणि castle. f4 वरचा bishop pawn chain च्या बाहेर राहतो.'),
          T('Then Ne5 with f4, or a timely e4, gives you the initiative.', 'फिर f4 के साथ Ne5, या सही समय पर e4, तुम्हें initiative देता है।', 'मग f4 सोबत Ne5, किंवा योग्य वेळी e4, तुला initiative देतो.'),
        ],
        watch: T('If Black plays ...c5 and ...Qb6, b2 is attacked: answer with Qb3 or Qc1.', 'अगर Black ...c5 और ...Qb6 खेलता है, तो b2 पर attack होता है: Qb3 या Qc1 से जवाब दो।', 'Black ने ...c5 आणि ...Qb6 खेळलं तर b2 वर attack होतो: Qb3 किंवा Qc1 ने उत्तर दे.'),
      },
      nf6: {
        plans: [
          T('Against 1...Nf6 the same set-up works; Nf3 and e3 come before c3.', '1...Nf6 के ख़िलाफ़ भी वही set-up काम करता है; c3 से पहले Nf3 और e3 आते हैं।', '1...Nf6 विरुद्धही तोच set-up चालतो; c3 च्या आधी Nf3 आणि e3 येतात.'),
          T('Keep h3 in mind: it gives the f4 bishop a safe retreat on h2 when Black plays ...Nh5.', 'h3 याद रखो: जब Black ...Nh5 खेलता है तो इससे f4 वाले bishop को h2 पर safe जगह मिलती है।', 'h3 लक्षात ठेव: Black ने ...Nh5 खेळलं की त्यामुळे f4 वरच्या bishop ला h2 वर safe जागा मिळते.'),
        ],
      },
      kid: {
        plans: [
          T('Against a King\'s Indian set-up (...g6, ...Bg7, ...d6) play e3, Be2, O-O and h3, and stop ...e5 with your pieces.', "King's Indian set-up (...g6, ...Bg7, ...d6) के ख़िलाफ़ e3, Be2, O-O और h3 खेलो, और अपने pieces से ...e5 को रोको।", "King's Indian set-up (...g6, ...Bg7, ...d6) विरुद्ध e3, Be2, O-O आणि h3 खेळ, आणि तुझ्या pieces ने ...e5 थांबव."),
          T('If Black gets ...e5 in, exchange on e5 and use the open d-file.', 'अगर Black ...e5 खेल लेता है, तो e5 पर exchange करो और खुली d-file का उपयोग करो।', 'Black ने ...e5 खेळलं तर e5 वर exchange कर आणि उघड्या d-file चा उपयोग कर.'),
        ],
      },
      other: {
        plans: [
          T('The London plan stays the same against everything: the pyramid first, then a plan in the centre.', 'London plan हर चीज़ के ख़िलाफ़ वही रहता है: पहले pyramid, फिर centre में plan।', 'London plan सगळ्याविरुद्ध तोच राहतो: आधी pyramid, मग centre मध्ये plan.'),
          T('Do not rush: a solid position and a calm attack win London games.', 'जल्दबाज़ी मत करो: solid position और शांत attack से London games जीती जाती हैं।', 'घाई करू नकोस: solid position आणि शांत attack ने London games जिंकल्या जातात.'),
        ],
      },
    },
  },

  najdorf: {
    overview: T(
      'The Sicilian Najdorf is the most famous fighting answer to 1.e4. The move ...a6 is small but flexible: it stops pieces from coming to b5 and prepares ...e5 or ...e6 and queenside play with ...b5. This course also covers White\'s ways to avoid the open Sicilian.',
      'Sicilian Najdorf 1.e4 का सबसे मशहूर लड़ाकू जवाब है। ...a6 छोटी पर flexible चाल है: यह pieces को b5 पर आने से रोकती है और ...e5 या ...e6 तथा ...b5 से queenside play की तैयारी करती है। यह course White के open Sicilian से बचने के तरीके भी सिखाता है।',
      'Sicilian Najdorf हे 1.e4 चं सर्वात प्रसिद्ध लढाऊ उत्तर आहे. ...a6 ही छोटी पण flexible चाल आहे: ती pieces ना b5 वर येण्यापासून थांबवते आणि ...e5 किंवा ...e6 आणि ...b5 ने queenside play ची तयारी करते. हा course White चे open Sicilian टाळण्याचे मार्गही शिकवतो.',
    ),
    lines: {
      open: {
        plans: [
          T('In the open Sicilian Black has the extra centre pawn and the half-open c-file: put a rook on c8 and press on c4 and c3.', 'Open Sicilian में Black के पास centre का ज़्यादा pawn और half-open c-file है: c8 पर rook रखो और c4 और c3 पर दबाव बनाओ।', 'Open Sicilian मध्ये Black कडे centre चा जास्तीचा pawn आणि half-open c-file असते: c8 वर rook ठेव आणि c4 आणि c3 वर दबाव टाक.'),
          T('...e5 gains space and kicks the d4 knight; then the d5 square is the key, so control it with pieces.', '...e5 space लेता है और d4 वाले knight को भगाता है; तब d5 square सबसे ज़रूरी है, इसलिए उसे pieces से control करो।', '...e5 space घेतो आणि d4 वरच्या knight ला हाकलतो; मग d5 square सर्वात महत्त्वाचा असतो, म्हणून तो pieces ने control कर.'),
          T('...b5 and ...Bb7 start queenside play while White attacks on the kingside: count who is faster.', '...b5 और ...Bb7 से queenside play शुरू होता है जबकि White kingside पर attack करता है: गिनो कि कौन तेज़ है।', '...b5 आणि ...Bb7 ने queenside play सुरू होतो तर White kingside वर attack करतो: कोण वेगवान आहे ते मोज.'),
        ],
        watch: T('Against the English Attack (Be3, f3, Qd2, g4) White storms your king: counter-attack quickly, do not wait.', 'English Attack (Be3, f3, Qd2, g4) में White तुम्हारे king पर धावा बोलता है: जल्दी counter-attack करो, इंतज़ार मत करो।', 'English Attack (Be3, f3, Qd2, g4) मध्ये White तुझ्या king वर हल्ला करतो: लवकर counter-attack कर, थांबू नकोस.'),
      },
      moscow: {
        plans: [
          T('Against 3.Bb5+ block with ...Bd7 or ...Nd7; after the bishop exchange develop with ...Nf6, ...g6 and ...Bg7.', '3.Bb5+ के ख़िलाफ़ ...Bd7 या ...Nd7 से रोको; bishop exchange के बाद ...Nf6, ...g6 और ...Bg7 से develop करो।', '3.Bb5+ विरुद्ध ...Bd7 किंवा ...Nd7 ने अडव; bishop exchange नंतर ...Nf6, ...g6 आणि ...Bg7 ने develop कर.'),
          T('Black keeps a healthy position; the c-file and the long diagonal give good play.', 'Black की position healthy रहती है; c-file और लंबा diagonal अच्छा play देते हैं।', 'Black ची position healthy राहते; c-file आणि लांब diagonal चांगला play देतात.'),
        ],
      },
      alapin: {
        plans: [
          T('Against 2.c3 hit the centre at once with ...d5 or ...Nf6: White wants d4 next.', '2.c3 के ख़िलाफ़ तुरंत ...d5 या ...Nf6 से centre पर वार करो: White अगली चाल में d4 चाहता है।', '2.c3 विरुद्ध लगेच ...d5 किंवा ...Nf6 ने centre वर वार कर: White ला पुढे d4 हवा आहे.'),
          T('After ...Nf6 e5 Nd5 the knight is strong in the centre; develop with ...Nc6 and ...d6.', '...Nf6 e5 Nd5 के बाद knight centre में मज़बूत है; ...Nc6 और ...d6 से develop करो।', '...Nf6 e5 Nd5 नंतर knight centre मध्ये मजबूत असतो; ...Nc6 आणि ...d6 ने develop कर.'),
        ],
      },
      closed: {
        plans: [
          T('Against 2.Nc3 (the Closed Sicilian and the Grand Prix with f4) develop with ...Nc6, ...g6 and ...Bg7.', '2.Nc3 (Closed Sicilian और f4 वाला Grand Prix) के ख़िलाफ़ ...Nc6, ...g6 और ...Bg7 से develop करो।', '2.Nc3 (Closed Sicilian आणि f4 सोबतचा Grand Prix) विरुद्ध ...Nc6, ...g6 आणि ...Bg7 ने develop कर.'),
          T('Play on the queenside with ...Rb8 and ...b5 while White attacks on the kingside.', 'जब White kingside पर attack करे, तब ...Rb8 और ...b5 से queenside पर खेलो।', 'White kingside वर attack करत असताना ...Rb8 आणि ...b5 ने queenside वर खेळ.'),
        ],
      },
      other: {
        plans: [
          T('Against rare second moves develop naturally and keep the ...d5 break in mind.', 'कम खेली जाने वाली दूसरी चालों के ख़िलाफ़ स्वाभाविक रूप से develop करो और ...d5 break याद रखो।', 'कमी खेळल्या जाणाऱ्या दुसऱ्या चालींविरुद्ध नैसर्गिकपणे develop कर आणि ...d5 break लक्षात ठेव.'),
          T('The c-file and active pieces are Black\'s strength in every Sicilian.', 'हर Sicilian में c-file और active pieces Black की ताक़त हैं।', 'प्रत्येक Sicilian मध्ये c-file आणि active pieces ही Black ची ताकद आहे.'),
        ],
      },
    },
  },

  french: {
    overview: T(
      "The French Defence (1...e6 and 2...d5) builds a strong pawn chain and fights White's centre from the side. It is solid and full of counter-play, a favourite of patient players. The light-squared bishop behind the e6 pawn is the problem piece to solve.",
      'French Defence (1...e6 और 2...d5) मज़बूत pawn chain बनाती है और White के centre से बगल से लड़ती है। यह solid है और counter-play से भरी है, धैर्यवान players की पसंद। e6 pawn के पीछे फँसा light-squared bishop वह problem piece है जिसे सुलझाना है।',
      'French Defence (1...e6 आणि 2...d5) भक्कम pawn chain बनवते आणि White च्या centre शी बाजूने लढते. ती solid आहे आणि counter-play ने भरलेली आहे, संयमी players ची आवडती. e6 pawn मागे अडकलेला light-squared bishop हा सोडवायचा problem piece आहे.',
    ),
    lines: {
      advance: {
        plans: [
          T("Against 3.e5 hit the base of White's chain with ...c5, then ...Nc6 and ...Qb6 to press on d4.", '3.e5 के ख़िलाफ़ ...c5 से White की chain के base पर वार करो, फिर d4 पर दबाव के लिए ...Nc6 और ...Qb6।', '3.e5 विरुद्ध ...c5 ने White च्या chain च्या base वर वार कर, मग d4 वर दबावासाठी ...Nc6 आणि ...Qb6.'),
          T('Later ...f6 can attack the e5 pawn too and open the f-file for your rook.', 'बाद में ...f6 से e5 pawn पर भी attack हो सकता है और तुम्हारे rook के लिए f-file खुलती है।', 'नंतर ...f6 ने e5 pawn वरही attack होऊ शकतो आणि तुझ्या rook साठी f-file उघडते.'),
        ],
        watch: T('White has space on the kingside: do not castle there too early if White can attack with h4 and Qg4.', 'White के पास kingside पर space है: अगर White h4 और Qg4 से attack कर सकता है तो वहाँ बहुत जल्दी castle मत करो।', 'White कडे kingside वर space असते: White h4 आणि Qg4 ने attack करू शकत असेल तर तिथे खूप लवकर castle करू नकोस.'),
      },
      main: {
        plans: [
          T('Against 3.Nc3 the Winawer (3...Bb4) pins the knight and fights for e4; 3...Nf6 is the calmer Classical choice.', '3.Nc3 के ख़िलाफ़ Winawer (3...Bb4) knight को pin करता है और e4 के लिए लड़ता है; 3...Nf6 शांत Classical चुनाव है।', '3.Nc3 विरुद्ध Winawer (3...Bb4) knight ला pin करतो आणि e4 साठी लढतो; 3...Nf6 हा शांत Classical पर्याय आहे.'),
          T('Whatever White does, ...c5 is the main break, and ...f6 the second.', 'White कुछ भी करे, ...c5 main break है, और ...f6 दूसरा।', 'White ने काहीही केलं तरी ...c5 हा main break आहे, आणि ...f6 दुसरा.'),
        ],
      },
      tarrasch: {
        plans: [
          T('Against 3.Nd2 play 3...c5 or 3...Nf6: the d2 knight does not press on d5, so Black can free the game quickly.', '3.Nd2 के ख़िलाफ़ 3...c5 या 3...Nf6 खेलो: d2 वाला knight d5 पर दबाव नहीं डालता, इसलिए Black जल्दी game खोल सकता है।', '3.Nd2 विरुद्ध 3...c5 किंवा 3...Nf6 खेळ: d2 वरचा knight d5 वर दबाव टाकत नाही, म्हणून Black लवकर game मोकळा करू शकतो.'),
          T('An isolated d-pawn for Black is common after ...c5: it gives active pieces, so keep them active.', '...c5 के बाद Black के लिए isolated d-pawn आम है: यह pieces को active बनाता है, इसलिए उन्हें active रखो।', '...c5 नंतर Black साठी isolated d-pawn सामान्य आहे: तो pieces active करतो, म्हणून ते active ठेव.'),
        ],
      },
      exchange: {
        plans: [
          T('After 3.exd5 exd5 the pawns are equal and your c8 bishop is free: develop it quickly to g4 or f5.', '3.exd5 exd5 के बाद pawns बराबर हैं और तुम्हारा c8 bishop free है: उसे जल्दी g4 या f5 पर develop करो।', '3.exd5 exd5 नंतर pawns बरोबरीत असतात आणि तुझा c8 bishop free असतो: तो लवकर g4 किंवा f5 वर develop कर.'),
          T('Develop the pieces actively; a quiet game but Black is never worse.', 'Pieces को active तरीके से develop करो; शांत game है पर Black कभी कमज़ोर नहीं होता।', 'Pieces active पद्धतीने develop कर; शांत game आहे पण Black कधीच कमकुवत नसतो.'),
        ],
      },
      other: {
        plans: [
          T('Against other White moves stay with ...d5 and ...c5: the French structure works against almost everything.', 'White की दूसरी चालों के ख़िलाफ़ ...d5 और ...c5 पर टिके रहो: French structure लगभग हर चीज़ के ख़िलाफ़ काम करता है।', 'White च्या इतर चालींविरुद्ध ...d5 आणि ...c5 वर टिकून रहा: French structure जवळजवळ सगळ्याविरुद्ध चालते.'),
          T('Find a good square for the c8 bishop, often via d7 to b5, or after ...b6 to a6.', 'c8 bishop के लिए अच्छी जगह ढूँढो, अक्सर d7 से b5 तक, या ...b6 के बाद a6 पर।', 'c8 bishop साठी चांगली जागा शोध, बऱ्याचदा d7 मार्गे b5 वर, किंवा ...b6 नंतर a6 वर.'),
        ],
      },
    },
  },

  'kings-indian': {
    overview: T(
      "The King's Indian Defence lets White build a big centre, then attacks it. Black fianchettoes the bishop on g7, castles, and strikes with ...e5 or ...c5. It is the choice of fighters: sharp attacks on opposite sides of the board.",
      "King's Indian Defence White को बड़ा centre बनाने देती है, फिर उस पर attack करती है। Black bishop को g7 पर fianchetto करता है, castle करता है और ...e5 या ...c5 से वार करता है। यह लड़ाकू players का चुनाव है: board के अलग-अलग हिस्सों पर तीखे attacks।",
      "King's Indian Defence White ला मोठं centre बनवू देते, मग त्यावर attack करते. Black bishop g7 वर fianchetto करतो, castle करतो आणि ...e5 किंवा ...c5 ने वार करतो. ही लढवय्या players ची निवड आहे: board च्या वेगवेगळ्या बाजूंना धारदार attacks.",
    ),
    lines: {
      classical: {
        plans: [
          T('In the Classical (Nc3, e4, Nf3, Be2) play ...e5; after d5 the centre is closed and you attack on the kingside with ...Ne8 (or ...Nd7), ...f5 and ...f4.', 'Classical (Nc3, e4, Nf3, Be2) में ...e5 खेलो; d5 के बाद centre बंद हो जाता है और तुम ...Ne8 (या ...Nd7), ...f5 और ...f4 से kingside पर attack करते हो।', 'Classical (Nc3, e4, Nf3, Be2) मध्ये ...e5 खेळ; d5 नंतर centre बंद होतं आणि तू ...Ne8 (किंवा ...Nd7), ...f5 आणि ...f4 ने kingside वर attack करतोस.'),
          T('White attacks on the queenside with c5: the race decides the game, so every tempo counts.', 'White c5 से queenside पर attack करता है: यह race game तय करती है, इसलिए हर tempo मायने रखता है।', 'White c5 ने queenside वर attack करतो: ही race game ठरवते, म्हणून प्रत्येक tempo महत्त्वाचा आहे.'),
        ],
        watch: T('If the centre opens with dxe5, the d-file and the d5 square matter: do not leave d6 weak.', 'अगर dxe5 से centre खुलता है, तो d-file और d5 square महत्वपूर्ण हैं: d6 को कमज़ोर मत छोड़ो।', 'dxe5 ने centre उघडलं तर d-file आणि d5 square महत्त्वाचे असतात: d6 कमकुवत सोडू नकोस.'),
      },
      samisch: {
        plans: [
          T('Against 5.f3 (the Sämisch) White often castles queenside and attacks with g4 and h4: strike back in the centre with ...c5 or ...e5.', '5.f3 (Sämisch) के ख़िलाफ़ White अक्सर queenside castle करके g4 और h4 से attack करता है: ...c5 या ...e5 से centre में जवाबी वार करो।', '5.f3 (Sämisch) विरुद्ध White बऱ्याचदा queenside castle करून g4 आणि h4 ने attack करतो: ...c5 किंवा ...e5 ने centre मध्ये प्रतिहल्ला कर.'),
          T('...c6 and ...a6 with ...b5 open lines toward a king on the queenside.', '...c6 और ...a6 के साथ ...b5 से queenside वाले king की तरफ़ lines खुलती हैं।', '...c6 आणि ...a6 सोबत ...b5 ने queenside वरच्या king कडे lines उघडतात.'),
        ],
      },
      fianchetto: {
        plans: [
          T('Against the fianchetto (g3 and Bg2) the centre is quieter: play ...d6, ...Nbd7 and ...e5, or ...c6 and ...a6.', 'Fianchetto (g3 और Bg2) के ख़िलाफ़ centre शांत रहता है: ...d6, ...Nbd7 और ...e5, या ...c6 और ...a6 खेलो।', 'Fianchetto (g3 आणि Bg2) विरुद्ध centre शांत असतं: ...d6, ...Nbd7 आणि ...e5, किंवा ...c6 आणि ...a6 खेळ.'),
          T('The g7 bishop is your best piece: keep the long diagonal open.', 'g7 वाला bishop तुम्हारा सबसे अच्छा piece है: लंबा diagonal खुला रखो।', 'g7 वरचा bishop हा तुझा सर्वोत्तम piece आहे: लांब diagonal उघडा ठेव.'),
        ],
      },
      london: {
        plans: [
          T('Against the London (Bf4 without c4) the same set-up works: ...g6, ...Bg7, ...d6, castle and ...e5 when it is safe.', 'London (c4 के बिना Bf4) के ख़िलाफ़ भी वही set-up काम करता है: ...g6, ...Bg7, ...d6, castle और सुरक्षित होने पर ...e5।', 'London (c4 शिवाय Bf4) विरुद्धही तोच set-up चालतो: ...g6, ...Bg7, ...d6, castle आणि सुरक्षित असेल तेव्हा ...e5.'),
          T('...Nh5 can chase the f4 bishop, so White often plays h3 first.', '...Nh5 से f4 वाले bishop का पीछा हो सकता है, इसलिए White अक्सर पहले h3 खेलता है।', '...Nh5 ने f4 वरच्या bishop चा पाठलाग होऊ शकतो, म्हणून White बऱ्याचदा आधी h3 खेळतो.'),
        ],
      },
      other: {
        plans: [
          T('The King\'s Indian set-up is the same against most moves: ...Nf6, ...g6, ...Bg7, ...d6 and castle.', "ज़्यादातर चालों के ख़िलाफ़ King's Indian set-up वही है: ...Nf6, ...g6, ...Bg7, ...d6 और castle।", "बहुतेक चालींविरुद्ध King's Indian set-up तोच असतो: ...Nf6, ...g6, ...Bg7, ...d6 आणि castle."),
          T('Choose your break by the centre: ...e5 against a big centre, ...c5 against a quiet one.', 'Centre देखकर अपना break चुनो: बड़े centre के ख़िलाफ़ ...e5, शांत centre के ख़िलाफ़ ...c5।', 'Centre पाहून तुझा break निवड: मोठ्या centre विरुद्ध ...e5, शांत centre विरुद्ध ...c5.'),
        ],
      },
    },
  },

  qgd: {
    overview: T(
      "The Queen's Gambit Declined (2...e6) is one of the most trusted defences in chess: Black holds d5 firmly, develops calmly and castles. The plan is clear, the position is very solid, and world champions have relied on it in their most important games.",
      "Queen's Gambit Declined (2...e6) शतरंज की सबसे भरोसेमंद defences में से एक है: Black d5 को मज़बूती से पकड़ता है, शांति से develop करता है और castle करता है। Plan साफ़ है, position बहुत solid है, और world champions ने अपने सबसे अहम games में इस पर भरोसा किया है।",
      "Queen's Gambit Declined (2...e6) ही बुद्धिबळातील सर्वात विश्वासार्ह defences पैकी एक आहे: Black d5 भक्कमपणे धरतो, शांतपणे develop करतो आणि castle करतो. Plan स्पष्ट आहे, position खूप solid आहे, आणि world champions नी त्यांच्या सर्वात महत्त्वाच्या games मध्ये तिच्यावर विश्वास ठेवला आहे.",
    ),
    lines: {
      orthodox: {
        plans: [
          T('Against Bg5 play ...Be7, ...O-O and ...h6: ask the bishop a question, then free your game with ...Ne4 or ...dxc4 and ...c5.', 'Bg5 के ख़िलाफ़ ...Be7, ...O-O और ...h6 खेलो: bishop से सवाल पूछो, फिर ...Ne4 या ...dxc4 और ...c5 से game खोलो।', 'Bg5 विरुद्ध ...Be7, ...O-O आणि ...h6 खेळ: bishop ला प्रश्न विचार, मग ...Ne4 किंवा ...dxc4 आणि ...c5 ने game मोकळा कर.'),
          T('The c8 bishop is the problem piece: ...b6 and ...Bb7, or ...dxc4 then ...e5, gives it life.', 'c8 bishop problem piece है: ...b6 और ...Bb7, या ...dxc4 फिर ...e5, उसे ज़िंदगी देते हैं।', 'c8 bishop हा problem piece आहे: ...b6 आणि ...Bb7, किंवा ...dxc4 मग ...e5, त्याला जीवन देतात.'),
        ],
      },
      exchange: {
        plans: [
          T('After cxd5 exd5 your c8 bishop is free: develop it to f5 or g4.', 'cxd5 exd5 के बाद तुम्हारा c8 bishop free है: उसे f5 या g4 पर develop करो।', 'cxd5 exd5 नंतर तुझा c8 bishop free असतो: तो f5 किंवा g4 वर develop कर.'),
          T('White often plays the minority attack (b4-b5): answer with ...a6 or meet it with pieces, and look for play on the kingside.', 'White अक्सर minority attack (b4-b5) खेलता है: ...a6 से जवाब दो या pieces से रोको, और kingside पर play ढूँढो।', 'White बऱ्याचदा minority attack (b4-b5) खेळतो: ...a6 ने उत्तर दे किंवा pieces ने अडव, आणि kingside वर play शोध.'),
        ],
      },
      catalan: {
        plans: [
          T('Against g3 (the Catalan) the long diagonal is White\'s weapon: ...dxc4 and holding the pawn for a while is a main plan.', 'g3 (Catalan) के ख़िलाफ़ लंबा diagonal White का हथियार है: ...dxc4 और कुछ समय pawn रखना एक main plan है।', 'g3 (Catalan) विरुद्ध लांब diagonal हे White चं शस्त्र आहे: ...dxc4 आणि काही काळ pawn ठेवणं हा main plan आहे.'),
          T('Then ...c5 or ...b5 with ...Bb7 challenges the g2 bishop.', 'फिर ...c5 या ...Bb7 के साथ ...b5 से g2 वाले bishop को चुनौती दो।', 'मग ...c5 किंवा ...Bb7 सोबत ...b5 ने g2 वरच्या bishop ला आव्हान दे.'),
        ],
      },
      bf4: {
        plans: [
          T('Against Bf4 play ...O-O and ...c5: hitting the centre at once is the most reliable answer.', 'Bf4 के ख़िलाफ़ ...O-O और ...c5 खेलो: तुरंत centre पर वार सबसे भरोसेमंद जवाब है।', 'Bf4 विरुद्ध ...O-O आणि ...c5 खेळ: लगेच centre वर वार हे सर्वात विश्वासार्ह उत्तर आहे.'),
          T('Keep the queen side flexible: ...Nc6 and ...dxc4 follow naturally.', 'Queenside को flexible रखो: ...Nc6 और ...dxc4 स्वाभाविक रूप से आते हैं।', 'Queenside flexible ठेव: ...Nc6 आणि ...dxc4 नैसर्गिकपणे येतात.'),
        ],
      },
      other: {
        plans: [
          T('Against everything else the QGD plan holds: ...Nf6, ...Be7, castle, and ...c5 or ...e5 to free the game.', 'बाकी सब के ख़िलाफ़ QGD plan टिकता है: ...Nf6, ...Be7, castle, और game खोलने के लिए ...c5 या ...e5।', 'बाकी सगळ्याविरुद्ध QGD plan टिकतो: ...Nf6, ...Be7, castle, आणि game मोकळा करण्यासाठी ...c5 किंवा ...e5.'),
          T('Never forget the c8 bishop: plan its development before the middlegame begins.', 'c8 bishop को कभी मत भूलो: middlegame शुरू होने से पहले उसके development की योजना बनाओ।', 'c8 bishop ला कधीच विसरू नकोस: middlegame सुरू होण्याआधी त्याच्या development ची योजना कर.'),
        ],
      },
    },
  },
};
