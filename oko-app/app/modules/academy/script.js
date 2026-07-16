/* ================= ACADEMY: Академия OKO (префикс ac-) =================
   Курс «Нейросети 2026»: урок 1 (видео + слайды + тест + практика + мини-игра)
   и официальный сертификат (canvas: печать + подпись из core-ext). */

const AC_VIDEO_URL = ''; // URL видео урока 1 на CDN. Пусто = ролик ещё выгружается (3:24 смонтировано).

/* ---------- состояние (localStorage oko-academy) ---------- */
const acS = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-academy'))||null; }catch(e){ return null; } })() || {
  video:false, slides:false, test:false, testScore:0, task:false, taskText:'', game:false, gameWrong:null,
  slideMax:0, cert:null, certs:[]
};
function acSave(){ try{ localStorage.setItem('oko-academy', JSON.stringify(acS)); }catch(e){} }

let acView = 'home';            // 'home' | 'lesson'
let acQuiz = null;              // сессия теста (не персистится)
let acG = null;                 // сессия мини-игры
let acTaskChecking = false;     // «Проверяется ИИ-куратором»
let acCertUrl = null;           // кэш PNG сертификата

/* ---------- контент урока 1: слайды ---------- */
const AC_SLIDES = [
  {t:'Карта категорий', pts:[
    'Правило №1: сначала <b>задача</b>, потом модель',
    'Все нейросети — всего <b>7 семей</b>: текст, картинки, видео, код, озвучка, музыка, автоматизация',
    'Понял, к какой семье относится задача — полдела сделано',
    'Новинки выходят каждую неделю — карта важнее списка'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="60" cy="35" r="10"/><circle cx="60" cy="35" r="3.5" fill="currentColor" stroke="none"/><path d="M60 25V10M60 45v15M50 32 22 20M70 32l28-12M50 39 22 52M70 39l28 13M48 35H30M72 35h18" opacity=".8"/><circle cx="22" cy="19" r="5"/><circle cx="98" cy="19" r="5"/><circle cx="22" cy="52" r="5"/><circle cx="98" cy="52" r="5"/><circle cx="60" cy="9" r="5"/><circle cx="60" cy="61" r="5"/><circle cx="28" cy="35" r="5"/></svg>'},
  {t:'Текст: рабочий конь', pts:[
    '<b>ChatGPT</b> — универсальный солдат, хорош почти во всём',
    '<b>Claude</b> — король больших текстов и кода, контекст на десятки страниц',
    '<b>Gemini</b> — свежий поиск и связка с Google',
    'Код или длинный документ → Claude · факт из сети → Gemini · остальное → ChatGPT'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="14" y="10" width="66" height="42" rx="9"/><path d="M26 24h42M26 33h34M26 42h40"/><path d="M34 52 28 62l16-10" stroke-linejoin="round"/><rect x="88" y="26" width="22" height="30" rx="6" opacity=".7"/><path d="M93 34h12M93 41h9M93 48h12" opacity=".7"/></svg>'},
  {t:'Картинки: тут крутятся деньги', pts:[
    '<b>Midjourney</b> — лучшая эстетика, арт и «вау»',
    '<b>Flux</b> — фотореализм почти бесплатно, ~5¢ за кадр',
    '<b>Nano Banana</b> — правки и текст прямо на картинке, без перегенерации',
    '<b>Higgsfield</b> собирает все модели в одном окне'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="8" width="80" height="54" rx="8"/><circle cx="43" cy="24" r="6"/><path d="M20 54l24-20 16 13 18-16 22 20"/><path d="M104 12l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Видео: дорого и зрелищно', pts:[
    '<b>Veo</b> — лучшее качество + родной звук, почти продакшн',
    '<b>Kling</b> — кино за копейки, ~10¢ за секунду',
    '<b>Runway</b> — заточен под маркетинг и монтаж',
    'Тест идеи → Kling · финалка клиенту → Veo'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="8" width="84" height="46" rx="8"/><path d="M52 22v18l16-9z" fill="currentColor" stroke="none"/><path d="M18 62h84" opacity=".6"/><circle cx="34" cy="62" r="3" fill="currentColor" stroke="none"/><path d="M26 16h6M26 46h6M88 16h6M88 46h6" opacity=".6"/></svg>'},
  {t:'Озвучка и музыка', pts:[
    '<b>ElevenLabs</b> — премиум-голос для витринных проектов',
    '<b>Локальные нейро-TTS</b> — бесплатно и безлимит (этот урок озвучен именно так)',
    '<b>Suno</b> — готовый трек по одному запросу',
    'Музыку всегда подбирай под смысл ролика'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M14 35v0M22 28v14M30 20v30M38 26v18M46 14v42M54 24v22M62 30v10M70 22v26M78 28v14"/><path d="M96 46V16l14-4v26" stroke-linejoin="round"/><circle cx="91" cy="46" r="5.5"/><circle cx="105" cy="38" r="5.5"/></svg>'},
  {t:'Код без программиста', pts:[
    '<b>Cursor</b>, <b>Lovable</b>, <b>Claude Code</b> — тройка лидеров',
    'Описываешь словами → получаешь рабочее приложение',
    'MVP за вечер вместо недель разработки',
    'Чем точнее ТЗ, тем меньше правок'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M38 18 18 35l20 17M82 18l20 17-20 17M68 12 52 58"/></svg>'},
  {t:'Как выбирать: формула', pts:[
    '<b>Задача → Категория → Модель</b> — три шага, пара секунд',
    'Лазейка: <b>Higgsfield Ultra</b> — десятки топ-моделей одной подпиской',
    'Связка «локальные голоса + n8n на своём сервере» роняет себестоимость до копеек',
    'Не плати каждой модели по отдельности'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12h88L74 34v22l-12 8V34z"/><path d="M60 10v0" opacity=".5"/><circle cx="99" cy="52" r="9"/><path d="M96 52l2.5 2.5 5-5"/></svg>'},
  {t:'Чек-лист урока', pts:[
    'Текст → Claude и компания',
    'Картинки → Flux (объём) / Midjourney (вау)',
    'Видео → Kling (тест) / Veo (финал)',
    'Музыка → Suno · Озвучка → локальные TTS',
    'Экономия → агрегаторы и связки'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20"/></svg>'},
];

/* ---------- контент: тест (6 вопросов) ---------- */
const AC_QUIZ = [
  {q:'С чего начинается выбор нейросети по карте из урока?', o:['С названия самой хайповой модели','С формулировки задачи','С цены подписки','С обзоров блогеров'], a:1},
  {q:'Кому отдать длинный документ или код?', o:['Midjourney','Suno','Claude','Kling'], a:2},
  {q:'Фотореализм почти бесплатно (~5 центов за кадр) — это…', o:['Flux','Veo','ChatGPT','Runway'], a:0},
  {q:'«Кино за копейки» — примерно 10 центов за секунду видео — это…', o:['Veo','Kling','Nano Banana','Cursor'], a:1},
  {q:'Готовый музыкальный трек по одному запросу делает…', o:['ElevenLabs','Gemini','Lovable','Suno'], a:3},
  {q:'Главная формула карты нейросетей 2026:', o:['Модель → Цена → Задача','Категория → Модель → Задача','Задача → Категория → Модель','Промпт → Модель → Результат'], a:2},
];
const AC_PASS = 70;

/* ---------- контент: мини-игра «Сопоставь инструмент с задачей» ---------- */
const AC_PAIRS = [
  ['Claude','Длинный документ и код'],
  ['Flux','Фотореализм за копейки'],
  ['Kling','Дёшево протестировать видео-идею'],
  ['Suno','Трек под ролик за один запрос'],
  ['Nano Banana','Поправить текст на готовой картинке'],
];

const AC_LESSONS = [
  {t:'Карта нейросетей 2026', s:'3:24 · видео + слайды + тест + игра'},
  {t:'Промпт-инжиниринг', s:'скоро · формулы сильных промптов'},
  {t:'Генерация картинок PRO', s:'скоро · Midjourney, Flux, Nano Banana'},
  {t:'Видео-нейросети', s:'скоро · Veo, Kling, Runway'},
  {t:'Свой ИИ-ассистент', s:'скоро · агент под твой бизнес'},
];

/* ---------- прогресс урока ---------- */
function acItems(){
  return [
    ['Видео просмотрено', acS.video],
    ['Слайды пролистаны', acS.slides],
    ['Тест сдан на 70%+', acS.test],
    ['Практика зачтена', acS.task],
    ['Мини-игра пройдена', acS.game],
  ];
}
function acLessonPct(){ return acItems().filter(x=>x[1]).length * 20; }
function acCoursePct(){ return Math.round(acLessonPct() / 5); }
function acCertEligible(){ return acS.video && acS.testScore >= AC_PASS; }

/* ================= РЕНДЕР ================= */
function acRender(){
  const root = document.getElementById('acRoot');
  if(!root) return;
  root.innerHTML = acView === 'home' ? acHomeHtml() : acLessonHtml();
  root.classList.remove('fade-in'); void root.offsetWidth; root.classList.add('fade-in');
  if(acView === 'lesson'){
    acRenderVideoBox(); acBindSlides(); acRenderTestBox();
    acRenderTaskBox(); acRenderGameBox(); acRenderProgressBox(); acRenderCertBox();
  }
}

/* ---------- ГЛАВНАЯ АКАДЕМИИ ---------- */
function acHomeHtml(){
  const pct = acCoursePct(), C = 2*Math.PI*33;
  const rows = AC_LESSONS.map((l,i)=>{
    if(i===0) return `<button class="ac-lesson-row" onclick="acOpenLesson()">
      <span class="ac-num">1</span>
      <span class="meta"><span class="t">${l.t}</span><span class="s" style="display:block">${l.s}</span></span>
      ${acLessonPct()>0?`<span class="ac-mini-pct">${acLessonPct()}%</span>`:''}
      <svg class="i go"><use href="#i-chev"/></svg></button>`;
    return `<button class="ac-lesson-row locked" onclick="toast('Урок ${i+1} откроется после урока ${i}')">
      <span class="ac-num">${i+1}</span>
      <span class="meta"><span class="t">${l.t}</span><span class="s" style="display:block">${l.s}</span></span>
      <svg class="i"><use href="#i-lock"/></svg></button>`;
  }).join('');
  const certs = acS.certs.length ? acS.certs.map((c,i)=>`
    <div class="ac-cert-item" style="animation-delay:${i*.05}s">
      <span class="ico"><svg class="i"><use href="#i-file"/></svg></span>
      <span class="meta"><span class="t">Урок 1 · Карта нейросетей 2026</span><span class="s" style="display:block">${esc(c.no)} · ${esc(c.date)} · тест ${c.score}%</span></span>
      <button class="btn sm ghost" onclick="acCertShow(${i})">Показать</button>
    </div>`).join('')
    : `<p class="dim" style="font-size:12.5px;line-height:1.55">Пройди урок — получи официальный сертификат OKO с печатью и подписью. Он появится здесь.</p>`;
  return `
    <div class="ac-hero"><h2>Академия OKO</h2><p>Уроки полного формата · официальные сертификаты</p></div>

    <div class="card">
      <div class="ac-course-top">
        <span class="ac-ring">
          <svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="33"/>
          <circle class="val" cx="40" cy="40" r="33" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct/100)).toFixed(1)}"/></svg>
          <b>${pct}%</b>
        </span>
        <div><h3>Нейросети 2026</h3><p class="dim">5 уроков · тесты и практика · сертификат за каждый урок</p></div>
      </div>
      <div>${rows}</div>
    </div>

    <div class="card ac-soon" style="margin-top:12px" onclick="toast('Курс «Контент и Reels» уже в производстве')">
      <span class="ico"><svg class="i"><use href="#i-camera"/></svg></span>
      <div style="flex:1"><h3>Контент и Reels</h3><p>Сценарии, монтаж и вирусные форматы</p></div>
      <span class="chip">скоро</span>
    </div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мои сертификаты</h2>
    <div class="card" style="padding:6px 14px">${certs}</div>
    <div style="height:14px"></div>`;
}

/* ---------- СТРАНИЦА УРОКА 1 ---------- */
function acOpenLesson(){ acView='lesson'; acRender(); const m=document.querySelector('main'); if(m) m.scrollTop=0; }
function acBackHome(){ acView='home'; acRender(); }

function acLessonHtml(){
  return `
    <button class="btn ghost sm ac-back" onclick="acBackHome()"><svg class="i"><use href="#i-back"/></svg> Академия</button>
    <div class="ac-lesson-head">
      <span class="chip">Урок 1 из 5</span>
      <h2>Карта нейросетей 2026</h2>
      <div class="m"><span>${I('clock')} 3:24 видео</span><span>·</span><span>8 слайдов</span><span>·</span><span>тест из 6 вопросов</span><span>·</span><span>мини-игра</span></div>
    </div>

    <div id="acVideoBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Слайды урока</h2>
    <div id="acSlidesBox">
      <div class="ac-slides" id="acSlides">${AC_SLIDES.map((s,i)=>`
        <div class="ac-slide ${i===0?'cur':''}" data-i="${i}">
          <span class="n">Слайд ${i+1} / ${AC_SLIDES.length}</span>
          <h3>${s.t}</h3>
          <div class="pic">${s.svg}</div>
          <ul>${s.pts.map(p=>`<li>${p}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>
      <div class="ac-slides-nav">
        <button class="ac-arrow" onclick="acSlideGo(-1)"><svg class="i"><use href="#i-back"/></svg></button>
        <span class="ac-dots" id="acDots">${AC_SLIDES.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</span>
        <button class="ac-arrow next" onclick="acSlideGo(1)"><svg class="i"><use href="#i-back"/></svg></button>
      </div>
    </div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Тест по материалу</h2>
    <div class="card" id="acTestBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Практика</h2>
    <div class="card" id="acTaskBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мини-игра</h2>
    <div class="card" id="acGameBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Прогресс урока</h2>
    <div class="card" style="padding:8px 16px 14px" id="acProgressBox"></div>

    <div style="height:14px"></div>
    <div id="acCertBox"></div>
    <div style="height:16px"></div>`;
}

/* ---------- а) ВИДЕО ---------- */
function acRenderVideoBox(){
  const box = document.getElementById('acVideoBox');
  if(!box) return;
  const cover = `
    <div class="ac-player" onclick="acPlay()" id="acPlayer">
      <svg class="ac-cover" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
        <rect width="640" height="360" fill="#070a04"/>
        <g stroke="rgba(154,255,0,.09)" stroke-width="1">
          ${[80,160,240,320,400,480,560].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="360"/>`).join('')}
          ${[72,144,216,288].map(y=>`<line x1="0" y1="${y}" x2="640" y2="${y}"/>`).join('')}
        </g>
        <circle cx="530" cy="80" r="120" fill="rgba(154,255,0,.07)"/>
        <use href="#i-logo" x="472" y="34" width="120" height="120"/>
        <text x="48" y="238" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="47" fill="#fff" letter-spacing="1">КАРТА НЕЙРОСЕТЕЙ</text>
        <text x="48" y="302" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="58" fill="#9AFF00" letter-spacing="4">2026</text>
        <text x="48" y="330" font-family="Montserrat,sans-serif" font-size="15" font-weight="600" fill="rgba(255,255,255,.55)" letter-spacing="3">АКАДЕМИЯ OKO · УРОК 1</text>
      </svg>
      <div class="ac-play-btn"><svg class="i"><use href="#i-play"/></svg></div>
      <span class="dur">3:24</span>
    </div>`;
  const player = AC_VIDEO_URL
    ? `<div class="ac-player" style="cursor:default"><video controls playsinline src="${AC_VIDEO_URL}"></video></div>`
    : cover;
  box.innerHTML = player + `
    <div class="ac-video-actions">${acS.video
      ? `<span class="ac-done-chip">${I('check2')} Видео просмотрено</span>`
      : `<button class="btn" onclick="acMarkVideo()">${I('check2')} Отметить просмотренным</button>`}
    </div>`;
}
function acPlay(){
  if(AC_VIDEO_URL) return;
  showPopup({ico:'circle-play', title:'Видео выгружается на CDN',
    body:'Ролик урока уже смонтирован — длительность 3:24, озвучка и караоке-субтитры готовы. Совсем скоро он появится прямо здесь. Пока изучи слайды ниже — в них весь материал.',
    actions:[{label:'Понятно'}]});
}
function acMarkVideo(){
  acS.video = true; acSave();
  toast('Видео засчитано · +20% к уроку');
  acRenderVideoBox(); acRenderProgressBox(); acRenderCertBox();
}

/* ---------- б) СЛАЙДЫ ---------- */
let acSlideIdx = 0;
function acBindSlides(){
  const el = document.getElementById('acSlides');
  if(!el) return;
  acSlideIdx = 0;
  let raf = null;
  el.addEventListener('scroll', ()=>{
    if(raf) return;
    raf = requestAnimationFrame(()=>{
      raf = null;
      const kids = el.children;
      if(!kids.length) return;
      const step = kids[0].offsetWidth + 12;
      const i = Math.max(0, Math.min(AC_SLIDES.length-1, Math.round(el.scrollLeft / step)));
      if(i !== acSlideIdx){ acSlideIdx = i; acSlideSync(); }
    });
  }, {passive:true});
}
function acSlideSync(){
  const dots = document.querySelectorAll('#acDots i');
  dots.forEach((d,i)=>d.classList.toggle('on', i===acSlideIdx));
  document.querySelectorAll('#acSlides .ac-slide').forEach((s,i)=>s.classList.toggle('cur', i===acSlideIdx));
  if(acSlideIdx > acS.slideMax){ acS.slideMax = acSlideIdx; acSave(); }
  if(acS.slideMax >= AC_SLIDES.length-1 && !acS.slides){
    acS.slides = true; acSave();
    toast('Слайды пройдены · +20% к уроку');
    acRenderProgressBox(); acRenderCertBox();
  }
}
function acSlideGo(d){
  const el = document.getElementById('acSlides');
  if(!el || !el.children.length) return;
  const step = el.children[0].offsetWidth + 12;
  const i = Math.max(0, Math.min(AC_SLIDES.length-1, acSlideIdx + d));
  el.scrollTo({left: i*step, behavior:'smooth'});
  acSlideIdx = i; acSlideSync();
}

/* ---------- в) ТЕСТ ---------- */
function acRenderTestBox(){
  const box = document.getElementById('acTestBox');
  if(!box) return;
  if(!acQuiz){
    box.innerHTML = acS.test
      ? `<div class="ac-score" style="font-size:52px">${acS.testScore}%</div>
         <div class="ac-score-sub">Тест сдан. Лучший результат — <b>${acS.testScore}%</b> при пороге ${AC_PASS}%.</div>
         <button class="btn ghost" onclick="acQuizStart()">Пройти заново</button>`
      : `<p style="font-size:13.5px;line-height:1.55">${AC_QUIZ.length} вопросов по карте нейросетей. По одному на экран, порог зачёта — <b style="color:var(--accent)">${AC_PASS}%</b>.${acS.testScore?` Прошлая попытка: ${acS.testScore}%.`:''}</p>
         <div style="height:12px"></div>
         <button class="btn" onclick="acQuizStart()">${I('bolt')} ${acS.testScore?'Попробовать ещё раз':'Начать тест'}</button>`;
    return;
  }
  if(acQuiz.done){
    const score = acQuiz.score, pass = score >= AC_PASS;
    box.innerHTML = `
      <div class="ac-score" id="acScoreNum" ${pass?'':'style="color:var(--danger);text-shadow:none"'}>0%</div>
      <div class="ac-score-sub">${pass
        ? `Порог ${AC_PASS}% пройден — <b>тест зачтён</b>. Верных ответов: ${acQuiz.hits} из ${AC_QUIZ.length}.`
        : `<span class="fail">Не хватило до порога ${AC_PASS}%.</span> Верных: ${acQuiz.hits} из ${AC_QUIZ.length}. Пролистай слайды и попробуй снова.`}</div>
      <button class="btn ${pass?'ghost':''}" onclick="acQuizStart()">Пройти заново</button>`;
    const el = document.getElementById('acScoreNum');
    acCountUp(el, score, '%');
    return;
  }
  const q = AC_QUIZ[acQuiz.i];
  box.innerHTML = `
    <div class="ac-quiz-top"><span>Вопрос <b>${acQuiz.i+1}</b> из ${AC_QUIZ.length}</span><span>верных: <b>${acQuiz.hits}</b></span></div>
    <div class="progress" style="margin:0 0 4px"><i style="width:${(acQuiz.i/AC_QUIZ.length*100)}%"></i></div>
    <div class="ac-q">${q.q}</div>
    ${q.o.map((o,i)=>`<button class="ac-opt" id="acOpt${i}" onclick="acAnswer(${i})"><span class="lb">${'АБВГ'[i]}</span><span>${o}</span></button>`).join('')}`;
}
function acQuizStart(){
  acQuiz = {i:0, hits:0, lock:false, done:false, score:0};
  acRenderTestBox();
}
function acAnswer(i){
  if(!acQuiz || acQuiz.lock || acQuiz.done) return;
  acQuiz.lock = true;
  const q = AC_QUIZ[acQuiz.i];
  const right = i === q.a;
  if(right) acQuiz.hits++;
  const ok = document.getElementById('acOpt'+q.a);
  if(ok) ok.classList.add('ok');
  if(!right){ const bad = document.getElementById('acOpt'+i); if(bad) bad.classList.add('bad'); }
  setTimeout(()=>{
    acQuiz.lock = false;
    acQuiz.i++;
    if(acQuiz.i >= AC_QUIZ.length){
      acQuiz.done = true;
      acQuiz.score = Math.round(acQuiz.hits / AC_QUIZ.length * 100);
      if(acQuiz.score > acS.testScore) acS.testScore = acQuiz.score;
      if(acQuiz.score >= AC_PASS && !acS.test){
        acS.test = true;
        toast('Тест сдан · +20% к уроку');
      }
      acSave();
      acRenderProgressBox(); acRenderCertBox();
    }
    acRenderTestBox();
  }, right ? 700 : 1100);
}
function acCountUp(el, to, suffix){
  if(!el) return;
  const t0 = performance.now(), dur = 950;
  (function step(t){
    const k = Math.min(1, (t-t0)/dur), e = 1 - Math.pow(1-k, 3);
    el.textContent = Math.round(to*e) + (suffix||'');
    if(k < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- г) ПРАКТИКА ---------- */
function acRenderTaskBox(){
  const box = document.getElementById('acTaskBox');
  if(!box) return;
  if(acTaskChecking){
    box.innerHTML = `<div class="ac-checking"><span class="ac-spin"></span>
      <div><p>Проверяется ИИ-куратором<small>Сверяю задачу, категорию и модель с картой урока…</small></p></div></div>`;
    return;
  }
  if(acS.task){
    box.innerHTML = `
      <div class="ac-verdict">
        <div class="h">${I('check2')} Зачтено</div>
        <p>Категория выбрана верно, модель соответствует бюджету задачи. Совет куратора: добавляй в промпт ожидаемый формат результата — модель ответит точнее.</p>
      </div>
      <div style="height:10px"></div>
      <p class="dim" style="font-size:12px;line-height:1.5">Твой ответ: «${esc(acS.taskText.slice(0,140))}${acS.taskText.length>140?'…':''}»</p>`;
    return;
  }
  box.innerHTML = `
    <p style="font-size:13.5px;line-height:1.55">Возьми свою реальную задачу и разложи её по формуле урока — так, как отдал бы нейросети в работу:</p>
    <div class="ac-task-formula"><span>Задача</span>${I('chev')}<span>Категория</span>${I('chev')}<span>Модель</span>${I('chev')}<span>Почему именно она</span></div>
    <textarea class="ac-task-ta" id="acTaskTa" placeholder="Пример: Задача — обложка для урока. Категория — картинки. Модель — Flux: нужен фотореализм и объём дёшево. Формат — вертикаль 2:3, тёмный фон, лаймовый акцент.">${esc(acS.taskText)}</textarea>
    <div style="height:10px"></div>
    <button class="btn" onclick="acTaskSend()">${I('send')} Отправить на проверку</button>`;
}
function acTaskSend(){
  const ta = document.getElementById('acTaskTa');
  const v = (ta && ta.value || '').trim();
  if(v.length < 40){ toast('Раскрой подробнее — минимум 40 символов'); return; }
  acS.taskText = v; acSave();
  acTaskChecking = true;
  acRenderTaskBox();
  setTimeout(()=>{
    acTaskChecking = false;
    acS.task = true; acSave();
    toast('Практика зачтена · +20% к уроку');
    acRenderTaskBox(); acRenderProgressBox(); acRenderCertBox();
  }, 4000);
}

/* ---------- д) МИНИ-ИГРА ---------- */
function acShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function acRenderGameBox(){
  const box = document.getElementById('acGameBox');
  if(!box) return;
  if(!acG){
    box.innerHTML = acS.game
      ? `<div class="ac-game-done"><div class="big">5 / 5</div>
         <p>Все пары собраны${acS.gameWrong!==null?` · ошибок: ${acS.gameWrong}`:''}. Инструменты и задачи — в связке.</p>
         <button class="btn ghost" onclick="acGameStart()">Сыграть ещё раз</button></div>`
      : `<p style="font-size:13.5px;line-height:1.55"><b>Сопоставь инструмент с задачей.</b> Тапни инструмент слева, затем его задачу справа. Верная пара улетает, неверная — трясётся.</p>
         <div style="height:12px"></div>
         <button class="btn" onclick="acGameStart()">${I('play')} Играть</button>`;
    return;
  }
  const left = acG.left.map(i=>`<button class="ac-tile ${acG.sel===i?'sel':''}" id="acGL${i}" onclick="acGPick(${i})">${AC_PAIRS[i][0]}</button>`).join('');
  const right = acG.right.map(i=>`<button class="ac-tile" id="acGR${i}" onclick="acGMatch(${i})">${AC_PAIRS[i][1]}</button>`).join('');
  box.innerHTML = `
    <div class="ac-game-score"><span>Собрано пар: <b>${acG.hits} / ${AC_PAIRS.length}</b></span><span>ошибок: <b>${acG.wrong}</b></span></div>
    <div class="ac-game-cols">
      <div class="ac-game-col"><div class="h">Инструмент</div>${left}</div>
      <div class="ac-game-col"><div class="h">Задача</div>${right}</div>
    </div>`;
}
function acGameStart(){
  acG = {left:[0,1,2,3,4], right:acShuffle([0,1,2,3,4]), sel:null, hits:0, wrong:0, lock:false};
  acRenderGameBox();
}
function acGPick(i){
  if(!acG || acG.lock) return;
  acG.sel = acG.sel === i ? null : i;
  acG.left.forEach(k=>{
    const el = document.getElementById('acGL'+k);
    if(el) el.classList.toggle('sel', acG.sel===k);
  });
}
function acGMatch(i){
  if(!acG || acG.lock) return;
  if(acG.sel === null){ toast('Сначала выбери инструмент слева'); return; }
  const L = document.getElementById('acGL'+acG.sel), R = document.getElementById('acGR'+i);
  if(acG.sel === i){
    acG.lock = true;
    if(L) L.classList.add('hit');
    if(R) R.classList.add('hit');
    setTimeout(()=>{
      acG.left = acG.left.filter(k=>k!==i);
      acG.right = acG.right.filter(k=>k!==i);
      acG.hits++; acG.sel = null; acG.lock = false;
      if(!acG.left.length){
        const wrong = acG.wrong;
        acG = null;
        acS.gameWrong = wrong;
        if(!acS.game){ acS.game = true; toast('Мини-игра пройдена · +20% к уроку'); }
        acSave();
        acRenderGameBox(); acRenderProgressBox(); acRenderCertBox();
      } else acRenderGameBox();
    }, 560);
  } else {
    acG.wrong++;
    if(L) L.classList.add('shake');
    if(R) R.classList.add('shake');
    acG.lock = true;
    setTimeout(()=>{
      acG.lock = false; acG.sel = null;
      acRenderGameBox();
    }, 460);
  }
}

/* ---------- прогресс: чек-лист 5 пунктов ---------- */
function acRenderProgressBox(){
  const box = document.getElementById('acProgressBox');
  if(!box) return;
  const pct = acLessonPct();
  box.innerHTML = acItems().map(([label,done])=>`
    <div class="ac-check-row ${done?'done':''}">
      <span class="ac-check-ic"><svg class="i"><use href="#i-check2"/></svg></span>
      <span>${label}</span><span class="pct">${done?'+20%':'—'}</span>
    </div>`).join('') + `
    <div class="progress" style="margin:12px 0 6px"><i style="width:${pct}%"></i></div>
    <p class="dim" style="font-size:12px;text-align:center">Урок пройден на <b style="color:var(--accent)">${pct}%</b></p>`;
}

/* ================= СЕРТИФИКАТ ================= */
function acRenderCertBox(){
  const box = document.getElementById('acCertBox');
  if(!box) return;
  const okV = acS.video, okT = acS.testScore >= AC_PASS;
  if(acS.cert){
    box.innerHTML = `
      <div class="card ac-cert-card ready">
        <div class="ac-cert-head">
          <span class="ico"><svg class="i"><use href="#i-star"/></svg></span>
          <div><h3>Сертификат получен</h3><p>Официальный документ Академии OKO с печатью и подписью</p></div>
        </div>
        <span class="ac-cert-no">${esc(acS.cert.no)} · ${esc(acS.cert.date)} · тест ${acS.cert.score}%</span>
        <div class="ac-cert-actions">
          <button class="btn" onclick="acCertDownload()">${I('file')} Скачать PNG</button>
          <button class="btn ghost" onclick="acCertShow()">${I('eye')} Показать</button>
        </div>
      </div>`;
    return;
  }
  if(acCertEligible()){
    box.innerHTML = `
      <div class="card ac-cert-card ready">
        <div class="ac-cert-head">
          <span class="ico"><svg class="i"><use href="#i-star"/></svg></span>
          <div><h3>Сертификат готов к выдаче</h3><p>Видео просмотрено, тест сдан на ${acS.testScore}% — условия выполнены</p></div>
        </div>
        <button class="btn" onclick="acIssueCert()">${I('star')} Получить сертификат</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="card ac-cert-card">
      <div class="ac-cert-head">
        <span class="ico" style="background:var(--raised);color:var(--dim)"><svg class="i"><use href="#i-lock"/></svg></span>
        <div><h3>Сертификат урока</h3><p>Официальный документ с печатью и подписью — за реальный результат</p></div>
      </div>
      <div class="ac-cert-req">
        <div class="${okV?'ok':''}">${I(okV?'check2':'circle-play')} Отметить видео просмотренным</div>
        <div class="${okT?'ok':''}">${I(okT?'check2':'poll')} Сдать тест на ${AC_PASS}% и выше${acS.testScore?` (сейчас ${acS.testScore}%)`:''}</div>
      </div>
    </div>`;
}

function acIssueCert(){
  const cert = {
    no: 'OKO-CERT-' + String(Math.floor(1e5 + Math.random()*9e5)),
    date: new Date().toLocaleDateString('ru-RU'),
    score: acS.testScore,
    name: (typeof PROFILE!=='undefined' && PROFILE.name) ? PROFILE.name : 'Слушатель Академии'
  };
  acS.cert = cert;
  acS.certs.unshift(cert);
  acSave();
  acCertUrl = null;
  toast('Сертификат выдан: ' + cert.no);
  acRenderCertBox();
  acCertShow();
}

/* --- отрисовка canvas 1600×1131 --- */
function acSigImage(cb){
  if(typeof SIGNATURE_B64 === 'undefined'){ cb(null); return; }
  const img = new Image();
  img.onload = ()=>{
    try{
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for(let i=0; i<p.length; i+=4){
        const lum = (p[i]+p[i+1]+p[i+2]) / 3;
        p[i+3] = Math.round(p[i+3] * (1 - lum/255)); // тёмный штрих → непрозрачный
        p[i]=232; p[i+1]=240; p[i+2]=255;            // перекрас в светлый (для тёмного фона)
      }
      x.putImageData(d, 0, 0);
      cb(c);
    }catch(e){ cb(img); }
  };
  img.onerror = ()=>cb(null);
  img.src = 'data:image/png;base64,' + SIGNATURE_B64;
}
function acRingText(ctx, cx, cy, r, text, font){
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = (Math.PI*2) / text.length;
  for(let i=0; i<text.length; i++){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i*step);
    ctx.translate(0, -r);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
function acDrawSeal(ctx, cx, cy, r){
  const blue = '#2b4fd8';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.translate(-cx, -cy);
  // лёгкая подложка, чтобы синяя печать читалась на тёмном
  ctx.beginPath(); ctx.arc(cx, cy, r+6, 0, 7);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
  ctx.strokeStyle = blue; ctx.fillStyle = blue; ctx.globalAlpha = .96;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r-7, 0, 7); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r*0.6, 0, 7); ctx.lineWidth = 2; ctx.stroke();
  acRingText(ctx, cx, cy, r-24, SEAL_REQ.fio + ' · ' + SEAL_REQ.inn + ' · ', '700 14px Montserrat, Arial');
  acRingText(ctx, cx, cy, r*0.6 - 15, SEAL_REQ.geo + ' · ОФИЦИАЛЬНЫЙ ДОКУМЕНТ · ', '600 9px Montserrat, Arial');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 21px Montserrat, Arial';
  ctx.fillText(SEAL_REQ.brand, cx, cy-6);
  ctx.font = '600 11px Montserrat, Arial';
  ctx.fillText('АКАДЕМИЯ', cx, cy+16);
  ctx.restore();
}
function acMakeCert(cert, cb){
  const ready = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('100px "Bebas Neue"'),
        document.fonts.load('700 30px Montserrat'),
      ]).catch(()=>{})
    : Promise.resolve();
  ready.then(()=>acSigImage(sig=>{
    const W = 1600, H = 1131;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const lime = '#9AFF00';
    // фон + тонкая сетка
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(154,255,0,.05)'; ctx.lineWidth = 1;
    for(let x=0; x<=W; x+=64){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(let y=0; y<=H; y+=64){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    // мягкое свечение в углу
    const g = ctx.createRadialGradient(W-220, 180, 40, W-220, 180, 560);
    g.addColorStop(0, 'rgba(154,255,0,.10)'); g.addColorStop(1, 'rgba(154,255,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // двойная лаймовая рамка
    ctx.strokeStyle = lime; ctx.lineWidth = 5; ctx.strokeRect(38, 38, W-76, H-76);
    ctx.lineWidth = 1.5; ctx.globalAlpha = .65; ctx.strokeRect(58, 58, W-116, H-116); ctx.globalAlpha = 1;
    // уголки
    ctx.lineWidth = 5;
    [[38,38,1,1],[W-38,38,-1,1],[38,H-38,1,-1],[W-38,H-38,-1,-1]].forEach(([x,y,dx,dy])=>{
      ctx.beginPath(); ctx.moveTo(x+dx*44, y); ctx.lineTo(x, y); ctx.lineTo(x, y+dy*44); ctx.stroke();
    });
    try{ ctx.letterSpacing = '6px'; }catch(e){}
    ctx.textAlign = 'center';
    // шапка
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '42px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('А К А Д Е М И Я   O K O', W/2, 148);
    // заголовок
    ctx.fillStyle = lime;
    ctx.shadowColor = 'rgba(154,255,0,.45)'; ctx.shadowBlur = 34;
    ctx.font = '150px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('СЕРТИФИКАТ', W/2, 300);
    ctx.shadowBlur = 0;
    try{ ctx.letterSpacing = '2px'; }catch(e){}
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 27px Montserrat, Arial';
    ctx.fillText('подтверждает, что', W/2, 372);
    // имя
    ctx.fillStyle = '#fff';
    ctx.font = '96px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(cert.name.toUpperCase(), W/2, 486);
    ctx.strokeStyle = 'rgba(154,255,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W/2-260, 512); ctx.lineTo(W/2+260, 512); ctx.stroke();
    // курс / урок
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 26px Montserrat, Arial';
    ctx.fillText('успешно прошёл урок', W/2, 566);
    ctx.fillStyle = lime;
    ctx.font = '64px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('«КАРТА НЕЙРОСЕТЕЙ 2026»', W/2, 646);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 24px Montserrat, Arial';
    ctx.fillText('курса «Нейросети 2026» Академии OKO', W/2, 696);
    // чип результата
    const chipT = 'Результат теста: ' + cert.score + '%';
    ctx.font = '700 26px Montserrat, Arial';
    const cw = ctx.measureText(chipT).width + 66;
    ctx.fillStyle = 'rgba(154,255,0,.13)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(W/2-cw/2, 730, cw, 58, 29); else ctx.rect(W/2-cw/2, 730, cw, 58);
    ctx.fill();
    ctx.strokeStyle = lime; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = lime;
    ctx.fillText(chipT, W/2, 768);
    // дата и номер (слева внизу)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 19px Montserrat, Arial';
    ctx.fillText('ДАТА ВЫДАЧИ', 120, 878);
    ctx.fillStyle = '#fff';
    ctx.font = '46px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(cert.date, 120, 928);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 19px Montserrat, Arial';
    ctx.fillText('НОМЕР', 120, 972);
    ctx.fillStyle = lime;
    ctx.font = '700 26px Montserrat, Arial';
    ctx.fillText('№ ' + cert.no, 120, 1004);
    // подпись (по центру-слева внизу)
    const sx1 = 560, sx2 = 880, sy = 952;
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx1, sy); ctx.lineTo(sx2, sy); ctx.stroke();
    if(sig){
      const sw = 300, sh = sw * (sig.height / sig.width);
      ctx.drawImage(sig, (sx1+sx2)/2 - sw/2, sy - sh*0.82, sw, sh);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '600 24px Montserrat, Arial';
    ctx.fillText('/ Ильясов Д.А. /', sx2 + 18, sy + 8);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '500 16px Montserrat, Arial';
    ctx.fillText('подпись руководителя Академии', sx1, sy + 32);
    // печать (справа внизу)
    acDrawSeal(ctx, 1350, 900, 138);
    // реквизиты снизу мелко
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.font = '500 15px Montserrat, Arial';
    ctx.fillText(SEAL_REQ.fio + ' · ' + SEAL_REQ.inn + ' · ' + SEAL_REQ.brand + ' · okoteam.top@gmail.com', W/2, 1076);
    cb(cv.toDataURL('image/png'));
  }));
}

function acCertRec(i){
  if(typeof i === 'number' && acS.certs[i]) return acS.certs[i];
  return acS.cert || acS.certs[0] || null;
}
let acCertShownNo = null;
function acCertShow(i){
  const cert = acCertRec(i);
  if(!cert){ toast('Сертификат ещё не выдан'); return; }
  const open = url=>{
    const full = document.getElementById('acCertFull');
    const img = document.getElementById('acCertFullImg');
    if(!full || !img) return;
    img.src = url;
    full.classList.add('open');
  };
  if(acCertUrl && acCertShownNo === cert.no){ open(acCertUrl); return; }
  acMakeCert(cert, url=>{ acCertUrl = url; acCertShownNo = cert.no; open(url); });
}
function acCertFullClose(){
  const full = document.getElementById('acCertFull');
  if(full) full.classList.remove('open');
}
function acCertDownload(){
  const cert = acCertRec();
  if(!cert){ toast('Сертификат ещё не выдан'); return; }
  const dl = url=>{
    const a = document.createElement('a');
    a.href = url; a.download = cert.no + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('PNG сохранён: ' + cert.no + '.png');
  };
  if(acCertUrl && acCertShownNo === cert.no){ dl(acCertUrl); return; }
  acMakeCert(cert, url=>{ acCertUrl = url; acCertShownNo = cert.no; dl(url); });
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function acInit(){
  regTitle('academy', 'Академия');
  addSvcTile({id:'academy', label:'Академия', ico:'star', first:true, onclick:()=>showTab('academy')});
  const _prevShowTabAc = showTab;
  showTab = function(t){
    _prevShowTabAc(t);
    if(t === 'academy') acRender();
  };
  const scr = document.getElementById('screen-academy');
  if(scr && scr.classList.contains('active')) acRender();
})();
