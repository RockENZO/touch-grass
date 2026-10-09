# Touch Grass

Touch grass without going outside. An interactive 3D meadow in the browser: run your hand through the grass and it parts, flattens and slowly springs back. Switch between **Morning**, **Golden** hour and **Night** (fireflies, moon, glowing seeds).

Inspired by a short demo video of a "touch grass" website. This is an original implementation, built from scratch with [three.js](https://threejs.org) and custom GLSL shaders. No textures or models are used; everything is procedural.

## How it works

- **Grass**: ~260k instanced blades drawn in a single draw call. Wind, bending and lying-down all happen in the vertex shader.
- **Hand**: the pointer is ray-marched onto the hill and stamped into a decaying 384x384 "trail" texture. Blades read that texture to bend away and flatten, then recover over a few seconds.
- **Sky**: a gradient dome with procedural clouds, sun, moon and stars.
- **Tree**: a heart-shaped canopy built from a few hundred flat-shaded blobs.
- **Time of day**: every colour and light is a preset that gets tweened.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

URL options: `?time=morning|golden|night`, `?q=low` (fewer blades), `?blades=150000`.

## Hosting

The build uses relative paths, so `dist/` works on any static host. This repo includes a GitHub Actions workflow that publishes to GitHub Pages on every push to `main`: in the repo go to Settings > Pages and set the source to **GitHub Actions**.
