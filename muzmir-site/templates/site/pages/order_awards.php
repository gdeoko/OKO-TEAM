<?php
/** Форма заказа наградного материала. */
$comps = all("SELECT id,slug,name FROM competitions WHERE status != 'draft' ORDER BY sort");
$preselect = input('competition', '');

// Результаты аттестации - из общей шкалы оценивания.
$results = [];
foreach (GRADE_SCALE() as [$lo, $hi, $title]) { $results[$title] = true; }
$results = array_keys($results);

// Прайс: индивидуальный по конкурсу поверх общего шаблона (competition_id IS NULL).
$allPrices = all("SELECT * FROM awards_prices ORDER BY item, kind");
$general = []; $byComp = [];
foreach ($allPrices as $p) {
    $key = $p['item'] . '||' . $p['kind'];
    if ($p['competition_id'] === null) { $general[$key] = (int)$p['price']; }
    else { $byComp[(int)$p['competition_id']][$key] = (int)$p['price']; }
}
$allKeys = array_keys($general);
foreach ($byComp as $arr) { foreach (array_keys($arr) as $k) { if (!in_array($k, $allKeys, true)) $allKeys[] = $k; } }

$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронная версия'];
$itemsMeta = [];
foreach ($allKeys as $k) {
    [$item, $kind] = explode('||', $k, 2);
    $itemsMeta[$k] = ['item' => $item, 'kind' => $kind, 'label' => $item . ' - ' . ($kindLabel[$kind] ?? $kind)];
}

$priceMatrix = [];
foreach ($comps as $c) {
    $row = [];
    foreach ($allKeys as $k) {
        $val = $byComp[$c['id']][$k] ?? ($general[$k] ?? null);
        if ($val !== null) $row[$k] = $val;
    }
    $priceMatrix[$c['slug']] = $row;
}

$icoCard = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';

ob_start(); ?>
<section class="section section--parchment">
  <div class="container" style="max-width:760px">
    <div class="section-head reveal">
      <p class="eyebrow">Награды</p>
      <h2>Заказ наградного материала</h2>
      <p>Заполните форму, отметьте нужные позиции - сумма пересчитывается сразу. Заказ оформляется после оплаты.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:760px">
    <div class="card reveal" style="background:var(--gold-soft);margin-bottom:26px">
      <h3 style="margin-top:0">Важно перед оформлением</h3>
      <ul style="padding-left:20px;color:var(--text-dim);margin:0">
        <li style="margin-bottom:8px">Заявка на изготовление наградного материала оформляется только после оглашения результатов конкурса — по вашему личному решению и на добровольной основе.</li>
        <li style="margin-bottom:8px">Стоимость доставки наградного материала оплачивается отдельно заказчиком при получении (наложенный платёж).</li>
        <li style="margin-bottom:0">Организационный взнос за аттестованный конкурсный материал возврату не подлежит. При возврате посылки по вине заказчика повторная отправка производится полностью за его счёт.</li>
      </ul>
    </div>
    <form id="awardsOrderForm" class="reveal" novalidate>
      <?= csrf_field() ?>

      <div class="field">
        <label for="fullName">ФИО участника</label>
        <input type="text" id="fullName" name="full_name" placeholder="Иванова Мария Сергеевна" required>
        <span class="err-msg">Укажите ФИО участника.</span>
      </div>

      <div class="field">
        <label for="competition">Конкурс</label>
        <select id="competition" name="competition" required>
          <option value="">Выберите конкурс</option>
          <?php foreach ($comps as $c): ?>
            <option value="<?= h($c['slug']) ?>" <?= $preselect === $c['slug'] ? 'selected' : '' ?>><?= h($c['name']) ?></option>
          <?php endforeach; ?>
        </select>
        <span class="err-msg">Выберите конкурс.</span>
      </div>

      <div class="field">
        <label for="result">Аттестационный результат</label>
        <select id="result" name="result" required>
          <option value="">Выберите результат</option>
          <?php foreach ($results as $r): ?>
            <option value="<?= h($r) ?>"><?= h($r) ?></option>
          <?php endforeach; ?>
        </select>
        <span class="err-msg">Выберите аттестационный результат.</span>
      </div>

      <div class="field">
        <label>Тип награды</label>
        <div id="awardItems" style="border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:6px 16px">
          <p style="color:var(--muted);margin:12px 0">Сначала выберите конкурс.</p>
        </div>
        <span class="hint">Можно отметить несколько позиций.</span>
        <span class="err-msg" id="itemsErr">Отметьте хотя бы одну позицию наградного материала.</span>
      </div>

      <div class="field">
        <label for="address">Адрес доставки</label>
        <textarea id="address" name="address" rows="3" placeholder="Индекс, город, улица, дом, квартира" required></textarea>
        <span class="hint">Заполняется, если выбран оригинал наградного материала.</span>
        <span class="err-msg">Укажите адрес доставки.</span>
      </div>

      <div class="grid grid-2">
        <div class="field">
          <label for="email">Электронная почта</label>
          <input type="email" id="email" name="email" placeholder="mail@example.ru" required>
          <span class="err-msg">Укажите корректную электронную почту.</span>
        </div>
        <div class="field">
          <label for="phone">Телефон</label>
          <input type="tel" id="phone" name="phone" placeholder="+7 (___) ___-__-__" required>
          <span class="err-msg">Укажите телефон для связи.</span>
        </div>
      </div>

      <div class="card" style="background:var(--gold-soft);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:22px">
        <span style="font-weight:700">Сумма к оплате</span>
        <b id="totalDisplay" style="font-family:var(--ff-display);font-size:1.6rem;color:var(--gold-2)">0 ₽</b>
      </div>

      <div class="field">
        <label>Способ оплаты</label>
        <label class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer">
          <input type="radio" name="pay_method" value="yukassa" checked style="width:auto;flex:none">
          <span style="width:30px;height:30px;color:var(--gold-2);flex:none"><?= $icoCard ?></span>
          <span>
            <b>ЮKassa</b> - банковской картой<br>
            <span class="hint">Приём платежей подключается. После оформления заказа с Вами свяжется Оргкомитет.</span>
          </span>
        </label>
      </div>

      <button class="btn btn--primary btn--lg btn--block" type="submit" id="submitBtn">Оформить заказ и перейти к оплате</button>
      <p id="formMsg" style="text-align:center;margin-top:14px"></p>
    </form>
  </div>
</section>

<script>
(function () {
  var PRICES = <?= json_encode($priceMatrix, JSON_UNESCAPED_UNICODE) ?>;
  var META = <?= json_encode($itemsMeta, JSON_UNESCAPED_UNICODE) ?>;

  var form = document.getElementById('awardsOrderForm');
  var compSel = document.getElementById('competition');
  var itemsBox = document.getElementById('awardItems');
  var totalEl = document.getElementById('totalDisplay');
  var msg = document.getElementById('formMsg');

  function money(n) { return n.toLocaleString('ru-RU') + ' ₽'; }

  function renderItems(slug) {
    var rows = PRICES[slug] || {};
    var keys = Object.keys(rows);
    if (!keys.length) {
      itemsBox.innerHTML = '<p style="color:var(--muted);margin:12px 0">Прайс для этого конкурса не заполнен. Свяжитесь с Оргкомитетом.</p>';
      recompute();
      return;
    }
    var html = '';
    keys.forEach(function (k) {
      var m = META[k] || { label: k };
      html += '<label style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer">' +
        '<span><input type="checkbox" class="award-item" data-key="' + k + '" data-price="' + rows[k] + '" style="width:auto;margin-right:10px">' + m.label + '</span>' +
        '<b>' + money(rows[k]) + '</b></label>';
    });
    itemsBox.innerHTML = html;
    recompute();
  }

  function recompute() {
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    var total = 0;
    boxes.forEach(function (b) { total += parseInt(b.getAttribute('data-price'), 10) || 0; });
    totalEl.textContent = money(total);
  }

  compSel.addEventListener('change', function () { renderItems(compSel.value); });
  itemsBox.addEventListener('change', function (e) { if (e.target.classList.contains('award-item')) recompute(); });

  if (compSel.value) renderItems(compSel.value);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var boxes = itemsBox.querySelectorAll('.award-item:checked');
    var ok = form.checkValidity();
    if (!boxes.length) {
      document.getElementById('itemsErr').parentNode.classList.add('error');
      ok = false;
    } else {
      document.getElementById('itemsErr').parentNode.classList.remove('error');
    }
    if (!ok) { form.reportValidity(); return; }

    var items = [];
    var amount = 0;
    boxes.forEach(function (b) {
      var k = b.getAttribute('data-key'), price = parseInt(b.getAttribute('data-price'), 10) || 0;
      var m = META[k] || {};
      items.push({ item: m.item || k, kind: m.kind || '', price: price });
      amount += price;
    });

    var payload = new FormData(form);
    payload.append('items', JSON.stringify(items));
    payload.append('amount', amount);

    var btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Отправляем...';
    fetch('<?= url('/api/v1/order') ?>', { method: 'POST', body: payload })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false; btn.textContent = 'Оформить заказ и перейти к оплате';
        if (d && d.ok) {
          msg.style.color = 'var(--mint)';
          msg.textContent = d.message || 'Заказ оформлен. Переход к оплате ЮKassa будет доступен после подключения магазина.';
          form.reset(); itemsBox.innerHTML = '<p style="color:var(--muted);margin:12px 0">Сначала выберите конкурс.</p>'; totalEl.textContent = money(0);
        } else {
          msg.style.color = 'var(--error)';
          msg.textContent = (d && d.message) || 'Не удалось отправить заказ. Попробуйте ещё раз.';
        }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Оформить заказ и перейти к оплате';
        msg.style.color = 'var(--mint)';
        msg.textContent = 'Заказ принят. Оргкомитет свяжется с Вами для оплаты.';
        form.reset();
      });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Заказ наградного материала', $content, ['active' => '/awards', 'meta' => 'Оформление заказа наградного материала: кубки, статуэтки, медали и дипломы КЦ «Музыкальный Мир».']);
