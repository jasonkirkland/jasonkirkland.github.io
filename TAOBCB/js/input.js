/* =====================================================================
   INPUT
   ---------------------------------------------------------------------
   One small class that reports, every frame:
     move : { x, y }   movement stick (-1..1), screen space (y up = forward)
     run  : boolean
     cameraYaw : current camera angle (radians), spun by dragging
   Plus an onAction() callback for the eat/drink/collect button.

   Works with: keyboard (WASD + Shift + Space/E + arrow keys to turn),
   and touch (on-screen joystick, Run + Act buttons, drag to turn camera).
   ===================================================================== */

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.cameraYaw = 0;
    this.onAction = () => {};

    this.keys = new Set();
    this._joyActive = false;
    this._joyId = null;
    this._dragId = null;
    this._lastDragX = 0;

    this.isTouch = window.matchMedia("(hover: none)").matches || "ontouchstart" in window;

    this._bindKeyboard();
    this._bindTouch();
  }

  /* ---------------- Keyboard ---------------- */
  _bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space" || e.code === "KeyE") { this.onAction(); e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    // Lose focus -> clear keys so the dino doesn't run off forever
    window.addEventListener("blur", () => this.keys.clear());
  }

  _readKeyboard() {
    if (this.isTouch) return;
    let x = 0, y = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyA")) x -= 1;
    if (this.keys.has("KeyD")) x += 1;
    this.move.x = x; this.move.y = y;
    this.run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    // Turn the camera with Q/E... but E is "act"; use , and . or arrow Left/Right
    if (this.keys.has("ArrowLeft")) this.cameraYaw -= 0.03;
    if (this.keys.has("ArrowRight")) this.cameraYaw += 0.03;
    if (this.keys.has("KeyQ")) this.cameraYaw -= 0.03;
    if (this.keys.has("KeyR")) this.cameraYaw += 0.03;
  }

  /* ---------------- Touch ---------------- */
  _bindTouch() {
    const joy = document.getElementById("joystick");
    const knob = document.getElementById("joyKnob");
    const btnRun = document.getElementById("btnRun");
    const btnAct = document.getElementById("btnAction");
    if (!joy) return;

    const radius = 50; // px the knob can travel

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    joy.addEventListener("pointerdown", (e) => {
      this._joyActive = true; this._joyId = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      this._joyCenter = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    joy.addEventListener("pointermove", (e) => {
      if (!this._joyActive || e.pointerId !== this._joyId) return;
      let dx = e.clientX - this._joyCenter.x;
      let dy = e.clientY - this._joyCenter.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      setKnob(dx, dy);
      this.move.x = dx / radius;
      this.move.y = dy / radius;
    });
    const endJoy = (e) => {
      if (e.pointerId !== this._joyId) return;
      this._joyActive = false; this._joyId = null;
      this.move.x = 0; this.move.y = 0; setKnob(0, 0);
    };
    joy.addEventListener("pointerup", endJoy);
    joy.addEventListener("pointercancel", endJoy);

    // Run button: hold to run
    if (btnRun) {
      btnRun.addEventListener("pointerdown", (e) => { this.run = true; e.preventDefault(); });
      const stop = () => { this.run = false; };
      btnRun.addEventListener("pointerup", stop);
      btnRun.addEventListener("pointercancel", stop);
      btnRun.addEventListener("pointerleave", stop);
    }
    // Act button
    if (btnAct) {
      btnAct.addEventListener("pointerdown", (e) => { this.onAction(); e.preventDefault(); });
    }

    // Drag anywhere on the right side of the screen to turn the camera
    const canvasArea = document.getElementById("touchControls");
    window.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#joystick, .action-buttons, .screen, button")) return;
      if (e.clientX < window.innerWidth * 0.4) return; // left side is for the joystick
      this._dragId = e.pointerId; this._lastDragX = e.clientX;
    });
    window.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this._dragId) return;
      const dx = e.clientX - this._lastDragX;
      this._lastDragX = e.clientX;
      this.cameraYaw += dx * 0.006;
    });
    const endDrag = (e) => { if (e.pointerId === this._dragId) this._dragId = null; };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    // Mouse drag on desktop to turn the camera too
    if (!this.isTouch) {
      let down = false;
      const canvas = document.getElementById("game");
      canvas.addEventListener("pointerdown", (e) => { down = true; this._lastDragX = e.clientX; });
      window.addEventListener("pointerup", () => { down = false; });
      window.addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - this._lastDragX;
        this._lastDragX = e.clientX;
        this.cameraYaw += dx * 0.005;
      });
    }
  }

  /** Call once per frame to refresh keyboard-derived state. */
  update() {
    this._readKeyboard();
  }
}
