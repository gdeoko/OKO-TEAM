import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import type { Tier } from '../tiers.js';

export interface AuthUser {
  id: string;
  tier: Tier;
  role: 'user' | 'partner' | 'staff' | 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    try {
      const payload = jwt.verify(header.slice(7), config.supabase.jwtSecret) as {
        sub: string;
      };
      // Тариф и роль подтягиваются одним запросом; активная подписка с макс. тарифом
      const { data } = await app.db
        .from('profiles')
        .select('role, subscriptions(tier, status, expires_at)')
        .eq('id', payload.sub)
        .single();
      const active = (data?.subscriptions as any[] | null)?.find(
        (s) => s.status === 'active' && new Date(s.expires_at) > new Date(),
      );
      req.user = {
        id: payload.sub,
        role: (data?.role as AuthUser['role']) ?? 'user',
        tier: (active?.tier as Tier) ?? 'free',
      };
    } catch {
      // невалидный токен = аноним; защищённые роуты отобьёт requireAuth
    }
  });

  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) await reply.code(401).send({ error: 'unauthorized' });
  });
});
