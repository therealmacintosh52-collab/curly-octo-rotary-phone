import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import PhotoHero from "./PhotoHero.jsx";
import Post from "./Post.jsx";

export default function Hero3D({ tier = 3 }) {
  const progress = useRef(0);
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
      onCreated={({ gl }) => {
        // The shader grades its own output; a second tone map washes it.
        gl.toneMapping = THREE.NoToneMapping;
        document.documentElement.setAttribute("data-canvas", "live");
      }}
    >
      <color attach="background" args={["#07071a"]} />
      <Post enabled={tier >= 3} />
      <Suspense fallback={null}>
        <PhotoHero progress={progress} src="/media/03-engine.jpg" />
      </Suspense>
    </Canvas>
  );
}
