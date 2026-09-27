import "server-only";
import type { ActivityItem } from "@/lib/types";

// Bluesky's public AppView: no key, no auth. Only domain-verified handles are used
// (e.g. warren.senate.gov): Bluesky checks that the domain's owner set the handle, so the
// account provably belongs to whoever runs the official website.
const API = "https://public.api.bsky.app/xrpc";

/** The Bluesky handle an official website would prove: "https://www.warren.senate.gov" → "warren.senate.gov". */
export function handleFromWebsite(website: string | undefined): string | undefined {
  if (!website) return undefined;
  try {
    const host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    // A bare shared domain (mass.gov, house.gov) isn't one person's account.
    return host.split(".").length >= 3 ? host : undefined;
  } catch {
    return undefined;
  }
}

interface FeedItem {
  reason?: unknown; // present on reposts
  post: {
    uri: string; // at://did/app.bsky.feed.post/<rkey>
    author: { handle: string };
    record: { text?: string; createdAt: string };
  };
}

/** The official's own recent posts (no replies or reposts), or [] if there's no verified account. */
export async function getBlueskyPosts(handle: string, limit: number): Promise<ActivityItem[]> {
  const params = new URLSearchParams({ actor: handle, limit: String(limit * 2), filter: "posts_no_replies" });
  const res = await fetch(`${API}/app.bsky.feed.getAuthorFeed?${params}`, { next: { revalidate: 900 } });
  // 400 = no such handle or deactivated profile: simply no posts to show.
  if (!res.ok) return [];
  const data: { feed?: FeedItem[] } = await res.json();

  return (data.feed ?? [])
    .filter((item) => !item.reason && item.post.author.handle === handle && item.post.record.text)
    .slice(0, limit)
    .map((item) => {
      const rkey = item.post.uri.split("/").pop();
      return {
        kind: "post",
        date: item.post.record.createdAt.slice(0, 10),
        title: item.post.record.text!,
        badge: "Bluesky",
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      } satisfies ActivityItem;
    });
}

/** Whether a handle currently resolves to an active Bluesky profile. */
export async function blueskyProfileExists(handle: string): Promise<boolean> {
  const res = await fetch(`${API}/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`, {
    next: { revalidate: 86400 },
  });
  return res.ok;
}
