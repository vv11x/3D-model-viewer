import { AnimationGroup, Observer } from "@babylonjs/core";

export interface AnimationRange {
  from: number;
  to: number;
  totalFrames: number;
}

export class AnimationManager {
  private _animationGroups: AnimationGroup[] = [];
  private _animationPlayingState: Map<string, boolean> = new Map();
  private _hasEndedMap: Map<string, boolean> = new Map();
  private _endObservers: Map<AnimationGroup, Observer<AnimationGroup>> = new Map();
  private _loopMap: Map<string, boolean> = new Map();

  /** Callback fired when an animation group naturally ends playing. */
  public onAnimationEnded: ((name: string) => void) | null = null;

  public setAnimationGroups(groups: AnimationGroup[]): void {
    this.clearAnimations();

    this._animationGroups = groups;
    this._animationGroups.forEach((ag) => {
      ag.stop();
      this._animationPlayingState.set(ag.name, false);
      this._hasEndedMap.set(ag.name, true);
      this._loopMap.set(ag.name, false); // Default to play once

      // Listen for animation completion to auto-sync state
      const observer = ag.onAnimationGroupEndObservable.add((group) => {
        this._animationPlayingState.set(group.name, false);
        this._hasEndedMap.set(group.name, true);
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

  public getAnimationRange(name: string): AnimationRange | null {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) return null;
    const from = ag.from;
    const to = ag.to;
    const totalFrames = Math.max(1, Math.round(to - from));
    return { from, to, totalFrames };
  }

  public getCurrentFrame(name: string): number {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) return 0;
    if (ag.animatables && ag.animatables.length > 0) {
      const master = ag.animatables[0].masterFrame;
      if (typeof master === "number" && !isNaN(master)) {
        return master;
      }
    }
    return ag.from;
  }

  public goToFrame(name: string, frame: number): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) return;
    if (!ag.isStarted || !ag.animatables || ag.animatables.length === 0) {
      ag.start(this._loopMap.get(name) ?? false, 1.0, ag.from, ag.to, false);
      ag.pause();
    }
    const clampedFrame = Math.max(ag.from, Math.min(ag.to, frame));
    ag.goToFrame(clampedFrame);
    if (clampedFrame < ag.to - 0.01) {
      this._hasEndedMap.set(name, false);
    }
  }

  public stepFrame(name: string, deltaFrames: number): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) return;
    const current = this.getCurrentFrame(name);
    const target = Math.max(ag.from, Math.min(ag.to, current + deltaFrames));
    ag.goToFrame(target);
    if (target < ag.to - 0.01) {
      this._hasEndedMap.set(name, false);
    }
  }

  public setLoop(name: string, loop: boolean): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (ag) {
      ag.loopAnimation = loop;
      this._loopMap.set(name, loop);
    }
  }

  public isLooping(name: string): boolean {
    return this._loopMap.get(name) ?? false;
  }

  public playAnimation(name: string, loop?: boolean): void {
    const ag = this._animationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found in the loaded model.`);
    }

    const useLoop = loop !== undefined ? loop : (this._loopMap.get(name) ?? false);
    this._loopMap.set(name, useLoop);

    // Pause other running animations
    this._animationGroups.forEach((other) => {
      if (other !== ag) {
        other.pause();
        this._animationPlayingState.set(other.name, false);
      }
    });

    const current = this.getCurrentFrame(name);
    const isAtEnd = Math.abs(current - ag.to) < 0.5 || (this._hasEndedMap.get(name) ?? false);

    if (isAtEnd) {
      ag.reset();
      ag.start(useLoop);
    } else if (ag.isStarted) {
      ag.play(useLoop);
    } else {
      ag.start(useLoop);
    }

    this._hasEndedMap.set(name, false);
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
    this._hasEndedMap.set(name, true);
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
    ag.speedRatio = Math.max(0.1, speed);
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
    this._hasEndedMap.clear();
    this._endObservers.clear();
    this._loopMap.clear();
  }
}
