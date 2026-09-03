<?php
/**
 * vk_style_learn.php — учим ассистента говорить голосом центра.
 *
 * ЗАЧЕМ. Владелец правит бота почти каждый ответ: тот пишет складно, но не так,
 * как отвечают в этом центре. Материал для обучения лежал только в chat_messages
 * (диалоги, которые вёл сам бот, — десяток), а настоящая переписка центра живёт
 * в сообществе ВКонтакте: тысячи диалогов, и отвечает в них человек.
 *
 * ЧТО ДЕЛАЕТ. Разбирает выгрузку vk_dialogs_export.php и достаёт пары
 * «вопрос участника → ответ, написанный человеком». Раскладывает их по темам,
 * отбирает лучшие и кладёт в chat_style_samples — именно оттуда chat_learn.php
 * подсовывает модели живые примеры перед каждым ответом.
 *
 * ЧТО НЕ БЕРЁМ В ЭТАЛОНЫ:
 *   - реплики короче двух десятков символов («да», «хорошо», «спасибо»);
 *   - чистые приветствия и прощания без сути — на них модель училась отвечать
 *     «рады были помочь», ничего не сказав по делу (та же беда описана в
 *     chat_learn_strip_boiler());
 *   - ответы с личными данными участника (телефон, почта, номер заявки) — эталон
 *     видит модель при каждом ответе, чужим данным там не место;
 *   - ответы бота (в выгрузке помечены who=bot): учиться на себе бессмысленно.
 *
 * Запуск: php scripts/vk_style_learn.php --dry
 *         php scripts/vk_style_learn.php --apply [--per-topic=8]
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_learn.php';

$apply    = in_array('--apply', $argv, true);
$perTopic = 8;
$days     = 40;
$file     = BASE_PATH . '/data/vk_dialogs.jsonl';
foreach ($argv as $a) {
    if (preg_match('~^--per-topic=(\d+)$~', $a, $m)) $perTopic = max(2, (int) $m[1]);
    if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = max(1, (int) $m[1]);
    if (preg_match('~^--file=(.+)$~', $a, $m)) $file = $m[1][0] === '/' ? $m[1] : BASE_PATH . '/' . $m[1];
}
if (!$apply && !in_array('--dry', $argv, true)) { fwrite(STDERR, "укажи --dry или --apply\n"); exit(2); }
if (!is_file($file)) { fwrite(STDERR, "нет файла $file — сначала vk_dialogs_export.php\n"); exit(1); }

/**
 * Личные данные в эталоне не нужны.
 *
 * ОТДЕЛЬНО — ПЛАТЁЖНЫЕ РЕКВИЗИТЫ. В переписке лежит ответ про оплату из ближнего
 * зарубежья с номером личной карты владельца и сроком действия. Повторён семь
 * раз, то есть по частоте это «канон» — и он бы уехал в подсказку модели,
 * которая начала бы диктовать номер карты всем, кто спросит про оплату. Карту,
 * счёт и срок действия отбраковываем жёстко, до всякой другой проверки.
 */
function vsl_has_personal(string $t): bool {
    return (bool) preg_match('~[\w.+-]+@[\w-]+\.[a-z]{2,}~ui', $t)
        || (bool) preg_match('~(\+7|\b8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}~u', $t)
        || (bool) preg_match('~\b[A-Z]{2,4}-\d{4}-\d{4,6}\b~u', $t)
        // Номер карты: 16 цифр группами или подряд; счёт: 20 цифр.
        || (bool) preg_match('~\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b~u', $t)
        || (bool) preg_match('~\b\d{20}\b~u', $t)
        || (bool) preg_match('~\b\d{2}/\d{2}\b~u', $t)                 // срок действия карты
        || (bool) preg_match('~карт[аеуы]?\s*(мир|сбер|виза|visa)?\s*:?\s*\d~ui', $t)
        || (bool) preg_match('~реквизит|расчётный счёт|расчетный счет|инн\s*\d|бик\s*\d~ui', $t);
}

/** Ссылки и номера обезличиваем, чтобы эталон учил форме, а не данным. */
function vsl_clean(string $t): string {
    $t = preg_replace('~\s+~u', ' ', trim($t)) ?? '';
    $t = preg_replace('~\[(?:id|club)\d+\|([^\]]+)\]~u', '$1', $t) ?? $t;   // вк-упоминания
    return trim($t);
}

/**
 * ПРИВЕТСТВИЕ ИЗ НАЧАЛА ЭТАЛОНА УБИРАЕМ.
 *
 * Приветствие боту добавляет система, один раз за диалог (правило в
 * chat_system_prompt). Если оставить его в эталонах, модель начнёт здороваться
 * ещё и сама — и человек получит «Здравствуйте, Мария. Здравствуйте, Мария.»
 */
function vsl_strip_greeting(string $t): string {
    // «Доброго времени суток» режем целиком: иначе от него остаётся хвост
    // «суток.», и он уезжает в эталон началом ответа.
    $t = preg_replace('~^\s*доброго\s+времени\s+суток\b[,!.\s]*~ui', '', $t) ?? $t;
    $t = preg_replace('~^\s*(здравствуйте|добрый день|доброе утро|добрый вечер|приветствую)\b[,!\s]*'
                    . '([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)?[.,!\s]*~ui', '', $t) ?? $t;
    return trim($t);
}

/**
 * ЭТО НЕ ГОЛОС ЦЕНТРА, А ЕГО АВТОМАТИКА.
 *
 * В переписке вперемешку с живыми ответами лежат сообщения, которые пишет сама
 * система: уведомление о нерабочем времени и дежурное прощание. Они повторяются
 * сотнями и в эталонах перевешивают всё остальное — модель на них и училась
 * отвечать «рады были помочь», ничего не сказав по делу. В обучающий материал
 * они не идут никогда.
 */
function vsl_is_machine(string $t): bool {
    $l = mb_strtolower($t);
    return (bool) preg_match('~нерабочее время|мы отвечаем пн|ваше сообщение получено и не потеряется~u', $l)
        || (bool) preg_match('~^\W*благодарим вас за участие~u', $l)
        || (bool) preg_match('~желаем вам (творческих )?успехов, процветания~u', $l)
        || (bool) preg_match('~рады были вам помочь~u', $l)
        || (bool) preg_match('~будем вам признательны за отзыв~u', $l);
}

/**
 * Тема ответа. Берём тот же словарь, что и chat_topic_of(), но по паре
 * «вопрос + ответ»: в вопросе человек часто пишет одно слово, а тема видна из
 * ответа оператора.
 */
function vsl_topic(string $q, string $a): string {
    $t = mb_strtolower($q . ' ' . $a);
    // ПОРЯДОК ВАЖЕН: правила проверяются сверху вниз, первое совпавшее и решает.
    // Узкие темы стоят раньше широких, иначе вопрос «как получить диплом» ловится
    // словом «оплат» из ответа и уезжает в тему оплаты, где ему не место.
    $map = [
        'возврат'     => 'возврат|вернуть деньг|верните деньги',
        'доставка'    => 'доставк|почт[аойу] росси|трек-?номер|посылк|наложенн[ыо]|отслежив',
        'заказ наград'=> 'кубок|медал|статуэтк|изготовлен|оригинал диплом|заказ[аья]? наград'
                       . '|заявк[уа] на изготовление|наградн\w+ материал',
        'ссылка на видео' => 'ссылк[аиу].{0,30}(видео|диск|рутуб|rutube|вк видео)|яндекс.?диск|google.?drive'
                       . '|не подходит для введения|приват',
        'оплата'      => 'оргвзнос|оплат|стоимост|сколько стоит|цена|реквизит|квитанц|счёт|счет|не могу проплатить',
        'заявка'      => 'заявк|подать|подача|как участв|форм[уы] заявк',
        'результаты'  => 'результат|итог|звание|лауреат|гран-?при|оглашен',
        'педагогу'    => 'педагог|преподавател|руководител\w*\s+коллектив|благодарственн',
        'кабинет'     => 'личн\w+ кабинет|пароль|логин|войти в кабинет',
        'партнёрство' => 'партнёр|партнер|сотрудничеств',
        'клуб'        => 'вип-?клуб|\bклуб\b|подписк',
        'сроки'       => 'срок|когда будет|как долго|через сколько',
    ];
    foreach ($map as $topic => $re) if (preg_match('~' . $re . '~u', $t)) return $topic;
    return 'прочее';
}

/** Сколько в ответе «мяса»: длина после снятия дежурных оборотов. */
function vsl_weight(string $a): int {
    $core = chat_learn_strip_boiler($a);
    return mb_strlen(trim($core));
}

$since = date('Y-m-d H:i:s', time() - $days * 86400);

/* КТО ПИСАЛ ЗА СООБЩЕСТВО — ЧЕЛОВЕК ИЛИ БОТ.
 *
 * Выгрузка отмечает ответ человеческим по полю admin_author_id, но ВКонтакте
 * ставит его не всегда: из мобильного приложения сообщества оно не приходит.
 * По этому признаку человеческими вышли 9 тысяч реплик из 377, а остальные 368
 * тысяч — «ботом», хотя бот запущен неделю назад и столько написать не мог.
 * Так обучение осталось бы почти без материала.
 *
 * Считаем ответом центра ЛЮБОЕ исходящее сообщение, а ответы бота вычитаем по
 * списку: они все лежат в chat_messages. Их сотни, сверить по тексту дёшево. */
$botTexts = [];
try {
    foreach (all("SELECT text FROM chat_messages
                   WHERE role IN ('assistant','bot_cancelled') AND COALESCE(by_operator,0)=0") as $b) {
        $k = mb_substr(preg_replace('~\s+~u', ' ', mb_strtolower(trim((string) $b['text']))) ?? '', 0, 80);
        if ($k !== '') $botTexts[$k] = 1;
    }
} catch (\Throwable $e) {}

$pairs = 0; $dialogs = 0; $byTopic = []; $canon = []; $drop = [];
$fh = fopen($file, 'r');
while (($line = fgets($fh)) !== false) {
    $d = json_decode(trim($line), true);
    if (!is_array($d) || empty($d['turns'])) continue;
    $dialogs++;
    $turns = $d['turns'];

    for ($i = 1; $i < count($turns); $i++) {
        if (($turns[$i]['who'] ?? '') === 'user') continue;       // это вопрос, а не ответ
        /* СВЕЖИМ СЧИТАЕТСЯ ОТВЕТ, А НЕ ДИАЛОГ.
         * Выгрузка отбирала диалоги по дате последнего сообщения, но историю
         * тянула целиком — до двухсот реплик. Переписка с постоянным участником
         * идёт годами, и в обучение попадали ответы 2024 года про конкурсы,
         * которых давно нет. Считаем только реплики за тот же срок. */
        if (strcmp((string) ($turns[$i]['date'] ?? ''), $since) < 0) continue;
        // Вопрос — последняя подряд идущая реплика участника перед ответом.
        $q = '';
        for ($j = $i - 1; $j >= 0 && ($turns[$j]['who'] ?? '') === 'user'; $j--) {
            $q = trim($turns[$j]['text'] . "\n" . $q);
        }
        if ($q === '') continue;

        $qc = vsl_clean($q);
        $ac = vsl_strip_greeting(vsl_clean((string) $turns[$i]['text']));
        $drop['всего исходящих'] = ($drop['всего исходящих'] ?? 0) + 1;
        if (mb_strlen($qc) < 8 || mb_strlen($ac) < 20) { $drop['короткие'] = ($drop['короткие'] ?? 0) + 1; continue; }
        if (vsl_is_machine($ac)) { $drop['автоответ'] = ($drop['автоответ'] ?? 0) + 1; continue; }
        $bk = mb_substr(mb_strtolower($ac), 0, 80);
        if (isset($botTexts[$bk])) { $drop['ответ бота'] = ($drop['ответ бота'] ?? 0) + 1; continue; }
        if (vsl_is_brushoff($ac)) { $drop['отписка'] = ($drop['отписка'] ?? 0) + 1; continue; }
        if (vsl_dead_competition($ac)) { $drop['закрытый конкурс'] = ($drop['закрытый конкурс'] ?? 0) + 1; continue; }
        if (vsl_has_personal($ac)) { $drop['личные данные в ответе'] = ($drop['личные данные в ответе'] ?? 0) + 1; continue; }
        if (vsl_has_personal($qc)) { $drop['личные данные в вопросе'] = ($drop['личные данные в вопросе'] ?? 0) + 1; continue; }
        if (vsl_weight($ac) < 40) { $drop['мало сути'] = ($drop['мало сути'] ?? 0) + 1; continue; }

        $topic = vsl_topic($qc, $ac);
        $byTopic[$topic][] = ['q' => mb_substr($qc, 0, 400), 'a' => mb_substr($ac, 0, 900),
                              'w' => vsl_weight($ac), 'date' => (string) ($turns[$i]['date'] ?? '')];

        /* ПОВТОРЯЮЩИЙСЯ ОТВЕТ — ЭТО И ЕСТЬ ШАБЛОН ЦЕНТРА.
         *
         * Владелец просил «чёткие шаблоны 1:1 на частые вопросы». Их не надо
         * выдумывать: если на десяток разных вопросов человек отвечает почти
         * одним и тем же текстом, этот текст и есть канон. Ключом берём первые
         * значимые слова ответа без имени и знаков — так «В случае принятия
         * Вами решения…» из шести диалогов схлопывается в одну запись. */
        $key = mb_substr(preg_replace('~[^\p{L}\p{N} ]+~u', '', mb_strtolower($ac)) ?? '', 0, 90);
        if ($key !== '') {
            if (!isset($canon[$key])) $canon[$key] = ['n' => 0, 'a' => $ac, 'topic' => $topic, 'qs' => []];
            $canon[$key]['n']++;
            if (mb_strlen($ac) > mb_strlen($canon[$key]['a'])) $canon[$key]['a'] = $ac;  // полнее — лучше
            if (count($canon[$key]['qs']) < 6) $canon[$key]['qs'][] = mb_substr($qc, 0, 120);
        }
        $pairs++;
    }
}
fclose($fh);

echo "диалогов разобрано: $dialogs, пар «вопрос → ответ человека»: $pairs\n";
echo "отсев: "; foreach ($drop as $k => $v) echo "$k=$v; "; echo "\n\n";
krsort($byTopic);
uasort($byTopic, static fn(array $a, array $b): int => count($b) <=> count($a));

$picked = [];
foreach ($byTopic as $topic => $list) {
    // Лучшие — самые содержательные, но не самые длинные полотна: берём середину.
    usort($list, static fn(array $a, array $b): int => $b['w'] <=> $a['w']);
    $take = array_slice($list, 0, $perTopic * 3);
    usort($take, static fn(array $a, array $b): int => strcmp($b['date'], $a['date']));  // свежие вперёд
    $take = array_slice($take, 0, $perTopic);
    printf("%-14s всего %3d, берём %d\n", $topic, count($list), count($take));
    foreach ($take as $p) {
        printf("   В: %s\n   О: %s\n", mb_substr($p['q'], 0, 110), mb_substr($p['a'], 0, 190));
        $picked[] = ['topic' => $topic, 'q' => $p['q'], 'a' => $p['a']];
    }
    echo "\n";
}

/**
 * ЧАСТО ПОВТОРЯЕМОЕ — НЕ ЗНАЧИТ ХОРОШЕЕ.
 *
 * Самые частые ответы в переписке — это отписки: «обращение зарегистрировано,
 * ожидайте» и «подробнее в разделе частых вопросов». Их писали, когда некогда
 * было разбираться, и именно от них владелец просил бота отучить: он и так
 * запрещён промптом отвечать «ожидайте», а мы бы своей же выгрузкой научили его
 * этому обратно. Сюда же — ответы со старыми адресами сайта (/voprosi,
 * /oplata-sayt, /documents): страниц уже нет, и такой шаблон отправит человека
 * в никуда.
 */
function vsl_is_brushoff(string $t): bool {
    $l = mb_strtolower($t);
    return (bool) preg_match('~обращение\s+зарег|находится в обработке|ожидайте пожалуйста|ожидайте, пожалуйста~u', $l)
        || (bool) preg_match('~более подробную информацию~u', $l)
        || (bool) preg_match('~/voprosi|/oplata-sayt|/documents~u', $l)
        || (bool) preg_match('~ответ .{0,30}будет дан~u', $l)
        // «Ознакомьтесь ВНИМАТЕЛЬНО!!!» и «настоятельно рекомендуем ознакомиться»
        // отвечают человеку «сам виноват» вместо ответа. Отучать от такого и надо.
        || (bool) preg_match('~ознакомьтесь пожалуйста внимательно|ознакомьтесь внимательно~u', $l)
        || (bool) preg_match('~настоятельно рекомендуем.{0,40}ознакоми~u', $l)
        || (bool) preg_match('~ранее в рамках данной переписки~u', $l);
}

/**
 * УПОМИНАЕТ ЛИ ОТВЕТ КОНКУРС, КОТОРОГО БОЛЬШЕ НЕТ.
 *
 * Переписке сообщества годы: в ней живут «СЛАВА РОССИИ», «ТАЛАНТЫ РОССИИ»,
 * «Мировые таланты» и десятки других завершённых конкурсов. В подсказке модели
 * такой текст опасен ровно тем, от чего её отдельно отучают в системном промпте:
 * она начнёт называть конкурсы, которых у центра нет. Ответ с названием, которого
 * нет в базе, в канон не идёт — как эталон стиля он тоже не нужен.
 */
function vsl_dead_competition(string $t): bool {
    static $live = null;
    if ($live === null) {
        $live = [];
        try { foreach (all("SELECT name FROM competitions") as $c) $live[] = mb_strtolower(trim((string) $c['name'])); }
        catch (\Throwable $e) { $live = []; }
    }
    if (!preg_match_all('~[«"]([^»"]{4,60})[»"]~u', $t, $mm)) return false;
    foreach ($mm[1] as $name) {
        $n = mb_strtolower(trim($name));
        // Названия центра и его площадок — не конкурсы, их пропускаем.
        if (preg_match('~музыкальн\w+ мир|вконтакте|почта росси~u', $n)) continue;
        if (mb_strlen($n) < 5) continue;
        if (!in_array($n, $live, true)) return true;
    }
    return false;
}

/* ── ШАБЛОНЫ 1:1 ─────────────────────────────────────────────────────────
 * Ответы, которые владелец повторил не меньше трёх раз. Это готовый канон:
 * его надо не пересказывать, а воспроизводить почти дословно. */
uasort($canon, static fn(array $a, array $b): int => $b['n'] <=> $a['n']);
$dropped = 0;
foreach ($canon as $key => $c) {
    if (vsl_is_brushoff($c['a'])) { unset($canon[$key]); $dropped++; }
}
if ($dropped > 0) echo "\nотброшено шаблонов-отписок: $dropped\n";
$tpl = array_filter($canon, static fn(array $c): bool => $c['n'] >= 3);
echo "\n================ ШАБЛОНЫ 1:1 (повтор ≥3) ================\n";
printf("найдено: %d\n\n", count($tpl));
$k = 0;
foreach ($tpl as $c) {
    printf("[%s] повторов %d\n  вопросы: %s\n  ОТВЕТ: %s\n\n",
        $c['topic'], $c['n'], implode(' | ', array_slice($c['qs'], 0, 3)), mb_substr($c['a'], 0, 500));
    if (++$k >= 25) break;
}

if (!$apply) { echo "сухой прогон, в базу ничего не записано\n"; exit(0); }

chat_learn_migrate();
chat_canon_migrate();
$db = db();
$db->beginTransaction();
try {
    // Старые эталоны из ВК заменяем целиком: смешивать разбор двух разных
    // выгрузок незачем, свежий разбор полнее прежнего.
    q("DELETE FROM chat_style_samples WHERE source='vk_history'");
    $st = $db->prepare("INSERT INTO chat_style_samples (topic, question, answer, source, created_at)
                        VALUES (?,?,?, 'vk_history', datetime('now','localtime'))");
    foreach ($picked as $p) $st->execute([$p['topic'], $p['q'], $p['a']]);

    /* КАНОН ПЕРЕЗАПИСЫВАЕМ ТОЛЬКО СВОЙ.
     * Записи, заведённые владельцем руками в админке (source отличный от
     * vk_history), трогать нельзя: он их выверял, а разбор переписки — машинный. */
    q("DELETE FROM chat_canon WHERE source='vk_history'");
    $sc = $db->prepare("INSERT INTO chat_canon (topic, triggers, answer, uses, enabled, source, created_at)
                        VALUES (?,?,?,?,1,'vk_history', datetime('now','localtime'))");
    $canonSaved = 0;
    foreach ($tpl as $c) {
        // «Прочее» в канон не идёт: по такой теме ничего не подберёшь, а в промпт
        // попадёт случайный текст. Туда же не пускаем эскалацию по телефону —
        // она нужна только в конфликте, а не как ответ на обычный вопрос.
            if ($c['topic'] === 'прочее') continue;
        /* Шаблон из одной ссылки — не шаблон: человек получает голый адрес без
           объяснения, что там и зачем. Такой ответ и правился владельцем чаще
           прочих. */
        $bare = trim(preg_replace('~https?://\S+~u', '', $c['a']) ?? '');
        if (mb_strlen($bare) < 40) continue;
        $sc->execute([$c['topic'], implode(' | ', array_slice($c['qs'], 0, 3)), $c['a'], (int) $c['n']]);
        $canonSaved++;
    }
    $db->commit();
} catch (\Throwable $e) {
    $db->rollBack();
    fwrite(STDERR, 'ОШИБКА: ' . $e->getMessage() . "\n");
    exit(1);
}
echo "\nзаписано эталонов: " . count($picked)
   . " (всего chat_style_samples: " . scalar("SELECT COUNT(*) FROM chat_style_samples") . ")\n";
echo "записано шаблонов канона: " . ($canonSaved ?? 0)
   . " (всего chat_canon: " . scalar("SELECT COUNT(*) FROM chat_canon") . ")\n";
