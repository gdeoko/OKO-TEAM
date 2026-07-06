# -*- coding: utf-8 -*-
"""
Главный скрипт: генерирует все 16 PDF-плёнок оклейки витрины ЗоОпт,
собирает контактный лист index.pdf и печатает сводку.

Запуск:  python3 src/generate_all.py
"""
import os
import sys
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import design_system as ds
import layouts


def check_assets():
    problems = []
    for f in ["Unbounded-Bold.ttf", "Unbounded-Black.ttf", "Unbounded-SemiBold.ttf",
              "Onest-Medium.ttf", "Onest-Regular.ttf", "Onest-Bold.ttf"]:
        if not os.path.exists(os.path.join(ds.FONTS, f)):
            problems.append(f"нет шрифта {f}")
    for f in ["logo.png", "emblem.png"]:
        if not os.path.exists(os.path.join(ds.ASSETS, f)):
            problems.append(f"нет ассета {f}")
    if problems:
        print("[!] Проблемы с ассетами:")
        for p in problems:
            print("   -", p)
        return False
    return True


def strip_default_font(path):
    """Убирает пустой служебный text-объект reportlab (BT /F1 .. Tf .. ET),
    который тянет невстроенный Helvetica в ресурсы, и саму ссылку на шрифт."""
    import re
    import pikepdf
    try:
        pdf = pikepdf.open(path, allow_overwriting_input=True)
        changed = False
        for page in pdf.pages:
            contents = page.obj.get("/Contents")
            if contents is None:
                continue
            data = page.obj.Contents.read_bytes()
            new = re.sub(rb"BT\s+/F1\s+[-\d.]+\s+Tf\s+[-\d.]+\s+TL\s+ET\s*", b"", data)
            if new != data:
                page.obj.Contents.write(new)
                changed = True
            fonts = page.obj.get("/Resources", {}).get("/Font")
            if fonts is not None and "/F1" in fonts:
                del fonts["/F1"]
                changed = True
        if changed:
            pdf.save(path)
        pdf.close()
    except Exception as e:
        print("   [!] strip_default_font:", os.path.basename(path), e)


def build_all():
    paths = []
    print(f"[*] Генерирую {len(layouts.ALL)} плёнок...")
    for fn in layouts.ALL:
        path = fn()
        strip_default_font(path)
        paths.append(path)
        print("   +", os.path.basename(path))
    return paths


def build_index(paths):
    """Контактный лист: все 16 плёнок мини-превью на одном A2-листе."""
    from reportlab.lib.pagesizes import A2
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader

    index_pdf = os.path.join(ds.OUTPUT, "index.pdf")
    W, H = A2
    c = canvas.Canvas(index_pdf, pagesize=A2)
    ds.register_fonts()
    c.setFillColor(ds.IVORY); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(ds.GREEN_DARK)
    c.setFont(ds.F_HEAD, 22)
    c.drawString(20 * mm, H - 26 * mm, "ЗоОпт — оклейка витрины №69-70")
    c.setFont(ds.F_SUB, 11); c.setFillColor(ds.BLACK)
    c.drawString(20 * mm, H - 33 * mm, "Контактный лист · 16 плёнок · превью перед типографией")

    # рендер миниатюр через pdftoppm
    tmp = os.path.join(ds.OUTPUT, "_thumbs")
    os.makedirs(tmp, exist_ok=True)
    cols, rows = 8, 2
    cell_w = (W - 40 * mm) / cols
    cell_h = (H - 80 * mm) / rows
    for i, pth in enumerate(paths):
        png = os.path.join(tmp, f"t{i}")
        subprocess.run(["pdftoppm", "-r", "24", "-png", "-singlefile", pth, png],
                       check=False)
        png += ".png"
        col = i % cols
        row = i // cols
        x = 20 * mm + col * cell_w
        y = H - 46 * mm - (row + 1) * cell_h
        if os.path.exists(png):
            ir = ImageReader(png)
            iw, ih = ir.getSize()
            scale = min((cell_w - 6 * mm) / iw, (cell_h - 12 * mm) / ih)
            dw, dh = iw * scale, ih * scale
            c.drawImage(ir, x + (cell_w - dw) / 2, y + 10 * mm, dw, dh)
        c.setFont(ds.F_SUB, 6.5); c.setFillColor(ds.BLACK)
        label = os.path.basename(pth).replace("vitrina_", "").replace(".pdf", "")
        c.drawCentredString(x + cell_w / 2, y + 4 * mm, label)
    c.showPage(); c.save()
    return index_pdf


def summary(paths):
    print("\n" + "=" * 56)
    print(" СВОДКА")
    print("=" * 56)
    total_area = 0.0
    total_size = 0
    for pth in paths:
        base = os.path.basename(pth)
        # размеры из имени ..._WxH.pdf
        dims = base.rsplit("_", 1)[-1].replace(".pdf", "")
        try:
            w, h = [float(x) for x in dims.split("x")]
            total_area += (w * h) / 10000.0  # см2 -> м2
        except Exception:
            pass
        total_size += os.path.getsize(pth)
    print(f" Плёнок создано:     {len(paths)}")
    print(f" Суммарная площадь:  {total_area:.2f} м²")
    print(f" Размер файлов:      {total_size/1024/1024:.2f} МБ")
    print(f" Папка вывода:       {ds.OUTPUT}")
    print("=" * 56)


def main():
    print("ЗоОпт · генератор оклейки витрины\n" + "-" * 40)
    check_assets()
    paths = build_all()
    try:
        idx = build_index(paths)
        print("   +", os.path.basename(idx), "(контактный лист)")
    except Exception as e:
        print("[!] index.pdf не собран:", e)
    summary(paths)


if __name__ == "__main__":
    main()
