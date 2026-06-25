import './style.css';
import { SceneController } from './scene';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Render canvas not found!');
    return;
  }

  // Initialize 3D Scene Controller
  const sceneController = new SceneController(canvas);

  // DOM Control References
  const btnResetCamera = document.getElementById('btnResetCamera') as HTMLButtonElement;
  const chkAutoRotate = document.getElementById('chkAutoRotate') as HTMLInputElement;
  const chkLockToModel = document.getElementById('chkLockToModel') as HTMLInputElement;
  
  const rngCameraZoom = document.getElementById('rngCameraZoom') as HTMLInputElement;
  const lblCameraZoom = document.getElementById('lblCameraZoom') as HTMLSpanElement;
  
  const rngDirLight = document.getElementById('rngDirLight') as HTMLInputElement;
  const lblDirLight = document.getElementById('lblDirLight') as HTMLSpanElement;
  const rngHemiLight = document.getElementById('rngHemiLight') as HTMLInputElement;
  const lblHemiLight = document.getElementById('lblHemiLight') as HTMLSpanElement;
  
  const chkShowGrid = document.getElementById('chkShowGrid') as HTMLInputElement;
  const chkEnableShadows = document.getElementById('chkEnableShadows') as HTMLInputElement;
  
  const btnToggleInspector = document.getElementById('btnToggleInspector') as HTMLButtonElement;
  
  const uploadArea = document.getElementById('uploadArea') as HTMLDivElement;
  const modelFileInput = document.getElementById('modelFileInput') as HTMLInputElement;
  
  const dropzoneOverlay = document.getElementById('dropzoneOverlay') as HTMLDivElement;
  const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement;

  // Sub-meshes UI Elements
  const txtSearchMesh = document.getElementById('txtSearchMesh') as HTMLInputElement;
  const meshListContainer = document.getElementById('meshListContainer') as HTMLDivElement;
  const selectedMeshPanel = document.getElementById('selectedMeshPanel') as HTMLDivElement;
  const lblSelectedMeshName = document.getElementById('lblSelectedMeshName') as HTMLSpanElement;
  const btnLockToSelected = document.getElementById('btnLockToSelected') as HTMLButtonElement;
  const chkRotateSelectedMesh = document.getElementById('chkRotateSelectedMesh') as HTMLInputElement;

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

  // 1.1 Camera Zoom Binding
  rngCameraZoom.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    lblCameraZoom.textContent = val.toFixed(2) + 'x';
    sceneController.setCameraZoom(val);
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
      sceneController.playAnimation(activeAnim, true); // loop = true
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
      
      // Reset speed
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
    
    // Defer a bit to let loader screen show up smoothly
    setTimeout(async () => {
      try {
        const summary = await sceneController.loadModelFromFile(file);
        console.log(summary);
        
        // Update dashboard statistics
        let totalVertices = 0;
        let meshCount = 0;
        
        sceneController.scene.meshes.forEach((m) => {
          // Filter out environment helpers (ground and grid)
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
        
        // Reset zoom UI to default 1.0 when new model is loaded
        rngCameraZoom.value = '1.0';
        lblCameraZoom.textContent = '1.00x';
        sceneController.setCameraZoom(1.0); // Reset camera FOV to default 1.0x zoom
        
        // Populate sub-meshes sidebar list
        txtSearchMesh.value = '';
        populateMeshList();
        selectMeshUI(null);

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
          
          // Reset speed
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

  // 7. Sub-meshes selection and logic helper functions
  let modelMeshNames: string[] = [];

  function populateMeshList() {
    meshListContainer.innerHTML = '';
    modelMeshNames = [];

    sceneController.scene.meshes.forEach((m) => {
      if (m.name !== "shadowGround" && m.name !== "gridLines" && m.name !== "grid") {
        if (m.getTotalVertices() > 0) {
          modelMeshNames.push(m.name);
        }
      }
    });

    if (modelMeshNames.length === 0) {
      meshListContainer.innerHTML = '<div class="mesh-placeholder">该模型无有效子部件</div>';
      selectedMeshPanel.style.display = 'none';
      return;
    }

    renderMeshList(modelMeshNames);
  }

  function renderMeshList(list: string[]) {
    meshListContainer.innerHTML = '';
    
    list.forEach((name) => {
      const div = document.createElement('div');
      div.className = 'mesh-item';
      div.textContent = name;
      div.setAttribute('data-mesh', name);
      div.addEventListener('dblclick', () => {
        selectMeshUI(name);
      });
      meshListContainer.appendChild(div);
    });
  }

  function selectMeshUI(name: string | null) {
    const info = sceneController.selectMesh(name);
    
    const activeItems = meshListContainer.querySelectorAll('.mesh-item.active');
    activeItems.forEach((el) => el.classList.remove('active'));

    if (info) {
      const targetItem = meshListContainer.querySelector(`[data-mesh="${CSS.escape(info.name)}"]`);
      if (targetItem) {
        targetItem.classList.add('active');
        targetItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      lblSelectedMeshName.textContent = info.name;
      selectedMeshPanel.style.display = 'flex';
      chkRotateSelectedMesh.checked = sceneController.isSelectedMeshRotating();
      
      // If Lock-to-model is enabled, automatically align camera target to this selected mesh center!
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
    const filtered = modelMeshNames.filter((name) => name.toLowerCase().includes(query));
    renderMeshList(filtered);
  });

  // Direct 3D Raycast selection double click listener
  canvas.addEventListener('dblclick', () => {
    const pickResult = sceneController.scene.pick(
      sceneController.scene.pointerX,
      sceneController.scene.pointerY
    );
    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      const name = pickResult.pickedMesh.name;
      if (name !== "shadowGround" && name !== "gridLines" && name !== "grid") {
        selectMeshUI(name);
      }
    }
  });
});
