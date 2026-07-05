import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Лента (§1.4 ТЗ): хронология подписок + «Рекомендации»
// (простой скоринг: свежесть + вовлечённость; ML — после запуска по данным).

export const feedRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAuth);

  app.get('/following', async (req) => {
    const { data: memberships } = await app.db
      .from('chat_members').select('chat_id').eq('user_id', req.user!.id);
    const chatIds = (memberships ?? []).map((m) => m.chat_id);
    if (!chatIds.length) return { posts: [] };

    const { data: channels } = await app.db
      .from('channels').select('id').in('chat_id', chatIds);
    const channelIds = (channels ?? []).map((c) => c.id);
    if (!channelIds.length) return { posts: [] };

    const { data } = await app.db
      .from('posts')
      .select('*, attachments(*), channels(id, slug)')
      .in('channel_id', channelIds)
      .order('published_at', { ascending: false })
      .limit(50);
    return { posts: data ?? [] };
  });

  app.get('/recommended', async () => {
    // Скоринг на стороне БД: свежесть (экспоненциальное затухание) + вовлечённость
    const { data } = await app.db.rpc('recommended_posts', { p_limit: 50 });
    return { posts: data ?? [] };
  });

  app.post('/posts', async (req, reply) => {
    const schema = z.object({
      channelId: z.string().uuid(),
      body: z.string().max(16384).optional(),
      attachmentIds: z.array(z.string().uuid()).max(10).default([]),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const { data: channel } = await app.db
      .from('channels').select('chat_id').eq('id', body.data.channelId).single();
    const { data: member } = await app.db
      .from('chat_members').select('role')
      .eq('chat_id', channel?.chat_id).eq('user_id', req.user!.id).maybeSingle();
    if (!member || member.role === 'member') {
      return reply.code(403).send({ error: 'not_allowed' });
    }

    const { data: post, error } = await app.db
      .from('posts')
      .insert({ channel_id: body.data.channelId, author_id: req.user!.id, body: body.data.body })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: 'create_failed' });

    if (body.data.attachmentIds.length) {
      await app.db
        .from('attachments')
        .update({ post_id: post.id })
        .in('id', body.data.attachmentIds);
    }
    return { post };
  });
};
