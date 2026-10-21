/**
 * WhatsApp reports: the short Guru summary saved from a player's Insights report, the owner's list of players who
 * gave a number (admin page), and the message for each: short and personal, where they lose the most points and
 * the link back to their report and study plan. Sent from the owner's WhatsApp (wa.me) until the WhatsApp Business
 * API sends them on its own.
 */
import { call, type GuruSummary } from '$lib/social';
import type { Report } from '$lib/insights/report';
import type { InsightsData } from '$lib/insights/store';

export const SITE = 'https://chesscastles.com';

/** The part of a report a WhatsApp message needs. */
export const guruSummary = (report: Report, data: Pick<InsightsData, 'site' | 'username'>): GuruSummary => ({
  site: data.site,
  user: data.username,
  games: report.games,
  score: Math.round(report.score * 100),
  accuracy: Math.round(report.accuracy),
  blunders: Math.round(report.blundersPerGame * 10) / 10,
  weak: report.weaknesses.slice(0, 3).map((w) => ({ title: w.title, evidence: w.evidence })),
  strong: report.strengths[0] ?? '',
});

export interface WaPlayer {
  uid: string;
  name: string;
  username: string;
  phone: string;
  whose: 'self' | 'parent';
  consentAt: number;
  report?: GuruSummary;
  reportAt: number;
  sentAt: number;
}
export const whatsappList = () => call<{ players: WaPlayer[] }>('GET', 'admin/whatsapp').then((r) => r.players);
export const markSent = (uid: string) => call<{ ok: true }>('POST', `admin/whatsapp/${encodeURIComponent(uid)}`);

/** Where the message sends them: their report (on the device that made it) or Guru ready for their games. */
export const reportLink = (r?: Pick<GuruSummary, 'site' | 'user'>) => (r?.user ? `${SITE}/insights?site=${r.site}&user=${encodeURIComponent(r.user)}` : `${SITE}/insights`);

/**
 * The message: a greeting (to the player, or to a parent about their child), the numbers, where they lose the
 * most points, their strong point, the link, and how to stop.
 */
export function waMessage(p: Pick<WaPlayer, 'name' | 'username' | 'whose' | 'report'>): string {
  const first = (p.name.trim().split(/\s+/)[0] || p.username).slice(0, 30);
  const parent = p.whose === 'parent';
  const lines = [parent ? `Namaste! ${first}'s chess update from Chess Castles ♟️` : `Namaste ${first}! Your chess update from Chess Castles ♟️`, ''];
  const r = p.report;
  if (!r || !r.games) {
    lines.push(
      `Guru, the free chess coach on Chess Castles, can check ${parent ? `${first}'s` : 'your'} last 20 games and show the 3 things costing the most points, with a study plan to fix them:`,
      reportLink(r),
    );
  } else {
    lines.push(`Guru checked ${r.games} games of ${r.user} on ${r.site === 'chesscom' ? 'chess.com' : 'Lichess'}: score ${r.score}%, accuracy ${r.accuracy}%.`);
    if (r.weak[0]) lines.push('', `Where ${parent ? `${first} loses` : 'you lose'} the most points: *${r.weak[0].title}* (${r.weak[0].evidence}).`);
    if (r.strong) lines.push(`Strong point: ${r.strong}.`);
    lines.push('', 'The study plan to fix it, and the mistakes to train:', reportLink(r));
  }
  lines.push('', 'Reply STOP to stop these messages.');
  return lines.join('\n');
}

/** WhatsApp (app or web) with the message ready to send to that number. */
export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
