#!/usr/bin/env node
// Portable build: inline CSS+JS+images+audio into ONE self-contained HTML.
// Usage: node tools/build-standalone.cjs [outFile]
// Default out: <repo>/metanoia-app/dist/progress-page.html
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', 'public_html');
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'dist', 'progress-page.html');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const MIME = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2' };
// Картинки в витрине лежат в base64 прямо в HTML, и каждый килобайт исходника
// становится в файле полутора. Поэтому для витрины картинки ужимаются: на
// боевом сервере лежат полные файлы, а в один файл идут лёгкие копии.
// Ужимает отдельный скрипт на Pillow; нет Pillow — собираем как есть.
const { execFileSync } = require('child_process');
const УЖИМАТЬ = process.env.SHOWCASE_SHRINK !== '0';
const КЭШ = path.join(require('os').tmpdir(), 'mt-vitrina-img');
const ужатые = new Map();
let жмём = false;
if (УЖИМАТЬ) {
  try {
    execFileSync('python3', ['-c', 'import PIL'], { stdio: 'ignore' });
    жмём = true;
  } catch (e) {
    console.log('Pillow не найден, картинки идут в витрину как есть');
  }
}

function подготовитьУжатие(пути) {
  if (!жмём || !пути.length) return;
  const вход = пути.map((rel) => path.join(APP, rel)).filter((p) => fs.existsSync(p)).join('\n');
  if (!вход) return;
  let вывод = '';
  try {
    вывод = execFileSync('python3', [path.join(__dirname, 'ujat-dlya-vitriny.py'), КЭШ],
      { input: вход, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.log('ужать картинки не вышло, идут как есть');
    return;
  }
  for (const строка of вывод.split('\n')) {
    const [исх, копия] = строка.split('\t');
    if (исх && копия) ужатые.set(исх, копия);
  }
}

/* Озвучка урока читается тринадцать минут и весит мегабайты. На боевом
   сервере это обычный файл и качается по ходу, а в витрине он лежит целиком
   в тексте страницы. Для витрины пережимаем в моно 32 кбит: голос Екатерины
   слышно так же, а вес втрое меньше. */
let жмёмЗвук = false;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); жмёмЗвук = УЖИМАТЬ; }
catch (e) { console.log('ffmpeg не найден, звук идёт в витрину как есть'); }

function ужатьЗвук(abs) {
  if (!жмёмЗвук || fs.statSync(abs).size < 400 * 1024) return abs;
  fs.mkdirSync(КЭШ, { recursive: true });
  const копия = path.join(КЭШ, 'a32_' + abs.replace(/[\\/]/g, '_'));
  try {
    if (!fs.existsSync(копия) || fs.statSync(копия).mtimeMs < fs.statSync(abs).mtimeMs) {
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', abs, '-ac', '1', '-ar', '22050',
        '-c:a', 'libmp3lame', '-b:a', '32k', копия], { stdio: 'ignore' });
    }
  } catch (e) { return abs; }
  return (fs.existsSync(копия) && fs.statSync(копия).size < fs.statSync(abs).size) ? копия : abs;
}

function dataUri(rel){
  const abs0=path.join(APP,rel);
  if(!fs.existsSync(abs0))return null;
  const ext=path.extname(abs0).toLowerCase();
  let abs = abs0;
  if (ext==='.jpg'||ext==='.jpeg'||ext==='.png') abs = ужатые.get(abs0)||abs0;
  else if (ext==='.mp3') abs = ужатьЗвук(abs0);
  let тип = MIME[ext]||'application/octet-stream';
  if (abs!==abs0 && ext!=='.mp3') тип = 'image/jpeg';
  return `data:${тип};base64,`+fs.readFileSync(abs).toString('base64');
}
let html = fs.readFileSync(path.join(APP,'index.html'),'utf8');
const css = fs.readFileSync(path.join(APP,'assets/css/main.css'),'utf8');

// Ужимаем все картинки приложения разом, одним запуском: по файлу за вызов
// сборка растянулась бы на минуты.
{
  const собрать = (каталог) => {
    const итог = [];
    const абс = path.join(APP, каталог);
    if (!fs.existsSync(абс)) return итог;
    for (const f of fs.readdirSync(абс)) {
      const полный = path.join(абс, f);
      if (fs.statSync(полный).isDirectory()) итог.push(...собрать(каталог + '/' + f));
      else if (/\.(jpg|jpeg|png)$/i.test(f)) итог.push(каталог + '/' + f);
    }
    return итог;
  };
  подготовитьУжатие(собрать('assets/img'));
}
// Список файлов берём из самого index.html, а не переписываем руками: иначе
// новый файл приложения тихо не попадает в витрину. На этом уже попались —
// shkola.js с героями и словарём урока в сборку не входил.
const порядокJs = [...html.matchAll(/<script src="assets\/js\/([^"]+)"><\/script>/g)].map(m=>m[1]);
if (!порядокJs.length) throw new Error('в index.html не нашлось ни одного скрипта приложения');
for (const f of порядокJs) {
  if (!fs.existsSync(path.join(APP,'assets/js',f))) throw new Error('нет файла скрипта: '+f);
}
let js = порядокJs.map(f=>fs.readFileSync(path.join(APP,'assets/js',f),'utf8')).join('\n;\n');

// Обложки уроков, иллюстрации по ходу текста и картинки друга — картами по имени файла.
// Аудио уроков в один файл не влезает (25 МБ), поэтому берём только те, что перечислены в AUDIO_LESSONS.
const AUDIO_LESSONS = (process.env.AUDIO_LESSONS ?? (process.env.SLIM === '1' ? '' : '1')).split(',').map(x=>x.trim()).filter(Boolean);
function collect(dir, filter){ const abs=path.join(APP,dir); const map={}; if(fs.existsSync(abs))for(const f of fs.readdirSync(abs)){ if(!filter||filter(f)){ const u=dataUri(dir+'/'+f); if(u)map[f.replace(/\.[a-z0-9]+$/,'')]=u; } } return map; }
// Витрина в один файл не тянет все 105 обложек: git-хост роняет архив больше 3.6 МБ.
// LESSON_IMGS ограничивает, сколько уроков берём в превью (по умолчанию первые 8).
// На боевом сервере ограничения нет и картинки лежат файлами.
const LESSON_IMGS = Number(process.env.LESSON_IMGS || (process.env.SLIM === '1' ? 3 : 8));
const lessonImgs = collect('assets/img/lessons', (f) => {
  if (!f.endsWith('.jpg')) return false;
  const m = f.match(/^l(\d+)/);
  return m ? Number(m[1]) <= LESSON_IMGS : true;
});
// Картинка экрана проверки знаний лежит отдельно, но подставляется из той же карты.
{ const u = dataUri('assets/img/cards/exam.jpg'); if (u) lessonImgs['exam'] = u; }
const petImgs = collect('assets/img/pet', f=>f.endsWith('.jpg'));
const lessonAud = {};
for(const n of AUDIO_LESSONS){ const u=dataUri('assets/audio/lessons/l'+n+'.mp3'); if(u) lessonAud['l'+n]=u; }
js = 'const __LES_IMG = '+JSON.stringify(lessonImgs)+';\n'
   + 'const __PET_IMG = '+JSON.stringify(petImgs)+';\n'
   + 'const __LES_AUD = '+JSON.stringify(lessonAud)+';\n' + js;
js = js.split('return `assets/img/lessons/l${n}.jpg`;').join('return __LES_IMG["l"+n] || "";');
// Запасная иллюстрация урока: правим саму строку возврата, а не всю функцию.
// Функция с тех пор обросла разбором её страниц, и замена целиком перестала
// срабатывать молча — путь оставался в витрине битой ссылкой.
js = js.split('return `assets/img/lessons/l${n}-a.jpg`;')
       .join("return __LES_IMG['l'+n+'-a'] || '';");
js = js.split('function lessonAudio(n) { return `assets/audio/lessons/l${n}.mp3`; }')
       .join('function lessonAudio(n) { return __LES_AUD["l"+n] || ""; }');
js = js.split('return `assets/img/pet/${в.файл}-${petСтадия() + 1}.jpg`;')
       .join('return __PET_IMG[в.файл+"-"+(petСтадия()+1)] || "";');
js = js.split("'assets/img/cards/exam.jpg'").join('(__LES_IMG["exam"]||"")');
// Запасная обложка главы: в одном файле путей нет, подставляем карту
js = js.split('return `assets/img/chapters/ch${meta ? meta.bi + 1 : 1}.jpg`;')
       .join('return __CHIMG[meta ? meta.bi + 1 : 1] || "";');
js = js.split("onerror=\"this.onerror=null;this.src='assets/img/chapters/ch${bi + 1}.jpg'\"")
       .join("onerror=\"this.onerror=null;this.src='${__CHIMG[bi+1]||''}'\"");
// Стикеры: карта уже собрана ниже, поправляем шаблон пути
js = js.split('url: `assets/img/stickers/${key}.jpg`').join('url: (__IMG_STICKERS[key] || "")');
// dynamic image/sticker maps
// Ужатая витрина: SLIM=1 берёт только часть стикеров и обходится без
// озвучки. Нужна там, где хост не принимает файл больше нескольких мегабайт.
const SLIM = process.env.SLIM === '1';
const STICKERS_MAX = Number(process.env.STICKERS_MAX || (SLIM ? 8 : 999));
function inlineDir(prefix, tokenExpr){ const dir=path.join(APP,'assets/img/'+prefix); const map={}; let взято=0; if(fs.existsSync(dir))for(const f of fs.readdirSync(dir)){ if(!f.endsWith('.jpg'))continue; if(prefix==='stickers' && взято>=STICKERS_MAX)continue; взято++; map[f.replace('.jpg','')]=dataUri('assets/img/'+prefix+'/'+f);} const v='__IMG_'+prefix.toUpperCase(); js='const '+v+' = '+JSON.stringify(map)+';\n'+js; js=js.split('assets/img/'+prefix+'/'+tokenExpr+'.jpg').join('${'+v+'['+tokenExpr.slice(2,-1)+']||""}'); }
const stkDir=path.join(APP,'assets/svg/stickers'); const stk={}; if(fs.existsSync(stkDir))for(const f of fs.readdirSync(stkDir)){ if(f.endsWith('.svg'))stk[f.replace('.svg','')]=dataUri('assets/svg/stickers/'+f);} js='const __STK = '+JSON.stringify(stk)+';\n'+js; js=js.split('assets/svg/stickers/${k}.svg').join('${__STK[k]||""}');
const gimg={}; const gd=path.join(APP,'assets/img/games'); if(fs.existsSync(gd))for(const f of fs.readdirSync(gd)){ if(f.endsWith('.jpg'))gimg[f.replace('.jpg','')]=dataUri('assets/img/games/'+f);} js='const __GAMEIMG = '+JSON.stringify(gimg)+';\n'+js; js=js.split('assets/img/games/${g.key}.jpg').join('${__GAMEIMG[g.key]||""}');
inlineDir('mem','${c.icon}'); inlineDir('ark','${c.img}'); inlineDir('stickers','${k}');
// Картинки внутри игр собираются в коде: символ по теме хода и обложка игры.
// В одном файле путей нет, поэтому подставляем те же карты.
js = js.split("return 'assets/img/mem/' + имя + '.jpg';")
       .join('return __IMG_MEM[имя] || "";');
js = js.split('const свой = игра ? `assets/img/games/${игра}.jpg` : \'\';')
       .join("const свой = игра ? (__GAMEIMG[игра] || '') : '';");
// Портреты помощников и общий кадр: пути лежат строками в shkola.js.
const geroi = {};
const gerDir = path.join(APP, 'assets/img/geroi');
if (fs.existsSync(gerDir)) {
  for (const f of fs.readdirSync(gerDir)) {
    if (!f.endsWith('.jpg')) continue;
    js = js.split("'assets/img/geroi/" + f + "'").join("'" + dataUri('assets/img/geroi/' + f) + "'");
    geroi[f] = 1;
  }
}
const chimg={}; for(let i=1;i<=3;i++){const u=dataUri('assets/img/chapters/ch'+i+'.jpg'); if(u)chimg[i]=u;} js='const __CHIMG = '+JSON.stringify(chimg)+';\n'+js; js=js.split('assets/img/chapters/ch${meta.bi + 1}.jpg').join('${__CHIMG[meta.bi+1]||""}');

// В сборке одним файлом соседних файлов нет: работник страницы и манифест
// не нужны, иначе браузер зря стучится и пишет 404 в консоль.
js = js.split("navigator.serviceWorker.register('service-worker.js')").join('Promise.resolve()');
const preboot="try{if(!localStorage.getItem('mt_onb'))localStorage.setItem('mt_onb','1');if(!localStorage.getItem('mt_auth'))localStorage.setItem('mt_auth','1');}catch(e){}\n";
js=preboot+js;
html=html.split('<link rel="stylesheet" href="assets/css/main.css">').join(`<style>\n${css}\n</style>`);
// Шрифты вшиваем начертаниями внутрь файла. Раньше витрина брала их из
// сети Google: файл был легче на 700 КБ, зато без интернета текст ехал на
// системный шрифт, а браузер каждого зрителя стучался на чужой сервер.
let fcss = fs.readFileSync(path.join(APP,'assets/css/fonts.css'),'utf8');
for(const rel of [...new Set((fcss.match(/\.\.\/fonts\/[A-Za-z0-9_-]+\.woff2/g)||[]))]){
  const uri = dataUri('assets/'+rel.slice(3)); if(uri) fcss = fcss.split(rel).join(uri);
}
html=html.split('<link rel="stylesheet" href="assets/css/fonts.css">').join(`<style>\n${fcss}\n</style>`);
// Собираем все теги скриптов приложения в один встроенный блок,
// чтобы порядок файлов в index.html можно было менять без правки сборщика.
// Замена только функцией: в коде есть $$ и $&, а в строке замены это спецсимволы.
html = html.replace(/(?:[ \t]*<script src="assets\/js\/[^"]+"><\/script>\s*)+/,
  () => `  <script>\n${js}\n</script>\n`);
html=html.replace(/<link rel="manifest"[^>]*>/g,'');
// Витрина одним файлом живёт вне Телеграма: скрипт мини-приложения там
// только зря стучится наружу и пишет ошибку в консоль.
html=html.replace(/[ \t]*<script src="https:\/\/telegram\.org[^"]*"><\/script>\s*/g,'');
const cssRefs=[...new Set((html.match(/\.\.\/img\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp)/g)||[]))];
for(const rel of cssRefs){ const uri=dataUri('assets/'+rel.slice(3)); if(uri)html=html.split(rel).join(uri); }
// Иллюстрации уроков Екатерины лежат в lessons.js прямыми путями, по девять
// на урок. Вшивать все сто двадцать шесть — это двадцать два мегабайта в
// витрине, которую хост и так еле принимает. Берём столько же уроков, сколько
// и обложек (LESSON_IMGS), остальные на витрине показываются заглушкой, а на
// боевом сервере лежат файлами и открываются все.
const читалка = /assets\/img\/lessons\/reading\/l(\d+)_\d+\.jpg/g;
const лишние = new Set();
for (const m of html.matchAll(читалка)) {
  if (Number(m[1]) > LESSON_IMGS) лишние.add(m[0]);
}
for (const rel of лишние) html = html.split('"' + rel + '"').join('null');

const refs=[...new Set((html.match(/assets\/(?:img|svg|video|audio)\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp|mp4|mp3)/g)||[]))];
let inlined=0; for(const rel of refs){ const uri=dataUri(rel); if(uri){ html=html.split(rel).join(uri); inlined++; } }
fs.writeFileSync(OUT, html);
const leftover=(html.match(/assets\/(?:img|svg|video|audio|css|js)\//g)||[]).length;
console.log(`Built ${(html.length/1024|0)}KB -> ${OUT} | inlined ${inlined}/${refs.length} | leftover ${leftover}`);
