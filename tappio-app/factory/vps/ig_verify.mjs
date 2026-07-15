// Verify IG logged-in identity using the saved persistent profile.
import { chromium } from 'patchright';
const DIR = '/opt/oko-poster/cfg/ig_patchright_profile';
const log = (...a)=>console.log('[igverify]', ...a);
const ctx = await chromium.launchPersistentContext(DIR, {
  headless: true, channel: 'chromium',
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  locale: 'en-US', timezoneId: 'Europe/Rome',
});
const p = ctx.pages()[0] || await ctx.newPage();
try {
  await p.goto('https://www.instagram.com/accounts/edit/', { waitUntil:'domcontentloaded', timeout:45000 });
  await p.waitForTimeout(5000);
  log('url', p.url());
  // username often prefilled in an input, or shown in nav
  const uname = await p.evaluate(()=>{
    const inp = document.querySelector('input[name="username"]');
    if (inp && inp.value) return 'input:'+inp.value;
    const m = document.body.innerText.match(/tappio[\w.\-]*/i);
    return m ? 'text:'+m[0] : 'body:'+document.body.innerText.slice(0,160).replace(/\n+/g,' ');
  });
  log('IDENTITY', uname);
  await p.screenshot({ path:'/opt/oko-poster/cfg/ig_verify.png' }).catch(()=>{});
} catch(e){ log('ERR', String(e).slice(0,200)); }
finally { await ctx.close(); }
