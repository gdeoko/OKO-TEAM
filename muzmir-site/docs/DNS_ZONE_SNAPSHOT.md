# DNS-зона музыкальный-мир.рф — слепок перед переносом на Яндекс

Снято 10.08.2026 с `ns1.registrant.ru` (SOA serial 2026081025), до смены NS.
Домен в punycode: `xn----7sbugdeiegh1b0a9hen.xn--p1ai`, ID в Nethouse — 1063696.

## Зачем этот файл

Зону переносим, потому что панель Nethouse сохраняет записи, но не публикует
их в реальную зону: CNAME для `send.` висел в панели больше часа и так и не
появился на авторитативных серверах, A-запись повторила его судьбу. Пока DNS
не у нас в руках, Unisender не отправит ни одного письма — ему нужен домен
ссылок, а завести его нечем.

Здесь записано ровно то, что было ДО переноса. Если Яндекс не поднимет зону
или что-то пойдёт не так — вернуть NS на `ns1/ns2/ns3.registrant.ru`, и всё
станет как было.

## Записи (10 штук)

| Имя | Тип | Значение | TTL | Прио |
|---|---|---|---|---|
| @ | A | 176.124.200.169 | 3600 | |
| www | A | 176.124.200.169 | 3600 | |
| @ | MX | mx.yandex.net | 21600 | 10 |
| @ | TXT | `v=spf1 include:_spf.yandex.net include:spf.unisender.ru ~all` | 3600 | |
| @ | TXT | `yandex-verification: 7a3230fd61ba4cd8` | 3600 | |
| @ | TXT | `unisender-go-validate-hash=00e699c55ba84cd2355dadd2cb37b5ec` | 3600 | |
| _dmarc | TXT | `v=DMARC1; p=none; rua=mailto:okoteam.top@gmail.com; adkim=r; aspf=r; pct=100` | 3600 | |
| mail._domainkey | TXT | DKIM Яндекс-почты, ключ ниже | 3600 | |
| gokey._domainkey | TXT | DKIM Unisender, ключ ниже | 1800 | |
| dkey._domainkey.send | CNAME | dkim.50045.order.msgpanel.com | 600 | |

DKIM Яндекса (`mail._domainkey`):

```
v=DKIM1; k=rsa; t=s; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC31DtofnLKY0EhHJI1BLtOFsofSejnLkrDAJeH90hUcUnQtWN+CXE+aurPDxD4B269nizv8W9euhl1IWU9pN8r2d+O+fQN2fU5lMjFYZecMUJL3wlgR5I1r4DVjwIYaCGdpEb2R9VOEQy6lPspWVm6LFcq//yp3I1T7u8cvo4nRwIDAQAB
```

DKIM Unisender (`gokey._domainkey`):

```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC2pJAAxT0UUeRSimRlg9Z1tHmcymNiyiq0DU9LckQzB7+7Bs5WT4n/dBDSXBaA76wXCgG+Q2vPU2gtJHCbd6+T9cwzfNQYQem29PiD8av7W9UoRiwYgNAzBdS9QSqPVlMHNieszrgy8H20PqdFxxm/TwhBzjD+8VcJxUKnNO7daQIDAQAB
```

## Что добавить после переноса

Домен ссылок Unisender — без него API отдаёт `code 229` и не отправляет:

| Имя | Тип | Значение |
|---|---|---|
| send | CNAME | 50045.order.msgpanel.com |

Цель проверена, резолвится в 31.184.200.211.

## Чего в новой зоне быть НЕ должно

В старой зоне висели `uns1.unisender.com`, `uns2`, `uns3` как NS самого домена.
На запросы они отвечают REFUSED. У реестра делегирование было только на
registrant.ru, поэтому сайт не страдал, но это мусор от чужой попытки
делегирования — переносить его не надо.

## Как было делегировано

Реестр .рф отдавал: `ns1.registrant.ru`, `ns2.registrant.ru`, `ns3.registrant.ru`.
Новые: `dns1.yandex.net`, `dns2.yandex.net` (IP-адреса в форме оставить пустыми).
Смена — в Nethouse: Домены → музыкальный-мир.рф → Редактировать DNS-серверы.
