import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function requireEnv(env, key) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing ${key}.`);
  }
  return value;
}

export function getR2Config(env = process.env) {
  const accountId = requireEnv(env, 'R2_ACCOUNT_ID');
  const accessKeyId = requireEnv(env, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv(env, 'R2_SECRET_ACCESS_KEY');
  const bucketName = requireEnv(env, 'R2_BUCKET_NAME');
  const endpoint = env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint,
    region: env.R2_BUCKET_REGION ?? 'auto',
  };
}

export function createR2Client(env = process.env) {
  const config = getR2Config(env);
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function getJsonObject(client, bucketName, key) {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );

    const text = await response.Body.transformToString();
    return JSON.parse(text);
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }

    throw error;
  }
}

export async function putJsonObject(
  client,
  bucketName,
  key,
  payload,
  { cacheControl = null } = {},
) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(payload),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: cacheControl ?? undefined,
    }),
  );
}

export async function listObjectKeys(client, bucketName, prefix) {
  const keys = [];
  let continuationToken = undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const entry of response.Contents ?? []) {
      if (entry.Key) {
        keys.push(entry.Key);
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}
