// The features that get a 15–20 second "what it is and how to use it" video, in English,
// Hindi and Marathi (chess words stay in English; Hindi and Marathi are everyday speech).
// Each feature: the page to record, a scenario (what the recording does on the page, step
// by step, each step shown while one sentence of the narration plays), the narration per
// language (three sentences: what it is, how to use it, why), and the social-media copy
// (title, description, hashtags per language; used off-site, never shown on the site).
export const FEATURES = [
  {
    id: 'fide-play',
    name: 'Play at FIDE level',
    match: /^\/play(\/fide)?$/,
    path: '/play/fide?r=1500&tc=2&c=white',
    steps: [{ wait: 1500 }, { move: ['e2', 'e4'] }, { wait: 2500 }],
    say: {
      en: ['Play at FIDE level: opponents from 1400 to 2800 that play like real players of that rating.', 'Pick a rating and a time control, play your move, and the opponent answers within seconds.', 'Every finished game changes your CC Rating, like FIDE does.'],
      hi: ['Play at FIDE level: 1400 से 2800 तक के opponents, जो उसी rating के असली players की तरह खेलते हैं।', 'Rating और time control चुनो, अपनी move खेलो, और opponent कुछ ही seconds में जवाब देता है।', 'हर पूरा हुआ game आपकी CC Rating बदलता है, बिल्कुल FIDE की तरह।'],
      mr: ['Play at FIDE level: 1400 ते 2800 पर्यंतचे opponents, जे त्या rating च्या खऱ्या players सारखे खेळतात.', 'Rating आणि time control निवडा, तुमची move खेळा, आणि opponent काही seconds मध्ये उत्तर देतो.', 'प्रत्येक पूर्ण झालेला game तुमची CC Rating बदलतो, अगदी FIDE सारखा.'],
    },
    social: {
      en: { title: 'Play against FIDE-level opponents, 1400 to 2800', description: 'On Chess Castles you choose the rating you want to face. The opponent plays like a real player of that level, every game is rated, and your CC Rating moves the way a FIDE rating does.' },
      hi: { title: '1400 से 2800 तक, FIDE level के opponents से खेलो', description: 'Chess Castles पर आप वह rating चुनते हैं जिससे खेलना है। Opponent उसी level के असली player की तरह खेलता है, हर game rated है, और आपकी CC Rating FIDE rating की तरह बदलती है।' },
      mr: { title: '1400 ते 2800, FIDE level च्या opponents विरुद्ध खेळा', description: 'Chess Castles वर तुम्ही कोणत्या rating विरुद्ध खेळायचे ते निवडता. Opponent त्या level च्या खऱ्या player सारखा खेळतो, प्रत्येक game rated आहे, आणि तुमची CC Rating FIDE rating सारखी बदलते.' },
      hashtags: ['#ChessCastles', '#chess', '#FIDE', '#chessrating', '#learnchess', '#chessforkids', '#chessindia'],
    },
  },
  {
    id: 'review',
    name: 'Game Report',
    match: /^\/analysis/,
    // The practice account's shortest game, reviewed on camera (a short game's review takes about ten seconds).
    path: '/analysis?game=LAST&review',
    pre: [{ waitFor: 'button:has-text("Report")', timeout: 40000 }, { wait: 800 }],
    steps: [{ wait: 2500 }, { click: 'button:has-text("Report")' }, { wait: 3500 }, { click: '.panel-nav [aria-label="Next move"]' }, { wait: 1200 }, { click: '.panel-nav [aria-label="Next move"]' }, { wait: 1200 }, { click: '.panel-nav [aria-label="Next move"]' }, { wait: 1200 }],
    say: {
      en: ['Game Report: after every game, each move gets a badge, from brilliant to blunder.', 'Open Analyse, press Report, and the turning point shows the one move that decided the game.', 'Step through the moves and see what you should have played.'],
      hi: ['Game Report: हर game के बाद हर move को एक badge मिलता है, brilliant से blunder तक।', 'Analyse खोलो, Report दबाओ, और turning point वह एक move दिखाता है जिसने game का फैसला किया।', 'Moves में आगे-पीछे जाओ और देखो कि आपको क्या खेलना चाहिए था।'],
      mr: ['Game Report: प्रत्येक game नंतर प्रत्येक move ला एक badge मिळतो, brilliant पासून blunder पर्यंत.', 'Analyse उघडा, Report दाबा, आणि turning point ती एक move दाखवतो जिने game चा निर्णय केला.', 'Moves मधून पुढे-मागे जा आणि बघा तुम्ही काय खेळायला हवे होते.'],
    },
    social: {
      en: { title: 'Find the one move that lost your game', description: 'Chess Castles’ Game Report marks every move and names the turning point of the game, so you know exactly what to work on next.' },
      hi: { title: 'वह एक move ढूँढो जिसने आपका game हराया', description: 'Chess Castles का Game Report हर move पर निशान लगाता है और game का turning point बताता है, ताकि आपको पता हो अगला काम क्या है।' },
      mr: { title: 'ती एक move शोधा जिने तुमचा game हरवला', description: 'Chess Castles चे Game Report प्रत्येक move ला खूण करते आणि game चा turning point सांगते, म्हणजे पुढे काय काम करायचे ते तुम्हाला कळते.' },
      hashtags: ['#ChessCastles', '#chessanalysis', '#chessimprovement', '#learnchess', '#chesscoach', '#chessindia'],
    },
  },
  {
    id: 'puzzles',
    name: 'Puzzles',
    match: /^\/puzzles$/,
    path: '/puzzles',
    steps: [{ wait: 2500 }, { solve: true }, { wait: 2000 }],
    say: {
      en: ['Puzzles: a rating road map from Pawn to King, with puzzles that get harder as you climb.', 'Find the best move; your first try counts for your rating.', 'By theme, your own mistakes, or blindfold: pick the training you need.'],
      hi: ['Puzzles: Pawn से King तक का rating road map, और जैसे-जैसे ऊपर चढ़ो, puzzles कठिन होते जाते हैं।', 'सबसे अच्छी move ढूँढो; आपकी पहली कोशिश rating के लिए गिनी जाती है।', 'Theme के हिसाब से, अपनी गलतियों से, या blindfold: जो training चाहिए वह चुनो।'],
      mr: ['Puzzles: Pawn पासून King पर्यंतचा rating road map, आणि जसे वर चढाल तसे puzzles कठीण होत जातात.', 'सगळ्यात चांगली move शोधा; तुमचा पहिला प्रयत्न rating साठी मोजला जातो.', 'Theme नुसार, स्वतःच्या चुकांमधून, किंवा blindfold: जी training हवी ती निवडा.'],
    },
    social: {
      en: { title: 'Puzzles with a road map: Pawn to King', description: 'Rated puzzles on Chess Castles get harder as your rating rises, with themes, your own mistakes and blindfold puzzles. Free.' },
      hi: { title: 'Road map वाले puzzles: Pawn से King तक', description: 'Chess Castles के rated puzzles आपकी rating के साथ कठिन होते जाते हैं; themes, अपनी गलतियाँ और blindfold puzzles भी। मुफ़्त।' },
      mr: { title: 'Road map असलेले puzzles: Pawn ते King', description: 'Chess Castles चे rated puzzles तुमच्या rating सोबत कठीण होत जातात; themes, स्वतःच्या चुका आणि blindfold puzzles सुद्धा. मोफत.' },
      hashtags: ['#ChessCastles', '#chesspuzzles', '#tactics', '#chesstraining', '#learnchess', '#chessindia'],
    },
  },
  {
    id: 'courses',
    name: 'Opening courses',
    match: /^\/learn\/study/,
    path: '/learn/study/caro-kann',
    steps: [{ wait: 2500 }, { click: '.lines .chip >> nth=1' }, { wait: 2000 }, { click: 'button:has-text("Model games")' }, { wait: 2500 }],
    say: {
      en: ['Opening courses: the Caro-Kann, the Jobava London and the Chebanenko Slav, built from real games.', 'Choose a line, read the plan, watch a model game, then learn it in the trainer.', 'Play it against a FIDE-level opponent straight from the line.'],
      hi: ['Opening courses: Caro-Kann, Jobava London और Chebanenko Slav, असली games से बने।', 'एक line चुनो, plan पढ़ो, model game देखो, फिर trainer में उसे सीखो।', 'फिर उसी line से FIDE level के opponent के खिलाफ खेलो।'],
      mr: ['Opening courses: Caro-Kann, Jobava London आणि Chebanenko Slav, खऱ्या games मधून बनलेले.', 'एक line निवडा, plan वाचा, model game बघा, मग trainer मध्ये ती शिका.', 'मग त्याच line मधून FIDE level च्या opponent विरुद्ध खेळा.'],
    },
    social: {
      en: { title: 'Learn an opening the whole way: lines, plans, model games, trainer', description: 'Chess Castles’ opening courses take one opening from the first move to the middlegame plan, with model games from strong players and a trainer built from real games.' },
      hi: { title: 'एक opening पूरी तरह सीखो: lines, plans, model games, trainer', description: 'Chess Castles के opening courses एक opening को पहली move से middlegame plan तक ले जाते हैं, strong players के model games और असली games से बने trainer के साथ।' },
      mr: { title: 'एक opening पूर्णपणे शिका: lines, plans, model games, trainer', description: 'Chess Castles चे opening courses एक opening पहिल्या move पासून middlegame plan पर्यंत नेतात, strong players च्या model games आणि खऱ्या games मधून बनलेल्या trainer सह.' },
      hashtags: ['#ChessCastles', '#chessopenings', '#CaroKann', '#JobavaLondon', '#learnchess', '#chessindia'],
    },
  },
  {
    id: 'trainer',
    name: 'Opening trainer',
    match: /^\/learn\/openings/,
    path: '/learn/openings/italian',
    steps: [{ wait: 2000 }, { click: 'button:has-text("Build and start training")', optional: true }, { wait: 3500 }],
    say: {
      en: ['The opening trainer: 28 openings, built from 5.4 million real games.', 'You play your side; the trainer tells you at once when a move is not the line.', 'Lines come back until you know them by heart.'],
      hi: ['Opening trainer: 28 openings, 5.4 million असली games से बनीं।', 'आप अपनी side खेलते हैं; जो move line में नहीं है, trainer तुरंत बताता है।', 'Lines तब तक लौटती हैं जब तक वे याद न हो जाएँ।'],
      mr: ['Opening trainer: 28 openings, 5.4 million खऱ्या games मधून बनलेल्या.', 'तुम्ही तुमची side खेळता; जी move line मध्ये नाही ती trainer लगेच सांगतो.', 'Lines पाठ होईपर्यंत परत परत येतात.'],
    },
    social: {
      en: { title: '28 openings, learned by playing them', description: 'Chess Castles’ AI opening trainer builds each opening from millions of real games and brings lines back until you know them.' },
      hi: { title: '28 openings, खेल-खेल में सीखो', description: 'Chess Castles का AI opening trainer हर opening को लाखों असली games से बनाता है और lines तब तक लौटाता है जब तक आप उन्हें जान न लो।' },
      mr: { title: '28 openings, खेळत खेळत शिका', description: 'Chess Castles चा AI opening trainer प्रत्येक opening लाखो खऱ्या games मधून बनवतो आणि lines तुम्हाला येईपर्यंत परत आणतो.' },
      hashtags: ['#ChessCastles', '#chessopenings', '#openingtrainer', '#learnchess', '#chesstraining', '#chessindia'],
    },
  },
  {
    id: 'guru',
    name: 'Chess Guru',
    match: /^\/coach/,
    path: '/coach/opening-principles',
    steps: [{ wait: 2500 }, { click: 'button:has-text("Next")' }, { wait: 2500 }, { click: 'button:has-text("Next")' }, { wait: 2000 }],
    say: {
      en: ['Chess Guru: lessons in English, Hindi and Marathi, from the first rules to grandmaster openings.', 'Each lesson is a few slides with a board, and ends with practice on it.', 'Guru also reviews your own games and tells the turning point as a story.'],
      hi: ['Chess Guru: English, हिन्दी और मराठी में lessons, पहले rules से grandmaster openings तक।', 'हर lesson board के साथ कुछ slides है, और board पर practice के साथ खत्म होता है।', 'Guru आपके अपने games का review भी करता है और turning point कहानी की तरह बताता है।'],
      mr: ['Chess Guru: English, हिन्दी आणि मराठीत lessons, पहिल्या rules पासून grandmaster openings पर्यंत.', 'प्रत्येक lesson board सह काही slides आहे, आणि board वर practice ने संपतो.', 'Guru तुमच्या स्वतःच्या games चा review सुद्धा करतो आणि turning point गोष्टीसारखा सांगतो.'],
    },
    social: {
      en: { title: 'A chess coach that speaks your language', description: 'Chess Guru on Chess Castles teaches in English, Hindi and Marathi, with a board on every slide and a review of your own games.' },
      hi: { title: 'एक chess coach जो आपकी भाषा बोलता है', description: 'Chess Castles का Chess Guru English, हिन्दी और मराठी में सिखाता है, हर slide पर board और आपके अपने games का review।' },
      mr: { title: 'तुमच्या भाषेत बोलणारा chess coach', description: 'Chess Castles चा Chess Guru English, हिन्दी आणि मराठीत शिकवतो, प्रत्येक slide वर board आणि तुमच्या स्वतःच्या games चा review.' },
      hashtags: ['#ChessCastles', '#ChessGuru', '#chesscoach', '#learnchess', '#chessinhindi', '#chessinmarathi', '#chessindia'],
    },
  },
  {
    id: 'database',
    name: '5 Million game database',
    match: /^\/analysis\?tab=database/,
    path: '/analysis?tab=database',
    steps: [{ wait: 2500 }, { move: ['e2', 'e4'] }, { wait: 2000 }, { move: ['c7', 'c5'] }, { wait: 2500 }],
    say: {
      en: ['The database: 5.4 million rated games, from club players to world champions.', 'Play moves on the board and see how often each reply was played, and how it scored.', 'Open a reference game from the position and learn from the strongest players.'],
      hi: ['Database: 5.4 million rated games, club players से world champions तक।', 'Board पर moves खेलो और देखो हर जवाब कितनी बार खेला गया, और कैसा score रहा।', 'उस position से एक reference game खोलो और सबसे strong players से सीखो।'],
      mr: ['Database: 5.4 million rated games, club players पासून world champions पर्यंत.', 'Board वर moves खेळा आणि बघा प्रत्येक उत्तर किती वेळा खेळले गेले, आणि score कसा होता.', 'त्या position मधून एक reference game उघडा आणि सगळ्यात strong players कडून शिका.'],
    },
    social: {
      en: { title: '5.4 million real games at your fingertips', description: 'Chess Castles’ game database shows what strong players play in any position, how often, and how it scores, with reference games to open.' },
      hi: { title: '5.4 million असली games आपकी उँगलियों पर', description: 'Chess Castles का game database किसी भी position में दिखाता है कि strong players क्या खेलते हैं, कितनी बार, और score कैसा रहता है; reference games भी।' },
      mr: { title: '5.4 million खरे games तुमच्या बोटांवर', description: 'Chess Castles चा game database कोणत्याही position मध्ये strong players काय खेळतात, किती वेळा, आणि score कसा राहतो ते दाखवतो; reference games सुद्धा.' },
      hashtags: ['#ChessCastles', '#chessdatabase', '#chessopenings', '#chessanalysis', '#learnchess', '#chessindia'],
    },
  },
  {
    id: 'masters',
    name: 'Endgames with the masters',
    match: /^\/learn\/masters/,
    path: '/learn/masters',
    steps: [{ wait: 2500 }, { click: '.t-card >> nth=0' }, { wait: 2500 }, { click: '.l-card >> nth=0' }, { wait: 3000 }],
    say: {
      en: ['Endgames with the masters: real endgames from the games of Gukesh, Anand, Carlsen and more.', 'Pick a master and a game; at each move, find what the master played.', 'Hints when you need them, and the whole line to replay.'],
      hi: ['Endgames with the masters: Gukesh, Anand, Carlsen और दूसरों के games के असली endgames।', 'एक master और एक game चुनो; हर move पर ढूँढो कि master ने क्या खेला।', 'ज़रूरत हो तो hint, और पूरी line दोबारा देखने के लिए।'],
      mr: ['Endgames with the masters: Gukesh, Anand, Carlsen आणि इतरांच्या games मधले खरे endgames.', 'एक master आणि एक game निवडा; प्रत्येक move ला शोधा master ने काय खेळले.', 'गरज असेल तर hint, आणि पूर्ण line पुन्हा पाहण्यासाठी.'],
    },
    social: {
      en: { title: 'Learn endgames from the masters’ own games', description: 'On Chess Castles you replay real endgames by Gukesh, Anand and other masters, finding their moves one by one.' },
      hi: { title: 'Masters के अपने games से endgames सीखो', description: 'Chess Castles पर आप Gukesh, Anand और दूसरे masters के असली endgames खेलते हैं, एक-एक करके उनकी moves ढूँढते हुए।' },
      mr: { title: 'Masters च्या स्वतःच्या games मधून endgames शिका', description: 'Chess Castles वर तुम्ही Gukesh, Anand आणि इतर masters चे खरे endgames खेळता, एकेक करून त्यांच्या moves शोधत.' },
      hashtags: ['#ChessCastles', '#endgames', '#Gukesh', '#Anand', '#learnchess', '#chessindia'],
    },
  },
  {
    id: 'blindfold',
    name: 'Blindfold Gym',
    match: /^\/vision/,
    path: '/vision',
    steps: [{ wait: 2500 }, { click: 'a[href="/vision/blind"]', optional: true }, { wait: 3500 }],
    say: {
      en: ['Blindfold Gym: train to see the board in your head, like strong players do.', 'Blindfold puzzles in notation, a square-naming sprint and move memory.', 'A Vision rating and a leaderboard of your own.'],
      hi: ['Blindfold Gym: board को दिमाग़ में देखना सीखो, जैसे strong players करते हैं।', 'Notation में blindfold puzzles, squares नाम देने की sprint, और move memory।', 'अपनी Vision rating और अपना leaderboard।'],
      mr: ['Blindfold Gym: board डोक्यात पाहायला शिका, strong players करतात तसे.', 'Notation मधले blindfold puzzles, squares ची नावे सांगण्याची sprint, आणि move memory.', 'स्वतःची Vision rating आणि स्वतःचा leaderboard.'],
    },
    social: {
      en: { title: 'See the board in your head', description: 'The Blindfold Gym on Chess Castles trains visualisation with blindfold puzzles, a square sprint and move memory, with its own rating.' },
      hi: { title: 'Board को दिमाग़ में देखो', description: 'Chess Castles का Blindfold Gym blindfold puzzles, square sprint और move memory से visualisation सिखाता है, अपनी rating के साथ।' },
      mr: { title: 'Board डोक्यात पाहा', description: 'Chess Castles चे Blindfold Gym blindfold puzzles, square sprint आणि move memory ने visualisation शिकवते, स्वतःच्या rating सह.' },
      hashtags: ['#ChessCastles', '#blindfoldchess', '#visualisation', '#chesstraining', '#learnchess', '#chessindia'],
    },
  },
  {
    id: 'watch',
    name: 'Watch',
    match: /^\/watch/,
    path: '/watch',
    steps: [{ wait: 2500 }, { click: 'a:has-text("Watch all boards")', optional: true }, { wait: 3500 }],
    say: {
      en: ['Watch: live tournaments from around the world, every board, with the clocks.', 'Open a game, step through the moves, and switch on the engine and the database.', 'Try your own moves on the board; only you see them.'],
      hi: ['Watch: दुनिया भर के live tournaments, हर board, clocks के साथ।', 'एक game खोलो, moves में आगे-पीछे जाओ, और engine और database चालू करो।', 'Board पर अपनी moves आज़माओ; उन्हें सिर्फ आप देखते हैं।'],
      mr: ['Watch: जगभरातले live tournaments, प्रत्येक board, clocks सह.', 'एक game उघडा, moves मधून पुढे-मागे जा, आणि engine आणि database चालू करा.', 'Board वर स्वतःच्या moves करून बघा; त्या फक्त तुम्हाला दिसतात.'],
    },
    social: {
      en: { title: 'Watch live tournaments with the engine on', description: 'Every board of the world’s tournaments, live on Chess Castles, with moves, clocks, the engine and the 5.4 million game database.' },
      hi: { title: 'Engine चालू रखकर live tournaments देखो', description: 'दुनिया के tournaments का हर board, Chess Castles पर live, moves, clocks, engine और 5.4 million games के database के साथ।' },
      mr: { title: 'Engine चालू ठेवून live tournaments बघा', description: 'जगातल्या tournaments चा प्रत्येक board, Chess Castles वर live, moves, clocks, engine आणि 5.4 million games च्या database सह.' },
      hashtags: ['#ChessCastles', '#livechess', '#chesstournament', '#watchchess', '#chessindia'],
    },
  },
  {
    id: 'insights',
    name: 'Game Insights',
    match: /^\/insights/,
    path: '/insights',
    steps: [{ wait: 3500 }, { wait: 3000 }],
    say: {
      en: ['Game Insights: your chess.com or Lichess games, analysed into a report.', 'Enter your username; Guru finds what costs you the most points and plans your week.', 'Then fix it here: puzzles, lines and lessons for your own mistakes.'],
      hi: ['Game Insights: आपके chess.com या Lichess games, एक report में।', 'अपना username डालो; Guru ढूँढता है कि आपको सबसे ज़्यादा points कहाँ जाते हैं, और आपका हफ़्ता plan करता है।', 'फिर उसे यहीं ठीक करो: आपकी अपनी गलतियों के लिए puzzles, lines और lessons।'],
      mr: ['Game Insights: तुमचे chess.com किंवा Lichess games, एका report मध्ये.', 'तुमचे username टाका; Guru शोधतो तुमचे सगळ्यात जास्त points कुठे जातात, आणि तुमचा आठवडा plan करतो.', 'मग ते इथेच दुरुस्त करा: तुमच्या स्वतःच्या चुकांसाठी puzzles, lines आणि lessons.'],
    },
    social: {
      en: { title: 'Your chess.com games, turned into a plan', description: 'Game Insights on Chess Castles analyses your online games, shows what costs you points, and builds a week of training around it.' },
      hi: { title: 'आपके chess.com games, एक plan में', description: 'Chess Castles का Game Insights आपके online games analyse करता है, दिखाता है कि points कहाँ जाते हैं, और उसके चारों ओर हफ़्ते की training बनाता है।' },
      mr: { title: 'तुमचे chess.com games, एका plan मध्ये', description: 'Chess Castles चे Game Insights तुमचे online games analyse करते, points कुठे जातात ते दाखवते, आणि त्याभोवती आठवड्याची training बनवते.' },
      hashtags: ['#ChessCastles', '#chessinsights', '#chesscom', '#lichess', '#chessimprovement', '#chessindia'],
    },
  },
  {
    id: 'books',
    name: 'Library',
    match: /^\/books/,
    path: '/books',
    steps: [{ wait: 2500 }, { click: 'a[href^="/books/"] >> nth=0' }, { wait: 3500 }],
    say: {
      en: ['The library: classic chess books, free, with every diagram drawn as a board.', 'Open a book, read a chapter, or let it read to you.', 'Your place is kept, and chapters count on the leaderboard.'],
      hi: ['Library: classic chess books, मुफ़्त, हर diagram board के रूप में।', 'एक किताब खोलो, chapter पढ़ो, या उसे सुनो।', 'आपकी जगह याद रहती है, और chapters leaderboard पर गिने जाते हैं।'],
      mr: ['Library: classic chess books, मोफत, प्रत्येक diagram board म्हणून.', 'एक पुस्तक उघडा, chapter वाचा, किंवा ते ऐका.', 'तुमची जागा लक्षात राहते, आणि chapters leaderboard वर मोजले जातात.'],
    },
    social: {
      en: { title: 'Classic chess books, free, read aloud', description: 'Capablanca and other classics in the Chess Castles library, with boards for every diagram and read-aloud chapters.' },
      hi: { title: 'Classic chess books, मुफ़्त, सुनाई भी जाती हैं', description: 'Capablanca और दूसरे classics Chess Castles की library में, हर diagram के लिए board और सुनने लायक chapters के साथ।' },
      mr: { title: 'Classic chess books, मोफत, ऐकता पण येतात', description: 'Capablanca आणि इतर classics Chess Castles च्या library मध्ये, प्रत्येक diagram साठी board आणि ऐकण्याजोगे chapters सह.' },
      hashtags: ['#ChessCastles', '#chessbooks', '#Capablanca', '#learnchess', '#audiobooks', '#chessindia'],
    },
  },
];

export const LANGS = ['en', 'hi', 'mr'];
export const VOICES = { en: 'en-IN-NeerjaNeural', hi: 'hi-IN-SwaraNeural', mr: 'mr-IN-AarohiNeural' };
