/* ЯДРО: запуск и остановка Xray.

   Ядро лежит рядом с программой (xray.exe), конфиг пишется в данные
   пользователя. Окна у процесса нет, вывод забираем себе в журнал:
   без него разбор чужой поломки превращается в гадание.

   ЧУЖИЕ ЯДРА НЕ ТРОГАЕМ. Перед запуском снимаем только те процессы
   xray, которые запущены из НАШЕЙ папки. На машине может стоять
   v2rayN или свой ярлык, и убивать чужое соединение мы не имеем права.

   ХВОСТ НЕ ОСТАЁТСЯ. Если программу закрыли через диспетчер задач,
   ядро осталось бы жить и держать порт. Поэтому процесс привязан к
   объекту задания Windows: падает программа - система сама снимает
   ядро. На семёрке объекты заданий есть начиная с XP, работает. */
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace RocketVPN
{
    internal sealed class Ядро : IDisposable
    {
        private Process процесс;
        private IntPtr задание = IntPtr.Zero;
        private readonly string папка;

        public event Action<string> Сказал;
        public event Action Упало;

        public Ядро()
        {
            папка = AppDomain.CurrentDomain.BaseDirectory;
            СоздатьЗадание();
        }

        public string ФайлЯдра { get { return Path.Combine(папка, "xray.exe"); } }
        public string ФайлКонфига { get { return Path.Combine(Настройки.ПапкаДанных, "конфиг.json"); } }

        public bool Живо
        {
            get { return процесс != null && !процесс.HasExited; }
        }

        public bool ЕстьЯдро { get { return File.Exists(ФайлЯдра); } }

        public void Запустить(string конфигJson)
        {
            Остановить();
            if (!ЕстьЯдро)
                throw new FileNotFoundException("Рядом с программой нет xray.exe. Переустановите клиент целиком.");

            File.WriteAllText(ФайлКонфига, конфигJson, new UTF8Encoding(false));
            СнятьСвоиСтарые();

            ProcessStartInfo з = new ProcessStartInfo
            {
                FileName = ФайлЯдра,
                Arguments = "run -c \"" + ФайлКонфига + "\"",
                WorkingDirectory = папка,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            /* Базы geoip и geosite ядро ищет рядом с собой, но при
               запуске из другой папки теряет. Говорим прямо. */
            з.EnvironmentVariables["XRAY_LOCATION_ASSET"] = папка;

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
            foreach (Process п in Process.GetProcessesByName("xray"))
            {
                try
                {
                    string путь = п.MainModule != null ? п.MainModule.FileName : "";
                    if (!string.IsNullOrEmpty(путь) &&
                        путь.StartsWith(папка, StringComparison.OrdinalIgnoreCase))
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
