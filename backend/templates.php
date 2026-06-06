<?php
/* ============================================================
   DUCK'S — готовые письма в фирменном стиле (на базе emailTpl).
   welcomeEmail, inviteEmail, couponEmail, magnetEmail, adminLeadEmail.
   ============================================================ */
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/db.php';

/* 1. Сразу после заявки: «получили — приглашение скоро» */
function welcomeEmail($name) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $txt = setting('welcome_text');
  $content = "<p style=\"margin:0 0 12px;\">Привет, <b style=\"color:#fff;\">$n</b>!</p>"
    . "<p style=\"margin:0 0 8px;\">" . htmlspecialchars($txt) . "</p>";
  return emailTpl('Заявка принята 🦆', $content,
    [['Наш Telegram-канал', TG_CHANNEL], ['Написать боту', TG_BOT_LINK]],
    'Мы получили твою заявку — персональное приглашение уже в пути.');
}

/* 2. Через 15 минут: приглашение в клуб с адресом и кнопками */
function inviteEmail($name) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $addr = htmlspecialchars(setting('club_address'));
  $map  = setting('club_address_map');
  $txt  = htmlspecialchars(setting('invite_text'));
  $content = "<p style=\"margin:0 0 14px;\">$n, " . $txt . "</p>"
    . "<div style=\"background:#101010;border:1px solid #222;border-radius:14px;padding:16px 18px;margin:6px 0 4px;\">"
    . "<div style=\"font-size:11px;letter-spacing:3px;color:#888;\">АДРЕС</div>"
    . "<div style=\"color:#fff;font-size:16px;font-weight:700;margin-top:4px;\">$addr</div></div>";
  $btns = [['Открыть на карте', $map], ['Telegram-канал', TG_CHANNEL], ['Бот клуба', TG_BOT_LINK]];
  return emailTpl('Твоё приглашение в DUCK\'S 🦆', $content, $btns,
    'Адрес клуба и ссылки внутри. Ждём тебя за столом.');
}

/* 3. Именной купон (дартс) — текст + сам купон во вложении HTML */
function couponEmail($name, $number, $discount) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $num = htmlspecialchars($number);
  $content = "<p style=\"margin:0 0 12px;\">$n, поздравляем — купон твой! 🎯</p>"
    . "<div style=\"background:linear-gradient(135deg,#1a0000,#0a0a0a);border:1px solid " . BRAND_RED . ";"
    . "border-radius:18px;padding:22px;margin:6px 0;\">"
    . "<div style=\"font-size:46px;font-weight:900;color:#fff;line-height:1;\">$discount<span style=\"font-size:22px;color:" . BRAND_RED . ";\">%</span></div>"
    . "<div style=\"font-size:12px;letter-spacing:3px;color:#aaa;margin-top:8px;\">СКИДКА НА ВЕЧЕР</div>"
    . "<div style=\"font-size:13px;color:#777;margin-top:14px;\">Купон №</div>"
    . "<div style=\"font-size:20px;font-weight:800;color:" . BRAND_RED . ";letter-spacing:2px;\">$num</div></div>"
    . "<p style=\"margin:10px 0 0;color:#999;font-size:13px;\">Покажи этот купон на входе. Купон именной — действует для тебя.</p>";
  return emailTpl('Твой купон −' . $discount . '% 🎯', $content,
    [['Telegram-канал', TG_CHANNEL], ['Бот клуба', TG_BOT_LINK]],
    'Именной купон со скидкой внутри письма.');
}

/* Скачиваемый красивый купон (отдельная HTML-страница) */
function couponCardHtml($name, $number, $discount) {
  $n = htmlspecialchars($name); $num = htmlspecialchars($number);
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
  . '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Купон DUCK\'S</title>'
  . '<style>body{margin:0;background:#050505;display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:Arial,sans-serif;}'
  . '.c{width:340px;background:linear-gradient(150deg,#160000,#0a0a0a);border:1px solid ' . BRAND_RED . ';border-radius:26px;padding:34px 30px;text-align:center;box-shadow:0 20px 60px rgba(204,0,0,.4);}'
  . '.d{font-size:40px;color:#fff;}.p{font-size:72px;font-weight:900;color:#fff;line-height:1;}.p span{color:' . BRAND_RED . ';font-size:32px;}'
  . '.l{letter-spacing:4px;color:#888;font-size:12px;margin:10px 0 22px;}.nm{color:#fff;font-size:20px;font-weight:700;}'
  . '.num{margin-top:14px;color:' . BRAND_RED . ';font-weight:800;letter-spacing:2px;font-size:18px;}'
  . '.b{margin-top:8px;font-size:11px;letter-spacing:3px;color:#fff;font-weight:900;}</style></head>'
  . '<body><div class="c"><div class="d">🦆</div><div class="b">DUCK&#39;S GAME SPACE</div>'
  . '<div class="p">' . $discount . '<span>%</span></div><div class="l">СКИДКА НА ВЕЧЕР</div>'
  . '<div class="nm">' . $n . '</div><div class="num">№ ' . $num . '</div>'
  . '<div style="margin-top:22px;color:#666;font-size:12px;">Покажи купон на входе в клуб</div></div></body></html>';
}

/* 4. Лид-магнит (warm-up) */
function magnetEmail($name) {
  $n = $name ? htmlspecialchars($name) : 'друг';
  $url = setting('magnet_url'); $title = htmlspecialchars(setting('magnet_title'));
  $content = "<p style=\"margin:0 0 12px;\">$n, держи подарок к заявке 🎁</p>"
    . "<p style=\"margin:0 0 6px;color:#fff;font-weight:700;font-size:17px;\">$title</p>"
    . "<p style=\"margin:0;color:#999;\">Короткий разбор, который реально пригодится. Открывай прямо в браузере.</p>";
  return emailTpl('Подарок от DUCK\'S 🎁', $content,
    [['Читать материал', $url], ['Telegram-канал', TG_CHANNEL]],
    'Лид-магнит внутри — открой и забери пользу.');
}

/* Письмо руководителям о новой заявке/купоне */
function adminLeadHtml($d, $kind = 'Заявка') {
  $rows = '';
  foreach (['name'=>'Имя','email'=>'Почта','phone'=>'Телефон','game'=>'Игра',
            'format'=>'Формат','score'=>'Очки','number'=>'Купон №','source'=>'Источник'] as $k=>$label) {
    if (!empty($d[$k])) $rows .= "<tr><td style=\"padding:4px 10px;color:#888;\">$label</td>"
      . "<td style=\"padding:4px 10px;color:#fff;font-weight:700;\">" . htmlspecialchars($d[$k]) . "</td></tr>";
  }
  $content = "<p style=\"margin:0 0 10px;\">Новый контакт с сайта:</p>"
    . "<table style=\"margin:0 auto;text-align:left;font-size:14px;\">$rows</table>";
  return emailTpl("🦆 $kind с сайта", $content, [], "$kind: " . ($d['name'] ?? '') . ' ' . ($d['phone'] ?? ''));
}
