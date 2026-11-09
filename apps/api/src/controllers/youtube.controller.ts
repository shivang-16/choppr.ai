import { Request, Response, NextFunction } from "express";
import { YoutubeConnection } from "../model/youtube-connection.model.js";
import { YoutubeVideo } from "../model/youtube-video.model.js";
import { Project } from "../model/project.model.js";
import { CustomError } from "../middlewares/error.js";
import {
  buildAuthUrl,
  connectFromCode,
  readConnectState,
  revokeConnection,
  signConnectState,
  syncConnection,
} from "../services/youtube.service.js";

const FRONTEND_URL = () => process.env.FRONTEND_URL ?? "http://localhost:3000";

function userId(req: Request): string {
  const id = req.user?._id;
  if (!id) throw new CustomError("Unauthorized", 401);
  return String(id);
}

function publicConnection(connection: {
  _id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  customUrl?: string;
  status: string;
  lastSyncedAt?: Date;
  lastSyncError?: string;
  videoCount: number;
}) {
  return {
    _id: connection._id,
    channelId: connection.channelId,
    channelTitle: connection.channelTitle,
    thumbnailUrl: connection.thumbnailUrl,
    customUrl: connection.customUrl,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt,
    lastSyncError: connection.lastSyncError,
    videoCount: connection.videoCount,
  };
}

function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const parts = parsed.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => part === "shorts" || part === "embed" || part === "live" || part === "v");
      if (marker >= 0) return parts[marker + 1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

async function library(ownerId: string) {
  const [connections, videos, projects] = await Promise.all([
    YoutubeConnection.find({ userId: ownerId }).sort({ createdAt: 1 }).lean(),
    YoutubeVideo.find({ userId: ownerId }).sort({ publishedAt: -1 }).limit(2000).lean(),
    Project.find({ userId: ownerId }).select("sourceUrl status createdAt").sort({ createdAt: -1 }).lean(),
  ]);
  const projectByVideo = new Map<string, { projectId: string; projectStatus: string }>();
  for (const project of projects) {
    const id = youtubeVideoId(project.sourceUrl);
    if (!id || projectByVideo.has(id)) continue;
    projectByVideo.set(id, { projectId: String(project._id), projectStatus: project.status });
  }
  return {
    connections: connections.map(publicConnection),
    videos: videos.map((video) => ({ ...video, ...projectByVideo.get(video.videoId) })),
  };
}

export async function listYoutube(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await library(userId(req)));
  } catch (error) {
    next(error);
  }
}

export async function startYoutubeConnect(req: Request, res: Response, next: NextFunction) {
  try {
    const state = signConnectState(userId(req));
    res.json({ url: buildAuthUrl(state) });
  } catch (error) {
    next(error);
  }
}

export async function youtubeCallback(req: Request, res: Response) {
  const back = (query: Record<string, string>) => {
    const url = new URL("/dashboard/youtube", FRONTEND_URL());
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    res.redirect(url.toString());
  };

  const oauthError = typeof req.query.error === "string" ? req.query.error : "";
  if (oauthError) {
    back({ error: oauthError === "access_denied" ? "YouTube connection was cancelled" : oauthError });
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    back({ error: "Missing YouTube authorization code" });
    return;
  }

  try {
    const ownerId = readConnectState(state);
    await connectFromCode(ownerId, code);
    back({ connected: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect YouTube";
    back({ error: message });
  }
}

export async function refreshYoutube(req: Request, res: Response, next: NextFunction) {
  try {
    const ownerId = userId(req);
    const connectionId = typeof req.body?.connectionId === "string" ? req.body.connectionId : undefined;
    const filter: { userId: string; status: "active"; _id?: string } = {
      userId: ownerId,
      status: "active",
    };
    if (connectionId) filter._id = connectionId;
    const connections = await YoutubeConnection.find(filter).select("_id");
    if (connectionId && connections.length === 0) {
      throw new CustomError("Channel not found", 404);
    }
    for (const connection of connections) {
      try {
        await syncConnection(connection._id);
      } catch {
        // The connection row keeps lastSyncError for the library screen.
      }
    }
    res.json(await library(ownerId));
  } catch (error) {
    next(error);
  }
}

export async function disconnectYoutube(req: Request, res: Response, next: NextFunction) {
  try {
    const ownerId = userId(req);
    const connectionId = String(req.params.id ?? "");
    const connection = await YoutubeConnection.findOne({ _id: connectionId, userId: ownerId });
    if (!connection) throw new CustomError("Channel not found", 404);
    await revokeConnection(connection.refreshToken);
    await YoutubeVideo.deleteMany({ connectionId: connection._id, userId: ownerId });
    await connection.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
