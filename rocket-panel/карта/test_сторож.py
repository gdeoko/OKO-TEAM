"""Сторож баланса Vast: пороги и расход, без сети."""
import json, os, sys, tempfile, unittest
from unittest import mock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import сторож_vast as с


class Сторож(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        с.СЕЙЧАС_ФАЙЛ = os.path.join(self.tmp.name, "v.json")
        с.ИСТОРИЯ = os.path.join(self.tmp.name, "h.json")
        self.ушло = []
        self.env = mock.patch.object(с, "env", lambda п: {"VAST_API_KEY": "k"})
        self.изв = mock.patch.object(с, "известить", lambda т, к: self.ушло.append(т))
        self.env.start(); self.изв.start()

    def tearDown(self):
        mock.patch.stopall(); self.tmp.cleanup()

    def обход(self, остаток, в_час=1.19):
        with mock.patch.object(с, "снять", lambda к: (остаток, [
                {"id": 1, "карта": "x", "метка": "a", "состояние": "running", "в_час": в_час}])):
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
        with mock.patch.object(с, "снять", lambda к: (50.0, [])):
            с.главное()
        self.assertIsNone(json.load(open(с.СЕЙЧАС_ФАЙЛ))["часов"])


if __name__ == "__main__":
    unittest.main()
