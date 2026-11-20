import { Chess, type Color } from 'chess.js';
import { DEFAULT_POSITION, playUci, uci } from './chess';

// Opening names and standard move orders follow lichess-org/chess-openings (CC0).
// These are selected training lines, not an exhaustive opening book.
export interface OpeningLine {
  id: string;
  name: string;
  en: string;
  moves: string[];
}
export interface Opening {
  id: string;
  name: string;
  en: string;
  idea: string;
  ideaEn: string;
  lines: OpeningLine[];
}
const line = (id: string, name: string, en: string, moves: string): OpeningLine => ({
  id,
  name,
  en,
  moves: moves.split(' '),
});
export const OPENINGS: Opening[] = [
  {
    id: 'italian',
    name: 'Italienische Partie',
    en: 'Italian Game',
    idea: 'Entwickle die Leichtfiguren, sichere den König und bereite den Vorstoß d4 vor.',
    ideaEn: 'Develop your minor pieces, secure your king and prepare d4.',
    lines: [
      line(
        'italian-piano',
        'Giuoco Piano',
        'Giuoco Piano',
        'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
      ),
      line(
        'italian-two-knights',
        'Zweispringerspiel',
        'Two Knights Defense',
        'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O d6 c3 O-O',
      ),
    ],
  },
  {
    id: 'spanish',
    name: 'Spanische Partie',
    en: 'Ruy Lopez',
    idea: 'Setze den Springer c6 unter Druck. Bereite die Rochade und später das Zentrum mit c3 und d4 vor.',
    ideaEn: 'Pressure the c6 knight. Prepare castling and later build your centre with c3 and d4.',
    lines: [
      line(
        'spanish-morphy',
        'Morphy-Verteidigung',
        'Morphy Defense',
        'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6',
      ),
      line(
        'spanish-berlin',
        'Berliner Verteidigung',
        'Berlin Defense',
        'e4 e5 Nf3 Nc6 Bb5 Nf6 d3 Bc5 c3 O-O O-O d6',
      ),
    ],
  },
  {
    id: 'sicilian',
    name: 'Sizilianische Verteidigung',
    en: 'Sicilian Defense',
    idea: 'Schwarz bekämpft das Zentrum asymmetrisch. Im offenen Sizilianer tauscht Weiß den d-Bauern und entwickelt aktiv.',
    ideaEn:
      'Black contests the centre asymmetrically. In the Open Sicilian, White exchanges the d-pawn and develops actively.',
    lines: [
      line(
        'sicilian-najdorf',
        'Najdorf-Aufbau',
        'Najdorf setup',
        'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6',
      ),
      line(
        'sicilian-alapin',
        'Alapin-Variante',
        'Alapin Variation',
        'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6',
      ),
    ],
  },
  {
    id: 'french',
    name: 'Französische Verteidigung',
    en: 'French Defense',
    idea: 'Die Bauernstruktur prägt den Plan. Schwarz greift die weiße Mitte häufig mit c5 an.',
    ideaEn: 'The pawn structure determines the plan. Black often attacks the white centre with c5.',
    lines: [
      line(
        'french-advance',
        'Vorstoßvariante',
        'Advance Variation',
        'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6',
      ),
      line(
        'french-exchange',
        'Abtauschvariante',
        'Exchange Variation',
        'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6 O-O O-O',
      ),
    ],
  },
  {
    id: 'caro',
    name: 'Caro-Kann',
    en: 'Caro-Kann Defense',
    idea: 'Schwarz stützt d5 mit c6 und entwickelt den Damenläufer möglichst vor e6.',
    ideaEn: 'Black supports d5 with c6 and aims to develop the light-squared bishop before e6.',
    lines: [
      line(
        'caro-classical',
        'Klassische Variante',
        'Classical Variation',
        'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6',
      ),
      line(
        'caro-advance',
        'Vorstoßvariante',
        'Advance Variation',
        'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6',
      ),
    ],
  },
  {
    id: 'queens-gambit',
    name: 'Damengambit',
    en: "Queen's Gambit",
    idea: 'Mit c4 greift Weiß den Bauern d5 an. Beide Seiten kämpfen um Entwicklung und Einfluss im Zentrum.',
    ideaEn: 'White attacks d5 with c4. Both sides compete for development and central influence.',
    lines: [
      line(
        'queens-declined',
        'Abgelehntes Damengambit',
        "Queen's Gambit Declined",
        'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7',
      ),
      line(
        'queens-accepted',
        'Angenommenes Damengambit',
        "Queen's Gambit Accepted",
        'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
      ),
    ],
  },
  {
    id: 'london',
    name: 'Londoner System',
    en: 'London System',
    idea: 'Baue d4, Lf4, e3 und Sf3 auf. Entwickle den Läufer vor e3 und achte trotzdem auf die gegnerischen Drohungen.',
    ideaEn:
      'Build with d4, Bf4, e3 and Nf3. Develop the bishop before e3 while watching your opponent’s threats.',
    lines: [
      line('london-d5', 'Gegen d5', 'Against d5', 'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6'),
      line('london-g6', 'Gegen g6', 'Against g6', 'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O Be2 d6 O-O c5'),
    ],
  },
  {
    id: 'kings-indian',
    name: 'Königsindische Verteidigung',
    en: "King's Indian Defense",
    idea: 'Schwarz entwickelt den Läufer nach g7 und greift das weiße Zentrum später mit e5 oder c5 an.',
    ideaEn: 'Black develops the bishop to g7 and later challenges White’s centre with e5 or c5.',
    lines: [
      line(
        'kings-classical',
        'Klassischer Aufbau',
        'Classical setup',
        'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6',
      ),
      line(
        'kings-saemisch',
        'Sämisch-Aufbau',
        'Sämisch setup',
        'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 c6',
      ),
    ],
  },
];
export function compileOpening(line: OpeningLine) {
  const chess = new Chess();
  const moves = line.moves.map((san) => uci(chess.move(san)));
  return { initialFen: DEFAULT_POSITION, moves, fen: chess.fen() };
}
export function openingProgressId(line: OpeningLine, color: Color) {
  return `opening:${line.id}:${color}`;
}
export function matchesOpeningMove(line: OpeningLine, played: string[], move: string) {
  const target = compileOpening(line).moves;
  return (
    played.length < target.length &&
    played.every((m, i) => m === target[i]) &&
    target[played.length] === move
  );
}
export function undoOpeningTurn(moves: string[], minimum: number, color: Color) {
  const next = moves.slice(0, Math.max(minimum, moves.length - 1));
  while (next.length > minimum && (next.length % 2 === 0 ? 'w' : 'b') !== color) next.pop();
  // Replaying here ensures callers never install an illegal history.
  const c = new Chess();
  for (const move of next) playUci(c, move);
  return next;
}
