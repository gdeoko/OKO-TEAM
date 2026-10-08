/* УЗЕЛ: один сервер из подписки.

   Поля собраны так, чтобы из них собиралась исходящая часть конфига
   Xray без догадок. Чего в ссылке не было, то остаётся пустым, и
   сборщик конфига такие ключи просто не пишет. */
using System;

namespace RocketVPN
{
    internal sealed class Узел
    {
        public string Имя = "";
        public string Протокол = "vless";     // vless | vmess | trojan | shadowsocks
        public string Адрес = "";
        public int Порт;

        public string Ид = "";                 // uuid у vless/vmess, пароль у trojan/ss
        public string Метод = "";              // шифр у shadowsocks
        public int Альтер;                     // alterId у старого vmess
        public string Поток = "";              // flow, xtls-rprx-vision

        public string Защита = "none";         // none | tls | reality
        public string Sni = "";
        public string Отпечаток = "";          // fingerprint браузера
        public string Ключ = "";               // publicKey у reality
        public string Короткий = "";           // shortId у reality
        public string Паук = "";               // spiderX у reality
        public bool БезПроверки;               // allowInsecure

        public string Сеть = "tcp";            // tcp | ws | grpc | http
        public string Путь = "";
        public string ЗаголовокХост = "";
        public string Служба = "";             // serviceName у grpc

        public string Ссылка = "";             // исходная строка, для журнала
        public int Задержка = -1;              // мс, -1 пока не мерили, -2 не ответил

        public string Подпись
        {
            get { return string.IsNullOrEmpty(Имя) ? (Адрес + ":" + Порт) : Имя; }
        }

        public override string ToString() { return Подпись; }
    }
}
