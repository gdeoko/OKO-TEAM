<?php
/** Публичная проверка подлинности диплома. Переменная $number задана роутером. */
$number = trim((string)($number ?? ''));

/* ЭТА СТРАНИЦА ПОДТВЕРЖДАЕТ ПОДЛИННОСТЬ — И ТОЛЬКО.
 *
 * Номера дипломов идут строго подряд, страница открыта всем и раньше отдавала по
 * каждому номеру полную карточку: ФИО ребёнка, педагога, учреждение и город. То есть
 * перебором MM-2026-00001…00500 выгружалась вся база участников с их школами.
 *
 * Что осталось: конкурс, тип, номинация, звание, дата выдачи, номер — этого хватает,
 * чтобы работодатель или аттестационная комиссия убедились в подлинности документа,
 * который им и так показали на руках. Персональные данные третьих лиц (педагог,
 * учреждение, город) со страницы убраны, ФИО участника показывается сокращённо.
 * Плюс ограничение частоты: перебор становится бессмысленным.
 */
$d = null;
$verifyLimited = false;
if ($number !== '') {
    // 40 проверок с адреса в час — живому человеку хватает с запасом.
    if (function_exists('rate_ok') && !rate_ok('verify:' . client_ip(), 40, 3600)) {
        $verifyLimited = true;
    } else {
        $d = one("SELECT d.*, a.full_name, a.nomination, a.work_title, a.user_id,
                         a.result AS app_result, c.name AS comp_name, c.type AS comp_type
                  FROM diplomas d
                  JOIN applications a ON a.id=d.application_id
                  LEFT JOIN competitions c ON c.id=a.competition_id
                  WHERE d.number=?", [$number]);
        // Документ, который ещё не выдан участнику, в реестре не подтверждаем:
        // иначе через реестр можно узнать результат раньше самого участника.
        if ($d && trim((string) ($d['sent_at'] ?? '')) === '') $d = null;
    }
}

/** ФИО для публичного реестра: «Иванов И. И.» — узнаваемо, но не выгружаемо списком. */
function verify_short_name(string $full): string {
    $p = preg_split('~\s+~u', trim($full)) ?: [];
    if (count($p) < 2) return trim($full);
    $out = $p[0];
    for ($i = 1; $i < min(3, count($p)); $i++) {
        $ini = mb_substr($p[$i], 0, 1);
        if ($ini !== '') $out .= ' ' . mb_strtoupper($ini) . '.';
    }
    return $out;
}

if ($d) {
    // Фиксируем факт проверки.
    insert('verify_log', ['diploma_number' => $number, 'ip' => client_ip()]);
    q("UPDATE diplomas SET verified_count = verified_count + 1 WHERE id=?", [(int)$d['id']]);
    $result = $d['result'] ?: $d['app_result'];
    $issued = ru_date(substr((string)($d['sent_at'] ?: $d['created_at']), 0, 10));
    $vcount = (int)$d['verified_count'] + 1;
}

$searched = ($number !== '');
$verifyBase = rtrim(url('/verify'), '/');

ob_start(); ?>
<style>
.vfy{max-width:760px;margin:0 auto}

/* ── Поле ввода номера ─────────────────────────────────────── */
.vfy-search{background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);
  padding:22px 22px 24px;box-shadow:var(--shadow-card);backdrop-filter:blur(14px);margin:0 auto 30px;max-width:560px}
.vfy-search .lbl{display:flex;align-items:center;gap:9px;font-weight:600;color:var(--text-dim);font-size:.94rem;margin-bottom:12px}
.vfy-search .lbl svg{width:20px;height:20px;color:var(--gold-ink);flex:0 0 auto}
.vfy-form{display:flex;gap:10px;flex-wrap:wrap}
.vfy-form .field--float{flex:1 1 200px;margin:0}
.vfy-form input{letter-spacing:.04em}
.vfy-form .btn{flex:0 0 auto}

/* ── Кнопка сканирования QR ────────────────────────────────── */
.vfy-qr-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-width:52px;padding:0 14px;border-radius:12px;cursor:pointer;
  background:var(--glass-card);backdrop-filter:blur(18px);border:1px solid var(--glass-brd2);
  color:var(--gold-ink,var(--gold));transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.vfy-qr-btn svg{width:22px;height:22px}
.vfy-qr-btn:hover{transform:translateY(-1px);border-color:var(--gold);box-shadow:0 6px 18px color-mix(in srgb,var(--gold) 22%,transparent)}
.vfy-qr-btn:active{transform:translateY(0)}
.vfy-qr-msg{display:none;font-size:.82rem;color:var(--wine,#7A1522);margin:10px 0 0}
.vfy-qr-msg.show{display:flex;align-items:center;gap:7px}
.vfy-qr-msg svg{width:16px;height:16px;flex:0 0 auto}
[data-theme="dark"] .vfy-qr-msg{color:var(--error,#e88)}

/* ── Модалка сканера ───────────────────────────────────────── */
.qr-modal{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;
  padding:18px;background:color-mix(in srgb,var(--royal,#17307A) 26%,rgba(6,10,26,.62));backdrop-filter:blur(8px)}
.qr-modal.open{display:flex;animation:qrFade .22s ease}
@keyframes qrFade{from{opacity:0}to{opacity:1}}
.qr-card{width:100%;max-width:440px;background:var(--glass-card);backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);border-radius:20px;padding:18px 18px 20px;
  box-shadow:0 24px 70px rgba(4,8,24,.45);animation:qrPop .26s cubic-bezier(.34,1.4,.4,1)}
@keyframes qrPop{from{transform:translateY(14px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.qr-card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.qr-card-head svg.qri{width:20px;height:20px;color:var(--gold-ink,var(--gold));flex:0 0 auto}
.qr-card-head strong{font-family:var(--ff-display);font-weight:700;font-size:1.06rem;color:var(--text);flex:1 1 auto}
.qr-close{flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;cursor:pointer;
  background:var(--glass-card);border:1px solid var(--glass-brd2);border-radius:10px;color:var(--muted);
  transition:color .15s ease,border-color .15s ease}
.qr-close:hover{color:var(--text);border-color:var(--gold)}
.qr-close svg{width:17px;height:17px}
.qr-view{position:relative;border-radius:14px;overflow:hidden;background:#0A1330;
  border:1px solid var(--glass-brd2);aspect-ratio:4/3}
.qr-view video{width:100%;height:100%;object-fit:cover;display:block}
.qr-frame{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.qr-frame svg{width:56%;max-width:210px;height:auto;color:var(--gold,#E9C567);opacity:.9;
  filter:drop-shadow(0 0 10px color-mix(in srgb,var(--gold) 45%,transparent))}
.qr-scanline{position:absolute;left:12%;right:12%;height:2px;border-radius:2px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
  animation:qrScan 2.4s ease-in-out infinite;pointer-events:none}
@keyframes qrScan{0%,100%{top:24%}50%{top:74%}}
.qr-status{font-size:.86rem;color:var(--muted);margin:12px 0 0;display:flex;align-items:center;gap:8px;
  min-height:20px;word-break:normal;hyphens:none}
.qr-status svg{width:16px;height:16px;color:var(--gold-ink,var(--gold));flex:0 0 auto}
.vfy-hint{font-size:.82rem;color:var(--muted);margin:12px 0 0;display:flex;align-items:center;gap:7px}
.vfy-hint svg{width:16px;height:16px;color:var(--gold-2);flex:0 0 auto}

/* ── Крупный статус ────────────────────────────────────────── */
.vfy-status{text-align:center;margin:6px auto 26px}
.vfy-badge{width:104px;height:104px;margin:0 auto 16px;border-radius:50%;display:grid;place-items:center;position:relative}
.vfy-badge svg{width:104px;height:104px;overflow:visible}
.vfy-badge--ok{background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--mint) 26%,transparent),transparent 68%)}
.vfy-badge--fail{background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--error) 22%,transparent),transparent 68%)}
.vfy-badge--ok::after{content:"";position:absolute;inset:-6px;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--mint) 40%,transparent);animation:vfyPulse 2.8s ease-out infinite}
@keyframes vfyPulse{0%{transform:scale(.86);opacity:.7}70%,100%{transform:scale(1.28);opacity:0}}
.vfy-ring{stroke:var(--mint);stroke-width:2.4;fill:none;stroke-linecap:round;
  stroke-dasharray:295;stroke-dashoffset:295;animation:vfyDraw .7s cubic-bezier(.4,0,.2,1) .1s forwards}
.vfy-tick{stroke:var(--mint);stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:48;stroke-dashoffset:48;animation:vfyDraw .5s cubic-bezier(.4,0,.2,1) .6s forwards}
.vfy-ring--fail{stroke:var(--error)}
.vfy-cross{stroke:var(--error);stroke-width:3;fill:none;stroke-linecap:round;
  stroke-dasharray:26;stroke-dashoffset:26;animation:vfyDraw .4s ease .55s forwards}
.vfy-cross.b{animation-delay:.75s}
@keyframes vfyDraw{to{stroke-dashoffset:0}}
.vfy-status h1{font-family:var(--ff-display);font-size:clamp(1.7rem,5.4vw,2.6rem);line-height:1.05;margin:0 0 6px}
.vfy-status--ok h1{color:var(--mint)}
.vfy-status--fail h1{color:var(--error)}
.vfy-status p{color:var(--text-dim);margin:0;font-size:1rem}
.vfy-status .num{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;
  color:var(--gold-ink);font-weight:600;background:var(--gold-soft);border:1px solid var(--glass-brd);
  padding:2px 10px;border-radius:999px;font-size:.92rem;display:inline-block;margin-top:2px;overflow-wrap:anywhere}

/* ── Премиум-сертификат ────────────────────────────────────── */
.cert{position:relative;background:var(--panel-solid);border:1.5px solid var(--gold);
  border-radius:var(--radius);padding:34px 30px 0;box-shadow:var(--shadow-3d),var(--shadow-glow);
  text-align:center;overflow:hidden}
[data-theme="dark"] .cert{background:var(--panel);backdrop-filter:blur(14px)}
/* тонкая гильош-текстура (защитный фон) */
.cert-guilloche{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background:
    repeating-radial-gradient(circle at 18% 12%,transparent 0 13px,color-mix(in srgb,var(--gold) 8%,transparent) 13px 14px),
    repeating-radial-gradient(circle at 82% 88%,transparent 0 13px,color-mix(in srgb,var(--gold) 8%,transparent) 13px 14px)}
[data-theme="dark"] .cert-guilloche{opacity:.35}
/* световой блик, медленно проходит по сертификату */
.cert::before{z-index:3}
.cert-shine{position:absolute;top:0;left:-70%;width:55%;height:100%;z-index:1;pointer-events:none;
  background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--gold) 16%,transparent),transparent);
  transform:skewX(-16deg);animation:certShine 5.5s ease-in-out 1s infinite}
@keyframes certShine{0%{left:-70%}45%,100%{left:135%}}
.cert::before{content:"";position:absolute;inset:9px;border:1px solid var(--glass-brd);border-radius:12px;pointer-events:none;z-index:2}
.cert::after{content:"";position:absolute;inset:13px;border:1px dashed color-mix(in srgb,var(--gold) 34%,transparent);border-radius:9px;pointer-events:none;z-index:2}
/* водяной знак-лого */
.cert-wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:min(72%,340px);
  opacity:.05;pointer-events:none;z-index:0;filter:grayscale(.2)}
[data-theme="dark"] .cert-wm{opacity:.08}
/* угловые гильош-орнаменты */
.cert-corner{position:absolute;width:44px;height:44px;color:var(--gold);opacity:.5;z-index:2;pointer-events:none}
.cert-corner.tl{top:16px;left:16px}
.cert-corner.tr{top:16px;right:16px;transform:scaleX(-1)}
.cert-corner.bl{bottom:16px;left:16px;transform:scaleY(-1)}
.cert-corner.br{bottom:16px;right:16px;transform:scale(-1)}
.cert-inner{position:relative;z-index:2}
/* лого-медальон с золотым ореолом */
.cert-medallion{position:relative;width:104px;height:104px;margin:0 auto 12px;display:grid;place-items:center}
.cert-medallion::before{content:"";position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 0deg,var(--gold),transparent 25%,var(--gold) 50%,transparent 75%,var(--gold));
  opacity:.28;animation:certRing 14s linear infinite}
.cert-medallion::after{content:"";position:absolute;inset:6px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--gold) 40%,transparent)}
@keyframes certRing{to{transform:rotate(360deg)}}
.cert-logo{position:relative;z-index:1;width:88px;height:88px;border-radius:50%;
  box-shadow:0 4px 22px rgba(201,168,76,.34);border:1.5px solid var(--glass-brd);background:var(--panel-solid)}
.cert-org{font-family:var(--ff-serif);font-weight:700;color:var(--gold-ink);font-size:1.05rem;letter-spacing:.01em;margin-bottom:2px}
.cert-sub{font-family:var(--ff-script);font-size:1.15rem;color:var(--gold-2);line-height:1;margin-bottom:14px}
/* лавровый разделитель */
.cert-laurel{display:flex;align-items:center;justify-content:center;gap:12px;color:var(--gold);opacity:.7;margin:0 auto 14px}
.cert-laurel svg{width:26px;height:26px}
.cert-laurel .ln{width:54px;height:1px;background:linear-gradient(90deg,transparent,var(--gold))}
.cert-laurel .ln.r{transform:scaleX(-1)}
.cert-seal{display:inline-flex;align-items:center;gap:8px;background:color-mix(in srgb,var(--mint) 15%,transparent);
  color:var(--mint);font-weight:700;padding:8px 16px;border-radius:999px;font-size:.9rem;
  border:1px solid color-mix(in srgb,var(--mint) 34%,transparent)}
.cert-seal svg{width:17px;height:17px}
.cert-result{font-family:var(--ff-display);font-weight:800;color:var(--gold-2);
  font-size:clamp(1.5rem,5.2vw,2.2rem);line-height:1.1;margin:18px 0 2px;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.cert-name{font-family:var(--ff-serif);font-weight:700;font-size:clamp(1.2rem,4.4vw,1.5rem);margin:12px 0 2px;color:var(--text)}
.cert-work{color:var(--muted);margin:2px 0 0;font-style:italic;overflow-wrap:anywhere}
.cert-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;margin:24px 0 0}
.cert-grid .fld{background:var(--glass);border:1px solid var(--glass-brd);border-radius:var(--radius-sm);
  padding:12px 15px;backdrop-filter:blur(8px)}
.cert-grid .fld span{display:block;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.09em;margin-bottom:4px}
.cert-grid .fld strong{font-weight:600;color:var(--text);font-size:.98rem;overflow-wrap:anywhere}
.cert-grid .fld.mono strong{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em}
/* микротекст-лента внизу (защитный элемент) */
.cert-micro{margin:26px -30px 0;padding:7px 0;background:var(--gold-soft);border-top:1px solid var(--glass-brd);
  overflow:hidden;white-space:nowrap}
.cert-micro span{display:inline-block;font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--gold-deep);opacity:.75;font-weight:600}
.cert-meta{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;
  color:var(--muted);font-size:.86rem;margin:18px auto 4px;max-width:600px}
.cert-meta svg{width:15px;height:15px;color:var(--mint);flex:0 0 auto}

/* ── Поделиться результатом ────────────────────────────────── */
.vfy-share{display:flex;justify-content:center;margin:20px auto 4px}
.vfy-share .btn{display:inline-flex;align-items:center;gap:9px}
.vfy-share .btn svg{width:17px;height:17px;flex:0 0 auto}

/* ── Не найден ─────────────────────────────────────────────── */
.notfound{text-align:center;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:38px 26px;box-shadow:var(--shadow-card);backdrop-filter:blur(14px)}
.notfound h3{margin:0 0 8px}
.notfound p{color:var(--muted);max-width:440px;margin:0 auto 20px}
.notfound .num{font-family:ui-monospace,Menlo,monospace;color:var(--text);overflow-wrap:anywhere}

@media(max-width:560px){
  .cert{padding:28px 20px 0}
  .cert-grid{grid-template-columns:1fr}
  .cert-micro{margin-left:-20px;margin-right:-20px}
  .vfy-form .btn{width:100%}
}
@media(prefers-reduced-motion:reduce){
  .vfy-ring,.vfy-tick,.vfy-cross{animation:none;stroke-dashoffset:0}
  .vfy-badge--ok::after{animation:none;display:none}
  .cert-shine{animation:none;display:none}
  .cert-medallion::before{animation:none}
  .qr-modal.open,.qr-card{animation:none}
  .qr-scanline{animation:none;top:50%}
  .vfy-qr-btn{transition:none}
}
</style>

<section class="section section--tint">
  <div class="container vfy">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head reveal" style="margin-bottom:26px">
      <p class="eyebrow">Проверка подлинности</p>
      <h2>Реестр наградных документов</h2>
      <div class="gold-rule"></div>
    </div>

    <!-- Поле ввода номера / QR -->
    <div class="vfy-search reveal">
      <div class="lbl">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        Введите номер диплома или отсканируйте QR-код
      </div>
      <form class="vfy-form" id="vfyForm" autocomplete="off" novalidate>
        <div class="field--float">
          <input type="text" id="vfyNum" name="number" placeholder=" " inputmode="latin"
                 value="<?= h($number) ?>" aria-label="Номер диплома">
          <label for="vfyNum">Номер документа</label>
        </div>
        <button type="button" class="vfy-qr-btn" id="vfyQrBtn" aria-label="Сканировать QR-код диплома" title="Сканировать QR-код">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/>
            <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M17.5 21H21v-3.5"/>
          </svg>
        </button>
        <button type="submit" class="btn btn--primary">Проверить</button>
      </form>
      <p class="vfy-qr-msg" id="vfyQrMsg" role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        Сканирование не поддерживается в этом браузере, введите номер вручную.
      </p>
      <p class="vfy-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        Номер напечатан на дипломе рядом с QR-кодом.
      </p>
    </div>

    <?php if ($searched && $d): ?>
      <!-- Крупный статус: подлинный -->
      <div class="vfy-status vfy-status--ok reveal">
        <div class="vfy-badge vfy-badge--ok">
          <svg viewBox="0 0 104 104" aria-hidden="true">
            <circle class="vfy-ring" cx="52" cy="52" r="47"/>
            <path class="vfy-tick" d="M34 53l12 12 24-26"/>
          </svg>
        </div>
        <h1>Диплом подлинный</h1>
        <p>Документ найден в реестре Культурного центра «Музыкальный Мир».</p>
        <div class="num">№ <?= h($d['number']) ?></div>
      </div>

      <!-- Премиум-сертификат -->
      <div class="cert reveal">
        <div class="cert-guilloche" aria-hidden="true"></div>
        <div class="cert-shine" aria-hidden="true"></div>
        <img class="cert-wm" src="<?= h(logo_data_uri()) ?>" alt="" aria-hidden="true">
        <svg class="cert-corner tl" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 40V14a10 10 0 0 1 10-10h26"/><path d="M10 40V17a7 7 0 0 1 7-7h23"/><circle cx="10" cy="40" r="2.4" fill="currentColor" stroke="none"/></svg>
        <svg class="cert-corner tr" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 40V14a10 10 0 0 1 10-10h26"/><path d="M10 40V17a7 7 0 0 1 7-7h23"/><circle cx="10" cy="40" r="2.4" fill="currentColor" stroke="none"/></svg>
        <svg class="cert-corner bl" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 40V14a10 10 0 0 1 10-10h26"/><path d="M10 40V17a7 7 0 0 1 7-7h23"/><circle cx="10" cy="40" r="2.4" fill="currentColor" stroke="none"/></svg>
        <svg class="cert-corner br" viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M4 40V14a10 10 0 0 1 10-10h26"/><path d="M10 40V17a7 7 0 0 1 7-7h23"/><circle cx="10" cy="40" r="2.4" fill="currentColor" stroke="none"/></svg>

        <div class="cert-inner">
          <div class="cert-medallion">
            <img class="cert-logo" src="<?= h(logo_data_uri()) ?>" alt="Логотип Культурного центра «Музыкальный Мир»">
          </div>
          <div class="cert-org">Культурный центр «Музыкальный Мир»</div>
          <div class="cert-sub">наградной документ</div>
          <div class="cert-laurel" aria-hidden="true">
            <span class="ln"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 5 5.4.5-4.1 3.6 1.2 5.3L12 18.9 7.1 21.4l1.2-5.3L4.2 7.5 9.6 7z"/></svg>
            <span class="ln r"></span>
          </div>
          <div class="cert-seal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>
            Подтверждено реестром
          </div>

          <?php if ($result): ?><div class="cert-result"><?= h($result) ?></div><?php endif; ?>
          <div class="cert-name"><?= h(verify_short_name((string) $d['full_name'])) ?></div>
          <?php if ($d['work_title']): ?><p class="cert-work"><?= h(wt_show((string) $d['work_title'])) ?></p><?php endif; ?>

          <div class="cert-grid">
            <div class="fld"><span>Конкурс</span><strong><?= h($d['comp_name'] ?: 'Конкурс Культурного центра «Музыкальный Мир»') ?></strong></div>
            <div class="fld"><span>Тип</span><strong><?= $d['comp_type']==='national' ? 'Всероссийский' : 'Международный' ?></strong></div>
            <?php if ($d['nomination']): ?><div class="fld"><span>Номинация</span><strong><?= h($d['nomination']) ?></strong></div><?php endif; ?>
            <?php /* Педагог, учреждение и город здесь больше не печатаются: это
                     персональные данные третьих лиц, а для подтверждения подлинности
                     они не нужны — документ и так на руках у того, кто проверяет. */ ?>
            <?php if ($issued): ?><div class="fld"><span>Дата выдачи</span><strong><?= h($issued) ?></strong></div><?php endif; ?>
            <div class="fld mono"><span>Номер</span><strong><?= h($d['number']) ?></strong></div>
          </div>

          <div class="cert-micro" aria-hidden="true">
            <span><?php for($i=0;$i<18;$i++){echo 'МУЗЫКАЛЬНЫЙ МИР • ПОДЛИННЫЙ ДОКУМЕНТ • ';}?></span>
          </div>
        </div>
      </div>

      <?php
      /* ПОЛНЫЙ БЛАНК ЗДЕСЬ БОЛЬШЕ НЕ ПОКАЗЫВАЕМ.
         На бланке напечатаны ФИО ребёнка, педагог, учреждение и город — то есть
         ровно то, что мы только что убрали из карточки выше. Оставить рядом врезку
         с самим документом означало бы не закрыть утечку, а просто перенести её
         на строку ниже. Свой диплом участник открывает в личном кабинете или по
         подписанной ссылке из письма; для проверки подлинности достаточно карточки.
         Сотруднику и владельцу заявки просмотр по-прежнему доступен. */
      $__me = function_exists('current_user') ? current_user() : null;
      $__canSeeBlank = $__me && (
          (function_exists('user_can') && user_can('jury'))
          || (int) ($d['user_id'] ?? 0) === (int) $__me['id']
      );
      ?>
      <?php if ($__canSeeBlank): ?>
      <div class="dip-visual reveal">
        <h2 class="dip-visual-h">Так выглядит сам диплом</h2>
        <div class="dip-embed" id="dipEmbed">
          <iframe src="<?= url('/diploma-view/'.$d['number']) ?>" loading="lazy" title="Диплом № <?= h($d['number']) ?>"></iframe>
        </div>
        <a class="btn btn--ghost btn--sm" href="<?= url('/diploma-view/'.$d['number']) ?>" target="_blank" rel="noopener" style="margin-top:12px">Открыть в полном размере</a>
      </div>
      <?php endif; ?>

      <div class="cert-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6 9 17l-5-5"/></svg>
        Сведения предоставлены реестром Культурного центра «Музыкальный Мир» и подтверждают подлинность документа<?php if(isset($vcount) && $vcount>1): ?> - проверялся <?= (int)$vcount ?> раз<?php endif; ?>.
      </div>
      <style>
      .dip-visual{margin:26px auto 0;max-width:560px;text-align:center}
      .dip-visual-h{font-family:var(--ff-display);font-size:1.15rem;margin:0 0 12px}
      .dip-embed{position:relative;width:100%;margin:0 auto;aspect-ratio:210/297;border-radius:14px;overflow:hidden;
        border:1px solid var(--line);box-shadow:0 18px 46px rgba(21,34,76,.28);background:#0a1330}
      .dip-embed iframe{position:absolute;top:0;left:0;width:794px;height:1123px;border:0;transform-origin:top left;background:#0a1330}
      </style>
      <script>
      (function(){
        var box=document.getElementById('dipEmbed'); if(!box) return;
        var fr=box.querySelector('iframe');
        function fit(){ var w=box.clientWidth; fr.style.transform='scale('+(w/794)+')'; }
        fit(); window.addEventListener('resize',fit);
        setTimeout(fit,300);
      })();
      </script>

      <?php $shareUrl = $verifyBase . '/' . rawurlencode((string)$d['number']); ?>
      <div class="vfy-share reveal">
        <button class="btn btn--ghost" type="button" data-share
                data-share-title="Диплом № <?= h($d['number']) ?> - Культурного центра «Музыкальный Мир»"
                data-share-url="<?= h($shareUrl) ?>">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          Поделиться
        </button>
      </div>

    <?php elseif ($searched && !$d): ?>
      <!-- Крупный статус: не найден -->
      <div class="vfy-status vfy-status--fail reveal">
        <div class="vfy-badge vfy-badge--fail">
          <svg viewBox="0 0 104 104" aria-hidden="true">
            <circle class="vfy-ring vfy-ring--fail" cx="52" cy="52" r="47"/>
            <path class="vfy-cross" d="M39 39l26 26"/>
            <path class="vfy-cross b" d="M65 39 39 65"/>
          </svg>
        </div>
        <h1><?= $verifyLimited ? 'Слишком много проверок' : 'Диплом не найден' ?></h1>
        <p><?= $verifyLimited
              ? 'С этого адреса за последний час было слишком много обращений к реестру. Повторите проверку немного позже.'
              : 'В реестре нет документа с таким номером — либо он ещё не выдан участнику.' ?></p>
        <div class="num">№ <?= h($number ?: '-') ?></div>
      </div>

      <div class="notfound reveal">
        <p>Проверьте правильность номера, указанного на дипломе рядом с QR-кодом. Если Вы уверены в номере - напишите нам, и мы поможем.</p>
        <a class="btn btn--ghost" href="<?= url('/contacts') ?>">Связаться с нами</a>
      </div>
    <?php endif; ?>
  </div>
</section>

<!-- Модалка сканера QR-кода -->
<div class="qr-modal" id="qrModal" role="dialog" aria-modal="true" aria-label="Сканирование QR-кода диплома">
  <div class="qr-card">
    <div class="qr-card-head">
      <svg class="qri" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/>
        <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M17.5 21H21v-3.5"/>
      </svg>
      <strong>Сканирование QR-кода</strong>
      <button type="button" class="qr-close" id="qrClose" aria-label="Закрыть сканер">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="qr-view">
      <video id="qrVideo" playsinline muted autoplay></video>
      <div class="qr-frame" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <path d="M8 30V14a6 6 0 0 1 6-6h16M70 8h16a6 6 0 0 1 6 6v16M92 70v16a6 6 0 0 1-6 6H70M30 92H14a6 6 0 0 1-6-6V70"/>
        </svg>
      </div>
      <div class="qr-scanline" aria-hidden="true"></div>
    </div>
    <p class="qr-status" id="qrStatus">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <span id="qrStatusText">Наведите камеру на QR-код диплома.</span>
    </p>
  </div>
</div>

<script>
(function(){
  var base = <?= json_encode($verifyBase, JSON_UNESCAPED_SLASHES) ?>;
  var form = document.getElementById('vfyForm');
  var input = document.getElementById('vfyNum');
  if(!form) return;

  function go(v){
    v = (v || '').trim();
    if(!v) return;
    window.location.href = base + '/' + encodeURIComponent(v);
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    go(input.value);
  });

  /* ── Сканер QR-кода ── */
  var qrBtn = document.getElementById('vfyQrBtn');
  var qrMsg = document.getElementById('vfyQrMsg');
  var modal = document.getElementById('qrModal');
  var video = document.getElementById('qrVideo');
  var statusText = document.getElementById('qrStatusText');
  var closeBtn = document.getElementById('qrClose');
  if(!qrBtn || !modal) return;

  var stream = null, scanning = false, detector = null;

  function setStatus(t){ if(statusText) statusText.textContent = t; }

  function stopScan(){
    scanning = false;
    if(stream){
      try{ stream.getTracks().forEach(function(tr){ tr.stop(); }); }catch(e){}
      stream = null;
    }
    try{ video.srcObject = null; }catch(e){}
    modal.classList.remove('open');
    document.documentElement.style.overflow = '';
  }

  // Найденный текст: если это ссылка вида .../verify/НОМЕР — берём номер,
  // иначе подставляем текст целиком как номер.
  function handleResult(raw){
    raw = (raw || '').trim();
    if(!raw) return;
    var num = raw;
    if(/^https?:\/\//i.test(raw) && raw.indexOf('/verify') !== -1){
      try{
        var path = new URL(raw).pathname;
        var m = path.match(/\/verify\/?([^\/?#]*)/i);
        if(m && m[1]) num = decodeURIComponent(m[1]);
      }catch(e){}
    }
    stopScan();
    if(input) input.value = num;
    go(num);
  }

  function tick(){
    if(!scanning || !detector) return;
    if(video.readyState >= 2){
      detector.detect(video).then(function(codes){
        if(scanning && codes && codes.length && codes[0].rawValue){
          handleResult(codes[0].rawValue);
          return;
        }
        if(scanning) requestAnimationFrame(tick);
      }).catch(function(){
        if(scanning) setTimeout(tick, 250);
      });
    } else if(scanning){
      requestAnimationFrame(tick);
    }
  }

  function startScan(){
    // Fallback: без BarcodeDetector обработать кадр не сможем — честно сообщаем.
    if(!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      if(qrMsg) qrMsg.classList.add('show');
      return;
    }
    modal.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setStatus('Запрашиваем доступ к камере…');
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false
    }).then(function(s){
      stream = s;
      video.srcObject = s;
      return video.play().catch(function(){});
    }).then(function(){
      try{ detector = new BarcodeDetector({ formats: ['qr_code'] }); }
      catch(e){ detector = new BarcodeDetector(); }
      scanning = true;
      setStatus('Наведите камеру на QR-код диплома.');
      requestAnimationFrame(tick);
    }).catch(function(){
      setStatus('Не удалось получить доступ к камере. Разрешите доступ или введите номер вручную.');
    });
  }

  qrBtn.addEventListener('click', startScan);
  closeBtn.addEventListener('click', stopScan);
  modal.addEventListener('click', function(e){ if(e.target === modal) stopScan(); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && modal.classList.contains('open')) stopScan();
  });
  window.addEventListener('pagehide', function(){ if(stream) stopScan(); });
})();
</script>
<?php
$content = ob_get_clean();
$ttl = $d ? ('Диплом № ' . $number) : 'Проверка диплома';
render_page($ttl, $content, ['active' => '', 'meta' => 'Проверка подлинности наградных документов Культурного центра «Музыкальный Мир» по номеру или QR-коду.']);
