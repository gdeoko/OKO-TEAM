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
  coins    INTEGER NOT NULL,
  state     TEXT NOT NULL,
  file      TEXT,
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
CREATE INDEX IF NOT EXISTS ix_ledger_user ON ledger(tg_id, at);
CREATE INDEX IF NOT EXISTS ix_jobs_user   ON jobs(tg_id, at);
"""


class NotEnoughCoins(Exception):
    def __init__(self, need, have):
        super().__init__(f"Нужно {need} коинов, на балансе {have}")
        self.need, self.have = need, have


class Store:
    def __init__(self, path="rocket_bot.db"):
        self.path = path
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
        have = {r["name"] for r in c.execute("PRAGMA table_info(users)")}
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

    # --- коины ---

    def balance(self, tg_id):
        """Сколько коинов доступно."""
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

    def job_start(self, job_id, tg_id, kind, prompt, coins):
        with self._db() as c:
            c.execute(
                "INSERT INTO jobs(id,tg_id,kind,prompt,coins,state,at) VALUES(?,?,?,?,?,?,?)",
                (job_id, tg_id, kind, prompt, coins, "run", int(time.time())),
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
                    "jobs_err": jobs_err, "coins_spent": spent}
