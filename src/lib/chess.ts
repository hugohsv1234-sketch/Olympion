import {
  Chess,
  DEFAULT_POSITION,
  type Color,
  type Move,
  type Square,
  type PieceSymbol,
} from 'chess.js';
import type { GameRecord, Position } from './types';
export { DEFAULT_POSITION };
export function uci(m: Move) {
  return m.from + m.to + (m.promotion || '');
}
export function playUci(chess: Chess, move: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) throw new Error('Ungültiger Zug: ' + move);
  return chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
}
export function restore(position: Position): Chess {
  const g = new Chess(position.initialFen);
  assertLegalPosition(g);
  for (const m of position.moves) playUci(g, m);
  return g;
}
export function assertLegalPosition(chess: Chess) {
  const other = chess.turn() === 'w' ? 'b' : 'w';
  const king = chess
    .board()
    .flat()
    .find((p) => p?.color === other && p.type === 'k');
  if (!king || chess.isAttacked(king.square, chess.turn()))
    throw new Error('Ungültige Stellung: Der nicht am Zug befindliche König steht im Schach.');
}
export function notation(position: Position, line: string[]) {
  const g = restore(position);
  const out: string[] = [];
  for (const m of line) {
    try {
      out.push(playUci(g, m).san);
    } catch {
      break;
    }
  }
  return out.join(' ');
}
export function sanOf(position: Position, move: string) {
  try {
    return playUci(restore(position), move).san;
  } catch {
    return move;
  }
}
function repetitionKey(fen: string) {
  return fen.split(' ').slice(0, 4).join(' ');
}
export function repetitions(chess: Chess) {
  const replay = new Chess(chess.history({ verbose: true })[0]?.before || chess.fen());
  const keys = [repetitionKey(replay.fen())];
  for (const m of chess.history({ verbose: true })) {
    replay.move(m);
    keys.push(repetitionKey(replay.fen()));
  }
  const current = keys.at(-1);
  return keys.filter((k) => k === current).length;
}
export function automaticResult(chess: Chess): { result: string; reason: string } | null {
  if (chess.isCheckmate())
    return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'Schachmatt' };
  if (chess.isStalemate()) return { result: '½-½', reason: 'Patt' };
  if (chess.isInsufficientMaterial()) return { result: '½-½', reason: 'Unzureichendes Material' };
  if (Number(chess.fen().split(' ')[4]) >= 150) return { result: '½-½', reason: '75-Züge-Regel' };
  if (repetitions(chess) >= 5) return { result: '½-½', reason: 'Fünffache Stellungswiederholung' };
  return null;
}
export function claimReason(chess: Chess) {
  if (chess.isThreefoldRepetition()) return 'Dreifache Stellungswiederholung';
  if (Number(chess.fen().split(' ')[4]) >= 100) return '50-Züge-Regel';
  return null;
}
export function intendedClaims(chess: Chess) {
  if (automaticResult(chess)) return [];
  return chess.moves({ verbose: true }).flatMap((m) => {
    chess.move(m);
    const reason = claimReason(chess);
    chess.undo();
    return reason ? [{ move: uci(m), san: m.san, reason }] : [];
  });
}
export function timeoutResult(chess: Chess, flag: Color) {
  const winner = flag === 'w' ? 'b' : 'w';
  const own = chess
    .board()
    .flat()
    .filter((p) => p?.color === winner)
    .map((p) => p!.type);
  const enemy = chess
    .board()
    .flat()
    .filter((p) => p?.color === flag);
  const cannotMate =
    own.length === 1 ||
    (enemy.length === 1 && own.length === 2 && own.some((t) => t === 'b' || t === 'n'));
  return {
    result: cannotMate ? '½-½' : winner === 'w' ? '1-0' : '0-1',
    reason: cannotMate ? 'Zeit abgelaufen; Gegner kann nicht mattsetzen' : 'Zeit abgelaufen',
  };
}
export function getRemaining(game: GameRecord, now = Date.now()) {
  const r = { ...game.remaining };
  if (!game.paused && !game.result && game.turnStarted !== null) {
    const side =
      game.moves.length % 2 === 0
        ? new Chess(game.initialFen).turn()
        : new Chess(game.initialFen).turn() === 'w'
          ? 'b'
          : 'w';
    r[side] = Math.max(0, r[side] - Math.max(0, now - game.turnStarted));
  }
  return r;
}
export function importNotation(input: string): Position {
  if (input.length > 200000) throw new Error('Maximal 200 KB pro PGN oder FEN.');
  const text = input.trim();
  if (!text) throw new Error('Bitte eine PGN oder FEN einfügen.');
  const game = new Chess();
  try {
    if (/^[prnbqkPRNBQK1-8/]+\s[wb]\s/.test(text)) game.load(text);
    else game.loadPgn(text);
  } catch {
    throw new Error('Die PGN oder FEN ist ungültig. Bitte Notation und Zugfolge prüfen.');
  }
  assertLegalPosition(game);
  const hist = game.history({ verbose: true });
  assertLegalPosition(new Chess(hist[0]?.before || game.fen()));
  if (hist.length > 500)
    throw new Error('Maximal 500 Halbzüge. Bitte eine kürzere Partie verwenden.');
  return { initialFen: hist[0]?.before || game.fen(), moves: hist.map(uci) };
}
export function gamePgn(game: GameRecord) {
  const c = restore(game);
  c.header(
    'Event',
    'OLYMPION Arena',
    'White',
    game.color === 'w' ? 'Spieler' : 'Bot Stufe ' + game.level,
    'Black',
    game.color === 'b' ? 'Spieler' : 'Bot Stufe ' + game.level,
    'Result',
    game.result?.replace('½-½', '1/2-1/2') || '*',
  );
  return c.pgn();
}
export function captured(chess: Chess, color: Color) {
  return chess
    .history({ verbose: true })
    .filter((m) => m.color === color && m.captured)
    .map((m) => m.captured!);
}
export function legalFrom(chess: Chess, square: Square) {
  return chess.moves({ square, verbose: true });
}
export type Promotion = Extract<PieceSymbol, 'q' | 'r' | 'b' | 'n'>;
