import { feature } from './feature';

/** A banned (suspended) account: what the player sees, and the badge on their profile for everyone else. */
export const banWords = feature(
  {
    'ban.title': 'Your account is banned from playing',
    'ban.fair': 'Our fair-play check found computer help in your games. Using a chess engine is not allowed on Chess Castles.',
    'ban.other': 'An admin stopped this account for breaking the Chess Castles rules.',
    'ban.help': 'If you think this is a mistake, write to us from the Help page.',
    'ban.helpLink': 'Help page',
    'ban.badge': 'Banned · fair play',
  },
  {
    'ban.title': 'आपके account पर खेलने की रोक लगा दी गई है',
    'ban.fair': 'हमारे fair-play check में आपके games में computer की मदद मिली। Chess Castles पर chess engine का इस्तेमाल मना है।',
    'ban.other': 'Chess Castles के नियम तोड़ने के कारण admin ने यह account रोक दिया है।',
    'ban.help': 'अगर आपको लगता है कि यह गलती है, तो Help page से हमें लिखें।',
    'ban.helpLink': 'Help page',
    'ban.badge': 'Banned · fair play',
  },
  {
    'ban.title': 'तुमच्या account वर खेळायला बंदी घातली आहे',
    'ban.fair': 'आमच्या fair-play check मध्ये तुमच्या games मध्ये computer ची मदत दिसली. Chess Castles वर chess engine वापरायला परवानगी नाही.',
    'ban.other': 'Chess Castles चे नियम मोडल्यामुळे admin ने हे account थांबवलं आहे.',
    'ban.help': 'ही चूक आहे असं वाटत असेल, तर Help page वरून आम्हाला लिहा.',
    'ban.helpLink': 'Help page',
    'ban.badge': 'Banned · fair play',
  },
);
