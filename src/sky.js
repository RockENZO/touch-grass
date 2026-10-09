import * as THREE from 'three';
import { TERRAIN_GLSL } from './terrain.js';

export function createSky(shared) {
  const mat = new THREE.ShaderMaterial({
    uniforms: shared,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      ${TERRAIN_GLSL}
      uniform vec3 uSkyTop, uSkyMid, uSkyHorizon, uCloud, uSun, uSunCol, uMoon;
      uniform float uCloudAmt, uSunVis, uMoonVis, uStars, uTime;
      varying vec3 vDir;

      float fbm(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
        return s;
      }

      void main() {
        vec3 d = normalize(vDir);
        float e = max(d.y, 0.0);
        vec3 col = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.18, e));
        col = mix(col, uSkyTop, smoothstep(0.12, 0.75, e));

        // soft stratus
        vec2 cp = d.xz / (e + 0.22) * 0.9 + vec2(uTime * 0.006, 0.0);
        float c = fbm(cp * 1.4);
        float c2 = fbm(cp * 3.1 + 7.0);
        float dens = smoothstep(0.42, 0.78, c * 0.75 + c2 * 0.35) * smoothstep(0.0, 0.2, e) * (1.0 - smoothstep(0.55, 1.0, e) * 0.5);
        col = mix(col, uCloud, dens * uCloudAmt);

        // sun
        float sd = max(dot(d, normalize(uSun)), 0.0);
        col += uSunCol * (pow(sd, 24.0) * 0.1 + pow(sd, 260.0) * 0.35) * uSunVis;
        col = mix(col, vec3(1.0, 0.98, 0.93), smoothstep(0.99955, 0.99975, sd) * uSunVis);

        // moon
        float md = max(dot(d, normalize(uMoon)), 0.0);
        col += vec3(0.55, 0.65, 1.0) * (pow(md, 40.0) * 0.18 + pow(md, 400.0) * 0.25) * uMoonVis;
        col = mix(col, vec3(0.96, 0.97, 1.0), smoothstep(0.99955, 0.9997, md) * uMoonVis);

        // stars
        vec3 sp = d * 160.0;
        vec3 ip = floor(sp);
        float h = fract(sin(dot(ip, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float star = step(0.9975, h) * smoothstep(0.1, 0.45, e);
        vec3 fp = fract(sp) - 0.5;
        star *= smoothstep(0.5, 0.0, length(fp)) * (0.6 + 0.4 * sin(uTime * 2.0 + h * 90.0));
        col += vec3(star) * uStars * (1.0 - dens * uCloudAmt);

        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/** A soft, faint ridge of far-off hills beyond the crest. */
export function createRidge(shared) {
  const shape = new THREE.Shape();
  shape.moveTo(-400, -20);
  const pts = 60;
  for (let i = 0; i <= pts; i++) {
    const x = -400 + (800 * i) / pts;
    const y = 16 + 9 * Math.sin(x * 0.012 + 1.0) + 6 * Math.sin(x * 0.031 + 2.0) + 3 * Math.sin(x * 0.07);
    shape.lineTo(x, y);
  }
  shape.lineTo(400, -20);
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.ShaderMaterial({
    uniforms: shared,
    depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 uRidge, uFogColor; varying vec3 vP;
      void main(){ float a = smoothstep(-20.0, 24.0, vP.y); vec3 c = mix(uRidge, uFogColor, 0.35 + 0.4 * (1.0 - a)); gl_FragColor = vec4(c, 0.8 * (1.0 - smoothstep(14.0, 40.0, vP.y) * 0.8)); }`,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -2, 260);
  mesh.rotation.y = Math.PI; // face the camera
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  return mesh;
}
