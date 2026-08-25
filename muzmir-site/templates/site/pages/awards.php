<?php
/**
 * Награды — 2 уровня:
 *   1) без ?comp — витрина: заголовок «Образцы наград» + ВЫБОР КОНКУРСА (широкие карточки).
 *   2) ?comp=<id> — сетка образцов 1:1 (фото/медальон) с количеством и корзиной → ЮKassa.
 * Заказ привязывается к конкурсу и заявке на участие.
 */
$u = current_user();

// Список для ВЫБОРА (уровень 1) — конкурсы, по которым заказ наград ещё открыт:
// идёт приём ИЛИ не прошло два месяца со дня закрытия приёма (awards_window_open).
// Раньше здесь стояло status='open', и 25-го числа в 18:00 вместе с приёмом
// закрывалась вся витрина образцов — как раз когда участники идут заказывать
// кубки по своим результатам. Порядок: сначала те, где приём идёт, дальше по
// дате закрытия приёма — свежие сверху, прошлые уходят вниз и исчезают сами,
// когда окно заказа истекает.
require_once BASE_PATH . '/core/orders.php';
$comps = array_values(array_filter(
    all("SELECT id, slug, name, type, direction, cover, diploma_bg, end_date, nominations, is_paid, status
           FROM competitions
          WHERE COALESCE(launched,0) = 1 AND status <> 'draft'
       ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END, end_date DESC, sort, id"),
    'awards_window_open'
));

// Выбранный конкурс (уровень 2 — образцы наград и заказ). Загружаем НЕЗАВИСИМО от гейта витрины:
// заказать награды можно по ЛЮБОМУ реальному конкурсу (в т.ч. с уже опубликованными результатами,
// после приёма) — иначе кубки/статуэтки/медали пропадали бы из заказа после закрытия приёма.
$compId = isset($_GET['comp']) ? (int) $_GET['comp'] : 0;
$selComp = null;
foreach ($comps as $c) { if ((int)$c['id'] === $compId) { $selComp = $c; break; } }
if (!$selComp && $compId > 0) {
    $selComp = one("SELECT id, slug, name, type, direction, cover, diploma_bg, end_date, nominations, is_paid, status
                      FROM competitions WHERE id=? AND status <> 'draft'", [$compId]);
    // Окно заказа по этому конкурсу могло истечь: два месяца прошли, награды
    // больше не изготавливаются. Показывать каталог с корзиной в этом случае
    // нечестно — человек соберёт заказ и упрётся в отказ на оплате.
    if ($selComp && !awards_window_open((array) $selComp)) $selComp = null;
}

/* Канонизация названий переехала в core/orders.php (award_canon_item): один и тот же
   кубок был заведён и как «Кубок», и как «Кубок Гран-при» — в форме заказа он двоился.
   Теперь имя приводится к одному во ВСЕХ каталогах наград. */
require_once BASE_PATH . '/core/orders.php';
function aw_canon_item(string $item): string { return award_canon_item($item); }

// Прайс: общий шаблон + индивидуальные цены конкурса ПОВЕРХ него (мердж, а не «или-или»),
// чтобы кубок/статуэтка/медаль присутствовали у любого конкурса, а цены конкурса переопределяли.
$catalog = [];
if ($selComp) {
    $gen  = all("SELECT item, kind, price FROM awards_prices WHERE competition_id IS NULL ORDER BY price DESC");
    $comp = all("SELECT item, kind, price FROM awards_prices WHERE competition_id=? ORDER BY price DESC", [$compId]);
    foreach ($gen as $p)  { $it = aw_canon_item((string) $p['item']); if ($it !== '') $catalog[$it][$p['kind']] = (int) $p['price']; }
    foreach ($comp as $p) { $it = aw_canon_item((string) $p['item']); if ($it !== '') $catalog[$it][$p['kind']] = (int) $p['price']; }
}

$meta = [
  // Кубок/статуэтка/медаль — при увеличении показываем ТОЛЬКО подпись (без описания).
  'Кубок Гран-при'        => ['ic'=>'cup',    'slug'=>'cup',      'tag'=>'Высшая награда', 'desc'=>''],
  'Статуэтка лауреата'    => ['ic'=>'trophy', 'slug'=>'statuette', 'tag'=>'', 'desc'=>''],
  'Медаль дипломанта'     => ['ic'=>'medal',  'slug'=>'medal',    'tag'=>'', 'desc'=>''],
  'Основной диплом'       => ['ic'=>'diploma','slug'=>'diploma',  'tag'=>'', 'desc'=>'Официальный диплом с итогом выступления. Присуждается по результату: ГРАН-ПРИ · ЛАУРЕАТ I, II, III степени · ДИПЛОМАНТ I, II, III степени · УЧАСТНИК. Электронный — бесплатно, оригинал — на плотной дизайнерской бумаге с печатями и подписями.'],
  'Дополнительный диплом' => ['ic'=>'diploma','slug'=>'diploma2', 'tag'=>'', 'desc'=>'Диплом за специальную номинацию: ЗА АРТИСТИЗМ · ЗА ПАТРИОТИЗМ · ЗА ОРИГИНАЛЬНОЕ ИСПОЛНЕНИЕ · ЗА ВЕРНОСТЬ ТРАДИЦИЯМ и другие. Дополняет основной диплом.'],
  'Именной диплом'        => ['ic'=>'diploma','slug'=>'diploma-name','tag'=>'Для одного из участников коллектива', 'desc'=>'Для одного из участников коллектива: то же звание, что у коллектива (ГРАН-ПРИ · ЛАУРЕАТ · ДИПЛОМАНТ · УЧАСТНИК), но с ФИО конкретного участника и названием коллектива в дипломе.'],
  'Благодарность'         => ['ic'=>'thanks', 'slug'=>'thanks',   'tag'=>'', 'desc'=>'Именная благодарность педагогу, концертмейстеру или руководителю коллектива за подготовку участников.'],
];
$icons = [
  'cup'     => '<path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/>',
  'trophy'  => '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/>',
  'medal'   => '<circle cx="12" cy="15" r="6"/><path d="M9 3h6l-2 6h-2z"/><path d="M12 12v6"/>',
  'diploma' => '<path d="M6 2h9l3 3v17H6z"/><path d="M15 2v3h3M9 12h6M9 16h4"/>',
  'thanks'  => '<path d="M20.8 4.6c-1.7-1.7-4.4-1.7-6 0L12 7.4 9.2 4.6c-1.7-1.7-4.4-1.7-6 0-1.7 1.7-1.7 4.4 0 6L12 19l8.8-8.4c1.7-1.6 1.7-4.3 0-6z"/>',
];
$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронный', 'club' => 'Клуб'];

// Скидка ВИП-клуба (20%) действует и в каталоге наград: цена показывается
// перечёркнутой, рядом — цена участника клуба. Сервер считает сумму сам
// (api/v1/order.php), здесь — честное отображение, чтобы итог совпадал.
$clubPct = 0;
if ($u && is_file(BASE_PATH . '/core/club.php')) {
    require_once BASE_PATH . '/core/club.php';
    if (function_exists('club_discount_percent')) $clubPct = (int) club_discount_percent((int) $u['id']);
}
/** Цена для участника клуба. */
$clubPrice = static function (int $p) use ($clubPct): int {
    return $clubPct > 0 ? (int) max(0, round($p * (100 - $clubPct) / 100)) : $p;
};
$order = ['Кубок Гран-при','Статуэтка лауреата','Медаль дипломанта','Основной диплом','Дополнительный диплом','Именной диплом','Благодарность'];

// Заявки пользователя (для оформления).
$myApps = [];
if ($u) {
    $myApps = all("SELECT a.id, a.number, a.competition_id, a.full_name, a.result, a.status,
                          c.name AS comp_name, c.slug AS comp_slug,
                          c.results_mode AS comp_rmode, c.results_published_at AS comp_rpub
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.user_id=? ORDER BY a.created_at DESC", [(int)$u['id']]);
}

/** Фото образца: сначала под конкретный конкурс (img/awards/<compId>/<slug>.jpg),
 *  затем общий (img/awards/<slug>.jpg), иначе null (фолбэк на медальон). */
function award_photo(string $slug, int $compId = 0): ?string {
    $cands = [];
    if ($compId) $cands[] = "img/awards/$compId/$slug.jpg";
    $cands[] = "img/awards/$slug.jpg";
    foreach ($cands as $rel) {
        $abs = BASE_PATH . '/public/assets/' . $rel;
        // Антикэш по mtime: nginx отдаёт картинки с max-age=30d, без версии
        // заменённое фото на сайте не обновлялось бы.
        if (is_file($abs)) return asset($rel) . '?v=' . filemtime($abs);
    }
    return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ЗАКАЗ ПО КОНКРЕТНОЙ ЗАЯВКЕ: /awards?comp=<id>&app=<id>.
   Так сюда ведёт кнопка «Заказать награды» из личного кабинета — участник видит
   тот же раздел с образцами и корзиной, но состав ограничен его аттестационным
   результатом: гран-при → только кубок, лауреат → только статуэтка, дипломант →
   только медаль. Дипломы и благодарности доступны при любом результате.
   ──────────────────────────────────────────────────────────────────────────── */
$appLock = null;                     // заявка, по которой заказываем
$appLockResult = '';                 // её аттестационный результат
$appId = (int) input('app', '');
if ($appId > 0 && $u) {
    $ar = one("SELECT a.id, a.number, a.result, a.result_sent_at, a.competition_id,
                      c.results_mode, c.results_published_at, c.name AS comp_name
                 FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
                WHERE a.id = ? AND a.user_id = ?", [$appId, (int) $u['id']]);
    // Заказ открыт только когда результат реально дошёл до участника.
    $delivered = $ar && (((string) ($ar['results_mode'] ?? '') === 'list')
        ? trim((string) ($ar['results_published_at'] ?? '')) !== ''
        : trim((string) ($ar['result_sent_at'] ?? '')) !== '');
    if ($ar && trim((string) $ar['result']) !== '' && $delivered) {
        $appLock = $ar;
        $appLockResult = (string) $ar['result'];
        // Конкурс берём из ЗАЯВКИ — чтобы состав и цены точно соответствовали ей.
        if (!$selComp || (int) $selComp['id'] !== (int) $ar['competition_id']) {
            $compId  = (int) $ar['competition_id'];
            $selComp = one("SELECT id, slug, name, type, direction, cover, diploma_bg, end_date, nominations, is_paid
                              FROM competitions WHERE id=?", [$compId]);
            // Прайс пересобираем под конкурс заявки.
            $catalog = [];
            if ($selComp) {
                $gen  = all("SELECT item, kind, price FROM awards_prices WHERE competition_id IS NULL ORDER BY price DESC");
                $cmp  = all("SELECT item, kind, price FROM awards_prices WHERE competition_id=? ORDER BY price DESC", [$compId]);
                foreach ($gen as $p) { $it = aw_canon_item((string) $p['item']); if ($it !== '') $catalog[$it][$p['kind']] = (int) $p['price']; }
                foreach ($cmp as $p) { $it = aw_canon_item((string) $p['item']); if ($it !== '') $catalog[$it][$p['kind']] = (int) $p['price']; }
            }
        }
    }
}

ob_start(); ?>

<?php if (!$selComp): /* ═══════════ УРОВЕНЬ 1 — выбор конкурса ═══════════ */ ?>
<section class="section aw-page" style="padding-top:12px">
  <div class="container" style="max-width:840px">
    <div class="section-head reveal" style="text-align:left;margin-bottom:12px">
      <p class="eyebrow eyebrow--script" style="margin:0">Наградная продукция</p>
      <h1 class="aw-title">Образцы наград</h1>
      <p style="color:var(--muted);margin:0;font-size:.92rem">Выберите конкурс — покажем образцы дипломов, кубков, медалей и статуэток с ценами. Заказ оформляется по вашей заявке на участие.</p>
    </div>

    <div class="aw-comp-list">
      <?php foreach ($comps as $i => $c):
        // Фон карточки награды — ТОЛЬКО пустой шаблон диплома (diploma_bg).
        // Фолбэка на афишу (cover) здесь быть не должно: афиша и фон диплома —
        // разные материалы, подмена одного другим сразу видна и выглядит браком.
        $tpl = trim((string)($c['diploma_bg'] ?? ''));
        $coverUrl = $tpl !== '' ? (preg_match('~^https?://~', $tpl) ? $tpl : url('/' . ltrim($tpl, '/'))) : '';
        $scope = ($c['type'] === 'international') ? 'Международный' : 'Всероссийский';
      ?>
      <?php $dirMap=['multi'=>'Многожанровый','patriotic'=>'Патриотический','vocal'=>'Вокал','instrumental'=>'Инструментальный','dance'=>'Хореография','art'=>'ИЗО и ДПИ'];
            $dir = $dirMap[(string)$c['direction']] ?? ($c['direction'] ?: 'Многожанровый');
            $awStyle = "--i:$i" . ($coverUrl ? ";background-image:linear-gradient(180deg,rgba(8,16,42,.30) 0%,rgba(8,16,42,.55) 55%,rgba(8,16,42,.86) 100%),url('".h($coverUrl)."')" : ''); ?>
      <a class="aw-comp<?= $coverUrl ? ' has-cover' : '' ?> reveal" style="<?= $awStyle ?>" href="<?= url('/awards') ?>?comp=<?= (int)$c['id'] ?>">
        <span class="aw-comp-scope"><?= h($scope) ?></span>
        <span class="aw-comp-emb" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/></svg>
        </span>
        <div class="aw-comp-body">
          <h3 class="aw-comp-name"><?= h($c['name']) ?></h3>
          <p class="aw-comp-sub"><?= h(mb_strimwidth((string)$dir,0,40,'…')) ?></p>
          <span class="aw-comp-go">Выбрать награды
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </div>
      </a>
      <?php endforeach; ?>
      <?php if (!$comps): ?><p style="color:var(--muted);text-align:center">Открытых конкурсов пока нет.</p><?php endif; ?>
    </div>
  </div>
</section>

<?php else: /* ═══════════ УРОВЕНЬ 2 — сетка образцов 1:1 ═══════════ */
  $scope = ($selComp['type'] === 'international') ? 'Международный' : 'Всероссийский';
?>
<section class="section shop-page aw-page" style="padding-top:12px">
  <div class="container" style="max-width:840px">
    <a class="aw-back" href="<?= url('/awards') ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
      Все конкурсы
    </a>
    <div class="section-head reveal" style="text-align:left;margin:6px 0 12px">
      <p class="eyebrow eyebrow--script" style="margin:0"><?= h($scope) ?> конкурс</p>
      <h1 class="aw-title" style="font-size:clamp(1.4rem,5vw,1.95rem)">Награды «<?= h($selComp['name']) ?>»</h1>
      <p style="color:var(--muted);margin:0;font-size:.9rem">Электронный основной диплом — бесплатно всем участникам. Ниже — образцы и цены оригиналов с доставкой.</p>
    </div>

    <?php if ($appLock): ?>
      <div class="aw-applock reveal">
        <span class="aw-applock-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>
        </span>
        <span>
          <b>Заказ по заявке <?= h((string) $appLock['number']) ?></b> — результат: <b><?= h($appLockResult) ?></b>.
          <span class="aw-applock-hint">Показаны только награды, положенные по этому результату. Данные подставятся из заявки.</span>
        </span>
      </div>
    <?php endif; ?>

    <?php /* Верхний блок с отдельным образцом убран по просьбе — оставлены только
             карточки наград с ценами; крупный просмотр открывается по клику на карточку. */ ?>

    <div class="aw-grid">
      <?php
      // На ПЛАТНЫХ конкурсах в стоимость участия входит только ЭЛЕКТРОННЫЙ основной и
      // дополнительный диплом — его отдельно не заказывают. ОРИГИНАЛЫ этих же дипломов
      // заказать можно, поэтому карточку не выбрасываем целиком (так было раньше — и
      // оригиналы пропадали из образцов), а убираем только запрещённый вид.
      // Единственный источник правил — award_item_allowed() в core/orders.php.
      $paidComp = (int)($selComp['is_paid'] ?? 0) === 1;
      foreach ($order as $item):
        if (empty($catalog[$item])) continue;
        // Заказ по конкретной заявке: показываем ТОЛЬКО то, что по её результату
        // реально можно заказать (правила — core/orders.php, там же и серверная проверка).
        if ($appLock) {
            $allowedHere = false;
            foreach (array_keys($catalog[$item]) as $k) {
                [$okItem] = award_item_allowed($item, (string) $k, $appLockResult, $paidComp);
                if ($okItem) { $allowedHere = true; break; }
            }
            if (!$allowedHere) continue;
        }
        $m = $meta[$item] ?? ['ic'=>'diploma','slug'=>'diploma','tag'=>'','desc'=>''];
        $kinds = $catalog[$item];
        // Электронный основной/дополнительный на платном конкурсе входит в оргвзнос —
        // убираем этот ВИД всегда (и при простом просмотре раздела, и при заказе),
        // оставляя оригинал. Правило одно и то же на сервере и в вёрстке.
        if ($paidComp) {
            $kinds = array_filter($kinds, static function ($price, $k) use ($item, $paidComp) {
                [$okKind] = award_item_allowed($item, (string) $k, '', $paidComp);
                // при пустом результате трофеи запрещены — их фильтруем только по заявке
                return award_is_trophy($item) ? true : $okKind;
            }, ARRAY_FILTER_USE_BOTH);
            if (!$kinds) continue;
        }
        // По заявке отсекаем и запрещённые ВИДЫ позиции (например электронный
        // основной диплом в платном конкурсе — он входит в оргвзнос).
        if ($appLock) {
            $kinds = array_filter($kinds, static function ($price, $k) use ($item, $appLockResult, $paidComp) {
                [$okKind] = award_item_allowed($item, (string) $k, $appLockResult, $paidComp);
                return $okKind;
            }, ARRAY_FILTER_USE_BOTH);
            if (!$kinds) continue;
        }
        $ic = $icons[$m['ic']] ?? $icons['diploma'];
        $photo = award_photo($m['slug'], (int)$selComp['id']);
        $minPrice = min($kinds);
        // Крупное превью для модалки: фото награды; для дипломов — общий шаблон
        // диплома конкурса (award_photo('diploma') или diploma_bg).
        $preview = $photo;
        if (!$preview && in_array($m['slug'], ['diploma','diploma2','diploma-name'], true)) {
          $preview = award_photo('diploma', (int)$selComp['id']);
          if (!$preview) {
            $sBg = trim((string)($selComp['diploma_bg'] ?? ''));
            $preview = $sBg !== '' ? (preg_match('~^https?://~', $sBg) ? $sBg : url('/' . ltrim($sBg, '/'))) : '';
          }
        }
      ?>
      <article class="shop-card aw-card reveal" data-item="<?= h($item) ?>">
        <button type="button" class="aw-media<?= $photo ? ' has-photo' : '' ?>" data-aw-open
                data-title="<?= h($item) ?>" data-desc="<?= h($m['desc']) ?>" data-preview="<?= h($preview) ?>"
                aria-label="Посмотреть крупно: <?= h($item) ?>">
          <?php if ($m['tag']): ?><span class="aw-badge"><?= h($m['tag']) ?></span><?php endif; ?>
          <?php if ($photo): ?>
            <img src="<?= h($photo) ?>" alt="<?= h($item) ?>" loading="lazy">
          <?php else: ?>
            <span class="aw-medallion"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><?= $ic ?></svg></span>
          <?php endif; ?>
          <span class="aw-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></span>
        </button>
        <div class="aw-info">
          <h3 class="aw-name"><?= h($item) ?></h3>
          <?php if ($paidComp && in_array($item, ['Основной диплом','Дополнительный диплом'], true)): ?>
            <p class="aw-inclusive">Электронный входит в участие — здесь заказывается оригинал.</p>
          <?php endif; ?>
          <div class="aw-kinds">
            <?php $first=true; foreach ($kinds as $kind => $price): ?>
              <?php $my = $clubPrice((int) $price); ?>
              <label class="aw-kind">
                <input type="radio" name="kind_<?= md5($item) ?>" value="<?= h($kind) ?>" data-price="<?= $my ?>" data-full="<?= (int)$price ?>" <?= $first?'checked':'' ?>>
                <span><?= h($kindLabel[$kind] ?? $kind) ?></span>
                <b><?php if ((int)$price <= 0): ?>Беспл.<?php elseif ($my !== (int)$price): ?><s style="opacity:.55;font-weight:400;margin-right:6px"><?= number_format((int)$price,0,'.',' ') ?> ₽</s><?= number_format($my,0,'.',' ') ?> ₽<?php else: ?><?= number_format((int)$price,0,'.',' ') ?> ₽<?php endif; ?></b>
              </label>
            <?php $first=false; endforeach; ?>
          </div>
          <div class="aw-buy">
            <div class="qty" data-qty>
              <button type="button" class="qty-btn" data-dec aria-label="Меньше">−</button>
              <span class="qty-val" data-val>1</span>
              <button type="button" class="qty-btn" data-inc aria-label="Больше">+</button>
            </div>
            <button type="button" class="btn btn--primary aw-add" data-add aria-label="В корзину">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <span>В корзину</span>
            </button>
          </div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
    <?php if (!$catalog): ?><p style="color:var(--muted);text-align:center;margin-top:20px">Прайс наград пока не заполнен.</p><?php endif; ?>
  </div>
</section>

<?php /* DaData автоподсказка адреса (бесплатно до 10000/день). Токен — публичный ключ suggestions. */ ?>
<style>
.dd-suggest{position:absolute;left:0;right:0;top:100%;z-index:50;background:#fff;color:#15224C;border:1px solid var(--glass-brd,rgba(0,0,0,.12));border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.18);margin-top:4px;max-height:280px;overflow:auto}
.dd-suggest[hidden]{display:none}
.dd-item{padding:10px 14px;cursor:pointer;font-size:.92rem;color:#15224C;border-bottom:1px solid rgba(0,0,0,.06)}
.dd-item:last-child{border-bottom:0}
.dd-item:hover,.dd-item.active{background:rgba(154,255,0,.16)}
.dd-item small{display:block;color:#6a7096;font-size:.78rem;margin-top:2px}
/* Тёмная тема: тёмная выпадашка со светлым текстом — читаемый контраст. */
[data-theme="dark"] .dd-suggest{background:#171a2b;color:#F2E9CF;border-color:rgba(255,255,255,.16);box-shadow:0 14px 38px rgba(0,0,0,.6)}
[data-theme="dark"] .dd-item{color:#F2E9CF;border-bottom-color:rgba(255,255,255,.09)}
[data-theme="dark"] .dd-item small{color:#a9b4d6}
[data-theme="dark"] .dd-item:hover,[data-theme="dark"] .dd-item.active{background:rgba(154,255,0,.20);color:#fff}
</style>
<?php /* Подсказки адреса вынесены в общий компонент assets/js/address.js:
        запрос идёт через серверный прокси /api/v1/address_suggest, поэтому
        токен DaData больше не попадает в исходник страницы, а подсказки
        одинаково работают и здесь, и в форме заказа /order-awards. */ ?>

<?php /* Модалка крупного просмотра образца награды (диплом/кубок/статуэтка/медаль) */ ?>
<div class="aw-modal" id="awModal" hidden aria-modal="true" role="dialog">
  <div class="aw-modal-backdrop" data-aw-close></div>
  <div class="aw-modal-panel">
    <button type="button" class="aw-modal-x" data-aw-close aria-label="Закрыть">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div class="aw-modal-media" id="awModalMedia"></div>
    <div class="aw-modal-body">
      <h3 class="aw-modal-title" id="awModalTitle"></h3>
      <p class="aw-modal-desc" id="awModalDesc"></p>
    </div>
  </div>
</div>
<style>
.aw-media{position:relative;border:0;width:100%;padding:0;cursor:zoom-in;background:transparent;display:block}
.aw-zoom{position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,20,50,.55);color:#fff;backdrop-filter:blur(4px);opacity:.9;transition:.2s}
.aw-media:hover .aw-zoom{opacity:1;transform:scale(1.06)}
.aw-zoom svg{width:16px;height:16px}
.aw-modal{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px}
.aw-modal[hidden]{display:none}
.aw-modal-backdrop{position:absolute;inset:0;background:rgba(6,12,32,.82);backdrop-filter:blur(6px)}
.aw-modal-panel{position:relative;z-index:1;max-width:520px;width:100%;max-height:92vh;overflow:auto;background:var(--card,#fff);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.5);animation:awPop .28s cubic-bezier(.2,.9,.3,1.2)}
@keyframes awPop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
.aw-modal-x{position:absolute;top:12px;right:12px;z-index:2;width:40px;height:40px;border-radius:50%;border:0;background:rgba(10,20,50,.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.aw-modal-x svg{width:20px;height:20px}
.aw-modal-media{width:100%;background:#0b1430;display:flex;align-items:center;justify-content:center;border-radius:20px 20px 0 0;min-height:200px}
.aw-modal-media img{max-width:100%;max-height:70vh;display:block;object-fit:contain}
.aw-modal-media .aw-medallion{width:120px;height:120px;color:var(--gold-2,#d4a24a)}
.aw-modal-media .aw-medallion svg{width:100%;height:100%}
.aw-modal-body{padding:18px 22px 24px}
.aw-modal-title{margin:0 0 8px;font-size:1.25rem}
.aw-modal-desc{margin:0;color:var(--muted);font-size:.95rem;line-height:1.6}
</style>
<script>
(function(){
  var modal=document.getElementById('awModal');
  if(!modal)return;
  var media=document.getElementById('awModalMedia'),
      title=document.getElementById('awModalTitle'),
      desc=document.getElementById('awModalDesc');
  function open(btn){
    var t=btn.getAttribute('data-title')||'',d=btn.getAttribute('data-desc')||'',p=btn.getAttribute('data-preview')||'';
    title.textContent=t;
    // Пустое описание (кубок/статуэтка/медаль) — показываем только подпись.
    desc.textContent=d; desc.style.display=d?'':'none';
    if(p){media.innerHTML='<img src="'+p.replace(/"/g,'&quot;')+'" alt="'+t.replace(/"/g,'&quot;')+'">';}
    else{var med=btn.querySelector('.aw-medallion');media.innerHTML=med?med.outerHTML:'';}
    modal.hidden=false;document.body.style.overflow='hidden';
  }
  function close(){modal.hidden=true;document.body.style.overflow='';media.innerHTML='';}
  document.addEventListener('click',function(e){
    var op=e.target.closest('[data-aw-open]'); if(op){e.preventDefault();open(op);return;}
    if(e.target.closest('[data-aw-close]'))close();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
})();
</script>

<button type="button" class="shop-cart-fab" id="cartFab" hidden aria-label="Корзина">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/><path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L23 7H6"/></svg>
  <span class="shop-cart-count" id="cartCount">0</span>
</button>

<div class="shop-cart" id="cartSheet" hidden>
  <div class="shop-cart-backdrop" data-cart-close></div>
  <div class="shop-cart-panel">
    <div class="shop-cart-grab"></div>
    <div class="shop-cart-head">
      <h3>Корзина</h3>
      <button type="button" class="shop-cart-x" data-cart-close aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="shop-cart-items" id="cartItems"></div>
    <div class="shop-cart-empty" id="cartEmpty">Корзина пуста</div>

    <form id="orderForm" class="shop-checkout" hidden>
      <?= csrf_field() ?>
      <input type="hidden" name="competition_id" value="<?= (int)$selComp['id'] ?>">
      <div class="shop-total"><span>Итого</span><b id="cartTotal">0 ₽</b></div>

      <?php if ($u): ?>
        <?php
          // Заказ наград — только по ОЦЕНЁННОЙ заявке ЭТОГО конкурса (для длинных — после публикации).
          $_orderable = function (array $a): bool {
              return trim((string)($a['result'] ?? '')) !== ''
                  && ((string)($a['comp_rmode'] ?? '') !== 'list' || trim((string)($a['comp_rpub'] ?? '')) !== '');
          };
          $compApps    = array_values(array_filter($myApps, fn($a) => (int)$a['competition_id'] === (int)$selComp['id'] && $_orderable($a)));
          $hasCompApp  = (bool) array_filter($myApps, fn($a) => (int)$a['competition_id'] === (int)$selComp['id']);
          $otherGraded = array_values(array_filter($myApps, fn($a) => (int)$a['competition_id'] !== (int)$selComp['id'] && $_orderable($a)));
          $selApp = (int) ($_GET['app'] ?? 0);
        ?>
        <?php if ($appLock): /* Пришли из кабинета по конкретной заявке — она зафиксирована. */ ?>
        <div class="field">
          <label for="ord_app">По какой заявке</label>
          <select id="ord_app" disabled style="opacity:.75">
            <option selected><?= h((string) $appLock['number']) ?> (<?= h($appLockResult) ?>)</option>
          </select>
          <input type="hidden" name="application_id" value="<?= (int) $appLock['id'] ?>">
          <div class="hint">Состав наград ограничен результатом этой заявки.</div>
        </div>
        <?php elseif ($compApps): ?>
        <div class="field">
          <label for="ord_app">По какой заявке (только оценённые)</label>
          <select id="ord_app" name="application_id" required>
            <option value="">Выберите заявку…</option>
            <?php foreach ($compApps as $a): ?>
              <option value="<?= (int)$a['id'] ?>" <?= $selApp === (int)$a['id'] ? 'selected' : '' ?>><?= h($a['number']) ?><?= $a['result']?' ('.h($a['result']).')':'' ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <?php endif; ?>
      <?php else: ?>
        <div class="field">
          <label for="ord_number">Номер заявки (необязательно)</label>
          <input type="text" id="ord_number" name="application_number" placeholder="MM-2026-00001">
          <div class="hint">Или <a href="<?= url('/login') ?>">войдите</a>, чтобы выбрать заявку из списка.</div>
        </div>
      <?php endif; ?>

      <div class="field">
        <label for="ord_name">ФИО получателя</label>
        <input type="text" id="ord_name" name="full_name" value="<?= h($u['full_name'] ?? '') ?>" required>
      </div>
      <div class="grid-2c">
        <div class="field">
          <label for="ord_email">Почта</label>
          <input type="email" id="ord_email" name="email" value="<?= h($u['email'] ?? '') ?>" required>
        </div>
        <div class="field">
          <label for="ord_phone">Телефон</label>
          <input type="tel" id="ord_phone" name="phone" value="<?= h($u['phone'] ?? '') ?>" data-phone required>
        </div>
      </div>
      <div class="field" id="addrField" style="position:relative">
        <label for="ord_addr">Адрес доставки (для оригиналов)</label>
        <input type="text" id="ord_addr" name="address" placeholder="Начните вводить: город, улица, дом…"
               autocomplete="off" data-address-suggest data-postal="#ord_postal">
        <input type="hidden" id="ord_postal" name="postal_index" value="">
        <div class="hint">Начните вводить адрес — подскажем и подставим индекс. Доставка Почтой России.</div>
      </div>
      <button type="submit" class="btn btn--primary btn--block btn--lg" id="orderSubmit">Оплатить</button>
      <p id="orderErr" class="shop-err" hidden></p>
    </form>
  </div>
</div>

<?php if (!empty($selComp)):
  $mmaOther = null;
  if (!empty($otherGraded)) {
      $o0 = $otherGraded[0];
      $mmaOther = ['id' => (int)$o0['competition_id'], 'slug' => (string)$o0['comp_slug'],
                   'app' => (int)$o0['id'], 'name' => (string)$o0['comp_name']];
  }
  $mma = [
      'compId'       => (int)$selComp['id'],
      'compName'     => (string)$selComp['name'],
      'hasCompGraded'=> !empty($compApps),
      'hasCompApp'   => !empty($hasCompApp),
      'applyUrl'     => url('/apply') . '?comp=' . (int)$selComp['id'],
      'cabinetUrl'   => url('/cabinet') . '#apps',
      'awardsUrl'    => url('/awards'),
      'other'        => $mmaOther,
  ];
?>
<!-- Всплывающее окно заказа наград (нет заявки / нет результата / есть на другом конкурсе) -->
<div id="awPop" class="aw-pop" hidden>
  <div class="aw-pop-back" data-awp-close></div>
  <div class="aw-pop-box" role="dialog" aria-modal="true" aria-labelledby="awPopTitle">
    <button type="button" class="aw-pop-x" data-awp-close aria-label="Закрыть">✕</button>
    <div class="aw-pop-ico" aria-hidden="true">🏆</div>
    <h3 id="awPopTitle"></h3>
    <p id="awPopText"></p>
    <div id="awPopBtns" class="aw-pop-btns"></div>
  </div>
</div>
<style>
.aw-pop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px}
.aw-pop[hidden]{display:none}
.aw-pop-back{position:absolute;inset:0;background:rgba(8,12,30,.62);backdrop-filter:blur(3px)}
.aw-pop-box{position:relative;z-index:1;max-width:420px;width:100%;background:var(--card,#12204a);color:#fff;
  border-radius:20px;padding:26px 24px 22px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.5);
  border:1px solid rgba(255,255,255,.12);animation:awpIn .26s cubic-bezier(.2,.9,.3,1.15)}
@keyframes awpIn{from{transform:translateY(16px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.aw-pop-x{position:absolute;top:12px;right:14px;background:none;border:0;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;line-height:1}
.aw-pop-ico{font-size:40px;margin-bottom:8px}
.aw-pop-box h3{margin:0 0 10px;font-size:1.25rem;line-height:1.25}
.aw-pop-box p{margin:0 0 18px;font-size:.96rem;line-height:1.55;color:rgba(255,255,255,.85)}
.aw-pop-btns{display:flex;flex-direction:column;gap:10px}
.aw-pop-btns .btn{width:100%}
</style>
<script>window.MMA = <?= json_encode($mma, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?>;</script>
<?php endif; ?>

<script>
(function(){
  var KIND_LABEL = {"original":"Оригинал","digital":"Электронный","club":"Клуб"};
  var CLUB_PCT = <?= (int) $clubPct ?>;   // скидка ВИП-клуба, %
  var cart = [];
  var $ = function(s,r){return (r||document).querySelector(s);};
  var fab=$('#cartFab'), sheet=$('#cartSheet'), itemsBox=$('#cartItems'), emptyBox=$('#cartEmpty'),
      form=$('#orderForm'), totalEl=$('#cartTotal'), countEl=$('#cartCount');
  if(!fab) return;
  var MMA=window.MMA||{};

  /* ---- Всплывающее окно заказа ---- */
  function awPop(title,text,btns){
    var p=$('#awPop'); if(!p) return;
    $('#awPopTitle').textContent=title; $('#awPopText').textContent=text;
    var box=$('#awPopBtns'); box.innerHTML='';
    (btns||[]).forEach(function(b){
      var el=document.createElement(b.href?'a':'button');
      el.className='btn '+(b.primary?'btn--primary':'btn--ghost');
      el.textContent=b.label;
      if(b.href){el.href=b.href;} else {el.type='button'; el.onclick=b.onClick;}
      box.appendChild(el);
    });
    p.hidden=false;
  }
  function awPopClose(){var p=$('#awPop'); if(p)p.hidden=true;}
  document.querySelectorAll('[data-awp-close]').forEach(function(b){b.addEventListener('click',awPopClose);});

  /* ---- Перенос корзины на другой конкурс ---- */
  function transferCartTo(compId,appId){
    try{ sessionStorage.setItem('mm_cart_x', JSON.stringify(cart)); }catch(e){}
    location.href=(MMA.awardsUrl||'/awards')+'?comp='+compId+(appId?'&app='+appId:'')+'#order';
  }
  // Восстановление перенесённой корзины на целевой странице
  try{
    var xr=sessionStorage.getItem('mm_cart_x');
    if(xr){ cart=JSON.parse(xr)||[]; sessionStorage.removeItem('mm_cart_x'); }
  }catch(e){}

  /* ---- Проверка: можно ли оформить заказ по этому конкурсу; иначе показать окно ---- */
  function ensureOrderable(){
    var sel=$('#ord_app');
    if(MMA.hasCompGraded && sel && sel.value) return true;         // выбрана оценённая заявка этого конкурса
    if(MMA.hasCompGraded && sel && !sel.value){ sel.focus(); if(window.toast)window.toast('Выберите заявку из списка','error'); return false; }
    // Нет оценённой заявки на ЭТОТ конкурс — разбираем случай
    if(MMA.hasCompApp){
      var t='Заявка на конкурс «'+(MMA.compName||'')+'» есть, но жюри ещё не выставило результат. Как только он появится — здесь откроется заказ. Отследить статус можно в личном кабинете.';
      var btns=[{label:'В личный кабинет — отследить статус',href:MMA.cabinetUrl,primary:!MMA.other}];
      if(MMA.other){ t+=' А сейчас вы можете заказать награды по уже оценённой заявке на «'+MMA.other.name+'» — перенесём корзину.';
        btns.unshift({label:'Заказать по «'+MMA.other.name+'»',primary:true,onClick:function(){transferCartTo(MMA.other.id,MMA.other.app);}}); }
      btns.push({label:'Закрыть',onClick:awPopClose});
      awPop('Результат ещё не подведён', t, btns);
    } else if(MMA.other){
      awPop('На этот конкурс у вас нет заявки',
        'Но у вас есть оценённая заявка на конкурс «'+MMA.other.name+'». Можно заказать награды по ней — мы перенесём вашу корзину туда автоматически.',
        [{label:'Заказать по заявке «'+MMA.other.name+'»',primary:true,onClick:function(){transferCartTo(MMA.other.id,MMA.other.app);}},
         {label:'Подать заявку на этот конкурс',href:MMA.applyUrl}]);
    } else {
      awPop('Нужна оценённая заявка',
        'Чтобы заказать наградную продукцию по конкурсу «'+(MMA.compName||'')+'», подайте заявку на участие и дождитесь результата жюри.',
        [{label:'Подать заявку',href:MMA.applyUrl,primary:true},{label:'Закрыть',onClick:awPopClose}]);
    }
    return false;
  }

  document.querySelectorAll('[data-qty]').forEach(function(q){
    var v=q.querySelector('[data-val]');
    q.querySelector('[data-dec]').addEventListener('click',function(){v.textContent=Math.max(1,parseInt(v.textContent)-1);});
    q.querySelector('[data-inc]').addEventListener('click',function(){v.textContent=Math.min(20,parseInt(v.textContent)+1);});
  });
  // Лимиты количества: основной/дополнительный диплом — максимум 1 (второй не имеет смысла);
  // именные и благодарности — до 20 (на каждый экземпляр вводится ФИО).
  function maxQty(item){ return /Основной диплом|Дополнительный диплом/.test(item) ? 1 : 20; }
  /* Подсказка называет ВСЕХ, кому благодарность выписывается, а не только
     педагога. Описание награды выше говорит «педагогу, концертмейстеру или
     руководителю коллектива», а подсказка при заказе называла двоих —
     участница с концертмейстером искала, где его вписать, и не находила. */
  function needsFio(item){ return /Именной диплом/.test(item) ? 'ФИО участника коллектива'
                              : /Благодарность/.test(item) ? 'ФИО педагога, концертмейстера или руководителя' : null; }
  document.querySelectorAll('.shop-card').forEach(function(card){
    card.querySelector('[data-add]').addEventListener('click',function(){
      var item=card.getAttribute('data-item');
      var kindInp=card.querySelector('input[type=radio]:checked');
      var kind=kindInp.value, price=parseInt(kindInp.getAttribute('data-price'));
      var full=parseInt(kindInp.getAttribute('data-full'))||price;
      var qty=parseInt(card.querySelector('[data-val]').textContent)||1;
      var cap=maxQty(item);
      var ex=cart.find(function(c){return c.item===item&&c.kind===kind;});
      var cur=ex?ex.qty:0;
      if(cur+qty>cap){
        if(window.toast)window.toast(cap===1?'Этот диплом можно заказать только в одном экземпляре':'Максимум '+cap+' шт.','error');
        qty=Math.max(0,cap-cur); if(!qty)return;
      }
      if(ex){ex.qty+=qty;}else{cart.push({item:item,kind:kind,price:price,full:full,qty:qty,fios:[]});}
      render();
      // Корзину НЕ открываем автоматически — только пульс кнопки и подсказка.
      fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse');
      if(window.toast)window.toast('Добавлено. Корзина — внизу справа','success');
    });
  });
  function render(){
    var total=0,totalFull=0,count=0; itemsBox.innerHTML='';
    cart.forEach(function(c,i){
      total+=c.price*c.qty; totalFull+=(c.full||c.price)*c.qty; count+=c.qty;
      var row=document.createElement('div');row.className='shop-cart-row';
      var cap=maxQty(c.item);
      row.innerHTML='<div class="scr-info"><b>'+c.item+'</b><span>'+(KIND_LABEL[c.kind]||c.kind)+' · '+c.price+' ₽</span></div>'+
        '<div class="scr-qty"><button type="button" data-m>−</button><span>'+c.qty+'</span><button type="button" data-p'+(c.qty>=cap?' disabled':'')+'>+</button></div>'+
        '<div class="scr-sum">'+(c.price*c.qty)+' ₽</div>'+
        '<button type="button" class="scr-del" data-del aria-label="Удалить">✕</button>';
      row.querySelector('[data-m]').onclick=function(){c.qty=Math.max(1,c.qty-1);render();};
      row.querySelector('[data-p]').onclick=function(){c.qty=Math.min(cap,c.qty+1);render();};
      row.querySelector('[data-del]').onclick=function(){cart.splice(i,1);render();};
      itemsBox.appendChild(row);
      // Поля ФИО: по одному на каждый экземпляр именного диплома / благодарности.
      var lbl=needsFio(c.item);
      if(lbl){
        c.fios=c.fios||[];
        for(var k=0;k<c.qty;k++){
          var w=document.createElement('div'); w.className='scr-fio';
          var inp=document.createElement('input');
          inp.type='text'; inp.placeholder=lbl+(c.qty>1?' — экз. '+(k+1):'');
          inp.value=c.fios[k]||'';
          (function(cc,kk){ inp.addEventListener('input',function(){ cc.fios[kk]=this.value; }); })(c,k);
          w.appendChild(inp); itemsBox.appendChild(w);
        }
      }
    });
    // Итог для участника клуба: перечёркнутая полная сумма и цена со скидкой.
    totalEl.innerHTML = (CLUB_PCT>0 && totalFull>total)
      ? '<s style="opacity:.55;font-weight:400;margin-right:8px">'+totalFull.toLocaleString('ru-RU')+' \u20BD</s>'+total.toLocaleString('ru-RU')+' \u20BD'+
        '<span style="display:block;font-size:.8rem;color:var(--gold-2,#C79322);font-weight:700;margin-top:2px">ВИП-клуб \u2212'+CLUB_PCT+'%</span>'
      : total.toLocaleString('ru-RU')+' \u20BD';
    countEl.textContent=count; fab.hidden=count===0; emptyBox.hidden=count>0; form.hidden=count===0;
    // Адрес доставки нужен ТОЛЬКО если в корзине есть оригинал (кубок/статуэтка/медаль/оригинал диплома).
    var needAddr=cart.some(function(c){return c.kind==='original';});
    var af=document.getElementById('addrField'), ai=document.getElementById('ord_addr');
    if(af){af.style.display=needAddr?'':'none';}
    if(ai){ai.required=!!needAddr;}
  }
  function openCart(){sheet.hidden=false;document.body.classList.add('mz-cart-open');requestAnimationFrame(function(){sheet.classList.add('on');});}
  function closeCart(){sheet.classList.remove('on');document.body.classList.remove('mz-cart-open');setTimeout(function(){sheet.hidden=true;},300);}
  fab.addEventListener('click',openCart);
  document.querySelectorAll('[data-cart-close]').forEach(function(b){b.addEventListener('click',closeCart);});

  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(!cart.length)return;
    // Гость (есть поле «Номер заявки») — проверку делает сервер; окно не показываем.
    var isGuest = !!$('#ord_number');
    if(!isGuest && !ensureOrderable()) return;
    var err=$('#orderErr'); err.hidden=true;
    var btn=$('#orderSubmit'); btn.disabled=true; btn.textContent='Создаём заказ…';
    // ФИО обязательны для каждого экземпляра именного диплома и благодарности.
    for(var ci=0;ci<cart.length;ci++){
      var lbl=needsFio(cart[ci].item);
      if(lbl){
        for(var qi=0;qi<cart[ci].qty;qi++){
          if(!((cart[ci].fios||[])[qi]||'').trim()){
            err.textContent='Заполните «'+lbl+'» для каждой позиции «'+cart[ci].item+'» в корзине.';
            err.hidden=false; var b0=$('#orderSubmit'); b0.disabled=false; b0.textContent='Оплатить'; return;
          }
        }
      }
    }
    // ФИО получателя — ПОЛНОСТЬЮ (Фамилия Имя Отчество), не «Имя» и не «Имя Фамилия».
    var fioV=((document.getElementById('ord_name')||{}).value||'').trim();
    var fioParts=fioV.split(/\s+/).filter(function(w){return w.length>=2;});
    if(fioParts.length<3){ err.textContent='Укажите ФИО получателя ПОЛНОСТЬЮ: Фамилия, Имя и Отчество.'; err.hidden=false; var bF=$('#orderSubmit'); bF.disabled=false; bF.textContent='Оплатить'; document.getElementById('ord_name').focus(); return; }
    // Для оригиналов адрес доставки обязателен и ПОЛНЫЙ: город, улица и ДОМ.
    if(cart.some(function(c){return c.kind==='original';})){
      var addrV=((document.getElementById('ord_addr')||{}).value||'').trim();
      var hasHouse=/(^|[\s,.])(д(ом)?\.?\s*)?\d+/i.test(addrV);          // есть номер дома
      var hasStreet=/(ул|улиц|просп|пр-?кт|пер(еул)?|шоссе|бульв|наб|аллея|проезд|тракт|мкр|микрорайон|кварт(ал)?|деревн|село|посёл|поселок|станиц)/i.test(addrV);
      if(!addrV || !hasHouse || !hasStreet){
        err.textContent='Адрес должен быть ПОЛНЫМ: город, улица и дом (номер квартиры — по желанию). Без дома отправить нельзя.';
        err.hidden=false; var b1=$('#orderSubmit'); b1.disabled=false; b1.textContent='Оплатить'; document.getElementById('ord_addr').focus(); return;
      }
    }
    var items=[]; cart.forEach(function(c){for(var i=0;i<c.qty;i++){var it={item:c.item,kind:c.kind};var f=(c.fios||[])[i];if(f&&f.trim())it.fio=f.trim();items.push(it);}});
    var fd=new FormData(form); fd.set('items',JSON.stringify(items));
    fetch('<?= url('/api/v1/order') ?>',{method:'POST',credentials:'same-origin',body:fd})
      .then(function(r){return r.json();})
      .then(function(d){
        btn.disabled=false; btn.textContent='Оплатить';
        if(!d.ok){err.textContent=d.error||'Не удалось оформить заказ';err.hidden=false;return;}
        if(d.confirmation_url){location.href=d.confirmation_url;return;}
        location.href='<?= url('/cabinet') ?>#awards';
      }).catch(function(){btn.disabled=false;btn.textContent='Оплатить';err.textContent='Ошибка сети, попробуйте ещё раз';err.hidden=false;});
  });

  // Если корзину перенесли с другого конкурса — показываем её сразу.
  if(cart.length){ render(); openCart(); }
})();
</script>
<?php endif; ?>
<?php
$content = ob_get_clean();
$ttl = $selComp ? ('Награды «'.$selComp['name'].'»') : 'Образцы наград';
render_page($ttl, $content, ['active' => '/awards', 'meta' => 'Наградная продукция Культурного центра «Музыкальный Мир»: дипломы, медали, статуэтки, кубки. Заказ по заявке на участие, оплата онлайн.']);
