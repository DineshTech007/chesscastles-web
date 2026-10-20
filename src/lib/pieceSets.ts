/**
 * The chess piece sets: a site-wide choice like the board colour (boardTheme.ts), saved in localStorage and
 * applied as `data-pieces` on <html>; every board reads it (pieceSets.css). Only sets whose licence allows a
 * commercial site, from Lichess's collection (static/pieces), with their authors credited in the picker.
 */
export interface PieceSetDef {
  id: string;
  name: string;
  /** For young players: friendly, rounder shapes. */
  kids?: boolean;
  credit: string;
}

export const PIECE_SETS: PieceSetDef[] = [
  { id: 'merida', name: 'Merida', credit: 'Armando Hernandez Marroquin, GPLv2+' },
  { id: 'cburnett', name: 'Classic', credit: 'Colin M.L. Burnett, GPLv2+' },
  { id: 'spatial', name: 'Spatial', credit: 'Maurizio Monge, MIT' },
  { id: 'fantasy', name: 'Fantasy', credit: 'Maurizio Monge, MIT' },
  { id: 'celtic', name: 'Celtic', credit: 'Maurizio Monge, MIT' },
  { id: 'chessnut', name: 'Chessnut', credit: 'Alexis Luengas, Apache 2.0' },
  { id: 'pirouetti', name: 'Pirouetti', credit: 'pirouetti, AGPLv3+' },
  { id: 'papercut', name: 'Papercut', kids: true, credit: 'Nikolay Anzarov, CC BY 4.0' },
  { id: 'totoy', name: 'Totoy', kids: true, credit: 'Kosal Sen, CC BY 4.0' },
  { id: 'pixel', name: 'Pixel', kids: true, credit: 'therealqtpi, AGPLv3+' },
];

const KEY = 'cc.pieces';

export function loadPieceSet(): string {
  try {
    const p = localStorage.getItem(KEY);
    if (p && PIECE_SETS.some((s) => s.id === p)) return p;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PIECES;
}

/** The default set: Merida (no data-pieces on <html>; see pieceSets.css). Classic is chessground's own CSS. */
export const DEFAULT_PIECES = 'merida';

/** Sets `data-pieces` on <html> and saves the choice. */
export function applyPieceSet(id: string, save = true) {
  if (id === DEFAULT_PIECES) delete document.documentElement.dataset.pieces;
  else document.documentElement.dataset.pieces = id;
  if (!save) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked */
  }
}

export const pieceImage = (set: string, piece: string) => (set === 'cburnett' ? `/pieces/cburnett/${piece}.svg` : `/pieces/${set}/${piece}.svg`);
