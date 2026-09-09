export type StateHandler = {
  enter?: () => void;
  exit?: () => void;
  update?: (dt: number) => void;
  can?: (next: string) => boolean;
};

export class StateMachine {
  current = "idle";
  locked = false;
  private states = new Map<string, StateHandler>();
  private lockedUntil = 0;

  add(name: string, handler: StateHandler) {
    this.states.set(name, handler);
    return this;
  }

  set(next: string, now = performance.now()) {
    if (next === this.current) return false;
    if (this.locked && now < this.lockedUntil) return false;
    const cur = this.states.get(this.current);
    if (cur?.can && !cur.can(next)) return false;
    cur?.exit?.();
    this.current = next;
    this.locked = false;
    this.states.get(next)?.enter?.();
    return true;
  }

  lock(ms: number, now = performance.now()) {
    this.locked = true;
    this.lockedUntil = now + ms;
  }

  unlock() {
    this.locked = false;
    this.lockedUntil = 0;
  }

  is(...names: string[]) {
    return names.includes(this.current);
  }

  update(dt: number) {
    this.states.get(this.current)?.update?.(dt);
  }
}
