/**
 * chessPieces.js
 * Harry Potter Magical Chess — Procedural piece generator
 * Uses Three.js LatheGeometry (no external model files needed)
 *
 * USAGE:
 *   import { createPiece } from './chessPieces.js';
 *   const piece = createPiece('queen', 'white');
 *   scene.add(piece);
 *
 * TYPES:  'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king'
 * COLORS: 'white' | 'black'
 *
 * White pieces automatically face black (rotation.y = Math.PI).
 * Each piece is a THREE.Group containing mesh + glow light.
 */

// ─── MATERIALS ────────────────────────────────────────────────────────────────

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color:             color === 'white' ? 0xf5e6c8 : 0x1a0505,
    emissive:          color === 'white' ? 0x3333cc : 0x660033,
    emissiveIntensity: 0.25,
    roughness:         0.3,
    metalness:         0.7,
  });
}

// Glowing inner light — gives each piece the "enchanted" look
function createPieceLight(color) {
  const lightColor = color === 'white' ? 0x6688ff : 0xff2244;
  const light = new THREE.PointLight(lightColor, 0.8, 1.5);
  light.position.set(0, 0.4, 0);
  return light;
}

// ─── GEOMETRY PROFILES (LatheGeometry point arrays) ───────────────────────────
// Each array is a list of Vector2(radius, height) points.
// LatheGeometry spins them 360° around the Y-axis.

function pawnPoints() {
  return [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.28, 0.00), // wide base
    new THREE.Vector2(0.30, 0.06),
    new THREE.Vector2(0.22, 0.12),
    new THREE.Vector2(0.13, 0.18), // narrow stem
    new THREE.Vector2(0.10, 0.42),
    new THREE.Vector2(0.10, 0.45),
    new THREE.Vector2(0.19, 0.55), // collar
    new THREE.Vector2(0.19, 0.60),
    new THREE.Vector2(0.22, 0.68), // head bulge
    new THREE.Vector2(0.20, 0.80),
    new THREE.Vector2(0.15, 0.88),
    new THREE.Vector2(0.00, 0.92),
  ];
}

function rookPoints() {
  return [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.32, 0.00),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.26, 0.14),
    new THREE.Vector2(0.18, 0.20),
    new THREE.Vector2(0.16, 0.65),
    new THREE.Vector2(0.24, 0.70), // battlements shoulder
    new THREE.Vector2(0.27, 0.72),
    new THREE.Vector2(0.27, 0.95), // tower top
    new THREE.Vector2(0.00, 0.95),
  ];
}

function bishopPoints() {
  return [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.30, 0.00),
    new THREE.Vector2(0.32, 0.07),
    new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.14, 0.22),
    new THREE.Vector2(0.11, 0.50),
    new THREE.Vector2(0.18, 0.58), // collar ring
    new THREE.Vector2(0.18, 0.64),
    new THREE.Vector2(0.10, 0.70),
    new THREE.Vector2(0.07, 0.88), // tall mitre taper
    new THREE.Vector2(0.04, 1.00),
    new THREE.Vector2(0.02, 1.06),
    new THREE.Vector2(0.00, 1.08),
  ];
}

function queenPoints() {
  return [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.34, 0.00),
    new THREE.Vector2(0.36, 0.08),
    new THREE.Vector2(0.26, 0.16),
    new THREE.Vector2(0.17, 0.26),
    new THREE.Vector2(0.14, 0.52),
    new THREE.Vector2(0.22, 0.60), // waist flare
    new THREE.Vector2(0.20, 0.68),
    new THREE.Vector2(0.24, 0.76), // crown base
    new THREE.Vector2(0.22, 0.82),
    new THREE.Vector2(0.18, 0.88),
    new THREE.Vector2(0.14, 0.96), // crown points
    new THREE.Vector2(0.10, 1.02),
    new THREE.Vector2(0.05, 1.08),
    new THREE.Vector2(0.00, 1.10),
  ];
}

function kingPoints() {
  return [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.36, 0.00),
    new THREE.Vector2(0.38, 0.08),
    new THREE.Vector2(0.28, 0.16),
    new THREE.Vector2(0.18, 0.28),
    new THREE.Vector2(0.15, 0.55),
    new THREE.Vector2(0.24, 0.64), // wide crown base
    new THREE.Vector2(0.26, 0.72),
    new THREE.Vector2(0.22, 0.80),
    new THREE.Vector2(0.16, 0.86),
    new THREE.Vector2(0.10, 0.92),
    new THREE.Vector2(0.08, 1.00), // cross shaft
    new THREE.Vector2(0.08, 1.04),
    new THREE.Vector2(0.00, 1.04),
  ];
}

// Knight is special — LatheGeometry can't make a horse head,
// so we build it from primitives (box body + sphere head + horn)
function buildKnight(color) {
  const mat = createMaterial(color);
  const group = new THREE.Group();

  // Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.32, 0.12, 20),
    mat
  );
  base.position.y = 0.06;
  group.add(base);

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.40, 14),
    mat
  );
  stem.position.y = 0.32;
  group.add(stem);

  // Neck (angled box)
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.38, 0.18),
    mat
  );
  neck.position.set(0.04, 0.72, 0);
  neck.rotation.z = -0.22;
  group.add(neck);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.26, 0.16),
    mat
  );
  head.position.set(0.10, 0.96, 0);
  group.add(head);

  // Snout
  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.12, 0.13),
    mat
  );
  snout.position.set(0.20, 0.88, 0);
  group.add(snout);

  // Ear
  const ear = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.10, 8),
    mat
  );
  ear.position.set(0.06, 1.12, 0);
  group.add(ear);

  return group;
}

// ─── LATHE BUILDER ────────────────────────────────────────────────────────────

function buildLathe(points, color) {
  const geometry = new THREE.LatheGeometry(points, 32);
  const material  = createMaterial(color);
  return new THREE.Mesh(geometry, material);
}

// ─── MAIN FACTORY ─────────────────────────────────────────────────────────────

/**
 * createPiece(type, color)
 * Returns a THREE.Group ready to be positioned and added to your scene.
 *
 * @param {string} type  - 'pawn'|'rook'|'knight'|'bishop'|'queen'|'king'
 * @param {string} color - 'white'|'black'
 * @returns {THREE.Group}
 */
export function createPiece(type, color) {
  const group = new THREE.Group();

  let mesh;
  switch (type) {
    case 'pawn':   mesh = buildLathe(pawnPoints(),   color); break;
    case 'rook':   mesh = buildLathe(rookPoints(),   color); break;
    case 'bishop': mesh = buildLathe(bishopPoints(), color); break;
    case 'queen':  mesh = buildLathe(queenPoints(),  color); break;
    case 'king':   mesh = buildLathe(kingPoints(),   color); break;
    case 'knight': mesh = buildKnight(color);                break;
    default:
      console.warn(`chessPieces.js: unknown type "${type}", falling back to pawn`);
      mesh = buildLathe(pawnPoints(), color);
  }

  group.add(mesh);
  group.add(createPieceLight(color));

  // Tag for raycasting / game logic identification
  group.userData.pieceType  = type;
  group.userData.pieceColor = color;

  // White pieces face the black side
  if (color === 'white') {
    group.rotation.y = Math.PI;
  }

  return group;
}

// ─── CONVENIENCE: spawn a full starting set ───────────────────────────────────

/**
 * createFullSet(color)
 * Returns an array of 16 groups in standard chess order.
 * You still need to position them on your board.
 *
 * Order: [rook, knight, bishop, queen, king, bishop, knight, rook,
 *          pawn, pawn, pawn, pawn, pawn, pawn, pawn, pawn]
 *
 * @param {string} color - 'white'|'black'
 * @returns {THREE.Group[]}
 */
export function createFullSet(color) {
  const backRow  = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
  const frontRow = Array(8).fill('pawn');
  return [...backRow, ...frontRow].map(type => createPiece(type, color));
}
