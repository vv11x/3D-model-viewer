import {
  Scene,
  ArcRotateCamera,
  Vector3,
  TransformNode,
  AbstractMesh,
  type Nullable,
  type Node
} from "@babylonjs/core";

/** Recursively ensures parent-to-child world matrices are computed up to date. */
export function ensureWorldMatrixUpdated(node: TransformNode | AbstractMesh): void {
  const ancestors: TransformNode[] = [];
  let curr: Nullable<Node> = node;
  while (curr && curr instanceof TransformNode) {
    ancestors.unshift(curr);
    curr = curr.parent;
  }
  for (const ancestor of ancestors) {
    ancestor.computeWorldMatrix(true);
  }
  if (node instanceof AbstractMesh) {
    node.refreshBoundingInfo({ applySkeleton: true });
  }
}

export class CameraManager {
  public static readonly MIN_ZOOM_DISTANCE = 0.0001;

  public camera: ArcRotateCamera;
  public isLockedToTarget: boolean = true;
  public onCameraRadiusChanged: ((radius: number) => void) | null = null;

  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _cameraTargetNode: TransformNode;
  private _defaultFov: number = 0.8;
  private _lastNotifiedRadius: number = -1;

  // Smooth Transition State
  private _isTransitioning: boolean = false;
  private _transitionStartTime: number = 0;
  private _transitionDuration: number = 650;
  private _startTarget: Vector3 = Vector3.Zero();
  private _endTarget: Vector3 = Vector3.Zero();
  private _startRadius: number = 10;
  private _endRadius: number = 10;
  private _lastTargetPosition: Vector3 | null = null;

  private _panningSpeedMultiplier: number = 1.0;

  constructor(scene: Scene, canvas: HTMLCanvasElement, cameraTargetNode: TransformNode) {
    this._scene = scene;
    this._canvas = canvas;
    this._cameraTargetNode = cameraTargetNode;

    this.camera = new ArcRotateCamera(
      "mainCamera",
      -Math.PI / 4,
      Math.PI / 3,
      10,
      this._cameraTargetNode.position.clone(),
      this._scene
    );

    this._setupCameraDefaults();
    this._registerRenderObserver();
    this._registerInteractionListeners();
  }

  private _setupCameraDefaults(): void {
    this.camera.lowerRadiusLimit = CameraManager.MIN_ZOOM_DISTANCE;
    this.camera.upperRadiusLimit = 100;
    this.camera.wheelPrecision = 50;
    this.camera.wheelDeltaPercentage = 0.04;
    this.camera.minZ = 0.01;

    this.camera.setTarget(this._cameraTargetNode.position);
    this._defaultFov = this.camera.fov;
    this.camera.attachControl(this._canvas, true);
    this._updatePanningSensibility();
  }

  private _registerRenderObserver(): void {
    this._scene.onBeforeRenderObservable.add(() => {
      // 1. Dynamic minZ clipping plane & adaptive panning sensibility
      const radius = this.camera.radius;
      if (radius !== this._lastNotifiedRadius) {
        this._lastNotifiedRadius = radius;
        this.camera.minZ = Math.min(0.01, Math.max(radius * 0.01, 0.0001));
        this._updatePanningSensibility();
        if (this.onCameraRadiusChanged) {
          this.onCameraRadiusChanged(radius);
        }
      }

      // 2. Smooth Transition Step
      if (this._isTransitioning) {
        const now = performance.now();
        const elapsed = now - this._transitionStartTime;
        const progress = Math.min(Math.max(elapsed / this._transitionDuration, 0), 1);

        // Cubic ease in-out
        const t = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentTarget = Vector3.Lerp(this._startTarget, this._endTarget, t);
        const currentRadius = this._startRadius + (this._endRadius - this._startRadius) * t;

        this.camera.setTarget(currentTarget);
        this.camera.radius = currentRadius;

        if (progress >= 1) {
          this._isTransitioning = false;
          this.camera.setTarget(this._endTarget);
          this.camera.radius = this._endRadius;
          if (this.isLockedToTarget) {
            this._lastTargetPosition = this._endTarget.clone();
          }
        }
      } else if (this.isLockedToTarget) {
        // Continuous target lock when not in active camera transition
        const currentPos = this._cameraTargetNode.position;
        if (this._lastTargetPosition) {
          const delta = currentPos.subtract(this._lastTargetPosition);
          if (delta.lengthSquared() > 0.00001) {
            const newTarget = this.camera.target.add(delta);
            this.camera.setTarget(newTarget);
          }
          this._lastTargetPosition.copyFrom(currentPos);
        } else {
          this._lastTargetPosition = currentPos.clone();
        }
      }
    });
  }

  private _registerInteractionListeners(): void {
    this._canvas.addEventListener("wheel", () => {
      this.stopCameraTransition();
    }, { passive: true });

    this._canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0 || e.button === 2) {
        this.stopCameraTransition();
      }
    });
  }

  public animateCameraTo(target: Vector3, radius: number, durationMs: number = 650): void {
    if (!this._scene || !this.camera) return;

    this._isTransitioning = true;
    this._transitionStartTime = performance.now();
    this._transitionDuration = Math.max(durationMs, 100);
    this._startTarget.copyFrom(this.camera.target);
    this._endTarget.copyFrom(target);
    this._startRadius = this.camera.radius;
    this._endRadius = Math.max(radius, CameraManager.MIN_ZOOM_DISTANCE);
    this._cameraTargetNode.position.copyFrom(target);
  }

  public stopCameraTransition(): void {
    this._isTransitioning = false;
    if (this.isLockedToTarget) {
      this._lastTargetPosition = this._cameraTargetNode.position.clone();
    } else {
      this._lastTargetPosition = null;
    }
  }

  public setCameraTargetLock(lock: boolean, currentFocusCenter?: Vector3, currentFocusRadius?: number): void {
    this.isLockedToTarget = lock;
    this._lastTargetPosition = null;
    if (lock && currentFocusCenter && currentFocusRadius !== undefined) {
      this.animateCameraTo(currentFocusCenter, currentFocusRadius);
    }
  }

  public resetCamera(defaultRadius: number = 10, targetCenter: Vector3 = new Vector3(0, 1.5, 0)): void {
    this.stopCameraTransition();
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = defaultRadius;
    this.camera.fov = this._defaultFov;
    this._cameraTargetNode.position.copyFrom(targetCenter);
    this.camera.setTarget(targetCenter.clone());
    this._lastTargetPosition = this.isLockedToTarget ? targetCenter.clone() : null;
  }

  public setCameraZoom(zoomFactor: number, baseRadius: number): void {
    const targetRadius = baseRadius / Math.max(zoomFactor, 1e-4);
    const upper = this.camera.upperRadiusLimit ?? 100;
    this.camera.radius = Math.min(
      Math.max(targetRadius, CameraManager.MIN_ZOOM_DISTANCE),
      upper
    );
  }

  public getCurrentZoom(baseRadius: number): number {
    return baseRadius / Math.max(this.camera.radius, 1e-6);
  }

  public setPanningSpeed(multiplier: number): void {
    this._panningSpeedMultiplier = Math.max(multiplier, 0.01);
    this._updatePanningSensibility();
  }

  private _updatePanningSensibility(): void {
    const radius = Math.max(this.camera.radius, 0.001);
    const baseSensibility = 1200 / Math.max(this._panningSpeedMultiplier, 0.01);
    const adaptiveFactor = Math.pow(radius / 5.0, 0.35);
    this.camera.panningSensibility = Math.min(Math.max(baseSensibility / adaptiveFactor, 20), 20000);
  }

  public toggleAutoRotate(enabled: boolean): void {
    this.camera.useAutoRotationBehavior = enabled;
    if (enabled && this.camera.autoRotationBehavior) {
      this.camera.autoRotationBehavior.idleRotationSpeed = 0.1;
      this.camera.autoRotationBehavior.idleRotationWaitTime = 1000;
    }
  }

  public computeFitRadius(
    _center: Vector3,
    min: Vector3,
    max: Vector3,
    margin: number = 1.25
  ): number {
    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z, 0.05);
    const fov = this.camera.fov;
    const aspect = this._scene.getEngine().getAspectRatio(this.camera) || 1.0;

    const fitRadiusV = (maxDimension * 0.5) / Math.tan(fov * 0.5);
    const fitRadiusH = (maxDimension * 0.5) / (Math.tan(fov * 0.5) * aspect);
    const fitRadius = Math.max(fitRadiusV, fitRadiusH) * margin;

    return Math.min(Math.max(fitRadius, CameraManager.MIN_ZOOM_DISTANCE), this.camera.upperRadiusLimit ?? 100);
  }
}
