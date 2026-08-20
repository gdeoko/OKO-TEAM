<?php
/**
 * АВТОМАТИЧЕСКАЯ АТТЕСТАЦИЯ — ПУЛЬТ.
 *
 * Один экран, на котором видно главное: включена ли автоматическая оценка, в
 * каком режиме, что она уже наработала и что ждёт человека. Рубильник намеренно
 * сделан заметным и с тремя положениями, а не галочкой «вкл/выкл»: между «не
 * работает» и «решает само» есть режим подсказки, и именно он нужен, пока идёт
 * сверка с оценками жюри.
 *
 * Разбор каждой работы открывается целиком: баллы по критериям, обоснование с
 * привязкой ко времени записи, комментарий для участника и то, что модель сама
 * пометила как сомнительное. Без этого «автомат» невозможно ни проверить, ни
 * защитить перед участником, который спросит, почему у него вторая степень.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/ai_grader.php';
ag_migrate();

$msg = '';

/* ---------- Переключение режима и настроек ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'mode') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('autograde'); }
    $mode = (string) input('mode');
    if (in_array($mode, ['off', 'assist', 'auto'], true)) {
        set_setting('auto_grading_mode', $mode);
        audit('autograde_mode', 'setting', 0, ['mode' => $mode]);
        $note = '';
        /* ВКЛЮЧИЛ — НАЧАЛОСЬ.
         *
         * Задание идёт раз в десять минут, и после щелчка рубильником в админке
         * ничего не происходило до следующего запуска: человек смотрел на пустой
         * список и решал, что не работает. Запускаем первый заход сразу, в фоне —
         * страница не ждёт, а разбор первых работ начинается в ту же минуту. */
        if ($mode !== 'off') {
            $cmd = 'setsid nohup php ' . escapeshellarg(BASE_PATH . '/cron/ai_grade.php')
                 . ' >> ' . escapeshellarg(BASE_PATH . '/data/logs/cron.log') . ' 2>&1 & disown';
            @exec($cmd);
            $note = ' Первые работы уже разбираются — оценка одной занимает около двух минут.';
        }
        flash('Режим аттестации: ' . ['off' => 'выключена', 'assist' => 'подсказка жюри', 'auto' => 'полный автомат'][$mode] . '.' . $note, 'success');
    }
    admin_redirect('autograde');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'settings') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('autograde'); }
    set_setting('grade_model',          trim((string) input('grade_model')) ?: 'gemini-3.7-flash');
    set_setting('grade_min_confidence', (string) max(0, min(1, (float) input('grade_min_confidence'))));
    set_setting('grade_batch',          (string) max(1, (int) input('grade_batch')));
    set_setting('grade_video_max_sec',  (string) max(60, (int) input('grade_video_max_sec')));
    set_setting('grade_anchors',        input('grade_anchors') ? '1' : '0');
    $src = (string) input('grade_title_source');
    if (in_array($src, ['score', 'level', 'mix'], true)) set_setting('grade_title_source', $src);
    flash('Настройки аттестации сохранены.', 'success');
    admin_redirect('autograde');
}

/* ---------- Утверждение или отклонение разбора человеком ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) input('do'), ['approve', 'reject'], true)) {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('autograde'); }
    $runId = (int) input('run');
    $run   = $runId ? one("SELECT * FROM grading_runs WHERE id=?", [$runId]) : null;
    if (!$run) { flash('Разбор не найден.', 'error'); admin_redirect('autograde'); }
    $appId = (int) $run['application_id'];

    if ((string) input('do') === 'approve') {
        // Человек может поправить звание перед утверждением: модель предлагает,
        // решение остаётся за жюри, и в журнале видно, что именно утвердили.
        $title = trim((string) input('title')) ?: (string) $run['title'];
        // Состояние ДО записи: по нему потом видно, менялось ли напечатанное.
        $appBefore = one("SELECT * FROM applications WHERE id=?", [$appId]) ?: [];
        update('applications', ['result' => $title, 'jury_comment' => (string) $run['jury_comment'],
                                'status' => 'graded'], 'id=:id', ['id' => $appId]);
        q("UPDATE applications SET graded_at=? WHERE id=? AND COALESCE(graded_at,'')=''", [date('Y-m-d H:i:s'), $appId]);
        q("UPDATE grading_runs SET applied=1, applied_at=?, title=? WHERE id=?", [date('Y-m-d H:i:s'), $title, $runId]);
        // Если по заявке уже есть бланк с прежним званием — переделываем.
        require_once BASE_PATH . '/core/diploma_sync.php';
        $dmsg = dsync_apply($appId, $appBefore, ['result' => $title, 'status' => 'graded']);
        audit('autograde_approved', 'application', $appId, ['run' => $runId, 'title' => $title]);
        flash('Результат утверждён: ' . $title . ($dmsg !== '' ? ' ' . $dmsg : ''), 'success');
    } else {
        q("UPDATE grading_runs SET status='skipped', error='отклонено человеком' WHERE id=?", [$runId]);
        audit('autograde_rejected', 'application', $appId, ['run' => $runId]);
        flash('Разбор отклонён, заявка остаётся у жюри.', 'success');
    }
    admin_redirect('autograde');
}

/* ---------- Данные экрана ---------- */
$mode = ag_mode();
$stat = [
    'ok'      => (int) (scalar("SELECT COUNT(*) FROM grading_runs WHERE status='ok'") ?? 0),
    'applied' => (int) (scalar("SELECT COUNT(*) FROM grading_runs WHERE applied=1") ?? 0),
    'wait'    => (int) (scalar("SELECT COUNT(*) FROM grading_runs WHERE status='ok' AND applied=0") ?? 0),
    'failed'  => (int) (scalar("SELECT COUNT(*) FROM grading_runs WHERE status='failed'") ?? 0),
    'queue'   => (int) (scalar("SELECT COUNT(*) FROM applications a JOIN competitions c ON c.id=a.competition_id
                                WHERE COALESCE(a.result,'')='' AND a.status NOT IN ('rejected','draft')
                                  AND TRIM(COALESCE(a.video_url,''))<>''
                                  AND (COALESCE(c.is_paid,0)=0 OR COALESCE(a.is_paid,0)=1)") ?? 0),
];
$avgSec = (float) (scalar("SELECT AVG(seconds) FROM grading_runs WHERE status='ok'") ?? 0);

$runs = all("SELECT g.*, a.number, a.full_name, a.group_name, a.is_group, a.nomination, a.subgroup,
                    a.age_category, a.work_title, a.video_url, a.result AS app_result, c.name AS comp_name
               FROM grading_runs g
               JOIN applications a ON a.id = g.application_id
               LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE g.status IN ('ok','failed')
           ORDER BY g.id DESC LIMIT 60");

ob_start(); ?>
<div class="card">
  <h2 style="margin:0 0 6px">Автоматическая аттестация</h2>
  <p class="small" style="color:#666;margin:0 0 16px">
    Работу разбирает модель по критериям своей номинации: баллы, обоснование с привязкой ко времени записи
    и комментарий для участника. Итоговый балл и звание считает сайт по весам, а не модель.
  </p>

  <form method="post" style="margin:0 0 18px">
    <?= csrf_field() ?><input type="hidden" name="do" value="mode">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <?php foreach ([
        'off'    => ['Выключена', 'Заявки оценивает только жюри.'],
        'assist' => ['Подсказка жюри', 'Оценка готовится, но применяется человеком.'],
        'auto'   => ['Полный автомат', 'Оценка сразу становится результатом заявки.'],
      ] as $k => [$title, $note]): $on = $mode === $k; ?>
        <button name="mode" value="<?= $k ?>" class="btn <?= $on ? 'btn--primary' : '' ?>"
                style="flex:1 1 220px;text-align:left;padding:14px 16px;<?= $on ? '' : 'opacity:.75' ?>">
          <div style="font-weight:700;font-size:15px"><?= $on ? '● ' : '○ ' ?><?= h($title) ?></div>
          <div class="small" style="margin-top:4px;font-weight:400"><?= h($note) ?></div>
        </button>
      <?php endforeach; ?>
    </div>
  </form>

  <div class="cab-kpis" style="display:flex;gap:12px;flex-wrap:wrap;margin:0 0 8px">
    <?php foreach ([
      ['Ждут аттестации', $stat['queue']],
      ['Разобрано', $stat['ok']],
      ['Применено', $stat['applied']],
      ['Ждут человека', $stat['wait']],
      ['Не удалось', $stat['failed']],
      ['Среднее время', $avgSec > 0 ? round($avgSec) . ' с' : '—'],
    ] as [$label, $val]): ?>
      <div style="flex:1 1 130px;background:#faf8f3;border:1px solid #eee3cf;border-radius:10px;padding:12px 14px">
        <div style="font:700 20px/1.2 Georgia,serif;color:#17307A"><?= h((string) $val) ?></div>
        <div class="small" style="color:#777"><?= h($label) ?></div>
      </div>
    <?php endforeach; ?>
  </div>
</div>

<?php
/* СВЕРКА С ЖЮРИ. Главная цифра всего экрана: пока она не набрана, включать
   полный автомат нельзя, и владелец должен видеть это без запуска скриптов. */
$rank = static function (string $t): int {
    $t = mb_strtoupper(trim($t));
    if (str_contains($t, 'ГРАН'))          return 7;
    if (str_contains($t, 'ЛАУРЕАТ I СТ'))  return 6;
    if (str_contains($t, 'ЛАУРЕАТ II С'))  return 5;
    if (str_contains($t, 'ЛАУРЕАТ III'))   return 4;
    if (str_contains($t, 'ДИПЛОМАНТ I С')) return 3;
    if (str_contains($t, 'ДИПЛОМАНТ II ')) return 2;
    if (str_contains($t, 'ДИПЛОМАНТ III')) return 1;
    return 0;
};
$cmp = all("SELECT g.title, a.result
              FROM grading_runs g JOIN applications a ON a.id = g.application_id
             WHERE g.status='ok' AND COALESCE(a.result,'') <> '' AND g.applied = 0
               AND g.id = (SELECT MAX(g2.id) FROM grading_runs g2
                            WHERE g2.application_id = g.application_id AND g2.status='ok')");
$cE = $cN = 0;
foreach ($cmp as $c) {
    $d = $rank((string) $c['title']) - $rank((string) $c['result']);
    if ($d === 0) $cE++;
    if (abs($d) <= 1) $cN++;
}
$cT = count($cmp);
?>
<div class="card">
  <h3 style="margin:0 0 10px">Сверка с жюри</h3>
  <?php if ($cT < 5): ?>
    <p class="small" style="color:#777;margin:0">
      Работ, оценённых и человеком, и машиной: <?= (int) $cT ?>. Для вывода о точности нужно хотя бы сорок.
    </p>
  <?php else: ?>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <?php foreach ([
        ['Сверено работ', (string) $cT],
        ['Звание совпало', round($cE * 100 / $cT) . '%'],
        ['Расхождение до ступени', round($cN * 100 / $cT) . '%'],
        ['Шкала', (string) setting('grade_scale_mode', 'linear') === 'quantile' ? 'по долям жюри' : 'общая'],
      ] as [$label, $val]): ?>
        <div style="flex:1 1 150px;background:#faf8f3;border:1px solid #eee3cf;border-radius:10px;padding:12px 14px">
          <div style="font:700 20px/1.2 Georgia,serif;color:#17307A"><?= h($val) ?></div>
          <div class="small" style="color:#777"><?= h($label) ?></div>
        </div>
      <?php endforeach; ?>
    </div>
    <p class="small" style="color:#777;margin:10px 0 0">
      «Расхождение до ступени» это соседнее звание. Живые члены жюри расходятся между собой примерно так же,
      поэтому именно эта цифра показывает, можно ли доверять машине черновую оценку.
      Оценка не подгоняется под эти цифры: машина судит по международным системам (ABRSM, INTERKULTUR, LAMDA,
      YAGP, WDSF, CIOFF, FIG, FISM и другим по направлениям), а сверка нужна как контроль, а не как настройка.
    </p>
  <?php endif; ?>
</div>

<div class="card">
  <h3 style="margin:0 0 10px">Настройки</h3>
  <form method="post" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <?= csrf_field() ?><input type="hidden" name="do" value="settings">
    <label style="flex:1 1 220px">Модель
      <input name="grade_model" value="<?= h(ag_model()) ?>" class="inp">
    </label>
    <label style="flex:1 1 160px">Порог уверенности
      <input name="grade_min_confidence" value="<?= h((string) setting('grade_min_confidence', '0.75')) ?>" class="inp">
    </label>
    <label style="flex:1 1 140px">Работ за заход
      <input name="grade_batch" value="<?= h((string) setting('grade_batch', '10')) ?>" class="inp">
    </label>
    <label style="flex:1 1 160px">Смотреть секунд
      <input name="grade_video_max_sec" value="<?= h((string) setting('grade_video_max_sec', '900')) ?>" class="inp">
    </label>
    <label style="flex:1 1 200px">Звание определять
      <select name="grade_title_source" class="inp">
        <?php $src = (string) setting('grade_title_source', 'score'); ?>
        <option value="score"<?= $src === 'score' ? ' selected' : '' ?>>по сумме баллов</option>
        <option value="level"<?= $src === 'level' ? ' selected' : '' ?>>сравнением с работами конкурса</option>
        <option value="mix"<?= $src === 'mix' ? ' selected' : '' ?>>по обоим, в пользу строгого</option>
      </select>
    </label>
    <label style="flex:1 1 220px;display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="grade_anchors" value="1"<?= (string) setting('grade_anchors', '1') === '1' ? ' checked' : '' ?>>
      <span>Показывать планку конкурса</span>
    </label>
    <button class="btn btn--primary">Сохранить</button>
  </form>
  <p class="small" style="color:#777;margin:10px 0 0">
    Даже в режиме «полный автомат» человеку остаются: формальные нарушения положения, тревожные признаки
    (подозрение на фонограмму, чужое исполнение, монтаж), низкая уверенность, Гран-при и работы без звания.
  </p>
</div>

<div class="card">
  <h3 style="margin:0 0 10px">Разборы</h3>
  <?php if (!$runs): ?>
    <p class="small" style="color:#777">Пока пусто. Первый разбор появится после ближайшего захода задания.</p>
  <?php endif; ?>

  <?php foreach ($runs as $r):
      $scores = (array) json_decode((string) $r['scores'], true);
      $flags  = (array) json_decode((string) $r['red_flags'], true);
      $formal = (array) json_decode((string) $r['formal'], true);
      $who    = (int) $r['is_group'] ? (string) $r['group_name'] : (string) $r['full_name'];
      $failed = (string) $r['status'] === 'failed';
  ?>
    <details style="border:1px solid #eee3cf;border-radius:10px;padding:12px 14px;margin:0 0 10px;background:<?= $failed ? '#fdf6f6' : '#fff' ?>">
      <summary style="cursor:pointer;font-weight:600">
        <?= h((string) $r['number']) ?> · <?= h(mb_substr($who, 0, 40)) ?>
        <span class="small" style="color:#777">· <?= h((string) $r['nomination']) ?><?= $r['subgroup'] ? ' / ' . h((string) $r['subgroup']) : '' ?></span>
        <?php if ($failed): ?>
          <span style="color:#b34">· не удалось</span>
        <?php else: ?>
          · <b><?= h((string) $r['title']) ?></b> <span class="small">(<?= number_format((float) $r['total'], 1) ?>)</span>
          <?php $ea = trim((string) ($r['extra_award'] ?? ''));
                if ($ea !== ''): ?>
            <span class="small" style="color:#1E7A46">· доп. диплом: <?= h($ea) ?></span>
          <?php endif; ?>
          <?php // Второе мнение: звание, названное напрямую, без перевода балла.
                $lg = mb_strtoupper(trim((string) ($r['level_guess'] ?? '')));
                if ($lg !== '' && $lg !== mb_strtoupper(trim((string) $r['title']))): ?>
            <span class="small" style="color:#8B6F1F">· по сравнению с уровнем: <?= h($lg) ?></span>
          <?php endif; ?>
          <?php if ((int) $r['applied']): ?><span style="color:#1E7A46">· применено</span>
          <?php else: ?><span style="color:#8B6F1F">· ждёт решения</span><?php endif; ?>
        <?php endif; ?>
      </summary>

      <?php if ($failed): ?>
        <p class="small" style="color:#b34;margin:10px 0 0"><?= h((string) $r['error']) ?></p>
      <?php else: ?>
        <div style="margin:12px 0 0">
          <div class="small" style="color:#777;margin:0 0 6px">
            Работа: <?= h((string) $r['work_title']) ?> · возраст <?= h((string) $r['age_category']) ?>
            · модель <?= h((string) $r['model']) ?> · уверенность <?= number_format((float) $r['confidence'], 2) ?>
            <?php if ((string) $r['video_url'] !== ''): ?>
              · <a href="<?= h((string) $r['video_url']) ?>" target="_blank" rel="noopener">запись</a>
            <?php endif; ?>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <?php foreach ($scores as $c): ?>
              <tr>
                <td style="padding:6px 8px 6px 0;border-bottom:1px solid #f2ece0;white-space:nowrap">
                  <?= h((string) $c['title']) ?> <span class="small" style="color:#999">×<?= (int) $c['weight'] ?></span>
                </td>
                <td style="padding:6px 8px;border-bottom:1px solid #f2ece0;font-weight:700;white-space:nowrap"><?= number_format((float) $c['score'], 0) ?></td>
                <td style="padding:6px 0;border-bottom:1px solid #f2ece0;color:#444"><?= h((string) $c['note']) ?></td>
              </tr>
            <?php endforeach; ?>
          </table>

          <?php if ($flags): ?>
            <p style="margin:10px 0 0;color:#b34"><b>Требует внимания:</b> <?= h(implode('; ', array_map('strval', $flags))) ?></p>
          <?php endif; ?>
          <?php
            $formalBad = [];
            foreach (gr_formal_checks() as $k => $text) if (array_key_exists($k, $formal) && $formal[$k] === false) $formalBad[] = $text;
            if ($formalBad): ?>
            <p style="margin:8px 0 0;color:#b34"><b>Не соответствует положению:</b> <?= h(implode(' ', $formalBad)) ?></p>
          <?php endif; ?>

          <?php if (trim((string) $r['internal_note']) !== ''): ?>
            <p class="small" style="margin:10px 0 0;color:#666"><b>Для оргкомитета:</b> <?= h((string) $r['internal_note']) ?></p>
          <?php endif; ?>

          <div style="margin:12px 0 0;padding:12px 14px;background:#faf8f3;border-radius:8px">
            <div class="small" style="color:#777;margin-bottom:4px">Комментарий участнику</div>
            <?= nl2br(h((string) $r['jury_comment'])) ?>
          </div>

          <?php if (!(int) $r['applied']): ?>
            <form method="post" style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <?= csrf_field() ?><input type="hidden" name="run" value="<?= (int) $r['id'] ?>">
              <select name="title" class="inp" style="max-width:260px">
                <?php foreach (['ГРАН-ПРИ','ЛАУРЕАТ I СТЕПЕНИ','ЛАУРЕАТ II СТЕПЕНИ','ЛАУРЕАТ III СТЕПЕНИ',
                                'ДИПЛОМАНТ I СТЕПЕНИ','ДИПЛОМАНТ II СТЕПЕНИ','ДИПЛОМАНТ III СТЕПЕНИ',
                                'УЧАСТНИК КОНКУРСА'] as $t): ?>
                  <option<?= $t === (string) $r['title'] ? ' selected' : '' ?>><?= h($t) ?></option>
                <?php endforeach; ?>
              </select>
              <button name="do" value="approve" class="btn btn--primary">Утвердить</button>
              <button name="do" value="reject" class="btn">Отклонить</button>
            </form>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    </details>
  <?php endforeach; ?>
</div>
<?php
$content = ob_get_clean();
admin_layout('Аттестация', $content, 'autograde');
