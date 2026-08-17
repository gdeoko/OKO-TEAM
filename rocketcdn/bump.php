<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · версии статики

   Браузер кеширует наши файлы надолго - и правильно делает. Беда
   в другом: index.html он мог взять свежий, а словарь языка или
   таблицу стилей отдать из кеша старые. Тогда на экране появляется
   служебный ключ вместо слова или ломается вёрстка.

   Скрипт проставляет каждой ссылке на свой файл метку версии по
   времени последней правки этого файла. Поменялся файл - поменялась
   метка, браузер забирает новое. Не поменялся - берёт из кеша, как
   и раньше.

   Запускать после каждой выкладки:  php bump.php
   ══════════════════════════════════════════════════════════ */

$root = __DIR__;
$pages = ['index.html', 'admin.html', 'app.html', 'splash.html', 'splash-lk.html', 'offer.html', 'privacy.html'];
$total = 0;

foreach ($pages as $page) {
    $file = $root . '/' . $page;
    if (!is_file($file)) continue;
    $html = file_get_contents($file);

    $html = preg_replace_callback(
        '~(src|href)="(assets/[^"?#]+\.(?:js|css))(\?v=[0-9]+)?"~',
        function ($m) use ($root, &$total) {
            $target = $root . '/' . $m[2];
            if (!is_file($target)) return $m[0];
            $total++;
            return $m[1] . '="' . $m[2] . '?v=' . filemtime($target) . '"';
        },
        $html
    );

    file_put_contents($file, $html);
    echo $page . ": готово\n";
}
echo "ссылок проштамповано: {$total}\n";
