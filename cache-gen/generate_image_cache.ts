import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { entities } from '../src/entities';
import type { Config } from '../src/types/config';
import { generateGrid, type TreeConfig } from '../src/grid';

const SEED = '6969696969696969';
const OUTPUT_DIR = path.join(__dirname, '..', 'samples', 'single_grid');

/**
 * SingleGridGenerator - Generates a single grid structure for each entity
 * and saves it under samples/single_grid
 */
export class SingleGridGenerator {
    private seed: string;
    private outputDir: string;

    constructor(seed: string = SEED, outputDir: string = OUTPUT_DIR) {
        this.seed = seed;
        this.outputDir = outputDir;
    }

    private async ensureOutputDir(): Promise<void> {
        if (!existsSync(this.outputDir)) {
            await mkdir(this.outputDir, { recursive: true });
            console.log(`✅ Created output directory: ${this.outputDir}`);
        }
    }

    private async generateSingleGrid(entityName: string, imagePath: string): Promise<void> {
        const outputPath = path.join(this.outputDir, `${entityName}_grid.png`);

        const treeConfig: TreeConfig = {
            imagePath,
            gridX: 0,
            gridY: 0,
            scale: 0.8
        };

        await generateGrid({
            trees: [treeConfig],
            outputFilename: outputPath
        });

        console.log(`  ✓ Saved: ${outputPath}`);
    }

    async generateAll(): Promise<void> {
        console.log(`\n🌳 Single Grid Generator`);
        console.log(`   Seed: ${this.seed}`);
        console.log(`   Output: ${this.outputDir}\n`);

        await this.ensureOutputDir();

        const entityConfig: Config = {
            photoOnly: true,
            width: 480,
            height: 480,
            fps: 25,
            durationSeconds: 30,
            seed: this.seed,
            filename: 'video.webm',
            imageFilename: 'image.png',
            padding: 80,
            save_as_file: true
        };

        console.log(`📦 Generating grids for ${entities.size} entities...\n`);

        for (const [entityName, generator] of entities) {
            console.log(`🔄 Processing: ${entityName}`);

            try {
                const result = await generator.generate(null as any, undefined, entityConfig);

                if (result.imagePath) {
                    await this.generateSingleGrid(entityName, result.imagePath);
                } else if (result.imageBuffer) {
                    const tempPath = path.join(this.outputDir, `${entityName}.png`);
                    await writeFile(tempPath, result.imageBuffer);
                    await this.generateSingleGrid(entityName, tempPath);
                } else {
                    const samplePath = path.join(__dirname, '..', 'samples', `${entityName}.png`);
                    if (existsSync(samplePath)) {
                        console.log(`  ℹ Using existing sample: ${samplePath}`);
                        await this.generateSingleGrid(entityName, samplePath);
                    } else {
                        console.error(`  ✗ No image available for ${entityName}`);
                    }
                }
            } catch (error) {
                console.error(`  ✗ Error generating ${entityName}:`, error);
                
                const samplePath = path.join(__dirname, '..', 'samples', `${entityName}.png`);
                if (existsSync(samplePath)) {
                    console.log(`  ℹ Falling back to existing sample: ${samplePath}`);
                    await this.generateSingleGrid(entityName, samplePath);
                }
            }
        }

        console.log(`\n✅ Single grid generation complete!`);
        console.log(`   Output directory: ${this.outputDir}\n`);
    }

    async generateForEntity(entityName: string): Promise<void> {
        console.log(`\n🌳 Single Grid Generator - ${entityName}`);
        console.log(`   Seed: ${this.seed}\n`);

        await this.ensureOutputDir();

        const generator = entities.get(entityName);
        if (!generator) {
            console.error(`Entity "${entityName}" not found. Available entities:`);
            for (const name of entities.keys()) {
                console.log(`  - ${name}`);
            }
            return;
        }

        const entityConfig: Config = {
            photoOnly: true,
            width: 480,
            height: 480,
            fps: 25,
            durationSeconds: 30,
            seed: this.seed,
            filename: 'video.webm',
            imageFilename: 'image.png',
            padding: 80,
            save_as_file: true
        };

        console.log(`🔄 Processing: ${entityName}`);

        try {
            const result = await generator.generate(null as any, undefined, entityConfig);

            if (result.imagePath) {
                await this.generateSingleGrid(entityName, result.imagePath);
            } else if (result.imageBuffer) {
                const tempPath = path.join(this.outputDir, `${entityName}.png`);
                await writeFile(tempPath, result.imageBuffer);
                await this.generateSingleGrid(entityName, tempPath);
            } else {
                const samplePath = path.join(__dirname, '..', 'samples', `${entityName}.png`);
                if (existsSync(samplePath)) {
                    console.log(`  ℹ Using existing sample: ${samplePath}`);
                    await this.generateSingleGrid(entityName, samplePath);
                } else {
                    console.error(`  ✗ No image available for ${entityName}`);
                }
            }
        } catch (error) {
            console.error(`  ✗ Error generating ${entityName}:`, error);
        }

        console.log(`\n✅ Done!`);
    }
}

async function main() {
    const generator = new SingleGridGenerator(SEED, OUTPUT_DIR);
    const entityArg = process.argv[2];
    
    if (entityArg) {
        await generator.generateForEntity(entityArg);
    } else {
        await generator.generateAll();
    }
}

main().catch(console.error);
