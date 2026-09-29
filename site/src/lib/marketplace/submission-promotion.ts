import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { getObject } from "@/cut/server/cloud/r2";
import { extractYoutubeVideoId } from "@/lib/marketplace/url-import";
import { prisma } from "@/lib/prisma";
import { notifyTelegram, notifyTelegramWithMedia } from "@/lib/telegram/notify";

// Telegram's HTML parse mode reads these five characters as markup — every
// field pulled from a submission (title, script, an edit code that's really
// a redeemer's pasted text) is untrusted and has to be escaped before it
// rides inside a <a> tag or the raw text around one, or a submitter typing
// "<b>" (or worse, an unclosed tag) breaks the whole message's formatting.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A link rendered as a clean inline label instead of a bare URL — Telegram
// wraps a long raw URL mid-word on a phone screen (exactly the "youtube.com/
// shorts/..." break this replaces), and hides it inside a code/edit-code
// field otherwise unrelated to the click target.
function htmlLink(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

// video and thumbnail are always required; verification only for Pro
// submissions.
function requiredAssetTypes(extension: string): string[] {
  return extension === "pro" ? ["video", "thumbnail", "verification"] : ["video", "thumbnail"];
}

// The server-authoritative promotion check — called after any asset reaches
// "complete", and right after Submit fires in case every upload had already
// finished by then. Moves a submission out of "submitting" or "failed" (a
// retried asset can re-promote straight to "submitted" without a second
// Submit click) into "submitted" once every required asset is present. The
// browser only ever reports "this asset's bytes are in R2 now" — it never
// decides the submission itself is done.
export async function tryPromoteSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assets: true, user: { select: { displayName: true, email: true, name: true } } },
  });
  if (!submission) return;
  // Only a submission the creator actually asked to submit, and that isn't
  // already resolved, is eligible.
  if (!submission.submitRequestedAt) return;
  if (submission.status !== "submitting" && submission.status !== "failed") return;

  // A submission linked to an editor project has no uploaded assets to wait
  // on — the project itself is what's under review.
  const required = requiredAssetTypes(submission.extension);
  const complete =
    Boolean(submission.projectId) ||
    required.every((type) => submission.assets.some((a) => a.type === type && a.status === "complete"));
  if (!complete) return;

  await prisma.submission.update({
    data: {
      // Inspire-mode submissions have no linked Task to inherit maxRates
      // from, so they default to 10.
      maxRates: submission.maxRates ?? 10,
      reviewStatus: "Pending",
      status: "submitted",
      submittedAt: new Date(),
    },
    where: { id: submission.id },
  });

  const submitterName = submission.user.displayName || submission.user.name || submission.user.email;
  const now = new Date();
  const siteOrigin = process.env.VERCEL ? DEPCUT_CANONICAL : "http://localhost:3000";

  const lines = [
    "🆕 New Submission Pending Review",
    "",
    `👤 User: ${escapeHtml(submitterName)} | ${escapeHtml(submission.userId)}`,
    `🎬 Title: ${escapeHtml(submission.title ?? "Untitled")}`,
    `🎯 Mode: ${submission.taskId ? "Task" : "Inspire"}`,
    `🏷️ Type: ${escapeHtml(submission.extension)}`,
  ];
  if (submission.inspireUrl) {
    lines.push(`🔗 Link: ${htmlLink("click here", submission.inspireUrl)}`);
  }
  if (submission.editCode) {
    // matchYoutubeLink (edit-code route) stores the canonical YouTube URL
    // itself as editCode for a link-verified submission — a different video
    // than inspireUrl above (that one's the brief; this is the artist's own
    // published upload that verified the studio match), so the label has to
    // actually distinguish them rather than both reading as "click here". A
    // studio-issued code ("VK12345678") never parses as a video id.
    const videoId = extractYoutubeVideoId(submission.editCode);
    lines.push(
      videoId
        ? `🎥 YouTube: ${htmlLink(videoId, submission.editCode)}`
        : `🔑 Edit Code: ${escapeHtml(submission.editCode)}`
    );
  }
  if (submission.voiceScript) {
    lines.push(`📜 Script: ${escapeHtml(submission.voiceScript)}`);
  }
  lines.push(
    "",
    `📅 Date: ${now.toISOString().slice(0, 10)}`,
    `🕒 Time: ${now.toISOString().slice(11, 19)}`,
    "",
    "Status: ⏳ Pending",
    "",
    `👉 Review it: ${htmlLink("click here", `${siteOrigin}/admin/submissions?id=${submission.id}`)}`,
  );

  const text = lines.join("\n");
  // A project-linked submission (submission.projectId) has no uploaded
  // thumbnail asset — the editor project itself is what's under review —
  // so only an upload-flow submission has bytes here to attach.
  const thumb = submission.assets.find((a) => a.type === "thumbnail" && a.status === "complete");
  const photo = thumb?.storageKey ? await getObject(thumb.storageKey) : null;
  if (photo) {
    const data = new Uint8Array(new ArrayBuffer(photo.bytes.byteLength));
    data.set(photo.bytes);
    await notifyTelegramWithMedia("submission", text, [{ contentType: photo.mime, data }], "HTML");
  } else {
    await notifyTelegram("submission", text, "HTML");
  }
}

// One asset's upload didn't make it — client-reported failure, or /complete
// discovering the bytes never actually arrived. Fails the asset and, if the
// submission had already asked to submit, fails the submission too: it
// never silently sits at "submitting" (or worse, "submitted") missing media.
export async function failSubmissionAsset(
  submissionId: string,
  type: string,
  error: string,
): Promise<void> {
  await prisma.submissionAsset.updateMany({
    data: { error, status: "failed" },
    where: { submissionId, type },
  });
  await prisma.submission.updateMany({
    data: { status: "failed" },
    where: { id: submissionId, status: "submitting" },
  });
}
