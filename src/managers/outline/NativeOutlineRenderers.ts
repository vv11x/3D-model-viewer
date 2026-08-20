import {
  AbstractMesh,
  Color3,
  Color4,
  GlowLayer,
  HighlightLayer,
  Mesh,
  Scene
} from "@babylonjs/core";
import type { IOutlineRenderer, OutlineAlgorithmType, OutlineParams } from "./IOutlineRenderer";

/**
 * 1. 官方原生实体轮廓描边 (renderOutline)
 */
export class NativeOutlineRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_outline';
  public readonly name: string = '官方实体轮廓 (renderOutline)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】SubMesh 管线自动调度顶点外扩通道。经典 CAD 与游戏纯色等宽硬轮廓线，紧贴模型表面。';

  private _activeMeshes: AbstractMesh[] = [];

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const color = Color3.FromHexString(params.color);
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOutline = true;
      mesh.outlineColor = color;
      mesh.outlineWidth = Math.max(0.02, params.width);
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOutline = false;
    });
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}

/**
 * 2. 官方原生高亮覆盖蒙版 (renderOverlay)
 */
export class NativeOverlayRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_overlay';
  public readonly name: string = '官方高亮蒙版 (renderOverlay)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】在零件表面覆盖半透明纯色光膜，直观突出选中部件本体，不破坏原始材质。';

  private _activeMeshes: AbstractMesh[] = [];

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const color = Color3.FromHexString(params.color);
    const alpha = params.overlayAlpha ?? 0.45;
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOverlay = true;
      mesh.overlayColor = color;
      mesh.overlayAlpha = alpha;
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((mesh) => {
      mesh.renderOverlay = false;
    });
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}

/**
 * 3. 官方原生几何特征折边 (enableEdgesRendering)
 */
export class NativeEdgesRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_edges';
  public readonly name: string = '官方几何折边 (EdgesRenderer)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】GPU 顶点着色器根据面片二面角计算特征硬边，高精勾勒机械倒角与接缝，平滑面无杂线。';

  private _activeMeshes: AbstractMesh[] = [];

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const color = Color3.FromHexString(params.color);
    const color4 = new Color4(color.r, color.g, color.b, 1.0);
    const width = Math.max(2.0, params.width * 120.0);
    const angleDeg = params.edgeAngle ?? 25;
    const epsilon = Math.cos((angleDeg * Math.PI) / 180.0);

    this._activeMeshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        mesh.enableEdgesRendering(epsilon);
        mesh.edgesWidth = width;
        mesh.edgesColor = color4;
      }
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        mesh.disableEdgesRendering();
      }
    });
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}

/**
 * 4. 官方原生 3D 立体包围盒 (showBoundingBox)
 */
export class NativeBoundingBoxRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_bounding_box';
  public readonly name: string = '官方 3D 包围盒 (BoundingBox)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】在 3D 空间以立体线框精确标定选中部件的空间边界与尺寸范围，工业级测量锁定框。';

  private _scene: Scene;
  private _activeMeshes: AbstractMesh[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const color = Color3.FromHexString(params.color);
    const bbRenderer = this._scene.getBoundingBoxRenderer();
    bbRenderer.showBackLines = true;
    bbRenderer.frontColor = color;
    bbRenderer.backColor = color.scale(0.6);

    this._activeMeshes.forEach((mesh) => {
      mesh.showBoundingBox = true;
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((mesh) => {
      mesh.showBoundingBox = false;
    });
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
  }
}

/**
 * 5. 官方原生双 Pass 外发光层 (HighlightLayer)
 */
export class NativeHighlightRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_highlight';
  public readonly name: string = '官方外发光层 (HighlightLayer)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】特效渲染层双 Pass 分离式高斯模糊扩散，柔和平滑的科幻霓虹外发光光晕。';

  private _scene: Scene;
  private _highlightLayer: HighlightLayer | null = null;
  private _activeMeshes: AbstractMesh[] = [];

  constructor(scene: Scene) {
    this._scene = scene;
  }

  private _ensureLayer(): HighlightLayer {
    if (!this._highlightLayer) {
      this._highlightLayer = new HighlightLayer("nativeHlLayer", this._scene, {
        isStroke: false,
        blurHorizontalSize: 2.5,
        blurVerticalSize: 2.5,
        mainTextureRatio: 1.0
      });
      this._highlightLayer.innerGlow = true;
      this._highlightLayer.outerGlow = true;
    }
    return this._highlightLayer;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const layer = this._ensureLayer();
    const color = Color3.FromHexString(params.color);
    const blurSize = Math.max(1.0, params.width * 60.0);

    layer.blurHorizontalSize = blurSize;
    layer.blurVerticalSize = blurSize;

    layer.removeAllMeshes();
    this._activeMeshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        layer.addMesh(mesh, color);
      }
    });
  }

  public clear(): void {
    if (this._highlightLayer) {
      this._highlightLayer.removeAllMeshes();
    }
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
    if (this._highlightLayer) {
      this._highlightLayer.dispose();
      this._highlightLayer = null;
    }
  }
}

/**
 * 6. 官方原生科技泛光自发光层 (GlowLayer)
 */
export class NativeGlowRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_glow';
  public readonly name: string = '官方自发光泛光 (GlowLayer)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】选中部件本体整体向外辐射辉光，犹如通电自发光物体，科技感强烈。';

  private _scene: Scene;
  private _glowLayer: GlowLayer | null = null;
  private _activeMeshes: AbstractMesh[] = [];
  private _currentColor: Color3 = Color3.FromHexString("#00f2fe");

  constructor(scene: Scene) {
    this._scene = scene;
  }

  private _ensureLayer(): GlowLayer {
    if (!this._glowLayer) {
      this._glowLayer = new GlowLayer("nativeGlowLayer", this._scene, {
        mainTextureFixedSize: 512,
        blurKernelSize: 32
      });
      this._glowLayer.intensity = 1.2;

      // 解决无自发光材质网格的辉光渲染：自定义 Emissive Selector
      this._glowLayer.customEmissiveColorSelector = (mesh, _subMesh, _material, result) => {
        if (this._activeMeshes.includes(mesh)) {
          result.set(this._currentColor.r, this._currentColor.g, this._currentColor.b, 1.0);
        } else {
          result.set(0, 0, 0, 0);
        }
      };
    }
    return this._glowLayer;
  }

  public apply(meshes: AbstractMesh[], params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this.update(params);
  }

  public update(params: OutlineParams): void {
    const layer = this._ensureLayer();
    this._currentColor = Color3.FromHexString(params.color);
    layer.intensity = params.glowIntensity ?? 1.2;
    this._activeMeshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        layer.addIncludedOnlyMesh(mesh);
      }
    });
  }

  public clear(): void {
    this._activeMeshes.forEach((mesh) => {
      if (mesh instanceof Mesh && this._glowLayer) {
        this._glowLayer.removeIncludedOnlyMesh(mesh);
      }
    });
    this._activeMeshes = [];
  }

  public dispose(): void {
    this.clear();
    if (this._glowLayer) {
      this._glowLayer.dispose();
      this._glowLayer = null;
    }
  }
}

/**
 * 7. 官方原生三角拓扑线框 (Wireframe)
 */
export class NativeWireframeRenderer implements IOutlineRenderer {
  public readonly id: OutlineAlgorithmType = 'native_wireframe';
  public readonly name: string = '官方拓扑线框 (Wireframe)';
  public readonly category = 'official' as const;
  public readonly description: string = '【官方原生】材质原生线框着色模式，清晰展示三维几何三角面网格布线与模型结构。';

  private _activeMeshes: AbstractMesh[] = [];
  private _originalWireframeState: Map<AbstractMesh, boolean> = new Map();
  private _wireframeActiveQuery?: () => boolean;

  constructor(wireframeActiveQuery?: () => boolean) {
    this._wireframeActiveQuery = wireframeActiveQuery;
  }

  public apply(meshes: AbstractMesh[], _params: OutlineParams): void {
    this.clear();
    this._activeMeshes = [...meshes];
    this._activeMeshes.forEach((mesh) => {
      if (mesh.material) {
        this._originalWireframeState.set(mesh, mesh.material.wireframe);
        mesh.material.wireframe = true;
      }
    });
  }

  public update(_params: OutlineParams): void {
    this._activeMeshes.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.wireframe = true;
      }
    });
  }

  public clear(): void {
    // 全局线框模式 (DebugManager) 激活时保持线框，避免覆盖用户的全局线框状态
    const globalActive = this._wireframeActiveQuery?.() ?? false;
    this._activeMeshes.forEach((mesh) => {
      if (mesh.material && this._originalWireframeState.has(mesh)) {
        mesh.material.wireframe = globalActive || (this._originalWireframeState.get(mesh) ?? false);
      }
    });
    this._activeMeshes = [];
    this._originalWireframeState.clear();
  }

  public dispose(): void {
    this.clear();
  }
}
