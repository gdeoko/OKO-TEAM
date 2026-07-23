<?php
/** Публичная проверка подлинности диплома. Переменная $number задана роутером. */
$number = trim((string)($number ?? ''));

$d = null;
if ($number !== '') {
    $d = one("SELECT d.*, a.full_name, a.nomination, a.work_title, a.teacher, a.institution, a.city,
                     a.result AS app_result, c.name AS comp_name, c.type AS comp_type
              FROM diplomas d
              JOIN applications a ON a.id=d.application_id
              LEFT JOIN competitions c ON c.id=a.competition_id
              WHERE d.number=?", [$number]);
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
.vfy-form .field--float{flex:1 1 220px;margin:0}
.vfy-form input{letter-spacing:.04em}
.vfy-form .btn{flex:0 0 auto}
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
}
</style>

<section class="section section--tint">
  <div class="container vfy">
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
        <button type="submit" class="btn btn--primary">Проверить</button>
      </form>
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
        <p>Документ найден в реестре КЦ «Музыкальный Мир».</p>
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
            <img class="cert-logo" src="<?= h(logo_data_uri()) ?>" alt="Логотип КЦ «Музыкальный Мир»">
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
          <div class="cert-name"><?= h($d['full_name']) ?></div>
          <?php if ($d['work_title']): ?><p class="cert-work">«<?= h($d['work_title']) ?>»</p><?php endif; ?>

          <div class="cert-grid">
            <div class="fld"><span>Конкурс</span><strong><?= h($d['comp_name'] ?: 'Конкурс КЦ «Музыкальный Мир»') ?></strong></div>
            <div class="fld"><span>Тип</span><strong><?= $d['comp_type']==='national' ? 'Всероссийский' : 'Международный' ?></strong></div>
            <?php if ($d['nomination']): ?><div class="fld"><span>Номинация</span><strong><?= h($d['nomination']) ?></strong></div><?php endif; ?>
            <?php if ($d['teacher']): ?><div class="fld"><span>Педагог</span><strong><?= h($d['teacher']) ?></strong></div><?php endif; ?>
            <?php if ($d['institution']): ?><div class="fld"><span>Учреждение</span><strong><?= h($d['institution']) ?></strong></div><?php endif; ?>
            <?php if ($d['city']): ?><div class="fld"><span>Город</span><strong><?= h($d['city']) ?></strong></div><?php endif; ?>
            <?php if ($issued): ?><div class="fld"><span>Дата выдачи</span><strong><?= h($issued) ?></strong></div><?php endif; ?>
            <div class="fld mono"><span>Номер</span><strong><?= h($d['number']) ?></strong></div>
          </div>

          <div class="cert-micro" aria-hidden="true">
            <span><?php for($i=0;$i<18;$i++){echo 'МУЗЫКАЛЬНЫЙ МИР • ПОДЛИННЫЙ ДОКУМЕНТ • ';}?></span>
          </div>
        </div>
      </div>

      <div class="cert-meta">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 6 9 17l-5-5"/></svg>
        Сведения предоставлены реестром КЦ «Музыкальный Мир» и подтверждают подлинность документа<?php if(isset($vcount) && $vcount>1): ?> - проверялся <?= (int)$vcount ?> раз<?php endif; ?>.
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
        <h1>Диплом не найден</h1>
        <p>В реестре нет документа с таким номером.</p>
        <div class="num">№ <?= h($number ?: '-') ?></div>
      </div>

      <div class="notfound reveal">
        <p>Проверьте правильность номера, указанного на дипломе рядом с QR-кодом. Если Вы уверены в номере - напишите нам, и мы поможем.</p>
        <a class="btn btn--ghost" href="<?= url('/contacts') ?>">Связаться с нами</a>
      </div>
    <?php endif; ?>
  </div>
</section>

<script>
(function(){
  var base = <?= json_encode($verifyBase, JSON_UNESCAPED_SLASHES) ?>;
  var form = document.getElementById('vfyForm');
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = (document.getElementById('vfyNum').value || '').trim();
    if(!v) return;
    window.location.href = base + '/' + encodeURIComponent(v);
  });
})();
</script>
<?php
$content = ob_get_clean();
$ttl = $d ? ('Диплом № ' . $number) : 'Проверка диплома';
render_page($ttl, $content, ['active' => '', 'meta' => 'Проверка подлинности наградных документов КЦ «Музыкальный Мир» по номеру или QR-коду.']);
