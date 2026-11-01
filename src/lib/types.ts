import type { Color } from 'chess.js';
export type Section =
  | 'start'
  | 'training'
  | 'puzzles'
  | 'arena'
  | 'analyse'
  | 'akademie'
  | 'fortschritt'
  | 'profil';
export type Kind =
  | 'settings'
  | 'attempt'
  | 'game'
  | 'analysis'
  | 'lesson'
  | 'review'
  | 'session'
  | 'mistake';
export interface RecordItem<T = unknown> {
  id: string;
  kind: Kind;
  value: T;
  updatedAt: number;
  deviceId: string;
  pending: boolean;
}
export interface Settings {
  name: string;
  goal: 10 | 20 | 30;
  sound: boolean;
  motion: boolean;
  coordinates: boolean;
  contrast: boolean;
}
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  alternatives?: string[][];
  rating: number;
  themes: string[];
  url: string;
}
export interface Attempt {
  puzzleId: string;
  rating: number;
  themes: string[];
  success: boolean;
  hints: number;
  errors: number;
  seconds: number;
  at: number;
  mode: string;
}
export interface GameRecord {
  id: string;
  initialFen: string;
  moves: string[];
  level: number;
  color: Color;
  clock: string;
  remaining: { w: number; b: number };
  clockHistory?: { w: number; b: number }[];
  increment: number;
  turnStarted: number | null;
  paused: boolean;
  result: string | null;
  reason?: string;
  assists: number;
  createdAt: number;
  updatedAt: number;
  live: boolean;
}
export interface Position {
  initialFen: string;
  moves: string[];
}
export interface EngineScore {
  cp?: number;
  mate?: number;
  wdl?: [number, number, number];
  bound?: boolean;
}
export interface EngineLine {
  move: string;
  pv: string[];
  score: EngineScore;
  depth: number;
  nodes: number;
  rank: number;
}
export interface SearchResult {
  bestMove: string;
  lines: EngineLine[];
  engine: string;
  budget: number;
}
export interface MoveQuality {
  ply: number;
  move: string;
  san: string;
  bestMove: string;
  bestSan: string;
  quality: number;
  label: string;
  explanation: string;
  before: EngineScore;
  played: EngineScore;
  cpLoss: number | null;
  method: 'WDL' | 'Näherung';
  depth: number;
  confidence: 'normal' | 'gering';
  budget: number;
  engine: string;
  pv: string[];
  whiteCp: number | null;
  whiteMate: number | null;
}
export interface AnalysisRecord {
  gameId: string;
  initialFen: string;
  moves: string[];
  budget: number;
  results: MoveQuality[];
  complete: boolean;
  updatedAt: number;
}
export interface LessonResult {
  lessonId: string;
  completed: boolean;
  at: number;
}
export interface Mistake {
  initialFen: string;
  moves: string[];
  answer: string;
  gameId: string;
  ply: number;
  san: string;
  done?: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  name: 'Gast',
  goal: 20,
  sound: false,
  motion: true,
  coordinates: true,
  contrast: false,
};
