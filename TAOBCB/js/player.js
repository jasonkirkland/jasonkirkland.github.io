/* =====================================================================
   PLAYER
   ---------------------------------------------------------------------
   The dinosaur you control. Holds the survival stats, moves the model,
   animates walking/breathing/growing, and handles the eat / drink /
   collect-fossil actions. Returns "events" so the UI can show facts and
   the game can play sounds.
   ===================================================================== */

import * as THREE from "three";
import { buildCreature } from "./creature.js";
import { WORLD_RADIUS } from "./world.js";

export class Player {
  constructor(scene, world, species) {
    this.scene = scene;
    this.world = world;
    this.species = species;

    const built = buildCreature(species);
    this.model = built.group;
    this.parts = built.parts;
    scene.add(this.model);

    // Spawn at a sensible spot for this creature
    const spot = species.build === "swimmer"
      ? (world._randomWaterSpot() || { x: 0, z: 0 })
      : { x: 0, z: 6 };
    this.pos = new THREE.Vector3(spot.x, 0, spot.z);
    this.heading = Math.PI; // facing -Z to start

    // --- Survival stats (0..100) ---
    this.hunger = 80;
    this.thirst = 80;
    this.stamina = 100;
    this.health = 100;
    this.alive = true;
    this.deathReason = "";

    // --- Growth: start as a baby and grow up while you survive ---
    this.age = species.build === "swimmer" ? 0.6 : 0.0; // 0 = baby, 1 = adult
    this.isBaby = this.age < 0.5;

    // animation + environment timers
    this.walkPhase = 0;
    this.breathPhase = 0;
    this.outOfElement = 0; // seconds spent in the wrong environment
    this.factCooldown = 0;
    this.factIndex = 0;

    this._applyScale();
  }

  _applyScale() {
    // Babies are small; grow toward full size as age -> 1
    const grow = 0.45 + this.age * 0.55;
    this.model.scale.setScalar(grow);
    this.growScale = grow;
  }

  get speciesSpeed() {
    // Bigger animals lumber; small ones dart. Babies are a bit slower.
    const base = this.species.build === "swimmer" ? 9 : 7.5;
    const sizeFactor = 1 - Math.min(0.35, (this.species.length_m - 2) * 0.02);
    return base * sizeFactor * (this.isBaby ? 0.8 : 1);
  }

  /**
   * Advance one frame.
   * @param dt seconds since last frame
   * @param input { moveX, moveY, run } from keyboard/touch (screen space)
   * @param cameraYaw current camera yaw so movement is relative to the view
   * @returns array of event objects, e.g. { type:'eat', fact, label }
   */
  update(dt, input, cameraYaw) {
    const events = [];
    if (!this.alive) return events;

    this.factCooldown = Math.max(0, this.factCooldown - dt);

    // ---- Movement (relative to where the camera is looking) ----
    const mag = Math.hypot(input.moveX, input.moveY);
    let moving = false;
    let speed = 0;
    if (mag > 0.08) {
      moving = true;
      // Convert screen-space stick to a world direction using camera yaw.
      const ix = input.moveX / mag, iy = input.moveY / mag;
      // Screen up (iy negative) should be "forward, away from camera".
      const worldX = ix * Math.cos(cameraYaw) + (-iy) * Math.sin(cameraYaw);
      const worldZ = ix * Math.sin(cameraYaw) - (-iy) * Math.cos(cameraYaw);
      const dir = new THREE.Vector3(worldX, 0, worldZ).normalize();

      // Face the movement direction (smoothly)
      const targetHeading = Math.atan2(dir.x, dir.z);
      this.heading = lerpAngle(this.heading, targetHeading, Math.min(1, dt * 8));

      // Running uses stamina; if exhausted you can only walk
      const canRun = input.run && this.stamina > 1;
      speed = this.speciesSpeed * mag * (canRun ? 1.7 : 1);
      if (canRun) this.stamina = Math.max(0, this.stamina - dt * 14);

      const step = speed * dt;
      let nx = this.pos.x + dir.x * step;
      let nz = this.pos.z + dir.z * step;

      // Keep inside the world circle
      const rr = Math.hypot(nx, nz);
      if (rr > WORLD_RADIUS - 3) { nx *= (WORLD_RADIUS - 3) / rr; nz *= (WORLD_RADIUS - 3) / rr; }

      this.pos.x = nx; this.pos.z = nz;
    }

    // Regain stamina when not running
    if (!(input.run && moving)) this.stamina = Math.min(100, this.stamina + dt * 8);

    // ---- Stat decay (slower for babies — they nap and burn less) ----
    const metab = this.isBaby ? 0.7 : 1;
    this.hunger = Math.max(0, this.hunger - dt * 0.22 * metab - (moving ? dt * 0.1 : 0));
    this.thirst = Math.max(0, this.thirst - dt * 0.28 * metab - (moving ? dt * 0.08 : 0));

    // ---- Growth: grow up as long as you're reasonably fed and watered ----
    if (this.age < 1 && this.hunger > 25 && this.thirst > 25) {
      this.age = Math.min(1, this.age + dt / 90); // ~1.5 min to grow up if healthy
      this.isBaby = this.age < 0.5;
      this._applyScale();
    }

    // ---- Environment check (wrong habitat is dangerous) ----
    const inWater = this.world.isInWater(this.pos.x, this.pos.z);
    let envWarning = null;
    const swimmer = this.species.build === "swimmer";
    if (swimmer && !inWater) {
      this.outOfElement += dt;
      envWarning = "Get back to the water — you can't survive on land for long!";
    } else if (!swimmer && inWater && this.world.biome.deepWater && !this.species.waterBreath) {
      this.outOfElement += dt;
      envWarning = "You're in deep water and can't breathe — head to land!";
    } else {
      this.outOfElement = Math.max(0, this.outOfElement - dt * 1.5);
    }
    const envHurting = this.outOfElement > 4;

    // ---- Health logic ----
    let healthDrain = 0;
    let reason = "";
    if (this.hunger <= 0) { healthDrain += 3.5; reason = "starvation"; }
    if (this.thirst <= 0) { healthDrain += 3.5; reason = "thirst"; }
    if (envHurting) {
      healthDrain += 6;
      reason = swimmer ? "being out of the water too long" : "drowning";
    }
    if (healthDrain > 0) {
      this.health = Math.max(0, this.health - dt * healthDrain);
    } else if (this.hunger > 35 && this.thirst > 35) {
      // Recover slowly when well-fed and safe
      this.health = Math.min(100, this.health + dt * 2);
    }

    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.deathReason = reason || "exhaustion";
      events.push({ type: "death", reason: this.deathReason });
    }

    if (envWarning && envHurting) events.push({ type: "warn", text: envWarning });

    // ---- Animation ----
    this._animate(dt, moving, speed);

    // Push position to the model
    this.model.position.set(this.pos.x, swimmer ? 0.8 : 0, this.pos.z);
    this.model.rotation.y = this.heading;

    return events;
  }

  _animate(dt, moving, speed) {
    // Legs swing while walking
    this.walkPhase += dt * (moving ? 6 + speed * 0.4 : 0);
    this.parts.legs.forEach((leg, i) => {
      const off = (i % 2 === 0) ? 0 : Math.PI;
      leg.rotation.x = moving ? Math.sin(this.walkPhase + off) * 0.5 : 0;
    });

    // Gentle body bob while moving
    if (this.parts.body) {
      this.parts.body.position.y = (this.parts.body.userData.baseY ??= this.parts.body.position.y)
        + (moving ? Math.abs(Math.sin(this.walkPhase)) * 0.12 : 0);
    }

    // Breathing: belly slowly expands/contracts, most visible when standing still
    this.breathPhase += dt * (moving ? 1.5 : 0.9);
    if (this.parts.belly) {
      const b = 1 + Math.sin(this.breathPhase) * (moving ? 0.02 : 0.05);
      this.parts.belly.scale.set(b, b, 1);
    }

    // Tail sway
    if (this.parts.tail) {
      this.parts.tail.rotation.y = Math.sin(this.walkPhase * 0.5) * (moving ? 0.25 : 0.08);
    }
  }

  /**
   * Try to do the context action (eat / drink / collect).
   * @returns an event object describing what happened, or null.
   */
  tryAction() {
    if (!this.alive) return null;

    // 1) Eat nearby food
    const food = this._nearest(this.world.foods.filter((f) => !f.eaten), 4.5);
    if (food) {
      food.eaten = true;
      this.world.turnToBones(food);
      this.hunger = Math.min(100, this.hunger + 38);
      return { type: "eat", label: food.label, fact: this._nextFact() };
    }

    // 2) Drink at water's edge
    if (this.world.nearWaterEdge(this.pos.x, this.pos.z)) {
      this.thirst = Math.min(100, this.thirst + 45);
      return { type: "drink", fact: this._nextFact() };
    }

    // 3) Collect a fossil
    const fossil = this._nearest(this.world.fossils.filter((f) => !f.taken), 5);
    if (fossil) {
      fossil.taken = true;
      this.scene.remove(fossil.group);
      return { type: "fossil", scales: 3, fact: this._nextFact() };
    }

    return { type: "none" };
  }

  /** What action is available right now (for the on-screen prompt)? */
  availableAction() {
    if (this._nearest(this.world.foods.filter((f) => !f.eaten), 4.5)) return "eat";
    if (this.world.nearWaterEdge(this.pos.x, this.pos.z)) return "drink";
    if (this._nearest(this.world.fossils.filter((f) => !f.taken), 5)) return "fossil";
    return null;
  }

  _nearest(list, reach) {
    let best = null, bestD = reach * reach;
    for (const item of list) {
      const dx = item.x - this.pos.x, dz = item.z - this.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }

  _nextFact() {
    const facts = this.species.facts;
    const f = facts[this.factIndex % facts.length];
    this.factIndex++;
    return f;
  }

  dispose() {
    this.scene.remove(this.model);
  }
}

/* Smoothly rotate one angle toward another (handles wrap-around). */
function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
