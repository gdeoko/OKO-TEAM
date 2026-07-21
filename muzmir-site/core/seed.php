<?php
/** Первичное наполнение БД боевыми справочными данными КЦ. */
declare(strict_types=1);
require_once __DIR__ . '/data.php';

function db_seed(PDO $pdo): void {
    // --- Владелец/админ ---
    $adminPass = getenv('MUZMIR_OWNER_PASS') ?: 'muzmir-2026';
    $pdo->prepare("INSERT OR IGNORE INTO users(email,password_hash,full_name,role,email_verified)
                   VALUES(?,?,?,?,1)")
        ->execute(['kulturniy.centr.mir@gmail.com', password_hash($adminPass, PASSWORD_DEFAULT),
                   'Оргкомитет', 'owner']);

    // --- Конкурсы ---
    $comps = [
        ['simfoniya-zvyozd','SZ','Симфония Звёзд','international','multi',1,900],
        ['vershina-masterstva','VM','Вершина Мастерства','international','multi',1,900],
        ['mirovaya-scena','MC','Мировая Сцена','international','multi',1,1000],
        ['slava-rossii','SR','Слава России','national','patriotic',0,0],
        ['profi','PR','Профи','international','thematic',1,1200],
        ['evrika','EV','Эврика','international','multi',1,1000],
        ['buduschee-rossii','BR','Будущее России','national','patriotic',0,0],
        ['atlanty-iskusstva','AI','Атланты Искусства','international','multi',1,900],
        ['den-pobedy','DP','День Победы','national','patriotic',0,0],
        ['grani-talanta','GT','Грани Таланта','international','multi',1,900],
        ['tvorchestvo-bez-granic','TG','Творчество без Границ','international','multi',1,900],
    ];
    $noms = json_encode(array_keys(NOMINATIONS()), JSON_UNESCAPED_UNICODE);
    $st = $pdo->prepare("INSERT OR IGNORE INTO competitions
        (slug,code,name,type,direction,is_paid,price,status,nominations,sort,description)
        VALUES(?,?,?,?,?,?,?, 'open', ?, ?, '')");
    foreach ($comps as $i => $c) {
        $st->execute([$c[0],$c[1],$c[2],$c[3],$c[4],$c[5],$c[6],$noms,$i]);
    }

    // --- Прайс наград (общий шаблон, редактируется по конкурсу в админке) ---
    $prices = [
        ['Кубок Гран-при','original',1500],
        ['Статуэтка лауреата','original',1000],
        ['Медаль дипломанта','original',500],
        ['Основной диплом','digital',400], ['Основной диплом','original',500],
        ['Дополнительный диплом','digital',350], ['Дополнительный диплом','original',450],
        ['Именной диплом','digital',400], ['Именной диплом','original',500],
        ['Благодарность','digital',300], ['Благодарность','original',400],
    ];
    if ((int)$pdo->query("SELECT COUNT(*) FROM awards_prices")->fetchColumn() === 0) {
        $ps = $pdo->prepare("INSERT INTO awards_prices(competition_id,item,kind,price) VALUES(NULL,?,?,?)");
        foreach ($prices as $p) $ps->execute($p);
    }

    // --- FAQ ---
    $faqs = [
        ['Как подать заявку на конкурс?','Выберите конкурс в разделе «Конкурсы», нажмите «Подать заявку» и заполните форму. Все проверки помогут внести данные без ошибок.'],
        ['Какие платформы можно использовать для конкурсной ссылки?','RuTube, Яндекс Диск, Google Диск, Cloud Mail, VK Видео, ОК Видео, Дзен Видео. Ссылка должна быть открыта для просмотра.'],
        ['Когда приходят результаты?','Результаты публикуются в срок, указанный в положении конкурса, и направляются на Вашу электронную почту.'],
        ['Как получить оригинал наградного материала?','Оформите заказ в разделе «Оплата наград». Оригиналы направляются по указанному адресу.'],
        ['Как проверить подлинность диплома?','На каждом дипломе есть QR-код и номер. Перейдите по QR-коду или введите номер на странице проверки.'],
        ['Можно ли участвовать коллективом?','Да. При подаче заявки укажите название коллектива и форму исполнения: дуэт, ансамбль или хор.'],
    ];
    if ((int)$pdo->query("SELECT COUNT(*) FROM faq")->fetchColumn() === 0) {
        $fs = $pdo->prepare("INSERT INTO faq(question,answer,sort) VALUES(?,?,?)");
        foreach ($faqs as $i => $f) $fs->execute([$f[0],$f[1],$i]);
    }

    // --- Текстовые страницы (тексты уточняются с текущего сайта в CMS) ---
    $pages = [
        ['goals','Цели и задачи','<p>Культурный центр «Музыкальный Мир» проводит международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. Наша цель — поддержка и развитие талантов, сохранение культурных традиций, создание условий для творческого роста участников любого возраста.</p><p>Деятельность ведётся в соответствии с Главой 57 Гражданского кодекса Российской Федерации (публичный конкурс) и Указом Президента Российской Федерации №808 от 24.12.2014.</p>'],
        ['agreement','Пользовательское соглашение','<p>Текст пользовательского соглашения. Раздел заполняется в панели управления.</p>'],
        ['privacy','Политика конфиденциальности','<p>Текст политики конфиденциальности. Раздел заполняется в панели управления.</p>'],
        ['about','О нас','<p>Культурный центр «Музыкальный Мир» — московская арт-организация. Мы проводим онлайн-конкурсы и фестивали при информационной поддержке Министерств культуры и образования субъектов Российской Федерации, портала PROКультура.РФ, Национальных проектов «Культура», Союза композиторов России.</p><p>Партнёры: студия звуко-видео записи «ZAMIS», дизайнерская арт-студия «Mr.Archer».</p>'],
    ];
    $pgs = $pdo->prepare("INSERT OR IGNORE INTO pages(slug,title,body) VALUES(?,?,?)");
    foreach ($pages as $p) $pgs->execute($p);

    // --- Настройки счётчиков главной ---
    $now = date('Y-m-d H:i:s');
    foreach ([
        'stat_competitions'=>'120','stat_participants'=>'15000','stat_regions'=>'85',
        'stat_countries'=>'12','stat_diplomas'=>'37000',
        'hero_title'=>'Культурный центр «Музыкальный Мир»',
        'hero_subtitle'=>'Международные и всероссийские онлайн-конкурсы и фестивали',
    ] as $k=>$v) {
        $pdo->prepare("INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)")->execute([$k,$v,$now]);
    }
}
