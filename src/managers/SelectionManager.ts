import {
  Scene,
  Engine,
  ArcRotateCamera,
  AbstractMesh,
  StandardMaterial,
  RenderTargetTexture,
  PostProcess,
  Effect,
  Color3,
  Color4,
  Texture,
  PointerDragBehavior,
  Vector3,
  Quaternion,
  type Nullable,
  type Material,
  TransformNode
} from "@babylonjs/core";
import { ensureWorldMatrixUpdated } from "./CameraManager";

export class SelectionManager {
  private _scene: Scene;
  private _engine: Engine;
  private _camera: ArcRotateCamera;
  private _canvas: HTMLCanvasElement;

  private _selectedMesh: AbstractMesh | null = null;
  private _rotatingMeshes: Set<AbstractMesh> = new Set();
  private _selectionHighlightEnabled: boolean = false;

  private _selectionMaskRTT: RenderTargetTexture | null = null;
  private _sobelOutline: PostProcess | null = null;
  private _maskMatSelected!: StandardMaterial;
  private _maskMatBackground!: StandardMaterial;
  private _outlinedMeshIds: Set<number> = new Set();
  private _outlineColorHex = "#00f5ff";

  private _dragBehavior: PointerDragBehavior | null = null;
  private _initialTransforms: Map<AbstractMesh, {
    position: Vector3;
    rotation: Vector3;
    rotationQuaternion: Nullable<Quaternion>;
    scaling: Vector3;
  }> = new Map();

  constructor(scene: Scene, engine: Engine, camera: ArcRotateCamera, canvas: HTMLCanvasElement) {
    this._scene = scene;
    this._engine = engine;
    this._camera = camera;
    this._canvas = canvas;

    this._initShadersAndPostProcess();
    this._registerRenderObserver();
  }

  private _registerRenderObserver(): void {
    this._scene.onBeforeRenderObservable.add(() => {
      this._rotatingMeshes.forEach((mesh) => {
        mesh.rotate(Vector3.Up(), 0.02);
      });
    });
  }

  private _initShadersAndPostProcess(): void {
    if (!Effect.ShadersStore["sobelOutlineVertexShader"]) {
      Effect.ShadersStore["sobelOutlineVertexShader"] = `
precision highp float;
attribute vec2 position;
varying vec2 vUV;
void main(void) {
    vUV = (position + 1.0) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;
    }

    if (!Effect.ShadersStore["sobelOutlineFragmentShader"]) {
      Effect.ShadersStore["sobelOutlineFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D maskSampler;
uniform vec2 screenSize;
uniform vec3 outlineColor;
uniform float threshold;
uniform float outlineWidth;

void main(void) {
    vec4 baseColor = texture2D(textureSampler, vUV);
    vec2 texel = (outlineWidth / screenSize);

    float m00 = texture2D(maskSampler, vUV + texel * vec2(-1.0, -1.0)).r;
    float m10 = texture2D(maskSampler, vUV + texel * vec2( 0.0, -1.0)).r;
    float m20 = texture2D(maskSampler, vUV + texel * vec2( 1.0, -1.0)).r;
    float m01 = texture2D(maskSampler, vUV + texel * vec2(-1.0,  0.0)).r;
    float m11 = texture2D(maskSampler, vUV + texel * vec2( 0.0,  0.0)).r;
    float m21 = texture2D(maskSampler, vUV + texel * vec2( 1.0,  0.0)).r;
    float m02 = texture2D(maskSampler, vUV + texel * vec2(-1.0,  1.0)).r;
    float m12 = texture2D(maskSampler, vUV + texel * vec2( 0.0,  1.0)).r;
    float m22 = texture2D(maskSampler, vUV + texel * vec2( 1.0,  1.0)).r;

    float gx = (-m00 + m20) + (-2.0 * m01 + 2.0 * m21) + (-m02 + m22);
    float gy = (-m00 - 2.0 * m10 - m20) + (m02 + 2.0 * m12 + m22);
    float mag = sqrt(gx * gx + gy * gy);

    float sel = step(0.5, m11);
    float edge = step(threshold, mag);
    float outline = sel * edge;

    vec3 rgb = mix(baseColor.rgb, outlineColor, outline);
    gl_FragColor = vec4(rgb, baseColor.a);
}
`;
    }

    this._maskMatSelected = new StandardMaterial("mask_selected", this._scene);
    this._maskMatSelected.disableLighting = true;
    this._maskMatSelected.emissiveColor = Color3.White();
    this._maskMatSelected.diffuseColor = Color3.White();
    this._maskMatSelected.specularColor = Color3.Black();

    this._maskMatBackground = new StandardMaterial("mask_background", this._scene);
    this._maskMatBackground.disableLighting = true;
    this._maskMatBackground.emissiveColor = Color3.Black();
    this._maskMatBackground.diffuseColor = Color3.Black();
    this._maskMatBackground.specularColor = Color3.Black();

    this._selectionMaskRTT = new RenderTargetTexture(
      "selection_mask",
      { width: this._engine.getRenderWidth(), height: this._engine.getRenderHeight() },
      this._scene,
      false,
      true,
      Engine.TEXTURETYPE_UNSIGNED_INT,
      false,
      Texture.NEAREST_SAMPLINGMODE
    );
    this._selectionMaskRTT.clearColor = new Color4(0, 0, 0, 1);

    const materialBackup = new Map<any, Nullable<Material>>();
    this._selectionMaskRTT.onBeforeRenderObservable.add(() => {
      materialBackup.clear();
      const list = this._selectionMaskRTT?.renderList ?? [];
      for (const mesh of list) {
        if (!mesh || !mesh.isEnabled() || !mesh.isVisible) continue;
        const targetMesh = mesh.getClassName() === "InstancedMesh" ? (mesh as any).sourceMesh : mesh;
        if (!targetMesh) continue;

        if (!materialBackup.has(targetMesh)) {
          materialBackup.set(targetMesh, targetMesh.material);
          targetMesh.material = this._maskMatSelected;
        }
      }
    });

    this._selectionMaskRTT.onAfterRenderObservable.add(() => {
      materialBackup.forEach((originalMaterial, targetMesh) => {
        if (targetMesh) {
          targetMesh.material = originalMaterial;
        }
      });
      materialBackup.clear();
    });

    this._sobelOutline = new PostProcess(
      "sobel_outline",
      "sobelOutline",
      ["screenSize", "outlineColor", "threshold", "outlineWidth"],
      ["maskSampler"],
      1.0,
      this._camera
    );

    this._sobelOutline.onApply = (effect) => {
      if (this._selectionMaskRTT) effect.setTexture("maskSampler", this._selectionMaskRTT);
      effect.setFloat2("screenSize", this._engine.getRenderWidth(), this._engine.getRenderHeight());
      effect.setFloat("threshold", 1);
      effect.setFloat("outlineWidth", 5);
      effect.setColor3("outlineColor", Color3.FromHexString(this._outlineColorHex));
    };

    if (this._sobelOutline) {
      this._camera.detachPostProcess(this._sobelOutline);
    }
  }

  public get selectedMesh(): AbstractMesh | null {
    return this._selectedMesh;
  }

  public selectMeshByName(meshName: string | null): { name: string; vertices: number; parent: string } | null {
    if (this._dragBehavior && this._selectedMesh) {
      this._selectedMesh.removeBehavior(this._dragBehavior);
      this._dragBehavior = null;
    }

    if (this._selectedMesh) {
      this._outlinedMeshIds.delete(this._selectedMesh.uniqueId);
      this._selectedMesh = null;
    }

    if (!meshName) {
      this.updateSelectionMaskRenderList(null);
      return null;
    }

    const mesh = this._scene.getMeshByName(meshName);
    if (!mesh) {
      this.updateSelectionMaskRenderList(null);
      throw new Error(`Mesh "${meshName}" was not found in the scene.`);
    }

    this._selectedMesh = mesh;
    ensureWorldMatrixUpdated(mesh);

    if (this._selectionHighlightEnabled) {
      this._outlinedMeshIds.add(mesh.uniqueId);
    }

    return {
      name: mesh.name,
      vertices: mesh.getTotalVertices(),
      parent: mesh.parent ? mesh.parent.name : "无"
    };
  }

  public setSelectionHighlight(enabled: boolean, modelRoot: TransformNode | null): void {
    this._selectionHighlightEnabled = enabled;
    if (this._selectedMesh) {
      if (enabled) {
        this._outlinedMeshIds.add(this._selectedMesh.uniqueId);
      } else {
        this._outlinedMeshIds.delete(this._selectedMesh.uniqueId);
      }
      this.updateSelectionMaskRenderList(modelRoot);
    }
  }

  public updateSelectionMaskRenderList(modelRoot: TransformNode | null): void {
    if (!this._selectionMaskRTT) return;

    const list: AbstractMesh[] = [];
    if (modelRoot) {
      modelRoot.getChildMeshes().forEach((mesh) => {
        if (this._outlinedMeshIds.has(mesh.uniqueId)) {
          list.push(mesh);
        }
      });
    }
    this._selectionMaskRTT.renderList = list;

    if (list.length > 0) {
      if (this._scene.customRenderTargets.indexOf(this._selectionMaskRTT) === -1) {
        this._scene.customRenderTargets.push(this._selectionMaskRTT);
      }
      if (this._sobelOutline) {
        this._camera.attachPostProcess(this._sobelOutline);
      }
    } else {
      const idx = this._scene.customRenderTargets.indexOf(this._selectionMaskRTT);
      if (idx !== -1) {
        this._scene.customRenderTargets.splice(idx, 1);
      }
      if (this._sobelOutline) {
        this._camera.detachPostProcess(this._sobelOutline);
      }
    }
  }

  public setSelectedMeshVisible(visible: boolean): void {
    if (!this._selectedMesh) {
      throw new Error("Cannot set mesh visibility: No mesh is currently selected.");
    }
    this._selectedMesh.setEnabled(visible);
  }

  public isSelectedMeshVisible(): boolean {
    return this._selectedMesh ? this._selectedMesh.isEnabled() : true;
  }

  public setSelectedMeshAlpha(alpha: number): void {
    if (!this._selectedMesh) {
      throw new Error("Cannot set mesh alpha: No mesh is currently selected.");
    }
    if (!this._selectedMesh.material) {
      throw new Error(`Cannot set mesh alpha: Selected mesh "${this._selectedMesh.name}" has no material.`);
    }

    const mat = this._selectedMesh.material;
    if (!(mat as any)._savedTransparency) {
      (mat as any)._savedTransparency = {
        transparencyMode: mat.transparencyMode,
        needDepthPrePass: mat.needDepthPrePass,
        alphaMode: mat.alphaMode
      };
    }
    mat.alpha = alpha;
    if (alpha < 1.0) {
      mat.transparencyMode = 2;
      mat.needDepthPrePass = true;
    } else {
      const saved = (mat as any)._savedTransparency;
      mat.transparencyMode = saved.transparencyMode;
      mat.needDepthPrePass = saved.needDepthPrePass;
      mat.alphaMode = saved.alphaMode;
    }
  }

  public getSelectedMeshAlpha(): number {
    if (!this._selectedMesh) {
      throw new Error("Cannot get mesh alpha: No mesh is currently selected.");
    }
    if (!this._selectedMesh.material) {
      throw new Error(`Cannot get mesh alpha: Selected mesh "${this._selectedMesh.name}" has no material.`);
    }
    return this._selectedMesh.material.alpha;
  }

  public toggleSelectedMeshRotation(enabled: boolean): void {
    if (!this._selectedMesh) {
      throw new Error("Cannot toggle mesh rotation: No mesh is currently selected.");
    }
    if (enabled) {
      this._rotatingMeshes.add(this._selectedMesh);
    } else {
      this._rotatingMeshes.delete(this._selectedMesh);
    }
  }

  public isSelectedMeshRotating(): boolean {
    if (!this._selectedMesh) {
      throw new Error("Cannot check mesh rotation: No mesh is currently selected.");
    }
    return this._rotatingMeshes.has(this._selectedMesh);
  }

  private _cacheInitialTransform(mesh: AbstractMesh): void {
    if (!this._initialTransforms.has(mesh)) {
      this._initialTransforms.set(mesh, {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        scaling: mesh.scaling.clone()
      });
    }
  }

  public toggleDragSelectedMesh(enabled: boolean): void {
    if (!this._selectedMesh) return;

    if (enabled) {
      this._cacheInitialTransform(this._selectedMesh);
      if (this._dragBehavior) {
        this._selectedMesh.removeBehavior(this._dragBehavior);
      }

      this._dragBehavior = new PointerDragBehavior();
      this._dragBehavior.onDragStartObservable.add(() => {
        this._camera.detachControl();
      });
      this._dragBehavior.onDragEndObservable.add(() => {
        this._camera.attachControl(this._canvas, true);
      });
      this._selectedMesh.addBehavior(this._dragBehavior);
    } else {
      if (this._dragBehavior && this._selectedMesh) {
        this._selectedMesh.removeBehavior(this._dragBehavior);
      }
      this._dragBehavior = null;
    }
  }

  public resetSelectedMeshPosition(): void {
    if (!this._selectedMesh) return;
    const initial = this._initialTransforms.get(this._selectedMesh);
    if (initial) {
      this._selectedMesh.position.copyFrom(initial.position);
      this._selectedMesh.rotation.copyFrom(initial.rotation);
      if (initial.rotationQuaternion) {
        if (this._selectedMesh.rotationQuaternion) {
          this._selectedMesh.rotationQuaternion.copyFrom(initial.rotationQuaternion);
        } else {
          this._selectedMesh.rotationQuaternion = initial.rotationQuaternion.clone();
        }
      } else {
        this._selectedMesh.rotationQuaternion = null;
      }
      this._selectedMesh.scaling.copyFrom(initial.scaling);
      ensureWorldMatrixUpdated(this._selectedMesh);
    }
  }

  public clearSelection(): void {
    this._selectedMesh = null;
    this._rotatingMeshes.clear();
    this._outlinedMeshIds.clear();
    this._initialTransforms.clear();
    if (this._selectionMaskRTT) {
      this._selectionMaskRTT.renderList = [];
    }
  }
}
