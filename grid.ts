import { createCanvas } from '@napi-rs/canvas';
import { writeFile } from 'fs/promises';

// --- Configuration ---
const SCALE = 4; // 4x Resolution for high-quality (Retina) output

const CONFIG = {
  gridSize: 6,
  tileWidth: 100 * SCALE,        // Scaled up
  grassHeight: 15 * SCALE,
  soilHeight: 40 * SCALE,
  // Dynamic canvas sizing based on grid to ensure it fits
  canvasWidth: 1200 * SCALE,
  canvasHeight: 800 * SCALE,
  filename: 'isometric_grid_hd.png',
  dataFilename: 'grid_positions.json',
};

// --- Palette ---
const COLORS = {
  grass: {
    top: '#A6D858',
    sideLight: '#8BC34A',
    sideDark: '#7CB342',
    tuft: '#73A536',
    gridStroke: '#88B446' // <-- Added: Distinct darker green for grid lines
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

// Initialize Canvas
const canvas = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
const ctx = canvas.getContext('2d');

// --- Helper Functions ---

/**
 * Draws a filled polygon.
 * If strokeColor is provided, it draws a distinct border (for grid lines).
 * If not, it strokes with the fill color to seal sub-pixel seams.
 */
function drawPoly(points: {x: number, y: number}[], color: string, strokeColor?: string) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();

  // FIX: Use specific stroke if provided (grid lines), otherwise match fill (seam sealing)
  ctx.strokeStyle = strokeColor || color;
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();
}

function drawTuft(centerX: number, centerY: number) {
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

function drawIsoBlock(gridX: number, gridY: number, offsetX: number, offsetY: number) {
  const isoX = (gridX - gridY) * (CONFIG.tileWidth / 2);
  const isoY = (gridX + gridY) * (CONFIG.tileWidth / 4);

  const x = offsetX + isoX;
  const y = offsetY + isoY;

  const w = CONFIG.tileWidth;
  const h = CONFIG.tileWidth / 2;

  const topVerts = [
    { x: x, y: y },
    { x: x + w / 2, y: y + h / 2 },
    { x: x, y: y + h },
    { x: x - w / 2, y: y + h / 2 }
  ];

  // Store High-Res Position Data
  // (You can divide these by SCALE later if you need logical CSS pixels)
  positions.push({
    gridX,
    gridY,
    pixelX: Math.round(x),
    pixelY: Math.round(y + h / 2)
  });

  const soilY = y + CONFIG.grassHeight;
  
  // Right Face (Soil)
  drawPoly([
    { x: x, y: soilY + h },
    { x: x + w / 2, y: soilY + h / 2 },
    { x: x + w / 2, y: soilY + h / 2 + CONFIG.soilHeight },
    { x: x, y: soilY + h + CONFIG.soilHeight }
  ], COLORS.soil.sideDark);

  // Left Face (Soil)
  drawPoly([
    { x: x, y: soilY + h },
    { x: x - w / 2, y: soilY + h / 2 },
    { x: x - w / 2, y: soilY + h / 2 + CONFIG.soilHeight },
    { x: x, y: soilY + h + CONFIG.soilHeight }
  ], COLORS.soil.sideLight);

  // Right Face (Grass)
  drawPoly([
    { x: x, y: y + h },
    { x: x + w / 2, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 + CONFIG.grassHeight },
    { x: x, y: y + h + CONFIG.grassHeight }
  ], COLORS.grass.sideDark);

  // Left Face (Grass)
  drawPoly([
    { x: x, y: y + h },
    { x: x - w / 2, y: y + h / 2 },
    { x: x - w / 2, y: y + h / 2 + CONFIG.grassHeight },
    { x: x, y: y + h + CONFIG.grassHeight }
  ], COLORS.grass.sideLight);

  // Top Face (Now with Grid Stroke!)
  drawPoly(topVerts, COLORS.grass.top, COLORS.grass.gridStroke);

  // Random Details
  const seed = Math.sin(gridX * 12.9898 + gridY * 78.233) * 43758.5453;
  if ((seed - Math.floor(seed)) > 0.3) {
    const randX = (seed * 10) % (20 * SCALE) - (10 * SCALE);
    const randY = (seed * 20) % (10 * SCALE) - (5 * SCALE);
    drawTuft(x + randX, y + h/2 + randY);
  }
}

// --- Main Execution ---
console.log(`Generating Grid at ${SCALE}x Resolution...`);

const startX = CONFIG.canvasWidth / 2;
const startY = (CONFIG.canvasHeight - (CONFIG.gridSize * CONFIG.tileWidth/2)) / 2 + (50 * SCALE);

for (let y = 0; y < CONFIG.gridSize; y++) {
  for (let x = 0; x < CONFIG.gridSize; x++) {
    drawIsoBlock(x, y, startX, startY);
  }
}

const buffer = await canvas.encode('png');
await writeFile(CONFIG.filename, buffer);
await writeFile(CONFIG.dataFilename, JSON.stringify(positions, null, 2));

console.log(`✅ HD Grid generated: ${CONFIG.filename} (${CONFIG.canvasWidth}x${CONFIG.canvasHeight})`);
console.log(`✅ Positions saved: ${CONFIG.dataFilename}`);