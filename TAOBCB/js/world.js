/* =====================================================================
   WORLD
   ---------------------------------------------------------------------
   Builds the ground, water, plants, fossils and food for a chosen biome,
   and runs the day/night cycle. The player spawns into the biome that
   matches their dinosaur (a swamp dweller starts in a swamp, etc.).
   ===================================================================== */

import * as THREE from "three";

// Each biome has its own look: ground color, sky/fog, and what grows there.
const BIOMES = {
  forest:  { ground: 0x3f5a32, fog: 0x9fb98a, sky: 0x8fb27a, prop: "tree",   propColor: 0x2f6b2f, water: true },
  swamp:   { ground: 0x4a5238, fog: 0x7e8a6a, sky: 0x76836a, prop: "reed",   propColor: 0x5a6b3a, water: true },
  desert:  { ground: 0xc2a564, fog: 0xe6d3a0, sky: 0xe9d39c, prop: "cactus", propColor: 0x6b8a4a, water: true },
  plains:  { ground: 0x7a8a48, fog: 0xc9d49a, sky: 0xbcd089, prop: "bush",   propColor: 0x4a6b2f, water: true },
  river:   { ground: 0x5c6b40, fog: 0xa7bf94, sky: 0x9ec18a, prop: "tree",   propColor: 0x2f6b2f, water: true },
  ocean:   { ground: 0x244a3a, fog: 0x3a6b7a, sky: 0x4a8aa0, prop: "none",   propColor: 0x000000, water: true, deepWater: true },
};

export const WORLD_RADIUS = 95; // how far the flat world extends from center

export class World {
  constructor(scene, species) {
    this.scene = scene;
    this.species = species;
    this.biome = BIOMES[species.biome] || BIOMES.plains;

    this.foods = [];    // edible things -> turn to bones when eaten
    this.fossils = [];  // collectible fossils -> give scales
    this.waterMeshes = [];
    this.propSpots = []; // where trees/bushes are, so food doesn't spawn inside them
    this._spotSeed = 0;  // advances each spot we pick, so things spread out
    this.timeOfDay = 0.25; // 0..1, start at morning

    this._build();
  }

  _build() {
    const b = this.biome;

    // Sky color + fog so the far edges fade out (and the world feels big)
    this.scene.background = new THREE.Color(b.sky);
    this.scene.fog = new THREE.Fog(b.fog, 40, WORLD_RADIUS * 1.4);

    // Ground
    const groundGeo = new THREE.CircleGeometry(WORLD_RADIUS, 48);
    groundGeo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: b.ground, roughness: 1 })
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Lights
    this.hemi = new THREE.HemisphereLight(b.sky, b.ground, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const d = 60;
    this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Water bodies (lake / river / open ocean)
    if (b.water) this._buildWater(b);

    // Scenery props
    this._scatterProps(b);

    // Food and fossils
    this._scatterFood();
    this._scatterFossils();
  }

  _buildWater(b) {
    const waterMat = new THREE.MeshStandardMaterial({
      color: b.deepWater ? 0x1d5066 : 0x2f7d8a,
      transparent: true, opacity: 0.78, roughness: 0.3, metalness: 0.1,
    });
    if (b.deepWater) {
      // Ocean: a big water disc covering most of the map
      const w = new THREE.Mesh(new THREE.CircleGeometry(WORLD_RADIUS * 0.95, 40), waterMat);
      w.rotation.x = -Math.PI / 2;
      w.position.y = 0.4;
      this.scene.add(w);
      this.waterMeshes.push({ mesh: w, x: 0, z: 0, r: WORLD_RADIUS * 0.95 });
    } else {
      // A few lakes scattered around (x, z, radius)
      const spots = [[22, -28, 22], [-38, 16, 17], [10, 42, 19]];
      for (const [x, z, r] of spots) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(r, 28), waterMat);
        w.rotation.x = -Math.PI / 2;
        w.position.set(x, 0.25, z);
        this.scene.add(w);
        this.waterMeshes.push({ mesh: w, x, z, r });
        // darker basin under the water so it reads as a depression
        const basin = new THREE.Mesh(
          new THREE.CircleGeometry(r + 1.5, 28),
          new THREE.MeshStandardMaterial({ color: 0x33402a, roughness: 1 })
        );
        basin.rotation.x = -Math.PI / 2;
        basin.position.set(x, 0.05, z);
        this.scene.add(basin);
      }
    }
  }

  _scatterProps(b) {
    if (b.prop === "none") return;
    const count = 70;
    for (let i = 0; i < count; i++) {
      const { x, z } = this._randomLandSpot();
      if (x === null) continue;
      const prop = this._makeProp(b.prop, b.propColor);
      prop.position.set(x, 0, z);
      prop.rotation.y = i * 1.3;
      this.scene.add(prop);
      this.propSpots.push({ x, z }); // remember so food/fossils avoid this spot
    }
  }

  _makeProp(kind, color) {
    const g = new THREE.Group();
    const mat = (col) => new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 1 });
    if (kind === "tree") {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 6), mat(0x5b3f24));
      trunk.position.y = 2; g.add(trunk);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), mat(color));
      leaves.position.y = 5; g.add(leaves);
    } else if (kind === "cactus") {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 4, 7), mat(color));
      body.position.y = 2; g.add(body);
    } else if (kind === "reed") {
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 4), mat(color));
        r.position.set((Math.cos(i) ) * 0.6, 1.5, (Math.sin(i)) * 0.6);
        g.add(r);
      }
    } else { // bush
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat(color));
      bush.position.y = 1; g.add(bush);
    }
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    return g;
  }

  /* --- Food: plants for herbivores, carcasses for carnivores, fish for piscivores --- */
  _scatterFood() {
    const diet = this.species.diet;
    const count = 16;
    for (let i = 0; i < count; i++) {
      let spot, inWater = false;
      if (diet === "piscivore" || this.species.build === "swimmer") {
        spot = this._randomWaterSpot(); inWater = true;
        if (!spot) spot = this._randomLandSpot(true);
      } else {
        spot = this._randomLandSpot(true); // keep food out of trees/bushes
      }
      if (!spot || spot.x === null) continue;
      const food = this._makeFood(diet, inWater);
      food.group.position.set(spot.x, inWater ? 0.6 : 0, spot.z);
      this.scene.add(food.group);
      this.foods.push({ ...food, x: spot.x, z: spot.z, eaten: false });
    }
  }

  _makeFood(diet, inWater) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
    let label;
    if (diet === "piscivore" || inWater) {
      // Fish
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x8fb6c9));
      body.scale.set(1.6, 0.7, 0.7); g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), mat(0x6f96a9));
      tail.rotation.z = Math.PI / 2; tail.position.x = -0.9; g.add(tail);
      label = "fish";
    } else if (diet === "carnivore") {
      // A carcass: a reddish hunk of meat with a clear white ribcage on top,
      // so it reads as prey/meat (kept abstract and PG — no gore).
      const meat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), mat(0x9c4a3a));
      meat.scale.set(1.2, 0.6, 0.9); meat.position.y = 0.35; g.add(meat);
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 6, 10, Math.PI), mat(0xece3cf));
        rib.position.set(0, 0.55, -0.35 + r * 0.25); g.add(rib);
      }
      label = "carcass";
    } else {
      // Plants (herbivore / omnivore / insectivore)
      for (let i = 0; i < 4; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), mat(0x3f8a3a));
        frond.position.set((Math.cos(i * 1.6)) * 0.4, 0.7, (Math.sin(i * 1.6)) * 0.4);
        frond.rotation.z = (i - 2) * 0.2; g.add(frond);
      }
      label = "plants";
    }
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    return { group: g, label };
  }

  /** Replace an eaten food with a small pile of bones (per the design notes). */
  turnToBones(food) {
    this.scene.remove(food.group);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe9e2cd, flatShading: true, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 2, 4), mat);
      bone.position.set((Math.cos(i) ) * 0.4, 0.12, (Math.sin(i * 2)) * 0.4);
      bone.rotation.set(Math.PI / 2, i, i * 0.7);
      g.add(bone);
    }
    g.position.set(food.x, 0.1, food.z);
    g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    this.scene.add(g);
    food.bones = g;
  }

  /* --- Fossils: collectible, reward scales, teach a fact --- */
  _scatterFossils() {
    for (let i = 0; i < 8; i++) {
      const spot = this._randomLandSpot(true);
      if (!spot || spot.x === null) continue;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xd9c7a0, flatShading: true, roughness: 1 });
      // A half-buried skull-ish shape + ribs
      const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat);
      skull.scale.set(1.1, 0.8, 1.4); skull.position.y = 0.3; g.add(skull);
      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 8, Math.PI), mat);
        rib.position.set(0, 0.25, -0.5 - r * 0.4); g.add(rib);
      }
      g.position.set(spot.x, 0, spot.z);
      g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
      this.scene.add(g);
      this.fossils.push({ group: g, x: spot.x, z: spot.z, taken: false });
    }
  }

  /* --- Helpers to find spots on land or in water --- */
  // Each call returns a DIFFERENT, well-spread spot. We use a "golden angle"
  // spiral (the pattern sunflowers use) so trees/food/fossils scatter evenly
  // instead of stacking on one point.
  _randomLandSpot(avoidProps = false) {
    for (let t = 0; t < 300; t++) {
      this._spotSeed++;
      const s = this._spotSeed;
      const a = s * 2.39996; // golden angle in radians
      const rad = 8 + ((s * 6.91) % (WORLD_RADIUS - 16));
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (this.isInWater(x, z)) continue;
      if (avoidProps && this._tooCloseToProp(x, z)) continue;
      return { x, z };
    }
    return { x: null, z: null };
  }
  _tooCloseToProp(x, z, min = 5) {
    for (const p of this.propSpots) {
      const dx = x - p.x, dz = z - p.z;
      if (dx * dx + dz * dz < min * min) return true;
    }
    return false;
  }
  _randomWaterSpot(tries = 20) {
    for (const w of this.waterMeshes) {
      for (let t = 0; t < tries; t++) {
        const a = t * 1.7, rad = (w.r * 0.6) * ((t % 5) / 5 + 0.2);
        const x = w.x + Math.cos(a) * rad, z = w.z + Math.sin(a) * rad;
        if (this.isInWater(x, z)) return { x, z };
      }
    }
    return null;
  }

  /** Is a point inside any water body? */
  isInWater(x, z) {
    for (const w of this.waterMeshes) {
      const dx = x - w.x, dz = z - w.z;
      if (dx * dx + dz * dz < w.r * w.r) return true;
    }
    return false;
  }

  /** Is a point near drinkable water's edge (for the drink action)? */
  nearWaterEdge(x, z, reach = 4) {
    for (const w of this.waterMeshes) {
      const dx = x - w.x, dz = z - w.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < w.r + reach && dist > w.r - reach * 2) return true;
      if (dist < w.r) return true; // already standing in it
    }
    return false;
  }

  /** Advance the day/night cycle and relight the scene. dt in seconds. */
  update(dt) {
    // A full day+night cycle takes this many seconds of play.
    this.timeOfDay = (this.timeOfDay + dt / 140) % 1;
    const t = this.timeOfDay;

    // Daytime fills most of the cycle; night is short. (0.9 = 90% day, 10% night)
    const DAY_FRACTION = 0.9;

    // "light" is 1 at bright noon and 0 in deep night. Daytime has a long bright
    // plateau (the *1.7 widens it); night is brief with quick dawn/dusk fades.
    let light, sunHeight, arc;
    if (t < DAY_FRACTION) {
      const u = t / DAY_FRACTION;        // 0..1 across the daytime
      light = Math.min(1, Math.sin(u * Math.PI) * 1.7);
      sunHeight = Math.sin(u * Math.PI); // sun arcs overhead during the day
      arc = Math.cos(u * Math.PI);       // east -> west
    } else {
      const u = (t - DAY_FRACTION) / (1 - DAY_FRACTION); // 0..1 across the night
      light = 0;
      sunHeight = -Math.sin(u * Math.PI); // sun stays below the horizon
      arc = -1;
    }

    // Move the sun and set brightness (daytime is nice and bright)
    this.sun.position.set(arc * 55, sunHeight * 60 + 8, 20);
    this.sun.intensity = 0.15 + light * 1.7;
    this.hemi.intensity = 0.40 + light * 1.1;

    // Tint the sky toward night when it's dark
    const sky = new THREE.Color(this.biome.sky);
    const night = new THREE.Color(0x0a1626);
    const mix = sky.clone().lerp(night, 1 - light);
    this.scene.background = mix;
    if (this.scene.fog) this.scene.fog.color.copy(mix);

    return { day: light, isNight: light < 0.22, timeOfDay: t };
  }

  dispose() {
    // Remove everything we added (called when leaving the game)
    while (this.scene.children.length) {
      const o = this.scene.children[0];
      this.scene.remove(o);
      o.traverse?.((m) => { m.geometry?.dispose?.(); m.material?.dispose?.(); });
    }
  }
}
