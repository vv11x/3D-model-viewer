import { AbstractMesh } from "@babylonjs/core";

export interface OutlineParams {
  color: string; // Hex color string, e.g. "#00f2fe"
  width: number; // Normalized width/offset factor (0.005 - 0.08)
  overlayAlpha?: number; // For renderOverlay (0.1 - 1.0)
  edgeAngle?: number; // Dihedral angle threshold in degrees for EdgesRenderer (5 - 60)
  depthThreshold?: number; // For Sobel post-process (0.05 - 0.60)
  fresnelPower?: number; // Power exponent for Fresnel rim lighting (1.0 - 8.0)
  xrayAlpha?: number; // Alpha for X-Ray see-through pass (0.1 - 1.0)
  glowIntensity?: number; // Intensity for GlowLayer (0.1 - 2.0)
}

export type OutlineAlgorithmType =
  // 官方原生 7 大视觉系统 (100% 官方引擎原生驱动，0 冲突 0 错位)
  | 'native_outline'       // 1. 官方实体轮廓描边 (renderOutline)
  | 'native_overlay'       // 2. 官方高亮覆盖蒙版 (renderOverlay)
  | 'native_edges'         // 3. 官方几何特征折边 (enableEdgesRendering)
  | 'native_bounding_box'  // 4. 官方 3D 立体包围盒 (showBoundingBox)
  | 'native_highlight'     // 5. 官方外发光高亮层 (HighlightLayer)
  | 'native_glow'          // 6. 官方科技泛光层 (GlowLayer)
  | 'native_wireframe'     // 7. 官方三角拓扑线框 (wireframe)
  // 高阶图形学着色与后处理 4 大系统
  | 'sobel_mask'           // 8. 独立 Mask 遮罩 Sobel 卷积边缘检测
  | 'fresnel_rim'          // 9. 菲涅尔视线掠射轮廓光
  | 'xray_seethrough'      // 10. X-Ray 遮挡穿透透视描边
  | 'stencil_mask';        // 11. Stencil 硬件模板锐利剪裁

export interface IOutlineRenderer {
  readonly id: OutlineAlgorithmType;
  readonly name: string;
  readonly category: 'official' | 'advanced';
  readonly description: string;
  apply(meshes: AbstractMesh[], params: OutlineParams): void;
  update(params: OutlineParams): void;
  clear(): void;
  dispose(): void;
}
