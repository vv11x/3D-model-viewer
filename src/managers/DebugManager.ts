import {
  AbstractMesh,
  Color3,
  Color4,
  Effect,
  Mesh,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";

export type ShadingMode = 'pbr' | 'wireframe' | 'normals' | 'clay';

export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  totalVertices: number;
  totalFaces: number;
  frameTimeMs: number;
}

export class DebugManager {
  private _scene: Scene;
  private _activeShadingMode: ShadingMode = 'pbr';
  private _axisNode: TransformNode | null = null;
  private _sceneBoundingBoxMesh: Mesh | null = null;
  private _isAxisGizmoVisible: boolean = false;
  private _isSceneBoundingBoxVisible: boolean = false;

  // Cached materials for restoring PBR rendering
  private _originalMeshMaterials: Map<AbstractMesh, any> = new Map();
  private _clayMaterial: StandardMaterial | null = null;
  private _normalsMaterial: ShaderMaterial | null = null;

  constructor(scene: Scene) {
    this._scene = scene;
    this._initDebugMaterials();
  }

  private _initDebugMaterials(): void {
    // 1. Clay / Unlit Material (Neutral studio clay look)
    this._clayMaterial = new StandardMaterial("debug_clay_mat", this._scene);
    this._clayMaterial.diffuseColor = new Color3(0.82, 0.82, 0.85);
    this._clayMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
    this._clayMaterial.ambientColor = new Color3(0.5, 0.5, 0.5);

    // 2. Normals Visualization Material (world-space normal -> RGB)
    Effect.ShadersStore["normalVisVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vNormalW;
      void main(void) {
        vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
    Effect.ShadersStore["normalVisFragmentShader"] = `
      precision highp float;
      varying vec3 vNormalW;
      void main(void) {
        vec3 n = normalize(vNormalW);
        gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
      }
    `;
    this._normalsMaterial = new ShaderMaterial(
      "debug_normals_mat",
      this._scene,
      { vertex: "normalVis", fragment: "normalVis" },
      { attributes: ["position", "normal"], uniforms: ["world", "worldViewProjection"] }
    );
  }

  /**
   * Switches full-scene shading mode: PBR, Wireframe, Normals, Clay.
   */
  public setShadingMode(mode: ShadingMode): void {
    if (this._activeShadingMode === mode) return;
    this._activeShadingMode = mode;

    const meshes = this._scene.meshes.filter((m) => {
      const name = m.name;
      if (
        name.startsWith("debug_") ||
        name.startsWith("axis_") ||
        name.startsWith("grid_") ||
        name === "gridLines" ||
        name === "shadowGround" ||
        name === "ground" ||
        name.endsWith("_rim_shell") ||
        name.endsWith("_xray_shell") ||
        name.endsWith("_stencil_shell")
      ) {
        return false;
      }
      return m.getTotalVertices() > 0;
    });

    if (mode === 'pbr') {
      // Restore original materials & wireframe off
      meshes.forEach((mesh) => {
        mesh.material = this._originalMeshMaterials.get(mesh) ?? mesh.material;
        if (mesh.material) {
          mesh.material.wireframe = false;
        }
      });
    } else if (mode === 'wireframe') {
      // Enable wireframe on all meshes
      meshes.forEach((mesh) => {
        if (!this._originalMeshMaterials.has(mesh) && mesh.material) {
          this._originalMeshMaterials.set(mesh, mesh.material);
        }
        if (mesh.material) {
          mesh.material.wireframe = true;
        }
      });
    } else if (mode === 'clay') {
      // Apply clay studio material
      meshes.forEach((mesh) => {
        if (!this._originalMeshMaterials.has(mesh) && mesh.material) {
          this._originalMeshMaterials.set(mesh, mesh.material);
        }
        if (this._clayMaterial) {
          this._clayMaterial.wireframe = false;
          mesh.material = this._clayMaterial;
        }
      });
    } else if (mode === 'normals') {
      // Apply normals preview material
      meshes.forEach((mesh) => {
        if (!this._originalMeshMaterials.has(mesh) && mesh.material) {
          this._originalMeshMaterials.set(mesh, mesh.material);
        }
        if (this._normalsMaterial) {
          this._normalsMaterial.wireframe = false;
          mesh.material = this._normalsMaterial;
        }
      });
    }
  }

  public get activeShadingMode(): ShadingMode {
    return this._activeShadingMode;
  }

  /**
   * Toggles XYZ World/Model Axis Gizmo.
   */
  public setAxisGizmoVisible(visible: boolean, targetCenter?: Vector3, size: number = 2): void {
    this._isAxisGizmoVisible = visible;

    if (!visible) {
      if (this._axisNode) {
        this._axisNode.dispose();
        this._axisNode = null;
      }
      return;
    }

    if (this._axisNode) {
      this._axisNode.dispose();
    }

    this._axisNode = new TransformNode("debug_axis_root", this._scene);
    if (targetCenter) {
      this._axisNode.position = targetCenter.clone();
    }

    // X Axis (Red)
    const axisX = MeshBuilder.CreateLines("debug_axisX", {
      points: [Vector3.Zero(), new Vector3(size, 0, 0)],
      colors: [new Color4(1, 0.2, 0.2, 1), new Color4(1, 0.2, 0.2, 1)]
    }, this._scene);
    axisX.parent = this._axisNode;

    // Y Axis (Green)
    const axisY = MeshBuilder.CreateLines("debug_axisY", {
      points: [Vector3.Zero(), new Vector3(0, size, 0)],
      colors: [new Color4(0.2, 1, 0.3, 1), new Color4(0.2, 1, 0.3, 1)]
    }, this._scene);
    axisY.parent = this._axisNode;

    // Z Axis (Blue)
    const axisZ = MeshBuilder.CreateLines("debug_axisZ", {
      points: [Vector3.Zero(), new Vector3(0, 0, size)],
      colors: [new Color4(0.2, 0.5, 1, 1), new Color4(0.2, 0.5, 1, 1)]
    }, this._scene);
    axisZ.parent = this._axisNode;
  }

  public isAxisGizmoVisible(): boolean {
    return this._isAxisGizmoVisible;
  }

  /**
   * Toggles Model Overall Bounding Box lines in 3D scene.
   */
  public setSceneBoundingBoxVisible(visible: boolean, min?: Vector3, max?: Vector3): void {
    this._isSceneBoundingBoxVisible = visible;

    if (!visible || !min || !max) {
      if (this._sceneBoundingBoxMesh) {
        this._sceneBoundingBoxMesh.dispose();
        this._sceneBoundingBoxMesh = null;
      }
      return;
    }

    if (this._sceneBoundingBoxMesh) {
      this._sceneBoundingBoxMesh.dispose();
    }

    const corners = [
      new Vector3(min.x, min.y, min.z),
      new Vector3(max.x, min.y, min.z),
      new Vector3(max.x, min.y, max.z),
      new Vector3(min.x, min.y, max.z),
      new Vector3(min.x, max.y, min.z),
      new Vector3(max.x, max.y, min.z),
      new Vector3(max.x, max.y, max.z),
      new Vector3(min.x, max.y, max.z)
    ];

    const lines = [
      [corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]], // Bottom
      [corners[4], corners[5]], [corners[5], corners[6]], [corners[6], corners[7]], [corners[7], corners[4]], // Top
      [corners[0], corners[4]], [corners[1], corners[5]], [corners[2], corners[6]], [corners[3], corners[7]]  // Verticals
    ];

    const lineMesh = MeshBuilder.CreateLineSystem("debug_scene_bbox", { lines }, this._scene);
    lineMesh.color = new Color3(0, 0.95, 1);
    this._sceneBoundingBoxMesh = lineMesh;
  }

  public isSceneBoundingBoxVisible(): boolean {
    return this._isSceneBoundingBoxVisible;
  }

  /**
   * Retrieves real-time rendering and engine performance statistics.
   */
  public getPerformanceStats(): PerformanceStats {
    const engine = this._scene.getEngine();
    const fps = Math.round(engine.getFps());
    const drawCalls = (engine as any)._drawCalls?.current ?? (this._scene.getActiveMeshes ? this._scene.getActiveMeshes().length : 0);
    const activeIndices = this._scene.getActiveIndices();
    const activeMeshes = this._scene.getActiveMeshes ? this._scene.getActiveMeshes().length : 0;
    const totalVertices = this._scene.getTotalVertices();
    const totalFaces = Math.round(activeIndices / 3);
    const deltaTime = typeof engine.getDeltaTime === 'function' ? engine.getDeltaTime() : ((engine as any).deltaTime || 0);
    const frameTimeMs = parseFloat(deltaTime.toFixed(1));

    return {
      fps,
      drawCalls,
      activeMeshes,
      totalVertices,
      totalFaces,
      frameTimeMs
    };
  }

  public cacheMeshMaterial(mesh: AbstractMesh): void {
    if (mesh.material && !this._originalMeshMaterials.has(mesh)) {
      this._originalMeshMaterials.set(mesh, mesh.material);
    }
  }

  public clear(): void {
    if (this._axisNode) {
      this._axisNode.dispose();
      this._axisNode = null;
    }
    if (this._sceneBoundingBoxMesh) {
      this._sceneBoundingBoxMesh.dispose();
      this._sceneBoundingBoxMesh = null;
    }
    this._originalMeshMaterials.clear();
    this._activeShadingMode = 'pbr';
  }

  public dispose(): void {
    this.clear();
    if (this._clayMaterial) {
      this._clayMaterial.dispose();
      this._clayMaterial = null;
    }
    if (this._normalsMaterial) {
      this._normalsMaterial.dispose();
      this._normalsMaterial = null;
    }
  }
}
