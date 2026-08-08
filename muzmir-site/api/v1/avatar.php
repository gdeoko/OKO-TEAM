<?php
/**
 * Загрузка фото профиля участника.
 *
 * Раньше фото готовилось только в браузере (canvas → base64) и уезжало гигантской
 * строкой внутри формы профиля: не было видно, что идёт загрузка, при любой осечке
 * (не декодировался HEIC, перезагрузилась страница по сигналу сервис-воркера,
 * не отправилась форма) фото молча пропадало, а сама строка на 200 КБ потом
 * подставлялась в КАЖДУЮ страницу, где показывается аватар.
 *
 * Теперь файл уходит сюда сразу при выборе: сервер сам уменьшает и сжимает его
 * через GD, кладёт в public/uploads/avatars/ и записывает в users.avatar КОРОТКИЙ
 * URL. Фото видно сразу, до нажатия «Сохранить», и оно одно и то же во всех
 * разделах сайта и админки, потому что источник один — users.avatar.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!csrf_check()) json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

/* ── Удаление фото ── */
if ((string) input('action') === 'delete') {
    avatar_drop_files($uid);
    update('users', ['avatar' => ''], 'id=:id', ['id' => $uid]);
    audit('avatar_delete', 'user', $uid);
    json_out(['ok' => true, 'url' => '']);
}

/* ── Приём файла ── */
$f = $_FILES['photo'] ?? null;
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $code = is_array($f) ? (int) ($f['error'] ?? -1) : -1;
    $msg = match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Файл слишком большой.',
        UPLOAD_ERR_NO_FILE => 'Файл не выбран.',
        UPLOAD_ERR_PARTIAL => 'Файл долетел не полностью — попробуйте ещё раз.',
        default => 'Не удалось принять файл.',
    };
    json_out(['ok' => false, 'error' => $msg], 400);
}
if ((int) $f['size'] > 12 * 1024 * 1024) {
    json_out(['ok' => false, 'error' => 'Фото больше 12 МБ. Выберите файл поменьше.'], 400);
}

$src = (string) $f['tmp_name'];
if (!is_uploaded_file($src)) json_out(['ok' => false, 'error' => 'Не удалось принять файл.'], 400);

$info = @getimagesize($src);
if (!$info || empty($info[0])) {
    // Сюда попадают HEIC/HEIF с айфонов и «битые» файлы — раньше это была тихая осечка.
    json_out(['ok' => false, 'error' => 'Не удалось прочитать это изображение. Подойдут JPG, PNG или WEBP.'], 415);
}
[$w, $h] = [(int) $info[0], (int) $info[1]];
$mime = (string) ($info['mime'] ?? '');

$img = match ($mime) {
    'image/jpeg' => @imagecreatefromjpeg($src),
    'image/png'  => @imagecreatefrompng($src),
    'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : null,
    'image/gif'  => @imagecreatefromgif($src),
    default      => null,
};
if (!$img) json_out(['ok' => false, 'error' => 'Формат не поддерживается. Подойдут JPG, PNG или WEBP.'], 415);

// Поворот по EXIF: снятое с телефона иначе ложится набок.
if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
    $ex = @exif_read_data($src);
    $or = (int) ($ex['Orientation'] ?? 0);
    if ($or === 3)      $img = imagerotate($img, 180, 0);
    elseif ($or === 6)  $img = imagerotate($img, -90, 0);
    elseif ($or === 8)  $img = imagerotate($img, 90, 0);
    if ($or === 6 || $or === 8) { [$w, $h] = [$h, $w]; }
}

// Квадратная обрезка по центру + уменьшение до 512 — аватар везде круглый.
$side = min($w, $h);
$sx = (int) (($w - $side) / 2);
$sy = (int) (($h - $side) / 2);
$out = min(512, $side);
$dst = imagecreatetruecolor($out, $out);
imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
imagecopyresampled($dst, $img, 0, 0, $sx, $sy, $out, $out, $side, $side);
imagedestroy($img);

$dir = BASE_PATH . '/public/uploads/avatars';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$name = 'u' . $uid . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.jpg';
$path = $dir . '/' . $name;
// Пишем во временный файл и переименовываем — на диск не попадёт полуготовый JPEG.
$tmp = $path . '.tmp';
$okWrite = @imagejpeg($dst, $tmp, 86);
imagedestroy($dst);
if (!$okWrite || !is_file($tmp)) {
    @unlink($tmp);
    json_out(['ok' => false, 'error' => 'Не удалось сохранить фото на сервере.'], 500);
}
@chmod($tmp, 0664);
if (!@rename($tmp, $path)) { @unlink($tmp); json_out(['ok' => false, 'error' => 'Не удалось сохранить фото на сервере.'], 500); }

avatar_drop_files($uid, $name);            // старые файлы этого участника — убрать
$url = rtrim((string) cfgv('base_url'), '/') . '/uploads/avatars/' . $name;
update('users', ['avatar' => $url], 'id=:id', ['id' => $uid]);
audit('avatar_upload', 'user', $uid);

json_out(['ok' => true, 'url' => $url]);

/** Удаляет прежние файлы аватара участника (кроме $keep). */
function avatar_drop_files(int $uid, string $keep = ''): void {
    $dir = BASE_PATH . '/public/uploads/avatars';
    foreach (glob($dir . '/u' . $uid . '_*.jpg') ?: [] as $old) {
        if ($keep !== '' && basename($old) === $keep) continue;
        @unlink($old);
    }
}
