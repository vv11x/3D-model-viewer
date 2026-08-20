/**
 * Babylon Inspector 深度 DOM 自动汉化拦截引擎
 */
export class InspectorI18n {
  private static _observer: MutationObserver | null = null;
  private static _isTranslating = false;

  // 核心中英文词典映射
  private static readonly DICTIONARY: Record<string, string> = {
    // 顶部与主要面板标题
    'Scene Explorer': '场景资源浏览器',
    'Properties': '属性面板',
    'Scene': '场景根节点',
    'Nodes': '节点层级',
    'Materials': '材质列表',
    'Textures': '纹理贴图',
    'Effect Layers': '特效渲染层',
    'Particle Systems': '粒子系统',
    'Animation Groups': '动画组',
    'Sprites': '精灵图集',
    'Sounds': '音频声音',
    'GUI': 'GUI 用户界面',

    // 属性面板主要折叠区
    'Pinned': '置顶项',
    'No pinned items': '暂无置顶项',
    'Rendering': '渲染设置',
    'Rendering Mode': '渲染模式',
    'Clear Color': '清除背景色',
    'Clear Color Enabled': '启用背景色清除',
    'Ambient Color': '环境光颜色',
    'Environment Texture (IBL)': '环境贴图 (IBL)',
    'Environment Intensity': '环境光强度',
    'Image Processing': '图像后处理',
    'Post Processes': '后处理特效',
    'Physics': '物理引擎',
    'Collisions': '碰撞检测',
    'Shadows': '阴影设置',
    'Animations': '动画控制',
    'Transform': '空间变换',
    'Position': '位置 (Position)',
    'Rotation': '旋转 (Rotation)',
    'Scaling': '缩放 (Scaling)',
    'General': '通用属性',
    'Display': '显示属性',
    'Advanced': '高级选项',
    'Lighting': '光照属性',
    'Textures & Colors': '纹理与颜色',

    // 常用控件与选项
    'Filter': '搜索过滤...',
    'Filter...': '搜索过滤...',
    'Search...': '搜索...',
    'Solid': '实体模式',
    'Wireframe': '线框模式',
    'Point': '点云模式',
    'OIT': '顺序无关半透明 (OIT)',
    'Enabled': '已启用',
    'Disabled': '已禁用',
    'Visible': '可见',
    'Invisible': '隐藏',
    'Alpha': '不透明度',
    'Roughness': '粗糙度',
    'Metallic': '金属度',
    'Intensity': '强度',
    'Radius': '半径',
    'Target': '目标点',
    'Fov': '视场角 (FOV)',
    'Min Z': '近裁剪面 (Min Z)',
    'Max Z': '远裁剪面 (Max Z)',
    'Speed Ratio': '播放速度',
    'From': '起始帧',
    'To': '结束帧',
    'Loop': '循环播放',
    'Play': '播放',
    'Pause': '暂停',
    'Stop': '停止',
    'Reset': '重置',
    'Delete': '删除',
    'Add': '添加',
    'Clone': '克隆',
    'Dispose': '释放销毁',
    'Name': '名称',
    'Class': '类名',
    'Unique ID': '唯一标识符 (ID)',
    'Vertices': '顶点数',
    'Faces': '三角面数',
    'Submeshes': '子网格数'
  };

  /**
   * 初始化并启动 Inspector 汉化监听
   */
  public static init(): void {
    if (this._observer) return;

    this._observer = new MutationObserver(() => {
      if (!this._isTranslating) {
        this._isTranslating = true;
        requestAnimationFrame(() => {
          this.translateDOM();
          this._isTranslating = false;
        });
      }
    });

    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    this.translateDOM();
  }

  /**
   * 遍历并汉化指定容器或整个 DOM
   */
  public static translateDOM(root: HTMLElement | Document = document): void {
    // 1. 汉化所有文本节点
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.nodeValue?.trim();
          if (!text || text.length > 50) return NodeFilter.FILTER_SKIP;
          // 仅在 Inspector 容器或包含目标词条时汉化
          const parent = node.parentElement;
          if (parent && (parent.closest('#scene-explorer-host, #inspector-host, .inspector-wrapper') || InspectorI18n.DICTIONARY[text])) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode: Node | null = walker.nextNode();
    while (currentNode) {
      const text = currentNode.nodeValue?.trim();
      if (text && InspectorI18n.DICTIONARY[text]) {
        currentNode.nodeValue = currentNode.nodeValue!.replace(text, InspectorI18n.DICTIONARY[text]);
      }
      currentNode = walker.nextNode();
    }

    // 2. 汉化 input placeholder 与 title
    const inputs = document.querySelectorAll<HTMLInputElement>('#scene-explorer-host input, #inspector-host input');
    inputs.forEach((input) => {
      if (input.placeholder && InspectorI18n.DICTIONARY[input.placeholder]) {
        input.placeholder = InspectorI18n.DICTIONARY[input.placeholder];
      }
    });
  }

  /**
   * 停止监听
   */
  public static dispose(): void {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
}
