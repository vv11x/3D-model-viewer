import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  TransformNode,
  SceneLoader,
  AbstractMesh,
  LinesMesh,
  AnimationGroup,
  GlowLayer,
  Effect,
  RenderTargetTexture,
  PostProcess,
  Texture,
  Animation,
  CubicEase,
  EasingFunction,
  PointerDragBehavior,
  Quaternion,
  type Nullable,
  type Material
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

export class SceneController {
  private _canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;
  public camera!: ArcRotateCamera;
  
  private _hemiLight!: HemisphericLight;
  private _dirLight!: DirectionalLight;
  private _shadowGenerator: ShadowGenerator | null = null;
  
  private _ground!: AbstractMesh;
  private _gridMesh: LinesMesh | null = null;
  private _currentModelRoot: TransformNode | null = null;
  private _cameraTargetNode!: TransformNode;
  private _defaultFov: number = 0.8;
  
  private _selectedMesh: AbstractMesh | null = null;
  private _rotatingMeshes: Set<AbstractMesh> = new Set();
  private _currentAnimationGroups: AnimationGroup[] = [];
  private _animationPlayingState: Map<string, boolean> = new Map();
  private _glowLayer!: GlowLayer;
  private _selectionHighlightEnabled: boolean = false;
  
  private _isShadowsEnabled: boolean = true;
  public isLockedToTarget: boolean = true;
  private _lastTargetPosition: Vector3 | null = null;
  private _isTransitioningTarget: boolean = false;
  private _transitionTargetVector: Vector3 | null = null;

  private _selectionMaskRTT: RenderTargetTexture | null = null;
  private _sobelOutline: PostProcess | null = null;
  private _maskMatSelected!: StandardMaterial;
  private _maskMatBackground!: StandardMaterial;
  private _outlinedMeshIds: Set<number> = new Set();
  private outlineColorHex = '#00f5ff';

  private _cachedModelCenterWorld: Vector3 | null = null;
  private _cachedModelFocusRadius: number | null = null;
  private _dragBehavior: PointerDragBehavior | null = null;
  private _initialTransforms: Map<AbstractMesh, {
    position: Vector3;
    rotation: Vector3;
    rotationQuaternion: Nullable<Quaternion>;
    scaling: Vector3;
  }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    
    // Initialize Babylon Engine & Scene
    this.engine = new Engine(this._canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });
    
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.08, 0.08, 0.1).toColor4(1.0); // Premium dark background
    
    // Initialize Camera Target Node
    this._cameraTargetNode = new TransformNode("cameraTarget", this.scene);
    this._cameraTargetNode.position = new Vector3(0, 1.5, 0);
    
    this._setupCamera();
    this._setupLights();
    this._setupEnvironment();

    this._glowLayer = new GlowLayer("glow", this.scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 64
    });
    this._glowLayer.intensity = 0.8;
    
    // Register custom mesh rotation animator and camera focus animator
    this.scene.onBeforeRenderObservable.add(() => {
      this._rotatingMeshes.forEach((mesh) => {
        mesh.rotate(Vector3.Up(), 0.02);
      });

      // 1. 获取当前需要聚焦或跟踪的网格/模型的世界坐标位置
      let currentTargetPos: Vector3 | null = null;
      if (this._selectedMesh) {
        this._selectedMesh.computeWorldMatrix(true);
        currentTargetPos = this._selectedMesh.getBoundingInfo().boundingBox.centerWorld;
      } else if (this._isTransitioningTarget && this._transitionTargetVector) {
        currentTargetPos = this._transitionTargetVector;
      } else if (this._currentModelRoot) {
        currentTargetPos = this._getModelCenterWorld();
      }

      // 2. 如果正在进行平滑过渡
      if (currentTargetPos && this._isTransitioningTarget) {
        this.camera.target = Vector3.Lerp(this.camera.target, currentTargetPos, 0.1);
        
        // 如果相机目标已经足够接近目标网格位置，结束过渡
        if (Vector3.Distance(this.camera.target, currentTargetPos) < 0.01) {
          this._isTransitioningTarget = false;
          this._transitionTargetVector = null;
          if (this.isLockedToTarget) {
            this._lastTargetPosition = currentTargetPos.clone();
          }
        }
      } 
      // 3. 如果在非过渡状态下开启了锁定跟随
      else if (currentTargetPos && this.isLockedToTarget) {
        if (this._lastTargetPosition) {
          const delta = currentTargetPos.subtract(this._lastTargetPosition);
          if (delta.lengthSquared() > 0.00001) {
            this.camera.target.addInPlace(delta);
          }
        }
        if (!this._lastTargetPosition) {
          this._lastTargetPosition = currentTargetPos.clone();
        } else {
          this._lastTargetPosition.copyFrom(currentTargetPos);
        }
      } else {
        this._lastTargetPosition = null;
      }
    });
    
    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    // Handle resize
    window.addEventListener("resize", this._onResize);

    // Cancel smooth transition when user interacts with camera
    this._canvas.addEventListener("wheel", () => {
      this.stopCameraTransition();
    }, { passive: true });

    this._canvas.addEventListener("pointerdown", (e) => {
      if (e.button === 0 || e.button === 2) {
        this.stopCameraTransition();
      }
    });

    // --- Sobel Outline Initialization ---
    if (!Effect.ShadersStore["sobelOutlineVertexShader"]) {
      Effect.ShadersStore["sobelOutlineVertexShader"] = `
precision highp float;
attribute vec2 position;
varying vec2 vUV;
void main(void) {
    vUV = (position + 1.0) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}
`;
    }

    if (!Effect.ShadersStore["sobelOutlineFragmentShader"]) {
      Effect.ShadersStore["sobelOutlineFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D maskSampler;
uniform vec2 screenSize;
uniform vec3 outlineColor;
uniform float threshold;
uniform float outlineWidth;

void main(void) {
    vec4 baseColor = texture2D(textureSampler, vUV);
    vec2 texel = (outlineWidth / screenSize);

    float m00 = texture2D(maskSampler, vUV + texel * vec2(-1.0, -1.0)).r;
    float m10 = texture2D(maskSampler, vUV + texel * vec2( 0.0, -1.0)).r;
    float m20 = texture2D(maskSampler, vUV + texel * vec2( 1.0, -1.0)).r;
    float m01 = texture2D(maskSampler, vUV + texel * vec2(-1.0,  0.0)).r;
    float m11 = texture2D(maskSampler, vUV + texel * vec2( 0.0,  0.0)).r;
    float m21 = texture2D(maskSampler, vUV + texel * vec2( 1.0,  0.0)).r;
    float m02 = texture2D(maskSampler, vUV + texel * vec2(-1.0,  1.0)).r;
    float m12 = texture2D(maskSampler, vUV + texel * vec2( 0.0,  1.0)).r;
    float m22 = texture2D(maskSampler, vUV + texel * vec2( 1.0,  1.0)).r;

    float gx = (-m00 + m20) + (-2.0 * m01 + 2.0 * m21) + (-m02 + m22);
    float gy = (-m00 - 2.0 * m10 - m20) + (m02 + 2.0 * m12 + m22);
    float mag = sqrt(gx * gx + gy * gy);

    float sel = step(0.5, m11);
    float edge = step(threshold, mag);
    float outline = sel * edge;

    vec3 rgb = mix(baseColor.rgb, outlineColor, outline);
    gl_FragColor = vec4(rgb, baseColor.a);
}
`;
    }

    this._maskMatSelected = new StandardMaterial("mask_selected", this.scene);
    this._maskMatSelected.disableLighting = true;
    this._maskMatSelected.emissiveColor = Color3.White();
    this._maskMatSelected.diffuseColor = Color3.White();
    this._maskMatSelected.specularColor = Color3.Black();

    this._maskMatBackground = new StandardMaterial("mask_background", this.scene);
    this._maskMatBackground.disableLighting = true;
    this._maskMatBackground.emissiveColor = Color3.Black();
    this._maskMatBackground.diffuseColor = Color3.Black();
    this._maskMatBackground.specularColor = Color3.Black();

    this._selectionMaskRTT = new RenderTargetTexture(
        "selection_mask",
        { width: this.engine.getRenderWidth(), height: this.engine.getRenderHeight() },
        this.scene,
        false,
        true,
        Engine.TEXTURETYPE_UNSIGNED_INT,
        false,
        Texture.NEAREST_SAMPLINGMODE
    );
    this._selectionMaskRTT.clearColor = new Color4(0, 0, 0, 1);
    this.scene.customRenderTargets.push(this._selectionMaskRTT);

    const materialBackup = new Map<any, Nullable<Material>>();
    this._selectionMaskRTT.onBeforeRenderObservable.add(() => {
        materialBackup.clear();
        const list = this._selectionMaskRTT?.renderList ?? [];
        for (const mesh of list) {
            if (!mesh) continue;
            if (!mesh.isEnabled() || !mesh.isVisible) continue;
            
            const targetMesh = mesh.getClassName() === "InstancedMesh" ? (mesh as any).sourceMesh : mesh;
            if (!targetMesh) continue;
            
            if (!materialBackup.has(targetMesh)) {
                materialBackup.set(targetMesh, targetMesh.material);
                targetMesh.material = this._maskMatSelected;
            }
        }
    });
    this._selectionMaskRTT.onAfterRenderObservable.add(() => {
        materialBackup.forEach((originalMaterial, targetMesh) => {
            if (targetMesh) {
                targetMesh.material = originalMaterial;
            }
        });
        materialBackup.clear();
    });

    this._sobelOutline = new PostProcess(
        "sobel_outline",
        "sobelOutline",
        ["screenSize", "outlineColor", "threshold", "outlineWidth"],
        ["maskSampler"],
        1.0,
        this.camera
    );
    this._sobelOutline.onApply = (effect) => {
        if (this._selectionMaskRTT) effect.setTexture("maskSampler", this._selectionMaskRTT);
        effect.setFloat2("screenSize", this.engine.getRenderWidth(), this.engine.getRenderHeight());
        effect.setFloat("threshold", 1);
        effect.setFloat("outlineWidth", 5);
        effect.setColor3("outlineColor", Color3.FromHexString(this.outlineColorHex));
    };
    // ------------------------------------
  }

  private _setupCamera() {
    // Create ArcRotateCamera targeting center
    this.camera = new ArcRotateCamera(
      "mainCamera",
      -Math.PI / 4,
      Math.PI / 3,
      10,
      new Vector3(0, 1.5, 0),
      this.scene
    );
    
    // Set camera limits
    this.camera.lowerRadiusLimit = 0.1; // Allow zooming in very close
    this.camera.upperRadiusLimit = 100;
    this.camera.wheelPrecision = 50; // Smooth zooming
    this.camera.panningSensibility = 5000; // Right click/drag to pan (lower = faster)
    
    // Near clipping plane: set to very small to prevent transparent clipping close up
    this.camera.minZ = 0.01;
    
    // Set initial target without locking to allow panning (moving position)
    this.camera.setTarget(this._cameraTargetNode.position);
    this._defaultFov = this.camera.fov;
    
    // Attach control to canvas
    this.camera.attachControl(this._canvas, true);
  }

  private _setupLights() {
    // Hemispheric Light (ambient)
    this._hemiLight = new HemisphericLight(
      "hemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    this._hemiLight.intensity = 0.6;
    this._hemiLight.specular = new Color3(0.2, 0.2, 0.2);
    
    // Directional Light (key light for shadows)
    this._dirLight = new DirectionalLight(
      "dirLight",
      new Vector3(-1, -2, -1),
      this.scene
    );
    this._dirLight.position = new Vector3(5, 10, 5);
    this._dirLight.intensity = 0.8;
    
    // Enable Shadows
    this._shadowGenerator = new ShadowGenerator(2048, this._dirLight);
    this._shadowGenerator.useBlurExponentialShadowMap = true;
    this._shadowGenerator.useKernelBlur = true;
    this._shadowGenerator.blurKernel = 32;
    this._shadowGenerator.setDarkness(0.4);
  }

  private _setupEnvironment() {
    // Shadow receiving ground
    this._ground = MeshBuilder.CreateGround(
      "shadowGround",
      { width: 100, height: 100 },
      this.scene
    );
    const groundMaterial = new StandardMaterial("groundMat", this.scene);
    groundMaterial.diffuseColor = new Color3(0.08, 0.08, 0.1);
    groundMaterial.specularColor = new Color3(0.0, 0.0, 0.0);
    groundMaterial.roughness = 1.0;
    this._ground.material = groundMaterial;
    this._ground.receiveShadows = true;
    
    // Engineering Grid lines
    this._createGrid(30, 30);
  }

  private _createGrid(size: number, subdivisions: number) {
    if (this._gridMesh) {
      this._gridMesh.dispose();
    }
    
    const lines = [];
    const step = size / subdivisions;
    const halfSize = size / 2;
    
    for (let i = 0; i <= subdivisions; i++) {
      const pos = -halfSize + i * step;
      
      // Lines parallel to X axis
      lines.push([new Vector3(-halfSize, 0, pos), new Vector3(halfSize, 0, pos)]);
      
      // Lines parallel to Z axis
      lines.push([new Vector3(pos, 0, -halfSize), new Vector3(pos, 0, halfSize)]);
    }
    
    this._gridMesh = MeshBuilder.CreateLineSystem("gridLines", { lines: lines }, this.scene);
    this._gridMesh.color = new Color3(0.2, 0.25, 0.35); // Sleek blueish-grey grid
    this._gridMesh.isPickable = false;
    this._gridMesh.position.y = 0.005; // Slightly above ground to prevent z-fighting
  }

  public setGridVisibility(visible: boolean) {
    if (this._gridMesh) {
      this._gridMesh.setEnabled(visible);
    }
  }

  public setShadowsEnabled(enabled: boolean) {
    this._isShadowsEnabled = enabled;
    if (this._shadowGenerator) {
      // Toggle shadows on ground
      this._ground.receiveShadows = enabled;
    }
  }

  public setLightIntensity(intensity: number) {
    this._dirLight.intensity = intensity;
  }

  public setAmbientIntensity(intensity: number) {
    this._hemiLight.intensity = intensity;
  }

  public setCameraZoom(zoomFactor: number) {
    this.camera.fov = this._defaultFov / zoomFactor;
  }

  public setPanningSpeed(multiplier: number) {
    this.camera.panningSensibility = 5000 / multiplier;
  }

  public setSelectionHighlight(enabled: boolean) {
    this._selectionHighlightEnabled = enabled;
    if (this._selectedMesh) {
      if (enabled) {
        this._outlinedMeshIds.add(this._selectedMesh.uniqueId);
      } else {
        this._outlinedMeshIds.delete(this._selectedMesh.uniqueId);
      }
      this._updateSelectionMaskRenderList();
    }
  }

  public setCameraTargetLock(lock: boolean) {
    this.isLockedToTarget = lock;
    this._lastTargetPosition = null; // Reset to prevent jump
    if (lock) {
      if (this._selectedMesh) {
        this.lockCameraToSelected();
      } else {
        const center = this._getModelCenterWorld();
        this._animateCameraTo(center, this._getModelFocusRadius());
      }
    }
  }

  public resetCamera() {
    this.stopCameraTransition();
    
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    
    const targetRadius = this._currentModelRoot ? this._getModelFocusRadius() : 10;
    this.camera.radius = targetRadius;
    this.camera.fov = this._defaultFov;
    
    if (this._selectedMesh) {
      this._selectedMesh.computeWorldMatrix(true);
    }
    const targetCenter = this._selectedMesh ? 
      this._selectedMesh.getBoundingInfo().boundingBox.centerWorld : 
      this._getModelCenterWorld();
      
    this.camera.setTarget(targetCenter.clone());
  }

  public toggleAutoRotate(enabled: boolean) {
    this.camera.useAutoRotationBehavior = enabled;
    if (enabled && this.camera.autoRotationBehavior) {
      this.camera.autoRotationBehavior.idleRotationSpeed = 0.1;
      this.camera.autoRotationBehavior.idleRotationWaitTime = 1000;
    }
  }

  public selectMesh(meshName: string | null): { name: string; vertices: number; parent: string } | null {
    // Clear drag behavior of previous selection if any
    if (this._dragBehavior && this._selectedMesh) {
      this._selectedMesh.removeBehavior(this._dragBehavior);
      this._dragBehavior = null;
    }

    // Clear glow and outline of previous selection
    if (this._selectedMesh) {
      this._outlinedMeshIds.delete(this._selectedMesh.uniqueId);
      this._selectedMesh = null;
    }

    if (!meshName) {
      this._updateSelectionMaskRenderList();
      return null;
    }

    const mesh = this.scene.getMeshByName(meshName);
    if (!mesh) {
      this._updateSelectionMaskRenderList();
      throw new Error(`Mesh "${meshName}" was not found in the scene.`);
    }

    this._selectedMesh = mesh;

    if (this._selectionHighlightEnabled) {
      this._outlinedMeshIds.add(mesh.uniqueId);
    }

    this._updateSelectionMaskRenderList();
    this._lastTargetPosition = null; // Reset to prevent jump

    // Smoothly focus camera onto this sub-mesh center with dynamic radius
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const center = boundingInfo.boundingBox.centerWorld;
    const targetRadius = this._calculateFocusRadius(mesh);

    this._animateCameraTo(center, targetRadius);

    // Update camera target node to match this mesh's center
    this._cameraTargetNode.position.copyFrom(center);

    return {
      name: mesh.name,
      vertices: mesh.getTotalVertices(),
      parent: mesh.parent ? mesh.parent.name : "无"
    };
  }

  public lockCameraToSelected() {
    if (this._selectedMesh) {
      this._lastTargetPosition = null; // Reset to prevent jump
      this._selectedMesh.computeWorldMatrix(true);
      const boundingInfo = this._selectedMesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.centerWorld;
      const targetRadius = this._calculateFocusRadius(this._selectedMesh);

      this._animateCameraTo(center, targetRadius);

      // Update camera target node to match this mesh's center
      this._cameraTargetNode.position.copyFrom(center);
    }
  }

  public focusOnGroup(nodeName: string) {
    const node = this.scene.getTransformNodeByName(nodeName);
    if (!node) {
      throw new Error(`TransformNode "${nodeName}" was not found in the scene.`);
    }

    const childMeshes = node.getChildMeshes(false);
    if (childMeshes.length === 0) {
      throw new Error(`TransformNode "${nodeName}" does not contain any child meshes to focus on.`);
    }

    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

    childMeshes.forEach((m) => {
      if (m.getTotalVertices() > 0) {
        m.computeWorldMatrix(true);
        const bb = m.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bb.minimumWorld);
        max = Vector3.Maximize(max, bb.maximumWorld);
      }
    });

    const center = Vector3.Center(min, max);
    const size = max.subtract(min);
    const maxDim = Math.max(size.x, size.y, size.z);

    this._lastTargetPosition = null;
    const targetRadius = Math.max(maxDim * 0.9, 0.1);
    
    this._animateCameraTo(center, targetRadius);
    this._cameraTargetNode.position.copyFrom(center);
  }

  public setSelectedMeshVisible(visible: boolean) {
    if (!this._selectedMesh) {
      throw new Error("Cannot set mesh visibility: No mesh is currently selected.");
    }
    this._selectedMesh.setEnabled(visible);
  }

  public showAllMeshes() {
    if (this._currentModelRoot) {
      this._currentModelRoot.getChildMeshes().forEach((m) => {
        m.setEnabled(true);
      });
    }
  }

  public isSelectedMeshVisible(): boolean {
    return this._selectedMesh ? this._selectedMesh.isEnabled() : true;
  }

  public setSelectedMeshAlpha(alpha: number) {
    if (!this._selectedMesh) {
      throw new Error("Cannot set mesh alpha: No mesh is currently selected.");
    }
    if (!this._selectedMesh.material) {
      throw new Error(`Cannot set mesh alpha: Selected mesh "${this._selectedMesh.name}" has no material.`);
    }

    const mat = this._selectedMesh.material;
    if (!(mat as any)._savedTransparency) {
      (mat as any)._savedTransparency = {
        transparencyMode: mat.transparencyMode,
        needDepthPrePass: mat.needDepthPrePass,
        alphaMode: mat.alphaMode
      };
    }
    mat.alpha = alpha;
    if (alpha < 1.0) {
      mat.transparencyMode = 2;
      mat.needDepthPrePass = true;
    } else {
      const saved = (mat as any)._savedTransparency;
      mat.transparencyMode = saved.transparencyMode;
      mat.needDepthPrePass = saved.needDepthPrePass;
      mat.alphaMode = saved.alphaMode;
    }
  }

  public getSelectedMeshAlpha(): number {
    if (!this._selectedMesh) {
      throw new Error("Cannot get mesh alpha: No mesh is currently selected.");
    }
    if (!this._selectedMesh.material) {
      throw new Error(`Cannot get mesh alpha: Selected mesh "${this._selectedMesh.name}" has no material.`);
    }
    return this._selectedMesh.material.alpha;
  }

  public toggleSelectedMeshRotation(enabled: boolean) {
    if (!this._selectedMesh) {
      throw new Error("Cannot toggle mesh rotation: No mesh is currently selected.");
    }
    if (enabled) {
      this._rotatingMeshes.add(this._selectedMesh);
    } else {
      this._rotatingMeshes.delete(this._selectedMesh);
    }
  }

  public isSelectedMeshRotating(): boolean {
    if (!this._selectedMesh) {
      throw new Error("Cannot check mesh rotation: No mesh is currently selected.");
    }
    return this._rotatingMeshes.has(this._selectedMesh);
  }

  private _cacheInitialTransform(mesh: AbstractMesh) {
    if (!this._initialTransforms.has(mesh)) {
      this._initialTransforms.set(mesh, {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        rotationQuaternion: mesh.rotationQuaternion ? mesh.rotationQuaternion.clone() : null,
        scaling: mesh.scaling.clone()
      });
    }
  }

  public toggleDragSelectedMesh(enabled: boolean) {
    if (!this._selectedMesh) return;

    if (enabled) {
      this._cacheInitialTransform(this._selectedMesh);

      if (this._dragBehavior) {
        this._selectedMesh.removeBehavior(this._dragBehavior);
      }

      this._dragBehavior = new PointerDragBehavior();
      
      // Prevent camera from rotating while dragging
      this._dragBehavior.onDragStartObservable.add(() => {
        this.camera.detachControl();
      });

      this._dragBehavior.onDragEndObservable.add(() => {
        this.camera.attachControl(this._canvas, true);
      });

      this._selectedMesh.addBehavior(this._dragBehavior);
    } else {
      if (this._dragBehavior && this._selectedMesh) {
        this._selectedMesh.removeBehavior(this._dragBehavior);
      }
      this._dragBehavior = null;
    }
  }

  public resetSelectedMeshPosition() {
    if (!this._selectedMesh) return;
    const initial = this._initialTransforms.get(this._selectedMesh);
    if (initial) {
      this._selectedMesh.position.copyFrom(initial.position);
      this._selectedMesh.rotation.copyFrom(initial.rotation);
      if (initial.rotationQuaternion) {
        if (this._selectedMesh.rotationQuaternion) {
          this._selectedMesh.rotationQuaternion.copyFrom(initial.rotationQuaternion);
        } else {
          this._selectedMesh.rotationQuaternion = initial.rotationQuaternion.clone();
        }
      } else {
        this._selectedMesh.rotationQuaternion = null;
      }
      this._selectedMesh.scaling.copyFrom(initial.scaling);
      
      this._selectedMesh.computeWorldMatrix(true);
    }
  }

  public getAnimationNames(): string[] {
    return this._currentAnimationGroups.map((ag) => ag.name);
  }

  public playAnimation(name: string, loop: boolean = true) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found in the loaded model.`);
    }
    this._currentAnimationGroups.forEach((other) => {
      if (other !== ag) {
        other.pause();
        this._animationPlayingState.set(other.name, false);
      }
    });
    ag.start(loop);
    this._animationPlayingState.set(name, true);
  }

  public pauseAnimation(name: string) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to pause.`);
    }
    ag.pause();
    this._animationPlayingState.set(name, false);
  }

  public stopAnimation(name: string) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to stop.`);
    }
    ag.stop();
    this._animationPlayingState.set(name, false);
  }

  public isAnimationPlaying(name: string): boolean {
    return this._animationPlayingState.get(name) ?? false;
  }

  public setAnimationSpeed(name: string, speed: number) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (!ag) {
      throw new Error(`Animation group "${name}" was not found to set speed ratio.`);
    }
    ag.speedRatio = speed;
  }

  public toggleInspector() {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
    } else {
      this.scene.debugLayer.show({
        embedMode: true,
        overlay: true
      });
    }
  }

  public clearCurrentModel() {
    if (this._currentModelRoot) {
      this._currentModelRoot.dispose();
      this._currentModelRoot = null;
    }
    this._selectedMesh = null;
    this._rotatingMeshes.clear();
    this._outlinedMeshIds.clear();
    this._cachedModelCenterWorld = null;
    this._cachedModelFocusRadius = null;
    if (this._selectionMaskRTT) {
      this._selectionMaskRTT.renderList = [];
    }
    
    // Stop and dispose old animation groups
    this._currentAnimationGroups.forEach((ag) => {
      ag.stop();
      ag.dispose();
    });
    this._currentAnimationGroups = [];
    this._animationPlayingState.clear();
  }

  public async loadModelFromFile(file: File): Promise<string> {
    this.clearCurrentModel();
    
    // Create new root transform node for loaded model
    const modelRoot = new TransformNode("model_root", this.scene);
    
    // Load mesh using Babylon SceneLoader
    const result = await SceneLoader.ImportMeshAsync("", "", file, this.scene);
    
    // Group all loaded top-level meshes under modelRoot
    result.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.setParent(modelRoot);
      }
    });

    // Auto-center and scale model
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;
    
    result.meshes.forEach((mesh) => {
      if (mesh === modelRoot || mesh.name === "__root__") return;
      if (mesh.getTotalVertices() > 0) {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        hasValidMesh = true;
      }
    });
    
    if (hasValidMesh) {
      const center = Vector3.Center(min, max);
      const size = max.subtract(min);
      const maxDimension = Math.max(size.x, size.y, size.z);
      
      // Target scale: scale model so its maximum dimension is 5 units
      const targetSize = 5.0;
      const scale = targetSize / (maxDimension || 1.0);
      
      // Pivot around center-bottom of model
      const pivot = new Vector3(center.x, min.y, center.z);
      
      // Translate root to center
      modelRoot.position = pivot.scale(-scale);
      modelRoot.position.y += 0.02; // sit on top of grid
      modelRoot.scaling = new Vector3(scale, scale, scale);
      
      // Assign model root first so helper functions can access child meshes
      this._currentModelRoot = modelRoot;

      // Clear any pending camera target animations
      this.stopCameraTransition();

      const modelCenter = this._getModelCenterWorld();
      const modelRadius = this._getModelFocusRadius();

      // Target camera target node to center of scaled model
      this._cameraTargetNode.position.copyFrom(modelCenter);
      this.camera.radius = modelRadius;
      
      this.camera.setTarget(modelCenter.clone());
    }
    
    // Apply shadows
    result.meshes.forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        if (this._shadowGenerator) {
          this._shadowGenerator.addShadowCaster(mesh);
        }
        mesh.receiveShadows = this._isShadowsEnabled;
      }
    });
    
    this._currentModelRoot = modelRoot;
    
    if (this._selectionMaskRTT) {
      this._selectionMaskRTT.renderList = [];
    }
    
    // Store and pause all animation groups by default
    this._currentAnimationGroups = result.animationGroups;
    this._currentAnimationGroups.forEach((ag) => ag.stop());
    
    // Return status summary
    const meshCount = result.meshes.length;
    const vertices = result.meshes.reduce((acc, m) => acc + m.getTotalVertices(), 0);
    return `Model loaded successfully: ${meshCount} meshes, ${vertices.toLocaleString()} vertices.`;
  }

  private _getModelCenterWorld(): Vector3 {
    if (this._cachedModelCenterWorld) {
      return this._cachedModelCenterWorld;
    }
    if (!this._currentModelRoot) {
      return this._cameraTargetNode.position;
    }
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;
    
    this._currentModelRoot.getChildMeshes().forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        hasValidMesh = true;
      }
    });
    
    if (hasValidMesh) {
      this._cachedModelCenterWorld = Vector3.Center(min, max);
      return this._cachedModelCenterWorld;
    }
    return this._currentModelRoot.absolutePosition;
  }

  private _getModelFocusRadius(): number {
    if (this._cachedModelFocusRadius !== null) {
      return this._cachedModelFocusRadius;
    }
    if (!this._currentModelRoot) return 10.0;
    
    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    let hasValidMesh = false;
    
    this._currentModelRoot.getChildMeshes().forEach((mesh) => {
      if (mesh.getTotalVertices() > 0) {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        min = Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
        max = Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
        hasValidMesh = true;
      }
    });
    
    if (hasValidMesh) {
      const size = max.subtract(min);
      const maxDim = Math.max(size.x, size.y, size.z);
      this._cachedModelFocusRadius = Math.max(maxDim * 1.0, 0.1);
      return this._cachedModelFocusRadius;
    }
    return 10.0;
  }

  private _calculateFocusRadius(mesh: AbstractMesh): number {
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
    const maxDim = Math.max(size.x, size.y, size.z);
    return Math.max(maxDim * 0.8, 0.05);
  }

  private _animateCameraTo(target: Vector3, radius: number) {
    if (!this.scene || !this.camera) return;

    // Stop current focus animations to prevent overlapping
    this.scene.stopAnimation(this.camera, "target");
    this.scene.stopAnimation(this.camera, "radius");

    const frameRate = 60;
    const duration = 0.8;
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    this._isTransitioningTarget = true;
    this._transitionTargetVector = target.clone();
    this._lastTargetPosition = null; // Reset to prevent jump

    Animation.CreateAndStartAnimation(
      "cameraFocusRadius",
      this.camera,
      "radius",
      frameRate,
      frameRate * duration,
      this.camera.radius,
      radius,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      ease
    );
  }

  public stopCameraTransition() {
    this._isTransitioningTarget = false;
    this._transitionTargetVector = null;
    if (this.scene && this.camera) {
      this.scene.stopAnimation(this.camera, "target");
      this.scene.stopAnimation(this.camera, "radius");
    }
    if (this.isLockedToTarget) {
      this._resetLastTargetPosition();
    }
  }

  private _resetLastTargetPosition() {
    let currentTargetPos: Vector3 | null = null;
    if (this._selectedMesh) {
      this._selectedMesh.computeWorldMatrix(true);
      currentTargetPos = this._selectedMesh.getBoundingInfo().boundingBox.centerWorld;
    } else if (this._currentModelRoot) {
      currentTargetPos = this._getModelCenterWorld();
    }
    if (currentTargetPos) {
      this._lastTargetPosition = currentTargetPos.clone();
    } else {
      this._lastTargetPosition = null;
    }
  }

  private _onResize = () => {
    this.engine.resize();
  };

  private _updateSelectionMaskRenderList() {
    if (!this._selectionMaskRTT) return;
    
    const list: AbstractMesh[] = [];
    if (this._currentModelRoot) {
      this._currentModelRoot.getChildMeshes().forEach((mesh) => {
        if (this._outlinedMeshIds.has(mesh.uniqueId)) {
          list.push(mesh);
        }
      });
    }
    this._selectionMaskRTT.renderList = list;
  }

  public dispose() {
    window.removeEventListener("resize", this._onResize);
    this.engine.dispose();
  }

  public getModelHierarchy(): TreeNode[] | null {
    if (!this._currentModelRoot) return null;
    return this._currentModelRoot.getChildren().map((node: any) => this._buildTreeNode(node));
  }

  private _buildTreeNode(node: any): TreeNode {
    const children: any[] = node.getChildren ? node.getChildren() : [];
    const isMesh = node.getClassName && node.getClassName().includes('Mesh');

    if (isMesh && children.length === 0) {
      return {
        name: node.name,
        type: 'mesh',
        vertices: node.getTotalVertices(),
        meshName: node.name
      };
    }

    const childNodes: TreeNode[] = [];
    children.forEach((child: any) => {
      childNodes.push(this._buildTreeNode(child));
    });

    if (childNodes.length === 0 && isMesh) {
      return {
        name: node.name,
        type: 'mesh',
        vertices: node.getTotalVertices(),
        meshName: node.name
      };
    }

    return {
      name: node.name,
      type: isMesh ? 'mesh' : 'transform',
      vertices: isMesh ? node.getTotalVertices() : undefined,
      children: childNodes.length > 0 ? childNodes : undefined,
      meshName: isMesh ? node.name : undefined
    };
  }
}

export interface TreeNode {
  name: string;
  type: 'transform' | 'mesh';
  vertices?: number;
  children?: TreeNode[];
  meshName?: string;
}
