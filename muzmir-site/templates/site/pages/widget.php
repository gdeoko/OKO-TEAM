<?php
/**
 * Генератор embed-виджета «Конкурсы КЦ» для сторонних сайтов.
 * ?embed=1 — самодостаточный компактный HTML без общего лейаута (для iframe/скрипта).
 */

$isEmbed = isset($_GET['embed']) && $_GET['embed'] === '1';

$comps = all("SELECT name, slug, type FROM competitions WHERE status='open' ORDER BY sort LIMIT 8");

if ($isEmbed) {
    header('Content-Type: text/html; charset=utf-8');
    ?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Конкурсы КЦ «Музыкальный Мир»</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Manrope,Arial,sans-serif;background:#FFFCF5;color:#2A2E3F}
  .w-wrap{padding:14px}
  .w-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .w-head b{font-size:.95rem;color:#1B2340}
  .w-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .w-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;
    background:#fff;border:1px solid #ece6d6;border-radius:10px;text-decoration:none;color:#2A2E3F;transition:border-color .15s}
  .w-item:hover{border-color:#C9A84C}
  .w-name{font-weight:600;font-size:.9rem;line-height:1.25}
  .w-badge{flex:0 0 auto;font-size:.68rem;font-weight:700;letter-spacing:.03em;padding:3px 8px;border-radius:99px;
    background:rgba(90,122,158,.14);color:#3d5f82;white-space:nowrap}
  .w-empty{padding:16px;text-align:center;color:#6b6a63;font-size:.88rem}
  .w-foot{margin-top:10px;text-align:right}
  .w-foot a{font-size:.74rem;color:#8B6F1F;text-decoration:none}
</style>
</head>
<body>
<div class="w-wrap">
  <div class="w-head"><b>Конкурсы КЦ «Музыкальный Мир»</b></div>
  <?php if ($comps): ?>
  <ul class="w-list">
    <?php foreach ($comps as $c): ?>
      <li>
        <a class="w-item" href="<?= h(url('/competition/' . $c['slug'])) ?>" target="_blank" rel="noopener">
          <span class="w-name"><?= h($c['name']) ?></span>
          <span class="w-badge"><?= $c['type'] === 'international' ? 'Международный' : 'Всероссийский' ?></span>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>
  <?php else: ?>
    <div class="w-empty">Сейчас нет открытых конкурсов. Загляните позже.</div>
  <?php endif; ?>
  <div class="w-foot"><a href="<?= h(url('/competitions')) ?>" target="_blank" rel="noopener">Все конкурсы →</a></div>
</div>
</body>
</html>
<?php
    exit;
}

$embedSrc = url('/widget?embed=1');
$iframeCode = '<iframe src="' . $embedSrc . '" width="100%" height="420" style="border:0;border-radius:12px" '
            . 'title="Конкурсы КЦ «Музыкальный Мир»" loading="lazy"></iframe>';
$scriptCode = "<script>\n"
            . "(function(){\n"
            . "  var f=document.createElement('iframe');\n"
            . "  f.src=\"{$embedSrc}\";\n"
            . "  f.title=\"Конкурсы КЦ «Музыкальный Мир»\";\n"
            . "  f.loading=\"lazy\";\n"
            . "  f.style.cssText=\"width:100%;height:420px;border:0;border-radius:12px\";\n"
            . "  document.currentScript.parentNode.insertBefore(f, document.currentScript);\n"
            . "})();\n"
            . "</script>";

$icoCopy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

ob_start(); ?>
<style>
.embed-preview{border:1.5px solid var(--glass-brd);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card);background:var(--panel);backdrop-filter:blur(12px)}
.embed-preview iframe{width:100%;height:420px;border:0;display:block;background:#FFFCF5}
.code-box{position:relative;margin-top:14px}
.code-box textarea{width:100%;min-height:110px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.84rem;line-height:1.5;background:#14110d;color:#e8e5db;border:1px solid var(--glass-brd);border-radius:var(--radius-sm);
  padding:16px 50px 16px 16px;resize:vertical}
.code-copy{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.12);border:none;color:#fff;
  border-radius:8px;padding:8px;cursor:pointer;transition:background .15s}
.code-copy:hover{background:rgba(255,255,255,.22)}
.code-copy svg{width:18px;height:18px;display:block}
.code-copy.copied{background:var(--gold)}
</style>

<section class="section section--parchment">
  <div class="container" style="max-width:760px;text-align:center">
    <div class="reveal">
      <p class="eyebrow">Для партнёрских сайтов</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em">Виджет «Конкурсы КЦ»</h1>
      <p>Разместите компактный список действующих конкурсов Культурного центра «Музыкальный Мир» на своём сайте.
        Виджет обновляется автоматически - ничего дорабатывать не нужно.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:640px">
    <div class="section-head reveal"><p class="eyebrow">Превью</p><h2>Так это выглядит</h2></div>
    <div class="embed-preview reveal">
      <iframe src="<?= h($embedSrc) ?>" loading="lazy" title="Превью виджета «Конкурсы КЦ»"></iframe>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:640px">
    <div class="section-head reveal"><p class="eyebrow">Код для вставки</p><h2>Вариант 1 - iframe</h2>
      <p>Вставьте код в любое место страницы Вашего сайта.</p></div>
    <div class="code-box reveal">
      <textarea readonly onclick="this.select()"><?= h($iframeCode) ?></textarea>
      <button type="button" class="code-copy" data-copy="iframe" aria-label="Скопировать код"><?= $icoCopy ?></button>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:640px">
    <div class="section-head reveal"><p class="eyebrow">Код для вставки</p><h2>Вариант 2 - скрипт</h2>
      <p>Если платформа не позволяет вставлять iframe напрямую - используйте скрипт, он создаст виджет автоматически.</p></div>
    <div class="code-box reveal">
      <textarea readonly onclick="this.select()"><?= h($scriptCode) ?></textarea>
      <button type="button" class="code-copy" data-copy="script" aria-label="Скопировать код"><?= $icoCopy ?></button>
    </div>
  </div>
</section>

<script>
window.__WIDGET_CODES = {
  iframe: <?= json_encode($iframeCode, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
  script: <?= json_encode($scriptCode, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>
};
document.querySelectorAll('[data-copy]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var text = window.__WIDGET_CODES[btn.getAttribute('data-copy')] || '';
    var done = function () {
      btn.classList.add('copied');
      setTimeout(function () { btn.classList.remove('copied'); }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
    } else {
      var ta = btn.previousElementSibling;
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
    }
  });
});
</script>
<?php
$content = ob_get_clean();
render_page('Виджет «Конкурсы КЦ»', $content, [
    'active' => '/widget',
    'meta'   => 'Готовый embed-виджет действующих конкурсов КЦ «Музыкальный Мир» для сторонних сайтов: iframe или скрипт для вставки.',
]);
