/**
 * Resolve a usable ffmpeg/ffprobe.
 *
 * NOT the binary bundled with Playwright at /opt/pw-browsers/ffmpeg-*: that is
 * a stripped build for WebM screen recording — matroska/webm demux and VP8
 * decode only, no MP4 container and no H.264. Handed a normal phone clip it
 * reports "Invalid data found when processing input", which looks exactly like
 * a corrupt file and is not one.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const FFMPEG = require('ffmpeg-static');
export const FFPROBE = require('ffprobe-static').path;
