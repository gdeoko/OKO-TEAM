"""Сторож баланса Vast: пороги и расход, без сети."""
import json, os, sys, tempfile, time, unittest
from unittest import mock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import сторож_vast as с


class Сторож(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        с.СЕЙЧАС_ФАЙЛ = os.path.join(self.tmp.name, "v.json")
        с.ИСТОРИЯ = os.path.join(self.tmp.name, "h.json")
        self.ушло = []
        self.часы = time.time()
        self.env = mock.patch.object(с, "env", lambda п: {"VAST_API_KEY": "k"})
        self.изв = mock.patch.object(с, "известить", lambda т, к: self.ушло.append(т))
        self.env.start(); self.изв.start()

    def tearDown(self):
        mock.patch.stopall(); self.tmp.cleanup()

    def обход(self, остаток, в_час=1.19, авто=None, сдвиг=0):
        """Один прогон сторожа. `авто` - настройка автопополнения со
        стороны Vast, `сдвиг` - на сколько секунд «постарело» время (так
        проверяется терпение, не засыпая на сорок минут)."""
        авто = авто or {"включено": False, "порог": 0.0, "сумма": 0.0}
        машины = [{"id": 1, "карта": "x", "метка": "a",
                   "состояние": "running", "в_час": в_час}]
        with mock.patch.object(с, "снять", lambda к: (остаток, машины, авто)), \
             mock.patch.object(с.time, "time", lambda: self.часы + сдвиг):
            с.главное()
        return json.load(open(с.СЕЙЧАС_ФАЙЛ))

    def test_самый_срочный_порог_и_один_раз(self):
        self.обход(14.0)                          # ~11,8 ч
        self.assertEqual(len(self.ушло), 1)
        self.assertIn("12 ч", self.ушло[0])
        self.обход(13.0)                          # всё ещё < суток - молчим
        self.assertEqual(len(self.ушло), 1)
        self.обход(5.0)                           # < 6 ч - новое
        self.assertEqual(len(self.ушло), 2)

    def test_пополнение_сбрасывает_пороги(self):
        self.обход(14.0)
        self.обход(900.0)                         # пополнили
        self.assertEqual(self.обход(900.0)["сказано"], [])
        self.обход(14.0)
        self.assertEqual(len(self.ушло), 2)

    def test_расход_не_считает_пополнение(self):
        ист = [{"t": 1000, "credit": 20.0}, {"t": 2000, "credit": 15.0},
               {"t": 3000, "credit": 915.0}, {"t": 4000, "credit": 910.0}]
        сутки, _ = с.расход_по_истории(ист, 5000)
        self.assertEqual(сутки, 10.0)

    def test_без_машин_не_делим_на_ноль(self):
        with mock.patch.object(с, "снять", lambda к: (50.0, [], АВТО_НЕТ)):
            с.главное()
        self.assertIsNone(json.load(open(с.СЕЙЧАС_ФАЙЛ))["часов"])


class Автопополнение(unittest.TestCase):
    """При автопополнении остаток мал ВСЕГДА - это норма, а не тревога."""

    setUp, tearDown, обход = Сторож.setUp, Сторож.tearDown, Сторож.обход

    def test_маленький_остаток_молчит(self):
        # $12 - это десять часов: без автопополнения ушли бы два письма.
        self.обход(12.0, авто=АВТО)
        self.обход(6.0, авто=АВТО)
        self.assertEqual(self.ушло, [])

    def test_зовём_когда_списание_не_пришло(self):
        д = self.обход(3.0, авто=АВТО)            # ушли под порог $5
        self.assertEqual(self.ушло, [])           # ждём терпеливо
        self.assertFalse(д["автосбой"])
        д = self.обход(2.4, авто=АВТО, сдвиг=с.ТЕРПЕНИЕ + 60)
        self.assertEqual(len(self.ушло), 1)
        self.assertIn("автопополнение не прошло", self.ушло[0].lower())
        self.assertTrue(д["автосбой"])
        # Второй раз про то же не пишем.
        self.обход(2.0, авто=АВТО, сдвиг=с.ТЕРПЕНИЕ + 900)
        self.assertEqual(len(self.ушло), 1)

    def test_списание_пришло_тревога_снята(self):
        self.обход(3.0, авто=АВТО)
        self.обход(2.4, авто=АВТО, сдвиг=с.ТЕРПЕНИЕ + 60)
        д = self.обход(12.4, авто=АВТО, сдвиг=с.ТЕРПЕНИЕ + 120)   # пришли $10
        self.assertFalse(д["автосбой"])
        self.assertEqual(д["ниже_с"], 0)
        # Провалились снова - зовём снова.
        self.обход(3.0, авто=АВТО, сдвиг=с.ТЕРПЕНИЕ + 180)
        self.обход(2.0, авто=АВТО, сдвиг=2 * с.ТЕРПЕНИЕ + 300)
        self.assertEqual(len(self.ушло), 2)

    def test_настройка_видна_админке(self):
        д = self.обход(12.0, авто=АВТО)
        self.assertEqual(д["автопополнение"]["сумма"], 10.0)
        self.assertEqual(д["автопополнение"]["порог"], 5.0)


АВТО = {"включено": True, "порог": 5.0, "сумма": 10.0}
АВТО_НЕТ = {"включено": False, "порог": 0.0, "сумма": 0.0}


if __name__ == "__main__":
    unittest.main()
