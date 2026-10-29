// The premium HQ floor plan (3D office): 24 x 16 floor units, one unit is 0.8 m.
//
//   back:   boardroom | atrium (lift, pipeline board, cooler) | café | server room | manager cabin
//   middle: lounge | developer zone (6 desks) | sales & support (4 desks) | play area
//   front:  mail room | focus pods | reception | support & DevOps (3 desks)
//
// Corridors run along y = 5.0 and y = 10.6 with cross aisles at y = 7.7 and x = 4.75 / 14.25 / 20.25.
import { makeLayout, type Pt } from './sim';

export const HQ_W = 24;
export const HQ_D = 16;

// Desks: developers (0-5), sales (6-9), support & DevOps (10-12). Seats face the back wall.
const DEV_X = [5.2, 8.0, 10.8];
const SALES_X = [15.0, 17.6];
const FUTURE_X = [15.8, 18.6, 21.4];
export const HQ_DESKS: Pt[] = [
  ...DEV_X.map((x) => [x, 5.4] as Pt),
  ...DEV_X.map((x) => [x, 8.0] as Pt),
  ...SALES_X.map((x) => [x, 5.4] as Pt),
  ...SALES_X.map((x) => [x, 8.0] as Pt),
  ...FUTURE_X.map((x) => [x, 11.6] as Pt),
];
export const HQ_ZONES = {
  developers: [0, 1, 2, 3, 4, 5],
  sales: [6, 7, 8, 9],
  future: [10, 11, 12],
};
/** Café bar stools, facing the island. */
export const HQ_PANTRY: Pt[] = [[12.9, 2.8], [13.7, 2.8], [14.5, 2.8]];
/** Manager's chair, behind the desk, facing the room. */
export const HQ_CABIN: Pt = [22.3, 1.1];
/** The visitor's chair in the boardroom. */
export const HQ_GUEST: Pt = [2.0, 0.9];

const N: Record<string, Pt> = {
  // Corridor along the back rooms.
  a0: [0.6, 5.0], aV1: [4.75, 5.0], aLift: [7.6, 5.0], aBoard: [9.0, 5.0], aCafe: [11.0, 5.0],
  aV2: [14.25, 5.0], aServer: [17.0, 5.0], aV3: [20.25, 5.0], aCabin: [21.0, 5.0], aEnd: [23.4, 5.0],
  // Boardroom.
  mi: [4.75, 3.9], ms1: [4.0, 1.8], ms2: [4.0, 2.8],
  // Atrium: lift, pipeline board, water cooler.
  li: [7.0, 0.9], bo: [9.0, 0.9], bo2: [8.3, 1.5], co: [6.9, 2.8], co2: [7.5, 3.3],
  // Café.
  pi: [11.0, 3.9], coffee: [11.6, 1.2], chatP1: [10.6, 2.0], chatP2: [11.3, 2.5],
  // Server room.
  sv: [17.0, 3.4],
  // Manager cabin.
  ci: [21.0, 4.0], ca: [21.0, 1.4], cs: [21.6, 1.15], cv: [22.4, 3.6],
  // Cross aisle between the desk rows, and the connectors.
  rA0: [4.75, 7.7], rAV2: [14.25, 7.7], rAV3: [20.25, 7.7], pv: [20.25, 8.6],
  // Lounge.
  lo1: [2.2, 7.2], lo2: [3.2, 8.6], w3: [0.8, 9.6],
  // Play area.
  pl1: [20.6, 6.4], pm: [22.0, 7.6], pr: [23.7, 7.6], pl2: [23.6, 6.4], fz1: [21.0, 8.6], fz2: [23.1, 8.6], tv: [22.3, 9.9],
  // Front corridor.
  b0: [0.6, 10.6], bMail: [3.0, 10.6], bV1: [4.75, 10.6], bFocus: [7.2, 10.6], bRecep: [12.6, 10.6],
  bV2: [14.25, 10.6], bFut: [15.3, 10.6], bV3: [20.25, 10.6], bPlay: [22.3, 10.6], bEnd: [23.4, 10.6],
  // Mail room, focus pods, reception.
  md: [3.0, 11.5], mm: [2.4, 13.2], mm2: [3.4, 14.3], fo: [7.2, 12.8], rc: [12.6, 12.0],
  // Future teams aisle.
  f0: [15.3, 13.9],
  // Seat approach spots.
  ps0: [12.9, 3.7], ps1: [13.7, 3.7], ps2: [14.5, 3.7],
};
HQ_DESKS.forEach(([dx, dy], i) => {
  // Back-row desks open onto the cross aisle, middle-row desks onto the front corridor, future desks onto their aisle.
  const y = dy < 7 ? 7.7 : dy < 10 ? 10.6 : 13.9;
  N[`s${i}`] = [dx + 0.83, y];
});

const E: [string, string][] = [
  ['a0', 'aV1'], ['aV1', 'aLift'], ['aLift', 'aBoard'], ['aBoard', 'aCafe'], ['aCafe', 'aV2'],
  ['aV2', 'aServer'], ['aServer', 'aV3'], ['aV3', 'aCabin'], ['aCabin', 'aEnd'],
  ['aV1', 'mi'], ['mi', 'ms1'], ['mi', 'ms2'],
  ['aLift', 'li'], ['aBoard', 'bo'], ['aBoard', 'bo2'], ['aLift', 'co'], ['aLift', 'co2'],
  ['aCafe', 'pi'], ['pi', 'coffee'], ['pi', 'chatP1'], ['pi', 'chatP2'], ['pi', 'ps0'], ['ps0', 'ps1'], ['ps1', 'ps2'],
  ['aServer', 'sv'],
  ['aCabin', 'ci'], ['ci', 'ca'], ['ca', 'cs'], ['ci', 'cv'],
  // Connectors and the cross aisle (desk spots s0-s2 and s6-s7 sit on it).
  ['aV1', 'rA0'], ['rA0', 'bV1'], ['aV2', 'rAV2'], ['rAV2', 'bV2'], ['aV3', 'rAV3'], ['rAV3', 'pv'], ['pv', 'bV3'],
  ['rA0', 's0'], ['s0', 's1'], ['s1', 's2'], ['s2', 'rAV2'], ['rAV2', 's6'], ['s6', 's7'], ['s7', 'rAV3'],
  ['rA0', 'lo1'], ['rA0', 'lo2'], ['lo2', 'w3'],
  ['pv', 'pl1'], ['pv', 'fz1'], ['pv', 'pm'], ['pm', 'pr'], ['pr', 'pl2'], ['pr', 'fz2'],
  // Front corridor (desk spots s3-s5 and s8-s9 sit on it).
  ['b0', 'bMail'], ['bMail', 'bV1'], ['bV1', 's3'], ['s3', 'bFocus'], ['bFocus', 's4'], ['s4', 's5'], ['s5', 'bRecep'],
  ['bRecep', 'bV2'], ['bV2', 'bFut'], ['bFut', 's8'], ['s8', 's9'], ['s9', 'bV3'], ['bV3', 'bPlay'], ['bPlay', 'bEnd'],
  ['bPlay', 'tv'], ['bMail', 'md'], ['md', 'mm'], ['md', 'mm2'], ['bFocus', 'fo'], ['bRecep', 'rc'],
  ['bFut', 'f0'], ['f0', 's10'], ['s10', 's11'], ['s11', 's12'],
];

export const HQ = makeLayout({
  desks: HQ_DESKS,
  pantrySeats: HQ_PANTRY,
  cabinSeat: HQ_CABIN,
  nodes: N,
  edges: E,
  start: 'aLift',
  // The delivery team: the lead and the developer in the developer zone, QA beside support and DevOps (front right).
  reserved: { 'team-lead': 0, developer: 1, 'support-desk': 10, 'devops-watch': 11, 'qa-tester': 12 },
  spots: {
    board: ['bo', 'bo2'],
    mail: 'mm',
    cabinVisit: 'cv',
    coffee: 'coffee',
    idle: [
      { to: 'coffee', face: '-y', bubble: 'Coffee break' },
      { to: 'w3', face: '-x' },
      { to: 'bo', face: '-y', bubble: 'Checking the pipeline' },
      { to: 'li', face: '-y' },
      { to: 'sv', face: '-y', bubble: 'Checking the servers' },
      { to: 'lo1', face: '-x', bubble: 'Short break' },
      { to: 'pl1', face: '+x', bubble: 'One quick game' },
      { to: 'tv', face: '+x', bubble: 'Gaming break' },
      { to: 'fo', face: '+y', bubble: 'Deep focus' },
    ],
    chatPairs: [['chatP1', 'chatP2'], ['co', 'co2'], ['ms1', 'ms2'], ['lo1', 'lo2'], ['fz1', 'fz2'], ['pl1', 'pl2']],
  },
});

/** Room names and where their labels sit (floor units; y is height in metres). */
export const HQ_ROOMS = [
  { key: 'board', name: 'Boardroom', at: [3.0, 4.6] as Pt, h: 0.05 },
  { key: 'cafe', name: 'Café', at: [13.0, 4.6] as Pt, h: 0.05 },
  { key: 'server', name: 'Server room', at: [18.0, 4.6] as Pt, h: 0.05 },
  { key: 'cabin', name: 'Manager cabin', at: [22.2, 4.7] as Pt, h: 0.05 },
  { key: 'lounge', name: 'Lounge', at: [2.2, 10.2] as Pt, h: 0.05 },
  { key: 'dev', name: 'Developers', at: [9.6, 10.2] as Pt, h: 0.05 },
  { key: 'sales', name: 'Sales', at: [17.3, 10.2] as Pt, h: 0.05 },
  { key: 'play', name: 'Play area', at: [22.2, 10.2] as Pt, h: 0.05 },
  { key: 'mail', name: 'Mail room', at: [2.2, 15.6] as Pt, h: 0.05 },
  { key: 'focus', name: 'Focus pods', at: [7.0, 15.6] as Pt, h: 0.05 },
  { key: 'reception', name: 'Reception', at: [12.3, 15.6] as Pt, h: 0.05 },
  { key: 'future', name: 'Support, QA & DevOps', at: [19.6, 15.6] as Pt, h: 0.05 },
] as const;
