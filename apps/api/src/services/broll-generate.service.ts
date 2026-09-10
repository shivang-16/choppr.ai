import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { BrollJob, type IBrollShot } from "../model/broll-job.model.js";
import { logger } from "../utils/logger.js";
import { CREDITS_PER_BROLL_CANVAS, refundBrollCredits } from "./credits.service.js";

function imageModel(): string {
  const id = process.env.IMAGE_MODEL?.trim();
  if (!id) throw new Error("IMAGE_MODEL is not set");
  return id;
}

function imageModelRegion(): string {
  const region = process.env.IMAGE_MODEL_REGION?.trim();
  if (!region) throw new Error("IMAGE_MODEL_REGION is not set");
  return region;
}

const imageClient = () =>
  new BedrockRuntimeClient({
    region: imageModelRegion(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_CLIPS_BUCKET ?? process.env.S3_MEDIA_BUCKET ?? "choppr-media";
const REGION = process.env.AWS_REGION ?? "ap-south-1";

const STABILITY_ASPECTS = new Set([
  "16:9", "1:1", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21",
]);

function stabilityAspect(aspectRatio: string): string {
  return STABILITY_ASPECTS.has(aspectRatio) ? aspectRatio : "9:16";
}

async function generateBrollPng(prompt: string, aspectRatio: string): Promise<Buffer> {
  const invoke = async (includeNegative: boolean) => {
    const body: Record<string, unknown> = {
      prompt: prompt.slice(0, 10_000),
      aspect_ratio: stabilityAspect(aspectRatio),
      output_format: "png",
      mode: "text-to-image",
    };
    if (includeNegative) {
      body.negative_prompt = "text, watermark, logo, caption, subtitles, letters";
    }

    const response = await imageClient().send(new InvokeModelCommand({
      modelId: imageModel(),
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    }));
    const json = JSON.parse(new TextDecoder().decode(response.body)) as {
      images?: string[];
      finish_reasons?: Array<string | null>;
      error?: string;
    };
    const reason = json.finish_reasons?.[0];
    if (reason) throw new Error(reason);
    const b64 = json.images?.[0];
    if (!b64) throw new Error(json.error || "Image model returned no image");
    return Buffer.from(b64, "base64");
  };

  try {
    return await invoke(true);
  } catch {
    return await invoke(false);
  }
}

function patchShot(shot: IBrollShot, patch: Partial<IBrollShot>) {
  Object.assign(shot, patch);
}

export async function runBrollGenerateJob(jobId: string): Promise<void> {
  const job = await BrollJob.findById(jobId);
  if (!job) return;
  job.status = "generating";
  await job.save();

  try {
    let anyReady = false;
    for (let i = 0; i < job.shots.length; i++) {
      const shot = job.shots[i]!;
      try {
        const png = await generateBrollPng(shot.prompt || shot.phrase, job.aspectRatio);
        const s3Key = `broll/${job.userId}/${jobId}/${shot.id}.png`;
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: s3Key,
          Body: png,
          ContentType: "image/png",
        }));
        const s3Url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;
        patchShot(shot, { status: "ready", s3Key, s3Url });
        delete shot.error;
        job.markModified("shots");
        anyReady = true;
        await job.save();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("B-roll image generate failed", {
          jobId,
          shotId: shot.id,
          model: imageModel(),
          region: imageModelRegion(),
          error: message,
        });
        patchShot(shot, { status: "failed", error: message });
        job.markModified("shots");
        await job.save();
      }
    }

    job.status = anyReady ? "done" : "failed";
    if (!anyReady) job.error = "All B-roll shots failed to generate";
    await job.save();
  } finally {
    const unpaid = job.shots.filter(s => s.status !== "ready").length;
    if (unpaid > 0) {
      const refunded = await refundBrollCredits(
        job.userId,
        jobId,
        unpaid * CREDITS_PER_BROLL_CANVAS,
      );
      if (refunded > 0) {
        logger.info("Refunded failed B-roll stills", { jobId, unpaid, refunded });
      }
    }
  }
}
