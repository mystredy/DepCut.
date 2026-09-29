import { NextResponse } from "next/server";

import { runExportJob } from "@/cut/worker/exportJob";
import { runHlsJob } from "@/cut/worker/hlsJob";
import { prisma, type ClaimedJob } from "@/cut/worker/db";
import type { RenderHandle } from "@/cut/server/exportPipeline";
import { ensureRenderToolPath } from "@/cut/server/cloud/toolPath";
import { isVercelCron, notFoundResponse } from "@/lib/depcut-api-auth";
import { notifyTelegram } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The real cloud render fallback: the Cloudflare Container this project
// intended to run CutRenderJob rows on (site/src/cut/worker) has never once
// deployed successfully (every "Deploy Cut Worker" run fails at the Cloudflare
// step), so every preview/card/hls job ever queued has sat "queued" forever —
// nothing has ever claimed one. This runs the exact same pipeline code
// (worker/exportJob.ts, worker/hlsJob.ts — already framework-agnostic Node,
// just Prisma + the AWS S3 client against R2) from an ordinary Vercel Cron
// hit instead of a long-lived container process, trading the worker's
// interval-based progress/cancellation watching for a bounded one-job-per-
// invocation run cheap enough to just retry on the next tick.
//
// "export" and "import_url" are deliberately NOT claimed here: real user
// exports already succeed today via the browser's own WebCodecs render
// (cloud/jobs.ts's exportClientPresign/exportClientComplete), and import_url
// needs yt-dlp, which isn't vendored for this runtime. Both still count
// toward the stuck-job alert below so an admin sees the whole picture.
const FALLBACK_KINDS = ["preview", "card", "hls"] as const;
const ALL_KINDS = ["preview", "card", "hls", "import_url", "export"] as const;

// Comfortably longer than maxDuration: a row still "running" past this was
// abandoned by a function Vercel killed mid-render, not a job actually in
// flight — same reasoning as the worker's own STALE_RUNNING_MS.
const STALE_RUNNING_MS = 6 * 60_000;
// A job older than this and still unresolved means something is actually
// wrong (this route isn't running, ffmpeg/R2/the DB is unreachable, ...) —
// ordinary backlog drain finishes in a couple of cron ticks, well under this.
const STUCK_AFTER_MS = 30 * 60_000;
// Once alerted, touch the stuck rows so the same backlog doesn't re-page the
// admin every cron tick — only a batch that's still stuck (or grown) an hour
// later fires again. Mirrors the worker's own heartbeat-via-updatedAt trick.
const ALERT_COOLDOWN_MS = 60 * 60_000;

async function sweepStaleRunning(): Promise<void> {
  await prisma.cutRenderJob.updateMany({
    where: { kind: { in: [...FALLBACK_KINDS] }, state: "running", updatedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { state: "queued", claimedAt: null, progress: 0 },
  });
}

async function claimNext(): Promise<ClaimedJob | null> {
  const candidates = await prisma.cutRenderJob.findMany({
    where: { state: "queued", kind: { in: [...FALLBACK_KINDS] } },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, userId: true, projectId: true, kind: true, spec: true, outName: true },
  });
  for (const c of candidates) {
    const { count } = await prisma.cutRenderJob.updateMany({
      where: { id: c.id, state: "queued" },
      data: { state: "running", claimedAt: new Date(), progress: 0, error: null },
    });
    if (count === 1) return c;
  }
  return null;
}

async function runOne(job: ClaimedJob): Promise<void> {
  const handle: RenderHandle = { tmpDir: "", outPath: "", progress: 0, log: [] };
  try {
    const { outputKey, outName } =
      job.kind === "hls" ? await runHlsJob(job, handle) : await runExportJob(job, handle);
    await prisma.cutRenderJob.updateMany({
      where: { id: job.id, state: "running" },
      data: { state: "done", progress: 1, outputKey, outName },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.cutRenderJob
      .updateMany({ where: { id: job.id, state: "running" }, data: { state: "error", error: message } })
      .catch(() => {});
    console.error(`[render-fallback] ${job.kind} ${job.id} failed: ${message}`);
  }
}

/** Alert the admin once per stuck batch — every kind, not just the ones this
 * route claims, so import_url/export backlogs are visible even though
 * nothing here processes them. */
async function alertIfStuck(): Promise<void> {
  const stuck = await prisma.cutRenderJob.findMany({
    where: { kind: { in: [...ALL_KINDS] }, state: { in: ["queued", "running"] }, createdAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, createdAt: true, updatedAt: true },
  });
  if (stuck.length === 0) return;
  if (stuck.every((r) => r.updatedAt.getTime() > Date.now() - ALERT_COOLDOWN_MS)) return; // already alerted this batch

  const byKind = new Map<string, { count: number; oldest: Date }>();
  for (const r of stuck) {
    const e = byKind.get(r.kind);
    if (!e || r.createdAt < e.oldest) byKind.set(r.kind, { count: (e?.count ?? 0) + 1, oldest: r.createdAt });
    else e.count += 1;
  }
  const auto = new Set<string>(FALLBACK_KINDS);
  const lines = [...byKind.entries()].map(([kind, { count, oldest }]) => {
    const ageMin = Math.round((Date.now() - oldest.getTime()) / 60_000);
    const note = auto.has(kind) ? "" : " — not auto-processed, needs yt-dlp/browser path";
    return `• ${kind} x${count}, oldest ${ageMin}min${note}`;
  });
  await notifyTelegram(
    "systemError",
    [
      `⚠️ Cut cloud render fallback: ${stuck.length} job(s) stuck 30+ min in CutRenderJob`,
      ...lines,
      "Source: /api/cut-cloud/render-fallback/run — check this route's logs and R2/DB reachability.",
    ].join("\n"),
  );
  await prisma.cutRenderJob.updateMany({ where: { id: { in: stuck.map((r) => r.id) } }, data: { progress: 0 } });
}

// Vercel Cron authenticates with the CRON_SECRET bearer token, same as every
// other cron route in this codebase (see isVercelCron).
export const GET = async (request: Request) => {
  if (!isVercelCron(request)) return notFoundResponse();
  await ensureRenderToolPath();

  await sweepStaleRunning();
  const job = await claimNext();
  if (job) await runOne(job);
  await alertIfStuck();

  return NextResponse.json({ ran: job ? { id: job.id, kind: job.kind } : null });
};
