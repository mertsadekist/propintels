import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3: S3Client | null = null;

function getS3(): S3Client {
  if (!s3) {
    const endpoint = process.env.S3_ENDPOINT || process.env.STORAGE_ENDPOINT;
    s3 = new S3Client({
      region: process.env.S3_REGION ?? process.env.STORAGE_REGION ?? "auto",
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId:
          process.env.S3_ACCESS_KEY_ID ?? process.env.STORAGE_ACCESS_KEY ?? "",
        secretAccessKey:
          process.env.S3_SECRET_ACCESS_KEY ?? process.env.STORAGE_SECRET_KEY ?? "",
      },
      forcePathStyle: endpoint?.includes("r2.cloudflarestorage.com") ?? false,
    });
  }
  return s3;
}

const getBucket = () =>
  process.env.S3_BUCKET ?? process.env.STORAGE_BUCKET ?? "ist-reports";

const EXPIRY_SECONDS = 60 * 60; // 1 hour

export async function uploadPdf(
  key: string,
  buffer: Buffer,
  checksum?: string
): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      Metadata: {
        checksum: checksum ?? "",
      },
    })
  );
}

export async function getSignedDownloadUrl(
  storageKey: string,
  expiresInSeconds: number = EXPIRY_SECONDS
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });

  return getSignedUrl(getS3(), command, { expiresIn: expiresInSeconds });
}

export function buildStorageKey(leadId: string, reportId: string): string {
  return `reports/${leadId}/${reportId}/valuation-report.pdf`;
}
