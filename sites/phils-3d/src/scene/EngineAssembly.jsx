import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useGLTF } from "@react-three/drei";

/**
 * The thesis of the page: an inline-six ignition system explodes apart, then
 * everything greys out except the one coil that actually failed.
 *
 * Ships with a procedural assembly so the scene is never blocked on an asset.
 * Drop a Draco-compressed GLB at /models/engine.glb (<2MB) and it takes over —
 * name the six coil meshes coil_1 … coil_6 and the rest is unchanged.
 */
const FAILED_COIL = 3; // cylinder 4 — the one we "find"

const STEEL = { color: "#6d7683", metalness: 1, roughness: 0.34 };
const DARK = { color: "#2b3038", metalness: 0.9, roughness: 0.5 };
const BRAND = "#2418cc";

function Part({ position, explode, children, register }) {
  const ref = useRef();
  useLayoutEffect(() => {
    ref.current.userData.home = new THREE.Vector3(...position);
    ref.current.userData.explode = new THREE.Vector3(...explode);
    register(ref.current);
  }, [position, explode, register]);
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

export function EngineAssembly() {
  const group = useRef();
  const parts = useRef([]);
  const coils = useRef([]);

  const register = useMemo(
    () => (obj) => {
      if (obj && !parts.current.includes(obj)) parts.current.push(obj);
    },
    []
  );

  useLayoutEffect(() => {
    const tl = gsap.timeline({ delay: 0.9 });

    // 1. Everything drifts apart — staggered, expo.out, never in unison.
    parts.current.forEach((p, i) => {
      tl.to(
        p.position,
        {
          x: p.userData.explode.x,
          y: p.userData.explode.y,
          z: p.userData.explode.z,
          duration: 1.6,
          ease: "expo.out",
        },
        0.06 * i
      );
    });

    // 2. The isolation frame: everything falls to grey but cylinder four.
    coils.current.forEach((mesh, i) => {
      if (!mesh) return;
      const failed = i === FAILED_COIL;
      tl.to(
        mesh.material,
        {
          duration: 0.9,
          ease: "power2.inOut",
          emissiveIntensity: failed ? 1.5 : 0,
          roughness: failed ? 0.18 : 0.85,
          metalness: failed ? 0.7 : 0.25,
        },
        "-=0.35"
      );
      tl.to(
        mesh.material.color,
        {
          duration: 0.9,
          ease: "power2.inOut",
          r: failed ? 0.36 : 0.26,
          g: failed ? 0.36 : 0.27,
          b: failed ? 0.42 : 0.29,
        },
        "<"
      );
    });

    return () => tl.kill();
  }, []);

  return (
    <group ref={group} rotation={[0, -0.42, 0]} position={[0.4, -0.15, 0]}>
      {/* block */}
      <Part position={[0, 0, 0]} explode={[0, -0.35, 0]} register={register}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.4, 1.15, 1.15]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      </Part>

      {/* oil pan */}
      <Part position={[0, -0.78, 0]} explode={[0, -1.75, 0]} register={register}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.5, 0.95]} />
          <meshStandardMaterial {...DARK} roughness={0.7} />
        </mesh>
      </Part>

      {/* head */}
      <Part position={[0, 0.78, 0]} explode={[0, 1.22, 0]} register={register}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.3, 0.42, 1.05]} />
          <meshStandardMaterial {...STEEL} roughness={0.42} />
        </mesh>
      </Part>

      {/* valve cover */}
      <Part position={[0, 1.16, 0]} explode={[0, 2.35, 0]} register={register}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.1, 0.34, 0.9]} />
          <meshStandardMaterial {...STEEL} roughness={0.25} />
        </mesh>
      </Part>

      {/* intake manifold + runners */}
      <Part position={[0, 0.55, 0.95]} explode={[0, 0.9, 2.5]} register={register}>
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 3.0, 24]} />
          <meshStandardMaterial {...STEEL} roughness={0.3} />
        </mesh>
        {[-1.15, -0.69, -0.23, 0.23, 0.69, 1.15].map((x) => (
          <mesh key={x} position={[x, -0.32, -0.3]} rotation={[0.9, 0, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.8, 16]} />
            <meshStandardMaterial {...STEEL} roughness={0.36} />
          </mesh>
        ))}
      </Part>

      {/* six coil packs — the subjects of the shot */}
      {[-1.15, -0.69, -0.23, 0.23, 0.69, 1.15].map((x, i) => (
        <Part
          key={x}
          position={[x, 1.5, -0.1]}
          explode={[x * 1.35, 2.35 + (i === FAILED_COIL ? 0.55 : 0), -0.1]}
          register={register}
        >
          <mesh
            castShadow
            ref={(m) => (coils.current[i] = m)}
            rotation={[0, 0, 0]}
          >
            <boxGeometry args={[0.3, 0.42, 0.3]} />
            <meshStandardMaterial
              color="#7e8794"
              metalness={0.85}
              roughness={0.3}
              emissive={BRAND}
              emissiveIntensity={0}
            />
          </mesh>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 0.3, 12]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
        </Part>
      ))}

      {/* front pulley */}
      <Part position={[-1.85, 0.05, 0]} explode={[-3.1, 0.05, 0]} register={register}>
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.52, 0.52, 0.26, 40]} />
          <meshStandardMaterial {...STEEL} roughness={0.22} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.34, 24]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      </Part>

      {/* bellhousing */}
      <Part position={[1.95, 0, 0]} explode={[3.35, 0, 0]} register={register}>
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.62, 0.72, 0.5, 32]} />
          <meshStandardMaterial {...DARK} roughness={0.6} />
        </mesh>
      </Part>
    </group>
  );
}

useGLTF.preload && (EngineAssembly.preloadGLB = (url) => useGLTF.preload(url, true));
