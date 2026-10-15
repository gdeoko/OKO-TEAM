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

        /* ── МАСШТАБ ОКНА ───────────────────────────────────────────
           У «любого экрана» два размера, и оба решают.

           ПЕРВЫЙ: НАСКОЛЬКО ЭКРАН КРУПНЫЙ. Правка по живому запуску у
           сетевого администратора: текст вылезал из кнопок и обрезался.
           Разметка была в жёстких точках, а шрифт в пунктах, и при
           увеличении экрана на 125 или 150 процентов буквы росли, а
           коробки под ними нет. Теперь каждое число разметки проходит
           через М() и растёт вместе с буквами.

           ВТОРОЙ: СКОЛЬКО В ЭКРАНЕ ТОЧЕК. Одного роста мало. Окно в
           шестьсот точек высотой при увеличении 125 процентов занимает
           семьсот пятьдесят, а на обычном ноутбуке 1366x768 под окна
           остаётся семьсот двадцать восемь: кнопка подключения уезжает
           за нижний край, и человек видит программу без главного
           органа. На нетбуке 1024x600 окно не влезает даже при
           обычном стопроцентном масштабе.

           Поэтому рост ограничен сверху тем, что реально помещается:
           `Вместить` ужимает его до рабочей области. Ниже 0.75 не
           опускаемся, там буквы становятся нечитаемыми.

           Шрифт при этом идёт за разметкой, а не за экраном: кегль
           делится на крупность экрана и умножается на итоговый рост.
           Иначе ужатое окно осталось бы с прежними буквами, и мы
           вернулись бы к обрезанному тексту, только хуже. */
        public static float ЭкранК = 1f;   // во сколько раз крупен сам экран
        public static float К = 1f;        // во сколько раз рисуем на деле

        public static int М(int точек) { return (int)Math.Round(точек * К); }

        public static void ИзмеритьЭкран()
        {
            try
            {
                using (Graphics г = Graphics.FromHwnd(IntPtr.Zero))
                    ЭкранК = г.DpiX / 96f;
                if (ЭкранК < .5f || ЭкранК > 4f) ЭкранК = 1f;
            }
            catch { ЭкранК = 1f; }
            К = ЭкранК;
        }

        /* Ужать окно под рабочую область. Поля по двадцать точек с
           каждой стороны: окно вплотную к краю выглядит вывалившимся. */
        public static void Вместить(int ширинаТочек, int высотаТочек, Rectangle рабочая)
        {
            if (рабочая.Width <= 0 || рабочая.Height <= 0) return;
            float поШирине = (рабочая.Width - 40f) / ширинаТочек;
            float поВысоте = (рабочая.Height - 40f) / высотаТочек;
            float потолок = Math.Min(поШирине, поВысоте);
            if (К > потолок) К = потолок;
            if (К < .75f) К = .75f;
        }

        public static Font Шрифт(float кегль, FontStyle стиль = FontStyle.Regular)
        {
            /* Segoe UI есть начиная с Vista. На урезанной сборке, где
               его нет, Windows молча подставит Microsoft Sans Serif, и
               конструктор не бросит: проверять нечего. */
            return new Font("Segoe UI", кегль * (ЭкранК > 0 ? К / ЭкранК : 1f),
                            стиль, GraphicsUnit.Point);
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
