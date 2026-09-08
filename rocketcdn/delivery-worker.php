<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/config.php';
require __DIR__ . '/delivery.php';
try { echo json_encode(rc_delivery_run(), JSON_UNESCAPED_UNICODE) . "\n"; }
catch (Throwable $e) { fwrite(STDERR, "Rocket delivery worker: storage failure\n"); exit(1); }
