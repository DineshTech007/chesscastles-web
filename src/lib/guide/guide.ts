import type { Lang } from '$lib/coach/i18n';

/**
 * The Chess Guide: plain answers for parents and beginners about FIDE ratings, tournaments and the rules,
 * in English, Hindi and Marathi (chess words stay in English; Hindi and Marathi are everyday spoken
 * language). The guide's chat finds the closest answers by their words and never makes anything up.
 * Rules are those of the FIDE Handbook as understood in October 2026: check a tournament's own
 * regulations for its details.
 */
export type L3<T = string> = Record<Lang, T>;

export type Topic = 'rating' | 'tournament' | 'parents';

export const TOPIC_NAME: Record<Topic, L3> = {
  rating: { en: 'Ratings and titles', hi: 'Rating और titles', mr: 'Rating आणि titles' },
  tournament: { en: 'Tournaments and rules', hi: 'Tournaments और rules', mr: 'Tournaments आणि rules' },
  parents: { en: 'For parents', hi: 'Parents के लिए', mr: 'पालकांसाठी' },
};

export interface GuideItem {
  id: string;
  topic: Topic;
  q: L3;
  /** The answer, in short paragraphs. */
  a: L3<string[]>;
  /** Words (any language) people use when they mean this. */
  words: string[];
  link?: { href: string; label: L3 };
}

export const GUIDE: GuideItem[] = [
  {
    id: 'what-fide',
    topic: 'rating',
    q: { en: 'What is FIDE?', hi: 'FIDE क्या है?', mr: 'FIDE म्हणजे काय?' },
    a: {
      en: [
        'FIDE (Fédération Internationale des Échecs, the World Chess Federation) runs international chess. It holds the World Championship and the Chess Olympiad, makes the official rules, gives titles like Grandmaster, and keeps the official rating list.',
        'Every country has its own federation under FIDE. In India it is the All India Chess Federation (AICF), and each state has an association. A tournament is "FIDE-rated" when its results are sent to FIDE and count for players’ official ratings.',
      ],
      hi: [
        'FIDE (Fédération Internationale des Échecs, यानी World Chess Federation) पूरी दुनिया का chess चलाती है। World Championship और Chess Olympiad यही कराती है, official rules बनाती है, Grandmaster जैसे titles देती है और official rating list रखती है।',
        'हर देश की अपनी federation होती है। भारत में यह All India Chess Federation (AICF) है, और हर state की अपनी association है। जब किसी tournament के results FIDE को भेजे जाते हैं और players की official rating पर असर डालते हैं, तब उसे "FIDE-rated" कहते हैं।',
      ],
      mr: [
        'FIDE (Fédération Internationale des Échecs, म्हणजे World Chess Federation) संपूर्ण जगातलं chess चालवते. World Championship आणि Chess Olympiad तीच भरवते, official rules बनवते, Grandmaster सारखे titles देते आणि official rating list ठेवते.',
        'प्रत्येक देशाची स्वतःची federation असते. भारतात ती All India Chess Federation (AICF) आहे, आणि प्रत्येक राज्याची एक association असते. एखाद्या tournament चे results FIDE ला पाठवले जातात आणि players च्या official rating वर परिणाम करतात, तेव्हा त्याला "FIDE-rated" म्हणतात.',
      ],
    },
    words: ['fide', 'federation', 'aicf', 'world chess', 'olympiad', 'official', 'फिडे', 'फाइड', 'संघ', 'महासंघ'],
  },
  {
    id: 'what-rating',
    topic: 'rating',
    q: { en: 'What is a chess rating?', hi: 'Chess rating क्या होती है?', mr: 'Chess rating म्हणजे काय?' },
    a: {
      en: [
        'A rating is a number that shows how strong a player is. It goes up when you beat players who are rated close to you or higher, and down when you lose to them. Beating a much stronger player gives many points; losing to a much weaker one costs many.',
        'Ratings are not marks or a ranking of people. They are only a way to guess the result of a game: a player rated 200 points higher is expected to win about three games out of four.',
      ],
      hi: [
        'Rating एक number होता है जो बताता है कि player कितना strong है। अपने बराबर या ज़्यादा rating वाले player को हराने पर rating बढ़ती है, और उनसे हारने पर घटती है। बहुत strong player को हराने पर बहुत points मिलते हैं, और बहुत कमज़ोर से हारने पर बहुत कटते हैं।',
        'Rating कोई marks या लोगों की rank नहीं है। यह सिर्फ़ game का result अंदाज़ने का तरीका है: 200 points ज़्यादा rating वाला player लगभग चार में से तीन games जीतता है।',
      ],
      mr: [
        'Rating हा एक number असतो, जो player किती strong आहे ते सांगतो. स्वतःच्या बरोबरीच्या किंवा जास्त rating च्या player ला हरवलं की rating वाढते, आणि त्यांच्याकडून हरलं की कमी होते. खूप strong player ला हरवलं तर भरपूर points मिळतात, आणि खूप कमकुवत player कडून हरलं तर भरपूर जातात.',
        'Rating म्हणजे marks किंवा माणसांची rank नाही. game चा निकाल काय लागेल याचा तो फक्त अंदाज असतो: 200 points जास्त rating चा player चार पैकी साधारण तीन games जिंकतो.',
      ],
    },
    words: ['rating', 'elo', 'strength', 'points', 'number', 'रेटिंग'],
  },
  {
    id: 'first-rating',
    topic: 'rating',
    q: { en: 'How does a player get a FIDE rating?', hi: 'FIDE rating कैसे मिलती है?', mr: 'FIDE rating कशी मिळते?' },
    a: {
      en: [
        'First you need a FIDE ID. Your state association or the AICF registers you when you play in a FIDE-rated tournament, and the tournament organiser can help. Then you play in FIDE-rated tournaments, where some or all of your opponents already have FIDE ratings.',
        'FIDE gives you a first rating once you have played at least 5 games against rated opponents (games from several tournaments can be added together) and scored at least 1 point in them. The rating must also come out at the FIDE minimum, which is 1400 since March 2024. The new rating appears on the next monthly list, published on the 1st of each month.',
        'Winning games against rated players is what matters. Players who only meet unrated children in a tournament cannot get a rating from those games.',
      ],
      hi: [
        'पहले आपको FIDE ID चाहिए। जब आप FIDE-rated tournament खेलते हैं तो आपकी state association या AICF आपको register करती है, और tournament organiser इसमें मदद करते हैं। फिर आप FIDE-rated tournaments खेलते हैं, जहाँ आपके कुछ या सारे opponents की FIDE rating पहले से होती है।',
        'जब आप rated opponents के ख़िलाफ़ कम से कम 5 games खेल लेते हैं (कई tournaments के games जोड़े जा सकते हैं) और उनमें कम से कम 1 point बना लेते हैं, तब FIDE आपको पहली rating देती है। Rating FIDE के minimum पर भी आनी चाहिए, जो मार्च 2024 से 1400 है। नई rating अगली monthly list में आती है, जो हर महीने की 1 तारीख़ को निकलती है।',
        'असली बात है rated players के ख़िलाफ़ जीतना। जो बच्चे सिर्फ़ unrated बच्चों से खेलते हैं, उन games से rating नहीं बनती।',
      ],
      mr: [
        'आधी तुम्हाला FIDE ID लागते. FIDE-rated tournament खेळताना तुमची state association किंवा AICF तुम्हाला register करते, आणि tournament organiser त्यात मदत करतात. मग तुम्ही FIDE-rated tournaments खेळता, जिथे तुमच्या काही किंवा सगळ्या opponents ची FIDE rating आधीपासून असते.',
        'rated opponents विरुद्ध किमान 5 games खेळल्या (अनेक tournaments च्या games मिळून चालतात) आणि त्यात किमान 1 point मिळवला की FIDE तुम्हाला पहिली rating देते. rating FIDE च्या minimum वर यायला हवी, जी मार्च 2024 पासून 1400 आहे. नवी rating पुढच्या monthly list मध्ये येते, जी दर महिन्याच्या 1 तारखेला निघते.',
        'महत्त्वाचं म्हणजे rated players विरुद्ध खेळणं आणि जिंकणं. फक्त unrated मुलांशी खेळून त्या games मधून rating मिळत नाही.',
      ],
    },
    words: ['first rating', 'fide id', 'get rating', 'register', 'unrated', 'initial', 'new player', 'पहली', 'पहिली', 'मिलती', 'मिळते', 'मिळवायची', 'id'],
    link: { href: '/community', label: { en: 'See FIDE tournaments in India', hi: 'भारत के FIDE tournaments देखें', mr: 'भारतातले FIDE tournaments बघा' } },
  },
  {
    id: 'calc',
    topic: 'rating',
    q: { en: 'How is a FIDE rating calculated?', hi: 'FIDE rating कैसे calculate होती है?', mr: 'FIDE rating कशी calculate होते?' },
    a: {
      en: [
        'FIDE first works out the score you were expected to make against each opponent from the rating difference. The bigger your rating compared with theirs, the closer to 1 point you are expected to score. A difference of more than 400 points is counted as 400.',
        'Then: rating change = K × (your actual score − expected score). K is 40 for a new player (until 30 rated games) and for a player under 18 whose rating is below 2300; 20 for other players below 2400; and 10 once the rating has reached 2400.',
        'Example: you are rated 1600 and beat someone rated 1800. You were expected to score about 0.24, so you gain 20 × (1 − 0.24) = about +15. If you lose to a player rated 1400 you were expected to beat (expected about 0.76), you lose 20 × (0 − 0.76) = about −15. A draw against a player 200 points higher gains about +5.',
        'FIDE adds up the whole tournament and publishes the new rating on the first of the next month. Standard (Classical), Rapid and Blitz each have their own rating.',
      ],
      hi: [
        'FIDE पहले rating के फ़र्क़ से यह निकालती है कि हर opponent के ख़िलाफ़ आपसे कितना score करने की उम्मीद थी। आपकी rating उनसे जितनी ज़्यादा, उतना 1 point के क़रीब score करने की उम्मीद। 400 points से ज़्यादा फ़र्क़ हो तो उसे 400 ही गिना जाता है।',
        'फिर: rating change = K × (आपका असली score − expected score)। K नए player के लिए 40 है (30 rated games तक) और 18 साल से कम उम्र के उस player के लिए भी जिसकी rating 2300 से नीचे है; बाक़ी जिनकी rating 2400 से नीचे है उनके लिए 20; और rating 2400 छूने के बाद 10।',
        'Example: आपकी rating 1600 है और आपने 1800 वाले को हरा दिया। आपसे लगभग 0.24 score की उम्मीद थी, इसलिए आपको 20 × (1 − 0.24) = लगभग +15 मिलते हैं। अगर आप 1400 वाले से हार जाएँ जिसे आपको हराना था (उम्मीद लगभग 0.76), तो 20 × (0 − 0.76) = लगभग −15 कटते हैं। 200 points ज़्यादा rating वाले से draw करने पर लगभग +5 मिलते हैं।',
        'FIDE पूरे tournament का हिसाब जोड़ती है और नई rating अगले महीने की पहली तारीख़ को छापती है। Standard (Classical), Rapid और Blitz, तीनों की अपनी-अपनी rating होती है।',
      ],
      mr: [
        'FIDE आधी rating मधल्या फरकावरून प्रत्येक opponent विरुद्ध तुम्ही किती score करणं अपेक्षित होतं ते काढते. तुमची rating त्यांच्यापेक्षा जितकी जास्त, तितकं 1 point च्या जवळ score करणं अपेक्षित. 400 points पेक्षा जास्त फरक असेल तर तो 400 च मानला जातो.',
        'मग: rating change = K × (तुमचा खरा score − expected score). K नव्या player साठी 40 असतो (30 rated games पर्यंत) आणि 18 वर्षांखालील ज्याची rating 2300 च्या खाली आहे अशा player साठीही; बाकी 2400 च्या खाली असलेल्यांसाठी 20; आणि rating 2400 ला पोहोचली की 10.',
        'Example: तुमची rating 1600 आहे आणि तुम्ही 1800 च्या player ला हरवलं. तुमच्याकडून साधारण 0.24 score अपेक्षित होता, म्हणून तुम्हाला 20 × (1 − 0.24) = साधारण +15 मिळतात. 1400 च्या ज्याला तुम्ही हरवायला हवं होतं (अपेक्षा साधारण 0.76) त्याच्याकडून हरलात तर 20 × (0 − 0.76) = साधारण −15 जातात. 200 points जास्त rating च्या player शी draw केला तर साधारण +5 मिळतात.',
        'FIDE पूर्ण tournament चा हिशोब करते आणि नवी rating पुढच्या महिन्याच्या 1 तारखेला प्रसिद्ध करते. Standard (Classical), Rapid आणि Blitz, तिन्हींची स्वतःची वेगळी rating असते.',
      ],
    },
    words: ['calculate', 'calculated', 'calculation', 'formula', 'k factor', 'expected', 'change', 'gain', 'lose points', 'how rating', 'elo', 'गणना', 'हिसाब', 'हिशोब', 'फॉर्मूला', 'k', 'वाढते', 'कमी'],
  },
  {
    id: 'k-jump',
    topic: 'rating',
    q: { en: 'Why does my child’s rating jump up and down so much?', hi: 'मेरे बच्चे की rating इतनी ऊपर-नीचे क्यों होती है?', mr: 'माझ्या मुलाची rating इतकी वर-खाली का होते?' },
    a: {
      en: [
        'New and young players have a high K-factor (40), so each game moves the rating a lot: up to 40 points for one game. A new player’s first rating can also be based on only a few games, so it is a rough guess that settles after 20–30 rated games.',
        'The rating of a child who improves fast usually lags behind real strength. Do not worry about a single tournament: look at the rating after three or four tournaments.',
      ],
      hi: [
        'नए और छोटे players का K-factor ज़्यादा (40) होता है, इसलिए एक game से rating बहुत हिलती है: एक game में 40 points तक। नए player की पहली rating कुछ ही games पर बनी हो सकती है, इसलिए वह मोटा अंदाज़ा है जो 20–30 rated games के बाद टिकता है।',
        'जो बच्चा तेज़ी से सुधर रहा है उसकी rating अक्सर असली ताक़त से पीछे रहती है। एक tournament की चिंता मत कीजिए: तीन-चार tournaments के बाद की rating देखिए।',
      ],
      mr: [
        'नव्या आणि लहान players चा K-factor जास्त (40) असतो, म्हणून एका game मुळे rating खूप हलते: एका game मध्ये 40 points पर्यंत. नव्या player ची पहिली rating काही थोड्याच games वर ठरलेली असू शकते, म्हणून तो मोघम अंदाज असतो जो 20–30 rated games नंतर स्थिर होतो.',
        'जे मूल झपाट्याने सुधारत असतं त्याची rating बऱ्याचदा खऱ्या ताकदीच्या मागे असते. एका tournament ची चिंता करू नका: तीन-चार tournaments नंतरची rating बघा.',
      ],
    },
    words: ['jump', 'up and down', 'drop', 'dropped', 'fluctuate', 'child rating', 'unstable', 'k factor', 'ऊपर', 'नीचे', 'घटती', 'बढ़ती'],
  },
  {
    id: 'three-ratings',
    topic: 'rating',
    q: { en: 'What are Classical, Rapid and Blitz ratings?', hi: 'Classical, Rapid और Blitz ratings क्या हैं?', mr: 'Classical, Rapid आणि Blitz ratings म्हणजे काय?' },
    a: {
      en: [
        'FIDE keeps three separate ratings, because fast and slow chess are different skills. A game counts only for the rating of its own speed.',
        'FIDE’s speeds: Blitz is 10 minutes or less per player (counting the increment as 60 moves); Rapid is more than 10 and up to 60 minutes; Classical (Standard) is more than 60 minutes. Examples: 3+2 is Blitz, 15+10 is Rapid, 90+30 is Classical.',
        'Chess Castles’ CC Rating uses the same speeds, so you can practise each of them.',
      ],
      hi: [
        'FIDE तीन अलग ratings रखती है, क्योंकि तेज़ और धीमा chess अलग skills हैं। एक game सिर्फ़ अपनी speed की rating पर असर डालती है।',
        'FIDE की speeds: Blitz यानी हर player को 10 minutes या कम (increment को 60 moves गिनकर); Rapid यानी 10 से ज़्यादा और 60 minutes तक; Classical (Standard) यानी 60 minutes से ज़्यादा। जैसे 3+2 Blitz है, 15+10 Rapid है, 90+30 Classical है।',
        'Chess Castles की CC Rating भी यही speeds इस्तेमाल करती है, ताकि आप हर एक की practice कर सकें।',
      ],
      mr: [
        'FIDE तीन वेगळ्या ratings ठेवते, कारण वेगवान आणि हळू chess ही वेगळी कौशल्यं आहेत. एक game फक्त स्वतःच्या speed च्या rating वर परिणाम करते.',
        'FIDE च्या speeds: Blitz म्हणजे प्रत्येक player ला 10 minutes किंवा कमी (increment 60 moves धरून); Rapid म्हणजे 10 पेक्षा जास्त आणि 60 minutes पर्यंत; Classical (Standard) म्हणजे 60 minutes पेक्षा जास्त. उदा. 3+2 Blitz आहे, 15+10 Rapid आहे, 90+30 Classical आहे.',
        'Chess Castles ची CC Rating सुद्धा हेच speeds वापरते, म्हणजे तुम्ही प्रत्येकाचा सराव करू शकता.',
      ],
    },
    words: ['classical', 'standard', 'rapid', 'blitz', 'bullet', 'time control', 'speed', 'three ratings', 'अलग', 'वेगळ्या', 'तीन'],
    link: { href: '/play?mode=fide', label: { en: 'Play at each speed', hi: 'हर speed पर खेलें', mr: 'प्रत्येक speed वर खेळा' } },
  },
  {
    id: 'titles',
    topic: 'rating',
    q: { en: 'What are CM, FM, IM and GM titles?', hi: 'CM, FM, IM और GM titles क्या हैं?', mr: 'CM, FM, IM आणि GM titles म्हणजे काय?' },
    a: {
      en: [
        'FIDE gives titles for reaching a rating: Candidate Master (CM) at 2200, FIDE Master (FM) at 2300, International Master (IM) at 2400 and Grandmaster (GM) at 2500. The title is for life.',
        'CM and FM need only the rating. IM and GM also need three "norms": excellent results (a performance rating of 2450 for IM, 2600 for GM) in tournaments of at least nine games, against strong enough opponents from different federations. There are matching women’s titles (WCM, WFM, WIM, WGM).',
        'Chess Castles’ titles (CGM, CIM…) are our own fun titles and are not FIDE titles.',
      ],
      hi: [
        'FIDE एक तय rating छूने पर titles देती है: Candidate Master (CM) 2200 पर, FIDE Master (FM) 2300 पर, International Master (IM) 2400 पर और Grandmaster (GM) 2500 पर। Title ज़िंदगी भर रहता है।',
        'CM और FM के लिए सिर्फ़ rating चाहिए। IM और GM के लिए तीन "norms" भी चाहिए: कम से कम नौ games के tournaments में, अलग-अलग federations के काफ़ी strong opponents के ख़िलाफ़ शानदार नतीजे (IM के लिए performance rating 2450, GM के लिए 2600)। महिलाओं के लिए भी ऐसे titles हैं (WCM, WFM, WIM, WGM)।',
        'Chess Castles के titles (CGM, CIM…) हमारे अपने titles हैं, FIDE के नहीं।',
      ],
      mr: [
        'FIDE ठराविक rating गाठल्यावर titles देते: Candidate Master (CM) 2200 वर, FIDE Master (FM) 2300 वर, International Master (IM) 2400 वर आणि Grandmaster (GM) 2500 वर. Title आयुष्यभर राहतो.',
        'CM आणि FM साठी फक्त rating लागते. IM आणि GM साठी तीन "norms" सुद्धा लागतात: किमान नऊ games च्या tournaments मध्ये, वेगवेगळ्या federations च्या पुरेशा strong opponents विरुद्ध उत्कृष्ट निकाल (IM साठी performance rating 2450, GM साठी 2600). महिलांसाठीही असे titles आहेत (WCM, WFM, WIM, WGM).',
        'Chess Castles चे titles (CGM, CIM…) आमचे स्वतःचे आहेत, FIDE चे नाहीत.',
      ],
    },
    words: ['title', 'titles', 'grandmaster', 'gm', 'im', 'fm', 'cm', 'norm', 'norms', 'master', 'candidate', 'ग्रैंडमास्टर', 'ग्रँडमास्टर', 'नॉर्म'],
  },
  {
    id: 'tiebreak',
    topic: 'tournament',
    q: { en: 'How does the tie-break work?', hi: 'Tie-break कैसे काम करता है?', mr: 'Tie-break कसा काम करतो?' },
    a: {
      en: [
        'When two or more players finish with the same points, a tie-break decides who is ahead. The order of tie-breaks is chosen by the organiser and written in the tournament’s regulations or brochure, so always check it before the event.',
        'Common tie-breaks: Direct encounter (who won the game between them); Buchholz (the sum of the scores of all your opponents: a tougher opposition is better); Buchholz Cut-1 (the same, without your weakest opponent’s score); Sonneborn–Berger (the scores of the players you beat, plus half the scores of those you drew with); number of wins; and the average rating of your opponents.',
        'Example: A and B both have 5 points. A’s opponents scored 24 points altogether and B’s 22. With Buchholz, A is ahead. Big prizes decided by tie-break can sometimes go to a playoff or a quick Armageddon game instead.',
      ],
      hi: [
        'जब दो या ज़्यादा players के points बराबर होते हैं, तब tie-break तय करता है कि कौन आगे है। Tie-breaks का क्रम organiser तय करते हैं और tournament के regulations या brochure में लिखा होता है, इसलिए event से पहले ज़रूर देखिए।',
        'आम tie-breaks: Direct encounter (दोनों के बीच का game किसने जीता); Buchholz (आपके सारे opponents के scores का जोड़: जितना कठिन मुक़ाबला, उतना अच्छा); Buchholz Cut-1 (वही, पर सबसे कमज़ोर opponent का score हटाकर); Sonneborn–Berger (जिन्हें आपने हराया उनके scores, और जिनसे draw किया उनके आधे scores का जोड़); जीते हुए games की गिनती; और opponents की average rating।',
        'Example: A और B दोनों के 5 points हैं। A के opponents ने कुल 24 points बनाए और B के opponents ने 22। Buchholz में A आगे रहेगा। बड़े prizes पर कभी-कभी tie-break के बजाय playoff या तेज़ Armageddon game होता है।',
      ],
      mr: [
        'दोन किंवा जास्त players चे points सारखे असले की tie-break ठरवतो कोण पुढे आहे. tie-breaks चा क्रम organiser ठरवतात आणि तो tournament च्या regulations किंवा brochure मध्ये लिहिलेला असतो, म्हणून event आधी नक्की बघा.',
        'नेहमीचे tie-breaks: Direct encounter (दोघांमधली game कोण जिंकलं); Buchholz (तुमच्या सगळ्या opponents च्या scores ची बेरीज: जितकी कठीण लढत, तितकं चांगलं); Buchholz Cut-1 (तेच, पण सगळ्यात कमकुवत opponent चा score वगळून); Sonneborn–Berger (ज्यांना तुम्ही हरवलं त्यांचे scores, आणि ज्यांच्याशी draw केला त्यांचे अर्धे scores यांची बेरीज); जिंकलेल्या games ची संख्या; आणि opponents ची average rating.',
        'Example: A आणि B दोघांचे 5 points आहेत. A च्या opponents नी एकूण 24 points केले आणि B च्या opponents नी 22. Buchholz मध्ये A पुढे राहील. मोठ्या prizes साठी कधी कधी tie-break ऐवजी playoff किंवा जलद Armageddon game होतो.',
      ],
    },
    words: ['tie break', 'tiebreak', 'tie-break', 'tie', 'buchholz', 'sonneborn', 'berger', 'direct encounter', 'playoff', 'armageddon', 'same points', 'equal points', 'who wins', 'टाई', 'टायब्रेक', 'बुकहोल्ज', 'बराबर', 'सारखे', 'ब्रेक'],
  },
  {
    id: 'swiss',
    topic: 'tournament',
    q: { en: 'What is a Swiss tournament?', hi: 'Swiss tournament क्या होता है?', mr: 'Swiss tournament म्हणजे काय?' },
    a: {
      en: [
        'In a Swiss tournament everyone plays the same number of rounds (for example 7 or 9), and no one is knocked out. In each round players with the same score are paired together, so the winners meet the winners and the beginners meet other beginners. You can never meet the same opponent twice.',
        'It is the most common format in India for large events, because hundreds of players can play in a few days. In a round robin, everyone plays everyone, which is used for small, strong fields. In a knockout, a loss sends you out.',
      ],
      hi: [
        'Swiss tournament में सब players उतने ही rounds खेलते हैं (जैसे 7 या 9), और कोई बाहर नहीं होता। हर round में बराबर score वाले players आपस में खेलते हैं, यानी जीतने वाले जीतने वालों से और नए बच्चे नए बच्चों से भिड़ते हैं। एक ही opponent से दो बार नहीं खेलना पड़ता।',
        'भारत में बड़े events के लिए यही format सबसे आम है, क्योंकि कुछ ही दिनों में सैकड़ों players खेल सकते हैं। Round robin में सब सबसे खेलते हैं, जो छोटे और strong fields के लिए होता है। Knockout में एक हार आपको बाहर कर देती है।',
      ],
      mr: [
        'Swiss tournament मध्ये सगळे players सारखेच rounds खेळतात (उदा. 7 किंवा 9), आणि कोणीही बाद होत नाही. प्रत्येक round मध्ये सारखा score असलेले players एकमेकांशी खेळतात, म्हणजे जिंकणारे जिंकणाऱ्यांशी आणि नवीन मुलं नवीन मुलांशी भिडतात. एकाच opponent शी दोनदा खेळावं लागत नाही.',
        'भारतात मोठ्या events साठी हाच format सगळ्यात जास्त वापरतात, कारण काही दिवसांत शेकडो players खेळू शकतात. Round robin मध्ये प्रत्येक जण प्रत्येकाशी खेळतो, जो लहान आणि strong fields साठी असतो. Knockout मध्ये एक हार तुम्हाला बाहेर काढते.',
      ],
    },
    words: ['swiss', 'round robin', 'knockout', 'format', 'rounds', 'pairing', 'pairings', 'how tournament', 'स्विस', 'राउंड', 'फेरी', 'फेऱ्या'],
  },
  {
    id: 'first-tournament',
    topic: 'tournament',
    q: { en: 'What should we expect at the first tournament?', hi: 'पहले tournament में क्या उम्मीद रखें?', mr: 'पहिल्या tournament मध्ये काय अपेक्षा ठेवावी?' },
    a: {
      en: [
        'Arrive 30 minutes early with the entry confirmation, a pen and water. The playing hall is quiet: children play alone, parents wait outside the hall. Mobile phones must be switched off, and only the arbiter (the referee) can answer rule questions.',
        'In rated games with a slow time control, players write down every move on a scoresheet. Practise writing moves at home. The clock is pressed after each move with the same hand that moved the piece.',
        'Losses are normal at the beginning. Talk about what the child learned, not the result. Read the tournament’s brochure for the time control, prizes, age groups and tie-breaks.',
      ],
      hi: [
        'Entry confirmation, एक pen और पानी लेकर 30 minutes पहले पहुँचिए। Playing hall में शांति रहती है: बच्चे अकेले खेलते हैं और parents hall के बाहर इंतज़ार करते हैं। Mobile phones बंद रखने होते हैं, और rules के सवालों का जवाब सिर्फ़ arbiter (referee) देते हैं।',
        'धीमे time control वाले rated games में players हर move scoresheet पर लिखते हैं। घर पर moves लिखने की practice कराइए। Clock उसी हाथ से दबाया जाता है जिससे मोहरा चला है।',
        'शुरू में हारना आम बात है। नतीजे की जगह इस पर बात कीजिए कि बच्चे ने क्या सीखा। Time control, prizes, age groups और tie-breaks के लिए tournament का brochure पढ़िए।',
      ],
      mr: [
        'Entry confirmation, एक pen आणि पाणी घेऊन 30 minutes लवकर पोहोचा. Playing hall मध्ये शांतता असते: मुलं एकटी खेळतात आणि पालक hall च्या बाहेर थांबतात. Mobile phones बंद ठेवावे लागतात, आणि rules बद्दलच्या प्रश्नांना फक्त arbiter (referee) उत्तर देतात.',
        'हळू time control च्या rated games मध्ये players प्रत्येक move scoresheet वर लिहितात. घरी moves लिहिण्याचा सराव करून घ्या. ज्या हाताने मोहरा चालवला त्याच हाताने clock दाबतात.',
        'सुरुवातीला हरणं सामान्य आहे. निकालाऐवजी मुलाने काय शिकलं यावर बोला. Time control, prizes, age groups आणि tie-breaks साठी tournament चं brochure वाचा.',
      ],
    },
    words: ['first tournament', 'beginner', 'what to expect', 'prepare', 'scoresheet', 'arbiter', 'phone', 'hall', 'पहला', 'पहिला', 'पहिल्या', 'तैयारी', 'तयारी', 'अपेक्षा', 'उम्मीद'],
  },
  {
    id: 'touch-move',
    topic: 'tournament',
    q: { en: 'What are touch-move and the other rules parents should know?', hi: 'Touch-move और parents को पता होने वाले बाक़ी rules क्या हैं?', mr: 'Touch-move आणि पालकांना माहीत हवेत असे इतर rules कोणते?' },
    a: {
      en: [
        'Touch-move: if you touch one of your pieces with the intention of moving it, you must move that piece if it has a legal move. If you touch an opponent’s piece, you must capture it if you can. To straighten a piece, say "adjust" (or "j’adoube") first, before touching it.',
        'A move is made once you let go of the piece on a new square. Promotion is completed when the new piece is placed on the square. A player cannot take a move back.',
        'Draws: to offer a draw, make your move first, then offer, then press your clock. Do not talk during a game; do not ask anyone for help. If you think the opponent broke a rule, stop the clock and call the arbiter, and do not argue.',
      ],
      hi: [
        'Touch-move: अगर आपने अपना कोई मोहरा चलाने के इरादे से छू लिया, तो उसके पास कोई legal move हो तो वही मोहरा चलना पड़ता है। अगर आपने opponent का मोहरा छुआ, तो हो सके तो उसे पकड़ना पड़ता है। मोहरा सीधा करना हो तो छूने से पहले "adjust" (या "j’adoube") बोलिए।',
        'मोहरा नए square पर छोड़ते ही move हो जाती है। Promotion तब पूरा होता है जब नया मोहरा square पर रख दिया जाए। चली हुई move वापस नहीं ली जा सकती।',
        'Draw: draw offer करना हो तो पहले अपनी move चलिए, फिर offer कीजिए, फिर clock दबाइए। Game के दौरान बात मत कीजिए, किसी से मदद मत माँगिए। अगर लगे कि opponent ने rule तोड़ा, तो clock रोककर arbiter को बुलाइए, बहस मत कीजिए।',
      ],
      mr: [
        'Touch-move: तुम्ही तुमचा एखादा मोहरा चालवण्याच्या हेतूने हात लावला, तर त्याला legal move असेल तर तोच मोहरा चालावा लागतो. तुम्ही opponent च्या मोहऱ्याला हात लावला, तर शक्य असेल तर तो मारावा लागतो. मोहरा सरळ करायचा असेल तर हात लावण्याआधी "adjust" (किंवा "j’adoube") म्हणा.',
        'मोहरा नव्या square वर सोडला की move झाली. Promotion तेव्हा पूर्ण होतं जेव्हा नवा मोहरा square वर ठेवला जातो. चाललेली move परत घेता येत नाही.',
        'Draw: draw offer करायचं असेल तर आधी तुमची move चला, मग offer करा, मग clock दाबा. game दरम्यान बोलू नका, कोणाची मदत मागू नका. opponent ने rule मोडला असं वाटलं तर clock थांबवून arbiter ला बोलवा, वाद घालू नका.',
      ],
    },
    words: ['touch move', 'touch-move', 'touched', 'rules', 'rule', 'adjust', 'draw offer', 'illegal', 'promotion', 'take back', 'arbiter', 'नियम', 'छूना', 'हात', 'टच', 'रूल', 'rules'],
    link: { href: '/legal/fair-play', label: { en: 'Fair play policy', hi: 'Fair play नीति', mr: 'Fair play धोरण' } },
  },
  {
    id: 'age-groups',
    topic: 'tournament',
    q: { en: 'What do Under-7, Under-9, Under-11 mean?', hi: 'Under-7, Under-9, Under-11 का क्या मतलब है?', mr: 'Under-7, Under-9, Under-11 म्हणजे काय?' },
    a: {
      en: [
        'Age-group tournaments are for children below a certain age. "Under-11" (U11) means the player must be younger than 11. In most events the age is counted on 1 January of the year of the tournament, so a child who turns 11 later in the year can still play U11. Always check the tournament’s rules.',
        'Common groups are U7, U9, U11, U13, U15, U17 and U19, usually with a separate section for girls. Children can often also play in a higher age group if they are strong enough.',
      ],
      hi: [
        'Age-group tournaments एक तय उम्र से छोटे बच्चों के लिए होते हैं। "Under-11" (U11) का मतलब है कि player की उम्र 11 से कम होनी चाहिए। ज़्यादातर events में उम्र tournament वाले साल की 1 जनवरी को गिनी जाती है, इसलिए जो बच्चा साल में आगे 11 का होगा वह भी U11 खेल सकता है। हमेशा tournament के rules देखिए।',
        'आम groups हैं U7, U9, U11, U13, U15, U17 और U19, और अक्सर लड़कियों का अलग section होता है। बच्चे अगर काफ़ी strong हों तो अक्सर ऊपर वाले age group में भी खेल सकते हैं।',
      ],
      mr: [
        'Age-group tournaments ठराविक वयाखालील मुलांसाठी असतात. "Under-11" (U11) म्हणजे player 11 पेक्षा लहान असायला हवा. बहुतेक events मध्ये वय tournament च्या वर्षाच्या 1 जानेवारीला मोजतात, म्हणून वर्षात पुढे 11 वर्षांचं होणारं मूलही U11 खेळू शकतं. नेहमी tournament चे rules बघा.',
        'नेहमीचे groups U7, U9, U11, U13, U15, U17 आणि U19 आहेत, आणि बऱ्याचदा मुलींचा वेगळा section असतो. मुलं पुरेशी strong असतील तर बऱ्याचदा वरच्या age group मध्येही खेळू शकतात.',
      ],
    },
    words: ['under 7', 'under 9', 'under 11', 'u7', 'u9', 'u11', 'u13', 'age group', 'age category', 'girls', 'अंडर', 'उम्र', 'वय', 'आयु', 'ग्रुप', 'गट'],
    link: { href: '/community', label: { en: 'Find tournaments for your child’s age', hi: 'बच्चे की उम्र के tournaments खोजें', mr: 'मुलाच्या वयाचे tournaments शोधा' } },
  },
  {
    id: 'good-rating',
    topic: 'parents',
    q: { en: 'Is my child’s rating good?', hi: 'क्या मेरे बच्चे की rating अच्छी है?', mr: 'माझ्या मुलाची rating चांगली आहे का?' },
    a: {
      en: [
        'A rough guide for the FIDE scale: 1400–1600 is a beginner who knows the rules and basic tactics; 1600–1900 is a solid club player; 1900–2200 is a strong tournament player; above 2200 earns titles. The lowest official rating is 1400.',
        'Compare a child with themselves, not with other children. A rise of 100–200 points in a year is very good progress. Age matters too: a 9-year-old at 1600 is far ahead of the usual path.',
      ],
      hi: [
        'FIDE scale के लिए मोटा अंदाज़ा: 1400–1600 वह beginner है जिसे rules और basic tactics आते हैं; 1600–1900 मज़बूत club player; 1900–2200 strong tournament player; 2200 से ऊपर titles मिलते हैं। सबसे कम official rating 1400 है।',
        'बच्चे की तुलना दूसरे बच्चों से नहीं, उसी बच्चे की पिछली rating से कीजिए। साल में 100–200 points बढ़ना बहुत अच्छी प्रगति है। उम्र भी मायने रखती है: 9 साल का बच्चा 1600 पर हो तो वह आम रास्ते से बहुत आगे है।',
      ],
      mr: [
        'FIDE scale साठी ढोबळ अंदाज: 1400–1600 म्हणजे rules आणि basic tactics माहीत असलेला beginner; 1600–1900 म्हणजे भक्कम club player; 1900–2200 म्हणजे strong tournament player; 2200 च्या वर titles मिळतात. सगळ्यात कमी official rating 1400 आहे.',
        'मुलाची तुलना इतर मुलांशी नाही, त्याच्या स्वतःच्या आधीच्या rating शी करा. वर्षात 100–200 points वाढणं खूप चांगली प्रगती आहे. वयही महत्त्वाचं आहे: 9 वर्षांचं मूल 1600 वर असेल तर ते नेहमीच्या वाटेपेक्षा खूप पुढे आहे.',
      ],
    },
    words: ['good rating', 'good', 'average', 'beginner', 'level', 'my child', 'son', 'daughter', 'progress', 'अच्छी', 'चांगली', 'बच्चा', 'बच्चे', 'मुलगा', 'मुलगी', 'मूल', 'प्रगति', 'प्रगती'],
  },
  {
    id: 'improve',
    topic: 'parents',
    q: { en: 'How can my child improve faster?', hi: 'मेरा बच्चा तेज़ी से कैसे सुधरे?', mr: 'माझं मूल झपाट्याने कसं सुधारेल?' },
    a: {
      en: [
        'A simple weekly routine works best: puzzles every day (15 minutes), one long game with notes, one lesson or opening practice, and a review of mistakes. Playing many games without reviewing them helps little.',
        'Reviewing the child’s own games is the fastest way to learn: ask "which move changed the game?" Chess Castles’ Game Insights finds the mistakes automatically and builds a weekly plan.',
        'Keep it fun: short sessions, praise effort, and let the child play friends. Chess is long-term: a break after a bad tournament is fine.',
      ],
      hi: [
        'एक सीधा weekly routine सबसे अच्छा काम करता है: रोज़ puzzles (15 minutes), एक लंबा game notes के साथ, एक lesson या opening practice, और गलतियों का review। बिना review किए बहुत सारे games खेलने से कम फ़ायदा होता है।',
        'बच्चे के अपने games का review सीखने का सबसे तेज़ तरीका है: पूछिए "कौन सी move ने game बदला?" Chess Castles का Game Insights गलतियाँ अपने आप ढूँढ लेता है और weekly plan बना देता है।',
        'मज़ा बनाए रखिए: छोटे sessions, मेहनत की तारीफ़, और दोस्तों के साथ खेलने दीजिए। Chess लंबा सफ़र है: बुरे tournament के बाद थोड़ा break लेना ठीक है।',
      ],
      mr: [
        'एक साधा weekly routine सगळ्यात चांगला काम करतो: रोज puzzles (15 minutes), एक मोठी game notes सह, एक lesson किंवा opening practice, आणि चुकांचा review. review न करता खूप games खेळल्याने फारसा फायदा होत नाही.',
        'मुलाच्या स्वतःच्या games चा review हा शिकण्याचा सगळ्यात वेगवान मार्ग आहे: विचारा "कुठल्या move ने game बदलला?" Chess Castles चं Game Insights चुका आपोआप शोधतं आणि weekly plan बनवतं.',
        'मजा टिकवून ठेवा: छोटे sessions, मेहनतीचं कौतुक, आणि मित्रांशी खेळू द्या. Chess हा लांबचा प्रवास आहे: वाईट tournament नंतर थोडा break घेणं ठीक आहे.',
      ],
    },
    words: ['improve', 'faster', 'train', 'training', 'practice', 'study', 'routine', 'coach', 'how to learn', 'better', 'सुधर', 'सुधारे', 'सुधारेल', 'सीख', 'शिक', 'प्रैक्टिस', 'सराव', 'अभ्यास', 'पढ़ाई'],
    link: { href: '/insights', label: { en: 'Game Insights', hi: 'Game Insights', mr: 'Game Insights' } },
  },
  {
    id: 'cc-rating',
    topic: 'parents',
    q: { en: 'Is the CC Rating a FIDE rating?', hi: 'क्या CC Rating एक FIDE rating है?', mr: 'CC Rating म्हणजे FIDE rating आहे का?' },
    a: {
      en: [
        'No. The CC Rating is Chess Castles’ own rating. It is worked out the way FIDE rates players, from your games against our FIDE-rated computer opponents, with a separate rating for Classical, Rapid and Blitz. It helps you practise and see your progress.',
        'Only FIDE-rated tournaments change your official FIDE rating. Our opponents are computer opponents that play in the style of players at each FIDE rating, and Chess Castles is not affiliated with FIDE.',
      ],
      hi: [
        'नहीं। CC Rating Chess Castles की अपनी rating है। यह FIDE के तरीके से, हमारे FIDE-rated computer opponents के ख़िलाफ़ आपके games से निकाली जाती है, और Classical, Rapid, Blitz की अलग-अलग होती है। इससे आप practice करते हैं और अपनी प्रगति देखते हैं।',
        'आपकी official FIDE rating सिर्फ़ FIDE-rated tournaments से बदलती है। हमारे opponents computer opponents हैं जो हर FIDE rating के players की शैली में खेलते हैं, और Chess Castles का FIDE से कोई संबंध नहीं है।',
      ],
      mr: [
        'नाही. CC Rating ही Chess Castles ची स्वतःची rating आहे. ती FIDE च्या पद्धतीने, आमच्या FIDE-rated computer opponents विरुद्धच्या तुमच्या games वरून काढली जाते, आणि Classical, Rapid, Blitz ची वेगवेगळी असते. यामुळे तुम्ही सराव करता आणि तुमची प्रगती बघता.',
        'तुमची official FIDE rating फक्त FIDE-rated tournaments मुळे बदलते. आमचे opponents computer opponents आहेत जे प्रत्येक FIDE rating च्या players च्या शैलीत खेळतात, आणि Chess Castles चा FIDE शी कोणताही संबंध नाही.',
      ],
    },
    words: ['cc rating', 'ccrating', 'kfide', 'official', 'chess castles rating', 'is it fide', 'not fide', 'real rating', 'अपनी', 'स्वतःची', 'ऑफिशियल'],
    link: { href: '/profile', label: { en: 'See my CC Rating', hi: 'मेरी CC Rating देखें', mr: 'माझी CC Rating बघा' } },
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{M}\p{N}+.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The guide answers that fit a question best (best first); empty when nothing fits. */
export function findGuide(question: string, max = 3): GuideItem[] {
  const q = norm(question);
  if (!q) return [];
  const qWords = new Set(q.split(' ').filter((w) => w.length > 1));
  const scored = GUIDE.map((g) => {
    let score = 0;
    for (const w of g.words) {
      const n = norm(w);
      if (n.includes(' ') || n.includes('-')) {
        if (q.includes(n)) score += 3;
      } else if (n.length > 1 && qWords.has(n)) score += 2;
    }
    // Words of the question text itself, in any of the three languages.
    for (const lang of ['en', 'hi', 'mr'] as Lang[]) for (const w of norm(g.q[lang]).split(' ')) if (w.length > 3 && qWords.has(w)) score += 0.7;
    return { g, score };
  });
  return scored
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.g);
}
