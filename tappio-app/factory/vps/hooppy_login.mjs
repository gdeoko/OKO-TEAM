import { chromium } from "playwright";
const L=process.env.HOOPPY_LOGIN, P=process.env.HOOPPY_PASSWORD;
const b=await chromium.launch({headless:true,args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:1366,height:900},locale:"ru-RU"});
const p=await ctx.newPage();
await p.goto("https://hooppy.ru/auth/login",{waitUntil:"networkidle",timeout:45000});
await p.waitForTimeout(1500);
// fill email + password by common selectors
async function fill(sels,val){for(const s of sels){const el=await p.$(s);if(el){await el.fill(val);return s;}}return null;}
const eSel=await fill(['input[type="email"]','input[name="email"]','input[name="login"]','input[autocomplete="username"]','input[type="text"]'],L);
const pSel=await fill(['input[type="password"]','input[name="password"]','input[autocomplete="current-password"]'],P);
console.log("filled email via",eSel,"| pass via",pSel);
// submit
const btn=await p.$('button[type="submit"]') || await p.$('button:has-text("Войти")') || await p.$('button:has-text("Вход")') || await p.$('form button');
if(btn){await btn.click();} else {await p.keyboard.press("Enter");}
await p.waitForTimeout(6000);
await p.waitForLoadState("networkidle",{timeout:20000}).catch(()=>{});
const url=p.url();
const loggedIn = !url.includes("/auth/login");
console.log("AFTER_LOGIN_URL:",url);
console.log("LOGGED_IN:",loggedIn);
// grab any visible error text
const bodyText=(await p.textContent("body").catch(()=>""))||"";
const err=bodyText.match(/(неверн|ошибк|неправильн|invalid|error|подтверд|код|2fa|captcha)/i);
console.log("HINT:", err?err[0]:"none");
if(loggedIn){await ctx.storageState({path:"/opt/oko-poster/cfg/hooppy_session.json"});console.log("SESSION_SAVED");}
await b.close();
