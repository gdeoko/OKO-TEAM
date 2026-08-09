import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
await ctx.addInitScript(`try{localStorage.setItem('oko-auth','tg');localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1')}catch(e){}`);
const p = await ctx.newPage();
p.on('pageerror',e=>console.log('ERR', String(e).slice(0,200)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2200);
const names = ['toast','esc','fmtN','postById','renderFeed','openConv','showTab','renderChatList',
'okoIsVerified','okoVerifyBadge','okoIdentityBlock','okoCopy','okoEntityLink','okoEntityNick','okoHaptic',
'nvPush','nvPop','psSetFollow','psOpenProfile','openProfile','okoLinkedChat','POSTS','curFeedKind','PROFILE',
'OKO_FOUNDER_NICK','VERIFY_MIN_SUBS','CHATS','currentChat','nowT','showPopup','chSubscribe','chUnsub','chOpen','chGo','chDraft','chCreateChannel','okoReels'];
console.log(await p.evaluate(`JSON.stringify(${JSON.stringify(names)}.reduce((a,n)=>{ try{ a[n]=eval('typeof '+n); }catch(e){ a[n]='ERR'; } return a; },{}),null,1)`));
console.log('localStorage oko-channels:', await p.evaluate(`(localStorage.getItem('oko-channels')||'').slice(0,120)`));
await b.close();
