import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ maxRates: z.number().int().min(1).max(20) }).strict();

// Super-user only. Sets this submission's own maxRates — a per-submission
// override of its linked Task's default ceiling, used by the approve
// action's payout formula (see ../route.ts). Matches the Task's own
// maxRates bounds (1-20).
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

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid request." }, { status: 400 });
  }

  const updated = await prisma.submission.update({
    data: { maxRates: parsed.data.maxRates },
    select: { maxRates: true },
    where: { id },
  });

  return NextResponse.json({ maxRates: updated.maxRates });
});
