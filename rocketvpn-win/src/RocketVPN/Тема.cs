/* ТЕМА ROCKET VPN.

   Цвета взяты из брендбука сайта (rocketvpn/assets/rv.css), один к
   одному: клиент и сайт должны выглядеть одним продуктом, а не похожим.
   Шрифт Golos Text на семёрке не стоит, поэтому подпираем системным:
   Segoe UI есть везде начиная с Vista. */
using System;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace RocketVPN
{
    internal static class Тема
    {
        public static readonly Color Фон = ЦветИз("#05060C");
        public static readonly Color Подложка = ЦветИз("#0A0E1C");
        public static readonly Color Плита = ЦветИз("#10152A");
        public static readonly Color Текст = ЦветИз("#E8EAF6");
        public static readonly Color ТекстТихо = Color.FromArgb(158, 232, 234, 246);
        public static readonly Color ТекстОченьТихо = Color.FromArgb(97, 232, 234, 246);

        public static readonly Color ИндигоТень = ЦветИз("#2A3A8C");
        public static readonly Color Индиго = ЦветИз("#3048A8");
        public static readonly Color ИндигоСвет = ЦветИз("#6078D8");
        public static readonly Color Кромка = Color.FromArgb(56, 96, 120, 216);

        public static readonly Color Удача = ЦветИз("#35E08F");
        public static readonly Color Тревога = ЦветИз("#FF6A3C");

        /* ── МАСШТАБ ЭКРАНА ──────────────────────────────────────────
           Правка по живому запуску у сетевого администратора: на его
           машине текст вылезал из кнопок и обрезался со всех сторон.
           Причина в том, что разметка была в жёстких точках, а шрифт
           задан в пунктах: при увеличении экрана на 125 или 150
           процентов буквы растут, а коробки под ними нет.

           Теперь каждое число разметки проходит через М(): оно растёт
           вместе с буквами. Коэффициент берётся у самого экрана один
           раз при запуске. Единица это обычные 96 точек на дюйм. */
        public static float К = 1f;

        public static int М(int точек) { return (int)Math.Round(точек * К); }

        public static void ИзмеритьЭкран()
        {
            try
            {
                using (Graphics г = Graphics.FromHwnd(IntPtr.Zero))
                    К = г.DpiX / 96f;
                if (К < .5f || К > 4f) К = 1f;
            }
            catch { К = 1f; }
        }

        public static Font Шрифт(float кегль, FontStyle стиль = FontStyle.Regular)
        {
            return new Font("Segoe UI", кегль, стиль, GraphicsUnit.Point);
        }

        public static Color ЦветИз(string шестнадцать)
        {
            string s = шестнадцать.TrimStart('#');
            return Color.FromArgb(
                Convert.ToInt32(s.Substring(0, 2), 16),
                Convert.ToInt32(s.Substring(2, 2), 16),
                Convert.ToInt32(s.Substring(4, 2), 16));
        }

        /* Скруглённый прямоугольник. Нужен постоянно: плиты, поля,
           кнопка пуска. */
        public static GraphicsPath Скругление(Rectangle р, int радиус)
        {
            int d = радиус * 2;
            GraphicsPath п = new GraphicsPath();
            if (радиус <= 0) { п.AddRectangle(р); return п; }
            п.AddArc(р.X, р.Y, d, d, 180, 90);
            п.AddArc(р.Right - d, р.Y, d, d, 270, 90);
            п.AddArc(р.Right - d, р.Bottom - d, d, d, 0, 90);
            п.AddArc(р.X, р.Bottom - d, d, d, 90, 90);
            п.CloseFigure();
            return п;
        }

        public static void Плитой(Graphics г, Rectangle р, int радиус, Color заливка, Color кромка)
        {
            г.SmoothingMode = SmoothingMode.AntiAlias;
            using (GraphicsPath п = Скругление(р, радиус))
            using (SolidBrush к = new SolidBrush(заливка))
            using (Pen перо = new Pen(кромка))
            {
                г.FillPath(к, п);
                г.DrawPath(перо, п);
            }
        }
    }
}
