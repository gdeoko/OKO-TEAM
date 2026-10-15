/* ГЛАВНОЕ ОКНО.

   Один экран и один главный орган: большая кнопка. Всё остальное
   (подписка, список, настройки) стоит вокруг неё и не спорит за
   внимание. Рамки окна нет: на семёрке родная рамка светлая и ломает
   тёмную тему, поэтому шапку рисуем сами, а окно таскаем за неё.

   Закрытие сворачивает в трей, выход только из меню значка: человек,
   закрывший окно крестиком, обычно не хотел рвать соединение.

   Настройки лежат вторым слоем поверх списка, а не в отдельном окне:
   второе окно на такой маленькой программе теряется за главным. */
using System;
using System.Collections.Generic;
using System.Drawing;
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
        private const int Поля = 18;

        private readonly Настройки настройки = Настройки.Прочитать();
        private readonly Ядро ядро = new Ядро();
        private readonly List<Узел> узлы = new List<Узел>();

        private Поле полеСсылки;
        private Тихая кнопкаЗагрузить, кнопкаЗамерить, кнопкаБыстрый;
        private Тихая кнопкаЖурнал, кнопкаОбновить, кнопкаНастройки, кнопкаНазад;
        private Label сообщение, статус, подробность, подписьСерверов;
        private СписокУзлов список;
        private КнопкаПуска пуск;
        private CheckBox автозапуск;
        private Panel слойНастроек;
        private NotifyIcon значокТрея;
        private ToolStripMenuItem пунктСерверы;

        private bool выходим, подключены, идётПодключение;
        private int попытокПодряд;
        /* Номер попытки подключения. Пока ядро поднимается в фоне,
           человек успевает нажать «Отключить» или выбрать другой
           сервер: опоздавший поток не имеет права включить прокси и
           написать «Подключено» поверх уже отменённого. */
        private int поколение;
        private Узел текущий;

        public ГлавноеОкно(bool свёрнуто)
        {
            Тема.ИзмеритьЭкран();
            /* Экран берём тот, где стоит указатель: на двух мониторах
               с разным масштабом окно откроется на том, куда смотрит
               человек, а не на том, который система считает главным. */
            Тема.Вместить(Ширина, Высота, РабочаяОбласть());
            Построить();
            ПоднятьСохранённое();
            if (свёрнуто) { WindowState = FormWindowState.Minimized; ShowInTaskbar = false; Hide(); }
            СлушатьВторойЭкземпляр();
        }

        // ── СБОРКА ОКНА ────────────────────────────────────────────

        private void Построить()
        {
            Text = "Rocket VPN";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(М(Ширина), М(Высота));
            BackColor = Тема.Фон;
            ForeColor = Тема.Текст;
            Font = Тема.Шрифт(9f);
            AutoScaleMode = AutoScaleMode.None;
            Icon = ЗначокПрограммы();

            Шапка();
            Тело();
            СлойНастроек();
            Трей();
            ПодогнатьНадписи();
            Shown += delegate { ВпихнутьВЭкран(); };

            ядро.Упало += delegate { ВПотоке(ЯдроУпало); };
        }

        /* Надписи кнопок меряются по тексту уже на собранном окне:
           до показа шрифт уже известен, а обрезать слово нельзя. */
        private void ПодогнатьНадписи()
        {
            int край = М(Ширина) - М(Поля);
            кнопкаЗагрузить.ПоТексту(край);
            кнопкаЗамерить.ПоТексту(край);
            кнопкаБыстрый.ПоТексту(кнопкаЗамерить.Left - М(8));
            кнопкаОбновить.ПоТексту(край);
            кнопкаЖурнал.ПоТексту(кнопкаОбновить.Left - М(10));
            кнопкаНазад.ПоТексту(край);
        }

        private void Шапка()
        {
            Panel шапка = new Panel { Bounds = new Rectangle(0, 0, М(Ширина), М(54)), BackColor = Тема.Подложка };
            шапка.MouseDown += ТащитьОкно;
            Controls.Add(шапка);

            PictureBox знак = new PictureBox
            {
                Bounds = new Rectangle(М(16), М(13), М(28), М(28)),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent,
                Image = КартинкаЗнака()
            };
            знак.MouseDown += ТащитьОкно;
            шапка.Controls.Add(знак);

            Label имя = new Label
            {
                Text = "ROCKET VPN",
                Bounds = new Rectangle(М(54), М(16), М(180), М(22)),
                Font = Тема.Шрифт(11.5f, FontStyle.Bold),
                ForeColor = Тема.Текст,
                BackColor = Color.Transparent
            };
            имя.MouseDown += ТащитьОкно;
            шапка.Controls.Add(имя);

            кнопкаНастройки = ЗнакОкна("⚙", Ширина - 106, delegate { ПоказатьНастройки(true); });
            шапка.Controls.Add(кнопкаНастройки);
            шапка.Controls.Add(ЗнакОкна("–", Ширина - 72, delegate { WindowState = FormWindowState.Minimized; }));
            шапка.Controls.Add(ЗнакОкна("✕", Ширина - 38, delegate { Close(); }));
        }

        private void Тело()
        {
            int ш = Ширина - Поля * 2;

            Controls.Add(Подпись("Ссылка подписки " + Подписка.Домен, Поля, 70, ш, Тема.ТекстТихо, 9f));

            полеСсылки = new Поле("https://" + Подписка.Домен + "/sub/...")
            { Bounds = new Rectangle(М(Поля), М(92), М(ш - 108), М(40)) };
            полеСсылки.Текст.Width = полеСсылки.Width - 24;
            полеСсылки.Текст.KeyDown += delegate (object о, KeyEventArgs е)
            { if (е.KeyCode == Keys.Enter) { е.SuppressKeyPress = true; ЗагрузитьПодписку(false); } };
            Controls.Add(полеСсылки);

            кнопкаЗагрузить = new Тихая("Загрузить") { Bounds = new Rectangle(М(Поля + ш - 100), М(92), М(100), М(40)) };
            кнопкаЗагрузить.Click += delegate { ЗагрузитьПодписку(false); };
            Controls.Add(кнопкаЗагрузить);

            сообщение = Подпись("", Поля, 138, ш, Тема.ТекстОченьТихо, 8.5f);
            Controls.Add(сообщение);

            подписьСерверов = Подпись("Серверы", Поля, 162, 160, Тема.ТекстТихо, 9f);
            Controls.Add(подписьСерверов);

            кнопкаБыстрый = new Тихая("Быстрый") { Bounds = new Rectangle(М(Поля + ш - 182), М(160), М(80), М(22)) };
            кнопкаБыстрый.Click += delegate { ВзятьБыстрый(); };
            Controls.Add(кнопкаБыстрый);

            кнопкаЗамерить = new Тихая("Замерить") { Bounds = new Rectangle(М(Поля + ш - 95), М(160), М(95), М(22)) };
            кнопкаЗамерить.Click += delegate { Замерить(null); };
            Controls.Add(кнопкаЗамерить);

            Рамка рамка = new Рамка { Bounds = new Rectangle(М(Поля), М(184), М(ш), М(210)) };
            Controls.Add(рамка);

            список = new СписокУзлов { Bounds = new Rectangle(М(1), М(6), М(ш - 2), М(198)) };
            список.SelectedIndexChanged += delegate { ЗапомнитьВыбор(); };
            список.DoubleClick += delegate { if (!подключены) Подключить(null); };
            рамка.Controls.Add(список);

            пуск = new КнопкаПуска { Bounds = new Rectangle(М(Поля), М(410), М(ш), М(56)) };
            пуск.Click += delegate { if (подключены || идётПодключение) Отключить(); else Подключить(null); };
            Controls.Add(пуск);

            статус = Подпись("Отключено", Поля, 480, ш, Тема.Текст, 11f);
            статус.TextAlign = ContentAlignment.MiddleCenter;
            статус.Font = Тема.Шрифт(11f, FontStyle.Bold);
            Controls.Add(статус);

            подробность = Подпись("", Поля, 504, ш, Тема.ТекстОченьТихо, 8.5f);
            подробность.TextAlign = ContentAlignment.MiddleCenter;
            Controls.Add(подробность);

            автозапуск = Галка("Запускать с Windows", Поля, 548, 190, Автозапуск.Включён);
            автозапуск.CheckedChanged += delegate
            {
                Автозапуск.Поставить(автозапуск.Checked);
                настройки.Автозапуск = автозапуск.Checked;
                настройки.Записать();
            };
            Controls.Add(автозапуск);

            кнопкаЖурнал = new Тихая("Журнал") { Bounds = new Rectangle(М(Поля + ш - 190), М(548), М(70), М(24)) };
            кнопкаЖурнал.Цвет = Тема.ТекстТихо;
            кнопкаЖурнал.Click += delegate { ОткрытьЖурнал(); };
            Controls.Add(кнопкаЖурнал);

            кнопкаОбновить = new Тихая("Обновления") { Bounds = new Rectangle(М(Поля + ш - 110), М(548), М(110), М(24)) };
            кнопкаОбновить.Click += delegate { ПроверитьОбновления(true); };
            Controls.Add(кнопкаОбновить);
        }

        private void СлойНастроек()
        {
            int ш = Ширина - Поля * 2;
            слойНастроек = new Panel
            {
                Bounds = new Rectangle(0, М(54), М(Ширина), М(Высота) - М(54)),
                BackColor = Тема.Фон,
                Visible = false
            };
            Controls.Add(слойНастроек);
            слойНастроек.BringToFront();

            слойНастроек.Controls.Add(Подпись("Настройки", Поля, 16, 200, Тема.Текст, 12f));

            кнопкаНазад = new Тихая("Готово") { Bounds = new Rectangle(М(Поля + ш - 80), М(16), М(80), М(24)) };
            кнопкаНазад.Click += delegate { ПоказатьНастройки(false); };
            слойНастроек.Controls.Add(кнопкаНазад);

            слойНастроек.Controls.Add(Подпись("Что вести через VPN", Поля, 58, ш, Тема.ТекстТихо, 9f));

            RadioButton весь = Выбор("Весь трафик", Поля, 82, ш, настройки.Маршрутизация == Конфиг.ВесьТрафик);
            RadioButton умный = Выбор("Умный: российские сайты напрямую", Поля, 108, ш, настройки.Маршрутизация == Конфиг.Умный);
            весь.CheckedChanged += delegate
            {
                if (!весь.Checked) return;
                настройки.Маршрутизация = Конфиг.ВесьТрафик; настройки.Записать(); НамекнутьНаПерезапуск();
            };
            умный.CheckedChanged += delegate
            {
                if (!умный.Checked) return;
                настройки.Маршрутизация = Конфиг.Умный; настройки.Записать(); НамекнутьНаПерезапуск();
            };
            слойНастроек.Controls.Add(весь);
            слойНастроек.Controls.Add(умный);

            слойНастроек.Controls.Add(Подпись("Поведение", Поля, 148, ш, Тема.ТекстТихо, 9f));

            CheckBox обновлять = Галка("Обновлять подписку при запуске", Поля, 172, ш, настройки.ОбновлятьПодписку);
            обновлять.CheckedChanged += delegate { настройки.ОбновлятьПодписку = обновлять.Checked; настройки.Записать(); };
            слойНастроек.Controls.Add(обновлять);

            CheckBox держать = Галка("Переподключаться при обрыве", Поля, 198, ш, настройки.ПерезапускатьПриОбрыве);
            держать.CheckedChanged += delegate { настройки.ПерезапускатьПриОбрыве = держать.Checked; настройки.Записать(); };
            слойНастроек.Controls.Add(держать);

            CheckBox проверять = Галка("Проверять соединение после подключения", Поля, 224, ш, настройки.ПроверятьПослеПодключения);
            проверять.CheckedChanged += delegate { настройки.ПроверятьПослеПодключения = проверять.Checked; настройки.Записать(); };
            слойНастроек.Controls.Add(проверять);

            CheckBox сортировать = Галка("Сортировать список по задержке", Поля, 250, ш, настройки.СортироватьПоЗадержке);
            сортировать.CheckedChanged += delegate
            {
                настройки.СортироватьПоЗадержке = сортировать.Checked; настройки.Записать();
                if (сортировать.Checked) ПереложитьПоЗадержке();
            };
            слойНастроек.Controls.Add(сортировать);

            CheckBox обновления = Галка("Проверять обновления программы", Поля, 276, ш, настройки.ПроверятьОбновления);
            обновления.CheckedChanged += delegate { настройки.ПроверятьОбновления = обновления.Checked; настройки.Записать(); };
            слойНастроек.Controls.Add(обновления);

            слойНастроек.Controls.Add(Подпись("Порты на этом компьютере", Поля, 316, ш, Тема.ТекстТихо, 9f));

            Поле пSocks = ПолеЧисла(настройки.ПортSocks, Поля, 340);
            Поле пHttp = ПолеЧисла(настройки.ПортHttp, Поля + 150, 340);
            слойНастроек.Controls.Add(Подпись("socks", Поля + 106, 350, 40, Тема.ТекстОченьТихо, 8.5f));
            слойНастроек.Controls.Add(Подпись("http", Поля + 256, 350, 40, Тема.ТекстОченьТихо, 8.5f));
            слойНастроек.Controls.Add(пSocks);
            слойНастроек.Controls.Add(пHttp);
            пSocks.Текст.LostFocus += delegate { настройки.ПортSocks = Число(пSocks.Текст.Text, настройки.ПортSocks); настройки.Записать(); };
            пHttp.Текст.LostFocus += delegate { настройки.ПортHttp = Число(пHttp.Текст.Text, настройки.ПортHttp); настройки.Записать(); };

            слойНастроек.Controls.Add(Подпись(
                "Клиент принимает ссылки только с " + Подписка.Домен + ".\nЭто ограничение вшито в программу.",
                Поля, 392, ш, Тема.ТекстОченьТихо, 8.5f, 36));

            слойНастроек.Controls.Add(Подпись("Rocket VPN · " + Обновление.ОписаниеВерсии(),
                Поля, Высота - 54 - 40, ш, Тема.ТекстОченьТихо, 8.5f));
        }

        private void Трей()
        {
            ContextMenuStrip меню = new ContextMenuStrip();
            меню.Items.Add("Показать", null, delegate { Показаться(); });
            пунктСерверы = new ToolStripMenuItem("Серверы");
            меню.Items.Add(пунктСерверы);
            меню.Items.Add("Отключить", null, delegate { if (подключены || идётПодключение) Отключить(); });
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
        }

        // ── ОРГАНЫ ПОМЕЛЬЧЕ ────────────────────────────────────────

        private static int М(int п) { return Тема.М(п); }

        private static Rectangle РабочаяОбласть()
        {
            try { return Screen.FromPoint(Cursor.Position).WorkingArea; }
            catch { return Screen.PrimaryScreen.WorkingArea; }
        }

        /* Окно целиком внутри экрана. CenterScreen ставит по главному
           монитору, а мы могли ужаться под другой; к тому же на
           нестандартной панели задач центр уезжает под неё. */
        private void ВпихнутьВЭкран()
        {
            Rectangle р = РабочаяОбласть();
            int x = Math.Max(р.Left, Math.Min(Left, р.Right - Width));
            int y = Math.Max(р.Top, Math.Min(Top, р.Bottom - Height));
            if (x != Left || y != Top) Location = new Point(x, y);
        }

        private Label Подпись(string текст, int x, int y, int ш, Color цвет, float кегль)
        {
            return Подпись(текст, x, y, ш, цвет, кегль, 24);
        }

        private Label Подпись(string текст, int x, int y, int ш, Color цвет, float кегль, int в)
        {
            return new Label
            {
                Text = текст,
                Bounds = new Rectangle(М(x), М(y), М(ш), М(в)),
                ForeColor = цвет,
                BackColor = Color.Transparent,
                Font = Тема.Шрифт(кегль),
                AutoSize = false
            };
        }

        private Тихая ЗнакОкна(string подпись, int x, EventHandler что)
        {
            Тихая к = new Тихая(подпись) { Bounds = new Rectangle(М(x), М(15), М(24), М(24)) };
            к.Цвет = Тема.ТекстТихо;
            к.Font = Тема.Шрифт(11f);
            к.Click += что;
            return к;
        }

        private CheckBox Галка(string подпись, int x, int y, int ш, bool стоит)
        {
            return new CheckBox
            {
                Text = подпись,
                Bounds = new Rectangle(М(x), М(y), М(ш), М(24)),
                ForeColor = Тема.ТекстТихо,
                BackColor = Тема.Фон,
                FlatStyle = FlatStyle.Flat,
                Font = Тема.Шрифт(9f),
                Checked = стоит
            };
        }

        private RadioButton Выбор(string подпись, int x, int y, int ш, bool стоит)
        {
            return new RadioButton
            {
                Text = подпись,
                Bounds = new Rectangle(М(x), М(y), М(ш), М(24)),
                ForeColor = Тема.ТекстТихо,
                BackColor = Тема.Фон,
                FlatStyle = FlatStyle.Flat,
                Font = Тема.Шрифт(9f),
                Checked = стоит
            };
        }

        private Поле ПолеЧисла(int значение, int x, int y)
        {
            Поле п = new Поле("") { Bounds = new Rectangle(М(x), М(y), М(100), М(36)) };
            п.Текст.Text = значение.ToString();
            п.Текст.Width = 76;
            return п;
        }

        private static int Число(string с, int запас)
        {
            int н;
            return (int.TryParse((с ?? "").Trim(), out н) && н > 0 && н < 65536) ? н : запас;
        }

        /* Рамка вокруг списка. Отдельный класс нужен только ради своей
           отрисовки: панель без неё была бы прямоугольной. */
        private sealed class Рамка : Panel
        {
            public Рамка()
            {
                SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                         ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
                BackColor = Тема.Подложка;
            }
            protected override void OnPaint(PaintEventArgs е)
            {
                Тема.Плитой(е.Graphics, new Rectangle(М(0), М(0), М(Width - 1), М(Height - 1)), 12, Тема.Подложка, Тема.Кромка);
            }
        }

        protected override void OnPaint(PaintEventArgs е)
        {
            base.OnPaint(е);
            using (Pen перо = new Pen(Тема.Кромка))
                е.Graphics.DrawRectangle(перо, 0, 0, Width - 1, Height - 1);
        }

        private void ПоказатьНастройки(bool надо)
        {
            слойНастроек.Visible = надо;
            if (надо) слойНастроек.BringToFront();
        }

        private void НамекнутьНаПерезапуск()
        {
            if (подключены) Сказать("Режим применится при следующем подключении.", Тема.ТекстТихо);
        }

        // ── ДАННЫЕ ─────────────────────────────────────────────────

        private void ПоднятьСохранённое()
        {
            полеСсылки.Текст.Text = настройки.Ссылка ?? "";
            if (!string.IsNullOrEmpty(настройки.ПоследняяПодписка))
            {
                string почему;
                List<Узел> у = Подписка.РазобратьТело(настройки.ПоследняяПодписка, out почему);
                if (у.Count > 0)
                    Показать(у, "Список от " + настройки.ПодпискаОбновлена.ToString("dd.MM HH:mm"));
            }

            bool пора = настройки.ОбновлятьПодписку &&
                        !string.IsNullOrEmpty(настройки.Ссылка) &&
                        (DateTime.Now - настройки.ПодпискаОбновлена).TotalHours >= настройки.ЧасовМеждуОбновлениями;
            if (пора)
                ThreadPool.QueueUserWorkItem(delegate { Thread.Sleep(1200); ВПотоке(delegate { ЗагрузитьПодписку(true); }); });

            if (настройки.ПроверятьОбновления)
                ThreadPool.QueueUserWorkItem(delegate { Thread.Sleep(5000); ПроверитьОбновления(false); });
        }

        private void ЗагрузитьПодписку(bool тихо)
        {
            string адрес = полеСсылки.Текст.Text.Trim();
            string почему;
            if (!Подписка.ДоменСвой(адрес, out почему))
            {
                if (!тихо) Сказать(почему, Тема.Тревога);
                return;
            }

            Сказать("Загружаем...", Тема.ТекстТихо);
            кнопкаЗагрузить.Enabled = false;

            ThreadPool.QueueUserWorkItem(delegate
            {
                string беда, сырое;
                List<Узел> найдено = Подписка.ЗагрузитьСТелом(адрес, out беда, out сырое);
                ВПотоке(delegate
                {
                    кнопкаЗагрузить.Enabled = true;
                    if (найдено.Count == 0) { Сказать(беда, Тема.Тревога); return; }

                    настройки.Ссылка = адрес;
                    настройки.ПоследняяПодписка = сырое;
                    настройки.ПодпискаОбновлена = DateTime.Now;
                    настройки.Записать();
                    Показать(найдено, "Серверов: " + найдено.Count);
                    Замерить(null);
                });
            });
        }

        private void Показать(List<Узел> найдено, string слово)
        {
            узлы.Clear();
            узлы.AddRange(найдено);
            Перерисовать();

            int н = узлы.FindIndex(delegate (Узел у) { return у.Подпись == настройки.ВыбранныйУзел; });
            if (н < 0 && узлы.Count > 0) н = 0;
            if (н >= 0) список.SelectedIndex = н;
            Сказать(слово, Тема.ТекстТихо);
            СобратьМенюСерверов();
        }

        private void Перерисовать()
        {
            Узел был = список.SelectedItem as Узел;
            список.BeginUpdate();
            список.Items.Clear();
            foreach (Узел у in узлы) список.Items.Add(у);
            список.EndUpdate();
            подписьСерверов.Text = "Серверы · " + узлы.Count;
            if (был != null)
            {
                int н = узлы.IndexOf(был);
                if (н >= 0) список.SelectedIndex = н;
            }
        }

        private void Замерить(Action потом)
        {
            if (узлы.Count == 0) { if (потом != null) потом(); return; }
            foreach (Узел у in узлы) у.Задержка = -1;
            список.Invalidate();
            Замер.Померить(узлы, delegate
            {
                ВПотоке(delegate
                {
                    if (настройки.СортироватьПоЗадержке) ПереложитьПоЗадержке();
                    else список.Invalidate();
                    СобратьМенюСерверов();
                    if (потом != null) потом();
                });
            });
        }

        /* Не ответившие уходят вниз, а не наверх: у них задержка -2, и
           простая сортировка числом поставила бы мёртвые первыми. */
        private void ПереложитьПоЗадержке()
        {
            узлы.Sort(delegate (Узел а, Узел б)
            {
                int ка = а.Задержка < 0 ? int.MaxValue : а.Задержка;
                int кб = б.Задержка < 0 ? int.MaxValue : б.Задержка;
                if (ка != кб) return ка.CompareTo(кб);
                return string.Compare(а.Подпись, б.Подпись, StringComparison.CurrentCulture);
            });
            Перерисовать();
        }

        private Узел Быстрейший()
        {
            Узел лучший = null;
            foreach (Узел у in узлы)
                if (у.Задержка >= 0 && (лучший == null || у.Задержка < лучший.Задержка)) лучший = у;
            return лучший;
        }

        private void ВзятьБыстрый()
        {
            if (узлы.Count == 0) { Сказать("Сначала загрузите подписку.", Тема.Тревога); return; }
            Узел б = Быстрейший();
            if (б != null) { Выбрать(б); Подключить(б); return; }

            Сказать("Меряем, чтобы выбрать быстрый...", Тема.ТекстТихо);
            Замерить(delegate
            {
                Узел в = Быстрейший();
                if (в == null) { Сказать("Ни один сервер не ответил.", Тема.Тревога); return; }
                Выбрать(в);
                Подключить(в);
            });
        }

        private void Выбрать(Узел у)
        {
            int н = узлы.IndexOf(у);
            if (н >= 0) список.SelectedIndex = н;
        }

        private void ЗапомнитьВыбор()
        {
            Узел у = список.SelectedItem as Узел;
            if (у == null) return;
            настройки.ВыбранныйУзел = у.Подпись;
            настройки.Записать();
        }

        private void СобратьМенюСерверов()
        {
            if (пунктСерверы == null) return;
            пунктСерверы.DropDownItems.Clear();
            int сколько = 0;
            foreach (Узел у in узлы)
            {
                if (сколько++ >= 12) break;
                Узел мой = у;
                string подпись = у.Подпись + (у.Задержка >= 0 ? "   " + у.Задержка + " мс" : "");
                пунктСерверы.DropDownItems.Add(подпись, null, delegate { Выбрать(мой); Подключить(мой); });
            }
            if (узлы.Count > 12)
                пунктСерверы.DropDownItems.Add("Ещё в окне...", null, delegate { Показаться(); });
            пунктСерверы.Enabled = узлы.Count > 0;
        }

        // ── СОЕДИНЕНИЕ ─────────────────────────────────────────────

        private void Подключить(Узел какой)
        {
            Узел у = какой ?? (список.SelectedItem as Узел);
            if (у == null) { Сказать("Сначала загрузите подписку и выберите сервер.", Тема.Тревога); return; }

            текущий = у;
            int моё = ++поколение;
            идётПодключение = true;
            пуск.Состояние = КнопкаПуска.Вид.Идёт;
            статус.Text = "Подключаем";
            статус.ForeColor = Тема.Текст;
            подробность.Text = у.Подпись;
            Сказать("", Тема.ТекстТихо);

            int режим = настройки.Маршрутизация;
            int socks = настройки.ПортSocks, http = настройки.ПортHttp;

            ThreadPool.QueueUserWorkItem(delegate
            {
                string беда = "";
                try
                {
                    ядро.Запустить(Конфиг.Собрать(у, socks, http, режим));
                    /* Ядру нужно мгновение, чтобы занять порт. Если за
                       полторы секунды оно упало, прокси включать нельзя:
                       иначе человек останется совсем без интернета. */
                    Thread.Sleep(1500);
                    if (!ядро.Живо) беда = "Ядро не запустилось, смотрите журнал.";
                }
                catch (Exception е) { беда = е.Message; }

                if (моё != поколение) { ядро.Остановить(); return; }
                if (беда != "") { ВПотоке(delegate { if (моё == поколение) НеВышло(беда); }); return; }

                СистемныйПрокси.Включить("127.0.0.1:" + http);
                ВПотоке(delegate
                {
                    if (моё != поколение) return;
                    идётПодключение = false;
                    подключены = true;
                    попытокПодряд = 0;
                    пуск.Состояние = КнопкаПуска.Вид.Подключено;
                    статус.Text = "Подключено";
                    статус.ForeColor = Тема.Удача;
                    подробность.Text = у.Подпись + (у.Задержка > 0 ? "  ·  " + у.Задержка + " мс" : "");
                    значокТрея.Text = Коротко("Rocket VPN · " + у.Подпись);
                });

                if (настройки.ПроверятьПослеПодключения)
                {
                    Проверка п = Проверяльщик.Проверить(http);
                    ВПотоке(delegate
                    {
                        if (!подключены || моё != поколение) return;
                        if (п.Прошла) подробность.Text = у.Подпись + "  ·  " + п.Коротко;
                        else Сказать(п.Беда, Тема.Тревога);
                    });
                }
            });
        }

        private void НеВышло(string беда)
        {
            идётПодключение = false;
            подключены = false;
            пуск.Состояние = КнопкаПуска.Вид.Отключено;
            статус.Text = "Отключено";
            статус.ForeColor = Тема.Текст;
            Сказать(беда, Тема.Тревога);
        }

        private void Отключить()
        {
            поколение++;
            СистемныйПрокси.Выключить();
            ядро.Остановить();
            подключены = false;
            идётПодключение = false;
            попытокПодряд = 0;
            пуск.Состояние = КнопкаПуска.Вид.Отключено;
            статус.Text = "Отключено";
            статус.ForeColor = Тема.Текст;
            подробность.Text = "";
            значокТрея.Text = "Rocket VPN";
        }

        /* Ядро закрылось само. Три попытки подряд и остановка: если
           сервер лёг, бесконечный цикл переподключений будет греть
           машину и мигать уведомлениями всю ночь. */
        private void ЯдроУпало()
        {
            if (!подключены && !идётПодключение) return;
            Журнал.Писать("ядро закрылось само");

            if (!настройки.ПерезапускатьПриОбрыве || текущий == null || попытокПодряд >= 3)
            {
                Отключить();
                Сказать(попытокПодряд >= 3
                    ? "Соединение рвётся, попробуйте другой сервер."
                    : "Соединение оборвалось.", Тема.Тревога);
                return;
            }

            попытокПодряд++;
            подключены = false;
            статус.Text = "Переподключаем";
            статус.ForeColor = Тема.Текст;
            Сказать("Обрыв, попытка " + попытокПодряд + " из 3.", Тема.ТекстТихо);
            Узел тот = текущий;
            ThreadPool.QueueUserWorkItem(delegate
            {
                Thread.Sleep(2000);
                ВПотоке(delegate { if (!выходим) Подключить(тот); });
            });
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

        private static string Коротко(string т)
        {
            /* Подпись значка в трее Windows режет после 63 знаков, и
               обрезанная середина выглядит поломкой. Режем сами. */
            return т.Length <= 60 ? т : т.Substring(0, 57) + "...";
        }

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
                if (подключены || идётПодключение) СистемныйПрокси.Выключить();
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
