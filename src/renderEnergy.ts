// Presentation-only cadence/cache budgets. No room, wallet or private data.
export const DESKTOP_IDLE_DELAY = 2000;
export const DESKTOP_SHADOW_SIZE = 1024;
export const DESKTOP_REFLECTION_SIZE = 512;
export const WORLD_RENDER_FPS = Object.freeze({ active: 60, compact: 30, feedback: 30, idle: 15, inactive: 10 });
export const DESKTOP_PASS_REFRESH = Object.freeze({ shadowActive: 30, reflectionActive: 15, idle: 2 });

// Public room updates move a player to the end of the list. Order is not a
// shadow change: only membership or posture should invalidate the cache.
export function shadowPoseKey(players: readonly { id: string; posture?: string }[]) {
  return players.map(player => `${player.id}:${player.posture ?? 'standing'}`).sort().join('/');
}

export class WorldFrameBudget {
  private activeUntil = 0;
  private next = 0;
  private rate = 0;

  // Changing from an idle to an active rate makes take() run immediately.
  // Repeated packets/input at an already-high rate must not bypass its cap.
  wake(now: number) {
    if (Number.isFinite(now)) this.activeUntil = now + DESKTOP_IDLE_DELAY;
  }
  recent(now: number) {
    return now < this.activeUntil;
  }
  target(now: number, compact: boolean, interactive: boolean, moving: boolean, effect: boolean) {
    // Held input extends the active window, not the deadline: waking every
    // rAF tick would defeat the frame cap on 120 Hz displays and phones.
    if (moving) this.wake(now);
    if (compact) return WORLD_RENDER_FPS.compact;
    if (interactive && (moving || this.recent(now))) return WORLD_RENDER_FPS.active;
    if (effect) return WORLD_RENDER_FPS.feedback;
    return interactive ? WORLD_RENDER_FPS.idle : WORLD_RENDER_FPS.inactive;
  }
  take(now: number, rate: number) {
    if (!Number.isFinite(now) || !Number.isFinite(rate) || rate <= 0) return false;
    if (rate !== this.rate) {
      this.rate = rate;
      this.next = 0;
    }
    if (now < this.next - .5) return false;
    const interval = 1000 / rate;
    this.next = this.next === 0 || now - this.next > interval ? now + interval : this.next + interval;
    return true;
  }
  reset() {
    this.activeUntil = 0;
    this.next = 0;
    this.rate = 0;
  }
}

export class CachedPassBudget {
  private last = -Infinity;
  constructor(private activeRate: number, private idleRate: number) {}
  invalidate() {
    this.last = -Infinity;
  }
  take(now: number, active: boolean, force = false) {
    if (!Number.isFinite(now)) return false;
    const interval = 1000 / (active ? this.activeRate : this.idleRate);
    if (!force && now - this.last < interval - .5) return false;
    this.last = now;
    return true;
  }
}
