import { AbstractMesh, Camera, Scene } from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";
import {
  NativeOutlineRenderer,
  NativeOverlayRenderer,
  NativeEdgesRenderer,
  NativeBoundingBoxRenderer,
  NativeHighlightRenderer,
  NativeGlowRenderer,
  NativeWireframeRenderer
} from "./NativeOutlineRenderers";
import { SobelMaskOutline } from "./SobelMaskOutline";
import { FresnelRimOutline } from "./FresnelRimOutline";
import { XRayOutline } from "./XRayOutline";
import { StencilOutline } from "./StencilOutline";

export class OutlineManager {
  private _scene: Scene;
  private _camera: Camera;
  private _renderers: Map<OutlineAlgorithmType, IOutlineRenderer> = new Map();
  private _activeAlgorithm: OutlineAlgorithmType = 'native_highlight';
  private _currentMeshes: AbstractMesh[] = [];
  private _isEnabled: boolean = true;

  private _params: OutlineParams = {
    color: "#00f2fe",
    width: 0.03,
    overlayAlpha: 0.45,
    edgeAngle: 25,
    depthThreshold: 0.25,
    fresnelPower: 3.0,
    xrayAlpha: 0.6,
    glowIntensity: 1.2
  };

  constructor(scene: Scene, camera: Camera) {
    this._scene = scene;
    this._camera = camera;
    this._initRenderers();
  }

  private _initRenderers(): void {
    // 官方原生 7 大系统
    const r1 = new NativeOutlineRenderer();
    const r2 = new NativeOverlayRenderer();
    const r3 = new NativeEdgesRenderer();
    const r4 = new NativeBoundingBoxRenderer(this._scene);
    const r5 = new NativeHighlightRenderer(this._scene);
    const r6 = new NativeGlowRenderer(this._scene);
    const r7 = new NativeWireframeRenderer();

    // 高阶图形学 4 大系统
    const r8 = new SobelMaskOutline(this._scene, this._camera);
    const r9 = new FresnelRimOutline(this._scene);
    const r10 = new XRayOutline(this._scene);
    const r11 = new StencilOutline(this._scene);

    const all = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11];
    all.forEach((r) => this._renderers.set(r.id, r));
  }

  public getAlgorithms(): { id: OutlineAlgorithmType; name: string; category: 'official' | 'advanced'; description: string }[] {
    return Array.from(this._renderers.values()).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description
    }));
  }

  public get activeAlgorithm(): OutlineAlgorithmType {
    return this._activeAlgorithm;
  }

  public setAlgorithm(type: OutlineAlgorithmType): void {
    if (this._activeAlgorithm === type) return;

    // 清理前一个算法
    const prev = this._renderers.get(this._activeAlgorithm);
    if (prev) {
      prev.clear();
    }

    this._activeAlgorithm = type;

    // 应用新算法
    if (this._isEnabled && this._currentMeshes.length > 0) {
      const next = this._renderers.get(this._activeAlgorithm);
      if (next) {
        next.apply(this._currentMeshes, this._params);
      }
    }
  }

  public applyHighlight(meshes: AbstractMesh[]): void {
    this._currentMeshes = [...meshes];
    if (!this._isEnabled || this._currentMeshes.length === 0) {
      this.clearHighlight();
      return;
    }

    const renderer = this._renderers.get(this._activeAlgorithm);
    if (renderer) {
      renderer.apply(this._currentMeshes, this._params);
    }
  }

  public clearHighlight(): void {
    const renderer = this._renderers.get(this._activeAlgorithm);
    if (renderer) {
      renderer.clear();
    }
  }

  public setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    if (enabled) {
      this.applyHighlight(this._currentMeshes);
    } else {
      this.clearHighlight();
    }
  }

  public isEnabled(): boolean {
    return this._isEnabled;
  }

  public setParams(partial: Partial<OutlineParams>): void {
    this._params = { ...this._params, ...partial };
    if (this._isEnabled && this._currentMeshes.length > 0) {
      const renderer = this._renderers.get(this._activeAlgorithm);
      if (renderer) {
        renderer.update(this._params);
      }
    }
  }

  public getParams(): OutlineParams {
    return { ...this._params };
  }

  public dispose(): void {
    this._renderers.forEach((r) => r.dispose());
    this._renderers.clear();
    this._currentMeshes = [];
  }
}
