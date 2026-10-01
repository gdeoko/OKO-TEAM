# Генерация наград/афиш КЦ МУЗМИР через APIMODELS. run.py <промпт.txt> <выход.png> <соотношение> [лого]
import sys, json, time
sys.path.insert(0, "/opt/oko-agents")
from core import apimodels as A
pr, out, ar = sys.argv[1], sys.argv[2], sys.argv[3]
ref = sys.argv[4] if len(sys.argv) > 4 else ""
t = time.time()
r = A.картинка(open(pr, encoding="utf-8").read(), out, вид="обложка", размер=ar, образцы=ref, эталон=True)
r["sekund"] = round(time.time() - t)
print(json.dumps(r, ensure_ascii=False))
