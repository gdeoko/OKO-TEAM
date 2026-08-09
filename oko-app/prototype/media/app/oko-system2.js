/* ============================================================================
   OKO · oko-system2.js — СИСТЕМА РОСТА и МОИ СОЦСЕТИ «готово к запуску»
   ----------------------------------------------------------------------------
   Слой поверх ядра (index.html). Ядро не переписывается: здесь только
   переопределения глобальных функций и мутации существующих справочников.

   ЧТО БЫЛО СЛОМАНО В ЯДРЕ
   -----------------------
   СИСТЕМА РОСТА (префикс a / sys):

   1. anketaFinish() рисовал экран «Анкета принята, команда OKO приступила»,
      пять этапов работы живых людей («Аналитик изучает твою нишу ~40 минут»,
      «Копирайтер пишет контент-план ~2 часа») и обещание «Готовность 4–6
      часов, придёт уведомление в приложение и Telegram». Ни одна строка
      анкеты никуда не отправлялась: rec складывался в localStorage и всё.
      Человек закрывал приложение и ждал письма, которого не будет.

   2. sysHomeHtml() показывал «Персональная ссылка okoteam.top/s/sys_xxxxxx»
      с кнопкой «Копировать». Ссылка вела в никуда — slug генерировался
      Math.random() в браузере, на сервере такой страницы нет. Кнопка
      «Скачать PDF» показывала тост «Готовим ссылку и PDF, команда закончит
      через 4–6 часов» и не делала ничего.

   3. Бизнес-план (sysBizBlocks) выдавался как персональный, а был жёстко
      зашитым текстом с выдуманными деньгами: таблица «М1 — 8 клиентов,
      79 200 ₽ прихода, 61 200 ₽ прибыли», «М3 — 372 500 ₽», линейка
      продуктов «19 900 ₽ / 149 000 ₽» и экономика клуба «М12 — 870 000 ₽
      MRR». Ответы человека про выручку, средний чек и цель в этих числах
      не участвовали вообще.

   4. Перспективы (sysFutureBlocks / sysFutureHtml) — прогноз «М12: 2.5M,
      М24: 6M+», план найма с окладами, «регистрация в Дубае 0% налога»,
      «доход 300k–1M ₽/мес пассивно к М18». Выдуманный прогноз чужой
      выручки, поданный как расчёт по анкете.

   5. Темы контента (SYS_ARCH_TOPICS) содержали выдуманные кейсы, которые
      человеку предлагалось снять как свои: «вышел на 250 000 ₽ за 21 день»,
      «+438% к выручке в цифрах», «как мы вернули 180 000 ₽ за неделю»,
      «Отзывы 5 клиентов: реальные цифры за 90 дней». Тексты постов и
      каруселей утверждали «Проверено на 47 клиентах» и «97% тратят 3 часа».
      Это готовая ложь от имени пользователя его же аудитории.

   6. Модалка дня писала: «Реальный анализ 15 конкурентов ниши, бренд-визуал
      под клиента и клон голоса подключаются после отправки анкеты (команда
      OKO собирает за 4-6 часов)» — того же несуществующего обещания.

   7. SYS_SHOOT_LABEL = {live:'(эмодзи) Живьём в кадре', ai:'(эмодзи) Аватар
      HeyGen', ...} — эмодзи в интерфейсе, запрещены правилами бренда. Ещё
      эмодзи были в теле TG-поста, каруселей и сторис.

   8. Анкета не сохраняла черновик. Человек отвечал на 37 вопросов, случайно
      выходил из мини-аппа — openMa('system') сбрасывал aState в пустой
      объект, и всё пропадало. Валидации по типу поля не было: в «выручку»
      принималось любое слово, дата и HEX-цвета не проверялись.

   9. Экран выбора режима обещал «Полная · 37 вопросов», хотя реальная длина
      считается из ANKETA_ALL с условными вопросами и почти всегда другая.

   МОИ СОЦСЕТИ (префикс socials в index.html + psSoc в app.js):

   10. socialsConnect() спрашивал ник через нативный prompt() и после этого
       карточка писала «подключено», а шапка — «N из 6 площадок подключено».
       Никакого подключения не происходило: ник лежал в localStorage. Тост
       «Instagram привязан» — прямая ложь.

   11. Кнопка «Автопостинг: ВКЛ» переключала булев флаг в localStorage и
       говорила «Автопостинг включён». Ни один пост никуда не уходит.

   12. Подпись «Ключи храним зашифрованными, никогда не отдаём третьим» —
       никаких ключей приложение не хранит и хранить не умеет.

   13. Подпись «Полная привязка через OAuth активируется 1 августа» — дата
       выдумана и уже прошла.

   14. Число подписчиков вводилось руками и показывалось как метрика
       площадки («@nick · 4800 подписчиков») наравне с реальными данными.

   15. Второй экран «Мои соцсети» (psSoc* в app.js), который открывается из
       профиля, был полностью демонстрационным: PS_SOC.conn по умолчанию
       {ig:true, tt:true, vk:true, tg:true} — четыре «подключённые» сети у
       любого нового человека; хендлы предзаполнены 'ktodaniel';
       psSocFollowers() выдавал детерминированно «нарисованные» 4 800 /
       12 400 / 6 300 подписчиков; в расписании лежали два выдуманных поста
       («удержание +18% на 30к охвате»); в агрегаторе ссылок — три чужие
       ссылки okoteam.top/@ktodaniel.

   ЧТО ДЕЛАЕТ ЭТОТ СЛОЙ
   --------------------
   Анкета:
     • черновик пишется в localStorage на каждое изменение, при возврате
       предлагается «Продолжить» или «Начать заново» — с показом, сколько
       ответов уже есть и когда сохранено;
     • реальные счётчики вопросов в выборе режима, номера блоков в шапке
       вопроса, прогресс «N из M» и полоса;
     • валидация по типу: число только неотрицательное число, дата не в
       прошлом веке, HEX-цвета проверяются, текст обязательных полей не
       пустой — ошибка показывается под полем, а не тостом «ответь»;
     • «Назад» работает на каждом шаге, «Сохранить и выйти» — тоже;
     • вопрос переносится по словам и не обрезается ни на 360, ни на 1440.

   Результат анкеты:
     • честный экран: план собран здесь же, в браузере, из ответов; никуда
       не отправлен; перечислено, что именно посчитано из ответов, а что
       требует сервера OKO и какого доступа не хватает;
     • «Скачать план» — настоящий файл .txt из ответов человека;
     • публичной ссылки нет, пока плана нет на сервере, — так и написано.

   Бизнес-план и перспективы:
     • блоки строятся из ответов. Есть число — считается арифметика с
       показанной формулой. Нет числа — блок честно говорит, какого ответа
       не хватает, и даёт кнопку вернуться в анкету;
     • ни одного выдуманного конкурента, охвата, чека и прогноза рынка.

   Мои соцсети:
     • пять карточек (Telegram, Instagram, YouTube, TikTok, VK). У каждой:
       что даст подключение, какой именно доступ или ключ нужен, и статус
       «Не подключено» — потому что OAuth-ключей у приложения нет;
     • Telegram показан отдельно и правдиво: если приложение открыто внутри
       Telegram, initData подтверждает вход, и это единственное, что реально
       работает. Прямо сказано, что вход в приложение — не доступ к каналу;
     • ручные ссылки на свои профили сохраняются локально и отдаются в
       визитку (общий список ссылок профиля), с честной пометкой, что это
       ссылка, а не подключение;
     • psSocOpen() из профиля ведёт на этот же честный экран, а выдуманные
       значения PS_SOC (подключённые сети, чужие хендлы, нарисованные
       подписчики, выдуманное расписание) вычищаются при старте.
   ========================================================================== */
(function(){
  'use strict';

  /* ===================== 0. УТИЛИТЫ ===================== */

  function E(t){
    var d = document.createElement('div');
    d.textContent = (t === null || t === undefined) ? '' : String(t);
    return d.innerHTML;
  }
  function ico(name){
    return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }
  function T(msg){
    try{ if(typeof toast === 'function'){ toast(msg); return; } }catch(e){}
  }
  function lsGet(k, def){
    try{
      var v = localStorage.getItem(k);
      return v === null ? def : JSON.parse(v);
    }catch(e){ return def; }
  }
  function lsSet(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
  }
  /* Число из ответа анкеты. Возвращает null, если ответа нет или он не число —
     чтобы дальше НИЧЕГО не считать и честно сказать «нет данных». */
  function num(v){
    if(v === null || v === undefined) return null;
    var s = String(v).replace(/\s+/g,'').replace(/,/g,'.').replace(/₽|руб\.?/gi,'');
    if(s === '') return null;
    var n = Number(s);
    if(!isFinite(n)) return null;
    return n;
  }
  /* Деньги в рублях без «NaN ₽» и без «Infinity».
     Разряды и знак валюты отделяются НЕРАЗРЫВНЫМ пробелом ( ), иначе
     сумма рвётся на перенос строки посреди числа на узких экранах. */
  var NB = ' ';
  function money(n){
    if(n === null || n === undefined || !isFinite(n)) return null;
    var r = Math.round(n);
    return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
  }
  function intOrNull(n){
    if(n === null || n === undefined || !isFinite(n)) return null;
    return Math.max(0, Math.round(n));
  }
  function txt(v){
    if(v === null || v === undefined) return '';
    if(Array.isArray(v)) return v.join(', ');
    return String(v).trim();
  }

  /* ===================== 1. СТИЛИ ===================== */

  var CSS = [
'/* ---- OKO system2: анкета ---- */',
'.sy2-pick{display:flex;flex-direction:column;gap:10px}',
'.sy2-pick-h{font-weight:800;font-size:16px;line-height:1.3;margin-bottom:4px}',
'.sy2-pick-p{color:var(--dim);font-size:12.5px;line-height:1.55;margin-bottom:12px}',
'.sy2-mode{display:flex;align-items:center;gap:12px;width:100%;text-align:left;',
'  background:var(--raised);border:1px solid var(--border);border-radius:var(--r-md);',
'  padding:14px 14px;color:var(--text);cursor:pointer;position:relative}',
'.sy2-mode:hover{border-color:var(--lime)}',
'.sy2-mode > div{flex:1;min-width:0}',
'.sy2-mode b{display:block;font-size:14px;line-height:1.35;margin-bottom:3px;overflow-wrap:break-word}',
'.sy2-mode small{display:block;color:var(--dim);font-size:11.5px;line-height:1.5;overflow-wrap:break-word}',
'.sy2-mode .i{width:18px;height:18px;flex:0 0 18px;stroke:var(--dim)}',
'.sy2-mode.on{border-color:var(--lime);box-shadow:inset 0 0 0 1px var(--lime)}',
'.sy2-badge{position:absolute;top:-8px;right:12px;background:var(--lime);color:#000;',
'  font-size:9.5px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:99px;text-transform:uppercase}',
'.sy2-draft{border:1px solid var(--lime);border-radius:var(--r-md);padding:12px;',
'  background:var(--lime-dim);margin-bottom:14px}',
'.sy2-draft b{display:block;font-size:13px;margin-bottom:4px;line-height:1.35}',
'.sy2-draft small{display:block;color:var(--dim);font-size:11.5px;line-height:1.5;margin-bottom:10px}',
'.sy2-draft-row{display:flex;gap:8px;flex-wrap:wrap}',
'.sy2-draft-row .btn{flex:1 1 130px;min-width:0}',
'.sy2-qhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}',
'.sy2-qblock{color:var(--dim);font-size:10.5px;font-weight:700;letter-spacing:.06em;',
'  text-transform:uppercase;line-height:1.4;overflow-wrap:break-word;min-width:0}',
'.sy2-qcount{color:var(--lime);font-size:11px;font-weight:800;white-space:nowrap;flex:0 0 auto}',
'.sy2-q{font-weight:800;font-size:16px;line-height:1.32;margin-bottom:6px;',
'  overflow-wrap:break-word;hyphens:auto;-webkit-hyphens:auto}',
'.sy2-hint{color:var(--dim);font-size:12.5px;line-height:1.55;margin-bottom:14px;overflow-wrap:break-word}',
'.sy2-err{display:block;color:var(--danger);font-size:12px;line-height:1.45;margin-top:8px;overflow-wrap:break-word}',
'.sy2-nav{display:flex;gap:10px;margin-top:18px}',
'.sy2-nav .btn{min-width:0}',
'.sy2-exit{display:block;width:100%;margin-top:10px;background:none;border:0;color:var(--dim);',
'  font-size:12px;font-family:inherit;cursor:pointer;padding:8px;text-decoration:underline;text-underline-offset:3px}',
'.sy2-exit:hover{color:var(--text)}',
'.sy2-files{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
'.sy2-file{display:inline-block;max-width:100%;background:var(--raised);border:1px solid var(--border);',
'  border-radius:99px;padding:5px 10px;font-size:11px;color:var(--dim);overflow-wrap:break-word}',
'.sy2-slider{padding:4px 0}',
'.sy2-slider input[type=range]{width:100%;accent-color:var(--lime)}',
'.sy2-slider-v{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:6px;flex-wrap:wrap}',
'.sy2-slider-v b{font-size:15px}',
'.sy2-lim{font-size:11px;line-height:1.45;color:var(--dim);overflow-wrap:break-word}',
'.sy2-lim.over{color:var(--danger)}',
'.sy2-lim.ok{color:var(--lime)}',
'/* ---- OKO system2: честные блоки ---- */',
'.sy2-honest{border:1px solid var(--border);border-left:3px solid var(--lime);border-radius:var(--r-sm);',
'  background:var(--raised);padding:12px 13px;margin:12px 0}',
'.sy2-honest b{display:block;font-size:13px;line-height:1.4;margin-bottom:6px;overflow-wrap:break-word}',
'.sy2-honest p{color:var(--dim);font-size:12px;line-height:1.6;overflow-wrap:break-word}',
'.sy2-honest p + p{margin-top:7px}',
'.sy2-list{list-style:none;margin:8px 0 0;padding:0}',
'.sy2-list li{position:relative;padding-left:16px;color:var(--dim);font-size:12px;',
'  line-height:1.6;margin-bottom:5px;overflow-wrap:break-word}',
'.sy2-list li:before{content:"";position:absolute;left:2px;top:8px;width:5px;height:5px;',
'  border-radius:50%;background:var(--lime)}',
'.sy2-list li.no:before{background:var(--dim)}',
'.sy2-done{display:flex;flex-direction:column;gap:0}',
'.sy2-done-h{display:flex;align-items:center;gap:12px;margin-bottom:14px}',
'.sy2-done-ic{flex:0 0 44px;width:44px;height:44px;border-radius:14px;background:var(--lime-dim);',
'  display:flex;align-items:center;justify-content:center}',
'.sy2-done-ic .i{width:22px;height:22px;stroke:var(--lime)}',
'.sy2-done-h b{display:block;font-size:15px;line-height:1.32;overflow-wrap:break-word}',
'.sy2-done-h small{display:block;color:var(--dim);font-size:12px;line-height:1.5;margin-top:3px;overflow-wrap:break-word}',
'.sy2-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin:12px 0}',
'.sy2-sum div{background:var(--raised);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px}',
'.sy2-sum b{display:block;font-size:17px;line-height:1.2;overflow-wrap:break-word}',
'.sy2-sum small{display:block;color:var(--dim);font-size:10.5px;line-height:1.4;margin-top:3px;overflow-wrap:break-word}',
'.sy2-btns{display:flex;flex-direction:column;gap:8px;margin-top:14px}',
'/* ---- OKO system2: мои соцсети ---- */',
'.sy2-soc-hero{border:1px solid var(--border);border-radius:var(--r-md);background:var(--raised);',
'  padding:14px;margin-bottom:14px}',
'.sy2-soc-hero b{display:block;font-size:14.5px;line-height:1.35;margin-bottom:6px;overflow-wrap:break-word}',
'.sy2-soc-hero p{color:var(--dim);font-size:12px;line-height:1.6;overflow-wrap:break-word}',
'.sy2-soc-hero p + p{margin-top:8px}',
'/* Подвал модалки блока в ядре: обе кнопки перелистывания получали от .btn',
'   ширину 100% и flex-shrink:0, из-за чего «вперёд» уезжала за правый край',
'   экрана на всех размерах. Возвращаем им собственную ширину. */',
'.sys-blk-foot{align-items:center}',
'.sys-blk-foot > .btn.ghost:first-child,',
'.sys-blk-foot > .btn.ghost:last-child{width:auto;flex:0 0 auto;min-width:56px;max-width:96px;justify-content:center}',
'.sys-blk-foot-mid{flex:1 1 auto;min-width:0}',
'.sys-blk-foot-mid .btn{width:100%}',
'/* Кнопка «к разделам» не должна попадать под шапку окна плана. */',
'#systemView .sv-back{position:relative;z-index:3}',
'.sy2-soc-tg{border:1px solid var(--lime);border-radius:var(--r-md);background:var(--lime-dim);',
'  padding:13px;margin-bottom:14px;display:flex;gap:11px;align-items:flex-start}',
'.sy2-soc-tg .i{width:19px;height:19px;flex:0 0 19px;stroke:var(--lime);margin-top:2px}',
'.sy2-soc-tg b{display:block;font-size:13px;line-height:1.4;margin-bottom:4px;overflow-wrap:break-word}',
'.sy2-soc-tg small{display:block;color:var(--dim);font-size:11.5px;line-height:1.55;overflow-wrap:break-word}',
'.sy2-card{border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface);',
'  padding:13px;margin-bottom:10px}',
'.sy2-card-h{display:flex;align-items:flex-start;gap:11px;margin-bottom:10px}',
'.sy2-card-ic{flex:0 0 38px;width:38px;height:38px;border-radius:11px;background:var(--raised);',
'  border:1px solid var(--border);display:flex;align-items:center;justify-content:center}',
'.sy2-card-ic .i{width:19px;height:19px;stroke:var(--text)}',
'.sy2-card-t{flex:1;min-width:0}',
'.sy2-card-t b{display:block;font-size:14px;line-height:1.35;overflow-wrap:break-word}',
'.sy2-card-t small{display:block;color:var(--dim);font-size:11.5px;line-height:1.5;margin-top:2px;overflow-wrap:break-word}',
'.sy2-st{flex:0 0 auto;font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;',
'  padding:4px 8px;border-radius:99px;border:1px solid var(--border);color:var(--dim);white-space:nowrap;align-self:flex-start}',
'.sy2-st.on{border-color:var(--lime);color:var(--lime)}',
'.sy2-kv{margin-bottom:9px}',
'.sy2-kv span{display:block;color:var(--lime);font-size:10.5px;font-weight:800;letter-spacing:.05em;',
'  text-transform:uppercase;margin-bottom:3px}',
'.sy2-kv p{color:var(--dim);font-size:12px;line-height:1.6;overflow-wrap:break-word}',
'.sy2-link-row{display:flex;gap:8px;align-items:stretch;margin-top:10px;flex-wrap:wrap}',
'.sy2-link-row input{flex:1 1 160px;min-width:0;background:var(--bg);border:1px solid var(--border);',
'  border-radius:var(--r-sm);color:var(--text);font-family:inherit;font-size:13px;padding:10px 11px}',
'.sy2-link-row input:focus{outline:none;border-color:var(--lime)}',
'.sy2-link-row .btn{flex:0 0 auto}',
'.sy2-saved{display:flex;align-items:center;gap:8px;margin-top:9px;padding:9px 11px;',
'  border:1px solid var(--border);border-radius:var(--r-sm);background:var(--raised)}',
'.sy2-saved a{flex:1;min-width:0;color:var(--lime);font-size:12px;line-height:1.45;',
'  text-decoration:none;overflow-wrap:break-word}',
'.sy2-saved button{flex:0 0 auto;background:none;border:0;padding:6px;cursor:pointer}',
'.sy2-saved button .i{width:15px;height:15px;stroke:var(--dim)}',
'.sy2-saved button:hover .i{stroke:var(--danger)}',
'.sy2-note{color:var(--dim);font-size:11.5px;line-height:1.6;margin-top:14px;',
'  text-align:left;overflow-wrap:break-word}',
'@media (max-width:380px){',
'  .sy2-q{font-size:15px}',
'  .sy2-sum{grid-template-columns:repeat(2,1fr)}',
'}'
  ].join('\n');

  (function injectCss(){
    var s = document.createElement('style');
    s.id = 'oko-system2-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  })();

  /* ===================== 2. АНКЕТА ===================== */

  var DRAFT_KEY = 'oko-anketa-draft';

  /* Названия блоков — по порядку ключей в ANKETA_ALL ядра. Ключ → блок.
     Ядро блоки не подписывало, из-за чего 37 вопросов шли сплошной лентой. */
  var BLOCKS = {
    who:'О тебе', niche:'О тебе', geo:'О тебе', exp:'О тебе', mission:'О тебе',
    products:'Продукты', main_product:'Продукты', avg_check:'Продукты',
    audience:'Аудитория', pains:'Аудитория', objections:'Аудитория',
    revenue:'Финансы', goal_income:'Финансы', goal_subs:'Финансы', budget:'Финансы',
    platforms:'Площадки', subs_now:'Площадки', main_platform:'Площадки',
    reels_per_day:'Объём контента', tg_per_day:'Объём контента',
    carousels_per_month:'Объём контента', stories_per_day:'Объём контента',
    youtube_long_per_week:'Объём контента',
    on_camera:'Формат и стиль', voice:'Формат и стиль', tone:'Формат и стиль',
    colors:'Формат и стиль', refs:'Формат и стиль',
    logo:'Материалы', brandbook:'Материалы', scripts:'Материалы',
    contract_sample:'Материалы', requisites:'Материалы',
    competitors:'Конкуренты', compet_depth:'Конкуренты',
    start_date:'Технические', contacts:'Технические', code_words:'Технические'
  };

  function ALL(){
    try{ return (typeof ANKETA_ALL !== 'undefined' && ANKETA_ALL) || []; }catch(e){ return []; }
  }
  function ST(){
    try{ return (typeof aState !== 'undefined' && aState) || null; }catch(e){ return null; }
  }
  function setST(v){
    try{ aState = v; }catch(e){}
  }
  function countFast(){
    return ALL().filter(function(q){ return q.fast; }).length;
  }
  function countFull(){
    /* Полная анкета без условных вопросов — минимум; условные добавляются
       по ходу. Показываем «от N» вместо выдуманного фиксированного числа. */
    return ALL().filter(function(q){ return !q.condShow; }).length;
  }

  /* ---- черновик ---- */
  function draftSave(){
    var s = ST(); if(!s || s.step < 0 || s.mode === '__pick') return;
    lsSet(DRAFT_KEY, {mode:s.mode, step:s.step, answers:s.answers || {}, at:Date.now()});
  }
  function draftRead(){
    var d = lsGet(DRAFT_KEY, null);
    if(!d || !d.answers || typeof d.answers !== 'object') return null;
    var filled = Object.keys(d.answers).filter(function(k){
      var v = d.answers[k];
      if(Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && String(v).trim() !== '';
    }).length;
    if(!filled) return null;
    d.filled = filled;
    return d;
  }
  function draftClear(){
    try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
  }
  function whenStr(ts){
    if(!ts) return 'недавно';
    var diff = Date.now() - ts;
    if(diff < 60000) return 'меньше минуты назад';
    var m = Math.floor(diff / 60000);
    if(m < 60) return m + ' мин назад';
    var h = Math.floor(m / 60);
    if(h < 24) return h + ' ч назад';
    return new Date(ts).toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
  }

  /* ---- валидация ---- */
  /* Возвращает строку с ошибкой либо '' — ошибку показываем под полем,
     а не тостом «Ответь, чтобы продолжить», который не говорит, что не так. */
  function validate(q, v){
    var required = !!(q.fast || q.opts || q.multi);
    var empty = q.multi
      ? !(Array.isArray(v) && v.length)
      : (v === null || v === undefined || String(v).trim() === '');
    if(empty) return required ? 'Без этого ответа система не соберётся. Ответь, пожалуйста.' : '';
    if(q.number){
      var n = num(v);
      if(n === null) return 'Нужно число. Без букв, пробелов и знака валюты.';
      if(n < 0) return 'Число не может быть отрицательным.';
      if(n > 1e12) return 'Слишком большое число — проверь, не лишний ли нолик.';
    }
    if(q.date){
      var d = new Date(String(v));
      if(isNaN(d.getTime())) return 'Дата не распозналась. Выбери её в календаре.';
      var y = d.getFullYear();
      if(y < 2000 || y > 2100) return 'Проверь год — он выглядит опечаткой.';
    }
    if(q.k === 'colors'){
      var hexes = String(v).match(/#[0-9a-fA-F]{3,8}/g) || [];
      var bad = String(v).trim() !== '' && hexes.length === 0;
      if(bad) return 'Цвета пишутся в формате #9AFF00. Или оставь поле пустым — подберём под нишу.';
    }
    return '';
  }

  /* ---- рендер ---- */
  function barSet(pct){
    var b = document.getElementById('anketaBar');
    if(b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function pickHtml(){
    var d = draftRead();
    var fast = countFast(), full = countFull();
    var h = '';
    h += '<span class="chip">Персональная система роста</span>';
    h += '<div style="height:14px"></div>';
    if(d){
      var modeName = d.mode === 'full' ? 'полную' : 'быструю';
      h += '<div class="sy2-draft">'
         +   '<b>Есть незаконченный черновик</b>'
         +   '<small>Ты проходил ' + modeName + ' анкету, ответов сохранено: ' + d.filled
         +     '. Последнее изменение — ' + E(whenStr(d.at)) + '. Черновик лежит только в этом браузере.</small>'
         +   '<div class="sy2-draft-row">'
         +     '<button class="btn" onclick="sys2DraftResume()">' + ico('play') + ' Продолжить</button>'
         +     '<button class="btn ghost" onclick="sys2DraftDrop()">' + ico('trash') + ' Удалить черновик</button>'
         +   '</div>'
         + '</div>';
    }
    h += '<p class="sy2-pick-h">Выбери режим анкеты</p>';
    h += '<p class="sy2-pick-p">Система собирается из твоих ответов прямо в приложении. '
       + 'Чем больше ответов — тем меньше в плане общих мест.</p>';
    h += '<div class="sy2-pick">';
    h += '<button class="sy2-mode" onclick="sys2Start(\'fast\')">'
       +   '<div><b>Быстрая · ' + fast + ' ' + plural(fast, 'вопрос','вопроса','вопросов') + '</b>'
       +   '<small>Около трёх минут. Хватит на контент-план и расчёт нагрузки.</small></div>'
       +   ico('chev') + '</button>';
    h += '<button class="sy2-mode" onclick="sys2Start(\'full\')">'
       +   '<span class="sy2-badge">Точнее</span>'
       +   '<div><b>Полная · от ' + full + ' ' + plural(full, 'вопроса','вопросов','вопросов') + '</b>'
       +   '<small>15–20 минут. Добавляются деньги, аудитория, площадки и материалы. '
       +   'Часть вопросов появляется только под твои площадки, поэтому точное число зависит от ответов.</small></div>'
       +   ico('chev') + '</button>';
    h += '</div>';
    h += '<div class="sy2-honest"><b>Что важно знать заранее</b>'
       + '<p>План считается на твоём устройстве и остаётся на нём. Кнопка «Собрать систему» '
       + 'ничего не отправляет в OKO — серверная часть пока не подключена.</p>'
       + '<p>Файлы, которые ты приложишь, не загружаются: сохраняются только их имена, '
       + 'чтобы ты помнил, что готово, а что нет.</p></div>';
    return h;
  }

  function plural(n, one, few, many){
    var n10 = n % 10, n100 = n % 100;
    if(n10 === 1 && n100 !== 11) return one;
    if(n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  function fieldHtml(q, val){
    var k = q.k;
    if(q.text){
      return '<input id="aInput" type="text" placeholder="Напиши здесь" value="' + E(val || '') + '"'
           + ' oninput="sys2Set(\'' + k + '\', this.value)">';
    }
    if(q.textarea){
      return '<textarea id="aInput" rows="4" placeholder="Напиши здесь"'
           + ' oninput="sys2Set(\'' + k + '\', this.value)">' + E(val || '') + '</textarea>';
    }
    if(q.number){
      return '<input id="aInput" type="number" inputmode="numeric" min="0" placeholder="0"'
           + ' value="' + E(val === null || val === undefined ? '' : val) + '"'
           + ' oninput="sys2Set(\'' + k + '\', this.value)">';
    }
    if(q.date){
      var dv = val || new Date().toISOString().slice(0,10);
      if(!val) setAnswer(k, dv);
      return '<input id="aInput" type="date" value="' + E(dv) + '"'
           + ' oninput="sys2Set(\'' + k + '\', this.value)">';
    }
    if(q.files){
      var files = Array.isArray(val) ? val : [];
      var h = '<input type="file" id="aInputFile" accept="' + E(q.accept || '*/*') + '" multiple'
            + ' style="display:none" onchange="sys2Files(\'' + k + '\', event)">'
            + '<button class="btn ghost" style="width:100%" onclick="document.getElementById(\'aInputFile\').click()">'
            + ico('file') + ' ' + (files.length ? 'Выбрано файлов: ' + files.length : 'Выбрать файлы (по желанию)')
            + '</button>';
      if(files.length){
        h += '<div class="sy2-files">' + files.map(function(f){
          return '<span class="sy2-file">' + E(f.name) + ' · ' + Math.max(1, Math.round(f.size/1024)) + ' КБ</span>';
        }).join('') + '</div>'
        + '<p class="sy2-note">Файлы остаются на телефоне. В приложение записаны только имена и размеры — '
        + 'загрузка появится вместе с сервером OKO.</p>';
      }
      return h;
    }
    if(q.slider){
      var cur = (val === null || val === undefined || val === '') ? q.slider.min : Number(val);
      if(!isFinite(cur)) cur = q.slider.min;
      if(val === null || val === undefined || val === '') setAnswer(k, cur);
      return '<div class="sy2-slider">'
           +   '<input type="range" min="' + q.slider.min + '" max="' + q.slider.max + '"'
           +     ' step="' + q.slider.step + '" value="' + cur + '"'
           +     ' oninput="sys2Slide(\'' + k + '\', this.value, \'' + E(q.slider.unit) + '\')">'
           +   '<div class="sy2-slider-v"><b id="aSlV_' + k + '">' + cur + ' ' + E(q.slider.unit) + '</b>'
           +     '<span class="sy2-lim" id="aLim_' + k + '"></span></div>'
           + '</div>';
    }
    if(q.multi){
      return '<div class="opts opts-multi">' + (q.opts || []).map(function(o, i){
        var on = Array.isArray(val) && val.indexOf(o) >= 0;
        return '<button class="opt' + (on ? ' on' : '') + '" onclick="sys2Multi(\'' + k + '\', ' + i + ', this)">'
             + E(o) + '</button>';
      }).join('') + '</div>';
    }
    return '<div class="opts">' + (q.opts || []).map(function(o, i){
      return '<button class="opt' + (val === o ? ' on' : '') + '" onclick="sys2Pick(\'' + k + '\', ' + i + ', this)">'
           + E(o) + '</button>';
    }).join('') + '</div>';
  }

  function setAnswer(k, v){
    var s = ST(); if(!s) return;
    if(!s.answers) s.answers = {};
    s.answers[k] = v;
  }

  function renderAnketa2(){
    var s = ST();
    var card = document.getElementById('anketaCard');
    if(!card) return;
    if(!s){ setST({mode:'__pick', step:-1, answers:{}, order:[]}); s = ST(); }

    if(s.step === -1 || s.mode === '__pick'){
      barSet(0);
      card.innerHTML = pickHtml();
      return;
    }
    if(!s.order || !s.order.length) buildOrder();
    var total = s.order.length;
    if(!total){ barSet(0); card.innerHTML = pickHtml(); return; }
    if(s.step >= total){ finish(); return; }

    var q = s.order[s.step];
    var val = s.answers[q.k];
    barSet(Math.round(s.step / total * 100));

    var block = BLOCKS[q.k] || 'Анкета';
    var modeLabel = s.mode === 'fast' ? 'Быстрая' : 'Полная';
    var required = !!(q.fast || q.opts || q.multi);

    var h = '';
    h += '<div class="sy2-qhead">'
       +   '<span class="sy2-qblock">' + E(modeLabel) + ' · ' + E(block)
       +     (required ? '' : ' · можно пропустить') + '</span>'
       +   '<span class="sy2-qcount">' + (s.step + 1) + ' / ' + total + '</span>'
       + '</div>';
    h += '<p class="sy2-q">' + E(q.q) + '</p>';
    h += '<p class="sy2-hint">' + E(q.hint || '') + '</p>';
    h += fieldHtml(q, val);
    h += '<span class="sy2-err" id="aErr" hidden></span>';
    h += '<div class="sy2-nav">'
       +   (s.step > 0
            ? '<button class="btn ghost" style="flex:1" onclick="sys2Prev()">' + ico('back') + ' Назад</button>'
            : '')
       +   '<button class="btn" style="flex:2" onclick="sys2Next()">'
       +     (s.step === total - 1 ? 'Собрать план' : 'Далее') + '</button>'
       + '</div>';
    h += '<button class="sy2-exit" onclick="sys2SaveExit()">Сохранить черновик и выйти</button>';
    card.innerHTML = h;

    if(q.slider) limitHint(q.k, s.answers[q.k]);
  }

  function buildOrder(){
    var s = ST(); if(!s) return;
    var a = s.answers || {};
    s.order = ALL().filter(function(q){
      return s.mode === 'full' || q.fast;
    }).filter(function(q){
      if(!q.condShow) return true;
      try{ return !!q.condShow(a); }catch(e){ return false; }
    });
  }

  function limitHint(k, v){
    var el = document.getElementById('aLim_' + k);
    if(!el) return;
    var tier = 'FREE';
    try{ if(typeof okoTier === 'function') tier = okoTier(); }catch(e){}
    var caps = {
      reels_per_day:        {FREE:0, START:1, PRO:1, BUSINESS:2, BUSINESS_PRO:4, MAX:10},
      tg_per_day:           {FREE:0, START:1, PRO:1, BUSINESS:1, BUSINESS_PRO:2, MAX:4},
      carousels_per_month:  {FREE:0, START:0, PRO:4, BUSINESS:5, BUSINESS_PRO:8, MAX:15},
      stories_per_day:      {FREE:1, START:2, PRO:5, BUSINESS:10, BUSINESS_PRO:15, MAX:15},
      youtube_long_per_week:{FREE:0, START:0, PRO:1, BUSINESS:2, BUSINESS_PRO:3, MAX:5}
    }[k];
    if(!caps){ el.textContent = ''; return; }
    var limit = caps[tier] != null ? caps[tier] : 0;
    var n = Number(v) || 0;
    if(n > limit){
      el.className = 'sy2-lim over';
      el.textContent = 'Тариф «' + tier + '» покрывает ' + limit + '. Остальное — апгрейд или своими руками.';
    } else {
      el.className = 'sy2-lim ok';
      el.textContent = 'В рамках тарифа «' + tier + '»';
    }
  }

  /* ---- публичные обработчики анкеты ---- */
  window.sys2Set = function(k, v){ setAnswer(k, v); draftSave(); hideErr(); };
  window.sys2Slide = function(k, v, unit){
    setAnswer(k, Number(v));
    var el = document.getElementById('aSlV_' + k);
    if(el) el.textContent = v + ' ' + unit;
    limitHint(k, Number(v));
    draftSave();
  };
  window.sys2Pick = function(k, i, btn){
    var s = ST(); if(!s) return;
    var q = s.order[s.step]; if(!q) return;
    setAnswer(k, q.opts[i]);
    if(btn && btn.parentElement){
      var sib = btn.parentElement.querySelectorAll('.opt');
      for(var j = 0; j < sib.length; j++) sib[j].classList.remove('on');
    }
    if(btn) btn.classList.add('on');
    hideErr(); draftSave();
  };
  window.sys2Multi = function(k, i, btn){
    var s = ST(); if(!s) return;
    var q = s.order[s.step]; if(!q) return;
    var val = q.opts[i];
    if(!Array.isArray(s.answers[k])) s.answers[k] = [];
    var arr = s.answers[k], at = arr.indexOf(val);
    if(at >= 0) arr.splice(at, 1); else arr.push(val);
    if(btn) btn.classList.toggle('on');
    hideErr(); draftSave();
  };
  window.sys2Files = function(k, ev){
    var fs = [];
    try{
      var list = (ev && ev.target && ev.target.files) || [];
      for(var i = 0; i < list.length; i++){
        fs.push({name:list[i].name, size:list[i].size, type:list[i].type});
      }
    }catch(e){}
    setAnswer(k, fs); draftSave(); renderAnketa2();
  };
  window.sys2Next = function(){
    var s = ST(); if(!s) return;
    var q = s.order[s.step]; if(!q) return;
    var err = validate(q, s.answers[q.k]);
    if(err){ showErr(err); return; }
    s.step++;
    buildOrder();
    draftSave();
    renderAnketa2();
  };
  window.sys2Prev = function(){
    var s = ST(); if(!s) return;
    if(s.step > 0){ s.step--; draftSave(); renderAnketa2(); }
    else { setST({mode:'__pick', step:-1, answers:s.answers, order:[]}); renderAnketa2(); }
  };
  window.sys2Start = function(mode){
    draftClear();
    setST({mode:mode, step:0, answers:{}, order:[]});
    buildOrder();
    renderAnketa2();
  };
  window.sys2DraftResume = function(){
    var d = draftRead(); if(!d){ renderAnketa2(); return; }
    setST({mode:d.mode || 'fast', step:d.step || 0, answers:d.answers || {}, order:[]});
    buildOrder();
    var s = ST();
    if(s.step >= s.order.length) s.step = Math.max(0, s.order.length - 1);
    renderAnketa2();
  };
  window.sys2DraftDrop = function(){
    draftClear();
    setST({mode:'__pick', step:-1, answers:{}, order:[]});
    renderAnketa2();
    T('Черновик удалён');
  };
  window.sys2SaveExit = function(){
    draftSave();
    T('Черновик сохранён на этом устройстве');
    try{ if(typeof closeMa === 'function') closeMa(); }catch(e){}
  };
  function showErr(m){
    var el = document.getElementById('aErr');
    if(!el) return;
    el.textContent = m; el.hidden = false;
  }
  function hideErr(){
    var el = document.getElementById('aErr');
    if(el){ el.hidden = true; el.textContent = ''; }
  }

  /* ---- финал анкеты: честно ---- */
  function answeredCount(a){
    return Object.keys(a || {}).filter(function(k){
      var v = a[k];
      if(Array.isArray(v)) return v.length > 0;
      return v !== null && v !== undefined && String(v).trim() !== '';
    }).length;
  }

  function finish(){
    var s = ST(); if(!s) return;
    var a = s.answers || {};
    barSet(100);
    var card = document.getElementById('anketaCard');
    if(!card) return;

    /* Сохраняем анкету как локальную запись. Никаких «команда приступила»:
       статус честный — план собран локально, на сервер не отправлен. */
    try{
      var saved = lsGet('oko-systems', []);
      if(!Array.isArray(saved)) saved = [];
      var rec = {
        id:'sys_' + Date.now(), mode:s.mode, answers:a,
        status:'local_only', createdAt:Date.now()
      };
      saved.unshift(rec);
      lsSet('oko-systems', saved.slice(0, 20));
      s.recId = rec.id;
    }catch(e){}
    draftClear();

    var rpd = num(a.reels_per_day) || 0;
    var tpd = num(a.tg_per_day) || 0;
    var cpm = num(a.carousels_per_month) || 0;
    var spd = num(a.stories_per_day) || 0;
    var perMonth = intOrNull(rpd*30 + tpd*30 + cpm + spd*30) || 0;

    var built = [];
    built.push('Календарь на 30 дней — из выставленного тобой объёма контента');
    if(txt(a.niche)) built.push('Позиционирование и темы — из ниши «' + txt(a.niche) + '»');
    if(txt(a.audience)) built.push('Портрет аудитории и язык обращения — из твоего описания клиента');
    if(num(a.goal_income) !== null) built.push('Разрыв до цели по выручке — арифметика из твоих чисел');
    if(Array.isArray(a.platforms) && a.platforms.length) built.push('Раскладка по площадкам: ' + a.platforms.join(', '));
    if(txt(a.tone) || txt(a.on_camera)) built.push('Формат съёмки и тон — из ответов про кадр и стиль');

    var needServer = [
      'Разбор конкурентов. Нужен доступ к API площадок или парсер на сервере OKO — в браузере их каталог не собрать.',
      'Средние охваты и ER по нише. Это внешние данные, приложение их не выдумывает.',
      'Аналитика твоих аккаунтов. Появится вместе с подключением соцсетей — сейчас подключений нет.',
      'Хранение плана и ссылка на него. Пока план живёт только в этом браузере.'
    ];

    var h = '';
    h += '<div class="sy2-done">';
    h += '<div class="sy2-done-h">'
       +   '<span class="sy2-done-ic">' + ico('check2') + '</span>'
       +   '<div><b>План собран из твоих ответов</b>'
       +   '<small>Ответов учтено: ' + answeredCount(a) + '. Всё посчитано здесь, в приложении. '
       +   'Никуда не отправлено.</small></div>'
       + '</div>';

    h += '<div class="sy2-sum">'
       +   '<div><b>' + perMonth + '</b><small>единиц контента в месяц</small></div>'
       +   '<div><b>' + (Array.isArray(a.platforms) ? a.platforms.length : 0) + '</b><small>площадок в работе</small></div>'
       +   '<div><b>' + answeredCount(a) + '</b><small>ответов в основе</small></div>'
       + '</div>';

    h += '<div class="sy2-honest"><b>Что здесь действительно посчитано</b><ul class="sy2-list">'
       + built.map(function(x){ return '<li>' + E(x) + '</li>'; }).join('')
       + '</ul></div>';

    h += '<div class="sy2-honest"><b>Чего в плане нет и почему</b><ul class="sy2-list">'
       + needServer.map(function(x){ return '<li class="no">' + E(x) + '</li>'; }).join('')
       + '</ul><p>Как только у приложения появится адрес сервера OKO и ключи площадок, эти пункты '
       + 'посчитаются по-настоящему. До тех пор приложение их не рисует.</p></div>';

    h += '<div class="sy2-btns">'
       +   '<button class="btn" onclick="openSystemPreview()">' + ico('compass') + ' Открыть план</button>'
       +   '<button class="btn ghost" onclick="sys2Download()">' + ico('download') + ' Скачать план файлом</button>'
       +   '<button class="btn ghost" onclick="sys2Restart()">' + ico('refresh') + ' Пройти анкету заново</button>'
       + '</div>';
    h += '</div>';
    card.innerHTML = h;
  }

  window.sys2Restart = function(){
    setST({mode:'__pick', step:-1, answers:{}, order:[]});
    renderAnketa2();
  };

  /* Настоящий файл из настоящих ответов — не «PDF придёт через 4–6 часов». */
  window.sys2Download = function(){
    var s = ST(); if(!s) return;
    var a = s.answers || {};
    var lines = [];
    lines.push('СИСТЕМА РОСТА OKO — черновик плана');
    lines.push('Собран в приложении ' + new Date().toLocaleString('ru-RU'));
    lines.push('Источник: только твои ответы в анкете. Внешних данных в файле нет.');
    lines.push('');
    lines.push('=== ОТВЕТЫ АНКЕТЫ ===');
    ALL().forEach(function(q){
      var v = a[q.k];
      if(v === null || v === undefined) return;
      if(Array.isArray(v)){
        if(!v.length) return;
        v = v.map(function(x){ return (x && x.name) ? x.name : x; }).join(', ');
      }
      if(String(v).trim() === '') return;
      lines.push(q.q + ': ' + v);
    });
    lines.push('');
    lines.push('=== ОБЪЁМ КОНТЕНТА В МЕСЯЦ ===');
    var rpd = num(a.reels_per_day) || 0, tpd = num(a.tg_per_day) || 0;
    var cpm = num(a.carousels_per_month) || 0, spd = num(a.stories_per_day) || 0;
    lines.push('Роликов: ' + rpd * 30);
    lines.push('TG-постов: ' + tpd * 30);
    lines.push('Каруселей: ' + cpm);
    lines.push('Сторис: ' + spd * 30);
    lines.push('');
    lines.push('=== ЧЕГО В ФАЙЛЕ НЕТ ===');
    lines.push('Конкуренты, охваты по нише и аналитика аккаунтов сюда не попали:');
    lines.push('приложение не подключено к серверу OKO и к API площадок, а придумывать');
    lines.push('такие цифры оно не станет.');
    var blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'oko-plan-' + new Date().toISOString().slice(0,10) + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    T('Файл плана сохранён');
  };

  /* ===================== 3. ПЛАН: ЧЕСТНЫЕ РАЗДЕЛЫ ===================== */

  function hasAnswers(){
    var s = ST();
    return !!(s && s.answers && answeredCount(s.answers) > 0);
  }

  /* Титульный экран плана: без выдуманной публичной ссылки и без «PDF». */
  function homeHtml2(a){
    var platforms = Array.isArray(a.platforms) && a.platforms.length ? a.platforms.join(' · ') : 'площадки не выбраны';
    var secs = [];
    try{ secs = (typeof SYS_SECTIONS !== 'undefined' && SYS_SECTIONS) || []; }catch(e){}
    var h = '';
    h += '<div class="sys-hero">'
       +   '<div class="sys-badge">' + ico('compass') + '</div>'
       +   '<h2>Система роста</h2>'
       +   '<p>' + E(txt(a.who) || 'Профиль не указан') + ' · ниша «' + E(txt(a.niche) || 'не указана') + '» · ' + E(platforms) + '</p>'
       + '</div>';
    h += '<div class="sy2-honest"><b>Откуда взялся этот план</b>'
       + '<p>Всё, что ниже, посчитано из ' + answeredCount(a) + ' твоих ответов прямо в браузере. '
       + 'Разделы с методикой (чек-лист, материалы, визуал) — это шаблоны OKO, они одинаковые для всех '
       + 'и подписаны как шаблоны.</p>'
       + '<p>Публичной ссылки на план нет: чтобы её выдать, план должен лежать на сервере OKO, '
       + 'а сервер к приложению пока не подключён. Показать план другому человеку можно файлом.</p></div>';
    h += '<div class="sys-grid">' + secs.map(function(s){
      return '<button class="sys-card" onclick="sysGoto(\'' + s.k + '\')">'
           +   '<span class="sys-card-n">' + E(s.n) + '</span>'
           +   '<span class="sys-card-ic">' + ico(s.ic) + '</span>'
           +   '<b>' + E(s.t) + '</b><small>' + E(s.d) + '</small>'
           + '</button>';
    }).join('') + '</div>';
    h += '<div class="sys-cta">'
       +   '<button class="btn" onclick="closeSystemView();showTab(\'mini\');openMa(\'factory\')">'
       +     ico('bolt') + ' Открыть контент-завод</button>'
       +   '<button class="btn ghost" onclick="sys2Download()">' + ico('download') + ' Скачать план файлом</button>'
       + '</div>';
    return h;
  }

  /* --- Бизнес-план: только арифметика по ответам --- */
  function noData(what, why){
    return {h:'Данных не хватает', body:'Чтобы посчитать этот блок, нужен ответ: ' + what + '. '
      + (why || 'Пока ответа нет, приложение оставляет блок пустым — придумывать числа за тебя оно не будет.')};
  }

  function bizBlocks2(a){
    var out = [];

    /* 01 — Точка А */
    var pointA = [];
    pointA.push({h:'Кто ты по анкете', body:[
      txt(a.who) ? 'Тип: ' + txt(a.who) : 'Тип не указан',
      txt(a.niche) ? 'Ниша: ' + txt(a.niche) : 'Ниша не указана',
      txt(a.geo) ? 'Гео: ' + txt(a.geo) : 'Гео не указано',
      txt(a.exp) ? 'Опыт: ' + txt(a.exp) : 'Опыт не указан'
    ].join('. ') + '.'});
    var subs = num(a.subs_now), rev = num(a.revenue), chk = num(a.avg_check);
    var startRows = [['Показатель','Твой ответ']];
    startRows.push(['Подписчики сейчас', subs === null ? 'нет ответа' : String(intOrNull(subs))]);
    startRows.push(['Выручка в месяц', rev === null ? 'нет ответа' : money(rev)]);
    startRows.push(['Средний чек', chk === null ? 'нет ответа' : money(chk)]);
    startRows.push(['Площадки', Array.isArray(a.platforms) && a.platforms.length ? a.platforms.join(', ') : 'нет ответа']);
    pointA.push({h:'Стартовые цифры', body:'Ровно то, что ты ввёл. Ничего не дописано.', tbl:startRows});
    if(txt(a.mission)) pointA.push({h:'Зачем ты это делаешь', body:txt(a.mission)});
    out.push({t:'Точка А — где ты сейчас', ic:'compass', sub:'Слепок твоих ответов без домыслов', sections:pointA});

    /* 02 — Цель и разрыв */
    var goal = num(a.goal_income);
    var gapSecs = [];
    if(goal === null){
      gapSecs.push(noData('«Цель по выручке через 3 месяца»'));
    } else {
      var cur = rev === null ? 0 : rev;
      var gap = goal - cur;
      gapSecs.push({h:'Разрыв до цели', body:
        'Цель: ' + money(goal) + ' в месяц. Сейчас: ' + (rev === null ? 'выручка не указана, считаем от нуля' : money(rev)) + '. '
        + (gap <= 0
            ? 'Цель уже достигнута по твоим же числам. Тогда задача квартала — не рост выручки, а удержание и разгрузка себя.'
            : 'Добрать нужно ' + money(gap) + ' в месяц.')});
      if(gap > 0){
        if(chk === null || chk <= 0){
          gapSecs.push(noData('«Средний чек»', 'Без чека нельзя посчитать, сколько продаж закрывает разрыв.'));
        } else {
          var salesNeed = Math.ceil(gap / chk);
          var salesMonth = Math.ceil(goal / chk);
          gapSecs.push({h:'Сколько продаж это значит', body:
            'Формула простая: разрыв делим на средний чек. ' + money(gap) + ' / ' + money(chk) + ' = '
            + salesNeed + ' ' + plural(salesNeed,'дополнительная продажа','дополнительные продажи','дополнительных продаж') + ' в месяц. '
            + 'Всего на цель: ' + salesMonth + ' ' + plural(salesMonth,'продажа','продажи','продаж') + ' в месяц, '
            + 'это примерно ' + (Math.round(salesMonth / 30 * 10) / 10) + ' в день.',
            tbl:[
              ['Что считаем','Число'],
              ['Цель в месяц', money(goal)],
              ['Сейчас', rev === null ? 'нет ответа' : money(rev)],
              ['Разрыв', money(gap)],
              ['Средний чек', money(chk)],
              ['Продаж всего на цель', String(salesMonth)],
              ['Из них новых', String(salesNeed)]
            ]});
          gapSecs.push({h:'Чего эта арифметика не знает', body:
            'Она не знает твою конверсию из заявки в оплату и стоимость заявки — этих вопросов в анкете нет, '
            + 'а внешних данных у приложения нет. Как только появится подключённая аналитика, число заявок '
            + 'посчитается точно.'});
        }
      }
    }
    var gsub = num(a.goal_subs);
    if(gsub !== null && subs !== null){
      var dsub = gsub - subs;
      gapSecs.push({h:'Подписчики', body:
        'Цель: ' + intOrNull(gsub) + '. Сейчас: ' + intOrNull(subs) + '. '
        + (dsub <= 0 ? 'Цель уже закрыта.'
          : 'Нужно ещё ' + intOrNull(dsub) + ', то есть около ' + Math.ceil(dsub / 90) + ' в день на протяжении трёх месяцев.')});
    }
    out.push({t:'Цель и разрыв', ic:'target', sub:'Арифметика по твоим числам', sections:gapSecs});

    /* 03 — Продукты */
    var prodSecs = [];
    if(txt(a.products)) prodSecs.push({h:'Что ты продаёшь', body:txt(a.products)});
    else prodSecs.push(noData('«Продукты и цены»'));
    if(txt(a.main_product)) prodSecs.push({h:'Локомотив', body:txt(a.main_product)});
    if(chk !== null) prodSecs.push({h:'Средний чек', body:money(chk) + '. Это твоя цифра, приложение её не корректировало.'});
    prodSecs.push({h:'Шаблон линейки (метод OKO, не твои данные)', body:
      'Классическая лестница: бесплатный вход, недорогой первый шаг, основной продукт, дорогое сопровождение. '
      + 'Конкретные цены здесь не проставлены специально: их ставит тот, кто знает свою себестоимость. '
      + 'Возьми свой средний чек как основной продукт и посчитай остальные ступени от него.'});
    out.push({t:'Продукты и деньги', ic:'money', sub:'Из ответов про продукты и чек', sections:prodSecs});

    /* 04 — Аудитория */
    var audSecs = [];
    if(txt(a.audience)) audSecs.push({h:'Кто твой клиент', body:txt(a.audience)});
    else audSecs.push(noData('«Кто твой клиент»'));
    if(txt(a.pains)) audSecs.push({h:'Боли, которые ты назвал', body:txt(a.pains)});
    if(txt(a.objections)) audSecs.push({h:'Возражения, которые ты назвал', body:txt(a.objections)});
    audSecs.push({h:'Как это работает в контенте', body:
      'Каждая боль из твоего списка — это тема ролика. Каждое возражение — тема поста, который снимает страх '
      + 'перед покупкой. Больше ничего выдумывать не нужно: список тем берётся отсюда, а не из чужой ниши.'});
    out.push({t:'Аудитория', ic:'users', sub:'Твои формулировки, слово в слово', sections:audSecs});

    /* 05 — Нагрузка */
    var rpd = num(a.reels_per_day) || 0, tpd = num(a.tg_per_day) || 0;
    var cpm = num(a.carousels_per_month) || 0, spd = num(a.stories_per_day) || 0;
    var ypw = num(a.youtube_long_per_week) || 0;
    var totalM = rpd*30 + tpd*30 + cpm + spd*30 + ypw*4;
    var loadRows = [['Формат','В месяц']];
    loadRows.push(['Короткие ролики', String(intOrNull(rpd*30))]);
    loadRows.push(['TG-посты', String(intOrNull(tpd*30))]);
    loadRows.push(['Карусели', String(intOrNull(cpm))]);
    loadRows.push(['Сторис', String(intOrNull(spd*30))]);
    loadRows.push(['Длинные YouTube', String(intOrNull(ypw*4))]);
    loadRows.push(['Всего единиц', String(intOrNull(totalM))]);
    var tierNow = 'FREE';
    try{ if(typeof okoTier === 'function') tierNow = okoTier(); }catch(e){}
    out.push({t:'Нагрузка по контенту', ic:'file', sub:'Из выставленных тобой ползунков',
      sections:[
        {h:'Что получается в месяц', body:'Это прямое умножение твоих ползунков на календарь.', tbl:loadRows},
        {h:'Сколько это времени', body: totalM > 0
            ? 'Если считать по получасу на единицу вместе со съёмкой и монтажом, выходит около '
              + Math.round(totalM * 0.5) + ' часов в месяц. Прикинь, есть ли они у тебя, до того как начнёшь.'
            : 'Ползунки на нуле. Пока объём не выставлен, календарь будет пустой.'},
        {h:'Тариф', body:'Сейчас у тебя тариф «' + tierNow + '». Что он покрывает по каждому формату, '
          + 'приложение показывало прямо в анкете под ползунком.'}
      ]});

    /* 06 — Площадки */
    var plats = Array.isArray(a.platforms) ? a.platforms : [];
    var platSecs = [];
    if(plats.length) platSecs.push({h:'Где ты сейчас', body:plats.join(', ') + '.'});
    else platSecs.push(noData('«Где ты сейчас — площадки»'));
    if(txt(a.main_platform)) platSecs.push({h:'Главная площадка', body:txt(a.main_platform)
      + '. Под неё считается длина роликов и формат подачи.'});
    platSecs.push({h:'Что приложение про них НЕ знает', body:
      'Ни одна площадка к приложению не подключена, поэтому охваты, ER и рост подписчиков здесь не выводятся. '
      + 'Раздел «Мои соцсети» честно показывает, какой доступ нужен для каждой сети.'});
    out.push({t:'Площадки и дистрибуция', ic:'globe', sub:'Из ответа про площадки', sections:platSecs});

    /* 07 — Бюджет */
    var budSecs = [];
    if(txt(a.budget)){
      budSecs.push({h:'Бюджет, который ты назвал', body:txt(a.budget) + ' в месяц.'});
      budSecs.push({h:'Как его делить', body:
        'Рабочее правило: не больше трети бюджета в один канал, пока не увидел первую окупаемость. '
        + 'Остальное держи на второй и третий тест. Конкретных ставок и стоимости клика здесь нет: '
        + 'они зависят от площадки и гео, а данных площадок у приложения нет.'});
    } else {
      budSecs.push(noData('«Бюджет на рекламу»'));
    }
    out.push({t:'Бюджет и продвижение', ic:'megaphone', sub:'Из ответа про бюджет', sections:budSecs});

    /* 08 — Конкуренты (честно) */
    var comps = txt(a.competitors);
    out.push({t:'Конкуренты', ic:'search', sub:'Что есть и чего не хватает',
      sections:[
        comps
          ? {h:'Кого ты назвал сам', body:comps}
          : noData('«Твои конкуренты»', 'Приложение не подставляет чужие аккаунты вместо твоего ответа.'),
        {h:'Почему списка «ещё 100 каналов» здесь нет', body:
          'Чтобы собрать каталог конкурентов, нужен доступ к поиску площадок: Instagram Graph API, '
          + 'YouTube Data API, парсер TikTok. Всё это работает только на сервере с ключами. '
          + 'В браузере такого доступа нет, а рисовать правдоподобные ники и охваты приложение не будет.'},
        {h:'Что можно сделать прямо сейчас', body:
          'Открой каждого названного конкурента руками и выпиши три вещи: как звучит его оффер в шапке, '
          + 'какие три темы он повторяет чаще всего, чем он не занимается. Третий пункт — твоё место на рынке.'}
      ]});

    /* 09 — Материалы */
    var fileKeys = [['logo','Логотип'],['brandbook','Брендбук'],['scripts','Скрипты и офферы'],
                    ['contract_sample','Образец договора'],['refs','Референсы визуала']];
    var haveFiles = fileKeys.filter(function(p){ return Array.isArray(a[p[0]]) && a[p[0]].length; });
    var matSecs = [];
    if(haveFiles.length){
      matSecs.push({h:'Ты отметил как готовое', body:haveFiles.map(function(p){
        return p[1] + ' (' + a[p[0]].length + ')';
      }).join(', ') + '.'});
      matSecs.push({h:'Важно про эти файлы', body:
        'Сами файлы никуда не загружены — приложение сохранило только их имена и размеры. '
        + 'Загрузка появится вместе с сервером OKO. До тех пор держи оригиналы у себя.'});
    } else {
      matSecs.push({h:'Файлов нет', body:'Ни один материал не отмечен. Это нормально на старте: '
        + 'логотип, брендбук и договор можно добавить позже, вернувшись в анкету.'});
    }
    if(txt(a.colors)) matSecs.push({h:'Цвета бренда', body:txt(a.colors)});
    out.push({t:'Твои материалы', ic:'folder', sub:'Что отмечено в анкете', sections:matSecs});

    /* 10 — Позиционирование */
    var posBody;
    if(txt(a.audience) && txt(a.niche)){
      posBody = 'Я помогаю ' + txt(a.audience).toLowerCase().split('\n')[0]
        + ' в теме «' + txt(a.niche) + '»'
        + (txt(a.main_product) ? ' через ' + txt(a.main_product).toLowerCase() : '')
        + '. Это черновик из твоих же слов — доведи его до одной строки, которую не стыдно поставить в шапку.';
    } else {
      posBody = 'Формула: «Я помогаю [аудитория] получить [результат] за [срок] через [метод]». '
        + 'Подставить пока нечего: не хватает ответов про нишу и аудиторию.';
    }
    out.push({t:'Позиционирование', ic:'star', sub:'Черновик из твоих ответов',
      sections:[
        {h:'Формула', body:'Я помогаю [аудитория] получить [результат] за [срок] через [метод] без [боли].'},
        {h:'Твоя версия', body:posBody},
        {h:'Куда ставить', body:'Шапка профиля, первая строка канала, автоответ в личных сообщениях, '
          + 'первый экран сайта. Одна и та же формулировка везде — так она запоминается.'}
      ]});

    return out;
  }

  /* --- Перспективы: сценарии из ЕГО чисел, а не выдуманный прогноз рынка --- */
  function futureBlocks2(a){
    var rev = num(a.revenue);
    var goal = num(a.goal_income);
    var chk = num(a.avg_check);
    var out = [];

    var base = (goal !== null) ? goal : rev;
    if(base === null || base <= 0){
      out.push({t:'Сценарии роста', ic:'chart', sub:'Нужны твои числа',
        sections:[noData('«Текущая выручка» или «Цель по выручке»',
          'Без хотя бы одного числа сценарии считать не из чего, а рисовать чужой прогноз приложение не станет.')]});
    } else {
      /* Три сценария — это ОДНА арифметика с тремя явно названными темпами.
         Никакого «прогноза рынка»: темп задаёт пользователь своим выбором. */
      var rows = [['Месяц','Медленно +5%/мес','Ровно +10%/мес','Быстро +20%/мес']];
      [3, 6, 9, 12].forEach(function(m){
        rows.push([
          'М' + m,
          money(base * Math.pow(1.05, m)),
          money(base * Math.pow(1.10, m)),
          money(base * Math.pow(1.20, m))
        ]);
      });
      out.push({t:'Сценарии роста', ic:'chart', sub:'Сложный процент от твоей базы',
        sections:[
          {h:'Как это считается', body:
            'База — ' + money(base) + (goal !== null ? ' (твоя цель через 3 месяца)' : ' (твоя текущая выручка)')
            + '. Дальше три темпа роста в месяц: 5, 10 и 20 процентов. Это не прогноз рынка и не обещание — '
            + 'это калькулятор сложного процента, чтобы увидеть цену темпа.', tbl:rows},
          {h:'Что означает каждый темп', body:
            'Плюс 5 процентов в месяц — рост «сам собой», без новых каналов. Плюс 10 — один новый рабочий '
            + 'канал трафика или поднятая цена. Плюс 20 — команда и деньги в рекламу. Выбери строку, '
            + 'под которую ты реально готов работать, остальные забудь.'},
          {h:'Чего в таблице нет', body:
            'Сезонности, конкуренции, стоимости трафика и твоей конверсии. Эти данные приложение не '
            + 'придумывает: часть спросим в анкете позже, часть придёт из подключённой аналитики.'}
        ]});
    }

    if(chk !== null && chk > 0 && base !== null && base > 0){
      var salesRows = [['Выручка в месяц','Продаж при чеке ' + money(chk)]];
      [1, 1.5, 2, 3].forEach(function(k){
        var v = base * k;
        salesRows.push([money(v), String(Math.ceil(v / chk))]);
      });
      out.push({t:'Сколько продаж стоит за суммой', ic:'money', sub:'Пересчёт денег в действия',
        sections:[{h:'Пересчёт', body:'Выручка делится на твой средний чек. Дальше видно, сколько разговоров '
          + 'и заявок нужно сделать — это уже задача, а не мечта.', tbl:salesRows}]});
    }

    out.push({t:'Куда расти дальше', ic:'rocket', sub:'Направления без выдуманных сумм',
      sections:[
        {h:'Направления, которые обычно дают следующий шаг', body:
          'Новая площадка при том же контенте. Повышение цены на существующий продукт. '
          + 'Продукт с регулярной оплатой вместо разовой. Партнёрства с теми, у кого та же аудитория и другой продукт. '
          + 'Делегирование съёмки и монтажа.'},
        {h:'Почему тут нет сумм и сроков', body:
          'Любая цифра вида «через полгода будет столько-то» была бы выдумкой: приложение не знает ни твоего '
          + 'рынка, ни конверсий. Посчитать это честно можно только на своих данных, когда они накопятся.'},
        {h:'Что стоит сделать первым', body:
          'Выбери одно направление на квартал. Не три. Одно — и доведи до цифры, которую можно измерить.'}
      ]});

    return out;
  }

  function futureHtml2(a){
    var blocks = futureBlocks2(a);
    var h = '<p class="sys-note">' + ico('rocket')
      + ' Раздел считается из твоих чисел. Прогноза рынка здесь нет — приложение его не знает.</p>';
    h += '<div class="sys-biz-grid">' + blocks.map(function(b, i){
      return '<button class="sys-biz-card" onclick="sysBlockOpen(\'future\',' + i + ')">'
           +   '<span class="sys-biz-n">' + String(i+1).padStart(2,'0') + '</span>'
           +   '<span class="sys-biz-ic">' + ico(b.ic) + '</span>'
           +   '<span class="sys-biz-body"><b>' + E(b.t) + '</b><small>' + E(b.sub) + '</small></span>'
           +   '<svg class="i"><use href="#i-chev"/></svg>'
           + '</button>';
    }).join('') + '</div>';
    return h;
  }

  function bizHtml2(a){
    var blocks = bizBlocks2(a);
    var h = '<p class="sys-note">' + ico('briefcase')
      + ' Каждый блок собран из ответов анкеты. Где ответа не хватило — так и написано, вместо числа-заглушки.</p>';
    h += '<div class="sys-biz-grid">' + blocks.map(function(b, i){
      return '<button class="sys-biz-card" onclick="sysBlockOpen(\'biz\',' + i + ')">'
           +   '<span class="sys-biz-n">' + String(i+1).padStart(2,'0') + '</span>'
           +   '<span class="sys-biz-ic">' + ico(b.ic) + '</span>'
           +   '<span class="sys-biz-body"><b>' + E(b.t) + '</b><small>' + E(b.sub) + '</small></span>'
           +   '<svg class="i"><use href="#i-chev"/></svg>'
           + '</button>';
    }).join('') + '</div>';
    return h;
  }

  /* ===================== 4. ТЕМЫ И ТЕКСТЫ БЕЗ ВЫДУМАННЫХ КЕЙСОВ ===================== */

  /* Ядро предлагало снять чужие кейсы с конкретными суммами. Заменяем на
     каркасы, где сумму и результат подставляет сам человек — плейсхолдер
     в квадратных скобках виден в интерфейсе и не даёт соврать случайно. */
  var TOPICS2 = [
    {a:'Экспертный разбор', ffmt:'Формат 5 · Польза', code:'РАЗБОР', shoot:'live', topics:[
      'Разбираю по шагам, как я делаю [задача] в теме «{niche}»',
      'Собираю рабочую схему в «{niche}» с нуля за одну минуту',
      'Инструменты, которыми я реально пользуюсь в «{niche}»',
      'По каким признакам видно специалиста в «{niche}»',
      'Почему я даю гарантию на [твой продукт] и как она устроена'
    ]},
    {a:'Личная история', ffmt:'Формат 4 · Как есть', code:'СТРАТЕГИЯ', shoot:'live', topics:[
      'Как я пришёл в «{niche}» и что сделал бы иначе',
      'Ошибка, которая стоила мне [сумма или срок] в «{niche}»',
      'День из жизни в «{niche}»: показываю без монтажа',
      'Что я сказал бы себе в самом начале пути',
      'Момент, когда хотел бросить «{niche}», и что удержало'
    ]},
    {a:'Кейс клиента', ffmt:'Формат 3 · Доказательство', code:'ВОРОНКА', shoot:'stock', topics:[
      'Кейс: [имя или роль клиента] и результат [твоя цифра] за [срок]',
      'До и после на реальном примере: что именно поменяли',
      'Три клиента, три разных пути в «{niche}» — что было общего',
      'Клиент отложил одно решение, и вот чем это закончилось',
      'Разбор ошибки клиента и как её вытащили'
    ]},
    {a:'Разбор ошибки', ffmt:'Формат 2 · Против течения', code:'СИСТЕМА', shoot:'live', topics:[
      'Частая ошибка в «{niche}», из-за которой уходят клиенты',
      'Мифы о «{niche}», в которые я сам верил',
      'Что в «{niche}» стоит дороже всего, если делать неправильно',
      'Почему «работать больше» в «{niche}» не работает',
      'Что в «{niche}» делают все и никто не признаётся'
    ]},
    {a:'Тренд-адаптация', ffmt:'Формат 1 · Стоп-скролл', code:'СИСТЕМА', shoot:'ai', topics:[
      'Беру текущий тренд и переношу его в «{niche}»',
      'Формат, который сейчас хорошо заходит, — моя версия',
      'Тренд «до и после» на моём материале',
      'Формат «день из жизни» с тремя своими приёмами',
      'Почему я делаю этот тренд иначе: технический разбор'
    ]},
    {a:'Продающий пост', ffmt:'Формат 7 · Оффер', code:'СИСТЕМА', shoot:'live', topics:[
      'Открываю запись на [твой продукт]: условия и сроки',
      'Что внутри [твой продукт] и кому он не подойдёт',
      'Остались места на [формат работы] — как попасть',
      'Отвечаю на три главных вопроса про [твой продукт]',
      'Условия ранней брони: что даёт и до какого числа'
    ]}
  ];

  function patchTopics(){
    try{
      if(typeof SYS_ARCH_TOPICS === 'undefined' || !Array.isArray(SYS_ARCH_TOPICS)) return;
      for(var i = 0; i < SYS_ARCH_TOPICS.length && i < TOPICS2.length; i++){
        SYS_ARCH_TOPICS[i].a = TOPICS2[i].a;
        SYS_ARCH_TOPICS[i].ffmt = TOPICS2[i].ffmt;
        SYS_ARCH_TOPICS[i].code = TOPICS2[i].code;
        SYS_ARCH_TOPICS[i].shoot = TOPICS2[i].shoot;
        SYS_ARCH_TOPICS[i].topics = TOPICS2[i].topics.slice();
      }
    }catch(e){}
  }

  function patchShootLabels(){
    try{
      if(typeof SYS_SHOOT_LABEL === 'undefined') return;
      SYS_SHOOT_LABEL.live  = 'Живьём в кадре';
      SYS_SHOOT_LABEL.ai    = 'Нейро-аватар';
      SYS_SHOOT_LABEL.stock = 'Стоковое видео и текст';
    }catch(e){}
  }

  function persona(a){
    try{ if(typeof sysPersona === 'function') return sysPersona(a); }catch(e){}
    return {voiceStyle:'нейтральный', cameraPlan:'крупный план', mainPlatformNote:'все площадки', geo:''};
  }

  /* Сценарий ролика: тайминг и режиссура остаются, выдуманная статистика уходит. */
  function reelScript2(topic, a, cnt, meta){
    var niche = txt(a.niche) || 'твоя ниша';
    var aud = txt(a.audience) || 'твоя аудитория';
    var code = (meta && meta.code) || 'СИСТЕМА';
    var shoot = (meta && meta.shoot) || 'live';
    var P = persona(a);
    var audShort = aud.split(',')[0].trim().toLowerCase();
    var label = 'Живьём в кадре';
    try{ if(typeof SYS_SHOOT_LABEL !== 'undefined' && SYS_SHOOT_LABEL[shoot]) label = SYS_SHOOT_LABEL[shoot]; }catch(e){}
    var scenes = [
      {t:'0-3 сек · хук', body:
        'План: ' + P.cameraPlan + '.\n'
        + 'Реплика (' + P.voiceStyle + '): «' + topic + '»\n'
        + 'Субтитр крупно: ' + topic.toUpperCase().slice(0, 42) + '\n'
        + 'Звук: короткий переход и вступление трека.'},
      {t:'3-15 сек · боль', body:
        'План: средний план.\n'
        + 'Реплика: назови вслух проблему, с которой к тебе приходят ' + audShort + '. '
        + 'Своими словами и своей цифрой — сколько времени или денег она съедает.\n'
        + 'Подставь сюда конкретику из своей практики: выдуманный процент зритель считывает мгновенно.'},
      {t:'15-35 сек · метод', body:
        'План: чередование крупного плана и подложки.\n'
        + 'Реплика: три коротких шага решения в теме «' + niche + '». По одному предложению на шаг, без вводных.\n'
        + 'Субтитры по шагам: ШАГ 1 · ШАГ 2 · ШАГ 3\n'
        + 'Монтаж: смена кадра примерно каждые 2,5 секунды, склейка между шагами.'},
      {t:'35-45 сек · призыв', body:
        'План: крупный план, прямой взгляд в камеру.\n'
        + 'Реплика: назови кодовое слово ' + code + ' и что человек получит в ответ. Обещай только то, что реально отправишь.\n'
        + 'Субтитр: ' + code + ' В ЛИЧНЫЕ СООБЩЕНИЯ\n'
        + 'Последний кадр: обложка со словом ' + code + ' и твой логотип.'}
    ];
    var tag = function(s){ return String(s || '').replace(/[^\wа-яёА-ЯЁ]+/gi, '').toLowerCase(); };
    var hashtags = ['#' + tag(niche), '#' + tag(audShort), '#' + tag(code)]
      .concat(P.geo ? ['#' + tag(P.geo)] : []).join(' ');
    var music = 'Музыка: ритмичный трек без слов, 100-120 BPM. Громкость под голос убирается автоматически '
      + '(sidechain примерно на 8 дБ).';
    var formatMeta = ((meta && meta.ffmt) || 'Формат 1') + ' · Способ: ' + label
      + ' · Кодовое слово: ' + code + ' · ' + P.mainPlatformNote;
    return {scenes:scenes, hashtags:hashtags, music:music, formatMeta:formatMeta, count:cnt};
  }

  /* TG-пост: без эмодзи и без «проверено на 47 клиентах». */
  function tgPost2(topic, a, cnt, meta){
    var niche = txt(a.niche) || 'твоя ниша';
    var aud = txt(a.audience) || 'твоя аудитория';
    var code = (meta && meta.code) || 'СИСТЕМА';
    var audShort = aud.split(',')[0].trim();
    var body = [
      topic.charAt(0).toUpperCase() + topic.slice(1),
      '',
      'Каркас поста. Первый абзац: с каким вопросом к тебе чаще всего приходят ' + audShort.toLowerCase() + '.',
      'Напиши его так, как он звучит в переписке, дословно.',
      '',
      'Дальше три шага решения. По одному абзацу на шаг:',
      '',
      '1. Первый шаг — что человек делает сегодня.',
      '2. Второй шаг — по какому признаку он поймёт, что движется.',
      '3. Третий шаг — когда и как проверяет результат.',
      '',
      'Предпоследний абзац: что изменится, если делать это регулярно. Срок и результат',
      'ставь только те, которые ты видел у себя или у клиентов. Чужие цифры сюда не годятся.',
      '',
      'Финал: «Напиши слово ' + code + ' в личные сообщения» и что именно ты пришлёшь в ответ.',
      '',
      'Вопрос в комментарии: какая одна цель у тебя сейчас в теме «' + niche + '».'
    ].join('\n');
    return {body:body, count:cnt};
  }

  function carousel2(topic, a, cnt, meta){
    var niche = txt(a.niche) || 'ниша';
    var code = (meta && meta.code) || 'СИСТЕМА';
    var slides = [
      {t:'Слайд 1 · обложка', body:'Заголовок на весь экран (Bebas Neue, крупно, лайм):\n' + topic.toUpperCase()
        + '\n\nПодзаголовок: три шага и срок. Срок ставь свой.\n\nЛоготип в нижнем углу, фон бренда.'},
      {t:'Слайд 2 · точка А', body:'Заголовок: ГДЕ ТЫ СЕЙЧАС\n\nТри строки по 8-12 слов — симптомы проблемы '
        + 'словами твоей аудитории. Возьми их из ответа про боли клиента, не сочиняй.'},
      {t:'Слайд 3 · точка Б', body:'Заголовок: КУДА ПРИДЁШЬ\n\nТри пункта результата. Цифры ставь только те, '
        + 'которые подтвердишь: свои или клиентские.'},
      {t:'Слайд 4 · шаг 1', body:'Крупная цифра 1.\n\nЗаголовок шага и абзац на 50-60 слов: что человек делает первым.'},
      {t:'Слайд 5 · шаг 2', body:'Крупная цифра 2.\n\nЗаголовок шага и абзац на 50-60 слов: по чему он измеряет движение.'},
      {t:'Слайд 6 · шаг 3', body:'Крупная цифра 3.\n\nЗаголовок шага и абзац на 50-60 слов: когда и как проверяет результат.'},
      {t:'Слайд 7 · призыв', body:'Заголовок: СОХРАНИ И ЗАБЕРИ\n\nНапиши слово ' + code + ' в личные сообщения — '
        + 'и что именно ты пришлёшь по теме «' + niche + '». Обещай только то, что готово.'}
    ];
    return {slides:slides, count:cnt};
  }

  function stories2(topic, a, cnt, meta){
    var niche = txt(a.niche) || 'своей нише';
    var aud = txt(a.audience) || 'клиентов';
    var code = (meta && meta.code) || 'СИСТЕМА';
    var audShort = aud.split(',')[0].trim();
    var st = [
      {t:'Сторис 1 · хук', body:'Формат: короткое видео, взгляд в камеру, 15 секунд.\n\n'
        + 'Реплика: покажи приём, которым сам пользуешься в теме «' + niche + '». Назови, сколько он занимает.'},
      {t:'Сторис 2 · проблема', body:'Фон однотонный.\n\nЗаголовок крупно: боль ' + audShort.toLowerCase()
        + ' своими словами.\n\nПодпись мелко: почему дело не в лени, а в отсутствии шаблона.'},
      {t:'Сторис 3 · опрос', body:'Стикер-опрос: «Как ты сейчас решаешь это в теме ' + niche + '?»\n\n'
        + 'Варианты: в голове · в заметках · в приложении · никак.'},
      {t:'Сторис 4 · раскрытие', body:'Формат: короткое видео, 30 секунд, показываешь экран.\n\n'
        + 'Реплика: покажи сам шаблон в работе. Если есть результат — назови свой, без округлений в свою пользу.'},
      {t:'Сторис 5 · призыв', body:'Фон — обложка бренда.\n\nТекст: «Напиши ' + code + ' в личные сообщения».\n\n'
        + 'Стикер со ссылкой на пост дня.'}
    ];
    return {stories:st, count:cnt};
  }

  /* ===================== 5. МОИ СОЦСЕТИ ===================== */

  var SOC_KEY = 'oko-socials2';

  var SOC = [
    {k:'tg', n:'Telegram', ic:'send', ph:'t.me/твой_канал',
     gives:'Публикация постов и клипов в твой канал прямо из OKO, ответы подписчикам в одном окне, '
         + 'статистика просмотров постов.',
     needs:'Бот-администратор твоего канала и его токен на сервере OKO (переменная TELEGRAM_BOT_TOKEN). '
         + 'Токен хранится только на сервере, в приложение он не попадает и в браузере не появляется.'},
    {k:'ig', n:'Instagram', ic:'photo', ph:'instagram.com/твой_профиль',
     gives:'Автопубликация Reels и каруселей по расписанию, сбор комментариев и упоминаний, '
         + 'выгрузка охватов в аналитику плана.',
     needs:'Профиль в статусе Business или Creator, связанный со страницей Facebook, и приложение Meta '
         + 'с разрешениями instagram_content_publish и instagram_manage_insights. Нужны META_APP_ID '
         + 'и META_APP_SECRET на сервере OKO плюс проверка приложения на стороне Meta.'},
    {k:'yt', n:'YouTube', ic:'circle-play', ph:'youtube.com/@твой_канал',
     gives:'Загрузка Shorts и длинных видео из очереди контент-завода, обложки и описания одним пакетом, '
         + 'просмотры и удержание в аналитике.',
     needs:'Проект в Google Cloud с включённым YouTube Data API v3 и OAuth-клиентом '
         + '(GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET на сервере OKO). Квота API выдаётся Google отдельно.'},
    {k:'tt', n:'TikTok', ic:'clips', ph:'tiktok.com/@твой_профиль',
     gives:'Публикация вертикальных видео с описанием и хэштегами, статистика просмотров '
         + 'и досмотров по каждому ролику.',
     needs:'Одобренное приложение в TikTok for Developers с правом video.publish '
         + '(TIKTOK_CLIENT_KEY и TIKTOK_CLIENT_SECRET). Одобрение выдаёт TikTok вручную.'},
    {k:'vk', n:'ВКонтакте', ic:'chat', ph:'vk.com/твоя_страница',
     gives:'Посты и клипы в сообщество, ответы в сообщения сообщества, статистика записей.',
     needs:'Сообщество, где ты администратор, приложение VK ID и сервисный ключ '
         + '(VK_APP_ID и VK_SERVICE_TOKEN на сервере OKO).'}
  ];

  function socState(){
    var s = lsGet(SOC_KEY, null);
    if(!s || typeof s !== 'object') s = {links:{}};
    if(!s.links || typeof s.links !== 'object') s.links = {};
    return s;
  }
  function socSave(s){ lsSet(SOC_KEY, s); }

  /* Реальный факт: приложение открыто внутри Telegram и initData подтверждён.
     Это единственное живое подключение, и названо оно ровно тем, чем является. */
  function tgUser(){
    try{
      var w = window.Telegram && window.Telegram.WebApp;
      if(!w) return null;
      var hasInit = !!(w.initData && String(w.initData).length > 0);
      var u = w.initDataUnsafe && w.initDataUnsafe.user;
      if(!hasInit || !u) return null;
      return {
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' '),
        username: u.username || ''
      };
    }catch(e){ return null; }
  }

  function normUrl(v){
    var s = String(v || '').trim();
    if(!s) return '';
    s = s.replace(/^@/, '');
    if(!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try{
      var u = new URL(s);
      if(!u.hostname || u.hostname.indexOf('.') < 0) return '';
      return u.href.replace(/\/$/, '');
    }catch(e){ return ''; }
  }

  function socialsRender2(){
    var root = document.getElementById('socialsRoot');
    if(!root) return;
    var st = socState();
    var saved = Object.keys(st.links).filter(function(k){ return st.links[k]; }).length;
    var tg = tgUser();

    var h = '';
    h += '<div class="sy2-soc-hero">'
       +   '<b>Ни одна площадка не подключена</b>'
       +   '<p>Подключение соцсетей — это доступ по OAuth или по ключу приложения. У OKO этих ключей '
       +   'сейчас нет, поэтому приложение не может ни публиковать за тебя, ни читать твою статистику. '
       +   'Чтобы не врать кнопкой «Подключить», ниже написано по каждой сети: что даст подключение '
       +   'и какой именно доступ для него нужен.</p>'
       +   '<p>Что работает уже сегодня: можно сохранить ссылки на свои профили. Они лягут в визитку '
       +   'и в общий список ссылок профиля. Ссылка — это ссылка, а не подключение, и так она и подписана.</p>'
       + '</div>';

    if(tg){
      h += '<div class="sy2-soc-tg">' + ico('verified')
         +   '<div><b>Telegram: вход подтверждён</b>'
         +   '<small>Приложение открыто внутри Telegram, подпись initData получена. '
         +   'Аккаунт: ' + E(tg.name || 'без имени')
         +   (tg.username ? ' (@' + E(tg.username) + ')' : '') + '. '
         +   'Это подтверждает, кто ты, и позволяет присылать тебе уведомления от бота. '
         +   'Доступа к твоему каналу это не даёт — для публикаций нужен бот-администратор канала.</small></div>'
         + '</div>';
    } else {
      h += '<div class="sy2-soc-tg">' + ico('info')
         +   '<div><b>Telegram: вход не подтверждён</b>'
         +   '<small>Приложение открыто вне Telegram, поэтому подписи initData нет. '
         +   'Открой OKO через бота — вход подтвердится сам, ничего вводить не нужно.</small></div>'
         + '</div>';
    }

    h += SOC.map(function(p){
      var link = st.links[p.k] || '';
      var c = '';
      c += '<div class="sy2-card">';
      c +=   '<div class="sy2-card-h">'
        +      '<span class="sy2-card-ic">' + ico(p.ic) + '</span>'
        +      '<span class="sy2-card-t"><b>' + E(p.n) + '</b>'
        +        '<small>' + (link ? 'Ссылка сохранена' : 'Ссылка не добавлена') + '</small></span>'
        +      '<span class="sy2-st">Не подключено</span>'
        +    '</div>';
      c +=   '<div class="sy2-kv"><span>Что даст подключение</span><p>' + E(p.gives) + '</p></div>';
      c +=   '<div class="sy2-kv"><span>Что для этого нужно</span><p>' + E(p.needs) + '</p></div>';
      c +=   '<div class="sy2-link-row">'
        +      '<input type="url" inputmode="url" id="sy2Link_' + p.k + '" placeholder="' + E(p.ph) + '"'
        +        ' value="' + E(link) + '" aria-label="Ссылка на профиль ' + E(p.n) + '">'
        +      '<button class="btn sm" onclick="sys2LinkSave(\'' + p.k + '\')">' + ico('check') + ' Сохранить</button>'
        +    '</div>';
      if(link){
        c += '<div class="sy2-saved">' + ico('link')
          +    '<a href="' + E(link) + '" target="_blank" rel="noopener noreferrer">' + E(link) + '</a>'
          +    '<button onclick="sys2LinkDrop(\'' + p.k + '\')" aria-label="Удалить ссылку">' + ico('trash') + '</button>'
          +  '</div>';
      }
      c += '</div>';
      return c;
    }).join('');

    h += '<p class="sy2-note">Сохранённых ссылок: ' + saved + ' из ' + SOC.length + '. '
       + 'Они лежат в этом браузере и попадают в визитку профиля. Как только у OKO появятся ключи площадок, '
       + 'на этих же карточках вместо описания доступа появится настоящая кнопка входа.</p>';

    root.innerHTML = h;
  }

  window.sys2LinkSave = function(k){
    var inp = document.getElementById('sy2Link_' + k);
    if(!inp) return;
    var raw = inp.value;
    if(!String(raw).trim()){ sys2LinkDrop(k); return; }
    var url = normUrl(raw);
    if(!url){ T('Не похоже на ссылку. Пример: instagram.com/твой_профиль'); return; }
    var st = socState();
    st.links[k] = url;
    socSave(st);
    pushToVisitka();
    socialsRender2();
    T('Ссылка сохранена на этом устройстве');
  };
  window.sys2LinkDrop = function(k){
    var st = socState();
    delete st.links[k];
    socSave(st);
    pushToVisitka();
    socialsRender2();
    T('Ссылка удалена');
  };

  /* Ссылки уезжают в общий список ссылок профиля (визитка). Ничего лишнего
     туда не добавляем и чужих ссылок не создаём. */
  function pushToVisitka(){
    try{
      if(typeof PS_SOC === 'undefined') return;
      if(typeof psSocLoad === 'function') psSocLoad();
      if(!Array.isArray(PS_SOC.links)) PS_SOC.links = [];
      var st = socState();
      var icons = {tg:'megaphone', ig:'globe', yt:'circle-play', tt:'circle-play', vk:'globe'};
      /* убрать прежние наши записи */
      PS_SOC.links = PS_SOC.links.filter(function(l){ return !l || String(l.id || '').indexOf('sy2-') !== 0; });
      SOC.forEach(function(p){
        var u = st.links[p.k];
        if(!u) return;
        PS_SOC.links.push({id:'sy2-' + p.k, ic:icons[p.k] || 'globe', t:p.n, u:u.replace(/^https?:\/\//, '')});
      });
      if(typeof psSocSave === 'function') psSocSave();
    }catch(e){}
  }

  /* Чистка выдуманных значений второго экрана «Мои соцсети» (app.js). */
  function purgePsSocDemo(){
    try{
      if(typeof PS_SOC === 'undefined') return;
      if(typeof psSocLoad === 'function') psSocLoad();
      var touched = false;
      if(PS_SOC.conn){
        Object.keys(PS_SOC.conn).forEach(function(k){
          if(PS_SOC.conn[k]){ PS_SOC.conn[k] = false; touched = true; }
        });
      }
      if(PS_SOC.handles){
        Object.keys(PS_SOC.handles).forEach(function(k){
          if(PS_SOC.handles[k]){ PS_SOC.handles[k] = ''; touched = true; }
        });
      }
      if(Array.isArray(PS_SOC.sched) && PS_SOC.sched.length){ PS_SOC.sched = []; touched = true; }
      if(Array.isArray(PS_SOC.links)){
        var before = PS_SOC.links.length;
        PS_SOC.links = PS_SOC.links.filter(function(l){
          return l && String(l.u || '').indexOf('ktodaniel') < 0 && String(l.u || '').indexOf('okoappbot') < 0;
        });
        if(PS_SOC.links.length !== before) touched = true;
      }
      if(touched && typeof psSocSave === 'function') psSocSave();
    }catch(e){}
  }

  /* ===================== 6. ВЫХОД С ЭКРАНОВ ===================== */

  function anyModalOpen(){
    return !!(document.getElementById('sysDayModal') || document.getElementById('sysBlockModal'));
  }
  function closeTopModal(){
    if(document.getElementById('sysBlockModal')){
      try{ sysBlockClose(); }catch(e){}
      return true;
    }
    if(document.getElementById('sysDayModal')){
      try{ sysDayClose(); }catch(e){}
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(closeTopModal()){ e.stopPropagation(); return; }
    var sv = document.getElementById('systemView');
    if(sv && sv.classList.contains('open')){
      try{ closeSystemView(); }catch(e2){}
      e.stopPropagation();
    }
  }, true);

  /* ===================== 7. УСТАНОВКА ПЕРЕОПРЕДЕЛЕНИЙ ===================== */

  function install(){
    patchTopics();
    patchShootLabels();
    purgePsSocDemo();

    /* --- анкета --- */
    window.renderAnketa   = renderAnketa2;
    window.anketaStart    = function(mode){ window.sys2Start(mode); };
    window.anketaNext     = function(){ window.sys2Next(); };
    window.anketaPrev     = function(){ window.sys2Prev(); };
    window.anketaFinish   = finish;
    window.anketaBuildOrder = buildOrder;
    window.anketaCheckLimit = limitHint;
    window.anketaFilePick = function(k, ev){ window.sys2Files(k, ev); };

    /* --- план --- */
    window.sysHomeHtml    = homeHtml2;
    window.sysBizBlocks   = bizBlocks2;
    window.sysBizHtml     = bizHtml2;
    window.sysFutureBlocks = futureBlocks2;
    window.sysFutureHtml  = futureHtml2;
    window.sysDayReelScript = reelScript2;
    window.sysDayTgPost   = tgPost2;
    window.sysDayCarousel = carousel2;
    window.sysDayStories  = stories2;

    /* Модалка дня ядра содержала обещание «команда OKO собирает за 4-6 часов».
       Оборачиваем и заменяем на правду о том, что посчитано локально. */
    if(typeof window.sysDayHtml === 'function' && !window.sysDayHtml.__sy2){
      var origDay = window.sysDayHtml;
      var wrapped = function(n){
        var html = origDay(n);
        try{
          html = html.replace(
            /Каркас темы[^<]*?<\/small>/,
            'Каркас темы, тайминги и формат — шаблон OKO. Ниша, аудитория, тон и площадки подставлены '
            + 'из твоей анкеты. Разбора конкурентов и охватов здесь нет: приложение не подключено '
            + 'к площадкам и не станет их выдумывать.</small>'
          );
        }catch(e){}
        return html;
      };
      wrapped.__sy2 = true;
      window.sysDayHtml = wrapped;
    }

    /* Генератор КП обещал «скачивание в PDF/PNG после отправки анкеты» —
       отправлять анкету некуда, а предпросмотр и так сохраняется файлом. */
    if(typeof window.sysMatGenKPForm === 'function' && !window.sysMatGenKPForm.__sy2){
      var origKp = window.sysMatGenKPForm;
      var kpWrapped = function(){
        var html = origKp();
        try{
          html = html.replace(
            /Скачивание в PDF\/PNG после отправки анкеты, здесь только предпросмотр\./,
            'Готовое предложение сохраняется файлом прямо отсюда. Экспорт в PDF появится вместе с сервером OKO.'
          );
        }catch(e){}
        return html;
      };
      kpWrapped.__sy2 = true;
      window.sysMatGenKPForm = kpWrapped;
    }

    /* Кнопки «Скачать PDF» / «CRM» из ядра обещали работу несуществующей команды. */
    window.bizOpenCRM = function(){
      T('CRM появится вместе с сервером OKO. Сейчас клиентов удобнее вести в своей таблице.');
    };

    /* Открытие плана: если анкеты не было, честный пустой экран вместо
       плана «Эксперт · ниша —», собранного из прочерков. */
    if(typeof window.openSystemPreview === 'function' && !window.openSystemPreview.__sy2){
      var origPreview = window.openSystemPreview;
      var prevWrapped = function(keep){
        if(!hasAnswers()){
          var body = document.getElementById('systemBody');
          if(body){
            body.innerHTML = '<div class="sy2-honest"><b>Плана пока нет</b>'
              + '<p>Система роста собирается из ответов анкеты. Пока ответов нет, показывать нечего — '
              + 'подставлять за тебя чужую нишу и чужие числа приложение не будет.</p></div>'
              + '<button class="btn" onclick="closeSystemView()">' + ico('back') + ' Вернуться к анкете</button>';
          }
          var v = document.getElementById('systemView');
          if(v) v.classList.add('open');
          return;
        }
        return origPreview(keep);
      };
      prevWrapped.__sy2 = true;
      window.openSystemPreview = prevWrapped;
    }

    /* --- соцсети --- */
    window.socialsRender     = socialsRender2;
    window.socialsConnect    = function(k){
      var p = null;
      for(var i = 0; i < SOC.length; i++) if(SOC[i].k === k) p = SOC[i];
      T(p ? (p.n + ': подключение недоступно — у приложения нет ключа доступа')
          : 'Подключение недоступно');
      socialsRender2();
    };
    window.socialsDisconnect = function(){ socialsRender2(); };
    window.socialsAutopost   = function(){
      T('Автопостинг включится вместе с подключением площадки. Сейчас публиковать некуда.');
    };

    /* Второй вход в «Мои соцсети» (из профиля) ведёт на честный экран. */
    if(typeof window.psSocOpen === 'function' && !window.psSocOpen.__sy2){
      var openHonest = function(){
        purgePsSocDemo();
        try{
          if(typeof showTab === 'function') showTab('mini');
          if(typeof openMa === 'function'){ openMa('socials'); return; }
        }catch(e){}
        socialsRender2();
      };
      openHonest.__sy2 = true;
      window.psSocOpen = openHonest;
    }

    /* Первый рендер, если экран уже открыт. */
    try{
      var maSoc = document.getElementById('ma-socials');
      if(maSoc && maSoc.style.display === 'block') socialsRender2();
      var card = document.getElementById('anketaCard');
      if(card && card.innerHTML.trim() === '') renderAnketa2();
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(install, 0); });
  } else {
    setTimeout(install, 0);
  }
  /* Переустановка после других слоёв, которые могли обернуть те же имена. */
  window.addEventListener('load', function(){ setTimeout(install, 120); });

  window.okoSystem2 = {
    render: socialsRender2,
    anketa: renderAnketa2,
    bizBlocks: bizBlocks2,
    futureBlocks: futureBlocks2,
    version: '1.0'
  };
})();
