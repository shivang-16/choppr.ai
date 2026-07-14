import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UserAsset, IUserAsset } from "../model/user-asset.model.js";
import { logger } from "../utils/logger.js";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_MEDIA_BUCKET ?? "choppr-media";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/gif":  "gif",
};

function assetTypeFromMime(mime: string): IUserAsset["assetType"] {
  if (mime.startsWith("image/"))  return "image";
  if (mime.startsWith("audio/"))  return "audio";
  if (mime.startsWith("video/"))  return "video";
  return "other";
}

// POST /api/user-assets/presign
// Body: { mimeType, fileName, sizeBytes }
export async function presignAssetUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { mimeType, fileName, sizeBytes } = req.body as {
      mimeType: string;
      fileName: string;
      sizeBytes?: number;
    };

    if (!mimeType || !fileName) {
      res.status(400).json({ error: "mimeType and fileName are required" });
      return;
    }

    const ext = ALLOWED_IMAGE_TYPES[mimeType] ?? mimeType.split("/")[1] ?? "bin";
    const assetId = randomUUID();
    const s3Key   = `user-assets/${userId}/${assetId}.${ext}`;
    const s3Url   = `https://${BUCKET}.s3.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com/${s3Key}`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    // Pre-create the DB record (will be confirmed on complete)
    const asset = await UserAsset.create({
      _id:       assetId,
      userId,
      name:      fileName,
      s3Key,
      s3Url,
      mimeType,
      sizeBytes: sizeBytes ?? 0,
      assetType: assetTypeFromMime(mimeType),
    });

    logger.info("Asset presign issued", { userId, assetId, s3Key, mimeType });

    res.json({ uploadUrl, assetId, s3Key, s3Url, bucket: BUCKET, asset });
  } catch (err) {
    logger.error("Asset presign failed", { error: err });
    next(err);
  }
}

// GET /api/user-assets
// Returns all assets for the authenticated user
export async function listUserAssets(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { type } = req.query as { type?: string };

    const filter: Record<string, string> = { userId };
    if (type) filter.assetType = type;

    const assets = await UserAsset.find(filter).sort({ createdAt: -1 }).lean();

    res.json(assets);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/user-assets/:assetId
export async function deleteUserAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const userId  = (req as any).user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { assetId } = req.params;
    const asset = await UserAsset.findById(assetId);
    if (!asset || asset.userId !== userId) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    // Delete from S3
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: asset.s3Key }));

    await UserAsset.findByIdAndDelete(assetId);

    logger.info("Asset deleted", { userId, assetId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
