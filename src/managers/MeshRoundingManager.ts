import {
  AbstractMesh,
  Mesh,
  VertexBuffer,
  VertexData,
  Vector3,
  type IndicesArray
} from "@babylonjs/core";
import { ensureWorldMatrixUpdated } from "./CameraManager";

export type RoundingAlgorithmMode = 'normals' | 'laplacian' | 'subdivision';

export interface RoundingParams {
  angleThreshold: number; // in degrees, e.g. 10 ~ 120, for normal beveling
  strength: number;       // 0.0 ~ 1.0, for geometric displacement
  iterations: number;     // 1 ~ 5, for laplacian steps
}

interface GeometryBackup {
  positions: Float32Array;
  normals: Float32Array;
  indices: IndicesArray;
}

export class MeshRoundingManager {
  private _backups: Map<Mesh, GeometryBackup> = new Map();
  private _activeMode: RoundingAlgorithmMode = 'normals';
  private _params: RoundingParams = {
    angleThreshold: 45,
    strength: 0.35,
    iterations: 2
  };

  /** Caches original geometry data for all meshes in a root node or array. */
  public cacheModelGeometry(meshes: AbstractMesh[]): void {
    meshes.forEach((m) => {
      if (m instanceof Mesh && m.getTotalVertices() >= 3) {
        this.cacheMesh(m);
      }
    });
  }

  public cacheMesh(mesh: Mesh): void {
    if (this._backups.has(mesh)) return;

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
    const indices = mesh.getIndices();

    if (positions && normals && indices) {
      this._backups.set(mesh, {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: Array.isArray(indices) ? [...indices] : new Uint32Array(indices)
      });
    }
  }

  /**
   * Applies rounding effect to the specified meshes or all cached meshes.
   * Returns count of affected meshes.
   */
  public applyRounding(
    targetMeshes: AbstractMesh[],
    mode: RoundingAlgorithmMode,
    params: Partial<RoundingParams>
  ): number {
    this._activeMode = mode;
    this._params = { ...this._params, ...params };

    const validMeshes: Mesh[] = [];
    targetMeshes.forEach((m) => {
      if (m instanceof Mesh && m.getTotalVertices() >= 3) {
        this.cacheMesh(m);
        validMeshes.push(m);
      }
    });

    if (validMeshes.length === 0) return 0;

    validMeshes.forEach((mesh) => {
      const backup = this._backups.get(mesh);
      if (!backup) return;

      if (mode === 'normals') {
        this._applyNormalBevel(mesh, backup, this._params.angleThreshold);
      } else if (mode === 'laplacian') {
        this._applyLaplacianRounding(mesh, backup, this._params.strength, this._params.iterations);
      } else if (mode === 'subdivision') {
        this._applySubdivisionSmoothing(mesh, backup, this._params.strength);
      }
      ensureWorldMatrixUpdated(mesh);
    });

    return validMeshes.length;
  }

  /**
   * Resets meshes back to original cached geometric state.
   */
  public resetRounding(targetMeshes?: AbstractMesh[]): void {
    const meshesToReset = targetMeshes
      ? targetMeshes.filter((m): m is Mesh => m instanceof Mesh && this._backups.has(m))
      : Array.from(this._backups.keys());

    meshesToReset.forEach((mesh) => {
      const backup = this._backups.get(mesh);
      if (backup && !mesh.isDisposed()) {
        mesh.setVerticesData(VertexBuffer.PositionKind, backup.positions, true);
        mesh.setVerticesData(VertexBuffer.NormalKind, backup.normals, true);
        mesh.setIndices(backup.indices);
        mesh.refreshBoundingInfo();
        ensureWorldMatrixUpdated(mesh);
      }
    });
  }

  /**
   * Algorithm 1: Normal Angle Smooth Bevel
   * Combines normals for co-located vertices whose face angle difference <= threshold.
   */
  private _applyNormalBevel(mesh: Mesh, backup: GeometryBackup, angleThresholdDeg: number): void {
    const thresholdRad = (angleThresholdDeg * Math.PI) / 180;
    const cosThreshold = Math.cos(thresholdRad);

    const positions = backup.positions;
    const indices = backup.indices;
    const vertCount = positions.length / 3;
    const triCount = indices.length / 3;

    // 1. Compute face normals
    const faceNormals: Vector3[] = new Array(triCount);
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3] * 3;
      const i1 = indices[t * 3 + 1] * 3;
      const i2 = indices[t * 3 + 2] * 3;

      const p0 = new Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
      const p1 = new Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      const p2 = new Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);

      const fn = Vector3.Cross(p1.subtract(p0), p2.subtract(p0)).normalize();
      faceNormals[t] = fn;
    }

    // 2. Spatial hashing to group co-located vertices across sharp seams
    const spatialMap = new Map<string, number[]>();
    const spatialKey = (x: number, y: number, z: number) =>
      `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

    for (let v = 0; v < vertCount; v++) {
      const key = spatialKey(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const list = spatialMap.get(key);
      if (list) {
        list.push(v);
      } else {
        spatialMap.set(key, [v]);
      }
    }

    // 3. Map vertex to attached faces
    const vertFaces: number[][] = Array.from({ length: vertCount }, () => []);
    for (let t = 0; t < triCount; t++) {
      vertFaces[indices[t * 3]].push(t);
      vertFaces[indices[t * 3 + 1]].push(t);
      vertFaces[indices[t * 3 + 2]].push(t);
    }

    // 4. Compute smoothed normal per vertex
    const newNormals = new Float32Array(positions.length);

    for (let v = 0; v < vertCount; v++) {
      const myFaces = vertFaces[v];
      if (myFaces.length === 0) {
        newNormals[v * 3] = backup.normals[v * 3];
        newNormals[v * 3 + 1] = backup.normals[v * 3 + 1];
        newNormals[v * 3 + 2] = backup.normals[v * 3 + 2];
        continue;
      }

      // Base face normal
      const primaryFaceNormal = faceNormals[myFaces[0]];
      const key = spatialKey(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const coLocated = spatialMap.get(key) || [v];

      let avgNormal = Vector3.Zero();
      let count = 0;

      // Check all neighboring faces sharing this physical position
      coLocated.forEach((otherV) => {
        vertFaces[otherV].forEach((faceIdx) => {
          const fn = faceNormals[faceIdx];
          const dot = Vector3.Dot(primaryFaceNormal, fn);
          if (dot >= cosThreshold) {
            avgNormal.addInPlace(fn);
            count++;
          }
        });
      });

      if (count > 0 && avgNormal.lengthSquared() > 0.0001) {
        avgNormal.normalize();
        newNormals[v * 3] = avgNormal.x;
        newNormals[v * 3 + 1] = avgNormal.y;
        newNormals[v * 3 + 2] = avgNormal.z;
      } else {
        newNormals[v * 3] = primaryFaceNormal.x;
        newNormals[v * 3 + 1] = primaryFaceNormal.y;
        newNormals[v * 3 + 2] = primaryFaceNormal.z;
      }
    }

    // Restore original positions & set new normals
    mesh.setVerticesData(VertexBuffer.PositionKind, backup.positions, true);
    mesh.setVerticesData(VertexBuffer.NormalKind, newNormals, true);
  }

  /**
   * Algorithm 2: Laplacian Geometric Physical Rounding
   * Softens and curves sharp physical edges by relaxing 1-ring neighbors.
   */
  private _applyLaplacianRounding(
    mesh: Mesh,
    backup: GeometryBackup,
    strength: number,
    iterations: number
  ): void {
    const positions = new Float32Array(backup.positions);
    const indices = backup.indices;
    const vertCount = positions.length / 3;
    const triCount = indices.length / 3;

    // 1. Spatial merge table for shared edge topology
    const spatialMap = new Map<string, number[]>();
    const spatialKey = (x: number, y: number, z: number) =>
      `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;

    for (let v = 0; v < vertCount; v++) {
      const key = spatialKey(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const list = spatialMap.get(key);
      if (list) {
        list.push(v);
      } else {
        spatialMap.set(key, [v]);
      }
    }

    // 2. Build adjacency graph (1-ring neighbors)
    const neighbors: Set<number>[] = Array.from({ length: vertCount }, () => new Set());
    for (let t = 0; t < triCount; t++) {
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];

      neighbors[i0].add(i1).add(i2);
      neighbors[i1].add(i0).add(i2);
      neighbors[i2].add(i0).add(i1);
    }

    // Expand neighbors across co-located seam vertices
    for (let v = 0; v < vertCount; v++) {
      const key = spatialKey(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      const coLocated = spatialMap.get(key) || [];
      coLocated.forEach((otherV) => {
        neighbors[otherV].forEach((n) => neighbors[v].add(n));
      });
    }

    // 3. Iterative Laplacian smoothing
    const tempPositions = new Float32Array(positions.length);
    const actualStrength = Math.min(Math.max(strength, 0.05), 1.0) * 0.45;

    for (let it = 0; it < Math.min(iterations, 5); it++) {
      tempPositions.set(positions);

      for (let v = 0; v < vertCount; v++) {
        const nbrs = neighbors[v];
        if (nbrs.size === 0) continue;

        let avgX = 0, avgY = 0, avgZ = 0;
        nbrs.forEach((nbrIdx) => {
          avgX += positions[nbrIdx * 3];
          avgY += positions[nbrIdx * 3 + 1];
          avgZ += positions[nbrIdx * 3 + 2];
        });
        avgX /= nbrs.size;
        avgY /= nbrs.size;
        avgZ /= nbrs.size;

        const curX = positions[v * 3];
        const curY = positions[v * 3 + 1];
        const curZ = positions[v * 3 + 2];

        tempPositions[v * 3] = curX + (avgX - curX) * actualStrength;
        tempPositions[v * 3 + 1] = curY + (avgY - curY) * actualStrength;
        tempPositions[v * 3 + 2] = curZ + (avgZ - curZ) * actualStrength;
      }
      positions.set(tempPositions);
    }

    // 4. Synchronize exact position for co-located vertices to prevent mesh cracks
    spatialMap.forEach((vertIndices) => {
      if (vertIndices.length > 1) {
        let avgX = 0, avgY = 0, avgZ = 0;
        vertIndices.forEach((vi) => {
          avgX += positions[vi * 3];
          avgY += positions[vi * 3 + 1];
          avgZ += positions[vi * 3 + 2];
        });
        avgX /= vertIndices.length;
        avgY /= vertIndices.length;
        avgZ /= vertIndices.length;

        vertIndices.forEach((vi) => {
          positions[vi * 3] = avgX;
          positions[vi * 3 + 1] = avgY;
          positions[vi * 3 + 2] = avgZ;
        });
      }
    });

    // 5. Recompute normals
    const newNormals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, newNormals);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
    mesh.setVerticesData(VertexBuffer.NormalKind, newNormals, true);
    mesh.refreshBoundingInfo();
  }

  /**
   * Algorithm 3: Subdivision & Curvature Smoothing
   * Soft geometric curvature refinement.
   */
  private _applySubdivisionSmoothing(
    mesh: Mesh,
    backup: GeometryBackup,
    strength: number
  ): void {
    // 2-pass Laplacian with adaptive normal curvature blending
    this._applyLaplacianRounding(mesh, backup, strength * 0.7, 3);
    this._applyNormalBevel(mesh, backup, 50);
  }

  public clear(): void {
    this._backups.clear();
  }

  public get activeMode(): RoundingAlgorithmMode {
    return this._activeMode;
  }

  public get params(): RoundingParams {
    return { ...this._params };
  }
}
