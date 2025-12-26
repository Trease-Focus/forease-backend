import type { Config } from "../types/config";

export function getFFmpegArgs(config: Config): string[] {
	  const ffmpegArgs = [
                '-y',
                '-f', 'lavfi',
                '-i', `color=c=0x87CEFA:s=${config.width}x${config.height}:r=${config.fps}`,  // Solid background color
                '-f', 'image2pipe',
                '-r', `${config.fps}`,
                '-i', '-',
                '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,trim=duration=' + config.durationSeconds + ',setpts=PTS-STARTPTS',  // Overlay frames on background, limit duration
                '-shortest',  // Stop when the shortest input (image pipe) ends
                '-c:v', 'libvpx-vp9',
                // Use CRF mode for better quality-per-byte (lower = better quality, 15-35 is typical range)
                '-crf', '30',
                '-b:v', '0',  // Required for CRF mode in VP9
                '-pix_fmt', 'yuv420p',  // No alpha channel (solid background)
                '-auto-alt-ref', '0',
                // Streaming optimizations
                '-deadline', 'realtime',  // Fast encoding for streaming
                '-cpu-used', '5',         // Faster encoding (0-5, higher = faster)
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