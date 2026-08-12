#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────
   OKO · Отдать собранную Систему Роста человеку в приложение.

   Собранная система - это ОДИН самодостаточный HTML (принцип «один файл»
   из ТЗ v3.0), сотни килобайт. В результат задачи такое не влезает, поэтому
   система кладётся в отдельное хранилище и получает постоянный адрес, а в
   результат задачи уходит ссылка.

   Один вызов делает всё: заливает систему, привязывает к задаче, переводит
   задачу в done, шлёт владельцу уведомление. Приложение дальше само покажет
   человеку уведомление и откроет систему.

   Использование:
     node oko-system.mjs put <task_uid> <файл.html> \
          [--title "Система Роста · Имя"] [--niche "ниша"] [--period "90 дней"] \
          [--user "<ник>"]
     node oko-system.mjs list <ник>            # что уже собрано человеку
     node oko-system.mjs get <system_uid>      # выгрузить обратно (для правок)
   ──────────────────────────────────────────────────────────────── */

import fs from 'node:fs';

const SITE = (process.env.OKO_SITE || 'https://okoteam.top').replace(/\/+$/, '');
const API = SITE + '/api.php';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (process.env.OKO_QUEUE_TOKEN) h['X-Queue-Token'] = process.env.OKO_QUEUE_TOKEN;
  if (process.env.OKO_AGENT_TOKEN) h['X-Agent-Token'] = process.env.OKO_AGENT_TOKEN;
  return h;
}
function adminQS() {
  return process.env.OKO_ADMIN_KEY ? '&key=' + encodeURIComponent(process.env.OKO_ADMIN_KEY) : '';
}
async function call(action, body, method = 'POST') {
  const r = await fetch(API + '?action=' + action + adminQS(), {
    method, headers: headers(), body: method === 'POST' ? JSON.stringify(body || {}) : undefined
  });
  const j = await r.json().catch(() => ({ ok: false, error: 'bad json ' + r.status }));
  if (!j.ok) throw new Error(action + ': ' + (j.error || r.status));
  return j;
}

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const [, , cmd, a1, a2] = process.argv;

(async () => {
  if (!process.env.OKO_QUEUE_TOKEN && !process.env.OKO_AGENT_TOKEN && !process.env.OKO_ADMIN_KEY) {
    console.error('Нет токена. Задай OKO_QUEUE_TOKEN.');
    process.exit(2);
  }

  if (cmd === 'put') {
    const taskUid = a1, file = a2;
    if (!taskUid || !file) throw new Error('нужно: put <task_uid> <файл.html>');
    if (!fs.existsSync(file)) throw new Error('нет файла: ' + file);
    const html = fs.readFileSync(file, 'utf8');
    if (html.length < 500) throw new Error('файл подозрительно мал: ' + html.length + ' символов');

    /* Узнать, кому собирали: берём из самой задачи, чтобы не промахнуться ником */
    let user = arg('user', '');
    let title = arg('title', 'Система Роста');
    if (!user) {
      try {
        const st = await fetch(API + '?action=oko_task_status&uid=' + encodeURIComponent(taskUid)).then(r => r.json());
        user = (st && st.user_ref) || '';
        if (st && st.title && !process.argv.includes('--title')) title = st.title;
      } catch (e) { /* не критично */ }
    }

    const put = await call('oko_system_put', {
      html, task_uid: taskUid, user,
      title, niche: arg('niche', ''), period: arg('period', ''),
      meta: { built_at: new Date().toISOString(), bytes: html.length }
    });

    const url = `${SITE}/api.php?action=oko_system_get&uid=${put.uid}&raw=1`;

    /* Задача закрывается ТОЛЬКО после того, как система реально сохранена. */
    await call('oko_task_result', {
      uid: taskUid, status: 'done',
      result: { kind: 'system', system_uid: put.uid, url, title, bytes: put.bytes }
    });

    console.log(`Система сохранена: ${put.uid} (версия ${put.version}, ${Math.round(put.bytes / 1024)} КБ)`);
    console.log(`Ссылка: ${url}`);
    console.log(`Задача ${taskUid} закрыта. Человек увидит систему в приложении.`);
    return;
  }

  if (cmd === 'list') {
    const r = await fetch(API + '?action=oko_system_mine&user=' + encodeURIComponent(a1 || '')).then(r => r.json());
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === 'get') {
    const r = await fetch(API + '?action=oko_system_get&uid=' + encodeURIComponent(a1 || '')).then(r => r.json());
    if (!r.ok) throw new Error(r.error || 'не найдено');
    const out = a2 || (a1 + '.html');
    fs.writeFileSync(out, r.html, 'utf8');
    console.log(`Выгружено в ${out} (${Math.round(r.html.length / 1024)} КБ, версия ${r.version})`);
    return;
  }

  console.error('Команды: put <task_uid> <файл.html> [--title --niche --period --user] | list <ник> | get <uid> [файл]');
  process.exit(2);
})().catch(e => { console.error('Ошибка: ' + e.message); process.exit(1); });
