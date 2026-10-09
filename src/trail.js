import * as THREE from 'three';
import { TRAIL } from './terrain.js';

/**
 * A decaying 2D field over the meadow. Wherever the "hand" has been, grass is
 * pushed away (direction) and flattened (amount); both recover slowly.
 */
export class Trail {
  constructor() {
    const n = TRAIL.res;
    this.n = n;
    this.flat = new Float32Array(n * n);
    this.dx = new Float32Array(n * n);
    this.dz = new Float32Array(n * n);
    this.data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { this.data[i * 4] = 128; this.data[i * 4 + 1] = 128; this.data[i * 4 + 3] = 255; }
    this.texture = new THREE.DataTexture(this.data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
    this.dirty = false;
    this.last = null;
  }

  /** Stamp a soft brush at a world position. `press` makes it bigger and stronger. */
  stamp(x, z, mx, mz, radius, strength) {
    const n = this.n;
    const sx = n / TRAIL.w, sz = n / TRAIL.h;
    const cx = (x - TRAIL.x0) * sx, cz = (z - TRAIL.z0) * sz;
    const rx = radius * sx, rz = radius * sz;
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(n - 1, Math.ceil(cx + rx));
    const z0 = Math.max(0, Math.floor(cz - rz)), z1 = Math.min(n - 1, Math.ceil(cz + rz));
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const ox = (i + 0.5 - cx) / rx, oz = (j + 0.5 - cz) / rz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= 1) continue;
        const w = (1 - d2) * (1 - d2) * strength;
        const k = j * n + i;
        const rl = Math.sqrt(d2) || 1;
        // push mostly away from the hand, partly along the direction of travel
        let px = (ox / rl) * 0.75 + mx * 0.55;
        let pz = (oz / rl) * 0.75 + mz * 0.55;
        const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
        const m = Math.min(1, w * 1.4);
        this.dx[k] += (px - this.dx[k]) * m;
        this.dz[k] += (pz - this.dz[k]) * m;
        if (w > this.flat[k]) this.flat[k] = w;
      }
    }
    this.dirty = true;
  }

  /** Stamp along the segment from the previous position to this one. */
  move(x, z, radius, strength) {
    if (this.last) {
      const dx = x - this.last.x, dz = z - this.last.z;
      const dist = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.ceil(dist / (radius * 0.35)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        this.stamp(this.last.x + dx * t, this.last.z + dz * t, dx, dz, radius, strength);
      }
    } else {
      this.stamp(x, z, 0, 1, radius, strength);
    }
    this.last = { x, z };
  }

  release() { this.last = null; }

  update(dt, recovery = 5.5) {
    const k = Math.exp(-dt / recovery);
    const f = this.flat, a = this.dx, b = this.dz, d = this.data;
    let any = this.dirty;
    for (let i = 0; i < f.length; i++) {
      let v = f[i];
      if (v > 0) {
        v *= k;
        if (v < 0.004) v = 0;
        f[i] = v;
        any = true;
      }
      if (any || v > 0) {
        d[i * 4] = ((a[i] * 0.5 + 0.5) * 255) | 0;
        d[i * 4 + 1] = ((b[i] * 0.5 + 0.5) * 255) | 0;
        d[i * 4 + 2] = (Math.min(1, v) * 255) | 0;
      }
    }
    if (any) this.texture.needsUpdate = true;
    this.dirty = false;
  }
}
