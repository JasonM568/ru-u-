export type VideoStatus = "ready" | "private" | "processing";

export async function inspectVideo(raw: string): Promise<VideoStatus> {
  let url: URL;
  try { url = new URL(raw); } catch { return "processing"; }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const youtube = ["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host);
  const vimeo = ["vimeo.com", "player.vimeo.com"].includes(host);
  if (!youtube && !vimeo) return "processing";
  try {
    const endpoint = youtube
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(raw)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(raw)}`;
    const response = await fetch(endpoint, {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (youtube && (response.status === 401 || response.status === 403)) return "private";
    return response.ok ? "ready" : "processing";
  } catch { return "processing"; }
}
