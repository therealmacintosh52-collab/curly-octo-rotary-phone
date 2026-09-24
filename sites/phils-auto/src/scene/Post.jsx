import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  KernelSize,
} from "postprocessing";
import { N8AOPostPass } from "n8ao";

/**
 * The post chain, and the reason the scene stops looking like plastic.
 *
 * Ambient occlusion is the big one. Without it nothing darkens where two
 * surfaces meet, so a bolt head sits *on* a flange instead of *in* it and
 * every part floats free of every other. It is the single effect that makes
 * geometry read as solid — more than polygon count, more than texture.
 *
 * Bloom on top, because a highlight that cannot blow out never reads as
 * light hitting metal; and SMAA, because stair-stepped chamfers undo all the
 * work the chamfers were for.
 *
 * All of it is tier-3 only. It is genuinely expensive and it is not worth a
 * dropped frame on a mid-range phone.
 */
export default function Post({ enabled }) {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    if (!enabled) return null;

    const c = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    });
    c.addPass(new RenderPass(scene, camera));

    const ao = new N8AOPostPass(scene, camera, size.width, size.height);
    ao.configuration.aoRadius = 0.85;
    ao.configuration.distanceFalloff = 0.9;
    ao.configuration.intensity = 4.2;
    ao.configuration.color = new THREE.Color(0x05050f);
    ao.configuration.halfRes = true;      // AO at half resolution is free-ish
    ao.setQualityMode("Low");
    c.addPass(ao);

    const bloom = new BloomEffect({
      intensity: 0.42,
      luminanceThreshold: 0.88,
      luminanceSmoothing: 0.28,
      kernelSize: KernelSize.MEDIUM,
      mipmapBlur: true,
    });
    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.OVERLAY });
    noise.blendMode.opacity.value = 0.06;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

    c.addPass(new EffectPass(camera, bloom, noise, tone, new SMAAEffect()));
    return c;
  }, [enabled, gl, scene, camera]);

  useEffect(() => {
    if (!composer) return;
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useEffect(() => () => composer?.dispose(), [composer]);

  // priority 1 takes over rendering from R3F's default render loop.
  useFrame((_, delta) => {
    if (composer) composer.render(delta);
  }, 1);

  return null;
}
