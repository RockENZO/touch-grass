import './style.css';
import * as THREE from 'three';
import { PRESETS, clonePreset, mixPresets } from './presets.js';
import { createGround, terrainH, TRAIL } from './terrain.js';
import { Trail } from './trail.js';
import { Grass } from './grass.js';
import { createSky, createRidge } from './sky.js';
import { createTree } from './tree.js';
import { createFlowers, createFireflies } from './extras.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const coarse = matchMedia('(pointer: coarse)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // colours below are authored as final sRGB values
renderer.setClearColor(0x000000, 1);
const maxDpr = coarse ? 1.5 : 1.75;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const EYE_H = 1.25;
camera.position.set(0, terrainH(0, 0) + EYE_H, 0);

// ---- shared uniforms, filled from the current preset every frame
const trail = new Trail();
const cur = clonePreset(PRESETS.golden);
const shared = {
  uTime: { value: 0 }, uWind: { value: 1 }, uTrail: { value: trail.texture }, uCamPos: { value: camera.position },
  uSkyTop: { value: cur.skyTop }, uSkyMid: { value: cur.skyMid }, uSkyHorizon: { value: cur.skyHorizon },
  uCloud: { value: cur.cloud }, uCloudAmt: { value: cur.cloudAmt },
  uSun: { value: cur.sunDir }, uSunCol: { value: cur.sunCol }, uSunVis: { value: cur.sunVis }, uSunLight: { value: cur.sunLight },
  uMoon: { value: cur.moonDir }, uMoonVis: { value: cur.moonVis }, uStars: { value: cur.stars },
  uBase: { value: cur.grassBase }, uTip: { value: cur.grassTip }, uTipB: { value: cur.grassTipB },
  uAmbient: { value: cur.ambient }, uBack: { value: cur.back }, uSheen: { value: cur.sheen },
  uFogColor: { value: cur.fogColor }, uFogDensity: { value: cur.fogDensity },
  uRidge: { value: cur.ridge }, uPatch: { value: cur.patch }, uPatchAmt: { value: cur.patchAmt },
  uFlower: { value: cur.flower }, uNight: { value: cur.night },
};

scene.add(createSky(shared));
scene.add(createRidge(shared));
scene.add(createGround(shared));

const tree = createTree();
scene.add(tree);
const sunLight = new THREE.DirectionalLight('#fff', 1);
const ambLight = new THREE.AmbientLight('#fff', 1);
scene.add(sunLight, ambLight);

const lowQ = params.get('q') === 'low';
const blades = Number(params.get('blades')) || (lowQ ? 60000 : coarse ? 130000 : 260000);
const grass = new Grass(shared, blades);
scene.add(grass.mesh);
const flowers = createFlowers(shared, lowQ ? 160 : 520);
scene.add(flowers);
const fireflies = createFireflies(shared, 70);
scene.add(fireflies);

// ---- sizing
let wedge = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.aspect = aspect;
  // keep at least a ~54 degree horizontal field of view on portrait screens
  const hfov = THREE.MathUtils.degToRad(54);
  camera.fov = aspect >= 1 ? 50 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
  camera.updateProjectionMatrix();
  fireflies.material.uniforms.uPx.value = dpr * (h / 900);
  const wantWedge = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect * 1.18 + 0.12;
  if (Math.abs(wantWedge - wedge) > 0.04) { wedge = wantWedge; grass.rebuild(wedge); }
}
addEventListener('resize', resize);
resize();

// ---- time of day
let from = clonePreset(PRESETS.golden), to = PRESETS.golden, mixT = 1, mixDur = 1.6;
let current = 'golden';
function setTime(name, instant = false) {
  if (!PRESETS[name]) return;
  from = clonePreset(cur);
  to = PRESETS[name];
  mixT = instant ? 1 : 0;
  current = name;
  document.body.dataset.time = name;
  document.querySelectorAll('.pill button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.time === name)));
  placeThumb();
  if (instant) mixPresets(cur, from, to, 1);
}
function placeThumb() {
  const b = document.querySelector(`.pill button[data-time="${current}"]`);
  const thumb = document.getElementById('thumb');
  if (!b) return;
  thumb.style.width = b.offsetWidth + 'px';
  thumb.style.transform = `translateX(${b.offsetLeft}px)`;
}
document.querySelectorAll('.pill button').forEach((b) => b.addEventListener('click', () => setTime(b.dataset.time)));
addEventListener('resize', placeThumb);
document.fonts?.ready.then(placeThumb);
setTime(params.get('time') || 'golden', true);
requestAnimationFrame(placeThumb);

// ---- the hand
const hand = document.getElementById('hand');
const hint = document.getElementById('hint');
const mouse = { x: 0, y: 0, nx: 0, ny: 0, down: false, seen: false };
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();

/** Where the pointer's ray meets the meadow, at roughly mid-blade height. */
function groundPoint(px, py) {
  ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  if (d.y > -0.002 && d.z <= 0) return null;
  let prev = 0.3, hit = null;
  for (let t = 0.3; t < 90; t += t * 0.04 + 0.1) {
    tmp.copy(d).multiplyScalar(t).add(o);
    if (tmp.y < terrainH(tmp.x, tmp.z) + 0.45) {
      let a = prev, b = t;
      for (let i = 0; i < 8; i++) {
        const m = (a + b) / 2;
        tmp.copy(d).multiplyScalar(m).add(o);
        if (tmp.y < terrainH(tmp.x, tmp.z) + 0.45) b = m; else a = m;
      }
      hit = tmp.copy(d).multiplyScalar(b).add(o).clone();
      break;
    }
    prev = t;
  }
  return hit;
}

function touch(px, py) {
  const g = groundPoint(px, py);
  if (!g) return;
  const dist = Math.hypot(g.x, g.z);
  const press = mouse.down ? 1 : 0;
  const radius = (1.35 + dist * 0.06) * (1 + press * 0.55);
  trail.move(g.x, g.z, radius, 0.9 + press * 0.1);
}

function onMove(e) {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = (e.clientX / innerWidth) * 2 - 1;
  mouse.ny = (e.clientY / innerHeight) * 2 - 1;
  hand.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  hand.style.opacity = 1;
  if (!mouse.seen) { mouse.seen = true; setTimeout(() => hint.classList.add('gone'), 3500); }
  if (e.target.closest?.('.pill')) { trail.release(); return; }
  touch(e.clientX, e.clientY);
}
addEventListener('pointermove', onMove);
addEventListener('pointerdown', (e) => { mouse.down = true; hand.classList.add('down'); onMove(e); });
addEventListener('pointerup', () => { mouse.down = false; hand.classList.remove('down'); if (coarse) trail.release(); });
document.addEventListener('pointerleave', () => { hand.style.opacity = 0; trail.release(); });

// ---- loop
const clock = new THREE.Clock();
let t = 0;
const capture = params.has('capture'); // ?capture=1 stops the loop; call __grass.advance(dt) to render frames by hand
function step(dt) {
  t += dt;
  shared.uTime.value = t;

  if (mixT < 1) {
    mixT = Math.min(1, mixT + dt / mixDur);
    const e = mixT * mixT * (3 - 2 * mixT);
    mixPresets(cur, from, to, e);
  }
  shared.uCloudAmt.value = cur.cloudAmt;
  for (const [k, u] of Object.entries({
    skyTop: 'uSkyTop', skyMid: 'uSkyMid', skyHorizon: 'uSkyHorizon', cloud: 'uCloud', sunDir: 'uSun', sunCol: 'uSunCol',
    moonDir: 'uMoon', grassBase: 'uBase', grassTip: 'uTip', grassTipB: 'uTipB', fogColor: 'uFogColor', ridge: 'uRidge', patch: 'uPatch',
  })) shared[u].value = cur[k];
  for (const [k, u] of Object.entries({
    cloudAmt: 'uCloudAmt', sunVis: 'uSunVis', sunLight: 'uSunLight', moonVis: 'uMoonVis', stars: 'uStars', ambient: 'uAmbient', back: 'uBack',
    sheen: 'uSheen', fogDensity: 'uFogDensity', patchAmt: 'uPatchAmt', flower: 'uFlower', night: 'uNight',
  })) shared[u].value = cur[k];

  sunLight.position.copy(cur.sunDir).multiplyScalar(50);
  sunLight.color.copy(cur.treeLight); sunLight.intensity = cur.treeLightI * Math.PI;
  ambLight.color.copy(cur.treeAmb); ambLight.intensity = cur.treeAmbI * Math.PI;
  tree.userData.leafMat.color.copy(cur.treeLeaf);

  // a gentle drift of the head, plus a little parallax toward the pointer
  const yaw = -mouse.nx * 0.035 + Math.sin(t * 0.21) * 0.006;
  const pitch = -mouse.ny * 0.018 + Math.sin(t * 0.17) * 0.004 + 0.012;
  camera.rotation.set(pitch, Math.PI + yaw, 0, 'YXZ'); // the scene lies along +z
  camera.position.y = terrainH(0, 0) + EYE_H + Math.sin(t * 0.5) * 0.012;

  trail.update(dt);
  renderer.render(scene, camera);
}
function frame() {
  step(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
if (!capture) requestAnimationFrame(frame);

// for tests / tinkering from the console
window.__grass = { advance: step, setTime, touch, trail, camera, TRAIL, get t() { return t; } };
