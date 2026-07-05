<?php
/** Единый формат ответов API. */

declare(strict_types=1);

final class Response
{
    public static function ok(mixed $data = null, int $code = 200): never
    {
        http_response_code($code);
        echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(string $message, int $code = 400, ?array $fields = null): never
    {
        http_response_code($code);
        $body = ['success' => false, 'error' => $message];
        if ($fields) $body['fields'] = $fields;
        echo json_encode($body, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** Тело запроса как массив (JSON). */
    public static function input(): array
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '[]', true);
        return is_array($data) ? $data : [];
    }
}
