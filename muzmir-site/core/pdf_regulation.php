<?php
/**
 * core/pdf_regulation.php — генератор ПОЛОЖЕНИЯ конкурса (PDF).
 *
 * pdf_regulation(array $competition): string
 *   По ключевым полям конкурса (name, type, direction, is_paid, price,
 *   start/end/results-даты, nominations) собирает многостраничное положение
 *   из 13 разделов: шапка с логотипами и правовыми основаниями (ГК РФ гл.57,
 *   Указ Президента РФ №808), условия, номинации из справочника, возрастные
 *   категории, 10-балльная шкала, требования к материалам (разрешённые/
 *   запрещённые платформы), контакты, подвал с печатью и подписями Оргкомитета.
 *   Возвращает абсолютный путь к PDF в public/. Тихие фолбэки, try/catch.
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';

/** Поточная A4-вёрстка поверх GD с авто-переносом страниц. */
final class PdfFlow {
    public int $W = 1240, $H = 1754;      // A4 @ ~150dpi
    public int $mL = 116, $mR = 116, $mT = 128, $mB = 132;
    public array $pages = [];
    public $img;                          // текущая страница
    public int $y;
    public array $paper = [252, 250, 244];
    public array $navy  = [18, 34, 58];
    public array $gold  = [176, 135, 58];
    public array $ink   = [38, 38, 40];
    public array $muted = [96, 96, 104];

    public function __construct() { $this->newPage(); }

    public function contentW(): int { return $this->W - $this->mL - $this->mR; }

    public function newPage(): void {
        $img = imagecreatetruecolor($this->W, $this->H);
        pl_gradient($img, [255, 254, 250], $this->paper);
        // тонкая двойная рамка
        pl_frame($img, 54, $this->gold, 2);
        $this->img = $img;
        $this->pages[] = $img;
        $this->y = $this->mT;
    }

    public function ensure(int $need): void {
        if ($this->y + $need > $this->H - $this->mB) $this->newPage();
    }

    public function spacer(int $px): void { $this->y += $px; }

    /** Заголовок раздела с номером. */
    public function heading(string $num, string $title): void {
        $this->ensure(90);
        $font = pl_font('serif-bold');
        $size = 25;
        // золотой номер в квадрате
        $bx = $this->mL; $by = $this->y;
        $c = imagecolorallocate($this->img, $this->navy[0], $this->navy[1], $this->navy[2]);
        imagefilledrectangle($this->img, $bx, $by, $bx + 44, $by + 44, $c);
        pl_text($this->img, $bx, $by + 33, 20, [255, 255, 255], pl_font('serif-bold'), $num, 'center', $bx + 44);
        pl_text($this->img, $bx + 62, $by + 33, $size, $this->navy, $font, mb_strtoupper($title, 'UTF-8'));
        $this->y += 56;
        pl_rule($this->img, $this->mL, $this->y, $this->W - $this->mR, [214, 200, 170], 1);
        $this->y += 26;
    }

    /** Абзац с переносом. */
    public function para(string $text, array $rgb = null, int $size = 22, int $lh = 32, string $font = null): void {
        $rgb = $rgb ?? $this->ink;
        $font = $font ?? pl_font('regular');
        $lines = pl_wrap($text, $size, $font, $this->contentW());
        foreach ($lines as $ln) {
            $this->ensure($lh);
            pl_text($this->img, $this->mL, $this->y + $size, $size, $rgb, $font, $ln);
            $this->y += $lh;
        }
    }

    /** Маркированный список. */
    public function bullets(array $items, int $size = 22, int $lh = 32): void {
        $font = pl_font('regular');
        foreach ($items as $it) {
            $lines = pl_wrap($it, $size, $font, $this->contentW() - 40);
            $first = true;
            foreach ($lines as $ln) {
                $this->ensure($lh);
                if ($first) {
                    $g = imagecolorallocate($this->img, $this->gold[0], $this->gold[1], $this->gold[2]);
                    imagefilledellipse($this->img, $this->mL + 8, $this->y + $size - 7, 9, 9, $g);
                    $first = false;
                }
                pl_text($this->img, $this->mL + 40, $this->y + $size, $size, $this->ink, $font, $ln);
                $this->y += $lh;
            }
        }
    }

    /** Строка «ключ: значение». */
    public function keyval(string $k, string $v, int $size = 22, int $lh = 34): void {
        $this->ensure($lh);
        $bf = pl_font('bold');
        pl_text($this->img, $this->mL, $this->y + $size, $size, $this->navy, $bf, $k . ':  ');
        $kw = (int) pl_text_w($size, $bf, $k . ':  ');
        $lines = pl_wrap($v, $size, pl_font('regular'), $this->contentW() - $kw);
        foreach ($lines as $i => $ln) {
            if ($i > 0) { $this->ensure($lh); $this->y += $lh; }
            pl_text($this->img, $this->mL + $kw, $this->y + $size, $size, $this->ink, pl_font('regular'), $ln);
        }
        $this->y += $lh;
    }
}

/** Главная функция генерации положения. */
function pdf_regulation(array $competition): string {
    try {
        $imgDir = BASE_PATH . '/public/assets/img/';
        $doc = new PdfFlow();

        $name   = (string)($competition['name'] ?? 'Конкурс');
        $type   = (($competition['type'] ?? 'international') === 'national') ? 'Всероссийский' : 'Международный';
        $isPaid = (int)($competition['is_paid'] ?? 0) === 1;
        $price  = (int)($competition['price'] ?? 0);
        $start  = $competition['start_date'] ?? null;
        $end    = $competition['end_date'] ?? null;
        $results= $competition['results_date'] ?? null;

        // активные номинации конкурса (json) либо весь справочник
        $activeNoms = [];
        if (!empty($competition['nominations'])) {
            $d = json_decode((string)$competition['nominations'], true);
            if (is_array($d)) $activeNoms = $d;
        }
        $allNoms = NOMINATIONS();
        if (!$activeNoms) $activeNoms = array_keys($allNoms);

        /* ---------- ШАПКА (раздел 1: реквизиты и правовые основания) ------- */
        $logos = [
            $imgDir . 'emblem_minkultury_rf.png',
            $imgDir . 'prokultura_pro_rf.png',
            $imgDir . 'logo_muzmir_main.png',
        ];
        // три логотипа в ряд по верху
        pl_image($doc->img, $logos[0], $doc->mL, 96, null, 96);
        pl_image($doc->img, $logos[2], $doc->W - $doc->mR - 96, 96, 96, 96);
        // центральный горизонтальный лого PROКультура
        if (is_file($imgDir . 'prokultura_pro_rf.png')) {
            pl_image($doc->img, $imgDir . 'prokultura_pro_rf.png', (int)($doc->W/2 - 150), 128, 300, null);
        }
        $doc->y = 214;
        pl_rule($doc->img, $doc->mL, $doc->y, $doc->W - $doc->mR, $doc->gold, 2);
        $doc->y += 26;

        pl_text($doc->img, $doc->mL, $doc->y + 22, 22, $doc->muted, pl_font('regular'),
                cfgv('org_full'), 'center', $doc->W - $doc->mR);
        $doc->y += 40;
        pl_text($doc->img, $doc->mL, $doc->y + 18, 17, $doc->muted, pl_font('regular'),
                'Регистрация ' . cfgv('org_reg'), 'center', $doc->W - $doc->mR);
        $doc->y += 54;

        pl_text_spaced($doc->img, $doc->mL, $doc->y + 40, 40, $doc->navy, pl_font('serif-bold'),
                'ПОЛОЖЕНИЕ', 6, 'center', $doc->W - $doc->mR);
        $doc->y += 66;
        pl_text($doc->img, $doc->mL, $doc->y + 24, 24, $doc->ink, pl_font('serif'),
                'о проведении ' . mb_strtolower($type, 'UTF-8') . ' онлайн-конкурса', 'center', $doc->W - $doc->mR);
        $doc->y += 42;
        foreach (pl_wrap('«' . trim($name, '«»') . '»', 30, pl_font('serif-bold'), $doc->contentW()) as $ln) {
            pl_text($doc->img, $doc->mL, $doc->y + 30, 30, $doc->gold, pl_font('serif-bold'), $ln, 'center', $doc->W - $doc->mR);
            $doc->y += 44;
        }
        $doc->y += 10;
        pl_rule($doc->img, (int)($doc->W/2 - 80), $doc->y, (int)($doc->W/2 + 80), $doc->gold, 2);
        $doc->y += 34;

        $doc->para('Настоящее Положение разработано в соответствии с Главой 57 «Публичный конкурс» '
            . 'Гражданского кодекса Российской Федерации и Указом Президента Российской Федерации '
            . '№808 от 24 декабря 2014 года «Об утверждении Основ государственной культурной политики». '
            . 'Положение определяет цели, задачи, порядок организации и проведения конкурса, '
            . 'условия участия и требования к конкурсным материалам.', $doc->muted, 21, 31);
        $doc->spacer(24);

        /* ---------- 2. Общие положения ---------- */
        $doc->heading('2', 'Общие положения');
        $doc->keyval('Организатор', cfgv('org_full') . ', ' . cfgv('org_address'));
        $doc->keyval('Статус конкурса', $type . ' онлайн-конкурс культуры и искусства');
        $doc->keyval('Форма проведения', 'Заочная (дистанционная), по видеозаписям и материалам участников');
        $doc->para('К участию приглашаются исполнители, коллективы и авторы независимо от места проживания. '
            . 'Участие в конкурсе означает согласие с условиями настоящего Положения.');
        $doc->spacer(20);

        /* ---------- 3. Цели и задачи ---------- */
        $doc->heading('3', 'Цели и задачи');
        $doc->bullets([
            'Поддержка и развитие талантов, сохранение культурных традиций народов России.',
            'Создание условий для творческого роста участников любого возраста.',
            'Выявление и поощрение одарённых исполнителей, коллективов и педагогов.',
            'Укрепление культурных связей и обмен творческим опытом между регионами.',
        ]);
        $doc->spacer(20);

        /* ---------- 4. Участники и возрастные категории ---------- */
        $doc->heading('4', 'Участники и возрастные категории');
        $doc->para('В конкурсе участвуют солисты и творческие коллективы (дуэт, ансамбль, хор). '
            . 'Возраст участника определяется на дату подачи заявки. Установлены категории:');
        $doc->spacer(8);
        $ages = AGE_CATEGORIES();
        $rows = array_chunk($ages, 3);
        foreach ($rows as $r) $doc->bullets([implode('     •     ', $r)], 21, 30);
        $doc->spacer(20);

        /* ---------- 5. Номинации ---------- */
        $doc->heading('5', 'Номинации');
        $doc->para('Конкурс проводится по следующим номинациям и их подразделам:');
        $doc->spacer(8);
        foreach ($activeNoms as $nom) {
            $subs = $allNoms[$nom] ?? [];
            $line = $nom;
            if ($subs) $line .= ' — ' . implode(', ', $subs) . '.';
            $doc->bullets([$line], 21, 30);
        }
        $doc->spacer(20);

        /* ---------- 6. Сроки проведения ---------- */
        $doc->heading('6', 'Сроки проведения');
        $doc->keyval('Приём заявок', $start ? ('с ' . ru_date($start) . ($end ? ' по ' . ru_date($end) : '')) : 'по графику на странице конкурса');
        if ($results) $doc->keyval('Публикация результатов', ru_date($results));
        $doc->keyval('Формат результатов', 'Наградные материалы направляются на электронную почту участника');
        $doc->spacer(20);

        /* ---------- 7. Условия участия и порядок подачи заявки ---------- */
        $doc->heading('7', 'Условия участия и подача заявки');
        $doc->bullets([
            'Заявка подаётся на сайте организатора через форму выбранного конкурса.',
            'Один участник может подать несколько заявок в разных номинациях.',
            'Все поля заявки заполняются на русском языке, без сокращений.',
            'После проверки заявки участник получает подтверждение на электронную почту.',
        ]);
        $doc->spacer(20);

        /* ---------- 8. Требования к конкурсным материалам ---------- */
        $doc->heading('8', 'Требования к конкурсным материалам');
        $doc->para('Конкурсная работа предоставляется в виде ссылки на видеозапись или файл. '
            . 'Ссылка должна быть открыта для просмотра в течение всего периода проведения конкурса.');
        $doc->spacer(6);
        $allowed = array_values(array_unique(array_values(ALLOWED_PLATFORMS())));
        $doc->keyval('Разрешённые платформы', implode(', ', $allowed));
        $blocked = array_map(fn($d) => ucfirst(explode('.', $d)[0]), BLOCKED_PLATFORMS());
        $doc->keyval('Запрещённые платформы', implode(', ', array_values(array_unique($blocked))));
        $doc->para('Материалы низкого технического качества, с посторонней рекламой или нарушающие '
            . 'авторские права к участию не допускаются.');
        $doc->spacer(20);

        /* ---------- 9. Критерии и система оценивания ---------- */
        $doc->heading('9', 'Критерии и система оценивания');
        $doc->para('Работы оценивает жюри по 10-балльной шкале. Учитываются техника исполнения, '
            . 'артистизм, соответствие репертуара возрасту, целостность и художественный образ. '
            . 'Итоговый балл определяет присуждаемое звание:');
        $doc->spacer(10);
        foreach (GRADE_SCALE() as [$lo, $hi, $title]) {
            $range = ($title === 'ГРАН-ПРИ') ? '10 баллов' : "$lo-$hi баллов";
            $doc->ensure(34);
            $bf = pl_font('bold');
            pl_text($doc->img, $doc->mL + 40, $doc->y + 22, 22, $doc->gold, $bf, $title);
            pl_text($doc->img, $doc->mL, $doc->y + 22, 22, $doc->muted, pl_font('regular'), $range, 'right', $doc->W - $doc->mR);
            $doc->y += 36;
        }
        $doc->spacer(20);

        /* ---------- 10. Награждение ---------- */
        $doc->heading('10', 'Награждение');
        $doc->bullets([
            'Все участники получают именные наградные документы в электронном виде.',
            'Победителям присваиваются звания Лауреата, Дипломанта и Гран-при.',
            'По желанию оформляется оригинал диплома, кубок, статуэтка или медаль.',
            'Педагоги и концертмейстеры отмечаются благодарственными письмами.',
        ]);
        $doc->spacer(20);

        /* ---------- 11. Организационный взнос ---------- */
        $doc->heading('11', 'Организационный взнос');
        if ($isPaid && $price > 0) {
            $doc->keyval('Взнос за заявку', money($price));
            $doc->para('Организационный взнос направляется на покрытие расходов по проведению конкурса, '
                . 'работе жюри и изготовлению наградных материалов. Оплата производится после подтверждения заявки.');
        } else {
            $doc->para('Участие в конкурсе бесплатное. Электронные наградные документы предоставляются '
                . 'без взимания платы. Изготовление оригиналов наградной продукции оплачивается отдельно по желанию участника.');
        }
        $doc->spacer(20);

        /* ---------- 12. Авторские права и персональные данные ---------- */
        $doc->heading('12', 'Авторские права и персональные данные');
        $doc->para('Направляя заявку, участник подтверждает авторские (смежные) права на представленный '
            . 'материал и даёт согласие на обработку персональных данных в целях проведения конкурса '
            . 'в соответствии с Федеральным законом №152-ФЗ «О персональных данных». Организатор не передаёт '
            . 'данные третьим лицам, кроме случаев, предусмотренных законодательством.');
        $doc->spacer(20);

        /* ---------- 13. Контакты ---------- */
        $doc->heading('13', 'Контакты организатора');
        $doc->keyval('Организация', cfgv('org_name'));
        $doc->keyval('Адрес', cfgv('org_address'));
        $doc->keyval('Телефон', cfgv('org_phone'));
        $doc->keyval('Электронная почта', cfgv('org_email'));
        $doc->keyval('Режим работы', cfgv('org_hours'));
        $doc->spacer(40);

        /* ---------- Подвал: печать + подписи ---------- */
        $doc->ensure(220);
        $fy = $doc->y + 20;
        pl_rule($doc->img, $doc->mL, $fy, $doc->W - $doc->mR, $doc->gold, 2);
        $fy += 40;
        pl_text($doc->img, $doc->mL, $fy + 22, 22, $doc->navy, pl_font('serif-bold'), 'Оргкомитет', 'left');
        pl_text($doc->img, $doc->mL, $fy + 60, 19, $doc->muted, pl_font('regular'), cfgv('org_full'));
        // подпись
        if (is_file($imgDir . 'podpis_albert.png'))
            pl_image($doc->img, $imgDir . 'podpis_albert.png', $doc->mL + 20, $fy + 66, 200, null);
        // печать справа (полупрозрачно)
        if (is_file($imgDir . 'pechat_kc_muzmir.png'))
            pl_image($doc->img, $imgDir . 'pechat_kc_muzmir.png', $doc->W - $doc->mR - 190, $fy - 6, 180, 180, 88);

        // сохранение
        $slug = $competition['slug'] ?? pl_slug($name);
        $out = BASE_PATH . '/public/polozhenie_' . pl_slug((string)$slug) . '.pdf';
        pl_pdf_from_images($doc->pages, $out, 150, 92);
        foreach ($doc->pages as $p) @imagedestroy($p);
        return $out;
    } catch (\Throwable $e) {
        error_log('pdf_regulation: ' . $e->getMessage());
        return '';
    }
}
