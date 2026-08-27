<?php
/**
 * ПРЕДЛОЖЕНИЕ ОРИГИНАЛОВ НАГРАД — С ФОТОГРАФИЯМИ И ЦЕНАМИ.
 *
 * Письма о заказе наград до сих пор объясняли словами: «доступна памятная
 * статуэтка в честь Вашего звания». Человек не видел, что именно ему предлагают,
 * и не понимал, чем статуэтка отличается от медали. Награду покупают глазами:
 * пока её не показали, письмо остаётся текстом с просьбой заплатить.
 *
 * Здесь собирается набор, положенный конкретному участнику, с настоящими
 * снимками того, что придёт по почте, и с ценами из прайса конкурса.
 *
 * ЧТО КОМУ ПОЛОЖЕНО (правило центра, оно же в rm_award_hint):
 *   Гран-при   — кубок;
 *   лауреат    — статуэтка;
 *   дипломант  — медаль.
 * Диплом на бланке и благодарность педагогу доступны при любом звании: их
 * заказывают чаще всего, и не показать их значит потерять большую часть заказов.
 *
 * Снимки берутся из public/assets/img/awards/<id конкурса>/mail/ — облегчённые
 * версии на 560 точек (scripts/award_previews.php). Оригиналы весят по два
 * мегабайта, в письме они не грузятся.
 */
declare(strict_types=1);

/** Главный предмет по званию: [файл, подпись, ключ прайса]. */
function ao_main_item(string $result): array {
    $r = mb_strtoupper($result);
    if (str_contains($r, 'ГРАН-ПРИ'))  return ['cup.jpg', 'Наградной кубок', 'Кубок Гран-при'];
    if (str_contains($r, 'ЛАУРЕАТ'))   return ['statuette.jpg', 'Памятная статуэтка', 'Статуэтка лауреата'];
    if (str_contains($r, 'ДИПЛОМАНТ')) return ['medal.jpg', 'Наградная медаль', 'Медаль дипломанта'];
    return [];
}

/** Цена позиции по прайсу конкурса, с откатом на общий прайс. 0 — не найдена. */
function ao_price(int $compId, string $item, string $kind = 'original'): int {
    try {
        $p = one("SELECT price FROM awards_prices WHERE competition_id=? AND item=? AND kind=?",
                 [$compId, $item, $kind]);
        if (!$p) $p = one("SELECT price FROM awards_prices WHERE COALESCE(competition_id,'')='' AND item=? AND kind=?",
                          [$item, $kind]);
        return (int) ($p['price'] ?? 0);
    } catch (\Throwable $e) { return 0; }
}

/** Есть ли снимок для письма. Возвращает публичный адрес или ''. */
function ao_photo(int $compId, string $file): string {
    $rel = '/assets/img/awards/' . $compId . '/mail/' . $file;
    if (is_file(BASE_PATH . '/public' . $rel)) {
        return function_exists('url') ? url($rel) : $rel;
    }
    // Снимков этого конкурса ещё нет — берём любой готовый набор, чтобы человек
    // всё-таки увидел, как выглядит награда: изделия одинаковые, отличается
    // только гравировка.
    foreach (glob(BASE_PATH . '/public/assets/img/awards/*/mail/' . $file) ?: [] as $any) {
        $p = str_replace(BASE_PATH . '/public', '', $any);
        return function_exists('url') ? url($p) : $p;
    }
    return '';
}

/**
 * Набор для участника: что показываем и почём.
 * @return array<int,array{photo:string,title:string,note:string,price:int}>
 */
function ao_kit(int $compId, string $result, bool $isGroup = false): array {
    $kit  = [];
    $main = ao_main_item($result);
    if ($main) {
        [$file, $title, $priceKey] = $main;
        $photo = ao_photo($compId, $file);
        if ($photo !== '') {
            $kit[] = ['photo' => $photo, 'title' => $title, 'price' => ao_price($compId, $priceKey),
                      'note'  => 'С гравировкой звания, конкурса и Вашего имени. Приходит в подарочной упаковке.'];
        }
    }
    $photoDip = ao_photo($compId, 'diploma.jpg');
    if ($photoDip !== '') {
        $kit[] = ['photo' => $photoDip, 'title' => 'Диплом на бланке',
                  'price' => ao_price($compId, 'Основной диплом'),
                  'note'  => 'Плотная дизайнерская бумага, голографический логотип, живые подпись и печать.'];
    }
    /* КОЛЛЕКТИВУ — ИМЕННОЙ ДИПЛОМ КАЖДОМУ УЧАСТНИКУ.
     *
     * Диплом коллектива один на всех, и висит он в кабинете руководителя. Дети
     * же несут награду домой, в портфолио, в личное дело — им нужен диплом со
     * своей фамилией. Ансамблю из двадцати человек это двадцать дипломов, и не
     * предложить их значит не сделать самого нужного: руководители спрашивают
     * про именные чаще, чем про всё остальное вместе. Солисту эта позиция не
     * показывается — у него диплом и так именной. */
    if ($isGroup) {
        $photoNm = ao_photo($compId, 'diploma-name.jpg');
        if ($photoNm === '') $photoNm = ao_photo($compId, 'diploma.jpg');
        if ($photoNm !== '') {
            $kit[] = ['photo' => $photoNm, 'title' => 'Именной диплом каждому участнику коллектива',
                      'price' => ao_price($compId, 'Именной диплом'),
                      'note'  => 'С фамилией и именем ребёнка, званием и названием коллектива. '
                               . 'Заказывается по числу участников — цена указана за один диплом.'];
        }
    }

    $photoTh = ao_photo($compId, 'thanks.jpg');
    if ($photoTh !== '') {
        $kit[] = ['photo' => $photoTh, 'title' => 'Благодарность педагогу',
                  'price' => ao_price($compId, 'Благодарность'),
                  'note'  => 'Именная, за подготовку участника. Педагоги хранят их годами.'];
    }
    return $kit;
}

/**
 * Готовый блок для письма. Пустая строка, если показывать нечего.
 *
 * ОБРАЗЦЫ СТОЯТ РЯДОМ, А НЕ СТОЛБИКОМ.
 *
 * Раньше каждая награда шла отдельной карточкой во всю ширину — четыре снимка
 * подряд превращали письмо в длинного червяка, до кнопки заказа человек
 * доскроллить не успевал. Теперь это одна горизонтальная витрина: три позиции
 * в ряд (солист) или две на два (коллектив, где добавляется именной диплом).
 * Ряд занимает один экран, весь набор виден сразу — так его и выбирают.
 *
 * Вёрстка нарочно табличная и без внешних стилей: почтовые клиенты не понимают
 * ни flex, ни grid, а Outlook игнорирует и часть обычных свойств. Таблица с
 * фиксированными долями ширины — единственное, что не рассыпается ни в Gmail,
 * ни в mail.ru, ни на телефоне: колонки остаются колонками.
 */
function ao_block(int $compId, string $result, string $url = '', bool $isGroup = false): string {
    $kit = ao_kit($compId, $result, $isGroup);
    if (!$kit) return '';

    $navy = defined('RM_NAVY') ? RM_NAVY : '#17307A';
    $gold = defined('RM_GOLD') ? RM_GOLD : '#C79322';
    $ink  = defined('RM_INK')  ? RM_INK  : '#2a2a2a';
    $mut  = defined('RM_MUTED') ? RM_MUTED : '#6b6b6b';
    $line = defined('RM_LINE') ? RM_LINE : '#e6e0d2';
    $card = defined('RM_CARD') ? RM_CARD : '#faf8f3';

    $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

    // Три позиции встают в один ряд, четыре — квадратом два на два: и то и другое
    // выглядит намеренным, а 3+1 смотрится как обрыв вёрстки.
    $cols  = count($kit) === 4 ? 2 : 3;
    $width = $cols === 2 ? '50%' : '33.33%';

    $card1 = static function (array $it) use ($h, $navy, $gold, $ink, $line, $card, $width): string {
        $price = (int) $it['price'] > 0 ? number_format((int) $it['price'], 0, ',', ' ') . ' ₽' : '';
        return '<td width="' . $width . '" valign="top" style="width:' . $width . ';padding:4px;">'
             . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
             . 'style="background:' . $card . ';border:1px solid ' . $line . ';border-radius:12px;overflow:hidden;">'
             . '<tr><td style="padding:0;"><img src="' . $h($it['photo']) . '" width="180" '
             . 'alt="' . $h($it['title']) . '" style="display:block;width:100%;height:auto;border:0;"></td></tr>'
             . '<tr><td style="padding:9px 10px 11px;text-align:center;">'
             . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:13px;line-height:1.3;'
             . 'font-weight:700;color:' . $navy . ';">' . $h($it['title']) . '</div>'
             . ($price !== '' ? '<div style="margin-top:4px;font-size:14px;font-weight:700;color:' . $gold . ';">' . $price . '</div>' : '')
             . '</td></tr></table></td>';
    };

    $out = '<p style="margin:22px 0 10px;font-weight:700;color:' . $navy . ';font-size:16px;">'
         . 'Что можно заказать по Вашему результату</p>'
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;margin:0 0 10px;">';
    $rows = array_chunk($kit, $cols);
    foreach ($rows as $row) {
        $out .= '<tr>';
        foreach ($row as $it) $out .= $card1($it);
        for ($i = count($row); $i < $cols; $i++) {
            $out .= '<td width="' . $width . '" style="width:' . $width . ';padding:4px;"></td>';
        }
        $out .= '</tr>';
    }
    $out .= '</table>';

    // Пояснения к позициям — строками под витриной: в подпись под снимком они не
    // помещаются, а без них непонятно, чем оригинал отличается от электронного.
    $out .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">';
    foreach ($kit as $it) {
        $out .= '<tr><td style="padding:3px 4px;font-size:13px;line-height:1.55;color:' . $ink . ';">'
              . '<b style="color:' . $navy . ';">' . $h($it['title']) . '.</b> ' . $h($it['note'])
              . '</td></tr>';
    }
    $out .= '</table>';

    $out .= '<p style="margin:6px 0 0;font-size:13px;color:' . $mut . ';">'
          . 'Доставка Почтой России по всей стране. Несколько позиций в одном заказе едут одной посылкой.</p>';

    if ($url !== '') {
        $out .= '<p style="margin:14px 0 0;"><a href="' . $h($url) . '" '
              . 'style="display:inline-block;padding:13px 24px;background:' . $navy . ';color:#fff;'
              . 'text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Выбрать и заказать</a></p>';
    }
    return $out;
}
