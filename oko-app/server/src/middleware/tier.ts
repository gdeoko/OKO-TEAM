// Тарифный middleware — единая проверка доступов и лимитов во всех модулях (§1.7 ТЗ).
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TIER_LIMITS, tierAtLeast, type Tier, type TierLimits } from '../tiers.js';

export const requireTier =
  (min: Tier) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    if (!tierAtLeast(req.user.tier, min)) {
      return reply.code(402).send({ error: 'tier_required', min });
    }
  };

export const limitsFor = (tier: Tier): TierLimits => TIER_LIMITS[tier];

const currentPeriod = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

/**
 * Проверяет месячный счётчик (например 'video_checks') против лимита тарифа
 * и инкрементит его. -1 = без лимита. Возвращает false, если лимит исчерпан.
 */
export async function consumeCounter(
  app: FastifyInstance,
  userId: string,
  tier: Tier,
  counter: keyof Pick<TierLimits, 'videoChecksPerMonth' | 'contentVideosPerMonth'>,
  dbCounterName: string,
): Promise<boolean> {
  const limit = TIER_LIMITS[tier][counter];
  if (limit === 0) return false;
  const period = currentPeriod();

  const { data } = await app.db
    .from('usage_counters')
    .select('used')
    .eq('user_id', userId)
    .eq('counter', dbCounterName)
    .eq('period', period)
    .maybeSingle();

  const used = data?.used ?? 0;
  if (limit !== -1 && used >= limit) return false;

  await app.db.from('usage_counters').upsert({
    user_id: userId,
    counter: dbCounterName,
    period,
    used: used + 1,
  });
  return true;
}
