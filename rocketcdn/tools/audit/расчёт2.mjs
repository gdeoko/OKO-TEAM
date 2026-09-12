/* Окно открытия люка и его рывок. Формулы: rc-rocket.js doorOpen()
   (строки 4368-4420) и approach() (4326-4362). */
const Э = {
  "телефон": { docH:15456, vh:800, cases:[8593,386], rel:[8979,1868] },
  "узкий":   { docH:14501, vh:640, cases:[8689,386], rel:[9075,1505] },
  "четыре":  { docH:17038, vh:768, cases:[9745,1609], rel:[11354,1735] },
  "ПК":      { docH:17702, vh:900, cases:[9224,1862], rel:[11086,2048] },
  "широкий": { docH:18773, vh:1080,cases:[9195,1788], rel:[10983,2450] },
  "лежачий": { docH:12552, vh:412, cases:[8404,453], rel:[8857,975] }
};
const ss = (x) => x * x * (3 - 2 * x);
for (const [имя, d] of Object.entries(Э)) {
  const vh = d.vh;
  const kC = (y) => Math.max(0, Math.min(1, (vh - (d.cases[0] - y)) / (vh + d.cases[1])));
  const app = (y) => ss(Math.max(0, Math.min(1, (kC(y) - 0.08) / 0.57)));
  const rawRel = (y) => { const rT = d.rel[0] - y; return (vh * 1.35 - rT) / (vh * 1.35 - vh * 0.30); };
  const затвор = (y) => Math.max(0, (app(y) - 0.62) / 0.22);
  const дверь = (y) => Math.max(0, Math.min(1, Math.min(rawRel(y), затвор(y))));
  let точки = [];
  for (let y = d.cases[0] - vh; y < d.rel[0] + vh; y += 1) точки.push([y, дверь(y), app(y)]);
  const первый = (пр) => { const t = точки.find(p => пр(p)); return t ? t[0] : null; };
  const y0 = первый(p => p[1] > 0.02);
  const y50 = первый(p => p[1] >= 0.5);
  const y97 = первый(p => p[1] >= 0.97);
  const yВх = первый(p => p[1] > 0.97 && p[2] > 0.86);
  /* самый крутой участок: сколько доли двери набегает на 100 точек прокрутки */
  let макс = 0, гдеМакс = 0;
  for (let i = 100; i < точки.length; i++) {
    const d100 = точки[i][1] - точки[i - 100][1];
    if (d100 > макс) { макс = d100; гдеМакс = точки[i][0]; }
  }
  console.log(имя.padEnd(9) +
    " створки трогаются y=" + y0 +
    "; половина y=" + y50 + " (через " + (y50 - y0) + " точек)" +
    "; настежь y=" + y97 + "; вход y=" + yВх +
    "  | круче всего: " + (макс * 100).toFixed(0) + "% двери за 100 точек около y=" + гдеМакс);
}
