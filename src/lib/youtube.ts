/** Extracts a YouTube video ID from common URL shapes (watch?v=, youtu.be/,
 * embed/, shorts/) and returns an embeddable player URL, or null if the
 * input isn't a recognizable YouTube link — callers should fall back to a
 * plain "open link" affordance in that case rather than an iframe. */
export function toYouTubeEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parsed.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.split("/")[2] || null;
    } else if (parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.split("/")[2] || null;
    }
  }

  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
