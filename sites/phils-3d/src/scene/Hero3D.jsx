import React, { Suspense, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import gsap from "gsap";
import { EngineAssembly } from "./EngineAssembly.jsx";

/** Slow push-in on load, then a shallow parallax that follows the pointer. */
function Rig() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });

  React.useLayoutEffect(() => {
    camera.position.set(7.8, 2.9, 8.4);
    camera.lookAt(0, 0.4, 0);
    const tl = gsap.to(camera.position, {
      x: 5.1,
      y: 1.85,
      z: 5.6,
      duration: 3.2,
      ease: "expo.out",
      onUpdate: () => camera.lookAt(0, 0.35, 0),
    });
    const move = (e) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 0.3;
    };
    window.addEventListener("pointermove", move);
    return () => {
      tl.kill();
      window.removeEventListener("pointermove", move);
    };
  }, [camera]);

  useFrame(() => {
    camera.position.x += (5.1 + target.current.x - camera.position.x) * 0.02;
    camera.position.y += (1.85 - target.current.y - camera.position.y) * 0.02;
    camera.lookAt(0, 0.35, 0);
  });

  return null;
}

export default function Hero3D({ onReady }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 32, near: 0.1, far: 60 }}
      onCreated={({ gl, scene }) => {
        gl.toneMappingExposure = 1.05;
        scene.background = null;
        // Hand off from the poster as soon as there is a real frame to show —
        // not when the intro animation ends, or the first seconds are a still.
        requestAnimationFrame(() => requestAnimationFrame(() => onReady && onReady()));
      }}
    >
      {/* Key light does the shaping; the environment does the material work. */}
      <spotLight
        position={[6, 9, 4]}
        angle={0.32}
        penumbra={0.85}
        intensity={140}
        distance={40}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
      <ambientLight intensity={0.12} />

      <Suspense fallback={null}>
        {/* Studio built from lightformers — art-directed reflections, no CDN
            fetch. Swap for <Environment files="/hdr/bay.hdr" /> if you'd
            rather shoot it in a real captured space. */}
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={5} position={[4, 5, 3]} scale={[8, 6, 1]} rotation={[0, -0.6, 0]} />
          <Lightformer form="rect" intensity={2.2} position={[-6, 2, -2]} scale={[7, 5, 1]} rotation={[0, 1.1, 0]} color="#9aa6b8" />
          <Lightformer form="ring" intensity={1.6} position={[0, -3, 4]} scale={5} color="#2418cc" />
        </Environment>

        <EngineAssembly />

        <ContactShadows
          position={[0, -1.85, 0]}
          opacity={0.75}
          scale={16}
          blur={2.4}
          far={6}
          resolution={1024}
          color="#000000"
        />
      </Suspense>

      <Rig />

      <EffectComposer disableNormalPass multisampling={0}>
        <SMAA />
        <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.28} mipmapBlur />
        <Vignette offset={0.32} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
