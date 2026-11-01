export const GODS = [
  'Hermes',
  'Hebe',
  'Iris',
  'Hestia',
  'Demeter',
  'Persephone',
  'Dionysos',
  'Artemis',
  'Apollon',
  'Chronos',
  'Hephaistos',
  'Ares',
  'Triton',
  'Poseidon',
  'Hekate',
  'Hera',
  'Hades',
  'Prometheus',
  'Athene',
  'Zeus',
] as const;
const DESCRIPTIONS = [
  'Ein leichter Einstieg. Entdecke freie Figuren.',
  'Ruhig spielen, erste Chancen erkennen.',
  'Übe einfache Angriffe und sichere Züge.',
  'Halte dein Zentrum und deinen König zusammen.',
  'Baue deine Stellung geduldig auf.',
  'Nutze schwache Felder und kleine Kombinationen.',
  'Ein unberechenbarer Trainingspartner.',
  'Präzision und ein Blick für ungedeckte Figuren.',
  'Verbinde Entwicklung mit konkreten Drohungen.',
  'Plane voraus und nutze deine Bedenkzeit.',
  'Solides Spiel und zähe Verteidigung.',
  'Taktische Wachsamkeit in jedem Zug.',
  'Ein anspruchsvoller Test deiner Berechnung.',
  'Druck auf der ganzen Brettbreite.',
  'Tiefe Varianten und versteckte Ressourcen.',
  'Strategische Ruhe und genaue Verteidigung.',
  'Wenig Raum für ungenaue Züge.',
  'Finde aktive Lösungen gegen starken Widerstand.',
  'Sehr hohe Spielstärke und präzise Berechnung.',
  'Die stärkste lokale Herausforderung.',
];
export const BOTS = GODS.map((name, i) => ({
  level: i + 1,
  name,
  description: DESCRIPTIONS[i],
  skill: Math.round((i * 20) / 19),
  nodes: Math.round(256 * Math.pow(2, i * 0.63)),
  multiPV: i < 7 ? 8 : i < 12 ? 5 : i < 16 ? 3 : 1,
  errorRate: Math.max(0, (14 - i) / 16),
}));
export const ANALYSIS_BUDGETS = { Schnell: 40000, Standard: 120000, Gründlich: 400000 } as const;
export const ANALYSIS_CONFIG = { skill: 20, multiPV: 1, nodes: 120000 };
export function pickCandidate(level: number, moves: string[], fen: string) {
  const bot = BOTS[level - 1];
  let hash = 2166136261;
  for (const c of fen) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const random = (hash >>> 0) / 4294967296;
  return random < bot.errorRate
    ? moves[Math.min(moves.length - 1, 1 + ((hash >>> 9) % Math.max(1, moves.length - 1)))]
    : moves[0];
}
