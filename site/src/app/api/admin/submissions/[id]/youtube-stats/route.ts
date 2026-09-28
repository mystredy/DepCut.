import { NextResponse } from "next/server";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { getYoutubeQuickStats, UrlImportError } from "@/lib/marketplace/url-import";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Matches admin/submissions/page.tsx's YOUTUBE_URL_RE — same check, so this
// only ever runs ytdl-core against a link the review card already shows as
// a YouTube link.
const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/|youtu\.be\/)/i;

// Super-user only. Checks the submission's editCode against YouTube on
// demand — no stored/cached stats, since this is a spot-check a reviewer
// triggers from the card, not data the submission needs to carry.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({ select: { editCode: true }, where: { id } });
  if (!submission) return notFoundResponse();

  const editCode = submission.editCode?.trim();
  if (!editCode || !YOUTUBE_URL_RE.test(editCode)) {
    return NextResponse.json(
      { error: "invalid_request", message: "This submission's edit code isn't a YouTube link." },
      { status: 400 },
    );
  }

  try {
    const stats = await getYoutubeQuickStats(editCode);
    return NextResponse.json(stats);
  } catch (e) {
    const message = e instanceof UrlImportError ? e.message : "Couldn't read that YouTube video.";
    return NextResponse.json({ error: "youtube_error", message }, { status: 502 });
  }
});
