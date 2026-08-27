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
 * Вёрстка нарочно табличная и без внешних стилей: почтовые клиенты не понимают
 * ни flex, ни grid, а Outlook игнорирует и часть обычных свойств. Одна колонка
 * на позицию — на телефоне это единственный вид, который не рассыпается.
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

    $out = '<p style="margin:22px 0 12px;font-weight:700;color:' . $navy . ';font-size:16px;">'
         . 'Что можно заказать по Вашему результату</p>';

    foreach ($kit as $it) {
        $price = (int) $it['price'] > 0 ? number_format((int) $it['price'], 0, ',', ' ') . ' ₽' : '';
        $out .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
              . 'style="margin:0 0 14px;background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;overflow:hidden;">'
              . '<tr><td style="padding:0;">'
              . '<img src="' . $h($it['photo']) . '" width="560" alt="' . $h($it['title']) . '" '
              . 'style="display:block;width:100%;max-width:560px;height:auto;border:0;">'
              . '</td></tr>'
              . '<tr><td style="padding:14px 18px 16px;">'
              . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:17px;font-weight:700;color:' . $navy . ';">'
              . $h($it['title'])
              . ($price !== '' ? ' <span style="color:' . $gold . ';font-size:15px;">— ' . $price . '</span>' : '')
              . '</div>'
              . '<div style="margin-top:6px;font-size:14px;line-height:1.6;color:' . $ink . ';">' . $h($it['note']) . '</div>'
              . '</td></tr></table>';
    }

    $out .= '<p style="margin:0 0 4px;font-size:13px;color:' . $mut . ';">'
          . 'Доставка Почтой России по всей стране. Несколько позиций в одном заказе едут одной посылкой.</p>';

    if ($url !== '') {
        $out .= '<p style="margin:14px 0 0;"><a href="' . $h($url) . '" '
              . 'style="display:inline-block;padding:13px 24px;background:' . $navy . ';color:#fff;'
              . 'text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Выбрать и заказать</a></p>';
    }
    return $out;
}
