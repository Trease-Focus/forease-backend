import type { Config } from "../types/config";

export function getFFmpegArgs(config: Config): string[] {
	  const ffmpegArgs = [
                '-y',
                '-f', 'image2pipe',
                '-r', `${config.fps}`,
                '-i', '-',
                '-filter_complex', 'trim=duration=' + config.durationSeconds + ',setpts=PTS-STARTPTS',  // Limit duration
                '-shortest',  // Stop when the shortest input (image pipe) ends
                '-c:v', 'libvpx-vp9',
                // Use CRF mode for better quality-per-byte (lower = better quality, 15-35 is typical range)
                '-crf', '30',
                '-b:v', '0',  // Required for CRF mode in VP9
                '-pix_fmt', 'yuva420p',  // With alpha channel (transparent background)
                '-auto-alt-ref', '0',
                // Streaming optimizations
                '-deadline', 'realtime',  // Fast encoding for streaming
                '-cpu-used', '8',         // Faster encoding (0-5, higher = faster)
                '-row-mt', '1',           // Row-based multithreading
                '-frame-parallel', '1',   // Parallel frame processing
                '-tile-columns', '2',     // Parallel encoding tiles
                '-g', '30'                // Keyframe interval for seeking
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