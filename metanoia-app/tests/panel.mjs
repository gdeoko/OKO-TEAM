// Панель школы: вход только педагогу, живые числа, поиск, закрытие доступа.
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:8099';
const почта = process.argv[2];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:1200,height:900} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto(B + '/admin/_t.html', { waitUntil:'load' });

// 1. Настоящая семья с верным паролем — но панель не для неё.
const семья = 'semya' + Date.now() + '@test.ru';
await p.evaluate(async (m)=>{
  await fetch('http://127.0.0.1:8099/api/v1/auth/register', { method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email:m, password:'Parol12345', name:'Мария', role:'parent' }) });
}, семья);
await p.fill('#pochta', семья);
await p.fill('#parol', 'Parol12345');
await p.click('#formaVhoda button');
await p.waitForTimeout(2500);
const родителяНеПустили = await p.isVisible('#vhod');
console.log('родителя не пустили: ' + родителяНеПустили + ' | сказали: ' + (await p.textContent('#oshibkaVhoda')).slice(0, 40));

// 2. Педагог входит.
await p.fill('#pochta', почта);
await p.fill('#parol', 'Parol12345');
await p.click('#formaVhoda button');
await p.waitForTimeout(2500);
const вошли = await p.isVisible('#panel');
console.log('педагог вошёл: ' + вошли);

const плитки = await p.$$eval('.plitka', (э)=>э.map(e=>e.innerText.replace('\n',' ')));
console.log('сводка: ' + плитки.join(' | '));

// 3. Семьи, поиск, закрытие доступа.
await p.click('[data-razdel="semi"]'); await p.waitForTimeout(1500);
const строк = await p.$$eval('.karta tr', (т)=>т.length - 1);
console.log('семей в таблице: ' + строк);
p.on('dialog', d=>d.accept());
const первая = await p.$('[data-blok]');
await первая.click();
await p.waitForTimeout(2000);
const закрытых = await p.$$eval('.metka--zakryt', (м)=>м.length);
console.log('после нажатия помечено закрытых: ' + закрытых);
await p.click('[data-blok]'); await p.waitForTimeout(2000);
const вернули = await p.$$eval('.metka--zakryt', (м)=>м.length);
console.log('после возврата закрытых: ' + вернули);

// 4. Остальные разделы открываются и не падают.
for (const р of ['deti','uroki','moderaciya','svodka']) {
  await p.click(`[data-razdel="${р}"]`); await p.waitForTimeout(1200);
  const текст = (await p.textContent('#telo')).trim().slice(0, 30);
  console.log(р + ': ' + (текст ? 'есть содержимое' : 'ПУСТО'));
}
const плохо = (родителяНеПустили ? 0 : 1) + (вошли ? 0 : 1) + (строк > 0 ? 0 : 1) + (закрытых > 0 ? 0 : 1) + (вернули === 0 ? 0 : 1);
console.log('ОШИБОК: ' + (плохо + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
