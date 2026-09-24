import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Engine, { FAILED_COIL } from "./Engine.jsx";
import Post from "./Post.jsx";

/* ------------------------------------------------------------------ *
 * Layer 1 (far): a domain-warped noise plane. Near-black indigo, very
 * low contrast — you read it as depth rather than as a pattern. Moves
 * at 0.15x with the pointer.
 * ------------------------------------------------------------------ */
const BACKDROP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2  uPointer;

vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
                 dot(hash(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
             mix(dot(hash(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
                 dot(hash(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  uv += uPointer * 0.15;                       // the 0.15x parallax
  float t = uTime * 0.035;
  // Domain warp: noise sampled at coordinates that are themselves noise.
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 + vec2(3.2, 1.7) - t));
  float f = fbm(uv * 2.1 + q * 1.4);

  vec3 deep  = vec3(0.022, 0.022, 0.075);
  vec3 lift  = vec3(0.075, 0.062, 0.300);
  vec3 col = mix(deep, lift, smoothstep(-0.30, 0.72, f));
  col *= 1.0 - 0.55 * dot(uv, uv);              // fall off at the edges
  gl_FragColor = vec4(col, 1.0);
}`;

const BACKDROP_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;

function Backdrop() {
  const mat = useRef(null);
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    const p = mat.current.uniforms.uPointer.value;
    p.x += (state.pointer.x - p.x) * 0.03;
    p.y += (state.pointer.y - p.y) * 0.03;
  });
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } }),
    []
  );
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        vertexShader={BACKDROP_VERT}
        fragmentShader={BACKDROP_FRAG}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * Layer 3 (near): shop air. Instanced motes drifting at 1.6x, slightly
 * out of focus. Count scales with tier.
 * ------------------------------------------------------------------ */
function Motes({ count }) {
  const ref = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 9,
        z: 2 + Math.random() * 3,
        s: 0.004 + Math.random() * 0.011,
        drift: 0.1 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      })),
    [count]
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const px = state.pointer.x * 1.6; // the 1.6x parallax
    const py = state.pointer.y * 1.6;
    seeds.forEach((s, i) => {
      dummy.position.set(
        s.x + Math.sin(t * s.drift + s.phase) * 0.35 + px * 0.3,
        s.y + Math.cos(t * s.drift * 0.8 + s.phase) * 0.3 + py * 0.3,
        s.z
      );
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#b9c4ff" transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  );
}

/* Additive glow standing in for a bloom pass on the one lit coil. A full
 * composer chain costs more kilobytes than this page can spend; a sprite
 * reads the same at this scale and runs on a phone. */
function CoilGlow({ progress }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const isolate = THREE.MathUtils.smoothstep(progress.current, 0.55, 0.92);
    const explode = THREE.MathUtils.smoothstep(progress.current, 0.05, 0.55);
    const x = -1.35 + FAILED_COIL * 0.54;
    ref.current.position.set(x + x * 0.18 * explode, 1.16 + 3.1 * explode, 0);
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.4);
    const a = isolate * (0.2 + pulse * 0.28);
    ref.current.visible = a > 0.004;          // no stray dot before it is found
    ref.current.material.opacity = a;
    ref.current.scale.setScalar(0.9 + isolate * 0.9 + pulse * 0.18);
  });
  return (
    <sprite ref={ref} visible={false}>
      <spriteMaterial
        color="#f5a623"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

/** Studio light without an HDR file: PMREM over a tiny gradient scene. */
function ProceduralEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 12, 8);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = d.y * 0.5 + 0.5;
          vec3 c = mix(vec3(0.04,0.04,0.10), vec3(0.62,0.65,0.86), pow(h, 1.2));
          c += vec3(0.34,0.30,0.85) * smoothstep(0.42, 0.0, h) * 1.6;   // indigo bounce

          /* Softbox strips. Without a bright shape to reflect, a metal
             surface has nothing to be shiny with and reads as grey plastic —
             this is the studio, not the lighting. */
          float bar1 = smoothstep(0.42, 0.0, abs(d.z - 0.45)) * smoothstep(0.35, 0.95, h);
          float bar2 = smoothstep(0.34, 0.0, abs(d.x + 0.55)) * smoothstep(0.2, 0.9, h);
          float bar3 = smoothstep(0.30, 0.0, abs(d.x - 0.7))  * smoothstep(0.1, 0.8, h);
          c += vec3(1.00, 0.99, 0.96) * bar1 * 12.0;
          c += vec3(0.82, 0.86, 1.00) * bar2 * 7.0;
          c += vec3(0.66, 0.62, 1.00) * bar3 * 5.0;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    env.add(new THREE.Mesh(geo, mat));
    const target = pmrem.fromScene(env, 0.018);
    scene.environment = target.texture;
    return () => {
      target.dispose();
      pmrem.dispose();
      geo.dispose();
      mat.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

/**
 * The camera rig. Three moves, one per beat:
 *   hold on the assembled engine · ease back as it comes apart ·
 *   push in on the coil that failed.
 * Framing is aspect-aware so the payoff is centred on a phone too.
 */
function CameraRig({ progress, coilTarget }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const p = progress.current;
    const cam = state.camera;
    const wide = state.size.width / state.size.height > 1.15;
    const homeX = wide ? 3.05 : 0;
    const homeY = wide ? 0 : -0.9;

    const back = THREE.MathUtils.smoothstep(p, 0.05, 0.55);   // beat 2
    const push = THREE.MathUtils.smoothstep(p, 0.6, 1.0);     // beat 3

    // Where the camera wants to be.
    // Beat 1-2 sit off to the side of the engine; beat 3 lands squarely in
    // front of the coil, offset so the copy on the left keeps its room.
    const holdZ = THREE.MathUtils.lerp(7.4, 8.6, back);
    want.set(
      THREE.MathUtils.lerp(0, coilTarget.current.x + (wide ? 1.15 : 0), push),
      THREE.MathUtils.lerp(0.4 + homeY * 0.2, coilTarget.current.y + 0.35, push),
      THREE.MathUtils.lerp(holdZ, coilTarget.current.z + 3.9, push)
    );
    cam.position.lerp(want, 0.12);

    // What it is looking at.
    look.lerp(
      want.set(
        THREE.MathUtils.lerp(homeX * 0.42, coilTarget.current.x, push),
        THREE.MathUtils.lerp(homeY * 0.5 + 0.15, coilTarget.current.y, push),
        THREE.MathUtils.lerp(0, coilTarget.current.z, push)
      ),
      0.12
    );
    cam.lookAt(look);
    cam.updateProjectionMatrix();
  });

  return null;
}

export default function Hero3D({ tier = 3 }) {
  const progress = useRef(0);
  const coilTarget = useRef(new THREE.Vector3(-0.3, 1.2, 0));
  /**
   * The scene idles and pulses, so while it is on screen it genuinely needs
   * every frame — "demand" plus a rAF that invalidates each tick is just
   * "always" wearing a disguise, and it kept the main thread pinned even
   * after the hero had scrolled away. So: render always while visible,
   * and stop dead the moment it is not.
   */
  const [running, setRunning] = useState(true);

  // Scroll progress across the pinned sections, written straight into a ref
  // so nothing re-renders React on scroll.
  useEffect(() => {
    const stage = document.querySelector("[data-scene-range]");
    if (!stage) return;
    let queued = false;
    const read = () => {
      queued = false;
      const rect = stage.getBoundingClientRect();
      const span = stage.offsetHeight - window.innerHeight;
      progress.current = Math.min(1, Math.max(0, -rect.top / (span || 1)));
      document.documentElement.style.setProperty(
        "--scene-progress",
        progress.current.toFixed(4)
      );
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
    };
  }, []);

  useEffect(() => {
    const stage = document.querySelector("[data-scene-range]");
    if (!stage) return;
    let onScreen = true;
    const sync = () => setRunning(onScreen && !document.hidden);

    const io = new IntersectionObserver(
      ([e]) => { onScreen = e.isIntersecting; sync(); },
      { threshold: 0 }
    );
    io.observe(stage);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const moteCount = tier >= 3 ? 420 : 180;

  return (
    <Canvas
      className="hero-canvas"
      aria-hidden="true"
      frameloop={running ? "always" : "never"}
      dpr={[1, 1.5]}
      gl={{ antialias: tier >= 3, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0.4, 7.4], fov: 38 }}
      onCreated={({ gl }) => {
        gl.toneMapping = tier >= 3 ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.5;
        if (tier >= 3) {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        document.documentElement.setAttribute("data-canvas", "live");
      }}
    >
      <color attach="background" args={["#07071a"]} />
      <ProceduralEnvironment />

      <Backdrop />

      {/* Studio key, indigo fill, and a hard rim so the block separates from
          the backdrop instead of dissolving into it. */}
      {/* The environment above does most of the work; these shape it. */}
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[5, 7, 6]}
        intensity={4.6}
        color="#eef1ff"
        castShadow={tier >= 3}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={22}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0012}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-6, 2, -4]} intensity={2.6} color="#6a5bff" />
      <directionalLight position={[-2, 4, -6]} intensity={3.4} color="#dfe4ff" />

      <Post enabled={tier >= 3} />
      <CameraRig progress={progress} coilTarget={coilTarget} />
      <Engine progress={progress} coilTarget={coilTarget} />
      <CoilGlow progress={progress} />

      <Motes count={moteCount} />
    </Canvas>
  );
}
