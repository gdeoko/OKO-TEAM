/* ЯДРО: запуск и остановка Xray.

   ОДИН ФАЙЛ ВМЕСТО ПАПКИ. Слово владельца: «одна кнопка, чисто перейти
   нажать». Поэтому ядро, базы адресов и сама программа едут одним exe:
   архив с ними вшит внутрь и раскладывается при первом запуске в папку
   пользователя. Человеку не надо ничего распаковывать и некуда терять
   соседние файлы - причина половины обращений в поддержку у таких
   клиентов ровно эта.

   Разрядность выбирается на месте: внутри лежат оба ядра, и на
   64-битной Windows берётся 64-битное. Одно ядро на все случаи было бы
   меньше по весу, но 32-битное на современной машине заметно медленнее
   на шифровании, а это и есть скорость интернета у человека.

   Рядом лежащий xray.exe всё равно имеет приоритет: так ядро можно
   подменить руками, не пересобирая программу.

   ЧУЖИЕ ЯДРА НЕ ТРОГАЕМ. Перед запуском снимаем только те процессы
   xray, которые запущены из НАШЕЙ папки. На машине может стоять
   v2rayN со своим, и убивать чужое соединение мы не имеем права.

   ХВОСТ НЕ ОСТАЁТСЯ. Если программу закрыли через диспетчер задач,
   ядро осталось бы жить и держать порт. Поэтому процесс привязан к
   объекту задания Windows: падает программа - система сама снимает
   ядро. */
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

namespace RocketVPN
{
    internal sealed class Ядро : IDisposable
    {
        private Process процесс;
        private IntPtr задание = IntPtr.Zero;
        private readonly string рядом;
        private string папкаЯдра;

        public event Action<string> Сказал;
        public event Action Упало;

        public Ядро()
        {
            рядом = AppDomain.CurrentDomain.BaseDirectory;
            СоздатьЗадание();
        }

        public string ФайлКонфига { get { return Path.Combine(Настройки.ПапкаДанных, "конфиг.json"); } }

        /* Где лежит ядро: сначала смотрим рядом с программой, потом
           раскладываем вшитое. Разложенное живёт в данных пользователя:
           в Program Files обычному человеку не писать. */
        public string ФайлЯдра
        {
            get
            {
                string свой = Path.Combine(рядом, "xray.exe");
                if (File.Exists(свой)) { папкаЯдра = рядом; return свой; }
                if (папкаЯдра != null)
                {
                    string г = Path.Combine(папкаЯдра, "xray.exe");
                    if (File.Exists(г)) return г;
                }
                return Разложить();
            }
        }

        public string ПапкаБаз
        {
            get { return папкаЯдра ?? рядом; }
        }

        public bool Живо { get { return процесс != null && !процесс.HasExited; } }

        public bool ЕстьЯдро
        {
            get { try { return File.Exists(ФайлЯдра); } catch { return false; } }
        }

        /* Раскладка вшитого архива. Делается один раз: папка названа по
           версии программы, и при обновлении появляется новая, а старая
           остаётся нетронутой на случай отката. */
        private string Разложить()
        {
            string куда = Path.Combine(Настройки.ПапкаДанных, "ядро",
                Assembly.GetExecutingAssembly().GetName().Version.ToString());
            string ядро = Path.Combine(куда, "xray.exe");
            string база = Path.Combine(куда, "geoip.dat");

            if (File.Exists(ядро) && File.Exists(база)) { папкаЯдра = куда; return ядро; }

            using (Stream вшито = Assembly.GetExecutingAssembly()
                .GetManifestResourceStream("RocketVPN.ядро.zip"))
            {
                if (вшито == null)
                    throw new FileNotFoundException(
                        "В программе нет ядра, и рядом с ней его тоже нет. Скачайте программу заново.");

                Directory.CreateDirectory(куда);
                string своя = Environment.Is64BitOperatingSystem ? "x64/" : "x86/";
                Журнал.Писать("раскладываем ядро " + своя.TrimEnd('/') + " в " + куда);

                using (ZipArchive архив = new ZipArchive(вшито, ZipArchiveMode.Read))
                    foreach (ZipArchiveEntry запись in архив.Entries)
                    {
                        if (запись.Length == 0) continue;
                        string имя;
                        if (запись.FullName.StartsWith(своя, StringComparison.OrdinalIgnoreCase))
                            имя = запись.Name;                       // ядро своей разрядности
                        else if (запись.FullName.IndexOf('/') < 0)
                            имя = запись.Name;                       // базы адресов
                        else
                            continue;                                // чужая разрядность
                        /* Пишем во временный файл и переименовываем:
                           брошенная на полпути распаковка оставила бы
                           обрезанный exe, который потом молча не
                           запускается. */
                        string цель = Path.Combine(куда, имя);
                        string врем = цель + ".часть";
                        using (Stream из = запись.Open())
                        using (FileStream в = File.Create(врем))
                            из.CopyTo(в);
                        if (File.Exists(цель)) File.Delete(цель);
                        File.Move(врем, цель);
                    }
            }

            if (!File.Exists(ядро))
                throw new FileNotFoundException("Ядро не разложилось в " + куда);
            папкаЯдра = куда;
            return ядро;
        }

        public void Запустить(string конфигJson)
        {
            Остановить();
            string ядро = ФайлЯдра;

            File.WriteAllText(ФайлКонфига, конфигJson, new UTF8Encoding(false));
            СнятьСвоиСтарые();

            ProcessStartInfo з = new ProcessStartInfo
            {
                FileName = ядро,
                Arguments = "run -c \"" + ФайлКонфига + "\"",
                WorkingDirectory = ПапкаБаз,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            /* Базы geoip и geosite ядро ищет рядом с собой, но при
               запуске из другой папки теряет. Говорим прямо. */
            з.EnvironmentVariables["XRAY_LOCATION_ASSET"] = ПапкаБаз;

            процесс = new Process { StartInfo = з, EnableRaisingEvents = true };
            процесс.OutputDataReceived += Вывод;
            процесс.ErrorDataReceived += Вывод;
            процесс.Exited += delegate
            {
                Action у = Упало;
                if (у != null) у();
            };
            процесс.Start();
            процесс.BeginOutputReadLine();
            процесс.BeginErrorReadLine();
            ПривязатьКЗаданию(процесс);
            Журнал.Писать("ядро запущено, pid " + процесс.Id);
        }

        private void Вывод(object о, DataReceivedEventArgs е)
        {
            if (string.IsNullOrEmpty(е.Data)) return;
            Журнал.Писать("ядро: " + е.Data);
            Action<string> с = Сказал;
            if (с != null) с(е.Data);
        }

        public void Остановить()
        {
            try
            {
                if (процесс != null)
                {
                    /* Снимаем подписку на «процесс закончился» ДО того,
                       как убить его: иначе наша же остановка прилетает
                       в обработчик обрыва, и клиент начинает
                       переподключаться там, где его просто выключили
                       или сменили сервер. */
                    процесс.EnableRaisingEvents = false;
                    if (!процесс.HasExited)
                    {
                        процесс.Kill();
                        процесс.WaitForExit(3000);
                    }
                    процесс.Dispose();
                    Журнал.Писать("ядро остановлено");
                }
            }
            catch (Exception е) { Журнал.Писать("ядро не остановилось: " + е.Message); }
            процесс = null;
        }

        private void СнятьСвоиСтарые()
        {
            string наше = ПапкаБаз;
            foreach (Process п in Process.GetProcessesByName("xray"))
            {
                try
                {
                    string путь = п.MainModule != null ? п.MainModule.FileName : "";
                    if (!string.IsNullOrEmpty(путь) &&
                        путь.StartsWith(наше, StringComparison.OrdinalIgnoreCase))
                    {
                        п.Kill();
                        п.WaitForExit(2000);
                        Журнал.Писать("снято прежнее ядро, pid " + п.Id);
                    }
                }
                catch { /* чужой процесс или нет прав - проходим мимо */ }
                finally { п.Dispose(); }
            }
        }

        public void Dispose() { Остановить(); ЗакрытьЗадание(); }

        // ── объект задания Windows ──────────────────────────────────

        private void СоздатьЗадание()
        {
            try
            {
                задание = CreateJobObject(IntPtr.Zero, null);
                if (задание == IntPtr.Zero) return;

                ОсновныеСведения осн = new ОсновныеСведения();
                осн.ФлагиОграничений = 0x2000;   // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                РасширенныеСведения расш = new РасширенныеСведения();
                расш.Основные = осн;

                int размер = Marshal.SizeOf(typeof(РасширенныеСведения));
                IntPtr буфер = Marshal.AllocHGlobal(размер);
                try
                {
                    Marshal.StructureToPtr(расш, буфер, false);
                    SetInformationJobObject(задание, 9, буфер, (uint)размер);
                }
                finally { Marshal.FreeHGlobal(буфер); }
            }
            catch (Exception е) { Журнал.Писать("задание не создалось: " + е.Message); }
        }

        private void ПривязатьКЗаданию(Process п)
        {
            try
            {
                if (задание != IntPtr.Zero) AssignProcessToJobObject(задание, п.Handle);
            }
            catch (Exception е) { Журнал.Писать("ядро не привязалось к заданию: " + е.Message); }
        }

        private void ЗакрытьЗадание()
        {
            try { if (задание != IntPtr.Zero) { CloseHandle(задание); задание = IntPtr.Zero; } }
            catch { }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct ОсновныеСведения
        {
            public long ПределПроцессора;
            public long ПределЗадания;
            public uint ФлагиОграничений;
            public UIntPtr МинимумПамяти;
            public UIntPtr МаксимумПамяти;
            public uint Активных;
            public UIntPtr Маска;
            public uint Приоритет;
            public uint Класс;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct Ввод
        {
            public ulong ЧтениеОпераций, ЗаписьОпераций, ПрочиеОперации;
            public ulong ЧтениеБайт, ЗаписьБайт, ПрочиеБайты;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct РасширенныеСведения
        {
            public ОсновныеСведения Основные;
            public Ввод Счётчики;
            public UIntPtr ПамятьПроцесса;
            public UIntPtr ПамятьЗадания;
            public UIntPtr ПикПроцесса;
            public UIntPtr ПикЗадания;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr защита, string имя);

        [DllImport("kernel32.dll")]
        private static extern bool SetInformationJobObject(IntPtr задание, int класс, IntPtr сведения, uint длина);

        [DllImport("kernel32.dll")]
        private static extern bool AssignProcessToJobObject(IntPtr задание, IntPtr процесс);

        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr ручка);
    }
}
