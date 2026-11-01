'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { useStore } from './Provider';
import { moveSound } from '@/lib/sound';
import { Modal } from './Common';
export function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  const dark = color === 'b';
  return (
    <svg viewBox="0 0 64 64" className={'piece ' + (dark ? 'black' : 'white')} aria-hidden="true">
      <g
        fill={dark ? '#29292c' : '#f2f1ed'}
        stroke={dark ? '#d1d1cf' : '#323234'}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {type === 'p' && (
          <>
            <circle cx="32" cy="18" r="8" />
            <path d="M26 27h12l-2 13 7 9H21l7-9z" />
          </>
        )}
        {type === 'r' && (
          <>
            <path d="M18 11h7v7h7v-7h7v7h7v11l-7 5 1 12H24l1-12-7-5z" />
            <path d="M23 29h18M25 38h14" />
          </>
        )}
        {type === 'n' && (
          <>
            <path d="M20 45c0-13 11-12 12-23l-8 6-8-4 8-14 11-4 4 6c12 8 11 19 6 33z" />
            <path d="m23 14 1-8 7 4M22 24l8-5M31 32c10-2 12-10 7-16" />
            <circle cx="30" cy="15" r="1.6" fill={dark ? '#eee' : '#333'} stroke="none" />
          </>
        )}
        {type === 'b' && (
          <>
            <path d="M32 7c-4 5-12 12-12 19 0 6 5 10 12 10s12-4 12-10c0-7-8-14-12-19Z" />
            <path d="m35 17-7 11M26 37h12l-3 8 9 4H20l9-4z" />
            <circle cx="32" cy="7" r="2.3" />
          </>
        )}
        {type === 'q' && (
          <>
            <path d="m16 18 8 7 8-13 8 13 8-7-6 23H22z" />
            <circle cx="16" cy="16" r="3" />
            <circle cx="32" cy="9" r="3" />
            <circle cx="48" cy="16" r="3" />
            <path d="M22 42h20l-3 6H25zM25 34h14" />
          </>
        )}
        {type === 'k' && (
          <>
            <path d="M32 5v13M26 10h12M23 43c0-8-9-14-6-21 3-6 10-5 15 1 5-6 12-7 15-1 3 7-6 13-6 21z" />
            <path d="M24 34h16M24 43h16v5H24z" />
          </>
        )}
        <path d="M21 48h22l4 8H17z" />
        <path d="M17 56h30" />
      </g>
    </svg>
  );
}
const names: Record<PieceSymbol, string> = {
  p: 'Bauer',
  r: 'Turm',
  n: 'Springer',
  b: 'Läufer',
  q: 'Dame',
  k: 'König',
};
interface Props {
  fen: string;
  orientation?: Color;
  onMove?: (move: string) => void;
  disabled?: boolean;
  lastMove?: string;
  arrow?: string;
  label?: string;
}
export default function Chessboard({
  fen,
  orientation = 'w',
  onMove,
  disabled = false,
  lastMove,
  arrow,
  label = 'Schachbrett',
}: Props) {
  const { settings } = useStore();
  const game = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null),
    [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null),
    [drag, setDrag] = useState<{ piece: PieceSymbol; color: Color; x: number; y: number } | null>(
      null,
    );
  const root = useRef<HTMLDivElement>(null),
    pointer = useRef<{ from: Square; x: number; y: number; moved: boolean } | null>(null),
    skipClick = useRef(false);
  const marker = useId().replace(/:/g, '');
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
    setDrag(null);
    pointer.current = null;
  }, [fen]);
  const legal = selected ? game.moves({ square: selected, verbose: true }) : [];
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba',
    ranks = orientation === 'w' ? '87654321' : '12345678';
  const attempt = (from: Square, to: Square) => {
    if (disabled || !onMove) return;
    const choices = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!choices.length) {
      setSelected(game.get(to)?.color === game.turn() ? to : null);
      return;
    }
    if (choices.some((m) => m.promotion)) {
      setPromotion({ from, to });
      return;
    }
    setSelected(null);
    if (settings.sound) moveSound();
    onMove(from + to);
  };
  const click = (sq: Square) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (disabled || !onMove) return;
    if (selected && selected !== sq) attempt(selected, sq);
    else setSelected(game.get(sq)?.color === game.turn() ? (selected === sq ? null : sq) : null);
  };
  function point(square: string) {
    return { x: files.indexOf(square[0]) * 12.5 + 6.25, y: ranks.indexOf(square[1]) * 12.5 + 6.25 };
  }
  const a =
    arrow && /^[a-h][1-8][a-h][1-8]/.test(arrow)
      ? [point(arrow.slice(0, 2)), point(arrow.slice(2, 4))]
      : null;
  return (
    <div className={'board-shell ' + (settings.contrast ? 'high-contrast' : '')}>
      <div
        ref={root}
        className="chessboard"
        role="grid"
        aria-label={label}
        onPointerMove={(e) => {
          const p = pointer.current;
          if (!p || disabled) return;
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
          if (p.moved) {
            const piece = game.get(p.from);
            if (piece)
              setDrag({ piece: piece.type, color: piece.color, x: e.clientX, y: e.clientY });
          }
        }}
        onPointerUp={(e) => {
          const p = pointer.current;
          pointer.current = null;
          setDrag(null);
          if (!p?.moved) return;
          skipClick.current = true;
          const b = root.current!.getBoundingClientRect();
          const x = Math.floor(((e.clientX - b.left) / b.width) * 8),
            y = Math.floor(((e.clientY - b.top) / b.height) * 8);
          if (x >= 0 && x < 8 && y >= 0 && y < 8) attempt(p.from, (files[x] + ranks[y]) as Square);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(null);
        }}
      >
        {[...ranks].flatMap((rank, y) =>
          [...files].map((file, x) => {
            const sq = (file + rank) as Square,
              piece = game.get(sq),
              dark = (file.charCodeAt(0) + Number(rank)) % 2 === 0,
              possible = legal.some((m) => m.to === sq),
              last = lastMove?.slice(0, 2) === sq || lastMove?.slice(2, 4) === sq,
              check = piece?.type === 'k' && piece.color === game.turn() && game.isCheck();
            return (
              <button
                type="button"
                key={sq}
                role="gridcell"
                data-square={sq}
                aria-label={`${sq}${piece ? ', ' + (piece.color === 'w' ? 'Weiß: ' : 'Schwarz: ') + names[piece.type] : ', leer'}${possible ? ', möglicher Zug' : ''}`}
                aria-selected={selected === sq}
                className={`square ${dark ? 'dark' : 'light'} ${selected === sq ? 'selected' : ''} ${last ? 'last' : ''} ${check ? 'check' : ''}`}
                onClick={() => click(sq)}
                onPointerDown={(e) => {
                  if (e.button !== 0 || disabled || !onMove || piece?.color !== game.turn()) return;
                  pointer.current = { from: sq, x: e.clientX, y: e.clientY, moved: false };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onKeyDown={(e) => {
                  const delta = (
                    { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 } as Record<
                      string,
                      number
                    >
                  )[e.key];
                  if (delta !== undefined) {
                    e.preventDefault();
                    const buttons =
                      root.current!.querySelectorAll<HTMLButtonElement>('[data-square]');
                    buttons[Math.max(0, Math.min(63, y * 8 + x + delta))]?.focus();
                  }
                  if (e.key === 'Escape') setSelected(null);
                }}
              >
                {settings.coordinates && x === 0 && <span className="rank">{rank}</span>}
                {settings.coordinates && y === 7 && <span className="file">{file}</span>}
                {piece && <Piece type={piece.type} color={piece.color} />}{' '}
                {possible && <span className={piece ? 'capture-ring' : 'legal-dot'} />}
              </button>
            );
          }),
        )}
        {a && (
          <svg className="board-arrow" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker
                id={marker}
                markerWidth="4"
                markerHeight="4"
                refX="2.7"
                refY="2"
                orient="auto"
              >
                <path d="M0 0 4 2 0 4Z" fill="#fff" />
              </marker>
            </defs>
            <line
              x1={a[0].x}
              y1={a[0].y}
              x2={a[1].x}
              y2={a[1].y}
              stroke="#fff"
              strokeWidth="1.6"
              opacity=".85"
              markerEnd={`url(#${marker})`}
            />
          </svg>
        )}
      </div>
      {drag && (
        <div className="drag-piece" style={{ left: drag.x, top: drag.y }}>
          <Piece type={drag.piece} color={drag.color} />
        </div>
      )}
      {promotion && (
        <Modal title="Bauernumwandlung" onClose={() => setPromotion(null)}>
          <strong>In welche Figur umwandeln?</strong>
          <div className="button-row">
            {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
              <button
                key={t}
                autoFocus={t === 'q'}
                className="promotion-option"
                aria-label={names[t]}
                onClick={() => {
                  if (settings.sound) moveSound();
                  onMove?.(promotion.from + promotion.to + t);
                  setPromotion(null);
                  setSelected(null);
                }}
              >
                <Piece type={t} color={game.turn()} />
              </button>
            ))}
          </div>
          <button className="text-button" onClick={() => setPromotion(null)}>
            Abbrechen
          </button>
        </Modal>
      )}
    </div>
  );
}
