import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireTier, consumeCounter } from '../../middleware/tier.js';

// Каркас мини-аппов (§1.5): реестр + мост window.OKO.call(...) с клиента.
// Нейро-эндпоинты — свой строгий rate limit (защита от выжигания токенов).

export const miniappRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (req) => {
    const { data } = await app.db.from('miniapps').select('*').eq('enabled', true);
    return { miniapps: data ?? [], tier: req.user!.tier };
  });

  // === A. Система роста по анкете (Pro+) ===
  app.post(
    '/system/submit',
    { preHandler: requireTier('pro'), config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const schema = z.object({ answers: z.record(z.unknown()) }); // 8 секций из ANKETA
      const body = schema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });

      const { data: system } = await app.db
        .from('systems')
        .insert({ user_id: req.user!.id, answers: body.data.answers })
        .select('id, status')
        .single();

      // Очередь: генерация Claude с MASTER-TZ идёт воркером/n8n, статус queued -> generating
      // -> review (превью в командный чат) -> done (html_url в кабинете клиента)
      return { system };
    },
  );

  app.get('/system/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data } = await app.db
      .from('systems').select('id, status, html_url, created_at')
      .eq('id', id).eq('user_id', req.user!.id).maybeSingle();
    if (!data) return reply.code(404).send({ error: 'not_found' });
    return { system: data };
  });

  // === B. Видео-премодератор ===
  app.post(
    '/video-check',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const schema = z.object({ s3Key: z.string().min(8) }); // ключ из /media/presign purpose=video_check
      const body = schema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });

      const allowed = await consumeCounter(
        app, req.user!.id, req.user!.tier, 'videoChecksPerMonth', 'video_checks',
      );
      if (!allowed) return reply.code(402).send({ error: 'limit_reached' });

      const { data: check } = await app.db
        .from('video_checks')
        .insert({ user_id: req.user!.id, s3_key_tmp: body.data.s3Key, status: 'analyzing' })
        .select('id, status')
        .single();

      // Анализ Gemini запускается воркером; результат пишется в video_checks
      return { check };
    },
  );

  app.get('/video-check/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data } = await app.db
      .from('video_checks').select('*')
      .eq('id', id).eq('user_id', req.user!.id).maybeSingle();
    if (!data) return reply.code(404).send({ error: 'not_found' });
    return { check: data };
  });
};
