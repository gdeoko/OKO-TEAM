<?php
declare(strict_types=1);
/**
 * core/diploma_html.php — ДИСПЕТЧЕР бланка диплома.
 *
 * Один бланк на все конкурсы не годится: старые конкурсы (id < 28) выверены под
 * вёрстку от 30.08 (37bec99), а сентябрьские (id >= 28: Наследие России, Высшая
 * лига, Мир звёзд, На волне искусства) — под ритм-рефактор от 01.09 (868989a),
 * где интервалы выравниваются по реальным границам букв. Их подгонки (dy/fs/hide,
 * фон, overlay) лежат в competitions.diploma_template и выверены КАЖДЫЙ под свою
 * базу. Поэтому база выбирается ПО КОНКУРСУ, а не глобально.
 *
 * Два замороженных движка — core/diploma_html_v1.php (namespace Dip\V1, 30.08) и
 * core/diploma_html_v2.php (namespace Dip\V2, 01.09). Пересобираются из git-версий,
 * вручную не редактируются. Здесь только выбор версии и публичные обёртки.
 *
 * Публичный интерфейс не меняется:
 *   diploma_html(array $c, array $a, array $opt=[]): string
 *   diploma_theme_pick(array $c, array $tpl): array
 *   diploma_sample_app(): array
 *   _dh_teachers(string $raw): array   (используется core/pdf_diploma.php)
 */

require_once __DIR__ . '/diploma_html_v1.php';
require_once __DIR__ . '/diploma_html_v2.php';

/**
 * Какой движок бланка у конкурса: 'v1' (30.08) или 'v2' (01.09).
 * Приоритет — явный флаг competitions.diploma_engine, затем правило по id.
 */
function diploma_engine_ver(array $c): string {
    $e = strtolower(trim((string) ($c['diploma_engine'] ?? '')));
    if ($e === 'v1' || $e === 'aug30' || $e === '30.08') return 'v1';
    if ($e === 'v2' || $e === 'sep01' || $e === '01.09') return 'v2';
    // По умолчанию: конкурсы с сентябрьским выравниванием (id >= 28) и все новые — v2;
    // прежние (Величие России и др., id < 28) — выверенный 30.08.
    return ((int) ($c['id'] ?? 0)) >= 28 ? 'v2' : 'v1';
}

function diploma_html(array $c, array $a, array $opt = []): string {
    return diploma_engine_ver($c) === 'v2'
        ? \Dip\V2\diploma_html($c, $a, $opt)
        : \Dip\V1\diploma_html($c, $a, $opt);
}

function diploma_theme_pick(array $c, array $tpl): array {
    return diploma_engine_ver($c) === 'v2'
        ? \Dip\V2\diploma_theme_pick($c, $tpl)
        : \Dip\V1\diploma_theme_pick($c, $tpl);
}

// Образец заявки и разбор педагогов — чистые функции, в обеих версиях идентичны.
function diploma_sample_app(): array { return \Dip\V2\diploma_sample_app(); }
function _dh_teachers(string $raw): array { return \Dip\V2\_dh_teachers($raw); }
