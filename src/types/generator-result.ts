

export type GeneratorResult = {
    videoPath?: string;
    imagePath?: string;
    imageBuffer?: Buffer;
    trunkStartPosition?: { x: number; y: number; };
};