<?php
/* ============================================================
   DUCK'S — письма в фирменном стиле (на базе emailTpl).
   Лого-утка (маскот) + вордмарк DUCK'S, кнопки «Записаться» (бот) и канал.
   Без эмодзи. Цепочка: welcome → invite → magnet1..4.
   ============================================================ */
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/db.php';

/* 4 лид-магнита (файлы лежат в корне, красивые ссылки) */
function magnets() {
  return [
    'magnet1' => ['title' => 'Правила Texas Hold\'em за 5 минут', 'url' => SITE_URL . '/poker-pravila',
                  'tag' => 'Покер с нуля', 'desc' => 'Короткий разбор: садишься за стол и всё понимаешь.'],
    'magnet2' => ['title' => 'Как читать людей', 'url' => SITE_URL . '/chitat-lyudey',
                  'tag' => 'Психология за столом', 'desc' => 'Считывай соперника по жестам, темпу и дыханию.'],
    'magnet3' => ['title' => '5 игр для мозга', 'url' => SITE_URL . '/igry-dlya-mozga',
                  'tag' => 'Прокачка ума', 'desc' => 'Здоровый дофамин и тренировка вместо ленты.'],
    'magnet4' => ['title' => '10 шагов, чтобы всегда быть в игре', 'url' => SITE_URL . '/10-shagov',
                  'tag' => 'Система игрока', 'desc' => 'Дисциплина и голова, которые работают везде.'],
  ];
}

/* Кнопки канала-прогрева (всегда есть «Записаться» + канал) */
function clubButtons($extra = []) {
  return array_merge($extra, [
    ['Записаться', TG_BOT_LINK, 'primary'],
    ['Подпишись на анонсы', TG_CHANNEL, 'ghost'],
  ]);
}

/* 1. Сразу после заявки: «получили — приглашение скоро» */
function welcomeEmail($name) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $txt = setting('welcome_text');
  $content = "<p style=\"margin:0 0 12px;\">Привет, <b style=\"color:#fff;\">$n</b>!</p>"
    . "<p style=\"margin:0 0 8px;\">" . htmlspecialchars($txt) . "</p>"
    . "<p style=\"margin:14px 0 0;color:#9a9a9a;font-size:13px;\">Дальше пришлём приглашение в клуб и подборку полезных материалов.</p>";
  return emailTpl('Заявка принята', $content,
    clubButtons([['Мы в Telegram', TG_CHANNEL, 'ghost']]),
    'Мы получили твою заявку — приглашение уже в пути.');
}

/* 2. Приглашение в клуб с адресом и кнопками */
function inviteEmail($name) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $addr = htmlspecialchars(setting('club_address'));
  $map  = setting('club_address_map');
  $txt  = htmlspecialchars(setting('invite_text'));
  $content = "<p style=\"margin:0 0 14px;\">$n, " . $txt . "</p>"
    . "<div style=\"background:#101010;border:1px solid #242424;border-radius:14px;padding:18px;margin:6px 0 4px;text-align:left;\">"
    . "<div style=\"font-size:11px;letter-spacing:3px;color:#8a8a8a;\">АДРЕС КЛУБА</div>"
    . "<div style=\"color:#fff;font-size:17px;font-weight:700;margin-top:6px;\">$addr</div></div>";
  return emailTpl('Твоё приглашение в клуб', $content,
    clubButtons([['Открыть на карте', $map, 'ghost']]),
    'Адрес клуба и ссылки внутри. Ждём тебя за столом.');
}

/* 3. Лид-магнит по типу (magnet1..4) */
function magnetEmail($name, $kind = 'magnet1') {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $m = magnets()[$kind] ?? magnets()['magnet1'];
  $content = "<p style=\"margin:0 0 14px;\">$n, держи материал из подборки клуба:</p>"
    . "<div style=\"background:#101010;border:1px solid #242424;border-radius:16px;padding:20px;margin:4px 0;\">"
    . "<div style=\"font-size:11px;letter-spacing:2px;color:" . BRAND_RED . ";font-weight:700;\">" . htmlspecialchars(mb_strtoupper($m['tag'])) . "</div>"
    . "<div style=\"color:#fff;font-size:19px;font-weight:800;margin:8px 0 6px;\">" . htmlspecialchars($m['title']) . "</div>"
    . "<div style=\"color:#9a9a9a;font-size:14px;\">" . htmlspecialchars($m['desc']) . "</div></div>";
  return emailTpl('Материал от DUCK\'S', $content,
    clubButtons([['Читать материал', $m['url'], 'primary2']]),
    $m['title']);
}

/* 4. Именной купон — красивое письмо с кнопками «Скачать» и «Предъявить» */
function couponEmail($name, $number, $discount) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $num = htmlspecialchars($number);
  $page = SITE_URL . '/api.php?action=couponCard&number=' . urlencode($number);
  $content = "<p style=\"margin:0 0 14px;\">$n, поздравляем — купон твой!</p>"
    . "<div style=\"background:linear-gradient(135deg,#1a0000,#0a0a0a);border:1px solid " . BRAND_RED . ";"
    . "border-radius:18px;padding:24px;margin:6px 0;\">"
    . "<div style=\"font-size:52px;font-weight:900;color:#fff;line-height:1;\">$discount<span style=\"font-size:24px;color:" . BRAND_RED . ";\">%</span></div>"
    . "<div style=\"font-size:12px;letter-spacing:3px;color:#aaa;margin-top:8px;\">СКИДКА НА ВЕЧЕР</div>"
    . "<div style=\"font-size:13px;color:#777;margin-top:16px;\">Купон №</div>"
    . "<div style=\"font-size:21px;font-weight:800;color:" . BRAND_RED . ";letter-spacing:2px;\">$num</div></div>"
    . "<p style=\"margin:12px 0 0;color:#9a9a9a;font-size:13px;\">Открой купон, покажи QR на входе — кассир его отсканирует.</p>";
  return emailTpl('Твой купон −' . $discount . '%', $content,
    [['Скачать купон', $page, 'primary2'], ['Предъявить на входе', $page, 'ghost'],
     ['Записаться', TG_BOT_LINK, 'primary'], ['Подпишись на анонсы', TG_CHANNEL, 'ghost']],
    'Именной купон со скидкой — внутри.');
}

/* Красивая страница купона: QR + скачать как фото + кнопки клуба */
function couponCardHtml($name, $number, $discount) {
  $n = htmlspecialchars($name); $num = htmlspecialchars($number);
  $verify = SITE_URL . '/api.php?action=verifyCoupon&number=' . urlencode($number);
  $mascot = DUCK_MASCOT_URL;
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
  . '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Купон DUCK\'S −' . $discount . '%</title>'
  . '<style>*{box-sizing:border-box}body{margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;'
  . 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;}'
  . '.card{width:340px;background:linear-gradient(155deg,#170000,#0a0a0a);border:1px solid ' . BRAND_RED . ';'
  . 'border-radius:26px;padding:26px 26px 30px;text-align:center;box-shadow:0 24px 70px rgba(204,0,0,.4);}'
  . '.mascot{width:78px;height:78px;object-fit:contain;}.wm{font-weight:900;letter-spacing:3px;color:#fff;font-size:17px;margin-top:2px;}'
  . '.wm span{color:' . BRAND_RED . '}.pct{font-size:74px;font-weight:900;color:#fff;line-height:1;margin-top:10px;}'
  . '.pct span{color:' . BRAND_RED . ';font-size:34px}.lbl{letter-spacing:4px;color:#8a8a8a;font-size:12px;margin:6px 0 16px;}'
  . '.nm{color:#fff;font-size:20px;font-weight:700;}.num{margin-top:6px;color:' . BRAND_RED . ';font-weight:800;letter-spacing:2px;font-size:16px;}'
  . '#qr{margin:18px auto 6px;width:170px;height:170px;background:#fff;border-radius:14px;padding:10px;}'
  . '.hint{color:#777;font-size:12px;margin-top:8px;}'
  . '.btns{width:340px;margin-top:16px;display:flex;flex-direction:column;gap:10px;}'
  . '.btn{display:block;text-decoration:none;text-align:center;font-weight:800;font-size:15px;padding:14px;border-radius:40px;}'
  . '.btn.r{background:' . BRAND_RED . ';color:#fff;border:none;cursor:pointer;}'
  . '.btn.o{background:transparent;color:#fff;border:1px solid #333;}</style></head>'
  . '<body><div class="card" id="cap">'
  . '<img class="mascot" src="' . $mascot . '" alt="DUCK\'S"><div class="wm">DUCK<span>&#39;</span>S</div>'
  . '<div class="pct">' . $discount . '<span>%</span></div><div class="lbl">СКИДКА НА ВЕЧЕР</div>'
  . '<div class="nm">' . $n . '</div><div class="num">№ ' . $num . '</div>'
  . '<div id="qr"></div><div class="hint">Покажи QR на входе</div></div>'
  . '<div class="btns">'
  . '<button class="btn r" id="dl">Скачать как фото</button>'
  . '<a class="btn r" href="' . TG_BOT_LINK . '" target="_blank">Записаться</a>'
  . '<a class="btn o" href="' . TG_CHANNEL . '" target="_blank">Мы в Telegram</a></div>'
  . '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>'
  . '<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>'
  . '<script>'
  . 'try{var q=qrcode(0,"M");q.addData(' . json_encode($verify) . ');q.make();'
  . 'document.getElementById("qr").innerHTML=q.createImgTag(5,0);'
  . 'var im=document.querySelector("#qr img");if(im){im.style.width="100%";im.style.height="100%";}}catch(e){}'
  . 'document.getElementById("dl").onclick=function(){html2canvas(document.getElementById("cap"),{backgroundColor:null,scale:2}).then(function(cv){'
  . 'var a=document.createElement("a");a.download="kupon-' . $num . '.png";a.href=cv.toDataURL("image/png");a.click();});};'
  . '</script></body></html>';
}

/* Письмо руководителям (ТОЛЬКО на ящик клуба) — отчёт о заполнении + что отправлено клиенту */
function adminLeadHtml($d, $kind = 'Заявка') {
  $rows = '';
  foreach (['name'=>'Имя','email'=>'Почта','phone'=>'Телефон','game'=>'Игра',
            'format'=>'Формат','score'=>'Очки','number'=>'Купон №','source'=>'Источник'] as $k=>$label) {
    if (!empty($d[$k])) $rows .= "<tr><td style=\"padding:5px 12px;color:#8a8a8a;\">$label</td>"
      . "<td style=\"padding:5px 12px;color:#fff;font-weight:700;\">" . htmlspecialchars($d[$k]) . "</td></tr>";
  }
  $auto = $kind === 'Купон'
    ? 'Клиенту отправлен именной купон. Дальше авто-цепочка: приглашение и 4 материала.'
    : 'Клиенту отправлено письмо «заявка принята». Дальше авто: приглашение через ' . INVITE_DELAY_MIN . ' мин и 4 материала по расписанию.';
  $content = "<p style=\"margin:0 0 12px;\">Новый контакт с сайта:</p>"
    . "<table style=\"margin:0 auto;text-align:left;font-size:14px;border-collapse:collapse;\">$rows</table>"
    . "<p style=\"margin:16px 0 0;color:#9a9a9a;font-size:13px;\">$auto</p>";
  $btns = [];
  if (!empty($d['email'])) $btns[] = ['Написать клиенту', 'mailto:' . $d['email'], 'primary2'];
  if (!empty($d['phone'])) $btns[] = ['Позвонить', 'tel:' . preg_replace('/[^0-9+]/','',$d['phone']), 'ghost'];
  return emailTpl("$kind с сайта", $content, $btns, "$kind: " . ($d['name'] ?? '') . ' ' . ($d['phone'] ?? ''));
}
