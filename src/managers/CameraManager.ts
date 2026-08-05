import {
  Scene,
  ArcRotateCamera,
  Vector3,
  TransformNode,
  AbstractMesh,
  Animation,
  CubicEase,
  EasingFunction,
  VertexBuffer,
  type Nullable,
  type Node
} from "@babylonjs/core";

/** Recusively ensures parent-to-child world matrices are computed up to date. */
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

  private _isTransitioningTarget: boolean = false;
  private _lastTargetPosition: Vector3 | null = null;
  private _tmpFitVector: Vector3 = Vector3.Zero();

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
    this.camera.wheelDeltaPercentage = 0.04; // 滚轮缩放比例提升至 4% (更加快速灵敏)
    this.camera.minZ = 0.01;

    this.camera.setTarget(this._cameraTargetNode.position);
    this._defaultFov = this.camera.fov;
    this.camera.attachControl(this._canvas, true);
    this._updatePanningSensibility();
  }

  private _registerRenderObserver(): void {
    this._scene.onBeforeRenderObservable.add(() => {
      // 1. Notify radius changes and dynamically update minZ clipping plane & adaptive panning sensibility
      const radius = this.camera.radius;
      if (radius !== this._lastNotifiedRadius) {
        this._lastNotifiedRadius = radius;
        this.camera.minZ = Math.min(0.01, Math.max(radius * 0.01, 0.0001));
        this._updatePanningSensibility();
        if (this.onCameraRadiusChanged) {
          this.onCameraRadiusChanged(radius);
        }
      }

      // 2. Continuous target lock when not in active camera target transition
      if (!this._isTransitioningTarget && this.isLockedToTarget) {
        let currentPos: Vector3 | null = null;
        if (this._cameraTargetNode) {
          currentPos = this._cameraTargetNode.position;
        }

        if (currentPos) {
          if (this._lastTargetPosition) {
            const delta = currentPos.subtract(this._lastTargetPosition);
            if (delta.lengthSquared() > 0.00001) {
              this.camera.target.addInPlace(delta);
            }
            this._lastTargetPosition.copyFrom(currentPos);
          } else {
            this._lastTargetPosition = currentPos.clone();
          }
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

  public animateCameraTo(target: Vector3, radius: number): void {
    if (!this._scene || !this.camera) return;

    this.stopCameraTransition();

    const frameRate = 60;
    const duration = 0.8;
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    this._isTransitioningTarget = true;
    this._lastTargetPosition = null;

    // Update target node position
    this._cameraTargetNode.position.copyFrom(target);

    // Synchronized smooth animation for BOTH radius AND camera.target
    Animation.CreateAndStartAnimation(
      "cameraFocusRadius",
      this.camera,
      "radius",
      frameRate,
      frameRate * duration,
      this.camera.radius,
      radius,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      ease
    );

    Animation.CreateAndStartAnimation(
      "cameraFocusTarget",
      this.camera,
      "target",
      frameRate,
      frameRate * duration,
      this.camera.target.clone(),
      target.clone(),
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      ease,
      () => {
        this._isTransitioningTarget = false;
        if (this.isLockedToTarget) {
          this._lastTargetPosition = target.clone();
        }
      }
    );
  }

  public stopCameraTransition(): void {
    this._isTransitioningTarget = false;
    if (this._scene && this.camera) {
      this._scene.stopAnimation(this.camera, "target");
      this._scene.stopAnimation(this.camera, "radius");
    }
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
    const radius = Math.max(this.camera.radius, CameraManager.MIN_ZOOM_DISTANCE);
    const baseSensibility = 5000 / this._panningSpeedMultiplier;
    // 自适应右键平移灵敏度：结合镜头当前距离 (radius) 平滑缩放。
    // 特写放大（高倍率/近距离）时自动提高灵敏度数值，使右键平移细腻顺畅；拉远时流畅快速。
    const adaptiveFactor = Math.pow(radius / 10.0, 0.25);
    this.camera.panningSensibility = Math.max(10, baseSensibility / adaptiveFactor);
  }

  public toggleAutoRotate(enabled: boolean): void {
    this.camera.useAutoRotationBehavior = enabled;
    if (enabled && this.camera.autoRotationBehavior) {
      this.camera.autoRotationBehavior.idleRotationSpeed = 0.1;
      this.camera.autoRotationBehavior.idleRotationWaitTime = 1000;
    }
  }

  public computeFitRadius(
    center: Vector3,
    min: Vector3,
    max: Vector3,
    margin: number,
    meshes?: AbstractMesh[]
  ): number {
    const view = this.camera.getViewMatrix();
    const cView = Vector3.TransformCoordinates(center, view);
    const tanHalf = Math.tan(this.camera.fov / 2);
    const aspect = this._scene.getEngine().getAspectRatio(this.camera) || 1;

    let radius = 0;
    let projectedVertices = 0;

    if (meshes && meshes.length > 0) {
      for (const mesh of meshes) {
        ensureWorldMatrixUpdated(mesh);
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (!positions || positions.length < 3) continue;
        const worldView = mesh.getWorldMatrix().multiply(view);
        const vertexCount = positions.length / 3;
        const step = Math.max(1, Math.floor(vertexCount / 50000));
        for (let i = 0; i < positions.length; i += 3 * step) {
          const v = Vector3.TransformCoordinatesFromFloatsToRef(
            positions[i],
            positions[i + 1],
            positions[i + 2],
            worldView,
            this._tmpFitVector
          );
          const relZ = cView.z - v.z;
          const offX = Math.abs(v.x - cView.x);
          const offY = Math.abs(v.y - cView.y);
          const rHeight = offY / tanHalf + relZ;
          const rWidth = offX / (tanHalf * aspect) + relZ;
          if (rHeight > radius) radius = rHeight;
          if (rWidth > radius) radius = rWidth;
          projectedVertices++;
        }
      }
    }

    if (projectedVertices === 0) {
      for (const x of [min.x, max.x]) {
        for (const y of [min.y, max.y]) {
          for (const z of [min.z, max.z]) {
            const v = Vector3.TransformCoordinates(new Vector3(x, y, z), view);
            const relZ = cView.z - v.z;
            const offX = Math.abs(v.x - cView.x);
            const offY = Math.abs(v.y - cView.y);
            const rHeight = offY / tanHalf + relZ;
            const rWidth = offX / (tanHalf * aspect) + relZ;
            radius = Math.max(radius, rHeight, rWidth);
          }
        }
      }
    }
    return Math.max(radius * margin, CameraManager.MIN_ZOOM_DISTANCE);
  }
}
