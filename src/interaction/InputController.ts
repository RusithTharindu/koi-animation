export interface PointerSample {
  id: number;
  type: string;
  /** Current position in world units. */
  x: number;
  y: number;
  /** Position at the previous event. */
  prevX: number;
  prevY: number;
  /** Smoothed velocity in world units / second. */
  vx: number;
  vy: number;
  down: boolean;
  lastTime: number;
}

export interface PointerHandlers {
  onDown: (p: PointerSample) => void;
  onMove: (p: PointerSample) => void;
  onUp: (p: PointerSample) => void;
}

/**
 * Normalises mouse, pen and multi-touch input into world-space pointer samples.
 * Every active pointer is tracked independently, so several fingers can
 * create ripples at once.
 */
export class InputController {
  readonly pointers = new Map<number, PointerSample>();
  private readonly listeners: Array<[string, EventListener]> = [];

  constructor(
    private readonly el: HTMLElement,
    private readonly toWorld: (clientX: number, clientY: number, out: { x: number; y: number }) => void,
    private readonly handlers: PointerHandlers,
  ) {
    el.style.touchAction = "none";
    this.listen("pointerdown", this.handleDown as EventListener);
    this.listen("pointermove", this.handleMove as EventListener);
    this.listen("pointerup", this.handleUp as EventListener);
    this.listen("pointercancel", this.handleUp as EventListener);
    this.listen("pointerleave", this.handleLeave as EventListener);
    this.listen("contextmenu", ((e: Event) => e.preventDefault()) as EventListener);
  }

  /** Pointers that are hovering (mouse) or pressed. */
  forEach(cb: (p: PointerSample) => void) {
    this.pointers.forEach(cb);
  }

  dispose() {
    for (const [type, fn] of this.listeners) this.el.removeEventListener(type, fn);
    this.listeners.length = 0;
    this.pointers.clear();
  }

  private listen(type: string, fn: EventListener) {
    this.el.addEventListener(type, fn, { passive: false });
    this.listeners.push([type, fn]);
  }

  private readonly tmp = { x: 0, y: 0 };

  private sample(e: PointerEvent): PointerSample {
    this.toWorld(e.clientX, e.clientY, this.tmp);
    let p = this.pointers.get(e.pointerId);
    if (!p) {
      p = {
        id: e.pointerId,
        type: e.pointerType,
        x: this.tmp.x,
        y: this.tmp.y,
        prevX: this.tmp.x,
        prevY: this.tmp.y,
        vx: 0,
        vy: 0,
        down: false,
        lastTime: e.timeStamp,
      };
      this.pointers.set(e.pointerId, p);
      return p;
    }
    const dt = Math.max((e.timeStamp - p.lastTime) / 1000, 1 / 240);
    p.prevX = p.x;
    p.prevY = p.y;
    p.x = this.tmp.x;
    p.y = this.tmp.y;
    const k = Math.min(dt * 18, 1);
    p.vx += ((p.x - p.prevX) / dt - p.vx) * k;
    p.vy += ((p.y - p.prevY) / dt - p.vy) * k;
    p.lastTime = e.timeStamp;
    return p;
  }

  private handleDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.sample(e);
    p.prevX = p.x;
    p.prevY = p.y;
    p.vx = 0;
    p.vy = 0;
    p.down = true;
    this.handlers.onDown(p);
  };

  private handleMove = (e: PointerEvent) => {
    // Touch pointers only exist while pressed.
    if (e.pointerType !== "mouse" && !this.pointers.has(e.pointerId)) return;
    const p = this.sample(e);
    this.handlers.onMove(p);
  };

  private handleUp = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.down = false;
    this.handlers.onUp(p);
    if (e.pointerType !== "mouse" || e.type === "pointercancel") this.pointers.delete(e.pointerId);
  };

  private handleLeave = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.down) return;
    this.pointers.delete(e.pointerId);
  };
}
