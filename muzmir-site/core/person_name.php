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
 * Имя для обращения в письме и в кабинете.
 * Сначала то, что человек указал сам, потом догадка по адресу, потом ''.
 */
function person_greeting_name(string $email, string $storedName = ''): string {
    $stored = trim($storedName);
    if ($stored !== '') {
        // В базе часто лежит полное ФИО — здороваемся именем, а не всей строкой.
        $bits = preg_split('~\s+~u', $stored, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($bits) >= 2) {
            // «Нелаева Светлана Александровна» → «Светлана» (второе слово — имя).
            return (string) $bits[1];
        }
        return $stored;
    }
    return name_from_email($email);
}
