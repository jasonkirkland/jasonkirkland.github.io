/* =====================================================================
   CREATURE BUILDER
   ---------------------------------------------------------------------
   Builds a low-poly 3D dinosaur out of simple shapes (boxes, spheres,
   cones). It returns the model plus references to the moving parts so
   the game can animate walking, breathing and tail-swishing.

   LATER: to use a real downloaded 3D model (a .glb file), you would load
   it with GLTFLoader instead of building shapes here, and keep returning
   the same { group, parts } shape so the rest of the game still works.
   ===================================================================== */

import * as THREE from "three";

function box(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 })
  );
}
function sphere(r, color) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 1), // low-poly ball
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 })
  );
}
function cone(r, h, color) {
  return new THREE.Mesh(
    new THREE.ConeGeometry(r, h, 5),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 })
  );
}

// Add two eyes (white eyeball + dark pupil) to a box-shaped head.
// They're attached to the head so they turn and bob with it.
function addEyes(head, opts = {}) {
  const p = head.geometry.parameters; // BoxGeometry gives width/height/depth
  const w = p.width, h = p.height, d = p.depth;
  const r = Math.min(w, h) * (opts.size || 0.2);
  const forward = opts.forward ?? 0.3;  // how far toward the snout (0..0.5 of depth)
  const up = opts.up ?? 0.18;           // how high on the head
  const white = new THREE.MeshStandardMaterial({ color: 0xf7f3e6, flatShading: true, roughness: 0.5 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x140f0a, roughness: 0.3 });
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), white);
    eye.position.set(side * w * 0.5, h * up, d * forward);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 8, 8), pupil);
    iris.position.set(side * r * 0.45, 0, r * 0.7); // look outward + forward
    eye.add(iris);
    head.add(eye);
  }
}

/**
 * Build a creature model.
 * @returns { group, parts } where parts = { body, head, tail, legs[], belly }
 */
export function buildCreature(species) {
  const c = species.colors;
  const group = new THREE.Group();
  const parts = { legs: [], head: null, tail: null, body: null, belly: null };

  // Overall scale so a 9 m animal and a 2 m animal look proportionally right.
  // We keep models a friendly on-screen size; world distances scale to match.
  const s = species.length_m / 9; // 1.0 for a 9 m animal

  if (species.build === "swimmer") {
    buildSwimmer(group, parts, c, s, species);
  } else if (species.build === "biped") {
    buildBiped(group, parts, c, s, species);
  } else {
    buildQuadruped(group, parts, c, s, species);
  }

  group.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  group.scale.setScalar(1); // model already scaled by part sizes
  return { group, parts };
}

/* ---------------- Quadruped (Triceratops, Stegosaurus, etc.) ---------------- */
function buildQuadruped(group, parts, c, s, sp) {
  const bodyLen = 3.2 * s, bodyH = 1.3 * s, bodyW = 1.6 * s;
  const body = box(bodyW, bodyH, bodyLen, c.body);
  body.position.y = 1.6 * s;
  group.add(body); parts.body = body;

  // Belly piece that "breathes" (scales) when idle
  const belly = box(bodyW * 0.95, bodyH * 0.55, bodyLen * 0.9, c.belly);
  belly.position.set(0, 1.35 * s, 0);
  group.add(belly); parts.belly = belly;

  // Neck + head at the front (+Z is forward)
  const neck = box(bodyW * 0.7, bodyH * 0.7, 1.0 * s, c.body);
  neck.position.set(0, 1.9 * s, bodyLen * 0.5 + 0.3 * s);
  neck.rotation.x = -0.25;
  group.add(neck);

  const head = box(bodyW * 0.8, bodyH * 0.7, 1.2 * s, c.body);
  head.position.set(0, 2.15 * s, bodyLen * 0.5 + 1.1 * s);
  group.add(head); parts.head = head;
  addEyes(head, { forward: 0.3, up: 0.22 });

  // Beak
  const beak = cone(0.35 * s, 0.7 * s, c.accent);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.05 * s, bodyLen * 0.5 + 1.8 * s);
  head.add(beak); beak.position.sub(head.position);

  // Frill (Triceratops) — a fan behind the head
  if (sp.features.frill) {
    const frill = box(bodyW * 1.8, bodyH * 1.6, 0.25 * s, c.accent);
    frill.position.set(0, 2.4 * s, bodyLen * 0.5 + 0.5 * s);
    group.add(frill);
    // three horns
    for (const [x, y, len] of [[0, 2.4, 1.0], [-0.55, 2.2, 0.8], [0.55, 2.2, 0.8]]) {
      const horn = cone(0.16 * s, len * s, 0xf2ead6);
      horn.rotation.x = Math.PI / 2.4;
      horn.position.set(x * s, y * s, bodyLen * 0.5 + 1.6 * s);
      group.add(horn);
    }
  }

  // Back plates (Stegosaurus)
  if (sp.features.armorPlates) {
    for (let i = 0; i < 6; i++) {
      const plate = cone(0.5 * s, 1.1 * s, c.accent);
      plate.position.set(0, 2.5 * s, (i - 2.5) * 0.5 * s);
      group.add(plate);
    }
    // tail spikes added with the tail below
  }

  // Crest (Parasaurolophus) — long tube off the back of the head
  if (sp.features.crest) {
    const crest = box(0.3 * s, 0.3 * s, 1.6 * s, c.accent);
    crest.rotation.x = 0.7;
    crest.position.set(0, 2.7 * s, bodyLen * 0.5 + 0.4 * s);
    group.add(crest);
  }

  // Tail
  const tail = box(bodyW * 0.5, bodyH * 0.5, 2.4 * s, c.body);
  tail.position.set(0, 1.55 * s, -bodyLen * 0.5 - 1.0 * s);
  group.add(tail); parts.tail = tail;
  if (sp.features.armorPlates) {
    for (const dx of [-0.3, 0.3]) {
      const spike = cone(0.12 * s, 0.9 * s, 0xf2ead6);
      spike.rotation.z = Math.PI / 2;
      spike.position.set(dx * s, 1.7 * s, -bodyLen * 0.5 - 2.0 * s);
      group.add(spike);
    }
  }

  // Four legs
  const legY = 0.75 * s;
  const legPositions = [
    [bodyW * 0.45, bodyLen * 0.35],
    [-bodyW * 0.45, bodyLen * 0.35],
    [bodyW * 0.45, -bodyLen * 0.35],
    [-bodyW * 0.45, -bodyLen * 0.35],
  ];
  for (const [x, z] of legPositions) {
    const leg = box(0.5 * s, 1.5 * s, 0.5 * s, c.accent);
    leg.position.set(x, legY, z);
    group.add(leg);
    parts.legs.push(leg);
  }
}

/* ---------------- Biped (Velociraptor, T. rex, Spinosaurus) ---------------- */
function buildBiped(group, parts, c, s, sp) {
  const bodyLen = 2.6 * s, bodyH = 1.4 * s, bodyW = 1.2 * s;
  const body = box(bodyW, bodyH, bodyLen, c.body);
  body.position.y = 2.4 * s;
  body.rotation.x = 0.15; // lean forward, tail-balanced posture
  group.add(body); parts.body = body;

  const belly = box(bodyW * 0.9, bodyH * 0.6, bodyLen * 0.85, c.belly);
  belly.position.set(0, 2.2 * s, 0.1 * s);
  group.add(belly); parts.belly = belly;

  // Neck + head
  const neck = box(bodyW * 0.6, 0.9 * s, 0.8 * s, c.body);
  neck.position.set(0, 3.1 * s, bodyLen * 0.45);
  group.add(neck);

  const head = box(bodyW * 0.7, 0.8 * s, 1.4 * s, c.body);
  head.position.set(0, 3.4 * s, bodyLen * 0.45 + 0.9 * s);
  group.add(head); parts.head = head;
  addEyes(head, { forward: 0.3, up: 0.28 }); // T. rex / raptor / Spinosaurus eyes

  // Jaw
  const jaw = box(bodyW * 0.6, 0.3 * s, 1.2 * s, c.accent);
  jaw.position.set(0, 3.15 * s, bodyLen * 0.45 + 0.95 * s);
  group.add(jaw);

  // Spinosaurus sail
  if (sp.features.sailBack) {
    for (let i = 0; i < 7; i++) {
      const h = (1.6 - Math.abs(i - 3) * 0.25) * s;
      const fin = box(0.18 * s, h, 0.5 * s, c.accent);
      fin.position.set(0, 3.0 * s + h * 0.4, (i - 3) * 0.45 * s);
      group.add(fin);
    }
  }

  // Tail (long, for balance)
  const tail = box(bodyW * 0.55, 0.7 * s, 3.4 * s, c.body);
  tail.position.set(0, 2.0 * s, -bodyLen * 0.5 - 1.4 * s);
  tail.rotation.x = -0.18;
  group.add(tail); parts.tail = tail;

  // Two big legs
  const legPositions = [[bodyW * 0.4, -0.1 * s], [-bodyW * 0.4, -0.1 * s]];
  for (const [x, z] of legPositions) {
    const thigh = box(0.6 * s, 1.6 * s, 0.7 * s, c.accent);
    thigh.position.set(x, 1.4 * s, z);
    group.add(thigh);
    parts.legs.push(thigh);
  }
  // Tiny arms
  for (const x of [bodyW * 0.5, -bodyW * 0.5]) {
    const arm = box(0.25 * s, 0.7 * s, 0.25 * s, c.accent);
    arm.position.set(x, 2.3 * s, bodyLen * 0.35);
    group.add(arm);
  }
}

/* ---------------- Swimmer (Mosasaurus) ---------------- */
function buildSwimmer(group, parts, c, s, sp) {
  const bodyLen = 5.0 * s;
  const body = box(1.3 * s, 1.3 * s, bodyLen, c.body);
  group.add(body); parts.body = body;

  const belly = box(1.1 * s, 0.7 * s, bodyLen * 0.9, c.belly);
  belly.position.y = -0.25 * s;
  group.add(belly); parts.belly = belly;

  // Head with long jaws
  const head = box(1.1 * s, 1.0 * s, 1.8 * s, c.body);
  head.position.set(0, 0.1 * s, bodyLen * 0.5 + 0.8 * s);
  group.add(head); parts.head = head;
  addEyes(head, { forward: 0.25, up: 0.25 });
  const snout = cone(0.5 * s, 1.4 * s, c.accent);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0, bodyLen * 0.5 + 2.0 * s);
  group.add(snout);

  // Tail with fish-like fin
  const tail = box(0.8 * s, 0.8 * s, 2.6 * s, c.body);
  tail.position.set(0, 0, -bodyLen * 0.5 - 1.2 * s);
  group.add(tail); parts.tail = tail;
  const fin = box(0.12 * s, 2.0 * s, 0.9 * s, c.accent);
  fin.position.set(0, 0, -bodyLen * 0.5 - 2.4 * s);
  group.add(fin);

  // Four flippers (used as "legs" for the swim animation)
  for (const [x, z] of [[0.9, 1.2], [-0.9, 1.2], [0.8, -1.0], [-0.8, -1.0]]) {
    const flip = box(1.3 * s, 0.2 * s, 0.7 * s, c.accent);
    flip.position.set(x * s, -0.3 * s, z * s);
    group.add(flip);
    parts.legs.push(flip);
  }
}
