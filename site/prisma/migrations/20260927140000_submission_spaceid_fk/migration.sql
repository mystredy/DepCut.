-- Backfill submission.spaceid from a provider key (e.g. "capcut") to the
-- real user_workspace_link.id it corresponds to, for that submission's owner
UPDATE "submission" s
SET spaceid = wl.id
FROM "user_workspace_link" wl
WHERE wl."userId" = s."userId" AND wl.provider = s.spaceid;

-- Anything left over didn't match a real connected link (stale/orphaned) —
-- clear it rather than leave a value the new FK below would reject
UPDATE "submission" s
SET spaceid = NULL
WHERE s.spaceid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "user_workspace_link" wl WHERE wl.id = s.spaceid);

-- Now that every value is either NULL or a real id, make it a real FK.
-- SET NULL on delete: disconnecting a workspace clears any submission that
-- had it selected rather than blocking the disconnect.
ALTER TABLE "submission"
  ADD CONSTRAINT "submission_spaceid_fkey"
  FOREIGN KEY ("spaceid") REFERENCES "user_workspace_link"("id") ON UPDATE CASCADE ON DELETE SET NULL;
