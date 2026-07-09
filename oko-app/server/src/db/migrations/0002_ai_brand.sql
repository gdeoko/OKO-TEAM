-- 0002: ИИ-штат (RAG), бренд-профили клиентов, лог Daniel-AI.
-- Применять после 0001_init. Требует расширения pgvector (Supabase поддерживает).

-- ── RAG: векторный поиск по базе знаний ──────────────────────────────────────
create extension if not exists vector;

-- Переносим kb_documents.embedding с jsonb на настоящий vector (1536 = text-embedding-3-small).
-- Если колонка уже vector — no-op; иначе пересоздаём.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'kb_documents' and column_name = 'embedding' and data_type = 'jsonb'
  ) then
    alter table kb_documents drop column embedding;
    alter table kb_documents add column embedding vector(1536);
  end if;
end $$;

create index if not exists kb_documents_embedding_idx
  on kb_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Функция косинусного поиска релевантных документов базы знаний.
create or replace function match_kb(query_embedding vector(1536), match_count int default 5)
returns table (id uuid, title text, body text, similarity float)
language sql stable as $$
  select id, title, body, 1 - (embedding <=> query_embedding) as similarity
  from kb_documents
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── Бренд-профили клиентов (для контент-конвейеров: reels-machine, лендинги, Системы) ──
create table if not exists client_brand_profiles (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references profiles(id) on delete cascade,
  palette         jsonb,          -- до 5 hex-цветов
  fonts           jsonb,          -- { display, body }
  tone            text,           -- премиум / доверительный / динамичный / технологичный
  references_urls jsonb,          -- 3–5 URL сайтов-референсов
  forbidden_words text[] not null default '{}',
  logo_url        text,
  created_at      timestamptz not null default now()
);
create index if not exists client_brand_profiles_client_idx on client_brand_profiles(client_id);

-- ── Лог Daniel-AI: всё, что делает ассистент (автономно / черновик / эскалация) ──
create table if not exists daniel_ai_log (
  id            uuid primary key default gen_random_uuid(),
  ts            timestamptz not null default now(),
  mode          text not null,   -- autonomous | draft_for_approval | escalation
  action_type   text,
  summary       text,
  full_context  jsonb,
  resolved      boolean not null default false,
  daniel_response text
);
create index if not exists daniel_ai_log_ts_idx on daniel_ai_log(ts desc);
