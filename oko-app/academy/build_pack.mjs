#!/usr/bin/env node
/* Интеграция контент-пака Академии: берёт JSON уроков (по блокам), подставляет бренд-SVG
   по ключу иконки, и пишет modules/academy-content/script.js (window.AC_PACK).
   Запуск: node build_pack.mjs <lessons.json> [out.js]
   lessons.json: { "<blockId>": [ {title,dur,c1,c2,slides:[{t,pts,icon}],quiz,pairs,task}, ... ], ... } */
import fs from 'fs';

/* ---- Бренд-иконки: тонкая линия currentColor, viewBox 0 0 120 70 (как в academy) ---- */
const S = (b) => `<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
export const ICONS = {
  target:   S('<circle cx="60" cy="35" r="26"/><circle cx="60" cy="35" r="15"/><circle cx="60" cy="35" r="5" fill="currentColor" stroke="none"/>'),
  rocket:   S('<path d="M60 8c12 6 18 18 18 30l-8 8H50l-8-8c0-12 6-24 18-30z"/><circle cx="60" cy="30" r="6"/><path d="M50 46l-8 12M70 46l8 12M60 50v10"/>'),
  chart:    S('<path d="M18 58V16M18 58h84"/><path d="M30 50l18-16 14 10 22-26" /><circle cx="48" cy="34" r="3" fill="currentColor" stroke="none"/><circle cx="62" cy="44" r="3" fill="currentColor" stroke="none"/>'),
  chartbar: S('<path d="M18 58V14M18 58h84"/><rect x="30" y="40" width="12" height="18"/><rect x="52" y="30" width="12" height="28"/><rect x="74" y="20" width="12" height="38"/>'),
  people:   S('<circle cx="34" cy="26" r="9"/><path d="M20 54c1-11 7-16 14-16s13 5 14 16"/><circle cx="80" cy="26" r="9"/><path d="M66 54c1-11 7-16 14-16s13 5 14 16"/>'),
  person:   S('<circle cx="60" cy="24" r="11"/><path d="M40 58c1-13 9-20 20-20s19 7 20 20"/>'),
  profile:  S('<circle cx="30" cy="24" r="12"/><path d="M18 24a12 12 0 0 1 24 0"/><path d="M52 16h54M52 27h40M52 38h50" opacity=".85"/>'),
  phone:    S('<rect x="42" y="8" width="36" height="54" rx="7"/><path d="M52 16h16M56 54h8" opacity=".7"/>'),
  camera:   S('<rect x="20" y="18" width="54" height="38" rx="7"/><path d="M74 30l24-12v38L74 42z"/><circle cx="40" cy="37" r="9"/>'),
  image:    S('<rect x="24" y="14" width="72" height="46" rx="7"/><circle cx="43" cy="30" r="6"/><path d="M28 54l20-18 14 12 12-10 22 16" opacity=".85"/>'),
  play:     S('<circle cx="60" cy="35" r="26"/><path d="M52 24l20 11-20 11z" fill="currentColor" stroke="none"/>'),
  edit:     S('<path d="M30 54h60" opacity=".6"/><path d="M40 46l30-30 8 8-30 30-12 4z"/><path d="M64 22l8 8"/>'),
  doc:      S('<rect x="34" y="8" width="52" height="54" rx="7"/><path d="M44 22h32M44 32h32M44 42h24M44 52h18" opacity=".85"/>'),
  checklist:S('<rect x="28" y="6" width="64" height="58" rx="8"/><path d="M38 20l4 4 7-8M38 36l4 4 7-8M38 52l4 4 7-8" stroke-width="2.8"/><path d="M56 21h26M56 37h26M56 53h18" opacity=".8"/>'),
  bulb:     S('<path d="M60 10a20 20 0 0 1 12 36c-3 2-4 5-4 9H52c0-4-1-7-4-9a20 20 0 0 1 12-36z"/><path d="M52 60h16M55 66h10" opacity=".8"/>'),
  eye:      S('<path d="M12 35s18-22 48-22 48 22 48 22-18 22-48 22S12 35 12 35z"/><circle cx="60" cy="35" r="10"/>'),
  heart:    S('<path d="M60 56S28 40 28 25a15 15 0 0 1 32-6 15 15 0 0 1 32 6c0 15-32 31-32 31z"/>'),
  fire:     S('<path d="M60 8c4 12-6 16-6 26 0-6-5-9-5-9-4 6-11 11-11 22a22 22 0 0 0 44 0c0-14-12-20-16-39z"/>'),
  money:    S('<circle cx="60" cy="35" r="26"/><path d="M60 20v30M53 27h12a5 5 0 0 1 0 10h-10a5 5 0 0 0 0 10h13"/>'),
  wallet:   S('<rect x="22" y="18" width="76" height="38" rx="8"/><path d="M22 30h76"/><circle cx="82" cy="42" r="4" fill="currentColor" stroke="none"/>'),
  tag:      S('<path d="M18 35 46 12h30a8 8 0 0 1 8 8v30L56 78z" transform="scale(.85) translate(6 -4)"/><circle cx="66" cy="27" r="5"/>'),
  scale:    S('<path d="M60 12v42M40 54h40" /><path d="M30 24h60M30 24l-10 18h20zM90 24l-10 18h20z"/>'),
  handshake:S('<path d="M12 30l20-8 14 8 14-8 20 8"/><path d="M30 34l14 14 8-6 10 10 8-6"/><path d="M84 34l-14 14" opacity=".7"/>'),
  chat:     S('<rect x="16" y="14" width="54" height="38" rx="9"/><path d="M30 60l6-8h12" opacity=".8"/><rect x="58" y="30" width="46" height="30" rx="8" opacity=".85"/>'),
  megaphone:S('<path d="M20 30v12l14 3 30 14V13L34 27z"/><path d="M64 22c10 3 10 23 0 26" opacity=".7"/><path d="M40 48l4 12" />'),
  bolt:     S('<path d="M62 6 34 40h20l-6 24 30-38H56z"/>'),
  star:     S('<path d="M60 8l13 27 29 4-21 21 5 29-26-14-26 14 5-29-21-21 29-4z"/>'),
  crown:    S('<path d="M20 50h80l-6-30-20 16-14-24-14 24-20-16z"/><path d="M20 56h80" opacity=".7"/>'),
  shield:   S('<path d="M60 8l34 10v20c0 18-14 28-34 34-20-6-34-16-34-34V18z"/><path d="M48 34l9 9 17-17" stroke-width="2.8"/>'),
  lock:     S('<rect x="34" y="30" width="52" height="34" rx="8"/><path d="M44 30v-8a16 16 0 0 1 32 0v8"/><circle cx="60" cy="46" r="4" fill="currentColor" stroke="none"/>'),
  key:      S('<circle cx="34" cy="35" r="14"/><path d="M48 35h44M78 35v12M92 35v10"/>'),
  gear:     S('<circle cx="60" cy="35" r="12"/><path d="M60 12v-6M60 64v-6M83 35h6M31 35h-6M76 19l4-4M40 55l-4 4M76 51l4 4M40 15l-4-4"/>'),
  robot:    S('<rect x="34" y="22" width="52" height="38" rx="10"/><circle cx="50" cy="41" r="5"/><circle cx="70" cy="41" r="5"/><path d="M60 22v-8M50 14h20"/><path d="M28 38v10M92 38v10" opacity=".7"/>'),
  code:     S('<rect x="18" y="14" width="84" height="42" rx="8"/><path d="M40 28l-10 7 10 7M80 28l10 7-10 7M66 26l-12 18" stroke-width="2.8"/>'),
  network:  S('<circle cx="60" cy="16" r="7"/><circle cx="26" cy="52" r="7"/><circle cx="94" cy="52" r="7"/><path d="M56 22 30 46M64 22l26 24M33 52h54" opacity=".8"/>'),
  flow:     S('<rect x="16" y="24" width="24" height="22" rx="5"/><rect x="80" y="24" width="24" height="22" rx="5"/><path d="M40 35h40"/><path d="M72 29l8 6-8 6" />'),
  layers:   S('<path d="M60 10 20 30l40 20 40-20z"/><path d="M20 42l40 20 40-20" opacity=".7"/>'),
  grid:     S('<rect x="22" y="12" width="32" height="20" rx="4"/><rect x="66" y="12" width="32" height="20" rx="4"/><rect x="22" y="40" width="32" height="20" rx="4"/><rect x="66" y="40" width="32" height="20" rx="4"/>'),
  funnel:   S('<path d="M18 14h84L70 44v18l-20 8V44z"/>'),
  calendar: S('<rect x="22" y="16" width="76" height="46" rx="8"/><path d="M22 30h76M38 10v12M82 10v12"/><circle cx="44" cy="44" r="3" fill="currentColor" stroke="none"/><circle cx="60" cy="44" r="3" fill="currentColor" stroke="none"/>'),
  clock:    S('<circle cx="60" cy="35" r="26"/><path d="M60 20v16l11 7"/>'),
  music:    S('<path d="M50 46V16l32-6v30"/><circle cx="44" cy="48" r="8"/><circle cx="76" cy="42" r="8"/>'),
  mic:      S('<rect x="50" y="8" width="20" height="34" rx="10"/><path d="M40 36a20 20 0 0 0 40 0M60 56v8M48 64h24"/>'),
  brush:    S('<path d="M74 12 92 30 56 66l-18 4 4-18z"/><path d="M62 24 80 42" opacity=".7"/>'),
  search:   S('<circle cx="50" cy="32" r="20"/><path d="M65 47l22 20"/>'),
  compass:  S('<circle cx="60" cy="35" r="27"/><path d="M72 23 54 41l-6 18 18-6z" fill="currentColor" stroke="none" opacity=".85"/>'),
  flag:     S('<path d="M36 8v54"/><path d="M36 12h44l-8 12 8 12H36z"/>'),
  book:     S('<path d="M60 16c-8-6-22-6-30 0v40c8-6 22-6 30 0 8-6 22-6 30 0V16c-8-6-22-6-30 0z"/><path d="M60 16v40"/>'),
  scriptdoc:S('<path d="M40 10h32l14 14v38a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z"/><path d="M72 10v14h14M44 34h32M44 44h32M44 54h20" opacity=".85"/>'),
  trophy:   S('<path d="M40 12h40v14a20 20 0 0 1-40 0z"/><path d="M40 18H26c0 12 8 16 16 16M80 18h14c0 12-8 16-16 16M60 46v10M46 62h28M52 56h16"/>'),
  gift:     S('<rect x="26" y="28" width="68" height="34" rx="6"/><path d="M26 38h68M60 28v34"/><path d="M60 28c-6-14-22-10-16-2 3 4 16 2 16 2zM60 28c6-14 22-10 16-2-3 4-16 2-16 2z"/>'),
  puzzle:   S('<path d="M28 24h20a6 6 0 0 1 12 0h20v20a6 6 0 0 1 0 12v8H60a6 6 0 0 0-12 0H28V44a6 6 0 0 0 0-12z"/>'),
  stack:    S('<rect x="30" y="12" width="60" height="14" rx="4"/><rect x="30" y="30" width="60" height="14" rx="4" opacity=".85"/><rect x="30" y="48" width="60" height="14" rx="4" opacity=".7"/>'),
  cloud:    S('<path d="M38 52a16 16 0 0 1 2-32 20 20 0 0 1 38 4 14 14 0 0 1-2 28z"/>'),
  link:     S('<path d="M48 42 72 18a13 13 0 0 1 18 18L74 52M72 28 48 52a13 13 0 0 1-18-18l16-16" opacity=".9"/>'),
  hourglass:S('<path d="M38 10h44M38 60h44"/><path d="M42 10c0 16 18 20 18 25 0-5 18-9 18-25M42 60c0-16 18-20 18-25 0 5 18 9 18 25"/>'),
  filter:   S('<path d="M20 16h80L68 44v18l-16 8V44z"/>'),
};
const ALIAS = { avatar:'profile', video:'play', text:'doc', trigger:'bolt', emotion:'heart', community:'people',
  competitor:'scale', price:'money', story:'scriptdoc', reels:'play', hook:'bolt', ai:'robot', prompt:'chat',
  automation:'flow', vibecoding:'code', voice:'mic', cover:'image', growth:'chart', idea:'bulb', trust:'shield',
  cta:'megaphone', deadline:'hourglass', question:'chat', win:'trophy', plan:'checklist', analysis:'search' };
function svgFor(icon){ if(!icon) return ICONS.bulb; const k=String(icon).toLowerCase().trim();
  return ICONS[k] || ICONS[ALIAS[k]] || ICONS.bulb; }
export const ICON_KEYS = Object.keys(ICONS);

function jss(str){ return "'" + String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ') + "'"; }
function lessonJS(L){
  const dur = L.dur || '3:00';
  const hasVid = !!L.videoUrl;
  const sub = L.sub || `${dur} · ${hasVid?'видео (голос Даниэля)':'слайды'} + тест + игра`;
  const vidLine = hasVid ? `\n  videoUrl:${jss(L.videoUrl)},` : '';
  const slides = (L.slides||[]).map(s=>`  {t:${jss(s.t)}, pts:[${(s.pts||[]).map(jss).join(', ')}],\n   svg:'${svgFor(s.icon).replace(/'/g,"\\'")}'}`).join(',\n');
  const quiz = (L.quiz||[]).map(q=>`  {q:${jss(q.q)}, o:[${(q.o||[]).map(jss).join(', ')}], a:${q.a|0}}`).join(',\n');
  const pairs = (L.pairs||[]).map(p=>`  [${jss(p[0])}, ${jss(p[1])}]`).join(',\n');
  const t = L.task||{};
  const task = `{\n    intro:${jss(t.intro||'')},\n    chips:[${(t.chips||[]).map(jss).join(', ')}],\n    ph:${jss(t.ph||'')},\n    verdict:${jss(t.verdict||'')}\n  }`;
  return `{\n  title:${jss(L.title)},\n  sub:${jss(sub)}, dur:${jss(dur)},${vidLine}\n  c1:${jss(L.c1||'')}, c2:${jss(L.c2||'')},\n  slides:[\n${slides}\n  ],\n  quiz:[\n${quiz}\n  ],\n  pairs:[\n${pairs}\n  ],\n  task:${task}\n}`;
}

function main(){
  const inPath = process.argv[2];
  const outPath = process.argv[3] || new URL('../app/modules/academy-content/script.js', import.meta.url).pathname;
  const data = JSON.parse(fs.readFileSync(inPath,'utf8'));
  const parts = [];
  let total=0;
  for(const bid of Object.keys(data)){
    const arr = data[bid]||[];
    total += arr.length;
    parts.push(`  ${JSON.stringify(bid)}: [\n${arr.map(lessonJS).join(',\n')}\n  ]`);
  }
  const out = `/* ===== АКАДЕМИЯ · КОНТЕНТ-ПАК (сгенерировано build_pack.mjs) =====================
   Доп.уроки блоков. Грузится ПЕРЕД модулем academy → window.AC_PACK { blockId: [урок…] }.
   Формат урока идентичен academy/script.js. Иконки слайдов — бренд-SVG по ключу. */
window.AC_PACK = Object.assign(window.AC_PACK||{}, {
${parts.join(',\n')}
});
`;
  fs.writeFileSync(outPath, out);
  console.log(`OK -> ${outPath}  блоков:${Object.keys(data).length}  уроков:${total}  (${Math.round(out.length/1024)} KB)`);
}
main();
