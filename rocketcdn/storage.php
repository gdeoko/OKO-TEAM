<?php
/* All writers share a stable sidecar lock; replacing JSON never exposes
   a truncated file. Keep this module independent for offline checks. */
function rc_json_replace_locked($file, $data) {
    if (!is_array($data)) return false;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    $tmp = @tempnam(dirname($file), '.rc-json-');
    if ($tmp === false) return false;
    $fh = null;
    try {
        $mode = is_file($file) ? (@fileperms($file) & 0777) : 0664;
        if (!@chmod($tmp, $mode ?: 0664)) return false;
        $fh = @fopen($tmp, 'wb');
        if (!$fh) return false;
        $offset = 0;
        $length = strlen($json);
        while ($offset < $length) {
            $written = @fwrite($fh, substr($json, $offset));
            if ($written === false || $written === 0) return false;
            $offset += $written;
        }
        if (!@fflush($fh)) return false;
        if (function_exists('fsync') && !@fsync($fh)) return false;
        if (!@fclose($fh)) { $fh = null; return false; }
        $fh = null;
        return @rename($tmp, $file);
    } finally {
        if (is_resource($fh)) fclose($fh);
        if (is_file($tmp)) @unlink($tmp);
    }
}

function rc_json_write($file, $data) {
    $lock = @fopen($file . '.lock', 'c');
    if (!$lock) return false;
    try {
        if (!@flock($lock, LOCK_EX)) return false;
        return rc_json_replace_locked($file, $data);
    } finally {
        @flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function rc_json_update($file, callable $fn) {
    $lock = @fopen($file . '.lock', 'c');
    if (!$lock) return false;
    try {
        if (!@flock($lock, LOCK_EX)) return false;
        $data = [];
        if (is_file($file)) {
            $raw = @file_get_contents($file);
            if ($raw === false) return false;
            $data = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
                error_log('Rocket storage: invalid JSON in ' . basename($file));
                return false;
            }
        }
        $data = $fn($data);
        return rc_json_replace_locked($file, $data) ? $data : false;
    } finally {
        @flock($lock, LOCK_UN);
        fclose($lock);
    }
}
