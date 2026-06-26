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
  TransformNode,
  SceneLoader,
  AbstractMesh,
  LinesMesh,
  AnimationGroup,
  GlowLayer
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
  private _targetCameraPosition: Vector3 | null = null;
  private _targetCameraRadius: number | null = null;
  private _currentAnimationGroups: AnimationGroup[] = [];
  private _glowLayer!: GlowLayer;
  private _selectionHighlightEnabled: boolean = false;
  
  private _isShadowsEnabled: boolean = true;
  public isLockedToTarget: boolean = true;
  private _lastTargetPosition: Vector3 | null = null;

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

      // Camera target tracking if lock is enabled
      if (this.isLockedToTarget) {
        let currentTargetPos: Vector3 | null = null;
        if (this._selectedMesh) {
          this._selectedMesh.computeWorldMatrix(true);
          currentTargetPos = this._selectedMesh.getBoundingInfo().boundingBox.centerWorld;
        } else if (this._currentModelRoot) {
          currentTargetPos = this._getModelCenterWorld();
        }

        if (currentTargetPos) {
          if (this._lastTargetPosition) {
            const delta = currentTargetPos.subtract(this._lastTargetPosition);
            if (delta.lengthSquared() > 0.00001) {
              this.camera.target.addInPlace(delta);
              if (this._targetCameraPosition) {
                this._targetCameraPosition.addInPlace(delta);
              }
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
      } else {
        this._lastTargetPosition = null;
      }

      // Smooth camera transition (focus effect)
      if (this._targetCameraPosition) {
        this.camera.target = Vector3.Lerp(this.camera.target, this._targetCameraPosition, 0.15);
        if (Vector3.Distance(this.camera.target, this._targetCameraPosition) < 0.005) {
          this.camera.target.copyFrom(this._targetCameraPosition);
          this._targetCameraPosition = null;
        }
      }
      if (this._targetCameraRadius !== null) {
        this.camera.radius = this.camera.radius + (this._targetCameraRadius - this.camera.radius) * 0.15;
        if (Math.abs(this.camera.radius - this._targetCameraRadius) < 0.005) {
          this.camera.radius = this._targetCameraRadius;
          this._targetCameraRadius = null;
        }
      }
    });
    
    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    // Handle resize
    window.addEventListener("resize", this._onResize);
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
    this.camera.panningSensibility = 1000; // Left click/drag to pan
    
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

  public setSelectionHighlight(enabled: boolean) {
    this._selectionHighlightEnabled = enabled;
    if (this._selectedMesh) {
      if (enabled) {
        this._selectedMesh.renderOutline = true;
        this._selectedMesh.outlineColor = new Color3(0, 0.95, 1.0);
        this._selectedMesh.outlineWidth = 0.04;
        this._applyMeshGlow(this._selectedMesh, new Color3(0, 0.5, 0.55));
      } else {
        this._selectedMesh.renderOutline = false;
        this._clearMeshGlow(this._selectedMesh);
      }
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
        this._targetCameraPosition = center.clone();
        this._targetCameraRadius = this._getModelFocusRadius();
      }
    }
  }

  public resetCamera() {
    this._targetCameraPosition = null;
    this._targetCameraRadius = null;
    this._lastTargetPosition = null; // Reset to prevent jump
    
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
    // Clear glow and outline of previous selection
    if (this._selectedMesh) {
      this._clearMeshGlow(this._selectedMesh);
      this._selectedMesh.renderOutline = false;
      this._selectedMesh = null;
    }

    if (!meshName) return null;

    const mesh = this.scene.getMeshByName(meshName);
    if (mesh) {
      this._selectedMesh = mesh;

      if (this._selectionHighlightEnabled) {
        mesh.renderOutline = true;
        mesh.outlineColor = new Color3(0, 0.95, 1.0);
        mesh.outlineWidth = 0.04;
        this._applyMeshGlow(mesh, new Color3(0, 0.5, 0.55));
      }

      this._lastTargetPosition = null; // Reset to prevent jump

      // Smoothly focus camera onto this sub-mesh center with dynamic radius
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.centerWorld;
      this._targetCameraPosition = center.clone();
      this._targetCameraRadius = this._calculateFocusRadius(mesh);

      // Update camera target node to match this mesh's center
      this._cameraTargetNode.position.copyFrom(center);

      return {
        name: mesh.name,
        vertices: mesh.getTotalVertices(),
        parent: mesh.parent ? mesh.parent.name : "无"
      };
    }
    return null;
  }

  public lockCameraToSelected() {
    if (this._selectedMesh) {
      this._lastTargetPosition = null; // Reset to prevent jump
      this._selectedMesh.computeWorldMatrix(true);
      const boundingInfo = this._selectedMesh.getBoundingInfo();
      const center = boundingInfo.boundingBox.centerWorld;

      // Smoothly focus camera onto this sub-mesh center with dynamic radius
      this._targetCameraPosition = center.clone();
      this._targetCameraRadius = this._calculateFocusRadius(this._selectedMesh);

      // Update camera target node to match this mesh's center
      this._cameraTargetNode.position.copyFrom(center);
    }
  }

  public toggleSelectedMeshRotation(enabled: boolean) {
    if (this._selectedMesh) {
      if (enabled) {
        this._rotatingMeshes.add(this._selectedMesh);
      } else {
        this._rotatingMeshes.delete(this._selectedMesh);
      }
    }
  }

  public isSelectedMeshRotating(): boolean {
    return this._selectedMesh ? this._rotatingMeshes.has(this._selectedMesh) : false;
  }

  public getAnimationNames(): string[] {
    return this._currentAnimationGroups.map((ag) => ag.name);
  }

  public playAnimation(name: string, loop: boolean = true) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (ag) {
      // Pause other animations if they are playing
      this._currentAnimationGroups.forEach((other) => {
        if (other !== ag) other.stop();
      });
      if (!ag.isPlaying) {
        ag.start(loop);
      }
    }
  }

  public pauseAnimation(name: string) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (ag) {
      ag.pause();
    }
  }

  public stopAnimation(name: string) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (ag) {
      ag.stop();
    }
  }

  public isAnimationPlaying(name: string): boolean {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    return ag ? ag.isPlaying : false;
  }

  public setAnimationSpeed(name: string, speed: number) {
    const ag = this._currentAnimationGroups.find((g) => g.name === name);
    if (ag) {
      ag.speedRatio = speed;
    }
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
    if (this._selectedMesh) {
      this._clearMeshGlow(this._selectedMesh);
    }
    if (this._currentModelRoot) {
      this._currentModelRoot.dispose();
      this._currentModelRoot = null;
    }
    this._selectedMesh = null;
    this._rotatingMeshes.clear();
    
    // Stop and dispose old animation groups
    this._currentAnimationGroups.forEach((ag) => {
      ag.stop();
      ag.dispose();
    });
    this._currentAnimationGroups = [];
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
      this._targetCameraPosition = null;
      this._targetCameraRadius = null;
      this._lastTargetPosition = null; // Reset to prevent jump

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
    
    // Store and pause all animation groups by default
    this._currentAnimationGroups = result.animationGroups;
    this._currentAnimationGroups.forEach((ag) => ag.stop());
    
    // Return status summary
    const meshCount = result.meshes.length;
    const vertices = result.meshes.reduce((acc, m) => acc + m.getTotalVertices(), 0);
    return `Model loaded successfully: ${meshCount} meshes, ${vertices.toLocaleString()} vertices.`;
  }

  private _getModelCenterWorld(): Vector3 {
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
      return Vector3.Center(min, max);
    }
    return this._currentModelRoot.absolutePosition;
  }

  private _getModelFocusRadius(): number {
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
      return Math.max(maxDim * 1.8, 1.0);
    }
    return 10.0;
  }

  private _calculateFocusRadius(mesh: AbstractMesh): number {
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.boundingBox.maximumWorld.subtract(boundingInfo.boundingBox.minimumWorld);
    const maxDim = Math.max(size.x, size.y, size.z);
    return Math.max(maxDim * 2.0, 0.4);
  }

  private _applyMeshGlow(mesh: AbstractMesh, color: Color3) {
    const material = mesh.material;
    if (material) {
      (material as any)._savedEmissiveColor = (material as any).emissiveColor?.clone();
      (material as any).emissiveColor = color;
    }
  }

  private _clearMeshGlow(mesh: AbstractMesh) {
    const material = mesh.material;
    if (material && (material as any)._savedEmissiveColor) {
      (material as any).emissiveColor = (material as any)._savedEmissiveColor;
      delete (material as any)._savedEmissiveColor;
    }
  }

  private _onResize = () => {
    this.engine.resize();
  };

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
