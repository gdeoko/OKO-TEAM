/* ДВА ОСТАЛЬНЫХ ФОРМАТА ПОДПИСКИ: Clash yaml и sing-box json.

   Панели отдают подписку тремя способами, и какой придёт, решает не
   клиент. Список ссылок разбирает `Подписка`, а здесь два тяжёлых
   случая.

   ПОЧЕМУ YAML РАЗБИРАЕТСЯ СВОИМ КОДОМ, А НЕ БИБЛИОТЕКОЙ. В релизе
   должен лежать один exe без довесков: чужая dll рядом с программой
   это ещё один файл, который теряют при копировании папки. Нам нужен
   не весь yaml, а один его кусок - список `proxies`, - и он описан
   жёстко. Разбираем ровно его, в двух видах записи: блочном и
   однострочном, потому что встречаются оба.

   ЧЕГО ЗДЕСЬ НЕТ НАРОЧНО. Якорей, ссылок, многострочных значений и
   прочего из полного yaml. В списке серверов их не бывает, а поддержка
   «на всякий случай» это код, который никто никогда не проверит. */
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal static class ФорматыПодписки
    {
        // ── CLASH YAML ─────────────────────────────────────────────

        public static List<Узел> ИзClash(string тело)
        {
            List<Узел> узлы = new List<Узел>();
            string[] строки = тело.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

            int н = -1;
            for (int i = 0; i < строки.Length; i++)
                if (строки[i].TrimEnd().StartsWith("proxies:", StringComparison.Ordinal)) { н = i; break; }
            if (н < 0) return узлы;

            /* Элемент списка начинается с дефиса на своём уровне отступа.
               Всё, что ниже по отступу, это его поля. */
            int уровень = -1;
            List<string> кусок = null;
            for (int i = н + 1; i < строки.Length; i++)
            {
                string с = строки[i];
                if (с.Trim().Length == 0) continue;
                int отступ = Отступ(с);
                string голая = с.Trim();

                if (голая.StartsWith("-", StringComparison.Ordinal) && (уровень < 0 || отступ <= уровень))
                {
                    if (кусок != null) Добавить(узлы, кусок);
                    уровень = отступ;
                    кусок = new List<string> { с };
                    continue;
                }
                /* Вышли из списка: строка с отступом меньше, чем у
                   дефиса, это уже следующий раздел файла. */
                if (уровень >= 0 && отступ <= уровень) break;
                if (кусок != null) кусок.Add(с);
            }
            if (кусок != null) Добавить(узлы, кусок);
            return узлы;
        }

        private static void Добавить(List<Узел> узлы, List<string> кусок)
        {
            Dictionary<string, object> поля = ЭлементСписка(кусок);
            if (поля == null) return;
            Узел у = ИзПолейClash(поля);
            if (у != null) узлы.Add(у);
        }

        private static int Отступ(string с)
        {
            int н = 0;
            while (н < с.Length && с[н] == ' ') н++;
            return н;
        }

        private static Dictionary<string, object> ЭлементСписка(List<string> строки)
        {
            string первая = строки[0].Trim().Substring(1).Trim();   // убрали дефис
            if (первая.StartsWith("{", StringComparison.Ordinal))
                return ОднойСтрокой(первая);

            /* Блочная запись: первая строка это уже первое поле, его
               отступ равен отступу дефиса плюс два. Выравниваем все
               строки под один разбор. */
            List<string> ровно = new List<string>();
            if (первая.Length > 0) ровно.Add("  " + первая);
            int базовый = -1;
            for (int i = 1; i < строки.Count; i++)
            {
                int о = Отступ(строки[i]);
                if (базовый < 0) базовый = о;
                ровно.Add(new string(' ', Math.Max(2, о - базовый + 2)) + строки[i].Trim());
            }
            int место = 0;
            return Блок(ровно, ref место, 2);
        }

        private static Dictionary<string, object> Блок(List<string> строки, ref int место, int уровень)
        {
            Dictionary<string, object> д = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            while (место < строки.Count)
            {
                string с = строки[место];
                int о = Отступ(с);
                if (о < уровень) break;
                if (о > уровень) { место++; continue; }

                string голая = с.Trim();
                int дв = голая.IndexOf(':');
                if (дв < 0) { место++; continue; }

                string ключ = голая.Substring(0, дв).Trim();
                string знач = голая.Substring(дв + 1).Trim();
                место++;

                if (знач.Length == 0)
                {
                    /* Пустое значение значит вложенный набор полей:
                       ws-opts, reality-opts, headers. */
                    int глубже = место < строки.Count ? Отступ(строки[место]) : -1;
                    if (глубже > уровень) д[ключ] = Блок(строки, ref место, глубже);
                    else д[ключ] = "";
                }
                else if (знач.StartsWith("{", StringComparison.Ordinal))
                {
                    д[ключ] = ОднойСтрокой(знач);
                }
                else
                {
                    д[ключ] = Очистить(знач);
                }
            }
            return д;
        }

        /* Однострочная запись {name: a, type: vless, ws-opts: {path: /x}}.
           Режем по запятым верхнего уровня: внутри вложенных скобок
           запятая своя. */
        private static Dictionary<string, object> ОднойСтрокой(string т)
        {
            Dictionary<string, object> д = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            т = т.Trim();
            if (т.StartsWith("{", StringComparison.Ordinal)) т = т.Substring(1);
            if (т.EndsWith("}", StringComparison.Ordinal)) т = т.Substring(0, т.Length - 1);

            foreach (string часть in ПоЗапятым(т))
            {
                int дв = ГлубинаНоль(часть, ':');
                if (дв < 0) continue;
                string ключ = часть.Substring(0, дв).Trim();
                string знач = часть.Substring(дв + 1).Trim();
                if (знач.StartsWith("{", StringComparison.Ordinal)) д[ключ] = ОднойСтрокой(знач);
                else д[ключ] = Очистить(знач);
            }
            return д;
        }

        private static List<string> ПоЗапятым(string т)
        {
            List<string> части = new List<string>();
            int глубина = 0, начало = 0;
            bool вКавычках = false;
            char кавычка = '"';
            for (int i = 0; i < т.Length; i++)
            {
                char з = т[i];
                if (вКавычках) { if (з == кавычка) вКавычках = false; continue; }
                if (з == '"' || з == '\'') { вКавычках = true; кавычка = з; continue; }
                if (з == '{' || з == '[') глубина++;
                else if (з == '}' || з == ']') глубина--;
                else if (з == ',' && глубина == 0)
                {
                    части.Add(т.Substring(начало, i - начало));
                    начало = i + 1;
                }
            }
            if (начало < т.Length) части.Add(т.Substring(начало));
            return части;
        }

        private static int ГлубинаНоль(string т, char искомый)
        {
            int глубина = 0;
            bool вКавычках = false;
            char кавычка = '"';
            for (int i = 0; i < т.Length; i++)
            {
                char з = т[i];
                if (вКавычках) { if (з == кавычка) вКавычках = false; continue; }
                if (з == '"' || з == '\'') { вКавычках = true; кавычка = з; continue; }
                if (з == '{' || з == '[') глубина++;
                else if (з == '}' || з == ']') глубина--;
                else if (з == искомый && глубина == 0) return i;
            }
            return -1;
        }

        private static string Очистить(string з)
        {
            з = з.Trim();
            int реш = ГлубинаНоль(з, '#');
            if (реш > 0) з = з.Substring(0, реш).Trim();   // хвостовой комментарий
            if (з.Length >= 2 &&
                ((з[0] == '"' && з[з.Length - 1] == '"') || (з[0] == '\'' && з[з.Length - 1] == '\'')))
                з = з.Substring(1, з.Length - 2);
            return з;
        }

        private static Узел ИзПолейClash(Dictionary<string, object> п)
        {
            string вид = Слово(п, "type").ToLowerInvariant();
            Узел у = new Узел();
            у.Имя = Слово(п, "name");
            у.Адрес = Слово(п, "server");
            у.Порт = Цифра(Слово(п, "port"));
            у.Сеть = Пусто(Слово(п, "network"), "tcp");
            у.Отпечаток = Пусто(Слово(п, "client-fingerprint"), Слово(п, "fingerprint"));
            у.Sni = Пусто(Слово(п, "servername"), Слово(п, "sni"));
            у.БезПроверки = Правда(Слово(п, "skip-cert-verify"));

            bool tls = Правда(Слово(п, "tls"));
            Dictionary<string, object> reality = Набор(п, "reality-opts");
            if (reality != null)
            {
                у.Защита = "reality";
                у.Ключ = Пусто(Слово(reality, "public-key"), Слово(reality, "publicKey"));
                у.Короткий = Пусто(Слово(reality, "short-id"), Слово(reality, "shortId"));
            }
            else у.Защита = tls ? "tls" : "none";

            Dictionary<string, object> ws = Набор(п, "ws-opts");
            if (ws != null)
            {
                у.Сеть = "ws";
                у.Путь = Пусто(Слово(ws, "path"), "/");
                Dictionary<string, object> шапки = Набор(ws, "headers");
                if (шапки != null) у.ЗаголовокХост = Слово(шапки, "Host");
            }
            Dictionary<string, object> grpc = Набор(п, "grpc-opts");
            if (grpc != null)
            {
                у.Сеть = "grpc";
                у.Служба = Пусто(Слово(grpc, "grpc-service-name"), Слово(grpc, "serviceName"));
            }

            switch (вид)
            {
                case "vless":
                    у.Протокол = "vless";
                    у.Ид = Слово(п, "uuid");
                    у.Поток = Слово(п, "flow");
                    break;
                case "vmess":
                    у.Протокол = "vmess";
                    у.Ид = Слово(п, "uuid");
                    у.Альтер = Цифра(Пусто(Слово(п, "alterId"), "0"));
                    break;
                case "trojan":
                    у.Протокол = "trojan";
                    у.Ид = Слово(п, "password");
                    if (у.Защита == "none") у.Защита = "tls";
                    break;
                case "ss":
                case "shadowsocks":
                    у.Протокол = "shadowsocks";
                    у.Ид = Слово(п, "password");
                    у.Метод = Слово(п, "cipher");
                    break;
                default:
                    return null;   // socks, hysteria, tuic и прочее ядро не возьмёт
            }

            if (string.IsNullOrEmpty(у.Sni) && у.Защита != "none") у.Sni = у.ЗаголовокХост;
            return (!string.IsNullOrEmpty(у.Адрес) && у.Порт > 0) ? у : null;
        }

        // ── SING-BOX JSON ──────────────────────────────────────────

        public static List<Узел> ИзSingBox(string тело)
        {
            List<Узел> узлы = new List<Узел>();
            JavaScriptSerializer с = new JavaScriptSerializer();
            с.MaxJsonLength = int.MaxValue;
            object корень = с.DeserializeObject(тело);

            Dictionary<string, object> д = корень as Dictionary<string, object>;
            object[] список = корень as object[];
            if (д != null)
            {
                object о;
                if (д.TryGetValue("outbounds", out о)) список = о as object[];
            }
            if (список == null) return узлы;

            foreach (object э in список)
            {
                Dictionary<string, object> в = э as Dictionary<string, object>;
                if (в == null) continue;
                Узел у = ИзПолейSingBox(в);
                if (у != null) узлы.Add(у);
            }
            return узлы;
        }

        private static Узел ИзПолейSingBox(Dictionary<string, object> в)
        {
            string вид = Слово(в, "type").ToLowerInvariant();
            Узел у = new Узел();
            у.Имя = Пусто(Слово(в, "tag"), "");
            у.Адрес = Слово(в, "server");
            у.Порт = Цифра(Слово(в, "server_port"));

            switch (вид)
            {
                case "vless": у.Протокол = "vless"; у.Ид = Слово(в, "uuid"); у.Поток = Слово(в, "flow"); break;
                case "vmess": у.Протокол = "vmess"; у.Ид = Слово(в, "uuid"); у.Альтер = Цифра(Слово(в, "alter_id")); break;
                case "trojan": у.Протокол = "trojan"; у.Ид = Слово(в, "password"); break;
                case "shadowsocks":
                    у.Протокол = "shadowsocks"; у.Ид = Слово(в, "password"); у.Метод = Слово(в, "method"); break;
                default:
                    return null;   // selector, urltest, direct, block, dns
            }

            Dictionary<string, object> tls = Набор(в, "tls");
            if (tls != null && Правда(Слово(tls, "enabled")))
            {
                у.Защита = "tls";
                у.Sni = Слово(tls, "server_name");
                у.БезПроверки = Правда(Слово(tls, "insecure"));
                Dictionary<string, object> utls = Набор(tls, "utls");
                if (utls != null) у.Отпечаток = Слово(utls, "fingerprint");
                Dictionary<string, object> reality = Набор(tls, "reality");
                if (reality != null && Правда(Слово(reality, "enabled")))
                {
                    у.Защита = "reality";
                    у.Ключ = Слово(reality, "public_key");
                    у.Короткий = Слово(reality, "short_id");
                }
            }
            else у.Защита = "none";

            Dictionary<string, object> транспорт = Набор(в, "transport");
            if (транспорт != null)
            {
                string т = Слово(транспорт, "type").ToLowerInvariant();
                if (т == "ws")
                {
                    у.Сеть = "ws";
                    у.Путь = Пусто(Слово(транспорт, "path"), "/");
                    Dictionary<string, object> шапки = Набор(транспорт, "headers");
                    if (шапки != null) у.ЗаголовокХост = Слово(шапки, "Host");
                }
                else if (т == "grpc")
                {
                    у.Сеть = "grpc";
                    у.Служба = Слово(транспорт, "service_name");
                }
            }

            if (string.IsNullOrEmpty(у.Sni) && у.Защита != "none") у.Sni = у.ЗаголовокХост;
            return (!string.IsNullOrEmpty(у.Адрес) && у.Порт > 0) ? у : null;
        }

        // ── МЕЛОЧИ ─────────────────────────────────────────────────

        private static string Слово(Dictionary<string, object> д, string ключ)
        {
            object з;
            if (д != null && д.TryGetValue(ключ, out з) && з != null) return з.ToString();
            return "";
        }

        private static Dictionary<string, object> Набор(Dictionary<string, object> д, string ключ)
        {
            object з;
            if (д != null && д.TryGetValue(ключ, out з)) return з as Dictionary<string, object>;
            return null;
        }

        private static bool Правда(string з)
        {
            з = (з ?? "").Trim().ToLowerInvariant();
            return з == "true" || з == "1" || з == "yes" || з == "on";
        }

        private static string Пусто(string а, string б) { return string.IsNullOrEmpty(а) ? (б ?? "") : а; }

        private static int Цифра(string с)
        {
            int н;
            return int.TryParse((с ?? "").Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out н) ? н : 0;
        }
    }
}
