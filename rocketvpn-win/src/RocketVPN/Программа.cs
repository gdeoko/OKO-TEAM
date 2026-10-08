/* ТОЧКА ВХОДА.

   Один экземпляр на пользователя: два запущенных клиента подрались бы
   за один порт и за системный прокси. Второй запуск просто показывает
   окно первого.

   Ключ --свёрнуто ставит автозапуск: при входе в Windows клиент
   поднимается в трей, не выпрыгивая окном поверх рабочего стола. */
using System;
using System.Threading;
using System.Windows.Forms;

namespace RocketVPN
{
    internal static class Программа
    {
        private static Mutex замок;
        public const string СигналПоказать = "RocketVPN-показать-окно";

        [STAThread]
        private static void Main(string[] доводы)
        {
            bool первый;
            замок = new Mutex(true, "RocketVPN-один-экземпляр", out первый);
            if (!первый)
            {
                ГлавноеОкно.ПозватьПервыйЭкземпляр();
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.ThreadException += delegate (object о, ThreadExceptionEventArgs е)
            {
                Журнал.Писать("сбой: " + е.Exception);
                MessageBox.Show("Что-то пошло не так: " + е.Exception.Message +
                    "\n\nПодробности в журнале:\n" + Журнал.Файл,
                    "Rocket VPN", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            };
            AppDomain.CurrentDomain.UnhandledException += delegate (object о, UnhandledExceptionEventArgs е)
            {
                Журнал.Писать("сбой вне потока: " + е.ExceptionObject);
            };

            bool свёрнуто = false;
            foreach (string д in доводы)
                if (д == "--свёрнуто" || д == "/свёрнуто" || д == "-m") свёрнуто = true;

            Журнал.Писать("запуск, версия " + Обновление.Своя);
            Application.Run(new ГлавноеОкно(свёрнуто));
            GC.KeepAlive(замок);
        }
    }
}
