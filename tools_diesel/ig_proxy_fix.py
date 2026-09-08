# -*- coding: utf-8 -*-
"""Свежие адреса мобильного прокси Instagram из кабинета в secrets.env.

В секретах лежали fproxy.site:13047 и changeip.mpsapi.com - оба молчат.
Кабинет отдаёт настоящие: свой хост, свои порты http и socks5, свой адрес смены IP.
Значения только на сервере, в git они не уходят никогда.
"""
import json, os, re, shutil, time, urllib.request

ПУТЬ = "/opt/oko-poster/cfg/secrets.env"
токен = os.environ["IG_PROXY_API_TOKEN"]

з = urllib.request.Request("https://mobileproxy.space/api.html?command=get_my_proxy",
                           headers={"Authorization": "Bearer " + токен})
п = json.load(urllib.request.urlopen(з, timeout=40))[0]

хост, логин, пароль = п["proxy_hostname"], п["proxy_login"], п["proxy_pass"]
новые = {
    "IG_PROXY_HTTP":     "http://%s:%s@%s:%s" % (логин, пароль, хост, п["proxy_http_port"]),
    "IG_PROXY_SOCKS5":   "socks5://%s:%s@%s:%s" % (логин, пароль, хост, п["proxy_socks5_port"]),
    "IG_PROXY_STD":      "http://%s:%s@%s:%s" % (логин, пароль, хост, п["proxy_http_port"]),
    "IG_PROXY_LOGIN":    логин,
    "IG_PROXY_PASS":     пароль,
    "IG_PROXY_ID":       str(п["proxy_id"]),
    "IG_PROXY_CHANGEIP": п["proxy_change_ip_url"],
}

shutil.copy2(ПУТЬ, ПУТЬ + ".bak." + time.strftime("%Y%m%d%H%M%S"))
строки = open(ПУТЬ, encoding="utf-8").read().split("\n")
поставили = set()
for i, с in enumerate(строки):
    м = re.match(r"^(export\s+)?([A-Z0-9_]+)=", с)
    if м and м.group(2) in новые:
        имя = м.group(2)
        строки[i] = (м.group(1) or "") + имя + "=" + новые[имя]
        поставили.add(имя)
for имя, зн in новые.items():
    if имя not in поставили:
        строки.append(имя + "=" + зн)
open(ПУТЬ, "w", encoding="utf-8").write("\n".join(строки))
print("обновлено ключей:", len(новые), "| аренда до:", п["proxy_exp"], "| оператор:", п["proxy_operator"], "| гео:", п["proxy_geo"])
print("хост:", хост, "http", п["proxy_http_port"], "socks5", п["proxy_socks5_port"])
