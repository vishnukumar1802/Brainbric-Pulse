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
import { buildRoom, LABELS, ROOM_D, ROOM_W, U, type RoomHandles } from './room3d';

const BASE = '/office3d';
type Sims = Record<FloorKey, OfficeSim>;

export type StageProps = {
  floor: FloorKey;
  simsRef: React.MutableRefObject<Sims | null>;
  ready: number;
  readyHref: string;
  talks: number;
  talksHref: string;
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
};

const FACE_ANGLE: Record<string, number> = { '+y': 0, '-y': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

function pill(text: string, color: string, onClick?: () => void) {
  const el = document.createElement(onClick ? 'button' : 'div');
  el.textContent = text;
  el.style.cssText = `font:600 12px var(--font-sans,system-ui),sans-serif;color:#fff;background:${color};padding:2px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.18);border:0;${onClick ? 'pointer-events:auto;cursor:pointer;' : ''}`;
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
    scene.background = new THREE.Color('#efedea');
    const center = new THREE.Vector3((ROOM_W * U) / 2, 0.5, (ROOM_D * U) / 2);
    const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200);
    camera.position.set(center.x + 13, 12, center.z + 13);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.minDistance = 6;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.update();

    scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.35));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.1);
    sun.position.set(center.x + 9, 16, center.z + 4);
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11 });
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

    // ----- Room per floor, with clickable room labels -----
    let room: RoomHandles | null = null;
    let roomFloor: FloorKey | null = null;
    const roomLabels: CSS2DObject[] = [];
    const roomLabel = (text: string, at: readonly [number, number], y: number, color: string, onClick?: () => void) => {
      const o = new CSS2DObject(pill(text, color, onClick));
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
      room = buildRoom(floor);
      roomFloor = floor;
      scene.add(room.group);
      const p = propsRef.current;
      const lab = 'rgba(40,36,44,0.78)';
      roomLabel('Meeting room', LABELS.meeting, 0.05, lab, () => propsRef.current.onNavigate(propsRef.current.talksHref));
      roomLabel('Pantry', LABELS.pantry, 0.05, lab);
      roomLabel(floor === 'g' ? 'Manager cabin' : 'Program head', LABELS.cabin, 0.05, lab);
      mailLabel = roomLabel(`Mail room · ${p.ready} ready`, LABELS.mail, 0.05, '#BA7517', () => propsRef.current.onNavigate(propsRef.current.readyHref)).element;
      roomLabel('Pipeline', LABELS.pipeline, 2.25, lab, () => propsRef.current.onNavigate(floor === 'g' ? '/leads' : '/colleges'));
      if (p.otherFloor) roomLabel(`Lift · ${p.otherFloor}`, LABELS.lift, 2.45, lab, () => propsRef.current.onLift());
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
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px';
        const label = new CSS2DObject(el);
        label.position.set(0, 2.0, 0);
        root.add(label);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.02;
        ring.visible = false;
        root.add(ring);
        bodies.set(key, { root, mixer, actions, current: null, label: el, labelKey: '', ring });
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

    const setLabel = (b: Body, a: { person: OfficePerson; bubble: { text: string; kind: string } | null }, selected: boolean) => {
      const p = a.person;
      const bubble = a.bubble ?? (selected ? { text: p.detail, kind: 'work' } : null);
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
        bb.style.cssText = `font:${chat ? 'italic 500' : '600'} 12px var(--font-sans,system-ui),sans-serif;color:${alert ? '#831C1E' : chat ? '#5F5E5A' : '#1d1a1e'};background:${alert ? '#FFEDEA' : chat ? '#F4F2EC' : '#ffffff'};padding:4px 10px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap`;
        b.label.appendChild(bb);
      }
      b.label.appendChild(pill(zz ? `${p.name}  z z` : p.name, personColor(p), () => propsRef.current.onSelect(p.id)));
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
      if (roomFloor !== p.floor) setRoom(p.floor);
      if (mailLabel) mailLabel.textContent = `Mail room · ${p.ready} ready`;
      if (room) {
        room.tray.scale.y = Math.max(0.3, Math.min(5, 0.4 + p.ready * 0.25));
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
        if (!b.root.parent) scene.add(b.root);
        const cx = (a.x + 0.17) * U;
        const cz = (a.y + 0.13) * U;
        b.root.position.set(cx, 0, cz);
        const moving = a.walking || a.spd > 0.05;
        const want = moving ? Math.atan2(a.hx, a.hy) : FACE_ANGLE[a.face] ?? 0;
        if (moving || !a.seat) {
          let diff = want - b.root.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          b.root.rotation.y += diff * Math.min(1, dt * (moving ? 10 : 6));
        } else b.root.rotation.y = want;
        if (moving) {
          play(b, 'walk', 0.25);
          b.actions.walk.setEffectiveTimeScale(Math.max(0.4, (a.spd * U) / 1.1));
        } else if (a.seat) play(b, 'sit');
        else if (a.chatting) play(b, a.bubble ? 'talk' : 'listen');
        else play(b, 'idle');
        b.ring.visible = p.selected === key;
        setLabel(b, a, p.selected === key);
        b.mixer.update(dt);
      }
      // People not on this floor (or gone) leave the scene; their bodies are kept for when they come back.
      // Their name tags are page elements the 3D renderer stops updating, so hide them too.
      for (const [key, b] of bodies)
        if (!seen.has(key) && key !== guestKey && b.root.parent) {
          scene.remove(b.root);
          b.label.style.display = 'none';
        }

      // The visitor.
      if (p.talks > 0) {
        if (!guest) {
          guest = bodies.get(guestKey) ?? null;
          if (!guest && !loading.has(guestKey)) void makeBody(guestKey, GUEST);
        }
        if (guest) {
          if (!guest.root.parent) scene.add(guest.root);
          guest.root.position.set(2.7 * U, 0, 0.85 * U);
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
      {status !== 'ready' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ink-700">
          {status === 'loading' ? 'Bringing the team in…' : 'The 3D office could not load. Switch to 2D with the button above.'}
        </div>
      )}
    </div>
  );
}
