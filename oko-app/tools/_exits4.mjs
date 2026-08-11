/* Добор: случаи, где в _exits3 были неверные имена функций — панель не открывалась. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, RESET_ALL } from './clean-start.mjs';

const BASE = 'http://127.0.0.1:8231/index.html';
const src = await fs.readFile('./oko-app/tools/_exits3.mjs', 'utf8');
const FP = src.match(/const FP = `([\s\S]*?)`;/)[1];
const EXITINFO = src.match(/const EXITINFO = `([\s\S]*?)`;\n/)[1];

const CASES = [
  ['эскроу биржи',          [`showTab('mini')`, `openMa('market')`, `mpEscInfoOpen()`], 'mpEscModal'],
  ['звонок: конференция',   [`showTab('chats')`, `okcStartConf('c1',{chatName:'Тест'})`], 'okc-screen'],
  ['звонок: участники',     [`showTab('chats')`, `okcStartConf('c1',{chatName:'Тест'})`, `okcSideOpen()`], 'okc-side'],
  ['штаб: карточка агента', [`showTab('profile')`, `openAdmin()`, `okoHq2.openAgent('ceo')`], 'h2View'],
  ['штаб: комната',         [`showTab('profile')`, `openAdmin()`, `okoHq2.openRoom('ops')`], 'h2View'],
  ['библиотека Академии-2', [`showTab('academy')`, `ac2OpenLibrary('all')`], 'ac2Full'],
  ['пейволл PRO',           [`showTab('feed')`, `okoRequireSub('PRO','нужен PRO')`], 'pwPop'],
  ['просмотр медиа биржи',  [`showTab('mini')`, `openMa('market')`, `mpMvOpen([{u:'x'},{u:'y'}],0,'фото')`], 'mpMediaViewer'],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(CLEAN_START);
const page = await ctx.newPage();
page.on('pageerror', () => {});

for (const [name, steps, expect] of CASES) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.evaluate(RESET_ALL);
    const errs = [];
    for (const s of steps) {
      const e = await page.evaluate(`(() => { try{ ${s}; return ''; }catch(e){ return String(e.message||e); } })()`);
      if (e) errs.push(s + ' -> ' + e);
      await page.waitForTimeout(380);
    }
    await page.waitForTimeout(500);
    await page.evaluate(`(() => { var p=document.getElementById('okoPopup'); if(p && getComputedStyle(p).display!=='none'){ try{ closePopup(); }catch(e){} } })()`);
    await page.waitForTimeout(250);
    const opened = await page.evaluate(`(() => { var e = document.getElementById('${expect}') || document.querySelector('.${expect}');
      if(!e) return 'нет в DOM';
      var cs = getComputedStyle(e); var r = e.getBoundingClientRect();
      return (cs.display!=='none' && cs.visibility!=='hidden' && +cs.opacity>0 && r.width>2 && r.height>2) ? 'открыт' : 'закрыт'; })()`);
    const fp0 = await page.evaluate(FP);
    const info = await page.evaluate(EXITINFO);
    let verdict;
    if (info.exits.length) {
      await page.locator('[data-exitprobe="0"]').click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(520);
      verdict = (await page.evaluate(FP)) !== fp0 ? 'ok:кнопка работает' : 'ПЛОХО:кнопка не закрывает';
    } else if (info.tabsVis) verdict = 'ok:нижнее меню';
    else {
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      if (await page.evaluate(FP) !== fp0) verdict = 'ok:Escape';
      else {
        let ch = false;
        for (const pt of [[6, 6], [195, 838], [384, 6]]) { await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(380); if (await page.evaluate(FP) !== fp0) { ch = true; break; } }
        verdict = ch ? 'ok:тап по подложке' : 'НЕТ ВЫХОДА';
      }
    }
    console.log(verdict.padEnd(26), name, '| панель:', opened, '| top:', info.top, '|', (info.exits[0] || '—'), errs.length ? '| ОШИБКИ: ' + errs.join('; ') : '');
  } catch (e) { console.log('skip', name, e.message.slice(0, 80)); }
}
await browser.close();
