import * as THREE from "/vendor/three/three.module.js";

const HALL_RADIUS = 16.8;
const HALL_WALL_RADIUS = 16.1;
const HALL_HEIGHT = 10.8;
const HALL_SUPPORT_COUNT = 10;
const BOARD_PLAY_HALF_EXTENT = 4;
const BOARD_MARGIN_BUFFER = 1.1;
const BOARD_CLEAR_HALF_EXTENT = BOARD_PLAY_HALF_EXTENT + BOARD_MARGIN_BUFFER;
const GRAND_HALL_HALF_WIDTH = 12.9;
const GRAND_HALL_HALF_LENGTH = 24.2;
const GRAND_HALL_HEIGHT = 14.6;
const NAVE_HALF_WIDTH = 6.6;
const AISLE_CENTER_X = 9.05;
const SIDE_STRUCTURE_X = 8.18;
const TORCH_X = 7.1;
const PILLAR_ROW_Z = [8.8, 4.2, -1.2, -6.8, -12.8];
const MONUMENT_ROW_SCALES = [1.02, 1.06, 1.1, 1.14, 1.18];
const WALL_RIB_Z = [10.8, 5.6, 0.2, -5.2, -10.6, -16.4];
const BACK_APSE_Z = -18.6;
const COLUMN_LANE_X = 11.78;
const COLUMN_ROW_Z = [-11.2, -4.24, 4.24, 11.2];
const CHARACTER_CLEARANCE_FOOTPRINTS = Object.freeze({
  slot: Object.freeze({ x: 1.72, z: 1.72 }),
  runway: Object.freeze({ x: 1.6, z: 1.24 }),
  backdrop: Object.freeze({ x: 3.2, z: 0.42 })
});

// Sacred gameplay space: keep all character-related geometry outside this buffered square.
const BOARD_CLEAR_ZONE = Object.freeze({
  minX: -BOARD_CLEAR_HALF_EXTENT,
  maxX: BOARD_CLEAR_HALF_EXTENT,
  minZ: -BOARD_CLEAR_HALF_EXTENT,
  maxZ: BOARD_CLEAR_HALF_EXTENT,
  buffer: BOARD_MARGIN_BUFFER
});

const getSideDirection = (side = "white") => (side === "black" ? -1 : 1);

const overlapsBoardClearZone = (position, footprint = CHARACTER_CLEARANCE_FOOTPRINTS.slot) =>
  Math.abs(position.x) < BOARD_CLEAR_HALF_EXTENT + (footprint.x ?? 0) &&
  Math.abs(position.z) < BOARD_CLEAR_HALF_EXTENT + (footprint.z ?? 0);

const enforceCharacterBoardBoundary = (
  position,
  {
    side = "white",
    footprint = CHARACTER_CLEARANCE_FOOTPRINTS.slot
  } = {}
) => {
  const safePosition = position.clone();
  const sideDirection = getSideDirection(side);
  const minSafeDepth = BOARD_CLEAR_HALF_EXTENT + (footprint.z ?? 0);

  safePosition.z = sideDirection > 0 ? Math.max(safePosition.z, minSafeDepth) : Math.min(safePosition.z, -minSafeDepth);

  if (overlapsBoardClearZone(safePosition, footprint)) {
    safePosition.z = sideDirection * (minSafeDepth + 0.02);
  }

  return safePosition;
};

const PLAYER_ZONE_LAYOUT = {
  white: {
    side: "white",
    label: "White Duelist",
    position: enforceCharacterBoardBoundary(new THREE.Vector3(-5.8, 0, 7.48), {
      side: "white",
      footprint: CHARACTER_CLEARANCE_FOOTPRINTS.slot
    }),
    rotationY: Math.PI - 0.4,
    auraColor: 0xf2c891,
    beamColor: 0xf4d4a6,
    sigilColor: 0xffebc8,
    robeColor: 0xe7ddd0,
    innerRobeColor: 0xcfbaa0,
    trimColor: 0xd4ab7d,
    metalColor: 0xc29769,
    crystalColor: 0xffe5be,
    skinColor: 0xf2e2d1,
    mantleColor: 0xf5ecdf,
    headpieceStyle: "halo",
    staffStyle: "solar",
    presenceScale: 0.94,
    keyLightColor: 0xffddb5,
    keyLightIntensity: 0.16,
    rimLightColor: 0xf2c18e,
    rimLightIntensity: 0.08
  },
  black: {
    side: "black",
    label: "Black Duelist",
    position: enforceCharacterBoardBoundary(new THREE.Vector3(5.8, 0, -7.48), {
      side: "black",
      footprint: CHARACTER_CLEARANCE_FOOTPRINTS.slot
    }),
    rotationY: 0.4,
    auraColor: 0x8ca7da,
    beamColor: 0xaec6ef,
    sigilColor: 0xd6e4ff,
    robeColor: 0x24303c,
    innerRobeColor: 0x344357,
    trimColor: 0x7d94ba,
    metalColor: 0x6a7c97,
    crystalColor: 0xc3d5f8,
    skinColor: 0xb7c4d9,
    mantleColor: 0x2f3d4d,
    headpieceStyle: "crescent",
    staffStyle: "lunar",
    presenceScale: 0.98,
    keyLightColor: 0xcddcff,
    keyLightIntensity: 0.24,
    rimLightColor: 0x9eb8de,
    rimLightIntensity: 0.12
  }
};

const COLUMN_POSITIONS = COLUMN_ROW_Z.flatMap((z) => [
  new THREE.Vector3(-COLUMN_LANE_X, 0, z),
  new THREE.Vector3(COLUMN_LANE_X, 0, z)
]);

const createGlowMaterial = (color, opacity, extra = {}) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    ...extra
  });

const addMesh = (
  group,
  geometry,
  material,
  position,
  {
    rotation = null,
    scale = null,
    castShadow = true,
    receiveShadow = true,
    renderOrder = 1
  } = {}
) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);

  if (rotation) {
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  }

  if (scale) {
    mesh.scale.set(scale.x, scale.y, scale.z);
  }

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.renderOrder = renderOrder;
  group.add(mesh);
  return mesh;
};

const applyShadowTraits = (group, renderOrder = 1) => {
  group.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = child.material?.transparent ? false : child.castShadow;
    child.receiveShadow = child.material?.transparent ? false : child.receiveShadow;
    child.renderOrder = Math.max(child.renderOrder || 0, renderOrder);
  });

  return group;
};

const createFigureMaterials = (config) => {
  const auraTint = new THREE.Color(config.auraColor).multiplyScalar(0.12);
  const crystalTint = new THREE.Color(config.crystalColor).multiplyScalar(0.18);

  return {
    robe: new THREE.MeshPhysicalMaterial({
      color: config.robeColor,
      roughness: 0.56,
      metalness: 0.06,
      clearcoat: 0.3,
      clearcoatRoughness: 0.46,
      emissive: auraTint.clone(),
      emissiveIntensity: 0.1
    }),
    innerRobe: new THREE.MeshPhysicalMaterial({
      color: config.innerRobeColor,
      roughness: 0.48,
      metalness: 0.04,
      clearcoat: 0.22,
      clearcoatRoughness: 0.52,
      emissive: auraTint.clone().multiplyScalar(0.8),
      emissiveIntensity: 0.08
    }),
    mantle: new THREE.MeshPhysicalMaterial({
      color: config.mantleColor,
      roughness: 0.44,
      metalness: 0.1,
      clearcoat: 0.36,
      clearcoatRoughness: 0.34,
      emissive: auraTint.clone(),
      emissiveIntensity: 0.12
    }),
    trim: new THREE.MeshPhysicalMaterial({
      color: config.trimColor,
      roughness: 0.22,
      metalness: 0.42,
      clearcoat: 0.62,
      clearcoatRoughness: 0.18,
      emissive: auraTint.clone().multiplyScalar(1.3),
      emissiveIntensity: 0.14
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: config.metalColor,
      roughness: 0.18,
      metalness: 0.76,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      emissive: auraTint.clone().multiplyScalar(1.1),
      emissiveIntensity: 0.12
    }),
    skin: new THREE.MeshPhysicalMaterial({
      color: config.skinColor,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.32,
      emissive: auraTint.clone().multiplyScalar(0.4),
      emissiveIntensity: 0.08
    }),
    crystal: new THREE.MeshPhysicalMaterial({
      color: config.crystalColor,
      roughness: 0.18,
      metalness: 0.08,
      transmission: 0.16,
      thickness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.14,
      emissive: crystalTint,
      emissiveIntensity: 0.24
    })
  };
};

const createArmRig = (materials, side, { holdingStaff = false } = {}) => {
  const direction = side === "left" ? -1 : 1;
  const pivot = new THREE.Group();
  const upperArm = new THREE.Group();
  pivot.add(upperArm);

  addMesh(
    upperArm,
    new THREE.CylinderGeometry(0.06, 0.08, 0.52, 12),
    materials.mantle,
    new THREE.Vector3(0, -0.24, 0.02),
    {
      rotation: new THREE.Euler(0, 0, direction * 0.18)
    }
  );
  const elbow = addMesh(
    upperArm,
    new THREE.SphereGeometry(0.075, 12, 12),
    materials.trim,
    new THREE.Vector3(direction * 0.04, -0.5, 0.04)
  );
  const forearm = addMesh(
    upperArm,
    new THREE.CylinderGeometry(0.05, 0.06, 0.48, 12),
    materials.innerRobe,
    new THREE.Vector3(direction * 0.08, -0.74, 0.08),
    {
      rotation: new THREE.Euler(0.08, 0, direction * 0.14)
    }
  );
  const hand = addMesh(
    upperArm,
    new THREE.SphereGeometry(0.06, 12, 12),
    materials.skin,
    new THREE.Vector3(direction * 0.12, -0.98, 0.12)
  );
  const handGlow = addMesh(
    upperArm,
    new THREE.RingGeometry(0.05, 0.1, 20),
    createGlowMaterial(
      holdingStaff ? materials.crystal.color : materials.trim.color,
      holdingStaff ? 0.12 : 0.09
    ),
    new THREE.Vector3(direction * 0.12, -1.02, 0.18),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 7
    }
  );

  return {
    pivot,
    elbow,
    forearm,
    hand,
    handGlow
  };
};

const createArcaneDuelistFigure = (config) => {
  const materials = createFigureMaterials(config);
  const group = new THREE.Group();
  group.name = `${config.side}-duelist-figure`;

  const motionRoot = new THREE.Group();
  const bodyRoot = new THREE.Group();
  const torsoPivot = new THREE.Group();
  const headPivot = new THREE.Group();
  const shoulderLine = new THREE.Group();

  group.add(motionRoot);
  motionRoot.add(bodyRoot);
  bodyRoot.add(torsoPivot);
  torsoPivot.add(headPivot);
  torsoPivot.add(shoulderLine);

  addMesh(
    bodyRoot,
    new THREE.CylinderGeometry(0.16, 0.7, 2.08, 14),
    materials.robe,
    new THREE.Vector3(0, 1.02, 0)
  );
  addMesh(
    bodyRoot,
    new THREE.CylinderGeometry(0.14, 0.52, 1.74, 14),
    materials.innerRobe,
    new THREE.Vector3(0, 1.06, 0.08)
  );
  const cloakBack = addMesh(
    bodyRoot,
    new THREE.BoxGeometry(0.98, 1.88, 0.08),
    materials.mantle,
    new THREE.Vector3(0, 1.18, -0.2),
    {
      rotation: new THREE.Euler(0.08, 0, 0)
    }
  );
  const cloakFront = addMesh(
    bodyRoot,
    new THREE.BoxGeometry(0.58, 1.24, 0.06),
    materials.mantle,
    new THREE.Vector3(0, 0.94, 0.32),
    {
      rotation: new THREE.Euler(-0.08, 0, 0)
    }
  );
  addMesh(
    bodyRoot,
    new THREE.TorusGeometry(0.34, 0.055, 10, 28),
    materials.trim,
    new THREE.Vector3(0, 1.06, 0.03),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );
  const hemGlow = addMesh(
    bodyRoot,
    new THREE.RingGeometry(0.28, 0.52, 28),
    createGlowMaterial(config.auraColor, 0.12),
    new THREE.Vector3(0, 0.06, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 6
    }
  );

  torsoPivot.position.set(0, 1.38, 0.02);
  addMesh(
    torsoPivot,
    new THREE.CylinderGeometry(0.24, 0.34, 0.84, 16),
    materials.innerRobe,
    new THREE.Vector3(0, 0.08, 0.02)
  );
  addMesh(
    torsoPivot,
    new THREE.CylinderGeometry(0.42, 0.28, 0.36, 14),
    materials.mantle,
    new THREE.Vector3(0, 0.36, 0.02)
  );
  addMesh(
    torsoPivot,
    new THREE.TorusGeometry(0.28, 0.04, 10, 24),
    materials.trim,
    new THREE.Vector3(0, 0.42, 0.06),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );

  const chestSigil = addMesh(
    torsoPivot,
    new THREE.RingGeometry(0.08, 0.18, 24),
    createGlowMaterial(config.sigilColor, 0.22),
    new THREE.Vector3(0, 0.08, 0.29),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 7
    }
  );
  const backHalo = addMesh(
    torsoPivot,
    new THREE.RingGeometry(0.34, 0.48, 32),
    createGlowMaterial(config.beamColor, 0.14),
    new THREE.Vector3(0, 0.26, -0.34),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 6
    }
  );
  backHalo.rotation.x = -0.22;

  const orbitSigil = new THREE.Group();
  orbitSigil.position.set(0, 0.18, -0.08);
  torsoPivot.add(orbitSigil);
  addMesh(
    orbitSigil,
    new THREE.RingGeometry(0.44, 0.48, 32),
    createGlowMaterial(config.auraColor, 0.12),
    new THREE.Vector3(0, 0, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 6
    }
  );

  shoulderLine.position.set(0, 0.32, 0.02);
  addMesh(
    shoulderLine,
    new THREE.BoxGeometry(0.92, 0.16, 0.28),
    materials.trim,
    new THREE.Vector3(0, 0, 0)
  );
  addMesh(
    shoulderLine,
    new THREE.BoxGeometry(0.26, 0.22, 0.34),
    materials.mantle,
    new THREE.Vector3(-0.36, -0.02, 0.02),
    {
      rotation: new THREE.Euler(0, 0, 0.18)
    }
  );
  addMesh(
    shoulderLine,
    new THREE.BoxGeometry(0.26, 0.22, 0.34),
    materials.mantle,
    new THREE.Vector3(0.36, -0.02, 0.02),
    {
      rotation: new THREE.Euler(0, 0, -0.18)
    }
  );

  headPivot.position.set(0, 0.78, 0.02);
  addMesh(
    headPivot,
    new THREE.SphereGeometry(0.17, 18, 18),
    materials.skin,
    new THREE.Vector3(0, 0.06, 0.02)
  );
  addMesh(
    headPivot,
    new THREE.ConeGeometry(0.28, 0.58, 12),
    materials.mantle,
    new THREE.Vector3(0, 0.2, 0.01)
  );
  addMesh(
    headPivot,
    new THREE.TorusGeometry(0.2, 0.03, 10, 20),
    materials.trim,
    new THREE.Vector3(0, -0.04, 0.06),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );

  const crownGlow = new THREE.Group();
  crownGlow.position.set(0, 0.34, -0.04);
  headPivot.add(crownGlow);

  if (config.headpieceStyle === "halo") {
    addMesh(
      crownGlow,
      new THREE.TorusGeometry(0.24, 0.026, 10, 28),
      createGlowMaterial(config.beamColor, 0.28),
      new THREE.Vector3(0, 0, 0),
      {
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        castShadow: false,
        receiveShadow: false,
        renderOrder: 7
      }
    );
    addMesh(
      crownGlow,
      new THREE.OctahedronGeometry(0.075, 0),
      materials.crystal,
      new THREE.Vector3(0, 0.18, 0)
    );
  } else {
    addMesh(
      crownGlow,
      new THREE.RingGeometry(0.18, 0.28, 28, 1, Math.PI * 0.1, Math.PI * 0.8),
      createGlowMaterial(config.beamColor, 0.24, {
        side: THREE.DoubleSide
      }),
      new THREE.Vector3(-0.08, 0.02, 0),
      {
        rotation: new THREE.Euler(0, 0.2, 0.72),
        castShadow: false,
        receiveShadow: false,
        renderOrder: 7
      }
    );
    addMesh(
      crownGlow,
      new THREE.RingGeometry(0.18, 0.28, 28, 1, Math.PI * 1.1, Math.PI * 0.8),
      createGlowMaterial(config.beamColor, 0.2, {
        side: THREE.DoubleSide
      }),
      new THREE.Vector3(0.08, -0.02, 0.02),
      {
        rotation: new THREE.Euler(0, -0.26, -0.68),
        castShadow: false,
        receiveShadow: false,
        renderOrder: 7
      }
    );
  }

  const leftArm = createArmRig(materials, "left");
  const rightArm = createArmRig(materials, "right", {
    holdingStaff: true
  });
  leftArm.pivot.position.set(-0.38, 0.22, 0.02);
  rightArm.pivot.position.set(0.38, 0.22, 0.02);
  shoulderLine.add(leftArm.pivot);
  shoulderLine.add(rightArm.pivot);

  const staffPivot = new THREE.Group();
  staffPivot.position.set(0.06, -0.98, 0.16);
  rightArm.pivot.add(staffPivot);
  addMesh(
    staffPivot,
    new THREE.CylinderGeometry(0.035, 0.05, 1.92, 12),
    materials.metal,
    new THREE.Vector3(0.02, -0.76, 0.02),
    {
      rotation: new THREE.Euler(0.08, 0, -0.04)
    }
  );
  addMesh(
    staffPivot,
    new THREE.TorusGeometry(0.14, 0.018, 10, 24),
    materials.trim,
    new THREE.Vector3(0, 0.12, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );

  const staffCrystalGroup = new THREE.Group();
  staffCrystalGroup.position.set(0, 0.34, 0.02);
  staffPivot.add(staffCrystalGroup);

  const staffCrystal = addMesh(
    staffCrystalGroup,
    new THREE.OctahedronGeometry(0.13, 0),
    materials.crystal,
    new THREE.Vector3(0, 0, 0)
  );
  const staffCrystalGlow = addMesh(
    staffCrystalGroup,
    new THREE.RingGeometry(0.08, 0.18, 20),
    createGlowMaterial(config.crystalColor, 0.18),
    new THREE.Vector3(0, 0, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 7
    }
  );

  if (config.staffStyle === "solar") {
    addMesh(
      staffCrystalGroup,
      new THREE.TorusGeometry(0.18, 0.022, 10, 28),
      createGlowMaterial(config.beamColor, 0.18),
      new THREE.Vector3(0, 0.02, 0),
      {
        rotation: new THREE.Euler(Math.PI / 2, 0, 0),
        castShadow: false,
        receiveShadow: false,
        renderOrder: 7
      }
    );
  } else {
    addMesh(
      staffCrystalGroup,
      new THREE.ConeGeometry(0.08, 0.22, 5),
      materials.trim,
      new THREE.Vector3(0.16, 0.04, 0),
      {
        rotation: new THREE.Euler(0, 0, -0.6)
      }
    );
    addMesh(
      staffCrystalGroup,
      new THREE.ConeGeometry(0.08, 0.22, 5),
      materials.trim,
      new THREE.Vector3(-0.16, 0.02, 0),
      {
        rotation: new THREE.Euler(0, 0, 0.6)
      }
    );
  }

  group.userData.height = 3.24;
  group.userData.replaceable = true;

  return {
    group: applyShadowTraits(group, 3),
    motionRoot,
    bodyRoot,
    torsoPivot,
    headPivot,
    leftArmPivot: leftArm.pivot,
    rightArmPivot: rightArm.pivot,
    staffPivot,
    cloakFront,
    cloakBack,
    hemGlow,
    chestSigil,
    backHalo,
    orbitSigil,
    crownGlow,
    staffCrystal,
    staffCrystalGlow,
    leftHandGlow: leftArm.handGlow,
    rightHandGlow: rightArm.handGlow
  };
};

const createColumnPylon = (glowColor, metalMaterial, stoneMaterial) => {
  const group = new THREE.Group();

  addMesh(
    group,
    new THREE.CylinderGeometry(1.02, 1.24, 0.36, 16),
    stoneMaterial,
    new THREE.Vector3(0, -0.68, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.78, 0.94, 0.24, 16),
    metalMaterial,
    new THREE.Vector3(0, -0.36, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.92, 7.08, 0.92),
    stoneMaterial,
    new THREE.Vector3(0, 3.06, 0)
  );

  [
    new THREE.Vector3(-0.38, 3.06, 0),
    new THREE.Vector3(0.38, 3.06, 0),
    new THREE.Vector3(0, 3.06, -0.38),
    new THREE.Vector3(0, 3.06, 0.38)
  ].forEach((position) => {
    addMesh(
      group,
      new THREE.BoxGeometry(0.1, 6.94, 0.1),
      metalMaterial,
      position
    );
  });

  addMesh(
    group,
    new THREE.BoxGeometry(1.34, 0.26, 1.34),
    metalMaterial,
    new THREE.Vector3(0, 6.64, 0)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.92, 0.78, 0.34, 16),
    stoneMaterial,
    new THREE.Vector3(0, 6.94, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.18, 0.22, 1.18),
    metalMaterial,
    new THREE.Vector3(0, 7.22, 0)
  );

  const crystal = addMesh(
    group,
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshPhysicalMaterial({
      color: glowColor,
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0.12,
      thickness: 0.24,
      emissive: new THREE.Color(glowColor).multiplyScalar(0.1),
      emissiveIntensity: 0.14
    }),
    new THREE.Vector3(0, 7.54, 0)
  );
  const crystalHalo = addMesh(
    group,
    new THREE.RingGeometry(0.12, 0.24, 24),
    createGlowMaterial(glowColor, 0.12),
    new THREE.Vector3(0, 7.52, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  return {
    group: applyShadowTraits(group, 2),
    crystal,
    crystalHalo,
    baseY: 7.54
  };
};

const createCharacterSlot = (config, sharedMaterials) => {
  const slotGroup = new THREE.Group();
  slotGroup.name = `${config.side}-character-zone`;
  const slotPosition = enforceCharacterBoardBoundary(config.position, {
    side: config.side,
    footprint: CHARACTER_CLEARANCE_FOOTPRINTS.slot
  });
  slotGroup.position.copy(slotPosition);

  addMesh(
    slotGroup,
    new THREE.CylinderGeometry(1.48, 1.66, 0.54, 12),
    sharedMaterials.slotStone,
    new THREE.Vector3(0, -0.2, 0)
  );
  addMesh(
    slotGroup,
    new THREE.CylinderGeometry(1.18, 1.34, 0.16, 16),
    sharedMaterials.slotMetal,
    new THREE.Vector3(0, 0.16, 0)
  );
  addMesh(
    slotGroup,
    new THREE.TorusGeometry(1.02, 0.07, 12, 42),
    sharedMaterials.slotMetal,
    new THREE.Vector3(0, 0.22, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0)
    }
  );

  const haloDisc = addMesh(
    slotGroup,
    new THREE.CircleGeometry(1.16, 36),
    createGlowMaterial(config.auraColor, 0.1),
    new THREE.Vector3(0, 0.23, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );
  const sigilRing = addMesh(
    slotGroup,
    new THREE.RingGeometry(0.7, 1.02, 42),
    createGlowMaterial(config.sigilColor, 0.24),
    new THREE.Vector3(0, 0.25, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 5
    }
  );
  const beam = addMesh(
    slotGroup,
    new THREE.CylinderGeometry(0.36, 0.8, 4.8, 20, 1, true),
    createGlowMaterial(config.beamColor, 0.12, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 2.46, 0),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  [
    new THREE.Vector3(-0.94, 0.7, 0.1),
    new THREE.Vector3(0.94, 0.7, 0.1)
  ].forEach((position) => {
    addMesh(
      slotGroup,
      new THREE.BoxGeometry(0.22, 1.92, 0.26),
      sharedMaterials.slotStone,
      position,
      {
        rotation: new THREE.Euler(0, 0, position.x < 0 ? 0.07 : -0.07)
      }
    );
    addMesh(
      slotGroup,
      new THREE.OctahedronGeometry(0.14, 0),
      sharedMaterials.slotMetal,
      new THREE.Vector3(position.x, 1.78, position.z)
    );
  });

  const characterAnchor = new THREE.Group();
  characterAnchor.name = `${config.side}-character-anchor`;
  characterAnchor.position.y = 0.24;
  characterAnchor.rotation.y = config.rotationY;
  slotGroup.add(characterAnchor);

  const modelMount = new THREE.Group();
  modelMount.name = `${config.side}-character-model`;
  characterAnchor.add(modelMount);
  // Future-ready hook: rigged duelists can be reintroduced by mounting them here.
  modelMount.userData.avatarEnabled = false;

  const focusPoint = new THREE.Object3D();
  focusPoint.position.set(0, 2.24, 0.18);
  characterAnchor.add(focusPoint);

  slotGroup.userData.side = config.side;
  slotGroup.userData.label = config.label;
  slotGroup.userData.boardClearZone = BOARD_CLEAR_ZONE;

  return {
    group: applyShadowTraits(slotGroup, 2),
    characterAnchor,
    modelMount,
    focusPoint,
    haloDisc,
    sigilRing,
    beam,
    baseAnchorY: 0.24,
    baseRotationY: config.rotationY,
    phase: config.side === "white" ? 0 : Math.PI * 0.82
  };
};

const createHallSupport = (angle, sharedMaterials, glowColor) => {
  const group = new THREE.Group();
  const radius = HALL_WALL_RADIUS - 0.68;

  group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  group.rotation.y = angle;

  addMesh(
    group,
    new THREE.BoxGeometry(1.1, 0.46, 1.02),
    sharedMaterials.supportMetal,
    new THREE.Vector3(0, -0.56, -0.08),
    {
      castShadow: false,
      receiveShadow: true
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.72, 6.46, 0.86),
    sharedMaterials.supportStone,
    new THREE.Vector3(0, 2.74, -0.16),
    {
      castShadow: false,
      receiveShadow: true
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.02, 0.34, 0.94),
    sharedMaterials.supportMetal,
    new THREE.Vector3(0, 5.98, -0.12),
    {
      castShadow: false,
      receiveShadow: true
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.36, 3.02, 0.08),
    sharedMaterials.wallInset,
    new THREE.Vector3(0, 3.08, -0.46),
    {
      castShadow: false,
      receiveShadow: true
    }
  );
  addMesh(
    group,
    new THREE.PlaneGeometry(0.2, 2.52),
    createGlowMaterial(glowColor, 0.08, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 3.16, -0.42),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );

  return applyShadowTraits(group, 1);
};

const createHallEnclosure = (sharedMaterials) => {
  const group = new THREE.Group();

  addMesh(
    group,
    new THREE.CircleGeometry(HALL_RADIUS, 96),
    sharedMaterials.hallFloor,
    new THREE.Vector3(0, -1.08, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      renderOrder: 0
    }
  );
  addMesh(
    group,
    new THREE.RingGeometry(8.74, 13.96, 96),
    sharedMaterials.arenaStone,
    new THREE.Vector3(0, -1.02, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.RingGeometry(12.56, 14.16, 96),
    sharedMaterials.arenaMetal,
    new THREE.Vector3(0, -0.94, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.RingGeometry(14.58, 15.88, 96),
    sharedMaterials.walkwayMetal,
    new THREE.Vector3(0, -0.96, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(HALL_WALL_RADIUS, HALL_WALL_RADIUS, HALL_HEIGHT, 72, 1, true),
    sharedMaterials.hallWall,
    new THREE.Vector3(0, HALL_HEIGHT / 2 - 1.08, 0),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 0
    }
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(HALL_WALL_RADIUS - 0.58, HALL_WALL_RADIUS - 0.78, 1.96, 72, 1, true),
    sharedMaterials.wallPlinth,
    new THREE.Vector3(0, -0.04, 0),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(HALL_WALL_RADIUS - 0.34, HALL_WALL_RADIUS - 0.34, HALL_HEIGHT - 0.36, 72, 1, true),
    createGlowMaterial(0x27344c, 0.038, {
      side: THREE.BackSide
    }),
    new THREE.Vector3(0, HALL_HEIGHT / 2 - 1.04, 0),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(HALL_WALL_RADIUS - 0.92, HALL_WALL_RADIUS - 0.92, 5.46, 72, 1, true),
    sharedMaterials.wallBand,
    new THREE.Vector3(0, 2.7, 0),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.TorusGeometry(HALL_WALL_RADIUS - 0.08, 0.18, 12, 96),
    sharedMaterials.arenaMetal,
    new THREE.Vector3(0, HALL_HEIGHT - 1.24, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.TorusGeometry(HALL_WALL_RADIUS - 0.96, 0.12, 10, 96),
    sharedMaterials.walkwayMetal,
    new THREE.Vector3(0, 5.42, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.RingGeometry(11.4, 13.28, 96),
    createGlowMaterial(0x607698, 0.026, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, HALL_HEIGHT - 1.42, 0),
    {
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );

  Array.from({ length: HALL_SUPPORT_COUNT }, (_, index) => (index / HALL_SUPPORT_COUNT) * Math.PI * 2 + Math.PI / HALL_SUPPORT_COUNT)
    .forEach((angle, index) => {
      const glowColor = index % 2 === 0 ? 0x607698 : 0xc39867;
      group.add(createHallSupport(angle, sharedMaterials, glowColor));
    });

  return applyShadowTraits(group, 1);
};

const createSideAislePlatform = (x, sharedMaterials) => {
  const group = new THREE.Group();
  group.position.set(x, 0, 0);

  addMesh(
    group,
    new THREE.BoxGeometry(3.22, 0.24, 25.4),
    sharedMaterials.walkwayStone,
    new THREE.Vector3(0, -0.98, 0),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.54, 0.08, 24.46),
    sharedMaterials.walkwayMetal,
    new THREE.Vector3(0, -0.8, 0),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );

  [-1.1, 1.1].forEach((offset) => {
    addMesh(
      group,
      new THREE.BoxGeometry(0.22, 0.36, 24.9),
      sharedMaterials.supportStone,
      new THREE.Vector3(offset, -0.72, 0),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 2
      }
    );
  });

  [-12.22, 12.22].forEach((z) => {
    addMesh(
      group,
      new THREE.BoxGeometry(2.92, 0.28, 0.94),
      sharedMaterials.supportMetal,
      new THREE.Vector3(0, -0.68, z),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 2
      }
    );
  });

  return applyShadowTraits(group, 1);
};

const createGrandHallShell = (sharedMaterials) => {
  const group = new THREE.Group();

  addMesh(
    group,
    new THREE.BoxGeometry(GRAND_HALL_HALF_WIDTH * 2, 0.44, GRAND_HALL_HALF_LENGTH * 2),
    sharedMaterials.hallFloor,
    new THREE.Vector3(0, -1.24, -1.2),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 0
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(NAVE_HALF_WIDTH * 2, 0.16, GRAND_HALL_HALF_LENGTH * 2 - 6.4),
    sharedMaterials.naveStone,
    new THREE.Vector3(0, -0.98, -1.8),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );

  [-1, 1].forEach((side) => {
    addMesh(
      group,
      new THREE.BoxGeometry(4.2, 0.3, GRAND_HALL_HALF_LENGTH * 2 - 5.4),
      sharedMaterials.walkwayStone,
      new THREE.Vector3(side * AISLE_CENTER_X, -1.08, -1.1),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 1
      }
    );
    addMesh(
      group,
      new THREE.BoxGeometry(2.4, 0.16, GRAND_HALL_HALF_LENGTH * 2 - 7.2),
      sharedMaterials.walkwayMetal,
      new THREE.Vector3(side * AISLE_CENTER_X, -0.88, -1.4),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 2
      }
    );
    addMesh(
      group,
      new THREE.BoxGeometry(1.12, GRAND_HALL_HEIGHT, GRAND_HALL_HALF_LENGTH * 2 - 2.6),
      sharedMaterials.hallWall,
      new THREE.Vector3(side * (GRAND_HALL_HALF_WIDTH - 0.56), GRAND_HALL_HEIGHT / 2 - 1.08, -1.2),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 0
      }
    );
    addMesh(
      group,
      new THREE.BoxGeometry(0.42, 2.12, GRAND_HALL_HALF_LENGTH * 2 - 2.2),
      sharedMaterials.wallPlinth,
      new THREE.Vector3(side * (GRAND_HALL_HALF_WIDTH - 1.18), -0.02, -1.18),
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 1
      }
    );

    WALL_RIB_Z.forEach((z) => {
      addMesh(
        group,
        new THREE.BoxGeometry(0.62, 9.8, 1.08),
        sharedMaterials.supportStone,
        new THREE.Vector3(side * (GRAND_HALL_HALF_WIDTH - 1.42), 4.08, z),
        {
          castShadow: false,
          receiveShadow: true,
          renderOrder: 1
        }
      );
      addMesh(
        group,
        new THREE.BoxGeometry(0.18, 4.8, 0.22),
        sharedMaterials.wallInset,
        new THREE.Vector3(side * (GRAND_HALL_HALF_WIDTH - 1.08), 3.62, z),
        {
          castShadow: false,
          receiveShadow: true,
          renderOrder: 2
        }
      );
    });
  });

  addMesh(
    group,
    new THREE.BoxGeometry(GRAND_HALL_HALF_WIDTH * 2 - 1.8, GRAND_HALL_HEIGHT, 1.28),
    sharedMaterials.hallWall,
    new THREE.Vector3(0, GRAND_HALL_HEIGHT / 2 - 1.08, BACK_APSE_Z),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 0
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(16.8, 0.82, 6.6),
    sharedMaterials.naveStone,
    new THREE.Vector3(0, -0.82, BACK_APSE_Z + 2.48),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(13.4, 0.42, 5.08),
    sharedMaterials.supportStone,
    new THREE.Vector3(0, -0.22, BACK_APSE_Z + 1.78),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 1
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(10.8, 0.24, 3.64),
    sharedMaterials.walkwayMetal,
    new THREE.Vector3(0, 0.12, BACK_APSE_Z + 1.26),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );

  [
    new THREE.Vector3(-6.7, 5.02, BACK_APSE_Z + 0.82),
    new THREE.Vector3(6.7, 5.02, BACK_APSE_Z + 0.82)
  ].forEach((position) => {
    addMesh(
      group,
      new THREE.BoxGeometry(2.18, 11.2, 2.24),
      sharedMaterials.supportStone,
      position,
      {
        castShadow: false,
        receiveShadow: true,
        renderOrder: 1
      }
    );
  });
  addMesh(
    group,
    new THREE.BoxGeometry(15.2, 1.08, 1.82),
    sharedMaterials.supportMetal,
    new THREE.Vector3(0, 9.86, BACK_APSE_Z + 0.68),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(11.4, 8.92, 0.32),
    sharedMaterials.wallInset,
    new THREE.Vector3(0, 4.8, BACK_APSE_Z + 0.98),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(4.2, 1.46, 2.78),
    sharedMaterials.guardianStone,
    new THREE.Vector3(0, 1.24, BACK_APSE_Z + 1.18),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(3.2, 4.94, 1.26),
    sharedMaterials.guardianStone,
    new THREE.Vector3(0, 4.08, BACK_APSE_Z + 0.88),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(5.44, 0.42, 1.84),
    sharedMaterials.supportMetal,
    new THREE.Vector3(0, 6.46, BACK_APSE_Z + 0.96),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 3
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.56, 1.82, 0.92),
    sharedMaterials.guardianStone,
    new THREE.Vector3(0, 7.52, BACK_APSE_Z + 0.84),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 3
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.94, 8.8, 1.18),
    sharedMaterials.supportStone,
    new THREE.Vector3(-3.96, 4.94, BACK_APSE_Z + 1.08),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.94, 8.8, 1.18),
    sharedMaterials.supportStone,
    new THREE.Vector3(3.96, 4.94, BACK_APSE_Z + 1.08),
    {
      castShadow: false,
      receiveShadow: true,
      renderOrder: 2
    }
  );
  addMesh(
    group,
    new THREE.PlaneGeometry(12.2, 9.4),
    createGlowMaterial(0x314160, 0.045, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 4.92, BACK_APSE_Z + 1.14),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );
  addMesh(
    group,
    new THREE.RingGeometry(1.28, 2.02, 44),
    createGlowMaterial(0x6c84ae, 0.1, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 5.96, BACK_APSE_Z + 1.32),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );
  addMesh(
    group,
    new THREE.CircleGeometry(0.86, 36),
    createGlowMaterial(0xb3874e, 0.08, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 5.96, BACK_APSE_Z + 1.36),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  return applyShadowTraits(group, 1);
};

const createGrandHallPillar = (side, sharedMaterials, accentColor, variantIndex = 0) => {
  const group = new THREE.Group();
  const inward = side === "left" ? 1 : -1;
  const stoneVariation = (variantIndex - 2) * 0.018;
  const guardianStone = sharedMaterials.guardianStone.clone();
  guardianStone.color.offsetHSL(0, 0, stoneVariation);
  guardianStone.roughness = Math.min(0.92, guardianStone.roughness + variantIndex * 0.014);

  const supportStone = sharedMaterials.supportStone.clone();
  supportStone.color.offsetHSL(0, 0, stoneVariation * 0.7);

  const supportMetal = sharedMaterials.supportMetal.clone();
  supportMetal.color.offsetHSL(0, 0, variantIndex * 0.01);

  const wallInset = sharedMaterials.wallInset.clone();
  wallInset.color.offsetHSL(0, 0, stoneVariation * 0.5);

  addMesh(
    group,
    new THREE.BoxGeometry(3.34, 0.92, 3.62),
    supportStone,
    new THREE.Vector3(0, -0.56, 0.08)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.82, 0.34, 3.04),
    supportMetal,
    new THREE.Vector3(0, 0.08, 0.08)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.44, 0.62, 2.56),
    supportStone,
    new THREE.Vector3(0, 0.54, 0.12)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.28, 1.06, 2.1),
    guardianStone,
    new THREE.Vector3(0, 1.44, 0.18)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.96, 7.92, 1.02),
    supportStone,
    new THREE.Vector3(0, 5.16, -0.42)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.34, 3.08, 1.28),
    guardianStone,
    new THREE.Vector3(-0.62, 2.7, 0.34)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.34, 3.08, 1.28),
    guardianStone,
    new THREE.Vector3(0.62, 2.7, 0.34)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.48, 3.44, 1.44),
    guardianStone,
    new THREE.Vector3(0, 4.4, 0.02)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.72, 0.38, 1.82),
    supportMetal,
    new THREE.Vector3(0, 5.76, -0.04)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.78, 3.7, 1.38),
    guardianStone,
    new THREE.Vector3(inward * 1.12, 3.56, 0.12)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.92, 4.42, 1.42),
    guardianStone,
    new THREE.Vector3(-inward * 1.26, 4.18, -0.1)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.34, 4.84, 0.44),
    supportStone,
    new THREE.Vector3(0, 4.76, -0.92)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.28, 4.16, 0.22),
    wallInset,
    new THREE.Vector3(0, 4.82, -0.66)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.58, 2.84, 1.26),
    guardianStone,
    new THREE.Vector3(inward * 1.48, 5.16, -0.28),
    {
      rotation: new THREE.Euler(0, 0, inward * -0.14)
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.44, 3.24, 1.24),
    guardianStone,
    new THREE.Vector3(-inward * 1.52, 5.0, -0.4),
    {
      rotation: new THREE.Euler(0, 0, inward * 0.18)
    }
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.72, 0.88, 1.42, 8),
    guardianStone,
    new THREE.Vector3(0, 6.84, -0.02)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.54, 0.46, 1.38),
    supportMetal,
    new THREE.Vector3(0, 7.54, -0.02)
  );
  addMesh(
    group,
    new THREE.ConeGeometry(0.22, 0.88, 10),
    supportMetal,
    new THREE.Vector3(-0.42, 8.14, 0.22),
    {
      rotation: new THREE.Euler(0.08, 0, 0.16)
    }
  );
  addMesh(
    group,
    new THREE.ConeGeometry(0.22, 0.88, 10),
    supportMetal,
    new THREE.Vector3(0.42, 8.14, 0.22),
    {
      rotation: new THREE.Euler(0.08, 0, -0.16)
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.8, 0.26, 2.54),
    sharedMaterials.walkwayMetal,
    new THREE.Vector3(0, 8.02, -0.04)
  );

  const eyeGlow = addMesh(
    group,
    new THREE.PlaneGeometry(0.66, 0.2),
    createGlowMaterial(accentColor, 0.12, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 6.96, 0.72),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );
  const chestSigil = addMesh(
    group,
    new THREE.RingGeometry(0.16, 0.34, 24),
    createGlowMaterial(accentColor, 0.1, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 4.42, 0.78),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  const crownGlow = addMesh(
    group,
    new THREE.PlaneGeometry(1.44, 1.44),
    createGlowMaterial(accentColor, 0.09, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 8.3, inward * 0.46),
    {
      rotation: new THREE.Euler(0, inward > 0 ? -0.28 : 0.28, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  return {
    group: applyShadowTraits(group, 2),
    crownGlow,
    eyeGlow,
    chestSigil
  };
};

const createTorchSconce = (side, sharedMaterials, { castShadow = false, phase = 0 } = {}) => {
  const group = new THREE.Group();
  const inward = side === "left" ? 1 : -1;

  addMesh(
    group,
    new THREE.BoxGeometry(0.36, 1.46, 0.2),
    sharedMaterials.supportMetal,
    new THREE.Vector3(-inward * 0.14, 3.58, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.04, 0.22, 0.28),
    sharedMaterials.supportMetal,
    new THREE.Vector3(inward * 0.24, 3.44, 0.08)
  );
  addMesh(
    group,
    new THREE.CylinderGeometry(0.44, 0.34, 0.32, 14),
    sharedMaterials.brazierMetal,
    new THREE.Vector3(inward * 0.56, 3.48, 0.12)
  );

  const flameCore = addMesh(
    group,
    new THREE.SphereGeometry(0.22, 14, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffd7a1,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    new THREE.Vector3(inward * 0.56, 3.82, 0.16),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 5
    }
  );
  const flameGlow = addMesh(
    group,
    new THREE.PlaneGeometry(1.14, 1.62),
    createGlowMaterial(0xff8d42, 0.32, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(inward * 0.58, 3.92, 0.18),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 5
    }
  );
  const flameCross = addMesh(
    group,
    new THREE.PlaneGeometry(0.92, 1.34),
    createGlowMaterial(0xffc06b, 0.26, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(inward * 0.58, 3.88, 0.22),
    {
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 5
    }
  );
  const emberHalo = addMesh(
    group,
    new THREE.CircleGeometry(0.56, 24),
    createGlowMaterial(0xffa04b, 0.2, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(inward * 0.58, 3.6, 0.14),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );
  const wallGlow = addMesh(
    group,
    new THREE.PlaneGeometry(1.58, 2.82),
    createGlowMaterial(0xff8f46, 0.18, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(-inward * 0.7, 3.7, -0.06),
    {
      rotation: new THREE.Euler(0, inward * Math.PI / 2, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );
  const heatColumn = addMesh(
    group,
    new THREE.PlaneGeometry(1.06, 2.34),
    createGlowMaterial(0xffb064, 0.12, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(inward * 0.58, 4.34, 0.14),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 5
    }
  );

  const pointLight = new THREE.PointLight(0xff8b3d, castShadow ? 0.7 : 0.46, castShadow ? 10.6 : 8.2, 2);
  pointLight.position.set(inward * 0.56, 3.82, 0.24);
  pointLight.userData.baseIntensity = pointLight.intensity;
  group.add(pointLight);

  let shadowLight = null;
  let shadowTarget = null;

  if (castShadow) {
    shadowTarget = new THREE.Object3D();
    shadowTarget.position.set(inward * 2.4, 1.4, -0.5);
    group.add(shadowTarget);

    shadowLight = new THREE.SpotLight(0xffa75f, 0.72, 16, 0.82, 0.9, 1.5);
    shadowLight.position.set(inward * 0.46, 3.98, 0.48);
    shadowLight.target = shadowTarget;
    shadowLight.castShadow = true;
    shadowLight.shadow.mapSize.set(512, 512);
    shadowLight.shadow.camera.near = 0.5;
    shadowLight.shadow.camera.far = 14;
    shadowLight.shadow.bias = -0.00025;
    shadowLight.shadow.normalBias = 0.018;
    shadowLight.shadow.radius = 2;
    shadowLight.userData.baseIntensity = shadowLight.intensity;
    group.add(shadowLight);
  }

  return {
    group: applyShadowTraits(group, 3),
    flameCore,
    flameGlow,
    flameCross,
    emberHalo,
    wallGlow,
    heatColumn,
    light: pointLight,
    shadowLight,
    phase
  };
};

const createInvisiblePlayerSlot = (config) => {
  const slotGroup = new THREE.Group();
  slotGroup.name = `${config.side}-character-zone`;
  slotGroup.position.copy(config.position);
  slotGroup.visible = false;

  const characterAnchor = new THREE.Group();
  characterAnchor.name = `${config.side}-character-anchor`;
  characterAnchor.position.y = 0.24;
  characterAnchor.rotation.y = config.rotationY;
  slotGroup.add(characterAnchor);

  const modelMount = new THREE.Group();
  modelMount.name = `${config.side}-character-model`;
  modelMount.userData.avatarEnabled = false;
  characterAnchor.add(modelMount);

  const focusPoint = new THREE.Object3D();
  focusPoint.position.set(0, 2.24, 0.18);
  characterAnchor.add(focusPoint);

  slotGroup.userData.side = config.side;
  slotGroup.userData.label = config.label;
  slotGroup.userData.boardClearZone = BOARD_CLEAR_ZONE;

  return {
    group: slotGroup,
    characterAnchor,
    modelMount,
    focusPoint,
    baseAnchorY: 0.24,
    baseRotationY: config.rotationY,
    phase: config.side === "white" ? 0 : Math.PI * 0.82
  };
};

const createCharacterBackdrop = (config, sharedMaterials) => {
  const group = new THREE.Group();
  const sideDirection = config.side === "white" ? 1 : -1;
  const backdropPosition = enforceCharacterBoardBoundary(
    new THREE.Vector3(config.position.x * 1.82, 0, config.position.z + sideDirection * 3.08),
    {
      side: config.side,
      footprint: CHARACTER_CLEARANCE_FOOTPRINTS.backdrop
    }
  );
  group.position.copy(backdropPosition);
  group.rotation.y = sideDirection > 0 ? Math.PI : 0;

  addMesh(
    group,
    new THREE.CylinderGeometry(2.8, 3.12, 0.8, 24),
    sharedMaterials.slotStone,
    new THREE.Vector3(0, -0.62, 0.12)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(6.34, 7.54, 0.38),
    sharedMaterials.backdropWall,
    new THREE.Vector3(0, 3.02, 0),
    {
      castShadow: false,
      receiveShadow: true
    }
  );
  addMesh(
    group,
    new THREE.BoxGeometry(5.24, 5.92, 0.2),
    sharedMaterials.backdropInset,
    new THREE.Vector3(0, 2.96, 0.16),
    {
      castShadow: false,
      receiveShadow: true
    }
  );

  [-2.74, 2.74].forEach((x) => {
    addMesh(
      group,
      new THREE.BoxGeometry(0.56, 6.16, 0.74),
      sharedMaterials.arenaStone,
      new THREE.Vector3(x, 2.92, 0.16)
    );
    addMesh(
      group,
      new THREE.OctahedronGeometry(0.18, 0),
      sharedMaterials.slotMetal,
      new THREE.Vector3(x, 6.16, 0.22)
    );
  });

  addMesh(
    group,
    new THREE.BoxGeometry(5.92, 0.46, 0.84),
    sharedMaterials.slotMetal,
    new THREE.Vector3(0, 6.18, 0.18)
  );
  addMesh(
    group,
    new THREE.RingGeometry(1.06, 1.54, 42),
    createGlowMaterial(config.sigilColor, 0.12),
    new THREE.Vector3(0, 4.38, 0.24),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );
  addMesh(
    group,
    new THREE.CircleGeometry(0.74, 36),
    createGlowMaterial(config.beamColor, 0.065),
    new THREE.Vector3(0, 4.38, 0.22),
    {
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );

  return applyShadowTraits(group, 1);
};

const createRunwayPlate = (position, sharedMaterials, glowColor) => {
  const group = new THREE.Group();
  group.position.copy(position);

  addMesh(
    group,
    new THREE.BoxGeometry(3.2, 0.18, 2.42),
    sharedMaterials.slotStone,
    new THREE.Vector3(0, -0.4, 0)
  );
  addMesh(
    group,
    new THREE.BoxGeometry(2.8, 0.08, 2.02),
    sharedMaterials.slotMetal,
    new THREE.Vector3(0, -0.25, 0)
  );
  addMesh(
    group,
    new THREE.RingGeometry(0.44, 0.82, 28),
    createGlowMaterial(glowColor, 0.12),
    new THREE.Vector3(0, -0.2, 0),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 4
    }
  );

  return applyShadowTraits(group, 2);
};

const setMeshBaseOpacity = (mesh, opacity) => {
  if (!mesh?.material) {
    return mesh;
  }

  mesh.material.opacity = opacity;
  mesh.material.userData = {
    ...(mesh.material.userData || {}),
    baseOpacity: opacity
  };

  return mesh;
};

const softenPresenceGlow = (object, multiplier = 1) => {
  object?.traverse?.((child) => {
    if (!child.isMesh || !child.material?.transparent) {
      return;
    }

    const nextOpacity = (child.material.opacity ?? 1) * multiplier;
    child.material.opacity = nextOpacity;
    child.material.userData = {
      ...(child.material.userData || {}),
      baseOpacity: nextOpacity
    };
  });

  return object;
};

const createArcanePresenceDuelist = (config, sharedMaterials) => {
  const slot = createCharacterSlot(config, sharedMaterials);
  const figure = createArcaneDuelistFigure(config);
  const inward = config.side === "white" ? 1 : -1;
  const boardFacing = config.side === "white" ? -1 : 1;
  const runway = createRunwayPlate(
    new THREE.Vector3(0, 0, boardFacing * 0.12),
    sharedMaterials,
    config.sigilColor
  );

  runway.scale.set(1.08, 1, 1.04);
  softenPresenceGlow(runway, 0.42);
  slot.group.add(runway);

  slot.characterAnchor.position.y = 0.28;
  figure.group.scale.setScalar(config.presenceScale ?? 0.94);
  figure.group.position.set(0, 0.06, 0.08);
  figure.bodyRoot.scale.set(1.08, 1.02, 1.06);
  figure.headPivot.scale.setScalar(1.06);
  figure.cloakFront.scale.set(1.08, 1.04, 1);
  figure.cloakBack.scale.set(1.15, 1.08, 1);
  slot.modelMount.add(figure.group);

  setMeshBaseOpacity(slot.haloDisc, 0.036);
  setMeshBaseOpacity(slot.sigilRing, 0.088);
  setMeshBaseOpacity(slot.beam, 0.044);
  slot.beam.scale.set(0.82, 1.02, 0.82);

  setMeshBaseOpacity(figure.hemGlow, 0.082);
  setMeshBaseOpacity(figure.chestSigil, 0.126);
  setMeshBaseOpacity(figure.backHalo, 0.078);
  setMeshBaseOpacity(figure.staffCrystalGlow, 0.118);
  setMeshBaseOpacity(figure.leftHandGlow, 0.05);
  setMeshBaseOpacity(figure.rightHandGlow, 0.062);
  softenPresenceGlow(figure.crownGlow, 0.76);
  softenPresenceGlow(figure.orbitSigil, 0.68);

  const presenceKeyLight = new THREE.PointLight(
    config.keyLightColor ?? config.beamColor,
    config.keyLightIntensity ?? 0.18,
    7.2,
    2
  );
  presenceKeyLight.position.set(inward * 1.18, 2.84, boardFacing * 1.02);
  presenceKeyLight.userData.baseIntensity = presenceKeyLight.intensity;
  slot.group.add(presenceKeyLight);

  const presenceRimLight = new THREE.PointLight(
    config.rimLightColor ?? config.auraColor,
    config.rimLightIntensity ?? 0.08,
    5.6,
    2
  );
  presenceRimLight.position.set(-inward * 0.96, 2.52, -boardFacing * 0.22);
  presenceRimLight.userData.baseIntensity = presenceRimLight.intensity;
  slot.group.add(presenceRimLight);

  slot.group.userData.role = "duelist-presence";

  return {
    side: config.side,
    label: config.label,
    group: slot.group,
    slotGroup: slot.group,
    characterAnchor: slot.characterAnchor,
    modelMount: slot.modelMount,
    focusPoint: slot.focusPoint,
    baseAnchorY: slot.characterAnchor.position.y,
    baseRotationY: slot.baseRotationY,
    phase: slot.phase,
    runway,
    haloDisc: slot.haloDisc,
    sigilRing: slot.sigilRing,
    beam: slot.beam,
    presenceKeyLight,
    presenceRimLight,
    motionRoot: figure.motionRoot,
    bodyRoot: figure.bodyRoot,
    torsoPivot: figure.torsoPivot,
    headPivot: figure.headPivot,
    leftArmPivot: figure.leftArmPivot,
    rightArmPivot: figure.rightArmPivot,
    staffPivot: figure.staffPivot,
    cloakFront: figure.cloakFront,
    cloakBack: figure.cloakBack,
    hemGlow: figure.hemGlow,
    chestSigil: figure.chestSigil,
    backHalo: figure.backHalo,
    orbitSigil: figure.orbitSigil,
    crownGlow: figure.crownGlow,
    staffCrystalGlow: figure.staffCrystalGlow,
    leftHandGlow: figure.leftHandGlow,
    rightHandGlow: figure.rightHandGlow
  };
};

const createArcaneHallFoundation = () => {
  const root = new THREE.Group();
  root.name = "duel-scene-foundation";

  const sharedMaterials = {
    hallFloor: new THREE.MeshPhysicalMaterial({
      color: 0x08070a,
      roughness: 0.98,
      metalness: 0.01,
      clearcoat: 0.04,
      clearcoatRoughness: 0.92,
      emissive: 0x050508,
      emissiveIntensity: 0.03
    }),
    naveStone: new THREE.MeshPhysicalMaterial({
      color: 0x161214,
      roughness: 0.9,
      metalness: 0.03,
      clearcoat: 0.1,
      clearcoatRoughness: 0.74,
      emissive: 0x09090b,
      emissiveIntensity: 0.05
    }),
    walkwayStone: new THREE.MeshPhysicalMaterial({
      color: 0x141013,
      roughness: 0.92,
      metalness: 0.03,
      clearcoat: 0.08,
      clearcoatRoughness: 0.82,
      emissive: 0x08080b,
      emissiveIntensity: 0.04
    }),
    walkwayMetal: new THREE.MeshPhysicalMaterial({
      color: 0x6b5541,
      roughness: 0.3,
      metalness: 0.56,
      clearcoat: 0.62,
      clearcoatRoughness: 0.22,
      emissive: 0x21160f,
      emissiveIntensity: 0.05
    }),
    supportStone: new THREE.MeshPhysicalMaterial({
      color: 0x1b1718,
      roughness: 0.88,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.68,
      emissive: 0x0d0b0d,
      emissiveIntensity: 0.05
    }),
    guardianStone: new THREE.MeshPhysicalMaterial({
      color: 0x231d1d,
      roughness: 0.84,
      metalness: 0.05,
      clearcoat: 0.16,
      clearcoatRoughness: 0.6,
      emissive: 0x0f0b0c,
      emissiveIntensity: 0.04
    }),
    supportMetal: new THREE.MeshPhysicalMaterial({
      color: 0x7d624b,
      roughness: 0.28,
      metalness: 0.56,
      clearcoat: 0.66,
      clearcoatRoughness: 0.22,
      emissive: 0x2a180f,
      emissiveIntensity: 0.06
    }),
    brazierMetal: new THREE.MeshPhysicalMaterial({
      color: 0x8a684d,
      roughness: 0.22,
      metalness: 0.66,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      emissive: 0x311b10,
      emissiveIntensity: 0.08
    }),
    arenaStone: new THREE.MeshPhysicalMaterial({
      color: 0x191517,
      roughness: 0.88,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.68,
      emissive: 0x0b0a0c,
      emissiveIntensity: 0.05
    }),
    arenaMetal: new THREE.MeshPhysicalMaterial({
      color: 0x705844,
      roughness: 0.28,
      metalness: 0.56,
      clearcoat: 0.64,
      clearcoatRoughness: 0.22,
      emissive: 0x241710,
      emissiveIntensity: 0.06
    }),
    slotStone: new THREE.MeshPhysicalMaterial({
      color: 0x1d1718,
      roughness: 0.86,
      metalness: 0.04,
      clearcoat: 0.14,
      clearcoatRoughness: 0.68,
      emissive: 0x0d0b0d,
      emissiveIntensity: 0.05
    }),
    slotMetal: new THREE.MeshPhysicalMaterial({
      color: 0x8b6a4f,
      roughness: 0.24,
      metalness: 0.62,
      clearcoat: 0.66,
      clearcoatRoughness: 0.2,
      emissive: 0x2c1a10,
      emissiveIntensity: 0.06
    }),
    hallWall: new THREE.MeshPhysicalMaterial({
      color: 0x0f0d11,
      roughness: 0.94,
      metalness: 0.03,
      clearcoat: 0.08,
      clearcoatRoughness: 0.74,
      emissive: 0x06070b,
      emissiveIntensity: 0.04
    }),
    wallPlinth: new THREE.MeshPhysicalMaterial({
      color: 0x141014,
      roughness: 0.9,
      metalness: 0.04,
      clearcoat: 0.1,
      clearcoatRoughness: 0.74,
      emissive: 0x08080b,
      emissiveIntensity: 0.04
    }),
    backdropWall: new THREE.MeshPhysicalMaterial({
      color: 0x141115,
      roughness: 0.88,
      metalness: 0.05,
      clearcoat: 0.16,
      clearcoatRoughness: 0.66,
      emissive: 0x09090d,
      emissiveIntensity: 0.05
    }),
    wallInset: new THREE.MeshPhysicalMaterial({
      color: 0x17141a,
      roughness: 0.84,
      metalness: 0.05,
      clearcoat: 0.14,
      clearcoatRoughness: 0.6,
      emissive: 0x0d1118,
      emissiveIntensity: 0.08
    }),
    backdropInset: new THREE.MeshPhysicalMaterial({
      color: 0x1a1518,
      roughness: 0.84,
      metalness: 0.05,
      clearcoat: 0.14,
      clearcoatRoughness: 0.62,
      emissive: 0x0d1014,
      emissiveIntensity: 0.08
    })
  };

  root.add(createGrandHallShell(sharedMaterials));

  const pillars = [];
  const torches = [];
  const duelists = [];

  PILLAR_ROW_Z.forEach((z, index) => {
    [
      { side: "left", x: -SIDE_STRUCTURE_X },
      { side: "right", x: SIDE_STRUCTURE_X }
    ].forEach(({ side, x }, sideIndex) => {
      const pillar = createGrandHallPillar(
        side,
        sharedMaterials,
        index < 2 ? 0x6f88af : 0xb8844d,
        index
      );
      pillar.group.position.set(x, 0, z);
      pillar.group.scale.setScalar(MONUMENT_ROW_SCALES[index] ?? 1);
      root.add(pillar.group);
      pillars.push({
        ...pillar,
        phase: index * 0.68 + sideIndex * 0.3
      });

      const torch = createTorchSconce(side, sharedMaterials, {
        castShadow: index < 3,
        phase: index * 0.72 + sideIndex * 0.45
      });
      torch.group.position.set(side === "left" ? -TORCH_X : TORCH_X, 0, z + 0.2);
      root.add(torch.group);
      torches.push(torch);
    });
  });

  const duelistPresenceGroup = new THREE.Group();
  duelistPresenceGroup.name = "duelist-presence-group";
  root.add(duelistPresenceGroup);

  [PLAYER_ZONE_LAYOUT.white, PLAYER_ZONE_LAYOUT.black].forEach((config) => {
    const duelist = createArcanePresenceDuelist(config, sharedMaterials);
    duelistPresenceGroup.add(duelist.group);
    duelists.push(duelist);
  });

  addMesh(
    root,
    new THREE.PlaneGeometry(20.4, 1.2),
    createGlowMaterial(0xff9a48, 0.08, {
      side: THREE.DoubleSide
    }),
    new THREE.Vector3(0, 0.02, BACK_APSE_Z + 1.84),
    {
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      castShadow: false,
      receiveShadow: false,
      renderOrder: 3
    }
  );

  return {
    root: applyShadowTraits(root, 1),
    boardClearZone: BOARD_CLEAR_ZONE,
    pillars,
    torches,
    duelists
  };
};

const getArcaneHallCameraLayout = (aspect = 1) => {
  const portraitBias = aspect < 1 ? Math.min(1 - aspect, 0.5) : 0;
  const widescreenBias = aspect > 1.28 ? Math.min(aspect - 1.28, 0.85) : 0;

  return {
    fov: aspect < 0.86 ? 43.6 : aspect > 1.45 ? 39.2 : 41.2,
    position: new THREE.Vector3(
      0,
      5.92 + portraitBias * 0.72 - widescreenBias * 0.08,
      10.72 + portraitBias * 1.16 - widescreenBias * 0.66
    ),
    lookAt: new THREE.Vector3(
      0,
      0.72 + portraitBias * 0.05,
      0
    ),
    introPositionOffset: new THREE.Vector3(0, 0.32, 0.54),
    introLookOffset: new THREE.Vector3(0, 0.08, 0)
  };
};

export { createArcaneHallFoundation, getArcaneHallCameraLayout };
