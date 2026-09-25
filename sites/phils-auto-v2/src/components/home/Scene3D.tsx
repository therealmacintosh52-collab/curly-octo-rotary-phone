/* Home hero, WebGL layer. Loaded on demand by scripts/hero-story.ts only
   on desktops with GPU tier 2+, after load and idle time.
   The DOM <video> of the shop is the hero. This scene puts that same
   video (decoded once, used as a texture) inside a space with depth,
   adds dust and light in front of it, and animates three procedural
   parts across the scene as the scroll story (driven from hero-story.ts
   through lib/story.ts) advances. Tier 2 gets fewer dust points; tier 3
   gets everything. */
import { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { story } from '../../lib/story';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/* ---------------- backdrop: domain-warped noise in ink and indigo --------- */
const backdropVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const backdropFrag = /* glsl */`
  precision highp float;
  varying vec2 vUv; uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.03;
    vec2 q = vec2(fbm(uv * 2.0 + t), fbm(uv * 2.0 - t));
    float n = fbm(uv * 3.0 + 1.6 * q);
    vec3 ink = vec3(0.039, 0.039, 0.122);
    vec3 indigo = vec3(0.16, 0.12, 0.62);
    vec3 col = mix(ink, indigo, smoothstep(0.35, 0.95, n) * 0.42);
    float vig = smoothstep(1.2, 0.3, length(uv - 0.5));
    col *= 0.75 + 0.25 * vig;
    col += (hash(uv * 900.0 + fract(uTime)) - 0.5) * 0.04;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((_, dt) => { if (mat.current) mat.current.uniforms.uTime.value += dt; });
  return (
    <mesh position={[0, 0, -7]}>
      <planeGeometry args={[40, 22]} />
      <shaderMaterial ref={mat} vertexShader={backdropVert} fragmentShader={backdropFrag} uniforms={uniforms} depthWrite={false} />
    </mesh>
  );
}

/* ---------------- dust: instanced points on two depth layers --------------- */
function makeSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function Dust({ count, z, spread, size, rate, speed }: { count: number; z: [number, number]; spread: [number, number]; size: number; rate: number; speed: number }) {
  const ref = useRef<THREE.Points>(null);
  const sprite = useMemo(makeSprite, []);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      pos[i * 3 + 2] = lerp(z[0], z[1], Math.random());
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, [count]);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = ((t * speed) % spread[1]) - spread[1] / 2 + spread[1] / 2 * 0.5;
    ref.current.position.x = story.mx * 0.45 * rate;
    ref.current.position.y += -story.my * 0.25 * rate;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={sprite} size={size} sizeAttenuation transparent depthWrite={false} opacity={0.32} blending={THREE.AdditiveBlending} color="#c9c4ff" />
    </points>
  );
}

/* ---------------- procedural parts ------------------------------------------ */
const steel = { color: '#d9dbe6', metalness: 1, roughness: 0.22, envMapIntensity: 1.4 } as const;
const brushed = { color: '#b9bcc9', metalness: 1, roughness: 0.42, envMapIntensity: 1.1 } as const;
const dark = { color: '#1c1b2a', metalness: 0.6, roughness: 0.6 } as const;

function Rotor() {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0, 0.34), new THREE.Vector2(0.58, 0.34), new THREE.Vector2(0.58, 0.02),
      new THREE.Vector2(1.45, 0.02), new THREE.Vector2(1.45, -0.12), new THREE.Vector2(0.66, -0.12),
      new THREE.Vector2(0.66, -0.02), new THREE.Vector2(0.0, -0.02),
    ];
    return new THREE.LatheGeometry(pts, 96);
  }, []);
  const lugs = useMemo(() => Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return [Math.cos(a) * 0.36, 0.36, Math.sin(a) * 0.36] as [number, number, number]; }), []);
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geo}><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.05, 0.012, 8, 96]} /><meshStandardMaterial {...dark} /></mesh>
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.82, 0.012, 8, 96]} /><meshStandardMaterial {...dark} /></mesh>
      {lugs.map((p, i) => <mesh key={i} position={p}><cylinderGeometry args={[0.055, 0.055, 0.1, 16]} /><meshStandardMaterial {...dark} /></mesh>)}
    </group>
  );
}
function Piston() {
  return (
    <group>
      <mesh><cylinderGeometry args={[0.5, 0.5, 0.62, 48]} /><meshStandardMaterial {...brushed} /></mesh>
      {[0.22, 0.13, 0.04].map((y, i) => <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.018, 8, 64]} /><meshStandardMaterial {...dark} /></mesh>)}
      <mesh position={[0, -0.34, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 0.9, 24]} /><meshStandardMaterial {...steel} /></mesh>
      <mesh position={[0, -0.95, 0]}><boxGeometry args={[0.2, 1.1, 0.32]} /><meshStandardMaterial {...brushed} /></mesh>
      <mesh position={[0, -1.55, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.28, 0.28, 0.34, 32]} /><meshStandardMaterial {...steel} /></mesh>
    </group>
  );
}
function Bolts() {
  const spots = useMemo(() => [[0, 0, 0], [0.9, 0.5, -0.3], [-0.8, 0.6, 0.2], [0.5, -0.8, 0.4], [-0.6, -0.7, -0.4]] as [number, number, number][], []);
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p} rotation={[0.4 * i, 0.7 * i, 0.3 * i]}>
          <mesh><cylinderGeometry args={[0.22, 0.22, 0.16, 6]} /><meshStandardMaterial {...steel} /></mesh>
          <mesh position={[0, -0.36, 0]}><cylinderGeometry args={[0.09, 0.09, 0.56, 20]} /><meshStandardMaterial {...brushed} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** One part crosses the scene right-to-left inside its scroll window. */
function Part({ window: [a, b], children, y = 0, scale = 1, spin = 1 }: { window: [number, number]; children: React.ReactNode; y?: number; scale?: number; spin?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current; if (!g) return;
    const t = (story.p - a) / (b - a);
    const on = t > 0 && t < 1;
    g.visible = on;
    if (!on) return;
    const e = smooth(t);
    g.position.x = lerp(4.6, -4.6, e);
    g.position.y = y + Math.sin(t * Math.PI) * 0.4 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    g.position.z = 1.2 - Math.sin(t * Math.PI) * 0.6;
    g.rotation.y = t * Math.PI * 1.4 * spin + state.clock.elapsedTime * 0.15;
    g.rotation.x = 0.35 + Math.sin(t * Math.PI) * 0.4;
    const s = scale * (0.75 + Math.sin(t * Math.PI) * 0.35);
    g.scale.setScalar(s);
  });
  return <group ref={ref} visible={false}>{children}</group>;
}

/* ---------------- studio reflections, generated on the GPU (no download) ------ */
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

/* ---------------- the video surface + scene ---------------------------------- */
function Scene({ video, tier, reduce, onFirstFrame }: { video: HTMLVideoElement; tier: number; reduce: boolean; onFirstFrame: () => void }) {
  const { viewport } = useThree();
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }, [video]);
  // object-fit: cover, computed for the plane at z = 0
  const [w, h] = useMemo(() => {
    const ar = 16 / 9; let pw = viewport.width, ph = pw / ar;
    if (ph < viewport.height) { ph = viewport.height; pw = ph * ar; }
    return [pw * 1.06, ph * 1.06];
  }, [viewport.width, viewport.height]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h, 48, 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (w / 2); pos.setZ(i, -0.18 * x * x); }
    g.computeVertexNormals();
    return g;
  }, [w, h]);
  const group = useRef<THREE.Group>(null);
  const plane = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) onFirstFrame();
    const p = reduce ? 0 : story.p;
    const g = group.current!, m = plane.current!;
    g.rotation.y = lerp(g.rotation.y, story.mx * 0.07, 0.06);
    g.rotation.x = lerp(g.rotation.x, -story.my * 0.05, 0.06);
    // recede through the story, return at the end for the hand-off
    const recede = p < 0.7 ? smooth(p / 0.35) : smooth((1 - p) / 0.3);
    m.position.z = -1.9 * recede;
    m.position.x = 0.7 * recede;
    m.rotation.y = -0.22 * recede;
    const s = 1 - 0.08 * recede; m.scale.set(s, s, 1);
    if (mat.current) mat.current.color.setScalar(1 - 0.45 * recede);
  });
  return (
    <>
      <group ref={group}>
        <Backdrop />
        <Dust count={tier >= 3 ? 1500 : 600} z={[-5, -3]} spread={[26, 16]} size={0.07} rate={0.3} speed={0.08} />
        <mesh ref={plane} geometry={geo}>
          <meshBasicMaterial ref={mat} map={texture} toneMapped={false} />
        </mesh>
        <Part window={[0.06, 0.4]} scale={1.05}><Rotor /></Part>
        <Part window={[0.36, 0.72]} y={0.3} scale={0.95} spin={0.6}><Piston /></Part>
        <Part window={[0.66, 0.96]} scale={0.9} spin={1.6}><Bolts /></Part>
        <Dust count={tier >= 3 ? 160 : 60} z={[2.2, 3.6]} spread={[16, 10]} size={0.16} rate={1.8} speed={0.05} />
      </group>
      <Studio />
      <spotLight position={[3.5, 5, 4]} intensity={60} angle={0.5} penumbra={0.9} color="#ffffff" />
      <pointLight position={[-4, -2, 3]} intensity={8} color="#8b7dff" />
    </>
  );
}

/* ---------------- mount ------------------------------------------------------ */
type Opts = { video: HTMLVideoElement; tier: number; reduce: boolean; onReady: () => void };

function App({ video, tier, reduce, active, onReady }: Opts & { active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: 40, position: [0, 0, 6], near: 0.1, far: 40 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.setClearColor('#0a0a1f'); }}
    >
      <Scene video={video} tier={tier} reduce={reduce} onFirstFrame={onReady} />
      {tier >= 2 && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.9} intensity={0.35} mipmapBlur />
          <Vignette darkness={0.28} offset={0.32} />
          <Noise opacity={0.04} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/** Mounts the scene into the hero stage. Returns a handle to pause/resume the render loop. */
export function mountScene(stage: HTMLElement, opts: Opts) {
  const host = document.createElement('div');
  host.className = 'v2-canvas';
  host.setAttribute('aria-hidden', 'true');
  stage.insertBefore(host, stage.querySelector('.video-hero__content'));
  const root = createRoot(host);
  let active = true;
  let ready = false;
  const render = () => root.render(<App {...opts} active={active} onReady={() => { if (ready) return; ready = true; host.classList.add('is-ready'); opts.onReady(); }} />);
  render();
  return {
    setActive(on: boolean) { if (on !== active) { active = on; render(); } },
    unmount() { root.unmount(); host.remove(); },
  };
}
