import {
  AbstractMesh,
  Color3,
  Engine,
  Mesh,
  Observer,
  Scene,
  StandardMaterial
} from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";

/**
 * 10. X-Ray 遮挡穿透透视描边 (X-Ray See-Through Outline)
 * 原理：通过穿透深度测试 (Depth Test Bypass)，当选中的零件被外壳或其它物体遮挡时，被遮挡部分显示半透明透视轮廓
 */
export class XRayOutline implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'xray_seethrough';
  public readonly name: string = 'X-Ray 穿透透视描边';
  public readonly category = 'advanced' as const;
  public readonly description: string = '【高阶着色】当选中的内部零件被外壳遮挡时，透视穿透显示其轮廓位置，复杂机械装配体透视定位必备。';

  private _scene: Scene;
  private _activeMeshes: AbstractMesh[] = [];
  private _xrayClones: Mesh[] = [];
  private _cloneMap: Map<Mesh, Mesh> = new Map();
  private _xrayMaterial: StandardMaterial | null = null;
  private _syncObserver: Observer<Scene> | null = null;
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03, xrayAlpha: 0.6 };
  private readonly _shellScale = 1.002;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  /** Keeps the X-Ray shell glued to the original mesh (drag / rotate / animate). */
  private _syncShells = (): void => {
    this._cloneMap.forEach((orig, clone) => {
      if (orig.isDisposed() || clone.isDisposed()) return;
      if (orig.parent !== clone.parent) clone.parent = orig.parent;
      clone.position.copyFrom(orig.position);
      if (orig.rotationQuaternion) {
        clone.rotationQuaternion = orig.rotationQuaternion.clone();
      } else {
        clone.rotation.copyFrom(orig.rotation);
        clone.rotationQuaternion = null;
      }
      clone.scaling.copyFrom(orig.scaling).scaleInPlace(this._shellScale);
    });
  };

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._currentParams = { ...params };
    this._activeMeshes = [...meshes];

    if (this._activeMeshes.length === 0) return;

    const color = Color3.FromHexString(params.color);
    const alpha = params.xrayAlpha ?? 0.6;

    this._xrayMaterial = new StandardMaterial("xraySeeThroughMat", this._scene);
    this._xrayMaterial.diffuseColor = Color3.Black();
    this._xrayMaterial.emissiveColor = color;
    this._xrayMaterial.specularColor = Color3.Black();
    this._xrayMaterial.alpha = alpha;
    this._xrayMaterial.alphaMode = 2; // Additive blending
    this._xrayMaterial.disableDepthWrite = true;
    this._xrayMaterial.depthFunction = Engine.ALWAYS;
    this._xrayMaterial.backFaceCulling = false;
    this._xrayMaterial.disableLighting = true;

    this._activeMeshes.forEach((mesh) => {
      // 开启常规轮廓
      mesh.renderOutline = true;
      mesh.outlineColor = color;
      mesh.outlineWidth = Math.max(0.005, params.width);

      if (mesh instanceof Mesh) {
        const clone = mesh.clone(`${mesh.name}_xray_shell`, null, true);
        if (clone) {
          clone.parent = mesh.parent;
          clone.position = mesh.position.clone();
          if (mesh.rotationQuaternion) {
            clone.rotationQuaternion = mesh.rotationQuaternion.clone();
          } else {
            clone.rotation = mesh.rotation.clone();
          }
          clone.scaling = mesh.scaling.scale(this._shellScale);
          clone.isPickable = false;
          clone.material = this._xrayMaterial;
          clone.renderingGroupId = 2; // Render on top / through
          this._xrayClones.push(clone);
          this._cloneMap.set(clone, mesh);
        }
      }
    });

    this._syncObserver = this._scene.onBeforeRenderObservable.add(this._syncShells);
  }

  public update(params: OutlineParams): void {
    this._currentParams = { ...this._currentParams, ...params };
    const color = Color3.FromHexString(this._currentParams.color);
    const alpha = this._currentParams.xrayAlpha ?? 0.6;

    if (this._xrayMaterial) {
      this._xrayMaterial.emissiveColor = color;
      this._xrayMaterial.alpha = alpha;
    }

    this._activeMeshes.forEach((mesh) => {
      mesh.outlineColor = color;
      mesh.outlineWidth = Math.max(0.005, this._currentParams.width);
    });
  }

  public clear(): void {
    if (this._syncObserver) {
      this._scene.onBeforeRenderObservable.remove(this._syncObserver);
      this._syncObserver = null;
    }
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOutline = false;
    });

    this._xrayClones.forEach((clone) => {
      if (!clone.isDisposed()) {
        clone.dispose(false, false);
      }
    });
    this._xrayClones = [];
    this._cloneMap.clear();

    if (this._xrayMaterial) {
      this._xrayMaterial.dispose();
      this._xrayMaterial = null;
    }
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}
