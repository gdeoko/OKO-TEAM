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
/* Локальные стили формы заявки (глобальный style.css не трогаем) */
.apply-wrap{max-width:760px;margin:0 auto}
.apply-progress{display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin:8px 0 34px;position:relative}
.apply-progress::before{content:"";position:absolute;left:20px;right:20px;top:17px;height:2px;background:var(--line);z-index:0}
.ap-node{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0}
.ap-dot{width:36px;height:36px;border-radius:50%;background:#fff;border:1.5px solid var(--line);
  display:flex;align-items:center;justify-content:center;color:var(--muted);font-weight:700;font-size:.9rem;transition:.25s}
.ap-dot svg{width:18px;height:18px}
.ap-node.done .ap-dot{background:var(--grad-gold);border-color:transparent;color:#fff;box-shadow:var(--shadow-btn)}
.ap-node.active .ap-dot{background:#fff;border-color:var(--gold);color:var(--gold-dark);box-shadow:0 0 0 4px rgba(201,168,76,.15)}
.ap-label{font-size:.72rem;color:var(--muted);text-align:center;line-height:1.2}
.ap-node.active .ap-label,.ap-node.done .ap-label{color:var(--gold-dark);font-weight:600}
@media(max-width:640px){.ap-label{display:none}.apply-progress::before{top:17px}}

.apply-card{padding:30px 30px 26px}
@media(max-width:560px){.apply-card{padding:22px 18px}}
.astep{display:none;animation:apIn .35s ease}
.astep.active{display:block}
@keyframes apIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.astep-head{margin-bottom:20px}
.astep-head .eyebrow{margin-bottom:6px}
.astep-head h2{font-size:1.5rem;margin:0}

.comp-list{display:grid;gap:12px}
.comp-opt{display:block;cursor:pointer}
.comp-opt input{position:absolute;opacity:0;pointer-events:none}
.comp-opt .co-body{border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:16px 18px;
  display:flex;align-items:center;gap:14px;transition:.2s;background:#fff}
.comp-opt:hover .co-body{border-color:var(--gold);box-shadow:var(--shadow-card)}
.comp-opt input:checked + .co-body{border-color:var(--gold);background:var(--gold-light);box-shadow:0 0 0 3px rgba(201,168,76,.14)}
.co-mark{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--line);flex:0 0 auto;position:relative;transition:.2s}
.comp-opt input:checked + .co-body .co-mark{border-color:var(--gold);background:var(--grad-gold)}
.comp-opt input:checked + .co-body .co-mark::after{content:"";position:absolute;left:6px;top:6px;width:8px;height:8px;border-radius:50%;background:#fff}
.co-main{flex:1;min-width:0}
.co-main b{display:block;font-family:var(--ff-head);font-size:1.08rem;color:var(--navy)}
.co-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}

.seg{display:flex;gap:0;border:1.5px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:18px}
.seg label{flex:1;text-align:center;padding:12px;cursor:pointer;font-weight:600;color:var(--muted);transition:.18s;position:relative}
.seg label input{position:absolute;opacity:0}
.seg label.on{background:var(--gold-light);color:var(--gold-dark)}
.grid-2c{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
@media(max-width:560px){.grid-2c{grid-template-columns:1fr}}

.astep-nav{display:flex;gap:12px;margin-top:26px}
.astep-nav .btn{flex:1}
.astep-nav .back{flex:0 0 auto;min-width:52px}

.plat-live{font-size:.84rem;margin-top:6px;display:none;font-weight:600}
.plat-live.ok{display:block;color:#3f7a4a}
.plat-live.bad{display:block;color:var(--error)}

.summary{border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--cream);padding:6px 18px;margin-bottom:20px}
.summary .row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line);font-size:.94rem}
.summary .row:last-child{border-bottom:none}
.summary .row span:first-child{color:var(--muted)}
.summary .row span:last-child{font-weight:600;text-align:right;color:var(--navy)}

.consent-row{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
.consent-row input[type=checkbox]{width:22px;height:22px;flex:0 0 auto;margin-top:2px;accent-color:var(--gold-dark);cursor:pointer}
.consent-row.locked{opacity:.55}
.consent-row label{font-size:.92rem;line-height:1.45;cursor:pointer}
.consent-note{font-size:.84rem;color:var(--muted);background:var(--gold-light);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:18px}
.consent-note b{color:var(--gold-dark)}
.timer-badge{display:inline-block;min-width:26px;text-align:center;font-weight:700;color:var(--gold-dark)}

.pay-box{text-align:center;padding:14px 0}
.pay-amount{font-family:var(--ff-head);font-size:2.4rem;color:var(--gold-dark);margin:6px 0}

.done-box{text-align:center;padding:16px 0}
.done-ic{width:82px;height:82px;margin:0 auto 16px;border-radius:50%;background:var(--gold-light);
  display:flex;align-items:center;justify-content:center;color:var(--gold-dark)}
.done-ic svg{width:44px;height:44px}
.done-number{display:inline-block;font-family:var(--ff-head);font-size:1.6rem;letter-spacing:.05em;color:var(--navy);
  background:#fff;border:1.5px dashed var(--gold);border-radius:var(--radius-sm);padding:10px 22px;margin:10px 0}

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

          <div class="field" data-when="group" style="display:none">
            <label for="group_name">Название коллектива</label>
            <input type="text" id="group_name" name="group_name" placeholder="Образцовый ансамбль «Родник»">
            <div class="err-msg">Укажите название коллектива.</div>
          </div>
          <div class="field">
            <label for="full_name" id="fnLabel">Фамилия, имя, отчество участника</label>
            <input type="text" id="full_name" name="full_name" placeholder="Иванова Мария Петровна" data-fio required>
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
          <div class="field">
            <label for="teacher">ФИО руководителя или педагога</label>
            <input type="text" id="teacher" name="teacher" placeholder="Смирнов Алексей Иванович" data-fio>
            <div class="hint">Как указать в дипломе руководителя. Можно оставить пустым.</div>
          </div>
          <div class="field">
            <label for="institution">Учреждение</label>
            <input type="text" id="institution" name="institution" placeholder="Детская школа искусств №1">
          </div>
          <div class="field">
            <label for="city">Населённый пункт</label>
            <input type="text" id="city" name="city" placeholder="г. Москва" required>
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
          <div class="field">
            <label for="work_title">Название номера или работы</label>
            <input type="text" id="work_title" name="work_title" placeholder="Романс «Утро»" data-title required>
            <div class="hint">Кавычки заменятся на «ёлочки» автоматически.</div>
            <div class="err-msg">Укажите название номера.</div>
          </div>
          <div class="field">
            <label for="video_url">Ссылка на выступление или работу</label>
            <input type="url" id="video_url" name="video_url" placeholder="https://rutube.ru/video/..." data-video>
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
            <div class="field">
              <label for="email">Электронная почта</label>
              <input type="email" id="email" name="email" placeholder="mail@example.ru" required>
              <div class="hint">На неё придут дипломы и результаты.</div>
              <div class="err-msg">Укажите корректную электронную почту.</div>
            </div>
            <div class="field">
              <label for="phone">Телефон</label>
              <input type="tel" id="phone" name="phone" placeholder="+7 (___) ___-__-__" data-phone required>
              <div class="err-msg">Укажите телефон в формате +7 (___) ___-__-__.</div>
            </div>
          </div>
          <div class="field">
            <label for="address">Адрес доставки оригиналов</label>
            <input type="text" id="address" name="address" placeholder="г. Москва, ул. Солянка, д.14, кв.7">
            <div class="hint">Нужен только для оригиналов наградных материалов. Дипломы приходят на почту.</div>
          </div>
          <div class="field" style="max-width:220px">
            <label for="postal_index">Почтовый индекс</label>
            <input type="text" id="postal_index" name="postal_index" placeholder="109240" inputmode="numeric" maxlength="6">
          </div>
          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 6. Согласие -->
        <section class="astep" data-step="consent">
          <div class="astep-head"><p class="eyebrow">Шаг 6</p><h2>Проверка и согласие</h2></div>

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

          <div class="astep-nav">
            <button type="button" class="btn btn--ghost back" data-back>Назад</button>
            <button type="button" class="btn btn--primary" data-next id="consentNext" disabled>Продолжить</button>
          </div>
        </section>

        <!-- ШАГ 7. Оплата (только для платного конкурса) -->
        <section class="astep" data-step="pay">
          <div class="astep-head"><p class="eyebrow">Шаг 7</p><h2>Оплата участия</h2></div>
          <div class="pay-box">
            <p style="color:var(--muted)">Организационный взнос за участие</p>
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
