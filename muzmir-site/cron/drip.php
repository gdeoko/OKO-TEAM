<?php
/**
 * Drip-цепочка для новых подписчиков КЦ «Музыкальный Мир». Запуск: раз в день.
 *
 * День 1 (welcome) — уже отправляется при регистрации (templates/emails/welcome.php),
 * здесь НЕ дублируется. Эта цепочка досылает два письма по расписанию:
 *
 *   Шаг 2 (день 3)  — «Как подать заявку и требования к видео» (по GROUND_TRUTH).
 *   Шаг 3 (день 7)  — «Действующие конкурсы» (список открытых конкурсов из БД).
 *
 * Отслеживание шага — БЕЗ изменения схемы: тег в subscribers.tags
 * (drip_d3 / drip_d7). Повторно тот же шаг подписчику не уходит (идемпотентно).
 * Окно рассылки ограничено, чтобы не «добивать» письмами старых подписчиков,
 * заведённых до появления цепочки, и при этом дать догоняющий запас на день.
 *
 * Письма кладутся в mail_queue — реальную отправку с учётом суточного лимита Gmail
 * делает cron/process_newsletter_queue.php. Тон: официально-тёплый, на «Вы», без эмодзи.
 *
 * Запуск: php cron/drip.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once __DIR__ . '/_lib.php';
// Движок рассылок: даёт фирменную обёртку письма (nl_wrap_email) и unsub-токен.
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';

const JOB = 'drip';
/** Максимум писем на один шаг за запуск (суточный лимит Gmail всё равно держит воркер очереди). */
const DRIP_CAP = 200;

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Есть ли у подписчика тег шага (в subscribers.tags хранится CSV). */
function drip_has_tag(?string $tags, string $tag): bool {
    if (!$tags) return false;
    foreach (explode(',', $tags) as $t) {
        if (trim($t) === $tag) return true;
    }
    return false;
}

/** Идемпотентно дописывает тег шага подписчику (не трогая остальные теги). */
function drip_tag_add(int $subId, string $tag): void {
    $cur  = (string) scalar("SELECT tags FROM subscribers WHERE id=?", [$subId]);
    $list = array_values(array_filter(array_map('trim', explode(',', $cur)), fn($v) => $v !== ''));
    if (!in_array($tag, $list, true)) {
        $list[] = $tag;
        update('subscribers', ['tags' => implode(',', $list)], 'id=:id', ['id' => $subId]);
    }
}

/** Ссылка отписки по токену — тот же механизм, что у рассылок и напоминаний. */
function drip_unsub_url(string $token): string {
    return rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php?token=' . urlencode($token);
}

/** CTA-кнопка письма (фирменная тёплая палитра). */
function drip_button(string $url, string $label): string {
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">'
        . '<tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">'
        . '<a href="' . h($url) . '" style="display:inline-block;padding:14px 34px;color:#ffffff;'
        . 'text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">' . h($label) . '</a>'
        . '</td></tr></table>';
}

/** Обёртка + постановка письма в очередь. Возвращает true при успехе. */
function drip_enqueue(array $sub, string $subject, string $innerHtml, string $preheader): bool {
    $email = mb_strtolower(trim((string) $sub['email']));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;

    $token = (string) ($sub['unsub_token'] ?? '');
    if ($token === '' && function_exists('nl_ensure_subscriber')) {
        try { [$token, ] = nl_ensure_subscriber($email, (string) ($sub['name'] ?? ''), 'drip'); }
        catch (\Throwable $e) { $token = ''; }
    }
    $unsub = $token !== ''
        ? drip_unsub_url($token)
        : rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php';

    $html = function_exists('nl_wrap_email')
        ? nl_wrap_email($innerHtml, $unsub, '', $preheader)
        : $innerHtml;

    if (!function_exists('mail_queue')) return false;
    return mail_queue($email, (string) ($sub['name'] ?? ''), $subject, $html) > 0;
}

/* ---------- Тела писем ---------- */

/** Шаг 2 (день 3): как подать заявку и требования к конкурсному материалу. */
function drip_body_apply(string $name): string {
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $apply = function_exists('url') ? url('/apply') : '/apply';
    $faq   = function_exists('url') ? url('/voprosi') : '/voprosi';
    $rowLbl = 'style="font-weight:600;color:#7a2e1e;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px;"';
    return <<<HTML
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Как подать заявку</h1>
<p style="margin:0 0 14px;">{$hello}</p>
<p style="margin:0 0 16px;">Рассказываем, как принять участие в конкурсах культурного центра «Музыкальный Мир»
и на что обратить внимание при подготовке конкурсного материала, чтобы работу приняли без замечаний.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.85;color:#5a4632;">
    <div {$rowLbl}>Порядок подачи</div>
    <div><span style="color:#a0522d;">1.</span> Выберите конкурс и номинацию на сайте центра.</div>
    <div><span style="color:#a0522d;">2.</span> Заполните форму заявки: данные участника, номинация, возрастная категория.</div>
    <div><span style="color:#a0522d;">3.</span> Приложите ссылку на конкурсный материал (видео) или фото работы.</div>
    <div style="margin-top:6px;color:#8a7658;">Одна заявка — один конкурсный номер.</div>
  </td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.85;color:#5a4632;">
    <div {$rowLbl}>Требования к видео</div>
    <div><span style="color:#a0522d;">•</span> Запись без монтажа, склеек, стоп-кадров и спецэффектов, без остановки камеры.</div>
    <div><span style="color:#a0522d;">•</span> Качество не ниже 480p, запись сделана не ранее чем за один год.</div>
    <div><span style="color:#a0522d;">•</span> Ссылки принимаются только на: <b style="color:#7a2e1e;">RuTube, Google Диск, Яндекс&nbsp;Диск, OK&nbsp;видео, VK&nbsp;видео, Дзен&nbsp;видео</b>.</div>
    <div><span style="color:#a0522d;">•</span> Не принимаются ссылки на Instagram, Facebook, TikTok, YouTube и мессенджеры.</div>
  </td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.85;color:#5a4632;">
    <div {$rowLbl}>Фото- и изобразительные работы</div>
    <div><span style="color:#a0522d;">•</span> Чёткое фото или скан под прямым углом, без бликов и фильтров — в кадре только само полотно.</div>
  </td></tr>
</table>

HTML
    . drip_button($apply, 'Подать заявку')
    . '<p style="margin:18px 0 0;font-size:13px;color:#8a7658;">Остались вопросы? Ответы на частые из них — в разделе '
    . '<a href="' . h($faq) . '" style="color:#a0522d;text-decoration:underline;">справки на сайте</a>.</p>';
}

/** Шаг 3 (день 7): действующие конкурсы. $comps — открытые конкурсы из БД. */
function drip_body_competitions(string $name, array $comps): string {
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $all   = function_exists('url') ? url('/competitions') : '/competitions';

    $items = '';
    foreach ($comps as $c) {
        $typeRu = ($c['type'] ?? '') === 'national' ? 'Всероссийский' : 'Международный';
        $end    = !empty($c['end_date']) && function_exists('ru_date') ? ru_date((string) $c['end_date']) : '';
        $price  = (int) ($c['is_paid'] ?? 0) === 1
            ? 'оргвзнос ' . (int) ($c['price'] ?? 0) . ' ₽'
            : 'участие бесплатное';
        $link   = function_exists('url') ? url('/competition/' . ($c['slug'] ?? '')) : '/competition/' . ($c['slug'] ?? '');
        $items .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#f6ecdb;border-radius:14px;">'
            . '<tr><td style="padding:18px 22px;font-size:14px;line-height:1.7;color:#5a4632;">'
            . '<div style="font-weight:700;color:#7a2e1e;font-size:16px;margin-bottom:4px;">'
            . '<a href="' . h($link) . '" style="color:#7a2e1e;text-decoration:none;">' . h((string) $c['name']) . '</a></div>'
            . '<div style="color:#8a7658;font-size:13px;">' . h($typeRu) . ' конкурс · ' . h($price)
            . ($end !== '' ? ' · приём заявок до <b style="color:#7a2e1e;">' . h($end) . '</b>' : '') . '</div>'
            . '</td></tr></table>';
    }

    return '<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Действующие конкурсы</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 20px;">Приём заявок открыт — приглашаем Вас принять участие. '
        . 'Ниже конкурсы, заявки на которые принимаются прямо сейчас.</p>'
        . $items
        . drip_button($all, 'Все конкурсы')
        . '<p style="margin:18px 0 0;font-size:13px;color:#8a7658;">Желаем Вам ярких выступлений и заслуженных наград.</p>';
}

/* ---------- Основной прогон ---------- */
try {
    if (!function_exists('all') || !function_exists('one')) {
        cron_log(JOB, 'БД недоступна — выход');
        cron_unlock(JOB);
        exit(0);
    }

    /* ----- Шаг 2 (день 3): как подать заявку ----- */
    // Окно: подписке 3–7 суток, тег drip_d3 ещё не проставлен.
    $rows = all(
        "SELECT id, email, name, unsub_token, tags
           FROM subscribers
          WHERE active = 1 AND email <> ''
            AND created_at <= datetime('now', '-3 days')
            AND created_at >  datetime('now', '-7 days')
            AND (tags IS NULL OR tags NOT LIKE '%drip_d3%')
          ORDER BY id
          LIMIT ?",
        [DRIP_CAP]
    );
    $sent3 = 0;
    foreach ($rows as $s) {
        // Двойная защита от гонки/частичного совпадения LIKE.
        if (drip_has_tag((string) ($s['tags'] ?? ''), 'drip_d3')) continue;
        $name = trim((string) ($s['name'] ?? ''));
        $body = drip_body_apply($name);
        if (drip_enqueue($s, 'Как подать заявку — «Музыкальный Мир»', $body, 'Пошагово: как подать заявку и требования к видео')) {
            drip_tag_add((int) $s['id'], 'drip_d3');
            $sent3++;
        }
    }
    cron_log(JOB, "шаг день-3 (подача заявки): поставлено в очередь $sent3");

    /* ----- Шаг 3 (день 7): действующие конкурсы ----- */
    $openComps = all(
        "SELECT name, slug, type, is_paid, price, end_date
           FROM competitions
          WHERE status = 'open'
          ORDER BY sort, end_date"
    );
    $sent7 = 0;
    if (!$openComps) {
        cron_log(JOB, 'шаг день-7: открытых конкурсов нет — пропуск');
    } else {
        $rows = all(
            "SELECT id, email, name, unsub_token, tags
               FROM subscribers
              WHERE active = 1 AND email <> ''
                AND created_at <= datetime('now', '-7 days')
                AND created_at >  datetime('now', '-14 days')
                AND (tags IS NULL OR tags NOT LIKE '%drip_d7%')
              ORDER BY id
              LIMIT ?",
            [DRIP_CAP]
        );
        foreach ($rows as $s) {
            if (drip_has_tag((string) ($s['tags'] ?? ''), 'drip_d7')) continue;
            $name = trim((string) ($s['name'] ?? ''));
            $body = drip_body_competitions($name, $openComps);
            if (drip_enqueue($s, 'Действующие конкурсы — «Музыкальный Мир»', $body, 'Конкурсы, приём заявок на которые открыт сейчас')) {
                drip_tag_add((int) $s['id'], 'drip_d7');
                $sent7++;
            }
        }
        cron_log(JOB, "шаг день-7 (действующие конкурсы): поставлено в очередь $sent7");
    }

    cron_log(JOB, "готово: день-3=$sent3, день-7=$sent7");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
