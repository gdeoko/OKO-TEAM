# Разбор снимков калибровки: настоящие границы букв против предсказанных. cal.py <префикс>
import json, sys
from PIL import Image
pr = json.load(open(sys.argv[1] + '.json'))
out = {}
for sel, d in pr.items():
    im = Image.open(d['png']).convert('RGBA'); a = im.getchannel('A'); W, H = im.size
    k = H / d['clip']['height']                      # пикселей снимка на CSS-пиксель
    rows = [y for y in range(H) if max(a.crop((0, y, W, y + 1)).getdata()) > 60]
    if not rows: continue
    top = d['clip']['y'] + rows[0] / k; bot = d['clip']['y'] + (rows[-1] + 1) / k
    u = d['fs'] * d['sc']
    out[sel] = [round((top - d['top']) / u, 4), round((bot - d['bottom']) / u, 4)]
print(json.dumps(out))
