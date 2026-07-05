import type { FastifyPluginAsync } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { config } from '../../config.js';
import { limitsFor } from '../../middleware/tier.js';

// Все медиа — presigned прямо в S3, файлы не проходят через API-сервер (§3 ТЗ).
// Крупные файлы (видео на проверку до 10 ГБ) — multipart в бакет с lifecycle 24ч.

const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
  forcePathStyle: true,
});

const presignSchema = z.object({
  mime: z.string().min(3),
  sizeBytes: z.number().int().positive(),
  purpose: z.enum(['chat', 'post', 'avatar', 'video_check']).default('chat'),
});

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAuth);

  app.post('/presign', async (req, reply) => {
    const body = presignSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const limits = limitsFor(req.user!.tier);
    const isTmp = body.data.purpose === 'video_check';
    const maxBytes = isTmp ? 10 * 1024 ** 3 : limits.fileMaxBytes;
    if (maxBytes !== -1 && body.data.sizeBytes > maxBytes) {
      return reply.code(413).send({ error: 'file_too_large', maxBytes });
    }

    const key = `${body.data.purpose}/${req.user!.id}/${randomUUID()}`;
    const bucket = isTmp ? config.s3.bucketTmp : config.s3.bucket;
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: body.data.mime }),
      { expiresIn: 3600 },
    );

    if (!isTmp) {
      const { data: att } = await app.db
        .from('attachments')
        .insert({ s3_key: key, mime: body.data.mime, size_bytes: body.data.sizeBytes })
        .select('id')
        .single();
      return { uploadUrl: url, key, attachmentId: att?.id };
    }
    return { uploadUrl: url, key };
  });
};
