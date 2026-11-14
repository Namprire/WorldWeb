/**
 * Adapted from `blendi/oil-paint` (`src/figure/input.js`, CC0 1.0, Patch)
 * + GTA V action bindings (`V` camera view, `F` enter/exit vehicle, `C` / Right-Click strafe, `Q`/`E` orbit).
 */
export interface FrameInputState {
  move: { x: number; y: number };
  walk: boolean;
  sprint: boolean;
  strafe: boolean;
  jump: boolean;
  interactVehicle: boolean;
  toggleView: boolean;
  brake: boolean;
  look: { x: number; y: number };
  zoom: number;
  device: 'keyboard' | 'pad';
}

export class Input {
  el: HTMLElement;
  pads: boolean;
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: 0, y: 0, wheel: 0, right: false, leftDrag: false };
  walkToggle = false;
  pad = { a: false, y: false, select: false, l3: false, sprint: false };
  sensitivity = 0.0023;
  lockable = true;

  private cleanupFns: (() => void)[] = [];

  constructor(el: HTMLElement, { pads = true } = {}) {
    this.el = el;
    this.pads = pads;

    const isTyping = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'AltLeft', 'AltRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'CapsLock') this.walkToggle = !this.walkToggle;
      if (e.code === 'KeyL') {
        if (document.pointerLockElement === el) {
          document.exitPointerLock?.();
        } else {
          el.requestPointerLock?.()?.catch?.(() => {});
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onBlur = () => {
      this.keys.clear();
      this.mouse.right = false;
      this.mouse.leftDrag = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) this.mouse.right = true;
      if (e.button === 0) this.mouse.leftDrag = true;
    };

    const onDblClick = () => {
      if (this.lockable && document.pointerLockElement !== el) {
        el.requestPointerLock?.()?.catch?.(() => {});
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) this.mouse.right = false;
      if (e.button === 0) this.mouse.leftDrag = false;
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onMouseMove = (e: MouseEvent) => {
      if (
        document.pointerLockElement === el ||
        this.mouse.right ||
        this.mouse.leftDrag
      ) {
        this.mouse.x += e.movementX;
        this.mouse.y += e.movementY;
      }
    };

    const onWheel = (e: WheelEvent) => {
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('dblclick', onDblClick);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('wheel', onWheel, { passive: false });

    this.cleanupFns.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('wheel', onWheel);
    });
  }

  dispose(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns.length = 0;
  }

  read(dt: number): FrameInputState {
    const k = this.keys;
    let x =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y =
      (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) -
      (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    // Keyboard camera orbit fallback (`Q` / `E`)
    const keyOrbit = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);

    const s: FrameInputState = {
      move: { x, y },
      walk: this.walkToggle !== (k.has('AltLeft') || k.has('AltRight')),
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      strafe:
        (this.mouse.right && document.pointerLockElement === this.el) || k.has('KeyC'),
      jump: this.pressed.has('Space'),
      interactVehicle: this.pressed.has('KeyF'),
      toggleView: this.pressed.has('KeyV'),
      brake: k.has('Space'),
      look: {
        x: this.mouse.x * this.sensitivity + keyOrbit * 1.9 * dt,
        y: this.mouse.y * this.sensitivity,
      },
      zoom: this.mouse.wheel,
      device: 'keyboard',
    };

    this.mouse.x = 0;
    this.mouse.y = 0;
    this.mouse.wheel = 0;
    this.pressed.clear();

    // Radial deadzone gamepad support (`input-systems` + `oil-paint`)
    const pad = this.pads
      ? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected)
      : null;
    if (pad) {
      const radialDeadzone = (ax: number, ay: number, dz = 0.16): [number, number, number] => {
        const mag = Math.hypot(ax, ay);
        if (mag <= dz) return [0, 0, 0];
        const scaled = Math.min(1, (mag - dz) / (1 - dz));
        return [(ax / mag) * scaled, (ay / mag) * scaled, scaled];
      };

      const [px, py, pl] = radialDeadzone(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0));
      const [rx, ry] = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const btn = (i: number) => !!pad.buttons[i]?.pressed;

      if (pl > 0.01) {
        s.move = { x: px, y: py };
        s.device = 'pad';
        s.walk = false;
      }
      s.look.x += rx * Math.abs(rx) * 3.2 * dt;
      s.look.y += ry * Math.abs(ry) * 2.2 * dt;

      if (btn(10) && !this.pad.l3) this.pad.sprint = !this.pad.sprint;
      if (pl < 0.2) this.pad.sprint = false;
      if (this.pad.sprint || btn(5)) s.sprint = true;
      if (btn(0) && !this.pad.a) s.jump = true;
      if (btn(0)) s.brake = true;
      if (btn(3) && !this.pad.y) s.interactVehicle = true; // Y / Triangle enters GTA car!
      if (btn(8) && !this.pad.select) s.toggleView = true; // Select / View toggles camera!
      if ((pad.buttons[6]?.value ?? 0) > 0.4) s.strafe = true;
      if (btn(12)) s.zoom -= 4 * dt;
      if (btn(13)) s.zoom += 4 * dt;

      this.pad.a = btn(0);
      this.pad.y = btn(3);
      this.pad.select = btn(8);
      this.pad.l3 = btn(10);
      if (rx || ry || pl > 0.01 || btn(0) || btn(3)) s.device = 'pad';
    }

    return s;
  }
}
