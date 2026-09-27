import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  workspaceName: z.string().trim().min(1).max(160),
  editorEmail: z.string().trim().max(200).email().optional(),
});

// The signed-in user's connected editing workspaces — Submit Project's
// Collaboration Hub. Connected once here, reused by every submission's
// workspace picker (Submission.spaceid) rather than reconnecting per
// submission.
export const GET = withDepCutAuth(async (request) => {
  const links = await prisma.userWorkspaceLink.findMany({ where: { userId: request.depcut.userId } });
  return NextResponse.json({ links });
});

// Connects (or re-connects, overwriting the prior name/email) one external
// editing workspace to this account. Upserts by (userId, provider):
// re-connecting the same provider updates the existing row instead of
// erroring. No password field — see UserWorkspaceLink's own doc comment for
// why that stays client-only.
export const POST = withDepCutAuth(async (request) => {
  const parsed = linkSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_request",
        message: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid request.",
      },
      { status: 400 },
    );
  }

  const link = await prisma.userWorkspaceLink.upsert({
    create: {
      editorEmail: parsed.data.editorEmail || null,
      provider: parsed.data.provider,
      userId: request.depcut.userId,
      workspaceName: parsed.data.workspaceName,
    },
    update: {
      editorEmail: parsed.data.editorEmail || null,
      workspaceName: parsed.data.workspaceName,
    },
    where: { userId_provider: { provider: parsed.data.provider, userId: request.depcut.userId } },
  });

  return NextResponse.json({ link });
});
