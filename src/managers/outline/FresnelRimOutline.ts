import {
  AbstractMesh,
  Color3,
  FresnelParameters,
  Mesh,
  Observer,
  Scene,
  StandardMaterial
} from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";

/**
 * 9. 菲涅尔边缘掠射着色法 (Fresnel Rim Light Silhouette)
 * 原理：在片元着色器中计算表面法线与视线向量的点积 pow(1.0 - max(0.0, dot(N, V)), power)，呈现科幻边缘掠射光
 */
export class FresnelRimOutline implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'fresnel_rim';
  public readonly name: string = '菲涅尔掠射轮廓光';
  public readonly category = 'advanced' as const;
  public readonly description: string = '【高阶着色】通过视线与法线夹角 pow(1.0 - N·V, p) 计算边缘掠射光。科幻全息投影感与半透外缘高光。';

  private _scene: Scene;
  private _activeMeshes: AbstractMesh[] = [];
  private _rimClones: Mesh[] = [];
  private _cloneMap: Map<Mesh, Mesh> = new Map();
  private _rimMaterial: StandardMaterial | null = null;
  private _syncObserver: Observer<Scene> | null = null;
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03, fresnelPower: 3.0 };
  private readonly _shellScale = 1.008;

  constructor(scene: Scene) {
    this._scene = scene;
  }

  /** Keeps the rim shell glued to the original mesh (drag / rotate / animate). */
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
    const power = params.fresnelPower ?? 3.0;

    // 创建菲涅尔发光材质
    this._rimMaterial = new StandardMaterial("fresnelRimMat", this._scene);
    this._rimMaterial.diffuseColor = Color3.Black();
    this._rimMaterial.emissiveColor = color;
    this._rimMaterial.specularColor = Color3.Black();
    this._rimMaterial.alpha = 0.85;
    this._rimMaterial.alphaMode = 2; // Additive blending
    this._rimMaterial.backFaceCulling = false;
    this._rimMaterial.disableLighting = true;

    // Emissive Fresnel Parameters
    const emissiveFresnel = new FresnelParameters();
    emissiveFresnel.bias = 0.1;
    emissiveFresnel.power = power;
    emissiveFresnel.leftColor = color;
    emissiveFresnel.rightColor = Color3.Black();
    this._rimMaterial.emissiveFresnelParameters = emissiveFresnel;

    // Opacity Fresnel Parameters for holographic see-through in center
    const opacityFresnel = new FresnelParameters();
    opacityFresnel.bias = 0.05;
    opacityFresnel.power = power;
    opacityFresnel.leftColor = Color3.White();
    opacityFresnel.rightColor = Color3.Black();
    this._rimMaterial.opacityFresnelParameters = opacityFresnel;

    // 开启网格轮廓 + 菲涅尔全息叠加外壳
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOutline = true;
      mesh.outlineColor = color;
      mesh.outlineWidth = Math.max(0.005, params.width);

      if (mesh instanceof Mesh) {
        const clone = mesh.clone(`${mesh.name}_rim_shell`, null, true);
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
          clone.material = this._rimMaterial;
          clone.renderingGroupId = 1;
          this._rimClones.push(clone);
          this._cloneMap.set(clone, mesh);
        }
      }
    });

    this._syncObserver = this._scene.onBeforeRenderObservable.add(this._syncShells);
    this.update(params);
  }

  public update(params: OutlineParams): void {
    this._currentParams = { ...this._currentParams, ...params };
    const color = Color3.FromHexString(this._currentParams.color);
    const power = this._currentParams.fresnelPower ?? 3.0;

    if (this._rimMaterial) {
      this._rimMaterial.emissiveColor = color;
      if (this._rimMaterial.emissiveFresnelParameters) {
        this._rimMaterial.emissiveFresnelParameters.leftColor = color;
        this._rimMaterial.emissiveFresnelParameters.power = power;
      }
      if (this._rimMaterial.opacityFresnelParameters) {
        this._rimMaterial.opacityFresnelParameters.power = power;
      }
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

    this._rimClones.forEach((clone) => {
      if (!clone.isDisposed()) {
        clone.dispose(false, false);
      }
    });
    this._rimClones = [];
    this._cloneMap.clear();

    if (this._rimMaterial) {
      this._rimMaterial.dispose();
      this._rimMaterial = null;
    }
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}
