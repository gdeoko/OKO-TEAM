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
let js = ['icons.js','magic.js','lessons.js','gamedata.js','app.js'].map(f=>fs.readFileSync(path.join(APP,'assets/js',f),'utf8')).join('\n;\n');
// dynamic image/sticker maps
function inlineDir(prefix, tokenExpr){ const dir=path.join(APP,'assets/img/'+prefix); const map={}; if(fs.existsSync(dir))for(const f of fs.readdirSync(dir)){ if(f.endsWith('.jpg'))map[f.replace('.jpg','')]=dataUri('assets/img/'+prefix+'/'+f);} const v='__IMG_'+prefix.toUpperCase(); js='const '+v+' = '+JSON.stringify(map)+';\n'+js; js=js.split('assets/img/'+prefix+'/'+tokenExpr+'.jpg').join('${'+v+'['+tokenExpr.slice(2,-1)+']||""}'); }
const stkDir=path.join(APP,'assets/svg/stickers'); const stk={}; if(fs.existsSync(stkDir))for(const f of fs.readdirSync(stkDir)){ if(f.endsWith('.svg'))stk[f.replace('.svg','')]=dataUri('assets/svg/stickers/'+f);} js='const __STK = '+JSON.stringify(stk)+';\n'+js; js=js.split('assets/svg/stickers/${k}.svg').join('${__STK[k]||""}');
const gimg={}; const gd=path.join(APP,'assets/img/games'); if(fs.existsSync(gd))for(const f of fs.readdirSync(gd)){ if(f.endsWith('.jpg'))gimg[f.replace('.jpg','')]=dataUri('assets/img/games/'+f);} js='const __GAMEIMG = '+JSON.stringify(gimg)+';\n'+js; js=js.split('assets/img/games/${g.key}.jpg').join('${__GAMEIMG[g.key]||""}');
inlineDir('mem','${c.icon}'); inlineDir('ark','${c.img}'); inlineDir('stickers','${k}');
const chimg={}; for(let i=1;i<=3;i++){const u=dataUri('assets/img/chapters/ch'+i+'.jpg'); if(u)chimg[i]=u;} js='const __CHIMG = '+JSON.stringify(chimg)+';\n'+js; js=js.split('assets/img/chapters/ch${meta.bi + 1}.jpg').join('${__CHIMG[meta.bi+1]||""}');
const preboot="try{if(!localStorage.getItem('mt_onb'))localStorage.setItem('mt_onb','1');if(!localStorage.getItem('mt_auth'))localStorage.setItem('mt_auth','1');}catch(e){}\n";
js=preboot+js;
html=html.split('<link rel="stylesheet" href="assets/css/main.css">').join(`<style>\n${css}\n</style>`);
html=html.split('  <script src="assets/js/icons.js"></script>\n  <script src="assets/js/magic.js"></script>\n  <script src="assets/js/lessons.js"></script>\n  <script src="assets/js/gamedata.js"></script>\n  <script src="assets/js/app.js"></script>').join(`  <script>\n${js}\n</script>`);
html=html.replace(/<link rel="manifest"[^>]*>/g,'');
const cssRefs=[...new Set((html.match(/\.\.\/img\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp)/g)||[]))];
for(const rel of cssRefs){ const uri=dataUri('assets/'+rel.slice(3)); if(uri)html=html.split(rel).join(uri); }
const refs=[...new Set((html.match(/assets\/(?:img|svg|video|audio)\/[A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|svg|webp|mp4|mp3)/g)||[]))];
let inlined=0; for(const rel of refs){ const uri=dataUri(rel); if(uri){ html=html.split(rel).join(uri); inlined++; } }
fs.writeFileSync(OUT, html);
const leftover=(html.match(/assets\/(?:img|svg|video|audio|css|js)\//g)||[]).length;
console.log(`Built ${(html.length/1024|0)}KB -> ${OUT} | inlined ${inlined}/${refs.length} | leftover ${leftover}`);
