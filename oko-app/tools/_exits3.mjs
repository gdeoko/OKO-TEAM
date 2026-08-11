/* Панели, до которых карта маршрутов не доходит: открываются только с аргументами
   или из состояния (сторис, звонок, урок). Проверяем тем же строгим детектором
   и ДОПОЛНИТЕЛЬНО жмём найденный выход — кнопка обязана реально закрыть. */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import { CLEAN_START, RESET_ALL } from './clean-start.mjs';

const BASE = 'http://127.0.0.1:8231/index.html';

const FP = `(() => {
  const vis = el => { const cs = getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    const r = el.getBoundingClientRect(); return r.width>2 && r.height>2; };
  const parts = [];
  const scr = document.querySelector('main > .screen.active'); if(scr) parts.push('scr:'+scr.id);
  document.querySelectorAll('.open, .on, .show, .go, .tr-on').forEach(el => {
    if(!vis(el)) return;
    const r = el.getBoundingClientRect();
    if(r.width * r.height < innerWidth*innerHeight*0.12) return;
    parts.push((el.id||el.className.toString().split(/\\s+/)[0])+':'+Math.round(r.width)+'x'+Math.round(r.height));
  });
  parts.push('nv:'+(typeof nvStackLabels==='function' ? nvStackLabels().join('>') : '?'));
  return parts.sort().join('|');
})()`;

const EXITINFO = `(() => {
  const vis = el => { if(!el) return false; const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
    let p = el; while(p){ const c = getComputedStyle(p); if(+c.opacity===0||c.visibility==='hidden'||c.display==='none') return false; p = p.parentElement; }
    const r = el.getBoundingClientRect();
    return r.width>=16 && r.height>=16 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth; };
  const opaque = el => {
    const cs = getComputedStyle(el);
    if(cs.pointerEvents === 'none') return false;
    const bg = cs.backgroundColor || '';
    const hasBg = bg && bg !== 'transparent' && !/rgba\\(\\s*\\d+,\\s*\\d+,\\s*\\d+,\\s*0\\s*\\)/.test(bg);
    return hasBg || cs.backdropFilter !== 'none' || el.children.length > 0;
  };
  let top = null, topz = -1;
  for(const el of document.querySelectorAll('body *')){
    const cs = getComputedStyle(el);
    if(cs.position !== 'fixed' && cs.position !== 'absolute') continue;
    if(!vis(el) || !opaque(el)) continue;
    if(el.querySelector('#tabs')) continue;
    const r = el.getBoundingClientRect();
    if((r.width*r.height)/(innerWidth*innerHeight) < 0.30) continue;
    const z = parseInt(cs.zIndex,10) || 0;
    if(z >= topz){ topz = z; top = el; }
  }
  const scope = top || document.body;
  const looksExit = el => {
    const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className||''));
    if(/\\boko-back\\b|\\bep-cancel\\b|-close\\b|\\bclose\\b|\\b\\w+-x\\b|\\bcls\\b|\\bback\\b/.test(cls)) return true;
    const lab = ((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')).slice(0,60);
    if(/наза[дт]|закры|отмен|выйти|понятн|готов|к спис|позже|скрыть|свернуть|покинуть|отличн|забрать/i.test(lab)) return true;
    const u = el.querySelector && el.querySelector('use');
    if(u && /#i-back|#i-plus|#cl-i-min/.test(String(u.getAttribute('href')||''))) return true;
    return false;
  };
  const list = [...scope.querySelectorAll('button,a,[role="button"]')].filter(e => vis(e) && looksExit(e));
  list.forEach((e,i) => e.setAttribute('data-exitprobe', String(i)));
  const tabs = document.querySelector('#tabs');
  const tabsVis = !!(tabs && vis(tabs) && (!top || topz < (parseInt(getComputedStyle(tabs).zIndex,10)||0)));
  return { top: top ? (top.id || String(top.className).slice(0,50)) : '', topz, tabsVis,
           exits: list.map(e => String(e.className||'').slice(0,34)+'|'+(e.getAttribute('aria-label')||(e.textContent||'').trim().slice(0,22))) };
})()`;

const CASES = [
  ['сертификат Академии',     [`showTab('academy')`, `acCertShow(0)`]],
  ['просмотр медиа биржи',    [`showTab('mini')`, `openMa('market')`, `mpMvOpen([{u:'#'},{u:'#'}],0,'фото')`]],
  ['экран эскроу биржи',      [`showTab('mini')`, `openMa('market')`, `mpEscInfo && mpEscInfo()`]],
  ['чужой профиль',           [`showTab('feed')`, `psOpenProfile('okoteam')`]],
  ['мои соцсети',             [`showTab('profile')`, `psSocOpen()`]],
  ['соцслой: сущность',       [`showTab('feed')`, `okoSocial && okoSocial.open('u:okoteam')`]],
  ['канал',                   [`chOpen('channel','oko')`]],
  ['редактор сторис',         [`showTab('feed')`, `spOpenEditor()`]],
  ['выписка кошелька',        [`showTab('wallet')`, `walOpenStatement()`]],
  ['подстраница истории',     [`showTab('wallet')`, `w2Open('history')`]],
  ['замок кошелька',          [`showTab('wallet')`, `okoW2 && okoW2.lockShow && okoW2.lockShow()`]],
  ['пейволл PRO',             [`showTab('feed')`, `okoRequireSub('PRO','нужен PRO')`]],
  ['штаб: карточка агента',   [`showTab('profile')`, `openAdmin()`, `okoHq2 && okoHq2.openView && okoHq2.openView('agent','ceo')`]],
  ['звонок: участники',       [`showTab('chats')`, `okcStart && okcStart('conf')`, `okcSideOpen && okcSideOpen()`]],
  ['полный слой Академии-2',  [`showTab('academy')`, `ac2OpenLibrary && ac2OpenLibrary()`]],
  ['ОКО Ai',                  [`showTab('mini')`, `openMa('helper')`]],
  ['клипы',                   [`showTab('feed')`, `faReelsOpenFirst()`]],
  ['тур',                     [`showTab('feed')`, `trStart(true)`]],
  ['сторис основателя',       [`showTab('feed')`, `trStoriesStart && trStoriesStart(true)`]],
  ['документы OKO',           [`openLegalHub && openLegalHub()`]],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(CLEAN_START);
const page = await ctx.newPage();
page.on('pageerror', () => {});

const out = [];
for (const [name, steps] of CASES) {
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.evaluate(RESET_ALL);
    for (const s of steps) { await page.evaluate(`try{ ${s} }catch(e){}`); await page.waitForTimeout(360); }
    await page.waitForTimeout(450);
    await page.evaluate(`(() => { var p=document.getElementById('okoPopup'); if(p && getComputedStyle(p).display!=='none'){ try{ closePopup(); }catch(e){} } })()`);
    await page.waitForTimeout(300);
    const fp0 = await page.evaluate(FP);
    const info = await page.evaluate(EXITINFO);

    let verdict = '', detail = '';
    if (info.exits.length) {
      /* кнопка есть — проверяем, что она РАБОТАЕТ */
      const el = page.locator('[data-exitprobe="0"]');
      await el.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(520);
      const fp1 = await page.evaluate(FP);
      verdict = fp1 !== fp0 ? 'ok:кнопка' : 'ПЛОХО:кнопка не закрывает';
      detail = info.exits[0];
    } else if (info.tabsVis) {
      verdict = 'ok:нижнее меню';
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(480);
      if (await page.evaluate(FP) !== fp0) verdict = 'ok:Escape';
      else {
        let ch = false;
        for (const pt of [[6, 6], [195, 838], [384, 6]]) {
          await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(380);
          if (await page.evaluate(FP) !== fp0) { ch = true; break; }
        }
        verdict = ch ? 'ok:тап по подложке' : 'НЕТ ВЫХОДА';
      }
    }
    out.push({ name, verdict, detail, fp: fp0, top: info.top });
    console.log(verdict.padEnd(28), name, '|', info.top, '|', detail);
  } catch (e) { console.log('skip', name, e.message.slice(0, 70)); }
}
await fs.writeFile('./oko-app/tools/_exits3.json', JSON.stringify(out, null, 1));
await browser.close();
