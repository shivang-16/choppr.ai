import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../utils/logger.js";
import { probeDurationSecs } from "../utils/ffprobe.js";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_MEDIA_BUCKET ?? "choppr-media";

// POST /api/uploads/presign  — returns a presigned PUT URL + s3Key
export async function presignUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const s3Key = `uploads/${userId}/${randomUUID()}.mp4`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
      ContentType: "video/mp4",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ uploadUrl, s3Key, bucket: BUCKET });
  } catch (err) {
    logger.error("Upload presign failed", { error: err });
    next(err);
  }
}

// POST /api/uploads/probe  — ffprobe duration for an uploaded S3 object
export async function probeUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const s3Key = String(req.body?.s3Key ?? "").trim();
    if (!s3Key) {
      res.status(400).json({ error: "s3Key is required" });
      return;
    }

    // Only allow probing this user's uploads
    if (!s3Key.startsWith(`uploads/${userId}/`)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
    const signedGetUrl = await getSignedUrl(s3, getCmd, { expiresIn: 600 });

    const durationSecs = await probeDurationSecs(signedGetUrl, 120_000);
    if (!durationSecs || durationSecs <= 0) {
      logger.warn("Upload probe: unable to determine duration", {
        userId,
        s3Key,
      });
      res.status(422).json({
        durationSecs: null,
        error: "Unable to determine video duration.",
      });
      return;
    }

    logger.info("Upload probe succeeded", { userId, s3Key, durationSecs });
    res.json({ durationSecs });
  } catch (err) {
    logger.error("Upload probe failed", {
      error: err instanceof Error ? err.message : String(err),
      userId: (req as any).user?._id ?? null,
      s3Key: req.body?.s3Key ?? null,
    });
    next(err);
  }
}
