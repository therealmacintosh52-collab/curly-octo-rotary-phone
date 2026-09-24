import { useEffect, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The hero, as a shader over the shop's own photograph.
 *
 * Three rounds of trying to model an engine in code got closer every time and
 * still read as CG, because what makes an engine bay look real is not surface
 * detail — it is clutter. Brackets, looms, hose clamps, a rag on the fender, a
 * torque wrench somebody put down. That is an artist's week of work, not a
 * procedural geometry problem.
 *
 * So the subject is a real photograph of a real teardown in this shop, and the
 * WebGL does what WebGL is actually good at over an image: depth parallax, a
 * diagnostic scan, and a focus pull that drains the frame to grey except the
 * one cylinder being talked about. It cannot look fake, because it is not.
 */

/** Where the push-in lands: cylinder 3, in image space. */
const FOCUS = [0.47, 0.545];

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uTex;
uniform vec2  uRes;        // canvas size
uniform vec2  uTexRes;     // photograph size
uniform vec2  uPointer;
uniform vec2  uFocus;      // the cylinder we end on, in image space
uniform float uTime;
uniform float uProgress;   // 0 → 1 across the pinned beats
uniform float uWide;

/* Cover-fit: fill the canvas, crop the overflow, never squash.
   The visible slice of the image SHRINKS on the axis being cropped, so the
   aspect ratio multiplies here — dividing samples outside the texture and
   smears the edge pixels down the frame. */
vec2 coverUv(vec2 uv, float zoom, vec2 screenAt, vec2 imageAt) {
  float canvasAR = uRes.x / uRes.y;
  float imageAR  = uTexRes.x / uTexRes.y;
  vec2 s = canvasAR > imageAR
    ? vec2(1.0, imageAR / canvasAR)
    : vec2(canvasAR / imageAR, 1.0);
  // screenAt is where on the canvas imageAt should appear. Keeping the two
  // separate is what lets the push-in land the cylinder clear of the copy
  // instead of underneath it.
  return (uv - screenAt) * s / zoom + imageAt;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  /* Beat 1 → 2: a slow push toward the cylinder we are going to name.
     Beat 3: the push continues and tightens. */
  float push = smoothstep(0.0, 1.0, uProgress);

  // Where the subject sits on screen: centre at rest, clear of the copy by
  // the time it is being pointed at.
  vec2 rest     = uWide > 0.5 ? vec2(0.5, 0.5)  : vec2(0.5, 0.42);
  vec2 landing  = uWide > 0.5 ? vec2(0.68, 0.5) : vec2(0.5, 0.34);
  vec2 screenAt = mix(rest, landing, smoothstep(0.3, 1.0, uProgress));

  vec2 imageAt = mix(vec2(0.5, 0.52), uFocus, smoothstep(0.3, 1.0, uProgress));
  float zoom   = mix(1.0, 1.95, push);

  vec2 base = coverUv(vUv, zoom, screenAt, imageAt);

  /* Depth parallax. Luminance stands in for depth here: in an engine bay the
     bright metal is what is near the camera and the shadowed recesses are what
     is far, so offsetting by it separates the foreground from the bay behind
     it. Two taps, no depth map to ship. */
  float depth = luma(texture2D(uTex, base).rgb);
  vec2 shift = uPointer * (0.004 + depth * 0.013) * (1.0 - push * 0.6);
  vec2 uv = base + shift;

  /* Very slight chromatic separation, strongest at the edges — a lens, not
     an effect. */
  float edge = length(vUv - 0.5) * 1.4;
  float ca = 0.0009 * edge * (1.0 + push);
  vec3 col = vec3(
    texture2D(uTex, uv + vec2(ca, 0.0)).r,
    texture2D(uTex, uv).g,
    texture2D(uTex, uv - vec2(ca, 0.0)).b
  );

  /* Beat 2: a diagnostic scan travelling down the bay. */
  float scanPos = smoothstep(0.12, 0.62, uProgress);
  float band = smoothstep(0.055, 0.0, abs(vUv.y - (1.15 - scanPos * 1.3)));
  float scanning = smoothstep(0.08, 0.2, uProgress) * (1.0 - smoothstep(0.58, 0.72, uProgress));
  col += vec3(0.42, 0.40, 1.0) * band * scanning * 0.5;
  col += vec3(0.30, 0.34, 0.9) * band * band * scanning * 0.9;

  /* Beat 3: everything drains to grey except the cylinder being named.
     Measured in screen space around where the subject landed, so the marker
     stays a fixed size on the page however far the push has travelled. */
  float isolate = smoothstep(0.55, 0.95, uProgress);
  vec2 d = (vUv - screenAt) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(d) / (uWide > 0.5 ? 0.17 : 0.22);
  float inside = 1.0 - smoothstep(0.8, 1.15, r);

  vec3 grey = vec3(luma(col));
  grey = mix(grey, grey * vec3(0.86, 0.89, 1.06), 0.55);   // cold, not neutral
  col = mix(col, mix(grey * 0.82, col * 1.16, inside), isolate);

  /* The ring. Amber, the colour of a warning light, used nowhere else. */
  float ring = smoothstep(0.028, 0.0, abs(r - 1.0));
  float pulse = 0.72 + 0.28 * sin(uTime * 2.2);
  col += vec3(0.96, 0.65, 0.14) * ring * isolate * pulse * 1.5;

  /* Grade: lift the brand indigo into the shadows, hold the highlights. */
  float l = luma(col);
  col = mix(col, col * vec3(0.72, 0.74, 1.18), (1.0 - l) * 0.35);
  col *= 1.0 - 0.42 * dot(vUv - 0.5, vUv - 0.5) * 2.0;     // vignette
  col *= mix(1.0, 1.06, push);

  gl_FragColor = vec4(col, 1.0);
}`;

export default function PhotoHero({ progress, src, focus = FOCUS }) {
  const texture = useLoader(THREE.TextureLoader, src);
  const { size } = useThree();

  /**
   * Built exactly once.
   *
   * This object has to be the same one for the life of the component: if it
   * is rebuilt on a render, the material keeps a reference to the old one
   * while useFrame writes to the new one, and every uniform silently stops
   * reaching the shader. A default prop of `[0.47, 0.545]` is a fresh array
   * on every render, which is all it took to do exactly that — so focus is
   * applied through an effect rather than through the dependency list.
   */
  const store = useRef(null);
  if (!store.current) {
    // useLoader suspends, so the texture is already decoded here. Handing the
    // sampler a real texture at construction matters: seeded with null and
    // filled in later, the shader kept the empty texture and drew black.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    /* The material is constructed here rather than declared as JSX.
       Handing <shaderMaterial> a `uniforms` prop does not guarantee the
       renderer ends up using that exact object — it did not, and every write
       from useFrame went to an orphan while the shader kept reading zero.
       Owning the material outright removes the question. */
    store.current = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTex: { value: texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTexRes: { value: new THREE.Vector2(texture.image.width, texture.image.height) },
        uPointer: { value: new THREE.Vector2() },
        uFocus: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uWide: { value: 1 },
      },
    });
  }
  const material = store.current;
  const uniforms = material.uniforms;

  useEffect(() => () => material.dispose(), [material]);

  // Primitives in the dependency list, so an inline array cannot retrigger it.
  const [fx, fy] = focus;
  useEffect(() => {
    uniforms.uFocus.value.set(fx, 1 - fy);
  }, [fx, fy, uniforms]);

  useFrame((state, delta) => {
    const u = uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uRes.value.set(size.width, size.height);
    u.uWide.value = size.width / size.height > 1.15 ? 1 : 0;
    /* Frame-rate independent easing. A plain `x += (target - x) * k` runs at
       whatever speed the device happens to render at: identical code feels
       snappy at 120fps and sluggish at 30. Exponential decay over delta gives
       every device the same half-life. */
    const ease = (from, to, halfLife) =>
      from + (to - from) * (1 - Math.exp((-Math.LN2 * delta) / halfLife));

    // Lag the pointer so the parallax feels weighted rather than glued on.
    u.uPointer.value.x = ease(u.uPointer.value.x, state.pointer.x, 0.12);
    u.uPointer.value.y = ease(u.uPointer.value.y, state.pointer.y, 0.12);
    u.uProgress.value = ease(u.uProgress.value, progress.current, 0.14);

    /* Published so the screenshot script can wait for the move to settle
       instead of guessing at a sleep. */
    document.documentElement.style.setProperty(
      "--scene-eased",
      u.uProgress.value.toFixed(4)
    );
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
