import * as THREE from 'three';

export const CREST_Z = 46;
export const CREST_H = 6.5;

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ground height. Must stay identical to `terrainH` in GLSL below. */
export function terrainH(x, z) {
  const rise = sstep(-8, CREST_Z, z);
  const fall = 1 - sstep(CREST_Z, 120, z) * 0.9;
  let h = CREST_H * rise * fall;
  h -= x * x * 0.0011 * rise;
  const calm = sstep(0, 30, z);
  h += calm * (0.35 * Math.sin(x * 0.11 + z * 0.05) + 0.25 * Math.sin(x * 0.05 - z * 0.09 + 1.3));
  return h;
}

export const TERRAIN_GLSL = /* glsl */ `
float terrainH(vec2 p) {
  float x = p.x, z = p.y;
  float rise = smoothstep(-8.0, ${CREST_Z.toFixed(1)}, z);
  float fall = 1.0 - smoothstep(${CREST_Z.toFixed(1)}, 120.0, z) * 0.9;
  float h = ${CREST_H.toFixed(2)} * rise * fall;
  h -= x * x * 0.0011 * rise;
  float calm = smoothstep(0.0, 30.0, z);
  h += calm * (0.35 * sin(x * 0.11 + z * 0.05) + 0.25 * sin(x * 0.05 - z * 0.09 + 1.3));
  return h;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
`;

/** Shared look-up domain of the trail texture (world-space xz). */
export const TRAIL = { x0: -40, w: 80, z0: -4, h: 80, res: 384 };

export const TRAIL_GLSL = /* glsl */ `
uniform sampler2D uTrail;
vec3 sampleTrail(vec2 p) {
  vec2 uv = (p - vec2(${TRAIL.x0.toFixed(1)}, ${TRAIL.z0.toFixed(1)})) / vec2(${TRAIL.w.toFixed(1)}, ${TRAIL.h.toFixed(1)});
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0, 0.0, 0.0);
  vec3 t = texture2D(uTrail, uv).rgb;
  return vec3(t.rg * 2.0 - 1.0, t.b);
}
`;

/** Big displaced ground plane that sits under (and beyond) the grass. */
export function createGround(shared) {
  const geo = new THREE.PlaneGeometry(320, 300, 160, 150);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 100);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)) - 0.02);
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uTrail: shared.uTrail },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vN = normal;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${TERRAIN_GLSL}
      ${TRAIL_GLSL}
      uniform vec3 uBase, uTip, uFogColor, uPatch; uniform float uFogDensity, uPatchAmt, uAmbient;
      uniform vec3 uCamPos;
      varying vec3 vWorld; varying vec3 vN;
      void main() {
        float n = vnoise(vWorld.xz * 0.35) * 0.6 + vnoise(vWorld.xz * 1.7) * 0.4;
        vec3 col = mix(uBase, uTip, 0.28 + 0.4 * n);
        float band = smoothstep(18.0, 28.0, vWorld.z) * (1.0 - smoothstep(36.0, 46.0, vWorld.z));
        float dryPatch = band * smoothstep(0.4, 0.7, vnoise(vWorld.xz * vec2(0.09, 0.2) + 3.0)) * uPatchAmt;
        col = mix(col, uPatch * 0.9, dryPatch);
        col *= 1.0 - 0.5 * sampleTrail(vWorld.xz).z;
        float d = length(vWorld - uCamPos);
        float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
