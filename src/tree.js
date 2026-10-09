import * as THREE from 'three';
import { terrainH, CREST_Z } from './terrain.js';

/** A lone heart-shaped tree on the crest of the hill. */
export function createTree() {
  const group = new THREE.Group();
  const x = 1.5, z = CREST_Z + 1.5;
  group.position.set(x, terrainH(x, z) - 0.2, z);

  const bark = new THREE.MeshLambertMaterial({ color: '#2a1c12' });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 4.6, 8), bark);
  trunk.position.y = 2.1;
  group.add(trunk);
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 2.6, 6), bark);
    br.position.set(s * 0.8, 4.8, 0);
    br.rotation.z = -s * 0.65;
    group.add(br);
  }

  // canopy: lots of little flat-shaded blobs scattered inside a heart outline
  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const N = 520;
  const inst = new THREE.InstancedMesh(blob, leafMat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0, guard = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (placed < N && guard++ < 20000) {
    const hx = rnd() * 2.7 - 1.35, hy = rnd() * 2.6 - 1.3;
    const k = hx * hx + hy * hy - 1;
    if (k * k * k - hx * hx * hy * hy * hy > 0) continue; // outside the heart
    const depth = Math.sqrt(Math.max(0, 1.4 - hx * hx * 0.5 - hy * hy * 0.3)) * (rnd() * 2 - 1);
    p.set(hx * 2.7, 7.2 + hy * 2.5 + 0.2, depth * 1.7);
    const r = 0.36 + rnd() * 0.42;
    s.set(r, r * (0.8 + rnd() * 0.3), r);
    q.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
    m.compose(p, q, s);
    inst.setMatrixAt(placed, m);
    const shade = 0.75 + rnd() * 0.5 + (hy + 1.2) * 0.08;
    col.setRGB(shade, shade, shade * (0.9 + rnd() * 0.2));
    inst.setColorAt(placed, col);
    placed++;
  }
  inst.count = placed;
  group.add(inst);
  group.userData = { leafMat, bark };
  return group;
}
