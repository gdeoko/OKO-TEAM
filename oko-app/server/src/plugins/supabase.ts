import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: SupabaseClient; // service-role клиент: RLS обходится, проверки прав — в коде API
  }
}

export const supabasePlugin = fp(async (app) => {
  const db = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
  app.decorate('db', db);
});
