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
    filename: "pretty_pine.webm", // Renamed for clarity
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
    type: 'leaf' | 'fruit';
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

function easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

function smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
}

function generateFullTree(
    rand: SeededRandom,
    start: Vector2,
    length: number,
    angle: number,
    depth: number,
    currentDist: number
): Branch {
    // 1. Calculate End Point
    // Pine Logic: Keep the main angle tighter for vertical growth
    const angleOffset = rand.nextFloat(-10, 10); 
    const radAngle = (angle + angleOffset) * (Math.PI / 180);
    
    const endX = start.x + length * Math.cos(radAngle);
    const endY = start.y + length * Math.sin(radAngle);
    const end = new Vector2(endX, endY);

    // 2. Calculate Control Point (Less curvy than bonsai, straighter timber)
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const mid = new Vector2(start.x + dx * 0.5, start.y + dy * 0.5);
    
    const perpLen = rand.nextFloat(-0.05, 0.05) * length; // Reduced curvature magnitude
    const branchLength = Math.sqrt(dx * dx + dy * dy);
    
    let perpX = 0, perpY = 0;
    if (branchLength !== 0) {
        perpX = (-dy / branchLength) * perpLen;
        perpY = (dx / branchLength) * perpLen;
    }

    const control = new Vector2(mid.x + perpX, mid.y + perpY);
    
    // Pine Logic: Thicker trunk at base, tapers gradually
    const strokeWidth = Math.max(2, (depth * 5 + rand.nextFloat(-1, 1)));

    const children: Branch[] = [];
    const entities: Entity[] = [];

    // 3. Branching Logic (Pine Style)
    if (depth > 0) {
        // Pine Logic: Usually 1 central leader and 2 side branches
        const hasLeader = true;
        
        // A. The Central Leader (continues upward)
        if (hasLeader) {
            const newAngle = angle + rand.nextFloat(-10, 10); // Keep growing up
            const newLength = length * rand.nextFloat(0.85, 0.95);
            children.push(generateFullTree(
                rand, end, newLength, newAngle, depth - 1, currentDist + length
            ));
        }

        // B. Side Branches (Whorls)
        const sideBranchCount = rand.nextInt(1, 3);
        for (let i = 0; i < sideBranchCount; i++) {
            // Pine branches come out wider, closer to horizontal
            const sideDir = rand.nextFloat(0, 1) > 0.5 ? 1 : -1;
            const angleVariation = rand.nextFloat(60, 85) * sideDir; 
            const newAngle = angle + angleVariation;
            
            // Side branches are significantly shorter than the trunk segment to form a cone shape
            const newLength = length * rand.nextFloat(0.5, 0.7); 
            
            // Only spawn side branch if depth is sufficient (keeps top pointy)
            if (depth > 1) {
                children.push(generateFullTree(
                    rand, end, newLength, newAngle, depth - 1, currentDist + length
                ));
            }
        }
    }

    // 4. Entity Generation (Needle Clusters & Cones)
    if (depth <= 5) { 
        // More clusters for dense pine look
        const count = rand.nextInt(6, 10); 
        for (let i = 0; i < count; i++) {
            // Pine Logic: Smaller radius for needle clusters
            const radius = rand.nextFloat(15, 25); 
            
            const t = rand.nextFloat(0.1, 1.0); 
            const px = (1-t)*start.x + t*end.x;
            const py = (1-t)*start.y + t*end.y;
            
            // Clusters stay closer to the branch
            const offsetX = rand.nextFloat(-15, 15);
            const offsetY = rand.nextFloat(-15, 15);

            const eX = px + offsetX;
            const eY = py + offsetY;
            
            const entityDist = currentDist + (length * t);

            // Decision: Cone or Needles?
            // Cones are rare
            const isCone = depth <= 4 && rand.nextFloat(0, 1) > 0.92; 

            if (isCone) {
                // Pine Cone Palette (Browns/Tans)
                const r = 100 + rand.nextFloat(0, 40);
                const g = 70 + rand.nextFloat(0, 30);
                const b = 40 + rand.nextFloat(0, 20);
                
                entities.push({
                    center: new Vector2(eX, eY),
                    radius: radius * 0.9, 
                    baseColor: { r: r, g: g, b: b, a: 1.0 },
                    highlightColor: { r: Math.min(255, r + 40), g: Math.min(255, g + 40), b: Math.min(255, b + 40), a: 1.0 },
                    type: 'fruit', // Treated as "fruit" for rendering layer logic
                    distFromRoot: entityDist
                });
            } else {
                // Pine Needle Palette (Deep Evergreen)
                const rBase = 20 + rand.nextFloat(0, 20);   
                const gBase = 60 + rand.nextFloat(0, 40);  
                const bBase = 30 + rand.nextFloat(0, 20);   

                entities.push({
                    center: new Vector2(eX, eY),
                    radius: radius,
                    baseColor: { r: rBase, g: gBase, b: bBase, a: 1.0 },
                    highlightColor: { r: rBase + 30, g: gBase + 30, b: bBase + 30, a: 1.0 },
                    type: 'leaf',
                    distFromRoot: entityDist
                });
            }
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

            const visibleStroke = b.strokeWidth * scale * localT;

            branchList.push(new SimpleBranch(
                tStart,
                new Vector2(curEndX, curEndY),
                visibleStroke,
                new Vector2(curControlX, curControlY)
            ));

            b.entities.forEach(entity => {
                if (progressDistance > entity.distFromRoot) {
                    const age = progressDistance - entity.distFromRoot;
                    const fadeSpeed = 150; 
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
    console.log("🌲 Initializing Pine Tree Generator...");
    
    const canvas = createCanvas(CONFIG.width, CONFIG.height);
    const ctx = canvas.getContext('2d');

    const rand = new SeededRandom(CONFIG.seed);
    
    const startPos = new Vector2(0, 0); 
    const initialLength = 180; 
    
    console.log("🌳 Building logical tree structure...");
    // Increased depth slightly for pine density
    const maxDepth = 8;
    
    const fullTree = generateFullTree(
        rand,
        startPos,
        initialLength,
        -90, 
        maxDepth,
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

    console.log(`   Tree Width: ${treeWidth.toFixed(0)}, Height: ${treeHeight.toFixed(0)}`);
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
        
        const currentGrowthDist = t * (maxDistance + 200); 

        ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);

        const branches: SimpleBranch[] = [];
        let entities: Entity[] = []; 

        flattenTreeOrganic(fullTree, branches, entities, currentGrowthDist, finalScale, offsetX, offsetY);

        const leaves = entities.filter(e => e.type === 'leaf');
        const fruits = entities.filter(e => e.type === 'fruit');

        // Occlusion logic remains the same (cones are fruits)
        const visibleFruits = fruits.filter(fruit => {
            return !leaves.some(leaf => {
                if (leaf.center.y <= fruit.center.y) return false;
                const dx = leaf.center.x - fruit.center.x;
                const dy = leaf.center.y - fruit.center.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                return dist < (leaf.radius * 0.9);
            });
        });

        leaves.sort((a,b) => a.center.y - b.center.y);
        visibleFruits.sort((a,b) => a.center.y - b.center.y);
        entities = leaves.concat(visibleFruits);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // DRAW TREE TRUNK (Rougher, grayer wood)
        // Pass 1: Dark Outline / Bark Shadow
        ctx.strokeStyle = '#2d241e'; 
        for (const b of branches) {
            ctx.beginPath();
            ctx.lineWidth = b.strokeWidth;
            ctx.moveTo(b.start.x, b.start.y);
            ctx.quadraticCurveTo(b.control.x, b.control.y, b.end.x, b.end.y);
            ctx.stroke();
        }

        // Pass 2: Bark Highlight (Gray-Brown)
        ctx.strokeStyle = '#5c4e42'; 
        for (const b of branches) {
            if (b.strokeWidth < 1) continue;
            ctx.beginPath();
            ctx.lineWidth = b.strokeWidth * 0.6; // Slightly rougher texture
            const off = -1; 
            ctx.moveTo(b.start.x + off, b.start.y + off);
            ctx.quadraticCurveTo(b.control.x + off, b.control.y + off, b.end.x + off, b.end.y + off);
            ctx.stroke();
        }

        // DRAW NEEDLES & CONES
        for (const e of entities) {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = (e.opacity ?? 1);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Darker shadow for dense pine
            ctx.beginPath();
            ctx.arc(e.center.x + 2, e.center.y + 3, e.radius, 0, Math.PI * 2);
            ctx.fill();

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

            // Texture for Cones (Fruits)
            if (e.type === 'fruit') {
                ctx.fillStyle = 'rgba(60, 40, 20, 0.3)';
                ctx.beginPath();
                // Draw a few overlapping circles to simulate cone scales
                ctx.arc(e.center.x, e.center.y - e.radius * 0.2, e.radius * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = prevAlpha;
        }

        const buffer = canvas.toBuffer('image/png');
        const ok = ffmpeg.stdin.write(buffer);
        if (!ok) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));

        if (frame % 30 === 0) {
            const pct = Math.round((frame / totalFrames) * 100);
            process.stdout.write(`\rProgress: ${pct}%`);
        }
    }

    console.log("\n📸 Saving final pine tree snapshot...");
    const finalBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(CONFIG.imageFilename, finalBuffer);

    ffmpeg.stdin.end();
}

generateVideo().catch(err => console.error(err));