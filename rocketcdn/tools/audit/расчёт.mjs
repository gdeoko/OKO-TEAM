/* Пороги финальной сцены по формулам из rc-interior.js и rc-rocket.js,
   на настоящих размерах разделов (замер probe.mjs). Браузер не нужен. */
const Э = {
  "телефон": { docH:15456, vh:800, s:{included:[8017,577],cases:[8593,386],reliability:[8979,1868],faq:[10848,1700],contact:[12548,1091],epilogue:[13639,1741]} },
  "узкий":   { docH:14501, vh:640, s:{included:[8113,577],cases:[8689,386],reliability:[9075,1505],faq:[10581,1360],contact:[11941,1091],epilogue:[13032,1393]} },
  "четыре":  { docH:17038, vh:768, s:{included:[9278,467],cases:[9745,1609],reliability:[11354,1735],faq:[13090,1627],contact:[14716,657],epilogue:[15373,1665]} },
  "ПК":      { docH:17702, vh:900, s:{included:[8686,538],cases:[9224,1862],reliability:[11086,2048],faq:[13135,1908],contact:[15043,705],epilogue:[15748,1953]} },
  "широкий": { docH:18773, vh:1080,s:{included:[8701,494],cases:[9195,1788],reliability:[10983,2450],faq:[13434,2288],contact:[15722,708],epilogue:[16430,2343]} },
  "лежачий": { docH:12552, vh:412, s:{included:[7975,429],cases:[8404,453],reliability:[8857,975],faq:[9833,872],contact:[10705,954],epilogue:[11659,893]} }
};
const ПОРЯД = ["hero","kpi","effect","what","products","adv","infra","how","route","included","cases","reliability","faq","contact","epilogue"];
for (const [имя, d] of Object.entries(Э)) {
  const vh = d.vh, maxS = d.docH - vh, s = d.s;
  const P = (y) => y / maxS;
  const yIN   = s.faq[0] - vh * 0.38;
  const yLOCK = yIN - 2 * vh;
  const yTURN = s.contact[0] - vh * 0.4;
  const yCON  = s.contact[0] + s.contact[1] - vh * 0.2;
  const yPREP = yLOCK - 0.12 * maxS;
  /* люк */
  const yДв0 = s.reliability[0] - vh * 1.35;      /* створки трогаются */
  const yДв1 = s.reliability[0] - vh * 0.30;      /* створки настежь */
  /* подход: доля акта walk (#cases) */
  const kCases = (y) => Math.max(0, Math.min(1, (vh - (s.cases[0] - y)) / (vh + s.cases[1])));
  const yПод = (нужно) => 0.65 * 0 + (нужно * (vh + s.cases[1]) - vh + s.cases[0]);
  const yПод1 = yПод(0.65);   /* appK=1 (raw=(k-0.08)/0.57 >= 1) */
  const yПод062 = yПод(0.08 + 0.62 * 0.57);  /* затвор двери приоткрылся */
  /* акт: чья середина ближе к середине кадра */
  const акт = (y) => {
    let best = null, bd = 1e9;
    for (const id of ПОРЯД) { const b = s[id]; if (!b) continue;
      const top = b[0] - y, bot = top + b[1];
      if (bot < -80 || top > vh + 80) continue;
      const dd = Math.abs(top + b[1] / 2 - vh / 2);
      if (dd < bd) { bd = dd; best = id; } }
    return best;
  };
  const строка = (n, y) => `  ${n.padEnd(22)} y=${Math.round(y).toString().padStart(6)}  доля=${P(y).toFixed(3)}  акт=${акт(y)}`;
  console.log("── " + имя + "  vh=" + vh + "  maxS=" + maxS);
  console.log(строка("предсборка PREP", yPREP));
  console.log(строка("подход appK≈0.62", yПод062));
  console.log(строка("створки старт", yДв0));
  console.log(строка("подход appK=1", yПод1));
  console.log(строка("створки настежь", yДв1));
  console.log(строка("LOCK (тамбур)", yLOCK));
  console.log(строка("P_IN (оборот старт)", yIN));
  console.log(строка("P_TURN (оборот конец)", yTURN));
  console.log(строка("P_CON (пульт)", yCON));
  console.log(строка("дно", maxS));
  const вход = Math.max(yДв1, yПод1);
  console.log("  ВХОД в салон (rc-in-hatch) ≈ y=" + Math.round(вход) + "   акт=" + акт(вход));
  console.log("  ЗАСТОЙ вход→оборот: " + Math.round(yIN - вход) + " точек = " + ((yIN - вход) / vh).toFixed(2) + " экрана");
  console.log("  наезд камеры (enter) кончается на y=" + Math.round(вход + (yIN - yLOCK) * 0.9) + ", далее до P_IN мёртвых " + Math.round(yIN - (вход + (yIN - yLOCK) * 0.9)) + " точек");
  console.log("  оборот 360 занимает " + Math.round(yTURN - yIN) + " точек = " + ((yTURN - yIN) / vh).toFixed(2) + " экрана; на одну из 7 остановок " + Math.round((yTURN - yIN) / 7) + " точек");
  console.log("  подъезд к пульту " + Math.round(yCON - yTURN) + " точек; вопросы зажигаются на y=" + Math.round(yTURN + (yCON - yTURN) * 0.62));
  console.log("  отъезд/запал " + Math.round(maxS - yCON) + " точек, back доходит только до " + ((maxS - yCON) / (1.0001 * maxS - yCON)).toFixed(2));
  console.log("  выход назад (reverseExit) до y=" + Math.round(yLOCK + (yIN - yLOCK) * 0.12) + " — это " + (Math.round(yLOCK + (yIN - yLOCK) * 0.12) > Math.round(вход) ? "ВЫШЕ точки входа: полоса дребезга " + Math.round(yLOCK + (yIN - yLOCK) * 0.12 - вход) + " точек" : "ниже точки входа, порядок"));
  console.log("");
}
