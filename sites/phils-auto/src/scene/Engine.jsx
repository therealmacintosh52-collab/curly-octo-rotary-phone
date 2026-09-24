import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { roundedBox, lathe, tube, boltRow, ribs, mergeAll, castRoughness, castNormal, grime } from "./parts.js";

/**
 * A procedural inline-six.
 *
 * Built from primitives rather than loaded from a GLB — nothing to download,
 * and every part keeps its own material so the desaturation pass can leave
 * exactly one coil lit while the rest go to cold steel. That one lit coil is
 * the whole argument of the page.
 *
 * Every edge is chamfered, every flange carries bolt heads, every pipe bends
 * instead of running straight, and every metal surface takes a generated
 * roughness map. Those four things, not polygon count, are the difference
 * between a machined part and a plastic brick.
 */

export const FAILED_COIL = 2; // zero-indexed: cylinder 3

const CAST_IRON = { color: "#6a7183", metalness: 0.62, roughness: 0.78 };
const MACHINED = { color: "#d6dbe6", metalness: 0.95, roughness: 0.18 };
const ALLOY = { color: "#a8b0c4", metalness: 0.88, roughness: 0.32 };
const HEAT_SCALE = { color: "#8a6446", metalness: 0.78, roughness: 0.72 };
const RUBBER = { color: "#20232e", metalness: 0.1, roughness: 0.85 };

const COIL_X = (i) => -1.35 + i * 0.54;

/** Every part: its geometry, where it sits, and the axis it flies out along. */
function buildParts() {
  const parts = [];
  const add = (p) => parts.push(p);

  /* ---- block: chamfered casting, cooling ribs, bolt flange ------------- */
  add({
    key: "block",
    geometry: () =>
      mergeAll([
        roundedBox(3.4, 1.15, 1.25, 0.07),
        ribs(7, 3.15, 0.5, 0.055, 0.14, [0, -0.1, 0.63]),
        ribs(7, 3.15, 0.5, 0.055, 0.14, [0, -0.1, -0.63]),
        boltRow(8, [-1.5, 0.58, 0.55], [1.5, 0.58, 0.55]),
        boltRow(8, [-1.5, 0.58, -0.55], [1.5, 0.58, -0.55]),
      ]),
    pos: [0, -0.35, 0],
    mat: CAST_IRON,
    out: [0, -0.55, -0.2],
  });

  /* ---- oil pan: pressed steel, drain boss ----------------------------- */
  add({
    key: "pan",
    geometry: () =>
      mergeAll([
        roundedBox(3.18, 0.42, 1.04, 0.1),
        new THREE.CylinderGeometry(0.07, 0.07, 0.1, 12).rotateZ(Math.PI / 2).translate(1.5, -0.14, 0),
        boltRow(10, [-1.5, 0.2, 0.5], [1.5, 0.2, 0.5]),
        boltRow(10, [-1.5, 0.2, -0.5], [1.5, 0.2, -0.5]),
      ]),
    pos: [0, -1.06, 0],
    mat: { color: "#4e5568", metalness: 0.72, roughness: 0.5 },
    out: [0, -1.15, -0.1],
  });

  /* ---- head: deck, cam towers, bolt line ------------------------------ */
  add({
    key: "head",
    geometry: () =>
      mergeAll([
        roundedBox(3.4, 0.5, 1.2, 0.06),
        ribs(6, 0.3, 0.22, 0.34, 0.54, [0, 0.3, 0]),
        boltRow(12, [-1.55, 0.27, 0.5], [1.55, 0.27, 0.5]),
        boltRow(12, [-1.55, 0.27, -0.5], [1.55, 0.27, -0.5]),
      ]),
    pos: [0, 0.4, 0],
    mat: ALLOY,
    out: [0, 0.6, 0],
  });

  /* ---- valve cover: raised centre rib, oil cap, perimeter bolts ------- */
  add({
    key: "cover",
    geometry: () =>
      mergeAll([
        roundedBox(3.25, 0.3, 0.86, 0.09),
        roundedBox(2.7, 0.12, 0.42, 0.05).translate(0, 0.18, 0),
        lathe([[0, 0], [0.13, 0], [0.13, 0.1], [0.1, 0.13], [0, 0.13]], 20)
          .rotateZ(-Math.PI / 2)
          .translate(1.35, 0.2, 0),
        boltRow(7, [-1.4, 0.16, 0.38], [1.4, 0.16, 0.38]),
        boltRow(7, [-1.4, 0.16, -0.38], [1.4, 0.16, -0.38]),
      ]),
    pos: [0, 0.8, 0],
    paint: true,
    mat: { color: "#2f3550", metalness: 0.55, roughness: 0.35 },
    out: [0, 1.25, -0.15],
  });

  /* ---- six coils: body, connector boss, plug boot ---------------------- */
  for (let i = 0; i < 6; i++) {
    const x = COIL_X(i);
    add({
      key: `coil-${i}`,
      coil: i,
      geometry: () =>
        mergeAll([
          roundedBox(0.28, 0.4, 0.28, 0.05),
          roundedBox(0.19, 0.11, 0.13, 0.03).translate(0, 0.2, 0.11),
          new THREE.CylinderGeometry(0.055, 0.075, 0.16, 14).translate(0, -0.26, 0),
        ]),
      pos: [x, 1.16, 0],
      paint: true,
      mat: { color: "#262c40", metalness: 0.35, roughness: 0.58 },
      out:
        i === FAILED_COIL
          ? [0.1, 0.35, 1.9] // the one that failed comes toward you
          : [x * 0.22, 1.15, -0.1],
    });
    add({
      key: `plug-${i}`,
      coil: i,
      geometry: () =>
        mergeAll([
          new THREE.CylinderGeometry(0.048, 0.048, 0.34, 12),
          new THREE.CylinderGeometry(0.072, 0.072, 0.07, 6).translate(0, 0.19, 0),
        ]),
      pos: [x, 0.78, 0],
      smooth: true,
      clean: true,
      mat: MACHINED,
      out: i === FAILED_COIL ? [0.1, -0.1, 1.55] : [x * 0.22, 0.72, -0.1],
    });
  }

  /* ---- intake: plenum with domed ends, six curved runners ------------- */
  add({
    key: "plenum",
    geometry: () =>
      mergeAll([
        lathe([
          [0, -1.55], [0.16, -1.55], [0.24, -1.42], [0.26, -0.6],
          [0.26, 0.6], [0.24, 1.42], [0.16, 1.55], [0, 1.55],
        ]),
        boltRow(3, [-0.9, 0.2, 0.2], [0.9, 0.2, 0.2], 0.03),
      ]),
    pos: [0, 0.4, 1.02],
    smooth: true,
    mat: { color: "#8d95ab", metalness: 0.84, roughness: 0.32 },
    out: [0, 0.28, 1.15],
  });
  for (let i = 0; i < 6; i++) {
    const x = COIL_X(i);
    add({
      key: `runner-${i}`,
      geometry: () =>
        tube(
          [
            [x, 0.32, 0.4],   // into the head
            [x, 0.40, 0.66],
            [x * 0.85, 0.44, 0.9],
            [x * 0.6, 0.40, 1.0], // into the plenum
          ],
          0.085
        ),
      pos: [0, 0, 0],
      mat: { color: "#8d95ab", metalness: 0.84, roughness: 0.34 },
      out: [x * 0.12, 0.2, 0.95],
    });
  }

  /* ---- exhaust: six runners collecting into one downpipe -------------- */
  add({
    key: "exhaust",
    geometry: () => {
      const g = [];
      for (let i = 0; i < 6; i++) {
        const x = COIL_X(i);
        g.push(
          tube(
            [
              [x, 0.22, -0.4],
              [x, 0.1, -0.66],
              [x * 0.5, -0.12, -0.82],
              [0.1, -0.3, -0.86],
            ],
            0.072,
            20,
            10
          )
        );
      }
      g.push(tube([[0.1, -0.3, -0.86], [0.5, -0.42, -0.9], [1.1, -0.5, -0.88]], 0.13, 16, 12));
      return mergeAll(g);
    },
    pos: [0, 0, 0],
    mat: HEAT_SCALE,
    out: [0, -0.3, -1.05],
  });

  /* ---- crank snout and a grooved pulley -------------------------------- */
  add({
    key: "crank",
    geometry: () => new THREE.CylinderGeometry(0.11, 0.11, 0.6, 20).rotateZ(Math.PI / 2),
    pos: [1.82, -0.35, 0],
    smooth: true,
    clean: true,
    mat: MACHINED,
    out: [1.0, 0.05, 0],
  });
  add({
    key: "pulley",
    geometry: () =>
      lathe([
        [0, -0.11], [0.16, -0.11], [0.2, -0.09],
        [0.4, -0.075], [0.34, -0.045], [0.4, -0.015],
        [0.34, 0.015], [0.4, 0.045], [0.34, 0.075],
        [0.4, 0.09], [0.2, 0.1], [0.16, 0.11], [0, 0.11],
      ]),
    pos: [2.18, -0.35, 0],
    mat: { color: "#3a4054", metalness: 0.84, roughness: 0.36 },
    out: [1.45, 0.1, 0],
  });

  /* ---- bell housing: taper, flange, bolt circle ----------------------- */
  add({
    key: "bell",
    geometry: () =>
      mergeAll([
        lathe([
          [0, -0.26], [0.6, -0.26], [0.74, -0.2], [0.78, -0.05],
          [0.72, 0.12], [0.6, 0.2], [0.5, 0.26], [0, 0.26],
        ]),
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return new THREE.CylinderGeometry(0.038, 0.04, 0.06, 6)
            .rotateZ(Math.PI / 2)
            .translate(-0.28, Math.cos(a) * 0.66, Math.sin(a) * 0.66);
        }),
      ]),
    pos: [-1.95, -0.35, 0],
    mat: ALLOY,
    out: [-1.3, -0.05, 0],
  });

  /* ---- a couple of hoses, because a bare casting looks like a render --- */
  add({
    key: "hose-upper",
    geometry: () =>
      tube([[-1.55, 0.5, -0.3], [-1.9, 0.62, -0.45], [-2.2, 0.45, -0.55], [-2.3, 0.05, -0.5]], 0.062),
    pos: [0, 0, 0],
    mat: RUBBER,
    out: [-1.1, 0.25, -0.4],
  });
  add({
    key: "loom",
    geometry: () =>
      tube([[-1.5, 1.05, -0.12], [-0.6, 1.12, -0.16], [0.6, 1.12, -0.16], [1.45, 1.05, -0.12]], 0.045),
    pos: [0, 0, 0],
    mat: RUBBER,
    out: [0, 1.3, -0.2],
  });

  return parts;
}

export default function Engine({ progress, coilTarget }) {
  const group = useRef(null);
  const meshes = useRef([]);

  const built = useMemo(() => {
    const rough = castRoughness();
    const normal = castNormal();
    const dirt = grime();
    return buildParts().map((p) => {
      const metal = p.mat.metalness > 0.4;
      // Painted and machined faces get a clearcoat; raw castings do not.
      const material = p.paint
        ? new THREE.MeshPhysicalMaterial({
            ...p.mat,
            clearcoat: 0.85,
            clearcoatRoughness: 0.22,
            normalMap: normal,
            normalScale: new THREE.Vector2(0.1, 0.1),
            roughnessMap: rough,
          })
        : new THREE.MeshStandardMaterial({
            ...p.mat,
            roughnessMap: metal ? rough : null,
            normalMap: normal,
            normalScale: new THREE.Vector2(p.smooth ? 0.12 : 0.34, p.smooth ? 0.12 : 0.34),
            map: p.clean ? null : dirt,
          });
      material.envMapIntensity = 1.6;
      material.userData = { base: new THREE.Color(p.mat.color) };
      return { ...p, geo: p.geometry(), material };
    });
  }, []);

  const tmp = useMemo(() => new THREE.Color(), []);
  const steel = useMemo(() => new THREE.Color("#5c6273"), []);
  const amber = useMemo(() => new THREE.Color("#f5a623"), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const p = progress.current;

    const aspect = state.size.width / state.size.height;
    const wide = aspect > 1.15;
    const homeX = wide ? 3.05 : 0;
    const homeY = wide ? -0.35 : -1.75;
    const fit = wide ? 0.82 : 0.54;

    if (group.current) {
      /* Hero angle: three-quarter, intake side toward the viewer, drifting
         within a range that never turns the block end-on. */
      const HERO_Y = -0.62;
      const swing = Math.sin(t * 0.16) * 0.2;
      const aimY = HERO_Y + swing + state.pointer.x * 0.12 + p * 0.35;
      group.current.rotation.y += (aimY - group.current.rotation.y) * 0.04;

      const { y } = state.pointer;
      group.current.rotation.x += (0.12 + y * 0.1 - group.current.rotation.x) * 0.04;
      group.current.rotation.z += (-0.04 - group.current.rotation.z) * 0.04;
      group.current.position.x += (homeX - group.current.position.x) * 0.06;
      group.current.position.y +=
        (homeY + Math.sin(t * 0.6) * 0.05 - group.current.position.y) * 0.05;
      const s = group.current.scale.x + (fit - group.current.scale.x) * 0.06;
      group.current.scale.setScalar(s);
    }

    const explode = THREE.MathUtils.smoothstep(p, 0.05, 0.55);
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

      if (failed) {
        if (coilTarget) mesh.getWorldPosition(coilTarget.current);
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
        mat.color.copy(spec.material.userData.base).lerp(amber, isolate);
        mat.emissive.copy(amber);
        mat.emissiveIntensity = isolate * (0.5 + pulse * 0.8);
        mat.roughness = 0.3;
      } else {
        tmp.copy(spec.material.userData.base).lerp(steel, isolate * 0.85);
        mat.color.copy(tmp);
        if (mat.map) mat.map.repeat.setScalar(2);
        mat.emissiveIntensity = 0;
        mat.roughness = THREE.MathUtils.lerp(spec.mat.roughness, 0.88, isolate);
        mat.metalness = THREE.MathUtils.lerp(spec.mat.metalness, 0.28, isolate);
        mat.envMapIntensity = THREE.MathUtils.lerp(1.6, 0.45, isolate);
      }
    }
  });

  return (
    <group ref={group} scale={0.001}>
      {built.map((spec, i) => (
        <mesh
          key={spec.key}
          ref={(el) => (meshes.current[i] = el)}
          geometry={spec.geo}
          material={spec.material}
          position={spec.pos}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
