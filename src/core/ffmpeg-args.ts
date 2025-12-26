import type { Config } from "../types/config";

export function getFFmpegArgs(config: Config): string[] {
	  const ffmpegArgs = [
                '-y',
                '-f', 'image2pipe',
                '-r', `${config.fps}`,
                '-i', '-',
                '-c:v', 'libvpx-vp9',
                // Use CRF mode for better quality-per-byte (lower = better quality, 15-35 is typical range)
                '-crf', '30',
                '-b:v', '0',  // Required for CRF mode in VP9
                '-pix_fmt', 'yuva420p',
                '-auto-alt-ref', '0',
                // Encoding efficiency settings
                '-cpu-used', '2',      // 0-5, lower = slower but better compression
                '-row-mt', '1',        // Enable row-based multithreading
                '-tile-columns', '2',  // Parallel encoding tiles
                '-deadline', 'good'    // Balance between speed and quality
            ];
    
            // output decision
            if (config.save_as_file) {
                ffmpegArgs.push(config.filename);
            } else {
                ffmpegArgs.push(
                    '-f', 'webm',
                    'pipe:1'
                );
            }
    
	return ffmpegArgs;
}