/* ============================================================================
   ОПАСНЫЕ КНОПКИ: спрашивают ли они подтверждение

   Обход кликов (probe-clicks.mjs) намеренно пропускает всё, что стирает
   данные или уводит из приложения — иначе он сам себе снёс бы состояние.
   Но именно эти кнопки страшнее всего: «Выйти», «Удалить аккаунт»,
   «Очистить историю», «Сбросить», «Выйти со всех устройств».

   Здесь мы их находим и проверяем ровно одно свойство: НЕ делают ли они
   дело молча. Правильное поведение — переспросить (диалог приложения или
   window.confirm) и объяснить последствия. Само действие не выполняем:
   отвечаем «нет» на любой запрос подтверждения.
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const DANGER = /выйти|выход|удалить аккаунт|удалить канал|удалить клуб|очистить|сбросить|отписаться|заблокировать|снять с публикации|отменить подписку|logout/i;

const SCREENS = [
  ['профиль',    `showTab('profile')`],
  ['настройки',  `showTab('profile'); typeof st2Open==='function'&&st2Open()`],
  ['кошелёк',    `showTab('wallet')`],
  ['чаты',       `showTab('chats')`],
  ['диалог',     `showTab('chats'); (document.querySelector('#chatList .ci, #chatList > *')||{click(){}}).click()`],
  ['канал',      `window.okoSocial && okoSocial.open('x:oko-channel')`],
  ['биржа',      `showTab('mini'); openMa('market')`],
  ['академия',   `showTab('academy')`],
];

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}
  /* На подтверждение отвечаем «нет» и запоминаем, что нас спросили. */
  window.__okoAsked = 0;
  window.confirm = function(){ window.__okoAsked++; return false; };
  window.alert = function(){ window.__okoAsked++; };
`);
const p = await c.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 140)));

await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
await p.evaluate('okoSkipAuth()');

const report = { проверено: 0, безПодтверждения: [], сПодтверждением: [], ошибки: [] };

for (const [name, goto] of SCREENS) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(`(()=>{
    try{ if(window.okoSocial && okoSocial.isOpen()) okoSocial.close(); }catch(e){}
    try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
    try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
  })()`).catch(() => {});
  await p.waitForTimeout(150);
  try { await p.evaluate(goto); } catch (e) { continue; }
  await p.waitForTimeout(600);

  const targets = await p.evaluate(([src, flags]) => {
    const rx = new RegExp(src, flags);
    const out = [];
    document.querySelectorAll('button, [role="button"], .prow, .soc-mini, .pp2-row, .st2-row').forEach((el, i) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!rx.test(label)) return;
      el.setAttribute('data-oko-danger', String(i));
      out.push({ i, label: label.slice(0, 50) });
    });
    return out;
  }, [DANGER.source, DANGER.flags]);

  for (const t of targets) {
    const before = await p.evaluate(`(() => {
      window.__okoAsked = 0;
      return { auth: localStorage.getItem('oko-auth'), keys: Object.keys(localStorage).length };
    })()`);
    const clicked = await p.evaluate(`(() => {
      const el = document.querySelector('[data-oko-danger="${t.i}"]');
      if (!el) return false; el.click(); return true;
    })()`).catch(() => false);
    if (!clicked) continue;
    report.проверено++;
    await p.waitForTimeout(500);

    const after = await p.evaluate(`(() => {
      /* Диалог приложения: попап, шторка подтверждения, модалка */
      const dlg = document.querySelector('#okoPopup.on, .popup.on, .oko-popup.on, .sheet.open, [role="alertdialog"], .soc-confirm');
      return {
        спросили: window.__okoAsked > 0 || !!dlg,
        текстДиалога: dlg ? (dlg.innerText || '').replace(/\\s+/g,' ').trim().slice(0, 90) : '',
        auth: localStorage.getItem('oko-auth'),
        keys: Object.keys(localStorage).length
      };
    })()`);

    const данныеИзменились = after.auth !== before.auth || after.keys < before.keys;
    if (after.спросили) {
      report.сПодтверждением.push({ экран: name, кнопка: t.label, диалог: after.текстДиалога });
    } else if (данныеИзменились) {
      report.безПодтверждения.push({ экран: name, кнопка: t.label, что: 'сработала молча и изменила данные' });
    } else {
      report.сПодтверждением.push({ экран: name, кнопка: t.label, диалог: '(без диалога, но данные не тронуты)' });
    }

    /* закрываем всё, что открылось */
    await p.keyboard.press('Escape').catch(() => {});
    await p.evaluate(`(()=>{
      document.querySelectorAll('.sheet.open, .popup.on, #okoPopup.on').forEach(x=>x.classList.remove('open','on'));
      try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
    })()`).catch(() => {});
    await p.waitForTimeout(200);
    /* восстанавливаем вход, если кнопка всё же вышла */
    await p.evaluate(`try{ localStorage.setItem('oko-auth','tg'); }catch(e){}`).catch(() => {});
  }
}

report.ошибки = [...new Set(errs)];
await fs.mkdir('oko-app/tools/clicks-out', { recursive: true });
await fs.writeFile('oko-app/tools/clicks-out/danger.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  проверено: report.проверено,
  безПодтверждения: report.безПодтверждения,
  примерыСПодтверждением: report.сПодтверждением.slice(0, 8),
  ошибки: report.ошибки
}, null, 2));
await b.close();
