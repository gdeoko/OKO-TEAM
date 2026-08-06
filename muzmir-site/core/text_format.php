<?php
/**
 * Нормализация ввода заявки: ФИО, название коллектива, название конкурсного номера.
 * Правила владельца:
 *   • ФИО — без кавычек, каждое слово с большой буквы: «Иванов Иван Владимирович».
 *   • Название номера — всегда в «ёлочках»: «Жаворонок» (из жаворонок/ЖАВОРОНОК/'Жаворонок').
 *   • Название коллектива — всегда в «ёлочках», тип-приставка снаружи: Хор «Название».
 *   • В списке длинного конкурса — только сам «Название» (без «песня/танец», ФИО авторов).
 */
declare(strict_types=1);

if (!function_exists('tf_strip_quotes')) {
    /** Снять любые внешние кавычки/пробелы. */
    function tf_strip_quotes(string $s): string {
        $s = trim($s);
        $s = preg_replace('~^[\s«»"“”\'‘’`]+~u', '', $s);
        $s = preg_replace('~[\s«»"“”\'‘’`]+$~u', '', $s);
        return trim((string) $s);
    }
}

if (!function_exists('tf_cap_word')) {
    /** Одно слово → Первая заглавная, остальные строчные (с учётом дефиса/апострофа). */
    function tf_cap_word(string $w): string {
        $w = mb_strtolower($w, 'UTF-8');
        return (string) preg_replace_callback('~(^|[\-\x{2019}\'])(\p{L})~u',
            static fn(array $m): string => $m[1] . mb_strtoupper($m[2], 'UTF-8'), $w);
    }
}

if (!function_exists('fio_normalize')) {
    /** ФИО без кавычек, каждое слово с большой буквы. «ИВАНОВ иван» → «Иванов Иван». */
    function fio_normalize(string $s): string {
        $s = tf_strip_quotes(preg_replace('~\s+~u', ' ', $s) ?? '');
        if ($s === '') return '';
        $parts = array_filter(explode(' ', $s), static fn($w) => $w !== '');
        return implode(' ', array_map('tf_cap_word', $parts));
    }
}

if (!function_exists('fio_is_full')) {
    /** ФИО полная = минимум 3 слова (фамилия имя отчество), каждое ≥2 букв. */
    function fio_is_full(string $s): bool {
        $s = trim(preg_replace('~\s+~u', ' ', $s) ?? '');
        $parts = array_values(array_filter(explode(' ', $s),
            static fn($w) => mb_strlen(trim($w)) >= 2 && preg_match('~^[\p{L}\-\x{2019}\']+$~u', $w)));
        return count($parts) >= 3;
    }
}

if (!function_exists('tf_smart_title')) {
    /**
     * Разумный регистр названия:
     *   • всё ЗАГЛАВНЫМИ → как в предложении (первая заглавная, дальше строчные);
     *   • одно слово (жаворонок/жАвоРонок) → Заглавная + строчные;
     *   • несколько слов — только первая буква заглавная, остальное как ввели
     *     (сохраняем «День Победы», «Баба Нина», «А зори здесь тихие»).
     */
    function tf_smart_title(string $s): string {
        $s = trim($s);
        if ($s === '') return '';
        $isAllUpper = ($s === mb_strtoupper($s, 'UTF-8'));
        $isOneWord  = !preg_match('~\s~u', $s);
        if ($isAllUpper || $isOneWord) return tf_cap_word($s);
        // многословное: заглавная только первая буква
        return mb_strtoupper(mb_substr($s, 0, 1), 'UTF-8') . mb_substr($s, 1);
    }
}

if (!function_exists('quote_title')) {
    /**
     * Название конкурсного номера в «ёлочки». Если внутри уже есть «…» (пользователь
     * сам оформил, напр. «песня «Жаворонок» Глинка») — не трогаем структуру, только
     * приводим сами кавычки к «». Иначе оборачиваем всё с разумным регистром.
     */
    function quote_title(string $s): string {
        $s = trim($s);
        if ($s === '') return '';
        // Уже есть парная «…» внутри — нормализуем прочие кавычки на «», оставляем как есть.
        if (preg_match('~[«»]~u', $s) || preg_match('~["“”].+["“”]~u', $s)) {
            $i = 0;
            $s = preg_replace_callback('~["“”]~u', function () use (&$i) { return (++$i % 2) ? '«' : '»'; }, $s);
            return (string) $s;
        }
        return '«' . tf_smart_title(tf_strip_quotes($s)) . '»';
    }
}

if (!function_exists('collective_normalize')) {
    /** Тип-приставки коллективов (для отделения от названия). */
    function collective_types(): array {
        return ['вокальный ансамбль','танцевальный коллектив','хореографический коллектив','инструментальный ансамбль',
                'образцовый коллектив','народный коллектив','детский коллектив','эстрадный коллектив','фольклорный ансамбль',
                'вокальная группа','вокальный коллектив','творческий коллектив','вокальный дуэт','танцевальный дуэт',
                'ансамбль','коллектив','дуэт','трио','квартет','квинтет','секстет','хор','студия','группа','оркестр','театр','капелла'];
    }
    /**
     * Название коллектива: имя в «ёлочках», тип-приставка снаружи с большой буквы.
     *   «ремарка» → «Ремарка»; «вокальный дуэт светелка» → Вокальный дуэт «Светелка».
     */
    function collective_normalize(string $s): string {
        $s = trim(preg_replace('~\s+~u', ' ', $s) ?? '');
        if ($s === '') return '';
        // Уже есть «…»/"…" — приставка = до кавычки, имя = внутри.
        if (preg_match('~^(.*?)[«"“](.+?)[»"”]\s*$~u', $s, $m)) {
            $prefix = trim($m[1]); $name = trim($m[2]);
        } else {
            $prefix = ''; $name = tf_strip_quotes($s);
            $low = mb_strtolower($name, 'UTF-8');
            foreach (collective_types() as $t) {
                if (mb_strpos($low, $t) === 0) {
                    $prefix = mb_substr($name, 0, mb_strlen($t));
                    $name = trim(mb_substr($name, mb_strlen($t)));
                    break;
                }
            }
        }
        if ($name === '') { $name = $prefix; $prefix = ''; }
        $nameQ = '«' . tf_smart_title($name) . '»';
        if ($prefix === '') return $nameQ;
        // Приставку — с большой буквы (первое слово), остальное строчными.
        $prefix = mb_strtoupper(mb_substr($prefix, 0, 1), 'UTF-8') . mb_strtolower(mb_substr($prefix, 1), 'UTF-8');
        return $prefix . ' ' . $nameQ;
    }
}

if (!function_exists('work_title_for_list')) {
    /**
     * Для списка длинного конкурса — только «Название».
     * Из «песня «Жаворонок» М.И.Глинка» → «Жаворонок». Если «…» нет — срезаем жанровые
     * слова в начале (песня/танец/стих…) и оборачиваем.
     */
    function work_title_for_list(string $s): string {
        $s = trim($s);
        if ($s === '') return '';
        if (preg_match('~[«"“](.+?)[»"”]~u', $s, $m)) {   // берём первый кавычечный сегмент
            return '«' . tf_smart_title(trim($m[1])) . '»';
        }
        $genre = '~^\s*(песня|песни|танец|танца|стих(отворение)?|стиха|романс|произведение|номер|композиция|вокал|хореография|инструментал\w*)\s+~ui';
        $s = preg_replace($genre, '', $s) ?? $s;
        return '«' . tf_smart_title(tf_strip_quotes($s)) . '»';
    }
}
