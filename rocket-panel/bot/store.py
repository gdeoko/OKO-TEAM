"""Хранилище бота: пользователи, жетоны, история. SQLite, без внешних служб.

Три кармана жетонов:
    sub      — выданы подпиской, СГОРАЮТ в конце оплаченного месяца
    welcome  — подарены на старте и за приглашения, могут быть ограничены
    paid     — куплены, НЕ СГОРАЮТ НИКОГДА

Тратим в порядке sub → welcome → paid, то есть сначала то, что скорее
всего пропадёт. Так человек не теряет деньги из-за порядка списания:
купленное уходит последним и ждёт его сколько угодно.
"""

import sqlite3, time, secrets, json
from contextlib import contextmanager

# Порядок списания: что сгорит раньше, то и тратим первым.
PURSES = ("sub", "welcome", "paid")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  tg_id        INTEGER PRIMARY KEY,
  username     TEXT,
  welcome      INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
  sub          INTEGER NOT NULL DEFAULT 0,
  sub_id       TEXT,
  sub_until    INTEGER,
  ref_code     TEXT UNIQUE,
  invited_by   INTEGER,
  created_at   INTEGER NOT NULL,
  blocked      INTEGER NOT NULL DEFAULT 0
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
  prompt    TEXT,
  tokens    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  file      TEXT,
  error     TEXT,
  at        INTEGER NOT NULL,
  done_at   INTEGER
);
CREATE INDEX IF NOT EXISTS ix_ledger_user ON ledger(tg_id, at);
CREATE INDEX IF NOT EXISTS ix_jobs_user   ON jobs(tg_id, at);
"""


class NotEnoughTokens(Exception):
    def __init__(self, need, have):
        super().__init__(f"Нужно {need} жетонов, на балансе {have}")
        self.need, self.have = need, have


class Store:
    def __init__(self, path="rocket_bot.db"):
        self.path = path
        with self._db() as c:
            c.executescript(SCHEMA)
            self._migrate(c)

    @staticmethod
    def _migrate(c):
        """Достраивает столбцы, которых не было в прежних версиях базы.

        Боевая база уже живёт с людьми и их купленными жетонами, поэтому
        схему меняем только добавлением — ничего не пересоздаём.
        """
        have = {r["name"] for r in c.execute("PRAGMA table_info(users)")}
        for name, decl in (("sub", "INTEGER NOT NULL DEFAULT 0"),
                           ("sub_id", "TEXT"),
                           ("sub_until", "INTEGER")):
            if name not in have:
                c.execute(f"ALTER TABLE users ADD COLUMN {name} {decl}")

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

    def ensure_user(self, tg_id, username=None, welcome=0, invited_by=None):
        """Заводит пользователя, если его нет. Возвращает (пользователь, новый?)."""
        u = self.user(tg_id)
        if u:
            if username and u["username"] != username:
                with self._db() as c:
                    c.execute("UPDATE users SET username=? WHERE tg_id=?", (username, tg_id))
                u["username"] = username
            return u, False
        code = secrets.token_urlsafe(6)
        with self._db() as c:
            c.execute(
                "INSERT INTO users(tg_id,username,welcome,ref_code,invited_by,created_at)"
                " VALUES(?,?,?,?,?,?)",
                (tg_id, username, welcome, code, invited_by, int(time.time())),
            )
            if welcome:
                c.execute(
                    "INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                    (tg_id, welcome, "welcome", "подарок при старте", int(time.time())),
                )
        return self.user(tg_id), True

    def by_ref_code(self, code):
        with self._db() as c:
            r = c.execute("SELECT * FROM users WHERE ref_code=?", (code,)).fetchone()
            return dict(r) if r else None

    # --- жетоны ---

    def balance(self, tg_id):
        """Сколько жетонов доступно. Просроченную подписку сначала гасим,
        иначе человек увидит на балансе то, чем уже не может заплатить."""
        self.expire_sub(tg_id)
        u = self.user(tg_id)
        return sum(u[p] for p in PURSES) if u else 0

    def credit(self, tg_id, amount, purse, reason, meta=None):
        """Начислить. purse: sub | welcome | paid."""
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
        """Списать в порядке sub → welcome → paid: что раньше сгорит, то
        раньше и тратим."""
        if amount <= 0:
            raise ValueError("списание должно быть положительным")
        self.expire_sub(tg_id)
        with self._db() as c:
            cols = ",".join(PURSES)
            r = c.execute(f"SELECT {cols} FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            if not r:
                raise NotEnoughTokens(amount, 0)
            have = sum(r[p] for p in PURSES)
            if have < amount:
                raise NotEnoughTokens(amount, have)
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
        """Вернуть за нашу осечку. Возвращаем в купленные: человек не должен
        терять деньги из-за того, что у нас упала генерация.

        Нарочно не в карман подписки, даже если списано было оттуда:
        подписочные сгорят в конце месяца, и возврат пропал бы вместе с
        ними. За нашу осечку человек не должен остаться ни с чем."""
        return self.credit(tg_id, amount, "paid", reason)

    # --- подписка ---

    def subscribe(self, tg_id, sub_id, tokens, days=30, reason=None):
        """Оформить или продлить подписку.

        Остаток прошлого месяца НЕ переносится: подписка — это месячная
        норма, а не накопительный счёт. Иначе человек копит три месяца,
        отписывается и ещё полгода пользуется.
        """
        if tokens <= 0:
            raise ValueError("подписка должна давать жетоны")
        now = int(time.time())
        until = now + days * 86400
        with self._db() as c:
            r = c.execute("SELECT sub FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            if not r:
                raise KeyError(f"нет такого пользователя: {tg_id}")
            if r["sub"]:
                c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                          (tg_id, -r["sub"], "sub", "остаток прошлого месяца сгорел", now))
            c.execute("UPDATE users SET sub=?, sub_id=?, sub_until=? WHERE tg_id=?",
                      (tokens, sub_id, until, tg_id))
            c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                      (tg_id, tokens, "sub", reason or f"подписка {sub_id}", now))
        return self.balance(tg_id)

    def expire_sub(self, tg_id, now=None):
        """Погасить жетоны подписки, если месяц кончился. Возвращает,
        сколько сгорело."""
        now = int(time.time()) if now is None else now
        with self._db() as c:
            r = c.execute("SELECT sub,sub_until FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            if not r or not r["sub_until"] or r["sub_until"] > now:
                return 0
            burned = r["sub"]
            c.execute("UPDATE users SET sub=0, sub_id=NULL, sub_until=NULL WHERE tg_id=?", (tg_id,))
            if burned:
                c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,at) VALUES(?,?,?,?,?)",
                          (tg_id, -burned, "sub", "подписка кончилась, жетоны сгорели", now))
            return burned

    def sub_active(self, tg_id, now=None):
        """Действует ли подписка прямо сейчас. Возвращает её id или None."""
        now = int(time.time()) if now is None else now
        u = self.user(tg_id)
        if u and u["sub_until"] and u["sub_until"] > now:
            return u["sub_id"]
        return None

    # --- задания ---

    def job_start(self, job_id, tg_id, kind, prompt, tokens):
        with self._db() as c:
            c.execute(
                "INSERT INTO jobs(id,tg_id,kind,prompt,tokens,state,at) VALUES(?,?,?,?,?,?,?)",
                (job_id, tg_id, kind, prompt, tokens, "run", int(time.time())),
            )

    def job_done(self, job_id, file=None, error=None):
        with self._db() as c:
            c.execute("UPDATE jobs SET state=?, file=?, error=?, done_at=? WHERE id=?",
                      ("ok" if file else "err", file, error, int(time.time()), job_id))

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
                    "jobs_err": jobs_err, "tokens_spent": spent}
