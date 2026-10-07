/* ОРГАНЫ ОКНА: кнопка пуска, список серверов, поле ввода.

   Вынесены отдельно, потому что все три рисуются сами: родные органы
   Windows 7 не умеют тёмной темы, и покрашенная в тёмный цвет штатная
   кнопка остаётся серой рамкой на чёрном. */
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace RocketVPN
{
    /* Большая кнопка подключения. Три состояния: отключено, в работе,
       подключено. Цвет несёт состояние, подпись дублирует его словом:
       по одному цвету человек не обязан догадываться. */
    internal sealed class КнопкаПуска : Control
    {
        public enum Вид { Отключено, Идёт, Подключено }
        private Вид состояние = Вид.Отключено;
        private bool подНосом;
        private int фаза;
        private readonly Timer часы = new Timer();

        public КнопкаПуска()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Cursor = Cursors.Hand;
            Height = 56;
            часы.Interval = 40;
            часы.Tick += delegate { фаза = (фаза + 6) % 360; Invalidate(); };
        }

        public Вид Состояние
        {
            get { return состояние; }
            set
            {
                состояние = value;
                часы.Enabled = (value == Вид.Идёт);
                Invalidate();
            }
        }

        protected override void OnMouseEnter(EventArgs е) { подНосом = true; Invalidate(); base.OnMouseEnter(е); }
        protected override void OnMouseLeave(EventArgs е) { подНосом = false; Invalidate(); base.OnMouseLeave(е); }

        protected override void OnPaint(PaintEventArgs е)
        {
            Graphics г = е.Graphics;
            г.SmoothingMode = SmoothingMode.AntiAlias;
            г.Clear(Parent != null ? Parent.BackColor : Тема.Фон);

            Rectangle р = new Rectangle(0, 0, Width - 1, Height - 1);
            Color слева, справа;
            string подпись;
            switch (состояние)
            {
                case Вид.Подключено:
                    слева = Color.FromArgb(24, 120, 86); справа = Тема.Удача;
                    подпись = "Отключить"; break;
                case Вид.Идёт:
                    слева = Тема.ИндигоТень; справа = Тема.Индиго;
                    подпись = "Подключаем"; break;
                default:
                    слева = Тема.ИндигоТень; справа = Тема.ИндигоСвет;
                    подпись = "Подключить"; break;
            }
            if (подНосом)
            {
                слева = ControlPaint.Light(слева, .12f);
                справа = ControlPaint.Light(справа, .12f);
            }

            using (GraphicsPath п = Тема.Скругление(р, Height / 2))
            using (LinearGradientBrush к = new LinearGradientBrush(р, слева, справа, 135f))
            {
                г.FillPath(к, п);
                using (Pen перо = new Pen(Color.FromArgb(70, 255, 255, 255)))
                    г.DrawPath(перо, п);
            }

            if (состояние == Вид.Идёт)
            {
                /* Бегущий блик вместо крутилки: место под текстом не
                   отнимает, а видно, что программа жива. */
                int ш = Width / 3;
                int x = (int)((фаза / 360f) * (Width + ш)) - ш;
                using (GraphicsPath п = Тема.Скругление(р, Height / 2))
                {
                    г.SetClip(п);
                    using (LinearGradientBrush б = new LinearGradientBrush(
                        new Rectangle(x, 0, ш, Height),
                        Color.FromArgb(0, 255, 255, 255), Color.FromArgb(70, 255, 255, 255), 0f))
                        г.FillRectangle(б, x, 0, ш, Height);
                    г.ResetClip();
                }
            }

            using (SolidBrush т = new SolidBrush(Color.White))
            using (StringFormat ф = new StringFormat
            { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
            using (Font шр = Тема.Шрифт(13f, FontStyle.Bold))
                г.DrawString(подпись, шр, т, р, ф);
        }

        protected override void Dispose(bool убираем)
        {
            if (убираем) часы.Dispose();
            base.Dispose(убираем);
        }
    }

    /* Список серверов. Своя отрисовка: имя слева, задержка справа
       цветом светофора, выбранная строка с индиговой подложкой. */
    internal sealed class СписокУзлов : ListBox
    {
        public СписокУзлов()
        {
            DrawMode = DrawMode.OwnerDrawFixed;
            ItemHeight = 38;
            BorderStyle = BorderStyle.None;
            BackColor = Тема.Подложка;
            ForeColor = Тема.Текст;
            IntegralHeight = false;
            Font = Тема.Шрифт(10f);
        }

        protected override void OnDrawItem(DrawItemEventArgs е)
        {
            if (е.Index < 0 || е.Index >= Items.Count) return;
            Узел у = Items[е.Index] as Узел;
            if (у == null) return;

            Graphics г = е.Graphics;
            г.SmoothingMode = SmoothingMode.AntiAlias;
            bool выбран = (е.State & DrawItemState.Selected) == DrawItemState.Selected;

            г.FillRectangle(new SolidBrush(Тема.Подложка), е.Bounds);
            Rectangle р = new Rectangle(е.Bounds.X + 4, е.Bounds.Y + 3, е.Bounds.Width - 9, е.Bounds.Height - 6);
            if (выбран)
                Тема.Плитой(г, р, 10, Color.FromArgb(46, 48, 72, 168), Тема.Кромка);

            using (SolidBrush т = new SolidBrush(выбран ? Тема.Текст : Тема.ТекстТихо))
            using (StringFormat ф = new StringFormat
            { LineAlignment = StringAlignment.Center, Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap })
                г.DrawString(у.Подпись, Font, т,
                    new RectangleF(р.X + 12, р.Y, р.Width - 86, р.Height), ф);

            string задержка;
            Color цвет;
            if (у.Задержка == -1) { задержка = "–"; цвет = Тема.ТекстОченьТихо; }
            else if (у.Задержка == -2) { задержка = "нет"; цвет = Тема.Тревога; }
            else
            {
                задержка = у.Задержка + " мс";
                цвет = у.Задержка < 120 ? Тема.Удача
                     : у.Задержка < 300 ? Тема.ИндигоСвет : Тема.Тревога;
            }
            using (SolidBrush т = new SolidBrush(цвет))
            using (StringFormat ф = new StringFormat
            { Alignment = StringAlignment.Far, LineAlignment = StringAlignment.Center })
                г.DrawString(задержка, Font, т,
                    new RectangleF(р.X, р.Y, р.Width - 12, р.Height), ф);
        }
    }

    /* Поле ввода в рамке: сам TextBox без рамки, рамку рисует хозяин. */
    internal sealed class Поле : Panel
    {
        public readonly TextBox Текст = new TextBox();

        public Поле(string подсказка)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            BackColor = Тема.Фон;
            Height = 40;
            Текст.BorderStyle = BorderStyle.None;
            Текст.BackColor = Тема.Подложка;
            Текст.ForeColor = Тема.Текст;
            Текст.Font = Тема.Шрифт(9.5f);
            Текст.Location = new Point(12, 11);
            Controls.Add(Текст);
            Подсказка = подсказка;
            Resize += delegate { Текст.Width = Width - 24; };
        }

        public string Подсказка { get; set; }

        protected override void OnPaint(PaintEventArgs е)
        {
            base.OnPaint(е);
            Rectangle р = new Rectangle(0, 0, Width - 1, Height - 1);
            Тема.Плитой(е.Graphics, р, 10, Тема.Подложка, Тема.Кромка);
            if (Текст.Text.Length == 0 && !Текст.Focused && !string.IsNullOrEmpty(Подсказка))
                using (SolidBrush т = new SolidBrush(Тема.ТекстОченьТихо))
                    е.Graphics.DrawString(Подсказка, Текст.Font, т, 12, 11);
        }
    }

    /* Плоская кнопка-надпись для второстепенных действий. */
    internal sealed class Тихая : Control
    {
        private bool подНосом;
        public Color Цвет = Тема.ИндигоСвет;

        public Тихая(string подпись)
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Text = подпись;
            Cursor = Cursors.Hand;
            Font = Тема.Шрифт(9f);
            Height = 24;
        }

        protected override void OnMouseEnter(EventArgs е) { подНосом = true; Invalidate(); base.OnMouseEnter(е); }
        protected override void OnMouseLeave(EventArgs е) { подНосом = false; Invalidate(); base.OnMouseLeave(е); }

        protected override void OnPaint(PaintEventArgs е)
        {
            е.Graphics.Clear(Parent != null ? Parent.BackColor : Тема.Фон);
            using (SolidBrush т = new SolidBrush(подНосом ? Color.White : Цвет))
            using (StringFormat ф = new StringFormat { LineAlignment = StringAlignment.Center })
                е.Graphics.DrawString(Text, Font, т, new RectangleF(0, 0, Width, Height), ф);
        }
    }

    /* Замер задержки до узлов. Обычный ping не годится: до сервера идёт
       не ICMP, а обычное соединение на его порт, и запрещённый в сети
       ICMP показал бы «не отвечает» у живого сервера. Поэтому меряем
       время установки соединения на тот самый порт. */
    internal static class Замер
    {
        public static void Померить(List<Узел> узлы, Action готово)
        {
            int осталось = узлы.Count;
            if (осталось == 0) { if (готово != null) готово(); return; }

            foreach (Узел у in узлы)
            {
                Узел мой = у;
                System.Threading.ThreadPool.QueueUserWorkItem(delegate
                {
                    мой.Задержка = Один(мой.Адрес, мой.Порт, 1500);
                    if (System.Threading.Interlocked.Decrement(ref осталось) == 0 && готово != null) готово();
                });
            }
        }

        private static int Один(string хост, int порт, int потолок)
        {
            try
            {
                System.Diagnostics.Stopwatch ч = System.Diagnostics.Stopwatch.StartNew();
                using (System.Net.Sockets.TcpClient к = new System.Net.Sockets.TcpClient())
                {
                    IAsyncResult р = к.BeginConnect(хост, порт, null, null);
                    if (!р.AsyncWaitHandle.WaitOne(потолок, false)) return -2;
                    к.EndConnect(р);
                }
                return (int)ч.ElapsedMilliseconds;
            }
            catch { return -2; }
        }
    }
}
