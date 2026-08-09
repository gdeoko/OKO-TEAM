/* ============================================================================
   OKO · ПРОБНИК СОЦИАЛЬНОГО СЛОЯ (oko-social.js)

   Проверяет живьём:
     • страница канала OKO открывается из списка чатов тапом по аватару;
     • вкладки «Посты» и «Ролики» пустые и честные (empty-state, не фейк);
     • пост публикуется и появляется во вкладке «Посты»;
     • ролик 9:16 публикуется, появляется во вкладке «Ролики», в ленте
       рекомендаций и в источнике плеера клипов;
     • создаются свой канал и клуб, у каждого — страница сущности;
     • копирование ссылки и ника реально кладёт текст в буфер обмена;
     • на каждом шаге: нет горизонтального переполнения, аватары круглые,
       нет обрезанного текста, есть кнопка «назад», ничего не заезжает
       под нижнее меню.

   Запуск: node oko-app/tools/probe-social.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';

const BASE = process.env.OKO_BASE || 'http://127.0.0.1:8199/index.html';
const ORIGIN = new URL(BASE).origin;

const browser = await chromium.launch({
  executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

/* 1x1 PNG — настоящий декодируемый файл для input[type=file] */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const OUT = {};
const errors = [];

/* ---- общий детектор вёрстки для текущего состояния экрана ---- */
const LAYOUT_PROBE = `(() => {
  const out = { overflowX: 0, offRight: [], clipped: [], squareAvatars: [], underNav: [], hasBack: false };
  const de = document.documentElement;
  const VW = window.innerWidth, VH = window.innerHeight;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const root = document.getElementById('okoSoc');
  out.hasBack = !!(root && root.classList.contains('open') && document.getElementById('okoSocBack'));

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };

  const scope = (root && root.classList.contains('open')) ? root : document.body;
  const all = Array.from(scope.querySelectorAll('*')).slice(0, 2500);
  for (const el of all) {
    if (el.ownerSVGElement) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    let inScroller = false;
    for (let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { inScroller = true; break; }
    }
    if (!inScroller && r.right > VW + 1 && r.width < VW * 1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    /* обрезанный текст: реальная ширина/высота больше видимой при hidden */
    if (el.children.length === 0 && (el.textContent || '').trim().length > 1) {
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') {
        if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' &&
            cs.webkitLineClamp === 'none')
          out.clipped.push({ el: label(el), scroll: el.scrollWidth, client: el.clientWidth });
      }
    }
  }

  /* аватары строго круглые */
  for (const a of scope.querySelectorAll('.soc-ava')) {
    const r = a.getBoundingClientRect();
    if (r.width < 4) continue;
    const br = getComputedStyle(a).borderRadius || '';
    const first = br.split(' ')[0] || '';
    let ok = false;
    if (first.endsWith('%')) ok = parseFloat(first) >= 50;
    else if (first.endsWith('px')) ok = parseFloat(first) >= r.width / 2 - 0.6;
    if (!ok) out.squareAvatars.push({ el: label(a), br, w: Math.round(r.width) });
  }

  /* ничего не заезжает под нижнее меню: пока вьюха открыта, она перекрывает
     нижний бар собственным фоном — проверяем, что низ прокручиваемой области
     не уходит за границу экрана и есть запас под safe-area */
  if (root && root.classList.contains('open')) {
    const body = document.getElementById('okoSocBody');
    if (body) {
      const rb = body.getBoundingClientRect();
      if (rb.bottom > VH + 1) out.underNav.push({ el: '#okoSocBody', bottom: Math.round(rb.bottom), vh: VH });
      const padB = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      out.bodyPadBottom = Math.round(padB);
      /* последний ребёнок не должен упираться в самый низ вплотную */
      const last = body.lastElementChild;
      if (last) {
        const rl = last.getBoundingClientRect();
        out.lastChildBottom = Math.round(rl.bottom);
      }
    }
    const nav = document.querySelector('#tabs, nav#tabs, .nav');
    if (nav) {
      const rn = nav.getBoundingClientRect();
      const el = document.elementFromPoint(Math.max(1, rn.left + rn.width / 2), Math.min(VH - 2, rn.top + rn.height / 2));
      out.navCovered = !!(el && (el === root || root.contains(el)));
    }
  }
  return out;
})()`;

const steps = [];
async function layout(page, name) {
  const r = await page.evaluate(LAYOUT_PROBE);
  const problems = [];
  if (r.overflowX > 1) problems.push('overflowX=' + r.overflowX);
  if (r.offRight.length) problems.push('offRight=' + JSON.stringify(r.offRight.slice(0, 3)));
  if (r.clipped.length) problems.push('clipped=' + JSON.stringify(r.clipped.slice(0, 3)));
  if (r.squareAvatars.length) problems.push('squareAvatars=' + JSON.stringify(r.squareAvatars.slice(0, 3)));
  if (r.underNav.length) problems.push('underNav=' + JSON.stringify(r.underNav));
  if (!r.hasBack) problems.push('нет кнопки «назад»');
  steps.push({ step: name, ok: problems.length === 0, problems, bodyPadBottom: r.bodyPadBottom, navCovered: r.navCovered });
  return r;
}

async function makeCtx(width, height, isMobile) {
  const ctx = await browser.newContext({
    viewport: { width, height }, isMobile, hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
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
  return ctx;
}

/* ==========================================================================
   ОСНОВНОЙ СЦЕНАРИЙ — мобильный 390x844
   ========================================================================== */
const ctx = await makeCtx(390, 844, true);
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1700);
await page.evaluate(`okoSkipAuth(); showTab('chats');`);
await page.waitForTimeout(600);

OUT.moduleLoaded = await page.evaluate(`!!window.okoSocial`);

/* ---- 1. страница канала OKO из списка чатов (тап по аватару) ---- */
await page.click('#chatList .chat-item .ci-ava');
await page.waitForTimeout(600);
OUT.entityPageOpened = await page.evaluate(`document.getElementById('okoSoc')?.classList.contains('open') === true`);
OUT.entityTitle = await page.evaluate(`document.getElementById('okoSocTitle')?.textContent || ''`);
OUT.entityKey = await page.evaluate(`(()=>{try{return window.okoSocial && document.querySelector('#okoSoc .soc-nick')?.textContent}catch(e){return null}})()`);
OUT.verifiedBadge = await page.evaluate(`!!document.querySelector('#okoSoc .soc-name svg')`);
OUT.statsLabels = await page.evaluate(`Array.from(document.querySelectorAll('#okoSoc .soc-stat small')).map(e=>e.textContent)`);
OUT.statsValues = await page.evaluate(`Array.from(document.querySelectorAll('#okoSoc .soc-stat b')).map(e=>e.textContent)`);
OUT.ownerCanPublish = await page.evaluate(`!!document.getElementById('socActPublish')`);
OUT.ownerCanEdit = await page.evaluate(`!!document.getElementById('socActEdit')`);
OUT.emptyPostsHonest = await page.evaluate(`(document.querySelector('#okoSocList .soc-empty p')?.textContent||'').trim()`);
await page.screenshot({ path: 'oko-app/tools/social-01-entity.png' });
OUT.layout_entity = await layout(page, '01 страница канала OKO');

/* вкладка «Ролики» пустая и честная */
await page.click('#okoSocTabs button[data-v="reels"]');
await page.waitForTimeout(350);
OUT.emptyReelsHonest = await page.evaluate(`(document.querySelector('#okoSocList .soc-empty p')?.textContent||'').trim()`);
OUT.noFakeNumbers = await page.evaluate(`
  Array.from(document.querySelectorAll('#okoSoc .soc-stat b')).every(e=>e.textContent.trim()==='0')`);
await page.screenshot({ path: 'oko-app/tools/social-02-reels-empty.png' });
OUT.layout_reelsEmpty = await layout(page, '02 вкладка «Ролики» пустая');

/* ---- 2. публикация поста ---- */
await page.click('#socActPublish');
await page.waitForTimeout(400);
await page.click('#socPubFmt button[data-v="post"]');
await page.waitForTimeout(250);
await page.fill('#socPubText', 'Проверка публикации поста социального слоя OKO');
await page.waitForTimeout(200);
OUT.pubBtnEnabledForPost = await page.evaluate(`document.getElementById('socPubGo')?.disabled === false`);
await page.screenshot({ path: 'oko-app/tools/social-03-compose-post.png' });
OUT.layout_composePost = await layout(page, '03 форма публикации · пост');

await page.click('#socPubGo');
await page.waitForTimeout(700);
OUT.afterPost_tab = await page.evaluate(`document.querySelector('#okoSocTabs .soc-tab.on')?.textContent.trim()`);
OUT.afterPost_countPosts = await page.evaluate(`document.querySelectorAll('#okoSocList .soc-post').length`);
OUT.afterPost_text = await page.evaluate(`document.querySelector('#okoSocList .soc-post .soc-post-t')?.textContent.trim()`);
OUT.afterPost_stats = await page.evaluate(`Array.from(document.querySelectorAll('#okoSoc .soc-stat b')).map(e=>e.textContent)`);
await page.screenshot({ path: 'oko-app/tools/social-04-post-published.png' });
OUT.layout_postPublished = await layout(page, '04 пост опубликован');

/* ---- 3. публикация ролика 9:16 ---- */
await page.click('#socActPublish');
await page.waitForTimeout(400);
await page.click('#socPubFmt button[data-v="9:16"]');
await page.waitForTimeout(300);
OUT.reelBlockedWithoutMedia = await page.evaluate(`document.getElementById('socPubGo')?.disabled === true`);
await page.fill('#socPubText', 'Вертикальный ролик 9:16 из социального слоя');
await page.setInputFiles('#socPubCover', { name: 'cover.png', mimeType: 'image/png', buffer: PNG_1x1 });
await page.waitForTimeout(900);
OUT.reelCoverAccepted = await page.evaluate(`document.getElementById('socPubGo')?.disabled === false`);
await page.screenshot({ path: 'oko-app/tools/social-05-compose-reel.png' });
OUT.layout_composeReel = await layout(page, '05 форма публикации · ролик 9:16');

await page.click('#socPubGo');
await page.waitForTimeout(800);
OUT.afterReel_tab = await page.evaluate(`document.querySelector('#okoSocTabs .soc-tab.on')?.textContent.trim()`);
OUT.afterReel_gridCount = await page.evaluate(`document.querySelectorAll('#okoSocList .soc-reels .soc-reel').length`);
OUT.afterReel_ratioBadge = await page.evaluate(`document.querySelector('#okoSocList .soc-reel-r')?.textContent`);
OUT.afterReel_gridColumns = await page.evaluate(`
  (()=>{const g=document.querySelector('#okoSocList .soc-reels');
   return g?getComputedStyle(g).gridTemplateColumns.split(' ').length:0})()`);
OUT.afterReel_stats = await page.evaluate(`Array.from(document.querySelectorAll('#okoSoc .soc-stat b')).map(e=>e.textContent)`);
await page.screenshot({ path: 'oko-app/tools/social-06-reel-published.png' });
OUT.layout_reelPublished = await layout(page, '06 ролик 9:16 опубликован');

/* ---- 3b. ролик 16:9 ---- */
await page.click('#socActPublish');
await page.waitForTimeout(400);
await page.click('#socPubFmt button[data-v="16:9"]');
await page.waitForTimeout(250);
await page.fill('#socPubText', 'Горизонтальный ролик 16:9 из социального слоя');
await page.setInputFiles('#socPubCover', { name: 'cover2.png', mimeType: 'image/png', buffer: PNG_1x1 });
await page.waitForTimeout(900);
await page.click('#socPubGo');
await page.waitForTimeout(800);
OUT.bothRatiosInGrid = await page.evaluate(`
  Array.from(document.querySelectorAll('#okoSocList .soc-reel-r')).map(e=>e.textContent).sort()`);
OUT.layout_bothReels = await layout(page, '07 два ролика в сетке');

/* ---- 4. попали ли ролики в ленту рекомендаций и в плеер клипов ---- */
OUT.feedRecHasReels = await page.evaluate(`
  (()=>{try{ return (POSTS.rec||[]).filter(p=>p.socRatio).map(p=>p.socRatio).sort(); }catch(e){ return 'нет POSTS' }})()`);
OUT.reelsPlayerSource = await page.evaluate(`
  (()=>{try{
    const list = window.okoReels.source();
    const ids = (POSTS.rec||[]).filter(p=>p.socRatio).map(p=>String(p.id));
    return { total:list.length, mine: list.filter(c=>ids.includes(String(c.id))).length };
  }catch(e){ return String(e) }})()`);

await page.evaluate(`okoSocial.close(); showTab('feed');`);
await page.waitForTimeout(700);
OUT.feedDomHasReelCards = await page.evaluate(`
  (()=>{const arts=document.querySelectorAll('#feedList article.post');
   let n=0; arts.forEach(a=>{ if(a.querySelector('.media')) n++; }); return {cards:arts.length, withMedia:n};})()`);
OUT.feedDomHasSocialText = await page.evaluate(`
  /Вертикальный ролик 9:16/.test(document.getElementById('feedList')?.textContent||'')`);
await page.screenshot({ path: 'oko-app/tools/social-08-feed.png' });
OUT.feedOverflowX = await page.evaluate(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`);

/* ---- 5. копирование ссылки и ника ---- */
await page.evaluate(`showTab('chats');`);
await page.waitForTimeout(400);
await page.click('#chatList .chat-item .ci-ava');
await page.waitForTimeout(500);
await page.click('#socCopyLink');
await page.waitForTimeout(500);
OUT.clipboardLink = await page.evaluate(`navigator.clipboard.readText().catch(e=>'ошибка: '+e)`);
await page.click('#socCopyNick');
await page.waitForTimeout(500);
OUT.clipboardNick = await page.evaluate(`navigator.clipboard.readText().catch(e=>'ошибка: '+e)`);

/* ---- 6. создание своего канала ---- */
await page.evaluate(`okoSocial.close(); okoSocial.create('channel');`);
await page.waitForTimeout(500);
await page.fill('#socCrName', 'Мой тестовый канал');
await page.fill('#socCrDesc', 'Канал, созданный пробником социального слоя');
await page.waitForTimeout(250);
await page.screenshot({ path: 'oko-app/tools/social-09-create.png' });
OUT.layout_create = await layout(page, '09 форма создания');
await page.click('#socCrGo');
await page.waitForTimeout(800);
OUT.createdChannel_title = await page.evaluate(`document.getElementById('okoSocTitle')?.textContent`);
OUT.createdChannel_owner = await page.evaluate(`!!document.getElementById('socActPublish')`);
OUT.createdChannel_manage = await page.evaluate(`!!document.getElementById('socManage')`);
OUT.createdChannel_stats = await page.evaluate(`Array.from(document.querySelectorAll('#okoSoc .soc-stat b')).map(e=>e.textContent)`);
await page.screenshot({ path: 'oko-app/tools/social-10-my-channel.png' });
OUT.layout_myChannel = await layout(page, '10 свой канал');

/* ---- 7. создание клуба (супергруппа) ---- */
await page.evaluate(`okoSocial.close(); okoSocial.create('club');`);
await page.waitForTimeout(500);
await page.fill('#socCrName', 'Клуб роста OKO');
await page.fill('#socCrDesc', 'Клуб-супергруппа: роли, права, темы, закреп, приглашения');
await page.waitForTimeout(250);
await page.click('#socCrGo');
await page.waitForTimeout(800);
OUT.createdClub_title = await page.evaluate(`document.getElementById('okoSocTitle')?.textContent`);
OUT.createdClub_kindChip = await page.evaluate(`
  Array.from(document.querySelectorAll('#okoSoc .soc-chip')).map(e=>e.textContent.trim())`);
await page.screenshot({ path: 'oko-app/tools/social-11-club.png' });
OUT.layout_club = await layout(page, '11 страница клуба');

/* управление клубом: права, темы, закреп, приглашения */
await page.click('#socManage');
await page.waitForTimeout(600);
OUT.clubManage_sections = await page.evaluate(`
  Array.from(document.querySelectorAll('#okoSoc .soc-sec')).map(e=>e.textContent.trim())`);
await page.click('#okoSoc [data-a="permwrite"][data-v="admins"]');
await page.waitForTimeout(350);
OUT.clubPermWrite = await page.evaluate(`
  (()=>{try{return okoSocial.entity(okoSocial.state && null)}catch(e){}
   const b=document.querySelector('#okoSoc [data-a="permwrite"].on'); return b?b.getAttribute('data-v'):null})()`);
await page.fill('#socTopicName', 'Общая тема');
await page.click('#okoSoc [data-a="topicadd"]');
await page.waitForTimeout(450);
OUT.clubTopicAdded = await page.evaluate(`/Общая тема/.test(document.getElementById('okoSocBody')?.textContent||'')`);
await page.click('#okoSoc [data-a="inviteadd"]');
await page.waitForTimeout(450);
OUT.clubInviteCreated = await page.evaluate(`/okoteam\\.top\\/join\\//.test(document.getElementById('okoSocBody')?.textContent||'')`);
await page.click('#okoSoc [data-a="invitecopy"]');
await page.waitForTimeout(500);
OUT.clipboardInvite = await page.evaluate(`navigator.clipboard.readText().catch(e=>'ошибка: '+e)`);
await page.screenshot({ path: 'oko-app/tools/social-12-club-manage.png' });
OUT.layout_clubManage = await layout(page, '12 управление клубом');

/* участники и роли */
await page.click('#okoSocBack');
await page.waitForTimeout(400);
await page.click('#socMembers');
await page.waitForTimeout(500);
OUT.clubMembers = await page.evaluate(`document.querySelectorAll('#okoSoc .soc-row .soc-role').length`);
OUT.clubOwnerRole = await page.evaluate(`document.querySelector('#okoSoc .soc-role')?.textContent.trim()`);
OUT.layout_clubMembers = await layout(page, '13 участники и роли');

/* ---- 8. выходы: назад / Escape ---- */
await page.click('#okoSocBack');
await page.waitForTimeout(400);
OUT.backReturnsToEntity = await page.evaluate(`!!document.getElementById('okoSocTabs')`);
await page.keyboard.press('Escape');
await page.waitForTimeout(450);
OUT.escapeClosesView = await page.evaluate(`document.getElementById('okoSoc')?.classList.contains('open') === false`);
OUT.appAliveAfterClose = await page.evaluate(`(()=>{ try{ showTab('feed'); return !!document.querySelector('#screen-feed.active'); }catch(e){ return String(e); } })()`);

/* ---- 9. курс: единая страница сущности ---- */
await page.evaluate(`okoSocial.create('course');`);
await page.waitForTimeout(500);
await page.fill('#socCrName', 'Курс по рилсам');
await page.click('#socCrGo');
await page.waitForTimeout(700);
OUT.createdCourse_title = await page.evaluate(`document.getElementById('okoSocTitle')?.textContent`);
OUT.createdCourse_tabs = await page.evaluate(`
  Array.from(document.querySelectorAll('#okoSocTabs .soc-tab')).map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
OUT.layout_course = await layout(page, '14 страница курса');

/* ---- 10. личный профиль собеседника (ЛС) ---- */
await page.evaluate(`okoSocial.close(); showTab('chats');`);
await page.waitForTimeout(500);
OUT.dmEntityOpened = await page.evaluate(`
  (()=>{ const c=(CHATS||[]).find(x=>x.kind==='direct'&&x.nick==='ktodaniel')||(CHATS||[]).find(x=>x.kind==='direct');
   if(!c) return 'нет ЛС'; const k=okoSocial.keyOfChat(c); return okoSocial.open(k) ? k : 'не открылось'; })()`);
await page.waitForTimeout(600);
OUT.dmTitle = await page.evaluate(`document.getElementById('okoSocTitle')?.textContent`);
OUT.dmHasFollow = await page.evaluate(`!!document.getElementById('socActFollow')`);
OUT.dmHasMsg = await page.evaluate(`!!document.getElementById('socActMsg')`);
await page.screenshot({ path: 'oko-app/tools/social-13-dm-profile.png' });
OUT.layout_dm = await layout(page, '15 страница ЛС-собеседника');

/* подписка реально считается */
const beforeSub = await page.evaluate(`document.querySelector('#okoSoc .soc-stat b')?.textContent`);
await page.click('#socActFollow');
await page.waitForTimeout(500);
const afterSub = await page.evaluate(`document.querySelector('#okoSoc .soc-stat b')?.textContent`);
OUT.followCounts = { before: beforeSub, after: afterSub, changed: beforeSub !== afterSub };

await page.close();
await ctx.close();

/* ==========================================================================
   ПК 1440x900 — та же страница, другой вьюпорт
   ========================================================================== */
const ctxD = await makeCtx(1440, 900, false);
const pageD = await ctxD.newPage();
pageD.on('pageerror', e => errors.push('desktop pageerror: ' + String(e).slice(0, 200)));
await pageD.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageD.waitForTimeout(1700);
await pageD.evaluate(`okoSkipAuth(); showTab('chats');`);
await pageD.waitForTimeout(600);
await pageD.evaluate(`okoSocial.open(okoSocial.keyOfChat(CHATS[0]))`);
await pageD.waitForTimeout(600);
OUT.desktop_opened = await pageD.evaluate(`document.getElementById('okoSoc')?.classList.contains('open') === true`);
await pageD.screenshot({ path: 'oko-app/tools/social-14-desktop.png' });
const rd = await pageD.evaluate(LAYOUT_PROBE);
OUT.layout_desktop = {
  step: 'ПК 1440x900',
  ok: rd.overflowX <= 1 && !rd.offRight.length && !rd.clipped.length && !rd.squareAvatars.length && rd.hasBack,
  problems: [
    rd.overflowX > 1 ? 'overflowX=' + rd.overflowX : null,
    rd.offRight.length ? 'offRight=' + JSON.stringify(rd.offRight.slice(0, 3)) : null,
    rd.clipped.length ? 'clipped=' + JSON.stringify(rd.clipped.slice(0, 3)) : null,
    rd.squareAvatars.length ? 'squareAvatars=' + JSON.stringify(rd.squareAvatars.slice(0, 3)) : null,
    rd.hasBack ? null : 'нет кнопки «назад»',
  ].filter(Boolean),
};
await pageD.close();
await ctxD.close();

OUT.layoutSteps = steps;
OUT.layoutAllOk = steps.every(s => s.ok) && OUT.layout_desktop.ok;
OUT.errors = errors.slice(0, 10);

console.log(JSON.stringify(OUT, null, 2));
await browser.close();
