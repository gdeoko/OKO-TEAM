<?php
/** Страница «Подать заявку» — умная многошаговая форма (8 шагов). */

$comps = all("SELECT id,slug,code,name,type,is_paid,price FROM competitions
              WHERE status='open' ORDER BY sort");

// Предвыбор конкурса из ?competition=slug
$preSlug = preg_replace('/[^a-z0-9\-]/', '', (string)input('competition', ''));
$preId = 0;
foreach ($comps as $c) { if ($c['slug'] === $preSlug) { $preId = (int)$c['id']; break; } }

$noms = NOMINATIONS();
$ages = AGE_CATEGORIES();
$forms = FORMATIONS();

// Конфиг для клиентской логики (apply.js читает window.APPLY_CONFIG)
$jsCfg = [
    'apiUrl'    => url('/api/v1/apply'),
    'privacy'   => url('/privacy'),
    'agreement' => url('/agreement'),
    'consentDelay' => 15,
    'nominations'  => $noms,
    'allowed'   => ALLOWED_PLATFORMS(),
    'blocked'   => array_values(BLOCKED_PLATFORMS()),
];

$ic = [
  'comp'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'user'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  'teacher' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/></svg>',
  'number'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  'contact' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg>',
  'consent' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg>',
  'pay'     => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  'done'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
];

ob_start(); ?>
<style>
/* ===== Премиум-стили формы заявки (глобальный style.css не трогаем) ===== */
.apply-wrap{max-width:780px;margin:0 auto}

/* Степпер прогресса (JS ведёт .ap-fill/.active/.done - классы сохранены) */
.apply-progress{display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin:6px 0 38px;position:relative;padding:0 4px}
.apply-progress::before{content:"";position:absolute;left:24px;right:24px;top:19px;height:2px;background:var(--line);z-index:0;border-radius:2px}
.ap-node{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:9px;flex:1;min-width:0}
.ap-dot{width:40px;height:40px;border-radius:50%;background:var(--panel-solid);border:1.5px solid var(--glass-brd);
  display:flex;align-items:center;justify-content:center;color:var(--muted);font-weight:700;font-size:.9rem;
  transition:background .28s,border-color .28s,color .28s,box-shadow .28s,transform .28s}
.ap-dot svg{width:19px;height:19px}
.ap-node.done .ap-dot{background:var(--grad-gold);border-color:transparent;color:#1a1206;box-shadow:var(--shadow-btn)}
.ap-node.active .ap-dot{background:var(--panel-solid);border-color:var(--gold);color:var(--gold);
  box-shadow:0 0 0 5px var(--gold-soft),var(--shadow-soft);transform:translateY(-1px)}
.ap-label{font-size:.72rem;color:var(--muted);text-align:center;line-height:1.2;letter-spacing:.01em}
.ap-node.active .ap-label{color:var(--gold-ink);font-weight:700}
.ap-node.done .ap-label{color:var(--gold-ink);font-weight:600}
[data-theme="dark"] .ap-node.active .ap-label,[data-theme="dark"] .ap-node.done .ap-label{color:var(--gold)}
@media(max-width:640px){
  .ap-label{display:none}
  .apply-progress{margin-bottom:26px;gap:2px}
  .apply-progress::before{left:20px;right:20px;top:18px}
  .ap-dot{width:38px;height:38px}
}

/* Карточка формы */
.apply-card{padding:32px 32px 28px;position:relative;overflow:hidden}
.apply-card::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--grad-gold);opacity:.9}
@media(max-width:560px){.apply-card{padding:24px 18px}}
.astep{display:none}
.astep.active{display:block;animation:apIn .35s ease}
@keyframes apIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.astep-head{margin-bottom:22px}
.astep-head .eyebrow{margin-bottom:4px}
.astep-head h2{font-size:clamp(1.35rem,4.4vw,1.6rem);margin:0;line-height:1.15}

/* Выбор конкурса */
.comp-list{display:grid;gap:12px}
.comp-opt{display:block;cursor:pointer}
.comp-opt input{position:absolute;opacity:0;pointer-events:none}
.comp-opt .co-body{border:1.5px solid var(--glass-brd);border-radius:var(--radius-sm);padding:16px 18px;
  display:flex;align-items:center;gap:14px;min-height:64px;background:var(--panel);backdrop-filter:blur(10px);
  transition:border-color .2s,background .2s,box-shadow .2s,transform .2s}
@media(hover:hover){.comp-opt:hover .co-body{border-color:var(--gold);box-shadow:var(--shadow-card);transform:translateY(-2px)}}
.comp-opt input:checked + .co-body{border-color:var(--gold);background:var(--gold-soft);box-shadow:0 0 0 3px var(--gold-soft)}
.comp-opt input:focus-visible + .co-body{box-shadow:0 0 0 4px var(--gold-soft)}
.co-mark{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--glass-brd);flex:0 0 auto;position:relative;transition:.2s}
.comp-opt input:checked + .co-body .co-mark{border-color:var(--gold);background:var(--grad-gold)}
.comp-opt input:checked + .co-body .co-mark::after{content:"";position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:50%;background:#1a1206}
.co-main{flex:1;min-width:0}
.co-main b{display:block;font-family:var(--ff-serif);font-size:1.12rem;color:var(--text);line-height:1.2;overflow-wrap:anywhere}
.co-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}

/* Сегмент солист / коллектив */
.seg{display:flex;gap:6px;border:1.5px solid var(--glass-brd);border-radius:var(--radius-sm);padding:5px;margin-bottom:20px;background:var(--glass);backdrop-filter:blur(8px)}
.seg label{flex:1;text-align:center;padding:11px 8px;min-height:44px;cursor:pointer;font-weight:700;color:var(--muted);
  transition:background .18s,color .18s,box-shadow .18s;position:relative;border-radius:10px;
  display:flex;align-items:center;justify-content:center}
.seg label input{position:absolute;opacity:0}
.seg label.on{background:var(--grad-gold);color:#1a1206;box-shadow:var(--shadow-btn)}

.grid-2c{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
@media(max-width:560px){.grid-2c{grid-template-columns:1fr}}

/* Навигация шагов */
.astep-nav{display:flex;gap:12px;margin-top:28px}
.astep-nav .btn{flex:1;min-height:52px}
.astep-nav .back{flex:0 0 auto;min-width:120px}
@media(max-width:400px){.astep-nav .back{min-width:92px;padding-left:14px;padding-right:14px}}

/* Floating-label поля: метка плавает внутрь поля и всплывает при фокусе/вводе */
.field.ff{position:relative}
.field.ff>label{position:absolute;left:16px;top:15px;margin:0;padding:0 2px;pointer-events:none;z-index:2;
  font-weight:600;font-size:.9rem;color:var(--muted);background:transparent;transform-origin:left top;
  max-width:calc(100% - 40px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  transition:transform .16s ease,color .16s ease}
.field.ff>input,.field.ff>textarea{padding-top:22px;padding-bottom:8px}
.field.ff:has(>input:focus)>label,.field.ff:has(>input:not(:placeholder-shown))>label,
.field.ff:has(>textarea:focus)>label,.field.ff:has(>textarea:not(:placeholder-shown))>label{
  transform:translateY(-9px) scale(.78);color:var(--gold-ink)}
[data-theme="dark"] .field.ff:has(>input:focus)>label,
[data-theme="dark"] .field.ff:has(>textarea:focus)>label{color:var(--gold)}

/* Живая проверка ссылки на платформу */
.plat-live{font-size:.84rem;margin-top:7px;display:none;font-weight:600;padding-left:20px;position:relative}
.plat-live::before{content:"";position:absolute;left:0;top:3px;width:12px;height:12px;border-radius:50%;background:currentColor;opacity:.22}
.plat-live.ok{display:block;color:var(--mint)}
.plat-live.bad{display:block;color:var(--error)}

/* Живая сводка */
.summary-head{font-family:var(--ff-serif);font-size:1.06rem;color:var(--text);margin:0 0 12px;display:flex;align-items:center;gap:9px}
.summary-head svg{width:20px;height:20px;color:var(--gold);flex:none}
.summary{border:1px solid var(--glass-brd);border-radius:var(--radius-sm);background:var(--glass);padding:4px 18px;margin-bottom:22px;backdrop-filter:blur(10px);box-shadow:var(--shadow-soft)}
.summary .row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px dashed var(--line);font-size:.94rem}
.summary .row:last-child{border-bottom:none}
.summary .row span:first-child{color:var(--muted);flex:0 0 auto}
.summary .row span:last-child{font-weight:700;text-align:right;color:var(--text);overflow-wrap:anywhere}

/* Согласия */
.consent-row{display:flex;gap:13px;align-items:flex-start;margin-bottom:14px;padding:12px 14px;border:1px solid var(--glass-brd);
  border-radius:var(--radius-sm);background:var(--panel);backdrop-filter:blur(8px);transition:border-color .2s,background .2s}
.consent-row:has(input:checked){border-color:var(--gold);background:var(--gold-soft)}
.consent-row input[type=checkbox]{width:24px;height:24px;flex:0 0 auto;margin-top:1px;accent-color:var(--gold);cursor:pointer}
.consent-row.locked{opacity:.55}
.consent-row label{font-size:.9rem;line-height:1.5;cursor:pointer;color:var(--text-dim)}
.consent-note{font-size:.86rem;color:var(--text-dim);background:var(--gold-soft);border:1px solid var(--glass-brd);border-radius:var(--radius-sm);padding:13px 15px;margin-bottom:18px;line-height:1.5}
.consent-note b{color:var(--gold-ink)}
.timer-badge{display:inline-block;min-width:26px;text-align:center;font-weight:800;color:var(--gold-ink)}
[data-theme="dark"] .timer-badge,[data-theme="dark"] .consent-note b{color:var(--gold)}

/* Оплата */
.pay-box{text-align:center;padding:16px 0 6px}
.pay-badge{display:inline-flex;align-items:center;gap:7px;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd);border-radius:999px;padding:6px 14px;margin-bottom:6px}
.pay-badge svg{width:14px;height:14px}
[data-theme="dark"] .pay-badge{color:var(--gold)}
.pay-amount{font-family:var(--ff-display);font-size:clamp(2.6rem,10vw,3.4rem);letter-spacing:.02em;line-height:1;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0}

/* Готово */
.done-box{text-align:center;padding:16px 0}
.done-ic{width:88px;height:88px;margin:0 auto 18px;border-radius:50%;background:var(--gold-soft);border:1px solid var(--glass-brd);
  display:flex;align-items:center;justify-content:center;color:var(--gold);box-shadow:var(--shadow-glow)}
.done-ic svg{width:46px;height:46px}
.done-number{display:inline-block;font-family:var(--ff-display);font-size:clamp(1.6rem,6vw,2rem);letter-spacing:.06em;color:var(--gold-ink);
  background:var(--panel);border:1.5px dashed var(--gold);border-radius:var(--radius-sm);padding:11px 24px;margin:10px 0;backdrop-filter:blur(8px)}
[data-theme="dark"] .done-number{color:var(--gold)}

/* honeypot — скрыт для людей, виден ботам */
.hp-field{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal" style="margin-bottom:28px">
      <p class="eyebrow">Приём заявок</p>
      <h2>Подача заявки на конкурс</h2>
      <p>Заполните форму по шагам. Проверки помогут внести данные без ошибок. Черновик сохраняется автоматически.</p>
    </div>

    <div class="apply-wrap reveal">
    <?php if (!$comps): ?>
      <div class="card" style="text-align:center">
        <h3>Приём заявок сейчас закрыт</h3>
        <p style="color:var(--muted)">Следите за новыми конкурсами в разделе
          <a href="<?= url('/competitions') ?>">«Конкурсы»</a> или подпишитесь на уведомления.</p>
      </div>
    <?php else: ?>

      <!-- Прогресс-бар -->
      <div class="apply-progress" id="apProgress">
        <?php foreach ([['comp','Конкурс'],['user','Участник'],['teacher','Педагог'],
                        ['number','Номер'],['contact','Контакты'],['consent','Согласие'],
                        ['pay','Оплата'],['done','Готово']] as $i=>[$key,$lbl]): ?>
          <div class="ap-node" data-node="<?= $key ?>">
            <div class="ap-dot"><?= $ic[$key] ?></div>
            <div class="ap-label"><?= h($lbl) ?></div>
          </div>
        <?php endforeach; ?>
      </div>

      <form class="card apply-card" id="applyForm" novalidate autocomplete="on">
        <?= csrf_field() ?>
        <!-- honeypot -->
        <div class="hp-field" aria-hidden="true">
          <label>Не заполняйте это поле<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        </div>

        <!-- ШАГ 1. Выбор конкурса -->
        <section class="astep active" data-step="comp">
          <div class="astep-head"><p class="eyebrow">Шаг 1</p><h2>Выберите конкурс</h2></div>
          <div class="comp-list">
            <?php foreach ($comps as $c): ?>
              <label class="comp-opt">
                <input type="radio" name="competition_id" value="<?= (int)$c['id'] ?>"
                  data-slug="<?= h($c['slug']) ?>" data-name="<?= h($c['name']) ?>"
                  data-paid="<?= (int)$c['is_paid'] ?>" data-price="<?= (int)$c['price'] ?>"
                  data-reg="<?= url('/competition/'.$c['slug']) ?>" data-code="<?= h($c['code']) ?>"
                  <?= $preId === (int)$c['id'] ? 'checked' : '' ?>>
                <span class="co-body">
                  <span class="co-mark"></span>
                  <span class="co-main">
                    <b><?= h($c['name']) ?></b>
                    <span class="co-tags">
                      <span class="badge badge--intl"><?= $c['type']==='international'?'Международный':'Всероссийский' ?></span>
                      <span class="badge <?= (int)$c['is_paid'] ? 'badge--closed' : 'badge--open' ?>"><?= (int)$c['is_paid'] ? 'Платный' : 'Бесплатный' ?></span>
                    </span>
                  </span>
                </span>
              </label>
            <?php endforeach; ?>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 2. Участник / коллектив -->
        <section class="astep" data-step="user">
          <div class="astep-head"><p class="eyebrow">Шаг 2</p><h2>Данные участника</h2></div>
          <div class="seg" id="formTypeSeg">
            <label class="on"><input type="radio" name="is_group" value="0" checked>Солист</label>
            <label><input type="radio" name="is_group" value="1">Коллектив</label>
          </div>

          <div class="field ff" data-when="group" style="display:none">
            <input type="text" id="group_name" name="group_name" placeholder=" ">
            <label for="group_name">Название коллектива</label>
            <div class="hint">Например, образцовый ансамбль «Родник».</div>
            <div class="err-msg">Укажите название коллектива.</div>
          </div>
          <div class="field ff">
            <input type="text" id="full_name" name="full_name" placeholder=" " data-fio required>
            <label for="full_name" id="fnLabel">Фамилия, имя, отчество участника</label>
            <div class="hint">Регистр поправится автоматически.</div>
            <div class="err-msg">Укажите ФИО участника.</div>
          </div>
          <div class="grid-2c">
            <div class="field" data-when="solo">
              <label for="birth_date">Дата рождения</label>
              <input type="date" id="birth_date" name="birth_date" max="<?= date('Y-m-d') ?>">
              <div class="err-msg">Укажите дату рождения.</div>
            </div>
            <div class="field">
              <label for="age_category">Возрастная категория</label>
              <select id="age_category" name="age_category" required>
                <option value="">Выберите категорию</option>
                <?php foreach ($ages as $a): ?><option value="<?= h($a) ?>"><?= h($a) ?></option><?php endforeach; ?>
              </select>
              <div class="hint" data-age-hint></div>
              <div class="err-msg">Выберите возрастную категорию.</div>
            </div>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back aria-label="Назад">Назад</button>
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 3. Педагог и учреждение -->
        <section class="astep" data-step="teacher">
          <div class="astep-head"><p class="eyebrow">Шаг 3</p><h2>Педагог и учреждение</h2></div>
          <div class="field ff">
            <input type="text" id="teacher" name="teacher" placeholder=" " data-fio>
            <label for="teacher">ФИО руководителя или педагога</label>
            <div class="hint">Как указать в дипломе руководителя. Можно оставить пустым.</div>
          </div>
          <div class="field ff">
            <input type="text" id="institution" name="institution" placeholder=" ">
            <label for="institution">Учреждение</label>
            <div class="hint">Например, детская школа искусств №1.</div>
          </div>
          <div class="field ff">
            <input type="text" id="city" name="city" placeholder=" " required>
            <label for="city">Населённый пункт</label>
            <div class="hint">Например, г. Москва.</div>
            <div class="err-msg">Укажите город или населённый пункт.</div>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 4. Конкурсный номер -->
        <section class="astep" data-step="number">
          <div class="astep-head"><p class="eyebrow">Шаг 4</p><h2>Конкурсный номер</h2></div>
          <div class="field">
            <label for="nomination">Номинация</label>
            <select id="nomination" name="nomination" required>
              <option value="">Выберите номинацию</option>
              <?php foreach (array_keys($noms) as $n): ?><option value="<?= h($n) ?>"><?= h($n) ?></option><?php endforeach; ?>
            </select>
            <div class="err-msg">Выберите номинацию.</div>
          </div>
          <div class="field" id="subgroupField" style="display:none">
            <label for="subgroup">Подраздел</label>
            <select id="subgroup" name="subgroup">
              <option value="">Выберите подраздел</option>
            </select>
            <div class="err-msg">Выберите подраздел.</div>
          </div>
          <div class="field">
            <label for="formation">Форма исполнения</label>
            <select id="formation" name="formation" required>
              <option value="">Выберите форму</option>
              <?php foreach ($forms as $f): ?><option value="<?= h($f) ?>"><?= h($f) ?></option><?php endforeach; ?>
            </select>
            <div class="err-msg">Выберите форму исполнения.</div>
          </div>
          <div class="field ff">
            <input type="text" id="work_title" name="work_title" placeholder=" " data-title required>
            <label for="work_title">Название номера или работы</label>
            <div class="hint">Например, романс «Утро». Кавычки заменятся на «ёлочки» автоматически.</div>
            <div class="err-msg">Укажите название номера.</div>
          </div>
          <div class="field ff">
            <input type="url" id="video_url" name="video_url" placeholder=" " data-video>
            <label for="video_url">Ссылка на выступление или работу</label>
            <input type="hidden" name="video_platform" id="video_platform">
            <div class="hint">RuTube, Яндекс Диск, Google Диск, Cloud Mail, VK, ОК, Дзен. Ссылка должна быть открыта для просмотра.</div>
            <div class="plat-live" data-plat-live></div>
            <div class="err-msg">Проверьте ссылку на выступление.</div>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 5. Контакты и адрес -->
        <section class="astep" data-step="contact">
          <div class="astep-head"><p class="eyebrow">Шаг 5</p><h2>Контакты и доставка</h2></div>
          <div class="grid-2c">
            <div class="field ff">
              <input type="email" id="email" name="email" placeholder=" " required>
              <label for="email">Электронная почта</label>
              <div class="hint">На неё придут дипломы и результаты.</div>
              <div class="err-msg">Укажите корректную электронную почту.</div>
            </div>
            <div class="field ff">
              <input type="tel" id="phone" name="phone" placeholder=" " data-phone required>
              <label for="phone">Телефон</label>
              <div class="err-msg">Укажите телефон в формате +7 (___) ___-__-__.</div>
            </div>
          </div>
          <div class="field ff">
            <input type="text" id="address" name="address" placeholder=" ">
            <label for="address">Адрес доставки оригиналов</label>
            <div class="hint">Нужен только для оригиналов наградных материалов. Дипломы приходят на почту.</div>
          </div>
          <div class="field ff" style="max-width:240px">
            <input type="text" id="postal_index" name="postal_index" placeholder=" " inputmode="numeric" maxlength="6">
            <label for="postal_index">Почтовый индекс</label>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 6. Согласие -->
        <section class="astep" data-step="consent">
          <div class="astep-head"><p class="eyebrow">Шаг 6</p><h2>Проверка и согласие</h2></div>

          <div class="summary-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/></svg>
            Проверьте данные заявки
          </div>
          <div class="summary" id="applySummary"></div>

          <div class="consent-note">
            Ознакомьтесь с положением конкурса.
            <a href="#" target="_blank" rel="noopener" id="regLink" data-reg-link>Открыть положение</a>.
            Отметка станет доступна через <span class="timer-badge" data-timer>15</span> секунд после открытия.
          </div>

          <div class="consent-row locked" id="agreeRegRow">
            <input type="checkbox" id="agree_reg" name="agree_reg" value="1" disabled>
            <label for="agree_reg">Я ознакомился с положением конкурса и принимаю его условия.</label>
          </div>
          <div class="consent-row">
            <input type="checkbox" id="agree_pd" name="agree_pd" value="1">
            <label for="agree_pd">Я согласен на обработку персональных данных согласно
              <a href="<?= url('/privacy') ?>" target="_blank" rel="noopener">Политике конфиденциальности</a>
              и принимаю <a href="<?= url('/agreement') ?>" target="_blank" rel="noopener">Пользовательское соглашение</a>.</label>
          </div>
          <div class="consent-row">
            <input type="checkbox" id="agree_rules" name="agree_rules" value="1">
            <label for="agree_rules">Подтверждаю, что конкурсный материал соответствует требованиям положения:
              видео без монтажа и склеек, качество не ниже 480p, запись не старше одного года,
              а ссылка открыта для просмотра вплоть до оглашения результатов.</label>
          </div>

          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next id="consentNext" disabled>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 7. Оплата (только для платного конкурса) -->
        <section class="astep" data-step="pay">
          <div class="astep-head"><p class="eyebrow">Шаг 7</p><h2>Оплата участия</h2></div>
          <div class="pay-box">
            <span class="pay-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>
              Оргвзнос
            </span>
            <p style="color:var(--muted);margin:0">Организационный взнос за участие</p>
            <div class="pay-amount" data-pay-amount>-</div>
            <p style="color:var(--muted);max-width:460px;margin:0 auto 8px">
              Оплата оргвзноса пройдёт онлайн через защищённую форму ЮKassa сразу после отправки заявки.
              Постоянным участникам начисляется скидка за число участий, а по промокоду педагога Вы
              получаете дополнительную скидку.</p>
          </div>
          <div class="field" style="max-width:320px;margin:0 auto 6px">
            <label for="promo_code">Промокод педагога (если есть)</label>
            <input type="text" id="promo_code" name="promo_code" placeholder="Например, ABCD1234"
              autocomplete="off" maxlength="16" style="text-transform:uppercase">
            <div class="hint">Даёт дополнительную скидку на оргвзнос. Можно оставить пустым.</div>
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="submit" class="btn btn--primary" data-submit>Перейти к оплате</button>
          </div>
        </section>

        <!-- Кнопка отправки для бесплатного конкурса (без шага оплаты) -->
        <div class="astep" data-step="submit-free">
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="submit" class="btn btn--primary" data-submit>Отправить заявку</button>
          </div>
        </div>

        <!-- ШАГ 8. Готово -->
        <section class="astep" data-step="done">
          <div class="done-box">
            <div class="done-ic"><?= $ic['done'] ?></div>
            <h2>Заявка принята</h2>
            <p style="color:var(--muted)">Номер Вашей заявки</p>
            <div class="done-number" data-app-number>-</div>
            <p style="color:var(--muted);max-width:460px;margin:12px auto 0">
              Подтверждение направлено на Вашу электронную почту. Следить за статусом можно в
              <a href="<?= url('/cabinet') ?>">личном кабинете</a>.</p>
            <div style="margin-top:22px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
              <a class="btn btn--ghost" href="<?= url('/competitions') ?>">К конкурсам</a>
              <a class="btn btn--primary" href="<?= url('/') ?>">На главную</a>
            </div>
          </div>
        </section>

        <div class="err-msg" id="applyFormError" style="margin-top:14px;text-align:center"></div>
      </form>
    <?php endif; ?>
    </div>
  </div>
</section>

<?php if ($comps): ?>
<script>window.APPLY_CONFIG = <?= json_encode($jsCfg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;</script>
<script>
/* Редирект на онлайн-оплату: если ответ формы заявки содержит confirmation_url ЮKassa. */
(function () {
  var CFG = window.APPLY_CONFIG || {};
  if (!CFG.apiUrl || !window.fetch) return;
  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    var res = _fetch.apply(this, arguments);
    var u = (typeof url === 'string') ? url : (url && url.url) || '';
    if (u && u.indexOf(CFG.apiUrl) === 0) {
      return res.then(function (r) {
        try {
          r.clone().json().then(function (d) {
            if (d && d.confirmation_url) window.location.href = d.confirmation_url;
          }).catch(function () {});
        } catch (e) {}
        return r;
      });
    }
    return res;
  };
})();
</script>
<script src="<?= asset('js/apply.js') ?>" defer></script>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Подать заявку', $content, [
    'active' => '/apply',
    'meta'   => 'Подача заявки на конкурсы КЦ «Музыкальный Мир». Умная форма с проверками: участник, номинация, ссылка на выступление, контакты.',
]);
