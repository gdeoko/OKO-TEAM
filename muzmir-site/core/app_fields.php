<?php
/**
 * ОДНО МЕСТО, ГДЕ ПОЛЯ ЗАЯВКИ ПРИВОДЯТСЯ К ЕДИНОМУ ВИДУ.
 *
 * Заявку правят из трёх мест: участник в кабинете, администратор в карточке
 * заявки и жюри прямо в оценке. Раньше у каждого места были свои правила, и
 * одно и то же поле после правки выглядело по-разному:
 *
 *   • кабинет заворачивал название номера в «ёлочки», админка — нет;
 *   • кабинет приводил «ИВАНОВ ИВАН» к «Иванов Иван», админка оставляла капс;
 *   • кабинет разворачивал «Минск» в «Республика Беларусь, г. Минск», админка нет;
 *   • админка проверяла форму исполнения по списку solo|duet|ensemble|choir,
 *     которого в справочнике нет вовсе, — и молча возвращала прежнее значение.
 *
 * Отсюда и жалоба владельца: правка «не сохраняется» и «не сходится» между
 * кабинетом, списками и админкой. Теперь правило одно на всех и живёт здесь.
 *
 * Возвращает ['data' => что писать в базу, 'errors' => что человеку сказать].
 * В data попадают ТОЛЬКО те поля, которые были присланы: частичная форма
 * (оценка жюри правит четыре поля) не должна затирать остальные.
 */
declare(strict_types=1);

if (!function_exists('app_fields_normalize')) {

/** Длины полей — те же, что в таблице applications. */
function app_fields_limits(): array {
    return ['full_name' => 200, 'group_name' => 200, 'work_title' => 200, 'teacher' => 200,
            'institution' => 200, 'city' => 120, 'email' => 190, 'phone' => 40,
            'address' => 300, 'postal_index' => 20, 'video_url' => 500,
            'nomination' => 120, 'subgroup' => 120, 'formation' => 120, 'age_category' => 60];
}

/**
 * ПОЛЕ «КОМУ ВЫДАЁТСЯ»: ЧЕЛОВЕК ИЛИ КОЛЛЕКТИВ — ПРАВИЛА РАЗНЫЕ.
 *
 * Раньше это поле всегда шло через v_fio(), а она оставляет в строке только
 * кириллицу, пробел и дефис и ставит каждое слово с заглавной. Для ФИО это
 * верно, но в поле «награждается» сплошь и рядом стоит название коллектива —
 * и оно разрушалось: «Народный вокальный ансамбль «Эхо Красного Камня»»
 * превращалось в «Народный Вокальный Ансамбль Эхо Красного Камня». Кавычки
 * исчезали, регистр ломался, а главное — исправить это было НЕВОЗМОЖНО: какой
 * бы вид администратор ни вписал, функция приводила строку к одному и тому же
 * результату, правка выходила пустой, и админка отвечала «Изменений нет».
 * Заодно терялись инициалы («И. И.» — точки вырезались) и латиница в названиях.
 *
 * Теперь разбираем по-человечески:
 *   • похоже на ФИО (нет кавычек и слов вроде «ансамбль», «хор», «студия») —
 *     как прежде: каждое слово с заглавной, капс разбирается;
 *   • похоже на название коллектива — сохраняем ровно то, что вписали, и
 *     правим только сплошной капс; кавычки, точки и латиница остаются на месте.
 *
 * Ничего не вырезаем ни в одном из случаев: человек, который правит заявку
 * руками, лучше знает, как пишется имя.
 */
function app_person_normalize(string $v): string {
    $v = trim(preg_replace('/\s+/u', ' ', $v) ?? $v);
    if ($v === '') return '';

    // Строка целиком прописными: есть заглавные кириллические и ни одной строчной.
    $isCaps = preg_match('/\p{Lu}/u', $v) === 1 && preg_match('/\p{Ll}/u', $v) !== 1;

    /** Первая буква слова заглавная, остальные строчные; знаки не трогаем. */
    $capWord = static function (string $w): string {
        return preg_replace_callback('/^(\W*)(\w)(.*)$/u', static fn(array $m): string =>
            $m[1] . mb_strtoupper($m[2], 'UTF-8') . mb_strtolower($m[3], 'UTF-8'), $w) ?? $w;
    };
    $capAll = static function (string $s) use ($capWord): string {
        $out = [];
        foreach (preg_split('/\s+/u', $s) ?: [] as $w) {
            $out[] = implode('-', array_map($capWord, explode('-', $w)));
        }
        return implode(' ', $out);
    };

    // Название коллектива узнаём по кавычкам или по типу-приставке.
    $isTitle = preg_match('/[«»"“”]/u', $v) === 1
        || preg_match('/\b(ансамбл|хор|студи|коллектив|театр|дуэт|трио|квартет|квинтет|группа|оркестр|шоу|клуб|школ|образцов|народн|вокальн|танцевальн|фольклорн|цирков)/ui', $v) === 1;

    if ($isTitle) {
        // Вписанное сохраняем как есть; сплошной капс раскрываем, чтобы на
        // дипломе не кричало «НАРОДНЫЙ ВОКАЛЬНЫЙ АНСАМБЛЬ».
        return $isCaps ? $capAll($v) : $v;
    }
    return $capAll($v);
}

/**
 * @param array $in  сырые значения формы: ключ => строка. Учитываются только
 *                   реально присутствующие ключи.
 * @param array $cur текущая заявка — из неё берём номинацию, если форма её не
 *                   прислала, и прежние значения там, где пустое недопустимо.
 */
function app_fields_normalize(array $in, array $cur = []): array {
    foreach (['validator', 'text_format', 'data'] as $m) {
        $f = BASE_PATH . '/core/' . $m . '.php';
        if (is_file($f)) require_once $f;
    }
    $lim  = app_fields_limits();
    $data = [];
    $err  = [];
    $has  = static fn(string $k): bool => array_key_exists($k, $in);
    $raw  = static fn(string $k): string => trim((string) ($in[$k] ?? ''));
    $cut  = static fn(string $k, string $v): string => mb_substr($v, 0, $lim[$k] ?? 200);

    /* Солист или коллектив. */
    if ($has('is_group')) $data['is_group'] = (string) $in['is_group'] === '1' ? 1 : 0;
    $isGroup = (int) ($data['is_group'] ?? ($cur['is_group'] ?? 0));

    /* Имена: Каждое Слово С Заглавной, капс разбирается. */
    foreach (['full_name', 'teacher'] as $k) {
        if (!$has($k)) continue;
        $data[$k] = $cut($k, app_person_normalize($raw($k)));
    }
    /* Название коллектива: тип-приставка снаружи, имя в «ёлочках». */
    if ($has('group_name')) {
        $v = $raw('group_name');
        $data['group_name'] = $cut('group_name', function_exists('collective_normalize') ? collective_normalize($v) : $v);
    }
    /* Название номера: ровно одна пара «ёлочек», повторная правка не удваивает. */
    if ($has('work_title')) {
        $v = $raw('work_title');
        $data['work_title'] = $cut('work_title', function_exists('quote_title') ? quote_title($v) : $v);
    }
    /* Учреждение НЕ трогаем: там аббревиатуры МБОУ ДО, ГБУ, ФГБОУ ВО. */
    if ($has('institution')) $data['institution'] = $cut('institution', $raw('institution'));

    /* Город: «Россия, г. Москва», «Республика Беларусь, г. Минск». */
    if ($has('city')) {
        $v = $raw('city');
        if (function_exists('city_normalize') && ($cn = city_normalize($v)) !== '') $v = $cn;
        $data['city'] = $cut('city', $v);
    }

    /* Почта: ошибка тут означает, что диплом уйдёт в никуда. */
    if ($has('email')) {
        $v = mb_strtolower($raw('email'));
        if ($v === '' || !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $err['email'] = 'Почта указана с ошибкой.';
        } else {
            $data['email'] = $cut('email', $v);
        }
    }
    foreach (['phone', 'address', 'postal_index', 'video_url'] as $k) {
        if ($has($k)) $data[$k] = $cut($k, $raw($k));
    }

    /* Справочники — источник истины один: core/data.php. Чужих значений не берём. */
    $noms = function_exists('NOMINATIONS') ? NOMINATIONS() : [];
    if ($has('nomination')) {
        $v = $raw('nomination');
        if ($v !== '' && $noms && !isset($noms[$v])) $err['nomination'] = 'Такой номинации нет в положении.';
        else $data['nomination'] = $cut('nomination', $v);
    }
    $nom = (string) ($data['nomination'] ?? ($cur['nomination'] ?? ''));
    if ($has('subgroup')) {
        $v = $raw('subgroup');
        $ok = $nom !== '' ? ($noms[$nom] ?? []) : [];
        // Подраздел без своей номинации смысла не имеет — пустим пустым, а не чужим.
        $data['subgroup'] = $cut('subgroup', ($v !== '' && $ok && !in_array($v, $ok, true)) ? '' : $v);
    }
    if ($has('formation')) {
        $v = $raw('formation');
        $ok = function_exists('FORMATIONS_FOR') ? FORMATIONS_FOR($nom) : [];
        if ($v !== '' && $ok && !in_array($v, $ok, true)) $err['formation'] = 'Такой формы исполнения нет в положении.';
        else $data['formation'] = $cut('formation', $v);
    }
    if ($has('age_category')) {
        $v = $raw('age_category');
        $ok = function_exists('AGE_CATEGORIES') ? AGE_CATEGORIES() : [];
        if ($v !== '' && $ok && !in_array($v, $ok, true)) $err['age_category'] = 'Такой возрастной категории нет в положении.';
        else $data['age_category'] = $cut('age_category', $v);
    }

    /* Имя не затираем пустым: у солиста должно остаться ФИО, у коллектива — название. */
    if ($isGroup === 1 && isset($data['group_name']) && $data['group_name'] === '') {
        $data['group_name'] = (string) ($cur['group_name'] ?? '');
    }
    if ($isGroup === 0 && isset($data['full_name']) && $data['full_name'] === '') {
        $data['full_name'] = (string) ($cur['full_name'] ?? '');
    }

    return ['data' => $data, 'errors' => $err];
}

}
