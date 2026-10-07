<?php
/* Обозреватель архива передачи: дерево папок и файлов с прямыми ссылками.
   Пароль тот же, что у страницы передачи. Файлы лежат вне веб-корня. */
declare(strict_types=1);

const ПАРОЛЬ = 'Klaster-2026-Peredacha';
const АРХИВ  = '/opt/oko-poster/peredacha/arhiv';

$ключ = isset($_GET['k']) ? (string)$_GET['k'] : (isset($_COOKIE['klp']) ? (string)$_COOKIE['klp'] : '');
if (!hash_equals(ПАРОЛЬ, $ключ)) {
    http_response_code(401);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Архив</title><p style="font:16px sans-serif;padding:24px">Нужен пароль.</p>';
    exit;
}
setcookie('klp', ПАРОЛЬ, time() + 60 * 60 * 24 * 14, '/peredacha/', '', true, true);

$под = isset($_GET['dir']) ? (string)$_GET['dir'] : '';
$корень = realpath(АРХИВ);
$тек = realpath(АРХИВ . '/' . $под);
if ($тек === false || strpos($тек, $корень) !== 0 || !is_dir($тек)) { $тек = $корень; $под = ''; }

function вес(int $b): string
{
    if ($b >= 1048576) return number_format($b / 1048576, 1, ',', ' ') . ' МБ';
    if ($b >= 1024) return number_format($b / 1024, 0, ',', ' ') . ' КБ';
    return $b . ' Б';
}

$папки = [];
$файлы = [];
foreach (scandir($тек) ?: [] as $и) {
    if ($и === '.' || $и === '..') continue;
    $п = $тек . '/' . $и;
    if (is_dir($п)) {
        $n = 0; $s = 0;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($п, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $ф) { if ($ф->isFile()) { $n++; $s += $ф->getSize(); } }
        $папки[] = ['имя' => $и, 'файлов' => $n, 'байт' => $s];
    } else {
        $файлы[] = ['имя' => $и, 'байт' => filesize($п)];
    }
}
usort($папки, fn($a, $b) => strcoll($a['имя'], $b['имя']));
usort($файлы, fn($a, $b) => strcoll($a['имя'], $b['имя']));

$отн = trim(str_replace($корень, '', $тек), '/');
$хлеб = $отн === '' ? [] : explode('/', $отн);
$к = rawurlencode(ПАРОЛЬ);
?><!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Архив материалов «Кластер»</title>
<style>
body{margin:0;background:#F4F2ED;color:#2B2B2A;font:16px/1.55 Manrope,-apple-system,"Segoe UI",Roboto,sans-serif}
.obl{max-width:880px;margin:0 auto;padding:0 16px 40px}
header{background:#3C3C3B;color:#fff;padding:22px 0}
header h1{margin:0;font:600 clamp(20px,5vw,26px)/1.2 Oswald,Manrope,sans-serif;text-transform:uppercase}
header p{margin:6px 0 0;color:rgba(255,255,255,.72);font-size:14px}
.put{margin:16px 0 10px;font-size:14px;color:#6E6B64}
.put a{color:#8A6200}
ul{list-style:none;margin:0;padding:0;background:#fff;border:1px solid #E6E3DC;border-radius:8px;overflow:hidden}
li{display:flex;align-items:center;gap:12px;padding:11px 14px;border-top:1px solid #EFEDE7}
li:first-child{border-top:0}
li .nm{flex:1;min-width:0;word-break:break-word}
li .nm a{color:#2B2B2A;text-decoration:none;font-weight:600}
li .nm a:hover{color:#8A6200;text-decoration:underline}
li .mt{color:#6E6B64;font-size:13px;white-space:nowrap}
.pp .nm a::before{content:"папка · ";color:#8A6200;font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.sk{color:#8A6200;font-size:13px;text-decoration:none;white-space:nowrap}
footer{color:#6E6B64;font-size:13px;margin-top:18px}
@media(max-width:560px){li{flex-wrap:wrap;gap:4px}li .mt{font-size:12px}}
</style></head><body>
<header><div class="obl"><h1>Архив материалов «Кластер»</h1>
<p>Все файлы проекта. Папки открываются, файлы скачиваются. Страница закрыта паролем.</p></div></header>
<div class="obl">
<div class="put"><a href="?k=<?= $к ?>">Архив</a><?php
$нак = '';
foreach ($хлеб as $ч) {
    $нак = $нак === '' ? $ч : $нак . '/' . $ч;
    echo ' / <a href="?k=' . $к . '&dir=' . rawurlencode($нак) . '">' . htmlspecialchars($ч) . '</a>';
}
?></div>
<ul>
<?php if ($отн !== ''): $вверх = dirname($отн); ?>
  <li class="pp"><span class="nm"><a href="?k=<?= $к ?>&dir=<?= rawurlencode($вверх === '.' ? '' : $вверх) ?>">наверх</a></span></li>
<?php endif; ?>
<?php foreach ($папки as $п): ?>
  <li class="pp"><span class="nm"><a href="?k=<?= $к ?>&dir=<?= rawurlencode(($отн === '' ? '' : $отн . '/') . $п['имя']) ?>"><?= htmlspecialchars($п['имя']) ?></a></span>
  <span class="mt"><?= $п['файлов'] ?> файлов · <?= вес($п['байт']) ?></span></li>
<?php endforeach; ?>
<?php foreach ($файлы as $ф): $рп = ($отн === '' ? '' : $отн . '/') . $ф['имя']; ?>
  <li><span class="nm"><a href="fayl.php?k=<?= $к ?>&p=<?= rawurlencode($рп) ?>" target="_blank" rel="noopener"><?= htmlspecialchars($ф['имя']) ?></a></span>
  <span class="mt"><?= вес($ф['байт']) ?></span>
  <a class="sk" href="fayl.php?k=<?= $к ?>&p=<?= rawurlencode($рп) ?>&d=1">скачать</a></li>
<?php endforeach; ?>
<?php if (!$папки && !$файлы): ?><li><span class="nm">пусто</span></li><?php endif; ?>
</ul>
<footer>Вернуться на <a href="/peredacha/klaster/?k=<?= $к ?>">страницу передачи</a>.</footer>
</div></body></html>
