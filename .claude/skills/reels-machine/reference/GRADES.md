# Грейды под ниши (ffmpeg vf, ключи в build_reel.py GRADES)

Выбирать грейд под тон ниши из манифеста. Один грейд на ролик (кроме демо цветокора).

| ключ | ниша/тон | vf |
|---|---|---|
| `warm_cine` | универсальный тёплый, лайфстайл, кофе | eq contrast1.06 sat1.12 bright.01, colorbalance rs.03 bs-.02, vignette PI/5, noise 4 |
| `teal_orange` | авто, экшн, техно, промо | curves r/b split, sat1.3 contrast1.1, vignette PI/4.6 |
| `clean_ad` | продакшн, услуги, B2B, чистая реклама | contrast1.05 sat1.1 bright.008, colorbalance rs.02 bs.015, vignette PI/4.8, noise 3 |
| `flower_soft` | цветы, бьюти, нежность, пастель | contrast1.045 sat1.16 bright.012, colorbalance rs.03 bs-.02 rm.015, vignette PI/5, noise 4 |
| `noir_bw` | ч/б-панч, драма, «до», глитч-момент | hue s=0, contrast1.35 bright-.03, noise 12, vignette PI/4.2 |

Доп. стили для демо/разнообразия (собирать вручную):
- VHS/глитч: `chromashift=crh=-14:cbh=14,noise=alls=22:allf=t,eq=saturation=0.85:contrast=1.05`
- Плёнка: `curves=...,noise` + лёгкий halation (gblur+blend screen на светах)

Правило завода: если прошлый ролик был `flower_soft`, следующий в той же нише — сдвинуть
(теплее/холоднее/контрастнее), чтобы картинка не выглядела одинаковой.
