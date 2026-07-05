-- OKO APP — базовая схема (раздел 2 ТЗ)
-- Применяется в Supabase. auth.users ведёт Supabase Auth; public.profiles — расширение.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- === Пользователи ===

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  bio           text,
  tg_id         bigint unique,
  phone         text,
  role          text not null default 'user' check (role in ('user','partner','staff','admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- === Подписки и платежи ===

create table subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  tier        text not null check (tier in ('free','start','pro','business','scale')),
  period      text not null check (period in ('month','3m','6m','year')),
  status      text not null default 'active' check (status in ('active','expired','canceled')),
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index on subscriptions (user_id, status, expires_at);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  provider     text not null check (provider in ('lava','crypto','card_ru','tg_stars')),
  external_id  text,                          -- id в платёжке, для идемпотентности вебхуков
  amount_usd   numeric(10,2) not null,
  amount_raw   numeric(12,2),
  currency     text not null default 'USD',
  tier         text not null,
  period       text not null,
  status       text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (provider, external_id)
);

-- === Партнёрка (строго 2 уровня) ===

create table partners (
  user_id     uuid primary key references profiles(id) on delete cascade,
  ref_code    text not null unique,
  parent_id   uuid references partners(user_id),   -- кто привёл этого партнёра (L2)
  payout_info jsonb,                               -- реквизиты
  activated_at timestamptz not null default now()
);

create table referrals (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners(user_id),
  referred_id  uuid not null references profiles(id) unique,  -- клиент привязывается один раз
  created_at   timestamptz not null default now()
);

create table accruals (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners(user_id),
  payment_id   uuid not null references payments(id),
  level        smallint not null check (level in (1,2)),
  percent      numeric(5,2) not null,             -- 15 первые 6 мес подписки клиента, далее 5
  amount_usd   numeric(10,2) not null,
  created_at   timestamptz not null default now(),
  unique (partner_id, payment_id)
);

create table payouts (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners(user_id),
  amount_usd   numeric(10,2) not null,
  status       text not null default 'requested' check (status in ('requested','processing','paid','rejected')),
  requisites   jsonb,
  requested_at timestamptz not null default now(),
  paid_at      timestamptz
);

create table ref_clicks (
  id         bigint generated always as identity primary key,
  ref_code   text not null,
  source     text,                                -- app / site
  created_at timestamptz not null default now()
);

-- === Мессенджер ===

create table chats (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('direct','group','channel')),
  title      text,
  avatar_url text,
  owner_id   uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table chat_members (
  chat_id    uuid not null references chats(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('member','admin','owner')),
  muted_until timestamptz,
  joined_at  timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (chat_id, user_id)
);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references chats(id) on delete cascade,
  sender_id  uuid not null references profiles(id),
  kind       text not null default 'text'
             check (kind in ('text','photo','video','voice','video_note','file','system')),
  body       text,
  reply_to   uuid references messages(id),
  forwarded_from uuid references messages(id),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);
create index on messages (chat_id, created_at desc);

create table attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references messages(id) on delete cascade,
  post_id     uuid,                               -- fk добавляется после posts
  s3_key      text not null,
  mime        text not null,
  size_bytes  bigint not null,
  width       int,
  height      int,
  duration_s  numeric(8,2),
  created_at  timestamptz not null default now()
);

-- === Лента ===

create table channels (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) unique,   -- канал = чат kind='channel'
  slug        text unique,
  description text
);

create table posts (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references channels(id) on delete cascade,
  author_id   uuid not null references profiles(id),
  body        text,
  published_at timestamptz not null default now(),
  metrics     jsonb not null default '{}'         -- лайки/просмотры денормализованно для скоринга
);
create index on posts (channel_id, published_at desc);

alter table attachments
  add constraint attachments_post_fk foreign key (post_id) references posts(id) on delete cascade;

create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id),
  body       text not null,
  reply_to   uuid references comments(id),
  created_at timestamptz not null default now()
);

create table reactions (
  user_id     uuid not null references profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('message','post','comment')),
  target_id   uuid not null,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_kind, target_id, emoji)
);

create table saved_posts (
  user_id  uuid not null references profiles(id) on delete cascade,
  post_id  uuid not null references posts(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- === Звонки ===

create table calls (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid references chats(id),
  started_by   uuid not null references profiles(id),
  livekit_room text not null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

create table call_recordings (
  id        uuid primary key default gen_random_uuid(),
  call_id   uuid not null references calls(id) on delete cascade,
  s3_key    text not null,
  duration_s numeric(10,2),
  created_at timestamptz not null default now()
);

-- === Мини-аппы и лимиты ===

create table miniapps (
  id         text primary key,                    -- 'system', 'video-check', 'partner'
  title      text not null,
  min_tier   text not null default 'free',
  enabled    boolean not null default true,
  config     jsonb not null default '{}'
);

create table usage_counters (
  user_id    uuid not null references profiles(id) on delete cascade,
  counter    text not null,                       -- 'video_checks', 'content_videos', ...
  period     text not null,                       -- 'YYYY-MM'
  used       int not null default 0,
  primary key (user_id, counter, period)
);

-- === Мини-апп A: Система роста по анкете ===

create table systems (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  answers     jsonb not null,                     -- анкета, 8 секций
  status      text not null default 'queued'
              check (status in ('queued','generating','review','revision','done','failed')),
  html_url    text,                               -- готовая HTML-система в S3
  review_note text,                               -- правка из командного чата
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- === Мини-апп B: Видео-премодератор ===

create table video_checks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  s3_key_tmp   text not null,                     -- бакет с lifecycle 24ч
  status       text not null default 'uploaded'
               check (status in ('uploaded','analyzing','done','fixing','published','failed')),
  score        numeric(5,2),                      -- готовность %
  reco_prob    numeric(5,2),                      -- вероятность рекомендаций
  hook_score   numeric(5,2),
  risks        jsonb,                             -- политика/коммерция/авторские
  tech         jsonb,                             -- технические параметры
  advice       jsonb,                             -- рекомендации
  fixed_s3_key text,                              -- после «исправить одним кликом»
  created_at   timestamptz not null default now()
);

-- === Контент-завод ===

create table content_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id),
  month      text not null,                       -- 'YYYY-MM'
  plan       jsonb not null,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

create table content_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references content_plans(id) on delete cascade,
  script      text,
  status      text not null default 'planned'
              check (status in ('planned','scripted','rendering','rendered','review','queued','posted','failed')),
  render_meta jsonb,                              -- Fliki job, субтитры, обложка
  post_at     timestamptz,
  posted      jsonb not null default '{}',        -- {vk: url, tg: url, ...}
  metrics     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table social_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  network     text not null check (network in ('vk','tg','instagram','youtube','tiktok')),
  external_id text,
  token_enc   text not null,                      -- AES-GCM, ключ SOCIAL_TOKENS_ENC_KEY
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (user_id, network, external_id)
);

-- === ИИ-штат ===

create table agents_logs (
  id         bigint generated always as identity primary key,
  agent      text not null,                       -- 'support', 'assistant', ...
  user_id    uuid references profiles(id),
  chat_id    uuid references chats(id),
  input      text,
  output     text,
  escalated  boolean not null default false,
  tokens_in  int,
  tokens_out int,
  created_at timestamptz not null default now()
);

create table kb_documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  tags       text[] not null default '{}',
  embedding  jsonb,                               -- vector после включения pgvector
  updated_at timestamptz not null default now()
);

-- Мини-аппы запуска
insert into miniapps (id, title, min_tier) values
  ('system',      'Система роста по анкете', 'pro'),
  ('video-check', 'Видео-премодератор',      'free'),
  ('partner',     'Партнёрский кабинет',     'free');
