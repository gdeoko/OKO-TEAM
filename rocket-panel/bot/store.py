"""Хранилище бота: пользователи, жетоны, история. SQLite, без внешних служб.

Два кармана жетонов, как и в сервисе звонков:
    welcome  — подарены на старте и за приглашения, могут быть ограничены
    paid     — куплены, НЕ СГОРАЮТ НИКОГДА

Тратим сначала welcome: подаренное и так условно, купленное человек
должен потратить последним.
"""

import sqlite3, time, secrets, json
from contextlib import contextmanager

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  tg_id        INTEGER PRIMARY KEY,
  username     TEXT,
  welcome      INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
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
        u = self.user(tg_id)
        return (u["welcome"] + u["paid"]) if u else 0

    def credit(self, tg_id, amount, purse, reason, meta=None):
        """Начислить. purse: welcome | paid."""
        if amount <= 0:
            raise ValueError("начисление должно быть положительным")
        if purse not in ("welcome", "paid"):
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
        """Списать. Сначала подаренные, потом купленные."""
        if amount <= 0:
            raise ValueError("списание должно быть положительным")
        with self._db() as c:
            r = c.execute("SELECT welcome,paid FROM users WHERE tg_id=?", (tg_id,)).fetchone()
            if not r:
                raise NotEnoughTokens(amount, 0)
            have = r["welcome"] + r["paid"]
            if have < amount:
                raise NotEnoughTokens(amount, have)
            from_welcome = min(r["welcome"], amount)
            from_paid = amount - from_welcome
            now = int(time.time())
            m = json.dumps(meta, ensure_ascii=False) if meta else None
            if from_welcome:
                c.execute("UPDATE users SET welcome=welcome-? WHERE tg_id=?", (from_welcome, tg_id))
                c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,meta,at) VALUES(?,?,?,?,?,?)",
                          (tg_id, -from_welcome, "welcome", reason, m, now))
            if from_paid:
                c.execute("UPDATE users SET paid=paid-? WHERE tg_id=?", (from_paid, tg_id))
                c.execute("INSERT INTO ledger(tg_id,delta,purse,reason,meta,at) VALUES(?,?,?,?,?,?)",
                          (tg_id, -from_paid, "paid", reason, m, now))
        return self.balance(tg_id)

    def refund(self, tg_id, amount, reason):
        """Вернуть за нашу осечку. Возвращаем в купленные: человек не должен
        терять деньги из-за того, что у нас упала генерация."""
        return self.credit(tg_id, amount, "paid", reason)

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
