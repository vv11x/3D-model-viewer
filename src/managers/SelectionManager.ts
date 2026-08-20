import {
  Scene,
  ArcRotateCamera,
  AbstractMesh,
  PointerDragBehavior,
  Vector3,
  Quaternion,
  type Nullable,
  type Material,
  TransformNode
} from "@babylonjs/core";
import { ensureWorldMatrixUpdated } from "./CameraManager";
import { OutlineManager } from "./outline/OutlineManager";
import type { OutlineAlgorithmType, OutlineParams } from "./outline/IOutlineRenderer";

export type { OutlineAlgorithmType, OutlineParams };

export interface SelectionInfo {
  name: string;
  type: 'mesh' | 'group';
  vertices: number;
  meshCount: number;
  parent: string;
}

export class SelectionManager {
  private _scene: Scene;
  private _camera: ArcRotateCamera;
  private _canvas: HTMLCanvasElement;

  private _selectedTarget: TransformNode | AbstractMesh | null = null;
  private _selectedMeshes: AbstractMesh[] = [];
  private _rotatingNodes: Set<TransformNode | AbstractMesh> = new Set();
  private _selectionHighlightEnabled: boolean = true;

  // Master Outline Engine Manager
  public outlineManager: OutlineManager;
  private _dragBehavior: PointerDragBehavior | null = null;

  // Material Isolation State to prevent shared material pollution
  private _isolatedMaterials: Map<AbstractMesh, Material> = new Map();
  private _originalMaterials: Map<AbstractMesh, Material> = new Map();

  // Model-wide initial transforms for One-Click Reset
  private _initialTransforms: Map<TransformNode | AbstractMesh, {
    position: Vector3;
    rotation: Vector3;
    rotationQuaternion: Nullable<Quaternion>;
    scaling: Vector3;
  }> = new Map();

  constructor(scene: Scene, camera: ArcRotateCamera, canvas: HTMLCanvasElement) {
    this._scene = scene;
    this._camera = camera;
    this._canvas = canvas;

    this.outlineManager = new OutlineManager(this._scene, this._camera);
    this._registerRenderObserver();
  }

  private _registerRenderObserver(): void {
    this._scene.onBeforeRenderObservable.add(() => {
      // Target node auto-rotation
      this._rotatingNodes.forEach((node) => {
        if (node && !node.isDisposed()) {
          node.rotate(Vector3.Up(), 0.02);
        }
      });
    });
  }

  public get selectedTarget(): TransformNode | AbstractMesh | null {
    return this._selectedTarget;
  }

  public get selectedMeshes(): AbstractMesh[] {
    return this._selectedMeshes;
  }

  public getMeshesInTarget(node: TransformNode | AbstractMesh): AbstractMesh[] {
    const meshes: AbstractMesh[] = [];
    if (node instanceof AbstractMesh && node.getTotalVertices() > 0) {
      meshes.push(node);
    }
    node.getChildMeshes(false).forEach((m) => {
      if (m.getTotalVertices() > 0 && !meshes.includes(m)) {
        meshes.push(m);
      }
    });
    return meshes;
  }

  public selectTargetByName(name: string | null): SelectionInfo | null {
    if (this._dragBehavior && this._selectedTarget) {
      this._selectedTarget.removeBehavior(this._dragBehavior);
      this._dragBehavior = null;
    }

    this._clearHighlight();
    this._selectedTarget = null;
    this._selectedMeshes = [];

    if (!name) {
      return null;
    }

    const node = this._scene.getMeshByName(name) ?? this._scene.getTransformNodeByName(name);
    if (!node) {
      throw new Error(`Node "${name}" was not found in the scene.`);
    }

    this._selectedTarget = node;
    this._selectedMeshes = this.getMeshesInTarget(node);

    let totalVerts = 0;
    this._selectedMeshes.forEach((m) => {
      ensureWorldMatrixUpdated(m);
      totalVerts += m.getTotalVertices();
      this._cacheInitialTransform(m);
    });
    this._cacheInitialTransform(node);

    if (this._selectionHighlightEnabled) {
      this._applyHighlight();
    }

    const isGroup = !(node instanceof AbstractMesh) || node.getChildren().length > 0;

    return {
      name: node.name,
      type: isGroup ? 'group' : 'mesh',
      vertices: totalVerts,
      meshCount: this._selectedMeshes.length,
      parent: node.parent ? node.parent.name : "无"
    };
  }

  // ==================== Outline Algorithm & Parameter APIs ====================
  public setOutlineAlgorithm(algorithm: OutlineAlgorithmType): void {
    this.outlineManager.setAlgorithm(algorithm);
  }

  public getOutlineAlgorithm(): OutlineAlgorithmType {
    return this.outlineManager.activeAlgorithm;
  }

  public getOutlineAlgorithms(): { id: OutlineAlgorithmType; name: string; category: 'official' | 'advanced'; description: string }[] {
    return this.outlineManager.getAlgorithms();
  }

  public setOutlineParams(params: Partial<OutlineParams>): void {
    this.outlineManager.setParams(params);
  }

  public getOutlineParams(): OutlineParams {
    return this.outlineManager.getParams();
  }

  public setOutlineColor(hex: string): void {
    this.outlineManager.setParams({ color: hex });
  }

  public getOutlineColorHex(): string {
    return this.outlineManager.getParams().color;
  }

  public setOutlineWidth(width: number): void {
    this.outlineManager.setParams({ width });
  }

  public getOutlineWidth(): number {
    return this.outlineManager.getParams().width;
  }

  private _applyHighlight(): void {
    if (!this._selectionHighlightEnabled || this._selectedMeshes.length === 0) {
      this._clearHighlight();
      return;
    }
    this.outlineManager.applyHighlight(this._selectedMeshes);
  }

  private _clearHighlight(): void {
    this.outlineManager.clearHighlight();
  }

  public setSelectionHighlight(enabled: boolean): void {
    this._selectionHighlightEnabled = enabled;
    this.outlineManager.setEnabled(enabled);
    if (enabled && this._selectedMeshes.length > 0) {
      this._applyHighlight();
    } else {
      this._clearHighlight();
    }
  }

  public isSelectionHighlightEnabled(): boolean {
    return this._selectionHighlightEnabled;
  }

  public setSelectedVisible(visible: boolean): void {
    if (!this._selectedTarget) {
      throw new Error("Cannot set visibility: No item is currently selected.");
    }
    this._selectedTarget.setEnabled(visible);
    this._selectedMeshes.forEach((m) => {
      m.setEnabled(visible);
      m.isVisible = visible;
    });
  }

  public isSelectedVisible(): boolean {
    return this._selectedTarget ? this._selectedTarget.isEnabled() : true;
  }

  // ==================== Material Isolation for Opacity ====================
  public setSelectedAlpha(alpha: number): void {
    if (!this._selectedTarget) {
      throw new Error("Cannot set alpha: No item is currently selected.");
    }

    this._selectedMeshes.forEach((mesh) => {
      mesh.visibility = alpha;

      if (mesh.material) {
        if (alpha < 1.0) {
          // If not yet isolated for this mesh, clone unique material
          if (!this._isolatedMaterials.has(mesh)) {
            const original = mesh.material;
            this._originalMaterials.set(mesh, original);
            const uniqueMat = original.clone(`${mesh.name}_isolated_mat_${mesh.uniqueId}`);
            if (uniqueMat) {
              uniqueMat.alpha = alpha;
              uniqueMat.transparencyMode = 2;
              uniqueMat.needDepthPrePass = true;
              mesh.material = uniqueMat;
              this._isolatedMaterials.set(mesh, uniqueMat);
            }
          } else {
            const mat = this._isolatedMaterials.get(mesh)!;
            mat.alpha = alpha;
            mat.transparencyMode = 2;
            mat.needDepthPrePass = true;
          }
        } else {
          // Restore original shared material when alpha returns to 1.0
          if (this._isolatedMaterials.has(mesh)) {
            const original = this._originalMaterials.get(mesh);
            const isolated = this._isolatedMaterials.get(mesh);
            if (original) mesh.material = original;
            if (isolated) isolated.dispose();
            this._isolatedMaterials.delete(mesh);
            this._originalMaterials.delete(mesh);
          }
        }
      }
    });
  }

  public getSelectedAlpha(): number {
    if (!this._selectedTarget) return 1.0;
    const firstMesh = this._selectedMeshes[0];
    return firstMesh ? firstMesh.visibility : 1.0;
  }

  public restoreAllIsolatedMaterials(): void {
    this._isolatedMaterials.forEach((isolatedMat, mesh) => {
      const original = this._originalMaterials.get(mesh);
      if (original && mesh && !mesh.isDisposed()) {
        mesh.material = original;
        mesh.visibility = 1.0;
      }
      if (isolatedMat) {
        isolatedMat.dispose();
      }
    });
    this._isolatedMaterials.clear();
    this._originalMaterials.clear();
  }

  public toggleSelectedRotation(enabled: boolean): void {
    if (!this._selectedTarget) {
      throw new Error("Cannot toggle rotation: No item is currently selected.");
    }
    if (enabled) {
      this._rotatingNodes.add(this._selectedTarget);
    } else {
      this._rotatingNodes.delete(this._selectedTarget);
    }
  }

  public isSelectedRotating(): boolean {
    return this._selectedTarget ? this._rotatingNodes.has(this._selectedTarget) : false;
  }

  public cacheModelInitialTransforms(modelRoot: TransformNode): void {
    this._cacheInitialTransform(modelRoot);
    modelRoot.getChildren(undefined, false).forEach((child) => {
      if (child instanceof TransformNode || child instanceof AbstractMesh) {
        this._cacheInitialTransform(child);
      }
    });
    modelRoot.getChildMeshes().forEach((m) => {
      this._cacheInitialTransform(m);
    });
  }

  private _cacheInitialTransform(node: TransformNode | AbstractMesh): void {
    if (!this._initialTransforms.has(node)) {
      this._initialTransforms.set(node, {
        position: node.position.clone(),
        rotation: node.rotation.clone(),
        rotationQuaternion: node.rotationQuaternion ? node.rotationQuaternion.clone() : null,
        scaling: node.scaling.clone()
      });
    }
  }

  public toggleDragSelected(enabled: boolean): void {
    if (!this._selectedTarget) return;

    if (enabled) {
      this._cacheInitialTransform(this._selectedTarget);
      if (this._dragBehavior) {
        this._selectedTarget.removeBehavior(this._dragBehavior);
      }

      this._dragBehavior = new PointerDragBehavior();
      this._dragBehavior.onDragStartObservable.add(() => {
        this._camera.detachControl();
      });
      this._dragBehavior.onDragEndObservable.add(() => {
        this._camera.attachControl(this._canvas, true);
      });
      this._selectedTarget.addBehavior(this._dragBehavior);
    } else {
      if (this._dragBehavior && this._selectedTarget) {
        this._selectedTarget.removeBehavior(this._dragBehavior);
      }
      this._dragBehavior = null;
    }
  }

  public resetSelectedPosition(): void {
    if (!this._selectedTarget) return;
    const initial = this._initialTransforms.get(this._selectedTarget);
    if (initial) {
      this._selectedTarget.position.copyFrom(initial.position);
      this._selectedTarget.rotation.copyFrom(initial.rotation);
      if (initial.rotationQuaternion) {
        if (this._selectedTarget.rotationQuaternion) {
          this._selectedTarget.rotationQuaternion.copyFrom(initial.rotationQuaternion);
        } else {
          this._selectedTarget.rotationQuaternion = initial.rotationQuaternion.clone();
        }
      } else {
        this._selectedTarget.rotationQuaternion = null;
      }
      this._selectedTarget.scaling.copyFrom(initial.scaling);
      ensureWorldMatrixUpdated(this._selectedTarget);
    }
  }

  public resetAllTransformsAndMaterials(): void {
    // 1. Restore all positions, rotations, scalings
    this._initialTransforms.forEach((initial, node) => {
      if (node && !node.isDisposed()) {
        node.position.copyFrom(initial.position);
        node.rotation.copyFrom(initial.rotation);
        if (initial.rotationQuaternion) {
          if (node.rotationQuaternion) {
            node.rotationQuaternion.copyFrom(initial.rotationQuaternion);
          } else {
            node.rotationQuaternion = initial.rotationQuaternion.clone();
          }
        } else {
          node.rotationQuaternion = null;
        }
        node.scaling.copyFrom(initial.scaling);
        node.setEnabled(true);
        if (node instanceof AbstractMesh) {
          node.isVisible = true;
          node.visibility = 1.0;
        }
        ensureWorldMatrixUpdated(node);
      }
    });

    // 2. Restore all isolated materials
    this.restoreAllIsolatedMaterials();
    this.clearSelection();
  }

  public clearSelection(): void {
    if (this._dragBehavior && this._selectedTarget) {
      this._selectedTarget.removeBehavior(this._dragBehavior);
      this._dragBehavior = null;
    }
    this._clearHighlight();
    this._selectedTarget = null;
    this._selectedMeshes = [];
    this._rotatingNodes.clear();
  }
}


