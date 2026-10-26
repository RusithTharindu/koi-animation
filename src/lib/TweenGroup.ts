import gsap from "gsap";

/**
 * A GSAP context whose animations pause and resume together with the pond
 * and are all killed on dispose.
 */
export class TweenGroup {
  private readonly ctx = gsap.context(() => {});
  private paused = false;

  add<T extends gsap.core.Animation>(create: () => T): T {
    let anim!: T;
    this.ctx.add(() => {
      anim = create();
      if (this.paused) anim.pause();
    });
    return anim;
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    for (const t of this.ctx.getTweens()) {
      if (paused) t.pause();
      else t.resume();
    }
  }

  kill() {
    this.ctx.kill();
  }
}
