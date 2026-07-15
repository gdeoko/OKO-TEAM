-- ═══════════════════════════════════════════════════════════════
--  МЕТАНОЙЯ · seed.sql · начальные данные
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- Суперадмин Екатерина (пароль по умолчанию — bcrypt cost 12; сменить после первого входа)
INSERT INTO users (email, password_hash, name, role, confession, country, city, email_verified_at)
VALUES ('ekaterinasbogom@gmail.com',
        '$2y$12$kOP6y9GocJsqXNOVuwLVm.Ne.Y2g6OWqVmBa9WeO/D3dRe8Shbyhe',
        'Екатерина Павленко', 'superadmin', 'protestant', 'Россия', 'Гатчина', NOW());

INSERT INTO user_settings (user_id) VALUES (1);

-- Учебные блоки (рабочая версия, финал — к сентябрю 2026)
INSERT INTO blocks (number, title, description, award_badge) VALUES
 (1, 'Знакомство с Богом', 'Кто такой Бог, Создание мира, Адам и Ева, Ноев ковчег, Вавилонская башня и другие.', 'pioneer'),
 (2, 'Герои веры', 'Авраам, Моисей, Давид и Голиаф, Даниил, Иона и другие.', 'heroes-expert'),
 (3, 'Жизнь Иисуса', 'Рождество, Крещение, Чудеса, Притчи, Пасха и Воскресение.', 'christ-disciple');

-- Каталог 20 игр (раздел 10)
INSERT INTO games (game_key, title, is_premium, min_age, xp_min, xp_max) VALUES
 ('verse-puzzle',   'Собери стих',            0, 5, 15, 30),
 ('bible-memory',   'Библейское мемори',      0, 5, 20, 20),
 ('speed-quiz',     'Викторина на скорость',  0, 7, 10, 30),
 ('who-is-it',      'Кто это?',               0, 7, 10, 30),
 ('chronology',     'Хронология',             0, 7, 15, 25),
 ('match3-gifts',   'Три в ряд: Дары Духа',   1, 5,  5, 15),
 ('exodus-runner',  'Исход',                  1, 5, 10, 25),
 ('david-goliath',  'Давид и Голиаф',         1, 7, 15, 30),
 ('noah-ark',       'Ноев Ковчег',            1, 5, 15, 25),
 ('solomon-temple', 'Храм Соломона',          1, 10, 5, 10),
 ('ark-quest',      'Ковчег Завета',          1, 7, 20, 30),
 ('bible-detective','Библейский детектив',    1, 10, 10, 30),
 ('dilemma',        'Дилемма',                1, 5, 10, 10),
 ('family-quiz',    'Семейный квиз',          1, 5, 20, 40),
 ('faith-journey',  'Путешествие веры',       0, 5,  0,  0),
 ('temple-builder', 'Строитель храма',        0, 5,  0,  0),
 ('daily-verse',    'Ежедневный стих',        0, 5,  5,  5),
 ('daily-challenge','Ежедневный вызов',       1, 5, 10, 50),
 ('interpretation', 'Толкование',             0, 10, 10, 20),
 ('coloring',       'Раскраски',              1, 5,  5,  5);

-- Значки (раздел 11.5)
INSERT INTO achievements (badge_key, title, description, icon) VALUES
 ('pioneer',        'Первооткрыватель', 'Пройди первый урок', '🏅'),
 ('bookworm',       'Книжный червь',    'Прочитай 10 текстов', '📚'),
 ('sniper',         'Снайпер',          '5 тестов подряд на 100%', '🎯'),
 ('gamer',          'Игроман',          'Сыграй во все бесплатные игры', '🎮'),
 ('sociable',       'Общительный',      '20 сообщений в чате', '💬'),
 ('flame',          'Пламенный',        'Серия 30 дней', '🔥'),
 ('faithful-7',     'Верный ученик',    'Серия 7 дней', '🔥'),
 ('builder',        'Строитель',        'Храм построен наполовину', '🏗'),
 ('architect',      'Архитектор веры',  'Храм построен полностью', '⛪'),
 ('master',         'Мастер',           'Пройди все блоки года', '👑'),
 ('excellent',      'Отличник',         'Итоговые тесты 3 блоков на 100%', '🎓'),
 ('lightning',      'Молниеносный',     '10 из 10 в викторине на скорость', '⚡'),
 ('david-courage',  'Смелость Давида',  'Давид и Голиаф на 3 звезды', '🦁'),
 ('covenant-rainbow','Радуга завета',   'Собери все виды животных в Ковчеге', '🌈'),
 ('christ-disciple','Ученик Христа',    'Пройди блок «Жизнь Иисуса»', '✝️'),
 ('heroes-expert',  'Знаток героев',    'Пройди блок «Герои веры»', '🎖'),
 ('year-with-god',  'Год с Богом',      'Серия 365 дней', '🏆'),
 ('month-wisdom',   'Месяц мудрости',   'Серия 30 дней', '⭐'),
 ('stoic-100',      'Стоик веры',       'Серия 100 дней', '👑');

-- Стикерпак «Метанойя» — 30 штук (раздел 8.5; SVG рисуются на этапе 3)
INSERT INTO stickers (sticker_key, title, file_url, category, position) VALUES
 ('pray-hands',    'Молитва',              '/assets/svg/stickers/pray-hands.svg',    'emotions', 1),
 ('winged-heart',  'Сердце с крыльями',    '/assets/svg/stickers/winged-heart.svg',  'emotions', 2),
 ('smiling-sun',   'Солнышко',             '/assets/svg/stickers/smiling-sun.svg',   'emotions', 3),
 ('dove-branch',   'Голубь с веточкой',    '/assets/svg/stickers/dove-branch.svg',   'emotions', 4),
 ('sparkles',      'Звёздочки',            '/assets/svg/stickers/sparkles.svg',      'emotions', 5),
 ('candle-up',     'Свеча',                '/assets/svg/stickers/candle-up.svg',     'emotions', 6),
 ('teardrop',      'Слезинка',             '/assets/svg/stickers/teardrop.svg',      'emotions', 7),
 ('angels-hug',    'Обнимашки',            '/assets/svg/stickers/angels-hug.svg',    'emotions', 8),
 ('angel-laugh',   'Смех',                 '/assets/svg/stickers/angel-laugh.svg',   'emotions', 9),
 ('faith-flame',   'Огонёк веры',          '/assets/svg/stickers/faith-flame.svg',   'emotions', 10),
 ('little-church', 'Маленький храм',       '/assets/svg/stickers/little-church.svg', 'spiritual', 11),
 ('open-bible',    'Библия с сиянием',     '/assets/svg/stickers/open-bible.svg',    'spiritual', 12),
 ('cross-rays',    'Крестик с лучами',     '/assets/svg/stickers/cross-rays.svg',    'spiritual', 13),
 ('burning-candle','Горящая свеча',        '/assets/svg/stickers/burning-candle.svg','spiritual', 14),
 ('bell',          'Колокольчик',          '/assets/svg/stickers/bell.svg',          'spiritual', 15),
 ('palm-branch',   'Пальмовая ветвь',      '/assets/svg/stickers/palm-branch.svg',   'spiritual', 16),
 ('bethlehem-star','Вифлеемская звезда',   '/assets/svg/stickers/bethlehem-star.svg','spiritual', 17),
 ('lamb',          'Овечка',               '/assets/svg/stickers/lamb.svg',          'spiritual', 18),
 ('lion-cub',      'Львёнок',              '/assets/svg/stickers/lion-cub.svg',      'spiritual', 19),
 ('rainbow',       'Радуга',               '/assets/svg/stickers/rainbow.svg',       'spiritual', 20),
 ('grad-halo',     'Урок пройден!',        '/assets/svg/stickers/grad-halo.svg',     'study', 21),
 ('cup-cross',     'Кубок',                '/assets/svg/stickers/cup-cross.svg',     'study', 22),
 ('scroll-quill',  'Свиток с пером',       '/assets/svg/stickers/scroll-quill.svg',  'study', 23),
 ('oil-lamp',      'Лампадка (идея)',      '/assets/svg/stickers/oil-lamp.svg',      'study', 24),
 ('target-cross',  'Цель достигнута',      '/assets/svg/stickers/target-cross.svg',  'study', 25),
 ('angel-wave',    'Привет!',              '/assets/svg/stickers/angel-wave.svg',    'greetings', 26),
 ('moon-star',     'Спокойной ночи',       '/assets/svg/stickers/moon-star.svg',     'greetings', 27),
 ('sunrise',       'Доброе утро',          '/assets/svg/stickers/sunrise.svg',       'greetings', 28),
 ('angel-question','Вопрос',               '/assets/svg/stickers/angel-question.svg','greetings', 29),
 ('wildflowers',   'Поздравляю!',          '/assets/svg/stickers/wildflowers.svg',   'greetings', 30);

-- Системные чаты (раздел 8.1)
INSERT INTO chats (kind, title, is_pinned, is_readonly, created_by) VALUES
 ('channel',  'Екатерина Павленко', 1, 1, 1),
 ('group',    'Общий чат школы',    0, 0, 1),
 ('parents',  'Чат родителей',      0, 0, 1),
 ('students', 'Чат учеников',       0, 0, 1),
 ('support',  'Поддержка',          0, 0, 1);

INSERT INTO chat_members (chat_id, user_id, role) VALUES
 (1, 1, 'owner'), (2, 1, 'owner'), (3, 1, 'owner'), (4, 1, 'owner'), (5, 1, 'owner');

-- Глобальные настройки
INSERT INTO system_settings (setting_key, value) VALUES
 ('app_name', 'Метанойя'),
 ('subscription_price_monthly', '990'),
 ('trial_days', '7'),
 ('xp_lesson_watch', '20'),
 ('xp_text_read', '10'),
 ('xp_test_pass', '15'),
 ('xp_test_perfect_bonus', '30'),
 ('xp_daily_login', '5'),
 ('xp_daily_verse', '5'),
 ('xp_chat_message', '2'),
 ('xp_chat_daily_cap', '10'),
 ('xp_block_test', '50'),
 ('xp_block_test_perfect_bonus', '100'),
 ('xp_year_certificate', '500'),
 ('xp_individual_lesson', '20');
