import * as THREE from "/vendor/three/three.module.js";

const PIECE_PALETTES = {
  white: {
    base: "#e6dbc9",
    accent: "#bda789",
    glow: "#18120d",
    sheen: "#f6efe2"
  },
  black: {
    base: "#111315",
    accent: "#555d66",
    glow: "#07090c",
    sheen: "#8f99a4"
  }
};

const registerMaterial = (material) => {
  material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 0;
  material.userData.baseOpacity = material.opacity ?? 1;
  return material;
};

const createMaterials = (color) => {
  const palette = PIECE_PALETTES[color] || PIECE_PALETTES.white;
  const isWhite = color === "white";

  return {
    core: registerMaterial(new THREE.MeshPhysicalMaterial({
      color: palette.base,
      roughness: isWhite ? 0.72 : 0.46,
      metalness: isWhite ? 0.01 : 0.08,
      clearcoat: isWhite ? 0.16 : 0.22,
      clearcoatRoughness: isWhite ? 0.74 : 0.58,
      specularIntensity: isWhite ? 0.42 : 0.34,
      sheen: isWhite ? 0.04 : 0.02,
      sheenColor: palette.sheen,
      sheenRoughness: isWhite ? 0.72 : 0.68,
      emissive: isWhite ? "#15100c" : "#05070a",
      emissiveIntensity: isWhite ? 0.003 : 0.005,
      transparent: false,
      opacity: 1
    })),
    trim: registerMaterial(new THREE.MeshPhysicalMaterial({
      color: palette.accent,
      roughness: isWhite ? 0.48 : 0.34,
      metalness: isWhite ? 0.14 : 0.2,
      clearcoat: isWhite ? 0.2 : 0.28,
      clearcoatRoughness: isWhite ? 0.56 : 0.42,
      specularIntensity: isWhite ? 0.36 : 0.3,
      sheen: isWhite ? 0.03 : 0.02,
      sheenColor: palette.sheen,
      sheenRoughness: 0.62,
      emissive: palette.glow,
      emissiveIntensity: isWhite ? 0.006 : 0.008,
      transparent: false,
      opacity: 1
    }))
  };
};

const applySurfaceTraits = (group) => {
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.renderOrder = 6;
    }
  });

  return group;
};

const addMesh = (group, geometry, material, position, rotation = null, scale = null) => {
  const mesh = new THREE.Mesh(geometry, material);

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

const addBaseRing = (group, materials, radius, tube, y) =>
  addMesh(
    group,
    new THREE.TorusGeometry(radius, tube, 10, 28),
    materials.trim,
    new THREE.Vector3(0, y, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );

const createPawn = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.24, 0.03, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.27, 0.34, 0.16, 24),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.16, 0.2, 0.36, 20),
    materials.core,
    new THREE.Vector3(0, 0.32, 0)
  );
  addMesh(
    group,
    new THREE.SphereGeometry(0.16, 20, 20),
    materials.trim,
    new THREE.Vector3(0, 0.6, 0)
  );

  group.userData.height = 0.74;
  return applySurfaceTraits(group);
};

const createRook = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.27, 0.032, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.3, 0.38, 0.16, 24),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.24, 0.27, 0.54, 22),
    materials.core,
    new THREE.Vector3(0, 0.43, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.3, 0.26, 0.16, 20),
    materials.trim,
    new THREE.Vector3(0, 0.77, 0)
  );

  [
    new THREE.Vector3(0.19, 0.89, 0.19),
    new THREE.Vector3(-0.19, 0.89, 0.19),
    new THREE.Vector3(0.19, 0.89, -0.19),
    new THREE.Vector3(-0.19, 0.89, -0.19)
  ].forEach((position) => {
    addMesh(
      group,
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      materials.trim,
      position
    );
  });

  group.userData.height = 0.96;
  return applySurfaceTraits(group);
};

const createKnight = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.27, 0.032, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.3, 0.37, 0.16, 24),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.22, 0.26, 0.22, 18),
    materials.core,
    new THREE.Vector3(0, 0.27, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.34, 0.48, 0.2),
    materials.core,
    new THREE.Vector3(0.02, 0.55, -0.03),
    new THREE.Euler(0.14, -0.28, -0.14)
  );
  addMesh(
    group,
    new THREE.ConeGeometry(0.16, 0.42, 5),
    materials.trim,
    new THREE.Vector3(0.05, 0.77, -0.08),
    new THREE.Euler(-0.08, 0.22, 0.42)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.22, 0.12),
    materials.trim,
    new THREE.Vector3(-0.08, 0.84, -0.02),
    new THREE.Euler(0.12, -0.08, 0.22)
  );

  group.userData.height = 0.98;
  return applySurfaceTraits(group);
};

const createBishop = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.26, 0.03, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.29, 0.36, 0.16, 24),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.14, 0.22, 0.64, 22),
    materials.core,
    new THREE.Vector3(0, 0.48, 0)
  );
  addMesh(
    group,
    new THREE.OctahedronGeometry(0.18, 0),
    materials.trim,
    new THREE.Vector3(0, 0.9, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.06, 0.28, 0.04),
    materials.trim,
    new THREE.Vector3(0, 0.84, 0),
    new THREE.Euler(0, 0, 0.46)
  );

  group.userData.height = 1.04;
  return applySurfaceTraits(group);
};

const createQueen = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.285, 0.034, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.31, 0.39, 0.16, 26),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.16, 0.25, 0.72, 24),
    materials.core,
    new THREE.Vector3(0, 0.52, 0)
  );
  addMesh(
    group,
    new THREE.TorusGeometry(0.18, 0.05, 12, 28),
    materials.trim,
    new THREE.Vector3(0, 0.92, 0),
    new THREE.Euler(Math.PI / 2, 0, 0)
  );
  [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].forEach((angle) => {
    addMesh(
      group,
      new THREE.ConeGeometry(0.08, 0.18, 5),
      materials.trim,
      new THREE.Vector3(Math.cos(angle) * 0.16, 1.02, Math.sin(angle) * 0.16)
    );
  });
  addMesh(
    group,
    new THREE.SphereGeometry(0.08, 18, 18),
    materials.trim,
    new THREE.Vector3(0, 1.12, 0)
  );

  group.userData.height = 1.2;
  return applySurfaceTraits(group);
};

const createKing = (materials) => {
  const group = new THREE.Group();

  addBaseRing(group, materials, 0.29, 0.034, 0.13);
  addMesh(
    group,
    new THREE.CylinderGeometry(0.31, 0.4, 0.16, 26),
    materials.core,
    new THREE.Vector3(0, 0.08, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.16, 0.24, 0.82, 24),
    materials.core,
    new THREE.Vector3(0, 0.57, 0)
  );
  addMesh(
    group,
    new THREE.OctahedronGeometry(0.12, 0),
    materials.trim,
    new THREE.Vector3(0, 1.06, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.34, 0.08),
    materials.trim,
    new THREE.Vector3(0, 1.14, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.3, 0.08, 0.08),
    materials.trim,
    new THREE.Vector3(0, 1.22, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.08, 0.08, 0.28),
    materials.trim,
    new THREE.Vector3(0, 1.22, 0)
  );

  group.userData.height = 1.32;
  return applySurfaceTraits(group);
};

const PIECE_FACTORIES = {
  p: createPawn,
  r: createRook,
  n: createKnight,
  b: createBishop,
  q: createQueen,
  k: createKing
};

const createArcanePiece = (piece) => {
  const materials = createMaterials(piece.color);
  const factory = PIECE_FACTORIES[piece.type] || createPawn;
  const group = factory(materials);

  group.userData.pieceType = piece.type;
  group.userData.pieceColor = piece.color;
  group.userData.anchorY = 0.16;

  return group;
};

export { createArcanePiece };
