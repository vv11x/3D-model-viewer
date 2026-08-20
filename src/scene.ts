import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  AbstractMesh,
  LinesMesh
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

import { CameraManager, ensureWorldMatrixUpdated } from "./managers/CameraManager";
import { AnimationManager, type AnimationRange } from "./managers/AnimationManager";
import { SelectionManager, type SelectionInfo, type OutlineAlgorithmType, type OutlineParams } from "./managers/SelectionManager";
import { ModelLoader, type TreeNode } from "./managers/ModelLoader";
import { MeshRoundingManager, type RoundingAlgorithmMode, type RoundingParams } from "./managers/MeshRoundingManager";
import { DebugManager, type ShadingMode, type PerformanceStats } from "./managers/DebugManager";
import { InspectorI18n } from "./utils/InspectorI18n";

export type { TreeNode, SelectionInfo, AnimationRange, OutlineAlgorithmType, OutlineParams, RoundingAlgorithmMode, RoundingParams, ShadingMode, PerformanceStats };

export class SceneController {
  public static readonly MIN_ZOOM_DISTANCE = CameraManager.MIN_ZOOM_DISTANCE;

  private _canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;

  public cameraManager: CameraManager;
  public animationManager: AnimationManager;
  public selectionManager: SelectionManager;
  public modelLoader: ModelLoader;
  public meshRoundingManager: MeshRoundingManager;
  public debugManager: DebugManager;

  private _hemiLight!: HemisphericLight;
  private _dirLight!: DirectionalLight;
  private _shadowGenerator: ShadowGenerator | null = null;
  private _ground!: AbstractMesh;
  private _gridMesh: LinesMesh | null = null;
  private _cameraTargetNode!: TransformNode;
  private _isShadowsEnabled: boolean = true;
  private _lastInspectorVisible: boolean = false;

  constructor(canvas: HTMLCanvasElement, engine?: Engine) {
    this._canvas = canvas;

    // Initialize Babylon Engine & Scene
    this.engine = engine ?? new Engine(this._canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.08, 0.08, 0.1).toColor4(1.0);

    // Initialize Camera Target Node
    this._cameraTargetNode = new TransformNode("cameraTarget", this.scene);
    this._cameraTargetNode.position = new Vector3(0, 1.5, 0);

    // Initialize Managers
    this.cameraManager = new CameraManager(this.scene, this._canvas, this._cameraTargetNode);
    this.animationManager = new AnimationManager();
    this.selectionManager = new SelectionManager(
      this.scene,
      this.cameraManager.camera,
      this._canvas,
      () => this.debugManager.activeShadingMode === 'wireframe'
    );
    this.modelLoader = new ModelLoader(this.scene);
    this.meshRoundingManager = new MeshRoundingManager();
    this.debugManager = new DebugManager(this.scene);

    this._setupLights();
    this._setupEnvironment();

    // Start render loop and Inspector Lifecycle Guard
    this._registerSceneObservers();
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", this._onResize);
  }

  private _registerSceneObservers(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      // Inspector Lifecycle Guard: Detects internal close or collapse and auto-syncs layout
      const isVisible = Boolean(
        this.scene.debugLayer.isVisible() &&
        document.querySelector('#scene-explorer-host, #inspector-host, .inspector-wrapper')
      );
      if (isVisible !== this._lastInspectorVisible) {
        this._lastInspectorVisible = isVisible;
        document.body.classList.toggle('inspector-open', isVisible);
        this.engine.resize();
      }
    });
  }

  public get camera(): ArcRotateCamera {
    return this.cameraManager.camera;
  }

  public get onCameraRadiusChanged(): ((radius: number) => void) | null {
    return this.cameraManager.onCameraRadiusChanged;
  }

  public set onCameraRadiusChanged(callback: ((radius: number) => void) | null) {
    this.cameraManager.onCameraRadiusChanged = callback;
  }

  public get isLockedToTarget(): boolean {
    return this.cameraManager.isLockedToTarget;
  }

  public set isLockedToTarget(lock: boolean) {
    this.cameraManager.isLockedToTarget = lock;
  }

  private _setupLights(): void {
    this._hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this.scene);
    this._hemiLight.intensity = 0.6;
    this._hemiLight.specular = new Color3(0.2, 0.2, 0.2);

    this._dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), this.scene);
    this._dirLight.position = new Vector3(5, 10, 5);
    this._dirLight.intensity = 0.8;

    this._shadowGenerator = new ShadowGenerator(2048, this._dirLight);
    this._shadowGenerator.useBlurExponentialShadowMap = true;
    this._shadowGenerator.useKernelBlur = true;
    this._shadowGenerator.blurKernel = 16;
    this._shadowGenerator.setDarkness(0.4);
  }

  private _setupEnvironment(): void {
    this._ground = MeshBuilder.CreateGround("shadowGround", { width: 100, height: 100 }, this.scene);
    const groundMaterial = new StandardMaterial("groundMat", this.scene);
    groundMaterial.diffuseColor = new Color3(0.08, 0.08, 0.1);
    groundMaterial.specularColor = new Color3(0.0, 0.0, 0.0);
    groundMaterial.roughness = 1.0;
    this._ground.material = groundMaterial;
    this._ground.receiveShadows = true;

    this._createGrid(30, 30);
  }

  private _createGrid(size: number, subdivisions: number): void {
    if (this._gridMesh) {
      this._gridMesh.dispose();
    }
    const lines = [];
    const step = size / subdivisions;
    const halfSize = size / 2;

    for (let i = 0; i <= subdivisions; i++) {
      const pos = -halfSize + i * step;
      lines.push([new Vector3(-halfSize, 0, pos), new Vector3(halfSize, 0, pos)]);
      lines.push([new Vector3(pos, 0, -halfSize), new Vector3(pos, 0, halfSize)]);
    }

    this._gridMesh = MeshBuilder.CreateLineSystem("gridLines", { lines: lines }, this.scene);
    this._gridMesh.color = new Color3(0.2, 0.25, 0.35);
    this._gridMesh.isPickable = false;
    this._gridMesh.position.y = 0.005;
  }

  public setGridVisibility(visible: boolean): void {
    if (this._gridMesh) {
      this._gridMesh.setEnabled(visible);
    }
  }

  public setShadowsEnabled(enabled: boolean): void {
    this._isShadowsEnabled = enabled;
    if (this._shadowGenerator) {
      this._ground.receiveShadows = enabled;
    }
  }

  public setLightIntensity(intensity: number): void {
    this._dirLight.intensity = intensity;
  }

  public setAmbientIntensity(intensity: number): void {
    this._hemiLight.intensity = intensity;
  }

  public setCameraZoom(zoomFactor: number): void {
    this.cameraManager.setCameraZoom(zoomFactor, this.getBaseRadius());
  }

  public getBaseRadius(): number {
    return this.modelLoader.currentModelRoot
      ? this.modelLoader.getModelFocusRadius((c, min, max, m) =>
          this.cameraManager.computeFitRadius(c, min, max, m)
        )
      : 10.0;
  }

  public getCurrentZoom(): number {
    return this.cameraManager.getCurrentZoom(this.getBaseRadius());
  }

  public setPanningSpeed(multiplier: number): void {
    this.cameraManager.setPanningSpeed(multiplier);
  }

  public setSelectionHighlight(enabled: boolean): void {
    this.selectionManager.setSelectionHighlight(enabled);
  }

  public isSelectionHighlightEnabled(): boolean {
    return this.selectionManager.isSelectionHighlightEnabled();
  }

  // ==================== 6 大独立描边算法与参数调控 APIs ====================
  public setOutlineAlgorithm(algorithm: OutlineAlgorithmType): void {
    this.selectionManager.setOutlineAlgorithm(algorithm);
  }

  public getOutlineAlgorithm(): OutlineAlgorithmType {
    return this.selectionManager.getOutlineAlgorithm();
  }

  public getOutlineAlgorithms(): { id: OutlineAlgorithmType; name: string; category: 'official' | 'advanced'; description: string }[] {
    return this.selectionManager.getOutlineAlgorithms();
  }

  public setOutlineParams(params: Partial<OutlineParams>): void {
    this.selectionManager.setOutlineParams(params);
  }

  public getOutlineParams(): OutlineParams {
    return this.selectionManager.getOutlineParams();
  }

  public setOutlineColor(hex: string): void {
    this.selectionManager.setOutlineColor(hex);
  }

  public getOutlineColorHex(): string {
    return this.selectionManager.getOutlineColorHex();
  }

  public setOutlineWidth(width: number): void {
    this.selectionManager.setOutlineWidth(width);
  }

  public getOutlineWidth(): number {
    return this.selectionManager.getOutlineWidth();
  }

  public setCameraTargetLock(lock: boolean): void {
    const focusTarget = this._getFocusTargetCenterAndRadius();
    this.cameraManager.setCameraTargetLock(lock, focusTarget.center, focusTarget.radius);
  }

  public resetCamera(): void {
    const defaultRadius = this.getBaseRadius();
    const targetCenter = this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);
    this.cameraManager.resetCamera(defaultRadius, targetCenter);
  }

  public toggleAutoRotate(enabled: boolean): void {
    this.cameraManager.toggleAutoRotate(enabled);
  }

  public selectTarget(targetName: string | null): SelectionInfo | null {
    const info = this.selectionManager.selectTargetByName(targetName);

    if (info && this.selectionManager.selectedTarget) {
      const focusTarget = this._getFocusTargetCenterAndRadius();
      this.cameraManager.animateCameraTo(focusTarget.center, focusTarget.radius);
    }
    return info;
  }

  public focusOnSelected(): void {
    if (this.selectionManager.selectedTarget) {
      const focusTarget = this._getFocusTargetCenterAndRadius();
      this.cameraManager.animateCameraTo(focusTarget.center, focusTarget.radius);
    }
  }

  private _getFocusTargetCenterAndRadius(): { center: Vector3; radius: number } {
    const meshes = this.selectionManager.selectedMeshes;
    if (meshes.length > 0) {
      let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

      meshes.forEach((m) => {
        ensureWorldMatrixUpdated(m);
        const bb = m.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
      });

      const center = Vector3.Center(min, max);
      const margin = meshes.length === 1 ? 1.6 : 1.25;
      const radius = this.cameraManager.computeFitRadius(center, min, max, margin);
      return { center, radius };
    }

    return {
      center: this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position),
      radius: this.getBaseRadius()
    };
  }

  public setSelectedVisible(visible: boolean): void {
    this.selectionManager.setSelectedVisible(visible);
  }

  public showAllMeshes(): void {
    this.modelLoader.showAllMeshes();
  }

  public isSelectedVisible(): boolean {
    return this.selectionManager.isSelectedVisible();
  }

  public isTargetVisible(name: string): boolean {
    return this.selectionManager.isTargetVisible(name);
  }

  public setTargetVisible(name: string, visible: boolean): void {
    this.selectionManager.setTargetVisible(name, visible);
  }

  public setSelectedAlpha(alpha: number): void {
    this.selectionManager.setSelectedAlpha(alpha);
  }

  public getSelectedAlpha(): number {
    return this.selectionManager.getSelectedAlpha();
  }

  public toggleSelectedRotation(enabled: boolean): void {
    this.selectionManager.toggleSelectedRotation(enabled);
  }

  public isSelectedRotating(): boolean {
    return this.selectionManager.isSelectedRotating();
  }

  public toggleDragSelected(enabled: boolean): void {
    this.selectionManager.toggleDragSelected(enabled);
  }

  public resetSelectedPosition(): void {
    this.selectionManager.resetSelectedPosition();
  }

  // Animation Methods
  public getAnimationNames(): string[] {
    return this.animationManager.getAnimationNames();
  }

  public getAnimationRange(name: string): AnimationRange | null {
    return this.animationManager.getAnimationRange(name);
  }

  public getCurrentAnimationFrame(name: string): number {
    return this.animationManager.getCurrentFrame(name);
  }

  public goToAnimationFrame(name: string, frame: number): void {
    this.animationManager.goToFrame(name, frame);
  }

  public stepAnimationFrame(name: string, delta: number): void {
    this.animationManager.stepFrame(name, delta);
  }

  public setAnimationLoop(name: string, loop: boolean): void {
    this.animationManager.setLoop(name, loop);
  }

  public isAnimationLooping(name: string): boolean {
    return this.animationManager.isLooping(name);
  }

  public playAnimation(name: string, loop?: boolean): void {
    this.animationManager.playAnimation(name, loop);
  }

  public pauseAnimation(name: string): void {
    this.animationManager.pauseAnimation(name);
  }

  public stopAnimation(name: string): void {
    this.animationManager.stopAnimation(name);
  }

  public isAnimationPlaying(name: string): boolean {
    return this.animationManager.isAnimationPlaying(name);
  }

  public setAnimationSpeed(name: string, speed: number): void {
    this.animationManager.setAnimationSpeed(name, speed);
  }

  public setShadingMode(mode: ShadingMode): void {
    this.debugManager.setShadingMode(mode);
  }

  public setAxisGizmoVisible(visible: boolean): void {
    const center = this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);
    const radius = this.modelLoader.getModelFocusRadius();
    this.debugManager.setAxisGizmoVisible(visible, center, radius * 0.4);
  }

  public setSceneBoundingBoxVisible(visible: boolean): void {
    const bbox = this.modelLoader.calculateModelBounds();
    if (bbox) {
      this.debugManager.setSceneBoundingBoxVisible(visible, bbox.min, bbox.max);
    } else {
      this.debugManager.setSceneBoundingBoxVisible(visible);
    }
  }

  public getPerformanceStats(): PerformanceStats {
    return this.debugManager.getPerformanceStats();
  }

  public clearCurrentModel(): void {
    this.debugManager.clear();
    this.meshRoundingManager.clear();
    this.modelLoader.clearCurrentModel();
    this.selectionManager.clearSelection();
    this.selectionManager.restoreAllIsolatedMaterials();
    this.animationManager.clearAnimations();
  }

  public resetEntireModel(): void {
    this.debugManager.setShadingMode('pbr');
    this.meshRoundingManager.resetRounding();
    this.selectionManager.resetAllTransformsAndMaterials();
    const names = this.getAnimationNames();
    if (names.length > 0) {
      this.animationManager.goToFrame(names[0], 0);
      this.animationManager.stopAnimation(names[0]);
    }
    this.resetCamera();
  }

  public async loadModelFromFile(file: File): Promise<string> {
    this.clearCurrentModel();
    this.cameraManager.stopCameraTransition();

    const { summary, animationGroups } = await this.modelLoader.loadModelFromFile(
      file,
      this._shadowGenerator,
      this._isShadowsEnabled
    );

    this.animationManager.setAnimationGroups(animationGroups);

    if (this.modelLoader.currentModelRoot) {
      const childMeshes = this.modelLoader.currentModelRoot.getChildMeshes();
      this.selectionManager.cacheModelInitialTransforms(this.modelLoader.currentModelRoot);
      this.meshRoundingManager.cacheModelGeometry(childMeshes);
      childMeshes.forEach((m) => this.debugManager.cacheMeshMaterial(m));
    }

    const modelCenter = this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);
    const modelRadius = this.modelLoader.getModelFocusRadius((c, min, max, m) =>
      this.cameraManager.computeFitRadius(c, min, max, m)
    );

    this.cameraManager.animateCameraTo(modelCenter, modelRadius);
    return summary;
  }

  public applyRounding(
    scope: 'selected' | 'all',
    mode: RoundingAlgorithmMode,
    params: Partial<RoundingParams>
  ): number {
    const targets = scope === 'selected'
      ? this.selectionManager.selectedMeshes
      : (this.modelLoader.currentModelRoot ? this.modelLoader.currentModelRoot.getChildMeshes() : []);
    return this.meshRoundingManager.applyRounding(targets, mode, params);
  }

  public resetRounding(scope: 'selected' | 'all' = 'all'): void {
    const targets = scope === 'selected' ? this.selectionManager.selectedMeshes : undefined;
    this.meshRoundingManager.resetRounding(targets);
  }

  public stopCameraTransition(): void {
    this.cameraManager.stopCameraTransition();
  }

  private _onResize = () => {
    this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this._onResize);
    InspectorI18n.dispose();
    this.meshRoundingManager.clear();
    this.animationManager.clearAnimations();
    this.selectionManager.clearSelection();
    this.selectionManager.restoreAllIsolatedMaterials();
    this.selectionManager.outlineManager.dispose();
    this.debugManager.dispose();
    this.modelLoader.clearCurrentModel();
    this.engine.dispose();
  }

  public getModelHierarchy(): TreeNode[] | null {
    return this.modelLoader.getModelHierarchy();
  }
}

