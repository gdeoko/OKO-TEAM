/* СЕТЬ: две вещи, без которых клиент на семёрке слеп.

   TLS. Windows 7 по умолчанию здоровается по TLS 1.0, а сервера его уже
   не слушают: и подписка, и гитхаб отвечают обрывом связи. .NET 4.8
   умеет 1.2 и 1.3, но берёт их только если попросить. Просим один раз на
   весь процесс. 1.3 включаем числом (3072 это Tls12, 12288 это Tls13):
   на семёрке такого значения в перечислении нет вовсе, и обращение к
   нему по имени уронило бы программу при запуске.

   Представление. Многие панели отдают подписку по-разному в зависимости
   от того, кто спрашивает, а совсем без имени клиента часть из них
   отвечает отказом. */
using System;
using System.Net;

namespace RocketVPN
{
    internal static class Сеть
    {
        public const string Представление = "RocketVPN-Windows/1.0";
        private static bool сделано;

        public static void ВключитьСовременныйTLS()
        {
            if (сделано) return;
            сделано = true;
            try
            {
                SecurityProtocolType нужно = (SecurityProtocolType)3072;   // Tls12
                try { нужно |= (SecurityProtocolType)12288; } catch { }    // Tls13, если система знает
                ServicePointManager.SecurityProtocol = нужно;
                ServicePointManager.DefaultConnectionLimit = 16;
                ServicePointManager.Expect100Continue = false;
            }
            catch (Exception е)
            {
                Журнал.Писать("TLS не настроился: " + е.Message);
            }
        }
    }
}
