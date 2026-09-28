// Real Instagram Graph API video (Reels) publish for a connected Business
// Account — a two-step container flow: create a media container, poll
// until it's finished processing, then publish it. Used by
// /api/admin/social-connections/[id]/publish.
export class InstagramApiError extends Error {}

export async function publishInstagramVideo(opts: {
  accessToken: string;
  igUserId: string;
  videoUrl: string;
  caption?: string;
}): Promise<{ id: string; url: string }> {
  const initRes = await fetch(`https://graph.facebook.com/v21.0/${opts.igUserId}/media`, {
    body: new URLSearchParams({
      access_token: opts.accessToken,
      caption: opts.caption ?? "",
      media_type: "REELS",
      video_url: opts.videoUrl,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const initData = await initRes.json().catch(() => null);
  const containerId = initData?.id;
  if (!initRes.ok || !containerId) {
    throw new InstagramApiError(`Instagram rejected the video: ${initData?.error?.message ?? initRes.status}`);
  }

  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${encodeURIComponent(opts.accessToken)}`,
    );
    const statusData = await statusRes.json().catch(() => null);
    status = statusData?.status_code ?? "ERROR";
    attempts += 1;
  }
  if (status !== "FINISHED") {
    throw new InstagramApiError(`Instagram couldn't process the video (status: ${status}).`);
  }

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${opts.igUserId}/media_publish`, {
    body: new URLSearchParams({ access_token: opts.accessToken, creation_id: containerId }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const publishData = await publishRes.json().catch(() => null);
  const mediaId = publishData?.id;
  if (!publishRes.ok || !mediaId) {
    throw new InstagramApiError(`Instagram rejected the publish: ${publishData?.error?.message ?? publishRes.status}`);
  }

  const permalinkRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink&access_token=${encodeURIComponent(opts.accessToken)}`,
  );
  const permalinkData = await permalinkRes.json().catch(() => null);

  return {
    id: mediaId as string,
    url: (permalinkData?.permalink as string | undefined) ?? `https://www.instagram.com/reel/${mediaId}/`,
  };
}

export type InstagramMedia = { id: string; mediaUrl: string; caption?: string; timestamp: string };

// The read side of an import workflow (see social-workflow-import.ts) — the
// account's own video/Reels posts, newest first. media_url is a short-lived
// signed CDN link, so this is meant to be called right before downloading
// it, not cached.
export async function listInstagramMedia(igUserId: string, accessToken: string): Promise<InstagramMedia[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media?fields=id,media_type,media_url,caption,timestamp&access_token=${encodeURIComponent(accessToken)}`,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new InstagramApiError(`Instagram rejected the media list: ${data?.error?.message ?? res.status}`);
  }
  const items = (data?.data ?? []) as Array<{
    id: string;
    media_type?: string;
    media_url?: string;
    caption?: string;
    timestamp: string;
  }>;
  return items
    .filter((item) => (item.media_type === "VIDEO" || item.media_type === "REELS") && item.media_url)
    .map((item) => ({ caption: item.caption, id: item.id, mediaUrl: item.media_url!, timestamp: item.timestamp }));
}

export type InstagramAnalyticsRow = {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  subscribersGained: number;
};

// Account-level daily stats (instagram_manage_insights) — same shape as
// getYoutubeChannelAnalytics, not per-video, since a connection isn't tied
// to a specific upload. Instagram's Insights API has no account-level
// watch-time metric, so estimatedMinutesWatched always reads 0.
// follower_count comes back as a running total rather than a daily delta,
// so subscribersGained is derived by diffing consecutive days — the first
// day in range has nothing to diff against, so it reads 0.
export async function getInstagramAccountAnalytics(opts: {
  accessToken: string;
  igUserId: string;
  days?: number;
}): Promise<InstagramAnalyticsRow[]> {
  const days = opts.days ?? 28;
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    access_token: opts.accessToken,
    metric: "reach,likes,follower_count",
    metric_type: "time_series",
    period: "day",
    since: String(Math.floor(since.getTime() / 1000)),
    until: String(Math.floor(until.getTime() / 1000)),
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${opts.igUserId}/insights?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.data)) {
    throw new InstagramApiError(`Instagram rejected the insights request: ${data?.error?.message ?? res.status}`);
  }

  const byDay = new Map<string, { views: number; likes: number; followerCount: number | null }>();
  const dayKey = (isoTime: string) => isoTime.slice(0, 10);
  const cell = (day: string) => {
    let c = byDay.get(day);
    if (!c) {
      c = { followerCount: null, likes: 0, views: 0 };
      byDay.set(day, c);
    }
    return c;
  };

  const metrics = data.data as Array<{ name: string; values: Array<{ value: number; end_time: string }> }>;
  for (const metric of metrics) {
    for (const { value, end_time } of metric.values) {
      const day = dayKey(end_time);
      if (metric.name === "reach") cell(day).views += Number(value ?? 0);
      else if (metric.name === "likes") cell(day).likes += Number(value ?? 0);
      else if (metric.name === "follower_count") cell(day).followerCount = Number(value ?? 0);
    }
  }

  const sortedDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  let prevFollowers: number | null = null;
  return sortedDays.map(([day, c]) => {
    const subscribersGained = prevFollowers !== null && c.followerCount !== null ? c.followerCount - prevFollowers : 0;
    if (c.followerCount !== null) prevFollowers = c.followerCount;
    return { day, estimatedMinutesWatched: 0, likes: c.likes, subscribersGained, views: c.views };
  });
}

// A single published Reel's own totals — the Instagram side of "View
// analytics" on a Drop, same shape as getYoutubeVideoStats. Likes/comments
// come straight off the media node (instagram_basic, already granted); the
// view count needs instagram_manage_insights via the media insights edge.
export async function getInstagramMediaStats(opts: {
  accessToken: string;
  mediaId: string;
}): Promise<{ views: number; likes: number; comments: number }> {
  const [nodeRes, insightsRes] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v21.0/${opts.mediaId}?fields=like_count,comments_count&access_token=${encodeURIComponent(opts.accessToken)}`,
    ),
    fetch(
      `https://graph.facebook.com/v21.0/${opts.mediaId}/insights?metric=reach&access_token=${encodeURIComponent(opts.accessToken)}`,
    ),
  ]);
  const node = await nodeRes.json().catch(() => null);
  if (!nodeRes.ok) {
    throw new InstagramApiError(`Instagram rejected the request: ${node?.error?.message ?? nodeRes.status}`);
  }
  const insights = await insightsRes.json().catch(() => null);
  const views = insights?.data?.[0]?.values?.[0]?.value;

  return {
    comments: Number(node?.comments_count ?? 0),
    likes: Number(node?.like_count ?? 0),
    views: Number(views ?? 0),
  };
}
