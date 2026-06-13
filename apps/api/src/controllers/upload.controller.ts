import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_UPLOADS_BUCKET ?? process.env.S3_CLIPS_BUCKET ?? "choppr-clips";

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
    next(err);
  }
}
