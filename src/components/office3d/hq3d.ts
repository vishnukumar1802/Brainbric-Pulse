// The premium HQ in 3D, on the floor plan in office/hqLayout.ts (one floor unit = 0.8 m).
// Furniture models are from Poly Haven (CC0), optimised in public/office3d/hq; the rest (desks, glass, pool table,
// server racks, reception) is built here so it can carry the brand colour.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { FloorKey } from '@/lib/office';
import { fetchBuffer, hqUrl } from './assets';
import { HQ_CABIN, HQ_D, HQ_DESKS, HQ_PANTRY, HQ_W, HQ_ZONES } from '../office/hqLayout';

export const U = 0.8;

const ACCENT: Record<FloorKey, string> = { g: '#ff6a2b', f: '#8f86ff' };

// ---------- Materials and textures ----------

const cache = new Map<string, THREE.Material>();
function std(color: string, rough = 0.6, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
    cache.set(key, m);
  }
  return m;
}
const glow = (color: string, intensity = 1.6) => std(color, 0.4, 0, { emissive: color, emissiveIntensity: intensity });
const glass = new THREE.MeshPhysicalMaterial({
  color: '#dff1fa',
  roughness: 0.04,
  metalness: 0,
  transmission: 0,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function oakTexture() {
  return canvasTex(512, 512, (g) => {
    const plank = 64;
    for (let i = 0; i < 512 / plank; i++) {
      const base = 168 + ((i * 37) % 23);
      g.fillStyle = `rgb(${base + 22},${base - 6},${base - 46})`;
      g.fillRect(0, i * plank, 512, plank);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(110,72,38,${0.04 + Math.random() * 0.05})`;
        g.beginPath();
        const y = i * plank + Math.random() * plank;
        g.moveTo(0, y);
        g.bezierCurveTo(170, y + Math.random() * 6 - 3, 340, y + Math.random() * 6 - 3, 512, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,40,20,0.25)';
      g.fillRect(0, i * plank, 512, 1.5);
      const cut = ((i * 211) % 400) + 50;
      g.fillRect(cut, i * plank, 1.5, plank);
    }
  }, [6, 6]);
}

function marbleTexture() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#f4f3f0';
    g.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 18; k++) {
      g.strokeStyle = `rgba(150,150,155,${0.15 + Math.random() * 0.2})`;
      g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath();
      let x = Math.random() * 512;
      let y = 0;
      g.moveTo(x, y);
      while (y < 512) {
        x += Math.random() * 40 - 20;
        y += 20 + Math.random() * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

function concreteTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#cfcfcc';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const v = 180 + Math.random() * 40;
      g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
  }, [4, 4]);
}

function plantWallTexture() {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = '#2f5d34';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 900; i++) {
      const hue = 95 + Math.random() * 40;
      g.fillStyle = `hsl(${hue},${40 + Math.random() * 30}%,${22 + Math.random() * 28}%)`;
      g.beginPath();
      g.ellipse(Math.random() * 512, Math.random() * 256, 4 + Math.random() * 9, 2 + Math.random() * 5, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function screenTexture(kind: 'code' | 'dash' | 'pipeline', accent: string) {
  return canvasTex(256, 160, (g) => {
    g.fillStyle = kind === 'code' ? '#0f1720' : '#101418';
    g.fillRect(0, 0, 256, 160);
    if (kind === 'code') {
      const cols = ['#7cc6fe', '#8be0a4', '#ffd166', '#f78fb3', '#cfd8e3'];
      for (let y = 10; y < 160; y += 9) {
        let x = 8 + Math.floor(Math.random() * 3) * 10;
        while (x < 230 && Math.random() > 0.12) {
          const w = 10 + Math.random() * 34;
          g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          g.fillRect(x, y, w, 4);
          x += w + 5;
        }
      }
    } else if (kind === 'dash') {
      g.fillStyle = accent;
      for (let i = 0; i < 9; i++) {
        const h = 20 + Math.random() * 90;
        g.fillRect(16 + i * 25, 140 - h, 16, h);
      }
      g.strokeStyle = '#7cc6fe';
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 12; i++) g.lineTo(10 + i * 21, 60 - Math.random() * 40);
      g.stroke();
    } else {
      const cols = ['#ff8a5c', '#ffd166', '#7cc6fe', '#8be0a4'];
      cols.forEach((c, i) => {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(8 + i * 62, 8, 56, 144);
        for (let k = 0; k < 5 - (i % 3); k++) {
          g.fillStyle = c;
          g.fillRect(14 + i * 62, 18 + k * 26, 44, 20);
        }
      });
    }
  });
}

/** The reception wall: the real Brainbric mark (drawn in once the image loads) and the name. */
function logoTexture() {
  const word = (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#1b1a1d';
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#ffffff';
    g.font = '700 120px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('Brainbric', 270, 130);
  };
  const t = canvasTex(1024, 256, word);
  const img = new Image();
  img.onload = () => {
    const g = (t.image as HTMLCanvasElement).getContext('2d')!;
    word(g);
    const h = 200;
    const w = (img.width / img.height) * h;
    g.drawImage(img, 230 - w, 28, w, h);
    t.needsUpdate = true;
  };
  img.src = '/brainbric-logo.png';
  return t;
}

export type ScreenStats = { ready: number; talks: number; sent: number; goal: number; floor: FloorKey };

/** The boardroom wall and sales screens show the real numbers. */
function statsScreen(accent: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  let last = '';
  const draw = (s: ScreenStats) => {
    const key = `${s.ready}|${s.talks}|${s.sent}|${s.goal}|${s.floor}`;
    if (key === last) return;
    last = key;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0f1318';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = '600 20px system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText(s.floor === 'g' ? 'TODAY · SOFTWARE' : 'TODAY · COLLEGES', 24, 38);
    const tiles: [string, string][] = [
      ['Drafts ready', String(s.ready)],
      ['In talks', String(s.talks)],
      ['Sent today', `${s.sent}/${s.goal}`],
    ];
    tiles.forEach(([label, value], i) => {
      const x = 24 + i * 160;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x, 58, 146, 120);
      g.fillStyle = i === 2 ? '#8be0a4' : accent;
      g.font = '700 56px system-ui, sans-serif';
      g.fillText(value, x + 14, 128);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.font = '500 18px system-ui, sans-serif';
      g.fillText(label, x + 14, 162);
    });
    const pct = s.goal > 0 ? Math.min(1, s.sent / s.goal) : 0;
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(24, 204, 464, 14);
    g.fillStyle = '#8be0a4';
    g.fillRect(24, 204, 464 * pct, 14);
    t.needsUpdate = true;
  };
  return { tex: t, draw };
}

// ---------- Building blocks (floor units for x/z, metres for y and h) ----------

type G = THREE.Group;
function box(g: G, x: number, z: number, w: number, d: number, y: number, h: number, m: THREE.Material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * U, h, d * U), m);
  mesh.position.set((x + w / 2) * U, y + h / 2, (z + d / 2) * U);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function cyl(g: G, x: number, z: number, r: number, y: number, h: number, m: THREE.Material, seg = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x * U, y + h / 2, z * U);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function plane(g: G, x: number, z: number, w: number, d: number, m: THREE.Material, y = 0.002) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * U, d * U), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x + w / 2) * U, y, (z + d / 2) * U);
  mesh.receiveShadow = true;
  g.add(mesh);
}

/** A glass partition along x (axis 'x') or z, with LED strips at the top and the floor. */
function glassWall(g: G, x: number, z: number, len: number, axis: 'x' | 'z', accent: string, h = 2.3) {
  const [w, d] = axis === 'x' ? [len, 0.04] : [0.04, len];
  box(g, x, z, w, d, 0, h, glass, false);
  box(g, x, z, w, d, h, 0.04, glow('#fff4e0', 2.2), false);
  box(g, x, z, w, d, 0, 0.03, glow(accent, 1.4), false);
  // Thin frame posts at the ends.
  const post = std('#2b2b2e', 0.4, 0.6);
  if (axis === 'x') {
    box(g, x, z - 0.02, 0.05, 0.08, 0, h, post);
    box(g, x + len - 0.05, z - 0.02, 0.05, 0.08, 0, h, post);
  } else {
    box(g, x - 0.02, z, 0.08, 0.05, 0, h, post);
    box(g, x - 0.02, z + len - 0.05, 0.08, 0.05, 0, h, post);
  }
}

/** A premium ergonomic chair centred on cx/cz, facing the back wall ('up') or the viewer ('down'). */
function officeChair(g: G, cx: number, cz: number, facing: 'up' | 'down', color = '#26282e') {
  const seat = std(color, 0.7);
  const frame = std('#1a1a1c', 0.35, 0.7);
  box(g, cx - 0.32, cz - 0.3, 0.64, 0.6, 0.44, 0.08, seat);
  const backZ = facing === 'up' ? cz + 0.22 : cz - 0.3;
  box(g, cx - 0.3, backZ, 0.6, 0.08, 0.55, 0.62, std('#2f3138', 0.85));
  box(g, cx - 0.33, backZ - (facing === 'up' ? 0.02 : -0.02), 0.66, 0.04, 1.1, 0.05, frame);
  for (const s of [-1, 1]) box(g, cx + s * 0.34 - 0.03, cz - 0.15, 0.06, 0.3, 0.62, 0.04, frame);
  cyl(g, cx, cz, 0.035, 0.08, 0.36, frame, 12);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), frame);
    leg.position.set(cx * U + Math.cos(a) * 0.15, 0.06, cz * U + Math.sin(a) * 0.15);
    leg.rotation.y = -a;
    leg.castShadow = true;
    g.add(leg);
  }
}

// ---------- Poly Haven models ----------

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const modelCache = new Map<string, Promise<THREE.Group>>();
function model(name: string) {
  let p = modelCache.get(name);
  if (!p) {
    p = fetchBuffer(hqUrl(name)).then((data) => loader.parseAsync(data, '')).then((gltf) => {
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      return gltf.scene;
    });
    modelCache.set(name, p);
  }
  return p;
}
/** Place a copy of a model at floor units x/z, turned by `rot` (radians), at height y, optionally scaled. */
function place(g: G, name: string, x: number, z: number, rot = 0, y = 0, scale = 1) {
  model(name)
    .then((src) => {
      const o = src.clone(true);
      o.position.set(x * U, y, z * U);
      o.rotation.y = rot;
      o.scale.setScalar(scale);
      g.add(o);
    })
    .catch(() => undefined);
}

// ---------- The floor ----------

export type HQHandles = {
  group: THREE.Group;
  tray: THREE.Mesh;
  liftLight: THREE.Mesh;
  screens: THREE.Mesh[];
  /** Window glass: brighter by day, dark blue at night. */
  windows: THREE.MeshStandardMaterial;
  /** Draw the live numbers on the boardroom and sales screens. */
  stats: (s: ScreenStats) => void;
};

export function buildHQ(floor: FloorKey): HQHandles {
  const accent = ACCENT[floor];
  const g = new THREE.Group();
  const screens: THREE.Mesh[] = [];
  const live = statsScreen(accent);
  const liveMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveMap: live.tex, emissiveIntensity: 0.95, roughness: 0.3, map: live.tex });

  // Slab and floors: oak throughout, concrete corridors, carpet in the lounge and focus pods, marble café, dark server room.
  box(g, -0.3, -0.3, HQ_W + 0.6, HQ_D + 0.6, -0.35, 0.35, std('#232326', 0.8), false);
  plane(g, 0, 0, HQ_W, HQ_D, new THREE.MeshStandardMaterial({ map: oakTexture(), roughness: 0.55 }));
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.85 });
  plane(g, 0, 4.6, HQ_W, 0.8, concrete, 0.004);
  plane(g, 0, 10.2, HQ_W, 0.8, concrete, 0.004);
  plane(g, 0, 5.4, 4.6, 4.8, std('#8f8a84', 0.95), 0.004);
  plane(g, 4.6, 11.0, 5.0, 5.0, std('#9a958e', 0.95), 0.004);
  plane(g, 10.0, 0, 6.0, 4.6, new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.25 }), 0.004);
  plane(g, 16.0, 0, 4.0, 4.6, std('#1d2126', 0.6, 0.2), 0.004);

  // Walls (back and left) with big windows, wood slats and the accent line.
  const wall = std('#f3f1ee', 0.9);
  box(g, 0, -0.25, HQ_W, 0.25, 0, 3.0, wall);
  box(g, -0.25, -0.25, 0.25, HQ_D + 0.25, 0, 3.0, wall);
  box(g, 0, -0.01, HQ_W, 0.02, 2.82, 0.06, glow(accent, 1.2), false);
  box(g, -0.01, 0, 0.02, HQ_D, 2.82, 0.06, glow(accent, 1.2), false);
  const win = new THREE.MeshStandardMaterial({ color: '#cfe8f6', roughness: 0.05, emissive: '#bfe3f7', emissiveIntensity: 0.35 });
  for (const [a, b] of [[6.2, 7.0], [10.4, 12.0], [16.4, 19.6]]) box(g, a, -0.01, b - a, 0.02, 0.6, 2.0, win, false);
  for (const z of [11.4, 13.6]) box(g, -0.01, z, 0.02, 1.8, 0.6, 2.0, win, false);
  // Living plant wall in the lounge, oak slats behind the cabin desk.
  box(g, 0.0, 5.6, 0.06, 4.4, 0.2, 2.5, new THREE.MeshStandardMaterial({ map: plantWallTexture(), roughness: 0.95 }), false);
  for (let i = 0; i < 18; i++) box(g, 20.4 + i * 0.2, -0.01, 0.1, 0.06, 0.2, 2.5, std('#a7764a', 0.5), false);

  // ----- Boardroom (back left) -----
  glassWall(g, 0, 4.5, 4.3, 'x', accent);
  glassWall(g, 5.2, 4.5, 0.8, 'x', accent);
  glassWall(g, 6.0, 0, 4.5, 'z', accent);
  box(g, 0.8, 1.5, 2.6, 1.5, 0.74, 0.06, std('#5a3a24', 0.35));
  box(g, 1.7, 1.9, 0.8, 0.7, 0, 0.74, std('#2b2b2e', 0.4, 0.5));
  for (const x of [1.0, 1.9, 2.8]) {
    officeChair(g, x + 0.3, 1.0, 'down', '#e9e6e1');
    officeChair(g, x + 0.3, 3.5, 'up', '#e9e6e1');
  }
  const wallScreen = box(g, 0.8, 0.0, 2.8, 0.03, 1.0, 1.4, liveMat, false);
  screens.push(wallScreen);
  place(g, 'modern_ceiling_lamp_01', 2.1, 2.25, 0, 2.2);
  // Laptops open on the boardroom table.
  for (const [x, z, r] of [[1.2, 1.65, 0], [2.6, 1.65, 0], [1.6, 2.6, Math.PI], [3.0, 2.6, Math.PI]] as [number, number, number][])
    place(g, 'classic_laptop', x, z, r, 0.8, 0.9);

  // ----- Atrium: lift, pipeline board, water cooler, tree -----
  box(g, 6.6, -0.02, 1.9, 0.04, 0, 2.3, std('#7d858e', 0.25, 0.8), false);
  box(g, 6.68, 0.0, 0.85, 0.02, 0.02, 2.2, std('#c9d0d6', 0.2, 0.9), false);
  box(g, 7.6, 0.0, 0.85, 0.02, 0.02, 2.2, std('#c9d0d6', 0.2, 0.9), false);
  const liftLight = box(g, 7.35, 0.0, 0.4, 0.02, 2.4, 0.08, glow(accent, 1.4), false);
  const board = box(g, 8.3, 0.0, 1.6, 0.03, 0.9, 1.3, new THREE.MeshStandardMaterial({ map: screenTexture('pipeline', accent), emissive: '#ffffff', emissiveMap: screenTexture('pipeline', accent), emissiveIntensity: 0.55 }), false);
  screens.push(board);
  box(g, 6.0, 2.5, 0.45, 0.45, 0, 1.0, std('#eef2f4', 0.3));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 24), new THREE.MeshPhysicalMaterial({ color: '#8fd0f0', transparent: true, opacity: 0.55, roughness: 0.05 }));
  bottle.position.set(6.22 * U, 1.2, 2.72 * U);
  g.add(bottle);
  place(g, 'pachira_aquatica_01', 9.4, 3.3, 0.3);

  // ----- Café (marble island, coffee cart, bar stools, round table, pendants) -----
  glassWall(g, 10.0, 4.5, 0.6, 'x', accent);
  glassWall(g, 11.4, 4.5, 4.6, 'x', accent);
  box(g, 12.4, 1.6, 2.8, 0.8, 0, 0.98, new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.2 }));
  box(g, 12.4, 2.38, 2.8, 0.04, 0.05, 0.04, glow(accent, 1.6), false);
  box(g, 13.0, 0.0, 3.0, 0.6, 0, 0.92, std('#2d2f33', 0.5));
  box(g, 13.0, 0.0, 3.0, 0.62, 0.92, 0.04, std('#e7e4df', 0.3));
  box(g, 13.0, 0.0, 3.0, 0.3, 1.5, 0.05, std('#a7764a', 0.5));
  box(g, 13.0, 0.05, 3.0, 0.02, 1.48, 0.02, glow(accent, 1.4), false);
  box(g, 15.4, 0.1, 0.55, 0.55, 0, 1.9, std('#d9dee2', 0.25, 0.6));
  place(g, 'CoffeeCart_01', 11.0, 0.7, 0);
  HQ_PANTRY.forEach(([sx, sz]) => place(g, 'bar_chair_round_01', sx + 0.17, sz + 0.13, Math.PI));
  place(g, 'round_wooden_table_01', 15.2, 3.3, 0);
  for (const x of [12.9, 13.8, 14.7]) place(g, 'modern_ceiling_lamp_01', x, 2.0, 0, 2.1, 0.7);
  place(g, 'potted_plant_02', 10.4, 0.6, 0);

  // ----- Server room -----
  glassWall(g, 16.0, 4.5, 0.6, 'x', '#3aa6ff');
  glassWall(g, 17.4, 4.5, 2.6, 'x', '#3aa6ff');
  glassWall(g, 16.0, 0, 4.5, 'z', '#3aa6ff');
  const rackLights = canvasTex(64, 256, (c) => {
    c.fillStyle = '#0c0f13';
    c.fillRect(0, 0, 64, 256);
    for (let y = 6; y < 256; y += 10)
      for (let x = 6; x < 60; x += 9) {
        c.fillStyle = Math.random() > 0.3 ? '#38b6ff' : Math.random() > 0.5 ? '#7dffb0' : '#1d2a38';
        c.fillRect(x, y, 4, 3);
      }
  });
  const rackMat = new THREE.MeshStandardMaterial({ color: '#15181d', roughness: 0.4, metalness: 0.6, emissive: '#ffffff', emissiveMap: rackLights, emissiveIntensity: 1.1 });
  for (const x of [16.4, 17.3, 18.2, 19.1]) box(g, x, 0.25, 0.75, 1.0, 0, 2.1, rackMat);
  box(g, 16.2, 2.6, 3.6, 0.03, 2.3, 0.04, glow('#3aa6ff', 2.0), false);

  // ----- Manager cabin -----
  glassWall(g, 20.0, 0, 4.6, 'z', accent);
  glassWall(g, 20.0, 4.6, 0.6, 'x', accent);
  glassWall(g, 21.4, 4.6, 2.6, 'x', accent);
  box(g, 21.4, 1.9, 2.4, 1.0, 0.74, 0.06, std('#3f2a1d', 0.35));
  box(g, 21.4, 2.8, 2.4, 0.1, 0, 0.74, std('#3f2a1d', 0.4));
  box(g, 22.0, 2.0, 0.9, 0.06, 0.8, 0.5, std('#18191c', 0.3, 0.4));
  officeChair(g, HQ_CABIN[0] + 0.17, HQ_CABIN[1] + 0.13, 'down', '#1b1c20');
  place(g, 'modern_arm_chair_01', 21.3, 3.9, Math.PI * 0.85);
  place(g, 'potted_plant_04', 23.6, 0.5, 0);
  place(g, 'desk_lamp_arm_01', 23.4, 2.2, -Math.PI / 2, 0.8);

  // ----- Lounge (sofa, armchairs, coffee table, planter) -----
  place(g, 'sofa_02', 0.75, 7.6, Math.PI / 2);
  place(g, 'modern_arm_chair_01', 3.3, 6.2, -Math.PI * 0.75);
  place(g, 'modern_arm_chair_01', 3.3, 9.0, -Math.PI * 0.25);
  place(g, 'modern_coffee_table_01', 2.1, 7.6, Math.PI / 2);
  place(g, 'Ottoman_01', 2.2, 9.4, 0);
  place(g, 'planter_box_01', 0.6, 5.7, Math.PI / 2);

  // ----- Desks: developers (triple monitors, code), sales and support (dual, dashboards); the last desk waits for QA -----
  const deskTop = std('#f6f5f2', 0.35);
  const deskEdge = std('#b98b5b', 0.45);
  const leg = std('#1c1c1f', 0.35, 0.6);
  HQ_DESKS.forEach(([dx, dz], i) => {
    const isDev = HQ_ZONES.developers.includes(i);
    // Support (10) and DevOps (11) are staffed on the ground floor; the last desk stays free for the next team.
    const isFuture = HQ_ZONES.future.includes(i) && (floor !== 'g' || i === 12);
    box(g, dx, dz, 2.0, 1.1, 0.72, 0.035, deskTop);
    box(g, dx, dz + 1.08, 2.0, 0.03, 0.69, 0.06, deskEdge);
    for (const lx of [0.05, 1.89]) box(g, dx + lx, dz + 0.1, 0.06, 0.9, 0, 0.72, leg);
    box(g, dx, dz, 2.0, 0.05, 0.755, 0.28, std('#e9e6e1', 0.9));
    if (!isFuture) {
      const n = isDev ? 3 : 2;
      const tex = screenTexture(isDev ? 'code' : 'dash', accent);
      // Sales screens: the middle one of each pair shows today's numbers.
      const sm = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.3 });
      for (let k = 0; k < n; k++) {
        const w = 0.55;
        const sx = dx + 1.0 - (n * w) / 2 + k * w + 0.02;
        const angle = n === 3 ? (k - 1) * 0.25 : (k - 0.5) * 0.18;
        const frame = new THREE.Mesh(new THREE.BoxGeometry((w - 0.04) * U, 0.3, 0.03), std('#121214', 0.3, 0.4));
        frame.position.set((sx + (w - 0.04) / 2) * U, 0.98, (dz + 0.25) * U);
        frame.rotation.y = -angle;
        frame.castShadow = true;
        g.add(frame);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry((w - 0.08) * U, 0.27), !isDev && k === 0 ? liveMat : sm);
        scr.position.set((sx + (w - 0.04) / 2) * U, 0.98, (dz + 0.25) * U + 0.017);
        scr.rotation.y = -angle;
        g.add(scr);
        screens.push(scr as unknown as THREE.Mesh);
      }
      box(g, dx + 0.92, dz + 0.22, 0.16, 0.12, 0.755, 0.12, std('#121214', 0.3, 0.4));
      box(g, dx + 0.62, dz + 0.55, 0.76, 0.2, 0.755, 0.02, std('#1b1b1e', 0.5));
      box(g, dx + 0.62, dz + 0.74, 0.76, 0.01, 0.76, 0.006, glow(isDev ? '#9a6bff' : accent, 2.2), false);
      if (!isDev && i % 2 === 0) place(g, 'classic_laptop', dx + 1.6, dz + 0.6, 0, 0.755, 0.9);
      if (isDev && i % 3 === 0) place(g, 'desk_lamp_arm_01', dx + 0.25, dz + 0.3, Math.PI * 0.75, 0.755);
    }
    officeChair(g, dx + 1.0, dz + 1.65, 'up');
  });
  for (const [x, z] of [[4.8, 9.6], [13.7, 5.6], [13.7, 9.6], [19.8, 5.6]] as [number, number][]) place(g, 'potted_plant_01', x, z, 0);

  // ----- Play area: pool table, foosball, gaming TV, ottomans, dartboard panel -----
  const felt = std('#1f6b4a', 0.95);
  const wood = std('#4a2e1c', 0.4);
  box(g, 20.9, 5.8, 2.5, 1.4, 0.62, 0.16, wood);
  box(g, 21.05, 5.95, 2.2, 1.1, 0.78, 0.02, felt);
  for (const [lx, lz] of [[20.95, 5.85], [23.25, 5.85], [20.95, 7.05], [23.25, 7.05]] as [number, number][]) box(g, lx, lz, 0.1, 0.1, 0, 0.62, wood);
  const ballCols = ['#f5f5f5', '#e8c219', '#1e4fb0', '#c8241f', '#5b2a86', '#e46a1a', '#1d7a3a', '#7a1f1f', '#151515'];
  ballCols.forEach((c, k) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), std(c, 0.15));
    b.position.set((21.8 + (k % 4) * 0.12 + (k > 3 ? 0.06 : 0)) * U, 0.83, (6.4 + Math.floor(k / 4) * 0.1) * U);
    b.castShadow = true;
    g.add(b);
  });
  box(g, 21.5, 8.3, 1.2, 0.6, 0.6, 0.35, std('#2a5f9e', 0.5));
  box(g, 21.55, 8.35, 1.1, 0.5, 0.95, 0.01, felt);
  for (let r = 0; r < 4; r++) cyl(g, 21.65 + r * 0.28, 8.6, 0.012, 0.85, 0.02, std('#c0c0c0', 0.2, 0.9));
  for (const [lx, lz] of [[21.55, 8.35], [22.6, 8.35], [21.55, 8.8], [22.6, 8.8]] as [number, number][]) box(g, lx, lz, 0.06, 0.06, 0, 0.6, std('#1a1a1c', 0.4));
  box(g, 23.3, 9.3, 0.5, 1.2, 0, 0.5, std('#26282c', 0.5));
  place(g, 'Television_01', 23.55, 9.9, -Math.PI / 2, 0.5, 1.4);
  place(g, 'gaming_console', 23.4, 9.5, -Math.PI / 2, 0.5);
  place(g, 'Ottoman_01', 22.0, 9.8, 0, 0, 0.9);
  box(g, 23.8, 5.6, 0.08, 1.0, 0, 2.0, std('#2b2d31', 0.6));
  place(g, 'dartboard', 23.75, 6.1, -Math.PI / 2, 1.5);

  // ----- Mail room (steel shelves, outbox) -----
  glassWall(g, 0, 11.0, 2.6, 'x', accent);
  glassWall(g, 3.4, 11.0, 1.2, 'x', accent);
  glassWall(g, 4.6, 11.0, 5.0, 'z', accent);
  place(g, 'steel_frame_shelves_01', 0.6, 12.2, Math.PI / 2);
  place(g, 'steel_frame_shelves_01', 0.6, 14.4, Math.PI / 2);
  box(g, 1.3, 13.8, 1.0, 0.8, 0, 0.6, std('#f0b54a', 0.5));
  const tray = box(g, 1.4, 13.9, 0.8, 0.6, 0.6, 0.06, std('#ffffff', 0.8));

  // ----- Focus pods -----
  place(g, 'mid_century_lounge_chair', 6.0, 13.6, Math.PI * 0.9);
  place(g, 'mid_century_lounge_chair', 8.3, 13.6, -Math.PI * 0.9);
  place(g, 'coffee_table_round_01', 7.2, 14.3, 0);
  place(g, 'calathea_orbifolia_01', 5.1, 15.2, 0);
  place(g, 'chess_set', 7.2, 14.3, 0, 0.42, 0.8);

  // ----- Reception (curved desk, logo wall) -----
  const logo = logoTexture();
  const logoMat = new THREE.MeshStandardMaterial({ map: logo, emissive: '#ffffff', emissiveMap: logo, emissiveIntensity: 0.55, roughness: 0.4 });
  box(g, 10.4, 14.9, 4.4, 0.12, 0, 2.2, std('#1b1a1d', 0.5));
  const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.0 * U, 1.0), logoMat);
  logoPlane.position.set(12.6 * U, 1.45, 14.89 * U);
  logoPlane.rotation.y = Math.PI;
  g.add(logoPlane);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.0 * U, 1.0), logoMat);
  front.position.set(12.6 * U, 1.45, 15.03 * U);
  g.add(front);
  const recep = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * U, 1.5 * U, 1.05, 48, 1, false, -Math.PI * 0.35, Math.PI * 0.7), std('#f6f5f2', 0.3));
  recep.position.set(12.6 * U, 0.525, 12.4 * U);
  recep.castShadow = true;
  recep.receiveShadow = true;
  g.add(recep);
  const recepGlow = new THREE.Mesh(new THREE.TorusGeometry(1.5 * U, 0.012, 6, 64, Math.PI * 0.7), glow(accent, 2.0));
  recepGlow.rotation.set(Math.PI / 2, 0, -Math.PI * 0.35 + Math.PI / 2);
  recepGlow.position.set(12.6 * U, 0.06, 12.4 * U);
  g.add(recepGlow);
  place(g, 'potted_plant_01', 10.3, 15.3, 0);
  place(g, 'potted_plant_01', 14.9, 15.3, 0);
  place(g, 'wall_clock', 3.0, 0.02, 0, 2.3);

  // ----- Support & DevOps zone sign -----
  box(g, 15.4, 15.0, 8.4, 0.05, 0.02, 0.02, glow(accent, 1.4), false);

  return { group: g, tray, liftLight, screens, windows: win, stats: live.draw };
}
