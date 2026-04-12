/**
 * ArcaneBoardV2.js — Arcane Chess 3D Board
 * Gothic dark academia Three.js chess board
 * Self-contained. Requires Three.js loaded globally.
 * API: window.ArcaneBoardV2
 */
(function (global) {
  'use strict';

  const FILES = ['a','b','c','d','e','f','g','h'];
  const RANKS = ['1','2','3','4','5','6','7','8'];
  const PIECE_MODEL_PATHS = {
    p: '/models/Pawn/Pawn.STL',
    r: '/models/Rook/Rook.STL',
    n: '/models/Knight/Knight.STL',
    b: '/models/Bishop/Bishop.STL',
    q: '/models/Queen/Queen.STL',
    k: '/models/King/King.STL'
  };
  const PIECE_MODEL_HEIGHT = {
    p: 0.92,
    r: 1.05,
    n: 1.08,
    b: 1.12,
    q: 1.22,
    k: 1.3
  };
  const MIN_RENDER_WIDTH = 580;
  const MIN_RENDER_HEIGHT = 400;
  const BOARD_CORNER_OFFSET = 3.5;
  const GUARDIAN_OUTSET = 1.4;
  const GUARDIAN_RAW_HEIGHT = 1.82;
  const GUARDIAN_TARGET_HEIGHT = PIECE_MODEL_HEIGHT.p * 2;
  const GUARDIAN_CORNER_DISTANCE = BOARD_CORNER_OFFSET + GUARDIAN_OUTSET;

  class ArcaneBoardV2 {
    constructor(container) {
      this.container   = container;
      this.scene       = null;
      this.camera      = null;
      this.renderer    = null;
      this.clock       = null;
      this.raycaster   = null;
      this.mouse       = null;

      this.pieces       = new Map();   // square -> { mesh, type, color }
      this.squareMeshes = new Map();   // square -> mesh
      this.indicators   = [];          // legal-move dot meshes
      this.hintIndicators = [];

      this.selectedSquare = null;
      this.legalTargets   = new Set();

      this.torchLights  = [];
      this.torchTime    = 0;
      this.flameMeshes  = [];
      this.playerPerspective = 'white';

      this._onSquareClickCb = null;
      this._animFrameId     = null;
      this._boundAnimate    = this._animate.bind(this);
      this._boundResize     = this._onResize.bind(this);
      this._boundClick      = this._onClick.bind(this);

      this._stlLoader         = null;
      this._modelGeometryByType = new Map();
      this._modelLoadPromise  = null;
      this._modelAssetsReady  = false;
      this._latestBoardState  = null;
      this._positionVersion   = 0;
      this._activeParticles   = [];
      this._threatLines       = [];
      this._curtainMesh       = null;
      this.arenaGuardians     = null;
    }

    // ─────────────────────────────────────────
    //  PUBLIC INITIALISE
    // ─────────────────────────────────────────
    init() {
      if (!window.THREE) {
        console.error('[ArcaneBoardV2] Three.js not loaded.');
        return this;
      }
      this._T = window.THREE;
      this._setupRenderer();
      this._setupScene();
      this._setupCamera();
      this._setupLights();
      this._buildEnvironment();
      this._buildBoardSquares();
      this._buildArenaGuardians();
      this._initModelAssets();
      this.container.addEventListener('click', this._boundClick);
      window.addEventListener('resize', this._boundResize);
      this._animate();
      return this;
    }

    // ─────────────────────────────────────────
    //  PUBLIC API
    // ─────────────────────────────────────────

    /** Update piece positions from app.js board array */
    setPosition(board) {
      this._positionVersion += 1;
      this._latestBoardState = Array.isArray(board)
        ? board.map((entry) => ({
            square: entry.square,
            piece: entry.piece ? { ...entry.piece } : null
          }))
        : [];

      this.pieces.forEach(({ mesh }) => {
        this.scene.remove(mesh);
        this._disposeGroup(mesh);
      });
      this.pieces.clear();
      if (!board) return;
      board.forEach(({ square, piece }) => {
        if (piece) this._addPiece(square, piece.type, piece.color);
      });
    }

    /** Highlight selected square and legal move targets */
    highlightSquares(selectedSquare, legalMoves, hintMove = null) {
      const T = this._T;

      // Reset square tints
      this.squareMeshes.forEach((mesh) => {
        mesh.material.color.setHex(mesh.userData.baseColor);
        mesh.material.emissiveIntensity = 0;
      });

      // Remove old indicators
      this.indicators.forEach(m => {
        this.scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
      this.indicators = [];

      this.hintIndicators.forEach((marker) => {
        this.scene.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
      });
      this.hintIndicators = [];

      this.selectedSquare = selectedSquare;
      this.legalTargets   = new Set(legalMoves || []);

      if (selectedSquare) {
        const m = this.squareMeshes.get(selectedSquare);
        if (m) {
          m.material.color.setHex(0x4a7c50);
          m.material.emissiveIntensity = 0.25;
        }
      }

      (legalMoves || []).forEach(sq => {
        const sqMesh = this.squareMeshes.get(sq);
        if (!sqMesh) return;
        const pos = sqMesh.position;

        // Small gold dot indicator
        const dotGeo = new T.CylinderGeometry(0.14, 0.14, 0.06, 12);
        const dotMat = new T.MeshLambertMaterial({ color: 0xb8952a, emissive: 0x5a4010, emissiveIntensity: 0.5 });
        const dot = new T.Mesh(dotGeo, dotMat);
        dot.position.set(pos.x, 0.10, pos.z);
        this.scene.add(dot);
        this.indicators.push(dot);
      });

      if (hintMove?.from) {
        const fromMesh = this.squareMeshes.get(hintMove.from);
        if (fromMesh) {
          const fromRing = new T.Mesh(
            new T.RingGeometry(0.32, 0.43, 24),
            new T.MeshLambertMaterial({
              color: 0xffa84b,
              emissive: 0x6b3208,
              emissiveIntensity: 0.38,
              transparent: true,
              opacity: 0.88,
              side: T.DoubleSide
            })
          );
          fromRing.rotation.x = -Math.PI / 2;
          fromRing.position.set(fromMesh.position.x, 0.105, fromMesh.position.z);
          this.scene.add(fromRing);
          this.hintIndicators.push(fromRing);
        }
      }

      if (hintMove?.to) {
        const toMesh = this.squareMeshes.get(hintMove.to);
        if (toMesh) {
          const toDot = new T.Mesh(
            new T.CylinderGeometry(0.17, 0.17, 0.06, 18),
            new T.MeshLambertMaterial({
              color: 0xffd26f,
              emissive: 0x7f4c0d,
              emissiveIntensity: 0.55,
              transparent: true,
              opacity: 0.95
            })
          );
          toDot.position.set(toMesh.position.x, 0.115, toMesh.position.z);
          this.scene.add(toDot);
          this.hintIndicators.push(toDot);
        }
      }
    }

    /** Flash last-move squares gold */
    setLastMove(from, to) {
      [from, to].forEach(sq => {
        if (!sq) return;
        const m = this.squareMeshes.get(sq);
        if (m) {
          m.material.color.setHex(0x8a6a20);
          m.material.emissiveIntensity = 0.15;
        }
      });
    }

    /** Animate a move: lift piece, arc, land; explode capture if needed */
    animateMove(from, to, isCapture, callback) {
      const pieceDat = this.pieces.get(from);
      if (!pieceDat) { callback && callback(); return; }

      if (isCapture) this._explodePiece(to);
      this._arcMove(from, to, pieceDat, callback);
    }

    /** Register click callback — receives algebraic square string */
    onSquareClick(cb) { this._onSquareClickCb = cb; }

    /** Flip the overview camera so the active player stays nearest */
    setPerspective(playerColor = 'white') {
      const nextPerspective = playerColor === 'black' ? 'black' : 'white';
      this.playerPerspective = nextPerspective;
      if (!this.camera) return;

      this.camera.position.set(0, 8.5, nextPerspective === 'black' ? -10 : 10);
      this.camera.lookAt(0, 0, 0);
    }

    setArenaGuardiansVisible(visible = true) {
      if (!this.arenaGuardians) return;
      this.arenaGuardians.visible = Boolean(visible);
    }

    /**
     * Drop a dark plane from above to cover the board over 800 ms (ease-in).
     * onCoveredCallback fires at the 600 ms mark so the CSS overlay can fade in
     * while the curtain is still descending.
     */
    showGameEndCurtain(onCoveredCallback) {
      const T = this._T;
      if (!T || !this.scene) return;

      this.clearGameEndCurtain();

      const geo = new T.PlaneGeometry(18, 18);
      const mat = new T.MeshBasicMaterial({
        color: 0x0a0d14,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide
      });
      const curtain = new T.Mesh(geo, mat);
      curtain.rotation.x = -Math.PI / 2;   // lay flat over XZ plane
      curtain.position.set(0, 14, 0);       // start high above board
      curtain.renderOrder = 999;
      this.scene.add(curtain);
      this._curtainMesh = curtain;

      const dur    = 800;
      const startY = 14;
      const endY   = 0.5;
      const t0     = performance.now();
      let callbackFired = false;

      const step = (now) => {
        if (this._curtainMesh !== curtain) return; // cleared externally
        const elapsed = now - t0;
        const raw  = Math.min(elapsed / dur, 1);
        const ease = raw * raw; // ease-in

        curtain.position.y   = startY + (endY - startY) * ease;
        curtain.material.opacity = 0.92 * ease;

        if (!callbackFired && elapsed >= 600) {
          callbackFired = true;
          onCoveredCallback && onCoveredCallback();
        }

        if (raw < 1) {
          requestAnimationFrame(step);
        } else {
          curtain.position.y      = endY;
          curtain.material.opacity = 0.92;
        }
      };
      requestAnimationFrame(step);
    }

    /** Remove the game-end curtain mesh from the scene and dispose it. */
    clearGameEndCurtain() {
      if (this._curtainMesh) {
        this.scene.remove(this._curtainMesh);
        this._curtainMesh.geometry.dispose();
        this._curtainMesh.material.dispose();
        this._curtainMesh = null;
      }
    }

    /** Tear down renderer, remove from DOM */
    destroy() {
      this.clearThreatLines();
      this.clearGameEndCurtain();
      cancelAnimationFrame(this._animFrameId);
      this.container.removeEventListener('click', this._boundClick);
      window.removeEventListener('resize', this._boundResize);
      this._activeParticles.forEach((particle) => {
        this.scene.remove(particle.mesh);
        particle.mesh.material.dispose();
      });
      this._activeParticles = [];
      this.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.pieces.clear();
      this.squareMeshes.clear();
      this.hintIndicators = [];
      this.arenaGuardians = null;
    }

    // ─────────────────────────────────────────
    //  SETUP
    // ─────────────────────────────────────────

    _setupRenderer() {
      const T = this._T;
      const { width: w, height: h } = this._getViewportSize();
      this.renderer = new T.WebGLRenderer({ antialias: true });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.setClearColor(0x08060400, 0);
      this.container.style.background = '#0a0804';
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.borderRadius = '8px';
      this.clock     = new T.Clock();
      this.raycaster = new T.Raycaster();
      this.mouse     = new T.Vector2();
    }

    _setupScene() {
      const T = this._T;
      this.scene = new T.Scene();
      this.scene.fog = new T.FogExp2(0x0a0804, 0.032);
      this.scene.background = new T.Color(0x0a0804);
    }

    _setupCamera() {
      const T = this._T;
      const { width: w, height: h } = this._getViewportSize();
      this.camera = new T.PerspectiveCamera(58, w / h, 0.1, 60);
      this.camera.position.set(
        0,
        8.5,
        this.playerPerspective === 'black' ? -10 : 10
      );
      this.camera.lookAt(0, 0, 0);
    }

    _setupLights() {
      const T = this._T;

      // Ambient — warm dim
      this.scene.add(new T.AmbientLight(0x2a1a0a, 1.2));

      // Moonlight from above-rear
      const moon = new T.DirectionalLight(0xa0b8d4, 0.55);
      moon.position.set(3, 10, 6);
      moon.castShadow = true;
      moon.shadow.mapSize.setScalar(1024);
      moon.shadow.camera.left = -9;
      moon.shadow.camera.right = 9;
      moon.shadow.camera.top = 9;
      moon.shadow.camera.bottom = -9;
      moon.shadow.camera.far = 30;
      this.scene.add(moon);

      // 4 torch lights at board corners
      const torchPos = [[-6.2,1.4,-6.2],[6.2,1.4,-6.2],[-6.2,1.4,6.2],[6.2,1.4,6.2]];
      torchPos.forEach((p, i) => {
        const light = new T.PointLight(0xff7820, 1.4, 14);
        light.position.set(...p);
        this.scene.add(light);
        this.torchLights.push({ light, base: 1.4, phase: i * 1.57 });
      });
    }

    // ─────────────────────────────────────────
    //  ENVIRONMENT
    // ─────────────────────────────────────────

    _buildEnvironment() {
      const T = this._T;

      // ── Stone floor ──────────────────────────
      const floorMat = new T.MeshLambertMaterial({ color: 0x181210 });
      const floor = new T.Mesh(new T.PlaneGeometry(36, 36, 12, 12), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.28;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // ── Engraved floor lines ─────────────────
      for (let i = -6; i <= 6; i += 2) {
        const lMat = new T.MeshLambertMaterial({ color: 0x0e0c08 });
        const lh = new T.Mesh(new T.BoxGeometry(32, 0.02, 0.04), lMat);
        lh.position.set(0, -0.27, i);
        this.scene.add(lh);
        const lv = new T.Mesh(new T.BoxGeometry(0.04, 0.02, 32), lMat);
        lv.position.set(i, -0.27, 0);
        this.scene.add(lv);
      }

      // ── Board platform ───────────────────────
      const platMat = new T.MeshLambertMaterial({ color: 0x221a10 });
      const plat = new T.Mesh(new T.BoxGeometry(9.4, 0.26, 9.4), platMat);
      plat.position.y = -0.14;
      plat.castShadow = true;
      plat.receiveShadow = true;
      this.scene.add(plat);

      // Platform bevelled edge trim
      const trimMat = new T.MeshLambertMaterial({ color: 0x3a2c18 });
      const trimTop = new T.Mesh(new T.BoxGeometry(9.6, 0.06, 9.6), trimMat);
      trimTop.position.y = -0.01;
      this.scene.add(trimTop);

      // ── Torch pillars ────────────────────────
      const torchPos = [[-6.2,0,-6.2],[6.2,0,-6.2],[-6.2,0,6.2],[6.2,0,6.2]];
      const pillarMat = new T.MeshLambertMaterial({ color: 0x1e170e });
      torchPos.forEach(p => {
        const pillar = new T.Mesh(new T.CylinderGeometry(0.16, 0.20, 2.8, 10), pillarMat);
        pillar.position.set(p[0], 1.5, p[2]);
        pillar.castShadow = true;
        this.scene.add(pillar);

        // Torch bracket
        const bracket = new T.Mesh(new T.BoxGeometry(0.08, 0.34, 0.08), pillarMat);
        bracket.position.set(p[0], 2.5, p[2]);
        this.scene.add(bracket);

        // Flame sphere (glowing)
        const flameMat = new T.MeshBasicMaterial({ color: 0xff6010 });
        const flame = new T.Mesh(new T.SphereGeometry(0.12, 8, 8), flameMat);
        flame.position.set(p[0], 2.72, p[2]);
        this.scene.add(flame);
        this.flameMeshes.push(flame);

        // Flame glow halo
        const haloMat = new T.MeshBasicMaterial({ color: 0xff4000, transparent: true, opacity: 0.3 });
        const halo = new T.Mesh(new T.SphereGeometry(0.22, 8, 8), haloMat);
        halo.position.copy(flame.position);
        this.scene.add(halo);
        this.flameMeshes.push(halo);
      });

      // ── Gothic arch ribs on ceiling ──────────
      const ribMat = new T.MeshLambertMaterial({ color: 0x100c08 });
      for (let i = -2; i <= 2; i++) {
        const rib = new T.Mesh(new T.TorusGeometry(9, 0.12, 6, 24, Math.PI), ribMat);
        rib.position.set(i * 5, 9, 0);
        rib.rotation.y = Math.PI / 2;
        this.scene.add(rib);
      }

      // ── Far walls ────────────────────────────
      const wallMat = new T.MeshLambertMaterial({ color: 0x100c08 });
      [
        { pos: [-22,7,0],   size: [1,14,48] },
        { pos: [22,7,0],    size: [1,14,48] },
        { pos: [0,7,-22],   size: [48,14,1] },
        { pos: [0,16,0],    size: [48,1,48] },
      ].forEach(({ pos, size }) => {
        const wall = new T.Mesh(new T.BoxGeometry(...size), wallMat);
        wall.position.set(...pos);
        this.scene.add(wall);
      });

      // ── Pillar columns mid-background ────────
      const colMat = new T.MeshLambertMaterial({ color: 0x181410 });
      [-12, -8, 8, 12].forEach(x => {
        [-12, 12].forEach(z => {
          const col = new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 10, 12), colMat);
          col.position.set(x, 4, z);
          this.scene.add(col);
        });
      });

      // ── Rank & File labels around board ──────
      this._buildBoardLabels();
    }

    _buildBoardLabels() {
      const T = this._T;
      // We use thin BoxGeometry "planks" with no actual text (canvas texture free)
      // Just decorative corner markers
      const markerMat = new T.MeshLambertMaterial({ color: 0x5a4428 });
      const corners = [[-4,0,-4],[4,0,-4],[-4,0,4],[4,0,4]];
      corners.forEach(p => {
        const m = new T.Mesh(new T.SphereGeometry(0.08, 6, 6), markerMat);
        m.position.set(p[0], 0.05, p[2]);
        this.scene.add(m);
      });
    }

    _buildArenaGuardians() {
      const T = this._T;
      this.arenaGuardians = new T.Group();
      this.arenaGuardians.name = 'arenaGuardians';

      [
        { x: -GUARDIAN_CORNER_DISTANCE, z: -GUARDIAN_CORNER_DISTANCE },
        { x: GUARDIAN_CORNER_DISTANCE, z: -GUARDIAN_CORNER_DISTANCE },
        { x: GUARDIAN_CORNER_DISTANCE, z: GUARDIAN_CORNER_DISTANCE },
        { x: -GUARDIAN_CORNER_DISTANCE, z: GUARDIAN_CORNER_DISTANCE }
      ].forEach(({ x, z }) => {
        const guardian = this._createArenaGuardian();
        guardian.position.set(x, 0, z);
        guardian.rotation.y = Math.atan2(-x, -z);
        this.arenaGuardians.add(guardian);
      });

      [
        { z: -GUARDIAN_CORNER_DISTANCE, rotationY: 0 },
        { z: GUARDIAN_CORNER_DISTANCE, rotationY: Math.PI }
      ].forEach(({ z, rotationY }) => {
        const torch = this._createArenaTorch();
        torch.position.set(0, 0, z);
        torch.rotation.y = rotationY;
        this.arenaGuardians.add(torch);
      });

      this.scene.add(this.arenaGuardians);
      this.setArenaGuardiansVisible(true);
    }

    _createArenaGuardian() {
      const T = this._T;
      const guardian = new T.Group();
      const guardianScale = GUARDIAN_TARGET_HEIGHT / GUARDIAN_RAW_HEIGHT;

      const robe = new T.Mesh(
        new T.CylinderGeometry(0.12, 0.28, 0.9, 8),
        new T.MeshLambertMaterial({ color: 0x0d1117 })
      );
      robe.position.y = 0.45;
      robe.castShadow = true;
      guardian.add(robe);

      const trim = new T.Mesh(
        new T.TorusGeometry(0.14, 0.015, 6, 12),
        new T.MeshLambertMaterial({ color: 0xc9a84c })
      );
      trim.rotation.x = Math.PI / 2;
      trim.position.y = 0.71;
      trim.castShadow = true;
      guardian.add(trim);

      const head = new T.Mesh(
        new T.SphereGeometry(0.14, 8, 8),
        new T.MeshLambertMaterial({ color: 0xc8a478 })
      );
      head.position.y = 1.02;
      head.castShadow = true;
      guardian.add(head);

      const hat = new T.Mesh(
        new T.ConeGeometry(0.18, 0.42, 8),
        new T.MeshLambertMaterial({ color: 0x060a10 })
      );
      hat.position.y = 1.3;
      hat.castShadow = true;
      guardian.add(hat);

      const beltOrb = new T.Mesh(
        new T.SphereGeometry(0.06, 8, 8),
        new T.MeshLambertMaterial({
          color: 0x1a3a6a,
          emissive: 0x1a3a6a,
          emissiveIntensity: 0.8
        })
      );
      beltOrb.position.set(0.12, 0.42, 0.17);
      guardian.add(beltOrb);

      const staffGroup = new T.Group();
      staffGroup.position.set(0.34, 0, 0.06);
      staffGroup.rotation.z = 0.15;

      const staff = new T.Mesh(
        new T.CylinderGeometry(0.025, 0.025, 1.6, 6),
        new T.MeshLambertMaterial({ color: 0x3a2510 })
      );
      staff.position.y = 0.8;
      staff.castShadow = true;
      staffGroup.add(staff);

      const staffTip = new T.Mesh(
        new T.ConeGeometry(0.06, 0.22, 6),
        new T.MeshLambertMaterial({ color: 0x888888 })
      );
      staffTip.position.y = 1.71;
      staffTip.castShadow = true;
      staffGroup.add(staffTip);

      guardian.add(staffGroup);
      guardian.scale.setScalar(guardianScale);
      return guardian;
    }

    _createArenaTorch() {
      const T = this._T;
      const torch = new T.Group();

      const post = new T.Mesh(
        new T.CylinderGeometry(0.04, 0.04, 0.7, 8),
        new T.MeshLambertMaterial({ color: 0x3a2510 })
      );
      post.position.y = 0.35;
      post.castShadow = true;
      torch.add(post);

      const arm = new T.Mesh(
        new T.CylinderGeometry(0.02, 0.02, 0.3, 6),
        new T.MeshLambertMaterial({ color: 0x5a4520 })
      );
      arm.rotation.x = Math.PI / 2;
      arm.position.set(0, 0.66, 0.15);
      arm.castShadow = true;
      torch.add(arm);

      const flame = new T.Mesh(
        new T.SphereGeometry(0.1, 8, 8),
        new T.MeshLambertMaterial({
          color: 0xe07820,
          emissive: 0xe05010,
          emissiveIntensity: 1.4
        })
      );
      flame.position.set(0, 0.72, 0.3);
      torch.add(flame);
      this.flameMeshes.push(flame);

      const light = new T.PointLight(0xe07820, 1.0, 5);
      light.castShadow = false;
      light.position.copy(flame.position);
      torch.add(light);
      this.torchLights.push({
        light,
        base: 1.0,
        phase: this.torchLights.length * 0.87
      });

      return torch;
    }

    // ─────────────────────────────────────────
    //  BOARD SQUARES
    // ─────────────────────────────────────────

    _buildBoardSquares() {
      const T = this._T;
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          const isLight = (r + f) % 2 === 0;
          const sq = FILES[f] + RANKS[r];
          const baseColor = isLight ? 0xc8b484 : 0x6b4226;

          const mat = new T.MeshLambertMaterial({
            color: baseColor,
            emissive: new T.Color(0x000000),
            emissiveIntensity: 0,
          });
          const mesh = new T.Mesh(new T.BoxGeometry(1.0, 0.07, 1.0), mat);
          mesh.position.set(-3.5 + f, 0.035, -3.5 + (7 - r));
          mesh.receiveShadow = true;
          mesh.userData = { square: sq, isSquare: true, baseColor };
          this.scene.add(mesh);
          this.squareMeshes.set(sq, mesh);
        }
      }
    }

    // ─────────────────────────────────────────
    //  PIECE CREATION
    // ─────────────────────────────────────────

    _squareToXZ(sq) {
      const f = FILES.indexOf(sq[0]);
      const r = parseInt(sq[1]) - 1;
      return { x: -3.5 + f, z: -3.5 + (7 - r) };
    }

    _addPiece(square, type, color) {
      const group = this._makePiece(type, color);
      const { x, z } = this._squareToXZ(square);
      group.position.set(x, 0.07, z);
      group.userData = { square, type, color, isPiece: true };
      this.scene.add(group);
      this.pieces.set(square, { mesh: group, type, color });
    }

    _makePiece(type, color) {
      if (this._modelAssetsReady) {
        const stlPiece = this._makeModelPiece(type, color);
        if (stlPiece) {
          return stlPiece;
        }
      }

      const T = this._T;
      const isWhite = color === 'white';

      const mat = new T.MeshLambertMaterial({
        color:    isWhite ? 0xe8d9b0 : 0x2a1a35,
        emissive: isWhite ? 0x8a6a10 : 0x3a1a5a,
        emissiveIntensity: isWhite ? 0.7 : 1.1,
      });

      const group = new T.Group();

      // Shared base disc
      this._add(group, new T.CylinderGeometry(0.34, 0.38, 0.10, 14), mat, 0, 0.05, 0);

      switch (type) {
        case 'p': this._shapePawn(group, mat);   break;
        case 'r': this._shapeRook(group, mat);   break;
        case 'n': this._shapeKnight(group, mat); break;
        case 'b': this._shapeBishop(group, mat); break;
        case 'q': this._shapeQueen(group, mat);  break;
        case 'k': this._shapeKing(group, mat);   break;
      }

      // Emissive eye-glow for white pieces (very subtle)
      if (isWhite) {
        const glowMat = new T.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.45 });
        const glow = new T.Mesh(new T.SphereGeometry(0.10, 6, 6), glowMat);
        glow.position.y = this._pieceGlowY(type);
        group.add(glow);
      }

      return group;
    }

    _makeModelPiece(type, color) {
      const T = this._T;
      const geometry = this._modelGeometryByType.get(type);

      if (!geometry) {
        return null;
      }

      const material = new T.MeshStandardMaterial({
        color: color === 'white' ? 0xe2cfa0 : 0x2a1a35,
        emissive: color === 'white' ? 0x7a5c0a : 0x3a1a5a,
        emissiveIntensity: color === 'white' ? 0.55 : 0.85,
        roughness: color === 'white' ? 0.3 : 0.4,
        metalness: color === 'white' ? 0.35 : 0.25
      });

      const mesh = new T.Mesh(geometry, material);
      mesh.userData.sharedGeometry = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.02;

      const base = new T.Mesh(
        new T.CylinderGeometry(0.3, 0.34, 0.08, 18),
        new T.MeshLambertMaterial({
          color: color === 'white' ? 0xcab692 : 0x1f1911,
          emissive: color === 'white' ? 0x1f1309 : 0x080604,
          emissiveIntensity: 0.16
        })
      );
      base.castShadow = true;
      base.receiveShadow = true;
      base.position.y = 0.04;

      const group = new T.Group();
      group.add(base);
      group.add(mesh);
      return group;
    }

    _initModelAssets() {
      const T = this._T;

      if (!T || !T.STLLoader || this._modelLoadPromise) {
        return;
      }

      this._stlLoader = new T.STLLoader();

      const loadType = (pieceType, url) =>
        new Promise((resolve) => {
          this._stlLoader.load(
            url,
            (geometry) => {
              const normalized = this._normalizeModelGeometry(pieceType, geometry);
              this._modelGeometryByType.set(pieceType, normalized);
              resolve();
            },
            undefined,
            () => resolve()
          );
        });

      const loads = Object.entries(PIECE_MODEL_PATHS).map(([pieceType, url]) =>
        loadType(pieceType, url)
      );

      this._modelLoadPromise = Promise.all(loads).then(() => {
        this._modelAssetsReady = this._modelGeometryByType.size > 0;

        if (this._modelAssetsReady && this._latestBoardState?.length) {
          this.setPosition(this._latestBoardState);
        }
      });
    }

    _normalizeModelGeometry(pieceType, geometry) {
      const T = this._T;
      const normalized = geometry.clone();
      normalized.computeVertexNormals();
      normalized.computeBoundingBox();

      const bounds = normalized.boundingBox;
      if (!bounds) {
        return normalized;
      }

      const size = new T.Vector3();
      const center = new T.Vector3();
      bounds.getSize(size);
      bounds.getCenter(center);

      const targetHeight = PIECE_MODEL_HEIGHT[pieceType] || PIECE_MODEL_HEIGHT.p;
      const scale = size.y > 0 ? targetHeight / size.y : 1;

      normalized.translate(-center.x, -bounds.min.y, -center.z);
      normalized.scale(scale, scale, scale);
      return normalized;
    }

    _pieceGlowY(t) {
      return { p:0.6, r:0.72, n:0.72, b:1.0, q:1.1, k:1.2 }[t] || 0.6;
    }

    _add(group, geo, mat, x, y, z, rx=0, rz=0) {
      const T = this._T;
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (rz) m.rotation.z = rz;
      m.castShadow = true;
      group.add(m);
      return m;
    }

    _shapePawn(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.13, 0.22, 0.40, 10), mat, 0, 0.30, 0);
      this._add(g, new T.SphereGeometry(0.19, 12, 10), mat, 0, 0.68, 0);
    }

    _shapeRook(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.20, 0.24, 0.52, 10), mat, 0, 0.36, 0);
      this._add(g, new T.CylinderGeometry(0.23, 0.20, 0.10, 10), mat, 0, 0.67, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this._add(g, new T.BoxGeometry(0.11, 0.18, 0.11), mat,
          Math.cos(a)*0.15, 0.80, Math.sin(a)*0.15);
      }
    }

    _shapeKnight(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.15, 0.20, 0.32, 10), mat, 0, 0.26, 0);
      // angled neck
      const neck = this._add(g, new T.CylinderGeometry(0.12, 0.16, 0.36, 10), mat, 0, 0.53, 0);
      neck.rotation.x = 0.28;
      // horse head
      const head = this._add(g, new T.SphereGeometry(0.19, 10, 10), mat, 0.05, 0.75, 0.06);
      head.scale.set(0.72, 1.05, 1.20);
      // snout
      const snout = this._add(g, new T.CylinderGeometry(0.07, 0.10, 0.20, 8), mat, 0.14, 0.57, 0.18);
      snout.rotation.x =  1.05;
      snout.rotation.z = -0.36;
      // ear nubs
      this._add(g, new T.ConeGeometry(0.04, 0.10, 6), mat, -0.06, 0.94, 0);
      this._add(g, new T.ConeGeometry(0.04, 0.10, 6), mat,  0.06, 0.94, 0);
    }

    _shapeBishop(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.12, 0.22, 0.60, 10), mat, 0, 0.40, 0);
      this._add(g, new T.SphereGeometry(0.14, 10, 10), mat, 0, 0.78, 0);
      this._add(g, new T.ConeGeometry(0.10, 0.34, 10), mat, 0, 1.01, 0);
      this._add(g, new T.SphereGeometry(0.055, 8, 8), mat, 0, 1.20, 0);
    }

    _shapeQueen(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.15, 0.24, 0.68, 12), mat, 0, 0.44, 0);
      this._add(g, new T.SphereGeometry(0.17, 10, 10), mat, 0, 0.86, 0);
      // Crown ring
      const T3 = this._T;
      const crownRing = new T3.Mesh(new T3.TorusGeometry(0.17, 0.04, 8, 16), mat);
      crownRing.position.y = 1.04;
      crownRing.castShadow = true;
      g.add(crownRing);
      // 5 crown spikes
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new T3.Mesh(new T3.ConeGeometry(0.042, 0.22, 6), mat);
        spike.position.set(Math.cos(a)*0.16, 1.20, Math.sin(a)*0.16);
        spike.castShadow = true;
        g.add(spike);
      }
      this._add(g, new T3.SphereGeometry(0.076, 10, 10), mat, 0, 1.32, 0);
    }

    _shapeKing(g, mat) {
      const T = this._T;
      this._add(g, new T.CylinderGeometry(0.17, 0.25, 0.72, 12), mat, 0, 0.46, 0);
      // Wide crown band
      this._add(g, new T.CylinderGeometry(0.21, 0.20, 0.12, 12), mat, 0, 0.88, 0);
      // 4 crown points
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this._add(g, new T.ConeGeometry(0.048, 0.22, 6), mat,
          Math.cos(a)*0.17, 1.08, Math.sin(a)*0.17);
      }
      // Cross vertical
      this._add(g, new T.BoxGeometry(0.07, 0.34, 0.07), mat, 0, 1.14, 0);
      // Cross horizontal
      this._add(g, new T.BoxGeometry(0.26, 0.07, 0.07), mat, 0, 1.21, 0);
    }

    // ─────────────────────────────────────────
    //  ANIMATIONS
    // ─────────────────────────────────────────

    _arcMove(from, to, pieceDat, callback) {
      const { mesh } = pieceDat;
      const fromXZ = this._squareToXZ(from);
      const toXZ   = this._squareToXZ(to);
      const arcH   = 2.8;
      const dur    = 560;
      const t0     = performance.now();

      const step = (now) => {
        const raw  = Math.min((now - t0) / dur, 1);
        const ease = raw < 0.5 ? 2*raw*raw : -1+(4-2*raw)*raw;

        mesh.position.x = fromXZ.x + (toXZ.x - fromXZ.x) * ease;
        mesh.position.z = fromXZ.z + (toXZ.z - fromXZ.z) * ease;
        mesh.position.y = 0.07 + Math.sin(raw * Math.PI) * arcH;

        // Slight tilt toward direction of travel
        mesh.rotation.x = Math.sin(raw * Math.PI) * -0.18;

        if (raw < 1) {
          requestAnimationFrame(step);
        } else {
          mesh.position.set(toXZ.x, 0.07, toXZ.z);
          mesh.rotation.x = 0;
          mesh.userData.square = to;
          this.pieces.delete(from);
          this.pieces.set(to, pieceDat);
          this._cameraReturnToOverview(320);
          callback && callback();
        }
      };

      this._cameraSwingToMove(fromXZ, toXZ);
      requestAnimationFrame(step);
    }

    _explodePiece(square) {
      const entry = this.pieces.get(square);
      if (!entry) return;

      this.animateCapture(entry.mesh, this.scene);
      this._disposeGroup(entry.mesh);
      this.pieces.delete(square);
    }

    animateCapture(piece, scene = this.scene) {
      console.log("animateCapture called");
      if (!piece || !scene) {
        return;
      }

      const T = this._T;
      const particleCount = 40;
      const worldPosition = new T.Vector3();
      piece.getWorldPosition(worldPosition);

      scene.remove(piece);

      for (let i = 0; i < particleCount; i += 1) {
        const material = new T.SpriteMaterial({
          color: 0xC9A84C,
          transparent: true,
          opacity: 1,
          depthWrite: false
        });
        const mesh = new T.Sprite(material);
        const size = 0.08 + Math.random() * 0.12;
        mesh.scale.set(size, size, size);
        mesh.position.copy(worldPosition);
        mesh.position.x += (Math.random() - 0.5) * 0.14;
        mesh.position.y += Math.random() * 0.35;
        mesh.position.z += (Math.random() - 0.5) * 0.14;

        const direction = new T.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 1.5,
          Math.random() * 2 - 1
        ).normalize();
        const speed = 0.04 + Math.random() * 0.07;
        const velocity = direction.multiplyScalar(speed);

        scene.add(mesh);
        this._activeParticles.push({
          mesh,
          velocity,
          startTime: performance.now()
        });
      }
    }

    _updateParticles() {
      const now = performance.now();
      this._activeParticles = this._activeParticles.filter((p) => {
        const elapsed = now - p.startTime;
        const t = elapsed / 600;
        if (t >= 1) {
          this.scene.remove(p.mesh);
          p.mesh.material.dispose();
          return false;
        }
        p.mesh.position.addScaledVector(p.velocity, 0.016);
        p.mesh.material.opacity = 1 - t;
        return true;
      });
    }

    showThreatLines(legalMoves = []) {
      this.clearThreatLines();
      const T = this._T;
      legalMoves.forEach((sq) => {
        const toMesh = this.squareMeshes.get(sq);
        const fromMesh = this.squareMeshes.get(this.selectedSquare);
        if (!toMesh || !fromMesh) return;

        const points = [
          new T.Vector3(fromMesh.position.x, 0.18, fromMesh.position.z),
          new T.Vector3(toMesh.position.x, 0.18, toMesh.position.z)
        ];
        const geo = new T.BufferGeometry().setFromPoints(points);
        const mat = new T.LineBasicMaterial({
          color: 0xC9A84C,
          transparent: true,
          opacity: 0.45,
          depthTest: false
        });
        const line = new T.Line(geo, mat);
        line.renderOrder = 10;
        this.scene.add(line);
        this._threatLines.push(line);
      });
    }

    clearThreatLines() {
      this._threatLines.forEach((line) => {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      });
      this._threatLines = [];
    }

    // Camera swings slightly toward the moving piece
    _cameraSwingToMove(fromXZ, toXZ) {
      // camera swing disabled — caused visible shake on every move
    }

    _cameraReturnToOverview(delay) {
      setTimeout(() => {
        const dur = 400;
        const t0  = performance.now();
        const step = (now) => {
          const t = Math.min((now - t0) / dur, 1);
          const e = 1 - Math.pow(1 - t, 3);
          // no-op now that swing is disabled, but keep the RAF for future use
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, delay);
    }

    // ─────────────────────────────────────────
    //  RENDER LOOP
    // ─────────────────────────────────────────

    _animate() {
      this._animFrameId = requestAnimationFrame(this._boundAnimate);
      const delta = this.clock.getDelta();
      this.torchTime += delta;
      this._updateParticles();

      // Torch flicker
      this.torchLights.forEach(({ light, base, phase }) => {
        light.intensity = base * (
          1 + 0.28 * Math.sin(this.torchTime * 7.1 + phase)
            + 0.14 * Math.sin(this.torchTime * 13.3 + phase * 1.7)
            + 0.07 * Math.sin(this.torchTime * 23.9 + phase * 0.8)
        );
      });

      // Flame pulse
      const fScale = 1 + 0.12 * Math.sin(this.torchTime * 9);
      this.flameMeshes.forEach((m, i) => {
        const s = fScale + 0.06 * Math.sin(this.torchTime * 6 + i);
        m.scale.setScalar(s);
      });

      // Legal-move dot gentle pulse
      const dotPulse = 0.9 + 0.12 * Math.sin(this.torchTime * 4);
      this.indicators.forEach(m => {
        if (m.material) m.material.emissiveIntensity = 0.4 * dotPulse;
      });

      this.renderer.render(this.scene, this.camera);
    }

    // ─────────────────────────────────────────
    //  INTERACTION
    // ─────────────────────────────────────────

    _onClick(e) {
      e.preventDefault();
      e.stopPropagation();

      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check pieces first, then squares
      const pieceMeshes = [];
      this.pieces.forEach(({ mesh }) => {
        mesh.traverse(child => { if (child.isMesh) pieceMeshes.push(child); });
      });
      const squareMeshList = Array.from(this.squareMeshes.values());

      const pieceHit  = this.raycaster.intersectObjects(pieceMeshes, false);
      const squareHit = this.raycaster.intersectObjects(squareMeshList, false);

      let square = null;

      if (pieceHit.length) {
        // Walk up to find the group with userData.square
        let obj = pieceHit[0].object;
        while (obj && !obj.userData.square) obj = obj.parent;
        if (obj) square = obj.userData.square;
      }

      if (!square && squareHit.length) {
        square = squareHit[0].object.userData.square;
      }

      if (square && this._onSquareClickCb) this._onSquareClickCb(square);
    }

    _onResize() {
      const w = Math.max(this.container.offsetWidth || window.innerWidth, 580);
      const h = Math.max(this.container.offsetHeight || window.innerHeight, 400);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    // ─────────────────────────────────────────
    //  UTILS
    // ─────────────────────────────────────────

    _disposeGroup(group) {
      group.traverse(child => {
        if (child.geometry && !child.userData?.sharedGeometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    _getViewportSize() {
      const bounds = this.container?.getBoundingClientRect?.();
      const width = Math.max(
        Math.round(bounds?.width || this.container?.clientWidth || 480),
        MIN_RENDER_WIDTH
      );
      const height = Math.max(
        Math.round(bounds?.height || this.container?.clientHeight || 480),
        MIN_RENDER_HEIGHT
      );

      return { width, height };
    }
  }

  global.ArcaneBoardV2 = ArcaneBoardV2;

})(window);
