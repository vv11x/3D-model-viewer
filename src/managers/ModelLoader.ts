import {
  Scene,
  TransformNode,
  Vector3,
  SceneLoader,
  ShadowGenerator,
  AbstractMesh
} from "@babylonjs/core";
import { ensureWorldMatrixUpdated } from "./CameraManager";

export interface TreeNode {
  name: string;
  type: 'transform' | 'mesh';
  vertices?: number;
  children?: TreeNode[];
  meshName?: string;
}

export class ModelLoader {
  private _scene: Scene;
  private _currentModelRoot: TransformNode | null = null;
  private _cachedModelCenterWorld: Vector3 | null = null;
  private _cachedModelFocusRadius: number | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public get currentModelRoot(): TransformNode | null {
    return this._currentModelRoot;
  }

  public clearCurrentModel(): void {
    if (this._currentModelRoot) {
      this._currentModelRoot.dispose(false, true);
      this._currentModelRoot = null;
    }
    this._cachedModelCenterWorld = null;
    this._cachedModelFocusRadius = null;
  }

  public async loadModelFromFile(
    file: File,
    shadowGenerator: ShadowGenerator | null,
    isShadowsEnabled: boolean
  ): Promise<{ summary: string; animationGroups: any[] }> {
    this.clearCurrentModel();

    const modelRoot = new TransformNode("model_root", this._scene);
    const result = await SceneLoader.ImportMeshAsync("", "", file, this._scene);

    result.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.setParent(modelRoot);
      }
    });

    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;

    result.meshes.forEach((mesh) => {
      if (mesh === modelRoot || mesh.name === "__root__") return;
      if (mesh.getTotalVertices() > 0) {
        ensureWorldMatrixUpdated(mesh);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        hasValidMesh = true;
      }
    });

    if (hasValidMesh) {
      const center = Vector3.Center(min, max);
      const size = max.subtract(min);
      const maxDimension = Math.max(size.x, size.y, size.z);

      const targetSize = 5.0;
      const scale = targetSize / (maxDimension || 1.0);
      const pivot = new Vector3(center.x, min.y, center.z);

      modelRoot.position = pivot.scale(-scale);
      modelRoot.position.y += 0.02;
      modelRoot.scaling = new Vector3(scale, scale, scale);

      this._currentModelRoot = modelRoot;
      modelRoot.getChildMeshes().forEach((m) => ensureWorldMatrixUpdated(m));
    } else {
      this._currentModelRoot = modelRoot;
    }

    result.meshes.forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        if (shadowGenerator) {
          shadowGenerator.addShadowCaster(mesh);
        }
        mesh.receiveShadows = isShadowsEnabled;
      }
    });

    const meshCount = result.meshes.length;
    const vertices = result.meshes.reduce((acc, m) => acc + m.getTotalVertices(), 0);
    const summary = `Model loaded successfully: ${meshCount} meshes, ${vertices.toLocaleString()} vertices.`;

    return {
      summary,
      animationGroups: result.animationGroups
    };
  }

  public getModelCenterWorld(fallbackPosition: Vector3): Vector3 {
    if (this._cachedModelCenterWorld) {
      return this._cachedModelCenterWorld;
    }
    if (!this._currentModelRoot) {
      return fallbackPosition;
    }
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;

    this._currentModelRoot.getChildMeshes().forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        ensureWorldMatrixUpdated(mesh);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        hasValidMesh = true;
      }
    });

    if (hasValidMesh) {
      this._cachedModelCenterWorld = Vector3.Center(min, max);
      return this._cachedModelCenterWorld;
    }
    return this._currentModelRoot.absolutePosition;
  }

  public getModelFocusRadius(computeFitRadiusFn: (center: Vector3, min: Vector3, max: Vector3, margin: number, meshes: AbstractMesh[]) => number): number {
    if (this._cachedModelFocusRadius !== null) {
      return this._cachedModelFocusRadius;
    }
    if (!this._currentModelRoot) return 10.0;

    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;
    const validMeshes: AbstractMesh[] = [];

    this._currentModelRoot.getChildMeshes().forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        ensureWorldMatrixUpdated(mesh);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        validMeshes.push(mesh);
        hasValidMesh = true;
      }
    });

    if (hasValidMesh) {
      const center = Vector3.Center(min, max);
      this._cachedModelFocusRadius = computeFitRadiusFn(center, min, max, 1.15, validMeshes);
      return this._cachedModelFocusRadius;
    }
    return 10.0;
  }

  public showAllMeshes(): void {
    if (this._currentModelRoot) {
      this._currentModelRoot.getChildMeshes().forEach((m) => {
        m.setEnabled(true);
      });
    }
  }

  public getModelHierarchy(): TreeNode[] | null {
    if (!this._currentModelRoot) return null;
    return this._currentModelRoot.getChildren().map((node: any) => this._buildTreeNode(node));
  }

  private _buildTreeNode(node: any): TreeNode {
    const children: any[] = node.getChildren ? node.getChildren() : [];
    const isMesh = node.getClassName && node.getClassName().includes("Mesh");

    if (isMesh && children.length === 0) {
      return {
        name: node.name,
        type: "mesh",
        vertices: node.getTotalVertices(),
        meshName: node.name
      };
    }

    const childNodes: TreeNode[] = [];
    children.forEach((child: any) => {
      childNodes.push(this._buildTreeNode(child));
    });

    if (childNodes.length === 0 && isMesh) {
      return {
        name: node.name,
        type: "mesh",
        vertices: node.getTotalVertices(),
        meshName: node.name
      };
    }

    return {
      name: node.name,
      type: isMesh ? "mesh" : "transform",
      vertices: isMesh ? node.getTotalVertices() : undefined,
      children: childNodes.length > 0 ? childNodes : undefined,
      meshName: isMesh ? node.name : undefined
    };
  }
}
