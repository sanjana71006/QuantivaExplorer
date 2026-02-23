import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

interface ProbabilityFlowMapProps {
  molecules: { pca_x: number; pca_y: number; probability: number; id?: string }[];
  size?: number; // texture size (power of two)
  onTopIndices?: (indices: number[]) => void;
}

// Adjacency-aware diffusion shader material
const AdjacencyDiffuseMaterial = shaderMaterial(
  {
    uPrevTex: null,
    uNeighborTex: null,
    uN: 1.0,
    uK: 1.0,
    uDamping: 0.98,
    uTemp: 0.0,
    uNoiseSeed: 0.0,
  },
  // vertex
  /* glsl */ `
    void main(){
      gl_Position = vec4(position, 1.0);
    }
  `,
  // fragment
  /* glsl */ `
    precision highp float;
    uniform sampler2D uPrevTex;
    uniform sampler2D uNeighborTex;
    uniform float uN;
    uniform float uK;
    uniform float uDamping;
    uniform float uTemp;
    uniform float uNoiseSeed;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453 + uNoiseSeed);
    }

    void main(){
      // compute node index from fragment x coordinate
      float idx = floor(gl_FragCoord.x - 0.5);
      float nodeNorm = (idx + 0.5) / uN;

      float accum = 0.0;
      // for each neighbor k, fetch neighbor index and weight from neighbor texture
      for (int k = 0; k < 16; k++) { // max K = 16
        if (float(k) >= uK) break;
        vec2 nUV = vec2((float(k) + 0.5) / uK, nodeNorm);
        vec4 nb = texture2D(uNeighborTex, nUV);
        float neighborIndex = nb.r; // stored as float index
        float weight = nb.g;
        if (weight <= 0.0) continue;
        vec2 pUV = vec2((neighborIndex + 0.5) / uN, 0.5);
        float p = texture2D(uPrevTex, pUV).r;
        accum += weight * p;
      }

      // apply damping and temperature noise
      float val = accum * uDamping;
      val += (rand(vec2(idx, uNoiseSeed)) - 0.5) * uTemp * 0.01;
      gl_FragColor = vec4(val, val, val, 1.0);
    }
  `
);

function GPGPUAdj({ prevTex, neighborTex, iterations, damping, temperature, N, K, onTop }: any) {
  const { gl } = useThree();
  const shaderMat = useMemo(() => new (AdjacencyDiffuseMaterial as any)(), []);
  // local texture refs (may be converted to byte textures if float not supported)
  const prevTexRef = useRef<any>(prevTex);
  const neighborTexRef = useRef<any>(neighborTex);
  // color mapping shader: maps grayscale probability to color ramp
  const ColorMapMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: `precision highp float; uniform sampler2D uTex; vec3 mapColor(float v){ vec3 low=vec3(0.12,0.23,0.48); vec3 mid=vec3(0.16,0.72,0.79); vec3 high=vec3(1.0,0.82,0.4); if(v<0.5){ float f=v/0.5; return mix(low, mid, f);} float f=(v-0.5)/0.5; return mix(mid, high, f);} void main(){ float v=texture2D(uTex, gl_FragCoord.xy/vec2(float(${N}),1.0)).r; vec3 c=mapColor(v); gl_FragColor=vec4(c,1.0); }`,
      depthTest: false,
    });
  }, [N]);

  // glow shader: amplify high values for additive blend
  const GlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uPower: { value: 2.5 } },
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: `precision highp float; uniform sampler2D uTex; uniform float uPower; void main(){ float v=texture2D(uTex, gl_FragCoord.xy/vec2(float(${N}),1.0)).r; float g=pow(v, uPower); gl_FragColor=vec4(vec3(g), g*0.6); }`,
      depthTest: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
  }, [N]);

  const rtA = useMemo(() => new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }), [N]);
  const rtB = useMemo(() => new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }), [N]);

  // initialize rtA with prevTex
  useEffect(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    // detect float texture support; if missing, create byte fallbacks
    prevTexRef.current = prevTex;
    neighborTexRef.current = neighborTex;
    try {
      const hasFloat = !!((gl as any).capabilities && (gl as any).capabilities.isWebGL2) || !!(gl.getExtension && (gl.getExtension("OES_texture_float") || gl.getExtension("OES_texture_half_float") || gl.getExtension("EXT_color_buffer_float")));
      if (!hasFloat) {
        // fallback: convert prevTex and neighborTex data arrays to Uint8 textures
        const src = (prevTex as any).image.data as Float32Array | undefined;
        if (src) {
          const u8 = new Uint8Array(src.length);
          for (let i = 0; i < src.length; i++) u8[i] = Math.max(0, Math.min(255, Math.floor(src[i] * 255)));
          prevTexRef.current = new THREE.DataTexture(u8, (prevTex as any).image.width, (prevTex as any).image.height, THREE.RGBAFormat, THREE.UnsignedByteType);
          prevTexRef.current.needsUpdate = true;
        }
        const nsrc = (neighborTex as any).image.data as Float32Array | undefined;
        if (nsrc) {
          const u8 = new Uint8Array(nsrc.length);
          for (let i = 0; i < nsrc.length; i++) u8[i] = Math.max(0, Math.min(255, Math.floor(nsrc[i] * 255)));
          neighborTexRef.current = new THREE.DataTexture(u8, (neighborTex as any).image.width, (neighborTex as any).image.height, THREE.RGBAFormat, THREE.UnsignedByteType);
          neighborTexRef.current.needsUpdate = true;
        }
      }
    } catch (e) {
      // ignore detection errors and proceed with provided textures
    }
    const mat = new THREE.MeshBasicMaterial({ map: prevTexRef.current });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);
    gl.setRenderTarget(rtA);
    gl.render(scene, cam);
    gl.setRenderTarget(null);
    mat.dispose();
    mesh.geometry.dispose();
  }, [prevTex, gl, rtA]);

  // blur render targets (for bloom)
  const blurRT1 = useMemo(() => new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }), [N]);
  const blurRT2 = useMemo(() => new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }), [N]);

  // separable blur material (horizontal along the 1xN strip)
  const BlurMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uRadius: { value: 4.0 }, uResolution: { value: N } },
      vertexShader: `void main(){ gl_Position = vec4(position,1.0); }`,
      fragmentShader: `precision highp float; uniform sampler2D uTex; uniform float uRadius; uniform float uResolution; const int MAX_R=16; void main(){ float idx = gl_FragCoord.x - 0.5; float v=0.0; float wsum=0.0; for(int i=0;i<MAX_R*2;i++){ int off = i - MAX_R; float foff = float(off); if(abs(foff) > uRadius) continue; float x = (idx + foff + 0.5) / uResolution; float s = texture2D(uTex, vec2(x,0.5)).r; float w = exp(-0.5 * (foff*foff) / (uRadius*uRadius + 1e-6)); v += s * w; wsum += w; } v = v / max(1.0, wsum); gl_FragColor = vec4(v,v,v,1.0); }`,
      depthTest: false,
      transparent: false,
    });
  }, [N]);

  // Ref to throttle readback
  const lastReadRef = useRef<number>(0);
  const READ_INTERVAL = 500; // ms

  useFrame(() => {
    let read = rtA;
    let write = rtB;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    for (let i = 0; i < Math.max(0, iterations); i++) {
      shaderMat.uniforms.uPrevTex.value = read.texture;
      shaderMat.uniforms.uNeighborTex.value = neighborTexRef.current || neighborTex;
      shaderMat.uniforms.uN.value = N;
      shaderMat.uniforms.uK.value = K;
      shaderMat.uniforms.uDamping.value = damping;
      shaderMat.uniforms.uTemp.value = temperature;
      shaderMat.uniforms.uNoiseSeed.value = Math.random() * 1000.0;

      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMat as any);
      const scene = new THREE.Scene();
      scene.add(quad);
      gl.setRenderTarget(write);
      gl.render(scene, cam);
      scene.remove(quad);
      quad.geometry.dispose();
      (quad.material as any).dispose && (quad.material as any).dispose();

      // swap
      const t = read;
      read = write;
      write = t;
    }

    // multi-pass blur for glow (ping-pong along the 1xN strip)
    try {
      const blurMat = BlurMaterial.clone();
      // first pass: blur small radius
      blurMat.uniforms.uRadius.value = 2.0;
      blurMat.uniforms.uTex.value = read.texture;
      const quad1 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat as any);
      const sceneB1 = new THREE.Scene();
      sceneB1.add(quad1);
      gl.setRenderTarget(blurRT1);
      gl.render(sceneB1, cam);
      // second pass: wider blur ping-pong
      blurMat.uniforms.uRadius.value = 6.0;
      blurMat.uniforms.uTex.value = blurRT1.texture;
      const quad2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat as any);
      const sceneB2 = new THREE.Scene();
      sceneB2.add(quad2);
      gl.setRenderTarget(blurRT2);
      gl.render(sceneB2, cam);
      // cleanup
      sceneB1.remove(quad1);
      sceneB2.remove(quad2);
      quad1.geometry.dispose();
      quad2.geometry.dispose();
      (quad1.material as any).dispose && (quad1.material as any).dispose();
      (quad2.material as any).dispose && (quad2.material as any).dispose();
    } catch (e) {
      // if blur fails, continue using raw read.texture
    }

    // attempt to read back final probabilities and report top indices, debounced
    try {
      const now = Date.now();
      if (now - lastReadRef.current >= READ_INTERVAL) {
        lastReadRef.current = now;
        if (N > 0) {
          const buf = new Float32Array(N * 4);
          (gl as any).readRenderTargetPixels(read, 0, 0, N, 1, buf);
          const vals: { i: number; v: number }[] = [];
          for (let ii = 0; ii < N; ii++) {
            vals.push({ i: ii, v: buf[ii * 4] });
          }
          vals.sort((a, b) => b.v - a.v);
          const top = vals.slice(0, Math.min(10, vals.length)).map((p) => p.i);
          if (onTop) onTop(top);
        }
      }
    } catch (e) {
      // readback may fail on some platforms; ignore silently
    }

    // colorize
    const sceneColor = new THREE.Scene();
    const colorMat = ColorMapMaterial.clone();
    colorMat.uniforms.uTex.value = read.texture;
    const colorQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), colorMat);
    sceneColor.add(colorQuad);
    gl.setRenderTarget(null);
    gl.render(sceneColor, cam);
    // additive glow pass (no blur, simple approximation)
    const sceneGlow = new THREE.Scene();
    const glowMat = GlowMaterial.clone();
    // use blurred texture for glow when available
    glowMat.uniforms.uTex.value = (typeof blurRT2 !== 'undefined' && blurRT2.texture) ? blurRT2.texture : read.texture;
    const glowQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
    sceneGlow.add(glowQuad);
    // render on top with additive blending
    gl.autoClear = false;
    gl.render(sceneGlow, cam);
    gl.autoClear = true;
    // dispose temporary objects
    colorQuad.geometry.dispose();
    (colorQuad.material as any).dispose && (colorQuad.material as any).dispose();
    glowQuad.geometry.dispose();
    (glowQuad.material as any).dispose && (glowQuad.material as any).dispose();
  });

  return null;
}

export default function ProbabilityFlowMap({ molecules, size = 128, onTopIndices }: ProbabilityFlowMapProps) {
  const texSize = size;
  const [iterations, setIterations] = useState(8);
  const [damping, setDamping] = useState(0.96);
  const [temperature, setTemperature] = useState(0.5);
  const [adjacencySource, setAdjacencySource] = useState<"client" | "server">("client");

  // Build adjacency and initial probability textures for adjacency-aware diffusion
  const { prevTex, neighborTex, N, K } = useMemo(() => {
    const maxN = Math.min(molecules.length, 1024);
    const Kdesired = 8;
    const Kcap = Math.min(16, Math.max(1, Kdesired));
    const pts = molecules.slice(0, maxN);
    if (maxN === 0) {
      // empty fallback textures
      const prev = new THREE.DataTexture(new Float32Array([0, 0, 0, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
      prev.needsUpdate = true;
      const neigh = new THREE.DataTexture(new Float32Array([0, 0, 0, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType);
      neigh.needsUpdate = true;
      return { prevTex: prev, neighborTex: neigh, N: 1, K: 1 };
    }

    const xs = pts.map((m) => m.pca_x);
    const ys = pts.map((m) => m.pca_y);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const spanX = Math.max(1e-6, xmax - xmin);
    const spanY = Math.max(1e-6, ymax - ymin);

    // prepare prev data
    const prevData = new Float32Array(maxN * 4);
    for (let i = 0; i < maxN; i++) {
      const val = Math.max(0, Math.min(1, (pts[i] && pts[i].probability) || 0));
      prevData[i * 4 + 0] = val;
      prevData[i * 4 + 1] = val;
      prevData[i * 4 + 2] = val;
      prevData[i * 4 + 3] = 1.0;
    }
    const prev = new THREE.DataTexture(prevData, maxN, 1, THREE.RGBAFormat, THREE.FloatType);
    prev.needsUpdate = true;

    // compute distances and k-NN
    const positions = pts.map((p) => [p.pca_x, p.pca_y]);
    const distances: number[][] = [];
    for (let i = 0; i < maxN; i++) {
      distances[i] = new Array(maxN);
      for (let j = 0; j < maxN; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        distances[i][j] = Math.sqrt(dx * dx + dy * dy);
      }
    }

    const neighborData = new Float32Array(maxN * Kcap * 4);
    for (let i = 0; i < maxN; i++) {
      // build index array
      const idxs = Array.from({ length: maxN }, (_, j) => j).filter((j) => j !== i);
      idxs.sort((a, b) => distances[i][a] - distances[i][b]);
      const nearest = idxs.slice(0, Kcap);
      // compute sigma as mean distance to neighbors
      const sigma = Math.max(1e-6, nearest.reduce((s, ni) => s + distances[i][ni], 0) / nearest.length);
      let sumw = 0;
      const ws: number[] = [];
      for (let k = 0; k < Kcap; k++) {
        const ni = nearest[k] ?? i;
        const d = distances[i][ni];
        const w = Math.exp(-0.5 * (d * d) / (sigma * sigma + 1e-6));
        ws.push(w);
        sumw += w;
      }
      if (sumw <= 0) sumw = 1.0;
      for (let k = 0; k < Kcap; k++) {
        const ni = nearest[k] ?? i;
        const w = ws[k] / sumw;
        const base = (i * Kcap + k) * 4;
        neighborData[base + 0] = ni; // neighbor index as float
        neighborData[base + 1] = w; // weight
        neighborData[base + 2] = 0.0;
        neighborData[base + 3] = 1.0;
      }
    }

    const neighTex = new THREE.DataTexture(neighborData, Kcap, maxN, THREE.RGBAFormat, THREE.FloatType);
    neighTex.needsUpdate = true;

    return { prevTex: prev, neighborTex: neighTex, N: maxN, K: Kcap };
  }, [molecules]);

  // If dataset is large, try to fetch precomputed adjacency from the backend
  useEffect(() => {
    let cancelled = false;
    const SERVER_THRESHOLD = 256; // send to server when N exceeds this
    async function fetchAdjacency() {
      if (N <= SERVER_THRESHOLD) return;
      try {
        const positions = molecules.slice(0, N).map((m) => [m.pca_x, m.pca_y]);
        const resp = await fetch("/api/adjacency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions, k: K }),
        });
        if (!resp.ok) throw new Error(`Adjacency request failed: ${resp.status}`);
        const json = await resp.json();
        if (!json || !json.neighborBase64) return;
        const b64 = json.neighborBase64 as string;
        // decode base64 to ArrayBuffer
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        const floatBuf = new Float32Array(bytes.buffer);
        // create DataTexture from the float buffer
        const tex = new THREE.DataTexture(floatBuf, K, N, THREE.RGBAFormat, THREE.FloatType);
        tex.needsUpdate = true;
        if (!cancelled) {
          neighborTexRef.current = tex;
          setAdjacencySource("server");
        }
      } catch (e) {
        // ignore and continue using client-side k-NN
        // eslint-disable-next-line no-console
        console.warn("Adjacency fetch failed, using client k-NN", e);
        setAdjacencySource("client");
      }
    }
    fetchAdjacency();
    return () => {
      cancelled = true;
    };
  }, [molecules, N, K]);

  return (
    <div>
      <div className="glass-card p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Iterations: {iterations}</label>
            <input className="w-full" type="range" min={0} max={64} value={iterations} onChange={(e) => setIterations(Number(e.target.value))} />
          </div>
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Damping: {damping.toFixed(2)}</label>
            <input className="w-full" type="range" min={0.8} max={1.0} step={0.01} value={damping} onChange={(e) => setDamping(Number(e.target.value))} />
          </div>
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Temperature: {temperature.toFixed(2)}</label>
            <input className="w-full" type="range" min={0} max={2} step={0.01} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Adjacency: <span className="font-medium">{adjacencySource}</span></div>
      </div>

      <div className="h-64 rounded overflow-hidden bg-gradient-to-tr from-slate-50 to-slate-100">
        <Canvas gl={{ antialias: false, alpha: false }} orthographic camera={{ position: [0, 0, 1] }} style={{ background: "transparent" }}>
          <GPGPUAdj prevTex={prevTex} neighborTex={neighborTex} iterations={iterations} damping={damping} temperature={temperature} N={N} K={K} onTop={onTopIndices} />
        </Canvas>
      </div>
    </div>
  );
}
