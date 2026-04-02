import * as THREE from "/vendor/three/three.module.js";
import { createArcanePiece } from "./pieceFactory.js";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const BOARD_HALF = (BOARD_SIZE - 1) / 2;
const BOARD_TOP_Y = 0.17;
const PIECE_ANCHOR_Y = 0.15;
const HIGHLIGHT_Y = BOARD_TOP_Y + 0.02;
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

const toMaterialArray = (material) => (Array.isArray(material) ? material : [material]);

const registerGlowMaterial = (material) => {
  material.userData.baseOpacity = material.opacity ?? 1;
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
    this.scene.fog = new THREE.Fog(0x151116, 8.1, 24.6);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 72);
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
    this.pieceGroup = new THREE.Group();
    this.boardRoot.add(this.pieceGroup);

    this.squareTiles = new Map();
    this.squareHitboxes = new Map();
    this.targetMarkers = [];
    this.lastMoveHighlights = [];
    this.selectionMarker = null;
    this.pieceMeshes = new Map();
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
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.meshSerial = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.boundPointerDown = (event) => this.handlePointerSelect(event);
    this.resizeFrameId = null;
    this.resizeObserver = null;

    this.buildLighting();
    this.buildAtmosphere();
    this.buildBoard();
    this.buildHighlights();
    this.buildInteractionLayer();
    this.bindPointerEvents();
    this.bindResizeObserver();
    this.resize({ immediate: true });
    this.renderer.setAnimationLoop(() => this.animate());
  }

  buildLighting() {
    const ambient = new THREE.HemisphereLight(0xf0e5d6, 0x271d18, 0.98);
    ambient.position.set(0, 12, 0);
    this.scene.add(ambient);
    this.ambientLight = ambient;

    const ceremonialLight = new THREE.DirectionalLight(0xffdfbc, 1.26);
    ceremonialLight.position.set(5.8, 11.1, 6.9);
    ceremonialLight.castShadow = true;
    ceremonialLight.shadow.mapSize.set(1536, 1536);
    ceremonialLight.shadow.camera.near = 0.5;
    ceremonialLight.shadow.camera.far = 32;
    ceremonialLight.shadow.camera.left = -7.75;
    ceremonialLight.shadow.camera.right = 7.75;
    ceremonialLight.shadow.camera.top = 7.75;
    ceremonialLight.shadow.camera.bottom = -7.75;
    ceremonialLight.shadow.bias = -0.00032;
    ceremonialLight.shadow.normalBias = 0.018;
    this.scene.add(ceremonialLight);
    this.ceremonialLight = ceremonialLight;

    const moonRim = new THREE.DirectionalLight(0xc8d8ef, 0.38);
    moonRim.position.set(-5.6, 7.1, -7.2);
    this.scene.add(moonRim);
    this.moonRimLight = moonRim;

    const warmFill = new THREE.PointLight(0xe7b97f, 0.18, 16, 2);
    warmFill.position.set(-2.4, 4.8, 4.2);
    this.scene.add(warmFill);
    this.warmFillLight = warmFill;

    const coolBack = new THREE.PointLight(0x9eb8dd, 0.28, 18, 2);
    coolBack.position.set(2.2, 5.3, -5.8);
    this.scene.add(coolBack);
    this.coolBackLight = coolBack;

    const crownLight = new THREE.PointLight(0xffeed0, 0.08, 10, 2);
    crownLight.position.set(0, 6.5, 0.2);
    this.scene.add(crownLight);
    this.crownLight = crownLight;

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
      new THREE.CircleGeometry(10.4, 64),
      new THREE.MeshStandardMaterial({
        color: 0x120f11,
        roughness: 0.98,
        metalness: 0.01
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.04;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorDisc = floor;

    const boardGroundShadow = new THREE.Mesh(
      new THREE.CircleGeometry(5.65, 56),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
      })
    );
    boardGroundShadow.rotation.x = -Math.PI / 2;
    boardGroundShadow.position.y = -1.02;
    this.scene.add(boardGroundShadow);
    this.boardGroundShadow = boardGroundShadow;

    const floorMist = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 10.15, 72),
      createGlowMaterial(0x56463b, 0.046)
    );
    floorMist.rotation.x = -Math.PI / 2;
    floorMist.position.y = -0.7;
    floorMist.renderOrder = 0;
    this.scene.add(floorMist);
    this.floorMist = floorMist;

    const emberDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 56),
      createGlowMaterial(0xd2ab72, 0.042)
    );
    emberDisc.rotation.x = -Math.PI / 2;
    emberDisc.position.y = -0.63;
    emberDisc.renderOrder = 0;
    this.scene.add(emberDisc);
    this.emberDisc = emberDisc;

    const outerGlowRing = new THREE.Mesh(
      new THREE.RingGeometry(5.3, 7.95, 72),
      createGlowMaterial(0x6983a8, 0.024)
    );
    outerGlowRing.rotation.x = -Math.PI / 2;
    outerGlowRing.position.y = -0.61;
    outerGlowRing.renderOrder = 0;
    this.scene.add(outerGlowRing);
    this.outerGlowRing = outerGlowRing;

    const boardAura = new THREE.Mesh(
      new THREE.CircleGeometry(4.95, 56),
      createGlowMaterial(0xffddb0, 0.038)
    );
    boardAura.rotation.x = -Math.PI / 2;
    boardAura.position.y = -0.06;
    boardAura.renderOrder = 1;
    this.scene.add(boardAura);
    this.boardAura = boardAura;

    const altarHalo = new THREE.Mesh(
      new THREE.RingGeometry(4.22, 5.04, 72),
      createGlowMaterial(0xd1a16a, 0.05)
    );
    altarHalo.rotation.x = -Math.PI / 2;
    altarHalo.position.y = -0.13;
    altarHalo.renderOrder = 1;
    this.scene.add(altarHalo);
    this.altarHalo = altarHalo;
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
      emissiveIntensity: 0.03
    });
    const metalBandMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb18a62,
      roughness: 0.24,
      metalness: 0.64,
      clearcoat: 0.72,
      clearcoatRoughness: 0.18,
      emissive: 0x2b180d,
      emissiveIntensity: 0.05
    });
    const boardWoodMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3b2a1f,
      roughness: 0.44,
      metalness: 0.04,
      clearcoat: 0.62,
      clearcoatRoughness: 0.24,
      emissive: 0x130d0a,
      emissiveIntensity: 0.02
    });
    const insetStoneMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1d1713,
      roughness: 0.7,
      metalness: 0.03,
      clearcoat: 0.22,
      clearcoatRoughness: 0.62,
      emissive: 0x100b09,
      emissiveIntensity: 0.04
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
      createGlowMaterial(0xf0c48c, 0.045)
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
      emissiveIntensity: 0.05
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
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.26,
      clearcoatRoughness: 0.44,
      specularIntensity: 0.4,
      sheen: 0.06,
      sheenColor: 0xf5e8d2,
      sheenRoughness: 0.46,
      emissive: 0x16100c,
      emissiveIntensity: 0.014,
      saturationShift: 0.014,
      lightnessShift: 0.014
    });
    const darkSquareMaterials = createSquareMaterialVariants(0x47342a, {
      roughness: 0.48,
      metalness: 0.04,
      clearcoat: 0.18,
      clearcoatRoughness: 0.52,
      specularIntensity: 0.36,
      sheen: 0.03,
      sheenColor: 0xa49383,
      sheenRoughness: 0.54,
      emissive: 0x0d0907,
      emissiveIntensity: 0.015,
      saturationShift: 0.012,
      lightnessShift: 0.012
    });

    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE * 0.985, 0.11, SQUARE_SIZE * 0.985);

    for (let rank = 1; rank <= BOARD_SIZE; rank += 1) {
      for (let file = 0; file < BOARD_SIZE; file += 1) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const variationIndex = (file * 3 + rank) % 6;
        const tile = new THREE.Mesh(
          squareGeometry,
          (file + rank) % 2 === 0
            ? darkSquareMaterials[variationIndex]
            : lightSquareMaterials[variationIndex]
        );

        tile.position.copy(this.getSquarePosition(square));
        tile.position.y = BOARD_TOP_Y / 2;
        tile.receiveShadow = true;
        tile.castShadow = false;
        tile.renderOrder = 2;
        this.boardRoot.add(tile);
        this.squareTiles.set(square, tile);
      }
    }
  }

  buildHighlights() {
    this.squareHighlightGroup = new THREE.Group();
    this.selectionMarkerGroup = new THREE.Group();
    this.targetMarkerGroup = new THREE.Group();
    this.transientEffectGroup = new THREE.Group();
    this.boardRoot.add(this.squareHighlightGroup);
    this.boardRoot.add(this.selectionMarkerGroup);
    this.boardRoot.add(this.targetMarkerGroup);
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

    this.pieceGroup.remove(mesh);
    disposeObject3D(mesh);

    return {
      meshId: mesh.userData.meshId || "unknown",
      square: mesh.userData.square || "?",
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
    const aspect = this.camera.aspect || 1;
    const portraitBias = aspect < 1 ? 1 - aspect : 0;
    const widescreenBias = aspect > 1.2 ? Math.min(aspect - 1.2, 0.7) : 0;

    this.camera.fov = aspect < 0.94 ? 39.6 : aspect > 1.2 ? 36.5 : 37.6;
    this.cameraRestPosition.set(
      0,
      9.08 + portraitBias * 0.92 - widescreenBias * 0.1,
      9.18 + portraitBias * 0.78 - widescreenBias * 0.38
    );
    this.cameraRestLookAt.set(
      0,
      0.5 + portraitBias * 0.05,
      0.02 - widescreenBias * 0.03
    );

    if (immediate) {
      this.camera.position.copy(this.cameraRestPosition);
      this.cameraFocusPoint.copy(this.cameraRestLookAt);
      this.camera.lookAt(this.cameraFocusPoint);
    }
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

    this.isViewActive = viewMode === "3d";
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

    const focus = this.getSquarePosition(square);
    this.cameraDriftTarget.set(
      THREE.MathUtils.clamp(focus.x * 0.07, -0.22, 0.22),
      capture ? 0.08 : 0.04,
      THREE.MathUtils.clamp(focus.z * 0.05, -0.18, 0.18)
    );
    this.cameraKick.x += THREE.MathUtils.clamp(-focus.x * 0.012, -0.05, 0.05);
    this.cameraKick.y += capture ? 0.08 : 0.035;
    this.cameraKick.z += capture ? 0.12 : 0.055;
  }

  clearPieces() {
    this.resetPresentationState();
    this.pieceGroup.children.slice().forEach((mesh) => {
      this.pieceGroup.remove(mesh);
      disposeObject3D(mesh);
    });
    this.pieceHitboxes.forEach((hitbox) => {
      this.interactionGroup.remove(hitbox);
      disposeObject3D(hitbox);
    });

    this.pieceMeshes.clear();
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

  resetPresentationState() {
    this.clearTransientEffects();
    this.clearHoverState();
    this.updateHighlights(null, null, []);
    this.updatePieceSelectionState(null);
    this.cameraDrift.set(0, 0, 0);
    this.cameraDriftTarget.set(0, 0, 0);
    this.cameraKick.set(0, 0, 0);
    this.camera.position.copy(this.cameraRestPosition);
    this.cameraFocusPoint.copy(this.cameraRestLookAt);
    this.camera.lookAt(this.cameraFocusPoint);
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
      const rookHitbox = this.pieceHitboxes.get(rookFrom);

      if (rookMesh) {
        this.pieceMeshes.delete(rookFrom);
        this.pieceMeshes.set(rookTo, rookMesh);
        this.pieceHitboxes.delete(rookFrom);

        if (rookHitbox) {
          rookHitbox.userData.square = rookTo;
          this.pieceHitboxes.set(rookTo, rookHitbox);
        }

        rookAnimation = {
          mesh: rookMesh,
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
        this.updatePieceHitboxPosition(lastMove.to, movingMesh.position.x, movingMesh.position.z);

        if (rookAnimation) {
          const rookTravel = easeInOutCubic(progress);
          rookAnimation.mesh.position.set(
            THREE.MathUtils.lerp(rookAnimation.from.x, rookAnimation.to.x, rookTravel),
            rookAnimation.anchorY + Math.sin(progress * Math.PI) * 0.18,
            THREE.MathUtils.lerp(rookAnimation.from.z, rookAnimation.to.z, rookTravel)
          );
          rookAnimation.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.018);

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

  updatePieceSelectionState(selectedSquare) {
    this.pieceMeshes.forEach((mesh, square) => {
      setObjectEmissiveBoost(mesh, square === selectedSquare ? 0.04 : 0);
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
    this.floorMist.material.opacity = 0.04 + Math.sin(elapsed * 0.15) * 0.004;
    this.floorMist.scale.setScalar(1 + Math.sin(elapsed * 0.12) * 0.008);
    this.emberDisc.material.opacity = 0.036 + Math.sin(elapsed * 0.19 + 0.5) * 0.004;
    this.outerGlowRing.material.opacity = 0.022 + Math.sin(elapsed * 0.17 + 1.2) * 0.003;
    this.boardAura.material.opacity = 0.034 + Math.sin(elapsed * 0.22) * 0.004;
    this.altarHalo.material.opacity = 0.045 + Math.sin(elapsed * 0.27 + 0.4) * 0.004;
    this.boardUnderGlow.material.opacity = 0.038 + Math.sin(elapsed * 0.25 + 0.6) * 0.004;

    this.ceremonialLight.intensity = 1.26 + Math.sin(elapsed * 0.18) * 0.018;
    this.moonRimLight.intensity = 0.38 + Math.sin(elapsed * 0.14 + 0.9) * 0.012;
    this.coolBackLight.intensity = 0.28 + Math.sin(elapsed * 0.21) * 0.008;
    this.warmFillLight.intensity = 0.18 + Math.sin(elapsed * 0.17 + 0.8) * 0.007;
    this.crownLight.intensity = 0.08 + Math.sin(elapsed * 0.2) * 0.004;

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

    this.cameraDrift.lerp(this.cameraDriftTarget, driftAlpha);
    this.cameraDriftTarget.multiplyScalar(targetDecay);
    this.cameraKick.multiplyScalar(kickDecay);

    this.camera.position.set(
      this.cameraRestPosition.x + this.cameraDrift.x * 0.26 + this.cameraKick.x,
      this.cameraRestPosition.y + this.cameraDrift.y * 0.1 + this.cameraKick.y,
      this.cameraRestPosition.z + this.cameraDrift.z * 0.22 + this.cameraKick.z
    );
    this.cameraFocusPoint.set(
      this.cameraRestLookAt.x + this.cameraDrift.x * 0.7,
      this.cameraRestLookAt.y + this.cameraDrift.y * 0.18,
      this.cameraRestLookAt.z + this.cameraDrift.z * 0.5
    );
    this.camera.lookAt(this.cameraFocusPoint);
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
