import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { authPlugin } from './plugins/auth.js';
import { supabasePlugin } from './plugins/supabase.js';
import { authRoutes } from './modules/auth/routes.js';
import { chatRoutes } from './modules/chats/routes.js';
import { feedRoutes } from './modules/feed/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { billingRoutes } from './modules/billing/routes.js';
import { partnerRoutes } from './modules/partners/routes.js';
import { miniappRoutes } from './modules/miniapps/routes.js';
import { agentRoutes } from './modules/agents/routes.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
// Глобальный rate limit; нейро-эндпоинты дополнительно ограничены в своих модулях
// (защита от выжигания токенов).
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

await app.register(supabasePlugin);
await app.register(authPlugin);

app.get('/health', async () => ({ ok: true }));

await app.register(authRoutes, { prefix: '/auth' });
await app.register(chatRoutes, { prefix: '/chats' });
await app.register(feedRoutes, { prefix: '/feed' });
await app.register(mediaRoutes, { prefix: '/media' });
await app.register(billingRoutes, { prefix: '/billing' });
await app.register(partnerRoutes, { prefix: '/partners' });
await app.register(miniappRoutes, { prefix: '/miniapps' });
await app.register(agentRoutes, { prefix: '/ai' });

app.listen({ port: config.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
