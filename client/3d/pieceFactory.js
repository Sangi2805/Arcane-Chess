import * as THREE from "/vendor/three/three.module.js";

const PIECE_ANCHOR_Y = 0.186;
const PIECE_SHADOW_TEXTURE_SIZE = 256;
const PIECE_MODEL_CACHE = new Map();
const PIECE_MATERIAL_TEMPLATE_CACHE = new Map();
let groundShadowTexture = null;

const PROTOTYPE_ROLE_MATERIALS = {
  core: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.1
  }),
  trim: new THREE.MeshStandardMaterial({
    color: 0xd4b27b,
    roughness: 0.3,
    metalness: 0.7
  }),
  sigil: new THREE.MeshStandardMaterial({
    color: 0xf0d7a6,
    emissive: 0x3a2412,
    emissiveIntensity: 0.05,
    roughness: 0.24,
    metalness: 0.52
  })
};

const PIECE_VISUAL_SPECS = {
  p: {
    height: 1.16,
    shadowWidth: 0.52,
    shadowDepth: 0.38,
    shadowOpacity: 0.17
  },
  r: {
    height: 1.32,
    shadowWidth: 0.62,
    shadowDepth: 0.44,
    shadowOpacity: 0.19
  },
  n: {
    height: 1.38,
    shadowWidth: 0.68,
    shadowDepth: 0.5,
    shadowOpacity: 0.21
  },
  b: {
    height: 1.38,
    shadowWidth: 0.62,
    shadowDepth: 0.46,
    shadowOpacity: 0.2
  },
  q: {
    height: 1.54,
    shadowWidth: 0.72,
    shadowDepth: 0.52,
    shadowOpacity: 0.22
  },
  k: {
    height: 1.62,
    shadowWidth: 0.76,
    shadowDepth: 0.56,
    shadowOpacity: 0.23
  }
};

const PIECE_PALETTES = {
  white: {
    core: {
      color: 0xddd6ca,
      roughness: 0.54,
      metalness: 0.08,
      clearcoat: 0.32,
      clearcoatRoughness: 0.38,
      emissive: 0x15110d,
      emissiveIntensity: 0.02,
      specularIntensity: 0.48,
      specularColor: 0xf3e8d7
    },
    trim: {
      color: 0xb7905d,
      roughness: 0.2,
      metalness: 0.74,
      clearcoat: 0.74,
      clearcoatRoughness: 0.16,
      emissive: 0x26180d,
      emissiveIntensity: 0.038,
      specularIntensity: 0.68,
      specularColor: 0xffefd2
    },
    sigil: {
      color: 0xf0d6a7,
      roughness: 0.18,
      metalness: 0.48,
      clearcoat: 0.82,
      clearcoatRoughness: 0.16,
      emissive: 0x5a3d1b,
      emissiveIntensity: 0.072,
      specularIntensity: 0.62,
      specularColor: 0xffe7bf
    }
  },
  black: {
    core: {
      color: 0x20252d,
      roughness: 0.34,
      metalness: 0.3,
      clearcoat: 0.58,
      clearcoatRoughness: 0.2,
      emissive: 0x0b1118,
      emissiveIntensity: 0.034,
      specularIntensity: 0.74,
      specularColor: 0xd4e2f5
    },
    trim: {
      color: 0x74879e,
      roughness: 0.18,
      metalness: 0.8,
      clearcoat: 0.84,
      clearcoatRoughness: 0.14,
      emissive: 0x121b27,
      emissiveIntensity: 0.048,
      specularIntensity: 0.86,
      specularColor: 0xe4eefc
    },
    sigil: {
      color: 0xc2d6eb,
      roughness: 0.15,
      metalness: 0.56,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14,
      emissive: 0x314d66,
      emissiveIntensity: 0.086,
      specularIntensity: 0.8,
      specularColor: 0xf0f6ff
    }
  }
};

const PIECE_ROLE_SELECTION_MULTIPLIER = {
  core: 1,
  trim: 1.18,
  sigil: 1.46
};

const getPieceVisualSpec = (pieceType) => PIECE_VISUAL_SPECS[pieceType] || PIECE_VISUAL_SPECS.p;
const getPiecePalette = (color) => PIECE_PALETTES[color] || PIECE_PALETTES.white;

const createRuntimeCanvas = (width, height) => {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  throw new Error("Canvas support is required to build piece shadows.");
};

const registerMaterial = (material, { selectionBoostMultiplier = 1 } = {}) => {
  material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 0;
  material.userData.baseOpacity = material.opacity ?? 1;
  material.userData.baseRoughness = material.roughness ?? 0;
  material.userData.baseMetalness = material.metalness ?? 0;
  material.userData.baseClearcoat = material.clearcoat ?? 0;
  material.userData.baseClearcoatRoughness = material.clearcoatRoughness ?? 0;
  material.userData.baseSpecularIntensity = material.specularIntensity ?? 0;
  material.userData.selectionBoostMultiplier = selectionBoostMultiplier;
  return material;
};

const setMaterialRole = (mesh, role) => {
  mesh.userData.materialRole = role;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 6;
  return mesh;
};

const addPrototypeMesh = (
  group,
  geometry,
  role,
  position,
  {
    rotation = null,
    scale = null
  } = {}
) => {
  const mesh = setMaterialRole(
    new THREE.Mesh(geometry, PROTOTYPE_ROLE_MATERIALS[role] || PROTOTYPE_ROLE_MATERIALS.core),
    role
  );

  mesh.position.copy(position);

  if (rotation) {
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  if (scale) {
    mesh.scale.set(scale.x, scale.y, scale.z);
  }

  group.add(mesh);
  return mesh;
};

const createPedestal = (
  group,
  {
    baseRadius = 0.28,
    baseHeight = 0.12,
    plinthRadius = 0.22,
    plinthHeight = 0.18,
    plaqueWidth = 0.18,
    plaqueHeight = 0.12,
    plaqueDepth = 0.04
  } = {}
) => {
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(baseRadius * 1.06, baseRadius, baseHeight, 18),
    "core",
    new THREE.Vector3(0, baseHeight / 2, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.TorusGeometry(baseRadius * 0.98, 0.026, 10, 28),
    "trim",
    new THREE.Vector3(0, baseHeight * 0.74, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(plinthRadius, plinthRadius * 1.04, plinthHeight, 16),
    "core",
    new THREE.Vector3(0, baseHeight + plinthHeight / 2 - 0.01, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(plaqueWidth * 1.14, plaqueHeight * 1.12, plaqueDepth * 1.4),
    "trim",
    new THREE.Vector3(0, baseHeight + plinthHeight * 0.56, baseRadius + plaqueDepth * 0.42)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(plaqueWidth, plaqueHeight, plaqueDepth),
    "sigil",
    new THREE.Vector3(0, baseHeight + plinthHeight * 0.56, baseRadius + plaqueDepth * 0.72)
  );
};

const finalizePrototype = (pieceType, group) => {
  const spec = getPieceVisualSpec(pieceType);
  const initialBounds = new THREE.Box3().setFromObject(group);

  if (!initialBounds.isEmpty()) {
    const initialSize = initialBounds.getSize(new THREE.Vector3());

    if (initialSize.y > 0.0001) {
      group.scale.setScalar(spec.height / initialSize.y);
    }
  }

  const fittedBounds = new THREE.Box3().setFromObject(group);

  if (!fittedBounds.isEmpty()) {
    const center = fittedBounds.getCenter(new THREE.Vector3());
    group.position.x -= center.x;
    group.position.z -= center.z;
    group.position.y -= fittedBounds.min.y;
  }

  return group;
};

const buildPawnPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.26,
    plinthRadius: 0.18,
    plinthHeight: 0.14,
    plaqueWidth: 0.15,
    plaqueHeight: 0.1
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.1, 0.13, 0.34, 18),
    "core",
    new THREE.Vector3(0, 0.38, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.TorusGeometry(0.13, 0.022, 10, 24),
    "trim",
    new THREE.Vector3(0, 0.55, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.SphereGeometry(0.17, 18, 18),
    "core",
    new THREE.Vector3(0, 0.74, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.SphereGeometry(0.055, 12, 12),
    "sigil",
    new THREE.Vector3(0, 0.93, 0.035)
  );
  return finalizePrototype("p", group);
};

const buildRookPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.29,
    plinthRadius: 0.21,
    plinthHeight: 0.16,
    plaqueWidth: 0.16,
    plaqueHeight: 0.1
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.16, 0.19, 0.56, 20),
    "core",
    new THREE.Vector3(0, 0.5, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.2, 0.16, 18),
    "trim",
    new THREE.Vector3(0, 0.84, 0)
  );
  [
    new THREE.Vector3(0.14, 0.95, 0.14),
    new THREE.Vector3(-0.14, 0.95, 0.14),
    new THREE.Vector3(0.14, 0.95, -0.14),
    new THREE.Vector3(-0.14, 0.95, -0.14)
  ].forEach((position) => {
    addPrototypeMesh(group, new THREE.BoxGeometry(0.1, 0.1, 0.1), "trim", position);
  });
  return finalizePrototype("r", group);
};

const buildKnightPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.29,
    plinthRadius: 0.2,
    plinthHeight: 0.16,
    plaqueWidth: 0.16,
    plaqueHeight: 0.1
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.11, 0.15, 0.28, 16),
    "core",
    new THREE.Vector3(0, 0.34, -0.01)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.26, 0.34, 0.22),
    "core",
    new THREE.Vector3(0, 0.56, 0.02),
    {
      rotation: new THREE.Euler(-0.08, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.18, 0.4, 0.16),
    "core",
    new THREE.Vector3(0, 0.86, 0.11),
    {
      rotation: new THREE.Euler(-0.48, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.2, 0.24, 0.18),
    "core",
    new THREE.Vector3(0, 1.02, 0.23),
    {
      rotation: new THREE.Euler(-0.18, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.12, 0.12, 0.14),
    "trim",
    new THREE.Vector3(0, 0.95, 0.34),
    {
      rotation: new THREE.Euler(-0.12, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.05, 0.22, 0.16),
    "trim",
    new THREE.Vector3(0, 1.0, 0.08)
  );
  [
    new THREE.Vector3(0.06, 1.18, 0.21),
    new THREE.Vector3(-0.06, 1.18, 0.21)
  ].forEach((position) => {
    addPrototypeMesh(
      group,
      new THREE.ConeGeometry(0.035, 0.12, 8),
      "sigil",
      position,
      {
        rotation: new THREE.Euler(0.1, 0, 0)
      }
    );
  });
  return finalizePrototype("n", group);
};

const buildBishopPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.28,
    plinthRadius: 0.19,
    plinthHeight: 0.15
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.09, 0.13, 0.5, 18),
    "core",
    new THREE.Vector3(0, 0.46, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.TorusGeometry(0.14, 0.02, 10, 24),
    "trim",
    new THREE.Vector3(0, 0.69, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.SphereGeometry(0.16, 18, 18),
    "core",
    new THREE.Vector3(0, 0.88, 0),
    {
      scale: new THREE.Vector3(0.86, 1.26, 0.86)
    }
  );
  addPrototypeMesh(
    group,
    new THREE.ConeGeometry(0.08, 0.22, 12),
    "trim",
    new THREE.Vector3(0, 1.12, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.045, 0.28, 0.03),
    "sigil",
    new THREE.Vector3(0, 0.9, 0.13),
    {
      rotation: new THREE.Euler(0, 0, 0.42)
    }
  );
  return finalizePrototype("b", group);
};

const buildQueenPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.3,
    plinthRadius: 0.2,
    plinthHeight: 0.16
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.1, 0.16, 0.62, 20),
    "core",
    new THREE.Vector3(0, 0.5, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.17, 0.13, 0.16, 18),
    "trim",
    new THREE.Vector3(0, 0.82, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.TorusGeometry(0.16, 0.026, 10, 28),
    "trim",
    new THREE.Vector3(0, 0.92, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    addPrototypeMesh(
      group,
      new THREE.ConeGeometry(0.045, 0.16, 8),
      "trim",
      new THREE.Vector3(Math.sin(angle) * 0.14, 1.03, Math.cos(angle) * 0.14)
    );
  }
  addPrototypeMesh(
    group,
    new THREE.SphereGeometry(0.07, 14, 14),
    "sigil",
    new THREE.Vector3(0, 1.12, 0)
  );
  return finalizePrototype("q", group);
};

const buildKingPrototype = () => {
  const group = new THREE.Group();
  createPedestal(group, {
    baseRadius: 0.31,
    plinthRadius: 0.21,
    plinthHeight: 0.17
  });
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.11, 0.17, 0.68, 20),
    "core",
    new THREE.Vector3(0, 0.54, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.CylinderGeometry(0.18, 0.14, 0.16, 18),
    "trim",
    new THREE.Vector3(0, 0.89, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.28, 0.08),
    "trim",
    new THREE.Vector3(0, 1.12, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.28, 0.06, 0.08),
    "sigil",
    new THREE.Vector3(0, 1.2, 0)
  );
  addPrototypeMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.06, 0.22),
    "sigil",
    new THREE.Vector3(0, 1.2, 0)
  );
  return finalizePrototype("k", group);
};

const buildPiecePrototype = (pieceType) => {
  switch (pieceType) {
    case "p":
      return buildPawnPrototype();
    case "r":
      return buildRookPrototype();
    case "n":
      return buildKnightPrototype();
    case "b":
      return buildBishopPrototype();
    case "q":
      return buildQueenPrototype();
    case "k":
      return buildKingPrototype();
    default:
      return buildPawnPrototype();
  }
};

const getPiecePrototype = (pieceType) => {
  if (!PIECE_MODEL_CACHE.has(pieceType)) {
    PIECE_MODEL_CACHE.set(pieceType, buildPiecePrototype(pieceType));
  }

  return PIECE_MODEL_CACHE.get(pieceType);
};

const createMaterialTemplate = (role, color) => {
  const palette = getPiecePalette(color);
  const baseSettings = palette[role] || palette.core;
  const sideBaseMultiplier = color === "white" ? 1.12 : 1.18;
  const selectionBoostMultiplier =
    sideBaseMultiplier * (PIECE_ROLE_SELECTION_MULTIPLIER[role] || PIECE_ROLE_SELECTION_MULTIPLIER.core);
  const materialSettings = {
    color: baseSettings.color,
    roughness: baseSettings.roughness,
    metalness: baseSettings.metalness,
    clearcoat: baseSettings.clearcoat,
    clearcoatRoughness: baseSettings.clearcoatRoughness,
    emissive: baseSettings.emissive,
    emissiveIntensity: baseSettings.emissiveIntensity
  };

  if (baseSettings.specularIntensity != null) {
    materialSettings.specularIntensity = baseSettings.specularIntensity;
  }

  if (baseSettings.specularColor != null) {
    materialSettings.specularColor = new THREE.Color(baseSettings.specularColor);
  }

  return registerMaterial(
    new THREE.MeshPhysicalMaterial(materialSettings),
    {
      selectionBoostMultiplier
    }
  );
};

const getMaterialTemplate = (role, color) => {
  const cacheKey = `${color}:${role}`;

  if (!PIECE_MATERIAL_TEMPLATE_CACHE.has(cacheKey)) {
    PIECE_MATERIAL_TEMPLATE_CACHE.set(cacheKey, createMaterialTemplate(role, color));
  }

  return PIECE_MATERIAL_TEMPLATE_CACHE.get(cacheKey);
};

const instantiatePieceModel = (pieceType, color) => {
  const model = getPiecePrototype(pieceType).clone(true);

  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.geometry = child.geometry.clone();
    child.material = getMaterialTemplate(child.userData.materialRole || "core", color).clone();
    child.material.userData = {
      ...child.material.userData,
      materialRole: child.userData.materialRole || "core"
    };
    child.castShadow = true;
    child.receiveShadow = true;
    child.renderOrder = 6;
  });

  return model;
};

const createTextureFromCanvas = (canvas) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

const buildGroundShadowTexture = () => {
  const canvas = createRuntimeCanvas(PIECE_SHADOW_TEXTURE_SIZE, PIECE_SHADOW_TEXTURE_SIZE);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create a 2D drawing context for piece shadows.");
  }

  const radius = PIECE_SHADOW_TEXTURE_SIZE / 2;
  const gradient = ctx.createRadialGradient(radius, radius, radius * 0.12, radius, radius, radius * 0.5);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.58)");
  gradient.addColorStop(0.42, "rgba(0, 0, 0, 0.24)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.clearRect(0, 0, PIECE_SHADOW_TEXTURE_SIZE, PIECE_SHADOW_TEXTURE_SIZE);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(radius, radius, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();

  return createTextureFromCanvas(canvas);
};

const getGroundShadowTexture = () => {
  if (!groundShadowTexture) {
    groundShadowTexture = buildGroundShadowTexture();
  }

  return groundShadowTexture;
};

const createArcanePieceGroundShadow = (piece) => {
  const spec = getPieceVisualSpec(piece.type);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(spec.shadowWidth, spec.shadowDepth),
    registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        map: getGroundShadowTexture(),
        transparent: true,
        opacity: spec.shadowOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      {
        selectionBoostMultiplier: 0
      }
    )
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 2;
  return shadow;
};

const createArcanePiece = (piece) => {
  const spec = getPieceVisualSpec(piece.type);
  const group = new THREE.Group();
  const modelRoot = instantiatePieceModel(piece.type, piece.color);

  modelRoot.rotation.y = piece.color === "white" ? Math.PI : 0;
  group.add(modelRoot);

  group.userData.height = spec.height;
  group.userData.pieceType = piece.type;
  group.userData.pieceColor = piece.color;
  group.userData.anchorY = PIECE_ANCHOR_Y;
  return group;
};

export { createArcanePiece, createArcanePieceGroundShadow };
