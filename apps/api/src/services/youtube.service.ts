import { randomUUID } from "crypto";
import { CustomError } from "../middlewares/error.js";
import { YoutubeConnection, type IYoutubeConnection } from "../model/youtube-connection.model.js";
import { YoutubeVideo, type YoutubeVideoCategory } from "../model/youtube-video.model.js";
import { decrypt, encrypt } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
// shortcut: 20 pages is 1,000 videos. Raise this when the project quota is higher than the default 10,000 units/day.
const MAX_PAGES = 20;

const inflight = new Map<string, Promise<number>>();

export function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/** YouTube has no Shorts flag. 60 seconds is the strict cut; 61–180s Shorts land in Videos. */
export function categorize(liveBroadcastContent: string, durationSecs: number): YoutubeVideoCategory {
  if (liveBroadcastContent === "live" || liveBroadcastContent === "upcoming") return "live";
  if (durationSecs > 0 && durationSecs <= 60) return "short";
  return "video";
}

function selfCheck() {
  if (parseIsoDuration("PT1H2M3S") !== 3723) throw new Error("duration hms");
  if (parseIsoDuration("PT45S") !== 45) throw new Error("duration seconds");
  if (parseIsoDuration("PT2M") !== 120) throw new Error("duration minutes");
  if (parseIsoDuration("") !== 0) throw new Error("empty duration");
  if (categorize("live", 10) !== "live") throw new Error("live beats short");
  if (categorize("upcoming", 0) !== "live") throw new Error("upcoming is live");
  if (categorize("none", 60) !== "short") throw new Error("60s is a short");
  if (categorize("none", 61) !== "video") throw new Error("61s is a video");
}
selfCheck();

type YoutubeConfig = { clientId: string; clientSecret: string; redirectUri: string };

function youtubeConfig(): YoutubeConfig | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI
    ?? `${process.env.API_PUBLIC_URL ?? "http://localhost:4000"}/api/youtube/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

function requireConfig(): YoutubeConfig {
  const config = youtubeConfig();
  if (!config) {
    throw new CustomError("YouTube OAuth is not configured", 503);
  }
  return config;
}

export function youtubeConfigured(): boolean {
  return youtubeConfig() !== null;
}

export function buildAuthUrl(state: string): string {
  const config = requireConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export function signConnectState(userId: string): string {
  return encrypt(JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000 }));
}

export function readConnectState(state: string): string {
  let parsed: { userId?: string; exp?: number };
  try {
    parsed = JSON.parse(decrypt(state));
  } catch {
    throw new CustomError("Connect link expired. Try again.", 400);
  }
  if (!parsed.userId || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
    throw new CustomError("Connect link expired. Try again.", 400);
  }
  return parsed.userId;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return await res.json() as TokenResponse;
}

async function yt<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({})) as {
    error?: { message?: string; errors?: { reason?: string }[] };
  };
  if (!res.ok) {
    const reason = json.error?.errors?.[0]?.reason;
    if (res.status === 401 || reason === "authError") {
      throw new CustomError("unauthorized", 401);
    }
    if (reason === "quotaExceeded") {
      throw new CustomError("YouTube quota is used up for today. Try again tomorrow.", 429);
    }
    throw new CustomError(json.error?.message || `YouTube API ${res.status}`, res.status);
  }
  return json as T;
}

async function accessTokenFor(
  conn: IYoutubeConnection & { save: () => Promise<unknown> },
  force = false,
): Promise<string> {
  if (
    !force
    && conn.accessToken
    && conn.accessTokenExpiresAt
    && conn.accessTokenExpiresAt.getTime() > Date.now() + 30_000
  ) {
    return decrypt(conn.accessToken);
  }
  const config = requireConfig();
  const token = await exchangeToken(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decrypt(conn.refreshToken),
    grant_type: "refresh_token",
  }));
  if (!token.access_token) {
    if (token.error === "invalid_grant") {
      conn.status = "needs_reconnect";
      conn.lastSyncError = "Reconnect this channel";
      await conn.save();
    }
    throw new CustomError(token.error_description || "Could not refresh YouTube access", 401);
  }
  conn.accessToken = encrypt(token.access_token);
  conn.accessTokenExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000);
  if (token.refresh_token) conn.refreshToken = encrypt(token.refresh_token);
  conn.status = "active";
  await conn.save();
  return token.access_token;
}

type ChannelItem = {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

export async function connectFromCode(userId: string, code: string): Promise<string> {
  const config = requireConfig();
  const token = await exchangeToken(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  }));
  if (!token.access_token || !token.refresh_token) {
    throw new CustomError(token.error_description || "Google did not return a refresh token", 400);
  }

  const channels = await yt<{ items?: ChannelItem[] }>(
    "channels?part=snippet,contentDetails&mine=true",
    token.access_token,
  );
  const channel = channels.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel?.id || !uploadsPlaylistId) {
    throw new CustomError("That Google account has no YouTube channel", 400);
  }

  const existing = await YoutubeConnection.findOne({ userId, channelId: channel.id });
  const connection = existing ?? new YoutubeConnection({
    _id: randomUUID(),
    userId,
    channelId: channel.id,
    uploadsPlaylistId,
  });
  connection.channelTitle = channel.snippet?.title || "YouTube channel";
  const thumbnailUrl = channel.snippet?.thumbnails?.medium?.url
    ?? channel.snippet?.thumbnails?.default?.url;
  if (thumbnailUrl) connection.thumbnailUrl = thumbnailUrl;
  if (channel.snippet?.customUrl) connection.customUrl = channel.snippet.customUrl;
  connection.uploadsPlaylistId = uploadsPlaylistId;
  connection.refreshToken = encrypt(token.refresh_token);
  connection.accessToken = encrypt(token.access_token);
  connection.accessTokenExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000);
  connection.set("status", "active");
  connection.set("lastSyncError", undefined);
  await connection.save();
  try {
    await syncConnection(connection._id);
  } catch {
    // The channel is saved. lastSyncError is what the library shows.
  }
  return connection.channelTitle;
}

type PlaylistItem = {
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
    resourceId?: { videoId?: string };
  };
  contentDetails?: { videoId?: string };
};

type VideoItem = {
  id: string;
  snippet?: { liveBroadcastContent?: string };
  contentDetails?: { duration?: string };
  status?: { privacyStatus?: string; madeForKids?: boolean };
  statistics?: { viewCount?: string };
};

async function ytAuthed<T>(conn: IYoutubeConnection & { save: () => Promise<unknown> }, path: string): Promise<T> {
  try {
    return await yt<T>(path, await accessTokenFor(conn));
  } catch (error) {
    if (!(error instanceof CustomError) || error.statusCode !== 401) throw error;
    return yt<T>(path, await accessTokenFor(conn, true));
  }
}

async function doSync(connectionId: string): Promise<number> {
  const conn = await YoutubeConnection.findById(connectionId);
  if (!conn || conn.status !== "active") return 0;

  const seen: string[] = [];
  let pageToken = "";
  let pages = 0;
  let finished = false;

  try {
    while (pages < MAX_PAGES) {
      const playlistQuery = new URLSearchParams({
        part: "snippet,contentDetails",
        playlistId: conn.uploadsPlaylistId,
        maxResults: "50",
      });
      if (pageToken) playlistQuery.set("pageToken", pageToken);
      const page = await ytAuthed<{ items?: PlaylistItem[]; nextPageToken?: string }>(
        conn,
        `playlistItems?${playlistQuery}`,
      );
      const items = page.items ?? [];
      const ids = items
        .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
        .filter((id): id is string => Boolean(id));

      const details = new Map<string, VideoItem>();
      if (ids.length > 0) {
        const videoQuery = new URLSearchParams({
          part: "snippet,contentDetails,status,statistics",
          id: ids.join(","),
          maxResults: "50",
        });
        const videos = await ytAuthed<{ items?: VideoItem[] }>(conn, `videos?${videoQuery}`);
        for (const video of videos.items ?? []) details.set(video.id, video);
      }

      const now = new Date();
      const ops = items.flatMap((item) => {
        const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
        if (!videoId) return [];
        const detail = details.get(videoId);
        const durationSecs = parseIsoDuration(detail?.contentDetails?.duration ?? "");
        const live = detail?.snippet?.liveBroadcastContent ?? "none";
        seen.push(videoId);
        const thumbnailUrl = item.snippet?.thumbnails?.medium?.url
          ?? item.snippet?.thumbnails?.high?.url;
        const publishedAt = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : undefined;
        return [{
          updateOne: {
            filter: { connectionId: conn._id, videoId },
            update: {
              $set: {
                userId: conn.userId,
                channelId: conn.channelId,
                title: item.snippet?.title || "Untitled",
                ...(thumbnailUrl ? { thumbnailUrl } : {}),
                ...(publishedAt ? { publishedAt } : {}),
                durationSecs,
                privacyStatus: detail?.status?.privacyStatus ?? "unknown",
                category: categorize(live, durationSecs),
                madeForKids: detail?.status?.madeForKids === true,
                viewCount: Number(detail?.statistics?.viewCount ?? 0) || 0,
                syncedAt: now,
              },
              $setOnInsert: { _id: randomUUID() },
            },
            upsert: true,
          },
        }];
      });
      if (ops.length > 0) await YoutubeVideo.bulkWrite(ops, { ordered: false });

      pages += 1;
      pageToken = page.nextPageToken ?? "";
      if (!pageToken) {
        finished = true;
        break;
      }
    }

    if (finished) {
      await YoutubeVideo.deleteMany({
        connectionId: conn._id,
        ...(seen.length > 0 ? { videoId: { $nin: seen } } : {}),
      });
    }

    const videoCount = await YoutubeVideo.countDocuments({ connectionId: conn._id });
    conn.set("videoCount", videoCount);
    conn.set("lastSyncedAt", new Date());
    conn.set("lastSyncError", finished ? undefined : `Showing the newest ${seen.length} videos`);
    await conn.save();
    return videoCount;
  } catch (error) {
    conn.lastSyncError = error instanceof Error ? error.message : "Sync failed";
    await conn.save();
    throw error;
  }
}

export function syncConnection(connectionId: string): Promise<number> {
  const existing = inflight.get(connectionId);
  if (existing) return existing;
  const job = doSync(connectionId).finally(() => inflight.delete(connectionId));
  inflight.set(connectionId, job);
  return job;
}

export async function syncStaleConnections(): Promise<void> {
  if (!youtubeConfigured()) return;
  const staleBefore = new Date(Date.now() - HOUR_MS);
  const connections = await YoutubeConnection.find({
    status: "active",
    $or: [{ lastSyncedAt: { $exists: false } }, { lastSyncedAt: { $lt: staleBefore } }],
  }).select("_id");
  for (const connection of connections) {
    try {
      await syncConnection(connection._id);
    } catch (error) {
      logger.warn("YouTube sync failed", {
        connectionId: connection._id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}

export function startYoutubeSyncSchedule(): void {
  const run = () => {
    syncStaleConnections().catch((error) => {
      logger.error("YouTube sync schedule failed", {
        error: error instanceof Error ? error.message : error,
      });
    });
  };
  setTimeout(run, 15_000);
  setInterval(run, HOUR_MS);
}

export async function revokeConnection(refreshToken: string): Promise<void> {
  const token = decrypt(refreshToken);
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}
