import { DEFAULT_POSITION } from './chess';
export interface Lesson {
  id: string;
  group: string;
  title: string;
  goal: string;
  text: string;
  minutes: number;
  theme?: string;
  position?: { fen: string; moves: string[]; answers: string[] };
}
export const LESSONS: Lesson[] = [
  {
    id: 'center',
    group: 'Die Grundlagen',
    title: 'Das Zentrum gehört ins Blickfeld',
    goal: 'Besetze das Zentrum mit einem Bauern.',
    text: 'Die Felder e4, d4, e5 und d5 sind das Zentrum. Bauern dort nehmen Raum und öffnen Linien für Figuren. Beginne mit e4 oder d4.',
    minutes: 3,
    position: { fen: DEFAULT_POSITION, moves: [], answers: ['e2e4', 'd2d4'] },
  },
  {
    id: 'development',
    group: 'Die Grundlagen',
    title: 'Entwickle deine Leichtfiguren',
    goal: 'Entwickle einen Springer zu einem aktiven Feld.',
    text: 'Springer und Läufer sollen am Spiel teilnehmen. Nach 1. e4 e5 entwickelt Sf3 eine Figur und greift e5 an; Sc3 ist ebenfalls ein sinnvoller Entwicklungszug.',
    minutes: 3,
    position: { fen: DEFAULT_POSITION, moves: ['e2e4', 'e7e5'], answers: ['g1f3', 'b1c3'] },
  },
  {
    id: 'king',
    group: 'Die Grundlagen',
    title: 'Bring deinen König in Sicherheit',
    goal: 'Führe die kurze Rochade aus.',
    text: 'Bei der Rochade zieht der König zwei Felder zum Turm. Der König darf weder im Schach stehen noch durch ein angegriffenes Feld ziehen. König und beteiligter Turm dürfen noch nicht gezogen haben.',
    minutes: 4,
    position: {
      fen: DEFAULT_POSITION,
      moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'],
      answers: ['e1g1'],
    },
  },
  {
    id: 'hanging',
    group: 'Taktisch denken',
    title: 'Ungedeckte Figuren erkennen',
    goal: 'Finde den konkreten Materialgewinn.',
    text: 'Zähle Angreifer und Verteidiger. Eine ungedeckte Figur ist ein mögliches Ziel. Prüfe aber zuerst gegnerische Schachgebote und stärkere Drohungen.',
    minutes: 4,
    theme: 'hangingPiece',
  },
  {
    id: 'fork',
    group: 'Taktisch denken',
    title: 'Zwei Ziele, ein Zug',
    goal: 'Löse eine Kombination mit Doppelangriff.',
    text: 'Eine Gabel bedroht mehrere Ziele zugleich. Besonders wirksam ist der Angriff auf König und eine andere Figur, weil Schach sofort beantwortet werden muss.',
    minutes: 5,
    theme: 'fork',
  },
  {
    id: 'pin',
    group: 'Taktisch denken',
    title: 'Die Kraft der Fesselung',
    goal: 'Nutze eine gefesselte Figur.',
    text: 'Eine Figur ist gefesselt, wenn ihr Wegziehen eine stärkere Figur oder ein entscheidendes Feld freigibt. Bei einer Fesselung vor dem König kann das Wegziehen sogar illegal sein.',
    minutes: 5,
    theme: 'pin',
  },
  {
    id: 'overload',
    group: 'Taktisch denken',
    title: 'Ein Verteidiger, zwei Aufgaben',
    goal: 'Nutze den überlasteten Turm.',
    text: 'Der Turm g7 deckt die Dame h7 und schützt die achte Reihe. Erzwinge mit einem Schachgebot, dass er eine dieser Aufgaben aufgeben muss. Berechne bis zum Matt.',
    minutes: 4,
    theme: 'overloading',
  },
  {
    id: 'calculate',
    group: 'Taktisch denken',
    title: 'Kandidatenzüge berechnen',
    goal: 'Berechne bis zum Ende der Kombination.',
    text: 'Sammle zuerst Kandidaten: Schachgebote, Schlagzüge und Drohungen. Berechne für jeden Kandidaten die stärkste gegnerische Antwort. Bewerte erst die Endstellung.',
    minutes: 6,
    theme: 'mateIn2',
  },
  {
    id: 'mate',
    group: 'Hades · Die Endspiele',
    title: 'Matt mit König und Dame',
    goal: 'Setze mit der Dame in einem Zug matt.',
    text: 'König und Dame müssen zusammenarbeiten. Nimm dem gegnerischen König Fluchtfelder. Vermeide Patt: Ohne Schach und ohne legalen Zug ist die Partie remis.',
    minutes: 4,
    position: { fen: '7k/8/4Q1K1/8/8/8/8/8 w - - 0 1', moves: [], answers: ['e6e8'] },
  },
  {
    id: 'pawns',
    group: 'Hades · Die Endspiele',
    title: 'Bauern ins Ziel bringen',
    goal: 'Löse eine Stellung aus einem Bauernendspiel.',
    text: 'In Bauernendspielen zählen Königaktivität und Zugreihenfolge. Berechne, ob dein König rechtzeitig hilft und ob ein gegnerischer Freibauer zuerst umwandelt.',
    minutes: 6,
    theme: 'pawnEndgame',
  },
  {
    id: 'rook',
    group: 'Hades · Die Endspiele',
    title: 'Aktive Türme',
    goal: 'Finde den entscheidenden Zug im Turmendspiel.',
    text: 'Ein aktiver Turm greift Bauern an und schränkt den gegnerischen König ein. Die passende konkrete Fortsetzung ist wichtiger als ein pauschaler Merksatz.',
    minutes: 6,
    theme: 'rookEndgame',
  },
  {
    id: 'time',
    group: 'Chronos · Entscheidungen',
    title: 'Unter Zeitdruck klar denken',
    goal: 'Erkenne ein direktes Mattbild.',
    text: 'Vor jedem schnellen Zug: Steht mein König im Schach? Droht Matt oder Materialverlust? Suche zuerst forcierte Züge. Trainiere anschließend im Drei-Minuten-Modus.',
    minutes: 3,
    theme: 'mateIn1',
  },
];
