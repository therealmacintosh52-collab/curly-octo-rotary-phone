/* Photo with a liquid ripple + RGB shift on hover. A tiny raw-WebGL
   shader (no Three.js) so it costs ~3 KB, with the plain <img> as the
   fallback and the LCP-safe element. */
import { useEffect, useRef } from 'react';

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float; varying vec2 v; uniform sampler2D t; uniform vec2 m; uniform float s; uniform float k;
  void main(){
    vec2 d = v - m; float dist = length(d);
    float ripple = sin(dist * 34.0 - k * 5.0) * 0.012 * s * smoothstep(0.55, 0.0, dist);
    vec2 uv = v + normalize(d + 1e-5) * ripple;
    float shift = 0.006 * s;
    float r = texture2D(t, uv + vec2(shift, 0.0)).r;
    float g = texture2D(t, uv).g;
    float b = texture2D(t, uv - vec2(shift, 0.0)).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }`;

export default function RippleImage({ src, alt, width, height, cursor = 'View' }: { src: string; alt: string; width: number; height: number; cursor?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = wrap.current!, c = canvas.current!, im = img.current!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
    const gl = c.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    const sh = (type: number, srcCode: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, srcCode); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uM = gl.getUniformLocation(prog, 'm'), uS = gl.getUniformLocation(prog, 's'), uK = gl.getUniformLocation(prog, 'k');
    const tex = gl.createTexture();
    const upload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      el.classList.add('is-ready');
    };
    if (im.complete && im.naturalWidth) upload(); else im.addEventListener('load', upload, { once: true });
    let m = [0.5, 0.5], target = 0, strength = 0, k = 0, raf = 0, running = false;
    const size = () => { const r = el.getBoundingClientRect(); const d = Math.min(devicePixelRatio, 1.5); c.width = r.width * d; c.height = r.height * d; gl.viewport(0, 0, c.width, c.height); };
    size(); new ResizeObserver(size).observe(el);
    const draw = () => {
      strength += (target - strength) * 0.08; k += 0.016;
      gl.uniform2f(uM, m[0], m[1]); gl.uniform1f(uS, strength); gl.uniform1f(uK, k);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (strength > 0.002 || target > 0) raf = requestAnimationFrame(draw); else running = false;
    };
    const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); m = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; target = 1; kick(); });
    el.addEventListener('pointerleave', () => { target = 0; kick(); });
    kick();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrap} className="ripple" data-cursor={cursor}>
      <img ref={img} src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
