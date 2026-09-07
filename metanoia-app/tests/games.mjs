// Каждая игра должна открываться, что-то показывать и отпускать обратно в хаб.
// Возврат делаем той же кнопкой, что и ребёнок: у каждой игры она своя.
import { chromium } from 'playwright';
// Стих дня открывается не экраном, а окном поверх, и закрывается своим крестиком.
const ОКНОМ = ['dailyverse'];
const НАЗАД = ['#verseBack','#memBack','#quizBack','#whoBack','#chronoBack','#m3Back','#exodusBack',
  '#davidBack','#arkBack','#quest2Back','#questBack','#detectiveBack','#dilemmaBack','#familyBack',
  '#journeyBack','#challengeBack','#interpretBack','#gamesBack','#petBack','#dverseClose'].map(с=>с+':visible').join(', ');

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);

const ключи = await p.evaluate(()=>GAMES.map(g=>g.key));
console.log('ИГР В СПИСКЕ: ' + ключи.length);
let плохих = 0;
for (const k of ключи) {
  const было = errs.length;
  await p.evaluate((k)=>{ document.getElementById('gameEnd')?.setAttribute('hidden',''); openGame(k); }, k);
  await p.waitForTimeout(900);
  const внутри = await p.evaluate(()=>{
    let открыт = '';
    document.querySelectorAll('.screen').forEach(e=>{ if (e.classList.contains('screen--active')) открыт = e.dataset.screen; });
    const живые = document.querySelectorAll('.screen--active button, .screen--active [data-put], .screen--active .mcard, .screen--active .qopt, .screen--active .ark-card, .screen--active .m3 div');
    return { экран: открыт, живых: живые.length, текста: document.querySelector('.screen--active')?.innerText.length || 0 };
  });
  // Возврат кнопкой самой игры. Сначала убираем всплывшее сверху:
  // окно конца игры или награду, иначе клик уходит в них.
  await p.evaluate(()=>{
    document.getElementById('gameEnd')?.setAttribute('hidden','');
    document.querySelectorAll('.reward, .modal, .sheet, .dverse').forEach(э=>{ э.hidden = true; });
  });
  await p.waitForTimeout(200);
  const кнопка = await p.$(НАЗАД);
  let вернулись = 'кнопки назад нет';
  if (кнопка) {
    await кнопка.click({timeout:3000}).catch(()=>{});
    await p.waitForTimeout(600);
    вернулись = await p.evaluate(()=>{
      let о=''; document.querySelectorAll('.screen').forEach(e=>{ if(e.classList.contains('screen--active')) о=e.dataset.screen; });
      return о;
    });
  }
  const сбой = внутри.живых === 0 && внутри.текста < 60;
  if (сбой || errs.length>было || вернулись === 'кнопки назад нет') плохих++;
  process.stdout.write(`${k}: экран ${внутри.экран}, живых ${внутри.живых}, текста ${внутри.текста}, назад → ${вернулись}`
    + (errs.length>было ? ' ОШИБКА: '+errs[было].slice(0,70) : '') + '\n');
  await p.evaluate(()=>{ document.getElementById('gameEnd')?.setAttribute('hidden','');
    document.querySelectorAll('.reward, .modal, .sheet, .dverse').forEach(э=>{ э.hidden = true; });
    openGamesHub(); });
  await p.waitForTimeout(300);
}
console.log('ПОДОЗРИТЕЛЬНЫХ ИГР: ' + плохих);
console.log('ВСЕГО ОШИБОК: ' + errs.length); errs.slice(0,5).forEach(e=>console.log(e));
await b.close();
