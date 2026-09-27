-- Rename the table
ALTER TABLE "submission_workspace_link" RENAME TO "user_workspace_link";
ALTER TABLE "user_workspace_link" RENAME CONSTRAINT "submission_workspace_link_pkey" TO "user_workspace_link_pkey";

-- Add userId, backfilled from each row's submission owner
ALTER TABLE "user_workspace_link" ADD COLUMN "userId" TEXT;
UPDATE "user_workspace_link" wl
SET "userId" = s."userId"
FROM "submission" s
WHERE s.id = wl."submissionId";
ALTER TABLE "user_workspace_link" ALTER COLUMN "userId" SET NOT NULL;

-- Drop the old submission-scoped FK, index, and column
ALTER TABLE "user_workspace_link" DROP CONSTRAINT "submission_workspace_link_submissionId_fkey";
DROP INDEX IF EXISTS "submission_workspace_link_submissionId_provider_key";
DROP INDEX IF EXISTS "submission_workspace_link_submissionId_idx";
ALTER TABLE "user_workspace_link" DROP COLUMN "submissionId";

-- Add the new user-scoped FK and indexes
ALTER TABLE "user_workspace_link"
  ADD CONSTRAINT "user_workspace_link_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON UPDATE CASCADE ON DELETE CASCADE;
CREATE UNIQUE INDEX "user_workspace_link_userId_provider_key" ON "user_workspace_link"("userId", "provider");
CREATE INDEX "user_workspace_link_userId_idx" ON "user_workspace_link"("userId");
