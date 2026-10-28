import "server-only";
import { createHash } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfigError, features, requireEnv } from "../env";

// Private S3 storage. Object keys are built only from server-side ids (never
// from request input) and contain no personal data. Access is via short-lived
// presigned GET URLs after an ownership check.

let client: S3Client | null = null;

function s3(): { client: S3Client; bucket: string } {
  if (!features.storage()) throw new ConfigError("Missing configuration: S3_BUCKET (or AWS credentials)");
  const e = requireEnv("AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET");
  client ??= new S3Client({ region: e.AWS_REGION, credentials: { accessKeyId: e.AWS_ACCESS_KEY_ID, secretAccessKey: e.AWS_SECRET_ACCESS_KEY } });
  return { client, bucket: e.S3_BUCKET };
}

const SAFE = /^[a-z0-9-]+$/i;
const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function objectKeyFor(a: { ownerId: string | null; taskSlug?: string; itemId?: string; attemptId?: string; kind: "audio" | "image" | "recording"; assetId: string; mimeType: string }) {
  const ext = EXT[a.mimeType];
  if (!ext) throw new Error("Unsupported media type");
  for (const part of [a.ownerId, a.taskSlug, a.itemId, a.attemptId, a.assetId]) if (part && !SAFE.test(part)) throw new Error("Unsafe key part");
  const owner = a.ownerId ? `users/${a.ownerId}` : "shared";
  if (a.kind === "recording") return `${owner}/recordings/${a.attemptId}/${a.assetId}.${ext}`;
  return `${owner}/practice/${a.taskSlug}/${a.itemId}/${a.kind === "image" ? "images" : "audio"}/${a.assetId}.${ext}`;
}

export function bucketName() {
  return s3().bucket;
}

/** Uploads with server-side encryption, then verifies existence and size. */
export async function putObject(key: string, bytes: Buffer, mimeType: string): Promise<{ byteSize: number; checksum: string }> {
  const { client, bucket } = s3();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType, ServerSideEncryption: "AES256", Metadata: { sha256: checksum } }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength !== bytes.length) throw new Error("Uploaded object size mismatch");
  return { byteSize: bytes.length, checksum };
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, bucket } = s3();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getObject(key: string): Promise<Buffer> {
  const { client, bucket } = s3();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("Empty object body");
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Short-lived presigned GET (default 5 minutes). */
export async function signedGetUrl(key: string, mimeType: string, expiresInSeconds = 300): Promise<string> {
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: mimeType }), { expiresIn: expiresInSeconds });
}
