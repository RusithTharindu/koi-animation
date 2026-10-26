import { pondConfig } from "@/config/pond.config";
import { usePondStore } from "@/store/pondStore";
import type { PointerHandlers, PointerSample } from "./InputController";

export interface ModeServices {
  /** Adds a ripple; strength is pre-scaled by the user's ripple strength. */
  ripple: (x: number, y: number, radius: number, strength: number) => void;
}

/** Turns pointer input into pond effects according to the active cursor mode. */
export class ModeController implements PointerHandlers {
  constructor(private readonly services: ModeServices) {}

  onDown = (p: PointerSample) => {
    const { mode } = usePondStore.getState();
    const w = pondConfig.water;
    if (mode === "ripple") {
      this.services.ripple(p.x, p.y, w.clickRadius, -w.clickStrength);
    }
  };

  onMove = (p: PointerSample) => {
    void p;
  };

  onUp = (p: PointerSample) => {
    void p;
  };
}
