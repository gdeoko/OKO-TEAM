<?php
/** Гала-концерт в прямом эфире: видеотрансляция + голосование за «Приз зрительских симпатий». */

if (!function_exists('gala_nominees_list')) {
    /**
     * Номера гала-концерта, участвующие в голосовании.
     * Список настраивается через settings('gala_nominees') — JSON-массив
     * [{"key":"n1","name":"...","note":"..."}]. Без настройки — демонстрационный список.
     */
    function gala_nominees_list(): array {
        $raw = setting('gala_nominees', '');
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && $decoded) return $decoded;
        }
        return [
            ['key' => 'n1', 'name' => 'Мария Иванова',                 'note' => 'Эстрадный вокал - «Вечерний свет»'],
            ['key' => 'n2', 'name' => 'Ансамбль «Радуга»',              'note' => 'Народный танец - «Хоровод»'],
            ['key' => 'n3', 'name' => 'Алексей Смирнов',                'note' => 'Фортепиано - «Осенний вальс»'],
            ['key' => 'n4', 'name' => 'Театральная студия «Маска»',     'note' => 'Музыкальный театр - «Сказка о потерянном времени»'],
            ['key' => 'n5', 'name' => 'Дарья Кузнецова',                'note' => 'Художественное слово - «Родина»'],
            ['key' => 'n6', 'name' => 'Дуэт «Гармония»',                'note' => 'Академический вокал - «Баркарола»'],
        ];
    }
}

// Своя таблица — создаётся идемпотентно, миграции ядра не трогаем.
db()->exec("CREATE TABLE IF NOT EXISTS gala_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gala_id TEXT NOT NULL DEFAULT 'main',
    nominee_key TEXT NOT NULL,
    session_key TEXT NOT NULL DEFAULT '',
    ip TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
)");
db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_gala_votes_session ON gala_votes(gala_id, session_key)");
db()->exec("CREATE INDEX IF NOT EXISTS idx_gala_votes_nominee ON gala_votes(gala_id, nominee_key)");

$galaId = 'main';
$title = setting('gala_title', 'Гала-концерт лауреатов');
$subtitle = setting('gala_subtitle', 'Прямая трансляция торжественного награждения и творческих номеров лауреатов конкурсов Культурного центра.');
$status = setting('gala_status', 'scheduled'); // scheduled|live|finished
$date = setting('gala_date', '');
$embedUrl = trim((string) setting('gala_stream_embed_url', ''));

$statusMap = [
    'live'      => ['Прямой эфир идёт', 'badge--open'],
    'scheduled' => ['Трансляция готовится', 'badge--intl'],
    'finished'  => ['Эфир завершён', 'badge--closed'],
];
[$statusLabel, $statusBadge] = $statusMap[$status] ?? $statusMap['scheduled'];

$nominees = gala_nominees_list();
$keys = array_column($nominees, 'key');

$counts = array_fill_keys($keys, 0);
$rows = all("SELECT nominee_key, COUNT(*) c FROM gala_votes WHERE gala_id=? GROUP BY nominee_key", [$galaId]);
foreach ($rows as $r) { if (array_key_exists($r['nominee_key'], $counts)) $counts[$r['nominee_key']] = (int) $r['c']; }
$total = array_sum($counts);

$sessionKey = session_id() ?: '';
$ip = client_ip();
$already = one(
    "SELECT nominee_key FROM gala_votes WHERE gala_id=? AND (session_key=? OR (ip<>'' AND ip=?)) LIMIT 1",
    [$galaId, $sessionKey, $ip]
);
$votedKey = $already['nominee_key'] ?? null;

$icoPlay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none"/></svg>';
$icoVote = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>';
$icoDone = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';

ob_start(); ?>
<style>
.gala-embed{position:relative;width:100%;aspect-ratio:16/9;background:var(--bg-2);border:1px solid var(--glass-brd);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card)}
.gala-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.gala-embed-stub{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--text-dim);text-align:center;padding:20px}
.gala-embed-stub span{width:44px;height:44px;color:var(--gold)}
.gala-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e05353;margin-right:7px;vertical-align:middle;animation:galaPulse 1.6s infinite}
@keyframes galaPulse{0%,100%{opacity:1}50%{opacity:.35}}

.vote-grid{display:grid;gap:16px}
.vote-card{background:var(--panel);border:1.5px solid var(--glass-brd);border-radius:var(--radius-sm);padding:18px 20px;backdrop-filter:blur(12px);box-shadow:var(--shadow-card);transition:border .2s,box-shadow .2s}
.vote-card.voted{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-soft)}
.vote-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
.vote-head b{font-family:var(--ff-display);letter-spacing:.02em;font-size:1.1rem;color:var(--text)}
.vote-head p{margin:4px 0 0;color:var(--text-dim);font-size:.92rem}
.vote-bar-wrap{margin-top:12px;height:8px;border-radius:6px;background:var(--gold-soft);overflow:hidden}
.vote-bar{height:100%;background:var(--grad-gold);border-radius:6px;width:0;transition:width .5s ease}
.vote-meta{display:flex;justify-content:space-between;margin-top:8px;font-size:.82rem;color:var(--muted)}
.vote-btn{margin-top:14px;min-width:150px;justify-content:center}
.vote-mark{display:none;align-items:center;gap:6px;color:var(--gold-2);font-weight:700;font-size:.9rem;margin-top:14px}
.vote-mark svg{width:18px;height:18px}
.vote-card.voted .vote-mark{display:inline-flex}
.vote-card.voted .vote-btn{display:none}
.vote-total{text-align:center;color:var(--muted);margin-top:20px;font-size:.94rem}
.vote-total b{color:var(--gold-2)}
.vote-note{font-size:.84rem;color:var(--error);text-align:center;margin-top:6px}
</style>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Прямой эфир</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em"><?= h($title) ?></h1>
      <p><?= h($subtitle) ?></p>
      <div style="margin-top:10px">
        <span class="badge <?= h($statusBadge) ?>"><?php if ($status === 'live'): ?><span class="gala-live-dot"></span><?php endif; ?><?= h($statusLabel) ?></span>
        <?php if ($date): ?><span style="margin-left:10px;color:var(--muted)"><?= h(ru_date($date)) ?></span><?php endif; ?>
      </div>
    </div>

    <div class="reveal" style="max-width:960px;margin:0 auto">
      <div class="gala-embed">
        <?php if ($embedUrl): ?>
          <iframe src="<?= h($embedUrl) ?>" loading="lazy" allow="autoplay; encrypted-media" allowfullscreen title="<?= h($title) ?>"></iframe>
        <?php else: ?>
          <div class="gala-embed-stub">
            <span><?= $icoPlay ?></span>
            <b style="font-family:var(--ff-display);font-size:1.15rem;color:var(--text)"><?= $status === 'finished' ? 'Запись готовится к публикации' : 'Трансляция скоро начнётся' ?></b>
            <?php if ($date): ?><span><?= h(ru_date($date)) ?></span><?php endif; ?>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:840px">
    <div class="section-head reveal">
      <p class="eyebrow">Голосование зрителей</p>
      <h2>Приз зрительских симпатий</h2>
      <p>Выберите номер, который понравился Вам больше всего. Один голос от одного зрителя.</p>
    </div>

    <div class="vote-grid reveal" id="voteGrid">
      <?php foreach ($nominees as $n): $c = $counts[$n['key']] ?? 0; $pct = $total > 0 ? round($c / $total * 100) : 0; ?>
        <div class="vote-card<?= $votedKey === $n['key'] ? ' voted' : '' ?>" data-nominee="<?= h($n['key']) ?>">
          <div class="vote-head">
            <div>
              <b><?= h($n['name']) ?></b>
              <p><?= h($n['note']) ?></p>
            </div>
          </div>
          <div class="vote-bar-wrap"><div class="vote-bar" data-bar style="width:<?= $pct ?>%"></div></div>
          <div class="vote-meta"><span data-count><?= $c ?></span><span data-pct><?= $pct ?>%</span></div>
          <button type="button" class="btn btn--ghost vote-btn" data-vote-btn<?= $votedKey ? ' disabled' : '' ?>><?= $icoVote ?>Голосовать</button>
          <span class="vote-mark"><?= $icoDone ?>Ваш голос</span>
        </div>
      <?php endforeach; ?>
    </div>

    <p class="vote-total">Всего голосов: <b data-vote-total><?= $total ?></b></p>
    <p class="vote-note" id="voteError"></p>
  </div>
</section>

<script>
(function () {
  var apiUrl = <?= json_encode(url('/api/v1/vote'), JSON_UNESCAPED_SLASHES) ?>;
  var grid = document.getElementById('voteGrid');
  var errBox = document.getElementById('voteError');
  var totalBox = document.querySelector('[data-vote-total]');
  var voted = <?= json_encode($votedKey) ?>;

  function render(counts, total) {
    var cards = grid.querySelectorAll('.vote-card');
    cards.forEach(function (card) {
      var key = card.getAttribute('data-nominee');
      var c = counts[key] || 0;
      var pct = total > 0 ? Math.round(c / total * 100) : 0;
      card.querySelector('[data-count]').textContent = c;
      card.querySelector('[data-pct]').textContent = pct + '%';
      card.querySelector('[data-bar]').style.width = pct + '%';
    });
    if (totalBox) totalBox.textContent = total;
  }

  function markVoted(key) {
    voted = key;
    grid.querySelectorAll('.vote-card').forEach(function (card) {
      var isVoted = card.getAttribute('data-nominee') === key;
      card.classList.toggle('voted', isVoted);
      var btn = card.querySelector('[data-vote-btn]');
      if (btn) btn.disabled = true;
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vote-btn]');
    if (!btn || btn.disabled || voted) return;
    var card = btn.closest('.vote-card');
    var key = card.getAttribute('data-nominee');
    btn.disabled = true;
    errBox.textContent = '';
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'nominee_key=' + encodeURIComponent(key) + '&gala_id=main'
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.counts) render(d.counts, d.total);
      if (d.ok) {
        markVoted(d.voted);
      } else if (d.voted) {
        markVoted(d.voted);
        errBox.textContent = d.error || 'Вы уже голосовали';
      } else {
        btn.disabled = false;
        errBox.textContent = d.error || 'Не удалось учесть голос, попробуйте ещё раз';
      }
    }).catch(function () {
      btn.disabled = false;
      errBox.textContent = 'Не удалось учесть голос, проверьте соединение';
    });
  });

  // Live-обновление счётчиков без перезагрузки.
  function poll() {
    fetch(apiUrl + '?gala_id=main').then(function (r) { return r.json(); }).then(function (d) {
      if (d.counts) render(d.counts, d.total);
      if (d.voted && !voted) markVoted(d.voted);
    }).catch(function () {});
  }
  setInterval(poll, 8000);
})();
</script>
<?php
$content = ob_get_clean();
render_page($title, $content, [
    'active' => '/gala',
    'meta'   => 'Гала-концерт КЦ «Музыкальный Мир» в прямом эфире: трансляция награждения и голосование зрителей за приз зрительских симпатий.',
]);
