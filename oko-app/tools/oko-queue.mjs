#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────
   OKO · СЛИВЩИК ОЧЕРЕДИ МИНИ-АППОВ (мост в Claude Code)
   Забирает задачи, поставленные приложением (окно ОКО Ai «/картинка …»
   и любой мини-апп через window.okoBridge), и возвращает результат.

   Задачу ВЫПОЛНЯЕТ сессия Claude Code своими инструментами (Higgsfield
   для картинок/видео и т.п.) — этот скрипт только транспорт: pull → result.

   Токен: наименьшие права, ТОЛЬКО очередь. Порядок поиска:
     OKO_QUEUE_TOKEN → OKO_AGENT_TOKEN → OKO_ADMIN_KEY
   База: OKO_SITE (по умолчанию https://okoteam.top).

   Использование:
     node oko-queue.mjs pull [limit] [kind]
         → печатает JSON { claim, items:[{uid,kind,title,payload,...}] }
     node oko-queue.mjs result <uid> <done|failed> '<результат|JSON>' ['ошибка']
         → отмечает задачу выполненной; result — URL картинки/видео,
           текст, или JSON-строка (например {"url":"https://…"}).
   ──────────────────────────────────────────────────────────────── */

const SITE = (process.env.OKO_SITE || 'https://okoteam.top').replace(/\/+$/, '');
const API = SITE + '/api.php';
const TOKEN = process.env.OKO_QUEUE_TOKEN || process.env.OKO_AGENT_TOKEN || process.env.OKO_ADMIN_KEY || '';

function tokenHeaders() {
  // queue_token и agent_token — свои заголовки; admin — через ?key. Шлём всё,
  // сервер примет подходящий (drainer_ok = admin | agent | queue).
  const h = { 'Content-Type': 'application/json' };
  if (process.env.OKO_QUEUE_TOKEN) h['X-Queue-Token'] = process.env.OKO_QUEUE_TOKEN;
  if (process.env.OKO_AGENT_TOKEN) h['X-Agent-Token'] = process.env.OKO_AGENT_TOKEN;
  return h;
}
function adminQS() {
  return process.env.OKO_ADMIN_KEY ? '&key=' + encodeURIComponent(process.env.OKO_ADMIN_KEY) : '';
}

async function pull(limit, kind) {
  const qs = 'limit=' + (parseInt(limit, 10) || 5) + (kind ? '&kind=' + encodeURIComponent(kind) : '') + adminQS();
  const r = await fetch(API + '?action=oko_task_pull&' + qs, { method: 'POST', headers: tokenHeaders(), body: '{}' });
  const j = await r.json();
  if (!j.ok) throw new Error('pull: ' + (j.error || r.status));
  return j;
}

async function result(uid, status, res, error) {
  let payload = res;
  try { payload = JSON.parse(res); } catch (e) { /* оставить строкой */ }
  const r = await fetch(API + '?action=oko_task_result' + adminQS(), {
    method: 'POST', headers: tokenHeaders(),
    body: JSON.stringify({ uid, status: status || 'done', result: payload, error: error || '' })
  });
  const j = await r.json();
  if (!j.ok) throw new Error('result: ' + (j.error || r.status));
  return j;
}

const [, , cmd, ...rest] = process.argv;
(async () => {
  if (!TOKEN && !process.env.OKO_ADMIN_KEY) {
    console.error('Нет токена. Задай OKO_QUEUE_TOKEN (или OKO_AGENT_TOKEN / OKO_ADMIN_KEY).');
    process.exit(2);
  }
  try {
    if (cmd === 'pull') {
      console.log(JSON.stringify(await pull(rest[0], rest[1]), null, 2));
    } else if (cmd === 'result') {
      const [uid, status, res, err] = rest;
      if (!uid) throw new Error('нужен uid');
      console.log(JSON.stringify(await result(uid, status, res || '', err), null, 2));
    } else {
      console.error('Команды: pull [limit] [kind] | result <uid> <done|failed> <результат> [ошибка]');
      process.exit(2);
    }
  } catch (e) {
    console.error('Ошибка: ' + e.message);
    process.exit(1);
  }
})();
