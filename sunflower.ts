import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { spawn } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';

// --- CONFIGURATION ---
const CONFIG = {
    width: 1080, 
    height: 1080,
    fps: 30, 
    durationSeconds: 30, 
    seed: randomBytes(16).toString('hex'), 
    filename: "pretty_sunflower.webm",
    imageFilename: randomBytes(16).toString('hex') + ".png",
    padding: 80 
};

// --- TYPES & MATH HELPERS ---

class Vector2 {
    constructor(public x: number, public y: number) {}
    static zero = () => new Vector2(0, 0);
}

class SeededRandom {
    private seed: number;

    constructor(seedString: string) {
        const hash = createHash('sha256').update(seedString).digest('hex');
        this.seed = parseInt(hash.substring(0, 15), 16);
    }

    next(): number {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    nextFloat(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    nextInt(min: number, max: number): number {
        return Math.floor(this.nextFloat(min, max));
    }
}

interface Color {
    r: number; g: number; b: number; a: number;
}

interface Entity {
    center: Vector2;
    radius: number;
    baseColor: Color;
    highlightColor: Color;
    type: 'leaf' | 'petal' | 'seed'; // Added 'petal' and 'seed'
    distFromRoot: number; 
    opacity?: number; 
}

class Branch {
    constructor(
        public start: Vector2,
        public end: Vector2,
        public strokeWidth: number,
        public control: Vector2,
        public length: number, 
        public distFromRoot: number, 
        public children: Branch[] = [],
        public entities: Entity[] = []
    ) {}
}

class SimpleBranch {
    constructor(
        public start: Vector2,
        public end: Vector2,
        public strokeWidth: number,
        public control: Vector2
    ) {}
}

interface Bounds {
    minX: number; maxX: number; minY: number; maxY: number;
}

// --- LOGIC ---

const coerceIn = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

function smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
}

/**
 * Generates a Sunflower.
 * - Logic: Single main stalk with large leaves, terminating in a Fibonacci spiral head.
 */
function generateSunflower(
    rand: SeededRandom,
    start: Vector2,
    length: number,
    angle: number,
    segmentsLeft: number,
    currentDist: number
): Branch {
    
    // 1. Calculate Stem Segment
    // Slight waviness to the stalk, but mostly vertical
    const angleOffset = rand.nextFloat(-5, 5); 
    const radAngle = (angle + angleOffset) * (Math.PI / 180);
    
    const endX = start.x + length * Math.cos(radAngle);
    const endY = start.y + length * Math.sin(radAngle);
    const end = new Vector2(endX, endY);

    // Control point for curve
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    // Slight bend
    const control = new Vector2(
        midX + rand.nextFloat(-10, 10), 
        midY + rand.nextFloat(-10, 10)
    );
    
    // Stalk gets thinner near the top
    const strokeWidth = Math.max(8, segmentsLeft * 3.5); 

    const children: Branch[] = [];
    const entities: Entity[] = [];

    // 2. Logic: Am I the flower head or the stalk?
    
    if (segmentsLeft > 0) {
        // --- STALK GENERATION ---
        
        // Add Leaves along the stem (Alternate sides)
        // We only add leaves if we aren't at the very top neck
        if (segmentsLeft < 7 && segmentsLeft > 1) { 
            const isLeft = segmentsLeft % 2 === 0;
            const leafDir = isLeft ? -1 : 1;
            
            // Calculate a position for the leaf petiole (small stem)
            const leafStart = new Vector2(
                start.x * 0.5 + end.x * 0.5,
                start.y * 0.5 + end.y * 0.5
            );
            
            // Big Sunflower Leaves
            const leafRadius = rand.nextFloat(50, 70);
            const petioleLen = 40;
            
            const leafX = leafStart.x + (petioleLen * leafDir);
            const leafY = leafStart.y - 10; // Slightly up

            entities.push({
                center: new Vector2(leafX, leafY),
                radius: leafRadius,
                baseColor: { r: 50, g: 120, b: 50, a: 1.0 }, // Deep Green
                highlightColor: { r: 80, g: 160, b: 80, a: 1.0 },
                type: 'leaf',
                distFromRoot: currentDist + (length * 0.5)
            });
        }

        // Continue Stalk Upwards
        const newLength = length * 0.95; // Segments get slightly shorter
        children.push(generateSunflower(
            rand,
            end,
            newLength,
            angle + rand.nextFloat(-2, 2), // Keep relatively straight
            segmentsLeft - 1,
            currentDist + length
        ));

    } else {
        // --- FLOWER HEAD GENERATION (The Top) ---
        
        // 1. Petals (Ray Florets) - Outer Ring
        const petalCount = rand.nextInt(20, 30);
        const petalRadius = 110; // Distance from center
        
        for (let i = 0; i < petalCount; i++) {
            const pAngle = (i / petalCount) * Math.PI * 2;
            // Slight jitter in position
            const r = petalRadius + rand.nextFloat(-10, 10);
            
            const pX = end.x + Math.cos(pAngle) * r;
            const pY = end.y + Math.sin(pAngle) * r;

            entities.push({
                center: new Vector2(pX, pY),
                radius: rand.nextFloat(35, 45), // Large petals
                baseColor: { r: 255, g: 204, b: 0, a: 1.0 }, // Gold/Yellow
                highlightColor: { r: 255, g: 230, b: 100, a: 1.0 },
                type: 'petal',
                distFromRoot: currentDist
            });
        }

        // 2. Seeds (Disc Florets) - Fibonacci Spiral
        const seedCount = 150; 
        const goldenAngle = 137.508 * (Math.PI / 180);
        const spread = 7; // Spacing factor

        for (let i = 0; i < seedCount; i++) {
            // Radius from center based on index
            const r = spread * Math.sqrt(i); 
            const theta = i * goldenAngle;

            const sX = end.x + r * Math.cos(theta);
            const sY = end.y + r * Math.sin(theta);

            // Inner seeds dark, outer seeds slightly lighter
            const isCenter = i < (seedCount * 0.3);
            
            const rCol = isCenter ? 40 : 60;
            const gCol = isCenter ? 25 : 40;
            const bCol = isCenter ? 10 : 15;

            entities.push({
                center: new Vector2(sX, sY),
                radius: rand.nextFloat(6, 9), // Small seeds
                baseColor: { r: rCol, g: gCol, b: bCol, a: 1.0 }, // Dark Brown
                highlightColor: { r: rCol+30, g: gCol+20, b: bCol+10, a: 1.0 },
                type: 'seed',
                distFromRoot: currentDist + (i * 0.5) // Slight delay per seed spiral
            });
        }
    }

    return new Branch(start, end, strokeWidth, control, length, currentDist, children, entities);
}

// Recurse tree to find min/max coords
function calculateBounds(b: Branch, currentBounds: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }): Bounds {
    currentBounds.minX = Math.min(currentBounds.minX, b.start.x, b.end.x, b.control.x);
    currentBounds.maxX = Math.max(currentBounds.maxX, b.start.x, b.end.x, b.control.x);
    currentBounds.minY = Math.min(currentBounds.minY, b.start.y, b.end.y, b.control.y);
    currentBounds.maxY = Math.max(currentBounds.maxY, b.start.y, b.end.y, b.control.y);

    b.entities.forEach(e => {
        currentBounds.minX = Math.min(currentBounds.minX, e.center.x - e.radius);
        currentBounds.maxX = Math.max(currentBounds.maxX, e.center.x + e.radius);
        currentBounds.minY = Math.min(currentBounds.minY, e.center.y - e.radius);
        currentBounds.maxY = Math.max(currentBounds.maxY, e.center.y + e.radius);
    });

    b.children.forEach(child => calculateBounds(child, currentBounds));
    return currentBounds;
}

function getMaxDist(b: Branch): number {
    let max = b.distFromRoot + b.length;
    // Also account for entity delays (specifically spiral seeds)
    b.entities.forEach(e => {
        max = Math.max(max, e.distFromRoot);
    });
    for (const child of b.children) {
        max = Math.max(max, getMaxDist(child));
    }
    return max;
}

// --- FLATTENING WITH SCALING & ORGANIC TIMING ---
function flattenTreeOrganic(
    b: Branch,
    branchList: SimpleBranch[],
    entityList: Entity[],
    progressDistance: number, 
    scale: number,
    offsetX: number,
    offsetY: number
) {
    const tStart = new Vector2(b.start.x * scale + offsetX, b.start.y * scale + offsetY);
    const tEnd = new Vector2(b.end.x * scale + offsetX, b.end.y * scale + offsetY);
    const tControl = new Vector2(b.control.x * scale + offsetX, b.control.y * scale + offsetY);
    
    const startDist = b.distFromRoot;

    if (progressDistance > startDist) {
        let localT = (progressDistance - startDist) / b.length;
        localT = coerceIn(localT, 0, 1);
        
        if (localT > 0) {
            const omt = 1 - localT;
            const curControlX = omt * tStart.x + localT * tControl.x;
            const curControlY = omt * tStart.y + localT * tControl.y;
            const q1X = omt * tControl.x + localT * tEnd.x;
            const q1Y = omt * tControl.y + localT * tEnd.y;
            const curEndX = omt * curControlX + localT * q1X;
            const curEndY = omt * curControlY + localT * q1Y;

            const visibleStroke = b.strokeWidth * scale; // Stalks don't taper as much visibly in width during growth

            branchList.push(new SimpleBranch(
                tStart,
                new Vector2(curEndX, curEndY),
                visibleStroke,
                new Vector2(curControlX, curControlY)
            ));

            b.entities.forEach(entity => {
                if (progressDistance > entity.distFromRoot) {
                    const age = progressDistance - entity.distFromRoot;
                    // Seeds pop faster than large leaves
                    const fadeSpeed = entity.type === 'seed' ? 50 : 150; 
                    let fadeP = age / fadeSpeed;
                    fadeP = coerceIn(fadeP, 0, 1);
                    
                    const opacity = smoothStep(fadeP);

                    if (opacity > 0.01) {
                        entityList.push({
                            ...entity,
                            center: new Vector2(entity.center.x * scale + offsetX, entity.center.y * scale + offsetY),
                            radius: entity.radius * scale,
                            opacity: opacity
                        });
                    }
                }
            });
        }
    }

    b.children.forEach(child => {
        flattenTreeOrganic(child, branchList, entityList, progressDistance, scale, offsetX, offsetY);
    });
}

// --- RENDERER ---

async function generateVideo() {
    console.log("🌻 Initializing Sunflower Generator...");
    
    const canvas = createCanvas(CONFIG.width, CONFIG.height);
    const ctx = canvas.getContext('2d');

    const rand = new SeededRandom(CONFIG.seed);
    
    const startPos = new Vector2(0, 0); 
    const initialLength = 120; // Stalk segments
    
    console.log("🌱 Growing logical structure...");
    // Depth corresponds to stalk segments. 8 segments high.
    const segments = 8;
    
    const fullTree = generateSunflower(
        rand,
        startPos,
        initialLength,
        -90, // Straight Up
        segments,
        0
    );

    // --- AUTO-FIT LOGIC ---
    console.log("📐 Calculating bounds and scale...");
    const bounds = calculateBounds(fullTree);
    const treeWidth = bounds.maxX - bounds.minX;
    const treeHeight = bounds.maxY - bounds.minY;

    const availW = CONFIG.width - (CONFIG.padding * 2);
    const availH = CONFIG.height - (CONFIG.padding * 2);

    const scaleX = availW / treeWidth;
    const scaleY = availH / treeHeight;
    const finalScale = Math.min(scaleX, scaleY);

    const treeCenterX = bounds.minX + (treeWidth / 2);
    const targetCenterX = CONFIG.width / 2;
    const offsetX = targetCenterX - (treeCenterX * finalScale);

    const offsetY = (CONFIG.height - CONFIG.padding) - (bounds.maxY * finalScale);

    console.log(`   Size: ${treeWidth.toFixed(0)}x${treeHeight.toFixed(0)}`);
    console.log(`   Scale: ${finalScale.toFixed(3)}`);

    const maxDistance = getMaxDist(fullTree);

    const ffmpegArgs = [
        '-y',
        '-f', 'image2pipe',
        '-r', `${CONFIG.fps}`,
        '-i', '-',
        '-c:v', 'libvpx-vp9',
        '-b:v', '4M',
        '-pix_fmt', 'yuva420p', 
        '-auto-alt-ref', '0',
        CONFIG.filename
    ];

    console.log(`🎥 Spawning FFmpeg process: ${CONFIG.filename}`);
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', () => {}); 

    ffmpeg.on('close', (code) => {
        console.log(`✅ Video generation complete!`);
        console.log(`FILES CREATED:`);
        console.log(`   1. Video: ${CONFIG.filename}`);
        console.log(`   2. Image: ${CONFIG.imageFilename}`);
    });

    const totalFrames = CONFIG.durationSeconds * CONFIG.fps;
    
    for (let frame = 0; frame < totalFrames; frame++) {
        const t = frame / (totalFrames - 1);
        
        const currentGrowthDist = t * (maxDistance + 300); 

        ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

        const branches: SimpleBranch[] = [];
        let entities: Entity[] = []; 

        flattenTreeOrganic(fullTree, branches, entities, currentGrowthDist, finalScale, offsetX, offsetY);

        // Sorting for Painter's Algorithm:
        // 1. Back Leaves
        // 2. Stalk (Branches)
        // 3. Petals
        // 4. Seeds (Center Disc)
        
        // Split entities
        const leaves = entities.filter(e => e.type === 'leaf');
        const petals = entities.filter(e => e.type === 'petal');
        const seeds = entities.filter(e => e.type === 'seed');

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // DRAW LEAVES (Behind stalk)
        for (const e of leaves) {
            drawEntity(ctx, e);
        }

        // DRAW STALK
        ctx.strokeStyle = '#2E7D32'; // Dark Stalk Green
        for (const b of branches) {
            ctx.beginPath();
            ctx.lineWidth = b.strokeWidth;
            ctx.moveTo(b.start.x, b.start.y);
            ctx.quadraticCurveTo(b.control.x, b.control.y, b.end.x, b.end.y);
            ctx.stroke();
            
            // Highlight
            if(b.strokeWidth > 2) {
                ctx.strokeStyle = '#4CAF50'; 
                ctx.lineWidth = b.strokeWidth * 0.4;
                const off = -2;
                ctx.beginPath();
                ctx.moveTo(b.start.x+off, b.start.y);
                ctx.quadraticCurveTo(b.control.x+off, b.control.y, b.end.x+off, b.end.y);
                ctx.stroke();
                ctx.strokeStyle = '#2E7D32'; // Reset
            }
        }

        // DRAW PETALS
        for (const e of petals) {
            drawEntity(ctx, e);
        }

        // DRAW SEEDS (Center Disc)
        // Sort seeds so outer ones don't cover inner ones incorrectly if overlapping
        seeds.sort((a,b) => a.distFromRoot - b.distFromRoot);
        for (const e of seeds) {
            drawEntity(ctx, e);
        }

        const buffer = canvas.toBuffer('image/png');
        const ok = ffmpeg.stdin.write(buffer);
        if (!ok) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));

        if (frame % 30 === 0) {
            const pct = Math.round((frame / totalFrames) * 100);
            process.stdout.write(`\rProgress: ${pct}%`);
        }
    }

    console.log("\n📸 Saving final sunflower snapshot...");
    const finalBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(CONFIG.imageFilename, finalBuffer);

    ffmpeg.stdin.end();
}

function drawEntity(ctx: CanvasRenderingContext2D, e: Entity) {
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = (e.opacity ?? 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(e.center.x + 2, e.center.y + 3, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Gradient
    const g = ctx.createRadialGradient(
        e.center.x - e.radius * 0.3, 
        e.center.y - e.radius * 0.3, 
        e.radius * 0.1, 
        e.center.x, 
        e.center.y, 
        e.radius
    );

    g.addColorStop(0, `rgba(${e.highlightColor.r},${e.highlightColor.g},${e.highlightColor.b},1)`);
    g.addColorStop(1, `rgba(${e.baseColor.r},${e.baseColor.g},${e.baseColor.b},1)`);

    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(e.center.x, e.center.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Specific detailing based on type
    if (e.type === 'leaf') {
        // Vein
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.center.x, e.center.y - e.radius + 5);
        ctx.lineTo(e.center.x, e.center.y + e.radius - 5);
        ctx.stroke();
    }
    
    // Shine for seeds
    if (e.type === 'seed') {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(e.center.x - 1, e.center.y - 1, e.radius * 0.3, 0, Math.PI*2);
        ctx.fill();
    }

    ctx.globalAlpha = prevAlpha;
}

generateVideo().catch(err => console.error(err));