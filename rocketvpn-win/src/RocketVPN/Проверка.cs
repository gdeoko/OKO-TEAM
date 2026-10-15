/* ПРОВЕРКА СОЕДИНЕНИЯ.

   Подключились и увидели «Подключено» - это ещё не значит, что трафик
   пошёл. Ядро может подняться, занять порт и молча не достучаться до
   сервера: человек будет сидеть с надписью «Подключено» и без
   интернета. Поэтому после подключения спрашиваем у внешней службы наш
   же адрес, и спрашиваем ЧЕРЕЗ наш прокси. Ответ с чужой страной и
   есть доказательство, что туннель работает.

   Служб две: если первая молчит, спрашиваем вторую. Обе отдают короткий
   json и не требуют ключей. */
using System;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal sealed class Проверка
    {
        public bool Прошла;
        public string Адрес = "";
        public string Страна = "";
        public string Беда = "";

        public string Коротко
        {
            get
            {
                if (!Прошла) return Беда;
                return string.IsNullOrEmpty(Страна) ? Адрес : (Адрес + "  ·  " + Страна);
            }
        }
    }

    internal static class Проверяльщик
    {
        private static readonly string[] Службы =
        {
            "https://ipinfo.io/json",
            "http://ip-api.com/json/?fields=query,countryCode"
        };

        public static Проверка Проверить(int портHttp)
        {
            Проверка п = new Проверка();
            Сеть.ВключитьСовременныйTLS();

            foreach (string служба in Службы)
            {
                try
                {
                    using (Гонец в = new Гонец(6000))
                    {
                        в.Encoding = Encoding.UTF8;
                        в.Headers.Add("User-Agent", Сеть.Представление);
                        в.Proxy = new WebProxy("127.0.0.1", портHttp);
                        string ответ = в.DownloadString(служба);

                        var д = new JavaScriptSerializer().Deserialize<System.Collections.Generic.Dictionary<string, object>>(ответ);
                        if (д == null) continue;
                        п.Адрес = Слово(д, "ip");
                        if (п.Адрес == "") п.Адрес = Слово(д, "query");
                        п.Страна = Слово(д, "country");
                        if (п.Страна == "") п.Страна = Слово(д, "countryCode");
                        if (п.Адрес != "") { п.Прошла = true; return п; }
                    }
                }
                catch (Exception е)
                {
                    п.Беда = "Соединение не проверилось: " + е.Message;
                    Журнал.Писать("проверка через " + служба + ": " + е.Message);
                }
            }
            if (п.Беда == "") п.Беда = "Соединение не проверилось.";
            return п;
        }

        private static string Слово(System.Collections.Generic.Dictionary<string, object> д, string ключ)
        {
            object з;
            if (д != null && д.TryGetValue(ключ, out з) && з != null) return з.ToString();
            return "";
        }

        /* WebClient без своего срока ожидания висит минуту с лишним.
           Человеку столько ждать незачем: не ответили за шесть секунд,
           значит не ответили. */
        private sealed class Гонец : WebClient
        {
            private readonly int срок;
            public Гонец(int мс) { срок = мс; }

            protected override WebRequest GetWebRequest(Uri адрес)
            {
                WebRequest з = base.GetWebRequest(адрес);
                if (з != null) з.Timeout = срок;
                return з;
            }
        }
    }
}
