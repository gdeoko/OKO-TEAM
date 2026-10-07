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
            Так("json честно отбит", json.Count == 0 && ч.Contains("sing-box"));
            List<Узел> yaml = Подписка.РазобратьТело("proxies:\n  - name: a", out ч);
            Так("yaml честно отбит", yaml.Count == 0 && ч.Contains("Clash"));
            Подписка.РазобратьТело("   ", out ч);
            Так("пустая подписка названа", ч.Length > 0);

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

            Console.WriteLine("\nвсего " + всего + ", плохо " + упало);
            Environment.Exit(упало == 0 ? 0 : 1);
        }

        public static void Main() { Главная(); }
    }
}
