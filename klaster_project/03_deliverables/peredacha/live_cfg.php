<?php
// Выдёргиваем боевые значения сайта в JSON рядом, чтобы сборщик страницы их взял.
$c = require '/var/www/klaster-site/api/config.php';
$о = [];
foreach (['TG_TOKEN','TG_IDS','GMAIL','GMAIL_APP','NOTIFY_EMAIL'] as $k) $о[$k] = (string)($c[$k] ?? '');
file_put_contents('/opt/oko-poster/peredacha/live_cfg.json', json_encode($о, JSON_UNESCAPED_UNICODE));
echo "значений перенесено: ".count(array_filter($о))."\n";
