export interface ParsedVideoInfo {
  embedUrl: string | null;
  isDirectVideo: boolean;
  thumbnailUrl: string;
  providerLabel: string;
}

export function getJitsiRoomUrl(exchangeId: string): string {
  const safeId = exchangeId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `https://meet.jit.si/SkillSwap-${safeId}`;
}

export function extractYouTubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/watch")) {
        return url.searchParams.get("v");
      }
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/embed/")[1]?.split("/")[0] || null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/shorts/")[1]?.split("/")[0] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function extractLoomId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "loom.com" || host === "useloom.com") {
      const match = url.pathname.match(/\/(share|embed)\/([a-zA-Z0-9]+)/);
      return match ? match[2] : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractVimeoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const match = url.pathname.match(/\/(?:video\/)?(\d+)/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseLessonVideoUrl(
  rawUrl: string,
  lessonType: "upload" | "link"
): ParsedVideoInfo {
  const trimmed = rawUrl.trim();
  if (lessonType === "upload") {
    return {
      embedUrl: null,
      isDirectVideo: true,
      thumbnailUrl: "",
      providerLabel: "Uploaded Video",
    };
  }

  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      isDirectVideo: false,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      providerLabel: "YouTube",
    };
  }

  const loomId = extractLoomId(trimmed);
  if (loomId) {
    return {
      embedUrl: `https://www.loom.com/embed/${loomId}`,
      isDirectVideo: false,
      thumbnailUrl: "",
      providerLabel: "Loom",
    };
  }

  const vimeoId = extractVimeoId(trimmed);
  if (vimeoId) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      isDirectVideo: false,
      thumbnailUrl: "",
      providerLabel: "Vimeo",
    };
  }

  const lower = trimmed.toLowerCase().split("?")[0];
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
    return {
      embedUrl: null,
      isDirectVideo: true,
      thumbnailUrl: "",
      providerLabel: "Direct Video",
    };
  }

  return {
    embedUrl: null,
    isDirectVideo: false,
    thumbnailUrl: "",
    providerLabel: "Video Link",
  };
}
