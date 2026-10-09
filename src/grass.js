import * as THREE from 'three';
import { TERRAIN_GLSL, TRAIL_GLSL, terrainH } from './terrain.js';

const SEGMENTS = 3;

/** One blade: 3 quads + a pointed tip, parameterised by height t in 0..1 and side in -0.5..0.5. */
function bladeGeometry() {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / (SEGMENTS + 1);
    pos.push(-0.5, t, 0, 0.5, t, 0);
  }
  pos.push(0, 1, 0);
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const top = SEGMENTS * 2;
  idx.push(top, top + 1, top + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const vertexShader = /* glsl */ `
  ${TERRAIN_GLSL}
  ${TRAIL_GLSL}
  attribute vec4 aA; // x, z, yaw, seed
  attribute vec4 aB; // height, width, tilt, shade
  uniform float uTime, uWind;
  uniform vec3 uCamPos;
  varying float vT; varying float vShade; varying float vFlat; varying float vSeed;
  varying vec3 vNormal; varying vec3 vWorld; varying float vSide;

  void main() {
    float t = position.y;
    vec2 xz = aA.xy;
    float yaw = aA.z, seed = aA.w;
    float height = aB.x, width = aB.y, tilt = aB.z;
    float ground = terrainH(xz);

    vec3 tr = sampleTrail(xz);
    float f = tr.z;

    // far blades get fatter so the meadow stays solid in the distance
    float dist = length(vec3(xz.x, ground, xz.y) - uCamPos);
    width *= 1.0 + dist * 0.045;

    vec3 right = vec3(cos(yaw), 0.0, sin(yaw));
    vec3 fwd = vec3(-sin(yaw), 0.0, cos(yaw));

    float h = height * (1.0 - 0.55 * f);
    float bend = t * t;
    vec3 p = vec3(xz.x, ground, xz.y);
    p += right * position.x * width * (1.0 - t * 0.9);
    p.y += t * h * (1.0 - 0.35 * bend * (tilt + f));
    p += fwd * tilt * bend * h;

    // wind: slow rolling swell + faster flutter
    float sw = sin(uTime * 0.9 + xz.x * 0.16 + xz.y * 0.11) * 0.6 + sin(uTime * 1.7 + xz.x * 0.5 - xz.y * 0.3 + seed * 6.28) * 0.4;
    float gust = vnoise(xz * 0.07 + vec2(uTime * 0.12, uTime * 0.05));
    vec2 wind = vec2(0.8, 0.6) * (sw * 0.5 + gust * 0.9) * uWind;
    p.xz += wind * bend * h * 0.45;

    // hand: bend away and lie down
    p.xz += tr.xy * f * h * (0.95 * pow(t, 1.4));

    vec4 w = vec4(p, 1.0);
    vWorld = p;
    vT = t; vShade = aB.w; vFlat = f; vSeed = seed; vSide = position.x;
    vNormal = normalize(vec3(fwd.x * (0.55 + tilt), 1.0, fwd.z * (0.55 + tilt)) + vec3(tr.x, 0.0, tr.y) * f);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  ${TERRAIN_GLSL}
  uniform vec3 uBase, uTip, uTipB, uSun, uSunCol, uFogColor, uPatch, uCamPos;
  uniform float uAmbient, uBack, uSheen, uFogDensity, uSunLight, uNight, uPatchAmt, uTime;
  varying float vT; varying float vShade; varying float vFlat; varying float vSeed;
  varying vec3 vNormal; varying vec3 vWorld; varying float vSide;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorld);
    float d = length(uCamPos - vWorld);

    vec3 tip = mix(uTip, uTipB, vShade);
    // dry golden band across the hillside
    float band = smoothstep(18.0, 28.0, vWorld.z) * (1.0 - smoothstep(36.0, 46.0, vWorld.z));
    float dryPatch = band * smoothstep(0.4, 0.7, vnoise(vWorld.xz * vec2(0.09, 0.2) + 3.0)) * uPatchAmt;
    tip = mix(tip, uPatch, dryPatch);
    vec3 baseC = mix(uBase, uPatch * 0.45, dryPatch);

    vec3 col = mix(baseC, tip, pow(vT, 0.75));
    float ao = mix(0.28, 1.0, smoothstep(0.0, 0.7, vT));

    float diff = max(dot(n, uSun), 0.0);
    // light shining through blades when we look toward the sun
    float back = pow(max(dot(-V, uSun), 0.0), 3.0) * vT * uBack;
    float rim = pow(1.0 - abs(vSide) * 1.6, 1.0);
    vec3 lit = col * (uAmbient * ao + diff * 0.35 * uSunLight) + uSunCol * col * back * uSunLight * 0.5;
    lit += uSheen * pow(max(dot(reflect(-uSun, n), V), 0.0), 8.0) * uSunCol * 0.25 * vT;

    // pressed grass is shadowed and looks darker
    lit *= 1.0 - 0.5 * vFlat * (1.0 - vT * 0.4);

    // night: pressed-down grass glows with drifting seed sparkles
    float tw = 0.5 + 0.5 * sin(uTime * 3.0 + vSeed * 40.0);
    float spark = step(0.82, fract(vSeed * 91.7)) * vFlat * uNight * smoothstep(0.9, 1.0, vT) * (0.5 + tw);
    lit += vec3(0.85, 1.0, 0.95) * spark * 1.4;

    float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
    gl_FragColor = vec4(mix(lit, uFogColor, f), 1.0);
  }
`;

export class Grass {
  constructor(shared, count) {
    this.count = count;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), null);
    this.mesh.frustumCulled = false;
    this.material = new THREE.ShaderMaterial({
      uniforms: shared, vertexShader, fragmentShader, side: THREE.DoubleSide,
    });
    this.geometry = null;
    this.mesh.material = this.material;
  }

  /** (Re)scatter blades inside the view wedge for the given half-width/depth ratio. */
  rebuild(wedge) {
    const n = this.count;
    const aA = new Float32Array(n * 4);
    const aB = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const d = 0.4 + 78 * Math.pow(u, 1.85);
      const x = (Math.random() * 2 - 1) * (d * wedge + 1.5);
      const z = d;
      const o = i * 4;
      aA[o] = x; aA[o + 1] = z; aA[o + 2] = Math.random() * Math.PI * 2; aA[o + 3] = Math.random();
      const tall = 0.55 + Math.random() * 0.55;
      aB[o] = tall * (d < 3 ? 1.1 : 1.0);
      aB[o + 1] = 0.035 + Math.random() * 0.03;
      aB[o + 2] = 0.15 + Math.random() * 0.55;
      aB[o + 3] = Math.random();
    }
    const base = bladeGeometry();
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('aA', new THREE.InstancedBufferAttribute(aA, 4));
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(aB, 4));
    g.instanceCount = n;
    if (this.geometry) this.geometry.dispose();
    this.geometry = g;
    this.mesh.geometry = g;
  }
}

export { terrainH };
