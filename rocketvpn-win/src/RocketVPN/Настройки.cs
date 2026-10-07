/* НАСТРОЙКИ И ЖУРНАЛ.

   Оба лежат в %APPDATA%\RocketVPN. Рядом с программой их держать
   нельзя: клиент часто ставят в Program Files, а туда обычному
   пользователю не писать. */
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace RocketVPN
{
    internal sealed class Настройки
    {
        public string Ссылка = "";
        public string ВыбранныйУзел = "";
        public bool Автозапуск = false;
        public bool ПроверятьОбновления = true;
        public bool СворачиватьВТрей = true;
        public int ПортHttp = 10809;
        public int ПортSocks = 10808;
        public string ПоследняяПодписка = "";   // сырой ответ, чтобы жить без сети
        public DateTime ПодпискаОбновлена = DateTime.MinValue;

        private static string Папка
        {
            get
            {
                string п = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "RocketVPN");
                Directory.CreateDirectory(п);
                return п;
            }
        }

        public static string ПапкаДанных { get { return Папка; } }
        private static string Файл { get { return Path.Combine(Папка, "настройки.json"); } }

        public static Настройки Прочитать()
        {
            try
            {
                if (File.Exists(Файл))
                {
                    string т = File.ReadAllText(Файл, Encoding.UTF8);
                    Настройки н = new JavaScriptSerializer().Deserialize<Настройки>(т);
                    if (н != null) return н;
                }
            }
            catch (Exception е) { Журнал.Писать("настройки не прочитались: " + е.Message); }
            return new Настройки();
        }

        public void Записать()
        {
            try
            {
                JavaScriptSerializer с = new JavaScriptSerializer();
                File.WriteAllText(Файл, с.Serialize(this), Encoding.UTF8);
            }
            catch (Exception е) { Журнал.Писать("настройки не записались: " + е.Message); }
        }
    }

    /* Журнал пишется и в файл, и в окно. В файл - потому что разбирать
       чужую машину по телефону иначе нечем: человек пришлёт файл. */
    internal static class Журнал
    {
        public static event Action<string> Строка;
        private static readonly object Замок = new object();
        private static readonly List<string> Память = new List<string>();

        public static string Файл
        {
            get { return Path.Combine(Настройки.ПапкаДанных, "журнал.txt"); }
        }

        public static void Писать(string текст)
        {
            string с = DateTime.Now.ToString("HH:mm:ss") + "  " + текст;
            lock (Замок)
            {
                Память.Add(с);
                if (Память.Count > 500) Память.RemoveRange(0, 200);
                try
                {
                    /* Файл режем на подступах к мегабайту: клиент стоит
                       месяцами, и журнал однажды съел бы диск. */
                    FileInfo ф = new FileInfo(Файл);
                    if (ф.Exists && ф.Length > 1024 * 1024) File.WriteAllText(Файл, "", Encoding.UTF8);
                    File.AppendAllText(Файл, с + Environment.NewLine, Encoding.UTF8);
                }
                catch { }
            }
            Action<string> п = Строка;
            if (п != null) { try { п(с); } catch { } }
        }

        public static string[] Всё()
        {
            lock (Замок) { return Память.ToArray(); }
        }
    }
}
