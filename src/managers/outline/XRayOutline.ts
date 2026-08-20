import {
  AbstractMesh,
  Color3,
  Mesh,
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
  private _xrayMaterial: StandardMaterial | null = null;
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03, xrayAlpha: 0.6 };

  constructor(scene: Scene) {
    this._scene = scene;
  }

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
          clone.isPickable = false;
          clone.material = this._xrayMaterial;
          clone.renderingGroupId = 2; // Render on top / through
          clone.scaling.scaleInPlace(1.002);
          this._xrayClones.push(clone);
        }
      }
    });
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
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOutline = false;
    });

    this._xrayClones.forEach((clone) => {
      clone.dispose(false, true);
    });
    this._xrayClones = [];

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
