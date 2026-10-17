import type { L10n } from '../i18n';

/** The legends whose games the lessons use: display name and a short, checked bio. */
export const LEGENDS: Record<string, { name: string; bio: L10n }> = {
  colle: {
    name: 'Edgar Colle',
    bio: { en: 'Edgar Colle of Belgium gave his name to the Colle System, an opening that often leads to this very attack.', hi: 'Belgium के Edgar Colle के नाम पर Colle System opening है, जिससे अक्सर यही attack बनता है।', mr: 'Belgium च्या Edgar Colle यांच्या नावावर Colle System opening आहे, ज्यातून बऱ्याचदा हाच attack तयार होतो.' },
  },
  gukesh: {
    name: 'Gukesh D',
    bio: { en: 'Gukesh from Chennai became the youngest undisputed World Champion in 2024, at just 18.', hi: 'चेन्नई के Gukesh 2024 में सिर्फ़ 18 साल की उम्र में सबसे कम उम्र के undisputed World Champion बने।', mr: 'चेन्नईचा Gukesh 2024 मध्ये फक्त 18 वर्षांचा असताना सगळ्यात लहान undisputed World Champion झाला.' },
  },
  anand: {
    name: 'Viswanathan Anand',
    bio: { en: "Viswanathan Anand became India's first grandmaster in 1988 and was World Champion five times.", hi: 'Viswanathan Anand 1988 में भारत के पहले grandmaster बने और पाँच बार World Champion रहे।', mr: 'Viswanathan Anand 1988 मध्ये भारताचे पहिले grandmaster झाले आणि पाच वेळा World Champion होते.' },
  },
  divya: {
    name: 'Divya Deshmukh',
    bio: { en: "Divya Deshmukh from Nagpur won the FIDE Women's World Cup in 2025, at 19, and became a grandmaster.", hi: "नागपुर की Divya Deshmukh ने 2025 में 19 साल की उम्र में FIDE Women's World Cup जीता और grandmaster बनीं।", mr: "नागपूरच्या Divya Deshmukh ने 2025 मध्ये 19 व्या वर्षी FIDE Women's World Cup जिंकला आणि ती grandmaster झाली." },
  },
  pragg: {
    name: 'Praggnanandhaa R',
    bio: { en: 'Praggnanandhaa from Chennai became a grandmaster at 12 and reached the World Cup final in 2023.', hi: 'चेन्नई के Praggnanandhaa 12 साल की उम्र में grandmaster बने और 2023 में World Cup final तक पहुँचे।', mr: 'चेन्नईचा Praggnanandhaa 12 व्या वर्षी grandmaster झाला आणि 2023 मध्ये World Cup final पर्यंत पोहोचला.' },
  },
  humpy: {
    name: 'Humpy Koneru',
    bio: { en: "Humpy Koneru is one of India's greatest players and twice Women's World Rapid Champion.", hi: "Humpy Koneru भारत की सबसे महान players में से एक हैं और दो बार Women's World Rapid Champion रहीं।", mr: "Humpy Koneru भारताच्या सगळ्यात महान players पैकी एक आहे आणि दोन वेळा Women's World Rapid Champion झाली." },
  },
  arjun: {
    name: 'Arjun Erigaisi',
    bio: { en: 'Arjun Erigaisi from Warangal became only the second Indian, after Anand, to cross a 2800 rating.', hi: 'वारंगल के Arjun Erigaisi, Anand के बाद 2800 rating पार करने वाले सिर्फ़ दूसरे भारतीय बने।', mr: 'वारंगलचा Arjun Erigaisi, Anand नंतर 2800 rating पार करणारा फक्त दुसरा भारतीय ठरला.' },
  },
  vaishali: {
    name: 'Vaishali R',
    bio: { en: "Vaishali, Praggnanandhaa's sister, became India's third woman grandmaster.", hi: 'Praggnanandhaa की बहन Vaishali भारत की तीसरी woman grandmaster बनीं।', mr: 'Praggnanandhaa ची बहीण Vaishali भारताची तिसरी woman grandmaster झाली.' },
  },
  harika: {
    name: 'Harika Dronavalli',
    bio: { en: "Harika Dronavalli won bronze at the Women's World Championship three times.", hi: "Harika Dronavalli ने तीन बार Women's World Championship में bronze जीता।", mr: "Harika Dronavalli ने तीन वेळा Women's World Championship मध्ये bronze जिंकलं." },
  },
  vidit: {
    name: 'Vidit Gujrathi',
    bio: { en: 'Vidit Gujrathi from Nashik helped India win the Chess Olympiad gold in 2024.', hi: 'नासिक के Vidit Gujrathi ने 2024 में भारत को Chess Olympiad gold जिताने में मदद की।', mr: 'नाशिकच्या Vidit Gujrathi ने 2024 मध्ये भारताला Chess Olympiad gold जिंकून द्यायला मदत केली.' },
  },
  harikrishna: {
    name: 'Pentala Harikrishna',
    bio: { en: "Pentala Harikrishna became a grandmaster in 2001 and was part of India's Olympiad gold team in 2024.", hi: 'Pentala Harikrishna 2001 में grandmaster बने और 2024 की Olympiad gold team का हिस्सा थे।', mr: 'Pentala Harikrishna 2001 मध्ये grandmaster झाले आणि 2024 च्या Olympiad gold team मध्ये होते.' },
  },
  nihal: {
    name: 'Nihal Sarin',
    bio: { en: 'Nihal Sarin from Kerala became a grandmaster at 14.', hi: 'केरल के Nihal Sarin 14 साल की उम्र में grandmaster बने।', mr: 'केरळचा Nihal Sarin 14 व्या वर्षी grandmaster झाला.' },
  },
  carlsen: {
    name: 'Magnus Carlsen',
    bio: { en: 'Magnus Carlsen from Norway was World Champion from 2013 to 2023.', hi: 'Norway के Magnus Carlsen 2013 से 2023 तक World Champion रहे।', mr: 'Norway चा Magnus Carlsen 2013 ते 2023 World Champion होता.' },
  },
  kasparov: {
    name: 'Garry Kasparov',
    bio: { en: 'Garry Kasparov was World Champion from 1985 to 2000.', hi: 'Garry Kasparov 1985 से 2000 तक World Champion रहे।', mr: 'Garry Kasparov 1985 ते 2000 World Champion होते.' },
  },
  fischer: {
    name: 'Bobby Fischer',
    bio: { en: 'Bobby Fischer from the USA became World Champion in 1972.', hi: 'USA के Bobby Fischer 1972 में World Champion बने।', mr: 'USA चा Bobby Fischer 1972 मध्ये World Champion झाला.' },
  },
  tal: {
    name: 'Mikhail Tal',
    bio: { en: 'Mikhail Tal, the "Magician from Riga", became World Champion in 1960 with daring attacks.', hi: '"Magician from Riga" कहे जाने वाले Mikhail Tal अपने हिम्मत भरे attacks से 1960 में World Champion बने।', mr: '"Magician from Riga" म्हणवले जाणारे Mikhail Tal धाडसी attacks करून 1960 मध्ये World Champion झाले.' },
  },
  capablanca: {
    name: 'José Raúl Capablanca',
    bio: { en: 'José Raúl Capablanca from Cuba was World Champion from 1921 to 1927, famous for simple, clear play.', hi: 'Cuba के José Raúl Capablanca 1921 से 1927 तक World Champion रहे, अपने सीधे-सरल खेल के लिए मशहूर।', mr: 'Cuba चे José Raúl Capablanca 1921 ते 1927 World Champion होते, त्यांच्या सोप्या, स्वच्छ खेळासाठी प्रसिद्ध.' },
  },
  morphy: {
    name: 'Paul Morphy',
    bio: { en: 'Paul Morphy from New Orleans was the best player in the world in the 1850s.', hi: 'New Orleans के Paul Morphy 1850 के दशक में दुनिया के सबसे अच्छे player थे।', mr: 'New Orleans चे Paul Morphy 1850 च्या दशकात जगातले सगळ्यात चांगले player होते.' },
  },
  alekhine: {
    name: 'Alexander Alekhine',
    bio: { en: 'Alexander Alekhine was World Champion from 1927 to 1935 and again from 1937 to 1946.', hi: 'Alexander Alekhine 1927 से 1935 तक और फिर 1937 से 1946 तक World Champion रहे।', mr: 'Alexander Alekhine 1927 ते 1935 आणि परत 1937 ते 1946 World Champion होते.' },
  },
  karpov: {
    name: 'Anatoly Karpov',
    bio: { en: 'Anatoly Karpov was World Champion from 1975 to 1985.', hi: 'Anatoly Karpov 1975 से 1985 तक World Champion रहे।', mr: 'Anatoly Karpov 1975 ते 1985 World Champion होते.' },
  },
  kramnik: {
    name: 'Vladimir Kramnik',
    bio: { en: 'Vladimir Kramnik was World Champion from 2000 to 2007.', hi: 'Vladimir Kramnik 2000 से 2007 तक World Champion रहे।', mr: 'Vladimir Kramnik 2000 ते 2007 World Champion होते.' },
  },
  polgar: {
    name: 'Judit Polgar',
    bio: { en: "Judit Polgar is the strongest woman player in history and was once in the world's top 10.", hi: 'Judit Polgar इतिहास की सबसे strong woman player हैं और एक समय दुनिया के top 10 में थीं।', mr: 'Judit Polgar इतिहासातली सगळ्यात strong woman player आहे आणि एकेकाळी जगाच्या top 10 मध्ये होती.' },
  },
  spassky: {
    name: 'Boris Spassky',
    bio: { en: 'Boris Spassky was World Champion from 1969 to 1972.', hi: 'Boris Spassky 1969 से 1972 तक World Champion रहे।', mr: 'Boris Spassky 1969 ते 1972 World Champion होते.' },
  },
  petrosian: {
    name: 'Tigran Petrosian',
    bio: { en: 'Tigran Petrosian was World Champion from 1963 to 1969, famous for his safe, solid play.', hi: 'Tigran Petrosian 1963 से 1969 तक World Champion रहे, अपने safe और solid खेल के लिए मशहूर।', mr: 'Tigran Petrosian 1963 ते 1969 World Champion होते, त्यांच्या safe आणि solid खेळासाठी प्रसिद्ध.' },
  },
  botvinnik: {
    name: 'Mikhail Botvinnik',
    bio: { en: 'Mikhail Botvinnik was World Champion three times between 1948 and 1963.', hi: 'Mikhail Botvinnik 1948 से 1963 के बीच तीन बार World Champion बने।', mr: 'Mikhail Botvinnik 1948 ते 1963 दरम्यान तीन वेळा World Champion झाले.' },
  },
  lasker: {
    name: 'Emanuel Lasker',
    bio: { en: 'Emanuel Lasker was World Champion for 27 years, from 1894 to 1921.', hi: 'Emanuel Lasker 1894 से 1921 तक, पूरे 27 साल World Champion रहे।', mr: 'Emanuel Lasker 1894 ते 1921, तब्बल 27 वर्षं World Champion होते.' },
  },
  houyifan: {
    name: 'Hou Yifan',
    bio: { en: "Hou Yifan from China was Women's World Champion four times.", hi: "China की Hou Yifan चार बार Women's World Champion रहीं।", mr: "China ची Hou Yifan चार वेळा Women's World Champion झाली." },
  },
  dingliren: {
    name: 'Ding Liren',
    bio: { en: 'Ding Liren from China became World Champion in 2023.', hi: 'China के Ding Liren 2023 में World Champion बने।', mr: 'China चे Ding Liren 2023 मध्ये World Champion झाले.' },
  },
  firouzja: {
    name: 'Alireza Firouzja',
    bio: { en: 'Alireza Firouzja crossed a 2800 rating at 18, younger than anyone before him.', hi: 'Alireza Firouzja ने 18 साल की उम्र में 2800 rating पार की, उनसे पहले कोई इतनी कम उम्र में नहीं कर पाया था।', mr: 'Alireza Firouzja ने 18 व्या वर्षी 2800 rating पार केली, त्याच्या आधी इतक्या लहान वयात कोणीच केली नव्हती.' },
  },
  caruana: {
    name: 'Fabiano Caruana',
    bio: { en: 'Fabiano Caruana from the USA played the World Championship match in 2018.', hi: 'USA के Fabiano Caruana ने 2018 में World Championship match खेला।', mr: 'USA च्या Fabiano Caruana ने 2018 मध्ये World Championship match खेळला.' },
  },
  nakamura: {
    name: 'Hikaru Nakamura',
    bio: { en: 'Hikaru Nakamura from the USA is one of the best blitz players in history.', hi: 'USA के Hikaru Nakamura इतिहास के सबसे अच्छे blitz players में से एक हैं।', mr: 'USA चा Hikaru Nakamura इतिहासातल्या सगळ्यात चांगल्या blitz players पैकी एक आहे.' },
  },
  smyslov: {
    name: 'Vasily Smyslov',
    bio: { en: 'Vasily Smyslov was World Champion from 1957 to 1958.', hi: 'Vasily Smyslov 1957 से 1958 तक World Champion रहे।', mr: 'Vasily Smyslov 1957 ते 1958 World Champion होते.' },
  },
  steinitz: {
    name: 'Wilhelm Steinitz',
    bio: { en: 'Wilhelm Steinitz was the first official World Champion, in 1886.', hi: 'Wilhelm Steinitz 1886 में पहले official World Champion बने।', mr: 'Wilhelm Steinitz 1886 मध्ये पहिले official World Champion झाले.' },
  },
};
