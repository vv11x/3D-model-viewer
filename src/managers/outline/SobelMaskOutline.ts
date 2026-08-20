import {
  AbstractMesh,
  Camera,
  Color3,
  Effect,
  PostProcess,
  RenderTargetTexture,
  Scene,
  StandardMaterial,
  Vector2
} from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";

/**
 * 8. 独立 Mask 遮罩 Sobel 卷积边缘检测 (Sobel Mask Post-Process)
 * 原理：离屏 RTT 仅将选中部件绘制进纯色遮罩，Sobel 算子仅在遮罩边界做梯度卷积，100% 物理阻断背景干扰
 */
export class SobelMaskOutline implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'sobel_mask';
  public readonly name: string = 'Sobel 遮罩卷积检测';
  public readonly category = 'advanced' as const;
  public readonly description: string = '【高阶着色】独立 Mask RTT 离屏隔离 + 3x3 Sobel 梯度卷积。工业 CAD 图纸级硬质边缘，外轮廓与转折接缝同时勾勒。';

  private _scene: Scene;
  private _camera: Camera;
  private _postProcess: PostProcess | null = null;
  private _maskRTT: RenderTargetTexture | null = null;
  private _maskMaterial: StandardMaterial | null = null;
  private _activeMeshes: AbstractMesh[] = [];
  private _currentParams: OutlineParams = { color: "#00f2fe", width: 0.03, depthThreshold: 0.25 };

  constructor(scene: Scene, camera: Camera) {
    this._scene = scene;
    this._camera = camera;
    this._initShader();
  }

  private _initShader(): void {
    Effect.ShadersStore["sobelMaskFragmentShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform sampler2D maskSampler;
      uniform vec2 screenSize;
      uniform vec3 outlineColor;
      uniform float outlineThickness;
      uniform float threshold;

      void main(void) {
        vec4 sceneColor = texture2D(textureSampler, vUV);
        vec2 texel = (1.0 / screenSize) * max(1.0, outlineThickness);

        // 采样 3x3 独立遮罩纹理
        float m00 = texture2D(maskSampler, vUV + vec2(-texel.x, -texel.y)).r;
        float m01 = texture2D(maskSampler, vUV + vec2(0.0, -texel.y)).r;
        float m02 = texture2D(maskSampler, vUV + vec2(texel.x, -texel.y)).r;
        float m10 = texture2D(maskSampler, vUV + vec2(-texel.x, 0.0)).r;
        float m11 = texture2D(maskSampler, vUV).r;
        float m12 = texture2D(maskSampler, vUV + vec2(texel.x, 0.0)).r;
        float m20 = texture2D(maskSampler, vUV + vec2(-texel.x, texel.y)).r;
        float m21 = texture2D(maskSampler, vUV + vec2(0.0, texel.y)).r;
        float m22 = texture2D(maskSampler, vUV + vec2(texel.x, texel.y)).r;

        // Sobel 算子卷积
        float gx = -1.0 * m00 + 1.0 * m02 - 2.0 * m10 + 2.0 * m12 - 1.0 * m20 + 1.0 * m22;
        float gy = -1.0 * m00 - 2.0 * m01 - 1.0 * m02 + 1.0 * m20 + 2.0 * m21 + 1.0 * m22;
        float edge = sqrt(gx * gx + gy * gy);

        if (edge > threshold) {
          gl_FragColor = vec4(outlineColor, 1.0);
        } else if (edge > threshold * 0.5) {
          gl_FragColor = mix(sceneColor, vec4(outlineColor, 1.0), 0.8);
        } else {
          gl_FragColor = sceneColor;
        }
      }
    `;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._currentParams = { ...params };
    this._activeMeshes = [...meshes];

    if (this._activeMeshes.length === 0) return;

    // 1. 创建纯白遮罩材质
    this._maskMaterial = new StandardMaterial("sobelWhiteMaskMat", this._scene);
    this._maskMaterial.diffuseColor = Color3.White();
    this._maskMaterial.emissiveColor = Color3.White();
    this._maskMaterial.disableLighting = true;
    this._maskMaterial.backFaceCulling = false;

    // 2. 创建专属 Mask RTT 离屏渲染纹理
    this._maskRTT = new RenderTargetTexture(
      "sobelSelectionMaskRTT",
      { width: 1024, height: 1024 },
      this._scene,
      false,
      true
    );
    this._maskRTT.clearColor = new Color3(0, 0, 0).toColor4(0.0);
    this._maskRTT.renderList = this._activeMeshes;
    this._maskRTT.activeCamera = this._camera;
    this._maskRTT.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;

    this._maskRTT.customIsReadyFunction = () => true;
    this._activeMeshes.forEach((mesh) => {
      if (this._maskMaterial) {
        this._maskRTT?.setMaterialForRendering(mesh, this._maskMaterial);
      }
    });

    // 3. 挂载后处理 Shader
    const engine = this._scene.getEngine();
    this._postProcess = new PostProcess(
      "sobelMaskPass",
      "sobelMask",
      ["screenSize", "outlineColor", "outlineThickness", "threshold"],
      ["maskSampler"],
      1.0,
      this._camera
    );

    this._postProcess.onApplyObservable.add((effect) => {
      const color = Color3.FromHexString(this._currentParams.color);
      const thickness = Math.max(1.5, this._currentParams.width * 80.0);
      const threshold = Math.max(0.05, this._currentParams.depthThreshold ?? 0.25);

      effect.setVector2("screenSize", new Vector2(engine.getRenderWidth(), engine.getRenderHeight()));
      effect.setColor3("outlineColor", color);
      effect.setFloat("outlineThickness", thickness);
      effect.setFloat("threshold", threshold);
      if (this._maskRTT) {
        effect.setTexture("maskSampler", this._maskRTT);
      }
    });
  }

  public update(params: OutlineParams): void {
    this._currentParams = { ...this._currentParams, ...params };
  }

  public clear(): void {
    if (this._postProcess) {
      this._postProcess.dispose();
      this._postProcess = null;
    }
    if (this._maskRTT) {
      this._maskRTT.dispose();
      this._maskRTT = null;
    }
    if (this._maskMaterial) {
      this._maskMaterial.dispose();
      this._maskMaterial = null;
    }
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}
