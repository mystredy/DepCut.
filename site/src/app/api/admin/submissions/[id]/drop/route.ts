import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const tagSchema = z.object({
  publishingid: z.string().trim().min(1),
  studioId: z.string().trim().min(1),
}).strict();

// Tags an approved submission to a real Drop — Publisher Posts' "Tag Drop"
// flow (either a brand-new drop just posted, or an existing one the
// publisher already posted separately). Just links Submission.publishingid
// / studioId to that Drop; nothing else about the submission or the drop
// changes.
export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({ select: { id: true }, where: { id } });
  if (!submission) return notFoundResponse();

  const parsed = tagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  const drop = await prisma.drop.findUnique({
    select: { studioId: true },
    where: { id: parsed.data.publishingid },
  });
  if (!drop || drop.studioId !== parsed.data.studioId) {
    return NextResponse.json(
      { error: "invalid_request", message: "That drop doesn't belong to the chosen studio." },
      { status: 400 },
    );
  }

  const updated = await prisma.submission.update({
    data: { publishingid: parsed.data.publishingid, studioId: parsed.data.studioId },
    include: {
      assets: true,
      category: { select: { emoji: true, name: true } },
      studio: { select: { id: true, name: true, username: true } },
      task: { select: { id: true, title: true } },
      user: { select: { displayName: true, email: true, name: true } },
      workspace: { select: { editorEmail: true, provider: true, workspaceName: true } },
    },
    where: { id },
  });

  return NextResponse.json({
    submission: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      hasThumbnail:
        Boolean(updated.projectId) || updated.assets.some((a) => a.type === "thumbnail" && a.status === "complete"),
      hasVideo: Boolean(updated.projectId) || updated.assets.some((a) => a.type === "video" && a.status === "complete"),
      hasVerification: updated.assets.some((a) => a.type === "verification" && a.status === "complete"),
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      reviewStartedAt: updated.reviewStartedAt?.toISOString() ?? null,
      reviewCompletedAt: updated.reviewCompletedAt?.toISOString() ?? null,
      submittedAt: updated.submittedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
      submitterEmail: updated.user.email,
      submitterName: updated.user.displayName ?? updated.user.name,
      user: undefined,
    },
  });
});
