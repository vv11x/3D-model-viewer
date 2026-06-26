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

  // Page Navigation
  const pageOverview = document.getElementById('pageOverview') as HTMLDivElement;
  const pageDetail = document.getElementById('pageDetail') as HTMLDivElement;
  const pageTitle = document.getElementById('pageTitle') as HTMLHeadingElement;
  const pageSubtitle = document.getElementById('pageSubtitle') as HTMLParagraphElement;
  const btnViewDetail = document.getElementById('btnViewDetail') as HTMLButtonElement;
  const btnBackToOverview = document.getElementById('btnBackToOverview') as HTMLButtonElement;

  function showPage(page: 'overview' | 'detail') {
    if (page === 'overview') {
      pageOverview.classList.add('active');
      pageDetail.classList.remove('active');
      pageTitle.textContent = '仿真相机与环境控制';
      pageSubtitle.textContent = '实时 3D 渲染与参数配置';
    } else {
      pageOverview.classList.remove('active');
      pageDetail.classList.add('active');
      pageTitle.textContent = '模型详情';
      pageSubtitle.textContent = '结构、部件与动画';
    }
  }

  btnViewDetail.addEventListener('click', () => showPage('detail'));
  btnBackToOverview.addEventListener('click', () => showPage('overview'));

  // DOM Control References
  const btnResetCamera = document.getElementById('btnResetCamera') as HTMLButtonElement;
  const chkAutoRotate = document.getElementById('chkAutoRotate') as HTMLInputElement;
  const chkLockToModel = document.getElementById('chkLockToModel') as HTMLInputElement;
  
  const rngCameraZoom = document.getElementById('rngCameraZoom') as HTMLInputElement;
  const lblCameraZoom = document.getElementById('lblCameraZoom') as HTMLSpanElement;
  const rngPanningSpeed = document.getElementById('rngPanningSpeed') as HTMLInputElement;
  const lblPanningSpeed = document.getElementById('lblPanningSpeed') as HTMLSpanElement;
  const rngCameraZoom2 = document.getElementById('rngCameraZoom2') as HTMLInputElement;
  const lblCameraZoom2 = document.getElementById('lblCameraZoom2') as HTMLSpanElement;
  const rngPanningSpeed2 = document.getElementById('rngPanningSpeed2') as HTMLInputElement;
  const lblPanningSpeed2 = document.getElementById('lblPanningSpeed2') as HTMLSpanElement;
  
  const rngDirLight = document.getElementById('rngDirLight') as HTMLInputElement;
  const lblDirLight = document.getElementById('lblDirLight') as HTMLSpanElement;
  const rngHemiLight = document.getElementById('rngHemiLight') as HTMLInputElement;
  const lblHemiLight = document.getElementById('lblHemiLight') as HTMLSpanElement;
  
  const chkShowGrid = document.getElementById('chkShowGrid') as HTMLInputElement;
  const chkEnableShadows = document.getElementById('chkEnableShadows') as HTMLInputElement;
  
  const btnToggleInspector = document.getElementById('btnToggleInspector') as HTMLButtonElement;
  
  const uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
  const modelFileInput = document.getElementById('modelFileInput') as HTMLInputElement;
  const modelInfoPanel = document.getElementById('modelInfoPanel') as HTMLDivElement;
  const lblModelInfoName = document.getElementById('lblModelInfoName') as HTMLSpanElement;
  const lblModelInfoMeshes = document.getElementById('lblModelInfoMeshes') as HTMLSpanElement;
  const lblModelInfoVertices = document.getElementById('lblModelInfoVertices') as HTMLSpanElement;
  const btnChangeModel = document.getElementById('btnChangeModel') as HTMLButtonElement;
  
  const dropzoneOverlay = document.getElementById('dropzoneOverlay') as HTMLDivElement;
  const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement;

  // Detail Page UI Elements
  const txtSearchMesh = document.getElementById('txtSearchMesh') as HTMLInputElement;
  const modelTreeContainer = document.getElementById('modelTreeContainer') as HTMLDivElement;
  const selectedMeshPanel = document.getElementById('selectedMeshPanel') as HTMLDivElement;
  const lblSelectedMeshName = document.getElementById('lblSelectedMeshName') as HTMLSpanElement;
  const btnLockToSelected = document.getElementById('btnLockToSelected') as HTMLButtonElement;
  const chkRotateSelectedMesh = document.getElementById('chkRotateSelectedMesh') as HTMLInputElement;
  const chkSelectionHighlight = document.getElementById('chkSelectionHighlight') as HTMLInputElement;
  const chkHideSelectedMesh = document.getElementById('chkHideSelectedMesh') as HTMLInputElement;
  const rngMeshAlpha = document.getElementById('rngMeshAlpha') as HTMLInputElement;
  const lblMeshAlpha = document.getElementById('lblMeshAlpha') as HTMLSpanElement;

  // Model Animations UI Elements
  const animationPanel = document.getElementById('animationPanel') as HTMLDivElement;
  const selAnimation = document.getElementById('selAnimation') as HTMLSelectElement;
  const btnPlayPauseAnimation = document.getElementById('btnPlayPauseAnimation') as HTMLButtonElement;
  const btnPlayPauseText = document.getElementById('btnPlayPauseText') as HTMLSpanElement;
  const rngAnimationSpeed = document.getElementById('rngAnimationSpeed') as HTMLInputElement;
  const lblAnimationSpeed = document.getElementById('lblAnimationSpeed') as HTMLSpanElement;
  
  // Telemetry DOM References
  const statFps = document.getElementById('statFps') as HTMLSpanElement;
  const statMeshes = document.getElementById('statMeshes') as HTMLSpanElement;
  const statVertices = document.getElementById('statVertices') as HTMLSpanElement;
  const statModelName = document.getElementById('statModelName') as HTMLSpanElement;

  // 1. Camera Bindings
  btnResetCamera.addEventListener('click', () => {
    sceneController.resetCamera();
    rngCameraZoom.value = '1.0';
    lblCameraZoom.textContent = '1.00x';
  });

  chkAutoRotate.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    sceneController.toggleAutoRotate(target.checked);
  });

  chkLockToModel.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    sceneController.setCameraTargetLock(target.checked);
  });

  // 1.2 Sub-meshes list selection & locking bindings
  btnLockToSelected.addEventListener('click', () => {
    sceneController.lockCameraToSelected();
  });

  chkRotateSelectedMesh.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    sceneController.toggleSelectedMeshRotation(target.checked);
  });

  chkSelectionHighlight.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    sceneController.setSelectionHighlight(target.checked);
  });

  chkHideSelectedMesh.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    sceneController.setSelectedMeshVisible(!target.checked);
  });

  rngMeshAlpha.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblMeshAlpha.textContent = val.toFixed(2);
    sceneController.setSelectedMeshAlpha(val);
  });

  // 1.1 Camera Zoom Binding
  function updateCameraZoom(val: number) {
    lblCameraZoom.textContent = val.toFixed(2) + 'x';
    lblCameraZoom2.textContent = val.toFixed(2) + 'x';
    rngCameraZoom.value = val.toString();
    rngCameraZoom2.value = val.toString();
    sceneController.setCameraZoom(val);
  }

  rngCameraZoom.addEventListener('input', (e) => {
    updateCameraZoom(parseFloat((e.target as HTMLInputElement).value));
  });

  rngCameraZoom2.addEventListener('input', (e) => {
    updateCameraZoom(parseFloat((e.target as HTMLInputElement).value));
  });

  function updatePanningSpeed(val: number) {
    lblPanningSpeed.textContent = val.toFixed(1) + 'x';
    lblPanningSpeed2.textContent = val.toFixed(1) + 'x';
    rngPanningSpeed.value = val.toString();
    rngPanningSpeed2.value = val.toString();
    sceneController.setPanningSpeed(val);
  }

  rngPanningSpeed.addEventListener('input', (e) => {
    updatePanningSpeed(parseFloat((e.target as HTMLInputElement).value));
  });

  rngPanningSpeed2.addEventListener('input', (e) => {
    updatePanningSpeed(parseFloat((e.target as HTMLInputElement).value));
  });

  // 1.3 Model Animation Bindings
  btnPlayPauseAnimation.addEventListener('click', () => {
    const activeAnim = selAnimation.value;
    if (!activeAnim) return;

    const isPlaying = sceneController.isAnimationPlaying(activeAnim);
    if (isPlaying) {
      sceneController.pauseAnimation(activeAnim);
      updatePlayPauseButton(false);
    } else {
      sceneController.playAnimation(activeAnim, true);
      updatePlayPauseButton(true);
    }
  });

  rngAnimationSpeed.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblAnimationSpeed.textContent = val.toFixed(1) + 'x';
    const activeAnim = selAnimation.value;
    if (activeAnim) {
      sceneController.setAnimationSpeed(activeAnim, val);
    }
  });

  selAnimation.addEventListener('change', () => {
    const activeAnim = selAnimation.value;
    if (activeAnim) {
      const isPlaying = sceneController.isAnimationPlaying(activeAnim);
      updatePlayPauseButton(isPlaying);
      
      rngAnimationSpeed.value = '1.0';
      lblAnimationSpeed.textContent = '1.0x';
      sceneController.setAnimationSpeed(activeAnim, 1.0);
    }
  });

  function updatePlayPauseButton(isPlaying: boolean) {
    if (isPlaying) {
      btnPlayPauseText.textContent = "暂停动画";
      btnPlayPauseAnimation.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" class="play-icon">
          <path fill="currentColor" d="M14,19H18V5H14M6,19H10V5H6V19Z" />
        </svg>
        <span id="btnPlayPauseText">暂停动画</span>
      `;
    } else {
      btnPlayPauseText.textContent = "播放动画";
      btnPlayPauseAnimation.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" class="play-icon">
          <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
        <span id="btnPlayPauseText">播放动画</span>
      `;
    }
  }

  // 2. Lighting Bindings
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

  // 3. Environment Grid & Shadows Bindings
  chkShowGrid.addEventListener('change', (e) => {
    sceneController.setGridVisibility((e.target as HTMLInputElement).checked);
  });

  chkEnableShadows.addEventListener('change', (e) => {
    sceneController.setShadowsEnabled((e.target as HTMLInputElement).checked);
  });

  // 4. Debug Inspector Toggle
  btnToggleInspector.addEventListener('click', () => {
    sceneController.toggleInspector();
  });

  // 5. File Import & Drag/Drop Handlers
  const triggerFileSelect = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'LABEL') {
      modelFileInput.click();
    }
  };

  uploadArea.addEventListener('click', triggerFileSelect);

  btnChangeModel.addEventListener('click', () => {
    modelFileInput.click();
  });

  modelFileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleModelFile(files[0]);
    }
  });

  // Drag Overlay events (Window-wide drag to activate overlay)
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      dropzoneOverlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      dropzoneOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropzoneOverlay.classList.remove('active');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleModelFile(files[0]);
    }
  });

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
        statMeshes.textContent = meshCount.toString();
        statVertices.textContent = totalVertices.toLocaleString();
        
        lblModelInfoName.textContent = file.name;
        lblModelInfoMeshes.textContent = meshCount.toString();
        lblModelInfoVertices.textContent = totalVertices.toLocaleString();
        uploadArea.style.display = 'none';
        modelInfoPanel.style.display = 'flex';
        
        rngCameraZoom.value = '1.0';
        lblCameraZoom.textContent = '1.00x';
        sceneController.setCameraZoom(1.0);
        
        // Build model tree
        txtSearchMesh.value = '';
        populateModelTree();
        selectMeshByName(null);

        // Populate animations dropdown
        const animNames = sceneController.getAnimationNames();
        if (animNames.length > 0) {
          selAnimation.innerHTML = '';
          animNames.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            selAnimation.appendChild(opt);
          });
          
          animationPanel.style.display = 'flex';
          updatePlayPauseButton(false);
          
          rngAnimationSpeed.value = '1.0';
          lblAnimationSpeed.textContent = '1.0x';
          sceneController.setAnimationSpeed(selAnimation.value, 1.0);
        } else {
          animationPanel.style.display = 'none';
        }
        
      } catch (err) {
        console.error('Error importing mesh:', err);
        alert(`加载模型失败：${err instanceof Error ? err.message : String(err)}\n请确保模型文件无损坏且包含有效的网格数据。`);
      } finally {
        loadingOverlay.classList.remove('active');
      }
    }, 150);
  }

  // 6. Scene telemetry loop (smooth FPS updates)
  let frameCounter = 0;
  sceneController.scene.onAfterRenderObservable.add(() => {
    frameCounter++;
    if (frameCounter % 30 === 0) {
      statFps.textContent = Math.round(sceneController.engine.getFps()).toString();
    }
  });

  // 7. Model Tree View
  let allMeshNames: string[] = [];

  function populateModelTree() {
    modelTreeContainer.innerHTML = '';
    allMeshNames = [];

    const tree = sceneController.getModelHierarchy();
    if (!tree || tree.length === 0) {
      modelTreeContainer.innerHTML = '<div class="mesh-placeholder">该模型无有效子部件</div>';
      selectedMeshPanel.style.display = 'none';
      return;
    }

    collectMeshNames(tree);
    renderTree(tree, modelTreeContainer);
  }

  function collectMeshNames(nodes: TreeNode[]) {
    nodes.forEach((node) => {
      if (node.type === 'mesh' && node.meshName) {
        allMeshNames.push(node.meshName);
      }
      if (node.children) {
        collectMeshNames(node.children);
      }
    });
  }

  function renderTree(nodes: TreeNode[], container: HTMLElement) {
    nodes.forEach((node) => {
      const treeNode = document.createElement('div');
      treeNode.className = 'tree-node';

      const row = document.createElement('div');
      row.className = 'tree-row';

      if (node.children && node.children.length > 0) {
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" /></svg>`;
        row.appendChild(toggle);

        const icon = document.createElement('span');
        icon.className = 'tree-icon folder';
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" /></svg>`;
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        const count = document.createElement('span');
        count.className = 'tree-vertices';
        count.textContent = `${countDescendantMeshes(node)} 部件`;
        row.appendChild(count);

        treeNode.appendChild(row);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children collapsed';
        renderTree(node.children, childrenContainer);
        treeNode.appendChild(childrenContainer);

        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          toggle.classList.toggle('expanded');
          childrenContainer.classList.toggle('collapsed');
        });

        row.addEventListener('click', () => {
          sceneController.focusOnGroup(node.name);
        });
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'tree-toggle-placeholder';
        row.appendChild(placeholder);

        const icon = document.createElement('span');
        icon.className = 'tree-icon mesh';
        icon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L5,8.09V15.91L12,19.85L19,15.91V8.09L12,4.15Z" /></svg>`;
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        if (node.vertices !== undefined && node.vertices > 0) {
          const verts = document.createElement('span');
          verts.className = 'tree-vertices';
          verts.textContent = node.vertices.toLocaleString();
          row.appendChild(verts);
        }

        if (node.meshName) {
          row.setAttribute('data-mesh', node.meshName);
          row.addEventListener('click', () => {
            selectMeshByName(node.meshName!);
          });
          row.addEventListener('dblclick', () => {
            selectMeshByName(node.meshName!);
            sceneController.lockCameraToSelected();
          });
        }

        treeNode.appendChild(row);
      }

      container.appendChild(treeNode);
    });
  }

  function countDescendantMeshes(node: TreeNode): number {
    if (!node.children) return 0;
    let count = 0;
    node.children.forEach((child) => {
      if (child.type === 'mesh') count++;
      if (child.children) count += countDescendantMeshes(child);
    });
    return count;
  }

  function selectMeshByName(name: string | null) {
    const info = sceneController.selectMesh(name);

    const activeRows = modelTreeContainer.querySelectorAll('.tree-row.active');
    activeRows.forEach((el) => el.classList.remove('active'));

    if (info) {
      const targetRow = modelTreeContainer.querySelector(`[data-mesh="${CSS.escape(info.name)}"]`);
      if (targetRow) {
        targetRow.classList.add('active');
        targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      lblSelectedMeshName.textContent = info.name;
      selectedMeshPanel.style.display = 'flex';
      chkRotateSelectedMesh.checked = sceneController.isSelectedMeshRotating();
      chkHideSelectedMesh.checked = false;
      rngMeshAlpha.value = '1';
      lblMeshAlpha.textContent = '1.00';

      if (chkLockToModel.checked) {
        sceneController.lockCameraToSelected();
      }
    } else {
      selectedMeshPanel.style.display = 'none';
    }
  }

  // Search input event
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
        modelTreeContainer.innerHTML = '<div class="mesh-placeholder">无匹配部件</div>';
      } else {
        renderTree(filtered, modelTreeContainer);
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

  // Direct 3D Raycast selection double click listener
  canvas.addEventListener('dblclick', () => {
    const pickResult = sceneController.scene.pick(
      sceneController.scene.pointerX,
      sceneController.scene.pointerY
    );
    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      const name = pickResult.pickedMesh.name;
      if (name !== "shadowGround" && name !== "gridLines" && name !== "grid") {
        selectMeshByName(name);
      }
    }
  });
});
