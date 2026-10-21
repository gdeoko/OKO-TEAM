<?php
/** POST заказа наградных материалов → awards_orders + заглушка платежа ЮKassa.
 *  Сумма ВСЕГДА пересчитывается на сервере по awards_prices (клиентский amount не платёжеспособен). */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

// --- Строгая проверка источника (Origin/Referer принадлежит своему домену) + CSRF-токен ---
if (!request_same_origin() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

if (!rate_ok('order:' . client_ip(), 30, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

// Позиции заказа: массив или JSON-строка.
$items = $_POST['items'] ?? input('items');
if (is_string($items) && $items !== '') {
    $decoded = json_decode($items, true);
    if (is_array($decoded)) $items = $decoded;
}
if (!is_array($items)) $items = [];

// --- Конкурс: по slug/code/id (нужен competition_id для персонального прайса) ---
$compRef = input('competition');
$comp = $compRef !== ''
    // is_paid нужен ниже: в платном конкурсе электронные основной/доп. входят в оргвзнос.
    ? one("SELECT id,slug,name,is_paid,COALESCE(club_only,0) club_only FROM competitions WHERE slug=? OR code=? OR id=?",
          [$compRef, $compRef, ctype_digit($compRef) ? (int) $compRef : 0])
    : null;
$compId = $comp ? (int) $comp['id'] : null;

// --- Серверный пересчёт суммы по прайсу awards_prices (защита от оплаты за 1₽) ---
// Клиентский amount игнорируем при оплате: платим ТОЛЬКО по серверной сумме.
$clientAmount = (int) input('amount', '0');
$serverAmount = 0;
$normItems = [];
$badItems  = [];
foreach ($items as $it) {
    if (!is_array($it)) continue;
    $itemName = trim((string) ($it['item'] ?? ''));
    $kind     = trim((string) ($it['kind'] ?? 'original'));
    if ($itemName === '') continue;
    if ($kind === '') $kind = 'original';

    // Клубное членство — цена из настроек (не из awards_prices), активируется при оплате.
    // period: 'year' → годовая (10000 ₽, 12 мес), иначе месячная (1000 ₽, 1 мес).
    if ($kind === 'club') {
        $period = trim((string) ($it['period'] ?? 'month'));
        if ($period === 'year') {
            $price = (int) setting('club_price_year', '10000');
        } else {
            $period = 'month';
            $price = (int) setting('club_price', '1000');
        }
        $serverAmount += $price;
        $normItems[] = ['item' => $itemName, 'kind' => 'club', 'period' => $period, 'price' => $price];
        continue;
    }

    // Персональный прайс конкурса имеет приоритет над общим (competition_id IS NULL).
    //
    // Ищем и по присланному имени, и по КАНОНИЧЕСКОМУ (award_canon_item). В прайсе одна
    // и та же награда заведена по-разному: у конкурсов 19 и 20 это «Кубок»/«Статуэтка»/
    // «Медаль», у остальных и в общем прайсе — «Кубок Гран-при»/«Статуэтка лауреата»/
    // «Медаль дипломанта». Форма заказа шлёт длинные имена, поэтому персональные цены
    // конкурсов 19 и 20 не находились никогда: заказ молча уходил на общий прайс, и
    // выставленная для конкурса цена игнорировалась.
    if (!function_exists('award_canon_item') && is_file(BASE_PATH . '/core/orders.php')) {
        require_once BASE_PATH . '/core/orders.php';
    }
    // Сравниваем по КАНОНУ с обеих сторон: и присланное имя, и имя строки прайса
    // приводим к одному виду. Сопоставлять просто по строке нельзя — канонизация
    // односторонняя (короткое → длинное), а в базе лежат оба варианта.
    $canon = function_exists('award_canon_item') ? award_canon_item($itemName) : $itemName;

    $pickPrice = static function (array $rows) use ($canon, $itemName): ?int {
        foreach ($rows as $r) {
            $it = (string) $r['item'];
            $rc = function_exists('award_canon_item') ? award_canon_item($it) : $it;
            if ($it === $itemName || $rc === $canon) return (int) $r['price'];
        }
        return null;
    };

    $price = null;
    if ($compId !== null) {
        $price = $pickPrice(all("SELECT item, price FROM awards_prices WHERE competition_id=? AND kind=?", [$compId, $kind]));
    }
    if ($price === null) {
        $price = $pickPrice(all("SELECT item, price FROM awards_prices WHERE competition_id IS NULL AND kind=?", [$kind]));
    }
    if ($price === null || $price === false) {
        $badItems[] = $itemName . ' / ' . $kind;
        continue;
    }
    $price = (int) $price;
    // В ПЛАТНОМ конкурсе электронные основной и дополнительный дипломы входят в стоимость
    // участия (оргвзнос) — при заказе они бесплатны. В бесплатном — по прайсу.
    /* В КОНКУРСЕ КЛУБА ЭЛЕКТРОННЫЕ ОСНОВНОЙ И ДОПОЛНИТЕЛЬНЫЙ ТОЖЕ ВХОДЯТ В УЧАСТИЕ.
     *
     * Правило было завязано на платность: в платном конкурсе эти два документа
     * входят в оргвзнос. У конкурса Клуба взноса нет, участие оплачено членством,
     * и по положению оба диплома входят в него так же - значит и здесь они
     * бесплатны, иначе положение и касса разошлись бы. */
    if ($kind === 'digital'
        && in_array($itemName, ['Основной диплом', 'Дополнительный диплом'], true)
        && $comp && ((int) ($comp['is_paid'] ?? 0) === 1 || (int) ($comp['club_only'] ?? 0) === 1)) {
        $price = 0;
    }
    $serverAmount += $price;
    // ФИО получателя обязано дожить до состава заказа. core/orders.php читает его
    // как $it['fio'] ($person) и печатает на именном дипломе и благодарности, а ещё
    // строит по нему ключ дедупликации «тип + получатель». Раньше поле здесь молча
    // терялось, поэтому: документы уходили с пустым ФИО, а заказ пяти именных
    // дипломов схлопывался в ОДИН документ — у всех пяти ключ дедупа был одинаковый
    // (тип + пустая строка). Правило владельца: одна благодарность = один педагог =
    // одно ФИО, то есть заказали пять — должно получиться пять разных документов.
    $ni = ['item' => $itemName, 'kind' => $kind, 'price' => $price];
    $fio = trim((string) ($it['fio'] ?? ''));
    /* БЕЗ ИМЕНИ ЭТИ ДВА ДОКУМЕНТА НЕ ИЗГОТОВИТЬ — И ПРОВЕРЯЕТ ЭТО СЕРВЕР.
     *
     * Именной диплом и благодарность выписываются на конкретного человека:
     * без ФИО печатать нечего, и заказ бессмысленный. На форме поле обязательное,
     * но проверка живёт в браузере — а туда заказ приходит и мимо формы. Правило
     * владельца: без ФИО заявку на изготовление не принимать, поэтому отказываем
     * до создания платежа, пока деньги ещё не списаны. */
    if ($fio === '' && preg_match('~именн|благодар~ui', $itemName)) {
        json_out(['ok' => false, 'error' => 'Для позиции «' . $itemName . '» нужно указать ФИО получателя: '
            . (preg_match('~именн~ui', $itemName)
                ? 'именной диплом выписывается на участника коллектива.'
                : 'благодарность выписывается на педагога.')], 422);
    }
    if ($fio !== '') $ni['fio'] = mb_substr($fio, 0, 200);
    $normItems[] = $ni;
}

if (!$normItems) {
    json_out(['ok' => false, 'error' => 'Не удалось определить позиции заказа или их цены. Свяжитесь с Оргкомитетом.',
              'unknown_items' => $badItems], 422);
}

// Сверка с клиентским значением (только для лога/диагностики, платим по серверной сумме).
if ($clientAmount !== $serverAmount) {
    audit('order_amount_mismatch', 'awards_orders', null,
          ['client' => $clientAmount, 'server' => $serverAmount, 'items' => $normItems]);
}

$amount = $serverAmount;
$uid = current_user()['id'] ?? null;

// Признак «покупается само членство в клубе» — нужен и здесь (скидка на него не
// распространяется), и ниже в проверках состава заказа.
$isClubOrder = strpos(json_encode($normItems, JSON_UNESCAPED_UNICODE), '"kind":"club"') !== false;

// СКИДКА ЭЛИТНОГО КЛУБА НА НАГРАДЫ (её здесь не было вовсе — клубная скидка работала
// только при подаче заявки). Членство даёт 20% на весь наградной материал.
$clubPctOrder = 0;
if ($uid && !$isClubOrder) {
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    if (function_exists('club_discount_percent')) $clubPctOrder = (int) club_discount_percent((int) $uid);
}
// СКИДКА УЧРЕЖДЕНИЯ-ПАРТНЁРА НА НАГРАДНЫЙ МАТЕРИАЛ.
//
// Письмо о десяти заявках и кабинет партнёра обещают: «скидка 10% применяется к
// оргвзносу при подаче заявки ИЛИ к заказу наградного материала». Вторая
// половина обещания не работала вовсе: поля промокода в заказе не было, и
// partner_promo_check здесь никто не звал. Теперь скидка даётся, если заказ
// делается по заявке, которую привело учреждение-партнёр, либо если введён его
// действующий промокод. Использование при этом НЕ списывается: десять
// использований учреждения тратятся на заявки, а не на заказы наград.
$partnerPctOrder = 0;
$partnerCodeOrder = trim((string) input('promo', input('promo_code', '')));
if (!$isClubOrder && $amount > 0) {
    if (is_file(BASE_PATH . '/core/partner.php')) require_once BASE_PATH . '/core/partner.php';
    if (function_exists('partner_promo_check') && $partnerCodeOrder !== '') {
        [$pInstOrder, ] = partner_promo_check($partnerCodeOrder);
        if ($pInstOrder) $partnerPctOrder = PARTNER_PROMO_PCT;
    }
}

// application_id: напрямую, либо резолвим по номеру заявки (для гостей).
$applicationId = (int) input('application_id', '0');
$appNumTyped = trim((string) input('application_number'));
if (!$applicationId && $appNumTyped !== '') {
    /* НОМЕР ЗАЯВКИ ЧЕЛОВЕК ПЕРЕПИСЫВАЕТ РУКАМИ ИЗ ПИСЬМА.
     *
     * Поиск шёл строгим равенством, и любая мелочь при переписывании — лишний
     * пробел, строчные буквы, «№» впереди, тире вместо дефиса — означала «заявка
     * не найдена». Дальше человек получал ответ «заказать награды можно только по
     * оценённой заявке» и читал его как «мою работу не оценили».
     *
     * Ищем по очищенному виду, а если введены одни цифры — по хвосту номера:
     * «518» находит VR-2026-00518. Номер уникален, поэтому одну заявку это
     * находит точно; если под хвост попадает несколько — не гадаем. */
    $clean = mb_strtoupper(preg_replace('~[^\p{L}\p{N}]+~u', '', $appNumTyped) ?? '');
    if ($clean !== '') {
        $ar = one("SELECT id FROM applications
                    WHERE UPPER(REPLACE(REPLACE(REPLACE(number,'-',''),' ',''),'№','')) = ? LIMIT 1", [$clean]);
        if (!$ar && ctype_digit($clean)) {
            $digits = ltrim($clean, '0');
            $rows = all("SELECT id, number FROM applications WHERE number LIKE ? OR number LIKE ?",
                        ['%-' . str_pad($digits, 5, '0', STR_PAD_LEFT), '%' . $digits]);
            if (count($rows) === 1) $ar = $rows[0];
        }
        if ($ar) $applicationId = (int) $ar['id'];
    }
}

// ПРАВИЛО (Даниэль): наградной материал заказывается ТОЛЬКО по оценённой заявке
// (есть результат/звание). Клубное членство — исключение (это не награда за конкурс).
// $isClubOrder уже вычислен выше — вместе с расчётом клубной скидки.
$appRow = null;   // используется ниже и при клубном заказе остаётся null
if (!$isClubOrder) {
    if (!$applicationId) {
        /* Раньше здесь стоял один текст на два разных случая: «заказать награды
         * можно только по оценённой заявке». Человек, который просто не указал
         * номер (или ошибся при переписывании), читал это как отказ по своей
         * работе — «нас не оценили». Разводим случаи. */
        json_out(['ok' => false, 'error' => $appNumTyped !== ''
            ? 'Заявка с номером «' . mb_substr($appNumTyped, 0, 40) . '» не найдена. '
              . 'Проверьте номер — он есть в письме о приёме заявки и в письме с результатом '
              . '(вида VR-2026-00123). Или войдите в личный кабинет, и заявка выберется из списка.'
            : 'Укажите номер заявки, по которой заказываете награды: он есть в письме о приёме '
              . 'заявки и в письме с результатом. Или войдите в личный кабинет — тогда заявка '
              . 'выберется из списка сама.'], 422);
    }
    try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}
    $appRow = one("SELECT a.id, a.result, a.status, a.user_id, a.result_sent_at, a.extra_diploma, a.is_group,
                          c.id AS comp_id, c.name AS comp_name, c.is_paid AS comp_is_paid,
                          COALESCE(c.club_only,0) AS comp_club_only,
                          c.results_mode, c.results_published_at, c.status AS comp_status, c.end_date
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.id=?", [$applicationId]);
    // Привязка к покупателю: авторизованный пользователь может заказывать награды только
    // по СВОЕЙ заявке (не подставить чужой application_id). Гость (без сессии) — по номеру.
    if ($appRow && $uid && !empty($appRow['user_id']) && (int) $appRow['user_id'] !== (int) $uid) {
        json_out(['ok' => false, 'error' => 'Эта заявка принадлежит другому участнику — заказ по ней недоступен.'], 403);
    }
    if (!$appRow || trim((string) ($appRow['result'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'По этой заявке ещё нет результата оценки — заказ наград недоступен. Дождитесь публикации результатов.'], 422);
    }
    // Короткий конкурс: заказ открывается только после того, как результат РЕАЛЬНО
    // отправлен участнику на почту — до этого он не должен знать своё звание.
    if ((string) ($appRow['results_mode'] ?? '') !== 'list'
        && trim((string) ($appRow['result_sent_at'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'Результат по этой заявке ещё не направлен участнику. Заказ наград откроется после получения результата на почту.'], 422);
    }
    // Длинный конкурс: заказ наград доступен ТОЛЬКО после публикации результатов.
    if ((string) ($appRow['results_mode'] ?? '') === 'list'
        && trim((string) ($appRow['results_published_at'] ?? '')) === '') {
        json_out(['ok' => false, 'error' => 'Результаты этого конкурса ещё не опубликованы. Заказ наград откроется после публикации итогов.'], 422);
    }
    // Окно заказа: два месяца со дня закрытия приёма. Дальше награды по конкурсу
    // не изготавливаются, и принимать деньги за них нельзя (core/orders.php).
    if (!function_exists('awards_window_open')) require_once BASE_PATH . '/core/orders.php';
    $__win = ['status' => (string) ($appRow['comp_status'] ?? ''), 'end_date' => (string) ($appRow['end_date'] ?? '')];
    if (!awards_window_open($__win)) {
        $__end = awards_window_end($__win);
        json_out(['ok' => false, 'error' => 'Срок заказа наградного материала по этому конкурсу истёк'
            . ($__end !== '' ? ' ' . date('d.m.Y', strtotime($__end)) : '')
            . '. Награды изготавливаются в течение двух месяцев после закрытия приёма заявок.'], 422);
    }
}

/* ЛЬГОТНАЯ ЗАЯВКА КЛУБА: ДИПЛОМЫ ПО НЕЙ БЕСПЛАТНЫ (слово владельца 15.10.2026).
 *
 * «3 заявки на участие бесплатно (без оргвзноса). Бесплатно дипломы,
 * дополнительные дипломы, благодарственные письма, по этим заявкам на участие.»
 * Этой привилегией владелец заменил снятые «закрытые конкурсы Клуба».
 *
 * РЕШАЕТ ОДИН ИСТОЧНИК - `core/club_free.php`: здесь только применяем. Вторая
 * копия условия (какие документы, по каким заявкам) разошлась бы с витриной и с
 * ботом молча - грабля оплачена правилами 33, 35, 45, 47, 56а, 64.
 *
 * БЕСПЛАТЕН ТОЛЬКО ЭЛЕКТРОННЫЙ ВИД (слово владельца 15.10.2026: «бесплатны
 * только электронные, оригиналы по прайсу со скидкой»).
 *
 * СЧИТАЕМ ПОСЛЕ СБОРКИ СУММЫ И ДО СКИДОК: обнулённая позиция в скидку уже не
 * попадает, а всё остальное (оригиналы на бланках, именной диплом, кубок,
 * статуэтка, медаль) идёт со клубными процентами как раньше.
 *
 * ЗАЯВКА НУЖНА ИМЕННО ЭТА. Отметка стоит на самой заявке (`club_free`), поэтому
 * льгота не переносится ни на четвёртую заявку месяца, ни на чужую: заказ по
 * чужой заявке сервер и так не принимает (проверка выше). */
if (!$isClubOrder && $applicationId && $amount > 0) {
    if (!function_exists('club_free_award_besplatno') && is_file(BASE_PATH . '/core/club_free.php')) {
        require_once BASE_PATH . '/core/club_free.php';
    }
    if (function_exists('club_free_award_besplatno')) {
        $__снято = [];
        foreach ($normItems as $__i => $__ni) {
            if ((int) ($__ni['price'] ?? 0) <= 0) continue;
            /* ВИД ОБЯЗАТЕЛЬНО: бесплатен только электронный (слово владельца
               15.10.2026). Оригинал на бланке печатают и везут почтой - он платный,
               со клубной скидкой, и обнулять его нельзя. */
            if (!club_free_award_besplatno($applicationId, (string) ($__ni['item'] ?? ''),
                                           (string) ($__ni['kind'] ?? ''))) continue;
            $__снято[] = (string) $__ni['item'] . ' / ' . (string) ($__ni['kind'] ?? '')
                       . ' (' . (int) $__ni['price'] . ')';
            $normItems[$__i]['price'] = 0;
            /* Отметка в составе заказа: по ней в админке и в письме видно, что
               ноль - это привилегия Клуба, а не ошибка прайса. */
            $normItems[$__i]['club_free'] = 1;
        }
        if ($__снято) {
            $serverAmount = 0;
            foreach ($normItems as $__ni) $serverAmount += (int) ($__ni['price'] ?? 0);
            $amount = $serverAmount;
            audit('order_club_free_awards', 'awards_orders', null,
                  ['application_id' => $applicationId, 'бесплатно' => $__снято]);
        }
    }
}

// Заявку привело учреждение-партнёр — скидка положена и без промокода: обещание
// в письме и в кабинете партнёра звучит как «скидка на заказ наградного
// материала», а не «скидка тому, кто помнит код».
if (!$isClubOrder && $applicationId && $partnerPctOrder === 0) {
    // Файл партнёрки мог не подключиться выше (заказ на нулевую сумму), а без него
    // нет и PARTNER_PROMO_PCT: обращение к неизвестной константе уронило бы заказ.
    if (!defined('PARTNER_PROMO_PCT') && is_file(BASE_PATH . '/core/partner.php')) {
        require_once BASE_PATH . '/core/partner.php';
    }
    try {
        $__instId = (int) (scalar("SELECT COALESCE(institution_id,0) FROM applications WHERE id=?", [$applicationId]) ?? 0);
        if ($__instId > 0) {
            $__inst = one("SELECT partner_status FROM institutions WHERE id=?", [$__instId]);
            if ($__inst && (string) ($__inst['partner_status'] ?? '') === 'accepted' && defined('PARTNER_PROMO_PCT')) {
                $partnerPctOrder = PARTNER_PROMO_PCT;
            }
        }
    } catch (\Throwable $e) {}
}

// Скидки не складываются: берём ту, что выгоднее человеку. Партнёрская и клубная
// обе объявлены как «скидка на наградной материал», и сложить их значило бы
// отдать документ за половину цены вопреки обоим обещаниям.
$amountBeforeDiscount = $amount;
$discPctOrder = max($clubPctOrder, $partnerPctOrder);
if ($discPctOrder > 0 && $amount > 0) {
    if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
    $amount = function_exists('loyalty_apply')
        ? loyalty_apply($amount, $discPctOrder)
        : (int) round($amount * (100 - $discPctOrder) / 100);
}

/* БОНУС ПОДПИСЧИКА СООБЩЕСТВА ВКОНТАКТЕ — 2% НА ЭЛЕКТРОННЫЕ ДОКУМЕНТЫ.
 *
 * Решение владельца от 21.10.2026. Бонус складывается с клубной или
 * партнёрской скидкой (в отличие от них двоих между собой): те обещаны «на
 * наградной материал» целиком и потому спорят друг с другом, а этот даётся за
 * другое действие и только на один вид позиций — электронные документы
 * (kind='digital'). Поэтому он считается ОТДЕЛЬНО, от уже уценённой стоимости
 * именно этих позиций, и к оригиналам, изделиям и членству в клубе отношения
 * не имеет.
 *
 * Считаем ПОСЛЕ основной скидки и после обнуления клубных бесплатных позиций:
 * бесплатная позиция в бонус уже не попадает (её цена ноль).
 *
 * Подписка проверяется по базе, а не запросом в ВК: признак обновляет суточная
 * сверка (cron/vk_subs_sync.php) и кнопка «Я подписался» в кабинете. Точечный
 * запрос здесь делается только если запись устарела, и его отказ ничего не
 * ломает — человек просто получит бонус в следующий раз. */
$vkBonusPct = 0;
$vkBonusRub = 0;
if (!$isClubOrder && $uid && $amount > 0) {
    if (!function_exists('vk_sub_user_pct') && is_file(BASE_PATH . '/core/vk_subscriber.php')) {
        require_once BASE_PATH . '/core/vk_subscriber.php';
    }
    if (function_exists('vk_sub_user_pct')) {
        if (function_exists('vk_sub_check')) { try { vk_sub_check((int) $uid); } catch (\Throwable $e) {} }
        $vkBonusPct = (int) vk_sub_user_pct((int) $uid);
        $digitalSum = $vkBonusPct > 0 ? (int) vk_sub_digital_sum($normItems) : 0;
        if ($digitalSum > 0) {
            // Электронные позиции уже уценены основной скидкой — бонус берём от их
            // фактической стоимости, иначе он оказался бы больше обещанного.
            $digitalAfter = $discPctOrder > 0 && function_exists('loyalty_apply')
                ? loyalty_apply($digitalSum, $discPctOrder)
                : $digitalSum;
            $vkBonusRub = (int) round($digitalAfter * $vkBonusPct / 100);
            if ($vkBonusRub > 0) $amount = (int) max(0, $amount - $vkBonusRub);
        }
        if ($vkBonusRub <= 0) $vkBonusPct = 0;   // бонуса фактически не было — не обещаем его в чеке
    }
}

// --- ПРАВИЛА СОСТАВА НАГРАД (сервер — источник истины) ---
// Трофей строго по аттестационному результату ЗАЯВКИ (не по тому, что прислал клиент);
// электронные основной/дополнительный в платном конкурсе не заказываются.
// Раньше проверка была только в JS: подменой запроса дипломант мог заказать кубок.
if (!$isClubOrder && $applicationId) {
    require_once BASE_PATH . '/core/orders.php';
    // Результат и платность берём из ЗАЯВКИ (её конкурс), а не из полей запроса —
    // иначе состав наград определялся бы тем, что подставил клиент.
    $appResult  = (string) ($appRow['result'] ?? '');
    /* Конкурс Клуба приравнивается к платному в части состава: электронные
     * основной и дополнительный входят в участие и заказу не подлежат. */
    $compIsPaid = (int) ($appRow['comp_is_paid'] ?? 0) === 1
               || (int) ($appRow['comp_club_only'] ?? 0) === 1;
    foreach ($normItems as $ni) {
        [$allowed, $why] = award_item_allowed(
            (string) ($ni['item'] ?? ''), (string) ($ni['kind'] ?? 'original'), $appResult, $compIsPaid,
            // Коллектив или солист — берём из ЗАЯВКИ: именной положен только коллективу.
            (int) ($appRow['is_group'] ?? 0) === 1
        );
        if (!$allowed) {
            json_out(['ok' => false, 'error' => 'Позиция «' . (string) ($ni['item'] ?? '') . '»: ' . $why], 422);
        }
        /* ДОПОЛНИТЕЛЬНЫЙ ДИПЛОМ ЗАКАЗЫВАЮТ ТОЛЬКО ТОГДА, КОГДА ЕГО ПРИСУДИЛИ.
         *
         * Он выдаётся не за участие, а за отдельное достоинство выступления —
         * «за артистизм», «за патриотизм», — и решает это жюри. Если в заявке
         * дополнительный диплом не проставлен, печатать нечего: номинацию не
         * выдумаешь. Заказ №77 такую позицию пропустил, человек заплатил 350 ₽ и
         * документа не получил — потому что его и не существует.
         *
         * Проверяем на сервере: формы шлют сюда обе, а подсказку в браузере
         * обойти ничего не стоит. */
        if (preg_match('~дополнительн~ui', (string) ($ni['item'] ?? ''))
            && trim((string) ($appRow['extra_diploma'] ?? '')) === '') {
            json_out(['ok' => false, 'error' => 'Дополнительный диплом по этой заявке не присуждён. '
                . 'Его назначает жюри за отдельное достоинство выступления (за артистизм, за патриотизм '
                . 'и подобное) — и он всегда назван в Вашем результате. Заказать его отдельно нельзя.'], 422);
        }
    }

    /* БЕЗ ОСНОВНОГО ДИПЛОМА ДОПОЛНЕНИЯ НЕ ЗАКАЗЫВАЮТСЯ.
     *
     * Проверка стоит на сервере, потому что это правило центра, а не подсказка
     * формы: обе витрины (магазин образцов и форма заказа) шлют сюда, и обойти
     * подсказку в браузере ничего не стоит.
     *
     * Отказ отдаём не голым текстом: в need_base лежит всё, чтобы страница
     * показала окно «у Вас нет основного диплома» с готовой кнопкой «добавить в
     * корзину» — нужного вида и с реальной ценой. Человек не должен гадать,
     * что именно ему добавить и почему заказ не проходит. */
    $base = award_base_required($normItems, $applicationId, $compIsPaid);
    if (!empty($base['need'])) {
        $bKind = (string) $base['kind'];
        // Цена основного диплома по прайсу: сначала персональный прайс конкурса,
        // потом общий. Своё замыкание, а не $pickPrice выше: то привязано к
        // последней разобранной позиции заказа.
        $basePrice = static function (?int $cid, string $kind): ?int {
            $rows = $cid !== null
                ? all("SELECT item, price FROM awards_prices WHERE competition_id=? AND kind=?", [$cid, $kind])
                : all("SELECT item, price FROM awards_prices WHERE competition_id IS NULL AND kind=?", [$kind]);
            foreach ($rows as $r) {
                if (award_canon_item((string) $r['item']) === 'Основной диплом') return (int) $r['price'];
            }
            return null;
        };
        $bPrice = $compId !== null ? $basePrice($compId, $bKind) : null;
        if ($bPrice === null) $bPrice = $basePrice(null, $bKind);
        json_out([
            'ok'    => false,
            'error' => 'В заказе нет основного диплома по Вашему аттестационному результату. '
                     . 'Позиция «' . (string) $base['blocked'] . '» — дополнение к нему и отдельно не изготавливается.',
            'need_base' => [
                'item'  => 'Основной диплом',
                'kind'  => $bKind,
                'price' => (int) ($bPrice ?? 0),
                'label' => 'Основной диплом — ' . ($bKind === 'digital' ? 'электронная версия' : 'оригинал на бланке'),
                'blocked' => (string) $base['blocked'],
            ],
        ], 422);
    }
}

// --- Серверная валидация получателя и адреса (зеркало клиентской проверки) ---
// ФИО — ПОЛНОСТЬЮ (Фамилия Имя Отчество). Адрес — полный (город/улица/ДОМ), только если
// в заказе есть ОРИГИНАЛ (kind=original), т.е. нужна почтовая доставка. Клубное членство —
// без этих требований (это не отправляемый материал).
$hasOriginal = false; $hasDigital = false;
foreach ($normItems as $ni) {
    $k = (string) ($ni['kind'] ?? '');
    if ($k === 'original') $hasOriginal = true;
    elseif ($k === 'digital') $hasDigital = true;
}
if (!$isClubOrder) {
    $fio = trim((string) input('full_name'));
    $fioParts = array_values(array_filter(preg_split('~\s+~u', $fio) ?: [], static fn($w) => mb_strlen($w) >= 2));
    if (count($fioParts) < 3) {
        json_out(['ok' => false, 'error' => 'Укажите ФИО получателя ПОЛНОСТЬЮ: Фамилия, Имя и Отчество.'], 422);
    }
}
/* СОГЛАСИЯ ПРОВЕРЯЕТ СЕРВЕР, А НЕ ТОЛЬКО ФОРМА.
 *
 * Три подтверждения перед оплатой: положение конкурса, обработка персональных
 * данных и сроки изготовления с доставкой. Проверка в браузере обходится, а
 * спор о сроках возникает уже после списания денег - поэтому отказываем здесь,
 * до создания платежа. Заказ клубного членства сюда не относится: там нет ни
 * наградного материала, ни сроков изготовления. */
if (!$isClubOrder) {
    $agreeMap = [
        'ord_agree_reg'   => 'подтвердите, что ознакомились с положением конкурса',
        'ord_agree_pd'    => 'подтвердите согласие на обработку персональных данных',
        'ord_agree_terms' => 'подтвердите, что ознакомились со сроками изготовления и доставки',
    ];
    foreach ($agreeMap as $field => $why) {
        if (!in_array((string) input($field), ['1', 'true', 'on'], true)) {
            json_out(['ok' => false, 'error' => 'Для оформления заказа ' . $why . '.'], 422);
        }
    }
}

// Индекс заказа: у электронных его нет и быть не должно — им никуда не ехать.
$addrPostal = '';
/* КАНОНИЧЕСКИЙ АДРЕС ОБЪЯВЛЯЕТСЯ ЗДЕСЬ, А НЕ ВНУТРИ ВЕТКИ ОРИГИНАЛОВ.
 *
 * Он заполняется только когда в корзине есть оригинал (справочник адресов
 * спрашивают там), а ЧИТАЕТСЯ ниже у КАЖДОГО заказа. У электронного заказа
 * переменной не было вовсе, и строка `$addrCanon !== '' ? ... : input('address')`
 * брала первую ветку: `null !== ''` это ИСТИНА, и в адрес ложился null вместо
 * введённого. Сегодня электронному заказу адрес не нужен и никто ничего не
 * терял, но PHP писал предупреждение в журнал сервера ДВАЖДЫ на каждый заказ -
 * ровно тот шум, что прячет настоящие отказы (урок правила 42). */
$addrCanon  = '';
if ($hasOriginal) {
    $addr = trim((string) input('address'));
    $hasHouse  = (bool) preg_match('~(^|[\s,.])(д(ом)?\.?\s*)?\d+~iu', $addr);
    $hasStreet = (bool) preg_match('~(ул|улиц|просп|пр-?кт|пер(еул)?|шоссе|бульв|наб|аллея|проезд|тракт|мкр|микрорайон|кварт|деревн|село|посёл|поселок|станиц)~iu', $addr);
    if ($addr === '' || !$hasHouse || !$hasStreet) {
        json_out(['ok' => false, 'error' => 'Адрес должен быть ПОЛНЫМ: город, улица и дом (номер квартиры — по желанию). Без дома отправить нельзя.'], 422);
    }

    /* АДРЕС БЕРЁТСЯ ИЗ ПОДСКАЗОК, А НЕ ПЕЧАТАЕТСЯ НА ГЛАЗ.
     *
     * Правило владельца. Проверка в браузере обходится, а посылка уедет по тому,
     * что записано, поэтому сверяем здесь: сервис должен разобрать адрес до дома
     * и знать почтовый индекс — без индекса Почта России посылку не примет.
     *
     * Справочник знает не всё: новостройки попадают в него с опозданием, есть
     * абонентские ящики, воинские части, частный сектор без улиц, а зарубежные
     * адреса он знает куда хуже российских. Поэтому у формы остаётся выход
     * «моего адреса нет в списке»: заказ принимается, но помечается для проверки
     * человеком — потерять живого заказчика хуже, чем перепроверить адрес. */
    if (!function_exists('addr_validate') && is_file(BASE_PATH . '/core/address.php')) {
        require_once BASE_PATH . '/core/address.php';
    }
    $addrManual = in_array((string) input('address_manual'), ['1', 'true', 'on'], true);
    $addrCanon = '';
    if (function_exists('addr_validate')) {
        $chk = addr_validate($addr);
        if (!$chk['ok'] && !$addrManual) {
            json_out(['ok' => false, 'error' => 'Выберите адрес из подсказок: ' . $chk['reason']
                . '. Начните вводить адрес и нажмите на нужную строку в списке. '
                . 'Если Вашего адреса в списке нет — отметьте «Моего адреса нет в подсказках», '
                . 'и мы проверим его вручную.', 'address_hint' => true], 422);
        }
        /* РОССИЙСКИЙ АДРЕС ЗАПИСЫВАЕМ В ВИДЕ СПРАВОЧНИКА, А НЕ КАК НАБРАЛ ЧЕЛОВЕК.
         *
         * Решение владельца: по России адрес всегда применяется из подсказки,
         * чтобы одна и та же квартира не появлялась в базе в трёх написаниях —
         * с индексом и без, «мкр» то развёрнутым, то опущенным. Именно из-за
         * этого центр однажды собрал две посылки на один адрес.
         *
         * Берём канонический вид ТОЛЬКО когда сервис подтвердил адрес до дома и
         * это Россия: ФИАС знает её, а Минск и Алматы — нет, и там остаётся
         * написанное человеком. Квартиру дописывает addr_validate, если сервис
         * опустил её в своём ответе. */
        if ($chk['ok'] && !empty($chk['ru']) && trim((string) $chk['value']) !== '') {
            $addrCanon  = trim((string) $chk['value']);
            $addrPostal = trim((string) $chk['postal']);
        }
    }
    /* ИНДЕКС ОБЯЗАТЕЛЕН. Правило владельца: без индекса заказ не уходит в
     * производство вовсе. Из подсказки индекс приходит сам, поэтому здесь ловим
     * только адрес, введённый руками: попросить индекс сейчас, пока человек у
     * формы, дешевле, чем разыскивать его потом с готовой посылкой на руках. */
    if ($addrPostal === '' && preg_match('~(?<!\d)(\d{6})(?!\d)~u', $addr, $mPi)) $addrPostal = $mPi[1];
    if ($addrPostal === '' && $addrManual) {
        json_out(['ok' => false, 'error' => 'Укажите почтовый индекс в адресе: без него Почта России '
            . 'посылку не примет. Впишите шесть цифр индекса в начало адреса.', 'address_hint' => true], 422);
    }
    if ($addrManual && function_exists('audit')) {
        audit('order_address_manual', 'awards_orders', null, ['address' => mb_substr($addr, 0, 200)]);
    }
}

/* ДВА НАЖАТИЯ - ОДИН ЗАКАЗ.
 *
 * Кнопка «Оплатить» на странице наград блокировалась, но отпускалась раньше,
 * чем браузер успевал уйти на кассу, и второй клик в ту же секунду создавал
 * второй заказ со вторым платежом. 20 октября так появились заказы №675 и
 * №676 у Снеговой (разница одна секунда) и два платежа по заказу №674 у
 * Буланова; за месяц таких пар три. Кнопку починили, но полагаться на браузер
 * здесь нельзя: клик приходит и из второй вкладки, и после «назад».
 *
 * Если тот же человек минуту назад создал точно такой же неоплаченный заказ -
 * отдаём его же и новую ссылку на оплату. Человек попадает на кассу, а не
 * заводит себе второй счёт на те же дипломы. */
$__itemsJson = json_encode($normItems, JSON_UNESCAPED_UNICODE);
$__emailNorm = mb_strtolower(trim((string) input('email')));
/* Осознанный повтор: человек увидел предупреждение о прежнем заказе и сказал,
   что второй экземпляр ему правда нужен. Жёсткий случай (оплаченный электронный
   документ) этим флагом НЕ снимается — проверка ниже смотрит на него сама. */
$__пропуститьДубль = in_array((string) input('confirm_duplicate'), ['1', 'yes', 'true'], true);
if ($__emailNorm !== '' || $uid) {
    $__w = $uid ? 'COALESCE(user_id,0) = ' . (int) $uid : 'lower(trim(email)) = ?';
    /* У ПОДПИСКИ КЛУБА ОКНА НЕТ ВОВСЕ.
     *
     * Полторы минуты ловят двойной клик, но не человека, который вернулся
     * через пять минут и начал заново: 21 октября Мухамадеева оформила
     * вступление дважды с разницей в четыре минуты (№679 и №680) — два счёта
     * на одно и то же членство. Вступить в клуб дважды нельзя, поэтому любой
     * неоплаченный клубный заказ того же человека переиспользуется. */
    $__isClubOrder = false;
    foreach ((array) $normItems as $__it) {
        if (is_array($__it) && (string) ($__it['kind'] ?? '') === 'club') { $__isClubOrder = true; break; }
    }
    $__age = $__isClubOrder ? '-30 days' : '-90 seconds';
    try {
        $__dup = one("SELECT id FROM awards_orders
                       WHERE status = 'new' AND items = ?
                         AND $__w
                         AND created_at >= datetime('now','localtime','$__age')
                    ORDER BY id DESC LIMIT 1",
                    $uid ? [$__itemsJson] : [$__itemsJson, $__emailNorm]);
    } catch (\Throwable $e) { $__dup = null; }
    if ($__dup && (int) $__dup['id'] > 0) {
        $__dupId  = (int) $__dup['id'];
        $__dupRow = one("SELECT id, amount, email, kind FROM awards_orders WHERE id=?", [$__dupId]);
        if (function_exists('audit')) audit('order_duplicate_click', 'awards_orders', $__dupId, []);

        // Платёж заводим на тот же заказ - тем же путём, что и ниже для нового.
        $__pay = null;
        try {
            $__isClub = (string) ($__dupRow['kind'] ?? '') === 'club';
            $__pay = yukassa_create_payment(
                (int) ($__dupRow['amount'] ?? 0),
                $__isClub ? 'Членство в Элитном клубе «Музыкальный Мир»' : ('Наградные материалы, заказ №' . $__dupId),
                ['order_id' => $__dupId, 'email' => (string) ($__dupRow['email'] ?? ''), 'save_payment_method' => $__isClub]
            );
        } catch (\Throwable $e) { $__pay = null; }

        if ($__pay && !empty($__pay['id'])) {
            update('awards_orders', ['payment_id' => $__pay['id']], 'id=:id', ['id' => $__dupId]);
            if (function_exists('tbl_exists') && tbl_exists('payments')) {
                try {
                    insert('payments', [
                        'order_id'   => $__dupId,
                        'amount'     => (int) ($__dupRow['amount'] ?? 0),
                        'method'     => 'yukassa',
                        'status'     => $__pay['status'] ?? 'pending',
                        'yukassa_id' => $__pay['id'],
                        'purpose'    => 'order',
                    ]);
                } catch (\Throwable $e) { /* запись платежа не должна рушить оплату */ }
            }
        }
        json_out(['ok' => true, 'order_id' => $__dupId, 'duplicate' => true]
            + (!empty($__pay['confirmation_url']) ? ['confirmation_url' => (string) $__pay['confirmation_url']] : []));
    }
}

/* ПОВТОРНЫЙ ЗАКАЗ ТОГО ЖЕ ДОКУМЕНТА ПО ТОЙ ЖЕ ЗАЯВКЕ.
 *
 * Заслон выше ловит только двойной клик: тот же человек, неоплаченный заказ,
 * полторы минуты. А дубль приходит и иначе — с ДРУГОГО аккаунта. Косьянова
 * Анна оформила награды по заявке 399 из кабинета, а через три минуты тем же
 * человеком как гость: заказы #197 и #198, 400 ₽ списаны дважды. Поэтому
 * сверяем не аккаунт и не почту, а заявку и состав — ровно так же, как это
 * давно сделано для заявок на участие.
 *
 * ЗАПРЕЩАЕМ НАСОВСЕМ ТОЛЬКО ОПЛАЧЕННОЕ ЭЛЕКТРОННОЕ. Файл уже выписан и лежит
 * в кабинете; второй такой же не нужен никому и ничем не отличается.
 * ОРИГИНАЛ — ДРУГОЕ ДЕЛО: второй экземпляр диплома для школы или для семьи
 * заказывают осознанно, и запретить это значит отнять у центра законный заказ.
 * Поэтому там предупреждение, которое снимается подтверждением.
 * НЕОПЛАЧЕННЫЙ прежний заказ не повод отказывать: зовём закончить его, чтобы
 * человек не плодил счета.
 *
 * Клубное членство сюда не попадает: у него свой заслон на 30 дней выше.
 */
if (!$isClubOrder && $applicationId > 0) {
    /* Ключ позиции: что именно и в каком виде. ФИО получателя в ключ НЕ берём:
       именной диплом на того же человека — это тот же документ, а разные ФИО
       в одном заказе и так разные позиции. */
    $__ключ = static function (array $it): string {
        return mb_strtolower(trim((string) ($it['item'] ?? ''))) . '|' . (string) ($it['kind'] ?? '');
    };
    $__новые = [];
    foreach ($normItems as $__ni) if (is_array($__ni)) $__новые[$__ключ($__ni)] = (string) ($__ni['item'] ?? '');

    $__прежние = all("SELECT id, status, items, created_at, user_id, email, amount
                        FROM awards_orders
                       WHERE application_id = ? AND status <> 'canceled'
                    ORDER BY id DESC LIMIT 50", [$applicationId]);
    $__совпал = null; $__совпавшие = []; $__оплачен = false;
    foreach ($__прежние as $__по) {
        $__его = json_decode((string) ($__по['items'] ?? '[]'), true);
        if (!is_array($__его)) continue;
        $__пересеч = [];
        foreach ($__его as $__it) {
            if (!is_array($__it)) continue;
            $__k = $__ключ($__it);
            if (isset($__новые[$__k])) $__пересеч[$__k] = $__новые[$__k]
                . ((string) ($__it['kind'] ?? '') === 'digital' ? ' (электронный)' : ' (оригинал)');
        }
        if (!$__пересеч) continue;
        $__совпал = $__по; $__совпавшие = $__пересеч;
        $__оплачен = function_exists('order_is_paid') ? order_is_paid($__по)
                   : in_array((string) $__по['status'], ['paid','made','shipped','delivered'], true);
        if ($__оплачен) break;   // оплаченный повтор важнее неоплаченного
    }

    if ($__совпал) {
        $__свой = ($uid && (int) ($__совпал['user_id'] ?? 0) === (int) $uid)
               || ($__emailNorm !== '' && mb_strtolower(trim((string) ($__совпал['email'] ?? ''))) === $__emailNorm);
        $__когда = function_exists('ru_date') && trim((string) $__совпал['created_at']) !== ''
                 ? ru_date(substr((string) $__совпал['created_at'], 0, 10)) . ', ' . substr((string) $__совпал['created_at'], 11, 5)
                 : (string) $__совпал['created_at'];
        $__что = implode(', ', array_values($__совпавшие));
        /* Жёстко — только оплаченный электронный документ: он уже выписан. */
        $__жёстко = false;
        foreach (array_keys($__совпавшие) as $__k) if (str_ends_with($__k, '|digital')) $__жёстко = true;
        $__жёстко = $__жёстко && $__оплачен;

        /* ЧЕЙ ЭТО ЗАКАЗ — ГОВОРИМ ТОЛЬКО ХОЗЯИНУ.
         *
         * Назвать почту или имя того, кто оформил заказ с другого аккаунта,
         * нельзя: это персональные данные третьего лица, а центр — оператор
         * ПД. Поэтому чужому заказу сообщаем лишь номер, дату и состав —
         * этого достаточно, чтобы человек понял, что награда уже заказана,
         * и обратился в оргкомитет. */
        $__текст = $__оплачен
            ? ('По этой заявке уже оплачен заказ №' . (int) $__совпал['id'] . ' от ' . $__когда . ': ' . $__что . '. ')
            : ('По этой заявке уже оформлен, но НЕ оплачен заказ №' . (int) $__совпал['id'] . ' от ' . $__когда . ': ' . $__что . '. ');
        if (!$__свой) {
            $__текст .= 'Он оформлен с другого аккаунта — возможно, педагогом или родителем. ';
        }
        $__текст .= $__жёстко
            ? 'Электронные документы уже выписаны: они приходят письмом и лежат в личном кабинете, второй раз их изготавливать не нужно. '
              . 'Если документ не дошёл — напишите нам, пришлём повторно бесплатно.'
            : ($__оплачен
                ? 'Если Вам нужен ВТОРОЙ экземпляр — подтвердите, и мы примем заказ.'
                : 'Закончите оплату прежнего заказа, чтобы не заводить второй счёт на то же самое.');

        /* ПОДТВЕРЖДЕНИЕ СНИМАЕТ ПРЕДУПРЕЖДЕНИЕ, НО НЕ ЗАПРЕТ.
         *
         * Проверка флага стояла на входе во весь блок, и «да, нужен второй
         * экземпляр» пропускало заодно оплаченный электронный документ —
         * ровно то, ради чего запрет и ставился. Теперь флаг разбирается
         * здесь: мягкий случай он снимает, жёсткий — нет. */
        if ($__пропуститьДубль && !$__жёстко) {
            if (function_exists('audit')) {
                audit('order_duplicate_confirmed', 'awards_orders', (int) $__совпал['id'],
                      ['application_id' => $applicationId, 'свой' => $__свой]);
            }
        } else {
        if (function_exists('audit')) {
            audit('order_duplicate_blocked', 'awards_orders', (int) $__совпал['id'],
                  ['application_id' => $applicationId, 'жёстко' => $__жёстко, 'свой' => $__свой]);
        }
        json_out(['ok' => false, 'error' => $__текст, 'duplicate_warn' => [
            'order_id'     => (int) $__совпал['id'],
            'created_at'   => $__когда,
            'items'        => array_values($__совпавшие),
            'paid'         => $__оплачен,
            'same_account' => $__свой,
            'hard'         => $__жёстко,
        ]], 409);
        }
    }
}

/* Колонки бонуса подписчика заводятся лениво — обязательно ДО записи заказа и
   независимо от того, считался бонус или нет: поля идут в insert всегда, и без
   колонок упал бы любой заказ (гостевой, клубный, на нулевую сумму). */
if (!function_exists('vk_sub_order_boot') && is_file(BASE_PATH . '/core/vk_subscriber.php')) {
    require_once BASE_PATH . '/core/vk_subscriber.php';
}
if (function_exists('vk_sub_order_boot')) vk_sub_order_boot();

$orderId = insert('awards_orders', [
    'application_id' => $applicationId ?: null,
    'user_id'        => $uid,
    'full_name'      => input('full_name'),
    // Конкурс и результат фиксируются по заявке — клиентские значения не принимаем.
    'competition'    => (string) ($appRow['comp_name'] ?? $comp['name'] ?? input('competition')),
    'result'         => (string) ($appRow['result'] ?? input('result')),
    'items'          => json_encode($normItems, JSON_UNESCAPED_UNICODE),
    'amount'         => $amount,
    // Полная цена до скидки и её размер — для чека, админки и писем. Пишем ту
    // скидку, которая реально применена: клубную или партнёрскую, что выгоднее.
    'amount_full'    => $amountBeforeDiscount,
    'discount_pct'   => $discPctOrder,
    // Бонус подписчика сообщества ВКонтакте — отдельной строкой: он живёт по
    // своим правилам (только электронные позиции) и складывается с основной.
    'vk_bonus_pct'   => $vkBonusPct,
    'vk_bonus_rub'   => $vkBonusRub,
    'email'          => mb_strtolower(input('email')),
    'phone'          => input('phone'),
    // По России — канонический вид из справочника (см. проверку выше); зарубежье
    // и адреса, которых справочник не знает, остаются как написал человек.
    'address'        => $addrCanon !== '' ? $addrCanon : input('address'),
    // Индекс отдельным полем: он нужен на конверте и без него посылка не поедет.
    'postal_index'   => $addrPostal,
    /* КЛЮЧ АДРЕСА — ДЛЯ СБОРКИ ПОСЫЛОК, А НЕ ДЛЯ КОНВЕРТА.
     *
     * Сам адрес остаётся ровно таким, как его написал человек: по этой строке
     * повезёт почтальон. А ключ считается по каноническому виду из DaData, и
     * именно он решает, одна это посылка или две. Без ключа один и тот же адрес,
     * записанный руками и выбранный из подсказки, ехал двумя отправлениями. */
    'addr_key'       => (static function (string $a): string {
        if (trim($a) === '') return '';
        if (!function_exists('addr_key') && is_file(BASE_PATH . '/core/address.php')) {
            require_once BASE_PATH . '/core/address.php';
        }
        try { return function_exists('addr_key') ? addr_key($a) : ''; }
        catch (\Throwable $e) { return ''; }   // подсказки недоступны — группировка сама разберётся по строке
    })((string) input('address')),
    /* ВИД ЗАКАЗА — ПО ЕГО СОСТАВУ, А НЕ ПО УМОЛЧАНИЮ.
     *
     * Колонка заполнялась значением по умолчанию 'original', и заказ на одну
     * электронную версию выглядел в базе и в выгрузках как посылка на бланке.
     * На изготовление это не влияло (и письмо, и производство читают состав),
     * но в списках заказ читался неверно. Считаем честно: есть хоть один
     * оригинал и есть электронные — 'mixed'; только оригиналы — 'original';
     * только электронные — 'digital'; членство клуба — 'club'. */
    'kind'           => $isClubOrder ? 'club' : ($hasOriginal ? ($hasDigital ? 'mixed' : 'original') : 'digital'),
    'status'         => 'new',
]);

/* БЕСПЛАТНЫЙ ЗАКАЗ ПЛАТЕЖА НЕ СОЗДАЁТ ВОВСЕ.
 *
 * При нулевой сумме `yukassa_create_payment` возвращает заглушку со статусом
 * `pending`, и в `payments` ложилась строка «ждём 0 ₽». Дожим неоплаченных
 * (cron/order_unpaid_reminder.php) читает такой заказ как неоплаченный и пишет
 * человеку «оплатите» - за то, что центр сам объявил бесплатным. */
$payment = null;
if ($amount > 0) {
$payment = yukassa_create_payment(
    $amount,
    $isClubOrder ? 'Членство в Элитном клубе «Музыкальный Мир»' : ('Наградные материалы, заказ №' . $orderId),
    [
        'order_id' => $orderId,
        'email'    => mb_strtolower(input('email')),
        // Для подписки клуба просим сохранить способ оплаты — следующие периоды
        // спишутся автоматически (ежемесячно либо раз в год).
        'save_payment_method' => $isClubOrder,
    ]
);
}
if ($payment && !empty($payment['id'])) {
    update('awards_orders', ['payment_id' => $payment['id']], 'id=:id', ['id' => $orderId]);
    if (tbl_exists('payments')) {
        insert('payments', [
            'order_id'   => $orderId,
            'amount'     => $amount,
            'method'     => 'yukassa',
            'status'     => $payment['status'] ?? 'pending',
            'yukassa_id' => $payment['id'],
            'purpose'    => 'awards',
        ]);
    }
}
audit('order', 'awards_orders', $orderId, ['amount' => $amount]);

// --- Данные заказа для уведомлений ---
$buyerName  = input('full_name');
$buyerEmail = mb_strtolower(input('email'));
$compName   = $comp['name'] ?? input('competition');
$itemsText  = implode(', ', array_map(
    static fn($it) => $it['item'] . (!empty($it['fio']) ? ' — ' . $it['fio'] : '') . ' (' . $it['kind'] . ') - ' . money((int) $it['price']),
    $normItems
));

// --- ГЕЙТ ПО ОПЛАТЕ (Даниэль): до оплаты заказ «не существует» ---
// Пока заказ НЕ оплачен: НЕ шлём письмо-подтверждение покупателю, НЕ уведомляем
// админа/владельца в Telegram, заказ НЕ показывается в админ-разделе «Заказы»
// (там фильтр по статусу оплаты). Покупатель видит заказ в кабинете и может его
// оплатить или удалить; дожим «оплатите» шлёт cron. Все уведомления и письмо-
// подтверждение уходят из core/payments.php в момент подтверждения оплаты.
// Единственное исключение — БЕСПЛАТНЫЙ заказ (amount<=0): принимаем сразу.
$orderIsFree = ($amount <= 0);

if ($orderIsFree) {
    /* БЕСПЛАТНЫЙ ЗАКАЗ ИСПОЛНЯЕТСЯ СРАЗУ: ПЛАТЕЖА, КОТОРЫЙ ЕГО ОТКРОЕТ, НЕ БУДЕТ.
     *
     * Изготовление запускает `core/payments.php` в момент подтверждения оплаты:
     * статус `paid`, производственный пакет оригиналов и выдача электронных. У
     * заказа на нулевую сумму платежа нет, и он остался бы в `new` НАВСЕГДА: в
     * разделе «Заказы оригиналов» такого не видно (там `paid` и `made`), бланки
     * не выдаются, а человек ждёт обещанный бесплатный диплом. Делаем ровно то,
     * что делает оплата, и теми же функциями - второй сборки производства в
     * проекте быть не должно. */
    update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => (int) $orderId]);
    if (is_file(BASE_PATH . '/core/orders.php')) {
        require_once BASE_PATH . '/core/orders.php';
        if (function_exists('order_dispatch_production')) {
            try { order_dispatch_production((int) $orderId); }
            catch (\Throwable $e) { error_log('order_dispatch_production: ' . $e->getMessage()); }
        }
        if (function_exists('order_fulfill_digital')) {
            try { order_fulfill_digital((int) $orderId); }
            catch (\Throwable $e) { error_log('order_fulfill_digital: ' . $e->getMessage()); }
        }
    }

    // --- уведомление админу (по образцу apply.php) ---
    if (function_exists('tg_notify_admin')) {
        tg_notify_admin(
            "Новый заказ наградных материалов №{$orderId}\n"
            . ($compName !== '' ? $compName . "\n" : '')
            . ($buyerName !== '' ? $buyerName . "\n" : '')
            . $itemsText . "\n"
            . 'Сумма: ' . money($amount)
        );
    }

    // --- уведомление владельца в 3 канала + серверная аналитика ---
    if (is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        try {
            $isClub = strpos(json_encode($normItems, JSON_UNESCAPED_UNICODE), '"kind":"club"') !== false;
            owner_notify(
                $isClub ? 'ЭЛИТНЫЙ КЛУБ' : 'ЗАКАЗЫ НАГРАД',
                $isClub ? 'Заявка на вступление в клуб (заказ №' . $orderId . ')' : 'Новый заказ наград №' . $orderId,
                '',
                [
                    'Покупатель' => $buyerName,
                    'Email'      => $buyerEmail,
                    'Конкурс'    => $compName,
                    'Состав'     => $itemsText,
                    'Сумма'      => money($amount),
                    '_event'     => $isClub ? 'club_order' : 'order',
                    '_path'      => '/order-awards',
                    '_meta'      => ['order_id' => $orderId, 'amount' => $amount],
                    '_actions'   => [['Открыть заказ в админке', rtrim((string) cfgv('base_url'), '/') . '/admin/?p=orders&id=' . $orderId]],
                ]
            );
        } catch (\Throwable $e) { /* тихо */ }
    }

    // --- письмо-подтверждение покупателю в очередь ---
    if ($buyerEmail !== '' && filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
        $subject = 'Заказ наградного материала принят';
        $orderCard = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">'
            . '<tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">'
            . '<div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Детали заказа</div>'
            . '<div><span style="color:#6B7699;">Номер заказа:</span> <b style="color:#17307A;">№' . h((string) $orderId) . '</b></div>'
            . '<div><span style="color:#6B7699;">Состав:</span> ' . h($itemsText) . '</div>'
            . '<div><span style="color:#6B7699;">Сумма:</span> <b style="color:#17307A;">' . h(money($amount)) . '</b></div>'
            . '</td></tr></table>';
        $html = function_exists('mail_template')
            ? mail_template('generic', [
                'title'     => 'Заказ наград принят',
                'name'      => $buyerName,
                'message'   => '<p style="margin:0 0 16px;">Ваш заказ наградного материала принят.</p>' . $orderCard
                    . '<p style="margin:16px 0 0;">Мы изготовим и отправим материалы, а трек-номер для отслеживания пришлём на этот адрес.</p>',
                'cta_url'   => rtrim((string) cfgv('base_url'), '/') . '/cabinet',
                'cta_text'  => 'Личный кабинет',
                'preheader' => 'Заказ №' . $orderId . ' принят.',
              ])
            : '<p>Здравствуйте' . ($buyerName !== '' ? ', ' . h($buyerName) : '') . '!</p>'
              . '<p>Ваш заказ наградного материала <b>№' . h((string) $orderId) . '</b> принят.</p>'
              . '<p><b>Состав заказа:</b> ' . h($itemsText) . '</p>';
        if (function_exists('mail_queue')) {
            mail_queue($buyerEmail, $buyerName, $subject, $html);
        } elseif (tbl_exists('mail_queue')) {
            insert('mail_queue', ['to_email' => $buyerEmail, 'to_name' => $buyerName, 'subject' => $subject, 'body' => $html]);
        }
    }
}

// Заказ наград тоже открывает личный кабинет (идемпотентно, дублей нет).
if (function_exists('auth_ensure_account') && $buyerEmail !== '') {
    try { auth_ensure_account($buyerEmail, (string) $buyerName); } catch (\Throwable $e) {}
}

json_out([
    'ok'       => true,
    'order_id' => $orderId,
    'amount'   => $amount,
    // Бонус подписчика — чтобы страница могла сказать, за что сумма меньше.
    'vk_bonus_pct' => $vkBonusPct,
    'vk_bonus_rub' => $vkBonusRub,
    'confirmation_url' => $payment['confirmation_url'] ?? null,
    'payment'  => $payment ? [
        'id'               => $payment['id'],
        'status'           => $payment['status'] ?? 'pending',
        'confirmation_url' => $payment['confirmation_url'] ?? null,
    ] : null,
]);

/** Проверка принадлежности Origin/Referer своему домену (строгая). */
function request_same_origin(): bool {
    static $fn;
    // Собираем список разрешённых хостов из конфигурации.
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) {
        if ($d = cfgv($k)) $hosts[] = strtolower((string) $d);
    }
    $hosts = array_values(array_unique(array_filter($hosts)));
    // Если домены не сконфигурированы — не блокируем (не ломаем локальную разработку).
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false; // POST от браузера всегда несёт Origin или Referer
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
