import { Chess, type Color, type Square } from 'chess.js';
export function possiblePremove(fen: string, move: string, color: Color) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return false;
  const game = new Chess(fen),
    from = move.slice(0, 2) as Square,
    to = move.slice(2, 4) as Square;
  const piece = game.get(from),
    target = game.get(to);
  if (
    !piece ||
    piece.color !== color ||
    from === to ||
    target?.color === color ||
    target?.type === 'k'
  )
    return false;
  const dx = Math.abs(to.charCodeAt(0) - from.charCodeAt(0)),
    dy = Number(to[1]) - Number(from[1]);
  const y = Math.abs(dy);
  if (piece.type !== 'p' && move.length === 5) return false;
  if (piece.type === 'p') {
    const direction = color === 'w' ? 1 : -1;
    const promotes = Number(to[1]) === (color === 'w' ? 8 : 1);
    if (promotes !== (move.length === 5)) return false;
    return (
      (dy === direction && dx <= 1) ||
      (dx === 0 && dy === 2 * direction && from[1] === (color === 'w' ? '2' : '7'))
    );
  }
  if (piece.type === 'n') return dx * y === 2;
  if (piece.type === 'k')
    return (dx <= 1 && y <= 1) || (from === (color === 'w' ? 'e1' : 'e8') && y === 0 && dx === 2);
  if (piece.type === 'b' && dx !== y) return false;
  if (piece.type === 'r' && dx !== 0 && y !== 0) return false;
  if (piece.type === 'q' && dx !== y && dx !== 0 && y !== 0) return false;
  const sx = Math.sign(to.charCodeAt(0) - from.charCodeAt(0)),
    sy = Math.sign(dy);
  for (
    let x = from.charCodeAt(0) + sx, rank = Number(from[1]) + sy;
    x !== to.charCodeAt(0) || rank !== Number(to[1]);
    x += sx, rank += sy
  ) {
    if (game.get((String.fromCharCode(x) + rank) as Square)?.color === color) return false;
  }
  return true;
}
export function legalQueuedMove(fen: string, move: string, color: Color) {
  try {
    const game = new Chess(fen);
    if (game.turn() !== color || game.isGameOver()) return false;
    return Boolean(game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
  } catch {
    return false;
  }
}
