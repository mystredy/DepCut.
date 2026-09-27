"use client";

import { useState } from "react";
import { ExternalLink, Eye, FileVideo, Film, Plus, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DropDialog } from "@/cut/components/DropDialog";
import { useDrop } from "@/queries/drop";
import { PLATFORM_ICONS } from "@/lib/marketplace/platform-icons";
import { cn } from "@/lib/utils";
import { type AdminSubmission, useAdminSubmissions, useTagSubmissionDrop } from "@/queries/admin";
import { studioAvatarUrl, useStudioDrops, useStudios, type StudioSummary } from "@/queries/studio";

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
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-black">
          {item.hasVideo ? (
            // Same seeked-<video> thumbnail trick used across the app (drop
            // picker, studio grid) — no separate submission thumbnail
            // endpoint covers a project-linked submission, but this route
            // already does, for either kind.
            <video
              src={`/api/submissions/${item.id}/video`}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = 0.1;
              }}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Film className="absolute inset-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white/40" />
          )}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {item.extension === "pro" ? (
              <span title="Pro">
                <Sparkles className="size-3.5 shrink-0 text-primary" />
              </span>
            ) : (
              <span title="Standard">
                <FileVideo className="size-3.5 shrink-0 text-muted-foreground" />
              </span>
            )}
            <span className="truncate">{item.title}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {item.submitterName} · {item.submitterEmail}
            {item.category && ` · ${item.category.emoji} ${item.category.name}`}
            {item.studio && ` · posted to ${item.studio.name}`}
          </p>
        </div>
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

      {tagOpen && <TagDropFlow submission={item} onClose={() => setTagOpen(false)} />}
      {viewOpen && item.publishingid && (
        <ViewDropDialog dropId={item.publishingid} onClose={() => setViewOpen(false)} />
      )}
    </div>
  );
}

function TagDropFlow({ submission, onClose }: { submission: AdminSubmission; onClose: () => void }) {
  const [mode, setMode] = useState<"new" | "existing" | null>(null);
  const [studio, setStudio] = useState<StudioSummary | null>(null);
  const studios = useStudios();
  const tagDrop = useTagSubmissionDrop();

  // A brand-new drop is composed through the exact same dialog the studio
  // page's own "Add drop" button opens — that's already a full dialog on
  // its own, so it replaces this wrapper's Dialog rather than nesting
  // inside it. Pro's own viral package (when it has one) prefills the
  // composer instead of starting blank — Standard has none of these.
  if (mode === "new" && studio) {
    return (
      <DropDialog
        projectId={null}
        studioId={studio.id}
        studioName={studio.name}
        initialFields={{
          // Truncated to the Drop schema's own limits (title 100, caption/
          // hashtags 280) — the package fields they come from allow much
          // more (packageDescription up to 2000), which used to make the
          // very first auto-upload fail validation before the manager ever
          // touched the composer.
          caption: submission.packageDescription?.slice(0, 280) ?? undefined,
          hashtags: submission.packageTags?.slice(0, 280) ?? undefined,
          title: submission.packageTitle?.slice(0, 100) ?? undefined,
        }}
        initialVideoUrl={submission.hasVerification ? `/api/submissions/${submission.id}/verification` : undefined}
        onClose={onClose}
        onPosted={(dropId) =>
          tagDrop.mutate({ id: submission.id, publishingid: dropId, studioId: studio.id })
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
                { id: submission.id, publishingid: dropId, studioId: studio.id },
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
      {studios.map((s) => {
        const avatarUrl = studioAvatarUrl(s);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar from R2, not a Next asset
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                s.name.charAt(0).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">@{s.username}</span>
          </button>
        );
      })}
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
          className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
        >
          <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* Same trick the studio grid uses — no separate thumbnail image
                endpoint, so a muted <video> seeked to a frame stands in. */}
            <video
              src={`/api/drops/${d.id}/video`}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = 0.1;
              }}
              className="absolute inset-0 size-full object-cover"
            />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{d.title || d.fileName || "Untitled drop"}</span>
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
