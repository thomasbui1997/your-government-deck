// Links to an official's social media profiles. We can show Bluesky posts directly; for
// X, Facebook, Instagram, and YouTube (whose APIs are paid or gated) we link out instead.

export type SocialPlatform = "x" | "facebook" | "instagram" | "youtube" | "bluesky";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  bluesky: "Bluesky",
};

const clean = (h?: string) => h?.trim().replace(/^@/, "") || undefined;

/** Builds profile links from raw handles; missing or empty handles are skipped. */
export function socialLinks(raw: {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  youtube_id?: string;
  bluesky?: string;
}): SocialLink[] {
  const links: SocialLink[] = [];
  const x = clean(raw.twitter);
  if (x) links.push({ platform: "x", url: `https://x.com/${x}` });
  const fb = clean(raw.facebook);
  if (fb) links.push({ platform: "facebook", url: `https://www.facebook.com/${fb}` });
  const ig = clean(raw.instagram);
  if (ig) links.push({ platform: "instagram", url: `https://www.instagram.com/${ig}` });
  // Channel IDs are stable; legacy usernames still redirect via /user/.
  const ytId = clean(raw.youtube_id) ?? (/^UC[\w-]{22}$/.test(raw.youtube ?? "") ? raw.youtube : undefined);
  const yt = clean(raw.youtube);
  if (ytId) links.push({ platform: "youtube", url: `https://www.youtube.com/channel/${ytId}` });
  else if (yt) links.push({ platform: "youtube", url: `https://www.youtube.com/user/${yt}` });
  const bsky = clean(raw.bluesky);
  if (bsky) links.push({ platform: "bluesky", url: `https://bsky.app/profile/${bsky}` });
  return links;
}
