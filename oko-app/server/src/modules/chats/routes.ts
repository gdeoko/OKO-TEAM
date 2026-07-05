import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Ядро мессенджера (§1.2 ТЗ). Доставка realtime — Supabase Realtime на клиенте
// (подписка на insert в messages по chat_id); API отвечает за запись и права.

const sendSchema = z.object({
  kind: z.enum(['text', 'photo', 'video', 'voice', 'video_note', 'file']).default('text'),
  body: z.string().max(8192).optional(),
  replyTo: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).default([]),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAuth);

  app.get('/', async (req) => {
    const { data } = await app.db
      .from('chat_members')
      .select('chat_id, last_read_at, chats(id, kind, title, avatar_url)')
      .eq('user_id', req.user!.id);
    return { chats: data ?? [] };
  });

  app.post('/', async (req, reply) => {
    const schema = z.object({
      kind: z.enum(['direct', 'group', 'channel']),
      title: z.string().max(128).optional(),
      memberIds: z.array(z.string().uuid()).max(200).default([]),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const { data: chat, error } = await app.db
      .from('chats')
      .insert({ kind: body.data.kind, title: body.data.title, owner_id: req.user!.id })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: 'create_failed' });

    const members = [
      { chat_id: chat.id, user_id: req.user!.id, role: 'owner' },
      ...body.data.memberIds.map((id) => ({ chat_id: chat.id, user_id: id, role: 'member' })),
    ];
    await app.db.from('chat_members').insert(members);
    return { chat };
  });

  app.get('/:chatId/messages', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const { before, limit = 50 } = req.query as { before?: string; limit?: number };

    const { data: member } = await app.db
      .from('chat_members').select('user_id')
      .eq('chat_id', chatId).eq('user_id', req.user!.id).maybeSingle();
    if (!member) return reply.code(403).send({ error: 'not_a_member' });

    let q = app.db
      .from('messages')
      .select('*, attachments(*)')
      .eq('chat_id', chatId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit), 100));
    if (before) q = q.lt('created_at', before);
    const { data } = await q;
    return { messages: data ?? [] };
  });

  app.post('/:chatId/messages', async (req, reply) => {
    const { chatId } = req.params as { chatId: string };
    const body = sendSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const { data: member } = await app.db
      .from('chat_members').select('user_id, muted_until')
      .eq('chat_id', chatId).eq('user_id', req.user!.id).maybeSingle();
    if (!member) return reply.code(403).send({ error: 'not_a_member' });
    if (member.muted_until && new Date(member.muted_until) > new Date()) {
      return reply.code(403).send({ error: 'muted' });
    }

    const { data: msg, error } = await app.db
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: req.user!.id,
        kind: body.data.kind,
        body: body.data.body,
        reply_to: body.data.replyTo,
      })
      .select()
      .single();
    if (error) return reply.code(500).send({ error: 'send_failed' });

    if (body.data.attachmentIds.length) {
      await app.db
        .from('attachments')
        .update({ message_id: msg.id })
        .in('id', body.data.attachmentIds);
    }
    return { message: msg };
  });

  app.post('/:chatId/read', async (req) => {
    const { chatId } = req.params as { chatId: string };
    await app.db
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', req.user!.id);
    return { ok: true };
  });
};
