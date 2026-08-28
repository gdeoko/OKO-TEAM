<?php
/** Форма заказа наградного материала. */
$comps = all("SELECT id,slug,name,is_paid FROM competitions WHERE status != 'draft' ORDER BY sort");
$preselect = input('competition', '');

// Заказ ИЗ ЗАЯВКИ: /order-awards?app={id} — данные подставляются из заявки участника,
// повторно ничего вводить не нужно. Трофей ограничивается аттестационным результатом.
require_once BASE_PATH . '/core/orders.php';
// Скидка ВИП-клуба (20%) — показываем перечёркнутые цены прямо в каталоге наград.
$clubPct = 0;
if (($_cu = current_user()) && is_file(BASE_PATH . '/core/club.php')) {
    require_once BASE_PATH . '/core/club.php';
    if (function_exists('club_discount_percent')) $clubPct = (int) club_discount_percent((int) $_cu['id']);
}
$pf = ['full_name'=>'','age_category'=>'','nomination'=>'','teacher'=>'','act_title'=>'','email'=>'','phone'=>''];
$fromApp = null; $appResultLock = ''; $appCompPaid = false;
$appId = (int) input('app', '');
if ($appId && ($cu = current_user())) {
    $a = one("SELECT a.*, c.slug AS comp_slug, c.name AS comp_name, c.is_paid AS comp_is_paid,
                     c.results_mode AS comp_results_mode, c.results_published_at AS comp_results_pub
              FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id
              WHERE a.id=? AND a.user_id=?", [$appId, $cu['id']]);
    // Заказ открыт только когда результат реально дошёл до участника (короткие —
    // по result_sent_at, длинные — после публикации итогов).
    $_delivered = ((string)($a['comp_results_mode'] ?? '') === 'list')
        ? trim((string)($a['comp_results_pub'] ?? '')) !== ''
        : trim((string)($a['result_sent_at'] ?? '')) !== '';
    if ($a && (string)($a['result'] ?? '') !== '' && $_delivered) {
        $fromApp = $a;
        $appCompPaid = (int)($a['comp_is_paid'] ?? 0) === 1;
        $pf['full_name']   = $a['is_group'] ? ($a['group_name'] ?: $a['full_name']) : $a['full_name'];
        $pf['age_category']= (string)$a['age_category'];
        $pf['nomination']  = (string)$a['nomination'];
        $pf['teacher']     = (string)$a['teacher'];
        $pf['act_title']   = (string)$a['work_title'];
        $pf['email']       = (string)$a['email'];
        $pf['phone']       = (string)$a['phone'];
        $preselect         = (string)$a['comp_slug'];
        $appResultLock     = (string)$a['result'];
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Заказ наград оформляется ТОЛЬКО по оценённой заявке (правило владельца, и API
   отклоняет заказ без application_id). Раньше страница с ?competition=… рисовала
   полную форму, которую невозможно отправить: человек всё заполнял и упирался в
   ошибку. Теперь без привязки к заявке показываем выбор своих оценённых заявок.
   ──────────────────────────────────────────────────────────────────────────── */
if (!$fromApp) {
    $cu     = current_user();
    $myApps = [];
    if ($cu) {
        $myApps = all(
            "SELECT a.id, a.number, a.full_name, a.group_name, a.is_group, a.work_title, a.result,
                    c.name AS comp_name, c.results_mode, c.results_published_at
               FROM applications a
               LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE a.user_id = ? AND COALESCE(a.result,'') <> '' AND COALESCE(a.status,'') <> 'rejected'
                AND ( (COALESCE(c.results_mode,'') = 'list' AND COALESCE(c.results_published_at,'') <> '')
                   OR (COALESCE(c.results_mode,'') <> 'list' AND COALESCE(a.result_sent_at,'') <> '') )
              ORDER BY a.id DESC", [(int) $cu['id']]
        );
    }
    ob_start(); ?>
<section class="section section--hero-sub">
  <div class="container">
    <div class="section-head reveal">
      <h1>Заказ наградного материала</h1>
      <p>Награды изготавливаются по конкретной оценённой заявке — так состав наград и данные в дипломах точно совпадают с решением жюри.</p>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container" style="max-width:760px">

    <?php if ($myApps): ?>
      <div class="card reveal" style="padding:26px 26px 20px">
        <h3 style="margin:0 0 6px">Выберите заявку</h3>
        <p style="color:var(--muted);margin:0 0 18px">По каждой заявке доступен свой состав наград — строго по присвоенному результату.</p>
        <?php foreach ($myApps as $a):
            $who = ((int) ($a['is_group'] ?? 0) === 1 && trim((string) ($a['group_name'] ?? '')) !== '')
                 ? (string) $a['group_name'] : (string) $a['full_name']; ?>
          <a class="order-pick" href="<?= url('/order-awards') ?>?app=<?= (int) $a['id'] ?>">
            <span class="order-pick-main">
              <b><?= h($who) ?></b>
              <span class="order-pick-sub"><?= h((string) $a['comp_name']) ?><?= trim((string) $a['work_title']) !== '' ? ' — ' . h(wt_show((string) $a['work_title'])) : '' ?></span>
            </span>
            <span class="order-pick-res"><?= h((string) $a['result']) ?></span>
          </a>
        <?php endforeach; ?>
      </div>
    <?php elseif ($cu): ?>
      <div class="card reveal" style="padding:30px 26px;text-align:center">
        <h3 style="margin:0 0 10px">Оценённых заявок пока нет</h3>
        <p style="color:var(--muted);margin:0 0 20px">Заказ наградного материала откроется сразу после того, как результат аттестации придёт Вам на почту.</p>
        <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку на конкурс</a>
        <a class="btn btn--ghost" href="<?= url('/cabinet') ?>" style="margin-left:8px">Личный кабинет</a>
      </div>
    <?php else: ?>
      <div class="card reveal" style="padding:30px 26px;text-align:center">
        <h3 style="margin:0 0 10px">Войдите в личный кабинет</h3>
        <p style="color:var(--muted);margin:0 0 20px">Награды заказываются по Вашей оценённой заявке — для этого нужен вход в кабинет.</p>
        <a class="btn btn--primary" href="<?= url('/login') ?>?next=<?= urlencode('/order-awards') ?>">Войти</a>
        <a class="btn btn--ghost" href="<?= url('/register') ?>" style="margin-left:8px">Зарегистрироваться</a>
      </div>
    <?php endif; ?>

    <div class="card reveal award-note" style="margin-top:22px">
      <div class="award-note-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>
      </div>
      <div>
        <h3>Важно перед оформлением</h3>
        <ul>
          <li>Заявка на изготовление наградного материала оформляется только после оглашения результатов конкурса — по Вашему личному решению и на добровольной основе.</li>
          <li>Стоимость доставки оригиналов оплачивается отдельно заказчиком при получении — наложенным платежом.</li>
          <li>Организационный взнос за аттестованный конкурсный материал возврату не подлежит. При возврате посылки по вине заказчика повторная отправка производится полностью за его счёт.</li>
        </ul>
      </div>
    </div>

  </div>
</section>
<style>
.order-pick{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;margin-bottom:10px;
  border:1px solid var(--line);border-radius:14px;text-decoration:none;color:inherit;transition:.18s}
.order-pick:hover{border-color:var(--gold);box-shadow:var(--shadow-soft);transform:translateY(-1px)}
.order-pick-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.order-pick-sub{color:var(--muted);font-size:.9rem}
.order-pick-res{flex:none;font-weight:700;color:var(--gold-ink);white-space:nowrap;font-size:.92rem}
[data-theme="dark"] .order-pick-res{color:var(--gold)}
.award-note{display:flex;gap:16px;align-items:flex-start;background:var(--gold-soft)}
.award-note-ic{width:46px;height:46px;flex:none;border-radius:14px;background:var(--panel-solid);border:1px solid var(--glass-brd);
  display:flex;align-items:center;justify-content:center;color:var(--gold-ink)}
.award-note-ic svg{width:24px;height:24px}
.award-note h3{margin:2px 0 10px;font-size:1.1rem}
.award-note ul{padding-left:18px;color:var(--text-dim);margin:0;line-height:1.5}
.award-note li{margin-bottom:8px}
@media(max-width:560px){.order-pick{flex-direction:column;align-items:flex-start;gap:6px}}
</style>
<?php
    $content = ob_get_clean();
    render_page('Заказ наградного материала', $content,
        ['active' => '/awards', 'meta' => 'Заказ наградного материала Культурного центра «Музыкальный Мир» по оценённой заявке участника.']);
    return;
}

// Результаты аттестации - из общей шкалы оценивания.
$results = [];
foreach (GRADE_SCALE() as [$lo, $hi, $title]) { $results[$title] = true; }
$results = array_keys($results);

// Прайс: индивидуальный по конкурсу поверх общего шаблона (competition_id IS NULL).
$allPrices = all("SELECT * FROM awards_prices ORDER BY item, kind");
$general = []; $byComp = [];
foreach ($allPrices as $p) {
    $key = $p['item'] . '||' . $p['kind'];
    if ($p['competition_id'] === null) { $general[$key] = (int)$p['price']; }
    else { $byComp[(int)$p['competition_id']][$key] = (int)$p['price']; }
}
$allKeys = array_keys($general);
foreach ($byComp as $arr) { foreach (array_keys($arr) as $k) { if (!in_array($k, $allKeys, true)) $allKeys[] = $k; } }

$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронная версия'];
$itemsMeta = [];
foreach ($allKeys as $k) {
    [$item, $kind] = explode('||', $k, 2);
    $itemsMeta[$k] = ['item' => $item, 'kind' => $kind, 'label' => $item . ' - ' . ($kindLabel[$kind] ?? $kind)];
}

$priceMatrix = [];
foreach ($comps as $c) {
    $row = [];
    foreach ($allKeys as $k) {
        $val = $byComp[$c['id']][$k] ?? ($general[$k] ?? null);
        if ($val !== null) $row[$k] = $val;
    }
    // Состав наград ограничивается правилами (core/orders.php): трофей строго по
    // результату заявки, в платном конкурсе нет электронных основного/дополнительного.
    if ($fromApp) {
        $row = award_filter_prices($row, $appResultLock, (int)($c['is_paid'] ?? 0) === 1);
    }
    $priceMatrix[$c['slug']] = $row;
}

/* ОСНОВНОЙ ДИПЛОМ — УСЛОВИЕ ДЛЯ ДОПОЛНЕНИЙ (правило центра, 28.08.2026).
 * Здесь готовятся два факта для формы: платный ли конкурс (тогда правило не
 * действует — диплом входит в оргвзнос) и есть ли основной диплом у этой заявки
 * уже сейчас (заказан и оплачен раньше либо выпущен). Сам запрет держит сервер. */
$compPaidBySlug = [];
foreach ($comps as $c) $compPaidBySlug[(string) $c['slug']] = (int) ($c['is_paid'] ?? 0) === 1;

$baseAlready = false;
if ($fromApp) {
    $__aid = (int) $fromApp['id'];
    try {
        foreach (all("SELECT items FROM awards_orders WHERE application_id=?
                       AND status IN ('paid','made','shipped','delivered','sent')", [$__aid]) as $__o) {
            foreach ((array) json_decode((string) ($__o['items'] ?? '[]'), true) as $__pi) {
                if (is_array($__pi) && award_is_base((string) ($__pi['item'] ?? ''))) { $baseAlready = true; break 2; }
            }
        }
        if (!$baseAlready && one("SELECT id FROM diplomas WHERE application_id=? AND type IN ('main','named') LIMIT 1", [$__aid])) {
            $baseAlready = true;
        }
    } catch (\Throwable $e) { $baseAlready = false; }
}

$icoCard = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';

ob_start(); ?>
<style>
/* ===== Премиум-стили формы заказа наград (глобальный style.css не трогаем) ===== */
.order-wrap{max-width:760px;margin:0 auto}

/* Памятка перед оформлением */
.award-note{display:flex;gap:16px;align-items:flex-start;background:var(--gold-soft);margin-bottom:24px}
.award-note-ic{width:46px;height:46px;flex:none;border-radius:14px;background:var(--panel-solid);border:1px solid var(--glass-brd);
  display:flex;align-items:center;justify-content:center;color:var(--gold-ink);box-shadow:var(--shadow-soft)}
.award-note-ic svg{width:24px;height:24px}
[data-theme="dark"] .award-note-ic{color:var(--gold)}
.award-note h3{margin:2px 0 10px;font-size:1.1rem}
.award-note ul{padding-left:18px;color:var(--text-dim);margin:0;line-height:1.5}
.award-note li{margin-bottom:8px}
.award-note li:last-child{margin-bottom:0}
@media(max-width:480px){.award-note{gap:12px;padding:20px 16px}.award-note-ic{width:40px;height:40px}}

/* Карточка формы */
.order-card{padding:30px 30px 26px;position:relative;overflow:hidden}
.order-card::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--grad-gold);opacity:.9}
@media(max-width:560px){.order-card{padding:24px 18px}}

/* Заголовок секции с номером */
.order-sec-head{display:flex;align-items:center;gap:12px;margin:30px 0 18px}
.order-sec-head:first-of-type{margin-top:4px}
.order-sec-n{width:30px;height:30px;flex:none;border-radius:50%;background:var(--grad-gold);color:var(--gold-fg);
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-serif);font-weight:800;font-size:1rem;box-shadow:var(--shadow-btn)}
.order-sec-head h3{margin:0;font-size:1.16rem}

/* Floating-label поля */
.field.ff{position:relative}
.field.ff>label{position:absolute;left:16px;top:15px;margin:0;padding:0 2px;pointer-events:none;z-index:2;
  font-weight:600;font-size:.9rem;color:var(--muted);background:transparent;transform-origin:left top;
  max-width:calc(100% - 40px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  transition:transform .16s ease,color .16s ease}
.field.ff>input,.field.ff>textarea{padding-top:22px;padding-bottom:8px}
.field.ff>textarea{padding-top:26px}
.field.ff:has(>input:focus)>label,.field.ff:has(>input:not(:placeholder-shown))>label,
.field.ff:has(>textarea:focus)>label,.field.ff:has(>textarea:not(:placeholder-shown))>label{
  transform:translateY(-9px) scale(.78);color:var(--gold-ink)}
[data-theme="dark"] .field.ff:has(>input:focus)>label,
[data-theme="dark"] .field.ff:has(>textarea:focus)>label{color:var(--gold)}

/* Позиции наградного материала (JS рисует .award-item внутри #awardItems) */
.award-box{border:1.5px solid var(--glass-brd);border-radius:var(--radius-sm);padding:6px 10px;background:var(--glass);backdrop-filter:blur(8px)}
.award-box>p{color:var(--muted);margin:14px 6px!important}
.award-box>label{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:12px!important;
  padding:14px 12px!important;margin:2px 0!important;min-height:54px;cursor:pointer;
  border:1px solid transparent!important;border-bottom:1px solid var(--line)!important;border-radius:12px!important;
  transition:background .16s,border-color .16s}
.award-box>label:last-child{border-bottom-color:transparent!important}
@media(hover:hover){.award-box>label:hover{background:var(--gold-soft)!important;border-color:var(--glass-brd)!important}}
.award-box>label:has(.award-item:checked){background:var(--gold-soft)!important;border-color:var(--gold)!important}
.award-box>label>span:first-child{display:flex;align-items:center;flex:1;min-width:0;overflow-wrap:anywhere;color:var(--text)}
.award-box .award-item{width:22px!important;height:22px!important;min-height:22px!important;margin:0 12px 0 0!important;
  accent-color:var(--gold);cursor:pointer;flex:none}
.award-box>label b{white-space:nowrap;font-family:var(--ff-body);font-weight:800;font-size:1rem;color:var(--gold-ink)}
[data-theme="dark"] .award-box>label b{color:var(--gold)}

/* Блок получателя */
.recipient-hint{margin:-6px 0 16px}

/* Итоговая сумма */
.total-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;
  padding:18px 22px;margin:8px 0 22px;border:1.5px solid var(--gold);border-radius:var(--radius);
  background:var(--gold-soft);box-shadow:var(--shadow-soft)}
.total-bar .total-lbl{font-weight:700;color:var(--text)}
.total-bar .total-sum{font-family:var(--ff-display);font-size:clamp(1.7rem,7vw,2.1rem);line-height:1;letter-spacing:.02em;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}

/* Способ оплаты */
.pay-method{display:flex!important;align-items:center;gap:14px;cursor:pointer;padding:16px 18px;border:1.5px solid var(--gold);
  border-radius:var(--radius-sm);background:var(--panel);backdrop-filter:blur(10px);box-shadow:0 0 0 3px var(--gold-soft)}
.pay-method input{width:auto!important;min-height:0!important;flex:none;accent-color:var(--gold);width:20px!important;height:20px!important}
.pay-method .pay-ic{width:34px;height:34px;flex:none;color:var(--gold-ink);display:flex;align-items:center;justify-content:center}
.pay-method .pay-ic svg{width:34px;height:34px;display:block}
[data-theme="dark"] .pay-method .pay-ic{color:var(--gold)}
.pay-method b{color:var(--text)}

#formMsg{text-align:center;margin-top:14px;font-weight:600;min-height:1.2em}

/* ===== Моушен-микровзаимодействия (только transform/opacity) ===== */
.award-box>label{transition:background .16s,border-color .16s,transform .12s!important}
.award-box>label:active{transform:scale(.995)}
.award-box .award-item{transition:transform .12s}
.award-box>label:has(.award-item:checked) .award-item{transform:scale(1.08)}
.pay-method{transition:box-shadow .2s,transform .12s}
.pay-method:active{transform:scale(.995)}
.order-sec-n{transition:transform .2s,box-shadow .2s}
.total-sum{transition:transform .2s ease;will-change:transform}
#submitBtn{transition:transform .12s,box-shadow .2s,background .2s}
#submitBtn:active{transform:translateY(1px)}

/* ===== Адаптив 360/390: без горизонтального оверфлоу и кривых переносов ===== */
.order-card input,.order-card select,.order-card textarea{max-width:100%}
#submitBtn{word-break:normal;overflow-wrap:normal;white-space:normal}
.total-bar{overflow-wrap:anywhere}

/* ===== Уважение к prefers-reduced-motion ===== */
@media(prefers-reduced-motion:reduce){
  .award-box>label,.award-item,.pay-method,.order-sec-n,.total-sum,#submitBtn{transition:none!important}
  .award-box>label:active,.pay-method:active,#submitBtn:active,
  .award-box>label:has(.award-item:checked) .award-item{transform:none}
}
</style>

<section class="section section--parchment">
  <div class="container" style="max-width:760px">
    <div class="section-head reveal">
      <p class="eyebrow">Награды</p>
      <h2>Оплата наград</h2>
      <div class="gold-rule"></div>
      <p>Отметьте нужные позиции - сумма пересчитывается сразу. Заказ оформляется после оплаты.</p>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container" style="max-width:760px">
    <div class="order-wrap">

    <div class="card reveal award-note">
      <div class="award-note-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>
      </div>
      <div>
        <h3>Важно перед оформлением</h3>
        <ul>
          <li>Заявка на изготовление наградного материала оформляется только после оглашения результатов конкурса - по Вашему личному решению и на добровольной основе.</li>
          <li>Стоимость доставки оригиналов оплачивается отдельно заказчиком при получении - наложенным платежом.</li>
          <li>Организационный взнос за аттестованный конкурсный материал возврату не подлежит. При возврате посылки по вине заказчика повторная отправка производится полностью за его счёт.</li>
        </ul>
      </div>
    </div>

    <form id="awardsOrderForm" class="card reveal order-card" novalidate data-app-result="<?= h($appResultLock) ?>">
      <?= csrf_field() ?>
      <?php if ($fromApp): ?>
        <input type="hidden" name="application_id" value="<?= (int)$fromApp['id'] ?>">
        <div class="award-note" style="margin:0 0 6px;background:var(--gold-soft);padding:14px 16px;border-radius:14px">
          <div>
            <b style="color:var(--gold-ink)">Заказ по заявке <?= h($fromApp['number']) ?></b> —
            <?= h($fromApp['comp_name']) ?>, результат: <b><?= h($appResultLock) ?></b>.
            <div class="hint" style="margin-top:4px">Данные подставлены из Вашей заявки — проверьте и выберите, что изготовить.</div>
          </div>
        </div>
      <?php endif; ?>

      <div class="order-sec-head"><span class="order-sec-n">1</span><h3>Данные участника</h3></div>

      <div class="field ff">
        <input type="text" id="fullName" name="full_name" placeholder=" " required value="<?= h($pf['full_name']) ?>">
        <label for="fullName">ФИО участника / название коллектива</label>
        <span class="err-msg">Укажите ФИО участника или название коллектива.</span>
      </div>

      <div class="grid grid-2">
        <div class="field ff">
          <input type="text" id="ageCategory" name="age_category" placeholder=" " required value="<?= h($pf['age_category']) ?>">
          <label for="ageCategory">Возрастная категория</label>
          <span class="hint">Например, 10-12 лет.</span>
          <span class="err-msg">Укажите возрастную категорию.</span>
        </div>
        <div class="field ff">
          <input type="text" id="nomination" name="nomination" placeholder=" " required value="<?= h($pf['nomination']) ?>">
          <label for="nomination">Номинация</label>
          <span class="hint">Например, вокал, эстрадный.</span>
          <span class="err-msg">Укажите номинацию.</span>
        </div>
      </div>

      <div class="field ff">
        <input type="text" id="teacher" name="teacher" placeholder=" " value="<?= h($pf['teacher']) ?>">
        <label for="teacher">ФИО педагога / название учреждения</label>
        <span class="hint">Заполняется, если нужен именной диплом или благодарность педагогу.</span>
      </div>

      <div class="field ff">
        <input type="text" id="actTitle" name="act_title" placeholder=" " required value="<?= h($pf['act_title']) ?>">
        <label for="actTitle">Название конкурсного номера</label>
        <span class="hint">Например, «Аве Мария».</span>
        <span class="err-msg">Укажите название конкурсного номера.</span>
      </div>

      <div class="grid grid-2">
        <div class="field">
          <label for="competition">Конкурс</label>
          <?php if ($fromApp): ?>
            <!-- Заказ по конкретной заявке: конкурс и результат фиксированы её данными. -->
            <select id="competition" name="competition" required disabled style="opacity:.75">
              <option value="<?= h((string)$fromApp['comp_slug']) ?>" selected><?= h((string)$fromApp['comp_name']) ?></option>
            </select>
            <input type="hidden" name="competition" value="<?= h((string)$fromApp['comp_slug']) ?>">
          <?php else: ?>
            <select id="competition" name="competition" required>
              <option value="">Выберите конкурс</option>
              <?php foreach ($comps as $c): ?>
                <option value="<?= h($c['slug']) ?>" <?= $preselect === $c['slug'] ? 'selected' : '' ?>><?= h($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          <?php endif; ?>
          <span class="err-msg">Выберите конкурс.</span>
        </div>
        <div class="field">
          <label for="result">Аттестационный результат</label>
          <?php if ($appResultLock !== ''): ?>
            <!-- Результат берётся из аттестации заявки и не выбирается вручную: состав
                 наград (кубок/статуэтка/медаль) определяется строго им. -->
            <select id="result" name="result" required disabled style="opacity:.75">
              <option value="<?= h($appResultLock) ?>" selected><?= h($appResultLock) ?></option>
            </select>
            <input type="hidden" name="result" value="<?= h($appResultLock) ?>">
            <span class="hint">Присвоено жюри по заявке <?= h((string)($fromApp['number'] ?? '')) ?>.</span>
          <?php else: ?>
            <select id="result" name="result" required>
              <option value="">Выберите результат</option>
              <?php foreach ($results as $r): ?>
                <option value="<?= h($r) ?>"><?= h($r) ?></option>
              <?php endforeach; ?>
            </select>
          <?php endif; ?>
          <span class="err-msg">Выберите аттестационный результат.</span>
        </div>
      </div>

      <div class="order-sec-head"><span class="order-sec-n">2</span><h3>Наградной материал</h3></div>

      <div class="field">
        <label>Что нужно изготовить</label>
        <div id="awardItems" class="award-box">
          <p style="color:var(--muted);margin:12px 0">Сначала выберите конкурс.</p>
        </div>
        <span class="hint">Можно отметить несколько позиций. Электронный основной диплом выдаётся бесплатно.</span>
        <span class="err-msg" id="itemsErr">Отметьте хотя бы одну позицию наградного материала.</span>
      </div>

      <div id="recipientBlock" style="display:none">
        <div class="order-sec-head"><span class="order-sec-n">3</span><h3>Получатель оригинала</h3></div>
        <p class="hint recipient-hint">Заполняется при заказе оригинала - для отправки почтой.</p>

        <div class="field ff">
          <input type="text" id="recipientName" name="recipient_name" placeholder=" ">
          <label for="recipientName">ФИО получателя</label>
          <span class="err-msg">Укажите ФИО получателя.</span>
        </div>

        <div class="field ff">
          <!-- Подсказки адреса — общий компонент assets/js/address.js через серверный
               прокси /api/v1/address_suggest (ключ DaData в браузер не попадает).
               Раньше здесь была обычная textarea без подсказок вообще. -->
          <textarea id="address" name="address" rows="3" placeholder=" "
                    data-address-suggest data-postal="#postal_index"></textarea>
          <label for="address">Полный адрес с индексом</label>
          <span class="hint">Например, 123456, город, улица, дом, квартира.</span>
          <span class="err-msg">Укажите полный адрес с индексом.</span>
        </div>

        <div class="field ff">
          <input type="tel" id="phone" name="phone" placeholder=" ">
          <label for="phone">Телефон получателя</label>
          <span class="err-msg">Укажите телефон получателя.</span>
        </div>
      </div>

      <div class="order-sec-head"><span class="order-sec-n">4</span><h3>Контакты и оплата</h3></div>

      <div class="field ff">
        <input type="email" id="email" name="email" placeholder=" " required value="<?= h($pf['email']) ?>">
        <label for="email">Электронная почта</label>
        <span class="hint">На эту почту придёт электронный наградной материал и подтверждение оплаты.</span>
        <span class="err-msg">Укажите корректную электронную почту.</span>
      </div>

      <div class="total-bar">
        <span class="total-lbl">Итоговая сумма</span>
        <b id="totalDisplay" class="total-sum">0 ₽</b>
      </div>

      <div class="field">
        <label>Способ оплаты</label>
        <label class="pay-method">
          <input type="radio" name="pay_method" value="yukassa" checked>
          <span class="pay-ic"><?= $icoCard ?></span>
          <span>
            <b>ЮKassa</b> - банковской картой<br>
            <span class="hint">После оформления заказа откроется защищённая оплата ЮKassa. Стоимость доставки - отдельно, наложенным платежом.</span>
          </span>
        </label>
      </div>

      <button class="btn btn--primary btn--lg btn--block" type="submit" id="submitBtn">Оформить заказ и перейти к оплате</button>
      <p id="formMsg"></p>
    </form>
    </div>
  </div>
</section>

<script>
(function () {
  var PRICES = <?= json_encode($priceMatrix, JSON_UNESCAPED_UNICODE) ?>;
  var META = <?= json_encode($itemsMeta, JSON_UNESCAPED_UNICODE) ?>;
  // Скидка ВИП-клуба: цены показываются перечёркнутыми, рядом — цена участника.
  var CLUB_PCT = <?= (int) $clubPct ?>;
  function clubPrice(n) { return CLUB_PCT > 0 ? Math.max(0, Math.round(n * (100 - CLUB_PCT) / 100)) : n; }

  // Правило «дополнения только вместе с основным дипломом»: платные конкурсы его
  // не касаются, участник с уже полученным дипломом — тоже.
  var COMP_PAID = <?= json_encode($compPaidBySlug, JSON_UNESCAPED_UNICODE) ?>;
  var BASE_DONE = <?= $baseAlready ? 'true' : 'false' ?>;

  var form = document.getElementById('awardsOrderForm');
  var compSel = document.getElementById('competition');
  var resultSel = document.getElementById('result');
  var itemsBox = document.getElementById('awardItems');

  // Трофей ограничен результатом: кубок=гран-при, статуэтка=лауреат, медаль=дипломант.
  // Дипломы и благодарности доступны при любом результате.
  function resultAllows(itemName) {
    var n = (itemName || '').toLowerCase();
    var res = (resultSel.value || '').toLowerCase();
    var isCup = n.indexOf('кубок') >= 0, isStat = n.indexOf('статуэтк') >= 0, isMedal = n.indexOf('медал') >= 0;
    if (!isCup && !isStat && !isMedal) return true;            // дипломы/благодарности — всегда
    if (!res) return true;                                     // результат не выбран — показываем всё
    if (isCup)   return res.indexOf('гран') >= 0;
    if (isStat)  return res.indexOf('лауреат') >= 0;
    if (isMedal) return res.indexOf('дипломант') >= 0;
    return true;
  }
  var totalEl = document.getElementById('totalDisplay');
  var recipientBlock = document.getElementById('recipientBlock');
  var recipientFields = ['recipientName', 'address', 'phone'];
  var msg = document.getElementById('formMsg');

  function money(n) { return n.toLocaleString('ru-RU') + ' ₽'; }

  function renderItems(slug) {
    var rows = PRICES[slug] || {};
    var keys = Object.keys(rows);
    if (!keys.length) {
      itemsBox.innerHTML = '<p style="color:var(--muted);margin:12px 0">Прайс для этого конкурса не заполнен. Свяжитесь с Оргкомитетом.</p>';
      recompute();
      return;
    }
    var html = '';
    keys.forEach(function (k) {
      var m = META[k] || { label: k };
      if (!resultAllows(m.item || m.label)) return;           // трофей не по результату — скрываем
      var full = rows[k], my = clubPrice(full);
      var priceHtml = CLUB_PCT > 0 && my !== full
        ? '<s style="opacity:.55;font-weight:400;margin-right:7px">' + money(full) + '</s>' + money(my)
        : money(full);
      html += '<label style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);cursor:pointer">' +
        '<span><input type="checkbox" class="award-item" data-key="' + k + '" data-price="' + my + '" data-full="' + full + '" style="width:auto;margin-right:10px">' + m.label + '</span>' +
        '<b style="white-space:nowrap">' + priceHtml + '</b></label>';
    });
    if (!html) html = '<p style="color:var(--muted);margin:12px 0">Нет доступных позиций для выбранного результата.</p>';
    itemsBox.innerHTML = html;
    recompute();
  }

  function hasOriginal() {
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    for (var i = 0; i < boxes.length; i++) {
      var m = META[boxes[i].getAttribute('data-key')] || {};
      if (m.kind === 'original') return true;
    }
    return false;
  }

  function recompute() {
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    var total = 0, totalFull = 0;
    boxes.forEach(function (b) {
      total += parseInt(b.getAttribute('data-price'), 10) || 0;
      totalFull += parseInt(b.getAttribute('data-full'), 10) || 0;
    });
    // Итог: для члена клуба — перечёркнутая полная сумма и цена со скидкой.
    totalEl.innerHTML = (CLUB_PCT > 0 && totalFull > total)
      ? '<s style="opacity:.55;font-weight:400;margin-right:8px">' + money(totalFull) + '</s>' + money(total) +
        '<span style="display:block;font-size:.8rem;color:var(--gold-2,#C79322);font-weight:700;margin-top:2px">ВИП-клуб −' + CLUB_PCT + '%</span>'
      : money(total);
    recipientBlock.style.display = hasOriginal() ? '' : 'none';
  }

  compSel.addEventListener('change', function () { renderItems(compSel.value); });
  resultSel.addEventListener('change', function () { renderItems(compSel.value); });
  itemsBox.addEventListener('change', function (e) { if (e.target.classList.contains('award-item')) recompute(); });

  if (compSel.value) renderItems(compSel.value);

  /* ДОПОЛНЕНИЯ — ТОЛЬКО ВМЕСТЕ С ОСНОВНЫМ ДИПЛОМОМ.
   *
   * Дополнительный диплом, благодарность и трофеи — дополнения к главной награде
   * участника: отдельно центр их не изготавливает. Запрет держит сервер, а здесь
   * человеку объясняют правило до оплаты и сразу дают выход — одна кнопка
   * отмечает нужную позицию. Вид подбирается под уже выбранное: только
   * электронные — электронный диплом, есть оригинал или трофей — оригинал. */
  function isBaseName(n) { return /основн|именн/i.test(n || ''); }
  function baseNeed() {
    if (COMP_PAID[compSel.value]) return null;   // в платном диплом входит в участие
    if (BASE_DONE) return null;                  // диплом по этой заявке уже есть
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    var hasBase = false, blocked = null, needOriginal = false;
    for (var i = 0; i < boxes.length; i++) {
      var m = META[boxes[i].getAttribute('data-key')] || {};
      var nm = m.item || '';
      if (isBaseName(nm)) { hasBase = true; continue; }
      if (!blocked) blocked = nm;
      if (m.kind !== 'digital') needOriginal = true;
    }
    if (hasBase || !blocked) return null;
    return { blocked: blocked, kind: needOriginal ? 'original' : 'digital' };
  }
  function baseCheckbox(kind) {
    var boxes = itemsBox.querySelectorAll('.award-item');
    for (var i = 0; i < boxes.length; i++) {
      var m = META[boxes[i].getAttribute('data-key')] || {};
      if ((m.item || '') === 'Основной диплом' && m.kind === kind) return boxes[i];
    }
    return null;
  }
  /* ВИД ОСНОВНОГО ДИПЛОМА ВЫБИРАЕТ ЧЕЛОВЕК.
   *
   * Правило требует сам диплом, а не его вид: электронный основной прекрасно
   * сочетается с оригиналом благодарности, а оригинал основного — с электронным
   * дополнительным. В окне обе кнопки; первой стоит та, что подходит к набранному
   * заказу, но вторая доступна всегда. */
  function basePopup(need) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(10,14,30,.55)';
    var kinds = [need.kind, need.kind === 'digital' ? 'original' : 'digital'];
    var btns = '';
    kinds.forEach(function (k, i) {
      var box = baseCheckbox(k);
      if (!box) return;                                   // такого вида нет в прайсе конкурса
      var price = parseInt(box.getAttribute('data-price'), 10) || 0;
      var vid = k === 'digital' ? 'электронный' : 'оригинал на бланке';
      btns += '<button type="button" class="btn ' + (i === 0 ? 'btn--primary' : 'btn--ghost') +
              '" data-kind="' + k + '">Основной диплом — ' + vid + (price ? ' · ' + price + ' ₽' : '') + '</button>';
    });
    wrap.innerHTML =
      '<div class="card" style="max-width:460px;width:100%;padding:26px 24px;text-align:center">' +
      '<h3 style="margin:0 0 10px">Нужен основной диплом</h3>' +
      '<p style="color:var(--muted);margin:0 0 18px;line-height:1.6">У Вас нет основного диплома по Вашему аттестационному результату. «' +
        need.blocked + '» — дополнение к нему, отдельно он не изготавливается. ' +
        'Добавьте основной диплом — вид выбирайте любой, он не обязан совпадать с остальными позициями.</p>' +
      '<div style="display:flex;flex-direction:column;gap:9px">' + btns +
      '<button type="button" class="btn btn--ghost" data-close>Вернуться к выбору</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.querySelector('[data-close]').onclick = close;
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-kind]').forEach(function (b) {
      b.onclick = function () {
        var box = baseCheckbox(b.getAttribute('data-kind'));
        if (box) { box.checked = true; recompute(); }
        close();
        msg.style.color = 'var(--mint)';
        msg.textContent = 'Основной диплом добавлен. Проверьте сумму и нажмите «Оформить заказ».';
      };
    });
  }
  function ensureBaseDiploma() {
    var need = baseNeed();
    if (!need) return true;
    basePopup(need);
    return false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    var ok = form.checkValidity();

    var itemsField = document.getElementById('itemsErr').parentNode;
    if (!boxes.length) { itemsField.classList.add('error'); ok = false; }
    else { itemsField.classList.remove('error'); }

    // Реквизиты получателя обязательны только при заказе оригинала.
    if (hasOriginal()) {
      recipientFields.forEach(function (id) {
        var el = document.getElementById(id);
        var wrap = el.closest('.field');
        if (!el.value.trim()) { wrap.classList.add('error'); ok = false; }
        else { wrap.classList.remove('error'); }
      });
    } else {
      recipientFields.forEach(function (id) { document.getElementById(id).closest('.field').classList.remove('error'); });
    }

    if (!ok) { form.reportValidity(); return; }
    if (!ensureBaseDiploma()) return;

    var items = [];
    var amount = 0;
    boxes.forEach(function (b) {
      var k = b.getAttribute('data-key'), price = parseInt(b.getAttribute('data-price'), 10) || 0;
      var m = META[k] || {};
      items.push({ item: m.item || k, kind: m.kind || '', price: price });
      amount += price;
    });

    var payload = new FormData(form);
    payload.append('items', JSON.stringify(items));
    payload.append('amount', amount);

    var btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Отправляем...';
    fetch('<?= url('/api/v1/order') ?>', { method: 'POST', body: payload })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false; btn.textContent = 'Оформить заказ и перейти к оплате';
        if (d && d.ok) {
          if (d.payment && d.payment.confirmation_url) {
            msg.style.color = 'var(--mint)';
            msg.textContent = 'Заказ оформлен. Переходим к оплате...';
            window.location.href = d.payment.confirmation_url;
            return;
          }
          msg.style.color = 'var(--mint)';
          msg.textContent = d.message || 'Заказ оформлен. Переход к оплате ЮKassa будет доступен после подключения магазина.';
          form.reset(); itemsBox.innerHTML = '<p style="color:var(--muted);margin:12px 0">Сначала выберите конкурс.</p>';
          totalEl.textContent = money(0); recipientBlock.style.display = 'none';
        } else if (d && d.need_base) {
          // Сервер знает больше страницы (например, прошлый заказ не оплачен) —
          // показываем то же окно с кнопкой, а не голый текст ошибки.
          basePopup({ blocked: d.need_base.blocked || 'Эта позиция', kind: d.need_base.kind || 'digital' });
        } else {
          msg.style.color = 'var(--error)';
          msg.textContent = (d && d.message) || (d && d.error) || 'Не удалось отправить заказ. Попробуйте ещё раз.';
        }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Оформить заказ и перейти к оплате';
        msg.style.color = 'var(--mint)';
        msg.textContent = 'Заказ принят. Оргкомитет свяжется с Вами для оплаты.';
        form.reset(); recipientBlock.style.display = 'none';
      });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Заказ наградного материала', $content, ['active' => '/awards', 'meta' => 'Оформление заказа наградного материала: кубки, статуэтки, медали и дипломы Культурного центра «Музыкальный Мир». Оплата ЮKassa.']);
