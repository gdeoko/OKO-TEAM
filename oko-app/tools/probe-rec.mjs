/* Проверка модальной записи: старт по тапу, панель поверх всего, фон закрыт,
   отмена и отправка работают, ничего не зависает. */
import { chromium } from 'playwright-core';

const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8199/index.html';
const browser = await chromium.launch({
  executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
         '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  deviceScaleFactor: 2, permissions: ['microphone', 'camera'],
});
await ctx.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{
    localStorage.setItem('oko-onboard-done','1');
    localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1');
    localStorage.setItem('oko-tour','1');
  }catch(e){}
`);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await page.evaluate(`okoSkipAuth(); showTab('chats');`);
await page.waitForTimeout(500);
await page.evaluate(`const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`);
await page.waitForTimeout(600);

const out = {};
out.micExists = await page.evaluate(`!!document.getElementById('micBtn')`);
out.micRewired = await page.evaluate(`document.getElementById('micBtn')?.dataset.okorec === '1'`);
out.legacyGone = await page.evaluate(`!document.getElementById('cpRec')`);

/* тап по микрофону — запись должна стартовать сразу */
await page.click('#micBtn');
await page.waitForTimeout(1200);

out.panelOpen = await page.evaluate(`document.getElementById('okoRec')?.classList.contains('on') === true`);
out.htmlFlag  = await page.evaluate(`document.documentElement.classList.contains('oko-recording')`);
out.timer     = await page.evaluate(`document.getElementById('okoRecTime')?.textContent`);
out.sendVisible = await page.evaluate(`(()=>{const b=document.getElementById('okoRecSend');if(!b)return false;const r=b.getBoundingClientRect();return r.width>60&&r.height>40&&r.bottom<=innerHeight+1&&r.top>=0;})()`);
out.cancelVisible = await page.evaluate(`(()=>{const b=document.getElementById('okoRecCancel');if(!b)return false;const r=b.getBoundingClientRect();return r.width>60&&r.height>40&&r.bottom<=innerHeight+1;})()`);
/* точка в центре кнопки «Отправить» должна принадлежать именно ей — над ней ничего не лежит */
out.sendOnTop = await page.evaluate(`(()=>{const b=document.getElementById('okoRecSend');const r=b.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!(el&&(el===b||b.contains(el)));})()`);
/* нижнее меню должно быть перекрыто скримом — тап туда не проходит */
out.navBlocked = await page.evaluate(`(()=>{const n=document.querySelector('.nav,#nav,nav');if(!n)return 'нет nav';const r=n.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!(el&&el.closest('.okorec'));})()`);
out.waveLive = await page.evaluate(`document.getElementById('okoRecWave')?.classList.contains('live')`);

await page.screenshot({ path: 'oko-app/tools/rec-voice.png' });

/* отмена */
await page.click('#okoRecCancel');
await page.waitForTimeout(600);
out.afterCancel_panelClosed = await page.evaluate(`!document.getElementById('okoRec')?.classList.contains('on')`);
out.afterCancel_recStopped  = await page.evaluate(`(()=>{try{return recStart===null&&recArmed===false&&recStream===null}catch(e){return 'нет доступа'}})()`);
out.afterCancel_msgs = await page.evaluate(`document.querySelectorAll('#msgs .msg').length`);

/* переключение в кружок + отправка */
await page.click('#micBtn');
await page.waitForTimeout(800);
await page.click('.okorec-mode[data-m="vnote"]');
await page.waitForTimeout(1500);
out.vnoteMode  = await page.evaluate(`document.getElementById('okoRec')?.classList.contains('is-vnote')`);
out.vnotePreview = await page.evaluate(`(()=>{const v=document.getElementById('okoRecVid');return !!(v&&v.srcObject&&v.videoWidth>0);})()`);
await page.screenshot({ path: 'oko-app/tools/rec-vnote.png' });

const before = await page.evaluate(`document.querySelectorAll('#msgs .msg').length`);
await page.click('#okoRecSend');
await page.waitForTimeout(1200);
out.afterSend_panelClosed = await page.evaluate(`!document.getElementById('okoRec')?.classList.contains('on')`);
out.afterSend_newMsg = (await page.evaluate(`document.querySelectorAll('#msgs .msg').length`)) > before;
out.afterSend_vnote  = await page.evaluate(`!!document.querySelector('#msgs .vnote')`);
out.afterSend_htmlFlag = await page.evaluate(`document.documentElement.classList.contains('oko-recording')`);

/* Escape закрывает */
await page.click('#micBtn');
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
out.escClosed = await page.evaluate(`!document.getElementById('okoRec')?.classList.contains('on')`);

/* после всего приложение живое: вкладки переключаются */
await page.evaluate(`showTab('feed')`);
await page.waitForTimeout(400);
out.tabsWork = await page.evaluate(`!!document.querySelector('#screen-feed.active, #screen-feed:not(.hidden)')`);

out.errors = errors.slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
