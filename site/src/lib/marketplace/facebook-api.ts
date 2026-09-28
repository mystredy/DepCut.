// Real Facebook Graph API video publish for a connected Page. Used by
// /api/admin/social-connections/[id]/publish.
export class FacebookApiError extends Error {}

export async function publishFacebookVideo(opts: {
  accessToken: string;
  pageId: string;
  videoUrl: string;
  description?: string;
}): Promise<{ id: string; url: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${opts.pageId}/videos`, {
    body: new URLSearchParams({
      access_token: opts.accessToken,
      description: opts.description ?? "",
      file_url: opts.videoUrl,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) {
    throw new FacebookApiError(`Facebook rejected the video: ${data?.error?.message ?? res.status}`);
  }
  return { id: data.id as string, url: `https://www.facebook.com/${opts.pageId}/videos/${data.id}` };
}

export type FacebookVideo = { id: string; source: string; description?: string; createdTime: string };

// The read side of an import workflow (see social-workflow-import.ts) — a
// Page's own videos, newest first. The `source` field (a direct URL to the
// raw file) requires Meta's App Review approval for the relevant
// permission; until that's approved for this app, Facebook returns this
// field omitted or the call fails outright, same as any other unapproved
// permission — see IMPORTABLE_PLATFORMS's doc comment in oauth-providers.ts.
export async function listFacebookVideos(pageId: string, accessToken: string): Promise<FacebookVideo[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/videos?fields=id,source,description,created_time&access_token=${encodeURIComponent(accessToken)}`,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new FacebookApiError(`Facebook rejected the video list: ${data?.error?.message ?? res.status}`);
  }
  const items = (data?.data ?? []) as Array<{
    id: string;
    source?: string;
    description?: string;
    created_time: string;
  }>;
  return items
    .filter((item) => item.source)
    .map((item) => ({ createdTime: item.created_time, description: item.description, id: item.id, source: item.source! }));
}

export type FacebookAnalyticsRow = {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  subscribersGained: number;
};

// Page-level daily stats (read_insights) — same shape as
// getYoutubeChannelAnalytics, not per-video, since a connection isn't tied
// to a specific upload. page_fan_adds is Meta's own name for new Page
// likes/follows gained that day; there's no separate day-level "post like"
// metric, so likes comes from page_actions_post_reactions_total's "like"
// breakdown instead.
export async function getFacebookPageAnalytics(opts: {
  accessToken: string;
  pageId: string;
  days?: number;
}): Promise<FacebookAnalyticsRow[]> {
  const days = opts.days ?? 28;
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    access_token: opts.accessToken,
    metric: "page_video_views,page_video_view_time,page_actions_post_reactions_total,page_fan_adds",
    period: "day",
    since: String(Math.floor(since.getTime() / 1000)),
    until: String(Math.floor(until.getTime() / 1000)),
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${opts.pageId}/insights?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.data)) {
    throw new FacebookApiError(`Facebook rejected the insights request: ${data?.error?.message ?? res.status}`);
  }

  const byDay = new Map<string, FacebookAnalyticsRow>();
  const dayKey = (isoTime: string) => isoTime.slice(0, 10);
  const row = (day: string) => {
    let r = byDay.get(day);
    if (!r) {
      r = { day, estimatedMinutesWatched: 0, likes: 0, subscribersGained: 0, views: 0 };
      byDay.set(day, r);
    }
    return r;
  };

  const metrics = data.data as Array<{
    name: string;
    values: Array<{ value: number | Record<string, number> | undefined; end_time: string }>;
  }>;
  for (const metric of metrics) {
    for (const { value, end_time } of metric.values) {
      const day = dayKey(end_time);
      if (metric.name === "page_video_views") row(day).views += Number(value ?? 0);
      else if (metric.name === "page_video_view_time") row(day).estimatedMinutesWatched += Number(value ?? 0) / 60_000;
      else if (metric.name === "page_fan_adds") row(day).subscribersGained += Number(value ?? 0);
      else if (metric.name === "page_actions_post_reactions_total") {
        const byType = value as Record<string, number> | undefined;
        row(day).likes += Number(byType?.like ?? 0);
      }
    }
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// A single published video's own totals — the Facebook side of "View
// analytics" on a Drop, same shape as getYoutubeVideoStats. Likes/comments
// come straight off the video node (pages_read_engagement, already
// granted); the view count needs read_insights via the video_insights edge.
export async function getFacebookVideoStats(opts: {
  accessToken: string;
  videoId: string;
}): Promise<{ views: number; likes: number; comments: number }> {
  const [nodeRes, insightsRes] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v21.0/${opts.videoId}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0)&access_token=${encodeURIComponent(opts.accessToken)}`,
    ),
    fetch(
      `https://graph.facebook.com/v21.0/${opts.videoId}/video_insights?metric=total_video_views&access_token=${encodeURIComponent(opts.accessToken)}`,
    ),
  ]);
  const node = await nodeRes.json().catch(() => null);
  if (!nodeRes.ok) {
    throw new FacebookApiError(`Facebook rejected the request: ${node?.error?.message ?? nodeRes.status}`);
  }
  const insights = await insightsRes.json().catch(() => null);
  const views = insights?.data?.[0]?.values?.[0]?.value;

  return {
    comments: Number(node?.comments?.summary?.total_count ?? 0),
    likes: Number(node?.likes?.summary?.total_count ?? 0),
    views: Number(views ?? 0),
  };
}
