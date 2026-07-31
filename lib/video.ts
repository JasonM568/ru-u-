/** 解析 YouTube / Vimeo 網址 → 嵌入播放器 URL。無法辨識回傳 null。 */
export function videoEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id ? youtubeEmbed(id, u) : null;
  }

  // youtube.com/watch?v= | /shorts/<id> | /live/<id> | /embed/<id>
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v) return youtubeEmbed(v, u);
    const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]+)/);
    if (m) return youtubeEmbed(m[2], u);
    return null;
  }

  // vimeo.com/<id> 或 vimeo.com/<id>/<hash>（未列出影片）
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
    if (!m) return null;
    const h = m[2] ? `?h=${m[2]}` : "";
    return `https://player.vimeo.com/video/${m[1]}${h}`;
  }

  return null;
}

function youtubeEmbed(id: string, u: URL): string | null {
  if (!/^[\w-]{6,}$/.test(id)) return null;
  // 保留起始時間（t=90 或 t=1m30s → 秒數）
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  const secs = t ? parseTime(t) : null;
  const start = secs ? `?start=${secs}` : "";
  return `https://www.youtube-nocookie.com/embed/${id}${start}`;
}

function parseTime(t: string): number | null {
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return null;
  const n = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
  return n > 0 ? n : null;
}
