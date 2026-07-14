import { chromium } from "playwright";
const b=await chromium.launch({headless:true,args:["--no-sandbox"]});
const ctx=await b.newContext({storageState:"/opt/oko-poster/cfg/hooppy_session.json",locale:"ru-RU"});
const p=await ctx.newPage();
await p.goto("https://hooppy.ru/accounts",{waitUntil:"networkidle",timeout:40000});
await p.waitForTimeout(2500);
console.log("URL:",p.url());
console.log("LOGGED_IN:", !p.url().includes("/auth/login"));
console.log("TITLE:", await p.title());
// count account cards / any user marker
const txt=(await p.textContent("body").catch(()=>""))||"";
console.log("has_accounts_word:", /аккаунт|account|проект|подключ/i.test(txt));
await b.close();
