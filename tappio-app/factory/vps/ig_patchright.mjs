// Stealth IG login test via patchright (no proxy) — проверка гипотезы "дело не в прокси".
import { chromium } from 'patchright';
import fs from 'fs';

const LOGIN = process.env.TAPPIO_IG_LOGIN;
const PASS  = process.env.TAPPIO_IG_PASSWORD;
const DIR   = '/opt/oko-poster/cfg/ig_patchright_profile';
const CODEF = '/opt/oko-poster/cfg/ig_code.txt';
const SHOT  = '/opt/oko-poster/cfg/ig_patchright.png';
const log = (...a) => console.log('[igpw]', ...a);

const ctx = await chromium.launchPersistentContext(DIR, {
  headless: true,
  channel: 'chromium',
  viewport: { width: 412, height: 915 },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  locale: 'en-US',
  timezoneId: 'Europe/Rome',
});
const p = ctx.pages()[0] || await ctx.newPage();

try {
  await p.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(3500);

  // cookie banner
  for (const t of ['Allow all cookies', 'Only allow essential cookies', 'Accept']) {
    const b = p.getByRole('button', { name: t });
    if (await b.count() && await b.first().isVisible().catch(()=>false)) { await b.first().click().catch(()=>{}); break; }
  }
  await p.waitForTimeout(1500);

  const user = p.locator('input[name="username"]');
  const pass = p.locator('input[name="password"]');
  if (await user.count()===0) { log('NO LOGIN FORM — url=', p.url()); }
  await user.click(); await user.pressSequentially(LOGIN, { delay: 120 });
  await pass.click(); await pass.pressSequentially(PASS, { delay: 120 });
  await p.waitForTimeout(600);
  // watch the login xhr
  p.on('response', async r => {
    if (/\/accounts\/login\/ajax/.test(r.url())) {
      const t = await r.text().catch(()=> '');
      log('LOGIN_XHR', r.status(), t.slice(0, 300).replace(/\n+/g,' '));
    }
  });
  const btn = p.getByRole('button', { name: /^Log in$/ });
  if (await btn.count()) await btn.first().click();
  else await pass.press('Enter');
  log('submitted, waiting...');
  await p.waitForTimeout(9000);

  // wait for redirect to settle (codeentry / challenge / home)
  for (let i=0;i<20;i++){ const u=p.url(); if(!/\/accounts\/login\/?$/.test(u)) break; await p.waitForTimeout(1500); }
  let url = p.url();
  log('post-login url=', url);
  await p.waitForTimeout(4000); // let codeentry fully render
  await p.screenshot({ path: '/opt/oko-poster/cfg/ig_codeentry_live.png' }).catch(()=>{});
  const bodyTxt = (await p.locator('body').innerText().catch(()=>'')).slice(0, 400).replace(/\n+/g,' | ');
  log('body:', bodyTxt);

  // challenge / 2FA
  if (/challenge|two_factor|auth_platform|codeentry|checkpoint/i.test(url) || /confirm|code|verify|security/i.test(bodyTxt)) {
    log('CHALLENGE detected at codeentry');
    // dump clickable texts so we can find "resend"
    const clk = await p.evaluate(() => [...document.querySelectorAll('button,a,[role=button],div[role=button]')]
      .map(e=>e.innerText.trim()).filter(t=>t && t.length<40).slice(0,25));
    log('CLICKABLES', JSON.stringify(clk));

    // trigger a fresh code: wait for the countdown to unlock "Send a new code", then click it
    if (process.env.IG_RESEND === '1') {
      let resent = false;
      for (let i=0;i<20 && !resent;i++){ // up to ~100s
        // the resend control: a link/button reading "Send a new code" (only clickable after countdown)
        for (const loc of [p.getByRole('button',{name:/get a new code/i}).first(), p.getByText(/^\s*get a new code\s*$/i).first(), p.getByRole('button',{name:/send a new code/i}).first()]) {
          if (await loc.count()===0) continue;
          if (!await loc.isVisible().catch(()=>false)) continue;
          const dis = await loc.getAttribute('aria-disabled').catch(()=>null);
          if (dis==='true') continue;
          await loc.click().catch(()=>{});
          log('RESENT (clicked send a new code)');
          resent = true; break;
        }
        if(!resent) await p.waitForTimeout(5000);
      }
      if(!resent) log('resend link not found/clickable');
      await p.waitForTimeout(2500);
    }

    // explore alternative verification paths
    if (process.env.IG_TRYOTHER === '1') {
      const b = p.getByRole('button',{name:/try another way/i}).first();
      if (await b.count() && await b.isVisible().catch(()=>false)) {
        await b.click().catch(()=>{}); await p.waitForTimeout(3500);
        await p.screenshot({ path: '/opt/oko-poster/cfg/ig_tryother.png' }).catch(()=>{});
        const opts = await p.evaluate(()=>document.body.innerText.slice(0,600).replace(/\n+/g,' | '));
        log('TRYOTHER_OPTIONS', opts);
      } else log('no try-another-way button');
    }

    log('awaiting code file', CODEF);
    let code = null;
    for (let i=0;i<72;i++){ // up to 6 min
      if (fs.existsSync(CODEF)) { const c=fs.readFileSync(CODEF,'utf8').replace(/\D/g,''); if(c.length>=6){code=c;break;} }
      await p.waitForTimeout(5000);
    }
    if (code) {
      log('got code', code);
      let filled=false;
      for (const loc of [p.locator('input[name="verificationCode"]'),p.locator('input[autocomplete="one-time-code"]'),p.locator('input[type="tel"]').first(),p.locator('input[inputmode="numeric"]').first(),p.getByRole('textbox').first()]) {
        if (await loc.count()===0) continue;
        if (!await loc.isVisible({timeout:800}).catch(()=>false)) continue;
        await loc.click(); await loc.fill(''); await loc.pressSequentially(code,{delay:180});
        const v=(await loc.inputValue()).replace(/\D/g,''); log('filled len', v.length);
        if(v.length>=6){ filled=true; break; }
      }
      if (filled) {
        await p.waitForTimeout(700);
        // click a confirm/continue button if present, else Enter
        let clicked=false;
        for (const t of [/^continue$/i,/^confirm$/i,/^next$/i,/^submit$/i]) {
          const b=p.getByRole('button',{name:t}).first();
          if (await b.count() && await b.isVisible().catch(()=>false)) { await b.click().catch(()=>{}); clicked=true; log('clicked',t.source); break; }
        }
        if(!clicked) await p.keyboard.press('Enter');
        await p.waitForTimeout(9000);
        log('after code url=', p.url());
        // dismiss "Save your login info" / onetap
        for (const t of [/not now/i,/save info/i,/^dismiss$/i]) {
          const b=p.getByRole('button',{name:t}).first();
          if (await b.count() && await b.isVisible().catch(()=>false)) { await b.click().catch(()=>{}); await p.waitForTimeout(2500); break; }
        }
      }
    } else log('no code arrived');
  }

  await p.screenshot({ path: SHOT }).catch(()=>{});
  // save cookies for reuse
  await ctx.storageState({ path: '/opt/oko-poster/cfg/ig_state.json' }).catch(()=>{});
  const finalUrl = p.url();
  const loggedIn = /instagram\.com\/(\?|$|#|accounts\/onetap|direct|reels)/.test(finalUrl) && !/login|challenge|codeentry|auth_platform/.test(finalUrl);
  log('RESULT', loggedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN', finalUrl);
} catch(e) {
  log('ERR', String(e).slice(0,300));
  await p.screenshot({ path: SHOT }).catch(()=>{});
} finally {
  await ctx.close();
}
