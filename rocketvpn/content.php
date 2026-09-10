<?php
/* Editable plain text only. Markup and links remain template-owned. */
function rv_frame(): string {
    $html = file_get_contents(__DIR__ . '/frame.html');
    $path = getenv('RV_CONTENT_PATH') ?: '/var/www/rocketcdn-data/content-vpn.json';
    $content = is_file($path) ? json_decode((string)file_get_contents($path), true) : null;
    if (!is_array($content)) return $html;
    return preg_replace_callback('~(<(h[1-3]|p|span)\\b[^>]*data-rv-content="([a-z0-9_.-]+)"[^>]*>)(.*?)(</\\2>)~su',
        function ($m) use ($content) {
            if (!isset($content[$m[3]]) || !is_string($content[$m[3]])) return $m[0];
            return $m[1] . htmlspecialchars($content[$m[3]], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . $m[5];
        }, $html);
}
