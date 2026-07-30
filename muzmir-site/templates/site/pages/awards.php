<?php
/**
 * Награды — мини-магазин наградной продукции с корзиной.
 * Сетка образцов (диплом/медаль/статуэтка/кубок/благодарность) → корзина с количеством →
 * выбор заявки на участие → оплата ЮKassa. Отдельная «заявка на изготовление» не нужна:
 * заказ привязывается к заявке на участие в конкурсе.
 */
$u = current_user();

// Прайс наградной линейки (общий шаблон competition_id IS NULL).
$prices = all("SELECT item, kind, price FROM awards_prices WHERE competition_id IS NULL ORDER BY price DESC");

// Группируем по позиции: item => [kind => price]
$catalog = [];
foreach ($prices as $p) { $catalog[$p['item']][$p['kind']] = (int)$p['price']; }

// Описания + иконки товаров
$meta = [
  'Кубок Гран-при'        => ['ic'=>'cup',    'desc'=>'Объёмный кубок обладателю Гран-при. Премиальное исполнение, подарочная упаковка.', 'tag'=>'Высшая награда'],
  'Статуэтка лауреата'    => ['ic'=>'trophy', 'desc'=>'Наградная статуэтка лауреата I–III степени.', 'tag'=>''],
  'Медаль дипломанта'     => ['ic'=>'medal',  'desc'=>'Металлическая медаль на ленте с символикой центра.', 'tag'=>''],
  'Основной диплом'       => ['ic'=>'diploma','desc'=>'Официальный диплом с результатом. Электронный — всем участникам бесплатно; оригинал — на плотной бумаге.', 'tag'=>''],
  'Дополнительный диплом' => ['ic'=>'diploma','desc'=>'Дополнительный экземпляр — для второго педагога, концертмейстера или архива.', 'tag'=>''],
  'Именной диплом'        => ['ic'=>'diploma','desc'=>'Индивидуальный диплом участнику коллектива с сохранённым званием.', 'tag'=>''],
  'Благодарность'         => ['ic'=>'thanks', 'desc'=>'Именная благодарность педагогу или руководителю.', 'tag'=>''],
];
$icons = [
  'cup'     => '<path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/>',
  'trophy'  => '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/>',
  'medal'   => '<circle cx="12" cy="15" r="6"/><path d="M9 3h6l-2 6h-2z"/>',
  'diploma' => '<path d="M6 2h9l3 3v17H6z"/><path d="M15 2v3h3M9 12h6M9 16h4"/>',
  'thanks'  => '<path d="M20.8 4.6c-1.7-1.7-4.4-1.7-6 0L12 7.4 9.2 4.6c-1.7-1.7-4.4-1.7-6 0-1.7 1.7-1.7 4.4 0 6L12 19l8.8-8.4c1.7-1.6 1.7-4.3 0-6z"/>',
];
$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронный'];

// Заявки пользователя для выбора при оформлении.
$myApps = [];
if ($u) {
    $myApps = all("SELECT a.id, a.number, a.full_name, a.result, c.name AS comp_name
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.user_id=? ORDER BY a.created_at DESC", [(int)$u['id']]);
}

$order = ['Кубок Гран-при','Статуэтка лауреата','Медаль дипломанта','Основной диплом','Дополнительный диплом','Именной диплом','Благодарность'];

ob_start(); ?>
<section class="section shop-page" style="padding-top:12px">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal" style="text-align:left;margin-bottom:8px">
      <p class="eyebrow eyebrow--script" style="margin:0">Наградная продукция</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.6rem,5.5vw,2.2rem);margin:2px 0 4px;
        background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent">Образцы наград</h1>
      <p style="color:var(--muted);margin:0;font-size:.9rem">Выберите награды и количество, оформите заказ по своей заявке на участие.</p>
    </div>

    <div class="shop-grid">
      <?php foreach ($order as $item):
        if (empty($catalog[$item])) continue;
        $m = $meta[$item] ?? ['ic'=>'diploma','desc'=>'','tag'=>''];
        $kinds = $catalog[$item];
        $ic = $icons[$m['ic']] ?? $icons['diploma'];
      ?>
      <div class="shop-card reveal" data-item="<?= h($item) ?>">
        <div class="shop-card-top">
          <span class="shop-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><?= $ic ?></svg></span>
          <?php if ($m['tag']): ?><span class="shop-tag"><?= h($m['tag']) ?></span><?php endif; ?>
        </div>
        <h3 class="shop-name"><?= h($item) ?></h3>
        <p class="shop-desc"><?= h($m['desc']) ?></p>
        <div class="shop-kinds">
          <?php $first=true; foreach ($kinds as $kind => $price): ?>
            <label class="shop-kind">
              <input type="radio" name="kind_<?= md5($item) ?>" value="<?= h($kind) ?>" data-price="<?= (int)$price ?>" <?= $first?'checked':'' ?>>
              <span><?= h($kindLabel[$kind] ?? $kind) ?></span>
              <b><?= number_format((int)$price,0,'.',' ') ?> ₽</b>
            </label>
          <?php $first=false; endforeach; ?>
        </div>
        <div class="shop-actions">
          <div class="qty" data-qty>
            <button type="button" class="qty-btn" data-dec aria-label="Меньше">−</button>
            <span class="qty-val" data-val>1</span>
            <button type="button" class="qty-btn" data-inc aria-label="Больше">+</button>
          </div>
          <button type="button" class="btn btn--primary shop-add" data-add>В корзину</button>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<button type="button" class="shop-cart-fab" id="cartFab" hidden aria-label="Корзина">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/><path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L23 7H6"/></svg>
  <span class="shop-cart-count" id="cartCount">0</span>
</button>

<div class="shop-cart" id="cartSheet" hidden>
  <div class="shop-cart-backdrop" data-cart-close></div>
  <div class="shop-cart-panel">
    <div class="shop-cart-grab"></div>
    <div class="shop-cart-head">
      <h3>Корзина</h3>
      <button type="button" class="shop-cart-x" data-cart-close aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="shop-cart-items" id="cartItems"></div>
    <div class="shop-cart-empty" id="cartEmpty">Корзина пуста</div>

    <form id="orderForm" class="shop-checkout" hidden>
      <?= csrf_field() ?>
      <div class="shop-total"><span>Итого</span><b id="cartTotal">0 ₽</b></div>

      <?php if ($u): ?>
        <?php if ($myApps): ?>
        <div class="field">
          <label for="ord_app">По какой заявке</label>
          <select id="ord_app" name="application_id" required>
            <option value="">Выберите заявку…</option>
            <?php foreach ($myApps as $a): ?>
              <option value="<?= (int)$a['id'] ?>"><?= h($a['number']) ?> — <?= h(mb_strimwidth((string)$a['comp_name'],0,26,'…')) ?><?= $a['result']?' ('.h($a['result']).')':'' ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <?php else: ?>
          <p class="shop-hint">У Вас пока нет заявок. <a href="<?= url('/apply') ?>">Подайте заявку на участие</a> — затем сможете заказать награды.</p>
        <?php endif; ?>
      <?php else: ?>
        <div class="field">
          <label for="ord_number">Номер заявки (необязательно)</label>
          <input type="text" id="ord_number" name="application_number" placeholder="MM-2026-00001">
          <div class="hint">Или <a href="<?= url('/login') ?>">войдите</a>, чтобы выбрать заявку из списка.</div>
        </div>
      <?php endif; ?>

      <div class="field">
        <label for="ord_name">ФИО получателя</label>
        <input type="text" id="ord_name" name="full_name" value="<?= h($u['full_name'] ?? '') ?>" required>
      </div>
      <div class="grid-2c">
        <div class="field">
          <label for="ord_email">Почта</label>
          <input type="email" id="ord_email" name="email" value="<?= h($u['email'] ?? '') ?>" required>
        </div>
        <div class="field">
          <label for="ord_phone">Телефон</label>
          <input type="tel" id="ord_phone" name="phone" value="<?= h($u['phone'] ?? '') ?>" data-phone required>
        </div>
      </div>
      <div class="field" id="addrField">
        <label for="ord_addr">Адрес доставки (для оригиналов)</label>
        <input type="text" id="ord_addr" name="address" placeholder="Индекс, город, улица, дом, кв.">
        <div class="hint">Доставка оригиналов — Почтой России, оплачивается при получении.</div>
      </div>
      <button type="submit" class="btn btn--primary btn--block btn--lg" id="orderSubmit">Оплатить</button>
      <p id="orderErr" class="shop-err" hidden></p>
    </form>
  </div>
</div>

<script>
(function(){
  var KIND_LABEL = {"original":"Оригинал","digital":"Электронный","club":"Клуб"};
  var cart = [];
  var $ = function(s,r){return (r||document).querySelector(s);};
  var fab=$('#cartFab'), sheet=$('#cartSheet'), itemsBox=$('#cartItems'), emptyBox=$('#cartEmpty'),
      form=$('#orderForm'), totalEl=$('#cartTotal'), countEl=$('#cartCount');

  document.querySelectorAll('[data-qty]').forEach(function(q){
    var v=q.querySelector('[data-val]');
    q.querySelector('[data-dec]').addEventListener('click',function(){v.textContent=Math.max(1,parseInt(v.textContent)-1);});
    q.querySelector('[data-inc]').addEventListener('click',function(){v.textContent=Math.min(20,parseInt(v.textContent)+1);});
  });
  document.querySelectorAll('.shop-card').forEach(function(card){
    card.querySelector('[data-add]').addEventListener('click',function(){
      var item=card.getAttribute('data-item');
      var kindInp=card.querySelector('input[type=radio]:checked');
      var kind=kindInp.value, price=parseInt(kindInp.getAttribute('data-price'));
      var qty=parseInt(card.querySelector('[data-val]').textContent)||1;
      var ex=cart.find(function(c){return c.item===item&&c.kind===kind;});
      if(ex){ex.qty+=qty;}else{cart.push({item:item,kind:kind,price:price,qty:qty});}
      render(); openCart();
      if(window.toast)window.toast('Добавлено в корзину','success');
    });
  });
  function render(){
    var total=0,count=0; itemsBox.innerHTML='';
    cart.forEach(function(c,i){
      total+=c.price*c.qty; count+=c.qty;
      var row=document.createElement('div');row.className='shop-cart-row';
      row.innerHTML='<div class="scr-info"><b>'+c.item+'</b><span>'+(KIND_LABEL[c.kind]||c.kind)+' · '+c.price+' ₽</span></div>'+
        '<div class="scr-qty"><button type="button" data-m>−</button><span>'+c.qty+'</span><button type="button" data-p>+</button></div>'+
        '<div class="scr-sum">'+(c.price*c.qty)+' ₽</div>'+
        '<button type="button" class="scr-del" data-del aria-label="Удалить">✕</button>';
      row.querySelector('[data-m]').onclick=function(){c.qty=Math.max(1,c.qty-1);render();};
      row.querySelector('[data-p]').onclick=function(){c.qty=Math.min(20,c.qty+1);render();};
      row.querySelector('[data-del]').onclick=function(){cart.splice(i,1);render();};
      itemsBox.appendChild(row);
    });
    totalEl.textContent=total.toLocaleString('ru-RU')+' ₽';
    countEl.textContent=count; fab.hidden=count===0; emptyBox.hidden=count>0; form.hidden=count===0;
  }
  function openCart(){sheet.hidden=false;requestAnimationFrame(function(){sheet.classList.add('on');});}
  function closeCart(){sheet.classList.remove('on');setTimeout(function(){sheet.hidden=true;},300);}
  fab.addEventListener('click',openCart);
  document.querySelectorAll('[data-cart-close]').forEach(function(b){b.addEventListener('click',closeCart);});

  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(!cart.length)return;
    var err=$('#orderErr'); err.hidden=true;
    var btn=$('#orderSubmit'); btn.disabled=true; btn.textContent='Создаём заказ…';
    var items=[]; cart.forEach(function(c){for(var i=0;i<c.qty;i++)items.push({item:c.item,kind:c.kind});});
    var fd=new FormData(form); fd.set('items',JSON.stringify(items));
    fetch('<?= url('/api/v1/order') ?>',{method:'POST',credentials:'same-origin',body:fd})
      .then(function(r){return r.json();})
      .then(function(d){
        btn.disabled=false; btn.textContent='Оплатить';
        if(!d.ok){err.textContent=d.error||'Не удалось оформить заказ';err.hidden=false;return;}
        if(d.confirmation_url){location.href=d.confirmation_url;return;}
        location.href='<?= url('/cabinet') ?>#awards';
      }).catch(function(){btn.disabled=false;btn.textContent='Оплатить';err.textContent='Ошибка сети, попробуйте ещё раз';err.hidden=false;});
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Образцы наград', $content, ['active' => '/awards', 'meta' => 'Наградная продукция КЦ «Музыкальный Мир»: дипломы, медали, статуэтки, кубки. Заказ по заявке на участие, оплата онлайн.']);
