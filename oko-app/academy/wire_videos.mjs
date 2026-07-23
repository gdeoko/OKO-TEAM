#!/usr/bin/env node
/* Прописывает videoUrl в pack JSON для всех произведённых видео oko_<block>_<i>.mp4,
   затем регенерирует academy-content через build_pack.mjs.
   Запуск: node wire_videos.mjs [packJson]  (по умолчанию /tmp/pack_clean.json) */
import fs from 'fs';
import { execSync } from 'child_process';

const packPath = process.argv[2] || '/tmp/pack_clean.json';
const MEDIA = '/home/user/OKO-TEAM/oko-app/site/media';
const BASE = 'https://okoteam.top/media';
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

let wired = 0;
for (const block of Object.keys(pack)) {
  pack[block].forEach((L, i) => {
    const fn = `oko_${block}_${i}.mp4`;
    const p = `${MEDIA}/${fn}`;
    if (fs.existsSync(p) && fs.statSync(p).size > 100000) {
      L.videoUrl = `${BASE}/${fn}`;
      wired++;
    } else if (L.videoUrl) {
      delete L.videoUrl; // видео пропало — не ссылаться
    }
  });
}
fs.writeFileSync(packPath, JSON.stringify(pack));
console.log(`videoUrl wired: ${wired}`);
// регенерируем модуль контент-пака
const here = new URL('.', import.meta.url).pathname;
execSync(`node ${here}build_pack.mjs ${packPath}`, { stdio: 'inherit' });
