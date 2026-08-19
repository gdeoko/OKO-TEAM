<?php
/**
 * core/partner_docs.php — генерация PDF партнёрских документов через bastion.
 * Сертификат и благодарности рисуются во временных HTML-эндпоинтах
 * (/tests/partner-cert.php, /tests/partner-thanks.php), которые печатаются
 * Playwright'ом на bastion (тот же путь, что и у дипломов/club_cert).
 */
declare(strict_types=1);

if (!function_exists('cfgv')) require_once BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/diploma_render.php';
require_once BASE_PATH . '/core/partner.php';

/**
 * Общий вызов bastion Playwright: рисует URL в PDF, копирует на прод по SCP.
 * Возвращает абсолютный путь к готовому PDF или null.
 */
function partner_render_pdf(string $url, string $outPath): ?string {
    $poster = rtrim((string) cfgv('poster_url'), '/');
    $token  = (string) cfgv('poster_token');
    $sshPas = (string) cfgv('vps_ssh_pass');
    if ($poster === '' || $token === '' || $sshPas === '') return null;

    $outDir = dirname($outPath);
    if (!is_dir($outDir)) @mkdir($outDir, 0775, true);
    @unlink($outPath);

    $tmp = '/tmp/prtdoc_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
    $cmd = 'cd /opt/oko-poster && NODE_PATH=/opt/oko-poster/node_modules node render_diploma.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp) . ' 297mm 210mm'
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($outPath)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo RENDER_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!is_string($resp) || !str_contains($resp, 'RENDER_OK')) return null;
    clearstatcache(true, $outPath);
    if (!is_file($outPath) || filesize($outPath) < 20000) return null;
    if (function_exists('diploma_compress_pdf')) diploma_compress_pdf($outPath);
    clearstatcache(true, $outPath);
    return $outPath;
}

/** PDF-путь для сертификата партнёра. */
function partner_cert_pdf_path(string $partnerNo): string {
    return BASE_PATH . '/public/diplomas/partner_cert_'
         . preg_replace('~[^0-9a-zA-Z]~', '-', $partnerNo) . '.pdf';
}

/**
 * Сгенерировать сертификат партнёра (кэш на 30 дней; regen=true — пересобрать).
 */
function partner_cert_pdf(int $instId, bool $regen = false): ?string {
    partner_migrate();
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    if (!$inst || ($inst['partner_status'] ?? '') !== 'accepted') return null;
    $no = (string) ($inst['partner_no'] ?? '');
    if ($no === '') return null;

    $out = partner_cert_pdf_path($no);
    if (!$regen && is_file($out) && filesize($out) > 20000 && (time() - (int) filemtime($out)) < 30 * 86400) {
        return $out;
    }

    $since = $inst['partner_accepted_at'] !== ''
        ? date('d.m.Y', strtotime((string) $inst['partner_accepted_at']))
        : date('d.m.Y');
    $till  = date('d.m.Y', strtotime($inst['partner_accepted_at'] ?: 'now') + 365 * 86400);

    $url = rtrim((string) cfgv('base_url'), '/') . '/tests/partner-cert.php?key=' . diploma_render_key()
         . '&org=' . rawurlencode((string) $inst['name'])
         . '&reg=' . rawurlencode((string) $inst['region'])
         . '&no='  . rawurlencode($no)
         . '&since=' . rawurlencode($since)
         . '&till='  . rawurlencode($till);

    return partner_render_pdf($url, $out);
}

/**
 * PDF-путь для благодарности.
 *
 * Номер кириллический ('...-П1' у педагога, '...-Р1' у руководителя), и обе
 * буквы в имени файла превращались в один и тот же дефис: документы писались в
 * ОДИН файл, а второй по счёту отдавался из кэша с чужими ФИО и ролью.
 * Модификатор /u этого не лечит (кириллица всё равно не [0-9a-zA-Z]), поэтому
 * различие обеспечивает хэш полного номера, а читаемая часть остаётся для глаз.
 */
function partner_thanks_pdf_path(string $docNumber): string {
    $slug = (string) preg_replace('~-{2,}~', '-', (string) preg_replace('~[^0-9a-zA-Z]~u', '-', $docNumber));
    $slug = trim($slug, '-');
    if ($slug === '') $slug = 'doc';
    return BASE_PATH . '/public/diplomas/partner_thanks_'
         . $slug . '_' . substr(sha1($docNumber), 0, 12) . '.pdf';
}

/**
 * Сгенерировать благодарность для конкретной записи partner_thanks (id).
 * Обновляет partner_thanks.doc_path и status='generated'. Возвращает путь к PDF.
 */
function partner_thanks_pdf(int $thanksId, bool $regen = false): ?string {
    partner_migrate();
    $t = one("SELECT * FROM partner_thanks WHERE id=?", [$thanksId]);
    if (!$t) return null;
    $inst = one("SELECT * FROM institutions WHERE id=?", [(int) $t['institution_id']]);
    if (!$inst) return null;

    $docNumber = (string) $t['doc_number'];
    if ($docNumber === '') return null;

    $out = partner_thanks_pdf_path($docNumber);
    if (!$regen && is_file($out) && filesize($out) > 20000) {
        try { q("UPDATE partner_thanks SET doc_path=?, status=CASE WHEN status='queued' THEN 'generated' ELSE status END WHERE id=?", [$out, $thanksId]); } catch (\Throwable $e) {}
        return $out;
    }

    $url = rtrim((string) cfgv('base_url'), '/') . '/tests/partner-thanks.php?key=' . diploma_render_key()
         . '&fio='   . rawurlencode((string) $t['fio'])
         . '&role='  . rawurlencode((string) $t['role'])
         . '&org='   . rawurlencode((string) $inst['name'])
         . '&reg='   . rawurlencode((string) $inst['region'])
         . '&no='    . rawurlencode((string) $inst['partner_no'])
         . '&docno=' . rawurlencode($docNumber);

    $pdf = partner_render_pdf($url, $out);
    if ($pdf) {
        try {
            q("UPDATE partner_thanks SET doc_path=?, status='generated' WHERE id=?", [$pdf, $thanksId]);
            q("INSERT OR REPLACE INTO partner_docs (number, kind, institution_id, org, region, fio, issued_at, valid_until)
               VALUES (?, ?, ?, ?, ?, ?, ?, '')",
              [$docNumber, ($t['role'] === 'manager' ? 'thanks_manager' : 'thanks_teacher'),
               (int) $t['institution_id'], (string) $inst['name'], (string) $inst['region'],
               (string) $t['fio'], date('Y-m-d H:i:s')]);
        } catch (\Throwable $e) {}
    }
    return $pdf;
}

/**
 * Следующий свободный номер благодарности: БЛГ-ИП-YYYY-NNNNN-Р1/П1.
 * Для manager: Р1/Р2/Р3, для teacher: П1/П2/…
 */
function partner_thanks_next_no(int $instId, string $role): string {
    partner_migrate();
    $inst = one("SELECT partner_no FROM institutions WHERE id=?", [$instId]);
    if (!$inst) return 'БЛГ-ИП-0000-00000-X0';
    $base = 'БЛГ-' . (string) $inst['partner_no'];
    $letter = ($role === 'manager') ? 'Р' : 'П';
    $prefix = $base . '-' . $letter;
    // Хвост номера отсчитываем ПО ДЛИНЕ ПРЕФИКСА, а не поиском буквы: partner_no
    // начинается с «ИП-», и INSTR находил «П» внутри него. У педагогов вместо П2
    // выходило «П-2025», следующий вызов повторял тот же номер и падал на UNIQUE,
    // а вызывающий код глотает исключение, и благодарность терялась молча.
    $off = mb_strlen($prefix, 'UTF-8') + 1;
    try {
        $max = (int) (scalar(
            "SELECT COALESCE(MAX(CAST(SUBSTR(doc_number, ?) AS INTEGER)), 0)
             FROM partner_thanks
             WHERE institution_id=? AND role=? AND doc_number LIKE ?",
            [$off, $instId, $role, $prefix . '%']) ?? 0);
    } catch (\Throwable $e) { $max = 0; }
    if ($max < 0) $max = 0;   // наследие сломанной нумерации («П-2025») не должно тянуть счётчик в минус
    // Если номер всё-таки занят, берём следующий свободный: UNIQUE на doc_number
    // иначе снова уронит INSERT, и педагог не попадёт в очередь.
    $n = $max + 1;
    for ($i = 0; $i < 100; $i++) {
        try { $busy = one("SELECT id FROM partner_thanks WHERE doc_number=?", [$prefix . $n]); }
        catch (\Throwable $e) { break; }
        if (!$busy) break;
        $n++;
    }
    return $prefix . $n;
}
