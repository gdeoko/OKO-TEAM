<?php
/**
 * АФИША КОНКУРСА ОТ НАЧАЛА ДО КОНЦА, ОДНОЙ КОМАНДОЙ.
 *
 *   php scripts/afisha_make.php <id конкурса> [--diploma] [--dry]
 *
 * Что происходит:
 *   1. по карточке конкурса строится промпт (core/afisha_prompt.php);
 *   2. промпт уходит на бастион, там ChatGPT рисует афишу целиком, вместе с
 *      русским текстом и пустыми круглыми заглушками вместо гербов;
 *   3. картинка забирается на сайт;
 *   4. в заглушки вписываются НАСТОЯЩИЕ гербы (core/afisha_emblems.php);
 *   5. готовая афиша встаёт в карточку конкурса (competitions.cover).
 *
 * --diploma  дополнительно рисует фон диплома A4 в том же стиле;
 * --dry      только печатает промпт, ничего не генерирует и не трогает.
 *
 * ПОЧЕМУ ЧЕРЕЗ БАСТИОН. У подписки ChatGPT нет ключа API — работаем её
 * веб-кабинетом через браузер агента на бастионе (см. хранилище, раздел 15).
 * Сайт сам туда ходить не умеет и не должен: его дело — данные конкурса.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/afisha_prompt.php';
require_once BASE_PATH . '/core/afisha_emblems.php';
require_once BASE_PATH . '/core/bastion_cdp.php';

$cid = (int) ($argv[1] ?? 0);
$dry = in_array('--dry', $argv, true);
/* ПЛАТНАЯ ДОРОГА (слово владельца 16.10.2026, $0.04 за кадр).
   Бесплатный путь - браузер ChatGPT на бастионе, у него суточный потолок
   картинок бесплатного тарифа; 16.10 он кончился на пятой афише. С ключом
   --api лист рисует apimodels той же дверью, что и кадры ленты
   (`smm_make_image`), а всё после генерации - гербы, обрезка, карточка
   конкурса - идёт прежним общим путём. */
$viaApi = in_array('--api', $argv, true);
$withDiploma = in_array('--diploma', $argv, true);
if ($cid <= 0) { fwrite(STDERR, "Укажите id конкурса\n"); exit(1); }

$c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
if (!$c) { fwrite(STDERR, "Конкурс #$cid не найден\n"); exit(1); }

echo "Конкурс: {$c['name']}\n";
$prompt = afisha_prompt($c);
echo "Промпт: ", mb_strlen($prompt), " знаков, тема: ", afisha_theme_for($c)['name'], "\n";

if ($dry) { echo "\n----- ПРОМПТ -----\n$prompt\n"; exit(0); }

$poster = rtrim((string) cfgv('poster_url'), '/');
$token  = (string) cfgv('poster_token');
$sshPas = (string) cfgv('vps_ssh_pass');
if (!$viaApi && ($poster === '' || $token === '' || $sshPas === '')) {
    fwrite(STDERR, "Нет доступов к бастиону (poster_url / poster_token / vps_ssh_pass)\n");
    exit(1);
}

/**
 * Выполнить команду на бастионе и вернуть ТО, ЧТО ОНА НАПЕЧАТАЛА.
 *
 * Бастион отвечает не голым выводом, а конвертом {"exit":0,"stdout":…,"stderr":…}.
 * Первый заход этого не разбирал, и проверка «файл готов?» читала размер из
 * строки, начинающейся с фигурной скобки: получался ноль, картинка висела
 * готовая на диске, а скрипт семь минут ждал её и уходил ни с чем.
 */
$bastion = static function (string $cmd, int $timeout = 150) use ($poster, $token): string {
    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $r = curl_exec($ch);
    curl_close($ch);
    if (!is_string($r) || $r === '') return '';
    $d = json_decode($r, true);
    if (is_array($d) && array_key_exists('stdout', $d)) {
        return trim((string) $d['stdout']) . (trim((string) ($d['stderr'] ?? '')) !== ''
             ? "\n" . trim((string) $d['stderr']) : '');
    }
    return $r;   // не конверт — значит уже голый вывод
};

$dirRel = 'uploads/comp/' . $cid;
$dirAbs = BASE_PATH . '/public/' . $dirRel;
if (!is_dir($dirAbs)) @mkdir($dirAbs, 0775, true);

$tag = 'afisha_' . $cid . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
$rawRemote = '/opt/oko-poster/' . $tag . '.png';
$rawLocal  = $dirAbs . '/gen_' . $tag . '.png';

if ($viaApi) {
    /* ПЛАТНАЯ ДОРОГА. Дверь к apimodels одна на весь центр - `smm_make_image()`
       (кадры ленты), и второй копии разговора со службой тут не заводится.
       Референсов нет вовсе: в промпте афиши знака центра не просят, а лишняя
       картинка просится моделью в кадр наклейкой. */
    require_once BASE_PATH . '/core/smm.php';
    require_once BASE_PATH . '/core/smm_make.php';

    /* У АФИШИ СВОЙ КОШЕЛЁК, И ЭТО НЕ ПЕДАНТИЗМ. Расход ленты считается по
       колонке smm_posts.image_cost, а у афиши строки в ленте нет вовсе: её
       трата не видна нигде, и «дорого вышло» выяснялось бы по счёту в конце
       месяца. Поэтому свой предел на сутки и свой счётчик в настройках. */
    $__день  = date('Y-m-d');
    $__цена  = (float) setting('smm_image_cost', '0.04');
    $__пред  = (float) setting('afisha_budget_day', '0.5');
    $__было  = (float) (setting('afisha_rashod_' . $__день, '0') ?: 0);
    if ($__было + $__цена > $__пред) {
        fwrite(STDERR, "Суточный предел расхода на афиши исчерпан: потрачено $"
            . number_format($__было, 2) . " при пределе $" . number_format($__пред, 2) . "\n");
        exit(1);
    }

    echo "Рисую через apimodels (2K high, $", number_format($__цена, 2), ")…\n";
    [$__ok, $__err] = smm_make_image($prompt, '16:9', $rawLocal, '', []);
    if (!$__ok) {
        fwrite(STDERR, "Картинка не собралась: {$__err}\n");
        exit(1);
    }
    @chmod($rawLocal, 0664);
    set_setting('afisha_rashod_' . $__день, (string) round($__было + $__цена, 4));
    clearstatcache(true, $rawLocal);
    echo "  готово: ", (int) round((int) @filesize($rawLocal) / 1024), " КБ · на афиши за сутки $",
         number_format($__было + $__цена, 2), "\n";
} else {

/* Промпт кладём на бастион файлом: он длинный, в командную строку не влезает,
 * а драйвер и так читает его из файла (правило проекта — от 2000 знаков). */
echo "Отправляю промпт на бастион…\n";
$put = $bastion('cat > /opt/oko-poster/' . $tag . '.txt <<\'PROMPT_EOF\'' . "\n" . $prompt . "\nPROMPT_EOF\n"
              . 'wc -c < /opt/oko-poster/' . $tag . '.txt', 60);
echo "  промпт на месте: ", trim($put), " байт\n";

/* Генерация идёт две-пять минут — запускаем отвязанно и ждём файл, иначе мост
 * рвёт соединение по таймауту и мы теряем уже начатую работу. */
echo "Запускаю генерацию…\n";
/* ПОРТ БРАУЗЕРА СПРАШИВАЕМ У БАСТИОНА (core/bastion_cdp.php).
 *
 * По умолчанию gpt_image.mjs идёт на 9333, вкладки ChatGPT там нет, и генерация
 * падает по таймауту ожидания поля ввода - поэтому порт передаём явно. Вписан
 * он был числом 9222, и 16.10.2026 это оказалось неправдой: порты развели, вход
 * живёт на 9280, а на 9222 браузера нет вовсе. Шесть минут ожидания кончились
 * словами «Не дождался картинки», и настоящая причина нашлась только в логе
 * бастиона. Теперь порт ищется по факту: у кого открыт chatgpt.com, тот и наш. */
$bastion('cd /opt/oko-poster && CDP_URL=' . bastion_cdp_url($bastion) . ' nohup node gpt_image.mjs ' . $tag . '.txt ' . $rawRemote
       . ' 420 > /tmp/' . $tag . '.log 2>&1 & echo started', 60);

$ready = false;
for ($i = 0; $i < 40; $i++) {          // до ~7 минут
    sleep(10);
    $sz = (int) trim($bastion('stat -c%s ' . escapeshellarg($rawRemote) . ' 2>/dev/null || echo 0', 30));
    if ($sz > 100000) { $ready = true; echo "  готово: ", (int) round($sz / 1024), " КБ\n"; break; }
    if ($i % 6 === 5) echo "  жду… ", ($i + 1) * 10, " с\n";
}
if (!$ready) {
    echo "Не дождался картинки. Лог бастиона:\n";
    echo $bastion('tail -6 /tmp/' . $tag . '.log', 30), "\n";
    exit(1);
}

echo "Забираю на сайт…\n";
$scp = $bastion('export SSHPASS=' . escapeshellarg($sshPas)
    . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($rawRemote)
    . ' root@176.124.200.169:' . escapeshellarg($rawLocal)
    . ' && echo COPY_OK', 120);
clearstatcache(true, $rawLocal);
if (!str_contains($scp, 'COPY_OK') || !is_file($rawLocal)) {
    fwrite(STDERR, "Не удалось забрать картинку: " . substr($scp, 0, 200) . "\n");
    exit(1);
}
@chmod($rawLocal, 0664);

}   /* конец бесплатной дороги через бастион */

echo "Вписываю гербы…\n";
$logos = [
    'assets/img/emblem_minkultury_rf.png',
    'assets/img/emblem_minobrazovaniya.png',
    'assets/img/emblem_roskomnadzor.png',
    'assets/img/logo_rossia_nota.png',
    'assets/img/prokultura_dark.png',
    'assets/img/natsproekty_kultura.png',
];
$outRel = $dirRel . '/afisha.jpg';
$res = afisha_fill_emblems($rawLocal, $logos, BASE_PATH . '/public/' . $outRel);
echo "  заглушек найдено {$res['found']}, гербов вписано {$res['placed']}";
echo $res['error'] !== '' ? " — {$res['error']}\n" : "\n";

/* Если заглушки не нашлись, афишу всё равно сохраняем: текст и фон в ней уже
 * верные, а гербы владелец при желании вставит сам. Молча выбрасывать
 * пятиминутную генерацию — худший из вариантов. */
if (!$res['ok']) {
    $fallback = BASE_PATH . '/public/' . $outRel;
    if (@copy($rawLocal, preg_replace('~\.jpg$~', '.png', $fallback))) {
        echo "  сохранена без гербов: ", preg_replace('~\.jpg$~', '.png', $outRel), "\n";
    }
} else {
    q("UPDATE competitions SET cover=? WHERE id=?", [$outRel, $cid]);
    echo "Афиша в карточке конкурса: $outRel\n";
}

if (!$viaApi) $bastion('rm -f ' . escapeshellarg($rawRemote) . ' /opt/oko-poster/' . $tag . '.txt', 30);

if ($withDiploma) {
    echo "\nФон диплома пока делается отдельной командой — см. scripts/diploma_bg_make.php\n";
}

echo "Готово.\n";
