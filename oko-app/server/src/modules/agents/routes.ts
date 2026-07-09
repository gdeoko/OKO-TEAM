import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';

// ИИ-штат (§1.8 ТЗ):
//  • Агент «Поддержка» — RAG по базе знаний (тарифы/инструкции/FAQ/кейсы),
//    кнопка «позвать человека» -> эскалация в @okohelp.
//  • Агент «Ассистент» — командный чат Даниэля: утренний отчёт + команды на естественном языке.
// Правила: деньги/возвраты/обещания -> только эскалация; все диалоги логируются.
// Нейро-эндпоинты под строгим rate limit (защита от выжигания токенов).

const anthropic = new Anthropic({ apiKey: config.ai.anthropicKey });

const SUPPORT_SYSTEM = `Ты — ИИ-поддержка приложения OKO (мессенджер + лента + биржа + ИИ-инструменты роста).
Отвечай кратко, по-русски, дружелюбно и только на основе переданного КОНТЕКСТА из базы знаний.
Если ответа нет в контексте — честно скажи «уточню у команды и вернусь», НЕ ВЫДУМЫВАЙ факты, цены и сроки.
Любые вопросы про деньги, возвраты, споры, обещания сроков — не решай сам, ответь что зовёшь человека.
Никогда не придумывай тарифы, лимиты и функции, которых нет в контексте.`;

// Дешёвая модель для поддержки, качественная — для ассистента Даниэля.
const MODEL_SUPPORT = 'claude-haiku-4-5-20251001';
const MODEL_ASSISTANT = 'claude-sonnet-5';

/** Эскалация в командный чат через Telegram Bot API. */
async function escalateToTelegram(text: string): Promise<void> {
  if (!config.tg.botToken || !config.tg.teamChatId) return;
  await fetch(`https://api.telegram.org/bot${config.tg.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.tg.teamChatId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

/** Эмбеддинг запроса (OpenAI text-embedding-3-small). Возвращает null, если ключа нет. */
async function embed(text: string): Promise<number[] | null> {
  if (!config.ai.openaiKey) return null;
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.ai.openaiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  }).then((x) => x.json()).catch(() => null);
  return r?.data?.[0]?.embedding ?? null;
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAuth);

  // ── Агент «Поддержка»: RAG + Claude ──────────────────────────────────────
  app.post(
    '/support',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = z.object({ message: z.string().min(1).max(2000) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const question = body.data.message;

      // Явные денежные темы -> сразу эскалация, без модели.
      if (/возврат|верните деньги|спор|чарджбэк|обман|не спишите|списали/i.test(question)) {
        await escalateToTelegram(`🆘 Поддержка -> человек (деньги)\nОт: ${req.user!.id}\n${question}`);
        return { answer: 'Передал вопрос живому специалисту (@okohelp) — ответят по деньгам лично.', escalated: true };
      }

      // RAG: ищем релевантные документы базы знаний.
      const emb = await embed(question);
      let context = '';
      if (emb) {
        const { data } = await app.db.rpc('match_kb', { query_embedding: emb, match_count: 5 });
        context = (data ?? []).map((d: { title: string; body: string }) => `# ${d.title}\n${d.body}`).join('\n\n');
      } else {
        // Фолбэк без эмбеддингов — полнотекстовый поиск по базе знаний.
        const { data } = await app.db
          .from('kb_documents').select('title, body').textSearch('body', question, { type: 'websearch', config: 'russian' }).limit(5);
        context = (data ?? []).map((d) => `# ${d.title}\n${d.body}`).join('\n\n');
      }

      const resp = await anthropic.messages.create({
        model: MODEL_SUPPORT,
        max_tokens: 500,
        system: SUPPORT_SYSTEM,
        messages: [{ role: 'user', content: `КОНТЕКСТ базы знаний:\n${context || '(пусто)'}\n\nВОПРОС: ${question}` }],
      });
      const answer = resp.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('\n').trim();

      // «Позвать человека», если модель не нашла ответа.
      const needHuman = /уточню у команды|зову человека|не могу ответить/i.test(answer);
      if (needHuman) await escalateToTelegram(`❓ Поддержка -> человек\nОт: ${req.user!.id}\n${question}`);

      await app.db.from('agents_logs').insert({
        agent: 'support', user_id: req.user!.id,
        input: question, output: answer, escalated: needHuman,
      });
      return { answer, escalated: needHuman };
    },
  );

  // Кнопка «позвать человека» из интерфейса чата поддержки.
  app.post('/support/human', async (req) => {
    const body = z.object({ note: z.string().max(500).optional() }).safeParse(req.body);
    await escalateToTelegram(`🙋 Клиент просит человека\nОт: ${req.user!.id}\n${body.success ? body.data.note ?? '' : ''}`);
    await app.db.from('agents_logs').insert({ agent: 'support', user_id: req.user!.id, escalated: true, input: '[human requested]' });
    return { ok: true };
  });

  // ── Агент «Ассистент»: командный чат Даниэля ─────────────────────────────
  // Утренний отчёт по метрикам (вызывается по расписанию воркером/n8n).
  app.post('/assistant/daily-report', { preHandler: requireOwner }, async (_req) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [regs, pays, accr] = await Promise.all([
      app.db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
      app.db.from('payments').select('amount_usd').eq('status', 'paid').gte('paid_at', since),
      app.db.from('accruals').select('amount_usd').gte('created_at', since),
    ]);
    const revenue = (pays.data ?? []).reduce((s, p) => s + Number(p.amount_usd), 0);
    const commissions = (accr.data ?? []).reduce((s, a) => s + Number(a.amount_usd), 0);

    const summary =
      `📊 <b>OKO — отчёт за сутки</b>\n` +
      `Регистраций: ${regs.count ?? 0}\n` +
      `Оплат: ${(pays.data ?? []).length} на $${revenue.toFixed(2)}\n` +
      `Партнёрам начислено: $${commissions.toFixed(2)}\n` +
      `Чистыми (грубо): $${(revenue - commissions).toFixed(2)}`;

    await escalateToTelegram(summary);
    await app.db.from('daniel_ai_log').insert({ mode: 'autonomous', action_type: 'daily_report', summary });
    return { ok: true, summary };
  });

  // Команда Даниэля на естественном языке -> черновик действия (исполнение через n8n).
  app.post('/assistant/command', { preHandler: requireOwner, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ text: z.string().min(1).max(1000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });

    const resp = await anthropic.messages.create({
      model: MODEL_ASSISTANT,
      max_tokens: 400,
      system: 'Ты — операционный ассистент владельца OKO. Преврати команду на естественном языке в краткий план действия (что сделать, где, риски). Не выполняй необратимое сам — предлагай черновик для подтверждения.',
      messages: [{ role: 'user', content: body.data.text }],
    });
    const plan = resp.content.filter((c) => c.type === 'text').map((c) => (c as { text: string }).text).join('\n').trim();
    await app.db.from('daniel_ai_log').insert({ mode: 'draft_for_approval', action_type: 'command', summary: body.data.text, full_context: { plan } });
    return { plan };
  });
};

/** Доступ только владельцу (role=owner в profiles). */
async function requireOwner(req: any, reply: any): Promise<void> {
  const { data } = await req.server.db.from('profiles').select('role').eq('id', req.user.id).single();
  if (data?.role !== 'owner') { reply.code(403).send({ error: 'owner_only' }); }
}
