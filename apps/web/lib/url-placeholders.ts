export const URL_PLACEHOLDERS = [
  "Paste a YouTube link…",
  "Paste a Google Drive link…",
  "Paste a Loom link…",
  "Paste an Instagram reel…",
];

export interface UrlValidationResult {
  valid: boolean;
  platform?: string;
  error?: string;
}

const ALLOWED_PLATFORMS: { name: string; pattern: RegExp }[] = [
  {
    // Any youtube.com or youtu.be URL — live is blocked separately above
    name: "YouTube",
    pattern: /^https?:\/\/((www\.|m\.)?youtube\.com|youtu\.be)\//i,
  },
  {
    // Any drive.google.com or docs.google.com URL
    name: "Google Drive",
    pattern: /^https?:\/\/((www\.)?(drive|docs)\.google\.com)\//i,
  },
  {
    name: "Loom",
    pattern: /^https?:\/\/(www\.)?loom\.com\/(share|v|embed)\//i,
  },
  {
    name: "Instagram",
    pattern: /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//i,
  },
];

/**
 * Validates that a URL is syntactically valid and from a supported platform.
 * Returns { valid: true, platform } on success, or { valid: false, error } on failure.
 */
export function validateVideoUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false, error: "Please enter a URL." };

  // Syntax check
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL. Please check and try again." };
  }

  // Reject YouTube live streams before the platform allowlist
  if (/youtube\.com\/live\//i.test(trimmed)) {
    return {
      valid: false,
      error: "YouTube live streams are not supported. Please use a regular YouTube video, short, or replay link.",
    };
  }

  // Platform allowlist
  for (const { name, pattern } of ALLOWED_PLATFORMS) {
    if (pattern.test(trimmed)) return { valid: true, platform: name };
  }

  return {
    valid: false,
    error:
      "Unsupported link. Please paste a YouTube, Google Drive, Loom, or Instagram URL.",
  };
}
