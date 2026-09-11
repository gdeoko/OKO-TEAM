<?php
/**
 * VK API — авто-постинг, работа со стеной, рассылки и т.п. от лица пользователя (Председатель Оргкомитета)
 * или сообщества Культурного центра «Музыкальный Мир» (vk.com/music_world.online, id 211325055, is_admin=1, admin_level=3).
 *
 * ДВА КЛЮЧА, И ГЛАВНЫЙ — КЛЮЧ СООБЩЕСТВА.
 *
 * `MUZMIR_VK_GROUP_TOKEN` (cfgv 'vk_group_token') выдан самим сообществом
 * (Управление → Работа с API → Ключи доступа) и принадлежит ему, а не человеку.
 * `MUZMIR_VK_TOKEN` (cfgv 'vk_token') — личный ключ владельца.
 *
 * Раньше весь слой ходил личным ключом, даже туда, где в параметрах стоит
 * group_id и работа явно идёт от лица сообщества. ВКонтакте это терпел, пока
 * владелец админ, — и цена такой привычки выяснилась 9 сентября: ВК счёл
 * страницу владельца взломанной и закрыл ЕЙ доступ к API. Личный ключ ответил
 * «Flood control» на каждый метод, бот умолк во ВКонтакте на двое суток, а
 * ключ сообщества всё это время работал безупречно — им просто никто не
 * пользовался. Личные неприятности владельца не должны останавливать переписку
 * центра с участниками.
 *
 * Поэтому теперь: сперва ключ сообщества, личный — только туда, куда ключ
 * сообщества не пускают (поиск сообществ, репост, чужие стены). Разбирать
 * методы по списку не нужно — ВК сам говорит об этом ошибкой, и на неё мы
 * повторяем вызов личным ключом. Отдых после «девятки» у ключей РАЗДЕЛЬНЫЙ:
 * закрытый личный ключ не имеет права закрывать переписку сообщества.
 *
 * Для постинга от имени сообщества передаётся owner_id = -group_id и from_group=1.
 */
declare(strict_types=1);

/**
 * Вызов метода VK API.
 *
 * По умолчанию идёт ключом сообщества, а если тот для метода не годится —
 * повторяет личным ключом владельца. $tokenOverride обходит выбор целиком.
 */
function vk_api(string $method, array $params = [], string $tokenOverride = ''): array {
    if ($tokenOverride !== '') return vk_api_with($method, $params, $tokenOverride, 'vk_flood_until');

    $group = trim((string) cfgv('vk_group_token', ''));
    $user  = trim((string) cfgv('vk_token', ''));
    if ($group === '') return vk_api_with($method, $params, $user, 'vk_flood_until_user');

    $r = vk_api_with($method, $params, $group, 'vk_flood_until');
    if ($user === '' || !isset($r['error'])) return $r;

    /* «Этот метод ключу сообщества недоступен» — единственный повод достать
     * личный ключ. Коды: 15 (доступ запрещён), 27 (нет прав у ключа сообщества),
     * 3 (метод сообществу неизвестен). Повторять безопасно: вызов, ответивший
     * ошибкой, ничего не отправил и ничего не опубликовал. */
    $code = (int) ($r['error']['error_code'] ?? 0);
    if (!in_array($code, [3, 15, 27], true)) return $r;
    if (!vk_user_key_usable($user)) return $r;

    _vk_log($method . ': ключу сообщества метод недоступен (' . $code . '), повторяю личным ключом');
    return vk_api_with($method, $params, $user, 'vk_flood_until_user');
}

/**
 * ЗАБЛОКИРОВАННЫЙ АККАУНТ НЕ ТРОГАЕМ ВОВСЕ.
 *
 * ВКонтакте на закрытую страницу отвечает кодом 5 «user is blocked» и кладёт в
 * ответ ban_info со ссылкой на разблокировку. Пока страница закрыта, каждый наш
 * запрос её личным ключом — это обращение к заблокированному аккаунту с
 * серверного адреса. Пользы ноль, а выглядит ровно как то, из-за чего страницу
 * и закрыли. Поэтому: увидели отказ — запомнили хвост ключа и больше им не
 * ходим. Владелец разблокировал страницу и выдал новый ключ — хвост другой,
 * запрет снимается сам, ничего руками чистить не нужно.
 */
function vk_user_key_usable(string $token): bool {
    $token = trim($token);
    if ($token === '' || !function_exists('setting')) return $token !== '';
    if ((string) setting('vk_user_blocked_tok', '') !== substr($token, -12)) return true;

    /* ЗАПРЕТ ОБЯЗАН УМЕТЬ СНИМАТЬСЯ САМ.
     * Владелец разблокирует страницу через ban_info.restore_url — и часто тем же
     * ключом, без выдачи нового. Если держать запрет вечно по хвосту ключа, мы
     * никогда об этом не узнаем и будем считать живую страницу закрытой. Поэтому
     * раз в шесть часов пробуем ещё раз: одна проба за полсмены — это не стук в
     * дверь, а проверка, не открыли ли её. Ответила — отметка снимается в
     * vk_api_with, как и для любого удачного вызова. */
    $at = strtotime((string) setting('vk_user_blocked_at', '')) ?: 0;
    return $at > 0 && (time() - $at) > 6 * 3600;
}

/**
 * СПРОСИТЬ У ВК ПРЯМО: НЕ ЗАКРЫТА ЛИ СТРАНИЦА ВЛАДЕЛЬЦА.
 *
 * Разные методы отвечают на блокировку ПО-РАЗНОМУ, и это стоило двух суток
 * поисков несуществующего превышения темпа. `users.get` на закрытой странице
 * отвечает «error 9, Flood control» — то есть «ты частишь»; а методы, которым
 * нужна настоящая авторизация (`account.getAppPermissions`,
 * `messages.getConversations`), говорят честно: «error 5, user is blocked» и
 * присылают ban_info со ссылкой на разблокировку. На домен это не влияет:
 * api.vk.ru и api.vk.com отвечают одинаково, проверено обоими.
 *
 * Поэтому спрашиваем тем методом, который не врёт. Возвращает ссылку
 * разблокировки, если страница закрыта, иначе пустую строку.
 */
function vk_user_blocked_probe(string $token): string {
    $token = trim($token);
    if ($token === '') return '';
    $r = vk_api_with('account.getAppPermissions', [], $token, 'vk_flood_until_user');
    $code = (int) ($r['error']['error_code'] ?? 0);
    if ($code !== 5 || stripos((string) ($r['error']['error_msg'] ?? ''), 'blocked') === false) return '';
    vk_user_key_mark_blocked($token, (array) $r['error']);
    return (string) ($r['error']['ban_info']['restore_url'] ?? ' ');
}

/** Запомнить, что ВК закрыл страницу владельца, и подсказать ссылку восстановления. */
function vk_user_key_mark_blocked(string $token, array $err): void {
    if (!function_exists('set_setting')) return;
    $tail = substr(trim($token), -12);
    if ((string) setting('vk_user_blocked_tok', '') === $tail) return;   // уже знаем
    set_setting('vk_user_blocked_tok', $tail);
    set_setting('vk_user_blocked_at', date('Y-m-d H:i:s'));
    $url = (string) ($err['ban_info']['restore_url'] ?? '');
    if ($url !== '') set_setting('vk_user_restore_url', $url);
    _vk_log('ВК закрыл страницу владельца — личный ключ отключён'
            . ($url !== '' ? '; разблокировка: ' . $url : ''));
}

/**
 * Настроен ли ВКонтакте вообще.
 *
 * Годится ЛЮБОЙ из двух ключей: работа сообщества не должна выключаться оттого,
 * что личного ключа владельца сейчас нет. Проверки вида «есть ли vk_token» по
 * коду заменены на этот вызов именно поэтому.
 */
function vk_configured(): bool {
    return trim((string) cfgv('vk_group_token', '')) !== ''
        || trim((string) cfgv('vk_token', '')) !== '';
}

/** Один вызов конкретным ключом. $breaker — имя настройки с его собственным отдыхом. */
function vk_api_with(string $method, array $params, string $token, string $breaker): array {
    $token = trim($token);
    if ($token === '') return ['error' => ['error_msg' => 'VK token not configured']];
    $params['access_token'] = $token;
    $params['v'] = cfgv('vk_api_version', '5.199');

    /* «FLOOD CONTROL» — ЭТО НЕ «ПОВТОРИ ЧЕРЕЗ ПОЛСЕКУНДЫ».
     *
     * Ошибка 6 значит «слишком часто, подожди мгновение» — её и правда лечит
     * короткая пауза. Ошибка 9, «Flood control», совсем другая: ВКонтакте
     * закрывает токен на минуты, и КАЖДЫЙ повтор в эту дверь продлевает срок.
     *
     * 8 сентября в 15:30 так и вышло. Заполнение имён собеседников спрашивало
     * ВК по одному имени за запрос, двадцать пять раз каждые семь минут, а
     * здешний повтор превращал каждый запрос в четыре. Токен ушёл в блокировку
     * и остался в ней на сутки: бот перестал отвечать во ВКонтакте, а в админке
     * появилось «проверьте токен сообщества» — хотя токен был цел.
     *
     * Поэтому на девятку — предохранитель. Один отказ закрывает исходящие ко
     * ВКонтакте на несколько минут (5 → 10 → 15, дальше не растёт), и всё
     * это время мы к нему не ходим вовсе. Ответы участникам при этом не
     * теряются: они лежат в переписке, и cron/vk_resend_stuck досылает их,
     * когда дверь откроется. */
    $stepKey    = $breaker . '_step';
    $floodUntil = (int) (function_exists('setting') ? setting($breaker, '0') : 0);
    if ($floodUntil > time()) {
        return ['error' => ['error_code' => 9, 'error_msg' => 'Flood control',
                            'wait_until' => date('H:i', $floodUntil)]];
    }

    // ВК ограничивает частоту (3 запроса в секунду) и иногда отдаёт временные сбои.
    // Раньше один такой отказ означал пост БЕЗ афиши: загрузка молча возвращала пусто.
    // Теперь временные ошибки повторяем с нарастающей паузой. Девятки здесь нет
    // намеренно — у неё свой, длинный отдых (см. выше).
    $tempCodes = [1, 6, 10, 29];   // неизвестная, слишком часто, внутренняя, лимит
    $last = ['error' => ['error_msg' => 'нет ответа']];
    for ($try = 1; $try <= 4; $try++) {
        /* Российский домен: к ВКонтакте ходим прямо, с российского адреса и без
         * посредников — правило владельца от 11.09.2026. Ответы у api.vk.ru и
         * api.vk.com одинаковые, дело не в домене (см. vk_user_blocked_probe). */
        $ch = curl_init('https://api.vk.ru/method/' . $method);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($params),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $res = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($res === false) {
            $last = ['error' => ['error_msg' => 'cURL: ' . $err]];
        } else {
            $d = json_decode((string) $res, true);
            if (!is_array($d)) {
                $last = ['error' => ['error_msg' => 'Bad JSON response']];
            } else {
                $code = (int) ($d['error']['error_code'] ?? 0);
                /* Страница владельца закрыта — запоминаем и больше этим ключом
                 * не ходим (см. vk_user_key_usable). Ссылку на разблокировку ВК
                 * присылает тут же, в ban_info: она пригодится владельцу. */
                if ($code === 5 && stripos((string) ($d['error']['error_msg'] ?? ''), 'blocked') !== false) {
                    vk_user_key_mark_blocked($token, (array) $d['error']);
                    return $d;
                }
                if ($code === 9) {
                    // Отдых удлиняем, пока служба не отпустит: 5 минут, 10, дальше 15.
                    $prev = (int) (function_exists('setting') ? setting($stepKey, '0') : 0);
                    /* Потолок отдыха — четверть часа, а не час.
                     * Смысл предохранителя в том, чтобы не долбить закрытую
                     * дверь, а не в том, чтобы позже всех узнать, что её
                     * открыли. Четыре пробы в час службу не тревожат, зато
                     * ответы участникам, лежащие наготове, уходят в течение
                     * пятнадцати минут после того, как ВК отпустит, а не через
                     * час. */
                    $step = min(900, max(300, $prev * 2));
                    if (function_exists('set_setting')) {
                        set_setting($stepKey, (string) $step);
                        set_setting($breaker, (string) (time() + $step));
                    }
                    _vk_log(sprintf('%s: Flood control (%s) — закрываю обращения этим ключом на %d мин',
                                    $method, $breaker, (int) ($step / 60)));
                    return $d;
                }
                if (!isset($d['error'])) {
                    // Страница владельца снова отвечает — снимаем отметку о блокировке.
                    if (function_exists('set_setting')
                        && (string) setting('vk_user_blocked_tok', '') === substr($token, -12)) {
                        set_setting('vk_user_blocked_tok', '');
                        set_setting('vk_user_restore_url', '');
                        _vk_log('страница владельца снова отвечает — личный ключ включён');
                    }
                    // Ответила — значит дверь открыта: сбрасываем и отдых, и его длину.
                    if (function_exists('set_setting') && (int) setting($stepKey, '0') > 0) {
                        set_setting($stepKey, '0');
                        set_setting($breaker, '0');
                        _vk_log($method . ': ВК снова отвечает, предохранитель снят (' . $breaker . ')');
                    }
                    return $d;
                }
                if (!in_array($code, $tempCodes, true)) return $d;   // окончательный отказ
                $last = $d;
            }
        }
        if ($try < 4) {
            _vk_log(sprintf('%s: временный сбой (%s), попытка %d из 4',
                            $method, (string) ($last['error']['error_msg'] ?? '?'), $try));
            usleep(400000 * $try);                  // 0.4с, 0.8с, 1.2с
        }
    }
    return $last;
}

/** Пост на стену сообщества КЦ (от лица сообщества, from_group=1). */
function vk_wall_post(string $message, array $extra = []): array {
    $gid = (int) cfgv('vk_group_id', 211325055);
    if ($gid <= 0) return ['error' => ['error_msg' => 'VK group_id not configured']];
    $params = array_merge([
        'owner_id'   => -$gid,
        'from_group' => 1,
        'message'    => $message,
    ], $extra);
    $r = vk_api('wall.post', $params);
    if (isset($r['error'])) {
        _vk_log('wall.post ERR: ' . ($r['error']['error_msg'] ?? '?'));
    } else {
        _vk_log('wall.post OK post_id=' . ($r['response']['post_id'] ?? '?'));
    }
    return $r;
}

/**
 * Загрузить изображение и получить attachments-строку для wall.post.
 * Возвращает "photo{owner_id}_{id}" или '' — причина последней неудачи доступна
 * через vk_upload_last_error(). Вся загрузка (три шага ВК) повторяется до трёх раз:
 * на живом тесте половина афиш терялась из-за частотного лимита ВК, и пост уходил
 * без афиши — а афиша здесь обязательна.
 */
function vk_upload_wall_photo(string $filePath): string {
    if (!is_file($filePath)) { vk_upload_last_error('файла нет: ' . $filePath); return ''; }
    $gid = (int) cfgv('vk_group_id', 211325055);

    for ($try = 1; $try <= 3; $try++) {
        // 1) получить upload url
        $s = vk_api('photos.getWallUploadServer', ['group_id' => $gid]);
        $url = (string) ($s['response']['upload_url'] ?? '');
        if ($url === '') {
            vk_upload_last_error('getWallUploadServer: ' . (string) ($s['error']['error_msg'] ?? 'пусто'));
        } else {
            // 2) загрузить файл
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => ['photo' => new CURLFile($filePath)],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 60,
            ]);
            $raw = (string) curl_exec($ch);
            $cerr = curl_error($ch);
            curl_close($ch);
            $up = json_decode($raw, true);
            if (!is_array($up) || empty($up['photo'])) {
                vk_upload_last_error('загрузка файла: ' . ($cerr !== '' ? $cerr : substr($raw, 0, 120)));
            } else {
                // 3) сохранить фото
                $save = vk_api('photos.saveWallPhoto', [
                    'group_id' => $gid,
                    'photo'    => (string) $up['photo'],
                    'server'   => (string) ($up['server'] ?? ''),
                    'hash'     => (string) ($up['hash'] ?? ''),
                ]);
                $ph = $save['response'][0] ?? [];
                if ($ph) {
                    if ($try > 1) _vk_log('афиша загрузилась со ' . $try . '-й попытки: ' . basename($filePath));
                    return 'photo' . (int) $ph['owner_id'] . '_' . (int) $ph['id'];
                }
                vk_upload_last_error('saveWallPhoto: ' . (string) ($save['error']['error_msg'] ?? 'пусто'));
            }
        }
        if ($try < 3) usleep(700000 * $try);        // 0.7с, 1.4с — переждать частотный лимит
    }
    _vk_log('АФИША НЕ ЗАГРУЗИЛАСЬ (' . basename($filePath) . '): ' . vk_upload_last_error());
    return '';
}

/**
 * ЗАГРУЗИТЬ ДОКУМЕНТ К ПОСТУ (список результатов).
 *
 * Итоги конкурса — это восемьсот строк: кто, откуда, какое звание. В тексте
 * поста они не помещаются, а ссылка на сайт открывается не у всех и не сразу.
 * Поэтому список прикладывается к посту файлом — его качают, распечатывают и
 * несут в учреждение. Возвращает строку вида "doc-123456_789" для attachments
 * или '' — причина в vk_upload_last_error().
 *
 * @param string $title подпись файла в посте (без расширения ВК показывает как есть)
 */
function vk_upload_wall_doc(string $filePath, string $title = ''): string {
    if (!is_file($filePath)) { vk_upload_last_error('файла нет: ' . $filePath); return ''; }
    $gid = (int) cfgv('vk_group_id', 211325055);
    $name = $title !== '' ? $title : basename($filePath);
    // ВК не любит в имени файла ничего, кроме букв, цифр и простых знаков.
    $name = preg_replace('~[^\p{L}\p{N} ._-]+~u', '', $name) ?: basename($filePath);
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if ($ext !== '' && !str_ends_with(mb_strtolower($name), '.' . $ext)) $name .= '.' . $ext;

    /* ДОКУМЕНТ ГРУЗИМ ОТ СЕБЯ, А НЕ В ГРУППУ.
     *
     * Проверка 27.08.2026 на живом сообществе: docs.getWallUploadServer с
     * group_id отвечает «Access denied: User can't upload docs to this group» —
     * у токена председателя оргкомитета такого права нет и не будет, это
     * настройка сообщества, а не приложения. Права docs у токена при этом есть.
     *
     * Зато документ, загруженный БЕЗ group_id (то есть в личные документы),
     * прикладывается к записи сообщества без всяких ограничений: проверено
     * постом, файл виден в записи со ссылкой на скачивание. Поэтому основной
     * путь — личные документы, а попытка с group_id остаётся запасной: если
     * право однажды выдадут, файл ляжет в документы сообщества. */
    $variants = [[], ['group_id' => $gid]];
    foreach ($variants as $params) {
    for ($try = 1; $try <= 3; $try++) {
        // 1) адрес для загрузки.
        $s = vk_api('docs.getWallUploadServer', $params);
        $url = (string) ($s['response']['upload_url'] ?? '');
        if ($url === '') {
            vk_upload_last_error('docs.getWallUploadServer: ' . (string) ($s['error']['error_msg'] ?? 'пусто'));
        } else {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => ['file' => new CURLFile($filePath, '', $name)],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 120,
            ]);
            $raw = (string) curl_exec($ch);
            $cerr = curl_error($ch);
            curl_close($ch);
            $up = json_decode($raw, true);
            if (!is_array($up) || empty($up['file'])) {
                vk_upload_last_error('загрузка документа: ' . ($cerr !== '' ? $cerr : substr($raw, 0, 160)));
            } else {
                $save = vk_api('docs.save', ['file' => (string) $up['file'], 'title' => $name]);
                // docs.save отвечает по-разному в зависимости от версии API:
                // либо {type:'doc',doc:{...}}, либо массивом. Берём оба вида.
                $d = $save['response']['doc'] ?? ($save['response'][0] ?? []);
                if ($d && isset($d['id'])) {
                    if ($try > 1) _vk_log('список результатов загрузился со ' . $try . '-й попытки');
                    return 'doc' . (int) ($d['owner_id'] ?? 0) . '_' . (int) $d['id'];
                }
                vk_upload_last_error('docs.save: ' . (string) ($save['error']['error_msg'] ?? 'пусто'));
            }
        }
        // Отказ в правах повторять бессмысленно — сразу пробуем другой вариант.
        if (str_contains(vk_upload_last_error(), 'Access denied')) break;
        if ($try < 3) usleep(700000 * $try);
    }
    }
    _vk_log('ДОКУМЕНТ НЕ ЗАГРУЗИЛСЯ (' . basename($filePath) . '): ' . vk_upload_last_error());
    return '';
}

/** Причина последней неудачной загрузки афиши (для админки и логов). */
function vk_upload_last_error(?string $set = null): string {
    static $e = '';
    if ($set !== null) $e = $set;
    return $e;
}

/**
 * Пост на стену с одним изображением.
 * Если афишу приложить не удалось — пост всё равно уходит (текст важнее молчания),
 * но факт помечается в ответе (photo_missing) и в логе, чтобы это было видно,
 * а не выяснялось потом по пустому посту.
 */
function vk_wall_post_with_photo(string $message, string $photoPath, array $extra = []): array {
    $att = $photoPath !== '' ? vk_upload_wall_photo($photoPath) : '';
    if ($att === '') {
        $r = vk_wall_post($message, $extra);
        if ($photoPath !== '') {
            $r['photo_missing'] = true;
            $r['photo_error']   = vk_upload_last_error();
            _vk_log('пост опубликован БЕЗ афиши: ' . vk_upload_last_error());
        }
        return $r;
    }
    // Афиша ДОБАВЛЯЕТСЯ к тому, что уже приложено, а не заменяет его: к посту с
    // итогами вместе с афишей идёт файл со списком результатов, и раньше он
    // молча пропадал — картинка затирала вложение целиком.
    $had = trim((string) ($extra['attachments'] ?? ''));
    $extra['attachments'] = $had !== '' ? ($att . ',' . $had) : $att;
    return vk_wall_post($message, $extra);
}

/**
 * Опубликовать историю (сторис) сообщества из изображения (лучше 1080×1920, 9:16).
 * Кликабельная ссылка ($link) добавляется, только если у сообщества есть право
 * на ссылки в историях; иначе публикуем сторис без ссылки.
 * @return array VK-ответ stories.save (response.items[0].story при успехе).
 */
function vk_story_photo(string $filePath, string $link = ''): array {
    if (!is_file($filePath)) return ['error' => ['error_msg' => 'story file not found: ' . $filePath]];
    $gid = (int) cfgv('vk_group_id', 211325055);
    $params = ['group_id' => $gid, 'add_to_news' => 1];
    if ($link !== '') { $params['link_url'] = $link; $params['link_text'] = 'open'; }
    $s = vk_api('stories.getPhotoUploadServer', $params);
    $url = (string) ($s['response']['upload_url'] ?? '');
    if ($url === '') {
        // Ссылка не разрешена — пробуем без неё.
        if ($link !== '') return vk_story_photo($filePath, '');
        _vk_log('story upload_url ERR: ' . json_encode($s['error'] ?? $s, JSON_UNESCAPED_UNICODE));
        return $s;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['file' => new CURLFile($filePath)],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $up = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    $ur = $up['response']['upload_result'] ?? ($up['response'] ?? '');
    if (!$ur) { _vk_log('story upload failed'); return ['error' => ['error_msg' => 'story upload failed']]; }
    $save = vk_api('stories.save', ['upload_results' => is_array($ur) ? json_encode($ur) : (string) $ur]);
    if (isset($save['error'])) _vk_log('stories.save ERR: ' . ($save['error']['error_msg'] ?? '?'));
    else _vk_log('stories.save OK');
    return $save;
}

/**
 * Единая публикация анонса: пост на стену сообщества (+ фото) и, при наличии
 * картинки, дубль в историю (сторис). Возвращает результаты обеих операций.
 * @return array{wall:array,story:?array}
 */
function vk_publish_post(string $message, string $photoPath = '', bool $alsoStory = true, string $link = ''): array {
    $wall  = $photoPath !== '' ? vk_wall_post_with_photo($message, $photoPath) : vk_wall_post($message);
    $story = ($alsoStory && $photoPath !== '') ? vk_story_photo($photoPath, $link) : null;
    return ['wall' => $wall, 'story' => $story];
}

/* ============ Рассылка подписчикам через сервис «Рассылки» (vkforms) ============ */

/**
 * Отправка рассылки подписчикам сообщества через сервис «Рассылки»
 * (broadcast.vkforms.ru, приложение в меню сообщества). Легально: аудитория —
 * те, кто сам подписался на рассылку. Лимит сервиса — 200 рассылок/сутки.
 *
 * Ключи в config.local.php:
 *   vk_broadcast_token — ключ доступа (Управление сервисом → Настройки → Создать ключ)
 *   vk_broadcast_lists — id списков рассылки через запятую (необязательно; если
 *                        пусто — рассылка по всем спискам сервиса не делается,
 *                        нужен хотя бы один list_id).
 *
 * @param string $message   текст поста
 * @param string $attachment attachment-строка VK (например 'wall-GID_POSTID' или 'photoOWNER_ID')
 * @return array{ok:bool,error?:string,id?:int}
 */
function vk_broadcast(string $message, string $attachment = ''): array {
    $token = trim((string) cfgv('vk_broadcast_token', ''));
    if ($token === '') return ['ok' => false, 'error' => 'vk_broadcast_token не настроен'];
    $lists = array_values(array_filter(array_map('trim', explode(',', (string) cfgv('vk_broadcast_lists', '')))));
    // Если id списка не задан — подбираем автоматически по имени базы («…вещает»).
    if (!$lists) {
        $id = vk_broadcast_resolve_list($token, (string) cfgv('vk_broadcast_list_name', 'вещает'));
        if ($id > 0) $lists = [(string) $id];
    }
    if (!$lists) return ['ok' => false, 'error' => 'не найден список рассылки (проверьте ключ или задайте vk_broadcast_lists)'];

    $body = [
        'message'  => $message,
        'list_ids' => array_map('intval', $lists),
        'run_now'  => 1,
    ];
    if ($attachment !== '') $body['attachment'] = $attachment;

    $ch = curl_init('https://broadcast.vkforms.ru/api/v2/broadcast?token=' . rawurlencode($token));
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) { _vk_log('broadcast cURL ERR: ' . $err); return ['ok' => false, 'error' => 'cURL: ' . $err]; }
    $d = json_decode((string) $resp, true);
    if (isset($d['error'])) {
        _vk_log('broadcast API ERR: ' . json_encode($d['error'], JSON_UNESCAPED_UNICODE));
        return ['ok' => false, 'error' => (string) ($d['error']['description'] ?? $d['error']['message'] ?? 'unknown')];
    }
    $id = (int) ($d['response']['id'] ?? 0);
    _vk_log('broadcast OK id=' . $id);
    return ['ok' => true, 'id' => $id];
}

/** Найти id списка рассылки сервиса «Рассылки» по части имени (например «вещает»). */
function vk_broadcast_resolve_list(string $token, string $needle): int {
    static $cache = [];
    if (isset($cache[$needle])) return $cache[$needle];
    $ch = curl_init('https://broadcast.vkforms.ru/api/v2/list/?token=' . rawurlencode($token));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $resp = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $resp, true);
    $lists = $d['response']['lists'] ?? [];
    $found = 0; $needleLc = mb_strtolower(trim($needle));
    foreach ($lists as $l) {
        if ($needleLc === '' || mb_stripos((string) ($l['name'] ?? ''), $needleLc) !== false) {
            $found = (int) ($l['id'] ?? 0);
            if ($found > 0) break;
        }
    }
    // Фолбэк — первый список, если по имени не нашли
    if ($found === 0 && !empty($lists[0]['id'])) $found = (int) $lists[0]['id'];
    return $cache[$needle] = $found;
}

/* ==================== Рассылка в личку от имени сообщества ==================== */

/**
 * Очередь личных сообщений от сообщества (аудитория — открытые диалоги
 * сообщества: только те, кто сам писал/разрешил сообщения; ~5 тыс. диалогов).
 * Антидубль: UNIQUE(peer_id, kind, ref). Отправку делает cron/vk_dm_worker.php.
 */
function vk_dm_ensure_table(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS vk_dm_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        peer_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        attachment TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        sent_at TEXT,
        UNIQUE(peer_id, kind, ref)
    )");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vk_dm_status ON vk_dm_queue(status, id)");
}

/**
 * Поставить рассылку в личку всем открытым диалогам сообщества.
 * Получатели: messages.getConversations (только люди, кому можно писать).
 * Возвращает число добавленных в очередь.
 */
function vk_dm_enqueue_dialogs(string $message, string $attachment, string $kind, string $ref): int {
    if (!vk_configured()) return 0;
    vk_dm_ensure_table();
    $gid = (int) cfgv('vk_group_id', 211325055);
    $ins = db()->prepare("INSERT OR IGNORE INTO vk_dm_queue (peer_id, message, attachment, kind, ref) VALUES (?,?,?,?,?)");
    $added = 0;
    $offset = 0;
    do {
        $r = vk_api('messages.getConversations', ['group_id' => $gid, 'count' => 200, 'offset' => $offset]);
        if (isset($r['error'])) {
            _vk_log('dm_enqueue getConversations ERR: ' . ($r['error']['error_msg'] ?? '?'));
            break;
        }
        $items = $r['response']['items'] ?? [];
        $total = (int) ($r['response']['count'] ?? 0);
        foreach ($items as $it) {
            $conv = $it['conversation'] ?? [];
            $peer = (int) ($conv['peer']['id'] ?? 0);
            if (($conv['peer']['type'] ?? '') !== 'user' || $peer <= 0) continue;
            if (isset($conv['can_write']['allowed']) && !$conv['can_write']['allowed']) continue;
            $ins->execute([$peer, $message, $attachment, $kind, $ref]);
            if ($ins->rowCount() > 0) $added++;
        }
        $offset += 200;
        usleep(350000); // мягкий rate-limit к VK API
    } while ($offset < $total && count($items) > 0);
    _vk_log("dm_enqueue kind=$kind ref=$ref added=$added");
    return $added;
}

/** Отправить одно личное сообщение от имени сообщества. */
/** Показать статус «печатает…» в диалоге ВК (держится ~10 сек, нужно повторять). */
function vk_typing(int $peer): void {
    if ($peer <= 0) return;
    vk_api('messages.setActivity', [
        'group_id' => (int) cfgv('vk_group_id', 211325055),
        'peer_id'  => $peer,
        'type'     => 'typing',
    ]);
}

/** Имя пользователя ВК по peer_id (для персонального приветствия). Кэш на запрос. */
function vk_user_name(int $peer): string {
    static $cache = [];
    if ($peer <= 0 || $peer >= 2000000000) return ''; // не личка/групповой чат
    if (isset($cache[$peer])) return $cache[$peer];

    /* СПРАШИВАТЬ ВК ЗА ИМЕНЕМ В МОМЕНТ ОТВЕТА — ЛИШНЕЕ.
     * Ключу сообщества чужие профили читать не положено: `users.get` отвечает
     * пустым списком, без ошибки. Имена собеседников и так лежат в подписях
     * диалогов — их раз в час складывает cron/vk_names_fill.php из переписки.
     * Берём оттуда: и быстрее, и не тратит обращение к ВК на каждый ответ. */
    $name = '';
    try {
        $t = one("SELECT title FROM chat_dialogs WHERE session_key=?", ['vk_' . $peer]);
        $name = trim((string) ($t['title'] ?? ''));
    } catch (\Throwable $e) { /* подписи может не быть — не беда */ }
    if ($name !== '') $name = trim((string) strtok($name, ' '));   // только имя, без фамилии

    return $cache[$peer] = $name;
}

function vk_dm_send(int $peer, string $message, string $attachment = '', int $randomId = 0): array {
    $params = [
        'group_id'  => (int) cfgv('vk_group_id', 211325055),
        'peer_id'   => $peer,
        // random_id ДОЛЖЕН БЫТЬ РАЗНЫМ У РАЗНЫХ СООБЩЕНИЙ.
        // Здесь по умолчанию подставлялся peer_id — то есть один и тот же ключ на
        // все сообщения этому собеседнику. ВКонтакте дедуплицирует messages.send по
        // паре (отправитель, random_id): первое сообщение уходило, а КАЖДОЕ следующее
        // молча возвращало id первого. Оператор отвечал из админки, видел «отправлено»,
        // и человек в ВК не получал ничего, начиная со второй реплики.
        'random_id' => $randomId ?: random_int(1, 2000000000),
        'message'   => $message,
    ];
    if ($attachment !== '') $params['attachment'] = $attachment;
    return vk_api('messages.send', $params);
}

/** attachment-строка «этот пост со стены» для личных сообщений. */
function vk_dm_wall_attachment(array $wallPostResult): string {
    $postId = (int) ($wallPostResult['response']['post_id'] ?? 0);
    if ($postId <= 0) return '';
    return 'wall-' . (int) cfgv('vk_group_id', 211325055) . '_' . $postId;
}

/** Проверить рабочий ли токен + права. */
function vk_health(): array {
    /* ЗДОРОВЬЕ ВКонтакте МЕРЯЕТСЯ КЛЮЧОМ СООБЩЕСТВА.
     *
     * Раньше здесь первым шёл `users.get` пустым списком — «кто я» личным
     * ключом. У ключа сообщества никакого «я» нет, он ответил бы ошибкой, и
     * админка написала бы «проверьте токен сообщества» при совершенно живой
     * переписке. А 9 сентября вышло наоборот: личный ключ владельца лежал, и
     * та же надпись пугала, хотя сообщество работало. Поэтому главный вопрос —
     * отвечает ли ВК ПО ДЕЛУ сообщества; личный ключ проверяется отдельно и
     * работе не мешает. */
    $g = vk_api('groups.getById', [
        'group_id' => (string) cfgv('vk_group_id', '211325055'),
        'fields'   => 'members_count,is_admin,admin_level',
    ]);
    $group = $g['response'][0] ?? ($g['response']['groups'][0] ?? null);

    $userTok = trim((string) cfgv('vk_token', ''));
    if ($userTok === '')                    $u = ['error' => ['error_msg' => 'личный ключ не задан']];
    elseif (!vk_user_key_usable($userTok))  $u = ['error' => ['error_msg' => 'ВК закрыл страницу владельца']];
    else {
        // Сперва честный вопрос «не закрыта ли страница» — он же ставит отметку
        // и запоминает ссылку разблокировки. Закрыта — дальше не идём.
        $ban = vk_user_blocked_probe($userTok);
        $u = $ban !== '' ? ['error' => ['error_msg' => 'ВК закрыл страницу владельца']]
                         : vk_api_with('users.get', ['user_ids' => '1'], $userTok, 'vk_flood_until_user');
    }

    return [
        'group_ok'  => $group !== null,
        'group'     => $group,
        'user_ok'   => isset($u['response'][0]['id']),
        'user'      => $u['response'][0] ?? null,
        'user_note' => isset($u['response'][0]['id']) ? '' :
                       'личный ключ владельца сейчас не отвечает — на работу сообщества это не влияет'
                       . ((string) setting('vk_user_restore_url', '') !== ''
                          ? '; разблокировка страницы: ' . setting('vk_user_restore_url', '') : ''),
        'error'     => $g['error'] ?? null,
    ];
}

function _vk_log(string $line): void {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/vk.log', date('Y-m-d H:i:s') . ' ' . $line . "\n", FILE_APPEND);
}

/* =====================================================================
 *  РАСПРОСТРАНЕНИЕ ЗА ПРЕДЕЛЫ СОБСТВЕННОГО СООБЩЕСТВА
 *
 *  Своих подписчиков центр уже собрал, и их число само по себе не растёт.
 *  Новые участники приходят оттуда, где сидят педагоги: из сообществ школ
 *  искусств, домов культуры, методических объединений. Написать им сообщением
 *  ВКонтакте нельзя — сообщество не может первым postучаться в другое
 *  сообщество, а человеку пишет только если он сам начал диалог. Остаются два
 *  честных пути: репост (когда о нас упомянули или мы договорились о взаимном
 *  размещении) и поиск подходящих сообществ, чтобы было с кем договариваться.
 * ===================================================================== */

/**
 * Репост записи на стену нашего сообщества.
 *
 * $postUrl — ссылка вида https://vk.com/wall-12345_678 или готовый object
 * «wall-12345_678». Возвращает ['ok'=>bool, ...].
 */
function vk_repost(string $postUrl, string $comment = ''): array {
    $obj = trim($postUrl);
    if (preg_match('~wall(-?\d+_\d+)~', $obj, $m)) $obj = 'wall' . $m[1];
    if (!preg_match('~^wall-?\d+_\d+$~', $obj)) {
        return ['ok' => false, 'error' => 'не разобрал ссылку на запись: ' . $postUrl];
    }
    $gid = (int) cfgv('vk_group_id', 211325055);
    $p = ['object' => $obj, 'group_id' => $gid];
    if ($comment !== '') $p['message'] = $comment;

    $r = vk_api('wall.repost', $p);
    if (isset($r['error'])) {
        _vk_log('repost ERR: ' . json_encode($r['error'], JSON_UNESCAPED_UNICODE));
        return ['ok' => false, 'error' => (string) ($r['error']['error_msg'] ?? 'unknown')];
    }
    _vk_log('repost OK ' . $obj);
    return ['ok' => true, 'post_id' => (int) ($r['response']['post_id'] ?? 0)];
}

/**
 * Поиск профильных сообществ — кандидатов на взаимное размещение.
 *
 * Отдаёт только то, с чем есть смысл работать: открытые сообщества с живой
 * аудиторией. Совсем мелкие отсеиваются — размещение у них не окупает переписки;
 * совсем крупные обычно продают рекламу и на взаимность не идут, но их оставляем:
 * решать человеку.
 *
 * @return array список ['id','name','members','link'], отсортированный по размеру
 */
function vk_find_communities(string $query, int $limit = 40, int $minMembers = 300): array {
    // fields обязателен: без него ВК не отдаёт members_count, и любой отбор по
    // размеру аудитории молча выбрасывает вообще всё.
    // type не указываем намеренно: ВКонтакте принимает там ровно одно значение, а
    // на «group,page» отвечает пустым списком без всякой ошибки — ищем по всем видам.
    $r = vk_api('groups.search', [
        'q'      => $query,
        'count'  => max(1, min(100, $limit)),
        'sort'   => 0,
        'fields' => 'members_count,city,description',
    ]);
    if (isset($r['error'])) {
        _vk_log('groups.search ERR: ' . json_encode($r['error'], JSON_UNESCAPED_UNICODE));
        return [];
    }
    $out = [];
    foreach (($r['response']['items'] ?? []) as $g) {
        $members = (int) ($g['members_count'] ?? 0);
        if ($members < $minMembers) continue;
        if ((int) ($g['is_closed'] ?? 0) !== 0) continue;   // в закрытое не постучаться
        $out[] = [
            'id'      => (int) ($g['id'] ?? 0),
            'name'    => (string) ($g['name'] ?? ''),
            'members' => $members,
            'link'    => 'https://vk.com/' . (string) ($g['screen_name'] ?? ('club' . (int) ($g['id'] ?? 0))),
        ];
    }
    usort($out, fn($a, $b) => $b['members'] <=> $a['members']);
    return $out;
}
