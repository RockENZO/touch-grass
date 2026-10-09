import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const c = (hex) => new THREE.Color(hex);
const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

/** Everything that changes between times of day. Numbers, Colors and Vector3s are tweened. */
export const PRESETS = {
  morning: {
    skyTop: c('#8fb2dd'), skyMid: c('#c3d4e6'), skyHorizon: c('#f3e9d8'),
    cloud: c('#ffffff'), cloudAmt: 0.55,
    sunDir: v(0.45, 0.16, 1), sunCol: c('#fff0cf'), sunVis: 0.0, sunLight: 0.9,
    moonDir: v(0.26, 0.33, 1), moonVis: 0,
    stars: 0,
    grassBase: c('#16300f'), grassTip: c('#6f9f35'), grassTipB: c('#9bbf4c'),
    ambient: 0.62, back: 0.55, sheen: 0.0,
    fogColor: c('#cfd9d6'), fogDensity: 0.0105,
    ridge: c('#8c9a93'),
    patch: c('#b79a3b'), patchAmt: 0.45,
    treeLeaf: c('#4c5a1e'), treeLight: c('#fff2d0'), treeLightI: 1.1, treeAmb: c('#7f8fa3'), treeAmbI: 1.0,
    flower: 0.8, night: 0, spark: 0, exposure: 1,
  },
  golden: {
    skyTop: c('#b79bc4'), skyMid: c('#e9b99f'), skyHorizon: c('#fbd2a6'),
    cloud: c('#f8d1c0'), cloudAmt: 0.7,
    sunDir: v(-0.3, 0.2, 1), sunCol: c('#ffe2b0'), sunVis: 1.0, sunLight: 1.25,
    moonDir: v(0.26, 0.33, 1), moonVis: 0,
    stars: 0,
    grassBase: c('#2c4a06'), grassTip: c('#a2d41c'), grassTipB: c('#d2e033'),
    ambient: 0.5, back: 1.0, sheen: 0.25,
    fogColor: c('#f2c7a3'), fogDensity: 0.0085,
    ridge: c('#b08a7c'),
    patch: c('#e6b830'), patchAmt: 0.8,
    treeLeaf: c('#6a6c1e'), treeLight: c('#ffcf94'), treeLightI: 0.9, treeAmb: c('#a58d85'), treeAmbI: 1.0,
    flower: 1.0, night: 0, spark: 0, exposure: 1,
  },
  night: {
    skyTop: c('#0b1642'), skyMid: c('#16306f'), skyHorizon: c('#2a4c8f'),
    cloud: c('#3d5a9c'), cloudAmt: 0.25,
    sunDir: v(-0.3, 0.2, 1), sunCol: c('#8fb3ff'), sunVis: 0.0, sunLight: 0.55,
    moonDir: v(0.26, 0.33, 1), moonVis: 1.0,
    stars: 1,
    grassBase: c('#0b2a3a'), grassTip: c('#2fbf9e'), grassTipB: c('#3fd1a8'),
    ambient: 0.38, back: 0.25, sheen: 0.5,
    fogColor: c('#1b3568'), fogDensity: 0.0095,
    ridge: c('#14295c'),
    patch: c('#1c5a58'), patchAmt: 0.5,
    treeLeaf: c('#23463f'), treeLight: c('#9db8ff'), treeLightI: 0.35, treeAmb: c('#3a5a99'), treeAmbI: 0.8,
    flower: 0.3, night: 1, spark: 1, exposure: 1,
  },
};

export const clonePreset = (p) => {
  const o = {};
  for (const k in p) o[k] = typeof p[k] === 'number' ? p[k] : p[k].clone();
  return o;
};

/** Blend preset `a` into `b` at amount t, writing the result into `out`. */
export function mixPresets(out, a, b, t) {
  for (const k in a) {
    const x = a[k], y = b[k];
    if (typeof x === 'number') out[k] = x + (y - x) * t;
    else if (x.isColor) out[k].copy(x).lerp(y, t);
    else out[k].copy(x).lerp(y, t).normalize();
  }
  return out;
}
