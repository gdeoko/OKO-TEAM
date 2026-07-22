<?php
/**
 * Генератор embed-виджета КЦ «Музыкальный Мир» для сторонних сайтов.
 * ?embed=1 - самодостаточный компактный HTML без общего лейаута (для iframe/скрипта).
 * Виджет: мини-проверка диплома + список действующих конкурсов.
 */

$isEmbed = isset($_GET['embed']) && $_GET['embed'] === '1';

$comps = all("SELECT name, slug, type FROM competitions WHERE status='open' ORDER BY sort LIMIT 8");

if ($isEmbed) {
    header('Content-Type: text/html; charset=utf-8');
    $verifyBase = rtrim(url('/verify'), '/');
    $allComps   = url('/competitions');
    ?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>КЦ «Музыкальный Мир»</title>
<style>
  :root{
    --w-bg:#FFFCF5;--w-panel:#fff;--w-text:#1B2340;--w-dim:#4a4636;--w-muted:#6a6353;
    --w-gold:#C9A84C;--w-gold-ink:#7a5e18;--w-line:#ece6d6;--w-soft:rgba(201,168,76,.12);
    --w-mint:#5f9e6a;--w-mint-soft:rgba(95,158,106,.14);--w-info:#3d5f82;--w-info-soft:rgba(90,122,158,.14);
  }
  @media (prefers-color-scheme:dark){
    :root{
      --w-bg:#121016;--w-panel:#1a1712;--w-text:#F3ECDA;--w-dim:#cabfa6;--w-muted:#9a927f;
      --w-gold:#E8C25A;--w-gold-ink:#E8C25A;--w-line:rgba(201,168,76,.22);--w-soft:rgba(232,194,90,.12);
      --w-mint:#8FBC94;--w-mint-soft:rgba(143,188,148,.16);--w-info:#8fb0d4;--w-info-soft:rgba(90,122,158,.20);
    }
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Manrope,Arial,sans-serif;
    background:var(--w-bg);color:var(--w-text);-webkit-font-smoothing:antialiased;line-height:1.4}
  .w-wrap{padding:16px;max-width:520px;margin:0 auto}
  .w-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
  .w-logo{width:38px;height:38px;border-radius:50%;flex:0 0 auto;
    box-shadow:0 0 14px rgba(201,168,76,.28);border:1px solid var(--w-line)}
  .w-ttl{display:flex;flex-direction:column;min-width:0}
  .w-ttl b{font-size:.98rem;color:var(--w-text);line-height:1.15}
  .w-ttl span{font-size:.72rem;color:var(--w-muted);letter-spacing:.02em}

  /* мини-проверка диплома */
  .w-verify{background:var(--w-panel);border:1px solid var(--w-line);border-radius:12px;padding:13px 13px 14px;margin-bottom:14px}
  .w-verify .cap{display:flex;align-items:center;gap:7px;font-size:.8rem;font-weight:600;color:var(--w-dim);margin-bottom:9px}
  .w-verify .cap svg{width:16px;height:16px;color:var(--w-gold-ink);flex:0 0 auto}
  .w-vform{display:flex;gap:8px}
  .w-vform input{flex:1 1 auto;min-width:0;font:inherit;font-size:.88rem;padding:0 12px;height:40px;
    border:1px solid var(--w-line);border-radius:9px;background:var(--w-bg);color:var(--w-text);letter-spacing:.03em}
  .w-vform input:focus{outline:none;border-color:var(--w-gold);box-shadow:0 0 0 3px var(--w-soft)}
  .w-vform button{flex:0 0 auto;height:40px;padding:0 16px;border:0;border-radius:9px;cursor:pointer;
    font:inherit;font-size:.86rem;font-weight:700;color:#2a2412;
    background:linear-gradient(135deg,#E6C766,#C9A84C 55%,#B8973B)}
  .w-vform button:hover{filter:brightness(1.05)}
  .w-vform button:active{transform:translateY(1px)}

  .w-sub{font-size:.74rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
    color:var(--w-muted);margin:0 2px 9px;display:flex;align-items:center;gap:8px}
  .w-sub::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--w-line),transparent)}

  .w-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .w-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;min-height:44px;
    background:var(--w-panel);border:1px solid var(--w-line);border-radius:10px;text-decoration:none;color:var(--w-text);
    transition:border-color .15s,transform .15s}
  .w-item:hover{border-color:var(--w-gold);transform:translateX(2px)}
  .w-name{font-weight:600;font-size:.9rem;line-height:1.25;overflow-wrap:anywhere}
  .w-badge{flex:0 0 auto;font-size:.66rem;font-weight:700;letter-spacing:.03em;padding:4px 9px;border-radius:99px;white-space:nowrap}
  .w-badge--intl{background:var(--w-soft);color:var(--w-gold-ink)}
  .w-badge--nat{background:var(--w-info-soft);color:var(--w-info)}
  .w-arrow{flex:0 0 auto;width:15px;height:15px;color:var(--w-gold);opacity:.7}
  .w-empty{padding:18px;text-align:center;color:var(--w-muted);font-size:.86rem;
    background:var(--w-panel);border:1px dashed var(--w-line);border-radius:10px}
  .w-foot{margin-top:13px;display:flex;justify-content:space-between;align-items:center;gap:8px}
  .w-foot a{font-size:.78rem;font-weight:600;color:var(--w-gold-ink);text-decoration:none;display:inline-flex;align-items:center;gap:5px}
  .w-foot a:hover{text-decoration:underline}
  .w-foot svg{width:13px;height:13px}
  .w-mark{font-size:.64rem;color:var(--w-muted)}
  @media (max-width:360px){.w-vform{flex-wrap:wrap}.w-vform button{width:100%}}
</style>
</head>
<body>
<div class="w-wrap">
  <div class="w-head">
    <img class="w-logo" src="<?= h(logo_data_uri()) ?>" alt="Логотип КЦ «Музыкальный Мир»">
    <div class="w-ttl">
      <b>КЦ «Музыкальный Мир»</b>
      <span>Конкурсы и проверка дипломов</span>
    </div>
  </div>

  <div class="w-verify">
    <div class="cap">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
      Проверка подлинности диплома
    </div>
    <form class="w-vform" id="wVerify" autocomplete="off">
      <input type="text" id="wNum" placeholder="Номер диплома" aria-label="Номер диплома">
      <button type="submit">Проверить</button>
    </form>
  </div>

  <div class="w-sub">Действующие конкурсы</div>
  <?php if ($comps): ?>
  <ul class="w-list">
    <?php foreach ($comps as $c): $intl = $c['type'] === 'international'; ?>
      <li>
        <a class="w-item" href="<?= h(url('/competition/' . $c['slug'])) ?>" target="_blank" rel="noopener">
          <span class="w-name"><?= h($c['name']) ?></span>
          <span class="w-badge <?= $intl ? 'w-badge--intl' : 'w-badge--nat' ?>"><?= $intl ? 'Международный' : 'Всероссийский' ?></span>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>
  <?php else: ?>
    <div class="w-empty">Сейчас нет открытых конкурсов. Загляните позже.</div>
  <?php endif; ?>

  <div class="w-foot">
    <a href="<?= h($allComps) ?>" target="_blank" rel="noopener">
      Все конкурсы
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
    <span class="w-mark">musmir</span>
  </div>
</div>
<script>
(function(){
  var base=<?= json_encode($verifyBase, JSON_UNESCAPED_SLASHES) ?>;
  var f=document.getElementById('wVerify');
  if(!f)return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=(document.getElementById('wNum').value||'').trim();
    if(!v)return;
    window.open(base+'/'+encodeURIComponent(v),'_blank','noopener');
  });
})();
</script>
</body>
</html>
<?php
    exit;
}

$embedSrc = url('/widget?embed=1');
$iframeCode = '<iframe src="' . $embedSrc . '" width="100%" height="480" style="border:0;border-radius:12px" '
            . 'title="КЦ «Музыкальный Мир»" loading="lazy"></iframe>';
$scriptCode = "<script>\n"
            . "(function(){\n"
            . "  var f=document.createElement('iframe');\n"
            . "  f.src=\"{$embedSrc}\";\n"
            . "  f.title=\"КЦ «Музыкальный Мир»\";\n"
            . "  f.loading=\"lazy\";\n"
            . "  f.style.cssText=\"width:100%;height:480px;border:0;border-radius:12px\";\n"
            . "  document.currentScript.parentNode.insertBefore(f, document.currentScript);\n"
            . "})();\n"
            . "</script>";

$icoCopy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

ob_start(); ?>
<style>
.wg-feat{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}
.wg-feat .card{padding:20px 18px;text-align:center}
.wg-feat .ic{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink)}
.wg-feat .ic svg{width:26px;height:26px}
.wg-feat h3{font-size:1.05rem;margin:0 0 5px}
.wg-feat p{color:var(--muted);font-size:.88rem;margin:0}
.embed-preview{border:1.5px solid var(--glass-brd);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-3d);background:var(--panel);backdrop-filter:blur(12px)}
.embed-preview iframe{width:100%;height:480px;border:0;display:block;background:#FFFCF5}
.code-box{position:relative;margin-top:14px}
.code-box textarea{width:100%;min-height:112px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.84rem;line-height:1.5;background:#14110d;color:#e8e5db;border:1px solid var(--glass-brd);border-radius:var(--radius-sm);
  padding:16px 50px 16px 16px;resize:vertical}
.code-copy{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.12);border:none;color:#fff;
  border-radius:8px;padding:8px;cursor:pointer;transition:background .15s;min-width:34px;min-height:34px}
.code-copy:hover{background:rgba(255,255,255,.22)}
.code-copy svg{width:18px;height:18px;display:block}
.code-copy.copied{background:var(--gold)}
@media(max-width:640px){.wg-feat{grid-template-columns:1fr}}
</style>

<section class="section section--parchment">
  <div class="container" style="max-width:760px;text-align:center">
    <div class="reveal">
      <p class="eyebrow">Для партнёрских сайтов</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em">Виджет КЦ «Музыкальный Мир»</h1>
      <p>Разместите на своём сайте компактный виджет: посетители смогут проверить подлинность диплома и увидеть
        действующие конкурсы Культурного центра. Виджет обновляется автоматически - дорабатывать ничего не нужно.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal"><p class="eyebrow">Что внутри</p><h2>Два инструмента в одном блоке</h2></div>
    <div class="wg-feat reveal">
      <div class="card card--3d">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></div>
        <h3>Проверка диплома</h3>
        <p>Мини-форма проверки подлинности по номеру с диплома.</p>
      </div>
      <div class="card card--3d">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h10"/></svg></div>
        <h3>Список конкурсов</h3>
        <p>Действующие всероссийские и международные конкурсы со ссылками.</p>
      </div>
      <div class="card card--3d">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v18M3 12h18" opacity=".3"/><path d="M21 12a9 9 0 1 1-9-9"/><path d="M16 4l1.5 1.5L21 2"/></svg></div>
        <h3>Автообновление</h3>
        <p>Светлая и тёмная темы, адаптив под любой экран.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:560px">
    <div class="section-head reveal"><p class="eyebrow">Превью</p><h2>Так это выглядит</h2></div>
    <div class="embed-preview reveal">
      <iframe src="<?= h($embedSrc) ?>" loading="lazy" title="Превью виджета КЦ «Музыкальный Мир»"></iframe>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:640px">
    <div class="section-head reveal"><p class="eyebrow">Код для вставки</p><h2>Вариант 1 - iframe</h2>
      <p>Вставьте код в любое место страницы Вашего сайта.</p></div>
    <div class="code-box reveal">
      <textarea readonly onclick="this.select()"><?= h($iframeCode) ?></textarea>
      <button type="button" class="code-copy" data-copy="iframe" aria-label="Скопировать код"><?= $icoCopy ?></button>
    </div>
  </div>
</section>

<section class="section section--tint">
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
render_page('Виджет КЦ «Музыкальный Мир»', $content, [
    'active' => '/widget',
    'meta'   => 'Готовый embed-виджет КЦ «Музыкальный Мир» для сторонних сайтов: проверка подлинности диплома и список действующих конкурсов - iframe или скрипт для вставки.',
]);
