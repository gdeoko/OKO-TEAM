<?php
/** Страница ожидания оплаты (возврат с ЮKassa): спиннер «ждём подтверждение» → окно успеха. */
require_once BASE_PATH . '/core/helpers.php';

$content = '
<section class="section">
  <div class="container" style="max-width:520px">
    <div id="payWrap" class="card" style="text-align:center;padding:40px 26px;border-radius:20px">

      <div id="payWait">
        <div class="pay-spinner" aria-hidden="true"></div>
        <h1 style="margin:22px 0 8px;font-family:Georgia,serif;font-size:24px;color:#17307A">Ожидаем подтверждение оплаты…</h1>
        <p style="margin:0;color:#5a6480;line-height:1.6">Не закрывайте страницу. Как только оплата поступит, мы сразу примем заявку и покажем результат. Обычно это занимает несколько секунд.</p>
      </div>

      <div id="paySuccess" style="display:none">
        <div class="pay-check" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="72" height="72"><circle cx="26" cy="26" r="24" fill="none" stroke="#2E9E4F" stroke-width="3"/><path fill="none" stroke="#2E9E4F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M15 27 l7 7 l15 -16"/></svg>
        </div>
        <h1 style="margin:20px 0 8px;font-family:Georgia,serif;font-size:25px;color:#17307A" id="paySuccessTitle">Заявка принята!</h1>
        <p style="margin:0 0 22px;color:#5a6480;line-height:1.6" id="paySuccessText">Оплата получена. Заявка принята и передана жюри. Подтверждение отправлено на Вашу почту.</p>
        <a class="btn btn--primary" href="' . url('/cabinet') . '">Перейти в личный кабинет</a>
      </div>

      <div id="payPending" style="display:none">
        <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:23px;color:#17307A">Оплата ещё обрабатывается</h1>
        <p style="margin:0 0 22px;color:#5a6480;line-height:1.6">Подтверждение может занять до нескольких минут. Статус появится в личном кабинете автоматически — можно перейти туда и продолжить работу.</p>
        <a class="btn btn--primary" href="' . url('/cabinet') . '">В личный кабинет</a>
      </div>

    </div>
  </div>
</section>
<style>
  .pay-spinner{width:64px;height:64px;margin:0 auto;border-radius:50%;border:5px solid #E4E9F5;border-top-color:#17307A;animation:paySpin .9s linear infinite}
  @keyframes paySpin{to{transform:rotate(360deg)}}
  .pay-check svg path{stroke-dasharray:48;stroke-dashoffset:48;animation:payDraw .5s .1s ease forwards}
  @keyframes payDraw{to{stroke-dashoffset:0}}
</style>
<script>
(function(){
  var tries=0, max=40; // ~100 сек
  var wait=document.getElementById("payWait"),
      ok=document.getElementById("paySuccess"),
      pend=document.getElementById("payPending");
  function show(el){wait.style.display="none";ok.style.display="none";pend.style.display="none";el.style.display="block";}
  function poll(){
    tries++;
    fetch("' . url('/api/v1/pay_status') . '",{headers:{"X-Requested-With":"fetch"},credentials:"same-origin"})
      .then(function(r){return r.json().catch(function(){return{};});})
      .then(function(d){
        if(d && d.status==="paid"){
          if(d.kind==="order"){
            document.getElementById("paySuccessTitle").textContent="Заказ принят!";
            document.getElementById("paySuccessText").textContent="Оплата получена. Заказ "+(d.number||"")+" передан в изготовление. Подтверждение отправлено на Вашу почту.";
          } else {
            document.getElementById("paySuccessText").textContent="Оплата получена. Заявка "+(d.number?"№"+d.number+" ":"")+"принята и передана жюри. Подтверждение отправлено на Вашу почту.";
          }
          show(ok); return;
        }
        if(d && (d.status==="canceled" || d.status==="none") && tries>2){ show(pend); return; }
        if(tries>=max){ show(pend); return; }
        setTimeout(poll, 2500);
      })
      .catch(function(){ if(tries>=max){show(pend);} else setTimeout(poll,3000); });
  }
  setTimeout(poll, 1200);
})();
</script>';

render_page('Ожидаем оплату', $content, ['active' => '', 'meta' => 'Ожидание подтверждения оплаты — Культурного центра «Музыкальный Мир».']);
