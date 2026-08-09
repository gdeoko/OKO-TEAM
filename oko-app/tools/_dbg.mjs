import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');
  localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}
`);
const p = await ctx.newPage();
p.on('console', m=>console.log('PAGE:', m.text().slice(0,200)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1700);
await p.evaluate(`okoSkipAuth(); showTab('chats');`);
await p.waitForTimeout(600);
await p.click('#chatList .chat-item .ci-ava');
await p.waitForTimeout(600);
await p.evaluate(`
  window.__log=[];
  var mo=new MutationObserver(function(){ window.__log.push([Date.now()%100000, document.getElementById('okoSoc').className, nvStackLabels().join('|')]); });
  mo.observe(document.getElementById('okoSoc'),{attributes:true,attributeFilter:['class']});
  window.addEventListener('popstate',function(){ window.__log.push(['popstate', nvSwallow, nvStackLabels().join('|')]); });
`);
await p.evaluate(`okoSocial.close(); okoSocial.create('channel');`);
await p.waitForTimeout(1200);
console.log(JSON.stringify(await p.evaluate(`window.__log`),null,1));
console.log('open now:', await p.evaluate(`document.getElementById('okoSoc').classList.contains('open')`));
await b.close();
