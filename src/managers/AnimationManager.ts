import { AnimationGroup, Observer } from "@babylonjs/core";

export class AnimationManager {
  private _animationGroups: AnimationGroup[] = [];
  private _animationPlayingState: Map<string, boolean> = new Map();
  private _endObservers: Map<AnimationGroup, Observer<AnimationGroup>> = new Map();

  /** Callback fired when an animation group naturally ends playing. */
  public onAnimationEnded: ((name: string) => void) | null = null;

  public setAnimationGroups(groups: AnimationGroup[]): void {
    this.clearAnimations();

    this._animationGroups = groups;
    this._animationGroups.forEach((ag) => {
      ag.stop();
      this._animationPlayingState.set(ag.name, false);

      // Listen for animation completion to auto-sync state
      const observer = ag.onAnimationGroupEndObservable.add((group) => {
        this._animationPlayingState.set(group.name, false);
        if (this.onAnimationEnded) {
          this.onAnimationEnded(group.name);
        }
      });
      if (observer) {
        this._endObservers.set(ag, observer);
      }
    });
  }

  public getAnimationNames(): string[] {
    return this._animationGroups.map((ag) => ag.name);
  }

  public playAnimation(name: string, loop: boolean = true): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found in the loaded model.`);
    }

    // Pause other running animations
    this._animationGroups.forEach((other) => {
      if (other !== ag) {
        other.pause();
        this._animationPlayingState.set(other.name, false);
      }
    });

    // FIX Bug 2: If the animation is already at the end frame or stopped, reset it back to frame 0 first!
    if (!ag.isPlaying) {
      ag.reset();
    }

    ag.start(loop);
    this._animationPlayingState.set(name, true);
  }

  public pauseAnimation(name: string): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to pause.`);
    }
    ag.pause();
    this._animationPlayingState.set(name, false);
  }

  public stopAnimation(name: string): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to stop.`);
    }
    ag.stop();
    ag.reset();
    this._animationPlayingState.set(name, false);
  }

  public isAnimationPlaying(name: string): boolean {
    return this._animationPlayingState.get(name) ?? false;
  }

  public setAnimationSpeed(name: string, speed: number): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to set speed ratio.`);
    }
    ag.speedRatio = speed;
  }

  public clearAnimations(): void {
    this._animationGroups.forEach((ag) => {
      const observer = this._endObservers.get(ag);
      if (observer) {
        ag.onAnimationGroupEndObservable.remove(observer);
      }
      ag.stop();
      ag.dispose();
    });
    this._animationGroups = [];
    this._animationPlayingState.clear();
    this._endObservers.clear();
  }
}
