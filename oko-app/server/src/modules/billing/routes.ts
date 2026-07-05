import type { FastifyPluginAsync } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';
import {
  PARTNER_L1_PERCENT,
  PARTNER_L1_PERCENT_AFTER_6M,
  PARTNER_L2_PERCENT,
} from '../../tiers.js';

// Оплата (§1.7 ТЗ): Lava.top / крипта / эквайринг -> вебхук -> моментальная активация.
// Критерий готовности: оплата любого тарифа активирует лимиты моментально.

const PERIOD_MONTHS: Record<string, number> = { month: 1, '3m': 3, '6m': 6, year: 12 };

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook/lava', { config: { rateLimit: false } }, async (req, reply) => {
    const signature = req.headers['x-signature'] as string | undefined;
    const raw = JSON.stringify(req.body);
    const expected = createHmac('sha256', config.lava.webhookSecret).update(raw).digest('hex');
    if (!signature || signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return reply.code(401).send({ error: 'bad_signature' });
    }

    const evt = req.body as {
      order_id: string; status: string; amount: number;
      custom: { userId: string; tier: string; period: string };
    };
    if (evt.status !== 'success') return { ok: true };

    // Идемпотентность по (provider, external_id)
    const { data: payment, error } = await app.db
      .from('payments')
      .insert({
        user_id: evt.custom.userId,
        provider: 'lava',
        external_id: evt.order_id,
        amount_usd: evt.amount,
        tier: evt.custom.tier,
        period: evt.custom.period,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return { ok: true }; // дубль вебхука
      return reply.code(500).send({ error: 'payment_failed' });
    }

    await activateSubscription(app, evt.custom.userId, evt.custom.tier, evt.custom.period);
    await accruePartnerCommissions(app, payment.id, evt.custom.userId, evt.amount);
    return { ok: true };
  });

  app.get('/subscription', { preHandler: app.requireAuth }, async (req) => ({
    tier: req.user!.tier,
  }));
};

async function activateSubscription(
  app: Parameters<FastifyPluginAsync>[0],
  userId: string,
  tier: string,
  period: string,
) {
  const months = PERIOD_MONTHS[period] ?? 1;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);

  await app.db
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active');
  await app.db.from('subscriptions').insert({
    user_id: userId,
    tier,
    period,
    expires_at: expires.toISOString(),
  });
}

/** 2 уровня: L1 15% (после 6 мес подписки клиента — 5%), L2 5%. */
async function accruePartnerCommissions(
  app: Parameters<FastifyPluginAsync>[0],
  paymentId: string,
  payerId: string,
  amountUsd: number,
) {
  const { data: ref } = await app.db
    .from('referrals')
    .select('partner_id, created_at')
    .eq('referred_id', payerId)
    .maybeSingle();
  if (!ref) return;

  const monthsSinceRef =
    (Date.now() - new Date(ref.created_at).getTime()) / (30 * 24 * 3600 * 1000);
  const l1Percent = monthsSinceRef > 6 ? PARTNER_L1_PERCENT_AFTER_6M : PARTNER_L1_PERCENT;

  await app.db.from('accruals').insert({
    partner_id: ref.partner_id,
    payment_id: paymentId,
    level: 1,
    percent: l1Percent,
    amount_usd: +(amountUsd * l1Percent / 100).toFixed(2),
  });

  const { data: l1 } = await app.db
    .from('partners').select('parent_id').eq('user_id', ref.partner_id).single();
  if (l1?.parent_id) {
    await app.db.from('accruals').insert({
      partner_id: l1.parent_id,
      payment_id: paymentId,
      level: 2,
      percent: PARTNER_L2_PERCENT,
      amount_usd: +(amountUsd * PARTNER_L2_PERCENT / 100).toFixed(2),
    });
  }
}
