// Creates and hardens a private S3 bucket for LafaekTOEFL media, then verifies it.
// Uses AWS credentials from the environment. Prints no secrets.
import { randomBytes } from "node:crypto";
import {
  S3Client, CreateBucketCommand, PutPublicAccessBlockCommand, PutBucketEncryptionCommand,
  PutBucketOwnershipControlsCommand, PutBucketLifecycleConfigurationCommand, PutObjectCommand,
  HeadObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION;
const bucket = process.argv[2] ?? `lafaek-toefl-media-${randomBytes(3).toString("hex")}`;
const s3 = new S3Client({ region });
const step = async (name, fn) => {
  try {
    const r = await fn();
    console.log(`OK   ${name}`);
    return r;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.name} ${e.$metadata?.httpStatusCode ?? ""}`);
    throw e;
  }
};

console.log(`bucket=${bucket} region=${region}`);
await step("create bucket", () => s3.send(new CreateBucketCommand({ Bucket: bucket, ...(region === "us-east-1" ? {} : { CreateBucketConfiguration: { LocationConstraint: region } }) })));
await step("block all public access", () => s3.send(new PutPublicAccessBlockCommand({ Bucket: bucket, PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } })));
await step("disable ACLs (bucket owner enforced)", () => s3.send(new PutBucketOwnershipControlsCommand({ Bucket: bucket, OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } })));
await step("default encryption (SSE-S3)", () => s3.send(new PutBucketEncryptionCommand({ Bucket: bucket, ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] } })));
await step("lifecycle: abort incomplete uploads after 1 day", () => s3.send(new PutBucketLifecycleConfigurationCommand({ Bucket: bucket, LifecycleConfiguration: { Rules: [{ ID: "abort-incomplete-multipart", Status: "Enabled", Filter: { Prefix: "" }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 } }] } })));

const key = "healthcheck/verify.txt";
await step("put test object", () => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ok", ContentType: "text/plain" })));
const head = await step("head test object", () => s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })));
console.log(`     encrypted=${head.ServerSideEncryption}`);
const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 });
const signed = await fetch(url);
console.log(`${signed.status === 200 ? "OK  " : "FAIL"} signed GET works (${signed.status})`);
const unsigned = await fetch(url.split("?")[0]);
console.log(`${unsigned.status === 403 ? "OK  " : "FAIL"} unsigned public GET is refused (${unsigned.status})`);
await step("delete test object", () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
console.log(`BUCKET_NAME=${bucket}`);
