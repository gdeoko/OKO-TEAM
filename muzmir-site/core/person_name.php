<?php
/**
 * ИМЯ ЧЕЛОВЕКА ИЗ ПОЧТОВОГО АДРЕСА.
 *
 * База центра собрана импортом: у 8199 из 8200 подписчиков имени нет вовсе, и
 * письмо начиналось безличным «Здравствуйте, участник!». При этом имя очень часто
 * лежит прямо в адресе: nelaeva.svetlana@…, liza.skvor2018@…, storsnastya2332@…
 *
 * Здесь адрес разбирается и имя достаётся — но ТОЛЬКО когда оно однозначно.
 * Правило простое: лучше безличное «участник», чем обращение к человеку чужим
 * или выдуманным именем. Поэтому:
 *   • берём лишь точные совпадения со словарём русских имён в латинице;
 *   • имя короче 4 букв не рассматриваем (ян, лев — слишком часто это огрызки слов);
 *   • если в адресе нашлось два разных имени — не гадаем, отказываемся;
 *   • кириллические адреса разбираем напрямую, без транслита.
 *
 * Результат — имя в именительном падеже с большой буквы: «Светлана», «Лиза».
 */
declare(strict_types=1);

/**
 * Словарь: латинское написание => имя по-русски.
 * Ключи только в нижнем регистре. Варианты написания (ekaterina/ekatarina,
 * yuliya/juliya/uliya) перечислены отдельными ключами — так надёжнее любых правил.
 */
function pn_dictionary(): array {
    static $d = null;
    if ($d !== null) return $d;

    // Базовые формы: канон => список написаний латиницей.
    $map = [
        'Александр'  => ['aleksandr', 'alexandr', 'alexander', 'sasha', 'sanya', 'shura'],
        'Александра' => ['aleksandra', 'alexandra'],
        'Алексей'    => ['aleksey', 'alexey', 'alexei', 'aleksei', 'lesha', 'lyosha'],
        'Алина'      => ['alina'],
        'Алиса'      => ['alisa'],
        'Алла'       => ['alla'],
        'Анастасия'  => ['anastasia', 'anastasiya', 'nastya', 'nastia', 'nastenka'],
        'Анатолий'   => ['anatoly', 'anatoliy', 'tolya'],
        'Ангелина'   => ['angelina'],
        'Андрей'     => ['andrey', 'andrei', 'andre'],
        'Анна'       => ['anna', 'anya', 'ania', 'anka', 'annushka'],
        'Антон'      => ['anton', 'antoha'],
        'Арина'      => ['arina'],
        'Артём'      => ['artem', 'artyom', 'artiom'],
        'Артур'      => ['artur', 'arthur'],
        'Богдан'     => ['bogdan'],
        'Борис'      => ['boris', 'borya'],
        'Вадим'      => ['vadim'],
        'Валентина'  => ['valentina', 'valya'],
        'Валерия'    => ['valeria', 'valeriya', 'lera'],
        'Валерий'    => ['valeriy', 'valery'],
        'Варвара'    => ['varvara', 'varya'],
        'Василий'    => ['vasily', 'vasiliy', 'vasya'],
        'Вера'       => ['vera'],
        'Вероника'   => ['veronika', 'veronica'],
        'Виктор'     => ['viktor', 'victor', 'vitya'],
        'Виктория'   => ['viktoria', 'viktoriya', 'victoria', 'vika'],
        'Виолетта'   => ['violetta', 'violeta'],
        'Виталий'    => ['vitaly', 'vitaliy', 'vitalik'],
        'Владимир'   => ['vladimir', 'volodya', 'vova'],
        'Владислав'  => ['vladislav', 'vlad'],
        'Галина'     => ['galina', 'galya'],
        'Дарья'      => ['darya', 'daria', 'dasha', 'dashenka'],
        'Даниил'     => ['daniil', 'danila', 'danil', 'danya'],
        'Денис'      => ['denis'],
        'Дмитрий'    => ['dmitry', 'dmitriy', 'dima', 'mitya'],
        'Евгения'    => ['evgenia', 'evgeniya', 'zhenya'],
        'Евгений'    => ['evgeny', 'evgeniy', 'eugene'],
        'Егор'       => ['egor', 'yegor'],
        'Екатерина'  => ['ekaterina', 'katerina', 'katya', 'katia', 'kate'],
        'Елена'      => ['elena', 'yelena', 'lena', 'alena', 'alyona', 'alenka'],
        'Елизавета'  => ['elizaveta', 'liza', 'lizaveta'],
        'Захар'      => ['zahar', 'zakhar'],
        'Иван'       => ['ivan', 'vanya'],
        'Игорь'      => ['igor'],
        'Илья'       => ['ilya', 'ilia', 'iliya'],
        'Инна'       => ['inna'],
        'Ирина'      => ['irina', 'ira', 'irisha'],
        'Кирилл'     => ['kirill', 'kiril'],
        'Кристина'   => ['kristina', 'christina'],
        'Ксения'     => ['ksenia', 'kseniya', 'ksusha', 'oksana'],
        'Лариса'     => ['larisa'],
        'Лидия'      => ['lidia', 'lidiya'],
        'Любовь'     => ['lyubov', 'lubov', 'luba', 'lyuba'],
        'Людмила'    => ['lyudmila', 'ludmila', 'lyuda', 'mila'],
        'Маргарита'  => ['margarita', 'rita'],
        'Марина'     => ['marina'],
        'Мария'      => ['maria', 'mariya', 'masha', 'marusya'],
        'Матвей'     => ['matvey', 'matvei'],
        'Максим'     => ['maksim', 'maxim', 'max'],
        'Михаил'     => ['mihail', 'mikhail', 'misha'],
        'Надежда'    => ['nadezhda', 'nadya'],
        'Наталья'    => ['natalya', 'natalia', 'nataliya', 'natasha', 'nata'],
        'Никита'     => ['nikita'],
        'Николай'    => ['nikolay', 'nikolai', 'kolya'],
        'Нина'       => ['nina'],
        'Олег'       => ['oleg'],
        'Ольга'      => ['olga', 'olya'],
        'Павел'      => ['pavel', 'pasha'],
        'Полина'     => ['polina', 'polya'],
        'Роман'      => ['roman', 'roma'],
        'Руслан'     => ['ruslan'],
        'Светлана'   => ['svetlana', 'sveta'],
        'Сергей'     => ['sergey', 'sergei', 'seryozha', 'seriy'],
        'София'      => ['sofia', 'sofiya', 'sonya'],
        'Станислав'  => ['stanislav', 'stas'],
        'Степан'     => ['stepan', 'styopa'],
        'Тамара'     => ['tamara'],
        'Татьяна'    => ['tatyana', 'tatiana', 'tanya', 'tania'],
        'Тимофей'    => ['timofey', 'timofei'],
        'Фёдор'      => ['fedor', 'fyodor'],
        'Эльвира'    => ['elvira'],
        'Юлия'       => ['yulia', 'yuliya', 'julia', 'juliya', 'ulia', 'yulya'],
        'Юрий'       => ['yuri', 'yuriy', 'jurij'],
        'Яна'        => ['yana', 'jana'],
        'Ярослав'    => ['yaroslav'],
        // Написания через X/J и часто встречающиеся в базе региональные имена.
        'Ксения'     => ['xenia', 'ksenia', 'kseniya', 'ksusha'],
        'Оксана'     => ['oksana', 'oxana'],
        'Диана'      => ['diana'],
        'Карина'     => ['karina'],
        'Милана'     => ['milana'],
        'Олеся'      => ['olesya', 'olesia'],
        'Снежана'    => ['snezhana'],
        'Жанна'      => ['zhanna'],
        'Регина'     => ['regina'],
        'Альбина'    => ['albina'],
        'Аделина'    => ['adelina'],
        'Эльмира'    => ['elmira'],
        'Динара'     => ['dinara'],
        'Гульнара'   => ['gulnara'],
        'Гузель'     => ['guzel'],
        'Венера'     => ['venera'],
        'Фарида'     => ['farida'],
        'Лилия'      => ['liliya', 'lilia', 'lilya'],
        'Роза'       => ['roza'],
        'Марат'      => ['marat'],
        'Рамиль'     => ['ramil'],
        'Ринат'      => ['rinat'],
        'Ильнур'     => ['ilnur'],
        'Айрат'      => ['ayrat', 'airat'],
        'Радмир'     => ['radmir'],
        'Тимур'      => ['timur'],
        'Камила'     => ['kamila', 'kamilla'],
        'Амина'      => ['amina'],
        'Самира'     => ['samira'],
        'Эльвина'    => ['elvina'],
        'Лейла'      => ['leyla', 'leila'],
        'Мирослава'  => ['miroslava'],
        'Ульяна'     => ['ulyana', 'uliana'],
        'Вячеслав'   => ['vyacheslav', 'slava'],
        'Геннадий'   => ['gennady', 'gennadiy'],
        'Григорий'   => ['grigory', 'grigoriy', 'grisha'],
        'Леонид'     => ['leonid', 'lyonya'],
        'Пётр'       => ['petr', 'pyotr', 'petya'],
        'Раиса'      => ['raisa'],
        'Зинаида'    => ['zinaida'],
        'Нелли'      => ['nelli', 'nelly'],
        'Элина'      => ['elina'],
        'Эмилия'     => ['emilia', 'emiliya'],
        'Есения'     => ['esenia', 'eseniya'],
        'Агата'      => ['agata'],
        'Злата'      => ['zlata'],
        'Таисия'     => ['taisiya', 'taisia'],
        'Матрёна'    => ['matrena'],
        'Клавдия'    => ['klavdia', 'klavdiya'],
        'Антонина'   => ['antonina'],
        'Нонна'      => ['nonna'],
        'Римма'      => ['rimma'],
        'Роксана'    => ['roksana'],
        'Софья'      => ['sofya'],
        'Владлена'   => ['vladlena'],
    ];

    $d = [];
    foreach ($map as $ru => $variants) {
        foreach ($variants as $v) $d[$v] = $ru;
        // Кириллическое написание самого имени тоже узнаём (адреса на .рф-почтах).
        $d[mb_strtolower($ru)] = $ru;
    }
    $d = array_filter($d, fn($k) => mb_strlen((string) $k) >= 4, ARRAY_FILTER_USE_KEY);
    return $d;
}

/**
 * Достаёт имя из адреса. Возвращает '' если уверенности нет.
 *
 * @param string $email адрес целиком
 */
function name_from_email(string $email): string {
    $email = mb_strtolower(trim($email));
    $at = mb_strpos($email, '@');
    if ($at === false || $at < 2) return '';
    $local = mb_substr($email, 0, $at);

    // Служебные и общие ящики именем не обладают.
    foreach (['info', 'mail', 'admin', 'office', 'shop', 'support', 'sales', 'noreply',
              'no-reply', 'contact', 'school', 'dou', 'mbdou', 'mkdou', 'gbou', 'mbou',
              'sad', 'detsad', 'director', 'buh', 'zakaz', 'post'] as $svc) {
        if ($local === $svc || str_starts_with($local, $svc . '.') || str_starts_with($local, $svc . '_')) return '';
    }

    $dict = pn_dictionary();

    // 1) Точные куски адреса: режем по разделителям и цифрам.
    $parts = preg_split('~[^\p{L}]+~u', $local, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $found = [];
    foreach ($parts as $p) {
        $p = mb_strtolower($p);
        if (isset($dict[$p])) $found[$dict[$p]] = true;
    }
    if (count($found) === 1) return (string) array_key_first($found);
    if (count($found) > 1) return '';          // два имени в адресе — не гадаем

    // 2) Имя, слипшееся с фамилией: ищем словарное имя в начале или в конце куска.
    //    Требуем длину от 5 букв — короткие слишком часто совпадают случайно
    //    («ira» внутри «pirat», «ivan» внутри «ivanovka»).
    foreach ($parts as $p) {
        $p = mb_strtolower($p);
        if (mb_strlen($p) < 7) continue;
        foreach ($dict as $lat => $ru) {
            if (mb_strlen((string) $lat) < 5) continue;
            if (str_starts_with($p, (string) $lat) || str_ends_with($p, (string) $lat)) {
                $found[$ru] = true;
            }
        }
    }
    return count($found) === 1 ? (string) array_key_first($found) : '';
}

/**
 * ЭТО НАЗВАНИЕ КОЛЛЕКТИВА, А НЕ ЧЕЛОВЕК?
 *
 * В базе центра рядом с людьми живут ансамбли, хоры и студии: «Академия
 * детства», Хор «Радуга», Виа «Ялкын», «Актёрское трио». Разбор ФИО на таком
 * названии выдаёт второе слово, и письмо начинается с «Здравствуйте, трио!»
 * или «Здравствуйте, детства!». Коллективу здороваемся без имени — это всегда
 * уместно, в отличие от выдернутого из названия слова.
 */
function pn_is_collective(string $s): bool {
    $t = trim($s);
    if ($t === '') return false;
    // Кавычки в любом начертании — почти верный признак названия.
    if (preg_match('~[«»"\x{201C}\x{201D}\x{201E}]~u', $t)) return true;
    return (bool) preg_match('~^\s*(ансамбл|хор\b|хоров|студи|арт-?студи|театр|коллектив|'
        . 'виа\b|дуэт|трио|квартет|квинтет|группа|гр\.|клуб|центр|школ|академи|оркестр|'
        . 'сшор|дши\b|дшин|дмш\b|мбу|мбоу|гбоу|маоу|мкоу|доу\b|мбдоу|сош\b|лице|гимназ|'
        . 'кружок|объединени|команда|фольклорн|образцов|народн|вокальн|танцевальн)~ui', $t);
}

/** Похоже на отчество: Ивановна, Иванович, Ильинична, Кузьминична. */
function pn_is_patronymic(string $w): bool {
    return (bool) preg_match('~(ович|евич|ьич|иич|овна|евна|ична|инична|кызы|оглы|улы|уулу)$~ui', trim($w));
}

/** Похоже на фамилию по окончанию (не строгое правило, а подсказка). */
function pn_looks_surname(string $w): bool {
    $w = trim($w);
    if ($w === '' || pn_is_patronymic($w)) return false;
    return (bool) preg_match('~(ов|ев|ёв|ин|ын|ский|цкий|ской|ова|ева|ёва|ина|ына|ская|цкая|'
        . 'енко|ченко|чук|юк|ук|швили|дзе|ян|янц|ько|ых|их|ова́)$~ui', $w);
}

/** Слово есть в словаре русских имён (канонические формы pn_dictionary). */
function pn_is_known_first_name(string $w): bool {
    static $set = null;
    if ($set === null) {
        $set = [];
        foreach (pn_dictionary() as $ru) $set[mb_strtolower((string) $ru)] = true;
    }
    $w = mb_strtolower(trim($w));
    // «Артём»/«Артем» в базе пишут и так и так.
    return isset($set[$w]) || isset($set[str_replace('е', 'ё', $w)]) || isset($set[str_replace('ё', 'е', $w)]);
}

/**
 * ИМЯ ДЛЯ ОБРАЩЕНИЯ — ТОЛЬКО КОГДА МЫ В НЁМ УВЕРЕНЫ.
 *
 * Прежняя версия брала из ФИО второе слово всегда, как только слов было два и
 * больше. На «Фамилия Имя Отчество» это верно, но база устроена сложнее:
 *   «Ольга Павловна Медведева» → «Павловна»;
 *   «Ирина Шатеева»            → «Шатеева»;
 *   «Актёрское трио»           → «трио».
 * Такое обращение человек читает как насмешку, и письмо, которое должно было
 * обрадовать, начинается с оскорбления. Поэтому порядок слов РАЗБИРАЕТСЯ, а
 * при любом сомнении имя не подставляется вовсе: «Здравствуйте!» без имени
 * безупречно, «Здравствуйте, Павловна!» — нет.
 *
 * Пустая строка в ответе — это не сбой, а осознанное «здороваемся без имени».
 */
function person_greeting_name(string $email, string $storedName = ''): string {
    $stored = trim($storedName);
    if ($stored !== '') {
        if (pn_is_collective($stored)) return '';
        $bits = preg_split('~\s+~u', $stored, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        // Мусор вроде «---» или одних цифр именем не считаем.
        $bits = array_values(array_filter($bits, static fn(string $b): bool => (bool) preg_match('~^\p{L}[\p{L}\-]*$~u', $b)));
        $n = count($bits);

        /* После отсева мусора («---», одни цифры, пустые кавычки) слов может не
           остаться вовсе. Тогда имени у нас нет: пробуем разобрать адрес, как
           если бы поле было пустым. Без этой ветки разбор шёл дальше и падал на
           несуществующем $bits[1], роняя письмо целиком. */
        if ($n === 0) return name_from_email($email);

        /* Одно слово. Словарь имён спрашиваем ПЕРВЫМ: «Галина», «Ирина»,
           «Екатерина» оканчиваются ровно так же, как фамилии на -ина, и
           проверка по окончанию молча съедала бы обращение у каждой второй
           Галины. Окончание решает только то, чего словарь не знает. */
        if ($n === 1) {
            if (pn_is_known_first_name($bits[0])) return $bits[0];
            return pn_looks_surname($bits[0]) || pn_is_patronymic($bits[0]) ? '' : $bits[0];
        }

        if ($n === 2) {
            // «Иванова Мария» / «Мария Иванова» — решаем по словарю, затем по окончаниям.
            if (pn_is_patronymic($bits[1])) return $bits[0];            // «Ольга Павловна»
            if (pn_is_known_first_name($bits[1])) return $bits[1];
            if (pn_is_known_first_name($bits[0])) return $bits[0];
            if (pn_looks_surname($bits[0]) && !pn_looks_surname($bits[1])) return $bits[1];
            if (pn_looks_surname($bits[1]) && !pn_looks_surname($bits[0])) return $bits[0];
            return '';                                                  // не уверены — без имени
        }

        // Три слова и больше: отчество показывает, где имя.
        if (pn_is_patronymic($bits[1])) return $bits[0];                // Имя Отчество Фамилия
        if ($n >= 3 && pn_is_patronymic($bits[2])) return $bits[1];     // Фамилия Имя Отчество
        if (pn_is_known_first_name($bits[1])) return $bits[1];
        if (pn_is_known_first_name($bits[0])) return $bits[0];
        return '';
    }
    return name_from_email($email);
}

/**
 * ГОТОВАЯ СТРОКА ПРИВЕТСТВИЯ: «Здравствуйте, Мария!» либо «Здравствуйте!».
 *
 * Нужна потому, что шаблон не может сам решить, ставить ли запятую: подстановка
 * пустого имени давала «Здравствуйте, !». А заглушки вроде «уважаемый участник»
 * читаются как обращение к никому — в переписке центра их нет и быть не должно.
 */
function person_greeting_line(string $email, string $storedName = '', string $hello = 'Здравствуйте'): string {
    $nm = person_greeting_name($email, $storedName);
    return $nm !== '' ? $hello . ', ' . $nm . '!' : $hello . '!';
}
