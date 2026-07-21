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
  LinesMesh,
  GlowLayer
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

import { CameraManager, ensureWorldMatrixUpdated } from "./managers/CameraManager";
import { AnimationManager } from "./managers/AnimationManager";
import { SelectionManager } from "./managers/SelectionManager";
import { ModelLoader, type TreeNode } from "./managers/ModelLoader";

export type { TreeNode };

export class SceneController {
  public static readonly MIN_ZOOM_DISTANCE = CameraManager.MIN_ZOOM_DISTANCE;

  private _canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;

  public cameraManager: CameraManager;
  public animationManager: AnimationManager;
  public selectionManager: SelectionManager;
  public modelLoader: ModelLoader;

  private _hemiLight!: HemisphericLight;
  private _dirLight!: DirectionalLight;
  private _shadowGenerator: ShadowGenerator | null = null;
  private _ground!: AbstractMesh;
  private _gridMesh: LinesMesh | null = null;
  private _cameraTargetNode!: TransformNode;
  private _glowLayer!: GlowLayer;
  private _isShadowsEnabled: boolean = true;

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
    this.selectionManager = new SelectionManager(this.scene, this.engine, this.cameraManager.camera, this._canvas);
    this.modelLoader = new ModelLoader(this.scene);

    this._setupLights();
    this._setupEnvironment();

    this._glowLayer = new GlowLayer("glow", this.scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 16
    });
    this._glowLayer.intensity = 0.8;

    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    window.addEventListener("resize", this._onResize);
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
      ? this.modelLoader.getModelFocusRadius((c, min, max, m, meshes) =>
          this.cameraManager.computeFitRadius(c, min, max, m, meshes)
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
    this.selectionManager.setSelectionHighlight(enabled, this.modelLoader.currentModelRoot);
  }

  public setCameraTargetLock(lock: boolean): void {
    const focusCenter = this.selectionManager.selectedMesh
      ? this.selectionManager.selectedMesh.getBoundingInfo().boundingBox.centerWorld
      : this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);

    const focusRadius = this.selectionManager.selectedMesh
      ? this._calculateFocusRadius(this.selectionManager.selectedMesh)
      : this.getBaseRadius();

    this.cameraManager.setCameraTargetLock(lock, focusCenter, focusRadius);
  }

  public resetCamera(): void {
    const defaultRadius = this.getBaseRadius();
    const targetCenter = this.selectionManager.selectedMesh
      ? this.selectionManager.selectedMesh.getBoundingInfo().boundingBox.centerWorld
      : this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);

    this.cameraManager.resetCamera(defaultRadius, targetCenter);
  }

  public toggleAutoRotate(enabled: boolean): void {
    this.cameraManager.toggleAutoRotate(enabled);
  }

  public selectMesh(meshName: string | null): { name: string; vertices: number; parent: string } | null {
    const info = this.selectionManager.selectMeshByName(meshName);
    this.selectionManager.updateSelectionMaskRenderList(this.modelLoader.currentModelRoot);

    if (info && this.selectionManager.selectedMesh) {
      const mesh = this.selectionManager.selectedMesh;
      ensureWorldMatrixUpdated(mesh);

      const boundingInfo = mesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.centerWorld;
      const targetRadius = this._calculateFocusRadius(mesh);

      this.cameraManager.animateCameraTo(center, targetRadius);
    }
    return info;
  }

  public lockCameraToSelected(): void {
    const mesh = this.selectionManager.selectedMesh;
    if (mesh) {
      ensureWorldMatrixUpdated(mesh);
      const boundingInfo = mesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.centerWorld;
      const targetRadius = this._calculateFocusRadius(mesh);

      this.cameraManager.animateCameraTo(center, targetRadius);
    }
  }

  public focusOnGroup(nodeName: string): void {
    const node =
      this.scene.getTransformNodeByName(nodeName) ??
      this.scene.getMeshByName(nodeName);
    if (!node) {
      throw new Error(`Node "${nodeName}" was not found in the scene.`);
    }

    const meshesToFocus: AbstractMesh[] = [];
    const selfMesh = node as AbstractMesh;
    if (typeof selfMesh.getTotalVertices === "function" && selfMesh.getTotalVertices() > 0) {
      meshesToFocus.push(selfMesh);
    }
    node.getChildMeshes(false).forEach((m) => {
      if (m.getTotalVertices() > 0) {
        meshesToFocus.push(m);
      }
    });

    if (meshesToFocus.length === 0) {
      throw new Error(`Node "${nodeName}" does not contain any meshes to focus on.`);
    }

    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

    meshesToFocus.forEach((m) => {
      ensureWorldMatrixUpdated(m);
      const bb = m.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, bb.minimumWorld);
      max = Vector3.Maximize(max, bb.maximumWorld);
    });

    const center = Vector3.Center(min, max);
    const targetRadius = this.cameraManager.computeFitRadius(center, min, max, 0.9, meshesToFocus);

    this.cameraManager.animateCameraTo(center, targetRadius);
  }

  public setSelectedMeshVisible(visible: boolean): void {
    this.selectionManager.setSelectedMeshVisible(visible);
  }

  public showAllMeshes(): void {
    this.modelLoader.showAllMeshes();
  }

  public isSelectedMeshVisible(): boolean {
    return this.selectionManager.isSelectedMeshVisible();
  }

  public setSelectedMeshAlpha(alpha: number): void {
    this.selectionManager.setSelectedMeshAlpha(alpha);
  }

  public getSelectedMeshAlpha(): number {
    return this.selectionManager.getSelectedMeshAlpha();
  }

  public toggleSelectedMeshRotation(enabled: boolean): void {
    this.selectionManager.toggleSelectedMeshRotation(enabled);
  }

  public isSelectedMeshRotating(): boolean {
    return this.selectionManager.isSelectedMeshRotating();
  }

  public toggleDragSelectedMesh(enabled: boolean): void {
    this.selectionManager.toggleDragSelectedMesh(enabled);
  }

  public resetSelectedMeshPosition(): void {
    this.selectionManager.resetSelectedMeshPosition();
  }

  public getAnimationNames(): string[] {
    return this.animationManager.getAnimationNames();
  }

  public playAnimation(name: string, loop: boolean = true): void {
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

  public toggleInspector(): void {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
    } else {
      this.scene.debugLayer.show({
        embedMode: true,
        overlay: true
      });
    }
  }

  public clearCurrentModel(): void {
    this.modelLoader.clearCurrentModel();
    this.selectionManager.clearSelection();
    this.animationManager.clearAnimations();
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

    const modelCenter = this.modelLoader.getModelCenterWorld(this._cameraTargetNode.position);
    const modelRadius = this.modelLoader.getModelFocusRadius((c, min, max, m, meshes) =>
      this.cameraManager.computeFitRadius(c, min, max, m, meshes)
    );

    this.cameraManager.animateCameraTo(modelCenter, modelRadius);
    return summary;
  }

  public stopCameraTransition(): void {
    this.cameraManager.stopCameraTransition();
  }

  private _calculateFocusRadius(mesh: AbstractMesh): number {
    ensureWorldMatrixUpdated(mesh);
    const bb = mesh.getBoundingInfo().boundingBox;
    const center = bb.centerWorld;
    return this.cameraManager.computeFitRadius(center, bb.minimumWorld, bb.maximumWorld, 1.8, [mesh]);
  }

  private _onResize = () => {
    this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this._onResize);
    this.animationManager.clearAnimations();
    this.selectionManager.clearSelection();
    this.modelLoader.clearCurrentModel();
    this.engine.dispose();
  }

  public getModelHierarchy(): TreeNode[] | null {
    return this.modelLoader.getModelHierarchy();
  }
}
