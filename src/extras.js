import * as THREE from 'three';
import { TERRAIN_GLSL, TRAIL_GLSL, terrainH } from './terrain.js';

const PALETTE = [
  [0.95, 0.28, 0.4], [0.98, 0.45, 0.5], [0.9, 0.2, 0.3], [0.99, 0.62, 0.25], [0.99, 0.82, 0.3],
  [0.42, 0.5, 0.85], [0.55, 0.45, 0.85], [0.95, 0.95, 0.98], [0.8, 0.35, 0.75],
];

export function createFlowers(shared, count = 520) {
  // geometry: a stem (2 quads) + a 5-lobed head
  const pos = [], part = [], rad = [];
  const stemW = 0.012;
  for (let i = 0; i <= 2; i++) {
    const t = i / 3;
    pos.push(-stemW, t, 0, stemW, t, 0); part.push(0, 0); rad.push(0, 0);
  }
  pos.push(0, 1, 0); part.push(0); rad.push(0);
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];
  const centre = pos.length / 3;
  pos.push(0, 0, 0); part.push(1); rad.push(0);
  const seg = 30;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const r = 0.8 + 0.2 * Math.cos(a * 5);
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 0); part.push(1); rad.push(r);
  }
  for (let i = 0; i < seg; i++) idx.push(centre, centre + 1 + i, centre + 2 + i);

  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  base.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  base.setAttribute('aRad', new THREE.Float32BufferAttribute(rad, 1));
  base.setIndex(idx);

  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const k of ['position', 'aPart', 'aRad']) g.setAttribute(k, base.attributes[k]);
  const aA = new Float32Array(count * 4), aB = new Float32Array(count * 4), aC = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const d = 2.2 + 38 * Math.pow(Math.random(), 1.6);
    const x = (Math.random() * 2 - 1) * (d * 0.9 + 1);
    aA[i * 4] = x; aA[i * 4 + 1] = d; aA[i * 4 + 2] = Math.random() * 6.28; aA[i * 4 + 3] = Math.random();
    aB[i * 4] = 0.6 + Math.random() * 0.5;       // stem height
    aB[i * 4 + 1] = 0.045 + Math.random() * 0.04; // head radius
    aB[i * 4 + 2] = Math.random();
    aB[i * 4 + 3] = 0;
    const pc = PALETTE[(Math.random() * PALETTE.length) | 0];
    aC.set(pc, i * 3);
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 4));
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
  g.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
  g.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    uniforms: shared,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${TERRAIN_GLSL}
      ${TRAIL_GLSL}
      attribute float aPart, aRad;
      attribute vec4 aA, aB; attribute vec3 aC;
      uniform float uTime, uWind; uniform vec3 uCamPos;
      varying float vPart, vRad; varying vec3 vC; varying float vDist; varying float vFlat;
      void main() {
        vec2 xz = aA.xy;
        float ground = terrainH(xz);
        vec3 tr = sampleTrail(xz);
        float f = tr.z;
        float h = aB.x * (1.0 - 0.6 * f);
        float t = position.y;
        float sway = sin(uTime * 1.3 + xz.x * 0.4 + xz.y * 0.3 + aA.w * 6.0) * 0.5 + 0.5;
        vec2 lean = vec2(0.5, 0.35) * (sway * 0.5 + 0.25) * uWind + tr.xy * f * 0.95;
        vec3 base = vec3(xz.x, ground, xz.y);
        vec3 p = base;
        if (aPart < 0.5) {
          p.x += position.x;
          p.y += t * h;
          p.xz += lean * t * t * h * 0.5;
        } else {
          p.y += h;
          p.xz += lean * h * 0.5;
          float s = sin(aA.z), c = cos(aA.z);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aB.y;
          vec3 up = normalize(vec3(0.0, 0.85, -0.5 + lean.y * 0.4));
          p += vec3(1.0, 0.0, 0.0) * q.x + up * q.y;
        }
        vPart = aPart; vRad = aRad; vC = aC; vFlat = f;
        vDist = length(uCamPos - p);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFogColor, uBase, uTip; uniform float uFogDensity, uFlower, uNight, uAmbient;
      varying float vPart, vRad; varying vec3 vC; varying float vDist; varying float vFlat;
      void main() {
        vec3 col;
        if (vPart < 0.5) col = uBase * 1.6 + 0.05;
        else {
          col = mix(vec3(1.0, 0.85, 0.3), vC, smoothstep(0.1, 0.45, vRad));
          col *= mix(0.35, 1.0, uFlower) * (0.6 + 0.4 * uAmbient + 0.4 * uFlower);
          col = mix(col, col * vec3(0.35, 0.4, 0.75), uNight * 0.6);
        }
        col *= 1.0 - 0.45 * vFlat;
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function createFireflies(shared, count = 70) {
  const g = new THREE.BufferGeometry();
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random()], i * 3);
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uPx: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${TERRAIN_GLSL}
      attribute vec3 aSeed;
      uniform float uTime, uNight, uPx;
      varying float vA;
      void main() {
        float t = uTime * (0.08 + aSeed.z * 0.1);
        vec3 p;
        p.z = 2.5 + aSeed.y * 34.0 + sin(t * 3.1 + aSeed.x * 20.0) * 1.8;
        p.x = (aSeed.x * 2.0 - 1.0) * (p.z * 0.7 + 3.0) + sin(t * 2.3 + aSeed.y * 30.0) * 2.0;
        float g = terrainH(p.xz);
        p.y = g + 0.7 + aSeed.z * 3.2 + sin(t * 4.0 + aSeed.x * 50.0) * 0.7;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float blink = smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(uTime * (0.7 + aSeed.x) + aSeed.y * 40.0));
        vA = uNight * (0.25 + 0.75 * blink);
        gl_PointSize = uPx * (420.0 / -mv.z) * (0.6 + aSeed.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        float a = (pow(core, 3.0) + smoothstep(0.35, 0.0, d)) * vA;
        gl_FragColor = vec4(vec3(0.82, 1.0, 0.35) * a, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}
