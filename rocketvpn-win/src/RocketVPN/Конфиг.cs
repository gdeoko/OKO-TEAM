/* КОНФИГ ЯДРА.

   Собираем json для Xray по выбранному узлу. Пишем только те ключи,
   которые реально есть в ссылке: лишний пустой serverName или пустой
   publicKey ядро читает как настоящие значения и рвёт соединение, а
   человек видит «не подключается» без единой подсказки.

   Два входа вместо одного. socks нужен приложениям, которые умеют
   только его, http - системному прокси Windows: WinINET про socks5 на
   семёрке знает плохо. Оба слушают только 127.0.0.1, наружу клиент
   ничего не открывает. */
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal static class Конфиг
    {
        /* Режимы маршрутизации, как в знакомых клиентах:
           0 - весь трафик через VPN,
           1 - умный: российские адреса и своя сеть идут напрямую.
           Умный стоит по умолчанию. Через туннель банк видит чужую
           страну и закрывает вход, а сетевой принтер и домашний роутер
           просто перестают отвечать - человек решает, что VPN сломал
           ему компьютер. */
        public const int ВесьТрафик = 0;
        public const int Умный = 1;

        public static string Собрать(Узел у, int портSocks, int портHttp)
        {
            return Собрать(у, портSocks, портHttp, Умный);
        }

        public static string Собрать(Узел у, int портSocks, int портHttp, int режим)
        {
            Dictionary<string, object> корень = new Dictionary<string, object>();

            корень["log"] = new Dictionary<string, object> { { "loglevel", "warning" } };

            корень["inbounds"] = new List<object>
            {
                Вход("socks", портSocks, true),
                Вход("http", портHttp, false)
            };

            корень["outbounds"] = new List<object>
            {
                Выход(у),
                new Dictionary<string, object> { { "protocol", "freedom" }, { "tag", "direct" } },
                new Dictionary<string, object> { { "protocol", "blackhole" }, { "tag", "block" } }
            };

            /* Своя сеть мимо туннеля всегда, в обоих режимах. Без
               этого правила перестают открываться принтер, роутер и
               сетевые папки, и человек считает, что VPN сломал ему
               офис. */
            List<object> правила = new List<object>
            {
                new Dictionary<string, object>
                {
                    { "type", "field" },
                    { "ip", new List<object> { "geoip:private" } },
                    { "outboundTag", "direct" }
                }
            };
            if (режим == Умный)
            {
                правила.Add(new Dictionary<string, object>
                {
                    { "type", "field" },
                    { "ip", new List<object> { "geoip:ru" } },
                    { "outboundTag", "direct" }
                });
            }
            корень["routing"] = new Dictionary<string, object>
            {
                { "domainStrategy", "IPIfNonMatch" },
                { "rules", правила }
            };

            корень["dns"] = new Dictionary<string, object>
            {
                { "servers", new List<object> { "1.1.1.1", "8.8.8.8", "localhost" } }
            };

            JavaScriptSerializer с = new JavaScriptSerializer();
            с.MaxJsonLength = int.MaxValue;
            return с.Serialize(корень);
        }

        private static object Вход(string протокол, int порт, bool socks)
        {
            Dictionary<string, object> в = new Dictionary<string, object>
            {
                { "tag", протокол + "-in" },
                { "port", порт },
                { "listen", "127.0.0.1" },
                { "protocol", протокол },
                { "sniffing", new Dictionary<string, object>
                    {
                        { "enabled", true },
                        { "destOverride", new List<object> { "http", "tls" } }
                    }
                }
            };
            в["settings"] = socks
                ? new Dictionary<string, object> { { "auth", "noauth" }, { "udp", true } }
                : new Dictionary<string, object> { { "allowTransparent", false } };
            return в;
        }

        private static object Выход(Узел у)
        {
            Dictionary<string, object> о = new Dictionary<string, object>
            {
                { "tag", "proxy" },
                { "protocol", у.Протокол }
            };

            if (у.Протокол == "vless" || у.Протокол == "vmess")
            {
                Dictionary<string, object> человек = new Dictionary<string, object> { { "id", у.Ид } };
                if (у.Протокол == "vless")
                {
                    человек["encryption"] = "none";
                    if (!string.IsNullOrEmpty(у.Поток)) человек["flow"] = у.Поток;
                }
                else
                {
                    человек["alterId"] = у.Альтер;
                    человек["security"] = "auto";
                }
                о["settings"] = new Dictionary<string, object>
                {
                    { "vnext", new List<object>
                        {
                            new Dictionary<string, object>
                            {
                                { "address", у.Адрес }, { "port", у.Порт },
                                { "users", new List<object> { человек } }
                            }
                        }
                    }
                };
            }
            else if (у.Протокол == "trojan")
            {
                о["settings"] = new Dictionary<string, object>
                {
                    { "servers", new List<object>
                        {
                            new Dictionary<string, object>
                            { { "address", у.Адрес }, { "port", у.Порт }, { "password", у.Ид } }
                        }
                    }
                };
            }
            else // shadowsocks
            {
                о["settings"] = new Dictionary<string, object>
                {
                    { "servers", new List<object>
                        {
                            new Dictionary<string, object>
                            {
                                { "address", у.Адрес }, { "port", у.Порт },
                                { "method", у.Метод }, { "password", у.Ид }
                            }
                        }
                    }
                };
            }

            о["streamSettings"] = Поток(у);
            return о;
        }

        private static object Поток(Узел у)
        {
            Dictionary<string, object> с = new Dictionary<string, object>
            {
                { "network", string.IsNullOrEmpty(у.Сеть) ? "tcp" : у.Сеть },
                { "security", у.Защита == "none" ? "none" : у.Защита }
            };

            string имяСервера = string.IsNullOrEmpty(у.Sni) ? у.ЗаголовокХост : у.Sni;

            if (у.Защита == "tls")
            {
                Dictionary<string, object> t = new Dictionary<string, object>();
                if (!string.IsNullOrEmpty(имяСервера)) t["serverName"] = имяСервера;
                if (!string.IsNullOrEmpty(у.Отпечаток)) t["fingerprint"] = у.Отпечаток;
                if (у.БезПроверки) t["allowInsecure"] = true;
                с["tlsSettings"] = t;
            }
            else if (у.Защита == "reality")
            {
                Dictionary<string, object> r = new Dictionary<string, object>();
                if (!string.IsNullOrEmpty(имяСервера)) r["serverName"] = имяСервера;
                /* Отпечаток браузера у reality обязателен: без него ядро
                   здоровается своим почерком, и сервер закрывает связь. */
                r["fingerprint"] = string.IsNullOrEmpty(у.Отпечаток) ? "chrome" : у.Отпечаток;
                if (!string.IsNullOrEmpty(у.Ключ)) r["publicKey"] = у.Ключ;
                if (!string.IsNullOrEmpty(у.Короткий)) r["shortId"] = у.Короткий;
                if (!string.IsNullOrEmpty(у.Паук)) r["spiderX"] = у.Паук;
                с["realitySettings"] = r;
            }

            if (у.Сеть == "ws")
            {
                Dictionary<string, object> w = new Dictionary<string, object>
                { { "path", string.IsNullOrEmpty(у.Путь) ? "/" : у.Путь } };
                if (!string.IsNullOrEmpty(у.ЗаголовокХост))
                    w["headers"] = new Dictionary<string, object> { { "Host", у.ЗаголовокХост } };
                с["wsSettings"] = w;
            }
            else if (у.Сеть == "grpc")
            {
                с["grpcSettings"] = new Dictionary<string, object>
                { { "serviceName", у.Служба ?? "" } };
            }

            return с;
        }
    }
}
