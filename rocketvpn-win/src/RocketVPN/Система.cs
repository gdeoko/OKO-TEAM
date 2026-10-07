/* СИСТЕМНЫЙ ПРОКСИ И АВТОЗАПУСК.

   ПОЧЕМУ ПРОКСИ, А НЕ ТУННЕЛЬ. Полный туннель на весь компьютер требует
   драйвера сетевого адаптера. Нынешний Wintun подписан по правилам
   Windows 10, и на семёрке такая подпись не принимается: драйвер просто
   не встанет, а человек увидит «не работает» без объяснений. Поэтому
   первая версия ведёт трафик системным прокси - его понимают браузеры,
   Телеграм, почта и всё, что уважает настройки Windows. Драйвера нет,
   прав администратора не нужно.

   ВОЗВРАТ ОБЯЗАТЕЛЕН. Прежние настройки прокси запоминаются и
   возвращаются при отключении и при выходе. Оставить за собой чужой
   прокси значит оставить человека без интернета после закрытия
   программы, и он не поймёт, почему. */
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace RocketVPN
{
    internal static class СистемныйПрокси
    {
        private const string Ветка = @"Software\Microsoft\Windows\CurrentVersion\Internet Settings";
        private const string Обход = "<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*";

        private static bool былВключён;
        private static string былСервер = "";
        private static string былОбход = "";
        private static bool запомнили;

        public static bool Включён
        {
            get
            {
                try
                {
                    using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, false))
                    {
                        if (к == null) return false;
                        object з = к.GetValue("ProxyEnable");
                        return з != null && Convert.ToInt32(з) == 1;
                    }
                }
                catch { return false; }
            }
        }

        public static void Включить(string адресПорт)
        {
            Запомнить();
            try
            {
                using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, true))
                {
                    if (к == null) return;
                    к.SetValue("ProxyEnable", 1, RegistryValueKind.DWord);
                    к.SetValue("ProxyServer", адресПорт, RegistryValueKind.String);
                    к.SetValue("ProxyOverride", Обход, RegistryValueKind.String);
                }
                Освежить();
                Журнал.Писать("системный прокси включён: " + адресПорт);
            }
            catch (Exception е) { Журнал.Писать("прокси не включился: " + е.Message); }
        }

        public static void Выключить()
        {
            try
            {
                using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, true))
                {
                    if (к == null) return;
                    if (запомнили)
                    {
                        к.SetValue("ProxyEnable", былВключён ? 1 : 0, RegistryValueKind.DWord);
                        if (!string.IsNullOrEmpty(былСервер)) к.SetValue("ProxyServer", былСервер, RegistryValueKind.String);
                        if (!string.IsNullOrEmpty(былОбход)) к.SetValue("ProxyOverride", былОбход, RegistryValueKind.String);
                    }
                    else
                    {
                        к.SetValue("ProxyEnable", 0, RegistryValueKind.DWord);
                    }
                }
                Освежить();
                Журнал.Писать("системный прокси возвращён как было");
            }
            catch (Exception е) { Журнал.Писать("прокси не вернулся: " + е.Message); }
        }

        private static void Запомнить()
        {
            if (запомнили) return;
            try
            {
                using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, false))
                {
                    if (к != null)
                    {
                        object в = к.GetValue("ProxyEnable");
                        былВключён = в != null && Convert.ToInt32(в) == 1;
                        былСервер = (к.GetValue("ProxyServer") as string) ?? "";
                        былОбход = (к.GetValue("ProxyOverride") as string) ?? "";
                    }
                }
                запомнили = true;
            }
            catch (Exception е) { Журнал.Писать("прежний прокси не прочитался: " + е.Message); }
        }

        /* Одной записи в реестр мало: уже запущенные программы читают
           настройки из своей памяти и узнают о смене только по этим двум
           сигналам. Без них браузер продолжает ходить мимо прокси. */
        private static void Освежить()
        {
            try
            {
                InternetSetOption(IntPtr.Zero, 39, IntPtr.Zero, 0);   // SETTINGS_CHANGED
                InternetSetOption(IntPtr.Zero, 37, IntPtr.Zero, 0);   // REFRESH
            }
            catch { }
        }

        [DllImport("wininet.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern bool InternetSetOption(IntPtr дескриптор, int параметр, IntPtr буфер, int длина);
    }

    /* Автозапуск через ветку Run текущего пользователя. Планировщик
       заданий дал бы запуск с правами администратора, но нам они не
       нужны, а на семёрке планировщик у части сборок отключён вовсе. */
    internal static class Автозапуск
    {
        private const string Ветка = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string Имя = "RocketVPN";

        public static bool Включён
        {
            get
            {
                try
                {
                    using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, false))
                        return к != null && к.GetValue(Имя) != null;
                }
                catch { return false; }
            }
        }

        public static void Поставить(bool надо)
        {
            try
            {
                using (RegistryKey к = Registry.CurrentUser.OpenSubKey(Ветка, true))
                {
                    if (к == null) return;
                    if (надо)
                    {
                        string путь = System.Reflection.Assembly.GetExecutingAssembly().Location;
                        к.SetValue(Имя, "\"" + путь + "\" --свёрнуто", RegistryValueKind.String);
                    }
                    else if (к.GetValue(Имя) != null)
                    {
                        к.DeleteValue(Имя, false);
                    }
                }
                Журнал.Писать("автозапуск " + (надо ? "включён" : "выключен"));
            }
            catch (Exception е) { Журнал.Писать("автозапуск не записался: " + е.Message); }
        }
    }
}
