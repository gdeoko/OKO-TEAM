-- ═══════════════════════════════════════════════════════════════
--  МЕТАНОЙЯ · schema.sql · Этап 1
--  MySQL 8.0 · utf8mb4 · InnoDB
--  Все таблицы: id, created_at, updated_at. FK и индексы на местах.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ───────────────── ПОЛЬЗОВАТЕЛИ И ПРОФИЛИ ─────────────────

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,                 -- NULL при OAuth-регистрации
  name          VARCHAR(120) NOT NULL,
  role          ENUM('parent','teacher','student12','superadmin') NOT NULL DEFAULT 'parent',
  confession    ENUM('orthodox','protestant','catholic','other','undecided') NOT NULL DEFAULT 'undecided',
  country       VARCHAR(80)  NULL,
  city          VARCHAR(120) NULL,
  timezone      VARCHAR(60)  NOT NULL DEFAULT 'Europe/Moscow',
  avatar        VARCHAR(255) NULL,
  google_id     VARCHAR(64)  NULL UNIQUE,
  telegram_id   BIGINT       NULL UNIQUE,
  email_verified_at DATETIME NULL,
  parent_pin_hash   VARCHAR(255) NULL,             -- PIN выхода из детского режима
  is_blocked    TINYINT(1) NOT NULL DEFAULT 0,
  last_seen_at  DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE children (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  age         TINYINT UNSIGNED NOT NULL,
  gender      ENUM('m','f') NULL,
  avatar_key  VARCHAR(40) NOT NULL DEFAULT 'angel',  -- ключ SVG-аватара
  xp          INT UNSIGNED NOT NULL DEFAULT 0,
  rank_level  TINYINT UNSIGNED NOT NULL DEFAULT 1,   -- 1..8 (Зёрнышко..Хранитель)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_children_parent (parent_id),
  INDEX idx_children_xp (xp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_settings (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL UNIQUE,
  theme       ENUM('light','dark','auto') NOT NULL DEFAULT 'auto',
  font_size   ENUM('s','m','l','xl') NOT NULL DEFAULT 'm',
  notif_lessons  TINYINT(1) NOT NULL DEFAULT 1,
  notif_achievements TINYINT(1) NOT NULL DEFAULT 1,
  notif_chats    TINYINT(1) NOT NULL DEFAULT 1,
  notif_daily    TINYINT(1) NOT NULL DEFAULT 1,
  notif_reports  TINYINT(1) NOT NULL DEFAULT 1,
  quiet_from  TIME NULL DEFAULT '22:00:00',
  quiet_to    TIME NULL DEFAULT '08:00:00',
  privacy_rating   TINYINT(1) NOT NULL DEFAULT 1,  -- участие в рейтинге
  privacy_feed     TINYINT(1) NOT NULL DEFAULT 1,  -- достижения в ленту
  privacy_online   TINYINT(1) NOT NULL DEFAULT 1,
  dm_policy   ENUM('all','school','none') NOT NULL DEFAULT 'school',
  child_session_limit_min SMALLINT UNSIGNED NULL,  -- родительский контроль
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,     -- sha256 от refresh JWT
  user_agent  VARCHAR(255) NULL,
  ip          VARCHAR(45)  NULL,
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_exp (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── ОБУЧЕНИЕ ─────────────────

CREATE TABLE blocks (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number      TINYINT UNSIGNED NOT NULL UNIQUE,    -- 1,2,3
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  award_badge VARCHAR(60) NULL,                    -- ключ значка-награды
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lessons (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  block_id    INT UNSIGNED NOT NULL,
  number      TINYINT UNSIGNED NOT NULL,           -- 1..36 сквозной
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  cover_url   VARCHAR(255) NULL,
  youtube_id  VARCHAR(20)  NULL,
  duration_min SMALLINT UNSIGNED NULL,
  age_group   ENUM('5-7','7-10','10-14','all') NOT NULL DEFAULT 'all',
  status      ENUM('draft','scheduled','done','ready') NOT NULL DEFAULT 'draft',
  kind        ENUM('group','individual') NOT NULL DEFAULT 'group',
  summary_parents TEXT NULL,                       -- Claude: сводка 5-7 тезисов
  summary_kids    TEXT NULL,                       -- Claude: детский пересказ
  scripture_quotes JSON NULL,                      -- Claude: цитаты с местами
  homework    TEXT NULL,                           -- Claude: ДЗ
  book_chapter TEXT NULL,                          -- Claude: глава книги
  published_at DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (block_id) REFERENCES blocks(id),
  UNIQUE KEY uq_lessons_number (number),
  INDEX idx_lessons_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lesson_progress (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id    INT UNSIGNED NOT NULL,
  lesson_id   INT UNSIGNED NOT NULL,
  watched     TINYINT(1) NOT NULL DEFAULT 0,
  watch_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  test_passed TINYINT(1) NOT NULL DEFAULT 0,
  homework_done TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,                      -- все 3 условия выполнены
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY uq_progress (child_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tests (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id   INT UNSIGNED NULL,                   -- NULL = итоговый по блоку
  block_id    INT UNSIGNED NULL,
  title       VARCHAR(190) NOT NULL,
  pass_percent TINYINT UNSIGNED NOT NULL DEFAULT 70,
  max_attempts_per_day TINYINT UNSIGNED NOT NULL DEFAULT 3,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_questions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  test_id     INT UNSIGNED NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  kind        ENUM('single','multiple','truefalse','match','order','text') NOT NULL,
  question    TEXT NOT NULL,
  payload     JSON NULL,                           -- пары/порядок/варианты
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  INDEX idx_tq_test (test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_answers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id INT UNSIGNED NOT NULL,
  answer      TEXT NOT NULL,
  is_correct  TINYINT(1) NOT NULL DEFAULT 0,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_results (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  test_id     INT UNSIGNED NOT NULL,
  child_id    INT UNSIGNED NOT NULL,
  score       TINYINT UNSIGNED NOT NULL,           -- баллы
  total       TINYINT UNSIGNED NOT NULL,
  percent     TINYINT UNSIGNED NOT NULL,
  passed      TINYINT(1) NOT NULL DEFAULT 0,
  answers     JSON NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_tr_child (child_id, test_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE homework (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id   INT UNSIGNED NOT NULL,
  child_id    INT UNSIGNED NOT NULL,
  file_url    VARCHAR(255) NULL,
  comment     TEXT NULL,
  status      ENUM('submitted','reviewed','returned') NOT NULL DEFAULT 'submitted',
  teacher_comment TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_hw_child (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── ИГРЫ ─────────────────

CREATE TABLE games (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_key    VARCHAR(60) NOT NULL UNIQUE,         -- 'verse-puzzle', 'memory'...
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  is_premium  TINYINT(1) NOT NULL DEFAULT 0,
  min_age     TINYINT UNSIGNED NOT NULL DEFAULT 5,
  xp_min      TINYINT UNSIGNED NOT NULL DEFAULT 10,
  xp_max      TINYINT UNSIGNED NOT NULL DEFAULT 25,
  config      JSON NULL,                           -- сложность, уровни
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_scores (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id     INT UNSIGNED NOT NULL,
  child_id    INT UNSIGNED NOT NULL,
  score       INT UNSIGNED NOT NULL DEFAULT 0,
  stars       TINYINT UNSIGNED NULL,
  time_sec    INT UNSIGNED NULL,
  level       SMALLINT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_gs_child_game (child_id, game_id),
  INDEX idx_gs_score (game_id, score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE game_data (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id     INT UNSIGNED NOT NULL,
  kind        VARCHAR(40) NOT NULL,                -- 'quiz_question','verse','character'
  payload     JSON NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  INDEX idx_gd_game_kind (game_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── ГЕЙМИФИКАЦИЯ ─────────────────

CREATE TABLE xp_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id    INT UNSIGNED NOT NULL,
  amount      SMALLINT NOT NULL,
  reason      VARCHAR(60) NOT NULL,                -- 'lesson_watch','test_pass'...
  ref_id      INT UNSIGNED NULL,                   -- id урока/игры/теста
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  INDEX idx_xp_child_date (child_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE achievements (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  badge_key   VARCHAR(60) NOT NULL UNIQUE,         -- 'pioneer','sniper'...
  title       VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon        VARCHAR(16)  NOT NULL DEFAULT '🏅',
  is_premium  TINYINT(1) NOT NULL DEFAULT 0,
  condition_json JSON NULL,                        -- условие получения
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_achievements (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id    INT UNSIGNED NOT NULL,
  achievement_id INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ua (child_id, achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE streaks (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id    INT UNSIGNED NOT NULL UNIQUE,
  current_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  best_days   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_active_date DATE NULL,
  freezes_used_month TINYINT UNSIGNED NOT NULL DEFAULT 0, -- заморозки (Метанойя+)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── ЧАТЫ ─────────────────

CREATE TABLE chats (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind        ENUM('channel','group','parents','students','lesson','support','dm') NOT NULL,
  title       VARCHAR(190) NULL,
  avatar      VARCHAR(255) NULL,
  description TEXT NULL,
  rules       TEXT NULL,
  is_pinned   TINYINT(1) NOT NULL DEFAULT 0,
  is_readonly TINYINT(1) NOT NULL DEFAULT 0,       -- режим канала
  slow_mode_sec SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  pinned_message_id INT UNSIGNED NULL,
  lesson_id   INT UNSIGNED NULL,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_members (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  role        ENUM('member','moderator','owner') NOT NULL DEFAULT 'member',
  is_muted_by_user TINYINT(1) NOT NULL DEFAULT 0,  -- мьют для себя
  muted_until DATETIME NULL,                        -- мут модератором
  banned_until DATETIME NULL,
  joined_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cm (chat_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id     INT UNSIGNED NOT NULL,
  sender_id   INT UNSIGNED NOT NULL,
  kind        ENUM('text','photo','video','voice','circle','file','sticker','poll','system') NOT NULL DEFAULT 'text',
  body        TEXT NULL,
  file_url    VARCHAR(255) NULL,
  file_meta   JSON NULL,                           -- размер, длительность, волна
  sticker_key VARCHAR(60) NULL,
  reply_to_id INT UNSIGNED NULL,
  forwarded_from_id INT UNSIGNED NULL,
  is_deleted  TINYINT(1) NOT NULL DEFAULT 0,
  scheduled_at DATETIME NULL,                      -- отложенные (Екатерина)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
  INDEX idx_msg_chat_created (chat_id, id),
  FULLTEXT INDEX ft_msg_body (body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message_reactions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  reaction    VARCHAR(20) NOT NULL,                -- 'pray','heart','fire','smile','sad','like'
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_mr (message_id, user_id, reaction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE read_status (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chat_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  last_read_message_id INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_rs (chat_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stickers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sticker_key VARCHAR(60) NOT NULL UNIQUE,         -- 'pray-hands', 'dove-branch'...
  title       VARCHAR(120) NOT NULL,
  file_url    VARCHAR(255) NOT NULL,               -- /assets/svg/stickers/...
  category    ENUM('emotions','spiritual','study','greetings') NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── КОНТЕНТ ЛЕНТЫ ─────────────────

CREATE TABLE posts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id   INT UNSIGNED NOT NULL,
  kind        ENUM('lesson','announce','achievement','event','quote','chapter') NOT NULL,
  title       VARCHAR(255) NULL,
  body        TEXT NULL,
  image_url   VARCHAR(255) NULL,
  ref_id      INT UNSIGNED NULL,                   -- id урока/события/главы
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  publish_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_posts_pub (is_published, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_likes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_pl (post_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  body        TEXT NOT NULL,
  is_deleted  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pc_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id   INT UNSIGNED NOT NULL,
  media_url   VARCHAR(255) NOT NULL,
  media_kind  ENUM('image','video') NOT NULL DEFAULT 'image',
  duration_sec TINYINT UNSIGNED NOT NULL DEFAULT 7,
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  expires_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── ПОДПИСКИ И ПЛАТЕЖИ ─────────────────

CREATE TABLE subscriptions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  plan        ENUM('monthly','yearly','trial') NOT NULL DEFAULT 'monthly',
  status      ENUM('active','trial','cancelled','expired') NOT NULL,
  lava_subscription_id VARCHAR(120) NULL,
  started_at  DATETIME NOT NULL,
  next_charge_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  expires_at  DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sub_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  subscription_id INT UNSIGNED NULL,
  amount      DECIMAL(10,2) NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'RUB',
  kind        ENUM('subscription','individual_lesson','donation') NOT NULL,
  status      ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  lava_invoice_id VARCHAR(120) NULL UNIQUE,
  meta        JSON NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_pay_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donations (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,                   -- NULL = аноним
  payment_id  INT UNSIGNED NULL,
  amount      DECIMAL(10,2) NOT NULL,
  display_name VARCHAR(120) NULL,                  -- для стены благодарности
  is_partner  TINYINT(1) NOT NULL DEFAULT 0,       -- ежемесячный партнёр
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── СОБЫТИЯ ─────────────────

CREATE TABLE events (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_id   INT UNSIGNED NULL,
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  starts_at   DATETIME NOT NULL,
  duration_min SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  max_participants SMALLINT UNSIGNED NULL,
  jitsi_room  VARCHAR(120) NULL,                   -- metanoia-lesson-{id}
  status      ENUM('scheduled','live','done','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  INDEX idx_events_start (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_registrations (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id    INT UNSIGNED NOT NULL,
  child_id    INT UNSIGNED NOT NULL,
  attended    TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  UNIQUE KEY uq_er (event_id, child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── МАТЕРИАЛЫ ─────────────────

CREATE TABLE materials (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  kind        ENUM('pdf','coloring','audio','cards','checklist','other') NOT NULL,
  file_url    VARCHAR(255) NOT NULL,
  block_id    INT UNSIGNED NULL,
  lesson_id   INT UNSIGNED NULL,
  is_premium  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE SET NULL,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE material_downloads (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_md_material (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── УВЕДОМЛЕНИЯ ─────────────────

CREATE TABLE notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  kind        VARCHAR(40) NOT NULL,                -- 'lesson_new','badge','rank_up'...
  title       VARCHAR(190) NOT NULL,
  body        VARCHAR(500) NULL,
  ref_kind    VARCHAR(40) NULL,
  ref_id      INT UNSIGNED NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE push_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token       VARCHAR(255) NOT NULL UNIQUE,
  platform    ENUM('web','android','ios') NOT NULL DEFAULT 'web',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────── АДМИНИСТРАТИВНЫЕ ─────────────────

CREATE TABLE moderation_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  moderator_id INT UNSIGNED NOT NULL,
  action      VARCHAR(40) NOT NULL,                -- 'ban','mute','delete_msg'...
  target_user_id INT UNSIGNED NULL,
  chat_id     INT UNSIGNED NULL,
  message_id  INT UNSIGNED NULL,
  reason      VARCHAR(255) NULL,
  payload     JSON NULL,                           -- копия удалённого сообщения
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ml_target (target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(60) NOT NULL,                -- 'register','payment','ban'...
  ip          VARCHAR(45) NULL,
  payload     JSON NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(80) NOT NULL UNIQUE,
  value       TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
