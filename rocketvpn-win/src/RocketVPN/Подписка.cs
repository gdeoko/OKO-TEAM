/* ПОДПИСКА: загрузка и разбор.

   ГЛАВНОЕ ПРАВИЛО КЛИЕНТА. Ссылка принимается только с домена
   rocketconfig.top и только по https. Это просьба сетевого
   администратора, и держит её код, а не памятка: проверка стоит в самой
   двери `Загрузить`, мимо неё в программе нет ни одного пути к сети.
   Домен задан константой ниже, менять его - править эту строку и
   пересобирать, вручную в настройках он не меняется.

   ЧТО ПРИХОДИТ ПО ССЫЛКЕ. Панели отдают подписку по-разному:
   чаще всего это base64 от списка ссылок vless://, реже тот же список
   открытым текстом. Оба читаем. Clash yaml и sing-box json пока не
   разбираем: без живого примера угадывать их раскладку нельзя, а
   выдуманный разбор хуже честного отказа - он молча отдаст не тот
   сервер. На таком ответе пишем прямо, что прислать. */
using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal static class Подписка
    {
        public const string Домен = "rocketconfig.top";

        /* Проверка домена. Разрешаем сам домен и его поддомены, чужое
           отбиваем с понятным словом: человек должен видеть, почему
           ссылка не подошла, а не «ошибка загрузки». */
        public static bool ДоменСвой(string адрес, out string почему)
        {
            почему = "";
            Uri u;
            if (string.IsNullOrWhiteSpace(адрес) || !Uri.TryCreate(адрес.Trim(), UriKind.Absolute, out u))
            {
                почему = "Это не похоже на ссылку.";
                return false;
            }
            if (u.Scheme != Uri.UriSchemeHttps)
            {
                почему = "Нужна ссылка по https.";
                return false;
            }
            string х = u.Host.ToLowerInvariant();
            if (х != Домен && !х.EndsWith("." + Домен, StringComparison.Ordinal))
            {
                почему = "Клиент работает только со ссылками " + Домен + ".";
                return false;
            }
            return true;
        }

        public static List<Узел> Загрузить(string адрес, out string почему)
        {
            почему = "";
            if (!ДоменСвой(адрес, out почему)) return new List<Узел>();

            string тело;
            try
            {
                /* Семёрка по умолчанию говорит TLS 1.0, а сервер его уже
                   не слушает: без этой строки подписка не грузится вовсе,
                   и это первая причина, по которой старый клиент
                   «не видит сеть». */
                Сеть.ВключитьСовременныйTLS();
                using (WebClient в = new WebClient())
                {
                    в.Encoding = Encoding.UTF8;
                    в.Headers.Add("User-Agent", Сеть.Представление);
                    тело = в.DownloadString(адрес.Trim());
                }
            }
            catch (Exception е)
            {
                почему = "Подписка не загрузилась: " + е.Message;
                return new List<Узел>();
            }

            List<Узел> узлы = РазобратьТело(тело, out почему);
            if (узлы.Count == 0 && почему == "") почему = "В подписке нет серверов.";
            return узлы;
        }

        public static List<Узел> РазобратьТело(string тело, out string почему)
        {
            почему = "";
            List<Узел> узлы = new List<Узел>();
            if (string.IsNullOrWhiteSpace(тело)) { почему = "Подписка пустая."; return узлы; }

            string т = тело.Trim();

            /* Формат, которого мы пока не читаем, называем вслух: иначе
               человек увидит пустой список и решит, что сломан клиент. */
            if (т.StartsWith("{", StringComparison.Ordinal) || т.StartsWith("[", StringComparison.Ordinal))
            {
                почему = "Подписка в формате JSON (sing-box) пока не читается. Нужен список ссылок vless.";
                return узлы;
            }
            if (т.StartsWith("proxies:", StringComparison.Ordinal) || т.Contains("\nproxies:"))
            {
                почему = "Подписка в формате Clash yaml пока не читается. Нужен список ссылок vless.";
                return узлы;
            }

            if (!т.Contains("://")) т = ИзBase64(т);

            string[] строки = т.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            foreach (string с in строки)
            {
                string л = с.Trim();
                if (л.Length == 0 || Комментарий(л)) continue;
                Узел у = РазобратьСсылку(л);
                if (у != null) узлы.Add(у);
            }
            return узлы;
        }

        private static bool Комментарий(string с)
        {
            return с.StartsWith("#", StringComparison.Ordinal) || с.StartsWith("//", StringComparison.Ordinal);
        }

        public static string ИзBase64(string т)
        {
            try
            {
                string ч = т.Replace("-", "+").Replace("_", "/").Replace("\n", "").Replace("\r", "").Trim();
                if (ч.Length % 4 != 0) ч = ч.PadRight(ч.Length + (4 - ч.Length % 4), '=');
                return Encoding.UTF8.GetString(Convert.FromBase64String(ч));
            }
            catch { return т; }
        }

        public static Узел РазобратьСсылку(string ссылка)
        {
            try
            {
                if (ссылка.StartsWith("vless://", StringComparison.OrdinalIgnoreCase)) return Vless(ссылка);
                if (ссылка.StartsWith("trojan://", StringComparison.OrdinalIgnoreCase)) return Trojan(ссылка);
                if (ссылка.StartsWith("vmess://", StringComparison.OrdinalIgnoreCase)) return Vmess(ссылка);
                if (ссылка.StartsWith("ss://", StringComparison.OrdinalIgnoreCase)) return Shadowsocks(ссылка);
            }
            catch (Exception е)
            {
                Журнал.Писать("ссылка не разобралась: " + е.Message);
            }
            return null;
        }

        /* vless://uuid@адрес:порт?ключи#имя */
        private static Узел Vless(string ссылка)
        {
            Разбор р = Разбор.Сделать(ссылка);
            Узел у = new Узел();
            у.Протокол = "vless";
            у.Ссылка = ссылка;
            у.Ид = р.Пользователь;
            у.Адрес = р.Хост;
            у.Порт = р.Порт;
            у.Имя = р.Имя;
            ОбщиеКлючи(у, р);
            у.Поток = р.Ключ("flow");
            return Годен(у) ? у : null;
        }

        private static Узел Trojan(string ссылка)
        {
            Разбор р = Разбор.Сделать(ссылка);
            Узел у = new Узел();
            у.Протокол = "trojan";
            у.Ссылка = ссылка;
            у.Ид = р.Пользователь;
            у.Адрес = р.Хост;
            у.Порт = р.Порт;
            у.Имя = р.Имя;
            ОбщиеКлючи(у, р);
            if (у.Защита == "none") у.Защита = "tls";  // trojan без tls не бывает
            return Годен(у) ? у : null;
        }

        /* vmess://<base64 от json> */
        private static Узел Vmess(string ссылка)
        {
            string json = ИзBase64(ссылка.Substring("vmess://".Length));
            Dictionary<string, object> д = new JavaScriptSerializer()
                .Deserialize<Dictionary<string, object>>(json);
            if (д == null) return null;

            Узел у = new Узел();
            у.Протокол = "vmess";
            у.Ссылка = ссылка;
            у.Имя = Поле(д, "ps");
            у.Адрес = Поле(д, "add");
            у.Порт = Число(Поле(д, "port"));
            у.Ид = Поле(д, "id");
            у.Альтер = Число(Поле(д, "aid"));
            у.Сеть = Пусто(Поле(д, "net"), "tcp");
            у.Путь = Поле(д, "path");
            у.ЗаголовокХост = Поле(д, "host");
            у.Служба = Поле(д, "path");
            string tls = Поле(д, "tls");
            у.Защита = string.IsNullOrEmpty(tls) ? "none" : tls;
            у.Sni = Пусто(Поле(д, "sni"), у.ЗаголовокХост);
            return Годен(у) ? у : null;
        }

        /* ss://base64(метод:пароль)@адрес:порт#имя и старый ss://base64(всё) */
        private static Узел Shadowsocks(string ссылка)
        {
            string тело = ссылка.Substring("ss://".Length);
            string имя = "";
            int реш = тело.IndexOf('#');
            if (реш >= 0) { имя = Uri.UnescapeDataString(тело.Substring(реш + 1)); тело = тело.Substring(0, реш); }
            int вопрос = тело.IndexOf('?');
            if (вопрос >= 0) тело = тело.Substring(0, вопрос);

            if (тело.IndexOf('@') < 0) тело = ИзBase64(тело);
            int соб = тело.LastIndexOf('@');
            if (соб < 0) return null;

            string левая = тело.Substring(0, соб);
            string правая = тело.Substring(соб + 1);
            if (левая.IndexOf(':') < 0) левая = ИзBase64(левая);

            int дв = левая.IndexOf(':');
            if (дв < 0) return null;
            int дв2 = правая.LastIndexOf(':');
            if (дв2 < 0) return null;

            Узел у = new Узел();
            у.Протокол = "shadowsocks";
            у.Ссылка = ссылка;
            у.Имя = имя;
            у.Метод = левая.Substring(0, дв);
            у.Ид = левая.Substring(дв + 1);
            у.Адрес = правая.Substring(0, дв2).Trim('[', ']');
            у.Порт = Число(правая.Substring(дв2 + 1));
            return Годен(у) ? у : null;
        }

        private static void ОбщиеКлючи(Узел у, Разбор р)
        {
            у.Сеть = Пусто(р.Ключ("type"), "tcp");
            string защита = р.Ключ("security");
            у.Защита = string.IsNullOrEmpty(защита) ? "none" : защита.ToLowerInvariant();
            у.Sni = Пусто(р.Ключ("sni"), р.Ключ("peer"));
            у.Отпечаток = р.Ключ("fp");
            у.Ключ = р.Ключ("pbk");
            у.Короткий = р.Ключ("sid");
            у.Паук = р.Ключ("spx");
            у.Путь = р.Ключ("path");
            у.ЗаголовокХост = Пусто(р.Ключ("host"), р.Ключ("sni"));
            у.Служба = Пусто(р.Ключ("serviceName"), р.Ключ("path"));
            у.БезПроверки = р.Ключ("allowInsecure") == "1";
            if (string.IsNullOrEmpty(у.Sni) && у.Защита != "none") у.Sni = у.ЗаголовокХост;
        }

        private static bool Годен(Узел у)
        {
            return !string.IsNullOrEmpty(у.Адрес) && у.Порт > 0 && у.Порт < 65536;
        }

        private static string Пусто(string а, string б) { return string.IsNullOrEmpty(а) ? (б ?? "") : а; }

        private static string Поле(Dictionary<string, object> д, string ключ)
        {
            object з;
            if (д != null && д.TryGetValue(ключ, out з) && з != null) return з.ToString();
            return "";
        }

        private static int Число(string с)
        {
            int н;
            return int.TryParse(с, out н) ? н : 0;
        }

        /* Разбор ссылки вида схема://пользователь@хост:порт?ключи#имя.
           System.Uri на таких схемах местами привередлив (теряет порт,
           спотыкается на пустом пути), поэтому режем строку руками. */
        private sealed class Разбор
        {
            public string Пользователь = "", Хост = "", Имя = "";
            public int Порт;
            private readonly Dictionary<string, string> ключи = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            public string Ключ(string имя)
            {
                string з;
                return ключи.TryGetValue(имя, out з) ? з : "";
            }

            public static Разбор Сделать(string ссылка)
            {
                Разбор р = new Разбор();
                int схема = ссылка.IndexOf("://", StringComparison.Ordinal);
                string т = ссылка.Substring(схема + 3);

                int реш = т.IndexOf('#');
                if (реш >= 0)
                {
                    р.Имя = Uri.UnescapeDataString(т.Substring(реш + 1));
                    т = т.Substring(0, реш);
                }

                int вопрос = т.IndexOf('?');
                if (вопрос >= 0)
                {
                    foreach (string пара in т.Substring(вопрос + 1).Split('&'))
                    {
                        if (пара.Length == 0) continue;
                        int равно = пара.IndexOf('=');
                        string к = равно < 0 ? пара : пара.Substring(0, равно);
                        string з = равно < 0 ? "" : Uri.UnescapeDataString(пара.Substring(равно + 1));
                        р.ключи[к] = з;
                    }
                    т = т.Substring(0, вопрос);
                }

                int соб = т.LastIndexOf('@');
                if (соб >= 0)
                {
                    р.Пользователь = Uri.UnescapeDataString(т.Substring(0, соб));
                    т = т.Substring(соб + 1);
                }

                /* Адрес в квадратных скобках это IPv6, и двоеточий в нём
                   своих хватает: порт ищем после закрывающей скобки. */
                int двоеточие = т.StartsWith("[", StringComparison.Ordinal)
                    ? т.IndexOf(':', т.IndexOf(']') < 0 ? 0 : т.IndexOf(']'))
                    : т.LastIndexOf(':');
                if (двоеточие >= 0)
                {
                    р.Хост = т.Substring(0, двоеточие).Trim('[', ']');
                    int п;
                    int.TryParse(т.Substring(двоеточие + 1).Trim('/'), out п);
                    р.Порт = п;
                }
                else
                {
                    р.Хост = т.Trim('[', ']', '/');
                }
                return р;
            }
        }
    }
}
