/* Проба разбора подписки и сборки конфига. Гоняется на сборке под
   mono: окна здесь нет, только логика, которой верить на слово нельзя.
   Запуск: dotnet build && mono проба.exe */
using System;
using System.Collections.Generic;
using System.Text;

namespace RocketVPN
{
    internal static class Проба
    {
        private static int всего, упало;

        private static void Так(string что, bool правда)
        {
            всего++;
            if (!правда) { упало++; Console.WriteLine("  ПЛОХО  " + что); }
            else Console.WriteLine("  ок     " + что);
        }

        private static void Главная()
        {
            Console.OutputEncoding = Encoding.UTF8;

            Console.WriteLine("\nДОМЕН");
            string почему;
            Так("свой домен проходит",
                Подписка.ДоменСвой("https://rocketconfig.top/sub/abc", out почему));
            Так("поддомен проходит",
                Подписка.ДоменСвой("https://cdn.rocketconfig.top/s/1", out почему));
            Так("чужой домен отбит",
                !Подписка.ДоменСвой("https://rocketconfig.top.evil.ru/sub", out почему));
            Так("похожий домен отбит",
                !Подписка.ДоменСвой("https://notrocketconfig.top/sub", out почему));
            Так("http отбит",
                !Подписка.ДоменСвой("http://rocketconfig.top/sub", out почему));
            Так("мусор отбит",
                !Подписка.ДоменСвой("просто текст", out почему));
            Так("у отказа есть причина словами", почему.Length > 5);

            Console.WriteLine("\nРАЗБОР ССЫЛОК");
            string vless = "vless://11111111-2222-3333-4444-555555555555@185.10.20.30:443" +
                "?encryption=none&security=reality&sni=www.microsoft.com&fp=chrome" +
                "&pbk=ABCDEF&sid=1a2b&type=tcp&flow=xtls-rprx-vision#Москва%20%231";
            Узел у = Подписка.РазобратьСсылку(vless);
            Так("vless разобран", у != null);
            if (у != null)
            {
                Так("адрес", у.Адрес == "185.10.20.30");
                Так("порт", у.Порт == 443);
                Так("ид", у.Ид == "11111111-2222-3333-4444-555555555555");
                Так("имя раскодировано", у.Имя == "Москва #1");
                Так("reality", у.Защита == "reality");
                Так("sni", у.Sni == "www.microsoft.com");
                Так("ключ reality", у.Ключ == "ABCDEF");
                Так("короткий", у.Короткий == "1a2b");
                Так("поток", у.Поток == "xtls-rprx-vision");
            }

            Узел в = Подписка.РазобратьСсылку(
                "vless://aaa@example.com:8443?type=ws&security=tls&path=%2Fray&host=front.example.com#WS");
            Так("ws разобран", в != null && в.Сеть == "ws");
            Так("путь раскодирован", в != null && в.Путь == "/ray");
            Так("заголовок хоста", в != null && в.ЗаголовокХост == "front.example.com");

            Узел т = Подписка.РазобратьСсылку("trojan://пароль@1.2.3.4:443?sni=a.b#Троян");
            Так("trojan разобран", т != null && т.Ид == "пароль" && т.Порт == 443);
            Так("у trojan защита tls сама", т != null && т.Защита == "tls");

            Узел ss = Подписка.РазобратьСсылку(
                "ss://" + Convert.ToBase64String(Encoding.UTF8.GetBytes("aes-256-gcm:секрет")) +
                "@9.9.9.9:8388#SS");
            Так("ss разобран", ss != null && ss.Метод == "aes-256-gcm" && ss.Ид == "секрет" && ss.Порт == 8388);

            Узел v6 = Подписка.РазобратьСсылку("vless://bbb@[2001:db8::1]:2053?security=tls#IPv6");
            Так("ipv6 адрес", v6 != null && v6.Адрес == "2001:db8::1");
            Так("ipv6 порт", v6 != null && v6.Порт == 2053);

            Так("битая ссылка не ломает", Подписка.РазобратьСсылку("vless://") == null);
            Так("чужая схема не берётся", Подписка.РазобратьСсылку("ftp://a@b:1") == null);

            Console.WriteLine("\nТЕЛО ПОДПИСКИ");
            string список = vless + "\n" + "trojan://p@1.2.3.4:443#Т" + "\n\n# коммент\n";
            string б64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(список));
            string ч;
            List<Узел> из64 = Подписка.РазобратьТело(б64, out ч);
            Так("base64 разобран, два узла", из64.Count == 2);
            List<Узел> изТекста = Подписка.РазобратьТело(список, out ч);
            Так("открытый текст разобран, два узла", изТекста.Count == 2);

            List<Узел> json = Подписка.РазобратьТело("{\"outbounds\":[]}", out ч);
            Так("пустой json: ноль узлов и причина словами", json.Count == 0 && ч.Length > 10);
            List<Узел> yaml = Подписка.РазобратьТело("proxies:\n  - name: a", out ч);
            Так("yaml без годных узлов: причина словами", yaml.Count == 0 && ч.Contains("Clash"));
            Так("битый json не роняет программу",
                Подписка.РазобратьТело("{это не json", out ч).Count == 0);
            Подписка.РазобратьТело("   ", out ч);
            Так("пустая подписка названа", ч.Length > 0);

            Console.WriteLine("\nCLASH YAML");
            string clash = string.Join("\n", new string[] {
                "port: 7890",
                "proxies:",
                "  - name: \"Москва 1\"",
                "    type: vless",
                "    server: 10.0.0.1",
                "    port: 443",
                "    uuid: uuid-1",
                "    tls: true",
                "    servername: www.ms.com",
                "    client-fingerprint: chrome",
                "    flow: xtls-rprx-vision",
                "    reality-opts:",
                "      public-key: PBK123",
                "      short-id: ab12",
                "  - name: Вторая",
                "    type: trojan",
                "    server: 10.0.0.2",
                "    port: 8443",
                "    password: секрет",
                "    sni: a.example.com",
                "  - {name: Третья, type: ss, server: 10.0.0.3, port: 8388, cipher: aes-128-gcm, password: пп}",
                "  - name: Четвёртая",
                "    type: vmess",
                "    server: 10.0.0.4",
                "    port: 80",
                "    uuid: uuid-4",
                "    alterId: 0",
                "    network: ws",
                "    ws-opts:",
                "      path: /путь",
                "      headers:",
                "        Host: front.example.com",
                "  - name: Пропустить",
                "    type: hysteria2",
                "    server: 10.0.0.9",
                "    port: 443",
                "proxy-groups:",
                "  - name: авто",
                ""});
            List<Узел> ясно = Подписка.РазобратьТело(clash, out ч);
            Так("clash: четыре понятных узла", ясно.Count == 4);
            if (ясно.Count == 4)
            {
                Так("clash: имя в кавычках", ясно[0].Имя == "Москва 1");
                Так("clash: reality", ясно[0].Защита == "reality" && ясно[0].Ключ == "PBK123" && ясно[0].Короткий == "ab12");
                Так("clash: sni", ясно[0].Sni == "www.ms.com");
                Так("clash: поток", ясно[0].Поток == "xtls-rprx-vision");
                Так("clash: trojan с паролем", ясно[1].Протокол == "trojan" && ясно[1].Ид == "секрет");
                Так("clash: однострочный ss", ясно[2].Протокол == "shadowsocks" && ясно[2].Метод == "aes-128-gcm" && ясно[2].Порт == 8388);
                Так("clash: vmess по ws", ясно[3].Сеть == "ws" && ясно[3].Путь == "/путь");
                Так("clash: заголовок хоста", ясно[3].ЗаголовокХост == "front.example.com");
            }
            Так("clash: чужой протокол пропущен",
                ясно.FindIndex(delegate (Узел z) { return z.Адрес == "10.0.0.9"; }) < 0);

            string вБазе = Convert.ToBase64String(Encoding.UTF8.GetBytes(clash));
            Так("clash внутри base64 тоже читается", Подписка.РазобратьТело(вБазе, out ч).Count == 4);

            Console.WriteLine("\nSING-BOX JSON");
            string sb = "{\"outbounds\":[" +
                "{\"type\":\"vless\",\"tag\":\"Питер\",\"server\":\"20.0.0.1\",\"server_port\":443," +
                "\"uuid\":\"u-1\",\"flow\":\"xtls-rprx-vision\"," +
                "\"tls\":{\"enabled\":true,\"server_name\":\"ya.ru\",\"utls\":{\"fingerprint\":\"firefox\"}," +
                "\"reality\":{\"enabled\":true,\"public_key\":\"KEY\",\"short_id\":\"ff\"}}}," +
                "{\"type\":\"trojan\",\"tag\":\"Тр\",\"server\":\"20.0.0.2\",\"server_port\":443,\"password\":\"p\"," +
                "\"transport\":{\"type\":\"ws\",\"path\":\"/w\",\"headers\":{\"Host\":\"h.example\"}}}," +
                "{\"type\":\"selector\",\"tag\":\"выбор\",\"outbounds\":[\"Питер\"]}," +
                "{\"type\":\"direct\",\"tag\":\"прямо\"}]}";
            List<Узел> изSb = Подписка.РазобратьТело(sb, out ч);
            Так("sing-box: два узла из четырёх", изSb.Count == 2);
            if (изSb.Count == 2)
            {
                Так("sing-box: имя из tag", изSb[0].Имя == "Питер");
                Так("sing-box: reality", изSb[0].Защита == "reality" && изSb[0].Ключ == "KEY");
                Так("sing-box: отпечаток", изSb[0].Отпечаток == "firefox");
                Так("sing-box: ws у trojan", изSb[1].Сеть == "ws" && изSb[1].ЗаголовокХост == "h.example");
            }

            Console.WriteLine("\nКОНФИГ ЯДРА");
            string к = Конфиг.Собрать(у, 10808, 10809);
            Так("это json", к.StartsWith("{") && к.EndsWith("}"));
            Так("есть reality", к.Contains("realitySettings") && к.Contains("\"publicKey\":\"ABCDEF\""));
            Так("нет пустого tlsSettings", !к.Contains("tlsSettings"));
            Так("вход socks на месте", к.Contains("\"port\":10808"));
            Так("вход http на месте", к.Contains("\"port\":10809"));
            Так("наружу не слушаем", !к.Contains("0.0.0.0") && к.Contains("127.0.0.1"));
            Так("своя сеть мимо туннеля", к.Contains("geoip:private"));
            Так("поток записан", к.Contains("xtls-rprx-vision"));

            string кws = Конфиг.Собрать(в, 1, 2);
            Так("ws настройки есть", кws.Contains("wsSettings") && кws.Contains("\"path\":\"/ray\""));
            Так("у ws нет reality", !кws.Contains("realitySettings"));

            string кss = Конфиг.Собрать(ss, 1, 2);
            Так("ss собрался", кss.Contains("shadowsocks") && кss.Contains("aes-256-gcm"));

            Console.WriteLine("\nРЕЖИМЫ МАРШРУТИЗАЦИИ");
            string умный = Конфиг.Собрать(у, 1, 2, Конфиг.Умный);
            string весь = Конфиг.Собрать(у, 1, 2, Конфиг.ВесьТрафик);
            Так("умный: российские напрямую", умный.Contains("geoip:ru"));
            Так("весь трафик: без исключения для России", !весь.Contains("geoip:ru"));
            Так("своя сеть напрямую в обоих", умный.Contains("geoip:private") && весь.Contains("geoip:private"));
            Так("по умолчанию умный", Конфиг.Собрать(у, 1, 2).Contains("geoip:ru"));

            Console.WriteLine("\nРАЗМЕТКА НА РАЗНЫХ ЭКРАНАХ");
            Разметка();

            Console.WriteLine("\nвсего " + всего + ", плохо " + упало);
            Environment.Exit(упало == 0 ? 0 : 1);
        }


        /* Влезает ли текст в свою коробку, когда экран увеличен.
           Правка по живому запуску: при 150 процентах подписи кнопок
           обрезались до «Загрузи» и «Обновле». Теперь разметка растёт
           вместе с буквами, и это проверяется числом.

           Шрифта Segoe UI на машине сборки может не быть, подставится
           более широкий. Проверка от этого только строже. */
        private static void Разметка()
        {
            using (System.Drawing.Bitmap б = new System.Drawing.Bitmap(8, 8))
            using (System.Drawing.Graphics г = System.Drawing.Graphics.FromImage(б))
            {
                float[] масштабы = { 1f, 1.25f, 1.5f, 2f };
                string[,] строки =
                {
                    { "шапка", "ROCKET VPN", "11.5", "жирный", "180", "0" },
                    { "подпись подписки", "Ссылка подписки rocketconfig.top", "9", "", "394", "0" },
                    { "отказ по домену", "Клиент работает только со ссылками rocketconfig.top.", "8.5", "", "394", "0" },
                    { "состояние", "Переподключаем", "11", "жирный", "394", "0" },
                    { "подробность", "Москва 1  ·  203.0.113.7  ·  NL", "8.5", "", "394", "0" },
                    { "галка автозапуска", "Запускать с Windows", "9", "", "190", "22" },
                    { "выбор режима", "Умный: российские сайты напрямую", "9", "", "394", "22" },
                    { "галка проверки", "Проверять соединение после подключения", "9", "", "394", "22" },
                    { "строка списка", "Нидерланды · Амстердам 2", "10", "", "308", "0" },
                    { "кнопка пуска", "Подключить", "13", "жирный", "394", "0" }
                };

                foreach (float к in масштабы)
                {
                    int не_влезло = 0;
                    for (int i = 0; i < строки.GetLength(0); i++)
                    {
                        float кегль = float.Parse(строки[i, 2], System.Globalization.CultureInfo.InvariantCulture);
                        bool жирный = строки[i, 3] == "жирный";
                        int коробка = int.Parse(строки[i, 4]);
                        int запас = int.Parse(строки[i, 5]);
                        using (System.Drawing.Font ш = new System.Drawing.Font(
                            System.Drawing.FontFamily.GenericSansSerif, кегль * к,
                            жирный ? System.Drawing.FontStyle.Bold : System.Drawing.FontStyle.Regular,
                            System.Drawing.GraphicsUnit.Point))
                        {
                            int надо = (int)Math.Ceiling(г.MeasureString(строки[i, 1], ш).Width)
                                       + (int)Math.Round(запас * к);
                            int есть = (int)Math.Round(коробка * к);
                            if (надо > есть)
                            {
                                не_влезло++;
                                Console.WriteLine("    не влезло: " + строки[i, 0] + " надо " + надо + ", есть " + есть);
                            }
                        }
                    }
                    Так("при " + (int)(к * 100) + "% весь текст влезает", не_влезло == 0);
                }
            }
        }

        public static void Main() { Главная(); }
    }
}
