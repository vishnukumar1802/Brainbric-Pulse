// The 3D office, laid out on exactly the same floor plan as the 2D office and the movement engine (sim.ts), so the
// walking routes, desks, pantry stools and cabin chair line up. One floor unit is 0.8 m.
import * as THREE from 'three';
import type { FloorKey } from '@/lib/office';
import { CABIN_SEAT, DESKS, PANTRY_SEATS } from '../office/sim';

export const U = 0.8;
export const ROOM_W = 18;
export const ROOM_D = 14;

const THEMES: Record<FloorKey, { tiles: [string, string]; wall: string; accent: string; rooms: [string, string, string, string] }> = {
  g: { tiles: ['#e4e9ec', '#dbe2e6'], wall: '#f4f1ec', accent: '#ff5a1f', rooms: ['#d5e7dc', '#efe2cf', '#ddd6ee', '#f2e4c6'] },
  f: { tiles: ['#f1e8da', '#e9dfcd'], wall: '#f7f2f7', accent: '#7f77dd', rooms: ['#e4ddf4', '#f2e3cf', '#e8dcef', '#f3e6c8'] },
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.75, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${JSON.stringify(extra)}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    mats.set(key, m);
  }
  return m;
}
const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.2, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });

/** A box in floor units: x/z along the floor, y and h in metres. */
function box(g: THREE.Group, x: number, z: number, w: number, d: number, y: number, h: number, m: THREE.Material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * U, h, d * U), m);
  mesh.position.set((x + w / 2) * U, y + h / 2, (z + d / 2) * U);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

function tilesTexture(a: string, b: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? a : b;
      x.fillRect(i * 64, j * 64, 64, 64);
    }
  x.strokeStyle = 'rgba(0,0,0,0.05)';
  x.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM_W / 2, ROOM_D / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plant(g: THREE.Group, x: number, z: number) {
  box(g, x, z, 0.42, 0.42, 0, 0.36, mat('#e7e1d6'));
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), mat('#4e9a5c', 0.9));
  f.position.set((x + 0.21) * U, 0.62, (z + 0.21) * U);
  f.castShadow = true;
  g.add(f);
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), mat('#69b874', 0.9));
  f2.position.set((x + 0.25) * U, 0.88, (z + 0.17) * U);
  f2.castShadow = true;
  g.add(f2);
}

function chair(g: THREE.Group, cx: number, cz: number, facing: 'up' | 'down', color = '#3b4252') {
  // cx/cz: seat centre in floor units. "up" means the person faces the back wall (desks), "down" faces the viewer.
  const seatW = 0.62;
  box(g, cx - seatW / 2, cz - seatW / 2, seatW, seatW, 0.42, 0.07, mat(color));
  const backZ = facing === 'up' ? cz + seatW / 2 - 0.08 : cz - seatW / 2;
  box(g, cx - seatW / 2, backZ, seatW, 0.08, 0.49, 0.5, mat(color));
  box(g, cx - 0.05, cz - 0.05, 0.1, 0.1, 0.05, 0.37, mat('#222222', 0.5));
  box(g, cx - 0.3, cz - 0.3, 0.6, 0.6, 0, 0.05, mat('#222222', 0.5));
}

export type RoomHandles = { group: THREE.Group; screens: THREE.Mesh[]; tray: THREE.Mesh; liftLight: THREE.Mesh };

export function buildRoom(floor: FloorKey): RoomHandles {
  const th = THEMES[floor];
  const g = new THREE.Group();
  const screens: THREE.Mesh[] = [];
  const wood = mat('#c99a63', 0.6);
  const darkWood = mat('#7b5537', 0.6);
  const metal = mat('#2d3038', 0.4, { metalness: 0.3 });

  // Slab, tiles and room floors.
  box(g, -0.25, -0.25, ROOM_W + 0.5, ROOM_D + 0.5, -0.3, 0.3, mat('#3a3a3c'), false);
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * U, ROOM_D * U), new THREE.MeshStandardMaterial({ map: tilesTexture(...th.tiles), roughness: 0.9 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set((ROOM_W / 2) * U, 0.001, (ROOM_D / 2) * U);
  floorMesh.receiveShadow = true;
  g.add(floorMesh);
  const roomFloor = (x: number, z: number, w: number, d: number, c: string) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * U, d * U), mat(c, 0.95));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x + w / 2) * U, 0.003, (z + d / 2) * U);
    m.receiveShadow = true;
    g.add(m);
  };
  roomFloor(0, 0, 6, 4.8, th.rooms[0]);
  roomFloor(13, 0, 5, 4.8, th.rooms[1]);
  roomFloor(13, 4.8, 5, 5, th.rooms[2]);
  roomFloor(13, 9.8, 5, 4.2, th.rooms[3]);

  // Walls with windows and the accent stripe.
  const wall = mat(th.wall, 0.9);
  box(g, 0, -0.2, ROOM_W, 0.2, 0, 2.6, wall);
  box(g, -0.2, -0.2, 0.2, ROOM_D + 0.2, 0, 2.6, wall);
  const accent = mat(th.accent, 0.5);
  box(g, 0, -0.01, ROOM_W, 0.02, 2.4, 0.13, accent, false);
  box(g, -0.01, 0, 0.02, ROOM_D, 2.4, 0.13, accent, false);
  const win = mat('#bfe0f0', 0.1, { emissive: '#9fd0ea', emissiveIntensity: 0.25 });
  for (const [a, b] of [[1, 3], [3.4, 5.4], [13.6, 15.6]]) box(g, a, -0.01, b - a, 0.02, 0.95, 1.2, win, false);
  for (const z of [5.4, 8.4, 11.4]) box(g, -0.01, z, 0.02, 2, 0.95, 1.2, win, false);

  // Lift doors and light, and the pipeline board with sticky notes.
  box(g, 7.3, -0.02, 2.4, 0.03, 0, 2.15, mat('#8f99a4', 0.4, { metalness: 0.4 }), false);
  box(g, 7.45, 0.0, 1.0, 0.02, 0.02, 2.05, mat('#cdd5dc', 0.3, { metalness: 0.5 }), false);
  box(g, 8.55, 0.0, 1.0, 0.02, 0.02, 2.05, mat('#cdd5dc', 0.3, { metalness: 0.5 }), false);
  const liftLight = box(g, 8.3, 0.0, 0.4, 0.02, 2.2, 0.1, mat('#ffcc4d', 0.3, { emissive: '#ffcc4d', emissiveIntensity: 0.8 }), false);
  box(g, 10.2, -0.01, 2.4, 0.03, 0.95, 1.1, mat('#ffffff', 0.6), false);
  [['#ff8a5c', 4], ['#ffd166', 3], ['#7cc6fe', 2], ['#8be0a4', 2]].forEach(([c, n], i) => {
    for (let k = 0; k < (n as number); k++) box(g, 10.35 + i * 0.58, 0.02, 0.42, 0.01, 1.75 - k * 0.2, 0.15, mat(c as string), false);
  });

  // Desks with monitor, keyboard, mug and chair.
  DESKS.forEach(([dx, dz]) => {
    box(g, dx, dz, 2.0, 1.1, 0.72, 0.04, wood);
    for (const [lx, lz] of [[0.05, 0.05], [1.88, 0.05], [0.05, 0.98], [1.88, 0.98]]) box(g, dx + lx, dz + lz, 0.07, 0.07, 0, 0.72, metal);
    box(g, dx + 0.6, dz + 0.2, 0.8, 0.06, 0.82, 0.36, metal);
    const screen = box(g, dx + 0.64, dz + 0.265, 0.72, 0.01, 0.845, 0.3, mat('#62c6ee', 0.2, { emissive: '#3aa6d8', emissiveIntensity: 0.6 }), false);
    screens.push(screen);
    box(g, dx + 0.95, dz + 0.18, 0.1, 0.1, 0.76, 0.08, metal);
    box(g, dx + 0.65, dz + 0.55, 0.7, 0.2, 0.76, 0.02, mat('#eeeeee'));
    box(g, dx + 1.6, dz + 0.45, 0.15, 0.15, 0.76, 0.1, accent);
    chair(g, dx + 1.0, dz + 1.65, 'up');
  });

  // Meeting room: glass walls, table, pink chairs.
  box(g, 0, 4.78, 5, 0.04, 0, 1.4, glass, false);
  box(g, 5.98, 0, 0.04, 4.8, 0, 2.2, glass, false);
  box(g, 1.2, 1.4, 3.4, 1.6, 0.72, 0.05, darkWood);
  box(g, 1.5, 1.8, 0.15, 0.8, 0, 0.72, darkWood);
  box(g, 4.15, 1.8, 0.15, 0.8, 0, 0.72, darkWood);
  for (const x of [1.5, 3.6]) chair(g, x + 0.25, 0.85, 'down', '#d9707f');
  chair(g, 2.7, 0.85, 'down', '#d9707f');
  for (const x of [1.5, 2.6, 3.7]) chair(g, x + 0.25, 3.45, 'up', '#d9707f');

  // Pantry: counter, coffee machine, fridge, table, red stools, glass wall.
  box(g, 13.4, 0.25, 3.6, 0.7, 0, 0.9, mat('#ece6dc'));
  box(g, 13.4, 0.25, 3.6, 0.7, 0.9, 0.04, mat('#8b8f96', 0.3));
  box(g, 14.0, 0.35, 0.45, 0.45, 0.94, 0.4, metal);
  box(g, 17.2, 0.3, 0.7, 0.7, 0, 1.85, mat('#dfe6ea', 0.3, { metalness: 0.2 }));
  box(g, 15.2, 2.3, 1.3, 0.8, 0.72, 0.04, wood);
  box(g, 15.75, 2.6, 0.2, 0.2, 0, 0.72, metal);
  PANTRY_SEATS.forEach(([sx, sz]) => {
    const cx = sx + 0.17;
    const cz = sz + 0.13;
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), mat('#e04b3a'));
    stool.position.set(cx * U, 0.47, cz * U);
    stool.castShadow = true;
    g.add(stool);
    box(g, cx - 0.04, cz - 0.04, 0.08, 0.08, 0, 0.45, metal);
  });
  box(g, 12.98, 0, 0.04, 3.2, 0, 2.2, glass, false);
  box(g, 13, 4.78, 5, 0.04, 0, 1.4, glass, false);

  // Water cooler.
  box(g, 6.3, 1.25, 0.42, 0.42, 0, 0.95, mat('#eef2f4'));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 20), new THREE.MeshPhysicalMaterial({ color: '#8fd0f0', transparent: true, opacity: 0.6, roughness: 0.05 }));
  bottle.position.set((6.3 + 0.21) * U, 1.14, (1.25 + 0.21) * U);
  g.add(bottle);

  // Cabin: desk, chair facing the room, glass walls.
  box(g, 14.4, 6.25, 2.6, 1.1, 0.72, 0.05, darkWood);
  box(g, 14.4, 6.95, 2.6, 0.12, 0, 0.72, darkWood);
  box(g, 15.4, 6.4, 0.8, 0.06, 0.8, 0.36, metal);
  chair(g, CABIN_SEAT[0] + 0.17, CABIN_SEAT[1] + 0.13, 'down', '#2d3240');
  box(g, 12.98, 4.8, 0.04, 1.6, 0, 1.4, glass, false);
  box(g, 12.98, 7.9, 0.04, 1.9, 0, 1.4, glass, false);
  box(g, 13, 9.78, 5, 0.04, 0, 1.4, glass, false);

  // Mail room: shelves of letters and the outbox tray.
  box(g, 13.5, 10.0, 3.8, 0.5, 0, 1.5, mat('#a87b52'));
  const paper = [mat('#ffffff'), mat('#f0b54a'), mat('#bfe0f0')];
  for (let i = 0; i < 3; i++) {
    box(g, 13.5, 10.48, 3.8, 0.04, 0.38 + i * 0.4, 0.03, mat('#7a5636'));
    for (let k = 0; k < 6; k++) box(g, 13.7 + k * 0.6, 10.5, 0.35, 0.02, 0.12 + i * 0.4, 0.22, paper[(k + i) % 3], false);
  }
  box(g, 15.2, 12.2, 1.3, 0.9, 0, 0.55, mat('#f0b54a'));
  const tray = box(g, 15.35, 12.32, 1.0, 0.66, 0.55, 0.06, mat('#ffffff'));
  box(g, 12.98, 9.8, 0.04, 1.6, 0, 1.4, glass, false);
  box(g, 12.98, 13, 0.04, 1, 0, 1.4, glass, false);

  for (const [x, z] of [[0.3, 13.2], [12.5, 0.5], [12.5, 13.4], [6.4, 0.4], [17.4, 5.4], [13.4, 8.8]] as [number, number][]) plant(g, x, z);

  return { group: g, screens, tray, liftLight };
}

/** Room label anchors (floor units). */
export const LABELS = {
  meeting: [4.9, 4.3],
  pantry: [17.4, 4.2],
  cabin: [17.3, 9.3],
  mail: [17.2, 13.6],
  lift: [8.5, 0],
  pipeline: [11.4, 0],
} as const;
