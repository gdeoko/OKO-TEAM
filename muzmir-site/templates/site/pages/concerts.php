<?php
/** Онлайн-концерты: видеогалерея сообщества ВКонтакте (реальные записи, захардкожены). */

$icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>';
$icoPlay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 6.5v11l9-5.5z" fill="currentColor" stroke="none"/></svg>';
$icoExt  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M20 14v5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V6a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>';

/* Реальные видео сообщества ВКонтакте (названия очищены, даты в русском формате). */
$videos = [
    [
        'title'  => 'Онлайн гала-концерт, посвящённый 9 Мая — 81-й годовщине Дня Победы',
        'link'   => 'https://vk.com/video-211325055_456239810',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239810&hash=d6c18acc78bc90bc&__ref=vk.api',
        'cover'  => 'https://sun9-11.userapi.com/s/v1/ig2/MO9kpWrlacK5D2hii6-XhIzxh7mlOFxdjQ27lHC2q_MNyUJPdwkOmoy15MzrSI48mw0I1dSOhaMBM-hEwJ4PUrme.jpg?quality=95&size=1376x768',
        'date'   => '9 мая 2026',
    ],
    [
        'title'  => 'Отчётный онлайн-концерт обладателей звания Гран-при Международного многожанрового конкурса «День Победы»',
        'link'   => 'https://vk.com/video-211325055_456239541',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239541&hash=65036ae2f1e72690&__ref=vk.api',
        'cover'  => 'https://sun9-69.userapi.com/s/v1/ig2/Zy-eEI4SbPJl38F5sHYNcz_8DkWUpQKp7-E2LKCbYIMVyLHWk3KHWwALsd9A-1a2UWWU8kpX0GPnQ3tc7BOGv2qf.jpg?quality=95&size=1220x687',
        'date'   => '9 мая 2025',
    ],
    [
        'title'  => 'Выступление обладателя денежного приза',
        'link'   => 'https://vk.com/video-211325055_456239540',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239540&hash=d31962d268a50c9a&__ref=vk.api',
        'cover'  => 'https://sun9-66.userapi.com/s/v1/ig2/nzNScVXdTNmIwbGNy8yPP_fTrZOMJXzwC3hhFUb5fB4a7TX9JQd7wREyOp-GRHHv9MHBlddrLM7qx8kOwh7Jaaer.jpg?quality=95&size=1195x671',
        'date'   => '30 апреля 2025',
    ],
    [
        'title'  => 'Культурный центр «Музыкальный Мир» — акция «Поддержка талантливой молодёжи»',
        'link'   => 'https://vk.com/video-211325055_456239537',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239537&hash=7ce51ca32aafbaf5&__ref=vk.api',
        'cover'  => 'https://iv.okcdn.ru/getVideoPreview?id=8408172792368&idx=5&type=39&tkn=LvCLLTzEEueRmV_Th6qIZszn2Vw&fn=vid_w',
        'date'   => '25 апреля 2025',
    ],
    [
        'title'  => 'Онлайн гала-концерт Всероссийского многожанрового онлайн-конкурса культуры и искусства «Слава Героям России»',
        'link'   => 'https://vk.com/video-211325055_456239536',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239536&hash=955b30f145e89915&__ref=vk.api',
        'cover'  => 'https://sun9-48.userapi.com/s/v1/ig2/d6nhiC7g-WFspa-EdQ_adALPeQC6e7MjIaW0HFz3T6ta48N0h4hCv17KgNfseSc7NTpZGNOg-oEJtFd0XGUWdT7S.jpg?quality=95&size=1195x671',
        'date'   => '25 апреля 2025',
    ],
    [
        'title'  => 'Онлайн гала-концерт обладателей звания Гран-при Всероссийского конкурса «Сила Родины моей»',
        'link'   => 'https://vk.com/video-211325055_456239519',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239519&hash=3a0bfeec38c0c657&__ref=vk.api',
        'cover'  => 'https://sun9-9.userapi.com/s/v1/ig2/pa_mVtvr6EEtJVTHF41GXee8yK5XLU-JU3379uR4dAuU4RC93aBWoK-3GyFyQX1-3prBfYGdzUN23SsiuhKR86ox.jpg?quality=95&size=1220x685',
        'date'   => '19 марта 2025',
    ],
    [
        'title'  => 'Всероссийский многожанровый онлайн-концерт, посвящённый участникам специальной военной операции',
        'link'   => 'https://vk.com/video-211325055_456239499',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239499&hash=8f577686192fa7ae&__ref=vk.api',
        'cover'  => 'https://sun9-72.userapi.com/s/v1/ig2/z98ZYZfrVYT7YNJymlTM9u-nfkEqYyUdROAHRm4xqE3uF4I6QYtk7hBLRA87GkCeI9kKc0AykWkBCLh7g1gx2yAN.jpg?quality=95&size=2048x1152',
        'date'   => '7 марта 2025',
    ],
    [
        'title'  => 'Отчётный гала-концерт обладателей звания Гран-при Всероссийского многожанрового конкурса культуры и искусства «Священная Россия»',
        'link'   => 'https://vk.com/video-211325055_456239496',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239496&hash=52ef09ca5bdad305&__ref=vk.api',
        'cover'  => 'https://sun9-38.userapi.com/s/v1/ig2/FNMdhMgzLw3UjBzpmuM2P8ya817xC1bi3l087fNNFUGvc42zjUXChwDQ88o82wJx-z7zIMXPsAtNg5JZ2NvImJC1.jpg?quality=95&size=2048x1152',
        'date'   => '17 февраля 2025',
    ],
    [
        'title'  => 'Отчётный гала-концерт обладателей звания Гран-при Международного конкурса культуры и искусства «Талант года 2024»',
        'link'   => 'https://vk.com/video-211325055_456239495',
        'player' => 'https://vkvideo.ru/video_ext.php?oid=-211325055&id=456239495&hash=d1bfca1d4ab01c5d&__ref=vk.api',
        'cover'  => 'https://sun9-63.userapi.com/s/v1/ig2/YdQ6A3WrCdKJyHk-VEp2CB_xrLwpu0Su6ZcT_cVsctgoSZr68Mg4I8VvK2VlcHyUytA_bMg85O450rZeYsuncr6e.jpg?quality=95&size=1220x685',
        'date'   => '3 января 2025',
    ],
];

ob_start(); ?>
<style>
.concert-grid{display:grid;grid-template-columns:1fr;gap:24px}
@media(min-width:700px){.concert-grid{grid-template-columns:1fr 1fr}}
.concert-card{padding:0;overflow:hidden;background:var(--glass-card);backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);border-radius:20px}
.concert-embed{position:relative;width:100%;aspect-ratio:16/9;background:#0e1230;overflow:hidden;
  border-bottom:1px solid var(--glass-brd2)}
.concert-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.concert-facade{position:absolute;inset:0;border:0;padding:0;cursor:pointer;display:block;background:none}
.concert-facade img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;
  transition:transform .6s cubic-bezier(.2,.8,.2,1)}
@media(hover:hover){.concert-facade:hover img{transform:scale(1.06)}}
.concert-facade::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,19,48,.05),rgba(10,19,48,.55))}
.concert-facade .play{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center}
.concert-facade .play span{position:relative;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(10,19,48,.45);border:1.5px solid rgba(255,255,255,.7);color:#fff;backdrop-filter:blur(4px);
  transition:transform .25s,background .25s,color .25s,border-color .25s}
.concert-facade .play svg{width:30px;height:30px}
.concert-facade:hover .play span{transform:scale(1.08);background:var(--gold);color:#1b1608;border-color:var(--gold)}
.concert-facade .play span::before{content:"";position:absolute;inset:-7px;border-radius:50%;
  border:1.5px solid rgba(255,255,255,.5);animation:concert-pulse 2.6s ease-out infinite}
@keyframes concert-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}
@media(prefers-reduced-motion:reduce){
  .concert-facade .play span::before{animation:none}
  .concert-facade img{transition:none}
}
.concert-body{padding:20px}
.concert-body h3{margin:0;font-size:1.05rem;line-height:1.4;word-break:normal;hyphens:none;overflow-wrap:normal}
.concert-date{display:flex;align-items:center;gap:7px;color:var(--muted);margin:10px 0 0;font-size:.9rem}
.concert-date svg{width:15px;height:15px;flex:none;color:var(--gold)}
.concert-vk-link{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:.88rem;font-weight:700;
  color:var(--royal);text-decoration:none;border-bottom:1px solid transparent;transition:color .2s,border-color .2s}
.concert-vk-link svg{width:15px;height:15px;flex:none}
.concert-vk-link:hover{color:var(--gold);border-color:var(--gold)}
[data-theme="dark"] .concert-vk-link{color:var(--gold)}
[data-theme="dark"] .concert-vk-link:hover{color:var(--text)}
</style>

<section class="section section--parchment">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head reveal">
      <p class="eyebrow">Смотрите</p>
      <h2>Онлайн-концерты</h2>
      <p style="color:var(--text-dim);margin:12px 0 0">Записи гала-концертов и творческих вечеров нашего культурного центра.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="concert-grid">
      <?php foreach ($videos as $v): ?>
        <div class="card concert-card reveal">
          <div class="concert-embed">
            <button type="button" class="concert-facade" data-player="<?= h($v['player']) ?>"
                    aria-label="Смотреть: <?= h($v['title']) ?>">
              <img src="<?= h($v['cover']) ?>" alt="<?= h($v['title']) ?>" loading="lazy">
              <span class="play"><span><?= $icoPlay ?></span></span>
            </button>
          </div>
          <div class="concert-body">
            <h3><?= h($v['title']) ?></h3>
            <p class="concert-date"><?= $icoCal ?><span><?= h($v['date']) ?></span></p>
            <a class="concert-vk-link" href="<?= h($v['link']) ?>" target="_blank" rel="noopener"><?= $icoExt ?>Смотреть во ВКонтакте</a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<script>
(function () {
  // Ленивая подгрузка плеера по тапу на обложку: не грузим 9 iframe сразу.
  document.querySelectorAll('.concert-facade').forEach(function (fac) {
    fac.addEventListener('click', function () {
      var url = fac.getAttribute('data-player');
      if (!url) return;
      var ifr = document.createElement('iframe');
      ifr.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
      ifr.loading = 'lazy';
      ifr.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock');
      ifr.setAttribute('allowfullscreen', '');
      ifr.title = fac.getAttribute('aria-label') || '';
      fac.parentNode.replaceChild(ifr, fac);
    });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Онлайн-концерты', $content, ['active' => '/concerts', 'meta' => 'Онлайн-концерты КЦ «Музыкальный Мир»: записи гала-концертов и творческих вечеров лауреатов конкурсов.']);
