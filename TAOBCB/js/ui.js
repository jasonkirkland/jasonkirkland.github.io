/* =====================================================================
   UI
   ---------------------------------------------------------------------
   All the screen/menu/HUD code lives here, kept separate from the 3D
   game so each part is easy to read. Handles:
     - the species-picker menu (and unlocking with scales)
     - saving scales + unlocked dinos between visits (localStorage)
     - the in-game bars, info chips, fact popups and prompts
     - the death screen
   ===================================================================== */

import { SPECIES } from "./dinos.js";

const SAVE_KEY = "taobcb_save_v1";

/* ---------- Saved progress (scales + unlocked species) ---------- */
export const Save = {
  data: { scales: 0, unlocked: [] },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = JSON.parse(raw);
    } catch (e) { /* storage blocked — just play without saving */ }
    // Free species are always unlocked
    for (const s of SPECIES) if (s.unlockCost === 0 && !this.data.unlocked.includes(s.id)) {
      this.data.unlocked.push(s.id);
    }
  },
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  get scales() { return this.data.scales; },
  addScales(n) { this.data.scales += n; this.save(); },
  isUnlocked(id) { return this.data.unlocked.includes(id); },
  unlock(id, cost) {
    if (this.data.scales < cost || this.isUnlocked(id)) return false;
    this.data.scales -= cost;
    this.data.unlocked.push(id);
    this.save();
    return true;
  },
};

/* ---------- Element shortcuts ---------- */
const $ = (id) => document.getElementById(id);

export const UI = {
  selectedId: null,
  onStart: null, // set by main.js

  initMenu() {
    Save.load();
    this._renderScaleCount();
    this._renderCards();
    $("startBtn").addEventListener("click", () => {
      if (this.selectedId && this.onStart) this.onStart(this.selectedId);
    });
  },

  _renderScaleCount() {
    $("menuScaleCount").textContent = Save.scales;
  },

  _renderCards() {
    const list = $("dinoList");
    list.innerHTML = "";
    for (const sp of SPECIES) {
      const unlocked = Save.isUnlocked(sp.id);
      const card = document.createElement("div");
      card.className = "dino-card" + (unlocked ? "" : " locked");
      card.innerHTML = `
        <div class="emoji">${sp.emoji}</div>
        <div class="name">${sp.name}</div>
        <div class="diet">${cap(sp.diet)}</div>
        ${unlocked ? "" : `<div class="lock">🔒 ${sp.unlockCost}🦎</div>`}
      `;
      card.addEventListener("click", () => this._clickCard(sp, card));
      list.appendChild(card);
    }
  },

  _clickCard(sp, card) {
    const unlocked = Save.isUnlocked(sp.id);
    if (!unlocked) {
      // Try to buy it with scales
      if (Save.unlock(sp.id, sp.unlockCost)) {
        this._renderScaleCount();
        this._renderCards();
        // Re-show this dino's details as now-selectable
        const newCard = [...document.querySelectorAll(".dino-card")].find(
          (c) => c.querySelector(".name").textContent === sp.name
        );
        this._select(sp, newCard);
      } else {
        this.showDetails(sp, false, true); // show "need more scales"
      }
      return;
    }
    this._select(sp, card);
  },

  _select(sp, card) {
    this.selectedId = sp.id;
    document.querySelectorAll(".dino-card").forEach((c) => c.classList.remove("selected"));
    if (card) card.classList.add("selected");
    this.showDetails(sp, true, false);
    const btn = $("startBtn");
    btn.disabled = false;
    btn.textContent = `Play as ${sp.name}`;
  },

  showDetails(sp, selectable, cantAfford) {
    const kindNote = sp.kind !== "dinosaur"
      ? `<span class="tag">⚠️ Not a dinosaur — a ${sp.kind}!</span>` : "";
    $("dinoDetails").innerHTML = `
      <h3>${sp.emoji} ${sp.name}</h3>
      <div class="tags">
        <span class="tag">${cap(sp.diet)}</span>
        <span class="tag">${cap(sp.biome)} habitat</span>
        <span class="tag">~${sp.length_m} m long</span>
        ${kindNote}
      </div>
      <div>${sp.period}</div>
      ${cantAfford ? `<div style="color:#f4c95d;margin-top:8px">You need ${sp.unlockCost} scales to unlock this one — explore and collect more!</div>` : ""}
      <ul>${sp.facts.slice(0, 2).map((f) => `<li>${f}</li>`).join("")}</ul>
    `;
  },

  showMenu() {
    Save.load();
    this._renderScaleCount();
    this._renderCards();
    this.selectedId = null;
    $("startBtn").disabled = true;
    $("startBtn").textContent = "Select a dinosaur";
    $("dinoDetails").innerHTML = "";
    $("menu").classList.remove("hidden");
    $("hud").classList.add("hidden");
    $("deathScreen").classList.add("hidden");
  },

  hideMenu() { $("menu").classList.add("hidden"); },

  /* ---------- In-game HUD ---------- */
  showHUD(species, isTouch) {
    $("hud").classList.remove("hidden");
    $("speciesChip").textContent = `${species.emoji} ${species.name}`;
    if (isTouch) $("touchControls").classList.remove("hidden");
  },

  setBars(p) {
    $("barHunger").style.width = p.hunger + "%";
    $("barThirst").style.width = p.thirst + "%";
    $("barStamina").style.width = p.stamina + "%";
    $("barHealth").style.width = p.health + "%";
  },

  setChips({ scales, isNight, isBaby }) {
    $("scaleChip").textContent = `🦎 ${scales}`;
    $("clockChip").textContent = isNight ? "🌙 Night" : "☀️ Day";
    $("ageChip").textContent = isBaby ? "🥚 Baby" : "🦴 Adult";
  },

  _factTimer: null,
  showFact(title, text) {
    const el = $("factPopup");
    el.innerHTML = `<div class="fp-title">${title}</div><div>${text}</div>`;
    el.classList.remove("hidden", "fade");
    clearTimeout(this._factTimer);
    this._factTimer = setTimeout(() => {
      el.classList.add("fade");
      setTimeout(() => el.classList.add("hidden"), 400);
    }, 5200);
  },

  showPrompt(text) {
    const el = $("prompt");
    el.textContent = text;
    el.classList.remove("hidden");
  },
  hidePrompt() { $("prompt").classList.add("hidden"); },

  showDeath(reason, species, learned) {
    $("hud").classList.add("hidden");
    $("touchControls").classList.add("hidden");
    $("deathReason").textContent = `Cause: ${reason}.`;
    $("deathLearned").innerHTML =
      `While you lived as <b>${species.name}</b>, you learned:<br>“${learned}”`;
    $("deathScreen").classList.remove("hidden");
  },
};

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
