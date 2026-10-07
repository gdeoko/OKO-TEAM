/* ГЛАВНОЕ ОКНО.

   Один экран и один главный орган: большая кнопка. Всё остальное
   (подписка, список, журнал) стоит вокруг неё и не спорит за внимание.
   Рамки окна нет: на семёрке родная рамка светлая и ломает тёмную
   тему, поэтому шапку рисуем сами, а окно таскаем за неё.

   Закрытие сворачивает в трей, выход только из меню значка: человек,
   закрывший окно крестиком, обычно не хотел рвать соединение. */
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace RocketVPN
{
    internal sealed class ГлавноеОкно : Form
    {
        private const int Ширина = 430;
        private const int Высота = 600;

        private readonly Настройки настройки = Настройки.Прочитать();
        private readonly Ядро ядро = new Ядро();
        private readonly List<Узел> узлы = new List<Узел>();

        private Поле полеСсылки;
        private Тихая кнопкаЗагрузить, кнопкаЗамерить, кнопкаЖурнал, кнопкаОбновить;
        private Label сообщение, статус, подробность, подписьСерверов;
        private СписокУзлов список;
        private КнопкаПуска пуск;
        private CheckBox автозапуск;
        private NotifyIcon значокТрея;
        private bool выходим;
        private bool подключены;

        public ГлавноеОкно(bool свёрнуто)
        {
            Построить();
            Загрузить();
            if (свёрнуто) { WindowState = FormWindowState.Minimized; ShowInTaskbar = false; Hide(); }
            СлушатьВторойЭкземпляр();
        }

        // ── СБОРКА ОКНА ────────────────────────────────────────────

        private void Построить()
        {
            Text = "Rocket VPN";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(Ширина, Высота);
            BackColor = Тема.Фон;
            ForeColor = Тема.Текст;
            Font = Тема.Шрифт(9f);
            AutoScaleMode = AutoScaleMode.None;
            Icon = ЗначокПрограммы();
            KeyPreview = true;

            // шапка
            Panel шапка = new Panel { Bounds = new Rectangle(0, 0, Ширина, 54), BackColor = Тема.Подложка };
            шапка.MouseDown += ТащитьОкно;
            Controls.Add(шапка);

            PictureBox знак = new PictureBox
            {
                Bounds = new Rectangle(16, 13, 28, 28),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent,
                Image = КартинкаЗнака()
            };
            знак.MouseDown += ТащитьОкно;
            шапка.Controls.Add(знак);

            Label имя = new Label
            {
                Text = "ROCKET VPN",
                Bounds = new Rectangle(54, 16, 200, 22),
                Font = Тема.Шрифт(11.5f, FontStyle.Bold),
                ForeColor = Тема.Текст,
                BackColor = Color.Transparent
            };
            имя.MouseDown += ТащитьОкно;
            шапка.Controls.Add(имя);

            шапка.Controls.Add(ЗнакОкна("–", Ширина - 72, delegate { WindowState = FormWindowState.Minimized; }));
            шапка.Controls.Add(ЗнакОкна("✕", Ширина - 38, delegate { Close(); }));

            int п = 18, ш = Ширина - п * 2;

            Controls.Add(Подпись("Ссылка подписки " + Подписка.Домен, п, 70, ш, Тема.ТекстТихо, 9f));

            полеСсылки = new Поле("https://" + Подписка.Домен + "/sub/...")
            { Bounds = new Rectangle(п, 92, ш - 108, 40) };
            полеСсылки.Текст.Width = полеСсылки.Width - 24;
            полеСсылки.Текст.KeyDown += delegate (object о, KeyEventArgs е)
            { if (е.KeyCode == Keys.Enter) { е.SuppressKeyPress = true; ЗагрузитьПодписку(); } };
            Controls.Add(полеСсылки);

            кнопкаЗагрузить = new Тихая("Загрузить")
            { Bounds = new Rectangle(п + ш - 100, 92, 100, 40) };
            кнопкаЗагрузить.Click += delegate { ЗагрузитьПодписку(); };
            Controls.Add(кнопкаЗагрузить);

            сообщение = Подпись("", п, 138, ш, Тема.ТекстОченьТихо, 8.5f);
            Controls.Add(сообщение);

            подписьСерверов = Подпись("Серверы", п, 162, 200, Тема.ТекстТихо, 9f);
            Controls.Add(подписьСерверов);

            кнопкаЗамерить = new Тихая("Замерить")
            { Bounds = new Rectangle(п + ш - 100, 160, 100, 22) };
            кнопкаЗамерить.Click += delegate { Замерить(); };
            Controls.Add(кнопкаЗамерить);

            Панель рамка = new Панель { Bounds = new Rectangle(п, 184, ш, 210) };
            Controls.Add(рамка);

            список = new СписокУзлов { Bounds = new Rectangle(1, 6, ш - 2, 198) };
            список.SelectedIndexChanged += delegate { ЗапомнитьВыбор(); };
            список.DoubleClick += delegate { if (!подключены) Подключить(); };
            рамка.Controls.Add(список);

            пуск = new КнопкаПуска { Bounds = new Rectangle(п, 410, ш, 56) };
            пуск.Click += delegate { if (подключены) Отключить(); else Подключить(); };
            Controls.Add(пуск);

            статус = Подпись("Отключено", п, 480, ш, Тема.Текст, 11f);
            статус.TextAlign = ContentAlignment.MiddleCenter;
            статус.Font = Тема.Шрифт(11f, FontStyle.Bold);
            Controls.Add(статус);

            подробность = Подпись("", п, 504, ш, Тема.ТекстОченьТихо, 8.5f);
            подробность.TextAlign = ContentAlignment.MiddleCenter;
            Controls.Add(подробность);

            автозапуск = new CheckBox
            {
                Text = "Запускать с Windows",
                Bounds = new Rectangle(п, 548, 190, 24),
                ForeColor = Тема.ТекстТихо,
                BackColor = Тема.Фон,
                FlatStyle = FlatStyle.Flat,
                Font = Тема.Шрифт(9f),
                Checked = Автозапуск.Включён
            };
            автозапуск.CheckedChanged += delegate
            {
                Автозапуск.Поставить(автозапуск.Checked);
                настройки.Автозапуск = автозапуск.Checked;
                настройки.Записать();
            };
            Controls.Add(автозапуск);

            кнопкаЖурнал = new Тихая("Журнал") { Bounds = new Rectangle(п + ш - 190, 548, 70, 24) };
            кнопкаЖурнал.Цвет = Тема.ТекстТихо;
            кнопкаЖурнал.Click += delegate { ОткрытьЖурнал(); };
            Controls.Add(кнопкаЖурнал);

            кнопкаОбновить = new Тихая("Обновления") { Bounds = new Rectangle(п + ш - 110, 548, 110, 24) };
            кнопкаОбновить.Click += delegate { ПроверитьОбновления(true); };
            Controls.Add(кнопкаОбновить);

            // значок в трее
            ContextMenuStrip меню = new ContextMenuStrip();
            меню.Items.Add("Показать", null, delegate { Показаться(); });
            меню.Items.Add("Подключить", null, delegate { if (!подключены) Подключить(); });
            меню.Items.Add("Отключить", null, delegate { if (подключены) Отключить(); });
            меню.Items.Add(new ToolStripSeparator());
            меню.Items.Add("Выход", null, delegate { выходим = true; Close(); });

            значокТрея = new NotifyIcon
            {
                Icon = ЗначокПрограммы(),
                Text = "Rocket VPN",
                Visible = true,
                ContextMenuStrip = меню
            };
            значокТрея.DoubleClick += delegate { Показаться(); };

            Журнал.Строка += delegate (string с) { /* окно журнала читает файл, здесь только эхо */ };
            ядро.Упало += delegate { ВПотоке(delegate { ЯдроУпало(); }); };
        }

        private Label Подпись(string текст, int x, int y, int ш, Color цвет, float кегль)
        {
            return new Label
            {
                Text = текст,
                Bounds = new Rectangle(x, y, ш, 20),
                ForeColor = цвет,
                BackColor = Color.Transparent,
                Font = Тема.Шрифт(кегль),
                AutoSize = false
            };
        }

        private Тихая ЗнакОкна(string подпись, int x, EventHandler что)
        {
            Тихая к = new Тихая(подпись) { Bounds = new Rectangle(x, 15, 24, 24) };
            к.Цвет = Тема.ТекстТихо;
            к.Font = Тема.Шрифт(11f);
            к.Click += что;
            return к;
        }

        /* Рамка вокруг списка. Отдельный класс нужен только ради своей
           отрисовки: панель без неё была бы прямоугольной. */
        private sealed class Панель : Panel
        {
            public Панель()
            {
                SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                         ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
                BackColor = Тема.Подложка;
            }
            protected override void OnPaint(PaintEventArgs е)
            {
                Тема.Плитой(е.Graphics, new Rectangle(0, 0, Width - 1, Height - 1), 12, Тема.Подложка, Тема.Кромка);
            }
        }

        protected override void OnPaint(PaintEventArgs е)
        {
            base.OnPaint(е);
            using (Pen перо = new Pen(Тема.Кромка))
                е.Graphics.DrawRectangle(перо, 0, 0, Width - 1, Height - 1);
        }

        // ── ДАННЫЕ ─────────────────────────────────────────────────

        private void Загрузить()
        {
            полеСсылки.Текст.Text = настройки.Ссылка ?? "";
            if (!string.IsNullOrEmpty(настройки.ПоследняяПодписка))
            {
                string почему;
                List<Узел> у = Подписка.РазобратьТело(настройки.ПоследняяПодписка, out почему);
                Показать(у, "Список от " + настройки.ПодпискаОбновлена.ToString("dd.MM HH:mm"));
            }
            if (настройки.ПроверятьОбновления)
                ThreadPool.QueueUserWorkItem(delegate { Thread.Sleep(4000); ПроверитьОбновления(false); });
        }

        private void ЗагрузитьПодписку()
        {
            string адрес = полеСсылки.Текст.Text.Trim();
            string почему;
            if (!Подписка.ДоменСвой(адрес, out почему)) { Сказать(почему, Тема.Тревога); return; }

            Сказать("Загружаем...", Тема.ТекстТихо);
            кнопкаЗагрузить.Enabled = false;

            ThreadPool.QueueUserWorkItem(delegate
            {
                string беда;
                List<Узел> найдено = Подписка.Загрузить(адрес, out беда);
                ВПотоке(delegate
                {
                    кнопкаЗагрузить.Enabled = true;
                    if (найдено.Count == 0) { Сказать(беда, Тема.Тревога); return; }

                    настройки.Ссылка = адрес;
                    настройки.ПодпискаОбновлена = DateTime.Now;
                    настройки.Записать();
                    Показать(найдено, "Серверов: " + найдено.Count);
                    Замерить();
                });
            });
        }

        private void Показать(List<Узел> найдено, string слово)
        {
            узлы.Clear();
            узлы.AddRange(найдено);
            список.BeginUpdate();
            список.Items.Clear();
            foreach (Узел у in узлы) список.Items.Add(у);
            список.EndUpdate();

            int н = узлы.FindIndex(delegate (Узел у) { return у.Подпись == настройки.ВыбранныйУзел; });
            if (н < 0 && узлы.Count > 0) н = 0;
            if (н >= 0) список.SelectedIndex = н;
            Сказать(слово, Тема.ТекстТихо);
            подписьСерверов.Text = "Серверы · " + узлы.Count;
        }

        private void Замерить()
        {
            if (узлы.Count == 0) return;
            foreach (Узел у in узлы) у.Задержка = -1;
            список.Invalidate();
            Замер.Померить(узлы, delegate { ВПотоке(delegate { список.Invalidate(); }); });
        }

        private void ЗапомнитьВыбор()
        {
            Узел у = список.SelectedItem as Узел;
            if (у == null) return;
            настройки.ВыбранныйУзел = у.Подпись;
            настройки.Записать();
        }

        // ── СОЕДИНЕНИЕ ─────────────────────────────────────────────

        private void Подключить()
        {
            Узел у = список.SelectedItem as Узел;
            if (у == null) { Сказать("Сначала загрузите подписку и выберите сервер.", Тема.Тревога); return; }
            if (!ядро.ЕстьЯдро)
            {
                Сказать("Рядом с программой нет xray.exe.", Тема.Тревога);
                return;
            }

            пуск.Состояние = КнопкаПуска.Вид.Идёт;
            статус.Text = "Подключаем";
            подробность.Text = у.Подпись;

            ThreadPool.QueueUserWorkItem(delegate
            {
                string беда = "";
                try
                {
                    ядро.Запустить(Конфиг.Собрать(у, настройки.ПортSocks, настройки.ПортHttp));
                    /* Ядру нужно мгновение, чтобы занять порт. Если за
                       полторы секунды оно упало, прокси включать нельзя:
                       иначе человек останется совсем без интернета. */
                    Thread.Sleep(1500);
                    if (!ядро.Живо) беда = "Ядро не запустилось, смотрите журнал.";
                }
                catch (Exception е) { беда = е.Message; }

                ВПотоке(delegate
                {
                    if (беда != "")
                    {
                        пуск.Состояние = КнопкаПуска.Вид.Отключено;
                        статус.Text = "Отключено";
                        Сказать(беда, Тема.Тревога);
                        return;
                    }
                    СистемныйПрокси.Включить("127.0.0.1:" + настройки.ПортHttp);
                    подключены = true;
                    пуск.Состояние = КнопкаПуска.Вид.Подключено;
                    статус.Text = "Подключено";
                    статус.ForeColor = Тема.Удача;
                    подробность.Text = у.Подпись + (у.Задержка > 0 ? "  ·  " + у.Задержка + " мс" : "");
                    значокТрея.Text = "Rocket VPN · " + у.Подпись;
                    Сказать("", Тема.ТекстТихо);
                });
            });
        }

        private void Отключить()
        {
            СистемныйПрокси.Выключить();
            ядро.Остановить();
            подключены = false;
            пуск.Состояние = КнопкаПуска.Вид.Отключено;
            статус.Text = "Отключено";
            статус.ForeColor = Тема.Текст;
            подробность.Text = "";
            значокТрея.Text = "Rocket VPN";
        }

        private void ЯдроУпало()
        {
            if (!подключены) return;
            Журнал.Писать("ядро закрылось само");
            Отключить();
            Сказать("Соединение оборвалось, ядро закрылось.", Тема.Тревога);
        }

        // ── ОБНОВЛЕНИЯ И ЖУРНАЛ ────────────────────────────────────

        private void ПроверитьОбновления(bool вслух)
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                string почему;
                СведенияОбОбновлении с = Обновление.Проверить(out почему);
                ВПотоке(delegate
                {
                    if (!Обновление.Новее(с))
                    {
                        if (вслух)
                            MessageBox.Show(почему == "" ? "У вас последняя версия." : почему,
                                "Rocket VPN", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        return;
                    }
                    DialogResult о = MessageBox.Show(
                        "Есть версия " + с.Версия.Major + "." + с.Версия.Minor + "." + с.Версия.Build +
                        ", у вас " + Обновление.Своя.Major + "." + Обновление.Своя.Minor + "." + Обновление.Своя.Build +
                        ".\n\nОбновить сейчас? Программа закроется и откроется заново.",
                        "Rocket VPN", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                    if (о != DialogResult.Yes) return;

                    string беда;
                    if (Обновление.Поставить(с, out беда)) { выходим = true; Close(); }
                    else MessageBox.Show(беда, "Rocket VPN", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                });
            });
        }

        private void ОткрытьЖурнал()
        {
            try
            {
                if (!File.Exists(Журнал.Файл)) Журнал.Писать("журнал открыт");
                System.Diagnostics.Process.Start("notepad.exe", "\"" + Журнал.Файл + "\"");
            }
            catch (Exception е) { Сказать("Журнал не открылся: " + е.Message, Тема.Тревога); }
        }

        // ── МЕЛОЧИ ─────────────────────────────────────────────────

        private void Сказать(string текст, Color цвет)
        {
            сообщение.Text = текст;
            сообщение.ForeColor = цвет;
        }

        private void ВПотоке(Action что)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { try { BeginInvoke(что); } catch { } }
            else что();
        }

        private void Показаться()
        {
            Show();
            ShowInTaskbar = true;
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void ТащитьОкно(object о, MouseEventArgs е)
        {
            if (е.Button != MouseButtons.Left) return;
            ReleaseCapture();
            SendMessage(Handle, 0xA1, 0x2, 0);   // WM_NCLBUTTONDOWN по заголовку
        }

        protected override void OnFormClosing(FormClosingEventArgs е)
        {
            if (!выходим && настройки.СворачиватьВТрей && е.CloseReason == CloseReason.UserClosing)
            {
                е.Cancel = true;
                Hide();
                ShowInTaskbar = false;
                return;
            }
            try
            {
                if (подключены) { СистемныйПрокси.Выключить(); }
                ядро.Dispose();
                значокТрея.Visible = false;
                значокТрея.Dispose();
                настройки.Записать();
            }
            catch (Exception ош) { Журнал.Писать("выход с шумом: " + ош.Message); }
            base.OnFormClosing(е);
        }

        // ── ВТОРОЙ ЭКЗЕМПЛЯР ───────────────────────────────────────

        private void СлушатьВторойЭкземпляр()
        {
            Thread т = new Thread(delegate ()
            {
                try
                {
                    using (EventWaitHandle с = new EventWaitHandle(false, EventResetMode.AutoReset, Программа.СигналПоказать))
                        while (true)
                        {
                            с.WaitOne();
                            ВПотоке(delegate { Показаться(); });
                        }
                }
                catch (Exception е) { Журнал.Писать("сигнал не слушается: " + е.Message); }
            });
            т.IsBackground = true;
            т.Start();
        }

        public static void ПозватьПервыйЭкземпляр()
        {
            try
            {
                EventWaitHandle с;
                if (EventWaitHandle.TryOpenExisting(Программа.СигналПоказать, out с)) { с.Set(); с.Dispose(); }
            }
            catch { }
        }

        // ── РЕСУРСЫ ────────────────────────────────────────────────

        private static Image КартинкаЗнака()
        {
            try
            {
                using (Stream п = Assembly.GetExecutingAssembly()
                    .GetManifestResourceStream("RocketVPN.ресурсы.знак.png"))
                    if (п != null) return Image.FromStream(п);
            }
            catch { }
            return null;
        }

        private static Icon ЗначокПрограммы()
        {
            try
            {
                using (Stream п = Assembly.GetExecutingAssembly()
                    .GetManifestResourceStream("RocketVPN.ресурсы.значок.ico"))
                    if (п != null) return new Icon(п);
            }
            catch { }
            return SystemIcons.Application;
        }

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern IntPtr SendMessage(IntPtr окно, int сообщение, int чего, int как);
    }
}
