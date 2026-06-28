type AttributeLike = {
  count: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
  setXY?(index: number, x: number, y: number): void;
  needsUpdate?: boolean;
};

type GeometryLike = {
  attributes: {
    position: AttributeLike;
    uv: AttributeLike;
  };
  setAttribute(name: string, attribute: unknown): void;
  setIndex?(indices: number[]): void;
  toNonIndexed(): GeometryLike;
  computeVertexNormals?(): void;
  center?(): void;
};

type ThreeGeometryDeps = {
  BoxGeometry: new (width: number, height: number, depth: number, widthSegments?: number, heightSegments?: number, depthSegments?: number) => GeometryLike;
  BufferGeometry: new () => GeometryLike;
  Float32BufferAttribute: new (array: number[] | number, itemSize: number) => unknown;
  Shape: new () => {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
  };
  ExtrudeGeometry: new (shape: unknown, settings: Record<string, unknown>) => GeometryLike;
  Vector2: new () => { fromBufferAttribute(attribute: AttributeLike, index: number): void; x: number; y: number };
  Vector3: new () => {
    fromBufferAttribute(attribute: AttributeLike, index: number): void;
    length(): number;
    normalize(): { multiplyScalar(radius: number): void };
    x: number;
    y: number;
    z: number;
  };
};

export class WorldGeometryService {
  private THREE: ThreeGeometryDeps | null = null;
  private readonly geometryCache = new Map<string, GeometryLike>();

  configure(THREE: ThreeGeometryDeps): this {
    this.THREE = THREE;
    return this;
  }

  getCachedGeometry(sw: number, sh: number, sd: number, shape = "Block"): GeometryLike | undefined {
    this.assertConfigured();
    if (shape === "Block") {
      const key = `${shape},${sw},${sh},${sd}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeCube(sw, sh, sd));
      return this.geometryCache.get(key);
    }
    if (shape === "Ball") {
      const radi = Math.min(sw, sh, sd);
      const key = `${shape},${radi}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeQuadSphere(radi * 0.5, 6));
      return this.geometryCache.get(key);
    }
    if (shape === "Cylinder") {
      const radi = Math.min(sh, sd);
      const key = `${shape},${radi},${sw}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeCylinder(radi * 0.5, radi * 0.5, sw, 20, 1));
      return this.geometryCache.get(key);
    }
    if (shape === "Cylinder2") {
      const radi = Math.min(sw, sd);
      const key = `${shape},${radi},${sh}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeCylinder(radi * 0.5, radi * 0.5, sh, 20, 1));
      return this.geometryCache.get(key);
    }
    if (shape === "Wedge") {
      const key = `${shape},${sw},${sh},${sd}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeWedge(sd, sh, sw));
      return this.geometryCache.get(key);
    }
    if (shape === "CornerWedge") {
      const key = `${shape},${sw},${sh},${sd}`;
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, this.makeCornerWedge(sd, sh, sw));
      return this.geometryCache.get(key);
    }
    console.log(`unknown shape: ${shape}`);
    return undefined;
  }

  snapshot(): { geometries: number; keys: string[] } {
    return {
      geometries: this.geometryCache.size,
      keys: [...this.geometryCache.keys()]
    };
  }

  private makeCube(width: number, height: number, depth: number): GeometryLike {
    const THREE = this.assertConfigured();
    const geo = new THREE.BoxGeometry(width, height, depth);
    const flat = geo.toNonIndexed();
    const pos = flat.attributes.position;
    const uv: number[] = [];
    for (let i = 0; i < pos.count; i += 6) {
      const verts: Array<Record<"x" | "y" | "z", number>> = [];
      for (let v = 0; v < 6; v++) {
        verts.push({
          x: pos.getX(i + v),
          y: pos.getY(i + v),
          z: pos.getZ(i + v)
        });
      }
      const axes = ["x", "y", "z"] as const;
      const varying = axes.filter((axis) => {
        const vals = verts.map((v) => v[axis]);
        return Math.max(...vals) - Math.min(...vals) > 0;
      });
      const [uAxis, vAxis] = varying;
      if (!uAxis || !vAxis) continue;
      const uMin = Math.min(...verts.map((v) => v[uAxis]));
      const vMin = Math.min(...verts.map((v) => v[vAxis]));
      for (let v = 0; v < 6; v++) {
        const vert = verts[v];
        if (!vert) continue;
        uv.push(vert[uAxis] - uMin, vert[vAxis] - vMin);
      }
    }
    flat.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return flat;
  }

  private makeQuadSphere(radius: number, subs: number): GeometryLike {
    const THREE = this.assertConfigured();
    const geometry = new THREE.BoxGeometry(1, 1, 1, subs, subs, subs);
    const pos = geometry.attributes.position;
    const normal = new THREE.Float32BufferAttribute(pos.count * 3, 3);
    const uv = geometry.attributes.uv;
    const posVec = new THREE.Vector3();
    const uvVec = new THREE.Vector2();
    const halfU = 0.5;
    const halfV = 0.5;
    for (let i = 0; i < pos.count; i++) {
      posVec.fromBufferAttribute(pos, i);
      const scale = 1;
      uvVec.fromBufferAttribute(uv, i);
      uv.setXY?.(i, halfU + (uvVec.x - halfU) * scale, halfV + (uvVec.y - halfV) * scale);
      posVec.normalize().multiplyScalar(radius);
      normalSetXYZ(normal, i, posVec.x / radius, posVec.y / radius, posVec.z / radius);
      positionSetXYZ(pos, i, posVec.x, posVec.y, posVec.z);
    }
    geometry.setAttribute("normal", normal);
    uv.needsUpdate = true;
    return geometry;
  }

  private makeCylinder(radiusTop: number, radiusBottom: number, height: number, radialSegs: number, heightSegs: number): GeometryLike {
    const THREE = this.assertConfigured();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfH = height / 2;
    for (let y = 0; y <= heightSegs; y++) {
      const t = y / heightSegs;
      const r = radiusTop + (radiusBottom - radiusTop) * t;
      const posY = halfH - t * height;
      const slope = (radiusBottom - radiusTop) / height;
      for (let x = 0; x <= radialSegs; x++) {
        const theta = (x / radialSegs) * Math.PI * 2;
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        positions.push(cos * r, posY, sin * r);
        const nLen = Math.sqrt(cos * cos + slope * slope + sin * sin);
        normals.push(cos / nLen, slope / nLen, sin / nLen);
        uvs.push((x / radialSegs) * Math.PI * 2 * Math.max(radiusTop, radiusBottom), t * height);
      }
    }
    const ringVerts = radialSegs + 1;
    for (let y = 0; y < heightSegs; y++) {
      for (let x = 0; x < radialSegs; x++) {
        const a = y * ringVerts + x;
        const b = a + ringVerts;
        const c = b + 1;
        const d = a + 1;
        indices.push(a, d, b, b, d, c);
      }
    }
    const addCap = (radius: number, posY: number, normalY: number) => {
      const centerIdx = positions.length / 3;
      positions.push(0, posY, 0);
      normals.push(0, normalY, 0);
      uvs.push(0, 0);
      for (let x = 0; x <= radialSegs; x++) {
        const theta = (x / radialSegs) * Math.PI * 2;
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        positions.push(cos * radius, posY, sin * radius);
        normals.push(0, normalY, 0);
        uvs.push(cos * radius, sin * radius);
      }
      for (let x = 0; x < radialSegs; x++) {
        const a = centerIdx;
        const b = centerIdx + 1 + x;
        const c = centerIdx + 1 + x + 1;
        if (normalY > 0) indices.push(a, c, b);
        else indices.push(a, b, c);
      }
    };
    addCap(radiusTop, halfH, 1);
    addCap(radiusBottom, -halfH, -1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex?.(indices);
    return geometry.toNonIndexed();
  }

  private makeWedge(width: number, height: number, depth: number): GeometryLike {
    const THREE = this.assertConfigured();
    const shape = new THREE.Shape();
    const hw = width * 0.5;
    const hh = height * 0.5;
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, -hh);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.center?.();
    return geometry;
  }

  private makeCornerWedge(width: number, height: number, depth: number): GeometryLike {
    const THREE = this.assertConfigured();
    const hw = width * 0.5;
    const hh = height * 0.5;
    const hd = depth * 0.5;
    let geometry = new THREE.BufferGeometry();
    const vertices = [
      hw, -hh, -hd,
      -hw, -hh, -hd,
      hw, -hh, hd,
      -hw, -hh, hd,
      -hw, hh, -hd
    ];
    const indices = [
      1, 2, 3,
      0, 2, 1,
      0, 1, 4,
      4, 1, 3,
      2, 0, 4,
      2, 4, 3
    ];
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex?.(indices);
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals?.();
    const diagDepth = height + depth;
    const diagWidth = height + width;
    const uvs = [
      0, 0, width, depth, 0, depth,
      width, 0, width, depth, 0, 0,
      0, 0, width, 0, width, height,
      depth, height, depth, 0, 0, 0,
      depth, diagWidth, 0, diagWidth, 0, 0,
      diagDepth, width, 0, 0, diagDepth, 0
    ];
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
  }

  private assertConfigured(): ThreeGeometryDeps {
    if (!this.THREE) throw new Error("WorldGeometryService is not configured");
    return this.THREE;
  }
}

function positionSetXYZ(attribute: AttributeLike, index: number, x: number, y: number, z: number): void {
  (attribute as AttributeLike & { setXYZ?: (index: number, x: number, y: number, z: number) => void }).setXYZ?.(index, x, y, z);
}

function normalSetXYZ(attribute: unknown, index: number, x: number, y: number, z: number): void {
  (attribute as { setXYZ?: (index: number, x: number, y: number, z: number) => void }).setXYZ?.(index, x, y, z);
}
