"use client";

import { useState } from "react";
import { ExternalLink, Eye, Plus, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DropDialog } from "@/cut/components/DropDialog";
import { useDrop } from "@/queries/drop";
import { PLATFORM_ICONS } from "@/lib/marketplace/platform-icons";
import { cn } from "@/lib/utils";
import { type AdminSubmission, useAdminSubmissions, useTagSubmissionDrop } from "@/queries/admin";
import { useStudioDrops, useStudios, type StudioSummary } from "@/queries/studio";

type Tab = "all" | "tagged" | "need-tag";

// Every approved submission still needs its finished, hand-edited export
// posted to a real studio Drop and tagged back here — that's this whole
// page. It has no publishing logic of its own: tagging just points
// Submission.publishingid at a real Drop (posted through the same flow the
// studio page's own composer uses) so the export and its results stay
// reachable from the submission, for good.
export default function AdminUploadsPage() {
  const submissions = useAdminSubmissions();
  const [tab, setTab] = useState<Tab>("all");

  const approved = (submissions.data?.submissions ?? []).filter((s) => s.reviewStatus === "Qualified");
  const shown =
    tab === "all" ? approved : tab === "tagged" ? approved.filter((s) => s.publishingid) : approved.filter((s) => !s.publishingid);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Publisher Posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approved submissions — tag each to the real drop once you&apos;ve posted its finished edit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        {(
          [
            ["all", `All (${approved.length})`],
            ["need-tag", `Need Tag (${approved.filter((s) => !s.publishingid).length})`],
            ["tagged", `Tagged (${approved.filter((s) => s.publishingid).length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
              tab === value
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {submissions.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : submissions.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load submissions. Try again.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No {tab === "all" ? "approved" : tab === "tagged" ? "tagged" : "untagged"} submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((item) => (
            <SubmissionRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ item }: { item: AdminSubmission }) {
  const [tagOpen, setTagOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.submitterName} · {item.submitterEmail}
          {item.category && ` · ${item.category.emoji} ${item.category.name}`}
          {item.studio && ` · posted to ${item.studio.name}`}
        </p>
      </div>
      {item.publishingid ? (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setViewOpen(true)}>
          <Eye className="size-3.5" data-icon="inline-start" /> View Drop
        </Button>
      ) : (
        <Button size="sm" className="shrink-0" onClick={() => setTagOpen(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Tag Drop
        </Button>
      )}

      {tagOpen && <TagDropFlow submissionId={item.id} onClose={() => setTagOpen(false)} />}
      {viewOpen && item.publishingid && (
        <ViewDropDialog dropId={item.publishingid} onClose={() => setViewOpen(false)} />
      )}
    </div>
  );
}

function TagDropFlow({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const [mode, setMode] = useState<"new" | "existing" | null>(null);
  const [studio, setStudio] = useState<StudioSummary | null>(null);
  const studios = useStudios();
  const tagDrop = useTagSubmissionDrop();

  // A brand-new drop is composed through the exact same dialog the studio
  // page's own "Add drop" button opens — that's already a full dialog on
  // its own, so it replaces this wrapper's Dialog rather than nesting
  // inside it.
  if (mode === "new" && studio) {
    return (
      <DropDialog
        projectId={null}
        studioId={studio.id}
        studioName={studio.name}
        onClose={onClose}
        onPosted={(dropId) =>
          tagDrop.mutate({ id: submissionId, publishingid: dropId, studioId: studio.id })
        }
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === null ? "Tag a drop" : studio === null ? "Which studio?" : "Choose a drop"}
          </DialogTitle>
        </DialogHeader>

        {mode === null && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-1 py-3"
              onClick={() => setMode("new")}
            >
              <span className="text-sm font-semibold">New drop</span>
              <span className="text-xs font-normal text-muted-foreground">Post the finished edit now</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-1 py-3"
              onClick={() => setMode("existing")}
            >
              <span className="text-sm font-semibold">Tag existing drop</span>
              <span className="text-xs font-normal text-muted-foreground">Already posted it separately</span>
            </Button>
          </div>
        )}

        {mode !== null && studio === null && (
          <StudioPicker studios={studios.data?.spaces ?? []} loading={studios.isLoading} onPick={setStudio} />
        )}

        {mode === "existing" && studio !== null && (
          <ExistingDropPicker
            studioId={studio.id}
            pending={tagDrop.isPending}
            onPick={(dropId) =>
              tagDrop.mutate(
                { id: submissionId, publishingid: dropId, studioId: studio.id },
                { onSuccess: onClose }
              )
            }
          />
        )}

        {tagDrop.isError && <p className="text-xs text-destructive">Couldn&apos;t tag that drop — try again.</p>}
      </DialogContent>
    </Dialog>
  );
}

function StudioPicker({
  studios,
  loading,
  onPick,
}: {
  studios: StudioSummary[];
  loading: boolean;
  onPick: (studio: StudioSummary) => void;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (studios.length === 0) {
    return <p className="text-xs text-muted-foreground">You&apos;re not a manager of any studio yet.</p>;
  }
  return (
    <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto">
      {studios.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s)}
          className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <span className="font-medium">{s.name}</span>
          <span className="text-xs text-muted-foreground">@{s.username}</span>
        </button>
      ))}
    </div>
  );
}

function ExistingDropPicker({
  studioId,
  pending,
  onPick,
}: {
  studioId: string;
  pending: boolean;
  onPick: (dropId: string) => void;
}) {
  const drops = useStudioDrops(studioId);
  if (drops.isLoading) return <Skeleton className="h-24 w-full" />;
  if (drops.isError) return <p className="text-xs text-destructive">Couldn&apos;t load this studio&apos;s drops.</p>;
  const list = drops.data?.drops ?? [];
  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">No drops on this studio yet.</p>;
  }
  return (
    <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto">
      {list.map((d) => (
        <button
          key={d.id}
          type="button"
          disabled={pending}
          onClick={() => onPick(d.id)}
          className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
        >
          <span className="min-w-0 truncate font-medium">{d.title || d.fileName || "Untitled drop"}</span>
          <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{d.status}</span>
        </button>
      ))}
    </div>
  );
}

function ViewDropDialog({ dropId, onClose }: { dropId: string; onClose: () => void }) {
  const drop = useDrop(dropId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Send className="size-4 text-muted-foreground" />
            {drop.data?.drop.title || "Drop"}
          </DialogTitle>
        </DialogHeader>

        {drop.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : drop.isError || !drop.data ? (
          <p className="text-xs text-destructive">Couldn&apos;t load this drop.</p>
        ) : (
          <div className="space-y-3">
            <StatusPill status={drop.data.drop.status} />
            {drop.data.drop.publications.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not published to any destination yet.</p>
            ) : (
              <div className="space-y-1.5">
                {drop.data.drop.publications.map((p) => {
                  const Icon = PLATFORM_ICONS[p.platform];
                  return (
                    <div
                      key={p.destinationConnectionId}
                      className="flex items-center gap-2 rounded-lg border p-2 text-xs"
                    >
                      {Icon && <Icon className="size-5 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{p.destinationAccountName}</span>
                      {p.externalUrl && (
                        <a
                          href={p.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-primary hover:underline"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    draft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/10 text-red-600 dark:text-red-400",
    scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
        styles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
