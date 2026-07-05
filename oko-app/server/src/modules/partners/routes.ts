import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireTier } from '../../middleware/tier.js';

// Партнёрский кабинет (§1.6 C ТЗ): реф-ссылка, статистика в реальном времени
// (клики -> регистрации -> оплаты -> начисления), выплаты.
// Скорость и прозрачность выплат = главный фактор роста сети.

export const partnerRoutes: FastifyPluginAsync = async (app) => {
  // Фиксация клика по реф-ссылке — публичный эндпоинт
  app.post('/click', async (req) => {
    const schema = z.object({ refCode: z.string().min(4), source: z.string().max(32).optional() });
    const body = schema.safeParse(req.body);
    if (body.success) {
      await app.db.from('ref_clicks').insert({
        ref_code: body.data.refCode,
        source: body.data.source ?? 'app',
      });
    }
    return { ok: true };
  });

  app.addHook('preHandler', app.requireAuth);

  // Активация партнёрки — со Start и выше
  app.post('/activate', { preHandler: requireTier('start') }, async (req) => {
    const { data: existing } = await app.db
      .from('partners').select('ref_code').eq('user_id', req.user!.id).maybeSingle();
    if (existing) return { refCode: existing.ref_code };

    const refCode = randomBytes(4).toString('hex');
    await app.db.from('partners').insert({ user_id: req.user!.id, ref_code: refCode });
    await app.db.from('profiles').update({ role: 'partner' }).eq('id', req.user!.id);
    return { refCode };
  });

  app.get('/stats', async (req, reply) => {
    const { data: partner } = await app.db
      .from('partners').select('ref_code').eq('user_id', req.user!.id).maybeSingle();
    if (!partner) return reply.code(404).send({ error: 'not_a_partner' });

    const [clicks, refs, accruals, payouts] = await Promise.all([
      app.db.from('ref_clicks').select('id', { count: 'exact', head: true })
        .eq('ref_code', partner.ref_code),
      app.db.from('referrals').select('id', { count: 'exact', head: true })
        .eq('partner_id', req.user!.id),
      app.db.from('accruals').select('amount_usd, level, created_at')
        .eq('partner_id', req.user!.id).order('created_at', { ascending: false }).limit(100),
      app.db.from('payouts').select('*')
        .eq('partner_id', req.user!.id).order('requested_at', { ascending: false }),
    ]);

    const earned = (accruals.data ?? []).reduce((s, a) => s + Number(a.amount_usd), 0);
    const paid = (payouts.data ?? [])
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount_usd), 0);

    return {
      refCode: partner.ref_code,
      clicks: clicks.count ?? 0,
      registrations: refs.count ?? 0,
      accruals: accruals.data ?? [],
      earnedUsd: +earned.toFixed(2),
      paidUsd: +paid.toFixed(2),
      balanceUsd: +(earned - paid).toFixed(2),
      payouts: payouts.data ?? [],
    };
  });

  app.post('/payouts', async (req, reply) => {
    const schema = z.object({
      amountUsd: z.number().positive(),
      requisites: z.record(z.string()),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    await app.db.from('payouts').insert({
      partner_id: req.user!.id,
      amount_usd: body.data.amountUsd,
      requisites: body.data.requisites,
    });
    return { ok: true };
  });
};
