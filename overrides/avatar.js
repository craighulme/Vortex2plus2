let shirtTextureLoader = null;

function _textureLoader() {
  if (!shirtTextureLoader) {
    shirtTextureLoader = new THREE.TextureLoader();
  }
  return shirtTextureLoader;
}

function _canonicalBoneName(name) {
  return String(name || "").replace(/\s+/g, "_");
}

function _colorDistance(r, g, b, color) {
  const dr = r - color[0];
  const dg = g - color[1];
  const db = b - color[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function _sampleImageBackground(data, width, height) {
  const samples = [];
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)]
  ];

  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    if (data[i + 3] > 0) samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  if (!samples.length) return [0, 0, 0];

  return [0, 1, 2].map((channel) => {
    const values = samples.map((sample) => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
}

function _boostFaceTexture(texture) {
  const image = texture?.image;
  if (!image || !image.width || !image.height) {
    return texture;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparentPixels = 0;
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] < 16) transparentPixels += 1;
    }
    if (transparentPixels > canvas.width * canvas.height * 0.2) {
      return texture;
    }

    const background = _sampleImageBackground(data.data, canvas.width, canvas.height);
    const backgroundBrightness = (background[0] + background[1] + background[2]) / 3;

    for (let i = 0; i < data.data.length; i += 4) {
      const alpha = data.data[i + 3];
      if (alpha === 0) continue;

      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const distance = _colorDistance(r, g, b, background);
      const brightness = (r + g + b) / 3;

      if (
        alpha < 8 ||
        distance < 34 ||
        (backgroundBrightness < 24 && brightness < 28) ||
        (backgroundBrightness > 232 && brightness > 230 && distance < 80)
      ) {
        data.data[i + 3] = 0;
        continue;
      }

      data.data[i + 3] = Math.min(255, Math.max(alpha, 220));
    }
    ctx.putImageData(data, 0, 0);

    const boosted = new THREE.CanvasTexture(canvas);
    boosted.colorSpace = THREE.SRGBColorSpace;
    boosted.flipY = texture.flipY;
    boosted.needsUpdate = true;
    return boosted;
  } catch (error) {
    console.warn("[avatar] failed to boost face texture", error);
    return texture;
  }
}

function _maskClothingTexture(texture) {
  const image = texture?.image;
  if (!image || !image.width || !image.height) {
    return texture;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const key = [195, 195, 195];

    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i + 3] === 0) continue;

      const distance = _colorDistance(data.data[i], data.data[i + 1], data.data[i + 2], key);
      if (distance <= 18) {
        data.data[i + 3] = 0;
      } else if (distance <= 34) {
        data.data[i + 3] = Math.min(data.data[i + 3], Math.round((distance - 18) / 16 * 255));
      }
    }

    ctx.putImageData(data, 0, 0);

    const masked = new THREE.CanvasTexture(canvas);
    masked.colorSpace = THREE.SRGBColorSpace;
    masked.flipY = texture.flipY;
    masked.needsUpdate = true;
    return masked;
  } catch (error) {
    console.warn("[avatar] failed to mask clothing texture", error);
    return texture;
  }
}

function _applyShirtToMesh(mesh, textureUrl) {
  if (!mesh) {
    return;
  }

  const ticket = (mesh.userData.v22TextureTicket || 0) + 1;
  mesh.userData.v22TextureTicket = ticket;

  if (!textureUrl) {
    mesh.visible = false;
    mesh.traverse?.((child) => {
      if (/Overlay$/.test(child.name || "")) child.visible = false;
    });
    return;
  }

  _textureLoader().load(textureUrl, (texture) => {
    if (mesh.userData.v22TextureTicket !== ticket) {
      texture.dispose?.();
      return;
    }

    texture.colorSpace = THREE.SRGBColorSpace;

    const targets = new Set();
    if (mesh.material) targets.add(mesh);
    mesh.traverse?.((child) => {
      if (child.material && /Overlay$/.test(child.name || "")) targets.add(child);
    });

    texture.flipY = ![...targets].some((target) => target.userData?.v22TextureFlipY === false);
    texture.needsUpdate = true;

    let faceTexture = null;
    let clothingTexture = null;
    for (const target of targets) {
      const isFace = /FaceOverlay$/.test(target.name || "");
      const map = isFace ? (faceTexture ||= _boostFaceTexture(texture)) : (clothingTexture ||= _maskClothingTexture(texture));

      target.material.map?.dispose?.();
      target.material.map = map;
      target.material.color?.set?.(0xffffff);
      target.material.needsUpdate = true;
      target.visible = true;
    }
    mesh.visible = true;
  });
}

function _bodyPartIndexForMaterial(material, fallbackIndex = 0) {
  const materialName = String(material?.name || "");
  if (/Material\.002/i.test(materialName)) return 0;
  if (/Material\.001|Material\.003/i.test(materialName)) return 1;
  if (/Material\.004/i.test(materialName)) return 2;
  if (/Material\.005/i.test(materialName)) return 3;
  if (/Material\.007/i.test(materialName)) return 4;
  if (/Material\.008/i.test(materialName)) return 5;

  return [0, 2, 4, 3, 5, 1][fallbackIndex] ?? 0;
}

function _isWebGpuRuntime() {
  return window.__VORTEX_RENDERER_BACKEND === "webgpu" || window.renderer?.isWebGPURenderer === true;
}

function _makeWebGpuSafeAvatarMaterial(source) {
  const color = source?.color?.clone?.() || new THREE.Color(0xffffff);
  const material = new THREE.MeshStandardMaterial({
    name: source?.name || "",
    color,
    roughness: 0.68,
    metalness: 0,
    transparent: false,
    opacity: 1,
    fog: true
  });
  material.userData.v22WebGpuSafe = true;
  return material;
}

function _replaceAvatarMaterial(node, index, material) {
  if (Array.isArray(node.material)) {
    node.material[index] = material;
  } else {
    node.material = material;
  }
}

function _setBodyMaterialColor(material, color) {
  if (!material) return;

  if (!material.userData?.v22KeepVertexColors) {
    material.vertexColors = false;
  }
  material.color?.set(color);
  material.needsUpdate = true;
}

const _MODERN_SHIRT_MATS = new Set(["Material.001", "Material.003", "Material.004", "Material.005"]);
const _MODERN_PANT_MATS = new Set(["Material.007", "Material.008"]);
const _MODERN_HEAD_MAT = "Material.002";

function _cloneMaterialForAvatar(mesh) {
  if (!mesh?.material || mesh.userData.v22CatalogMaterialsCloned) return;

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => material?.clone ? material.clone() : material);
    mesh.userData.v22ClonedBodyMaterials = true;
  } else if (mesh.material.clone) {
    mesh.material = mesh.material.clone();
    mesh.userData.v22ClonedBodyMaterial = true;
  }
  mesh.userData.v22CatalogMaterialsCloned = true;
}

function _prepareModernAvatarMaterials(characterModel) {
  if (!characterModel) return null;
  if (characterModel.userData.v22ModernAvatarMaterials) {
    return characterModel.userData.v22ModernAvatarMaterials;
  }

  const webGpuRuntime = _isWebGpuRuntime();
  const materials = {
    shirtMaterials: [],
    pantMaterials: [],
    headMaterials: [],
    bodySlotMaterials: [[], [], [], [], [], []],
    tickets: { shirt: 0, pants: 0, face: 0 }
  };
  const seen = new Set();

  characterModel.traverse((node) => {
    if (!node.isMesh || /Overlay$/.test(node.name || "")) return;
    _cloneMaterialForAvatar(node);

    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (let i = 0; i < nodeMaterials.length; i += 1) {
      let material = nodeMaterials[i];
      if (!material || seen.has(material.uuid)) continue;

      if (webGpuRuntime && !material.userData?.v22WebGpuSafe) {
        material = _makeWebGpuSafeAvatarMaterial(material);
        _replaceAvatarMaterial(node, i, material);
        nodeMaterials[i] = material;
      }

      seen.add(material.uuid);

      const materialName = String(material.name || "");
      const slot = _bodyPartIndexForMaterial(material, -1);
      if (slot >= 0 && slot < 6 && /Material\.00[1234578]/i.test(materialName)) {
        materials.bodySlotMaterials[slot].push(material);
      }

      if (_MODERN_SHIRT_MATS.has(materialName)) {
        material.vertexColors = false;
        material.transparent = false;
        materials.shirtMaterials.push(material);
      } else if (_MODERN_PANT_MATS.has(materialName)) {
        material.vertexColors = false;
        material.transparent = false;
        materials.pantMaterials.push(material);
      } else if (materialName === _MODERN_HEAD_MAT) {
        material.vertexColors = false;
        material.transparent = false;
        materials.headMaterials.push(material);
      } else {
        material.vertexColors = false;
        material.map = null;
      }

      material.needsUpdate = true;
    }
  });

  characterModel.userData.v22ModernAvatarMaterials = materials;
  return materials;
}

function _setModernTexture(materials, textureUrl, kind) {
  if (!materials) return;

  const targets =
    kind === "shirt" ? materials.shirtMaterials :
    kind === "pants" ? materials.pantMaterials :
    materials.headMaterials;
  const ticket = (materials.tickets[kind] || 0) + 1;
  materials.tickets[kind] = ticket;

  if (!textureUrl || !targets.length) {
    for (const material of targets) {
      material.map = null;
      material.needsUpdate = true;
    }
    return;
  }

  _textureLoader().load(textureUrl, (texture) => {
    if (materials.tickets[kind] !== ticket) {
      texture.dispose?.();
      return;
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;

    for (const material of targets) {
      material.map = texture;
      material.needsUpdate = true;
    }
  });
}

function _applyModernAvatarTextures(characterModel, urls = {}) {
  if (_isWebGpuRuntime()) return;
  const materials = _prepareModernAvatarMaterials(characterModel);
  _setModernTexture(materials, urls.shirtUrl, "shirt");
  _setModernTexture(materials, urls.pantsUrl, "pants");
  _setModernTexture(materials, urls.faceUrl, "face");
}

function _applyBodyColors(characterModel, bodyColors) {
  const colors = Array.isArray(bodyColors) ? bodyColors : [];
  const normalized = [];
  for (let i = 0; i < 6; i += 1) {
    const value = String(colors[i] || "#ffffff").trim();
    normalized.push(/^#?[0-9a-f]{6}$/i.test(value) ? (value.startsWith("#") ? value : `#${value}`) : "#ffffff");
  }

  const modernMaterials = characterModel.userData?.v22ModernAvatarMaterials;
  if (modernMaterials) {
    for (let slot = 0; slot < 6; slot += 1) {
      for (const material of modernMaterials.bodySlotMaterials[slot] || []) {
        _setBodyMaterialColor(material, normalized[slot]);
      }
    }
    return;
  }

  characterModel.traverse((mesh) => {
    if (!mesh.isMesh || /Overlay$/.test(mesh.name || "")) return;

    if (Array.isArray(mesh.material) && mesh.material.length >= 6) {
      if (!mesh.userData.v22ClonedBodyMaterials) {
        mesh.material = mesh.material.map((m) => m.clone());
        mesh.userData.v22ClonedBodyMaterials = true;
      }

      for (let i = 0; i < Math.min(6, mesh.material.length); i += 1) {
        _setBodyMaterialColor(mesh.material[i], normalized[_bodyPartIndexForMaterial(mesh.material[i], i)]);
      }
      return;
    }

    if (mesh.material?.color && !mesh.userData.v22KeepMaterialColor) {
      if (!mesh.userData.v22ClonedBodyMaterial) {
        mesh.material = mesh.material.clone();
        mesh.userData.v22ClonedBodyMaterial = true;
      }

      const materialName = String(mesh.material.name || "");
      const meshName = String(mesh.name || "");
      const partIndex =
        /Head|Material\.002/i.test(`${meshName} ${materialName}`) ? 0 :
        /Torso|Material\.001|Material\.003/i.test(`${meshName} ${materialName}`) ? 1 :
        /LArm|Left.?Arm|Material\.004/i.test(`${meshName} ${materialName}`) ? 2 :
        /RArm|Right.?Arm|Material\.005/i.test(`${meshName} ${materialName}`) ? 3 :
        /LLeg|Left.?Leg|Material\.007/i.test(`${meshName} ${materialName}`) ? 4 :
        /RLeg|Right.?Leg|Material\.008/i.test(`${meshName} ${materialName}`) ? 5 :
        0;

      _setBodyMaterialColor(mesh.material, normalized[partIndex]);
    }
  });
}

function _uvTemplates() {
  const torso = {
    top:    [0.39487179487179486, 0.8711985688729875, 0.6136752136752137, 0.9856887298747764],
    front:  [0.39487179487179486, 0.6386404293381038, 0.6136752136752137, 0.8676207513416816],
    bottom: [0.39487179487179486, 0.5205724508050089, 0.6136752136752137, 0.6350626118067979],
    left:   [0.6170940170940171, 0.6386404293381038, 0.7264957264957265, 0.8676207513416816],
    right:  [0.28205128205128205, 0.6386404293381038, 0.39145299145299145, 0.8676207513416816],
    back:   [0.7299145299145299, 0.6386404293381038, 0.9487179487179487, 0.8676207513416816]
  };

  const leftLimb = {
    top:    [0.37094017094017095, 0.368515205724508, 0.48034188034188036, 0.483005366726297],
    left:   [0.03247863247863248, 0.13595706618962433, 0.14188034188034188, 0.3649373881932021],
    front:  [0.37094017094017095, 0.13595706618962433, 0.48034188034188036, 0.3649373881932021],
    right:  [0.25811965811965815, 0.13595706618962433, 0.36752136752136755, 0.3649373881932021],
    back:   [0.1452991452991453, 0.13595706618962433, 0.2547008547008547, 0.3649373881932021],
    bottom: [0.37094017094017095, 0.017889087656529523, 0.48034188034188036, 0.1323792486583184]
  };

  const rightLimb = {
    top:    [0.5264957264957265, 0.368515205724508, 0.6358974358974359, 0.483005366726297],
    front:  [0.5264957264957265, 0.13595706618962433, 0.6358974358974359, 0.3649373881932021],
    left:   [0.6393162393162393, 0.13595706618962433, 0.7487179487179487, 0.3649373881932021],
    right:  [0.864957264957265, 0.13595706618962433, 0.9743589743589743, 0.3649373881932021],
    back:   [0.7521367521367521, 0.13595706618962433, 0.8615384615384616, 0.3649373881932021],
    bottom: [0.5264957264957265, 0.017889087656529523, 0.6358974358974359, 0.1323792486583184]
  };

  return { torso, leftLimb, rightLimb };
}

function _buildClothingOverlay(characterModel, kind = "shirt") {
  const { torso, leftLimb, rightLimb } = _uvTemplates();
  const wantedBones = kind === "pants"
    ? new Set(["Left_Leg", "Right_Leg"])
    : new Set(["Torso", "Left_Arm", "Right_Arm"]);

  const bodyMeshes = [];

  characterModel.traverse((child) => {
    if (child.isSkinnedMesh && !/Overlay$/.test(child.name || "")) {
      bodyMeshes.push(child);
    }
  });

  if (!bodyMeshes.length) {
    return null;
  }

  const overlays = [];
  for (const bodyMesh of bodyMeshes) {
    const overlay = _buildClothingOverlayForMesh(bodyMesh, kind, wantedBones, torso, leftLimb, rightLimb);
    if (overlay) overlays.push(overlay);
  }

  if (!overlays.length) {
    console.warn(`[avatar] no ${kind} faces found`);
    return null;
  }

  if (overlays.length === 1) {
    bodyMeshes[0].parent.add(overlays[0]);
    return overlays[0];
  }

  const group = new THREE.Group();
  group.name = kind === "pants" ? "PantsOverlay" : "ShirtOverlay";
  group.visible = false;
  for (const overlay of overlays) group.add(overlay);
  characterModel.add(group);
  return group;
}

function _buildClothingOverlayForMesh(bodyMesh, kind, wantedBones, torso, leftLimb, rightLimb) {
  const geometry = bodyMesh.geometry;
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  const sourceUvs = geometry.attributes.uv?.array || geometry.attributes.uv0?.array || null;
  const skinIndices = geometry.attributes.skinIndex.array;
  const skinWeights = geometry.attributes.skinWeight.array;
  const indices = geometry.index ? geometry.index.array : null;
  const boneNames = bodyMesh.skeleton.bones.map((bone) => _canonicalBoneName(bone.name));

  function getDominantBone(vertexIndex) {
    let bestWeight = -1;
    let bestBoneName = "";

    for (let i = 0; i < 4; i++) {
      const weight = skinWeights[vertexIndex * 4 + i];
      if (weight > bestWeight) {
        bestWeight = weight;
        bestBoneName = boneNames[skinIndices[vertexIndex * 4 + i]] || "";
      }
    }

    return bestBoneName;
  }

  const triangleCount = indices ? indices.length / 3 : positions.length / 9;

  function chooseTriangleBone(a, b, c) {
    const boneA = getDominantBone(a);
    const boneB = getDominantBone(b);
    const boneC = getDominantBone(c);

    if (wantedBones.has(boneA) && boneA === boneB && boneA === boneC) return boneA;
    if (wantedBones.has(boneA) && boneA === boneB) return boneA;
    if (wantedBones.has(boneB) && boneB === boneC) return boneB;
    if (wantedBones.has(boneA)) return boneA;
    return null;
  }

  const boneBounds = {};
  for (const boneName of wantedBones) {
    boneBounds[boneName] = {
      xMin: Infinity,
      xMax: -Infinity,
      yMin: Infinity,
      yMax: -Infinity,
      zMin: Infinity,
      zMax: -Infinity
    };
  }

  for (let tri = 0; tri < triangleCount; tri++) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;

    const boneName = chooseTriangleBone(a, b, c);
    if (!boneName) continue;

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];
      const bounds = boneBounds[boneName];

      bounds.xMin = Math.min(bounds.xMin, x);
      bounds.xMax = Math.max(bounds.xMax, x);
      bounds.yMin = Math.min(bounds.yMin, y);
      bounds.yMax = Math.max(bounds.yMax, y);
      bounds.zMin = Math.min(bounds.zMin, z);
      bounds.zMax = Math.max(bounds.zMax, z);
    }
  }

  const outPositions = [];
  const outNormals = [];
  const outUvs = [];
  const outSkinIndices = [];
  const outSkinWeights = [];

  for (let tri = 0; tri < triangleCount; tri++) {
    const a = indices ? indices[tri * 3 + 0] : tri * 3 + 0;
    const b = indices ? indices[tri * 3 + 1] : tri * 3 + 1;
    const c = indices ? indices[tri * 3 + 2] : tri * 3 + 2;

    const boneName = chooseTriangleBone(a, b, c);
    if (!boneName) continue;

    const triangleNormals = [a, b, c].map((vertexIndex) => [
      normals[vertexIndex * 3 + 0],
      normals[vertexIndex * 3 + 1],
      normals[vertexIndex * 3 + 2]
    ]);

    let nx = (triangleNormals[0][0] + triangleNormals[1][0] + triangleNormals[2][0]) / 3;
    let ny = (triangleNormals[0][1] + triangleNormals[1][1] + triangleNormals[2][1]) / 3;
    let nz = (triangleNormals[0][2] + triangleNormals[1][2] + triangleNormals[2][2]) / 3;

    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;

    const absX = Math.abs(nx);
    const absY = Math.abs(ny);
    const absZ = Math.abs(nz);
    const dominantAxis = Math.max(absX, absY, absZ);
    const signX = dominantAxis === absX ? Math.sign(nx) : 0;
    const signY = dominantAxis === absY ? Math.sign(ny) : 0;
    const signZ = dominantAxis === absZ ? Math.sign(nz) : 0;

    let faceDirection;
    if (signZ < 0) faceDirection = "front";
    else if (signZ > 0) faceDirection = "back";
    else if (signX > 0) faceDirection = "+x";
    else if (signX < 0) faceDirection = "-x";
    else if (signY > 0) faceDirection = "top";
    else faceDirection = "bottom";

    const uvBoxes =
      boneName === "Torso"
        ? torso
        : boneName === "Right_Arm" || boneName === "Right_Leg"
          ? leftLimb
          : rightLimb;

    const faceUvBox = {
      front: uvBoxes.front,
      back: uvBoxes.back,
      top: uvBoxes.top,
      bottom: uvBoxes.bottom,
      "+x": uvBoxes.right,
      "-x": uvBoxes.left
    }[faceDirection];

    const bounds = boneBounds[boneName];

    for (const vertexIndex of [a, b, c]) {
      const x = positions[vertexIndex * 3 + 0];
      const y = positions[vertexIndex * 3 + 1];
      const z = positions[vertexIndex * 3 + 2];

      outPositions.push(x, y, z);
      outNormals.push(
        normals[vertexIndex * 3 + 0],
        normals[vertexIndex * 3 + 1],
        normals[vertexIndex * 3 + 2]
      );

      if (sourceUvs) {
        outUvs.push(sourceUvs[vertexIndex * 2 + 0], sourceUvs[vertexIndex * 2 + 1]);
      } else {
        const u = bounds.xMax > bounds.xMin ? (x - bounds.xMin) / (bounds.xMax - bounds.xMin) : 0.5;
        const v = bounds.yMax > bounds.yMin ? (y - bounds.yMin) / (bounds.yMax - bounds.yMin) : 0.5;
        const w = bounds.zMax > bounds.zMin ? (z - bounds.zMin) / (bounds.zMax - bounds.zMin) : 0.5;

        let uvX;
        let uvY;

        switch (faceDirection) {
          case "front":
            uvX = u;
            uvY = v;
            break;
          case "back":
            uvX = 1 - u;
            uvY = v;
            break;
          case "+x":
            uvX = 1 - w;
            uvY = v;
            break;
          case "-x":
            uvX = w;
            uvY = v;
            break;
          case "top":
            uvX = u;
            uvY = 1 - w;
            break;
          case "bottom":
            uvX = u;
            uvY = w;
            break;
          default:
            uvX = u;
            uvY = v;
            break;
        }

        uvX = Math.min(1, Math.max(0, uvX));
        uvY = Math.min(1, Math.max(0, uvY));

        const [u0, v0, u1, v1] = faceUvBox;
        outUvs.push(u0 + uvX * (u1 - u0), v0 + uvY * (v1 - v0));
      }

      for (let i = 0; i < 4; i++) {
        outSkinIndices.push(skinIndices[vertexIndex * 4 + i]);
        outSkinWeights.push(skinWeights[vertexIndex * 4 + i]);
      }
    }
  }

  if (!outPositions.length) {
    return null;
  }

  const overlayGeometry = new THREE.BufferGeometry();
  overlayGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPositions), 3));
  overlayGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(outNormals), 3));
  overlayGeometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUvs), 2));
  overlayGeometry.setAttribute("skinIndex", new THREE.BufferAttribute(new Uint16Array(outSkinIndices), 4));
  overlayGeometry.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(outSkinWeights), 4));

  const overlayMesh = new THREE.SkinnedMesh(
    overlayGeometry,
    new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      roughness: 0.7,
      metalness: 0
    })
  );

  overlayMesh.name = kind === "pants" ? "PantsOverlay" : "ShirtOverlay";
  overlayMesh.visible = false;
  overlayMesh.renderOrder = 1;
  if (sourceUvs) overlayMesh.userData.v22TextureFlipY = false;
  overlayMesh.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  return overlayMesh;
}

function _buildShirtOverlay(characterModel) {
  return _buildClothingOverlay(characterModel, "shirt");
}

function _buildPantsOverlay(characterModel) {
  return _buildClothingOverlay(characterModel, "pants");
}

function _buildFaceOverlay(characterModel) {
  let bodyMesh = null;
  let headBoneIndex = -1;

  characterModel.traverse((child) => {
    if (!bodyMesh && child.isSkinnedMesh && !/Overlay$/.test(child.name || "")) {
      const bones = child.skeleton?.bones || [];
      const index = bones.findIndex((bone) => _canonicalBoneName(bone.name) === "Head");
      if (index >= 0) {
        bodyMesh = child;
        headBoneIndex = index;
      }
    }
  });

  if (!bodyMesh || headBoneIndex < 0) return null;

  const position = bodyMesh.geometry.attributes.position;
  const skinIndex = bodyMesh.geometry.attributes.skinIndex;
  const skinWeight = bodyMesh.geometry.attributes.skinWeight;
  const skinIndexArray = skinIndex.array;
  const skinWeightArray = skinWeight.array;
  const headBounds = {
    xMin: Infinity,
    xMax: -Infinity,
    yMin: Infinity,
    yMax: -Infinity,
    zMin: Infinity,
    zMax: -Infinity
  };

  for (let i = 0; i < position.count; i += 1) {
    let headInfluence = 0;
    for (let j = 0; j < 4; j += 1) {
      const offset = i * 4 + j;
      if (skinIndexArray[offset] === headBoneIndex) {
        headInfluence += skinWeightArray[offset];
      }
    }
    if (headInfluence < 0.5) continue;
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    headBounds.xMin = Math.min(headBounds.xMin, x);
    headBounds.xMax = Math.max(headBounds.xMax, x);
    headBounds.yMin = Math.min(headBounds.yMin, y);
    headBounds.yMax = Math.max(headBounds.yMax, y);
    headBounds.zMin = Math.min(headBounds.zMin, z);
    headBounds.zMax = Math.max(headBounds.zMax, z);
  }

  if (!Number.isFinite(headBounds.xMin)) return null;

  const headWidth = headBounds.xMax - headBounds.xMin;
  const headHeight = headBounds.yMax - headBounds.yMin;
  const faceSize = Math.min(headWidth * 0.72, headHeight * 0.62);
  const cx = (headBounds.xMin + headBounds.xMax) * 0.5;
  const cy = headBounds.yMin + headHeight * 0.56;
  const halfFace = faceSize * 0.5;
  const x0 = cx - halfFace;
  const x1 = cx + halfFace;
  const y0 = cy - halfFace;
  const y1 = cy + halfFace;
  const z = headBounds.zMin - Math.max(0.004, (headBounds.zMax - headBounds.zMin) * 0.006);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        x0, y0, z,
        x1, y0, z,
        x1, y1, z,
        x0, y1, z
      ]),
      3
    )
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, -1,
        0, 0, -1,
        0, 0, -1,
        0, 0, -1
      ]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(
      new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0
      ]),
      2
    )
  );
  geometry.setAttribute(
    "skinIndex",
    new THREE.BufferAttribute(
      new Uint16Array([
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0,
        headBoneIndex, 0, 0, 0
      ]),
      4
    )
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.BufferAttribute(
      new Float32Array([
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 0, 0
      ]),
      4
    )
  );
  geometry.setIndex([0, 2, 1, 0, 3, 2]);

  const face = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -0.25,
      polygonOffsetUnits: -1
    })
  );

  face.name = "FaceOverlay";
  face.visible = false;
  face.renderOrder = 0;
  face.userData.v22TextureFlipY = false;
  face.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  bodyMesh.parent.add(face);
  return face;
}
