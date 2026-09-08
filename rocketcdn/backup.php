<?php
/* Bot offset and support records form one checkpoint. Freeze bot, delivery,
 * and the participating JSON files before reading; publish one complete file. */
function rc_backup_snapshot(string $destination): bool {
    $locks = [];
    $files = ['leads'=>'leads.json', 'binds'=>'bindings.json', 'content'=>'content.json',
        'vpn_content'=>'content-vpn.json', 'nodes'=>'nodes.json', 'settings'=>'public-settings.json',
        'bot_state'=>'bot_state.json', 'contest'=>'contest.json'];
    $names = ['bot.lock', 'delivery-worker.lock'];
    foreach ($files as $file) $names[] = $file . '.lock';
    try {
        foreach ($names as $name) {
            $h = @fopen(RC_DATA . '/' . $name, 'c');
            if (!$h) return false;
            $locks[] = $h;
            if (!flock($h, LOCK_EX)) return false;
        }
        $snapshot = ['date'=>date('Y-m-d'), 'schema'=>2];
        foreach ($files as $key=>$file) {
            $path = RC_DATA . '/' . $file;
            $value = is_file($path) ? json_decode((string)@file_get_contents($path), true) : [];
            if (!is_array($value)) return false;
            $snapshot[$key] = $value;
        }
        $offset = RC_DATA . '/tg_offset.txt';
        $raw = is_file($offset) ? @file_get_contents($offset) : '0';
        if ($raw === false || !preg_match('/^\d+\s*$/', $raw)) return false;
        $snapshot['telegram_offset'] = (int)$raw;
        return rc_json_write($destination, $snapshot);
    } finally {
        foreach (array_reverse($locks) as $h) { flock($h, LOCK_UN); fclose($h); }
    }
}
