// Подтверждение почты: письмо уходит при регистрации, строка в профиле
// про неподтверждённую почту видна, по ссылке из письма она пропадает.
import { chromium } from 'playwright';
import fs from 'fs';
const B = 'http://127.0.0.1:8099';
const ЖУРНАЛ = '/home/user/OKO-TEAM/metanoia-app/config/письма.log';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());

const было = fs.existsSync(ЖУРНАЛ) ? fs.readFileSync(ЖУРНАЛ,'utf8').length : 0;
const почта = 'verify' + Date.now() + '@test.ru';

await p.goto(B + '/_t.html', { waitUntil:'load' });
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); });
await p.reload({ waitUntil:'load' }); await p.waitForTimeout(1200);
await p.click('[data-authtab="register"]');
await p.fill('#registerForm [name="name"]', 'Мария');
await p.fill('#registerForm [name="email"]', почта);
await p.fill('#registerForm [name="password"]', 'Parol12345');
await p.fill('#registerForm [name="child_name"]', 'Соня');
await p.fill('#registerForm [name="child_age"]', '8');
for (const c of await p.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p.click('#registerForm [type="submit"]');
await p.waitForTimeout(5000);

const письмо = fs.readFileSync(ЖУРНАЛ,'utf8').slice(было);
const ссылка = (письмо.match(/\?verify=([a-f0-9]{64})/) || [])[1] || '';
console.log('письмо при регистрации: ' + (ссылка ? 'есть, ключ ' + ссылка.slice(0,8) + '…' : 'НЕТ'));

await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(600);
const виднаДо = await p.isVisible('#mailNote');
console.log('строка про почту до подтверждения: ' + виднаДо);

// Кнопка «прислать ещё раз»: письмо должно уйти новое, с другим ключом.
const доКнопки = fs.readFileSync(ЖУРНАЛ,'utf8').length;
await p.click('#mailResend');
await p.waitForTimeout(2500);
const второе = fs.readFileSync(ЖУРНАЛ,'utf8').slice(доКнопки);
const ссылка2 = (второе.match(/\?verify=([a-f0-9]{64})/) || [])[1] || '';
console.log('письмо по кнопке: ' + (ссылка2 ? (ссылка2 === ссылка ? 'тот же ключ' : 'новый ключ') : 'НЕ УШЛО'));

await p.goto(B + '/_t.html?verify=' + (ссылка2 || ссылка), { waitUntil:'load' });
await p.waitForTimeout(3000);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(600);
const виднаПосле = await p.isVisible('#mailNote');
const отметка = await p.evaluate(()=>localStorage.getItem('mt_email_ok'));
console.log('строка после подтверждения: ' + виднаПосле + ' | отметка: ' + отметка);

const плохо = (ссылка ? 0 : 1) + (виднаДо ? 0 : 1) + (виднаПосле ? 1 : 0) + (отметка ? 0 : 1)
  + (ссылка2 && ссылка2 !== ссылка ? 0 : 1);
console.log('ОШИБОК: ' + (плохо + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
