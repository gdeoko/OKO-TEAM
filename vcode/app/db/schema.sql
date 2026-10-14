-- ════════════════════════════════════════════════════════════════
--  V.CODE · schema.sql · SQLite 3
--  Приложение: обучение контент-креаторов + биржа заказов + партнёрка.
--  Схема переносится на MySQL почти дословно: типы намеренно простые.
-- ════════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ───────────────── ЛЮДИ ─────────────────

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id           INTEGER UNIQUE,              -- telegram user id
  username        TEXT,
  first_name      TEXT NOT NULL DEFAULT '',
  last_name       TEXT NOT NULL DEFAULT '',
  photo_url       TEXT,
  phone           TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'creator',   -- creator | client | admin
  city            TEXT NOT NULL DEFAULT '',
  about           TEXT NOT NULL DEFAULT '',
  services        TEXT NOT NULL DEFAULT '',          -- JSON: ["рилс","обзор"]
  price_from      INTEGER,                           -- ₽ за ролик
  links           TEXT NOT NULL DEFAULT '',          -- JSON: {"instagram":"...","tg":"..."}
  portfolio       TEXT NOT NULL DEFAULT '',          -- JSON: [{"url","title","cover"}]
  xp              INTEGER NOT NULL DEFAULT 0,
  streak          INTEGER NOT NULL DEFAULT 0,
  streak_day      TEXT NOT NULL DEFAULT '',          -- YYYY-MM-DD последнего зачёта
  level           INTEGER NOT NULL DEFAULT 1,
  rating          REAL NOT NULL DEFAULT 0,
  deals_done      INTEGER NOT NULL DEFAULT 0,
  balance         INTEGER NOT NULL DEFAULT 0,        -- копейки, внутренний счёт
  ref_code        TEXT UNIQUE,
  ref_by          INTEGER REFERENCES users(id),
  plan            TEXT NOT NULL DEFAULT 'free',      -- free | pro | mentor
  plan_until      TEXT,                              -- YYYY-MM-DD HH:MM:SS
  is_blocked      INTEGER NOT NULL DEFAULT 0,
  is_verified     INTEGER NOT NULL DEFAULT 0,
  lang            TEXT NOT NULL DEFAULT 'ru',
  theme           TEXT NOT NULL DEFAULT 'dark',
  notify          INTEGER NOT NULL DEFAULT 1,
  source          TEXT NOT NULL DEFAULT '',          -- utm / откуда пришёл
  last_seen_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

-- ───────────────── АКАДЕМИЯ ─────────────────

CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  descr       TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',             -- /assets/img/...
  accent      TEXT NOT NULL DEFAULT '#7A5CFF',
  access      TEXT NOT NULL DEFAULT 'free',          -- free | pro | paid
  price       INTEGER NOT NULL DEFAULT 0,            -- ₽, если paid
  level       TEXT NOT NULL DEFAULT 'С нуля',
  duration    TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT 'V.CODE',
  cert        INTEGER NOT NULL DEFAULT 1,            -- выдаётся ли сертификат
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',     -- published | draft | soon
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  descr       TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_blocks_course ON blocks(course_id);

CREATE TABLE IF NOT EXISTS lessons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id    INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',             -- одна строка-обещание
  minutes     INTEGER NOT NULL DEFAULT 7,
  xp          INTEGER NOT NULL DEFAULT 10,
  slides      TEXT NOT NULL DEFAULT '[]',           -- JSON
  notes       TEXT NOT NULL DEFAULT '',             -- конспект, markdown-lite
  practice    TEXT NOT NULL DEFAULT '',             -- задание
  quiz        TEXT NOT NULL DEFAULT '[]',           -- JSON вопросов
  audio       TEXT NOT NULL DEFAULT '',             -- озвучка конспекта
  video       TEXT NOT NULL DEFAULT '',             -- ролик урока, 1920x1080
  cover       TEXT NOT NULL DEFAULT '',             -- обложка урока и постер ролика
  free        INTEGER NOT NULL DEFAULT 0,           -- доступен без оплаты
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published'
);
CREATE INDEX IF NOT EXISTS idx_lessons_block ON lessons(block_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

CREATE TABLE IF NOT EXISTS progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id   INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'opened',       -- opened | done
  score       INTEGER NOT NULL DEFAULT 0,           -- % теста
  attempts    INTEGER NOT NULL DEFAULT 0,
  slide       INTEGER NOT NULL DEFAULT 0,           -- на каком слайде остановился
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  number      TEXT NOT NULL UNIQUE,
  issued_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

-- ───────────────── БИРЖА ЗАКАЗОВ ─────────────────

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  descr       TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'reels',        -- reels | obzor | prodakshn | montazh | foto
  city        TEXT NOT NULL DEFAULT '',
  remote      INTEGER NOT NULL DEFAULT 1,
  budget      INTEGER NOT NULL DEFAULT 0,           -- ₽
  deadline    TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'new',          -- new | moderation | open | in_work | done | closed
  taken_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  fee_percent INTEGER NOT NULL DEFAULT 20,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS responses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'sent',         -- sent | chosen | declined
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id, user_id)
);

-- ───────────────── ДЕНЬГИ ─────────────────

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider    TEXT NOT NULL DEFAULT 'lava',         -- lava | yookassa | manual | stars
  ext_id      TEXT,                                 -- id платежа у провайдера
  product     TEXT NOT NULL DEFAULT '',             -- plan:pro | course:slug
  amount      INTEGER NOT NULL DEFAULT 0,           -- ₽
  currency    TEXT NOT NULL DEFAULT 'RUB',
  status      TEXT NOT NULL DEFAULT 'created',      -- created | paid | failed | refunded
  promo       TEXT NOT NULL DEFAULT '',
  raw         TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

CREATE TABLE IF NOT EXISTS promos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  percent     INTEGER NOT NULL DEFAULT 0,
  fixed       INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER NOT NULL DEFAULT 0,           -- 0 = без ограничения
  used        INTEGER NOT NULL DEFAULT 0,
  until       TEXT,
  active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL DEFAULT 0,
  method      TEXT NOT NULL DEFAULT '',
  requisites  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'new',          -- new | paid | declined
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────────────── КОНТЕНТ ПРИЛОЖЕНИЯ ─────────────────

CREATE TABLE IF NOT EXISTS posts (                   -- лента/новости/анонсы
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS events (                  -- аналитика действий
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  kind        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);

CREATE TABLE IF NOT EXISTS leads (                   -- воронка бота
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id       INTEGER UNIQUE,
  username    TEXT,
  name        TEXT NOT NULL DEFAULT '',
  stage       TEXT NOT NULL DEFAULT 'new',           -- new | warm | offer | paid | lost
  step        INTEGER NOT NULL DEFAULT 0,            -- шаг прогрева
  next_at     TEXT,                                  -- когда следующее касание
  note        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  text        TEXT NOT NULL,
  button      TEXT NOT NULL DEFAULT '',
  audience    TEXT NOT NULL DEFAULT 'all',           -- all | free | pro | creators | clients
  sent        INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'new',           -- new | sending | done
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
