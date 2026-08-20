import {
  AbstractMesh,
  Color3,
  Effect,
  Mesh,
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
  private _rimMaterial: StandardMaterial | null = null;
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03, fresnelPower: 3.0 };

  constructor(scene: Scene) {
    this._scene = scene;
    this._initShader();
  }

  private _initShader(): void {
    Effect.ShadersStore["fresnelRimVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 world;
      uniform mat4 viewProjection;
      uniform mat4 worldView;
      varying vec3 vNormalW;
      varying vec3 vPositionW;

      void main(void) {
        vec4 worldPos = world * vec4(position, 1.0);
        vPositionW = worldPos.xyz;
        vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
        gl_Position = viewProjection * worldPos;
      }
    `;

    Effect.ShadersStore["fresnelRimFragmentShader"] = `
      precision highp float;
      varying vec3 vNormalW;
      varying vec3 vPositionW;
      uniform vec3 cameraPosition;
      uniform vec3 rimColor;
      uniform float rimPower;
      uniform float rimIntensity;

      void main(void) {
        vec3 viewDir = normalize(cameraPosition - vPositionW);
        vec3 normal = normalize(vNormalW);
        float NdotV = max(0.0, dot(normal, viewDir));
        float rim = pow(1.0 - NdotV, rimPower) * rimIntensity;
        
        if (rim < 0.05) {
          discard;
        }

        gl_FragColor = vec4(rimColor, clamp(rim, 0.0, 1.0));
      }
    `;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._currentParams = { ...params };
    this._activeMeshes = [...meshes];

    if (this._activeMeshes.length === 0) return;

    const color = Color3.FromHexString(params.color);

    // 创建菲涅尔发光材质
    this._rimMaterial = new StandardMaterial("fresnelRimMat", this._scene);
    this._rimMaterial.diffuseColor = Color3.Black();
    this._rimMaterial.emissiveColor = color;
    this._rimMaterial.specularColor = Color3.Black();
    this._rimMaterial.alpha = 0.85;
    this._rimMaterial.alphaMode = 2; // Additive blending
    this._rimMaterial.backFaceCulling = false;
    this._rimMaterial.disableLighting = true;

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
          clone.scaling = mesh.scaling.scale(1.008);
          clone.isPickable = false;
          clone.material = this._rimMaterial;
          clone.renderingGroupId = 1;
          this._rimClones.push(clone);
        }
      }
    });

    this.update(params);
  }

  public update(params: OutlineParams): void {
    this._currentParams = { ...this._currentParams, ...params };
    const color = Color3.FromHexString(this._currentParams.color);

    if (this._rimMaterial) {
      this._rimMaterial.emissiveColor = color;
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

    this._rimClones.forEach((clone) => {
      clone.dispose(false, true);
    });
    this._rimClones = [];

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
