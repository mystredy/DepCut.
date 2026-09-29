import path from "node:path";

// Vercel functions have no ffmpeg/ffprobe on PATH at all — the render pipeline
// (exportPipeline.ts, hlsLadder.ts, ...) spawns both as bare commands,
// resolved through PATH the same way the Mac engine's own tool-path.ts widens
// it for local dev. ffmpeg-static/ffprobe-static ship real prebuilt static
// Linux binaries already named "ffmpeg"/"ffprobe", so prepending their
// directories is the whole fix — no copying, no chmod, no network fetch.
let widened = false;

export function ensureRenderToolPath(): void {
  if (widened) return;
  widened = true;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- these two ship no ESM entry point
  const ffmpegPath = require("ffmpeg-static") as string;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffprobePath = (require("ffprobe-static") as { path: string }).path;
  const dirs = [path.dirname(ffmpegPath), path.dirname(ffprobePath)];
  process.env.PATH = [...dirs, process.env.PATH].filter(Boolean).join(path.delimiter);
}
