/* =====================================================================
   SOUND
   ---------------------------------------------------------------------
   Makes dinosaur calls and little action blips using the Web Audio API,
   so no sound files are needed. Each creature gets a different kind of
   call based on its size and diet (a big T. rex roars low; a small
   raptor chirps; a mosasaur makes a whale-like song).

   LATER: to use real recorded sounds, load an <audio> file here instead.
   ===================================================================== */

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  // Audio can only start after a user gesture (tap/click) — call this then.
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  _tone(freq, dur, type = "sine", vol = 0.2, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  /** A creature's signature call. Picks a style from its data. */
  call(species) {
    this.resume();
    if (!this.ctx) return;
    const big = species.length_m >= 9;
    const meat = species.diet === "carnivore" || species.diet === "piscivore";

    if (species.build === "swimmer") {
      // Whale-like song
      this._tone(280, 0.7, "sine", 0.18, 160);
      setTimeout(() => this._tone(200, 0.9, "sine", 0.16, 320), 300);
    } else if (meat && big) {
      // Deep roar
      this._tone(90, 1.1, "sawtooth", 0.22, 60);
      this._tone(140, 1.0, "square", 0.08, 70);
    } else if (meat) {
      // Sharp chirpy screech (small raptor)
      this._tone(620, 0.18, "sawtooth", 0.16, 880);
      setTimeout(() => this._tone(720, 0.16, "sawtooth", 0.14, 540), 150);
    } else if (big) {
      // Herbivore bellow / horn (Parasaurolophus-style)
      this._tone(150, 0.9, "sine", 0.2, 110);
      this._tone(225, 0.9, "triangle", 0.08, 165);
    } else {
      // Smaller herbivore honk
      this._tone(260, 0.4, "triangle", 0.18, 200);
    }
  }

  eat()    { this.resume(); this._tone(180, 0.12, "square", 0.14); setTimeout(() => this._tone(150, 0.1, "square", 0.12), 90); }
  drink()  { this.resume(); this._tone(420, 0.1, "sine", 0.12, 300); setTimeout(() => this._tone(360, 0.1, "sine", 0.1, 260), 90); }
  fossil() { this.resume(); this._tone(660, 0.12, "triangle", 0.16, 990); setTimeout(() => this._tone(990, 0.14, "triangle", 0.16, 1320), 110); }
  hurt()   { this.resume(); this._tone(120, 0.25, "sawtooth", 0.16, 70); }
  death()  { this.resume(); this._tone(200, 0.6, "sawtooth", 0.2, 60); }
}
