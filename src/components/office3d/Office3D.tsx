'use client';

// A real 3D office for the Overview (preview): WebGL via three.js, realistic people from Microsoft's open
// Rocketbox library (MIT licence) moved by motion-captured animations, lit with soft shadows. Drag to turn, scroll to zoom.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const BASE = '/office3d';
type Clips = Record<string, THREE.AnimationClip>;
type V2 = [number, number];

// ---------- The room ----------

function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
}

/** A box sitting on the floor (or at height y), sized in metres, with shadows. */
function box(scene: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#e3e7ea' : '#dde2e5';
      g.fillRect(i * 64, j * 64, 64, 64);
    }
  g.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 256);
    g.moveTo(0, i * 64);
    g.lineTo(256, i * 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildRoom(scene: THREE.Scene) {
  const W = 14;
  const D = 10;
  const wall = mat('#f4f1ec');
  const wood = mat('#c99a63', { roughness: 0.6 });
  const darkWood = mat('#6e4a31', { roughness: 0.6 });
  const metal = mat('#2d3038', { roughness: 0.4, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
  const chairM = mat('#3b4252');
  const pink = mat('#d9707f');

  // Floor slab and tiles.
  box(scene, W + 0.4, 0.3, D + 0.4, -0.2, -0.3, -0.2, mat('#3a3a3c'), false);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0.001, D / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Two walls (back and left) with windows and the orange Brainbric stripe.
  box(scene, W, 2.8, 0.15, 0, 0, -0.15, wall);
  box(scene, 0.15, 2.8, D, -0.15, 0, 0, wall);
  const stripe = mat('#ff5a1f', { roughness: 0.5 });
  box(scene, W, 0.12, 0.02, 0, 2.62, 0.0, stripe, false);
  box(scene, 0.02, 0.12, D, 0.0, 2.62, 0, stripe, false);
  const win = mat('#bfe0f0', { roughness: 0.1, emissive: '#9fd0ea', emissiveIntensity: 0.25 });
  for (const x of [0.8, 3.2, 10.6]) box(scene, 1.8, 1.3, 0.02, x, 1.0, 0.0, win, false);
  for (const z of [4.5, 7.2]) box(scene, 0.02, 1.3, 1.8, 0.0, 1.0, z, win, false);

  // Pipeline board with sticky notes.
  box(scene, 2.0, 1.1, 0.03, 7.6, 1.0, 0.0, mat('#ffffff'), false);
  const notes = ['#ff8a5c', '#ffd166', '#7cc6fe', '#8be0a4'];
  notes.forEach((c, i) => {
    for (let k = 0; k < 4 - (i % 2); k++) box(scene, 0.3, 0.2, 0.01, 7.75 + i * 0.47, 1.75 - k * 0.24, 0.03, mat(c), false);
  });

  // Desks: two rows of three, each with a monitor, keyboard and chair.
  const desks: { x: number; z: number }[] = [];
  for (const z of [4.2, 6.9]) for (const x of [1.0, 3.4, 5.8]) desks.push({ x, z });
  desks.forEach(({ x, z }) => {
    box(scene, 1.6, 0.04, 0.8, x, 0.72, z, wood);
    for (const [lx, lz] of [[0.05, 0.05], [1.5, 0.05], [0.05, 0.7], [1.5, 0.7]]) box(scene, 0.05, 0.72, 0.05, x + lx, 0, z + lz, metal);
    box(scene, 0.6, 0.38, 0.04, x + 0.5, 0.86, z + 0.12, metal);
    const screen = box(scene, 0.55, 0.32, 0.01, x + 0.525, 0.89, z + 0.165, mat('#62c6ee', { emissive: '#3aa6d8', emissiveIntensity: 0.6, roughness: 0.2 }), false);
    screen.userData.screen = true;
    box(scene, 0.06, 0.12, 0.06, x + 0.77, 0.76, z + 0.12, metal);
    box(scene, 0.45, 0.02, 0.15, x + 0.575, 0.76, z + 0.4, mat('#eeeeee'));
    box(scene, 0.12, 0.1, 0.12, x + 1.3, 0.76, z + 0.3, mat('#ff5a1f'));
    // Chair (seat height about 0.48 m)
    box(scene, 0.5, 0.08, 0.5, x + 0.55, 0.42, z + 1.0, chairM);
    box(scene, 0.5, 0.55, 0.07, x + 0.55, 0.5, z + 1.48, chairM);
    box(scene, 0.06, 0.42, 0.06, x + 0.77, 0, z + 1.22, metal);
  });

  // Glass meeting room (back left) with table and pink chairs.
  box(scene, 4.2, 1.0, 0.03, 0, 0, 3.0, glass, false);
  box(scene, 0.03, 2.2, 3.0, 4.6, 0, 0, glass, false);
  box(scene, 2.6, 0.05, 1.0, 0.8, 0.74, 1.0, darkWood);
  box(scene, 0.1, 0.74, 0.6, 1.0, 0, 1.2, darkWood);
  box(scene, 0.1, 0.74, 0.6, 3.2, 0, 1.2, darkWood);
  for (const x of [1.0, 1.9, 2.8]) {
    box(scene, 0.45, 0.45, 0.45, x, 0, 0.45, pink);
    box(scene, 0.45, 0.45, 0.45, x, 0, 2.1, pink);
  }

  // Pantry (back right): counter, coffee machine, fridge, red stools.
  const pantryX = 11.0;
  box(scene, 2.8, 0.92, 0.6, pantryX, 0, 0.1, mat('#e9e4dc'));
  box(scene, 2.8, 0.04, 0.6, pantryX, 0.92, 0.1, mat('#7f848c', { roughness: 0.3 }));
  box(scene, 0.35, 0.45, 0.35, pantryX + 0.3, 0.96, 0.2, metal);
  box(scene, 0.7, 1.9, 0.65, 13.1, 0, 0.1, mat('#dfe6ea', { roughness: 0.3, metalness: 0.2 }));
  for (const x of [11.4, 12.1]) {
    box(scene, 0.35, 0.65, 0.35, x, 0, 1.3, mat('#e04b3a'));
  }
  box(scene, 0.03, 2.2, 2.6, 10.6, 0, 0, glass, false);

  // Water cooler near the pantry.
  box(scene, 0.35, 0.95, 0.35, 9.9, 0, 0.3, mat('#eef2f4'));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 20), new THREE.MeshPhysicalMaterial({ color: '#8fd0f0', transparent: true, opacity: 0.6, roughness: 0.05 }));
  bottle.position.set(10.075, 1.15, 0.475);
  scene.add(bottle);

  // Manager cabin (front right): dark desk, chair, glass walls.
  box(scene, 0.03, 1.2, 3.6, 10.0, 0, 6.4, glass, false);
  box(scene, 4.0, 1.2, 0.03, 10.0, 0, 6.4, glass, false);
  box(scene, 1.9, 0.05, 0.85, 11.4, 0.74, 7.6, darkWood);
  box(scene, 1.9, 0.72, 0.1, 11.4, 0, 8.3, darkWood);
  box(scene, 0.55, 0.36, 0.04, 12.05, 0.8, 7.75, metal);
  box(scene, 0.5, 0.9, 0.5, 12.1, 0.42, 7.0, chairM);

  // Mail room shelves with an orange tray of letters (front left).
  box(scene, 2.2, 1.6, 0.4, 0.2, 0, 9.4, mat('#a87b52'));
  for (let i = 1; i < 4; i++) box(scene, 2.2, 0.03, 0.4, 0.2, i * 0.4, 9.4, mat('#7a5636'));
  box(scene, 0.7, 0.12, 0.45, 2.7, 0.75, 9.3, mat('#f0b54a'));
  box(scene, 0.7, 0.75, 0.45, 2.7, 0, 9.3, mat('#d8d2c8'));

  // Plants.
  const leaf = mat('#4e9a5c', { roughness: 0.9 });
  for (const [x, z] of [[0.4, 3.6], [9.3, 0.4], [8.9, 9.3], [13.4, 5.6], [5.1, 3.4]] as V2[]) {
    box(scene, 0.4, 0.4, 0.4, x, 0, z, mat('#e7e1d6'));
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), leaf);
    f.position.set(x + 0.2, 0.75, z + 0.2);
    f.castShadow = true;
    scene.add(f);
  }

  return { desks };
}

// ---------- People ----------

type Person = {
  name: string;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string | null;
  route?: V2[];
  leg?: number;
  speed?: number;
  pauseUntil?: number;
  label: HTMLDivElement;
};

function play(p: Person, clip: string, fade = 0.4) {
  if (p.current === clip || !p.actions[clip]) return;
  const next = p.actions[clip];
  next.reset().setEffectiveWeight(1).fadeIn(fade).play();
  if (p.current) p.actions[p.current].fadeOut(fade);
  p.current = clip;
}

async function loadClips(names: string[]): Promise<Clips> {
  const out: Clips = {};
  await Promise.all(
    names.map(async (n) => {
      const json = await (await fetch(`${BASE}/anim/${n}.json`)).json();
      out[n] = THREE.AnimationClip.parse(json);
    }),
  );
  return out;
}

function loadPerson(loader: FBXLoader, file: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) =>
    loader.load(
      `${BASE}/people/${file}.fbx`,
      (obj) => {
        // Rocketbox works in centimetres: bring the person to about 1.72 m.
        const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
        obj.scale.setScalar(1.72 / (size.y || 172));
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
          for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
            const pm = mt as THREE.MeshPhongMaterial;
            if (pm.map) {
              pm.map.colorSpace = THREE.SRGBColorSpace;
              // The source files carry a black base colour that would multiply the skin and clothes to black.
              pm.color.set('#ffffff');
            }
            pm.emissive?.set('#000000');
            pm.specularMap = null;
            pm.normalMap = null;
            pm.bumpMap = null;
            // Hair, lashes and glasses use an opacity map: cut them out cleanly instead of blending.
            if (pm.alphaMap || pm.transparent) {
              pm.transparent = false;
              pm.alphaTest = 0.5;
            }
            pm.shininess = 8;
            pm.specular = new THREE.Color('#222222');
          }
        });
        const g = new THREE.Group();
        g.add(obj);
        resolve(g);
      },
      undefined,
      reject,
    ),
  );
}

export function Office3D() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'nogl' | 'error'>('loading');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
      setStatus('nogl');
      return;
    }
    let disposed = false;
    const w = () => host.clientWidth;
    const h = () => Math.round(host.clientWidth * 0.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w(), h());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(w(), h());
    labels.domElement.style.position = 'absolute';
    labels.domElement.style.inset = '0';
    labels.domElement.style.pointerEvents = 'none';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#efedea');
    const camera = new THREE.PerspectiveCamera(32, w() / h(), 0.1, 200);
    camera.position.set(15, 11, 15);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(7, 0.6, 5);
    controls.enableDamping = true;
    controls.minDistance = 8;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.update();

    scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.4));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.position.set(16, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    sun.target.position.set(7, 0, 5);
    scene.add(sun, sun.target);

    const { desks } = buildRoom(scene);
    const people: Person[] = [];
    const clock = new THREE.Clock();

    const manager = new THREE.LoadingManager();
    // Textures were converted for the web: colour maps to JPG, opacity maps to PNG; the heavy normal and specular maps are left out.
    manager.setURLModifier((url) => {
      const file = url.split('/').pop() ?? url;
      if (/_opacity_color\.tga$/i.test(file)) return `${BASE}/people/${file.replace(/\.tga$/i, '.png')}`;
      if (/_color\.tga$/i.test(file)) return `${BASE}/people/${file.replace(/\.tga$/i, '.jpg')}`;
      if (/\.tga$/i.test(file)) return `${BASE}/people/flat_normal.png`;
      return url;
    });
    // The models name .tga files; without a handler the loader skips them, so send them to the converted images.
    manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager));
    manager.onProgress = (_u, done, total) => setProgress(Math.round((done / Math.max(1, total)) * 100));
    const loader = new FBXLoader(manager);

    const tag = (name: string, color: string) => {
      const el = document.createElement('div');
      el.style.cssText = `font:600 12px system-ui,sans-serif;color:#fff;background:${color};padding:2px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.18)`;
      el.textContent = name;
      return el;
    };
    const bubble = (el: HTMLDivElement, text: string | null) => {
      el.dataset.text = text ?? '';
      el.innerHTML = '';
      const pill = tag(el.dataset.name ?? '', el.dataset.color ?? '#1D9E75');
      if (text) {
        const b = document.createElement('div');
        b.style.cssText = 'font:500 12px system-ui,sans-serif;color:#1d1a1e;background:#fff;padding:4px 10px;border-radius:12px;margin-bottom:4px;box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap';
        b.textContent = text;
        el.appendChild(b);
      }
      el.appendChild(pill);
    };

    (async () => {
      try {
        const clips = await loadClips([
          'm_walk_neutral_01', 'f_walk_neutral_01', 'm_sit_table_breathe_01', 'f_sit_table_breathe_01',
          'm_idle_breathe_01', 'f_idle_breathe_01', 'm_gestic_talk_neutral_02', 'f_gestic_listen_accept_01',
        ]);
        const cast: { file: string; name: string; sex: 'm' | 'f'; color: string }[] = [
          { file: 'Male_Adult_17', name: 'Arjun', sex: 'm', color: '#1D9E75' },
          { file: 'Female_Adult_09', name: 'Priya', sex: 'f', color: '#D85A30' },
          { file: 'Male_Adult_11', name: 'Karthik', sex: 'm', color: '#1D9E75' },
          { file: 'Female_Adult_04', name: 'Divya', sex: 'f', color: '#1D9E75' },
        ];
        const roots = await Promise.all(cast.map((c) => loadPerson(loader, c.file)));
        if (disposed) return;
        roots.forEach((root, i) => {
          const c = cast[i];
          const mixer = new THREE.AnimationMixer(root.children[0]);
          const pick = (k: string) => clips[`${c.sex}_${k}`] ?? clips[`m_${k}`];
          const actions: Record<string, THREE.AnimationAction> = {
            walk: mixer.clipAction(pick('walk_neutral_01')),
            sit: mixer.clipAction(pick('sit_table_breathe_01')),
            idle: mixer.clipAction(pick('idle_breathe_01')),
            talk: mixer.clipAction(clips.m_gestic_talk_neutral_02),
            listen: mixer.clipAction(clips.f_gestic_listen_accept_01),
          };
          const el = document.createElement('div');
          el.dataset.name = c.name;
          el.dataset.color = c.color;
          el.style.cssText = 'display:flex;flex-direction:column;align-items:center';
          bubble(el, null);
          const label = new CSS2DObject(el);
          label.position.set(0, 2.05, 0);
          root.add(label);
          scene.add(root);
          people.push({ name: c.name, root, mixer, actions, current: null, label: el });
        });

        // Arjun works at his desk.
        const [arjun, priya, karthik, divya] = people;
        const d0 = desks[1];
        arjun.root.position.set(d0.x + 0.8, 0, d0.z + 1.05);
        arjun.root.rotation.y = Math.PI;
        play(arjun, 'sit', 0);
        bubble(arjun.label, 'Writing a cold email…');

        // Priya walks a loop: desks, pipeline board, mail room, back.
        priya.route = [[2.0, 6.0], [8.6, 6.0], [8.6, 1.6], [8.6, 6.0], [3.2, 8.6], [3.2, 9.0], [3.2, 8.6], [2.0, 6.0]];
        priya.leg = 0;
        priya.speed = 1.15;
        priya.root.position.set(2.0, 0, 6.0);
        play(priya, 'walk', 0);

        // Karthik and Divya chat at the water cooler.
        karthik.root.position.set(9.4, 0, 1.6);
        karthik.root.rotation.y = Math.PI / 2;
        divya.root.position.set(10.6, 0, 1.6);
        divya.root.rotation.y = -Math.PI / 2;
        play(karthik, 'talk', 0);
        play(divya, 'listen', 0);
        bubble(karthik.label, 'Did the client reply yet?');

        setStatus('ready');
      } catch (e) {
        console.error(e);
        if (!disposed) setStatus('error');
      }
    })();

    // Speech turns at the cooler, and Priya's errands.
    let turn = 0;
    const chatLines: [string, string][] = [
      ['Did the client reply yet?', 'Yes, they want a demo'],
      ['Coffee is strong today', 'Exactly what I needed'],
      ['Big week for the pipeline', 'Three new leads already'],
    ];
    const chatTimer = window.setInterval(() => {
      const [, , karthik, divya] = people;
      if (!karthik || !divya) return;
      turn++;
      const [a, b] = chatLines[Math.floor(turn / 2) % chatLines.length];
      const kTalks = turn % 2 === 0;
      play(karthik, kTalks ? 'talk' : 'idle');
      play(divya, kTalks ? 'listen' : 'talk');
      bubble(karthik.label, kTalks ? a : null);
      bubble(divya.label, kTalks ? null : b);
    }, 4000);

    const dir = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const now = clock.elapsedTime;
      for (const p of people) {
        p.mixer.update(dt);
        if (!p.route || p.leg == null) continue;
        if (p.pauseUntil && now < p.pauseUntil) continue;
        if (p.pauseUntil) {
          p.pauseUntil = undefined;
          play(p, 'walk');
          bubble(p.label, null);
        }
        const [tx, tz] = p.route[(p.leg + 1) % p.route.length];
        dir.set(tx - p.root.position.x, 0, tz - p.root.position.z);
        const dist = dir.length();
        if (dist < 0.05) {
          p.leg = (p.leg + 1) % p.route.length;
          // Stop at the board and in the mail room for a moment.
          if (p.leg === 2 || p.leg === 5) {
            p.pauseUntil = now + 2.5;
            play(p, 'idle');
            bubble(p.label, p.leg === 2 ? 'Found: Kavya Diagnostics' : 'Draft ready');
          }
          continue;
        }
        dir.normalize();
        const step = Math.min(dist, (p.speed ?? 1.1) * dt);
        p.root.position.addScaledVector(dir, step);
        // Turn smoothly to face the way she walks.
        const want = Math.atan2(dir.x, dir.z);
        let diff = want - p.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.root.rotation.y += diff * Math.min(1, dt * 8);
      }
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    const onResize = () => {
      renderer.setSize(w(), h());
      labels.setSize(w(), h());
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearInterval(chatTimer);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.innerHTML = '';
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-paper-line bg-[#efedea]">
      <div ref={hostRef} className="relative w-full" style={{ minHeight: 320 }} />
      {status !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ink-700">
          {status === 'loading' && `Bringing the team in… ${progress}%`}
          {status === 'nogl' && 'This browser cannot show 3D. The regular office stays on the Overview.'}
          {status === 'error' && 'The 3D office could not load. Try refreshing the page.'}
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/80 px-3 py-1 text-xs font-medium text-white">3D preview · drag to turn, scroll to zoom</div>
    </div>
  );
}
