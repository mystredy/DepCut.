import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

// Disconnects one workspace from this account — the Collaboration Hub's
// Disconnect action. deleteMany rather than delete-by-id: no row for this
// provider is a no-op, not an error.
export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { provider } = await context.params;
  await prisma.userWorkspaceLink.deleteMany({ where: { provider, userId: request.depcut.userId } });
  return NextResponse.json({ ok: true });
});
