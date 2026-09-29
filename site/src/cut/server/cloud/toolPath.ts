import { chmod, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { downloadToFile } from "@/cut/worker/r2";

// Vercel functions have no ffmpeg/ffprobe on PATH at all, and — unlike a
// normal webpack build — this project's Turbopack build doesn't trace the
// ffmpeg-static/ffprobe-static npm packages' binary files into the deployed
// function even though `require()` still resolves their path string (see
// next.config.ts's own comment: outputFileTracingExcludes is already a
// documented no-op under Turbopack here, and outputFileTracingIncludes
// turned out to be no better for these two). So this fetches the exact same
// binaries — already uploaded once to R2 from a local ffmpeg-static/
// ffprobe-static install — into /tmp at runtime instead of trusting the
// bundle to carry them, and caches that fetch for the lifetime of the warm
// function instance.
const TOOLS_DIR = path.join(os.tmpdir(), "depcut-render-tools");
const TOOLS = [
  { key: "tools/ffmpeg-static/ffmpeg", name: "ffmpeg" },
  { key: "tools/ffmpeg-static/ffprobe", name: "ffprobe" },
  // The standalone PyInstaller build (yt-dlp/yt-dlp's own "yt-dlp_linux"
  // release asset) — no Python needed, same reasoning as ffmpeg-static
  // above: nothing on this runtime's PATH otherwise. urlDownload.ts spawns
  // it by bare name, same as ffmpeg/ffprobe.
  { key: "tools/yt-dlp/yt-dlp", name: "yt-dlp" },
];

let ensured: Promise<void> | null = null;

async function fetchTool(key: string, dest: string): Promise<void> {
  const already = await stat(dest).catch(() => null);
  if (already && already.size > 0) return;
  await downloadToFile(key, dest);
  await chmod(dest, 0o755);
}

export function ensureRenderToolPath(): Promise<void> {
  return (ensured ??= (async () => {
    await Promise.all(TOOLS.map((t) => fetchTool(t.key, path.join(TOOLS_DIR, t.name))));
    process.env.PATH = [TOOLS_DIR, process.env.PATH].filter(Boolean).join(path.delimiter);
  })());
}
