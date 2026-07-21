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
}

ob_start(); ?>
<style>
.vfy{max-width:720px;margin:0 auto}
.cert{position:relative;background:linear-gradient(160deg,#FFFDF7,#FFF8E1);border:2px solid var(--gold);
  border-radius:var(--radius);padding:40px 36px;box-shadow:var(--shadow-hover);text-align:center;overflow:hidden}
.cert::before{content:"";position:absolute;inset:10px;border:1px solid var(--line);border-radius:10px;pointer-events:none}
.cert-logo{width:96px;height:96px;margin:0 auto 14px;border-radius:50%;box-shadow:0 4px 16px rgba(139,111,31,.25)}
.cert-seal{display:inline-flex;align-items:center;gap:8px;background:rgba(143,188,148,.18);color:#3f7a4a;
  font-weight:700;padding:8px 16px;border-radius:999px;font-size:.92rem;margin-bottom:8px}
.cert-num{font-family:var(--ff-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-size:.82rem;margin-bottom:18px}
.cert-result{font-family:var(--ff-head);color:var(--gold-dark);font-size:clamp(1.5rem,4vw,2.2rem);margin:6px 0 4px}
.cert-name{font-family:var(--ff-head);font-size:1.4rem;margin:14px 0 2px}
.cert-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;text-align:left;margin:24px 0 0;position:relative}
.cert-grid .fld{background:rgba(255,255,255,.6);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px}
.cert-grid .fld span{display:block;color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.cert-grid .fld strong{font-weight:600;color:var(--navy)}
.notfound{text-align:center;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:48px 28px;box-shadow:var(--shadow-card)}
@media(max-width:560px){.cert-grid{grid-template-columns:1fr}}
</style>
<section class="section section--tint">
  <div class="container vfy">
    <div class="section-head reveal" style="margin-bottom:28px">
      <p class="eyebrow">Проверка подлинности</p>
      <h2>Реестр наградных документов</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if ($d): ?>
      <div class="cert reveal">
        <img class="cert-logo" src="<?= h(logo_data_uri()) ?>" alt="Логотип КЦ «Музыкальный Мир»">
        <div class="cert-seal">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
          Документ подлинный
        </div>
        <div class="cert-num">Диплом № <?= h($d['number']) ?></div>
        <?php if ($result): ?><div class="cert-result"><?= h($result) ?></div><?php endif; ?>
        <div class="cert-name"><?= h($d['full_name']) ?></div>
        <?php if ($d['work_title']): ?><p style="color:var(--muted);margin:2px 0 0">«<?= h($d['work_title']) ?>»</p><?php endif; ?>

        <div class="cert-grid">
          <div class="fld"><span>Конкурс</span><strong><?= h($d['comp_name'] ?: 'Конкурс КЦ «Музыкальный Мир»') ?></strong></div>
          <div class="fld"><span>Тип</span><strong><?= $d['comp_type']==='national' ? 'Всероссийский' : 'Международный' ?></strong></div>
          <?php if ($d['nomination']): ?><div class="fld"><span>Номинация</span><strong><?= h($d['nomination']) ?></strong></div><?php endif; ?>
          <?php if ($d['teacher']): ?><div class="fld"><span>Педагог</span><strong><?= h($d['teacher']) ?></strong></div><?php endif; ?>
          <?php if ($d['institution']): ?><div class="fld"><span>Учреждение</span><strong><?= h($d['institution']) ?></strong></div><?php endif; ?>
          <?php if ($issued): ?><div class="fld"><span>Дата выдачи</span><strong><?= h($issued) ?></strong></div><?php endif; ?>
        </div>
      </div>
      <p style="text-align:center;color:var(--muted);font-size:.88rem;margin-top:18px">
        Сведения предоставлены реестром КЦ «Музыкальный Мир» и подтверждают подлинность документа.
      </p>
    <?php else: ?>
      <div class="notfound reveal">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--error)" stroke-width="1.5" style="margin:0 auto 12px"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
        <h3>Диплом не найден</h3>
        <p style="color:var(--muted)">Документ с номером <strong><?= h($number ?: '-') ?></strong> в реестре отсутствует. Проверьте правильность номера с диплома или QR-кода.</p>
        <a class="btn btn--primary" href="<?= url('/') ?>">На главную</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$ttl = $d ? ('Диплом № ' . $number) : 'Проверка диплома';
render_page($ttl, $content, ['active' => '', 'meta' => 'Проверка подлинности наградных документов КЦ «Музыкальный Мир».']);
