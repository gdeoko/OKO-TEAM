# -*- coding: utf-8 -*-
"""Промпты сторис: вертикаль 9:16, серии по 3-5 кадров.

Каждый кадр серии это отдельная генерация: сцена, крупная надпись внутри
промпта, место под интерактив снизу. Первый кадр цепляет, средние дают пользу,
последний ведёт в директ.
"""
from promty_mesyaca import БРЕНД, КАЧЕСТВО, КИРИЛЛИЦА, СЪЁМКА, ЧИСТО


def сторис(сцена, заголовок, строка, низ=""):
    низ_строка = (f"Near the bottom, above the safe area, a small line reading "
                  f"exactly «{низ}». " if низ else "")
    return (
     "VERTICAL STORY FRAME, this comes before everything else: output size 1024 "
     "by 1536 pixels, a tall vertical image, never landscape and never square. "
     f"Scene filling the whole frame: {сцена} " + СЪЁМКА +
     "A soft graphite gradient runs from the top edge down over the upper third "
     "so the headline reads clearly, and the bottom fifth stays calm and free "
     "because the interface covers it. " + БРЕНД +
     f"Typography in the upper third: a headline in Russian reading exactly "
     f"«{заголовок}», set large in a tall condensed grotesque, all caps, warm "
     f"white, with a short amber rule above it. Under it a supporting line "
     f"reading exactly «{строка}» in a clean humanist sans, light grey. "
     + низ_строка +
     "Nothing else is written anywhere in the frame. "
     + ЧИСТО + КИРИЛЛИЦА + КАЧЕСТВО)


СЕРИИ = {
"S-01-krt": [
 ("an aerial view of an industrial quarter where residential construction "
  "approaches the production plots, tower cranes on one side",
  "ВАШ ЦЕХ МОЖЕТ УЙТИ ПОД СНОС", "А узнаете вы об этом письмом"),
 ("a laptop showing an open map service with a plot boundary highlighted, a "
  "printed extract beside it, numbers out of focus",
  "ПРОВЕРКА ЗАНИМАЕТ 4 МИНУТЫ", "Кадастровый номер и перечень решений"),
 ("a wide aerial of a working production estate in clear morning light, an "
  "amber cartographic outline around the plot",
  "ПРИШЛЁМ ИНСТРУКЦИЮ", "Напишите слово КВАРТАЛ в директ"),
],
"S-02-ota": [
 ("a dense street of small metal workshops in an Asian city, open roller "
  "shutters, a worker carrying a part across the road",
  "3481 ЦЕХ ВМЕСТО 9100", "Район Ота в Токио за 30 лет"),
 ("the interior of a small family workshop with a lathe and a man working at "
  "it, flats visible through the open door above",
  "ГОРОД ОСТАВИЛ ИХ ВНУТРИ", "Мастерская внизу, жильё выше, школа рядом"),
 ("a wide view of a mixed city block where workshops and housing stand side by "
  "side in daylight",
  "РАЗБИРАЕМ ПО 1 ГОРОДУ В МЕСЯЦ", "Какой следующий? Напишите в директ"),
],
"S-03-cena": [
 ("clean ventilation ductwork with a local extraction hood over a workstation "
  "in a production hall",
  "500 000 И 3 НЕДЕЛИ БЕЗ ОТГРУЗОК", "Вентиляция под техпроцесс"),
 ("a freshly poured industrial floor being levelled by a worker with a screed",
  "ПОЛ ПОД НАГРУЗКУ: 2000-6000 ₽/М²", "И 28 суток, пока сохнет"),
 ("an electrical distribution board being connected by an electrician in a "
  "clean utility room",
  "ЭЛЕКТРИКА ОТ ВВОДА: ОТ 300 000", "Такелаж станка: от 400 000"),
 ("an empty prepared production unit with daylight through an open gate",
  "ПОСЧИТАЕМ ВАШ СЛУЧАЙ", "Напишите слово СМЕТА в директ"),
],
"S-04-brooklyn": [
 ("a converted industrial waterfront campus in a large American city, brick "
  "buildings with modern workshops inside, people walking between them",
  "300 АКРОВ В ЦЕНТРЕ НЬЮ-ЙОРКА", "Бывшая верфь, ставшая площадкой"),
 ("a modern small factory inside an old brick building, machines and workers "
  "visible through large windows",
  "550 КОМПАНИЙ НА ОДНОЙ ТЕРРИТОРИИ", "13 000 рабочих мест"),
 ("a workshop making furniture inside a converted industrial building, tools "
  "and material stacks around",
  "МЕБЕЛЬ, ЭЛЕКТРОНИКА, ЕДА, МЕТАЛЛ", "Всё внутри города"),
 ("an aerial of the same campus at golden hour with the city skyline behind",
  "РАЗБИРАЕМ ПО 1 РАЙОНУ В МЕСЯЦ", "Какой следующий? Напишите в директ"),
],
"S-05-kadry": [
 ("an experienced machinist in his fifties at a lathe in a clean workshop, "
  "hands on the controls",
  "СРЕДНИЙ ВОЗРАСТ ТОКАРЯ 55 ЛЕТ", "Через 5 лет половина уйдёт на пенсию"),
 ("a close view of hands measuring a machined part with a caliper on a "
  "workbench",
  "ЗАРПЛАТЫ ВЫРОСЛИ НА 39 % ЗА ГОД", "Спрос обгоняет предложение в 3-4 раза"),
 ("workers getting off a shuttle bus at an industrial estate in the morning",
  "ДОРОГА РЕШАЕТ, КТО ОСТАНЕТСЯ", "15 минут шаттлом вместо 1,5 часов"),
 ("a wide view of a production hall with several operators working at machines",
  "ПОСЧИТАЕМ ДОРОГУ ВАШЕЙ СМЕНЫ", "Напишите слово КАДРЫ в директ"),
],
"S-06-london": [
 ("an industrial estate in a large European city surrounded by housing, low "
  "workshop buildings with vans outside",
  "ЛОНДОН ЗАЩИТИЛ ПРОМЫШЛЕННУЮ ЗЕМЛЮ", "Половину закрыли от жилой застройки"),
 ("a small logistics depot inside the city with vans being loaded",
  "ЛОГИСТИКА ПОСЛЕДНЕЙ МИЛИ", "Без неё город встаёт"),
 ("a workshop making bicycles or furniture in a converted city building",
  "МАСТЕРСКИЕ ОСТАЛИСЬ В ГОРОДЕ", "Вместе с рабочими местами"),
 ("a city street where a workshop ground floor sits under residential flats",
  "ПРОИЗВОДСТВО И ЖИЛЬЁ РЯДОМ", "Это работает, если считать заранее"),
 ("an aerial of a mixed industrial and residential district in daylight",
  "А КАК У НАС?", "Разбор по ссылке, слово ГОРОД в директ"),
],
"S-07-cifry": [
 ("a polished industrial floor with a heavy lathe bolted down, amber floor "
  "marking running past",
  "4 ЦИФРЫ РЕШАЮТ ВСЁ", "Встанет ваш станок или нет"),
 ("a close view of a machine base on a concrete floor with a steel rule beside "
  "it",
  "5 Т/М² НА ПЕРВОМ ЭТАЖЕ", "И 1,2 т/м² на верхних"),
 ("an electrical distribution board with a meter in a clean utility room",
  "ОТ 20 ДО 300 КВТ", "Отдельной строкой в договоре"),
 ("an empty production unit with a gate open and daylight on the floor",
  "ПРИШЛИТЕ ВЕС СТАНКА", "Напишите слово ПОЛ в директ"),
],
"S-08-voronka": [
 ("a leasing manager's desk with a floor plan, a tape measure and a phone "
  "showing a chat",
  "1 ВОПРОС, ОТВЕТ СЕГОДНЯ", "С цифрой и основанием"),
 ("a printed list of available units on a desk with a calculator, numbers out "
  "of focus",
  "СТАВКА ПО СТРОКАМ И БЛОКИ", "Нагрузка и мощность цифрами"),
 ("a wide view of a working industrial estate in the morning",
  "НАПИШИТЕ СЛОВО ВОПРОС", "Ответим в тот же рабочий день"),
],
"S-09-oshibki": [
 ("a concrete floor with a crack near a machine base, a person crouching to "
  "look at it",
  "5 ОШИБОК НА ПРОСМОТРЕ", "Каждая стоит миллионы"),
 ("a hand pointing at a technical drawing of floor loads on a clipboard",
  "ВЕРИТЬ СЛОВУ «УСИЛЕННОЕ»", "Просите конструктивный расчёт"),
 ("an electrical board with an open door and a meter in a utility room",
  "СМОТРЕТЬ МОЩНОСТЬ ЗДАНИЯ", "А не свою цифру в договоре"),
 ("a truck manoeuvring in an industrial yard with a person watching",
  "НЕ ПРОЙТИ МАРШРУТ МАШИНЫ", "От шлагбаума до ворот блока"),
 ("a wide view of an industrial estate with clean marked roads",
  "ПРИШЛЁМ ЧЕК-ЛИСТ ИЗ 12 ПУНКТОВ", "Напишите слово ПРОСМОТР в директ"),
],
"S-10-sosedi": [
 ("two workers exchanging a machined part in a yard between production "
  "buildings",
  "ДЕТАЛЬ ЗА 3 ЧАСА", "Вместо 4 дней и другого города"),
 ("a metalworking shop with a CNC machine running and an operator beside it",
  "100 ПРОИЗВОДСТВ РЯДОМ", "6 отраслей на одной территории"),
 ("a packaging workshop with printed labels and boxes on a table",
  "МЕТАЛЛ, ДЕРЕВО, ПИЩЁВКА, ПЕЧАТЬ", "Сервис и склад в тех же корпусах"),
 ("a wide view of the estate yard with people walking between buildings",
  "ПОДСКАЖЕМ, КТО ЗАКРОЕТ ВАШИ РАБОТЫ", "Напишите слово СОСЕДИ в директ"),
],
}

ПРОМПТЫ = {}
for ключ, кадры in СЕРИИ.items():
    for н, (сцена, заг, стр) in enumerate(кадры, 1):
        ПРОМПТЫ[f"{ключ}-{н}"] = dict(
            образцы=["ceh", "fasad_1"],
            текст=сторис(сцена, заг, стр,
                         "clusterspace.ru" if н == len(кадры) else ""))


if __name__ == "__main__":
    коротких = [и for и, п in ПРОМПТЫ.items() if len(п["текст"]) < 2000]
    print(f"кадров сторис: {len(ПРОМПТЫ)}, короче 2000: {коротких or 'нет'}")
