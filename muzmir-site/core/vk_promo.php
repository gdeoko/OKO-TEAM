<?php
/**
 * АНОНСЫ КОНКУРСОВ В СООБЩЕСТВАХ УЧРЕЖДЕНИЙ.
 *
 * У нас 16 463 учреждения с сообществом ВКонтакте. Почтой мы до них уже идём,
 * но письмо читает делопроизводитель, а сообщество читают родители и педагоги —
 * то есть те, кто реально подаёт работы. Это второй, независимый от почты вход
 * к той же аудитории.
 *
 * ТРИ ДВЕРИ. Разведка (scripts/vk_probe_suggest.php) на живой выборке показала:
 *   открытая стена   ~5%   — запись публикуется сразу, без модерации;
 *   предложка        ~33%  — запись падает администратору в «предложенные
 *                            новости», он решает, публиковать или нет;
 *   закрыто          ~60%  — остаётся только личное сообщение.
 * В пересчёте на базу это ~850 открытых стен и ~5 400 предложек. Предложка и
 * есть главный бесплатный канал: администратор ДК или школы почти всегда рад
 * готовому анонсу бесплатного конкурса для своих же детей.
 *
 * ПОЧЕМУ ТЕКСТ РАЗНЫЙ. Одинаковая запись, разосланная в сотни сообществ, —
 * это то, что антиспам ВКонтакте ищет в первую очередь; аккаунт получает
 * ограничение на публикации, и канал умирает за день. Поэтому текст собирается
 * из вариантов начала, тела и призыва, выбор жёстко привязан к id сообщества
 * (значит, повторный запуск даст ту же запись, а не новую), и в него
 * подставляется тип учреждения и его город.
 *
 * ТЕМП. Суточный предел записей у страницы ВКонтакте — около пятидесяти;
 * рабочий темп 40 в сутки взят с запасом и разложен по часам. Ошибки
 * «слишком часто» и «лимит» останавливают выпуск до следующего часа, а не
 * съедают очередь.
 *
 * ЧЕСТНЫЙ СЧЁТ. Публикация в предложке — это ещё не публикация: решает
 * администратор. Поэтому таблица vk_promo_log хранит и отправку, и итог
 * проверки (опубликовали / отклонили / висит), и по ней считается реальная
 * доля одобрения, а не выдуманная.
 */
declare(strict_types=1);

require_once __DIR__ . '/vk.php';

/** Хранилище площадок и журнал выпуска. Создаются лениво. */
function vkp_ensure(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS vk_targets (
        group_id       INTEGER PRIMARY KEY,
        institution_id INTEGER DEFAULT 0,
        name           TEXT    DEFAULT '',
        screen_name    TEXT    DEFAULT '',
        kind           TEXT    DEFAULT '',
        region         TEXT    DEFAULT '',
        city           TEXT    DEFAULT '',
        members        INTEGER DEFAULT 0,
        can_post       INTEGER DEFAULT 0,
        can_suggest    INTEGER DEFAULT 0,
        wall           INTEGER DEFAULT 0,
        status         TEXT    DEFAULT 'new',
        posts_count    INTEGER DEFAULT 0,
        last_post_at   TEXT    DEFAULT '',
        note           TEXT    DEFAULT '',
        checked_at     TEXT    DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkt_ready ON vk_targets(status, members)");
    db()->exec("CREATE TABLE IF NOT EXISTS vk_promo_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id   INTEGER NOT NULL,
        mode       TEXT    DEFAULT '',
        post_id    INTEGER DEFAULT 0,
        campaign   TEXT    DEFAULT '',
        outcome    TEXT    DEFAULT 'sent',
        error      TEXT    DEFAULT '',
        checked_at TEXT    DEFAULT '',
        created_at TEXT    DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkpl_group ON vk_promo_log(group_id)");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkpl_created ON vk_promo_log(created_at)");
}

/* ═════════════════════════ Разведка площадок ═════════════════════════ */

/**
 * Обойти сообщества учреждений и записать, какая у каждого дверь.
 * Возвращает [проверено, открытых, предложек, закрытых].
 * Повторный запуск обновляет старые записи (сообщества открывают и закрывают стены).
 */
function vkp_scan(int $limit = 3000, int $staleDays = 30): array {
    vkp_ensure();
    $rows = all("SELECT i.id, i.vk_id, i.kind, i.region, i.city
                   FROM institutions i
                   LEFT JOIN vk_targets t ON t.group_id = i.vk_id
                  WHERE i.vk_id <> 0
                    AND (t.group_id IS NULL OR t.checked_at < datetime('now','localtime','-' || :d || ' days'))
                  LIMIT :l", ['d' => $staleDays, 'l' => $limit]);
    if (!$rows) return [0, 0, 0, 0];

    $meta = [];
    foreach ($rows as $r) $meta[(int) $r['vk_id']] = $r;

    $done = $open = $sugg = $shut = 0;
    $up = db()->prepare("INSERT INTO vk_targets
        (group_id,institution_id,name,screen_name,kind,region,city,members,can_post,can_suggest,wall,status,checked_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))
        ON CONFLICT(group_id) DO UPDATE SET
          name=excluded.name, screen_name=excluded.screen_name, members=excluded.members,
          can_post=excluded.can_post, can_suggest=excluded.can_suggest, wall=excluded.wall,
          status=CASE WHEN vk_targets.status IN ('done','banned') THEN vk_targets.status ELSE excluded.status END,
          checked_at=excluded.checked_at");

    foreach (array_chunk(array_keys($meta), 300) as $chunk) {
        $r = vk_api('groups.getById', [
            'group_ids' => implode(',', $chunk),
            'fields'    => 'members_count,wall,can_post,can_suggest,is_closed',
        ]);
        if (isset($r['error'])) { usleep(600000); continue; }
        foreach (($r['response']['groups'] ?? $r['response'] ?? []) as $g) {
            $gid = (int) ($g['id'] ?? 0);
            if ($gid <= 0) continue;
            $m       = $meta[$gid] ?? [];
            $canPost = (int) ($g['can_post'] ?? 0) === 1 ? 1 : 0;
            $canSugg = (int) ($g['can_suggest'] ?? 0) === 1 ? 1 : 0;
            $status  = $canPost ? 'ready' : ($canSugg ? 'ready' : 'closed');
            if ($canPost) $open++; elseif ($canSugg) $sugg++; else $shut++;
            $up->execute([
                $gid, (int) ($m['id'] ?? 0),
                mb_substr((string) ($g['name'] ?? ''), 0, 200),
                (string) ($g['screen_name'] ?? ''),
                (string) ($m['kind'] ?? ''), (string) ($m['region'] ?? ''), (string) ($m['city'] ?? ''),
                (int) ($g['members_count'] ?? 0), $canPost, $canSugg, (int) ($g['wall'] ?? 0), $status,
            ]);
            $done++;
        }
        usleep(400000);
    }
    return [$done, $open, $sugg, $shut];
}

/* ═════════════════════════ Пригодность площадки ═════════════════════════ */

/**
 * Насколько сообществу подходит анонс детского конкурса.
 *
 * В базе учреждений живут не только школы и дома культуры: при сборе туда попали
 * автошколы, тату-студии, школы шитья и курсы нутрициологии — формально это тоже
 * «школы» и «студии». Отправить им анонс конкурса для детей значит написать не по
 * адресу: администратор отклонит запись и, скорее всего, пожалуется. Отбор нужен
 * не ради вежливости, а чтобы канал не закрыли на второй день.
 *
 * Считается по названию сообщества и типу учреждения из базы. Плюсы — за то, что
 * говорит о нашей аудитории, минусы — за явно чужое. Порог 6 отсекает мусор,
 * сохраняя профильные площадки.
 */
function vkp_score(string $name, string $kind): int {
    $h = ' ' . mb_strtolower($name . ' ' . $kind) . ' ';
    $score = 0;

    $plus = [
        'школа искусств' => 12, 'дши' => 12, 'дмш' => 12, 'дхш' => 12,
        'музыкальн' => 9, 'художествен' => 7, 'хореограф' => 9, 'вокал' => 8,
        'дом культуры' => 11, 'дворец культуры' => 11, 'сдк' => 9, 'скц' => 9, 'кдц' => 9,
        'дк ' => 6, 'клубн' => 5, 'культуры' => 6, 'библиотек' => 5,
        'творчеств' => 9, 'детск' => 7, 'юнош' => 6, 'детский сад' => 8, 'доу' => 6,
        'дополнительного образования' => 10, 'цдт' => 9, 'ддт' => 9, 'цвр' => 8,
        'школа' => 4, 'гимназ' => 5, 'лице' => 5, 'училищ' => 6, 'колледж' => 5,
        'ансамбл' => 7, 'оркестр' => 7, 'хор ' => 6, 'студи' => 3, 'театр' => 6,
        'мбоу' => 6, 'мбудо' => 8, 'мбудк' => 8, 'мкук' => 8, 'мбук' => 8, 'гбоу' => 6,
    ];
    $minus = [
        'автошкол' => 30, 'тату' => 30, 'шить' => 25, 'шитья' => 25, 'кройк' => 25,
        'нутрициолог' => 30, 'маникюр' => 30, 'барбер' => 30, 'фитнес' => 25, 'похуд' => 30,
        'магазин' => 25, 'салон' => 20, 'кофе' => 20, 'ресторан' => 25, 'бар ' => 20,
        'недвижим' => 30, 'кредит' => 30, 'займ' => 30, 'юридическ' => 20, 'бухгалтер' => 20,
        'трикотаж' => 25, 'платьев' => 25, 'ремонт' => 25, 'стройк' => 25, 'клининг' => 25,
        'массаж' => 25, 'косметолог' => 30, 'вейп' => 30, 'кальян' => 30, 'ставки' => 30,
        'английск' => 12, 'программирован' => 12, 'маркетинг' => 20, 'блогер' => 20,
        // спорт и телесные практики: формально «школы» и «студии», по сути не наши
        'плаван' => 30, 'бассейн' => 30, 'единоборств' => 30, 'карате' => 30, 'самбо' => 30,
        'дзюдо' => 30, 'бокс' => 30, 'футбол' => 30, 'хоккей' => 30, 'волейбол' => 30,
        'баскетбол' => 30, 'скалолаз' => 30, 'йог' => 25, 'пилат' => 30, 'сноуборд' => 30,
        'вожден' => 30, 'парикмахер' => 30, 'ноготк' => 30, 'брови' => 30, 'депиляц' => 30,
    ];
    foreach ($plus as $w => $v)  if (mb_strpos($h, $w) !== false) $score += $v;
    foreach ($minus as $w => $v) if (mb_strpos($h, $w) !== false) $score -= $v;

    // Тип из базы учреждений — самый надёжный признак, он проставлен при сборе.
    $score += match ($kind) {
        'dshi' => 10, 'dk' => 8, 'center' => 7, 'school' => 5, 'kindergarten' => 5, 'college' => 4,
        default => 0,
    };
    return $score;
}

/** Пересчитать пригодность всех площадок. Возвращает [годных, отсеянных]. */
function vkp_rank(): array {
    vkp_ensure();
    try { db()->exec("ALTER TABLE vk_targets ADD COLUMN score INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
    $upd = db()->prepare("UPDATE vk_targets SET score=?, status=? WHERE group_id=?");
    $fit = $out = 0;
    foreach (all("SELECT group_id, name, kind, status FROM vk_targets") as $r) {
        $s  = vkp_score((string) $r['name'], (string) $r['kind']);
        $st = (string) $r['status'];
        // Уже отправленные и закрытые не трогаем: их судьба решена.
        if (!in_array($st, ['ready', 'unfit'], true)) { $upd->execute([$s, $st, (int) $r['group_id']]); continue; }
        $new = $s >= 6 ? 'ready' : 'unfit';
        if ($new === 'ready') $fit++; else $out++;
        $upd->execute([$s, $new, (int) $r['group_id']]);
    }
    return [$fit, $out];
}

/* ═════════════════════════ Текст анонса ═════════════════════════ */

/**
 * Как назвать учреждение в двух падежах: «вашей школы искусств» и «в школе искусств».
 *
 * Падежи здесь не украшение. Фраза «для воспитанников вашего художественной школы»
 * читается как машинная рассылка, и администратор отклоняет запись, даже не дочитав.
 * Поэтому для каждого типа заранее заданы обе формы, а не склеены на ходу.
 *
 * @return array{gen:string, prep:string}
 */
function vkp_kind_forms(string $kind, string $name): array {
    $h = mb_strtolower($kind . ' ' . $name);
    $map = [
        'школ.{0,4}искусств|дши'      => ['вашей школы искусств',      'в школе искусств'],
        'музыкальн.{0,4}школ|дмш'     => ['вашей музыкальной школы',   'в музыкальной школе'],
        'художествен.{0,4}школ|дхш'   => ['вашей художественной школы','в художественной школе'],
        'дом.{0,4}культур|дк|скц|кдц' => ['вашего дома культуры',      'в доме культуры'],
        'детск.{0,4}сад|доу'          => ['вашего детского сада',      'в детском саду'],
        'дополнительн|цдт|ддт|двор'   => ['вашего центра творчества',  'в центре творчества'],
        'библиотек'                   => ['вашей библиотеки',          'в библиотеке'],
        'колледж|училищ|техникум'     => ['вашего колледжа',           'в колледже'],
        'школ|мбоу|моу|гбоу|гимназ|лице' => ['вашей школы',            'в школе'],
    ];
    foreach ($map as $re => [$gen, $prep]) {
        if (preg_match('~' . $re . '~u', $h)) return ['gen' => $gen, 'prep' => $prep];
    }
    return ['gen' => 'вашего учреждения', 'prep' => 'в учреждении'];
}

/**
 * Собрать запись для конкретного сообщества.
 *
 * Смысл текста один и тот же, форма — разная: выбор варианта определяется
 * остатком от деления id сообщества, поэтому один и тот же адресат никогда не
 * получит два разных анонса, а соседние сообщества получат непохожие.
 */
function vkp_message(array $t, string $link, string $deadline = ''): string {
    $link = link_human($link);
    $forms    = vkp_kind_forms((string) ($t['kind'] ?? ''), (string) ($t['name'] ?? ''));
    $kindWord = $forms['prep'];
    $gid      = (int) ($t['group_id'] ?? 0);
    $dl       = $deadline !== '' ? $deadline : '25 августа';

    $open = [
        "Педагогам и родителям: до {$dl} открыт приём работ на бесплатный всероссийский конкурс.",
        "Коллеги, для воспитанников {$forms['gen']} — бесплатное участие во всероссийском конкурсе, приём работ до {$dl}.",
        "Хорошая новость для юных талантов: стартовал приём заявок на бесплатный всероссийский конкурс.",
        "Открыт приём работ на всероссийский конкурс детского творчества. Участие бесплатное, дистанционно, до {$dl}.",
        "Дистанционный конкурс для учеников и педагогов: заявку можно подать до {$dl}, участие в номинации «Величие России» бесплатное.",
    ];
    $body = [
        "Культурный центр «Музыкальный Мир» проводит конкурсы для детей и взрослых: вокал, хореография, инструментальное исполнительство, изобразительное и декоративно-прикладное творчество, театр, художественное слово.\n\nВсё дистанционно: работа отправляется ссылкой на видео или файлом, приезжать никуда не нужно.",
        "Принимаются работы по вокалу, хореографии, инструментальному исполнительству, рисунку, декоративно-прикладному творчеству, театру и художественному слову. Возраст — от дошкольников до взрослых, есть и педагогические номинации.\n\nФормат дистанционный: достаточно ссылки на видео или фотографии работы.",
        "Номинации охватывают почти всё, чем занимаются " . $kindWord . ": вокал и хор, хореография, инструменты, живопись и рисунок, декоративно-прикладное творчество, театр, чтецы. Возрастных ограничений нет, коллективы участвуют наравне с солистами.\n\nУчастие дистанционное, работа принимается ссылкой на видео или файлом.",
    ];
    $why = [
        "Дипломы именные, с указанием педагога — их принимают в портфолио ученика и в документы к аттестации преподавателя.",
        "Каждый участник получает именной диплом, преподаватель — благодарность. Документы подходят для портфолио и аттестации.",
        "По итогам — именной диплом участнику и благодарственное письмо педагогу; электронный документ приходит на почту.",
    ];
    $cta = [
        "Положение и форма заявки: {$link}",
        "Подробности и подача работы: {$link}",
        "Условия, номинации и заявка: {$link}",
    ];

    $pick = static fn(array $a, int $salt): string => $a[($salt) % count($a)];

    return $pick($open, $gid)
        . "\n\n" . $pick($body, intdiv($gid, 7))
        . "\n\n" . $pick($why, intdiv($gid, 13))
        . "\n\n" . $pick($cta, intdiv($gid, 3));
}

/* ═════════════════════════ Афиша ═════════════════════════ */

/**
 * Афиша для анонса, готовая к прикреплению.
 *
 * Записи в чужие сообщества уходят от лица страницы, а не сообщества, поэтому и
 * картинка должна принадлежать странице: чужое фото ВКонтакте прикрепить не даст.
 * Загружаем один раз, строку вида photo123_456 держим в настройках и переиспользуем —
 * иначе на каждую запись приходится три лишних обращения к API.
 *
 * @return string 'photo<owner>_<id>' или '' если загрузить не удалось.
 */
function vkp_attachment(string $absPath): string {
    if ($absPath === '' || !is_file($absPath)) return '';
    $key = 'vk_promo_photo_' . substr(md5($absPath . filemtime($absPath)), 0, 12);
    $has = (string) (scalar("SELECT value FROM settings WHERE key=:k", ['k' => $key]) ?? '');
    if ($has !== '') return $has;

    $s   = vk_api('photos.getWallUploadServer');          // без group_id — на стену страницы
    $url = (string) ($s['response']['upload_url'] ?? '');
    if ($url === '') return '';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['photo' => new CURLFile($absPath)],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $raw = (string) curl_exec($ch);
    curl_close($ch);
    $up = json_decode($raw, true);
    if (!is_array($up) || empty($up['photo'])) return '';

    $save = vk_api('photos.saveWallPhoto', [
        'photo'  => (string) $up['photo'],
        'server' => (string) ($up['server'] ?? ''),
        'hash'   => (string) ($up['hash'] ?? ''),
    ]);
    $ph = $save['response'][0] ?? [];
    if (!$ph) return '';
    $att = 'photo' . (int) $ph['owner_id'] . '_' . (int) $ph['id'];
    q("INSERT INTO settings (key,value) VALUES (:k,:v)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value", ['k' => $key, 'v' => $att]);
    return $att;
}

/* ═════════════════════════ Выпуск ═════════════════════════ */

/** Сколько записей уже выпущено сегодня (по журналу, а не по счётчику в настройках). */
function vkp_sent_today(): int {
    vkp_ensure();
    return (int) (scalar("SELECT COUNT(*) FROM vk_promo_log
                           WHERE date(created_at) = date('now','localtime') AND outcome <> 'error'") ?? 0);
}

/** Суточный предел записей. Меняется настройкой vk_promo_daily. */
function vkp_daily_cap(): int {
    return max(0, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_daily'") ?: 40));
}

/**
 * Опубликовать анонс в одно сообщество.
 *
 * Открытая стена — запись появляется сразу. Иначе ВКонтакте кладёт её в
 * предложенные новости к администратору; для нас вызов одинаковый, разной будет
 * только судьба записи, и она отмечается в журнале.
 *
 * @return array ['ok'=>bool,'post_id'=>int,'mode'=>string,'error'=>string,'fatal'=>bool]
 */
function vkp_publish(array $t, string $message, string $attachment = '', string $campaign = ''): array {
    vkp_ensure();
    $gid  = (int) $t['group_id'];
    $mode = (int) ($t['can_post'] ?? 0) === 1 ? 'post' : 'suggest';

    $params = ['owner_id' => -$gid, 'from_group' => 0, 'message' => $message];
    if ($attachment !== '') $params['attachments'] = $attachment;
    $r = vk_api('wall.post', $params);

    if (isset($r['error'])) {
        $code = (int) ($r['error']['error_code'] ?? 0);
        $msg  = (string) ($r['error']['error_msg'] ?? '?');
        // 6 «слишком часто», 9 «флуд», 29 «лимит» — не вина адресата, выходим до
        // следующего часа. Остальное — свойство площадки, помечаем её и идём дальше.
        $fatal = in_array($code, [6, 9, 29], true);
        if (!$fatal) {
            q("UPDATE vk_targets SET status='closed', note=:n WHERE group_id=:g",
              ['n' => mb_substr($msg, 0, 160), 'g' => $gid]);
        }
        q("INSERT INTO vk_promo_log (group_id,mode,campaign,outcome,error) VALUES (:g,:m,:c,'error',:e)",
          ['g' => $gid, 'm' => $mode, 'c' => $campaign, 'e' => mb_substr($msg, 0, 200)]);
        return ['ok' => false, 'post_id' => 0, 'mode' => $mode, 'error' => $msg, 'fatal' => $fatal];
    }

    $pid = (int) ($r['response']['post_id'] ?? 0);
    q("INSERT INTO vk_promo_log (group_id,mode,post_id,campaign,outcome) VALUES (:g,:m,:p,:c,'sent')",
      ['g' => $gid, 'm' => $mode, 'p' => $pid, 'c' => $campaign]);
    q("UPDATE vk_targets SET status='done', posts_count=posts_count+1,
              last_post_at=datetime('now','localtime') WHERE group_id=:g", ['g' => $gid]);
    return ['ok' => true, 'post_id' => $pid, 'mode' => $mode, 'error' => '', 'fatal' => false];
}

/**
 * Проверить судьбу предложенных записей: опубликовали, отклонили или ещё висит.
 * Без этого доля одобрения — гадание, а канал оценивается по гаданию.
 */
function vkp_check_outcomes(int $limit = 100): array {
    vkp_ensure();
    $rows = all("SELECT id, group_id, post_id FROM vk_promo_log
                  WHERE outcome='sent' AND post_id<>0
                    AND created_at < datetime('now','localtime','-1 day')
                  ORDER BY id LIMIT :l", ['l' => $limit]);
    $stat = ['опубликовано' => 0, 'висит' => 0, 'снято' => 0];
    foreach ($rows as $r) {
        $r2 = vk_api('wall.getById', ['posts' => (-(int) $r['group_id']) . '_' . (int) $r['post_id']]);
        $items = $r2['response']['items'] ?? $r2['response'] ?? [];
        $item  = $items[0] ?? null;
        if (!$item) {
            $out = 'rejected'; $stat['снято']++;
        } elseif ((string) ($item['post_type'] ?? '') === 'suggest') {
            $out = 'pending';  $stat['висит']++;
        } else {
            $out = 'published'; $stat['опубликовано']++;
        }
        q("UPDATE vk_promo_log SET outcome=:o, checked_at=datetime('now','localtime') WHERE id=:i",
          ['o' => $out, 'i' => (int) $r['id']]);
        usleep(350000);
    }
    return $stat;
}
