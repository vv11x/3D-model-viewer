import {
  AbstractMesh,
  Color3,
  Engine,
  Mesh,
  Scene,
  StandardMaterial
} from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";

/**
 * 11. Stencil 硬件模板缓冲剪裁法 (Stencil Buffer Silhouette Mask)
 * 原理：利用 GPU 模板测试 (Stencil Test)，仅在模板缓冲区外部绘制等距外扩的纯色轮廓，内部无重叠遮挡
 */
export class StencilOutline implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'stencil_mask';
  public readonly name: string = 'Stencil 模板剪裁法';
  public readonly category = 'advanced' as const;
  public readonly description: string = '【高阶着色】利用硬件 Stencil 模板测试进行像素级内外剪裁。纯色刀刻般锐利，RTS 单位选中框风格。';

  private _scene: Scene;
  private _activeMeshes: AbstractMesh[] = [];
  private _outlineClones: Mesh[] = [];
  private _stencilMaterial: StandardMaterial | null = null;
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03 };

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._currentParams = { ...params };
    this._activeMeshes = [...meshes];

    if (this._activeMeshes.length === 0) return;

    const color = Color3.FromHexString(params.color);
    const scalingOffset = 1.0 + Math.max(0.015, params.width * 1.2);

    // 1. 创建纯色无光照模板材质
    this._stencilMaterial = new StandardMaterial("stencilOutlineMat", this._scene);
    this._stencilMaterial.diffuseColor = color;
    this._stencilMaterial.emissiveColor = color;
    this._stencilMaterial.disableLighting = true;
    this._stencilMaterial.backFaceCulling = false;

    // 2. 开启引擎 Stencil 测试
    const engine = this._scene.getEngine();
    engine.setStencilBuffer(true);

    // 3. 原网格写入 Stencil Ref = 1
    this._activeMeshes.forEach((origMesh) => {
      origMesh.renderingGroupId = 0;
      if (origMesh.material) {
        origMesh.material.stencil.enabled = true;
        origMesh.material.stencil.func = Engine.ALWAYS;
        origMesh.material.stencil.funcRef = 1;
        origMesh.material.stencil.funcMask = 0xff;
        origMesh.material.stencil.opStencilFail = Engine.KEEP;
        origMesh.material.stencil.opDepthFail = Engine.KEEP;
        origMesh.material.stencil.opStencilDepthPass = Engine.REPLACE;
      }

      // 4. 创建外扩 Shell，仅当 Stencil != 1 时绘制
      if (origMesh instanceof Mesh) {
        const clone = origMesh.clone(`${origMesh.name}_stencil_shell`, null, true);
        if (clone) {
          clone.parent = origMesh.parent;
          clone.position = origMesh.position.clone();
          if (origMesh.rotationQuaternion) {
            clone.rotationQuaternion = origMesh.rotationQuaternion.clone();
          } else {
            clone.rotation = origMesh.rotation.clone();
          }
          clone.scaling = origMesh.scaling.scale(scalingOffset);
          clone.isPickable = false;
          clone.material = this._stencilMaterial;
          clone.renderingGroupId = 1;

          if (this._stencilMaterial) {
            this._stencilMaterial.stencil.enabled = true;
            this._stencilMaterial.stencil.func = Engine.NOTEQUAL;
            this._stencilMaterial.stencil.funcRef = 1;
            this._stencilMaterial.stencil.funcMask = 0xff;
            this._stencilMaterial.stencil.opStencilFail = Engine.KEEP;
            this._stencilMaterial.stencil.opDepthFail = Engine.KEEP;
            this._stencilMaterial.stencil.opStencilDepthPass = Engine.KEEP;
          }

          this._outlineClones.push(clone);
        }
      }
    });
  }

  public update(params: OutlineParams): void {
    this._currentParams = { ...this._currentParams, ...params };
    const color = Color3.FromHexString(this._currentParams.color);
    const scalingOffset = 1.0 + Math.max(0.015, this._currentParams.width * 1.2);

    if (this._stencilMaterial) {
      this._stencilMaterial.diffuseColor = color;
      this._stencilMaterial.emissiveColor = color;
    }

    this._outlineClones.forEach((clone, idx) => {
      const orig = this._activeMeshes[idx];
      if (orig) {
        clone.scaling = orig.scaling.scale(scalingOffset);
      }
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((origMesh) => {
      if (origMesh.material) {
        origMesh.material.stencil.enabled = false;
      }
    });

    this._outlineClones.forEach((clone) => {
      clone.dispose(false, true);
    });
    this._outlineClones = [];

    if (this._stencilMaterial) {
      this._stencilMaterial.dispose();
      this._stencilMaterial = null;
    }
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}
