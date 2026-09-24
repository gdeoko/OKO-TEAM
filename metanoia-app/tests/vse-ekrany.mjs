// Все 41 экран приложения: каждый открывается, показывает содержимое,
// не пустой и не валится. Проверка от «все разделы должны работать».
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_name','Мария');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,rank:'',streak:0,img:'assets/img/avatars/star.jpg'}]));
  for (let n=1;n<=40;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_exam_0', JSON.stringify({pct:95, ts: Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1200);

// Как попасть на каждый экран. Игры открываются общей дверью openGame.
const ИГРЫ = { memory:'memory', quiz:'quiz', who:'who', chrono:'chrono', match3:'match3',
  exodus:'exodus', david:'david', ark:'ark', detective:'detective', dilemma:'dilemma',
  interpret:'interpret', challenge:'challenge', family:'family' };
const ПУТИ = {
  home: ()=>document.querySelector('.nav__tab[data-tab="home"]').click(),
  lessons: ()=>document.querySelector('.nav__tab[data-tab="lessons"]').click(),
  games: ()=>document.querySelector('.nav__tab[data-tab="games"]').click(),
  chats: ()=>document.querySelector('.nav__tab[data-tab="chats"]').click(),
  profile: ()=>document.querySelector('.nav__tab[data-tab="profile"]').click(),
  lesson: ()=>openLesson(1),
  exam: ()=>openExam(0),
  reader: ()=>openReader(1),
  book: ()=>openBook(),
  pet: ()=>openPetScreen(),
  child: ()=>openChild(0),
  rating: ()=>openRatingScreen(),
  certificates: ()=>openCertificates(),
  album: ()=>openAlbumScreen(),
  journey: ()=>openJourneyScreen(),
  quest: ()=>openQuest(),
  shop: ()=>openShop(),
  ask: ()=>openAsk(),
  search: ()=>{ document.getElementById('searchBtn').click(); },
  settings: ()=>openSettingsScreen(),
  about: ()=>openAbout(),
  privacy: ()=>openDoc('privacy'),
  partner: ()=>openPartner(),
  donate: ()=>openDonate(),
  devotional: ()=>openDevotional(),
  verse: ()=>openVerse(),
  quest2: ()=>openQuest2(),
  chatview: ()=>{ document.querySelector('.nav__tab[data-tab="chats"]').click();
    setTimeout(()=>document.querySelectorAll('.chat-item')[1].click(), 250); },
};
for (const [экран, ключ] of Object.entries(ИГРЫ)) if (!ПУТИ[экран]) ПУТИ[экран] = new Function(`openGame('${ключ}')`);

const все = await p.evaluate(()=>[...new Set([...document.querySelectorAll('[data-screen]')].map(э=>э.dataset.screen))]);
let плохо = 0, нетДвери = [];
for (const экран of все) {
  const как = ПУТИ[экран];
  if (!как) { нетДвери.push(экран); continue; }
  const r = await p.evaluate(async ({ имя, кодСтроки })=>{
    try { (new Function(кодСтроки))(); } catch (e) { return { экран:имя, беда:'не открылся: '+e.message }; }
    await new Promise(r=>setTimeout(r, 900));
    const э = document.querySelector(`[data-screen="${имя}"]`);
    if (!э) return { экран:имя, беда:'экрана нет в разметке' };
    if (!э.classList.contains('screen--active')) return { экран:имя, беда:'не стал активным' };
    const текст = (э.innerText || '').trim();
    const картинок = э.querySelectorAll('img').length;
    const кнопок = э.querySelectorAll('button, .btn, [role=button]').length;
    return { экран:имя, знаков:текст.length, картинок, кнопок,
             беда: текст.length < 40 && картинок === 0 ? 'пусто' : null };
  }, { имя: экран, кодСтроки: `(${как.toString()})()` });
  if (r.беда) { плохо++; console.log(`✗ ${r.экран}: ${r.беда}`); }
  else console.log(`  ${r.экран}: ${r.знаков} знаков, ${r.картинок} картинок, ${r.кнопок} кнопок`);
}
if (нетДвери.length) console.log('без описанной двери: ' + нетДвери.join(', '));
console.log('ОШИБОК: ' + (плохо + errs.length + нетДвери.length));
errs.slice(0,4).forEach(e=>console.log('  ' + e));
await b.close();
