import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { logger } from "../utils/logger.js";

const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface JobMessage {
  jobId:          string;
  projectId:      string;
  userId:         string;
  url:            string;
  s3Key:          string;
  query:          string;
  clipModel:      string;
  genre:          string;
  clipLength:     string;
  maxClips:       number;
  language?:      string;
  editFull?:      boolean;
}

export async function enqueueJob(payload: JobMessage): Promise<void> {
  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) throw new Error("SQS_QUEUE_URL env variable is not set");

  await sqs.send(
    new SendMessageCommand({
      QueueUrl:    queueUrl,
      MessageBody: JSON.stringify(payload),
    })
  );

  logger.info("Job message sent to SQS", {
    jobId: payload.jobId,
    projectId: payload.projectId,
    userId: payload.userId,
    source: payload.s3Key ? "upload" : "url",
    queueUrl,
  });
}
