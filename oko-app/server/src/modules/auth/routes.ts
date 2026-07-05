import type { FastifyPluginAsync } from 'fastify';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { config } from '../../config.js';

// Вход: Telegram initData (Mini App) или телефон/e-mail через Supabase Auth (клиент напрямую).
// Реф-код в ссылке регистрации привязывает клиента к партнёру (2 уровня).

const tgLoginSchema = z.object({
  initData: z.string().min(1),
  refCode: z.string().optional(),
});

/** Проверка подписи initData по алгоритму Telegram (HMAC-SHA256, ключ = HMAC('WebAppData', botToken)). */
export function verifyTgInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (expected !== hash) return null;
  return Object.fromEntries(params.entries());
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/telegram', async (req, reply) => {
    const body = tgLoginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const data = verifyTgInitData(body.data.initData, config.tg.botToken);
    if (!data) return reply.code(401).send({ error: 'bad_signature' });

    const tgUser = JSON.parse(data.user ?? '{}') as {
      id: number; username?: string; first_name?: string; photo_url?: string;
    };
    if (!tgUser.id) return reply.code(400).send({ error: 'no_user' });

    // Найти/создать профиль по tg_id, при регистрации — привязать реф-код
    const { data: existing } = await app.db
      .from('profiles').select('id').eq('tg_id', tgUser.id).maybeSingle();

    let userId = existing?.id as string | undefined;
    if (!userId) {
      const { data: created, error } = await app.db.auth.admin.createUser({
        user_metadata: { tg_id: tgUser.id, username: tgUser.username },
        email_confirm: true,
      });
      if (error || !created.user) return reply.code(500).send({ error: 'create_failed' });
      userId = created.user.id;
      await app.db.from('profiles').insert({
        id: userId,
        tg_id: tgUser.id,
        username: tgUser.username,
        display_name: tgUser.first_name,
        avatar_url: tgUser.photo_url,
      });
      if (body.data.refCode) {
        const { data: partner } = await app.db
          .from('partners').select('user_id').eq('ref_code', body.data.refCode).maybeSingle();
        if (partner) {
          await app.db.from('referrals').insert({ partner_id: partner.user_id, referred_id: userId });
        }
      }
    }

    // TODO(day 1-3): выпуск сессионного JWT (Supabase admin generateLink / кастомный токен)
    return { userId };
  });

  app.get('/me', { preHandler: app.requireAuth }, async (req) => {
    const { data } = await app.db
      .from('profiles').select('*').eq('id', req.user!.id).single();
    return { profile: data, tier: req.user!.tier };
  });
};
