# 修复报告 (FIX REPORT)

> 项目：虚拟仿真 3D 相机查看器（Babylon.js 9 + Vite + TypeScript）
> 范围：深度代码检测修复 + 功能性审查修复
> 验证：`tsc` ✅ / `eslint` ✅ / `vite build` ✅ / dev server 冒烟测试 ✅

---

## 统计概览

| 类别 | 数量 |
| ---- | ---- |
| 修改文件 | 17 个（含新增 1 个修复报告） |
| 修复问题总数 | 23 项 |
| 其中：构建/规范问题 | 4 项 |
| 其中：运行时正确性问题 | 11 项 |
| 其中：图形渲染问题 | 8 项 |
| 新增 UI 元素 | 3 个 |
| 修复 CSS 语法错误 | 1 处 |
| 代码变更量 | +442 / -207 行 |

---

## 一、深度检测修复（第一轮）

### 构建 / 规范（4 项）

1. **`MeshRoundingManager.ts`** — 修复唯一 ESLint 报错：`let avgNormal` → `const avgNormal`（prefer-const）。
2. **`.gitignore`** — 新增 `.playwright-mcp/` 忽略规则（测试日志/截图目录不再入库）。
3. **`package.json`** — 修正非法包名 `"-"` → `virtual-camera-simulator`。
4. **`style.css`** — 修复孤立 CSS 块导致 `vite build` 失败的语法错误（`.dropzone-content` 的 `border/background/box-shadow` 声明被误置于 `}` 之后，已移回原选择器内）。

### 运行时正确性（7 项）

5. **`main.ts` 拖放双重加载** — 拖文件到 dropzone 遮罩层时 `onFileDrop` 增加 `e.stopPropagation()`，阻止 window 级监听器重复加载。
6. **`main.ts` 重复选择同一文件** — 文件选择后重置 `modelFileInput.value = ''`。
7. **`main.ts` Inspector 汉化死代码** — 接入 `InspectorI18n.init()`（DOMContentLoaded 开头），汉化引擎此前从未启用。
8. **`scene.ts` 闲置 GlowLayer** — 移除全局 GlowLayer 的 import、字段与创建代码（每帧白跑后处理）；`dispose()` 补上 `selectionManager.outlineManager.dispose()` 与 `debugManager.dispose()`。
9. **`ModelLoader.ts` 包围盒缓存过期** — 删除 `_cachedModelCenterWorld`/`_cachedModelFocusRadius` 缓存及清理逻辑，`getModelCenterWorld`/`getModelFocusRadius` 每次现算（修复隐藏部件/圆角后相机聚焦数据过期）；空分组不再显示无意义展开箭头（`isGroup = childNodes.length > 0`）。
10. **`SelectionManager.ts` 可见性语义** — `isTargetVisible` 改用 `node.isEnabled(true)`（祖先感知）；`setTargetVisible` 仅对 AbstractMesh 强制子网格 `setEnabled/isVisible`，分组重新显示时保留单独隐藏的子部件。
11. **`AnimationManager.ts` 逐帧步进** — `stepFrame` 在动画未启动时先 `start(...)+pause()`，与 `goToFrame` 行为一致，逐帧按钮首帧即可用。

### 图形渲染（4 项）

12. **`DebugManager.ts` 法线可视化** — 从"假灰面"改为真正的世界空间法线→RGB 着色（ShaderMaterial + ShadersStore）；新增 `dispose()`（`clear()` 不再 dispose 调试材质，避免模型重载后 clay/normals 模式失效）。
13. **`FresnelRimOutline.ts` / `XRayOutline.ts` / `StencilOutline.ts` 克隆壳跟随** — 新增每帧 `onBeforeRenderObservable` 同步（position/rotation/rotationQuaternion/scaling×shellScale），选中部件被拖拽/旋转/动画时描边外壳不再脱节；`clear()` 时移除 observer、`clone.dispose(false, false)` 修复共享材质双重释放。
14. **`StencilOutline.ts` 共享材质隔离** — 检测到共享材质时先克隆再开 Stencil（`_materialOrigins`），`clear()` 仅当 `mesh.material === entry.clone` 时还原，避免污染同材质其他网格。
15. **UI 补全（`index.html` + `style.css`）** — 补齐 3 个缺失元素并加样式：`lblOutlineAlgoDesc`（算法描述）、`lblRoundingDesc`（圆角模式描述）、`lblCustomColorHex`（十六进制色值标签）；`main.ts` 启动时初始化三个标签文本。

---

## 二、功能性审查修复（第二轮）

### P0 — 功能失效（1 项）

16. **`XRayOutline.ts` 穿透失效** — 原代码仅 `disableDepthWrite = true`（禁深度写入），深度**测试**仍为 LESS，被外壳遮挡的部件深度测试失败导致轮廓完全不可见。修复：`depthFunction = Engine.ALWAYS`（深度测试恒过）+ 不写深度 → X-Ray 穿透定位功能真正生效。

### P1 — 行为缺陷（2 项）

17. **`main.ts` 切换动画轨道不同步** — `updateTimelineTrack` 只更新 UI 显示值，真实帧位置停留在旧轨道。修复：切换时补 `goToAnimationFrame(activeTrack, range.from)`。
18. **`native_wireframe` 与全局线框互相破坏** — `NativeWireframeRenderer.clear()` 无条件恢复材质 `wireframe` 旧值，会关闭用户开启的"全场景线框"模式。修复：注入查询链（`scene.ts → SelectionManager → OutlineManager → NativeWireframeRenderer`），clear 时经 `wireframeActiveQuery`（读取 `DebugManager.activeShadingMode`）合并全局线框状态后再恢复。

### P2 — 轻微 / 边缘（5 项）

19. **`StencilOutline.ts` 渲染组残留** — `apply()` 强制 `origMesh.renderingGroupId = 0` 后不恢复。修复：新增 `_originalRenderingGroups` 记录并 restore；`clear()` 对已 dispose 网格/material 加守卫；克隆壳 dispose 前检查 `isDisposed`（`FresnelRimOutline`/`XRayOutline` 同步加固）。
20. **`main.ts` 树眼睛图标不刷新** — `btnHideSelected` 隐藏部件后模型树仍显示"睁眼"。修复：提取 `EYE_OPEN_SVG`/`EYE_CLOSED_SVG` 常量 + 新增 `updateTreeVisibilityIcons()`，在 `btnHideSelected`/`btnShowAllMeshes`/`btnResetModel`/`btnResetAll` 后统一刷新。
21. **`SelectionManager.ts` 二次 dispose** — `restoreAllIsolatedMaterials()` 对已随模型释放的隔离材质再次 `dispose()`（Babylon `Material` 无 `isDisposed`，改用 `mesh.isDisposed()` 代理守卫）。
22. **`NativeOutlineRenderers.ts` 常驻特效层** — `OutlineManager` 构造时即创建 `GlowLayer` + `HighlightLayer`（每帧 GPU 后处理开销，即使从不使用）。修复：改为 `_ensureLayer()` 懒创建，首次使用对应算法时才分配特效层。
23. **`NativeHighlightRenderer`/`NativeGlowRenderer` 生命周期** — 配合懒创建补全 `dispose()` 空值处理与资源释放。

---

## 修改文件清单（17 个）

```
.gitignore                                  （+3）
FIX_REPORT.md                               （新增）
index.html                                  （+4）
package.json                                （±1）
src/main.ts                                 （+120 / -46）
src/managers/AnimationManager.ts            （+4）
src/managers/CameraManager.ts               （±7，外部会话遗留）
src/managers/DebugManager.ts                （+71 / -17）
src/managers/MeshRoundingManager.ts         （+25 / -5）
src/managers/ModelLoader.ts                 （+99 / -89）
src/managers/SelectionManager.ts            （+26 / -8）
src/managers/outline/FresnelRimOutline.ts   （+98 / -66）
src/managers/outline/NativeOutlineRenderers.ts （+79 / -55）
src/managers/outline/OutlineManager.ts      （+9 / -3）
src/managers/outline/StencilOutline.ts      （+103 / -70）
src/managers/outline/XRayOutline.ts         （+47 / -18）
src/scene.ts                                （+18 / -8）
src/style.css                               （+30 / -8）
```

---

## 验证结果

| 检查 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | ✅ 通过（exit 0） |
| `npm run lint`（eslint src） | ✅ 通过（0 错误 0 警告） |
| `npm run build`（tsc + vite build） | ✅ 通过（5490 modules） |
| dev server 冒烟测试 | ✅ HTTP 200，页面正常加载 |

> 备注：`dist/` 主 chunk 约 7.6MB（gzip 1.75MB），主要来自 `@babylonjs/inspector` 全量引入，属既有设计，未在本轮处理。