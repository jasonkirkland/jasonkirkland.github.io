/* =====================================================================
   MAIN
   ---------------------------------------------------------------------
   The conductor. Sets up the 3D renderer and camera, switches between
   the MENU and PLAY states, and runs the per-frame game loop:
     read input -> update player -> update world (day/night) -> follow
     camera -> refresh HUD -> render.
   ===================================================================== */

import * as THREE from "three";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Input } from "./input.js";
import { Sound } from "./sound.js";
import { UI, Save } from "./ui.js";
import { getSpecies } from "./dinos.js";

// ---- Renderer ----
const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

const input = new Input();
const sound = new Sound();

let state = "menu";        // "menu" | "play"
let world = null;
let player = null;
let species = null;
let camYaw = 0;            // smoothed camera yaw that follows the dino
let nightVisionOn = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/* ---------------- State: start a game ---------------- */
function startGame(speciesId) {
  species = getSpecies(speciesId);
  if (!species) return;

  // Clean up any previous game
  if (world) world.dispose();
  if (player) player.dispose();

  world = new World(scene, species);
  player = new Player(scene, world, species);

  // Point the camera behind the dino to begin
  camYaw = player.heading;
  input.cameraYaw = player.heading;

  UI.hideMenu();
  UI.showHUD(species, input.isTouch);
  sound.resume();
  sound.call(species); // greet the player with this dino's call

  state = "play";
}
UI.onStart = startGame;

// Action button / key -> do the contextual action
input.onAction = () => {
  if (state !== "play" || !player) return;
  const ev = player.tryAction();
  handleEvent(ev);
};

/* ---------------- Handle player events ---------------- */
function handleEvent(ev) {
  if (!ev) return;
  switch (ev.type) {
    case "eat":
      sound.eat();
      UI.showFact(eatTitle(ev.label), ev.fact);
      break;
    case "drink":
      sound.drink();
      UI.showFact("💧 You drank some water", ev.fact);
      break;
    case "fossil":
      sound.fossil();
      Save.addScales(ev.scales);
      UI.showFact(`🦴 Fossil found! +${ev.scales} scales`, ev.fact);
      break;
    case "warn":
      UI.showFact("⚠️ Wrong habitat!", ev.text);
      sound.hurt();
      break;
    case "death":
      sound.death();
      onDeath(ev.reason);
      break;
    case "none":
    default:
      break;
  }
}

// The eat message matches what the creature actually ate.
function eatTitle(label) {
  if (label === "carcass") return "🍖 You ate some meat — it leaves behind bones";
  if (label === "fish") return "🐟 You caught a fish";
  return "🍃 You grazed on plants";
}

function onDeath(reason) {
  state = "dying";
  const reasonText = {
    starvation: "you ran out of food",
    thirst: "you ran out of water",
    drowning: "you stayed in deep water too long",
    "being out of the water too long": "you were out of the water too long",
    exhaustion: "your health gave out",
  }[reason] || reason;
  const learned = species.facts[(player.factIndex) % species.facts.length];
  setTimeout(() => UI.showDeath(reasonText, species, learned), 900);
}

document.getElementById("backToMenuBtn").addEventListener("click", () => {
  if (world) { world.dispose(); world = null; }
  if (player) { player.dispose(); player = null; }
  state = "menu";
  UI.showMenu();
});

/* ---------------- Camera follow ---------------- */
function updateCamera(dt) {
  // Smoothly rotate the camera yaw toward the input yaw
  camYaw = input.cameraYaw;

  const p = player.pos;
  const back = 14 * player.growScale + 6;      // distance behind
  const height = 8 * player.growScale + 3;     // height above

  const camX = p.x - Math.sin(camYaw) * back;
  const camZ = p.z - Math.cos(camYaw) * back;
  const target = new THREE.Vector3(camX, height, camZ);

  // Ease the camera toward the target so it feels smooth
  camera.position.lerp(target, Math.min(1, dt * 5));
  camera.lookAt(p.x, 1.5 * player.growScale + 1, p.z);
}

/* ---------------- Main loop ---------------- */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); // clamp big gaps (tab switches)
  last = now;

  if (state === "play" || state === "dying") {
    input.update();

    const moveInput = { moveX: input.move.x, moveY: input.move.y, run: input.run };
    const events = player.update(dt, moveInput, camYaw);
    for (const ev of events) handleEvent(ev);

    const cycle = world.update(dt);

    // Night vision: brighten the world a touch at night so you can still see
    if (cycle.isNight && !nightVisionOn) { world.hemi.intensity += 0.45; nightVisionOn = true; }
    if (!cycle.isNight && nightVisionOn) { nightVisionOn = false; }

    updateCamera(dt);

    // HUD
    UI.setBars(player);
    UI.setChips({ scales: Save.scales, isNight: cycle.isNight, isBaby: player.isBaby });

    // Context prompt for the action button
    const act = player.availableAction();
    if (state === "play" && act) {
      const label = { eat: "to eat", drink: "to drink", fossil: "to dig up the fossil" }[act];
      UI.showPrompt(input.isTouch ? `Tap “Act” ${label}` : `Press E / Space ${label}`);
    } else {
      UI.hidePrompt();
    }
  }

  renderer.render(scene, camera);
}

/* ---------------- Boot ---------------- */
UI.initMenu();
requestAnimationFrame(loop);
