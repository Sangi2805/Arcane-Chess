import * as THREE from "/vendor/three/three.module.js";
import { createArcanePiece } from "./pieceFactory.js";

const BOARD_SIZE = 8;
const SQUARE_SIZE = 1;
const BOARD_HALF = (BOARD_SIZE - 1) / 2;
const BOARD_TOP_Y = 0.17;
const PIECE_ANCHOR_Y = 0.15;
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

const toMaterialArray = (material) => (Array.isArray(material) ? material : [material]);

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

const resetPiecePose = (mesh) => {
  mesh.rotation.set(0, 0, 0);
  mesh.scale.setScalar(1);
  cloneMaterialOpacity(mesh, 1);
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
    this.scene.fog = new THREE.Fog(0x15110e, 9.4, 25.8);

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
    this.renderer.toneMappingExposure = 0.94;
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
    const ambient = new THREE.HemisphereLight(0xe8ddd0, 0x33271f, 0.92);
    ambient.position.set(0, 12, 0);
    this.scene.add(ambient);
    this.ambientLight = ambient;

    const ceremonialLight = new THREE.DirectionalLight(0xffe0bc, 1.08);
    ceremonialLight.position.set(4.9, 10.9, 7.3);
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

    const moonRim = new THREE.DirectionalLight(0xd7dde6, 0.26);
    moonRim.position.set(-4.6, 6.2, -6.6);
    this.scene.add(moonRim);
    this.moonRimLight = moonRim;

    const warmFill = new THREE.PointLight(0xe7c29b, 0.12, 16, 2);
    warmFill.position.set(-1.4, 4.9, 4.8);
    this.scene.add(warmFill);
    this.warmFillLight = warmFill;

    const coolBack = new THREE.PointLight(0xbcc9d8, 0.18, 18, 2);
    coolBack.position.set(0.8, 5.1, -5.4);
    this.scene.add(coolBack);
    this.coolBackLight = coolBack;

    const crownLight = new THREE.PointLight(0xffedd0, 0.05, 9, 2);
    crownLight.position.set(0, 6.8, 0.4);
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
      new THREE.CircleGeometry(9.6, 56),
      new THREE.MeshStandardMaterial({
        color: 0x100d0b,
        roughness: 0.98,
        metalness: 0
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.96;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorDisc = floor;

    const boardGroundShadow = new THREE.Mesh(
      new THREE.CircleGeometry(5.3, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      })
    );
    boardGroundShadow.rotation.x = -Math.PI / 2;
    boardGroundShadow.position.y = -0.95;
    this.scene.add(boardGroundShadow);
    this.boardGroundShadow = boardGroundShadow;

    const floorMist = new THREE.Mesh(
      new THREE.RingGeometry(5.8, 9.45, 64),
      new THREE.MeshBasicMaterial({
        color: 0x53473b,
        transparent: true,
        opacity: 0.035,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    floorMist.rotation.x = -Math.PI / 2;
    floorMist.position.y = -0.63;
    floorMist.renderOrder = 0;
    this.scene.add(floorMist);
    this.floorMist = floorMist;

    const emberDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.25, 48),
      new THREE.MeshBasicMaterial({
        color: 0xc1a17d,
        transparent: true,
        opacity: 0.028,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    emberDisc.rotation.x = -Math.PI / 2;
    emberDisc.position.y = -0.54;
    emberDisc.renderOrder = 0;
    this.scene.add(emberDisc);
    this.emberDisc = emberDisc;

    const boardAura = new THREE.Mesh(
      new THREE.CircleGeometry(4.95, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe6d1b2,
        transparent: true,
        opacity: 0.028,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    boardAura.rotation.x = -Math.PI / 2;
    boardAura.position.y = -0.08;
    boardAura.renderOrder = 1;
    this.scene.add(boardAura);
    this.boardAura = boardAura;
  }

  buildBoard() {
    const platform = new THREE.Group();

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(6.04, 6.44, 0.7, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0x2d231c,
        roughness: 0.52,
        metalness: 0.04,
        clearcoat: 0.54,
        clearcoatRoughness: 0.34,
        emissive: 0x120d0a,
        emissiveIntensity: 0.05
      })
    );
    pedestal.position.y = -0.46;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    platform.add(pedestal);

    const pedestalBand = new THREE.Mesh(
      new THREE.CylinderGeometry(5.72, 5.94, 0.18, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0x9d815f,
        roughness: 0.34,
        metalness: 0.38,
        clearcoat: 0.52,
        clearcoatRoughness: 0.26,
        emissive: 0x24170e,
        emissiveIntensity: 0.04
      })
    );
    pedestalBand.position.y = -0.07;
    pedestalBand.castShadow = true;
    pedestalBand.receiveShadow = true;
    platform.add(pedestalBand);

    const boardBed = new THREE.Mesh(
      new THREE.BoxGeometry(8.9, 0.18, 8.9),
      new THREE.MeshPhysicalMaterial({
        color: 0x483526,
        roughness: 0.42,
        metalness: 0.04,
        clearcoat: 0.58,
        clearcoatRoughness: 0.28
      })
    );
    boardBed.position.y = -0.03;
    boardBed.castShadow = true;
    boardBed.receiveShadow = true;
    platform.add(boardBed);

    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(8.38, 0.08, 8.38),
      new THREE.MeshPhysicalMaterial({
        color: 0x2b2219,
        roughness: 0.68,
        metalness: 0.02,
        clearcoat: 0.2,
        clearcoatRoughness: 0.62,
        emissive: 0x130e0a,
        emissiveIntensity: 0.03
      })
    );
    inset.position.y = 0.05;
    inset.castShadow = true;
    inset.receiveShadow = true;
    platform.add(inset);

    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x7a644c,
      roughness: 0.3,
      metalness: 0.48,
      clearcoat: 0.62,
      clearcoatRoughness: 0.24,
      emissive: 0x221710,
      emissiveIntensity: 0.05
    });
    const frameLong = new THREE.BoxGeometry(8.58, 0.18, 0.28);
    const frameShort = new THREE.BoxGeometry(0.28, 0.18, 8.58);

    [
      [frameLong, new THREE.Vector3(0, 0.11, 4.15)],
      [frameLong, new THREE.Vector3(0, 0.11, -4.15)],
      [frameShort, new THREE.Vector3(4.15, 0.11, 0)],
      [frameShort, new THREE.Vector3(-4.15, 0.11, 0)]
    ].forEach(([geometry, position]) => {
      const rail = new THREE.Mesh(geometry, frameMaterial);
      rail.position.copy(position);
      rail.castShadow = true;
      rail.receiveShadow = true;
      platform.add(rail);
    });

    setMeshRenderOrder(platform, 1);
    this.boardRoot.add(platform);

    const createSquareMaterialVariants = (baseColor, options) =>
      Array.from({ length: 4 }, (_, index) => {
        const color = new THREE.Color(baseColor);
        const liftShift = (index - 1.5) * 0.012;
        const saturationShift = index % 2 === 0 ? 0.01 : -0.008;
        color.offsetHSL(0.005 * (index - 1.5), saturationShift, liftShift);

        return new THREE.MeshPhysicalMaterial({
          color,
          roughness: options.roughness + (index - 1.5) * 0.025,
          metalness: options.metalness,
          clearcoat: options.clearcoat,
          clearcoatRoughness: options.clearcoatRoughness + (index % 2 === 0 ? -0.02 : 0.02),
          emissive: options.emissive,
          emissiveIntensity: options.emissiveIntensity
        });
      });

    const lightSquareMaterials = createSquareMaterialVariants(0xc5b08f, {
      roughness: 0.5,
      metalness: 0.02,
      clearcoat: 0.16,
      clearcoatRoughness: 0.62,
      emissive: 0x140f0a,
      emissiveIntensity: 0.01
    });
    const darkSquareMaterials = createSquareMaterialVariants(0x6b4f3a, {
      roughness: 0.56,
      metalness: 0.03,
      clearcoat: 0.12,
      clearcoatRoughness: 0.68,
      emissive: 0x0d0906,
      emissiveIntensity: 0.01
    });

    const squareGeometry = new THREE.BoxGeometry(SQUARE_SIZE * 0.98, 0.095, SQUARE_SIZE * 0.98);

    for (let rank = 1; rank <= BOARD_SIZE; rank += 1) {
      for (let file = 0; file < BOARD_SIZE; file += 1) {
        const square = `${String.fromCharCode(97 + file)}${rank}`;
        const variationIndex = (file * 3 + rank) % 4;
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
    this.targetMarkerGroup = new THREE.Group();
    this.boardRoot.add(this.targetMarkerGroup);
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
    const material = new THREE.MeshBasicMaterial({
      color: capture ? 0xf49a8e : 0xe2b56c,
      transparent: true,
      opacity: capture ? 0.56 : 0.42,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    material.userData.baseOpacity = material.opacity;

    const marker = new THREE.Mesh(
      capture
        ? new THREE.RingGeometry(0.25, 0.39, 36)
        : new THREE.CircleGeometry(0.19, 28),
      material
    );

    marker.rotation.x = -Math.PI / 2;
    marker.position.y = BOARD_TOP_Y + 0.018;
    marker.renderOrder = capture ? 16 : 15;
    return marker;
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

    this.camera.fov = aspect < 0.94 ? 40.2 : aspect > 1.2 ? 36.9 : 38.1;
    this.cameraRestPosition.set(
      0,
      8.98 + portraitBias * 0.94 - widescreenBias * 0.08,
      9.08 + portraitBias * 0.74 - widescreenBias * 0.34
    );
    this.cameraRestLookAt.set(
      0,
      0.46 + portraitBias * 0.05,
      0.08 - widescreenBias * 0.05
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
    const nextMoveKey = getSquareKey(gameState.lastMove);
    this.clearTransientEffects();
    this.syncPieces(nextBoardMap, {
      reason:
        shouldResetPresentation
          ? "reset"
          : nextMoveKey && nextMoveKey !== this.lastMoveKey
            ? "move"
            : "refresh",
      lastMove: gameState.lastMove || null
    });

    this.previousBoardMap = nextBoardMap;
    this.currentGameId = nextGameId;
    this.lastMoveKey = nextMoveKey;
    this.currentBoardMap = nextBoardMap;
    this.currentLastMove = gameState.lastMove || null;
    this.currentSelection = selectedSquare;
    this.updateHighlights(gameState.lastMove, selectedSquare, legalTargets);
    this.updatePieceSelectionState(selectedSquare);
    this.clearHoverState();
  }

  canAnimateMove(nextBoardMap, lastMove) {
    const movingMesh = this.pieceMeshes.get(lastMove.from);
    const movedPiece = nextBoardMap.get(lastMove.to);

    return Boolean(movingMesh && movedPiece);
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
    this.pieceMeshes.forEach((mesh) => resetPiecePose(mesh));
  }

  resetPresentationState() {
    this.clearTransientEffects();
    this.clearHoverState();
    this.updateHighlights(null, null, []);
    this.updatePieceSelectionState(null);
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

    this.clearHoverState();
    this.pieceMeshes.delete(lastMove.from);
    this.pieceMeshes.set(lastMove.to, movingMesh);
    this.pieceHitboxes.delete(lastMove.from);

    if (movingHitbox) {
      movingHitbox.userData.square = lastMove.to;
      this.pieceHitboxes.set(lastMove.to, movingHitbox);
    }

    if (captureSquare && capturedMesh) {
      this.pieceMeshes.delete(captureSquare);
      this.removePieceHitbox(captureSquare);
      this.animateCapture(capturedMesh);
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
      durationMs: 460,
      update: (progress) => {
        const travel = easeInOutCubic(progress);
        const lift = Math.sin(progress * Math.PI) * 0.42;
        const settleDip =
          progress > 0.72 ? Math.sin(((progress - 0.72) / 0.28) * Math.PI) * 0.045 : 0;
        const tilt = Math.sin(progress * Math.PI) * 0.1;

        movingMesh.position.set(
          THREE.MathUtils.lerp(movingStart.x, movingTarget.x, travel),
          movingAnchorY + lift - settleDip,
          THREE.MathUtils.lerp(movingStart.z, movingTarget.z, travel)
        );
        movingMesh.rotation.x = directionZ * tilt;
        movingMesh.rotation.z = -directionX * tilt;
        movingMesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.026);
        this.updatePieceHitboxPosition(lastMove.to, movingMesh.position.x, movingMesh.position.z);

        if (rookAnimation) {
          const rookTravel = easeInOutCubic(progress);
          rookAnimation.mesh.position.set(
            THREE.MathUtils.lerp(rookAnimation.from.x, rookAnimation.to.x, rookTravel),
            rookAnimation.anchorY + Math.sin(progress * Math.PI) * 0.16,
            THREE.MathUtils.lerp(rookAnimation.from.z, rookAnimation.to.z, rookTravel)
          );
          rookAnimation.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.012);

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

        if (rookAnimation) {
          rookAnimation.mesh.position.set(
            rookAnimation.to.x,
            rookAnimation.anchorY,
            rookAnimation.to.z
          );
          resetPiecePose(rookAnimation.mesh);
          this.updatePieceHitboxPosition(rookAnimation.hitbox?.userData.square, rookAnimation.to.x, rookAnimation.to.z);
        }

        this.syncPieces(nextBoardMap);
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

  animateCapture(mesh) {
    const anchorY = mesh.userData.anchorY || PIECE_ANCHOR_Y;
    const startingScale = mesh.scale.x;

    this.addAnimation({
      durationMs: 300,
      update: (progress) => {
        const eased = easeOutCubic(progress);

        mesh.position.y = anchorY + eased * 0.18;
        mesh.rotation.y = eased * 0.34;
        mesh.scale.setScalar(startingScale * (1 - eased * 0.42));
        cloneMaterialOpacity(mesh, 1 - progress);
      },
      complete: () => {
        this.boardRoot.remove(mesh);
        disposeObject3D(mesh);
      }
    });
  }

  updatePieceSelectionState(selectedSquare) {
    void selectedSquare;
  }

  updateHighlights(lastMove, selectedSquare, legalTargets = []) {
    void lastMove;
    void selectedSquare;
    this.targetMarkers.forEach((marker) => {
      this.targetMarkerGroup.remove(marker);
      disposeObject3D(marker);
    });
    this.targetMarkers = [];

    const uniqueTargets = new Map();
    legalTargets.forEach((move) => {
      if (!uniqueTargets.has(move.to)) {
        uniqueTargets.set(move.to, move);
      }
    });

    uniqueTargets.forEach((move) => {
      const marker = this.createTargetMarker(Boolean(move.captured));
      marker.position.copy(this.getSquarePosition(move.to));
      marker.position.y = BOARD_TOP_Y + 0.018;
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
    this.floorMist.material.opacity = 0.024 + Math.sin(elapsed * 0.16) * 0.003;
    this.floorMist.scale.setScalar(1 + Math.sin(elapsed * 0.14) * 0.006);
    this.emberDisc.material.opacity = 0.018 + Math.sin(elapsed * 0.2 + 0.5) * 0.002;
    this.boardAura.material.opacity = 0.018 + Math.sin(elapsed * 0.24) * 0.003;

    this.ceremonialLight.intensity = 1.08 + Math.sin(elapsed * 0.18) * 0.015;
    this.coolBackLight.intensity = 0.18 + Math.sin(elapsed * 0.22) * 0.006;
    this.warmFillLight.intensity = 0.12 + Math.sin(elapsed * 0.18 + 0.8) * 0.005;
    this.crownLight.intensity = 0.05 + Math.sin(elapsed * 0.2) * 0.003;
  }

  updateCameraMotion(delta) {
    void delta;
    this.camera.position.copy(this.cameraRestPosition);
    this.cameraFocusPoint.copy(this.cameraRestLookAt);
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
    this.clearTransientEffects();
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
