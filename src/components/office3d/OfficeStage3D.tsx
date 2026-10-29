'use client';

// The Overview office in real 3D. The movement engine (office/sim.ts) decides where everyone is and what they do;
// this draws them as realistic people (Rocketbox, MIT) with motion-captured walking, sitting, talking and listening.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FloorKey, OfficePerson } from '@/lib/office';
import { personColor } from '../office/scene';
import type { Actor, OfficeSim } from '../office/sim';
import { CLIPS, GUEST, modelFor, type Model } from './models';
import { HQ_D, HQ_GUEST, HQ_ROOMS, HQ_W } from '../office/hqLayout';
import { buildHQ, U, type HQHandles } from './hq3d';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BASE = '/office3d';
type Sims = Record<FloorKey, OfficeSim>;

export type StageProps = {
  floor: FloorKey;
  simsRef: React.MutableRefObject<Sims | null>;
  ready: number;
  readyHref: string;
  talks: number;
  talksHref: string;
  /** Emails sent today and the daily goal, for the screens. */
  sent: number;
  goal: number;
  otherFloor: string | null;
  selected: string | null;
  full: boolean;
  onSelect: (id: string) => void;
  onNavigate: (href: string) => void;
  onLift: () => void;
};

type Body = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string | null;
  label: HTMLDivElement;
  labelKey: string;
  ring: THREE.Mesh;
  /** 0 to 1 while a newcomer grows in, instead of popping into the room. */
  age: number;
  hand: THREE.Object3D | null;
  cupUntil: number;
};

const FACE_ANGLE: Record<string, number> = { '+y': 0, '-y': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

/** Spots where someone on a break sits down instead of standing: the lounge sofa and a focus-pod chair. */
const SIT_SPOTS: Record<string, { at: [number, number]; look: [number, number]; y: number }> = {
  lo1: { at: [1.15, 7.35], look: [2.1, 7.35], y: -0.04 },
  fo: { at: [6.1, 13.55], look: [7.2, 14.3], y: -0.02 },
};

/** Daylight from 0 (night) to 1 (full day), by the hour in India. */
function daylight(date = new Date()) {
  const ist = (date.getUTCHours() + date.getUTCMinutes() / 60 + 5.5) % 24;
  if (ist < 5.5 || ist > 19.5) return 0;
  if (ist < 7.5) return (ist - 5.5) / 2;
  if (ist > 17.5) return (19.5 - ist) / 2;
  return 1;
}

/** Warm the pale stock skin: only skin-coloured pixels change, so clothes and hair keep their colours. */
function warmSkin(m: THREE.MeshPhongMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec3 c = diffuseColor.rgb;
        float sk = step(c.b, c.g) * step(c.g, c.r) * smoothstep(0.05, 0.14, c.r - c.b) * smoothstep(0.18, 0.4, c.r);
        diffuseColor.rgb = mix(c, c * vec3(0.8, 0.6, 0.45), sk * 0.9);
      }`,
    );
  };
  m.customProgramCacheKey = () => 'warm-skin';
}

function pill(text: string, color: string, onClick?: () => void) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.textContent = text;
  el.style.cssText = `font:600 11px/1.6 var(--font-sans,system-ui),sans-serif;color:#fff;background:${color};padding:0 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2);border:0;transition:opacity .25s;${onClick ? 'pointer-events:auto;cursor:pointer;' : ''}`;
  if (onClick) el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

export function OfficeStage3D(props: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fade, setFade] = useState(false);
  const lastFloor = useRef(props.floor);
  const resetRef = useRef<() => void>(() => undefined);

  // Lift: a short fade when the floor changes.
  useEffect(() => {
    if (lastFloor.current === props.floor) return;
    lastFloor.current = props.floor;
    setFade(true);
    const id = window.setTimeout(() => setFade(false), 350);
    return () => window.clearTimeout(id);
  }, [props.floor]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9e7e3');
    // Soft studio reflections so wood, marble, metal and glass look real.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const center = new THREE.Vector3((HQ_W * U) / 2, 0.5, (HQ_D * U) / 2);
    const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200);
    // First view: a three-quarter look from the front right, close enough to see people at their desks.
    const homeTarget = center.clone().add(new THREE.Vector3(-1.4, 0, 0.8));
    const home = { pos: homeTarget.clone().add(new THREE.Vector3(11.5, 12, 13.5)), target: homeTarget };
    camera.position.copy(home.pos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(home.target);
    controls.enableDamping = true;
    controls.minDistance = 6;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minPolarAngle = Math.PI * 0.1;
    // Keep the open sides towards the viewer (the back and left walls stay behind the office).
    controls.minAzimuthAngle = Math.PI * 0.05;
    controls.maxAzimuthAngle = Math.PI * 0.45;
    controls.update();

    // Fly the camera somewhere (room labels, Reset view); grabbing the view cancels the flight.
    let fly: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; k: number } | null = null;
    const flyTo = (pos: THREE.Vector3, target: THREE.Vector3) => {
      fly = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, k: 0 };
    };
    controls.addEventListener('start', () => (fly = null));
    resetRef.current = () => flyTo(home.pos.clone(), home.target.clone());
    const flyToRoom = (at: readonly [number, number]) => {
      // Labels sit at the front edge of a room; look a little behind them.
      const tg = new THREE.Vector3(at[0] * U, 0.6, (at[1] - 2.2) * U);
      flyTo(tg.clone().add(new THREE.Vector3(5.6, 7.0, 7.4)), tg);
    };

    const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.35);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e6', 2.1);
    sun.position.set(center.x + 9, 16, center.z + 4);
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    const size = () => {
      const w = host.clientWidth || 900;
      const h = host.clientHeight || Math.round(w * 0.6);
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);

    // ----- Room per floor, with room labels: a click flies there, "Open" goes to the page behind it -----
    let room: HQHandles | null = null;
    let roomFloor: FloorKey | null = null;
    const roomLabels: CSS2DObject[] = [];
    const roomLabel = (text: string, at: readonly [number, number], y: number, color: string, onClick?: () => void, open?: () => void) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:3px;align-items:center;transition:opacity .25s';
      wrap.appendChild(pill(text, color, onClick));
      if (open) {
        const go = pill('Open ›', 'rgba(255,255,255,0.92)', open);
        go.style.color = '#2a2730';
        wrap.appendChild(go);
      }
      const o = new CSS2DObject(wrap);
      o.position.set(at[0] * U, y, at[1] * U);
      scene.add(o);
      roomLabels.push(o);
      return o;
    };
    let mailLabel: HTMLElement | null = null;
    const setRoom = (floor: FloorKey) => {
      if (room) {
        scene.remove(room.group);
        room.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      }
      for (const o of roomLabels) {
        scene.remove(o);
        o.element.remove();
      }
      roomLabels.length = 0;
      room = buildHQ(floor);
      roomFloor = floor;
      scene.add(room.group);
      const p = propsRef.current;
      const lab = 'rgba(40,36,44,0.78)';
      const go = (href: string) => () => propsRef.current.onNavigate(href);
      const pages: Record<string, (() => void) | undefined> = {
        board: go(p.talksHref),
        dev: go(floor === 'g' ? '/leads' : '/colleges'),
        sales: go(floor === 'g' ? '/leads' : '/colleges'),
        mail: go(p.readyHref),
      };
      for (const r of HQ_ROOMS) {
        const text = r.key === 'cabin' && floor === 'f' ? 'Program head' : r.key === 'mail' ? `Mail room · ${p.ready} ready` : r.name;
        const o = roomLabel(text, r.at, r.h, r.key === 'mail' ? '#BA7517' : lab, () => flyToRoom(r.at), pages[r.key]);
        if (r.key === 'mail') mailLabel = o.element.firstElementChild as HTMLElement;
        // Room names step aside when the view is far out; the mail room stays (it carries the drafts count).
        else o.element.dataset.room = '1';
      }
      roomLabel('Pipeline', [9.1, 0], 2.35, lab, () => propsRef.current.onNavigate(floor === 'g' ? '/leads' : '/colleges'));
      if (p.otherFloor) roomLabel(`Lift · ${p.otherFloor}`, [7.55, 0], 2.65, lab, () => propsRef.current.onLift());
    };

    // ----- People -----
    const manager = new THREE.LoadingManager();
    manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager));
    manager.setURLModifier((url) => {
      const file = url.split(/[\\/]/).pop() ?? url;
      if (/_opacity_color\.tga$/i.test(file)) return `${BASE}/people/${file.replace(/\.tga$/i, '.png')}`;
      if (/_color\.tga$/i.test(file)) return `${BASE}/people/${file.replace(/\.tga$/i, '.jpg')}`;
      if (/\.tga$/i.test(file)) return `${BASE}/people/flat_normal.png`;
      return url;
    });
    const loader = new FBXLoader(manager);
    const modelCache = new Map<string, Promise<THREE.Group>>();
    const loadModel = (m: Model) => {
      let p = modelCache.get(m.file);
      if (!p) {
        p = loader.loadAsync(`${BASE}/people/${m.file}.fbx`).then((obj) => {
          const sz = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
          obj.scale.setScalar((m.sex === 'f' ? 1.66 : 1.74) / (sz.y || 170));
          obj.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            for (const mt of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              const pm = mt as THREE.MeshPhongMaterial;
              if (pm.map) {
                pm.map.colorSpace = THREE.SRGBColorSpace;
                pm.color.set('#ffffff');
              }
              pm.emissive?.set('#000000');
              pm.specularMap = null;
              pm.normalMap = null;
              pm.bumpMap = null;
              if (pm.alphaMap || pm.transparent) {
                pm.transparent = false;
                pm.alphaTest = 0.5;
              }
              pm.shininess = 8;
              pm.specular = new THREE.Color('#222222');
              warmSkin(pm);
            }
          });
          return obj;
        });
        modelCache.set(m.file, p);
      }
      return p;
    };

    const clips: Record<string, THREE.AnimationClip> = {};
    const clipsReady = Promise.all(
      CLIPS.map(async (n) => {
        const json = await (await fetch(`${BASE}/anim/${n}.json`)).json();
        const clip = THREE.AnimationClip.parse(json);
        // The converted files carry no id; without one every clip shares a slot in the animation mixer.
        clip.uuid = THREE.MathUtils.generateUUID();
        // Talking and listening are shared by men and women: keep only the rotations so nobody floats or sinks.
        if (/gestic/.test(n)) clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.position'));
        clips[n] = clip;
      }),
    );

    const bodies = new Map<string, Body>();
    const loading = new Set<string>();
    const ringGeo = new THREE.RingGeometry(0.32, 0.4, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#FCB216', transparent: true, opacity: 0.95 });

    const makeBody = async (key: string, m: Model) => {
      loading.add(key);
      try {
        const [src] = await Promise.all([loadModel(m), clipsReady]);
        if (disposed) return;
        const inner = cloneSkinned(src) as THREE.Group;
        const root = new THREE.Group();
        root.add(inner);
        const mixer = new THREE.AnimationMixer(inner);
        const s = m.sex;
        const actions: Record<string, THREE.AnimationAction> = {
          walk: mixer.clipAction(clips[`${s}_walk_neutral_01`]),
          sit: mixer.clipAction(clips[`${s}_sit_table_breathe_01`]),
          idle: mixer.clipAction(clips[`${s}_idle_breathe_01`]),
          talk: mixer.clipAction(clips.m_gestic_talk_neutral_02),
          listen: mixer.clipAction(clips.f_gestic_listen_accept_01),
        };
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px';
        const label = new CSS2DObject(el);
        label.position.set(0, 2.0, 0);
        root.add(label);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.02;
        ring.visible = false;
        root.add(ring);
        let hand: THREE.Object3D | null = null;
        inner.traverse((o) => {
          if (!hand && /R_?Hand$/i.test(o.name.replace(/\s/g, '_'))) hand = o;
        });
        root.scale.setScalar(0.001);
        bodies.set(key, { root, mixer, actions, current: null, label: el, labelKey: '', ring, age: 0, hand, cupUntil: 0 });
      } catch (e) {
        console.error('3D person failed to load', e);
      } finally {
        loading.delete(key);
      }
    };

    /** Cross-fade from the current motion to the next; every other motion is stopped, so nothing piles up. */
    const play = (b: Body, name: string, fade = 0.35) => {
      if (b.current === name) return;
      const next = b.actions[name];
      const prev = b.current ? b.actions[b.current] : null;
      for (const a of Object.values(b.actions)) if (a !== next && a !== prev) a.stop();
      next.reset();
      // Loops start at a random point so people never move in step (a walk starts on its first step).
      if (name !== 'walk') next.time = Math.random() * next.getClip().duration;
      next.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
      else prev?.stop();
      b.current = name;
    };

    let near = false;
    const setLabel = (b: Body, a: { person: OfficePerson; bubble: { text: string; kind: string } | null }, selected: boolean) => {
      const p = a.person;
      // Zoomed out, only work news and alerts show; chit-chat appears when you come closer or pick the person.
      const own = a.bubble && (a.bubble.kind !== 'chat' || near || selected) ? a.bubble : null;
      const bubble = own ?? (selected ? { text: p.detail, kind: 'work' } : null);
      const zz = p.kind === 'agent' && p.paused;
      const key = `${p.name}|${personColor(p)}|${bubble?.text ?? ''}|${bubble?.kind ?? ''}|${zz}`;
      if (key === b.labelKey) return;
      b.labelKey = key;
      b.label.innerHTML = '';
      if (bubble) {
        const bb = document.createElement('div');
        const chat = bubble.kind === 'chat';
        const alert = bubble.kind === 'alert';
        bb.textContent = bubble.text;
        bb.style.cssText = `font:${chat ? 'italic 500' : '600'} 11px/1.4 var(--font-sans,system-ui),sans-serif;color:${alert ? '#831C1E' : chat ? '#5F5E5A' : '#1d1a1e'};background:${alert ? '#FFEDEA' : chat ? '#F4F2EC' : '#ffffff'};padding:3px 8px;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.15);white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis`;
        b.label.appendChild(bb);
      }
      b.label.appendChild(pill(zz ? `${p.name}  z z` : p.name, personColor(p), () => propsRef.current.onSelect(p.id)));
    };

    // Things people carry: a coffee cup after the café, papers on the way to the mail room.
    const cupMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 });
    const cupGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.09, 16);
    const paperGeo = new THREE.BoxGeometry(0.21, 0.004, 0.28);
    const paperMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    const carried = new Map<string, { cup: THREE.Mesh; paper: THREE.Mesh }>();
    const carriedFor = (key: string) => {
      let c = carried.get(key);
      if (!c) {
        c = { cup: new THREE.Mesh(cupGeo, cupMat), paper: new THREE.Mesh(paperGeo, paperMat) };
        c.cup.castShadow = true;
        c.cup.visible = c.paper.visible = false;
        scene.add(c.cup, c.paper);
        carried.set(key, c);
      }
      return c;
    };
    const handPos = new THREE.Vector3();

    // Day and night by the hour in India, checked once a minute.
    const dayBg = new THREE.Color('#e9e7e3');
    const nightBg = new THREE.Color('#1c2230');
    let lightAt = -1;
    const applyDaylight = (now: number) => {
      if (lightAt >= 0 && now - lightAt < 60) return;
      lightAt = now;
      const d = daylight();
      hemi.intensity = 0.55 + 0.8 * d;
      hemi.color.set(d > 0.5 ? '#ffffff' : '#d7dcff');
      sun.intensity = 0.35 + 1.75 * d;
      sun.color.set(d > 0.5 ? '#fff4e6' : '#ffd8a8');
      scene.environmentIntensity = 0.3 + 0.25 * d;
      renderer.toneMappingExposure = 0.95 + 0.1 * d;
      (scene.background as THREE.Color).copy(nightBg).lerp(dayBg, d);
      if (room) {
        room.windows.color.set(d > 0.3 ? '#cfe8f6' : '#22304a');
        room.windows.emissive.set(d > 0.3 ? '#bfe3f7' : '#3b4f7a');
        room.windows.emissiveIntensity = 0.12 + 0.25 * d;
      }
    };

    // Visitor in the meeting room when leads are in talks.
    let guest: Body | null = null;
    const guestKey = 'guest';

    const clock = new THREE.Clock();
    let raf = 0;
    let pulse = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      // Same clock as the 2D view (seconds since the page opened), so switching views keeps everyone's timing.
      const t = performance.now() / 1000;
      const p = propsRef.current;
      const sims = p.simsRef.current;
      if (sims) {
        sims.g.step(dt, t);
        sims.f.step(dt, t);
      }
      if (roomFloor !== p.floor) {
        setRoom(p.floor);
        lightAt = -1;
      }
      applyDaylight(t);
      if (fly) {
        fly.k = Math.min(1, fly.k + dt / 0.9);
        const e = fly.k < 0.5 ? 4 * fly.k ** 3 : 1 - (-2 * fly.k + 2) ** 3 / 2;
        camera.position.lerpVectors(fly.from, fly.to, e);
        controls.target.lerpVectors(fly.tFrom, fly.tTo, e);
        if (fly.k >= 1) fly = null;
      }
      const dist = camera.position.distanceTo(controls.target);
      near = dist < 14;
      for (const o of roomLabels) if (o.element.dataset.room) o.element.style.opacity = dist > 26 ? '0' : '1';
      if (mailLabel) mailLabel.textContent = `Mail room · ${p.ready} ready`;
      if (room) {
        room.tray.scale.y = Math.max(0.3, Math.min(5, 0.4 + p.ready * 0.25));
        room.stats({ ready: p.ready, talks: p.talks, sent: p.sent, goal: p.goal, floor: p.floor });
        pulse += dt;
        (room.liftLight.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + 0.4 * Math.sin(pulse * 3);
      }

      // Everyone on this floor, as the movement engine has them.
      const actors: Actor[] = sims ? sims[p.floor].actors : [];
      const seen = new Set<string>();
      for (const a of actors) {
        const key = a.person.id;
        seen.add(key);
        let b = bodies.get(key);
        if (!b) {
          if (!loading.has(key)) void makeBody(key, modelFor(a.person));
          continue;
        }
        if (!b.root.parent) {
          scene.add(b.root);
          b.label.style.display = '';
        }
        // Newcomers grow in over half a second.
        if (b.age < 1) {
          b.age = Math.min(1, b.age + dt / 0.5);
          b.root.scale.setScalar(Math.max(0.001, 1 - (1 - b.age) ** 3));
        }
        const moving = a.walking || a.spd > 0.05;
        // On a break at the sofa or a focus pod: sit down there.
        const lounge = !moving && !a.seat && !a.chatting ? SIT_SPOTS[a.node] : undefined;
        const cx = lounge ? lounge.at[0] * U : (a.x + 0.17) * U;
        const cz = lounge ? lounge.at[1] * U : (a.y + 0.13) * U;
        // Café bar stools are taller than desk chairs.
        const cy = a.seat?.kind === 'pantry' && !a.walking ? 0.3 : lounge ? lounge.y : 0;
        if (lounge) b.root.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 4));
        else b.root.position.set(cx, cy, cz);
        const want = moving
          ? Math.atan2(a.hx, a.hy)
          : lounge
            ? Math.atan2(lounge.look[0] - lounge.at[0], lounge.look[1] - lounge.at[1])
            : FACE_ANGLE[a.face] ?? 0;
        if (moving || !a.seat) {
          let diff = want - b.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          b.root.rotation.y += diff * Math.min(1, dt * (moving ? 10 : 6));
        } else b.root.rotation.y = want;
        if (moving) {
          play(b, 'walk', 0.25);
          b.actions.walk.setEffectiveTimeScale(Math.max(0.4, (a.spd * U) / 1.1));
        } else if (a.seat || lounge) play(b, 'sit');
        else if (a.chatting) play(b, a.bubble ? 'talk' : 'listen');
        else play(b, 'idle');
        b.ring.visible = p.selected === key;
        setLabel(b, a, p.selected === key);
        b.mixer.update(dt);

        // A coffee from the café stays in hand for a while; drafts go to the mail room as papers.
        if (!moving && a.node === 'coffee') b.cupUntil = t + 45;
        const c = carriedFor(key);
        const cup = t < b.cupUntil && !a.carry && Boolean(b.hand);
        const paper = a.carry && a.walking && Boolean(b.hand);
        c.cup.visible = cup;
        c.paper.visible = paper;
        if (b.hand && (cup || paper)) {
          b.root.updateMatrixWorld(true);
          b.hand.getWorldPosition(handPos);
          if (cup) c.cup.position.set(handPos.x, handPos.y + 0.03, handPos.z);
          if (paper) {
            c.paper.position.set(handPos.x, handPos.y + 0.02, handPos.z);
            c.paper.rotation.set(-0.5, b.root.rotation.y, 0, 'YXZ');
          }
        }
      }
      // People not on this floor (or gone) leave the scene; their bodies are kept for when they come back.
      // Their name tags are page elements the 3D renderer stops updating, so hide them too.
      for (const [key, b] of bodies)
        if (!seen.has(key) && key !== guestKey && b.root.parent) {
          scene.remove(b.root);
          b.label.style.display = 'none';
        }
      for (const [key, c] of carried) if (!seen.has(key)) c.cup.visible = c.paper.visible = false;

      // The visitor.
      if (p.talks > 0) {
        if (!guest) {
          guest = bodies.get(guestKey) ?? null;
          if (!guest && !loading.has(guestKey)) void makeBody(guestKey, GUEST);
        }
        if (guest) {
          if (!guest.root.parent) {
            scene.add(guest.root);
            guest.label.style.display = '';
          }
          if (guest.age < 1) {
            guest.age = Math.min(1, guest.age + dt / 0.5);
            guest.root.scale.setScalar(Math.max(0.001, 1 - (1 - guest.age) ** 3));
          }
          guest.root.position.set((HQ_GUEST[0] + 0.17) * U, 0, (HQ_GUEST[1] + 0.13) * U);
          guest.root.rotation.y = 0;
          play(guest, 'sit', 0);
          const guestPerson = { id: 'guest', name: 'Guest', role: '', kind: 'member', floor: p.floor, state: 'working', bubble: null, detail: '', href: null, isYou: false, slug: null, paused: false } as OfficePerson;
          setLabel(guest, { person: guestPerson, bubble: { text: p.floor === 'g' ? `In talks · ${p.talks}` : `College talks · ${p.talks}`, kind: 'work' } }, false);
          guest.mixer.update(dt);
        }
      } else if (guest?.root.parent) {
        scene.remove(guest.root);
        guest.label.style.display = 'none';
      }

      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };

    clipsReady
      .then(() => {
        if (!disposed) setStatus('ready');
      })
      .catch(() => !disposed && setStatus('error'));
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      host.innerHTML = '';
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={hostRef}
        className="relative w-full overflow-hidden rounded-lg"
        style={props.full ? { height: 'calc(100vh - 96px)' } : { aspectRatio: '900 / 540' }}
      />
      <div className={`pointer-events-none absolute inset-0 rounded-lg bg-[#9aa3ad] transition-opacity duration-300 ${fade ? 'opacity-90' : 'opacity-0'}`} />
      {status === 'loading' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-ink-700 shadow-sm">
          Bringing the team in…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ink-700">The 3D office could not load. Switch to 2D with the button above.</div>
      )}
      <button
        type="button"
        onClick={() => resetRef.current()}
        className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink-900 shadow-sm hover:bg-white"
      >
        Reset view
      </button>
    </div>
  );
}
