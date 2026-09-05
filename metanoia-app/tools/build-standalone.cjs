#!/usr/bin/env node
// Portable build: inline CSS+JS+images+audio into ONE self-contained HTML.
// Usage: node tools/build-standalone.cjs [outFile]
// Default out: <repo>/metanoia-app/dist/progress-page.html
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '..', 'public_html');
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'dist', 'progress-page.html');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const MIME = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.mp3':'audio/mpeg' };
function dataUri(rel){ const abs=path.join(APP,rel); if(!fs.existsSync(abs))return null; const ext=path.extname(abs).toLowerCase(); return `data:${MIME[ext]||'application/octet-stream'};base64,`+fs.readFileSync(abs).toString('base64'); }
let html = fs.readFileSync(path.join(APP,'index.html'),'utf8');
const css = fs.readFileSync(path.join(APP,'assets/css/main.css'),'utf8');
let js = ['icons.js','magic.js','lessons.js','tasks.js','gamedata.js','app.js'].map(f=>fs.readFileSync(path.join(APP,'assets/js',f),'utf8')).join('\n;\n');

// Обложки уроков, иллюстрации по ходу текста и картинки друга — картами по имени файла.
// Аудио уроков в один файл не влезает (25 МБ), поэтому берём только те, что перечислены в AUDIO_LESSONS.
const AUDIO_LESSONS = (process.env.AUDIO_LESSONS || '1').split(',').map(x=>x.trim()).filter(Boolean);
function collect(dir, filter){ const abs=path.join(APP,dir); const map={}; if(fs.existsSync(abs))for(const f of fs.readdirSync(abs)){ if(!filter||filter(f)){ const u=dataUri(dir+'/'+f); if(u)map[f.replace(/\.[a-z0-9]+$/,'')]=u; } } return map; }
// Витрина в один файл не тянет все 105 обложек: git-хост роняет архив больше 3.6 МБ.
// LESSON_IMGS ограничивает, сколько уроков берём в превью (по умолчанию первые 8).
// На боевом сервере ограничения нет и картинки лежат файлами.
const LESSON_IMGS = Number(process.env.LESSON_IMGS || 8);
const lessonImgs = collect('assets/img/lessons', (f) => {
  if (!f.endsWith('.jpg')) return false;
  const m = f.match(/^l(\d+)/);
  return m ? Number(m[1]) <= LESSON_IMGS : true;
});
const petImgs = collect('assets/img/pet', f=>f.endsWith('.jpg'));
const lessonAud = {};
for(const n of AUDIO_LESSONS){ const u=dataUri('assets/audio/lessons/l'+n+'.mp3'); if(u) lessonAud['l'+n]=u; }
js = 'const __LES_IMG = '+JSON.stringify(lessonImgs)+';\n'
   + 'const __PET_IMG = '+JSON.stringify(petImgs)+';\n'
   + 'const __LES_AUD = '+JSON.stringify(lessonAud)+';\n' + js;
js = js.split('return `assets/img/lessons/l${n}.jpg`;').join('return __LES_IMG["l"+n] || "";');
js = js.split("function lessonPic(n, i) { return `assets/img/lessons/l${n}-${'abc'[i] || 'a'}.jpg`; }")
       .join("function lessonPic(n, i) { return __LES_IMG['l'+n+'-'+('abc'[i]||'a')] || ''; }");
js = js.split('function lessonAudio(n) { return `assets/audio/lessons/l${n}.mp3`; }')
       .join('function lessonAudio(n) { return __LES_AUD["l"+n] || ""; }');
js = js.split('return `assets/img/pet/${в.файл}-${petСтадия() + 1}.jpg`;')
       .join('return __PET_IMG[в.файл+"-"+(petСтадия()+1)] || "";');
js = js.split("'assets/img/cards/exam.jpg'").join('(__LES_IMG["exam"]||"")');
// Запасная обложка главы: в одном файле путей нет, подставляем карту
js = js.split('return `assets/img/chapters/ch${meta ? meta.bi + 1 : 1}.jpg`;')
       .join('return __CHIMG[meta ? meta.bi + 1 : 1] || "";');
js = js.split("onerror=\"this.onerror=null;this.src='assets/img/chapters/ch${bi + 1}.jpg'\"")
       .join("onerror=\"this.onerror=null;this.src='${__CHIMG[bi+1]||\\\"\\\"}'\"");
// Стикеры: карта уже собрана ниже, поправляем шаблон пути
js = js.split('url: `assets/img/stickers/${key}.jpg`').join('url: (__IMG_STICKERS[key] || "")');
// dynamic image/sticker maps
function inlineDir(prefix, tokenExpr){ const dir=path.join(APP,'assets/img/'+prefix); const map={}; if(fs.existsSync(dir))for(const f of fs.readdirSync(dir)){ if(f.endsWith('.jpg'))map[f.replace('.jpg','')]=dataUri('assets/img/'+prefix+'/'+f);} const v='__IMG_'+prefix.toUpperCase(); js='const '+v+' = '+JSON.stringify(map)+';\n'+js; js=js.split('assets/img/'+prefix+'/'+tokenExpr+'.jpg').join('${'+v+'['+tokenExpr.slice(2,-1)+']||""}'); }
const stkDir=path.join(APP,'assets/svg/stickers'); const stk={}; if(fs.existsSync(stkDir))for(const f of fs.readdirSync(stkDir)){ if(f.endsWith('.svg'))stk[f.replace('.svg','')]=dataUri('assets/svg/stickers/'+f);} js='const __STK = '+JSON.stringify(stk)+';\n'+js; js=js.split('assets/svg/stickers/${k}.svg').join('${__STK[k]||""}');
const gimg={}; const gd=path.join(APP,'assets/img/games'); if(fs.existsSync(gd))for(const f of fs.readdirSync(gd)){ if(f.endsWith('.jpg'))gimg[f.replace('.jpg','')]=dataUri('assets/img/games/'+f);} js='const __GAMEIMG = '+JSON.stringify(gimg)+';\n'+js; js=js.split('assets/img/games/${g.key}.jpg').join('${__GAMEIMG[g.key]||""}');
inlineDir('mem','${c.icon}'); inlineDir('ark','${c.img}'); inlineDir('stickers','${k}');
const chimg={}; for(let i=1;i<=3;i++){const u=dataUri('assets/img/chapters/ch'+i+'.jpg'); if(u)chimg[i]=u;} js='const __CHIMG = '+JSON.stringify(chimg)+';\n'+js; js=js.split('assets/img/chapters/ch${meta.bi + 1}.jpg').join('${__CHIMG[meta.bi+1]||""}');

const preboot="try{if(!localStorage.getItem('mt_onb'))localStorage.setItem('mt_onb','1');if(!localStorage.getItem('mt_auth'))localStorage.setItem('mt_auth','1');}catch(e){}\n";
js=preboot+js;
html=html.split('<link rel="stylesheet" href="assets/css/main.css">').join(`<style>\n${css}\n</style>`);
// Собираем все теги скриптов приложения в один встроенный блок,
// чтобы порядок файлов в index.html можно было менять без правки сборщика.
html = html.replace(/(?:[ \t]*<script src="assets\/js\/[^"]+"><\/script>\s*)+/,
  `  <script>\n${js}\n</script>\n`);
html=html.replace(/<link rel="manifest"[^>]*>/g,'');
const cssRefs=[...new Set((html.match(/\.\.\/img\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp)/g)||[]))];
for(const rel of cssRefs){ const uri=dataUri('assets/'+rel.slice(3)); if(uri)html=html.split(rel).join(uri); }
const refs=[...new Set((html.match(/assets\/(?:img|svg|video|audio)\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp|mp4|mp3)/g)||[]))];
let inlined=0; for(const rel of refs){ const uri=dataUri(rel); if(uri){ html=html.split(rel).join(uri); inlined++; } }
fs.writeFileSync(OUT, html);
const leftover=(html.match(/assets\/(?:img|svg|video|audio|css|js)\//g)||[]).length;
console.log(`Built ${(html.length/1024|0)}KB -> ${OUT} | inlined ${inlined}/${refs.length} | leftover ${leftover}`);
