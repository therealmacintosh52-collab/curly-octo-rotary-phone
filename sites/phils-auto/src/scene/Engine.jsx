import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A procedural inline-six.
 *
 * Built from primitives rather than loaded from a GLB: nothing to download,
 * and — the reason it matters here — every part keeps its own material, so
 * the desaturation pass can leave exactly one coil lit while the rest go to
 * cold steel. That one lit coil is the whole argument of the page.
 */

export const FAILED_COIL = 2; // zero-indexed: cylinder 3

const STEEL = { color: "#b6bccd", metalness: 0.88, roughness: 0.3 };
const DARK = { color: "#575e75", metalness: 0.7, roughness: 0.48 };

/** Every part, with the axis it travels along when the engine comes apart. */
function buildParts() {
  const parts = [];
  const push = (p) => (parts.push(p), p);

  // Block
  push({
    key: "block",
    geo: ["box", [3.4, 1.15, 1.25]],
    pos: [0, -0.35, 0],
    mat: { color: "#7d849b", metalness: 0.8, roughness: 0.44 },
    out: [0, -0.55, -0.2],
  });

  // Oil pan
  push({
    key: "pan",
    geo: ["box", [3.2, 0.42, 1.05]],
    pos: [0, -1.06, 0],
    mat: DARK,
    out: [0, -1.15, -0.1],
  });

  // Head
  push({
    key: "head",
    geo: ["box", [3.4, 0.5, 1.2]],
    pos: [0, 0.4, 0],
    mat: { color: "#949bb2", metalness: 0.85, roughness: 0.34 },
    out: [0, 0.6, 0],
  });

  // Valve cover
  push({
    key: "cover",
    geo: ["box", [3.25, 0.34, 0.86]],
    pos: [0, 0.8, 0],
    mat: { color: "#464d66", metalness: 0.6, roughness: 0.4 },
    out: [0, 1.25, -0.15],
  });

  // Six coils, sitting proud of the valve cover.
  for (let i = 0; i < 6; i++) {
    const x = -1.35 + i * 0.54;
    push({
      key: `coil-${i}`,
      coil: i,
      geo: ["box", [0.3, 0.44, 0.3]],
      pos: [x, 1.16, 0],
      mat: { color: "#333a52", metalness: 0.45, roughness: 0.5 },
      out: i === FAILED_COIL
        // The one that failed comes out toward you; the rest lift away in
        // an ordered row, so it still reads as an exploded view.
        ? [0.1, 0.35, 1.9]
        : [x * 0.22, 1.15, -0.1],
    });
    // Plug stem down into the head
    push({
      key: `plug-${i}`,
      coil: i,
      geo: ["cyl", [0.055, 0.055, 0.5]],
      pos: [x, 0.76, 0],
      mat: STEEL,
      out: i === FAILED_COIL ? [0.1, -0.1, 1.55] : [x * 0.22, 0.72, -0.1],
    });
  }

  // Intake manifold — six runners on the near side.
  for (let i = 0; i < 6; i++) {
    const x = -1.35 + i * 0.54;
    push({
      key: `runner-${i}`,
      geo: ["cyl", [0.13, 0.13, 0.62]],
      pos: [x, 0.36, 0.72],
      rot: [Math.PI / 2, 0, 0],
      mat: { color: "#6f7691", metalness: 0.78, roughness: 0.4 },
      out: [x * 0.12, 0.2, 0.95],
    });
  }
  push({
    key: "plenum",
    geo: ["cyl", [0.26, 0.26, 3.1]],
    pos: [0, 0.36, 1.08],
    rot: [0, 0, Math.PI / 2],
    mat: { color: "#6f7691", metalness: 0.78, roughness: 0.4 },
    out: [0, 0.28, 1.15],
  });

  // Exhaust manifold — far side.
  push({
    key: "exhaust",
    geo: ["cyl", [0.2, 0.2, 3.0]],
    pos: [0, -0.1, -0.78],
    rot: [0, 0, Math.PI / 2],
    mat: { color: "#9c7f66", metalness: 0.72, roughness: 0.66 },
    out: [0, -0.3, -1.05],
  });

  // Crank snout + pulley
  push({
    key: "crank",
    geo: ["cyl", [0.12, 0.12, 0.7]],
    pos: [1.85, -0.35, 0],
    rot: [0, 0, Math.PI / 2],
    mat: STEEL,
    out: [1.0, 0.05, 0],
  });
  push({
    key: "pulley",
    geo: ["cyl", [0.42, 0.42, 0.22]],
    pos: [2.2, -0.35, 0],
    rot: [0, 0, Math.PI / 2],
    mat: DARK,
    out: [1.45, 0.1, 0],
  });

  // Bell housing
  push({
    key: "bell",
    geo: ["cyl", [0.72, 0.62, 0.5]],
    pos: [-1.95, -0.35, 0],
    rot: [0, 0, Math.PI / 2],
    mat: { color: "#767d96", metalness: 0.8, roughness: 0.44 },
    out: [-1.3, -0.05, 0],
  });

  return parts;
}

function geometryFor(spec) {
  const [kind, args] = spec;
  return kind === "box"
    ? new THREE.BoxGeometry(...args, 1, 1, 1)
    : new THREE.CylinderGeometry(args[0], args[1], args[2], 24);
}

export default function Engine({ progress, tier, coilTarget }) {
  const group = useRef(null);
  const parts = useMemo(buildParts, []);

  const built = useMemo(
    () =>
      parts.map((p) => ({
        ...p,
        geometry: geometryFor(p.geo),
        material: new THREE.MeshStandardMaterial({
          ...p.mat,
          // Cache the authored colour: the desaturation pass lerps away from
          // it and has to be able to come back.
          userData: { base: new THREE.Color(p.mat.color) },
        }),
      })),
    [parts]
  );

  const meshes = useRef([]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const steel = useMemo(() => new THREE.Color("#9aa1b4"), []);
  const amber = useMemo(() => new THREE.Color("#f5a623"), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = progress.current; // 0 → 1 across the pinned sections

    // Wide screens get a split composition: type on the left, engine on the
    // right. Narrow screens centre it and pull it down behind the copy.
    const aspect = state.size.width / state.size.height;
    const wide = aspect > 1.15;
    const homeX = wide ? 2.05 : 0;
    const homeY = wide ? 0 : -0.9;
    const fit = wide ? 1 : 0.78;

    // Beat 1: idle rotation. Never fully stops, so the object stays alive
    // even while the scroll is parked.
    if (group.current) {
      group.current.rotation.y += delta * 0.08 * (1 - p * 0.75);
      // Ease toward the composition slot rather than snapping on resize.
      group.current.position.x += (homeX - group.current.position.x) * 0.06;
      const s = group.current.scale.x + (fit - group.current.scale.x) * 0.06;
      group.current.scale.setScalar(s);
      // Mouse parallax, lagged so it feels weighted rather than glued on.
      const { x, y } = state.pointer;
      group.current.rotation.x += (y * 0.16 - group.current.rotation.x) * 0.04;
      group.current.position.y +=
        (homeY + Math.sin(t * 0.6) * 0.05 - group.current.position.y) * 0.05;
    }

    // Beat 2 (0 → 0.55): the engine comes apart.
    const explode = THREE.MathUtils.smoothstep(p, 0.05, 0.55);
    // Beat 3 (0.55 → 1): everything but the failed coil goes to steel.
    const isolate = THREE.MathUtils.smoothstep(p, 0.55, 0.92);

    for (let i = 0; i < meshes.current.length; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const spec = built[i];

      mesh.position.set(
        spec.pos[0] + spec.out[0] * explode,
        spec.pos[1] + spec.out[1] * explode,
        spec.pos[2] + spec.out[2] * explode
      );

      const failed = spec.coil === FAILED_COIL && spec.key.startsWith("coil");
      const mat = mesh.material;

      // The camera rig needs the coil in world space, not group space.
      if (failed && spec.key.startsWith("coil") && coilTarget) {
        mesh.getWorldPosition(coilTarget.current);
      }

      if (failed) {
        // The one part that stays lit. Its pulse only starts once the rest
        // have drained, so the eye is already free to land on it.
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        mat.color.copy(spec.material.userData.base).lerp(amber, isolate);
        mat.emissive.copy(amber);
        mat.emissiveIntensity = isolate * (0.55 + pulse * 0.85);
        mat.roughness = 0.3;
      } else {
        tmp.copy(spec.material.userData.base).lerp(steel, isolate * 0.85);
        mat.color.copy(tmp);
        mat.emissiveIntensity = 0;
        mat.roughness = THREE.MathUtils.lerp(spec.mat.roughness, 0.78, isolate);
        mat.metalness = THREE.MathUtils.lerp(spec.mat.metalness, 0.55, isolate);
      }
    }
  });

  return (
    <group ref={group} scale={0.001}>
      {built.map((spec, i) => (
        <mesh
          key={spec.key}
          ref={(el) => (meshes.current[i] = el)}
          geometry={spec.geometry}
          material={spec.material}
          position={spec.pos}
          rotation={spec.rot ?? [0, 0, 0]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}
