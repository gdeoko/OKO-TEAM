// Озвучка урока: настоящий mp3 запрашивается и играет, а не молчит.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const запросы=[]; p.on('request', r=>{ if(/\.mp3/.test(r.url())) запросы.push(r.url().split('/').slice(-2).join('/')); });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2800);
await p.click('.nav__tab[data-tab="lessons"]'); await p.waitForTimeout(400);
await p.click('.lesson-item'); await p.waitForTimeout(700);
await p.click('#lessonVoice'); await p.waitForTimeout(2500);
const играет = await p.$eval('#lessonVoice', e=>e.classList.contains('lesson-voice--playing')).catch(()=>false);
console.log('КНОПКА ОЗВУЧКИ: играет=' + играет);
console.log('ЗАПРОШЕНО АУДИО: ' + [...new Set(запросы)].join(', '));
console.log('ОШИБКИ: ' + errs.length);
await b.close();
