import './style.css';
import { SceneController } from './scene';
import type { TreeNode } from './scene';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Render canvas not found!');
    return;
  }

  // Initialize 3D Scene Controller
  const sceneController = new SceneController(canvas);

  // Top Bar & Dashboard Elements
  const uiDashboard = document.getElementById('uiDashboard') as HTMLElement;
  const btnToggleDashboard = document.getElementById('btnToggleDashboard') as HTMLElement;
  const resetDropdownGroup = document.getElementById('resetDropdownGroup') as HTMLElement;
  const btnResetDropdown = document.getElementById('btnResetDropdown') as HTMLButtonElement;
  const btnResetCamera = document.getElementById('btnResetCamera') as HTMLButtonElement;
  const btnResetModel = document.getElementById('btnResetModel') as HTMLButtonElement;
  const btnResetAll = document.getElementById('btnResetAll') as HTMLButtonElement;
  const modelFileInput = document.getElementById('modelFileInput') as HTMLInputElement;
  const btnUploadTop = document.getElementById('btnUploadTop') as HTMLElement;
  const btnUploadTopText = document.getElementById('btnUploadTopText') as HTMLSpanElement;

  // Stats Elements
  const statModelName = document.getElementById('statModelName') as HTMLSpanElement;
  const statMeshes = document.getElementById('statMeshes') as HTMLSpanElement;
  const statVertices = document.getElementById('statVertices') as HTMLSpanElement;
  const statDrawCalls = document.getElementById('statDrawCalls') as HTMLSpanElement;
  const statFrameTime = document.getElementById('statFrameTime') as HTMLSpanElement;
  const statFps = document.getElementById('statFps') as HTMLSpanElement;

  // Sidebar - Model Tree Elements
  const txtSearchMesh = document.getElementById('txtSearchMesh') as HTMLInputElement;
  const modelTreeContainer = document.getElementById('modelTreeContainer') as HTMLDivElement;
  const treeDropdownGroup = document.getElementById('treeDropdownGroup') as HTMLElement;
  const btnTreeDropdown = document.getElementById('btnTreeDropdown') as HTMLButtonElement;
  const btnExpandAll = document.getElementById('btnExpandAll') as HTMLButtonElement;
  const btnCollapseAll = document.getElementById('btnCollapseAll') as HTMLButtonElement;
  const btnShowAllMeshes = document.getElementById('btnShowAllMeshes') as HTMLButtonElement;
  // Sidebar - Selected Node Sticky Toolbar Elements (Scheme A)
  const selectedStickyToolbar = document.getElementById('selectedStickyToolbar') as HTMLElement;
  const lblSelectedTargetName = document.getElementById('lblSelectedTargetName') as HTMLSpanElement;
  const lblSelectedTag = document.getElementById('lblSelectedTag') as HTMLSpanElement;
  const lblSelectedVerts = document.getElementById('lblSelectedVerts') as HTMLSpanElement;
  const btnDeselectPart = document.getElementById('btnDeselectPart') as HTMLButtonElement;
  const btnFocusSelected = document.getElementById('btnFocusSelected') as HTMLButtonElement;
  const btnHideSelected = document.getElementById('btnHideSelected') as HTMLButtonElement;
  const btnDragSelected = document.getElementById('btnDragSelected') as HTMLButtonElement;
  const btnResetSelectedPosition = document.getElementById('btnResetSelectedPosition') as HTMLButtonElement;
  const btnRotateSelected = document.getElementById('btnRotateSelected') as HTMLButtonElement;
  const rngSelectedAlpha = document.getElementById('rngSelectedAlpha') as HTMLInputElement;
  const lblSelectedAlpha = document.getElementById('lblSelectedAlpha') as HTMLSpanElement;

  // Outline Algorithm & Parameter Elements
  const btnCycleOutlineAlgo = document.getElementById('btnCycleOutlineAlgo') as HTMLButtonElement;
  const selOutlineAlgorithm = document.getElementById('selOutlineAlgorithm') as HTMLSelectElement;
  const lblAlgoCategory = document.getElementById('lblAlgoCategory') as HTMLElement;
  const lblOutlineAlgoDesc = document.getElementById('lblOutlineAlgoDesc') as HTMLDivElement;
  const colorSwatches = document.querySelectorAll<HTMLElement>('.color-swatch');
  const pickerOutlineColor = document.getElementById('pickerOutlineColor') as HTMLInputElement;
  const customColorPreview = document.getElementById('customColorPreview') as HTMLElement;
  const lblCustomColorHex = document.getElementById('lblCustomColorHex') as HTMLElement;
  const rngOutlineWidth = document.getElementById('rngOutlineWidth') as HTMLInputElement;
  const lblOutlineWidth = document.getElementById('lblOutlineWidth') as HTMLSpanElement;
  const rowAlgoParam = document.getElementById('rowAlgoParam') as HTMLDivElement;
  const lblAlgoParamTitle = document.getElementById('lblAlgoParamTitle') as HTMLSpanElement;
  const lblAlgoParamVal = document.getElementById('lblAlgoParamVal') as HTMLSpanElement;
  const rngAlgoParam = document.getElementById('rngAlgoParam') as HTMLInputElement;
  const chkSelectionHighlight = document.getElementById('chkSelectionHighlight') as HTMLInputElement;

  // Mesh Rounding Elements
  const lblRoundingTargetTag = document.getElementById('lblRoundingTargetTag') as HTMLElement;
  const btnScopeSelected = document.getElementById('btnScopeSelected') as HTMLButtonElement;
  const btnScopeAll = document.getElementById('btnScopeAll') as HTMLButtonElement;
  const selRoundingMode = document.getElementById('selRoundingMode') as HTMLSelectElement;
  const lblRoundingDesc = document.getElementById('lblRoundingDesc') as HTMLElement;
  const rowRoundingAngle = document.getElementById('rowRoundingAngle') as HTMLElement;
  const rngRoundingAngle = document.getElementById('rngRoundingAngle') as HTMLInputElement;
  const lblRoundingAngle = document.getElementById('lblRoundingAngle') as HTMLElement;
  const rowRoundingStrength = document.getElementById('rowRoundingStrength') as HTMLElement;
  const rngRoundingStrength = document.getElementById('rngRoundingStrength') as HTMLInputElement;
  const lblRoundingStrength = document.getElementById('lblRoundingStrength') as HTMLElement;
  const rowRoundingIter = document.getElementById('rowRoundingIter') as HTMLElement;
  const rngRoundingIter = document.getElementById('rngRoundingIter') as HTMLInputElement;
  const lblRoundingIter = document.getElementById('lblRoundingIter') as HTMLElement;
  const btnApplyRounding = document.getElementById('btnApplyRounding') as HTMLButtonElement;
  const btnResetRounding = document.getElementById('btnResetRounding') as HTMLButtonElement;
  const lblRoundingStatus = document.getElementById('lblRoundingStatus') as HTMLElement;

  // Section C - Shading & Spatial Diagnostics Elements
  const selShadingMode = document.getElementById('selShadingMode') as HTMLSelectElement;
  const lblShadingTag = document.getElementById('lblShadingTag') as HTMLElement;
  const chkAxisGizmo = document.getElementById('chkAxisGizmo') as HTMLInputElement;
  const chkSceneBBox = document.getElementById('chkSceneBBox') as HTMLInputElement;

  // Sidebar - View & Environment Elements
  const chkAutoRotate = document.getElementById('chkAutoRotate') as HTMLInputElement;
  const chkLockToModel = document.getElementById('chkLockToModel') as HTMLInputElement;
  const chkShowGrid = document.getElementById('chkShowGrid') as HTMLInputElement;
  const chkEnableShadows = document.getElementById('chkEnableShadows') as HTMLInputElement;
  const rngCameraZoom = document.getElementById('rngCameraZoom') as HTMLInputElement;
  const lblCameraZoom = document.getElementById('lblCameraZoom') as HTMLSpanElement;
  const rngPanningSpeed = document.getElementById('rngPanningSpeed') as HTMLInputElement;
  const lblPanningSpeed = document.getElementById('lblPanningSpeed') as HTMLSpanElement;
  const rngDirLight = document.getElementById('rngDirLight') as HTMLInputElement;
  const lblDirLight = document.getElementById('lblDirLight') as HTMLSpanElement;
  const rngHemiLight = document.getElementById('rngHemiLight') as HTMLInputElement;
  const lblHemiLight = document.getElementById('lblHemiLight') as HTMLSpanElement;

  // Bottom Floating Timeline Elements
  const bottomTimeline = document.getElementById('bottomTimeline') as HTMLElement;
  const btnTimelinePlayPause = document.getElementById('btnTimelinePlayPause') as HTMLButtonElement;
  const btnTimelinePrevFrame = document.getElementById('btnTimelinePrevFrame') as HTMLButtonElement;
  const btnTimelineNextFrame = document.getElementById('btnTimelineNextFrame') as HTMLButtonElement;
  const lblTimelineFrame = document.getElementById('lblTimelineFrame') as HTMLSpanElement;
  const lblTimelineTime = document.getElementById('lblTimelineTime') as HTMLSpanElement;
  const rngTimelineScrubber = document.getElementById('rngTimelineScrubber') as HTMLInputElement;
  const btnTimelineLoop = document.getElementById('btnTimelineLoop') as HTMLButtonElement;
  const selTimelineSpeed = document.getElementById('selTimelineSpeed') as HTMLSelectElement;
  const selTimelineTrack = document.getElementById('selTimelineTrack') as HTMLSelectElement;

  // Overlays
  const dropzoneOverlay = document.getElementById('dropzoneOverlay') as HTMLDivElement;
  const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement;

  // State Variables
  let isDraggingSelected = false;
  let isScrubberUserInteracting = false;
  let wasPlayingBeforeScrub = false;

  // ==================== 1. Sidebar & Toolbox Navigation ====================
  if (btnToggleDashboard && uiDashboard) {
    btnToggleDashboard.addEventListener('click', () => {
      uiDashboard.classList.toggle('collapsed');
    });
  }

  // Toolbox Tab Navigation Switching
  const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  const tabPanels = document.querySelectorAll<HTMLElement>('.toolbox-tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      if (!targetTabId) return;

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById(targetTabId);
      if (activePanel) {
        activePanel.classList.add('active');
      }
    });
  });

  // ==================== 2. Reset Dropdown Menu & View Bindings ====================
  if (btnResetDropdown && resetDropdownGroup) {
    btnResetDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      resetDropdownGroup.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!resetDropdownGroup.contains(e.target as Node)) {
        resetDropdownGroup.classList.remove('open');
      }
    });
  }

  if (btnResetCamera) {
    btnResetCamera.addEventListener('click', () => {
      resetDropdownGroup?.classList.remove('open');
      sceneController.resetCamera();
      syncZoomUI();
    });
  }

  if (btnResetModel) {
    btnResetModel.addEventListener('click', () => {
      resetDropdownGroup?.classList.remove('open');
      sceneController.selectionManager.resetAllTransformsAndMaterials();
      const names = sceneController.getAnimationNames();
      if (names.length > 0) {
        sceneController.animationManager.goToFrame(names[0], 0);
        sceneController.animationManager.stopAnimation(names[0]);
      }
      selectTargetByName(null);
      rngSelectedAlpha.value = "1";
      lblSelectedAlpha.textContent = "1.00";
      if (btnRotateSelected) btnRotateSelected.classList.remove('active');
      syncTimelineFrameDisplay();
      updatePlayPauseButton(false);
    });
  }

  if (btnResetAll) {
    btnResetAll.addEventListener('click', () => {
      resetDropdownGroup?.classList.remove('open');
      sceneController.resetEntireModel();
      selectTargetByName(null);
      rngSelectedAlpha.value = "1";
      lblSelectedAlpha.textContent = "1.00";
      if (btnRotateSelected) btnRotateSelected.classList.remove('active');
      syncZoomUI();
      syncTimelineFrameDisplay();
      updatePlayPauseButton(false);
    });
  }

  chkAutoRotate.addEventListener('change', (e) => {
    sceneController.toggleAutoRotate((e.target as HTMLInputElement).checked);
  });

  chkLockToModel.addEventListener('change', (e) => {
    sceneController.setCameraTargetLock((e.target as HTMLInputElement).checked);
  });

  chkShowGrid.addEventListener('change', (e) => {
    sceneController.setGridVisibility((e.target as HTMLInputElement).checked);
  });

  chkEnableShadows.addEventListener('change', (e) => {
    sceneController.setShadowsEnabled((e.target as HTMLInputElement).checked);
  });

  rngDirLight.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblDirLight.textContent = val.toFixed(1);
    sceneController.setLightIntensity(val);
  });

  rngHemiLight.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblHemiLight.textContent = val.toFixed(1);
    sceneController.setAmbientIntensity(val);
  });

  // Zoom slider with logarithmic mapping
  const ZOOM_SLIDER_STEPS = 1000;
  const MIN_ZOOM_FACTOR = 0.2;
  const MIN_ZOOM_DISTANCE = 0.0001;

  function getMaxZoomFactor(): number {
    return Math.max(sceneController.getBaseRadius() / MIN_ZOOM_DISTANCE, MIN_ZOOM_FACTOR * 1.001);
  }

  function sliderToZoom(sliderVal: number): number {
    const maxZoom = getMaxZoomFactor();
    const t = Math.min(Math.max(sliderVal / ZOOM_SLIDER_STEPS, 0), 1);
    return Math.exp(Math.log(MIN_ZOOM_FACTOR) + t * (Math.log(maxZoom) - Math.log(MIN_ZOOM_FACTOR)));
  }

  function zoomToSlider(zoom: number): number {
    const maxZoom = getMaxZoomFactor();
    const t = (Math.log(zoom) - Math.log(MIN_ZOOM_FACTOR)) / (Math.log(maxZoom) - Math.log(MIN_ZOOM_FACTOR));
    return Math.round(Math.min(Math.max(t, 0), 1) * ZOOM_SLIDER_STEPS);
  }

  function formatZoom(zoom: number): string {
    return zoom >= 100 ? zoom.toFixed(0) + 'x' : zoom.toFixed(2) + 'x';
  }

  function syncZoomUI() {
    const zoom = sceneController.getCurrentZoom();
    const sliderVal = zoomToSlider(zoom).toString();
    const text = formatZoom(zoom);
    if (document.activeElement !== rngCameraZoom) {
      rngCameraZoom.value = sliderVal;
    }
    lblCameraZoom.textContent = text;
  }

  sceneController.onCameraRadiusChanged = () => syncZoomUI();

  rngCameraZoom.addEventListener('input', (e) => {
    const sliderVal = parseFloat((e.target as HTMLInputElement).value);
    sceneController.setCameraZoom(sliderToZoom(sliderVal));
    lblCameraZoom.textContent = formatZoom(sceneController.getCurrentZoom());
  });

  // Panning speed
  rngPanningSpeed.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblPanningSpeed.textContent = val.toFixed(1) + 'x';
    sceneController.setPanningSpeed(val);
  });

  // Shading Mode & Diagnostics Listeners
  if (selShadingMode) {
    selShadingMode.addEventListener('change', () => {
      const mode = selShadingMode.value as any;
      sceneController.setShadingMode(mode);
      if (lblShadingTag) {
        const tags: Record<string, string> = {
          pbr: 'PBR 标准',
          wireframe: '全线框',
          clay: '素模',
          normals: '法线检测'
        };
        lblShadingTag.textContent = tags[mode] || 'PBR 标准';
      }
    });
  }

  if (chkAxisGizmo) {
    chkAxisGizmo.addEventListener('change', () => {
      sceneController.setAxisGizmoVisible(chkAxisGizmo.checked);
    });
  }

  if (chkSceneBBox) {
    chkSceneBBox.addEventListener('change', () => {
      sceneController.setSceneBoundingBoxVisible(chkSceneBBox.checked);
    });
  }

  // ==================== 3. Model Tree View & Selection ====================
  function populateModelTree() {
    modelTreeContainer.innerHTML = '';
    const tree = sceneController.getModelHierarchy();
    if (!tree || tree.length === 0) {
      modelTreeContainer.innerHTML = '<div class="tree-empty">该模型无有效子部件</div>';
      selectedNodePanel.style.display = 'none';
      return;
    }
    renderTree(tree, modelTreeContainer);
  }

  function renderTree(nodes: TreeNode[], container: HTMLElement) {
    nodes.forEach((node) => {
      const treeNode = document.createElement('div');
      treeNode.className = 'tree-node';

      const row = document.createElement('div');
      row.className = 'tree-row';
      row.dataset.name = node.name;
      row.dataset.type = node.type;

      // Expand/Collapse toggle icon for groups
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle';
      if (node.type === 'group') {
        toggle.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>`;
      } else {
        toggle.classList.add('spacer');
      }
      row.appendChild(toggle);

      // Node Icon (SVG)
      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      if (node.type === 'group') {
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/></svg>`;
      } else {
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5Z"/></svg>`;
      }
      row.appendChild(icon);

      // Node Name Label
      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = node.name;
      name.title = node.name;
      row.appendChild(name);

      // Mesh count badge for groups
      if (node.type === 'group') {
        const meshCount = countDescendantMeshes(node);
        const countBadge = document.createElement('span');
        countBadge.className = 'tree-mesh-count';
        countBadge.textContent = `${meshCount} 网格`;
        row.appendChild(countBadge);
      }

      // Actions Container (Focus, Visibility, etc.)
      const actions = document.createElement('div');
      actions.className = 'tree-actions';

      // Quick Focus Button
      const btnFocus = document.createElement('button');
      btnFocus.className = 'tree-action-btn';
      btnFocus.title = '对焦视角至该部件';
      btnFocus.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z"/></svg>`;
      btnFocus.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTargetByName(node.name);
        sceneController.focusOnSelected();
      });
      actions.appendChild(btnFocus);

      // Quick Visibility Toggle
      const btnVis = document.createElement('button');
      btnVis.className = 'tree-action-btn';
      btnVis.title = '显示/隐藏部件';
      const isVis = sceneController.isTargetVisible(node.name);
      btnVis.innerHTML = isVis
        ? `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C20.5,15.41 21.21,13.79 21.6,12C19.87,7.61 15.6,4.5 10.6,4.5C9.28,4.5 8.01,4.75 6.83,5.2L8.74,7.11C9.69,6.71 10.8,6.5 12,7Z"/></svg>`;
      if (!isVis) row.classList.add('hidden-node');

      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyVis = sceneController.isTargetVisible(node.name);
        sceneController.setTargetVisible(node.name, !currentlyVis);
        row.classList.toggle('hidden-node', currentlyVis);
        btnVis.innerHTML = !currentlyVis
          ? `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/></svg>`
          : `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C20.5,15.41 21.21,13.79 21.6,12C19.87,7.61 15.6,4.5 10.6,4.5C9.28,4.5 8.01,4.75 6.83,5.2L8.74,7.11C9.69,6.71 10.8,6.5 12,7Z"/></svg>`;
      });
      actions.appendChild(btnVis);
      row.appendChild(actions);

      // Row Selection Click Event
      row.addEventListener('click', () => {
        const isCurrentActive = row.classList.contains('active');
        if (isCurrentActive) {
          selectTargetByName(null);
        } else {
          selectTargetByName(node.name);
        }
      });

      treeNode.appendChild(row);

      // Render Children if group
      let childrenContainer: HTMLDivElement | null = null;
      if (node.children && node.children.length > 0) {
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        renderTree(node.children, childrenContainer);
        treeNode.appendChild(childrenContainer);

        // Link toggle click to children visibility
        if (node.type === 'group') {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.toggle('expanded');
            childrenContainer?.classList.toggle('collapsed');
          });
        }
      }

      container.appendChild(treeNode);
    });
  }

  function countDescendantMeshes(node: TreeNode): number {
    if (node.type === 'mesh') return 1;
    let count = 0;
    node.children?.forEach((child) => {
      if (child.type === 'mesh') count++;
      if (child.children) count += countDescendantMeshes(child);
    });
    return count;
  }

  function selectTargetByName(targetName: string | null) {
    // 1. Remove previous active states and badges
    const prevActive = modelTreeContainer.querySelectorAll('.tree-row.active');
    prevActive.forEach((el) => {
      el.classList.remove('active');
      const badge = el.querySelector('.selected-badge');
      if (badge) badge.remove();
    });

    if (!targetName) {
      sceneController.selectTarget(null);
      selectedStickyToolbar.style.display = 'none';
      updateDragButton(false);
      return;
    }

    try {
      const info = sceneController.selectTarget(targetName);

      if (info) {
        // 2. Locate row in DOM tree
        const targetRow = modelTreeContainer.querySelector(`[data-name="${CSS.escape(info.name)}"]`) as HTMLElement;
        if (targetRow) {
          targetRow.classList.add('active');

          // Append "[当前选中]" / "[当前选中组]" badge
          const badge = document.createElement('span');
          badge.className = `selected-badge ${info.type === 'group' ? 'group' : ''}`;
          badge.textContent = info.type === 'group' ? '当前选中组' : '当前选中';
          targetRow.appendChild(badge);

          // 3. Expand all ancestor collapsed folders
          let parent = targetRow.parentElement;
          while (parent && parent !== modelTreeContainer) {
            if (parent.classList.contains('tree-children') && parent.classList.contains('collapsed')) {
              parent.classList.remove('collapsed');
              const prevSibling = parent.previousElementSibling;
              if (prevSibling) {
                const toggle = prevSibling.querySelector('.tree-toggle');
                if (toggle) toggle.classList.add('expanded');
              }
            }
            parent = parent.parentElement;
          }

          // 4. Scroll smoothly to center the selected row in the view
          setTimeout(() => {
            targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 30);
        }

        // 5. Update Selected Node Sticky Toolbar
        lblSelectedTargetName.textContent = info.name;
        lblSelectedTargetName.title = info.name;
        lblSelectedTag.textContent = info.type === 'group' ? '分组' : '部件';
        lblSelectedTag.className = `tag-badge ${info.type === 'group' ? 'group' : ''}`;
        lblSelectedVerts.textContent = `${info.vertices.toLocaleString()} 顶点`;

        selectedStickyToolbar.style.display = 'flex';
        btnRotateSelected.classList.toggle('active', sceneController.isSelectedRotating());
        chkSelectionHighlight.checked = sceneController.isSelectionHighlightEnabled();

        const currentAlpha = sceneController.getSelectedAlpha();
        rngSelectedAlpha.value = currentAlpha.toString();
        lblSelectedAlpha.textContent = currentAlpha.toFixed(2);

        // Reset drag button state
        isDraggingSelected = false;
        updateDragButton(false);

        if (chkLockToModel.checked) {
          sceneController.focusOnSelected();
        }
      } else {
        selectedStickyToolbar.style.display = 'none';
        updateDragButton(false);
      }
    } catch (err) {
      console.warn('Select target error:', err);
      selectedStickyToolbar.style.display = 'none';
    }
  }

  if (btnDeselectPart) {
    btnDeselectPart.addEventListener('click', () => {
      selectTargetByName(null);
    });
  }

  // Accordion Group Toggle
  const accordionCards = document.querySelectorAll('.accordion-card');
  accordionCards.forEach((card) => {
    const header = card.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.switch') || target.closest('button') || target.closest('input')) return;
        card.classList.toggle('expanded');
      });
    }
  });

  // Selected Node Actions
  btnFocusSelected.addEventListener('click', () => {
    sceneController.focusOnSelected();
  });

  btnHideSelected.addEventListener('click', () => {
    sceneController.setSelectedVisible(false);
  });

  btnShowAllMeshes.addEventListener('click', () => {
    treeDropdownGroup?.classList.remove('open');
    sceneController.showAllMeshes();
  });

  btnDragSelected.addEventListener('click', () => {
    isDraggingSelected = !isDraggingSelected;
    sceneController.toggleDragSelected(isDraggingSelected);
    updateDragButton(isDraggingSelected);
  });

  btnResetSelectedPosition.addEventListener('click', () => {
    sceneController.resetSelectedPosition();
  });

  btnRotateSelected.addEventListener('click', () => {
    const isRotating = !sceneController.isSelectedRotating();
    sceneController.toggleSelectedRotation(isRotating);
    btnRotateSelected.classList.toggle('active', isRotating);
  });

  chkSelectionHighlight.addEventListener('change', (e) => {
    sceneController.setSelectionHighlight((e.target as HTMLInputElement).checked);
  });

  // 11 大全景描边与高亮统合算法描述映射表
  const ALGO_DESCS: Record<string, string> = {
    // 官方原生 7 大系统
    native_outline: '【官方原生】SubMesh 管线自动调度顶点外扩通道。经典 CAD 与游戏纯色等宽硬轮廓线，紧贴模型表面。',
    native_overlay: '【官方原生】在零件表面覆盖半透明纯色光膜，直观突出选中部件本体，不破坏原始材质。',
    native_edges: '【官方原生】GPU 顶点着色器根据面片二面角计算特征硬边，高精勾勒机械倒角与接缝，平滑面无杂线。',
    native_bounding_box: '【官方原生】在 3D 空间以立体线框精确标定选中部件的空间边界与尺寸范围，工业级测量锁定框。',
    native_highlight: '【官方原生】特效渲染层双 Pass 分离式高斯模糊扩散，柔和平滑的科幻霓虹外发光光晕。',
    native_glow: '【官方原生】选中部件本体整体向外辐射辉光，犹如通电自发光物体，科技感强烈。',
    native_wireframe: '【官方原生】材质原生线框着色模式，清晰展示三维几何三角面网格布线与模型结构。',
    // 高阶图形学 4 大系统
    sobel_mask: '【高阶着色】独立 Mask RTT 离屏隔离 + 3x3 Sobel 梯度卷积。工业 CAD 图纸级硬质边缘，外轮廓与转折接缝同时勾勒。',
    fresnel_rim: '【高阶着色】通过视线与法线夹角 pow(1.0 - N·V, p) 计算边缘掠射光。科幻全息投影感与半透外缘高光。',
    xray_seethrough: '【高阶着色】当选中的内部零件被外壳遮挡时，透视穿透显示其轮廓位置，复杂机械装配体透视定位必备。',
    stencil_mask: '【高阶着色】利用硬件 Stencil 模板测试进行像素级内外剪裁。纯色刀刻般锐利，RTS 单位选中框风格。'
  };

  function updateAlgoParamUI(algo: string) {
    if (!rowAlgoParam || !lblAlgoParamTitle || !lblAlgoParamVal || !rngAlgoParam) return;

    if (algo === 'native_overlay') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = '蒙版不透明度 (Alpha)';
      rngAlgoParam.min = '0.1';
      rngAlgoParam.max = '1.0';
      rngAlgoParam.step = '0.05';
      rngAlgoParam.value = '0.45';
      lblAlgoParamVal.textContent = '0.45';
    } else if (algo === 'native_edges') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = '特征折角阈值 (度)';
      rngAlgoParam.min = '5';
      rngAlgoParam.max = '60';
      rngAlgoParam.step = '1';
      rngAlgoParam.value = '25';
      lblAlgoParamVal.textContent = '25°';
    } else if (algo === 'native_glow') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = '泛光辐射强度';
      rngAlgoParam.min = '0.2';
      rngAlgoParam.max = '3.0';
      rngAlgoParam.step = '0.1';
      rngAlgoParam.value = '1.2';
      lblAlgoParamVal.textContent = '1.2';
    } else if (algo === 'sobel_mask') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = 'Sobel 边缘阈值';
      rngAlgoParam.min = '0.05';
      rngAlgoParam.max = '0.6';
      rngAlgoParam.step = '0.02';
      rngAlgoParam.value = '0.25';
      lblAlgoParamVal.textContent = '0.25';
    } else if (algo === 'fresnel_rim') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = '菲涅尔指数 (Power)';
      rngAlgoParam.min = '1';
      rngAlgoParam.max = '8';
      rngAlgoParam.step = '0.5';
      rngAlgoParam.value = '3.0';
      lblAlgoParamVal.textContent = '3.0';
    } else if (algo === 'xray_seethrough') {
      rowAlgoParam.style.display = 'flex';
      lblAlgoParamTitle.textContent = '穿透透视透明度';
      rngAlgoParam.min = '0.1';
      rngAlgoParam.max = '1.0';
      rngAlgoParam.step = '0.05';
      rngAlgoParam.value = '0.6';
      lblAlgoParamVal.textContent = '0.60';
    } else {
      rowAlgoParam.style.display = 'none';
    }
  }

  if (btnCycleOutlineAlgo && selOutlineAlgorithm) {
    btnCycleOutlineAlgo.addEventListener('click', () => {
      const nextIdx = (selOutlineAlgorithm.selectedIndex + 1) % selOutlineAlgorithm.options.length;
      selOutlineAlgorithm.selectedIndex = nextIdx;
      selOutlineAlgorithm.dispatchEvent(new Event('change'));
    });
  }

  if (selOutlineAlgorithm) {
    selOutlineAlgorithm.addEventListener('change', () => {
      const algo = selOutlineAlgorithm.value as any;
      sceneController.setOutlineAlgorithm(algo);
      if (lblOutlineAlgoDesc) {
        lblOutlineAlgoDesc.textContent = ALGO_DESCS[algo] || '';
      }
      if (lblAlgoCategory) {
        const isOfficial = algo.startsWith('native_');
        lblAlgoCategory.textContent = isOfficial ? '官方原生' : '高阶着色';
        lblAlgoCategory.className = `algo-category-tag ${isOfficial ? '' : 'advanced'}`;
      }
      updateAlgoParamUI(algo);
    });
  }

  if (rngAlgoParam && lblAlgoParamVal) {
    rngAlgoParam.addEventListener('input', () => {
      const val = parseFloat(rngAlgoParam.value);
      const algo = selOutlineAlgorithm.value;
      if (algo === 'native_overlay') {
        lblAlgoParamVal.textContent = val.toFixed(2);
        sceneController.setOutlineParams({ overlayAlpha: val });
      } else if (algo === 'native_edges') {
        lblAlgoParamVal.textContent = `${Math.round(val)}°`;
        sceneController.setOutlineParams({ edgeAngle: val });
      } else if (algo === 'native_glow') {
        lblAlgoParamVal.textContent = val.toFixed(1);
        sceneController.setOutlineParams({ glowIntensity: val });
      } else if (algo === 'sobel_mask') {
        lblAlgoParamVal.textContent = val.toFixed(2);
        sceneController.setOutlineParams({ depthThreshold: val });
      } else if (algo === 'fresnel_rim') {
        lblAlgoParamVal.textContent = val.toFixed(1);
        sceneController.setOutlineParams({ fresnelPower: val });
      } else if (algo === 'xray_seethrough') {
        lblAlgoParamVal.textContent = val.toFixed(2);
        sceneController.setOutlineParams({ xrayAlpha: val });
      }
    });
  }

  // Categorized Outline Color Palette Listeners
  const customColorBtn = document.querySelector('.custom-color-strip-btn') as HTMLElement;

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach((s) => s.classList.remove('active'));
      if (customColorBtn) customColorBtn.classList.remove('active');
      swatch.classList.add('active');
      const color = swatch.dataset.color || '#00f2fe';
      if (pickerOutlineColor) pickerOutlineColor.value = color;
      if (customColorPreview) customColorPreview.style.background = color;
      if (lblCustomColorHex) lblCustomColorHex.textContent = color.toUpperCase();
      sceneController.setOutlineColor(color);
    });
  });

  if (pickerOutlineColor) {
    pickerOutlineColor.addEventListener('input', () => {
      colorSwatches.forEach((s) => s.classList.remove('active'));
      if (customColorBtn) customColorBtn.classList.add('active');
      const color = pickerOutlineColor.value;
      if (customColorPreview) customColorPreview.style.background = color;
      if (lblCustomColorHex) lblCustomColorHex.textContent = color.toUpperCase();
      sceneController.setOutlineColor(color);
    });
  }

  if (rngOutlineWidth && lblOutlineWidth) {
    rngOutlineWidth.addEventListener('input', () => {
      const val = parseFloat(rngOutlineWidth.value);
      lblOutlineWidth.textContent = val.toFixed(3);
      sceneController.setOutlineWidth(val);
    });
  }

  // ==================== 3. Mesh Rounding & Beveling System ====================
  let roundingScope: 'selected' | 'all' = 'all';

  const ROUNDING_DESCS: Record<string, string> = {
    normals: '【法线倒角】通过重算法线夹角实现光影圆润高光，零面数开销，不破坏原有几何与贴图。',
    laplacian: '【几何圆角】拉普拉斯物理网格平滑松弛，直接改变顶点物理坐标，消除直角棱边。',
    subdivision: '【曲面细分】结合曲率自适应与法线平滑，产生柔和光滑的工业级流线曲面。'
  };

  if (btnScopeSelected && btnScopeAll) {
    btnScopeSelected.addEventListener('click', () => {
      roundingScope = 'selected';
      btnScopeSelected.classList.add('active');
      btnScopeAll.classList.remove('active');
      if (lblRoundingTargetTag) lblRoundingTargetTag.textContent = '选中部件';
      triggerRealtimeRounding();
    });

    btnScopeAll.addEventListener('click', () => {
      roundingScope = 'all';
      btnScopeAll.classList.add('active');
      btnScopeSelected.classList.remove('active');
      if (lblRoundingTargetTag) lblRoundingTargetTag.textContent = '全局模型';
      triggerRealtimeRounding();
    });
  }

  function triggerRealtimeRounding() {
    const mode = (selRoundingMode ? selRoundingMode.value : 'normals') as any;
    const angleThreshold = rngRoundingAngle ? parseFloat(rngRoundingAngle.value) : 45;
    const strength = rngRoundingStrength ? parseFloat(rngRoundingStrength.value) : 0.35;
    const iterations = rngRoundingIter ? parseInt(rngRoundingIter.value, 10) : 2;

    const count = sceneController.applyRounding(roundingScope, mode, {
      angleThreshold,
      strength,
      iterations
    });

    if (lblRoundingStatus) {
      if (count > 0) {
        lblRoundingStatus.textContent = `实时生效 (${count} 个部件网格): ${
          mode === 'normals'
            ? `${angleThreshold}° 倒角`
            : mode === 'laplacian'
            ? `${Math.round(strength * 100)}% 强度 (${iterations}次迭代)`
            : '细分平滑'
        }`;
        lblRoundingStatus.style.color = 'var(--accent-cyan)';
      } else {
        lblRoundingStatus.textContent = roundingScope === 'selected' ? '请先在视口中左键选中任意部件' : '模型暂无网格';
        lblRoundingStatus.style.color = '#ff6b81';
      }
    }
  }

  if (selRoundingMode) {
    selRoundingMode.addEventListener('change', () => {
      const mode = selRoundingMode.value;
      if (lblRoundingDesc) lblRoundingDesc.textContent = ROUNDING_DESCS[mode] || '';

      if (mode === 'normals') {
        if (rowRoundingAngle) rowRoundingAngle.style.display = 'flex';
        if (rowRoundingStrength) rowRoundingStrength.style.display = 'none';
        if (rowRoundingIter) rowRoundingIter.style.display = 'none';
      } else if (mode === 'laplacian') {
        if (rowRoundingAngle) rowRoundingAngle.style.display = 'none';
        if (rowRoundingStrength) rowRoundingStrength.style.display = 'flex';
        if (rowRoundingIter) rowRoundingIter.style.display = 'flex';
      } else if (mode === 'subdivision') {
        if (rowRoundingAngle) rowRoundingAngle.style.display = 'flex';
        if (rowRoundingStrength) rowRoundingStrength.style.display = 'flex';
        if (rowRoundingIter) rowRoundingIter.style.display = 'none';
      }
      triggerRealtimeRounding();
    });
  }

  if (rngRoundingAngle && lblRoundingAngle) {
    rngRoundingAngle.addEventListener('input', () => {
      lblRoundingAngle.textContent = `${rngRoundingAngle.value}°`;
      triggerRealtimeRounding();
    });
  }

  if (rngRoundingStrength && lblRoundingStrength) {
    rngRoundingStrength.addEventListener('input', () => {
      lblRoundingStrength.textContent = `${Math.round(parseFloat(rngRoundingStrength.value) * 100)}%`;
      triggerRealtimeRounding();
    });
  }

  if (rngRoundingIter && lblRoundingIter) {
    rngRoundingIter.addEventListener('input', () => {
      lblRoundingIter.textContent = `${rngRoundingIter.value} 次`;
      triggerRealtimeRounding();
    });
  }

  if (btnResetRounding) {
    btnResetRounding.addEventListener('click', () => {
      sceneController.resetRounding(roundingScope);
      if (lblRoundingStatus) {
        lblRoundingStatus.textContent = `已复原为原始几何网格形态 (${roundingScope === 'selected' ? '选中部件' : '全局模型'})`;
        lblRoundingStatus.style.color = 'var(--text-muted)';
      }
    });
  }

  rngSelectedAlpha.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblSelectedAlpha.textContent = val.toFixed(2);
    sceneController.setSelectedAlpha(val);
  });

  function updateDragButton(enabled: boolean) {
    btnDragSelected.classList.toggle('active', enabled);
  }

  // Tree Dropdown Menu Toggle
  if (btnTreeDropdown && treeDropdownGroup) {
    btnTreeDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      treeDropdownGroup.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!treeDropdownGroup.contains(e.target as Node)) {
        treeDropdownGroup.classList.remove('open');
      }
    });
  }

  // Tree Expand / Collapse all
  btnExpandAll.addEventListener('click', () => {
    treeDropdownGroup?.classList.remove('open');
    const toggles = modelTreeContainer.querySelectorAll('.tree-toggle');
    const childrenContainers = modelTreeContainer.querySelectorAll('.tree-children');
    toggles.forEach((t) => t.classList.add('expanded'));
    childrenContainers.forEach((c) => c.classList.remove('collapsed'));
  });

  btnCollapseAll.addEventListener('click', () => {
    treeDropdownGroup?.classList.remove('open');
    const toggles = modelTreeContainer.querySelectorAll('.tree-toggle');
    const childrenContainers = modelTreeContainer.querySelectorAll('.tree-children');
    toggles.forEach((t) => t.classList.remove('expanded'));
    childrenContainers.forEach((c) => c.classList.add('collapsed'));
  });

  // Tree Search
  txtSearchMesh.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
    const tree = sceneController.getModelHierarchy();
    if (!tree) return;

    modelTreeContainer.innerHTML = '';
    if (query === '') {
      renderTree(tree, modelTreeContainer);
    } else {
      const filtered = filterTree(tree, query);
      if (filtered.length === 0) {
        modelTreeContainer.innerHTML = '<div class="tree-empty">无匹配部件或分组</div>';
      } else {
        renderTree(filtered, modelTreeContainer);
        // Expand matches
        const toggles = modelTreeContainer.querySelectorAll('.tree-toggle');
        const children = modelTreeContainer.querySelectorAll('.tree-children');
        toggles.forEach((t) => t.classList.add('expanded'));
        children.forEach((c) => c.classList.remove('collapsed'));
      }
    }
  });

  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    const result: TreeNode[] = [];
    nodes.forEach((node) => {
      if (node.name.toLowerCase().includes(query)) {
        result.push(node);
      } else if (node.children) {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
        }
      }
    });
    return result;
  }

  // ==================== 4. 3D Viewport Raycast Single & Double Click ====================
  let pointerDownTime = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownButton = -1;

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownButton = e.button;
    if (e.button === 0) {
      pointerDownTime = Date.now();
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    // Only left click (e.button === 0) can select models; right click is purely for panning displacement
    if (e.button !== 0 || pointerDownButton !== 0) return;

    const clickDuration = Date.now() - pointerDownTime;
    const dragDistance = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);

    // Filter out camera orbit rotations (must be a quick tap within 4px)
    if (clickDuration < 280 && dragDistance < 4) {
      const pickResult = sceneController.scene.pick(
        sceneController.scene.pointerX,
        sceneController.scene.pointerY
      );
      if (pickResult && pickResult.hit && pickResult.pickedMesh) {
        const name = pickResult.pickedMesh.name;
        if (name !== "shadowGround" && name !== "gridLines" && name !== "grid") {
          selectTargetByName(name);
        } else {
          // Click on background ground deselects
          selectTargetByName(null);
        }
      } else {
        // Click on empty space deselects
        selectTargetByName(null);
      }
    }
  });

  canvas.addEventListener('dblclick', (e) => {
    if (e.button !== 0) return;
    const pickResult = sceneController.scene.pick(
      sceneController.scene.pointerX,
      sceneController.scene.pointerY
    );
    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      const name = pickResult.pickedMesh.name;
      if (name !== "shadowGround" && name !== "gridLines" && name !== "grid") {
        selectTargetByName(name);
        sceneController.focusOnSelected();
      }
    }
  });

  // Prevent browser context menu on canvas so right-click is dedicated to camera panning
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // ==================== 5. Bottom Floating Animation Timeline ====================
  function formatFrameNumber(current: number, total: number): string {
    const curStr = Math.round(current).toString().padStart(4, '0');
    const totStr = Math.round(total).toString().padStart(4, '0');
    return `${curStr} / ${totStr} 帧`;
  }

  function formatTimeNumber(current: number, total: number, fps: number = 30): string {
    const curSec = (current / fps).toFixed(1);
    const totSec = (total / fps).toFixed(1);
    return `${curSec}s / ${totSec}s`;
  }

  function initAnimationTimeline() {
    const animNames = sceneController.getAnimationNames();
    if (animNames.length === 0) {
      bottomTimeline.style.display = 'none';
      return;
    }

    selTimelineTrack.innerHTML = '';
    animNames.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selTimelineTrack.appendChild(opt);
    });

    bottomTimeline.style.display = 'flex';
    updateTimelineTrack();
  }

  function updateTimelineTrack() {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;

    const range = sceneController.getAnimationRange(activeTrack);
    if (range) {
      rngTimelineScrubber.min = range.from.toString();
      rngTimelineScrubber.max = range.to.toString();
      rngTimelineScrubber.value = range.from.toString();
      lblTimelineFrame.textContent = formatFrameNumber(range.from, range.to);
      lblTimelineTime.textContent = formatTimeNumber(0, range.totalFrames);
    }

    const isPlaying = sceneController.isAnimationPlaying(activeTrack);
    updatePlayPauseButton(isPlaying);

    const isLoop = sceneController.isAnimationLooping(activeTrack);
    btnTimelineLoop.classList.toggle('active', isLoop);
  }

  function updatePlayPauseButton(isPlaying: boolean) {
    if (isPlaying) {
      btnTimelinePlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
        </svg>
      `;
      btnTimelinePlayPause.title = "暂停动画";
    } else {
      btnTimelinePlayPause.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
      `;
      btnTimelinePlayPause.title = "播放动画";
    }
  }

  btnTimelinePlayPause.addEventListener('click', () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;

    const isPlaying = sceneController.isAnimationPlaying(activeTrack);
    if (isPlaying) {
      sceneController.pauseAnimation(activeTrack);
      updatePlayPauseButton(false);
    } else {
      sceneController.playAnimation(activeTrack);
      updatePlayPauseButton(true);
    }
  });

  btnTimelinePrevFrame.addEventListener('click', () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;
    sceneController.pauseAnimation(activeTrack);
    updatePlayPauseButton(false);
    sceneController.stepAnimationFrame(activeTrack, -1);
    syncTimelineFrameDisplay();
  });

  btnTimelineNextFrame.addEventListener('click', () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;
    sceneController.pauseAnimation(activeTrack);
    updatePlayPauseButton(false);
    sceneController.stepAnimationFrame(activeTrack, 1);
    syncTimelineFrameDisplay();
  });

  btnTimelineLoop.addEventListener('click', () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;
    const newLoop = !sceneController.isAnimationLooping(activeTrack);
    sceneController.setAnimationLoop(activeTrack, newLoop);
    btnTimelineLoop.classList.toggle('active', newLoop);
    btnTimelineLoop.title = newLoop ? "循环播放 (点击切为单次)" : "单次播放 (点击切为循环)";
  });

  selTimelineSpeed.addEventListener('change', () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;
    const speed = parseFloat(selTimelineSpeed.value);
    sceneController.setAnimationSpeed(activeTrack, speed);
  });

  selTimelineTrack.addEventListener('change', () => {
    updateTimelineTrack();
  });

  // Scrubber drag & seek event handlers
  const applyScrubberFrame = () => {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;
    const frame = parseFloat(rngTimelineScrubber.value);
    sceneController.goToAnimationFrame(activeTrack, frame);

    const range = sceneController.getAnimationRange(activeTrack);
    if (range) {
      lblTimelineFrame.textContent = formatFrameNumber(Math.round(frame), range.to);
      lblTimelineTime.textContent = formatTimeNumber(Math.max(0, frame - range.from), range.totalFrames);
    }
  };

  rngTimelineScrubber.addEventListener('pointerdown', () => {
    isScrubberUserInteracting = true;
    const activeTrack = selTimelineTrack.value;
    if (activeTrack) {
      wasPlayingBeforeScrub = sceneController.isAnimationPlaying(activeTrack);
      if (wasPlayingBeforeScrub) {
        sceneController.pauseAnimation(activeTrack);
        updatePlayPauseButton(false);
      }
    }
    applyScrubberFrame();
  });

  rngTimelineScrubber.addEventListener('input', () => {
    if (!activeTrack) return;
    const frame = parseFloat(rngTimelineScrubber.value);
    sceneController.goToAnimationFrame(activeTrack, frame);
    syncTimelineFrameDisplay();
  });

  const onScrubberRelease = () => {
    if (isScrubberUserInteracting) {
      isScrubberUserInteracting = false;
      const activeTrack = selTimelineTrack.value;
      if (activeTrack && wasPlayingBeforeScrub) {
        sceneController.playAnimation(activeTrack);
        updatePlayPauseButton(true);
      }
    }
  };

  rngTimelineScrubber.addEventListener('pointerup', onScrubberRelease);
  rngTimelineScrubber.addEventListener('change', onScrubberRelease);

  function syncTimelineFrameDisplay() {
    const activeTrack = selTimelineTrack.value;
    if (!activeTrack) return;

    const range = sceneController.getAnimationRange(activeTrack);
    if (!range) return;

    const currentFrame = sceneController.getCurrentAnimationFrame(activeTrack);
    rngTimelineScrubber.value = currentFrame.toString();
    lblTimelineFrame.textContent = formatFrameNumber(currentFrame, range.to);
    lblTimelineTime.textContent = formatTimeNumber(Math.max(0, currentFrame - range.from), range.totalFrames);
  }

  // Animation end observer callback
  sceneController.animationManager.onAnimationEnded = (animName) => {
    if (selTimelineTrack.value === animName) {
      updatePlayPauseButton(false);
      syncTimelineFrameDisplay();
    }
  };

  // Render loop ticker for smooth FPS, Draw Calls, Frame Time and Animation Timeline scrubber sync
  let frameCounter = 0;
  sceneController.scene.onAfterRenderObservable.add(() => {
    frameCounter++;
    if (frameCounter % 20 === 0) {
      const stats = sceneController.getPerformanceStats();
      statFps.textContent = stats.fps.toString();
      if (statDrawCalls) statDrawCalls.textContent = stats.drawCalls.toString();
      if (statFrameTime) statFrameTime.textContent = stats.frameTimeMs.toFixed(1);
    }

    // Sync animation progress if playing and not being dragged by user
    const activeTrack = selTimelineTrack.value;
    if (activeTrack && sceneController.isAnimationPlaying(activeTrack) && !isScrubberUserInteracting) {
      syncTimelineFrameDisplay();
    }
  });

  // ==================== 6. File Import & Drag/Drop Handlers ====================
  btnUploadTop.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') {
      modelFileInput.click();
    }
  });

  modelFileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleModelFile(files[0]);
    }
  });

  let dragCounter = 0;

  // Prevent default dragover and dragenter on window so drop is permitted by browser
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      dropzoneOverlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropzoneOverlay.classList.remove('active');
    }
  });

  const onFileDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;
    dropzoneOverlay.classList.remove('active');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleModelFile(files[0]);
    }
  };

  window.addEventListener('drop', onFileDrop);
  dropzoneOverlay.addEventListener('drop', onFileDrop);

  async function handleModelFile(file: File) {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'glb' && extension !== 'gltf') {
      alert('仅支持载入 .glb 或 .gltf 格式的 3D 模型！');
      return;
    }

    loadingOverlay.classList.add('active');

    setTimeout(async () => {
      try {
        const summary = await sceneController.loadModelFromFile(file);
        console.log(summary);

        let totalVertices = 0;
        let meshCount = 0;

        sceneController.scene.meshes.forEach((m) => {
          if (m.name !== "shadowGround" && m.name !== "gridLines" && m.name !== "grid") {
            if (m.getTotalVertices() > 0) {
              meshCount++;
              totalVertices += m.getTotalVertices();
            }
          }
        });

        statModelName.textContent = file.name;
        statModelName.title = file.name;
        statMeshes.textContent = meshCount.toString();
        statVertices.textContent = totalVertices.toLocaleString();

        sceneController.setCameraZoom(1.0);
        syncZoomUI();

        // Update Upload Button Text to "更换模型"
        if (btnUploadTopText) {
          btnUploadTopText.textContent = "更换模型";
        }

        // Build model tree
        txtSearchMesh.value = '';
        populateModelTree();
        selectTargetByName(null);

        // Initialize timeline
        initAnimationTimeline();

      } catch (err) {
        console.error('Error importing model:', err);
        alert(`加载模型失败：${err instanceof Error ? err.message : String(err)}\n请确保模型文件无损坏且包含有效的网格数据。`);
      } finally {
        loadingOverlay.classList.remove('active');
      }
    }, 120);
  }

  // Initialize Zoom UI on startup
  syncZoomUI();
});

