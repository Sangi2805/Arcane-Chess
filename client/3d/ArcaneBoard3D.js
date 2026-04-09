import * as THREE from "/vendor/three/three.module.js";
import { createArcanePiece, createArcanePieceGroundShadow } from "./pieceFactory.js";
import { createArcaneHallFoundation, getArcaneHallCameraLayout } from "./sceneFoundation.js";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const BOARD_HALF = (BOARD_SIZE - 1) / 2;
const BOARD_TOP_Y = 0.17;
const PIECE_ANCHOR_Y = 0.15;
const PIECE_GROUND_SHADOW_Y = BOARD_TOP_Y + 0.008;
const HIGHLIGHT_Y = BOARD_TOP_Y + 0.02;
const CAMERA_BOARD_FOCUS_Y = BOARD_TOP_Y + 0.55;
const CAMERA_SAFE_HALL_RADIUS = 12.4;
const CAMERA_MIN_HEIGHT = 4.9;
const CAMERA_MAX_HEIGHT = 7.2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const getSquareKey = (lastMove = {}) =>
  lastMove?.from && lastMove?.to
    ? `${lastMove.from}:${lastMove.to}:${lastMove.san || ""}:${lastMove.promotion || ""}`
    : "";

const getFileIndex = (square) => square.charCodeAt(0) - 97;
const getRankIndex = (square) => Number(square[1]) - 1;

const easeInOutCubic = (value) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);
const easeOutBack = (value) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
};

const CHECK_STATUS_CODES = new Set(["check", "checkmate"]);
const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
const toMaterialArray = (material) => (Array.isArray(material) ? material : [material]);
const squareSurfaceColor = new THREE.Color();
const checkWarningColor = new THREE.Color(0xc45a56);

const registerAnimatedLight = (light) => {
  light.userData.baseIntensity = light.intensity;
  return light;
};

const registerGlowMaterial = (material) => {
  material.userData.baseOpacity = material.opacity ?? 1;
  return material;
};

const registerSquareMaterial = (material, metadata = {}) => {
  material.userData.baseColor = material.color.clone();
  material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 0;
  material.userData.baseRoughness = material.roughness ?? 0;
  material.userData.baseSpecularIntensity = material.specularIntensity ?? 0;
  material.userData.baseClearcoat = material.clearcoat ?? 0;
  material.userData.baseClearcoatRoughness = material.clearcoatRoughness ?? 0;
  Object.assign(material.userData, metadata);
  return material;
};

const createGlowMaterial = (color, opacity, extra = {}) =>
  registerGlowMaterial(new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...extra
  }));

const cloneMaterialOpacity = (object, opacity) => {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    toMaterialArray(child.material).forEach((material) => {
      material.transparent = opacity < 0.999;
      material.depthWrite = opacity >= 0.999;
      material.opacity = opacity;
    });
  });
};

const setObjectMaterialOpacity = (object, opacityFactor = 1) => {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    toMaterialArray(child.material).forEach((material) => {
      material.opacity = (material.userData.baseOpacity ?? material.opacity ?? 1) * opacityFactor;
    });
  });
};

const setMeshOpacityFromBase = (mesh, opacityFactor = 1, offset = 0) => {
  if (!mesh?.material) {
    return;
  }

  const baseOpacity = mesh.material.userData?.baseOpacity ?? mesh.material.opacity ?? 1;
  mesh.material.opacity = Math.max(0, baseOpacity * opacityFactor + offset);
};

const setTransparentDescendantOpacity = (object, opacityFactor = 1) => {
  object?.traverse?.((child) => {
    if (!child.isMesh || !child.material?.transparent) {
      return;
    }

    const baseOpacity = child.material.userData?.baseOpacity ?? child.material.opacity ?? 1;
    child.material.opacity = Math.max(0, baseOpacity * opacityFactor);
  });
};

const setObjectEmissiveBoost = (object, boost = 0) => {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    toMaterialArray(child.material).forEach((material) => {
      material.emissiveIntensity =
        (material.userData.baseEmissiveIntensity ?? material.emissiveIntensity ?? 0) +
        boost * (material.userData.selectionBoostMultiplier ?? 1);
    });
  });
};

const setObjectEmissiveTint = (object, color = null) => {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    toMaterialArray(child.material).forEach((material) => {
      if (!material.emissive) {
        return;
      }

      if (!material.userData.baseEmissiveColor && material.emissive?.clone) {
        material.userData.baseEmissiveColor = material.emissive.clone();
      }

      if (color) {
        material.emissive.copy(color);
      } else if (material.userData.baseEmissiveColor) {
        material.emissive.copy(material.userData.baseEmissiveColor);
      }
    });
  });
};

const resetPiecePose = (mesh) => {
  mesh.rotation.set(0, 0, 0);
  mesh.scale.setScalar(1);
  cloneMaterialOpacity(mesh, 1);
  setObjectEmissiveBoost(mesh, 0);
};

const setMeshRenderOrder = (object, order) => {
  object.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = order;
    }
  });

  return object;
};

const isGameplayDebugEnabled = () => window.__ARCANE_DEBUG_SYNC !== false;

const disposeObject3D = (object) => {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      toMaterialArray(child.material).forEach((material) => material.dispose?.());
    }
  });
};

class ArcaneBoard3D {
  constructor({ mountElement, onSquareSelect = null }) {
    if (!mountElement) {
      throw new Error("ArcaneBoard3D requires a mount element.");
    }

    this.mountElement = mountElement;
    this.onSquareSelect = typeof onSquareSelect === "function" ? onSquareSelect : null;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05060a, 9.2, 33.6);

    this.camera = new THREE.PerspectiveCamera(41, 1, 0.18, 60);
    this.cameraRestPosition = new THREE.Vector3(0, 8.82, 9.02);
    this.cameraRestLookAt = new THREE.Vector3(0, 0.46, 0.04);
    this.cameraDrift = new THREE.Vector3();
    this.cameraDriftTarget = new THREE.Vector3();
    this.cameraKick = new THREE.Vector3();
    this.cameraFocusPoint = this.cameraRestLookAt.clone();
    this.camera.position.copy(this.cameraRestPosition);
    this.camera.lookAt(this.cameraFocusPoint);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.01;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "board-3d-canvas";
    this.renderer.domElement.setAttribute("aria-hidden", "true");

    this.mountElement.replaceChildren(this.renderer.domElement);

    this.boardRoot = new THREE.Group();
    this.boardRoot.scale.setScalar(1.05);
    this.boardRoot.position.y = -0.03;
    this.scene.add(this.boardRoot);
    this.pieceShadowGroup = new THREE.Group();
    this.boardRoot.add(this.pieceShadowGroup);
    this.pieceGroup = new THREE.Group();
    this.boardRoot.add(this.pieceGroup);

    this.squareTiles = new Map();
    this.squareHitboxes = new Map();
    this.targetMarkers = [];
    this.lastMoveHighlights = [];
    this.selectionMarker = null;
    this.checkWarningMarker = null;
    this.checkWarningSquare = null;
    this.checkedKingColor = null;
    this.pieceMeshes = new Map();
    this.pieceGroundShadows = new Map();
    this.pieceHitboxes = new Map();
    this.animations = [];
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;
    this.playerPerspective = "white";
    this.previousBoardMap = null;
    this.currentGameId = null;
    this.lastMoveKey = "";
    this.currentLastMove = null;
    this.currentGameState = null;
    this.currentSelection = null;
    this.currentBoardMap = new Map();
    this.currentLegalMovesBySquare = new Set();
    this.currentLegalTargetSquares = new Set();
    this.interactionLocked = false;
    this.hoveredSquare = null;
    this.isViewActive = true;
    this.hasActivatedViewOnce = false;
    this.viewIntroProgress = 1;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.meshSerial = 0;
    this.cameraIntroOffset = new THREE.Vector3();
    this.cameraIntroLookOffset = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.boundPointerDown = (event) => this.handlePointerSelect(event);
    this.resizeFrameId = null;
    this.resizeObserver = null;
    this.sceneFoundation = null;
    this.buildLighting();
    this.buildAtmosphere();
    this.buildBoard();
    this.buildSceneFoundation();
    this.buildHighlights();
    this.buildInteractionLayer();
    this.bindPointerEvents();
    this.bindResizeObserver();
    this.resize({ immediate: true });
    this.renderer.setAnimationLoop(() => this.animate());
  }

  buildLighting() {
    const ambient = registerAnimatedLight(new THREE.HemisphereLight(0xf0e8da, 0x0b0a0e, 0.68));
    ambient.position.set(0, 12, 0);
    this.scene.add(ambient);
    this.ambientLight = ambient;

    const boardFocusTarget = new THREE.Object3D();
    boardFocusTarget.position.set(0, 0.52, 0);
    this.scene.add(boardFocusTarget);
    this.boardFocusTarget = boardFocusTarget;

    const ceremonialLight = registerAnimatedLight(new THREE.DirectionalLight(0xffe2c0, 1.14));
    ceremonialLight.position.set(6.3, 10.2, 7.4);
    ceremonialLight.castShadow = true;
    ceremonialLight.shadow.mapSize.set(1536, 1536);
    ceremonialLight.shadow.camera.near = 0.5;
    ceremonialLight.shadow.camera.far = 30;
    ceremonialLight.shadow.camera.left = -7.2;
    ceremonialLight.shadow.camera.right = 7.2;
    ceremonialLight.shadow.camera.top = 7.2;
    ceremonialLight.shadow.camera.bottom = -7.2;
    ceremonialLight.shadow.bias = -0.00032;
    ceremonialLight.shadow.normalBias = 0.014;
    ceremonialLight.shadow.radius = 3;
    ceremonialLight.target = boardFocusTarget;
    this.scene.add(ceremonialLight);
    this.ceremonialLight = ceremonialLight;

    const boardFocusLight = registerAnimatedLight(new THREE.SpotLight(0xffe8c6, 1.28, 30, 0.6, 0.72, 1.35));
    boardFocusLight.position.set(0, 10.2, 4.6);
    boardFocusLight.target = boardFocusTarget;
    boardFocusLight.castShadow = true;
    boardFocusLight.shadow.mapSize.set(1024, 1024);
    boardFocusLight.shadow.camera.near = 1.8;
    boardFocusLight.shadow.camera.far = 24;
    boardFocusLight.shadow.bias = -0.00022;
    boardFocusLight.shadow.normalBias = 0.016;
    boardFocusLight.shadow.radius = 3;
    this.scene.add(boardFocusLight);
    this.boardFocusLight = boardFocusLight;

    const boardLift = registerAnimatedLight(new THREE.PointLight(0xf4c994, 0.19, 13.5, 2));
    boardLift.position.set(0, 2.7, 1.2);
    this.scene.add(boardLift);
    this.boardLiftLight = boardLift;

    const moonRim = registerAnimatedLight(new THREE.DirectionalLight(0xb9cae7, 0.24));
    moonRim.position.set(-8.2, 8.1, -12.8);
    this.scene.add(moonRim);
    this.moonRimLight = moonRim;

    const rearRimTarget = new THREE.Object3D();
    rearRimTarget.position.set(0, 0.72, -1.25);
    this.scene.add(rearRimTarget);

    const rearRim = registerAnimatedLight(new THREE.DirectionalLight(0x9fb7d8, 0.18));
    rearRim.position.set(-4.2, 6.8, -13.2);
    rearRim.target = rearRimTarget;
    this.scene.add(rearRim);
    this.rearRimLight = rearRim;

    const frontFillTarget = new THREE.Object3D();
    frontFillTarget.position.set(0, 0.7, -0.9);
    this.scene.add(frontFillTarget);

    const frontFill = registerAnimatedLight(new THREE.DirectionalLight(0xf3dfc6, 0.12));
    frontFill.position.set(1.4, 6.1, 11.6);
    frontFill.target = frontFillTarget;
    this.scene.add(frontFill);
    this.frontFillLight = frontFill;

    const warmFill = registerAnimatedLight(new THREE.PointLight(0xefb67a, 0.1, 18, 2));
    warmFill.position.set(-5.6, 5.0, 5.1);
    this.scene.add(warmFill);
    this.warmFillLight = warmFill;

    const coolBack = registerAnimatedLight(new THREE.PointLight(0x8ea9d1, 0.1, 22, 2));
    coolBack.position.set(4.8, 6.2, -12.2);
    this.scene.add(coolBack);
    this.coolBackLight = coolBack;

    const vaultLight = registerAnimatedLight(new THREE.PointLight(0x9aaed0, 0.045, 30, 2));
    vaultLight.position.set(0, 9.2, -6.4);
    this.scene.add(vaultLight);
    this.vaultLight = vaultLight;

    const apseLight = registerAnimatedLight(new THREE.PointLight(0x7b5a3d, 0.05, 28, 2));
    apseLight.position.set(0, 4.4, -17.2);
    this.scene.add(apseLight);
    this.apseLight = apseLight;

    const crownLight = registerAnimatedLight(new THREE.PointLight(0xffeed0, 0.036, 10, 2));
    crownLight.position.set(0, 6.5, 0.2);
    this.scene.add(crownLight);
    this.crownLight = crownLight;

    const whiteZoneLight = registerAnimatedLight(new THREE.PointLight(0xf0b46f, 0.05, 12, 2));
    whiteZoneLight.position.set(-7.2, 3.4, 4.8);
    this.boardRoot.add(whiteZoneLight);
    this.whiteZoneLight = whiteZoneLight;

    const blackZoneLight = registerAnimatedLight(new THREE.PointLight(0xc4894a, 0.07, 12.8, 2));
    blackZoneLight.position.set(7.2, 3.4, -4.8);
    this.boardRoot.add(blackZoneLight);
    this.blackZoneLight = blackZoneLight;

    const blackReadTarget = new THREE.Object3D();
    blackReadTarget.position.set(0, 0.76, -2.8);
    this.scene.add(blackReadTarget);

    const blackReadFillLight = registerAnimatedLight(new THREE.SpotLight(0xdbe7f8, 0.22, 24, 0.52, 0.84, 1.65));
    blackReadFillLight.position.set(0.2, 5.2, 8.5);
    blackReadFillLight.target = blackReadTarget;
    this.scene.add(blackReadFillLight);
    this.blackReadFillLight = blackReadFillLight;

    const blackRimTarget = new THREE.Object3D();
    blackRimTarget.position.set(0.2, 0.92, -3.15);
    this.scene.add(blackRimTarget);

    const blackPieceRimLight = registerAnimatedLight(new THREE.DirectionalLight(0xaec2de, 0.13));
    blackPieceRimLight.position.set(-6.6, 5.7, -8.6);
    blackPieceRimLight.target = blackRimTarget;
    this.scene.add(blackPieceRimLight);
    this.blackPieceRimLight = blackPieceRimLight;

    this.orbLights = [];
  }

  createOrbLight(position, color, intensity) {
    const orbGroup = new THREE.Group();
    const light = new THREE.PointLight(color, intensity, 8, 2);
    light.position.copy(position);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    orb.position.copy(position);

    orbGroup.add(light);
    orbGroup.add(orb);
    this.scene.add(orbGroup);

    return {
      group: orbGroup,
      light,
      orb,
      position: position.clone()
    };
  }

  buildAtmosphere() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28.4, 52),
      new THREE.MeshStandardMaterial({
        color: 0x08070a,
        roughness: 0.98,
        metalness: 0.01
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.04;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorDisc = floor;

    const outerFloorBand = new THREE.Mesh(
      new THREE.PlaneGeometry(18.8, 43.6),
      new THREE.MeshStandardMaterial({
        color: 0x0d0b0e,
        roughness: 0.96,
        metalness: 0.02
      })
    );
    outerFloorBand.rotation.x = -Math.PI / 2;
    outerFloorBand.position.set(0, -1.03, -1.8);
    outerFloorBand.receiveShadow = true;
    this.scene.add(outerFloorBand);
    this.outerFloorBand = outerFloorBand;

    const farFloorBand = new THREE.Mesh(
      new THREE.PlaneGeometry(24.2, 16.8),
      new THREE.MeshStandardMaterial({
        color: 0x06070a,
        roughness: 0.98,
        metalness: 0.01
      })
    );
    farFloorBand.rotation.x = -Math.PI / 2;
    farFloorBand.position.set(0, -1.02, -15.2);
    farFloorBand.receiveShadow = true;
    this.scene.add(farFloorBand);
    this.farFloorBand = farFloorBand;

    const perimeterShade = new THREE.Mesh(
      new THREE.PlaneGeometry(26.4, 47.2),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      })
    );
    perimeterShade.rotation.x = -Math.PI / 2;
    perimeterShade.position.set(0, -1.01, -2.4);
    this.scene.add(perimeterShade);
    this.perimeterShade = perimeterShade;

    const midGroundBand = new THREE.Mesh(
      new THREE.PlaneGeometry(16.8, 17.4),
      createGlowMaterial(0x44576f, 0.008)
    );
    midGroundBand.rotation.x = -Math.PI / 2;
    midGroundBand.position.set(0, -0.84, -7.2);
    midGroundBand.renderOrder = 0;
    this.scene.add(midGroundBand);
    this.midGroundBand = midGroundBand;

    const boardGroundShadow = new THREE.Mesh(
      new THREE.CircleGeometry(6.2, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.24,
        depthWrite: false
      })
    );
    boardGroundShadow.rotation.x = -Math.PI / 2;
    boardGroundShadow.position.y = -1.02;
    this.scene.add(boardGroundShadow);
    this.boardGroundShadow = boardGroundShadow;

    const floorMist = new THREE.Mesh(
      new THREE.PlaneGeometry(22.8, 43.6),
      createGlowMaterial(0x332b27, 0.032)
    );
    floorMist.rotation.x = -Math.PI / 2;
    floorMist.position.set(0, -0.7, -2.8);
    floorMist.renderOrder = 0;
    this.scene.add(floorMist);
    this.floorMist = floorMist;

    const emberDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.96, 64),
      createGlowMaterial(0xd2ab72, 0.034)
    );
    emberDisc.rotation.x = -Math.PI / 2;
    emberDisc.position.y = -0.63;
    emberDisc.renderOrder = 0;
    this.scene.add(emberDisc);
    this.emberDisc = emberDisc;

    const outerGlowRing = new THREE.Mesh(
      new THREE.PlaneGeometry(18.2, 31.6),
      createGlowMaterial(0x6983a8, 0.02)
    );
    outerGlowRing.rotation.x = -Math.PI / 2;
    outerGlowRing.position.set(0, -0.61, -4.4);
    outerGlowRing.renderOrder = 0;
    this.scene.add(outerGlowRing);
    this.outerGlowRing = outerGlowRing;

    const boardAura = new THREE.Mesh(
      new THREE.CircleGeometry(5.08, 64),
      createGlowMaterial(0xffddb0, 0.056)
    );
    boardAura.rotation.x = -Math.PI / 2;
    boardAura.position.y = -0.06;
    boardAura.renderOrder = 1;
    this.scene.add(boardAura);
    this.boardAura = boardAura;

    const altarHalo = new THREE.Mesh(
      new THREE.RingGeometry(4.22, 5.04, 72),
      createGlowMaterial(0xd1a16a, 0.064)
    );
    altarHalo.rotation.x = -Math.PI / 2;
    altarHalo.position.y = -0.13;
    altarHalo.renderOrder = 1;
    this.scene.add(altarHalo);
    this.altarHalo = altarHalo;

    const wallVeil = new THREE.Mesh(
      new THREE.PlaneGeometry(23.8, 12.4),
      new THREE.MeshBasicMaterial({
        color: 0x0d1015,
        transparent: true,
        opacity: 0.21,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    wallVeil.position.set(0, 5.08, -18.4);
    this.scene.add(wallVeil);
    this.wallVeil = wallVeil;

    const vaultHaze = new THREE.Mesh(
      new THREE.PlaneGeometry(26.6, 24.8),
      createGlowMaterial(0x2c3848, 0.01, {
        side: THREE.DoubleSide
      })
    );
    vaultHaze.rotation.x = Math.PI / 2;
    vaultHaze.position.set(0, 9.2, -5.2);
    vaultHaze.renderOrder = 0;
    this.scene.add(vaultHaze);
    this.vaultHaze = vaultHaze;

    const roomHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(23.2, 42.4),
      createGlowMaterial(0x3a4658, 0.014, {
        side: THREE.DoubleSide
      })
    );
    roomHalo.rotation.x = -Math.PI / 2;
    roomHalo.position.set(0, -0.78, -3.6);
    roomHalo.renderOrder = 0;
    this.scene.add(roomHalo);
    this.roomHalo = roomHalo;

    const boardRearVeil = new THREE.Mesh(
      new THREE.PlaneGeometry(8.7, 3.5),
      registerGlowMaterial(new THREE.MeshBasicMaterial({
        color: 0x233244,
        transparent: true,
        opacity: 0.072,
        depthWrite: false,
        side: THREE.DoubleSide
      }))
    );
    boardRearVeil.position.set(0, 1.54, -5.05);
    boardRearVeil.renderOrder = 0;
    this.boardRoot.add(boardRearVeil);
    this.boardRearVeil = boardRearVeil;
  }

  buildBoard() {
    const platform = new THREE.Group();
    const stonePedestalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x251d18,
      roughness: 0.82,
      metalness: 0.04,
      clearcoat: 0.18,
      clearcoatRoughness: 0.74,
      emissive: 0x130d0a,
      emissiveIntensity: 0.024
    });
    const metalBandMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb18a62,
      roughness: 0.24,
      metalness: 0.64,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      emissive: 0x2b180d,
      emissiveIntensity: 0.04
    });
    const boardWoodMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3b2a1f,
      roughness: 0.4,
      metalness: 0.04,
      clearcoat: 0.68,
      clearcoatRoughness: 0.2,
      emissive: 0x130d0a,
      emissiveIntensity: 0.018
    });
    const insetStoneMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1d1713,
      roughness: 0.66,
      metalness: 0.03,
      clearcoat: 0.26,
      clearcoatRoughness: 0.56,
      emissive: 0x100b09,
      emissiveIntensity: 0.03
    });

    const pedestalBase = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.72, 0.88, 10),
      stonePedestalMaterial
    );
    pedestalBase.position.y = -0.66;
    pedestalBase.receiveShadow = true;
    pedestalBase.castShadow = true;
    platform.add(pedestalBase);

    const pedestalBand = new THREE.Mesh(
      new THREE.CylinderGeometry(5.9, 6.1, 0.22, 10),
      metalBandMaterial
    );
    pedestalBand.position.y = -0.18;
    pedestalBand.castShadow = true;
    pedestalBand.receiveShadow = true;
    platform.add(pedestalBand);

    const pedestalShoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 5.9, 0.34, 10),
      stonePedestalMaterial.clone()
    );
    pedestalShoulder.position.y = -0.36;
    pedestalShoulder.castShadow = true;
    pedestalShoulder.receiveShadow = true;
    platform.add(pedestalShoulder);

    const boardBed = new THREE.Mesh(
      new THREE.BoxGeometry(8.98, 0.22, 8.98),
      boardWoodMaterial
    );
    boardBed.position.y = -0.02;
    boardBed.castShadow = true;
    boardBed.receiveShadow = true;
    platform.add(boardBed);

    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(8.46, 0.11, 8.46),
      insetStoneMaterial
    );
    inset.position.y = 0.08;
    inset.castShadow = true;
    inset.receiveShadow = true;
    platform.add(inset);

    const underGlow = new THREE.Mesh(
      new THREE.RingGeometry(3.95, 4.76, 72),
      createGlowMaterial(0xf0c48c, 0.058)
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = 0.015;
    underGlow.renderOrder = 3;
    platform.add(underGlow);
    this.boardUnderGlow = underGlow;

    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x87694f,
      roughness: 0.23,
      metalness: 0.62,
      clearcoat: 0.76,
      clearcoatRoughness: 0.18,
      emissive: 0x2a1a10,
      emissiveIntensity: 0.045
    });
    const frameLong = new THREE.BoxGeometry(8.68, 0.22, 0.34);
    const frameShort = new THREE.BoxGeometry(0.34, 0.22, 8.68);

    [
      [frameLong, new THREE.Vector3(0, 0.13, 4.16)],
      [frameLong, new THREE.Vector3(0, 0.13, -4.16)],
      [frameShort, new THREE.Vector3(4.16, 0.13, 0)],
      [frameShort, new THREE.Vector3(-4.16, 0.13, 0)]
    ].forEach(([geometry, position]) => {
      const rail = new THREE.Mesh(geometry, frameMaterial);
      rail.position.copy(position);
      rail.castShadow = true;
      rail.receiveShadow = true;
      platform.add(rail);
    });

    const innerLip = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.06, 12, 72),
      metalBandMaterial.clone()
    );
    innerLip.rotation.x = Math.PI / 2;
    innerLip.position.y = 0.12;
    innerLip.castShadow = true;
    innerLip.receiveShadow = true;
    platform.add(innerLip);

    [
      new THREE.Vector3(4.18, 0.16, 4.18),
      new THREE.Vector3(-4.18, 0.16, 4.18),
      new THREE.Vector3(4.18, 0.16, -4.18),
      new THREE.Vector3(-4.18, 0.16, -4.18)
    ].forEach((position) => {
      const cap = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        metalBandMaterial.clone()
      );
      cap.position.copy(position);
      cap.castShadow = true;
      cap.receiveShadow = true;
      platform.add(cap);
    });

    setMeshRenderOrder(platform, 1);
    underGlow.renderOrder = 3;
    this.boardRoot.add(platform);

    const createSquareMaterialVariants = (baseColor, options) =>
      Array.from({ length: 6 }, (_, index) => {
        const color = new THREE.Color(baseColor);
        const liftShift = (index - 2.5) * options.lightnessShift;
        const saturationShift = index % 2 === 0 ? options.saturationShift : -options.saturationShift;
        color.offsetHSL(0.0055 * (index - 2.5), saturationShift, liftShift);

        return new THREE.MeshPhysicalMaterial({
          color,
          roughness: options.roughness + (index - 2.5) * 0.018,
          metalness: options.metalness,
          clearcoat: options.clearcoat,
          clearcoatRoughness: options.clearcoatRoughness + (index % 2 === 0 ? -0.018 : 0.018),
          specularIntensity: options.specularIntensity,
          sheen: options.sheen,
          sheenColor: options.sheenColor,
          sheenRoughness: options.sheenRoughness,
          emissive: options.emissive,
          emissiveIntensity: options.emissiveIntensity
        });
      });

    const lightSquareMaterials = createSquareMaterialVariants(0xd6c4a8, {
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      specularIntensity: 0.44,
      sheen: 0.08,
      sheenColor: 0xf5e8d2,
      sheenRoughness: 0.44,
      emissive: 0x16100c,
      emissiveIntensity: 0.015,
      saturationShift: 0.014,
      lightnessShift: 0.014
    });
    const darkSquareMaterials = createSquareMaterialVariants(0x47342a, {
      roughness: 0.45,
      metalness: 0.04,
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      specularIntensity: 0.4,
      sheen: 0.05,
      sheenColor: 0xa49383,
      sheenRoughness: 0.5,
      emissive: 0x0d0907,
      emissiveIntensity: 0.016,
      saturationShift: 0.012,
      lightnessShift: 0.012
    });

    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE * 0.985, 0.11, SQUARE_SIZE * 0.985);

    for (let rank = 1; rank <= BOARD_SIZE; rank += 1) {
      for (let file = 0; file < BOARD_SIZE; file += 1) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const variationIndex = (file * 3 + rank) % 6;
        const baseMaterial =
          (file + rank) % 2 === 0
            ? darkSquareMaterials[variationIndex]
            : lightSquareMaterials[variationIndex];
        const squarePosition = this.getSquarePosition(square);
        const radialDistance = Math.hypot(squarePosition.x, squarePosition.z);
        const radialWeight = clampValue(1 - radialDistance / 5.08, 0, 1);
        const tileMaterial = registerSquareMaterial(baseMaterial.clone(), {
          square,
          radialWeight,
          edgeWeight: 1 - radialWeight,
          viewerDepth: squarePosition.z / BOARD_HALF,
          shimmerOffset: file * 0.62 + rank * 0.39,
          isDarkSquare: (file + rank) % 2 === 0
        });
        const tile = new THREE.Mesh(
          squareGeometry,
          tileMaterial
        );

        tile.position.copy(squarePosition);
        tile.position.y = BOARD_TOP_Y / 2;
        tile.receiveShadow = true;
        tile.castShadow = false;
        tile.renderOrder = 2;
        tile.userData.square = square;
        this.boardRoot.add(tile);
        this.squareTiles.set(square, tile);
      }
    }
  }

  buildSceneFoundation() {
    this.sceneFoundation = createArcaneHallFoundation();
    this.boardRoot.add(this.sceneFoundation.root);
  }

  buildHighlights() {
    this.squareHighlightGroup = new THREE.Group();
    this.selectionMarkerGroup = new THREE.Group();
    this.targetMarkerGroup = new THREE.Group();
    this.checkWarningGroup = new THREE.Group();
    this.transientEffectGroup = new THREE.Group();
    this.boardRoot.add(this.squareHighlightGroup);
    this.boardRoot.add(this.selectionMarkerGroup);
    this.boardRoot.add(this.targetMarkerGroup);
    this.boardRoot.add(this.checkWarningGroup);
    this.boardRoot.add(this.transientEffectGroup);
  }

  buildInteractionLayer() {
    this.squareHitboxMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.pieceHitboxMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    this.interactionGroup = new THREE.Group();
    this.squareInteractionGroup = new THREE.Group();
    this.interactionGroup.add(this.squareInteractionGroup);

    this.squareHitboxGeometry = new THREE.BoxGeometry(1.02, 0.38, 1.02);

    for (let rank = 1; rank <= BOARD_SIZE; rank += 1) {
      for (let file = 0; file < BOARD_SIZE; file += 1) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const hitbox = new THREE.Mesh(
          this.squareHitboxGeometry,
          this.squareHitboxMaterial.clone()
        );
        const position = this.getSquarePosition(square);

        hitbox.position.set(position.x, BOARD_TOP_Y + 0.11, position.z);
        hitbox.userData.square = square;
        hitbox.userData.pickType = "square";
        this.squareInteractionGroup.add(hitbox);
        this.squareHitboxes.set(square, hitbox);
      }
    }

    this.boardRoot.add(this.interactionGroup);
  }

  bindPointerEvents() {
    this.renderer.domElement.addEventListener("pointerdown", this.boundPointerDown);
  }

  bindResizeObserver() {
    if (typeof ResizeObserver !== "function") {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleResize();
    });
    this.resizeObserver.observe(this.mountElement);
  }

  scheduleResize({ immediate = false } = {}) {
    if (this.resizeFrameId) {
      cancelAnimationFrame(this.resizeFrameId);
    }

    this.resizeFrameId = requestAnimationFrame(() => {
      this.resizeFrameId = null;
      this.resize({
        immediate: immediate || this.animations.length === 0
      });
    });
  }

  createTargetMarker(capture = false) {
    const marker = new THREE.Group();
    const core = new THREE.Mesh(
      capture
        ? new THREE.RingGeometry(0.24, 0.38, 36)
        : new THREE.CircleGeometry(0.16, 28),
      createGlowMaterial(capture ? 0xf1a18f : 0xe5ba72, capture ? 0.46 : 0.28)
    );
    core.rotation.x = -Math.PI / 2;
    core.position.y = HIGHLIGHT_Y + 0.002;
    core.renderOrder = capture ? 16 : 15;
    marker.add(core);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(capture ? 0.35 : 0.23, capture ? 0.47 : 0.32, 40),
      createGlowMaterial(capture ? 0xf7b1a3 : 0xf5d8a8, capture ? 0.3 : 0.22)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = HIGHLIGHT_Y + 0.006;
    ring.renderOrder = capture ? 17 : 16;
    marker.add(ring);

    marker.userData.core = core;
    marker.userData.ring = ring;
    marker.userData.capture = capture;
    return marker;
  }

  createSquareHighlight({ color, fillOpacity, ringOpacity, size = 0.78, ringInner = 0.24, ringOuter = 0.36 }) {
    const marker = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      createGlowMaterial(color, fillOpacity, {
        side: THREE.DoubleSide
      })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.rotation.z = Math.PI / 4;
    plate.position.y = HIGHLIGHT_Y - 0.002;
    plate.renderOrder = 11;
    marker.add(plate);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringInner, ringOuter, 40),
      createGlowMaterial(color, ringOpacity)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = HIGHLIGHT_Y + 0.004;
    ring.renderOrder = 12;
    marker.add(ring);

    marker.userData.plate = plate;
    marker.userData.ring = ring;
    return marker;
  }

  createSelectionMarker() {
    const marker = this.createSquareHighlight({
      color: 0xdcc59b,
      fillOpacity: 0.1,
      ringOpacity: 0.34,
      size: 0.84,
      ringInner: 0.28,
      ringOuter: 0.43
    });
    const accent = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 32),
      createGlowMaterial(0x8ad8bb, 0.2)
    );
    accent.rotation.x = -Math.PI / 2;
    accent.position.y = HIGHLIGHT_Y + 0.008;
    accent.renderOrder = 13;
    marker.add(accent);
    marker.userData.accent = accent;
    return marker;
  }

  createCheckWarningMarker() {
    const marker = new THREE.Group();
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 36),
      createGlowMaterial(0xc45a56, 0.08)
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = HIGHLIGHT_Y + 0.003;
    glow.renderOrder = 13;
    marker.add(glow);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 44),
      createGlowMaterial(0xd97870, 0.18)
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = HIGHLIGHT_Y + 0.008;
    innerRing.renderOrder = 14;
    marker.add(innerRing);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.47, 0.6, 48),
      createGlowMaterial(0xf0a091, 0.1)
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = HIGHLIGHT_Y + 0.01;
    outerRing.renderOrder = 14;
    marker.add(outerRing);

    marker.userData.glow = glow;
    marker.userData.innerRing = innerRing;
    marker.userData.outerRing = outerRing;
    return marker;
  }

  spawnSquarePulse(square, {
    color = 0xf2d0a1,
    durationMs = 420,
    maxScale = 1.6,
    opacity = 0.42,
    innerSize = 0.19,
    outerSize = 0.38
  } = {}) {
    const pulse = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(innerSize, 28),
      createGlowMaterial(color, opacity * 0.22)
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = HIGHLIGHT_Y + 0.004;
    disc.renderOrder = 18;
    pulse.add(disc);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(innerSize, outerSize, 42),
      createGlowMaterial(color, opacity)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = HIGHLIGHT_Y + 0.008;
    ring.renderOrder = 19;
    pulse.add(ring);

    pulse.position.copy(this.getSquarePosition(square));
    this.transientEffectGroup.add(pulse);

    this.addAnimation({
      durationMs,
      update: (progress) => {
        const eased = easeOutCubic(progress);
        const scale = 0.55 + eased * maxScale;

        pulse.scale.set(scale, scale, scale);
        setObjectMaterialOpacity(pulse, 1 - eased);
      },
      complete: () => {
        this.transientEffectGroup.remove(pulse);
        disposeObject3D(pulse);
      }
    });
  }

  spawnMoveTrail(fromPosition, toPosition, durationMs = 520, color = 0xecc796) {
    const moveLength = Math.max(fromPosition.distanceTo(toPosition) * 0.84, 0.52);
    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, moveLength),
      createGlowMaterial(color, 0.18, {
        side: THREE.DoubleSide
      })
    );
    trail.rotation.x = -Math.PI / 2;
    trail.rotation.y = Math.atan2(toPosition.x - fromPosition.x, toPosition.z - fromPosition.z);
    trail.position.set(
      (fromPosition.x + toPosition.x) / 2,
      HIGHLIGHT_Y + 0.01,
      (fromPosition.z + toPosition.z) / 2
    );
    trail.renderOrder = 18;
    this.transientEffectGroup.add(trail);

    this.addAnimation({
      durationMs,
      update: (progress) => {
        const fade = Math.sin(progress * Math.PI);

        trail.scale.set(0.92 + progress * 0.18, 1 + fade * 0.08, 1);
        setObjectMaterialOpacity(trail, fade * 0.9);
      },
      complete: () => {
        this.transientEffectGroup.remove(trail);
        disposeObject3D(trail);
      }
    });
  }

  getBoardSignature(boardMap = new Map()) {
    return Array.from(boardMap.entries())
      .filter(([, piece]) => piece)
      .sort(([leftSquare], [rightSquare]) => leftSquare.localeCompare(rightSquare))
      .map(([square, piece]) => `${square}:${piece.color[0]}${piece.type}`);
  }

  getManagedPieceSignature() {
    return Array.from(this.pieceMeshes.entries())
      .map(([square, mesh]) => ({
        square,
        meshId: mesh?.userData?.meshId || "unknown",
        piece: mesh ? `${mesh.userData.pieceColor}${mesh.userData.pieceType}` : "missing"
      }))
      .sort((left, right) => left.square.localeCompare(right.square));
  }

  getScenePieceSignature() {
    return this.pieceGroup.children
      .map((mesh) => ({
        square: mesh.userData.square || "?",
        meshId: mesh.userData.meshId || "unknown",
        piece: `${mesh.userData.pieceColor}${mesh.userData.pieceType}`
      }))
      .sort((left, right) => left.square.localeCompare(right.square));
  }

  logPieceSync(event, payload = {}) {
    if (!isGameplayDebugEnabled()) {
      return;
    }

    console.debug(`[ArcaneSync] 3d:${event}`, payload);
  }

  removeOrphanPieceMesh(mesh, reason = "orphan") {
    if (!mesh) {
      return null;
    }

    const square = mesh.userData.square || "?";
    this.pieceGroup.remove(mesh);
    if (square !== "?") {
      this.removePieceGroundShadow(square);
      this.removePieceHitbox(square);
    }
    disposeObject3D(mesh);

    return {
      meshId: mesh.userData.meshId || "unknown",
      square,
      piece: `${mesh.userData.pieceColor || "?"}${mesh.userData.pieceType || "?"}`,
      reason
    };
  }

  pruneOrphanMeshes(reason = "sync") {
    const mappedMeshes = new Set(this.pieceMeshes.values());
    const removed = [];

    this.pieceGroup.children.slice().forEach((mesh) => {
      if (mappedMeshes.has(mesh)) {
        return;
      }

      const orphanRecord = this.removeOrphanPieceMesh(mesh, reason);
      if (orphanRecord) {
        removed.push(orphanRecord);
      }
    });

    return removed;
  }

  getSquarePosition(square) {
    const file = getFileIndex(square);
    const rank = getRankIndex(square);

    return new THREE.Vector3(
      file - BOARD_HALF,
      0,
      BOARD_HALF - rank
    );
  }

  getWorldBoardPosition(squareOrPosition, y = 0) {
    const localPosition = squareOrPosition?.isVector3
      ? squareOrPosition.clone()
      : this.getSquarePosition(squareOrPosition);

    localPosition.y = y;
    this.boardRoot.updateWorldMatrix(true, false);
    return this.boardRoot.localToWorld(localPosition);
  }

  getPerspectiveScalar() {
    return this.playerPerspective === "black" ? -1 : 1;
  }

  createPieceHitbox(square, pieceMesh) {
    const baseHeight = pieceMesh.userData.height || 1;
    const pieceType = pieceMesh.userData.pieceType || "p";
    const radiusByType = {
      p: 0.39,
      n: 0.48,
      b: 0.46,
      r: 0.47,
      q: 0.5,
      k: 0.52
    };
    const radius = radiusByType[pieceType] || 0.46;
    const hitboxHeight = Math.max(1.02, baseHeight + 0.3);
    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 0.02, hitboxHeight, 12),
      this.pieceHitboxMaterial.clone()
    );
    const position = this.getSquarePosition(square);

    hitbox.position.set(position.x, BOARD_TOP_Y + hitboxHeight / 2 - 0.02, position.z);
    hitbox.userData.square = square;
    hitbox.userData.pickType = "piece";
    hitbox.userData.hitboxHeight = hitboxHeight;
    this.interactionGroup.add(hitbox);
    this.pieceHitboxes.set(square, hitbox);
    return hitbox;
  }

  removePieceHitbox(square) {
    const hitbox = this.pieceHitboxes.get(square);

    if (!hitbox) {
      return;
    }

    this.interactionGroup.remove(hitbox);
    this.pieceHitboxes.delete(square);
    disposeObject3D(hitbox);
  }

  updatePieceHitboxPosition(square, x, z) {
    const hitbox = this.pieceHitboxes.get(square);

    if (!hitbox) {
      return;
    }

    hitbox.position.set(x, BOARD_TOP_Y + hitbox.userData.hitboxHeight / 2 - 0.02, z);
  }

  createPieceGroundShadow(square, piece) {
    const shadow = createArcanePieceGroundShadow(piece);
    const position = this.getSquarePosition(square);

    shadow.position.set(position.x, PIECE_GROUND_SHADOW_Y, position.z);
    shadow.userData.square = square;
    this.pieceShadowGroup.add(shadow);
    this.pieceGroundShadows.set(square, shadow);
    return shadow;
  }

  removePieceGroundShadow(square) {
    const shadow = this.pieceGroundShadows.get(square);

    if (!shadow) {
      return;
    }

    this.pieceShadowGroup.remove(shadow);
    this.pieceGroundShadows.delete(square);
    disposeObject3D(shadow);
  }

  updatePieceGroundShadowPosition(square, x, z) {
    const shadow = this.pieceGroundShadows.get(square);

    if (!shadow) {
      return;
    }

    shadow.position.set(x, PIECE_GROUND_SHADOW_Y, z);
  }

  projectSquare(square) {
    return this.projectWorldPosition(this.getWorldBoardPosition(square, BOARD_TOP_Y + 0.16));
  }

  projectWorldPosition(worldPosition) {
    this.camera.updateMatrixWorld();
    const projected = worldPosition.clone().project(this.camera);
    const width = this.viewportWidth || this.mountElement.clientWidth;
    const height = this.viewportHeight || this.mountElement.clientHeight;

    if (!width || !height) {
      return null;
    }

    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height
    };
  }

  getProjectedInteractionPoint(square, kind = "square") {
    if (kind === "piece") {
      const pieceMesh = this.pieceMeshes.get(square);

      if (pieceMesh) {
        const localPoint = pieceMesh.position.clone();
        localPoint.y += Math.min((pieceMesh.userData.height || 1) * 0.52, 0.82);
        this.boardRoot.updateWorldMatrix(true, false);
        return this.projectWorldPosition(this.boardRoot.localToWorld(localPoint));
      }
    }

    return this.projectSquare(square);
  }

  canInteract() {
    const playerColor = this.currentGameState?.settings?.playerColor;

    return Boolean(
      this.isViewActive &&
      !this.interactionLocked &&
      this.currentGameState?.hasStarted &&
      !this.currentGameState?.isGameOver &&
      playerColor &&
      this.currentGameState?.turn === playerColor
    );
  }

  getRaycastCandidates(clientX, clientY) {
    if (!this.canInteract()) {
      return [];
    }

    const rect = this.renderer.domElement.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return [];
    }

    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    const candidateMap = new Map();
    const pushCandidate = (intersection, kind) => {
      const square = intersection.object.userData.square;

      if (!square) {
        return;
      }

      const key = `${kind}:${square}`;
      const existing = candidateMap.get(key);

      if (!existing || intersection.distance < existing.distance) {
        const projectedPoint = this.getProjectedInteractionPoint(square, kind);
        const screenDistance = projectedPoint
          ? Math.hypot(projectedPoint.x - pointerX, projectedPoint.y - pointerY)
          : Number.POSITIVE_INFINITY;
        candidateMap.set(key, {
          kind,
          square,
          distance: intersection.distance,
          projectedPoint,
          screenDistance
        });
      }
    };

    this.raycaster
      .intersectObjects(Array.from(this.pieceHitboxes.values()), false)
      .slice(0, 10)
      .forEach((intersection) => pushCandidate(intersection, "piece"));
    this.raycaster
      .intersectObjects(Array.from(this.squareHitboxes.values()), false)
      .slice(0, 12)
      .forEach((intersection) => pushCandidate(intersection, "square"));

    return Array.from(candidateMap.values());
  }

  scoreCandidate(candidate) {
    const piece = this.currentBoardMap.get(candidate.square);
    const playerColor = this.currentGameState?.settings?.playerColor;
    const isSelectablePiece =
      piece &&
      piece.color === playerColor &&
      this.currentLegalMovesBySquare.has(candidate.square);
    const isLegalTarget = this.currentLegalTargetSquares.has(candidate.square);
    const isCurrentSelection = this.currentSelection === candidate.square;

    let score = -100;

    if (this.currentSelection) {
      if (isLegalTarget) {
        score = 166;
      } else if (isCurrentSelection) {
        score = 160;
      } else if (isSelectablePiece) {
        score = 148;
      }
    } else if (isSelectablePiece) {
      score = 156;
    }

    if (score < 0) {
      return score;
    }

    if (candidate.kind === "square" && isSelectablePiece) {
      score += 20;
    } else if (candidate.kind === "piece") {
      score += 14;
    } else {
      score += 8;
    }

    if (piece && piece.type !== "p") {
      score += 3;
    }

    score += Math.max(0, 64 - (candidate.screenDistance ?? 999) * 0.7);
    score -= candidate.distance * 0.015;
    return score;
  }

  getBestInteraction(clientX, clientY) {
    const candidates = this.getRaycastCandidates(clientX, clientY);

    if (!candidates.length) {
      return null;
    }

    let bestCandidate = null;
    let bestScore = -Infinity;

    candidates.forEach((candidate) => {
      const score = this.scoreCandidate(candidate);

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    });

    return bestScore >= 0 ? bestCandidate : null;
  }

  clearHoverState() {
    this.hoveredSquare = null;
    this.renderer.domElement.style.cursor = "default";
  }

  handlePointerSelect(event) {
    if (!this.isViewActive || event.button !== 0) {
      return;
    }

    const candidate = this.getBestInteraction(event.clientX, event.clientY);

    if (!candidate) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (isGameplayDebugEnabled()) {
      console.debug("[ArcaneSync] 3d:pick", {
        clickedSquare: candidate.square,
        pickKind: candidate.kind,
        selectedSquare: this.currentSelection,
        legalTargets: Array.from(this.currentLegalTargetSquares)
      });
    }
    this.onSquareSelect?.(candidate.square);
  }

  setPerspective(playerColor = "white") {
    this.playerPerspective = playerColor;
    this.boardRoot.rotation.y = playerColor === "black" ? Math.PI : 0;
  }

  resize({ immediate = false } = {}) {
    const width = Math.round(this.mountElement.clientWidth);
    const height = Math.round(this.mountElement.clientHeight);

    if (!width || !height) {
      return;
    }

    if (
      !immediate &&
      width === this.viewportWidth &&
      height === this.viewportHeight
    ) {
      return;
    }

    this.viewportWidth = width;
    this.viewportHeight = height;

    this.camera.aspect = width / height;
    this.updateCameraFraming({ immediate });
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  updateCameraFraming({ immediate = false } = {}) {
    const layout = getArcaneHallCameraLayout(this.camera.aspect || 1);

    this.camera.fov = layout.fov;
    this.cameraRestPosition.copy(layout.position);
    this.cameraRestLookAt.copy(layout.lookAt);
    this.cameraIntroOffset.copy(layout.introPositionOffset);
    this.cameraIntroLookOffset.copy(layout.introLookOffset);

    if (immediate) {
      this.applyCameraTransform();
    }
  }

  startViewIntro() {
    this.viewIntroProgress = 0;
    this.cameraDrift.set(0, 0, 0);
    this.cameraDriftTarget.set(0, 0, 0);
    this.cameraKick.set(0, 0, 0);
    this.applyCameraTransform();
  }

  applyCameraTransform() {
    const introWeight = this.isViewActive ? 1 - easeOutCubic(this.viewIntroProgress) : 0;
    const cameraX =
      this.cameraRestPosition.x +
      this.cameraDrift.x * 0.26 +
      this.cameraKick.x +
      this.cameraIntroOffset.x * introWeight;
    const cameraY =
      this.cameraRestPosition.y +
      this.cameraDrift.y * 0.1 +
      this.cameraKick.y +
      this.cameraIntroOffset.y * introWeight;
    const cameraZ =
      this.cameraRestPosition.z +
      this.cameraDrift.z * 0.22 +
      this.cameraKick.z +
      this.cameraIntroOffset.z * introWeight;
    const planarDistance = Math.hypot(cameraX, cameraZ);
    const planarScale =
      planarDistance > CAMERA_SAFE_HALL_RADIUS ? CAMERA_SAFE_HALL_RADIUS / planarDistance : 1;

    this.camera.position.set(
      cameraX * planarScale,
      THREE.MathUtils.clamp(cameraY, CAMERA_MIN_HEIGHT, CAMERA_MAX_HEIGHT),
      cameraZ * planarScale
    );
    this.cameraFocusPoint.set(
      this.cameraRestLookAt.x,
      THREE.MathUtils.clamp(
        this.cameraRestLookAt.y +
          this.cameraDrift.y * 0.08 +
          this.cameraIntroLookOffset.y * introWeight,
        CAMERA_BOARD_FOCUS_Y - 0.08,
        CAMERA_BOARD_FOCUS_Y + 0.14
      ),
      this.cameraRestLookAt.z
    );
    this.camera.lookAt(this.cameraFocusPoint);
  }

  sync({
    gameState,
    selectedSquare = null,
    legalTargets = [],
    viewMode = "2d",
    interactionLocked = false
  }) {
    if (!gameState?.board) {
      this.clearPieces();
      this.updateHighlights(null, null, []);
      return;
    }

    const wasViewActive = this.isViewActive;
    this.isViewActive = viewMode === "3d";
    if (this.isViewActive && (!wasViewActive || !this.hasActivatedViewOnce)) {
      this.startViewIntro();
      this.hasActivatedViewOnce = true;
    }
    this.setPerspective(gameState.settings?.playerColor || "white");
    this.renderer.domElement.style.visibility = this.isViewActive ? "visible" : "hidden";
    this.renderer.domElement.style.pointerEvents = this.isViewActive ? "auto" : "none";
    this.currentGameState = gameState;
    this.interactionLocked = interactionLocked;
    this.currentLegalMovesBySquare = new Set(
      Object.entries(gameState.legalMoves || {})
        .filter(([, moves]) => Array.isArray(moves) && moves.length)
        .map(([square]) => square)
    );
    this.currentLegalTargetSquares = new Set((legalTargets || []).map((move) => move.to));
    const nextGameId = gameState.id || null;
    const shouldResetPresentation =
      nextGameId !== this.currentGameId ||
      (!gameState.lastMove &&
        Boolean(this.lastMoveKey || this.currentLastMove) &&
        (!Array.isArray(gameState.moveList) || gameState.moveList.length === 0));

    if (shouldResetPresentation) {
      this.resetPresentationState();
    }

    const nextBoardMap = new Map(
      (gameState.board || []).map((entry) => [entry.square, entry.piece || null])
    );
    const nextLastMove = gameState.lastMove || null;
    const nextMoveKey = getSquareKey(nextLastMove);
    const isFreshMove =
      Boolean(nextLastMove) && nextMoveKey && nextMoveKey !== this.lastMoveKey;
    const shouldAnimateMove =
      !shouldResetPresentation &&
      isFreshMove &&
      this.previousBoardMap &&
      this.canAnimateMove(nextBoardMap, nextLastMove);

    this.clearTransientEffects();
    if (shouldAnimateMove) {
      this.animateMove(nextBoardMap, nextLastMove);
    } else {
      this.syncPieces(nextBoardMap, {
        reason: shouldResetPresentation ? "reset" : isFreshMove ? "move-snap" : "refresh",
        lastMove: nextLastMove
      });
    }

    this.previousBoardMap = nextBoardMap;
    this.currentGameId = nextGameId;
    this.lastMoveKey = nextMoveKey;
    this.currentBoardMap = nextBoardMap;
    this.currentLastMove = nextLastMove;
    this.currentSelection = selectedSquare;
    this.updateHighlights(nextLastMove, selectedSquare, legalTargets);
    this.updateCheckWarning(gameState, nextBoardMap);
    this.updatePieceSelectionState(selectedSquare);
    this.clearHoverState();
  }

  canAnimateMove(nextBoardMap, lastMove) {
    const movingMesh = this.pieceMeshes.get(lastMove.from);
    const movedPiece = nextBoardMap.get(lastMove.to);

    return Boolean(movingMesh && movedPiece);
  }

  clearEffectGroup(group) {
    if (!group) {
      return;
    }

    group.children.slice().forEach((child) => {
      group.remove(child);
      disposeObject3D(child);
    });
  }

  queueCameraResponse(square, { capture = false } = {}) {
    if (!square) {
      return;
    }

    const perspective = this.getPerspectiveScalar();
    const focus = this.getSquarePosition(square);
    const viewerFocusX = focus.x * perspective;
    const viewerFocusZ = focus.z * perspective;
    this.cameraDriftTarget.set(
      THREE.MathUtils.clamp(viewerFocusX * 0.07, -0.22, 0.22),
      capture ? 0.08 : 0.04,
      THREE.MathUtils.clamp(viewerFocusZ * 0.05, -0.18, 0.18)
    );
    this.cameraKick.x += THREE.MathUtils.clamp(-viewerFocusX * 0.012, -0.05, 0.05);
    this.cameraKick.y += capture ? 0.08 : 0.035;
    this.cameraKick.z += capture ? 0.12 : 0.055;
  }

  clearPieces() {
    this.resetPresentationState();
    this.pieceGroup.children.slice().forEach((mesh) => {
      this.pieceGroup.remove(mesh);
      disposeObject3D(mesh);
    });
    this.pieceShadowGroup.children.slice().forEach((shadow) => {
      this.pieceShadowGroup.remove(shadow);
      disposeObject3D(shadow);
    });
    this.pieceHitboxes.forEach((hitbox) => {
      this.interactionGroup.remove(hitbox);
      disposeObject3D(hitbox);
    });

    this.pieceMeshes.clear();
    this.pieceGroundShadows.clear();
    this.pieceHitboxes.clear();
    this.previousBoardMap = null;
    this.currentGameId = null;
    this.currentBoardMap = new Map();
    this.currentLastMove = null;
    this.currentSelection = null;
    this.lastMoveKey = "";
    this.logPieceSync("clear", {
      reason: "clearPieces"
    });
  }

  clearTransientEffects() {
    this.animations = [];
    this.clearEffectGroup(this.transientEffectGroup);
    this.pieceMeshes.forEach((mesh) => resetPiecePose(mesh));
  }

  clearCheckWarning() {
    if (this.checkWarningMarker) {
      this.checkWarningGroup.remove(this.checkWarningMarker);
      disposeObject3D(this.checkWarningMarker);
      this.checkWarningMarker = null;
    }

    this.checkWarningSquare = null;
    this.checkedKingColor = null;
  }

  resetPresentationState() {
    this.clearTransientEffects();
    this.clearCheckWarning();
    this.clearHoverState();
    this.updateHighlights(null, null, []);
    this.updatePieceSelectionState(null);
    this.cameraDrift.set(0, 0, 0);
    this.cameraDriftTarget.set(0, 0, 0);
    this.cameraKick.set(0, 0, 0);
    this.applyCameraTransform();
    this.currentLastMove = null;
    this.currentSelection = null;
    this.lastMoveKey = "";
    this.previousBoardMap = null;
  }

  removePiece(square) {
    const mesh = this.pieceMeshes.get(square);

    if (!mesh) {
      return null;
    }

    this.pieceGroup.remove(mesh);
    this.pieceMeshes.delete(square);
    this.removePieceGroundShadow(square);
    this.removePieceHitbox(square);
    disposeObject3D(mesh);
    return {
      meshId: mesh.userData.meshId || "unknown",
      square,
      piece: `${mesh.userData.pieceColor}${mesh.userData.pieceType}`
    };
  }

  createPiece(piece, square) {
    const mesh = createArcanePiece(piece);
    const position = this.getSquarePosition(square);
    const anchorY = mesh.userData.anchorY || PIECE_ANCHOR_Y;
    this.meshSerial += 1;
    mesh.userData.meshId = `piece-${this.meshSerial}`;
    mesh.userData.square = square;
    mesh.position.set(position.x, anchorY, position.z);
    resetPiecePose(mesh);
    this.pieceGroup.add(mesh);
    this.pieceMeshes.set(square, mesh);
    this.createPieceGroundShadow(square, piece);
    this.createPieceHitbox(square, mesh);
    return mesh;
  }

  syncPieces(nextBoardMap, { reason = "sync", lastMove = null } = {}) {
    const beforeManaged = this.getManagedPieceSignature();
    const beforeScene = this.getScenePieceSignature();
    const shouldLog = reason !== "refresh" || Boolean(lastMove);
    const removed = [];
    const created = [];
    const moved = [];

    if (shouldLog) {
      this.logPieceSync("before-sync", {
        reason,
        lastMove,
        engineBoard: this.getBoardSignature(nextBoardMap),
        managedPieces: beforeManaged,
        scenePieces: beforeScene
      });
    }

    const seenMeshes = new Set();
    Array.from(this.pieceMeshes.entries()).forEach(([square, mesh]) => {
      if (!mesh || seenMeshes.has(mesh)) {
        this.pieceMeshes.delete(square);
        this.removePieceGroundShadow(square);
        this.removePieceHitbox(square);
        removed.push({
          meshId: mesh?.userData?.meshId || "unknown",
          square,
          piece: mesh
            ? `${mesh.userData.pieceColor}${mesh.userData.pieceType}`
            : "missing",
          reason: mesh ? "duplicate-reference" : "missing-mesh"
        });
        return;
      }

      seenMeshes.add(mesh);
    });

    Array.from(this.pieceMeshes.entries()).forEach(([square, mesh]) => {
      const targetPiece = nextBoardMap.get(square);
      const isMeshStillMounted = mesh?.parent === this.pieceGroup;
      const pieceMatches =
        Boolean(targetPiece) &&
        mesh.userData.pieceType === targetPiece.type &&
        mesh.userData.pieceColor === targetPiece.color;

      if (!isMeshStillMounted || !pieceMatches) {
        const removedRecord = this.removePiece(square);
        if (removedRecord) {
          removed.push({
            ...removedRecord,
            reason: !isMeshStillMounted ? "detached" : "mismatch"
          });
        }
      }
    });

    this.pruneOrphanMeshes(reason).forEach((entry) => removed.push(entry));

    nextBoardMap.forEach((piece, square) => {
      if (!piece) {
        return;
      }

      let mesh = this.pieceMeshes.get(square);

      if (!mesh) {
        mesh = this.createPiece(piece, square);
        created.push({
          meshId: mesh.userData.meshId,
          square,
          piece: `${piece.color}${piece.type}`
        });
      }

      mesh.userData.square = square;
      resetPiecePose(mesh);
      const position = this.getSquarePosition(square);
      const anchorY = mesh.userData.anchorY || PIECE_ANCHOR_Y;
      const positionChanged =
        Math.abs(mesh.position.x - position.x) > 0.0001 ||
        Math.abs(mesh.position.y - anchorY) > 0.0001 ||
        Math.abs(mesh.position.z - position.z) > 0.0001;

      if (positionChanged) {
        moved.push({
          meshId: mesh.userData.meshId,
          square,
          from: {
            x: Number(mesh.position.x.toFixed(3)),
            y: Number(mesh.position.y.toFixed(3)),
            z: Number(mesh.position.z.toFixed(3))
          },
          to: {
            x: Number(position.x.toFixed(3)),
            y: Number(anchorY.toFixed(3)),
            z: Number(position.z.toFixed(3))
          }
        });
      }

      mesh.position.set(position.x, anchorY, position.z);
      if (!this.pieceGroundShadows.has(square)) {
        this.createPieceGroundShadow(square, piece);
      } else {
        this.updatePieceGroundShadowPosition(square, position.x, position.z);
      }
      if (!this.pieceHitboxes.has(square)) {
        this.createPieceHitbox(square, mesh);
      } else {
        this.updatePieceHitboxPosition(square, position.x, position.z);
      }
    });

    this.pruneOrphanMeshes(`${reason}:post-create`).forEach((entry) => removed.push(entry));

    if (shouldLog || created.length || removed.length || moved.length) {
      this.logPieceSync("after-sync", {
        reason,
        lastMove,
        engineBoard: this.getBoardSignature(nextBoardMap),
        created,
        removed,
        moved,
        managedPieces: this.getManagedPieceSignature(),
        scenePieces: this.getScenePieceSignature()
      });
    }
  }

  animateMove(nextBoardMap, lastMove) {
    const movingMesh = this.pieceMeshes.get(lastMove.from);
    const movingShadow = this.pieceGroundShadows.get(lastMove.from);
    const movingHitbox = this.pieceHitboxes.get(lastMove.from);
    const nextPiece = nextBoardMap.get(lastMove.to);

    if (!movingMesh || !nextPiece) {
      this.syncPieces(nextBoardMap);
      return;
    }

    const captureSquare = this.getCaptureSquare(lastMove);
    const capturedMesh = captureSquare ? this.pieceMeshes.get(captureSquare) : null;
    const toPosition = this.getSquarePosition(lastMove.to);
    const fromPosition = this.getSquarePosition(lastMove.from);
    const movingAnchorY = movingMesh.userData.anchorY || PIECE_ANCHOR_Y;
    const movingTarget = new THREE.Vector3(toPosition.x, movingAnchorY, toPosition.z);
    const movingStart = new THREE.Vector3(
      fromPosition.x,
      movingMesh.position.y,
      fromPosition.z
    );
    const moveDirection = new THREE.Vector3().subVectors(toPosition, fromPosition);
    const moveDistance = Math.max(moveDirection.length(), 0.001);
    const directionX = moveDirection.x / moveDistance;
    const directionZ = moveDirection.z / moveDistance;

    if (captureSquare && capturedMesh) {
      this.pieceMeshes.delete(captureSquare);
      this.removePieceGroundShadow(captureSquare);
      this.removePieceHitbox(captureSquare);
      this.animateCapture(capturedMesh, captureSquare);
    }

    this.spawnMoveTrail(fromPosition, toPosition, 560, captureSquare ? 0xf0bf8c : 0xe7d4ad);
    this.queueCameraResponse(lastMove.to, {
      capture: Boolean(captureSquare && capturedMesh)
    });
    this.clearHoverState();
    this.pieceMeshes.delete(lastMove.from);
    this.pieceMeshes.set(lastMove.to, movingMesh);
    this.pieceGroundShadows.delete(lastMove.from);
    if (movingShadow) {
      movingShadow.userData.square = lastMove.to;
      this.pieceGroundShadows.set(lastMove.to, movingShadow);
    }
    this.pieceHitboxes.delete(lastMove.from);

    if (movingHitbox) {
      movingHitbox.userData.square = lastMove.to;
      this.pieceHitboxes.set(lastMove.to, movingHitbox);
    }

    const isCastling =
      nextPiece.type === "k" &&
      Math.abs(getFileIndex(lastMove.to) - getFileIndex(lastMove.from)) === 2;

    let rookAnimation = null;

    if (isCastling) {
      const isKingside = getFileIndex(lastMove.to) > getFileIndex(lastMove.from);
      const rookFrom = `${isKingside ? "h" : "a"}${lastMove.from[1]}`;
      const rookTo = `${isKingside ? "f" : "d"}${lastMove.from[1]}`;
      const rookMesh = this.pieceMeshes.get(rookFrom);
      const rookShadow = this.pieceGroundShadows.get(rookFrom);
      const rookHitbox = this.pieceHitboxes.get(rookFrom);

      if (rookMesh) {
        this.pieceMeshes.delete(rookFrom);
        this.pieceMeshes.set(rookTo, rookMesh);
        this.pieceGroundShadows.delete(rookFrom);
        if (rookShadow) {
          rookShadow.userData.square = rookTo;
          this.pieceGroundShadows.set(rookTo, rookShadow);
        }
        this.pieceHitboxes.delete(rookFrom);

        if (rookHitbox) {
          rookHitbox.userData.square = rookTo;
          this.pieceHitboxes.set(rookTo, rookHitbox);
        }

        rookAnimation = {
          mesh: rookMesh,
          shadow: rookShadow,
          hitbox: rookHitbox,
          from: this.getSquarePosition(rookFrom),
          to: this.getSquarePosition(rookTo),
          anchorY: rookMesh.userData.anchorY || PIECE_ANCHOR_Y
        };
      }
    }

    this.addAnimation({
      durationMs: 560,
      update: (progress) => {
        const travel = easeInOutCubic(progress);
        const lift = Math.sin(progress * Math.PI) * 0.54;
        const settleDip =
          progress > 0.76 ? Math.sin(((progress - 0.76) / 0.24) * Math.PI) * 0.062 : 0;
        const tilt = Math.sin(progress * Math.PI) * 0.12;
        const yaw = Math.sin(progress * Math.PI) * 0.055;

        movingMesh.position.set(
          THREE.MathUtils.lerp(movingStart.x, movingTarget.x, travel),
          movingAnchorY + lift - settleDip,
          THREE.MathUtils.lerp(movingStart.z, movingTarget.z, travel)
        );
        movingMesh.rotation.x = directionZ * tilt;
        movingMesh.rotation.y = yaw * directionX;
        movingMesh.rotation.z = -directionX * tilt;
        movingMesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.038);
        setObjectEmissiveBoost(movingMesh, 0.028 + Math.sin(progress * Math.PI) * 0.02);
        this.updatePieceGroundShadowPosition(lastMove.to, movingMesh.position.x, movingMesh.position.z);
        this.updatePieceHitboxPosition(lastMove.to, movingMesh.position.x, movingMesh.position.z);

        if (rookAnimation) {
          const rookTravel = easeInOutCubic(progress);
          rookAnimation.mesh.position.set(
            THREE.MathUtils.lerp(rookAnimation.from.x, rookAnimation.to.x, rookTravel),
            rookAnimation.anchorY + Math.sin(progress * Math.PI) * 0.18,
            THREE.MathUtils.lerp(rookAnimation.from.z, rookAnimation.to.z, rookTravel)
          );
          rookAnimation.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.018);
          if (rookAnimation.shadow) {
            this.updatePieceGroundShadowPosition(
              rookAnimation.shadow.userData.square,
              rookAnimation.mesh.position.x,
              rookAnimation.mesh.position.z
            );
          }

          if (rookAnimation.hitbox) {
            this.updatePieceHitboxPosition(
              rookAnimation.hitbox.userData.square,
              rookAnimation.mesh.position.x,
              rookAnimation.mesh.position.z
            );
          }
        }
      },
      complete: () => {
        movingMesh.position.copy(movingTarget);
        resetPiecePose(movingMesh);
        this.updatePieceGroundShadowPosition(lastMove.to, movingTarget.x, movingTarget.z);
        this.updatePieceHitboxPosition(lastMove.to, movingTarget.x, movingTarget.z);
        this.spawnSquarePulse(lastMove.to, {
          color: captureSquare ? 0xf4b497 : 0xf2d5a5,
          durationMs: captureSquare ? 460 : 400,
          maxScale: captureSquare ? 1.72 : 1.42,
          opacity: captureSquare ? 0.46 : 0.32
        });

        if (rookAnimation) {
          rookAnimation.mesh.position.set(
            rookAnimation.to.x,
            rookAnimation.anchorY,
            rookAnimation.to.z
          );
          resetPiecePose(rookAnimation.mesh);
          if (rookAnimation.shadow) {
            this.updatePieceGroundShadowPosition(
              rookAnimation.shadow.userData.square,
              rookAnimation.to.x,
              rookAnimation.to.z
            );
          }
          this.updatePieceHitboxPosition(rookAnimation.hitbox?.userData.square, rookAnimation.to.x, rookAnimation.to.z);
        }

        this.syncPieces(nextBoardMap, {
          reason: "move-complete",
          lastMove
        });
      }
    });
  }

  getCaptureSquare(lastMove) {
    if (!lastMove?.captured) {
      return null;
    }

    const previousTarget = this.previousBoardMap?.get(lastMove.to);

    if (previousTarget) {
      return lastMove.to;
    }

    if (lastMove.piece === "p" && lastMove.from[0] !== lastMove.to[0]) {
      const capturedRank = Number(lastMove.to[1]) + (lastMove.color === "white" ? -1 : 1);
      return `${lastMove.to[0]}${capturedRank}`;
    }

    return lastMove.to;
  }

  animateCapture(mesh, captureSquare = null) {
    const anchorY = mesh.userData.anchorY || PIECE_ANCHOR_Y;
    const startingScale = mesh.scale.x;

    if (captureSquare) {
      this.spawnSquarePulse(captureSquare, {
        color: 0xf09c8a,
        durationMs: 420,
        maxScale: 1.56,
        opacity: 0.34,
        innerSize: 0.15,
        outerSize: 0.34
      });
    }

    this.addAnimation({
      durationMs: 340,
      update: (progress) => {
        const eased = easeOutCubic(progress);
        const shimmer = Math.sin(progress * Math.PI) * 0.09;

        mesh.position.y = anchorY + 0.06 + eased * 0.22;
        mesh.rotation.x = shimmer;
        mesh.rotation.y = eased * 0.58;
        mesh.scale.setScalar(startingScale * (1 - eased * 0.48));
        cloneMaterialOpacity(mesh, 1 - eased * 0.96);
        setObjectEmissiveBoost(mesh, 0.08 + (1 - progress) * 0.08);
      },
      complete: () => {
        mesh.parent?.remove(mesh);
        disposeObject3D(mesh);
      }
    });
  }

  getCheckedKingState(gameState = this.currentGameState, boardMap = this.currentBoardMap) {
    const statusCode = gameState?.status?.code;
    const isCheck = Boolean(gameState?.isCheck) || CHECK_STATUS_CODES.has(statusCode);
    const checkedColor = gameState?.turn;

    if (!isCheck || (checkedColor !== "white" && checkedColor !== "black")) {
      return null;
    }

    for (const [square, piece] of boardMap.entries()) {
      if (piece?.type === "k" && piece.color === checkedColor) {
        return {
          square,
          color: checkedColor
        };
      }
    }

    return null;
  }

  updateCheckWarning(gameState = this.currentGameState, boardMap = this.currentBoardMap) {
    const checkedKingState = this.getCheckedKingState(gameState, boardMap);

    if (!checkedKingState?.square) {
      this.clearCheckWarning();
      return;
    }

    if (
      !this.checkWarningMarker ||
      this.checkWarningSquare !== checkedKingState.square ||
      this.checkedKingColor !== checkedKingState.color
    ) {
      this.clearCheckWarning();
      this.checkWarningMarker = this.createCheckWarningMarker();
      this.checkWarningGroup.add(this.checkWarningMarker);
    }

    this.checkWarningSquare = checkedKingState.square;
    this.checkedKingColor = checkedKingState.color;
    this.checkWarningMarker.position.copy(this.getSquarePosition(checkedKingState.square));
  }

  updatePieceSelectionState(selectedSquare, elapsed = this.elapsedTime) {
    const hasCheckWarning = Boolean(this.checkWarningSquare);
    const checkPulse = hasCheckWarning
      ? 0.028 + (Math.sin(elapsed * 4.8 + 0.3) * 0.5 + 0.5) * 0.038
      : 0;

    this.pieceMeshes.forEach((mesh, square) => {
      const isSelected = square === selectedSquare;
      const isCheckedKing = square === this.checkWarningSquare;
      const emissiveBoost = (isSelected ? 0.04 : 0) + (isCheckedKing ? checkPulse : 0);

      setObjectEmissiveBoost(mesh, emissiveBoost);
      setObjectEmissiveTint(mesh, isCheckedKing ? checkWarningColor : null);
    });
  }

  updateHighlights(lastMove, selectedSquare, legalTargets = []) {
    this.lastMoveHighlights.forEach((marker) => {
      this.squareHighlightGroup.remove(marker);
      disposeObject3D(marker);
    });
    this.lastMoveHighlights = [];

    if (this.selectionMarker) {
      this.selectionMarkerGroup.remove(this.selectionMarker);
      disposeObject3D(this.selectionMarker);
      this.selectionMarker = null;
    }

    this.targetMarkers.forEach((marker) => {
      this.targetMarkerGroup.remove(marker);
      disposeObject3D(marker);
    });
    this.targetMarkers = [];

    if (lastMove?.from) {
      const fromMarker = this.createSquareHighlight({
        color: 0x8aa0c5,
        fillOpacity: 0.05,
        ringOpacity: 0.12,
        size: 0.7,
        ringInner: 0.22,
        ringOuter: 0.31
      });
      fromMarker.position.copy(this.getSquarePosition(lastMove.from));
      this.squareHighlightGroup.add(fromMarker);
      this.lastMoveHighlights.push(fromMarker);
    }

    if (lastMove?.to) {
      const toMarker = this.createSquareHighlight({
        color: 0xe7b978,
        fillOpacity: 0.09,
        ringOpacity: 0.22,
        size: 0.82,
        ringInner: 0.25,
        ringOuter: 0.37
      });
      toMarker.position.copy(this.getSquarePosition(lastMove.to));
      this.squareHighlightGroup.add(toMarker);
      this.lastMoveHighlights.push(toMarker);
    }

    if (selectedSquare) {
      this.selectionMarker = this.createSelectionMarker();
      this.selectionMarker.position.copy(this.getSquarePosition(selectedSquare));
      this.selectionMarkerGroup.add(this.selectionMarker);
    }

    const uniqueTargets = new Map();
    legalTargets.forEach((move) => {
      if (!uniqueTargets.has(move.to)) {
        uniqueTargets.set(move.to, move);
      }
    });

    uniqueTargets.forEach((move) => {
      const marker = this.createTargetMarker(Boolean(move.captured));
      marker.position.copy(this.getSquarePosition(move.to));
      this.targetMarkerGroup.add(marker);
      this.targetMarkers.push(marker);
    });
  }

  addAnimation(animation) {
    this.animations.push({
      ...animation,
      startTime: performance.now()
    });
  }

  animate() {
    const delta = this.clock.getDelta();
    this.elapsedTime += delta;
    const now = performance.now();
    const hadAnimations = this.animations.length > 0;

    this.updateAnimations(now);

    if (!this.isViewActive && !hadAnimations) {
      return;
    }

    if (this.isViewActive) {
      this.updateAmbientMotion(this.elapsedTime);
      this.updateCameraMotion(delta);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.updateCameraMotion(delta);
  }

  updateAmbientMotion(elapsed) {
    this.floorMist.material.opacity = 0.048 + Math.sin(elapsed * 0.15) * 0.005;
    this.floorMist.scale.setScalar(1 + Math.sin(elapsed * 0.12) * 0.01);
    this.midGroundBand.material.opacity = 0.015 + Math.sin(elapsed * 0.11 + 0.4) * 0.0024;
    this.emberDisc.material.opacity = 0.04 + Math.sin(elapsed * 0.19 + 0.5) * 0.0045;
    this.outerGlowRing.material.opacity = 0.025 + Math.sin(elapsed * 0.17 + 1.2) * 0.0032;
    this.boardAura.material.opacity = 0.042 + Math.sin(elapsed * 0.22) * 0.0045;
    this.altarHalo.material.opacity = 0.052 + Math.sin(elapsed * 0.27 + 0.4) * 0.0045;
    this.roomHalo.material.opacity = 0.021 + Math.sin(elapsed * 0.09 + 1.1) * 0.0022;
    this.vaultHaze.material.opacity = 0.016 + Math.sin(elapsed * 0.08 + 0.6) * 0.0018;
    this.wallVeil.material.opacity = 0.22 + Math.sin(elapsed * 0.07 + 0.5) * 0.008;
    this.boardUnderGlow.material.opacity = 0.046 + Math.sin(elapsed * 0.25 + 0.6) * 0.0042;
    this.boardRearVeil.material.opacity = 0.074 + Math.sin(elapsed * 0.14 + 0.35) * 0.004;

    this.ceremonialLight.intensity =
      (this.ceremonialLight.userData.baseIntensity ?? this.ceremonialLight.intensity) +
      Math.sin(elapsed * 0.18) * 0.02;
    this.boardFocusLight.intensity =
      (this.boardFocusLight.userData.baseIntensity ?? this.boardFocusLight.intensity) +
      Math.sin(elapsed * 0.12 + 0.4) * 0.016;
    this.boardLiftLight.intensity =
      (this.boardLiftLight.userData.baseIntensity ?? this.boardLiftLight.intensity) +
      Math.sin(elapsed * 0.16 + 0.25) * 0.01;
    this.moonRimLight.intensity =
      (this.moonRimLight.userData.baseIntensity ?? this.moonRimLight.intensity) +
      Math.sin(elapsed * 0.14 + 0.9) * 0.014;
    this.rearRimLight.intensity =
      (this.rearRimLight.userData.baseIntensity ?? this.rearRimLight.intensity) +
      Math.sin(elapsed * 0.16 + 1.1) * 0.012;
    this.frontFillLight.intensity =
      (this.frontFillLight.userData.baseIntensity ?? this.frontFillLight.intensity) +
      Math.sin(elapsed * 0.2 + 0.35) * 0.01;
    this.coolBackLight.intensity =
      (this.coolBackLight.userData.baseIntensity ?? this.coolBackLight.intensity) +
      Math.sin(elapsed * 0.21) * 0.01;
    this.warmFillLight.intensity =
      (this.warmFillLight.userData.baseIntensity ?? this.warmFillLight.intensity) +
      Math.sin(elapsed * 0.17 + 0.8) * 0.01;
    this.vaultLight.intensity =
      (this.vaultLight.userData.baseIntensity ?? this.vaultLight.intensity) +
      Math.sin(elapsed * 0.12 + 0.2) * 0.006;
    this.apseLight.intensity =
      (this.apseLight.userData.baseIntensity ?? this.apseLight.intensity) +
      Math.sin(elapsed * 0.1 + 1.7) * 0.006;
    this.crownLight.intensity =
      (this.crownLight.userData.baseIntensity ?? this.crownLight.intensity) +
      Math.sin(elapsed * 0.2) * 0.005;
    this.whiteZoneLight.intensity =
      (this.whiteZoneLight.userData.baseIntensity ?? this.whiteZoneLight.intensity) +
      Math.sin(elapsed * 0.34 + 0.25) * 0.018;
    this.blackZoneLight.intensity =
      (this.blackZoneLight.userData.baseIntensity ?? this.blackZoneLight.intensity) +
      Math.sin(elapsed * 0.31 + 1.1) * 0.02;
    this.blackReadFillLight.intensity =
      (this.blackReadFillLight.userData.baseIntensity ?? this.blackReadFillLight.intensity) +
      Math.sin(elapsed * 0.22 + 0.8) * 0.012;
    this.blackPieceRimLight.intensity =
      (this.blackPieceRimLight.userData.baseIntensity ?? this.blackPieceRimLight.intensity) +
      Math.sin(elapsed * 0.18 + 1.4) * 0.01;
    if (this.checkWarningMarker) {
      const pulse = Math.sin(elapsed * 4.8 + 0.3) * 0.5 + 0.5;
      const glow = this.checkWarningMarker.userData.glow;
      const innerRing = this.checkWarningMarker.userData.innerRing;
      const outerRing = this.checkWarningMarker.userData.outerRing;

      glow.scale.setScalar(0.96 + pulse * 0.1);
      innerRing.scale.setScalar(0.94 + pulse * 0.18);
      outerRing.scale.setScalar(0.98 + pulse * 0.24);
      setMeshOpacityFromBase(glow, 0.9 + pulse * 0.44);
      setMeshOpacityFromBase(innerRing, 0.9 + pulse * 0.5);
      setMeshOpacityFromBase(outerRing, 0.72 + pulse * 0.42);
    }
    this.updatePieceSelectionState(this.currentSelection, elapsed);
    this.updateSceneFoundationMotion(elapsed);

    this.squareTiles.forEach((tile, square) => {
      const material = tile.material;

      if (!material?.userData?.baseColor) {
        return;
      }

      const viewerDepth =
        (this.playerPerspective === "white" ? 1 : -1) * (material.userData.viewerDepth ?? 0);
      const farWeight = clampValue((1 - viewerDepth) / 2, 0, 1);
      const nearWeight = 1 - farWeight;
      const radialWeight = material.userData.radialWeight ?? 0;
      const edgeWeight = material.userData.edgeWeight ?? 0;
      const shimmer =
        Math.sin(elapsed * 0.72 + (material.userData.shimmerOffset ?? 0)) * 0.0038;

      let visibilityLift =
        radialWeight * 0.018 +
        farWeight * 0.024 -
        edgeWeight * 0.004 +
        shimmer;
      let emissiveBoost = radialWeight * 0.012 + farWeight * 0.016;
      let polishBoost = radialWeight * 0.11 + nearWeight * 0.035;

      if (square === this.currentLastMove?.from) {
        visibilityLift += 0.01;
        emissiveBoost += 0.008;
      }

      if (square === this.currentLastMove?.to) {
        visibilityLift += 0.024;
        emissiveBoost += 0.014;
        polishBoost += 0.04;
      }

      if (square === this.currentSelection) {
        visibilityLift += 0.022;
        emissiveBoost += 0.012;
        polishBoost += 0.06;
      }

      if (this.currentLegalTargetSquares.has(square)) {
        visibilityLift += 0.014;
        emissiveBoost += 0.01;
      }

      squareSurfaceColor.copy(material.userData.baseColor);
      squareSurfaceColor.offsetHSL(
        0,
        material.userData.isDarkSquare ? farWeight * 0.01 : radialWeight * 0.004,
        visibilityLift
      );
      material.color.copy(squareSurfaceColor);
      material.emissiveIntensity = clampValue(
        (material.userData.baseEmissiveIntensity ?? 0) + emissiveBoost,
        0,
        0.16
      );
      material.roughness = clampValue(
        (material.userData.baseRoughness ?? material.roughness ?? 0.45) -
          radialWeight * 0.075 -
          nearWeight * 0.03 +
          farWeight * 0.018,
        0.18,
        0.88
      );
      material.specularIntensity = clampValue(
        (material.userData.baseSpecularIntensity ?? material.specularIntensity ?? 0.35) +
          polishBoost,
        0,
        1.2
      );
      material.clearcoat = clampValue(
        (material.userData.baseClearcoat ?? material.clearcoat ?? 0.2) +
          radialWeight * 0.08 +
          (square === this.currentSelection ? 0.04 : 0),
        0,
        1
      );
      material.clearcoatRoughness = clampValue(
        (material.userData.baseClearcoatRoughness ?? material.clearcoatRoughness ?? 0.4) -
          radialWeight * 0.07,
        0.08,
        1
      );
    });

    this.targetMarkers.forEach((marker, index) => {
      const wave = elapsed * 3.1 + index * 0.55;
      const scale = marker.userData.capture ? 1.02 + Math.sin(wave) * 0.08 : 1 + Math.sin(wave) * 0.06;
      marker.scale.setScalar(scale);
      marker.userData.core.material.opacity =
        (marker.userData.core.material.userData.baseOpacity ?? 0.3) * (0.88 + Math.sin(wave) * 0.12);
      marker.userData.ring.material.opacity =
        (marker.userData.ring.material.userData.baseOpacity ?? 0.2) * (0.84 + Math.sin(wave + 0.2) * 0.16);
    });

    this.lastMoveHighlights.forEach((marker, index) => {
      const wave = elapsed * 2.2 + index * 0.45;
      const pulse = 0.94 + Math.sin(wave) * 0.06;
      marker.scale.setScalar(pulse);
      setObjectMaterialOpacity(marker, 0.9 + Math.sin(wave) * 0.08);
    });

    if (this.selectionMarker) {
      const pulse = 1.02 + Math.sin(elapsed * 3.6) * 0.05;
      this.selectionMarker.scale.setScalar(pulse);
      setObjectMaterialOpacity(this.selectionMarker, 0.94 + Math.sin(elapsed * 3.6) * 0.12);
    }
  }

  updateCameraMotion(delta) {
    const driftAlpha = 1 - Math.exp(-delta * 5.2);
    const targetDecay = Math.exp(-delta * 1.7);
    const kickDecay = Math.exp(-delta * 5.8);

    if (this.viewIntroProgress < 1) {
      this.viewIntroProgress = Math.min(1, this.viewIntroProgress + delta / 0.92);
    }

    this.cameraDrift.lerp(this.cameraDriftTarget, driftAlpha);
    this.cameraDriftTarget.multiplyScalar(targetDecay);
    this.cameraKick.multiplyScalar(kickDecay);
    this.applyCameraTransform();
  }

  updateSceneFoundationMotion(elapsed) {
    this.sceneFoundation?.pillars?.forEach((pillar) => {
      const pulse = Math.sin(elapsed * 0.42 + pillar.phase);

      pillar.crownGlow.material.opacity = 0.074 + pulse * 0.018;
      pillar.crownGlow.rotation.y = Math.sin(elapsed * 0.18 + pillar.phase) * 0.08;
      pillar.eyeGlow.material.opacity = 0.11 + pulse * 0.026;
      pillar.chestSigil.material.opacity = 0.09 + Math.sin(elapsed * 0.36 + pillar.phase * 1.2) * 0.02;
    });

    const activeTurn =
      this.currentGameState?.turn === "white" || this.currentGameState?.turn === "black"
        ? this.currentGameState.turn
        : null;

    this.sceneFoundation?.duelists?.forEach((duelist) => {
      const sideScalar = duelist.side === "white" ? -1 : 1;
      const activePresence = activeTurn ? (duelist.side === activeTurn ? 1 : 0.9) : 0.94;
      const breath = Math.sin(elapsed * 1.02 + duelist.phase) * 0.026 * activePresence;
      const sway = Math.sin(elapsed * 0.42 + duelist.phase * 0.7) * 0.028;
      const torsoTurn = Math.sin(elapsed * 0.24 + duelist.phase * 1.1) * 0.034;
      const headTilt = Math.sin(elapsed * 0.34 + duelist.phase + 0.45) * 0.012;
      const armDrift = Math.sin(elapsed * 0.48 + duelist.phase + 0.3) * 0.016;
      const auraPulse =
        0.96 +
        Math.sin(elapsed * 0.78 + duelist.phase) * 0.05 +
        (activeTurn && duelist.side === activeTurn ? 0.04 : 0);

      duelist.characterAnchor.position.y = duelist.baseAnchorY;
      duelist.characterAnchor.rotation.y = duelist.baseRotationY + torsoTurn * 0.18;
      duelist.motionRoot.position.set(
        sideScalar * Math.sin(elapsed * 0.3 + duelist.phase * 0.9) * 0.02,
        breath,
        0
      );
      duelist.bodyRoot.rotation.x = -0.012 + Math.sin(elapsed * 0.28 + duelist.phase * 1.2) * 0.007;
      duelist.bodyRoot.rotation.z = sway * 0.12 * sideScalar;
      duelist.torsoPivot.rotation.y = torsoTurn * 0.55;
      duelist.torsoPivot.rotation.z = sway * 0.06 * sideScalar;
      duelist.headPivot.rotation.x = -0.05 + headTilt;
      duelist.headPivot.rotation.y = torsoTurn * 0.85;
      duelist.leftArmPivot.rotation.x = -0.08 + armDrift * 0.32;
      duelist.leftArmPivot.rotation.z = -sideScalar * 0.06 + sway * 0.05;
      duelist.rightArmPivot.rotation.x = 0.02 + armDrift * 0.26;
      duelist.rightArmPivot.rotation.z = sideScalar * 0.08 - sway * 0.04;
      duelist.staffPivot.rotation.x = 0.04 + Math.sin(elapsed * 0.42 + duelist.phase + 0.2) * 0.009;
      duelist.staffPivot.rotation.z = -0.05 + Math.sin(elapsed * 0.56 + duelist.phase) * 0.012;
      duelist.cloakFront.rotation.x = -0.08 + Math.sin(elapsed * 0.64 + duelist.phase) * 0.012;
      duelist.cloakBack.rotation.x = 0.08 + Math.sin(elapsed * 0.54 + duelist.phase + 0.55) * 0.016;
      duelist.crownGlow.scale.setScalar(0.99 + Math.sin(elapsed * 0.82 + duelist.phase) * 0.014 * activePresence);
      duelist.orbitSigil.scale.setScalar(0.99 + Math.sin(elapsed * 0.64 + duelist.phase + 0.4) * 0.011 * activePresence);

      setMeshOpacityFromBase(duelist.haloDisc, auraPulse * 0.88);
      setMeshOpacityFromBase(duelist.sigilRing, auraPulse);
      setMeshOpacityFromBase(duelist.beam, 0.94 + (auraPulse - 0.92) * 0.6);
      setMeshOpacityFromBase(duelist.hemGlow, 0.94 + (auraPulse - 0.92) * 0.7);
      setMeshOpacityFromBase(duelist.chestSigil, 0.96 + (auraPulse - 0.92) * 0.8);
      setMeshOpacityFromBase(duelist.backHalo, 0.9 + (auraPulse - 0.92) * 0.7);
      setMeshOpacityFromBase(duelist.staffCrystalGlow, 0.92 + (auraPulse - 0.92) * 0.8);
      setMeshOpacityFromBase(duelist.leftHandGlow, 0.94 + (auraPulse - 0.92) * 0.6);
      setMeshOpacityFromBase(duelist.rightHandGlow, 0.96 + (auraPulse - 0.92) * 0.7);
      setTransparentDescendantOpacity(duelist.crownGlow, 0.92 + (auraPulse - 0.92) * 0.8);
      setTransparentDescendantOpacity(duelist.orbitSigil, 0.92 + (auraPulse - 0.92) * 0.7);

      if (duelist.presenceKeyLight) {
        duelist.presenceKeyLight.intensity =
          (duelist.presenceKeyLight.userData.baseIntensity ?? duelist.presenceKeyLight.intensity) *
          (0.96 + (auraPulse - 0.96) * 0.9 + (activeTurn && duelist.side === activeTurn ? 0.06 : 0));
      }

      if (duelist.presenceRimLight) {
        duelist.presenceRimLight.intensity =
          (duelist.presenceRimLight.userData.baseIntensity ?? duelist.presenceRimLight.intensity) *
          (0.94 + (auraPulse - 0.96) * 0.7 + (activeTurn && duelist.side === activeTurn ? 0.04 : 0));
      }
    });

    this.sceneFoundation?.torches?.forEach((torch) => {
      const flicker =
        Math.sin(elapsed * 4.8 + torch.phase) * 0.08 +
        Math.sin(elapsed * 7.6 + torch.phase * 1.7) * 0.05;
      const flameLift = Math.sin(elapsed * 3.2 + torch.phase) * 0.06;

      torch.flameCore.position.y = 3.82 + flameLift;
      torch.flameCore.scale.setScalar(1 + flicker * 0.36);
      torch.flameGlow.position.y = 3.92 + flameLift * 0.72;
      torch.flameGlow.material.opacity = 0.32 + flicker * 0.24;
      torch.flameGlow.scale.set(1 + flicker * 0.2, 1 + flicker * 0.28, 1);
      torch.flameCross.position.y = 3.88 + flameLift * 0.66;
      torch.flameCross.material.opacity = 0.27 + flicker * 0.2;
      torch.flameCross.scale.set(1 + flicker * 0.16, 1 + flicker * 0.22, 1);
      torch.emberHalo.material.opacity = 0.22 + flicker * 0.14;
      torch.emberHalo.scale.setScalar(1 + flicker * 0.24);
      torch.wallGlow.material.opacity = 0.18 + flicker * 0.2;
      torch.wallGlow.scale.set(1 + flicker * 0.08, 1 + flicker * 0.12, 1);
      torch.heatColumn.position.y = 4.34 + flameLift * 0.84;
      torch.heatColumn.material.opacity = 0.12 + flicker * 0.14;
      torch.heatColumn.scale.set(1 + flicker * 0.12, 1 + flicker * 0.22, 1);
      torch.light.intensity =
        (torch.light.userData.baseIntensity ?? torch.light.intensity) + flicker * 0.22;

      if (torch.shadowLight) {
        torch.shadowLight.intensity =
          (torch.shadowLight.userData.baseIntensity ?? torch.shadowLight.intensity) + flicker * 0.18;
      }
    });
  }

  updateAnimations(now) {
    this.animations = this.animations.filter((animation) => {
      const progress = Math.min(1, (now - animation.startTime) / animation.durationMs);
      animation.update(progress);

      if (progress < 1) {
        return true;
      }

      animation.complete?.();
      return false;
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener("pointerdown", this.boundPointerDown);
    this.resizeObserver?.disconnect?.();
    if (this.resizeFrameId) {
      cancelAnimationFrame(this.resizeFrameId);
      this.resizeFrameId = null;
    }
    this.clearPieces();
    this.clearTransientEffects();
    this.clearEffectGroup(this.squareHighlightGroup);
    this.clearEffectGroup(this.selectionMarkerGroup);
    this.clearEffectGroup(this.targetMarkerGroup);
    this.clearEffectGroup(this.checkWarningGroup);
    this.squareHitboxes.forEach((hitbox) => {
      toMaterialArray(hitbox.material).forEach((material) => material.dispose?.());
    });
    this.squareHitboxGeometry?.dispose?.();
    this.squareHitboxMaterial?.dispose?.();
    this.pieceHitboxMaterial?.dispose?.();
    this.renderer.dispose();
  }
}

export { ArcaneBoard3D };
