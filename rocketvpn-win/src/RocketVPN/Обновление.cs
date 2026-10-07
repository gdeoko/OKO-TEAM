/* ОБНОВЛЕНИЕ С GITHUB.

   Сборки лежат релизами в репозитории, клиент спрашивает у гитхаба
   последний и сравнивает с собой. Качает архив, проверяет сумму,
   раскладывает поверх себя и перезапускается.

   ПОЧЕМУ ЧЕРЕЗ ПОМОЩНИКА. Заменить свой же exe работающая программа не
   может: файл занят. Поэтому пишем маленький cmd, он ждёт выхода
   программы по её номеру, копирует файлы и запускает её заново.

   СУММА ОБЯЗАТЕЛЬНА. Если в релизе лежит файл имя.zip.sha256, его
   читаем и сверяем. Нет файла сумм - ставить не будем: подменённый по
   дороге архив это чужая программа с нашим значком. */
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal sealed class СведенияОбОбновлении
    {
        public Version Версия;
        public string Заметки = "";
        public string АдресАрхива = "";
        public string АдресСуммы = "";
        public bool Есть { get { return Версия != null && АдресАрхива != ""; } }
    }

    internal static class Обновление
    {
        /* Репозиторий с релизами. Владелец и имя заданы здесь, потому что
           на них завязана подпись сборок: клиент не должен обновляться
           откуда попало. */
        public const string Владелец = "gdeoko";
        public const string Репозиторий = "rocketvpn-win";

        public static Version Своя
        {
            get { return Assembly.GetExecutingAssembly().GetName().Version; }
        }

        public static string ОписаниеВерсии()
        {
            Version в = Своя;
            return "версия " + в.Major + "." + в.Minor + "." + в.Build;
        }

        public static СведенияОбОбновлении Проверить(out string почему)
        {
            почему = "";
            СведенияОбОбновлении с = new СведенияОбОбновлении();
            try
            {
                Сеть.ВключитьСовременныйTLS();
                string адрес = "https://api.github.com/repos/" + Владелец + "/" + Репозиторий + "/releases/latest";
                string ответ;
                using (WebClient в = new WebClient())
                {
                    в.Encoding = Encoding.UTF8;
                    в.Headers.Add("User-Agent", Сеть.Представление);
                    в.Headers.Add("Accept", "application/vnd.github+json");
                    ответ = в.DownloadString(адрес);
                }

                Dictionary<string, object> д = new JavaScriptSerializer()
                    .Deserialize<Dictionary<string, object>>(ответ);
                if (д == null) { почему = "Гитхаб ответил непонятным."; return с; }

                string тег = Строка(д, "tag_name").TrimStart('v', 'V');
                Version нов;
                if (!Version.TryParse(ДополнитьДоЧетырёх(тег), out нов))
                { почему = "Непонятный номер версии: " + тег; return с; }

                с.Версия = нов;
                с.Заметки = Строка(д, "body");

                object сырые;
                if (д.TryGetValue("assets", out сырые))
                {
                    object[] список = сырые as object[];
                    if (список != null)
                    {
                        string хвост = Environment.Is64BitProcess ? "x64.zip" : "x86.zip";
                        foreach (object о in список)
                        {
                            Dictionary<string, object> а = о as Dictionary<string, object>;
                            if (а == null) continue;
                            string имя = Строка(а, "name");
                            string урл = Строка(а, "browser_download_url");
                            if (имя.EndsWith(хвост, StringComparison.OrdinalIgnoreCase)) с.АдресАрхива = урл;
                            if (имя.EndsWith(хвост + ".sha256", StringComparison.OrdinalIgnoreCase)) с.АдресСуммы = урл;
                        }
                    }
                }
                if (с.АдресАрхива == "") почему = "В релизе нет сборки под эту разрядность.";
            }
            catch (Exception е)
            {
                почему = "Проверка обновлений не прошла: " + е.Message;
            }
            return с;
        }

        public static bool Новее(СведенияОбОбновлении с)
        {
            return с != null && с.Есть && с.Версия > Своя;
        }

        /* Качает, сверяет сумму, раскладывает и перезапускает. Возвращает
           false и причину, если на любом шаге что-то не сошлось: молча
           «почти обновиться» нельзя. */
        public static bool Поставить(СведенияОбОбновлении с, out string почему)
        {
            почему = "";
            string врем = Path.Combine(Path.GetTempPath(), "RocketVPN-обновление");
            try
            {
                if (string.IsNullOrEmpty(с.АдресСуммы))
                { почему = "В релизе нет файла с контрольной суммой, установка отменена."; return false; }

                if (Directory.Exists(врем)) Directory.Delete(врем, true);
                Directory.CreateDirectory(врем);

                string архив = Path.Combine(врем, "сборка.zip");
                Сеть.ВключитьСовременныйTLS();
                using (WebClient в = new WebClient())
                {
                    в.Headers.Add("User-Agent", Сеть.Представление);
                    в.DownloadFile(с.АдресАрхива, архив);
                    string ждали = в.DownloadString(с.АдресСуммы).Trim().Split(' ')[0].ToLowerInvariant();
                    string вышло = Сумма(архив);
                    if (ждали != вышло)
                    { почему = "Сумма архива не сошлась, установка отменена."; return false; }
                }

                string распак = Path.Combine(врем, "файлы");
                ZipFile.ExtractToDirectory(архив, распак);

                /* Архив может быть с папкой внутри и без неё: берём ту
                   ветку, где лежит сам exe. */
                string откуда = File.Exists(Path.Combine(распак, "RocketVPN.exe"))
                    ? распак
                    : ПервыйУровеньСExe(распак);
                if (откуда == null) { почему = "В архиве нет RocketVPN.exe."; return false; }

                string куда = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
                string cmd = Path.Combine(врем, "обновить.cmd");
                File.WriteAllText(cmd, Сценарий(Process.GetCurrentProcess().Id, откуда, куда), Encoding.GetEncoding(866));

                Process.Start(new ProcessStartInfo
                {
                    FileName = cmd,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = true
                });
                return true;
            }
            catch (Exception е)
            {
                почему = "Обновление не поставилось: " + е.Message;
                return false;
            }
        }

        private static string ПервыйУровеньСExe(string корень)
        {
            foreach (string п in Directory.GetDirectories(корень))
                if (File.Exists(Path.Combine(п, "RocketVPN.exe"))) return п;
            return null;
        }

        private static string Сценарий(int номер, string откуда, string куда)
        {
            StringBuilder с = new StringBuilder();
            с.AppendLine("@echo off");
            с.AppendLine("chcp 866 > nul");
            с.AppendLine(":ждём");
            с.AppendLine("tasklist /fi \"PID eq " + номер + "\" | find \"" + номер + "\" > nul");
            с.AppendLine("if not errorlevel 1 ( ping -n 2 127.0.0.1 > nul & goto ждём )");
            с.AppendLine("xcopy \"" + откуда + "\\*\" \"" + куда + "\\\" /e /y /i > nul");
            с.AppendLine("start \"\" \"" + Path.Combine(куда, "RocketVPN.exe") + "\"");
            с.AppendLine("rmdir /s /q \"" + Path.GetDirectoryName(откуда) + "\"");
            return с.ToString();
        }

        private static string Сумма(string файл)
        {
            using (SHA256 х = SHA256.Create())
            using (FileStream ф = File.OpenRead(файл))
                return BitConverter.ToString(х.ComputeHash(ф)).Replace("-", "").ToLowerInvariant();
        }

        private static string ДополнитьДоЧетырёх(string тег)
        {
            string[] ч = тег.Split('.');
            if (ч.Length == 1) return тег + ".0.0";
            if (ч.Length == 2) return тег + ".0";
            return тег;
        }

        private static string Строка(Dictionary<string, object> д, string ключ)
        {
            object з;
            if (д != null && д.TryGetValue(ключ, out з) && з != null) return з.ToString();
            return "";
        }
    }
}
