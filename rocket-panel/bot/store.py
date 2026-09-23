"""Хранилище бота: пользователи, коины, история. SQLite, без внешних служб.

Два кармана коинов:
    welcome  — подарены на старте и за приглашения
    paid     — куплены, НЕ СГОРАЮТ НИКОГДА

Тратим в порядке welcome → paid: сначала подаренное, потом оплаченное.
Так человек не теряет деньги из-за порядка списания — купленное уходит
последним и ждёт его сколько угодно.

## Подписки нет

Решение владельца 21.09.2026: у нас только покупка коинов. Раньше
здесь был третий карман `sub` — сгорающий в конце оплаченного месяца.
Он убран, а остатки из него при первом открытии базы переносятся в
`paid`: человек за это заплатил, и наше решение поменять модель не
повод отобрать у него коины.
"""

import sqlite3, time, secrets, json
from contextlib import contextmanager

# Порядок списания: сначала подаренное, потом оплаченное.
PURSES = ("welcome", "paid")

# Баланс безлимитного. Не бесконечность и не ноль: число проходит через
# те же проверки «хватает ли», подписи и отчёты, что и обычный баланс,
# и нигде не требует отдельной ветки. Видно, что оно не настоящее.
БЕЗЛИМИТ = 999_999

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  tg_id        INTEGER PRIMARY KEY,
  username     TEXT,
  welcome      INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
  ref_code     TEXT UNIQUE,
  invited_by   INTEGER,
  created_at   INTEGER NOT NULL,
  blocked      INTEGER NOT NULL DEFAULT 0,
  lang         TEXT
);
CREATE TABLE IF NOT EXISTS ledger (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id     INTEGER NOT NULL,
  delta     INTEGER NOT NULL,
  purse     TEXT NOT NULL,
  reason    TEXT NOT NULL,
  meta      TEXT,
  at        INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id        TEXT PRIMARY KEY,
  tg_id     INTEGER NOT NULL,
  kind      TEXT NOT NULL,
  scene     TEXT,
  prompt    TEXT,
  coins    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  file      TEXT,
  path      TEXT,
  tg_file_id TEXT,
  size      INTEGER,
  error     TEXT,
  at        INTEGER NOT NULL,
  done_at   INTEGER
);
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id TEXT PRIMARY KEY,
  tg_id      INTEGER NOT NULL,
  pack_id    TEXT NOT NULL,
  at         INTEGER NOT NULL,
  credited_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id  INTEGER NOT NULL,
  вид    TEXT NOT NULL,
  ключ   TEXT,
  at     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS support (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id   INTEGER NOT NULL,
  откого  TEXT NOT NULL,
  текст   TEXT NOT NULL,
  прочитано INTEGER NOT NULL DEFAULT 0,
  at      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mailings (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  текст    TEXT NOT NULL,
  кому     TEXT NOT NULL,
  всего    INTEGER NOT NULL DEFAULT 0,
  дошло    INTEGER NOT NULL DEFAULT 0,
  отказ    INTEGER NOT NULL DEFAULT 0,
  состояние TEXT NOT NULL DEFAULT 'ждёт',
  at       INTEGER NOT NULL,
  done_at  INTEGER
);
CREATE TABLE IF NOT EXISTS partners (
  tg_id       INTEGER PRIMARY KEY,
  username    TEXT,
  оплачено    INTEGER NOT NULL DEFAULT 0,
  валюта      TEXT,
  токен       TEXT,
  бот         TEXT,
  состояние   TEXT NOT NULL DEFAULT 'ждёт токен',
  доля        INTEGER NOT NULL DEFAULT 50,
  выручка     INTEGER NOT NULL DEFAULT 0,
  выплачено   INTEGER NOT NULL DEFAULT 0,
  at          INTEGER NOT NULL,
  запущен_at  INTEGER
);
CREATE INDEX IF NOT EXISTS ix_ledger_user ON ledger(tg_id, at);
CREATE INDEX IF NOT EXISTS ix_jobs_user   ON jobs(tg_id, at);
CREATE INDEX IF NOT EXISTS ix_events_at   ON events(at);
CREATE INDEX IF NOT EXISTS ix_events_user ON events(tg_id, at);
CREATE INDEX IF NOT EXISTS ix_support_at  ON support(at);
"""


class NotEnoughCoins(Exception):
    def __init__(self, need, have):
        super().__init__(f"Нужно {need} коинов, на балансе {have}")
        self.need, self.have = need, have


class Store:
    def __init__(self, path="rocket_bot.db", безлимит=()):
        self.path = path
        # КОМУ НЕ СЧИТАЕМ КОИНЫ. Владелец и админ смотрят бот не как
        # покупатели: они проверяют варианты подряд, и с каждой пробой
        # у них убывал бы баланс, который они же себе и начисляют.
        #
        # Список принимает и числовой id, и @username: у владельца под
        # рукой обычно второе, а id он знает не всегда. Сравнение по
        # username — уступка удобству, и она имеет цену: username в
        # телеграме можно сменить и занять чужой. Поэтому здесь только
        # ДВА-ТРИ СВОИХ ЧЕЛОВЕКА, и это не механизм раздачи льгот.
        self.безлимит = {str(x).lstrip("@").lower()
                         for x in безлимит if str(x).strip()}
        with self._db() as c:
            c.executescript(SCHEMA)
            self._migrate(c)

    @staticmethod
    def _migrate(c):
        """Приводит старую базу к нынешней схеме.

        Боевая база уже живёт с людьми и их купленными коинами,
        поэтому ничего не пересоздаём.

        Главное здесь — подписочный карман `sub`. Он отменён, но у кого-то
        в нём могли остаться коины. Переносим их в `paid`, а не гасим:
        человек за них заплатил, и смена нашей модели — не повод отобрать.
        Перенос виден в истории, чтобы на него можно было сослаться.
        """
        # Архив работ. `file` — имя на арендованной видеокарте, оно
        # умирает вместе с арендой; `path` и `tg_file_id` — два адреса,
        # которые переживают возврат карты. Добавляем по одному: SQLite
        # не умеет добавить колонку, которая уже есть.
        есть_у_jobs = {r["name"] for r in c.execute("PRAGMA table_info(jobs)")}
        for стлб, тип in (("path", "TEXT"), ("tg_file_id", "TEXT"),
                          ("size", "INTEGER"), ("scene", "TEXT")):
            if стлб not in есть_у_jobs:
                c.execute(f"ALTER TABLE jobs ADD COLUMN {стлб} {тип}")

        have = {r["name"] for r in c.execute("PRAGMA table_info(users)")}
        # Язык интерфейса. У тех, кто пришёл до двуязычия, он пуст —
        # это не «русский», а «ещё не спрашивали»: при первом же заходе
        # он проставится по языку телеграма, и человек не окажется
        # молча переведён на чужой.
        if "lang" not in have:
            c.execute("ALTER TABLE users ADD COLUMN lang TEXT")

        # Версия нижней клавиатуры, которую человек реально получил.
        # Reply-клавиатура живёт в чате, а не в сообщении: поменяв
        # подписи, мы обязаны прислать её заново, иначе у давних людей
        # внизу навсегда остаются прежние кнопки. Пусто — значит ещё
        # ни одной новой не присылали.
        if "kb_ver" not in have:
            c.execute("ALTER TABLE users ADD COLUMN kb_ver TEXT")

        # Выбранное человеком сложение: «стройная» / «средняя» /
        # «пышная». Пусто — значит не выбирал, работает умолчание кода.
        # Помнится между работами: один и тот же человек обычно приносит
        # снимки одного и того же человека.
        if "build" not in have:
            c.execute("ALTER TABLE users ADD COLUMN build TEXT")

        # Ступени качества отменены — колонка выбора убирается. База
        # могла успеть её получить: миграция идёт по факту, а не по
        # памяти о том, разворачивали мы ту версию или нет.
        if "quality" in have:
            c.execute("ALTER TABLE users DROP COLUMN quality")

        if "sub" not in have:
            return
        now = int(time.time())
        for r in c.execute("SELECT tg_id, sub FROM users WHERE sub > 0").fetchall():
            c.execute("UPDATE users SET paid=paid+? WHERE tg_id=?", (r["sub"], r["tg_id"]))
            c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                      (r["tg_id"], -r["sub"], "sub", "подписки больше нет, остаток перенесён", now))
            c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                      (r["tg_id"], r["sub"], "paid", "перенос с отменённой подписки", now))
        for стлб in ("sub", "sub_id", "sub_until"):
            if стлб in have:
                c.execute(f"ALTER TABLE users DROP COLUMN {стлб}")

    @contextmanager
    def _db(self):
        c = sqlite3.connect(self.path, timeout=20)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA foreign_keys=ON")
        try:
            yield c
            c.commit()
        finally:
            c.close()

    # --- пользователи ---

    def user(self, tg_id):
        with self._db() as c:
            r = c.execute("SELECT * FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            return dict(r) if r else None

    def ensure_user(self, tg_id, username=None, welcome=0, invited_by=None,
                    lang=None):
        """Заводит пользователя, если его нет. Возвращает (пользователь, новый?).

        `lang` проставляется ТОЛЬКО когда у человека его ещё нет. Он
        приходит из телеграма при каждом сообщении, и перезаписывать им
        сохранённый выбор значило бы отменять этот выбор при каждом
        нажатии: человек переключил на английский, а следующее же
        сообщение вернуло русский.
        """
        u = self.user(tg_id)
        if u:
            правки, значения = [], []
            if username and u["username"] != username:
                правки.append("username=?"); значения.append(username)
                u["username"] = username
            if lang and not u.get("lang"):
                правки.append("lang=?"); значения.append(lang)
                u["lang"] = lang
            if правки:
                with self._db() as c:
                    c.execute(f"UPDATE users SET {','.join(правки)} WHERE tg_id=?",
                              (*значения, tg_id))
            return u, False
        code = secrets.token_urlsafe(6)
        with self._db() as c:
            c.execute(
                "INSERT INTO users(tg_id,username,welcome,ref_code,invited_by,"
                "created_at,lang) VALUES(?,?,?,?,?,?,?)",
                (tg_id, username, welcome, code, invited_by, int(time.time()),
                 lang),
            )
            if welcome:
                c.execute(
                    "INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                    (tg_id, welcome, "welcome", "подарок при старте", int(time.time())),
                )
        return self.user(tg_id), True

    def низ_устарел(self, tg_id, версия):
        """Висит ли у человека прежняя нижняя клавиатура.

        Отвечает и СРАЗУ ЗАПОМИНАЕТ новую версию: вызывающий обязан
        после «да» прислать клавиатуру. Так выбрано нарочно — иначе
        между ответом и записью влезает второе сообщение того же
        человека, и он получает две одинаковые клавиатуры подряд.

        Не прислать после «да» — потерять обновление до следующей
        правки подписей. Это лучше, чем слать его при каждом нажатии.
        """
        u = self.user(tg_id)
        if not u or u.get("kb_ver") == версия:
            return False
        with self._db() as c:
            c.execute("UPDATE users SET kb_ver=? WHERE tg_id=?", (версия, tg_id))
        return True

    def сложение(self, tg_id):
        """Какое сложение выбрал человек. Пусто — умолчание кода."""
        u = self.user(tg_id)
        return (u or {}).get("build") or ""

    def сменить_сложение(self, tg_id, ключ):
        with self._db() as c:
            c.execute("UPDATE users SET build=? WHERE tg_id=?", (ключ, tg_id))
        return ключ

    def язык(self, tg_id, по_умолчанию="ru"):
        u = self.user(tg_id)
        return (u or {}).get("lang") or по_умолчанию

    def сменить_язык(self, tg_id, lang):
        with self._db() as c:
            c.execute("UPDATE users SET lang=? WHERE tg_id=?", (lang, tg_id))
        return lang

    def by_ref_code(self, code):
        with self._db() as c:
            r = c.execute("SELECT * FROM users WHERE ref_code=?", (code,)).fetchone()
            return dict(r) if r else None

    # --- личный кабинет ---


    def сводка(self, tg_id):
        """Всё о человеке одним запросом — для кабинета.

        Считается по журналу, а не отдельными счётчиками: счётчик можно
        забыть увеличить при новом виде списания, а журнал ведётся на
        каждое движение и разойтись с балансом не может.
        """
        with self._db() as c:
            потрачено = c.execute(
                "SELECT COALESCE(-SUM(delta),0) n FROM ledger"
                " WHERE tg_id=? AND delta<0", (tg_id,)).fetchone()["n"]
            куплено = c.execute(
                "SELECT COALESCE(SUM(delta),0) n FROM ledger"
                " WHERE tg_id=? AND delta>0 AND purse='paid'", (tg_id,)).fetchone()["n"]
            работ = c.execute(
                "SELECT COUNT(*) n FROM jobs WHERE tg_id=? AND state='ok'",
                (tg_id,)).fetchone()["n"]
            осечек = c.execute(
                "SELECT COUNT(*) n FROM jobs WHERE tg_id=? AND state='err'",
                (tg_id,)).fetchone()["n"]
            позвано = c.execute(
                "SELECT COUNT(*) n FROM users WHERE invited_by=?",
                (tg_id,)).fetchone()["n"]
            за_друзей = c.execute(
                "SELECT COALESCE(SUM(delta),0) n FROM ledger"
                " WHERE tg_id=? AND delta>0 AND reason LIKE '%друг%'",
                (tg_id,)).fetchone()["n"]
            записей = c.execute(
                "SELECT COUNT(*) n FROM ledger WHERE tg_id=?", (tg_id,)).fetchone()["n"]
        return {"потрачено": потрачено, "куплено": куплено, "работ": работ,
                "осечек": осечек, "позвано": позвано, "за_друзей": за_друзей,
                "записей": записей}

    def забыть(self, tg_id):
        """Стирает человека и всё, что о нём известно.

        Для сервиса 18+ это не украшение: человек имеет право уйти
        насовсем, и «уйти» не должно означать «строки остались, просто
        мы их не показываем». Возвращает, что именно удалено, — чтобы
        ответ человеку был конкретным, а не «всё удалено, поверьте».

        Файлы работ стираются отдельно, вызывающим (archive), — база о
        диске ничего не знает и знать не должна.
        """
        with self._db() as c:
            итог = {
                "работ": c.execute("SELECT COUNT(*) n FROM jobs WHERE tg_id=?",
                                   (tg_id,)).fetchone()["n"],
                "записей": c.execute("SELECT COUNT(*) n FROM ledger WHERE tg_id=?",
                                     (tg_id,)).fetchone()["n"],
            }
            c.execute("DELETE FROM jobs WHERE tg_id=?", (tg_id,))
            c.execute("DELETE FROM ledger WHERE tg_id=?", (tg_id,))
            c.execute("DELETE FROM invoices WHERE tg_id=?", (tg_id,))
            # След в боте и переписка с поддержкой — тоже «всё, что о
            # нём известно», и в переписке лежит написанное им самим.
            # Таблицы заведены позже этого метода, и не дописать их сюда
            # значило бы оставлять после ухода человека его же письма.
            c.execute("DELETE FROM events WHERE tg_id=?", (tg_id,))
            c.execute("DELETE FROM support WHERE tg_id=?", (tg_id,))
            # Приглашённые остаются в системе, но ссылка на ушедшего
            # обнуляется: иначе в базе висит указатель на несуществующего.
            c.execute("UPDATE users SET invited_by=NULL WHERE invited_by=?", (tg_id,))
            c.execute("DELETE FROM users WHERE tg_id=?", (tg_id,))
        return итог

    # --- коины ---

    def безлимитный(self, tg_id):
        """Этому человеку коины не считаются — см. `__init__`."""
        if not self.безлимит:
            return False
        if str(tg_id) in self.безлимит:
            return True
        u = self.user(tg_id)
        имя = (u or {}).get("username") or ""
        return имя.lower() in self.безлимит

    def balance(self, tg_id):
        """Сколько коинов доступно."""
        if self.безлимитный(tg_id):
            return БЕЗЛИМИТ
        u = self.user(tg_id)
        return sum(u[p] for p in PURSES) if u else 0

    def credit(self, tg_id, amount, purse, reason, meta=None):
        """Начислить. purse: welcome | paid."""
        if amount <= 0:
            raise ValueError("начисление должно быть положительным")
        if purse not in PURSES:
            raise ValueError(f"неизвестный карман: {purse}")
        with self._db() as c:
            c.execute(f"UPDATE users SET {purse}={purse}+? WHERE tg_id=?", (amount, tg_id))
            c.execute(
                "INSERT INTO ledger(tg_id,delta,purse,reason,meta,at) VALUES(?,?,?,?,?,?)",
                (tg_id, amount, purse, reason, json.dumps(meta, ensure_ascii=False) if meta else None,
                 int(time.time())),
            )
        return self.balance(tg_id)

    def spend(self, tg_id, amount, reason, meta=None):
        """Списать в порядке welcome → paid: сначала подаренное."""
        if amount <= 0:
            raise ValueError("списание должно быть положительным")
        # У безлимитного не списываем и в книгу не пишем: запись о
        # списании, которого не было, испортила бы и историю, и отчёт
        # «потрачено» в кабинете.
        if self.безлимитный(tg_id):
            return БЕЗЛИМИТ
        with self._db() as c:
            cols = ",".join(PURSES)
            r = c.execute(f"SELECT {cols} FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            if not r:
                raise NotEnoughCoins(amount, 0)
            have = sum(r[p] for p in PURSES)
            if have < amount:
                raise NotEnoughCoins(amount, have)
            now = int(time.time())
            m = json.dumps(meta, ensure_ascii=False) if meta else None
            left = amount
            for p in PURSES:
                take = min(r[p], left)
                if not take:
                    continue
                c.execute(f"UPDATE users SET {p}={p}-? WHERE tg_id=?", (take, tg_id))
                c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,meta,at) VALUES(?,?,?,?,?,?)",
                          (tg_id, -take, p, reason, m, now))
                left -= take
                if not left:
                    break
        return self.balance(tg_id)

    def refund(self, tg_id, amount, reason):
        """Вернуть за нашу осечку. Возвращаем в купленные — тот карман,
        что не сгорает никогда: за нашу осечку человек не должен
        остаться ни с чем."""
        return self.credit(tg_id, amount, "paid", reason)

    # --- счета крипты ---

    def remember_invoice(self, tg_id, invoice_id, pack_id):
        with self._db() as c:
            c.execute("INSERT OR IGNORE INTO invoices(invoice_id,tg_id,pack_id,at) "
                      "VALUES(?,?,?,?)",
                      (str(invoice_id), tg_id, pack_id, int(time.time())))

    def take_invoice(self, tg_id, invoice_id):
        """Забрать счёт под зачисление РОВНО ОДИН раз.

        Возвращает пакет, если счёт этого человека и ещё не зачислен;
        иначе None. Отметка ставится в той же транзакции, что и
        проверка: человек жмёт «я оплатил» десять раз подряд, а вебхук
        приходит сверх того — без этого он получил бы десять пакетов.
        """
        with self._db() as c:
            r = c.execute("SELECT pack_id FROM invoices WHERE invoice_id=? "
                          "AND tg_id=? AND credited_at IS NULL",
                          (str(invoice_id), tg_id)).fetchone()
            if not r:
                return None
            c.execute("UPDATE invoices SET credited_at=? WHERE invoice_id=?",
                      (int(time.time()), str(invoice_id)))
            return r["pack_id"]

    # --- задания ---

    def job_start(self, job_id, tg_id, kind, prompt, coins, scene=None):
        """`scene` — ключ сценария из каталога, если человек пришёл
        кнопкой, а не своим промптом. Из него считается «Популярное»:
        без него пришлось бы гадать по тексту промпта."""
        with self._db() as c:
            c.execute(
                "INSERT INTO jobs(id,tg_id,kind,scene,prompt,coins,state,at)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (job_id, tg_id, kind, scene, prompt, coins, "run", int(time.time())),
            )

    def популярное(self, сколько=8, дней=30):
        """Какие сценарии заказывают чаще всего.

        Считаем по УДАЧНЫМ заказам: осечка не говорит о том, что
        сценарий нравится — она говорит, что у нас что-то сломалось, и
        поднимать по ней сценарий в топ было бы издевательством.

        Окно в месяц, а не за всё время: иначе первые популярные
        сценарии останутся наверху навсегда и новые в список не
        попадут никогда.
        """
        с_какого = int(time.time()) - дней * 86400
        with self._db() as c:
            rs = c.execute(
                "SELECT scene, COUNT(*) n FROM jobs"
                " WHERE state='ok' AND scene IS NOT NULL AND at >= ?"
                " GROUP BY scene ORDER BY n DESC, scene LIMIT ?",
                (с_какого, сколько)).fetchall()
        return [(r["scene"], r["n"]) for r in rs]

    def job_done(self, job_id, file=None, error=None,
                 path=None, tg_file_id=None, size=None):
        """Итог задания. `path` — где работа лежит у НАС, `tg_file_id` —
        как переслать её даром. Оба необязательны по отдельности, но
        задание без обоих показать потом нечем."""
        with self._db() as c:
            c.execute(
                "UPDATE jobs SET state=?, file=?, path=?, tg_file_id=?, size=?,"
                " error=?, done_at=? WHERE id=?",
                ("ok" if file else "err", file, path, tg_file_id, size,
                 error, int(time.time()), job_id))

    def works(self, tg_id, limit=10):
        """Готовые работы человека — только те, что есть чем показать."""
        with self._db() as c:
            rs = c.execute(
                "SELECT * FROM jobs WHERE tg_id=? AND state='ok'"
                " AND (tg_file_id IS NOT NULL OR path IS NOT NULL)"
                " ORDER BY at DESC LIMIT ?", (tg_id, limit)).fetchall()
            return [dict(r) for r in rs]

    def job(self, job_id):
        with self._db() as c:
            r = c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            return dict(r) if r else None

    def history(self, tg_id, limit=10):
        with self._db() as c:
            rs = c.execute("SELECT * FROM jobs WHERE tg_id=? ORDER BY at DESC LIMIT ?",
                           (tg_id, limit)).fetchall()
            return [dict(r) for r in rs]

    def stats(self):
        with self._db() as c:
            users = c.execute("SELECT COUNT(*) n FROM users").fetchone()["n"]
            paying = c.execute("SELECT COUNT(DISTINCT tg_id) n FROM ledger"
                               " WHERE purse='paid' AND delta>0").fetchone()["n"]
            jobs_ok = c.execute("SELECT COUNT(*) n FROM jobs WHERE state='ok'").fetchone()["n"]
            jobs_err = c.execute("SELECT COUNT(*) n FROM jobs WHERE state='err'").fetchone()["n"]
            spent = c.execute("SELECT COALESCE(-SUM(delta),0) n FROM ledger WHERE delta<0").fetchone()["n"]
            return {"users": users, "paying": paying, "jobs_ok": jobs_ok,
                    "jobs_err": jobs_err, "coins_spent": spent}

    # --- след человека в боте ---
    #
    # Заведено 23.09.2026 под админ-панель: владелец захотел видеть «все
    # клики, посещения, генерации». Баланс и работы база держала и
    # раньше, а вот ЧТО человек нажимал по дороге, не оставалось нигде —
    # и было невозможно сказать, на какой кнопке люди уходят.
    #
    # Пишется одной строкой на событие и НИКОГДА не роняет бота: след
    # это наблюдение, а не работа, за которую заплачено. Упало — молча
    # пропускаем.

    def событие(self, tg_id, вид, ключ=None):
        try:
            with self._db() as c:
                c.execute("INSERT INTO events(tg_id,вид,ключ,at)"
                          " VALUES(?,?,?,?)",
                          (tg_id, вид, ключ, int(time.time())))
        except sqlite3.Error as e:
            print("след не записался:", str(e)[:120], flush=True)

    def события_по_дням(self, дней=14, вид=None):
        """[(дата, сколько)] по дням, старые первыми — под график."""
        с = int(time.time()) - дней * 86400
        усл = " AND вид=?" if вид else ""
        д = [с] + ([вид] if вид else [])
        with self._db() as c:
            rs = c.execute(
                "SELECT date(at,'unixepoch') д, COUNT(*) n FROM events"
                " WHERE at>=?" + усл + " GROUP BY д ORDER BY д", д).fetchall()
            return [(r["д"], r["n"]) for r in rs]

    def топ_кнопок(self, дней=30, сколько=12):
        с = int(time.time()) - дней * 86400
        with self._db() as c:
            rs = c.execute(
                "SELECT ключ, COUNT(*) n FROM events"
                " WHERE вид='кнопка' AND ключ IS NOT NULL AND at>=?"
                " GROUP BY ключ ORDER BY n DESC LIMIT ?",
                (с, сколько)).fetchall()
            return [(r["ключ"], r["n"]) for r in rs]

    # --- поддержка ---

    def поддержка_записать(self, tg_id, откого, текст):
        with self._db() as c:
            c.execute("INSERT INTO support(tg_id,откого,текст,at)"
                      " VALUES(?,?,?,?)",
                      (tg_id, откого, текст[:4000], int(time.time())))

    def поддержка_диалоги(self, limit=50):
        """Последнее сообщение каждого собеседника, свежие первыми."""
        with self._db() as c:
            rs = c.execute(
                "SELECT s.tg_id, u.username, MAX(s.at) at,"
                "  SUM(CASE WHEN s.прочитано=0 AND s.откого='человек'"
                "      THEN 1 ELSE 0 END) новых,"
                "  COUNT(*) всего"
                " FROM support s LEFT JOIN users u ON u.tg_id=s.tg_id"
                " GROUP BY s.tg_id ORDER BY at DESC LIMIT ?",
                (limit,)).fetchall()
            return [dict(r) for r in rs]

    def поддержка_диалог(self, tg_id, limit=100):
        with self._db() as c:
            rs = c.execute("SELECT * FROM support WHERE tg_id=?"
                           " ORDER BY at DESC LIMIT ?",
                           (tg_id, limit)).fetchall()
            c.execute("UPDATE support SET прочитано=1 WHERE tg_id=?", (tg_id,))
            return [dict(r) for r in reversed(rs)]

    def поддержка_непрочитано(self):
        with self._db() as c:
            return c.execute("SELECT COUNT(*) n FROM support"
                             " WHERE прочитано=0 AND откого='человек'"
                             ).fetchone()["n"]

    # --- рассылки ---

    def рассылка_завести(self, текст, кому):
        with self._db() as c:
            cur = c.execute("INSERT INTO mailings(текст,кому,at)"
                            " VALUES(?,?,?)",
                            (текст, кому, int(time.time())))
            return cur.lastrowid

    def рассылка_кому(self, кому):
        """Кому уйдёт: «всем», «платившим», «без оплат»."""
        where = {"всем": "", "платившим": " AND paid_ever=1",
                 "без оплат": " AND paid_ever=0"}.get(кому, "")
        with self._db() as c:
            rs = c.execute(
                "SELECT tg_id FROM ("
                "  SELECT u.tg_id tg_id,"
                "    (SELECT COUNT(*) FROM ledger l WHERE l.tg_id=u.tg_id"
                "       AND l.purse='paid' AND l.delta>0) > 0 paid_ever"
                "  FROM users u WHERE u.blocked=0"
                ") WHERE 1=1" + where).fetchall()
            return [r["tg_id"] for r in rs]

    def рассылка_итог(self, ид, всего=None, дошло=None, отказ=None,
                      состояние=None):
        поля, д = [], []
        for имя, зн in (("всего", всего), ("дошло", дошло), ("отказ", отказ),
                        ("состояние", состояние)):
            if зн is not None:
                поля.append(f"{имя}=?")
                д.append(зн)
        if состояние in ("готова", "оборвана"):
            поля.append("done_at=?")
            д.append(int(time.time()))
        if not поля:
            return
        with self._db() as c:
            c.execute("UPDATE mailings SET " + ",".join(поля) + " WHERE id=?",
                      д + [ид])

    def рассылки(self, limit=20):
        with self._db() as c:
            rs = c.execute("SELECT * FROM mailings ORDER BY at DESC LIMIT ?",
                           (limit,)).fetchall()
            return [dict(r) for r in rs]

    # --- люди для панели ---

    def люди(self, поиск="", limit=200, offset=0):
        """Список с балансом, тратами и числом работ — под таблицу."""
        усл, д = "", []
        if поиск:
            усл = (" WHERE CAST(u.tg_id AS TEXT) LIKE ?"
                   " OR IFNULL(u.username,'') LIKE ?")
            д = [f"%{поиск}%", f"%{поиск}%"]
        with self._db() as c:
            rs = c.execute(
                "SELECT u.tg_id, u.username, u.created_at, u.blocked, u.lang,"
                "  u.invited_by,"
                "  (SELECT COALESCE(SUM(delta),0) FROM ledger l"
                "     WHERE l.tg_id=u.tg_id) баланс,"
                "  (SELECT COALESCE(SUM(delta),0) FROM ledger l"
                "     WHERE l.tg_id=u.tg_id AND l.purse='paid' AND l.delta>0)"
                "   куплено,"
                "  (SELECT COUNT(*) FROM jobs j WHERE j.tg_id=u.tg_id"
                "     AND j.state='ok') работ"
                " FROM users u" + усл +
                " ORDER BY u.created_at DESC LIMIT ? OFFSET ?",
                д + [limit, offset]).fetchall()
            return [dict(r) for r in rs]

    def заблокировать(self, tg_id, да=True):
        with self._db() as c:
            c.execute("UPDATE users SET blocked=? WHERE tg_id=?",
                      (1 if да else 0, tg_id))

    def сводка_панели(self, дней=30):
        """Числа для плиток и графиков. Один заход в базу на всё."""
        с = int(time.time()) - дней * 86400
        сутки = int(time.time()) - 86400
        with self._db() as c:
            один = lambda q, *d: c.execute(q, d).fetchone()[0]     # noqa: E731
            деньги = c.execute(
                "SELECT date(at,'unixepoch') д, COALESCE(SUM(delta),0) n"
                " FROM ledger WHERE purse='paid' AND delta>0 AND at>=?"
                " GROUP BY д ORDER BY д", (с,)).fetchall()
            работы = c.execute(
                "SELECT date(at,'unixepoch') д, COUNT(*) n FROM jobs"
                " WHERE at>=? GROUP BY д ORDER BY д", (с,)).fetchall()
            новые = c.execute(
                "SELECT date(created_at,'unixepoch') д, COUNT(*) n FROM users"
                " WHERE created_at>=? GROUP BY д ORDER BY д", (с,)).fetchall()
            return {
                "людей": один("SELECT COUNT(*) FROM users"),
                "людей_сутки": один(
                    "SELECT COUNT(*) FROM users WHERE created_at>=?", сутки),
                "платящих": один(
                    "SELECT COUNT(DISTINCT tg_id) FROM ledger"
                    " WHERE purse='paid' AND delta>0"),
                "куплено": один(
                    "SELECT COALESCE(SUM(delta),0) FROM ledger"
                    " WHERE purse='paid' AND delta>0"),
                "потрачено": один(
                    "SELECT COALESCE(-SUM(delta),0) FROM ledger WHERE delta<0"),
                "работ": один("SELECT COUNT(*) FROM jobs WHERE state='ok'"),
                "работ_сутки": один(
                    "SELECT COUNT(*) FROM jobs WHERE state='ok' AND at>=?",
                    сутки),
                "брака": один("SELECT COUNT(*) FROM jobs WHERE state='err'"),
                "заблокированных": один(
                    "SELECT COUNT(*) FROM users WHERE blocked=1"),
                "поддержка_новых": self.поддержка_непрочитано(),
                "деньги_по_дням": [(r["д"], r["n"]) for r in деньги],
                "работы_по_дням": [(r["д"], r["n"]) for r in работы],
                "новые_по_дням": [(r["д"], r["n"]) for r in новые],
            }

    # --- списки для панели ---

    def оплаты(self, limit=300):
        with self._db() as c:
            rs = c.execute(
                "SELECT l.at, l.tg_id, l.delta, l.reason, u.username"
                " FROM ledger l LEFT JOIN users u ON u.tg_id=l.tg_id"
                " WHERE l.purse='paid' AND l.delta>0"
                " ORDER BY l.at DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rs]

    def работы_все(self, limit=300):
        with self._db() as c:
            rs = c.execute(
                "SELECT j.id, j.at, j.tg_id, j.kind, j.scene, j.coins,"
                "  j.state, j.error, u.username"
                " FROM jobs j LEFT JOIN users u ON u.tg_id=j.tg_id"
                " ORDER BY j.at DESC LIMIT ?", (limit,)).fetchall()
            return [dict(r) for r in rs]

    # --- франшиза ---
    #
    # Человек покупает свой бот на нашем движке и делится выручкой.
    # Здесь только УЧЁТ: кто купил, какой у него бот, сколько он собрал
    # и сколько ему уже отдали.
    #
    # ДЕНЕГ ЭТОТ КОД НЕ ДВИГАЕТ И ДВИГАТЬ НЕ БУДЕТ. Выплату партнёру
    # делает владелец руками; панель только считает, сколько причитается,
    # и показывает список. Перевод необратим, а ошибка в доле или в
    # адресе не откатывается ничем.

    def партнёр_завести(self, tg_id, username, оплачено, валюта):
        with self._db() as c:
            c.execute(
                "INSERT INTO partners(tg_id,username,оплачено,валюта,at)"
                " VALUES(?,?,?,?,?)"
                " ON CONFLICT(tg_id) DO UPDATE SET"
                "   оплачено=оплачено+excluded.оплачено,"
                "   username=excluded.username",
                (tg_id, username, оплачено, валюта, int(time.time())))
            return dict(c.execute("SELECT * FROM partners WHERE tg_id=?",
                                  (tg_id,)).fetchone())

    def партнёр(self, tg_id):
        with self._db() as c:
            r = c.execute("SELECT * FROM partners WHERE tg_id=?",
                          (tg_id,)).fetchone()
            return dict(r) if r else None

    def партнёр_токен(self, tg_id, токен, бот):
        with self._db() as c:
            c.execute("UPDATE partners SET токен=?, бот=?,"
                      " состояние='в работе' WHERE tg_id=?",
                      (токен, бот, tg_id))

    def партнёр_состояние(self, tg_id, состояние):
        with self._db() as c:
            если_запущен = ", запущен_at=?" if состояние == "запущен" else ""
            д = [состояние] + ([int(time.time())] if если_запущен else []) \
                + [tg_id]
            c.execute(f"UPDATE partners SET состояние=?{если_запущен}"
                      " WHERE tg_id=?", д)

    def партнёр_учёт(self, tg_id, выручка=None, выплачено=None, доля=None):
        поля, д = [], []
        for имя, зн in (("выручка", выручка), ("выплачено", выплачено),
                        ("доля", доля)):
            if зн is not None:
                поля.append(f"{имя}=?")
                д.append(int(зн))
        if not поля:
            return
        with self._db() as c:
            c.execute("UPDATE partners SET " + ",".join(поля) + " WHERE tg_id=?",
                      д + [tg_id])

    def партнёры(self):
        with self._db() as c:
            rs = c.execute("SELECT * FROM partners ORDER BY at DESC").fetchall()
            итог = []
            for r in rs:
                п = dict(r)
                # Токен наружу не отдаём: это ключ от чужого бота.
                # Панель показывает хвост, полный забирает отдельным
                # запросом, и только когда владелец его попросит.
                т = п.pop("токен", "") or ""
                п["токен_хвост"] = ("…" + т[-6:]) if т else ""
                п["есть_токен"] = bool(т)
                п["к_выплате"] = max(
                    0, п["выручка"] * п["доля"] // 100 - п["выплачено"])
                итог.append(п)
            return итог
