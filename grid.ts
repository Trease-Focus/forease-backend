import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile, readFile } from 'fs/promises';

// --- Configuration ---
const SCALE = 4; // 4x Resolution for high-quality (Retina) output

interface TreeConfig {
  imagePath: string;
  gridX: number;
  gridY: number;
  scale: number;
  trunkStartPosition: { x: number; y: number; };
}

const CONFIG = {
  tileWidth: 100 * SCALE,
  grassHeight: 15 * SCALE,
  soilHeight: 40 * SCALE,
  filename: 'isometric_grid_with_trees.png',
  dataFilename: 'grid_positions.json',
  treeConfigFilename: 'tree-config.json',
  // These will be set dynamically
  gridSize: 0,
  canvasWidth: 0,
  canvasHeight: 0,
};

// --- Palette ---
const COLORS = {
  grass: {
    top: '#A6D858',
    sideLight: '#8BC34A',
    sideDark: '#7CB342',
    tuft: '#73A536',
    gridStroke: '#88B446'
  },
  soil: {
    sideLight: '#795548',
    sideDark: '#5D4037',
  }
};

interface GridPosition {
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
}

const positions: GridPosition[] = [];
let treePlacements: TreeConfig[] = [];

// --- Helper Functions ---

/**
 * Draws a filled polygon.
 */
function drawPoly(ctx: any, points: {x: number, y: number}[], color: string, strokeColor?: string) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = strokeColor || color;
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();
}

function drawTuft(ctx: any, centerX: number, centerY: number) {
  ctx.strokeStyle = COLORS.grass.tuft;
  ctx.lineWidth = 2 * SCALE;
  ctx.lineCap = 'round';
  
  const size = 6 * SCALE;
  
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY - size/2);
  ctx.lineTo(centerX, centerY + size/2);
  ctx.lineTo(centerX + size, centerY - size/2);
  ctx.stroke();
}

function drawIsoBlock(ctx: any, gridX: number, gridY: number, offsetX: number, offsetY: number, hasTree: boolean) {
  const isoX = (gridX - gridY) * (CONFIG.tileWidth / 2);
  const isoY = (gridX + gridY) * (CONFIG.tileWidth / 4);

  const x = offsetX + isoX;
  const y = offsetY + isoY;

  const w = CONFIG.tileWidth;
  const h = CONFIG.tileWidth / 2;

  const topCenterY = y + h / 2;

  // This function no longer needs to push to the global `positions` array
  // as we pre-calculate them now.
  /*
  positions.push({
    gridX,
    gridY,
    pixelX: Math.round(x),
    pixelY: Math.round(topCenterY)
  });
  */

  const soilY = y + CONFIG.grassHeight;
  
  // Right Face (Soil)
  drawPoly(ctx, [
    { x: x, y: soilY + h },
    { x: x + w / 2, y: soilY + h / 2 },
    { x: x + w / 2, y: soilY + h / 2 + CONFIG.soilHeight },
    { x: x, y: soilY + h + CONFIG.soilHeight }
  ], COLORS.soil.sideDark);

  // Left Face (Soil)
  drawPoly(ctx, [
    { x: x, y: soilY + h },
    { x: x - w / 2, y: soilY + h / 2 },
    { x: x - w / 2, y: soilY + h / 2 + CONFIG.soilHeight },
    { x: x, y: soilY + h + CONFIG.soilHeight }
  ], COLORS.soil.sideLight);

  // Right Face (Grass)
  drawPoly(ctx, [
    { x: x, y: y + h },
    { x: x + w / 2, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 + CONFIG.grassHeight },
    { x: x, y: y + h + CONFIG.grassHeight }
  ], COLORS.grass.sideDark);

  // Left Face (Grass)
  drawPoly(ctx, [
    { x: x, y: y + h },
    { x: x - w / 2, y: y + h / 2 },
    { x: x - w / 2, y: y + h / 2 + CONFIG.grassHeight },
    { x: x, y: y + h + CONFIG.grassHeight }
  ], COLORS.grass.sideLight);

  // Top Face
  const topVerts = [
    { x: x, y: y },
    { x: x + w / 2, y: y + h / 2 },
    { x: x, y: y + h },
    { x: x - w / 2, y: y + h / 2 }
  ];
  drawPoly(ctx, topVerts, COLORS.grass.top, COLORS.grass.gridStroke);

  // Random Details - only if no tree is on this tile
  if (!hasTree) {
    const seed = Math.sin(gridX * 12.9898 + gridY * 78.233) * 43758.5453;
    if ((seed - Math.floor(seed)) > 0.5) { // 50% chance
      const randX = (seed * 10) % (20 * SCALE) - (10 * SCALE);
      const randY = (seed * 20) % (10 * SCALE) - (5 * SCALE);
      drawTuft(ctx, x + randX, topCenterY + randY);
    }
  }
}

// --- Main Execution ---
async function main() {
  console.log("Reading configuration files...");
  try {
    const treeConfigFile = await readFile(CONFIG.treeConfigFilename, 'utf-8');
    const treeConfigData = JSON.parse(treeConfigFile);
    treePlacements = treeConfigData.trees;
  } catch (error) {
    console.error(`Error reading or parsing configuration files:`, error);
    return;
  }

  // Determine grid size from tree placements
  let maxGridDim = 3; // Minimum size
  for (const tree of treePlacements) {
    if (tree.gridX > maxGridDim - 1) maxGridDim = tree.gridX + 1;
    if (tree.gridY > maxGridDim - 1) maxGridDim = tree.gridY + 1;
  }
  CONFIG.gridSize = maxGridDim;

  // Dynamically set canvas size
  const totalGridWidth = (CONFIG.gridSize * 2) * (CONFIG.tileWidth / 2);
  CONFIG.canvasWidth = totalGridWidth + (100 * SCALE);
  CONFIG.canvasHeight = (CONFIG.gridSize) * (CONFIG.tileWidth / 2) + (CONFIG.soilHeight + CONFIG.grassHeight) * 2 + (200 * SCALE);


  const canvas = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
  const ctx = canvas.getContext('2d');

  console.log(`Generating ${CONFIG.gridSize}x${CONFIG.gridSize} Grid at ${SCALE}x Resolution...`);

  const startX = CONFIG.canvasWidth / 2;
  const startY = (150 * SCALE);

  // Create a map for quick lookup of trees by grid position
  const treeMap = new Map<string, TreeConfig>();
  for (const tree of treePlacements) {
    treeMap.set(`${tree.gridX},${tree.gridY}`, tree);
  }

  // Load all unique tree images
  const loadedTrees = new Map<string, any>();
  for (const tree of treePlacements) {
      if (!loadedTrees.has(tree.imagePath)) {
          try {
            const image = await loadImage(tree.imagePath);
            loadedTrees.set(tree.imagePath, image);
            console.log(`Loaded image: ${tree.imagePath}`);
          } catch (e) {
              console.error(`Could not load image: ${tree.imagePath}`);
          }
      }
  }

  // First, generate all grid positions
  for (let y = 0; y < CONFIG.gridSize; y++) {
    for (let x = 0; x < CONFIG.gridSize; x++) {
        const isoX = (x - y) * (CONFIG.tileWidth / 2);
        const isoY = (x + y) * (CONFIG.tileWidth / 4);
        const pixelX = startX + isoX;
        const pixelY = startY + isoY + (CONFIG.tileWidth / 4);
        positions.push({
            gridX: x,
            gridY: y,
            pixelX: Math.round(pixelX),
            pixelY: Math.round(pixelY)
        });
    }
  }

  // Draw grid and objects in sorted order
  const sortedPositions = [...positions].sort((a, b) => {
    return (a.gridY + a.gridX) - (b.gridY + b.gridX);
  });

  for (const pos of sortedPositions) {
    const hasTree = treeMap.has(`${pos.gridX},${pos.gridY}`);
    drawIsoBlock(ctx, pos.gridX, pos.gridY, startX, startY, hasTree);

    const treeConfig = treeMap.get(`${pos.gridX},${pos.gridY}`);
    if (treeConfig) {
        const image = loadedTrees.get(treeConfig.imagePath);
        if (image) {
            const treeScale = treeConfig.scale || 0.5;
            const w = image.width * treeScale;
            const h = image.height * treeScale;
            
            const trunkOffsetX = (1080 - treeConfig.trunkStartPosition.x) * treeScale;
            const trunkOffsetY = ( treeConfig.trunkStartPosition.y) * treeScale;

            const drawX = pos.pixelX - trunkOffsetX;
            const drawY = pos.pixelY - trunkOffsetY;

            ctx.drawImage(image, drawX, drawY, w, h);
        }
    }
  }

  const buffer = await canvas.encode('png');
  await writeFile(CONFIG.filename, buffer);
  await writeFile(CONFIG.dataFilename, JSON.stringify(positions, null, 2));

  console.log(`✅ HD Grid with trees generated: ${CONFIG.filename} (${CONFIG.canvasWidth}x${CONFIG.canvasHeight})`);
  console.log(`✅ Positions saved: ${CONFIG.dataFilename}`);
}

main().catch(console.error);