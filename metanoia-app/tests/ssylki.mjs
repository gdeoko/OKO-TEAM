// Ссылки наружу в школьных чатах не уходят: это самый короткий путь увести
// ребёнка туда, где за разговором никто не смотрит.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);

const проба = async (текст) => p.evaluate((т)=>проверитьСообщение(т).ок, текст);
const пробаВзрослая = async (текст) => p.evaluate((т)=>проверитьСообщение(т, true).ок, текст);
const случаи = [
  ['https://vk.com/id123', false],
  ['напиши мне в t.me/kto_to', false],
  ['посмотри тут www.example.com/chat', false],
  ['мой канал youtube.com/@kanal', false],
  ['зайди на сайт школы metanoia-180.ru', true],
  ['сегодня прошли урок про Рождество', true],
  ['мне 8 лет и я люблю читать', true],
];
let плохо = 0;
for (const [текст, ждём] of случаи) {
  const был = await проба(текст);
  const ок = был === ждём;
  if (!ок) плохо++;
  console.log((ок ? '  ' : '✗ ') + JSON.stringify(текст) + ' → ' + (был ? 'уйдёт' : 'не уйдёт') + (ок ? '' : ' (ждали другого)'));
}

// В чате родителей взрослые ссылками делиться могут.
const уВзрослых = await пробаВзрослая('вот хорошая статья https://example.com/text');
console.log('ссылка в чате родителей: ' + (уВзрослых ? 'уйдёт' : 'НЕ УЙДЁТ'));
плохо += уВзрослых ? 0 : 1;

// Живая проверка: пишем ссылку в чат и смотрим, что сообщения там не появилось.
const вЧате = await p.evaluate(async ()=>{
  document.querySelector('.nav__tab[data-tab="chats"]').click();
  await new Promise(r=>setTimeout(r,400));
  document.querySelectorAll('.chat-item')[1].click();
  await new Promise(r=>setTimeout(r,600));
  const было = document.querySelectorAll('#cvMsgs .msg').length;
  const поле = document.getElementById('cvField');
  поле.value = 'заходи ко мне в vk.com/id777';
  cvSendText();
  await new Promise(r=>setTimeout(r,600));
  return { было, стало: document.querySelectorAll('#cvMsgs .msg').length };
}).catch(()=>null);
if (вЧате) console.log('сообщений было ' + вЧате.было + ', стало ' + вЧате.стало);
console.log('ОШИБОК: ' + (плохо + errs.length + (вЧате && вЧате.стало > вЧате.было ? 1 : 0)));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
